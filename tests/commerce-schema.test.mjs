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

function modelBlock(modelName) {
  const match = schema.match(new RegExp(`model ${modelName} \\{[\\s\\S]*?\\r?\\n\\}`))
  assert.ok(match, `Expected model ${modelName}`)
  return match[0]
}

describe("transactional background commerce schema", () => {
  it("defines the approved generic commerce, wallet, and ownership records", () => {
    for (const model of requiredModels) {
      assert.match(schema, new RegExp(`model ${model} \\{`))
      assert.match(migration, new RegExp(`CREATE TABLE "${model}"`))
    }

    assert.match(modelBlock("CommerceCartItem"), /productType\s+String[\s\S]*?productKey\s+String/)
    assert.match(modelBlock("CommerceOrderItem"), /productType\s+String[\s\S]*?productKey\s+String/)
    assert.match(modelBlock("CommerceOrderItem"), /displayName\s+String[\s\S]*?unitPriceCents\s+Int[\s\S]*?currency\s+String/)
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

  it("stores every commerce currency as a lowercase three-letter ISO code", () => {
    assert.match(modelBlock("CommerceCart"), /currency\s+String\s+@default\("usd"\)/)
    assert.match(modelBlock("CommerceOrder"), /currency\s+String\s+@default\("usd"\)/)
    assert.match(migration, /"CommerceCart"[\s\S]*?"currency" TEXT NOT NULL DEFAULT 'usd'/)
    assert.match(migration, /"CommerceOrder"[\s\S]*?"currency" TEXT NOT NULL DEFAULT 'usd'/)

    const currencyChecks = [
      "CommerceCart_currency_lowercase_iso_check",
      "CommerceOrder_currency_lowercase_iso_check",
      "CommerceOrderItem_currency_lowercase_iso_check",
      "CommercePayment_currency_lowercase_iso_check",
      "CommerceRefund_currency_lowercase_iso_check",
      "CommerceDispute_currency_lowercase_iso_check",
    ]

    for (const constraintName of currencyChecks) {
      assert.ok(
        migration.includes(
          `CONSTRAINT "${constraintName}" CHECK ("currency" ~ '^[a-z]{3}$')`,
        ),
        `Expected named lowercase ISO currency check ${constraintName}`,
      )
    }
  })

  it("enforces commerce idempotency and one-current-record invariants", () => {
    const schemaUniqueContracts = [
      ["CommerceCart", /userId\s+String\s+@unique/],
      ["CommerceCartItem", /@@unique\(\[cartId, productType, productKey\]\)/],
      ["BackgroundCreditWallet", /userId\s+String\s+@unique/],
      ["BackgroundCreditEntry", /idempotencyKey\s+String\s+@unique/],
      ["BackgroundOwnership", /@@unique\(\[userId, backgroundKey\]\)/],
      ["BackgroundOwnership", /@@unique\(\[sourceOrderItemId, userId, sourceProductType, backgroundKey\]\)/],
      ["BackgroundOwnership", /@@unique\(\[sourceCreditEntryId, userId, backgroundKey\]\)/],
      ["CommerceWebhookReceipt", /@@unique\(\[provider, providerEventId\]\)/],
      ["CommerceOrder", /stripeCheckoutSessionId\s+String\?\s+@unique/],
      ["CommercePayment", /stripePaymentIntentId\s+String\s+@unique/],
    ]

    for (const [model, contract] of schemaUniqueContracts) {
      assert.match(modelBlock(model), contract)
    }

    assert.match(
      migration,
      /CREATE UNIQUE INDEX "CommerceOrder_one_active_per_user_key"[\s\S]*?ON "CommerceOrder"\("userId"\)[\s\S]*?WHERE "status" IN \('PREPARING', 'AWAITING_PAYMENT'\)/,
    )
    assert.match(
      modelBlock("CommerceOrder"),
      /@@unique\(\[userId\], map: "CommerceOrder_one_active_per_user_key", where: raw\([\s\S]*?PREPARING[\s\S]*?AWAITING_PAYMENT[\s\S]*?\)\)/,
    )
  })

  it("keeps durable commerce history restrictive while carts remain ephemeral", () => {
    assert.match(modelBlock("CommerceCart"), /user\s+User\s+@relation\(fields: \[userId\], references: \[id\], onDelete: Cascade\)/)
    assert.match(modelBlock("CommerceCartItem"), /cart\s+CommerceCart\s+@relation\(fields: \[cartId\], references: \[id\], onDelete: Cascade\)/)

    const durableUserRelations = [
      "CommerceOrder",
      "CommerceEvent",
      "BackgroundCreditWallet",
      "BackgroundOwnership",
    ]
    for (const model of durableUserRelations) {
      assert.match(
        modelBlock(model),
        /user\s+User\s+@relation\(fields: \[userId\], references: \[id\], onDelete: Restrict\)/,
      )
    }
    assert.match(
      modelBlock("CommerceWebhookReceipt"),
      /userId\s+String\?[\s\S]*?user\s+User\?\s+@relation\(fields: \[userId\], references: \[id\], onDelete: Restrict\)/,
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
      /CONSTRAINT "CommerceOrder_legal_acceptance_shape_version_check" CHECK \(/,
      /CONSTRAINT "CommerceOrderItem_money_nonnegative" CHECK \("unitPriceCents" >= 0 AND "quantity" > 0 AND "allocatedTaxCents" >= 0 AND "lineTotalCents" >= 0\)/,
      /CONSTRAINT "CommercePayment_amount_nonnegative" CHECK \("amountCents" >= 0\)/,
      /CONSTRAINT "CommerceRefund_amount_nonnegative" CHECK \("amountCents" >= 0\)/,
      /CONSTRAINT "CommerceRefundItem_amount_nonnegative" CHECK \("quantity" > 0 AND "amountCents" >= 0\)/,
      /CONSTRAINT "CommerceDispute_amount_nonnegative" CHECK \("amountCents" >= 0\)/,
      /CONSTRAINT "BackgroundCreditWallet_balance_nonnegative" CHECK \("balance" >= 0\)/,
      /CONSTRAINT "BackgroundCreditWallet_version_nonnegative" CHECK \("version" >= 0\)/,
      /CONSTRAINT "BackgroundCreditEntry_balance_after_nonnegative" CHECK \("balanceAfter" >= 0\)/,
      /CONSTRAINT "BackgroundCreditEntry_redemption_delta_negative" CHECK \("type" <> 'REDEMPTION' OR "delta" < 0\)/,
      /CONSTRAINT "BackgroundCreditEntry_redemption_background_check" CHECK \([\s\S]*?REDEMPTION[\s\S]*?redemptionBackgroundKey[\s\S]*?\)/,
      /CONSTRAINT "BackgroundOwnership_exactly_one_source" CHECK \(\("sourceOrderItemId" IS NOT NULL\) <> \("sourceCreditEntryId" IS NOT NULL\)\)/,
      /CONSTRAINT "BackgroundOwnership_source_matches_reference" CHECK \([\s\S]*?PURCHASE[\s\S]*?CREDIT_REDEMPTION[\s\S]*?\)/,
      /CONSTRAINT "BackgroundOwnership_source_product_type_check" CHECK \("sourceProductType" = 'background'\)/,
    ]

    for (const constraint of checkConstraints) {
      assert.match(migration, constraint)
    }
  })

  it("requires a versioned per-order legal acceptance snapshot", () => {
    const order = modelBlock("CommerceOrder")

    assert.match(order, /^\s*legalAcceptance\s+Json\s*$/m)
    assert.doesNotMatch(order, /legalAcceptance\s+Json[^\r\n]*@default/)
    assert.match(migration, /"legalAcceptance" JSONB NOT NULL,(?!\s*DEFAULT)/)
    assert.match(migration, /jsonb_typeof\("legalAcceptance"->'documentIds'\) = 'array'/)
    assert.match(migration, /jsonb_array_length\("legalAcceptance"->'documentIds'\) > 0/)
    assert.match(migration, /jsonb_typeof\("legalAcceptance"->'documentVersions'\) = 'object'/)
    assert.match(migration, /"legalAcceptance"->'documentVersions' <> '\{\}'::jsonb/)
    assert.match(migration, /"legalAcceptance" @> '\{"combinedConsentAccepted": true\}'::jsonb/)
    assert.match(migration, /jsonb_typeof\("legalAcceptance"->'acceptedAt'\) = 'string'/)
  })

  it("uses composite restrictive foreign keys to keep durable acquisition history consistent", () => {
    const schemaContracts = [
      ["CommerceOrder", /@@unique\(\[id, userId\]\)/],
      ["CommercePayment", /@@unique\(\[id, orderId\]\)/],
      ["CommerceRefund", /payment\s+CommercePayment\s+@relation\(fields: \[paymentId, orderId\], references: \[id, orderId\], onDelete: Restrict/],
      ["CommerceRefund", /@@unique\(\[id, orderId\]\)/],
      ["CommerceRefundItem", /orderId\s+String/],
      ["CommerceRefundItem", /refund\s+CommerceRefund\s+@relation\(fields: \[refundId, orderId\], references: \[id, orderId\], onDelete: Restrict/],
      ["CommerceRefundItem", /orderItem\s+CommerceOrderItem\s+@relation\(fields: \[orderItemId, orderId\], references: \[id, orderId\], onDelete: Restrict/],
      ["CommerceOrderItem", /userId\s+String/],
      ["CommerceOrderItem", /order\s+CommerceOrder\s+@relation\(fields: \[orderId, userId\], references: \[id, userId\], onDelete: Restrict/],
      ["BackgroundCreditEntry", /userId\s+String[\s\S]*?redemptionBackgroundKey\s+String\s+@default\(""\)/],
      ["BackgroundCreditEntry", /wallet\s+BackgroundCreditWallet\s+@relation\(fields: \[walletId, userId\], references: \[id, userId\], onDelete: Restrict/],
      ["BackgroundCreditEntry", /@@unique\(\[id, userId, redemptionBackgroundKey\]\)/],
      ["BackgroundOwnership", /sourceProductType\s+String\s+@default\("background"\)/],
      ["BackgroundOwnership", /sourceOrderItem\s+CommerceOrderItem\?\s+@relation\(fields: \[sourceOrderItemId, userId, sourceProductType, backgroundKey\], references: \[id, userId, productType, productKey\], onDelete: Restrict/],
      ["BackgroundOwnership", /sourceCreditEntry\s+BackgroundCreditEntry\?\s+@relation\(fields: \[sourceCreditEntryId, userId, backgroundKey\], references: \[id, userId, redemptionBackgroundKey\], onDelete: Restrict/],
      ["BackgroundOwnership", /@@unique\(\[sourceOrderItemId, userId, sourceProductType, backgroundKey\]\)/],
      ["BackgroundOwnership", /@@unique\(\[sourceCreditEntryId, userId, backgroundKey\]\)/],
    ]
    for (const [model, contract] of schemaContracts) {
      assert.match(modelBlock(model), contract)
    }

    const migrationContracts = [
      /CONSTRAINT "CommerceRefund_payment_order_consistency_fkey" FOREIGN KEY \("paymentId", "orderId"\) REFERENCES "CommercePayment"\("id", "orderId"\) ON DELETE RESTRICT/,
      /CONSTRAINT "CommerceRefundItem_refund_order_consistency_fkey" FOREIGN KEY \("refundId", "orderId"\) REFERENCES "CommerceRefund"\("id", "orderId"\) ON DELETE RESTRICT/,
      /CONSTRAINT "CommerceRefundItem_item_order_consistency_fkey" FOREIGN KEY \("orderItemId", "orderId"\) REFERENCES "CommerceOrderItem"\("id", "orderId"\) ON DELETE RESTRICT/,
      /CREATE UNIQUE INDEX "CommerceOrder_id_user_key" ON "CommerceOrder"\("id", "userId"\)/,
      /CONSTRAINT "CommerceOrderItem_order_user_consistency_fkey" FOREIGN KEY \("orderId", "userId"\) REFERENCES "CommerceOrder"\("id", "userId"\) ON DELETE RESTRICT/,
      /CREATE UNIQUE INDEX "CommerceOrderItem_id_orderId_key" ON "CommerceOrderItem"\("id", "orderId"\)/,
      /CREATE UNIQUE INDEX "CommerceOrderItem_id_user_productType_productKey_key" ON "CommerceOrderItem"\("id", "userId", "productType", "productKey"\)/,
      /CREATE UNIQUE INDEX "CommercePayment_id_orderId_key" ON "CommercePayment"\("id", "orderId"\)/,
      /CREATE UNIQUE INDEX "CommerceRefund_id_orderId_key" ON "CommerceRefund"\("id", "orderId"\)/,
      /CREATE UNIQUE INDEX "BackgroundCreditEntry_id_user_redemptionBackgroundKey_key" ON "BackgroundCreditEntry"\("id", "userId", "redemptionBackgroundKey"\)/,
      /CREATE UNIQUE INDEX "BackgroundOwnership_purchase_source_key" ON "BackgroundOwnership"\("sourceOrderItemId", "userId", "sourceProductType", "backgroundKey"\)/,
      /CREATE UNIQUE INDEX "BackgroundOwnership_credit_source_key" ON "BackgroundOwnership"\("sourceCreditEntryId", "userId", "backgroundKey"\)/,
      /CONSTRAINT "BackgroundCreditEntry_wallet_user_consistency_fkey" FOREIGN KEY \("walletId", "userId"\) REFERENCES "BackgroundCreditWallet"\("id", "userId"\) ON DELETE RESTRICT/,
      /CONSTRAINT "BackgroundOwnership_purchase_source_consistency_fkey" FOREIGN KEY \("sourceOrderItemId", "userId", "sourceProductType", "backgroundKey"\) REFERENCES "CommerceOrderItem"\("id", "userId", "productType", "productKey"\) ON DELETE RESTRICT/,
      /CONSTRAINT "BackgroundOwnership_credit_source_consistency_fkey" FOREIGN KEY \("sourceCreditEntryId", "userId", "backgroundKey"\) REFERENCES "BackgroundCreditEntry"\("id", "userId", "redemptionBackgroundKey"\) ON DELETE RESTRICT/,
    ]
    for (const contract of migrationContracts) {
      assert.match(migration, contract)
    }
  })

  it("stores checkout/legal snapshots and limited audit payloads without granting credits", () => {
    const orderContracts = [
      ["CommerceOrder", /reservationExpiresAt\s+DateTime\?/],
      ["CommerceOrder", /legalAcceptance\s+Json/],
      ["CommerceOrder", /publicId\s+String\s+@unique[\s\S]*?taxCents\s+Int/],
      ["CommerceOrder", /purchaseCountry\s+String\?/],
      ["CommerceOrder", /returnPath\s+String/],
      ["CommerceOrder", /failureCode\s+String\?/],
      ["CommerceOrder", /fulfillmentStartedAt\s+DateTime\?[\s\S]*?fulfilledAt\s+DateTime\?/],
      ["CommerceOrderItem", /allocatedTaxCents\s+Int[\s\S]*?fulfillmentAdapterVersion\s+String/],
      ["CommerceEvent", /payload\s+Json/],
      ["CommerceEvent", /source\s+String[\s\S]*?reasonCode\s+String\?/],
      ["BackgroundCreditWallet", /balance\s+Int[\s\S]*?version\s+Int/],
    ]

    for (const [model, contract] of orderContracts) {
      assert.match(modelBlock(model), contract)
    }

    assert.doesNotMatch(migration, /INSERT\s+INTO\s+"BackgroundCredit(?:Wallet|Entry)"/i)
  })
})
