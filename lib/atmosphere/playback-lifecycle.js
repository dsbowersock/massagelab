// @ts-check

/** @typedef {"stopped" | "loading" | "playing" | "interrupted" | "paused" | "failed"} PlaybackStatus */
/** @typedef {{ status: PlaybackStatus, sessionId: number, explicitIntent: "play" | "pause" | "stop", interruptionObserved: boolean, resumeAfterInterruption: boolean, noticeSessionId: number | null }} AtmospherePlaybackState */
/** @typedef {"START_GENERATOR" | "STOP_GENERATOR_RETAIN_MEDIA" | "STOP_GENERATOR_DISMISS_MEDIA" | "RESUME_GENERATOR" | "NONE"} PlaybackEffect */
/** @typedef {{ type: string, savedDefault?: boolean, documentVisible?: boolean, integrationAvailable?: boolean, value?: boolean, sessionId?: number }} PlaybackEvent */
/** @typedef {{ state: AtmospherePlaybackState, effects: PlaybackEffect[] }} TransitionResult */

/**
 * Create the initial policy state for a retained station.
 * @param {boolean} [resumeDefault=true]
 * @returns {AtmospherePlaybackState}
 */
export function createAtmospherePlaybackLifecycle(resumeDefault = true) {
  return {
    status: "stopped",
    sessionId: 0,
    explicitIntent: "stop",
    interruptionObserved: false,
    resumeAfterInterruption: resumeDefault === true,
    noticeSessionId: null,
  }
}

/**
 * Apply one provider event to policy state. Unknown events fail loudly so a
 * provider integration cannot silently lose a lifecycle signal.
 * @param {AtmospherePlaybackState} state
 * @param {PlaybackEvent} event
 * @returns {TransitionResult}
 */
export function transitionAtmospherePlayback(state, event) {
  const next = { ...state }
  /** @type {PlaybackEffect[]} */
  let effects = ["NONE"]
  switch (event.type) {
    case "BEGIN_IN_APP_SESSION":
      next.sessionId += 1
      next.status = "loading"
      next.explicitIntent = "play"
      next.interruptionObserved = false
      if (typeof event.savedDefault === "boolean") next.resumeAfterInterruption = event.savedDefault
      next.noticeSessionId = event.documentVisible && event.integrationAvailable ? next.sessionId : null
      effects = ["START_GENERATOR"]
      break
    case "BEGIN_EXTERNAL_SESSION":
      next.sessionId += 1
      next.status = "loading"
      next.explicitIntent = "play"
      next.interruptionObserved = false
      if (typeof event.savedDefault === "boolean") next.resumeAfterInterruption = event.savedDefault
      next.noticeSessionId = null
      effects = ["START_GENERATOR"]
      break
    case "START_SUCCEEDED":
      // A completion from an obsolete request must not settle the current session.
      if (event.sessionId === next.sessionId && next.status === "loading" && next.explicitIntent === "play") {
        next.status = "playing"
      }
      break
    case "START_FAILED":
      // Likewise, a stale failure cannot replace newer playback with an error.
      if (event.sessionId === next.sessionId && next.status === "loading" && next.explicitIntent === "play") {
        next.status = "failed"
      }
      break
    case "EXPLICIT_PAUSE":
      next.status = "paused"
      next.explicitIntent = "pause"
      next.interruptionObserved = false
      effects = ["STOP_GENERATOR_RETAIN_MEDIA"]
      break
    case "EXPLICIT_STOP":
      next.status = "stopped"
      next.explicitIntent = "stop"
      next.interruptionObserved = false
      next.noticeSessionId = null
      effects = ["STOP_GENERATOR_DISMISS_MEDIA"]
      break
    case "INTERRUPTION_STARTED":
      next.interruptionObserved = true
      if (next.resumeAfterInterruption && (next.status === "playing" || next.status === "loading")) {
        next.status = "interrupted"
      } else if (!next.resumeAfterInterruption && (next.status === "playing" || next.status === "loading")) {
        next.status = "paused"
        next.explicitIntent = "pause"
        effects = ["STOP_GENERATOR_RETAIN_MEDIA"]
      }
      break
    case "INTERRUPTION_ENDED":
      // Re-read the session override because intent may change while interrupted.
      if (next.status === "interrupted" && next.interruptionObserved && next.explicitIntent === "play") {
        next.interruptionObserved = false
        if (next.resumeAfterInterruption) {
          next.status = "playing"
          effects = ["RESUME_GENERATOR"]
        } else {
          next.status = "paused"
          next.explicitIntent = "pause"
        }
      }
      break
    case "SET_SESSION_RESUME":
      next.resumeAfterInterruption = event.value === true
      break
    case "DISMISS_NOTICE":
      if (event.sessionId === next.noticeSessionId) next.noticeSessionId = null
      break
    default:
      throw new Error(`Unknown atmosphere playback event: ${event.type}`)
  }
  return { state: next, effects }
}

/**
 * Starts one lazily adopted source runtime, then converges recipe revision and
 * transport intent before the provider publishes startup completion.
 * @param {{
 *   runtime: {
 *     start: (recipe: any) => Promise<void>,
 *     applyRecipe: (recipe: any) => Promise<void>,
 *     pause: () => Promise<void>,
 *     resume: () => Promise<void>,
 *     getSnapshot: () => { status: string },
 *   },
 *   isCurrent: () => boolean,
 *   readState: () => { recipe: any, revision: number, desiredTransport: "playing" | "paused" },
 * }} options
 */
export async function settleSourceRuntimeStartup({ runtime, isCurrent, readState }) {
  let applied = readState()
  const starting = runtime.start(applied.recipe)
  if (applied.desiredTransport === "paused") await runtime.pause()
  await starting

  while (isCurrent()) {
    const latest = readState()
    if (latest.revision !== applied.revision) {
      await runtime.applyRecipe(latest.recipe)
      applied = latest
      continue
    }

    const runtimeStatus = runtime.getSnapshot().status
    if (latest.desiredTransport === "paused" && runtimeStatus !== "paused") {
      await runtime.pause()
    } else if (latest.desiredTransport === "playing" && runtimeStatus === "paused") {
      await runtime.resume()
    }

    const settled = readState()
    if (
      settled.revision === latest.revision
      && settled.desiredTransport === latest.desiredTransport
    ) {
      return { status: "current", ...settled }
    }
    applied = latest
  }

  return { status: "stale", ...readState() }
}

/**
 * Commits an async owner effect only if its captured lease still owns playback.
 * @param {{ effect: () => Promise<unknown>, isCurrent: () => boolean, commit: () => unknown | Promise<unknown> }} options
 */
export async function commitOwnedPlaybackEffect({ effect, isCurrent, commit }) {
  await effect()
  if (!isCurrent()) return false
  await commit()
  return true
}
