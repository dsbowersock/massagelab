import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import {
  BACKGROUND_VISUAL_HISTORY_LIMIT,
  buildBackgroundVisualOpeningSnapshot,
  buildCommittedBackgroundVisualPreferences,
  createBackgroundVisualDraft,
  getCommittedBackgroundVisualSnapshot,
  resolveBackgroundSelectionVisualSnapshot,
  reduceBackgroundVisualDraft,
} from "../lib/background-visual-draft.js"

const read = async (path) => {
  try {
    return await readFile(new URL(`../${path}`, import.meta.url), "utf8")
  } catch {
    return ""
  }
}

const runningTimerSource = await read("app/chimer/running-timer.tsx")
const navigationGuardSource = await read("app/chimer/visual-draft-navigation-guard.tsx")
const unsavedDialogSource = await read("app/chimer/unsaved-visual-changes-dialog.tsx")
const pageSource = await read("app/chimer/page.tsx")

const openingSnapshot = {
  palette: { mode: "custom", primaryColor: "#123456", harmony: "triadic", swatches: ["#123456", "#234567", "#345678", "#456789", "#56789a", "#6789ab", "#789abc"] },
  colorPresets: [{ id: "warm", name: "Warm", timestamp: 1, palette: { mode: "custom", primaryColor: "#aa0000", harmony: "analogous", swatches: ["#aa0000", "#bb0000", "#cc0000", "#dd0000", "#ee0000", "#ff0000", "#110000"] } }],
  properties: { speed: 1, density: 2 },
  mapping: { main: 0, accent: 1 },
  visualPresets: [{ id: "calm", name: "Calm", timestamp: 1, properties: { speed: 0.5 }, mapping: { main: 3 } }],
  defaultVisualPresetId: "calm",
}

function reduce(state, action) { return reduceBackgroundVisualDraft(state, action) }

test("draft snapshots canonically project legacy Color presets without changing active mapping", () => {
  const legacyColorPreset = {
    ...openingSnapshot.colorPresets[0],
    mappingsByBackground: { waves: { main: 6 } },
    backgroundId: "waves",
    legacyColorSlots: ["#ffffff"],
  }
  const legacyOpening = {
    ...openingSnapshot,
    colorPresets: [legacyColorPreset],
    mapping: { main: 4, accent: 1 },
  }
  const before = structuredClone(legacyOpening)
  let state = createBackgroundVisualDraft(legacyOpening)

  assert.deepEqual(Object.keys(state.openingSnapshot.colorPresets[0]), [
    "id",
    "name",
    "timestamp",
    "palette",
  ])
  assert.equal(
    Object.hasOwn(state.openingSnapshot.colorPresets[0], "mappingsByBackground"),
    false,
  )
  assert.deepEqual(state.currentSnapshot.mapping, { main: 4, accent: 1 })

  state = reduce(state, {
    type: "replace",
    snapshot: {
      ...legacyOpening,
      properties: { speed: 4 },
      colorPresets: [{ ...legacyColorPreset, timestamp: 2, unknown: true }],
    },
  })
  assert.equal(
    Object.hasOwn(state.currentSnapshot.colorPresets[0], "mappingsByBackground"),
    false,
  )
  assert.equal(
    Object.hasOwn(state.undoStack[0].colorPresets[0], "mappingsByBackground"),
    false,
  )
  assert.deepEqual(state.currentSnapshot.mapping, { main: 4, accent: 1 })

  state = reduce(state, {
    type: "save-color-preset",
    preset: { ...legacyColorPreset, id: "legacy-save", unknown: true },
  })
  state = reduce(state, { type: "apply" })
  assert.equal(
    Object.hasOwn(state.openingSnapshot.colorPresets[0], "mappingsByBackground"),
    false,
  )
  assert.equal(state.dirty, false)
  const committed = getCommittedBackgroundVisualSnapshot(state)
  assert.deepEqual(Object.keys(committed.colorPresets[0]), [
    "id",
    "name",
    "timestamp",
    "palette",
  ])
  assert.equal(Object.hasOwn(committed.colorPresets[0], "mappingsByBackground"), false)
  assert.deepEqual(committed.mapping, { main: 4, accent: 1 })
  assert.deepEqual(legacyOpening, before)
})

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
  assert.deepEqual(getCommittedBackgroundVisualSnapshot(state).mapping, { main: 1, accent: 2 })
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

test("opening and commit adapters cover one selected background without persisting", () => {
  const adapter = {
    status: "supported",
    visualPropertyKeys: ["speed", "density"],
    sourceVisualProperties: { speed: 0.5, density: 12 },
    roles: [
      { id: "main", defaultSwatch: 2 },
      { id: "accent", defaultSwatch: 4 },
    ],
  }
  const preferences = {
    palette: openingSnapshot.palette,
    colorPresets: openingSnapshot.colorPresets,
    mappingsByBackground: { waves: { main: 6, accent: 1 } },
    visualPresetsByBackground: { waves: openingSnapshot.visualPresets },
    defaultVisualPresetByBackground: { waves: "calm" },
  }
  const opening = buildBackgroundVisualOpeningSnapshot({
    preferences,
    backgroundId: "waves",
    committedSettings: { speed: 3, density: 8, unrelated: "drop" },
    adapter,
  })
  assert.deepEqual(opening.properties, { speed: 3, density: 8 })
  assert.deepEqual(opening.mapping, { main: 6, accent: 1 })
  assert.equal(opening.defaultVisualPresetId, "calm")

  const committed = buildCommittedBackgroundVisualPreferences({
    preferences,
    backgroundId: "waves",
    snapshot: { ...opening, properties: { speed: 9, density: 4 }, mapping: { main: 5 } },
  })
  assert.deepEqual(committed.preferences.palette, opening.palette)
  assert.deepEqual(committed.preferences.mappingsByBackground.waves, { main: 5 })
  assert.deepEqual(committed.properties, { speed: 9, density: 4 })
  assert.equal(Object.hasOwn(committed.properties, "unrelated"), false)
})

test("background selection uses its default Visual preset or registry source values", () => {
  const adapter = {
    status: "supported",
    visualPropertyKeys: ["speed", "density"],
    sourceVisualProperties: { speed: 0.5, density: 12 },
    roles: [
      { id: "main", defaultSwatch: 2 },
      { id: "accent", defaultSwatch: 4 },
    ],
  }
  const preferences = {
    palette: openingSnapshot.palette,
    colorPresets: openingSnapshot.colorPresets,
    mappingsByBackground: {},
    visualPresetsByBackground: {
      waves: [{
        id: "default",
        properties: { speed: 2 },
        mapping: { main: 6 },
      }],
    },
    defaultVisualPresetByBackground: { waves: "default" },
  }
  assert.deepEqual(
    resolveBackgroundSelectionVisualSnapshot({ preferences, backgroundId: "waves", adapter }),
    { properties: { speed: 2, density: 12 }, mapping: { main: 6 } },
  )
  assert.deepEqual(
    resolveBackgroundSelectionVisualSnapshot({
      preferences: { ...preferences, defaultVisualPresetByBackground: {} },
      backgroundId: "waves",
      adapter,
    }),
    { properties: { speed: 0.5, density: 12 }, mapping: { main: 2, accent: 4 } },
  )
})

test("live Visual integration owns draft preview, one Apply, and reachable actions", () => {
  assert.match(runningTimerSource, /createBackgroundVisualDraft/)
  assert.match(runningTimerSource, /BackgroundPaletteEditor/)
  assert.match(runningTimerSource, /BackgroundColorPresetManager/)
  assert.match(runningTimerSource, /BackgroundVisualPresetManager/)
  assert.match(runningTimerSource, /draftPalettePreview=/)
  assert.match(runningTimerSource, /type:\s*"reset-colors"/)
  assert.match(runningTimerSource, /type:\s*"reset-properties"/)
  assert.match(runningTimerSource, /type:\s*"undo"/)
  assert.match(runningTimerSource, /type:\s*"redo"/)
  assert.match(runningTimerSource, /onApplyBackgroundVisualPreferences/)
  assert.match(pageSource, /visualDraftPropertyOverrides/)
  assert.match(pageSource, /window\.localStorage\.setItem\(CHIMER_STORAGE_KEY[\s\S]*syncBackgroundVisualPreferenceRequest/)
  assert.doesNotMatch(navigationGuardSource, /localStorage|sessionStorage|fetch\(/)
})

test("dirty navigation guard covers eligible app links, history, and native unload only", () => {
  assert.match(navigationGuardSource, /beforeunload/)
  assert.match(navigationGuardSource, /popstate/)
  assert.match(navigationGuardSource, /event\.metaKey|event\.ctrlKey/)
  assert.match(navigationGuardSource, /anchor\.download/)
  assert.match(navigationGuardSource, /anchorTarget !== "_self"/)
  assert.match(navigationGuardSource, /url\.origin !== window\.location\.origin/)
  assert.match(navigationGuardSource, /url\.hash/)
  assert.match(unsavedDialogSource, /Apply changes/)
  assert.match(unsavedDialogSource, /Discard changes/)
  assert.match(unsavedDialogSource, /Keep editing/)
  assert.match(unsavedDialogSource, /onCloseAutoFocus/)
})
