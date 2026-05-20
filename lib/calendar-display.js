// @ts-check

const FULL_DAY_END_MINUTE = 24 * 60
const DEFAULT_SLOT_HEIGHT = "2.25rem"

const SLOT_HEIGHT_BY_DENSITY = Object.freeze({
  compact: "1.65rem",
  comfortable: DEFAULT_SLOT_HEIGHT,
  spacious: "2.85rem",
})

/**
 * @param {unknown} value
 * @param {number} fallback
 * @param {number} min
 * @param {number} max
 */
function boundedMinute(value, fallback, min = 0, max = FULL_DAY_END_MINUTE) {
  const minute = Number(value)
  return Number.isInteger(minute) && minute >= min && minute <= max ? minute : fallback
}

/**
 * @param {number} minute
 */
export function minuteToCalendarTime(minute) {
  const safeMinute = boundedMinute(minute, 0)
  const hours = Math.floor(safeMinute / 60)
  const minutes = safeMinute % 60
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`
}

/**
 * @param {number | null | undefined} minute
 */
export function minuteToTimeInput(minute) {
  if (minute == null) return ""
  const safeMinute = boundedMinute(minute, 0, 0, FULL_DAY_END_MINUTE - 1)
  const hours = Math.floor(safeMinute / 60)
  const minutes = safeMinute % 60
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`
}

/**
 * @param {unknown} value
 */
export function timeInputToMinute(value) {
  if (typeof value !== "string") return null
  const match = /^(\d{2}):(\d{2})$/.exec(value)
  if (!match) return null
  const hours = Number(match[1])
  const minutes = Number(match[2])
  if (!Number.isInteger(hours) || !Number.isInteger(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    return null
  }
  return hours * 60 + minutes
}

/**
 * @param {unknown} density
 */
export function slotHeightForDensity(density) {
  return SLOT_HEIGHT_BY_DENSITY[/** @type {keyof typeof SLOT_HEIGHT_BY_DENSITY} */ (String(density))] ?? DEFAULT_SLOT_HEIGHT
}

/**
 * @param {{
 *   startMinute: number
 *   endMinute: number
 *   nowMinute: number
 * }} input
 */
export function scrollMinuteForCalendarBounds({ startMinute, endMinute, nowMinute }) {
  const start = boundedMinute(startMinute, 0)
  const end = boundedMinute(endMinute, FULL_DAY_END_MINUTE)
  const now = boundedMinute(nowMinute, start)
  if (now < start || now > end) return start
  return Math.max(start, now - 60)
}

/**
 * @param {{
 *   preferences?: { calendarDayStartMinute?: number | null, calendarDayEndMinute?: number | null }
 *   providerAvailability?: Array<{ providerId?: string | null, startMinute: number, endMinute: number }>
 *   providerIds?: string[]
 * }} input
 */
export function deriveCalendarVisibleBounds({ preferences = {}, providerAvailability = [], providerIds = [] }) {
  const preferenceStart = preferences.calendarDayStartMinute
  const preferenceEnd = preferences.calendarDayEndMinute
  if (
    Number.isInteger(preferenceStart)
    && Number.isInteger(preferenceEnd)
    && Number(preferenceStart) >= 0
    && Number(preferenceEnd) <= FULL_DAY_END_MINUTE
    && Number(preferenceEnd) > Number(preferenceStart)
  ) {
    return buildBounds("preference", Number(preferenceStart), Number(preferenceEnd))
  }

  const providerFilter = new Set(providerIds.filter(Boolean))
  const visibleIntervals = providerAvailability
    .filter((interval) => providerFilter.size === 0 || providerFilter.has(String(interval.providerId ?? "")))
    .map((interval) => ({
      startMinute: boundedMinute(interval.startMinute, 0),
      endMinute: boundedMinute(interval.endMinute, 0),
    }))
    .filter((interval) => interval.endMinute > interval.startMinute)

  if (visibleIntervals.length > 0) {
    return buildBounds(
      "availability",
      Math.min(...visibleIntervals.map((interval) => interval.startMinute)),
      Math.max(...visibleIntervals.map((interval) => interval.endMinute)),
    )
  }

  return buildBounds("full-day", 0, FULL_DAY_END_MINUTE)
}

/**
 * @param {"preference" | "availability" | "full-day"} source
 * @param {number} startMinute
 * @param {number} endMinute
 */
function buildBounds(source, startMinute, endMinute) {
  return {
    source,
    startMinute,
    endMinute,
    slotMinTime: minuteToCalendarTime(startMinute),
    slotMaxTime: minuteToCalendarTime(endMinute),
  }
}
