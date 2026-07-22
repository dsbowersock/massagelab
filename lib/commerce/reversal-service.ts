import { randomUUID, createHash } from "node:crypto"
import type { Prisma, PrismaClient } from "@prisma/client"
import { runCommerceTransaction } from "./transactions.ts"

type ProcessorRefundRequest = {
  paymentIntentId: string
  amountCents: number
  currency: string
  idempotencyKey: string
  metadata: { orderId: string; refundId: string }
}

type InitiateRefundInput = {
  prismaClient: PrismaClient
  orderId: string
  orderItemIds: string[]
  actorId: string
  reasonCode: string
  createProcessorRefund: (request: ProcessorRefundRequest) => Promise<{ id: string; status?: string }>
}

type RefundableItem = {
  id: string
  orderId: string
  lineTotalCents: number
  currency: string
  refundItems: Array<{ refund?: { status?: string }; amountCents?: number }>
  ownership: { id: string; source: string; status: string } | null
}

type RefundOrder = {
  id: string
  userId: string
  status: string
  currency: string
  items: RefundableItem[]
  payments: Array<{
    id: string
    status: string
    stripePaymentIntentId: string
    amountCents: number
    currency: string
  }>
}

function eventPayloadHash(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex")
}

function assertRefundSelection(order: RefundOrder | null, orderItemIds: string[]) {
  if (!order || order.status !== "PAID" && order.status !== "PARTIALLY_REFUNDED") {
    throw new Error("A paid commerce order is required.")
  }
  if (orderItemIds.length === 0 || new Set(orderItemIds).size !== orderItemIds.length) {
    throw new Error("Select distinct refundable order items.")
  }

  const selected = orderItemIds.map((id) => order.items.find((item) => item.id === id))
  if (selected.some((item) => !item)) {
    throw new Error("Select distinct refundable order items from this order.")
  }
  for (const item of selected as RefundableItem[]) {
    const blocked = item.refundItems.some((entry) => ["PENDING", "SUCCEEDED"].includes(entry.refund?.status ?? ""))
    if (
      item.orderId !== order.id
      || item.currency !== order.currency
      || item.lineTotalCents <= 0
      || blocked
      || item.ownership?.source !== "PURCHASE"
      || item.ownership.status !== "ACTIVE"
    ) {
      throw new Error("Select distinct refundable order items from this order.")
    }
  }

  const items = selected as RefundableItem[]
  const amountCents = items.reduce((total, item) => total + item.lineTotalCents, 0)
  const payment = order.payments.find((candidate) => (
    candidate.status === "SUCCEEDED"
    || candidate.status === "PARTIALLY_REFUNDED"
  ))
  if (!payment || payment.currency !== order.currency || amountCents > payment.amountCents) {
    throw new Error("Refund amount exceeds the selected refundable order-item total.")
  }
  return { items, amountCents, payment }
}

/**
 * Stages an exact-item refund before making the processor call. The stable local
 * refund ID is the Stripe idempotency boundary; ambiguous network outcomes stay
 * pending so reconciliation can bind the processor object without a second refund.
 */
export async function initiateBackgroundRefund(input: InitiateRefundInput) {
  const placeholder = `pending:${randomUUID()}`
  const prepared = await runCommerceTransaction(input.prismaClient, async (tx) => {
    const order = await tx.commerceOrder.findUnique({
      where: { id: input.orderId },
      include: {
        payments: true,
        items: { include: { ownership: true, refundItems: { include: { refund: true } } } },
      },
    }) as RefundOrder | null
    const selection = assertRefundSelection(order, input.orderItemIds)
    const refund = await tx.commerceRefund.create({
      data: {
        orderId: order!.id,
        paymentId: selection.payment.id,
        stripeRefundId: placeholder,
        status: "PENDING",
        amountCents: selection.amountCents,
        currency: order!.currency,
        reasonCode: input.reasonCode,
        items: {
          create: selection.items.map((item) => ({
            orderId: order!.id,
            orderItemId: item.id,
            quantity: 1,
            amountCents: item.lineTotalCents,
          })),
        },
      },
      include: { items: true },
    })

    for (const item of selection.items) {
      const changed = await tx.backgroundOwnership.updateMany({
        where: { id: item.ownership!.id, source: "PURCHASE", status: "ACTIVE" },
        data: { status: "REFUND_PENDING", statusChangedAt: new Date() },
      })
      if (changed.count !== 1) throw new Error("Refund ownership transition conflicted.")
    }
    await tx.commerceEvent.create({
      data: {
        userId: order!.userId,
        orderId: order!.id,
        eventType: "BACKGROUND_REFUND_INITIATED",
        source: "admin",
        actorType: "USER",
        actorId: input.actorId,
        reasonCode: input.reasonCode,
        aggregateType: "CommerceRefund",
        aggregateId: refund.id,
        fromState: null,
        toState: "PENDING",
        payload: { orderItemIds: selection.items.map((item) => item.id), amountCents: selection.amountCents },
      },
    })
    return {
      refundId: refund.id,
      orderId: order!.id,
      userId: order!.userId,
      paymentIntentId: selection.payment.stripePaymentIntentId,
      amountCents: selection.amountCents,
      currency: order!.currency,
    }
  })

  const idempotencyKey = `background-refund:${prepared.refundId}`
  let processorRefund: { id: string; status?: string }
  try {
    processorRefund = await input.createProcessorRefund({
      paymentIntentId: prepared.paymentIntentId,
      amountCents: prepared.amountCents,
      currency: prepared.currency,
      idempotencyKey,
      metadata: { orderId: prepared.orderId, refundId: prepared.refundId },
    })
  } catch {
    return {
      refundId: prepared.refundId,
      processorRefundId: null,
      amountCents: prepared.amountCents,
      status: "PENDING",
      changed: true,
      reconciliationRequired: true,
    }
  }

  await runCommerceTransaction(input.prismaClient, async (tx) => {
    await tx.commerceRefund.update({
      where: { id: prepared.refundId },
      data: { stripeRefundId: processorRefund.id },
    })
    await tx.commerceEvent.create({
      data: {
        userId: prepared.userId,
        orderId: prepared.orderId,
        eventType: "BACKGROUND_REFUND_PROCESSOR_BOUND",
        source: "stripe-api",
        aggregateType: "CommerceRefund",
        aggregateId: prepared.refundId,
        fromState: "PENDING",
        toState: "PENDING",
        payload: { payloadHash: eventPayloadHash({ processorRefundId: processorRefund.id }) },
      },
    })
  })

  return {
    refundId: prepared.refundId,
    processorRefundId: processorRefund.id,
    amountCents: prepared.amountCents,
    status: "PENDING",
    changed: true,
  }
}

type StripeRefundLike = {
  id?: string
  status?: string | null
  amount?: number
  currency?: string
  payment_intent?: unknown
  failure_reason?: string | null
  metadata?: Record<string, string> | null
}

type RefundWebhookInput = {
  prismaClient: PrismaClient
  eventId: string
  eventType: string
  processorCreatedAt?: Date | number
  refund: StripeRefundLike
}

function processorTimestamp(value: Date | number | undefined): string | null {
  const date = value instanceof Date
    ? value
    : typeof value === "number"
      ? new Date(value > 10_000_000_000 ? value : value * 1000)
      : null
  return date && Number.isFinite(date.getTime()) ? date.toISOString() : null
}

function safeFailureCode(value: unknown): string | null {
  return typeof value === "string" && /^[a-z0-9_]{1,80}$/i.test(value) ? value : null
}

async function createReceipt(
  tx: Prisma.TransactionClient,
  input: { eventId: string; eventType: string; userId?: string; orderId?: string; payloadHash: string },
) {
  return tx.commerceWebhookReceipt.create({
    data: {
      userId: input.userId ?? null,
      orderId: input.orderId ?? null,
      provider: "stripe",
      providerEventId: input.eventId,
      eventType: input.eventType,
      payloadHash: input.payloadHash,
    },
  })
}

/** Records an unbound processor reversal using identifiers and a digest only. */
export async function recordUnknownStripeReversal(input: {
  prismaClient: PrismaClient
  eventId: string
  eventType: string
  processorObjectId: string
}) {
  return runCommerceTransaction(input.prismaClient, async (tx) => {
    const existing = await tx.commerceWebhookReceipt.findUnique({
      where: { provider_providerEventId: { provider: "stripe", providerEventId: input.eventId } },
    })
    if (existing) return { changed: false, status: "UNKNOWN_PAYMENT" }
    const receipt = await createReceipt(tx, {
      eventId: input.eventId,
      eventType: input.eventType,
      payloadHash: eventPayloadHash({ processorObjectId: input.processorObjectId }),
    })
    await tx.commerceWebhookReceipt.update({
      where: { id: receipt.id },
      data: { processedAt: new Date(), failureCode: "COMMERCE_PAYMENT_NOT_FOUND" },
    })
    return { changed: true, status: "UNKNOWN_PAYMENT" }
  })
}

/** Applies a Stripe refund event using both event and refund IDs as replay boundaries. */
export async function applyStripeRefundEvent(input: RefundWebhookInput) {
  return runCommerceTransaction(input.prismaClient, async (tx) => {
    const existingReceipt = await tx.commerceWebhookReceipt.findUnique({
      where: { provider_providerEventId: { provider: "stripe", providerEventId: input.eventId } },
    })
    if (existingReceipt) return { changed: false, status: "REPLAYED" }

    const processorRefundId = typeof input.refund.id === "string" ? input.refund.id : ""
    let stored = processorRefundId
      ? await tx.commerceRefund.findUnique({
          where: { stripeRefundId: processorRefundId },
          include: {
            order: true,
            payment: { include: { refunds: true, disputes: true } },
            items: { include: { orderItem: { include: { ownership: true } } } },
          },
        })
      : null
    let boundFromPending = false
    const metadataRefundId = input.refund.metadata?.refundId ?? ""
    if (!stored && processorRefundId && metadataRefundId) {
      const pending = await tx.commerceRefund.findUnique({
        where: { id: metadataRefundId },
        include: {
          order: true,
          payment: { include: { refunds: true, disputes: true } },
          items: { include: { orderItem: { include: { ownership: true } } } },
        },
      })
      if (
        pending
        && pending.stripeRefundId.startsWith("pending:")
        && input.refund.metadata?.orderId === pending.orderId
      ) {
        await tx.commerceRefund.update({
          where: { id: pending.id },
          data: { stripeRefundId: processorRefundId },
        })
        stored = { ...pending, stripeRefundId: processorRefundId }
        boundFromPending = true
      }
    }
    if (!stored) {
      const receipt = await createReceipt(tx, {
        eventId: input.eventId,
        eventType: input.eventType,
        payloadHash: eventPayloadHash({ processorRefundId }),
      })
      await tx.commerceWebhookReceipt.update({
        where: { id: receipt.id },
        data: { processedAt: new Date(), failureCode: "COMMERCE_REFUND_NOT_FOUND" },
      })
      return { changed: false, status: "UNKNOWN_REFUND" }
    }

    const receipt = await createReceipt(tx, {
      eventId: input.eventId,
      eventType: input.eventType,
      userId: stored.order.userId,
      orderId: stored.orderId,
      payloadHash: eventPayloadHash({
        processorRefundId,
        status: input.refund.status,
        amount: input.refund.amount,
        currency: input.refund.currency,
      }),
    })
    const amountMatches = input.refund.amount === stored.amountCents
      && input.refund.currency?.toLowerCase() === stored.currency
    const targetStatus = input.refund.status === "succeeded"
      ? "SUCCEEDED"
      : input.refund.status === "failed" || input.refund.status === "canceled"
        ? "FAILED"
        : "PENDING"

    if (!amountMatches) {
      await tx.commerceWebhookReceipt.update({
        where: { id: receipt.id },
        data: { processedAt: new Date(), failureCode: "REFUND_EVIDENCE_MISMATCH" },
      })
      return { changed: false, status: stored.status, userId: stored.order.userId }
    }
    if (targetStatus === "PENDING" || stored.status !== "PENDING") {
      await tx.commerceWebhookReceipt.update({ where: { id: receipt.id }, data: { processedAt: new Date() } })
      return { changed: false, status: stored.status, userId: stored.order.userId }
    }

    const now = new Date()
    const changed = await tx.commerceRefund.updateMany({
      where: { id: stored.id, status: "PENDING" },
      data: {
        status: targetStatus,
        processedAt: now,
        failureCode: targetStatus === "FAILED" ? safeFailureCode(input.refund.failure_reason) : null,
      },
    })
    if (changed.count !== 1) {
      await tx.commerceWebhookReceipt.update({ where: { id: receipt.id }, data: { processedAt: now } })
      return { changed: false, status: stored.status, userId: stored.order.userId }
    }

    const ownershipIds = stored.items
      .map((item: { orderItem?: { ownership?: { id?: string } | null } }) => item.orderItem?.ownership?.id)
      .filter((id: unknown): id is string => typeof id === "string")
    const failedRestoreStatus = targetStatus === "FAILED"
      && (stored.payment.disputes ?? []).some((dispute: { status: string }) => dispute.status === "OPEN")
      ? "DISPUTE_SUSPENDED"
      : "ACTIVE"
    await tx.backgroundOwnership.updateMany({
      where: {
        id: { in: ownershipIds },
        source: "PURCHASE",
        status: "REFUND_PENDING",
      },
      data: {
        status: targetStatus === "SUCCEEDED" ? "REFUND_REVOKED" : failedRestoreStatus,
        statusChangedAt: now,
      },
    })

    if (targetStatus === "SUCCEEDED") {
      const otherSucceeded = (stored.payment.refunds ?? [])
        .filter((refund: { id: string; status: string }) => refund.id !== stored.id && refund.status === "SUCCEEDED")
        .reduce((total: number, refund: { amountCents: number }) => total + refund.amountCents, 0)
      const totalRefunded = otherSucceeded + stored.amountCents
      const aggregateStatus = totalRefunded >= stored.payment.amountCents ? "REFUNDED" : "PARTIALLY_REFUNDED"
      await tx.commercePayment.update({ where: { id: stored.paymentId }, data: { status: aggregateStatus } })
      await tx.commerceOrder.update({ where: { id: stored.orderId }, data: { status: aggregateStatus } })
    }

    await tx.commerceEvent.create({
      data: {
        userId: stored.order.userId,
        orderId: stored.orderId,
        eventType: targetStatus === "SUCCEEDED" ? "BACKGROUND_REFUND_SUCCEEDED" : "BACKGROUND_REFUND_FAILED",
        source: "stripe-webhook",
        reasonCode: targetStatus === "FAILED" ? safeFailureCode(input.refund.failure_reason) : stored.reasonCode,
        aggregateType: "CommerceRefund",
        aggregateId: stored.id,
        fromState: stored.status,
        toState: targetStatus,
        payload: {
          ...(processorTimestamp(input.processorCreatedAt)
            ? { processorEventCreatedAt: processorTimestamp(input.processorCreatedAt) }
            : {}),
        },
      },
    })
    await tx.commerceWebhookReceipt.update({ where: { id: receipt.id }, data: { processedAt: now } })
    return {
      changed: true,
      status: targetStatus,
      refundId: stored.id,
      userId: stored.order.userId,
      processorBound: boundFromPending,
    }
  })
}

type StripeDisputeLike = {
  id?: string
  status?: string | null
  amount?: number
  currency?: string
  reason?: string | null
}

/**
 * Applies Stripe's dispute state to only purchase ownerships fulfilled by the
 * resolved local payment. Processor time prevents older events from reopening
 * or overwriting a newer closed dispute.
 */
export async function applyStripeDisputeEvent(input: {
  prismaClient: PrismaClient
  eventId: string
  eventType: string
  processorCreatedAt?: Date | number
  paymentIntentId: string
  dispute: StripeDisputeLike
}) {
  return runCommerceTransaction(input.prismaClient, async (tx) => {
    const replay = await tx.commerceWebhookReceipt.findUnique({
      where: { provider_providerEventId: { provider: "stripe", providerEventId: input.eventId } },
    })
    if (replay) return { changed: false, status: "REPLAYED" }

    const payment = input.paymentIntentId
      ? await tx.commercePayment.findUnique({
          where: { stripePaymentIntentId: input.paymentIntentId },
          include: { order: { include: { items: { include: { ownership: true } } } } },
        })
      : null
    const processorDisputeId = typeof input.dispute.id === "string" ? input.dispute.id : ""
    if (!payment) {
      const receipt = await createReceipt(tx, {
        eventId: input.eventId,
        eventType: input.eventType,
        payloadHash: eventPayloadHash({ processorDisputeId }),
      })
      await tx.commerceWebhookReceipt.update({
        where: { id: receipt.id },
        data: { processedAt: new Date(), failureCode: "COMMERCE_PAYMENT_NOT_FOUND" },
      })
      return { changed: false, status: "UNKNOWN_PAYMENT" }
    }

    const receipt = await createReceipt(tx, {
      eventId: input.eventId,
      eventType: input.eventType,
      userId: payment.order.userId,
      orderId: payment.orderId,
      payloadHash: eventPayloadHash({
        processorDisputeId,
        status: input.dispute.status,
        amount: input.dispute.amount,
        currency: input.dispute.currency,
      }),
    })
    const now = new Date()
    if (
      !processorDisputeId
      || input.dispute.amount !== payment.amountCents
      || input.dispute.currency?.toLowerCase() !== payment.currency
    ) {
      await tx.commerceWebhookReceipt.update({
        where: { id: receipt.id },
        data: { processedAt: now, failureCode: "DISPUTE_EVIDENCE_MISMATCH" },
      })
      return { changed: false, status: "EVIDENCE_MISMATCH" }
    }

    const targetStatus = ["won", "warning_closed", "prevented"].includes(input.dispute.status ?? "")
      ? "WON"
      : input.dispute.status === "lost"
        ? "LOST"
        : "OPEN"
    const processorDate = (() => {
      const timestamp = processorTimestamp(input.processorCreatedAt)
      return timestamp ? new Date(timestamp) : now
    })()
    const existing = await tx.commerceDispute.findUnique({
      where: { stripeDisputeId: processorDisputeId },
    })
    const existingFinal = existing && existing.status !== "OPEN"
    const existingTime = existing?.closedAt ?? existing?.openedAt ?? existing?.createdAt
    const olderOrEqual = existingTime instanceof Date && existingTime.getTime() >= processorDate.getTime()
    if (
      existing
      && (existing.status === targetStatus || olderOrEqual || (existingFinal && targetStatus === "OPEN"))
    ) {
      await tx.commerceWebhookReceipt.update({ where: { id: receipt.id }, data: { processedAt: now } })
      return { changed: false, status: existing.status }
    }

    const reasonCode = safeFailureCode(input.dispute.reason)
    const dispute = existing
      ? await (async () => {
          const updated = await tx.commerceDispute.updateMany({
            where: { id: existing.id },
            data: {
              status: targetStatus,
              reasonCode,
              ...(targetStatus === "OPEN"
                ? { openedAt: processorDate, closedAt: null }
                : { closedAt: processorDate }),
            },
          })
          return updated.count === 1 ? { ...existing, status: targetStatus } : existing
        })()
      : await tx.commerceDispute.create({
          data: {
            paymentId: payment.id,
            stripeDisputeId: processorDisputeId,
            status: targetStatus,
            amountCents: input.dispute.amount,
            currency: input.dispute.currency!.toLowerCase(),
            reasonCode,
            openedAt: processorDate,
            closedAt: targetStatus === "OPEN" ? null : processorDate,
          },
        })

    const orderItemIds = payment.order.items.map((item: { id: string }) => item.id)
    if (targetStatus === "OPEN") {
      await tx.backgroundOwnership.updateMany({
        where: {
          sourceOrderItemId: { in: orderItemIds },
          source: "PURCHASE",
          status: "ACTIVE",
        },
        data: { status: "DISPUTE_SUSPENDED", statusChangedAt: now },
      })
    } else if (targetStatus === "WON") {
      await tx.backgroundOwnership.updateMany({
        where: {
          sourceOrderItemId: { in: orderItemIds },
          source: "PURCHASE",
          status: "DISPUTE_SUSPENDED",
        },
        data: { status: "ACTIVE", statusChangedAt: now },
      })
    } else {
      await tx.backgroundOwnership.updateMany({
        where: {
          sourceOrderItemId: { in: orderItemIds },
          source: "PURCHASE",
          status: { in: ["ACTIVE", "DISPUTE_SUSPENDED"] },
        },
        data: { status: "DISPUTE_REVOKED", statusChangedAt: now },
      })
    }

    await tx.commerceEvent.create({
      data: {
        userId: payment.order.userId,
        orderId: payment.orderId,
        eventType: `BACKGROUND_DISPUTE_${targetStatus}`,
        source: "stripe-webhook",
        reasonCode,
        aggregateType: "CommerceDispute",
        aggregateId: dispute.id,
        fromState: existing?.status ?? null,
        toState: targetStatus,
        payload: { processorEventCreatedAt: processorDate.toISOString() },
      },
    })
    await tx.commerceWebhookReceipt.update({ where: { id: receipt.id }, data: { processedAt: now } })
    return {
      changed: true,
      status: targetStatus,
      disputeId: dispute.id,
      userId: payment.order.userId,
    }
  })
}

type RetirementTransition = "RETIRED" | "LEGAL_REFUND_OVERRIDE" | "BECAME_FREE"

/**
 * Applies one ownership-specific catalog retirement. Free conversion preserves
 * history, while a legal cash-refund decision deliberately defers to the exact-
 * item refund lifecycle and issues no replacement credit.
 */
export async function transitionRetiredBackgroundOwnership(input: {
  prismaClient: PrismaClient
  userId: string
  backgroundKey: string
  transition: RetirementTransition
  reasonCode: string
}) {
  if (input.transition !== "RETIRED") {
    return {
      changed: false,
      status: input.transition,
      requiresRefund: input.transition === "LEGAL_REFUND_OVERRIDE",
    }
  }

  return runCommerceTransaction(input.prismaClient, async (tx) => {
    const ownership = await tx.backgroundOwnership.findUnique({
      where: { userId_backgroundKey: { userId: input.userId, backgroundKey: input.backgroundKey } },
    })
    if (!ownership) return { changed: false, status: "UNOWNED", requiresRefund: false }

    const idempotencyKey = `background-credit:retirement-replacement:${ownership.id}`
    const existingEntry = await tx.backgroundCreditEntry.findUnique({ where: { idempotencyKey } })
    if (ownership.status === "RETIRED" && existingEntry) {
      return { changed: false, status: "RETIRED", requiresRefund: false }
    }
    if (ownership.status !== "ACTIVE" || existingEntry) {
      throw new Error("Retirement ownership requires reconciliation.")
    }

    const wallet = await tx.backgroundCreditWallet.findUnique({ where: { userId: input.userId } })
    if (!wallet) throw new Error("Retirement credit wallet requires reconciliation.")
    const now = new Date()
    const ownershipChanged = await tx.backgroundOwnership.updateMany({
      where: { id: ownership.id, status: "ACTIVE" },
      data: { status: "RETIRED", statusChangedAt: now },
    })
    if (ownershipChanged.count !== 1) throw new Error("Retirement ownership transition conflicted.")

    const walletChanged = await tx.backgroundCreditWallet.updateMany({
      where: { id: wallet.id, version: wallet.version },
      data: { balance: { increment: 1 }, version: { increment: 1 } },
    })
    if (walletChanged.count !== 1) throw new Error("Retirement credit transition conflicted.")

    await tx.backgroundCreditEntry.create({
      data: {
        walletId: wallet.id,
        userId: input.userId,
        type: "RETIREMENT_REPLACEMENT",
        delta: 1,
        balanceAfter: wallet.balance + 1,
        idempotencyKey,
        sourceOrderItemId: ownership.sourceOrderItemId,
        reasonCode: input.reasonCode,
      },
    })
    await tx.commerceEvent.create({
      data: {
        userId: input.userId,
        eventType: "BACKGROUND_OWNERSHIP_RETIRED",
        source: "catalog-retirement",
        reasonCode: input.reasonCode,
        aggregateType: "BackgroundOwnership",
        aggregateId: ownership.id,
        fromState: ownership.status,
        toState: "RETIRED",
        payload: { replacementCredits: 1 },
      },
    })
    return { changed: true, status: "RETIRED", requiresRefund: false, creditBalance: wallet.balance + 1 }
  })
}

type ReconciliationIssue = {
  code: string
  orderId: string
  paymentId?: string
  refundId?: string
  disputeId?: string
  ownershipId: string
}

const REPAIR_TRANSITIONS: Record<string, { from: string[]; to: string }> = {
  REFUND_OWNERSHIP_NOT_REVOKED: {
    from: ["ACTIVE", "REFUND_PENDING", "DISPUTE_SUSPENDED"],
    to: "REFUND_REVOKED",
  },
  FAILED_REFUND_OWNERSHIP_NOT_RESTORED: { from: ["REFUND_PENDING"], to: "ACTIVE" },
  PENDING_REFUND_OWNERSHIP_NOT_SUSPENDED: { from: ["ACTIVE"], to: "REFUND_PENDING" },
  OPEN_DISPUTE_OWNERSHIP_NOT_SUSPENDED: { from: ["ACTIVE"], to: "DISPUTE_SUSPENDED" },
  WON_DISPUTE_OWNERSHIP_NOT_RESTORED: { from: ["DISPUTE_SUSPENDED"], to: "ACTIVE" },
  LOST_DISPUTE_OWNERSHIP_NOT_REVOKED: {
    from: ["ACTIVE", "DISPUTE_SUSPENDED"],
    to: "DISPUTE_REVOKED",
  },
}

/** Repairs one previously reported deterministic ownership projection drift. */
export async function repairCommerceReversalIssue(input: {
  prismaClient: PrismaClient
  issue: ReconciliationIssue
}) {
  const transition = REPAIR_TRANSITIONS[input.issue.code]
  if (!transition) return { changed: false, status: "UNSUPPORTED" }

  return runCommerceTransaction(input.prismaClient, async (tx) => {
    const ownership = await tx.backgroundOwnership.findUnique({
      where: { id: input.issue.ownershipId },
      include: { sourceOrderItem: true },
    })
    if (
      !ownership
      || ownership.source !== "PURCHASE"
      || ownership.sourceOrderItem?.orderId !== input.issue.orderId
    ) {
      return { changed: false, status: "STALE" }
    }

    if (input.issue.refundId) {
      const refund = await tx.commerceRefund.findUnique({
        where: { id: input.issue.refundId },
        include: { items: true },
      })
      const expectedStatus = input.issue.code.startsWith("REFUND_OWNERSHIP")
        ? "SUCCEEDED"
        : input.issue.code.startsWith("FAILED_REFUND")
          ? "FAILED"
          : "PENDING"
      if (
        !refund
        || refund.orderId !== input.issue.orderId
        || refund.paymentId !== input.issue.paymentId
        || refund.status !== expectedStatus
        || !refund.items.some((item) => item.orderItemId === ownership.sourceOrderItemId)
      ) {
        return { changed: false, status: "STALE" }
      }
    }
    if (input.issue.disputeId) {
      const dispute = await tx.commerceDispute.findUnique({ where: { id: input.issue.disputeId } })
      const expectedStatus = input.issue.code.startsWith("OPEN_")
        ? "OPEN"
        : input.issue.code.startsWith("WON_")
          ? "WON"
          : "LOST"
      if (!dispute || dispute.paymentId !== input.issue.paymentId || dispute.status !== expectedStatus) {
        return { changed: false, status: "STALE" }
      }
    }

    const now = new Date()
    const changed = await tx.backgroundOwnership.updateMany({
      where: { id: ownership.id, source: "PURCHASE", status: { in: transition.from as never[] } },
      data: { status: transition.to as never, statusChangedAt: now },
    })
    if (changed.count !== 1) return { changed: false, status: "STALE" }
    await tx.commerceEvent.create({
      data: {
        userId: ownership.userId,
        orderId: input.issue.orderId,
        eventType: "COMMERCE_REVERSAL_RECONCILED",
        source: "commerce-reconcile",
        reasonCode: input.issue.code,
        aggregateType: "BackgroundOwnership",
        aggregateId: ownership.id,
        fromState: ownership.status,
        toState: transition.to,
        payload: {
          ...(input.issue.refundId ? { refundId: input.issue.refundId } : {}),
          ...(input.issue.disputeId ? { disputeId: input.issue.disputeId } : {}),
        },
      },
    })
    return { changed: true, status: transition.to }
  })
}
