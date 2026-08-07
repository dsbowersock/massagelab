import { BACKGROUND_BRANDING_AUDIT_BATCHES } from "../background-branding/audit-batches.mjs"
import recipeCatalog from "../../data/background-preview-recipes.json" with { type: "json" }
import { isDeepStrictEqual } from "node:util"
import { APPROVED_PILOT_RECIPES } from "./approved-pilot-recipes.mjs"
import {
  CATALOG_PREVIEW_ASPECTS,
  CATALOG_PREVIEW_CODECS,
  CATALOG_PREVIEW_QUALITIES,
} from "./preview-release-contract.mjs"

export { APPROVED_PILOT_RECIPES }

export const PREVIEW_ASPECTS = CATALOG_PREVIEW_ASPECTS
export const PREVIEW_QUALITIES = CATALOG_PREVIEW_QUALITIES
export const PREVIEW_CODECS = CATALOG_PREVIEW_CODECS

export const PREVIEW_RENDITION_LADDER = Object.freeze({
  landscape: Object.freeze({
    low: Object.freeze({ width: 384, height: 216 }),
    standard: Object.freeze({ width: 640, height: 360 }),
    high: Object.freeze({ width: 960, height: 540 }),
  }),
  square: Object.freeze({
    low: Object.freeze({ width: 256, height: 256 }),
    standard: Object.freeze({ width: 512, height: 512 }),
    high: Object.freeze({ width: 768, height: 768 }),
  }),
  vertical: Object.freeze({
    low: Object.freeze({ width: 216, height: 384 }),
    standard: Object.freeze({ width: 360, height: 640 }),
    high: Object.freeze({ width: 540, height: 960 }),
  }),
})

export const PILOT_BACKGROUND_IDS = Object.freeze(Object.keys(APPROVED_PILOT_RECIPES))

/**
 * Reuses the approved visual-character batches as the only full-catalog
 * generation order. Stable IDs, rather than display labels, join recipes,
 * checkpoints, manifests, and later publication evidence.
 */
export const FULL_CATALOG_BATCHES = Object.freeze(BACKGROUND_BRANDING_AUDIT_BATCHES.map((batch) => Object.freeze({
  slug: batch.slug,
  title: batch.title,
  ids: Object.freeze([...batch.ids]),
})))

export const FULL_CATALOG_BACKGROUND_IDS = Object.freeze(FULL_CATALOG_BATCHES.flatMap(({ ids }) => ids))
if (new Set(FULL_CATALOG_BACKGROUND_IDS).size !== FULL_CATALOG_BACKGROUND_IDS.length) {
  throw new Error("Full background preview catalog contains duplicate stable IDs.")
}

export const STATIC_BACKGROUND_IDS = Object.freeze(["solid-color", "static-gradient"])
/** Ensures every static renderer remains part of the enabled preview catalog. */
export function assertStaticBackgroundIdsSubset(staticIds, catalogIds) {
  const catalogIdSet = new Set(catalogIds)
  const unknownStaticIds = staticIds.filter((id) => !catalogIdSet.has(id))
  if (unknownStaticIds.length) {
    throw new Error(`Static preview background IDs are outside the full catalog: ${unknownStaticIds.join(", ")}`)
  }
}

assertStaticBackgroundIdsSubset(STATIC_BACKGROUND_IDS, FULL_CATALOG_BACKGROUND_IDS)
export const ANIMATED_BACKGROUND_IDS = Object.freeze(
  FULL_CATALOG_BACKGROUND_IDS.filter((id) => !STATIC_BACKGROUND_IDS.includes(id)),
)

/**
 * Freezes the checked-in recipe rows so callers cannot mutate capture truth in
 * memory. Candidate timing is materialized by the seeder, never inferred here.
 */
function freezeRecipe(value) {
  return Object.freeze({ ...value, framing: Object.freeze({ ...value.framing }) })
}

export const backgroundPreviewRecipes = Object.freeze(Object.fromEntries(
  Object.entries(recipeCatalog).map(([id, value]) => [id, freezeRecipe(value)]),
))

/** Requires the recipe catalog to cover every enabled ID with no stray rows. */
export function assertRecipeCatalogCoverage(recipes, catalogIds) {
  const recipeIds = Object.keys(recipes)
  const recipeIdSet = new Set(recipeIds)
  const catalogIdSet = new Set(catalogIds)
  const missing = catalogIds.filter((id) => !recipeIdSet.has(id))
  const extra = recipeIds.filter((id) => !catalogIdSet.has(id))
  if (missing.length || extra.length) {
    throw new Error(`Background preview recipe catalog coverage mismatch; missing: ${missing.join(", ") || "none"}; extra: ${extra.join(", ") || "none"}.`)
  }
}

assertRecipeCatalogCoverage(backgroundPreviewRecipes, FULL_CATALOG_BACKGROUND_IDS)

/** Compares approved pilot recipes semantically so harmless key order cannot fail startup. */
export function assertApprovedPilotRecipesMatch(recipes, approvedRecipes) {
  for (const [id, approved] of Object.entries(approvedRecipes)) {
    const recipe = recipes[id]
    if (!recipe) {
      throw new Error(`${id}: approved pilot recipe is missing from the checked-in catalog.`)
    }
    if (!isDeepStrictEqual(recipe, approved)) {
      throw new Error(`${id}: checked-in recipe no longer matches the approved pilot.`)
    }
  }
}

assertApprovedPilotRecipesMatch(backgroundPreviewRecipes, APPROVED_PILOT_RECIPES)

export function getBackgroundPreviewRecipe(backgroundId) {
  const value = backgroundPreviewRecipes[backgroundId]
  if (!value) throw new Error(`Unknown background preview recipe: ${backgroundId}`)
  return value
}

/** Returns ordered, user-actionable recipe diagnostics without mutating input. */
export function validateBackgroundPreviewRecipe(value) {
  const recipeId = typeof value?.backgroundId === "string" ? value.backgroundId : "unknown"
  const errors = []
  if (!FULL_CATALOG_BACKGROUND_IDS.includes(recipeId)) {
    errors.push(`${recipeId}: background is not in the enabled preview catalog`)
  }
  if (!/^recipe-\d+$/.test(value?.recipeRevision ?? "")) {
    errors.push(`${recipeId}: recipe revision must match recipe-<number>`)
  }
  if (!["candidate", "approved"].includes(value?.reviewStatus)) {
    errors.push(`${recipeId}: review status must be candidate or approved`)
  }
  if (!Number.isInteger(value?.warmupMs) || value.warmupMs < 0) {
    errors.push(`${recipeId}: warmup must be a non-negative integer`)
  }
  const posterOnly = value?.mediaKind === "poster-only"
  if (!posterOnly && value?.mediaKind !== "animated") {
    errors.push(`${recipeId}: media kind must be animated or poster-only`)
  }
  const validDuration = posterOnly
    ? value?.durationMs === 0
    : Number.isInteger(value?.durationMs) && value.durationMs >= 6000 && value.durationMs <= 18000
  if (!validDuration) errors.push(`${recipeId}: duration must be zero for poster-only or 6000-18000ms for animated media`)
  const validPosterTime = posterOnly
    ? value?.posterTimeMs === 0
    : Number.isInteger(value?.posterTimeMs) && value.posterTimeMs >= 0 && value.posterTimeMs < value.durationMs
  if (!validPosterTime) errors.push(`${recipeId}: poster time must be zero for poster-only or within the authored duration`)
  const validLoopStrategy = posterOnly
    ? value?.loopStrategy === "static"
    : ["natural", "crossfade"].includes(value?.loopStrategy)
  if (!validLoopStrategy) errors.push(`${recipeId}: loop strategy must match the media kind`)
  const validCrossfade = (posterOnly || value?.loopStrategy === "natural")
    ? value?.crossfadeMs === 0
    : value?.loopStrategy === "crossfade" && Number.isInteger(value?.crossfadeMs)
      && value.crossfadeMs >= 250 && value.crossfadeMs <= 2000 && value.crossfadeMs < value.durationMs
  if (!validCrossfade) {
    errors.push(`${recipeId}: crossfade must be zero for natural loops or 250-2000ms for crossfade loops`)
  }
  if (posterOnly ? value?.fps !== 0 : ![24, 30].includes(value?.fps)) {
    errors.push(`${recipeId}: fps must be zero for poster-only or 24 or 30 for animated media`)
  }
  if (value?.passiveCaptureState !== "default") {
    errors.push(`${recipeId}: capture state must be passive default`)
  }
  if (!value?.framing || !PREVIEW_ASPECTS.every((aspect) => Object.hasOwn(value.framing, aspect))) {
    errors.push(`${recipeId}: framing must define landscape, square, and vertical`)
  }
  return errors
}
