/**
 * These renderers paint their own patterned field. Their registry fallback is
 * useful before lazy mount, but duplicates the visible active renderer after it
 * mounts, including when that renderer is static for reduced motion.
 */
export const PATTERNED_ACTIVE_RENDERER_IDS: ReadonlySet<string> = new Set([
  "massage-lab-ripple-grid",
  "massage-lab-dot-field",
  "massage-lab-dot-grid",
  "massage-lab-shape-grid",
])

/** Preserves non-mounted fallbacks and limits underlay suppression to proven duplicate patterns. */
export function shouldRenderBackgroundFallbackUnderlay({
  backgroundId,
  effectMounted,
}: {
  backgroundId: string
  effectMounted: boolean
}): boolean {
  return !effectMounted || !PATTERNED_ACTIVE_RENDERER_IDS.has(backgroundId)
}
