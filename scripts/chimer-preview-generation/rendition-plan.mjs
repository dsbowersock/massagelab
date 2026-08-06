import {
  PREVIEW_ASPECTS,
  PREVIEW_CODECS,
  PREVIEW_QUALITIES,
  PREVIEW_RENDITION_LADDER,
  validateBackgroundPreviewRecipe,
} from "./preview-recipes.mjs"

const CODEC_OUTPUT = Object.freeze({
  vp9: Object.freeze({ extension: "webm", mimeType: "video/webm; codecs=vp9" }),
  h264: Object.freeze({ extension: "mp4", mimeType: "video/mp4; codecs=avc1.42E01E" }),
})

function assertPathPart(value, label, pattern) {
  if (typeof value !== "string" || !pattern.test(value)) {
    throw new Error(`Invalid ${label}: ${value}`)
  }
}

/**
 * Creates rename-safe asset paths. Display labels are intentionally absent:
 * stable IDs and explicit recipe revisions are the only catalog identifiers.
 */
export function buildPreviewAssetRelativePath({ backgroundId, recipeRevision, aspect, quality, codec }) {
  assertPathPart(backgroundId, "background ID", /^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  assertPathPart(recipeRevision, "recipe revision", /^recipe-\d+$/)
  if (!PREVIEW_ASPECTS.includes(aspect)) throw new Error(`Unsupported preview aspect: ${aspect}`)
  if (!PREVIEW_QUALITIES.includes(quality)) throw new Error(`Unsupported preview quality: ${quality}`)
  const output = CODEC_OUTPUT[codec]
  if (!output) throw new Error(`Unsupported preview codec: ${codec}`)
  return `${backgroundId}/${recipeRevision}/${aspect}/${quality}.${output.extension}`
}

export function buildPreviewPosterRelativePath({ backgroundId, recipeRevision, aspect }) {
  assertPathPart(backgroundId, "background ID", /^[a-z0-9]+(?:-[a-z0-9]+)*$/)
  assertPathPart(recipeRevision, "recipe revision", /^recipe-\d+$/)
  if (!PREVIEW_ASPECTS.includes(aspect)) throw new Error(`Unsupported preview aspect: ${aspect}`)
  return `${backgroundId}/${recipeRevision}/${aspect}/poster.webp`
}

export function buildBackgroundRenditionPlan(recipe) {
  const diagnostics = validateBackgroundPreviewRecipe(recipe)
  if (diagnostics.length) throw new Error(diagnostics.join("\n"))
  return PREVIEW_ASPECTS.flatMap((aspect) => PREVIEW_QUALITIES.flatMap((quality) =>
    PREVIEW_CODECS.map((codec) => ({
      backgroundId: recipe.backgroundId,
      recipeRevision: recipe.recipeRevision,
      aspect,
      quality,
      codec,
      ...PREVIEW_RENDITION_LADDER[aspect][quality],
      fps: recipe.fps,
      relativePath: buildPreviewAssetRelativePath({ ...recipe, aspect, quality, codec }),
      mimeType: CODEC_OUTPUT[codec].mimeType,
    })),
  ))
}

function renditionKey(item) {
  return `${item.aspect}:${item.quality}:${item.codec}`
}

/**
 * Builds one complete v2 entry and rejects partial or mixed capture batches.
 * This is an atomic publication boundary for local pilot metadata.
 */
export function buildPilotManifestEntry({ recipe, renditions, posters }) {
  const recipeErrors = validateBackgroundPreviewRecipe(recipe)
  if (recipeErrors.length) throw new Error(recipeErrors.join("\n"))
  const expectedPlan = buildBackgroundRenditionPlan(recipe)
  const expectedKeys = new Set(expectedPlan.map(renditionKey))
  const actualKeys = new Set((renditions ?? []).map(renditionKey))
  if (renditions?.length !== 18 || actualKeys.size !== 18
    || [...expectedKeys].some((key) => !actualKeys.has(key))) {
    throw new Error(`${recipe.backgroundId}: manifest requires exactly 18 unique renditions`)
  }

  const root = `${recipe.backgroundId}/${recipe.recipeRevision}/`
  const durations = new Set()
  for (const item of renditions) {
    const relativePath = item.relativePath ?? item.url
    if (item.backgroundId !== recipe.backgroundId || item.recipeRevision !== recipe.recipeRevision
      || typeof relativePath !== "string" || !relativePath.startsWith(root)) {
      throw new Error(`${recipe.backgroundId}: rendition paths must use the stable background ID and revision`)
    }
    durations.add(item.durationMs)
  }
  if (durations.size !== 1 || !Number.isInteger([...durations][0]) || [...durations][0] <= 0) {
    throw new Error(`${recipe.backgroundId}: renditions must share one positive duration`)
  }

  if (!posters || !PREVIEW_ASPECTS.every((aspect) => posters[aspect])) {
    throw new Error(`${recipe.backgroundId}: manifest requires one poster for every aspect`)
  }
  for (const aspect of PREVIEW_ASPECTS) {
    const poster = posters[aspect]
    if (typeof poster.url !== "string" || !poster.url.startsWith(`${root}${aspect}/`)) {
      throw new Error(`${recipe.backgroundId}: poster paths must use the stable background ID and revision`)
    }
  }

  return {
    backgroundId: recipe.backgroundId,
    recipeRevision: recipe.recipeRevision,
    loopStrategy: recipe.loopStrategy,
    loopBoundaryMs: [...durations][0],
    renditions: renditions.map(({ relativePath, ...item }) => ({
      ...item,
      url: item.url ?? relativePath,
    })),
    posters,
  }
}

