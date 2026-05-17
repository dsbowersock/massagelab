// @ts-check

/**
 * @param {{
 *   prefersReducedMotion: boolean
 *   compactViewport: boolean
 *   documentHidden: boolean
 * }} input
 */
export function shouldAnimateAmbientBackground({
  prefersReducedMotion,
  compactViewport,
  documentHidden,
}) {
  return !prefersReducedMotion && !compactViewport && !documentHidden
}
