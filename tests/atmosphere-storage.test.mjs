import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  ATMOSPHERE_STORAGE_KEY,
  ATMOSPHERE_STORAGE_VERSION,
  createDefaultAtmosphereStorage,
  parseAtmosphereStorage,
  serializeAtmosphereStorage,
} from "../lib/atmosphere/storage.js"

describe("Atmosphere local storage helpers", () => {
  it("defines a versioned storage key", () => {
    assert.equal(ATMOSPHERE_STORAGE_KEY, "massagelab-atmosphere-v1")
    assert.equal(ATMOSPHERE_STORAGE_VERSION, 1)
  })

  it("creates safe defaults", () => {
    assert.deepEqual(createDefaultAtmosphereStorage(), {
      version: 1,
      favorites: [],
      recentStations: [],
      volume: 0.75,
      miniPlayerCollapsed: false,
    })
  })

  it("parses valid persisted storage and normalizes duplicates", () => {
    const parsed = parseAtmosphereStorage(JSON.stringify({
      version: 1,
      favorites: ["mlab-proof-drone", "mlab-proof-drone"],
      recentStations: ["observable-streams-probe", "mlab-proof-drone"],
      volume: 0.35,
      miniPlayerCollapsed: true,
    }))

    assert.deepEqual(parsed.favorites, ["mlab-proof-drone"])
    assert.deepEqual(parsed.recentStations, ["observable-streams-probe", "mlab-proof-drone"])
    assert.equal(parsed.volume, 0.35)
    assert.equal(parsed.miniPlayerCollapsed, true)
  })

  it("falls back to defaults for malformed or unsupported data", () => {
    assert.deepEqual(parseAtmosphereStorage("{not json"), createDefaultAtmosphereStorage())
    assert.deepEqual(parseAtmosphereStorage(JSON.stringify({ version: 99 })), createDefaultAtmosphereStorage())
  })

  it("serializes only supported fields", () => {
    assert.equal(
      serializeAtmosphereStorage({
        version: 1,
        favorites: ["mlab-proof-drone"],
        recentStations: ["mlab-proof-drone"],
        volume: 2,
        miniPlayerCollapsed: false,
        ignored: "not persisted",
      }),
      JSON.stringify({
        version: 1,
        favorites: ["mlab-proof-drone"],
        recentStations: ["mlab-proof-drone"],
        volume: 1,
        miniPlayerCollapsed: false,
      }),
    )
  })
})
