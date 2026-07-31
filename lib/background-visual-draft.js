import {
  BACKGROUND_COLOR_PRESET_LIMIT,
  BACKGROUND_VISUAL_PRESET_LIMIT,
  normalizeBackgroundColorPreset,
  normalizeBackgroundColorMapping,
  normalizeBackgroundPaletteState,
} from "./background-palette.js"

export const BACKGROUND_VISUAL_HISTORY_LIMIT = 50

function isRecord(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value) }
function copy(value) { return structuredClone(value) }
function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue)
  if (!isRecord(value)) return value
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]))
}
function same(left, right) { return JSON.stringify(stableValue(left)) === JSON.stringify(stableValue(right)) }
function list(value, limit) { return Array.isArray(value) ? value.filter(isRecord).map(copy).slice(0, limit) : [] }
function colorPresetList(value) {
  return Array.isArray(value)
    ? value
      .map((preset) => normalizeBackgroundColorPreset(preset))
      .filter(Boolean)
      .slice(0, BACKGROUND_COLOR_PRESET_LIMIT)
    : []
}
function presetId(value) { return typeof value === "string" ? value.trim() : "" }
// Reducer-produced states are already detached and normalized. Identity
// membership lets hot draft actions skip repeatedly cloning the bounded
// 50-entry history while external/caller-provided states remain fail-safe.
const normalizedDraftStates = new WeakSet()

/**
 * Reduces an editor snapshot to its six draft-owned families. Renderer options,
 * storage details, and the selected background itself deliberately stay outside
 * this in-memory state so history cannot navigate or persist anything.
 */
function normalizeSnapshot(value) {
  const input = isRecord(value) ? value : {}
  return {
    palette: normalizeBackgroundPaletteState(input.palette),
    colorPresets: colorPresetList(input.colorPresets),
    properties: isRecord(input.properties) ? copy(input.properties) : {},
    mapping: isRecord(input.mapping) ? copy(input.mapping) : {},
    visualPresets: list(input.visualPresets, BACKGROUND_VISUAL_PRESET_LIMIT),
    defaultVisualPresetId: presetId(input.defaultVisualPresetId) || null,
  }
}

function stateForNormalized(opening, current = opening, undoStack = [], redoStack = []) {
  const state = {
    openingSnapshot: opening,
    currentSnapshot: current,
    undoStack: undoStack.slice(-BACKGROUND_VISUAL_HISTORY_LIMIT),
    redoStack: redoStack.slice(-BACKGROUND_VISUAL_HISTORY_LIMIT),
    dirty: !same(opening, current),
  }
  normalizedDraftStates.add(state)
  return state
}

function stateFor(openingSnapshot, currentSnapshot = openingSnapshot, undoStack = [], redoStack = []) {
  return stateForNormalized(
    normalizeSnapshot(openingSnapshot),
    normalizeSnapshot(currentSnapshot),
    undoStack.map(normalizeSnapshot),
    redoStack.map(normalizeSnapshot),
  )
}

/** Creates a detached, normalized visual-editor draft. It does not persist the opening value. */
export function createBackgroundVisualDraft(openingSnapshot) {
  const opening = normalizeSnapshot(openingSnapshot)
  return stateFor(opening)
}

/** Returns a clone so callers cannot mutate reducer state through the preview/commit boundary. */
export function getCommittedBackgroundVisualSnapshot(state) {
  return copy(
    normalizedDraftStates.has(state)
      ? state.currentSnapshot
      : normalizeSnapshot(state?.currentSnapshot),
  )
}

/**
 * Projects committed preferences and the selected adapter's exact non-color
 * inventory into the complete opening snapshot owned by one Visual draft.
 */
export function buildBackgroundVisualOpeningSnapshot({
  preferences,
  backgroundId,
  committedSettings,
  adapter,
} = {}) {
  const saved = isRecord(preferences) ? preferences : {}
  const settings = isRecord(committedSettings) ? committedSettings : {}
  const visualPropertyKeys = Array.isArray(adapter?.visualPropertyKeys)
    ? adapter.visualPropertyKeys.filter((key) => typeof key === "string")
    : []
  const properties = Object.fromEntries(
    visualPropertyKeys
      .filter((key) => Object.hasOwn(settings, key))
      .map((key) => [key, copy(settings[key])]),
  )
  const savedMapping = isRecord(saved.mappingsByBackground?.[backgroundId])
    ? saved.mappingsByBackground[backgroundId]
    : {}
  return normalizeSnapshot({
    palette: saved.palette,
    colorPresets: saved.colorPresets,
    properties,
    mapping: normalizeBackgroundColorMapping(savedMapping, adapter),
    visualPresets: saved.visualPresetsByBackground?.[backgroundId],
    defaultVisualPresetId: saved.defaultVisualPresetByBackground?.[backgroundId],
  })
}

/**
 * Resolves the non-historical state applied when a confirmed background
 * selection completes. A valid default preset overlays registry source values;
 * otherwise source properties and the curated mapping are used unchanged.
 */
export function resolveBackgroundSelectionVisualSnapshot({
  preferences,
  backgroundId,
  adapter,
} = {}) {
  const saved = isRecord(preferences) ? preferences : {}
  const sourceProperties = isRecord(adapter?.sourceVisualProperties)
    ? copy(adapter.sourceVisualProperties)
    : {}
  const sourceMapping = normalizeBackgroundColorMapping({}, adapter)
  const presets = Array.isArray(saved.visualPresetsByBackground?.[backgroundId])
    ? saved.visualPresetsByBackground[backgroundId]
    : []
  const defaultId = presetId(saved.defaultVisualPresetByBackground?.[backgroundId])
  const defaultPreset = defaultId
    ? presets.find((preset) => presetId(preset?.id) === defaultId)
    : undefined
  return {
    properties: defaultPreset && isRecord(defaultPreset.properties)
      ? { ...sourceProperties, ...copy(defaultPreset.properties) }
      : sourceProperties,
    mapping: defaultPreset && isRecord(defaultPreset.mapping)
      ? copy(defaultPreset.mapping)
      : sourceMapping,
  }
}

/**
 * Reassembles one draft snapshot for the Task 6 local/account commit boundary.
 * Selected-background properties remain separate so the caller can sanitize
 * and include them in the same frozen Chimer settings request body.
 */
export function buildCommittedBackgroundVisualPreferences({
  preferences,
  backgroundId,
  snapshot,
} = {}) {
  const saved = isRecord(preferences) ? copy(preferences) : {}
  const current = normalizeSnapshot(snapshot)
  const mappingsByBackground = {
    ...(isRecord(saved.mappingsByBackground) ? saved.mappingsByBackground : {}),
    [backgroundId]: copy(current.mapping),
  }
  const visualPresetsByBackground = {
    ...(isRecord(saved.visualPresetsByBackground) ? saved.visualPresetsByBackground : {}),
    [backgroundId]: copy(current.visualPresets),
  }
  const defaultVisualPresetByBackground = {
    ...(isRecord(saved.defaultVisualPresetByBackground)
      ? saved.defaultVisualPresetByBackground
      : {}),
  }
  if (current.defaultVisualPresetId) {
    defaultVisualPresetByBackground[backgroundId] = current.defaultVisualPresetId
  } else {
    delete defaultVisualPresetByBackground[backgroundId]
  }
  return {
    preferences: {
      ...saved,
      palette: copy(current.palette),
      colorPresets: copy(current.colorPresets),
      mappingsByBackground,
      visualPresetsByBackground,
      defaultVisualPresetByBackground,
    },
    properties: copy(current.properties),
  }
}

/**
 * Separates one legacy settings-control change at the Visual draft boundary.
 * Adapter-owned non-color properties become one draft action, legacy role
 * colors are ignored while the shared palette is authoritative, and unrelated
 * settings retain their committed behavior.
 *
 * @param {{
 *   nextSettings?: Record<string, unknown>,
 *   draftOpen?: boolean,
 *   visualPropertyKeys?: readonly string[],
 *   legacyColorPropertyKeys?: readonly string[],
 *   legacyPaletteMetadataSuffixes?: readonly string[],
 * }} input
 */
export function partitionBackgroundVisualSettingChange({
  nextSettings,
  draftOpen = false,
  visualPropertyKeys = [],
  legacyColorPropertyKeys = [],
  legacyPaletteMetadataSuffixes = [],
} = {}) {
  const settings = isRecord(nextSettings) ? nextSettings : {}
  if (!draftOpen) {
    return {
      draftProperties: {},
      committedSettings: copy(settings),
    }
  }
  const visualKeys = new Set(visualPropertyKeys)
  const legacyColorKeys = new Set(legacyColorPropertyKeys)
  const isLegacyPaletteMetadata = (key) => (
    legacyPaletteMetadataSuffixes.some((suffix) => key.endsWith(suffix))
  )
  const draftProperties = {}
  const committedSettings = {}
  Object.entries(settings).forEach(([key, value]) => {
    if (visualKeys.has(key)) {
      draftProperties[key] = copy(value)
    } else if (!legacyColorKeys.has(key) && !isLegacyPaletteMetadata(key)) {
      committedSettings[key] = copy(value)
    }
  })
  return { draftProperties, committedSettings }
}

/**
 * Builds the single complete Task 6 commit used when Apply also confirms a
 * background selection. The current draft is persisted first in-memory, then
 * the destination default/source snapshot is overlaid without touching draft
 * history or issuing persistence itself.
 *
 * @param {{
 *   preferences: Record<string, unknown>,
 *   currentBackgroundId: string,
 *   currentSnapshot: Record<string, unknown>,
 *   targetBackgroundId?: string | null,
 *   targetAdapter?: any,
 *   commitCanonicalBackgroundSelection?: boolean,
 * }} input
 */
export function buildBackgroundVisualPendingCommit({
  preferences,
  currentBackgroundId,
  currentSnapshot,
  targetBackgroundId = null,
  targetAdapter = null,
  commitCanonicalBackgroundSelection = false,
} = {}) {
  const currentCommit = buildCommittedBackgroundVisualPreferences({
    preferences,
    backgroundId: currentBackgroundId,
    snapshot: currentSnapshot,
  })
  if (!targetBackgroundId) {
    return {
      visualBackgroundId: currentBackgroundId,
      sourceVisualBackgroundId: currentBackgroundId,
      backgroundVisualPreferences: currentCommit.preferences,
      properties: currentCommit.properties,
    }
  }
  const target = resolveBackgroundSelectionVisualSnapshot({
    preferences: currentCommit.preferences,
    backgroundId: targetBackgroundId,
    adapter: targetAdapter,
  })
  return {
    visualBackgroundId: targetBackgroundId,
    sourceVisualBackgroundId: currentBackgroundId,
    ...(commitCanonicalBackgroundSelection
      ? { backgroundId: targetBackgroundId }
      : {}),
    backgroundVisualPreferences: {
      ...currentCommit.preferences,
      mappingsByBackground: {
        ...(isRecord(currentCommit.preferences.mappingsByBackground)
          ? currentCommit.preferences.mappingsByBackground
          : {}),
        [targetBackgroundId]: copy(target.mapping),
      },
    },
    properties: {
      ...currentCommit.properties,
      ...copy(target.properties),
    },
  }
}

/**
 * Separates the selected visual adapter inventory from canonical Chimer
 * selection. Music commits omit `committedBackgroundId`; intentional
 * Chimer/Clock selection supplies it.
 *
 * @param {{
 *   canonicalBackgroundId: string,
 *   visualBackgroundId: string,
 *   sourceVisualBackgroundId?: string | null,
 *   committedBackgroundId?: string | null,
 * }} input
 * @returns {{canonicalBackgroundId: string, visualBackgroundIds: string[]}}
 */
export function resolveBackgroundVisualCommitScope({
  canonicalBackgroundId,
  visualBackgroundId,
  sourceVisualBackgroundId = null,
  committedBackgroundId = null,
} = {}) {
  return {
    canonicalBackgroundId: committedBackgroundId || canonicalBackgroundId,
    visualBackgroundIds: [...new Set([
      sourceVisualBackgroundId,
      visualBackgroundId,
    ].filter((backgroundId) => typeof backgroundId === "string" && backgroundId))],
  }
}

/**
 * Resolves the three pending-intent outcomes without side effects. Apply owns
 * the supplied single commit, Discard resumes without it, and Keep resumes
 * nothing.
 */
export function resolveBackgroundVisualPendingOutcome({
  outcome,
  intent,
  commit,
} = {}) {
  if (outcome === "keep") {
    return { commit: null, resumeIntent: null }
  }
  return {
    commit: outcome === "apply" ? commit ?? null : null,
    resumeIntent: intent ?? null,
  }
}

/** Keeps the legacy default renderer until a live draft needs adapter colors. */
export function shouldUseDraftAwareBackgroundHost({
  isOriginalBackground = false,
  hasVisualDraft = false,
} = {}) {
  return !isOriginalBackground || hasVisualDraft
}

function transition(state, nextSnapshot) {
  const current = state.currentSnapshot
  const next = normalizeSnapshot(nextSnapshot)
  if (same(current, next)) return state
  return stateForNormalized(state.openingSnapshot, next, [...state.undoStack, current], [])
}

function replacePreset(items, preset, limit) {
  if (!isRecord(preset) || !presetId(preset.id)) return items
  const next = copy(preset)
  next.id = presetId(next.id)
  return [next, ...items.filter((item) => item.id !== next.id)].slice(0, limit)
}

/** Replaces one Color preset only after stripping background-specific legacy fields. */
function replaceColorPreset(items, preset) {
  const next = normalizeBackgroundColorPreset(preset)
  return next
    ? [next, ...items.filter((item) => item.id !== next.id)].slice(0, BACKGROUND_COLOR_PRESET_LIMIT)
    : items
}

function changePresetName(items, id, name) {
  const nextName = typeof name === "string" ? name.trim().replace(/\s+/g, " ").slice(0, 80) : ""
  return nextName ? items.map((item) => item.id === id ? { ...item, name: nextName } : item) : items
}

/**
 * Performs only pure draft transitions. `apply` merely marks the current
 * snapshot as the next opening point; the UI persistence adapter owns the
 * actual local/account write after observing that transition.
 */
export function reduceBackgroundVisualDraft(state, action = {}) {
  const currentState = normalizedDraftStates.has(state)
    ? state
    : stateFor(state?.openingSnapshot, state?.currentSnapshot, state?.undoStack ?? [], state?.redoStack ?? [])
  const current = currentState.currentSnapshot
  const type = action?.type
  if (type === "undo") {
    const previous = currentState.undoStack.at(-1)
    return previous ? stateForNormalized(currentState.openingSnapshot, previous, currentState.undoStack.slice(0, -1), [...currentState.redoStack, current]) : currentState
  }
  if (type === "redo") {
    const next = currentState.redoStack.at(-1)
    return next ? stateForNormalized(currentState.openingSnapshot, next, [...currentState.undoStack, current], currentState.redoStack.slice(0, -1)) : currentState
  }
  if (type === "apply") return stateForNormalized(current, current)
  if (type === "cancel") return stateForNormalized(currentState.openingSnapshot)
  if (type === "replace") return transition(currentState, action.snapshot ?? action.value)
  if (type === "reset-colors") return transition(currentState, { ...current, palette: action.palette ?? action.defaultPalette ?? current.palette })
  if (type === "reset-properties") return transition(currentState, { ...current, properties: action.properties ?? action.defaultProperties ?? {}, mapping: action.mapping ?? action.defaultMapping ?? {} })
  if (type === "apply-color-preset") {
    const preset = current.colorPresets.find((item) => item.id === presetId(action.id))
    return preset ? transition(currentState, { ...current, palette: preset.palette }) : currentState
  }
  if (type === "apply-visual-preset") {
    const preset = current.visualPresets.find((item) => item.id === presetId(action.id))
    return preset ? transition(currentState, { ...current, properties: { ...current.properties, ...preset.properties }, mapping: isRecord(preset.mapping) ? preset.mapping : current.mapping }) : currentState
  }
  if (type === "save-color-preset" || type === "update-color-preset") return transition(currentState, { ...current, colorPresets: replaceColorPreset(current.colorPresets, action.preset) })
  if (type === "rename-color-preset") return transition(currentState, { ...current, colorPresets: changePresetName(current.colorPresets, presetId(action.id), action.name) })
  if (type === "delete-color-preset") return transition(currentState, { ...current, colorPresets: current.colorPresets.filter((item) => item.id !== presetId(action.id)) })
  if (type === "save-visual-preset" || type === "update-visual-preset") return transition(currentState, { ...current, visualPresets: replacePreset(current.visualPresets, action.preset, BACKGROUND_VISUAL_PRESET_LIMIT) })
  if (type === "rename-visual-preset") return transition(currentState, { ...current, visualPresets: changePresetName(current.visualPresets, presetId(action.id), action.name) })
  if (type === "delete-visual-preset") {
    const id = presetId(action.id)
    return transition(currentState, { ...current, visualPresets: current.visualPresets.filter((item) => item.id !== id), defaultVisualPresetId: current.defaultVisualPresetId === id ? null : current.defaultVisualPresetId })
  }
  if (type === "set-default-visual-preset") {
    const id = presetId(action.id)
    return transition(currentState, { ...current, defaultVisualPresetId: !id || current.visualPresets.some((item) => item.id === id) ? id || null : current.defaultVisualPresetId })
  }
  return currentState
}
