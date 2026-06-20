import "server-only"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { Prisma } from "@prisma/client"
import { prisma } from "@/lib/prisma"
import { dateAtMinute, parseTimeToMinute } from "@/lib/calendar"
import { assertCalendarDatabaseReady } from "@/lib/calendar-readiness"
import { FEATURE_KEYS, getUserEntitlementState } from "@/lib/membership"
import { FREE_CALENDAR_LIMITS } from "@/lib/service-catalog"
import {
  THERAPIST_ROLES,
  assertCanManageTherapistSchedule,
  assertPracticeAccess,
  assertPracticeTherapist,
  currentUserId,
  fieldString,
  getPracticeOrThrow,
  slugify,
} from "./access"

function parseDayOfWeek(formData: FormData) {
  const value = fieldString(formData, "dayOfWeek").trim()
  return value === "" ? Number.NaN : Number(value)
}

/**
 * Serializes practice quota checks for one owner before creating the nested
 * practice membership. Without this parent-row lock, concurrent free-account
 * submissions could each observe the same pre-create membership count.
 */
async function lockPracticeCreationOwner(tx: Prisma.TransactionClient, userId: string) {
  await tx.$queryRaw`
    SELECT id
    FROM "User"
    WHERE id = ${userId}
    FOR UPDATE
  `
}

/**
 * Serializes global practice slug allocation. The owner-row lock protects the
 * free-account quota, but slugs are unique across all owners.
 */
async function lockPracticeSlugAllocation(tx: Prisma.TransactionClient) {
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(${8520}, ${1})`
}

export async function createAvailabilitySchedule(formData: FormData) {
  const userId = await currentUserId()
  await assertCalendarDatabaseReady()
  const practiceId = fieldString(formData, "practiceId")
  const therapistId = fieldString(formData, "therapistId")
  const name = fieldString(formData, "name") || "Working schedule"
  const dayOfWeek = parseDayOfWeek(formData)
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
  const effectiveFromDate = effectiveFrom ? dateAtMinute(effectiveFrom, 0, practice.timezone) : null
  const effectiveToDate = effectiveTo ? dateAtMinute(effectiveTo, 0, practice.timezone) : null
  if (effectiveFromDate && effectiveToDate && effectiveToDate < effectiveFromDate) {
    throw new Error("Schedule end date must be on or after the start date.")
  }

  await prisma.calendarAvailabilitySchedule.create({
    data: {
      practiceId,
      therapistId,
      name,
      effectiveFrom: effectiveFromDate,
      effectiveTo: effectiveToDate,
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

export async function createAvailabilityOverride(formData: FormData) {
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

export async function createPractice(formData: FormData) {
  const userId = await currentUserId()
  await assertCalendarDatabaseReady()
  const name = fieldString(formData, "name")

  if (!name) {
    throw new Error("Practice name is required.")
  }

  const entitlements = await getUserEntitlementState(prisma, userId)
  const hasFullScheduling = entitlements.hasFeature(FEATURE_KEYS.calendarFullScheduling)

  const baseSlug = slugify(name) || "practice"

  const practice = await prisma.$transaction(async (tx) => {
    await lockPracticeCreationOwner(tx, userId)
    await lockPracticeSlugAllocation(tx)

    if (!hasFullScheduling) {
      const ownedPracticeCount = await tx.practiceMembership.count({
        where: { userId, role: "OWNER" },
      })
      if (ownedPracticeCount >= FREE_CALENDAR_LIMITS.practices) {
        throw new Error("Free calendars include one solo workspace.")
      }
    }

    let slug = baseSlug
    let suffix = 2

    while (await tx.practice.findUnique({ where: { slug }, select: { id: true } })) {
      slug = `${baseSlug}-${suffix}`
      suffix += 1
    }

    return tx.practice.create({
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
  })

  revalidatePath("/calendar")
  redirect(`/calendar?practice=${practice.id}`)
}

export async function createAvailabilityRule(formData: FormData) {
  const userId = await currentUserId()
  await assertCalendarDatabaseReady()
  const practiceId = fieldString(formData, "practiceId")
  const therapistId = fieldString(formData, "therapistId")
  const dayOfWeek = parseDayOfWeek(formData)
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
