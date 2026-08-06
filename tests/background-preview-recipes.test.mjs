import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"

import {
  PILOT_BACKGROUND_IDS,
  PREVIEW_ASPECTS,
  PREVIEW_CODECS,
  PREVIEW_QUALITIES,
  PREVIEW_RENDITION_LADDER,
  getBackgroundPreviewRecipe,
  validateBackgroundPreviewRecipe,
} from "../scripts/chimer-preview-generation/preview-recipes.mjs"

describe("background preview recipes", () => {
  it("locks the approved pilot and three-by-three rendition ladder", () => {
    assert.equal(PILOT_BACKGROUND_IDS.length, 8)
    assert.deepEqual(PREVIEW_ASPECTS, ["landscape", "square", "vertical"])
    assert.deepEqual(PREVIEW_QUALITIES, ["low", "standard", "high"])
    assert.deepEqual(PREVIEW_CODECS, ["vp9", "h264"])
    assert.deepEqual(PREVIEW_RENDITION_LADDER.vertical, {
      low: { width: 216, height: 384 },
      standard: { width: 360, height: 640 },
      high: { width: 540, height: 960 },
    })
  })

  it("keeps every pilot recipe bounded and passive", () => {
    for (const id of PILOT_BACKGROUND_IDS) {
      const recipe = getBackgroundPreviewRecipe(id)
      assert.equal(recipe.backgroundId, id)
      assert.deepEqual(validateBackgroundPreviewRecipe(recipe), [])
      assert.ok(recipe.durationMs >= 6000 && recipe.durationMs <= 18000)
      assert.equal(recipe.passiveCaptureState, "default")
    }
  })

  it("reports ordered recipe diagnostics", () => {
    assert.deepEqual(validateBackgroundPreviewRecipe({
      backgroundId: "unknown",
      recipeRevision: "latest",
      warmupMs: -1,
      durationMs: 1000,
      posterTimeMs: 1001,
      loopStrategy: "morph",
      crossfadeMs: 9000,
      fps: 13,
      passiveCaptureState: "pointer",
      framing: { landscape: null },
    }), [
      "unknown: background is not in the approved pilot",
      "unknown: recipe revision must match recipe-<number>",
      "unknown: warmup must be a non-negative integer",
      "unknown: duration must be between 6000ms and 18000ms",
      "unknown: poster time must be within the authored duration",
      "unknown: loop strategy must be natural or crossfade",
      "unknown: crossfade must be zero for natural loops or 250-2000ms for crossfade loops",
      "unknown: fps must be 24 or 30",
      "unknown: capture state must be passive default",
      "unknown: framing must define landscape, square, and vertical",
    ])
  })
})

