"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { Prisma } from "@prisma/client"
import { getCurrentSession } from "@/auth"
import { normalizeEmail } from "@/lib/auth-security"
import { prisma } from "@/lib/prisma"
import { dateAtMinute, dateValue, localDateTimeToUtc, parseTimeToMinute } from "@/lib/calendar"
import {
  capacityAllowsBooking,
  hasRestGapConflict,
  normalizePressureLevel,
  providerAppointmentLimitAllows,
} from "@/lib/booking-policy"
import {
  availabilityRangeOverrideState,
  calendarDateParts,
  OUTSIDE_PROVIDER_AVAILABILITY_MESSAGE,
  resolveAvailabilityForDate,
} from "@/lib/calendar-availability"
import { assertCalendarDatabaseReady } from "@/lib/calendar-readiness"
import { MAX_PUBLIC_ADD_ONS, PUBLIC_SEQUENCE_PICKER_MAX_OPTIONS, publicBookingSequenceOptions } from "@/lib/public-booking-sequences"
import {
  buildCalendarCreationPlan,
  buildCalendarNotificationIntents,
  canCreateCalendarFlow,
  hasCalendarEventConflict,
  sanitizeCalendarAuditMetadata,
} from "@/lib/calendar-flows"
import { mergeCalendarPreferencePatch } from "@/lib/calendar-preferences"
import { canRescheduleCalendarEvent } from "@/lib/calendar-workspace"
import { FEATURE_KEYS, getUserEntitlementState } from "@/lib/membership"
import {
  normalizePublicBookingSlug,
  normalizePublicBookingStateSlug,
  publicBookingPathForPractice,
} from "@/lib/public-booking-url"
import {
  FREE_CALENDAR_LIMITS,
  buildServiceSnapshot,
  composeAppointmentServices,
  calculateServiceEndTime,
  hasResourceConflict,
  serviceVariantBookableMinutes,
  sanitizeServiceClinicalTemplatePayload,
  sanitizeServicePolicyPayload,
} from "@/lib/service-catalog"

const STAFF_ROLES = ["OWNER", "THERAPIST", "STAFF"] as const
const PRACTICE_SCHEDULING_ROLES = ["OWNER", "STAFF"] as const
const THERAPIST_ROLES = ["OWNER", "THERAPIST"] as const
const ACTIVE_EVENT_STATUSES = ["REQUESTED", "CONFIRMED", "ACTIVE"] as const
const CALENDAR_NOTE_SENSITIVE_PATTERN = /(soap|pain|diagnosis|assessment|treatment|transcript|intake response|journal|symptom|medical history|client condition)/i
const NEW_APPOINTMENT_CLIENT_VALUE = "__new_client__"

type CalendarDb = typeof prisma | Prisma.TransactionClient

class OutsideProviderAvailabilityError extends Error {
  constructor(message = OUTSIDE_PROVIDER_AVAILABILITY_MESSAGE) {
    super(message)
    this.name = "OutsideProviderAvailabilityError"
  }
}

export type AppointmentActionState = {
  status: "idle" | "outside-availability" | "error"
  message: string
  overrideKey?: string
}

function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

function fieldString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === "string" ? value.trim() : ""
}

function fieldInteger(formData: FormData, key: string, fallback: number) {
  const value = Number(fieldString(formData, key))
  return Number.isInteger(value) ? value : fallback
}

function fieldBoolean(formData: FormData, key: string) {
  const value = formData.get(key)
  return value === "on" || value === "true" || value === "1"
}

function formOrObjectValue(input: FormData | Record<string, unknown>, key: string) {
  if (input instanceof FormData) {
    const value = input.get(key)
    return typeof value === "string" ? value.trim() : ""
  }

  const value = input[key]
  return typeof value === "string" ? value.trim() : ""
}

function fieldPriceCents(formData: FormData, key: string) {
  const value = fieldString(formData, key)
  if (!value) return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return Math.round(parsed * 100)
}

function positiveMinutes(formData: FormData, key: string, fallback = 0) {
  return Math.max(0, fieldInteger(formData, key, fallback))
}

function localDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  return date
}

function operationalCalendarNote(formData: FormData, key = "notes") {
  const value = fieldString(formData, key)
  if (!value) return null
  if (CALENDAR_NOTE_SENSITIVE_PATTERN.test(value)) {
    throw new Error("Calendar notes must stay operational. Keep client-specific clinical details in local-first documentation.")
  }
  return value
}

async function currentUserId() {
  const session = await getCurrentSession()
  if (!session?.user?.id) {
    redirect("/login")
  }
  return session.user.id
}

async function assertPracticeAccess(practiceId: string, userId: string, allowedRoles: readonly string[] = STAFF_ROLES) {
  const membership = await prisma.practiceMembership.findUnique({
    where: {
      practiceId_userId: {
        practiceId,
        userId,
      },
    },
  })

  if (!membership || !allowedRoles.includes(membership.role)) {
    throw new Error("You do not have access to this practice calendar.")
  }

  return membership
}

async function assertPracticeTherapist(practiceId: string, therapistId: string) {
  const therapist = await prisma.practiceMembership.findFirst({
    where: {
      practiceId,
      userId: therapistId,
      role: { in: ["OWNER", "THERAPIST"] },
    },
    select: { id: true },
  })

  if (!therapist) {
    throw new Error("Choose a therapist who belongs to this practice.")
  }
}

async function getPracticeOrThrow(practiceId: string) {
  const practice = await prisma.practice.findUnique({
    where: { id: practiceId },
    select: {
      id: true,
      name: true,
      slug: true,
      timezone: true,
      publicBookingStateSlug: true,
      publicBookingSlug: true,
    },
  })

  if (!practice) {
    throw new Error("Choose a valid practice calendar.")
  }

  return practice
}

async function assertCalendarFlowAccess({
  flow,
  practiceId,
  userId,
  targetUserId,
  isClientSelf = false,
}: {
  flow: string
  practiceId: string
  userId: string
  targetUserId: string
  isClientSelf?: boolean
}) {
  if (flow === "CLIENT_REQUEST") {
    if (!canCreateCalendarFlow({ flow, role: null, actorUserId: userId, targetUserId, isClientSelf })) {
      throw new Error("You do not have access to create this calendar request.")
    }
    return null
  }

  const membership = await assertPracticeAccess(practiceId, userId, STAFF_ROLES)
  if (!canCreateCalendarFlow({ flow, role: membership.role, actorUserId: userId, targetUserId })) {
    throw new Error("You do not have access to create this calendar item.")
  }

  return membership
}

async function assertNoCalendarEventConflict({
  db = prisma,
  practiceId,
  ownerUserId,
  startsAt,
  endsAt,
  excludeEventId,
}: {
  db?: CalendarDb
  practiceId: string
  ownerUserId: string
  startsAt: Date
  endsAt: Date
  excludeEventId?: string
}) {
  const events = await db.calendarEvent.findMany({
    where: {
      practiceId,
      ownerUserId,
      blocksAvailability: true,
      status: { in: [...ACTIVE_EVENT_STATUSES] },
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
      ...(excludeEventId ? { id: { not: excludeEventId } } : {}),
    },
    select: {
      startsAt: true,
      endsAt: true,
      kind: true,
      status: true,
      blocksAvailability: true,
    },
  })

  if (hasCalendarEventConflict({ startsAt, endsAt, events })) {
    throw new Error("That calendar time is no longer available.")
  }
}

async function assertNoResourceConflict({
  db = prisma,
  resourceIds,
  startsAt,
  endsAt,
  excludeEventId,
}: {
  db?: CalendarDb
  resourceIds: string[]
  startsAt: Date
  endsAt: Date
  excludeEventId?: string
}) {
  const uniqueResourceIds = [...new Set(resourceIds.filter(Boolean))]
  if (uniqueResourceIds.length === 0) return

  const existingBookings = await db.calendarResourceBooking.findMany({
    where: {
      resourceId: { in: uniqueResourceIds },
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
      ...(excludeEventId ? { eventId: { not: excludeEventId } } : {}),
    },
    include: {
      event: { select: { status: true, blocksAvailability: true } },
    },
  })

  if (hasResourceConflict({ resourceIds: uniqueResourceIds, startsAt, endsAt, existingBookings })) {
    throw new Error("A required room or resource is no longer available.")
  }
}

async function assertProviderAvailability({
  db = prisma,
  practiceId,
  therapistId,
  startsAt,
  endsAt,
  timezone,
  allowOutsideAvailability = false,
}: {
  db?: CalendarDb
  practiceId: string
  therapistId: string
  startsAt: Date
  endsAt: Date
  timezone: string
  allowOutsideAvailability?: boolean
}) {
  const startParts = calendarDateParts(startsAt, timezone)
  const endParts = calendarDateParts(endsAt, timezone)

  if (startParts.date !== endParts.date) {
    throw new Error("Calendar events must stay within one local availability day.")
  }

  const dayStart = dateAtMinute(startParts.date, 0, timezone)
  const nextDayStart = dateAtMinute(startParts.date, 24 * 60, timezone)
  const [weeklyRules, schedules, overrides] = await Promise.all([
    db.therapistAvailabilityRule.findMany({
      where: { practiceId, therapistId, active: true },
      select: { dayOfWeek: true, startMinute: true, endMinute: true, active: true },
    }),
    db.calendarAvailabilitySchedule.findMany({
      where: { practiceId, therapistId, active: true },
      include: { intervals: true },
      orderBy: [{ effectiveFrom: "asc" }, { createdAt: "asc" }],
    }),
    db.calendarAvailabilityOverride.findMany({
      where: {
        practiceId,
        therapistId,
        date: {
          gte: dayStart,
          lt: nextDayStart,
        },
      },
      include: { intervals: true },
      orderBy: { createdAt: "asc" },
    }),
  ])

  const availability = resolveAvailabilityForDate({
    date: startParts.date,
    weeklyRules,
    schedules: schedules.map((schedule) => ({
      active: schedule.active,
      effectiveFrom: schedule.effectiveFrom,
      effectiveTo: schedule.effectiveTo,
      intervals: schedule.intervals,
    })),
    overrides: overrides.map((override) => ({
      date: override.date,
      kind: override.kind,
      intervals: override.intervals,
    })),
  })

  const availabilityState = availabilityRangeOverrideState({
    availability,
    startMinute: startParts.minute,
    endMinute: endParts.minute,
    allowOutsideAvailability,
  })

  if (!availabilityState.allowed) {
    throw new OutsideProviderAvailabilityError(availabilityState.message)
  }
}

async function lockAppointmentSchedulingRows(
  tx: Prisma.TransactionClient,
  {
    practiceId,
    therapistId,
    resourceIds,
    startsAt,
    endsAt,
  }: {
    practiceId: string
    therapistId: string
    resourceIds: string[]
    startsAt: Date
    endsAt: Date
  },
) {
  const uniqueResourceIds = [...new Set(resourceIds.filter(Boolean))]

  await tx.$queryRaw`
    SELECT id
    FROM "PracticeMembership"
    WHERE "practiceId" = ${practiceId}
      AND "userId" = ${therapistId}
    FOR UPDATE
  `
  await tx.$queryRaw`
    SELECT id
    FROM "ProviderBookingPolicy"
    WHERE "practiceId" = ${practiceId}
      AND "providerUserId" = ${therapistId}
    FOR UPDATE
  `
  await tx.$queryRaw`
    SELECT id
    FROM "ProviderBookingCapacityRule"
    WHERE "practiceId" = ${practiceId}
      AND "providerUserId" = ${therapistId}
      AND "active" = true
    FOR UPDATE
  `
  await tx.$queryRaw`
    SELECT id
    FROM "TherapistAvailabilityRule"
    WHERE "practiceId" = ${practiceId}
      AND "therapistId" = ${therapistId}
    FOR UPDATE
  `
  await tx.$queryRaw`
    SELECT id
    FROM "CalendarAvailabilitySchedule"
    WHERE "practiceId" = ${practiceId}
      AND "therapistId" = ${therapistId}
    FOR UPDATE
  `
  await tx.$queryRaw`
    SELECT si.id
    FROM "CalendarAvailabilityScheduleInterval" si
    INNER JOIN "CalendarAvailabilitySchedule" s
      ON s.id = si."scheduleId"
    WHERE s."practiceId" = ${practiceId}
      AND s."therapistId" = ${therapistId}
    FOR UPDATE OF si
  `
  await tx.$queryRaw`
    SELECT id
    FROM "CalendarAvailabilityOverride"
    WHERE "practiceId" = ${practiceId}
      AND "therapistId" = ${therapistId}
    FOR UPDATE
  `
  await tx.$queryRaw`
    SELECT oi.id
    FROM "CalendarAvailabilityOverrideInterval" oi
    INNER JOIN "CalendarAvailabilityOverride" o
      ON o.id = oi."overrideId"
    WHERE o."practiceId" = ${practiceId}
      AND o."therapistId" = ${therapistId}
    FOR UPDATE OF oi
  `
  await tx.$queryRaw`
    SELECT id
    FROM "CalendarEvent"
    WHERE "practiceId" = ${practiceId}
      AND "ownerUserId" = ${therapistId}
      AND "blocksAvailability" = true
      AND "status" IN ('REQUESTED', 'CONFIRMED', 'ACTIVE')
      AND "startsAt" < ${endsAt}
      AND "endsAt" > ${startsAt}
    FOR UPDATE
  `

  if (uniqueResourceIds.length === 0) return

  await tx.$queryRaw(Prisma.sql`
    SELECT id
    FROM "CalendarResource"
    WHERE id IN (${Prisma.join(uniqueResourceIds)})
    FOR UPDATE
  `)
  await tx.$queryRaw(Prisma.sql`
    SELECT id
    FROM "CalendarResourceBooking"
    WHERE "resourceId" IN (${Prisma.join(uniqueResourceIds)})
      AND "startsAt" < ${endsAt}
      AND "endsAt" > ${startsAt}
    FOR UPDATE
  `)
}

type ServiceVariantForScheduling = Prisma.ServiceVariantGetPayload<{
  include: {
    serviceType: true
    resourceRequirements: {
      include: { resource: true }
    }
  }
}>

async function getServiceVariantForScheduling({
  practiceId,
  serviceVariantId,
  serviceTypeId,
  providerUserId,
  clientVisible = false,
  classEligible = false,
}: {
  practiceId: string
  serviceVariantId?: string
  serviceTypeId?: string
  providerUserId?: string
  clientVisible?: boolean
  classEligible?: boolean
}) {
  const variant = await prisma.serviceVariant.findFirst({
    where: {
      ...(serviceVariantId ? { id: serviceVariantId } : {}),
      ...(serviceTypeId ? { serviceTypeId } : {}),
      active: true,
      ...(clientVisible ? { clientVisible: true } : {}),
      serviceType: {
        practiceId,
        active: true,
        ...(clientVisible ? { clientVisible: true } : {}),
        ...(classEligible ? { classEligible: true } : {}),
      },
    },
    include: {
      serviceType: true,
      resourceRequirements: {
        include: { resource: true },
      },
    },
    orderBy: [
      { sortOrder: "asc" },
      { durationMinutes: "asc" },
    ],
  })

  if (!variant) {
    throw new Error(classEligible ? "Choose a class-eligible service variant." : "Choose an available service variant.")
  }
  if (providerUserId && variant.serviceType.eligibleProviderIds.length > 0 && !variant.serviceType.eligibleProviderIds.includes(providerUserId)) {
    throw new Error("Choose a provider who is eligible for the selected service.")
  }

  return variant
}

async function getServiceVariantsForScheduling({
  practiceId,
  serviceVariantIds,
  providerUserId,
  clientVisible = false,
}: {
  practiceId: string
  serviceVariantIds: string[]
  providerUserId: string
  clientVisible?: boolean
}) {
  const uniqueIds = [...new Set(serviceVariantIds.filter(Boolean))].slice(0, 6)
  if (uniqueIds.length === 0) {
    throw new Error("Choose at least one available service.")
  }

  const variants = await Promise.all(uniqueIds.map((serviceVariantId) => (
    getServiceVariantForScheduling({ practiceId, serviceVariantId, providerUserId, clientVisible })
  )))

  return variants
}

function serviceResourceIds(variant: ServiceVariantForScheduling) {
  return variant.resourceRequirements
    .filter((requirement) => requirement.resource.active)
    .map((requirement) => requirement.resourceId)
}

function serviceSnapshotForCreate(variant: ServiceVariantForScheduling) {
  return buildServiceSnapshot({ service: variant.serviceType, variant })
}

function selectedServiceVariantIds(formData: FormData) {
  const ids = formData.getAll("serviceVariantIds")
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean)
  const single = fieldString(formData, "serviceVariantId")
  return ids.length > 0 ? ids : (single ? [single] : [])
}

function selectedAddOnVariantIds(formData: FormData) {
  const values = formData.getAll("addOnServiceVariantIds")
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean)
  const commaList = fieldString(formData, "addOnServiceVariantIds")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)

  return [...new Set([...values, ...commaList])].slice(0, MAX_PUBLIC_ADD_ONS)
}

function serviceBookingRole(formData: FormData) {
  return fieldString(formData, "bookingRole") === "ADD_ON" ? "ADD_ON" : "PRIMARY"
}

function serviceCountsTowardCapacity(formData: FormData, bookingRole: "PRIMARY" | "ADD_ON") {
  void bookingRole
  if (formData.has("countsTowardMassageCapacity")) {
    return fieldBoolean(formData, "countsTowardMassageCapacity")
  }

  return false
}

function serviceCompositionForCreate(variants: ServiceVariantForScheduling[]) {
  return composeAppointmentServices(variants.map((variant) => ({
    service: variant.serviceType,
    variant,
    resourceIds: serviceResourceIds(variant),
  })))
}

function serviceCompositionEndTime(startsAt: Date, variants: ServiceVariantForScheduling[]) {
  const totalMinutes = variants.reduce((sum, variant) => sum + serviceVariantBookableMinutes(variant), 0)
  return new Date(startsAt.getTime() + totalMinutes * 60_000)
}

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

function parseResourceNames(formData: FormData) {
  return fieldString(formData, "resourceNames")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean)
    .slice(0, 10)
}

function parseBodyRegions(formData: FormData) {
  return fieldString(formData, "bodyRegions")
    .split(",")
    .map((region) => region.trim())
    .filter(Boolean)
    .slice(0, 20)
}

function parseProviderEligibility(formData: FormData) {
  const checked = formData.getAll("eligibleProviderIds")
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean)
  if (checked.length > 0) {
    return checked.slice(0, 50)
  }

  return fieldString(formData, "eligibleProviderIds")
    .split(",")
    .map((providerId) => providerId.trim())
    .filter(Boolean)
    .slice(0, 50)
}

function parseTemplateRefs(value: string) {
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 20)
    .map((label) => ({ id: label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || label, label }))
}

function parsePromptList(value: string) {
  return value
    .split("\n")
    .map((prompt) => prompt.trim())
    .filter(Boolean)
    .slice(0, 20)
}

function parseServiceVariants(formData: FormData) {
  const variants = Array.from({ length: 3 }, (_, index) => {
    const name = fieldString(formData, `variantName${index}`) || (index === 0 ? "Default" : "")
    const durationMinutes = positiveMinutes(formData, `variantDurationMinutes${index}`, index === 0 ? 60 : 0)
    const active = index === 0 || fieldBoolean(formData, `variantActive${index}`)

    if (!name || durationMinutes <= 0 || !active) return null

    return {
      id: fieldString(formData, `variantId${index}`) || null,
      name,
      durationMinutes,
      processingMinutes: positiveMinutes(formData, `variantProcessingMinutes${index}`, 0),
      bufferBeforeMinutes: positiveMinutes(formData, `variantBufferBeforeMinutes${index}`, 0),
      bufferAfterMinutes: positiveMinutes(formData, `variantBufferAfterMinutes${index}`, 0),
      priceCents: fieldPriceCents(formData, `variantPrice${index}`),
      currency: fieldString(formData, `variantCurrency${index}`).toUpperCase() || "USD",
      active: true,
      clientVisible: !fieldBoolean(formData, `variantHidden${index}`),
      sortOrder: index,
    }
  }).filter(Boolean)

  if (variants.length === 0) {
    throw new Error("Add at least one service variant with a valid duration.")
  }

  return variants as Array<{
    id: string | null
    name: string
    durationMinutes: number
    processingMinutes: number
    bufferBeforeMinutes: number
    bufferAfterMinutes: number
    priceCents: number | null
    currency: string
    active: boolean
    clientVisible: boolean
    sortOrder: number
  }>
}

async function assertServiceCatalogLimits({
  practiceId,
  userId,
  variantCount,
  updatingServiceId,
}: {
  practiceId: string
  userId: string
  variantCount: number
  updatingServiceId?: string
}) {
  const entitlements = await getUserEntitlementState(prisma, userId)
  if (entitlements.hasFeature(FEATURE_KEYS.calendarFullScheduling)) return

  if (variantCount > FREE_CALENDAR_LIMITS.activeVariantsPerService) {
    throw new Error("Free calendars can keep up to three active variants per service.")
  }

  if (!updatingServiceId) {
    const activeServiceCount = await prisma.serviceType.count({
      where: { practiceId, active: true },
    })
    if (activeServiceCount >= FREE_CALENDAR_LIMITS.activeServices) {
      throw new Error("Free calendars can keep up to three active services.")
    }
  }
}

async function ensureCalendarResources(tx: Prisma.TransactionClient, practiceId: string, names: string[]) {
  const resources = []

  for (const name of names) {
    const existing = await tx.calendarResource.findFirst({
      where: { practiceId, name },
    })

    if (existing) {
      resources.push(existing)
    } else {
      resources.push(await tx.calendarResource.create({
        data: {
          practiceId,
          name,
        },
      }))
    }
  }

  return resources
}

async function writeCalendarAuditAndNotifications(
  tx: Prisma.TransactionClient,
  {
    practiceId,
    eventId,
    actorUserId,
    action,
    recipientUserIds,
    payload,
  }: {
    practiceId: string
    eventId: string
    actorUserId: string | null
    action: string
    recipientUserIds: string[]
    payload: Record<string, unknown>
  },
) {
  const safePayload = sanitizeCalendarAuditMetadata(payload)

  await tx.calendarAuditLog.create({
    data: {
      practiceId,
      eventId,
      actorUserId,
      action,
      metadata: safePayload as Prisma.InputJsonValue,
    },
  })

  const intents = buildCalendarNotificationIntents({
    eventId,
    actorUserId,
    action,
    recipientUserIds,
    payload: safePayload,
  })

  if (intents.length > 0) {
    await tx.calendarNotificationIntent.createMany({
      data: intents.map((intent) => ({
        eventId: intent.eventId,
        actorUserId: intent.actorUserId,
        recipientUserId: intent.recipientUserId,
        action: intent.action,
        channel: "INTERNAL" as const,
        deliveryStatus: "PENDING" as const,
        payload: intent.payload as Prisma.InputJsonValue,
      })) satisfies Prisma.CalendarNotificationIntentCreateManyInput[],
    })
  }
}

function revalidateCalendarRoutes(practiceSlug?: string, publicBookingPath?: string) {
  revalidatePath("/calendar")
  revalidatePath("/calendar/requests")
  revalidatePath("/calendar/availability")
  revalidatePath("/calendar/booking")
  revalidatePath("/book/[practiceSlug]", "page")
  revalidatePath("/book/[stateSlug]/[bookingSlug]", "page")
  if (practiceSlug) {
    revalidatePath(`/book/${practiceSlug}`)
  }
  if (publicBookingPath) {
    revalidatePath(publicBookingPath)
  }
}

function parseOptionalPositive(formData: FormData, key: string) {
  const value = fieldInteger(formData, key, 0)
  return value > 0 ? value : null
}

function validLatitude(value: string) {
  if (!value) return null
  const number = Number(value)
  return Number.isFinite(number) && number >= -90 && number <= 90 ? number : null
}

function validLongitude(value: string) {
  if (!value) return null
  const number = Number(value)
  return Number.isFinite(number) && number >= -180 && number <= 180 ? number : null
}

export async function saveBookingPolicyAction(formData: FormData) {
  const userId = await currentUserId()
  await assertCalendarDatabaseReady()
  const practiceId = fieldString(formData, "practiceId")
  const membership = await assertPracticeAccess(practiceId, userId, PRACTICE_SCHEDULING_ROLES)
  const approvalMode = fieldString(formData, "approvalMode") === "AUTO_CONFIRM" ? "AUTO_CONFIRM" : "MANUAL"
  const staffVisibility = fieldString(formData, "staffVisibility") === "HIDE_STAFF" ? "HIDE_STAFF" : "PUBLIC_LABELS"
  const practice = await getPracticeOrThrow(practiceId)

  if (!["OWNER", "STAFF"].includes(membership.role)) {
    throw new Error("Only owners and staff can manage practice-wide booking settings.")
  }

  await prisma.$transaction(async (tx) => {
    await tx.practice.update({
      where: { id: practiceId },
      data: {
        publicLocationLabel: fieldString(formData, "publicLocationLabel") || null,
        publicLatitude: validLatitude(fieldString(formData, "publicLatitude")),
        publicLongitude: validLongitude(fieldString(formData, "publicLongitude")),
      },
    })

    await tx.bookingPolicy.upsert({
      where: { practiceId },
      create: {
        practiceId,
        enabled: fieldBoolean(formData, "enabled"),
        approvalMode,
        minNoticeMinutes: Math.max(0, fieldInteger(formData, "minNoticeMinutes", 0)),
        maxAdvanceDays: Math.max(1, fieldInteger(formData, "maxAdvanceDays", 7)),
        dailyAppointmentLimit: parseOptionalPositive(formData, "dailyAppointmentLimit"),
        anyProviderEnabled: fieldBoolean(formData, "anyProviderEnabled"),
        teamSequencingEnabled: fieldBoolean(formData, "teamSequencingEnabled"),
        staffVisibility,
        dualTimezoneDisplay: fieldBoolean(formData, "dualTimezoneDisplay"),
        proximityNoticeEnabled: fieldBoolean(formData, "proximityNoticeEnabled"),
        proximityRadiusMiles: Math.max(1, fieldInteger(formData, "proximityRadiusMiles", 45)),
        requireClientAccount: fieldBoolean(formData, "requireClientAccount"),
      },
      update: {
        enabled: fieldBoolean(formData, "enabled"),
        approvalMode,
        minNoticeMinutes: Math.max(0, fieldInteger(formData, "minNoticeMinutes", 0)),
        maxAdvanceDays: Math.max(1, fieldInteger(formData, "maxAdvanceDays", 7)),
        dailyAppointmentLimit: parseOptionalPositive(formData, "dailyAppointmentLimit"),
        anyProviderEnabled: fieldBoolean(formData, "anyProviderEnabled"),
        teamSequencingEnabled: fieldBoolean(formData, "teamSequencingEnabled"),
        staffVisibility,
        dualTimezoneDisplay: fieldBoolean(formData, "dualTimezoneDisplay"),
        proximityNoticeEnabled: fieldBoolean(formData, "proximityNoticeEnabled"),
        proximityRadiusMiles: Math.max(1, fieldInteger(formData, "proximityRadiusMiles", 45)),
        requireClientAccount: fieldBoolean(formData, "requireClientAccount"),
      },
    })
  })

  revalidateCalendarRoutes(practice.slug, publicBookingPathForPractice(practice))
  redirect("/calendar/booking")
}

export async function savePublicBookingUrlAction(formData: FormData) {
  const userId = await currentUserId()
  await assertCalendarDatabaseReady()
  const practiceId = fieldString(formData, "practiceId")
  const membership = await assertPracticeAccess(practiceId, userId, STAFF_ROLES)
  const practice = await getPracticeOrThrow(practiceId)
  const therapistCount = await prisma.practiceMembership.count({
    where: {
      practiceId,
      role: { in: ["OWNER", "THERAPIST"] },
    },
  })
  const canManagePublicBookingUrl = ["OWNER", "STAFF"].includes(membership.role) || (
    membership.role === "THERAPIST" && therapistCount === 1
  )

  if (!canManagePublicBookingUrl) {
    throw new Error("Only owners and staff can manage public booking links.")
  }

  const requestedStateSlug = fieldString(formData, "publicBookingStateSlug")
  const requestedBookingSlug = fieldString(formData, "publicBookingSlug")
  const publicBookingStateSlug = normalizePublicBookingStateSlug(requestedStateSlug)
  const publicBookingSlug = normalizePublicBookingSlug(requestedBookingSlug)

  if (!requestedStateSlug && !requestedBookingSlug) {
    await prisma.practice.update({
      where: { id: practiceId },
      data: {
        publicBookingStateSlug: null,
        publicBookingSlug: null,
      },
    })
    revalidateCalendarRoutes(practice.slug, publicBookingPathForPractice(practice))
    redirect("/calendar/booking")
  }

  if (!publicBookingStateSlug) {
    throw new Error("Choose a state before saving a branded booking URL.")
  }
  if (!publicBookingSlug || publicBookingSlug.length < 3) {
    throw new Error("Choose a branded booking URL name with at least three letters or numbers.")
  }

  const existing = await prisma.practice.findFirst({
    where: {
      publicBookingStateSlug,
      publicBookingSlug,
      NOT: { id: practiceId },
    },
    select: { id: true },
  })
  if (existing) {
    throw new Error("That public booking URL is already in use in this state.")
  }

  await prisma.practice.update({
    where: { id: practiceId },
    data: {
      publicBookingStateSlug,
      publicBookingSlug,
    },
  })

  revalidateCalendarRoutes(practice.slug, `/book/${publicBookingStateSlug}/${publicBookingSlug}`)
  redirect("/calendar/booking")
}

export async function saveProviderBookingPolicyAction(formData: FormData) {
  const userId = await currentUserId()
  await assertCalendarDatabaseReady()
  const practiceId = fieldString(formData, "practiceId")
  const providerUserId = fieldString(formData, "providerUserId")
  const practice = await getPracticeOrThrow(practiceId)
  const membership = await assertPracticeAccess(practiceId, userId, STAFF_ROLES)
  assertCanManageTherapistSchedule(membership.role, userId, providerUserId)
  await assertPracticeTherapist(practiceId, providerUserId)

  await prisma.providerBookingPolicy.upsert({
    where: {
      practiceId_providerUserId: {
        practiceId,
        providerUserId,
      },
    },
    create: {
      practiceId,
      providerUserId,
      publiclyBookable: fieldBoolean(formData, "publiclyBookable"),
      displayLabel: fieldString(formData, "displayLabel") || null,
      minRestMinutes: Math.max(0, fieldInteger(formData, "minRestMinutes", 0)),
      dailyAppointmentLimit: parseOptionalPositive(formData, "dailyAppointmentLimit"),
      weeklyAppointmentLimit: parseOptionalPositive(formData, "weeklyAppointmentLimit"),
      requireClientAccount: fieldBoolean(formData, "requireClientAccount"),
    },
    update: {
      publiclyBookable: fieldBoolean(formData, "publiclyBookable"),
      displayLabel: fieldString(formData, "displayLabel") || null,
      minRestMinutes: Math.max(0, fieldInteger(formData, "minRestMinutes", 0)),
      dailyAppointmentLimit: parseOptionalPositive(formData, "dailyAppointmentLimit"),
      weeklyAppointmentLimit: parseOptionalPositive(formData, "weeklyAppointmentLimit"),
      requireClientAccount: fieldBoolean(formData, "requireClientAccount"),
    },
  })

  revalidateCalendarRoutes(practice.slug, publicBookingPathForPractice(practice))
  redirect("/calendar/booking")
}

export async function saveProviderCapacityRulesAction(formData: FormData) {
  const userId = await currentUserId()
  await assertCalendarDatabaseReady()
  const practiceId = fieldString(formData, "practiceId")
  const providerUserId = fieldString(formData, "providerUserId")
  const practice = await getPracticeOrThrow(practiceId)
  const membership = await assertPracticeAccess(practiceId, userId, STAFF_ROLES)
  assertCanManageTherapistSchedule(membership.role, userId, providerUserId)
  await assertPracticeTherapist(practiceId, providerUserId)

  const rows = Array.from({ length: 12 }, (_, index) => {
    const period = fieldString(formData, `capacityPeriod${index}`) === "WEEKLY" ? "WEEKLY" : "DAILY"
    const dayOfWeek = fieldInteger(formData, `capacityDayOfWeek${index}`, -1)
    const pressureLevel = fieldInteger(formData, `capacityPressureLevel${index}`, 0)
    const maxMinutes = fieldInteger(formData, `capacityMaxMinutes${index}`, 0)

    if (maxMinutes <= 0 || pressureLevel < 0 || pressureLevel > 5) {
      return null
    }

    return {
      practiceId,
      providerUserId,
      period,
      dayOfWeek: period === "DAILY" && dayOfWeek >= 0 && dayOfWeek <= 6 ? dayOfWeek : null,
      pressureLevel,
      maxMinutes,
      active: true,
    }
  }).filter(Boolean) as Prisma.ProviderBookingCapacityRuleCreateManyInput[]

  await prisma.$transaction(async (tx) => {
    await tx.providerBookingCapacityRule.deleteMany({
      where: { practiceId, providerUserId },
    })

    if (rows.length > 0) {
      await tx.providerBookingCapacityRule.createMany({ data: rows })
    }
  })

  revalidateCalendarRoutes(practice.slug, publicBookingPathForPractice(practice))
  redirect("/calendar/booking")
}

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

  const publicBookingPath = publicBookingPathForPractice(context.practice)
  revalidateCalendarRoutes(context.practice.slug, publicBookingPath)
  return publicBookingPath
}

export async function requestBookingSequenceAction(formData: FormData) {
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

export async function joinBookingWaitlistAction(formData: FormData) {
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

export async function convertWaitlistEntryAction(formData: FormData) {
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

function assertCanManageTherapistSchedule(role: string, userId: string, therapistId: string) {
  if (role === "THERAPIST" && userId !== therapistId) {
    throw new Error("Therapists can only manage their own schedule.")
  }
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
  const userId = await currentUserId()
  await assertCalendarDatabaseReady()
  const practiceId = fieldString(formData, "practiceId")
  const name = fieldString(formData, "name")
  const description = fieldString(formData, "description")
  const category = fieldString(formData, "category")
  const bookingRole = serviceBookingRole(formData)
  const countsTowardMassageCapacity = serviceCountsTowardCapacity(formData, bookingRole)
  const color = fieldString(formData, "color")
  const variants = parseServiceVariants(formData)
  const resourceNames = parseResourceNames(formData)
  const clinicalFields = sanitizeServiceClinicalTemplatePayload({
    modality: fieldString(formData, "modality"),
    bodyRegionFocus: parseBodyRegions(formData),
    documentationTemplateRefs: parseTemplateRefs(fieldString(formData, "documentationTemplateRefs")),
    intakeTemplateRefs: parseTemplateRefs(fieldString(formData, "intakeTemplateRefs")),
    contraindicationPrompts: parsePromptList(fieldString(formData, "contraindicationPrompts")),
  })
  const policyFields = sanitizeServicePolicyPayload({
    supplies: fieldString(formData, "supplies"),
    prepNotes: fieldString(formData, "prepNotes"),
    intakeRequirements: fieldString(formData, "intakeRequirements"),
    contraindicationNotice: fieldString(formData, "contraindicationNotice"),
    cancellationPolicy: fieldString(formData, "cancellationPolicy"),
    noShowPolicy: fieldString(formData, "noShowPolicy"),
    depositPolicy: fieldString(formData, "depositPolicy"),
    taxPolicy: fieldString(formData, "taxPolicy"),
    packagePolicy: fieldString(formData, "packagePolicy"),
  })

  await assertPracticeAccess(practiceId, userId, STAFF_ROLES)
  await assertServiceCatalogLimits({ practiceId, userId, variantCount: variants.length })

  if (!name) {
    throw new Error("Service name is required.")
  }

  const service = await prisma.$transaction(async (tx) => {
    const createdService = await tx.serviceType.create({
      data: {
        practiceId,
        name,
        description: description || null,
        category: category || null,
        color: color || null,
        durationMinutes: variants[0].durationMinutes,
        bufferMinutes: variants[0].bufferAfterMinutes,
        clientVisible: fieldBoolean(formData, "clientVisible"),
        bookingRole,
        countsTowardMassageCapacity,
        classEligible: fieldBoolean(formData, "classEligible"),
        supplies: String(policyFields.supplies ?? "") || null,
        prepNotes: fieldString(formData, "prepNotes") || null,
        intakeRequirements: String(policyFields.intakeRequirements ?? "") || null,
        contraindicationNotice: String(policyFields.contraindicationNotice ?? "") || null,
        modality: String(clinicalFields.modality ?? "") || null,
        bodyRegions: Array.isArray(clinicalFields.bodyRegionFocus) ? clinicalFields.bodyRegionFocus.map(String) : [],
        eligibleProviderIds: parseProviderEligibility(formData),
        documentationTemplateRefs: (clinicalFields.documentationTemplateRefs ?? []) as Prisma.InputJsonValue,
        intakeTemplateRefs: (clinicalFields.intakeTemplateRefs ?? []) as Prisma.InputJsonValue,
        contraindicationPrompts: (clinicalFields.contraindicationPrompts ?? []) as Prisma.InputJsonValue,
        cancellationPolicy: String(policyFields.cancellationPolicy ?? "") || null,
        noShowPolicy: String(policyFields.noShowPolicy ?? "") || null,
        depositPolicy: String(policyFields.depositPolicy ?? "") || null,
        taxPolicy: String(policyFields.taxPolicy ?? "") || null,
        packagePolicy: String(policyFields.packagePolicy ?? "") || null,
        active: !fieldBoolean(formData, "inactive"),
        variants: {
          create: variants.map((variant) => ({
            name: variant.name,
            durationMinutes: variant.durationMinutes,
            processingMinutes: variant.processingMinutes,
            bufferBeforeMinutes: variant.bufferBeforeMinutes,
            bufferAfterMinutes: variant.bufferAfterMinutes,
            priceCents: variant.priceCents,
            currency: variant.currency,
            active: variant.active,
            clientVisible: variant.clientVisible,
            sortOrder: variant.sortOrder,
          })),
        },
      },
      include: { variants: true },
    })

    const resources = await ensureCalendarResources(tx, practiceId, resourceNames)
    if (resources.length > 0) {
      await tx.serviceVariantResource.createMany({
        data: createdService.variants.flatMap((variant) => resources.map((resource) => ({
          serviceVariantId: variant.id,
          resourceId: resource.id,
        }))),
        skipDuplicates: true,
      })
    }

    return createdService
  })

  revalidatePath("/calendar")
  revalidatePath("/calendar/services")
  redirect(`/calendar/services/${service.id}`)
}

export async function updateServiceAction(formData: FormData) {
  const userId = await currentUserId()
  await assertCalendarDatabaseReady()
  const practiceId = fieldString(formData, "practiceId")
  const serviceId = fieldString(formData, "serviceId")
  const name = fieldString(formData, "name")
  const description = fieldString(formData, "description")
  const category = fieldString(formData, "category")
  const bookingRole = serviceBookingRole(formData)
  const countsTowardMassageCapacity = serviceCountsTowardCapacity(formData, bookingRole)
  const color = fieldString(formData, "color")
  const variants = parseServiceVariants(formData)
  const resourceNames = parseResourceNames(formData)
  const clinicalFields = sanitizeServiceClinicalTemplatePayload({
    modality: fieldString(formData, "modality"),
    bodyRegionFocus: parseBodyRegions(formData),
    documentationTemplateRefs: parseTemplateRefs(fieldString(formData, "documentationTemplateRefs")),
    intakeTemplateRefs: parseTemplateRefs(fieldString(formData, "intakeTemplateRefs")),
    contraindicationPrompts: parsePromptList(fieldString(formData, "contraindicationPrompts")),
  })
  const policyFields = sanitizeServicePolicyPayload({
    supplies: fieldString(formData, "supplies"),
    prepNotes: fieldString(formData, "prepNotes"),
    intakeRequirements: fieldString(formData, "intakeRequirements"),
    contraindicationNotice: fieldString(formData, "contraindicationNotice"),
    cancellationPolicy: fieldString(formData, "cancellationPolicy"),
    noShowPolicy: fieldString(formData, "noShowPolicy"),
    depositPolicy: fieldString(formData, "depositPolicy"),
    taxPolicy: fieldString(formData, "taxPolicy"),
    packagePolicy: fieldString(formData, "packagePolicy"),
  })

  await assertPracticeAccess(practiceId, userId, STAFF_ROLES)
  await assertServiceCatalogLimits({ practiceId, userId, variantCount: variants.length, updatingServiceId: serviceId })

  if (!serviceId || !name) {
    throw new Error("Service name is required.")
  }

  const existingService = await prisma.serviceType.findFirst({
    where: { id: serviceId, practiceId },
    select: { id: true },
  })

  if (!existingService) {
    throw new Error("Choose a valid service.")
  }

  await prisma.$transaction(async (tx) => {
    await tx.serviceType.update({
      where: { id: serviceId },
      data: {
        name,
        description: description || null,
        category: category || null,
        color: color || null,
        durationMinutes: variants[0].durationMinutes,
        bufferMinutes: variants[0].bufferAfterMinutes,
        clientVisible: fieldBoolean(formData, "clientVisible"),
        bookingRole,
        countsTowardMassageCapacity,
        classEligible: fieldBoolean(formData, "classEligible"),
        supplies: String(policyFields.supplies ?? "") || null,
        prepNotes: fieldString(formData, "prepNotes") || null,
        intakeRequirements: String(policyFields.intakeRequirements ?? "") || null,
        contraindicationNotice: String(policyFields.contraindicationNotice ?? "") || null,
        modality: String(clinicalFields.modality ?? "") || null,
        bodyRegions: Array.isArray(clinicalFields.bodyRegionFocus) ? clinicalFields.bodyRegionFocus.map(String) : [],
        eligibleProviderIds: parseProviderEligibility(formData),
        documentationTemplateRefs: (clinicalFields.documentationTemplateRefs ?? []) as Prisma.InputJsonValue,
        intakeTemplateRefs: (clinicalFields.intakeTemplateRefs ?? []) as Prisma.InputJsonValue,
        contraindicationPrompts: (clinicalFields.contraindicationPrompts ?? []) as Prisma.InputJsonValue,
        cancellationPolicy: String(policyFields.cancellationPolicy ?? "") || null,
        noShowPolicy: String(policyFields.noShowPolicy ?? "") || null,
        depositPolicy: String(policyFields.depositPolicy ?? "") || null,
        taxPolicy: String(policyFields.taxPolicy ?? "") || null,
        packagePolicy: String(policyFields.packagePolicy ?? "") || null,
        active: !fieldBoolean(formData, "inactive"),
      },
    })

    await tx.serviceVariant.deleteMany({
      where: {
        serviceTypeId: serviceId,
        id: { notIn: variants.map((variant) => variant.id).filter(Boolean) as string[] },
      },
    })

    const savedVariants = []
    for (const variant of variants) {
      if (variant.id) {
        const existingVariant = await tx.serviceVariant.findFirst({
          where: { id: variant.id, serviceTypeId: serviceId },
          select: { id: true },
        })
        if (!existingVariant) {
          throw new Error("Choose a valid service variant.")
        }
        savedVariants.push(await tx.serviceVariant.update({
          where: { id: variant.id },
          data: {
            name: variant.name,
            durationMinutes: variant.durationMinutes,
            processingMinutes: variant.processingMinutes,
            bufferBeforeMinutes: variant.bufferBeforeMinutes,
            bufferAfterMinutes: variant.bufferAfterMinutes,
            priceCents: variant.priceCents,
            currency: variant.currency,
            active: variant.active,
            clientVisible: variant.clientVisible,
            sortOrder: variant.sortOrder,
          },
        }))
      } else {
        savedVariants.push(await tx.serviceVariant.create({
          data: {
            serviceTypeId: serviceId,
            name: variant.name,
            durationMinutes: variant.durationMinutes,
            processingMinutes: variant.processingMinutes,
            bufferBeforeMinutes: variant.bufferBeforeMinutes,
            bufferAfterMinutes: variant.bufferAfterMinutes,
            priceCents: variant.priceCents,
            currency: variant.currency,
            active: variant.active,
            clientVisible: variant.clientVisible,
            sortOrder: variant.sortOrder,
          },
        }))
      }
    }

    await tx.serviceVariantResource.deleteMany({
      where: { serviceVariant: { serviceTypeId: serviceId } },
    })

    const resources = await ensureCalendarResources(tx, practiceId, resourceNames)
    if (resources.length > 0) {
      await tx.serviceVariantResource.createMany({
        data: savedVariants.flatMap((variant) => resources.map((resource) => ({
          serviceVariantId: variant.id,
          resourceId: resource.id,
        }))),
        skipDuplicates: true,
      })
    }
  })

  revalidatePath("/calendar")
  revalidatePath("/calendar/services")
  revalidatePath(`/calendar/services/${serviceId}`)
  redirect(`/calendar/services/${serviceId}`)
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

export async function createAppointmentAction(formData: FormData) {
  const redirectTo = await createAppointmentMutation(formData)
  redirect(redirectTo)
}

export async function createAppointmentFormAction(
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

export async function createPersonalEventAction(formData: FormData) {
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

export async function createCalendarBlockAction(formData: FormData) {
  await createPersonalEventAction(formData)
}

export async function createClassAction(formData: FormData) {
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

export async function createReminderAction(formData: FormData) {
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

export async function requestAppointmentAction(formData: FormData) {
  const userId = await currentUserId()
  await assertCalendarDatabaseReady()
  const practiceId = fieldString(formData, "practiceId")
  const therapistId = fieldString(formData, "therapistId")
  const serviceVariantId = fieldString(formData, "serviceVariantId")
  const serviceTypeId = fieldString(formData, "serviceTypeId")
  const startsAt = localDateTime(fieldString(formData, "startsAt"))

  if (!practiceId || !therapistId || (!serviceVariantId && !serviceTypeId) || !startsAt) {
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

export async function updateAppointmentRequestStatusAction(formData: FormData) {
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
