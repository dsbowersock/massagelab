import {
  BILLING_INTERVALS,
  SUPPORTER_AMOUNT_CHOICES,
  getConfiguredMembershipOptions,
} from "./membership.js"
import {
  getStripeClient,
  getStripeSecretKey,
  retrieveStripePrice,
} from "./stripe-billing.js"
import { SUPPORTER_MEMBERSHIP_PRODUCT_NAME } from "./stripe-price-contract.js"

export const MEMBERSHIP_PLAN_DETAILS = Object.freeze({
  SUPPORTER: {
    name: SUPPORTER_MEMBERSHIP_PRODUCT_NAME,
    eyebrow: "Alpha support",
    description: "For users who want every premium background, saved Chimer colors, and Supporter status while helping keep MassageLab development moving without ads or data sales.",
    currentFeatures: [
      "Access to all premium backgrounds while membership is active",
      "Saved custom Chimer display and background colors",
      "Supporter status on your account",
    ],
    roadmapNotes: [
      "Funds development, secure infrastructure, compliance review, BAA/vendor work, and future privacy-preserving storage planning.",
    ],
  },
})

export const PRICING_INTERVALS = Object.freeze([
  {
    id: "year",
    label: "Yearly",
    nudge: "Best value",
    displaySuffix: "/year",
  },
  {
    id: "month",
    label: "Monthly",
    nudge: "Flexible",
    displaySuffix: "/month",
  },
])

const PRICE_UNAVAILABLE = "Price unavailable"
const MEMBERSHIP_PRICING_SUCCESS_TTL_MS = 300_000
const MEMBERSHIP_PRICING_INCOMPLETE_TTL_MS = 15_000
const STRIPE_PRICE_REQUEST_OPTIONS = Object.freeze({
  timeout: 2_500,
  maxNetworkRetries: 1,
})

function emptyPrice({ membershipLevel, interval, priceId = null }) {
  return {
    membershipLevel,
    interval,
    priceId,
    unitAmount: null,
    currency: "usd",
    displayPrice: PRICE_UNAVAILABLE,
    displayInterval: interval === "year" ? "/year" : "/month",
    isConfigured: Boolean(priceId),
    isLookupAvailable: false,
    yearlySavings: null,
  }
}

function stripePriceAmount(price) {
  return Number.isInteger(price?.unit_amount) ? price.unit_amount : null
}

function stripePriceCurrency(price) {
  return typeof price?.currency === "string" && price.currency.trim()
    ? price.currency.trim().toLowerCase()
    : "usd"
}

function stripePriceInterval(price, fallback) {
  return BILLING_INTERVALS.includes(price?.recurring?.interval) ? price.recurring.interval : fallback
}

/**
 * Returns only the price assigned to the requested billing interval. Keeping
 * this lookup exact prevents a billing tab from displaying or submitting a
 * price configured for another interval.
 *
 * @template T
 * @param {{ prices?: Partial<Record<string, T>> } | null | undefined} choice
 * @param {string} interval
 * @returns {T | null}
 */
export function resolveMembershipPriceForInterval(choice, interval) {
  return choice?.prices?.[interval] ?? null
}

export function formatMembershipPrice({ unitAmount, currency = "usd" } = {}) {
  if (!Number.isInteger(unitAmount)) {
    return PRICE_UNAVAILABLE
  }

  const value = unitAmount / 100
  const hasCents = unitAmount % 100 !== 0

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: hasCents ? 2 : 0,
  }).format(value)
}

function buildPriceFromStripe({ membershipLevel, interval, priceId, price }) {
  const unitAmount = stripePriceAmount(price)
  const hasCurrency = typeof price?.currency === "string" && Boolean(price.currency.trim())
  const hasExpectedInterval = price?.recurring?.interval === interval
  if (unitAmount === null || unitAmount < 0 || !hasCurrency || !hasExpectedInterval) {
    return emptyPrice({ membershipLevel, interval, priceId })
  }

  const currency = stripePriceCurrency(price)
  const normalizedInterval = stripePriceInterval(price, interval)

  return {
    membershipLevel,
    interval: normalizedInterval,
    priceId,
    unitAmount,
    currency,
    displayPrice: formatMembershipPrice({ unitAmount, currency }),
    displayInterval: normalizedInterval === "year" ? "/year" : "/month",
    isConfigured: true,
    isLookupAvailable: unitAmount !== null,
    yearlySavings: null,
  }
}

async function retrieveConfiguredPrice(option, { apiKey, stripeClient }) {
  if (!option.priceId) {
    return emptyPrice(option)
  }

  if (!stripeClient) {
    return emptyPrice(option)
  }

  try {
    const price = await retrieveStripePrice(option.priceId, {
      apiKey,
      stripeClient,
      requestOptions: STRIPE_PRICE_REQUEST_OPTIONS,
    })

    return buildPriceFromStripe({ ...option, price })
  } catch {
    return emptyPrice(option)
  }
}

function yearlySavings(monthPrice, yearPrice) {
  if (
    monthPrice?.unitAmount === null
    || yearPrice?.unitAmount === null
    || !Number.isInteger(monthPrice?.unitAmount)
    || !Number.isInteger(yearPrice?.unitAmount)
    || monthPrice.currency !== yearPrice.currency
  ) {
    return null
  }

  const annualizedMonthly = monthPrice.unitAmount * 12
  const savingsAmount = annualizedMonthly - yearPrice.unitAmount

  if (savingsAmount <= 0) {
    return null
  }

  const displayAmount = formatMembershipPrice({ unitAmount: savingsAmount, currency: yearPrice.currency })
  const percent = Math.round((savingsAmount / annualizedMonthly) * 100)

  return {
    amount: savingsAmount,
    currency: yearPrice.currency,
    displayAmount,
    percent,
    description: `Save ${displayAmount} per year vs monthly`,
  }
}

/**
 * Freezes the display-only catalog before it enters the shared cache so one
 * rendering caller cannot mutate the value observed by another caller.
 *
 * @template T
 * @param {T} value
 * @returns {T}
 */
function freezeCatalogValue(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) {
    return value
  }

  for (const nestedValue of Object.values(value)) {
    freezeCatalogValue(nestedValue)
  }

  return Object.freeze(value)
}

/**
 * Builds the public Supporter pricing catalog by retrieving each configured
 * Stripe Price. Missing configuration and unreadable Prices remain visible as
 * unavailable entries instead of throwing so pricing surfaces fail gracefully.
 * Returns a catalog shaped as `{ defaultInterval, intervals, plans }`.
 *
 * @param {{ env?: NodeJS.ProcessEnv | Record<string, string | undefined>, stripeClient?: { prices: { retrieve: (priceId: string, params?: Record<string, never>, options?: { timeout?: number, maxNetworkRetries?: number }) => Promise<unknown> } } }} [input]
 */
async function buildMembershipPricingCatalog({ env = process.env, stripeClient } = {}) {
  const configuredOptions = getConfiguredMembershipOptions(env)
  const apiKey = getStripeSecretKey(env)
  let resolvedStripeClient = stripeClient ?? null
  if (configuredOptions.length > 0 && apiKey && !resolvedStripeClient) {
    try {
      resolvedStripeClient = getStripeClient(apiKey)
    } catch {
      resolvedStripeClient = null
    }
  }
  const optionByKey = new Map(configuredOptions.map((option) => [
    `${option.supporterAmountChoiceId}:${option.interval}`,
    option,
  ]))
  const prices = new Map()

  const priceEntries = SUPPORTER_AMOUNT_CHOICES.flatMap((choice) => (
    BILLING_INTERVALS.map((interval) => {
      const configuredOption = optionByKey.get(`${choice.id}:${interval}`)
      const option = configuredOption ?? {
        membershipLevel: "SUPPORTER",
        supporterAmountChoiceId: choice.id,
        interval,
        priceId: null,
      }
      const key = `${choice.id}:${interval}`

      return retrieveConfiguredPrice(option, { apiKey, stripeClient: resolvedStripeClient })
        .then((price) => [key, price])
    })
  ))

  for (const [key, price] of await Promise.all(priceEntries)) {
    prices.set(key, price)
  }

  const amountChoices = SUPPORTER_AMOUNT_CHOICES.map((choice) => {
    const month = prices.get(`${choice.id}:month`)
    const year = prices.get(`${choice.id}:year`)
    const savings = yearlySavings(month, year)

    if (savings) {
      year.yearlySavings = savings
    }

    return {
      ...choice,
      prices: { month, year },
    }
  })

  const plans = [{
    membershipLevel: "SUPPORTER",
    ...MEMBERSHIP_PLAN_DETAILS.SUPPORTER,
    currentFeatures: [...MEMBERSHIP_PLAN_DETAILS.SUPPORTER.currentFeatures],
    roadmapNotes: [...MEMBERSHIP_PLAN_DETAILS.SUPPORTER.roadmapNotes],
    amountChoices,
  }]

  return freezeCatalogValue({
    defaultInterval: "year",
    intervals: PRICING_INTERVALS.map((interval) => ({ ...interval })),
    plans,
  })
}

/**
 * A long-lived display catalog may contain deliberately unconfigured slots,
 * but every configured slot must project a valid Stripe Price. Missing rows or
 * failed/malformed configured projections remain visibly unavailable, retryable
 * short-TTL results. Stale catalogs are deliberately not served because stale
 * amounts could mislead; the visible failure retries after fifteen seconds.
 */
function isStableCatalog(catalog) {
  const supporter = catalog?.plans?.find((plan) => plan.membershipLevel === "SUPPORTER")
  if (supporter?.amountChoices?.length !== SUPPORTER_AMOUNT_CHOICES.length) {
    return false
  }

  return SUPPORTER_AMOUNT_CHOICES.every((expectedChoice) => {
    const choice = supporter.amountChoices.find(({ id }) => id === expectedChoice.id)
    return BILLING_INTERVALS.every((interval) => {
      const price = choice?.prices?.[interval]
      const isStableUnconfiguredSlot = price?.priceId === null
        && price.isConfigured === false
        && price.isLookupAvailable === false
        && price.interval === interval
      const isAvailableConfiguredSlot = typeof price?.priceId === "string"
        && price.priceId.length > 0
        && price.isConfigured === true
        && price.isLookupAvailable === true
        && Number.isInteger(price.unitAmount)
        && typeof price.currency === "string"
        && price.currency.length > 0
        && price.interval === interval
      return isStableUnconfiguredSlot || isAvailableConfiguredSlot
    })
  })
}

/**
 * Owns one process-local cache of public display pricing. Concurrent callers
 * share a catalog build, stable configured/unconfigured results live for five
 * minutes, and configured lookup or projection failures retry after a short
 * interval. Expected provider failures become incomplete short-cached catalogs;
 * unexpected whole-build rejections intentionally propagate without being
 * cached so the next caller can recover immediately. Clearing advances the
 * generation so a stale provider completion cannot replace a newer catalog.
 * Promises returned before a clear still settle from their original build and
 * environment; clearing blocks only their stale cache publication.
 *
 * @param {{
 *   env?: NodeJS.ProcessEnv | Record<string, string | undefined>,
 *   stripeClient?: { prices: { retrieve: (priceId: string, params?: Record<string, never>, options?: { timeout?: number, maxNetworkRetries?: number }) => Promise<unknown> } },
 *   now?: () => number,
 *   successTtlMs?: number,
 *   incompleteTtlMs?: number,
 * }} [input]
 */
export function createMembershipPricingCatalogLoader({
  env = process.env,
  stripeClient,
  now = Date.now,
  successTtlMs = MEMBERSHIP_PRICING_SUCCESS_TTL_MS,
  incompleteTtlMs = MEMBERSHIP_PRICING_INCOMPLETE_TTL_MS,
} = {}) {
  let cachedValue
  let expiresAt = 0
  let inFlight = null
  let generation = 0

  return {
    async get() {
      if (cachedValue && now() < expiresAt) {
        return cachedValue
      }
      if (inFlight) {
        return inFlight
      }

      const loadGeneration = generation
      const loadPromise = buildMembershipPricingCatalog({ env, stripeClient })
        .then((catalog) => {
          if (loadGeneration === generation) {
            cachedValue = catalog
            expiresAt = now() + (
              isStableCatalog(catalog) ? successTtlMs : incompleteTtlMs
            )
          }
          return catalog
        })

      inFlight = loadPromise.finally(() => {
        if (loadGeneration === generation) {
          inFlight = null
        }
      })
      return inFlight
    },
    clear() {
      generation += 1
      cachedValue = undefined
      expiresAt = 0
      inFlight = null
    },
  }
}

const membershipPricingCatalogLoader = createMembershipPricingCatalogLoader()

/** Returns the shared process-local public display pricing catalog. */
export async function getMembershipPricingCatalog() {
  return membershipPricingCatalogLoader.get()
}
