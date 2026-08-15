import assert from "node:assert/strict"
import test from "node:test"

import { createAtmosphereMediaSessionController } from "../lib/atmosphere/media-session-controller.js"

const actions = ["play", "pause", "stop", "previoustrack", "nexttrack"]

/**
 * Mirror the MediaSession boundary, including action rejection, so tests
 * exercise controller effects without depending on a browser navigator.
 * @param {{ unsupportedActions?: string[] }} [options]
 */
function createFakeMediaSession(options = {}) {
  const handlers = new Map()
  const setActionCalls = []
  const setPositionStateCalls = []
  const unsupportedActions = new Set(options.unsupportedActions ?? [])
  return {
    handlers,
    setActionCalls,
    setPositionStateCalls,
    metadata: null,
    playbackState: "none",
    setActionHandler(action, handler) {
      setActionCalls.push({ action, handler })
      if (unsupportedActions.has(action)) {
        throw new DOMException(`Unsupported action: ${action}`, "NotSupportedError")
      }
      handlers.set(action, handler)
    },
    setPositionState(positionState) {
      setPositionStateCalls.push(positionState)
      if (options.rejectPositionState) {
        throw new DOMException("Position state rejected", "NotSupportedError")
      }
    },
  }
}

test("reports unavailable and remains inert when Media Session is absent", () => {
  let metadataConstructions = 0
  const controller = createAtmosphereMediaSessionController({
    mediaSession: undefined,
    createMetadata: () => {
      metadataConstructions += 1
      return {}
    },
  })

  assert.equal(controller.isAvailable(), false)
  assert.doesNotThrow(() => controller.publish({
    metadata: { title: "Quiet Current", artist: "MassageLab" },
    playbackState: "playing",
    handlers: Object.fromEntries(actions.map((action) => [action, () => action])),
  }))
  assert.doesNotThrow(() => controller.clear())
  assert.doesNotThrow(() => controller.dispose())
  assert.equal(metadataConstructions, 0)
})

test("publishes constructed station metadata, playback state, and all five controls", () => {
  const mediaSession = createFakeMediaSession()
  const metadataInputs = []
  const createMetadata = (init) => {
    metadataInputs.push(structuredClone(init))
    return { kind: "MediaMetadata", ...init }
  }
  const handlers = Object.fromEntries(actions.map((action) => [action, () => action]))
  const controller = createAtmosphereMediaSessionController({ mediaSession, createMetadata })

  controller.publish({
    metadata: { id: "quiet-current", title: "Quiet Current", artist: "Field Artist" },
    playbackState: "paused",
    handlers,
  })

  assert.equal(controller.isAvailable(), true)
  assert.deepEqual(metadataInputs, [{
    title: "Quiet Current",
    artist: "Field Artist",
    album: "MassageLab Atmosphere",
    artwork: [
      {
        src: "/api/atmosphere/stations/quiet-current/artwork",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  }])
  assert.deepEqual(mediaSession.metadata, {
    kind: "MediaMetadata",
    title: "Quiet Current",
    artist: "Field Artist",
    album: "MassageLab Atmosphere",
    artwork: [
      {
        src: "/api/atmosphere/stations/quiet-current/artwork",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  })
  assert.equal(mediaSession.playbackState, "paused")
  assert.deepEqual(mediaSession.setPositionStateCalls, [undefined])
  assert.deepEqual([...mediaSession.handlers.keys()].sort(), [...actions].sort())
  for (const action of actions) assert.equal(mediaSession.handlers.get(action), handlers[action])
})

test("clears carrier-derived position state on every publication and ownership clear", () => {
  const mediaSession = createFakeMediaSession()
  const controller = createAtmosphereMediaSessionController({
    mediaSession,
    createMetadata: (init) => init,
  })

  controller.publish({
    metadata: { id: "quiet-current", title: "Quiet Current" },
    playbackState: "playing",
    handlers: {},
  })
  controller.publish({
    metadata: { id: "quiet-current", title: "Quiet Current" },
    playbackState: "paused",
    handlers: {},
  })
  controller.clear()

  assert.deepEqual(mediaSession.setPositionStateCalls, [undefined, undefined, undefined])
})

test("guards rejected position-state clearing without losing metadata or controls", () => {
  const mediaSession = createFakeMediaSession({ rejectPositionState: true })
  const controller = createAtmosphereMediaSessionController({
    mediaSession,
    createMetadata: (init) => init,
  })
  const play = () => "play"

  assert.doesNotThrow(() => controller.publish({
    metadata: { id: "quiet-current", title: "Quiet Current" },
    playbackState: "playing",
    handlers: { play },
  }))
  assert.deepEqual(mediaSession.setPositionStateCalls, [undefined])
  assert.equal(mediaSession.metadata.title, "Quiet Current")
  assert.equal(mediaSession.playbackState, "playing")
  assert.equal(mediaSession.handlers.get("play"), play)
})

test("replaces prior handlers while guarding each unsupported action independently", () => {
  const mediaSession = createFakeMediaSession({ unsupportedActions: ["pause"] })
  const controller = createAtmosphereMediaSessionController({
    mediaSession,
    createMetadata: (init) => init,
  })
  const firstHandlers = Object.fromEntries(actions.map((action) => [action, () => `first-${action}`]))
  const replacementHandlers = Object.fromEntries(actions.map((action) => [action, () => `next-${action}`]))

  assert.doesNotThrow(() => controller.publish({
    metadata: { title: "First" },
    playbackState: "playing",
    handlers: firstHandlers,
  }))
  assert.doesNotThrow(() => controller.publish({
    metadata: { title: "Next" },
    playbackState: "playing",
    handlers: replacementHandlers,
  }))

  assert.equal(mediaSession.playbackState, "playing")
  assert.deepEqual(
    mediaSession.setActionCalls.map(({ action }) => action),
    [...actions, ...actions],
  )
  for (const action of actions.filter((action) => action !== "pause")) {
    assert.equal(mediaSession.handlers.get(action), replacementHandlers[action])
  }
})

test("maps only supported playback states to Media Session values", () => {
  const mediaSession = createFakeMediaSession()
  const controller = createAtmosphereMediaSessionController({
    mediaSession,
    createMetadata: (init) => init,
  })
  const handlers = Object.fromEntries(actions.map((action) => [action, () => action]))

  controller.publish({ metadata: { title: "One" }, playbackState: "playing", handlers })
  assert.equal(mediaSession.playbackState, "playing")
  controller.publish({ metadata: { title: "Two" }, playbackState: "paused", handlers })
  assert.equal(mediaSession.playbackState, "paused")
  controller.publish({ metadata: { title: "Three" }, playbackState: "none", handlers })
  assert.equal(mediaSession.playbackState, "none")
  controller.publish({ metadata: { title: "Four" }, playbackState: "interrupted", handlers })
  assert.equal(mediaSession.playbackState, "none")
})

test("clear removes metadata and handlers, and dispose repeats cleanup only once", () => {
  const mediaSession = createFakeMediaSession()
  const controller = createAtmosphereMediaSessionController({
    mediaSession,
    createMetadata: (init) => init,
  })
  const handlers = Object.fromEntries(actions.map((action) => [action, () => action]))

  controller.publish({ metadata: { title: "Quiet Current" }, playbackState: "playing", handlers })
  controller.clear()

  assert.equal(mediaSession.metadata, null)
  assert.equal(mediaSession.playbackState, "none")
  for (const action of actions) assert.equal(mediaSession.handlers.get(action), null)

  const callsBeforeDispose = mediaSession.setActionCalls.length
  controller.dispose()
  const callsAfterFirstDispose = mediaSession.setActionCalls.length
  controller.dispose()

  assert.equal(callsAfterFirstDispose, callsBeforeDispose + actions.length)
  assert.equal(mediaSession.setActionCalls.length, callsAfterFirstDispose)
  assert.equal(controller.isAvailable(), false)
  controller.publish({ metadata: { title: "Late" }, playbackState: "playing", handlers })
  assert.equal(mediaSession.playbackState, "none")
})
