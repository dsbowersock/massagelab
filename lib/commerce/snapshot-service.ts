import type { CommerceCartSnapshot } from "./cart-service.ts"
import { COMMERCE_ERROR_CODES, CommerceError, asPublicCommerceError } from "./errors.ts"

export type BackgroundCommerceSnapshot = {
  creditBalance: number
  ownedBackgroundIds: string[]
  ownerships: Array<{
    backgroundId: string
    source: "credit" | "purchase"
    status: "active" | "refund_pending" | "dispute_suspended" | "refund_revoked" | "dispute_revoked" | "retired"
    acquiredAt: string
  }>
  cart: CommerceCartSnapshot
  recentOrders: Array<{
    id: string
    status: string
    itemCount: number
    subtotalAmount: number
    taxAmount: number
    totalAmount: number
    currency: "usd"
    createdAt: string
    returnPath: string
  }>
}

export type CommerceRouteIdentityDependencies = {
  getSessionUserId: () => Promise<string | null>
  loadUser: (userId: string) => Promise<{ id: string; emailVerified: Date | null } | null>
}

export async function requireVerifiedCommerceRouteUser(
  dependencies: CommerceRouteIdentityDependencies,
): Promise<{ id: string }> {
  const sessionUserId = await dependencies.getSessionUserId()
  if (!sessionUserId) throw new CommerceError({ code: COMMERCE_ERROR_CODES.AUTHENTICATION_REQUIRED })
  const user = await dependencies.loadUser(sessionUserId)
  if (!user) throw new CommerceError({ code: COMMERCE_ERROR_CODES.AUTHENTICATION_REQUIRED })
  if (!user.emailVerified) throw new CommerceError({ code: COMMERCE_ERROR_CODES.EMAIL_VERIFICATION_REQUIRED })
  return { id: user.id }
}

export function privateCommerceJson(value: unknown, init: ResponseInit = {}): Response {
  return Response.json(value, {
    ...init,
    headers: { ...Object.fromEntries(new Headers(init.headers)), "Cache-Control": "private, no-store" },
  })
}

export function commerceApiErrorResponse(error: unknown): Response {
  const safe = asPublicCommerceError(error)
  return privateCommerceJson({ error: safe.code, message: safe.message }, { status: safe.status })
}

type SnapshotOrderRow = {
  id: string
  status: string
  subtotalCents: number
  taxCents: number
  totalCents: number
  currency: string
  createdAt: Date
  returnPath: string
  _count: { items: number }
}

type SnapshotPrismaClient = {
  backgroundCreditWallet: { findUnique(input: unknown): Promise<{ balance: number } | null> }
  backgroundOwnership: { findMany(input: unknown): Promise<Array<{ backgroundKey: string; source: string; status: string; acquiredAt: Date }>> }
  commerceOrder: { findMany(input: unknown): Promise<SnapshotOrderRow[]> }
}

const OWNERSHIP_STATUSES = new Set([
  "active", "refund_pending", "dispute_suspended", "refund_revoked", "dispute_revoked", "retired",
])

/** Projects fresh commerce rows into the only user-safe state contract. */
export async function getBackgroundCommerceSnapshot(input: {
  prismaClient: object
  userId: string
  getCartSnapshot?: () => Promise<CommerceCartSnapshot>
  includeRecentOrders?: boolean
}): Promise<BackgroundCommerceSnapshot> {
  const prismaClient = input.prismaClient as SnapshotPrismaClient
  const cartPromise = input.getCartSnapshot
    ? input.getCartSnapshot()
    : import("./cart-service.ts").then(({ getCommerceCartSnapshot }) => getCommerceCartSnapshot({
        prismaClient: input.prismaClient as never,
        userId: input.userId,
      }))
  // Account purchase history loads richer itemized rows and can skip this summary query.
  const orderRowsPromise = input.includeRecentOrders === false
    ? Promise.resolve([] as SnapshotOrderRow[])
    : prismaClient.commerceOrder.findMany({
        where: { userId: input.userId },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 10,
        select: {
          id: true, status: true, subtotalCents: true, taxCents: true,
          totalCents: true, currency: true, createdAt: true, returnPath: true, _count: { select: { items: true } },
        },
      })
  const [wallet, ownershipRows, orderRows, cart] = await Promise.all([
    prismaClient.backgroundCreditWallet.findUnique({ where: { userId: input.userId }, select: { balance: true } }),
    prismaClient.backgroundOwnership.findMany({
      where: { userId: input.userId },
      orderBy: [{ acquiredAt: "asc" }, { id: "asc" }],
      select: { backgroundKey: true, source: true, status: true, acquiredAt: true },
    }),
    orderRowsPromise,
    cartPromise,
  ])

  const ownerships = ownershipRows.map((row) => {
    const status = row.status.toLowerCase()
    if (!OWNERSHIP_STATUSES.has(status)) throw new Error("Unsupported ownership status.")
    return {
      backgroundId: row.backgroundKey,
      source: row.source === "CREDIT_REDEMPTION" || row.source === "CREDIT"
        ? "credit" as const
        : "purchase" as const,
      status: status as BackgroundCommerceSnapshot["ownerships"][number]["status"],
      acquiredAt: row.acquiredAt.toISOString(),
    }
  })

  return {
    creditBalance: wallet?.balance ?? 0,
    ownedBackgroundIds: ownerships.filter((ownership) => ownership.status === "active").map((ownership) => ownership.backgroundId),
    ownerships,
    cart,
    recentOrders: orderRows.map((order) => ({
      id: order.id,
      status: order.status,
      itemCount: order._count.items,
      subtotalAmount: order.subtotalCents,
      taxAmount: order.taxCents,
      totalAmount: order.totalCents,
      currency: "usd",
      createdAt: order.createdAt.toISOString(),
      returnPath: order.returnPath,
    })),
  }
}
