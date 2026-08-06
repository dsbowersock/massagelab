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
import {
  buildBackgroundRenditionPlan,
  buildPilotManifestEntry,
  buildPreviewAssetRelativePath,
} from "../scripts/chimer-preview-generation/rendition-plan.mjs"

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

  it("uses stable IDs and recipe revisions in asset paths", () => {
    assert.equal(buildPreviewAssetRelativePath({
      backgroundId: "massage-lab-wave-current",
      recipeRevision: "recipe-2",
      aspect: "vertical",
      quality: "high",
      codec: "vp9",
    }), "massage-lab-wave-current/recipe-2/vertical/high.webm")
  })

  it("plans eighteen video renditions per recipe", () => {
    const plan = buildBackgroundRenditionPlan(getBackgroundPreviewRecipe("massage-lab-silk"))
    assert.equal(plan.length, 18)
    assert.equal(new Set(plan.map(({ relativePath }) => relativePath)).size, 18)
  })

  it("rejects incomplete and display-name-coupled manifest entries", () => {
    const recipe = getBackgroundPreviewRecipe("massage-lab-silk")
    const renditions = buildBackgroundRenditionPlan(recipe).map((item) => ({
      ...item,
      durationMs: recipe.durationMs - recipe.crossfadeMs,
      bytes: 1,
      sha256: "a".repeat(64),
    }))
    const posters = Object.fromEntries(PREVIEW_ASPECTS.map((aspect) => [aspect, {
      aspect,
      url: `${recipe.backgroundId}/${recipe.recipeRevision}/${aspect}/poster.webp`,
      ...PREVIEW_RENDITION_LADDER[aspect].high,
      bytes: 1,
      sha256: "b".repeat(64),
    }]))

    assert.equal(buildPilotManifestEntry({ recipe, renditions, posters }).renditions.length, 18)
    assert.throws(
      () => buildPilotManifestEntry({ recipe, renditions: renditions.slice(1), posters }),
      /exactly 18 unique renditions/,
    )
    assert.throws(
      () => buildPilotManifestEntry({ recipe, renditions, posters: { ...posters, vertical: undefined } }),
      /poster for every aspect/,
    )
    assert.throws(
      () => buildPilotManifestEntry({
        recipe,
        renditions: renditions.map((item, index) => index === 0
          ? { ...item, relativePath: "Silk/recipe-1/landscape/low.webm" }
          : item),
        posters,
      }),
      /stable background ID and revision/,
    )
  })

  it("keeps pilot output explicit and refuses the production preview directory", () => {
    const source = readFileSync(new URL(
      "../scripts/chimer-preview-generation/render-pilot.mjs",
      import.meta.url,
    ), "utf8")
    assert.match(source, /--output-dir/)
    assert.match(source, /output directory is required/i)
    assert.match(source, /public[\\/]chimer[\\/]background-previews/)
    assert.match(source, /refusing production preview directory/i)
    assert.doesNotMatch(source, /backgroundPreviewManifest\.ts/)
  })

  it("generates a v2 sidecar without replacing the production manifest", () => {
    const source = readFileSync(new URL(
      "../components/backgrounds/backgroundPreviewRenditionManifest.ts",
      import.meta.url,
    ), "utf8")
    assert.match(source, /export type BackgroundPreviewQuality = "low" \| "standard" \| "high"/)
    assert.match(source, /export type BackgroundPreviewCodec = "vp9" \| "h264"/)
    assert.match(source, /renditions: readonly BackgroundPreviewRendition\[\]/)
    assert.match(source, /posters: Record<BackgroundPreviewAspect, BackgroundPreviewPoster>/)
  })
})
