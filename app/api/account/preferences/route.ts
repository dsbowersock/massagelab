import { NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { getCurrentSession } from "@/auth"
import {
  USER_PREFERENCES_VERSION,
  buildUserPreferencePayload,
} from "@/lib/account-preferences"
import { clearAccountSurfaceDataCache } from "@/lib/account-surface-data"
import {
  backgroundPreferenceNormalizationOptions,
} from "@/components/backgrounds/backgroundPaletteRegistry"
import { sanitizeAccessibleChimerSettings } from "@/lib/chimer-accessible-settings"
import { objectRecord } from "@/lib/onboarding-preferences"
import { FEATURE_KEYS, getUserEntitlementState } from "@/lib/membership"
import { getBackgroundCommerceSnapshot } from "@/lib/commerce/snapshot-service"
import { prisma } from "@/lib/prisma"

function jsonObject(value: Record<string, unknown>) {
  return value as Prisma.InputJsonObject
}

/**
 * Serializes every preference merge for one user, including the first write
 * before a UserPreference row exists. Calendar and onboarding writers use the
 * same stable parent-row lock, so pooled requests cannot commit stale JSON
 * projections over one another.
 */
async function lockAccountPreferenceOwner(tx: Prisma.TransactionClient, userId: string) {
  await tx.$queryRaw`
    SELECT id
    FROM "User"
    WHERE id = ${userId}
    FOR UPDATE
  `
}

/**
 * Reduces additive entitlement provenance to the carousel's presentation
 * source: membership wins over Admin, and Admin wins over temporary access.
 * This presentation value neither changes billing level nor creates ownership.
 */
function premiumBackgroundAccessSource(featureAccess: unknown) {
  if (!Array.isArray(featureAccess)) return null
  const premium = featureAccess.find((entry) => (
    entry && typeof entry === "object" && "featureKey" in entry
      && entry.featureKey === FEATURE_KEYS.premiumBackgrounds
  ))
  if (!premium || typeof premium !== "object" || !("sources" in premium) || !Array.isArray(premium.sources)) {
    return null
  }
  if (premium.sources.some((source: unknown) => (
    source !== null && typeof source === "object" && "source" in source && source.source === "membership"
  ))) return "subscription" as const
  if (premium.sources.some((source: unknown) => (
    source !== null && typeof source === "object" && "source" in source && source.source === "admin"
  ))) return "admin" as const
  if (premium.sources.some((source: unknown) => (
    source !== null && typeof source === "object" && "source" in source && source.source === "temporary"
  ))) return "temporary" as const
  return null
}

export async function GET() {
  const session = await getCurrentSession()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [preferences, access] = await Promise.all([
    prisma.userPreference.findUnique({
      where: { userId: session.user.id },
    }),
    Promise.all([
      getUserEntitlementState(prisma, session.user.id),
      getBackgroundCommerceSnapshot({
        prismaClient: prisma,
        userId: session.user.id,
        includeRecentOrders: false,
      }),
    ]).then(([entitlements, commerceSnapshot]) => ({
      authoritative: true as const,
      entitlements,
      commerceSnapshot,
    })).catch(() => {
      // Access is one security boundary: if either entitlement or ownership
      // lookup fails, return no saved Chimer settings instead of persisting or
      // presenting a snapshot sanitized against invented empty access.
      return {
        authoritative: false as const,
        entitlements: null,
        commerceSnapshot: null,
      }
    }),
  ])

  const savedChimerSettings = objectRecord(preferences?.chimerSettings)
  const chimerSettings = access.authoritative && Object.keys(savedChimerSettings).length > 0
    ? sanitizeAccessibleChimerSettings(
      savedChimerSettings,
      {
        featureKeys: access.entitlements.features,
        ownedBackgroundIds: access.commerceSnapshot.ownedBackgroundIds,
      },
    )
    : {}

  return NextResponse.json({
    version: preferences?.version ?? USER_PREFERENCES_VERSION,
    appSettings: preferences?.appSettings ?? {},
    chimerSettings,
    anatomimeSettings: preferences?.anatomimeSettings ?? {},
    notePreferences: preferences?.notePreferences ?? {},
    calendarPreferences: preferences?.calendarPreferences ?? {},
    accessAuthoritative: access.authoritative,
    membershipLevel: access.authoritative ? access.entitlements.level : null,
    features: access.authoritative ? access.entitlements.features : [],
    premiumBackgroundAccessSource: access.authoritative
      ? premiumBackgroundAccessSource(access.entitlements.featureAccess)
      : null,
    ownedBackgroundIds: access.authoritative ? access.commerceSnapshot.ownedBackgroundIds : [],
    updatedAt: preferences?.updatedAt ?? null,
  })
}

export async function PUT(request: Request) {
  const session = await getCurrentSession()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const payload = buildUserPreferencePayload(body, {
    backgroundPreferenceOptions: backgroundPreferenceNormalizationOptions,
  })
  const [entitlements, commerceSnapshot] = await Promise.all([
    getUserEntitlementState(prisma, session.user.id),
    getBackgroundCommerceSnapshot({
      prismaClient: prisma,
      userId: session.user.id,
      includeRecentOrders: false,
    }),
  ])
  const saved = await prisma.$transaction(async (tx) => {
    await lockAccountPreferenceOwner(tx, session.user.id)

    const existing = await tx.userPreference.findUnique({
      where: { userId: session.user.id },
    })
    // The locked read is the only projection used for a JSON merge. A concurrent
    // writer for this owner must commit before this request can read and merge.
    const mergedAppSettings = {
      ...objectRecord(existing?.appSettings),
      ...payload.app_settings,
    }
    const retainedChimerSettings = objectRecord(existing?.chimerSettings)
    // Always sanitize the returned projection against fresh access. Persist it
    // only when Chimer was explicitly supplied; unrelated patches must not
    // rewrite any omitted preference column.
    const chimerSettings = !("chimerSettings" in body)
      && Object.keys(retainedChimerSettings).length === 0
      ? jsonObject({})
      : jsonObject(sanitizeAccessibleChimerSettings(
          "chimerSettings" in body
            ? payload.chimer_settings
            : retainedChimerSettings,
          {
            featureKeys: entitlements.features,
            ownedBackgroundIds: commerceSnapshot.ownedBackgroundIds,
          },
        ))
    const update: Prisma.UserPreferenceUpdateInput = {
      version: USER_PREFERENCES_VERSION,
    }
    // Omitted preference sections must stay omitted from the SQL update. Writing
    // their values from any earlier projection would reintroduce lost updates.
    if ("appSettings" in body) update.appSettings = jsonObject(mergedAppSettings)
    if ("chimerSettings" in body) update.chimerSettings = chimerSettings
    if ("anatomimeSettings" in body) update.anatomimeSettings = jsonObject(payload.anatomime_settings)
    if ("notePreferences" in body) update.notePreferences = jsonObject(payload.note_preferences)
    if ("calendarPreferences" in body) update.calendarPreferences = jsonObject(payload.calendar_preferences)

    const preferences = await tx.userPreference.upsert({
      where: { userId: session.user.id },
      create: {
        userId: session.user.id,
        version: USER_PREFERENCES_VERSION,
        appSettings: jsonObject(mergedAppSettings),
        chimerSettings,
        anatomimeSettings: jsonObject(payload.anatomime_settings),
        notePreferences: jsonObject(payload.note_preferences),
        calendarPreferences: jsonObject(payload.calendar_preferences),
      },
      update,
    })
    return { preferences, chimerSettings }
  })
  clearAccountSurfaceDataCache(session.user.id, "sync")

  return NextResponse.json({
    version: saved.preferences.version,
    appSettings: saved.preferences.appSettings,
    chimerSettings: saved.chimerSettings,
    anatomimeSettings: saved.preferences.anatomimeSettings,
    notePreferences: saved.preferences.notePreferences,
    calendarPreferences: saved.preferences.calendarPreferences,
    membershipLevel: entitlements.level,
    features: entitlements.features,
    premiumBackgroundAccessSource: premiumBackgroundAccessSource(entitlements.featureAccess),
    ownedBackgroundIds: commerceSnapshot.ownedBackgroundIds,
    accessAuthoritative: true,
    updatedAt: saved.preferences.updatedAt,
  })
}
