export const TILE_GRID_FADE_SECONDS_MIN = 0.25
export const TILE_GRID_FADE_SECONDS_MAX = 23 * 60 * 60 + 59 * 60 + 59.9
export const TILE_GRID_FADE_SECONDS_DEFAULT = 20
export const TILE_GRID_FADE_SLIDER_MIN = 0
export const TILE_GRID_FADE_SLIDER_MAX = 100
export const TILE_GRID_FADE_SLIDER_STEP = 0.1

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

/**
 * Projects the nearly 24-hour fade domain onto a compact logarithmic slider.
 * Short fades retain fine control while minute- and hour-scale fades remain
 * reachable without changing the persisted seconds contract.
 */
export function getTileGridFadeSliderValue(value) {
  const seconds = clampTileGridFadeSeconds(value)
  const span = Math.log(TILE_GRID_FADE_SECONDS_MAX / TILE_GRID_FADE_SECONDS_MIN)
  const position = Math.log(seconds / TILE_GRID_FADE_SECONDS_MIN) / span
  return Math.round(position * TILE_GRID_FADE_SLIDER_MAX * 10) / 10
}

/** Converts the logarithmic presentation value back to persisted seconds. */
export function getTileGridFadeSecondsFromSlider(value) {
  const sliderValue = Math.min(
    Math.max(Number(value) || TILE_GRID_FADE_SLIDER_MIN, TILE_GRID_FADE_SLIDER_MIN),
    TILE_GRID_FADE_SLIDER_MAX,
  )
  if (sliderValue === TILE_GRID_FADE_SLIDER_MIN) return TILE_GRID_FADE_SECONDS_MIN
  if (sliderValue === TILE_GRID_FADE_SLIDER_MAX) return TILE_GRID_FADE_SECONDS_MAX
  const position = sliderValue / TILE_GRID_FADE_SLIDER_MAX
  const seconds = TILE_GRID_FADE_SECONDS_MIN
    * Math.pow(TILE_GRID_FADE_SECONDS_MAX / TILE_GRID_FADE_SECONDS_MIN, position)
  return roundFadeSeconds(clampTileGridFadeSeconds(seconds))
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
