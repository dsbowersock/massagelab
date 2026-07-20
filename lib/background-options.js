// @ts-check

export const DEFAULT_BACKGROUND_ID = "massage-lab-moving-gradient"

export const BACKGROUND_STORAGE_KEYS = Object.freeze({
  chimer: "massagelab.chimer.background",
  /** @deprecated Read-only legacy migration key; new Music state belongs in Atmosphere v2. */
  music: "massagelab.music.background",
})

export const ACTIVE_BACKGROUND_IDS = Object.freeze([
  DEFAULT_BACKGROUND_ID,
  "static-gradient",
  "massage-lab-particles-draft",
  "massage-lab-noise-texture-draft",
  "massage-lab-grid-pattern-draft",
  "massage-lab-animated-grid-draft",
  "massage-lab-retro-grid",
  "massage-lab-aerial-rays",
  "massage-lab-wave-current",
  "massage-lab-electric-mist",
  "massage-lab-astral-flow",
  "massage-lab-deep-space-nebula",
  "massage-lab-grid-bloom",
  "massage-lab-chrome-flow",
  "massage-lab-light-speed",
  "massage-lab-synthesis",
  "massage-lab-ferrofluid",
  "massage-lab-lightfall",
  "massage-lab-liquid-ether",
  "massage-lab-prism",
  "massage-lab-dark-veil",
  "massage-lab-light-pillar",
  "massage-lab-silk",
  "massage-lab-floating-lines",
  "massage-lab-side-rays",
  "massage-lab-light-rays",
  "massage-lab-pixel-blast",
  "massage-lab-color-bends",
  "massage-lab-evil-eye",
  "massage-lab-line-waves",
  "massage-lab-radar",
  "massage-lab-soft-aurora",
  "massage-lab-plasma",
  "massage-lab-plasma-wave",
  "massage-lab-particles",
  "massage-lab-gradient-blinds",
  "massage-lab-grainient",
  "massage-lab-grid-scan",
  "massage-lab-beams",
  "massage-lab-pixel-snow",
  "massage-lab-lightning",
  "massage-lab-prismatic-burst",
  "massage-lab-galaxy",
  "massage-lab-dither",
  "massage-lab-faulty-terminal",
  "massage-lab-ripple-grid",
  "massage-lab-dot-field",
  "massage-lab-dot-grid",
  "massage-lab-threads",
  "massage-lab-iridescence",
  "massage-lab-waves",
  "massage-lab-grid-distortion",
  "massage-lab-orb",
  "massage-lab-letter-glitch",
  "massage-lab-grid-motion",
  "massage-lab-shape-grid",
  "massage-lab-liquid-chrome",
  "massage-lab-balatro",
  "massage-lab-novatrix",
  "massage-lab-matrix-rain",
  "massage-lab-photon-beam",
  "massage-lab-3d-globe",
  "massage-lab-aurora",
  "massage-lab-dotted-glow",
  "massage-lab-sparkles",
  "massage-lab-gradient-animation",
  "massage-lab-background-beams",
  "massage-lab-collision-beams",
  "massage-lab-background-lines",
  "massage-lab-glowing-stars",
  "massage-lab-meteors",
  "massage-lab-shooting-stars",
  "massage-lab-reveal-dots",
  "massage-lab-spotlight",
  "massage-lab-lamp-effect",
  "massage-lab-vortex",
  "massage-lab-wavy-background",
  "massage-lab-pixel-liquid",
  "massage-lab-tile-grid",
  "massage-lab-hex-grid",
  "massage-lab-aurora-bars",
  "massage-lab-bubble",
  "massage-lab-gradient",
  "massage-lab-stars",
  "massage-lab-hole",
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
