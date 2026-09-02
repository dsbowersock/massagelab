"use server"

import { redirect } from "next/navigation"
import type { Prisma } from "@prisma/client"
import { getCurrentSession } from "@/auth"
import { USER_PREFERENCES_VERSION } from "@/lib/account-preferences"
import { clearAccountSurfaceDataCache } from "@/lib/account-surface-data"
import {
  buildOnboardingPreference,
  objectRecord,
} from "@/lib/onboarding-preferences"
import { prisma } from "@/lib/prisma"

function jsonObject(value: Record<string, unknown>) {
  return value as Prisma.InputJsonObject
}

/** Locks the stable preference owner before merging onboarding app settings. */
async function lockOnboardingPreferenceOwner(tx: Prisma.TransactionClient, userId: string) {
  await tx.$queryRaw`
    SELECT id
    FROM "User"
    WHERE id = ${userId}
    FOR UPDATE
  `
}

export async function saveOnboardingAction(formData: FormData) {
  const session = await getCurrentSession()

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=%2Fonboarding")
  }

  const onboarding = buildOnboardingPreference(formData)
  await prisma.$transaction(async (tx) => {
    await lockOnboardingPreferenceOwner(tx, session.user.id)
    const existing = await tx.userPreference.findUnique({
      where: { userId: session.user.id },
    })
    const appSettings = {
      ...objectRecord(existing?.appSettings),
      onboarding,
    }

    await tx.userPreference.upsert({
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
  })
  clearAccountSurfaceDataCache(session.user.id, "sync")
  clearAccountSurfaceDataCache(session.user.id, "overview")

  redirect(onboarding.recommendedPath)
}
