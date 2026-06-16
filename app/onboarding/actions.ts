"use server"

import { redirect } from "next/navigation"
import type { Prisma } from "@prisma/client"
import { getCurrentSession } from "@/auth"
import { USER_PREFERENCES_VERSION } from "@/lib/account-preferences"
import { clearAccountSurfaceDataCache } from "@/lib/account-surface-data"
import { buildOnboardingPreference } from "@/lib/onboarding-preferences"
import { prisma } from "@/lib/prisma"

function jsonObject(value: Record<string, unknown>) {
  return value as Prisma.InputJsonObject
}

function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

export async function saveOnboardingAction(formData: FormData) {
  const session = await getCurrentSession()

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=%2Fonboarding")
  }

  const onboarding = buildOnboardingPreference(formData)
  const existing = await prisma.userPreference.findUnique({
    where: { userId: session.user.id },
  })
  const appSettings = {
    ...objectRecord(existing?.appSettings),
    onboarding,
  }

  await prisma.userPreference.upsert({
    where: { userId: session.user.id },
    create: {
      userId: session.user.id,
      version: USER_PREFERENCES_VERSION,
      appSettings: jsonObject(appSettings),
    },
    update: {
      version: USER_PREFERENCES_VERSION,
      appSettings: jsonObject(appSettings),
    },
  })
  clearAccountSurfaceDataCache(session.user.id, "sync")
  clearAccountSurfaceDataCache(session.user.id, "overview")

  redirect(onboarding.recommendedPath)
}
