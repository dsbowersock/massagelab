"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { getCurrentSession } from "@/auth"
import { prisma } from "@/lib/prisma"
import { hasAppointmentConflict, localDateTimeToUtc, parseTimeToMinute } from "@/lib/calendar"
import { assertCalendarDatabaseReady } from "@/lib/calendar-readiness"

const STAFF_ROLES = ["OWNER", "THERAPIST", "STAFF"]
const THERAPIST_ROLES = ["OWNER", "THERAPIST"]
const ACTIVE_STATUSES = ["REQUESTED", "CONFIRMED"] as const

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

function localDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }
  return date
}

async function currentUserId() {
  const session = await getCurrentSession()
  if (!session?.user?.id) {
    redirect("/login")
  }
  return session.user.id
}

async function assertPracticeAccess(practiceId: string, userId: string, allowedRoles = STAFF_ROLES) {
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

export async function createPracticeAction(formData: FormData) {
  const userId = await currentUserId()
  await assertCalendarDatabaseReady()
  const name = fieldString(formData, "name")

  if (!name) {
    throw new Error("Practice name is required.")
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

  await assertPracticeAccess(practiceId, userId, THERAPIST_ROLES)
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

export async function createCalendarBlockAction(formData: FormData) {
  const userId = await currentUserId()
  await assertCalendarDatabaseReady()
  const practiceId = fieldString(formData, "practiceId")
  const therapistId = fieldString(formData, "therapistId")
  const practice = await prisma.practice.findUnique({ where: { id: practiceId }, select: { timezone: true } })
  const startsAt = localDateTimeToUtc(fieldString(formData, "startsAt"), practice?.timezone ?? "America/New_York")
  const endsAt = localDateTimeToUtc(fieldString(formData, "endsAt"), practice?.timezone ?? "America/New_York")
  const reason = fieldString(formData, "reason")

  await assertPracticeAccess(practiceId, userId, THERAPIST_ROLES)
  await assertPracticeTherapist(practiceId, therapistId)

  if (!therapistId || !startsAt || !endsAt || endsAt <= startsAt) {
    throw new Error("Use a therapist and valid block start/end time.")
  }

  await prisma.calendarBlock.create({
    data: {
      practiceId,
      therapistId,
      startsAt,
      endsAt,
      reason: reason || null,
    },
  })

  revalidatePath("/calendar")
  revalidatePath("/calendar/availability")
}

export async function requestAppointmentAction(formData: FormData) {
  const userId = await currentUserId()
  await assertCalendarDatabaseReady()
  const practiceId = fieldString(formData, "practiceId")
  const therapistId = fieldString(formData, "therapistId")
  const serviceTypeId = fieldString(formData, "serviceTypeId")
  const startsAt = localDateTime(fieldString(formData, "startsAt"))

  if (!practiceId || !therapistId || !serviceTypeId || !startsAt) {
    throw new Error("Choose an available appointment time.")
  }
  await assertPracticeTherapist(practiceId, therapistId)

  const service = await prisma.serviceType.findFirst({
    where: {
      id: serviceTypeId,
      practiceId,
      active: true,
    },
  })

  if (!service) {
    throw new Error("That service is not available.")
  }

  const endsAt = new Date(startsAt.getTime() + (service.durationMinutes + service.bufferMinutes) * 60_000)
  const [blocks, appointments, user] = await Promise.all([
    prisma.calendarBlock.findMany({
      where: {
        practiceId,
        therapistId,
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
      select: { startsAt: true, endsAt: true },
    }),
    prisma.appointment.findMany({
      where: {
        practiceId,
        therapistId,
        status: { in: [...ACTIVE_STATUSES] },
        startsAt: { lt: endsAt },
        endsAt: { gt: startsAt },
      },
      select: { startsAt: true, endsAt: true, status: true },
    }),
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true },
    }),
  ])

  if (hasAppointmentConflict({ startsAt, endsAt, blocks, appointments })) {
    throw new Error("That appointment time is no longer available.")
  }

  const practiceClient = await prisma.practiceClient.upsert({
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

  await prisma.appointment.create({
    data: {
      practiceId,
      therapistId,
      practiceClientId: practiceClient.id,
      serviceTypeId,
      createdById: userId,
      startsAt,
      endsAt,
      status: "REQUESTED",
      source: "CLIENT_REQUEST",
    },
  })

  revalidatePath("/calendar")
  revalidatePath("/book/[practiceSlug]", "page")
  redirect("/calendar")
}
