export const CHIMER_STORAGE_KEY = "massagelab-chimer-settings"

export const DEFAULT_CHIMER_SETTINGS = Object.freeze({
  hours: 1,
  minutes: 0,
  intervalType: "preset",
  customInterval: 15,
  areasToMassage: 4,
  alertType: "chime",
  defaultMode: "timer",
  movingBackgroundEnabled: true,
  showCurrentTimeSeconds: false,
  showCurrentTimeAmPm: true,
  movingBackgroundMainColor: "#FF7F50",
  movingBackgroundOrbColor: "#4169E1",
})

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

export function formatDurationParts(timeInMs) {
  const clamped = Math.max(0, Math.ceil(timeInMs / 1000) * 1000)
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

export function sanitizeChimerSettings(input = {}) {
  const fallback = DEFAULT_CHIMER_SETTINGS
  const duration = normalizeDuration(input.hours, input.minutes)
  const intervalType = ["preset", "custom", "areas"].includes(input.intervalType)
    ? input.intervalType
    : fallback.intervalType
  const alertType = ["chime", "flash", "both", "silent"].includes(input.alertType)
    ? input.alertType
    : fallback.alertType
  const defaultMode = ["timer", "clock"].includes(input.defaultMode)
    ? input.defaultMode
    : fallback.defaultMode

  return {
    hours: duration.hours,
    minutes: duration.minutes,
    intervalType,
    customInterval: normalizeInteger(input.customInterval, fallback.customInterval, 1, 240),
    areasToMassage: normalizeInteger(input.areasToMassage, fallback.areasToMassage, 1, 24),
    alertType,
    defaultMode,
    movingBackgroundEnabled:
      typeof input.movingBackgroundEnabled === "boolean" ? input.movingBackgroundEnabled : fallback.movingBackgroundEnabled,
    showCurrentTimeSeconds:
      typeof input.showCurrentTimeSeconds === "boolean" ? input.showCurrentTimeSeconds : fallback.showCurrentTimeSeconds,
    showCurrentTimeAmPm:
      typeof input.showCurrentTimeAmPm === "boolean" ? input.showCurrentTimeAmPm : fallback.showCurrentTimeAmPm,
    movingBackgroundMainColor: normalizeHexColor(input.movingBackgroundMainColor, fallback.movingBackgroundMainColor),
    movingBackgroundOrbColor: normalizeHexColor(input.movingBackgroundOrbColor, fallback.movingBackgroundOrbColor),
  }
}
