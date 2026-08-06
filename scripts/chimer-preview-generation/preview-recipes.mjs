import { BACKGROUND_BRANDING_AUDIT_BATCHES } from "../background-branding/audit-batches.mjs"

export const PREVIEW_ASPECTS = Object.freeze(["landscape", "square", "vertical"])
export const PREVIEW_QUALITIES = Object.freeze(["low", "standard", "high"])
export const PREVIEW_CODECS = Object.freeze(["vp9", "h264"])

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

export const PILOT_BACKGROUND_IDS = Object.freeze([
  "massage-lab-moving-gradient",
  "massage-lab-silk",
  "massage-lab-wave-current",
  "massage-lab-dna",
  "massage-lab-twisted-cubes",
  "massage-lab-galaxy",
  "massage-lab-faulty-terminal",
  "massage-lab-tile-grid",
])

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
export const ANIMATED_BACKGROUND_IDS = Object.freeze(
  FULL_CATALOG_BACKGROUND_IDS.filter((id) => !STATIC_BACKGROUND_IDS.includes(id)),
)

/**
 * Defines one passive capture recipe. A recipe owns the authored timeline for
 * all qualities/codecs of an aspect; encoders may compress it but may not
 * invent interaction, reverse motion, or change the loop boundary.
 */
function recipe(backgroundId, durationMs, posterTimeMs, loopStrategy, crossfadeMs, fps) {
  return Object.freeze({
    backgroundId,
    mediaKind: "animated",
    recipeRevision: "recipe-1",
    warmupMs: 2200,
    durationMs,
    posterTimeMs,
    loopStrategy,
    crossfadeMs,
    fps,
    passiveCaptureState: "default",
    framing: Object.freeze({ landscape: null, square: null, vertical: null }),
  })
}

/** Static visuals receive authored posters without inventing video motion. */
function posterOnlyRecipe(backgroundId) {
  return Object.freeze({
    backgroundId,
    mediaKind: "poster-only",
    recipeRevision: "recipe-1",
    warmupMs: 2200,
    durationMs: 0,
    posterTimeMs: 0,
    loopStrategy: "static",
    crossfadeMs: 0,
    fps: 0,
    passiveCaptureState: "default",
    framing: Object.freeze({ landscape: null, square: null, vertical: null }),
  })
}

export const backgroundPreviewRecipes = Object.freeze({
  "static-gradient": posterOnlyRecipe("static-gradient"),
  "solid-color": posterOnlyRecipe("solid-color"),
  "massage-lab-moving-gradient": recipe("massage-lab-moving-gradient", 12000, 4000, "crossfade", 900, 24),
  "massage-lab-silk": recipe("massage-lab-silk", 10000, 3333, "crossfade", 800, 24),
  "massage-lab-wave-current": recipe("massage-lab-wave-current", 10000, 3333, "crossfade", 800, 24),
  "massage-lab-dna": recipe("massage-lab-dna", 18000, 6000, "crossfade", 1000, 24),
  "massage-lab-twisted-cubes": recipe("massage-lab-twisted-cubes", 12000, 4000, "natural", 0, 24),
  "massage-lab-galaxy": recipe("massage-lab-galaxy", 12000, 4000, "crossfade", 900, 30),
  "massage-lab-faulty-terminal": recipe("massage-lab-faulty-terminal", 8000, 2667, "crossfade", 600, 30),
  "massage-lab-tile-grid": recipe("massage-lab-tile-grid", 12000, 4000, "crossfade", 900, 24),
})

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
  const validCrossfade = posterOnly || value?.loopStrategy === "natural"
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
