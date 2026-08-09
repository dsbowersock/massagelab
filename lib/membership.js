export const FEATURE_KEYS = Object.freeze({
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
/**
 * Fixed Supporter choices in USD cents. Every choice grants identical current
 * benefits; yearly amounts intentionally equal ten monthly payments (two
 * months free), rather than twelve, and are not feature or use-case tiers.
 */
export const SUPPORTER_AMOUNT_CHOICES = Object.freeze([
  Object.freeze({ id: "support-1", monthAmountCents: 100, yearAmountCents: 1000 }),
  Object.freeze({ id: "support-2", monthAmountCents: 200, yearAmountCents: 2000 }),
  Object.freeze({ id: "support-5", monthAmountCents: 500, yearAmountCents: 5000 }),
])

const ACTIVE_SUBSCRIPTION_STATUSES = new Set(["active", "trialing"])
const TERMINAL_SUBSCRIPTION_STATUSES = new Set(["canceled", "incomplete_expired"])
const MEMBERSHIP_RANK = Object.freeze({
  FREE: 0,
  STUDENT: 1,
  SUPPORTER: 2,
  THERAPIST: 3,
  PRACTICE: 4,
})
const PAID_FEATURES = Object.freeze([FEATURE_KEYS.premiumBackgrounds])
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
 * Only the normalized persisted status controls this decision. Cancellation
 * flags are deliberately outside this contract because Stripe's terminal
 * status remains the authority for allowing new Checkout.
 *
 * @param {Array<{
 *   status?: string | null
 * }> | null} subscriptions
 */
export function hasSubscriptionBlockingNewCheckout(subscriptions = []) {
  const persistedSubscriptions = subscriptions ?? []

  return persistedSubscriptions.some((subscription) => {
    const status = String(subscription?.status ?? "").trim().toLowerCase()

    if (TERMINAL_SUBSCRIPTION_STATUSES.has(status)) {
      return false
    }

    // Known billable states and any empty/future Stripe state fail closed. A
    // pending cancellation remains blocking until Stripe reports a terminal
    // status because it is still an existing membership.
    return true
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

// Paid background access is represented by the single durable feature key.
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
 * Resolves the canonical effective membership and per-feature provenance. The
 * subscriptions input must be the complete active-subscription candidate set,
 * never a capped display slice; status and expiry are still checked here as a
 * defensive domain boundary. Effective paid-level precedence is
 * PRACTICE > THERAPIST > SUPPORTER, followed by active STUDENT access when no
 * paid source exists, then FREE.
 *
 * A FREE baseline feature always reports source FREE with no expiry and never
 * inherits paid or student provenance. Paid features report an actual active
 * source that grants the feature: an unbounded source wins, then latest expiry,
 * then membership rank as a deterministic tie-breaker.
 *
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
 * @returns {{
 *   level: string,
 *   paidLevel: string | null,
 *   features: string[],
 *   featureDetails: Array<{ key: string, source: string, expiresAt: Date | null }>,
 *   studentStatus: string,
 *   hasFeature: (featureKey: string) => boolean
 * }} Effective level, feature keys, truthful per-feature source/expiry evidence,
 * normalized student status, and a feature-key predicate.
 */
export function buildEntitlements({ subscriptions = [], studentAccess = null, now = new Date() } = {}) {
  const activePaidSubscriptions = subscriptions
    .filter((subscription) => activeSubscription(subscription, now))
    .map((subscription) => ({
      level: normalizeMembershipLevel(subscription.membershipLevel),
      expiresAt: subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd) : null,
    }))
    .filter((subscription) => PAID_MEMBERSHIP_LEVELS.includes(subscription.level))
  const activePaidLevels = activePaidSubscriptions.map((subscription) => subscription.level)
  const studentStatus = normalizeStudentStatus(studentAccess?.studentStatus)
  const hasActiveStudentAccess = studentStatus === "ACTIVE" &&
    (!studentAccess?.studentAccessExpiresAt || new Date(studentAccess.studentAccessExpiresAt).getTime() > now.getTime())
  const level = activePaidLevels.length > 0
    ? bestMembershipLevel(activePaidLevels)
    : hasActiveStudentAccess ? "STUDENT" : "FREE"
  const features = [
    ...BASIC_CALENDAR_FEATURES,
    ...(PAID_MEMBERSHIP_LEVELS.includes(level) ? PAID_FEATURES : []),
    ...(level === "THERAPIST" || level === "PRACTICE" ? THERAPIST_DOCUMENTATION_FEATURES : []),
    ...(level === "THERAPIST" || level === "PRACTICE" ? THERAPIST_CALENDAR_FEATURES : []),
    ...(level === "PRACTICE" ? TEAM_PRACTICE_CALENDAR_FEATURES : []),
  ]
  const featureDetails = features.map((key) => {
    if (BASIC_CALENDAR_FEATURES.includes(key)) {
      return { key, source: "FREE", expiresAt: null }
    }

    const source = selectFeatureGrant(activePaidSubscriptions, key)
    if (!source) {
      throw new Error(`Active membership feature ${key} has no granting source.`)
    }
    return { key, source: source.level, expiresAt: source.expiresAt }
  })

  return {
    level,
    paidLevel: activePaidLevels.length > 0 ? bestMembershipLevel(activePaidLevels) : null,
    features,
    featureDetails,
    studentStatus: hasActiveStudentAccess ? "ACTIVE" : studentStatus,
    hasFeature: (featureKey) => hasFeature(features, featureKey),
  }
}

/**
 * Resolves one paid feature to a real active subscription source. An unbounded
 * source wins; otherwise the source lasting longest wins, with membership rank
 * as a deterministic tie-breaker. This keeps each feature's displayed expiry
 * truthful even when the account has overlapping paid records.
 */
function selectFeatureGrant(activeSubscriptions, featureKey) {
  return activeSubscriptions
    .filter((subscription) => paidFeaturesForLevel(subscription.level).includes(featureKey))
    .sort((left, right) => {
      if (left.expiresAt === null && right.expiresAt !== null) return -1
      if (left.expiresAt !== null && right.expiresAt === null) return 1
      const expiryDelta = (right.expiresAt?.getTime() ?? 0) - (left.expiresAt?.getTime() ?? 0)
      if (expiryDelta !== 0) return expiryDelta
      const rankDelta = (MEMBERSHIP_RANK[right.level] ?? 0) - (MEMBERSHIP_RANK[left.level] ?? 0)
      return rankDelta !== 0 ? rankDelta : left.level.localeCompare(right.level)
    })[0] ?? null
}

function paidFeaturesForLevel(level) {
  return [
    ...PAID_FEATURES,
    ...(level === "THERAPIST" || level === "PRACTICE" ? THERAPIST_DOCUMENTATION_FEATURES : []),
    ...(level === "THERAPIST" || level === "PRACTICE" ? THERAPIST_CALENDAR_FEATURES : []),
    ...(level === "PRACTICE" ? TEAM_PRACTICE_CALENDAR_FEATURES : []),
  ]
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

/** Returns whether a value names one of the fixed public Supporter amounts. */
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

/**
 * Maps a Supporter amount choice and billing interval to its deployment Price
 * environment key. The shared Stripe contract uses this same derivation so
 * runtime selection, readiness, and migration cannot drift.
 */
export function supporterPriceEnvironmentKey(choiceId, interval) {
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

/**
 * Resolves legacy runtime Price mappings used to normalize existing Stripe and
 * database records; public Checkout selection never consults these mappings.
 * @param {string} priceId
 * @param {NodeJS.ProcessEnv | Record<string, string | undefined>} env
 * @returns {string | null}
 */
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

  const currentOption = getConfiguredMembershipOptions(env)
    .find((option) => option.priceId === normalizedPriceId)
  if (currentOption) {
    return currentOption.membershipLevel
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
 * Loads only the persisted billing fields needed by public Pricing. The
 * Stripe Customer presence controls whether a blocking member may be offered
 * the Customer Portal; StudentAccess, metadata, and the full account summary
 * remain outside this narrow query.
 *
 * @param {{ stripeCustomer: { findUnique: Function }, membershipSubscription: { findMany: Function } }} prismaClient
 * @param {string} userId
 * @param {Date} [now]
 */
export async function getUserMembershipPricingStatus(
  prismaClient,
  userId,
  now = new Date(),
) {
  const [stripeCustomer, subscriptions] = await Promise.all([
    prismaClient.stripeCustomer.findUnique({
      where: { userId },
      select: { id: true },
    }),
    prismaClient.membershipSubscription.findMany({
      where: { userId },
      select: {
        status: true,
        membershipLevel: true,
        currentPeriodEnd: true,
        cancelAtPeriodEnd: true,
      },
    }),
  ])

  return {
    stripeCustomer,
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
