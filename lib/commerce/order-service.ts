import type { Prisma, PrismaClient } from "@prisma/client"
import {
  CHECKOUT_RESERVATION_MINUTES,
  COMMERCE_CURRENCY,
  COMMERCE_PRODUCT_BACKGROUND,
  COMMERCE_PURCHASE_COUNTRIES,
} from "./constants.js"
import { normalizeCommerceReturnPath } from "./catalog.ts"
import {
  expirePreparingOrdersInTransaction,
  reconcileCommerceCartInTransaction,
  type ReconciledCommerceCart,
} from "./cart-service.ts"
import type { PrismaClientOrTransaction } from "./credit-service.ts"
import { COMMERCE_ERROR_CODES, CommerceError, asPublicCommerceError } from "./errors.ts"
import { runCommerceTransaction } from "./transactions.ts"

const ACTIVE_ORDER_STATUSES = ["PREPARING", "AWAITING_PAYMENT"] as const
const BACKGROUND_FULFILLMENT_ADAPTER_VERSION = "background-v1"

export type CommerceLegalAcceptanceSnapshot = {
  documentIds: string[]
  documentVersions: Record<string, string>
  acceptedAt: string
  combinedConsentAccepted: true
}

export type PrepareBackgroundOrderInput = {
  prismaClient: PrismaClientOrTransaction
  userId: string
  purchaseCountry: string
  legalAcceptance: unknown
  returnPath?: unknown
  now?: Date
}

export type PreparedBackgroundOrder = {
  orderId: string
  publicId: string
  status: "PREPARING" | "AWAITING_PAYMENT"
  expiresAt: string
  subtotalAmount: number
  currency: typeof COMMERCE_CURRENCY
  items: Array<{
    productType: typeof COMMERCE_PRODUCT_BACKGROUND
    productKey: string
    displayName: string
    unitAmount: 100
    quantity: 1
    currency: typeof COMMERCE_CURRENCY
  }>
}

export type PreparedOrderTransition = {
  orderId: string
  status: "CANCELED" | "EXPIRED"
}

type StoredOrder = {
  id: string
  publicId: string
  userId: string
  status: string
  subtotalCents: number
  currency: string
  reservationExpiresAt: Date | null
  items: Array<{
    productType: string
    productKey: string
    displayName: string
    unitPriceCents: number
    quantity: number
    currency: string
  }>
}

/**
 * Snapshots literal consent only when every document ID equals its matching
 * `documentVersions` composite in `key:version` form, with no unmatched entry.
 */
function legalAcceptanceSnapshot(value: unknown, now: Date): CommerceLegalAcceptanceSnapshot {
  if (!value || typeof value !== "object") {
    throw new CommerceError({ code: COMMERCE_ERROR_CODES.LEGAL_CONSENT_REQUIRED })
  }
  const candidate = value as {
    documentIds?: unknown
    documentVersions?: unknown
    combinedConsentAccepted?: unknown
  }
  if (
    candidate.combinedConsentAccepted !== true
    || !Array.isArray(candidate.documentIds)
    || candidate.documentIds.length === 0
    || !candidate.documentVersions
    || typeof candidate.documentVersions !== "object"
    || Array.isArray(candidate.documentVersions)
  ) {
    throw new CommerceError({ code: COMMERCE_ERROR_CODES.LEGAL_CONSENT_REQUIRED })
  }

  const documentIds = candidate.documentIds
    .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    .map((entry) => entry.trim())
  const rawVersionEntries = Object.entries(candidate.documentVersions)
  const documentVersions = Object.fromEntries(
    rawVersionEntries
      .filter(([key, version]) => key.trim() && typeof version === "string" && version.trim())
      .map(([key, version]) => [key.trim(), (version as string).trim()]),
  )
  const normalizedDocumentIds = new Set(documentIds)
  const versionedDocumentIds = new Set(
    Object.entries(documentVersions).map(([key, version]) => key + ":" + version),
  )
  if (
    documentIds.length !== candidate.documentIds.length
    || Object.keys(documentVersions).length !== rawVersionEntries.length
    || Object.keys(documentVersions).length === 0
    || normalizedDocumentIds.size !== versionedDocumentIds.size
    || ![...normalizedDocumentIds].every((documentId) => versionedDocumentIds.has(documentId))
  ) {
    throw new CommerceError({ code: COMMERCE_ERROR_CODES.LEGAL_CONSENT_REQUIRED })
  }

  return {
    documentIds: [...normalizedDocumentIds],
    documentVersions,
    acceptedAt: now.toISOString(),
    combinedConsentAccepted: true,
  }
}

function normalizedPurchaseCountry(country: unknown): string {
  const normalized = typeof country === "string" ? country.trim().toUpperCase() : ""
  if (!COMMERCE_PURCHASE_COUNTRIES.includes(normalized)) {
    throw new CommerceError({ code: COMMERCE_ERROR_CODES.COUNTRY_UNAVAILABLE })
  }
  return normalized
}

function preparedOrderResult(order: StoredOrder): PreparedBackgroundOrder {
  if (
    !ACTIVE_ORDER_STATUSES.includes(order.status as (typeof ACTIVE_ORDER_STATUSES)[number])
    || !order.reservationExpiresAt
    || order.currency !== COMMERCE_CURRENCY
  ) {
    throw new CommerceError({ code: COMMERCE_ERROR_CODES.STALE_CONCURRENCY })
  }

  return {
    orderId: order.id,
    publicId: order.publicId,
    status: order.status as PreparedBackgroundOrder["status"],
    expiresAt: order.reservationExpiresAt.toISOString(),
    subtotalAmount: order.subtotalCents,
    currency: COMMERCE_CURRENCY,
    items: order.items.map((item) => {
      if (
        item.productType !== COMMERCE_PRODUCT_BACKGROUND
        || item.unitPriceCents !== 100
        || item.quantity !== 1
        || item.currency !== COMMERCE_CURRENCY
      ) {
        throw new CommerceError({ code: COMMERCE_ERROR_CODES.STALE_CONCURRENCY })
      }
      return {
        productType: COMMERCE_PRODUCT_BACKGROUND,
        productKey: item.productKey,
        displayName: item.displayName,
        unitAmount: 100,
        quantity: 1,
        currency: COMMERCE_CURRENCY,
      }
    }),
  }
}

async function loadStoredOrder(
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<StoredOrder | null> {
  return tx.commerceOrder.findUnique({
    where: { id: orderId },
    include: {
      items: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      },
    },
  }) as Promise<StoredOrder | null>
}

async function activePreparedResult(
  tx: Prisma.TransactionClient,
  reconciled: ReconciledCommerceCart,
): Promise<PreparedBackgroundOrder | null> {
  if (!reconciled.activeOrder) return null
  const active = await loadStoredOrder(tx, reconciled.activeOrder.id)
  return active ? preparedOrderResult(active) : null
}

async function recordOrderEvent(
  tx: Prisma.TransactionClient,
  input: {
    userId: string
    orderId: string
    eventType: string
    fromState: string | null
    toState: string
    reasonCode?: string
  },
): Promise<void> {
  await tx.commerceEvent.create({
    data: {
      userId: input.userId,
      orderId: input.orderId,
      eventType: input.eventType,
      source: "commerce-order-service",
      reasonCode: input.reasonCode ?? null,
      aggregateType: "CommerceOrder",
      aggregateId: input.orderId,
      fromState: input.fromState,
      toState: input.toState,
      payload: {},
    },
  })
}

/**
 * Creates only the local immutable order snapshot and reservation.
 *
 * Stripe and all other network work intentionally happen after this short
 * serializable transaction in later checkout orchestration.
 */
async function prepareBackgroundOrderInTransaction(
  tx: Prisma.TransactionClient,
  input: Omit<PrepareBackgroundOrderInput, "prismaClient"> & { now: Date },
): Promise<PreparedBackgroundOrder> {
  const reconciled = await reconcileCommerceCartInTransaction(tx, {
    userId: input.userId,
    now: input.now,
  })
  const existing = await activePreparedResult(tx, reconciled)
  if (existing) return existing
  if (reconciled.snapshot.items.length === 0) {
    throw new CommerceError({ code: COMMERCE_ERROR_CODES.EMPTY_CART })
  }

  const purchaseCountry = normalizedPurchaseCountry(input.purchaseCountry)
  const legalAcceptance = legalAcceptanceSnapshot(input.legalAcceptance, input.now)
  const reservationExpiresAt = new Date(
    input.now.getTime() + CHECKOUT_RESERVATION_MINUTES * 60 * 1000,
  )
  const subtotalCents = reconciled.snapshot.subtotalAmount
  const order = await tx.commerceOrder.create({
    data: {
      userId: input.userId,
      status: "PREPARING",
      fulfillmentStatus: "PENDING",
      currency: COMMERCE_CURRENCY,
      subtotalCents,
      taxCents: 0,
      totalCents: subtotalCents,
      reservationExpiresAt,
      legalAcceptance: legalAcceptance as Prisma.InputJsonValue,
      purchaseCountry,
      returnPath: normalizeCommerceReturnPath(input.returnPath),
      items: {
        create: reconciled.snapshot.items.map((product) => ({
          productType: product.productType,
          productKey: product.productKey,
          displayName: product.displayName,
          unitPriceCents: product.unitAmount,
          quantity: 1,
          allocatedTaxCents: 0,
          lineTotalCents: product.unitAmount,
          currency: product.currency,
          fulfillmentAdapterVersion: BACKGROUND_FULFILLMENT_ADAPTER_VERSION,
        })),
      },
    },
    include: {
      items: {
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      },
    },
  }) as StoredOrder

  await recordOrderEvent(tx, {
    userId: input.userId,
    orderId: order.id,
    eventType: "ORDER_PREPARED",
    fromState: null,
    toState: "PREPARING",
  })
  return preparedOrderResult(order)
}

function collectConstraintTokens(value: unknown, depth = 0): string[] {
  if (depth > 4) return []
  if (typeof value === "string") return [value]
  if (Array.isArray(value)) return value.flatMap((entry) => collectConstraintTokens(entry, depth + 1))
  if (!value || typeof value !== "object") return []
  return Object.values(value).flatMap((entry) => collectConstraintTokens(entry, depth + 1))
}

/** Recognizes only the final one-active-order guard, never unrelated unique failures. */
function isActiveOrderUniqueConflict(error: unknown): boolean {
  if (!error || typeof error !== "object" || (error as { code?: unknown }).code !== "P2002") {
    return false
  }
  const meta = (error as { meta?: unknown }).meta
  const modelName = meta && typeof meta === "object"
    ? (meta as { modelName?: unknown }).modelName
    : undefined
  const target = meta && typeof meta === "object"
    ? (meta as { target?: unknown }).target
    : undefined
  const tokens = collectConstraintTokens(meta)
  const exactUserTarget = Array.isArray(target)
    && target.length === 1
    && target[0] === "userId"
  return (modelName === undefined || modelName === "CommerceOrder")
    && (
      exactUserTarget
      || tokens.includes("CommerceOrder_one_active_per_user_key")
    )
}

export async function prepareBackgroundOrder(
  input: PrepareBackgroundOrderInput,
): Promise<PreparedBackgroundOrder> {
  const now = input.now ?? new Date()
  const operation = (tx: Prisma.TransactionClient) => prepareBackgroundOrderInTransaction(tx, {
    userId: input.userId,
    purchaseCountry: input.purchaseCountry,
    legalAcceptance: input.legalAcceptance,
    returnPath: input.returnPath,
    now,
  })

  if (!("$transaction" in input.prismaClient)) {
    try {
      return await operation(input.prismaClient)
    } catch (error) {
      throw asPublicCommerceError(error)
    }
  }

  try {
    return await runCommerceTransaction(input.prismaClient as PrismaClient, operation)
  } catch (error) {
    if (!isActiveOrderUniqueConflict(error)) {
      throw asPublicCommerceError(error)
    }
    try {
      // The winning transaction is now visible. Reconciliation returns that
      // active snapshot, or creates a fresh order if the conflicting row expired.
      return await runCommerceTransaction(input.prismaClient as PrismaClient, operation)
    } catch (recoveryError) {
      throw asPublicCommerceError(recoveryError)
    }
  }
}

export async function cancelPreparedOrder(input: {
  prismaClient: PrismaClientOrTransaction
  userId: string
  orderId: string
  now?: Date
}): Promise<PreparedOrderTransition> {
  const operation = async (tx: Prisma.TransactionClient): Promise<PreparedOrderTransition> => {
    const now = input.now ?? new Date()
    await reconcileCommerceCartInTransaction(tx, { userId: input.userId, now })
    const order = await loadStoredOrder(tx, input.orderId)
    if (!order || order.userId !== input.userId) {
      throw new CommerceError({ code: COMMERCE_ERROR_CODES.STALE_CONCURRENCY })
    }
    if (order.status === "CANCELED" || order.status === "EXPIRED") {
      return { orderId: order.id, status: order.status }
    }
    if (order.status !== "PREPARING") {
      throw new CommerceError({ code: COMMERCE_ERROR_CODES.PAYMENT_PENDING })
    }

    const transition = await tx.commerceOrder.updateMany({
      where: {
        id: order.id,
        userId: input.userId,
        status: "PREPARING",
      },
      data: {
        status: "CANCELED",
        reservationExpiresAt: null,
        failureCode: "CUSTOMER_CANCELED",
      },
    })
    if (transition.count !== 1) {
      throw new CommerceError({ code: COMMERCE_ERROR_CODES.STALE_CONCURRENCY })
    }
    await recordOrderEvent(tx, {
      userId: input.userId,
      orderId: order.id,
      eventType: "ORDER_CANCELED",
      fromState: "PREPARING",
      toState: "CANCELED",
      reasonCode: "CUSTOMER_CANCELED",
    })
    return { orderId: order.id, status: "CANCELED" }
  }

  try {
    if ("$transaction" in input.prismaClient) {
      return await runCommerceTransaction(input.prismaClient as PrismaClient, operation)
    }
    return await operation(input.prismaClient)
  } catch (error) {
    throw asPublicCommerceError(error)
  }
}

/**
 * Lazily expires due reservations with predicate updates so a concurrent
 * payment-state transition cannot be overwritten or revived.
 */
export async function expirePreparedOrders(input: {
  prismaClient: PrismaClientOrTransaction
  now?: Date
}): Promise<{ expiredOrderIds: string[] }> {
  const operation = async (tx: Prisma.TransactionClient) => {
    const now = input.now ?? new Date()
    return expirePreparingOrdersInTransaction(tx, { now })
  }

  try {
    if ("$transaction" in input.prismaClient) {
      return await runCommerceTransaction(input.prismaClient as PrismaClient, operation)
    }
    return await operation(input.prismaClient)
  } catch (error) {
    throw asPublicCommerceError(error)
  }
}
