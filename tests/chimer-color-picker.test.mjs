import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"
import {
  LEGACY_BACKGROUND_COLOR_SETTING_KEYS,
} from "../lib/background-palette.js"
import {
  normalizeLiveColorPickerHex,
} from "../components/chimer-controls/color-picker-value.ts"

const pickerSource = await readFile(
  new URL("../components/chimer-controls/GlobalColorPicker.tsx", import.meta.url),
  "utf8",
)
const runningTimerSource = await readFile(
  new URL("../app/chimer/running-timer.tsx", import.meta.url),
  "utf8",
)
const immersiveShellSource = await readFile(
  new URL("../app/chimer/immersive-panel-shell.tsx", import.meta.url),
  "utf8",
).catch(() => "")
const backgroundHostSource = await readFile(
  new URL("../components/backgrounds/BackgroundHost.tsx", import.meta.url),
  "utf8",
)
const harmonySource = await readFile(
  new URL("../components/chimer-controls/HarmonyToggleGroup.tsx", import.meta.url),
  "utf8",
)
const paletteEditorSource = await readFile(
  new URL("../components/chimer-controls/BackgroundPaletteEditor.tsx", import.meta.url),
  "utf8",
)
const setTimerSource = await readFile(
  new URL("../app/chimer/set-timer.tsx", import.meta.url),
  "utf8",
)
const formPickerSource = await readFile(
  new URL("../components/chimer-controls/ColorPickerFormInput.tsx", import.meta.url),
  "utf8",
)
const serviceFormSource = await readFile(
  new URL("../app/calendar/services/service-form.tsx", import.meta.url),
  "utf8",
)
const chimerPageSource = await readFile(
  new URL("../app/chimer/page.tsx", import.meta.url),
  "utf8",
)
const SET_TIMER_VALUE_CALLBACK_PATTERN = /onValueChange: \(nextColor: string\) => void/
const SET_TIMER_PICKER_WIRING_PATTERN =
  /<ColorPickerInput value=\{value\} onValueChange=\{onValueChange\} label=\{pickerLabel\} \/>/

test("the reusable picker stays value-driven without semantic palette state", () => {
  assert.match(pickerSource, /export function ColorPickerInput/)
  assert.match(pickerSource, /onChange=\{onValueChange\}/)
  assert.doesNotMatch(pickerSource, /GlobalColorValues|draftColors|editableFields/)
})

test("immersive panels keep the portaled color picker inside their interaction boundary", () => {
  assert.match(pickerSource, /data-chimer-control-portal="true"/)
  assert.match(
    immersiveShellSource,
    /target instanceof Element && target\.closest\(CHIMER_CONTROL_PORTAL_SELECTOR\)/,
  )
})

test("shared color fields use explicit string values instead of synthetic native events", () => {
  assert.match(pickerSource, /onValueChange: \(value: string\) => void/)
  assert.doesNotMatch(pickerSource, /ReactChangeEvent|ChangeEventHandler|target: input/)
  assert.doesNotMatch(setTimerSource, SET_TIMER_VALUE_CALLBACK_PATTERN)
  assert.doesNotMatch(setTimerSource, SET_TIMER_PICKER_WIRING_PATTERN)
  assert.equal((setTimerSource.match(/<ColorField/g) ?? []).length, 0)
  assert.equal((setTimerSource.match(/<ColorPickerInput/g) ?? []).length, 0)
  assert.doesNotMatch(runningTimerSource, /type="color"/)
  assert.doesNotMatch(setTimerSource, /type="color"/)
})

test("complete HEX edits immediately drive the controlled picker value", () => {
  assert.equal(normalizeLiveColorPickerHex("#12AbEF"), "#12abef")
  assert.equal(normalizeLiveColorPickerHex("  #123456  "), "#123456")
  assert.equal(normalizeLiveColorPickerHex("#123"), null)
  assert.equal(normalizeLiveColorPickerHex("#12345"), null)
  assert.equal(normalizeLiveColorPickerHex("#12345g"), null)
  assert.match(
    pickerSource,
    /const nextColor = normalizeLiveColorPickerHex\(nextDraft\)[\s\S]*onChange\(nextColor\)/,
  )
})

test("calendar forms submit the shared picker value without restoring a native color control", () => {
  assert.match(formPickerSource, /type="hidden"/)
  assert.match(formPickerSource, /name=\{name\}/)
  assert.match(formPickerSource, /onValueChange=\{setValue\}/)
  assert.match(serviceFormSource, /<ColorPickerFormInput/)
  assert.doesNotMatch(serviceFormSource, /type="color"/)
})

test("Visual and every immersive renderer use the staged shared palette contract", () => {
  assert.match(runningTimerSource, /<BackgroundPaletteEditor/)
  assert.match(runningTimerSource, /palette=\{currentVisualEditorSnapshot\.palette\}/)
  assert.match(runningTimerSource, /canCustomize=\{canCustomizeSelectedBackground\}/)
  assert.match(runningTimerSource, /backgroundPalette=\{effectiveBackgroundPalette\}/)
  assert.match(backgroundHostSource, /resolveBackgroundEffectProps/)
  assert.doesNotMatch(backgroundHostSource, /function applyPaletteToBackgroundEffects/)
  assert.doesNotMatch(backgroundHostSource, /COLOR_OPTION_PATTERN|NON_COLOR_OPTION_PATTERN/)
  assert.match(backgroundHostSource, /<BackgroundComponent[\s\S]*\{\.\.\.effectProps\}/)
  assert.doesNotMatch(pickerSource, /GlobalColorPicker|GlobalColorValues/)
  assert.match(harmonySource, /--ml-harmony-preview/)
})

test("the shared palette editor reuses the approved picker instead of duplicating HSV or eyedropper behavior", () => {
  assert.match(paletteEditorSource, /import \{ ColorPickerSwatch \} from/)
  assert.match(paletteEditorSource, /<ColorPickerSwatch/)
  assert.doesNotMatch(paletteEditorSource, /EyeDropper|rgbToHsv|hsvToRgb|colorPickerArea/)
  assert.match(pickerSource, /readOnly\?: boolean/)
  assert.match(pickerSource, /\{readOnly \? \(/)
  assert.match(pickerSource, /readOnly \? \(\s*<span/)
  assert.doesNotMatch(pickerSource, /readOnly \? \(\s*<output/)
})

test("legacy renderer colors no longer form part of Chimer runtime props or settings", () => {
  for (const key of LEGACY_BACKGROUND_COLOR_SETTING_KEYS) {
    assert.doesNotMatch(setTimerSource, new RegExp(`^\\s*${key}(?:\\?|):`, "m"), key)
    assert.doesNotMatch(runningTimerSource, new RegExp(`^\\s*${key}(?:\\?|):`, "m"), key)
    assert.doesNotMatch(chimerPageSource, new RegExp(`${key}=\\{settings\\.${key}\\}`), key)
  }
})
