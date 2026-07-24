import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { describe, it } from "node:test"
import {
  REQUIRED_SUPPORTER_PRICE_CONTRACT,
  validateRetrievedMembershipPrice,
} from "../lib/stripe-readiness.js"

const membershipPrices = {
  STRIPE_SUPPORTER_1_MONTHLY_PRICE_ID: "price_supporter_1_monthly",
  STRIPE_SUPPORTER_1_YEARLY_PRICE_ID: "price_supporter_1_yearly",
  STRIPE_SUPPORTER_2_MONTHLY_PRICE_ID: "price_supporter_2_monthly",
  STRIPE_SUPPORTER_2_YEARLY_PRICE_ID: "price_supporter_2_yearly",
  STRIPE_SUPPORTER_5_MONTHLY_PRICE_ID: "price_supporter_5_monthly",
  STRIPE_SUPPORTER_5_YEARLY_PRICE_ID: "price_supporter_5_yearly",
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
  it("requires the approved Supporter amounts during Stripe Price verification", () => {
    assert.deepEqual(
      REQUIRED_SUPPORTER_PRICE_CONTRACT.map(({ key, unitAmount }) => [key, unitAmount]),
      [
        ["STRIPE_SUPPORTER_1_MONTHLY_PRICE_ID", 100],
        ["STRIPE_SUPPORTER_1_YEARLY_PRICE_ID", 1000],
        ["STRIPE_SUPPORTER_2_MONTHLY_PRICE_ID", 200],
        ["STRIPE_SUPPORTER_2_YEARLY_PRICE_ID", 2000],
        ["STRIPE_SUPPORTER_5_MONTHLY_PRICE_ID", 500],
        ["STRIPE_SUPPORTER_5_YEARLY_PRICE_ID", 5000],
      ],
    )

    const expected = REQUIRED_SUPPORTER_PRICE_CONTRACT[2]
    assert.deepEqual(
      validateRetrievedMembershipPrice({
        active: true,
        recurring: { interval: expected.interval },
        currency: "usd",
        unit_amount: 201,
      }, expected),
      [`${expected.key} must have unit_amount ${expected.unitAmount}; received 201.`],
    )
  })
  it("requires six unique Supporter amount Prices and ignores legacy catalog variables", () => {
    const missing = runReadiness({ STRIPE_SUPPORTER_2_YEARLY_PRICE_ID: "" })
    assert.equal(missing.status, 1)
    assert.match(missing.stderr, /STRIPE_SUPPORTER_2_YEARLY_PRICE_ID is missing/)

    const duplicate = runReadiness({ STRIPE_SUPPORTER_5_YEARLY_PRICE_ID: membershipPrices.STRIPE_SUPPORTER_5_MONTHLY_PRICE_ID })
    assert.equal(duplicate.status, 1)
    assert.match(duplicate.stderr, /STRIPE_SUPPORTER_5_YEARLY_PRICE_ID duplicates STRIPE_SUPPORTER_5_MONTHLY_PRICE_ID/)

    const legacyOnly = runReadiness({
      ...Object.fromEntries(Object.keys(membershipPrices).map((key) => [key, ""])),
      STRIPE_THERAPIST_MONTHLY_PRICE_ID: "price_therapist_monthly",
      STRIPE_THERAPIST_YEARLY_PRICE_ID: "price_therapist_yearly",
      STRIPE_PRACTICE_MONTHLY_PRICE_ID: "price_practice_monthly",
      STRIPE_PRACTICE_YEARLY_PRICE_ID: "price_practice_yearly",
    })
    assert.equal(legacyOnly.status, 1)
    assert.match(legacyOnly.stderr, /STRIPE_SUPPORTER_1_MONTHLY_PRICE_ID is missing/)
  })
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
