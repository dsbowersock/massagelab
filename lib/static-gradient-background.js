export const STATIC_GRADIENT_SOURCE_COLORS = Object.freeze([
  "#050505",
  "#26140A",
  "#FF7A1A",
  "#101318",
  "#4169E1",
  "#10182B",
  "#050505",
])

export const STATIC_GRADIENT_TYPES = Object.freeze(["linear", "radial"])
export const STATIC_GRADIENT_RADIAL_SHAPES = Object.freeze(["circle", "ellipse"])
export const STATIC_GRADIENT_RADIAL_SIZES = Object.freeze([
  "closest-side",
  "farthest-side",
  "closest-corner",
  "farthest-corner",
])

const OPTION_KEYS = Object.freeze([
  "type",
  "colorCount",
  "angle",
  "centerX",
  "centerY",
  "radialShape",
  "radialSize",
  "stopPositions",
])

const CHIMER_SETTING_KEYS = Object.freeze({
  type: "staticGradientType",
  colorCount: "staticGradientColorCount",
  angle: "staticGradientAngle",
  centerX: "staticGradientCenterX",
  centerY: "staticGradientCenterY",
  radialShape: "staticGradientRadialShape",
  radialSize: "staticGradientRadialSize",
  stopPositions: "staticGradientStopPositions",
})

function clampFiniteNumber(value, fallback, minimum, maximum) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : fallback
}

/** Returns seven persisted slots, evenly spacing only the active color stops. */
export function distributeStaticGradientStops(rawCount) {
  const count = Math.min(7, Math.max(2, Math.trunc(Number(rawCount) || 2)))
  const active = Array.from({ length: count }, (_, index) => (
    Math.round((index / (count - 1)) * 100)
  ))
  return [...active, ...Array.from({ length: 7 - count }, () => 100)]
}

export const DEFAULT_STATIC_GRADIENT_BACKGROUND_OPTIONS = Object.freeze({
  type: "linear",
  colorCount: 7,
  angle: 145,
  centerX: 50,
  centerY: 50,
  radialShape: "ellipse",
  radialSize: "farthest-corner",
  stopPositions: Object.freeze(distributeStaticGradientStops(7)),
})

export const DEFAULT_STATIC_GRADIENT_CHIMER_SETTINGS = Object.freeze(
  Object.fromEntries(OPTION_KEYS.map((key) => [
    CHIMER_SETTING_KEYS[key],
    DEFAULT_STATIC_GRADIENT_BACKGROUND_OPTIONS[key],
  ])),
)

function normalizeStopPositions(value, colorCount) {
  if (!Array.isArray(value)) {
    return distributeStaticGradientStops(colorCount)
  }

  const distributed = distributeStaticGradientStops(colorCount)
  let previous = 0
  const active = Array.from({ length: colorCount }, (_, index) => {
    const next = clampFiniteNumber(value[index], distributed[index], 0, 100)
    // CSS gradient geometry must never move backward, so each authored stop is
    // raised to its predecessor instead of reordering the user's colors.
    previous = Math.max(previous, next)
    return previous
  })
  return [...active, ...Array.from({ length: 7 - colorCount }, () => 100)]
}

/** Converts untrusted stored data into the complete supported gradient geometry. */
export function sanitizeStaticGradientBackgroundOptions(value) {
  const source = value && typeof value === "object" ? value : {}
  const colorCount = Math.trunc(clampFiniteNumber(
    source.colorCount,
    DEFAULT_STATIC_GRADIENT_BACKGROUND_OPTIONS.colorCount,
    2,
    7,
  ))

  return {
    type: STATIC_GRADIENT_TYPES.includes(source.type)
      ? source.type
      : DEFAULT_STATIC_GRADIENT_BACKGROUND_OPTIONS.type,
    colorCount,
    angle: clampFiniteNumber(source.angle, DEFAULT_STATIC_GRADIENT_BACKGROUND_OPTIONS.angle, 0, 360),
    centerX: clampFiniteNumber(source.centerX, DEFAULT_STATIC_GRADIENT_BACKGROUND_OPTIONS.centerX, 0, 100),
    centerY: clampFiniteNumber(source.centerY, DEFAULT_STATIC_GRADIENT_BACKGROUND_OPTIONS.centerY, 0, 100),
    radialShape: STATIC_GRADIENT_RADIAL_SHAPES.includes(source.radialShape)
      ? source.radialShape
      : DEFAULT_STATIC_GRADIENT_BACKGROUND_OPTIONS.radialShape,
    radialSize: STATIC_GRADIENT_RADIAL_SIZES.includes(source.radialSize)
      ? source.radialSize
      : DEFAULT_STATIC_GRADIENT_BACKGROUND_OPTIONS.radialSize,
    stopPositions: normalizeStopPositions(source.stopPositions, colorCount),
  }
}

/** Reads the flat Chimer preference shape into renderer/control geometry. */
export function getStaticGradientBackgroundOptionsFromChimerSettings(settings) {
  const source = settings && typeof settings === "object" ? settings : {}
  return sanitizeStaticGradientBackgroundOptions(Object.fromEntries(
    OPTION_KEYS.map((key) => [key, source[CHIMER_SETTING_KEYS[key]]]),
  ))
}

/** Emits only known flat Chimer keys for a Visual-draft property patch. */
export function toStaticGradientChimerSettingsPatch(patch) {
  const source = patch && typeof patch === "object" ? patch : {}
  return Object.fromEntries(OPTION_KEYS.flatMap((key) => (
    Object.prototype.hasOwnProperty.call(source, key)
      ? [[CHIMER_SETTING_KEYS[key], source[key]]]
      : []
  )))
}

function normalizeColor(value, fallback) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value)
    ? value.toUpperCase()
    : fallback
}

/** Builds the exact CSS rendered by both linear and radial Static Gradient modes. */
export function buildStaticGradientCss(value) {
  const options = sanitizeStaticGradientBackgroundOptions(value)
  const requestedColors = Array.isArray(value?.colors) ? value.colors : []
  const colors = STATIC_GRADIENT_SOURCE_COLORS.map((fallback, index) => (
    normalizeColor(requestedColors[index], fallback)
  ))
  const stops = colors.slice(0, options.colorCount).map((color, index) => (
    `${color} ${options.stopPositions[index]}%`
  )).join(", ")

  return options.type === "radial"
    ? `radial-gradient(${options.radialShape} ${options.radialSize} at ${options.centerX}% ${options.centerY}%, ${stops})`
    : `linear-gradient(${options.angle}deg, ${stops})`
}
