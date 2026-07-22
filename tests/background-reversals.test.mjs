import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { it } from "node:test"
import {
  applyStripeDisputeEvent,
  applyStripeRefundEvent,
  initiateBackgroundRefund,
  transitionRetiredBackgroundOwnership,
} from "../lib/commerce/reversal-service.ts"

it("records exact refundable items before the processor call", async () => {
  const calls = []
  const state = {
    refund: null,
    order: {
      id: "order_1", userId: "user_1", status: "PAID", currency: "usd",
      items: [
        { id: "item_1", orderId: "order_1", lineTotalCents: 100, currency: "usd", refundItems: [], ownership: { id: "own_1", source: "PURCHASE", status: "ACTIVE" } },
        { id: "item_2", orderId: "order_1", lineTotalCents: 100, currency: "usd", refundItems: [], ownership: { id: "own_2", source: "PURCHASE", status: "ACTIVE" } },
      ],
      payments: [{ id: "payment_1", status: "SUCCEEDED", stripePaymentIntentId: "pi_1", amountCents: 200, currency: "usd" }],
    },
  }
  const tx = {
    commerceOrder: { findUnique: async () => structuredClone(state.order) },
    commerceRefund: {
      create: async ({ data }) => {
        state.refund = { id: "refund_1", status: "PENDING", ...structuredClone(data), items: structuredClone(data.items.create) }
        return structuredClone(state.refund)
      },
      update: async ({ data }) => Object.assign(state.refund, structuredClone(data)),
    },
    backgroundOwnership: {
      updateMany: async ({ where, data }) => {
        const ownership = state.order.items.find((item) => item.ownership.id === where.id)?.ownership
        if (!ownership || ownership.source !== where.source || ownership.status !== where.status) return { count: 0 }
        Object.assign(ownership, structuredClone(data))
        return { count: 1 }
      },
    },
    commerceEvent: { create: async () => ({ id: "event_1" }) },
  }
  const prismaClient = {
    $transaction: async (callback) => {
      calls.push("transaction:start")
      const result = await callback(tx)
      calls.push("transaction:end")
      return result
    },
  }

  const result = await initiateBackgroundRefund({
    prismaClient, orderId: "order_1", orderItemIds: ["item_1"], actorId: "admin_1", reasonCode: "DUPLICATE_CHARGE",
    createProcessorRefund: async (request) => {
      calls.push("stripe:create")
      assert.equal(state.refund.amountCents, 100)
      assert.deepEqual(state.refund.items.map((item) => item.orderItemId), ["item_1"])
      assert.equal(state.order.items[0].ownership.status, "REFUND_PENDING")
      assert.equal(request.idempotencyKey, "background-refund:refund_1")
      return { id: "re_1", status: "pending" }
    },
  })

  assert.deepEqual(calls, ["transaction:start", "transaction:end", "stripe:create", "transaction:start", "transaction:end"])
  assert.equal(result.amountCents, 100)
  assert.equal(state.order.items[1].ownership.status, "ACTIVE")
})

it("keeps an ambiguous processor outcome pending without retrying", async () => {
  let processorCalls = 0
  const state = {
    refund: null,
    order: {
      id: "order_1", userId: "user_1", status: "PAID", currency: "usd",
      items: [{ id: "item_1", orderId: "order_1", lineTotalCents: 100, currency: "usd", refundItems: [], ownership: { id: "own_1", source: "PURCHASE", status: "ACTIVE" } }],
      payments: [{ id: "payment_1", status: "SUCCEEDED", stripePaymentIntentId: "pi_1", amountCents: 100, currency: "usd" }],
    },
  }
  const tx = {
    commerceOrder: { findUnique: async () => structuredClone(state.order) },
    commerceRefund: { create: async ({ data }) => (state.refund = { id: "refund_1", ...structuredClone(data) }) },
    backgroundOwnership: { updateMany: async ({ data }) => { Object.assign(state.order.items[0].ownership, structuredClone(data)); return { count: 1 } } },
    commerceEvent: { create: async () => ({ id: "event_1" }) },
  }
  const result = await initiateBackgroundRefund({
    prismaClient: { $transaction: async (callback) => callback(tx) },
    orderId: "order_1",
    orderItemIds: ["item_1"],
    actorId: "admin_1",
    reasonCode: "NON_DELIVERY",
    createProcessorRefund: async () => { processorCalls += 1; throw new Error("connection reset after write") },
  })

  assert.equal(processorCalls, 1)
  assert.equal(result.status, "PENDING")
  assert.equal(result.reconciliationRequired, true)
  assert.match(state.refund.stripeRefundId, /^pending:/)
  assert.equal(state.order.items[0].ownership.status, "REFUND_PENDING")
})

it("rejects duplicate selected IDs before any processor call", async () => {
  let processorCalls = 0
  const tx = {
    commerceOrder: { findUnique: async () => ({
      id: "order_1", userId: "user_1", status: "PAID", currency: "usd",
      items: [{ id: "item_1", orderId: "order_1", lineTotalCents: 100, currency: "usd", refundItems: [], ownership: { id: "own_1", source: "PURCHASE", status: "ACTIVE" } }],
      payments: [{ id: "payment_1", status: "SUCCEEDED", stripePaymentIntentId: "pi_1", amountCents: 100, currency: "usd" }],
    }) },
  }
  await assert.rejects(
    initiateBackgroundRefund({
      prismaClient: { $transaction: async (callback) => callback(tx) },
      orderId: "order_1",
      orderItemIds: ["item_1", "item_1"],
      actorId: "admin_1",
      reasonCode: "DUPLICATE_CHARGE",
      createProcessorRefund: async () => { processorCalls += 1; return { id: "re_impossible" } },
    }),
    /distinct refundable order items/i,
  )
  assert.equal(processorCalls, 0)
})

function createRetirementDouble({ ownership = { id: "own_1", userId: "user_1", backgroundKey: "aurora", source: "PURCHASE", status: "ACTIVE", sourceOrderItemId: "item_1" } } = {}) {
  const state = {
    ownership: ownership ? structuredClone(ownership) : null,
    wallet: { id: "wallet_1", userId: "user_1", balance: 0, version: 0 },
    entries: [],
    events: [],
  }
  const tx = {
    backgroundOwnership: {
      findUnique: async () => state.ownership ? structuredClone(state.ownership) : null,
      updateMany: async ({ where, data }) => {
        if (!state.ownership || state.ownership.id !== where.id || state.ownership.status !== where.status) return { count: 0 }
        Object.assign(state.ownership, structuredClone(data))
        return { count: 1 }
      },
    },
    backgroundCreditEntry: {
      findUnique: async ({ where }) => state.entries.find((entry) => entry.idempotencyKey === where.idempotencyKey) ?? null,
      create: async ({ data }) => {
        const entry = { id: `entry_${state.entries.length + 1}`, ...structuredClone(data) }
        state.entries.push(entry)
        return structuredClone(entry)
      },
    },
    backgroundCreditWallet: {
      findUnique: async () => structuredClone(state.wallet),
      updateMany: async ({ where, data }) => {
        if (state.wallet.id !== where.id || state.wallet.version !== where.version) return { count: 0 }
        state.wallet.balance += data.balance.increment
        state.wallet.version += data.version.increment
        return { count: 1 }
      },
    },
    commerceEvent: { create: async ({ data }) => state.events.push(structuredClone(data)) },
  }
  return { state, prismaClient: { $transaction: async (callback) => callback(tx) } }
}

it("retires active ownership and grants exactly one replacement credit", async () => {
  const { prismaClient, state } = createRetirementDouble()
  const input = { prismaClient, userId: "user_1", backgroundKey: "aurora", transition: "RETIRED", reasonCode: "LICENSE_RETIRED" }

  const first = await transitionRetiredBackgroundOwnership(input)
  const replay = await transitionRetiredBackgroundOwnership(input)

  assert.equal(first.changed, true)
  assert.equal(replay.changed, false)
  assert.equal(state.ownership.status, "RETIRED")
  assert.equal(state.wallet.balance, 1)
  assert.equal(state.entries.length, 1)
  assert.equal(state.entries[0].type, "RETIREMENT_REPLACEMENT")
  assert.equal(state.entries[0].idempotencyKey, "background-credit:retirement-replacement:own_1")
  assert.equal(state.events.length, 1)
})

it("does not compensate unowned, legal-refund, or free-conversion cases", async () => {
  const unowned = createRetirementDouble({ ownership: null })
  const unownedResult = await transitionRetiredBackgroundOwnership({ prismaClient: unowned.prismaClient, userId: "user_1", backgroundKey: "aurora", transition: "RETIRED", reasonCode: "LICENSE_RETIRED" })
  assert.equal(unownedResult.changed, false)
  assert.equal(unowned.state.wallet.balance, 0)

  for (const transition of ["LEGAL_REFUND_OVERRIDE", "BECAME_FREE"]) {
    const scenario = createRetirementDouble()
    const result = await transitionRetiredBackgroundOwnership({ prismaClient: scenario.prismaClient, userId: "user_1", backgroundKey: "aurora", transition, reasonCode: transition })
    assert.equal(result.changed, false)
    assert.equal(result.requiresRefund, transition === "LEGAL_REFUND_OVERRIDE")
    assert.equal(scenario.state.ownership.status, "ACTIVE")
    assert.equal(scenario.state.wallet.balance, 0)
    assert.equal(scenario.state.entries.length, 0)
  }
})

function createDisputeDouble() {
  const state = {
    payment: { id: "payment_1", orderId: "order_1", stripePaymentIntentId: "pi_1", amountCents: 200, currency: "usd" },
    order: { id: "order_1", userId: "user_1", items: [{ id: "item_1" }, { id: "item_2" }] },
    ownerships: [
      { id: "own_1", sourceOrderItemId: "item_1", source: "PURCHASE", status: "ACTIVE" },
      { id: "own_2", sourceOrderItemId: "item_2", source: "PURCHASE", status: "ACTIVE" },
      { id: "credit_1", sourceOrderItemId: null, source: "CREDIT_REDEMPTION", status: "ACTIVE" },
    ],
    dispute: null,
    receipts: [],
    events: [],
  }
  const tx = {
    commerceWebhookReceipt: {
      findUnique: async ({ where }) => state.receipts.find((receipt) => receipt.providerEventId === where.provider_providerEventId.providerEventId) ?? null,
      create: async ({ data }) => {
        const receipt = { id: `receipt_${state.receipts.length + 1}`, ...structuredClone(data) }
        state.receipts.push(receipt)
        return structuredClone(receipt)
      },
      update: async ({ where, data }) => Object.assign(state.receipts.find((receipt) => receipt.id === where.id), structuredClone(data)),
    },
    commercePayment: {
      findUnique: async () => ({
        ...structuredClone(state.payment),
        order: { ...structuredClone(state.order), items: state.order.items.map((item) => ({
          ...item,
          ownership: structuredClone(state.ownerships.find((ownership) => ownership.sourceOrderItemId === item.id)),
        })) },
      }),
    },
    commerceDispute: {
      findUnique: async () => state.dispute ? structuredClone(state.dispute) : null,
      create: async ({ data }) => {
        state.dispute = { id: "dispute_1", ...structuredClone(data) }
        return structuredClone(state.dispute)
      },
      updateMany: async ({ where, data }) => {
        if (!state.dispute || state.dispute.id !== where.id || (where.updatedAt && state.dispute.updatedAt !== where.updatedAt)) return { count: 0 }
        Object.assign(state.dispute, structuredClone(data))
        return { count: 1 }
      },
    },
    backgroundOwnership: {
      updateMany: async ({ where, data }) => {
        const selected = state.ownerships.filter((ownership) => {
          const itemMatches = where.sourceOrderItemId?.in ? where.sourceOrderItemId.in.includes(ownership.sourceOrderItemId) : true
          const statusMatches = where.status?.in ? where.status.in.includes(ownership.status) : ownership.status === where.status
          return ownership.source === where.source && itemMatches && statusMatches
        })
        selected.forEach((ownership) => Object.assign(ownership, structuredClone(data)))
        return { count: selected.length }
      },
    },
    commerceEvent: { create: async ({ data }) => state.events.push(structuredClone(data)) },
  }
  return { state, prismaClient: { $transaction: async (callback) => callback(tx) } }
}

it("an opened dispute suspends only purchase ownerships from the payment", async () => {
  const { prismaClient, state } = createDisputeDouble()

  await applyStripeDisputeEvent({
    prismaClient,
    eventId: "evt_dispute_open",
    eventType: "charge.dispute.created",
    processorCreatedAt: 1_784_646_200,
    paymentIntentId: "pi_1",
    dispute: { id: "dp_1", status: "needs_response", amount: 200, currency: "usd", reason: "fraudulent" },
  })

  assert.deepEqual(state.ownerships.map((ownership) => ownership.status), ["DISPUTE_SUSPENDED", "DISPUTE_SUSPENDED", "ACTIVE"])
  assert.equal(state.dispute.status, "OPEN")
  assert.equal("accountDisabled" in state, false)
})

it("won and lost disputes restore or revoke only independently eligible ownership", async () => {
  const won = createDisputeDouble()
  await applyStripeDisputeEvent({ prismaClient: won.prismaClient, eventId: "evt_open", eventType: "charge.dispute.created", processorCreatedAt: 1_784_646_200, paymentIntentId: "pi_1", dispute: { id: "dp_1", status: "needs_response", amount: 200, currency: "usd" } })
  won.state.ownerships[1].status = "REFUND_REVOKED"
  await applyStripeDisputeEvent({ prismaClient: won.prismaClient, eventId: "evt_won", eventType: "charge.dispute.closed", processorCreatedAt: 1_784_646_300, paymentIntentId: "pi_1", dispute: { id: "dp_1", status: "won", amount: 200, currency: "usd" } })
  assert.deepEqual(won.state.ownerships.slice(0, 2).map((ownership) => ownership.status), ["ACTIVE", "REFUND_REVOKED"])

  const lost = createDisputeDouble()
  await applyStripeDisputeEvent({ prismaClient: lost.prismaClient, eventId: "evt_lost", eventType: "charge.dispute.closed", processorCreatedAt: 1_784_646_300, paymentIntentId: "pi_1", dispute: { id: "dp_1", status: "lost", amount: 200, currency: "usd" } })
  assert.deepEqual(lost.state.ownerships.slice(0, 2).map((ownership) => ownership.status), ["DISPUTE_REVOKED", "DISPUTE_REVOKED"])
})

for (const reinstatedStatus of ["warning_closed", "prevented"]) {
  it(`treats Stripe ${reinstatedStatus} as funds reinstated`, async () => {
    const scenario = createDisputeDouble()
    await applyStripeDisputeEvent({ prismaClient: scenario.prismaClient, eventId: `evt_open_${reinstatedStatus}`, eventType: "charge.dispute.created", processorCreatedAt: 1_784_646_200, paymentIntentId: "pi_1", dispute: { id: "dp_1", status: "needs_response", amount: 200, currency: "usd" } })
    await applyStripeDisputeEvent({ prismaClient: scenario.prismaClient, eventId: `evt_close_${reinstatedStatus}`, eventType: "charge.dispute.closed", processorCreatedAt: 1_784_646_300, paymentIntentId: "pi_1", dispute: { id: "dp_1", status: reinstatedStatus, amount: 200, currency: "usd" } })
    assert.equal(scenario.state.dispute.status, "WON")
    assert.deepEqual(scenario.state.ownerships.slice(0, 2).map((ownership) => ownership.status), ["ACTIVE", "ACTIVE"])
  })
}

it("ignores replayed and older out-of-order dispute events", async () => {
  const { prismaClient, state } = createDisputeDouble()
  const lost = { prismaClient, eventId: "evt_lost", eventType: "charge.dispute.closed", processorCreatedAt: 1_784_646_300, paymentIntentId: "pi_1", dispute: { id: "dp_1", status: "lost", amount: 200, currency: "usd" } }
  await applyStripeDisputeEvent(lost)
  const afterLost = structuredClone(state)
  await applyStripeDisputeEvent(lost)
  await applyStripeDisputeEvent({ ...lost, eventId: "evt_old_open", eventType: "charge.dispute.created", processorCreatedAt: 1_784_646_200, dispute: { ...lost.dispute, status: "needs_response" } })

  assert.equal(state.dispute.status, "LOST")
  assert.deepEqual(state.ownerships, afterLost.ownerships)
  assert.equal(state.events.length, afterLost.events.length)
})

function createRefundWebhookDouble({ selectedIds = ["item_1"], ownershipStatuses = {} } = {}) {
  const state = {
    order: { id: "order_1", userId: "user_1", status: "PAID", fulfillmentStatus: "FULFILLED" },
    payment: { id: "payment_1", orderId: "order_1", status: "SUCCEEDED", amountCents: 200, currency: "usd" },
    ownerships: [
      { id: "own_1", sourceOrderItemId: "item_1", source: "PURCHASE", status: ownershipStatuses.item_1 ?? "REFUND_PENDING" },
      { id: "own_2", sourceOrderItemId: "item_2", source: "PURCHASE", status: ownershipStatuses.item_2 ?? "ACTIVE" },
      { id: "own_credit", sourceOrderItemId: null, source: "CREDIT_REDEMPTION", status: "ACTIVE" },
    ],
    refund: {
      id: "refund_1", orderId: "order_1", paymentId: "payment_1", stripeRefundId: "re_1",
      status: "PENDING", amountCents: selectedIds.length * 100, currency: "usd",
      items: selectedIds.map((orderItemId) => ({ orderItemId, amountCents: 100 })),
    },
    receipts: [],
    events: [],
  }
  const tx = {
    commerceWebhookReceipt: {
      findUnique: async ({ where }) => state.receipts.find((receipt) => receipt.providerEventId === where.provider_providerEventId.providerEventId) ?? null,
      create: async ({ data }) => {
        const receipt = { id: `receipt_${state.receipts.length + 1}`, ...structuredClone(data) }
        state.receipts.push(receipt)
        return structuredClone(receipt)
      },
      update: async ({ where, data }) => Object.assign(state.receipts.find((receipt) => receipt.id === where.id), structuredClone(data)),
    },
    commerceRefund: {
      findUnique: async ({ where }) => {
        if (where.stripeRefundId && state.refund.stripeRefundId !== where.stripeRefundId) return null
        if (where.id && state.refund.id !== where.id) return null
        return ({
        ...structuredClone(state.refund),
        order: structuredClone(state.order),
        payment: structuredClone(state.payment),
        items: state.refund.items.map((item) => ({
          ...structuredClone(item),
          orderItem: { id: item.orderItemId, ownership: structuredClone(state.ownerships.find((ownership) => ownership.sourceOrderItemId === item.orderItemId)) },
        })),
        })
      },
      update: async ({ where, data }) => {
        if (state.refund.id !== where.id) throw new Error("refund not found")
        Object.assign(state.refund, structuredClone(data))
        return structuredClone(state.refund)
      },
      updateMany: async ({ where, data }) => {
        if (state.refund.id !== where.id || state.refund.status !== where.status) return { count: 0 }
        Object.assign(state.refund, structuredClone(data))
        return { count: 1 }
      },
    },
    backgroundOwnership: {
      updateMany: async ({ where, data }) => {
        const selected = state.ownerships.filter((ownership) => {
          const statusMatches = where.status?.in ? where.status.in.includes(ownership.status) : ownership.status === where.status
          const idMatches = where.id?.in ? where.id.in.includes(ownership.id) : !where.id || ownership.id === where.id
          return ownership.source === where.source && statusMatches && idMatches
        })
        selected.forEach((ownership) => Object.assign(ownership, structuredClone(data)))
        return { count: selected.length }
      },
    },
    commercePayment: { update: async ({ data }) => Object.assign(state.payment, structuredClone(data)) },
    commerceOrder: { update: async ({ data }) => Object.assign(state.order, structuredClone(data)) },
    commerceEvent: { create: async ({ data }) => state.events.push(structuredClone(data)) },
  }
  return { state, prismaClient: { $transaction: async (callback) => callback(tx) } }
}

it("finalizes a selected partial refund and is idempotent by webhook event ID", async () => {
  const { prismaClient, state } = createRefundWebhookDouble()
  const input = {
    prismaClient,
    eventId: "evt_refund_succeeded",
    eventType: "refund.updated",
    processorCreatedAt: 1_784_646_100,
    refund: { id: "re_1", status: "succeeded", amount: 100, currency: "usd", payment_intent: "pi_1" },
  }

  const first = await applyStripeRefundEvent(input)
  const beforeReplay = structuredClone(state)
  const replay = await applyStripeRefundEvent(input)

  assert.equal(first.changed, true)
  assert.equal(replay.changed, false)
  assert.equal(state.refund.status, "SUCCEEDED")
  assert.equal(state.order.status, "PARTIALLY_REFUNDED")
  assert.equal(state.payment.status, "PARTIALLY_REFUNDED")
  assert.equal(state.ownerships[0].status, "REFUND_REVOKED")
  assert.equal(state.ownerships[1].status, "ACTIVE")
  assert.equal(state.ownerships[2].status, "ACTIVE")
  assert.deepEqual(state, beforeReplay)
})

it("a failed refund restores only pending purchase ownership", async () => {
  const { prismaClient, state } = createRefundWebhookDouble()

  await applyStripeRefundEvent({
    prismaClient,
    eventId: "evt_refund_failed",
    eventType: "refund.failed",
    refund: { id: "re_1", status: "failed", amount: 100, currency: "usd", payment_intent: "pi_1", failure_reason: "expired_or_canceled_card" },
  })

  assert.equal(state.refund.status, "FAILED")
  assert.equal(state.ownerships[0].status, "ACTIVE")
  assert.equal(state.ownerships[1].status, "ACTIVE")
  assert.equal(state.ownerships[2].status, "ACTIVE")
  assert.equal(state.payment.status, "SUCCEEDED")
  assert.equal(state.order.status, "PAID")
})

it("a failed refund preserves an independently open dispute suspension", async () => {
  const { prismaClient, state } = createRefundWebhookDouble()
  state.payment.disputes = [{ id: "dispute_1", status: "OPEN" }]

  await applyStripeRefundEvent({
    prismaClient,
    eventId: "evt_refund_failed_during_dispute",
    eventType: "refund.failed",
    refund: { id: "re_1", status: "failed", amount: 100, currency: "usd", payment_intent: "pi_1" },
  })

  assert.equal(state.ownerships[0].status, "DISPUTE_SUSPENDED")
})

it("binds an ambiguous pending initiation from safe refund metadata exactly once", async () => {
  const { prismaClient, state } = createRefundWebhookDouble()
  state.refund.stripeRefundId = "pending:local-attempt"
  const first = await applyStripeRefundEvent({
    prismaClient,
    eventId: "evt_ambiguous_refund",
    eventType: "refund.updated",
    refund: { id: "re_recovered", status: "succeeded", amount: 100, currency: "usd", payment_intent: "pi_1", metadata: { refundId: "refund_1", orderId: "order_1" } },
  })
  const eventCount = state.events.length
  const second = await applyStripeRefundEvent({
    prismaClient,
    eventId: "evt_same_processor_new_delivery",
    eventType: "refund.updated",
    refund: { id: "re_recovered", status: "succeeded", amount: 100, currency: "usd", payment_intent: "pi_1", metadata: { refundId: "refund_1", orderId: "order_1" } },
  })

  assert.equal(first.changed, true)
  assert.equal(second.changed, false)
  assert.equal(first.userId, "user_1")
  assert.equal(state.refund.stripeRefundId, "re_recovered")
  assert.equal(state.events.length, eventCount)
})

it("a full refund revokes all selected purchase ownerships", async () => {
  const { prismaClient, state } = createRefundWebhookDouble({ selectedIds: ["item_1", "item_2"], ownershipStatuses: { item_2: "REFUND_PENDING" } })

  await applyStripeRefundEvent({
    prismaClient,
    eventId: "evt_full_refund",
    eventType: "refund.updated",
    refund: { id: "re_1", status: "succeeded", amount: 200, currency: "usd", payment_intent: "pi_1" },
  })

  assert.equal(state.order.status, "REFUNDED")
  assert.equal(state.payment.status, "REFUNDED")
  assert.deepEqual(state.ownerships.slice(0, 2).map((ownership) => ownership.status), ["REFUND_REVOKED", "REFUND_REVOKED"])
})

it("routes the pinned Stripe refund and dispute events through reversal services", async () => {
  const route = await readFile(new URL("../app/api/billing/webhook/route.ts", import.meta.url), "utf8")
  for (const eventType of [
    "refund.created",
    "refund.updated",
    "refund.failed",
    "charge.dispute.created",
    "charge.dispute.updated",
    "charge.dispute.closed",
  ]) {
    assert.match(route, new RegExp(`['\"]${eventType.replaceAll(".", "\\.")}['\"]`))
  }
  assert.match(route, /applyStripeRefundEvent/)
  assert.match(route, /applyStripeDisputeEvent/)
  assert.match(route, /charges\.retrieve/)
})
