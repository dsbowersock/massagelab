import "server-only"

import { headers } from "next/headers"
import { redirect } from "next/navigation"
import { Prisma } from "@prisma/client"
import { getCurrentSession } from "@/auth"
import { authRequestNetworkIdentifier } from "@/lib/auth-request"
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
import { runCommerceTransaction } from "@/lib/commerce/transactions"
import { consumeOperationalRateLimitInTransaction } from "@/lib/operational-rate-limit"
import { prisma } from "@/lib/prisma"
import {
  acquirePublicRequestLock,
  findPublicBookingRequest,
  findPublicWaitlistRequest,
  hasExactPublicRequestSelection,
  publicBookingRequestOwner,
  type PublicBookingRequestSelection,
  publicWaitlistRequestOwner,
  type PublicWaitlistRequestSelection,
} from "@/lib/public-booking-idempotency"
import { PUBLIC_SEQUENCE_PICKER_MAX_OPTIONS, publicBookingSequenceOptions } from "@/lib/public-booking-sequences"
import { publicBookingPathForPractice } from "@/lib/public-booking-url"
import { normalizePublicRequestId } from "@/lib/public-request-id"
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
import {
  publicBookingConflict,
  publicBookingRateLimited,
  publicBookingSuccess,
  publicBookingUnavailable,
  publicBookingValidationError,
  type PublicBookingActionState,
} from "./public-booking-state"

type BookingClientIdentity = {
  userId: string | null
  guestName?: string
  guestEmail?: string
  guestPhone?: string
  practiceClientId?: string
}

type PublicBookingOwner = ReturnType<typeof publicBookingRequestOwner>
type ExistingPublicBookingRequest = Awaited<ReturnType<typeof findPublicBookingRequest>>
type PublicWaitlistOwner = ReturnType<typeof publicWaitlistRequestOwner>
type ExistingPublicWaitlistRequest = Awaited<ReturnType<typeof findPublicWaitlistRequest>>

type PreparedPublicBookingRequest = {
  userId: string | null
  clientIdentity: BookingClientIdentity
  practiceId: string
  primaryServiceVariantId: string
  addOnServiceVariantIds: string[]
  requestedPressureLevel: number
  startsAt: Date
  preferredProviderId: string
  selection: PublicBookingRequestSelection
  owner: PublicBookingOwner
  limiterOwner:
    | { kind: "ACCOUNT_ID"; value: string }
    | { kind: "GUEST_EMAIL"; value: string }
}

type PreparedPublicWaitlistRequest = {
  userId: string | null
  clientIdentity: BookingClientIdentity
  practiceId: string
  primaryServiceVariantId: string
  addOnServiceVariantIds: string[]
  requestedPressureLevel: number
  preferredProviderId: string
  preferredStartsAt: Date | null
  selection: PublicWaitlistRequestSelection
  owner: PublicWaitlistOwner
  limiterOwner:
    | { kind: "ACCOUNT_ID"; value: string }
    | { kind: "GUEST_EMAIL"; value: string }
}

type PublicBookingReplayDecision = "MISS" | "REPLAY" | "CONFLICT"

class PublicBookingConflictError extends Error {
  constructor() {
    super("Public booking request conflicts with an existing request.")
    this.name = "PublicBookingConflictError"
  }
}

function boundedPublicBookingIdentifier(value: string): boolean {
  return value.length > 0 && value.length <= 191 && !/[\r\n]/.test(value)
}

function publicBookingIdentityIsBounded(identity: BookingClientIdentity): boolean {
  if (identity.userId) return boundedPublicBookingIdentifier(identity.userId)
  return Boolean(
    identity.guestName
    && identity.guestName.length <= 191
    && !/[\r\n]/.test(identity.guestName)
    && identity.guestEmail
    && identity.guestEmail.length <= 254
    && identity.guestPhone
    && identity.guestPhone.length <= 191
    && !/[\r\n]/.test(identity.guestPhone),
  )
}

/**
 * Canonicalizes only the bounded, non-identifying selection used by the
 * durable booking owner. Contact and account identity remain separate inputs.
 */
function preparePublicBookingRequest(formData: FormData, userId: string | null): PreparedPublicBookingRequest {
  const requestId = normalizePublicRequestId(formData.get("requestId"))
  const practiceId = fieldString(formData, "practiceId")
  const primaryServiceVariantId = fieldString(formData, "primaryServiceVariantId")
  const addOnServiceVariantIds = selectedAddOnVariantIds(formData)
  const requestedPressureLevel = normalizePressureLevel(fieldString(formData, "requestedPressureLevel"))
  const startsAtValue = fieldString(formData, "startsAt")
  const preferredProviderId = fieldString(formData, "preferredProviderId")

  if (!requestId
    || !boundedPublicBookingIdentifier(practiceId)
    || !requestedPressureLevel
    || !startsAtValue) {
    throw new Error("Provide a valid public booking request.")
  }

  const startsAt = dateValue(startsAtValue)
  const clientIdentity = publicBookingClientIdentity(formData, userId)
  if (!publicBookingIdentityIsBounded(clientIdentity)) {
    throw new Error("Provide bounded public booking identity fields.")
  }

  const selection: PublicBookingRequestSelection = {
    requestId,
    primaryServiceVariantId,
    addOnServiceVariantIds,
    requestedPressureLevel,
    requestedStartsAt: startsAt.toISOString(),
    preferredProviderId,
  }
  const owner = publicBookingRequestOwner(selection)
  return {
    userId,
    clientIdentity,
    practiceId,
    primaryServiceVariantId,
    addOnServiceVariantIds,
    requestedPressureLevel,
    startsAt,
    preferredProviderId,
    selection,
    owner,
    limiterOwner: userId
      ? { kind: "ACCOUNT_ID", value: userId }
      : { kind: "GUEST_EMAIL", value: clientIdentity.guestEmail ?? "" },
  }
}

/** Canonicalizes the immutable waitlist selection separately from caller identity. */
function preparePublicWaitlistRequest(
  formData: FormData,
  userId: string | null,
): PreparedPublicWaitlistRequest {
  const requestId = normalizePublicRequestId(formData.get("requestId"))
  const practiceId = fieldString(formData, "practiceId")
  const primaryServiceVariantId = fieldString(formData, "primaryServiceVariantId")
  const addOnServiceVariantIds = selectedAddOnVariantIds(formData)
  const requestedPressureLevel = normalizePressureLevel(fieldString(formData, "requestedPressureLevel"))
  const preferredProviderId = fieldString(formData, "preferredProviderId")
  const preferredStartsAtInput = formData.get("preferredStartsAt")
  const preferredStartsAtValue = preferredStartsAtInput === null ? "" : preferredStartsAtInput

  if (!requestId || !boundedPublicBookingIdentifier(practiceId) || !requestedPressureLevel) {
    throw new Error("Provide a valid public waitlist request.")
  }
  if (typeof preferredStartsAtValue !== "string") {
    throw new Error("Provide a canonical preferred waitlist start.")
  }

  let preferredStartsAt: Date | null = null
  if (preferredStartsAtValue) {
    preferredStartsAt = dateValue(preferredStartsAtValue)
    if (preferredStartsAt.toISOString() !== preferredStartsAtValue) {
      throw new Error("Provide a canonical preferred waitlist start.")
    }
  }

  const clientIdentity = publicBookingClientIdentity(formData, userId)
  if (!publicBookingIdentityIsBounded(clientIdentity)) {
    throw new Error("Provide bounded public booking identity fields.")
  }

  const selection: PublicWaitlistRequestSelection = {
    requestId,
    primaryServiceVariantId,
    addOnServiceVariantIds,
    requestedPressureLevel,
    preferredStartsAt: preferredStartsAtValue,
    preferredProviderId,
  }
  const owner = publicWaitlistRequestOwner(selection)
  return {
    userId,
    clientIdentity,
    practiceId,
    primaryServiceVariantId,
    addOnServiceVariantIds,
    requestedPressureLevel,
    preferredProviderId,
    preferredStartsAt,
    selection,
    owner,
    limiterOwner: userId
      ? { kind: "ACCOUNT_ID", value: userId }
      : { kind: "GUEST_EMAIL", value: clientIdentity.guestEmail ?? "" },
  }
}

function publicBookingCallerOwnsExistingRequest(
  existing: NonNullable<ExistingPublicBookingRequest>,
  prepared: PreparedPublicBookingRequest,
): boolean {
  if (prepared.userId) {
    return existing.createdById === prepared.userId
      && existing.practiceClient?.userId === prepared.userId
  }
  return existing.createdById === null
    && existing.practiceClient?.userId === null
    && normalizeEmail(existing.practiceClient?.email) === prepared.clientIdentity.guestEmail
}

function publicBookingPersistedSelectionMatches(
  existing: NonNullable<ExistingPublicBookingRequest>,
  selection: PublicBookingRequestSelection,
): boolean {
  if (existing.requestedPressureLevel !== selection.requestedPressureLevel
    || !Array.isArray(existing.appointments)
    || existing.appointments.length !== selection.addOnServiceVariantIds.length + 1) {
    return false
  }

  const appointments = existing.appointments
  if (appointments.some((appointment, index) => appointment.bookingGroupOrder !== index)
    || appointments[0]?.serviceVariantId !== selection.primaryServiceVariantId
    || (selection.preferredProviderId
      && appointments[0]?.therapistId !== selection.preferredProviderId)) {
    return false
  }

  try {
    if (dateValue(appointments[0].startsAt).toISOString() !== selection.requestedStartsAt) {
      return false
    }
  } catch {
    return false
  }

  const actualAddOns = appointments.slice(1).map((appointment) => appointment.serviceVariantId).sort()
  const expectedAddOns = [...selection.addOnServiceVariantIds].sort()
  return actualAddOns.length === expectedAddOns.length
    && actualAddOns.every((value, index) => value === expectedAddOns[index])
}

/** Classifies a bounded prefix hit without disclosing which proof mismatched. */
function publicBookingReplayDecision(
  existing: ExistingPublicBookingRequest,
  prepared: PreparedPublicBookingRequest,
): PublicBookingReplayDecision {
  if (!existing) return "MISS"
  return hasExactPublicRequestSelection(existing, prepared.owner)
    && existing.practiceId === prepared.practiceId
    && publicBookingCallerOwnsExistingRequest(existing, prepared)
    && publicBookingPersistedSelectionMatches(existing, prepared.selection)
    ? "REPLAY"
    : "CONFLICT"
}

async function trustedPublicBookingPath(
  practiceId: string,
  db: Pick<Prisma.TransactionClient, "practice"> | typeof prisma = prisma,
): Promise<string> {
  const practice = await db.practice.findUnique({
    where: { id: practiceId },
    select: {
      slug: true,
      publicBookingStateSlug: true,
      publicBookingSlug: true,
    },
  })
  if (!practice) throw new Error("Public booking practice is unavailable.")
  const path = publicBookingPathForPractice(practice)
  if (!path) throw new Error("Public booking path is unavailable.")
  return path
}

/** Recovers an exact replay that committed after the caller's prefix preflight. */
async function publicBookingReplayPathIfPresent(
  prepared: PreparedPublicBookingRequest,
): Promise<string | null> {
  const existing = await findPublicBookingRequest(prisma, prepared.owner)
  const replayDecision = publicBookingReplayDecision(existing, prepared)
  if (replayDecision === "CONFLICT") throw new PublicBookingConflictError()
  return replayDecision === "REPLAY"
    ? trustedPublicBookingPath(prepared.practiceId)
    : null
}

function publicWaitlistCallerOwnsExistingRequest(
  existing: NonNullable<ExistingPublicWaitlistRequest>,
  prepared: PreparedPublicWaitlistRequest,
): boolean {
  if (prepared.userId) {
    return existing.createdById === prepared.userId
      && existing.practiceClient?.userId === prepared.userId
  }
  return existing.createdById === null
    && existing.practiceClient?.userId === null
    && normalizeEmail(existing.practiceClient?.email) === prepared.clientIdentity.guestEmail
}

function publicWaitlistPersistedSelectionMatches(
  existing: NonNullable<ExistingPublicWaitlistRequest>,
  selection: PublicWaitlistRequestSelection,
): boolean {
  if (existing.requestedPressureLevel !== selection.requestedPressureLevel
    || existing.primaryServiceVariantId !== selection.primaryServiceVariantId
    || (existing.preferredProviderId ?? "") !== selection.preferredProviderId) {
    return false
  }

  const actualAddOns = [...existing.addOnServiceVariantIds].sort()
  const expectedAddOns = [...selection.addOnServiceVariantIds].sort()
  if (actualAddOns.length !== expectedAddOns.length
    || actualAddOns.some((value, index) => value !== expectedAddOns[index])) {
    return false
  }

  try {
    const actualPreferredStart = existing.preferredStartsAt
      ? dateValue(existing.preferredStartsAt).toISOString()
      : ""
    return actualPreferredStart === selection.preferredStartsAt
  } catch {
    return false
  }
}

function publicWaitlistReplayDecision(
  existing: ExistingPublicWaitlistRequest,
  prepared: PreparedPublicWaitlistRequest,
): PublicBookingReplayDecision {
  if (!existing) return "MISS"
  return hasExactPublicRequestSelection(existing, prepared.owner)
    && existing.practiceId === prepared.practiceId
    && publicWaitlistCallerOwnsExistingRequest(existing, prepared)
    && publicWaitlistPersistedSelectionMatches(existing, prepared.selection)
    ? "REPLAY"
    : "CONFLICT"
}

async function publicWaitlistReplayPathIfPresent(
  prepared: PreparedPublicWaitlistRequest,
): Promise<string | null> {
  const existing = await findPublicWaitlistRequest(prisma, prepared.owner)
  const replayDecision = publicWaitlistReplayDecision(existing, prepared)
  if (replayDecision === "CONFLICT") throw new PublicBookingConflictError()
  return replayDecision === "REPLAY"
    ? trustedPublicBookingPath(prepared.practiceId)
    : null
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
  publicRequest,
  networkIdentifier,
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
  publicRequest?: PreparedPublicBookingRequest
  networkIdentifier?: string
}) {
  const mutate = async (tx: Prisma.TransactionClient) => {
    if (publicRequest) {
      await acquirePublicRequestLock(tx, publicRequest.owner)
      const existing = await findPublicBookingRequest(tx, publicRequest.owner)
      const replayDecision = publicBookingReplayDecision(existing, publicRequest)
      if (replayDecision === "CONFLICT") throw new PublicBookingConflictError()
      if (replayDecision === "REPLAY") {
        return {
          publicBookingPath: await trustedPublicBookingPath(practiceId, tx),
          outcome: "REPLAY" as const,
          createdEventIds: [] as string[],
        }
      }

      const limiterDecision = await consumeOperationalRateLimitInTransaction({
        operation: "BOOKING_CREATE",
        networkIdentifier: networkIdentifier ?? "",
        practiceId,
        owner: publicRequest.limiterOwner,
        transaction: tx,
      })
      if (!limiterDecision.allowed) {
        return { outcome: "LIMITED" as const, limiterDecision }
      }
    }

    const context = await publicBookingSequenceOptions({
      practiceId,
      primaryServiceVariantId,
      addOnServiceVariantIds,
      requestedPressureLevel,
      preferredProviderId,
      viewerUserId: userId,
      maxOptions: PUBLIC_SEQUENCE_PICKER_MAX_OPTIONS,
      db: tx,
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
    const staffRecipients = await tx.practiceMembership.findMany({
      where: {
        practiceId,
        role: { in: ["OWNER", "STAFF"] },
      },
      select: { userId: true },
    })
    const createdEventIds: string[] = []

    const practiceClient = await ensureBookingPracticeClient(tx, practiceId, clientIdentity ?? { userId, practiceClientId })
    const bookingGroup = await tx.bookingGroup.create({
      data: {
        ...(publicRequest ? { id: publicRequest.owner.id } : {}),
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
    return {
      publicBookingPath: publicBookingPathForPractice(context.practice),
      practiceSlug: context.practice.slug,
      outcome: "CREATED" as const,
      createdEventIds,
    }
  }

  // Public retries must replay the complete database-only unit; per-attempt
  // state is returned from the successful attempt and never accumulated outside it.
  let result: Awaited<ReturnType<typeof mutate>>
  try {
    result = publicRequest
      ? await runCommerceTransaction(prisma, mutate)
      : await prisma.$transaction(mutate)
  } catch (error) {
    if (!publicRequest || !isPrismaUniqueConstraintError(error)) throw error
    const replayPath = await publicBookingReplayPathIfPresent(publicRequest)
    if (!replayPath) throw error
    result = { publicBookingPath: replayPath, outcome: "REPLAY", createdEventIds: [] }
  }

  if (result.outcome === "CREATED") {
    await Promise.all(result.createdEventIds.map((eventId) => pushCalendarEventToGoogleBestEffort(eventId)))
    revalidateCalendarRoutes(result.practiceSlug, result.publicBookingPath)
  }
  return result
}

class PublicBookingValidationError extends Error {
  constructor() {
    super("Public booking request is not allowed by the current practice policy.")
    this.name = "PublicBookingValidationError"
  }
}

function isPrismaUniqueConstraintError(error: unknown): boolean {
  return Boolean(error && typeof error === "object" && "code" in error && error.code === "P2002")
}

export async function requestBookingSequence(
  previousState: PublicBookingActionState,
  formData: FormData,
): Promise<PublicBookingActionState> {
  void previousState
  let userId: string | null
  let requestHeaders: Awaited<ReturnType<typeof headers>>
  try {
    const session = await getCurrentSession()
    userId = session?.user?.id ?? null
    requestHeaders = await headers()
  } catch {
    return publicBookingUnavailable()
  }

  let prepared: PreparedPublicBookingRequest
  try {
    prepared = preparePublicBookingRequest(formData, userId)
  } catch {
    return publicBookingValidationError()
  }

  try {
    const networkIdentifier = authRequestNetworkIdentifier({ headers: requestHeaders })
    const replayPath = await publicBookingReplayPathIfPresent(prepared)
    if (replayPath) {
      const publicBookingPath = replayPath
      return publicBookingSuccess(`${publicBookingPath}?booking=requested`)
    }

    await assertCalendarDatabaseReady()
    const mutation = await createBookingSequenceMutation({
      userId: prepared.userId,
      clientIdentity: prepared.clientIdentity,
      practiceId: prepared.practiceId,
      primaryServiceVariantId: prepared.primaryServiceVariantId,
      addOnServiceVariantIds: prepared.addOnServiceVariantIds,
      requestedPressureLevel: prepared.requestedPressureLevel,
      startsAt: prepared.startsAt,
      preferredProviderId: prepared.preferredProviderId,
      publicRequest: prepared,
      networkIdentifier,
    })

    if (mutation.outcome === "LIMITED") {
      return mutation.limiterDecision.reason === "RATE_LIMITED"
        ? publicBookingRateLimited(mutation.limiterDecision.retryAfterSeconds)
        : publicBookingUnavailable()
    }

    return publicBookingSuccess(`${mutation.publicBookingPath}?booking=requested`)
  } catch (error) {
    return error instanceof PublicBookingConflictError
      ? publicBookingConflict()
      : publicBookingUnavailable()
  }
}

export async function joinBookingWaitlist(
  previousState: PublicBookingActionState,
  formData: FormData,
): Promise<PublicBookingActionState> {
  void previousState
  let userId: string | null
  let requestHeaders: Awaited<ReturnType<typeof headers>>
  try {
    const session = await getCurrentSession()
    userId = session?.user?.id ?? null
    requestHeaders = await headers()
  } catch {
    return publicBookingUnavailable()
  }

  let prepared: PreparedPublicWaitlistRequest
  try {
    prepared = preparePublicWaitlistRequest(formData, userId)
  } catch {
    return publicBookingValidationError()
  }

  try {
    const networkIdentifier = authRequestNetworkIdentifier({ headers: requestHeaders })
    const replayPath = await publicWaitlistReplayPathIfPresent(prepared)
    if (replayPath) {
      return publicBookingSuccess(`${replayPath}?waitlist=joined`)
    }

    await assertCalendarDatabaseReady()
    const mutate = async (tx: Prisma.TransactionClient) => {
      await acquirePublicRequestLock(tx, prepared.owner)
      const existing = await findPublicWaitlistRequest(tx, prepared.owner)
      const replayDecision = publicWaitlistReplayDecision(existing, prepared)
      if (replayDecision === "CONFLICT") throw new PublicBookingConflictError()
      if (replayDecision === "REPLAY") {
        return {
          publicBookingPath: await trustedPublicBookingPath(prepared.practiceId, tx),
          outcome: "REPLAY" as const,
        }
      }

      const limiterDecision = await consumeOperationalRateLimitInTransaction({
        operation: "WAITLIST_JOIN",
        networkIdentifier,
        practiceId: prepared.practiceId,
        owner: prepared.limiterOwner,
        transaction: tx,
      })
      if (!limiterDecision.allowed) {
        return { outcome: "LIMITED" as const, limiterDecision }
      }

      const context = await publicBookingSequenceOptions({
        practiceId: prepared.practiceId,
        primaryServiceVariantId: prepared.primaryServiceVariantId,
        addOnServiceVariantIds: prepared.addOnServiceVariantIds,
        requestedPressureLevel: prepared.requestedPressureLevel,
        preferredProviderId: prepared.preferredProviderId,
        viewerUserId: prepared.userId,
        maxOptions: 1,
        db: tx,
      })

      if (!prepared.userId && !context.allowGuestBooking) {
        throw new PublicBookingValidationError()
      }
      if (context.options.length > 0) {
        throw new PublicBookingConflictError()
      }

      const practiceClient = await ensureBookingPracticeClient(
        tx,
        prepared.practiceId,
        prepared.clientIdentity,
      )
      await tx.bookingWaitlistEntry.create({
        data: {
          id: prepared.owner.id,
          practiceId: prepared.practiceId,
          practiceClientId: practiceClient.id,
          createdById: prepared.userId,
          requestedPressureLevel: prepared.requestedPressureLevel,
          primaryServiceVariantId: prepared.primaryServiceVariantId,
          addOnServiceVariantIds: prepared.addOnServiceVariantIds,
          preferredProviderId: prepared.preferredProviderId || null,
          preferredStartsAt: prepared.preferredStartsAt,
        },
      })
      return {
        publicBookingPath: publicBookingPathForPractice(context.practice),
        practiceSlug: context.practice.slug,
        outcome: "CREATED" as const,
      }
    }
    let mutation: Awaited<ReturnType<typeof mutate>>
    try {
      mutation = await runCommerceTransaction(prisma, mutate)
    } catch (error) {
      if (!isPrismaUniqueConstraintError(error)) throw error
      const recoveredPath = await publicWaitlistReplayPathIfPresent(prepared)
      if (!recoveredPath) throw error
      mutation = { publicBookingPath: recoveredPath, outcome: "REPLAY" }
    }

    if (mutation.outcome === "LIMITED") {
      return mutation.limiterDecision.reason === "RATE_LIMITED"
        ? publicBookingRateLimited(mutation.limiterDecision.retryAfterSeconds)
        : publicBookingUnavailable()
    }
    if (mutation.outcome === "CREATED") {
      revalidateCalendarRoutes(mutation.practiceSlug, mutation.publicBookingPath)
    }
    return publicBookingSuccess(`${mutation.publicBookingPath}?waitlist=joined`)
  } catch (error) {
    if (error instanceof PublicBookingConflictError) return publicBookingConflict()
    if (error instanceof PublicBookingValidationError) return publicBookingValidationError()
    return publicBookingUnavailable()
  }
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
