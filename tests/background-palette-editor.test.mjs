import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import test from "node:test"

const editorSource = await readFile(
  new URL("../components/chimer-controls/BackgroundPaletteEditor.tsx", import.meta.url),
  "utf8",
)
const presetSource = await readFile(
  new URL("../components/chimer-controls/BackgroundPresetManager.tsx", import.meta.url),
  "utf8",
)

test("shared palette editor presents one accessible mode choice and seven indexed swatches", () => {
  assert.match(editorSource, /SegmentedToggleGroup/)
  assert.match(editorSource, /label="Color source"/)
  assert.match(editorSource, /\{ value: "source", label: "Source" \}/)
  assert.match(editorSource, /\{ value: "custom", label: "Custom"/)
  assert.match(editorSource, /\{ value: "harmony", label: "Harmony"/)
  assert.match(editorSource, /BACKGROUND_PALETTE_SWATCH_COUNT/)
  assert.match(editorSource, /Swatch \$\{index \+ 1\}/)
  assert.match(editorSource, /index === 0 \? "Primary"/)
  assert.match(editorSource, /Not used by this background/)
  assert.match(editorSource, /roles\.map\(\(role\) => role\.label\)\.join\(" \+ "\)/)
})

test("Source and Harmony are contextual views that preserve dormant saved swatches", () => {
  assert.match(editorSource, /effectiveMode === "source"/)
  assert.match(editorSource, /readOnly=\{isSource \|\| \(isHarmony && index > 0\)\}/)
  assert.match(editorSource, /generateBackgroundHarmonySwatches/)
  assert.match(editorSource, /HarmonyToggleGroup/)
  assert.match(editorSource, /Source colors remain available/)
  assert.doesNotMatch(editorSource, /localStorage|sessionStorage|fetch\(/)
})

test("role mapping names every selectable swatch by number and current color", () => {
  assert.match(editorSource, /Color mapping/)
  assert.match(editorSource, /aria-label=\{`\$\{role\.label\} color mapping`\}/)
  assert.match(editorSource, /Swatch \{index \+ 1\} — \{color\}/)
  assert.match(editorSource, /disabled=\{disabled \|\| isSource \|\| !canCustomize\}/)
})

test("Color and Visual preset managers expose only their approved draft actions and limits", () => {
  assert.match(presetSource, /BACKGROUND_COLOR_PRESET_LIMIT/)
  assert.match(presetSource, /BACKGROUND_VISUAL_PRESET_LIMIT/)
  for (const action of [
    "Save as new",
    "Apply",
    "Update",
    "Rename",
    "Delete",
    "Set as default",
  ]) {
    assert.match(presetSource, new RegExp(action))
  }
  assert.match(presetSource, /kind === "visual"/)
  assert.match(presetSource, /defaultMarker/)
  assert.match(presetSource, /maxLength=\{PRESET_NAME_LIMIT\}/)
  assert.match(presetSource, /DropdownMenu/)
  assert.match(presetSource, /AlertDialog/)
  assert.match(presetSource, /aria-live="polite"/)
  assert.doesNotMatch(presetSource, /localStorage|sessionStorage|fetch\(/)
})

test("Visual summaries exclude shared colors and retain the active role mapping", () => {
  assert.match(presetSource, /SHARED_COLOR_PROPERTY_KEYS/)
  assert.match(presetSource, /Shared colors are not included/)
  assert.match(presetSource, /Active color mapping/)
  assert.match(presetSource, /preset\.mapping/)
})
