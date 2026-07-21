import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  cancelPreparedOrder,
  expirePreparedOrders,
  prepareBackgroundOrder,
} from "../lib/commerce/order-service.ts"
import { COMMERCE_ERROR_CODES, CommerceError } from "../lib/commerce/errors.ts"

const PREMIUM_A = "massage-lab-aurora"
const PREMIUM_B = "massage-lab-photon-beam"
const NOW = new Date("2026-07-21T12:00:00.000Z")
const LEGAL_ACCEPTANCE = Object.freeze({
  documentIds: ["terms:current", "privacy:current", "digital-purchases-refunds:current"],
  documentVersions: {
    terms: "current",
    privacy: "current",
    "digital-purchases-refunds": "current",
  },
  acceptedAt: NOW.toISOString(),
  combinedConsentAccepted: true,
})

function uniqueConflict(target = ["userId"]) {
  return Object.assign(new Error("unique constraint failed"), {
    code: "P2002",
    meta: { modelName: "CommerceOrder", target },
  })
}

function createReservationDatabase({
  emailVerified = true,
  productKeys = [PREMIUM_A, PREMIUM_B],
  orderCreateConflict = null,
} = {}) {
  const cart = { id: "cart-1", userId: "user-1", currency: "usd", createdAt: NOW }
  const state = {
    emailVerified,
    cart,
    items: productKeys.map((productKey, index) => ({
      id: "cart-item-" + (index + 1),
      cartId: cart.id,
      productType: "background",
      productKey,
      quantity: 1,
      createdAt: new Date(NOW.getTime() + index),
    })),
    ownerships: [],
    orders: [],
    events: [],
    transactionCalls: 0,
    nextOrderId: 1,
    orderCreateConflict,
  }

  function activeAt(order, now) {
    return ["PREPARING", "AWAITING_PAYMENT"].includes(order.status)
      && order.reservationExpiresAt
      && order.reservationExpiresAt > now
  }

  function copyOrder(order) {
    return { ...order, items: order.items.map((item) => ({ ...item })) }
  }

  function matchesOrder(order, where) {
    if (where.id && order.id !== where.id) return false
    if (where.userId && order.userId !== where.userId) return false
    if (where.OR && !where.OR.some((clause) => (
      (!clause.status || order.status === clause.status)
      && (!clause.reservationExpiresAt?.gt || order.reservationExpiresAt > clause.reservationExpiresAt.gt)
    ))) return false
    if (typeof where.status === "string" && order.status !== where.status) return false
    if (where.status?.in && !where.status.in.includes(order.status)) return false
    if (where.reservationExpiresAt?.gt && !(order.reservationExpiresAt > where.reservationExpiresAt.gt)) return false
    if (where.reservationExpiresAt?.lte && !(order.reservationExpiresAt <= where.reservationExpiresAt.lte)) return false
    return true
  }

  function commitOrder(data) {
    const id = "order-" + state.nextOrderId++
    const order = {
      id,
      publicId: "public-" + id,
      createdAt: new Date(),
      updatedAt: new Date(),
      ...data,
      items: (data.items?.create ?? []).map((item, index) => ({
        id: id + "-item-" + (index + 1),
        orderId: id,
        createdAt: new Date(),
        ...item,
      })),
    }
    state.orders.push(order)
    return order
  }

  const tx = {
    user: {
      async findUnique({ where }) {
        return where.id === "user-1"
          ? { emailVerified: state.emailVerified ? new Date("2026-07-01T00:00:00.000Z") : null }
          : null
      },
    },
    commerceCart: {
      async upsert() {
        return { ...state.cart }
      },
    },
    commerceCartItem: {
      async findMany({ where }) {
        return state.items
          .filter((item) => item.cartId === where.cartId)
          .sort((left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id))
          .map((item) => ({ ...item }))
      },
      async deleteMany({ where }) {
        const before = state.items.length
        const ids = new Set(where.id?.in ?? [])
        state.items = state.items.filter((item) => {
          if (where.cartId && item.cartId !== where.cartId) return true
          if (where.productType && item.productType !== where.productType) return true
          if (where.productKey && item.productKey !== where.productKey) return true
          if (ids.size && !ids.has(item.id)) return true
          return false
        })
        return { count: before - state.items.length }
      },
    },
    backgroundOwnership: {
      async findMany({ where }) {
        const keys = new Set(where.backgroundKey?.in ?? [])
        return state.ownerships.filter((row) => row.userId === where.userId && keys.has(row.backgroundKey))
      },
    },
    commerceOrder: {
      async findFirst({ where }) {
        const order = state.orders.find((candidate) => matchesOrder(candidate, where))
        return order ? copyOrder(order) : null
      },
      async findUnique({ where }) {
        const order = state.orders.find((candidate) => candidate.id === where.id)
        return order ? copyOrder(order) : null
      },
      async findMany({ where }) {
        return state.orders.filter((order) => matchesOrder(order, where)).map(copyOrder)
      },
      async create({ data }) {
        if (state.orderCreateConflict) {
          const conflict = state.orderCreateConflict
          state.orderCreateConflict = null
          if (conflict.commitData) commitOrder(conflict.commitData)
          throw conflict.error
        }
        if (state.orders.some((order) => activeAt(order, NOW))) {
          throw uniqueConflict(["CommerceOrder_one_active_per_user_key"])
        }
        return copyOrder(commitOrder(data))
      },
      async updateMany({ where, data }) {
        let count = 0
        for (const order of state.orders) {
          if (!matchesOrder(order, where)) continue
          Object.assign(order, data, { updatedAt: new Date() })
          count += 1
        }
        return { count }
      },
    },
    commerceEvent: {
      async create({ data }) {
        const event = { id: "event-" + (state.events.length + 1), ...data }
        state.events.push(event)
        return event
      },
    },
  }

  const database = {
    async $transaction(callback, options) {
      state.transactionCalls += 1
      assert.equal(options?.isolationLevel, "Serializable")
      return callback(tx)
    },
  }

  return { database, state, commitOrder }
}

function prepareInput(database, overrides = {}) {
  return {
    prismaClient: database,
    userId: "user-1",
    purchaseCountry: "us",
    legalAcceptance: LEGAL_ACCEPTANCE,
    returnPath: "/account/billing?tab=cart",
    now: NOW,
    ...overrides,
  }
}

async function rejectsWithCode(operation, code) {
  await assert.rejects(operation, (error) => {
    assert.ok(error instanceof CommerceError)
    assert.equal(error.code, code)
    return true
  })
}

describe("background order reservations", () => {
  it("creates one 30-minute reservation with immutable one-dollar item snapshots", async () => {
    const { database, state } = createReservationDatabase()

    const prepared = await prepareBackgroundOrder(prepareInput(database))

    assert.equal(prepared.status, "PREPARING")
    assert.equal(prepared.expiresAt, "2026-07-21T12:30:00.000Z")
    assert.equal(prepared.subtotalAmount, 200)
    assert.equal(prepared.currency, "usd")
    assert.deepEqual(prepared.items.map((item) => item.productKey), [PREMIUM_A, PREMIUM_B])
    assert.ok(prepared.items.every((item) => item.unitAmount === 100 && item.quantity === 1))
    assert.equal(state.orders.length, 1)
    assert.equal(state.items.length, 2, "preparing an order must not clear its cart rows")
    assert.deepEqual(state.orders[0].legalAcceptance, LEGAL_ACCEPTANCE)
    assert.equal(state.orders[0].purchaseCountry, "US")
    assert.equal(state.orders[0].returnPath, "/account/billing")
    assert.equal(state.events[0].eventType, "ORDER_PREPARED")
  })

  it("returns the same active reservation for repeated and concurrent-style double submits", async () => {
    const { database, state } = createReservationDatabase()

    const first = await prepareBackgroundOrder(prepareInput(database))
    state.items.push({
      id: "cart-item-later",
      cartId: "cart-1",
      productType: "background",
      productKey: "massage-lab-vortex",
      quantity: 1,
      createdAt: new Date(NOW.getTime() + 10),
    })
    const repeated = await prepareBackgroundOrder(prepareInput(database))

    assert.equal(repeated.orderId, first.orderId)
    assert.deepEqual(repeated.items.map((item) => item.productKey), [PREMIUM_A, PREMIUM_B])
    assert.equal(state.orders.length, 1)
    assert.equal(state.events.filter((event) => event.eventType === "ORDER_PREPARED").length, 1)
  })

  it("recovers the matching active order after the database partial index wins a race", async () => {
    const rivalData = {
      userId: "user-1",
      status: "PREPARING",
      fulfillmentStatus: "PENDING",
      currency: "usd",
      subtotalCents: 100,
      taxCents: 0,
      totalCents: 100,
      reservationExpiresAt: new Date("2026-07-21T12:30:00.000Z"),
      legalAcceptance: LEGAL_ACCEPTANCE,
      purchaseCountry: "US",
      returnPath: "/",
      items: {
        create: [{
          userId: "user-1",
          productType: "background",
          productKey: PREMIUM_A,
          displayName: "Aurora",
          unitPriceCents: 100,
          quantity: 1,
          allocatedTaxCents: 0,
          lineTotalCents: 100,
          currency: "usd",
          fulfillmentAdapterVersion: "background-v1",
        }],
      },
    }
    const { database, state } = createReservationDatabase({
      productKeys: [PREMIUM_A],
      orderCreateConflict: {
        error: uniqueConflict(["CommerceOrder_one_active_per_user_key"]),
        commitData: rivalData,
      },
    })

    const recovered = await prepareBackgroundOrder(prepareInput(database))

    assert.equal(recovered.orderId, "order-1")
    assert.equal(state.orders.length, 1)
  })

  it("cancels only the user's prepared order, releases its rows, and preserves history", async () => {
    const { database, state } = createReservationDatabase()
    const prepared = await prepareBackgroundOrder(prepareInput(database))

    const canceled = await cancelPreparedOrder({
      prismaClient: database,
      userId: "user-1",
      orderId: prepared.orderId,
      now: new Date("2026-07-21T12:05:00.000Z"),
    })

    assert.equal(canceled.status, "CANCELED")
    assert.equal(state.orders[0].status, "CANCELED")
    assert.equal(state.orders[0].reservationExpiresAt, null)
    assert.equal(state.orders[0].items.length, 2)
    assert.equal(state.items.length, 2)
    assert.equal(state.events.at(-1).eventType, "ORDER_CANCELED")

    const replacement = await prepareBackgroundOrder(prepareInput(database, {
      now: new Date("2026-07-21T12:06:00.000Z"),
    }))
    assert.notEqual(replacement.orderId, prepared.orderId)
    assert.equal(state.orders.length, 2)
  })

  it("expires due reservations without deleting history or touching later reservations", async () => {
    const { database, state, commitOrder } = createReservationDatabase({ productKeys: [PREMIUM_A] })
    const expired = commitOrder({
      userId: "user-1",
      status: "PREPARING",
      reservationExpiresAt: new Date("2026-07-21T11:59:00.000Z"),
      items: { create: [{ userId: "user-1", productType: "background", productKey: PREMIUM_A }] },
    })
    const later = commitOrder({
      userId: "user-2",
      status: "PREPARING",
      reservationExpiresAt: new Date("2026-07-21T12:10:00.000Z"),
      items: { create: [] },
    })
    const awaitingPayment = commitOrder({
      userId: "user-3",
      status: "AWAITING_PAYMENT",
      reservationExpiresAt: new Date("2026-07-21T11:58:00.000Z"),
      items: { create: [] },
    })

    const result = await expirePreparedOrders({ prismaClient: database, now: NOW })

    assert.deepEqual(result.expiredOrderIds, [expired.id])
    assert.equal(state.orders.find((order) => order.id === expired.id).status, "EXPIRED")
    assert.equal(state.orders.find((order) => order.id === expired.id).reservationExpiresAt, null)
    assert.equal(state.orders.find((order) => order.id === later.id).status, "PREPARING")
    assert.equal(state.orders.find((order) => order.id === awaitingPayment.id).status, "AWAITING_PAYMENT")
    assert.equal(
      state.orders.find((order) => order.id === awaitingPayment.id).reservationExpiresAt.toISOString(),
      "2026-07-21T11:58:00.000Z",
    )
    assert.equal(state.orders.length, 3)
    assert.equal(state.events.at(-1).eventType, "ORDER_EXPIRED")
  })

  it("never revives an expired order when the same cart is prepared again", async () => {
    const { database, state } = createReservationDatabase({ productKeys: [PREMIUM_A] })
    const first = await prepareBackgroundOrder(prepareInput(database))
    await expirePreparedOrders({
      prismaClient: database,
      now: new Date("2026-07-21T12:31:00.000Z"),
    })

    const second = await prepareBackgroundOrder(prepareInput(database, {
      now: new Date("2026-07-21T12:31:00.000Z"),
    }))

    assert.notEqual(second.orderId, first.orderId)
    assert.equal(state.orders.find((order) => order.id === first.orderId).status, "EXPIRED")
    assert.equal(state.orders.length, 2)
  })

  it("fails closed for unverified, empty, unconsented, or unsupported-country preparation", async () => {
    const unverified = createReservationDatabase({ emailVerified: false })
    await rejectsWithCode(
      () => prepareBackgroundOrder(prepareInput(unverified.database)),
      COMMERCE_ERROR_CODES.EMAIL_VERIFICATION_REQUIRED,
    )

    const empty = createReservationDatabase({ productKeys: [] })
    await rejectsWithCode(
      () => prepareBackgroundOrder(prepareInput(empty.database)),
      COMMERCE_ERROR_CODES.EMPTY_CART,
    )

    const unconsented = createReservationDatabase()
    await rejectsWithCode(
      () => prepareBackgroundOrder(prepareInput(unconsented.database, {
        legalAcceptance: { ...LEGAL_ACCEPTANCE, combinedConsentAccepted: false },
      })),
      COMMERCE_ERROR_CODES.LEGAL_CONSENT_REQUIRED,
    )

    const unsupported = createReservationDatabase()
    await rejectsWithCode(
      () => prepareBackgroundOrder(prepareInput(unsupported.database, { purchaseCountry: "CA" })),
      COMMERCE_ERROR_CODES.COUNTRY_UNAVAILABLE,
    )
  })

  it("requires document IDs and version entries to be an exact one-to-one set", async () => {
    const invalidEvidence = [
      {
        ...LEGAL_ACCEPTANCE,
        documentVersions: {
          terms: "current",
          "digital-purchases-refunds": "current",
        },
      },
      {
        ...LEGAL_ACCEPTANCE,
        documentVersions: {
          ...LEGAL_ACCEPTANCE.documentVersions,
          "membership-billing-refunds": "current",
        },
      },
      {
        ...LEGAL_ACCEPTANCE,
        documentIds: [
          "terms:current",
          "privacy:stale",
          "digital-purchases-refunds:current",
        ],
      },
    ]

    for (const legalAcceptance of invalidEvidence) {
      const { database } = createReservationDatabase()
      await rejectsWithCode(
        () => prepareBackgroundOrder(prepareInput(database, { legalAcceptance })),
        COMMERCE_ERROR_CODES.LEGAL_CONSENT_REQUIRED,
      )
    }
  })

  it("does not hide unrelated uniqueness failures as successful double submits", async () => {
    for (const target of [["publicId"], ["id", "userId"]]) {
      const { database } = createReservationDatabase({
        orderCreateConflict: { error: uniqueConflict(target) },
      })

      await rejectsWithCode(
        () => prepareBackgroundOrder(prepareInput(database)),
        COMMERCE_ERROR_CODES.UNKNOWN,
      )
    }
  })
})
