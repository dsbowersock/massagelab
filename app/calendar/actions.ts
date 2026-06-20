"use server"

import { prisma } from "@/lib/prisma"
import { dateValue } from "@/lib/calendar"
import {
  STAFF_ROLES,
  assertPracticeAccess,
  currentUserId,
  formOrObjectValue,
} from "./actions/access"
import {
  assertNoCalendarEventConflict,
  assertNoResourceConflict,
  assertProviderAvailability,
  lockAppointmentSchedulingRows,
} from "./actions/availability"
import { writeCalendarAuditAndNotifications } from "./actions/audit"
import { revalidateCalendarRoutes } from "./actions/revalidation"
import {
  saveBookingPolicy,
  saveProviderBookingPolicy,
  saveProviderCapacityRules,
  savePublicBookingUrl,
} from "./actions/booking"
import {
  convertWaitlistEntry,
  joinBookingWaitlist,
  requestBookingSequence,
} from "./actions/public-booking"
import { saveCalendarPreferences } from "./actions/preferences"
import {
  createAppointment,
  createAppointmentForm,
  createCalendarBlock,
  createClass,
  createPersonalEvent,
  createReminder,
  requestAppointment,
  updateAppointmentRequestStatus,
} from "./actions/events"
import type { AppointmentActionState } from "./actions/types"
import {
  createService,
  updateService,
} from "./actions/services"
import {
  createAvailabilityOverride,
  createAvailabilityRule,
  createAvailabilitySchedule,
  createPractice,
} from "./actions/setup"
import { assertCalendarDatabaseReady } from "@/lib/calendar-readiness"
import { canRescheduleCalendarEvent } from "@/lib/calendar-workspace"

export async function saveBookingPolicyAction(formData: FormData) {
  return saveBookingPolicy(formData)
}

export async function savePublicBookingUrlAction(formData: FormData) {
  return savePublicBookingUrl(formData)
}

export async function saveProviderBookingPolicyAction(formData: FormData) {
  return saveProviderBookingPolicy(formData)
}

export async function saveProviderCapacityRulesAction(formData: FormData) {
  return saveProviderCapacityRules(formData)
}

export async function requestBookingSequenceAction(formData: FormData) {
  return requestBookingSequence(formData)
}

export async function joinBookingWaitlistAction(formData: FormData) {
  return joinBookingWaitlist(formData)
}

export async function convertWaitlistEntryAction(formData: FormData) {
  return convertWaitlistEntry(formData)
}

export async function saveCalendarPreferencesAction(input: Record<string, unknown>) {
  return saveCalendarPreferences(input)
}

export async function createAvailabilityScheduleAction(formData: FormData) {
  return createAvailabilitySchedule(formData)
}

export async function createAvailabilityOverrideAction(formData: FormData) {
  return createAvailabilityOverride(formData)
}

export async function rescheduleCalendarEventAction(input: FormData | Record<string, unknown>) {
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

  const event = await prisma.calendarEvent.findUnique({
    where: { id: eventId },
    include: {
      practice: { select: { slug: true, timezone: true } },
      resourceBookings: { select: { resourceId: true } },
      appointment: {
        include: {
          practiceClient: { select: { userId: true } },
        },
      },
      personalBlock: true,
      class: true,
    },
  })

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

  const ownerUserId = event.ownerUserId
  const resourceIds = event.resourceBookings.map((booking) => booking.resourceId)

  await prisma.$transaction(async (tx) => {
    await lockAppointmentSchedulingRows(tx, { practiceId: event.practiceId, therapistId: ownerUserId, resourceIds, startsAt, endsAt })

    if (event.kind === "APPOINTMENT" || event.kind === "CLASS") {
      await assertProviderAvailability({
        db: tx,
        practiceId: event.practiceId,
        therapistId: ownerUserId,
        startsAt,
        endsAt,
        timezone: event.practice.timezone,
        allowOutsideAvailability,
      })
    }

    await assertNoCalendarEventConflict({
      db: tx,
      practiceId: event.practiceId,
      ownerUserId,
      startsAt,
      endsAt,
      excludeEventId: event.id,
    })
    await assertNoResourceConflict({
      db: tx,
      resourceIds,
      startsAt,
      endsAt,
      excludeEventId: event.id,
    })

    await tx.calendarEvent.update({
      where: { id: event.id },
      data: { startsAt, endsAt },
    })

    if (event.appointment) {
      await tx.appointment.update({
        where: { id: event.appointment.id },
        data: { startsAt, endsAt },
      })
    }

    if (event.personalBlock) {
      await tx.calendarBlock.update({
        where: { id: event.personalBlock.id },
        data: { startsAt, endsAt },
      })
    }

    await tx.calendarResourceBooking.updateMany({
      where: { eventId: event.id },
      data: { startsAt, endsAt },
    })

    await writeCalendarAuditAndNotifications(tx, {
      practiceId: event.practiceId,
      eventId: event.id,
      actorUserId: userId,
      action: "calendar.event.reschedule",
      recipientUserIds: [
        event.ownerUserId,
        event.appointment?.practiceClient.userId,
      ].filter(Boolean) as string[],
      payload: {
        title: event.title,
        kind: event.kind,
        startsAt: startsAt.toISOString(),
        endsAt: endsAt.toISOString(),
      },
    })
  })

  revalidateCalendarRoutes(event.practice.slug)
  return { ok: true }
}

export async function createPracticeAction(formData: FormData) {
  return createPractice(formData)
}

export async function createAvailabilityRuleAction(formData: FormData) {
  return createAvailabilityRule(formData)
}

export async function createServiceAction(formData: FormData) {
  return createService(formData)
}

export async function updateServiceAction(formData: FormData) {
  return updateService(formData)
}
export async function createAppointmentAction(formData: FormData) {
  return createAppointment(formData)
}

export async function createAppointmentFormAction(
  previousState: AppointmentActionState,
  formData: FormData,
): Promise<AppointmentActionState> {
  return createAppointmentForm(previousState, formData)
}

export async function createPersonalEventAction(formData: FormData) {
  return createPersonalEvent(formData)
}

export async function createCalendarBlockAction(formData: FormData) {
  return createCalendarBlock(formData)
}

export async function createClassAction(formData: FormData) {
  return createClass(formData)
}

export async function createReminderAction(formData: FormData) {
  return createReminder(formData)
}

export async function requestAppointmentAction(formData: FormData) {
  return requestAppointment(formData)
}

export async function updateAppointmentRequestStatusAction(formData: FormData) {
  return updateAppointmentRequestStatus(formData)
}
