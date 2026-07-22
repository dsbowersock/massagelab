import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  addCommerceCartItem,
  getCommerceCartSnapshot,
  removeCommerceCartItem,
} from "../lib/commerce/cart-service.ts"
import { COMMERCE_ERROR_CODES, CommerceError } from "../lib/commerce/errors.ts"

const PREMIUM_A = "massage-lab-aurora"
const PREMIUM_B = "massage-lab-photon-beam"
const PREMIUM_C = "massage-lab-vortex"
const NOW = new Date("2026-07-21T12:00:00.000Z")

function createCartDatabase({ emailVerified = true, subscriptions = [] } = {}) {
  const state = {
    emailVerified,
    subscriptions,
    carts: new Map(),
    items: [],
    ownerships: [],
    orders: [],
    events: [],
    transactionCalls: 0,
    nextCartId: 1,
    nextItemId: 1,
  }

  const tx = {
    user: {
      async findUnique({ where }) {
        return where.id === "user-1"
          ? { emailVerified: state.emailVerified ? new Date("2026-07-01T00:00:00.000Z") : null }
          : null
      },
    },
    membershipSubscription: {
      async findMany() {
        return state.subscriptions
      },
    },
    commerceCart: {
      async upsert({ where, create }) {
        let cart = state.carts.get(where.userId)
        if (!cart) {
          cart = { id: "cart-" + state.nextCartId++, ...create, createdAt: new Date(), currency: "usd" }
          state.carts.set(where.userId, cart)
        }
        return { ...cart }
      },
    },
    commerceCartItem: {
      async findMany({ where }) {
        return state.items
          .filter((item) => item.cartId === where.cartId)
          .sort((left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id))
          .map((item) => ({ ...item }))
      },
      async upsert({ where, create }) {
        const key = where.cartId_productType_productKey
        const existing = state.items.find((item) => (
          item.cartId === key.cartId
          && item.productType === key.productType
          && item.productKey === key.productKey
        ))
        if (existing) return { ...existing }
        const item = {
          id: "item-" + state.nextItemId++,
          ...create,
          createdAt: new Date(Date.now() + state.nextItemId),
        }
        state.items.push(item)
        return { ...item }
      },
      async deleteMany({ where }) {
        const before = state.items.length
        const ids = new Set(where.id?.in ?? [])
        state.items = state.items.filter((item) => {
          if (where.cartId && item.cartId !== where.cartId) return true
          if (where.productType && item.productType !== where.productType) return true
          if (where.productKey && item.productKey !== where.productKey) return true
          if (ids.size > 0 && !ids.has(item.id)) return true
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
      async findMany({ where }) {
        return state.orders
          .filter((order) => (
            (!where.userId || order.userId === where.userId)
            && (!where.status || order.status === where.status || where.status.in?.includes(order.status))
            && (!where.reservationExpiresAt?.lte || order.reservationExpiresAt <= where.reservationExpiresAt.lte)
          ))
          .map((order) => ({ ...order }))
      },
      async updateMany({ where, data }) {
        let count = 0
        for (const order of state.orders) {
          const statusMatches = typeof where.status === "string"
            ? order.status === where.status
            : where.status.in.includes(order.status)
          const expired = order.reservationExpiresAt && order.reservationExpiresAt <= where.reservationExpiresAt.lte
          const idMatches = !where.id || order.id === where.id
          const userMatches = !where.userId || order.userId === where.userId
          if (idMatches && userMatches && statusMatches && expired) {
            Object.assign(order, data)
            count += 1
          }
        }
        return { count }
      },
      async findFirst({ where }) {
        const active = state.orders.find((order) => (
          order.userId === where.userId
          && (
            where.OR
              ? where.OR.some((clause) => (
                  order.status === clause.status
                  && (!clause.reservationExpiresAt?.gt || order.reservationExpiresAt > clause.reservationExpiresAt.gt)
                ))
              : where.status.in.includes(order.status)
                && order.reservationExpiresAt > where.reservationExpiresAt.gt
          )
        ))
        return active ? { ...active, items: active.items.map((item) => ({ ...item })) } : null
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

  function seedCartItem(productKey, { productType = "background", createdAt } = {}) {
    let cart = state.carts.get("user-1")
    if (!cart) {
      cart = { id: "cart-" + state.nextCartId++, userId: "user-1", currency: "usd", createdAt: new Date() }
      state.carts.set("user-1", cart)
    }
    state.items.push({
      id: "item-" + state.nextItemId++,
      cartId: cart.id,
      productType,
      productKey,
      quantity: 1,
      createdAt: createdAt ?? new Date(Date.now() + state.nextItemId),
    })
  }

  return { database, state, seedCartItem }
}

function cartInput(database, overrides = {}) {
  return { prismaClient: database, userId: "user-1", ...overrides }
}

async function rejectsWithCode(operation, code) {
  await assert.rejects(operation, (error) => {
    assert.ok(error instanceof CommerceError)
    assert.equal(error.code, code)
    return true
  })
}

describe("persistent commerce cart", () => {
  it("persists one account cart across independent requests, devices, and sign-out gaps", async () => {
    const { database, state } = createCartDatabase()

    await addCommerceCartItem(cartInput(database, { productType: "background", productKey: PREMIUM_A }))
    const deviceTwo = await getCommerceCartSnapshot(cartInput(database))
    const afterSignOutAndBackIn = await getCommerceCartSnapshot(cartInput(database))

    assert.equal(state.carts.size, 1)
    assert.deepEqual(deviceTwo.items.map((item) => item.productKey), [PREMIUM_A])
    assert.deepEqual(afterSignOutAndBackIn, deviceTwo)
  })

  it("suppresses duplicate adds while retaining distinct items in stable insertion order", async () => {
    const { database } = createCartDatabase()

    await addCommerceCartItem(cartInput(database, { productType: "background", productKey: PREMIUM_B }))
    await addCommerceCartItem(cartInput(database, { productType: "background", productKey: PREMIUM_A }))
    const snapshot = await addCommerceCartItem(cartInput(database, { productType: "background", productKey: PREMIUM_B }))

    assert.deepEqual(snapshot.items.map((item) => item.productKey), [PREMIUM_B, PREMIUM_A])
    assert.equal(snapshot.subtotalAmount, 200)
    assert.equal(snapshot.currency, "usd")
  })

  it("makes removal idempotent without disturbing the remaining item order", async () => {
    const { database } = createCartDatabase()
    for (const productKey of [PREMIUM_A, PREMIUM_B, PREMIUM_C]) {
      await addCommerceCartItem(cartInput(database, { productType: "background", productKey }))
    }

    await removeCommerceCartItem(cartInput(database, { productType: "background", productKey: PREMIUM_B }))
    const repeated = await removeCommerceCartItem(cartInput(database, { productType: "background", productKey: PREMIUM_B }))

    assert.deepEqual(repeated.items.map((item) => item.productKey), [PREMIUM_A, PREMIUM_C])
    assert.equal(repeated.subtotalAmount, 200)
  })

  it("transactionally prunes owned, free, retired, and unknown rows with stable safe notices", async () => {
    const { database, state, seedCartItem } = createCartDatabase({
      subscriptions: [{ status: "active", membershipLevel: "SUPPORTER" }],
    })
    for (const productKey of [
      PREMIUM_A,
      PREMIUM_B,
      "static-gradient",
      "massage-lab-noise-texture-draft",
      "unknown-background",
    ]) {
      seedCartItem(productKey)
    }
    state.ownerships.push({ userId: "user-1", backgroundKey: PREMIUM_A, status: "ACTIVE" })

    const snapshot = await getCommerceCartSnapshot(cartInput(database))

    assert.deepEqual(snapshot.items.map((item) => item.productKey), [PREMIUM_B])
    assert.deepEqual(snapshot.notices, [
      { code: "OWNED_ITEM_REMOVED", productKey: PREMIUM_A },
      { code: "FREE_ITEM_REMOVED", productKey: "static-gradient" },
      { code: "RETIRED_ITEM_REMOVED", productKey: "massage-lab-noise-texture-draft" },
      { code: "UNAVAILABLE_ITEM_REMOVED", productKey: "unknown-background" },
    ])
    assert.equal(snapshot.subtotalAmount, 100, "subscription inclusion must not prune an unowned product")
    assert.equal(state.items.length, 1)
  })

  it("reloads database verification before every read or mutation", async () => {
    const { database, state } = createCartDatabase()
    await addCommerceCartItem(cartInput(database, { productType: "background", productKey: PREMIUM_A }))
    state.emailVerified = false

    await rejectsWithCode(
      () => getCommerceCartSnapshot(cartInput(database)),
      COMMERCE_ERROR_CODES.EMAIL_VERIFICATION_REQUIRED,
    )
    await rejectsWithCode(
      () => removeCommerceCartItem(cartInput(database, { productType: "background", productKey: PREMIUM_A })),
      COMMERCE_ERROR_CODES.EMAIL_VERIFICATION_REQUIRED,
    )
    assert.equal(state.items.length, 1)
  })

  it("keeps bound rows visible and rejects their removal", async () => {
    const { database, state, seedCartItem } = createCartDatabase()
    seedCartItem(PREMIUM_A)
    const expiresAt = new Date("2026-07-21T12:30:00.000Z")
    state.orders.push({
      id: "order-1",
      userId: "user-1",
      status: "PREPARING",
      reservationExpiresAt: expiresAt,
      items: [{ productType: "background", productKey: PREMIUM_A }],
    })

    const snapshot = await getCommerceCartSnapshot(cartInput(database, {
      now: new Date("2026-07-21T12:00:00.000Z"),
    }))
    assert.deepEqual(snapshot.reservedOrder, { orderId: "order-1", expiresAt: expiresAt.toISOString() })

    await rejectsWithCode(
      () => removeCommerceCartItem(cartInput(database, {
        productType: "background",
        productKey: PREMIUM_A,
        now: new Date("2026-07-21T12:00:00.000Z"),
      })),
      COMMERCE_ERROR_CODES.RESERVED_CART,
    )
    assert.equal(state.items.length, 1)
  })

  it("does not release an overdue awaiting-payment reservation during a cart read", async () => {
    const { database, state, seedCartItem } = createCartDatabase()
    seedCartItem(PREMIUM_A)
    const expiresAt = new Date("2026-07-21T11:59:00.000Z")
    state.orders.push({
      id: "order-awaiting",
      userId: "user-1",
      status: "AWAITING_PAYMENT",
      reservationExpiresAt: expiresAt,
      items: [{ productType: "background", productKey: PREMIUM_A }],
    })

    const snapshot = await getCommerceCartSnapshot(cartInput(database, { now: NOW }))

    assert.equal(state.orders[0].status, "AWAITING_PAYMENT")
    assert.equal(state.orders[0].reservationExpiresAt, expiresAt)
    assert.deepEqual(snapshot.reservedOrder, {
      orderId: "order-awaiting",
      expiresAt: expiresAt.toISOString(),
    })
    assert.equal(state.events.length, 0)
  })

  it("records one audit event for an idempotent cart-triggered preparing-order expiry", async () => {
    const { database, state } = createCartDatabase()
    state.orders.push({
      id: "order-expired",
      userId: "user-1",
      status: "PREPARING",
      reservationExpiresAt: new Date("2026-07-21T11:59:00.000Z"),
      items: [],
    })

    await getCommerceCartSnapshot(cartInput(database, { now: NOW }))
    await getCommerceCartSnapshot(cartInput(database, { now: NOW }))

    assert.equal(state.orders[0].status, "EXPIRED")
    assert.equal(state.orders[0].reservationExpiresAt, null)
    assert.deepEqual(state.events.map((event) => ({
      eventType: event.eventType,
      orderId: event.orderId,
      fromState: event.fromState,
      toState: event.toState,
    })), [{
      eventType: "ORDER_EXPIRED",
      orderId: "order-expired",
      fromState: "PREPARING",
      toState: "EXPIRED",
    }])
  })
})
