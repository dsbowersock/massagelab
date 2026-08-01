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
import {
  buildUserPreferencePayload,
  createChimerPreferenceSyncRequest,
  createChimerPreferenceSyncRetry,
  resolveChimerPreferenceSyncRequest,
} from "../lib/account-preferences.js"
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

  it("aligns customization with selected-background access and preserves reversible access loss", () => {
    assert.equal(canCustomizeBackgroundColors({
      hasBackgroundAccess: true,
    }), true)
    assert.equal(canCustomizeBackgroundColors({
      hasBackgroundAccess: true,
    }), true)
    assert.equal(canCustomizeBackgroundColors({
      hasBackgroundAccess: false,
    }), false)
    assert.equal(resolveEffectiveBackgroundPaletteMode({
      savedMode: "source",
      canCustomize: false,
    }), "source")
    for (const hasBackgroundAccess of [false, null]) {
      const canCustomize = canCustomizeBackgroundColors({
        hasBackgroundAccess,
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
    assert.match(source, /const immersiveMode: ImmersiveDisplayMode = immersiveContext === "musicVisualizer"[\s\S]*selectedBackgroundId: selectedMusicBackgroundId,[\s\S]*selectedBackgroundId: settings\.backgroundId/)
    assert.match(source, /const backgroundAccess = useMemo<BackgroundAccessSnapshot>[\s\S]*featureKeys,[\s\S]*resolveAuthoritativeBackgroundOwnership\([\s\S]*permanentlyOwnedBackgroundIds,[\s\S]*commerceOwnedBackgroundIds/)
    assert.match(source, /<RunningTimer[\s\S]*backgroundAccess=\{backgroundAccess\}/)
    assert.match(source, /applyBackgroundVisualPreferences/)
    assert.match(source, /retryBackgroundVisualPreferenceSync/)
    assert.match(source, /createChimerPreferenceSyncRetry\(\s*backgroundPreferenceSync,\s*requestId/)
    assert.match(source, /body:\s*request\.requestBody/)
    assert.match(source, /setBackgroundPreferenceSync\(\(currentRequest\)\s*=>/)
    assert.doesNotMatch(source, /canCustomizeBackgroundColors/)
  })
})

describe("DNA and Twisted Cubes non-color persistence", () => {
  const cases = [
    {
      backgroundId: "massage-lab-dna",
      presetId: "dna",
      properties: {
        massageLabDnaStrandCount: { invalid: 999, expected: 25 },
        massageLabDnaNodeMotionSpeed: { invalid: -999, expected: 0.25 },
        massageLabDnaStrandRotationSpeed: { invalid: 999, expected: 3 },
        massageLabDnaStrandAngle: { invalid: -999, expected: -180 },
        massageLabDnaScale: { invalid: 999, expected: 1.2 },
        massageLabDnaPositionX: { invalid: -999, expected: -35 },
        massageLabDnaPositionY: { invalid: 999, expected: 35 },
        massageLabDnaStrandSpacing: { invalid: -999, expected: 0 },
        massageLabDnaConnectorWidth: { invalid: 999, expected: 100 },
        massageLabDnaConnectorThickness: { invalid: -999, expected: 10 },
        massageLabDnaOutlineThickness: { invalid: 999, expected: 1.5 },
      },
    },
    {
      backgroundId: "massage-lab-twisted-cubes",
      presetId: "cubes",
      properties: {
        massageLabTwistedCubesLayerCount: { invalid: -999, expected: 6 },
        massageLabTwistedCubesRotationSpeed: { invalid: 999, expected: 3 },
        massageLabTwistedCubesLayerStagger: { invalid: -999, expected: 0 },
        massageLabTwistedCubesViewAngleX: { invalid: 999, expected: 80 },
        massageLabTwistedCubesViewAngleY: { invalid: -999, expected: -80 },
        massageLabTwistedCubesScale: { invalid: -999, expected: 0.4 },
        massageLabTwistedCubesPositionX: { invalid: 999, expected: 35 },
        massageLabTwistedCubesPositionY: { invalid: -999, expected: -35 },
        massageLabTwistedCubesLayerDepthSpacing: { invalid: 999, expected: 70 },
        massageLabTwistedCubesOpacityFalloff: { invalid: -999, expected: 0 },
        massageLabTwistedCubesOutlineThickness: { invalid: 999, expected: 0.02 },
      },
    },
  ]

  it("sanitizes every key through local, account Apply, preset/default, and exact retry payloads", () => {
    const invalidProperties = Object.fromEntries(cases.flatMap(({ properties }) => (
      Object.entries(properties).map(([key, value]) => [key, value.invalid])
    )))
    const expectedProperties = Object.fromEntries(cases.flatMap(({ properties }) => (
      Object.entries(properties).map(([key, value]) => [key, value.expected])
    )))
    const raw = {
      ...invalidProperties,
      backgroundVisualPreferences: {
        visualPresetsByBackground: {
          ...Object.fromEntries(cases.map(({ backgroundId, presetId, properties }) => [
            backgroundId,
            [{
              id: presetId,
              name: presetId,
              properties: Object.fromEntries(Object.entries(properties).map(([key, value]) => [key, value.invalid])),
              mapping: {},
            }],
          ])),
        },
        defaultVisualPresetByBackground: Object.fromEntries(
          cases.map(({ backgroundId, presetId }) => [backgroundId, presetId]),
        ),
      },
      nodeRoleAssignments: [0, 1],
      outlineAnchors: ["#ffffff"],
      derivedAlpha: 0.5,
    }
    const locallySanitized = sanitizeWithRegistry(raw)
    const applyRequest = createChimerPreferenceSyncRequest(raw, {
      backgroundPreferenceOptions: backgroundPreferenceNormalizationOptions,
      requestId: 41,
    })
    const accountSettings = JSON.parse(applyRequest.requestBody).chimerSettings
    const stale = resolveChimerPreferenceSyncRequest(applyRequest, applyRequest, false)
    const retry = createChimerPreferenceSyncRetry(stale, 42)
    const retrySettings = JSON.parse(retry.requestBody).chimerSettings
    const payload = buildUserPreferencePayload({ chimerSettings: locallySanitized }, {
      backgroundPreferenceOptions: backgroundPreferenceNormalizationOptions,
    })
    const serialized = JSON.stringify(payload)

    for (const [key, expected] of Object.entries(expectedProperties)) {
      assert.equal(locallySanitized[key], expected, `local ${key}`)
      assert.equal(accountSettings[key], expected, `account Apply ${key}`)
      assert.equal(retrySettings[key], expected, `account retry ${key}`)
    }
    for (const { backgroundId, presetId, properties } of cases) {
      const expectedPresetProperties = Object.fromEntries(
        Object.entries(properties).map(([key, value]) => [key, value.expected]),
      )
      for (const settings of [locallySanitized, accountSettings, retrySettings]) {
        assert.deepEqual(
          settings.backgroundVisualPreferences.visualPresetsByBackground[backgroundId][0].properties,
          expectedPresetProperties,
        )
        assert.equal(
          settings.backgroundVisualPreferences.defaultVisualPresetByBackground[backgroundId],
          presetId,
        )
      }
    }
    assert.equal(retry.status, "pending")
    assert.equal(retry.requestId, 42)
    assert.equal(retry.requestBody, applyRequest.requestBody)
    const transientRendererFields = /nodeRoleAssignments|outlineAnchors|derivedAlpha/
    assert.doesNotMatch(JSON.stringify(accountSettings), transientRendererFields)
    assert.doesNotMatch(JSON.stringify(retrySettings), transientRendererFields)
    assert.doesNotMatch(serialized, transientRendererFields)
  })
})
