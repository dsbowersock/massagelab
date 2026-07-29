import assert from "node:assert/strict"
import test from "node:test"

import {
  BACKGROUND_VISUAL_HISTORY_LIMIT,
  createBackgroundVisualDraft,
  getCommittedBackgroundVisualSnapshot,
  reduceBackgroundVisualDraft,
} from "../lib/background-visual-draft.js"

const openingSnapshot = {
  palette: { mode: "custom", primaryColor: "#123456", harmony: "triadic", swatches: ["#123456", "#234567", "#345678", "#456789", "#56789a", "#6789ab", "#789abc"] },
  colorPresets: [{ id: "warm", name: "Warm", timestamp: 1, palette: { mode: "custom", primaryColor: "#aa0000", swatches: ["#aa0000", "#bb0000", "#cc0000", "#dd0000", "#ee0000", "#ff0000", "#110000"] }, mappingsByBackground: { waves: { main: 2 } } }],
  properties: { speed: 1, density: 2 },
  mapping: { main: 0, accent: 1 },
  visualPresets: [{ id: "calm", name: "Calm", timestamp: 1, properties: { speed: 0.5 }, mapping: { main: 3 } }],
  defaultVisualPresetId: "calm",
}

function reduce(state, action) { return reduceBackgroundVisualDraft(state, action) }

test("draft snapshots keep all six editor value families and apply/cancel have complete snapshot semantics", () => {
  let state = createBackgroundVisualDraft(openingSnapshot)
  assert.deepEqual(getCommittedBackgroundVisualSnapshot(state), openingSnapshot)
  state = reduce(state, { type: "replace", snapshot: { ...openingSnapshot, properties: { speed: 4 }, mapping: { main: 6 } } })
  assert.equal(state.dirty, true)
  assert.equal(state.undoStack.length, 1)
  assert.equal(getCommittedBackgroundVisualSnapshot(state).properties.speed, 4)
  state = reduce(state, { type: "cancel" })
  assert.deepEqual(getCommittedBackgroundVisualSnapshot(state), openingSnapshot)
  assert.equal(state.dirty, false)
  assert.deepEqual(state.undoStack, [])
  state = reduce(state, { type: "replace", snapshot: { ...openingSnapshot, properties: { speed: 4 } } })
  state = reduce(state, { type: "apply" })
  assert.equal(state.dirty, false)
  assert.deepEqual(state.undoStack, [])
  assert.deepEqual(state.redoStack, [])
  assert.deepEqual(state.openingSnapshot, getCommittedBackgroundVisualSnapshot(state))
})

test("undo and redo cover palette, color presets, properties, mapping, visual presets, and default selection", () => {
  let state = createBackgroundVisualDraft(openingSnapshot)
  const snapshots = [
    { ...openingSnapshot, palette: { ...openingSnapshot.palette, primaryColor: "#abcdef", swatches: ["#abcdef", ...openingSnapshot.palette.swatches.slice(1)] } },
    { ...openingSnapshot, colorPresets: [...openingSnapshot.colorPresets, { ...openingSnapshot.colorPresets[0], id: "cool" }] },
    { ...openingSnapshot, properties: { speed: 9, density: 2 } },
    { ...openingSnapshot, mapping: { main: 4, accent: 1 } },
    { ...openingSnapshot, visualPresets: [{ ...openingSnapshot.visualPresets[0], id: "fast" }] },
    { ...openingSnapshot, defaultVisualPresetId: "other" },
  ]
  for (const snapshot of snapshots) state = reduce(state, { type: "replace", snapshot })
  assert.equal(state.undoStack.length, 6)
  for (let index = snapshots.length - 1; index >= 0; index -= 1) {
    state = reduce(state, { type: "undo" })
    assert.deepEqual(getCommittedBackgroundVisualSnapshot(state), index ? snapshots[index - 1] : openingSnapshot)
  }
  for (const snapshot of snapshots) {
    state = reduce(state, { type: "redo" })
    assert.deepEqual(getCommittedBackgroundVisualSnapshot(state), snapshot)
  }
})

test("new edits invalidate redo, normalized no-ops are deduplicated, and history stays bounded", () => {
  let state = createBackgroundVisualDraft(openingSnapshot)
  state = reduce(state, { type: "replace", snapshot: structuredClone(openingSnapshot) })
  assert.equal(state.undoStack.length, 0)
  state = reduce(state, { type: "replace", snapshot: { ...openingSnapshot, palette: { ...openingSnapshot.palette, primaryColor: "#ABC" } } })
  assert.equal(getCommittedBackgroundVisualSnapshot(state).palette.primaryColor, "#aabbcc")
  state = reduce(state, { type: "undo" })
  assert.equal(state.redoStack.length, 1)
  state = reduce(state, { type: "replace", snapshot: { ...openingSnapshot, properties: { speed: 3 } } })
  assert.equal(state.redoStack.length, 0)
  for (let index = 0; index < BACKGROUND_VISUAL_HISTORY_LIMIT + 5; index += 1) state = reduce(state, { type: "replace", snapshot: { ...openingSnapshot, properties: { speed: index } } })
  assert.equal(BACKGROUND_VISUAL_HISTORY_LIMIT, 50)
  assert.equal(state.undoStack.length, BACKGROUND_VISUAL_HISTORY_LIMIT)
})

test("reset and preset actions change only their documented draft families", () => {
  let state = createBackgroundVisualDraft(openingSnapshot)
  const sourcePalette = { mode: "source", primaryColor: "#010203", harmony: "shades", swatches: ["#010203", "#111213", "#212223", "#313233", "#414243", "#515253", "#616263"] }
  state = reduce(state, { type: "reset-colors", palette: sourcePalette })
  assert.deepEqual(getCommittedBackgroundVisualSnapshot(state).palette, sourcePalette)
  assert.deepEqual(getCommittedBackgroundVisualSnapshot(state).properties, openingSnapshot.properties)
  state = reduce(state, { type: "reset-properties", properties: { speed: 0, density: 12 }, mapping: { main: 1, accent: 2 } })
  assert.deepEqual(getCommittedBackgroundVisualSnapshot(state).properties, { speed: 0, density: 12 })
  assert.deepEqual(getCommittedBackgroundVisualSnapshot(state).mapping, { main: 1, accent: 2 })
  state = reduce(state, { type: "apply-color-preset", id: "warm" })
  assert.equal(getCommittedBackgroundVisualSnapshot(state).palette.primaryColor, "#aa0000")
  assert.deepEqual(getCommittedBackgroundVisualSnapshot(state).mapping, { main: 2 })
  state = reduce(state, { type: "apply-visual-preset", id: "calm" })
  assert.deepEqual(getCommittedBackgroundVisualSnapshot(state).properties, { speed: 0.5, density: 12 })
  assert.deepEqual(getCommittedBackgroundVisualSnapshot(state).mapping, { main: 3 })
  state = reduce(state, { type: "rename-color-preset", id: "warm", name: "Renamed" })
  state = reduce(state, { type: "delete-color-preset", id: "warm" })
  state = reduce(state, { type: "save-color-preset", preset: openingSnapshot.colorPresets[0] })
  state = reduce(state, { type: "rename-visual-preset", id: "calm", name: "Renamed" })
  state = reduce(state, { type: "delete-visual-preset", id: "calm" })
  state = reduce(state, { type: "save-visual-preset", preset: openingSnapshot.visualPresets[0] })
  state = reduce(state, { type: "set-default-visual-preset", id: "calm" })
  assert.equal(getCommittedBackgroundVisualSnapshot(state).defaultVisualPresetId, "calm")
})
