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

    await controller.start({ id: "mlab-proof-drone", runtime: { adapterId: "tone-proof-drone" } })

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
