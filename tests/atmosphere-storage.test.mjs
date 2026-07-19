import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  ATMOSPHERE_STORAGE_KEY,
  ATMOSPHERE_STORAGE_VERSION,
  LEGACY_ATMOSPHERE_STORAGE_KEY,
  createDefaultAtmosphereStorage,
  parseAtmosphereStorage,
  serializeAtmosphereStorage,
} from "../lib/atmosphere/storage.js"

const DEFAULT_STATE = {
  version: 2,
  favorites: [],
  recentStations: [],
  volume: 0.75,
  miniPlayerCollapsed: false,
  visualizer: {
    backgroundId: null,
    showClock: false,
  },
  migrations: {
    legacyMusicBackground: true,
  },
}

describe("Atmosphere local storage helpers", () => {
  it("defines explicit current and legacy storage keys", () => {
    assert.equal(ATMOSPHERE_STORAGE_KEY, "massagelab-atmosphere-v2")
    assert.equal(LEGACY_ATMOSPHERE_STORAGE_KEY, "massagelab-atmosphere-v1")
    assert.equal(ATMOSPHERE_STORAGE_VERSION, 2)
  })

  it("creates safe v2 defaults", () => {
    assert.deepEqual(createDefaultAtmosphereStorage(), DEFAULT_STATE)
  })

  it("returns persistable defaults for fresh state", () => {
    assert.deepEqual(parseAtmosphereStorage(null), {
      status: "ready",
      state: DEFAULT_STATE,
      shouldPersist: true,
    })
  })

  it("makes an explicit v2 background, including null, authoritative", () => {
    const rawValue = JSON.stringify({
      version: 2,
      favorites: ["mlab-proof-drone", "mlab-proof-drone"],
      recentStations: ["observable-streams-probe", "mlab-proof-drone"],
      volume: 0.35,
      miniPlayerCollapsed: true,
      visualizer: {
        backgroundId: null,
        showClock: true,
      },
      migrations: {
        legacyMusicBackground: false,
      },
    })

    assert.deepEqual(
      parseAtmosphereStorage(rawValue, {
        legacyBackgroundId: "massage-lab-aurora",
      }),
      {
        status: "ready",
        state: {
          version: 2,
          favorites: ["mlab-proof-drone"],
          recentStations: ["observable-streams-probe", "mlab-proof-drone"],
          volume: 0.35,
          miniPlayerCollapsed: true,
          visualizer: {
            backgroundId: null,
            showClock: true,
          },
          migrations: {
            legacyMusicBackground: true,
          },
        },
        shouldPersist: true,
      },
    )
  })

  it("migrates v1 audio state without losing normalized device preferences", () => {
    const legacyRawValue = JSON.stringify({
      version: 1,
      favorites: ["mlab-proof-drone", "mlab-proof-drone", ""],
      recentStations: Array.from({ length: 14 }, (_, index) => "station-" + index),
      volume: 2,
      miniPlayerCollapsed: true,
    })

    const result = parseAtmosphereStorage(null, { legacyRawValue })

    assert.equal(result.status, "ready")
    assert.equal(result.shouldPersist, true)
    assert.deepEqual(result.state, {
      ...DEFAULT_STATE,
      favorites: ["mlab-proof-drone"],
      recentStations: Array.from({ length: 12 }, (_, index) => "station-" + index),
      volume: 1,
      miniPlayerCollapsed: true,
    })
  })

  it("consumes the legacy Music background during the first v1 migration", () => {
    const legacyRawValue = JSON.stringify({
      version: 1,
      favorites: ["observable-streams-probe"],
      recentStations: ["observable-streams-probe"],
      volume: -1,
      miniPlayerCollapsed: false,
    })

    assert.deepEqual(
      parseAtmosphereStorage(null, {
        legacyRawValue,
        legacyBackgroundId: "  massage-lab-aurora  ",
      }),
      {
        status: "ready",
        state: {
          ...DEFAULT_STATE,
          favorites: ["observable-streams-probe"],
          recentStations: ["observable-streams-probe"],
          volume: 0,
          visualizer: {
            backgroundId: "massage-lab-aurora",
            showClock: false,
          },
        },
        shouldPersist: true,
      },
    )
  })

  it("uses the legacy Music background only when v2 has no visualizer field or consumed marker", () => {
    const unconsumedRawValue = JSON.stringify({
      version: 2,
      migrations: { legacyMusicBackground: false },
    })
    const consumedRawValue = JSON.stringify({
      version: 2,
      migrations: { legacyMusicBackground: true },
    })

    assert.equal(
      parseAtmosphereStorage(unconsumedRawValue, {
        legacyBackgroundId: "massage-lab-aurora",
      }).state.visualizer.backgroundId,
      "massage-lab-aurora",
    )
    assert.equal(
      parseAtmosphereStorage(consumedRawValue, {
        legacyBackgroundId: "massage-lab-aurora",
      }).state.visualizer.backgroundId,
      null,
    )
  })

  it("returns persistable defaults for malformed JSON", () => {
    assert.deepEqual(parseAtmosphereStorage("{not json"), {
      status: "ready",
      state: DEFAULT_STATE,
      shouldPersist: true,
    })
  })

  it("preserves future-version storage without normalizing or overwriting it", () => {
    const rawValue = '{"version":99,"future":{"opaque":true}}'
    const result = parseAtmosphereStorage(rawValue, {
      legacyRawValue: JSON.stringify({ version: 1, favorites: ["legacy"] }),
      legacyBackgroundId: "massage-lab-aurora",
    })

    assert.deepEqual(result, {
      status: "unsupported-version",
      rawVersion: 99,
      rawValue,
    })
    assert.throws(
      () => serializeAtmosphereStorage(result),
      /Unsupported Atmosphere storage cannot be serialized/,
    )
  })

  it("serializes only supported v2 fields and round trips them", () => {
    const serialized = serializeAtmosphereStorage({
      version: 99,
      favorites: ["mlab-proof-drone", "mlab-proof-drone"],
      recentStations: ["mlab-proof-drone"],
      volume: 2,
      miniPlayerCollapsed: true,
      visualizer: {
        backgroundId: "  massage-lab-aurora  ",
        showClock: true,
        ignored: "not persisted",
      },
      migrations: {
        legacyMusicBackground: false,
        ignored: true,
      },
      ignored: "not persisted",
    })

    assert.equal(
      serialized,
      JSON.stringify({
        version: 2,
        favorites: ["mlab-proof-drone"],
        recentStations: ["mlab-proof-drone"],
        volume: 1,
        miniPlayerCollapsed: true,
        visualizer: {
          backgroundId: "massage-lab-aurora",
          showClock: true,
        },
        migrations: {
          legacyMusicBackground: true,
        },
      }),
    )
    assert.deepEqual(parseAtmosphereStorage(serialized), {
      status: "ready",
      state: JSON.parse(serialized),
      shouldPersist: false,
    })
  })
})
