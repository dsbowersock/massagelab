import "server-only"

import { revalidatePath } from "next/cache"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { mergeCalendarPreferencePatch } from "@/lib/calendar-preferences"
import { currentUserId } from "./access"

export async function saveCalendarPreferences(input: Record<string, unknown>) {
  const userId = await currentUserId()
  const current = await prisma.userPreference.findUnique({
    where: { userId },
    select: { calendarPreferences: true },
  })
  const preferences = mergeCalendarPreferencePatch(current?.calendarPreferences ?? {}, input)

  const saved = await prisma.userPreference.upsert({
    where: { userId },
    create: {
      userId,
      calendarPreferences: preferences as Prisma.InputJsonValue,
    },
    update: {
      calendarPreferences: preferences as Prisma.InputJsonValue,
    },
  })

  revalidatePath("/calendar")
  return { preferences: saved.calendarPreferences }
}
