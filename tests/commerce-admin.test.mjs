import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import { requireCommerceAdminUser } from "../lib/commerce/admin-access.ts"
import {
  collectCommerceAdminReconciliationIssues,
  getCommerceAdminOrderDetail,
  prepareCommerceAdminRefund,
} from "../lib/commerce/admin-service.ts"

/**
 * Supplies mutable persisted identities while deliberately allowing untrusted
 * session role claims to disagree with the database.
 */
function createAdminDatabase() {
  const users = new Map([
    ["ordinary", {
      id: "ordinary",
      name: "Ordinary Account",
      email: "ordinary@example.test",
      roles: [{ role: "USER", status: "VERIFIED" }],
    }],
    ["therapist", {
      id: "therapist",
      name: "Therapist Account",
      email: "therapist@example.test",
      roles: [{ role: "LICENSED_THERAPIST", status: "VERIFIED" }],
    }],
    ["anatomy-admin", {
      id: "anatomy-admin",
      name: "Anatomy Account",
      email: "anatomy@example.test",
      roles: [{ role: "ANATOMY_ADMIN", status: "VERIFIED" }],
    }],
    ["pending-admin", {
      id: "pending-admin",
      name: "Pending Account",
      email: "pending@example.test",
      roles: [{ role: "ADMIN", status: "PENDING" }],
    }],
    ["verified-admin", {
      id: "verified-admin",
      name: "Verified Admin",
      email: "full-admin@example.test",
      roles: [{ role: "ADMIN", status: "VERIFIED" }],
    }],
  ])
  let databaseReads = 0

  const database = {
    user: {
      async findUnique({ where }) {
        databaseReads += 1
        const row = users.get(where.id)
        return row ? structuredClone(row) : null
      },
    },
    userRole: {
      async findMany({ where }) {
        databaseReads += 1
        return structuredClone(users.get(where.userId)?.roles ?? [])
      },
    },
  }

  return {
    database,
    users,
    getDatabaseReads: () => databaseReads,
  }
}

function sessionUser(id, roles = ["ADMIN"]) {
  return { id, name: "Untrusted Session Label", email: "session@example.test", roles }
}

async function assertDenied(operation) {
  await assert.rejects(operation)
}

describe("full commerce administration access", () => {
  it("denies anonymous access before exposing an operator identity", async () => {
    const { database } = createAdminDatabase()

    await assertDenied(() => requireCommerceAdminUser({
      prismaClient: database,
      sessionUser: null,
    }))
  })

  it("freshly denies ordinary, therapist, anatomy-only, and pending ADMIN database roles", async () => {
    const { database, getDatabaseReads } = createAdminDatabase()

    for (const userId of ["ordinary", "therapist", "anatomy-admin", "pending-admin"]) {
      const readsBefore = getDatabaseReads()
      await assertDenied(() => requireCommerceAdminUser({
        prismaClient: database,
        sessionUser: sessionUser(userId),
      }))
      assert.ok(
        getDatabaseReads() > readsBefore,
        `${userId} must be authorized from a fresh database read`,
      )
    }
  })

  it("accepts only a verified ADMIN and returns the minimum database-owned account label", async () => {
    const { database, getDatabaseReads } = createAdminDatabase()
    const readsBefore = getDatabaseReads()

    const admin = await requireCommerceAdminUser({
      prismaClient: database,
      sessionUser: sessionUser("verified-admin", ["USER"]),
    })

    assert.ok(getDatabaseReads() > readsBefore)
    assert.deepEqual(admin, {
      id: "verified-admin",
      accountLabel: "Verified Admin",
    })
    assert.doesNotMatch(JSON.stringify(admin), /full-admin@example|session@example|roles|status/i)
  })

  it("reflects role verification changes immediately instead of caching session authority", async () => {
    const { database, users } = createAdminDatabase()
    const session = sessionUser("pending-admin")

    await assertDenied(() => requireCommerceAdminUser({
      prismaClient: database,
      sessionUser: session,
    }))

    users.get("pending-admin").roles[0].status = "VERIFIED"
    const admin = await requireCommerceAdminUser({
      prismaClient: database,
      sessionUser: session,
    })

    assert.deepEqual(admin, {
      id: "pending-admin",
      accountLabel: "Pending Account",
    })
  })
})

it("projects immutable order detail without processor or raw event data", async () => {
  const order = {
    id: "order-detail",
    status: "PAID",
    currency: "usd",
    subtotalCents: 100,
    taxCents: 10,
    totalCents: 110,
    createdAt: new Date("2026-07-21T10:00:00.000Z"),
    stripeCheckoutSessionId: "cs_secret",
    failureCode: "raw_failure",
    user: { id: "customer-1", name: "Customer Label", email: "customer@example.test" },
    items: [{ id: "item-1", productKey: "massage-lab-aurora", displayName: "Aurora", unitPriceCents: 100, allocatedTaxCents: 10, lineTotalCents: 110, currency: "usd", fulfillmentStatus: "FULFILLED", ownership: { status: "ACTIVE", source: "PURCHASE" }, refundItems: [] }],
    payments: [{ id: "payment-1", status: "SUCCEEDED", amountCents: 110, currency: "usd", paidAt: new Date("2026-07-21T10:01:00.000Z"), stripePaymentIntentId: "pi_secret", disputes: [] }],
    refunds: [],
    events: [{ id: "event-1", eventType: "BACKGROUND_ORDER_FULFILLED", source: "stripe-webhook", reasonCode: null, aggregateType: "CommerceOrder", aggregateId: "order-detail", fromState: "AWAITING_PAYMENT", toState: "PAID", createdAt: new Date("2026-07-21T10:02:00.000Z"), payload: { secret: "raw" } }],
  }
  const detail = await getCommerceAdminOrderDetail({
    prismaClient: { commerceOrder: { findUnique: async () => structuredClone(order) } },
    orderId: "order-detail",
  })
  assert.equal(detail.account.label, "Customer Label")
  assert.equal(detail.items[0].refundable, true)
  assert.deepEqual(detail.amounts, { subtotalAmount: 100, taxAmount: 10, totalAmount: 110 })
  assert.deepEqual(detail.history[0], {
    id: "event-1", type: "BACKGROUND_ORDER_FULFILLED", source: "stripe-webhook",
    reasonCode: null, aggregateType: "CommerceOrder", aggregateId: "order-detail",
    fromStatus: "AWAITING_PAYMENT", toStatus: "PAID", createdAt: "2026-07-21T10:02:00.000Z",
  })
  assert.doesNotMatch(JSON.stringify(detail), /cs_secret|pi_secret|customer@example|raw_failure|\"secret\"|payload/i)
})

it("keeps every commerce server action independently authorized and Stripe-free", async () => {
  const [actions, listPage, detailPage, adminPage] = await Promise.all([
    readFile(new URL("../app/admin/commerce/actions.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/commerce/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/commerce/[orderId]/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/page.tsx", import.meta.url), "utf8"),
  ])
  assert.match(actions, /"use server"/)
  for (const actionName of ["refundCommerceOrderItemsAction", "reconcileCommerceOrderIssueAction"]) {
    assert.match(actions, new RegExp(`export async function ${actionName}\\([\\s\\S]*?requireCommerceAdminUser\\(`))
  }
  assert.doesNotMatch([actions, listPage, detailPage].join("\n"), /from ["'][^"']*stripe|import\(["'][^"']*stripe/i)
  assert.match(listPage, /requireCommerceAdminUser/)
  assert.match(detailPage, /requireCommerceAdminUser/)
  assert.doesNotMatch(listPage + detailPage, /"use client"/)
  assert.match(adminPage, /Commerce/)
  assert.match(adminPage, /canAdministerAccounts|getCommerceAdminUser/)
})

function refundableOrder() {
  return {
    id: "order-1",
    userId: "customer-1",
    status: "PAID",
    currency: "usd",
    items: [
      { id: "item-1", orderId: "order-1", lineTotalCents: 100, currency: "usd", ownership: { source: "PURCHASE", status: "ACTIVE" }, refundItems: [] },
      { id: "item-2", orderId: "order-1", lineTotalCents: 100, currency: "usd", ownership: { source: "PURCHASE", status: "ACTIVE" }, refundItems: [] },
    ],
    payments: [{ id: "payment-1", status: "SUCCEEDED", amountCents: 200, currency: "usd", stripePaymentIntentId: "pi_secret" }],
  }
}

it("prepares only bounded exact-item refunds with a required reason", async () => {
  const state = { order: refundableOrder(), calls: [] }
  const input = {
    prismaClient: { commerceOrder: { findUnique: async () => structuredClone(state.order) } },
    adminUser: { id: "admin-1", accountLabel: "Operator" },
    orderId: "order-1",
    orderItemIds: ["item-2", "item-1"],
    reasonCode: "CUSTOMER_REQUEST",
    initiateRefund: async (value) => {
      state.calls.push(value)
      return { refundId: "refund-1", amountCents: 200, status: "PENDING", processorRefundId: "re_secret", reconciliationRequired: false }
    },
  }
  for (const override of [
    { reasonCode: "" },
    { reasonCode: "x".repeat(65) },
    { orderItemIds: [] },
    { orderItemIds: ["item-1", "item-1"] },
  ]) {
    await assert.rejects(() => prepareCommerceAdminRefund({ ...input, ...override }))
  }
  assert.equal(state.calls.length, 0)

  const result = await prepareCommerceAdminRefund(input)
  assert.deepEqual(result, {
    refundId: "refund-1", orderId: "order-1", amountCents: 200,
    status: "PENDING", reconciliationRequired: false,
  })
  assert.equal(state.calls[0].actorId, "admin-1")
  assert.equal(state.calls[0].reasonCode, "CUSTOMER_REQUEST")
  assert.deepEqual(state.calls[0].orderItemIds, ["item-1", "item-2"])
  assert.doesNotMatch(JSON.stringify(result), /pi_secret|re_secret|stripe|processor/i)
})

it("prevents duplicate refunds before invoking the processor boundary", async () => {
  const order = refundableOrder()
  order.items[0].refundItems = [{ refund: { status: "PENDING" } }]
  let processorCalls = 0
  await assert.rejects(() => prepareCommerceAdminRefund({
    prismaClient: { commerceOrder: { findUnique: async () => order } },
    adminUser: { id: "admin-1", accountLabel: "Operator" },
    orderId: "order-1",
    orderItemIds: ["item-1"],
    reasonCode: "CUSTOMER_REQUEST",
    initiateRefund: async () => { processorCalls += 1 },
  }))
  assert.equal(processorCalls, 0)
})

it("derives deterministic identifier-only reconciliation findings", () => {
  const orders = [{
    id: "order-1",
    status: "PAID",
    items: [{ id: "item-1", ownership: { id: "ownership-1", source: "PURCHASE", status: "ACTIVE" } }],
    payments: [{ id: "payment-1", status: "REFUNDED", disputes: [{ id: "dispute-1", status: "OPEN", closedAt: new Date() }] }],
    refunds: [{ id: "refund-1", paymentId: "payment-1", status: "SUCCEEDED", processedAt: new Date(), items: [{ orderItemId: "item-1", orderItem: { ownership: { id: "ownership-1", source: "PURCHASE", status: "ACTIVE" } } }] }],
  }]
  const first = collectCommerceAdminReconciliationIssues(orders)
  const second = collectCommerceAdminReconciliationIssues(structuredClone(orders))
  assert.deepEqual(second, first)
  assert.deepEqual(first.map((issue) => issue.code), [
    "ORDER_PAYMENT_STATUS_MISMATCH",
    "REFUND_OWNERSHIP_NOT_REVOKED",
    "OPEN_DISPUTE_ALREADY_CLOSED",
    "OPEN_DISPUTE_OWNERSHIP_NOT_SUSPENDED",
  ])
  assert.doesNotMatch(JSON.stringify(first), /stripe|payload|metadata|email|pi_|re_|dp_/i)
})
