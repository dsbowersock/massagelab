import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { describe, it } from "node:test"

import {
  APPROVED_PILOT_RECIPES,
  ANIMATED_BACKGROUND_IDS,
  FULL_CATALOG_BACKGROUND_IDS,
  FULL_CATALOG_BATCHES,
  PILOT_BACKGROUND_IDS,
  PREVIEW_ASPECTS,
  PREVIEW_CODECS,
  PREVIEW_QUALITIES,
  PREVIEW_RENDITION_LADDER,
  STATIC_BACKGROUND_IDS,
  assertApprovedPilotRecipesMatch,
  assertRecipeCatalogCoverage,
  assertStaticBackgroundIdsSubset,
  backgroundPreviewRecipes,
  getBackgroundPreviewRecipe,
  validateBackgroundPreviewRecipe,
} from "../scripts/chimer-preview-generation/preview-recipes.mjs"
import {
  APPROVED_CATALOG_RELEASE_CONTRACT,
  assertPublishedCatalogCountArithmetic,
} from "../scripts/chimer-preview-generation/preview-release-contract.mjs"
import {
  buildBackgroundPosterPlan,
  buildBackgroundRenditionPlan,
  buildPilotManifestEntry,
  buildPreviewAssetRelativePath,
} from "../scripts/chimer-preview-generation/rendition-plan.mjs"
import {
  normalizeCatalogRenditionManifestEntries,
  serializeCatalogRenditionManifest,
} from "../scripts/chimer-preview-generation/rendition-manifest-module.mjs"
import { backgroundRegistry } from "../components/backgrounds/backgroundRegistry.ts"
import { validateCatalogManifest } from "../scripts/chimer-preview-generation/media-validation.mjs"

describe("background preview recipes", () => {
  it("covers every enabled background exactly once in the approved batches", () => {
    const enabledIds = backgroundRegistry.filter(({ enabled }) => enabled).map(({ id }) => id).sort()
    assert.deepEqual([...FULL_CATALOG_BACKGROUND_IDS].sort(), enabledIds)
    assert.equal(FULL_CATALOG_BATCHES.length, 7)
    assert.equal(FULL_CATALOG_BACKGROUND_IDS.length, 84)
    assert.equal(new Set(FULL_CATALOG_BACKGROUND_IDS).size, 84)
    assert.equal(ANIMATED_BACKGROUND_IDS.length, 82)
    assert.deepEqual(STATIC_BACKGROUND_IDS, ["solid-color", "static-gradient"])
  })

  it("fails fast if a static preview ID escapes the enabled catalog", () => {
    assert.doesNotThrow(() => assertStaticBackgroundIdsSubset(["solid-color"], ["solid-color", "animated"]))
    assert.throws(
      () => assertStaticBackgroundIdsSubset(["solid-color", "missing-static"], ["solid-color", "animated"]),
      /outside the full catalog: missing-static/,
    )
  })

  it("requires exact recipe-catalog key coverage", () => {
    assert.doesNotThrow(() => assertRecipeCatalogCoverage({ first: {}, second: {} }, ["first", "second"]))
    assert.throws(
      () => assertRecipeCatalogCoverage({ first: {} }, ["first", "second"]),
      /missing: second; extra: none/,
    )
    assert.throws(
      () => assertRecipeCatalogCoverage({ first: {}, stray: {} }, ["first"]),
      /missing: none; extra: stray/,
    )
  })

  it("locks fail-fast approved release count arithmetic", () => {
    assert.deepEqual(APPROVED_CATALOG_RELEASE_CONTRACT, {
      catalogRevision: "catalog-approved-1",
      entryCount: 84,
      animatedCount: 82,
      posterOnlyCount: 2,
      renditionCount: 1_476,
      posterCount: 252,
    })
    assert.doesNotThrow(() => assertPublishedCatalogCountArithmetic())
    assert.throws(
      () => assertPublishedCatalogCountArithmetic({ ...APPROVED_CATALOG_RELEASE_CONTRACT, entryCount: 83 }),
      /entry count must equal animated plus poster-only/,
    )
    assert.throws(
      () => assertPublishedCatalogCountArithmetic({ ...APPROVED_CATALOG_RELEASE_CONTRACT, renditionCount: 1_475 }),
      /rendition count must equal animated entries times the full rendition matrix/,
    )
    assert.throws(
      () => assertPublishedCatalogCountArithmetic({ ...APPROVED_CATALOG_RELEASE_CONTRACT, posterCount: 251 }),
      /poster count must equal entries times required poster aspects/,
    )
  })

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
      mediaKind: "animated",
      recipeRevision: "latest",
      reviewStatus: "candidate",
      warmupMs: -1,
      durationMs: 1000,
      posterTimeMs: 1001,
      loopStrategy: "morph",
      crossfadeMs: 9000,
      fps: 13,
      passiveCaptureState: "pointer",
      framing: { landscape: null },
    }), [
      "unknown: background is not in the enabled preview catalog",
      "unknown: recipe revision must match recipe-<number>",
      "unknown: warmup must be a non-negative integer",
      "unknown: duration must be zero for poster-only or 6000-18000ms for animated media",
      "unknown: poster time must be zero for poster-only or within the authored duration",
      "unknown: loop strategy must match the media kind",
      "unknown: crossfade must be zero for natural loops or 250-2000ms for crossfade loops",
      "unknown: fps must be zero for poster-only or 24 or 30 for animated media",
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

  it("keeps truthful static backgrounds poster-only", () => {
    const recipe = getBackgroundPreviewRecipe("solid-color")
    assert.equal(recipe.mediaKind, "poster-only")
    assert.deepEqual(validateBackgroundPreviewRecipe(recipe), [])
    assert.equal(buildBackgroundRenditionPlan(recipe).length, 0)
    assert.deepEqual(buildBackgroundPosterPlan(recipe).map(({ aspect }) => aspect), PREVIEW_ASPECTS)
  })

  it("materializes an independent recipe for every enabled ID", () => {
    assert.equal(Object.keys(backgroundPreviewRecipes).length, 84)
    assert.equal(Object.values(backgroundPreviewRecipes).filter(({ reviewStatus }) => reviewStatus === "approved").length, 84)
    for (const id of FULL_CATALOG_BACKGROUND_IDS) {
      const recipe = getBackgroundPreviewRecipe(id)
      assert.equal(recipe.backgroundId, id)
      assert.deepEqual(validateBackgroundPreviewRecipe(recipe), [])
      assert.equal(recipe.reviewStatus, "approved")
    }
  })

  it("preserves every approved pilot recipe byte-for-byte", () => {
    for (const [id, expected] of Object.entries(APPROVED_PILOT_RECIPES)) {
      assert.deepEqual(getBackgroundPreviewRecipe(id), expected)
    }
  })

  it("compares approved pilot recipes semantically and reports missing rows explicitly", () => {
    const approved = {
      pilot: { backgroundId: "pilot", warmupMs: 100, framing: { landscape: "center" } },
    }
    const reordered = {
      pilot: { framing: { landscape: "center" }, warmupMs: 100, backgroundId: "pilot" },
    }
    assert.doesNotThrow(() => assertApprovedPilotRecipesMatch(reordered, approved))
    assert.throws(
      () => assertApprovedPilotRecipesMatch({}, approved),
      /approved pilot recipe is missing from the checked-in catalog/,
    )
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
    assert.match(source, /function validateDecodedRendition/)
    assert.match(source, /function validateExistingOutput[\s\S]*validateDecodedRendition\(\{/)
    assert.match(source, /FFmpeg is required to decode and validate the preview pilot/)
    assert.match(source, /APPROVED_CATALOG_RELEASE_CONTRACT\.entryCount/)
    assert.match(source, /APPROVED_CATALOG_RELEASE_CONTRACT\.renditionCount/)
    assert.match(source, /APPROVED_CATALOG_RELEASE_CONTRACT\.posterCount/)
    assert.doesNotMatch(source, /expected 1476 videos|expected 252 posters/)
  })

  it("requires an explicit safe catalog output and supports resumable batches", () => {
    const source = readFileSync(new URL("../scripts/chimer-preview-generation/render-catalog.mjs", import.meta.url), "utf8")
    assert.match(source, /--output-dir/)
    assert.match(source, /--batch/)
    assert.match(source, /--resume/)
    assert.match(source, /refusing production preview directory/i)
    assert.match(source, /terminated without an exit code/)
    assert.match(source, /result\.signal/)
    assert.doesNotMatch(source, /upload-r2/)
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

  it("serializes the exact mixed full-catalog cardinality", () => {
    const entries = FULL_CATALOG_BACKGROUND_IDS.map((id) => {
      const recipe = getBackgroundPreviewRecipe(id)
      const posters = Object.fromEntries(PREVIEW_ASPECTS.map((aspect) => [aspect, {
        url: `${id}/${recipe.recipeRevision}/${aspect}/poster.webp`,
        width: 1,
        height: 1,
        bytes: 1,
        sha256: "a".repeat(64),
      }]))
      const renditions = buildBackgroundRenditionPlan(recipe).map((item) => ({
        ...item,
        url: item.relativePath,
        durationMs: recipe.durationMs,
        bytes: 1,
        sha256: "b".repeat(64),
      }))
      return {
        backgroundId: id,
        recipeRevision: recipe.recipeRevision,
        mediaKind: recipe.mediaKind,
        reviewStatus: recipe.reviewStatus,
        batchSlug: FULL_CATALOG_BATCHES.find(({ ids }) => ids.includes(id)).slug,
        loopStrategy: recipe.loopStrategy,
        loopBoundaryMs: recipe.durationMs,
        renditions,
        posters,
      }
    })
    assert.deepEqual(validateCatalogManifest(entries), [])
    const manifest = JSON.parse(serializeCatalogRenditionManifest(entries))
    assert.equal(manifest.catalogRevision, "catalog-approved-1")
    assert.equal(manifest.entries.length, 84)
    assert.equal(manifest.entries.flatMap((entry) => entry.renditions).length, 1476)
    assert.equal(manifest.entries.flatMap((entry) => Object.values(entry.posters)).length, 252)
    assert.throws(
      () => serializeCatalogRenditionManifest(entries.map((entry, index) => index === 0
        ? { ...entry, reviewStatus: "candidate" }
        : entry)),
      /publication manifest requires an approved recipe/,
    )
  })

  it("preflights catalog IDs and exact poster aspects before ordering entries", () => {
    const backgroundId = FULL_CATALOG_BACKGROUND_IDS[0]
    const entry = {
      backgroundId,
      recipeRevision: "recipe-1",
      mediaKind: "poster-only",
      reviewStatus: "approved",
      batchSlug: FULL_CATALOG_BATCHES[0].slug,
      loopStrategy: "static",
      loopBoundaryMs: 0,
      renditions: [],
      posters: Object.fromEntries(PREVIEW_ASPECTS.map((aspect) => [aspect, {
        url: `${backgroundId}/recipe-1/${aspect}/poster.webp`,
        width: 1,
        height: 1,
        bytes: 1,
        sha256: "a".repeat(64),
      }])),
    }

    assert.throws(
      () => normalizeCatalogRenditionManifestEntries([{ ...entry, backgroundId: "unknown-background" }]),
      /catalog entry 0: unknown backgroundId "unknown-background"/,
    )
    assert.throws(
      () => normalizeCatalogRenditionManifestEntries([entry, structuredClone(entry)]),
      new RegExp(`${backgroundId}: duplicate backgroundId`),
    )
    assert.throws(
      () => normalizeCatalogRenditionManifestEntries([{ ...entry, posters: null }]),
      new RegExp(`${backgroundId}: posters must be a record`),
    )
    const missingSquare = structuredClone(entry)
    delete missingSquare.posters.square
    assert.throws(
      () => normalizeCatalogRenditionManifestEntries([missingSquare]),
      new RegExp(`${backgroundId}: missing square poster`),
    )
    assert.throws(
      () => normalizeCatalogRenditionManifestEntries([{
        ...entry,
        posters: { ...entry.posters, panorama: entry.posters.landscape },
      }]),
      new RegExp(`${backgroundId}: unexpected poster aspect panorama`),
    )
    for (const invalidRenditions of [undefined, {}, "not-an-array"]) {
      assert.throws(
        () => normalizeCatalogRenditionManifestEntries([{ ...entry, renditions: invalidRenditions }]),
        new RegExp(`${backgroundId}: renditions must be an array`),
      )
    }
    assert.doesNotThrow(() => normalizeCatalogRenditionManifestEntries([entry]))
  })

  it("locks the approved catalog's exact published object inventory", () => {
    const catalog = JSON.parse(readFileSync(new URL(
      "../public/chimer/background-preview-catalog/index.json",
      import.meta.url,
    ), "utf8"))
    const media = catalog.entries.flatMap((entry) => [...entry.renditions, ...Object.values(entry.posters)])

    assert.equal(catalog.catalogRevision, "catalog-approved-1")
    assert.equal(catalog.entries.length, 84)
    assert.equal(catalog.entries.filter(({ reviewStatus }) => reviewStatus === "approved").length, 84)
    assert.equal(catalog.entries.filter(({ mediaKind }) => mediaKind === "animated").length, 82)
    assert.equal(catalog.entries.filter(({ mediaKind }) => mediaKind === "poster-only").length, 2)
    assert.equal(catalog.entries.flatMap((entry) => entry.renditions).length, 1476)
    assert.equal(catalog.entries.flatMap((entry) => Object.values(entry.posters)).length, 252)
    assert.equal(media.length, 1728)
    assert.equal(media.reduce((total, item) => total + item.bytes, 0), 862_078_635)
  })

  it("keeps the pilot review route development-only", () => {
    const source = readFileSync(new URL("../app/dev/bgpreviews/page.tsx", import.meta.url), "utf8")
    assert.match(source, /process\.env\.NODE_ENV === "production"/)
    assert.match(source, /notFound\(\)/)
    assert.match(source, /robots:\s*\{[\s\S]*index:\s*false[\s\S]*follow:\s*false/)
  })

  it("derives review batch order from the canonical catalog while preserving review titles", () => {
    const source = readFileSync(new URL("../app/dev/bgpreviews/page.tsx", import.meta.url), "utf8")
    assert.match(source, /FULL_CATALOG_BATCHES\.map\(\(\{ slug, title \}\) => \(\{ slug, title \}\)\)/)
    assert.doesNotMatch(source, /01-foundations/)
    assert.deepEqual(FULL_CATALOG_BATCHES.map(({ title }) => title), [
      "Foundations and signature forms",
      "Flow and liquid motion",
      "Light, rays, and beams",
      "Grids, pixels, and geometry",
      "Atmosphere and cosmos",
      "Digital and high-energy effects",
      "Fields and celestial motion",
    ])
  })

  it("labels empty pilot and catalog review surfaces independently", () => {
    const source = readFileSync(new URL("../app/dev/bgpreviews/preview-pilot-review.tsx", import.meta.url), "utf8")
    assert.match(source, /mode === "catalog" \? "Catalog evidence unavailable" : "Pilot evidence unavailable"/)
    assert.match(source, /<AppSurface title=\{emptyTitle\}/)
  })
})
