import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  IMMERSIVE_DISPLAY_CONTEXTS,
  resolveImmersiveDisplayContext,
  shouldRequestImmersiveWakeLock,
} from "../lib/immersive-display.js"

describe("immersive display rules", () => {
  it("resolves Clock and Music visualizer contexts from the Clock route", () => {
    assert.equal(
      resolveImmersiveDisplayContext({ pathname: "/clock", source: "music" }),
      IMMERSIVE_DISPLAY_CONTEXTS.musicVisualizer,
    )
    assert.equal(
      resolveImmersiveDisplayContext({ pathname: "/clock", source: null }),
      IMMERSIVE_DISPLAY_CONTEXTS.clock,
    )
  })

  it("resolves the active Chimer route independently of the Clock source query", () => {
    assert.equal(
      resolveImmersiveDisplayContext({ pathname: "/chimer", source: "music" }),
      IMMERSIVE_DISPLAY_CONTEXTS.chimer,
    )
  })

  it("requests wake lock for active displays only when the preference is literally true", () => {
    const activeDisplays = [
      { context: IMMERSIVE_DISPLAY_CONTEXTS.chimer, timerStatus: "running" },
      { context: IMMERSIVE_DISPLAY_CONTEXTS.clock, timerStatus: "clock" },
      { context: IMMERSIVE_DISPLAY_CONTEXTS.musicVisualizer, timerStatus: "clock" },
    ]

    for (const display of activeDisplays) {
      assert.equal(shouldRequestImmersiveWakeLock({ ...display, keepScreenAwake: true }), true)
      assert.equal(shouldRequestImmersiveWakeLock({ ...display, keepScreenAwake: false }), false)
      assert.equal(shouldRequestImmersiveWakeLock({ ...display, keepScreenAwake: "true" }), false)
    }
  })

  it("never requests wake lock while the Chimer setup is idle", () => {
    for (const context of Object.values(IMMERSIVE_DISPLAY_CONTEXTS)) {
      assert.equal(shouldRequestImmersiveWakeLock({
        context,
        timerStatus: "idle",
        keepScreenAwake: true,
      }), false)
    }
  })

  it("does not let ordinary Clock bypass the keep-screen-awake preference", () => {
    assert.equal(shouldRequestImmersiveWakeLock({
      context: IMMERSIVE_DISPLAY_CONTEXTS.clock,
      timerStatus: "clock",
      keepScreenAwake: false,
    }), false)
  })
})
