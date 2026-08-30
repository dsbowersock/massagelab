import { getUserMembershipSummary } from "./membership.js"

export type MembershipConvergenceState =
  | "active"
  | "billing-attention"
  | "no-active-membership"

export type MembershipConvergenceStatus = {
  state: MembershipConvergenceState
  paidLevel: string | null
  featureKeys: string[]
  subscriptionStatus: string | null
  cancelAtPeriodEnd: boolean
  currentPeriodEnd: string | null
  revision: string | null
  portalAvailable: boolean
}

type PersistedSubscription = {
  status?: unknown
  cancelAtPeriodEnd?: unknown
  currentPeriodEnd?: unknown
  updatedAt?: unknown
}

type PersistedMembershipSummary = {
  stripeCustomer?: unknown
  subscriptions?: PersistedSubscription[] | null
  entitlements?: {
    paidLevel?: unknown
    features?: unknown
  } | null
}

const BILLING_ATTENTION_STATUSES = new Set([
  "past_due",
  "unpaid",
  "incomplete",
  "incomplete_expired",
  "paused",
])

/** Converts persisted dates to the only revision/period representation exposed by the endpoint. */
function persistedDateIso(value: unknown) {
  if (value === null || value === undefined) return null
  const date = value instanceof Date ? value : new Date(String(value))
  return Number.isFinite(date.getTime()) ? date.toISOString() : null
}

/** Selects the latest database revision independently from the account page's display ordering. */
function newestPersistedSubscription(subscriptions: PersistedSubscription[]) {
  return [...subscriptions].sort((left, right) => {
    const leftTime = persistedDateIso(left.updatedAt)
    const rightTime = persistedDateIso(right.updatedAt)
    return Date.parse(rightTime ?? "") - Date.parse(leftTime ?? "")
  })[0] ?? null
}

/**
 * Projects the normal runtime membership summary into an identifier-free
 * convergence response. Provider identifiers and displayed plan names never
 * cross this boundary; feature keys remain the access authority.
 */
export function buildMembershipConvergenceStatus(
  summary: PersistedMembershipSummary,
): MembershipConvergenceStatus {
  const subscriptions = Array.isArray(summary.subscriptions) ? summary.subscriptions : []
  const newest = newestPersistedSubscription(subscriptions)
  const paidLevel = typeof summary.entitlements?.paidLevel === "string"
    ? summary.entitlements.paidLevel
    : null
  const featureKeys = Array.isArray(summary.entitlements?.features)
    ? summary.entitlements.features.filter((feature): feature is string => typeof feature === "string")
    : []
  const subscriptionStatus = typeof newest?.status === "string"
    ? newest.status.trim().toLowerCase()
    : null
  const state: MembershipConvergenceState = paidLevel
    ? "active"
    : subscriptionStatus && BILLING_ATTENTION_STATUSES.has(subscriptionStatus)
      ? "billing-attention"
      : "no-active-membership"

  return {
    state,
    paidLevel,
    featureKeys,
    subscriptionStatus,
    cancelAtPeriodEnd: newest?.cancelAtPeriodEnd === true,
    currentPeriodEnd: persistedDateIso(newest?.currentPeriodEnd),
    revision: persistedDateIso(newest?.updatedAt),
    portalAvailable: Boolean(summary.stripeCustomer),
  }
}

/** Loads one uncached persisted summary and applies the identifier-free projection. */
export async function getMembershipConvergenceStatus({
  prismaClient,
  userId,
  now,
  getMembershipSummary = getUserMembershipSummary,
}: {
  prismaClient: unknown
  userId: string
  now?: Date
  getMembershipSummary?: (
    prismaClient: unknown,
    userId: string,
    now?: Date,
  ) => Promise<PersistedMembershipSummary>
}) {
  const summary = await getMembershipSummary(prismaClient, userId, now)
  return buildMembershipConvergenceStatus(summary)
}
