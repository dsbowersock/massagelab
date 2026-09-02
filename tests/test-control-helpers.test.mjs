import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  boundedLatch,
  deferred,
  settlesWithin,
} from "./helpers/async-control.mjs"
import { drainEffectCleanups } from "./helpers/effect-cleanups.mjs"

describe("shared test control helpers", () => {
  it("keeps the deferred resolve-only and clears a bounded latch timer", async () => {
    const originalSetTimeout = globalThis.setTimeout
    const originalClearTimeout = globalThis.clearTimeout
    const timer = { kind: "test-timer" }
    const scheduledDelays = []
    const clearedTimers = []
    globalThis.setTimeout = (_callback, delay) => {
      scheduledDelays.push(delay)
      return timer
    }
    globalThis.clearTimeout = (value) => clearedTimers.push(value)

    try {
      const gate = deferred()
      assert.deepEqual(Object.keys(gate).sort(), ["promise", "resolve"])
      gate.resolve("released")
      assert.equal(await boundedLatch(gate.promise, "shared gate"), "released")
      assert.deepEqual(scheduledDelays, [1_000])
      assert.deepEqual(clearedTimers, [timer])
    } finally {
      globalThis.setTimeout = originalSetTimeout
      globalThis.clearTimeout = originalClearTimeout
    }
  })

  it("preserves label-based and caller-message timeout failures", async () => {
    await assert.rejects(
      boundedLatch(new Promise(() => {}), "owner lock", 1),
      /owner lock timed out/,
    )
    await assert.rejects(
      settlesWithin(new Promise(() => {}), 1, "exact caller failure"),
      /exact caller failure/,
    )
  })

  it("drains forward slots after clearing and preserves one error identity", () => {
    const slots = []
    const events = []
    const failure = new Error("single cleanup failure")
    slots.push(
      { cleanup: () => { assert.equal(slots.length, 0); events.push("first"); throw failure } },
      { cleanup: () => { assert.equal(slots.length, 0); events.push("second") } },
    )

    assert.throws(
      () => drainEffectCleanups(slots, { label: "Forward Provider" }),
      (error) => error === failure,
    )
    assert.deepEqual(events, ["first", "second"])
    assert.equal(slots.length, 0)
  })

  it("drains reverse slots and aggregates failures in execution order", () => {
    const firstFailure = new Error("first cleanup failure")
    const thirdFailure = new Error("third cleanup failure")
    const slots = [
      { cleanup: () => { throw firstFailure } },
      { cleanup: () => undefined },
      { cleanup: () => { throw thirdFailure } },
    ]

    assert.throws(
      () => drainEffectCleanups(slots, { label: "Reverse Provider", reverse: true }),
      (error) => error instanceof AggregateError
        && error.message === "Reverse Provider effect cleanups failed"
        && error.errors[0] === thirdFailure
        && error.errors[1] === firstFailure,
    )
    assert.equal(slots.length, 0)
  })
})
