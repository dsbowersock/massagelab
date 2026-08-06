import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  PATTERNED_ACTIVE_RENDERER_IDS,
  reduceBackgroundRendererReadiness,
  shouldRenderBackgroundFallbackUnderlay,
} from "../components/backgrounds/backgroundUnderlayPolicy.ts"

const affectedIds = [
  "massage-lab-ripple-grid",
  "massage-lab-dot-field",
  "massage-lab-dot-grid",
  "massage-lab-shape-grid",
]

describe("background fallback underlay policy", () => {
  it("suppresses exactly the four patterned underlays only after a successful frame", () => {
    assert.deepEqual([...PATTERNED_ACTIVE_RENDERER_IDS].sort(), [...affectedIds].sort())
    for (const backgroundId of affectedIds) {
      assert.equal(shouldRenderBackgroundFallbackUnderlay({ backgroundId, effectReady: true }), false)
    }
  })

  it("retains the fallback before import, after import but before draw, and after failure or reset", () => {
    const notReadyLifecycleStates = [
      "initial paint",
      "imported but not drawn",
      "initialization failure",
      "readiness reset",
    ]
    for (const backgroundId of affectedIds) {
      for (const lifecycleState of notReadyLifecycleStates) {
        assert.equal(
          shouldRenderBackgroundFallbackUnderlay({ backgroundId, effectReady: false }),
          true,
          `${backgroundId}:${lifecycleState}`,
        )
      }
    }
  })

  it("does not alter unrelated or transparent renderer fallback behavior", () => {
    for (const backgroundId of ["massage-lab-dark-veil", "massage-lab-waves", "massage-lab-aurora"]) {
      assert.equal(shouldRenderBackgroundFallbackUnderlay({ backgroundId, effectReady: true }), true)
    }
  })

  it("tracks readiness by load generation and ignores stale renderer resets", () => {
    const firstAttempt = { backgroundId: affectedIds[0], loadGeneration: 1 }
    const secondAttempt = { backgroundId: affectedIds[0], loadGeneration: 2 }

    const firstReady = reduceBackgroundRendererReadiness(null, {
      attempt: firstAttempt,
      ready: true,
    })
    assert.deepEqual(firstReady, firstAttempt)

    const secondReady = reduceBackgroundRendererReadiness(firstReady, {
      attempt: secondAttempt,
      ready: true,
    })
    assert.deepEqual(secondReady, secondAttempt)
    assert.deepEqual(
      reduceBackgroundRendererReadiness(secondReady, { attempt: firstAttempt, ready: false }),
      secondAttempt,
    )
    assert.equal(
      reduceBackgroundRendererReadiness(secondReady, { attempt: secondAttempt, ready: false }),
      null,
    )
  })
})
