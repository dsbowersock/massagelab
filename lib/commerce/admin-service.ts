import type { PrismaClient } from "@prisma/client"
import type { CommerceAdminUser } from "./admin-access.ts"
import {
  derivePaymentDisputeProjection,
  initiateBackgroundRefund,
  repairCommerceReversalIssue,
} from "./reversal-service.ts"

type RefundOrderItem = {
  id: string
  orderId: string
  lineTotalCents: number
  currency: string
  ownership: { source: string; status: string } | null
  refundItems: Array<{ refund?: { status?: string } }>
}

type RefundOrder = {
  id: string
  userId: string
  status: string
  currency: string
  items: RefundOrderItem[]
  payments: Array<{ id: string; status: string; amountCents: number; currency: string; stripePaymentIntentId: string }>
}

export type CommerceAdminReconciliationIssue = {
  code: string
  orderId: string
  paymentId?: string
  refundId?: string
  disputeId?: string
  ownershipId?: string
  repairable: boolean
}

export type CommerceAdminReconciliationRequest = Omit<CommerceAdminReconciliationIssue, "repairable">

const REPAIRABLE_RECONCILIATION_CODES = new Set([
  "REFUND_OWNERSHIP_NOT_REVOKED",
  "FAILED_REFUND_OWNERSHIP_NOT_RESTORED",
  "PENDING_REFUND_OWNERSHIP_NOT_SUSPENDED",
  "OPEN_DISPUTE_OWNERSHIP_NOT_SUSPENDED",
  "WON_DISPUTE_OWNERSHIP_NOT_RESTORED",
  "LOST_DISPUTE_OWNERSHIP_NOT_REVOKED",
])

export function isCommerceAdminIssueRepairable(code: string): boolean {
  return REPAIRABLE_RECONCILIATION_CODES.has(code)
}

type ReconciliationOrder = {
  id: string
  status: string
  items?: Array<{ ownership?: { id: string; source: string; status: string } | null }>
  payments?: Array<{ id: string; status: string; disputes?: Array<{ id: string; status: string; closedAt?: Date | null }> }>
  refunds?: Array<{ id: string; paymentId?: string; status: string; processedAt?: Date | null; items?: Array<{ orderItemId: string; orderItem?: { ownership?: { id: string; source: string; status: string } | null } }> }>
}

type UnclassifiedReconciliationIssue = Omit<CommerceAdminReconciliationIssue, "repairable">

function ownershipIssue(code: string, orderId: string, paymentId: string | undefined, related: object, ownershipId: string): UnclassifiedReconciliationIssue {
  return { code, orderId, ...(paymentId ? { paymentId } : {}), ...related, ownershipId }
}

/** Derives repeatable internal-ID-only drift without invoking a processor or mutation. */
export function collectCommerceAdminReconciliationIssues(
  orders: ReconciliationOrder[],
): CommerceAdminReconciliationIssue[] {
  const issues: UnclassifiedReconciliationIssue[] = []
  for (const order of orders) {
    const payments = order.payments ?? []
    for (const payment of payments) {
      if (["PARTIALLY_REFUNDED", "REFUNDED"].includes(payment.status) && order.status !== payment.status) {
        issues.push({ code: "ORDER_PAYMENT_STATUS_MISMATCH", orderId: order.id, paymentId: payment.id })
      }
    }
    for (const refund of order.refunds ?? []) {
      const payment = payments.find((candidate) => candidate.id === refund.paymentId) ?? payments[0]
      if (refund.status === "PENDING" && refund.processedAt) {
        issues.push({ code: "PENDING_REFUND_ALREADY_PROCESSED", orderId: order.id, paymentId: payment?.id, refundId: refund.id })
      }
      for (const refundItem of refund.items ?? []) {
        const ownership = refundItem.orderItem?.ownership
        if (!ownership || ownership.source !== "PURCHASE") continue
        if (refund.status === "SUCCEEDED" && ownership.status !== "REFUND_REVOKED") {
          issues.push(ownershipIssue("REFUND_OWNERSHIP_NOT_REVOKED", order.id, payment?.id, { refundId: refund.id }, ownership.id))
        } else if (refund.status === "FAILED" && ownership.status === "REFUND_PENDING") {
          issues.push(ownershipIssue("FAILED_REFUND_OWNERSHIP_NOT_RESTORED", order.id, payment?.id, { refundId: refund.id }, ownership.id))
        } else if (refund.status === "PENDING" && ownership.status === "ACTIVE") {
          issues.push(ownershipIssue("PENDING_REFUND_OWNERSHIP_NOT_SUSPENDED", order.id, payment?.id, { refundId: refund.id }, ownership.id))
        }
      }
    }
    for (const payment of payments) {
      for (const dispute of payment.disputes ?? []) {
        if (dispute.status === "OPEN" && dispute.closedAt) {
          issues.push({ code: "OPEN_DISPUTE_ALREADY_CLOSED", orderId: order.id, paymentId: payment.id, disputeId: dispute.id })
        } else if (dispute.status !== "OPEN" && !dispute.closedAt) {
          issues.push({ code: "CLOSED_DISPUTE_MISSING_CLOSED_AT", orderId: order.id, paymentId: payment.id, disputeId: dispute.id })
        }
      }
      const disputeProjection = derivePaymentDisputeProjection(payment.disputes ?? [])
      if (!disputeProjection?.disputeId) continue
      for (const item of order.items ?? []) {
        const ownership = item.ownership
        if (!ownership || ownership.source !== "PURCHASE") continue
        if (disputeProjection.status === "OPEN" && ownership.status === "ACTIVE") {
          issues.push(ownershipIssue("OPEN_DISPUTE_OWNERSHIP_NOT_SUSPENDED", order.id, payment.id, { disputeId: disputeProjection.disputeId }, ownership.id))
        } else if (disputeProjection.status === "WON" && ownership.status === "DISPUTE_SUSPENDED") {
          issues.push(ownershipIssue("WON_DISPUTE_OWNERSHIP_NOT_RESTORED", order.id, payment.id, { disputeId: disputeProjection.disputeId }, ownership.id))
        } else if (disputeProjection.status === "LOST" && ["ACTIVE", "DISPUTE_SUSPENDED", "REFUND_PENDING"].includes(ownership.status)) {
          issues.push(ownershipIssue("LOST_DISPUTE_OWNERSHIP_NOT_REVOKED", order.id, payment.id, { disputeId: disputeProjection.disputeId }, ownership.id))
        }
      }
    }
  }
  return issues.map((issue) => ({
    ...issue,
    repairable: isCommerceAdminIssueRepairable(issue.code),
  }))
}

type RefundResult = {
  refundId: string
  amountCents: number
  status: string
  reconciliationRequired?: boolean
  [key: string]: unknown
}

/** Validates an exact immutable item selection before crossing the reversal/Stripe boundary. */
export async function prepareCommerceAdminRefund(input: {
  prismaClient: object
  adminUser: CommerceAdminUser
  orderId: string
  orderItemIds: string[]
  reasonCode: string
  initiateRefund?: (input: {
    prismaClient: unknown
    orderId: string
    orderItemIds: string[]
    actorId: string
    reasonCode: string
    createProcessorRefund: (request: never) => Promise<never>
  }) => Promise<RefundResult>
}) {
  const prismaClient = input.prismaClient as { commerceOrder: { findUnique(input: unknown): Promise<RefundOrder | null> } }
  const reasonCode = input.reasonCode.trim()
  const orderItemIds = [...new Set(input.orderItemIds.map((id) => id.trim()).filter(Boolean))].sort()
  if (!reasonCode || reasonCode.length > 64) throw new Error("A bounded refund reason is required.")
  if (orderItemIds.length === 0 || orderItemIds.length !== input.orderItemIds.length) {
    throw new Error("Select distinct refundable order items.")
  }
  const order = await prismaClient.commerceOrder.findUnique({
    where: { id: input.orderId },
    include: { payments: true, items: { include: { ownership: true, refundItems: { include: { refund: true } } } } },
  })
  if (!order || !["PAID", "PARTIALLY_REFUNDED"].includes(order.status)) throw new Error("A paid order is required.")
  const selected = orderItemIds.map((id) => order.items.find((item) => item.id === id))
  if (selected.some((item) => !item)) throw new Error("Select items from this order.")
  for (const item of selected as RefundOrderItem[]) {
    const duplicate = item.refundItems.some((entry) => ["PENDING", "SUCCEEDED"].includes(entry.refund?.status ?? ""))
    if (item.orderId !== order.id || item.currency !== order.currency || item.lineTotalCents <= 0 || duplicate || item.ownership?.source !== "PURCHASE" || item.ownership.status !== "ACTIVE") {
      throw new Error("Select currently refundable purchase items.")
    }
  }
  const amountCents = (selected as RefundOrderItem[]).reduce((sum, item) => sum + item.lineTotalCents, 0)
  const payment = order.payments.find((candidate) => ["SUCCEEDED", "PARTIALLY_REFUNDED"].includes(candidate.status))
  if (!payment || payment.currency !== order.currency || amountCents > payment.amountCents) throw new Error("Refund amount is invalid.")

  const initiate = input.initiateRefund ?? (async (value) => initiateBackgroundRefund(value as never))
  const result = await initiate({
    prismaClient: input.prismaClient,
    orderId: order.id,
    orderItemIds,
    actorId: input.adminUser.id,
    reasonCode,
    createProcessorRefund: (async (request: { paymentIntentId: string; amountCents: number; idempotencyKey: string; metadata: { orderId: string; refundId: string } }) => {
      const { getStripeClient } = await import("../stripe-billing.js")
      return getStripeClient().refunds.create({
        payment_intent: request.paymentIntentId,
        amount: request.amountCents,
        metadata: request.metadata,
      }, { idempotencyKey: request.idempotencyKey })
    }) as never,
  })
  return {
    refundId: result.refundId,
    orderId: order.id,
    amountCents,
    status: result.status,
    reconciliationRequired: Boolean(result.reconciliationRequired),
  }
}

export type CommerceAdminQueueItem = {
  orderId: string
  accountId: string
  accountLabel: string
  status: string
  totalAmount: number
  currency: "usd"
  createdAt: string
  pendingRefundCount: number
  openDisputeCount: number
  reconciliationIssueCount: number
}

const ADMIN_ORDER_INCLUDE = {
  user: { select: { id: true, name: true, email: true } },
  items: { include: { ownership: true } },
  payments: { include: { disputes: true } },
  refunds: { include: { items: { include: { orderItem: { include: { ownership: true } } } } } },
} as const

/** Loads one stable operator queue and emits only internal IDs plus a minimal account label. */
export async function listCommerceAdminOperations(input: { prismaClient: PrismaClient }): Promise<CommerceAdminQueueItem[]> {
  const queryShape = {
    orderBy: [{ createdAt: "desc" as const }, { id: "desc" as const }],
    take: 100,
    include: ADMIN_ORDER_INCLUDE,
  }
  const [obviousRows, reconciliationRows] = await Promise.all([
    input.prismaClient.commerceOrder.findMany({
      ...queryShape,
      where: {
        OR: [
          { status: "REVIEW_REQUIRED" },
          { refunds: { some: { status: "PENDING" } } },
          { payments: { some: { disputes: { some: { status: "OPEN" } } } } },
        ],
      },
    }),
    input.prismaClient.commerceOrder.findMany({
      ...queryShape,
      where: {
        OR: [
          { status: { not: "PARTIALLY_REFUNDED" }, payments: { some: { status: "PARTIALLY_REFUNDED" } } },
          { status: { not: "REFUNDED" }, payments: { some: { status: "REFUNDED" } } },
          { refunds: { some: { status: "PENDING", processedAt: { not: null } } } },
          { refunds: { some: { status: "SUCCEEDED", items: { some: { orderItem: { ownership: { is: { source: "PURCHASE", status: { not: "REFUND_REVOKED" } } } } } } } } },
          { refunds: { some: { status: "FAILED", items: { some: { orderItem: { ownership: { is: { source: "PURCHASE", status: "REFUND_PENDING" } } } } } } } },
          { refunds: { some: { status: "PENDING", items: { some: { orderItem: { ownership: { is: { source: "PURCHASE", status: "ACTIVE" } } } } } } } },
          { payments: { some: { disputes: { some: { OR: [
            { status: "OPEN", closedAt: { not: null } },
            { status: { not: "OPEN" }, closedAt: null },
          ] } } } } },
          { payments: { some: { disputes: { some: { status: "OPEN" } } } }, items: { some: { ownership: { is: { source: "PURCHASE", status: "ACTIVE" } } } } },
          { payments: { some: { disputes: { some: { status: "WON" } } } }, items: { some: { ownership: { is: { source: "PURCHASE", status: "DISPUTE_SUSPENDED" } } } } },
          { payments: { some: { disputes: { some: { status: "LOST" } } } }, items: { some: { ownership: { is: { source: "PURCHASE", status: { in: ["ACTIVE", "DISPUTE_SUSPENDED", "REFUND_PENDING"] } } } } } },
        ],
      },
    }),
  ])
  const rows = [...new Map(
    [...obviousRows, ...reconciliationRows].map((order) => [order.id, order]),
  ).values()].sort((left, right) => (
    right.createdAt.getTime() - left.createdAt.getTime() || right.id.localeCompare(left.id)
  ))
  const issues = collectCommerceAdminReconciliationIssues(rows)
  return rows.flatMap((order) => {
    const pendingRefundCount = order.refunds.filter((refund) => refund.status === "PENDING").length
    const openDisputeCount = order.payments.filter((payment) => (
      derivePaymentDisputeProjection(payment.disputes)?.status === "OPEN"
    )).length
    const reconciliationIssueCount = issues.filter((issue) => issue.orderId === order.id).length
    if (order.status !== "REVIEW_REQUIRED" && pendingRefundCount === 0 && openDisputeCount === 0 && reconciliationIssueCount === 0) return []
    return [{
      orderId: order.id,
      accountId: order.user.id,
      accountLabel: order.user.name?.trim() || order.user.email?.trim() || `Account ${order.user.id}`,
      status: order.status,
      totalAmount: order.totalCents,
      currency: "usd" as const,
      createdAt: order.createdAt.toISOString(),
      pendingRefundCount,
      openDisputeCount,
      reconciliationIssueCount,
    }]
  }).slice(0, 100)
}

type AdminDetailOrder = {
  id: string
  userId: string
  status: string
  currency: string
  subtotalCents: number
  taxCents: number
  totalCents: number
  createdAt: Date
  user: { id: string; name: string | null; email: string | null }
  items: Array<RefundOrderItem & {
    productKey: string
    displayName: string
    unitPriceCents: number
    allocatedTaxCents: number
    fulfillmentStatus: string
  }>
  payments: Array<RefundOrder["payments"][number] & { paidAt: Date | null; disputes: Array<{ id: string; status: string; amountCents: number; currency: string; reasonCode: string | null; openedAt: Date; closedAt: Date | null }> }>
  refunds: Array<{ id: string; paymentId: string; status: string; amountCents: number; currency: string; reasonCode: string | null; processedAt: Date | null; createdAt: Date; items: Array<{ orderItemId: string; orderItem: { ownership: { id: string; source: string; status: string } | null } }> }>
  events: Array<{ id: string; eventType: string; source: string; reasonCode: string | null; aggregateType: string; aggregateId: string; fromState: string | null; toState: string | null; createdAt: Date }>
}

/** Projects one order's immutable item, amount, status, and audit history without processor data. */
export async function getCommerceAdminOrderDetail(input: {
  prismaClient: object
  orderId: string
}) {
  const prismaClient = input.prismaClient as { commerceOrder: { findUnique(input: unknown): Promise<AdminDetailOrder | null> } }
  const order = await prismaClient.commerceOrder.findUnique({
    where: { id: input.orderId },
    include: {
      user: { select: { id: true, name: true, email: true } },
      items: { include: { ownership: true, refundItems: { include: { refund: true } } } },
      payments: { include: { disputes: true } },
      refunds: { include: { items: { include: { orderItem: { include: { ownership: true } } } } } },
      events: { orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
    },
  })
  if (!order) return null
  const reconciliationIssues = collectCommerceAdminReconciliationIssues([order as unknown as ReconciliationOrder])

  return {
    id: order.id,
    account: {
      id: order.user.id,
      label: order.user.name?.trim() || order.user.email?.trim() || `Account ${order.user.id}`,
    },
    status: order.status,
    currency: "usd" as const,
    amounts: {
      subtotalAmount: order.subtotalCents,
      taxAmount: order.taxCents,
      totalAmount: order.totalCents,
    },
    createdAt: order.createdAt.toISOString(),
    items: order.items.map((item) => ({
      id: item.id,
      backgroundId: item.productKey,
      label: item.displayName,
      unitAmount: item.unitPriceCents,
      taxAmount: item.allocatedTaxCents,
      totalAmount: item.lineTotalCents,
      currency: "usd" as const,
      fulfillmentStatus: item.fulfillmentStatus,
      ownershipStatus: item.ownership?.status ?? null,
      refundable: ["PAID", "PARTIALLY_REFUNDED"].includes(order.status)
        && item.ownership?.source === "PURCHASE"
        && item.ownership.status === "ACTIVE"
        && !item.refundItems.some((entry) => ["PENDING", "SUCCEEDED"].includes(entry.refund?.status ?? "")),
    })),
    payments: order.payments.map((payment) => ({
      id: payment.id,
      status: payment.status,
      amount: payment.amountCents,
      currency: "usd" as const,
      paidAt: payment.paidAt?.toISOString() ?? null,
    })),
    refunds: order.refunds.map((refund) => ({
      id: refund.id,
      status: refund.status,
      amount: refund.amountCents,
      currency: "usd" as const,
      reasonCode: refund.reasonCode,
      processedAt: refund.processedAt?.toISOString() ?? null,
      createdAt: refund.createdAt.toISOString(),
      itemIds: refund.items.map((item) => item.orderItemId),
    })),
    disputes: order.payments.flatMap((payment) => payment.disputes.map((dispute) => ({
      id: dispute.id,
      paymentId: payment.id,
      status: dispute.status,
      amount: dispute.amountCents,
      currency: "usd" as const,
      reasonCode: dispute.reasonCode,
      openedAt: dispute.openedAt.toISOString(),
      closedAt: dispute.closedAt?.toISOString() ?? null,
    }))),
    history: order.events.map((event) => ({
      id: event.id,
      type: event.eventType,
      source: event.source,
      reasonCode: event.reasonCode,
      aggregateType: event.aggregateType,
      aggregateId: event.aggregateId,
      fromStatus: event.fromState,
      toStatus: event.toState,
      createdAt: event.createdAt.toISOString(),
    })),
    reconciliationIssues,
  }
}

/** Applies only an explicitly identified deterministic projection repair. */
export async function reconcileCommerceAdminIssue(input: {
  prismaClient: PrismaClient
  issue: CommerceAdminReconciliationRequest
  repairIssue?: typeof repairCommerceReversalIssue
}) {
  if (!isCommerceAdminIssueRepairable(input.issue.code)) {
    return { changed: false, status: "MANUAL_REVIEW_REQUIRED" }
  }
  const repair = input.repairIssue ?? repairCommerceReversalIssue
  return repair({ prismaClient: input.prismaClient, issue: input.issue as never })
}
