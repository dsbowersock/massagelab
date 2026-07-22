import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import { requireCommerceAdminUser } from "../lib/commerce/admin-access.ts"
import {
  collectCommerceAdminReconciliationIssues,
  getCommerceAdminOrderDetail,
  listCommerceAdminOperations,
  prepareCommerceAdminRefund,
  reconcileCommerceAdminIssue,
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
    const functionStart = actions.indexOf(`export async function ${actionName}(`)
    const nextFunctionStart = actions.indexOf("\nexport async function ", functionStart + 1)
    assert.notEqual(functionStart, -1, `${actionName} must remain exported`)
    const functionSource = actions.slice(
      functionStart,
      nextFunctionStart === -1 ? actions.length : nextFunctionStart,
    )
    assert.match(functionSource, /requireCommerceAdminUser\(/)
  }
  assert.doesNotMatch([actions, listPage, detailPage].join("\n"), /from ["'][^"']*stripe|import\(["'][^"']*stripe/i)
  assert.match(listPage, /requireCommerceAdminUser/)
  assert.match(detailPage, /requireCommerceAdminUser/)
  assert.doesNotMatch(listPage + detailPage, /"use client"/)
  assert.match(adminPage, /Commerce/)
  assert.match(adminPage, /canAdministerAccounts|getCommerceAdminUser/)
})

it("returns the reconciliation result only after authorization and revalidation", async () => {
  const actions = await readFile(new URL("../app/admin/commerce/actions.ts", import.meta.url), "utf8")
  const actionBody = actions.match(
    /export async function reconcileCommerceOrderIssueAction\(formData: FormData\) \{([\s\S]*?)\n\}/,
  )?.[1]

  assert.ok(actionBody, "reconciliation action must remain exported")
  assert.match(actionBody, /await requireCommerceAdminUser\(\)/)
  assert.match(actionBody, /const result = await reconcileCommerceAdminIssue\(/)
  assert.match(actionBody, /revalidatePath\("\/admin"\)/)
  assert.match(actionBody, /revalidatePath\("\/admin\/commerce"\)/)
  assert.match(actionBody, /revalidatePath\(`\/admin\/commerce\/\$\{issue\.orderId\}`\)/)
  assert.ok(actionBody.indexOf("requireCommerceAdminUser") < actionBody.indexOf("reconcileCommerceAdminIssue"))
  assert.ok(actionBody.lastIndexOf("revalidatePath") < actionBody.lastIndexOf("return result"))
  assert.match(actionBody, /return result\s*$/)
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
  assert.deepEqual(first.map((issue) => issue.repairable), [false, true, false, true])
  assert.doesNotMatch(JSON.stringify(first), /stripe|payload|metadata|email|pi_|re_|dp_/i)
})

it("derives admin ownership findings from one aggregate dispute state per payment", () => {
  const issues = collectCommerceAdminReconciliationIssues([{
    id: "order-aggregate", status: "PAID",
    items: [{ id: "item-aggregate", ownership: { id: "ownership-aggregate", source: "PURCHASE", status: "DISPUTE_SUSPENDED" } }],
    payments: [{ id: "payment-aggregate", status: "SUCCEEDED", disputes: [
      { id: "dispute-won", status: "WON", closedAt: new Date("2026-07-21T12:00:00.000Z") },
      { id: "dispute-open", status: "OPEN", closedAt: null },
    ] }],
    refunds: [],
  }])

  assert.equal(issues.some((issue) => issue.code === "WON_DISPUTE_OWNERSHIP_NOT_RESTORED"), false)
  assert.equal(issues.filter((issue) => issue.ownershipId === "ownership-aggregate").length, 0)
})

it("lets aggregate LOST exclusively own admin successful-refund findings", () => {
  const collect = (ownershipStatus, disputes) => collectCommerceAdminReconciliationIssues([{
    id: "order-refund-lost", status: "REFUNDED",
    items: [{ id: "item-1", ownership: { id: "ownership-1", source: "PURCHASE", status: ownershipStatus } }],
    payments: [{ id: "payment-1", status: "REFUNDED", disputes }],
    refunds: [{
      id: "refund-1", paymentId: "payment-1", status: "SUCCEEDED", processedAt: new Date("2026-07-21T12:02:00.000Z"),
      items: [{ orderItemId: "item-1", orderItem: { ownership: { id: "ownership-1", source: "PURCHASE", status: ownershipStatus } } }],
    }],
  }])
  const lost = [{ id: "dispute-lost", status: "LOST", closedAt: new Date("2026-07-21T12:01:00.000Z") }]

  assert.deepEqual(collect("DISPUTE_REVOKED", lost), [])
  assert.deepEqual(collect("ACTIVE", lost).map((issue) => issue.code), ["LOST_DISPUTE_OWNERSHIP_NOT_REVOKED"])
  assert.deepEqual(collect("DISPUTE_REVOKED", []).map((issue) => issue.code), ["REFUND_OWNERSHIP_NOT_REVOKED"])
})

it("filters actionable candidates before applying the 100-order display cap", async () => {
  const normalOrders = Array.from({ length: 101 }, (_, index) => ({
    id: `normal-${index}`,
    status: "PAID",
    totalCents: 100,
    createdAt: new Date(2026, 6, 21, 12, 0, 0, 101 - index),
    user: { id: `user-${index}`, name: `Normal ${index}`, email: null },
    items: [], payments: [], refunds: [],
  }))
  const olderActionable = {
    id: "older-review-required",
    status: "REVIEW_REQUIRED",
    totalCents: 100,
    createdAt: new Date("2026-07-01T12:00:00.000Z"),
    user: { id: "user-actionable", name: "Actionable", email: null },
    items: [], payments: [], refunds: [],
  }
  const queries = []
  const prismaClient = {
    commerceOrder: {
      async findMany(options) {
        queries.push(options)
        if (!options.where) return [...normalOrders, olderActionable].slice(0, options.take)
        return JSON.stringify(options.where).includes("REVIEW_REQUIRED") ? [olderActionable] : []
      },
    },
  }

  const queue = await listCommerceAdminOperations({ prismaClient })

  assert.deepEqual(queue.map((entry) => entry.orderId), ["older-review-required"])
  assert.equal(queries.length, 2)
  assert.equal(queries.every((query) => query.where && query.take === 100), true)
})

it("refuses manual-review reconciliation codes while preserving supported exact repairs", async () => {
  let repairCalls = 0
  const unsupported = await reconcileCommerceAdminIssue({
    prismaClient: {},
    issue: { code: "ORDER_PAYMENT_STATUS_MISMATCH", orderId: "order-1", paymentId: "payment-1", repairable: false },
    repairIssue: async () => { repairCalls += 1; return { changed: true, status: "unexpected" } },
  })
  assert.deepEqual(unsupported, { changed: false, status: "MANUAL_REVIEW_REQUIRED" })
  assert.equal(repairCalls, 0)

  const supported = await reconcileCommerceAdminIssue({
    prismaClient: {},
    issue: { code: "REFUND_OWNERSHIP_NOT_REVOKED", orderId: "order-1", paymentId: "payment-1", refundId: "refund-1", ownershipId: "ownership-1", repairable: true },
    repairIssue: async () => { repairCalls += 1; return { changed: true, status: "REFUND_REVOKED" } },
  })
  assert.deepEqual(supported, { changed: true, status: "REFUND_REVOKED" })
  assert.equal(repairCalls, 1)
})

it("renders repair controls only for repairable findings", async () => {
  const source = await readFile(new URL("../app/admin/commerce/[orderId]/page.tsx", import.meta.url), "utf8")
  assert.match(source, /issue\.repairable\s*\?/)
  assert.match(source, /Manual operator review/)
  assert.match(source, /Apply exact repair/)
})
