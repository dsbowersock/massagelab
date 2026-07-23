import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { describe, it } from "node:test"

const membershipPrices = {
  STRIPE_SUPPORTER_MONTHLY_PRICE_ID: "price_supporter_monthly",
  STRIPE_SUPPORTER_YEARLY_PRICE_ID: "price_supporter_yearly",
  STRIPE_THERAPIST_MONTHLY_PRICE_ID: "price_therapist_monthly",
  STRIPE_THERAPIST_YEARLY_PRICE_ID: "price_therapist_yearly",
  STRIPE_PRACTICE_MONTHLY_PRICE_ID: "price_practice_monthly",
  STRIPE_PRACTICE_YEARLY_PRICE_ID: "price_practice_yearly",
}

function runReadiness(overrides = {}, args = []) {
  return spawnSync(process.execPath, ["scripts/stripe-readiness-check.mjs", "--no-dotenv", ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      PATH: process.env.PATH,
      STRIPE_SECRET_KEY: "sk_test_readiness",
      STRIPE_WEBHOOK_SECRET: "whsec_readiness",
      MASSAGELAB_EARLY_ACCESS_DISCOUNT_ENABLED: "false",
      BACKGROUND_COMMERCE_PURCHASING_ENABLED: "true",
      BACKGROUND_COMMERCE_PRICE_CENTS: "100",
      BACKGROUND_COMMERCE_CURRENCY: "usd",
      BACKGROUND_COMMERCE_PURCHASE_COUNTRIES: "US",
      BACKGROUND_COMMERCE_DIGITAL_PURCHASE_DOCUMENT_VERSION: "2026-07-digital-purchases-v2",
      BACKGROUND_COMMERCE_WEBHOOK_READY: "true",
      BACKGROUND_COMMERCE_WEBHOOK_EVENTS: "checkout.session.completed,checkout.session.expired,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,refund.created,refund.updated,refund.failed,charge.dispute.created,charge.dispute.updated,charge.dispute.closed",
      BACKGROUND_COMMERCE_RECONCILIATION_READY: "true",
      BACKGROUND_COMMERCE_TAX_MODE: "stripe",
      BACKGROUND_COMMERCE_TAX_PRODUCT_CODE: "txcd_10000000",
      BACKGROUND_COMMERCE_TAX_PROVIDER_READY: "true",
      BACKGROUND_COMMERCE_TAX_REGISTRATIONS_READY: "true",
      ...membershipPrices,
      ...overrides,
    },
  })
}

describe("Stripe readiness background-commerce contract", () => {
  it("reports the complete fail-closed commerce configuration without changing membership readiness output", () => {
    const result = runReadiness()

    assert.equal(result.status, 0, result.stderr || result.stdout)
    assert.match(result.stdout, /PASS Stripe membership environment is ready for the selected mode\./)
    assert.match(result.stdout, /Background commerce readiness: ready/)
    assert.match(result.stdout, /Background commerce fixed USD price configured: true/)
    assert.match(result.stdout, /Background commerce webhook event coverage complete: true/)
    assert.doesNotMatch(result.stdout, /sk_test_readiness|whsec_readiness/)
  })

  it("fails when any required commerce webhook event is absent", () => {
    const result = runReadiness({
      BACKGROUND_COMMERCE_WEBHOOK_EVENTS: "checkout.session.completed,refund.created",
    })

    assert.equal(result.status, 1)
    assert.match(result.stderr, /FAIL Background commerce webhook event coverage is incomplete\./)
    assert.doesNotMatch(`${result.stdout}${result.stderr}`, /sk_test_readiness|whsec_readiness/)
  })

  it("fails when the configured commerce webhook contract includes unrecognized extras", () => {
    const result = runReadiness({
      BACKGROUND_COMMERCE_WEBHOOK_EVENTS: "checkout.session.completed,checkout.session.expired,checkout.session.async_payment_succeeded,checkout.session.async_payment_failed,refund.created,refund.updated,refund.failed,charge.dispute.created,charge.dispute.updated,charge.dispute.closed,customer.created",
    })

    assert.equal(result.status, 1)
    assert.match(result.stderr, /FAIL Background commerce webhook event coverage is incomplete\./)
  })

  it("fails closed on stale price, currency, country, document, webhook, reconciliation, and tax settings", () => {
    const cases = [
      ["price", { BACKGROUND_COMMERCE_PRICE_CENTS: "200" }],
      ["currency", { BACKGROUND_COMMERCE_CURRENCY: "cad" }],
      ["country", { BACKGROUND_COMMERCE_PURCHASE_COUNTRIES: "CA" }],
      ["document", { BACKGROUND_COMMERCE_DIGITAL_PURCHASE_DOCUMENT_VERSION: "stale" }],
      ["webhook", { BACKGROUND_COMMERCE_WEBHOOK_READY: "false" }],
      ["reconciliation", { BACKGROUND_COMMERCE_RECONCILIATION_READY: "false" }],
      ["tax", { BACKGROUND_COMMERCE_TAX_MODE: "unknown" }],
      ["tax code", { BACKGROUND_COMMERCE_TAX_PRODUCT_CODE: "" }],
      ["wrong tax code", { BACKGROUND_COMMERCE_TAX_PRODUCT_CODE: "txcd_10202003" }],
      ["tax provider", { BACKGROUND_COMMERCE_TAX_PROVIDER_READY: "false" }],
      ["tax registrations", { BACKGROUND_COMMERCE_TAX_REGISTRATIONS_READY: "false" }],
    ]

    for (const [name, overrides] of cases) {
      const result = runReadiness(overrides)
      assert.equal(result.status, 1, `${name}: ${result.stdout}${result.stderr}`)
      assert.match(result.stderr, /FAIL Background commerce/, name)
    }
  })

  it("rejects live international commerce while background purchases remain U.S.-only", () => {
    const result = runReadiness({
      STRIPE_SECRET_KEY: "sk_live_readiness",
      BACKGROUND_COMMERCE_PURCHASE_COUNTRIES: "US,CA",
    }, ["--live"])

    assert.equal(result.status, 1)
    assert.match(result.stderr, /FAIL Background commerce purchase-country allowlist is not configured\./)
  })

  it("accepts live automatic tax only with explicit registration and product-code readiness", () => {
    const result = runReadiness({
      STRIPE_SECRET_KEY: "sk_live_readiness",
    }, ["--live"])

    assert.equal(result.status, 0, result.stderr || result.stdout)
    assert.match(result.stdout, /Background commerce tax mode: stripe/)
  })
})
