import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { createAtmosphereRuntimeController } from "../lib/atmosphere/runtime-controller.js"

describe("Atmosphere runtime controller", () => {
  it("starts a playable station and records the cleanup handle", async () => {
    const events = []
    const controller = createAtmosphereRuntimeController({
      adapters: {
        "tone-proof-drone": async ({ station }) => {
          events.push(`start:${station.id}`)
          return () => events.push(`stop:${station.id}`)
        },
      },
    })

    assert.deepEqual(
      await controller.start({ id: "mlab-proof-drone", runtime: { adapterId: "tone-proof-drone" } }),
      { status: "active", requestId: 1 },
    )

    assert.equal(controller.getActiveStationId(), "mlab-proof-drone")
    assert.deepEqual(events, ["start:mlab-proof-drone"])
  })

  it("stops the previous station before replacement", async () => {
    const events = []
    const controller = createAtmosphereRuntimeController({
      adapters: {
        a: async ({ station }) => {
          events.push(`start:${station.id}`)
          return () => events.push(`stop:${station.id}`)
        },
      },
    })

    await controller.start({ id: "one", runtime: { adapterId: "a" } })
    await controller.start({ id: "two", runtime: { adapterId: "a" } })

    assert.equal(controller.getActiveStationId(), "two")
    assert.deepEqual(events, ["start:one", "stop:one", "start:two"])
  })

  it("activates the newest overlapping start without waiting for an older adapter", async () => {
    const events = []
    let releaseFirst
    let releaseSecond
    let firstAdapterEntered
    let secondAdapterEntered
    const firstReady = new Promise((resolve) => {
      releaseFirst = resolve
    })
    const secondReady = new Promise((resolve) => {
      releaseSecond = resolve
    })
    const firstEntered = new Promise((resolve) => {
      firstAdapterEntered = resolve
    })
    const secondEntered = new Promise((resolve) => {
      secondAdapterEntered = resolve
    })
    const controller = createAtmosphereRuntimeController({
      adapters: {
        a: async ({ station }) => {
          events.push(`start:${station.id}`)
          if (station.id === "one") {
            firstAdapterEntered()
            await firstReady
          } else {
            secondAdapterEntered()
            await secondReady
          }
          return () => events.push(`dispose:${station.id}`)
        },
      },
    })

    const firstStart = controller.start({ id: "one", runtime: { adapterId: "a" } })
    await firstEntered
    const secondStart = controller.start({ id: "two", runtime: { adapterId: "a" } })
    await secondEntered

    releaseSecond()
    assert.deepEqual(await secondStart, { status: "active", requestId: 2 })
    releaseFirst()
    assert.deepEqual(await firstStart, { status: "stale", requestId: 1 })

    assert.equal(controller.getActiveStationId(), "two")
    assert.deepEqual(events, ["start:one", "start:two", "dispose:one"])
  })

  it("returns from stop while adapter preparation remains unresolved", async () => {
    const events = []
    let releaseStart
    const startReady = new Promise((resolve) => {
      releaseStart = resolve
    })
    const controller = createAtmosphereRuntimeController({
      adapters: {
        a: async ({ station }) => {
          events.push(`start:${station.id}`)
          await startReady
          return () => events.push(`stop:${station.id}`)
        },
      },
    })

    const start = controller.start({ id: "one", runtime: { adapterId: "a" } })
    await Promise.resolve()
    assert.deepEqual(await controller.stop(), { requestId: 2 })
    assert.equal(controller.getActiveStationId(), null)

    releaseStart()
    assert.deepEqual(await start, { status: "stale", requestId: 1 })

    assert.equal(controller.getActiveStationId(), null)
    assert.deepEqual(events, ["start:one", "stop:one"])
  })

  it("does not reactivate a station after a stop cancels a slow start", async () => {
    const events = []
    let releaseStart
    const startReady = new Promise((resolve) => {
      releaseStart = resolve
    })
    const controller = createAtmosphereRuntimeController({
      adapters: {
        a: async ({ station }) => {
          events.push(`start:${station.id}`)
          await startReady
          return () => events.push(`stop:${station.id}`)
        },
      },
    })

    const start = controller.start({ id: "one", runtime: { adapterId: "a" } })
    const stop = controller.stop()

    releaseStart()
    await start

    assert.equal(controller.getActiveStationId(), null)
    assert.deepEqual(events, ["start:one", "stop:one"])

    await stop
    assert.equal(controller.getActiveStationId(), null)
  })

  it("keeps a newer active station when a stale adapter rejects", async () => {
    let rejectFirst
    let firstAdapterEntered
    const firstRejected = new Promise((_, reject) => {
      rejectFirst = reject
    })
    const firstEntered = new Promise((resolve) => {
      firstAdapterEntered = resolve
    })
    const controller = createAtmosphereRuntimeController({
      adapters: {
        a: async ({ station }) => {
          if (station.id === "one") {
            firstAdapterEntered()
            await firstRejected
          }
        },
      },
    })

    const firstStart = controller.start({ id: "one", runtime: { adapterId: "a" } })
    await firstEntered
    assert.deepEqual(
      await controller.start({ id: "two", runtime: { adapterId: "a" } }),
      { status: "active", requestId: 2 },
    )

    rejectFirst(new Error("First audio failed"))
    await assert.rejects(() => firstStart, /First audio failed/)
    assert.equal(controller.getActiveStationId(), "two")
  })

  it("disposes each of two stale activations exactly once", async () => {
    const events = []
    const releases = new Map()
    const entered = new Map()
    const controller = createAtmosphereRuntimeController({
      adapters: {
        a: async ({ station }) => {
          if (station.id !== "three") {
            const ready = new Promise((resolve) => releases.set(station.id, resolve))
            entered.set(station.id, true)
            await ready
          }
          return () => events.push(`dispose:${station.id}`)
        },
      },
    })

    const firstStart = controller.start({ id: "one", runtime: { adapterId: "a" } })
    while (!entered.has("one")) await Promise.resolve()
    const secondStart = controller.start({ id: "two", runtime: { adapterId: "a" } })
    while (!entered.has("two")) await Promise.resolve()
    assert.deepEqual(
      await controller.start({ id: "three", runtime: { adapterId: "a" } }),
      { status: "active", requestId: 3 },
    )

    releases.get("one")?.()
    releases.get("two")?.()
    assert.deepEqual(await firstStart, { status: "stale", requestId: 1 })
    assert.deepEqual(await secondStart, { status: "stale", requestId: 2 })
    await controller.stop()

    assert.deepEqual(events, ["dispose:one", "dispose:two", "dispose:three"])
  })

  it("detaches active cleanup before a replacement adapter resolves", async () => {
    const events = []
    let releaseSecond
    const secondReady = new Promise((resolve) => {
      releaseSecond = resolve
    })
    const controller = createAtmosphereRuntimeController({
      adapters: {
        a: async ({ station }) => {
          events.push(`start:${station.id}`)
          if (station.id === "two") await secondReady
          return () => events.push(`dispose:${station.id}`)
        },
      },
    })

    await controller.start({ id: "one", runtime: { adapterId: "a" } })
    const secondStart = controller.start({ id: "two", runtime: { adapterId: "a" } })

    assert.equal(controller.getActiveStationId(), null)
    assert.deepEqual(events, ["start:one", "dispose:one", "start:two"])
    releaseSecond()
    assert.deepEqual(await secondStart, { status: "active", requestId: 2 })
  })

  it("clears active state when a station fails to start", async () => {
    const events = []
    const controller = createAtmosphereRuntimeController({
      adapters: {
        bad: async () => {
          events.push("start:bad")
          throw new Error("Audio failed")
        },
      },
    })

    await assert.rejects(
      () => controller.start({ id: "bad-station", runtime: { adapterId: "bad" } }),
      /Audio failed/,
    )

    assert.equal(controller.getActiveStationId(), null)
    assert.deepEqual(events, ["start:bad"])
  })

  it("throws when an adapter is missing", async () => {
    const controller = createAtmosphereRuntimeController({ adapters: {} })

    await assert.rejects(
      () => controller.start({ id: "missing", runtime: { adapterId: "missing-adapter" } }),
      /No Atmosphere runtime adapter registered: missing-adapter/,
    )
  })
})
