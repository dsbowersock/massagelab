import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  formatMembershipPrice,
  getMembershipPricingCatalog,
} from "../lib/membership-pricing.js"

function stripePrice({ id, amount, currency = "usd", interval }) {
  return {
    id,
    unit_amount: amount,
    currency,
    recurring: { interval },
  }
}

describe("Membership pricing catalog", () => {
  it("formats Stripe unit amounts as readable currency prices", () => {
    assert.equal(formatMembershipPrice({ unitAmount: 900, currency: "usd" }), "$9")
    assert.equal(formatMembershipPrice({ unitAmount: 1250, currency: "usd" }), "$12.50")
  })

  it("groups configured Stripe Prices by plan and interval with yearly savings", async () => {
    const env = {
      MASSAGELAB_EARLY_ACCESS_DISCOUNT_ENABLED: "true",
      STRIPE_SUPPORTER_MONTHLY_PRICE_ID: "price_supporter_month",
      STRIPE_SUPPORTER_YEARLY_PRICE_ID: "price_supporter_year",
      STRIPE_THERAPIST_MONTHLY_PRICE_ID: "price_therapist_month",
      STRIPE_THERAPIST_YEARLY_PRICE_ID: "price_therapist_year",
      STRIPE_PRACTICE_MONTHLY_PRICE_ID: "price_practice_month",
      STRIPE_PRACTICE_YEARLY_PRICE_ID: "price_practice_year",
    }
    const prices = new Map([
      ["price_supporter_month", stripePrice({ id: "price_supporter_month", amount: 900, interval: "month" })],
      ["price_supporter_year", stripePrice({ id: "price_supporter_year", amount: 9000, interval: "year" })],
      ["price_therapist_month", stripePrice({ id: "price_therapist_month", amount: 2900, interval: "month" })],
      ["price_therapist_year", stripePrice({ id: "price_therapist_year", amount: 27900, interval: "year" })],
      ["price_practice_month", stripePrice({ id: "price_practice_month", amount: 7900, interval: "month" })],
      ["price_practice_year", stripePrice({ id: "price_practice_year", amount: 75900, interval: "year" })],
    ])
    const stripeClient = {
      prices: {
        retrieve: async (priceId) => prices.get(priceId),
      },
    }

    const catalog = await getMembershipPricingCatalog({ env, stripeClient })
    const therapist = catalog.plans.find((plan) => plan.membershipLevel === "THERAPIST")

    assert.equal(catalog.defaultInterval, "year")
    assert.equal(catalog.earlyAccess.enabled, true)
    assert.equal(catalog.earlyAccess.couponId, "E6lYinBx")
    assert.deepEqual(catalog.intervals.map((interval) => interval.id), ["year", "month"])
    assert.equal(therapist.prices.month.displayPrice, "$29")
    assert.equal(therapist.prices.year.displayPrice, "$279")
    assert.equal(therapist.prices.year.yearlySavings.displayAmount, "$69")
    assert.equal(therapist.prices.year.yearlySavings.description, "Save $69 per year vs monthly")
  })

  it("falls back safely when Stripe is not configured", async () => {
    const catalog = await getMembershipPricingCatalog({ env: {} })

    assert.equal(catalog.defaultInterval, "year")
    assert.equal(catalog.earlyAccess.enabled, false)
    assert.equal(catalog.plans.length, 3)
    assert.equal(catalog.plans[0].prices.year.isConfigured, false)
    assert.equal(catalog.plans[0].prices.year.isLookupAvailable, false)
    assert.equal(catalog.plans[0].prices.year.displayPrice, "Price unavailable")
  })
})
