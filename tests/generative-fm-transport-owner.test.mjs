import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { createGenerativeFmTransportOwner } from "../lib/atmosphere/generative-fm-transport-owner.js"

function createFakeTransport() {
  const callbacks = new Set()
  let startAttempt = 0

  return {
    callbacks,
    cancel() {
      callbacks.clear()
    },
    schedule(label, { fail = false } = {}) {
      return () => {
        callbacks.add(label)
        if (fail) throw new Error(`${label} schedule failed`)
        return () => callbacks.delete(label)
      }
    },
    start({ failAttempt } = {}) {
      startAttempt += 1
      if (startAttempt === failAttempt) throw new Error("transport start failed")
    },
  }
}

describe("Generative.fm shared Transport ownership", () => {
  it("restores the incumbent schedule when a replacement schedule fails after cancellation", () => {
    const transport = createFakeTransport()
    const owner = createGenerativeFmTransportOwner()
    const incumbent = owner.replace({
      cancel: () => transport.cancel(),
      schedule: transport.schedule("incumbent"),
      start: () => transport.start(),
    })

    assert.throws(() => owner.replace({
      cancel: () => transport.cancel(),
      schedule: transport.schedule("candidate", { fail: true }),
      start: () => transport.start(),
    }), /candidate schedule failed/)

    assert.equal(owner.isOwner(incumbent), true)
    assert.deepEqual([...transport.callbacks], ["incumbent"])
  })

  it("restores the incumbent schedule and ownership when replacement Transport.start fails", () => {
    const transport = createFakeTransport()
    const owner = createGenerativeFmTransportOwner()
    const incumbent = owner.replace({
      cancel: () => transport.cancel(),
      schedule: transport.schedule("incumbent"),
      start: () => transport.start(),
    })

    assert.throws(() => owner.replace({
      cancel: () => transport.cancel(),
      schedule: transport.schedule("candidate"),
      start: () => transport.start({ failAttempt: 2 }),
    }), /transport start failed/)

    assert.equal(owner.isOwner(incumbent), true)
    assert.deepEqual([...transport.callbacks], ["incumbent"])
  })

  it("does not let an obsolete replacement restore over a newer owner", () => {
    const transport = createFakeTransport()
    const owner = createGenerativeFmTransportOwner()
    owner.replace({
      cancel: () => transport.cancel(),
      schedule: transport.schedule("incumbent"),
      start: () => transport.start(),
    })
    let newerOwner

    assert.throws(() => owner.replace({
      cancel: () => transport.cancel(),
      schedule() {
        newerOwner = owner.replace({
          cancel: () => transport.cancel(),
          schedule: transport.schedule("newer"),
          start: () => transport.start(),
        })
        return () => transport.callbacks.delete("obsolete")
      },
      start: () => transport.start(),
    }), /superseded/)

    assert.equal(owner.isOwner(newerOwner), true)
    assert.deepEqual([...transport.callbacks], ["newer"])
  })
})
