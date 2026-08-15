// @ts-check

/** @typedef {{ addEventListener: (type: string, listener: (event: any) => void) => void, removeEventListener: (type: string, listener: (event: any) => void) => void }} EventTargetLike */
/** @typedef {EventTargetLike & { state: unknown, type?: unknown }} AudioSessionLike */
/** @typedef {EventTargetLike & { state: unknown }} AudioContextLike */
/** @typedef {EventTargetLike & { hidden?: boolean, visibilityState?: string }} DocumentTargetLike */
/** @typedef {{ origin?: "internal" | "external", detail?: { origin?: "internal" | "external" } }} CarrierPauseEvent */

/** @param {unknown} value @returns {value is EventTargetLike} */
function isEventTargetLike(value) {
  return Boolean(
    value
    && typeof value === "object"
    && typeof /** @type {EventTargetLike} */ (value).addEventListener === "function"
    && typeof /** @type {EventTargetLike} */ (value).removeEventListener === "function",
  )
}

/**
 * Observe authoritative platform interruption states without treating generic
 * carrier or page lifecycle events as proof that another audio app took over.
 * Audio Session has precedence; AudioContext is used only when it is absent.
 * @param {{
 *   audioSession?: AudioSessionLike | null,
 *   audioContext?: AudioContextLike | null,
 *   carrier?: EventTargetLike | null,
 *   documentTarget?: DocumentTargetLike | null,
 *   onInterrupted: () => void,
 *   onRecovered: () => void,
 *   onAmbiguousPause: () => void,
 * }} options
 */
export function createAtmosphereInterruptionMonitor({
  audioSession,
  audioContext,
  carrier,
  documentTarget,
  onInterrupted,
  onRecovered,
  onAmbiguousPause,
}) {
  /** @type {AudioSessionLike | AudioContextLike | null} */
  let signalTarget = isEventTargetLike(audioSession)
    ? audioSession
    : isEventTargetLike(audioContext) ? audioContext : null
  /** @type {"audio-session" | "audio-context" | null} */
  let signalKind = isEventTargetLike(audioSession)
    ? "audio-session"
    : isEventTargetLike(audioContext) ? "audio-context" : null
  let capabilityAvailable = signalTarget !== null
  let started = false
  let disposed = false
  let interrupted = false
  /** @type {Array<() => void>} */
  const cleanups = []

  /** Read state as a string so WebKit's nonstandard `interrupted` is accepted. */
  function currentSignalIsInterrupted() {
    if (!signalTarget) return false
    try {
      return String(signalTarget.state) === "interrupted"
    } catch {
      return false
    }
  }

  /** Require the signal's explicit usable state; merely not interrupted is insufficient. */
  function currentSignalAllowsRecovery() {
    if (!signalTarget || !signalKind) return false
    try {
      const state = String(signalTarget.state)
      return signalKind === "audio-session" ? state === "active" : state === "running"
    } catch {
      return false
    }
  }

  function documentIsVisible() {
    if (!documentTarget) return true
    if (typeof documentTarget.hidden === "boolean") return !documentTarget.hidden
    return documentTarget.visibilityState !== "hidden"
  }

  function establishInterruption() {
    if (interrupted || disposed) return
    interrupted = true
    onInterrupted()
  }

  function recoverInterruption() {
    if (!interrupted || disposed) return
    interrupted = false
    onRecovered()
  }

  function handleSpecificStateChange() {
    if (disposed) return
    if (currentSignalIsInterrupted()) {
      establishInterruption()
      return
    }
    if (documentIsVisible() && currentSignalAllowsRecovery()) recoverInterruption()
  }

  /** @param {CarrierPauseEvent} event */
  function handleCarrierPause(event) {
    if (disposed) return
    const origin = event.origin ?? event.detail?.origin
    if (origin !== "external") return
    if (currentSignalIsInterrupted()) {
      establishInterruption()
      return
    }
    onAmbiguousPause()
  }

  function handleVisibilityChange() {
    if (disposed || !documentIsVisible()) return
    if (interrupted && currentSignalAllowsRecovery()) recoverInterruption()
  }

  /**
   * Add a listener and retain its exact removal operation. Registration
   * failures are contained so partial browser APIs do not break playback.
   * @param {EventTargetLike} target
   * @param {string} type
   * @param {(event: any) => void} listener
   */
  function addListener(target, type, listener) {
    try {
      target.addEventListener(type, listener)
      cleanups.push(() => {
        try {
          target.removeEventListener(type, listener)
        } catch {
          // Cleanup is best-effort for disappearing platform implementations.
        }
      })
      return true
    } catch {
      return false
    }
  }

  /** Register supported signals once and observe an already-current interruption. */
  function start() {
    if (started || disposed) return
    started = true

    if (isEventTargetLike(audioSession)) {
      if ("type" in audioSession) {
        try {
          audioSession.type = "playback"
        } catch {
          // Some Audio Session implementations expose a read-only type.
        }
      }
      signalTarget = addListener(audioSession, "statechange", handleSpecificStateChange)
        ? audioSession
        : null
      signalKind = signalTarget ? "audio-session" : null
    }
    if (!signalTarget && isEventTargetLike(audioContext)) {
      signalTarget = addListener(audioContext, "statechange", handleSpecificStateChange)
        ? audioContext
        : null
      signalKind = signalTarget ? "audio-context" : null
    } else if (signalTarget && signalTarget !== audioSession) {
      addListener(signalTarget, "statechange", handleSpecificStateChange)
    }
    capabilityAvailable = signalTarget !== null

    if (isEventTargetLike(carrier)) addListener(carrier, "pause", handleCarrierPause)
    if (isEventTargetLike(documentTarget)) {
      addListener(documentTarget, "visibilitychange", handleVisibilityChange)
    }
    handleSpecificStateChange()
  }

  /** Remove all registered listeners once and stop reporting stale state. */
  function dispose() {
    if (disposed) return
    disposed = true
    for (const cleanup of cleanups.splice(0)) cleanup()
    interrupted = false
    capabilityAvailable = false
  }

  return {
    start,
    dispose,
    isAvailable: () => capabilityAvailable && !disposed,
    isInterrupted: () => interrupted,
  }
}
