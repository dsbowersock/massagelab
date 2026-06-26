import "server-only"

import { redirect } from "next/navigation"
import { Prisma } from "@prisma/client"
import { getCurrentSession } from "@/auth"
import { normalizeEmail } from "@/lib/auth-security"
import {
  capacityAllowsBooking,
  hasRestGapConflict,
  normalizePressureLevel,
  providerAppointmentLimitAllows,
} from "@/lib/booking-policy"
import { dateValue, localDateTimeToUtc } from "@/lib/calendar"
import { assertCalendarDatabaseReady } from "@/lib/calendar-readiness"
import { pushCalendarEventToGoogleBestEffort } from "@/lib/calendar-sync-service"
import { buildCalendarCreationPlan } from "@/lib/calendar-flows"
import { prisma } from "@/lib/prisma"
import { PUBLIC_SEQUENCE_PICKER_MAX_OPTIONS, publicBookingSequenceOptions } from "@/lib/public-booking-sequences"
import { publicBookingPathForPractice } from "@/lib/public-booking-url"
import {
  STAFF_ROLES,
  assertPracticeAccess,
  currentUserId,
  fieldString,
} from "./access"
import {
  assertNoCalendarEventConflict,
  assertNoResourceConflict,
  assertProviderAvailability,
  lockAppointmentSchedulingRows,
} from "./availability"
import { writeCalendarAuditAndNotifications } from "./audit"
import { revalidateCalendarRoutes } from "./revalidation"
import {
  selectedAddOnVariantIds,
  serviceResourceIds,
  serviceSnapshotForCreate,
} from "./service-catalog"

type BookingClientIdentity = {
  userId: string | null
  guestName?: string
  guestEmail?: string
  guestPhone?: string
  practiceClientId?: string
}

function publicBookingClientIdentity(formData: FormData, userId: string | null): BookingClientIdentity {
  if (userId) {
    return { userId }
  }

  const guestName = fieldString(formData, "guestName")
  const guestEmail = normalizeEmail(fieldString(formData, "guestEmail"))
  const guestPhone = fieldString(formData, "guestPhone")

  if (!guestName) {
    throw new Error("Enter your name before requesting an appointment.")
  }
  if (!guestEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) {
    throw new Error("Enter a valid email before requesting an appointment.")
  }
  if (!guestPhone) {
    throw new Error("Enter your phone number before requesting an appointment.")
  }

  return { userId: null, guestName, guestEmail, guestPhone }
}

/**
 * Resolves the canonical practice client for public booking writes without
 * requiring anonymous guests to create account records.
 */
async function ensureBookingPracticeClient(tx: Prisma.TransactionClient, practiceId: string, identity: BookingClientIdentity) {
  if (identity.practiceClientId) {
    const existing = await tx.practiceClient.findFirst({
      where: { id: identity.practiceClientId, practiceId },
      select: { id: true, userId: true },
    })
    if (!existing) {
      throw new Error("Choose an available practice client.")
    }
    return existing
  }

  if (!identity.userId) {
    const existingGuest = await tx.practiceClient.findFirst({
      where: {
        practiceId,
        userId: null,
        email: identity.guestEmail,
      },
      orderBy: { updatedAt: "desc" },
    })
    if (existingGuest) {
      return tx.practiceClient.update({
        where: { id: existingGuest.id },
        data: {
          displayName: identity.guestName,
          email: identity.guestEmail,
          phone: identity.guestPhone,
        },
      })
    }

    return tx.practiceClient.create({
      data: {
        practiceId,
        userId: null,
        displayName: identity.guestName,
        email: identity.guestEmail,
        phone: identity.guestPhone,
      },
    })
  }

  const user = await tx.user.findUnique({
    where: { id: identity.userId },
    select: { name: true, email: true },
  })

  return tx.practiceClient.upsert({
    where: {
      practiceId_userId: {
        practiceId,
        userId: identity.userId,
      },
    },
    create: {
      practiceId,
      userId: identity.userId,
      displayName: user?.name ?? null,
      email: user?.email ?? null,
    },
    update: {
      displayName: user?.name ?? undefined,
      email: user?.email ?? undefined,
    },
  })
}

/**
 * Enforces provider booking policy gates for a candidate booking interval.
 * The same transaction context supplies provider limits, existing bookings,
 * capacity rules, and practice-local timezone data; this throws when rest-gap,
 * appointment-count, or massage-capacity constraints no longer allow the slot.
 */
async function assertProviderBookingPolicyLimits({
  tx,
  practiceId,
  provider,
  policy,
  startsAt,
  endsAt,
  requestedPressureLevel,
  massageCapacityMinutes,
  timeZone,
}: {
  tx: Prisma.TransactionClient
  practiceId: string
  provider: {
    userId: string
    minRestMinutes?: number | null
    dailyAppointmentLimit?: number | null
    weeklyAppointmentLimit?: number | null
  }
  policy: { dailyAppointmentLimit?: number | null }
  startsAt: Date
  endsAt: Date
  requestedPressureLevel: number
  massageCapacityMinutes: number
  timeZone: string
}) {
  const existingAppointments = await tx.appointment.findMany({
    where: {
      practiceId,
      therapistId: provider.userId,
      status: { in: ["REQUESTED", "CONFIRMED"] },
    },
    select: {
      therapistId: true,
      startsAt: true,
      endsAt: true,
      status: true,
      requestedPressureLevel: true,
      massageCapacityMinutes: true,
    },
  })
  const existingBookings = existingAppointments.map((appointment) => ({
    providerUserId: appointment.therapistId,
    startsAt: appointment.startsAt,
    endsAt: appointment.endsAt,
    status: appointment.status,
    requestedPressureLevel: appointment.requestedPressureLevel,
    massageCapacityMinutes: appointment.massageCapacityMinutes,
  }))
  const capacityRules = await tx.providerBookingCapacityRule.findMany({
    where: { practiceId, providerUserId: provider.userId, active: true },
  })

  if (hasRestGapConflict({
    startsAt,
    endsAt,
    minRestMinutes: provider.minRestMinutes ?? 0,
    existingBookings,
  })) {
    throw new Error("Provider rest gap is no longer available.")
  }

  const limitState = providerAppointmentLimitAllows({
    providerUserId: provider.userId,
    startsAt,
    dailyAppointmentLimit: provider.dailyAppointmentLimit ?? policy.dailyAppointmentLimit ?? null,
    weeklyAppointmentLimit: provider.weeklyAppointmentLimit ?? null,
    existingBookings,
    timeZone,
  })
  if (!limitState.allowed) {
    throw new Error("Provider booking limit is no longer available.")
  }

  const capacityState = capacityAllowsBooking({
    providerUserId: provider.userId,
    startsAt,
    requestedPressureLevel,
    massageCapacityMinutes,
    capacityRules,
    existingBookings,
    timeZone,
  })
  if (!capacityState.allowed) {
    throw new Error("Provider massage capacity is no longer available.")
  }
}

/**
 * Revalidates the selected public sequence, then writes every appointment in
 * one transaction with fresh locking, availability, conflict, and capacity checks.
 */
async function createBookingSequenceMutation({
  userId,
  clientIdentity,
  practiceId,
  primaryServiceVariantId,
  addOnServiceVariantIds,
  requestedPressureLevel,
  startsAt,
  preferredProviderId = "",
  practiceClientId,
  forceStatus,
  waitlistEntryId,
}: {
  userId: string | null
  clientIdentity?: BookingClientIdentity
  practiceId: string
  primaryServiceVariantId: string
  addOnServiceVariantIds: string[]
  requestedPressureLevel: number
  startsAt: Date
  preferredProviderId?: string
  practiceClientId?: string
  forceStatus?: "CONFIRMED"
  waitlistEntryId?: string
}) {
  const context = await publicBookingSequenceOptions({
    practiceId,
    primaryServiceVariantId,
    addOnServiceVariantIds,
    requestedPressureLevel,
    preferredProviderId,
    viewerUserId: userId,
    maxOptions: PUBLIC_SEQUENCE_PICKER_MAX_OPTIONS,
  })
  if (!userId && !context.allowGuestBooking) {
    throw new Error("Sign in before requesting an appointment with this practice.")
  }
  const requestedStart = startsAt.toISOString()
  const option = context.options.find((candidate: { startsAt: string }) => candidate.startsAt === requestedStart)
  if (!option) {
    throw new Error("Choose an available booking sequence.")
  }

  const status = forceStatus ?? option.status as "REQUESTED" | "CONFIRMED"
  const groupStatus = status === "CONFIRMED" ? "CONFIRMED" : "REQUESTED"
  const variantById = new Map(context.variants.map((variant) => [variant.id, variant]))
  const providerById = new Map(context.providers.map((provider) => [provider.userId, provider]))
  const staffRecipients = await prisma.practiceMembership.findMany({
    where: {
      practiceId,
      role: { in: ["OWNER", "STAFF"] },
    },
    select: { userId: true },
  })
  const createdEventIds: string[] = []

  await prisma.$transaction(async (tx) => {
    const practiceClient = await ensureBookingPracticeClient(tx, practiceId, clientIdentity ?? { userId, practiceClientId })
    const bookingGroup = await tx.bookingGroup.create({
      data: {
        practiceId,
        practiceClientId: practiceClient.id,
        createdById: userId,
        requestedPressureLevel,
        status: groupStatus,
      },
    })

    if (waitlistEntryId) {
      const waitlistUpdate = await tx.bookingWaitlistEntry.updateMany({
        where: { id: waitlistEntryId, practiceId, status: "OPEN" },
        data: {
          status: "BOOKED",
          convertedBookingGroupId: bookingGroup.id,
        },
      })
      if (waitlistUpdate.count !== 1) {
        throw new Error("Choose an open waitlist entry.")
      }
    }

    for (const item of option.items) {
      const variant = variantById.get(item.serviceVariantId)
      const provider = providerById.get(item.providerUserId)
      if (!variant) {
        throw new Error("Choose available booking services.")
      }
      if (!provider) {
        throw new Error("Choose an available booking provider.")
      }

      const itemStartsAt = dateValue(item.startsAt)
      const itemEndsAt = dateValue(item.endsAt)
      const resourceIds = serviceResourceIds(variant)
      const snapshot = serviceSnapshotForCreate(variant)
      await lockAppointmentSchedulingRows(tx, {
        practiceId,
        therapistId: item.providerUserId,
        resourceIds,
        startsAt: itemStartsAt,
        endsAt: itemEndsAt,
      })
      await assertProviderBookingPolicyLimits({
        tx,
        practiceId,
        provider,
        policy: context.policy,
        startsAt: itemStartsAt,
        endsAt: itemEndsAt,
        requestedPressureLevel,
        massageCapacityMinutes: item.massageCapacityMinutes,
        timeZone: context.practice.timezone,
      })
      await assertProviderAvailability({ db: tx, practiceId, therapistId: item.providerUserId, startsAt: itemStartsAt, endsAt: itemEndsAt, timezone: context.practice.timezone })
      await assertNoCalendarEventConflict({ db: tx, practiceId, ownerUserId: item.providerUserId, startsAt: itemStartsAt, endsAt: itemEndsAt })
      await assertNoResourceConflict({ db: tx, resourceIds, startsAt: itemStartsAt, endsAt: itemEndsAt })

      const plan = buildCalendarCreationPlan({
        flow: "CLIENT_REQUEST",
        practiceId,
        actorUserId: userId,
        targetUserId: item.providerUserId,
        startsAt: itemStartsAt,
        endsAt: itemEndsAt,
        title: snapshot.serviceName,
        timezone: context.practice.timezone,
        visibility: "PRACTICE",
      })
      const event = await tx.calendarEvent.create({
        data: {
          ...(plan.event as Prisma.CalendarEventUncheckedCreateInput),
          status,
        },
      })
      createdEventIds.push(event.id)

      const appointment = await tx.appointment.create({
        data: {
          eventId: event.id,
          practiceId,
          therapistId: item.providerUserId,
          practiceClientId: practiceClient.id,
          serviceTypeId: variant.serviceTypeId,
          serviceVariantId: variant.id,
          bookingGroupId: bookingGroup.id,
          bookingGroupOrder: item.sortOrder,
          createdById: userId,
          startsAt: itemStartsAt,
          endsAt: itemEndsAt,
          status,
          source: "CLIENT_REQUEST",
          requestedPressureLevel,
          massageCapacityMinutes: item.massageCapacityMinutes,
          ...snapshot,
          serviceItems: {
            create: [{
              serviceTypeId: variant.serviceTypeId,
              serviceVariantId: variant.id,
              sortOrder: item.sortOrder,
              requestedPressureLevel,
              massageCapacityMinutes: item.massageCapacityMinutes,
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
            startsAt: itemStartsAt,
            endsAt: itemEndsAt,
          })),
          skipDuplicates: true,
        })
      }

      await writeCalendarAuditAndNotifications(tx, {
        practiceId,
        eventId: event.id,
        actorUserId: userId,
        action: status === "CONFIRMED" ? "calendar.booking_sequence.auto_confirm" : plan.auditAction,
        recipientUserIds: [item.providerUserId, ...staffRecipients.map((recipient) => recipient.userId)],
        payload: {
          title: snapshot.serviceName,
          appointmentId: appointment.id,
          serviceTypeId: variant.serviceTypeId,
          serviceVariantId: variant.id,
          therapistId: item.providerUserId,
          practiceClientId: practiceClient.id,
          bookingGroupId: bookingGroup.id,
          requestedPressureLevel,
          resourceIds,
        },
      })
    }
  })

  await Promise.all(createdEventIds.map((eventId) => pushCalendarEventToGoogleBestEffort(eventId)))

  const publicBookingPath = publicBookingPathForPractice(context.practice)
  revalidateCalendarRoutes(context.practice.slug, publicBookingPath)
  return publicBookingPath
}

export async function requestBookingSequence(formData: FormData) {
  const session = await getCurrentSession()
  const userId = session?.user?.id ?? null
  await assertCalendarDatabaseReady()
  const practiceId = fieldString(formData, "practiceId")
  const primaryServiceVariantId = fieldString(formData, "primaryServiceVariantId")
  const addOnServiceVariantIds = selectedAddOnVariantIds(formData)
  const pressureLevel = normalizePressureLevel(fieldString(formData, "requestedPressureLevel"))
  const startsAt = dateValue(fieldString(formData, "startsAt"))
  const preferredProviderId = fieldString(formData, "preferredProviderId")

  if (!practiceId || !primaryServiceVariantId || !pressureLevel || !startsAt) {
    throw new Error("Choose a service, pressure preference, and available time.")
  }
  const clientIdentity = publicBookingClientIdentity(formData, userId)

  const publicBookingPath = await createBookingSequenceMutation({
    userId,
    clientIdentity,
    practiceId,
    primaryServiceVariantId,
    addOnServiceVariantIds,
    requestedPressureLevel: pressureLevel,
    startsAt,
    preferredProviderId,
  })

  redirect(`${publicBookingPath}?booking=requested`)
}

export async function joinBookingWaitlist(formData: FormData) {
  const session = await getCurrentSession()
  const userId = session?.user?.id ?? null
  await assertCalendarDatabaseReady()
  const practiceId = fieldString(formData, "practiceId")
  const primaryServiceVariantId = fieldString(formData, "primaryServiceVariantId")
  const addOnServiceVariantIds = selectedAddOnVariantIds(formData)
  const pressureLevel = normalizePressureLevel(fieldString(formData, "requestedPressureLevel"))
  const preferredProviderId = fieldString(formData, "preferredProviderId")
  const preferredStartsAtValue = fieldString(formData, "preferredStartsAt")

  if (!practiceId || !primaryServiceVariantId || !pressureLevel) {
    throw new Error("Choose a service and pressure preference before joining the waitlist.")
  }
  const clientIdentity = publicBookingClientIdentity(formData, userId)

  const context = await publicBookingSequenceOptions({
    practiceId,
    primaryServiceVariantId,
    addOnServiceVariantIds,
    requestedPressureLevel: pressureLevel,
    preferredProviderId,
    viewerUserId: userId,
    maxOptions: 1,
  })

  if (!userId && !context.allowGuestBooking) {
    throw new Error("Sign in before joining this practice waitlist.")
  }
  if (context.options.length > 0) {
    throw new Error("Choose an available appointment time before joining the waitlist.")
  }

  await prisma.$transaction(async (tx) => {
    const practiceClient = await ensureBookingPracticeClient(tx, practiceId, clientIdentity)
    await tx.bookingWaitlistEntry.create({
      data: {
        practiceId,
        practiceClientId: practiceClient.id,
        createdById: userId,
        requestedPressureLevel: pressureLevel,
        primaryServiceVariantId,
        addOnServiceVariantIds,
        preferredProviderId: preferredProviderId || null,
        preferredStartsAt: preferredStartsAtValue ? dateValue(preferredStartsAtValue) : null,
      },
    })
  })

  const publicBookingPath = publicBookingPathForPractice(context.practice)
  revalidateCalendarRoutes(context.practice.slug, publicBookingPath)
  redirect(`${publicBookingPath}?waitlist=joined`)
}

export async function convertWaitlistEntry(formData: FormData) {
  const userId = await currentUserId()
  await assertCalendarDatabaseReady()
  const waitlistEntryId = fieldString(formData, "waitlistEntryId")
  const startsAtValue = fieldString(formData, "startsAt")
  const preferredProviderId = fieldString(formData, "preferredProviderId")

  const entry = await prisma.bookingWaitlistEntry.findUnique({
    where: { id: waitlistEntryId },
    include: { practice: true },
  })
  if (!entry || entry.status !== "OPEN" || !entry.primaryServiceVariantId) {
    throw new Error("Choose an open waitlist entry.")
  }
  const startsAt = localDateTimeToUtc(startsAtValue, entry.practice.timezone)
  if (!startsAt) {
    throw new Error("Choose a valid confirmed start time.")
  }

  const membership = await assertPracticeAccess(entry.practiceId, userId, STAFF_ROLES)
  if (membership.role === "THERAPIST" && preferredProviderId !== userId) {
    throw new Error("Therapists can only convert waitlist requests to their own schedule.")
  }

  await createBookingSequenceMutation({
    userId,
    practiceId: entry.practiceId,
    primaryServiceVariantId: entry.primaryServiceVariantId,
    addOnServiceVariantIds: entry.addOnServiceVariantIds,
    requestedPressureLevel: entry.requestedPressureLevel,
    startsAt,
    preferredProviderId,
    practiceClientId: entry.practiceClientId,
    forceStatus: "CONFIRMED",
    waitlistEntryId,
  })

  redirect("/calendar/requests")
}
