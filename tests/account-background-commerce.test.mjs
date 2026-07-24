import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import { createAccountSurfaceDataLoader } from "../lib/account-surface-data.js"

function snapshot() {
  return {
    creditBalance: 2,
    ownedBackgroundIds: ["massage-lab-aurora"],
    ownerships: [{
      backgroundId: "massage-lab-aurora",
      source: "purchase",
      status: "active",
      acquiredAt: "2026-07-20T10:00:00.000Z",
    }],
    cart: {
      items: [{ productType: "background", productKey: "massage-lab-silk", displayName: "Silk", unitAmount: 100, currency: "usd", availableForPurchase: true }],
      reservedOrder: null,
      subtotalAmount: 100,
      currency: "usd",
      notices: [],
    },
    recentOrders: [],
  }
}

describe("Account background commerce loader", () => {
  it("returns an uncached safe portfolio and itemized order projection", async () => {
    let reads = 0
    const prismaClient = {
      commerceOrder: {
        async findMany() {
          return [{
            id: "order-safe",
            status: "PARTIALLY_REFUNDED",
            subtotalCents: 200,
            taxCents: 10,
            totalCents: 210,
            currency: "usd",
            createdAt: new Date("2026-07-20T11:00:00.000Z"),
            items: [{
              productKey: "massage-lab-aurora",
              displayName: "Aurora",
              unitPriceCents: 100,
              allocatedTaxCents: 5,
              lineTotalCents: 105,
              refundItems: [
                { amountCents: 105, refund: { status: "SUCCEEDED" } },
                { amountCents: 50, refund: { status: "PENDING" } },
              ],
            }],
          }]
        },
      },
    }
    const snapshotInputs = []
    const loader = createAccountSurfaceDataLoader({
      prismaClient,
      getCommerceSnapshot: async (input) => {
        reads += 1
        snapshotInputs.push(input)
        return snapshot()
      },
    })

    const first = await loader.getAccountSurfaceData("orders-invoices", "user-1")
    const second = await loader.getAccountSurfaceData("orders-invoices", "user-1")
    assert.equal(reads, 2)
    assert.equal(first.backgroundCommerce.creditBalance, 2)
    assert.equal(first.backgroundCommerce.orders[0].reference, "order-safe")
    assert.equal(first.backgroundCommerce.orders[0].items[0].refundedAmount, 105)
    assert.deepEqual(first.backgroundCommerce.orders[0].items[0].refundStatuses, ["SUCCEEDED", "PENDING"])
    assert.ok(snapshotInputs.every((input) => input.includeRecentOrders === false))
    assert.deepEqual(second.backgroundCommerce.cart.items.map((item) => item.productKey), ["massage-lab-silk"])
    assert.doesNotMatch(JSON.stringify(first), /stripe|paymentIntent|session|charge|disputeId/i)
  })
})

describe("Account background commerce panel", () => {
  it("covers wallet, portfolio, order, reversal, subscriber, cart, and support states", async () => {
    const source = await readFile(new URL("../components/account/BackgroundCommercePanel.tsx", import.meta.url), "utf8")
    for (const copy of [
      "Background credits",
      "two initial",
      "non-swappable",
      "Permanent backgrounds",
      "Credit redemption",
      "Purchase",
      "Inactive history",
      "Partial refund",
      "Dispute",
      "Retired",
      "Replacement credit",
      "Included with membership",
      "Open account cart",
      "Report a purchase or background access issue",
      "No permanent backgrounds yet",
      "No background orders yet",
    ]) {
      assert.match(source, new RegExp(copy, "i"))
    }
    assert.match(source, /backgroundRegistry\.find/)
    assert.match(source, /Unavailable background/)
    assert.match(source, /orderReference/)
    assert.match(source, /mergeAccountOrders\(data\.orders, live\?\.recentOrders\)/)
    assert.match(source, /status: order\.status \?\? itemizedOrder\?\.status \?\? "UNKNOWN"/)
    assert.match(source, /items: itemizedOrder\?\.items/)
    assert.match(source, /return \[\.\.\.currentOrders, \.\.\.olderItemizedOrders\]/)
    assert.match(source, /Item details appear after refresh\./)
    assert.match(source, /\{active \? \([\s\S]*Open in Background picker/)
  })

  it("activates the Account Orders and purchases tab", async () => {
    const accountPage = await readFile(new URL("../app/account/page.tsx", import.meta.url), "utf8")
    const accountModel = await readFile(new URL("../lib/account-page.js", import.meta.url), "utf8")
    assert.match(accountPage, /<BackgroundCommercePanel/)
    assert.match(accountPage, /tabId === "orders-invoices"/)
    assert.match(accountModel, /id: "orders-invoices"[\s\S]*status: "current"/)
  })
})
