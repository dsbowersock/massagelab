import { createHash } from "node:crypto"
import type { Prisma, PrismaClient } from "@prisma/client"
import type Stripe from "stripe"
import {
  BACKGROUND_PURCHASE_PURPOSE,
  BACKGROUND_PURCHASE_SCHEMA_VERSION,
} from "../stripe-billing.js"
import {
  COMMERCE_PRODUCT_BACKGROUND,
} from "./constants.js"
import { runCommerceTransaction } from "./transactions.ts"

const STRIPE_PROVIDER = "stripe"
const FULFILLMENT_ADAPTER_VERSION = "background-v1"
const PROTECTED_ORDER_STATUSES = new Set([
  "PAID",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
  "REVIEW_REQUIRED",
])
const BACKGROUND_SESSION_EVENTS = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
])

type FulfillmentInput = {
  prismaClient: PrismaClient
  eventId: string
  eventType?: string
  eventCreatedAt?: Date | number
  session: Stripe.Checkout.Session
}

export type BackgroundFulfillmentResult = {
  orderId: string
  userId: string
  status: string
  changed: boolean
}

type StoredOrderItem = {
  id: string
  orderId: string
  userId: string
  productType: string
  productKey: string
  displayName: string
  unitPriceCents: number
  quantity: number
  allocatedTaxCents: number
  lineTotalCents: number
  currency: string
  fulfillmentAdapterVersion: string
  fulfillmentStatus: string
}

type StoredOrder = {
  id: string
  userId: string
  status: string
  fulfillmentStatus: string
  currency: string
  subtotalCents: number
  taxCents: number
  totalCents: number
  stripeCheckoutSessionId: string | null
  purchaseCountry: string | null
  items: StoredOrderItem[]
}

type SessionEvidence = {
  sessionId: string
  purpose: string
  schemaVersion: string
  orderId: string
  userId: string
  customerId: string
  country: string
  currency: string
  amountSubtotal: number | null
  amountTotal: number | null
  amountTax: number | null
  paymentIntentId: string
  paymentIntentStatus: string
  paymentIntentAmount: number | null
  paymentIntentCurrency: string
  paymentIntentCustomerId: string
  paymentIntentMetadata: Record<string, string>
  paymentStatus: string
  sessionStatus: string
  items: Array<{
    productType: string
    productKey: string
    displayName: string
    quantity: number | null
    currency: string
    unitAmount: number | null
    amountSubtotal: number | null
    amountTax: number | null
    amountTotal: number | null
  }>
}

class OwnershipGrantError extends Error {
  constructor() {
    super("Background ownership grant requires operator review.")
    this.name = "OwnershipGrantError"
  }
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value : ""
}

function stripeId(value: unknown): string {
  if (typeof value === "string") return value
  if (value && typeof value === "object" && "id" in value) {
    return stringValue((value as { id?: unknown }).id)
  }
  return ""
}

function integerValue(value: unknown): number | null {
  return Number.isInteger(value) ? value as number : null
}

function metadataRecord(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return Object.fromEntries(
    Object.entries(value)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  )
}

function processorEventCreatedAt(value: Date | number | undefined): string | null {
  const date = value instanceof Date
    ? value
    : typeof value === "number"
      ? new Date(value > 10_000_000_000 ? value : value * 1000)
      : null
  return date && Number.isFinite(date.getTime()) ? date.toISOString() : null
}

function payloadHash(eventId: string, eventType: string, session: Stripe.Checkout.Session): string {
  const metadata = metadataRecord(session.metadata)
  return createHash("sha256").update(JSON.stringify({
    eventId,
    eventType,
    sessionId: stringValue(session.id),
    orderId: metadata.orderId ?? "",
    userId: metadata.userId ?? "",
    status: stringValue(session.status),
    paymentStatus: stringValue(session.payment_status),
    paymentIntentId: stripeId(session.payment_intent),
    amountTotal: integerValue(session.amount_total),
    currency: stringValue(session.currency),
  })).digest("hex")
}

function sessionEvidence(session: Stripe.Checkout.Session): SessionEvidence {
  const metadata = metadataRecord(session.metadata)
  const paymentIntent = session.payment_intent && typeof session.payment_intent === "object"
    ? session.payment_intent as Stripe.PaymentIntent
    : null
  const lineItems = session.line_items?.data ?? []

  return {
    sessionId: stringValue(session.id),
    purpose: metadata.purpose ?? "",
    schemaVersion: metadata.schemaVersion ?? "",
    orderId: metadata.orderId ?? "",
    userId: metadata.userId ?? "",
    customerId: stripeId(session.customer),
    country: stringValue(session.customer_details?.address?.country).toUpperCase(),
    currency: stringValue(session.currency).toLowerCase(),
    amountSubtotal: integerValue(session.amount_subtotal),
    amountTotal: integerValue(session.amount_total),
    amountTax: integerValue(session.total_details?.amount_tax),
    paymentIntentId: stripeId(session.payment_intent),
    paymentIntentStatus: stringValue(paymentIntent?.status),
    paymentIntentAmount: integerValue(paymentIntent?.amount),
    paymentIntentCurrency: stringValue(paymentIntent?.currency).toLowerCase(),
    paymentIntentCustomerId: stripeId(paymentIntent?.customer),
    paymentIntentMetadata: metadataRecord(paymentIntent?.metadata),
    paymentStatus: stringValue(session.payment_status),
    sessionStatus: stringValue(session.status),
    items: lineItems.map((line) => {
      const price = line.price && typeof line.price === "object" ? line.price : null
      const product = price?.product && typeof price.product === "object" && !("deleted" in price.product)
        ? price.product
        : null
      const productMetadata = metadataRecord(product?.metadata)
      return {
        productType: productMetadata.productType ?? "",
        productKey: productMetadata.productKey ?? "",
        displayName: stringValue(product?.name) || stringValue(line.description),
        quantity: integerValue(line.quantity),
        currency: stringValue(line.currency ?? price?.currency).toLowerCase(),
        unitAmount: integerValue(price?.unit_amount),
        amountSubtotal: integerValue(line.amount_subtotal),
        amountTax: integerValue(line.amount_tax),
        amountTotal: integerValue(line.amount_total),
      }
    }),
  }
}

function resultFromOrder(order: StoredOrder, changed: boolean): BackgroundFulfillmentResult {
  const status = order.fulfillmentStatus === "FULFILLED"
    ? "FULFILLED"
    : order.status
  return { orderId: order.id, userId: order.userId, status, changed }
}

function ignoredResult(evidence: SessionEvidence): BackgroundFulfillmentResult {
  return {
    orderId: evidence.orderId,
    userId: evidence.userId,
    status: "IGNORED",
    changed: false,
  }
}

function itemMismatchIds(order: StoredOrder, evidence: SessionEvidence): string[] {
  if (evidence.items.length !== order.items.length) {
    return order.items.map((item) => item.id)
  }

  const evidenceByKey = new Map(evidence.items.map((item) => [item.productKey, item]))
  const mismatches: string[] = []
  for (const item of order.items) {
    const line = evidenceByKey.get(item.productKey)
    if (
      !line
      || line.productType !== item.productType
      || line.displayName !== item.displayName
      || line.quantity !== item.quantity
      || line.currency !== item.currency
      || line.unitAmount !== item.unitPriceCents
      || line.amountSubtotal !== item.unitPriceCents * item.quantity
      || line.amountTax !== item.allocatedTaxCents
      || line.amountTotal !== item.lineTotalCents
    ) {
      mismatches.push(item.id)
    }
  }
  return mismatches
}

function evidenceFailure(
  order: StoredOrder,
  evidence: SessionEvidence,
  stripeCustomerId: string,
  requirePaidEvidence: boolean,
): { code: string; itemIds: string[] } | null {
  if (
    evidence.schemaVersion !== BACKGROUND_PURCHASE_SCHEMA_VERSION
    || evidence.userId !== order.userId
    || !evidence.sessionId
    || (order.stripeCheckoutSessionId !== null
      && order.stripeCheckoutSessionId !== evidence.sessionId)
    || evidence.customerId !== stripeCustomerId
    || (requirePaidEvidence && evidence.country !== "US")
    || evidence.currency !== order.currency
    || evidence.amountSubtotal !== order.subtotalCents
    || evidence.amountTax !== order.taxCents
    || evidence.amountTotal !== order.totalCents
  ) {
    return { code: "CHECKOUT_SESSION_MISMATCH", itemIds: [] }
  }

  const mismatchedItems = itemMismatchIds(order, evidence)
  if (mismatchedItems.length > 0) {
    return { code: "CHECKOUT_ITEM_MISMATCH", itemIds: mismatchedItems }
  }

  const unsupportedItems = order.items
    .filter((item) => (
      item.productType !== COMMERCE_PRODUCT_BACKGROUND
      || item.fulfillmentAdapterVersion !== FULFILLMENT_ADAPTER_VERSION
    ))
    .map((item) => item.id)
  if (unsupportedItems.length > 0) {
    return { code: "FULFILLMENT_ADAPTER_UNAVAILABLE", itemIds: unsupportedItems }
  }

  if (!requirePaidEvidence) return null

  const paymentMetadata = evidence.paymentIntentMetadata
  if (
    evidence.paymentStatus !== "paid"
    || !evidence.paymentIntentId
    || evidence.paymentIntentStatus !== "succeeded"
    || evidence.paymentIntentAmount !== order.totalCents
    || evidence.paymentIntentCurrency !== order.currency
    || evidence.paymentIntentCustomerId !== stripeCustomerId
    || paymentMetadata.purpose !== BACKGROUND_PURCHASE_PURPOSE
    || paymentMetadata.orderId !== order.id
    || paymentMetadata.userId !== order.userId
    || paymentMetadata.schemaVersion !== BACKGROUND_PURCHASE_SCHEMA_VERSION
  ) {
    return { code: "PAYMENT_EVIDENCE_MISMATCH", itemIds: [] }
  }

  return null
}

async function recordCommerceEvent(
  tx: Prisma.TransactionClient,
  input: {
    order: StoredOrder
    eventType: string
    fromState: string | null
    toState: string
    reasonCode?: string
    processorEventCreatedAt: string | null
  },
): Promise<void> {
  await tx.commerceEvent.create({
    data: {
      userId: input.order.userId,
      orderId: input.order.id,
      eventType: input.eventType,
      source: "stripe-webhook",
      reasonCode: input.reasonCode ?? null,
      aggregateType: "CommerceOrder",
      aggregateId: input.order.id,
      fromState: input.fromState,
      toState: input.toState,
      payload: {
        ...(input.processorEventCreatedAt
          ? { processorEventCreatedAt: input.processorEventCreatedAt }
          : {}),
      },
    },
  })
}

async function markReceiptProcessed(
  tx: Prisma.TransactionClient,
  receiptId: string,
  failureCode: string | null,
  now: Date,
): Promise<void> {
  await tx.commerceWebhookReceipt.update({
    where: { id: receiptId },
    data: { processedAt: now, failureCode },
  })
}

async function markReviewRequired(
  tx: Prisma.TransactionClient,
  input: {
    order: StoredOrder
    receiptId: string
    failureCode: string
    failedItemIds: string[]
    processorEventCreatedAt: string | null
    now: Date
  },
): Promise<BackgroundFulfillmentResult> {
  if (PROTECTED_ORDER_STATUSES.has(input.order.status)) {
    await markReceiptProcessed(tx, input.receiptId, input.failureCode, input.now)
    return resultFromOrder(input.order, false)
  }

  const transition = await tx.commerceOrder.updateMany({
    where: {
      id: input.order.id,
      userId: input.order.userId,
      status: input.order.status as never,
      fulfillmentStatus: input.order.fulfillmentStatus as never,
      stripeCheckoutSessionId: input.order.stripeCheckoutSessionId,
    },
    data: {
      status: "REVIEW_REQUIRED",
      fulfillmentStatus: "FAILED",
      reservationExpiresAt: null,
      failureCode: input.failureCode,
    },
  })
  if (transition.count !== 1) {
    await markReceiptProcessed(tx, input.receiptId, "STALE_WEBHOOK_TRANSITION", input.now)
    const current = await tx.commerceOrder.findUnique({
      where: { id: input.order.id },
      include: { items: true },
    }) as StoredOrder | null
    return current ? resultFromOrder(current, false) : resultFromOrder(input.order, false)
  }

  if (input.failedItemIds.length > 0) {
    await tx.commerceOrderItem.updateMany({
      where: {
        orderId: input.order.id,
        id: { in: input.failedItemIds },
        fulfillmentStatus: "PENDING",
      },
      data: { fulfillmentStatus: "FAILED" },
    })
  }
  await recordCommerceEvent(tx, {
    order: input.order,
    eventType: "BACKGROUND_PURCHASE_REVIEW_REQUIRED",
    fromState: input.order.status,
    toState: "REVIEW_REQUIRED",
    reasonCode: input.failureCode,
    processorEventCreatedAt: input.processorEventCreatedAt,
  })
  await markReceiptProcessed(tx, input.receiptId, input.failureCode, input.now)
  return {
    orderId: input.order.id,
    userId: input.order.userId,
    status: "REVIEW_REQUIRED",
    changed: true,
  }
}

async function upsertPayment(
  tx: Prisma.TransactionClient,
  input: {
    order: StoredOrder
    evidence: SessionEvidence
    status: "PENDING" | "SUCCEEDED" | "FAILED" | "CANCELED"
    now: Date
    failureCode?: string | null
  },
): Promise<void> {
  if (!input.evidence.paymentIntentId) return
  await tx.commercePayment.upsert({
    where: { stripePaymentIntentId: input.evidence.paymentIntentId },
    create: {
      orderId: input.order.id,
      stripePaymentIntentId: input.evidence.paymentIntentId,
      status: input.status,
      amountCents: input.order.totalCents,
      currency: input.order.currency,
      paidAt: input.status === "SUCCEEDED" ? input.now : null,
      failureCode: input.failureCode ?? null,
    },
    update: {
      status: input.status,
      amountCents: input.order.totalCents,
      currency: input.order.currency,
      paidAt: input.status === "SUCCEEDED" ? input.now : null,
      failureCode: input.failureCode ?? null,
    },
  })
}

async function processUnpaidEvent(
  tx: Prisma.TransactionClient,
  input: {
    order: StoredOrder
    receiptId: string
    evidence: SessionEvidence
    eventType: string
    processorEventCreatedAt: string | null
    now: Date
  },
): Promise<BackgroundFulfillmentResult> {
  if (PROTECTED_ORDER_STATUSES.has(input.order.status)) {
    await markReceiptProcessed(tx, input.receiptId, null, input.now)
    return resultFromOrder(input.order, false)
  }

  const completedPending = input.eventType === "checkout.session.completed"
  const targetStatus = completedPending
    ? "AWAITING_PAYMENT"
    : input.eventType === "checkout.session.expired"
      ? "EXPIRED"
      : "PAYMENT_FAILED"
  const paymentStatus = completedPending
    ? "PENDING"
    : input.eventType === "checkout.session.expired"
      ? "CANCELED"
      : "FAILED"
  const failureCode = completedPending
    ? null
    : input.eventType === "checkout.session.expired"
      ? "CHECKOUT_SESSION_EXPIRED"
      : "ASYNC_PAYMENT_FAILED"
  const allowedSourceStatuses = completedPending
    ? new Set(["PREPARING", "AWAITING_PAYMENT"])
    : input.eventType === "checkout.session.expired"
      ? new Set(["PREPARING", "AWAITING_PAYMENT"])
      : new Set(["PREPARING", "AWAITING_PAYMENT", "EXPIRED"])

  if (input.order.status === targetStatus) {
    await markReceiptProcessed(tx, input.receiptId, null, input.now)
    return resultFromOrder(input.order, false)
  }
  if (!allowedSourceStatuses.has(input.order.status)) {
    await markReceiptProcessed(tx, input.receiptId, null, input.now)
    return resultFromOrder(input.order, false)
  }

  const transition = await tx.commerceOrder.updateMany({
    where: {
      id: input.order.id,
      userId: input.order.userId,
      status: input.order.status as never,
      fulfillmentStatus: input.order.fulfillmentStatus as never,
      stripeCheckoutSessionId: input.order.stripeCheckoutSessionId,
    },
    data: {
      status: targetStatus,
      stripeCheckoutSessionId: input.evidence.sessionId,
      reservationExpiresAt: completedPending ? undefined : null,
      failureCode,
    },
  })
  if (transition.count !== 1) {
    await markReceiptProcessed(tx, input.receiptId, "STALE_WEBHOOK_TRANSITION", input.now)
    return resultFromOrder(input.order, false)
  }
  await upsertPayment(tx, {
    order: input.order,
    evidence: input.evidence,
    status: paymentStatus,
    now: input.now,
    failureCode,
  })

  await recordCommerceEvent(tx, {
    order: input.order,
    eventType: completedPending ? "BACKGROUND_PAYMENT_PENDING" : "BACKGROUND_PAYMENT_TERMINATED",
    fromState: input.order.status,
    toState: targetStatus,
    reasonCode: failureCode ?? undefined,
    processorEventCreatedAt: input.processorEventCreatedAt,
  })
  await markReceiptProcessed(tx, input.receiptId, null, input.now)
  return {
    orderId: input.order.id,
    userId: input.order.userId,
    status: targetStatus,
    changed: true,
  }
}

async function fulfillPaidOrder(
  tx: Prisma.TransactionClient,
  input: {
    order: StoredOrder
    receiptId: string
    evidence: SessionEvidence
    processorEventCreatedAt: string | null
    now: Date
    forcedGrantFailure: boolean
  },
): Promise<BackgroundFulfillmentResult> {
  if (
    input.order.status === "PAID"
    && input.order.fulfillmentStatus === "FULFILLED"
  ) {
    await markReceiptProcessed(tx, input.receiptId, null, input.now)
    return resultFromOrder(input.order, false)
  }
  if (
    input.order.status === "PARTIALLY_REFUNDED"
    || input.order.status === "REFUNDED"
    || input.order.status === "REVIEW_REQUIRED"
  ) {
    await markReceiptProcessed(tx, input.receiptId, null, input.now)
    return resultFromOrder(input.order, false)
  }

  await upsertPayment(tx, {
    order: input.order,
    evidence: input.evidence,
    status: "SUCCEEDED",
    now: input.now,
  })

  if (input.forcedGrantFailure) {
    return markReviewRequired(tx, {
      order: input.order,
      receiptId: input.receiptId,
      failureCode: "OWNERSHIP_GRANT_FAILED",
      failedItemIds: input.order.items.map((item) => item.id),
      processorEventCreatedAt: input.processorEventCreatedAt,
      now: input.now,
    })
  }

  const ownerships = await tx.backgroundOwnership.findMany({
    where: {
      userId: input.order.userId,
      backgroundKey: { in: input.order.items.map((item) => item.productKey) },
    },
  })
  if (ownerships.length > 0) {
    const conflictKeys = new Set(ownerships.map((ownership) => ownership.backgroundKey))
    return markReviewRequired(tx, {
      order: input.order,
      receiptId: input.receiptId,
      failureCode: "BACKGROUND_ALREADY_OWNED",
      failedItemIds: input.order.items
        .filter((item) => conflictKeys.has(item.productKey))
        .map((item) => item.id),
      processorEventCreatedAt: input.processorEventCreatedAt,
      now: input.now,
    })
  }

  try {
    const created = await tx.backgroundOwnership.createMany({
      data: input.order.items.map((item) => ({
        userId: input.order.userId,
        backgroundKey: item.productKey,
        source: "PURCHASE",
        sourceProductType: item.productType,
        status: "ACTIVE",
        sourceOrderItemId: item.id,
        acquiredAt: input.now,
        statusChangedAt: input.now,
      })),
    })
    if (created.count !== input.order.items.length) throw new OwnershipGrantError()
  } catch {
    // Throwing aborts the whole transaction, including any partial fake/driver
    // result. The caller retries once through the explicit review path.
    throw new OwnershipGrantError()
  }

  const fulfilledItems = await tx.commerceOrderItem.updateMany({
    where: {
      orderId: input.order.id,
      id: { in: input.order.items.map((item) => item.id) },
      fulfillmentStatus: "PENDING",
    },
    data: {
      fulfillmentStatus: "FULFILLED",
      fulfilledAt: input.now,
    },
  })
  if (fulfilledItems.count !== input.order.items.length) {
    throw new OwnershipGrantError()
  }

  const transition = await tx.commerceOrder.updateMany({
    where: {
      id: input.order.id,
      userId: input.order.userId,
      status: input.order.status as never,
      fulfillmentStatus: input.order.fulfillmentStatus as never,
      stripeCheckoutSessionId: input.order.stripeCheckoutSessionId,
    },
    data: {
      status: "PAID",
      fulfillmentStatus: "FULFILLED",
      stripeCheckoutSessionId: input.evidence.sessionId,
      reservationExpiresAt: null,
      purchaseCountry: input.evidence.country,
      failureCode: null,
      fulfillmentStartedAt: input.now,
      fulfilledAt: input.now,
    },
  })
  if (transition.count !== 1) throw new OwnershipGrantError()

  const cart = await tx.commerceCart.findUnique({
    where: { userId: input.order.userId },
    select: { id: true },
  })
  if (cart) {
    await tx.commerceCartItem.deleteMany({
      where: {
        cartId: cart.id,
        OR: input.order.items.map((item) => ({
          productType: item.productType,
          productKey: item.productKey,
        })),
      },
    })
  }
  await recordCommerceEvent(tx, {
    order: input.order,
    eventType: "BACKGROUND_PURCHASE_FULFILLED",
    fromState: input.order.status,
    toState: "PAID",
    processorEventCreatedAt: input.processorEventCreatedAt,
  })
  await markReceiptProcessed(tx, input.receiptId, null, input.now)
  return {
    orderId: input.order.id,
    userId: input.order.userId,
    status: "FULFILLED",
    changed: true,
  }
}

function isReceiptUniqueConflict(error: unknown): boolean {
  if (!error || typeof error !== "object" || (error as { code?: unknown }).code !== "P2002") {
    return false
  }
  const meta = (error as { meta?: unknown }).meta
  const serialized = JSON.stringify(meta ?? {})
  return serialized.includes("CommerceWebhookReceipt")
    || (serialized.includes("provider") && serialized.includes("providerEventId"))
}

/**
 * Applies one signed Stripe Checkout event in a short serializable transaction.
 *
 * The caller must retrieve expanded Session evidence before invoking this
 * service. No processor or network call is permitted inside this transaction.
 */
export async function fulfillBackgroundPurchase(
  input: FulfillmentInput,
): Promise<BackgroundFulfillmentResult> {
  const eventId = stringValue(input.eventId)
  const eventType = stringValue(input.eventType) || "checkout.session.completed"
  const evidence = sessionEvidence(input.session)
  const eventTimestamp = processorEventCreatedAt(input.eventCreatedAt)
  const hash = payloadHash(eventId, eventType, input.session)

  const operation = async (
    tx: Prisma.TransactionClient,
    forcedGrantFailure: boolean,
  ): Promise<BackgroundFulfillmentResult> => {
    const now = new Date()
    const existingReceipt = await tx.commerceWebhookReceipt.findUnique({
      where: {
        provider_providerEventId: {
          provider: STRIPE_PROVIDER,
          providerEventId: eventId,
        },
      },
    })
    if (existingReceipt) {
      if (!existingReceipt.orderId) return ignoredResult(evidence)
      const committedOrder = await tx.commerceOrder.findUnique({
        where: { id: existingReceipt.orderId },
        include: { items: true },
      }) as StoredOrder | null
      return committedOrder ? resultFromOrder(committedOrder, false) : ignoredResult(evidence)
    }

    if (
      !eventId
      || !BACKGROUND_SESSION_EVENTS.has(eventType)
      || evidence.purpose !== BACKGROUND_PURCHASE_PURPOSE
      || !evidence.orderId
    ) {
      const receipt = await tx.commerceWebhookReceipt.create({
        data: {
          provider: STRIPE_PROVIDER,
          providerEventId: eventId || "missing-event-id",
          eventType,
          payloadHash: hash,
          processedAt: now,
          failureCode: "IGNORED_CHECKOUT_PURPOSE",
        },
      })
      void receipt
      return ignoredResult(evidence)
    }

    const order = await tx.commerceOrder.findUnique({
      where: { id: evidence.orderId },
      include: {
        items: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        },
      },
    }) as StoredOrder | null
    if (!order) {
      await tx.commerceWebhookReceipt.create({
        data: {
          provider: STRIPE_PROVIDER,
          providerEventId: eventId,
          eventType,
          payloadHash: hash,
          processedAt: now,
          failureCode: "ORDER_NOT_FOUND",
        },
      })
      return ignoredResult(evidence)
    }

    const receipt = await tx.commerceWebhookReceipt.create({
      data: {
        userId: order.userId,
        orderId: order.id,
        provider: STRIPE_PROVIDER,
        providerEventId: eventId,
        eventType,
        payloadHash: hash,
      },
    })
    const storedCustomer = await tx.stripeCustomer.findUnique({
      where: { userId: order.userId },
    })
    const paidEvent = (
      eventType === "checkout.session.async_payment_succeeded"
      || (eventType === "checkout.session.completed" && evidence.paymentStatus === "paid")
    )
    const validationFailure = !storedCustomer
      ? { code: "STRIPE_CUSTOMER_NOT_FOUND", itemIds: [] }
      : evidenceFailure(order, evidence, storedCustomer.stripeCustomerId, paidEvent)
    if (validationFailure) {
      return markReviewRequired(tx, {
        order,
        receiptId: receipt.id,
        failureCode: validationFailure.code,
        failedItemIds: validationFailure.itemIds,
        processorEventCreatedAt: eventTimestamp,
        now,
      })
    }

    if (paidEvent) {
      return fulfillPaidOrder(tx, {
        order,
        receiptId: receipt.id,
        evidence,
        processorEventCreatedAt: eventTimestamp,
        now,
        forcedGrantFailure,
      })
    }

    if (eventType === "checkout.session.async_payment_succeeded") {
      return markReviewRequired(tx, {
        order,
        receiptId: receipt.id,
        failureCode: "PAYMENT_EVIDENCE_MISMATCH",
        failedItemIds: [],
        processorEventCreatedAt: eventTimestamp,
        now,
      })
    }

    return processUnpaidEvent(tx, {
      order,
      receiptId: receipt.id,
      evidence,
      eventType,
      processorEventCreatedAt: eventTimestamp,
      now,
    })
  }

  try {
    return await runCommerceTransaction(
      input.prismaClient,
      (tx) => operation(tx as Prisma.TransactionClient, false),
    )
  } catch (error) {
    if (error instanceof OwnershipGrantError) {
      return runCommerceTransaction(
        input.prismaClient,
        (tx) => operation(tx as Prisma.TransactionClient, true),
      )
    }
    if (isReceiptUniqueConflict(error)) {
      return runCommerceTransaction(
        input.prismaClient,
        (tx) => operation(tx as Prisma.TransactionClient, false),
      )
    }
    throw error
  }
}
