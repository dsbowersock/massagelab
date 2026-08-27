import assert from "node:assert/strict"
import test from "node:test"

import { createAtmosphereInterruptionMonitor } from "../lib/atmosphere/media-interruption-monitor.js"

/**
 * Complete the EventTarget behavior used by the monitor and expose listener
 * counts so disposal can be verified through observable lifecycle effects.
 * @param {Record<string, unknown>} [properties]
 */
function createEventTargetFake(properties = {}) {
  const listeners = new Map()
  return {
    ...properties,
    listeners,
    addEventListener(type, listener) {
      const listenersForType = listeners.get(type) ?? new Set()
      listenersForType.add(listener)
      listeners.set(type, listenersForType)
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener)
    },
    emit(type, properties = {}) {
      const event = { type, target: this, currentTarget: this, ...properties }
      for (const listener of [...(listeners.get(type) ?? [])]) listener(event)
    },
    listenerCount(type) {
      return listeners.get(type)?.size ?? 0
    },
  }
}

function createCallbacks() {
  const calls = { interrupted: 0, recovered: 0, ambiguous: 0 }
  return {
    calls,
    onInterrupted: () => { calls.interrupted += 1 },
    onRecovered: () => { calls.recovered += 1 },
    onAmbiguousPause: () => { calls.ambiguous += 1 },
  }
}

test("Audio Session reports one interruption and one later active recovery", () => {
  const audioSession = createEventTargetFake({ state: "active", type: "auto" })
  const audioContext = createEventTargetFake({ state: "running" })
  const carrier = createEventTargetFake()
  const documentTarget = createEventTargetFake({ hidden: false, visibilityState: "visible" })
  const callbacks = createCallbacks()
  const monitor = createAtmosphereInterruptionMonitor({
    audioSession,
    audioContext,
    carrier,
    documentTarget,
    ...callbacks,
  })

  monitor.start()
  assert.equal(monitor.isAvailable(), true)
  assert.equal(audioSession.type, "playback")
  assert.equal(audioContext.listenerCount("statechange"), 0)

  audioSession.state = "interrupted"
  audioSession.emit("statechange")
  audioSession.emit("statechange")
  carrier.emit("pause", { origin: "external" })

  assert.deepEqual(callbacks.calls, { interrupted: 1, recovered: 0, ambiguous: 0 })
  assert.equal(monitor.isInterrupted(), true)

  audioSession.state = "active"
  audioSession.emit("statechange")
  audioSession.emit("statechange")

  assert.deepEqual(callbacks.calls, { interrupted: 1, recovered: 1, ambiguous: 0 })
  assert.equal(monitor.isInterrupted(), false)
})

test("AudioContext is the specific interruption fallback when Audio Session is absent", () => {
  const audioContext = createEventTargetFake({ state: "running" })
  const callbacks = createCallbacks()
  const monitor = createAtmosphereInterruptionMonitor({
    audioSession: undefined,
    audioContext,
    carrier: createEventTargetFake(),
    documentTarget: createEventTargetFake({ hidden: false, visibilityState: "visible" }),
    ...callbacks,
  })

  monitor.start()
  audioContext.state = "interrupted"
  audioContext.emit("statechange")
  audioContext.state = "running"
  audioContext.emit("statechange")

  assert.deepEqual(callbacks.calls, { interrupted: 1, recovered: 1, ambiguous: 0 })
  assert.equal(monitor.isInterrupted(), false)
})

test("AudioContext remains the fallback when a partial Audio Session rejects listener registration", () => {
  const audioSession = createEventTargetFake({ state: "active", type: "auto" })
  audioSession.addEventListener = () => { throw new Error("unsupported") }
  const audioContext = createEventTargetFake({ state: "running" })
  const callbacks = createCallbacks()
  const monitor = createAtmosphereInterruptionMonitor({
    audioSession,
    audioContext,
    carrier: createEventTargetFake(),
    documentTarget: createEventTargetFake({ hidden: false, visibilityState: "visible" }),
    ...callbacks,
  })

  monitor.start()
  assert.equal(monitor.isAvailable(), true)
  assert.equal(audioContext.listenerCount("statechange"), 1)
  audioContext.state = "interrupted"
  assert.equal(monitor.hasCurrentInterruptionSignal(), true)
  audioContext.emit("statechange")
  assert.deepEqual(callbacks.calls, { interrupted: 1, recovered: 0, ambiguous: 0 })
})

test("authoritative signal query classifies a paired Pause before either event callback order", () => {
  const audioSession = createEventTargetFake({ state: "active", type: "auto" })
  const callbacks = createCallbacks()
  const monitor = createAtmosphereInterruptionMonitor({
    audioSession,
    audioContext: createEventTargetFake({ state: "running" }),
    carrier: createEventTargetFake(),
    documentTarget: createEventTargetFake({ hidden: false, visibilityState: "visible" }),
    ...callbacks,
  })
  monitor.start()

  audioSession.state = "interrupted"
  assert.equal(monitor.isInterrupted(), false)
  assert.equal(monitor.hasCurrentInterruptionSignal(), true)
  audioSession.emit("statechange")
  assert.equal(monitor.isInterrupted(), true)
  assert.equal(monitor.hasCurrentInterruptionSignal(), true)
})

test("Audio Session recovers only from active, never inactive or visibility alone", () => {
  const audioSession = createEventTargetFake({ state: "active", type: "auto" })
  const documentTarget = createEventTargetFake({ hidden: false, visibilityState: "visible" })
  const callbacks = createCallbacks()
  const monitor = createAtmosphereInterruptionMonitor({
    audioSession,
    audioContext: undefined,
    carrier: createEventTargetFake(),
    documentTarget,
    ...callbacks,
  })

  monitor.start()
  audioSession.state = "interrupted"
  audioSession.emit("statechange")
  audioSession.state = "inactive"
  audioSession.emit("statechange")

  assert.deepEqual(callbacks.calls, { interrupted: 1, recovered: 0, ambiguous: 0 })
  assert.equal(monitor.isInterrupted(), true)

  documentTarget.hidden = true
  documentTarget.visibilityState = "hidden"
  documentTarget.emit("visibilitychange")
  documentTarget.hidden = false
  documentTarget.visibilityState = "visible"
  documentTarget.emit("visibilitychange")

  assert.deepEqual(callbacks.calls, { interrupted: 1, recovered: 0, ambiguous: 0 })
  assert.equal(monitor.isInterrupted(), true)

  audioSession.state = "active"
  audioSession.emit("statechange")
  assert.deepEqual(callbacks.calls, { interrupted: 1, recovered: 1, ambiguous: 0 })
  assert.equal(monitor.isInterrupted(), false)
})

test("AudioContext recovers only from running, never suspended, closed, or visibility alone", () => {
  const audioContext = createEventTargetFake({ state: "running" })
  const documentTarget = createEventTargetFake({ hidden: false, visibilityState: "visible" })
  const callbacks = createCallbacks()
  const monitor = createAtmosphereInterruptionMonitor({
    audioSession: undefined,
    audioContext,
    carrier: createEventTargetFake(),
    documentTarget,
    ...callbacks,
  })

  monitor.start()
  audioContext.state = "interrupted"
  audioContext.emit("statechange")
  audioContext.state = "suspended"
  audioContext.emit("statechange")

  assert.deepEqual(callbacks.calls, { interrupted: 1, recovered: 0, ambiguous: 0 })
  assert.equal(monitor.isInterrupted(), true)

  documentTarget.hidden = true
  documentTarget.visibilityState = "hidden"
  documentTarget.emit("visibilitychange")
  documentTarget.hidden = false
  documentTarget.visibilityState = "visible"
  documentTarget.emit("visibilitychange")
  audioContext.state = "closed"
  audioContext.emit("statechange")

  assert.deepEqual(callbacks.calls, { interrupted: 1, recovered: 0, ambiguous: 0 })
  assert.equal(monitor.isInterrupted(), true)

  audioContext.state = "running"
  audioContext.emit("statechange")
  assert.deepEqual(callbacks.calls, { interrupted: 1, recovered: 1, ambiguous: 0 })
  assert.equal(monitor.isInterrupted(), false)
})

test("carrier external pause is ambiguous without a current specific signal", () => {
  const carrier = createEventTargetFake()
  const callbacks = createCallbacks()
  const monitor = createAtmosphereInterruptionMonitor({
    audioSession: createEventTargetFake({ state: "active", type: "auto" }),
    audioContext: undefined,
    carrier,
    documentTarget: createEventTargetFake({ hidden: false, visibilityState: "visible" }),
    ...callbacks,
  })

  monitor.start()
  carrier.emit("pause", { origin: "external" })
  carrier.emit("pause", { detail: { origin: "external" } })

  assert.deepEqual(callbacks.calls, { interrupted: 0, recovered: 0, ambiguous: 2 })
  assert.equal(monitor.isInterrupted(), false)
})

test("carrier internal pause events from app pause or stop do nothing", () => {
  const carrier = createEventTargetFake()
  const callbacks = createCallbacks()
  const monitor = createAtmosphereInterruptionMonitor({
    audioSession: undefined,
    audioContext: createEventTargetFake({ state: "running" }),
    carrier,
    documentTarget: createEventTargetFake({ hidden: false, visibilityState: "visible" }),
    ...callbacks,
  })

  monitor.start()
  carrier.emit("pause", { origin: "internal" })
  carrier.emit("pause", { detail: { origin: "internal" } })

  assert.deepEqual(callbacks.calls, { interrupted: 0, recovered: 0, ambiguous: 0 })
  assert.equal(monitor.isInterrupted(), false)
})

test("visibility changes while hidden never establish an interruption", () => {
  const audioSession = createEventTargetFake({ state: "active", type: "auto" })
  const documentTarget = createEventTargetFake({ hidden: true, visibilityState: "hidden" })
  const callbacks = createCallbacks()
  const monitor = createAtmosphereInterruptionMonitor({
    audioSession,
    audioContext: undefined,
    carrier: createEventTargetFake(),
    documentTarget,
    ...callbacks,
  })

  monitor.start()
  documentTarget.emit("visibilitychange")

  assert.deepEqual(callbacks.calls, { interrupted: 0, recovered: 0, ambiguous: 0 })
  assert.equal(monitor.isInterrupted(), false)
})

test("visibility return recovers only an observed interruption whose signal cleared", () => {
  const audioSession = createEventTargetFake({ state: "active", type: "auto" })
  const documentTarget = createEventTargetFake({ hidden: false, visibilityState: "visible" })
  const callbacks = createCallbacks()
  const monitor = createAtmosphereInterruptionMonitor({
    audioSession,
    audioContext: undefined,
    carrier: createEventTargetFake(),
    documentTarget,
    ...callbacks,
  })

  monitor.start()
  audioSession.state = "interrupted"
  audioSession.emit("statechange")
  documentTarget.hidden = true
  documentTarget.visibilityState = "hidden"
  documentTarget.emit("visibilitychange")

  audioSession.state = "active"
  audioSession.emit("statechange")
  assert.deepEqual(callbacks.calls, { interrupted: 1, recovered: 0, ambiguous: 0 })
  assert.equal(monitor.isInterrupted(), true)

  documentTarget.hidden = false
  documentTarget.visibilityState = "visible"
  documentTarget.emit("visibilitychange")
  documentTarget.emit("visibilitychange")

  assert.deepEqual(callbacks.calls, { interrupted: 1, recovered: 1, ambiguous: 0 })
  assert.equal(monitor.isInterrupted(), false)
})

test("visibility return does not recover while the specific signal remains interrupted", () => {
  const audioContext = createEventTargetFake({ state: "running" })
  const documentTarget = createEventTargetFake({ hidden: false, visibilityState: "visible" })
  const callbacks = createCallbacks()
  const monitor = createAtmosphereInterruptionMonitor({
    audioSession: undefined,
    audioContext,
    carrier: createEventTargetFake(),
    documentTarget,
    ...callbacks,
  })

  monitor.start()
  audioContext.state = "interrupted"
  audioContext.emit("statechange")
  documentTarget.hidden = true
  documentTarget.visibilityState = "hidden"
  documentTarget.emit("visibilitychange")
  documentTarget.hidden = false
  documentTarget.visibilityState = "visible"
  documentTarget.emit("visibilitychange")

  assert.deepEqual(callbacks.calls, { interrupted: 1, recovered: 0, ambiguous: 0 })
  assert.equal(monitor.isInterrupted(), true)
})

test("dispose removes every listener once and ignores late events", () => {
  const audioSession = createEventTargetFake({ state: "active", type: "auto" })
  const carrier = createEventTargetFake()
  const documentTarget = createEventTargetFake({ hidden: false, visibilityState: "visible" })
  const callbacks = createCallbacks()
  const monitor = createAtmosphereInterruptionMonitor({
    audioSession,
    audioContext: undefined,
    carrier,
    documentTarget,
    ...callbacks,
  })

  monitor.start()
  monitor.start()
  assert.equal(audioSession.listenerCount("statechange"), 1)
  assert.equal(carrier.listenerCount("pause"), 1)
  assert.equal(documentTarget.listenerCount("visibilitychange"), 1)

  monitor.dispose()
  monitor.dispose()
  assert.equal(audioSession.listenerCount("statechange"), 0)
  assert.equal(carrier.listenerCount("pause"), 0)
  assert.equal(documentTarget.listenerCount("visibilitychange"), 0)

  audioSession.state = "interrupted"
  audioSession.emit("statechange")
  carrier.emit("pause", { origin: "external" })
  documentTarget.emit("visibilitychange")
  assert.deepEqual(callbacks.calls, { interrupted: 0, recovered: 0, ambiguous: 0 })
  assert.equal(monitor.isInterrupted(), false)
  assert.equal(monitor.isAvailable(), false)
})

test("unsupported interruption APIs neither throw nor claim availability", () => {
  const callbacks = createCallbacks()
  const monitor = createAtmosphereInterruptionMonitor({
    audioSession: { state: "active" },
    audioContext: undefined,
    carrier: undefined,
    documentTarget: undefined,
    ...callbacks,
  })

  assert.equal(monitor.isAvailable(), false)
  assert.doesNotThrow(() => monitor.start())
  assert.equal(monitor.isAvailable(), false)
  assert.equal(monitor.isInterrupted(), false)
  assert.doesNotThrow(() => monitor.dispose())
  assert.deepEqual(callbacks.calls, { interrupted: 0, recovered: 0, ambiguous: 0 })
})
