/**
 * @typedef {{ id: string, label: string }} ProviderPreference
 */

/**
 * @typedef {{
 *   startsAt: string
 *   endsAt?: string
 *   status?: string
 *   items?: unknown[]
 * }} SequenceOption
 */

const WEEKDAY_LABELS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

/**
 * @param {ProviderPreference[]} providers
 */
export function providerPreferenceModel(providers) {
  const providerList = Array.isArray(providers) ? providers : []
  const namedProviders = providerList.filter((provider) => provider.id)
  const anyProvider = providerList.find((provider) => !provider.id)

  return {
    namedProviders,
    shouldShowProviderPreference: namedProviders.length > 1,
    defaultProviderId: anyProvider ? "" : (namedProviders[0]?.id ?? ""),
  }
}

/**
 * @param {string | Date} value
 * @param {string} timeZone
 */
export function practiceLocalDateKey(value, timeZone) {
  const date = value instanceof Date ? value : new Date(value)
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date)
  const partByType = new Map(parts.map((part) => [part.type, part.value]))

  return `${partByType.get("year")}-${partByType.get("month")}-${partByType.get("day")}`
}

/**
 * @param {string} dateKey
 * @param {number} days
 */
function addDaysToDateKey(dateKey, days) {
  const date = new Date(`${dateKey}T12:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

/**
 * @param {string | Date} value
 * @param {string} timeZone
 */
export function sequenceWeekStartKey(value, timeZone) {
  const dateKey = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? value
    : practiceLocalDateKey(value, timeZone)
  const weekday = new Date(`${dateKey}T12:00:00.000Z`).getUTCDay()
  return addDaysToDateKey(dateKey, -weekday)
}

/**
 * @param {string} dateKey
 */
export function formatWeekRangeLabel(dateKey) {
  const start = new Date(`${dateKey}T12:00:00.000Z`)
  const end = new Date(start)
  end.setUTCDate(start.getUTCDate() + 6)
  const monthDay = new Intl.DateTimeFormat(undefined, { timeZone: "UTC", month: "short", day: "numeric" })
  const monthDayYear = new Intl.DateTimeFormat(undefined, { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" })
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear()
  const sameMonth = sameYear && start.getUTCMonth() === end.getUTCMonth()

  if (sameMonth) {
    return `${new Intl.DateTimeFormat(undefined, { timeZone: "UTC", month: "short" }).format(start)} ${start.getUTCDate()}-${end.getUTCDate()}, ${end.getUTCFullYear()}`
  }

  return `${sameYear ? monthDay.format(start) : monthDayYear.format(start)}-${monthDayYear.format(end)}`
}

/**
 * @param {string | Date} value
 * @param {string} timeZone
 */
export function practiceLocalTimeMinutes(value, timeZone) {
  const date = value instanceof Date ? value : new Date(value)
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date)
  const partByType = new Map(parts.map((part) => [part.type, part.value]))
  const hour = Number(partByType.get("hour") ?? 0) % 24
  const minute = Number(partByType.get("minute") ?? 0)

  return hour * 60 + minute
}

/**
 * @param {SequenceOption} option
 */
export function sequenceOptionKey(option) {
  return `${option.startsAt}-${(option.items ?? []).map((item) => (
    item && typeof item === "object" && "providerUserId" in item
      ? /** @type {{ providerUserId?: unknown }} */ (item).providerUserId
      : ""
  )).join("-")}`
}

/**
 * @param {SequenceOption[]} options
 * @param {string} timeZone
 */
export function groupSequenceOptionsByLocalDate(options, timeZone) {
  const groupsByDate = new Map()
  const sortedOptions = [...(Array.isArray(options) ? options : [])].sort((a, b) => (
    new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime()
  ))

  for (const option of sortedOptions) {
    const dateKey = practiceLocalDateKey(option.startsAt, timeZone)
    const group = groupsByDate.get(dateKey) ?? { dateKey, date: new Date(`${dateKey}T12:00:00.000Z`), options: [] }
    group.options.push(option)
    groupsByDate.set(dateKey, group)
  }

  return [...groupsByDate.values()]
}

/**
 * @param {SequenceOption[]} options
 * @param {string} timeZone
 * @param {string} [requestedWeekStartKey]
 */
export function buildSequenceWeekGrid(options, timeZone, requestedWeekStartKey = "") {
  const slots = [...(Array.isArray(options) ? options : [])]
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime())
    .map((option) => {
      const dateKey = practiceLocalDateKey(option.startsAt, timeZone)
      const startMinutes = practiceLocalTimeMinutes(option.startsAt, timeZone)
      const endMinutes = practiceLocalTimeMinutes(option.endsAt ?? option.startsAt, timeZone)
      return {
        option,
        dateKey,
        weekStartKey: sequenceWeekStartKey(dateKey, timeZone),
        startMinutes,
        endMinutes: endMinutes > startMinutes ? endMinutes : startMinutes + 30,
      }
    })
  const weekStartKeySet = new Set(slots.map((slot) => slot.weekStartKey))
  if (requestedWeekStartKey) {
    weekStartKeySet.add(requestedWeekStartKey)
  }
  const weekStartKeys = [...weekStartKeySet].sort()
  const selectedWeekStartKey = requestedWeekStartKey || weekStartKeys[0] || sequenceWeekStartKey(new Date(), timeZone)
  const weekSlots = slots.filter((slot) => slot.weekStartKey === selectedWeekStartKey)
  const days = Array.from({ length: 7 }, (_, index) => {
    const dateKey = addDaysToDateKey(selectedWeekStartKey, index)
    const daySlots = weekSlots.filter((slot) => slot.dateKey === dateKey)
    const date = new Date(`${dateKey}T12:00:00.000Z`)

    return {
      dateKey,
      weekday: WEEKDAY_LABELS[index],
      weekdayShort: WEEKDAY_LABELS[index].slice(0, 3),
      dayLabel: new Intl.DateTimeFormat(undefined, { timeZone: "UTC", month: "short", day: "numeric" }).format(date),
      slots: daySlots,
    }
  })

  const earliestStart = weekSlots.length > 0 ? Math.min(...weekSlots.map((slot) => slot.startMinutes)) : 9 * 60
  const latestEnd = weekSlots.length > 0 ? Math.max(...weekSlots.map((slot) => slot.endMinutes)) : 17 * 60
  const startHour = Math.max(0, Math.floor((earliestStart - 60) / 60))
  const endHour = Math.min(24, Math.max(startHour + 1, Math.ceil((latestEnd + 30) / 60)))
  const hourTicks = Array.from({ length: endHour - startHour + 1 }, (_, index) => (startHour + index) * 60)

  return {
    weeks: weekStartKeys.map((weekStartKey) => ({
      weekStartKey,
      label: formatWeekRangeLabel(weekStartKey),
      optionCount: slots.filter((slot) => slot.weekStartKey === weekStartKey).length,
    })),
    selectedWeekStartKey,
    days,
    startHour,
    endHour,
    totalMinutes: (endHour - startHour) * 60,
    hourTicks,
  }
}

/**
 * @param {unknown} containerWidth
 */
export function publicBookingDayViewCount(containerWidth) {
  const width = Number(containerWidth)
  if (!Number.isFinite(width) || width <= 0) return 7
  if (width < 520) return 1
  if (width < 840) return 3
  return 7
}

/**
 * @template T
 * @param {T[]} days
 * @param {unknown} viewCount
 * @param {unknown} requestedStartIndex
 */
export function visibleSequenceDays(days, viewCount, requestedStartIndex = 0) {
  const dayList = Array.isArray(days) ? days : []
  if (dayList.length === 0) {
    return {
      days: [],
      startIndex: 0,
      viewCount: 0,
      canPageBackward: false,
      canPageForward: false,
    }
  }

  const parsedViewCount = Number(viewCount)
  const safeViewCount = Math.min(
    dayList.length,
    Math.max(1, Number.isFinite(parsedViewCount) ? Math.trunc(parsedViewCount) : 7),
  )
  const parsedStartIndex = Number(requestedStartIndex)
  const maxStartIndex = Math.max(0, dayList.length - safeViewCount)
  const safeStartIndex = Math.min(
    Math.max(0, Number.isFinite(parsedStartIndex) ? Math.trunc(parsedStartIndex) : 0),
    maxStartIndex,
  )

  return {
    days: dayList.slice(safeStartIndex, safeStartIndex + safeViewCount),
    startIndex: safeStartIndex,
    viewCount: safeViewCount,
    canPageBackward: safeStartIndex > 0,
    canPageForward: safeStartIndex + safeViewCount < dayList.length,
  }
}
