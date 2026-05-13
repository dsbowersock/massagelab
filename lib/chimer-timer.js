export const CHIMER_STORAGE_KEY = "massagelab-chimer-settings"

export const DEFAULT_CHIMER_SETTINGS = Object.freeze({
  hours: 0,
  minutes: 0,
  intervalType: "preset",
  customInterval: 15,
  areasToMassage: 4,
  alertType: "chime",
  movingBackgroundEnabled: true,
  keepTimerScreenAwake: true,
  showTimerSeconds: true,
  showCurrentTimeSeconds: false,
  timeFormat: "12h",
  primaryFontColor: "#FFFFFF",
  secondaryFontColor: "#FF7A1A",
  clockModeFontColor: "#FFFFFF",
  movingBackgroundMainColor: "#FF8C2A",
  movingBackgroundOrbColor: "#4169E1",
})

export const MAX_CHIMER_DURATION_MS = (23 * 60 + 59) * 60 * 1000

export function normalizeHexColor(value, fallback) {
  if (typeof value !== "string") {
    return fallback
  }

  const trimmed = value.trim()
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed.toUpperCase() : fallback
}

export function normalizeInteger(value, fallback, min, max) {
  const number = Number(value)
  if (!Number.isFinite(number)) {
    return fallback
  }

  const integer = Math.trunc(number)
  return Math.min(Math.max(integer, min), max)
}

export function normalizeDuration(hours, minutes) {
  const normalizedHours = normalizeInteger(hours, DEFAULT_CHIMER_SETTINGS.hours, 0, 23)
  const minuteNumber = Number(minutes)

  if (!Number.isFinite(minuteNumber)) {
    return {
      hours: normalizedHours,
      minutes: DEFAULT_CHIMER_SETTINGS.minutes,
    }
  }

  const integerMinutes = Math.trunc(minuteNumber)

  if (integerMinutes >= 60) {
    const totalMinutes = Math.min(normalizedHours * 60 + integerMinutes, 23 * 60 + 59)
    return {
      hours: Math.floor(totalMinutes / 60),
      minutes: totalMinutes % 60,
    }
  }

  return {
    hours: normalizedHours,
    minutes: normalizeInteger(integerMinutes, DEFAULT_CHIMER_SETTINGS.minutes, 0, 59),
  }
}

export function getTotalTimerMs(hours, minutes) {
  const { hours: normalizedHours, minutes: normalizedMinutes } = normalizeDuration(hours, minutes)
  return (normalizedHours * 60 + normalizedMinutes) * 60 * 1000
}

export function clampActiveTimerMs(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) {
    return 0
  }

  return Math.min(Math.max(Math.trunc(number), 0), MAX_CHIMER_DURATION_MS)
}

export function formatDurationParts(timeInMs, settings = {}) {
  const clamped = Math.max(0, Math.ceil(timeInMs / 1000) * 1000)
  const showSeconds = settings.showTimerSeconds !== false

  if (!showSeconds) {
    const totalMinutes = Math.floor(clamped / 60_000)
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60

    return {
      hours: hours.toString().padStart(2, "0"),
      minutes: minutes.toString().padStart(2, "0"),
      seconds: "",
    }
  }

  const totalSeconds = Math.floor(clamped / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return {
    hours: hours.toString().padStart(2, "0"),
    minutes: minutes.toString().padStart(2, "0"),
    seconds: seconds.toString().padStart(2, "0"),
  }
}

export function normalizeTimeFormat(input) {
  if (input === "12h" || input === "24h") {
    return input
  }

  if (input === undefined && arguments.length > 1) {
    return arguments[1]
  }

  return DEFAULT_CHIMER_SETTINGS.timeFormat
}

export function formatCurrentTimeParts(date = new Date(), settings = {}, locale = undefined) {
  const timeFormat = normalizeTimeFormat(
    settings.timeFormat,
    settings.showCurrentTimeAmPm === false ? "24h" : DEFAULT_CHIMER_SETTINGS.timeFormat,
  )
  const options = {
    hour: "2-digit",
    minute: "2-digit",
    hour12: timeFormat === "12h",
  }

  if (settings.showCurrentTimeSeconds === true) {
    options.second = "2-digit"
  }

  const parts = new Intl.DateTimeFormat(locale, options).formatToParts(date)
  const meridiem = timeFormat === "12h"
    ? parts.find((part) => part.type === "dayPeriod")?.value ?? ""
    : ""
  const time = parts
    .filter((part) => part.type !== "dayPeriod")
    .map((part) => part.value)
    .join("")
    .trim()

  return {
    time,
    meridiem,
  }
}

export function getIntervalMs(settings, totalDurationMs) {
  if (!settings || totalDurationMs <= 0) {
    return null
  }

  if (settings.intervalType === "areas") {
    const areas = normalizeInteger(settings.areasToMassage, DEFAULT_CHIMER_SETTINGS.areasToMassage, 1, 24)
    return Math.max(1000, Math.floor(totalDurationMs / areas))
  }

  if (settings.intervalType === "preset" || settings.intervalType === "custom") {
    const minutes = normalizeInteger(settings.customInterval, DEFAULT_CHIMER_SETTINGS.customInterval, 1, 240)
    return minutes * 60 * 1000
  }

  return null
}

export function getActiveTimerAlertSchedule({ status, now, remainingMs, intervalMs }) {
  const clampedRemainingMs = clampActiveTimerMs(remainingMs)
  const normalizedIntervalMs = clampActiveTimerMs(intervalMs)
  const shouldSchedule = normalizedIntervalMs > 0 && normalizedIntervalMs < clampedRemainingMs

  return {
    nextAlertAtMs: status === "running" && shouldSchedule ? now + normalizedIntervalMs : null,
    msUntilNextAlert: status === "paused" && shouldSchedule ? normalizedIntervalMs : null,
  }
}

export function sanitizeChimerSettings(input = {}) {
  const fallback = DEFAULT_CHIMER_SETTINGS
  const duration = normalizeDuration(input.hours, input.minutes)
  const intervalType = ["preset", "custom", "areas"].includes(input.intervalType)
    ? input.intervalType
    : fallback.intervalType
  const alertType = ["chime", "flash", "both", "silent"].includes(input.alertType)
    ? input.alertType
    : fallback.alertType
  const timeFormat = normalizeTimeFormat(
    input.timeFormat,
    input.showCurrentTimeAmPm === false ? "24h" : fallback.timeFormat,
  )

  return {
    hours: duration.hours,
    minutes: duration.minutes,
    intervalType,
    customInterval: normalizeInteger(input.customInterval, fallback.customInterval, 1, 240),
    areasToMassage: normalizeInteger(input.areasToMassage, fallback.areasToMassage, 1, 24),
    alertType,
    movingBackgroundEnabled:
      typeof input.movingBackgroundEnabled === "boolean" ? input.movingBackgroundEnabled : fallback.movingBackgroundEnabled,
    keepTimerScreenAwake:
      typeof input.keepTimerScreenAwake === "boolean" ? input.keepTimerScreenAwake : fallback.keepTimerScreenAwake,
    showTimerSeconds:
      typeof input.showTimerSeconds === "boolean" ? input.showTimerSeconds : fallback.showTimerSeconds,
    showCurrentTimeSeconds:
      typeof input.showCurrentTimeSeconds === "boolean" ? input.showCurrentTimeSeconds : fallback.showCurrentTimeSeconds,
    timeFormat,
    primaryFontColor: normalizeHexColor(input.primaryFontColor, fallback.primaryFontColor),
    secondaryFontColor: normalizeHexColor(input.secondaryFontColor, fallback.secondaryFontColor),
    clockModeFontColor: normalizeHexColor(input.clockModeFontColor, fallback.clockModeFontColor),
    movingBackgroundMainColor: normalizeHexColor(input.movingBackgroundMainColor, fallback.movingBackgroundMainColor),
    movingBackgroundOrbColor: normalizeHexColor(input.movingBackgroundOrbColor, fallback.movingBackgroundOrbColor),
  }
}
