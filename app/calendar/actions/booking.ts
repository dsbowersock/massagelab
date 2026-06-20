import "server-only"

import { redirect } from "next/navigation"
import { Prisma } from "@prisma/client"
import {
  PRACTICE_SCHEDULING_ROLES,
  STAFF_ROLES,
  assertCanManageTherapistSchedule,
  assertPracticeAccess,
  assertPracticeTherapist,
  currentUserId,
  fieldBoolean,
  fieldInteger,
  fieldString,
  getPracticeOrThrow,
} from "./access"
import { revalidateCalendarRoutes } from "./revalidation"
import { assertCalendarDatabaseReady } from "@/lib/calendar-readiness"
import { prisma } from "@/lib/prisma"
import {
  normalizePublicBookingSlug,
  normalizePublicBookingStateSlug,
  publicBookingPathForPractice,
} from "@/lib/public-booking-url"

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

export async function saveBookingPolicy(formData: FormData) {
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

export async function savePublicBookingUrl(formData: FormData) {
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

export async function saveProviderBookingPolicy(formData: FormData) {
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

export async function saveProviderCapacityRules(formData: FormData) {
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
