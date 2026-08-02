export const DNA_SOURCE_BACKGROUND_COLOR = "hsl(210 80% 12%)"
export const DNA_SOURCE_CONNECTOR_COLOR = "#ffffff"
export const DNA_SOURCE_OUTLINE_COLOR = "#000000"
export const DNA_SOURCE_NODE_ROLE_COLORS = Object.freeze([
  "hsl(44 98% 60%)",
  "hsl(197 50% 44%)",
  // Guanine intentionally uses the approved white source role.
  "hsl(300 100% 100%)",
  "hsl(331 76% 50%)",
])

export const DEFAULT_DNA_BACKGROUND_OPTIONS = Object.freeze({
  strandCount: 70,
  showBaseLetters: false,
  nodeMotionSpeed: 0.06,
  strandRotationSpeed: 0.02,
  strandAngle: 30,
  scale: 0.5,
  positionX: 0,
  positionY: 0,
  strandSpacing: 0.5,
  connectorWidth: 94,
  connectorThickness: 15,
  outlineThickness: 0.1,
})

export const DNA_SOURCE_GEOMETRY = Object.freeze({
  widthVmin: 26,
  minimumHeightVmin: 240,
  viewportHeightVmax: 230,
})

export const DNA_OPTION_BOUNDS = Object.freeze({
  strandCount: Object.freeze({ minimum: 7, maximum: 81, integer: true }),
  nodeMotionSpeed: Object.freeze({ minimum: 0.01, maximum: 3 }),
  strandRotationSpeed: Object.freeze({ minimum: 0.01, maximum: 3 }),
  strandAngle: Object.freeze({ minimum: -180, maximum: 180 }),
  scale: Object.freeze({ minimum: 0.4, maximum: 1.2 }),
  positionX: Object.freeze({ minimum: -35, maximum: 35 }),
  positionY: Object.freeze({ minimum: -35, maximum: 35 }),
  strandSpacing: Object.freeze({ minimum: 0, maximum: 2 }),
  connectorWidth: Object.freeze({ minimum: 60, maximum: 100 }),
  connectorThickness: Object.freeze({ minimum: 10, maximum: 60 }),
  outlineThickness: Object.freeze({ minimum: 0, maximum: 1.5 }),
})

const CHIMER_SETTING_KEYS = Object.freeze({
  strandCount: "massageLabDnaStrandCount",
  showBaseLetters: "massageLabDnaShowBaseLetters",
  nodeMotionSpeed: "massageLabDnaNodeMotionSpeed",
  strandRotationSpeed: "massageLabDnaStrandRotationSpeed",
  strandAngle: "massageLabDnaStrandAngle",
  scale: "massageLabDnaScale",
  positionX: "massageLabDnaPositionX",
  positionY: "massageLabDnaPositionY",
  strandSpacing: "massageLabDnaStrandSpacing",
  connectorWidth: "massageLabDnaConnectorWidth",
  connectorThickness: "massageLabDnaConnectorThickness",
  outlineThickness: "massageLabDnaOutlineThickness",
})

/** Flat Chimer defaults derived from the canonical DNA option object. */
export const DEFAULT_DNA_CHIMER_SETTINGS = Object.freeze(
  Object.fromEntries(
    Object.entries(CHIMER_SETTING_KEYS).map(([key, settingKey]) => [
      settingKey,
      DEFAULT_DNA_BACKGROUND_OPTIONS[key],
    ]),
  ),
)

const DNA_OPTION_KEYS = Object.freeze(Object.keys(DEFAULT_DNA_BACKGROUND_OPTIONS))
const DEGREES_TO_RADIANS = Math.PI / 180
const SOURCE_PHASE_ANGLE_DEGREES = 45

/**
 * Falls back only for non-numeric data, then applies the approved finite range.
 * This makes malformed synced preferences safe without widening persisted DNA
 * options beyond the source-compatible bounds.
 */
function sanitizeDnaOption(key, value) {
  const fallback = DEFAULT_DNA_BACKGROUND_OPTIONS[key]
  if (typeof fallback === "boolean") {
    return typeof value === "boolean" ? value : fallback
  }
  const bounds = DNA_OPTION_BOUNDS[key]
  if (!Number.isFinite(value)) return fallback
  const numericValue = bounds.integer ? Math.floor(value) : value
  return Math.min(bounds.maximum, Math.max(bounds.minimum, numericValue))
}

/**
 * Normalizes a one-based strand index and total before a source phase formula.
 * Renderer callers already provide sanitized values; these guards keep exposed
 * pure helpers finite when used by tests or future callers independently.
 */
function normalizeStrandCoordinates({ oneBasedIndex, total } = {}) {
  const normalizedTotal = Number.isFinite(total) ? Math.max(1, Math.floor(total)) : DEFAULT_DNA_BACKGROUND_OPTIONS.strandCount
  const normalizedIndex = Number.isFinite(oneBasedIndex)
    ? Math.min(normalizedTotal, Math.max(1, Math.floor(oneBasedIndex)))
    : 1
  return { oneBasedIndex: normalizedIndex, total: normalizedTotal }
}

/**
 * Returns a complete, source-compatible DNA option object from untrusted data.
 * Fixed renderer geometry and runtime color/phase data are deliberately absent.
 */
export function sanitizeDnaBackgroundOptions(value) {
  const options = value && typeof value === "object" ? value : {}
  return Object.fromEntries(
    DNA_OPTION_KEYS.map((key) => [key, sanitizeDnaOption(key, options[key])]),
  )
}

/** Returns the source two-second node cycle adjusted by its bounded UI speed. */
export function getDnaNodeCycleSeconds(speed) {
  return 2 / sanitizeDnaOption("nodeMotionSpeed", speed)
}

/** Returns the source fourteen-second whole-strand rotation adjusted by speed. */
export function getDnaStrandRotationSeconds(speed) {
  return 14 / sanitizeDnaOption("strandRotationSpeed", speed)
}

/**
 * Calculates the source CSS `sin(45deg * index / total)` expression in
 * JavaScript so rendered strands work in browsers without CSS trig support.
 */
export function getDnaStrandPhase({ oneBasedIndex, total } = {}) {
  const coordinates = normalizeStrandCoordinates({ oneBasedIndex, total })
  return Math.sin(
    DEGREES_TO_RADIANS * SOURCE_PHASE_ANGLE_DEGREES * (coordinates.oneBasedIndex / coordinates.total),
  )
}

/**
 * Preserves the source negative phase delay while keeping it in sync with the
 * effective node cycle, not the independent whole-strand rotation speed.
 */
export function getDnaStrandDelaySeconds({ oneBasedIndex, total, speed } = {}) {
  return -getDnaStrandPhase({ oneBasedIndex, total }) * getDnaNodeCycleSeconds(speed)
}

export const DNA_BASE_PAIRS = Object.freeze([
  Object.freeze(["A", "T"]),
  Object.freeze(["T", "A"]),
  Object.freeze(["G", "C"]),
  Object.freeze(["C", "G"]),
])

/**
 * Gives each nucleotide one stable palette role. Letter visibility is purely
 * presentational, so the same A/T/G/C color teaching cue remains when labels
 * are hidden.
 */
export const DNA_BASE_ROLE_INDEX = Object.freeze({ A: 0, T: 1, G: 2, C: 3 })

/**
 * Builds one biologically valid base pair per rung and derives each node's
 * palette role from its nucleotide identity. Pair selection remains transient
 * and mount-stable; base-to-color meaning is deterministic.
 */
export function createDnaStrandAssignments(strandCount, random = Math.random) {
  const count = Number.isFinite(strandCount) ? Math.max(0, Math.floor(strandCount)) : 0
  const chooseIndex = (length) => {
    const value = random()
    const normalizedValue = Number.isFinite(value)
      ? Math.min(1 - Number.EPSILON, Math.max(0, value))
      : 0
    return Math.floor(normalizedValue * length)
  }

  return Array.from({ length: count }, () => {
    const [startBase, endBase] = DNA_BASE_PAIRS[chooseIndex(DNA_BASE_PAIRS.length)]
    return Object.freeze({
      startBase,
      endBase,
      startRole: DNA_BASE_ROLE_INDEX[startBase],
      endRole: DNA_BASE_ROLE_INDEX[endBase],
    })
  })
}

/**
 * Reads the flat Chimer preference shape and returns a full sanitized DNA
 * configuration. Palette fields and derived runtime data are not read here.
 */
export function getDnaBackgroundOptionsFromChimerSettings(settings) {
  const source = settings && typeof settings === "object" ? settings : {}
  return sanitizeDnaBackgroundOptions(
    Object.fromEntries(DNA_OPTION_KEYS.map((key) => [key, source[CHIMER_SETTING_KEYS[key]]])),
  )
}

/**
 * Converts a partial UI edit to only its known flat Chimer settings. It does
 * not sanitize so a draft can retain the exact UI edit until its normal commit
 * pipeline validates it, and it never serializes colors or runtime derivations.
 */
export function toDnaChimerSettingsPatch(patch) {
  const source = patch && typeof patch === "object" ? patch : {}
  return Object.fromEntries(
    DNA_OPTION_KEYS.flatMap((key) =>
      Object.prototype.hasOwnProperty.call(source, key) ? [[CHIMER_SETTING_KEYS[key], source[key]]] : [],
    ),
  )
}
