const DEFAULT_SCALE = 1
const DEFAULT_POSITION = 0

/**
 * Clamps a finite rendering value while keeping invalid host data from making an
 * effect disappear. Stored preferences are intentionally never modified here.
 */
function clampEffectiveValue(value, minimum, maximum, fallback) {
  if (!Number.isFinite(value)) return fallback
  return Math.min(maximum, Math.max(minimum, value))
}

/**
 * Resolves viewport-only transform bounds shared by native background effects.
 * The host owns viewport observation and supplies `compactViewport`, so this
 * DOM-free helper can preserve stored preferences for a later larger viewport.
 */
export function resolveResponsiveBackgroundTransform({
  scale,
  positionX,
  positionY,
  compactViewport,
} = {}) {
  const compact = compactViewport === true
  const maximumScale = compact ? 1 : 1.2
  const maximumPosition = compact ? 20 : 35

  return {
    scale: clampEffectiveValue(scale, 0.4, maximumScale, DEFAULT_SCALE),
    positionX: clampEffectiveValue(positionX, -maximumPosition, maximumPosition, DEFAULT_POSITION),
    positionY: clampEffectiveValue(positionY, -maximumPosition, maximumPosition, DEFAULT_POSITION),
  }
}
