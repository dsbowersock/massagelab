import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import {
  collectCommerceReconciliationIssues,
  runCommerceReconciliation,
} from "../scripts/commerce-reconcile.mjs"

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
      repairIssue: async () => { writes += 1 },
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

  it("repairs only deterministic issues through the reversal service callback", async () => {
    const repaired = []
    const issues = collectCommerceReconciliationIssues(driftedSnapshot())
    const report = await runCommerceReconciliation({
      prismaClient: { commerceOrder: { findMany: async () => driftedSnapshot() } },
      repair: true,
      repairIssue: async (issue) => { repaired.push(issue); return { changed: true } },
    })

    assert.deepEqual(repaired, issues)
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

  it("keeps the package command read-only unless --repair is explicit", async () => {
    const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"))
    const source = await readFile(new URL("../scripts/commerce-reconcile.mjs", import.meta.url), "utf8")
    assert.equal(packageJson.scripts["commerce:reconcile"], "node scripts/commerce-reconcile.mjs")
    assert.match(source, /process\.argv\.includes\(["']--repair["']\)/)
    assert.match(source, /repairCommerceReversalIssue/)
  })
})
