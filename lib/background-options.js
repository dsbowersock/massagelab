// @ts-check

export const DEFAULT_BACKGROUND_ID = "massage-lab-moving-gradient"

export const BACKGROUND_STORAGE_KEYS = Object.freeze({
  chimer: "massagelab.chimer.background",
  music: "massagelab.music.background",
})

export const ACTIVE_BACKGROUND_IDS = Object.freeze([
  DEFAULT_BACKGROUND_ID,
  "static-gradient",
  "magic-particles",
  "magic-noise-texture",
  "magic-grid-pattern",
  "magic-animated-grid",
  "chamaac-waves",
  "chamaac-electric-mist",
  "chamaac-light-speed",
  "chamaac-synthesis",
  "aceternity-aurora",
  "aceternity-dotted-glow",
  "aceternity-sparkles",
  "aceternity-gradient-animation",
  "aceternity-background-beams",
  "aceternity-background-beams-collision",
  "aceternity-background-lines",
  "aceternity-glowing-stars",
  "aceternity-meteors",
  "aceternity-shooting-stars",
  "aceternity-canvas-reveal-dots",
  "aceternity-spotlight-new",
  "aceternity-lamp-effect",
  "aceternity-vortex",
  "aceternity-wavy-background",
  "unlumen-pixel-liquid",
  "massage-lab-tile-grid",
  "massage-lab-hex-grid",
  "unlumen-aurora-bars",
  "animate-ui-bubble",
  "animate-ui-gradient",
  "animate-ui-stars",
  "animate-ui-hole",
])

/** @type {readonly string[]} */
export const DISABLED_BACKGROUND_IDS = Object.freeze([])

export const BACKGROUND_IDS = Object.freeze([
  ...ACTIVE_BACKGROUND_IDS,
  ...DISABLED_BACKGROUND_IDS,
])

const BACKGROUND_ID_SET = new Set(BACKGROUND_IDS)

/**
 * @param {unknown} value
 * @returns {value is string}
 */
export function isBackgroundId(value) {
  return typeof value === "string" && BACKGROUND_ID_SET.has(value)
}

/**
 * @param {unknown} value
 * @param {string} [fallback]
 */
export function normalizeBackgroundId(value, fallback = DEFAULT_BACKGROUND_ID) {
  return isBackgroundId(value) ? value : fallback
}
