import {
  BACKGROUND_COLOR_PRESET_LIMIT,
  BACKGROUND_VISUAL_PRESET_LIMIT,
  normalizeBackgroundColorPreset,
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

function stateFor(openingSnapshot, currentSnapshot = openingSnapshot, undoStack = [], redoStack = []) {
  const opening = normalizeSnapshot(openingSnapshot)
  const current = normalizeSnapshot(currentSnapshot)
  return {
    openingSnapshot: opening,
    currentSnapshot: current,
    undoStack: undoStack.map(normalizeSnapshot).slice(-BACKGROUND_VISUAL_HISTORY_LIMIT),
    redoStack: redoStack.map(normalizeSnapshot).slice(-BACKGROUND_VISUAL_HISTORY_LIMIT),
    dirty: !same(opening, current),
  }
}

/** Creates a detached, normalized visual-editor draft. It does not persist the opening value. */
export function createBackgroundVisualDraft(openingSnapshot) {
  const opening = normalizeSnapshot(openingSnapshot)
  return stateFor(opening)
}

/** Returns a clone so callers cannot mutate reducer state through the preview/commit boundary. */
export function getCommittedBackgroundVisualSnapshot(state) {
  return copy(normalizeSnapshot(state?.currentSnapshot))
}

function transition(state, nextSnapshot) {
  const current = normalizeSnapshot(state.currentSnapshot)
  const next = normalizeSnapshot(nextSnapshot)
  if (same(current, next)) return stateFor(state.openingSnapshot, current, state.undoStack, state.redoStack)
  return stateFor(state.openingSnapshot, next, [...state.undoStack, current], [])
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
  const currentState = stateFor(state?.openingSnapshot, state?.currentSnapshot, state?.undoStack ?? [], state?.redoStack ?? [])
  const current = currentState.currentSnapshot
  const type = action?.type
  if (type === "undo") {
    const previous = currentState.undoStack.at(-1)
    return previous ? stateFor(currentState.openingSnapshot, previous, currentState.undoStack.slice(0, -1), [...currentState.redoStack, current]) : currentState
  }
  if (type === "redo") {
    const next = currentState.redoStack.at(-1)
    return next ? stateFor(currentState.openingSnapshot, next, [...currentState.undoStack, current], currentState.redoStack.slice(0, -1)) : currentState
  }
  if (type === "apply") return stateFor(current, current)
  if (type === "cancel") return stateFor(currentState.openingSnapshot)
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
