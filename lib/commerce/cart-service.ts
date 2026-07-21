import type { Prisma, PrismaClient } from "@prisma/client"
import { backgroundRegistry } from "../../components/backgrounds/backgroundRegistry.ts"
import { COMMERCE_CURRENCY, COMMERCE_PRODUCT_BACKGROUND } from "./constants.js"
import { resolveCommerceProduct, type CommerceProduct } from "./catalog.ts"
import type { PrismaClientOrTransaction } from "./credit-service.ts"
import { COMMERCE_ERROR_CODES, CommerceError, asPublicCommerceError } from "./errors.ts"
import { runCommerceTransaction } from "./transactions.ts"

export const COMMERCE_CART_NOTICE_CODES = {
  OWNED_ITEM_REMOVED: "OWNED_ITEM_REMOVED",
  FREE_ITEM_REMOVED: "FREE_ITEM_REMOVED",
  RETIRED_ITEM_REMOVED: "RETIRED_ITEM_REMOVED",
  UNAVAILABLE_ITEM_REMOVED: "UNAVAILABLE_ITEM_REMOVED",
} as const

export type CommerceCartNoticeCode =
  (typeof COMMERCE_CART_NOTICE_CODES)[keyof typeof COMMERCE_CART_NOTICE_CODES]

export type CommerceCartSnapshot = {
  items: CommerceProduct[]
  reservedOrder: { orderId: string; expiresAt: string } | null
  subtotalAmount: number
  currency: typeof COMMERCE_CURRENCY
  notices: Array<{ code: CommerceCartNoticeCode; productKey: string }>
}

export type CartServiceInput = {
  prismaClient: PrismaClientOrTransaction
  userId: string
  now?: Date
}

export type CartMutationInput = CartServiceInput & {
  productType: string
  productKey: string
}

type CartRow = {
  id: string
  productType: string
  productKey: string
}

type ActiveOrder = {
  id: string
  reservationExpiresAt: Date | null
  items: Array<{
    productType: string
    productKey: string
    displayName?: string
    unitPriceCents?: number
    currency?: string
  }>
}

export type ReconciledCommerceCart = {
  cartId: string
  rows: CartRow[]
  activeOrder: ActiveOrder | null
  snapshot: CommerceCartSnapshot
}

function noticeCodeForRow(
  row: CartRow,
  ownedBackgroundKeys: ReadonlySet<string>,
): CommerceCartNoticeCode | null {
  if (row.productType !== COMMERCE_PRODUCT_BACKGROUND) {
    return COMMERCE_CART_NOTICE_CODES.UNAVAILABLE_ITEM_REMOVED
  }
  if (ownedBackgroundKeys.has(row.productKey)) {
    return COMMERCE_CART_NOTICE_CODES.OWNED_ITEM_REMOVED
  }

  const entry = backgroundRegistry.find((candidate) => candidate.id === row.productKey)
  if (!entry) return COMMERCE_CART_NOTICE_CODES.UNAVAILABLE_ITEM_REMOVED
  if (!entry.enabled) return COMMERCE_CART_NOTICE_CODES.RETIRED_ITEM_REMOVED
  if (!entry.requiresSubscription) return COMMERCE_CART_NOTICE_CODES.FREE_ITEM_REMOVED
  return null
}

function productFromReservedSnapshot(
  row: CartRow,
  activeOrder: ActiveOrder | null,
): CommerceProduct {
  try {
    return resolveCommerceProduct(row.productType, row.productKey)
  } catch {
    const reserved = activeOrder?.items.find((item) => (
      item.productType === row.productType && item.productKey === row.productKey
    ))
    if (
      !reserved
      || typeof reserved.displayName !== "string"
      || reserved.unitPriceCents !== 100
      || reserved.currency !== COMMERCE_CURRENCY
    ) {
      throw new CommerceError({ code: COMMERCE_ERROR_CODES.CATALOG_UNAVAILABLE })
    }
    return {
      productType: COMMERCE_PRODUCT_BACKGROUND,
      productKey: reserved.productKey,
      displayName: reserved.displayName,
      unitAmount: 100,
      currency: COMMERCE_CURRENCY,
      availableForPurchase: false,
    }
  }
}

async function assertVerifiedUser(tx: Prisma.TransactionClient, userId: string): Promise<void> {
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { emailVerified: true },
  })
  if (!user?.emailVerified) {
    throw new CommerceError({ code: COMMERCE_ERROR_CODES.EMAIL_VERIFICATION_REQUIRED })
  }
}

/**
 * Expires only local PREPARING reservations and records each won transition once.
 *
 * AWAITING_PAYMENT belongs to processor-aware orchestration: a database-only path
 * must not release it before Stripe confirms that its Checkout Session is no longer payable.
 */
export async function expirePreparingOrdersInTransaction(
  tx: Prisma.TransactionClient,
  input: { now: Date; userId?: string },
): Promise<{ expiredOrderIds: string[] }> {
  const due = await tx.commerceOrder.findMany({
    where: {
      ...(input.userId ? { userId: input.userId } : {}),
      status: "PREPARING",
      reservationExpiresAt: { lte: input.now },
    },
    orderBy: [{ reservationExpiresAt: "asc" }, { id: "asc" }],
    select: { id: true, userId: true },
  })
  const expiredOrderIds: string[] = []

  for (const order of due) {
    const transition = await tx.commerceOrder.updateMany({
      where: {
        id: order.id,
        userId: order.userId,
        status: "PREPARING",
        reservationExpiresAt: { lte: input.now },
      },
      data: {
        status: "EXPIRED",
        reservationExpiresAt: null,
        failureCode: "RESERVATION_EXPIRED",
      },
    })
    if (transition.count !== 1) continue

    expiredOrderIds.push(order.id)
    await tx.commerceEvent.create({
      data: {
        userId: order.userId,
        orderId: order.id,
        eventType: "ORDER_EXPIRED",
        source: "commerce-order-service",
        reasonCode: "RESERVATION_EXPIRED",
        aggregateType: "CommerceOrder",
        aggregateId: order.id,
        fromState: "PREPARING",
        toState: "EXPIRED",
        payload: {},
      },
    })
  }

  return { expiredOrderIds }
}

/**
 * Reconciles one persistent account cart from current database and registry state.
 *
 * Reserved rows are deliberately excluded from pruning: the immutable order
 * snapshot remains authoritative until cancellation or expiry releases them.
 */
export async function reconcileCommerceCartInTransaction(
  tx: Prisma.TransactionClient,
  input: { userId: string; now: Date },
): Promise<ReconciledCommerceCart> {
  await assertVerifiedUser(tx, input.userId)

  await expirePreparingOrdersInTransaction(tx, {
    userId: input.userId,
    now: input.now,
  })

  const cart = await tx.commerceCart.upsert({
    where: { userId: input.userId },
    create: { userId: input.userId, currency: COMMERCE_CURRENCY },
    update: {},
    select: { id: true, currency: true },
  })
  const [rows, activeOrder] = await Promise.all([
    tx.commerceCartItem.findMany({
      where: { cartId: cart.id },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        productType: true,
        productKey: true,
      },
    }),
    tx.commerceOrder.findFirst({
      where: {
        userId: input.userId,
        OR: [
          {
            status: "PREPARING",
            reservationExpiresAt: { gt: input.now },
          },
          {
            status: "AWAITING_PAYMENT",
          },
        ],
      },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        reservationExpiresAt: true,
        items: {
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: {
            productType: true,
            productKey: true,
            displayName: true,
            unitPriceCents: true,
            currency: true,
          },
        },
      },
    }),
  ])

  const backgroundKeys = rows
    .filter((row) => row.productType === COMMERCE_PRODUCT_BACKGROUND)
    .map((row) => row.productKey)
  const ownerships = backgroundKeys.length === 0
    ? []
    : await tx.backgroundOwnership.findMany({
        where: {
          userId: input.userId,
          backgroundKey: { in: backgroundKeys },
        },
        select: { backgroundKey: true },
      })
  const ownedBackgroundKeys = new Set(ownerships.map((ownership) => ownership.backgroundKey))
  const reservedKeys = new Set(
    (activeOrder?.items ?? []).map((item) => item.productType + ":" + item.productKey),
  )
  const notices: CommerceCartSnapshot["notices"] = []
  const removedIds: string[] = []
  const retainedRows: CartRow[] = []

  for (const row of rows) {
    const bound = reservedKeys.has(row.productType + ":" + row.productKey)
    const code = bound ? null : noticeCodeForRow(row, ownedBackgroundKeys)
    if (code) {
      removedIds.push(row.id)
      notices.push({ code, productKey: row.productKey })
    } else {
      retainedRows.push(row)
    }
  }

  if (removedIds.length > 0) {
    await tx.commerceCartItem.deleteMany({
      where: {
        cartId: cart.id,
        id: { in: removedIds },
      },
    })
  }

  const items = retainedRows.map((row) => productFromReservedSnapshot(row, activeOrder))
  return {
    cartId: cart.id,
    rows: retainedRows,
    activeOrder,
    snapshot: {
      items,
      reservedOrder: activeOrder?.reservationExpiresAt
        ? {
            orderId: activeOrder.id,
            expiresAt: activeOrder.reservationExpiresAt.toISOString(),
          }
        : null,
      subtotalAmount: items.reduce((total, item) => total + item.unitAmount, 0),
      currency: COMMERCE_CURRENCY,
      notices,
    },
  }
}

async function withinCartTransaction<T>(
  prismaClient: PrismaClientOrTransaction,
  callback: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  if ("$transaction" in prismaClient) {
    return runCommerceTransaction(prismaClient as PrismaClient, callback)
  }
  return callback(prismaClient)
}

export async function getCommerceCartSnapshot(
  input: CartServiceInput,
): Promise<CommerceCartSnapshot> {
  try {
    return await withinCartTransaction(input.prismaClient, async (tx) => (
      await reconcileCommerceCartInTransaction(tx, {
        userId: input.userId,
        now: input.now ?? new Date(),
      })
    ).snapshot)
  } catch (error) {
    throw asPublicCommerceError(error)
  }
}

export async function addCommerceCartItem(
  input: CartMutationInput,
): Promise<CommerceCartSnapshot> {
  try {
    return await withinCartTransaction(input.prismaClient, async (tx) => {
      const now = input.now ?? new Date()
      const reconciled = await reconcileCommerceCartInTransaction(tx, {
        userId: input.userId,
        now,
      })
      const product = resolveCommerceProduct(input.productType, input.productKey)
      const existing = reconciled.rows.some((row) => (
        row.productType === product.productType && row.productKey === product.productKey
      ))
      if (existing) return reconciled.snapshot

      if (reconciled.snapshot.notices.some((notice) => (
        notice.code === COMMERCE_CART_NOTICE_CODES.OWNED_ITEM_REMOVED
        && notice.productKey === product.productKey
      ))) {
        throw new CommerceError({ code: COMMERCE_ERROR_CODES.ALREADY_OWNED })
      }
      const reserved = reconciled.activeOrder?.items.some((item) => (
        item.productType === product.productType && item.productKey === product.productKey
      ))
      if (reserved) {
        throw new CommerceError({ code: COMMERCE_ERROR_CODES.RESERVED_CART })
      }

      await tx.commerceCartItem.upsert({
        where: {
          cartId_productType_productKey: {
            cartId: reconciled.cartId,
            productType: product.productType,
            productKey: product.productKey,
          },
        },
        create: {
          cartId: reconciled.cartId,
          productType: product.productType,
          productKey: product.productKey,
          quantity: 1,
        },
        update: { quantity: 1 },
      })
      const refreshed = await reconcileCommerceCartInTransaction(tx, {
        userId: input.userId,
        now,
      })
      return {
        ...refreshed.snapshot,
        notices: [...reconciled.snapshot.notices, ...refreshed.snapshot.notices],
      }
    })
  } catch (error) {
    throw asPublicCommerceError(error)
  }
}

export async function removeCommerceCartItem(
  input: CartMutationInput,
): Promise<CommerceCartSnapshot> {
  try {
    return await withinCartTransaction(input.prismaClient, async (tx) => {
      const now = input.now ?? new Date()
      const reconciled = await reconcileCommerceCartInTransaction(tx, {
        userId: input.userId,
        now,
      })
      const reserved = reconciled.activeOrder?.items.some((item) => (
        item.productType === input.productType && item.productKey === input.productKey
      ))
      if (reserved) {
        throw new CommerceError({ code: COMMERCE_ERROR_CODES.RESERVED_CART })
      }

      await tx.commerceCartItem.deleteMany({
        where: {
          cartId: reconciled.cartId,
          productType: input.productType,
          productKey: input.productKey,
        },
      })
      const refreshed = await reconcileCommerceCartInTransaction(tx, {
        userId: input.userId,
        now,
      })
      return {
        ...refreshed.snapshot,
        notices: [...reconciled.snapshot.notices, ...refreshed.snapshot.notices],
      }
    })
  } catch (error) {
    throw asPublicCommerceError(error)
  }
}
