export const ADMIN_GRANTABLE_FEATURE_KEYS = Object.freeze([
  "premium_backgrounds",
  "therapist_documentation_tools",
  "calendar_basic_scheduling",
  "calendar_full_scheduling",
  "external_calendar_sync",
] as const)

export type AdminGrantableFeatureKey = (typeof ADMIN_GRANTABLE_FEATURE_KEYS)[number]

export const ADMIN_TEMPORARY_ACCESS_FEATURE_LABELS: Readonly<Record<AdminGrantableFeatureKey, string>> = Object.freeze({
  premium_backgrounds: "Premium backgrounds",
  therapist_documentation_tools: "Therapist documentation tools",
  calendar_basic_scheduling: "Basic calendar scheduling",
  calendar_full_scheduling: "Full calendar scheduling",
  external_calendar_sync: "External calendar sync",
})

export const TEMPORARY_ACCESS_MIN_DAYS = 1
export const TEMPORARY_ACCESS_MAX_DAYS = 365
export const PER_FEATURE_ACTIVE_LIMIT = 100
export const TOTAL_ACTIVE_LIMIT = PER_FEATURE_ACTIVE_LIMIT * ADMIN_GRANTABLE_FEATURE_KEYS.length

const ADMIN_GRANTABLE_FEATURE_KEY_SET = new Set<string>(ADMIN_GRANTABLE_FEATURE_KEYS)

export function isGrantableFeature(value: unknown): value is AdminGrantableFeatureKey {
  return typeof value === "string" && ADMIN_GRANTABLE_FEATURE_KEY_SET.has(value)
}

export function isSafeRecordId(value: unknown): value is string {
  return typeof value === "string" && value.length <= 191 && /^[A-Za-z0-9_-]+$/.test(value)
}

/** Builds the shared half-open active-grant predicate without a Prisma runtime dependency. */
export function buildActiveTemporaryGrantWhere(
  userId: string,
  now: Date,
  featureKey?: AdminGrantableFeatureKey,
) {
  return {
    userId,
    featureKey: featureKey ?? { in: [...ADMIN_GRANTABLE_FEATURE_KEYS] },
    startsAt: { lte: now },
    expiresAt: { gt: now },
    revocation: null,
  }
}

/** Produces stable operator/customer copy independent of the host time zone. */
export function formatTemporaryAccessUtc(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(date.getTime())) return "Unavailable"
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(date)
}
