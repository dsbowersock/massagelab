"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { dateAtMinute, dateValue, parseTimeToMinute } from "@/lib/calendar"
import {
  STAFF_ROLES,
  THERAPIST_ROLES,
  assertCanManageTherapistSchedule,
  assertPracticeAccess,
  assertPracticeTherapist,
  currentUserId,
  fieldString,
  formOrObjectValue,
  getPracticeOrThrow,
  slugify,
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
import { assertCalendarDatabaseReady } from "@/lib/calendar-readiness"
import { mergeCalendarPreferencePatch } from "@/lib/calendar-preferences"
import { canRescheduleCalendarEvent } from "@/lib/calendar-workspace"
import { FEATURE_KEYS, getUserEntitlementState } from "@/lib/membership"
import { FREE_CALENDAR_LIMITS } from "@/lib/service-catalog"

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

export async function createAvailabilityScheduleAction(formData: FormData) {
  const userId = await currentUserId()
  await assertCalendarDatabaseReady()
  const practiceId = fieldString(formData, "practiceId")
  const therapistId = fieldString(formData, "therapistId")
  const name = fieldString(formData, "name") || "Working schedule"
  const dayOfWeek = Number(fieldString(formData, "dayOfWeek"))
  const startMinute = parseTimeToMinute(fieldString(formData, "startTime"))
  const endMinute = parseTimeToMinute(fieldString(formData, "endTime"))
  const practice = await getPracticeOrThrow(practiceId)
  const membership = await assertPracticeAccess(practiceId, userId, THERAPIST_ROLES)
  assertCanManageTherapistSchedule(membership.role, userId, therapistId)
  await assertPracticeTherapist(practiceId, therapistId)

  if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6 || startMinute === null || endMinute === null || endMinute <= startMinute) {
    throw new Error("Use a weekday and valid schedule start/end time.")
  }

  const effectiveFrom = fieldString(formData, "effectiveFrom")
  const effectiveTo = fieldString(formData, "effectiveTo")
  await prisma.calendarAvailabilitySchedule.create({
    data: {
      practiceId,
      therapistId,
      name,
      effectiveFrom: effectiveFrom ? dateAtMinute(effectiveFrom, 0, practice.timezone) : null,
      effectiveTo: effectiveTo ? dateAtMinute(effectiveTo, 0, practice.timezone) : null,
      timezone: practice.timezone,
      intervals: {
        create: {
          dayOfWeek,
          startMinute,
          endMinute,
        },
      },
    },
  })

  revalidatePath("/calendar")
  revalidatePath("/calendar/availability")
}

export async function createAvailabilityOverrideAction(formData: FormData) {
  const userId = await currentUserId()
  await assertCalendarDatabaseReady()
  const practiceId = fieldString(formData, "practiceId")
  const therapistId = fieldString(formData, "therapistId")
  const date = fieldString(formData, "date")
  const kind = fieldString(formData, "kind") || "OPEN"
  const reason = fieldString(formData, "reason")
  const startMinute = parseTimeToMinute(fieldString(formData, "startTime"))
  const endMinute = parseTimeToMinute(fieldString(formData, "endTime"))
  const practice = await getPracticeOrThrow(practiceId)
  const membership = await assertPracticeAccess(practiceId, userId, THERAPIST_ROLES)
  assertCanManageTherapistSchedule(membership.role, userId, therapistId)
  await assertPracticeTherapist(practiceId, therapistId)

  if (!date || !["OPEN", "CLOSED", "BLACKOUT", "HOLIDAY"].includes(kind)) {
    throw new Error("Choose a date and override type.")
  }
  if (kind === "OPEN" && (startMinute === null || endMinute === null || endMinute <= startMinute)) {
    throw new Error("Open overrides need valid start and end times.")
  }

  await prisma.calendarAvailabilityOverride.create({
    data: {
      practiceId,
      therapistId,
      date: dateAtMinute(date, 0, practice.timezone),
      kind: kind as "OPEN" | "CLOSED" | "BLACKOUT" | "HOLIDAY",
      reason: reason || null,
      timezone: practice.timezone,
      createdById: userId,
      intervals: kind === "OPEN" && startMinute !== null && endMinute !== null
        ? {
            create: {
              startMinute,
              endMinute,
            },
          }
        : undefined,
    },
  })

  revalidatePath("/calendar")
  revalidatePath("/calendar/availability")
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
  const userId = await currentUserId()
  await assertCalendarDatabaseReady()
  const name = fieldString(formData, "name")

  if (!name) {
    throw new Error("Practice name is required.")
  }

  const entitlements = await getUserEntitlementState(prisma, userId)
  if (!entitlements.hasFeature(FEATURE_KEYS.calendarFullScheduling)) {
    const ownedPracticeCount = await prisma.practiceMembership.count({
      where: { userId, role: "OWNER" },
    })
    if (ownedPracticeCount >= FREE_CALENDAR_LIMITS.practices) {
      throw new Error("Free calendars include one solo workspace.")
    }
  }

  const baseSlug = slugify(name) || "practice"
  let slug = baseSlug
  let suffix = 2

  while (await prisma.practice.findUnique({ where: { slug }, select: { id: true } })) {
    slug = `${baseSlug}-${suffix}`
    suffix += 1
  }

  const practice = await prisma.practice.create({
    data: {
      name,
      slug,
      createdById: userId,
      memberships: {
        create: {
          userId,
          role: "OWNER",
        },
      },
      serviceTypes: {
        create: {
          name: "Massage Session",
          durationMinutes: 60,
          description: "Default 60-minute appointment.",
          clientVisible: true,
          variants: {
            create: {
              name: "60 minute",
              durationMinutes: 60,
              bufferAfterMinutes: 0,
              clientVisible: true,
              sortOrder: 0,
            },
          },
        },
      },
    },
  })

  revalidatePath("/calendar")
  redirect(`/calendar?practice=${practice.id}`)
}

export async function createAvailabilityRuleAction(formData: FormData) {
  const userId = await currentUserId()
  await assertCalendarDatabaseReady()
  const practiceId = fieldString(formData, "practiceId")
  const therapistId = fieldString(formData, "therapistId")
  const dayOfWeek = Number(fieldString(formData, "dayOfWeek"))
  const startMinute = parseTimeToMinute(fieldString(formData, "startTime"))
  const endMinute = parseTimeToMinute(fieldString(formData, "endTime"))

  const membership = await assertPracticeAccess(practiceId, userId, THERAPIST_ROLES)
  assertCanManageTherapistSchedule(membership.role, userId, therapistId)
  await assertPracticeTherapist(practiceId, therapistId)

  if (!therapistId || !Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6 || startMinute === null || endMinute === null || endMinute <= startMinute) {
    throw new Error("Use a therapist, weekday, and valid start/end time.")
  }

  await prisma.therapistAvailabilityRule.create({
    data: {
      practiceId,
      therapistId,
      dayOfWeek,
      startMinute,
      endMinute,
    },
  })

  revalidatePath("/calendar")
  revalidatePath("/calendar/availability")
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
