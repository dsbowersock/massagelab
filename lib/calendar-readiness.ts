import { createAsyncTtlCache } from "@/lib/async-ttl-cache"
import { prisma } from "@/lib/prisma"

const CALENDAR_MODEL_DELEGATES = [
  "practice",
  "practiceMembership",
  "practiceClient",
  "serviceType",
  "serviceVariant",
  "calendarResource",
  "serviceVariantResource",
  "calendarResourceBooking",
  "therapistAvailabilityRule",
  "calendarAvailabilitySchedule",
  "calendarAvailabilityScheduleInterval",
  "calendarAvailabilityOverride",
  "calendarAvailabilityOverrideInterval",
  "calendarEvent",
  "calendarBlock",
  "appointment",
  "appointmentServiceItem",
  "calendarClass",
  "calendarReminder",
  "calendarAuditLog",
  "calendarNotificationIntent",
] as const

type CalendarModelDelegate = (typeof CALENDAR_MODEL_DELEGATES)[number]

type CalendarPrismaClient = typeof prisma & Partial<Record<CalendarModelDelegate, unknown>>

type CalendarReadinessRow = {
  ready: boolean | null
}

export const CALENDAR_UNAVAILABLE_MESSAGE = "Calendar is temporarily unavailable. Please try again later."
const CALENDAR_READINESS_CACHE_TTL_MS = 60_000

function calendarClientReady() {
  try {
    const client = prisma as CalendarPrismaClient

    return CALENDAR_MODEL_DELEGATES.every((delegate) => Boolean(client[delegate]))
  } catch {
    return false
  }
}

async function loadCalendarDatabaseReadiness() {
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
        'ServiceVariant',
        'CalendarResource',
        'ServiceVariantResource',
        'CalendarResourceBooking',
        'TherapistAvailabilityRule',
        'CalendarAvailabilitySchedule',
        'CalendarAvailabilityScheduleInterval',
        'CalendarAvailabilityOverride',
        'CalendarAvailabilityOverrideInterval',
        'CalendarEvent',
        'CalendarBlock',
        'Appointment',
        'AppointmentServiceItem',
        'CalendarClass',
        'CalendarReminder',
        'CalendarAuditLog',
        'CalendarNotificationIntent'
      ]) AS required(table_name)
    `

    const ready = rows[0]?.ready === true

    if (!ready && process.env.NODE_ENV !== "production") {
      const missing = await prisma.$queryRaw<Array<{ tableName: string }>>`
        SELECT table_name AS "tableName"
        FROM unnest(ARRAY[
          'Practice',
          'PracticeMembership',
          'PracticeClient',
          'ServiceType',
          'ServiceVariant',
          'CalendarResource',
          'ServiceVariantResource',
          'CalendarResourceBooking',
          'TherapistAvailabilityRule',
          'CalendarAvailabilitySchedule',
          'CalendarAvailabilityScheduleInterval',
          'CalendarAvailabilityOverride',
          'CalendarAvailabilityOverrideInterval',
          'CalendarEvent',
          'CalendarBlock',
          'Appointment',
          'AppointmentServiceItem',
          'CalendarClass',
          'CalendarReminder',
          'CalendarAuditLog',
          'CalendarNotificationIntent'
        ]) AS required(table_name)
        WHERE to_regclass(format('%I.%I', 'public', table_name)) IS NULL
      `
      console.warn("Calendar readiness check failed; missing tables:", missing.map((row) => row.tableName).join(", "))
    }

    return ready
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("Calendar readiness check failed:", error)
    }
    return false
  }
}

const calendarReadinessCache = createAsyncTtlCache<boolean>({
  ttlMs: CALENDAR_READINESS_CACHE_TTL_MS,
  load: loadCalendarDatabaseReadiness,
})

export async function isCalendarDatabaseReady() {
  return calendarReadinessCache.get()
}

export function clearCalendarDatabaseReadinessCache() {
  calendarReadinessCache.clear()
}

export async function assertCalendarDatabaseReady() {
  if (!(await isCalendarDatabaseReady())) {
    throw new Error(CALENDAR_UNAVAILABLE_MESSAGE)
  }
}
