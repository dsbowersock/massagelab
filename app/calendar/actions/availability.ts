import "server-only"

import { Prisma } from "@prisma/client"
import { dateAtMinute } from "@/lib/calendar"
import {
  availabilityRangeOverrideState,
  calendarDateParts,
  OUTSIDE_PROVIDER_AVAILABILITY_MESSAGE,
  resolveAvailabilityForDate,
} from "@/lib/calendar-availability"
import { assertNoExternalCalendarBusyConflict } from "@/lib/calendar-sync-conflicts"
import { hasCalendarEventConflict } from "@/lib/calendar-flows"
import { prisma } from "@/lib/prisma"
import { hasResourceConflict } from "@/lib/service-catalog"

const ACTIVE_EVENT_STATUSES = ["REQUESTED", "CONFIRMED", "ACTIVE"] as const

type CalendarDb = typeof prisma | Prisma.TransactionClient

export class OutsideProviderAvailabilityError extends Error {
  constructor(message = OUTSIDE_PROVIDER_AVAILABILITY_MESSAGE) {
    super(message)
    this.name = "OutsideProviderAvailabilityError"
  }
}

export async function assertNoCalendarEventConflict({
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

  await assertNoExternalCalendarBusyConflict({
    db,
    ownerUserId,
    startsAt,
    endsAt,
  })
}

export async function assertNoResourceConflict({
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

export async function assertProviderAvailability({
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

/**
 * Locks schedule inputs before conflict checks so concurrent booking mutations see a stable calendar window.
 */
export async function lockAppointmentSchedulingRows(
  tx: Prisma.TransactionClient,
  {
    practiceId,
    therapistId,
    resourceIds,
    startsAt,
    endsAt,
    eventIds = [],
  }: {
    practiceId: string
    therapistId: string
    resourceIds: string[]
    startsAt: Date
    endsAt: Date
    eventIds?: string[]
  },
) {
  const uniqueResourceIds = [...new Set(resourceIds.filter(Boolean))]
  const uniqueEventIds = [...new Set(eventIds.filter(Boolean))]

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
  if (uniqueEventIds.length > 0) {
    await tx.$queryRaw(Prisma.sql`
      SELECT id
      FROM "CalendarEvent"
      WHERE id IN (${Prisma.join(uniqueEventIds)})
        OR (
          "practiceId" = ${practiceId}
          AND "ownerUserId" = ${therapistId}
          AND "blocksAvailability" = true
          AND "status" IN ('REQUESTED', 'CONFIRMED', 'ACTIVE')
          AND "startsAt" < ${endsAt}
          AND "endsAt" > ${startsAt}
        )
      ORDER BY id
      FOR UPDATE
    `)
  } else {
    await tx.$queryRaw`
      SELECT id
      FROM "CalendarEvent"
      WHERE "practiceId" = ${practiceId}
        AND "ownerUserId" = ${therapistId}
        AND "blocksAvailability" = true
        AND "status" IN ('REQUESTED', 'CONFIRMED', 'ACTIVE')
        AND "startsAt" < ${endsAt}
        AND "endsAt" > ${startsAt}
      ORDER BY id
      FOR UPDATE
    `
  }

  await tx.$queryRaw`
    SELECT b.id
    FROM "ExternalCalendarBusyBlock" b
    INNER JOIN "CalendarConnection" c
      ON c.id = b."connectionId"
    WHERE b."ownerUserId" = ${therapistId}
      AND b."status" = 'BUSY'
      AND c."status" = 'ACTIVE'
      AND b."startsAt" < ${endsAt}
      AND b."endsAt" > ${startsAt}
    ORDER BY b.id
    FOR UPDATE OF b
  `

  if (uniqueResourceIds.length === 0) return

  await tx.$queryRaw(Prisma.sql`
    SELECT id
    FROM "CalendarResource"
    WHERE id IN (${Prisma.join(uniqueResourceIds)})
    ORDER BY id
    FOR UPDATE
  `)
  await tx.$queryRaw(Prisma.sql`
    SELECT id
    FROM "CalendarResourceBooking"
    WHERE "resourceId" IN (${Prisma.join(uniqueResourceIds)})
      AND "startsAt" < ${endsAt}
      AND "endsAt" > ${startsAt}
    ORDER BY id
    FOR UPDATE
  `)
}
