// @ts-check

import { getAtmosphereStationArtworkUrl } from "./station-artwork.ts"

/** @typedef {"play" | "pause" | "stop" | "previoustrack" | "nexttrack"} MediaSessionAction */
/** @typedef {"none" | "paused" | "playing"} MediaSessionPlaybackState */
/** @typedef {{ id: string, title: string, artist?: string | null }} StationMetadata */
/** @typedef {{ title: string, artist: string, album: string, artwork: Array<{ src: string, sizes: string, type: string }> }} MediaMetadataInit */
/** @typedef {{ metadata: unknown, playbackState: MediaSessionPlaybackState, setActionHandler: (action: MediaSessionAction, handler: (() => void) | null) => void, setPositionState?: ((state?: object) => void) }} MediaSessionLike */

/** @type {MediaSessionAction[]} */
const actions = ["play", "pause", "stop", "previoustrack", "nexttrack"]

/**
 * Isolate best-effort Media Session publication from the playback provider.
 * Browser implementations may reject individual actions or metadata without
 * preventing the remaining notification controls from being useful.
 * @param {{ mediaSession?: MediaSessionLike | null, createMetadata?: ((init: MediaMetadataInit) => unknown) | null }} options
 */
export function createAtmosphereMediaSessionController({ mediaSession, createMetadata }) {
  const available = Boolean(mediaSession && typeof mediaSession.setActionHandler === "function")
  let disposed = false

  /** @param {MediaSessionAction} action @param {(() => void) | null} handler */
  function setHandler(action, handler) {
    if (!mediaSession) return
    try {
      mediaSession.setActionHandler(action, handler)
    } catch {
      // Media Session support varies by action even within one browser.
    }
  }

  /** @param {MediaSessionPlaybackState | string} state */
  function setPlaybackState(state) {
    if (!mediaSession) return
    const mappedState = state === "playing" || state === "paused" ? state : "none"
    try {
      mediaSession.playbackState = mappedState
    } catch {
      // A rejected playback-state update must not affect audible playback.
    }
  }

  /** Remove the finite carrier's inferred timeline from unbounded playback. */
  function clearPositionState() {
    if (!mediaSession || typeof mediaSession.setPositionState !== "function") return
    try {
      mediaSession.setPositionState()
    } catch {
      // Position publication is independently optional across implementations.
    }
  }

  /** Publish the station as unbounded live media, falling back to a cleared timeline when rejected. */
  function publishLivePositionState() {
    if (!mediaSession || typeof mediaSession.setPositionState !== "function") return
    try {
      mediaSession.setPositionState({
        duration: Number.POSITIVE_INFINITY,
        playbackRate: 1,
        position: 0,
      })
    } catch {
      clearPositionState()
    }
  }

  /** @param {StationMetadata} metadata */
  function setMetadata(metadata) {
    if (!mediaSession || typeof createMetadata !== "function") return
    try {
      mediaSession.metadata = createMetadata({
        title: metadata.title,
        artist: metadata.artist || "MassageLab",
        album: "MassageLab Atmosphere",
        artwork: [
          {
            src: getAtmosphereStationArtworkUrl(metadata.id, 256),
            sizes: "256x256",
            type: "image/png",
          },
          {
            src: getAtmosphereStationArtworkUrl(metadata.id, 512),
            sizes: "512x512",
            type: "image/png",
          },
        ],
      })
    } catch {
      // Metadata construction and assignment are optional platform effects.
    }
  }

  /**
   * Replace the complete notification surface for the current station.
   * @param {{ metadata: StationMetadata, playbackState: MediaSessionPlaybackState | string, handlers: Partial<Record<MediaSessionAction, () => void>> }} publication
   */
  function publish({ metadata, playbackState, handlers }) {
    if (!available || disposed) return
    setMetadata(metadata)
    setPlaybackState(playbackState)
    publishLivePositionState()
    for (const action of actions) setHandler(action, handlers[action] ?? null)
  }

  /** Clear platform ownership while guarding each independently optional effect. */
  function clear() {
    if (!available || disposed) return
    for (const action of actions) setHandler(action, null)
    if (mediaSession) {
      try {
        mediaSession.metadata = null
      } catch {
        // Metadata removal is best-effort on partial implementations.
      }
    }
    setPlaybackState("none")
    clearPositionState()
  }

  /** Release handlers once; repeated provider cleanup is safe. */
  function dispose() {
    if (disposed) return
    clear()
    disposed = true
  }

  return {
    publish,
    clear,
    dispose,
    isAvailable: () => available && !disposed,
  }
}
