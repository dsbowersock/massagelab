import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

import {
  buildBackgroundPaletteEditorViewModel,
  buildBackgroundPaletteHarmonyChange,
  buildBackgroundHarmonyPreviews,
  buildBackgroundPaletteMappingChange,
  buildBackgroundPaletteModeChange,
  buildBackgroundPaletteSwatchChange,
  buildColorPresetDraftAction,
  buildPresetApplyDraftAction,
  buildPresetDeleteDraftAction,
  buildPresetRenameDraftAction,
  buildVisualPresetDefaultDraftAction,
  buildVisualPresetDraftAction,
  getBackgroundPresetLimit,
} from "../components/chimer-controls/background-palette-controls.ts"

const editorSource = await readFile(
  new URL("../components/chimer-controls/BackgroundPaletteEditor.tsx", import.meta.url),
  "utf8",
)
const presetSource = await readFile(
  new URL("../components/chimer-controls/BackgroundPresetManager.tsx", import.meta.url),
  "utf8",
)
const controlsSource = await readFile(
  new URL("../components/chimer-controls/background-palette-controls.ts", import.meta.url),
  "utf8",
)
const runningTimerSource = await readFile(
  new URL("../app/chimer/running-timer.tsx", import.meta.url),
  "utf8",
)
const backgroundHostSource = await readFile(
  new URL("../components/backgrounds/BackgroundHost.tsx", import.meta.url),
  "utf8",
)

test("Harmony buttons preview every generated palette from the current Primary", () => {
  const harmonies = ["analogous", "complementary", "triad"]
  const previews = buildBackgroundHarmonyPreviews("#ff0000", harmonies)
  const changedPrimary = buildBackgroundHarmonyPreviews("#00ff00", harmonies)

  assert.deepEqual(Object.keys(previews), harmonies)
  for (const harmony of harmonies) {
    assert.equal(previews[harmony].length, 7)
    assert.equal(previews[harmony][0], "#ff0000")
    assert.equal(changedPrimary[harmony][0], "#00ff00")
    assert.notDeepEqual(changedPrimary[harmony], previews[harmony])
  }
  assert.notDeepEqual(previews.analogous, previews.complementary)
  assert.match(editorSource, /previewColors=\{harmonyPreviews\}/)
})

test("shared palette editor presents one accessible mode choice and seven indexed swatches", () => {
  assert.match(editorSource, /SegmentedToggleGroup/)
  assert.match(editorSource, /label="Color source"/)
  assert.match(editorSource, /buildBackgroundPaletteEditorViewModel/)
  assert.match(controlsSource, /\{ value: "source", label: "Source" \}/)
  assert.match(controlsSource, /\{ value: "custom", label: "Custom"/)
  assert.match(controlsSource, /\{ value: "harmony", label: "Harmony"/)
  assert.match(controlsSource, /BACKGROUND_PALETTE_SWATCH_COUNT/)
  assert.match(controlsSource, /`Swatch \$\{index \+ 1\}`/)
  assert.match(controlsSource, /index === 0 \? "Primary"/)
  assert.match(controlsSource, /Not used by this background/)
  assert.match(controlsSource, /roles\.map\(\(role\) => role\.label\)\.join\(" \+ "\)/)
})

test("Source and Harmony are contextual views that preserve dormant saved swatches", () => {
  assert.match(controlsSource, /effectiveMode === "source"/)
  assert.match(controlsSource, /readOnly: isSource \|\| \(isHarmony && index > 0\)/)
  assert.match(controlsSource, /generateBackgroundHarmonySwatches/)
  assert.match(editorSource, /HarmonyToggleGroup/)
  assert.match(editorSource, /Source colors remain available/)
  assert.doesNotMatch(editorSource, /localStorage|sessionStorage|fetch\(/)
})

test("role mapping names every selectable swatch by number and current color", () => {
  assert.match(editorSource, /Color mapping/)
  assert.match(editorSource, /aria-label=\{`\$\{role\.label\} color mapping`\}/)
  assert.match(editorSource, /Swatch \{swatch\.number\} — \{swatch\.color\}/)
  assert.match(editorSource, /disabled=\{disabled \|\| isSource \|\| !canCustomize\}/)
})

test("Color and Visual preset managers expose only their approved draft actions and limits", () => {
  assert.match(presetSource, /getBackgroundPresetLimit/)
  assert.match(controlsSource, /BACKGROUND_COLOR_PRESET_LIMIT/)
  assert.match(controlsSource, /BACKGROUND_VISUAL_PRESET_LIMIT/)
  for (const action of [
    "Save as new",
    "Apply",
    "Update",
    "Rename",
    "Delete",
    "Set as default",
  ]) {
    assert.match(presetSource, new RegExp(`>\\s*${action}\\s*<|name="${action}"`))
  }
  assert.match(presetSource, /kind === "visual"/)
  assert.match(presetSource, /defaultMarker/)
  assert.match(presetSource, /maxLength=\{PRESET_NAME_LIMIT\}/)
  assert.match(presetSource, /DropdownMenu/)
  assert.match(presetSource, /AlertDialog/)
  assert.match(presetSource, /aria-live="polite"/)
  assert.doesNotMatch(presetSource, /localStorage|sessionStorage|fetch\(/)
})

test("Source mode blocks Color preset saves but keeps saved-preset Apply available", () => {
  assert.match(
    runningTimerSource,
    /<BackgroundColorPresetManager[\s\S]*disabled=\{!canCustomizeSelectedBackground\}[\s\S]*saveDisabled=\{currentVisualEditorSnapshot\.palette\.mode === "source"\}/,
  )
  assert.match(presetSource, /disabled=\{disabled \|\| saveDisabled \|\| atLimit\}/)
  assert.match(
    presetSource,
    /<DropdownMenuItem onSelect=\{\(\) => applyPreset\(preset\)\}>[\s\S]*Apply[\s\S]*<DropdownMenuItem disabled=\{saveDisabled\} onSelect=\{\(\) => updatePreset\(preset\)\}>/,
  )
  assert.doesNotMatch(presetSource, /<DropdownMenuTrigger[\s\S]{0,400}disabled=\{disabled \|\| saveDisabled\}/)
})

test("BackgroundHost applies the resolved palette to its persistent fallback layer", () => {
  assert.match(backgroundHostSource, /const fallbackStyle = useMemo\([\s\S]*resolveBackgroundFallbackStyle\(\{[\s\S]*palette: backgroundPalette\.palette,[\s\S]*mapping: backgroundPalette\.mapping,[\s\S]*canCustomize,[\s\S]*\[backgroundPalette, canCustomize, entry\.fallbackStyle, entry\.id\]/)
  assert.match(backgroundHostSource, /className=\{cn\(styles\.fallback, entry\.fallbackClassName\)\}[\s\S]*style=\{fallbackStyle\}/)
  assert.doesNotMatch(backgroundHostSource, /style=\{entry\.fallbackStyle\}/)
})

test("Visual summaries exclude shared colors and retain the active role mapping", () => {
  assert.match(presetSource, /SHARED_COLOR_PROPERTY_KEYS/)
  assert.match(presetSource, /Shared colors are not included/)
  assert.match(presetSource, /Active color mapping/)
  assert.match(presetSource, /preset\.mapping/)
})

test("Color preset draft actions are palette-only across every operation", () => {
  const palette = {
    mode: "custom",
    primaryColor: "#111111",
    harmony: "analogous",
    swatches: ["#111111", "#222222", "#333333", "#444444", "#555555", "#666666", "#777777"],
  }
  const save = buildColorPresetDraftAction({
    operation: "save",
    id: "warm",
    name: "Warm",
    timestamp: 10,
    palette,
  })
  const update = buildColorPresetDraftAction({
    operation: "update",
    id: "warm",
    name: "Warm update",
    timestamp: 11,
    palette,
  })

  assert.deepEqual(save, {
    type: "save-color-preset",
    preset: { id: "warm", name: "Warm", timestamp: 10, palette },
  })
  assert.deepEqual(update, {
    type: "update-color-preset",
    preset: { id: "warm", name: "Warm update", timestamp: 11, palette },
  })
  assert.deepEqual(buildPresetApplyDraftAction("color", "warm"), {
    type: "apply-color-preset",
    id: "warm",
  })
  assert.deepEqual(buildPresetRenameDraftAction("color", "warm", "Renamed"), {
    type: "rename-color-preset",
    id: "warm",
    name: "Renamed",
  })
  assert.deepEqual(buildPresetDeleteDraftAction("color", "warm"), {
    type: "delete-color-preset",
    id: "warm",
  })
  assert.equal(JSON.stringify([save, update]).includes("mapping"), false)
  assert.equal(JSON.stringify([save, update]).includes("backgroundId"), false)
  assert.equal(getBackgroundPresetLimit("color"), 6)
})

test("Visual preset draft actions retain properties, mapping, defaults, and exact limits", () => {
  const save = buildVisualPresetDraftAction({
    operation: "save",
    id: "calm",
    name: "Calm",
    timestamp: 20,
    properties: { speed: 0.5 },
    mapping: { main: 3 },
  })
  const update = buildVisualPresetDraftAction({
    operation: "update",
    id: "calm",
    name: "Calm update",
    timestamp: 21,
    properties: { speed: 0.75 },
    mapping: { main: 4 },
  })

  assert.deepEqual(save, {
    type: "save-visual-preset",
    preset: {
      id: "calm",
      name: "Calm",
      timestamp: 20,
      properties: { speed: 0.5 },
      mapping: { main: 3 },
    },
  })
  assert.deepEqual(update, {
    type: "update-visual-preset",
    preset: {
      id: "calm",
      name: "Calm update",
      timestamp: 21,
      properties: { speed: 0.75 },
      mapping: { main: 4 },
    },
  })
  assert.deepEqual(buildPresetApplyDraftAction("visual", "calm"), {
    type: "apply-visual-preset",
    id: "calm",
  })
  assert.deepEqual(buildPresetRenameDraftAction("visual", "calm", "Renamed"), {
    type: "rename-visual-preset",
    id: "calm",
    name: "Renamed",
  })
  assert.deepEqual(buildPresetDeleteDraftAction("visual", "calm"), {
    type: "delete-visual-preset",
    id: "calm",
  })
  assert.deepEqual(buildVisualPresetDefaultDraftAction("calm"), {
    type: "set-default-visual-preset",
    id: "calm",
  })
  assert.equal(getBackgroundPresetLimit("visual"), 3)
})

test("palette editor view models and changes are pure, indexed, and mapping-aware", () => {
  const adapter = {
    status: "supported",
    roles: [
      { id: "main", label: "Main", sourceColor: "#010203", defaultSwatch: 0 },
      { id: "accent", label: "Accent", sourceColor: "#040506", defaultSwatch: 0 },
    ],
  }
  const palette = {
    mode: "custom",
    primaryColor: "#111111",
    harmony: "triad",
    swatches: ["#111111", "#222222", "#333333", "#444444", "#555555", "#666666", "#777777"],
  }
  const mapping = { main: 2, accent: 2 }
  const before = structuredClone({ palette, mapping })
  const custom = buildBackgroundPaletteEditorViewModel({
    palette,
    adapter,
    mapping,
    canCustomize: true,
  })

  assert.equal(custom.effectiveMode, "custom")
  assert.equal(custom.swatches.length, 7)
  assert.equal(custom.swatches[0].primaryLabel, "Primary")
  assert.equal(custom.swatches[2].usageLabel, "Main + Accent")
  assert.equal(custom.swatches[6].usageLabel, "Not used by this background")
  assert.equal(custom.swatches.every((swatch) => swatch.readOnly === false), true)
  assert.deepEqual(custom.activeMapping, mapping)

  const source = buildBackgroundPaletteEditorViewModel({
    palette: { ...palette, mode: "source" },
    adapter,
    mapping,
    canCustomize: true,
  })
  assert.equal(source.swatches[0].color, "#010203")
  assert.equal(source.swatches.every((swatch) => swatch.readOnly), true)
  assert.deepEqual(source.activeMapping, { main: 0, accent: 0 })

  const denied = buildBackgroundPaletteEditorViewModel({
    palette,
    adapter,
    mapping,
    canCustomize: false,
  })
  assert.equal(denied.effectiveMode, "source")
  assert.equal(denied.modeOptions.find((option) => option.value === "source").disabled, false)
  assert.equal(denied.modeOptions.find((option) => option.value === "custom").disabled, true)

  assert.deepEqual(buildBackgroundPaletteModeChange({
    palette,
    adapter,
    canCustomize: true,
    disabled: false,
  }, "harmony"), { ...palette, mode: "harmony" })
  const harmonyPalette = { ...palette, mode: "harmony" }
  assert.deepEqual(buildBackgroundPaletteHarmonyChange({
    palette: harmonyPalette,
    adapter,
    canCustomize: true,
    disabled: false,
  }, "complementary"), { ...harmonyPalette, harmony: "complementary" })
  assert.equal(buildBackgroundPaletteHarmonyChange({
    palette: harmonyPalette,
    adapter,
    canCustomize: true,
    disabled: false,
  }, "arbitrary-harmony"), null)
  assert.equal(buildBackgroundPaletteHarmonyChange({
    palette: harmonyPalette,
    adapter,
    canCustomize: false,
  }, "complementary"), null)
  assert.equal(buildBackgroundPaletteHarmonyChange({
    palette: harmonyPalette,
    adapter: { status: "unsupported", unsupportedReason: "Static source" },
    canCustomize: true,
  }, "complementary"), null)
  assert.equal(buildBackgroundPaletteHarmonyChange({
    palette: harmonyPalette,
    adapter,
    canCustomize: true,
    disabled: true,
  }, "complementary"), null)
  assert.deepEqual(buildBackgroundPaletteSwatchChange({
    palette,
    adapter,
    canCustomize: true,
    disabled: false,
  }, 1, "#abcdef"), {
    ...palette,
    swatches: ["#111111", "#abcdef", "#333333", "#444444", "#555555", "#666666", "#777777"],
  })
  assert.deepEqual(buildBackgroundPaletteMappingChange(mapping, "main", 5), {
    main: 5,
    accent: 2,
  })
  assert.deepEqual({ palette, mapping }, before)
})
