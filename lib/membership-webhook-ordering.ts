export type MembershipEventOrderDecision = "apply" | "duplicate" | "ignore-stale" | "reconcile"

type MembershipEventOrderInput = {
  hasStoredSnapshot: boolean
  storedEventId: string | null
  storedEventCreatedAt: Date | null
  storedAuthoritativeAt: Date | null
  incomingEventId: string
  incomingEventCreatedAt: Date
}

/**
 * Orders Stripe events only against Stripe's event watermark. The local
 * authoritative marker is deliberately a boolean reconciliation barrier: its
 * clock must never be compared with Stripe's independently sourced seconds.
 */
export function decideMembershipEventOrder({
  hasStoredSnapshot,
  storedEventId,
  storedEventCreatedAt,
  storedAuthoritativeAt,
  incomingEventId,
  incomingEventCreatedAt,
}: MembershipEventOrderInput): MembershipEventOrderDecision {
  if (storedEventId === incomingEventId) return "duplicate"
  if (!hasStoredSnapshot) return "apply"
  if (!storedEventCreatedAt && !storedAuthoritativeAt) return "reconcile"
  if (storedEventCreatedAt && incomingEventCreatedAt < storedEventCreatedAt) return "ignore-stale"
  if (storedEventCreatedAt && incomingEventCreatedAt.getTime() === storedEventCreatedAt.getTime()) return "reconcile"
  if (storedAuthoritativeAt) return "reconcile"
  return "apply"
}
