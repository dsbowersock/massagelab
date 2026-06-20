import "server-only"

import { redirect } from "next/navigation"
import { Prisma } from "@prisma/client"
import { normalizeEmail } from "@/lib/auth-security"
import { localDateTimeToUtc } from "@/lib/calendar"
import { assertCalendarDatabaseReady } from "@/lib/calendar-readiness"
import {
  buildCalendarCreationPlan,
  sanitizeCalendarAuditMetadata,
} from "@/lib/calendar-flows"
import { prisma } from "@/lib/prisma"
import { calculateServiceEndTime } from "@/lib/service-catalog"
import {
  PRACTICE_SCHEDULING_ROLES,
  STAFF_ROLES,
  assertCalendarFlowAccess,
  assertPracticeAccess,
  assertPracticeTherapist,
  currentUserId,
  fieldBoolean,
  fieldInteger,
  fieldString,
  getPracticeOrThrow,
  operationalCalendarNote,
} from "./access"
import {
  OutsideProviderAvailabilityError,
  assertNoCalendarEventConflict,
  assertNoResourceConflict,
  assertProviderAvailability,
  lockAppointmentSchedulingRows,
} from "./availability"
import { writeCalendarAuditAndNotifications } from "./audit"
import { revalidateCalendarRoutes } from "./revalidation"
import {
  getServiceVariantForScheduling,
  getServiceVariantsForScheduling,
  selectedServiceVariantIds,
  serviceCompositionEndTime,
  serviceCompositionForCreate,
  serviceResourceIds,
  serviceSnapshotForCreate,
} from "./service-catalog"
import type { AppointmentActionState } from "./types"

const NEW_APPOINTMENT_CLIENT_VALUE = "__new_client__"

/**
 * Resolves the canonical practice client for staff-created appointments.
 * Existing client ids stay scoped to the practice; ad hoc client details create
 * or update the account/client pair needed by the scheduling write.
 */
async function ensureAppointmentPracticeClient(
  tx: Prisma.TransactionClient,
  {
    practiceId,
    practiceClientId,
    displayName,
    email,
    phone,
  }: {
    practiceId: string
    practiceClientId: string
    displayName: string
    email: string
    phone: string
  },
) {
  if (practiceClientId && practiceClientId !== NEW_APPOINTMENT_CLIENT_VALUE) {
    const existingClient = await tx.practiceClient.findFirst({
      where: { id: practiceClientId, practiceId },
      select: { id: true, userId: true },
    })

    if (!existingClient) {
      throw new Error("Choose an available practice client.")
    }

    return existingClient
  }

  const normalizedEmail = normalizeEmail(email)
  const cleanName = displayName.trim()
  const cleanPhone = phone.trim()

  if (!cleanName && !normalizedEmail && !cleanPhone) {
    throw new Error("Enter a client name, email, or phone number.")
  }

  const user = normalizedEmail
    ? await tx.user.upsert({
      where: { email: normalizedEmail },
      create: {
        name: cleanName || null,
        email: normalizedEmail,
      },
      update: {
        name: cleanName || undefined,
      },
      select: { id: true },
    })
    : await tx.user.create({
      data: {
        name: cleanName || null,
      },
      select: { id: true },
    })

  return tx.practiceClient.upsert({
    where: {
      practiceId_userId: {
        practiceId,
        userId: user.id,
      },
    },
    create: {
      practiceId,
      userId: user.id,
      displayName: cleanName || null,
      email: normalizedEmail || null,
      phone: cleanPhone || null,
    },
    update: {
      displayName: cleanName || undefined,
      email: normalizedEmail || undefined,
      phone: cleanPhone || undefined,
    },
    select: { id: true, userId: true },
  })
}

async function createAppointmentMutation(formData: FormData) {
  const userId = await currentUserId()
  await assertCalendarDatabaseReady()
  const practiceId = fieldString(formData, "practiceId")
  const therapistId = fieldString(formData, "therapistId")
  const practiceClientId = fieldString(formData, "practiceClientId")
  const newClientName = fieldString(formData, "newClientName")
  const newClientEmail = fieldString(formData, "newClientEmail")
  const newClientPhone = fieldString(formData, "newClientPhone")
  const serviceTypeId = fieldString(formData, "serviceTypeId")
  const serviceVariantIds = selectedServiceVariantIds(formData)
  const allowOutsideAvailability = fieldBoolean(formData, "allowOutsideAvailability")
  const practice = await getPracticeOrThrow(practiceId)
  const startsAt = localDateTimeToUtc(fieldString(formData, "startsAt"), practice.timezone)
  const notes = operationalCalendarNote(formData)

  await assertPracticeTherapist(practiceId, therapistId)
  await assertCalendarFlowAccess({ flow: "APPOINTMENT", practiceId, userId, targetUserId: therapistId })

  if ((serviceVariantIds.length === 0 && !serviceTypeId) || !startsAt) {
    throw new Error("Choose a client, service, therapist, and valid appointment time.")
  }

  const serviceVariants = serviceVariantIds.length > 0
    ? await getServiceVariantsForScheduling({ practiceId, serviceVariantIds, providerUserId: therapistId })
    : [await getServiceVariantForScheduling({ practiceId, serviceTypeId, providerUserId: therapistId })]

  const composition = serviceCompositionForCreate(serviceVariants)
  const endsAt = serviceCompositionEndTime(startsAt, serviceVariants)
  const resourceIds = composition.resourceIds
  const snapshot = composition.primary
  const massageCapacityItems = composition.items.map((item, index) => (
    serviceVariants[index]?.serviceType.countsTowardMassageCapacity ? (item.serviceDurationMinutes ?? 0) : 0
  ))
  const massageCapacityMinutes = massageCapacityItems.reduce((sum, minutes) => sum + minutes, 0)
  const title = composition.items.length > 1 ? `${snapshot.serviceName} + ${composition.items.length - 1} more` : snapshot.serviceName
  const plan = buildCalendarCreationPlan({
    flow: "APPOINTMENT",
    practiceId,
    actorUserId: userId,
    targetUserId: therapistId,
    startsAt,
    endsAt,
    title,
    timezone: practice.timezone,
    visibility: "PRACTICE",
  })

  await prisma.$transaction(async (tx) => {
    await lockAppointmentSchedulingRows(tx, { practiceId, therapistId, resourceIds, startsAt, endsAt })
    await assertProviderAvailability({
      db: tx,
      practiceId,
      therapistId,
      startsAt,
      endsAt,
      timezone: practice.timezone,
      allowOutsideAvailability,
    })
    await assertNoCalendarEventConflict({ db: tx, practiceId, ownerUserId: therapistId, startsAt, endsAt })
    await assertNoResourceConflict({ db: tx, resourceIds, startsAt, endsAt })

    const practiceClient = await ensureAppointmentPracticeClient(tx, {
      practiceId,
      practiceClientId,
      displayName: newClientName,
      email: newClientEmail,
      phone: newClientPhone,
    })

    const event = await tx.calendarEvent.create({
      data: plan.event as Prisma.CalendarEventUncheckedCreateInput,
    })

    await tx.appointment.create({
      data: {
        eventId: event.id,
        practiceId,
        therapistId,
        ...snapshot,
        practiceClientId: practiceClient.id,
        serviceTypeId: String(snapshot.serviceTypeId ?? serviceVariants[0].serviceTypeId),
        serviceVariantId: String(snapshot.serviceVariantId ?? serviceVariants[0].id),
        createdById: userId,
        startsAt,
        endsAt,
        status: "CONFIRMED",
        source: "THERAPIST_CREATED",
        massageCapacityMinutes,
        notes,
        serviceItems: {
          create: composition.items.map((item, index) => ({
            serviceTypeId: item.serviceTypeId ?? undefined,
            serviceVariantId: item.serviceVariantId ?? undefined,
            sortOrder: item.sortOrder,
            massageCapacityMinutes: massageCapacityItems[index] ?? 0,
            serviceName: item.serviceName,
            serviceVariantName: item.serviceVariantName,
            serviceCategory: item.serviceCategory,
            serviceColor: item.serviceColor,
            serviceDurationMinutes: item.serviceDurationMinutes,
            serviceProcessingMinutes: item.serviceProcessingMinutes,
            serviceBufferBeforeMinutes: item.serviceBufferBeforeMinutes,
            serviceBufferAfterMinutes: item.serviceBufferAfterMinutes,
            servicePriceCents: item.servicePriceCents,
            serviceCurrency: item.serviceCurrency,
          })),
        },
      },
    })

    if (resourceIds.length > 0) {
      await tx.calendarResourceBooking.createMany({
        data: resourceIds.map((resourceId) => ({
          eventId: event.id,
          resourceId,
          startsAt,
          endsAt,
        })),
        skipDuplicates: true,
      })
    }

    await writeCalendarAuditAndNotifications(tx, {
      practiceId,
      eventId: event.id,
      actorUserId: userId,
      action: plan.auditAction,
      recipientUserIds: [practiceClient.userId, therapistId].filter((recipientUserId): recipientUserId is string => Boolean(recipientUserId)),
      payload: { title, serviceCount: composition.items.length, therapistId, practiceClientId: practiceClient.id, resourceIds },
    })
  })

  revalidateCalendarRoutes(practice.slug)
  return "/calendar"
}

export async function createAppointment(formData: FormData) {
  const redirectTo = await createAppointmentMutation(formData)
  redirect(redirectTo)
}

export async function createAppointmentForm(
  _previousState: AppointmentActionState,
  formData: FormData,
): Promise<AppointmentActionState> {
  let redirectTo = "/calendar"

  try {
    redirectTo = await createAppointmentMutation(formData)
  } catch (error) {
    if (error instanceof OutsideProviderAvailabilityError) {
      return {
        status: "outside-availability",
        message: error.message,
        overrideKey: fieldString(formData, "overrideKey"),
      }
    }

    return {
      status: "error",
      message: error instanceof Error ? error.message : "Appointment creation failed.",
    }
  }

  redirect(redirectTo)
}

export async function createPersonalEvent(formData: FormData) {
  const userId = await currentUserId()
  await assertCalendarDatabaseReady()
  const practiceId = fieldString(formData, "practiceId")
  const therapistId = fieldString(formData, "therapistId")
  const practice = await getPracticeOrThrow(practiceId)
  const startsAt = localDateTimeToUtc(fieldString(formData, "startsAt"), practice.timezone)
  const endsAt = localDateTimeToUtc(fieldString(formData, "endsAt"), practice.timezone)
  const reason = fieldString(formData, "reason")
  const returnTo = fieldString(formData, "returnTo") || "/calendar"

  await assertPracticeTherapist(practiceId, therapistId)
  await assertCalendarFlowAccess({ flow: "PERSONAL", practiceId, userId, targetUserId: therapistId })

  if (!startsAt || !endsAt || endsAt <= startsAt) {
    throw new Error("Use a valid personal event start and end time.")
  }

  const title = reason || "Blocked time"
  const plan = buildCalendarCreationPlan({
    flow: "PERSONAL",
    practiceId,
    actorUserId: userId,
    targetUserId: therapistId,
    startsAt,
    endsAt,
    title,
    timezone: practice.timezone,
    visibility: "PRIVATE",
  })

  await prisma.$transaction(async (tx) => {
    await lockAppointmentSchedulingRows(tx, { practiceId, therapistId, resourceIds: [], startsAt, endsAt })
    await assertNoCalendarEventConflict({ db: tx, practiceId, ownerUserId: therapistId, startsAt, endsAt })

    const event = await tx.calendarEvent.create({ data: plan.event as Prisma.CalendarEventUncheckedCreateInput })

    await tx.calendarBlock.create({
      data: {
        eventId: event.id,
        practiceId,
        therapistId,
        startsAt,
        endsAt,
        reason: reason || null,
      },
    })

    await writeCalendarAuditAndNotifications(tx, {
      practiceId,
      eventId: event.id,
      actorUserId: userId,
      action: plan.auditAction,
      recipientUserIds: userId === therapistId ? [] : [therapistId],
      payload: { title, therapistId },
    })
  })

  revalidateCalendarRoutes(practice.slug)
  redirect(returnTo)
}

export async function createCalendarBlock(formData: FormData) {
  await createPersonalEvent(formData)
}

export async function createClass(formData: FormData) {
  const userId = await currentUserId()
  await assertCalendarDatabaseReady()
  const practiceId = fieldString(formData, "practiceId")
  const instructorId = fieldString(formData, "instructorId")
  const serviceVariantId = fieldString(formData, "serviceVariantId")
  const roomResource = fieldString(formData, "roomResource")
  const capacity = Math.max(1, fieldInteger(formData, "capacity", 1))
  const clientVisible = fieldString(formData, "clientVisible") === "on"
  const practice = await getPracticeOrThrow(practiceId)
  const startsAt = localDateTimeToUtc(fieldString(formData, "startsAt"), practice.timezone)

  await assertPracticeTherapist(practiceId, instructorId)
  await assertPracticeAccess(practiceId, userId, PRACTICE_SCHEDULING_ROLES)

  if (!serviceVariantId || !startsAt) {
    throw new Error("Choose a class service and valid start time.")
  }

  const serviceVariant = await getServiceVariantForScheduling({ practiceId, serviceVariantId, providerUserId: instructorId, classEligible: true })
  const endsAt = calculateServiceEndTime({ startsAt, variant: serviceVariant })
  const snapshot = serviceSnapshotForCreate(serviceVariant)
  const resourceIds = serviceResourceIds(serviceVariant)
  const title = fieldString(formData, "title") || `${snapshot.serviceName} class`
  const plan = buildCalendarCreationPlan({
    flow: "CLASS",
    practiceId,
    actorUserId: userId,
    targetUserId: instructorId,
    startsAt,
    endsAt,
    title,
    timezone: practice.timezone,
    visibility: clientVisible ? "CLIENT_VISIBLE" : "PRACTICE",
  })

  await prisma.$transaction(async (tx) => {
    await lockAppointmentSchedulingRows(tx, { practiceId, therapistId: instructorId, resourceIds, startsAt, endsAt })
    await assertProviderAvailability({ db: tx, practiceId, therapistId: instructorId, startsAt, endsAt, timezone: practice.timezone })
    await assertNoCalendarEventConflict({ db: tx, practiceId, ownerUserId: instructorId, startsAt, endsAt })
    await assertNoResourceConflict({ db: tx, resourceIds, startsAt, endsAt })

    const event = await tx.calendarEvent.create({ data: plan.event as Prisma.CalendarEventUncheckedCreateInput })

    await tx.calendarClass.create({
      data: {
        eventId: event.id,
        instructorId,
        serviceTypeId: serviceVariant.serviceTypeId,
        serviceVariantId: serviceVariant.id,
        capacity,
        roomResource: roomResource || null,
        clientVisible,
        ...snapshot,
      },
    })

    if (resourceIds.length > 0) {
      await tx.calendarResourceBooking.createMany({
        data: resourceIds.map((resourceId) => ({
          eventId: event.id,
          resourceId,
          startsAt,
          endsAt,
        })),
        skipDuplicates: true,
      })
    }

    await writeCalendarAuditAndNotifications(tx, {
      practiceId,
      eventId: event.id,
      actorUserId: userId,
      action: plan.auditAction,
      recipientUserIds: userId === instructorId ? [] : [instructorId],
      payload: { title, instructorId, capacity, roomResource, serviceTypeId: serviceVariant.serviceTypeId, serviceVariantId: serviceVariant.id, resourceIds },
    })
  })

  revalidateCalendarRoutes(practice.slug)
  redirect("/calendar")
}

export async function createReminder(formData: FormData) {
  const userId = await currentUserId()
  await assertCalendarDatabaseReady()
  const practiceId = fieldString(formData, "practiceId")
  const targetUserId = fieldString(formData, "targetUserId")
  const title = fieldString(formData, "title") || "Reminder"
  const relatedKind = fieldString(formData, "relatedKind")
  const relatedId = fieldString(formData, "relatedId")
  const practice = await getPracticeOrThrow(practiceId)
  const startsAt = localDateTimeToUtc(fieldString(formData, "startsAt"), practice.timezone)

  await assertPracticeTherapist(practiceId, targetUserId)
  await assertCalendarFlowAccess({ flow: "REMINDER", practiceId, userId, targetUserId })

  if (!startsAt) {
    throw new Error("Use a valid reminder time.")
  }

  const endsAt = new Date(startsAt.getTime() + 15 * 60_000)
  const plan = buildCalendarCreationPlan({
    flow: "REMINDER",
    practiceId,
    actorUserId: userId,
    targetUserId,
    startsAt,
    endsAt,
    title,
    timezone: practice.timezone,
    visibility: userId === targetUserId ? "PRIVATE" : "PRACTICE",
  })

  await prisma.$transaction(async (tx) => {
    const event = await tx.calendarEvent.create({ data: plan.event as Prisma.CalendarEventUncheckedCreateInput })

    await tx.calendarReminder.create({
      data: {
        eventId: event.id,
        relatedKind: relatedKind || null,
        relatedId: relatedId || null,
        payload: sanitizeCalendarAuditMetadata({ title, relatedKind, relatedId }) as Prisma.InputJsonValue,
      },
    })

    await writeCalendarAuditAndNotifications(tx, {
      practiceId,
      eventId: event.id,
      actorUserId: userId,
      action: plan.auditAction,
      recipientUserIds: userId === targetUserId ? [] : [targetUserId],
      payload: { title, relatedKind, relatedId },
    })
  })

  revalidateCalendarRoutes(practice.slug)
  redirect("/calendar")
}

export async function requestAppointment(formData: FormData) {
  const userId = await currentUserId()
  await assertCalendarDatabaseReady()
  const practiceId = fieldString(formData, "practiceId")
  const therapistId = fieldString(formData, "therapistId")
  const serviceVariantId = fieldString(formData, "serviceVariantId")
  const serviceTypeId = fieldString(formData, "serviceTypeId")
  const startsAtValue = fieldString(formData, "startsAt")

  if (!practiceId || !therapistId || (!serviceVariantId && !serviceTypeId) || !startsAtValue) {
    throw new Error("Choose an available appointment time.")
  }

  const [practice, serviceVariant, user] = await Promise.all([
    getPracticeOrThrow(practiceId),
    getServiceVariantForScheduling({ practiceId, serviceVariantId, serviceTypeId, providerUserId: therapistId, clientVisible: true }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    }),
  ])

  const startsAt = localDateTimeToUtc(startsAtValue, practice.timezone)
  if (!startsAt) {
    throw new Error("Choose an available appointment time.")
  }

  await assertPracticeTherapist(practiceId, therapistId)
  await assertCalendarFlowAccess({ flow: "CLIENT_REQUEST", practiceId, userId, targetUserId: therapistId, isClientSelf: true })

  const endsAt = calculateServiceEndTime({ startsAt, variant: serviceVariant })
  const resourceIds = serviceResourceIds(serviceVariant)
  const snapshot = serviceSnapshotForCreate(serviceVariant)

  const staffRecipients = await prisma.practiceMembership.findMany({
    where: {
      practiceId,
      role: { in: ["OWNER", "STAFF"] },
    },
    select: { userId: true },
  })

  await prisma.$transaction(async (tx) => {
    await lockAppointmentSchedulingRows(tx, { practiceId, therapistId, resourceIds, startsAt, endsAt })
    await assertProviderAvailability({ db: tx, practiceId, therapistId, startsAt, endsAt, timezone: practice.timezone })
    await assertNoCalendarEventConflict({ db: tx, practiceId, ownerUserId: therapistId, startsAt, endsAt })
    await assertNoResourceConflict({ db: tx, resourceIds, startsAt, endsAt })

    const practiceClient = await tx.practiceClient.upsert({
      where: {
        practiceId_userId: {
          practiceId,
          userId,
        },
      },
      create: {
        practiceId,
        userId,
        displayName: user?.name ?? null,
        email: user?.email ?? null,
      },
      update: {
        displayName: user?.name ?? undefined,
        email: user?.email ?? undefined,
      },
    })

    const plan = buildCalendarCreationPlan({
      flow: "CLIENT_REQUEST",
      practiceId,
      actorUserId: userId,
      targetUserId: therapistId,
      startsAt,
      endsAt,
      title: snapshot.serviceName,
      timezone: practice.timezone,
      visibility: "PRACTICE",
    })

    const event = await tx.calendarEvent.create({ data: plan.event as Prisma.CalendarEventUncheckedCreateInput })

    await tx.appointment.create({
      data: {
        eventId: event.id,
        practiceId,
        therapistId,
        practiceClientId: practiceClient.id,
        serviceTypeId: serviceVariant.serviceTypeId,
        serviceVariantId: serviceVariant.id,
        createdById: userId,
        startsAt,
        endsAt,
        status: "REQUESTED",
        source: "CLIENT_REQUEST",
        ...snapshot,
        serviceItems: {
          create: [{
            serviceTypeId: serviceVariant.serviceTypeId,
            serviceVariantId: serviceVariant.id,
            sortOrder: 0,
            ...snapshot,
          }],
        },
      },
    })

    if (resourceIds.length > 0) {
      await tx.calendarResourceBooking.createMany({
        data: resourceIds.map((resourceId) => ({
          eventId: event.id,
          resourceId,
          startsAt,
          endsAt,
        })),
        skipDuplicates: true,
      })
    }

    await writeCalendarAuditAndNotifications(tx, {
      practiceId,
      eventId: event.id,
      actorUserId: userId,
      action: plan.auditAction,
      recipientUserIds: [therapistId, ...staffRecipients.map((recipient) => recipient.userId)],
      payload: { title: snapshot.serviceName, serviceTypeId: serviceVariant.serviceTypeId, serviceVariantId: serviceVariant.id, therapistId, practiceClientId: practiceClient.id, resourceIds },
    })
  })

  revalidateCalendarRoutes(practice.slug)
  redirect("/calendar")
}

export async function updateAppointmentRequestStatus(formData: FormData) {
  const userId = await currentUserId()
  await assertCalendarDatabaseReady()
  const appointmentId = fieldString(formData, "appointmentId")
  const nextStatus = fieldString(formData, "status")

  if (nextStatus !== "CONFIRMED" && nextStatus !== "CANCELLED") {
    throw new Error("Choose confirm or decline for this appointment request.")
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      event: {
        include: {
          resourceBookings: { select: { resourceId: true } },
        },
      },
      practice: { select: { slug: true } },
      practiceClient: { select: { userId: true } },
      serviceType: { select: { name: true } },
    },
  })

  if (!appointment || appointment.status !== "REQUESTED") {
    throw new Error("Choose an active appointment request.")
  }

  const membership = await assertPracticeAccess(appointment.practiceId, userId, STAFF_ROLES)
  if (membership.role === "THERAPIST" && appointment.therapistId !== userId) {
    throw new Error("You can only review requests for your own schedule.")
  }

  const auditAction = nextStatus === "CONFIRMED" ? "calendar.appointment.confirm" : "calendar.appointment.decline"
  const notificationAction = nextStatus === "CONFIRMED" ? "APPOINTMENT_CONFIRMED" : "APPOINTMENT_DECLINED"
  const resourceIds = appointment.event.resourceBookings.map((booking) => booking.resourceId)

  await prisma.$transaction(async (tx) => {
    if (nextStatus === "CONFIRMED") {
      await lockAppointmentSchedulingRows(tx, {
        practiceId: appointment.practiceId,
        therapistId: appointment.therapistId,
        resourceIds,
        startsAt: appointment.startsAt,
        endsAt: appointment.endsAt,
      })
      await assertNoCalendarEventConflict({
        db: tx,
        practiceId: appointment.practiceId,
        ownerUserId: appointment.therapistId,
        startsAt: appointment.startsAt,
        endsAt: appointment.endsAt,
        excludeEventId: appointment.eventId,
      })
      await assertNoResourceConflict({
        db: tx,
        resourceIds,
        startsAt: appointment.startsAt,
        endsAt: appointment.endsAt,
        excludeEventId: appointment.eventId,
      })
    }

    await tx.calendarEvent.update({
      where: { id: appointment.eventId },
      data: { status: nextStatus },
    })

    await tx.appointment.update({
      where: { id: appointment.id },
      data: { status: nextStatus },
    })

    await writeCalendarAuditAndNotifications(tx, {
      practiceId: appointment.practiceId,
      eventId: appointment.eventId,
      actorUserId: userId,
      action: auditAction,
      recipientUserIds: [appointment.practiceClient.userId, appointment.therapistId].filter((recipientUserId): recipientUserId is string => Boolean(recipientUserId)),
      payload: { action: notificationAction, title: appointment.serviceName ?? appointment.serviceType.name, appointmentId: appointment.id },
    })
  })

  revalidateCalendarRoutes(appointment.practice.slug)
  redirect("/calendar/requests")
}
