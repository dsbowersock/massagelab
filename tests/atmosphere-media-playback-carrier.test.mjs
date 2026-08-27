import assert from "node:assert/strict"
import test from "node:test"

import { createAtmosphereMediaCarrier } from "../lib/atmosphere/media-playback-carrier.js"

const carrierUrl = "/audio/atmosphere/media-session-carrier.mp3"

/**
 * Create a complete HTMLAudioElement boundary fake so carrier tests observe
 * its lifecycle effects instead of inspecting the carrier's implementation.
 * @param {{ play?: () => Promise<void> | void, pauseEvent?: boolean }} [options]
 */
function createFakeAudio(options = {}) {
  const listeners = new Map()
  const attributes = new Map()
  const audio = {
    listeners,
    loop: false,
    preload: "",
    muted: false,
    paused: true,
    playCalls: 0,
    pauseCalls: 0,
    loadCalls: 0,
    sourceAssignments: 0,
    sourceRemovals: 0,
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
    getAttribute(name) {
      return attributes.get(name) ?? null
    },
    setAttribute(name, value) {
      if (name === "src") this.sourceAssignments += 1
      attributes.set(name, String(value))
    },
    removeAttribute(name) {
      if (name === "src") this.sourceRemovals += 1
      attributes.delete(name)
    },
    play() {
      this.playCalls += 1
      if (options.play) return options.play()
      if (!this.paused) return new Promise((resolve) => setImmediate(resolve))
      return new Promise((resolve) => setImmediate(() => {
        this.paused = false
        this.emit("play")
        resolve()
      }))
    },
    externalPlay() {
      this.paused = false
      setImmediate(() => this.emit("play"))
    },
    pause() {
      this.pauseCalls += 1
      if (this.paused || options.pauseEvent === false) return
      this.paused = true
      setImmediate(() => this.emit("pause"))
    },
    load() {
      this.loadCalls += 1
      this.paused = true
    },
  }
  Object.defineProperty(audio, "src", {
    get: () => {
      const source = attributes.get("src")
      return source === undefined ? "" : new URL(source, "https://massagelab.test").href
    },
    set: (value) => audio.setAttribute("src", value),
  })
  return audio
}

/** Wait for an HTML media event task after pending promise microtasks. */
function flushMediaEvents() {
  return new Promise((resolve) => setImmediate(resolve))
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
  assert.equal(createdAudio[0].getAttribute("src"), carrierUrl)
  assert.equal(createdAudio[0].src, "https://massagelab.test/audio/atmosphere/media-session-carrier.mp3")
  assert.equal(createdAudio[0].sourceAssignments, 1)
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
  await flushMediaEvents()

  assert.deepEqual(events, [
    { type: "play", origin: "internal" },
    { type: "pause", origin: "internal" },
  ])
  assert.equal(audio.getAttribute("src"), carrierUrl)
})

test("reports a carrier pause without an app marker as external", async () => {
  const events = []
  const audio = createFakeAudio()
  const carrier = createAtmosphereMediaCarrier({ createAudio: () => audio, onEvent: (event) => events.push(event) })

  await carrier.start()
  events.length = 0
  audio.pause()
  await flushMediaEvents()

  assert.deepEqual(events, [{ type: "pause", origin: "external" }])
})

test("reports unavailable when carrier play is rejected without throwing", async () => {
  const audio = createFakeAudio({ play: () => Promise.reject(new DOMException("blocked", "NotAllowedError")) })
  const carrier = createAtmosphereMediaCarrier({ createAudio: () => audio })

  assert.deepEqual(await carrier.start(), { available: false })
  assert.equal(carrier.isAvailable(), false)
  assert.equal(audio.getAttribute("src"), carrierUrl)
})

test("clears a settled repeated-start marker before later external events", async () => {
  const events = []
  const audio = createFakeAudio()
  const carrier = createAtmosphereMediaCarrier({ createAudio: () => audio, onEvent: (event) => events.push(event) })

  await carrier.start()
  events.length = 0
  await carrier.start()
  audio.pause()
  await flushMediaEvents()
  audio.externalPlay()
  await flushMediaEvents()

  assert.deepEqual(events, [
    { type: "pause", origin: "external" },
    { type: "play", origin: "external" },
  ])
})

test("dismissal clears the retained source and releases the media element", async () => {
  const events = []
  const audio = createFakeAudio()
  const carrier = createAtmosphereMediaCarrier({ createAudio: () => audio, onEvent: (event) => events.push(event) })

  await carrier.start()
  events.length = 0
  carrier.stopAndDismiss()
  await flushMediaEvents()

  assert.equal(audio.src, "")
  assert.equal(audio.getAttribute("src"), null)
  assert.equal(audio.sourceRemovals, 1)
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
  await flushMediaEvents()

  assert.equal(audio.src, "")
  assert.equal(audio.getAttribute("src"), null)
  assert.equal(audio.sourceRemovals, 1)
  assert.equal(audio.pauseCalls, 1)
  assert.equal(audio.loadCalls, 1)
  assert.equal(audio.listeners.get("play")?.size ?? 0, 0)
  assert.equal(audio.listeners.get("pause")?.size ?? 0, 0)
  assert.deepEqual(events, [{ type: "play", origin: "internal" }])
  assert.deepEqual(await carrier.start(), { available: false })
})
