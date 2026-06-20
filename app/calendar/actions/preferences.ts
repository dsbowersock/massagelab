import "server-only"

import { revalidatePath } from "next/cache"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { mergeCalendarPreferencePatch } from "@/lib/calendar-preferences"
import { currentUserId } from "./access"

/**
 * Serializes preference patch merges for one user. The preference row may not
 * exist yet, so the parent user row is the stable lock target for create/update
 * races.
 */
async function lockCalendarPreferenceOwner(tx: Prisma.TransactionClient, userId: string) {
  await tx.$queryRaw`
    SELECT id
    FROM "User"
    WHERE id = ${userId}
    FOR UPDATE
  `
}

export async function saveCalendarPreferences(input: Record<string, unknown>) {
  const userId = await currentUserId()
  const saved = await prisma.$transaction(async (tx) => {
    await lockCalendarPreferenceOwner(tx, userId)

    const current = await tx.userPreference.findUnique({
      where: { userId },
      select: { calendarPreferences: true },
    })
    const preferences = mergeCalendarPreferencePatch(current?.calendarPreferences ?? {}, input)

    return tx.userPreference.upsert({
      where: { userId },
      create: {
        userId,
        calendarPreferences: preferences as Prisma.InputJsonValue,
      },
      update: {
        calendarPreferences: preferences as Prisma.InputJsonValue,
      },
    })
  })

  revalidatePath("/calendar")
  return { preferences: saved.calendarPreferences }
}
