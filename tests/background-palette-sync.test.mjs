import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

import {
  LEGACY_CHIMER_GLOBAL_COLOR_STORAGE_KEY,
  LEGACY_CHIMER_GLOBAL_PALETTE_STORAGE_KEY,
  canCustomizeBackgroundColors,
  normalizeSharedBackgroundVisualPreferences,
  prepareChimerBackgroundPreferenceMigration,
  resolveEffectiveBackgroundPaletteMode,
} from "../lib/background-palette.js"
import {
  normalizeChimerBackgroundVisualPreferences,
  sanitizeChimerSettings,
} from "../lib/chimer-timer.js"
import { buildUserPreferencePayload } from "../lib/account-preferences.js"
import {
  backgroundPaletteRegistry,
  backgroundPreferenceNormalizationOptions,
} from "../components/backgrounds/backgroundPaletteRegistry.ts"

const sanitizeWithRegistry = (value) => sanitizeChimerSettings(value, {
  backgroundPreferenceOptions: backgroundPreferenceNormalizationOptions,
})

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
      sanitizeSettings: sanitizeWithRegistry,
    })

    assert.equal(prepared.settings.minutes, 35)
    assert.equal(prepared.settings.keepTimerScreenAwake, false)
    assert.equal(prepared.settings.backgroundVisualPreferences.palette.mode, "custom")
    assert.deepEqual(
      prepared.settings.backgroundVisualPreferences.palette.swatches,
      ["#111111", "#222222", "#333333", "#444444", "#555555", "#666666", "#777777"],
    )
    assert.equal(prepared.settings.backgroundVisualPreferences.colorPresets[0].id, "legacy-preset")
    assert.equal(
      Object.hasOwn(
        prepared.settings.backgroundVisualPreferences.colorPresets[0],
        "mappingsByBackground",
      ),
      false,
    )
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
          mappingsByBackground: {
            "massage-lab-novatrix": { field: 2, stale: 6 },
          },
            visualPresetsByBackground: {
              "massage-lab-novatrix": [{
                id: "migration-bounded",
                name: "Migration bounded",
                properties: { massageLabNovatrixSpeed: 999, hours: 12 },
                mapping: { field: 5, stale: 6 },
              }],
            },
        },
      }),
      rawLegacyGlobalColors: JSON.stringify(legacyColors),
      rawLegacySavedPalettes: "invalid",
      sanitizeSettings: sanitizeWithRegistry,
    })
    assert.equal(existing.settings.backgroundVisualPreferences.palette.mode, "harmony")
    assert.equal(existing.settings.backgroundVisualPreferences.palette.primaryColor, "#abcdef")
    assert.deepEqual(existing.settings.backgroundVisualPreferences.mappingsByBackground, {
      "massage-lab-novatrix": { field: 2 },
    })
    assert.deepEqual(
      existing.settings.backgroundVisualPreferences
        .visualPresetsByBackground["massage-lab-novatrix"][0].properties,
      { massageLabNovatrixSpeed: 3 },
    )
    assert.deepEqual(
      existing.settings.backgroundVisualPreferences
        .visualPresetsByBackground["massage-lab-novatrix"][0].mapping,
      { field: 5 },
    )
  })

  it("cleans invalid legacy records and falls back to fresh Source preferences", () => {
    const prepared = prepareChimerBackgroundPreferenceMigration({
      rawChimerSettings: "{invalid",
      rawLegacyGlobalColors: "{invalid",
      rawLegacySavedPalettes: JSON.stringify({ not: "an array" }),
      sanitizeSettings: sanitizeWithRegistry,
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
  it("uses authoritative Novatrix visual and role inventories and fails closed elsewhere", () => {
    const staleRoleEntries = Object.fromEntries(
      Array.from({ length: 20 }, (_, index) => [`stale-role-${index}`, index % 7]),
    )
    const raw = {
      version: 1,
      mappingsByBackground: {
        "massage-lab-novatrix": {
          ...staleRoleEntries,
          field: 4,
        },
        "massage-lab-prism": { spectral: 2 },
        "unknown-background": { unknown: 1 },
      },
      visualPresetsByBackground: {
        "massage-lab-novatrix": [{
          id: "novatrix-authoritative",
          name: "Novatrix authoritative",
          properties: {
            massageLabNovatrixSpeed: 999,
            hours: 12,
            backgroundId: "massage-lab-prism",
            alertType: "all",
            primaryFontColor: "#123456",
          },
          mapping: { field: 6, "stale-visual-role": 2 },
        }],
      },
    }
    const normalized = normalizeChimerBackgroundVisualPreferences(
      raw,
      backgroundPreferenceNormalizationOptions,
    )

    assert.ok(
      backgroundPaletteRegistry["massage-lab-novatrix"].visualPropertyKeys
        .includes("massageLabNovatrixSpeed"),
    )
    assert.deepEqual(
      normalized.visualPresetsByBackground["massage-lab-novatrix"][0].properties,
      { massageLabNovatrixSpeed: 3 },
    )
    assert.deepEqual(
      normalized.visualPresetsByBackground["massage-lab-novatrix"][0].mapping,
      { field: 6 },
    )
    assert.deepEqual(normalized.mappingsByBackground, {
      "massage-lab-novatrix": { field: 4 },
    })
    assert.ok(JSON.stringify(normalized).length < JSON.stringify(raw).length)
    const accountPayload = buildUserPreferencePayload({
      chimerSettings: { backgroundVisualPreferences: raw },
    }, { backgroundPreferenceOptions: backgroundPreferenceNormalizationOptions })
    assert.deepEqual(
      accountPayload.chimer_settings.backgroundVisualPreferences.mappingsByBackground,
      { "massage-lab-novatrix": { field: 4 } },
    )
    assert.deepEqual(
      accountPayload.chimer_settings.backgroundVisualPreferences
        .visualPresetsByBackground["massage-lab-novatrix"][0].mapping,
      { field: 6 },
    )
    assert.doesNotMatch(JSON.stringify(accountPayload), /stale-role|stale-visual-role|unknown-background|spectral/)
    assert.ok(JSON.stringify(accountPayload).length < 12_000)

    const withoutInventory = normalizeSharedBackgroundVisualPreferences(raw)
    assert.deepEqual(withoutInventory.mappingsByBackground, {})
    assert.deepEqual(withoutInventory.visualPresetsByBackground, {})
  })

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
    assert.match(source, /createChimerPreferenceSyncRetry\(\s*backgroundPreferenceSync,\s*requestId/)
    assert.match(source, /body:\s*request\.requestBody/)
    assert.match(source, /setBackgroundPreferenceSync\(\(currentRequest\)\s*=>/)
    assert.doesNotMatch(
      source,
      /canCustomizeBackgroundColors\(\{[\s\S]{0,300}canUseAccountColorControls/,
    )
  })
})
