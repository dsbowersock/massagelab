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
import { getUserEntitlementState } from "@/lib/membership"
import { getBackgroundCommerceSnapshot } from "@/lib/commerce/snapshot-service"
import { prisma } from "@/lib/prisma"

function jsonObject(value: Record<string, unknown>) {
  return value as Prisma.InputJsonObject
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
  const [entitlements, commerceSnapshot, existing] = await Promise.all([
    getUserEntitlementState(prisma, session.user.id),
    getBackgroundCommerceSnapshot({
      prismaClient: prisma,
      userId: session.user.id,
      includeRecentOrders: false,
    }),
    prisma.userPreference.findUnique({
      where: { userId: session.user.id },
    }),
  ])
  // Merge existing app settings with incoming values only when callers provide
  // appSettings. This preserves previously saved flags for omitted keys and
  // applies replacements only for explicitly submitted entries.
  const mergedAppSettings = {
    ...objectRecord(existing?.appSettings),
    ...payload.app_settings,
  }
  const retainedChimerSettings = objectRecord(existing?.chimerSettings)
  // An authoritative empty preference means the device may seed its local
  // settings later. Preserve that sentinel on unrelated partial writes while
  // still re-sanitizing every non-empty retained snapshot against fresh access.
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

  const preferences = await prisma.userPreference.upsert({
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
    update: {
      version: USER_PREFERENCES_VERSION,
      // Only update app settings on explicit appSettings payloads; otherwise keep
      // existing settings unchanged to avoid accidental overwrite during partial updates.
      appSettings: "appSettings" in body ? jsonObject(mergedAppSettings) : (existing?.appSettings as Prisma.InputJsonValue | undefined) ?? {},
      chimerSettings,
      anatomimeSettings: "anatomimeSettings" in body ? jsonObject(payload.anatomime_settings) : (existing?.anatomimeSettings as Prisma.InputJsonValue | undefined) ?? {},
      notePreferences: "notePreferences" in body ? jsonObject(payload.note_preferences) : (existing?.notePreferences as Prisma.InputJsonValue | undefined) ?? {},
      calendarPreferences: "calendarPreferences" in body ? jsonObject(payload.calendar_preferences) : (existing?.calendarPreferences as Prisma.InputJsonValue | undefined) ?? {},
    },
  })
  clearAccountSurfaceDataCache(session.user.id, "sync")

  return NextResponse.json({
    version: preferences.version,
    appSettings: preferences.appSettings,
    chimerSettings: preferences.chimerSettings,
    anatomimeSettings: preferences.anatomimeSettings,
    notePreferences: preferences.notePreferences,
    calendarPreferences: preferences.calendarPreferences,
    membershipLevel: entitlements.level,
    features: entitlements.features,
    ownedBackgroundIds: commerceSnapshot.ownedBackgroundIds,
    accessAuthoritative: true,
    updatedAt: preferences.updatedAt,
  })
}
