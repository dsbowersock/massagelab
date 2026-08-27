// @ts-check

/** @typedef {{ token: symbol, schedule: () => (() => unknown) | undefined, endStage: (() => unknown) | undefined }} GenerativeFmTransportSession */

/**
 * Owns the one shared Tone.Transport schedule used by Generative.fm pieces.
 * Replacement is transactional: candidate scheduling and Transport startup
 * must both succeed before ownership changes, otherwise the incumbent is
 * rescheduled. A generation guard prevents an obsolete attempt from restoring
 * itself over a newer re-entrant owner.
 */
export function createGenerativeFmTransportOwner() {
  /** @type {GenerativeFmTransportSession | null} */
  let activeSession = null
  let replacementGeneration = 0

  /**
   * @param {{ cancel: () => unknown, schedule: () => (() => unknown) | undefined, start: () => unknown }} operations
   * @returns {GenerativeFmTransportSession}
   */
  function replace({ cancel, schedule, start }) {
    const incumbent = activeSession
    const generation = ++replacementGeneration
    /** @type {(() => unknown) | undefined} */
    let candidateEndStage

    try {
      if (incumbent) cancel()
      candidateEndStage = schedule()
      assertCurrentReplacement(generation)
      start()
      assertCurrentReplacement(generation)

      const candidate = {
        token: Symbol("generative-fm-transport"),
        schedule,
        endStage: candidateEndStage,
      }
      activeSession = candidate
      return candidate
    } catch (error) {
      runCleanupStep(candidateEndStage)
      if (generation === replacementGeneration && activeSession === incumbent) {
        restoreIncumbent({ cancel, incumbent, start })
      }
      throw error
    }
  }

  /** @param {number} generation */
  function assertCurrentReplacement(generation) {
    if (generation !== replacementGeneration) {
      throw new Error("Generative.fm Transport replacement was superseded.")
    }
  }

  /**
   * @param {{ cancel: () => unknown, incumbent: GenerativeFmTransportSession | null, start: () => unknown }} input
   */
  function restoreIncumbent({ cancel, incumbent, start }) {
    runCleanupStep(cancel)
    if (!incumbent) {
      activeSession = null
      return
    }

    try {
      incumbent.endStage = incumbent.schedule()
      activeSession = incumbent
      // Tone.Transport is normally already started. Retrying start also covers
      // implementations that failed before they could keep it running.
      runCleanupStep(start)
    } catch {
      activeSession = null
    }
  }

  /** @param {GenerativeFmTransportSession} session */
  function isOwner(session) {
    return activeSession === session
  }

  /**
   * Releases shared Transport ownership only for the exact current session.
   * @param {GenerativeFmTransportSession} session
   * @param {{ cancel: () => unknown, stop: () => unknown }} operations
   */
  function release(session, { cancel, stop }) {
    if (!isOwner(session)) return false
    activeSession = null
    replacementGeneration += 1
    runCleanupStep(stop)
    runCleanupStep(cancel)
    return true
  }

  /** Ends only the package schedule owned by this playback handle. @param {GenerativeFmTransportSession} session */
  function endSchedule(session) {
    const endStage = session.endStage
    session.endStage = undefined
    runCleanupStep(endStage)
  }

  return { endSchedule, isOwner, release, replace }
}

/** The application-wide owner used by every Generative.fm playback handle. */
export const generativeFmTransportOwner = createGenerativeFmTransportOwner()

/** @param {(() => unknown) | undefined} step */
function runCleanupStep(step) {
  try {
    step?.()
  } catch {
    // Rollback and terminal cleanup are best-effort; ownership remains truthful.
  }
}
