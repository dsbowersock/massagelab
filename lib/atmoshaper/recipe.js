// @ts-check

/** @typedef {"ambient" | "noise" | "station" | "binaural" | "isochronic"} AtmoShaperLayerKind */
/** @typedef {null | boolean | number | string | unknown[] | Record<string, unknown>} PlainData */
/** @typedef {{ carrierHz: number, rateHz: number }} AtmoShaperPreset */
/** @typedef {{ carrierHz: { min: number, max: number }, rateHz: { min: number, max: number } }} AtmoShaperFrequencyBounds */
/** @typedef {Record<string, PlainData>} AtmoShaperLayerSettings */
/** @typedef {{ id: string, kind: AtmoShaperLayerKind, sourceId: string, volume: number, muted: boolean, settings: AtmoShaperLayerSettings }} AtmoShaperLayer */
/** @typedef {{ version: 1, id: string, name: string, artworkSeed: string, layers: AtmoShaperLayer[] }} AtmoShaperRecipe */

export const ATMOSHAPER_RECIPE_VERSION = 1
export const ATMOSHAPER_LAYER_KINDS = Object.freeze([
  "ambient",
  "noise",
  "station",
  "binaural",
  "isochronic",
])
export const ATMOSHAPER_EXCLUSIVE_KINDS = new Set(["station", "binaural", "isochronic"])
export const ATMOSHAPER_FREQUENCY_BOUNDS = Object.freeze({
  carrierHz: { min: 80, max: 600 },
  rateHz: { min: 0.5, max: 50 },
})
export const ATMOSHAPER_PRESETS = Object.freeze({
  delta: Object.freeze({ carrierHz: 180, rateHz: 2 }),
  theta: Object.freeze({ carrierHz: 200, rateHz: 6 }),
  alpha: Object.freeze({ carrierHz: 220, rateHz: 10 }),
  beta: Object.freeze({ carrierHz: 240, rateHz: 18 }),
  gamma: Object.freeze({ carrierHz: 260, rateHz: 40 }),
})

/** Creates a normalized live-session recipe without starting audio. */
export function createAtmoShaperRecipe({ id, name = "AtmoShaper" }) {
  return normalizeAtmoShaperRecipe({
    version: ATMOSHAPER_RECIPE_VERSION,
    id,
    name,
    artworkSeed: id,
    layers: [],
  })
}

/** @param {AtmoShaperRecipe} recipe @param {AtmoShaperLayer} layer */
export function addAtmoShaperLayer(recipe, layer) {
  const normalized = normalizeLayer(layer)
  const retained = ATMOSHAPER_EXCLUSIVE_KINDS.has(normalized.kind)
    ? recipe.layers.filter(({ kind }) => kind !== normalized.kind)
    : recipe.layers
  return normalizeAtmoShaperRecipe({ ...recipe, layers: [...retained, normalized] })
}

/** @param {AtmoShaperRecipe} recipe @param {string} layerId @param {Partial<AtmoShaperLayer>} patch */
export function updateAtmoShaperLayer(recipe, layerId, patch) {
  return normalizeAtmoShaperRecipe({
    ...recipe,
    layers: recipe.layers.map((layer) => (
      layer.id === layerId ? normalizeLayer({ ...layer, ...patch, id: layer.id }) : layer
    )),
  })
}

/** @param {unknown} recipe @returns {AtmoShaperRecipe} */
export function normalizeAtmoShaperRecipe(recipe) {
  const candidate = requirePlainRecord(recipe, "recipe")
  if (candidate.version !== ATMOSHAPER_RECIPE_VERSION) {
    throw new Error(`Unsupported AtmoShaper recipe version: ${String(candidate.version)}`)
  }

  const id = requireNonBlankString(candidate.id, "recipe id")
  const name = requireNonBlankString(candidate.name, "recipe name")
  const artworkSeed = candidate.artworkSeed === undefined
    ? id
    : requireNonBlankString(candidate.artworkSeed, "recipe artworkSeed")
  if (!Array.isArray(candidate.layers)) {
    throw new TypeError("AtmoShaper recipe layers must be an array")
  }

  const layers = candidate.layers.map((layer) => normalizeLayer(layer))
  const layerIds = new Set()
  for (const layer of layers) {
    if (layerIds.has(layer.id)) {
      throw new Error(`Duplicate AtmoShaper layer id: ${layer.id}`)
    }
    layerIds.add(layer.id)
  }

  return { version: ATMOSHAPER_RECIPE_VERSION, id, name, artworkSeed, layers }
}

/** @param {AtmoShaperRecipe} recipe @param {string} layerId */
export function removeAtmoShaperLayer(recipe, layerId) {
  return normalizeAtmoShaperRecipe({
    ...recipe,
    layers: recipe.layers.filter((layer) => layer.id !== layerId),
  })
}

/** @param {AtmoShaperRecipe} recipe @param {string} layerId @param {number} targetIndex */
export function moveAtmoShaperLayer(recipe, layerId, targetIndex) {
  if (!Number.isInteger(targetIndex) || targetIndex < 0 || targetIndex >= recipe.layers.length) {
    throw new RangeError("AtmoShaper layer target index is out of bounds")
  }

  const currentIndex = recipe.layers.findIndex((layer) => layer.id === layerId)
  if (currentIndex === -1) {
    return normalizeAtmoShaperRecipe(recipe)
  }

  const layers = [...recipe.layers]
  const [layer] = layers.splice(currentIndex, 1)
  layers.splice(targetIndex, 0, layer)
  return normalizeAtmoShaperRecipe({ ...recipe, layers })
}

/** @param {unknown} layer @returns {AtmoShaperLayer} */
function normalizeLayer(layer) {
  const candidate = requirePlainRecord(layer, "layer")
  const id = requireNonBlankString(candidate.id, "layer id")
  const kind = requireLayerKind(candidate.kind)
  const sourceId = requireNonBlankString(candidate.sourceId, "layer sourceId")
  const volume = clampNumber(candidate.volume, 0, 1, "layer volume")
  if (typeof candidate.muted !== "boolean") {
    throw new TypeError("AtmoShaper layer muted must be a boolean")
  }

  const settings = normalizeSettings(kind, candidate.settings)
  return { id, kind, sourceId, volume, muted: candidate.muted, settings }
}

/** @param {AtmoShaperLayerKind} kind @param {unknown} rawSettings @returns {AtmoShaperLayerSettings} */
function normalizeSettings(kind, rawSettings) {
  const settings = clonePlainRecord(requirePlainRecord(rawSettings, "layer settings"))
  if (kind === "binaural") {
    settings.carrierHz = clampNumber(settings.carrierHz, 80, 600, "binaural carrierHz")
    settings.beatHz = clampNumber(settings.beatHz, 0.5, 50, "binaural beatHz")
  }
  if (kind === "isochronic") {
    settings.carrierHz = clampNumber(settings.carrierHz, 80, 600, "isochronic carrierHz")
    settings.pulseHz = clampNumber(settings.pulseHz, 0.5, 50, "isochronic pulseHz")
  }
  return settings
}

/** @param {unknown} value @param {number} min @param {number} max @param {string} label */
function clampNumber(value, min, max, label) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError(`AtmoShaper ${label} must be a finite number`)
  }
  return Math.min(max, Math.max(min, value))
}

/** @param {unknown} value @returns {AtmoShaperLayerKind} */
function requireLayerKind(value) {
  if (typeof value !== "string" || !ATMOSHAPER_LAYER_KINDS.includes(/** @type {AtmoShaperLayerKind} */ (value))) {
    throw new TypeError(`Unknown AtmoShaper layer kind: ${String(value)}`)
  }
  return /** @type {AtmoShaperLayerKind} */ (value)
}

/** @param {unknown} value @param {string} label */
function requireNonBlankString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`AtmoShaper ${label} must be a non-blank string`)
  }
  return value
}

/** @param {unknown} value @param {string} label @returns {Record<string, unknown>} */
function requirePlainRecord(value, label) {
  if (!isPlainRecord(value)) {
    throw new TypeError(`AtmoShaper ${label} must be a plain object`)
  }
  return value
}

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isPlainRecord(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
}

/** @param {Record<string, unknown>} record @returns {AtmoShaperLayerSettings} */
function clonePlainRecord(record) {
  /** @type {AtmoShaperLayerSettings} */
  const clone = {}
  for (const [key, value] of Object.entries(record)) {
    clone[key] = clonePlainData(value)
  }
  return clone
}

/** @param {unknown} value @returns {PlainData} */
function clonePlainData(value) {
  if (value === null) return null
  if (typeof value === "boolean" || typeof value === "string") return value
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new TypeError("AtmoShaper settings must contain finite numbers")
    return value
  }
  if (Array.isArray(value)) return value.map((item) => clonePlainData(item))
  if (isPlainRecord(value)) return clonePlainRecord(value)
  throw new TypeError("AtmoShaper settings must contain plain data only")
}
