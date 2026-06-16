// @ts-check

export const CLIENT_WELLNESS_REMINDER_KINDS = Object.freeze([
  { id: "check_in", label: "Wellness check-in" },
  { id: "body_sensation", label: "Body sensation log" },
  { id: "rom", label: "ROM measurement" },
  { id: "feeling", label: "Feeling check-in" },
  { id: "sleep", label: "Sleep note" },
  { id: "home_care", label: "Home care" },
])

const REMINDER_KIND_IDS = new Set(CLIENT_WELLNESS_REMINDER_KINDS.map((kind) => kind.id))
const REMINDER_KIND_LABELS = Object.fromEntries(CLIENT_WELLNESS_REMINDER_KINDS.map((kind) => [kind.id, kind.label]))
const CADENCES = new Set(["daily", "weekdays", "weekly"])
const DEFAULT_WEEKDAYS = Object.freeze([1, 2, 3, 4, 5])
const DEFAULT_WEEKLY_DAY = 1

/**
 * Normalizes generic wellness reminder schedules for owner-scoped preferences.
 *
 * Schedules intentionally contain only generic scheduling data. User notes,
 * health details, appointment references, and delivery payloads are excluded
 * so this preference object cannot become a calendar notification body.
 *
 * @param {unknown} input
 * @returns {Array<{ id: string, kind: string, cadence: string, timeOfDay: string, weekdays: number[], enabled: boolean }>}
 */
export function normalizeClientWellnessReminderSchedules(input) {
  if (!Array.isArray(input)) {
    return []
  }

  const schedules = []
  const seenIds = new Set()

  for (const item of input) {
    const payload = objectOrEmpty(item)
    const kind = typeof payload.kind === "string" ? payload.kind.trim() : ""
    const timeOfDay = normalizeTimeOfDay(payload.timeOfDay)

    if (!REMINDER_KIND_IDS.has(kind) || !timeOfDay) {
      continue
    }

    const cadence = normalizeCadence(payload.cadence)
    const weekdays = normalizeWeekdays(payload.weekdays, cadence)
    const fallbackId = `reminder-${kind}-${schedules.length + 1}`
    const id = uniqueReminderId(normalizeReminderId(payload.id) || fallbackId, seenIds)

    seenIds.add(id)
    schedules.push({
      id,
      kind,
      cadence,
      timeOfDay,
      weekdays,
      enabled: payload.enabled !== false,
    })

    if (schedules.length >= 12) {
      break
    }
  }

  return schedules
}

/**
 * Builds upcoming in-app reminder occurrences from generic schedules.
 *
 * @param {Array<{ id: string, kind: string, cadence: string, timeOfDay: string, weekdays: number[], enabled: boolean }>} schedules
 * @param {Date} [now]
 * @param {number} [limit]
 */
export function nextClientWellnessReminderOccurrences(schedules, now = new Date(), limit = 6) {
  const start = Number.isFinite(now.getTime()) ? now : new Date()
  const normalizedLimit = Math.min(Math.max(Math.trunc(Number(limit) || 0), 0), 24)
  const occurrences = []

  for (const schedule of normalizeClientWellnessReminderSchedules(schedules)) {
    if (!schedule.enabled) {
      continue
    }

    for (let dayOffset = 0; dayOffset < 370; dayOffset += 1) {
      const occurrence = occurrenceForOffset(start, schedule, dayOffset)

      if (!occurrence || occurrence.startsAt <= start) {
        continue
      }

      occurrences.push(occurrence)

      if (occurrences.length >= normalizedLimit * Math.max(1, schedules.length)) {
        break
      }
    }
  }

  return occurrences
    .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())
    .slice(0, normalizedLimit)
}

/**
 * @param {unknown} value
 */
function objectOrEmpty(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {}
  }

  return /** @type {Record<string, unknown>} */ (value)
}

/**
 * @param {unknown} value
 */
function normalizeReminderId(value) {
  const id = typeof value === "string" ? value.trim().replace(/\s+/g, "-").slice(0, 80) : ""
  return id && /^[A-Za-z0-9_-]+$/.test(id) ? id : ""
}

/**
 * @param {string} id
 * @param {Set<string>} seenIds
 */
function uniqueReminderId(id, seenIds) {
  if (!seenIds.has(id)) {
    return id
  }

  let suffix = 2
  let candidate = `${id}-${suffix}`
  while (seenIds.has(candidate)) {
    suffix += 1
    candidate = `${id}-${suffix}`
  }

  return candidate
}

/**
 * @param {unknown} value
 */
function normalizeCadence(value) {
  const cadence = typeof value === "string" ? value.trim().toLowerCase() : ""
  return CADENCES.has(cadence) ? cadence : "daily"
}

/**
 * @param {unknown} value
 */
function normalizeTimeOfDay(value) {
  const time = typeof value === "string" ? value.trim() : ""
  const match = time.match(/^(\d{1,2}):(\d{2})$/)

  if (!match) {
    return null
  }

  const hour = Number(match[1])
  const minute = Number(match[2])

  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return null
  }

  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
}

/**
 * @param {unknown} value
 * @param {string} cadence
 */
function normalizeWeekdays(value, cadence) {
  if (cadence === "daily") {
    return []
  }

  const weekdays = Array.isArray(value)
    ? [...new Set(value.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))]
    : []

  if (weekdays.length > 0) {
    return weekdays.sort((a, b) => a - b)
  }

  return cadence === "weekdays" ? [...DEFAULT_WEEKDAYS] : [DEFAULT_WEEKLY_DAY]
}

/**
 * @param {Date} start
 * @param {{ id: string, kind: string, cadence: string, timeOfDay: string, weekdays: number[] }} schedule
 * @param {number} dayOffset
 */
function occurrenceForOffset(start, schedule, dayOffset) {
  const [hour, minute] = schedule.timeOfDay.split(":").map(Number)
  const startsAt = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate() + dayOffset,
    hour,
    minute,
    0,
    0,
  )
  const day = startsAt.getDay()

  if (schedule.cadence !== "daily" && !schedule.weekdays.includes(day)) {
    return null
  }

  return {
    scheduleId: schedule.id,
    kind: schedule.kind,
    label: REMINDER_KIND_LABELS[schedule.kind] ?? "Wellness reminder",
    startsAt,
    timeOfDay: schedule.timeOfDay,
  }
}
