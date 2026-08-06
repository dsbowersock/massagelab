/**
 * These renderers paint their own patterned field. Their registry fallback is
 * useful through lazy import and renderer initialization, but duplicates the
 * active renderer after that renderer has completed its first frame.
 */
export const PATTERNED_ACTIVE_RENDERER_IDS: ReadonlySet<string> = new Set([
  "massage-lab-ripple-grid",
  "massage-lab-dot-field",
  "massage-lab-dot-grid",
  "massage-lab-shape-grid",
])

export interface BackgroundRendererAttempt {
  backgroundId: string
  loadGeneration: number
}

export type BackgroundRendererReadinessAction = {
  attempt: BackgroundRendererAttempt
  ready: boolean
}

function isSameRendererAttempt(
  left: BackgroundRendererAttempt | null,
  right: BackgroundRendererAttempt,
): boolean {
  return left?.backgroundId === right.backgroundId
    && left.loadGeneration === right.loadGeneration
}

/**
 * Tracks the exact lazy-load generation that completed a frame. A stale
 * renderer cleanup cannot clear a newer attempt for the same background ID.
 */
export function reduceBackgroundRendererReadiness(
  currentReadyAttempt: BackgroundRendererAttempt | null,
  { attempt, ready }: BackgroundRendererReadinessAction,
): BackgroundRendererAttempt | null {
  if (ready) {
    return attempt
  }

  return isSameRendererAttempt(currentReadyAttempt, attempt)
    ? null
    : currentReadyAttempt
}

/** Preserves fallbacks until a proven duplicate renderer completes a frame. */
export function shouldRenderBackgroundFallbackUnderlay({
  backgroundId,
  effectReady,
}: {
  backgroundId: string
  effectReady: boolean
}): boolean {
  return !effectReady || !PATTERNED_ACTIVE_RENDERER_IDS.has(backgroundId)
}
