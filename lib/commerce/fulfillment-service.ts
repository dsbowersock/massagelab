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
const TAX_RECONCILABLE_ORDER_STATUSES = new Set([
  "PREPARING",
  "AWAITING_PAYMENT",
  "PAYMENT_FAILED",
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
  taxMode: string
  taxCode: string
  taxBehavior: string
  automaticTaxEnabled: boolean
  automaticTaxStatus: string
  orderId: string
  userId: string
  customerId: string
  country: string
  currency: string
  amountSubtotal: number | null
  amountTotal: number | null
  amountTax: number | null
  amountDiscount: number | null
  amountShipping: number | null
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
    amountDiscount: number | null
    amountTax: number | null
    amountTotal: number | null
    productTaxCode: string
    taxBehavior: string
  }>
}

class OwnershipGrantError extends Error {
  constructor() {
    super("Background ownership grant requires operator review.")
    this.name = "OwnershipGrantError"
  }
}

class TaxSnapshotConflictError extends Error {
  constructor() {
    super("The background order tax snapshot changed during fulfillment.")
    this.name = "TaxSnapshotConflictError"
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
    automaticTaxEnabled: session.automatic_tax?.enabled === true,
    automaticTaxStatus: stringValue(session.automatic_tax?.status),
    amountSubtotal: integerValue(session.amount_subtotal),
    amountTax: integerValue(session.total_details?.amount_tax),
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
    taxMode: metadata.taxMode ?? "",
    taxCode: metadata.taxCode ?? "",
    taxBehavior: metadata.taxBehavior ?? "",
    automaticTaxEnabled: session.automatic_tax?.enabled === true,
    automaticTaxStatus: stringValue(session.automatic_tax?.status),
    orderId: metadata.orderId ?? "",
    userId: metadata.userId ?? "",
    customerId: stripeId(session.customer),
    country: stringValue(session.customer_details?.address?.country).toUpperCase(),
    currency: stringValue(session.currency).toLowerCase(),
    amountSubtotal: integerValue(session.amount_subtotal),
    amountTotal: integerValue(session.amount_total),
    amountTax: integerValue(session.total_details?.amount_tax),
    amountDiscount: integerValue(session.total_details?.amount_discount),
    amountShipping: integerValue(session.total_details?.amount_shipping),
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
        amountDiscount: integerValue(line.amount_discount),
        amountTax: integerValue(line.amount_tax),
        amountTotal: integerValue(line.amount_total),
        productTaxCode: stripeId(product?.tax_code) || productMetadata.taxCode || "",
        taxBehavior: stringValue(price?.tax_behavior),
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

function itemMismatchIds(
  order: StoredOrder,
  evidence: SessionEvidence,
  includeTaxAmounts: boolean,
): string[] {
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
      || (includeTaxAmounts && (
        line.amountTax !== item.allocatedTaxCents
        || line.amountTotal !== item.lineTotalCents
      ))
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
    || (requirePaidEvidence && (
      evidence.amountTax !== order.taxCents
      || evidence.amountTotal !== order.totalCents
    ))
  ) {
    return { code: "CHECKOUT_SESSION_MISMATCH", itemIds: [] }
  }

  const mismatchedItems = itemMismatchIds(order, evidence, requirePaidEvidence)
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
    || paymentMetadata.taxMode !== evidence.taxMode
    || paymentMetadata.taxCode !== evidence.taxCode
    || paymentMetadata.taxBehavior !== evidence.taxBehavior
  ) {
    return { code: "PAYMENT_EVIDENCE_MISMATCH", itemIds: [] }
  }

  return null
}

type TaxSnapshotResult = {
  order: StoredOrder
  failure: { code: string; itemIds: string[] } | null
}

/**
 * Validates and freezes Stripe Tax totals before the paid-order evidence check.
 *
 * Initial order amounts remain pre-tax while Checkout is open. Only a signed,
 * retrieved, fully paid automatic-tax Session may replace that baseline, and
 * every order/line amount is changed in the same serializable transaction.
 */
async function reconcilePaidTaxSnapshot(
  tx: Prisma.TransactionClient,
  input: {
    order: StoredOrder
    evidence: SessionEvidence
    stripeCustomerId: string
    processorEventCreatedAt: string | null
  },
): Promise<TaxSnapshotResult> {
  const staticFailure = evidenceFailure(
    input.order,
    input.evidence,
    input.stripeCustomerId,
    false,
  )
  if (staticFailure) return { order: input.order, failure: staticFailure }

  const evidence = input.evidence
  if (
    evidence.country !== "US"
    || evidence.taxMode !== "stripe"
    || !evidence.taxCode.startsWith("txcd_")
    || evidence.taxBehavior !== "exclusive"
    || !evidence.automaticTaxEnabled
    || evidence.automaticTaxStatus !== "complete"
    || evidence.amountSubtotal === null
    || evidence.amountTax === null
    || evidence.amountTotal === null
    || evidence.amountDiscount !== 0
    || evidence.amountShipping !== 0
    || evidence.amountSubtotal < 0
    || evidence.amountTax < 0
    || evidence.amountTotal !== evidence.amountSubtotal + evidence.amountTax
  ) {
    return {
      order: input.order,
      failure: { code: "CHECKOUT_TAX_MISMATCH", itemIds: [] },
    }
  }

  const evidenceByKey = new Map(evidence.items.map((item) => [item.productKey, item]))
  if (evidenceByKey.size !== input.order.items.length) {
    return {
      order: input.order,
      failure: {
        code: "CHECKOUT_TAX_MISMATCH",
        itemIds: input.order.items.map((item) => item.id),
      },
    }
  }

  let lineSubtotal = 0
  let lineTax = 0
  let lineTotal = 0
  const reconciledItems: StoredOrderItem[] = []
  const invalidItemIds: string[] = []
  for (const item of input.order.items) {
    const line = evidenceByKey.get(item.productKey)
    if (
      !line
      || line.amountSubtotal === null
      || line.amountTax === null
      || line.amountTotal === null
      || line.amountDiscount !== 0
      || line.amountTax < 0
      || line.amountTotal !== line.amountSubtotal + line.amountTax
      || line.productTaxCode !== evidence.taxCode
      || line.taxBehavior !== "exclusive"
    ) {
      invalidItemIds.push(item.id)
      continue
    }
    lineSubtotal += line.amountSubtotal
    lineTax += line.amountTax
    lineTotal += line.amountTotal
    reconciledItems.push({
      ...item,
      allocatedTaxCents: line.amountTax,
      lineTotalCents: line.amountTotal,
    })
  }
  if (
    invalidItemIds.length > 0
    || reconciledItems.length !== input.order.items.length
    || lineSubtotal !== evidence.amountSubtotal
    || lineTax !== evidence.amountTax
    || lineTotal !== evidence.amountTotal
  ) {
    return {
      order: input.order,
      failure: {
        code: "CHECKOUT_TAX_MISMATCH",
        itemIds: invalidItemIds.length > 0
          ? invalidItemIds
          : input.order.items.map((item) => item.id),
      },
    }
  }

  const orderMatchesEvidence = input.order.taxCents === evidence.amountTax
    && input.order.totalCents === evidence.amountTotal
  const itemsMatchEvidence = reconciledItems.every((item, index) => (
    item.allocatedTaxCents === input.order.items[index].allocatedTaxCents
    && item.lineTotalCents === input.order.items[index].lineTotalCents
  ))
  if (orderMatchesEvidence && itemsMatchEvidence) {
    return {
      order: {
        ...input.order,
        taxCents: evidence.amountTax,
        totalCents: evidence.amountTotal,
        items: reconciledItems,
      },
      failure: null,
    }
  }

  const orderHasUntaxedBaseline = input.order.taxCents === 0
    && input.order.totalCents === input.order.subtotalCents
  const itemsHaveUntaxedBaseline = input.order.items.every((item) => (
    item.allocatedTaxCents === 0
    && item.lineTotalCents === item.unitPriceCents * item.quantity
  ))
  if (
    !TAX_RECONCILABLE_ORDER_STATUSES.has(input.order.status)
    || input.order.fulfillmentStatus !== "PENDING"
    || !orderHasUntaxedBaseline
    || !itemsHaveUntaxedBaseline
  ) {
    return {
      order: input.order,
      failure: {
        code: "CHECKOUT_TAX_MISMATCH",
        itemIds: input.order.items.map((item) => item.id),
      },
    }
  }

  for (const item of reconciledItems) {
    const storedItem = input.order.items.find((candidate) => candidate.id === item.id)
    if (!storedItem) throw new TaxSnapshotConflictError()
    if (
      storedItem.allocatedTaxCents === item.allocatedTaxCents
      && storedItem.lineTotalCents === item.lineTotalCents
    ) {
      continue
    }
    const changed = await tx.commerceOrderItem.updateMany({
      where: {
        id: storedItem.id,
        orderId: input.order.id,
        allocatedTaxCents: storedItem.allocatedTaxCents,
        lineTotalCents: storedItem.lineTotalCents,
        fulfillmentStatus: "PENDING",
      },
      data: {
        allocatedTaxCents: item.allocatedTaxCents,
        lineTotalCents: item.lineTotalCents,
      },
    })
    if (changed.count !== 1) throw new TaxSnapshotConflictError()
  }

  const changedOrder = await tx.commerceOrder.updateMany({
    where: {
      id: input.order.id,
      userId: input.order.userId,
      status: input.order.status as never,
      fulfillmentStatus: "PENDING",
      stripeCheckoutSessionId: input.order.stripeCheckoutSessionId,
      subtotalCents: input.order.subtotalCents,
      taxCents: input.order.taxCents,
      totalCents: input.order.totalCents,
    },
    data: {
      taxCents: evidence.amountTax,
      totalCents: evidence.amountTotal,
    },
  })
  if (changedOrder.count !== 1) throw new TaxSnapshotConflictError()

  const reconciledOrder = {
    ...input.order,
    taxCents: evidence.amountTax,
    totalCents: evidence.amountTotal,
    items: reconciledItems,
  }
  await recordCommerceEvent(tx, {
    order: reconciledOrder,
    eventType: "BACKGROUND_ORDER_TAX_RECONCILED",
    fromState: input.order.status,
    toState: input.order.status,
    processorEventCreatedAt: input.processorEventCreatedAt,
  })
  return { order: reconciledOrder, failure: null }
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
    let processingOrder = order
    let taxFailure: { code: string; itemIds: string[] } | null = null
    if (storedCustomer && paidEvent) {
      const taxSnapshot = await reconcilePaidTaxSnapshot(tx, {
        order,
        evidence,
        stripeCustomerId: storedCustomer.stripeCustomerId,
        processorEventCreatedAt: eventTimestamp,
      })
      processingOrder = taxSnapshot.order
      taxFailure = taxSnapshot.failure
    }
    const validationFailure = !storedCustomer
      ? { code: "STRIPE_CUSTOMER_NOT_FOUND", itemIds: [] }
      : taxFailure ?? evidenceFailure(
          processingOrder,
          evidence,
          storedCustomer.stripeCustomerId,
          paidEvent,
        )
    if (validationFailure) {
      return markReviewRequired(tx, {
        order: processingOrder,
        receiptId: receipt.id,
        failureCode: validationFailure.code,
        failedItemIds: validationFailure.itemIds,
        processorEventCreatedAt: eventTimestamp,
        now,
      })
    }

    if (paidEvent) {
      return fulfillPaidOrder(tx, {
        order: processingOrder,
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
      order: processingOrder,
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
