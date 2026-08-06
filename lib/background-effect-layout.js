const DEFAULT_SCALE = 1
const MINIMUM_SCALE = 0.1
const DEFAULT_POSITION = 0

/**
 * Clamps a finite rendering value while keeping invalid host data from making an
 * effect disappear. Stored preferences are intentionally never modified here.
 */
export function clampEffectiveValue(value, minimum, maximum, fallback) {
  if (!Number.isFinite(value)) {
    return Math.min(maximum, Math.max(minimum, fallback))
  }
  return Math.min(maximum, Math.max(minimum, value))
}

/** Clamps one persisted numeric option, applying integer semantics after fallback. */
export function clampBoundedBackgroundOption(value, bounds, fallback) {
  const selectedValue = Number.isFinite(value) ? value : fallback
  const numericValue = bounds.integer ? Math.floor(selectedValue) : selectedValue
  return Math.min(bounds.maximum, Math.max(bounds.minimum, numericValue))
}

/** Floors and bounds an untrusted renderer count, failing closed to inert DOM. */
export function resolveRenderCount(value, maximum) {
  if (!Number.isFinite(value)) return 0
  return Math.min(maximum, Math.max(0, Math.floor(value)))
}

/**
 * Resolves viewport-only transform bounds shared by native background effects.
 * The host owns viewport observation and supplies `compactViewport`, so this
 * DOM-free helper can preserve stored preferences for a later larger viewport.
 * @param {{
 *   scale?: number,
 *   positionX?: number,
 *   positionY?: number,
 *   compactViewport?: boolean,
 *   minimumScale?: number,
 * }} [options]
 * @returns {{scale: number, positionX: number, positionY: number}} A transform
 * whose minimum scale is clamped to the active viewport maximum before the
 * requested scale and positions are resolved.
 */
export function resolveResponsiveBackgroundTransform(options = {}) {
  const {
    scale,
    positionX,
    positionY,
    compactViewport,
    minimumScale = MINIMUM_SCALE,
  } = options
  const compact = compactViewport === true
  const maximumScale = compact ? 1 : 1.2
  const maximumPosition = compact ? 20 : 35
  const resolvedMinimumScale = clampEffectiveValue(
    minimumScale,
    Number.EPSILON,
    maximumScale,
    MINIMUM_SCALE,
  )

  return {
    scale: clampEffectiveValue(scale, resolvedMinimumScale, maximumScale, DEFAULT_SCALE),
    positionX: clampEffectiveValue(positionX, -maximumPosition, maximumPosition, DEFAULT_POSITION),
    positionY: clampEffectiveValue(positionY, -maximumPosition, maximumPosition, DEFAULT_POSITION),
  }
}
