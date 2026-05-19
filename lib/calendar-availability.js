// @ts-check

import { clampInteger, dateValue } from "./calendar.js"

const CLOSED_OVERRIDE_KINDS = new Set(["BLACKOUT", "HOLIDAY", "CLOSED"])
const OPEN_OVERRIDE_KINDS = new Set(["OPEN", "CUSTOM"])

/**
 * @param {Date | string | number} value
 * @param {string} timeZone
 */
export function calendarDateParts(value, timeZone = "UTC") {
  const date = dateValue(value)
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date)
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  const isoDate = `${map.year}-${map.month}-${map.day}`
  const midnight = new Date(`${isoDate}T00:00:00.000Z`)

  return {
    date: isoDate,
    dayOfWeek: midnight.getUTCDay(),
    minute: Number(map.hour) * 60 + Number(map.minute),
  }
}

/**
 * @param {unknown} value
 */
function dateKey(value) {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  if (typeof value === "string") return value.slice(0, 10)
  return ""
}

/**
 * @param {Date | string | null | undefined} start
 * @param {Date | string | null | undefined} end
 * @param {string} date
 */
function dateWithinRange(start, end, date) {
  const from = start ? dateKey(start) : ""
  const to = end ? dateKey(end) : ""
  return (!from || date >= from) && (!to || date <= to)
}

/**
 * @param {Array<{ startMinute?: number, endMinute?: number, dayOfWeek?: number, active?: boolean }>} intervals
 * @param {number | null} [dayOfWeek]
 */
function normalizeIntervals(intervals = [], dayOfWeek = null) {
  return intervals
    .filter((interval) => interval.active !== false)
    .filter((interval) => dayOfWeek == null || interval.dayOfWeek === dayOfWeek)
    .map((interval) => ({
      startMinute: clampInteger(interval.startMinute ?? 9 * 60, 9 * 60, 0, 24 * 60),
      endMinute: clampInteger(interval.endMinute ?? 17 * 60, 17 * 60, 0, 24 * 60),
    }))
    .filter((interval) => interval.endMinute > interval.startMinute)
    .sort((a, b) => a.startMinute - b.startMinute)
}

/**
 * @param {{
 *   date: string
 *   weeklyRules?: Array<{ dayOfWeek: number, startMinute: number, endMinute: number, active?: boolean }>
 *   schedules?: Array<{ active?: boolean, effectiveFrom?: Date | string | null, effectiveTo?: Date | string | null, intervals?: Array<{ dayOfWeek: number, startMinute: number, endMinute: number, active?: boolean }> }>
 *   overrides?: Array<{ date: Date | string, kind?: string, intervals?: Array<{ startMinute: number, endMinute: number, active?: boolean }> }>
 * }} input
 */
export function resolveAvailabilityForDate({ date, weeklyRules = [], schedules = [], overrides = [] }) {
  const normalizedDate = dateKey(date)
  const dayOfWeek = new Date(`${normalizedDate}T00:00:00.000Z`).getUTCDay()
  const matchingOverrides = overrides.filter((override) => dateKey(override.date) === normalizedDate)

  if (matchingOverrides.some((override) => CLOSED_OVERRIDE_KINDS.has(String(override.kind ?? "").toUpperCase()))) {
    return { source: "blackout", intervals: [] }
  }

  const openOverride = matchingOverrides.find((override) => OPEN_OVERRIDE_KINDS.has(String(override.kind ?? "OPEN").toUpperCase()))
  if (openOverride) {
    return { source: "override", intervals: normalizeIntervals(openOverride.intervals ?? []) }
  }

  const schedule = schedules
    .filter((candidate) => candidate.active !== false && dateWithinRange(candidate.effectiveFrom, candidate.effectiveTo, normalizedDate))
    .at(-1)
  const scheduleIntervals = schedule ? normalizeIntervals(schedule.intervals ?? [], dayOfWeek) : []
  if (scheduleIntervals.length > 0) {
    return { source: "schedule", intervals: scheduleIntervals }
  }

  return { source: "weekly", intervals: normalizeIntervals(weeklyRules, dayOfWeek) }
}

/**
 * @param {{ availability: { intervals?: Array<{ startMinute: number, endMinute: number }> }, startMinute: number, endMinute: number }} input
 */
export function availabilityContainsRange({ availability, startMinute, endMinute }) {
  if (endMinute <= startMinute) return false
  return (availability.intervals ?? []).some((interval) => (
    startMinute >= interval.startMinute && endMinute <= interval.endMinute
  ))
}
