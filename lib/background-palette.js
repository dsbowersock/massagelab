export const BACKGROUND_PALETTE_VERSION = 1
export const BACKGROUND_PALETTE_SWATCH_COUNT = 7
export const BACKGROUND_COLOR_PRESET_LIMIT = 6
export const BACKGROUND_VISUAL_PRESET_LIMIT = 3

export const DEFAULT_BACKGROUND_PALETTE_STATE = Object.freeze({
  mode: "source",
  primaryColor: "#f97316",
  harmony: "analogous",
  swatches: Object.freeze(["#f97316", "#fb923c", "#fb7185", "#0f172a", "#f8fafc", "#db2777", "#ea580c"]),
})

const MODES = new Set(["source", "custom", "harmony"])
const HARMONIES = new Set(["analogous", "complementary", "split-complementary", "triad", "square", "compound", "shades", "monochromatic", "triadic", "tetradic"])
const HEX = /^#(?:[\da-f]{3}|[\da-f]{6})$/i
const LEGACY_COLOR_FIELDS = ["primary", "secondary", "accent", "background", "foreground", "ctaStart", "ctaEnd"]
const PRESET_NAME_LIMIT = 80
const ID_LIMIT = 128

function isRecord(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value) }
function clone(value) { return structuredClone(value) }
function normalizeHex(value, fallback) {
  if (typeof value !== "string" || !HEX.test(value.trim())) return fallback
  const color = value.trim().toLowerCase()
  return color.length === 4 ? `#${color.slice(1).split("").map((part) => part.repeat(2)).join("")}` : color
}
function clamp(value, minimum, maximum) { return Math.min(maximum, Math.max(minimum, value)) }
function parseRgb(color) { const value = normalizeHex(color, "#000000"); return [1, 3, 5].map((index) => Number.parseInt(value.slice(index, index + 2), 16)) }
function rgbToHex(rgb) { return `#${rgb.map((value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0")).join("")}` }
function rgbToHsl(color) {
  const [red, green, blue] = parseRgb(color).map((value) => value / 255); const maximum = Math.max(red, green, blue); const minimum = Math.min(red, green, blue); const delta = maximum - minimum
  let hue = 0
  if (delta) hue = maximum === red ? 60 * (((green - blue) / delta) % 6) : maximum === green ? 60 * ((blue - red) / delta + 2) : 60 * ((red - green) / delta + 4)
  const lightness = (maximum + minimum) / 2; const saturation = delta ? delta / (1 - Math.abs(2 * lightness - 1)) : 0
  return [((hue % 360) + 360) % 360, saturation, lightness]
}
function hslToHex(hue, saturation, lightness) {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation; const part = hue / 60; const secondary = chroma * (1 - Math.abs((part % 2) - 1)); const match = lightness - chroma / 2
  const [red, green, blue] = part < 1 ? [chroma, secondary, 0] : part < 2 ? [secondary, chroma, 0] : part < 3 ? [0, chroma, secondary] : part < 4 ? [0, secondary, chroma] : part < 5 ? [secondary, 0, chroma] : [chroma, 0, secondary]
  return rgbToHex([red + match, green + match, blue + match].map((value) => value * 255))
}
function normalizeId(value) { return typeof value === "string" ? value.trim().slice(0, ID_LIMIT) : "" }
function normalizeName(value, fallback = "Saved preset") { const name = typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, PRESET_NAME_LIMIT) : ""; return name || fallback }
function normalizeTimestamp(value) { return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : 0 }
function knownBackground(id, options) { return typeof options?.isKnownBackgroundId !== "function" || options.isKnownBackgroundId(id) === true }
function visualKeys(id, options) { const keys = options?.getVisualPropertyKeys?.(id); return Array.isArray(keys) ? new Set(keys.filter((key) => typeof key === "string")) : null }

/** Normalizes persisted palette data without consulting a renderer or account state. */
export function normalizeBackgroundPaletteState(value) {
  const input = isRecord(value) ? value : {}
  const mode = MODES.has(input.mode) ? input.mode : DEFAULT_BACKGROUND_PALETTE_STATE.mode
  const source = Array.isArray(input.swatches) ? input.swatches : []
  const primaryColor = normalizeHex(input.primaryColor, normalizeHex(source[0], DEFAULT_BACKGROUND_PALETTE_STATE.primaryColor))
  const harmony = HARMONIES.has(input.harmony) ? input.harmony : DEFAULT_BACKGROUND_PALETTE_STATE.harmony
  const swatches = Array.from({ length: BACKGROUND_PALETTE_SWATCH_COUNT }, (_, index) => normalizeHex(source[index], DEFAULT_BACKGROUND_PALETTE_STATE.swatches[index]))
  swatches[0] = primaryColor
  return { mode, primaryColor, harmony, swatches }
}

/** Produces a deterministic seven-swatch palette for every supported harmony. */
export function generateBackgroundHarmonySwatches(primaryColor, harmony) {
  const color = normalizeHex(primaryColor, DEFAULT_BACKGROUND_PALETTE_STATE.primaryColor); const [hue, saturation, lightness] = rgbToHsl(color); const selected = HARMONIES.has(harmony) ? harmony : DEFAULT_BACKGROUND_PALETTE_STATE.harmony
  const offsets = {
    analogous: [0, 22, -22, 44, -44, 66, -66], complementary: [0, 180, 25, 205, -25, 155, 90], triad: [0, 120, 240, 30, 150, 270, 300], triadic: [0, 120, 240, 30, 150, 270, 300], "split-complementary": [0, 150, 210, 30, 180, 330, 90], square: [0, 90, 180, 270, 30, 120, 210], tetradic: [0, 90, 180, 270, 30, 120, 210], compound: [0, 150, 210, 30, 180, 330, 90], shades: [0, 0, 0, 0, 0, 0, 0], monochromatic: [0, 0, 0, 0, 0, 0, 0],
  }[selected]
  return offsets.map((offset, index) => index === 0 ? color : hslToHex((hue + offset + 360) % 360, saturation, clamp(lightness + (["monochromatic", "shades"].includes(selected) ? (index - 3) * 0.11 : ((index % 3) - 1) * 0.08), 0.08, 0.92)))
}

/** Validates role-to-swatch assignments against an adapter-owned role inventory. */
export function normalizeBackgroundColorMapping(value, adapter) {
  const input = isRecord(value) ? value : {}; const roles = Array.isArray(adapter?.roles) ? adapter.roles : []; const result = {}
  for (const role of roles) if (typeof role?.id === "string") result[role.id] = Number.isInteger(input[role.id]) && input[role.id] >= 0 && input[role.id] < BACKGROUND_PALETTE_SWATCH_COUNT ? input[role.id] : (Number.isInteger(role.defaultSwatch) ? role.defaultSwatch : 0)
  return result
}

/** Resolves adapter role colors while preserving Source as a renderer-owned, non-mutating mode. */
export function resolveBackgroundRoleColors({ palette, adapter, mapping, canCustomize }) {
  const normalized = normalizeBackgroundPaletteState(palette); const roles = Array.isArray(adapter?.roles) ? adapter.roles : []; const assignments = normalizeBackgroundColorMapping(mapping, adapter)
  const sourceMode = normalized.mode === "source" || !canCustomize; const swatches = normalized.mode === "harmony" ? generateBackgroundHarmonySwatches(normalized.primaryColor, normalized.harmony) : normalized.swatches
  return Object.fromEntries(roles.filter((role) => typeof role?.id === "string").map((role) => [role.id, sourceMode ? normalizeHex(role.sourceColor, DEFAULT_BACKGROUND_PALETTE_STATE.primaryColor) : swatches[assignments[role.id]]]))
}

function normalizeProperties(value, backgroundId, options) { const allowed = visualKeys(backgroundId, options); if (!isRecord(value)) return {}; return Object.fromEntries(Object.entries(value).filter(([key]) => !allowed || allowed.has(key))) }
function normalizeColorPreset(value, options) {
  if (!isRecord(value)) return null; const id = normalizeId(value.id); const palette = normalizeBackgroundPaletteState(value.palette)
  if (!id || palette.mode === "source") return null
  return { id, name: normalizeName(value.name), timestamp: normalizeTimestamp(value.timestamp ?? value.updatedAt ?? value.createdAt), palette, mappingsByBackground: normalizeMappings(value.mappingsByBackground, options) }
}
function normalizeVisualPreset(value, backgroundId, options) { if (!isRecord(value)) return null; const id = normalizeId(value.id); if (!id) return null; return { id, name: normalizeName(value.name), timestamp: normalizeTimestamp(value.timestamp ?? value.updatedAt ?? value.createdAt), properties: normalizeProperties(value.properties, backgroundId, options) } }
function normalizeMappings(value, options) { if (!isRecord(value)) return {}; return Object.fromEntries(Object.entries(value).filter(([id]) => knownBackground(id, options)).map(([id, mapping]) => [id, isRecord(mapping) ? Object.fromEntries(Object.entries(mapping).filter(([, index]) => Number.isInteger(index) && index >= 0 && index < BACKGROUND_PALETTE_SWATCH_COUNT)) : {}])) }

/** Normalizes the complete nested preference record and removes stale registry references. */
export function normalizeSharedBackgroundVisualPreferences(value, options = {}) {
  const input = isRecord(value) ? value : {}; const visualPresetsByBackground = {}
  if (isRecord(input.visualPresetsByBackground)) for (const [id, presets] of Object.entries(input.visualPresetsByBackground)) if (knownBackground(id, options) && Array.isArray(presets)) visualPresetsByBackground[id] = presets.map((preset) => normalizeVisualPreset(preset, id, options)).filter(Boolean).slice(0, BACKGROUND_VISUAL_PRESET_LIMIT)
  const defaults = {}
  if (isRecord(input.defaultVisualPresetByBackground)) for (const [id, presetId] of Object.entries(input.defaultVisualPresetByBackground)) if (typeof presetId === "string" && visualPresetsByBackground[id]?.some((preset) => preset.id === presetId)) defaults[id] = presetId
  return { version: BACKGROUND_PALETTE_VERSION, palette: normalizeBackgroundPaletteState(input.palette), colorPresets: (Array.isArray(input.colorPresets) ? input.colorPresets : []).map((preset) => normalizeColorPreset(preset, options)).filter(Boolean).slice(0, BACKGROUND_COLOR_PRESET_LIMIT), mappingsByBackground: normalizeMappings(input.mappingsByBackground, options), visualPresetsByBackground, defaultVisualPresetByBackground: defaults }
}

function replacePreferences(preferences, replacement, options) { return normalizeSharedBackgroundVisualPreferences({ ...normalizeSharedBackgroundVisualPreferences(preferences, options), ...replacement }, options) }
/** Saves or replaces a Color preset without generating client IDs or timestamps. */
export function saveBackgroundColorPreset(preferences, preset, options = {}) { const normalized = normalizeColorPreset(preset, options); if (!normalized) return normalizeSharedBackgroundVisualPreferences(preferences, options); const current = normalizeSharedBackgroundVisualPreferences(preferences, options); return replacePreferences(current, { colorPresets: [normalized, ...current.colorPresets.filter((item) => item.id !== normalized.id)].slice(0, BACKGROUND_COLOR_PRESET_LIMIT) }, options) }
export const updateBackgroundColorPreset = saveBackgroundColorPreset
export function renameBackgroundColorPreset(preferences, id, name, options = {}) { const current = normalizeSharedBackgroundVisualPreferences(preferences, options); return replacePreferences(current, { colorPresets: current.colorPresets.map((preset) => preset.id === id ? { ...preset, name: normalizeName(name, preset.name) } : preset) }, options) }
export function deleteBackgroundColorPreset(preferences, id, options = {}) { const current = normalizeSharedBackgroundVisualPreferences(preferences, options); return replacePreferences(current, { colorPresets: current.colorPresets.filter((preset) => preset.id !== id) }, options) }
export function applyBackgroundColorPreset(preferences, id, options = {}) { const current = normalizeSharedBackgroundVisualPreferences(preferences, options); const preset = current.colorPresets.find((item) => item.id === id); return preset ? replacePreferences(current, { palette: preset.palette, mappingsByBackground: preset.mappingsByBackground }, options) : current }
/** Saves or replaces one background's Visual preset without generating client IDs or timestamps. */
export function saveBackgroundVisualPreset(preferences, backgroundId, preset, options = {}) { const current = normalizeSharedBackgroundVisualPreferences(preferences, options); if (!knownBackground(backgroundId, options)) return current; const normalized = normalizeVisualPreset(preset, backgroundId, options); if (!normalized) return current; return replacePreferences(current, { visualPresetsByBackground: { ...current.visualPresetsByBackground, [backgroundId]: [normalized, ...(current.visualPresetsByBackground[backgroundId] ?? []).filter((item) => item.id !== normalized.id)].slice(0, BACKGROUND_VISUAL_PRESET_LIMIT) } }, options) }
export const updateBackgroundVisualPreset = saveBackgroundVisualPreset
export function renameBackgroundVisualPreset(preferences, backgroundId, id, name, options = {}) { const current = normalizeSharedBackgroundVisualPreferences(preferences, options); return replacePreferences(current, { visualPresetsByBackground: { ...current.visualPresetsByBackground, [backgroundId]: (current.visualPresetsByBackground[backgroundId] ?? []).map((preset) => preset.id === id ? { ...preset, name: normalizeName(name, preset.name) } : preset) } }, options) }
export function deleteBackgroundVisualPreset(preferences, backgroundId, id, options = {}) { const current = normalizeSharedBackgroundVisualPreferences(preferences, options); const presets = (current.visualPresetsByBackground[backgroundId] ?? []).filter((preset) => preset.id !== id); const defaults = { ...current.defaultVisualPresetByBackground }; if (defaults[backgroundId] === id) delete defaults[backgroundId]; return replacePreferences(current, { visualPresetsByBackground: { ...current.visualPresetsByBackground, [backgroundId]: presets }, defaultVisualPresetByBackground: defaults }, options) }
export function applyBackgroundVisualPreset(preferences, backgroundId, id, properties, options = {}) { const current = normalizeSharedBackgroundVisualPreferences(preferences, options); const preset = (current.visualPresetsByBackground[backgroundId] ?? []).find((item) => item.id === id); return preset ? { ...current, properties: { ...normalizeProperties(properties, backgroundId, options), ...preset.properties } } : { ...current, properties: normalizeProperties(properties, backgroundId, options) } }
export function resolveDefaultBackgroundVisualPreset(preferences, backgroundId, options = {}) { const current = normalizeSharedBackgroundVisualPreferences(preferences, options); const id = current.defaultVisualPresetByBackground[backgroundId]; return (current.visualPresetsByBackground[backgroundId] ?? []).find((preset) => preset.id === id) ?? null }
export const resolveDefaultVisualPreset = resolveDefaultBackgroundVisualPreset

/** Migrates one legacy browser-local Global Colors record into nested palette preferences. */
export function migrateLegacyChimerGlobalColors(chimerSettings, legacyValue) {
  const settings = isRecord(chimerSettings) ? clone(chimerSettings) : {}; let legacy
  try { legacy = typeof legacyValue === "string" ? JSON.parse(legacyValue) : legacyValue } catch { legacy = null }
  const swatches = LEGACY_COLOR_FIELDS.map((key, index) => normalizeHex(legacy?.[key], DEFAULT_BACKGROUND_PALETTE_STATE.swatches[index])); const harmony = legacy?.harmony
  const mode = harmony === "custom" ? "custom" : "harmony"
  return { ...settings, backgroundVisualPreferences: normalizeSharedBackgroundVisualPreferences({ palette: { mode, primaryColor: swatches[0], harmony: HARMONIES.has(harmony) ? harmony : DEFAULT_BACKGROUND_PALETTE_STATE.harmony, swatches } }) }
}
export const migrateLegacyBackgroundPalette = migrateLegacyChimerGlobalColors

/** Returns whether a selected compatible background may use saved Custom or Harmony values. */
export function canCustomizeBackgroundColors({ hasCustomColorFeature, selectedBackgroundId, permanentlyOwnedBackgroundIds }) { return hasCustomColorFeature === true || (typeof selectedBackgroundId === "string" && Array.isArray(permanentlyOwnedBackgroundIds) && permanentlyOwnedBackgroundIds.includes(selectedBackgroundId)) }
/** Makes access denial reversible by resolving only the effective renderer mode. */
export function resolveEffectiveBackgroundPaletteMode({ savedMode, canCustomize }) { return savedMode === "source" || canCustomize === true && MODES.has(savedMode) ? savedMode : "source" }
