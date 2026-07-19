import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  DEFAULT_MUSIC_VISUALIZER_ACCOUNT_PREFERENCES,
  DEFAULT_MUSIC_VISUALIZER_DEVICE_PREFERENCES,
  MUSIC_VISUALIZER_APP_SETTINGS_KEY,
  buildMusicVisualizerHref,
  normalizeMusicVisualizerAccountPreferences,
  normalizeMusicVisualizerDevicePreferences,
  resolveMusicVisualizerBackground,
  sanitizeMusicVisualizerReturnTo,
} from "../lib/music-visualizer.js"

describe("music visualizer preferences", () => {
  it("defines stable device and account defaults", () => {
    assert.equal(MUSIC_VISUALIZER_APP_SETTINGS_KEY, "musicVisualizer")
    assert.deepEqual(DEFAULT_MUSIC_VISUALIZER_DEVICE_PREFERENCES, {
      backgroundId: null,
      showClock: false,
    })
    assert.deepEqual(DEFAULT_MUSIC_VISUALIZER_ACCOUNT_PREFERENCES, {
      defaultBackgroundId: null,
      showClock: false,
    })
    assert.equal(Object.isFrozen(DEFAULT_MUSIC_VISUALIZER_DEVICE_PREFERENCES), true)
    assert.equal(Object.isFrozen(DEFAULT_MUSIC_VISUALIZER_ACCOUNT_PREFERENCES), true)
  })

  it("normalizes device preferences and drops unknown fields", () => {
    assert.deepEqual(normalizeMusicVisualizerDevicePreferences({
      backgroundId: "  aurora-bars  ",
      showClock: true,
      panel: "background",
    }), {
      backgroundId: "aurora-bars",
      showClock: true,
    })
    assert.deepEqual(normalizeMusicVisualizerDevicePreferences({
      backgroundId: "   ",
      showClock: "true",
      unknown: true,
    }), DEFAULT_MUSIC_VISUALIZER_DEVICE_PREFERENCES)
    assert.deepEqual(
      normalizeMusicVisualizerDevicePreferences({ backgroundId: 42, showClock: 1 }),
      DEFAULT_MUSIC_VISUALIZER_DEVICE_PREFERENCES,
    )
    assert.deepEqual(
      normalizeMusicVisualizerDevicePreferences(null),
      DEFAULT_MUSIC_VISUALIZER_DEVICE_PREFERENCES,
    )
  })

  it("normalizes account preferences and accepts only literal booleans", () => {
    assert.deepEqual(normalizeMusicVisualizerAccountPreferences({
      defaultBackgroundId: "  pixel-liquid  ",
      showClock: true,
      backgroundId: "ignored-device-value",
    }), {
      defaultBackgroundId: "pixel-liquid",
      showClock: true,
    })
    assert.deepEqual(normalizeMusicVisualizerAccountPreferences({
      defaultBackgroundId: "",
      showClock: "false",
      unknown: true,
    }), DEFAULT_MUSIC_VISUALIZER_ACCOUNT_PREFERENCES)
    assert.deepEqual(normalizeMusicVisualizerAccountPreferences({
      defaultBackgroundId: {},
      showClock: false,
    }), DEFAULT_MUSIC_VISUALIZER_ACCOUNT_PREFERENCES)
    assert.deepEqual(
      normalizeMusicVisualizerAccountPreferences(undefined),
      DEFAULT_MUSIC_VISUALIZER_ACCOUNT_PREFERENCES,
    )
  })
})

describe("music visualizer background selection", () => {
  const canUseBackground = (backgroundId) => ["device-id", "default-id"].includes(backgroundId)

  it("prefers an eligible device selection", () => {
    assert.deepEqual(resolveMusicVisualizerBackground({
      deviceBackgroundId: "device-id",
      accountDefaultBackgroundId: "default-id",
      canUseBackground,
    }), {
      backgroundId: "device-id",
      source: "device",
      unavailableSavedId: null,
    })
  })

  it("falls through to an eligible account default", () => {
    assert.deepEqual(resolveMusicVisualizerBackground({
      deviceBackgroundId: "locked-id",
      accountDefaultBackgroundId: "default-id",
      canUseBackground,
    }), {
      backgroundId: "default-id",
      source: "account",
      unavailableSavedId: null,
    })
  })

  it("preserves the first unavailable saved ID when no selection is usable", () => {
    assert.deepEqual(resolveMusicVisualizerBackground({
      deviceBackgroundId: "locked-id",
      accountDefaultBackgroundId: "missing-id",
      canUseBackground,
    }), {
      backgroundId: null,
      source: "none",
      unavailableSavedId: "locked-id",
    })
    assert.deepEqual(resolveMusicVisualizerBackground({
      deviceBackgroundId: " ",
      accountDefaultBackgroundId: "missing-id",
      canUseBackground,
    }), {
      backgroundId: null,
      source: "none",
      unavailableSavedId: "missing-id",
    })
    assert.deepEqual(resolveMusicVisualizerBackground({
      deviceBackgroundId: null,
      accountDefaultBackgroundId: undefined,
      canUseBackground,
    }), {
      backgroundId: null,
      source: "none",
      unavailableSavedId: null,
    })
  })
})

describe("music visualizer routing", () => {
  it("accepts single-slash internal return paths", () => {
    assert.equal(sanitizeMusicVisualizerReturnTo("/music"), "/music")
    assert.equal(
      sanitizeMusicVisualizerReturnTo("/wellness?tab=quick-log"),
      "/wellness?tab=quick-log",
    )
    assert.equal(
      sanitizeMusicVisualizerReturnTo("  /account/settings?tab=profile  "),
      "/account/settings?tab=profile",
    )
    assert.equal(sanitizeMusicVisualizerReturnTo("/clock?source=timer"), "/clock?source=timer")
  })

  it("falls back for external, backslash, empty, and recursive return paths", () => {
    for (const unsafeValue of [
      "https://example.com",
      "//example.com",
      "\\\\example.com",
      "/\\example.com",
      "\\music",
      "/music\\settings",
      "",
      "   ",
      null,
      "/clock?source=music",
      "/clock?panel=background&source=music",
      "/clock/?source=music",
    ]) {
      assert.equal(sanitizeMusicVisualizerReturnTo(unsafeValue), "/music")
    }
  })

  it("builds a clock href with the sanitized return target encoded once", () => {
    assert.equal(
      buildMusicVisualizerHref({ returnTo: "/wellness?tab=quick-log" }),
      "/clock?source=music&returnTo=%2Fwellness%3Ftab%3Dquick-log",
    )
    assert.equal(
      buildMusicVisualizerHref({ returnTo: "https://example.com" }),
      "/clock?source=music&returnTo=%2Fmusic",
    )
  })

  it("opens the background panel only when selection is required", () => {
    assert.equal(
      buildMusicVisualizerHref({ returnTo: "/music", openBackgroundPanel: false }),
      "/clock?source=music&returnTo=%2Fmusic",
    )
    assert.equal(
      buildMusicVisualizerHref({ returnTo: "/music", openBackgroundPanel: true }),
      "/clock?source=music&returnTo=%2Fmusic&panel=background",
    )
  })
})
