import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import {
  formatMembershipPrice,
  getMembershipPricingCatalog,
  resolveMembershipPriceForInterval,
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

  it("groups six configured Stripe Prices under one Supporter offering with three amount choices", async () => {
    const env = {
      STRIPE_SUPPORTER_1_MONTHLY_PRICE_ID: "price_supporter_1_month",
      STRIPE_SUPPORTER_1_YEARLY_PRICE_ID: "price_supporter_1_year",
      STRIPE_SUPPORTER_2_MONTHLY_PRICE_ID: "price_supporter_2_month",
      STRIPE_SUPPORTER_2_YEARLY_PRICE_ID: "price_supporter_2_year",
      STRIPE_SUPPORTER_5_MONTHLY_PRICE_ID: "price_supporter_5_month",
      STRIPE_SUPPORTER_5_YEARLY_PRICE_ID: "price_supporter_5_year",
    }
    const prices = new Map([
      ["price_supporter_1_month", stripePrice({ id: "price_supporter_1_month", amount: 100, interval: "month" })],
      ["price_supporter_1_year", stripePrice({ id: "price_supporter_1_year", amount: 1000, interval: "year" })],
      ["price_supporter_2_month", stripePrice({ id: "price_supporter_2_month", amount: 200, interval: "month" })],
      ["price_supporter_2_year", stripePrice({ id: "price_supporter_2_year", amount: 2000, interval: "year" })],
      ["price_supporter_5_month", stripePrice({ id: "price_supporter_5_month", amount: 500, interval: "month" })],
      ["price_supporter_5_year", stripePrice({ id: "price_supporter_5_year", amount: 5000, interval: "year" })],
    ])
    const stripeClient = {
      prices: {
        retrieve: async (priceId) => prices.get(priceId),
      },
    }

    const catalog = await getMembershipPricingCatalog({ env, stripeClient })
    const supporter = catalog.plans[0]

    assert.equal(catalog.defaultInterval, "year")
    assert.equal(Object.hasOwn(catalog, "earlyAccess"), false)
    assert.deepEqual(catalog.intervals.map((interval) => interval.id), ["year", "month"])
    assert.equal(catalog.plans.length, 1)
    assert.equal(supporter.name, "MassageLab Supporter Membership")
    assert.deepEqual(supporter.amountChoices.map((choice) => choice.id), ["support-1", "support-2", "support-5"])
    assert.deepEqual(supporter.amountChoices.map((choice) => choice.prices.month.displayPrice), ["$1", "$2", "$5"])
    assert.deepEqual(supporter.amountChoices.map((choice) => choice.prices.year.displayPrice), ["$10", "$20", "$50"])
  })

  it("falls back safely when Stripe is not configured", async () => {
    const catalog = await getMembershipPricingCatalog({ env: {} })

    assert.equal(catalog.defaultInterval, "year")
    assert.equal(Object.hasOwn(catalog, "earlyAccess"), false)
    assert.equal(catalog.plans.length, 1)
    assert.equal(catalog.plans[0].amountChoices[0].prices.year.isConfigured, false)
    assert.equal(catalog.plans[0].amountChoices[0].prices.year.isLookupAvailable, false)
    assert.equal(catalog.plans[0].amountChoices[0].prices.year.displayPrice, "Price unavailable")
  })

  it("keeps compliance-heavy documentation goals in the single Supporter offering roadmap notes", async () => {
    const catalog = await getMembershipPricingCatalog({ env: {} })
    const [supporter] = catalog.plans

    assert.ok(
      supporter.currentFeatures.some((feature) => /all backgrounds/i.test(feature)),
      "public Current benefits should include all-background access",
    )
    assert.ok(supporter.roadmapNotes.some((note) => note.includes("compliance review")))
    assert.equal(supporter.currentFeatures.some((feature) => /BAA|transcription|SOAP drafting|managed sync/i.test(feature)), false)
  })

  it("resolves only the price configured for the requested billing interval", () => {
    const month = { id: "price_month", interval: "month" }
    const year = { id: "price_year", interval: "year" }
    const choice = { prices: { month, year } }

    assert.equal(resolveMembershipPriceForInterval(choice, "month"), month)
    assert.equal(resolveMembershipPriceForInterval(choice, "year"), year)
    assert.equal(resolveMembershipPriceForInterval({ prices: { month } }, "year"), null)
    assert.equal(resolveMembershipPriceForInterval({ prices: { year } }, "month"), null)
  })

  it("removes the obsolete live catalog setup command instead of recreating retired resources", async () => {
    const [environmentExample, readinessCheck, packageSource] = await Promise.all([
      readFile(new URL("../.env.example", import.meta.url), "utf8"),
      readFile(new URL("../scripts/stripe-readiness-check.mjs", import.meta.url), "utf8"),
      readFile(new URL("../package.json", import.meta.url), "utf8"),
    ])

    assert.doesNotMatch(environmentExample, /MASSAGELAB_EARLY_ACCESS_DISCOUNT_ENABLED/)
    assert.doesNotMatch(readinessCheck, /MASSAGELAB_EARLY_ACCESS_DISCOUNT_ENABLED|Early Access|early access/)
    assert.doesNotMatch(packageSource, /stripe:live:setup|stripe-live-membership-setup/)
    assert.match(packageSource, /stripe:migrate-supporter-membership/)
    await assert.rejects(
      readFile(new URL("../scripts/stripe-live-membership-setup.mjs", import.meta.url), "utf8"),
      (error) => error?.code === "ENOENT",
    )
  })
})
