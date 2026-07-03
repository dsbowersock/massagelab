// @ts-check

export const AMBIENT_MOTION_MODES = Object.freeze(["system", "reduced"])

/**
 * @param {unknown} value
 */
export function normalizeAmbientMotionMode(value) {
  return value === "reduced" ? "reduced" : "system"
}

/**
 * @param {{
 *   prefersReducedMotion: boolean
 *   ambientMotionMode?: unknown
 * }} input
 */
export function shouldReduceAmbientMotion({
  prefersReducedMotion,
  ambientMotionMode = "system",
}) {
  return prefersReducedMotion || normalizeAmbientMotionMode(ambientMotionMode) === "reduced"
}

/**
 * @param {{
 *   prefersReducedMotion: boolean
 *   compactViewport: boolean
 *   documentHidden: boolean
 *   allowCompactViewport?: boolean
 *   ambientMotionMode?: unknown
 * }} input
 */
export function shouldAnimateAmbientBackground({
  prefersReducedMotion,
  compactViewport,
  documentHidden,
  allowCompactViewport = false,
  ambientMotionMode = "system",
}) {
  return !shouldReduceAmbientMotion({ prefersReducedMotion, ambientMotionMode })
    && (!compactViewport || allowCompactViewport)
    && !documentHidden
}
