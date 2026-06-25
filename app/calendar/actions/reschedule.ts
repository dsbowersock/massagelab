import "server-only"

import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { dateValue } from "@/lib/calendar"
import { assertCalendarDatabaseReady } from "@/lib/calendar-readiness"
import { pushCalendarEventToGoogle } from "@/lib/calendar-sync-service"
import { canRescheduleCalendarEvent } from "@/lib/calendar-workspace"
import {
  assertNoCalendarEventConflict,
  assertNoResourceConflict,
  assertProviderAvailability,
  lockAppointmentSchedulingRows,
} from "./availability"
import { writeCalendarAuditAndNotifications } from "./audit"
import { revalidateCalendarRoutes } from "./revalidation"
import {
  STAFF_ROLES,
  assertPracticeAccess,
  currentUserId,
  formOrObjectValue,
} from "./access"

type CalendarActionDb = typeof prisma | Prisma.TransactionClient

const RESCHEDULE_EVENT_INCLUDE = {
  practice: { select: { slug: true, timezone: true } },
  resourceBookings: { select: { resourceId: true } },
  appointment: {
    include: {
      practiceClient: { select: { userId: true } },
    },
  },
  personalBlock: true,
  class: true,
} satisfies Prisma.CalendarEventInclude

async function getRescheduleEvent(db: CalendarActionDb, eventId: string) {
  return db.calendarEvent.findUnique({
    where: { id: eventId },
    include: RESCHEDULE_EVENT_INCLUDE,
  })
}

function hasStaleRescheduleSnapshot(
  currentEvent: Awaited<ReturnType<typeof getRescheduleEvent>>,
  snapshot: NonNullable<Awaited<ReturnType<typeof getRescheduleEvent>>>,
) {
  if (!currentEvent) return true

  const currentResourceIds = currentEvent.resourceBookings.map((booking) => booking.resourceId).sort().join("\0")
  const snapshotResourceIds = snapshot.resourceBookings.map((booking) => booking.resourceId).sort().join("\0")

  return currentEvent.startsAt.getTime() !== snapshot.startsAt.getTime()
    || currentEvent.endsAt.getTime() !== snapshot.endsAt.getTime()
    || currentEvent.status !== snapshot.status
    || currentEvent.ownerUserId !== snapshot.ownerUserId
    || currentEvent.blocksAvailability !== snapshot.blocksAvailability
    || currentResourceIds !== snapshotResourceIds
}

/**
 * Reschedules an existing calendar event from FormData or an object payload.
 * Requires event id and start/end timestamps; optionally honors manual
 * outside-availability confirmation while preserving conflict checks, cascaded
 * child-record updates, sanitized audit writes, notifications, revalidation, and
 * a locked in-transaction editability recheck so stale drag submissions cannot
 * overwrite a concurrent cancel, ownership change, or earlier reschedule.
 */
export async function rescheduleCalendarEvent(input: FormData | Record<string, unknown>) {
  const userId = await currentUserId()
  await assertCalendarDatabaseReady()
  const eventId = formOrObjectValue(input, "eventId")
  const startsAtValue = formOrObjectValue(input, "startsAt")
  const endsAtValue = formOrObjectValue(input, "endsAt")
  const allowOutsideAvailability = ["true", "1", "on"].includes(formOrObjectValue(input, "allowOutsideAvailability"))

  if (!eventId || !startsAtValue || !endsAtValue) {
    throw new Error("Choose a calendar event and valid start/end time.")
  }

  const startsAt = dateValue(startsAtValue)
  const endsAt = dateValue(endsAtValue)
  if (endsAt <= startsAt) {
    throw new Error("Calendar event end time must be after start time.")
  }

  const event = await getRescheduleEvent(prisma, eventId)

  if (!event) {
    throw new Error("Choose a valid calendar event.")
  }

  const membership = await assertPracticeAccess(event.practiceId, userId, STAFF_ROLES)
  if (!canRescheduleCalendarEvent({ role: membership.role, actorUserId: userId, event })) {
    throw new Error("You do not have access to reschedule this event.")
  }
  if (!event.ownerUserId) {
    throw new Error("This event does not have a provider schedule owner.")
  }

  const snapshotOwnerUserId = event.ownerUserId
  const snapshotResourceIds = event.resourceBookings.map((booking) => booking.resourceId)

  const rescheduledEvent = await prisma.$transaction(async (tx) => {
    await lockAppointmentSchedulingRows(tx, {
      practiceId: event.practiceId,
      therapistId: snapshotOwnerUserId,
      resourceIds: snapshotResourceIds,
      startsAt,
      endsAt,
      eventIds: [event.id],
    })

    const currentEvent = await getRescheduleEvent(tx, event.id)

    if (!currentEvent) {
      throw new Error("Choose a valid calendar event.")
    }

    const currentMembership = await tx.practiceMembership.findUnique({
      where: {
        practiceId_userId: {
          practiceId: currentEvent.practiceId,
          userId,
        },
      },
    })

    if (!currentMembership || !STAFF_ROLES.includes(currentMembership.role)) {
      throw new Error("You do not have access to this practice calendar.")
    }
    if (!canRescheduleCalendarEvent({ role: currentMembership.role, actorUserId: userId, event: currentEvent })) {
      throw new Error("You do not have access to reschedule this event.")
    }
    if (hasStaleRescheduleSnapshot(currentEvent, event)) {
      throw new Error("This calendar event changed before your reschedule was saved. Refresh the calendar and try again.")
    }
    if (!currentEvent.ownerUserId) {
      throw new Error("This event does not have a provider schedule owner.")
    }

    const currentOwnerUserId = currentEvent.ownerUserId
    const currentResourceIds = currentEvent.resourceBookings.map((booking) => booking.resourceId)

    if (currentEvent.kind === "APPOINTMENT" || currentEvent.kind === "CLASS") {
      await assertProviderAvailability({
        db: tx,
        practiceId: currentEvent.practiceId,
        therapistId: currentOwnerUserId,
        startsAt,
        endsAt,
        timezone: currentEvent.practice.timezone,
        allowOutsideAvailability,
      })
    }

    await assertNoCalendarEventConflict({
      db: tx,
      practiceId: currentEvent.practiceId,
      ownerUserId: currentOwnerUserId,
      startsAt,
      endsAt,
      excludeEventId: currentEvent.id,
    })
    await assertNoResourceConflict({
      db: tx,
      resourceIds: currentResourceIds,
      startsAt,
      endsAt,
      excludeEventId: currentEvent.id,
    })

    await tx.calendarEvent.update({
      where: { id: currentEvent.id },
      data: { startsAt, endsAt },
    })

    if (currentEvent.appointment) {
      await tx.appointment.update({
        where: { id: currentEvent.appointment.id },
        data: { startsAt, endsAt },
      })
    }

    if (currentEvent.personalBlock) {
      await tx.calendarBlock.update({
        where: { id: currentEvent.personalBlock.id },
        data: { startsAt, endsAt },
      })
    }

    await tx.calendarResourceBooking.updateMany({
      where: { eventId: currentEvent.id },
      data: { startsAt, endsAt },
    })

    await writeCalendarAuditAndNotifications(tx, {
      practiceId: currentEvent.practiceId,
      eventId: currentEvent.id,
      actorUserId: userId,
      action: "calendar.event.reschedule",
      recipientUserIds: [
        currentEvent.ownerUserId,
        currentEvent.appointment?.practiceClient.userId,
      ].filter(Boolean) as string[],
      payload: {
        title: currentEvent.title,
        kind: currentEvent.kind,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
      },
    })

    return currentEvent
  })

  await pushCalendarEventToGoogle(rescheduledEvent.id)

  revalidateCalendarRoutes(rescheduledEvent.practice.slug)
  return { ok: true }
}
