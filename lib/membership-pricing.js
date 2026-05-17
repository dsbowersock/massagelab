import {
  BILLING_INTERVALS,
  COUPON_IDS,
  PAID_MEMBERSHIP_LEVELS,
  getConfiguredMembershipOptions,
  isEarlyAccessDiscountEnabled,
} from "./membership.js"
import {
  getStripeSecretKey,
  retrieveStripePrice,
} from "./stripe-billing.js"

export const MEMBERSHIP_PLAN_DETAILS = Object.freeze({
  SUPPORTER: {
    name: "Supporter",
    eyebrow: "Alpha support",
    description: "For users who want the current Chimer color upgrade and want to help keep the private alpha moving.",
    currentFeatures: [
      "Saved custom Chimer display colors",
      "Saved custom Chimer background colors",
      "Paid membership status on your account",
    ],
    roadmapNotes: [
      "Future access experiments will start from the paid membership model.",
    ],
  },
  THERAPIST: {
    name: "Therapist",
    eyebrow: "Individual practice",
    description: "For massage therapists who expect therapist-focused documentation and education features as MassageLab grows.",
    currentFeatures: [
      "Everything in Supporter",
      "Therapist membership status on your account",
    ],
    roadmapNotes: [
      "Reserved for documentation customization",
      "Reserved for anatomy education and saved progress access",
    ],
  },
  PRACTICE: {
    name: "Practice",
    eyebrow: "Team and clinic path",
    description: "For practices that want to support the path toward practice workflows and managed sync once compliance work is ready.",
    currentFeatures: [
      "Everything in Therapist",
      "Practice membership status on your account",
    ],
    roadmapNotes: [
      "Reserved for practice management workflows",
      "Funding path for future compliant managed sync work",
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

function buildEarlyAccess(env) {
  const enabled = isEarlyAccessDiscountEnabled(env)

  return {
    enabled,
    couponId: enabled ? COUPON_IDS.earlyAccess : null,
    label: enabled ? "Development discount" : "Standard pricing",
    description: enabled
      ? "Early-access pricing applies 10% off forever at checkout while MassageLab is in development."
      : "Early-access development pricing is not enabled in this environment.",
  }
}

/**
 * @param {{ env?: NodeJS.ProcessEnv | Record<string, string | undefined>, stripeClient?: { prices: { retrieve: (priceId: string) => Promise<unknown> } } }} [input]
 */
export async function getMembershipPricingCatalog({ env = process.env, stripeClient } = {}) {
  const configuredOptions = getConfiguredMembershipOptions(env)
  const optionByKey = new Map(configuredOptions.map((option) => [
    `${option.membershipLevel}:${option.interval}`,
    option,
  ]))
  const prices = new Map()

  for (const membershipLevel of PAID_MEMBERSHIP_LEVELS) {
    for (const interval of BILLING_INTERVALS) {
      const configuredOption = optionByKey.get(`${membershipLevel}:${interval}`)
      const option = configuredOption ?? { membershipLevel, interval, priceId: null }
      const price = await retrieveConfiguredPrice(option, { stripeClient, env })
      prices.set(`${membershipLevel}:${interval}`, price)
    }
  }

  const plans = PAID_MEMBERSHIP_LEVELS.map((membershipLevel) => {
    const month = prices.get(`${membershipLevel}:month`)
    const year = prices.get(`${membershipLevel}:year`)
    const savings = yearlySavings(month, year)

    if (savings) {
      year.yearlySavings = savings
    }

    return {
      membershipLevel,
      ...MEMBERSHIP_PLAN_DETAILS[membershipLevel],
      name: levelName(membershipLevel),
      prices: {
        month,
        year,
      },
    }
  })

  return {
    defaultInterval: "year",
    intervals: PRICING_INTERVALS,
    earlyAccess: buildEarlyAccess(env),
    plans,
  }
}
