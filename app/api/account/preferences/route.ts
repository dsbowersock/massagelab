import { NextResponse } from "next/server"
import type { Prisma } from "@prisma/client"
import { getCurrentSession } from "@/auth"
import {
  USER_PREFERENCES_VERSION,
  buildUserPreferencePayload,
} from "@/lib/account-preferences"
import { prisma } from "@/lib/prisma"

function jsonObject(value: Record<string, unknown>) {
  return value as Prisma.InputJsonObject
}

export async function GET() {
  const session = await getCurrentSession()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const preferences = await prisma.userPreference.findUnique({
    where: { userId: session.user.id },
  })

  return NextResponse.json({
    version: preferences?.version ?? USER_PREFERENCES_VERSION,
    appSettings: preferences?.appSettings ?? {},
    chimerSettings: preferences?.chimerSettings ?? {},
    anatomimeSettings: preferences?.anatomimeSettings ?? {},
    notePreferences: preferences?.notePreferences ?? {},
    updatedAt: preferences?.updatedAt ?? null,
  })
}

export async function PUT(request: Request) {
  const session = await getCurrentSession()

  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await request.json().catch(() => ({}))
  const payload = buildUserPreferencePayload(body)
  const existing = await prisma.userPreference.findUnique({
    where: { userId: session.user.id },
  })

  const preferences = await prisma.userPreference.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      version: USER_PREFERENCES_VERSION,
      appSettings: jsonObject(payload.app_settings),
      chimerSettings: jsonObject(payload.chimer_settings),
      anatomimeSettings: jsonObject(payload.anatomime_settings),
      notePreferences: jsonObject(payload.note_preferences),
    },
    update: {
      version: USER_PREFERENCES_VERSION,
      appSettings: "appSettings" in body ? jsonObject(payload.app_settings) : (existing?.appSettings as Prisma.InputJsonValue | undefined) ?? {},
      chimerSettings: "chimerSettings" in body ? jsonObject(payload.chimer_settings) : (existing?.chimerSettings as Prisma.InputJsonValue | undefined) ?? {},
      anatomimeSettings: "anatomimeSettings" in body ? jsonObject(payload.anatomime_settings) : (existing?.anatomimeSettings as Prisma.InputJsonValue | undefined) ?? {},
      notePreferences: "notePreferences" in body ? jsonObject(payload.note_preferences) : (existing?.notePreferences as Prisma.InputJsonValue | undefined) ?? {},
    },
  })

  return NextResponse.json({
    version: preferences.version,
    appSettings: preferences.appSettings,
    chimerSettings: preferences.chimerSettings,
    anatomimeSettings: preferences.anatomimeSettings,
    notePreferences: preferences.notePreferences,
    updatedAt: preferences.updatedAt,
  })
}
