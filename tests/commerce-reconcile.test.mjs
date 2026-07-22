import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import {
  collectCommerceReconciliationIssues,
  runCommerceReconciliation,
} from "../scripts/commerce-reconcile.mjs"
import { repairCommerceReversalIssue } from "../lib/commerce/reversal-service.ts"

function driftedSnapshot() {
  return [{
    id: "order_1",
    status: "PARTIALLY_REFUNDED",
    payments: [{
      id: "payment_1",
      status: "PARTIALLY_REFUNDED",
      disputes: [],
    }],
    refunds: [{
      id: "refund_1",
      status: "SUCCEEDED",
      items: [{
        orderItemId: "item_1",
        orderItem: { ownership: { id: "ownership_1", source: "PURCHASE", status: "ACTIVE" } },
      }],
    }],
  }]
}

describe("commerce reconciliation", () => {
  it("reports only internal IDs and never mutates by default", async () => {
    let writes = 0
    const prismaClient = { commerceOrder: { findMany: async () => driftedSnapshot() } }
    const report = await runCommerceReconciliation({
      prismaClient,
      repair: false,
      resumeRefund: async () => { writes += 1; return { changed: true } },
    })

    assert.equal(writes, 0)
    assert.deepEqual(report.issues, [{
      code: "REFUND_OWNERSHIP_NOT_REVOKED",
      orderId: "order_1",
      paymentId: "payment_1",
      refundId: "refund_1",
      ownershipId: "ownership_1",
    }])
    assert.doesNotMatch(JSON.stringify(report), /pi_|re_|dp_|stripe|email|metadata|payload/i)
  })

  it("scans deeply related orders in stable bounded pages", async () => {
    const rows = [
      { id: "order_1", status: "PAID", items: [], payments: [], refunds: [] },
      { id: "order_2", status: "PAID", items: [], payments: [], refunds: [] },
      { id: "order_3", status: "PAID", items: [], payments: [], refunds: [] },
    ]
    const calls = []
    const report = await runCommerceReconciliation({
      prismaClient: {
        commerceOrder: {
          findMany: async (args) => {
            calls.push(args)
            const start = args.cursor ? rows.findIndex((row) => row.id === args.cursor.id) + args.skip : 0
            return rows.slice(start, start + args.take)
          },
        },
      },
      batchSize: 2,
    })

    assert.deepEqual(report.issues, [])
    assert.equal(calls.length, 2)
    assert.deepEqual(calls.map((call) => ({
      take: call.take,
      cursor: call.cursor ?? null,
      skip: call.skip ?? null,
      orderBy: call.orderBy,
    })), [
      { take: 2, cursor: null, skip: null, orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
      { take: 2, cursor: { id: "order_2" }, skip: 1, orderBy: [{ createdAt: "asc" }, { id: "asc" }] },
    ])
  })

  it("repair mode resumes only unresolved local refund placeholders", async () => {
    const resumed = []
    const snapshot = driftedSnapshot()
    snapshot[0].refunds.push({
      id: "refund_pending",
      paymentId: "payment_1",
      stripeRefundId: "pending:refund_pending",
      status: "PENDING",
      processedAt: null,
      items: [],
    })
    const report = await runCommerceReconciliation({
      prismaClient: { commerceOrder: { findMany: async () => snapshot } },
      repair: true,
      resumeRefund: async (refundId) => { resumed.push(refundId); return { changed: true } },
    })

    assert.deepEqual(resumed, ["refund_pending"])
    assert.equal(report.repaired, 1)
  })

  it("reports aggregate refund and dispute state drift by internal ID", () => {
    const issues = collectCommerceReconciliationIssues([{
      id: "order_2",
      status: "PAID",
      items: [],
      payments: [{
        id: "payment_2",
        status: "REFUNDED",
        disputes: [{ id: "dispute_2", status: "OPEN", closedAt: new Date("2026-07-21T12:00:00.000Z") }],
      }],
      refunds: [{ id: "refund_2", paymentId: "payment_2", status: "PENDING", processedAt: new Date("2026-07-21T12:00:00.000Z"), items: [] }],
    }])

    assert.deepEqual(issues, [
      { code: "ORDER_PAYMENT_STATUS_MISMATCH", orderId: "order_2", paymentId: "payment_2" },
      { code: "PENDING_REFUND_ALREADY_PROCESSED", orderId: "order_2", paymentId: "payment_2", refundId: "refund_2" },
      { code: "OPEN_DISPUTE_ALREADY_CLOSED", orderId: "order_2", paymentId: "payment_2", disputeId: "dispute_2" },
    ])
  })

  it("reports unresolved local refund placeholders without processor identifiers", () => {
    const issues = collectCommerceReconciliationIssues([{
      id: "order_pending",
      status: "PAID",
      items: [],
      payments: [{ id: "payment_pending", status: "SUCCEEDED", disputes: [] }],
      refunds: [{
        id: "refund_pending",
        paymentId: "payment_pending",
        stripeRefundId: "pending:refund_pending",
        status: "PENDING",
        processedAt: null,
        items: [],
      }],
    }])

    assert.deepEqual(issues, [{
      code: "PENDING_REFUND_PROCESSOR_UNRESOLVED",
      orderId: "order_pending",
      paymentId: "payment_pending",
      refundId: "refund_pending",
    }])
    assert.doesNotMatch(JSON.stringify(issues), /pending:|pi_|re_|stripe/i)
  })

  it("projects reconciliation drift once from aggregate payment dispute precedence", () => {
    const openDominatesWon = collectCommerceReconciliationIssues([{
      id: "order_open", status: "PAID",
      items: [{ id: "item_open", ownership: { id: "ownership_open", source: "PURCHASE", status: "DISPUTE_SUSPENDED" } }],
      payments: [{ id: "payment_open", status: "SUCCEEDED", disputes: [
        { id: "dispute_won", status: "WON", closedAt: new Date("2026-07-21T12:00:00.000Z") },
        { id: "dispute_open", status: "OPEN", closedAt: null },
      ] }],
      refunds: [],
    }])
    assert.deepEqual(openDominatesWon, [])

    const lostDominates = collectCommerceReconciliationIssues([{
      id: "order_lost", status: "PAID",
      items: [{ id: "item_lost", ownership: { id: "ownership_lost", source: "PURCHASE", status: "ACTIVE" } }],
      payments: [{ id: "payment_lost", status: "SUCCEEDED", disputes: [
        { id: "dispute_won", status: "WON", closedAt: new Date("2026-07-21T12:00:00.000Z") },
        { id: "dispute_open", status: "OPEN", closedAt: null },
        { id: "dispute_lost", status: "LOST", closedAt: new Date("2026-07-21T12:01:00.000Z") },
      ] }],
      refunds: [],
    }])
    assert.deepEqual(lostDominates, [{
      code: "LOST_DISPUTE_OWNERSHIP_NOT_REVOKED",
      orderId: "order_lost",
      paymentId: "payment_lost",
      disputeId: "dispute_lost",
      ownershipId: "ownership_lost",
    }])
  })

  it("lets aggregate LOST exclusively own successful-refund ownership projection", () => {
    const collect = (ownershipStatus, disputes) => collectCommerceReconciliationIssues([{
      id: "order_refund_lost", status: "REFUNDED", items: [
        { id: "item_1", ownership: { id: "ownership_1", source: "PURCHASE", status: ownershipStatus } },
      ],
      payments: [{ id: "payment_1", status: "REFUNDED", disputes }],
      refunds: [{
        id: "refund_1", paymentId: "payment_1", status: "SUCCEEDED", processedAt: new Date("2026-07-21T12:02:00.000Z"),
        items: [{ orderItemId: "item_1", orderItem: { ownership: { id: "ownership_1", source: "PURCHASE", status: ownershipStatus } } }],
      }],
    }])
    const lost = [{ id: "dispute_lost", status: "LOST", closedAt: new Date("2026-07-21T12:01:00.000Z") }]

    assert.deepEqual(collect("DISPUTE_REVOKED", lost), [])
    assert.deepEqual(collect("ACTIVE", lost), [{
      code: "LOST_DISPUTE_OWNERSHIP_NOT_REVOKED",
      orderId: "order_refund_lost",
      paymentId: "payment_1",
      disputeId: "dispute_lost",
      ownershipId: "ownership_1",
    }])
    assert.deepEqual(collect("DISPUTE_REVOKED", []), [{
      code: "REFUND_OWNERSHIP_NOT_REVOKED",
      orderId: "order_refund_lost",
      paymentId: "payment_1",
      refundId: "refund_1",
      ownershipId: "ownership_1",
    }])
  })

  for (const [disputeStatus, expectedOwnershipStatus] of [
    ["OPEN", "DISPUTE_SUSPENDED"],
    ["LOST", "DISPUTE_REVOKED"],
  ]) {
    it(`rechecks ${disputeStatus} dispute precedence before repairing a failed refund`, async () => {
      const state = {
        ownership: { id: "ownership_1", userId: "user_1", source: "PURCHASE", status: "REFUND_PENDING", sourceOrderItemId: "item_1", sourceOrderItem: { id: "item_1", orderId: "order_1" } },
        events: [],
      }
      const tx = {
        backgroundOwnership: {
          findUnique: async () => structuredClone(state.ownership),
          updateMany: async ({ where, data }) => {
            const allowed = where.status.in.includes(state.ownership.status)
            if (!allowed) return { count: 0 }
            Object.assign(state.ownership, structuredClone(data))
            return { count: 1 }
          },
        },
        commerceRefund: {
          findUnique: async () => ({
            id: "refund_1", orderId: "order_1", paymentId: "payment_1", status: "FAILED",
            items: [{ orderItemId: "item_1" }],
            payment: { disputes: [{ id: "dispute_1", status: disputeStatus }] },
          }),
        },
        commerceEvent: { create: async ({ data }) => state.events.push(structuredClone(data)) },
      }

      const result = await repairCommerceReversalIssue({
        prismaClient: { $transaction: async (callback) => callback(tx) },
        issue: { code: "FAILED_REFUND_OWNERSHIP_NOT_RESTORED", orderId: "order_1", paymentId: "payment_1", refundId: "refund_1", ownershipId: "ownership_1" },
      })

      assert.equal(result.changed, true)
      assert.equal(state.ownership.status, expectedOwnershipStatus)
    })
  }

  it("does not leak dispute precedence into a later failed-refund repair", async () => {
    const state = {
      ownership: { id: "ownership_1", userId: "user_1", source: "PURCHASE", status: "REFUND_PENDING", sourceOrderItemId: "item_1", sourceOrderItem: { id: "item_1", orderId: "order_1" } },
    }
    const tx = {
      backgroundOwnership: {
        findUnique: async () => structuredClone(state.ownership),
        updateMany: async ({ where, data }) => {
          if (!where.status.in.includes(state.ownership.status)) return { count: 0 }
          Object.assign(state.ownership, structuredClone(data))
          return { count: 1 }
        },
      },
      commerceRefund: { findUnique: async () => ({
        id: "refund_1", orderId: "order_1", paymentId: "payment_1", status: "FAILED",
        items: [{ orderItemId: "item_1" }], payment: { disputes: [] },
      }) },
      commerceEvent: { create: async () => ({ id: "event_1" }) },
    }

    await repairCommerceReversalIssue({
      prismaClient: { $transaction: async (callback) => callback(tx) },
      issue: { code: "FAILED_REFUND_OWNERSHIP_NOT_RESTORED", orderId: "order_1", paymentId: "payment_1", refundId: "refund_1", ownershipId: "ownership_1" },
    })

    assert.equal(state.ownership.status, "ACTIVE")
  })

  for (const [dominantStatus, expectedStatus, expectedChanged] of [
    ["OPEN", "DISPUTE_SUSPENDED", false],
    ["LOST", "DISPUTE_REVOKED", true],
  ]) {
    it(`rechecks aggregate ${dominantStatus} precedence before repairing a stale WON issue`, async () => {
      const state = {
        ownership: { id: "ownership_1", userId: "user_1", source: "PURCHASE", status: "DISPUTE_SUSPENDED", sourceOrderItemId: "item_1", sourceOrderItem: { id: "item_1", orderId: "order_1" } },
      }
      const disputes = [{ id: "dispute_won", paymentId: "payment_1", status: "WON" }, { id: "dispute_other", paymentId: "payment_1", status: dominantStatus }]
      const tx = {
        backgroundOwnership: {
          findUnique: async () => structuredClone(state.ownership),
          updateMany: async ({ where, data }) => {
            if (!where.status.in.includes(state.ownership.status)) return { count: 0 }
            Object.assign(state.ownership, structuredClone(data))
            return { count: 1 }
          },
        },
        commerceDispute: { findUnique: async () => structuredClone(disputes[0]) },
        commercePayment: { findUnique: async () => ({ id: "payment_1", orderId: "order_1", disputes: structuredClone(disputes) }) },
        commerceEvent: { create: async () => ({ id: "event_1" }) },
      }

      const result = await repairCommerceReversalIssue({
        prismaClient: { $transaction: async (callback) => callback(tx) },
        issue: { code: "WON_DISPUTE_OWNERSHIP_NOT_RESTORED", orderId: "order_1", paymentId: "payment_1", disputeId: "dispute_won", ownershipId: "ownership_1" },
      })

      assert.equal(result.changed, expectedChanged)
      assert.equal(state.ownership.status, expectedStatus)
    })
  }

  it("keeps the package command read-only unless --repair is explicit", async () => {
    const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"))
    const source = await readFile(new URL("../scripts/commerce-reconcile.mjs", import.meta.url), "utf8")
    assert.equal(packageJson.scripts["commerce:reconcile"], "node scripts/commerce-reconcile.mjs")
    assert.match(source, /process\.argv\.includes\(["']--repair["']\)/)
    assert.match(source, /resumePendingBackgroundRefund/)
  })
})
