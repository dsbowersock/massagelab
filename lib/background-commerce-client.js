const OWNERSHIP_STATUSES = new Set([
  "active",
  "refund_pending",
  "dispute_suspended",
  "refund_revoked",
  "dispute_revoked",
  "retired",
])

const OWNERSHIP_SOURCES = new Set(["credit", "purchase"])
const CART_NOTICE_CODES = new Set([
  "OWNED_ITEM_REMOVED",
  "FREE_ITEM_REMOVED",
  "RETIRED_ITEM_REMOVED",
  "UNAVAILABLE_ITEM_REMOVED",
])
const ORDER_STATUSES = new Set([
  "PREPARING",
  "AWAITING_PAYMENT",
  "PAID",
  "PAYMENT_FAILED",
  "CANCELED",
  "EXPIRED",
  "REVIEW_REQUIRED",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
])

export const BACKGROUND_CART_AUTH_RETURN_PARAM = "commerceCart"

export const EMPTY_BACKGROUND_COMMERCE_STATE = Object.freeze({
  status: "idle",
  snapshot: null,
  pendingAction: null,
  error: null,
})

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function safeString(value, maxLength = 160) {
  if (typeof value !== "string") return null
  const normalized = value.trim()
  if (!normalized || normalized.length > maxLength) return null
  return normalized
}

function nonnegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0
}

function strictNonnegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : null
}

function safeIsoDate(value) {
  const normalized = safeString(value, 64)
  if (!normalized) return null
  const timestamp = Date.parse(normalized)
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : null
}

function safeReturnPath(value) {
  const normalized = safeString(value, 240)
  if (!normalized || !normalized.startsWith("/") || normalized.startsWith("//")) return "/"
  if (normalized.includes("\\") || normalized.includes(":")) return "/"
  return normalized.split("#")[0]
}

/**
 * Preserves the app-local surface that opened a guest cart and marks the cart
 * to reopen after authentication without trusting an external redirect.
 *
 * @param {unknown} pathname
 * @param {unknown} search
 * @returns {string}
 */
export function buildBackgroundCartAuthReturnPath(pathname, search) {
  const safePath = safeReturnPath(pathname)
  const params = new URLSearchParams(
    typeof search === "string" ? search.replace(/^\?/, "") : "",
  )
  params.set(BACKGROUND_CART_AUTH_RETURN_PARAM, "open")
  return `${safePath}?${params.toString()}`
}

function emptySnapshot() {
  return {
    creditBalance: 0,
    ownedBackgroundIds: [],
    ownerships: [],
    cart: {
      items: [],
      reservedOrder: null,
      subtotalAmount: 0,
      currency: "usd",
      notices: [],
    },
    recentOrders: [],
  }
}

/**
 * @typedef {{
 *   backgroundId: string,
 *   source: "credit" | "purchase",
 *   status: "active" | "refund_pending" | "dispute_suspended" | "refund_revoked" | "dispute_revoked" | "retired",
 *   acquiredAt: string,
 * }} NormalizedBackgroundOwnership
 */

/**
 * Keep only ownership rows that match the public commerce contract.
 *
 * @param {unknown} value
 * @returns {NormalizedBackgroundOwnership[]}
 */
function normalizeOwnerships(value) {
  if (!Array.isArray(value)) return []
  const seen = new Set()
  const ownerships = /** @type {NormalizedBackgroundOwnership[]} */ ([])

  for (const candidate of value) {
    if (!isRecord(candidate)) continue
    const backgroundId = safeString(candidate.backgroundId)
    const source = safeString(candidate.source, 24)
    const status = safeString(candidate.status, 32)
    const acquiredAt = safeIsoDate(candidate.acquiredAt)
    if (
      !backgroundId
      || seen.has(backgroundId)
      || !OWNERSHIP_SOURCES.has(source)
      || !OWNERSHIP_STATUSES.has(status)
      || !acquiredAt
    ) {
      continue
    }

    seen.add(backgroundId)
    ownerships.push({
      backgroundId,
      source: /** @type {NormalizedBackgroundOwnership["source"]} */ (source),
      status: /** @type {NormalizedBackgroundOwnership["status"]} */ (status),
      acquiredAt,
    })
  }

  return ownerships
}

/**
 * Keeps one line per public product identity and rejects malformed or negative
 * unit prices instead of presenting an invalid server line as free.
 */
function normalizeCartItems(value) {
  if (!Array.isArray(value)) return []
  const seen = new Set()
  const items = []

  for (const candidate of value) {
    if (!isRecord(candidate)) continue
    const productType = safeString(candidate.productType, 40)
    const productKey = safeString(candidate.productKey)
    const displayName = safeString(candidate.displayName)
    const unitAmount = strictNonnegativeInteger(candidate.unitAmount)
    if (productType !== "background" || !productKey || !displayName || unitAmount === null) continue
    const uniqueKey = productType + ":" + productKey
    if (seen.has(uniqueKey)) continue

    seen.add(uniqueKey)
    items.push({
      productType,
      productKey,
      displayName,
      unitAmount,
      currency: "usd",
      availableForPurchase: candidate.availableForPurchase === true,
    })
  }

  return items.sort((left, right) => (
    left.productKey.localeCompare(right.productKey, "en")
  ))
}

function normalizeReservedOrder(value) {
  if (!isRecord(value)) return null
  const orderId = safeString(value.orderId)
  const expiresAt = safeIsoDate(value.expiresAt)
  return orderId && expiresAt ? { orderId, expiresAt } : null
}

function normalizeCartNotices(value) {
  if (!Array.isArray(value)) return []
  const notices = []
  const seen = new Set()

  for (const candidate of value) {
    if (!isRecord(candidate)) continue
    const code = safeString(candidate.code, 48)
    const productKey = safeString(candidate.productKey)
    const uniqueKey = code + ":" + productKey
    if (!code || !productKey || !CART_NOTICE_CODES.has(code) || seen.has(uniqueKey)) continue
    seen.add(uniqueKey)
    notices.push({ code, productKey })
  }

  return notices
}

/**
 * Normalizes one cart atomically so an invalid authoritative subtotal cannot
 * coexist with otherwise actionable lines, reservations, or notices.
 */
function normalizeCart(value) {
  if (!isRecord(value)) return emptySnapshot().cart
  const subtotalAmount = strictNonnegativeInteger(value.subtotalAmount)
  if (subtotalAmount === null) return emptySnapshot().cart
  return {
    items: normalizeCartItems(value.items),
    reservedOrder: normalizeReservedOrder(value.reservedOrder),
    subtotalAmount,
    currency: "usd",
    notices: normalizeCartNotices(value.notices),
  }
}

/**
 * Keeps up to ten unique public orders and rejects rows with unknown status,
 * invalid dates, or any malformed nonnegative integer amount/count.
 */
function normalizeRecentOrders(value) {
  if (!Array.isArray(value)) return []
  const seen = new Set()
  const orders = []

  for (const candidate of value) {
    if (!isRecord(candidate)) continue
    const id = safeString(candidate.id)
    const status = safeString(candidate.status, 40)
    const createdAt = safeIsoDate(candidate.createdAt)
    if (!id || seen.has(id) || !ORDER_STATUSES.has(status) || !createdAt) continue
    if (
      !Number.isSafeInteger(candidate.itemCount)
      || candidate.itemCount < 0
      || !Number.isSafeInteger(candidate.subtotalAmount)
      || candidate.subtotalAmount < 0
      || !Number.isSafeInteger(candidate.taxAmount)
      || candidate.taxAmount < 0
      || !Number.isSafeInteger(candidate.totalAmount)
      || candidate.totalAmount < 0
    ) {
      continue
    }

    seen.add(id)
    orders.push({
      id,
      status,
      itemCount: candidate.itemCount,
      subtotalAmount: candidate.subtotalAmount,
      taxAmount: candidate.taxAmount,
      totalAmount: candidate.totalAmount,
      currency: "usd",
      createdAt,
      returnPath: safeReturnPath(candidate.returnPath),
    })
    if (orders.length === 10) break
  }

  return orders
}

/**
 * Projects unknown JSON into the safe public Track 1A snapshot contract.
 * Unknown/private fields are discarded instead of being copied through.
 */
export function normalizeBackgroundCommerceSnapshot(value) {
  if (!isRecord(value)) return emptySnapshot()

  const seenOwnedIds = new Set()
  const ownedBackgroundIds = []
  if (Array.isArray(value.ownedBackgroundIds)) {
    for (const candidate of value.ownedBackgroundIds) {
      const id = safeString(candidate)
      if (!id || seenOwnedIds.has(id)) continue
      seenOwnedIds.add(id)
      ownedBackgroundIds.push(id)
    }
  }

  return {
    creditBalance: nonnegativeInteger(value.creditBalance),
    ownedBackgroundIds,
    ownerships: normalizeOwnerships(value.ownerships),
    cart: normalizeCart(value.cart),
    recentOrders: normalizeRecentOrders(value.recentOrders),
  }
}

/** Formats integer minor units while keeping Track 1's currency fixed to USD. */
export function formatCommerceAmount(amount, currency = "usd") {
  // Retain the forward-compatible argument while Track 1 prices remain fixed to USD.
  void currency
  const safeAmount = nonnegativeInteger(amount)
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(safeAmount / 100)
}

function requestMatches(state, action) {
  return Boolean(
    state.pendingAction
    && safeString(action.requestId)
    && state.pendingAction.requestId === action.requestId,
  )
}

function normalizePublicError(value) {
  if (!isRecord(value)) return { code: "UNKNOWN_ERROR", message: "Something went wrong. Try again." }
  const code = safeString(value.code, 64)
  const message = safeString(value.message, 240)
  return {
    code: code && /^[A-Z0-9_]+$/.test(code) ? code : "UNKNOWN_ERROR",
    message: message ?? "Something went wrong. Try again.",
  }
}

/**
 * Starts only actions with a valid request id so later completion must match
 * the currently pending request before it can replace state.
 */
function beginAction(state, status, type, action) {
  const requestId = safeString(action.requestId)
  if (!requestId) return state
  return {
    ...state,
    status,
    pendingAction: {
      type,
      requestId,
      ...(safeString(action.action, 64) ? { action: action.action } : {}),
    },
    error: null,
  }
}

/**
 * Owns request ordering without inventing balance, ownership, or cart changes.
 * Successful refreshes replace the full snapshot; a committed mutation whose
 * follow-up refresh fails preserves the last snapshot and reports that read.
 */
export function backgroundCommerceReducer(state, action) {
  if (!isRecord(state) || !isRecord(action)) return state

  switch (action.type) {
    case "fetch-begin":
      return beginAction(state, "loading", "fetch", action)
    case "mutation-begin":
      return beginAction(state, "mutating", "mutation", action)
    case "checkout-redirect-begin":
      return beginAction(state, "redirecting", "checkout-redirect", action)
    case "fetch-success":
    case "mutation-success":
      if (!requestMatches(state, action)) return state
      return {
        status: "ready",
        snapshot: normalizeBackgroundCommerceSnapshot(action.snapshot),
        pendingAction: null,
        error: null,
      }
    case "fetch-failure":
    case "mutation-failure":
    case "checkout-redirect-failure":
      if (!requestMatches(state, action)) return state
      return {
        status: "error",
        snapshot: state.snapshot,
        pendingAction: null,
        error: normalizePublicError(action.error),
      }
    case "mutation-refresh-failure":
      if (!requestMatches(state, action)) return state
      return {
        status: "ready",
        snapshot: state.snapshot,
        pendingAction: null,
        error: normalizePublicError(action.error),
      }
    default:
      return state
  }
}

/**
 * Returns the normalized ownership row for a background; inactive rows remain
 * visible so the card adapter can fail selection closed.
 */
function activeOwnershipFor(snapshot, backgroundId) {
  return snapshot.ownerships.find((ownership) => ownership.backgroundId === backgroundId) ?? null
}

/**
 * Adapts authoritative commerce state to one production background card.
 * Selection remains separate from acquisition and never grants ownership.
 */
export function backgroundCardCommerceState({ background, access, snapshot }) {
  const normalizedSnapshot = normalizeBackgroundCommerceSnapshot(snapshot)
  const backgroundId = safeString(background?.id)
  const ownership = backgroundId
    ? activeOwnershipFor(normalizedSnapshot, backgroundId)
    : null
  const isInCart = Boolean(backgroundId && normalizedSnapshot.cart.items.some((item) => (
    item.productType === "background" && item.productKey === backgroundId
  )))
  const isReserved = Boolean(isInCart && normalizedSnapshot.cart.reservedOrder)
  let state = "unavailable"

  if (backgroundId && background?.enabled !== false) {
    if (ownership && ownership.status !== "active") {
      state = "unavailable"
    } else if (ownership?.source === "credit") {
      state = "owned-credit"
    } else if (ownership?.source === "purchase") {
      state = "owned-purchase"
    } else if (background?.requiresSubscription !== true) {
      state = "free"
    } else if (access?.canUse === true && access?.accessSource === "subscription") {
      state = "included-subscription"
    } else if (normalizedSnapshot.creditBalance > 0) {
      state = "locked-credit-available"
    } else {
      state = "locked-no-credit"
    }
  }

  const canSelect = [
    "free",
    "owned-credit",
    "owned-purchase",
    "included-subscription",
  ].includes(state)

  return {
    state,
    canSelect,
    showKeepPermanently: state === "included-subscription",
    isInCart,
    isReserved,
    ownershipStatus: ownership?.status ?? null,
    ownershipSource: ownership?.source ?? null,
  }
}
