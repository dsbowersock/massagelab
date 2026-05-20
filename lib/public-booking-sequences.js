import { createAsyncKeyedTtlCache } from "./async-ttl-cache.js"
import { buildSequentialBookingOptions, normalizeBookingPolicy, normalizePressureLevel } from "./booking-policy.js"
import { buildAvailabilitySlots, isoDate } from "./calendar.js"
import { calendarDateParts, resolveAvailabilityForDate } from "./calendar-availability.js"
import { serviceVariantBookableMinutes } from "./service-catalog.js"
import { MAX_PUBLIC_ADD_ONS, PUBLIC_SEQUENCE_PICKER_MAX_OPTIONS } from "./public-booking-constants.js"

export { MAX_PUBLIC_ADD_ONS, PUBLIC_SEQUENCE_PICKER_MAX_OPTIONS }

const ACTIVE_EVENT_STATUSES = ["REQUESTED", "CONFIRMED", "ACTIVE"]
const PUBLIC_SEQUENCE_OPTIONS_CACHE_TTL_MS = 20_000

/**
 * @typedef {{
 *   primaryServiceVariantId: string
 *   addOnServiceVariantIds: string[]
 *   requestedPressureLevel: number
 *   preferredProviderId: string
 * }} PublicBookingSequenceDescriptor
 */

/**
 * @param {unknown} value
 */
function cleanString(value) {
  return typeof value === "string" ? value.trim() : ""
}

/**
 * @param {unknown} value
 */
function stringArray(value) {
  if (Array.isArray(value)) {
    return value.map(cleanString).filter(Boolean)
  }

  if (typeof value === "string") {
    return value.split(",").map((item) => item.trim()).filter(Boolean)
  }

  return []
}

/**
 * @param {unknown} input
 * @returns {PublicBookingSequenceDescriptor}
 */
export function normalizePublicBookingSequenceDescriptor(input) {
  const payload = input && typeof input === "object" ? /** @type {Record<string, unknown>} */ (input) : {}
  const primaryServiceVariantId = cleanString(payload.primaryServiceVariantId)
  const requestedPressureLevel = normalizePressureLevel(payload.requestedPressureLevel)

  if (!primaryServiceVariantId) {
    throw new Error("Choose a primary service before loading appointment times.")
  }
  if (!requestedPressureLevel) {
    throw new Error("Choose a pressure preference from 1 to 5.")
  }

  return {
    primaryServiceVariantId,
    addOnServiceVariantIds: [...new Set(stringArray(payload.addOnServiceVariantIds))].slice(0, MAX_PUBLIC_ADD_ONS),
    requestedPressureLevel,
    preferredProviderId: cleanString(payload.preferredProviderId),
  }
}

/**
 * @param {unknown} value
 * @returns {string}
 */
function stableStringify(value) {
  if (value instanceof Date) {
    return JSON.stringify(value.toISOString())
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`
  }
  if (value && typeof value === "object") {
    const record = /** @type {Record<string, unknown>} */ (value)
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`
  }

  return JSON.stringify(value)
}

/**
 * @param {{
 *   practiceId: string
 *   primaryServiceVariantId: string
 *   addOnServiceVariantIds: string[]
 *   requestedPressureLevel: number
 *   preferredProviderId?: string | null
 *   maxOptions?: number
 *   accountMode?: string
 *   policySignature: string
 *   serviceSignature: string
 *   providerSignature: string
 *   schedulingSignature?: string
 * }} input
 */
export function buildPublicBookingSequenceCacheKey(input) {
  return stableStringify({
    version: 1,
    practiceId: input.practiceId,
    primaryServiceVariantId: input.primaryServiceVariantId,
    addOnServiceVariantIds: input.addOnServiceVariantIds,
    requestedPressureLevel: input.requestedPressureLevel,
    preferredProviderId: input.preferredProviderId || "",
    maxOptions: input.maxOptions ?? 12,
    accountMode: input.accountMode || "guest",
    policySignature: input.policySignature,
    serviceSignature: input.serviceSignature,
    providerSignature: input.providerSignature,
    schedulingSignature: input.schedulingSignature || "",
  })
}

async function getPrismaClient() {
  const prismaModule = await import("@/lib/prisma")
  return prismaModule.prisma
}

/**
 * @param {number} count
 * @param {string} timeZone
 * @param {Date} now
 */
function nextBookingDates(count, timeZone = "UTC", now = new Date()) {
  const localStartDate = calendarDateParts(now, timeZone).date
  const start = new Date(`${localStartDate}T00:00:00.000Z`)

  return Array.from({ length: Math.max(1, count) }, (_, index) => {
    const date = new Date(start)
    date.setUTCDate(start.getUTCDate() + index)
    return isoDate(date)
  })
}

/**
 * @param {{ resourceRequirements?: Array<{ resourceId?: string, resource?: { active?: boolean | null } | null }> }} variant
 */
function serviceResourceIds(variant) {
  return (variant.resourceRequirements ?? [])
    .filter((requirement) => requirement.resource?.active)
    .map((requirement) => String(requirement.resourceId ?? ""))
    .filter(Boolean)
}

/**
 * @param {{
 *   practiceId: string
 *   primaryServiceVariantId: string
 *   addOnServiceVariantIds?: string[]
 *   requestedPressureLevel: number
 *   preferredProviderId?: string
 *   viewerUserId?: string | null
 *   now?: Date
 *   maxOptions?: number
 *   db?: any
 * }} input
 */
export async function publicBookingSequenceOptions(input) {
  const db = input.db ?? await getPrismaClient()
  const descriptor = normalizePublicBookingSequenceDescriptor(input)
  const practiceId = cleanString(input.practiceId)
  const viewerUserId = cleanString(input.viewerUserId)
  const accountMode = viewerUserId ? "signed-in" : "guest"
  const now = input.now ?? new Date()
  const maxOptions = input.maxOptions ?? 12

  if (!practiceId) {
    throw new Error("Choose a valid practice calendar.")
  }

  const practice = await db.practice.findUnique({
    where: { id: practiceId },
    include: {
      bookingPolicy: true,
      memberships: {
        where: { role: { in: ["OWNER", "THERAPIST"] } },
        include: { user: { select: { name: true, email: true } } },
        orderBy: { createdAt: "asc" },
      },
      providerBookingPolicies: true,
    },
  })

  if (!practice) {
    throw new Error("Choose a valid practice calendar.")
  }

  const policy = normalizeBookingPolicy(practice.bookingPolicy)
  const allowGuestBooking = Boolean(viewerUserId) || !policy.requireClientAccount
  if (!policy.enabled) {
    return { practice, policy, variants: [], selections: [], providers: [], options: [], allowGuestBooking, accountMode }
  }
  if (!allowGuestBooking) {
    return { practice, policy, variants: [], selections: [], providers: [], options: [], allowGuestBooking, accountMode }
  }

  const variantIds = [...new Set([descriptor.primaryServiceVariantId, ...descriptor.addOnServiceVariantIds].filter(Boolean))]
    .slice(0, 1 + MAX_PUBLIC_ADD_ONS)
  const variants = await db.serviceVariant.findMany({
    where: {
      id: { in: variantIds },
      active: true,
      clientVisible: true,
      serviceType: {
        practiceId,
        active: true,
        clientVisible: true,
      },
    },
    include: {
      serviceType: true,
      resourceRequirements: {
        include: { resource: true },
      },
    },
  })
  const variantById = new Map(variants.map((variant) => [variant.id, variant]))
  const orderedVariants = variantIds.map((id) => variantById.get(id)).filter(Boolean)
  if (orderedVariants.length !== variantIds.length || orderedVariants.length === 0) {
    throw new Error("Choose available booking services.")
  }

  const primary = orderedVariants[0]
  if (primary.serviceType.bookingRole !== "PRIMARY") {
    throw new Error("Choose a primary service before add-ons.")
  }
  if (orderedVariants.slice(1).some((variant) => variant.serviceType.bookingRole !== "ADD_ON")) {
    throw new Error("Only add-on services can be added after the primary service.")
  }

  const providerPolicyByUserId = new Map(practice.providerBookingPolicies.map((policyRow) => [policyRow.providerUserId, policyRow]))
  const showStaffLabels = policy.staffVisibility === "PUBLIC_LABELS"
  const providers = practice.memberships.map((membership) => {
    const providerPolicy = providerPolicyByUserId.get(membership.userId)
    const fallbackLabel = membership.user.name ?? membership.user.email ?? "Provider"
    return {
      userId: membership.userId,
      label: showStaffLabels ? (providerPolicy?.displayLabel || fallbackLabel) : "Available provider",
      publiclyBookable: providerPolicy?.publiclyBookable ?? true,
      minRestMinutes: providerPolicy?.minRestMinutes ?? 0,
      dailyAppointmentLimit: providerPolicy?.dailyAppointmentLimit ?? null,
      weeklyAppointmentLimit: providerPolicy?.weeklyAppointmentLimit ?? null,
      requireClientAccount: providerPolicy?.requireClientAccount ?? false,
    }
  }).filter((provider) => accountMode === "signed-in" || !provider.requireClientAccount)

  const [rules, schedules, overrides, blockingEvents, resourceBookings, capacityRules, existingAppointments] = await Promise.all([
    db.therapistAvailabilityRule.findMany({
      where: { practiceId, active: true },
    }),
    db.calendarAvailabilitySchedule.findMany({
      where: { practiceId, active: true },
      include: { intervals: true },
      orderBy: [{ effectiveFrom: "asc" }, { createdAt: "asc" }],
    }),
    db.calendarAvailabilityOverride.findMany({
      where: { practiceId },
      include: { intervals: true },
      orderBy: { createdAt: "asc" },
    }),
    db.calendarEvent.findMany({
      where: {
        practiceId,
        blocksAvailability: true,
        status: { in: ACTIVE_EVENT_STATUSES },
        endsAt: { gte: now },
      },
      select: { ownerUserId: true, startsAt: true, endsAt: true },
    }),
    db.calendarResourceBooking.findMany({
      where: {
        resource: { practiceId },
        endsAt: { gte: now },
        event: {
          blocksAvailability: true,
          status: { in: ACTIVE_EVENT_STATUSES },
        },
      },
      select: { resourceId: true, startsAt: true, endsAt: true },
    }),
    db.providerBookingCapacityRule.findMany({
      where: { practiceId, active: true },
    }),
    db.appointment.findMany({
      where: {
        practiceId,
        status: { in: ["REQUESTED", "CONFIRMED"] },
        endsAt: { gte: now },
      },
      select: {
        therapistId: true,
        startsAt: true,
        endsAt: true,
        status: true,
        requestedPressureLevel: true,
        massageCapacityMinutes: true,
      },
    }),
  ])

  const dates = nextBookingDates(policy.maxAdvanceDays, practice.timezone, now)
  const cutoff = new Date(now.getTime() + policy.minNoticeMinutes * 60_000)
  /** @type {Record<string, Array<{ startsAt: Date }>>} */
  const slotsByVariantAndProvider = {}

  for (const variant of orderedVariants) {
    const variantResourceIds = serviceResourceIds(variant)
    const variantResourceBlocks = resourceBookings.filter((booking) => variantResourceIds.includes(booking.resourceId))
    const eligibleProviders = providers.filter((provider) => (
      provider.publiclyBookable &&
      (variant.serviceType.eligibleProviderIds.length === 0 || variant.serviceType.eligibleProviderIds.includes(provider.userId))
    ))

    for (const provider of eligibleProviders) {
      const therapistRules = rules.filter((rule) => rule.therapistId === provider.userId)
      const therapistSchedules = schedules
        .filter((schedule) => schedule.therapistId === provider.userId)
        .map((schedule) => ({
          active: schedule.active,
          effectiveFrom: schedule.effectiveFrom,
          effectiveTo: schedule.effectiveTo,
          intervals: schedule.intervals,
        }))
      const therapistOverrides = overrides
        .filter((override) => override.therapistId === provider.userId)
        .map((override) => ({
          date: override.date,
          kind: override.kind,
          intervals: override.intervals,
        }))
      const therapistBlocks = blockingEvents.filter((event) => event.ownerUserId === provider.userId)
      const slots = dates.flatMap((date) => {
        const resolvedAvailability = resolveAvailabilityForDate({
          date,
          weeklyRules: therapistRules,
          schedules: therapistSchedules,
          overrides: therapistOverrides,
        })
        const dayOfWeek = new Date(`${date}T00:00:00.000Z`).getUTCDay()
        return buildAvailabilitySlots({
          date,
          serviceDurationMinutes: serviceVariantBookableMinutes(variant),
          now: cutoff,
          rules: resolvedAvailability.intervals.map((interval) => ({
            dayOfWeek,
            startMinute: interval.startMinute,
            endMinute: interval.endMinute,
            active: true,
          })),
          blocks: [...therapistBlocks, ...variantResourceBlocks],
          appointments: [],
          timeZone: practice.timezone,
        })
      })

      slotsByVariantAndProvider[`${variant.id}:${provider.userId}`] = slots
    }
  }

  const selections = orderedVariants.map((variant) => ({
    serviceVariantId: variant.id,
    serviceName: variant.serviceType.name,
    serviceVariantName: variant.name,
    bookingRole: variant.serviceType.bookingRole,
    bookableMinutes: serviceVariantBookableMinutes(variant),
    durationMinutes: variant.durationMinutes,
    massageCapacityMinutes: variant.serviceType.countsTowardMassageCapacity ? variant.durationMinutes : 0,
    countsTowardMassageCapacity: variant.serviceType.countsTowardMassageCapacity,
    eligibleProviderIds: variant.serviceType.eligibleProviderIds,
  }))

  const options = buildSequentialBookingOptions({
    practiceId,
    timeZone: practice.timezone,
    pressureLevel: descriptor.requestedPressureLevel,
    policy,
    providers,
    selections,
    slotsByVariantAndProvider,
    capacityRules,
    existingBookings: existingAppointments.map((appointment) => ({
      providerUserId: appointment.therapistId,
      startsAt: appointment.startsAt,
      endsAt: appointment.endsAt,
      status: appointment.status,
      requestedPressureLevel: appointment.requestedPressureLevel,
      massageCapacityMinutes: appointment.massageCapacityMinutes,
    })),
    preferredProviderId: descriptor.preferredProviderId || null,
    maxOptions,
  })

  return { practice, policy, variants: orderedVariants, selections, providers, options, allowGuestBooking, accountMode }
}

/**
 * @param {{
 *   db: any
 *   practiceId: string
 *   primaryServiceVariantId: string
 *   addOnServiceVariantIds: string[]
 *   accountMode?: string
 * }} input
 */
async function publicBookingSequenceInputSignature({
  db,
  practiceId,
  primaryServiceVariantId,
  addOnServiceVariantIds,
  accountMode = "guest",
}) {
  const variantIds = [...new Set([primaryServiceVariantId, ...addOnServiceVariantIds].filter(Boolean))]
    .slice(0, 1 + MAX_PUBLIC_ADD_ONS)
  const [practice, variants, memberships, providerPolicies, capacityRules, availabilityRules, schedules, overrides] = await Promise.all([
    db.practice.findUnique({
      where: { id: practiceId },
      select: {
        id: true,
        timezone: true,
        updatedAt: true,
        bookingPolicy: true,
      },
    }),
    db.serviceVariant.findMany({
      where: { id: { in: variantIds } },
      select: {
        id: true,
        active: true,
        clientVisible: true,
        durationMinutes: true,
        processingMinutes: true,
        bufferBeforeMinutes: true,
        bufferAfterMinutes: true,
        sortOrder: true,
        updatedAt: true,
        serviceType: {
          select: {
            id: true,
            active: true,
            clientVisible: true,
            bookingRole: true,
            countsTowardMassageCapacity: true,
            eligibleProviderIds: true,
            updatedAt: true,
          },
        },
        resourceRequirements: {
          select: {
            resourceId: true,
            resource: { select: { active: true, updatedAt: true } },
          },
          orderBy: { resourceId: "asc" },
        },
      },
    }),
    db.practiceMembership.findMany({
      where: { practiceId, role: { in: ["OWNER", "THERAPIST"] } },
      select: {
        userId: true,
        role: true,
        updatedAt: true,
        user: { select: { name: true, email: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.providerBookingPolicy.findMany({
      where: { practiceId },
      select: {
        providerUserId: true,
        publiclyBookable: true,
        displayLabel: true,
        minRestMinutes: true,
        dailyAppointmentLimit: true,
        weeklyAppointmentLimit: true,
        requireClientAccount: true,
        updatedAt: true,
      },
      orderBy: { providerUserId: "asc" },
    }),
    db.providerBookingCapacityRule.findMany({
      where: { practiceId, active: true },
      select: {
        providerUserId: true,
        period: true,
        dayOfWeek: true,
        pressureLevel: true,
        maxMinutes: true,
        updatedAt: true,
      },
      orderBy: [{ providerUserId: "asc" }, { period: "asc" }, { pressureLevel: "asc" }, { dayOfWeek: "asc" }],
    }),
    db.therapistAvailabilityRule.findMany({
      where: { practiceId, active: true },
      select: {
        therapistId: true,
        dayOfWeek: true,
        startMinute: true,
        endMinute: true,
        updatedAt: true,
      },
      orderBy: [{ therapistId: "asc" }, { dayOfWeek: "asc" }, { startMinute: "asc" }],
    }),
    db.calendarAvailabilitySchedule.findMany({
      where: { practiceId, active: true },
      select: {
        therapistId: true,
        effectiveFrom: true,
        effectiveTo: true,
        updatedAt: true,
        intervals: {
          select: { dayOfWeek: true, startMinute: true, endMinute: true, active: true, createdAt: true },
          orderBy: [{ dayOfWeek: "asc" }, { startMinute: "asc" }],
        },
      },
      orderBy: [{ therapistId: "asc" }, { effectiveFrom: "asc" }, { createdAt: "asc" }],
    }),
    db.calendarAvailabilityOverride.findMany({
      where: { practiceId },
      select: {
        therapistId: true,
        date: true,
        kind: true,
        updatedAt: true,
        intervals: {
          select: { startMinute: true, endMinute: true, active: true, createdAt: true },
          orderBy: { startMinute: "asc" },
        },
      },
      orderBy: [{ therapistId: "asc" }, { date: "asc" }],
    }),
  ])

  const variantOrder = new Map(variantIds.map((id, index) => [id, index]))
  const orderedVariants = variants.sort((a, b) => (variantOrder.get(a.id) ?? 0) - (variantOrder.get(b.id) ?? 0))

  return {
    policySignature: stableStringify({
      practice,
      capacityRules,
      accountMode,
    }),
    serviceSignature: stableStringify(orderedVariants),
    providerSignature: stableStringify({
      memberships,
      providerPolicies,
    }),
    schedulingSignature: stableStringify({
      availabilityRules,
      schedules,
      overrides,
    }),
  }
}

const publicBookingSequenceOptionsCache = createAsyncKeyedTtlCache({
  ttlMs: PUBLIC_SEQUENCE_OPTIONS_CACHE_TTL_MS,
  maxSize: 250,
  load: async (key) => {
    const payload = JSON.parse(key)
    return publicBookingSequenceOptions({
      practiceId: payload.practiceId,
      primaryServiceVariantId: payload.primaryServiceVariantId,
      addOnServiceVariantIds: payload.addOnServiceVariantIds,
      requestedPressureLevel: payload.requestedPressureLevel,
      preferredProviderId: payload.preferredProviderId,
      viewerUserId: payload.accountMode === "signed-in" ? "__signed_in__" : "",
      maxOptions: payload.maxOptions,
    })
  },
})

/**
 * @param {{
 *   practiceId: string
 *   primaryServiceVariantId: string
 *   addOnServiceVariantIds?: string[]
 *   requestedPressureLevel: number
 *   preferredProviderId?: string
 *   viewerUserId?: string | null
 *   maxOptions?: number
 * }} input
 */
export async function cachedPublicBookingSequenceOptions(input) {
  const db = await getPrismaClient()
  const descriptor = normalizePublicBookingSequenceDescriptor(input)
  const practiceId = cleanString(input.practiceId)
  const viewerUserId = cleanString(input.viewerUserId)
  const accountMode = viewerUserId ? "signed-in" : "guest"
  const maxOptions = input.maxOptions ?? 12
  const signatures = await publicBookingSequenceInputSignature({
    db,
    practiceId,
    primaryServiceVariantId: descriptor.primaryServiceVariantId,
    addOnServiceVariantIds: descriptor.addOnServiceVariantIds,
    accountMode,
  })
  const key = buildPublicBookingSequenceCacheKey({
    practiceId,
    ...descriptor,
    maxOptions,
    accountMode,
    ...signatures,
  })

  return publicBookingSequenceOptionsCache.get(key)
}

export function clearPublicBookingSequenceOptionsCache() {
  publicBookingSequenceOptionsCache.clear()
}
