export const FEATURE_KEYS = Object.freeze({
  chimerCustomColors: "chimer_custom_colors",
  premiumBackgrounds: "premium_backgrounds",
  therapistDocumentationTools: "therapist_documentation_tools",
  documentationCustomization: "documentation_customization",
  anatomySavedProgress: "anatomy_saved_progress",
  educationPremiumContent: "education_premium_content",
  practiceManagement: "practice_management",
  calendarBasicScheduling: "calendar_basic_scheduling",
  calendarFullScheduling: "calendar_full_scheduling",
  calendarTeamScheduling: "calendar_team_scheduling",
  externalCalendarSync: "external_calendar_sync",
  cloudStorage: "cloud_storage",
  phiStorageTools: "phi_storage_tools",
})

export const STUDENT_ACCESS_MONTHS = 18

export const MEMBERSHIP_LEVELS = Object.freeze(["FREE", "STUDENT", "SUPPORTER", "THERAPIST", "PRACTICE"])
export const PAID_MEMBERSHIP_LEVELS = Object.freeze(["SUPPORTER", "THERAPIST", "PRACTICE"])
export const BILLING_INTERVALS = Object.freeze(["month", "year"])
export const SUPPORTER_AMOUNT_CHOICES = Object.freeze([
  Object.freeze({ id: "support-1", month: 100, year: 1000 }),
  Object.freeze({ id: "support-2", month: 200, year: 2000 }),
  Object.freeze({ id: "support-5", month: 500, year: 5000 }),
])

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"])
const CHECKOUT_BLOCKING_SUBSCRIPTION_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "paused",
  "incomplete",
])
const TERMINAL_SUBSCRIPTION_STATUSES = new Set(["canceled", "incomplete_expired"])
const MEMBERSHIP_RANK = Object.freeze({
  FREE: 0,
  STUDENT: 1,
  SUPPORTER: 2,
  THERAPIST: 3,
  PRACTICE: 4,
})
const PAID_FEATURES = Object.freeze([
  FEATURE_KEYS.chimerCustomColors,
  FEATURE_KEYS.premiumBackgrounds,
])
const BASIC_CALENDAR_FEATURES = Object.freeze([
  FEATURE_KEYS.calendarBasicScheduling,
])
const THERAPIST_CALENDAR_FEATURES = Object.freeze([
  FEATURE_KEYS.calendarFullScheduling,
  FEATURE_KEYS.externalCalendarSync,
])
const THERAPIST_DOCUMENTATION_FEATURES = Object.freeze([
  FEATURE_KEYS.therapistDocumentationTools,
])
const TEAM_PRACTICE_CALENDAR_FEATURES = Object.freeze([
  FEATURE_KEYS.calendarTeamScheduling,
])
const COLOR_FEATURE_PLANS = new Set(PAID_MEMBERSHIP_LEVELS)
const HISTORICAL_STRIPE_PRICE_ENVIRONMENT = Object.freeze([
  Object.freeze(["STRIPE_SUPPORTER_MONTHLY_PRICE_ID", "SUPPORTER"]),
  Object.freeze(["STRIPE_SUPPORTER_YEARLY_PRICE_ID", "SUPPORTER"]),
  Object.freeze(["STRIPE_THERAPIST_MONTHLY_PRICE_ID", "THERAPIST"]),
  Object.freeze(["STRIPE_THERAPIST_YEARLY_PRICE_ID", "THERAPIST"]),
  Object.freeze(["STRIPE_PRACTICE_MONTHLY_PRICE_ID", "PRACTICE"]),
  Object.freeze(["STRIPE_PRACTICE_YEARLY_PRICE_ID", "PRACTICE"]),
])

export function isMembershipLevel(value) {
  return typeof value === "string" && MEMBERSHIP_LEVELS.includes(value.toUpperCase())
}

export function isPaidMembershipLevel(value) {
  return typeof value === "string" && PAID_MEMBERSHIP_LEVELS.includes(value.toUpperCase())
}

export function normalizeMembershipLevel(value, fallback = "FREE") {
  return isMembershipLevel(value) ? value.toUpperCase() : fallback
}

export function isBillingInterval(value) {
  return BILLING_INTERVALS.includes(value)
}

export function isActiveSubscriptionStatus(status) {
  return ACTIVE_SUBSCRIPTION_STATUSES.has(String(status ?? "").toLowerCase())
}

/**
 * Treats persisted Stripe states that still need billing management as
 * authoritative. Historical Therapist/Practice records intentionally use the
 * same rule so a catalog rename cannot open a parallel Supporter subscription.
 *
 * @param {Array<{
 *   status?: string | null
 *   cancelAtPeriodEnd?: boolean | null
 *   cancel_at_period_end?: boolean | null
 * }>} subscriptions
 */
export function hasSubscriptionBlockingNewCheckout(subscriptions = []) {
  return subscriptions.some((subscription) => {
    const status = String(subscription?.status ?? "").toLowerCase()
    const hasPendingCancellation = subscription?.cancelAtPeriodEnd === true
      || subscription?.cancel_at_period_end === true

    return CHECKOUT_BLOCKING_SUBSCRIPTION_STATUSES.has(status)
      || (hasPendingCancellation && !TERMINAL_SUBSCRIPTION_STATUSES.has(status))
  })
}

/**
 * Selects the only safe pricing action for the current account state.
 * Existing subscribers manage all amount changes through Customer Portal.
 *
 * @param {{
 *   signedIn?: boolean
 *   subscriptions?: Array<{
 *     status?: string | null
 *     cancelAtPeriodEnd?: boolean | null
 *     cancel_at_period_end?: boolean | null
 *   }>
 * }} [input]
 * @returns {"auth" | "portal" | "checkout"}
 */
export function resolveMembershipPricingMode({
  signedIn = false,
  subscriptions = [],
} = {}) {
  if (!signedIn) {
    return "auth"
  }

  return hasSubscriptionBlockingNewCheckout(subscriptions)
    ? "portal"
    : "checkout"
}

export function hasFeature(features, featureKey) {
  return Array.isArray(features) && features.includes(featureKey)
}

// Premium backgrounds intentionally remain independent from chimerCustomColors.
export function hasPremiumBackgroundAccess(features) {
  return hasFeature(features, FEATURE_KEYS.premiumBackgrounds)
}

function activeSubscription(subscription, now) {
  if (!isActiveSubscriptionStatus(subscription?.status)) {
    return false
  }

  if (!subscription.currentPeriodEnd) {
    return true
  }

  return new Date(subscription.currentPeriodEnd).getTime() > now.getTime()
}

function bestMembershipLevel(levels) {
  return levels.reduce((best, level) => (
    (MEMBERSHIP_RANK[level] ?? 0) > (MEMBERSHIP_RANK[best] ?? 0) ? level : best
  ), "FREE")
}

/**
 * @param {{
 *   subscriptions?: Array<{
 *     status?: string | null
 *     membershipLevel?: string | null
 *     currentPeriodEnd?: Date | string | null
 *   }>
 *   studentAccess?: {
 *     studentStatus?: string | null
 *     studentAccessExpiresAt?: Date | string | null
 *     eligibleForTherapistDiscount?: boolean
 *   } | null
 *   now?: Date
 * }} [input]
 */
export function buildEntitlements({ subscriptions = [], studentAccess = null, now = new Date() } = {}) {
  const activePaidLevels = subscriptions
    .filter((subscription) => activeSubscription(subscription, now))
    .map((subscription) => normalizeMembershipLevel(subscription.membershipLevel))
    .filter((level) => PAID_MEMBERSHIP_LEVELS.includes(level))
  const studentStatus = normalizeStudentStatus(studentAccess?.studentStatus)
  const hasActiveStudentAccess = studentStatus === "ACTIVE" &&
    (!studentAccess?.studentAccessExpiresAt || new Date(studentAccess.studentAccessExpiresAt).getTime() > now.getTime())
  const level = activePaidLevels.length > 0
    ? bestMembershipLevel(activePaidLevels)
    : hasActiveStudentAccess ? "STUDENT" : "FREE"
  const features = [
    ...BASIC_CALENDAR_FEATURES,
    ...(COLOR_FEATURE_PLANS.has(level) ? PAID_FEATURES : []),
    ...(level === "THERAPIST" || level === "PRACTICE" ? THERAPIST_DOCUMENTATION_FEATURES : []),
    ...(level === "THERAPIST" || level === "PRACTICE" ? THERAPIST_CALENDAR_FEATURES : []),
    ...(level === "PRACTICE" ? TEAM_PRACTICE_CALENDAR_FEATURES : []),
  ]

  return {
    level,
    paidLevel: activePaidLevels.length > 0 ? bestMembershipLevel(activePaidLevels) : null,
    features,
    studentStatus: hasActiveStudentAccess ? "ACTIVE" : studentStatus,
    hasFeature: (featureKey) => hasFeature(features, featureKey),
  }
}

export function normalizeStudentStatus(value) {
  if (value === "ACTIVE" || value === "EXPIRED" || value === "REVOKED") {
    return value
  }

  return "EXPIRED"
}

export function addMonths(date, months) {
  const source = new Date(date)
  const result = new Date(Date.UTC(
    source.getUTCFullYear(),
    source.getUTCMonth() + months,
    1,
    source.getUTCHours(),
    source.getUTCMinutes(),
    source.getUTCSeconds(),
    source.getUTCMilliseconds(),
  ))
  const lastDayOfTargetMonth = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate()
  result.setUTCDate(Math.min(source.getUTCDate(), lastDayOfTargetMonth))
  return result
}

/**
 * @param {{ studentStartDate?: Date | string | null, now?: Date, revoked?: boolean }} [input]
 */
export function buildStudentAccessState({ studentStartDate, now = new Date(), revoked = false } = {}) {
  if (!studentStartDate) {
    return null
  }

  const startDate = new Date(studentStartDate)
  const studentAccessExpiresAt = addMonths(startDate, STUDENT_ACCESS_MONTHS)
  const studentStatus = revoked
    ? "REVOKED"
    : studentAccessExpiresAt.getTime() > now.getTime() ? "ACTIVE" : "EXPIRED"

  return {
    studentStartDate: startDate,
    studentAccessExpiresAt,
    studentStatus,
    eligibleForTherapistDiscount: !revoked,
  }
}

export function isStudentTherapistUpgradeEligible(studentAccess, now = new Date()) {
  if (!studentAccess?.eligibleForTherapistDiscount) {
    return false
  }

  const status = normalizeStudentStatus(studentAccess.studentStatus)
  if (status === "REVOKED") {
    return false
  }

  if (!studentAccess.studentStartDate) {
    return false
  }

  const computed = buildStudentAccessState({ studentStartDate: studentAccess.studentStartDate, now })
  return Boolean(computed?.eligibleForTherapistDiscount)
}

export function isSupporterAmountChoice(value) {
  return SUPPORTER_AMOUNT_CHOICES.some((choice) => choice.id === value)
}

/**
 * Restricts public Checkout to the current Supporter catalog while preserving
 * historical membership levels for webhook and database normalization.
 */
export function isPublicSupporterCheckoutSelection({
  membershipLevel,
  supporterAmountChoiceId,
  interval,
} = {}) {
  return normalizeMembershipLevel(membershipLevel) === "SUPPORTER"
    && isSupporterAmountChoice(supporterAmountChoiceId)
    && isBillingInterval(interval)
}

// Maps support-N and the billing interval to STRIPE_SUPPORTER_N_MONTHLY/YEARLY_PRICE_ID.
function supporterPriceEnvironmentKey(choiceId, interval) {
  const amount = choiceId.replace("support-", "")
  const intervalLabel = interval === "year" ? "YEARLY" : "MONTHLY"
  return `STRIPE_SUPPORTER_${amount}_${intervalLabel}_PRICE_ID`
}

/**
 * Resolves public Checkout prices for the current Supporter-only catalog.
 * Historical tiers remain readable through resolveStripePriceMembershipLevel.
 * @param {{ membershipLevel?: string, supporterAmountChoiceId?: string, interval?: string, env?: NodeJS.ProcessEnv | Record<string, string | undefined> }} [input]
 */
export function resolveStripePriceId({ membershipLevel, supporterAmountChoiceId, interval, env = process.env } = {}) {
  const normalizedLevel = normalizeMembershipLevel(membershipLevel)
  if (normalizedLevel !== "SUPPORTER" || !isSupporterAmountChoice(supporterAmountChoiceId) || !isBillingInterval(interval)) {
    return null
  }

  return env[supporterPriceEnvironmentKey(supporterAmountChoiceId, interval)]?.trim() || null
}

function resolveHistoricalStripePriceMembershipLevel(priceId, env) {
  return HISTORICAL_STRIPE_PRICE_ENVIRONMENT.find(([key]) => env[key]?.trim() === priceId)?.[1] ?? null
}

/**
 * Matches a Stripe Price across the configured Supporter amount-choice and
 * billing-interval catalog before falling back to historical plan mappings.
 */
export function resolveStripePriceMembershipLevel({ priceId, env = process.env } = {}) {
  const normalizedPriceId = typeof priceId === "string" ? priceId.trim() : ""
  if (!normalizedPriceId) {
    return null
  }

  for (const choice of SUPPORTER_AMOUNT_CHOICES) {
    for (const interval of BILLING_INTERVALS) {
      if (resolveStripePriceId({
        membershipLevel: "SUPPORTER",
        supporterAmountChoiceId: choice.id,
        interval,
        env,
      }) === normalizedPriceId) {
        return "SUPPORTER"
      }
    }
  }

  return resolveHistoricalStripePriceMembershipLevel(normalizedPriceId, env)
}

/**
 * Collects every configured Price in the Supporter amount-choice and
 * billing-interval catalog for Checkout validation and reconciliation.
 */
export function getConfiguredMembershipOptions(env = process.env) {
  const options = []

  for (const choice of SUPPORTER_AMOUNT_CHOICES) {
    for (const interval of BILLING_INTERVALS) {
      const priceId = resolveStripePriceId({
        membershipLevel: "SUPPORTER",
        supporterAmountChoiceId: choice.id,
        interval,
        env,
      })
      if (priceId) {
        options.push({ membershipLevel: "SUPPORTER", supporterAmountChoiceId: choice.id, interval, priceId })
      }
    }
  }

  return options
}

function dateTime(value) {
  return value ? new Date(value).getTime() : 0
}

export function sortMembershipSubscriptionsForDisplay(subscriptions = []) {
  return [...subscriptions].sort((left, right) => {
    const activeDelta = Number(isActiveSubscriptionStatus(right.status)) - Number(isActiveSubscriptionStatus(left.status))
    if (activeDelta !== 0) {
      return activeDelta
    }

    const periodDelta = dateTime(right.currentPeriodEnd) - dateTime(left.currentPeriodEnd)
    if (periodDelta !== 0) {
      return periodDelta
    }

    return dateTime(right.updatedAt) - dateTime(left.updatedAt)
  })
}

export function buildCheckoutSessionPayload({
  customerId,
  priceId,
  userId,
  membershipLevel,
  successUrl,
  cancelUrl,
  couponId = null,
} = {}) {
  const normalizedLevel = normalizeMembershipLevel(membershipLevel)
  const payload = {
    mode: "subscription",
    customer: customerId,
    client_reference_id: userId,
    success_url: successUrl,
    cancel_url: cancelUrl,
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    "metadata[userId]": userId,
    "metadata[membershipLevel]": normalizedLevel,
    "subscription_data[metadata][userId]": userId,
    "subscription_data[metadata][membershipLevel]": normalizedLevel,
  }

  if (couponId) {
    payload["discounts[0][coupon]"] = couponId
  }

  return payload
}

export function formEncodeStripePayload(payload) {
  const body = new URLSearchParams()

  for (const [key, value] of Object.entries(payload)) {
    if (value !== undefined && value !== null) {
      body.set(key, String(value))
    }
  }

  return body
}

export async function getUserEntitlementState(prismaClient, userId, now = new Date()) {
  const [subscriptions, studentAccess] = await Promise.all([
    prismaClient.membershipSubscription.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    }),
    prismaClient.studentAccess.findUnique({
      where: { userId },
    }),
  ])

  return buildEntitlements({ subscriptions, studentAccess, now })
}

/**
 * Loads only the persisted subscription fields needed by public Pricing.
 * This deliberately avoids Customer, StudentAccess, metadata, and full account
 * summary queries while preserving portal routing and the active paid label.
 *
 * @param {{ membershipSubscription: { findMany: Function } }} prismaClient
 * @param {string} userId
 * @param {Date} [now]
 */
export async function getUserMembershipPricingStatus(
  prismaClient,
  userId,
  now = new Date(),
) {
  const subscriptions = await prismaClient.membershipSubscription.findMany({
    where: { userId },
    select: {
      status: true,
      membershipLevel: true,
      currentPeriodEnd: true,
      cancelAtPeriodEnd: true,
    },
  })

  return {
    subscriptions,
    activeMembershipLevel: buildEntitlements({
      subscriptions,
      now,
    }).paidLevel,
  }
}

export async function getUserMembershipSummary(prismaClient, userId, now = new Date()) {
  const [stripeCustomer, subscriptions, studentAccess] = await Promise.all([
    prismaClient.stripeCustomer.findUnique({ where: { userId } }),
    prismaClient.membershipSubscription.findMany({
      where: { userId },
      orderBy: { updatedAt: "desc" },
    }),
    prismaClient.studentAccess.findUnique({ where: { userId } }),
  ])
  const entitlements = buildEntitlements({ subscriptions, studentAccess, now })
  const sortedSubscriptions = sortMembershipSubscriptionsForDisplay(subscriptions)

  return {
    stripeCustomer,
    subscriptions: sortedSubscriptions,
    studentAccess,
    entitlements,
    configuredOptions: getConfiguredMembershipOptions(),
  }
}
