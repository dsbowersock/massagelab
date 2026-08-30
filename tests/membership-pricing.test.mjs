import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { SUPPORTER_AMOUNT_CHOICES } from "../lib/membership.js"
import {
  MEMBERSHIP_PLAN_DETAILS,
  formatMembershipPrice,
  resolveMembershipPriceForInterval,
} from "../lib/membership-pricing.js"
import * as membershipPricing from "../lib/membership-pricing.js"
import { TARGET_PRICE_SPECS } from "../lib/stripe-supporter-membership-migration-contract.js"

const SIX_PRICE_ENVIRONMENT = Object.freeze({
  STRIPE_SUPPORTER_1_MONTHLY_PRICE_ID: "price_supporter_1_month",
  STRIPE_SUPPORTER_1_YEARLY_PRICE_ID: "price_supporter_1_year",
  STRIPE_SUPPORTER_2_MONTHLY_PRICE_ID: "price_supporter_2_month",
  STRIPE_SUPPORTER_2_YEARLY_PRICE_ID: "price_supporter_2_year",
  STRIPE_SUPPORTER_5_MONTHLY_PRICE_ID: "price_supporter_5_month",
  STRIPE_SUPPORTER_5_YEARLY_PRICE_ID: "price_supporter_5_year",
})

function stripePrice({ id, amount, currency = "usd", interval }) {
  return {
    id,
    unit_amount: amount,
    currency,
    recurring: { interval },
  }
}

function configuredStripePrices(amountOffset = 0) {
  return new Map([
    ["price_supporter_1_month", stripePrice({ id: "price_supporter_1_month", amount: 100 + amountOffset, interval: "month" })],
    ["price_supporter_1_year", stripePrice({ id: "price_supporter_1_year", amount: 1000 + amountOffset, interval: "year" })],
    ["price_supporter_2_month", stripePrice({ id: "price_supporter_2_month", amount: 200 + amountOffset, interval: "month" })],
    ["price_supporter_2_year", stripePrice({ id: "price_supporter_2_year", amount: 2000 + amountOffset, interval: "year" })],
    ["price_supporter_5_month", stripePrice({ id: "price_supporter_5_month", amount: 500 + amountOffset, interval: "month" })],
    ["price_supporter_5_year", stripePrice({ id: "price_supporter_5_year", amount: 5000 + amountOffset, interval: "year" })],
  ])
}

function createTestCatalogLoader(options) {
  assert.equal(
    typeof membershipPricing.createMembershipPricingCatalogLoader,
    "function",
    "membership pricing must expose an isolated catalog loader",
  )
  return membershipPricing.createMembershipPricingCatalogLoader(options)
}

async function loadIsolatedCatalog(options) {
  return createTestCatalogLoader(options).get()
}

describe("Membership pricing catalog", () => {
  it("leads with premium backgrounds while retaining every current Supporter benefit", () => {
    assert.deepEqual(MEMBERSHIP_PLAN_DETAILS.SUPPORTER.currentFeatures, [
      "Access to all premium backgrounds while membership is active",
      "Saved custom Chimer display and background colors",
      "Supporter status on your account",
    ])
  })

  it("keeps published migration cents derived from runtime Supporter choices", () => {
    const runtimeAmountContract = SUPPORTER_AMOUNT_CHOICES.flatMap((choice) => [
      {
        key: `${choice.id}-month`,
        interval: "month",
        unitAmount: choice.monthAmountCents,
      },
      {
        key: `${choice.id}-year`,
        interval: "year",
        unitAmount: choice.yearAmountCents,
      },
    ])

    assert.deepEqual(
      TARGET_PRICE_SPECS.map(({
        key,
        interval,
        unitAmount,
      }) => ({ key, interval, unitAmount })),
      runtimeAmountContract,
    )
  })

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

    const catalog = await loadIsolatedCatalog({ env, stripeClient })
    const supporter = catalog.plans[0]

    assert.equal(catalog.defaultInterval, "year")
    assert.equal(Object.hasOwn(catalog, "earlyAccess"), false)
    assert.deepEqual(catalog.intervals.map((interval) => interval.id), ["year", "month"])
    assert.equal(catalog.plans.length, 1)
    assert.equal(supporter.name, "MassageLab Supporter Membership")
    assert.deepEqual(supporter.amountChoices.map((choice) => choice.id), ["support-1", "support-2", "support-5"])
    assert.deepEqual(
      supporter.amountChoices.map(({
        id,
        monthAmountCents,
        yearAmountCents,
      }) => ({ id, monthAmountCents, yearAmountCents })),
      [
        { id: "support-1", monthAmountCents: 100, yearAmountCents: 1000 },
        { id: "support-2", monthAmountCents: 200, yearAmountCents: 2000 },
        { id: "support-5", monthAmountCents: 500, yearAmountCents: 5000 },
      ],
    )
    assert.equal(Object.hasOwn(supporter.amountChoices[0], "month"), false)
    assert.equal(Object.hasOwn(supporter.amountChoices[0], "year"), false)
    assert.deepEqual(supporter.amountChoices.map((choice) => choice.prices.month.displayPrice), ["$1", "$2", "$5"])
    assert.deepEqual(supporter.amountChoices.map((choice) => choice.prices.year.displayPrice), ["$10", "$20", "$50"])
    assert.deepEqual(supporter.amountChoices[0].prices.month, {
      membershipLevel: "SUPPORTER",
      interval: "month",
      priceId: "price_supporter_1_month",
      unitAmount: 100,
      currency: "usd",
      displayPrice: "$1",
      displayInterval: "/month",
      isConfigured: true,
      isLookupAvailable: true,
      yearlySavings: null,
    })
    assert.deepEqual(supporter.amountChoices[0].prices.year, {
      membershipLevel: "SUPPORTER",
      interval: "year",
      priceId: "price_supporter_1_year",
      unitAmount: 1000,
      currency: "usd",
      displayPrice: "$10",
      displayInterval: "/year",
      isConfigured: true,
      isLookupAvailable: true,
      yearlySavings: {
        amount: 200,
        currency: "usd",
        displayAmount: "$2",
        percent: 17,
        description: "Save $2 per year vs monthly",
      },
    })
  })

  it("falls back safely when Stripe is not configured", async () => {
    const catalog = await loadIsolatedCatalog({ env: {} })

    assert.equal(catalog.defaultInterval, "year")
    assert.equal(Object.hasOwn(catalog, "earlyAccess"), false)
    assert.equal(catalog.plans.length, 1)
    assert.equal(catalog.plans[0].amountChoices[0].prices.year.isConfigured, false)
    assert.equal(catalog.plans[0].amountChoices[0].prices.year.isLookupAvailable, false)
    assert.equal(catalog.plans[0].amountChoices[0].prices.year.displayPrice, "Price unavailable")
    assert.deepEqual(catalog.plans[0].amountChoices[0].prices.year, {
      membershipLevel: "SUPPORTER",
      interval: "year",
      priceId: null,
      unitAmount: null,
      currency: "usd",
      displayPrice: "Price unavailable",
      displayInterval: "/year",
      isConfigured: false,
      isLookupAvailable: false,
      yearlySavings: null,
    })
  })

  it("preserves configured yearly Price identity when Stripe lookup fails", async () => {
    const catalog = await loadIsolatedCatalog({
      env: {
        STRIPE_SUPPORTER_1_YEARLY_PRICE_ID: "price_supporter_1_year",
      },
      stripeClient: {
        prices: {
          retrieve: async () => {
            throw new Error("Stripe lookup unavailable")
          },
        },
      },
    })
    const yearlyPrice = catalog.plans[0].amountChoices[0].prices.year

    assert.equal(yearlyPrice.priceId, "price_supporter_1_year")
    assert.equal(yearlyPrice.isConfigured, true)
    assert.equal(yearlyPrice.isLookupAvailable, false)
    assert.equal(yearlyPrice.unitAmount, null)
    assert.equal(yearlyPrice.displayPrice, "Price unavailable")
  })

  it("keeps compliance-heavy documentation goals in the single Supporter offering roadmap notes", async () => {
    const catalog = await loadIsolatedCatalog({ env: {} })
    const [supporter] = catalog.plans

    assert.ok(
      supporter.currentFeatures.some((feature) => /all premium backgrounds/i.test(feature)),
      "public Current benefits should include all-background access",
    )
    assert.ok(supporter.roadmapNotes.some((note) => note.includes("compliance review")))
    assert.equal(supporter.currentFeatures.some((feature) => /BAA|transcription|SOAP drafting|managed sync/i.test(feature)), false)
  })

  it("shares six bounded Stripe reads across concurrent cold callers and caches a complete catalog for five minutes", async () => {
    let now = 1_000
    const calls = []
    const prices = configuredStripePrices()
    const loader = createTestCatalogLoader({
      env: SIX_PRICE_ENVIRONMENT,
      now: () => now,
      stripeClient: {
        prices: {
          async retrieve(priceId, params, options) {
            calls.push({ priceId, params, options })
            return prices.get(priceId)
          },
        },
      },
    })

    const concurrent = await Promise.all(Array.from({ length: 20 }, () => loader.get()))

    assert.equal(calls.length, 6)
    assert.equal(new Set(concurrent).size, 1)
    assert.equal(calls.every(({ params }) => JSON.stringify(params) === "{}"), true)
    assert.equal(calls.every(({ options }) => (
      options.timeout === 2_500 && options.maxNetworkRetries === 1
    )), true)

    await loader.get()
    assert.equal(calls.length, 6)
    now += 299_999
    await loader.get()
    assert.equal(calls.length, 6)
    now += 1
    await loader.get()
    assert.equal(calls.length, 12)
  })

  it("uses the short TTL for an incomplete catalog and redacts provider failures", async () => {
    let now = 10_000
    const calls = []
    const prices = configuredStripePrices()
    const unavailablePriceId = "price_supporter_2_year"
    const loader = createTestCatalogLoader({
      env: SIX_PRICE_ENVIRONMENT,
      now: () => now,
      stripeClient: {
        prices: {
          async retrieve(priceId, params, options) {
            calls.push({ priceId, params, options })
            if (priceId === unavailablePriceId) {
              throw new Error("provider-internal req_secret_123 price_private_456")
            }
            return prices.get(priceId)
          },
        },
      },
    })

    const concurrent = await Promise.all(Array.from({ length: 20 }, () => loader.get()))
    const catalog = concurrent[0]

    assert.equal(calls.length, 6)
    assert.equal(new Set(concurrent).size, 1)
    assert.equal(catalog.plans[0].amountChoices[1].prices.year.displayPrice, "Price unavailable")
    assert.equal(catalog.plans[0].amountChoices[1].prices.year.isConfigured, true)
    assert.doesNotMatch(JSON.stringify(catalog), /provider-internal|req_secret_123|price_private_456/)

    now += 14_999
    await loader.get()
    assert.equal(calls.length, 6)
    now += 1
    await loader.get()
    assert.equal(calls.length, 12)
  })

  it("treats malformed currency and recurring projections as short-lived unavailable entries", async () => {
    const malformedPrices = [
      {
        label: "missing currency",
        price: stripePrice({ id: "price_supporter_1_month", amount: 100, currency: "", interval: "month" }),
      },
      {
        label: "missing recurring interval",
        price: {
          id: "price_supporter_1_month",
          unit_amount: 100,
          currency: "usd",
          recurring: null,
        },
      },
      {
        label: "mismatched recurring interval",
        price: stripePrice({ id: "price_supporter_1_month", amount: 100, interval: "year" }),
      },
    ]

    for (const { label, price } of malformedPrices) {
      let now = 15_000
      let calls = 0
      const prices = configuredStripePrices()
      prices.set("price_supporter_1_month", price)
      const loader = createTestCatalogLoader({
        env: SIX_PRICE_ENVIRONMENT,
        now: () => now,
        stripeClient: {
          prices: {
            async retrieve(priceId) {
              calls += 1
              return prices.get(priceId)
            },
          },
        },
      })

      const catalog = await loader.get()
      const projectedPrice = catalog.plans[0].amountChoices[0].prices.month

      assert.equal(projectedPrice.displayPrice, "Price unavailable", label)
      assert.equal(projectedPrice.isLookupAvailable, false, label)
      now += 15_000
      await loader.get()
      assert.equal(calls, 12, `${label} should use the incomplete TTL`)
    }
  })

  it("recovers from a failed rebuild after the short TTL", async () => {
    let now = 20_000
    const calls = []
    const prices = configuredStripePrices()
    const loader = createTestCatalogLoader({
      env: SIX_PRICE_ENVIRONMENT,
      now: () => now,
      stripeClient: {
        prices: {
          async retrieve(priceId) {
            calls.push(priceId)
            const buildNumber = Math.ceil(calls.length / 6)
            if (buildNumber === 2 && priceId === "price_supporter_5_month") {
              throw new Error("temporary provider failure with private diagnostics")
            }
            return prices.get(priceId)
          },
        },
      },
    })

    const initial = await loader.get()
    assert.equal(calls.length, 6)
    assert.equal(initial.plans[0].amountChoices[2].prices.month.isLookupAvailable, true)

    now += 300_000
    const failedRebuild = await loader.get()
    assert.equal(calls.length, 12)
    assert.equal(failedRebuild.plans[0].amountChoices[2].prices.month.displayPrice, "Price unavailable")
    assert.doesNotMatch(JSON.stringify(failedRebuild), /private diagnostics/)

    now += 14_999
    assert.equal(await loader.get(), failedRebuild)
    assert.equal(calls.length, 12)
    now += 1
    const recovered = await loader.get()
    assert.equal(calls.length, 18)
    assert.equal(recovered.plans[0].amountChoices[2].prices.month.displayPrice, "$5")
  })

  it("does not let a completion from before clear replace the newer cached catalog", async () => {
    let useOldPrices = true
    let releaseOldPrices
    const calls = []
    const oldPrices = configuredStripePrices()
    const newPrices = configuredStripePrices(5_000)
    const oldPriceGate = new Promise((resolve) => {
      releaseOldPrices = resolve
    })
    const loader = createTestCatalogLoader({
      env: SIX_PRICE_ENVIRONMENT,
      stripeClient: {
        prices: {
          async retrieve(priceId) {
            calls.push(priceId)
            const priceSet = useOldPrices ? oldPrices : newPrices
            if (useOldPrices) {
              await oldPriceGate
            }
            return priceSet.get(priceId)
          },
        },
      },
    })

    const staleBuild = loader.get()
    assert.equal(calls.length, 6)
    loader.clear()
    useOldPrices = false
    const currentCatalog = await loader.get()
    assert.equal(calls.length, 12)
    assert.equal(currentCatalog.plans[0].amountChoices[0].prices.month.displayPrice, "$51")

    releaseOldPrices()
    const staleCatalog = await staleBuild
    assert.equal(staleCatalog.plans[0].amountChoices[0].prices.month.displayPrice, "$1")
    assert.equal(await loader.get(), currentCatalog)
    assert.equal(calls.length, 12)
  })

  it("freezes a shared cached catalog so one caller cannot corrupt later display reads", async () => {
    const loader = createTestCatalogLoader({
      env: SIX_PRICE_ENVIRONMENT,
      stripeClient: {
        prices: {
          async retrieve(priceId) {
            return configuredStripePrices().get(priceId)
          },
        },
      },
    })

    const catalog = await loader.get()
    const monthPrice = catalog.plans[0].amountChoices[0].prices.month

    assert.equal(Object.isFrozen(catalog), true)
    assert.equal(Object.isFrozen(catalog.plans), true)
    assert.equal(Object.isFrozen(monthPrice), true)
    assert.throws(() => {
      monthPrice.displayPrice = "$999"
    }, TypeError)
    assert.equal((await loader.get()).plans[0].amountChoices[0].prices.month.displayPrice, "$1")
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
})
