import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  EMPTY_BACKGROUND_COMMERCE_STATE,
  backgroundCardCommerceState,
  backgroundCommerceReducer,
  buildBackgroundCartAuthReturnPath,
  formatCommerceAmount,
  normalizeBackgroundCommerceSnapshot,
} from "../lib/background-commerce-client.js"

const EMPTY_SNAPSHOT = {
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

function snapshot(overrides = {}) {
  return {
    ...structuredClone(EMPTY_SNAPSHOT),
    ...overrides,
  }
}

describe("background commerce snapshot normalization", () => {
  it("returns a safe empty public shape for invalid payloads", () => {
    assert.deepEqual(normalizeBackgroundCommerceSnapshot(null), EMPTY_SNAPSHOT)
    assert.deepEqual(normalizeBackgroundCommerceSnapshot("invalid"), EMPTY_SNAPSHOT)
    assert.deepEqual(normalizeBackgroundCommerceSnapshot([]), EMPTY_SNAPSHOT)
  })

  it("normalizes public fields, money, ownership, cart order, and recent-order limits", () => {
    const value = normalizeBackgroundCommerceSnapshot({
      creditBalance: -3,
      ownedBackgroundIds: ["aurora", "", "aurora", "photon", 7],
      ownerships: [
        {
          backgroundId: "aurora",
          source: "purchase",
          status: "active",
          acquiredAt: "2026-07-20T10:00:00.000Z",
          stripePaymentIntentId: "pi_private",
        },
        {
          backgroundId: "photon",
          source: "credit",
          status: "refund_pending",
          acquiredAt: "2026-07-20T11:00:00.000Z",
        },
        { backgroundId: "unknown", source: "gift", status: "active", acquiredAt: "not-a-date" },
      ],
      cart: {
        items: [
          {
            productType: "background",
            productKey: "zeta",
            displayName: "Zeta",
            unitAmount: 100,
            currency: "usd",
            availableForPurchase: true,
            internalId: "private",
          },
          {
            productType: "background",
            productKey: "alpha",
            displayName: "Alpha",
            unitAmount: 100.5,
            currency: "usd",
            availableForPurchase: true,
          },
          {
            productType: "background",
            productKey: "alpha",
            displayName: "Duplicate",
            unitAmount: 100,
            currency: "usd",
            availableForPurchase: true,
          },
        ],
        reservedOrder: {
          orderId: "order-reserved",
          expiresAt: "2026-07-22T20:00:00.000Z",
          stripeCheckoutSessionId: "cs_private",
        },
        subtotalAmount: 200,
        currency: "CAD",
        notices: [
          { code: "OWNED_ITEM_REMOVED", productKey: "owned", detail: "private" },
          { code: "UNKNOWN_NOTICE", productKey: "ignored" },
        ],
      },
      recentOrders: Array.from({ length: 14 }, (_, index) => ({
        id: `order-${index}`,
        status: index === 0 ? "PAID" : "EXPIRED",
        itemCount: 1,
        subtotalAmount: 100,
        taxAmount: 0,
        totalAmount: 100,
        currency: "usd",
        createdAt: new Date(Date.UTC(2026, 6, 20, 12, index)).toISOString(),
        customerEmail: "private@example.test",
      })),
      privateRoot: "remove-me",
    })

    assert.equal(value.creditBalance, 0)
    assert.deepEqual(value.ownedBackgroundIds, ["aurora", "photon"])
    assert.deepEqual(value.ownerships, [
      {
        backgroundId: "aurora",
        source: "purchase",
        status: "active",
        acquiredAt: "2026-07-20T10:00:00.000Z",
      },
      {
        backgroundId: "photon",
        source: "credit",
        status: "refund_pending",
        acquiredAt: "2026-07-20T11:00:00.000Z",
      },
    ])
    assert.deepEqual(value.cart.items.map(({ productKey }) => productKey), ["alpha", "zeta"])
    assert.equal(value.cart.items[0].unitAmount, 100)
    assert.equal(value.cart.subtotalAmount, 200)
    assert.equal(value.cart.currency, "usd")
    assert.deepEqual(value.cart.reservedOrder, {
      orderId: "order-reserved",
      expiresAt: "2026-07-22T20:00:00.000Z",
    })
    assert.deepEqual(value.cart.notices, [{ code: "OWNED_ITEM_REMOVED", productKey: "owned" }])
    assert.equal(value.recentOrders.length, 10)
    assert.doesNotMatch(
      JSON.stringify(value),
      /pi_private|cs_private|private@example|privateRoot|internalId|detail/,
    )
  })

  it("rejects invalid cart prices instead of presenting them as free", () => {
    const invalidLine = normalizeBackgroundCommerceSnapshot({
      cart: {
        items: [
          {
            productType: "background",
            productKey: "negative",
            displayName: "Negative",
            unitAmount: -1,
            availableForPurchase: true,
          },
          {
            productType: "background",
            productKey: "valid",
            displayName: "Valid",
            unitAmount: 100,
            availableForPurchase: true,
          },
        ],
        subtotalAmount: 100,
      },
    })
    assert.deepEqual(invalidLine.cart.items.map(({ productKey }) => productKey), ["valid"])

    const invalidSubtotal = normalizeBackgroundCommerceSnapshot({
      cart: {
        items: [{
          productType: "background",
          productKey: "valid",
          displayName: "Valid",
          unitAmount: 100,
          availableForPurchase: true,
        }],
        reservedOrder: { orderId: "order", expiresAt: "2026-07-24T12:00:00.000Z" },
        subtotalAmount: -1,
        notices: [{ code: "OWNED_ITEM_REMOVED", productKey: "owned" }],
      },
    })
    assert.deepEqual(invalidSubtotal.cart, EMPTY_SNAPSHOT.cart)
  })

  it("accepts only known ownership statuses and nonnegative integer counts", () => {
    const value = normalizeBackgroundCommerceSnapshot({
      creditBalance: 2.8,
      ownerships: [
        { backgroundId: "a", source: "credit", status: "active", acquiredAt: "2026-07-20T10:00:00.000Z" },
        { backgroundId: "b", source: "purchase", status: "dispute_suspended", acquiredAt: "2026-07-20T10:00:00.000Z" },
        { backgroundId: "c", source: "purchase", status: "refund_revoked", acquiredAt: "2026-07-20T10:00:00.000Z" },
        { backgroundId: "d", source: "purchase", status: "dispute_revoked", acquiredAt: "2026-07-20T10:00:00.000Z" },
        { backgroundId: "e", source: "purchase", status: "retired", acquiredAt: "2026-07-20T10:00:00.000Z" },
        { backgroundId: "f", source: "purchase", status: "private_status", acquiredAt: "2026-07-20T10:00:00.000Z" },
      ],
      recentOrders: [{ id: "order", status: "PAID", itemCount: -2, subtotalAmount: -1, taxAmount: 2.5, totalAmount: 100, currency: "usd", createdAt: "invalid" }],
    })

    assert.equal(value.creditBalance, 0)
    assert.deepEqual(value.ownerships.map(({ status }) => status), [
      "active",
      "dispute_suspended",
      "refund_revoked",
      "dispute_revoked",
      "retired",
    ])
    assert.deepEqual(value.recentOrders, [])
  })
})

describe("commerce amount formatting", () => {
  it("formats integer cents as USD without trusting invalid input", () => {
    assert.equal(formatCommerceAmount(0), "$0.00")
    assert.equal(formatCommerceAmount(100), "$1.00")
    assert.equal(formatCommerceAmount(12345, "USD"), "$123.45")
    assert.equal(formatCommerceAmount(-1), "$0.00")
    assert.equal(formatCommerceAmount(1.5), "$0.00")
    assert.equal(formatCommerceAmount(100, "cad"), "$1.00")
  })
})

describe("background cart authentication return paths", () => {
  it("preserves the originating route and picker query while requesting the cart to reopen", () => {
    assert.equal(
      buildBackgroundCartAuthReturnPath(
        "/clock",
        "source=music&returnTo=%2Fmusic&panel=background",
      ),
      "/clock?source=music&returnTo=%2Fmusic&panel=background&commerceCart=open",
    )
    assert.equal(
      buildBackgroundCartAuthReturnPath("/chimer", ""),
      "/chimer?commerceCart=open",
    )
  })

  it("falls back to an app-local route for unsafe paths", () => {
    assert.equal(
      buildBackgroundCartAuthReturnPath("https://example.com", "panel=background"),
      "/?panel=background&commerceCart=open",
    )
    assert.equal(
      buildBackgroundCartAuthReturnPath("/reports/2026:07", "panel=background"),
      "/reports/2026:07?panel=background&commerceCart=open",
    )
  })

  it("rejects alternate unsafe paths and replaces stale cart markers", () => {
    for (const unsafePath of ["//example.com", "/\\example.com", "/\n//example.com"]) {
      assert.equal(
        buildBackgroundCartAuthReturnPath(unsafePath, "panel=background"),
        "/?panel=background&commerceCart=open",
      )
    }

    assert.equal(
      buildBackgroundCartAuthReturnPath(
        "/clock",
        "commerceCart=closed&panel=background",
      ),
      "/clock?commerceCart=open&panel=background",
    )

    assert.equal(
      buildBackgroundCartAuthReturnPath(
        "/clock",
        "commerceCart=open&panel=background",
        false,
      ),
      "/clock?panel=background",
    )

    const duplicateMarkerPath = buildBackgroundCartAuthReturnPath(
      "/clock#stale-cart",
      "panel=background&commerceCart=closed&commerceCart=open",
    )
    const duplicateMarkerUrl = new URL(duplicateMarkerPath, "https://massagelab.local")
    assert.equal(duplicateMarkerUrl.pathname, "/clock")
    assert.equal(duplicateMarkerUrl.hash, "")
    assert.equal(duplicateMarkerUrl.searchParams.get("panel"), "background")
    assert.deepEqual(duplicateMarkerUrl.searchParams.getAll("commerceCart"), ["open"])

    const markerRemovedPath = buildBackgroundCartAuthReturnPath(
      "/clock#stale-cart",
      "panel=background&commerceCart=closed&commerceCart=open",
      false,
    )
    const markerRemovedUrl = new URL(markerRemovedPath, "https://massagelab.local")
    assert.equal(markerRemovedUrl.pathname, "/clock")
    assert.equal(markerRemovedUrl.hash, "")
    assert.equal(markerRemovedUrl.searchParams.get("panel"), "background")
    assert.deepEqual(markerRemovedUrl.searchParams.getAll("commerceCart"), [])
  })
})

describe("background commerce reducer", () => {
  it("uses full snapshots and rejects stale fetch responses", () => {
    const loadingOne = backgroundCommerceReducer(EMPTY_BACKGROUND_COMMERCE_STATE, {
      type: "fetch-begin",
      requestId: "fetch-1",
    })
    const loadingTwo = backgroundCommerceReducer(loadingOne, {
      type: "fetch-begin",
      requestId: "fetch-2",
    })
    const stale = backgroundCommerceReducer(loadingTwo, {
      type: "fetch-success",
      requestId: "fetch-1",
      snapshot: snapshot({ creditBalance: 1 }),
    })
    assert.equal(stale, loadingTwo)

    const ready = backgroundCommerceReducer(stale, {
      type: "fetch-success",
      requestId: "fetch-2",
      snapshot: snapshot({ creditBalance: 2 }),
    })
    assert.equal(ready.status, "ready")
    assert.equal(ready.snapshot.creditBalance, 2)
    assert.equal(ready.pendingAction, null)
    assert.equal(ready.error, null)
  })

  it("preserves the last good snapshot through retryable failures", () => {
    const good = {
      status: "ready",
      snapshot: snapshot({ creditBalance: 2 }),
      pendingAction: null,
      error: null,
    }
    const mutating = backgroundCommerceReducer(good, {
      type: "mutation-begin",
      requestId: "mutation-1",
      action: "add-to-cart",
    })
    const failed = backgroundCommerceReducer(mutating, {
      type: "mutation-failure",
      requestId: "mutation-1",
      error: { code: "NETWORK_ERROR", message: "Try again." },
    })

    assert.equal(failed.status, "error")
    assert.equal(failed.snapshot.creditBalance, 2)
    assert.deepEqual(failed.error, { code: "NETWORK_ERROR", message: "Try again." })

    const redirecting = backgroundCommerceReducer(failed, {
      type: "checkout-redirect-begin",
      requestId: "checkout-1",
    })
    assert.equal(redirecting.status, "redirecting")
    const recovered = backgroundCommerceReducer(redirecting, {
      type: "checkout-redirect-failure",
      requestId: "checkout-1",
      error: { code: "CHECKOUT_UNAVAILABLE", message: "Checkout is unavailable." },
    })
    assert.equal(recovered.snapshot.creditBalance, 2)
    assert.equal(recovered.status, "error")
  })

  it("preserves mutation success when only its follow-up refresh fails", () => {
    const good = {
      status: "ready",
      snapshot: snapshot({ creditBalance: 2 }),
      pendingAction: null,
      error: null,
    }
    const mutating = backgroundCommerceReducer(good, {
      type: "mutation-begin",
      requestId: "mutation-refresh-1",
      action: "add-to-cart",
    })
    const refreshFailed = backgroundCommerceReducer(mutating, {
      type: "mutation-refresh-failure",
      requestId: "mutation-refresh-1",
      error: { code: "NETWORK_ERROR", message: "Current cart could not be refreshed." },
    })

    assert.equal(refreshFailed.status, "ready")
    assert.equal(refreshFailed.snapshot.creditBalance, 2)
    assert.equal(refreshFailed.pendingAction, null)
    assert.deepEqual(refreshFailed.error, {
      code: "NETWORK_ERROR",
      message: "Current cart could not be refreshed.",
    })
  })

  it("replaces rather than patches the snapshot after a mutation", () => {
    const state = {
      status: "ready",
      snapshot: snapshot({ creditBalance: 2, ownedBackgroundIds: ["old"] }),
      pendingAction: null,
      error: null,
    }
    const mutating = backgroundCommerceReducer(state, {
      type: "mutation-begin",
      requestId: "redeem-1",
      action: "redeem-credit",
    })
    const next = backgroundCommerceReducer(mutating, {
      type: "mutation-success",
      requestId: "redeem-1",
      snapshot: snapshot({ creditBalance: 1, ownedBackgroundIds: ["new"] }),
    })

    assert.deepEqual(next.snapshot.ownedBackgroundIds, ["new"])
    assert.equal(next.snapshot.creditBalance, 1)
  })
})

describe("background card commerce states", () => {
  const premium = { id: "premium", enabled: true, requiresSubscription: true }
  const free = { id: "free", enabled: true, requiresSubscription: false }

  it("resolves free, active ownership, subscription, and locked states", () => {
    assert.equal(backgroundCardCommerceState({
      background: free,
      access: { canUse: true, accessSource: "free" },
      snapshot: snapshot(),
    }).state, "free")

    for (const [source, state] of [["credit", "owned-credit"], ["purchase", "owned-purchase"]]) {
      const result = backgroundCardCommerceState({
        background: premium,
        access: { canUse: true, accessSource: "ownership" },
        snapshot: snapshot({
          creditBalance: 0,
          ownerships: [{ backgroundId: "premium", source, status: "active", acquiredAt: "2026-07-20T10:00:00.000Z" }],
        }),
      })
      assert.equal(result.state, state)
      assert.equal(result.canSelect, true)
    }

    const included = backgroundCardCommerceState({
      background: premium,
      access: { canUse: true, accessSource: "subscription" },
      snapshot: snapshot(),
    })
    assert.equal(included.state, "included-subscription")
    assert.equal(included.canSelect, true)
    assert.equal(included.showKeepPermanently, true)

    assert.equal(backgroundCardCommerceState({
      background: premium,
      access: { canUse: false, accessSource: "locked" },
      snapshot: snapshot({ creditBalance: 2 }),
    }).state, "locked-credit-available")
    assert.equal(backgroundCardCommerceState({
      background: premium,
      access: { canUse: false, accessSource: "locked" },
      snapshot: snapshot({ creditBalance: 0 }),
    }).state, "locked-no-credit")
  })

  it("treats inactive ownership as unavailable and reports cart/reservation state", () => {
    const unavailable = backgroundCardCommerceState({
      background: premium,
      access: { canUse: true, accessSource: "subscription" },
      snapshot: snapshot({
        ownerships: [{
          backgroundId: "premium",
          source: "purchase",
          status: "refund_pending",
          acquiredAt: "2026-07-20T10:00:00.000Z",
        }],
      }),
    })
    assert.equal(unavailable.state, "unavailable")
    assert.equal(unavailable.canSelect, false)

    const inCart = backgroundCardCommerceState({
      background: premium,
      access: { canUse: false, accessSource: "locked" },
      snapshot: snapshot({
        creditBalance: 1,
        cart: {
          items: [{ productType: "background", productKey: "premium", displayName: "Premium", unitAmount: 100, currency: "usd", availableForPurchase: false }],
          reservedOrder: { orderId: "order", expiresAt: "2026-07-22T20:00:00.000Z" },
          subtotalAmount: 100,
          currency: "usd",
          notices: [],
        },
      }),
    })
    assert.equal(inCart.isInCart, true)
    assert.equal(inCart.isReserved, true)
    assert.equal(inCart.canSelect, false)
  })
})
