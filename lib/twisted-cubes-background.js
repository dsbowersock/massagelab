import { clampBoundedBackgroundOption } from "./background-effect-layout.js"

export const DEFAULT_TWISTED_CUBES_BACKGROUND_OPTIONS = Object.freeze({
  layerCount: 20,
  rotationSpeed: 0.25,
  layerStagger: 0.1,
  viewAngleX: -35,
  viewAngleY: -45,
  scale: 0.3,
  positionX: 0,
  positionY: 0,
  layerDepthSpacing: 50,
  opacityFalloff: 0.85,
  outlineThickness: 0.0075,
})

export const TWISTED_CUBES_SOURCE_BACKGROUND_COLOR = "hsl(210 20% 12%)"
/** @type {readonly [string, string, string, string, string, string]} */
export const TWISTED_CUBES_SOURCE_OUTLINE_ANCHORS = Object.freeze([
  "hsl(180 80% 60%)",
  "hsl(212 80% 60%)",
  "hsl(244 80% 60%)",
  "hsl(276 80% 60%)",
  "hsl(308 80% 60%)",
  "hsl(340 80% 60%)",
])

// Twenty layers at the approved 30% default reach 120vmax, keeping the field
// full-bleed without divorcing the Scale control from the rendered geometry.
export const TWISTED_CUBES_LAYER_STEP_VMAX = 20

export const TWISTED_CUBES_OPTION_BOUNDS = Object.freeze({
  layerCount: Object.freeze({ minimum: 6, maximum: 30, integer: true }),
  rotationSpeed: Object.freeze({ minimum: 0.01, maximum: 3 }),
  layerStagger: Object.freeze({ minimum: 0, maximum: 0.3 }),
  viewAngleX: Object.freeze({ minimum: -80, maximum: 80 }),
  viewAngleY: Object.freeze({ minimum: -80, maximum: 80 }),
  scale: Object.freeze({ minimum: 0.1, maximum: 1.2 }),
  positionX: Object.freeze({ minimum: -35, maximum: 35 }),
  positionY: Object.freeze({ minimum: -35, maximum: 35 }),
  layerDepthSpacing: Object.freeze({ minimum: 10, maximum: 70 }),
  opacityFalloff: Object.freeze({ minimum: 0, maximum: 0.95 }),
  outlineThickness: Object.freeze({ minimum: 0.0025, maximum: 0.02 }),
})

const CHIMER_SETTING_KEYS = Object.freeze({
  layerCount: "massageLabTwistedCubesLayerCount",
  rotationSpeed: "massageLabTwistedCubesRotationSpeed",
  layerStagger: "massageLabTwistedCubesLayerStagger",
  viewAngleX: "massageLabTwistedCubesViewAngleX",
  viewAngleY: "massageLabTwistedCubesViewAngleY",
  scale: "massageLabTwistedCubesScale",
  positionX: "massageLabTwistedCubesPositionX",
  positionY: "massageLabTwistedCubesPositionY",
  layerDepthSpacing: "massageLabTwistedCubesLayerDepthSpacing",
  opacityFalloff: "massageLabTwistedCubesOpacityFalloff",
  outlineThickness: "massageLabTwistedCubesOutlineThickness",
})

/** Flat Chimer defaults derived from the canonical Twisted Cubes option object. */
export const DEFAULT_TWISTED_CUBES_CHIMER_SETTINGS = Object.freeze(
  Object.fromEntries(
    Object.entries(CHIMER_SETTING_KEYS).map(([key, settingKey]) => [
      settingKey,
      DEFAULT_TWISTED_CUBES_BACKGROUND_OPTIONS[key],
    ]),
  ),
)

const TWISTED_CUBES_OPTION_KEYS = Object.freeze(Object.keys(DEFAULT_TWISTED_CUBES_BACKGROUND_OPTIONS))
const HEX_COLOR_PATTERN = /^#[\da-f]{6}$/i
const HSL_COLOR_PATTERN = /^hsl\(\s*(-?\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%\s+(\d+(?:\.\d+)?)%\s*\)$/i
const SOURCE_OUTLINE_START_DEGREES = 180
const SOURCE_OUTLINE_END_DEGREES = 340
const OUTLINE_ANCHOR_COUNT = 6
const OUTLINE_SEGMENT_COUNT = OUTLINE_ANCHOR_COUNT - 1

/** Applies the approved finite preference bound without serializing derived values. */
function sanitizeTwistedCubesOption(key, value) {
  const fallback = DEFAULT_TWISTED_CUBES_BACKGROUND_OPTIONS[key]
  return clampBoundedBackgroundOption(value, TWISTED_CUBES_OPTION_BOUNDS[key], fallback)
}

/**
 * Guards exposed per-layer helpers independently from the renderer. Layer
 * count is not clamped to the UI range here so callers retain count-relative
 * timing for any finite render-safe count.
 */
function normalizeLayerCoordinates({ oneBasedIndex, count } = {}) {
  const normalizedCount = Number.isFinite(count)
    ? Math.max(1, Math.floor(count))
    : DEFAULT_TWISTED_CUBES_BACKGROUND_OPTIONS.layerCount
  const normalizedIndex = Number.isFinite(oneBasedIndex)
    ? Math.min(normalizedCount, Math.max(1, Math.floor(oneBasedIndex)))
    : 1
  return { oneBasedIndex: normalizedIndex, count: normalizedCount }
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value))
}

function parseHexColor(value) {
  if (typeof value !== "string" || !HEX_COLOR_PATTERN.test(value)) return null
  return {
    value,
    red: Number.parseInt(value.slice(1, 3), 16),
    green: Number.parseInt(value.slice(3, 5), 16),
    blue: Number.parseInt(value.slice(5, 7), 16),
  }
}

/** Parses the source palette's space-separated HSL form for sRGB interpolation. */
function parseHslColor(value) {
  if (typeof value !== "string") return null
  const match = HSL_COLOR_PATTERN.exec(value)
  if (!match) return null
  const hue = ((Number(match[1]) % 360) + 360) % 360
  const saturation = clamp(Number(match[2]) / 100, 0, 1)
  const lightness = clamp(Number(match[3]) / 100, 0, 1)
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation
  const intermediate = chroma * (1 - Math.abs((hue / 60) % 2 - 1))
  const [redPrime, greenPrime, bluePrime] = hue < 60
    ? [chroma, intermediate, 0]
    : hue < 120
      ? [intermediate, chroma, 0]
      : hue < 180
        ? [0, chroma, intermediate]
        : hue < 240
          ? [0, intermediate, chroma]
          : hue < 300
            ? [intermediate, 0, chroma]
            : [chroma, 0, intermediate]
  const offset = lightness - chroma / 2
  return {
    value,
    red: Math.round((redPrime + offset) * 255),
    green: Math.round((greenPrime + offset) * 255),
    blue: Math.round((bluePrime + offset) * 255),
  }
}

function parseInterpolatedColor(value) {
  return parseHexColor(value) ?? parseHslColor(value)
}

/**
 * Resolves the six colors supplied by the palette adapter. Invalid Custom or
 * Harmony entries fall back to that adapter's corresponding source anchor;
 * this pure module never owns or persists a second palette.
 */
function resolveOutlineAnchors(anchors, sourceAnchors) {
  const fallbackSourceAnchors = sourceAnchors ?? TWISTED_CUBES_SOURCE_OUTLINE_ANCHORS
  return Array.from({ length: OUTLINE_ANCHOR_COUNT }, (_, index) => {
    const resolved = parseInterpolatedColor(anchors?.[index])
      ?? parseInterpolatedColor(fallbackSourceAnchors[index])
    return resolved ?? parseHexColor("#000000")
  })
}

/** Returns a complete, source-compatible Twisted Cubes option object from untrusted data. */
export function sanitizeTwistedCubesBackgroundOptions(value) {
  const options = value && typeof value === "object" ? value : {}
  return Object.fromEntries(
    TWISTED_CUBES_OPTION_KEYS.map((key) => [key, sanitizeTwistedCubesOption(key, options[key])]),
  )
}

/** Returns the source four-second rotation cycle adjusted by its bounded UI speed. */
export function getTwistedCubeCycleSeconds(speed) {
  return 4 / sanitizeTwistedCubesOption("rotationSpeed", speed)
}

/**
 * Preserves the source `(-18 + index) * 0.1s` phase at 20 layers while
 * scaling its leading negative delay with an adjustable layer count.
 */
export function getTwistedCubeDelaySeconds({ oneBasedIndex, count, stagger } = {}) {
  const coordinates = normalizeLayerCoordinates({ oneBasedIndex, count })
  const effectiveStagger = sanitizeTwistedCubesOption("layerStagger", stagger)
  return (-(coordinates.count - 2) + coordinates.oneBasedIndex) * effectiveStagger
}

/** Calculates independent depth opacity without coupling it to outline color interpolation. */
export function getTwistedCubeAlpha({ oneBasedIndex, count, opacityFalloff } = {}) {
  const coordinates = normalizeLayerCoordinates({ oneBasedIndex, count })
  const falloff = sanitizeTwistedCubesOption("opacityFalloff", opacityFalloff)
  return clamp(1 - (falloff / coordinates.count) * coordinates.oneBasedIndex, 0, 1)
}

/**
 * Applies Scale uniformly to the count-relative layer progression. At the
 * approved 20-layer, 30% default the outer wireframe reaches 120vmax, while
 * lower and higher Scale values visibly shrink or grow the complete effect.
 */
export function getTwistedCubeLayerSizeVmax({ oneBasedIndex, count, scale } = {}) {
  const coordinates = normalizeLayerCoordinates({ oneBasedIndex, count })
  const effectiveScale = sanitizeTwistedCubesOption("scale", scale)
  return TWISTED_CUBES_LAYER_STEP_VMAX * coordinates.oneBasedIndex * effectiveScale
}

/** Returns the unquantized source HSL outline value for a single cube layer. */
export function getTwistedCubeSourceOutline({ oneBasedIndex, count } = {}) {
  const coordinates = normalizeLayerCoordinates({ oneBasedIndex, count })
  const progress = coordinates.count === 1 ? 0 : (coordinates.oneBasedIndex - 1) / (coordinates.count - 1)
  const hue = SOURCE_OUTLINE_START_DEGREES
    + (SOURCE_OUTLINE_END_DEGREES - SOURCE_OUTLINE_START_DEGREES) * progress
  return `hsl(${hue} 80% 60%)`
}

/**
 * Interpolates five adjacent sRGB segments, rather than repeating six swatch
 * bands. Exact endpoints retain the adapter's validated anchor string so the
 * first and deepest layers match their resolved Custom or Harmony colors.
 */
export function interpolateTwistedCubeOutline({ anchors, sourceAnchors, oneBasedIndex, count } = {}) {
  const coordinates = normalizeLayerCoordinates({ oneBasedIndex, count })
  const resolvedAnchors = resolveOutlineAnchors(anchors, sourceAnchors)
  const progress = coordinates.count === 1 ? 0 : (coordinates.oneBasedIndex - 1) / (coordinates.count - 1)
  if (progress === 0) return resolvedAnchors[0].value
  if (progress === 1) return resolvedAnchors[OUTLINE_ANCHOR_COUNT - 1].value

  const anchorPosition = progress * OUTLINE_SEGMENT_COUNT
  const segmentIndex = Math.min(OUTLINE_SEGMENT_COUNT - 1, Math.floor(anchorPosition))
  const segmentProgress = anchorPosition - segmentIndex

  const start = resolvedAnchors[segmentIndex]
  const end = resolvedAnchors[segmentIndex + 1]
  const interpolateChannel = (channel) => Math.round(start[channel] + (end[channel] - start[channel]) * segmentProgress)
  return `rgb(${interpolateChannel("red")} ${interpolateChannel("green")} ${interpolateChannel("blue")})`
}

/** Reads flat Chimer preferences into a full sanitized Twisted Cubes configuration. */
export function getTwistedCubesBackgroundOptionsFromChimerSettings(settings) {
  const source = settings && typeof settings === "object" ? settings : {}
  return sanitizeTwistedCubesBackgroundOptions(
    Object.fromEntries(TWISTED_CUBES_OPTION_KEYS.map((key) => [key, source[CHIMER_SETTING_KEYS[key]]])),
  )
}

/**
 * Converts a partial UI edit to only known flat Chimer settings. Calculated
 * colors and alpha are deliberately excluded because they are render-time data.
 */
export function toTwistedCubesChimerSettingsPatch(patch) {
  const source = patch && typeof patch === "object" ? patch : {}
  return Object.fromEntries(
    TWISTED_CUBES_OPTION_KEYS.flatMap((key) =>
      Object.prototype.hasOwnProperty.call(source, key) ? [[CHIMER_SETTING_KEYS[key], source[key]]] : [],
    ),
  )
}
