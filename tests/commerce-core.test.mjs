import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"
import { backgroundRegistry } from "../components/backgrounds/backgroundRegistry.ts"
import {
  BACKGROUND_UNIT_AMOUNT,
  COMMERCE_CURRENCY,
  COMMERCE_MAX_CART_ITEM_QUANTITY,
  COMMERCE_PRODUCT_BACKGROUND,
  CHECKOUT_RESERVATION_MINUTES,
  COMMERCE_PURCHASE_COUNTRIES,
} from "../lib/commerce/constants.js"
import { COMMERCE_ERROR_CODES, CommerceError, asPublicCommerceError } from "../lib/commerce/errors.ts"
import {
  assertCommerceCartQuantity,
  getCommerceTaxReadiness,
  normalizeCommerceReturnPath,
  resolveCommerceProduct,
} from "../lib/commerce/catalog.ts"
import { runCommerceTransaction } from "../lib/commerce/transactions.ts"

describe("Commerce domain contracts", () => {
  it("locks fixed amount, currency, and reservation duration", () => {
    assert.equal(COMMERCE_PRODUCT_BACKGROUND, "background")
    assert.equal(BACKGROUND_UNIT_AMOUNT, 100)
    assert.equal(COMMERCE_CURRENCY, "usd")
    assert.equal(CHECKOUT_RESERVATION_MINUTES, 30)
    assert.deepEqual(COMMERCE_PURCHASE_COUNTRIES, ["US"])
    assert.equal(COMMERCE_MAX_CART_ITEM_QUANTITY, 1)
  })

  it("resolves enabled premium background catalog entries with stable product snapshots", () => {
    const enabledPremiumEntries = backgroundRegistry
      .filter((entry) => entry.requiresSubscription && entry.enabled)
      .sort((left, right) => left.id.localeCompare(right.id))
    assert.ok(enabledPremiumEntries.length > 0)

    const seenIds = new Set()
    for (const entry of enabledPremiumEntries) {
      const product = resolveCommerceProduct(COMMERCE_PRODUCT_BACKGROUND, entry.id)
      assert.equal(product.productType, COMMERCE_PRODUCT_BACKGROUND)
      assert.equal(product.productKey, entry.id)
      assert.equal(product.unitAmount, BACKGROUND_UNIT_AMOUNT)
      assert.equal(product.unitAmount, 100)
      assert.equal(product.currency, COMMERCE_CURRENCY)
      assert.equal(product.availableForPurchase, true)
      assert.equal(seenIds.has(product.productKey), false)
      seenIds.add(product.productKey)
    }
  })

  it("rejects unavailable, non-subscription, and unknown catalog products", () => {
    const unavailableId = "massage-lab-noise-texture-draft"
    assert.equal(backgroundRegistry.find((entry) => entry.id === unavailableId)?.enabled, false)
    assert.equal(backgroundRegistry.find((entry) => entry.id === unavailableId)?.requiresSubscription, true)
    assert.throws(
      () => {
        resolveCommerceProduct(COMMERCE_PRODUCT_BACKGROUND, unavailableId)
      },
      (error) => {
        assert.equal(error instanceof CommerceError, true)
        assert.equal(error.code, COMMERCE_ERROR_CODES.CATALOG_UNAVAILABLE)
        return true
      },
    )

    assert.throws(
      () => {
        resolveCommerceProduct(COMMERCE_PRODUCT_BACKGROUND, "static-gradient")
      },
      (error) => {
        assert.equal(error instanceof CommerceError, true)
        assert.equal(error.code, COMMERCE_ERROR_CODES.CATALOG_UNAVAILABLE)
        return true
      },
    )

    assert.throws(
      () => {
        resolveCommerceProduct("music", "massage-lab-retro-grid")
      },
      (error) => {
        assert.equal(error instanceof CommerceError, true)
        assert.equal(error.code, COMMERCE_ERROR_CODES.CATALOG_UNAVAILABLE)
        return true
      },
    )
  })

  it("bounds cart quantities to one item per background", () => {
    assert.equal(COMMERCE_MAX_CART_ITEM_QUANTITY, 1)
    assert.doesNotThrow(() => assertCommerceCartQuantity(1))
    assert.throws(() => assertCommerceCartQuantity(2), (error) => {
      assert.equal(error instanceof CommerceError, true)
      return true
    })
  })

  it("normalizes return paths safely", () => {
    assert.equal(normalizeCommerceReturnPath("/account/billing?tab=music"), "/account/billing")
    assert.equal(normalizeCommerceReturnPath("/account/billing#top"), "/account/billing")
    assert.equal(normalizeCommerceReturnPath("account/billing"), "/account/billing")
    assert.equal(normalizeCommerceReturnPath("   /visual/settings/   "), "/visual/settings")
    assert.equal(normalizeCommerceReturnPath("../admin"), "/admin")
    assert.equal(normalizeCommerceReturnPath(null), "/")
    assert.equal(normalizeCommerceReturnPath("https://example.com/callback"), "/")

    const longRelativePath = "backgrounds/".concat("a".repeat(80))
    assert.equal(normalizeCommerceReturnPath(longRelativePath).length, 64)
  })

  it("detects explicit and disabled tax readiness states", () => {
    const disabled = getCommerceTaxReadiness({})
    assert.equal(disabled.mode, "disabled")
    assert.equal(disabled.ready, true)
    assert.equal(disabled.taxCode, null)

    const missingCode = getCommerceTaxReadiness({
      BACKGROUND_COMMERCE_TAX_MODE: "stripe",
    })
    assert.equal(missingCode.mode, "stripe")
    assert.equal(missingCode.ready, false)
    assert.equal(missingCode.taxCode, null)

    const onlyTaxCode = getCommerceTaxReadiness({
      BACKGROUND_COMMERCE_TAX_MODE: "stripe",
      BACKGROUND_COMMERCE_TAX_PRODUCT_CODE: "txcd_999999",
    })
    assert.equal(onlyTaxCode.mode, "stripe")
    assert.equal(onlyTaxCode.ready, false)
    assert.equal(onlyTaxCode.taxCode, "txcd_999999")

    const ready = getCommerceTaxReadiness({
      BACKGROUND_COMMERCE_TAX_MODE: "stripe",
      BACKGROUND_COMMERCE_TAX_PRODUCT_CODE: "txcd_999999",
      BACKGROUND_COMMERCE_TAX_PROVIDER_READY: "true",
      BACKGROUND_COMMERCE_TAX_REGISTRATIONS_READY: "true",
    })
    assert.equal(ready.mode, "stripe")
    assert.equal(ready.ready, true)
    assert.equal(ready.taxCode, "txcd_999999")
  })

  it("returns stable public error codes for non-domain details", () => {
    const publicError = asPublicCommerceError(new Error("stripe timeout"))
    assert.equal(publicError.code, COMMERCE_ERROR_CODES.UNKNOWN)
    assert.equal(publicError.status, 500)
    assert.equal(publicError.message, "Unexpected commerce processing error.")
  })

  it("sanitizes existing domain errors before they become public", () => {
    const internalError = new CommerceError({
      code: COMMERCE_ERROR_CODES.CATALOG_UNAVAILABLE,
      message: "Stripe product prod_secret does not exist",
      status: 502,
      cause: new Error("database connection password=not-for-clients"),
    })
    const publicError = asPublicCommerceError(internalError)

    assert.notEqual(publicError, internalError)
    assert.equal(publicError.code, COMMERCE_ERROR_CODES.CATALOG_UNAVAILABLE)
    assert.equal(publicError.status, 404)
    assert.equal(publicError.message, "This item is not available for purchase.")
    assert.equal("cause" in publicError, false)
    assert.doesNotMatch(JSON.stringify(publicError), /prod_secret|password/)
  })

  it("documents the pooled Neon transaction constraints", () => {
    const source = readFileSync(new URL("../lib/commerce/transactions.ts", import.meta.url), "utf8")

    assert.match(source, /pooled Neon/i)
    assert.match(source, /session advisory locks/i)
    assert.match(source, /database-only/i)
    assert.match(source, /Stripe\/network I\/O/i)
    assert.match(source, /unique\/check constraints/i)
    assert.match(source, /predicate updates/i)
  })

  it("retries short transaction work using serializable isolation", async () => {
    let transactionCalls = 0
    const conflict = new Error("conflict")
    conflict.code = "P2034"

    const prisma = {
      async $transaction(callback, options) {
        transactionCalls += 1
        assert.equal(options?.isolationLevel, "Serializable")

        if (transactionCalls === 1) {
          throw conflict
        }

        return callback({ startedAt: "attempt-two" })
      },
    }

    const result = await runCommerceTransaction(prisma, async (tx) => {
      assert.equal(tx.startedAt, "attempt-two")
      return "ok"
    }, { maxRetries: 3 })

    assert.equal(result, "ok")
    assert.equal(transactionCalls, 2)
  })
})
