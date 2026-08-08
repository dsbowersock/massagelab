import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { FEATURE_KEYS } from "../lib/membership.js"
import {
  DEFAULT_CHIMER_SETTINGS,
  sanitizeChimerSettingsForEntitlements,
} from "../lib/chimer-timer.js"
import {
  canCustomizeBackgroundColors,
  resolveEffectiveBackgroundPaletteMode,
} from "../lib/background-palette.js"
import { DEFAULT_GRID_MOTION_MANTRAS } from "../lib/grid-motion-mantras.js"

describe("Chimer entitlement-aware settings", () => {
  it("resets Grid Motion mantras to a defensive starter copy when access is absent", () => {
    const customMantras = ["Move with ease", "I can recover"]
    const lockedSettings = sanitizeChimerSettingsForEntitlements({
      backgroundId: "massage-lab-grid-motion",
      massageLabGridMotionMantras: customMantras,
    }, [])
    const premiumSettings = sanitizeChimerSettingsForEntitlements({
      backgroundId: "massage-lab-grid-motion",
      massageLabGridMotionMantras: customMantras,
    }, [FEATURE_KEYS.premiumBackgrounds])

    assert.deepEqual(lockedSettings.massageLabGridMotionMantras, [...DEFAULT_GRID_MOTION_MANTRAS])
    assert.notStrictEqual(
      lockedSettings.massageLabGridMotionMantras,
      DEFAULT_CHIMER_SETTINGS.massageLabGridMotionMantras,
    )
    lockedSettings.massageLabGridMotionMantras[0] = "Changed"
    assert.equal(DEFAULT_GRID_MOTION_MANTRAS[0], "I am grounded")
    assert.deepEqual(premiumSettings.massageLabGridMotionMantras, customMantras)
    assert.notStrictEqual(premiumSettings.massageLabGridMotionMantras, customMantras)
  })

  it("keeps Track 4B customization access aligned to the selected background with Source fallback", () => {
    assert.equal(canCustomizeBackgroundColors({ hasBackgroundAccess: true }), true)
    assert.equal(resolveEffectiveBackgroundPaletteMode({
      savedMode: "custom",
      canCustomize: canCustomizeBackgroundColors({ hasBackgroundAccess: true }),
    }), "custom")
    assert.equal(resolveEffectiveBackgroundPaletteMode({
      savedMode: "harmony",
      canCustomize: false,
    }), "source")

    for (const backgroundId of ["massage-lab-dna", "massage-lab-twisted-cubes"]) {
      const visualPropertyKey = backgroundId === "massage-lab-dna"
        ? "massageLabDnaStrandCount"
        : "massageLabTwistedCubesLayerCount"
      const editedVisualValue = backgroundId === "massage-lab-dna" ? 17 : 24
      assert.equal(typeof DEFAULT_CHIMER_SETTINGS[visualPropertyKey], "number", backgroundId)
      assert.notEqual(
        editedVisualValue,
        DEFAULT_CHIMER_SETTINGS[visualPropertyKey],
        `${backgroundId} fixture must differ from its source default`,
      )
      const featureSettings = sanitizeChimerSettingsForEntitlements({
        backgroundId,
        [visualPropertyKey]: editedVisualValue,
        backgroundVisualPreferences: { palette: { mode: "custom" } },
      }, [FEATURE_KEYS.premiumBackgrounds])
      assert.equal(featureSettings.backgroundId, backgroundId, backgroundId)
      assert.equal(featureSettings[visualPropertyKey], editedVisualValue, backgroundId)
      assert.equal(featureSettings.backgroundVisualPreferences.palette.mode, "custom", backgroundId)

      const ownedSettings = sanitizeChimerSettingsForEntitlements({
        backgroundId,
        [visualPropertyKey]: editedVisualValue,
        backgroundVisualPreferences: { palette: { mode: "harmony" } },
      }, { featureKeys: [], ownedBackgroundIds: [backgroundId] })
      assert.equal(ownedSettings.backgroundId, backgroundId, backgroundId)
      assert.equal(ownedSettings[visualPropertyKey], editedVisualValue, backgroundId)
      assert.equal(ownedSettings.backgroundVisualPreferences.palette.mode, "harmony", backgroundId)

      const lockedSettings = sanitizeChimerSettingsForEntitlements({
        backgroundId,
        [visualPropertyKey]: editedVisualValue,
      }, [])
      assert.equal(lockedSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId, backgroundId)
      assert.equal(lockedSettings[visualPropertyKey], DEFAULT_CHIMER_SETTINGS[visualPropertyKey], backgroundId)
    }
  })

  it("retains saved shared palettes across access loss while resolving denied access to Source", () => {
    const saved = {
      version: 1,
      palette: {
        mode: "custom",
        primaryColor: "#123456",
        swatches: ["#123456", "#234567", "#345678", "#456789", "#56789a", "#6789ab", "#789abc"],
      },
      colorPresets: [{
        id: "retained",
        name: "Retained",
        palette: {
          mode: "custom",
          primaryColor: "#abcdef",
          swatches: ["#abcdef", "#234567", "#345678", "#456789", "#56789a", "#6789ab", "#789abc"],
        },
      }],
    }
    const settings = sanitizeChimerSettingsForEntitlements({
      backgroundId: "massage-lab-novatrix",
      backgroundVisualPreferences: saved,
    }, [])

    assert.equal(settings.backgroundVisualPreferences.palette.mode, "custom")
    assert.equal(settings.backgroundVisualPreferences.colorPresets[0].id, "retained")
    assert.equal(resolveEffectiveBackgroundPaletteMode({
      savedMode: settings.backgroundVisualPreferences.palette.mode,
      canCustomize: canCustomizeBackgroundColors({
        hasBackgroundAccess: false,
      }),
    }), "source")
  })

  it("resets MassageLab Novatrix controls without premium background access", () => {
    const input = {
      backgroundId: "massage-lab-novatrix",
      massageLabNovatrixPaletteMode: "harmony",
      massageLabNovatrixPrimaryColor: "#AABBCC",
      massageLabNovatrixHarmony: "triad",
      massageLabNovatrixColor: "#DDEEFF",
      massageLabNovatrixSpeed: 2.4,
      massageLabNovatrixAmplitude: 0.3,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    assert.equal(freeSettings.massageLabNovatrixSpeed, DEFAULT_CHIMER_SETTINGS.massageLabNovatrixSpeed)
    assert.equal(freeSettings.massageLabNovatrixAmplitude, DEFAULT_CHIMER_SETTINGS.massageLabNovatrixAmplitude)

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "massage-lab-novatrix")
    assert.equal(premiumSettings.massageLabNovatrixSpeed, 2.4)
    assert.equal(premiumSettings.massageLabNovatrixAmplitude, 0.3)
  })

  it("resets MassageLab Matrix Rain controls without premium background access", () => {
    const input = {
      backgroundId: "massage-lab-matrix-rain",
      massageLabMatrixRainPaletteMode: "harmony",
      massageLabMatrixRainPrimaryColor: "#00D4FF",
      massageLabMatrixRainHarmony: "triad",
      massageLabMatrixRainColor: "#22D3EE",
      massageLabMatrixRainSpeed: 2.4,
      massageLabMatrixRainFontSize: 22,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    assert.equal(freeSettings.massageLabMatrixRainSpeed, DEFAULT_CHIMER_SETTINGS.massageLabMatrixRainSpeed)
    assert.equal(freeSettings.massageLabMatrixRainFontSize, DEFAULT_CHIMER_SETTINGS.massageLabMatrixRainFontSize)

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "massage-lab-matrix-rain")
    assert.equal(premiumSettings.massageLabMatrixRainSpeed, 2.4)
    assert.equal(premiumSettings.massageLabMatrixRainFontSize, 22)
  })

  it("resets MassageLab Photon Beam controls without premium background access", () => {
    const input = {
      backgroundId: "massage-lab-photon-beam",
      massageLabPhotonBeamPaletteMode: "harmony",
      massageLabPhotonBeamPrimaryColor: "#00D4FF",
      massageLabPhotonBeamHarmony: "triad",
      massageLabPhotonBeamColorBg: "#010203",
      massageLabPhotonBeamColorLine: "#123456",
      massageLabPhotonBeamColorSignal: "#ABCDEF",
      massageLabPhotonBeamColorSignal2: "#FEDCBA",
      massageLabPhotonBeamColorSignal3: "#22D3EE",
      massageLabPhotonBeamLineCount: 120,
      massageLabPhotonBeamSpreadHeight: 64,
      massageLabPhotonBeamSpreadDepth: 18,
      massageLabPhotonBeamCurveLength: 80,
      massageLabPhotonBeamStraightLength: 160,
      massageLabPhotonBeamCurvePower: 1.25,
      massageLabPhotonBeamWaveSpeed: 4.5,
      massageLabPhotonBeamWaveHeight: 0.6,
      massageLabPhotonBeamLineOpacity: 0.82,
      massageLabPhotonBeamSignalCount: 140,
      massageLabPhotonBeamSpeedGlobal: 1.4,
      massageLabPhotonBeamTrailLength: 8,
      massageLabPhotonBeamBloomStrength: 4.2,
      massageLabPhotonBeamBloomRadius: 1.1,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    assert.equal(freeSettings.massageLabPhotonBeamLineCount, DEFAULT_CHIMER_SETTINGS.massageLabPhotonBeamLineCount)
    assert.equal(freeSettings.massageLabPhotonBeamDefaultsVersion, DEFAULT_CHIMER_SETTINGS.massageLabPhotonBeamDefaultsVersion)
    assert.equal(freeSettings.massageLabPhotonBeamSpreadHeight, DEFAULT_CHIMER_SETTINGS.massageLabPhotonBeamSpreadHeight)
    assert.equal(freeSettings.massageLabPhotonBeamSpreadDepth, DEFAULT_CHIMER_SETTINGS.massageLabPhotonBeamSpreadDepth)
    assert.equal(freeSettings.massageLabPhotonBeamCurveLength, DEFAULT_CHIMER_SETTINGS.massageLabPhotonBeamCurveLength)
    assert.equal(freeSettings.massageLabPhotonBeamStraightLength, DEFAULT_CHIMER_SETTINGS.massageLabPhotonBeamStraightLength)
    assert.equal(freeSettings.massageLabPhotonBeamCurvePower, DEFAULT_CHIMER_SETTINGS.massageLabPhotonBeamCurvePower)
    assert.equal(freeSettings.massageLabPhotonBeamWaveSpeed, DEFAULT_CHIMER_SETTINGS.massageLabPhotonBeamWaveSpeed)
    assert.equal(freeSettings.massageLabPhotonBeamWaveHeight, DEFAULT_CHIMER_SETTINGS.massageLabPhotonBeamWaveHeight)
    assert.equal(freeSettings.massageLabPhotonBeamLineOpacity, DEFAULT_CHIMER_SETTINGS.massageLabPhotonBeamLineOpacity)
    assert.equal(freeSettings.massageLabPhotonBeamSignalCount, DEFAULT_CHIMER_SETTINGS.massageLabPhotonBeamSignalCount)
    assert.equal(freeSettings.massageLabPhotonBeamSpeedGlobal, DEFAULT_CHIMER_SETTINGS.massageLabPhotonBeamSpeedGlobal)
    assert.equal(freeSettings.massageLabPhotonBeamTrailLength, DEFAULT_CHIMER_SETTINGS.massageLabPhotonBeamTrailLength)
    assert.equal(freeSettings.massageLabPhotonBeamBloomStrength, DEFAULT_CHIMER_SETTINGS.massageLabPhotonBeamBloomStrength)
    assert.equal(freeSettings.massageLabPhotonBeamBloomRadius, DEFAULT_CHIMER_SETTINGS.massageLabPhotonBeamBloomRadius)

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, ["premium_backgrounds"])

    assert.equal(premiumSettings.backgroundId, "massage-lab-photon-beam")
    assert.equal(premiumSettings.massageLabPhotonBeamLineCount, 120)
    assert.equal(premiumSettings.massageLabPhotonBeamSpreadHeight, 64)
    assert.equal(premiumSettings.massageLabPhotonBeamSpreadDepth, 18)
    assert.equal(premiumSettings.massageLabPhotonBeamCurveLength, 80)
    assert.equal(premiumSettings.massageLabPhotonBeamStraightLength, 160)
    assert.equal(premiumSettings.massageLabPhotonBeamCurvePower, 1.25)
    assert.equal(premiumSettings.massageLabPhotonBeamWaveSpeed, 4.5)
    assert.equal(premiumSettings.massageLabPhotonBeamWaveHeight, 0.6)
    assert.equal(premiumSettings.massageLabPhotonBeamLineOpacity, 0.82)
    assert.equal(premiumSettings.massageLabPhotonBeamSignalCount, 140)
    assert.equal(premiumSettings.massageLabPhotonBeamSpeedGlobal, 1.4)
    assert.equal(premiumSettings.massageLabPhotonBeamTrailLength, 8)
    assert.equal(premiumSettings.massageLabPhotonBeamBloomStrength, 4.2)
    assert.equal(premiumSettings.massageLabPhotonBeamBloomRadius, 1.1)
  })

  it("resets MassageLab Ferrofluid controls without premium background access", () => {
    const input = {
      backgroundId: "massage-lab-ferrofluid",
      massageLabFerrofluidPaletteMode: "harmony",
      massageLabFerrofluidPrimaryColor: "#FFFFFF",
      massageLabFerrofluidHarmony: "triad",
      massageLabFerrofluidColorOne: "#010203",
      massageLabFerrofluidColorTwo: "#AABBCC",
      massageLabFerrofluidColorThree: "#DDEEFF",
      massageLabFerrofluidSpeed: 1.4,
      massageLabFerrofluidScale: 2.5,
      massageLabFerrofluidTurbulence: 1.6,
      massageLabFerrofluidFluidity: 0.2,
      massageLabFerrofluidRimWidth: 0.35,
      massageLabFerrofluidSharpness: 4.2,
      massageLabFerrofluidShimmer: 2.8,
      massageLabFerrofluidGlow: 3.4,
      massageLabFerrofluidFlowDirection: "left",
      massageLabFerrofluidOpacity: 0.72,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    assert.equal(freeSettings.massageLabFerrofluidSpeed, DEFAULT_CHIMER_SETTINGS.massageLabFerrofluidSpeed)
    assert.equal(freeSettings.massageLabFerrofluidScale, DEFAULT_CHIMER_SETTINGS.massageLabFerrofluidScale)
    assert.equal(freeSettings.massageLabFerrofluidTurbulence, DEFAULT_CHIMER_SETTINGS.massageLabFerrofluidTurbulence)
    assert.equal(freeSettings.massageLabFerrofluidFluidity, DEFAULT_CHIMER_SETTINGS.massageLabFerrofluidFluidity)
    assert.equal(freeSettings.massageLabFerrofluidRimWidth, DEFAULT_CHIMER_SETTINGS.massageLabFerrofluidRimWidth)
    assert.equal(freeSettings.massageLabFerrofluidSharpness, DEFAULT_CHIMER_SETTINGS.massageLabFerrofluidSharpness)
    assert.equal(freeSettings.massageLabFerrofluidShimmer, DEFAULT_CHIMER_SETTINGS.massageLabFerrofluidShimmer)
    assert.equal(freeSettings.massageLabFerrofluidGlow, DEFAULT_CHIMER_SETTINGS.massageLabFerrofluidGlow)
    assert.equal(
      freeSettings.massageLabFerrofluidFlowDirection,
      DEFAULT_CHIMER_SETTINGS.massageLabFerrofluidFlowDirection,
    )
    assert.equal(freeSettings.massageLabFerrofluidOpacity, DEFAULT_CHIMER_SETTINGS.massageLabFerrofluidOpacity)

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "massage-lab-ferrofluid")
    assert.equal(premiumSettings.massageLabFerrofluidSpeed, 1.4)
    assert.equal(premiumSettings.massageLabFerrofluidScale, 2.5)
    assert.equal(premiumSettings.massageLabFerrofluidTurbulence, 1.6)
    assert.equal(premiumSettings.massageLabFerrofluidFluidity, 0.2)
    assert.equal(premiumSettings.massageLabFerrofluidRimWidth, 0.35)
    assert.equal(premiumSettings.massageLabFerrofluidSharpness, 4.2)
    assert.equal(premiumSettings.massageLabFerrofluidShimmer, 2.8)
    assert.equal(premiumSettings.massageLabFerrofluidGlow, 3.4)
    assert.equal(premiumSettings.massageLabFerrofluidFlowDirection, "left")
    assert.equal(premiumSettings.massageLabFerrofluidOpacity, 0.72)
  })

  it("resets MassageLab Lightfall controls without premium background access", () => {
    const input = {
      backgroundId: "massage-lab-lightfall",
      massageLabLightfallPaletteMode: "harmony",
      massageLabLightfallPrimaryColor: "#A6C8FF",
      massageLabLightfallHarmony: "triad",
      massageLabLightfallColorOne: "#010203",
      massageLabLightfallColorTwo: "#AABBCC",
      massageLabLightfallColorThree: "#DDEEFF",
      massageLabLightfallBackgroundColor: "#0A29FF",
      massageLabLightfallSpeed: 1.4,
      massageLabLightfallStreakCount: 8,
      massageLabLightfallStreakWidth: 1.6,
      massageLabLightfallStreakLength: 2.4,
      massageLabLightfallGlow: 2.2,
      massageLabLightfallDensity: 1.2,
      massageLabLightfallTwinkle: 0.35,
      massageLabLightfallZoom: 4.2,
      massageLabLightfallBackgroundGlow: 0.9,
      massageLabLightfallOpacity: 0.72,
      massageLabLightfallCursorEnabled: true,
      massageLabLightfallCursorStrength: 1.3,
      massageLabLightfallCursorRadius: 1.7,
      massageLabLightfallCursorDampening: 0.25,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    assert.equal(freeSettings.massageLabLightfallSpeed, DEFAULT_CHIMER_SETTINGS.massageLabLightfallSpeed)
    assert.equal(freeSettings.massageLabLightfallStreakCount, DEFAULT_CHIMER_SETTINGS.massageLabLightfallStreakCount)
    assert.equal(freeSettings.massageLabLightfallStreakWidth, DEFAULT_CHIMER_SETTINGS.massageLabLightfallStreakWidth)
    assert.equal(freeSettings.massageLabLightfallStreakLength, DEFAULT_CHIMER_SETTINGS.massageLabLightfallStreakLength)
    assert.equal(freeSettings.massageLabLightfallGlow, DEFAULT_CHIMER_SETTINGS.massageLabLightfallGlow)
    assert.equal(freeSettings.massageLabLightfallDensity, DEFAULT_CHIMER_SETTINGS.massageLabLightfallDensity)
    assert.equal(freeSettings.massageLabLightfallTwinkle, DEFAULT_CHIMER_SETTINGS.massageLabLightfallTwinkle)
    assert.equal(freeSettings.massageLabLightfallZoom, DEFAULT_CHIMER_SETTINGS.massageLabLightfallZoom)
    assert.equal(
      freeSettings.massageLabLightfallBackgroundGlow,
      DEFAULT_CHIMER_SETTINGS.massageLabLightfallBackgroundGlow,
    )
    assert.equal(freeSettings.massageLabLightfallOpacity, DEFAULT_CHIMER_SETTINGS.massageLabLightfallOpacity)
    assert.equal(
      freeSettings.massageLabLightfallCursorEnabled,
      DEFAULT_CHIMER_SETTINGS.massageLabLightfallCursorEnabled,
    )
    assert.equal(
      freeSettings.massageLabLightfallCursorStrength,
      DEFAULT_CHIMER_SETTINGS.massageLabLightfallCursorStrength,
    )
    assert.equal(
      freeSettings.massageLabLightfallCursorRadius,
      DEFAULT_CHIMER_SETTINGS.massageLabLightfallCursorRadius,
    )
    assert.equal(
      freeSettings.massageLabLightfallCursorDampening,
      DEFAULT_CHIMER_SETTINGS.massageLabLightfallCursorDampening,
    )

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "massage-lab-lightfall")
    assert.equal(premiumSettings.massageLabLightfallSpeed, 1.4)
    assert.equal(premiumSettings.massageLabLightfallStreakCount, 8)
    assert.equal(premiumSettings.massageLabLightfallStreakWidth, 1.6)
    assert.equal(premiumSettings.massageLabLightfallStreakLength, 2.4)
    assert.equal(premiumSettings.massageLabLightfallGlow, 2.2)
    assert.equal(premiumSettings.massageLabLightfallDensity, 1.2)
    assert.equal(premiumSettings.massageLabLightfallTwinkle, 0.35)
    assert.equal(premiumSettings.massageLabLightfallZoom, 4.2)
    assert.equal(premiumSettings.massageLabLightfallBackgroundGlow, 0.9)
    assert.equal(premiumSettings.massageLabLightfallOpacity, 0.72)
    assert.equal(premiumSettings.massageLabLightfallCursorEnabled, true)
    assert.equal(premiumSettings.massageLabLightfallCursorStrength, 1.3)
    assert.equal(premiumSettings.massageLabLightfallCursorRadius, 1.7)
    assert.equal(premiumSettings.massageLabLightfallCursorDampening, 0.25)
  })

  it("resets MassageLab Liquid Ether controls without premium background access", () => {
    const input = {
      backgroundId: "massage-lab-liquid-ether",
      massageLabLiquidEtherPaletteMode: "harmony",
      massageLabLiquidEtherPrimaryColor: "#5227FF",
      massageLabLiquidEtherHarmony: "triad",
      massageLabLiquidEtherColorOne: "#010203",
      massageLabLiquidEtherColorTwo: "#AABBCC",
      massageLabLiquidEtherColorThree: "#DDEEFF",
      massageLabLiquidEtherCursorEnabled: true,
      massageLabLiquidEtherMouseForce: 54,
      massageLabLiquidEtherCursorSize: 180,
      massageLabLiquidEtherIsViscous: true,
      massageLabLiquidEtherViscous: 42,
      massageLabLiquidEtherIterationsViscous: 24,
      massageLabLiquidEtherIterationsPoisson: 40,
      massageLabLiquidEtherDt: 0.02,
      massageLabLiquidEtherBfecc: false,
      massageLabLiquidEtherResolution: 0.75,
      massageLabLiquidEtherIsBounce: true,
      massageLabLiquidEtherAutoDemo: false,
      massageLabLiquidEtherAutoSpeed: 1.25,
      massageLabLiquidEtherAutoIntensity: 3.4,
      massageLabLiquidEtherAutoResumeDelay: 1500,
      massageLabLiquidEtherAutoRampDuration: 1.2,
      massageLabLiquidEtherOpacity: 0.72,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    assert.equal(
      freeSettings.massageLabLiquidEtherCursorEnabled,
      DEFAULT_CHIMER_SETTINGS.massageLabLiquidEtherCursorEnabled,
    )
    assert.equal(freeSettings.massageLabLiquidEtherMouseForce, DEFAULT_CHIMER_SETTINGS.massageLabLiquidEtherMouseForce)
    assert.equal(freeSettings.massageLabLiquidEtherCursorSize, DEFAULT_CHIMER_SETTINGS.massageLabLiquidEtherCursorSize)
    assert.equal(
      freeSettings.massageLabLiquidEtherIsViscous,
      DEFAULT_CHIMER_SETTINGS.massageLabLiquidEtherIsViscous,
    )
    assert.equal(freeSettings.massageLabLiquidEtherViscous, DEFAULT_CHIMER_SETTINGS.massageLabLiquidEtherViscous)
    assert.equal(
      freeSettings.massageLabLiquidEtherIterationsViscous,
      DEFAULT_CHIMER_SETTINGS.massageLabLiquidEtherIterationsViscous,
    )
    assert.equal(
      freeSettings.massageLabLiquidEtherIterationsPoisson,
      DEFAULT_CHIMER_SETTINGS.massageLabLiquidEtherIterationsPoisson,
    )
    assert.equal(freeSettings.massageLabLiquidEtherDt, DEFAULT_CHIMER_SETTINGS.massageLabLiquidEtherDt)
    assert.equal(freeSettings.massageLabLiquidEtherBfecc, DEFAULT_CHIMER_SETTINGS.massageLabLiquidEtherBfecc)
    assert.equal(freeSettings.massageLabLiquidEtherResolution, DEFAULT_CHIMER_SETTINGS.massageLabLiquidEtherResolution)
    assert.equal(freeSettings.massageLabLiquidEtherIsBounce, DEFAULT_CHIMER_SETTINGS.massageLabLiquidEtherIsBounce)
    assert.equal(freeSettings.massageLabLiquidEtherAutoDemo, DEFAULT_CHIMER_SETTINGS.massageLabLiquidEtherAutoDemo)
    assert.equal(freeSettings.massageLabLiquidEtherAutoSpeed, DEFAULT_CHIMER_SETTINGS.massageLabLiquidEtherAutoSpeed)
    assert.equal(
      freeSettings.massageLabLiquidEtherAutoIntensity,
      DEFAULT_CHIMER_SETTINGS.massageLabLiquidEtherAutoIntensity,
    )
    assert.equal(
      freeSettings.massageLabLiquidEtherAutoResumeDelay,
      DEFAULT_CHIMER_SETTINGS.massageLabLiquidEtherAutoResumeDelay,
    )
    assert.equal(
      freeSettings.massageLabLiquidEtherAutoRampDuration,
      DEFAULT_CHIMER_SETTINGS.massageLabLiquidEtherAutoRampDuration,
    )
    assert.equal(freeSettings.massageLabLiquidEtherOpacity, DEFAULT_CHIMER_SETTINGS.massageLabLiquidEtherOpacity)

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "massage-lab-liquid-ether")
    assert.equal(premiumSettings.massageLabLiquidEtherCursorEnabled, true)
    assert.equal(premiumSettings.massageLabLiquidEtherMouseForce, 54)
    assert.equal(premiumSettings.massageLabLiquidEtherCursorSize, 180)
    assert.equal(premiumSettings.massageLabLiquidEtherIsViscous, true)
    assert.equal(premiumSettings.massageLabLiquidEtherViscous, 42)
    assert.equal(premiumSettings.massageLabLiquidEtherIterationsViscous, 24)
    assert.equal(premiumSettings.massageLabLiquidEtherIterationsPoisson, 40)
    assert.equal(premiumSettings.massageLabLiquidEtherDt, 0.02)
    assert.equal(premiumSettings.massageLabLiquidEtherBfecc, false)
    assert.equal(premiumSettings.massageLabLiquidEtherResolution, 0.75)
    assert.equal(premiumSettings.massageLabLiquidEtherIsBounce, true)
    assert.equal(premiumSettings.massageLabLiquidEtherAutoDemo, false)
    assert.equal(premiumSettings.massageLabLiquidEtherAutoSpeed, 1.25)
    assert.equal(premiumSettings.massageLabLiquidEtherAutoIntensity, 3.4)
    assert.equal(premiumSettings.massageLabLiquidEtherAutoResumeDelay, 1500)
    assert.equal(premiumSettings.massageLabLiquidEtherAutoRampDuration, 1.2)
    assert.equal(premiumSettings.massageLabLiquidEtherOpacity, 0.72)
  })

  it("resets MassageLab Prism controls without premium background access", () => {
    const input = {
      backgroundId: "massage-lab-prism",
      massageLabPrismHeight: 6.2,
      massageLabPrismBaseWidth: 7.4,
      massageLabPrismAnimationType: "hover",
      massageLabPrismGlow: 2.4,
      massageLabPrismOffsetX: 120,
      massageLabPrismOffsetY: -80,
      massageLabPrismNoise: 0.2,
      massageLabPrismTransparent: false,
      massageLabPrismScale: 4.8,
      massageLabPrismHueShift: 1.2,
      massageLabPrismColorFrequency: 1.8,
      massageLabPrismHoverStrength: 3.2,
      massageLabPrismInertia: 0.18,
      massageLabPrismBloom: 2.6,
      massageLabPrismTimeScale: 1.3,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    assert.equal(freeSettings.massageLabPrismHeight, DEFAULT_CHIMER_SETTINGS.massageLabPrismHeight)
    assert.equal(freeSettings.massageLabPrismBaseWidth, DEFAULT_CHIMER_SETTINGS.massageLabPrismBaseWidth)
    assert.equal(freeSettings.massageLabPrismAnimationType, DEFAULT_CHIMER_SETTINGS.massageLabPrismAnimationType)
    assert.equal(freeSettings.massageLabPrismGlow, DEFAULT_CHIMER_SETTINGS.massageLabPrismGlow)
    assert.equal(freeSettings.massageLabPrismOffsetX, DEFAULT_CHIMER_SETTINGS.massageLabPrismOffsetX)
    assert.equal(freeSettings.massageLabPrismOffsetY, DEFAULT_CHIMER_SETTINGS.massageLabPrismOffsetY)
    assert.equal(freeSettings.massageLabPrismNoise, DEFAULT_CHIMER_SETTINGS.massageLabPrismNoise)
    assert.equal(freeSettings.massageLabPrismTransparent, DEFAULT_CHIMER_SETTINGS.massageLabPrismTransparent)
    assert.equal(freeSettings.massageLabPrismScale, DEFAULT_CHIMER_SETTINGS.massageLabPrismScale)
    assert.equal(freeSettings.massageLabPrismHueShift, DEFAULT_CHIMER_SETTINGS.massageLabPrismHueShift)
    assert.equal(freeSettings.massageLabPrismColorFrequency, DEFAULT_CHIMER_SETTINGS.massageLabPrismColorFrequency)
    assert.equal(freeSettings.massageLabPrismHoverStrength, DEFAULT_CHIMER_SETTINGS.massageLabPrismHoverStrength)
    assert.equal(freeSettings.massageLabPrismInertia, DEFAULT_CHIMER_SETTINGS.massageLabPrismInertia)
    assert.equal(freeSettings.massageLabPrismBloom, DEFAULT_CHIMER_SETTINGS.massageLabPrismBloom)
    assert.equal(freeSettings.massageLabPrismTimeScale, DEFAULT_CHIMER_SETTINGS.massageLabPrismTimeScale)

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "massage-lab-prism")
    assert.equal(premiumSettings.massageLabPrismHeight, 6.2)
    assert.equal(premiumSettings.massageLabPrismBaseWidth, 7.4)
    assert.equal(premiumSettings.massageLabPrismAnimationType, "hover")
    assert.equal(premiumSettings.massageLabPrismGlow, 2.4)
    assert.equal(premiumSettings.massageLabPrismOffsetX, 120)
    assert.equal(premiumSettings.massageLabPrismOffsetY, -80)
    assert.equal(premiumSettings.massageLabPrismNoise, 0.2)
    assert.equal(premiumSettings.massageLabPrismTransparent, false)
    assert.equal(premiumSettings.massageLabPrismScale, 4.8)
    assert.equal(premiumSettings.massageLabPrismHueShift, 1.2)
    assert.equal(premiumSettings.massageLabPrismColorFrequency, 1.8)
    assert.equal(premiumSettings.massageLabPrismHoverStrength, 3.2)
    assert.equal(premiumSettings.massageLabPrismInertia, 0.18)
    assert.equal(premiumSettings.massageLabPrismBloom, 2.6)
    assert.equal(premiumSettings.massageLabPrismTimeScale, 1.3)
  })

  it("resets MassageLab Dark Veil controls without premium background access", () => {
    const input = {
      backgroundId: "massage-lab-dark-veil",
      massageLabDarkVeilHueShift: 72,
      massageLabDarkVeilNoiseIntensity: 0.24,
      massageLabDarkVeilScanlineIntensity: 0.42,
      massageLabDarkVeilSpeed: 1.3,
      massageLabDarkVeilScanlineFrequency: 18,
      massageLabDarkVeilWarpAmount: 0.7,
      massageLabDarkVeilResolutionScale: 0.65,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    assert.equal(freeSettings.massageLabDarkVeilHueShift, DEFAULT_CHIMER_SETTINGS.massageLabDarkVeilHueShift)
    assert.equal(
      freeSettings.massageLabDarkVeilNoiseIntensity,
      DEFAULT_CHIMER_SETTINGS.massageLabDarkVeilNoiseIntensity,
    )
    assert.equal(
      freeSettings.massageLabDarkVeilScanlineIntensity,
      DEFAULT_CHIMER_SETTINGS.massageLabDarkVeilScanlineIntensity,
    )
    assert.equal(freeSettings.massageLabDarkVeilSpeed, DEFAULT_CHIMER_SETTINGS.massageLabDarkVeilSpeed)
    assert.equal(
      freeSettings.massageLabDarkVeilScanlineFrequency,
      DEFAULT_CHIMER_SETTINGS.massageLabDarkVeilScanlineFrequency,
    )
    assert.equal(freeSettings.massageLabDarkVeilWarpAmount, DEFAULT_CHIMER_SETTINGS.massageLabDarkVeilWarpAmount)
    assert.equal(
      freeSettings.massageLabDarkVeilResolutionScale,
      DEFAULT_CHIMER_SETTINGS.massageLabDarkVeilResolutionScale,
    )

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "massage-lab-dark-veil")
    assert.equal(premiumSettings.massageLabDarkVeilHueShift, 72)
    assert.equal(premiumSettings.massageLabDarkVeilNoiseIntensity, 0.24)
    assert.equal(premiumSettings.massageLabDarkVeilScanlineIntensity, 0.42)
    assert.equal(premiumSettings.massageLabDarkVeilSpeed, 1.3)
    assert.equal(premiumSettings.massageLabDarkVeilScanlineFrequency, 18)
    assert.equal(premiumSettings.massageLabDarkVeilWarpAmount, 0.7)
    assert.equal(premiumSettings.massageLabDarkVeilResolutionScale, 0.65)
  })

  it("resets MassageLab Light Pillar controls without premium background access", () => {
    const input = {
      backgroundId: "massage-lab-light-pillar",
      massageLabLightPillarPaletteMode: "harmony",
      massageLabLightPillarPrimaryColor: "#123456",
      massageLabLightPillarHarmony: "triad",
      massageLabLightPillarTopColor: "#ABCDEF",
      massageLabLightPillarBottomColor: "#FEDCBA",
      massageLabLightPillarIntensity: 2.4,
      massageLabLightPillarRotationSpeed: 1.2,
      massageLabLightPillarInteractive: true,
      massageLabLightPillarGlowAmount: 0.02,
      massageLabLightPillarWidth: 5.4,
      massageLabLightPillarHeight: 1.2,
      massageLabLightPillarNoiseIntensity: 0.7,
      massageLabLightPillarBlendMode: "normal",
      massageLabLightPillarRotation: 44,
      massageLabLightPillarQuality: "medium",
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    assert.equal(freeSettings.massageLabLightPillarIntensity, DEFAULT_CHIMER_SETTINGS.massageLabLightPillarIntensity)
    assert.equal(
      freeSettings.massageLabLightPillarRotationSpeed,
      DEFAULT_CHIMER_SETTINGS.massageLabLightPillarRotationSpeed,
    )
    assert.equal(
      freeSettings.massageLabLightPillarInteractive,
      DEFAULT_CHIMER_SETTINGS.massageLabLightPillarInteractive,
    )
    assert.equal(
      freeSettings.massageLabLightPillarGlowAmount,
      DEFAULT_CHIMER_SETTINGS.massageLabLightPillarGlowAmount,
    )
    assert.equal(freeSettings.massageLabLightPillarWidth, DEFAULT_CHIMER_SETTINGS.massageLabLightPillarWidth)
    assert.equal(freeSettings.massageLabLightPillarHeight, DEFAULT_CHIMER_SETTINGS.massageLabLightPillarHeight)
    assert.equal(
      freeSettings.massageLabLightPillarNoiseIntensity,
      DEFAULT_CHIMER_SETTINGS.massageLabLightPillarNoiseIntensity,
    )
    assert.equal(freeSettings.massageLabLightPillarBlendMode, DEFAULT_CHIMER_SETTINGS.massageLabLightPillarBlendMode)
    assert.equal(freeSettings.massageLabLightPillarRotation, DEFAULT_CHIMER_SETTINGS.massageLabLightPillarRotation)
    assert.equal(freeSettings.massageLabLightPillarQuality, DEFAULT_CHIMER_SETTINGS.massageLabLightPillarQuality)

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, ["premium_backgrounds"])

    assert.equal(premiumSettings.backgroundId, "massage-lab-light-pillar")
    assert.equal(premiumSettings.massageLabLightPillarIntensity, 2.4)
    assert.equal(premiumSettings.massageLabLightPillarRotationSpeed, 1.2)
    assert.equal(premiumSettings.massageLabLightPillarInteractive, true)
    assert.equal(premiumSettings.massageLabLightPillarGlowAmount, 0.02)
    assert.equal(premiumSettings.massageLabLightPillarWidth, 5.4)
    assert.equal(premiumSettings.massageLabLightPillarHeight, 1.2)
    assert.equal(premiumSettings.massageLabLightPillarNoiseIntensity, 0.7)
    assert.equal(premiumSettings.massageLabLightPillarBlendMode, "normal")
    assert.equal(premiumSettings.massageLabLightPillarRotation, 44)
    assert.equal(premiumSettings.massageLabLightPillarQuality, "medium")
  })

  it("resets MassageLab Silk controls without premium background access", () => {
    const input = {
      backgroundId: "massage-lab-silk",
      massageLabSilkPaletteMode: "harmony",
      massageLabSilkPrimaryColor: "#123456",
      massageLabSilkHarmony: "triad",
      massageLabSilkColor: "#ABCDEF",
      massageLabSilkSpeed: 7.5,
      massageLabSilkScale: 2.4,
      massageLabSilkNoiseIntensity: 2.2,
      massageLabSilkRotation: 1.4,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    assert.equal(freeSettings.massageLabSilkSpeed, DEFAULT_CHIMER_SETTINGS.massageLabSilkSpeed)
    assert.equal(freeSettings.massageLabSilkScale, DEFAULT_CHIMER_SETTINGS.massageLabSilkScale)
    assert.equal(freeSettings.massageLabSilkNoiseIntensity, DEFAULT_CHIMER_SETTINGS.massageLabSilkNoiseIntensity)
    assert.equal(freeSettings.massageLabSilkRotation, DEFAULT_CHIMER_SETTINGS.massageLabSilkRotation)

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, ["premium_backgrounds"])

    assert.equal(premiumSettings.backgroundId, "massage-lab-silk")
    assert.equal(premiumSettings.massageLabSilkSpeed, 7.5)
    assert.equal(premiumSettings.massageLabSilkScale, 2.4)
    assert.equal(premiumSettings.massageLabSilkNoiseIntensity, 2.2)
    assert.equal(premiumSettings.massageLabSilkRotation, 1.4)
  })

  it("resets MassageLab Floating Lines controls without premium background access", () => {
    const input = {
      backgroundId: "massage-lab-floating-lines",
      massageLabFloatingLinesPaletteMode: "harmony",
      massageLabFloatingLinesPrimaryColor: "#123456",
      massageLabFloatingLinesHarmony: "triad",
      massageLabFloatingLinesColorOne: "#ABCDEF",
      massageLabFloatingLinesColorTwo: "#FEDCBA",
      massageLabFloatingLinesColorThree: "#010203",
      massageLabFloatingLinesEnableTop: false,
      massageLabFloatingLinesEnableMiddle: false,
      massageLabFloatingLinesEnableBottom: true,
      massageLabFloatingLinesTopLineCount: 12,
      massageLabFloatingLinesMiddleLineCount: 10,
      massageLabFloatingLinesBottomLineCount: 8,
      massageLabFloatingLinesTopLineDistance: 4.5,
      massageLabFloatingLinesMiddleLineDistance: 3.5,
      massageLabFloatingLinesBottomLineDistance: 2.5,
      massageLabFloatingLinesTopWaveX: 4.4,
      massageLabFloatingLinesTopWaveY: 0.4,
      massageLabFloatingLinesTopWaveRotate: -0.3,
      massageLabFloatingLinesMiddleWaveX: 3.3,
      massageLabFloatingLinesMiddleWaveY: 0.2,
      massageLabFloatingLinesMiddleWaveRotate: 0.5,
      massageLabFloatingLinesBottomWaveX: 2.2,
      massageLabFloatingLinesBottomWaveY: -0.6,
      massageLabFloatingLinesBottomWaveRotate: -0.9,
      massageLabFloatingLinesAnimationSpeed: 1.5,
      massageLabFloatingLinesInteractive: false,
      massageLabFloatingLinesBendRadius: 7,
      massageLabFloatingLinesBendStrength: -0.8,
      massageLabFloatingLinesMouseDamping: 0.08,
      massageLabFloatingLinesParallax: false,
      massageLabFloatingLinesParallaxStrength: 0.4,
      massageLabFloatingLinesBlendMode: "normal",
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    assert.equal(freeSettings.massageLabFloatingLinesEnableTop, DEFAULT_CHIMER_SETTINGS.massageLabFloatingLinesEnableTop)
    assert.equal(
      freeSettings.massageLabFloatingLinesEnableMiddle,
      DEFAULT_CHIMER_SETTINGS.massageLabFloatingLinesEnableMiddle,
    )
    assert.equal(
      freeSettings.massageLabFloatingLinesEnableBottom,
      DEFAULT_CHIMER_SETTINGS.massageLabFloatingLinesEnableBottom,
    )
    assert.equal(
      freeSettings.massageLabFloatingLinesTopLineCount,
      DEFAULT_CHIMER_SETTINGS.massageLabFloatingLinesTopLineCount,
    )
    assert.equal(
      freeSettings.massageLabFloatingLinesMiddleLineCount,
      DEFAULT_CHIMER_SETTINGS.massageLabFloatingLinesMiddleLineCount,
    )
    assert.equal(
      freeSettings.massageLabFloatingLinesBottomLineCount,
      DEFAULT_CHIMER_SETTINGS.massageLabFloatingLinesBottomLineCount,
    )
    assert.equal(
      freeSettings.massageLabFloatingLinesTopLineDistance,
      DEFAULT_CHIMER_SETTINGS.massageLabFloatingLinesTopLineDistance,
    )
    assert.equal(
      freeSettings.massageLabFloatingLinesMiddleLineDistance,
      DEFAULT_CHIMER_SETTINGS.massageLabFloatingLinesMiddleLineDistance,
    )
    assert.equal(
      freeSettings.massageLabFloatingLinesBottomLineDistance,
      DEFAULT_CHIMER_SETTINGS.massageLabFloatingLinesBottomLineDistance,
    )
    assert.equal(freeSettings.massageLabFloatingLinesTopWaveX, DEFAULT_CHIMER_SETTINGS.massageLabFloatingLinesTopWaveX)
    assert.equal(freeSettings.massageLabFloatingLinesTopWaveY, DEFAULT_CHIMER_SETTINGS.massageLabFloatingLinesTopWaveY)
    assert.equal(
      freeSettings.massageLabFloatingLinesTopWaveRotate,
      DEFAULT_CHIMER_SETTINGS.massageLabFloatingLinesTopWaveRotate,
    )
    assert.equal(
      freeSettings.massageLabFloatingLinesMiddleWaveX,
      DEFAULT_CHIMER_SETTINGS.massageLabFloatingLinesMiddleWaveX,
    )
    assert.equal(
      freeSettings.massageLabFloatingLinesMiddleWaveY,
      DEFAULT_CHIMER_SETTINGS.massageLabFloatingLinesMiddleWaveY,
    )
    assert.equal(
      freeSettings.massageLabFloatingLinesMiddleWaveRotate,
      DEFAULT_CHIMER_SETTINGS.massageLabFloatingLinesMiddleWaveRotate,
    )
    assert.equal(
      freeSettings.massageLabFloatingLinesBottomWaveX,
      DEFAULT_CHIMER_SETTINGS.massageLabFloatingLinesBottomWaveX,
    )
    assert.equal(
      freeSettings.massageLabFloatingLinesBottomWaveY,
      DEFAULT_CHIMER_SETTINGS.massageLabFloatingLinesBottomWaveY,
    )
    assert.equal(
      freeSettings.massageLabFloatingLinesBottomWaveRotate,
      DEFAULT_CHIMER_SETTINGS.massageLabFloatingLinesBottomWaveRotate,
    )
    assert.equal(
      freeSettings.massageLabFloatingLinesAnimationSpeed,
      DEFAULT_CHIMER_SETTINGS.massageLabFloatingLinesAnimationSpeed,
    )
    assert.equal(
      freeSettings.massageLabFloatingLinesInteractive,
      DEFAULT_CHIMER_SETTINGS.massageLabFloatingLinesInteractive,
    )
    assert.equal(
      freeSettings.massageLabFloatingLinesBendRadius,
      DEFAULT_CHIMER_SETTINGS.massageLabFloatingLinesBendRadius,
    )
    assert.equal(
      freeSettings.massageLabFloatingLinesBendStrength,
      DEFAULT_CHIMER_SETTINGS.massageLabFloatingLinesBendStrength,
    )
    assert.equal(
      freeSettings.massageLabFloatingLinesMouseDamping,
      DEFAULT_CHIMER_SETTINGS.massageLabFloatingLinesMouseDamping,
    )
    assert.equal(freeSettings.massageLabFloatingLinesParallax, DEFAULT_CHIMER_SETTINGS.massageLabFloatingLinesParallax)
    assert.equal(
      freeSettings.massageLabFloatingLinesParallaxStrength,
      DEFAULT_CHIMER_SETTINGS.massageLabFloatingLinesParallaxStrength,
    )
    assert.equal(
      freeSettings.massageLabFloatingLinesBlendMode,
      DEFAULT_CHIMER_SETTINGS.massageLabFloatingLinesBlendMode,
    )

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, ["premium_backgrounds"])

    assert.equal(premiumSettings.backgroundId, "massage-lab-floating-lines")
    assert.equal(premiumSettings.massageLabFloatingLinesEnableTop, false)
    assert.equal(premiumSettings.massageLabFloatingLinesEnableMiddle, false)
    assert.equal(premiumSettings.massageLabFloatingLinesEnableBottom, true)
    assert.equal(premiumSettings.massageLabFloatingLinesTopLineCount, 12)
    assert.equal(premiumSettings.massageLabFloatingLinesMiddleLineCount, 10)
    assert.equal(premiumSettings.massageLabFloatingLinesBottomLineCount, 8)
    assert.equal(premiumSettings.massageLabFloatingLinesTopLineDistance, 4.5)
    assert.equal(premiumSettings.massageLabFloatingLinesMiddleLineDistance, 3.5)
    assert.equal(premiumSettings.massageLabFloatingLinesBottomLineDistance, 2.5)
    assert.equal(premiumSettings.massageLabFloatingLinesTopWaveX, 4.4)
    assert.equal(premiumSettings.massageLabFloatingLinesTopWaveY, 0.4)
    assert.equal(premiumSettings.massageLabFloatingLinesTopWaveRotate, -0.3)
    assert.equal(premiumSettings.massageLabFloatingLinesMiddleWaveX, 3.3)
    assert.equal(premiumSettings.massageLabFloatingLinesMiddleWaveY, 0.2)
    assert.equal(premiumSettings.massageLabFloatingLinesMiddleWaveRotate, 0.5)
    assert.equal(premiumSettings.massageLabFloatingLinesBottomWaveX, 2.2)
    assert.equal(premiumSettings.massageLabFloatingLinesBottomWaveY, -0.6)
    assert.equal(premiumSettings.massageLabFloatingLinesBottomWaveRotate, -0.9)
    assert.equal(premiumSettings.massageLabFloatingLinesAnimationSpeed, 1.5)
    assert.equal(premiumSettings.massageLabFloatingLinesInteractive, false)
    assert.equal(premiumSettings.massageLabFloatingLinesBendRadius, 7)
    assert.equal(premiumSettings.massageLabFloatingLinesBendStrength, -0.8)
    assert.equal(premiumSettings.massageLabFloatingLinesMouseDamping, 0.08)
    assert.equal(premiumSettings.massageLabFloatingLinesParallax, false)
    assert.equal(premiumSettings.massageLabFloatingLinesParallaxStrength, 0.4)
    assert.equal(premiumSettings.massageLabFloatingLinesBlendMode, "normal")
  })

  it("resets MassageLab Side Rays controls without premium background access", () => {
    const input = {
      backgroundId: "massage-lab-side-rays",
      massageLabSideRaysPaletteMode: "harmony",
      massageLabSideRaysPrimaryColor: "#EAB308",
      massageLabSideRaysHarmony: "triad",
      massageLabSideRaysColorOne: "#ABCDEF",
      massageLabSideRaysColorTwo: "#FEDCBA",
      massageLabSideRaysSpeed: 3.5,
      massageLabSideRaysIntensity: 4,
      massageLabSideRaysSpread: 3,
      massageLabSideRaysOrigin: "bottom-left",
      massageLabSideRaysTilt: 22,
      massageLabSideRaysSaturation: 2,
      massageLabSideRaysBlend: 0.4,
      massageLabSideRaysFalloff: 2.2,
      massageLabSideRaysOpacity: 0.7,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    assert.equal(freeSettings.massageLabSideRaysSpeed, DEFAULT_CHIMER_SETTINGS.massageLabSideRaysSpeed)
    assert.equal(freeSettings.massageLabSideRaysIntensity, DEFAULT_CHIMER_SETTINGS.massageLabSideRaysIntensity)
    assert.equal(freeSettings.massageLabSideRaysSpread, DEFAULT_CHIMER_SETTINGS.massageLabSideRaysSpread)
    assert.equal(freeSettings.massageLabSideRaysOrigin, DEFAULT_CHIMER_SETTINGS.massageLabSideRaysOrigin)
    assert.equal(freeSettings.massageLabSideRaysTilt, DEFAULT_CHIMER_SETTINGS.massageLabSideRaysTilt)
    assert.equal(freeSettings.massageLabSideRaysSaturation, DEFAULT_CHIMER_SETTINGS.massageLabSideRaysSaturation)
    assert.equal(freeSettings.massageLabSideRaysBlend, DEFAULT_CHIMER_SETTINGS.massageLabSideRaysBlend)
    assert.equal(freeSettings.massageLabSideRaysFalloff, DEFAULT_CHIMER_SETTINGS.massageLabSideRaysFalloff)
    assert.equal(freeSettings.massageLabSideRaysOpacity, DEFAULT_CHIMER_SETTINGS.massageLabSideRaysOpacity)

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "massage-lab-side-rays")
    assert.equal(premiumSettings.massageLabSideRaysSpeed, 3.5)
    assert.equal(premiumSettings.massageLabSideRaysIntensity, 4)
    assert.equal(premiumSettings.massageLabSideRaysSpread, 3)
    assert.equal(premiumSettings.massageLabSideRaysOrigin, "bottom-left")
    assert.equal(premiumSettings.massageLabSideRaysTilt, 22)
    assert.equal(premiumSettings.massageLabSideRaysSaturation, 2)
    assert.equal(premiumSettings.massageLabSideRaysBlend, 0.4)
    assert.equal(premiumSettings.massageLabSideRaysFalloff, 2.2)
    assert.equal(premiumSettings.massageLabSideRaysOpacity, 0.7)
  })

  it("resets Light Rays controls without premium background access", () => {
    const input = {
      backgroundId: "massage-lab-light-rays",
      massageLabLightRaysPaletteMode: "harmony",
      massageLabLightRaysPrimaryColor: "#FFFFFF",
      massageLabLightRaysHarmony: "triad",
      massageLabLightRaysColor: "#ABCDEF",
      massageLabLightRaysOrigin: "bottom-center",
      massageLabLightRaysSpeed: 3.5,
      massageLabLightRaysSpread: 3,
      massageLabLightRaysLength: 4,
      massageLabLightRaysPulsating: true,
      massageLabLightRaysFadeDistance: 2.2,
      massageLabLightRaysSaturation: 2,
      massageLabLightRaysFollowMouse: true,
      massageLabLightRaysMouseInfluence: 0.7,
      massageLabLightRaysNoiseAmount: 0.45,
      massageLabLightRaysDistortion: 1.5,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    assert.equal(freeSettings.massageLabLightRaysOrigin, DEFAULT_CHIMER_SETTINGS.massageLabLightRaysOrigin)
    assert.equal(freeSettings.massageLabLightRaysSpeed, DEFAULT_CHIMER_SETTINGS.massageLabLightRaysSpeed)
    assert.equal(freeSettings.massageLabLightRaysSpread, DEFAULT_CHIMER_SETTINGS.massageLabLightRaysSpread)
    assert.equal(freeSettings.massageLabLightRaysLength, DEFAULT_CHIMER_SETTINGS.massageLabLightRaysLength)
    assert.equal(freeSettings.massageLabLightRaysPulsating, DEFAULT_CHIMER_SETTINGS.massageLabLightRaysPulsating)
    assert.equal(freeSettings.massageLabLightRaysFadeDistance, DEFAULT_CHIMER_SETTINGS.massageLabLightRaysFadeDistance)
    assert.equal(freeSettings.massageLabLightRaysSaturation, DEFAULT_CHIMER_SETTINGS.massageLabLightRaysSaturation)
    assert.equal(freeSettings.massageLabLightRaysFollowMouse, DEFAULT_CHIMER_SETTINGS.massageLabLightRaysFollowMouse)
    assert.equal(freeSettings.massageLabLightRaysMouseInfluence, DEFAULT_CHIMER_SETTINGS.massageLabLightRaysMouseInfluence)
    assert.equal(freeSettings.massageLabLightRaysNoiseAmount, DEFAULT_CHIMER_SETTINGS.massageLabLightRaysNoiseAmount)
    assert.equal(freeSettings.massageLabLightRaysDistortion, DEFAULT_CHIMER_SETTINGS.massageLabLightRaysDistortion)

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "massage-lab-light-rays")
    assert.equal(premiumSettings.massageLabLightRaysOrigin, "bottom-center")
    assert.equal(premiumSettings.massageLabLightRaysSpeed, 3.5)
    assert.equal(premiumSettings.massageLabLightRaysSpread, 3)
    assert.equal(premiumSettings.massageLabLightRaysLength, 4)
    assert.equal(premiumSettings.massageLabLightRaysPulsating, true)
    assert.equal(premiumSettings.massageLabLightRaysFadeDistance, 2.2)
    assert.equal(premiumSettings.massageLabLightRaysSaturation, 2)
    assert.equal(premiumSettings.massageLabLightRaysFollowMouse, true)
    assert.equal(premiumSettings.massageLabLightRaysMouseInfluence, 0.7)
    assert.equal(premiumSettings.massageLabLightRaysNoiseAmount, 0.45)
    assert.equal(premiumSettings.massageLabLightRaysDistortion, 1.5)
  })

  it("resets MassageLab Pixel Blast controls without premium background access", () => {
    const input = {
      backgroundId: "massage-lab-pixel-blast",
      massageLabPixelBlastPaletteMode: "harmony",
      massageLabPixelBlastPrimaryColor: "#FFFFFF",
      massageLabPixelBlastHarmony: "triad",
      massageLabPixelBlastColor: "#ABCDEF",
      massageLabPixelBlastVariant: "diamond",
      massageLabPixelBlastPixelSize: 12,
      massageLabPixelBlastAntialias: false,
      massageLabPixelBlastPatternScale: 4,
      massageLabPixelBlastPatternDensity: 1.5,
      massageLabPixelBlastLiquid: true,
      massageLabPixelBlastLiquidStrength: 0.24,
      massageLabPixelBlastLiquidRadius: 2.5,
      massageLabPixelBlastPixelSizeJitter: 0.4,
      massageLabPixelBlastEnableRipples: false,
      massageLabPixelBlastRippleIntensityScale: 2.5,
      massageLabPixelBlastRippleThickness: 0.24,
      massageLabPixelBlastRippleSpeed: 1.2,
      massageLabPixelBlastLiquidWobbleSpeed: 6,
      massageLabPixelBlastAutoPauseOffscreen: false,
      massageLabPixelBlastSpeed: 1.8,
      massageLabPixelBlastTransparent: false,
      massageLabPixelBlastEdgeFade: 0.2,
      massageLabPixelBlastNoiseAmount: 0.18,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    for (const key of [
      "massageLabPixelBlastPaletteMode",
      "massageLabPixelBlastPrimaryColor",
      "massageLabPixelBlastHarmony",
      "massageLabPixelBlastColor",
      "massageLabPixelBlastVariant",
      "massageLabPixelBlastPixelSize",
      "massageLabPixelBlastAntialias",
      "massageLabPixelBlastPatternScale",
      "massageLabPixelBlastPatternDensity",
      "massageLabPixelBlastLiquid",
      "massageLabPixelBlastLiquidStrength",
      "massageLabPixelBlastLiquidRadius",
      "massageLabPixelBlastPixelSizeJitter",
      "massageLabPixelBlastEnableRipples",
      "massageLabPixelBlastRippleIntensityScale",
      "massageLabPixelBlastRippleThickness",
      "massageLabPixelBlastRippleSpeed",
      "massageLabPixelBlastLiquidWobbleSpeed",
      "massageLabPixelBlastAutoPauseOffscreen",
      "massageLabPixelBlastSpeed",
      "massageLabPixelBlastTransparent",
      "massageLabPixelBlastEdgeFade",
      "massageLabPixelBlastNoiseAmount",
    ]) {
      assert.equal(freeSettings[key], DEFAULT_CHIMER_SETTINGS[key])
    }

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "massage-lab-pixel-blast")
    assert.equal(premiumSettings.massageLabPixelBlastVariant, "diamond")
    assert.equal(premiumSettings.massageLabPixelBlastPixelSize, 12)
    assert.equal(premiumSettings.massageLabPixelBlastAntialias, false)
    assert.equal(premiumSettings.massageLabPixelBlastPatternScale, 4)
    assert.equal(premiumSettings.massageLabPixelBlastPatternDensity, 1.5)
    assert.equal(premiumSettings.massageLabPixelBlastLiquid, true)
    assert.equal(premiumSettings.massageLabPixelBlastLiquidStrength, 0.24)
    assert.equal(premiumSettings.massageLabPixelBlastLiquidRadius, 2.5)
    assert.equal(premiumSettings.massageLabPixelBlastPixelSizeJitter, 0.4)
    assert.equal(premiumSettings.massageLabPixelBlastEnableRipples, false)
    assert.equal(premiumSettings.massageLabPixelBlastRippleIntensityScale, 2.5)
    assert.equal(premiumSettings.massageLabPixelBlastRippleThickness, 0.24)
    assert.equal(premiumSettings.massageLabPixelBlastRippleSpeed, 1.2)
    assert.equal(premiumSettings.massageLabPixelBlastLiquidWobbleSpeed, 6)
    assert.equal(premiumSettings.massageLabPixelBlastAutoPauseOffscreen, false)
    assert.equal(premiumSettings.massageLabPixelBlastSpeed, 1.8)
    assert.equal(premiumSettings.massageLabPixelBlastTransparent, false)
    assert.equal(premiumSettings.massageLabPixelBlastEdgeFade, 0.2)
    assert.equal(premiumSettings.massageLabPixelBlastNoiseAmount, 0.18)
  })

  it("resets MassageLab Color Bends controls without premium background access", () => {
    const input = {
      backgroundId: "massage-lab-color-bends",
      massageLabColorBendsPaletteMode: "harmony",
      massageLabColorBendsPrimaryColor: "#FFFFFF",
      massageLabColorBendsHarmony: "triad",
      massageLabColorBendsColorOne: "#ABCDEF",
      massageLabColorBendsColorTwo: "#123456",
      massageLabColorBendsColorThree: "#654321",
      massageLabColorBendsColorFour: "#010203",
      massageLabColorBendsRotation: 180,
      massageLabColorBendsSpeed: 1.8,
      massageLabColorBendsTransparent: false,
      massageLabColorBendsAutoRotate: 42,
      massageLabColorBendsScale: 2.5,
      massageLabColorBendsFrequency: 2.2,
      massageLabColorBendsWarpStrength: 2.4,
      massageLabColorBendsInteractive: true,
      massageLabColorBendsMouseInfluence: 2.2,
      massageLabColorBendsParallax: 1.2,
      massageLabColorBendsNoise: 0.6,
      massageLabColorBendsIterations: 4,
      massageLabColorBendsIntensity: 2.5,
      massageLabColorBendsBandWidth: 10,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    for (const key of [
      "massageLabColorBendsPaletteMode",
      "massageLabColorBendsPrimaryColor",
      "massageLabColorBendsHarmony",
      "massageLabColorBendsColorOne",
      "massageLabColorBendsColorTwo",
      "massageLabColorBendsColorThree",
      "massageLabColorBendsColorFour",
      "massageLabColorBendsRotation",
      "massageLabColorBendsSpeed",
      "massageLabColorBendsTransparent",
      "massageLabColorBendsAutoRotate",
      "massageLabColorBendsScale",
      "massageLabColorBendsFrequency",
      "massageLabColorBendsWarpStrength",
      "massageLabColorBendsInteractive",
      "massageLabColorBendsMouseInfluence",
      "massageLabColorBendsParallax",
      "massageLabColorBendsNoise",
      "massageLabColorBendsIterations",
      "massageLabColorBendsIntensity",
      "massageLabColorBendsBandWidth",
    ]) {
      assert.equal(freeSettings[key], DEFAULT_CHIMER_SETTINGS[key])
    }

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "massage-lab-color-bends")
    assert.equal(premiumSettings.massageLabColorBendsRotation, 180)
    assert.equal(premiumSettings.massageLabColorBendsSpeed, 1.8)
    assert.equal(premiumSettings.massageLabColorBendsTransparent, false)
    assert.equal(premiumSettings.massageLabColorBendsAutoRotate, 42)
    assert.equal(premiumSettings.massageLabColorBendsScale, 2.5)
    assert.equal(premiumSettings.massageLabColorBendsFrequency, 2.2)
    assert.equal(premiumSettings.massageLabColorBendsWarpStrength, 2.4)
    assert.equal(premiumSettings.massageLabColorBendsInteractive, true)
    assert.equal(premiumSettings.massageLabColorBendsMouseInfluence, 2.2)
    assert.equal(premiumSettings.massageLabColorBendsParallax, 1.2)
    assert.equal(premiumSettings.massageLabColorBendsNoise, 0.6)
    assert.equal(premiumSettings.massageLabColorBendsIterations, 4)
    assert.equal(premiumSettings.massageLabColorBendsIntensity, 2.5)
    assert.equal(premiumSettings.massageLabColorBendsBandWidth, 10)
  })

  it("resets MassageLab Evil Eye controls without premium background access", () => {
    const input = {
      backgroundId: "massage-lab-evil-eye",
      massageLabEvilEyePaletteMode: "harmony",
      massageLabEvilEyePrimaryColor: "#FFFFFF",
      massageLabEvilEyeHarmony: "triad",
      massageLabEvilEyeColor: "#ABCDEF",
      massageLabEvilEyeBackgroundColor: "#010203",
      massageLabEvilEyeIntensity: 2.2,
      massageLabEvilEyePupilSize: 1.2,
      massageLabEvilEyeIrisWidth: 0.4,
      massageLabEvilEyeGlowIntensity: 0.8,
      massageLabEvilEyeScale: 1.3,
      massageLabEvilEyeNoiseScale: 2.2,
      massageLabEvilEyePupilFollow: 1.4,
      massageLabEvilEyeFlameSpeed: 1.8,
      massageLabEvilEyeInteractive: true,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    for (const key of [
      "massageLabEvilEyePaletteMode",
      "massageLabEvilEyePrimaryColor",
      "massageLabEvilEyeHarmony",
      "massageLabEvilEyeColor",
      "massageLabEvilEyeBackgroundColor",
      "massageLabEvilEyeIntensity",
      "massageLabEvilEyePupilSize",
      "massageLabEvilEyeIrisWidth",
      "massageLabEvilEyeGlowIntensity",
      "massageLabEvilEyeScale",
      "massageLabEvilEyeNoiseScale",
      "massageLabEvilEyePupilFollow",
      "massageLabEvilEyeFlameSpeed",
      "massageLabEvilEyeInteractive",
    ]) {
      assert.equal(freeSettings[key], DEFAULT_CHIMER_SETTINGS[key])
    }

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "massage-lab-evil-eye")
    assert.equal(premiumSettings.massageLabEvilEyeIntensity, 2.2)
    assert.equal(premiumSettings.massageLabEvilEyePupilSize, 1.2)
    assert.equal(premiumSettings.massageLabEvilEyeIrisWidth, 0.4)
    assert.equal(premiumSettings.massageLabEvilEyeGlowIntensity, 0.8)
    assert.equal(premiumSettings.massageLabEvilEyeScale, 1.3)
    assert.equal(premiumSettings.massageLabEvilEyeNoiseScale, 2.2)
    assert.equal(premiumSettings.massageLabEvilEyePupilFollow, 1.4)
    assert.equal(premiumSettings.massageLabEvilEyeFlameSpeed, 1.8)
    assert.equal(premiumSettings.massageLabEvilEyeInteractive, true)
  })

  it("resets MassageLab Line Waves controls without premium background access", () => {
    const input = {
      backgroundId: "massage-lab-line-waves",
      massageLabLineWavesPaletteMode: "harmony",
      massageLabLineWavesPrimaryColor: "#FFFFFF",
      massageLabLineWavesHarmony: "triad",
      massageLabLineWavesColorOne: "#ABCDEF",
      massageLabLineWavesColorTwo: "#123456",
      massageLabLineWavesColorThree: "#654321",
      massageLabLineWavesSpeed: 1.5,
      massageLabLineWavesInnerLineCount: 48,
      massageLabLineWavesOuterLineCount: 60,
      massageLabLineWavesWarpIntensity: 1.8,
      massageLabLineWavesRotation: -24,
      massageLabLineWavesEdgeFadeWidth: 0.3,
      massageLabLineWavesColorCycleSpeed: 1.7,
      massageLabLineWavesBrightness: 0.8,
      massageLabLineWavesEnableMouseInteraction: true,
      massageLabLineWavesMouseInfluence: 2.8,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    for (const key of [
      "massageLabLineWavesPaletteMode",
      "massageLabLineWavesPrimaryColor",
      "massageLabLineWavesHarmony",
      "massageLabLineWavesColorOne",
      "massageLabLineWavesColorTwo",
      "massageLabLineWavesColorThree",
      "massageLabLineWavesSpeed",
      "massageLabLineWavesInnerLineCount",
      "massageLabLineWavesOuterLineCount",
      "massageLabLineWavesWarpIntensity",
      "massageLabLineWavesRotation",
      "massageLabLineWavesEdgeFadeWidth",
      "massageLabLineWavesColorCycleSpeed",
      "massageLabLineWavesBrightness",
      "massageLabLineWavesEnableMouseInteraction",
      "massageLabLineWavesMouseInfluence",
    ]) {
      assert.equal(freeSettings[key], DEFAULT_CHIMER_SETTINGS[key])
    }

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "massage-lab-line-waves")
    assert.equal(premiumSettings.massageLabLineWavesSpeed, 1.5)
    assert.equal(premiumSettings.massageLabLineWavesInnerLineCount, 48)
    assert.equal(premiumSettings.massageLabLineWavesOuterLineCount, 60)
    assert.equal(premiumSettings.massageLabLineWavesWarpIntensity, 1.8)
    assert.equal(premiumSettings.massageLabLineWavesRotation, -24)
    assert.equal(premiumSettings.massageLabLineWavesEdgeFadeWidth, 0.3)
    assert.equal(premiumSettings.massageLabLineWavesColorCycleSpeed, 1.7)
    assert.equal(premiumSettings.massageLabLineWavesBrightness, 0.8)
    assert.equal(premiumSettings.massageLabLineWavesEnableMouseInteraction, true)
    assert.equal(premiumSettings.massageLabLineWavesMouseInfluence, 2.8)
  })

  it("resets MassageLab Radar controls without premium background access", () => {
    const input = {
      backgroundId: "massage-lab-radar",
      massageLabRadarPaletteMode: "harmony",
      massageLabRadarPrimaryColor: "#FFFFFF",
      massageLabRadarHarmony: "triad",
      massageLabRadarColor: "#ABCDEF",
      massageLabRadarBackgroundColor: "#010203",
      massageLabRadarSpeed: 1.6,
      massageLabRadarScale: 0.8,
      massageLabRadarRingCount: 18,
      massageLabRadarSpokeCount: 16,
      massageLabRadarRingThickness: 0.08,
      massageLabRadarSpokeThickness: 0.04,
      massageLabRadarSweepSpeed: 1.4,
      massageLabRadarSweepWidth: 4,
      massageLabRadarSweepLobes: 3,
      massageLabRadarFalloff: 3.2,
      massageLabRadarBrightness: 1.7,
      massageLabRadarEnableMouseInteraction: true,
      massageLabRadarMouseInfluence: 0.4,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    for (const key of [
      "massageLabRadarPaletteMode",
      "massageLabRadarPrimaryColor",
      "massageLabRadarHarmony",
      "massageLabRadarColor",
      "massageLabRadarBackgroundColor",
      "massageLabRadarSpeed",
      "massageLabRadarScale",
      "massageLabRadarRingCount",
      "massageLabRadarSpokeCount",
      "massageLabRadarRingThickness",
      "massageLabRadarSpokeThickness",
      "massageLabRadarSweepSpeed",
      "massageLabRadarSweepWidth",
      "massageLabRadarSweepLobes",
      "massageLabRadarFalloff",
      "massageLabRadarBrightness",
      "massageLabRadarEnableMouseInteraction",
      "massageLabRadarMouseInfluence",
    ]) {
      assert.equal(freeSettings[key], DEFAULT_CHIMER_SETTINGS[key])
    }

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "massage-lab-radar")
    assert.equal(premiumSettings.massageLabRadarSpeed, 1.6)
    assert.equal(premiumSettings.massageLabRadarScale, 0.8)
    assert.equal(premiumSettings.massageLabRadarRingCount, 18)
    assert.equal(premiumSettings.massageLabRadarSpokeCount, 16)
    assert.equal(premiumSettings.massageLabRadarRingThickness, 0.08)
    assert.equal(premiumSettings.massageLabRadarSpokeThickness, 0.04)
    assert.equal(premiumSettings.massageLabRadarSweepSpeed, 1.4)
    assert.equal(premiumSettings.massageLabRadarSweepWidth, 4)
    assert.equal(premiumSettings.massageLabRadarSweepLobes, 3)
    assert.equal(premiumSettings.massageLabRadarFalloff, 3.2)
    assert.equal(premiumSettings.massageLabRadarBrightness, 1.7)
    assert.equal(premiumSettings.massageLabRadarEnableMouseInteraction, true)
    assert.equal(premiumSettings.massageLabRadarMouseInfluence, 0.4)
  })

  it("resets MassageLab Soft Aurora controls without premium background access", () => {
    const input = {
      backgroundId: "massage-lab-soft-aurora",
      massageLabSoftAuroraPaletteMode: "harmony",
      massageLabSoftAuroraPrimaryColor: "#FFFFFF",
      massageLabSoftAuroraHarmony: "triad",
      massageLabSoftAuroraColorOne: "#ABCDEF",
      massageLabSoftAuroraColorTwo: "#010203",
      massageLabSoftAuroraSpeed: 1.6,
      massageLabSoftAuroraScale: 2.2,
      massageLabSoftAuroraBrightness: 1.7,
      massageLabSoftAuroraNoiseFrequency: 3.4,
      massageLabSoftAuroraNoiseAmplitude: 1.8,
      massageLabSoftAuroraBandHeight: 0.7,
      massageLabSoftAuroraBandSpread: 1.9,
      massageLabSoftAuroraOctaveDecay: 0.4,
      massageLabSoftAuroraLayerOffset: 2.5,
      massageLabSoftAuroraColorSpeed: 1.3,
      massageLabSoftAuroraEnableMouseInteraction: true,
      massageLabSoftAuroraMouseInfluence: 0.4,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    for (const key of [
      "massageLabSoftAuroraPaletteMode",
      "massageLabSoftAuroraPrimaryColor",
      "massageLabSoftAuroraHarmony",
      "massageLabSoftAuroraColorOne",
      "massageLabSoftAuroraColorTwo",
      "massageLabSoftAuroraSpeed",
      "massageLabSoftAuroraScale",
      "massageLabSoftAuroraBrightness",
      "massageLabSoftAuroraNoiseFrequency",
      "massageLabSoftAuroraNoiseAmplitude",
      "massageLabSoftAuroraBandHeight",
      "massageLabSoftAuroraBandSpread",
      "massageLabSoftAuroraOctaveDecay",
      "massageLabSoftAuroraLayerOffset",
      "massageLabSoftAuroraColorSpeed",
      "massageLabSoftAuroraEnableMouseInteraction",
      "massageLabSoftAuroraMouseInfluence",
    ]) {
      assert.equal(freeSettings[key], DEFAULT_CHIMER_SETTINGS[key])
    }

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "massage-lab-soft-aurora")
    assert.equal(premiumSettings.massageLabSoftAuroraSpeed, 1.6)
    assert.equal(premiumSettings.massageLabSoftAuroraScale, 2.2)
    assert.equal(premiumSettings.massageLabSoftAuroraBrightness, 1.7)
    assert.equal(premiumSettings.massageLabSoftAuroraNoiseFrequency, 3.4)
    assert.equal(premiumSettings.massageLabSoftAuroraNoiseAmplitude, 1.8)
    assert.equal(premiumSettings.massageLabSoftAuroraBandHeight, 0.7)
    assert.equal(premiumSettings.massageLabSoftAuroraBandSpread, 1.9)
    assert.equal(premiumSettings.massageLabSoftAuroraOctaveDecay, 0.4)
    assert.equal(premiumSettings.massageLabSoftAuroraLayerOffset, 2.5)
    assert.equal(premiumSettings.massageLabSoftAuroraColorSpeed, 1.3)
    assert.equal(premiumSettings.massageLabSoftAuroraEnableMouseInteraction, true)
    assert.equal(premiumSettings.massageLabSoftAuroraMouseInfluence, 0.4)
  })

  it("resets MassageLab Plasma controls without premium background access", () => {
    const input = {
      backgroundId: "massage-lab-plasma",
      massageLabPlasmaPaletteMode: "harmony",
      massageLabPlasmaPrimaryColor: "#FFFFFF",
      massageLabPlasmaHarmony: "triad",
      massageLabPlasmaColor: "#ABCDEF",
      massageLabPlasmaSpeed: 1.6,
      massageLabPlasmaDirection: "pingpong",
      massageLabPlasmaScale: 2.2,
      massageLabPlasmaOpacity: 0.7,
      massageLabPlasmaMouseInteractive: true,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    for (const key of [
      "massageLabPlasmaPaletteMode",
      "massageLabPlasmaPrimaryColor",
      "massageLabPlasmaHarmony",
      "massageLabPlasmaColor",
      "massageLabPlasmaSpeed",
      "massageLabPlasmaDirection",
      "massageLabPlasmaScale",
      "massageLabPlasmaOpacity",
      "massageLabPlasmaMouseInteractive",
    ]) {
      assert.equal(freeSettings[key], DEFAULT_CHIMER_SETTINGS[key])
    }

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "massage-lab-plasma")
    assert.equal(premiumSettings.massageLabPlasmaSpeed, 1.6)
    assert.equal(premiumSettings.massageLabPlasmaDirection, "pingpong")
    assert.equal(premiumSettings.massageLabPlasmaScale, 2.2)
    assert.equal(premiumSettings.massageLabPlasmaOpacity, 0.7)
    assert.equal(premiumSettings.massageLabPlasmaMouseInteractive, true)
  })

  it("resets MassageLab Plasma Wave controls without premium background access", () => {
    const input = {
      backgroundId: "massage-lab-plasma-wave",
      massageLabPlasmaWavePaletteMode: "harmony",
      massageLabPlasmaWavePrimaryColor: "#FFFFFF",
      massageLabPlasmaWaveHarmony: "triad",
      massageLabPlasmaWaveColorOne: "#ABCDEF",
      massageLabPlasmaWaveColorTwo: "#010203",
      massageLabPlasmaWaveXOffset: 120,
      massageLabPlasmaWaveYOffset: -140,
      massageLabPlasmaWaveRotationDeg: 35,
      massageLabPlasmaWaveFocalLength: 1.2,
      massageLabPlasmaWaveSpeedOne: 0.2,
      massageLabPlasmaWaveSpeedTwo: 0.3,
      massageLabPlasmaWaveDirectionTwo: -1,
      massageLabPlasmaWaveBendOne: 1.4,
      massageLabPlasmaWaveBendTwo: 0.8,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    for (const key of [
      "massageLabPlasmaWavePaletteMode",
      "massageLabPlasmaWavePrimaryColor",
      "massageLabPlasmaWaveHarmony",
      "massageLabPlasmaWaveColorOne",
      "massageLabPlasmaWaveColorTwo",
      "massageLabPlasmaWaveXOffset",
      "massageLabPlasmaWaveYOffset",
      "massageLabPlasmaWaveRotationDeg",
      "massageLabPlasmaWaveFocalLength",
      "massageLabPlasmaWaveSpeedOne",
      "massageLabPlasmaWaveSpeedTwo",
      "massageLabPlasmaWaveDirectionTwo",
      "massageLabPlasmaWaveBendOne",
      "massageLabPlasmaWaveBendTwo",
    ]) {
      assert.equal(freeSettings[key], DEFAULT_CHIMER_SETTINGS[key])
    }

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "massage-lab-plasma-wave")
    assert.equal(premiumSettings.massageLabPlasmaWaveXOffset, 120)
    assert.equal(premiumSettings.massageLabPlasmaWaveYOffset, -140)
    assert.equal(premiumSettings.massageLabPlasmaWaveRotationDeg, 35)
    assert.equal(premiumSettings.massageLabPlasmaWaveFocalLength, 1.2)
    assert.equal(premiumSettings.massageLabPlasmaWaveSpeedOne, 0.2)
    assert.equal(premiumSettings.massageLabPlasmaWaveSpeedTwo, 0.3)
    assert.equal(premiumSettings.massageLabPlasmaWaveDirectionTwo, -1)
    assert.equal(premiumSettings.massageLabPlasmaWaveBendOne, 1.4)
    assert.equal(premiumSettings.massageLabPlasmaWaveBendTwo, 0.8)
  })

  it("resets MassageLab Particles controls without premium background access", () => {
    const input = {
      backgroundId: "massage-lab-particles",
      massageLabParticlesPaletteMode: "harmony",
      massageLabParticlesPrimaryColor: "#FFFFFF",
      massageLabParticlesHarmony: "triad",
      massageLabParticlesColorOne: "#ABCDEF",
      massageLabParticlesColorTwo: "#010203",
      massageLabParticlesColorThree: "#111111",
      massageLabParticlesCount: 420,
      massageLabParticlesSpread: 12,
      massageLabParticlesSpeed: 0.4,
      massageLabParticlesMoveOnHover: true,
      massageLabParticlesHoverFactor: 1.6,
      massageLabParticlesAlpha: true,
      massageLabParticlesBaseSize: 130,
      massageLabParticlesSizeRandomness: 1.5,
      massageLabParticlesCameraDistance: 24,
      massageLabParticlesDisableRotation: true,
      massageLabParticlesPixelRatio: 1.4,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    for (const key of [
      "massageLabParticlesPaletteMode",
      "massageLabParticlesPrimaryColor",
      "massageLabParticlesHarmony",
      "massageLabParticlesColorOne",
      "massageLabParticlesColorTwo",
      "massageLabParticlesColorThree",
      "massageLabParticlesCount",
      "massageLabParticlesSpread",
      "massageLabParticlesSpeed",
      "massageLabParticlesMoveOnHover",
      "massageLabParticlesHoverFactor",
      "massageLabParticlesAlpha",
      "massageLabParticlesBaseSize",
      "massageLabParticlesSizeRandomness",
      "massageLabParticlesCameraDistance",
      "massageLabParticlesDisableRotation",
      "massageLabParticlesPixelRatio",
    ]) {
      assert.equal(freeSettings[key], DEFAULT_CHIMER_SETTINGS[key])
    }

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "massage-lab-particles")
    assert.equal(premiumSettings.massageLabParticlesCount, 420)
    assert.equal(premiumSettings.massageLabParticlesSpread, 12)
    assert.equal(premiumSettings.massageLabParticlesSpeed, 0.4)
    assert.equal(premiumSettings.massageLabParticlesMoveOnHover, true)
    assert.equal(premiumSettings.massageLabParticlesHoverFactor, 1.6)
    assert.equal(premiumSettings.massageLabParticlesAlpha, true)
    assert.equal(premiumSettings.massageLabParticlesBaseSize, 130)
    assert.equal(premiumSettings.massageLabParticlesSizeRandomness, 1.5)
    assert.equal(premiumSettings.massageLabParticlesCameraDistance, 24)
    assert.equal(premiumSettings.massageLabParticlesDisableRotation, true)
    assert.equal(premiumSettings.massageLabParticlesPixelRatio, 1.4)
  })

  it("resets MassageLab Gradient Blinds controls without premium background access", () => {
    const input = {
      backgroundId: "massage-lab-gradient-blinds",
      massageLabGradientBlindsPaletteMode: "harmony",
      massageLabGradientBlindsPrimaryColor: "#FF9FFC",
      massageLabGradientBlindsHarmony: "triad",
      massageLabGradientBlindsColorOne: "#ABCDEF",
      massageLabGradientBlindsColorTwo: "#010203",
      massageLabGradientBlindsAngle: 30,
      massageLabGradientBlindsNoise: 0.44,
      massageLabGradientBlindsBlindCount: 24,
      massageLabGradientBlindsBlindMinWidth: 72,
      massageLabGradientBlindsMouseDampening: 0.32,
      massageLabGradientBlindsMirror: true,
      massageLabGradientBlindsSpotlightRadius: 0.8,
      massageLabGradientBlindsSpotlightSoftness: 1.6,
      massageLabGradientBlindsSpotlightOpacity: 1.2,
      massageLabGradientBlindsDistort: 1.8,
      massageLabGradientBlindsShineDirection: "right",
      massageLabGradientBlindsBlendMode: "screen",
      massageLabGradientBlindsDpr: 1.4,
      massageLabGradientBlindsEnableMouseInteraction: true,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    for (const key of [
      "massageLabGradientBlindsPaletteMode",
      "massageLabGradientBlindsPrimaryColor",
      "massageLabGradientBlindsHarmony",
      "massageLabGradientBlindsColorOne",
      "massageLabGradientBlindsColorTwo",
      "massageLabGradientBlindsAngle",
      "massageLabGradientBlindsNoise",
      "massageLabGradientBlindsBlindCount",
      "massageLabGradientBlindsBlindMinWidth",
      "massageLabGradientBlindsMouseDampening",
      "massageLabGradientBlindsMirror",
      "massageLabGradientBlindsSpotlightRadius",
      "massageLabGradientBlindsSpotlightSoftness",
      "massageLabGradientBlindsSpotlightOpacity",
      "massageLabGradientBlindsDistort",
      "massageLabGradientBlindsShineDirection",
      "massageLabGradientBlindsBlendMode",
      "massageLabGradientBlindsDpr",
      "massageLabGradientBlindsEnableMouseInteraction",
    ]) {
      assert.equal(freeSettings[key], DEFAULT_CHIMER_SETTINGS[key])
    }

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "massage-lab-gradient-blinds")
    assert.equal(premiumSettings.massageLabGradientBlindsAngle, 30)
    assert.equal(premiumSettings.massageLabGradientBlindsNoise, 0.44)
    assert.equal(premiumSettings.massageLabGradientBlindsBlindCount, 24)
    assert.equal(premiumSettings.massageLabGradientBlindsBlindMinWidth, 72)
    assert.equal(premiumSettings.massageLabGradientBlindsMouseDampening, 0.32)
    assert.equal(premiumSettings.massageLabGradientBlindsMirror, true)
    assert.equal(premiumSettings.massageLabGradientBlindsSpotlightRadius, 0.8)
    assert.equal(premiumSettings.massageLabGradientBlindsSpotlightSoftness, 1.6)
    assert.equal(premiumSettings.massageLabGradientBlindsSpotlightOpacity, 1.2)
    assert.equal(premiumSettings.massageLabGradientBlindsDistort, 1.8)
    assert.equal(premiumSettings.massageLabGradientBlindsShineDirection, "right")
    assert.equal(premiumSettings.massageLabGradientBlindsBlendMode, "screen")
    assert.equal(premiumSettings.massageLabGradientBlindsDpr, 1.4)
    assert.equal(premiumSettings.massageLabGradientBlindsEnableMouseInteraction, true)
  })

  it("resets MassageLab Grainient controls without premium background access", () => {
    const input = {
      backgroundId: "massage-lab-grainient",
      massageLabGrainientPaletteMode: "harmony",
      massageLabGrainientPrimaryColor: "#FF9FFC",
      massageLabGrainientHarmony: "triad",
      massageLabGrainientColorOne: "#ABCDEF",
      massageLabGrainientColorTwo: "#010203",
      massageLabGrainientColorThree: "#111111",
      massageLabGrainientTimeSpeed: 0.8,
      massageLabGrainientColorBalance: 0.4,
      massageLabGrainientWarpStrength: 1.7,
      massageLabGrainientWarpFrequency: 8,
      massageLabGrainientWarpSpeed: 2.4,
      massageLabGrainientWarpAmplitude: 64,
      massageLabGrainientBlendAngle: 22,
      massageLabGrainientBlendSoftness: 0.18,
      massageLabGrainientRotationAmount: 700,
      massageLabGrainientNoiseScale: 3,
      massageLabGrainientGrainAmount: 0.25,
      massageLabGrainientGrainScale: 4,
      massageLabGrainientGrainAnimated: true,
      massageLabGrainientContrast: 1.7,
      massageLabGrainientGamma: 1.2,
      massageLabGrainientSaturation: 1.3,
      massageLabGrainientCenterX: 0.2,
      massageLabGrainientCenterY: -0.2,
      massageLabGrainientZoom: 1.1,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    for (const key of [
      "massageLabGrainientPaletteMode",
      "massageLabGrainientPrimaryColor",
      "massageLabGrainientHarmony",
      "massageLabGrainientColorOne",
      "massageLabGrainientColorTwo",
      "massageLabGrainientColorThree",
      "massageLabGrainientTimeSpeed",
      "massageLabGrainientColorBalance",
      "massageLabGrainientWarpStrength",
      "massageLabGrainientWarpFrequency",
      "massageLabGrainientWarpSpeed",
      "massageLabGrainientWarpAmplitude",
      "massageLabGrainientBlendAngle",
      "massageLabGrainientBlendSoftness",
      "massageLabGrainientRotationAmount",
      "massageLabGrainientNoiseScale",
      "massageLabGrainientGrainAmount",
      "massageLabGrainientGrainScale",
      "massageLabGrainientGrainAnimated",
      "massageLabGrainientContrast",
      "massageLabGrainientGamma",
      "massageLabGrainientSaturation",
      "massageLabGrainientCenterX",
      "massageLabGrainientCenterY",
      "massageLabGrainientZoom",
    ]) {
      assert.equal(freeSettings[key], DEFAULT_CHIMER_SETTINGS[key])
    }

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "massage-lab-grainient")
    assert.equal(premiumSettings.massageLabGrainientTimeSpeed, 0.8)
    assert.equal(premiumSettings.massageLabGrainientColorBalance, 0.4)
    assert.equal(premiumSettings.massageLabGrainientWarpStrength, 1.7)
    assert.equal(premiumSettings.massageLabGrainientWarpFrequency, 8)
    assert.equal(premiumSettings.massageLabGrainientWarpSpeed, 2.4)
    assert.equal(premiumSettings.massageLabGrainientWarpAmplitude, 64)
    assert.equal(premiumSettings.massageLabGrainientBlendAngle, 22)
    assert.equal(premiumSettings.massageLabGrainientBlendSoftness, 0.18)
    assert.equal(premiumSettings.massageLabGrainientRotationAmount, 700)
    assert.equal(premiumSettings.massageLabGrainientNoiseScale, 3)
    assert.equal(premiumSettings.massageLabGrainientGrainAmount, 0.25)
    assert.equal(premiumSettings.massageLabGrainientGrainScale, 4)
    assert.equal(premiumSettings.massageLabGrainientGrainAnimated, true)
    assert.equal(premiumSettings.massageLabGrainientContrast, 1.7)
    assert.equal(premiumSettings.massageLabGrainientGamma, 1.2)
    assert.equal(premiumSettings.massageLabGrainientSaturation, 1.3)
    assert.equal(premiumSettings.massageLabGrainientCenterX, 0.2)
    assert.equal(premiumSettings.massageLabGrainientCenterY, -0.2)
    assert.equal(premiumSettings.massageLabGrainientZoom, 1.1)
  })

  it("resets MassageLab Grid Scan controls without premium background access", () => {
    const input = {
      backgroundId: "massage-lab-grid-scan",
      massageLabGridScanPaletteMode: "harmony",
      massageLabGridScanPrimaryColor: "#FF9FFC",
      massageLabGridScanHarmony: "triad",
      massageLabGridScanLinesColor: "#ABCDEF",
      massageLabGridScanScanColor: "#010203",
      massageLabGridScanSensitivity: 0.7,
      massageLabGridScanLineThickness: 2.4,
      massageLabGridScanScanOpacity: 0.6,
      massageLabGridScanGridScale: 0.2,
      massageLabGridScanLineStyle: "dotted",
      massageLabGridScanLineJitter: 0.5,
      massageLabGridScanDirection: "backward",
      massageLabGridScanNoiseIntensity: 0.08,
      massageLabGridScanBloomOpacity: 0.4,
      massageLabGridScanScanGlow: 1.2,
      massageLabGridScanScanSoftness: 3.2,
      massageLabGridScanPhaseTaper: 0.25,
      massageLabGridScanScanDuration: 3,
      massageLabGridScanScanDelay: 1,
      massageLabGridScanEnablePointerInteraction: true,
      massageLabGridScanScanOnClick: true,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    for (const key of [
      "massageLabGridScanPaletteMode",
      "massageLabGridScanPrimaryColor",
      "massageLabGridScanHarmony",
      "massageLabGridScanLinesColor",
      "massageLabGridScanScanColor",
      "massageLabGridScanSensitivity",
      "massageLabGridScanLineThickness",
      "massageLabGridScanScanOpacity",
      "massageLabGridScanGridScale",
      "massageLabGridScanLineStyle",
      "massageLabGridScanLineJitter",
      "massageLabGridScanDirection",
      "massageLabGridScanNoiseIntensity",
      "massageLabGridScanBloomOpacity",
      "massageLabGridScanScanGlow",
      "massageLabGridScanScanSoftness",
      "massageLabGridScanPhaseTaper",
      "massageLabGridScanScanDuration",
      "massageLabGridScanScanDelay",
      "massageLabGridScanEnablePointerInteraction",
      "massageLabGridScanScanOnClick",
    ]) {
      assert.equal(freeSettings[key], DEFAULT_CHIMER_SETTINGS[key])
    }

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "massage-lab-grid-scan")
    assert.equal(premiumSettings.massageLabGridScanSensitivity, 0.7)
    assert.equal(premiumSettings.massageLabGridScanLineThickness, 2.4)
    assert.equal(premiumSettings.massageLabGridScanScanOpacity, 0.6)
    assert.equal(premiumSettings.massageLabGridScanGridScale, 0.2)
    assert.equal(premiumSettings.massageLabGridScanLineStyle, "dotted")
    assert.equal(premiumSettings.massageLabGridScanLineJitter, 0.5)
    assert.equal(premiumSettings.massageLabGridScanDirection, "backward")
    assert.equal(premiumSettings.massageLabGridScanNoiseIntensity, 0.08)
    assert.equal(premiumSettings.massageLabGridScanBloomOpacity, 0.4)
    assert.equal(premiumSettings.massageLabGridScanScanGlow, 1.2)
    assert.equal(premiumSettings.massageLabGridScanScanSoftness, 3.2)
    assert.equal(premiumSettings.massageLabGridScanPhaseTaper, 0.25)
    assert.equal(premiumSettings.massageLabGridScanScanDuration, 3)
    assert.equal(premiumSettings.massageLabGridScanScanDelay, 1)
    assert.equal(premiumSettings.massageLabGridScanEnablePointerInteraction, true)
    assert.equal(premiumSettings.massageLabGridScanScanOnClick, true)
  })

  it("resets MassageLab Beams controls without premium background access", () => {
    const input = {
      backgroundId: "massage-lab-beams",
      massageLabBeamsPaletteMode: "harmony",
      massageLabBeamsPrimaryColor: "#ABCDEF",
      massageLabBeamsHarmony: "triad",
      massageLabBeamsLightColor: "#010203",
      massageLabBeamsBeamWidth: 3.2,
      massageLabBeamsBeamHeight: 18,
      massageLabBeamsBeamNumber: 18,
      massageLabBeamsSpeed: 3.5,
      massageLabBeamsNoiseIntensity: 2.4,
      massageLabBeamsScale: 0.42,
      massageLabBeamsRotation: 24,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    for (const key of [
      "massageLabBeamsPaletteMode",
      "massageLabBeamsPrimaryColor",
      "massageLabBeamsHarmony",
      "massageLabBeamsLightColor",
      "massageLabBeamsBeamWidth",
      "massageLabBeamsBeamHeight",
      "massageLabBeamsBeamNumber",
      "massageLabBeamsSpeed",
      "massageLabBeamsNoiseIntensity",
      "massageLabBeamsScale",
      "massageLabBeamsRotation",
    ]) {
      assert.equal(freeSettings[key], DEFAULT_CHIMER_SETTINGS[key])
    }

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "massage-lab-beams")
    assert.equal(premiumSettings.massageLabBeamsBeamWidth, 3.2)
    assert.equal(premiumSettings.massageLabBeamsBeamHeight, 18)
    assert.equal(premiumSettings.massageLabBeamsBeamNumber, 18)
    assert.equal(premiumSettings.massageLabBeamsSpeed, 3.5)
    assert.equal(premiumSettings.massageLabBeamsNoiseIntensity, 2.4)
    assert.equal(premiumSettings.massageLabBeamsScale, 0.42)
    assert.equal(premiumSettings.massageLabBeamsRotation, 24)
  })

  it("resets MassageLab Pixel Snow controls without premium background access", () => {
    const input = {
      backgroundId: "massage-lab-pixel-snow",
      massageLabPixelSnowPaletteMode: "harmony",
      massageLabPixelSnowPrimaryColor: "#ABCDEF",
      massageLabPixelSnowHarmony: "triad",
      massageLabPixelSnowColor: "#010203",
      massageLabPixelSnowFlakeSize: 0.04,
      massageLabPixelSnowMinFlakeSize: 2.5,
      massageLabPixelSnowPixelResolution: 320,
      massageLabPixelSnowSpeed: 2.5,
      massageLabPixelSnowDepthFade: 16,
      massageLabPixelSnowFarPlane: 36,
      massageLabPixelSnowBrightness: 2,
      massageLabPixelSnowGamma: 0.75,
      massageLabPixelSnowDensity: 0.6,
      massageLabPixelSnowVariant: "snowflake",
      massageLabPixelSnowDirection: 220,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    for (const key of [
      "massageLabPixelSnowPaletteMode",
      "massageLabPixelSnowPrimaryColor",
      "massageLabPixelSnowHarmony",
      "massageLabPixelSnowColor",
      "massageLabPixelSnowFlakeSize",
      "massageLabPixelSnowMinFlakeSize",
      "massageLabPixelSnowPixelResolution",
      "massageLabPixelSnowSpeed",
      "massageLabPixelSnowDepthFade",
      "massageLabPixelSnowFarPlane",
      "massageLabPixelSnowBrightness",
      "massageLabPixelSnowGamma",
      "massageLabPixelSnowDensity",
      "massageLabPixelSnowVariant",
      "massageLabPixelSnowDirection",
    ]) {
      assert.equal(freeSettings[key], DEFAULT_CHIMER_SETTINGS[key])
    }

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "massage-lab-pixel-snow")
    assert.equal(premiumSettings.massageLabPixelSnowFlakeSize, 0.04)
    assert.equal(premiumSettings.massageLabPixelSnowMinFlakeSize, 2.5)
    assert.equal(premiumSettings.massageLabPixelSnowPixelResolution, 320)
    assert.equal(premiumSettings.massageLabPixelSnowSpeed, 2.5)
    assert.equal(premiumSettings.massageLabPixelSnowDepthFade, 16)
    assert.equal(premiumSettings.massageLabPixelSnowFarPlane, 36)
    assert.equal(premiumSettings.massageLabPixelSnowBrightness, 2)
    assert.equal(premiumSettings.massageLabPixelSnowGamma, 0.75)
    assert.equal(premiumSettings.massageLabPixelSnowDensity, 0.6)
    assert.equal(premiumSettings.massageLabPixelSnowVariant, "snowflake")
    assert.equal(premiumSettings.massageLabPixelSnowDirection, 220)
  })

  it("resets MassageLab Lightning controls without premium background access", () => {
    const input = {
      backgroundId: "massage-lab-lightning",
      massageLabLightningPaletteMode: "harmony",
      massageLabLightningPrimaryColor: "#ABCDEF",
      massageLabLightningHarmony: "triad",
      massageLabLightningColor: "#010203",
      massageLabLightningXOffset: -0.5,
      massageLabLightningSpeed: 2.25,
      massageLabLightningIntensity: 3.5,
      massageLabLightningSize: 1.8,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    for (const key of [
      "massageLabLightningPaletteMode",
      "massageLabLightningPrimaryColor",
      "massageLabLightningHarmony",
      "massageLabLightningColor",
      "massageLabLightningXOffset",
      "massageLabLightningSpeed",
      "massageLabLightningIntensity",
      "massageLabLightningSize",
    ]) {
      assert.equal(freeSettings[key], DEFAULT_CHIMER_SETTINGS[key])
    }

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "massage-lab-lightning")
    assert.equal(premiumSettings.massageLabLightningXOffset, -0.5)
    assert.equal(premiumSettings.massageLabLightningSpeed, 2.25)
    assert.equal(premiumSettings.massageLabLightningIntensity, 3.5)
    assert.equal(premiumSettings.massageLabLightningSize, 1.8)
  })

  it("resets MassageLab Prismatic Burst controls without premium background access", () => {
    const input = {
      backgroundId: "massage-lab-prismatic-burst",
      massageLabPrismaticBurstPaletteMode: "harmony",
      massageLabPrismaticBurstPrimaryColor: "#ABCDEF",
      massageLabPrismaticBurstHarmony: "triad",
      massageLabPrismaticBurstColorOne: "#010203",
      massageLabPrismaticBurstColorTwo: "#AABBCC",
      massageLabPrismaticBurstColorThree: "#DDEEFF",
      massageLabPrismaticBurstColorFour: "#112233",
      massageLabPrismaticBurstIntensity: 3.25,
      massageLabPrismaticBurstSpeed: 1.75,
      massageLabPrismaticBurstAnimationType: "hover",
      massageLabPrismaticBurstDistort: 18,
      massageLabPrismaticBurstOffsetX: 240,
      massageLabPrismaticBurstOffsetY: -160,
      massageLabPrismaticBurstHoverDampness: 0.42,
      massageLabPrismaticBurstRayCount: 24,
      massageLabPrismaticBurstMixBlendMode: "screen",
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    for (const key of [
      "massageLabPrismaticBurstPaletteMode",
      "massageLabPrismaticBurstPrimaryColor",
      "massageLabPrismaticBurstHarmony",
      "massageLabPrismaticBurstColorOne",
      "massageLabPrismaticBurstColorTwo",
      "massageLabPrismaticBurstColorThree",
      "massageLabPrismaticBurstColorFour",
      "massageLabPrismaticBurstIntensity",
      "massageLabPrismaticBurstSpeed",
      "massageLabPrismaticBurstAnimationType",
      "massageLabPrismaticBurstDistort",
      "massageLabPrismaticBurstOffsetX",
      "massageLabPrismaticBurstOffsetY",
      "massageLabPrismaticBurstHoverDampness",
      "massageLabPrismaticBurstRayCount",
      "massageLabPrismaticBurstMixBlendMode",
    ]) {
      assert.equal(freeSettings[key], DEFAULT_CHIMER_SETTINGS[key])
    }

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "massage-lab-prismatic-burst")
    assert.equal(premiumSettings.massageLabPrismaticBurstIntensity, 3.25)
    assert.equal(premiumSettings.massageLabPrismaticBurstSpeed, 1.75)
    assert.equal(premiumSettings.massageLabPrismaticBurstAnimationType, "hover")
    assert.equal(premiumSettings.massageLabPrismaticBurstDistort, 18)
    assert.equal(premiumSettings.massageLabPrismaticBurstOffsetX, 240)
    assert.equal(premiumSettings.massageLabPrismaticBurstOffsetY, -160)
    assert.equal(premiumSettings.massageLabPrismaticBurstHoverDampness, 0.42)
    assert.equal(premiumSettings.massageLabPrismaticBurstRayCount, 24)
    assert.equal(premiumSettings.massageLabPrismaticBurstMixBlendMode, "screen")
  })

  it("resets MassageLab Galaxy controls without premium background access", () => {
    const input = {
      backgroundId: "massage-lab-galaxy",
      massageLabGalaxyPaletteMode: "harmony",
      massageLabGalaxyPrimaryColor: "#ABCDEF",
      massageLabGalaxyHarmony: "triad",
      massageLabGalaxyColor: "#010203",
      massageLabGalaxyHueShift: 310,
      massageLabGalaxyFocalX: 0.2,
      massageLabGalaxyFocalY: 0.8,
      massageLabGalaxyRotationDeg: 45,
      massageLabGalaxyStarSpeed: 1.25,
      massageLabGalaxyDensity: 1.6,
      massageLabGalaxySpeed: 1.75,
      massageLabGalaxyMouseInteraction: false,
      massageLabGalaxyGlowIntensity: 0.85,
      massageLabGalaxySaturation: 1.4,
      massageLabGalaxyMouseRepulsion: false,
      massageLabGalaxyRepulsionStrength: 3.25,
      massageLabGalaxyTwinkleIntensity: 0.72,
      massageLabGalaxyRotationSpeed: -0.25,
      massageLabGalaxyAutoCenterRepulsion: 1.5,
      massageLabGalaxyTransparent: false,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    for (const key of [
      "massageLabGalaxyPaletteMode",
      "massageLabGalaxyPrimaryColor",
      "massageLabGalaxyHarmony",
      "massageLabGalaxyColor",
      "massageLabGalaxyHueShift",
      "massageLabGalaxyFocalX",
      "massageLabGalaxyFocalY",
      "massageLabGalaxyRotationDeg",
      "massageLabGalaxyStarSpeed",
      "massageLabGalaxyDensity",
      "massageLabGalaxySpeed",
      "massageLabGalaxyMouseInteraction",
      "massageLabGalaxyGlowIntensity",
      "massageLabGalaxySaturation",
      "massageLabGalaxyMouseRepulsion",
      "massageLabGalaxyRepulsionStrength",
      "massageLabGalaxyTwinkleIntensity",
      "massageLabGalaxyRotationSpeed",
      "massageLabGalaxyAutoCenterRepulsion",
      "massageLabGalaxyTransparent",
    ]) {
      assert.equal(freeSettings[key], DEFAULT_CHIMER_SETTINGS[key])
    }

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "massage-lab-galaxy")
    assert.equal(premiumSettings.massageLabGalaxyHueShift, 310)
    assert.equal(premiumSettings.massageLabGalaxyFocalX, 0.2)
    assert.equal(premiumSettings.massageLabGalaxyFocalY, 0.8)
    assert.equal(premiumSettings.massageLabGalaxyRotationDeg, 45)
    assert.equal(premiumSettings.massageLabGalaxyStarSpeed, 1.25)
    assert.equal(premiumSettings.massageLabGalaxyDensity, 1.6)
    assert.equal(premiumSettings.massageLabGalaxySpeed, 1.75)
    assert.equal(premiumSettings.massageLabGalaxyMouseInteraction, false)
    assert.equal(premiumSettings.massageLabGalaxyGlowIntensity, 0.85)
    assert.equal(premiumSettings.massageLabGalaxySaturation, 1.4)
    assert.equal(premiumSettings.massageLabGalaxyMouseRepulsion, false)
    assert.equal(premiumSettings.massageLabGalaxyRepulsionStrength, 3.25)
    assert.equal(premiumSettings.massageLabGalaxyTwinkleIntensity, 0.72)
    assert.equal(premiumSettings.massageLabGalaxyRotationSpeed, -0.25)
    assert.equal(premiumSettings.massageLabGalaxyAutoCenterRepulsion, 1.5)
    assert.equal(premiumSettings.massageLabGalaxyTransparent, false)
  })

  it("resets MassageLab Dither controls without premium background access", () => {
    const input = {
      backgroundId: "massage-lab-dither",
      massageLabDitherPaletteMode: "harmony",
      massageLabDitherPrimaryColor: "#ABCDEF",
      massageLabDitherHarmony: "triad",
      massageLabDitherColor: "#010203",
      massageLabDitherWaveSpeed: 0.22,
      massageLabDitherWaveFrequency: 5.5,
      massageLabDitherWaveAmplitude: 0.62,
      massageLabDitherColorNum: 9,
      massageLabDitherPixelSize: 8,
      massageLabDitherMouseInteraction: false,
      massageLabDitherMouseRadius: 1.75,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    for (const key of [
      "massageLabDitherPaletteMode",
      "massageLabDitherPrimaryColor",
      "massageLabDitherHarmony",
      "massageLabDitherColor",
      "massageLabDitherWaveSpeed",
      "massageLabDitherWaveFrequency",
      "massageLabDitherWaveAmplitude",
      "massageLabDitherColorNum",
      "massageLabDitherPixelSize",
      "massageLabDitherMouseInteraction",
      "massageLabDitherMouseRadius",
    ]) {
      assert.equal(freeSettings[key], DEFAULT_CHIMER_SETTINGS[key])
    }

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "massage-lab-dither")
    assert.equal(premiumSettings.massageLabDitherWaveSpeed, 0.22)
    assert.equal(premiumSettings.massageLabDitherWaveFrequency, 5.5)
    assert.equal(premiumSettings.massageLabDitherWaveAmplitude, 0.62)
    assert.equal(premiumSettings.massageLabDitherColorNum, 9)
    assert.equal(premiumSettings.massageLabDitherPixelSize, 8)
    assert.equal(premiumSettings.massageLabDitherMouseInteraction, false)
    assert.equal(premiumSettings.massageLabDitherMouseRadius, 1.75)
  })

  it("resets MassageLab Faulty Terminal controls without premium background access", () => {
    const input = {
      backgroundId: "massage-lab-faulty-terminal",
      massageLabFaultyTerminalPaletteMode: "harmony",
      massageLabFaultyTerminalPrimaryColor: "#ABCDEF",
      massageLabFaultyTerminalHarmony: "triad",
      massageLabFaultyTerminalTint: "#010203",
      massageLabFaultyTerminalScale: 2.5,
      massageLabFaultyTerminalGridMulX: 3.5,
      massageLabFaultyTerminalGridMulY: 1.75,
      massageLabFaultyTerminalDigitSize: 2.25,
      massageLabFaultyTerminalTimeScale: 0.8,
      massageLabFaultyTerminalScanlineIntensity: 0.75,
      massageLabFaultyTerminalGlitchAmount: 1.5,
      massageLabFaultyTerminalFlickerAmount: 0.65,
      massageLabFaultyTerminalNoiseAmp: 0.45,
      massageLabFaultyTerminalChromaticAberration: 4.5,
      massageLabFaultyTerminalDither: 64,
      massageLabFaultyTerminalCurvature: 0.35,
      massageLabFaultyTerminalMouseReact: false,
      massageLabFaultyTerminalMouseStrength: 0.9,
      massageLabFaultyTerminalPageLoadAnimation: false,
      massageLabFaultyTerminalBrightness: 1.8,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    for (const key of [
      "massageLabFaultyTerminalPaletteMode",
      "massageLabFaultyTerminalPrimaryColor",
      "massageLabFaultyTerminalHarmony",
      "massageLabFaultyTerminalTint",
      "massageLabFaultyTerminalScale",
      "massageLabFaultyTerminalGridMulX",
      "massageLabFaultyTerminalGridMulY",
      "massageLabFaultyTerminalDigitSize",
      "massageLabFaultyTerminalTimeScale",
      "massageLabFaultyTerminalScanlineIntensity",
      "massageLabFaultyTerminalGlitchAmount",
      "massageLabFaultyTerminalFlickerAmount",
      "massageLabFaultyTerminalNoiseAmp",
      "massageLabFaultyTerminalChromaticAberration",
      "massageLabFaultyTerminalDither",
      "massageLabFaultyTerminalCurvature",
      "massageLabFaultyTerminalMouseReact",
      "massageLabFaultyTerminalMouseStrength",
      "massageLabFaultyTerminalPageLoadAnimation",
      "massageLabFaultyTerminalBrightness",
    ]) {
      assert.equal(freeSettings[key], DEFAULT_CHIMER_SETTINGS[key])
    }

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "massage-lab-faulty-terminal")
    assert.equal(premiumSettings.massageLabFaultyTerminalScale, 2.5)
    assert.equal(premiumSettings.massageLabFaultyTerminalGridMulX, 3.5)
    assert.equal(premiumSettings.massageLabFaultyTerminalGridMulY, 1.75)
    assert.equal(premiumSettings.massageLabFaultyTerminalDigitSize, 2.25)
    assert.equal(premiumSettings.massageLabFaultyTerminalTimeScale, 0.8)
    assert.equal(premiumSettings.massageLabFaultyTerminalScanlineIntensity, 0.75)
    assert.equal(premiumSettings.massageLabFaultyTerminalGlitchAmount, 1.5)
    assert.equal(premiumSettings.massageLabFaultyTerminalFlickerAmount, 0.65)
    assert.equal(premiumSettings.massageLabFaultyTerminalNoiseAmp, 0.45)
    assert.equal(premiumSettings.massageLabFaultyTerminalChromaticAberration, 4.5)
    assert.equal(premiumSettings.massageLabFaultyTerminalDither, 64)
    assert.equal(premiumSettings.massageLabFaultyTerminalCurvature, 0.35)
    assert.equal(premiumSettings.massageLabFaultyTerminalMouseReact, false)
    assert.equal(premiumSettings.massageLabFaultyTerminalMouseStrength, 0.9)
    assert.equal(premiumSettings.massageLabFaultyTerminalPageLoadAnimation, false)
    assert.equal(premiumSettings.massageLabFaultyTerminalBrightness, 1.8)
  })

  it("resets MassageLab Ripple Grid controls without premium background access", () => {
    const input = {
      backgroundId: "massage-lab-ripple-grid",
      massageLabRippleGridPaletteMode: "harmony",
      massageLabRippleGridPrimaryColor: "#ABCDEF",
      massageLabRippleGridHarmony: "triad",
      massageLabRippleGridColor: "#010203",
      massageLabRippleGridRippleIntensity: 0.12,
      massageLabRippleGridGridSize: 14,
      massageLabRippleGridGridThickness: 9,
      massageLabRippleGridFadeDistance: 2.25,
      massageLabRippleGridVignetteStrength: 2.75,
      massageLabRippleGridGlowIntensity: 0.42,
      massageLabRippleGridOpacity: 0.84,
      massageLabRippleGridGridRotation: 32,
      massageLabRippleGridMouseInteraction: false,
      massageLabRippleGridMouseInteractionRadius: 1.7,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    for (const key of [
      "massageLabRippleGridPaletteMode",
      "massageLabRippleGridPrimaryColor",
      "massageLabRippleGridHarmony",
      "massageLabRippleGridColor",
      "massageLabRippleGridRippleIntensity",
      "massageLabRippleGridGridSize",
      "massageLabRippleGridGridThickness",
      "massageLabRippleGridFadeDistance",
      "massageLabRippleGridVignetteStrength",
      "massageLabRippleGridGlowIntensity",
      "massageLabRippleGridOpacity",
      "massageLabRippleGridGridRotation",
      "massageLabRippleGridMouseInteraction",
      "massageLabRippleGridMouseInteractionRadius",
    ]) {
      assert.equal(freeSettings[key], DEFAULT_CHIMER_SETTINGS[key])
    }

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "massage-lab-ripple-grid")
    assert.equal(premiumSettings.massageLabRippleGridRippleIntensity, 0.12)
    assert.equal(premiumSettings.massageLabRippleGridGridSize, 14)
    assert.equal(premiumSettings.massageLabRippleGridGridThickness, 9)
    assert.equal(premiumSettings.massageLabRippleGridFadeDistance, 2.25)
    assert.equal(premiumSettings.massageLabRippleGridVignetteStrength, 2.75)
    assert.equal(premiumSettings.massageLabRippleGridGlowIntensity, 0.42)
    assert.equal(premiumSettings.massageLabRippleGridOpacity, 0.84)
    assert.equal(premiumSettings.massageLabRippleGridGridRotation, 32)
    assert.equal(premiumSettings.massageLabRippleGridMouseInteraction, false)
    assert.equal(premiumSettings.massageLabRippleGridMouseInteractionRadius, 1.7)
  })

  it("resets MassageLab Dot Field controls without premium background access", () => {
    const input = {
      backgroundId: "massage-lab-dot-field",
      massageLabDotFieldPaletteMode: "harmony",
      massageLabDotFieldPrimaryColor: "#ABCDEF",
      massageLabDotFieldHarmony: "triad",
      massageLabDotFieldGradientFromColor: "#010203",
      massageLabDotFieldGradientToColor: "#040506",
      massageLabDotFieldGlowColor: "#070809",
      massageLabDotFieldDotRadius: 2.4,
      massageLabDotFieldDotSpacing: 18,
      massageLabDotFieldCursorRadius: 420,
      massageLabDotFieldCursorForce: 0.24,
      massageLabDotFieldBulgeOnly: false,
      massageLabDotFieldBulgeStrength: 72,
      massageLabDotFieldGlowRadius: 210,
      massageLabDotFieldSparkle: true,
      massageLabDotFieldWaveAmplitude: 8,
      massageLabDotFieldCursorInteraction: false,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    for (const key of [
      "massageLabDotFieldPaletteMode",
      "massageLabDotFieldPrimaryColor",
      "massageLabDotFieldHarmony",
      "massageLabDotFieldGradientFromColor",
      "massageLabDotFieldGradientToColor",
      "massageLabDotFieldGlowColor",
      "massageLabDotFieldDotRadius",
      "massageLabDotFieldDotSpacing",
      "massageLabDotFieldCursorRadius",
      "massageLabDotFieldCursorForce",
      "massageLabDotFieldBulgeOnly",
      "massageLabDotFieldBulgeStrength",
      "massageLabDotFieldGlowRadius",
      "massageLabDotFieldSparkle",
      "massageLabDotFieldWaveAmplitude",
      "massageLabDotFieldCursorInteraction",
    ]) {
      assert.equal(freeSettings[key], DEFAULT_CHIMER_SETTINGS[key])
    }

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "massage-lab-dot-field")
    assert.equal(premiumSettings.massageLabDotFieldDotRadius, 2.4)
    assert.equal(premiumSettings.massageLabDotFieldDotSpacing, 18)
    assert.equal(premiumSettings.massageLabDotFieldCursorRadius, 420)
    assert.equal(premiumSettings.massageLabDotFieldCursorForce, 0.24)
    assert.equal(premiumSettings.massageLabDotFieldBulgeOnly, false)
    assert.equal(premiumSettings.massageLabDotFieldBulgeStrength, 72)
    assert.equal(premiumSettings.massageLabDotFieldGlowRadius, 210)
    assert.equal(premiumSettings.massageLabDotFieldSparkle, true)
    assert.equal(premiumSettings.massageLabDotFieldWaveAmplitude, 8)
    assert.equal(premiumSettings.massageLabDotFieldCursorInteraction, false)
  })

  it("resets MassageLab Dot Grid controls without premium background access", () => {
    const input = {
      backgroundId: "massage-lab-dot-grid",
      massageLabDotGridPaletteMode: "harmony",
      massageLabDotGridPrimaryColor: "#ABCDEF",
      massageLabDotGridHarmony: "triad",
      massageLabDotGridBaseColor: "#010203",
      massageLabDotGridActiveColor: "#040506",
      massageLabDotGridDotSize: 18,
      massageLabDotGridGap: 24,
      massageLabDotGridProximity: 220,
      massageLabDotGridSpeedTrigger: 80,
      massageLabDotGridShockRadius: 280,
      massageLabDotGridShockStrength: 6,
      massageLabDotGridMaxSpeed: 4200,
      massageLabDotGridResistance: 680,
      massageLabDotGridReturnDuration: 1.2,
      massageLabDotGridCursorInteraction: false,
      massageLabDotGridSimulateCursorInteraction: true,
      massageLabDotGridSimulationSpeed: 1.6,
      massageLabDotGridClickShock: false,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    for (const key of [
      "massageLabDotGridPaletteMode",
      "massageLabDotGridPrimaryColor",
      "massageLabDotGridHarmony",
      "massageLabDotGridBaseColor",
      "massageLabDotGridActiveColor",
      "massageLabDotGridDotSize",
      "massageLabDotGridGap",
      "massageLabDotGridProximity",
      "massageLabDotGridSpeedTrigger",
      "massageLabDotGridShockRadius",
      "massageLabDotGridShockStrength",
      "massageLabDotGridMaxSpeed",
      "massageLabDotGridResistance",
      "massageLabDotGridReturnDuration",
      "massageLabDotGridCursorInteraction",
      "massageLabDotGridSimulateCursorInteraction",
      "massageLabDotGridSimulationSpeed",
      "massageLabDotGridClickShock",
    ]) {
      assert.equal(freeSettings[key], DEFAULT_CHIMER_SETTINGS[key])
    }

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "massage-lab-dot-grid")
    assert.equal(premiumSettings.massageLabDotGridDotSize, 18)
    assert.equal(premiumSettings.massageLabDotGridGap, 24)
    assert.equal(premiumSettings.massageLabDotGridProximity, 220)
    assert.equal(premiumSettings.massageLabDotGridSpeedTrigger, 80)
    assert.equal(premiumSettings.massageLabDotGridShockRadius, 280)
    assert.equal(premiumSettings.massageLabDotGridShockStrength, 6)
    assert.equal(premiumSettings.massageLabDotGridMaxSpeed, 4200)
    assert.equal(premiumSettings.massageLabDotGridResistance, 680)
    assert.equal(premiumSettings.massageLabDotGridReturnDuration, 1.2)
    assert.equal(premiumSettings.massageLabDotGridCursorInteraction, false)
    assert.equal(premiumSettings.massageLabDotGridSimulateCursorInteraction, true)
    assert.equal(premiumSettings.massageLabDotGridSimulationSpeed, 1.6)
    assert.equal(premiumSettings.massageLabDotGridClickShock, false)
  })

  it("resets MassageLab Threads controls without premium background access", () => {
    const input = {
      backgroundId: "massage-lab-threads",
      massageLabThreadsPaletteMode: "harmony",
      massageLabThreadsPrimaryColor: "#ABCDEF",
      massageLabThreadsHarmony: "triad",
      massageLabThreadsColor: "#010203",
      massageLabThreadsAmplitude: 1.8,
      massageLabThreadsDistance: 0.35,
      massageLabThreadsEnableMouseInteraction: true,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    for (const key of [
      "massageLabThreadsPaletteMode",
      "massageLabThreadsPrimaryColor",
      "massageLabThreadsHarmony",
      "massageLabThreadsColor",
      "massageLabThreadsAmplitude",
      "massageLabThreadsDistance",
      "massageLabThreadsEnableMouseInteraction",
    ]) {
      assert.equal(freeSettings[key], DEFAULT_CHIMER_SETTINGS[key])
    }

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "massage-lab-threads")
    assert.equal(premiumSettings.massageLabThreadsAmplitude, 1.8)
    assert.equal(premiumSettings.massageLabThreadsDistance, 0.35)
    assert.equal(premiumSettings.massageLabThreadsEnableMouseInteraction, true)
  })

  it("resets MassageLab Iridescence controls without premium background access", () => {
    const input = {
      backgroundId: "massage-lab-iridescence",
      massageLabIridescencePaletteMode: "harmony",
      massageLabIridescencePrimaryColor: "#ABCDEF",
      massageLabIridescenceHarmony: "triad",
      massageLabIridescenceColor: "#010203",
      massageLabIridescenceSpeed: 2.4,
      massageLabIridescenceAmplitude: 0.85,
      massageLabIridescenceMouseReact: false,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    for (const key of [
      "massageLabIridescencePaletteMode",
      "massageLabIridescencePrimaryColor",
      "massageLabIridescenceHarmony",
      "massageLabIridescenceColor",
      "massageLabIridescenceSpeed",
      "massageLabIridescenceAmplitude",
      "massageLabIridescenceMouseReact",
    ]) {
      assert.equal(freeSettings[key], DEFAULT_CHIMER_SETTINGS[key])
    }

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "massage-lab-iridescence")
    assert.equal(premiumSettings.massageLabIridescenceSpeed, 2.4)
    assert.equal(premiumSettings.massageLabIridescenceAmplitude, 0.85)
    assert.equal(premiumSettings.massageLabIridescenceMouseReact, false)
  })

  it("resets MassageLab Waves controls without premium background access", () => {
    const input = {
      backgroundId: "massage-lab-waves",
      massageLabWavesPaletteMode: "harmony",
      massageLabWavesPrimaryColor: "#ABCDEF",
      massageLabWavesHarmony: "triad",
      massageLabWavesLineColor: "#010203",
      massageLabWavesBackgroundColor: "#040506",
      massageLabWavesTransparentBackground: false,
      massageLabWavesSpeedX: 0.03,
      massageLabWavesSpeedY: 0.02,
      massageLabWavesAmplitudeX: 72,
      massageLabWavesAmplitudeY: 44,
      massageLabWavesGapX: 18,
      massageLabWavesGapY: 52,
      massageLabWavesFriction: 0.88,
      massageLabWavesTension: 0.018,
      massageLabWavesMaxCursorMove: 180,
      massageLabWavesCursorInteraction: false,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    for (const key of [
      "massageLabWavesPaletteMode",
      "massageLabWavesPrimaryColor",
      "massageLabWavesHarmony",
      "massageLabWavesLineColor",
      "massageLabWavesBackgroundColor",
      "massageLabWavesTransparentBackground",
      "massageLabWavesSpeedX",
      "massageLabWavesSpeedY",
      "massageLabWavesAmplitudeX",
      "massageLabWavesAmplitudeY",
      "massageLabWavesGapX",
      "massageLabWavesGapY",
      "massageLabWavesFriction",
      "massageLabWavesTension",
      "massageLabWavesMaxCursorMove",
      "massageLabWavesCursorInteraction",
    ]) {
      assert.equal(freeSettings[key], DEFAULT_CHIMER_SETTINGS[key])
    }

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "massage-lab-waves")
    assert.equal(premiumSettings.massageLabWavesTransparentBackground, false)
    assert.equal(premiumSettings.massageLabWavesSpeedX, 0.03)
    assert.equal(premiumSettings.massageLabWavesSpeedY, 0.02)
    assert.equal(premiumSettings.massageLabWavesAmplitudeX, 72)
    assert.equal(premiumSettings.massageLabWavesAmplitudeY, 44)
    assert.equal(premiumSettings.massageLabWavesGapX, 18)
    assert.equal(premiumSettings.massageLabWavesGapY, 52)
    assert.equal(premiumSettings.massageLabWavesFriction, 0.88)
    assert.equal(premiumSettings.massageLabWavesTension, 0.018)
    assert.equal(premiumSettings.massageLabWavesMaxCursorMove, 180)
    assert.equal(premiumSettings.massageLabWavesCursorInteraction, false)
  })

  it("resets MassageLab Grid Distortion controls without premium background access", () => {
    const input = {
      backgroundId: "massage-lab-grid-distortion",
      massageLabGridDistortionPaletteMode: "harmony",
      massageLabGridDistortionPrimaryColor: "#ABCDEF",
      massageLabGridDistortionHarmony: "triad",
      massageLabGridDistortionColorOne: "#010203",
      massageLabGridDistortionColorTwo: "#040506",
      massageLabGridDistortionColorThree: "#070809",
      massageLabGridDistortionGrid: 30,
      massageLabGridDistortionMouse: 0.32,
      massageLabGridDistortionStrength: 0.48,
      massageLabGridDistortionRelaxation: 0.83,
      massageLabGridDistortionCursorInteraction: false,
      massageLabGridDistortionSimulateCursorInteraction: true,
      massageLabGridDistortionSimulationSpeed: 1.6,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    for (const key of [
      "massageLabGridDistortionPaletteMode",
      "massageLabGridDistortionPrimaryColor",
      "massageLabGridDistortionHarmony",
      "massageLabGridDistortionColorOne",
      "massageLabGridDistortionColorTwo",
      "massageLabGridDistortionColorThree",
      "massageLabGridDistortionGrid",
      "massageLabGridDistortionMouse",
      "massageLabGridDistortionStrength",
      "massageLabGridDistortionRelaxation",
      "massageLabGridDistortionCursorInteraction",
      "massageLabGridDistortionSimulateCursorInteraction",
      "massageLabGridDistortionSimulationSpeed",
    ]) {
      assert.equal(freeSettings[key], DEFAULT_CHIMER_SETTINGS[key])
    }

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "massage-lab-grid-distortion")
    assert.equal(premiumSettings.massageLabGridDistortionGrid, 30)
    assert.equal(premiumSettings.massageLabGridDistortionMouse, 0.32)
    assert.equal(premiumSettings.massageLabGridDistortionStrength, 0.48)
    assert.equal(premiumSettings.massageLabGridDistortionRelaxation, 0.83)
    assert.equal(premiumSettings.massageLabGridDistortionCursorInteraction, false)
    assert.equal(premiumSettings.massageLabGridDistortionSimulateCursorInteraction, true)
    assert.equal(premiumSettings.massageLabGridDistortionSimulationSpeed, 1.6)
  })

  it("resets the latest MassageLab background controls without premium background access", () => {
    const expected = {
      massageLabOrbHoverIntensity: 0.55,
      massageLabOrbRotateOnHover: false,
      massageLabOrbForceHoverState: true,
      massageLabOrbCursorInteraction: false,
      massageLabLetterGlitchGlitchSpeed: 120,
      massageLabLetterGlitchCenterVignette: true,
      massageLabLetterGlitchOuterVignette: false,
      massageLabLetterGlitchSmooth: false,
      massageLabLetterGlitchCharacters: "ABCDE12345",
      massageLabGridMotionMaxMoveAmount: 420,
      massageLabGridMotionBaseDuration: 1.2,
      massageLabGridMotionCursorInteraction: false,
      massageLabShapeGridDirection: "diagonal",
      massageLabShapeGridSpeed: 1.5,
      massageLabShapeGridSpeedVersion: 1,
      massageLabShapeGridSquareSize: 48,
      massageLabShapeGridShape: "hexagon",
      massageLabShapeGridHoverTrailAmount: 4,
      massageLabShapeGridCursorInteraction: false,
      massageLabLiquidChromeSpeed: 0.8,
      massageLabLiquidChromeAmplitude: 0.6,
      massageLabLiquidChromeFrequencyX: 5,
      massageLabLiquidChromeFrequencyY: 6,
      massageLabLiquidChromeInteractive: false,
      massageLabBalatroSpinRotation: 3,
      massageLabBalatroSpinSpeed: 9,
      massageLabBalatroOffsetX: -0.2,
      massageLabBalatroOffsetY: 0.3,
      massageLabBalatroContrast: 4,
      massageLabBalatroLighting: 0.7,
      massageLabBalatroSpinAmount: 0.4,
      massageLabBalatroPixelFilter: 900,
      massageLabBalatroSpinEase: 1.5,
      massageLabBalatroIsRotate: true,
      massageLabBalatroMouseInteraction: false,
    }
    const input = {
      backgroundId: "massage-lab-balatro",
      ...expected,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    for (const key of Object.keys(expected)) {
      assert.equal(freeSettings[key], DEFAULT_CHIMER_SETTINGS[key])
    }

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "massage-lab-balatro")
    for (const [key, value] of Object.entries(expected)) {
      assert.equal(premiumSettings[key], value)
    }
  })

  it("resets MassageLab 3D Globe controls without premium background access", () => {
    const input = {
      backgroundId: "massage-lab-3d-globe",
      massageLab3DGlobeViewStyle: "graphic",
      massageLab3DGlobeBackgroundColor: "#010203",
      massageLab3DGlobeGlobeColor: "#123456",
      massageLab3DGlobeGraphicMapColor: "#E6E6E6",
      massageLab3DGlobeGraphicGlowColor: "#F8FAFC",
      massageLab3DGlobeGraphicMarkerColor: "#FB6415",
      massageLab3DGlobeGraphicMapSamples: 9000,
      massageLab3DGlobeAutoRotateSpeed: 1.2,
      massageLab3DGlobeReverseSpin: false,
      massageLab3DGlobeScale: 0.72,
      massageLab3DGlobeBumpScale: 1.8,
      massageLab3DGlobeAmbientIntensity: 1.1,
      massageLab3DGlobePointLightIntensity: 2.4,
      massageLab3DGlobeLightingMode: "sun",
      massageLab3DGlobeEnablePan: true,
      massageLab3DGlobePanX: -24,
      massageLab3DGlobePanY: 18,
      massageLab3DGlobeShowTilt: false,
      massageLab3DGlobeShowAtmosphere: true,
      massageLab3DGlobeAtmosphereColor: "#AABBCC",
      massageLab3DGlobeAtmosphereIntensity: 1.4,
      massageLab3DGlobeAtmosphereBlur: 3.5,
      massageLab3DGlobeShowWireframe: true,
      massageLab3DGlobeWireframeColor: "#DDEEFF",
      massageLab3DGlobeMarkerEnabled: true,
      massageLab3DGlobeMarkerLat: 37.7749,
      massageLab3DGlobeMarkerLng: -122.4194,
      massageLab3DGlobeMarkerLabel: "San Francisco",
      massageLab3DGlobeMarkerIcon: "star",
      massageLab3DGlobeMarkerSize: 0.12,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    assert.equal(freeSettings.massageLab3DGlobeViewStyle, DEFAULT_CHIMER_SETTINGS.massageLab3DGlobeViewStyle)
    assert.equal(freeSettings.massageLab3DGlobeGraphicMapSamples, DEFAULT_CHIMER_SETTINGS.massageLab3DGlobeGraphicMapSamples)
    assert.equal(freeSettings.massageLab3DGlobeAutoRotateSpeed, DEFAULT_CHIMER_SETTINGS.massageLab3DGlobeAutoRotateSpeed)
    assert.equal(freeSettings.massageLab3DGlobeReverseSpin, DEFAULT_CHIMER_SETTINGS.massageLab3DGlobeReverseSpin)
    assert.equal(freeSettings.massageLab3DGlobeScale, DEFAULT_CHIMER_SETTINGS.massageLab3DGlobeScale)
    assert.equal(freeSettings.massageLab3DGlobeBumpScale, DEFAULT_CHIMER_SETTINGS.massageLab3DGlobeBumpScale)
    assert.equal(freeSettings.massageLab3DGlobeAmbientIntensity, DEFAULT_CHIMER_SETTINGS.massageLab3DGlobeAmbientIntensity)
    assert.equal(freeSettings.massageLab3DGlobePointLightIntensity, DEFAULT_CHIMER_SETTINGS.massageLab3DGlobePointLightIntensity)
    assert.equal(freeSettings.massageLab3DGlobeLightingMode, DEFAULT_CHIMER_SETTINGS.massageLab3DGlobeLightingMode)
    assert.equal(freeSettings.massageLab3DGlobeEnablePan, DEFAULT_CHIMER_SETTINGS.massageLab3DGlobeEnablePan)
    assert.equal(freeSettings.massageLab3DGlobePanX, DEFAULT_CHIMER_SETTINGS.massageLab3DGlobePanX)
    assert.equal(freeSettings.massageLab3DGlobePanY, DEFAULT_CHIMER_SETTINGS.massageLab3DGlobePanY)
    assert.equal(freeSettings.massageLab3DGlobeShowTilt, DEFAULT_CHIMER_SETTINGS.massageLab3DGlobeShowTilt)
    assert.equal(freeSettings.massageLab3DGlobeShowAtmosphere, DEFAULT_CHIMER_SETTINGS.massageLab3DGlobeShowAtmosphere)
    assert.equal(freeSettings.massageLab3DGlobeAtmosphereIntensity, DEFAULT_CHIMER_SETTINGS.massageLab3DGlobeAtmosphereIntensity)
    assert.equal(freeSettings.massageLab3DGlobeAtmosphereBlur, DEFAULT_CHIMER_SETTINGS.massageLab3DGlobeAtmosphereBlur)
    assert.equal(freeSettings.massageLab3DGlobeShowWireframe, DEFAULT_CHIMER_SETTINGS.massageLab3DGlobeShowWireframe)
    assert.equal(freeSettings.massageLab3DGlobeMarkerEnabled, DEFAULT_CHIMER_SETTINGS.massageLab3DGlobeMarkerEnabled)
    assert.equal(freeSettings.massageLab3DGlobeMarkerLat, DEFAULT_CHIMER_SETTINGS.massageLab3DGlobeMarkerLat)
    assert.equal(freeSettings.massageLab3DGlobeMarkerLng, DEFAULT_CHIMER_SETTINGS.massageLab3DGlobeMarkerLng)
    assert.equal(freeSettings.massageLab3DGlobeMarkerLabel, DEFAULT_CHIMER_SETTINGS.massageLab3DGlobeMarkerLabel)
    assert.equal(freeSettings.massageLab3DGlobeMarkerIcon, DEFAULT_CHIMER_SETTINGS.massageLab3DGlobeMarkerIcon)
    assert.equal(freeSettings.massageLab3DGlobeMarkerSize, DEFAULT_CHIMER_SETTINGS.massageLab3DGlobeMarkerSize)

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "massage-lab-3d-globe")
    assert.equal(premiumSettings.massageLab3DGlobeViewStyle, "graphic")
    assert.equal(premiumSettings.massageLab3DGlobeGraphicMapSamples, 9000)
    assert.equal(premiumSettings.massageLab3DGlobeAutoRotateSpeed, 1.2)
    assert.equal(premiumSettings.massageLab3DGlobeReverseSpin, true)
    assert.equal(premiumSettings.massageLab3DGlobeScale, 0.72)
    assert.equal(premiumSettings.massageLab3DGlobeBumpScale, 1.8)
    assert.equal(premiumSettings.massageLab3DGlobeAmbientIntensity, 1.1)
    assert.equal(premiumSettings.massageLab3DGlobePointLightIntensity, 2.4)
    assert.equal(premiumSettings.massageLab3DGlobeLightingMode, "sun")
    assert.equal(premiumSettings.massageLab3DGlobeEnablePan, true)
    assert.equal(premiumSettings.massageLab3DGlobePanX, -24)
    assert.equal(premiumSettings.massageLab3DGlobePanY, 18)
    assert.equal(premiumSettings.massageLab3DGlobeShowTilt, true)
    assert.equal(premiumSettings.massageLab3DGlobeShowAtmosphere, true)
    assert.equal(premiumSettings.massageLab3DGlobeAtmosphereIntensity, 1.4)
    assert.equal(premiumSettings.massageLab3DGlobeAtmosphereBlur, 3.5)
    assert.equal(premiumSettings.massageLab3DGlobeShowWireframe, true)
    assert.equal(premiumSettings.massageLab3DGlobeMarkerEnabled, true)
    assert.equal(premiumSettings.massageLab3DGlobeMarkerLat, 37.7749)
    assert.equal(premiumSettings.massageLab3DGlobeMarkerLng, -122.4194)
    assert.equal(premiumSettings.massageLab3DGlobeMarkerLabel, "San Francisco")
    assert.equal(premiumSettings.massageLab3DGlobeMarkerIcon, "star")
    assert.equal(premiumSettings.massageLab3DGlobeMarkerSize, 0.12)
  })

  it("resets MassageLab Retro Grid controls without premium background access", () => {
    const input = {
      backgroundId: "massage-lab-retro-grid",
      massageLabRetroGridBackgroundColor: "#010203",
      massageLabRetroGridLightLineColor: "#AABBCC",
      massageLabRetroGridDarkLineColor: "#112233",
      massageLabRetroGridAngle: 72,
      massageLabRetroGridCellSize: 88,
      massageLabRetroGridOpacity: 0.72,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    assert.equal(freeSettings.massageLabRetroGridAngle, DEFAULT_CHIMER_SETTINGS.massageLabRetroGridAngle)
    assert.equal(freeSettings.massageLabRetroGridCellSize, DEFAULT_CHIMER_SETTINGS.massageLabRetroGridCellSize)
    assert.equal(freeSettings.massageLabRetroGridOpacity, DEFAULT_CHIMER_SETTINGS.massageLabRetroGridOpacity)

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "massage-lab-retro-grid")
    assert.equal(premiumSettings.massageLabRetroGridAngle, 72)
    assert.equal(premiumSettings.massageLabRetroGridCellSize, 88)
    assert.equal(premiumSettings.massageLabRetroGridOpacity, 0.72)
  })

  it("resets MassageLab Aerial Rays controls without premium background access", () => {
    const input = {
      backgroundId: "massage-lab-aerial-rays",
      massageLabAerialRaysBackgroundColor: "#010203",
      massageLabAerialRaysColor: "#A0D2FF",
      massageLabAerialRaysCount: 12,
      massageLabAerialRaysBlur: 48,
      massageLabAerialRaysSpeed: 18,
      massageLabAerialRaysLength: 96,
      massageLabAerialRaysOpacity: 0.82,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    assert.equal(freeSettings.massageLabAerialRaysCount, DEFAULT_CHIMER_SETTINGS.massageLabAerialRaysCount)
    assert.equal(freeSettings.massageLabAerialRaysBlur, DEFAULT_CHIMER_SETTINGS.massageLabAerialRaysBlur)
    assert.equal(freeSettings.massageLabAerialRaysSpeed, DEFAULT_CHIMER_SETTINGS.massageLabAerialRaysSpeed)
    assert.equal(freeSettings.massageLabAerialRaysLength, DEFAULT_CHIMER_SETTINGS.massageLabAerialRaysLength)
    assert.equal(freeSettings.massageLabAerialRaysOpacity, DEFAULT_CHIMER_SETTINGS.massageLabAerialRaysOpacity)

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "massage-lab-aerial-rays")
    assert.equal(premiumSettings.massageLabAerialRaysCount, 12)
    assert.equal(premiumSettings.massageLabAerialRaysBlur, 48)
    assert.equal(premiumSettings.massageLabAerialRaysSpeed, 18)
    assert.equal(premiumSettings.massageLabAerialRaysLength, 96)
    assert.equal(premiumSettings.massageLabAerialRaysOpacity, 0.82)
  })

  it("resets MassageLab Aurora Field controls without premium background access", () => {
    const input = {
      backgroundId: "massage-lab-aurora",
      massageLabAuroraSpeed: 1.75,
      massageLabAuroraIntensity: 0.85,
      massageLabAuroraBlur: 24,
      massageLabAuroraReach: 92,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])
    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    assert.equal(freeSettings.massageLabAuroraSpeed, DEFAULT_CHIMER_SETTINGS.massageLabAuroraSpeed)
    assert.equal(freeSettings.massageLabAuroraIntensity, DEFAULT_CHIMER_SETTINGS.massageLabAuroraIntensity)
    assert.equal(freeSettings.massageLabAuroraBlur, DEFAULT_CHIMER_SETTINGS.massageLabAuroraBlur)
    assert.equal(freeSettings.massageLabAuroraReach, DEFAULT_CHIMER_SETTINGS.massageLabAuroraReach)

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])
    assert.equal(premiumSettings.backgroundId, "massage-lab-aurora")
    assert.equal(premiumSettings.massageLabAuroraSpeed, 1.75)
    assert.equal(premiumSettings.massageLabAuroraIntensity, 0.85)
    assert.equal(premiumSettings.massageLabAuroraBlur, 24)
    assert.equal(premiumSettings.massageLabAuroraReach, 92)
  })

  it("resets MassageLab Dotted Glow controls without premium background access", () => {
    const input = {
      backgroundId: "massage-lab-dotted-glow",
      massageLabDottedGlowSpeed: 1.75,
      massageLabDottedGlowDotSize: 3.4,
      massageLabDottedGlowDotSpacing: 24,
      massageLabDottedGlowOpacity: 0.9,
      massageLabDottedGlowGlowStrength: 10,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])
    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    for (const key of [
      "massageLabDottedGlowSpeed",
      "massageLabDottedGlowDotSize",
      "massageLabDottedGlowDotSpacing",
      "massageLabDottedGlowOpacity",
      "massageLabDottedGlowGlowStrength",
    ]) {
      assert.equal(freeSettings[key], DEFAULT_CHIMER_SETTINGS[key])
      assert.equal(sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])[key], input[key])
    }
  })

  it("resets MassageLab Bubble Field controls without premium background access", () => {
    const input = {
      backgroundId: "massage-lab-bubble",
      massageLabBubbleSpeed: 1.75,
      massageLabBubbleIntensity: 0.8,
      massageLabBubbleSize: 1.4,
      massageLabBubbleBlur: 52,
      massageLabBubbleBlendStrength: 24,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])
    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])
    assert.equal(premiumSettings.backgroundId, "massage-lab-bubble")
    for (const key of [
      "massageLabBubbleSpeed",
      "massageLabBubbleIntensity",
      "massageLabBubbleSize",
      "massageLabBubbleBlur",
      "massageLabBubbleBlendStrength",
    ]) {
      assert.equal(freeSettings[key], DEFAULT_CHIMER_SETTINGS[key])
      assert.equal(premiumSettings[key], input[key])
    }
  })

  it("resets MassageLab Beam Field controls without premium background access", () => {
    const input = {
      backgroundId: "massage-lab-background-beams",
      massageLabBackgroundBeamsSpeed: 1.75,
      massageLabBackgroundBeamsIntensity: 0.9,
      massageLabBackgroundBeamsBeamWidth: 1.4,
      massageLabBackgroundBeamsGlowStrength: 16,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])
    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])
    assert.equal(premiumSettings.backgroundId, "massage-lab-background-beams")
    for (const key of [
      "massageLabBackgroundBeamsSpeed",
      "massageLabBackgroundBeamsIntensity",
      "massageLabBackgroundBeamsBeamWidth",
      "massageLabBackgroundBeamsGlowStrength",
    ]) {
      assert.equal(freeSettings[key], DEFAULT_CHIMER_SETTINGS[key])
      assert.equal(premiumSettings[key], input[key])
    }
  })

  it("resets MassageLab Collision Beams controls without premium background access", () => {
    const input = {
      backgroundId: "massage-lab-collision-beams",
      massageLabCollisionBeamsSpeed: 1.75,
      massageLabCollisionBeamsIntensity: 0.9,
      massageLabCollisionBeamsBeamWidth: 2.5,
      massageLabCollisionBeamsBurstSize: 1.6,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])
    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])
    assert.equal(premiumSettings.backgroundId, "massage-lab-collision-beams")
    for (const key of [
      "massageLabCollisionBeamsSpeed",
      "massageLabCollisionBeamsIntensity",
      "massageLabCollisionBeamsBeamWidth",
      "massageLabCollisionBeamsBurstSize",
    ]) {
      assert.equal(freeSettings[key], DEFAULT_CHIMER_SETTINGS[key])
      assert.equal(premiumSettings[key], input[key])
    }
  })

  it("resets Glowing Stars and Meteors controls without premium background access", () => {
    const cases = [
      {
        backgroundId: "massage-lab-glowing-stars",
        values: {
          massageLabGlowingStarsSpeed: 1.75,
          massageLabGlowingStarsIntensity: 0.8,
          massageLabGlowingStarsActiveStars: 11,
          massageLabGlowingStarsStarSize: 1.8,
          massageLabGlowingStarsGlowStrength: 1.4,
        },
      },
      {
        backgroundId: "massage-lab-meteors",
        values: {
          massageLabMeteorsSpeed: 1.75,
          massageLabMeteorsIntensity: 0.8,
          massageLabMeteorsCount: 36,
          massageLabMeteorsSize: 3,
          massageLabMeteorsTailLength: 90,
        },
      },
    ]

    for (const { backgroundId, values } of cases) {
      const input = { backgroundId, ...values }
      const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])
      assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
      const premiumSettings = sanitizeChimerSettingsForEntitlements(
        input,
        [FEATURE_KEYS.premiumBackgrounds],
      )
      assert.equal(premiumSettings.backgroundId, backgroundId)
      for (const [key, value] of Object.entries(values)) {
        assert.equal(freeSettings[key], DEFAULT_CHIMER_SETTINGS[key])
        assert.equal(premiumSettings[key], value)
      }
    }
  })

  it("resets Light Lines controls without premium background access", () => {
    const input = {
      backgroundId: "massage-lab-background-lines",
      backgroundLinesDuration: 15,
      backgroundLinesIntensity: 0.8,
      backgroundLinesCount: 20,
      backgroundLinesWidth: 3.5,
      backgroundLinesGlowStrength: 14,
    }
    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])
    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    const premiumSettings = sanitizeChimerSettingsForEntitlements(
      input,
      [FEATURE_KEYS.premiumBackgrounds],
    )
    assert.equal(premiumSettings.backgroundId, "massage-lab-background-lines")
    for (const key of [
      "backgroundLinesDuration",
      "backgroundLinesIntensity",
      "backgroundLinesCount",
      "backgroundLinesWidth",
      "backgroundLinesGlowStrength",
    ]) {
      assert.equal(freeSettings[key], DEFAULT_CHIMER_SETTINGS[key])
      assert.equal(premiumSettings[key], input[key])
    }
  })

  it("preserves unrestricted Chimer colors while resetting an unusable premium background", () => {
    const settings = sanitizeChimerSettingsForEntitlements({
      primaryFontColor: "#000000",
      secondaryFontColor: "#123456",
      clockModeFontColor: "#654321",
      movingBackgroundMainColor: "#ABCDEF",
      movingBackgroundOrbColor: "#FEDCBA",
      movingBackgroundEnabled: false,
      backgroundId: "massage-lab-aurora",
      sparklesParticleColor: "#ABC123",
      sparklesParticleDensity: 180,
      sparklesSpeed: 6,
      gradientAnimationFirstColor: "#112233",
      gradientAnimationSpeed: 2,
      massageLabGradientPrimaryColor: "#102030",
      massageLabGradientHarmony: "split-complementary",
      massageLabGradientOpacity: 0.42,
      massageLabStarsColor: "#EAF6FF",
      massageLabStarsSpeed: 72,
      massageLabStarsDensity: 1.2,
      massageLabStarsParallax: 0.08,
      massageLabHoleStrokeColor: "#112233",
      massageLabHoleParticleColor: "#EAF6FF",
      massageLabHoleLineCount: 72,
      massageLabHoleDiscCount: 64,
      massageLabLightSpeedWarpSpeed: 3.5,
      massageLabLightSpeedWarpSpeedVersion: 2,
      massageLabLightSpeedParticleCount: 180,
      massageLabLightSpeedLightColor: "#33B2FF",
      massageLabLightSpeedIntensity: 4.5,
      massageLabLightSpeedRadius: 42,
      massageLabLightSpeedCylinderLength: 220,
      massageLabElectricMistColor: "#33B2FF",
      massageLabElectricMistSpeed: 80,
      massageLabElectricMistControlVersion: 3,
      massageLabElectricMistDetail: 2.4,
      massageLabElectricMistDistortion: 5.5,
      massageLabElectricMistBrightness: 80,
      massageLabAstralFlowPaletteMode: "harmony",
      massageLabAstralFlowPrimaryColor: "#33B2FF",
      massageLabAstralFlowHarmony: "split-complementary",
      massageLabAstralFlowColorOne: "#112233",
      massageLabAstralFlowColorTwo: "#445566",
      massageLabAstralFlowColorThree: "#778899",
      massageLabAstralFlowSpeed: 2.1,
      massageLabAstralFlowFlowMin: 4.2,
      massageLabAstralFlowFlowMax: 8.4,
      massageLabDeepSpaceNebulaPaletteMode: "harmony",
      massageLabDeepSpaceNebulaPrimaryColor: "#763B65",
      massageLabDeepSpaceNebulaHarmony: "complementary",
      massageLabDeepSpaceNebulaColorOne: "#5EFFF4",
      massageLabDeepSpaceNebulaColorTwo: "#763B65",
      massageLabDeepSpaceNebulaColorThree: "#1A0B2E",
      massageLabDeepSpaceNebulaSpeed: 3.6,
      massageLabGridBloomColor: "#E040FB",
      massageLabGridBloomSpeed: 2.4,
      massageLabGridBloomGridScale: 18,
      massageLabGridBloomRotationSpeed: 0.8,
      massageLabGridBloomFadeFalloff: 14,
      massageLabGridBloomDistortionAmount: 0.18,
      massageLabGridBloomFlowSpeedX: -0.6,
      massageLabGridBloomFlowSpeedY: 0.5,
      massageLabChromeFlowPaletteMode: "harmony",
      massageLabChromeFlowPrimaryColor: "#C0C0C0",
      massageLabChromeFlowHarmony: "monochromatic",
      massageLabChromeFlowColorOne: "#C0C0C0",
      massageLabChromeFlowColorTwo: "#4A4A4A",
      massageLabChromeFlowFlowSpeed: 1.4,
      massageLabChromeFlowTimeScale: 0.4,
      massageLabWaveCurrentPaletteMode: "harmony",
      massageLabWaveCurrentPrimaryColor: "#071697",
      massageLabWaveCurrentHarmony: "triad",
      massageLabWaveCurrentBackgroundColor: "#000000",
      massageLabWaveCurrentColorOne: "#071697",
      massageLabWaveCurrentColorTwo: "#00D4FF",
      massageLabWaveCurrentColorThree: "#000000",
      massageLabWaveCurrentSpeedX: 0.08,
      massageLabWaveCurrentSpeedY: 0.04,
      massageLabWaveCurrentAmplitude: 48,
      massageLabSynthesisPaletteMode: "harmony",
      massageLabSynthesisPrimaryColor: "#33B2FF",
      massageLabSynthesisHarmony: "split-complementary",
      massageLabSynthesisColorOne: "#112233",
      massageLabSynthesisColorTwo: "#445566",
      massageLabSynthesisColorThree: "#778899",
      massageLabSynthesisSpeed: 1.8,
      massageLabSynthesisComplexity: 16,
      massageLabSynthesisScale: 2.4,
      massageLabSynthesisDistortion: 1.4,
      massageLabSynthesisGlowIntensity: 1.6,
      massageLabSynthesisFlowFrequency: 7.5,
      backgroundLinesDuration: 16,
      wavyBackgroundFill: "#111111",
      wavyColorOne: "#ABC123",
      wavyWaveWidth: 80,
      wavySpeed: "slow",
      wavyWaveOpacity: 0.8,
      shootingStarsStarColor: "#101010",
      shootingStarsTrailColor: "#202020",
      shootingStarsShootingStarColor: "#303030",
      shootingStarsDensity: 0.00028,
      shootingStarsTwinkle: false,
      shootingStarsTwinkleSpeed: 2,
      shootingStarsShootingSpeed: 1.8,
      shootingStarsFrequency: 1.6,
      canvasRevealDotsBackgroundColor: "#040404",
      canvasRevealDotsDotColor: "#00FFCC",
      canvasRevealDotsAccentColor: "#CC7722",
      canvasRevealDotsDotSize: 3.2,
      canvasRevealDotsDotSpacing: 14,
      canvasRevealDotsOpacity: 0.6,
      canvasRevealDotsAnimationSpeed: 0.8,
      canvasRevealDotsShowGradient: false,
      spotlightColor: "#AABBCC",
      spotlightOpacity: 1.4,
      spotlightWidth: 820,
      spotlightHeight: 1700,
      spotlightSmallWidth: 360,
      spotlightTranslateY: -520,
      spotlightDuration: 12,
      spotlightXOffset: 180,
      lampBackgroundColor: "#050505",
      lampColor: "#22D3EE",
      lampGlowOpacity: 0.9,
      lampBeamWidth: 780,
      lampGlowWidth: 720,
      lampVerticalOffset: -200,
      lampPulseSpeed: 14,
      vortexBackgroundColor: "#040404",
      vortexBaseHue: 280,
      vortexParticleCount: 620,
      vortexRangeY: 200,
      vortexBaseSpeed: 0.5,
      vortexRangeSpeed: 1.8,
      vortexBaseRadius: 1.7,
      vortexRangeRadius: 3.2,
      auroraBarsBackgroundColor: "#010203",
      auroraBarsPaletteMode: "custom",
      auroraBarsPrimaryColor: "#334455",
      auroraBarsColorOne: "#AABBCC",
      auroraBarsColorTwo: "#223344",
      auroraBarsColorThree: "#445566",
      auroraBarsColorFour: "#667788",
      auroraBarsColorFive: "#8899AA",
      auroraBarsBarCount: 64,
      auroraBarsSpeed: 1.5,
      auroraBarsBlur: 9,
      auroraBarsGap: 7,
      auroraBarsMaxHeightRatio: 0.84,
      auroraBarsMinHeightRatio: 0.2,
      pixelLiquidBackgroundColor: "#080512",
      pixelLiquidBaseColor: "#5C2CA2",
      pixelLiquidAccentColor: "#C562FF",
      pixelLiquidHighlightColor: "#F2D6FF",
      pixelLiquidPixelSize: 14,
      pixelLiquidDetail: "high",
      pixelLiquidMotionSpeed: 1.2,
      tileGridPaletteMode: "custom",
      tileGridPrimaryColor: "#112233",
      tileGridColorOne: "#AABBCC",
      tileGridColorTwo: "#223344",
      tileGridColorThree: "#445566",
      tileGridColorFour: "#667788",
      tileGridColorFive: "#8899AA",
      tileGridTileSize: 64,
      tileGridJointSize: 6,
      tileGridChangeFrequency: 2.5,
      tileGridActivePercent: 32,
      tileGridOpacity: 0.93,
      hexGridPrimaryColor: "#223344",
      hexGridHarmony: "triad",
      hexGridHexSize: 72,
      hexGridJointSize: 5,
      hexGridChangeFrequency: 3.5,
      hexGridActivePercent: 28,
      hexGridOpacity: 0.82,
    }, [])

    assert.equal(settings.primaryFontColor, "#000000")
    assert.equal(settings.secondaryFontColor, "#123456")
    assert.equal(settings.clockModeFontColor, "#654321")
    assert.equal(settings.movingBackgroundEnabled, false)
    assert.equal(settings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    assert.equal(settings.sparklesParticleDensity, DEFAULT_CHIMER_SETTINGS.sparklesParticleDensity)
    assert.equal(settings.sparklesSpeed, DEFAULT_CHIMER_SETTINGS.sparklesSpeed)
    assert.equal(settings.gradientAnimationSpeed, DEFAULT_CHIMER_SETTINGS.gradientAnimationSpeed)
    assert.equal(settings.massageLabGradientOpacity, DEFAULT_CHIMER_SETTINGS.massageLabGradientOpacity)
    assert.equal(settings.massageLabStarsSpeed, DEFAULT_CHIMER_SETTINGS.massageLabStarsSpeed)
    assert.equal(settings.massageLabStarsDensity, DEFAULT_CHIMER_SETTINGS.massageLabStarsDensity)
    assert.equal(settings.massageLabStarsParallax, DEFAULT_CHIMER_SETTINGS.massageLabStarsParallax)
    assert.equal(settings.massageLabHoleLineCount, DEFAULT_CHIMER_SETTINGS.massageLabHoleLineCount)
    assert.equal(settings.massageLabHoleDiscCount, DEFAULT_CHIMER_SETTINGS.massageLabHoleDiscCount)
    assert.equal(settings.massageLabLightSpeedWarpSpeed, DEFAULT_CHIMER_SETTINGS.massageLabLightSpeedWarpSpeed)
    assert.equal(settings.massageLabLightSpeedParticleCount, DEFAULT_CHIMER_SETTINGS.massageLabLightSpeedParticleCount)
    assert.equal(settings.massageLabLightSpeedIntensity, DEFAULT_CHIMER_SETTINGS.massageLabLightSpeedIntensity)
    assert.equal(settings.massageLabLightSpeedRadius, DEFAULT_CHIMER_SETTINGS.massageLabLightSpeedRadius)
    assert.equal(settings.massageLabLightSpeedCylinderLength, DEFAULT_CHIMER_SETTINGS.massageLabLightSpeedCylinderLength)
    assert.equal(settings.massageLabElectricMistSpeed, DEFAULT_CHIMER_SETTINGS.massageLabElectricMistSpeed)
    assert.equal(settings.massageLabElectricMistDetail, DEFAULT_CHIMER_SETTINGS.massageLabElectricMistDetail)
    assert.equal(settings.massageLabElectricMistDistortion, DEFAULT_CHIMER_SETTINGS.massageLabElectricMistDistortion)
    assert.equal(settings.massageLabElectricMistBrightness, DEFAULT_CHIMER_SETTINGS.massageLabElectricMistBrightness)
    assert.equal(settings.massageLabAstralFlowSpeed, DEFAULT_CHIMER_SETTINGS.massageLabAstralFlowSpeed)
    assert.equal(settings.massageLabAstralFlowFlowMin, DEFAULT_CHIMER_SETTINGS.massageLabAstralFlowFlowMin)
    assert.equal(settings.massageLabAstralFlowFlowMax, DEFAULT_CHIMER_SETTINGS.massageLabAstralFlowFlowMax)
    assert.equal(settings.massageLabDeepSpaceNebulaSpeed, DEFAULT_CHIMER_SETTINGS.massageLabDeepSpaceNebulaSpeed)
    assert.equal(settings.massageLabGridBloomSpeed, DEFAULT_CHIMER_SETTINGS.massageLabGridBloomSpeed)
    assert.equal(settings.massageLabGridBloomGridScale, DEFAULT_CHIMER_SETTINGS.massageLabGridBloomGridScale)
    assert.equal(settings.massageLabGridBloomRotationSpeed, DEFAULT_CHIMER_SETTINGS.massageLabGridBloomRotationSpeed)
    assert.equal(settings.massageLabGridBloomFadeFalloff, DEFAULT_CHIMER_SETTINGS.massageLabGridBloomFadeFalloff)
    assert.equal(settings.massageLabGridBloomDistortionAmount, DEFAULT_CHIMER_SETTINGS.massageLabGridBloomDistortionAmount)
    assert.equal(settings.massageLabGridBloomFlowSpeedX, DEFAULT_CHIMER_SETTINGS.massageLabGridBloomFlowSpeedX)
    assert.equal(settings.massageLabGridBloomFlowSpeedY, DEFAULT_CHIMER_SETTINGS.massageLabGridBloomFlowSpeedY)
    assert.equal(settings.massageLabChromeFlowFlowSpeed, DEFAULT_CHIMER_SETTINGS.massageLabChromeFlowFlowSpeed)
    assert.equal(settings.massageLabChromeFlowTimeScale, DEFAULT_CHIMER_SETTINGS.massageLabChromeFlowTimeScale)
    assert.equal(settings.massageLabWaveCurrentSpeedX, DEFAULT_CHIMER_SETTINGS.massageLabWaveCurrentSpeedX)
    assert.equal(settings.massageLabWaveCurrentSpeedY, DEFAULT_CHIMER_SETTINGS.massageLabWaveCurrentSpeedY)
    assert.equal(settings.massageLabWaveCurrentAmplitude, DEFAULT_CHIMER_SETTINGS.massageLabWaveCurrentAmplitude)
    assert.equal(settings.massageLabSynthesisSpeed, DEFAULT_CHIMER_SETTINGS.massageLabSynthesisSpeed)
    assert.equal(settings.massageLabSynthesisComplexity, DEFAULT_CHIMER_SETTINGS.massageLabSynthesisComplexity)
    assert.equal(settings.massageLabSynthesisScale, DEFAULT_CHIMER_SETTINGS.massageLabSynthesisScale)
    assert.equal(settings.massageLabSynthesisDistortion, DEFAULT_CHIMER_SETTINGS.massageLabSynthesisDistortion)
    assert.equal(settings.massageLabSynthesisGlowIntensity, DEFAULT_CHIMER_SETTINGS.massageLabSynthesisGlowIntensity)
    assert.equal(settings.massageLabSynthesisFlowFrequency, DEFAULT_CHIMER_SETTINGS.massageLabSynthesisFlowFrequency)
    assert.equal(settings.backgroundLinesDuration, DEFAULT_CHIMER_SETTINGS.backgroundLinesDuration)
    assert.equal(settings.wavyWaveWidth, DEFAULT_CHIMER_SETTINGS.wavyWaveWidth)
    assert.equal(settings.wavySpeed, DEFAULT_CHIMER_SETTINGS.wavySpeed)
    assert.equal(settings.wavyWaveOpacity, DEFAULT_CHIMER_SETTINGS.wavyWaveOpacity)
    assert.equal(settings.shootingStarsDensity, DEFAULT_CHIMER_SETTINGS.shootingStarsDensity)
    assert.equal(settings.shootingStarsTwinkle, DEFAULT_CHIMER_SETTINGS.shootingStarsTwinkle)
    assert.equal(settings.shootingStarsTwinkleSpeed, DEFAULT_CHIMER_SETTINGS.shootingStarsTwinkleSpeed)
    assert.equal(settings.shootingStarsShootingSpeed, DEFAULT_CHIMER_SETTINGS.shootingStarsShootingSpeed)
    assert.equal(settings.shootingStarsFrequency, DEFAULT_CHIMER_SETTINGS.shootingStarsFrequency)
    assert.equal(settings.canvasRevealDotsDotSize, DEFAULT_CHIMER_SETTINGS.canvasRevealDotsDotSize)
    assert.equal(settings.canvasRevealDotsDotSpacing, DEFAULT_CHIMER_SETTINGS.canvasRevealDotsDotSpacing)
    assert.equal(settings.canvasRevealDotsOpacity, DEFAULT_CHIMER_SETTINGS.canvasRevealDotsOpacity)
    assert.equal(settings.canvasRevealDotsAnimationSpeed, DEFAULT_CHIMER_SETTINGS.canvasRevealDotsAnimationSpeed)
    assert.equal(settings.canvasRevealDotsShowGradient, DEFAULT_CHIMER_SETTINGS.canvasRevealDotsShowGradient)
    assert.equal(settings.spotlightOpacity, DEFAULT_CHIMER_SETTINGS.spotlightOpacity)
    assert.equal(settings.spotlightWidth, DEFAULT_CHIMER_SETTINGS.spotlightWidth)
    assert.equal(settings.spotlightHeight, DEFAULT_CHIMER_SETTINGS.spotlightHeight)
    assert.equal(settings.spotlightSmallWidth, DEFAULT_CHIMER_SETTINGS.spotlightSmallWidth)
    assert.equal(settings.spotlightTranslateY, DEFAULT_CHIMER_SETTINGS.spotlightTranslateY)
    assert.equal(settings.spotlightDuration, DEFAULT_CHIMER_SETTINGS.spotlightDuration)
    assert.equal(settings.spotlightXOffset, DEFAULT_CHIMER_SETTINGS.spotlightXOffset)
    assert.equal(settings.lampGlowOpacity, DEFAULT_CHIMER_SETTINGS.lampGlowOpacity)
    assert.equal(settings.lampBeamWidth, DEFAULT_CHIMER_SETTINGS.lampBeamWidth)
    assert.equal(settings.lampGlowWidth, DEFAULT_CHIMER_SETTINGS.lampGlowWidth)
    assert.equal(settings.lampVerticalOffset, DEFAULT_CHIMER_SETTINGS.lampVerticalOffset)
    assert.equal(settings.lampPulseSpeed, DEFAULT_CHIMER_SETTINGS.lampPulseSpeed)
    assert.equal(settings.vortexParticleCount, DEFAULT_CHIMER_SETTINGS.vortexParticleCount)
    assert.equal(settings.vortexRangeY, DEFAULT_CHIMER_SETTINGS.vortexRangeY)
    assert.equal(settings.vortexBaseSpeed, DEFAULT_CHIMER_SETTINGS.vortexBaseSpeed)
    assert.equal(settings.vortexRangeSpeed, DEFAULT_CHIMER_SETTINGS.vortexRangeSpeed)
    assert.equal(settings.vortexBaseRadius, DEFAULT_CHIMER_SETTINGS.vortexBaseRadius)
    assert.equal(settings.vortexRangeRadius, DEFAULT_CHIMER_SETTINGS.vortexRangeRadius)
    assert.equal(settings.auroraBarsBarCount, DEFAULT_CHIMER_SETTINGS.auroraBarsBarCount)
    assert.equal(settings.auroraBarsSpeed, DEFAULT_CHIMER_SETTINGS.auroraBarsSpeed)
    assert.equal(settings.auroraBarsBlur, DEFAULT_CHIMER_SETTINGS.auroraBarsBlur)
    assert.equal(settings.auroraBarsGap, DEFAULT_CHIMER_SETTINGS.auroraBarsGap)
    assert.equal(settings.auroraBarsMaxHeightRatio, DEFAULT_CHIMER_SETTINGS.auroraBarsMaxHeightRatio)
    assert.equal(settings.auroraBarsMinHeightRatio, DEFAULT_CHIMER_SETTINGS.auroraBarsMinHeightRatio)
    assert.equal(settings.pixelLiquidPixelSize, DEFAULT_CHIMER_SETTINGS.pixelLiquidPixelSize)
    assert.equal(settings.pixelLiquidDetail, DEFAULT_CHIMER_SETTINGS.pixelLiquidDetail)
    assert.equal(settings.pixelLiquidMotionSpeed, DEFAULT_CHIMER_SETTINGS.pixelLiquidMotionSpeed)
    assert.equal(settings.tileGridTileSize, DEFAULT_CHIMER_SETTINGS.tileGridTileSize)
    assert.equal(settings.tileGridJointSize, DEFAULT_CHIMER_SETTINGS.tileGridJointSize)
    assert.equal(settings.tileGridChangeFrequency, DEFAULT_CHIMER_SETTINGS.tileGridChangeFrequency)
    assert.equal(settings.tileGridActivePercent, DEFAULT_CHIMER_SETTINGS.tileGridActivePercent)
    assert.equal(settings.tileGridOpacity, DEFAULT_CHIMER_SETTINGS.tileGridOpacity)
    assert.equal(settings.hexGridHexSize, DEFAULT_CHIMER_SETTINGS.hexGridHexSize)
    assert.equal(settings.hexGridJointSize, DEFAULT_CHIMER_SETTINGS.hexGridJointSize)
    assert.equal(settings.hexGridChangeFrequency, DEFAULT_CHIMER_SETTINGS.hexGridChangeFrequency)
    assert.equal(settings.hexGridActivePercent, DEFAULT_CHIMER_SETTINGS.hexGridActivePercent)
    assert.equal(settings.hexGridOpacity, DEFAULT_CHIMER_SETTINGS.hexGridOpacity)
  })

  it("preserves unrestricted display colors without requiring account access", () => {
    const settings = sanitizeChimerSettingsForEntitlements({
      primaryFontColor: "#000000",
      secondaryFontColor: "#123456",
      clockModeFontColor: "#654321",
      clockFontFamily: "serif",
      clockShadowEnabled: false,
      movingBackgroundMainColor: "#ABCDEF",
      movingBackgroundOrbColor: "#FEDCBA",
      backgroundId: "massage-lab-aurora",
    }, [])

    assert.equal(settings.primaryFontColor, "#000000")
    assert.equal(settings.secondaryFontColor, "#123456")
    assert.equal(settings.clockFontFamily, "serif")
    assert.equal(settings.clockShadowEnabled, false)
    assert.equal(settings.clockModeFontColor, "#654321")
    assert.equal(settings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
  })

  it("preserves premium backgrounds and custom colors for users with both features", () => {
    const settings = sanitizeChimerSettingsForEntitlements({
      primaryFontColor: "#000000",
      secondaryFontColor: "#123456",
      clockModeFontColor: "#654321",
      movingBackgroundMainColor: "#ABCDEF",
      movingBackgroundOrbColor: "#FEDCBA",
      backgroundId: "massage-lab-sparkles",
      sparklesParticleColor: "#ABC123",
      sparklesParticleDensity: 180,
      sparklesSpeed: 6,
      gradientAnimationFirstColor: "#112233",
      gradientAnimationSpeed: 2,
      massageLabGradientPrimaryColor: "#102030",
      massageLabGradientHarmony: "split-complementary",
      massageLabGradientOpacity: 0.42,
      massageLabStarsColor: "#EAF6FF",
      massageLabStarsSpeed: 72,
      massageLabStarsDensity: 1.2,
      massageLabStarsParallax: 0.08,
      massageLabHoleStrokeColor: "#112233",
      massageLabHoleParticleColor: "#EAF6FF",
      massageLabHoleLineCount: 72,
      massageLabHoleDiscCount: 64,
      massageLabLightSpeedWarpSpeed: 3.5,
      massageLabLightSpeedWarpSpeedVersion: 2,
      massageLabLightSpeedParticleCount: 180,
      massageLabLightSpeedLightColor: "#33B2FF",
      massageLabLightSpeedIntensity: 4.5,
      massageLabLightSpeedRadius: 42,
      massageLabLightSpeedCylinderLength: 220,
      massageLabElectricMistColor: "#33B2FF",
      massageLabElectricMistSpeed: 80,
      massageLabElectricMistControlVersion: 3,
      massageLabElectricMistDetail: 2.4,
      massageLabElectricMistDistortion: 5.5,
      massageLabElectricMistBrightness: 80,
      massageLabAstralFlowPaletteMode: "harmony",
      massageLabAstralFlowPrimaryColor: "#33B2FF",
      massageLabAstralFlowHarmony: "split-complementary",
      massageLabAstralFlowColorOne: "#112233",
      massageLabAstralFlowColorTwo: "#445566",
      massageLabAstralFlowColorThree: "#778899",
      massageLabAstralFlowSpeed: 2.1,
      massageLabAstralFlowFlowMin: 4.2,
      massageLabAstralFlowFlowMax: 8.4,
      massageLabDeepSpaceNebulaPaletteMode: "harmony",
      massageLabDeepSpaceNebulaPrimaryColor: "#763B65",
      massageLabDeepSpaceNebulaHarmony: "complementary",
      massageLabDeepSpaceNebulaColorOne: "#5EFFF4",
      massageLabDeepSpaceNebulaColorTwo: "#763B65",
      massageLabDeepSpaceNebulaColorThree: "#1A0B2E",
      massageLabDeepSpaceNebulaSpeed: 3.6,
      massageLabGridBloomColor: "#E040FB",
      massageLabGridBloomSpeed: 2.4,
      massageLabGridBloomGridScale: 18,
      massageLabGridBloomRotationSpeed: 0.8,
      massageLabGridBloomFadeFalloff: 14,
      massageLabGridBloomDistortionAmount: 0.18,
      massageLabGridBloomFlowSpeedX: -0.6,
      massageLabGridBloomFlowSpeedY: 0.5,
      massageLabChromeFlowPaletteMode: "harmony",
      massageLabChromeFlowPrimaryColor: "#C0C0C0",
      massageLabChromeFlowHarmony: "monochromatic",
      massageLabChromeFlowColorOne: "#C0C0C0",
      massageLabChromeFlowColorTwo: "#4A4A4A",
      massageLabChromeFlowFlowSpeed: 1.4,
      massageLabChromeFlowTimeScale: 0.4,
      massageLabWaveCurrentPaletteMode: "harmony",
      massageLabWaveCurrentPrimaryColor: "#071697",
      massageLabWaveCurrentHarmony: "triad",
      massageLabWaveCurrentBackgroundColor: "#000000",
      massageLabWaveCurrentColorOne: "#071697",
      massageLabWaveCurrentColorTwo: "#00D4FF",
      massageLabWaveCurrentColorThree: "#000000",
      massageLabWaveCurrentSpeedX: 0.08,
      massageLabWaveCurrentSpeedY: 0.04,
      massageLabWaveCurrentAmplitude: 48,
      massageLabSynthesisPaletteMode: "harmony",
      massageLabSynthesisPrimaryColor: "#33B2FF",
      massageLabSynthesisHarmony: "split-complementary",
      massageLabSynthesisColorOne: "#112233",
      massageLabSynthesisColorTwo: "#445566",
      massageLabSynthesisColorThree: "#778899",
      massageLabSynthesisSpeed: 1.8,
      massageLabSynthesisComplexity: 16,
      massageLabSynthesisScale: 2.4,
      massageLabSynthesisDistortion: 1.4,
      massageLabSynthesisGlowIntensity: 1.6,
      massageLabSynthesisFlowFrequency: 7.5,
      backgroundLinesDuration: 16,
      wavyBackgroundFill: "#111111",
      wavyColorOne: "#ABC123",
      wavyWaveWidth: 80,
      wavySpeed: "slow",
      wavyWaveOpacity: 0.8,
      shootingStarsStarColor: "#101010",
      shootingStarsTrailColor: "#202020",
      shootingStarsShootingStarColor: "#303030",
      shootingStarsDensity: 0.00028,
      shootingStarsTwinkle: false,
      shootingStarsTwinkleSpeed: 2,
      shootingStarsShootingSpeed: 1.8,
      shootingStarsFrequency: 1.6,
      canvasRevealDotsBackgroundColor: "#040404",
      canvasRevealDotsDotColor: "#00FFCC",
      canvasRevealDotsAccentColor: "#CC7722",
      canvasRevealDotsDotSize: 3.2,
      canvasRevealDotsDotSpacing: 14,
      canvasRevealDotsOpacity: 0.6,
      canvasRevealDotsAnimationSpeed: 0.8,
      canvasRevealDotsShowGradient: false,
      spotlightColor: "#AABBCC",
      spotlightOpacity: 1.4,
      spotlightWidth: 820,
      spotlightHeight: 1700,
      spotlightSmallWidth: 360,
      spotlightTranslateY: -520,
      spotlightDuration: 12,
      spotlightXOffset: 180,
      lampBackgroundColor: "#050505",
      lampColor: "#22D3EE",
      lampGlowOpacity: 0.9,
      lampBeamWidth: 780,
      lampGlowWidth: 720,
      lampVerticalOffset: -200,
      lampPulseSpeed: 14,
      vortexBackgroundColor: "#040404",
      vortexBaseHue: 280,
      vortexParticleCount: 620,
      vortexRangeY: 200,
      vortexBaseSpeed: 0.5,
      vortexRangeSpeed: 1.8,
      vortexBaseRadius: 1.7,
      vortexRangeRadius: 3.2,
      auroraBarsBackgroundColor: "#010203",
      auroraBarsPaletteMode: "custom",
      auroraBarsPrimaryColor: "#334455",
      auroraBarsColorOne: "#AABBCC",
      auroraBarsColorTwo: "#223344",
      auroraBarsColorThree: "#445566",
      auroraBarsColorFour: "#667788",
      auroraBarsColorFive: "#8899AA",
      auroraBarsBarCount: 64,
      auroraBarsSpeed: 1.5,
      auroraBarsBlur: 9,
      auroraBarsGap: 7,
      auroraBarsMaxHeightRatio: 0.84,
      auroraBarsMinHeightRatio: 0.2,
      pixelLiquidBackgroundColor: "#080512",
      pixelLiquidBaseColor: "#5C2CA2",
      pixelLiquidAccentColor: "#C562FF",
      pixelLiquidHighlightColor: "#F2D6FF",
      pixelLiquidPixelSize: 14,
      pixelLiquidDetail: "high",
      pixelLiquidMotionSpeed: 1.2,
      tileGridPaletteMode: "custom",
      tileGridPrimaryColor: "#112233",
      tileGridColorOne: "#AABBCC",
      tileGridColorTwo: "#223344",
      tileGridColorThree: "#445566",
      tileGridColorFour: "#667788",
      tileGridColorFive: "#8899AA",
      tileGridTileSize: 64,
      tileGridJointSize: 6,
      tileGridChangeFrequency: 2.5,
      tileGridActivePercent: 32,
      tileGridOpacity: 0.93,
      hexGridPrimaryColor: "#223344",
      hexGridHarmony: "triad",
      hexGridHexSize: 72,
      hexGridJointSize: 5,
      hexGridChangeFrequency: 3.5,
      hexGridActivePercent: 28,
      hexGridOpacity: 0.82,
    }, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(settings.primaryFontColor, "#000000")
    assert.equal(settings.secondaryFontColor, "#123456")
    assert.equal(settings.clockModeFontColor, "#654321")
    assert.equal(settings.backgroundId, "massage-lab-sparkles")
    assert.equal(settings.sparklesParticleDensity, 180)
    assert.equal(settings.sparklesSpeed, 6)
    assert.equal(settings.gradientAnimationSpeed, 2)
    assert.equal(settings.massageLabGradientOpacity, 0.42)
    assert.equal(settings.massageLabStarsSpeed, 72)
    assert.equal(settings.massageLabStarsDensity, 1.2)
    assert.equal(settings.massageLabStarsParallax, 0.08)
    assert.equal(settings.massageLabHoleLineCount, 72)
    assert.equal(settings.massageLabHoleDiscCount, 64)
    assert.equal(settings.massageLabLightSpeedWarpSpeed, 3.5)
    assert.equal(settings.massageLabLightSpeedParticleCount, 180)
    assert.equal(settings.massageLabLightSpeedIntensity, 4.5)
    assert.equal(settings.massageLabLightSpeedRadius, 42)
    assert.equal(settings.massageLabLightSpeedCylinderLength, 220)
    assert.equal(settings.massageLabElectricMistSpeed, 80)
    assert.equal(settings.massageLabElectricMistDetail, 2.4)
    assert.equal(settings.massageLabElectricMistDistortion, 5.5)
    assert.equal(settings.massageLabElectricMistBrightness, 80)
    assert.equal(settings.massageLabAstralFlowSpeed, 2.1)
    assert.equal(settings.massageLabAstralFlowFlowMin, 4.2)
    assert.equal(settings.massageLabAstralFlowFlowMax, 8.4)
    assert.equal(settings.massageLabDeepSpaceNebulaSpeed, 3.6)
    assert.equal(settings.massageLabGridBloomSpeed, 2.4)
    assert.equal(settings.massageLabGridBloomGridScale, 18)
    assert.equal(settings.massageLabGridBloomRotationSpeed, 0.8)
    assert.equal(settings.massageLabGridBloomFadeFalloff, 14)
    assert.equal(settings.massageLabGridBloomDistortionAmount, 0.18)
    assert.equal(settings.massageLabGridBloomFlowSpeedX, -0.6)
    assert.equal(settings.massageLabGridBloomFlowSpeedY, 0.5)
    assert.equal(settings.massageLabChromeFlowFlowSpeed, 1.4)
    assert.equal(settings.massageLabChromeFlowTimeScale, 0.4)
    assert.equal(settings.massageLabWaveCurrentSpeedX, 0.08)
    assert.equal(settings.massageLabWaveCurrentSpeedY, 0.04)
    assert.equal(settings.massageLabWaveCurrentAmplitude, 48)
    assert.equal(settings.massageLabSynthesisSpeed, 1.8)
    assert.equal(settings.massageLabSynthesisComplexity, 16)
    assert.equal(settings.massageLabSynthesisScale, 2.4)
    assert.equal(settings.massageLabSynthesisDistortion, 1.4)
    assert.equal(settings.massageLabSynthesisGlowIntensity, 1.6)
    assert.equal(settings.massageLabSynthesisFlowFrequency, 7.5)
    assert.equal(settings.backgroundLinesDuration, 16)
    assert.equal(settings.wavyWaveWidth, 80)
    assert.equal(settings.wavySpeed, "slow")
    assert.equal(settings.wavyWaveOpacity, 0.8)
    assert.equal(settings.shootingStarsDensity, 0.00028)
    assert.equal(settings.shootingStarsTwinkle, false)
    assert.equal(settings.shootingStarsTwinkleSpeed, 2)
    assert.equal(settings.shootingStarsShootingSpeed, 1.8)
    assert.equal(settings.shootingStarsFrequency, 1.6)
    assert.equal(settings.canvasRevealDotsDotSize, 3.2)
    assert.equal(settings.canvasRevealDotsDotSpacing, 14)
    assert.equal(settings.canvasRevealDotsOpacity, 0.6)
    assert.equal(settings.canvasRevealDotsAnimationSpeed, 0.8)
    assert.equal(settings.canvasRevealDotsShowGradient, false)
    assert.equal(settings.spotlightOpacity, 1.4)
    assert.equal(settings.spotlightWidth, 820)
    assert.equal(settings.spotlightHeight, 1700)
    assert.equal(settings.spotlightSmallWidth, 360)
    assert.equal(settings.spotlightTranslateY, -520)
    assert.equal(settings.spotlightDuration, 12)
    assert.equal(settings.spotlightXOffset, 180)
    assert.equal(settings.lampGlowOpacity, 0.9)
    assert.equal(settings.lampBeamWidth, 780)
    assert.equal(settings.lampGlowWidth, 720)
    assert.equal(settings.lampVerticalOffset, -200)
    assert.equal(settings.lampPulseSpeed, 14)
    assert.equal(settings.vortexParticleCount, 620)
    assert.equal(settings.vortexRangeY, 200)
    assert.equal(settings.vortexBaseSpeed, 0.5)
    assert.equal(settings.vortexRangeSpeed, 1.8)
    assert.equal(settings.vortexBaseRadius, 1.7)
    assert.equal(settings.vortexRangeRadius, 3.2)
    assert.equal(settings.auroraBarsBarCount, 64)
    assert.equal(settings.auroraBarsSpeed, 1.5)
    assert.equal(settings.auroraBarsBlur, 9)
    assert.equal(settings.auroraBarsGap, 7)
    assert.equal(settings.auroraBarsMaxHeightRatio, 0.84)
    assert.equal(settings.auroraBarsMinHeightRatio, 0.2)
    assert.equal(settings.pixelLiquidPixelSize, 14)
    assert.equal(settings.pixelLiquidDetail, "high")
    assert.equal(settings.pixelLiquidMotionSpeed, 1.2)
    assert.equal(settings.tileGridTileSize, 64)
    assert.equal(settings.tileGridJointSize, 6)
    assert.equal(settings.tileGridChangeFrequency, 2.5)
    assert.equal(settings.tileGridActivePercent, 32)
    assert.equal(settings.tileGridOpacity, 0.93)
    assert.equal(settings.hexGridHexSize, 72)
    assert.equal(settings.hexGridJointSize, 5)
    assert.equal(settings.hexGridChangeFrequency, 3.5)
    assert.equal(settings.hexGridActivePercent, 28)
    assert.equal(settings.hexGridOpacity, 0.82)
  })

  it("allows premium background controls alongside unrestricted Chimer display colors", () => {
    const settings = sanitizeChimerSettingsForEntitlements({
      primaryFontColor: "#000000",
      backgroundId: "massage-lab-gradient-animation",
      sparklesParticleColor: "#ABC123",
      sparklesParticleDensity: 180,
      gradientAnimationSecondColor: "#224466",
      gradientAnimationSize: 100,
      massageLabGradientPrimaryColor: "#102030",
      massageLabGradientHarmony: "split-complementary",
      massageLabGradientOpacity: 0.42,
      massageLabStarsColor: "#EAF6FF",
      massageLabStarsSpeed: 72,
      massageLabStarsDensity: 1.2,
      massageLabStarsParallax: 0.08,
      massageLabHoleStrokeColor: "#112233",
      massageLabHoleParticleColor: "#EAF6FF",
      massageLabHoleLineCount: 72,
      massageLabHoleDiscCount: 64,
      massageLabLightSpeedWarpSpeed: 3.5,
      massageLabLightSpeedWarpSpeedVersion: 2,
      massageLabLightSpeedParticleCount: 180,
      massageLabLightSpeedLightColor: "#33B2FF",
      massageLabLightSpeedIntensity: 4.5,
      massageLabLightSpeedRadius: 42,
      massageLabLightSpeedCylinderLength: 220,
      massageLabElectricMistColor: "#33B2FF",
      massageLabElectricMistSpeed: 80,
      massageLabElectricMistControlVersion: 3,
      massageLabElectricMistDetail: 2.4,
      massageLabElectricMistDistortion: 5.5,
      massageLabElectricMistBrightness: 80,
      massageLabAstralFlowPaletteMode: "harmony",
      massageLabAstralFlowPrimaryColor: "#33B2FF",
      massageLabAstralFlowHarmony: "split-complementary",
      massageLabAstralFlowColorOne: "#112233",
      massageLabAstralFlowColorTwo: "#445566",
      massageLabAstralFlowColorThree: "#778899",
      massageLabAstralFlowSpeed: 2.1,
      massageLabAstralFlowFlowMin: 4.2,
      massageLabAstralFlowFlowMax: 8.4,
      massageLabDeepSpaceNebulaPaletteMode: "harmony",
      massageLabDeepSpaceNebulaPrimaryColor: "#763B65",
      massageLabDeepSpaceNebulaHarmony: "complementary",
      massageLabDeepSpaceNebulaColorOne: "#5EFFF4",
      massageLabDeepSpaceNebulaColorTwo: "#763B65",
      massageLabDeepSpaceNebulaColorThree: "#1A0B2E",
      massageLabDeepSpaceNebulaSpeed: 3.6,
      massageLabGridBloomColor: "#E040FB",
      massageLabGridBloomSpeed: 2.4,
      massageLabGridBloomGridScale: 18,
      massageLabGridBloomRotationSpeed: 0.8,
      massageLabGridBloomFadeFalloff: 14,
      massageLabGridBloomDistortionAmount: 0.18,
      massageLabGridBloomFlowSpeedX: -0.6,
      massageLabGridBloomFlowSpeedY: 0.5,
      massageLabChromeFlowPaletteMode: "harmony",
      massageLabChromeFlowPrimaryColor: "#C0C0C0",
      massageLabChromeFlowHarmony: "monochromatic",
      massageLabChromeFlowColorOne: "#C0C0C0",
      massageLabChromeFlowColorTwo: "#4A4A4A",
      massageLabChromeFlowFlowSpeed: 1.4,
      massageLabChromeFlowTimeScale: 0.4,
      massageLabWaveCurrentPaletteMode: "harmony",
      massageLabWaveCurrentPrimaryColor: "#071697",
      massageLabWaveCurrentHarmony: "triad",
      massageLabWaveCurrentBackgroundColor: "#000000",
      massageLabWaveCurrentColorOne: "#071697",
      massageLabWaveCurrentColorTwo: "#00D4FF",
      massageLabWaveCurrentColorThree: "#000000",
      massageLabWaveCurrentSpeedX: 0.08,
      massageLabWaveCurrentSpeedY: 0.04,
      massageLabWaveCurrentAmplitude: 48,
      massageLabSynthesisPaletteMode: "harmony",
      massageLabSynthesisPrimaryColor: "#33B2FF",
      massageLabSynthesisHarmony: "split-complementary",
      massageLabSynthesisColorOne: "#112233",
      massageLabSynthesisColorTwo: "#445566",
      massageLabSynthesisColorThree: "#778899",
      massageLabSynthesisSpeed: 1.8,
      massageLabSynthesisComplexity: 16,
      massageLabSynthesisScale: 2.4,
      massageLabSynthesisDistortion: 1.4,
      massageLabSynthesisGlowIntensity: 1.6,
      massageLabSynthesisFlowFrequency: 7.5,
      backgroundLinesDuration: 16,
      wavyBackgroundFill: "#111111",
      wavyColorTwo: "#ABC123",
      wavyBlur: 14,
      wavyWaveOpacity: 0.75,
      shootingStarsTrailColor: "#202020",
      shootingStarsDensity: 0.00024,
      shootingStarsTwinkle: false,
      shootingStarsFrequency: 1.5,
      canvasRevealDotsDotColor: "#00FFCC",
      canvasRevealDotsDotSpacing: 14,
      canvasRevealDotsShowGradient: false,
      spotlightColor: "#AABBCC",
      spotlightDuration: 12,
      spotlightXOffset: 180,
      lampColor: "#22D3EE",
      lampGlowOpacity: 0.9,
      lampPulseSpeed: 14,
      vortexBackgroundColor: "#040404",
      vortexBaseHue: 180,
      vortexParticleCount: 500,
      vortexRangeSpeed: 1.7,
      auroraBarsBackgroundColor: "#010203",
      auroraBarsPaletteMode: "custom",
      auroraBarsPrimaryColor: "#334455",
      auroraBarsColorOne: "#AABBCC",
      auroraBarsBarCount: 64,
      auroraBarsSpeed: 1.5,
      pixelLiquidBackgroundColor: "#110603",
      pixelLiquidBaseColor: "#A4360C",
      pixelLiquidAccentColor: "#FF7A1A",
      pixelLiquidHighlightColor: "#FFE2AB",
      pixelLiquidPixelSize: 11,
      pixelLiquidDetail: "low",
      pixelLiquidMotionSpeed: 0.5,
      tileGridPaletteMode: "custom",
      tileGridPrimaryColor: "#112233",
      tileGridColorOne: "#AABBCC",
      tileGridColorTwo: "#223344",
      tileGridColorThree: "#445566",
      tileGridColorFour: "#667788",
      tileGridColorFive: "#8899AA",
      tileGridTileSize: 64,
      tileGridJointSize: 6,
      tileGridChangeFrequency: 2.5,
      tileGridActivePercent: 32,
      tileGridOpacity: 0.93,
      hexGridPrimaryColor: "#223344",
      hexGridHarmony: "triad",
      hexGridHexSize: 72,
      hexGridJointSize: 5,
      hexGridChangeFrequency: 3.5,
      hexGridActivePercent: 28,
      hexGridOpacity: 0.82,
    }, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(settings.primaryFontColor, "#000000")
    assert.equal(settings.backgroundId, "massage-lab-gradient-animation")
    assert.equal(settings.sparklesParticleDensity, 180)
    assert.equal(settings.gradientAnimationSize, 100)
    assert.equal(settings.massageLabGradientOpacity, 0.42)
    assert.equal(settings.massageLabStarsSpeed, 72)
    assert.equal(settings.massageLabStarsDensity, 1.2)
    assert.equal(settings.massageLabStarsParallax, 0.08)
    assert.equal(settings.massageLabHoleLineCount, 72)
    assert.equal(settings.massageLabHoleDiscCount, 64)
    assert.equal(settings.massageLabLightSpeedWarpSpeed, 3.5)
    assert.equal(settings.massageLabLightSpeedParticleCount, 180)
    assert.equal(settings.massageLabLightSpeedIntensity, 4.5)
    assert.equal(settings.massageLabLightSpeedRadius, 42)
    assert.equal(settings.massageLabLightSpeedCylinderLength, 220)
    assert.equal(settings.massageLabElectricMistSpeed, 80)
    assert.equal(settings.massageLabElectricMistDetail, 2.4)
    assert.equal(settings.massageLabElectricMistDistortion, 5.5)
    assert.equal(settings.massageLabElectricMistBrightness, 80)
    assert.equal(settings.massageLabAstralFlowSpeed, 2.1)
    assert.equal(settings.massageLabAstralFlowFlowMin, 4.2)
    assert.equal(settings.massageLabAstralFlowFlowMax, 8.4)
    assert.equal(settings.massageLabDeepSpaceNebulaSpeed, 3.6)
    assert.equal(settings.massageLabGridBloomSpeed, 2.4)
    assert.equal(settings.massageLabGridBloomGridScale, 18)
    assert.equal(settings.massageLabGridBloomRotationSpeed, 0.8)
    assert.equal(settings.massageLabGridBloomFadeFalloff, 14)
    assert.equal(settings.massageLabGridBloomDistortionAmount, 0.18)
    assert.equal(settings.massageLabGridBloomFlowSpeedX, -0.6)
    assert.equal(settings.massageLabGridBloomFlowSpeedY, 0.5)
    assert.equal(settings.massageLabChromeFlowFlowSpeed, 1.4)
    assert.equal(settings.massageLabChromeFlowTimeScale, 0.4)
    assert.equal(settings.massageLabWaveCurrentSpeedX, 0.08)
    assert.equal(settings.massageLabWaveCurrentSpeedY, 0.04)
    assert.equal(settings.massageLabWaveCurrentAmplitude, 48)
    assert.equal(settings.massageLabSynthesisSpeed, 1.8)
    assert.equal(settings.massageLabSynthesisComplexity, 16)
    assert.equal(settings.massageLabSynthesisScale, 2.4)
    assert.equal(settings.massageLabSynthesisDistortion, 1.4)
    assert.equal(settings.massageLabSynthesisGlowIntensity, 1.6)
    assert.equal(settings.massageLabSynthesisFlowFrequency, 7.5)
    assert.equal(settings.backgroundLinesDuration, 16)
    assert.equal(settings.wavyBlur, 14)
    assert.equal(settings.wavyWaveOpacity, 0.75)
    assert.equal(settings.shootingStarsDensity, 0.00024)
    assert.equal(settings.shootingStarsTwinkle, false)
    assert.equal(settings.shootingStarsFrequency, 1.5)
    assert.equal(settings.canvasRevealDotsDotSpacing, 14)
    assert.equal(settings.canvasRevealDotsShowGradient, false)
    assert.equal(settings.spotlightDuration, 12)
    assert.equal(settings.spotlightXOffset, 180)
    assert.equal(settings.lampGlowOpacity, 0.9)
    assert.equal(settings.lampPulseSpeed, 14)
    assert.equal(settings.vortexParticleCount, 500)
    assert.equal(settings.vortexRangeSpeed, 1.7)
    assert.equal(settings.auroraBarsBarCount, 64)
    assert.equal(settings.auroraBarsSpeed, 1.5)
    assert.equal(settings.pixelLiquidPixelSize, 11)
    assert.equal(settings.pixelLiquidDetail, "low")
    assert.equal(settings.pixelLiquidMotionSpeed, 0.5)
    assert.equal(settings.tileGridTileSize, 64)
    assert.equal(settings.tileGridJointSize, 6)
    assert.equal(settings.tileGridChangeFrequency, 2.5)
    assert.equal(settings.tileGridActivePercent, 32)
    assert.equal(settings.tileGridOpacity, 0.93)
    assert.equal(settings.hexGridHexSize, 72)
    assert.equal(settings.hexGridJointSize, 5)
    assert.equal(settings.hexGridChangeFrequency, 3.5)
    assert.equal(settings.hexGridActivePercent, 28)
    assert.equal(settings.hexGridOpacity, 0.82)
  })

  it("keeps unrestricted Chimer colors independent from premium background access", () => {
    const settings = sanitizeChimerSettingsForEntitlements({
      primaryFontColor: "#000000",
      movingBackgroundMainColor: "#ABCDEF",
      movingBackgroundOrbColor: "#FEDCBA",
      backgroundId: "massage-lab-aurora",
    }, [])

    assert.equal(settings.primaryFontColor, "#000000")
    assert.equal(settings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
  })

  it("preserves anonymous free static backgrounds using their canonical access decisions", () => {
    const canUseSelectedBackground = (backgroundId) => (
      backgroundId === "static-gradient" || backgroundId === "solid-color"
    )
    const options = { canUseSelectedBackground }
    const staticGradient = sanitizeChimerSettingsForEntitlements({
      backgroundId: "static-gradient",
      staticGradientType: "radial",
      staticGradientColorCount: 3,
      staticGradientStopPositions: [5, 40, 95],
    }, [], options)
    const solidColor = sanitizeChimerSettingsForEntitlements({
      backgroundId: "solid-color",
      backgroundVisualPreferences: {
        palette: {
          mode: "custom",
          primaryColor: "#112233",
          swatches: ["#112233", "#223344", "#334455", "#445566", "#556677", "#667788", "#778899"],
        },
      },
    }, [], options)
    const lockedPremium = sanitizeChimerSettingsForEntitlements({
      backgroundId: "massage-lab-silk",
      massageLabSilkSpeed: 7.5,
    }, [], options)

    assert.equal(staticGradient.backgroundId, "static-gradient")
    assert.equal(staticGradient.staticGradientType, "radial")
    assert.equal(staticGradient.staticGradientColorCount, 3)
    assert.deepEqual(staticGradient.staticGradientStopPositions, [5, 40, 95, 100, 100, 100, 100])
    assert.equal(solidColor.backgroundId, "solid-color")
    assert.equal(solidColor.backgroundVisualPreferences.palette.primaryColor, "#112233")
    assert.equal(lockedPremium.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    assert.equal(lockedPremium.massageLabSilkSpeed, DEFAULT_CHIMER_SETTINGS.massageLabSilkSpeed)
  })

  it("hydrates one owned-only access snapshot without granting unrelated backgrounds", () => {
    const ownedBackgroundId = "massage-lab-stars"
    const settings = sanitizeChimerSettingsForEntitlements({
      backgroundId: ownedBackgroundId,
      primaryFontColor: "#010203",
      clockFontFamily: "serif",
      clockShadowEnabled: true,
      clockShadowColor: "#112233",
      clockGlowEnabled: true,
      clockGlowColor: "#445566",
      massageLabStarsSpeed: 72,
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
      ownedBackgroundIds: [ownedBackgroundId],
    })

    assert.equal(settings.backgroundId, ownedBackgroundId)
    assert.equal(settings.massageLabStarsSpeed, 72)
    assert.equal(settings.backgroundVisualPreferences.palette.mode, "custom")
    assert.equal(settings.primaryFontColor, "#010203")
    assert.equal(settings.clockFontFamily, "serif")
    assert.equal(settings.clockShadowEnabled, true)
    assert.equal(settings.clockShadowColor, "#112233")
    assert.equal(settings.clockGlowEnabled, true)
    assert.equal(settings.clockGlowColor, "#445566")
    assert.equal(
      sanitizeChimerSettingsForEntitlements({
        backgroundId: "massage-lab-hole",
      }, {
        featureKeys: [],
        ownedBackgroundIds: [ownedBackgroundId],
      }).backgroundId,
      DEFAULT_CHIMER_SETTINGS.backgroundId,
    )
  })
})
