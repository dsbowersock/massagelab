export const IMMERSIVE_DISPLAY_CONTEXTS = Object.freeze({
  chimer: "chimer",
  clock: "clock",
  musicVisualizer: "musicVisualizer",
})

const IMMERSIVE_DISPLAY_CONTEXT_VALUES = new Set(Object.values(IMMERSIVE_DISPLAY_CONTEXTS))
const ACTIVE_TIMER_STATUSES = new Set(["running", "paused", "complete", "clock"])

/**
 * Resolves shared Clock-route UI semantics without coupling pure display rules
 * to the DOM or Next navigation hooks.
 *
 * @param {{ pathname?: string | null, source?: string | null }} input
 * @returns {"chimer" | "clock" | "musicVisualizer"}
 */
export function resolveImmersiveDisplayContext({ pathname, source } = {}) {
  const isClockRoute = pathname === "/clock" || pathname === "/clock/"

  if (!isClockRoute) {
    return IMMERSIVE_DISPLAY_CONTEXTS.chimer
  }

  return source === "music"
    ? IMMERSIVE_DISPLAY_CONTEXTS.musicVisualizer
    : IMMERSIVE_DISPLAY_CONTEXTS.clock
}

/**
 * Context selects the display's UI semantics, while timerStatus remains
 * authoritative for whether the immersive lifecycle is active.
 *
 * @param {{
 *   context: "chimer" | "clock" | "musicVisualizer",
 *   timerStatus: "idle" | "running" | "paused" | "complete" | "clock",
 *   keepScreenAwake: unknown,
 * }} input
 * @returns {boolean}
 */
export function shouldRequestImmersiveWakeLock({
  context,
  timerStatus,
  keepScreenAwake,
} = {}) {
  return (
    keepScreenAwake === true
    && IMMERSIVE_DISPLAY_CONTEXT_VALUES.has(context)
    && ACTIVE_TIMER_STATUSES.has(timerStatus)
  )
}
