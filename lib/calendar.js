// @ts-check

export const ACTIVE_APPOINTMENT_STATUSES = /** @type {const} */ (["REQUESTED", "CONFIRMED"])

/**
 * @param {unknown} value
 */
export function appointmentIsActive(value) {
  return typeof value === "string" && ACTIVE_APPOINTMENT_STATUSES.includes(/** @type {"REQUESTED" | "CONFIRMED"} */ (value))
}

/**
 * @param {number} value
 * @param {number} fallback
 * @param {number} min
 * @param {number} max
 */
export function clampInteger(value, fallback, min, max) {
  const number = Number(value)
  if (!Number.isFinite(number)) return fallback
  return Math.min(Math.max(Math.trunc(number), min), max)
}

/**
 * @param {unknown} value
 */
export function dateValue(value) {
  const date = value instanceof Date ? value : new Date(/** @type {string | number} */ (value))
  if (Number.isNaN(date.getTime())) {
    throw new Error("Expected a valid date.")
  }
  return date
}

/**
 * @param {Date | string | number} firstStart
 * @param {Date | string | number} firstEnd
 * @param {Date | string | number} secondStart
 * @param {Date | string | number} secondEnd
 */
export function intervalsOverlap(firstStart, firstEnd, secondStart, secondEnd) {
  const aStart = dateValue(firstStart).getTime()
  const aEnd = dateValue(firstEnd).getTime()
  const bStart = dateValue(secondStart).getTime()
  const bEnd = dateValue(secondEnd).getTime()

  return aStart < bEnd && bStart < aEnd
}

/**
 * @param {string} date
 * @param {number} minute
 */
export function dateAtUtcMinute(date, minute) {
  return dateAtMinute(date, minute, "UTC")
}

/**
 * @param {Date} date
 * @param {string} timeZone
 */
export function getTimeZoneOffsetMs(date, timeZone) {
  if (timeZone === "UTC") return 0

  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date)

  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  const asUtc = Date.UTC(
    Number(value.year),
    Number(value.month) - 1,
    Number(value.day),
    Number(value.hour),
    Number(value.minute),
    Number(value.second),
  )

  return asUtc - date.getTime()
}

/**
 * @param {string} date
 * @param {number} minute
 * @param {string} [timeZone]
 */
export function dateAtMinute(date, minute, timeZone = "UTC") {
  const midnight = new Date(`${date}T00:00:00.000Z`)
  if (Number.isNaN(midnight.getTime())) {
    throw new Error("Expected a YYYY-MM-DD date.")
  }

  const naiveUtc = new Date(midnight.getTime() + minute * 60_000)
  if (timeZone === "UTC") {
    return naiveUtc
  }

  const firstPass = new Date(naiveUtc.getTime() - getTimeZoneOffsetMs(naiveUtc, timeZone))
  return new Date(naiveUtc.getTime() - getTimeZoneOffsetMs(firstPass, timeZone))
}

/**
 * @param {string} value
 * @param {string} [timeZone]
 */
export function localDateTimeToUtc(value, timeZone = "UTC") {
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})$/.exec(value)
  if (!match) return null

  const minutes = Number(match[2]) * 60 + Number(match[3])
  try {
    return dateAtMinute(match[1], minutes, timeZone)
  } catch {
    return null
  }
}

/**
 * @param {Date | string | number} value
 */
export function isoDate(value) {
  return dateValue(value).toISOString().slice(0, 10)
}

/**
 * @param {number} minutes
 */
export function formatMinuteLabel(minutes) {
  const clamped = clampInteger(minutes, 0, 0, 24 * 60 - 1)
  const hours = Math.floor(clamped / 60)
  const mins = clamped % 60
  const hour12 = hours % 12 || 12
  const suffix = hours >= 12 ? "PM" : "AM"
  return `${hour12}:${mins.toString().padStart(2, "0")} ${suffix}`
}

/**
 * @param {string} value
 */
export function parseTimeToMinute(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value)
  if (!match) return null

  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null
  }

  return hours * 60 + minutes
}

/**
 * @param {{
 *   startsAt: Date | string | number
 *   endsAt: Date | string | number
 *   blocks?: Array<{ startsAt: Date | string | number, endsAt: Date | string | number }>
 *   appointments?: Array<{ startsAt: Date | string | number, endsAt: Date | string | number, status?: string }>
 * }} input
 */
export function hasAppointmentConflict({ startsAt, endsAt, blocks = [], appointments = [] }) {
  const start = dateValue(startsAt)
  const end = dateValue(endsAt)

  if (end <= start) {
    return true
  }

  const blocked = blocks.some((block) => intervalsOverlap(start, end, block.startsAt, block.endsAt))
  if (blocked) return true

  return appointments.some((appointment) => (
    appointmentIsActive(appointment.status ?? "CONFIRMED") &&
    intervalsOverlap(start, end, appointment.startsAt, appointment.endsAt)
  ))
}

/**
 * @param {{
 *   date: string
 *   serviceDurationMinutes: number
 *   stepMinutes?: number
 *   timeZone?: string
 *   now?: Date | string | number | null
 *   rules?: Array<{ dayOfWeek: number, startMinute: number, endMinute: number, active?: boolean }>
 *   blocks?: Array<{ startsAt: Date | string | number, endsAt: Date | string | number }>
 *   appointments?: Array<{ startsAt: Date | string | number, endsAt: Date | string | number, status?: string }>
 * }} input
 */
export function buildAvailabilitySlots({
  date,
  serviceDurationMinutes,
  stepMinutes = 15,
  timeZone = "UTC",
  now = null,
  rules = [],
  blocks = [],
  appointments = [],
}) {
  const duration = clampInteger(serviceDurationMinutes, 60, 5, 24 * 60)
  const step = clampInteger(stepMinutes, 15, 5, 120)
  const dayOfWeek = new Date(`${date}T00:00:00.000Z`).getUTCDay()
  const cutoff = now ? dateValue(now).getTime() : null

  return rules
    .filter((rule) => rule.active !== false && rule.dayOfWeek === dayOfWeek)
    .flatMap((rule) => {
      const startMinute = clampInteger(rule.startMinute, 9 * 60, 0, 24 * 60)
      const endMinute = clampInteger(rule.endMinute, 17 * 60, 0, 24 * 60)
      const slots = []

      for (let minute = startMinute; minute + duration <= endMinute; minute += step) {
        const startsAt = dateAtMinute(date, minute, timeZone)
        const endsAt = dateAtMinute(date, minute + duration, timeZone)

        if (cutoff !== null && startsAt.getTime() < cutoff) {
          continue
        }

        if (!hasAppointmentConflict({ startsAt, endsAt, blocks, appointments })) {
          slots.push({
            startsAt,
            endsAt,
            startMinute: minute,
            endMinute: minute + duration,
            label: formatMinuteLabel(minute),
          })
        }
      }

      return slots
    })
}
