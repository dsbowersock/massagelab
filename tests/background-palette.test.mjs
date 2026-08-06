import assert from "node:assert/strict"
import test from "node:test"

import {
  BACKGROUND_COLOR_PRESET_LIMIT,
  BACKGROUND_PALETTE_SWATCH_COUNT,
  BACKGROUND_VISUAL_PRESET_LIMIT,
  DEFAULT_BACKGROUND_PALETTE_STATE,
  applyBackgroundColorPreset,
  applyBackgroundVisualPreset,
  canCustomizeBackgroundColors,
  deleteBackgroundColorPreset,
  deleteBackgroundVisualPreset,
  generateBackgroundHarmonySwatches,
  migrateLegacyChimerGlobalColors,
  normalizeBackgroundColorMapping,
  normalizeBackgroundPaletteState,
  normalizeSharedBackgroundVisualPreferences,
  resolveBackgroundRoleColors,
  resolveDefaultBackgroundVisualPreset,
  resolveEffectiveBackgroundPaletteMode,
  renameBackgroundColorPreset,
  renameBackgroundVisualPreset,
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
  assert.deepEqual(normalizeBackgroundPaletteState(), {
    mode: "source",
    primaryColor: "#f97316",
    harmony: "analogous",
    swatches: ["#f97316", "#fb923c", "#fb7185", "#0f172a", "#f8fafc", "#db2777", "#ea580c"],
  })
  const palette = normalizeBackgroundPaletteState({ mode: "custom", primaryColor: "#ABC", swatches: ["#123", "nope"] })
  assert.equal(DEFAULT_BACKGROUND_PALETTE_STATE.mode, "source")
  assert.equal(BACKGROUND_PALETTE_SWATCH_COUNT, 7)
  assert.equal(palette.primaryColor, "#aabbcc")
  assert.equal(palette.swatches.length, 7)
  assert.equal(palette.swatches[0], "#aabbcc")
  assert.match(palette.swatches[6], /^#[0-9a-f]{6}$/)
})

test("every harmony creates seven valid colors and role resolution retains unused swatches", () => {
  for (const harmony of ["analogous", "complementary", "split-complementary", "triad", "square", "compound", "shades", "monochromatic", "triadic", "tetradic"]) {
    assert.equal(generateBackgroundHarmonySwatches("#f97316", harmony).length, 7)
    assert.ok(generateBackgroundHarmonySwatches("#f97316", harmony).every((color) => /^#[0-9a-f]{6}$/.test(color)))
  }
  const palette = normalizeBackgroundPaletteState({ mode: "custom", swatches: ["#111111", "#222222", "#333333", "#444444", "#555555", "#666666", "#777777"] })
  assert.deepEqual(resolveBackgroundRoleColors({ palette, adapter, mapping: { main: 2, accent: 2 }, canCustomize: true }), { main: "#333333", accent: "#333333" })
  const harmonyPalette = normalizeBackgroundPaletteState({ mode: "harmony", primaryColor: "#123456", harmony: "triadic" })
  const harmonySwatches = generateBackgroundHarmonySwatches("#123456", "triadic")
  assert.deepEqual(resolveBackgroundRoleColors({ palette: harmonyPalette, adapter, mapping: { main: 0, accent: 2 }, canCustomize: true }), { main: harmonySwatches[0], accent: harmonySwatches[2] })
  assert.deepEqual(resolveBackgroundRoleColors({ palette, adapter, mapping: {}, canCustomize: false }), { main: "#112233", accent: "#445566" })
})

test("Harmony can preserve a role's saved swatch while generating the other roles", () => {
  const harmonyAdapter = {
    roles: [
      { id: "band", sourceColor: "#112233", defaultSwatch: 0 },
      {
        id: "background",
        sourceColor: "#445566",
        defaultSwatch: 6,
        harmonyColorSource: "saved-swatch",
      },
    ],
  }
  const palette = normalizeBackgroundPaletteState({
    mode: "harmony",
    primaryColor: "#123456",
    harmony: "triadic",
    swatches: ["#111111", "#222222", "#333333", "#444444", "#555555", "#666666", "#abcdef"],
  })
  const harmonySwatches = generateBackgroundHarmonySwatches("#123456", "triadic")

  assert.deepEqual(resolveBackgroundRoleColors({
    palette,
    adapter: harmonyAdapter,
    mapping: {},
    canCustomize: true,
  }), {
    band: harmonySwatches[0],
    background: "#abcdef",
  })
})

test("mapping invalid values fall back to curated adapter defaults and Source does not mutate dormant state", () => {
  assert.deepEqual(normalizeBackgroundColorMapping({ main: 99, accent: "no" }, adapter), { main: 0, accent: 1 })
  assert.deepEqual(normalizeBackgroundColorMapping({}, { roles: [{ id: "main", defaultSwatch: 99 }] }), { main: 0 })
  const palette = normalizeBackgroundPaletteState({ mode: "source", primaryColor: "#123456" })
  const before = structuredClone(palette)
  assert.deepEqual(resolveBackgroundRoleColors({ palette, adapter, mapping: { main: 6 }, canCustomize: true }), { main: "#112233", accent: "#445566" })
  assert.deepEqual(palette, before)
})

test("preferences bound color and visual presets through injected registry callbacks", () => {
  const options = {
    isKnownBackgroundId: (id) => id === "waves",
    getVisualPropertyKeys: () => ["speed", "density"],
    getColorRoleIds: () => ["main", "accent"],
  }
  let preferences = normalizeSharedBackgroundVisualPreferences({
    colorPresets: [
      { id: "source", name: "Source", palette: { mode: "source" } },
      {
        id: "palette-only",
        name: "Palette only",
        palette: { mode: "custom" },
        mappingsByBackground: { waves: { main: 6 } },
      },
    ],
    mappingsByBackground: { waves: { main: 4, accent: 2 } },
    visualPresetsByBackground: {
      missing: [{ id: "old" }],
      waves: [{
        id: "v1",
        name: "Old",
        properties: { speed: 1, bad: true },
        mapping: { main: 5, accent: 1, stale: 3 },
      }],
    },
    defaultVisualPresetByBackground: { waves: "stale", missing: "old" },
  }, options)
  assert.equal(preferences.colorPresets.length, 1)
  assert.equal(Object.hasOwn(preferences.colorPresets[0], "mappingsByBackground"), false)
  assert.deepEqual(preferences.mappingsByBackground, { waves: { main: 4, accent: 2 } })
  assert.deepEqual(preferences.visualPresetsByBackground.waves[0].properties, { speed: 1 })
  assert.deepEqual(preferences.visualPresetsByBackground.waves[0].mapping, { main: 5, accent: 1 })
  assert.deepEqual(preferences.defaultVisualPresetByBackground, {})
  assert.deepEqual(normalizeSharedBackgroundVisualPreferences({
    visualPresetsByBackground: { waves: [{ id: "v1", properties: { speed: 1 } }] },
  }, { isKnownBackgroundId: (id) => id === "waves" }).visualPresetsByBackground, {})
  assert.deepEqual(normalizeSharedBackgroundVisualPreferences({
    visualPresetsByBackground: { waves: [{ id: "v1", properties: { speed: 1 } }] },
  }, { getVisualPropertyKeys: () => ["speed"] }).visualPresetsByBackground, {})
  assert.deepEqual(normalizeSharedBackgroundVisualPreferences({
    visualPresetsByBackground: { waves: [{ id: "v1", properties: { speed: 1 } }] },
  }).visualPresetsByBackground, {})
  for (let index = 0; index < BACKGROUND_COLOR_PRESET_LIMIT + 2; index += 1) preferences = saveBackgroundColorPreset(preferences, { id: `c${index}`, name: "  A very long palette name that must be bounded  ", timestamp: index, palette: { mode: "custom" } }, options)
  assert.equal(preferences.colorPresets.length, BACKGROUND_COLOR_PRESET_LIMIT)
  preferences = saveBackgroundColorPreset(preferences, { id: "x".repeat(200), name: "Bounded", timestamp: 9000000000000000, palette: { mode: "custom" } }, options)
  assert.equal(preferences.colorPresets[0].id.length, 128)
  assert.equal(preferences.colorPresets[0].timestamp, 8640000000000000)
  for (let index = 0; index < BACKGROUND_VISUAL_PRESET_LIMIT + 1; index += 1) preferences = saveBackgroundVisualPreset(preferences, "waves", { id: `v${index}`, name: "Preset", timestamp: index, properties: { speed: index, bad: true }, mapping: { main: index % 7, stale: 2 } }, options)
  assert.equal(preferences.visualPresetsByBackground.waves.length, BACKGROUND_VISUAL_PRESET_LIMIT)
  assert.deepEqual(preferences.visualPresetsByBackground.waves[0].mapping, { main: 3 })
  const immutablePreferences = normalizeSharedBackgroundVisualPreferences({
    palette: { mode: "custom" },
    colorPresets: [{
      id: "color",
      name: "Color",
      timestamp: 1,
      palette: { mode: "custom", primaryColor: "#123456" },
      mappingsByBackground: { waves: { main: 6 } },
    }],
    mappingsByBackground: { waves: { main: 2, accent: 1 } },
    visualPresetsByBackground: { waves: [{ id: "visual", name: "Visual", timestamp: 1, properties: { speed: 2 }, mapping: { main: 5 } }] },
    defaultVisualPresetByBackground: { waves: "visual" },
  }, options)
  assert.equal(Object.hasOwn(immutablePreferences.colorPresets[0], "mappingsByBackground"), false)
  const before = structuredClone(immutablePreferences)
  const properties = { speed: 1, density: 3 }
  const helpers = [
    () => saveBackgroundColorPreset(immutablePreferences, { id: "new-color", name: "New", timestamp: 2, palette: { mode: "custom" } }, options),
    () => renameBackgroundColorPreset(immutablePreferences, "color", "Renamed", options),
    () => deleteBackgroundColorPreset(immutablePreferences, "color", options),
    () => applyBackgroundColorPreset(immutablePreferences, "color", options),
    () => saveBackgroundVisualPreset(immutablePreferences, "waves", { id: "new-visual", name: "New", timestamp: 2, properties: { speed: 1 }, mapping: { main: 4 } }, options),
    () => renameBackgroundVisualPreset(immutablePreferences, "waves", "visual", "Renamed", options),
    () => deleteBackgroundVisualPreset(immutablePreferences, "waves", "visual", options),
    () => applyBackgroundVisualPreset(immutablePreferences, "waves", "visual", properties, options),
    () => resolveDefaultBackgroundVisualPreset(immutablePreferences, "waves", options),
  ]
  for (const helper of helpers) {
    helper()
    assert.deepEqual(immutablePreferences, before)
  }
  assert.deepEqual(properties, { speed: 1, density: 3 })

  const colorApplied = applyBackgroundColorPreset(immutablePreferences, "color", options)
  assert.equal(colorApplied.palette.primaryColor, "#123456")
  assert.deepEqual(colorApplied.mappingsByBackground, { waves: { main: 2, accent: 1 } })
  assert.equal(Object.hasOwn(colorApplied.colorPresets[0], "mappingsByBackground"), false)

  const visualApplied = applyBackgroundVisualPreset(
    immutablePreferences,
    "waves",
    "visual",
    properties,
    options,
  )
  assert.deepEqual(visualApplied.properties, { speed: 2, density: 3 })
  assert.deepEqual(visualApplied.mapping, { main: 5 })

  const missingPreferences = normalizeSharedBackgroundVisualPreferences({
    ...immutablePreferences,
    mappingsByBackground: { waves: { main: 4 } },
  }, options)
  const missingBefore = structuredClone(missingPreferences)
  const missingProperties = { speed: 1, density: 3 }
  const missingApplied = applyBackgroundVisualPreset(
    missingPreferences,
    "waves",
    "deleted-visual",
    missingProperties,
    options,
  )
  assert.deepEqual(missingApplied.properties, missingProperties)
  assert.deepEqual(missingApplied.mapping, { main: 4 })
  assert.deepEqual(missingPreferences, missingBefore)
  assert.deepEqual(missingProperties, { speed: 1, density: 3 })
})

test("legacy migration preserves non-color settings and access falls back without deleting saved state", () => {
  const migrated = migrateLegacyChimerGlobalColors({ timerDuration: 30 }, JSON.stringify({ primary: "#111111", secondary: "#222222", accent: "#333333", background: "#444444", foreground: "#555555", ctaStart: "#666666", ctaEnd: "#777777", harmony: "custom" }))
  assert.equal(migrated.timerDuration, 30)
  assert.equal(migrated.backgroundVisualPreferences.palette.mode, "custom")
  assert.deepEqual(migrated.backgroundVisualPreferences.palette.swatches, ["#111111", "#222222", "#333333", "#444444", "#555555", "#666666", "#777777"])
  assert.equal(migrateLegacyChimerGlobalColors({}, "invalid").backgroundVisualPreferences.palette.mode, "harmony")
  for (const harmony of ["analogous", "complementary", "split-complementary", "triad", "square", "compound", "shades", "monochromatic", "triadic", "tetradic"]) {
    const legacy = migrateLegacyChimerGlobalColors({}, JSON.stringify({ harmony }))
    assert.equal(legacy.backgroundVisualPreferences.palette.mode, "harmony")
    assert.equal(legacy.backgroundVisualPreferences.palette.harmony, harmony)
  }
  assert.equal(canCustomizeBackgroundColors({ hasBackgroundAccess: true }), true)
  assert.equal(canCustomizeBackgroundColors({ hasBackgroundAccess: false }), false)
  assert.equal(resolveEffectiveBackgroundPaletteMode({ savedMode: "custom", canCustomize: false }), "source")
})
