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

export const COUPON_IDS = Object.freeze({
  studentToTherapist: "kfRFWYmC",
  earlyAccess: "E6lYinBx",
})

export const STUDENT_ACCESS_MONTHS = 18

export const MEMBERSHIP_LEVELS = Object.freeze(["FREE", "STUDENT", "SUPPORTER", "THERAPIST", "PRACTICE"])
export const PAID_MEMBERSHIP_LEVELS = Object.freeze(["SUPPORTER", "THERAPIST", "PRACTICE"])
export const BILLING_INTERVALS = Object.freeze(["month", "year"])

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"])
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

/**
 * @param {{ membershipLevel?: string, isStudentTherapistUpgrade?: boolean, earlyAccessEnabled?: boolean }} [input]
 */
export function getCheckoutDiscountCouponId({
  membershipLevel,
  isStudentTherapistUpgrade = false,
  earlyAccessEnabled = false,
} = {}) {
  const normalizedLevel = normalizeMembershipLevel(membershipLevel)

  if (normalizedLevel === "THERAPIST" && isStudentTherapistUpgrade) {
    return COUPON_IDS.studentToTherapist
  }

  return earlyAccessEnabled ? COUPON_IDS.earlyAccess : null
}

/**
 * @param {NodeJS.ProcessEnv} [env]
 */
export function isEarlyAccessDiscountEnabled(env = process.env) {
  return String(env.MASSAGELAB_EARLY_ACCESS_DISCOUNT_ENABLED ?? "false").toLowerCase() === "true"
}

/**
 * @param {{ membershipLevel?: string, interval?: string, env?: NodeJS.ProcessEnv | Record<string, string | undefined> }} [input]
 */
export function resolveStripePriceId({ membershipLevel, interval, env = process.env } = {}) {
  const normalizedLevel = normalizeMembershipLevel(membershipLevel)
  if (!isPaidMembershipLevel(normalizedLevel) || !isBillingInterval(interval)) {
    return null
  }

  const intervalLabel = interval === "year" ? "YEARLY" : "MONTHLY"
  return env[`STRIPE_${normalizedLevel}_${intervalLabel}_PRICE_ID`]?.trim() || null
}

export function resolveStripePriceMembershipLevel({ priceId, env = process.env } = {}) {
  const normalizedPriceId = typeof priceId === "string" ? priceId.trim() : ""
  if (!normalizedPriceId) {
    return null
  }

  for (const membershipLevel of PAID_MEMBERSHIP_LEVELS) {
    for (const interval of BILLING_INTERVALS) {
      if (resolveStripePriceId({ membershipLevel, interval, env }) === normalizedPriceId) {
        return membershipLevel
      }
    }
  }

  return null
}

export function getConfiguredMembershipOptions(env = process.env) {
  const options = []

  for (const membershipLevel of PAID_MEMBERSHIP_LEVELS) {
    for (const interval of BILLING_INTERVALS) {
      const priceId = resolveStripePriceId({ membershipLevel, interval, env })
      if (priceId) {
        options.push({ membershipLevel, interval, priceId })
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
