import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"

const schema = readFileSync(new URL("../prisma/schema.prisma", import.meta.url), "utf8")
const migration = readFileSync(
  new URL(
    "../prisma/migrations/20260718120000_background_commerce_foundation/migration.sql",
    import.meta.url,
  ),
  "utf8",
)

const requiredModels = [
  "CommerceCart",
  "CommerceCartItem",
  "CommerceOrder",
  "CommerceOrderItem",
  "CommercePayment",
  "CommerceRefund",
  "CommerceRefundItem",
  "CommerceDispute",
  "CommerceEvent",
  "CommerceWebhookReceipt",
  "BackgroundCreditWallet",
  "BackgroundCreditEntry",
  "BackgroundOwnership",
]

describe("transactional background commerce schema", () => {
  it("defines the approved generic commerce, wallet, and ownership records", () => {
    for (const model of requiredModels) {
      assert.match(schema, new RegExp(`model ${model} \\{`))
      assert.match(migration, new RegExp(`CREATE TABLE "${model}"`))
    }

    assert.match(schema, /model CommerceCartItem \{[\s\S]*?productType\s+String[\s\S]*?productKey\s+String/)
    assert.match(schema, /model CommerceOrderItem \{[\s\S]*?productType\s+String[\s\S]*?productKey\s+String/)
    assert.match(schema, /model CommerceOrderItem \{[\s\S]*?displayName\s+String[\s\S]*?unitPriceCents\s+Int[\s\S]*?currency\s+String/)
  })

  it("defines every required lifecycle state explicitly", () => {
    const lifecycleContracts = [
      /enum CommerceOrderStatus \{[\s\S]*?PREPARING[\s\S]*?AWAITING_PAYMENT[\s\S]*?PAID[\s\S]*?PAYMENT_FAILED[\s\S]*?CANCELED[\s\S]*?EXPIRED[\s\S]*?REVIEW_REQUIRED[\s\S]*?PARTIALLY_REFUNDED[\s\S]*?REFUNDED[\s\S]*?\}/,
      /enum CommerceDisputeStatus \{[\s\S]*?OPEN[\s\S]*?WON[\s\S]*?LOST[\s\S]*?\}/,
      /enum BackgroundOwnershipStatus \{[\s\S]*?ACTIVE[\s\S]*?REFUND_PENDING[\s\S]*?DISPUTE_SUSPENDED[\s\S]*?REFUND_REVOKED[\s\S]*?DISPUTE_REVOKED[\s\S]*?RETIRED[\s\S]*?\}/,
      /enum BackgroundCreditEntryType \{[\s\S]*?INITIAL_GRANT[\s\S]*?REDEMPTION[\s\S]*?RETIREMENT_REPLACEMENT[\s\S]*?ADMIN_CORRECTION[\s\S]*?\}/,
    ]

    for (const contract of lifecycleContracts) {
      assert.match(schema, contract)
    }
  })

  it("enforces commerce idempotency and one-current-record invariants", () => {
    const schemaUniqueContracts = [
      /model CommerceCart \{[\s\S]*?userId\s+String\s+@unique/,
      /model CommerceCartItem \{[\s\S]*?@@unique\(\[cartId, productType, productKey\]\)/,
      /model BackgroundCreditWallet \{[\s\S]*?userId\s+String\s+@unique/,
      /model BackgroundCreditEntry \{[\s\S]*?idempotencyKey\s+String\s+@unique/,
      /model BackgroundOwnership \{[\s\S]*?@@unique\(\[userId, backgroundKey\]\)/,
      /model BackgroundOwnership \{[\s\S]*?sourceOrderItemId\s+String\?\s+@unique[\s\S]*?sourceCreditEntryId\s+String\?\s+@unique/,
      /model CommerceWebhookReceipt \{[\s\S]*?@@unique\(\[provider, providerEventId\]\)/,
      /model CommerceOrder \{[\s\S]*?stripeCheckoutSessionId\s+String\?\s+@unique/,
      /model CommercePayment \{[\s\S]*?stripePaymentIntentId\s+String\s+@unique/,
    ]

    for (const contract of schemaUniqueContracts) {
      assert.match(schema, contract)
    }

    assert.match(
      migration,
      /CREATE UNIQUE INDEX "CommerceOrder_one_active_per_user_key"[\s\S]*?ON "CommerceOrder"\("userId"\)[\s\S]*?WHERE "status" IN \('PREPARING', 'AWAITING_PAYMENT'\)/,
    )
    assert.match(
      schema,
      /@@unique\(\[userId\], map: "CommerceOrder_one_active_per_user_key", where: raw\([\s\S]*?PREPARING[\s\S]*?AWAITING_PAYMENT[\s\S]*?\)\)/,
    )
  })

  it("keeps durable commerce history restrictive while carts remain ephemeral", () => {
    assert.match(schema, /model CommerceCart \{[\s\S]*?user\s+User\s+@relation\(fields: \[userId\], references: \[id\], onDelete: Cascade\)/)
    assert.match(schema, /model CommerceCartItem \{[\s\S]*?cart\s+CommerceCart\s+@relation\(fields: \[cartId\], references: \[id\], onDelete: Cascade\)/)

    const durableUserRelations = [
      "CommerceOrder",
      "CommerceEvent",
      "BackgroundCreditWallet",
      "BackgroundOwnership",
    ]
    for (const model of durableUserRelations) {
      assert.match(
        schema,
        new RegExp(`model ${model} \\{[\\s\\S]*?user\\s+User\\s+@relation\\(fields: \\[userId\\], references: \\[id\\], onDelete: Restrict\\)`),
      )
    }
    assert.match(
      schema,
      /model CommerceWebhookReceipt \{[\s\S]*?userId\s+String\?[\s\S]*?user\s+User\?\s+@relation\(fields: \[userId\], references: \[id\], onDelete: Restrict\)/,
    )

    assert.doesNotMatch(
      migration,
      /ALTER TABLE "(?:CommerceOrder|CommercePayment|CommerceRefund|CommerceDispute|CommerceEvent|CommerceWebhookReceipt|BackgroundCreditWallet|BackgroundCreditEntry|BackgroundOwnership)"[\s\S]*?ON DELETE CASCADE/,
    )
  })

  it("adds named database checks for money, balances, and ownership sources", () => {
    const checkConstraints = [
      /CONSTRAINT "CommerceCartItem_quantity_positive" CHECK \("quantity" > 0\)/,
      /CONSTRAINT "CommerceOrder_totals_nonnegative" CHECK \("subtotalCents" >= 0 AND "taxCents" >= 0 AND "totalCents" >= 0\)/,
      /CONSTRAINT "CommerceOrderItem_money_nonnegative" CHECK \("unitPriceCents" >= 0 AND "quantity" > 0 AND "allocatedTaxCents" >= 0 AND "lineTotalCents" >= 0\)/,
      /CONSTRAINT "CommercePayment_amount_nonnegative" CHECK \("amountCents" >= 0\)/,
      /CONSTRAINT "CommerceRefund_amount_nonnegative" CHECK \("amountCents" >= 0\)/,
      /CONSTRAINT "CommerceRefundItem_amount_nonnegative" CHECK \("quantity" > 0 AND "amountCents" >= 0\)/,
      /CONSTRAINT "BackgroundCreditWallet_balance_nonnegative" CHECK \("balance" >= 0\)/,
      /CONSTRAINT "BackgroundOwnership_exactly_one_source" CHECK \(\("sourceOrderItemId" IS NOT NULL\) <> \("sourceCreditEntryId" IS NOT NULL\)\)/,
    ]

    for (const constraint of checkConstraints) {
      assert.match(migration, constraint)
    }
  })

  it("stores checkout/legal snapshots and limited audit payloads without granting credits", () => {
    const orderContracts = [
      /model CommerceOrder \{[\s\S]*?reservationExpiresAt\s+DateTime\?/,
      /model CommerceOrder \{[\s\S]*?legalAcceptance\s+Json/,
      /model CommerceOrder \{[\s\S]*?publicId\s+String\s+@unique[\s\S]*?taxCents\s+Int/,
      /model CommerceOrder \{[\s\S]*?purchaseCountry\s+String\?/,
      /model CommerceOrder \{[\s\S]*?returnPath\s+String/,
      /model CommerceOrder \{[\s\S]*?failureCode\s+String\?/,
      /model CommerceOrder \{[\s\S]*?fulfillmentStartedAt\s+DateTime\?[\s\S]*?fulfilledAt\s+DateTime\?/,
      /model CommerceOrderItem \{[\s\S]*?allocatedTaxCents\s+Int[\s\S]*?fulfillmentAdapterVersion\s+String/,
      /model CommerceEvent \{[\s\S]*?payload\s+Json/,
      /model CommerceEvent \{[\s\S]*?source\s+String[\s\S]*?reasonCode\s+String\?/,
      /model BackgroundCreditWallet \{[\s\S]*?balance\s+Int[\s\S]*?version\s+Int/,
    ]

    for (const contract of orderContracts) {
      assert.match(schema, contract)
    }

    assert.doesNotMatch(migration, /INSERT\s+INTO\s+"BackgroundCredit(?:Wallet|Entry)"/i)
  })
})
