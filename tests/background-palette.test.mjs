import assert from "node:assert/strict"
import test from "node:test"

import {
  BACKGROUND_COLOR_PRESET_LIMIT,
  BACKGROUND_PALETTE_SWATCH_COUNT,
  BACKGROUND_VISUAL_PRESET_LIMIT,
  DEFAULT_BACKGROUND_PALETTE_STATE,
  canCustomizeBackgroundColors,
  generateBackgroundHarmonySwatches,
  migrateLegacyChimerGlobalColors,
  normalizeBackgroundColorMapping,
  normalizeBackgroundPaletteState,
  normalizeSharedBackgroundVisualPreferences,
  resolveBackgroundRoleColors,
  resolveEffectiveBackgroundPaletteMode,
  saveBackgroundColorPreset,
  saveBackgroundVisualPreset,
} from "../lib/background-palette.js"

const adapter = {
  roles: [
    { id: "main", sourceColor: "#112233", defaultSwatch: 0 },
    { id: "accent", sourceColor: "#445566", defaultSwatch: 1 },
  ],
}

test("palette state starts in Source and always has seven sanitized swatches", () => {
  const palette = normalizeBackgroundPaletteState({ mode: "custom", primaryColor: "#ABC", swatches: ["#123", "nope"] })
  assert.equal(DEFAULT_BACKGROUND_PALETTE_STATE.mode, "source")
  assert.equal(BACKGROUND_PALETTE_SWATCH_COUNT, 7)
  assert.equal(palette.primaryColor, "#aabbcc")
  assert.equal(palette.swatches.length, 7)
  assert.equal(palette.swatches[0], "#aabbcc")
  assert.match(palette.swatches[6], /^#[0-9a-f]{6}$/)
})

test("every harmony creates seven valid colors and role resolution retains unused swatches", () => {
  for (const harmony of ["analogous", "complementary", "split-complementary", "triad", "square", "compound", "shades", "monochromatic"]) {
    assert.equal(generateBackgroundHarmonySwatches("#f97316", harmony).length, 7)
    assert.ok(generateBackgroundHarmonySwatches("#f97316", harmony).every((color) => /^#[0-9a-f]{6}$/.test(color)))
  }
  const palette = normalizeBackgroundPaletteState({ mode: "custom", swatches: ["#111111", "#222222", "#333333", "#444444", "#555555", "#666666", "#777777"] })
  assert.deepEqual(resolveBackgroundRoleColors({ palette, adapter, mapping: { main: 2, accent: 2 }, canCustomize: true }), { main: "#333333", accent: "#333333" })
  assert.deepEqual(resolveBackgroundRoleColors({ palette, adapter, mapping: {}, canCustomize: false }), { main: "#112233", accent: "#445566" })
})

test("mapping invalid values fall back to curated adapter defaults and Source does not mutate dormant state", () => {
  assert.deepEqual(normalizeBackgroundColorMapping({ main: 99, accent: "no" }, adapter), { main: 0, accent: 1 })
  const palette = normalizeBackgroundPaletteState({ mode: "source", primaryColor: "#123456" })
  const before = structuredClone(palette)
  assert.deepEqual(resolveBackgroundRoleColors({ palette, adapter, mapping: { main: 6 }, canCustomize: true }), { main: "#112233", accent: "#445566" })
  assert.deepEqual(palette, before)
})

test("preferences bound color and visual presets through injected registry callbacks", () => {
  const options = { isKnownBackgroundId: (id) => id === "waves", getVisualPropertyKeys: () => ["speed", "density"] }
  let preferences = normalizeSharedBackgroundVisualPreferences({
    colorPresets: [{ id: "source", name: "Source", palette: { mode: "source" } }],
    visualPresetsByBackground: { missing: [{ id: "old" }], waves: [{ id: "v1", name: "Old", properties: { speed: 1, bad: true } }] },
    defaultVisualPresetByBackground: { waves: "stale", missing: "old" },
  }, options)
  assert.deepEqual(preferences.colorPresets, [])
  assert.deepEqual(preferences.visualPresetsByBackground.waves[0].properties, { speed: 1 })
  assert.deepEqual(preferences.defaultVisualPresetByBackground, {})
  for (let index = 0; index < BACKGROUND_COLOR_PRESET_LIMIT + 2; index += 1) preferences = saveBackgroundColorPreset(preferences, { id: `c${index}`, name: "  A very long palette name that must be bounded  ", timestamp: index, palette: { mode: "custom" } }, options)
  assert.equal(preferences.colorPresets.length, BACKGROUND_COLOR_PRESET_LIMIT)
  for (let index = 0; index < BACKGROUND_VISUAL_PRESET_LIMIT + 1; index += 1) preferences = saveBackgroundVisualPreset(preferences, "waves", { id: `v${index}`, name: "Preset", timestamp: index, properties: { speed: index, bad: true } }, options)
  assert.equal(preferences.visualPresetsByBackground.waves.length, BACKGROUND_VISUAL_PRESET_LIMIT)
})

test("legacy migration preserves non-color settings and access falls back without deleting saved state", () => {
  const migrated = migrateLegacyChimerGlobalColors({ timerDuration: 30 }, JSON.stringify({ primary: "#111111", secondary: "#222222", accent: "#333333", background: "#444444", foreground: "#555555", ctaStart: "#666666", ctaEnd: "#777777", harmony: "custom" }))
  assert.equal(migrated.timerDuration, 30)
  assert.equal(migrated.backgroundVisualPreferences.palette.mode, "custom")
  assert.deepEqual(migrated.backgroundVisualPreferences.palette.swatches, ["#111111", "#222222", "#333333", "#444444", "#555555", "#666666", "#777777"])
  assert.equal(migrateLegacyChimerGlobalColors({}, "invalid").backgroundVisualPreferences.palette.mode, "harmony")
  assert.equal(migrateLegacyChimerGlobalColors({}, JSON.stringify({ harmony: "square" })).backgroundVisualPreferences.palette.harmony, "square")
  assert.equal(canCustomizeBackgroundColors({ hasCustomColorFeature: true, selectedBackgroundId: "x", permanentlyOwnedBackgroundIds: [] }), true)
  assert.equal(canCustomizeBackgroundColors({ hasCustomColorFeature: false, selectedBackgroundId: "x", permanentlyOwnedBackgroundIds: ["x"] }), true)
  assert.equal(resolveEffectiveBackgroundPaletteMode({ savedMode: "custom", canCustomize: false }), "source")
})
