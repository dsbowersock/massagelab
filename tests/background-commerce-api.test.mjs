import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { getBackgroundCommerceSnapshot } from "../lib/commerce/snapshot-service.ts"
import { createBackgroundCommerceStateGetHandler } from "../app/api/background-commerce/state/route.ts"
import { createBackgroundCommerceRedeemPostHandler } from "../app/api/background-commerce/credits/redeem/route.ts"
import { createBackgroundCommerceCartHandlers } from "../app/api/background-commerce/cart/route.ts"
import { CommerceError, COMMERCE_ERROR_CODES } from "../lib/commerce/errors.ts"

const USER_ID = "user-snapshot"
const ACQUIRED_AT = new Date("2026-07-20T10:00:00.000Z")
const ORDER_CREATED_AT = new Date("2026-07-20T11:00:00.000Z")

/**
 * Models only the persisted read surface needed by the safe snapshot. Mutable
 * state lets the test prove that independent reads do not reuse stale results.
 */
function createSnapshotDatabase() {
  const state = {
    wallet: {
      id: "wallet-internal",
      userId: USER_ID,
      balance: 2,
      entries: [{ idempotencyKey: "ledger-secret-key" }],
    },
    ownerships: [{
      id: "ownership-internal",
      userId: USER_ID,
      backgroundKey: "massage-lab-aurora",
      source: "PURCHASE",
      status: "ACTIVE",
      acquiredAt: ACQUIRED_AT,
      sourceOrderItemId: "order-item-internal",
      sourceCreditEntryId: null,
    }],
    orders: [{
      id: "order-1",
      publicId: "public-order-secret",
      userId: USER_ID,
      status: "PAID",
      subtotalCents: 200,
      taxCents: 20,
      totalCents: 220,
      currency: "usd",
      createdAt: ORDER_CREATED_AT,
      stripeCheckoutSessionId: "cs_secret",
      failureCode: "DECLINE_RAW",
      legalAcceptance: { ipAddress: "203.0.113.7" },
      items: [{ id: "item-1" }, { id: "item-2" }],
      _count: { items: 2 },
    }],
  }

  const database = {
    async $transaction(callback) {
      return callback(database)
    },
    user: {
      async findUnique({ where }) {
        if (where.id !== USER_ID) return null
        return {
          id: USER_ID,
          email: "snapshot-owner@example.test",
          emailVerified: new Date("2026-07-01T00:00:00.000Z"),
        }
      },
    },
    membershipSubscription: {
      async findMany() {
        return []
      },
    },
    backgroundCreditWallet: {
      async findUnique() {
        return structuredClone(state.wallet)
      },
      async findFirst() {
        return structuredClone(state.wallet)
      },
      async upsert() {
        return structuredClone(state.wallet)
      },
    },
    backgroundOwnership: {
      async findMany() {
        return structuredClone(state.ownerships)
      },
    },
    commerceCart: {
      async upsert() {
        return { id: "cart-internal", userId: USER_ID, currency: "usd" }
      },
    },
    commerceCartItem: {
      async findMany() {
        return []
      },
      async deleteMany() {
        return { count: 0 }
      },
    },
    commerceOrder: {
      async findMany({ where = {} } = {}) {
        if (where.status || where.reservationExpiresAt) return []
        return structuredClone(state.orders)
      },
      async findFirst() {
        return null
      },
      async updateMany() {
        return { count: 0 }
      },
    },
    commerceEvent: {
      async create({ data }) {
        return { id: "event-internal", ...data }
      },
    },
  }

  return { database, state }
}

function snapshotInput(database) {
  return { prismaClient: database, userId: USER_ID }
}

describe("background commerce safe snapshot", () => {
  it("returns exactly the picker and Account/Billing fields without sensitive leakage", async () => {
    const { database } = createSnapshotDatabase()

    const snapshot = await getBackgroundCommerceSnapshot(snapshotInput(database))

    assert.deepEqual(Object.keys(snapshot), [
      "creditBalance",
      "ownedBackgroundIds",
      "ownerships",
      "cart",
      "recentOrders",
    ])
    assert.equal(snapshot.creditBalance, 2)
    assert.deepEqual(snapshot.ownedBackgroundIds, ["massage-lab-aurora"])
    assert.deepEqual(snapshot.ownerships, [{
      backgroundId: "massage-lab-aurora",
      source: "purchase",
      status: "active",
      acquiredAt: ACQUIRED_AT.toISOString(),
    }])
    assert.deepEqual(snapshot.cart, {
      items: [],
      reservedOrder: null,
      subtotalAmount: 0,
      currency: "usd",
      notices: [],
    })
    assert.deepEqual(snapshot.recentOrders, [{
      id: "order-1",
      status: "PAID",
      itemCount: 2,
      subtotalAmount: 200,
      taxAmount: 20,
      totalAmount: 220,
      currency: "usd",
      createdAt: ORDER_CREATED_AT.toISOString(),
    }])

    assert.deepEqual(Object.keys(snapshot.ownerships[0]), [
      "backgroundId",
      "source",
      "status",
      "acquiredAt",
    ])
    assert.deepEqual(Object.keys(snapshot.recentOrders[0]), [
      "id",
      "status",
      "itemCount",
      "subtotalAmount",
      "taxAmount",
      "totalAmount",
      "currency",
      "createdAt",
    ])
    assert.doesNotMatch(
      JSON.stringify(snapshot),
      /cs_secret|public-order-secret|order-item-internal|ledger-secret-key|snapshot-owner@example|203\.0\.113\.7|DECLINE_RAW/i,
    )
  })

  it("reflects committed wallet, ownership, and order mutations on the next read", async () => {
    const { database, state } = createSnapshotDatabase()
    const before = await getBackgroundCommerceSnapshot(snapshotInput(database))

    state.wallet.balance = 1
    state.ownerships[0].status = "REFUND_REVOKED"
    state.ownerships.push({
      id: "ownership-new",
      userId: USER_ID,
      backgroundKey: "massage-lab-photon-beam",
      source: "CREDIT",
      status: "ACTIVE",
      acquiredAt: new Date("2026-07-21T12:00:00.000Z"),
      sourceOrderItemId: null,
      sourceCreditEntryId: "credit-entry-internal",
    })
    state.orders.unshift({
      id: "order-2",
      userId: USER_ID,
      status: "PARTIALLY_REFUNDED",
      subtotalCents: 100,
      taxCents: 0,
      totalCents: 100,
      currency: "usd",
      createdAt: new Date("2026-07-21T12:01:00.000Z"),
      items: [{ id: "item-3" }],
      _count: { items: 1 },
    })

    const after = await getBackgroundCommerceSnapshot(snapshotInput(database))

    assert.equal(before.creditBalance, 2)
    assert.equal(after.creditBalance, 1)
    assert.deepEqual(after.ownedBackgroundIds, ["massage-lab-photon-beam"])
    assert.deepEqual(after.ownerships.map(({ backgroundId, source, status }) => ({
      backgroundId,
      source,
      status,
    })), [
      { backgroundId: "massage-lab-aurora", source: "purchase", status: "refund_revoked" },
      { backgroundId: "massage-lab-photon-beam", source: "credit", status: "active" },
    ])
    assert.deepEqual(after.recentOrders.map(({ id, status, totalAmount }) => ({
      id,
      status,
      totalAmount,
    })), [
      { id: "order-2", status: "PARTIALLY_REFUNDED", totalAmount: 100 },
      { id: "order-1", status: "PAID", totalAmount: 220 },
    ])
  })
})

function request(body) {
  return new Request("https://massagelab.test/api/background-commerce", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

function routeDeps(overrides = {}) {
  return {
    getSessionUserId: async () => "user-route",
    loadUser: async () => ({ id: "user-route", emailVerified: new Date() }),
    ...overrides,
  }
}

it("requires a signed-in database-verified user on every commerce route", async () => {
  const cases = [
    routeDeps({ getSessionUserId: async () => null }),
    routeDeps({ loadUser: async () => null }),
    routeDeps({ loadUser: async () => ({ id: "user-route", emailVerified: null }) }),
  ]
  for (const deps of cases) {
    const handlers = [
      createBackgroundCommerceStateGetHandler({ ...deps, getSnapshot: async () => ({}) }),
      createBackgroundCommerceRedeemPostHandler({ ...deps, redeem: async () => ({}) }),
      createBackgroundCommerceCartHandlers({
        ...deps,
        getCart: async () => ({}), addItem: async () => ({}), removeItem: async () => ({}),
      }).GET,
    ]
    for (const handler of handlers) {
      const response = await handler(request({}))
      assert.equal(response.status, deps === cases[2] ? 403 : 401)
      assert.equal(response.headers.get("cache-control"), "private, no-store")
    }
  }
})

it("validates explicit credit redemption inputs and returns safe stable errors", async () => {
  let redemptionInput = null
  const handler = createBackgroundCommerceRedeemPostHandler(routeDeps({
    redeem: async (input) => { redemptionInput = input; return { backgroundId: input.backgroundId, remainingCredits: 1 } },
  }))
  for (const body of [
    { confirmationAccepted: true, idempotencyKey: "key" },
    { backgroundId: "massage-lab-aurora", confirmationAccepted: false, idempotencyKey: "key" },
    { backgroundId: "massage-lab-aurora", confirmationAccepted: true, idempotencyKey: "" },
  ]) {
    const response = await handler(request(body))
    assert.notEqual(response.status, 200)
    assert.equal(response.headers.get("cache-control"), "private, no-store")
  }
  let response = await handler(request({ backgroundId: "massage-lab-aurora", confirmationAccepted: true, idempotencyKey: "redeem-1" }))
  assert.equal(response.status, 200)
  assert.deepEqual(await response.json(), { backgroundId: "massage-lab-aurora", remainingCredits: 1 })
  assert.deepEqual(redemptionInput, { userId: "user-route", backgroundId: "massage-lab-aurora", confirmationAccepted: true, idempotencyKey: "redeem-1" })

  response = await createBackgroundCommerceRedeemPostHandler(routeDeps({
    redeem: async () => { throw new CommerceError({ code: COMMERCE_ERROR_CODES.ALREADY_OWNED }) },
  }))(request({ backgroundId: "massage-lab-aurora", confirmationAccepted: true, idempotencyKey: "redeem-2" }))
  assert.deepEqual(await response.json(), { error: "ALREADY_OWNED", message: "You already own this item." })
})

it("routes GET POST and DELETE through the persistent cart service", async () => {
  const calls = []
  const cart = { items: [], reservedOrder: null, subtotalAmount: 0, currency: "usd", notices: [] }
  const handlers = createBackgroundCommerceCartHandlers(routeDeps({
    getCart: async (input) => { calls.push(["get", input]); return cart },
    addItem: async (input) => { calls.push(["add", input]); return cart },
    removeItem: async (input) => { calls.push(["remove", input]); return cart },
  }))
  assert.deepEqual(await (await handlers.GET(request({}))).json(), cart)
  assert.deepEqual(await (await handlers.POST(request({ backgroundId: "massage-lab-aurora" }))).json(), cart)
  assert.deepEqual(await (await handlers.DELETE(request({ backgroundId: "massage-lab-aurora" }))).json(), cart)
  assert.deepEqual(calls.map(([name, input]) => [name, input.userId, input.productType, input.productKey]), [
    ["get", "user-route", undefined, undefined],
    ["add", "user-route", "background", "massage-lab-aurora"],
    ["remove", "user-route", "background", "massage-lab-aurora"],
  ])
})
