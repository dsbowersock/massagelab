import "server-only"

import { redirect } from "next/navigation"
import { getCurrentSession } from "@/auth"
import { prisma } from "@/lib/prisma"
import { canCreateCalendarFlow } from "@/lib/calendar-flows"

export const STAFF_ROLES = ["OWNER", "THERAPIST", "STAFF"] as const
export const PRACTICE_SCHEDULING_ROLES = ["OWNER", "STAFF"] as const
export const THERAPIST_ROLES = ["OWNER", "THERAPIST"] as const

const CALENDAR_NOTE_SENSITIVE_PATTERN =
  /(soap|pain|diagnosis|assessment|treatment|transcript|intake response|journal|symptom|medical history|client condition)/i

export function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

export function fieldString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === "string" ? value.trim() : ""
}

export function fieldInteger(formData: FormData, key: string, fallback: number) {
  const value = Number(fieldString(formData, key))
  return Number.isInteger(value) ? value : fallback
}

export function fieldBoolean(formData: FormData, key: string) {
  const value = formData.get(key)
  return value === "on" || value === "true" || value === "1"
}

export function formOrObjectValue(input: FormData | Record<string, unknown>, key: string) {
  if (input instanceof FormData) {
    const value = input.get(key)
    return typeof value === "string" ? value.trim() : ""
  }

  const value = input[key]
  return typeof value === "string" ? value.trim() : ""
}

export function fieldPriceCents(formData: FormData, key: string) {
  const value = fieldString(formData, key)
  if (!value) return null
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) return null
  return Math.round(parsed * 100)
}

export function positiveMinutes(formData: FormData, key: string, fallback = 0) {
  return Math.max(0, fieldInteger(formData, key, fallback))
}

export function localDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  return date
}

/**
 * Keeps calendar records operational-only; clinical details belong in the local professional-record vault.
 */
export function operationalCalendarNote(formData: FormData, key = "notes") {
  const value = fieldString(formData, key)
  if (!value) return null
  if (CALENDAR_NOTE_SENSITIVE_PATTERN.test(value)) {
    throw new Error("Calendar notes must stay operational. Keep client-specific clinical details in local-first documentation.")
  }
  return value
}

export async function currentUserId() {
  const session = await getCurrentSession()
  if (!session?.user?.id) {
    redirect("/login")
  }
  return session.user.id
}

export async function assertPracticeAccess(practiceId: string, userId: string, allowedRoles: readonly string[] = STAFF_ROLES) {
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

export async function assertPracticeTherapist(practiceId: string, therapistId: string) {
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

export function assertCanManageTherapistSchedule(role: string, userId: string, therapistId: string) {
  if (role === "THERAPIST" && userId !== therapistId) {
    throw new Error("Therapists can only manage their own schedule.")
  }
}

export async function getPracticeOrThrow(practiceId: string) {
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

/**
 * Centralizes role checks for calendar mutations so extracted action groups keep the same permissions.
 */
export async function assertCalendarFlowAccess({
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
