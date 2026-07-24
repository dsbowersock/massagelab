import {
  BILLING_INTERVALS,
  SUPPORTER_AMOUNT_CHOICES,
  getConfiguredMembershipOptions,
} from "./membership.js"
import {
  getStripeSecretKey,
  retrieveStripePrice,
} from "./stripe-billing.js"

export const MEMBERSHIP_PLAN_DETAILS = Object.freeze({
  SUPPORTER: {
    name: "MassageLab Supporter Membership",
    eyebrow: "Alpha support",
    description: "For users who want the current Chimer color and background upgrades and want to help keep MassageLab development moving without ads or data sales.",
    currentFeatures: [
      "Saved custom Chimer display colors",
      "Saved custom Chimer background colors",
      "Access to all backgrounds",
      "Paid membership status on your account",
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

function levelName(membershipLevel) {
  return MEMBERSHIP_PLAN_DETAILS[membershipLevel]?.name ?? titleCase(membershipLevel)
}

function titleCase(value) {
  return String(value ?? "")
    .toLowerCase()
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

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

async function retrieveConfiguredPrice(option, { stripeClient, env }) {
  if (!option.priceId) {
    return emptyPrice(option)
  }

  const canLookup = stripeClient || getStripeSecretKey(env)
  if (!canLookup) {
    return emptyPrice(option)
  }

  try {
    const price = stripeClient
      ? await stripeClient.prices.retrieve(option.priceId)
      : await retrieveStripePrice(option.priceId, { apiKey: getStripeSecretKey(env) })

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
 * Builds the public Supporter pricing catalog by retrieving each configured
 * Stripe Price. Missing configuration and unreadable Prices remain visible as
 * unavailable entries instead of throwing so pricing surfaces fail gracefully.
 * Returns a catalog shaped as `{ defaultInterval, intervals, plans }`.
 *
 * @param {{ env?: NodeJS.ProcessEnv | Record<string, string | undefined>, stripeClient?: { prices: { retrieve: (priceId: string) => Promise<unknown> } } }} [input]
 */
export async function getMembershipPricingCatalog({ env = process.env, stripeClient } = {}) {
  const configuredOptions = getConfiguredMembershipOptions(env)
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

      return retrieveConfiguredPrice(option, { stripeClient, env })
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
    name: levelName("SUPPORTER"),
    amountChoices,
  }]

  return {
    defaultInterval: "year",
    intervals: PRICING_INTERVALS,
    plans,
  }
}
