import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

import {
  LEGACY_CHIMER_GLOBAL_COLOR_STORAGE_KEY,
  LEGACY_CHIMER_GLOBAL_PALETTE_STORAGE_KEY,
  canCustomizeBackgroundColors,
  prepareChimerBackgroundPreferenceMigration,
  resolveEffectiveBackgroundPaletteMode,
} from "../lib/background-palette.js"
import { sanitizeChimerSettings } from "../lib/chimer-timer.js"

const legacyColors = {
  colors: {
    primary: "#111111",
    secondary: "#222222",
    accent: "#333333",
    background: "#444444",
    foreground: "#555555",
    ctaStart: "#666666",
    ctaEnd: "#777777",
  },
  harmony: "custom",
}

describe("Shared background preference migration", () => {
  it("migrates raw legacy colors and saved palettes only when nested v1 is truly absent", () => {
    const prepared = prepareChimerBackgroundPreferenceMigration({
      rawChimerSettings: JSON.stringify({ minutes: 35, keepTimerScreenAwake: false }),
      rawLegacyGlobalColors: JSON.stringify(legacyColors),
      rawLegacySavedPalettes: JSON.stringify([{
        id: "legacy-preset",
        name: "Legacy preset",
        sourceColor: "#112233",
        harmony: "triad",
        colors: legacyColors.colors,
        generated: ["#111111"],
        createdAt: "2026-07-18T12:00:00.000Z",
      }]),
      sanitizeSettings: sanitizeChimerSettings,
    })

    assert.equal(prepared.settings.minutes, 35)
    assert.equal(prepared.settings.keepTimerScreenAwake, false)
    assert.equal(prepared.settings.backgroundVisualPreferences.palette.mode, "custom")
    assert.deepEqual(
      prepared.settings.backgroundVisualPreferences.palette.swatches,
      ["#111111", "#222222", "#333333", "#444444", "#555555", "#666666", "#777777"],
    )
    assert.equal(prepared.settings.backgroundVisualPreferences.colorPresets[0].id, "legacy-preset")
    assert.deepEqual(prepared.legacyKeysToRemove, [
      LEGACY_CHIMER_GLOBAL_COLOR_STORAGE_KEY,
      LEGACY_CHIMER_GLOBAL_PALETTE_STORAGE_KEY,
    ])

    const existing = prepareChimerBackgroundPreferenceMigration({
      rawChimerSettings: JSON.stringify({
        minutes: 20,
        backgroundVisualPreferences: {
          version: 1,
          palette: { mode: "harmony", primaryColor: "#abcdef" },
        },
      }),
      rawLegacyGlobalColors: JSON.stringify(legacyColors),
      rawLegacySavedPalettes: "invalid",
      sanitizeSettings: sanitizeChimerSettings,
    })
    assert.equal(existing.settings.backgroundVisualPreferences.palette.mode, "harmony")
    assert.equal(existing.settings.backgroundVisualPreferences.palette.primaryColor, "#abcdef")
  })

  it("cleans invalid legacy records and falls back to fresh Source preferences", () => {
    const prepared = prepareChimerBackgroundPreferenceMigration({
      rawChimerSettings: "{invalid",
      rawLegacyGlobalColors: "{invalid",
      rawLegacySavedPalettes: JSON.stringify({ not: "an array" }),
      sanitizeSettings: sanitizeChimerSettings,
    })

    assert.equal(prepared.settings.backgroundVisualPreferences.palette.mode, "source")
    assert.deepEqual(prepared.settings.backgroundVisualPreferences.colorPresets, [])
    assert.deepEqual(prepared.legacyKeysToRemove, [
      LEGACY_CHIMER_GLOBAL_COLOR_STORAGE_KEY,
      LEGACY_CHIMER_GLOBAL_PALETTE_STORAGE_KEY,
    ])
  })
})

describe("Shared background preference access and retry wiring", () => {
  it("covers feature, owned-only, unowned/free Source, and reversible access loss", () => {
    assert.equal(canCustomizeBackgroundColors({
      hasCustomColorFeature: true,
      selectedBackgroundId: "premium-a",
      permanentlyOwnedBackgroundIds: [],
    }), true)
    assert.equal(canCustomizeBackgroundColors({
      hasCustomColorFeature: false,
      selectedBackgroundId: "premium-a",
      permanentlyOwnedBackgroundIds: ["premium-a"],
    }), true)
    assert.equal(canCustomizeBackgroundColors({
      hasCustomColorFeature: false,
      selectedBackgroundId: "premium-b",
      permanentlyOwnedBackgroundIds: ["premium-a"],
    }), false)
    assert.equal(resolveEffectiveBackgroundPaletteMode({
      savedMode: "source",
      canCustomize: false,
    }), "source")
    for (const ownedAfterLoss of [[], ["refunded-background"]]) {
      const canCustomize = canCustomizeBackgroundColors({
        hasCustomColorFeature: false,
        selectedBackgroundId: "premium-a",
        permanentlyOwnedBackgroundIds: ownedAfterLoss,
      })
      assert.equal(resolveEffectiveBackgroundPaletteMode({
        savedMode: "custom",
        canCustomize,
      }), "source")
    }
  })

  it("keeps ChimerPage as local-first owner and retries the exact stale body", async () => {
    const source = await readFile(new URL("../app/chimer/page.tsx", import.meta.url), "utf8")

    assert.match(source, /prepareChimerBackgroundPreferenceMigration/)
    assert.match(source, /localStorage\.setItem\(CHIMER_STORAGE_KEY/)
    assert.match(source, /legacyKeysToRemove/)
    assert.match(source, /const selectedBackgroundId = immersiveContext === "musicVisualizer"[\s\S]*\? selectedMusicBackgroundId[\s\S]*: settings\.backgroundId/)
    assert.match(source, /canCustomizeBackgroundColors\(\{[\s\S]*hasCustomColorFeature:\s*featureKeys\.includes\(FEATURE_KEYS\.chimerCustomColors\)[\s\S]*selectedBackgroundId,[\s\S]*permanentlyOwnedBackgroundIds/)
    assert.match(source, /applyBackgroundVisualPreferences/)
    assert.match(source, /retryBackgroundVisualPreferenceSync/)
    assert.match(source, /requestBody:\s*backgroundPreferenceSync\.requestBody/)
    assert.match(source, /body:\s*request\.requestBody/)
    assert.doesNotMatch(
      source,
      /canCustomizeBackgroundColors\(\{[\s\S]{0,300}canUseAccountColorControls/,
    )
  })
})
