import { backgroundRegistry } from "../components/backgrounds/backgroundRegistry.ts"

export const GUEST_BACKGROUND_CART_STORAGE_KEY = "massagelab-guest-background-cart-v1"
const MAX_GUEST_CART_ITEMS = 100

export type GuestBackgroundCartItem = {
  productType: "background"
  productKey: string
  displayName: string
  unitAmount: 100
  currency: "usd"
  availableForPurchase: true
}

/** Resolves guest intent only from the current public purchase catalog. */
export function resolveGuestBackgroundCartItem(backgroundId: unknown): GuestBackgroundCartItem | null {
  if (typeof backgroundId !== "string") return null
  const entry = backgroundRegistry.find((candidate) => candidate.id === backgroundId.trim())
  if (!entry?.enabled || !entry.requiresSubscription) return null
  return {
    productType: "background",
    productKey: entry.id,
    displayName: entry.label,
    unitAmount: 100,
    currency: "usd",
    availableForPurchase: true,
  }
}

/** Discards unknown, duplicate, disabled, and oversized local cart entries. */
export function normalizeGuestBackgroundCartIds(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  const ids: string[] = []
  const seen = new Set<string>()
  for (const candidate of value) {
    const item = resolveGuestBackgroundCartItem(candidate)
    if (!item || seen.has(item.productKey)) continue
    seen.add(item.productKey)
    ids.push(item.productKey)
    if (ids.length >= MAX_GUEST_CART_ITEMS) break
  }
  return ids
}

export function readGuestBackgroundCartIds(storage: Pick<Storage, "getItem">): string[] {
  try {
    return normalizeGuestBackgroundCartIds(JSON.parse(storage.getItem(GUEST_BACKGROUND_CART_STORAGE_KEY) ?? "[]"))
  } catch {
    return []
  }
}

export function writeGuestBackgroundCartIds(
  storage: Pick<Storage, "setItem" | "removeItem">,
  value: unknown,
): string[] {
  const ids = normalizeGuestBackgroundCartIds(value)
  try {
    if (ids.length === 0) storage.removeItem(GUEST_BACKGROUND_CART_STORAGE_KEY)
    else storage.setItem(GUEST_BACKGROUND_CART_STORAGE_KEY, JSON.stringify(ids))
  } catch {
    // Storage can be unavailable in privacy modes; the in-memory caller state still works.
  }
  return ids
}

/** Builds the same public cart shape as Track 1A without inventing account authority. */
export function createGuestBackgroundCommerceSnapshot(backgroundIds: unknown) {
  const items = normalizeGuestBackgroundCartIds(backgroundIds)
    .map(resolveGuestBackgroundCartItem)
    .filter((item): item is GuestBackgroundCartItem => Boolean(item))
  return {
    creditBalance: 0,
    ownedBackgroundIds: [] as string[],
    ownerships: [],
    cart: {
      items,
      reservedOrder: null,
      subtotalAmount: items.reduce((sum, item) => sum + item.unitAmount, 0),
      currency: "usd" as const,
      notices: [],
    },
    recentOrders: [],
  }
}
