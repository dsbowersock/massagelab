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
  "magicui-retro-grid",
  "magicui-light-rays",
  "chamaac-waves",
  "chamaac-electric-mist",
  "chamaac-astral-flow",
  "chamaac-deep-space-nebula",
  "chamaac-grid-bloom",
  "chamaac-liquid-chrome",
  "chamaac-light-speed",
  "chamaac-synthesis",
  "react-bits-ferrofluid",
  "react-bits-lightfall",
  "react-bits-liquid-ether",
  "react-bits-prism",
  "react-bits-dark-veil",
  "react-bits-light-pillar",
  "react-bits-silk",
  "react-bits-floating-lines",
  "react-bits-side-rays",
  "react-bits-light-rays",
  "react-bits-pixel-blast",
  "react-bits-color-bends",
  "react-bits-evil-eye",
  "react-bits-line-waves",
  "react-bits-radar",
  "react-bits-soft-aurora",
  "react-bits-plasma",
  "react-bits-plasma-wave",
  "react-bits-particles",
  "react-bits-gradient-blinds",
  "react-bits-grainient",
  "react-bits-grid-scan",
  "react-bits-beams",
  "react-bits-pixel-snow",
  "react-bits-lightning",
  "react-bits-prismatic-burst",
  "react-bits-galaxy",
  "react-bits-dither",
  "react-bits-faulty-terminal",
  "react-bits-ripple-grid",
  "react-bits-dot-field",
  "react-bits-dot-grid",
  "react-bits-threads",
  "eldora-novatrix-background",
  "eldora-hacker-background",
  "eldora-photon-beam",
  "aceternity-3d-globe",
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
