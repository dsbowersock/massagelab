import { NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { getCurrentSession } from "@/auth"
import {
  USER_PREFERENCES_VERSION,
  buildUserPreferencePayload,
} from "@/lib/account-preferences"
import { clearAccountSurfaceDataCache } from "@/lib/account-surface-data"
import {
  backgroundPaletteRegistry,
  backgroundPreferenceNormalizationOptions,
} from "@/components/backgrounds/backgroundPaletteRegistry"
import {
  backgroundRegistry,
  userCanUseBackground,
  type BackgroundAccessSnapshot,
} from "@/components/backgrounds/backgroundRegistry"
import { objectRecord } from "@/lib/onboarding-preferences"
import { sanitizeChimerSettingsForEntitlements } from "@/lib/chimer-timer"
import { getUserEntitlementState } from "@/lib/membership"
import { getBackgroundCommerceSnapshot } from "@/lib/commerce/snapshot-service"
import { prisma } from "@/lib/prisma"

function jsonObject(value: Record<string, unknown>) {
  return value as Prisma.InputJsonObject
}

/**
 * Sanitizes the canonical Chimer snapshot while retaining renderer tuning for
 * every background the account can currently use. Clock and Music share the
 * flat renderer settings even when their selected visual is not the canonical
 * Chimer background.
 */
function sanitizeAccessibleChimerSettings(
  input: unknown,
  access: BackgroundAccessSnapshot,
) {
  const candidateSettings = objectRecord(input)
  const options = {
    canUseAccountColorControls: true,
    backgroundPreferenceOptions: backgroundPreferenceNormalizationOptions,
  }
  const canonicalSettings = sanitizeChimerSettingsForEntitlements(candidateSettings, access, options)
  const accessibleRendererSettings: Record<string, unknown> = {}

  for (const backgroundId of access.ownedBackgroundIds) {
    const background = backgroundRegistry.find((entry) => entry.id === backgroundId)
    if (!background || !userCanUseBackground(background, access)) {
      continue
    }
    const visualPropertyKeys = backgroundPaletteRegistry[background.id]?.visualPropertyKeys
    if (!visualPropertyKeys?.length) {
      continue
    }
    const scopedSettings = sanitizeChimerSettingsForEntitlements({
      ...candidateSettings,
      backgroundId: background.id,
    }, access, options)
    for (const propertyKey of visualPropertyKeys) {
      accessibleRendererSettings[propertyKey] = scopedSettings[propertyKey]
    }
  }

  return {
    ...canonicalSettings,
    ...accessibleRendererSettings,
  }
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

  const chimerSettings = preferences?.chimerSettings && access.authoritative
    ? sanitizeAccessibleChimerSettings(
      preferences.chimerSettings,
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
  const chimerSettings = "chimerSettings" in body
    ? jsonObject(sanitizeAccessibleChimerSettings(payload.chimer_settings, {
      featureKeys: entitlements.features,
      ownedBackgroundIds: commerceSnapshot.ownedBackgroundIds,
    }))
    : (existing?.chimerSettings as Prisma.InputJsonValue | undefined) ?? {}

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
    updatedAt: preferences.updatedAt,
  })
}
