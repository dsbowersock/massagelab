import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  PATTERNED_ACTIVE_RENDERER_IDS,
  shouldRenderBackgroundFallbackUnderlay,
} from "../components/backgrounds/backgroundUnderlayPolicy.ts"

const affectedIds = [
  "massage-lab-ripple-grid",
  "massage-lab-dot-field",
  "massage-lab-dot-grid",
  "massage-lab-shape-grid",
]

describe("background fallback underlay policy", () => {
  it("suppresses exactly the four patterned underlays whenever their effect is visibly mounted", () => {
    assert.deepEqual([...PATTERNED_ACTIVE_RENDERER_IDS].sort(), [...affectedIds].sort())
    for (const backgroundId of affectedIds) {
      assert.equal(shouldRenderBackgroundFallbackUnderlay({ backgroundId, effectMounted: true }), false)
    }
  })

  it("retains the fallback during initial paint, loading, errors, and reduced-motion non-mounts", () => {
    for (const backgroundId of affectedIds) {
      assert.equal(shouldRenderBackgroundFallbackUnderlay({ backgroundId, effectMounted: false }), true)
    }
  })

  it("does not alter unrelated or transparent renderer fallback behavior", () => {
    for (const backgroundId of ["massage-lab-dark-veil", "massage-lab-waves", "massage-lab-aurora"]) {
      assert.equal(shouldRenderBackgroundFallbackUnderlay({ backgroundId, effectMounted: true }), true)
    }
  })
})
