"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { getCurrentSession } from "@/auth"
import { assertGoogleCalendarSyncAccess } from "@/lib/calendar-sync-access"
import { syncGoogleConnectionSources } from "@/lib/calendar-sync-service"
import { prisma } from "@/lib/prisma"

async function currentUserId() {
  const session = await getCurrentSession()
  if (!session?.user?.id) throw new Error("Sign in before managing calendar sync.")
  return session.user.id
}

export async function disconnectGoogleCalendarAction(formData: FormData) {
  const userId = await currentUserId()
  const connectionId = String(formData.get("connectionId") ?? "")

  await prisma.calendarConnection.deleteMany({
    where: { id: connectionId, userId, provider: "GOOGLE" },
  })

  revalidatePath("/calendar/sync")
  revalidatePath("/calendar")
}

export async function refreshGoogleCalendarAction(formData: FormData) {
  const userId = await currentUserId()
  await assertGoogleCalendarSyncAccess(userId)
  const connectionId = String(formData.get("connectionId") ?? "")
  const connection = await prisma.calendarConnection.findFirst({
    where: { id: connectionId, userId, provider: "GOOGLE", status: "ACTIVE" },
    select: { id: true },
  })
  if (!connection) throw new Error("Choose an active Google calendar connection.")

  await syncGoogleConnectionSources({ connectionId: connection.id })
  revalidatePath("/calendar/sync")
  revalidatePath("/calendar")
}

export async function saveGoogleCalendarSourceSelectionAction(formData: FormData) {
  const userId = await currentUserId()
  await assertGoogleCalendarSyncAccess(userId)
  const connectionId = String(formData.get("connectionId") ?? "")
  const selected = new Set(formData.getAll("sourceId").map(String))
  const connection = await prisma.calendarConnection.findFirst({
    where: { id: connectionId, userId, provider: "GOOGLE", status: "ACTIVE" },
    include: { sources: { select: { id: true } } },
  })
  if (!connection) throw new Error("Choose an active Google calendar connection.")

  await prisma.$transaction(connection.sources.map((source) => (
    prisma.externalCalendarSource.update({
      where: { id: source.id },
      data: { selectedForBusySync: selected.has(source.id), syncToken: null },
    })
  )))

  await syncGoogleConnectionSources({ connectionId: connection.id })
  revalidatePath("/calendar/sync")
  revalidatePath("/calendar")
}

export async function connectGoogleCalendarAction() {
  redirect("/api/calendar/google/connect")
}
