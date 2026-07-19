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

  it("always requests wake lock for active ordinary Clock", () => {
    for (const keepScreenAwake of [true, false, "true", undefined]) {
      assert.equal(shouldRequestImmersiveWakeLock({
        context: IMMERSIVE_DISPLAY_CONTEXTS.clock,
        timerStatus: "clock",
        keepScreenAwake,
      }), true)
    }
  })

  it("always requests wake lock for an active Music visualizer even when its clock is hidden", () => {
    for (const keepScreenAwake of [true, false, "true", undefined]) {
      assert.equal(shouldRequestImmersiveWakeLock({
        context: IMMERSIVE_DISPLAY_CONTEXTS.musicVisualizer,
        timerStatus: "clock",
        keepScreenAwake,
      }), true)
    }
  })

  it("lets only active Chimer opt out of wake lock", () => {
    assert.equal(shouldRequestImmersiveWakeLock({
      context: IMMERSIVE_DISPLAY_CONTEXTS.chimer,
      timerStatus: "running",
      keepScreenAwake: true,
    }), true)

    for (const keepScreenAwake of [false, "true", undefined]) {
      assert.equal(shouldRequestImmersiveWakeLock({
        context: IMMERSIVE_DISPLAY_CONTEXTS.chimer,
        timerStatus: "running",
        keepScreenAwake,
      }), false)
    }
  })

  it("never requests wake lock while the immersive display is idle", () => {
    for (const context of Object.values(IMMERSIVE_DISPLAY_CONTEXTS)) {
      for (const keepScreenAwake of [true, false, "true", undefined]) {
        assert.equal(shouldRequestImmersiveWakeLock({
          context,
          timerStatus: "idle",
          keepScreenAwake,
        }), false)
      }
    }
  })

  it("rejects unrecognized contexts", () => {
    assert.equal(shouldRequestImmersiveWakeLock({
      context: "unknown",
      timerStatus: "clock",
      keepScreenAwake: true,
    }), false)
  })
})
