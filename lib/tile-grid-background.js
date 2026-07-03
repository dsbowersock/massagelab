export const TILE_GRID_FADE_SECONDS_MIN = 0.25
export const TILE_GRID_FADE_SECONDS_MAX = 23 * 60 * 60 + 59 * 60 + 59.9
export const TILE_GRID_FADE_SECONDS_DEFAULT = 1.2

export function clampTileGridFadeSeconds(value, fallback = TILE_GRID_FADE_SECONDS_DEFAULT) {
  const number = Number(value)

  if (!Number.isFinite(number)) {
    return fallback
  }

  return Math.min(Math.max(number, TILE_GRID_FADE_SECONDS_MIN), TILE_GRID_FADE_SECONDS_MAX)
}

export function splitTileGridFadeSeconds(value) {
  const totalSeconds = clampTileGridFadeSeconds(value)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds - hours * 3600) / 60)
  const seconds = roundFadeSeconds(totalSeconds - hours * 3600 - minutes * 60)

  return { hours, minutes, seconds }
}

export function combineTileGridFadeParts({ hours = 0, minutes = 0, seconds = 0 }, fallback = TILE_GRID_FADE_SECONDS_DEFAULT) {
  const normalizedHours = normalizeIntegerPart(hours, 0, 23)
  const normalizedMinutes = normalizeIntegerPart(minutes, 0, 59)
  const normalizedSeconds = normalizeNumberPart(seconds, 0, 59.9)

  return roundFadeSeconds(clampTileGridFadeSeconds(
    normalizedHours * 3600 + normalizedMinutes * 60 + normalizedSeconds,
    fallback,
  ))
}

export function formatTileGridFadeDuration(value) {
  const { hours, minutes, seconds } = splitTileGridFadeSeconds(value)
  const secondsLabel = formatSeconds(seconds)

  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m ${secondsLabel}s`
  }

  if (minutes > 0) {
    return `${minutes}m ${secondsLabel}s`
  }

  return `${secondsLabel}s`
}

function normalizeIntegerPart(value, min, max) {
  const number = Number(value)

  if (!Number.isFinite(number)) {
    return min
  }

  return Math.min(Math.max(Math.trunc(number), min), max)
}

function normalizeNumberPart(value, min, max) {
  const number = Number(value)

  if (!Number.isFinite(number)) {
    return min
  }

  return Math.min(Math.max(number, min), max)
}

function roundFadeSeconds(value) {
  return Math.round(value * 10) / 10
}

function formatSeconds(value) {
  const rounded = roundFadeSeconds(value)
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}
