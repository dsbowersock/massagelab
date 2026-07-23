import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { fulfillBackgroundPurchase } from "../lib/commerce/fulfillment-service.ts"

const clone = globalThis.structuredClone

function orderItem(id, productKey, overrides = {}) {
  return {
    id,
    orderId: "order_1",
    userId: "user_1",
    productType: "background",
    productKey,
    displayName: productKey === "aurora" ? "Aurora" : "Vortex",
    unitPriceCents: 100,
    quantity: 1,
    allocatedTaxCents: 0,
    lineTotalCents: 100,
    currency: "usd",
    fulfillmentAdapterVersion: "background-v1",
    fulfillmentStatus: "PENDING",
    fulfilledAt: null,
    ...overrides,
  }
}

function initialState() {
  return {
    order: {
      id: "order_1",
      userId: "user_1",
      status: "AWAITING_PAYMENT",
      fulfillmentStatus: "PENDING",
      currency: "usd",
      subtotalCents: 200,
      taxCents: 0,
      totalCents: 200,
      stripeCheckoutSessionId: null,
      reservationExpiresAt: new Date("2026-07-21T15:30:00.000Z"),
      purchaseCountry: "US",
      fulfillmentStartedAt: null,
      fulfilledAt: null,
      failureCode: null,
      items: [orderItem("item_1", "aurora"), orderItem("item_2", "vortex")],
    },
    stripeCustomer: { userId: "user_1", stripeCustomerId: "cus_1" },
    payments: [],
    ownerships: [],
    receipts: [],
    cart: { id: "cart_1", userId: "user_1" },
    cartItems: [
      { id: "cart_item_1", cartId: "cart_1", productType: "background", productKey: "aurora" },
      { id: "cart_item_2", cartId: "cart_1", productType: "background", productKey: "vortex" },
    ],
    events: [],
  }
}

function matchesValue(actual, expected) {
  if (expected && typeof expected === "object" && !Array.isArray(expected)) {
    if ("in" in expected) return expected.in.includes(actual)
    if ("notIn" in expected) return !expected.notIn.includes(actual)
  }
  return actual === expected
}

function createPrismaDouble(seed = initialState()) {
  const state = clone(seed)
  const tx = {
    commerceWebhookReceipt: {
      findUnique: async ({ where }) => state.receipts.find((receipt) => (
        receipt.provider === where.provider_providerEventId.provider
        && receipt.providerEventId === where.provider_providerEventId.providerEventId
      )) ?? null,
      create: async ({ data }) => {
        if (state.receipts.some((receipt) => (
          receipt.provider === data.provider && receipt.providerEventId === data.providerEventId
        ))) {
          throw Object.assign(new Error("duplicate receipt"), {
            code: "P2002",
            meta: { modelName: "CommerceWebhookReceipt", target: ["provider", "providerEventId"] },
          })
        }
        const receipt = { id: "receipt_" + (state.receipts.length + 1), ...clone(data) }
        state.receipts.push(receipt)
        return receipt
      },
      update: async ({ where, data }) => {
        const receipt = state.receipts.find((candidate) => candidate.id === where.id)
        Object.assign(receipt, clone(data))
        return receipt
      },
    },
    commerceOrder: {
      findUnique: async ({ where }) => {
        if (where.id && where.id !== state.order?.id) return null
        return state.order ? clone(state.order) : null
      },
      updateMany: async ({ where, data }) => {
        if (!state.order || (where.id && where.id !== state.order.id)) return { count: 0 }
        for (const [key, expected] of Object.entries(where)) {
          if (key === "id") continue
          if (!matchesValue(state.order[key], expected)) return { count: 0 }
        }
        if (state.loseNextOrderTransition) {
          state.loseNextOrderTransition = false
          state.order.status = "PAID"
          state.order.fulfillmentStatus = "FULFILLED"
          return { count: 0 }
        }
        Object.assign(state.order, clone(data))
        return { count: 1 }
      },
    },
    stripeCustomer: {
      findUnique: async ({ where }) => (
        where.userId === state.stripeCustomer?.userId ? clone(state.stripeCustomer) : null
      ),
    },
    commercePayment: {
      upsert: async ({ where, create, update }) => {
        const index = state.payments.findIndex((payment) => (
          payment.stripePaymentIntentId === where.stripePaymentIntentId
        ))
        if (index >= 0) {
          Object.assign(state.payments[index], clone(update))
          return clone(state.payments[index])
        }
        const payment = { id: "payment_" + (state.payments.length + 1), ...clone(create) }
        state.payments.push(payment)
        return clone(payment)
      },
    },
    backgroundOwnership: {
      findMany: async ({ where }) => state.ownerships.filter((ownership) => (
        ownership.userId === where.userId
        && where.backgroundKey.in.includes(ownership.backgroundKey)
      )).map((ownership) => clone(ownership)),
      createMany: async ({ data }) => {
        state.ownerships.push(...data.map((ownership, index) => ({
          id: "ownership_" + (state.ownerships.length + index + 1),
          ...clone(ownership),
        })))
        return { count: data.length }
      },
    },
    commerceOrderItem: {
      updateMany: async ({ where, data }) => {
        let count = 0
        for (const item of state.order?.items ?? []) {
          if (where.orderId && item.orderId !== where.orderId) continue
          if (typeof where.id === "string" && item.id !== where.id) continue
          if (where.id?.in && !where.id.in.includes(item.id)) continue
          if (where.fulfillmentStatus && !matchesValue(item.fulfillmentStatus, where.fulfillmentStatus)) continue
          if (
            where.allocatedTaxCents !== undefined
            && !matchesValue(item.allocatedTaxCents, where.allocatedTaxCents)
          ) continue
          if (
            where.lineTotalCents !== undefined
            && !matchesValue(item.lineTotalCents, where.lineTotalCents)
          ) continue
          Object.assign(item, clone(data))
          count += 1
        }
        return { count }
      },
    },
    commerceCart: {
      findUnique: async ({ where }) => (
        where.userId === state.cart?.userId ? clone(state.cart) : null
      ),
    },
    commerceCartItem: {
      deleteMany: async ({ where }) => {
        const before = state.cartItems.length
        state.cartItems = state.cartItems.filter((item) => !(
          item.cartId === where.cartId
          && where.OR.some((key) => (
            item.productType === key.productType && item.productKey === key.productKey
          ))
        ))
        return { count: before - state.cartItems.length }
      },
    },
    commerceEvent: {
      create: async ({ data }) => {
        const event = { id: "commerce_event_" + (state.events.length + 1), ...clone(data) }
        state.events.push(event)
        return event
      },
    },
  }

  return {
    state,
    prismaClient: {
      $transaction: async (callback) => {
        const snapshot = clone(state)
        try {
          return await callback(tx)
        } catch (error) {
          for (const key of Object.keys(state)) delete state[key]
          Object.assign(state, snapshot)
          throw error
        }
      },
    },
  }
}

function lineItem(productKey, displayName) {
  return {
    id: "li_" + productKey,
    object: "item",
    amount_discount: 0,
    amount_subtotal: 100,
    amount_tax: 0,
    amount_total: 100,
    currency: "usd",
    description: displayName,
    quantity: 1,
    price: {
      id: "price_" + productKey,
      object: "price",
      active: true,
      currency: "usd",
      unit_amount: 100,
      product: {
        id: "prod_" + productKey,
        object: "product",
        active: true,
        name: displayName,
        tax_code: "txcd_10202003",
        metadata: { productType: "background", productKey, taxCode: "txcd_10202003" },
      },
      tax_behavior: "exclusive",
    },
  }
}

function paidSession(overrides = {}) {
  const metadata = {
    purpose: "background_purchase",
    orderId: "order_1",
    userId: "user_1",
    schemaVersion: "2",
    taxMode: "stripe",
    taxCode: "txcd_10202003",
    taxBehavior: "exclusive",
  }
  return {
    id: "cs_1",
    object: "checkout.session",
    created: 1784646000,
    mode: "payment",
    status: "complete",
    payment_status: "paid",
    automatic_tax: { enabled: true, status: "complete" },
    customer: "cus_1",
    customer_details: {
      address: { country: "US" },
      email: "buyer@example.test",
      name: "Buyer",
    },
    currency: "usd",
    amount_subtotal: 200,
    amount_total: 200,
    total_details: { amount_discount: 0, amount_shipping: 0, amount_tax: 0 },
    payment_intent: {
      id: "pi_1",
      object: "payment_intent",
      status: "succeeded",
      amount: 200,
      amount_received: 200,
      currency: "usd",
      customer: "cus_1",
      metadata,
    },
    metadata,
    line_items: {
      object: "list",
      data: [lineItem("aurora", "Aurora"), lineItem("vortex", "Vortex")],
      has_more: false,
      url: "/v1/checkout/sessions/cs_1/line_items",
    },
    ...overrides,
  }
}

async function fulfill(prismaClient, eventId, session = paidSession(), eventType = "checkout.session.completed") {
  return fulfillBackgroundPurchase({
    prismaClient,
    eventId,
    eventType,
    eventCreatedAt: new Date("2026-07-21T15:00:00.000Z"),
    session,
  })
}

describe("background purchase fulfillment", () => {
  it("atomically binds and fulfills a valid paid session", async () => {
    const { prismaClient, state } = createPrismaDouble()

    const result = await fulfill(prismaClient, "evt_paid")

    assert.deepEqual(result, { orderId: "order_1", userId: "user_1", status: "FULFILLED", changed: true })
    assert.equal(state.order.stripeCheckoutSessionId, "cs_1")
    assert.equal(state.order.status, "PAID")
    assert.equal(state.order.fulfillmentStatus, "FULFILLED")
    assert.deepEqual(state.order.items.map((item) => item.fulfillmentStatus), ["FULFILLED", "FULFILLED"])
    assert.deepEqual(state.ownerships.map((ownership) => [ownership.backgroundKey, ownership.source]), [
      ["aurora", "PURCHASE"],
      ["vortex", "PURCHASE"],
    ])
    assert.deepEqual(state.payments.map((payment) => payment.status), ["SUCCEEDED"])
    assert.equal(state.receipts.length, 1)
    assert.equal(state.receipts[0].processedAt instanceof Date, true)
    assert.deepEqual(state.cartItems, [])
  })

  it("atomically snapshots nonzero Stripe Tax totals before paid fulfillment", async () => {
    const { prismaClient, state } = createPrismaDouble()
    const session = paidSession()
    session.line_items.data[0].amount_tax = 8
    session.line_items.data[0].amount_total = 108
    session.line_items.data[1].amount_tax = 7
    session.line_items.data[1].amount_total = 107
    session.total_details.amount_tax = 15
    session.amount_total = 215
    session.payment_intent.amount = 215
    session.payment_intent.amount_received = 215

    const result = await fulfill(prismaClient, "evt_taxed", session)

    assert.equal(result.status, "FULFILLED")
    assert.equal(state.order.taxCents, 15)
    assert.equal(state.order.totalCents, 215)
    assert.deepEqual(
      state.order.items.map((item) => [item.allocatedTaxCents, item.lineTotalCents]),
      [[8, 108], [7, 107]],
    )
    assert.equal(state.payments[0].amountCents, 215)
    assert.equal(
      state.events.filter((event) => event.eventType === "BACKGROUND_ORDER_TAX_RECONCILED").length,
      1,
    )
  })

  for (const [name, change] of [
    ["disabled automatic tax", (session) => { session.automatic_tax.enabled = false }],
    ["incomplete automatic tax", (session) => { session.automatic_tax.status = "requires_location_inputs" }],
    ["changed product tax code", (session) => { session.line_items.data[0].price.product.tax_code = "txcd_other" }],
    ["unsupported discount", (session) => { session.total_details.amount_discount = 1 }],
  ]) {
    it("requires review without ownership for " + name, async () => {
      const { prismaClient, state } = createPrismaDouble()
      const session = paidSession()
      change(session)

      const result = await fulfill(prismaClient, "evt_tax_" + name.replaceAll(" ", "_"), session)

      assert.equal(result.status, "REVIEW_REQUIRED")
      assert.equal(state.order.status, "REVIEW_REQUIRED")
      assert.equal(state.order.taxCents, 0)
      assert.equal(state.ownerships.length, 0)
    })
  }

  it("returns the committed result for repeated event delivery", async () => {
    const { prismaClient, state } = createPrismaDouble()

    await fulfill(prismaClient, "evt_paid")
    const before = clone(state)
    const result = await fulfill(prismaClient, "evt_paid")

    assert.equal(result.status, "FULFILLED")
    assert.equal(result.changed, false)
    assert.deepEqual(state, before)
  })

  it("records a second receipt without duplicating fulfillment for the same session", async () => {
    const { prismaClient, state } = createPrismaDouble()

    await fulfill(prismaClient, "evt_paid_1")
    const result = await fulfill(prismaClient, "evt_paid_2")

    assert.equal(result.changed, false)
    assert.equal(state.receipts.length, 2)
    assert.equal(state.ownerships.length, 2)
    assert.equal(state.events.filter((event) => event.eventType === "BACKGROUND_PURCHASE_FULFILLED").length, 1)
  })

  it("does not let late failed or expired events regress a paid fulfilled order", async () => {
    const { prismaClient, state } = createPrismaDouble()
    await fulfill(prismaClient, "evt_succeeded", paidSession(), "checkout.session.async_payment_succeeded")

    const unpaid = paidSession({ payment_status: "unpaid" })
    await fulfill(prismaClient, "evt_failed", unpaid, "checkout.session.async_payment_failed")
    await fulfill(prismaClient, "evt_expired", { ...unpaid, status: "expired" }, "checkout.session.expired")

    assert.equal(state.order.status, "PAID")
    assert.equal(state.order.fulfillmentStatus, "FULFILLED")
    assert.deepEqual(state.payments.map((payment) => payment.status), ["SUCCEEDED"])
    assert.equal(state.ownerships.length, 2)
  })

  it("allows a paid async success to recover an earlier payment-failed order", async () => {
    const { prismaClient, state } = createPrismaDouble()
    await fulfill(
      prismaClient,
      "evt_failed",
      paidSession({ payment_status: "unpaid" }),
      "checkout.session.async_payment_failed",
    )
    assert.equal(state.order.status, "PAYMENT_FAILED")

    await fulfill(
      prismaClient,
      "evt_succeeded",
      paidSession(),
      "checkout.session.async_payment_succeeded",
    )

    assert.equal(state.order.status, "PAID")
    assert.equal(state.order.fulfillmentStatus, "FULFILLED")
  })

  it("converges failed and expired delivery orders on payment failed", async () => {
    const unpaid = paidSession({ payment_status: "unpaid" })
    const first = createPrismaDouble()
    await fulfill(first.prismaClient, "evt_failed_first", unpaid, "checkout.session.async_payment_failed")
    await fulfill(
      first.prismaClient,
      "evt_expired_second",
      { ...unpaid, status: "expired" },
      "checkout.session.expired",
    )

    const second = createPrismaDouble()
    await fulfill(
      second.prismaClient,
      "evt_expired_first",
      { ...unpaid, status: "expired" },
      "checkout.session.expired",
    )
    await fulfill(second.prismaClient, "evt_failed_second", unpaid, "checkout.session.async_payment_failed")

    assert.equal(first.state.order.status, "PAYMENT_FAILED")
    assert.equal(second.state.order.status, "PAYMENT_FAILED")
  })

  it("expires a trusted unpaid Session without final customer or payment details", async () => {
    const { prismaClient, state } = createPrismaDouble()
    const session = paidSession({
      status: "expired",
      payment_status: "unpaid",
      customer_details: null,
      payment_intent: null,
    })

    const result = await fulfill(
      prismaClient,
      "evt_expired_without_details",
      session,
      "checkout.session.expired",
    )

    assert.equal(result.status, "EXPIRED")
    assert.equal(result.changed, true)
    assert.equal(state.order.status, "EXPIRED")
    assert.equal(state.order.fulfillmentStatus, "PENDING")
    assert.equal(state.order.stripeCheckoutSessionId, "cs_1")
    assert.equal(state.order.reservationExpiresAt, null)
    assert.equal(state.ownerships.length, 0)
    assert.equal(state.payments.length, 0)
  })

  it("does not let a late completed-pending event revive a failed order", async () => {
    const { prismaClient, state } = createPrismaDouble()
    const unpaid = paidSession({ payment_status: "unpaid" })
    await fulfill(prismaClient, "evt_failed_first", unpaid, "checkout.session.async_payment_failed")
    await fulfill(prismaClient, "evt_pending_late", unpaid, "checkout.session.completed")

    assert.equal(state.order.status, "PAYMENT_FAILED")
  })

  it("does not downgrade payment when an unpaid transition loses to paid fulfillment", async () => {
    const seed = initialState()
    seed.loseNextOrderTransition = true
    seed.payments.push({
      id: "payment_1",
      orderId: "order_1",
      stripePaymentIntentId: "pi_1",
      status: "SUCCEEDED",
      amountCents: 200,
      currency: "usd",
      paidAt: new Date("2026-07-21T15:00:00.000Z"),
      failureCode: null,
    })
    const { prismaClient, state } = createPrismaDouble(seed)

    await fulfill(
      prismaClient,
      "evt_lost_unpaid",
      paidSession({ payment_status: "unpaid" }),
      "checkout.session.async_payment_failed",
    )

    assert.equal(state.order.status, "PAID")
    assert.equal(state.payments[0].status, "SUCCEEDED")
  })

  it("acknowledges an unknown explicit purpose without domain mutation", async () => {
    const { prismaClient, state } = createPrismaDouble()
    const result = await fulfill(prismaClient, "evt_unknown", paidSession({
      metadata: { purpose: "unexpected_flow", orderId: "order_1", userId: "user_1", schemaVersion: "2" },
    }))

    assert.equal(result.status, "IGNORED")
    assert.equal(state.order.status, "AWAITING_PAYMENT")
    assert.equal(state.ownerships.length, 0)
  })

  it("acknowledges an unknown order without mutating another order", async () => {
    const { prismaClient, state } = createPrismaDouble()
    const result = await fulfill(prismaClient, "evt_unknown_order", paidSession({
      metadata: { purpose: "background_purchase", orderId: "order_other", userId: "user_1", schemaVersion: "2" },
    }))

    assert.equal(result.status, "IGNORED")
    assert.equal(state.order.status, "AWAITING_PAYMENT")
    assert.equal(state.ownerships.length, 0)
  })

  for (const [name, change] of [
    ["user metadata", (session) => { session.metadata.userId = "user_other" }],
    ["customer", (session) => { session.customer = "cus_other" }],
    ["currency", (session) => { session.currency = "cad" }],
    ["total", (session) => { session.amount_total = 199 }],
    ["item key", (session) => { session.line_items.data[0].price.product.metadata.productKey = "other" }],
    ["line amount", (session) => { session.line_items.data[0].amount_total = 99 }],
    ["purchase country", (session) => { session.customer_details.address.country = "CA" }],
  ]) {
    it("moves the known order to review without ownership when " + name + " mismatches", async () => {
      const { prismaClient, state } = createPrismaDouble()
      const session = paidSession()
      change(session)

      const result = await fulfill(prismaClient, "evt_" + name.replaceAll(" ", "_"), session)

      assert.equal(result.status, "REVIEW_REQUIRED")
      assert.equal(state.order.status, "REVIEW_REQUIRED")
      assert.equal(state.order.fulfillmentStatus, "FAILED")
      assert.equal(state.ownerships.length, 0)
      assert.equal(state.cartItems.length, 2)
    })
  }

  it("preserves credit ownership conflicts and avoids partial purchase fulfillment", async () => {
    const seed = initialState()
    seed.ownerships.push({
      id: "ownership_credit",
      userId: "user_1",
      backgroundKey: "aurora",
      source: "CREDIT_REDEMPTION",
      sourceCreditEntryId: "credit_entry_1",
      sourceOrderItemId: null,
      status: "ACTIVE",
    })
    const { prismaClient, state } = createPrismaDouble(seed)

    const result = await fulfill(prismaClient, "evt_credit_conflict")

    assert.equal(result.status, "REVIEW_REQUIRED")
    assert.equal(state.order.status, "REVIEW_REQUIRED")
    assert.equal(state.ownerships.length, 1)
    assert.equal(state.ownerships[0].source, "CREDIT_REDEMPTION")
    assert.equal(state.order.items[0].fulfillmentStatus, "FAILED")
    assert.equal(state.order.items[1].fulfillmentStatus, "PENDING")
    assert.equal(state.payments[0].status, "SUCCEEDED")
  })

  it("marks review before granting anything when one item cannot use the fulfillment adapter", async () => {
    const seed = initialState()
    seed.order.items[1].fulfillmentAdapterVersion = "unsupported-v2"
    const { prismaClient, state } = createPrismaDouble(seed)

    const result = await fulfill(prismaClient, "evt_bad_adapter")

    assert.equal(result.status, "REVIEW_REQUIRED")
    assert.equal(state.order.status, "REVIEW_REQUIRED")
    assert.equal(state.ownerships.length, 0)
    assert.deepEqual(state.order.items.map((item) => item.fulfillmentStatus), ["PENDING", "FAILED"])
  })
})
