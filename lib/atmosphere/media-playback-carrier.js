// @ts-check

/** @typedef {{ type: "play" | "pause", origin: "internal" | "external" }} CarrierEvent */
/** @typedef {{ addEventListener: (type: "play" | "pause", listener: (event: Event) => void) => void, removeEventListener: (type: "play" | "pause", listener: (event: Event) => void) => void, getAttribute: (name: string) => string | null, removeAttribute: (name: string) => void, play: () => Promise<void> | void, pause: () => void, load: () => void, src: string, loop: boolean, preload: string, paused: boolean }} CarrierAudioElement */

/**
 * Own the silent HTML media element that lets the browser expose one
 * Atmosphere playback session without becoming a second audible program.
 * @param {{ createAudio: () => CarrierAudioElement, sourceUrl?: string, onEvent?: (event: CarrierEvent) => void }} options
 */
export function createAtmosphereMediaCarrier({
  createAudio,
  sourceUrl = "/audio/atmosphere/media-session-carrier.mp3",
  onEvent = () => {},
}) {
  /** @type {CarrierAudioElement | null} */
  let element = null
  let available = false
  let disposed = false
  let internalPlayPending = false
  let internalPausePending = false

  /**
   * Mark an app action until its matching asynchronous media event. A settled
   * play promise is the spec-defined fallback when playback never starts.
   * @param {"play" | "pause"} type
   */
  function markInternal(type) {
    if (type === "play") internalPlayPending = true
    else internalPausePending = true
  }

  /** @param {"play" | "pause"} type */
  function reportEvent(type) {
    const internal = type === "play" ? internalPlayPending : internalPausePending
    if (type === "play") internalPlayPending = false
    else internalPausePending = false
    onEvent({ type, origin: internal ? "internal" : "external" })
  }

  /** Create and configure the single reusable ownership element on demand. */
  function getOrCreateElement() {
    if (element) return element
    const created = createAudio()
    created.loop = true
    created.preload = "auto"
    created.src = sourceUrl
    created.addEventListener("play", onPlay)
    created.addEventListener("pause", onPause)
    element = created
    return created
  }

  /** @param {Event} _event */
  function onPlay(_event) {
    reportEvent("play")
  }

  /** @param {Event} _event */
  function onPause(_event) {
    reportEvent("pause")
  }

  /**
   * Start media ownership synchronously from the caller's gesture. A browser
   * policy rejection is non-fatal so the audible generator can still start.
   * @returns {Promise<{ available: boolean }>}
   */
  async function start() {
    if (disposed) return { available: false }
    try {
      const current = getOrCreateElement()
      if (current.getAttribute("src") !== sourceUrl) current.src = sourceUrl
      markInternal("play")
      await current.play()
      // A successful play promise follows the queued play event in conforming
      // browsers; clear an otherwise-unconsumed marker to protect later input.
      internalPlayPending = false
      available = true
      return { available: true }
    } catch {
      internalPlayPending = false
      available = false
      return { available: false }
    }
  }

  /** Pause while retaining the source for notification/media-session resume. */
  function pauseRetained() {
    if (!element || disposed) return
    // The media spec queues no pause event for an already-paused element.
    if (!element.paused) markInternal("pause")
    element.pause()
    available = true
  }

  /** Pause, clear the source, and reload to dismiss operating-system ownership. */
  function stopAndDismiss() {
    if (!element || disposed) return
    if (!element.paused) markInternal("pause")
    element.pause()
    element.removeAttribute("src")
    element.load()
    available = false
  }

  /** Release listeners and source once; repeat cleanup calls are safe. */
  function dispose() {
    if (disposed) return
    disposed = true
    if (!element) return
    element.removeEventListener("play", onPlay)
    element.removeEventListener("pause", onPause)
    element.pause()
    element.removeAttribute("src")
    element.load()
    available = false
  }

  return {
    start,
    pauseRetained,
    stopAndDismiss,
    dispose,
    isAvailable: () => available,
    getElement: () => element,
  }
}
