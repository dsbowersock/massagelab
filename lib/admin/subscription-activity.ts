import type { Prisma } from "@prisma/client"

/**
 * Builds the shared persisted-subscription activity predicate at one caller-
 * supplied instant. Product or membership-level scoping belongs to the caller.
 */
export function activeMembershipSubscriptionWhere(now: Date): Prisma.MembershipSubscriptionWhereInput {
  return {
    status: { in: ["active", "trialing"] },
    OR: [{ currentPeriodEnd: null }, { currentPeriodEnd: { gt: now } }],
  }
}
