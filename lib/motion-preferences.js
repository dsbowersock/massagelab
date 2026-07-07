// @ts-check

export const AMBIENT_MOTION_MODES = Object.freeze(["system", "reduced"])

/**
 * Chimer visual backgrounds are an explicit route-level opt-in: users turn on a
 * background for an active treatment-room view or for preview generation. The
 * app-level reduced motion setting still wins, but this prevents the browser or
 * OS signal from silently replacing every selected background with a static
 * fallback.
 */
function isRouteOwnedAmbientMotionActive() {
  if (typeof document === "undefined" || !document.body?.classList) {
    return false
  }

  return document.body.classList.contains("chimer-running")
    || document.body.classList.contains("chimer-alerting")
    || document.body.classList.contains("chimer-preview-capture")
}

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
 *   forceMotion?: boolean
 * }} input
 */
export function shouldReduceAmbientMotion({
  prefersReducedMotion,
  ambientMotionMode = "system",
  forceMotion = false,
}) {
  if (normalizeAmbientMotionMode(ambientMotionMode) === "reduced") {
    return true
  }

  return prefersReducedMotion && !forceMotion && !isRouteOwnedAmbientMotionActive()
}

/**
 * @param {{
 *   prefersReducedMotion: boolean
 *   compactViewport: boolean
 *   documentHidden: boolean
 *   allowCompactViewport?: boolean
 *   ambientMotionMode?: unknown
 *   forceMotion?: boolean
 * }} input
 */
export function shouldAnimateAmbientBackground({
  prefersReducedMotion,
  compactViewport,
  documentHidden,
  allowCompactViewport = false,
  ambientMotionMode = "system",
  forceMotion = false,
}) {
  return !shouldReduceAmbientMotion({ prefersReducedMotion, ambientMotionMode, forceMotion })
    && (!compactViewport || allowCompactViewport)
    && !documentHidden
}
