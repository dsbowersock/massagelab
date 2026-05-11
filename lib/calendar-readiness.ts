import { prisma } from "@/lib/prisma"

const CALENDAR_MODEL_DELEGATES = [
  "practice",
  "practiceMembership",
  "practiceClient",
  "serviceType",
  "therapistAvailabilityRule",
  "calendarBlock",
  "appointment",
] as const

type CalendarModelDelegate = (typeof CALENDAR_MODEL_DELEGATES)[number]

type CalendarPrismaClient = typeof prisma & Partial<Record<CalendarModelDelegate, unknown>>

type CalendarReadinessRow = {
  ready: boolean | null
}

export const CALENDAR_UNAVAILABLE_MESSAGE = "Calendar is temporarily unavailable. Please try again later."

function calendarClientReady() {
  try {
    const client = prisma as CalendarPrismaClient

    return CALENDAR_MODEL_DELEGATES.every((delegate) => Boolean(client[delegate]))
  } catch {
    return false
  }
}

export async function isCalendarDatabaseReady() {
  if (!calendarClientReady()) {
    return false
  }

  try {
    const rows = await prisma.$queryRaw<CalendarReadinessRow[]>`
      SELECT COALESCE(
        bool_and(to_regclass(format('%I.%I', 'public', table_name)) IS NOT NULL),
        false
      ) AS "ready"
      FROM unnest(ARRAY[
        'Practice',
        'PracticeMembership',
        'PracticeClient',
        'ServiceType',
        'TherapistAvailabilityRule',
        'CalendarBlock',
        'Appointment'
      ]) AS required(table_name)
    `

    return rows[0]?.ready === true
  } catch {
    return false
  }
}

export async function assertCalendarDatabaseReady() {
  if (!(await isCalendarDatabaseReady())) {
    throw new Error(CALENDAR_UNAVAILABLE_MESSAGE)
  }
}
