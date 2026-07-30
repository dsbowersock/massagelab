import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import {
  BACKGROUND_VISUAL_HISTORY_LIMIT,
  buildBackgroundVisualPendingCommit,
  buildBackgroundVisualOpeningSnapshot,
  buildCommittedBackgroundVisualPreferences,
  createBackgroundVisualDraft,
  getCommittedBackgroundVisualSnapshot,
  partitionBackgroundVisualSettingChange,
  resolveBackgroundSelectionVisualSnapshot,
  resolveBackgroundVisualCommitScope,
  resolveBackgroundVisualPendingOutcome,
  reduceBackgroundVisualDraft,
  shouldUseDraftAwareBackgroundHost,
} from "../lib/background-visual-draft.js"
import {
  classifyVisualDraftAnchorNavigation,
  getConnectedVisualFocusTarget,
  getObservableVisualHistoryIndex,
  getVisualDraftHistoryTransition,
  installVisualDraftNavigationListeners,
} from "../lib/visual-draft-navigation.js"
import {
  BACKGROUND_PALETTE_METADATA_SUFFIXES,
} from "../components/backgrounds/backgroundPaletteRegistry.ts"
import {
  DEFAULT_CHIMER_SETTINGS,
  sanitizeChimerVisualCommitForEntitlements,
} from "../lib/chimer-timer.js"

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8")

const runningTimerSource = await read("app/chimer/running-timer.tsx")
const setTimerSource = await read("app/chimer/set-timer.tsx")
const navigationGuardSource = await read("app/chimer/visual-draft-navigation-guard.tsx")
const unsavedDialogSource = await read("app/chimer/unsaved-visual-changes-dialog.tsx")
const pageSource = await read("app/chimer/page.tsx")
const musicMiniPlayerSource = await read("components/providers/music-mini-player.tsx")
const runningTimerStyles = await read("app/chimer/running-timer.module.css")

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

test("trusted reducer history remains normalized by identity instead of being rebuilt on every action", () => {
  let state = createBackgroundVisualDraft(openingSnapshot)
  for (let index = 0; index < BACKGROUND_VISUAL_HISTORY_LIMIT; index += 1) {
    state = reduce(state, {
      type: "replace",
      snapshot: { ...openingSnapshot, properties: { speed: index + 1 } },
    })
  }
  const retainedHistoryEntry = state.undoStack[1]

  state = reduce(state, {
    type: "replace",
    snapshot: { ...openingSnapshot, properties: { speed: 100 } },
  })

  assert.equal(state.undoStack[0], retainedHistoryEntry)
})

test("an empty default id never selects an id-less visual preset", () => {
  const adapter = {
    sourceVisualProperties: { speed: 1 },
    roles: [{ id: "main", defaultSwatch: 0 }],
  }
  const resolved = resolveBackgroundSelectionVisualSnapshot({
    preferences: {
      visualPresetsByBackground: {
        waves: [{ name: "Malformed", properties: { speed: 99 }, mapping: { main: 6 } }],
      },
      defaultVisualPresetByBackground: { waves: "" },
    },
    backgroundId: "waves",
    adapter,
  })

  assert.deepEqual(resolved.properties, { speed: 1 })
  assert.deepEqual(resolved.mapping, { main: 0 })
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

test("legacy color settings cannot escape an open draft while approved properties stay undoable", () => {
  assert.deepEqual(
    partitionBackgroundVisualSettingChange({
      nextSettings: {
        movingBackgroundMainColor: "#ff0000",
        movingBackgroundOrbColor: "#00ff00",
        movingBackgroundEnabled: false,
      },
      draftOpen: true,
      visualPropertyKeys: ["movingBackgroundEnabled"],
      legacyColorPropertyKeys: ["movingBackgroundMainColor", "movingBackgroundOrbColor"],
    }),
    {
      draftProperties: { movingBackgroundEnabled: false },
      committedSettings: {},
    },
  )
  assert.deepEqual(
    partitionBackgroundVisualSettingChange({
      nextSettings: {
        movingBackgroundMainColor: "#ff0000",
        movingBackgroundEnabled: false,
      },
      draftOpen: false,
      visualPropertyKeys: ["movingBackgroundEnabled"],
      legacyColorPropertyKeys: ["movingBackgroundMainColor"],
    }),
    {
      draftProperties: {},
      committedSettings: {
        movingBackgroundMainColor: "#ff0000",
        movingBackgroundEnabled: false,
      },
    },
  )
})

test("legacy palette metadata and role colors cannot escape an open draft", () => {
  const nextSettings = {
    massageLabShapeGridPaletteMode: "harmony",
    massageLabShapeGridPrimaryColor: "#112233",
    massageLabShapeGridHarmony: "triadic",
    massageLabShapeGridBorderColor: "#223344",
    massageLabPhotonBeamPaletteMode: "custom",
    massageLabPhotonBeamPrimaryColor: "#334455",
    massageLabPhotonBeamHarmony: "complementary",
    massageLabPhotonBeamColorLine: "#445566",
    massageLabPhotonBeamSpeed: 1.75,
  }
  assert.deepEqual(
    partitionBackgroundVisualSettingChange({
      nextSettings,
      draftOpen: true,
      visualPropertyKeys: ["massageLabPhotonBeamSpeed"],
      legacyColorPropertyKeys: [
        "massageLabShapeGridBorderColor",
        "massageLabPhotonBeamColorLine",
      ],
      legacyPaletteMetadataSuffixes: BACKGROUND_PALETTE_METADATA_SUFFIXES,
    }),
    {
      draftProperties: { massageLabPhotonBeamSpeed: 1.75 },
      committedSettings: {},
    },
  )
  assert.deepEqual(
    partitionBackgroundVisualSettingChange({
      nextSettings,
      draftOpen: false,
      visualPropertyKeys: ["massageLabPhotonBeamSpeed"],
      legacyColorPropertyKeys: [
        "massageLabShapeGridBorderColor",
        "massageLabPhotonBeamColorLine",
      ],
      legacyPaletteMetadataSuffixes: BACKGROUND_PALETTE_METADATA_SUFFIXES,
    }),
    {
      draftProperties: {},
      committedSettings: nextSettings,
    },
  )
})

test("Music Apply and switch keep canonical Chimer selection while Chimer switch updates it", () => {
  const targetAdapter = {
    status: "supported",
    visualPropertyKeys: ["targetSpeed", "targetDensity"],
    sourceVisualProperties: { targetSpeed: 0.5, targetDensity: 12 },
    roles: [
      { id: "main", defaultSwatch: 2 },
      { id: "accent", defaultSwatch: 4 },
    ],
  }
  const preferences = {
    palette: openingSnapshot.palette,
    colorPresets: openingSnapshot.colorPresets,
    mappingsByBackground: { current: { main: 1 } },
    visualPresetsByBackground: {
      current: openingSnapshot.visualPresets,
      target: [{
        id: "target-default",
        properties: { targetSpeed: 9 },
        mapping: { main: 6 },
      }],
    },
    defaultVisualPresetByBackground: {
      current: "calm",
      target: "target-default",
    },
  }
  let draft = createBackgroundVisualDraft(openingSnapshot)
  draft = reduce(draft, {
    type: "replace",
    snapshot: {
      ...openingSnapshot,
      palette: {
        ...openingSnapshot.palette,
        primaryColor: "#abcdef",
        swatches: ["#abcdef", ...openingSnapshot.palette.swatches.slice(1)],
      },
      properties: { speed: 7, density: 5 },
      mapping: { main: 5, accent: 3 },
      colorPresets: [{ ...openingSnapshot.colorPresets[0], name: "Newest" }],
    },
  })
  const before = structuredClone(draft)
  const musicDirectCommit = buildBackgroundVisualPendingCommit({
    preferences,
    currentBackgroundId: "current",
    currentSnapshot: getCommittedBackgroundVisualSnapshot(draft),
  })
  assert.equal(musicDirectCommit.visualBackgroundId, "current")
  assert.equal(Object.hasOwn(musicDirectCommit, "backgroundId"), false)
  assert.deepEqual(
    resolveBackgroundVisualCommitScope({
      canonicalBackgroundId: "massage-lab-moving-gradient",
      visualBackgroundId: musicDirectCommit.visualBackgroundId,
      sourceVisualBackgroundId: musicDirectCommit.sourceVisualBackgroundId,
      committedBackgroundId: musicDirectCommit.backgroundId,
    }),
    {
      canonicalBackgroundId: "massage-lab-moving-gradient",
      visualBackgroundIds: ["current"],
    },
  )

  const musicSwitchCommit = buildBackgroundVisualPendingCommit({
    preferences,
    currentBackgroundId: "current",
    currentSnapshot: getCommittedBackgroundVisualSnapshot(draft),
    targetBackgroundId: "target",
    targetAdapter,
  })

  assert.equal(musicSwitchCommit.visualBackgroundId, "target")
  assert.equal(musicSwitchCommit.sourceVisualBackgroundId, "current")
  assert.equal(Object.hasOwn(musicSwitchCommit, "backgroundId"), false)
  assert.equal(musicSwitchCommit.backgroundVisualPreferences.palette.primaryColor, "#abcdef")
  assert.equal(musicSwitchCommit.backgroundVisualPreferences.colorPresets[0].name, "Newest")
  assert.deepEqual(musicSwitchCommit.backgroundVisualPreferences.mappingsByBackground.current, {
    main: 5,
    accent: 3,
  })
  assert.deepEqual(musicSwitchCommit.backgroundVisualPreferences.mappingsByBackground.target, {
    main: 6,
  })
  assert.deepEqual(musicSwitchCommit.properties, {
    speed: 7,
    density: 5,
    targetSpeed: 9,
    targetDensity: 12,
  })
  assert.deepEqual(
    resolveBackgroundVisualCommitScope({
      canonicalBackgroundId: "massage-lab-moving-gradient",
      visualBackgroundId: musicSwitchCommit.visualBackgroundId,
      sourceVisualBackgroundId: musicSwitchCommit.sourceVisualBackgroundId,
      committedBackgroundId: musicSwitchCommit.backgroundId,
    }),
    {
      canonicalBackgroundId: "massage-lab-moving-gradient",
      visualBackgroundIds: ["current", "target"],
    },
  )

  const chimerSwitchCommit = buildBackgroundVisualPendingCommit({
    preferences,
    currentBackgroundId: "current",
    currentSnapshot: getCommittedBackgroundVisualSnapshot(draft),
    targetBackgroundId: "target",
    targetAdapter,
    commitCanonicalBackgroundSelection: true,
  })
  assert.equal(chimerSwitchCommit.backgroundId, "target")
  assert.deepEqual(
    resolveBackgroundVisualCommitScope({
      canonicalBackgroundId: "massage-lab-moving-gradient",
      visualBackgroundId: chimerSwitchCommit.visualBackgroundId,
      sourceVisualBackgroundId: chimerSwitchCommit.sourceVisualBackgroundId,
      committedBackgroundId: chimerSwitchCommit.backgroundId,
    }),
    {
      canonicalBackgroundId: "target",
      visualBackgroundIds: ["current", "target"],
    },
  )
  assert.deepEqual(draft, before)
  assert.equal(draft.undoStack.length, 1)

  const accountBodies = []
  const selectedBackgrounds = []
  const redemptionIntent = {
    type: "select-background",
    backgroundId: "target",
    newlyOwnedBackgroundIds: ["target"],
  }
  const applied = resolveBackgroundVisualPendingOutcome({
    outcome: "apply",
    intent: redemptionIntent,
    commit: musicSwitchCommit,
  })
  if (applied.commit) accountBodies.push(applied.commit)
  if (applied.resumeIntent?.type === "select-background") {
    selectedBackgrounds.push(applied.resumeIntent.backgroundId)
  }
  assert.deepEqual(accountBodies, [musicSwitchCommit])
  assert.deepEqual(selectedBackgrounds, ["target"])
  assert.deepEqual(applied.resumeIntent, redemptionIntent)
  assert.deepEqual(
    resolveBackgroundVisualPendingOutcome({
      outcome: "discard",
      intent: redemptionIntent,
      commit: musicSwitchCommit,
    }),
    {
      commit: null,
      resumeIntent: redemptionIntent,
    },
  )
  assert.deepEqual(
    resolveBackgroundVisualPendingOutcome({
      outcome: "keep",
      intent: redemptionIntent,
      commit: musicSwitchCommit,
    }),
    { commit: null, resumeIntent: null },
  )
})

test("owned-only Music Apply retains visual properties without changing canonical Chimer access", () => {
  const visualBackgroundId = "massage-lab-stars"
  const committed = sanitizeChimerVisualCommitForEntitlements({
    currentSettings: {
      ...DEFAULT_CHIMER_SETTINGS,
      backgroundId: DEFAULT_CHIMER_SETTINGS.backgroundId,
      primaryFontColor: "#010203",
    },
    candidateProperties: {
      massageLabStarsSpeed: 72,
      primaryFontColor: "#040506",
    },
    canonicalBackgroundId: DEFAULT_CHIMER_SETTINGS.backgroundId,
    visualBackgroundIds: [visualBackgroundId],
    visualPropertyKeysByBackground: {
      [visualBackgroundId]: ["massageLabStarsSpeed"],
    },
    backgroundVisualPreferences: {
      palette: {
        mode: "custom",
        primaryColor: "#112233",
        harmony: "analogous",
        swatches: [
          "#112233",
          "#223344",
          "#334455",
          "#445566",
          "#556677",
          "#667788",
          "#778899",
        ],
      },
    },
  }, {
    featureKeys: [],
    ownedBackgroundIds: [visualBackgroundId],
  })

  assert.equal(committed.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
  assert.equal(committed.massageLabStarsSpeed, 72)
  assert.equal(committed.backgroundVisualPreferences.palette.mode, "custom")
  assert.equal(committed.primaryFontColor, DEFAULT_CHIMER_SETTINGS.primaryFontColor)
})

test("setup selection preserves owned source tuning while selecting a free canonical background", () => {
  const ownedSourceBackgroundId = "massage-lab-stars"
  const committed = sanitizeChimerVisualCommitForEntitlements({
    currentSettings: {
      ...DEFAULT_CHIMER_SETTINGS,
      backgroundId: ownedSourceBackgroundId,
      massageLabStarsSpeed: 72,
    },
    candidateProperties: {
      massageLabStarsSpeed: 72,
    },
    canonicalBackgroundId: DEFAULT_CHIMER_SETTINGS.backgroundId,
    visualBackgroundIds: [
      ownedSourceBackgroundId,
      DEFAULT_CHIMER_SETTINGS.backgroundId,
    ],
    visualPropertyKeysByBackground: {
      [ownedSourceBackgroundId]: ["massageLabStarsSpeed"],
      [DEFAULT_CHIMER_SETTINGS.backgroundId]: [],
    },
    backgroundVisualPreferences: DEFAULT_CHIMER_SETTINGS.backgroundVisualPreferences,
  }, {
    featureKeys: [],
    ownedBackgroundIds: [ownedSourceBackgroundId],
  })

  assert.equal(committed.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
  assert.equal(committed.massageLabStarsSpeed, 72)
})

test("legacy host selection helper remains deterministic during the shared-host cutover", () => {
  assert.equal(shouldUseDraftAwareBackgroundHost({
    isOriginalBackground: true,
    hasVisualDraft: false,
  }), false)
  assert.equal(shouldUseDraftAwareBackgroundHost({
    isOriginalBackground: true,
    hasVisualDraft: true,
  }), true)
  assert.equal(shouldUseDraftAwareBackgroundHost({
    isOriginalBackground: false,
    hasVisualDraft: false,
  }), true)
})

test("eligible-link classification rejects bare downloads and non-app navigation", () => {
  const base = {
    currentHref: "https://massagelab.app/chimer?panel=visual",
    button: 0,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    defaultPrevented: false,
    target: "_self",
    download: false,
  }
  assert.deepEqual(
    classifyVisualDraftAnchorNavigation({
      ...base,
      href: "https://massagelab.app/account?tab=settings#visual",
    }),
    { href: "/account?tab=settings#visual" },
  )
  assert.equal(classifyVisualDraftAnchorNavigation({
    ...base,
    href: "https://massagelab.app/account",
    download: true,
  }), null)
  assert.equal(classifyVisualDraftAnchorNavigation({
    ...base,
    href: "https://other.example/account",
  }), null)
  assert.equal(classifyVisualDraftAnchorNavigation({
    ...base,
    href: "https://massagelab.app/chimer?panel=visual#colors",
  }), null)
  assert.equal(classifyVisualDraftAnchorNavigation({
    ...base,
    href: "https://massagelab.app/account",
    ctrlKey: true,
  }), null)
})

test("focus target capture happens before dialog autofocus and rejects disconnected elements", () => {
  const target = { isConnected: true, focus() {} }
  assert.equal(getConnectedVisualFocusTarget(target), target)
  assert.equal(getConnectedVisualFocusTarget({ isConnected: false, focus() {} }), null)
  assert.equal(getConnectedVisualFocusTarget({ isConnected: true }), null)
  assert.equal(getConnectedVisualFocusTarget(null), null)
})

test("observable history back and forward restore without duplicate dialog transitions", () => {
  assert.deepEqual(
    getVisualDraftHistoryTransition({
      currentIndex: 5,
      targetIndex: 4,
      restoring: false,
      blocked: false,
    }),
    {
      restoring: true,
      restoreDelta: 1,
      historyDelta: -1,
      notify: true,
    },
  )
  assert.deepEqual(
    getVisualDraftHistoryTransition({
      currentIndex: 5,
      targetIndex: 5,
      restoring: true,
      blocked: true,
    }),
    {
      restoring: false,
      restoreDelta: 0,
      historyDelta: null,
      notify: false,
    },
  )
  assert.deepEqual(
    getVisualDraftHistoryTransition({
      currentIndex: 5,
      targetIndex: 4,
      restoring: false,
      blocked: true,
    }),
    {
      restoring: true,
      restoreDelta: 1,
      historyDelta: null,
      notify: false,
    },
  )
  assert.deepEqual(
    getVisualDraftHistoryTransition({
      currentIndex: 5,
      targetIndex: 6,
      restoring: false,
      blocked: false,
    }),
    {
      restoring: true,
      restoreDelta: -1,
      historyDelta: 1,
      notify: true,
    },
  )
  assert.deepEqual(
    getVisualDraftHistoryTransition({
      currentIndex: null,
      targetIndex: null,
      restoring: false,
      blocked: false,
    }),
    {
      restoring: false,
      restoreDelta: 0,
      historyDelta: null,
      notify: false,
    },
  )
})

test("dirty navigation listeners install and clean up exactly once", () => {
  const calls = []
  const target = (owner) => ({
    addEventListener(type, listener, capture) {
      calls.push(["add", owner, type, listener, capture])
    },
    removeEventListener(type, listener, capture) {
      calls.push(["remove", owner, type, listener, capture])
    },
  })
  const onClick = () => {}
  const onBeforeUnload = () => {}
  const onPopState = () => {}
  const cleanup = installVisualDraftNavigationListeners({
    documentTarget: target("document"),
    windowTarget: target("window"),
    onClick,
    onBeforeUnload,
    onPopState,
  })
  cleanup()
  cleanup()

  assert.deepEqual(calls, [
    ["add", "document", "click", onClick, true],
    ["add", "window", "beforeunload", onBeforeUnload, undefined],
    ["add", "window", "popstate", onPopState, undefined],
    ["remove", "document", "click", onClick, true],
    ["remove", "window", "beforeunload", onBeforeUnload, undefined],
    ["remove", "window", "popstate", onPopState, undefined],
  ])
})

test("indexless history keeps anchor and unload guards without directionless popstate", () => {
  assert.equal(getObservableVisualHistoryIndex({
    navigationIndex: null,
    historyStateIndex: null,
  }), null)

  const calls = []
  const target = (owner) => ({
    addEventListener(type) {
      calls.push(["add", owner, type])
    },
    removeEventListener(type) {
      calls.push(["remove", owner, type])
    },
  })
  const cleanup = installVisualDraftNavigationListeners({
    documentTarget: target("document"),
    windowTarget: target("window"),
    onClick() {},
    onBeforeUnload() {},
    onPopState: null,
  })
  cleanup()

  assert.deepEqual(calls, [
    ["add", "document", "click"],
    ["add", "window", "beforeunload"],
    ["remove", "document", "click"],
    ["remove", "window", "beforeunload"],
  ])
  assert.match(
    navigationGuardSource,
    /onPopState: guardedHistoryIndex !== null\s*\? handlePopState as EventListener\s*:\s*null/,
  )
  assert.doesNotMatch(
    navigationGuardSource,
    /history\.(?:pushState|replaceState)|visual-draft-\$\{|__massageLabVisualDraftGuard|sessionStorage/,
  )
})

test("live Visual integration owns draft preview, one Apply, and reachable actions", () => {
  assert.match(runningTimerSource, /createBackgroundVisualDraft/)
  assert.match(runningTimerSource, /BackgroundPaletteEditor/)
  assert.match(runningTimerSource, /BackgroundColorPresetManager/)
  assert.match(runningTimerSource, /BackgroundVisualPresetManager/)
  assert.match(runningTimerSource, /backgroundPalette=\{effectiveBackgroundPalette\}/)
  assert.match(runningTimerSource, /currentVisualSnapshot\?\.palette \?\? backgroundVisualPreferences\.palette/)
  assert.doesNotMatch(runningTimerSource, /draftPalettePreview=/)
  assert.match(runningTimerSource, /hideLegacyColorControls/)
  assert.match(runningTimerSource, /hideLegacyPaletteMetadataControls/)
  assert.match(runningTimerSource, /type:\s*"reset-colors"/)
  assert.match(runningTimerSource, /type:\s*"reset-properties"/)
  assert.match(runningTimerSource, /type:\s*"undo"/)
  assert.match(runningTimerSource, /type:\s*"redo"/)
  assert.match(runningTimerSource, /onApplyBackgroundVisualPreferences/)
  assert.match(pageSource, /visualDraftPropertyOverrides/)
  assert.match(pageSource, /visualBackgroundId/)
  assert.match(pageSource, /resolveBackgroundVisualCommitScope/)
  assert.match(pageSource, /accessOverride\?: BackgroundAccessSnapshot/)
  assert.match(pageSource, /\}, accessOverride \?\? backgroundAccessRef\.current, \{/)
  assert.doesNotMatch(navigationGuardSource, /localStorage|sessionStorage|fetch\(/)
  assert.match(runningTimerStyles, /\.hideLegacyColorControls[\s\S]*\.colorRow/)
  assert.match(runningTimerStyles, /\.hideLegacyPaletteMetadataControls[\s\S]*color mode/)
})

test("reselecting the active background closes without rebuilding Visual state", () => {
  assert.match(
    runningTimerSource,
    /if \(nextBackgroundId === visualBackgroundId\) \{\s*finishBackgroundSelection\(\)\s*return\s*\}/,
  )
  assert.ok(
    runningTimerSource.indexOf("if (nextBackgroundId === visualBackgroundId)") <
      runningTimerSource.indexOf("if (visualDraft?.dirty)"),
  )
  assert.match(
    runningTimerSource,
    /if \(nextBackgroundId === visualBackgroundId\) \{[\s\S]*if \(!visualDraft\?\.dirty\) \{\s*finishBackgroundSelection\(\)[\s\S]*return/,
  )
  assert.match(
    runningTimerSource,
    /if \(nextBackgroundId === visualBackgroundId\) \{[\s\S]*const accessOverride = newlyOwnedBackgroundIds\.length > 0[\s\S]*mergeBackgroundAccessOwnership\([\s\S]*const shouldActivateBackground = !movingBackgroundEnabled[\s\S]*onSettingsChange\(\s*shouldActivateBackground \? \{ movingBackgroundEnabled: true \} : \{\},\s*accessOverride/,
  )
})

test("Visual Apply updates the live settings snapshot before delayed account hydration can read it", () => {
  const applyStart = pageSource.indexOf("const applyBackgroundVisualPreferences")
  const applyEnd = pageSource.indexOf("const retryBackgroundVisualPreferenceSync", applyStart)
  const applySource = pageSource.slice(applyStart, applyEnd)

  assert.notEqual(applyStart, -1)
  assert.notEqual(applyEnd, -1)
  assert.match(
    applySource,
    /const committedSettings = request\.sanitizedSettings[\s\S]*settingsRef\.current = committedSettings\s+setSettings\(committedSettings\)[\s\S]*localStorage\.setItem\(CHIMER_STORAGE_KEY, JSON\.stringify\(committedSettings\)\)/,
  )
})

test("authoritative access fallback replaces revoked background Visual identity", () => {
  assert.match(
    runningTimerSource,
    /const selectedBackgroundDefinition = resolveAccessibleBackgroundDefinition\(backgroundId, effectiveBackgroundAccess, backgroundCategory\)\s*const visualBackgroundId = selectedBackgroundDefinition\.id/,
  )
  assert.match(runningTimerSource, /selectedBackgroundId:\s*visualEditorBackgroundId/)
  assert.match(
    runningTimerSource,
    /visualDraft && visualDraftBackgroundId === visualBackgroundId\s*\? getCommittedBackgroundVisualSnapshot\(visualDraft\)\s*:\s*null/,
  )
  assert.match(
    runningTimerSource,
    /rebaseVisualDraft\(visualBackgroundId\)/,
  )
  assert.match(runningTimerSource, /onVisualDraftPreviewChange\(currentVisualSnapshot \? \(currentVisualSnapshot\.properties as Partial<ChimerSettings>\) : null\)/)
  assert.match(runningTimerSource, /const adapter = backgroundPaletteRegistry\[visualBackgroundId\]/)
  assert.match(runningTimerSource, /const selectedPaletteAdapter = backgroundPaletteRegistry\[visualEditorBackgroundId\]/)
  assert.match(runningTimerSource, /mappingsByBackground as Record<string, Record<string, number>>\)\[visualBackgroundId\]/)
  assert.doesNotMatch(runningTimerSource, /backgroundPaletteRegistry\[backgroundId\]/)
  assert.doesNotMatch(runningTimerSource, /mappingsByBackground as Record<string, Record<string, number>>\)\[backgroundId\]/)
})

test("access-driven Visual rebase preserves explicit Apply, Discard, and Keep Editing outcomes", () => {
  const rebaseIntent = {
    type: "rebase-background",
    sourceBackgroundId: "revoked",
    backgroundId: "accessible",
    restoreFocusTarget: null,
  }
  const commit = { visualBackgroundId: "accessible", sourceVisualBackgroundId: "revoked" }

  assert.deepEqual(
    resolveBackgroundVisualPendingOutcome({
      outcome: "apply",
      intent: rebaseIntent,
      commit,
    }),
    { commit, resumeIntent: rebaseIntent },
  )
  assert.deepEqual(
    resolveBackgroundVisualPendingOutcome({
      outcome: "discard",
      intent: rebaseIntent,
      commit,
    }),
    { commit: null, resumeIntent: rebaseIntent },
  )
  assert.deepEqual(
    resolveBackgroundVisualPendingOutcome({
      outcome: "keep",
      intent: rebaseIntent,
      commit,
    }),
    { commit: null, resumeIntent: null },
  )
  assert.match(
    runningTimerSource,
    /visualDraft\?\.dirty && visualDraftBackgroundId[\s\S]*type:\s*"rebase-background"[\s\S]*sourceBackgroundId:\s*visualDraftBackgroundId,[\s\S]*backgroundId:\s*visualBackgroundId,/,
  )
  assert.match(
    runningTimerSource,
    /const currentVisualSnapshot = useMemo\([\s\S]*visualDraftBackgroundId === visualBackgroundId[\s\S]*const currentVisualEditorSnapshot = useMemo\([\s\S]*visualDraftBackgroundId === visualEditorBackgroundId/,
  )
  assert.match(
    runningTimerSource,
    /if \(outcome === "keep"\) \{\s*setDeferredVisualRebase\(intent\)\s*\} else \{[\s\S]*rebaseVisualDraft\(intent\.backgroundId, resolution\.commit\)/,
  )
  assert.match(
    runningTimerSource,
    /const rebaseIntent = deferredVisualRebase[\s\S]*buildVisualDraftCommit\(rebaseIntent\)[\s\S]*rebaseVisualDraft\(deferredVisualRebase\.backgroundId, commit\)/,
  )
  assert.match(
    runningTimerSource,
    /currentVisualEditorSnapshot && selectedPaletteAdapter[\s\S]*backgroundName=\{visualEditorBackgroundDefinition\.label\}/,
  )
  assert.match(
    runningTimerSource,
    /onVisualDraftPreviewChange\(currentVisualSnapshot \? \(currentVisualSnapshot\.properties as Partial<ChimerSettings>\) : null\)/,
  )
  assert.match(
    runningTimerSource,
    /useEffect\(\s*\(\) => \(\) => \{[\s\S]*onVisualDraftPreviewChange\(null\)[\s\S]*\},\s*\[onVisualDraftPreviewChange\],\s*\)/,
  )
})

test("redeemed ownership survives Apply and Discard background-switch continuations", () => {
  assert.match(
    runningTimerSource,
    /type:\s*"select-background",[\s\S]*backgroundId:\s*nextBackgroundId,[\s\S]*newlyOwnedBackgroundIds,/,
  )
  assert.match(
    runningTimerSource,
    /intent\.type === "select-background"[\s\S]*mergeBackgroundAccessOwnership\([\s\S]*intent\.newlyOwnedBackgroundIds[\s\S]*mode\.context === "musicVisualizer"[\s\S]*mode\.onBackgroundChange\(intent\.backgroundId, selectionAccess\)[\s\S]*performBackgroundSelection\(intent\.backgroundId, intent\.newlyOwnedBackgroundIds\)/,
  )
  assert.match(
    runningTimerSource,
    /const selectionAccess = intent\?\.type === "select-background"[\s\S]*intent\.newlyOwnedBackgroundIds[\s\S]*accessOverride: selectionAccess/,
  )
  const applyStart = pageSource.indexOf("const applyBackgroundVisualPreferences")
  const applyEnd = pageSource.indexOf("const retryBackgroundVisualPreferenceSync", applyStart)
  const applySource = pageSource.slice(applyStart, applyEnd)
  assert.notEqual(applyStart, -1)
  assert.notEqual(applyEnd, -1)
  assert.match(
    applySource,
    /const accessOverride = "accessOverride" in input \? input\.accessOverride : undefined[\s\S]*setTransientOwnedBackgroundIds\(\(current\) => \[[\s\S]*accessOverride\.ownedBackgroundIds[\s\S]*sanitizeChimerVisualCommitForEntitlements/,
  )
  assert.match(
    pageSource,
    /setTransientOwnedBackgroundIds\(\[\]\)[\s\S]*\[commerceOwnedBackgroundIds\]/,
  )
})

test("Music visualizer minimize preserves replace navigation through Apply, Discard, and Keep Editing", () => {
  const minimizeCommit = { visualBackgroundId: "current" }
  const minimizeIntent = {
    type: "navigate",
    href: "/music",
    historyDelta: null,
    replace: true,
    restoreFocusTarget: null,
  }
  assert.deepEqual(
    resolveBackgroundVisualPendingOutcome({
      outcome: "apply",
      intent: minimizeIntent,
      commit: minimizeCommit,
    }),
    { commit: minimizeCommit, resumeIntent: minimizeIntent },
  )
  assert.deepEqual(
    resolveBackgroundVisualPendingOutcome({
      outcome: "discard",
      intent: minimizeIntent,
      commit: minimizeCommit,
    }),
    { commit: null, resumeIntent: minimizeIntent },
  )
  assert.deepEqual(
    resolveBackgroundVisualPendingOutcome({
      outcome: "keep",
      intent: minimizeIntent,
      commit: minimizeCommit,
    }),
    { commit: null, resumeIntent: null },
  )
  assert.match(musicMiniPlayerSource, /<Link[\s\S]*data-visual-draft-navigation-mode=\{isMusicVisualizerRoute \? "replace" : undefined\}/)
  assert.match(navigationGuardSource, /replace:\s*anchor\.dataset\.visualDraftNavigationMode === "replace"/)
  assert.match(runningTimerSource, /replace:\s*navigation\.replace/)
  assert.match(runningTimerSource, /if \(intent\.replace\) \{\s*router\.replace\(intent\.href\)/)
})

test("ordinary Clock background selection commits visual state and canonical selection atomically", () => {
  assert.match(
    runningTimerSource,
    /commitCanonicalBackgroundSelection:\s*mode\.context !== "musicVisualizer"/,
  )
  assert.match(
    runningTimerSource,
    /commitCanonicalBackgroundSelection:\s*intent\?\.type === "select-background"\s*&&\s*mode\.context !== "musicVisualizer"/,
  )
  assert.match(
    runningTimerSource,
    /if \(mode\.context === "musicVisualizer"\) \{\s*mode\.onBackgroundChange\(nextBackgroundId, selectionAccess\)/,
  )
  assert.doesNotMatch(
    runningTimerSource,
    /if \(mode\.context !== "chimer"\) \{\s*mode\.onBackgroundChange\(nextBackgroundId, selectionAccess\)/,
  )
})

test("background selection atomically activates direct, same-ID, and dirty-Apply commits in every context", () => {
  const directSelectionStart = runningTimerSource.indexOf("const performBackgroundSelection")
  const directSelectionEnd = runningTimerSource.indexOf("const handleBackgroundSelection", directSelectionStart)
  const directSelectionSource = runningTimerSource.slice(directSelectionStart, directSelectionEnd)
  const pendingResolutionStart = runningTimerSource.indexOf("const resolvePendingVisualIntent")
  const pendingResolutionEnd = runningTimerSource.indexOf("const handleBackgroundSavedToggle", pendingResolutionStart)
  const pendingResolutionSource = runningTimerSource.slice(pendingResolutionStart, pendingResolutionEnd)

  assert.match(
    directSelectionSource,
    /activateBackground: true/,
  )
  assert.match(
    pendingResolutionSource,
    /intent\?\.type === "select-background"[\s\S]*\{ activateBackground: true \}/,
  )
  assert.match(
    pageSource,
    /const activateBackground =\s*"activateBackground" in input && input\.activateBackground === true[\s\S]*movingBackgroundEnabled: true/,
  )
  assert.match(
    pageSource,
    /if \(nextSettings\.movingBackgroundEnabled === true\) \{[\s\S]*setRunWithoutAnimatedBackground\(false\)/,
  )
  assert.match(
    pageSource,
    /if \(activateBackground\) \{[\s\S]*setRunWithoutAnimatedBackground\(false\)/,
  )
  assert.doesNotMatch(
    directSelectionSource,
    /\.\.\.\(mode\.context !== "musicVisualizer" \? \{ activateBackground: true \} : \{\}\)/,
  )
  assert.doesNotMatch(
    pendingResolutionSource,
    /intent\?\.type === "select-background" && mode\.context !== "musicVisualizer"/,
  )
})

test("setup presets route canonical background selection before applying remaining settings", () => {
  assert.match(
    setTimerSource,
    /onBackgroundVisualCommit: \(input: \{[\s\S]*backgroundId: BackgroundId/,
  )
  assert.match(
    setTimerSource,
    /const applyPreset = \(preset: ChimerSetupPresetState\) => \{[\s\S]*skipIntervalCues: intervalSkip,[\s\S]*backgroundId,[\s\S]*\.\.\.settingsToApply[\s\S]*handleBackgroundSelection\(backgroundId\)\s*onSettingsChange\(settingsToApply\)\s*setSkipIntervalCues\(intervalSkip\)/,
  )
  assert.doesNotMatch(
    setTimerSource,
    /const applyPreset = \(preset: ChimerSetupPresetState\) => \{[\s\S]*onSettingsChange\(preset\)/,
  )
})

test("dirty navigation guard covers eligible app links, history, and native unload only", () => {
  assert.match(navigationGuardSource, /handleBeforeUnload/)
  assert.match(navigationGuardSource, /handlePopState/)
  assert.match(navigationGuardSource, /metaKey: event\.metaKey/)
  assert.match(navigationGuardSource, /anchor\.hasAttribute\("download"\)/)
  assert.match(navigationGuardSource, /target: anchor\.target \|\| "_self"/)
  assert.doesNotMatch(navigationGuardSource, /history\.pushState/)
  assert.doesNotMatch(navigationGuardSource, /history\.replaceState/)
  assert.doesNotMatch(navigationGuardSource, /sessionStorage|VisualDraftGuard/)
  assert.match(navigationGuardSource, /history\.go/)
  assert.match(navigationGuardSource, /installVisualDraftNavigationListeners/)
  assert.match(unsavedDialogSource, /Apply changes/)
  assert.match(unsavedDialogSource, /Discard changes/)
  assert.match(unsavedDialogSource, /Keep editing/)
  assert.match(unsavedDialogSource, /onCloseAutoFocus/)
  assert.doesNotMatch(unsavedDialogSource, /document\.activeElement/)
  assert.match(unsavedDialogSource, /restoreFocusTarget/)
  assert.match(unsavedDialogSource, /explicitOutcomeRef/)
  assert.match(unsavedDialogSource, /useEffect\(\(\) => \{[\s\S]*if \(!open\)[\s\S]*explicitOutcomeRef\.current = false/)
  assert.match(unsavedDialogSource, /resolveExplicitOutcome\(onApply\)/)
  assert.match(unsavedDialogSource, /resolveExplicitOutcome\(onDiscard\)/)
  assert.match(unsavedDialogSource, /resolveExplicitOutcome\(onKeepEditing\)/)
  assert.match(runningTimerSource, /className=\{styles\.visualDraftStatus\}[\s\S]*role="status"[\s\S]*aria-live="polite"/)
  const actionRowOpeningTag = runningTimerSource.match(
    /<div\s+className=\{styles\.visualDraftActions\}[^>]*>/,
  )?.[0]
  assert.ok(actionRowOpeningTag)
  assert.doesNotMatch(actionRowOpeningTag, /\brole=/)
})

test("globe coordinate inputs keep string drafts and clock font changes remeasure", () => {
  for (const source of [setTimerSource, runningTimerSource]) {
    assert.match(source, /globeMarkerDraft/)
    assert.match(source, /globeLocationMessage/)
    assert.match(source, /getCurrentPosition\(\(\{ coords \}\) => \{[\s\S]*\}, \(\) => \{[\s\S]*setGlobeLocationMessage/)
    assert.match(source, /role="status" aria-live="polite"/)
    assert.match(source, /We could not access your location/)
    assert.match(source, /parseGlobeCoordinateDraft/)
    assert.match(source, /onBlur=\{\(\) => commitGlobeCoordinate\("latitude"\)\}/)
    assert.match(source, /onBlur=\{\(\) => commitGlobeCoordinate\("longitude"\)\}/)
    assert.doesNotMatch(
      source,
      /massageLab3DGlobeMarker(?:Lat|Lng): Number\(event\.target\.value\)/,
    )
  }
  assert.match(
    runningTimerSource,
    /getCurrentPosition\(\(\{ coords \}\) => \{[\s\S]*\}, \(\) => \{[\s\S]*\}, \{ timeout: 10_000 \}\)/,
  )
  assert.match(
    runningTimerSource,
    /\}, \[clockFontFamily, fontSize, isClockMode, isCurrentTimePrimary,/,
  )
})
