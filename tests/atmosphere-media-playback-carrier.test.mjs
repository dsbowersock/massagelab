import assert from "node:assert/strict"
import test from "node:test"

import { createAtmosphereMediaCarrier } from "../lib/atmosphere/media-playback-carrier.js"

const carrierUrl = "/audio/atmosphere/media-session-carrier.mp3"

/**
 * Create a complete HTMLAudioElement boundary fake so carrier tests observe
 * its lifecycle effects instead of inspecting the carrier's implementation.
 * @param {{ play?: () => Promise<void> | void, playEvent?: boolean, pauseEvent?: boolean }} [options]
 */
function createFakeAudio(options = {}) {
  const listeners = new Map()
  return {
    listeners,
    src: "",
    loop: false,
    preload: "",
    muted: false,
    playCalls: 0,
    pauseCalls: 0,
    loadCalls: 0,
    addEventListener(type, listener) {
      const listenersForType = listeners.get(type) ?? new Set()
      listenersForType.add(listener)
      listeners.set(type, listenersForType)
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener)
    },
    emit(type) {
      for (const listener of listeners.get(type) ?? []) listener({ type })
    },
    play() {
      this.playCalls += 1
      if (options.playEvent !== false) this.emit("play")
      return options.play?.() ?? Promise.resolve()
    },
    pause() {
      this.pauseCalls += 1
      if (options.pauseEvent !== false) this.emit("pause")
    },
    load() {
      this.loadCalls += 1
    },
  }
}

test("reuses one lazily created silent carrier for repeated starts", async () => {
  const createdAudio = []
  const carrier = createAtmosphereMediaCarrier({
    createAudio: () => {
      const audio = createFakeAudio()
      createdAudio.push(audio)
      return audio
    },
  })

  assert.equal(carrier.getElement(), null)
  assert.deepEqual(await carrier.start(), { available: true })
  assert.deepEqual(await carrier.start(), { available: true })

  assert.equal(createdAudio.length, 1)
  assert.equal(createdAudio[0].src, carrierUrl)
  assert.equal(createdAudio[0].loop, true)
  assert.equal(createdAudio[0].preload, "auto")
  assert.equal(createdAudio[0].muted, false)
  assert.equal(createdAudio[0].playCalls, 2)
  assert.equal(carrier.getElement(), createdAudio[0])
  assert.equal(carrier.isAvailable(), true)
})

test("reports app-triggered play and retained pause events as internal", async () => {
  const events = []
  const audio = createFakeAudio()
  const carrier = createAtmosphereMediaCarrier({ createAudio: () => audio, onEvent: (event) => events.push(event) })

  await carrier.start()
  carrier.pauseRetained()

  assert.deepEqual(events, [
    { type: "play", origin: "internal" },
    { type: "pause", origin: "internal" },
  ])
  assert.equal(audio.src, carrierUrl)
})

test("reports a carrier pause without an app marker as external", async () => {
  const events = []
  const audio = createFakeAudio()
  const carrier = createAtmosphereMediaCarrier({ createAudio: () => audio, onEvent: (event) => events.push(event) })

  await carrier.start()
  events.length = 0
  audio.emit("pause")

  assert.deepEqual(events, [{ type: "pause", origin: "external" }])
})

test("reports unavailable when carrier play is rejected without throwing", async () => {
  const audio = createFakeAudio({ play: () => Promise.reject(new DOMException("blocked", "NotAllowedError")) })
  const carrier = createAtmosphereMediaCarrier({ createAudio: () => audio })

  assert.deepEqual(await carrier.start(), { available: false })
  assert.equal(carrier.isAvailable(), false)
  assert.equal(audio.src, carrierUrl)
})

test("dismissal clears the retained source and releases the media element", async () => {
  const events = []
  const audio = createFakeAudio()
  const carrier = createAtmosphereMediaCarrier({ createAudio: () => audio, onEvent: (event) => events.push(event) })

  await carrier.start()
  events.length = 0
  carrier.stopAndDismiss()

  assert.equal(audio.src, "")
  assert.equal(audio.pauseCalls, 1)
  assert.equal(audio.loadCalls, 1)
  assert.deepEqual(events, [{ type: "pause", origin: "internal" }])
  assert.equal(carrier.isAvailable(), false)
})

test("disposal clears listeners and media only once", async () => {
  const events = []
  const audio = createFakeAudio()
  const carrier = createAtmosphereMediaCarrier({ createAudio: () => audio, onEvent: (event) => events.push(event) })

  await carrier.start()
  carrier.dispose()
  carrier.dispose()
  audio.emit("pause")

  assert.equal(audio.src, "")
  assert.equal(audio.pauseCalls, 1)
  assert.equal(audio.loadCalls, 1)
  assert.equal(audio.listeners.get("play")?.size ?? 0, 0)
  assert.equal(audio.listeners.get("pause")?.size ?? 0, 0)
  assert.deepEqual(events, [{ type: "play", origin: "internal" }])
  assert.deepEqual(await carrier.start(), { available: false })
})
