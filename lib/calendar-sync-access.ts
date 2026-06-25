import "server-only"

import { FEATURE_KEYS, getUserEntitlementState } from "./membership.js"
import { prisma } from "./prisma.ts"

const GOOGLE_CALENDAR_SYNC_PROVIDER_ROLES = ["OWNER", "THERAPIST"] as const

export type GoogleCalendarSyncAccess = {
  allowed: boolean
  reason: "provider" | "entitlement" | null
}

/**
 * Checks whether a signed-in user can manage provider-side external calendar sync.
 * Access requires at least one provider practice role plus the external sync
 * feature entitlement; disconnect flows are intentionally checked separately so
 * users can always remove their own stored credentials.
 */
export async function getGoogleCalendarSyncAccess(userId: string): Promise<GoogleCalendarSyncAccess> {
  const [providerMembership, entitlements] = await Promise.all([
    prisma.practiceMembership.findFirst({
      where: {
        userId,
        role: { in: [...GOOGLE_CALENDAR_SYNC_PROVIDER_ROLES] },
      },
      select: { id: true },
    }),
    getUserEntitlementState(prisma, userId),
  ])

  if (!providerMembership) {
    return { allowed: false, reason: "provider" }
  }
  if (!entitlements.hasFeature(FEATURE_KEYS.externalCalendarSync)) {
    return { allowed: false, reason: "entitlement" }
  }

  return { allowed: true, reason: null }
}

export async function assertGoogleCalendarSyncAccess(userId: string) {
  const access = await getGoogleCalendarSyncAccess(userId)
  if (!access.allowed) {
    throw new Error("Calendar sync is only available to provider accounts with external calendar sync access.")
  }
  return access
}
