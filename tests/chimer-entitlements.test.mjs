import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { FEATURE_KEYS } from "../lib/membership.js"
import {
  DEFAULT_CHIMER_SETTINGS,
  sanitizeChimerSettingsForEntitlements,
} from "../lib/chimer-timer.js"

describe("Chimer entitlement-aware settings", () => {
  it("resets Eldora Novatrix controls without premium background access", () => {
    const input = {
      backgroundId: "eldora-novatrix-background",
      eldoraNovatrixPaletteMode: "harmony",
      eldoraNovatrixPrimaryColor: "#AABBCC",
      eldoraNovatrixHarmony: "triad",
      eldoraNovatrixColor: "#DDEEFF",
      eldoraNovatrixSpeed: 2.4,
      eldoraNovatrixAmplitude: 0.3,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    assert.equal(freeSettings.eldoraNovatrixPaletteMode, DEFAULT_CHIMER_SETTINGS.eldoraNovatrixPaletteMode)
    assert.equal(freeSettings.eldoraNovatrixPrimaryColor, DEFAULT_CHIMER_SETTINGS.eldoraNovatrixPrimaryColor)
    assert.equal(freeSettings.eldoraNovatrixHarmony, DEFAULT_CHIMER_SETTINGS.eldoraNovatrixHarmony)
    assert.equal(freeSettings.eldoraNovatrixColor, DEFAULT_CHIMER_SETTINGS.eldoraNovatrixColor)
    assert.equal(freeSettings.eldoraNovatrixSpeed, DEFAULT_CHIMER_SETTINGS.eldoraNovatrixSpeed)
    assert.equal(freeSettings.eldoraNovatrixAmplitude, DEFAULT_CHIMER_SETTINGS.eldoraNovatrixAmplitude)

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "eldora-novatrix-background")
    assert.equal(premiumSettings.eldoraNovatrixPaletteMode, "harmony")
    assert.equal(premiumSettings.eldoraNovatrixPrimaryColor, "#AABBCC")
    assert.equal(premiumSettings.eldoraNovatrixHarmony, "triad")
    assert.equal(premiumSettings.eldoraNovatrixColor, "#DDEEFF")
    assert.equal(premiumSettings.eldoraNovatrixSpeed, 2.4)
    assert.equal(premiumSettings.eldoraNovatrixAmplitude, 0.3)
  })

  it("resets Eldora Hacker controls without premium background access", () => {
    const input = {
      backgroundId: "eldora-hacker-background",
      eldoraHackerPaletteMode: "harmony",
      eldoraHackerPrimaryColor: "#00D4FF",
      eldoraHackerHarmony: "triad",
      eldoraHackerColor: "#22D3EE",
      eldoraHackerSpeed: 2.4,
      eldoraHackerFontSize: 22,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    assert.equal(freeSettings.eldoraHackerPaletteMode, DEFAULT_CHIMER_SETTINGS.eldoraHackerPaletteMode)
    assert.equal(freeSettings.eldoraHackerPrimaryColor, DEFAULT_CHIMER_SETTINGS.eldoraHackerPrimaryColor)
    assert.equal(freeSettings.eldoraHackerHarmony, DEFAULT_CHIMER_SETTINGS.eldoraHackerHarmony)
    assert.equal(freeSettings.eldoraHackerColor, DEFAULT_CHIMER_SETTINGS.eldoraHackerColor)
    assert.equal(freeSettings.eldoraHackerSpeed, DEFAULT_CHIMER_SETTINGS.eldoraHackerSpeed)
    assert.equal(freeSettings.eldoraHackerFontSize, DEFAULT_CHIMER_SETTINGS.eldoraHackerFontSize)

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "eldora-hacker-background")
    assert.equal(premiumSettings.eldoraHackerPaletteMode, "harmony")
    assert.equal(premiumSettings.eldoraHackerPrimaryColor, "#00D4FF")
    assert.equal(premiumSettings.eldoraHackerHarmony, "triad")
    assert.equal(premiumSettings.eldoraHackerColor, "#22D3EE")
    assert.equal(premiumSettings.eldoraHackerSpeed, 2.4)
    assert.equal(premiumSettings.eldoraHackerFontSize, 22)
  })

  it("resets Eldora Photon Beam controls without premium background access", () => {
    const input = {
      backgroundId: "eldora-photon-beam",
      eldoraPhotonBeamPaletteMode: "harmony",
      eldoraPhotonBeamPrimaryColor: "#00D4FF",
      eldoraPhotonBeamHarmony: "triad",
      eldoraPhotonBeamColorBg: "#010203",
      eldoraPhotonBeamColorLine: "#123456",
      eldoraPhotonBeamColorSignal: "#ABCDEF",
      eldoraPhotonBeamUseColor2: true,
      eldoraPhotonBeamColorSignal2: "#FEDCBA",
      eldoraPhotonBeamUseColor3: true,
      eldoraPhotonBeamColorSignal3: "#22D3EE",
      eldoraPhotonBeamLineCount: 120,
      eldoraPhotonBeamSpreadHeight: 64,
      eldoraPhotonBeamSpreadDepth: 18,
      eldoraPhotonBeamCurveLength: 80,
      eldoraPhotonBeamStraightLength: 160,
      eldoraPhotonBeamCurvePower: 1.25,
      eldoraPhotonBeamWaveSpeed: 4.5,
      eldoraPhotonBeamWaveHeight: 0.6,
      eldoraPhotonBeamLineOpacity: 0.82,
      eldoraPhotonBeamSignalCount: 140,
      eldoraPhotonBeamSpeedGlobal: 1.4,
      eldoraPhotonBeamTrailLength: 8,
      eldoraPhotonBeamBloomStrength: 4.2,
      eldoraPhotonBeamBloomRadius: 1.1,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    assert.equal(freeSettings.eldoraPhotonBeamPaletteMode, DEFAULT_CHIMER_SETTINGS.eldoraPhotonBeamPaletteMode)
    assert.equal(freeSettings.eldoraPhotonBeamPrimaryColor, DEFAULT_CHIMER_SETTINGS.eldoraPhotonBeamPrimaryColor)
    assert.equal(freeSettings.eldoraPhotonBeamHarmony, DEFAULT_CHIMER_SETTINGS.eldoraPhotonBeamHarmony)
    assert.equal(freeSettings.eldoraPhotonBeamColorBg, DEFAULT_CHIMER_SETTINGS.eldoraPhotonBeamColorBg)
    assert.equal(freeSettings.eldoraPhotonBeamColorLine, DEFAULT_CHIMER_SETTINGS.eldoraPhotonBeamColorLine)
    assert.equal(freeSettings.eldoraPhotonBeamColorSignal, DEFAULT_CHIMER_SETTINGS.eldoraPhotonBeamColorSignal)
    assert.equal(freeSettings.eldoraPhotonBeamUseColor2, DEFAULT_CHIMER_SETTINGS.eldoraPhotonBeamUseColor2)
    assert.equal(freeSettings.eldoraPhotonBeamColorSignal2, DEFAULT_CHIMER_SETTINGS.eldoraPhotonBeamColorSignal2)
    assert.equal(freeSettings.eldoraPhotonBeamUseColor3, DEFAULT_CHIMER_SETTINGS.eldoraPhotonBeamUseColor3)
    assert.equal(freeSettings.eldoraPhotonBeamColorSignal3, DEFAULT_CHIMER_SETTINGS.eldoraPhotonBeamColorSignal3)
    assert.equal(freeSettings.eldoraPhotonBeamLineCount, DEFAULT_CHIMER_SETTINGS.eldoraPhotonBeamLineCount)
    assert.equal(freeSettings.eldoraPhotonBeamSpreadHeight, DEFAULT_CHIMER_SETTINGS.eldoraPhotonBeamSpreadHeight)
    assert.equal(freeSettings.eldoraPhotonBeamSpreadDepth, DEFAULT_CHIMER_SETTINGS.eldoraPhotonBeamSpreadDepth)
    assert.equal(freeSettings.eldoraPhotonBeamCurveLength, DEFAULT_CHIMER_SETTINGS.eldoraPhotonBeamCurveLength)
    assert.equal(freeSettings.eldoraPhotonBeamStraightLength, DEFAULT_CHIMER_SETTINGS.eldoraPhotonBeamStraightLength)
    assert.equal(freeSettings.eldoraPhotonBeamCurvePower, DEFAULT_CHIMER_SETTINGS.eldoraPhotonBeamCurvePower)
    assert.equal(freeSettings.eldoraPhotonBeamWaveSpeed, DEFAULT_CHIMER_SETTINGS.eldoraPhotonBeamWaveSpeed)
    assert.equal(freeSettings.eldoraPhotonBeamWaveHeight, DEFAULT_CHIMER_SETTINGS.eldoraPhotonBeamWaveHeight)
    assert.equal(freeSettings.eldoraPhotonBeamLineOpacity, DEFAULT_CHIMER_SETTINGS.eldoraPhotonBeamLineOpacity)
    assert.equal(freeSettings.eldoraPhotonBeamSignalCount, DEFAULT_CHIMER_SETTINGS.eldoraPhotonBeamSignalCount)
    assert.equal(freeSettings.eldoraPhotonBeamSpeedGlobal, DEFAULT_CHIMER_SETTINGS.eldoraPhotonBeamSpeedGlobal)
    assert.equal(freeSettings.eldoraPhotonBeamTrailLength, DEFAULT_CHIMER_SETTINGS.eldoraPhotonBeamTrailLength)
    assert.equal(freeSettings.eldoraPhotonBeamBloomStrength, DEFAULT_CHIMER_SETTINGS.eldoraPhotonBeamBloomStrength)
    assert.equal(freeSettings.eldoraPhotonBeamBloomRadius, DEFAULT_CHIMER_SETTINGS.eldoraPhotonBeamBloomRadius)

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, ["premium_backgrounds"])

    assert.equal(premiumSettings.backgroundId, "eldora-photon-beam")
    assert.equal(premiumSettings.eldoraPhotonBeamPaletteMode, "harmony")
    assert.equal(premiumSettings.eldoraPhotonBeamPrimaryColor, "#00D4FF")
    assert.equal(premiumSettings.eldoraPhotonBeamHarmony, "triad")
    assert.equal(premiumSettings.eldoraPhotonBeamColorBg, "#010203")
    assert.equal(premiumSettings.eldoraPhotonBeamColorLine, "#123456")
    assert.equal(premiumSettings.eldoraPhotonBeamColorSignal, "#ABCDEF")
    assert.equal(premiumSettings.eldoraPhotonBeamUseColor2, true)
    assert.equal(premiumSettings.eldoraPhotonBeamColorSignal2, "#FEDCBA")
    assert.equal(premiumSettings.eldoraPhotonBeamUseColor3, true)
    assert.equal(premiumSettings.eldoraPhotonBeamColorSignal3, "#22D3EE")
    assert.equal(premiumSettings.eldoraPhotonBeamLineCount, 120)
    assert.equal(premiumSettings.eldoraPhotonBeamSpreadHeight, 64)
    assert.equal(premiumSettings.eldoraPhotonBeamSpreadDepth, 18)
    assert.equal(premiumSettings.eldoraPhotonBeamCurveLength, 80)
    assert.equal(premiumSettings.eldoraPhotonBeamStraightLength, 160)
    assert.equal(premiumSettings.eldoraPhotonBeamCurvePower, 1.25)
    assert.equal(premiumSettings.eldoraPhotonBeamWaveSpeed, 4.5)
    assert.equal(premiumSettings.eldoraPhotonBeamWaveHeight, 0.6)
    assert.equal(premiumSettings.eldoraPhotonBeamLineOpacity, 0.82)
    assert.equal(premiumSettings.eldoraPhotonBeamSignalCount, 140)
    assert.equal(premiumSettings.eldoraPhotonBeamSpeedGlobal, 1.4)
    assert.equal(premiumSettings.eldoraPhotonBeamTrailLength, 8)
    assert.equal(premiumSettings.eldoraPhotonBeamBloomStrength, 4.2)
    assert.equal(premiumSettings.eldoraPhotonBeamBloomRadius, 1.1)
  })

  it("resets React Bits Ferrofluid controls without premium background access", () => {
    const input = {
      backgroundId: "react-bits-ferrofluid",
      reactBitsFerrofluidPaletteMode: "harmony",
      reactBitsFerrofluidPrimaryColor: "#FFFFFF",
      reactBitsFerrofluidHarmony: "triad",
      reactBitsFerrofluidColorOne: "#010203",
      reactBitsFerrofluidColorTwo: "#AABBCC",
      reactBitsFerrofluidColorThree: "#DDEEFF",
      reactBitsFerrofluidSpeed: 1.4,
      reactBitsFerrofluidScale: 2.5,
      reactBitsFerrofluidTurbulence: 1.6,
      reactBitsFerrofluidFluidity: 0.2,
      reactBitsFerrofluidRimWidth: 0.35,
      reactBitsFerrofluidSharpness: 4.2,
      reactBitsFerrofluidShimmer: 2.8,
      reactBitsFerrofluidGlow: 3.4,
      reactBitsFerrofluidFlowDirection: "left",
      reactBitsFerrofluidOpacity: 0.72,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    assert.equal(
      freeSettings.reactBitsFerrofluidPaletteMode,
      DEFAULT_CHIMER_SETTINGS.reactBitsFerrofluidPaletteMode,
    )
    assert.equal(
      freeSettings.reactBitsFerrofluidPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.reactBitsFerrofluidPrimaryColor,
    )
    assert.equal(freeSettings.reactBitsFerrofluidHarmony, DEFAULT_CHIMER_SETTINGS.reactBitsFerrofluidHarmony)
    assert.equal(freeSettings.reactBitsFerrofluidColorOne, DEFAULT_CHIMER_SETTINGS.reactBitsFerrofluidColorOne)
    assert.equal(freeSettings.reactBitsFerrofluidColorTwo, DEFAULT_CHIMER_SETTINGS.reactBitsFerrofluidColorTwo)
    assert.equal(freeSettings.reactBitsFerrofluidColorThree, DEFAULT_CHIMER_SETTINGS.reactBitsFerrofluidColorThree)
    assert.equal(freeSettings.reactBitsFerrofluidSpeed, DEFAULT_CHIMER_SETTINGS.reactBitsFerrofluidSpeed)
    assert.equal(freeSettings.reactBitsFerrofluidScale, DEFAULT_CHIMER_SETTINGS.reactBitsFerrofluidScale)
    assert.equal(freeSettings.reactBitsFerrofluidTurbulence, DEFAULT_CHIMER_SETTINGS.reactBitsFerrofluidTurbulence)
    assert.equal(freeSettings.reactBitsFerrofluidFluidity, DEFAULT_CHIMER_SETTINGS.reactBitsFerrofluidFluidity)
    assert.equal(freeSettings.reactBitsFerrofluidRimWidth, DEFAULT_CHIMER_SETTINGS.reactBitsFerrofluidRimWidth)
    assert.equal(freeSettings.reactBitsFerrofluidSharpness, DEFAULT_CHIMER_SETTINGS.reactBitsFerrofluidSharpness)
    assert.equal(freeSettings.reactBitsFerrofluidShimmer, DEFAULT_CHIMER_SETTINGS.reactBitsFerrofluidShimmer)
    assert.equal(freeSettings.reactBitsFerrofluidGlow, DEFAULT_CHIMER_SETTINGS.reactBitsFerrofluidGlow)
    assert.equal(
      freeSettings.reactBitsFerrofluidFlowDirection,
      DEFAULT_CHIMER_SETTINGS.reactBitsFerrofluidFlowDirection,
    )
    assert.equal(freeSettings.reactBitsFerrofluidOpacity, DEFAULT_CHIMER_SETTINGS.reactBitsFerrofluidOpacity)

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "react-bits-ferrofluid")
    assert.equal(premiumSettings.reactBitsFerrofluidPaletteMode, "harmony")
    assert.equal(premiumSettings.reactBitsFerrofluidPrimaryColor, "#FFFFFF")
    assert.equal(premiumSettings.reactBitsFerrofluidHarmony, "triad")
    assert.equal(premiumSettings.reactBitsFerrofluidColorOne, "#010203")
    assert.equal(premiumSettings.reactBitsFerrofluidColorTwo, "#AABBCC")
    assert.equal(premiumSettings.reactBitsFerrofluidColorThree, "#DDEEFF")
    assert.equal(premiumSettings.reactBitsFerrofluidSpeed, 1.4)
    assert.equal(premiumSettings.reactBitsFerrofluidScale, 2.5)
    assert.equal(premiumSettings.reactBitsFerrofluidTurbulence, 1.6)
    assert.equal(premiumSettings.reactBitsFerrofluidFluidity, 0.2)
    assert.equal(premiumSettings.reactBitsFerrofluidRimWidth, 0.35)
    assert.equal(premiumSettings.reactBitsFerrofluidSharpness, 4.2)
    assert.equal(premiumSettings.reactBitsFerrofluidShimmer, 2.8)
    assert.equal(premiumSettings.reactBitsFerrofluidGlow, 3.4)
    assert.equal(premiumSettings.reactBitsFerrofluidFlowDirection, "left")
    assert.equal(premiumSettings.reactBitsFerrofluidOpacity, 0.72)
  })

  it("resets React Bits Lightfall controls without premium background access", () => {
    const input = {
      backgroundId: "react-bits-lightfall",
      reactBitsLightfallPaletteMode: "harmony",
      reactBitsLightfallPrimaryColor: "#A6C8FF",
      reactBitsLightfallHarmony: "triad",
      reactBitsLightfallColorOne: "#010203",
      reactBitsLightfallColorTwo: "#AABBCC",
      reactBitsLightfallColorThree: "#DDEEFF",
      reactBitsLightfallBackgroundColor: "#0A29FF",
      reactBitsLightfallSpeed: 1.4,
      reactBitsLightfallStreakCount: 8,
      reactBitsLightfallStreakWidth: 1.6,
      reactBitsLightfallStreakLength: 2.4,
      reactBitsLightfallGlow: 2.2,
      reactBitsLightfallDensity: 1.2,
      reactBitsLightfallTwinkle: 0.35,
      reactBitsLightfallZoom: 4.2,
      reactBitsLightfallBackgroundGlow: 0.9,
      reactBitsLightfallOpacity: 0.72,
      reactBitsLightfallCursorEnabled: true,
      reactBitsLightfallCursorStrength: 1.3,
      reactBitsLightfallCursorRadius: 1.7,
      reactBitsLightfallCursorDampening: 0.25,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    assert.equal(
      freeSettings.reactBitsLightfallPaletteMode,
      DEFAULT_CHIMER_SETTINGS.reactBitsLightfallPaletteMode,
    )
    assert.equal(
      freeSettings.reactBitsLightfallPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.reactBitsLightfallPrimaryColor,
    )
    assert.equal(freeSettings.reactBitsLightfallHarmony, DEFAULT_CHIMER_SETTINGS.reactBitsLightfallHarmony)
    assert.equal(freeSettings.reactBitsLightfallColorOne, DEFAULT_CHIMER_SETTINGS.reactBitsLightfallColorOne)
    assert.equal(freeSettings.reactBitsLightfallColorTwo, DEFAULT_CHIMER_SETTINGS.reactBitsLightfallColorTwo)
    assert.equal(freeSettings.reactBitsLightfallColorThree, DEFAULT_CHIMER_SETTINGS.reactBitsLightfallColorThree)
    assert.equal(
      freeSettings.reactBitsLightfallBackgroundColor,
      DEFAULT_CHIMER_SETTINGS.reactBitsLightfallBackgroundColor,
    )
    assert.equal(freeSettings.reactBitsLightfallSpeed, DEFAULT_CHIMER_SETTINGS.reactBitsLightfallSpeed)
    assert.equal(freeSettings.reactBitsLightfallStreakCount, DEFAULT_CHIMER_SETTINGS.reactBitsLightfallStreakCount)
    assert.equal(freeSettings.reactBitsLightfallStreakWidth, DEFAULT_CHIMER_SETTINGS.reactBitsLightfallStreakWidth)
    assert.equal(freeSettings.reactBitsLightfallStreakLength, DEFAULT_CHIMER_SETTINGS.reactBitsLightfallStreakLength)
    assert.equal(freeSettings.reactBitsLightfallGlow, DEFAULT_CHIMER_SETTINGS.reactBitsLightfallGlow)
    assert.equal(freeSettings.reactBitsLightfallDensity, DEFAULT_CHIMER_SETTINGS.reactBitsLightfallDensity)
    assert.equal(freeSettings.reactBitsLightfallTwinkle, DEFAULT_CHIMER_SETTINGS.reactBitsLightfallTwinkle)
    assert.equal(freeSettings.reactBitsLightfallZoom, DEFAULT_CHIMER_SETTINGS.reactBitsLightfallZoom)
    assert.equal(
      freeSettings.reactBitsLightfallBackgroundGlow,
      DEFAULT_CHIMER_SETTINGS.reactBitsLightfallBackgroundGlow,
    )
    assert.equal(freeSettings.reactBitsLightfallOpacity, DEFAULT_CHIMER_SETTINGS.reactBitsLightfallOpacity)
    assert.equal(
      freeSettings.reactBitsLightfallCursorEnabled,
      DEFAULT_CHIMER_SETTINGS.reactBitsLightfallCursorEnabled,
    )
    assert.equal(
      freeSettings.reactBitsLightfallCursorStrength,
      DEFAULT_CHIMER_SETTINGS.reactBitsLightfallCursorStrength,
    )
    assert.equal(
      freeSettings.reactBitsLightfallCursorRadius,
      DEFAULT_CHIMER_SETTINGS.reactBitsLightfallCursorRadius,
    )
    assert.equal(
      freeSettings.reactBitsLightfallCursorDampening,
      DEFAULT_CHIMER_SETTINGS.reactBitsLightfallCursorDampening,
    )

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "react-bits-lightfall")
    assert.equal(premiumSettings.reactBitsLightfallPaletteMode, "harmony")
    assert.equal(premiumSettings.reactBitsLightfallPrimaryColor, "#A6C8FF")
    assert.equal(premiumSettings.reactBitsLightfallHarmony, "triad")
    assert.equal(premiumSettings.reactBitsLightfallColorOne, "#010203")
    assert.equal(premiumSettings.reactBitsLightfallColorTwo, "#AABBCC")
    assert.equal(premiumSettings.reactBitsLightfallColorThree, "#DDEEFF")
    assert.equal(premiumSettings.reactBitsLightfallBackgroundColor, "#0A29FF")
    assert.equal(premiumSettings.reactBitsLightfallSpeed, 1.4)
    assert.equal(premiumSettings.reactBitsLightfallStreakCount, 8)
    assert.equal(premiumSettings.reactBitsLightfallStreakWidth, 1.6)
    assert.equal(premiumSettings.reactBitsLightfallStreakLength, 2.4)
    assert.equal(premiumSettings.reactBitsLightfallGlow, 2.2)
    assert.equal(premiumSettings.reactBitsLightfallDensity, 1.2)
    assert.equal(premiumSettings.reactBitsLightfallTwinkle, 0.35)
    assert.equal(premiumSettings.reactBitsLightfallZoom, 4.2)
    assert.equal(premiumSettings.reactBitsLightfallBackgroundGlow, 0.9)
    assert.equal(premiumSettings.reactBitsLightfallOpacity, 0.72)
    assert.equal(premiumSettings.reactBitsLightfallCursorEnabled, true)
    assert.equal(premiumSettings.reactBitsLightfallCursorStrength, 1.3)
    assert.equal(premiumSettings.reactBitsLightfallCursorRadius, 1.7)
    assert.equal(premiumSettings.reactBitsLightfallCursorDampening, 0.25)
  })

  it("resets React Bits Liquid Ether controls without premium background access", () => {
    const input = {
      backgroundId: "react-bits-liquid-ether",
      reactBitsLiquidEtherPaletteMode: "harmony",
      reactBitsLiquidEtherPrimaryColor: "#5227FF",
      reactBitsLiquidEtherHarmony: "triad",
      reactBitsLiquidEtherColorOne: "#010203",
      reactBitsLiquidEtherColorTwo: "#AABBCC",
      reactBitsLiquidEtherColorThree: "#DDEEFF",
      reactBitsLiquidEtherCursorEnabled: true,
      reactBitsLiquidEtherMouseForce: 54,
      reactBitsLiquidEtherCursorSize: 180,
      reactBitsLiquidEtherIsViscous: true,
      reactBitsLiquidEtherViscous: 42,
      reactBitsLiquidEtherIterationsViscous: 24,
      reactBitsLiquidEtherIterationsPoisson: 40,
      reactBitsLiquidEtherDt: 0.02,
      reactBitsLiquidEtherBfecc: false,
      reactBitsLiquidEtherResolution: 0.75,
      reactBitsLiquidEtherIsBounce: true,
      reactBitsLiquidEtherAutoDemo: false,
      reactBitsLiquidEtherAutoSpeed: 1.25,
      reactBitsLiquidEtherAutoIntensity: 3.4,
      reactBitsLiquidEtherAutoResumeDelay: 1500,
      reactBitsLiquidEtherAutoRampDuration: 1.2,
      reactBitsLiquidEtherOpacity: 0.72,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    assert.equal(
      freeSettings.reactBitsLiquidEtherPaletteMode,
      DEFAULT_CHIMER_SETTINGS.reactBitsLiquidEtherPaletteMode,
    )
    assert.equal(
      freeSettings.reactBitsLiquidEtherPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.reactBitsLiquidEtherPrimaryColor,
    )
    assert.equal(freeSettings.reactBitsLiquidEtherHarmony, DEFAULT_CHIMER_SETTINGS.reactBitsLiquidEtherHarmony)
    assert.equal(freeSettings.reactBitsLiquidEtherColorOne, DEFAULT_CHIMER_SETTINGS.reactBitsLiquidEtherColorOne)
    assert.equal(freeSettings.reactBitsLiquidEtherColorTwo, DEFAULT_CHIMER_SETTINGS.reactBitsLiquidEtherColorTwo)
    assert.equal(freeSettings.reactBitsLiquidEtherColorThree, DEFAULT_CHIMER_SETTINGS.reactBitsLiquidEtherColorThree)
    assert.equal(
      freeSettings.reactBitsLiquidEtherCursorEnabled,
      DEFAULT_CHIMER_SETTINGS.reactBitsLiquidEtherCursorEnabled,
    )
    assert.equal(freeSettings.reactBitsLiquidEtherMouseForce, DEFAULT_CHIMER_SETTINGS.reactBitsLiquidEtherMouseForce)
    assert.equal(freeSettings.reactBitsLiquidEtherCursorSize, DEFAULT_CHIMER_SETTINGS.reactBitsLiquidEtherCursorSize)
    assert.equal(
      freeSettings.reactBitsLiquidEtherIsViscous,
      DEFAULT_CHIMER_SETTINGS.reactBitsLiquidEtherIsViscous,
    )
    assert.equal(freeSettings.reactBitsLiquidEtherViscous, DEFAULT_CHIMER_SETTINGS.reactBitsLiquidEtherViscous)
    assert.equal(
      freeSettings.reactBitsLiquidEtherIterationsViscous,
      DEFAULT_CHIMER_SETTINGS.reactBitsLiquidEtherIterationsViscous,
    )
    assert.equal(
      freeSettings.reactBitsLiquidEtherIterationsPoisson,
      DEFAULT_CHIMER_SETTINGS.reactBitsLiquidEtherIterationsPoisson,
    )
    assert.equal(freeSettings.reactBitsLiquidEtherDt, DEFAULT_CHIMER_SETTINGS.reactBitsLiquidEtherDt)
    assert.equal(freeSettings.reactBitsLiquidEtherBfecc, DEFAULT_CHIMER_SETTINGS.reactBitsLiquidEtherBfecc)
    assert.equal(freeSettings.reactBitsLiquidEtherResolution, DEFAULT_CHIMER_SETTINGS.reactBitsLiquidEtherResolution)
    assert.equal(freeSettings.reactBitsLiquidEtherIsBounce, DEFAULT_CHIMER_SETTINGS.reactBitsLiquidEtherIsBounce)
    assert.equal(freeSettings.reactBitsLiquidEtherAutoDemo, DEFAULT_CHIMER_SETTINGS.reactBitsLiquidEtherAutoDemo)
    assert.equal(freeSettings.reactBitsLiquidEtherAutoSpeed, DEFAULT_CHIMER_SETTINGS.reactBitsLiquidEtherAutoSpeed)
    assert.equal(
      freeSettings.reactBitsLiquidEtherAutoIntensity,
      DEFAULT_CHIMER_SETTINGS.reactBitsLiquidEtherAutoIntensity,
    )
    assert.equal(
      freeSettings.reactBitsLiquidEtherAutoResumeDelay,
      DEFAULT_CHIMER_SETTINGS.reactBitsLiquidEtherAutoResumeDelay,
    )
    assert.equal(
      freeSettings.reactBitsLiquidEtherAutoRampDuration,
      DEFAULT_CHIMER_SETTINGS.reactBitsLiquidEtherAutoRampDuration,
    )
    assert.equal(freeSettings.reactBitsLiquidEtherOpacity, DEFAULT_CHIMER_SETTINGS.reactBitsLiquidEtherOpacity)

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "react-bits-liquid-ether")
    assert.equal(premiumSettings.reactBitsLiquidEtherPaletteMode, "harmony")
    assert.equal(premiumSettings.reactBitsLiquidEtherPrimaryColor, "#5227FF")
    assert.equal(premiumSettings.reactBitsLiquidEtherHarmony, "triad")
    assert.equal(premiumSettings.reactBitsLiquidEtherColorOne, "#010203")
    assert.equal(premiumSettings.reactBitsLiquidEtherColorTwo, "#AABBCC")
    assert.equal(premiumSettings.reactBitsLiquidEtherColorThree, "#DDEEFF")
    assert.equal(premiumSettings.reactBitsLiquidEtherCursorEnabled, true)
    assert.equal(premiumSettings.reactBitsLiquidEtherMouseForce, 54)
    assert.equal(premiumSettings.reactBitsLiquidEtherCursorSize, 180)
    assert.equal(premiumSettings.reactBitsLiquidEtherIsViscous, true)
    assert.equal(premiumSettings.reactBitsLiquidEtherViscous, 42)
    assert.equal(premiumSettings.reactBitsLiquidEtherIterationsViscous, 24)
    assert.equal(premiumSettings.reactBitsLiquidEtherIterationsPoisson, 40)
    assert.equal(premiumSettings.reactBitsLiquidEtherDt, 0.02)
    assert.equal(premiumSettings.reactBitsLiquidEtherBfecc, false)
    assert.equal(premiumSettings.reactBitsLiquidEtherResolution, 0.75)
    assert.equal(premiumSettings.reactBitsLiquidEtherIsBounce, true)
    assert.equal(premiumSettings.reactBitsLiquidEtherAutoDemo, false)
    assert.equal(premiumSettings.reactBitsLiquidEtherAutoSpeed, 1.25)
    assert.equal(premiumSettings.reactBitsLiquidEtherAutoIntensity, 3.4)
    assert.equal(premiumSettings.reactBitsLiquidEtherAutoResumeDelay, 1500)
    assert.equal(premiumSettings.reactBitsLiquidEtherAutoRampDuration, 1.2)
    assert.equal(premiumSettings.reactBitsLiquidEtherOpacity, 0.72)
  })

  it("resets React Bits Prism controls without premium background access", () => {
    const input = {
      backgroundId: "react-bits-prism",
      reactBitsPrismHeight: 6.2,
      reactBitsPrismBaseWidth: 7.4,
      reactBitsPrismAnimationType: "hover",
      reactBitsPrismGlow: 2.4,
      reactBitsPrismOffsetX: 120,
      reactBitsPrismOffsetY: -80,
      reactBitsPrismNoise: 0.2,
      reactBitsPrismTransparent: false,
      reactBitsPrismScale: 4.8,
      reactBitsPrismHueShift: 1.2,
      reactBitsPrismColorFrequency: 1.8,
      reactBitsPrismHoverStrength: 3.2,
      reactBitsPrismInertia: 0.18,
      reactBitsPrismBloom: 2.6,
      reactBitsPrismTimeScale: 1.3,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    assert.equal(freeSettings.reactBitsPrismHeight, DEFAULT_CHIMER_SETTINGS.reactBitsPrismHeight)
    assert.equal(freeSettings.reactBitsPrismBaseWidth, DEFAULT_CHIMER_SETTINGS.reactBitsPrismBaseWidth)
    assert.equal(freeSettings.reactBitsPrismAnimationType, DEFAULT_CHIMER_SETTINGS.reactBitsPrismAnimationType)
    assert.equal(freeSettings.reactBitsPrismGlow, DEFAULT_CHIMER_SETTINGS.reactBitsPrismGlow)
    assert.equal(freeSettings.reactBitsPrismOffsetX, DEFAULT_CHIMER_SETTINGS.reactBitsPrismOffsetX)
    assert.equal(freeSettings.reactBitsPrismOffsetY, DEFAULT_CHIMER_SETTINGS.reactBitsPrismOffsetY)
    assert.equal(freeSettings.reactBitsPrismNoise, DEFAULT_CHIMER_SETTINGS.reactBitsPrismNoise)
    assert.equal(freeSettings.reactBitsPrismTransparent, DEFAULT_CHIMER_SETTINGS.reactBitsPrismTransparent)
    assert.equal(freeSettings.reactBitsPrismScale, DEFAULT_CHIMER_SETTINGS.reactBitsPrismScale)
    assert.equal(freeSettings.reactBitsPrismHueShift, DEFAULT_CHIMER_SETTINGS.reactBitsPrismHueShift)
    assert.equal(freeSettings.reactBitsPrismColorFrequency, DEFAULT_CHIMER_SETTINGS.reactBitsPrismColorFrequency)
    assert.equal(freeSettings.reactBitsPrismHoverStrength, DEFAULT_CHIMER_SETTINGS.reactBitsPrismHoverStrength)
    assert.equal(freeSettings.reactBitsPrismInertia, DEFAULT_CHIMER_SETTINGS.reactBitsPrismInertia)
    assert.equal(freeSettings.reactBitsPrismBloom, DEFAULT_CHIMER_SETTINGS.reactBitsPrismBloom)
    assert.equal(freeSettings.reactBitsPrismTimeScale, DEFAULT_CHIMER_SETTINGS.reactBitsPrismTimeScale)

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "react-bits-prism")
    assert.equal(premiumSettings.reactBitsPrismHeight, 6.2)
    assert.equal(premiumSettings.reactBitsPrismBaseWidth, 7.4)
    assert.equal(premiumSettings.reactBitsPrismAnimationType, "hover")
    assert.equal(premiumSettings.reactBitsPrismGlow, 2.4)
    assert.equal(premiumSettings.reactBitsPrismOffsetX, 120)
    assert.equal(premiumSettings.reactBitsPrismOffsetY, -80)
    assert.equal(premiumSettings.reactBitsPrismNoise, 0.2)
    assert.equal(premiumSettings.reactBitsPrismTransparent, false)
    assert.equal(premiumSettings.reactBitsPrismScale, 4.8)
    assert.equal(premiumSettings.reactBitsPrismHueShift, 1.2)
    assert.equal(premiumSettings.reactBitsPrismColorFrequency, 1.8)
    assert.equal(premiumSettings.reactBitsPrismHoverStrength, 3.2)
    assert.equal(premiumSettings.reactBitsPrismInertia, 0.18)
    assert.equal(premiumSettings.reactBitsPrismBloom, 2.6)
    assert.equal(premiumSettings.reactBitsPrismTimeScale, 1.3)
  })

  it("resets React Bits Dark Veil controls without premium background access", () => {
    const input = {
      backgroundId: "react-bits-dark-veil",
      reactBitsDarkVeilHueShift: 72,
      reactBitsDarkVeilNoiseIntensity: 0.24,
      reactBitsDarkVeilScanlineIntensity: 0.42,
      reactBitsDarkVeilSpeed: 1.3,
      reactBitsDarkVeilScanlineFrequency: 18,
      reactBitsDarkVeilWarpAmount: 0.7,
      reactBitsDarkVeilResolutionScale: 0.65,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    assert.equal(freeSettings.reactBitsDarkVeilHueShift, DEFAULT_CHIMER_SETTINGS.reactBitsDarkVeilHueShift)
    assert.equal(
      freeSettings.reactBitsDarkVeilNoiseIntensity,
      DEFAULT_CHIMER_SETTINGS.reactBitsDarkVeilNoiseIntensity,
    )
    assert.equal(
      freeSettings.reactBitsDarkVeilScanlineIntensity,
      DEFAULT_CHIMER_SETTINGS.reactBitsDarkVeilScanlineIntensity,
    )
    assert.equal(freeSettings.reactBitsDarkVeilSpeed, DEFAULT_CHIMER_SETTINGS.reactBitsDarkVeilSpeed)
    assert.equal(
      freeSettings.reactBitsDarkVeilScanlineFrequency,
      DEFAULT_CHIMER_SETTINGS.reactBitsDarkVeilScanlineFrequency,
    )
    assert.equal(freeSettings.reactBitsDarkVeilWarpAmount, DEFAULT_CHIMER_SETTINGS.reactBitsDarkVeilWarpAmount)
    assert.equal(
      freeSettings.reactBitsDarkVeilResolutionScale,
      DEFAULT_CHIMER_SETTINGS.reactBitsDarkVeilResolutionScale,
    )

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "react-bits-dark-veil")
    assert.equal(premiumSettings.reactBitsDarkVeilHueShift, 72)
    assert.equal(premiumSettings.reactBitsDarkVeilNoiseIntensity, 0.24)
    assert.equal(premiumSettings.reactBitsDarkVeilScanlineIntensity, 0.42)
    assert.equal(premiumSettings.reactBitsDarkVeilSpeed, 1.3)
    assert.equal(premiumSettings.reactBitsDarkVeilScanlineFrequency, 18)
    assert.equal(premiumSettings.reactBitsDarkVeilWarpAmount, 0.7)
    assert.equal(premiumSettings.reactBitsDarkVeilResolutionScale, 0.65)
  })

  it("resets React Bits Light Pillar controls without premium background access", () => {
    const input = {
      backgroundId: "react-bits-light-pillar",
      reactBitsLightPillarPaletteMode: "harmony",
      reactBitsLightPillarPrimaryColor: "#123456",
      reactBitsLightPillarHarmony: "triad",
      reactBitsLightPillarTopColor: "#ABCDEF",
      reactBitsLightPillarBottomColor: "#FEDCBA",
      reactBitsLightPillarIntensity: 2.4,
      reactBitsLightPillarRotationSpeed: 1.2,
      reactBitsLightPillarInteractive: true,
      reactBitsLightPillarGlowAmount: 0.02,
      reactBitsLightPillarWidth: 5.4,
      reactBitsLightPillarHeight: 1.2,
      reactBitsLightPillarNoiseIntensity: 0.7,
      reactBitsLightPillarBlendMode: "normal",
      reactBitsLightPillarRotation: 44,
      reactBitsLightPillarQuality: "medium",
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    assert.equal(
      freeSettings.reactBitsLightPillarPaletteMode,
      DEFAULT_CHIMER_SETTINGS.reactBitsLightPillarPaletteMode,
    )
    assert.equal(
      freeSettings.reactBitsLightPillarPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.reactBitsLightPillarPrimaryColor,
    )
    assert.equal(freeSettings.reactBitsLightPillarHarmony, DEFAULT_CHIMER_SETTINGS.reactBitsLightPillarHarmony)
    assert.equal(freeSettings.reactBitsLightPillarTopColor, DEFAULT_CHIMER_SETTINGS.reactBitsLightPillarTopColor)
    assert.equal(
      freeSettings.reactBitsLightPillarBottomColor,
      DEFAULT_CHIMER_SETTINGS.reactBitsLightPillarBottomColor,
    )
    assert.equal(freeSettings.reactBitsLightPillarIntensity, DEFAULT_CHIMER_SETTINGS.reactBitsLightPillarIntensity)
    assert.equal(
      freeSettings.reactBitsLightPillarRotationSpeed,
      DEFAULT_CHIMER_SETTINGS.reactBitsLightPillarRotationSpeed,
    )
    assert.equal(
      freeSettings.reactBitsLightPillarInteractive,
      DEFAULT_CHIMER_SETTINGS.reactBitsLightPillarInteractive,
    )
    assert.equal(
      freeSettings.reactBitsLightPillarGlowAmount,
      DEFAULT_CHIMER_SETTINGS.reactBitsLightPillarGlowAmount,
    )
    assert.equal(freeSettings.reactBitsLightPillarWidth, DEFAULT_CHIMER_SETTINGS.reactBitsLightPillarWidth)
    assert.equal(freeSettings.reactBitsLightPillarHeight, DEFAULT_CHIMER_SETTINGS.reactBitsLightPillarHeight)
    assert.equal(
      freeSettings.reactBitsLightPillarNoiseIntensity,
      DEFAULT_CHIMER_SETTINGS.reactBitsLightPillarNoiseIntensity,
    )
    assert.equal(freeSettings.reactBitsLightPillarBlendMode, DEFAULT_CHIMER_SETTINGS.reactBitsLightPillarBlendMode)
    assert.equal(freeSettings.reactBitsLightPillarRotation, DEFAULT_CHIMER_SETTINGS.reactBitsLightPillarRotation)
    assert.equal(freeSettings.reactBitsLightPillarQuality, DEFAULT_CHIMER_SETTINGS.reactBitsLightPillarQuality)

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, ["premium_backgrounds"])

    assert.equal(premiumSettings.backgroundId, "react-bits-light-pillar")
    assert.equal(premiumSettings.reactBitsLightPillarPaletteMode, "harmony")
    assert.equal(premiumSettings.reactBitsLightPillarPrimaryColor, "#123456")
    assert.equal(premiumSettings.reactBitsLightPillarHarmony, "triad")
    assert.equal(premiumSettings.reactBitsLightPillarTopColor, "#ABCDEF")
    assert.equal(premiumSettings.reactBitsLightPillarBottomColor, "#FEDCBA")
    assert.equal(premiumSettings.reactBitsLightPillarIntensity, 2.4)
    assert.equal(premiumSettings.reactBitsLightPillarRotationSpeed, 1.2)
    assert.equal(premiumSettings.reactBitsLightPillarInteractive, true)
    assert.equal(premiumSettings.reactBitsLightPillarGlowAmount, 0.02)
    assert.equal(premiumSettings.reactBitsLightPillarWidth, 5.4)
    assert.equal(premiumSettings.reactBitsLightPillarHeight, 1.2)
    assert.equal(premiumSettings.reactBitsLightPillarNoiseIntensity, 0.7)
    assert.equal(premiumSettings.reactBitsLightPillarBlendMode, "normal")
    assert.equal(premiumSettings.reactBitsLightPillarRotation, 44)
    assert.equal(premiumSettings.reactBitsLightPillarQuality, "medium")
  })

  it("resets React Bits Silk controls without premium background access", () => {
    const input = {
      backgroundId: "react-bits-silk",
      reactBitsSilkPaletteMode: "harmony",
      reactBitsSilkPrimaryColor: "#123456",
      reactBitsSilkHarmony: "triad",
      reactBitsSilkColor: "#ABCDEF",
      reactBitsSilkSpeed: 7.5,
      reactBitsSilkScale: 2.4,
      reactBitsSilkNoiseIntensity: 2.2,
      reactBitsSilkRotation: 1.4,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    assert.equal(freeSettings.reactBitsSilkPaletteMode, DEFAULT_CHIMER_SETTINGS.reactBitsSilkPaletteMode)
    assert.equal(freeSettings.reactBitsSilkPrimaryColor, DEFAULT_CHIMER_SETTINGS.reactBitsSilkPrimaryColor)
    assert.equal(freeSettings.reactBitsSilkHarmony, DEFAULT_CHIMER_SETTINGS.reactBitsSilkHarmony)
    assert.equal(freeSettings.reactBitsSilkColor, DEFAULT_CHIMER_SETTINGS.reactBitsSilkColor)
    assert.equal(freeSettings.reactBitsSilkSpeed, DEFAULT_CHIMER_SETTINGS.reactBitsSilkSpeed)
    assert.equal(freeSettings.reactBitsSilkScale, DEFAULT_CHIMER_SETTINGS.reactBitsSilkScale)
    assert.equal(freeSettings.reactBitsSilkNoiseIntensity, DEFAULT_CHIMER_SETTINGS.reactBitsSilkNoiseIntensity)
    assert.equal(freeSettings.reactBitsSilkRotation, DEFAULT_CHIMER_SETTINGS.reactBitsSilkRotation)

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, ["premium_backgrounds"])

    assert.equal(premiumSettings.backgroundId, "react-bits-silk")
    assert.equal(premiumSettings.reactBitsSilkPaletteMode, "harmony")
    assert.equal(premiumSettings.reactBitsSilkPrimaryColor, "#123456")
    assert.equal(premiumSettings.reactBitsSilkHarmony, "triad")
    assert.equal(premiumSettings.reactBitsSilkColor, "#ABCDEF")
    assert.equal(premiumSettings.reactBitsSilkSpeed, 7.5)
    assert.equal(premiumSettings.reactBitsSilkScale, 2.4)
    assert.equal(premiumSettings.reactBitsSilkNoiseIntensity, 2.2)
    assert.equal(premiumSettings.reactBitsSilkRotation, 1.4)
  })

  it("resets React Bits Floating Lines controls without premium background access", () => {
    const input = {
      backgroundId: "react-bits-floating-lines",
      reactBitsFloatingLinesPaletteMode: "harmony",
      reactBitsFloatingLinesPrimaryColor: "#123456",
      reactBitsFloatingLinesHarmony: "triad",
      reactBitsFloatingLinesColorOne: "#ABCDEF",
      reactBitsFloatingLinesColorTwo: "#FEDCBA",
      reactBitsFloatingLinesColorThree: "#010203",
      reactBitsFloatingLinesEnableTop: false,
      reactBitsFloatingLinesEnableMiddle: false,
      reactBitsFloatingLinesEnableBottom: true,
      reactBitsFloatingLinesTopLineCount: 12,
      reactBitsFloatingLinesMiddleLineCount: 10,
      reactBitsFloatingLinesBottomLineCount: 8,
      reactBitsFloatingLinesTopLineDistance: 4.5,
      reactBitsFloatingLinesMiddleLineDistance: 3.5,
      reactBitsFloatingLinesBottomLineDistance: 2.5,
      reactBitsFloatingLinesTopWaveX: 4.4,
      reactBitsFloatingLinesTopWaveY: 0.4,
      reactBitsFloatingLinesTopWaveRotate: -0.3,
      reactBitsFloatingLinesMiddleWaveX: 3.3,
      reactBitsFloatingLinesMiddleWaveY: 0.2,
      reactBitsFloatingLinesMiddleWaveRotate: 0.5,
      reactBitsFloatingLinesBottomWaveX: 2.2,
      reactBitsFloatingLinesBottomWaveY: -0.6,
      reactBitsFloatingLinesBottomWaveRotate: -0.9,
      reactBitsFloatingLinesAnimationSpeed: 1.5,
      reactBitsFloatingLinesInteractive: false,
      reactBitsFloatingLinesBendRadius: 7,
      reactBitsFloatingLinesBendStrength: -0.8,
      reactBitsFloatingLinesMouseDamping: 0.08,
      reactBitsFloatingLinesParallax: false,
      reactBitsFloatingLinesParallaxStrength: 0.4,
      reactBitsFloatingLinesBlendMode: "normal",
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    assert.equal(
      freeSettings.reactBitsFloatingLinesPaletteMode,
      DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesPaletteMode,
    )
    assert.equal(
      freeSettings.reactBitsFloatingLinesPrimaryColor,
      DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesPrimaryColor,
    )
    assert.equal(freeSettings.reactBitsFloatingLinesHarmony, DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesHarmony)
    assert.equal(freeSettings.reactBitsFloatingLinesColorOne, DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesColorOne)
    assert.equal(freeSettings.reactBitsFloatingLinesColorTwo, DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesColorTwo)
    assert.equal(
      freeSettings.reactBitsFloatingLinesColorThree,
      DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesColorThree,
    )
    assert.equal(freeSettings.reactBitsFloatingLinesEnableTop, DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesEnableTop)
    assert.equal(
      freeSettings.reactBitsFloatingLinesEnableMiddle,
      DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesEnableMiddle,
    )
    assert.equal(
      freeSettings.reactBitsFloatingLinesEnableBottom,
      DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesEnableBottom,
    )
    assert.equal(
      freeSettings.reactBitsFloatingLinesTopLineCount,
      DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesTopLineCount,
    )
    assert.equal(
      freeSettings.reactBitsFloatingLinesMiddleLineCount,
      DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesMiddleLineCount,
    )
    assert.equal(
      freeSettings.reactBitsFloatingLinesBottomLineCount,
      DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesBottomLineCount,
    )
    assert.equal(
      freeSettings.reactBitsFloatingLinesTopLineDistance,
      DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesTopLineDistance,
    )
    assert.equal(
      freeSettings.reactBitsFloatingLinesMiddleLineDistance,
      DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesMiddleLineDistance,
    )
    assert.equal(
      freeSettings.reactBitsFloatingLinesBottomLineDistance,
      DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesBottomLineDistance,
    )
    assert.equal(freeSettings.reactBitsFloatingLinesTopWaveX, DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesTopWaveX)
    assert.equal(freeSettings.reactBitsFloatingLinesTopWaveY, DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesTopWaveY)
    assert.equal(
      freeSettings.reactBitsFloatingLinesTopWaveRotate,
      DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesTopWaveRotate,
    )
    assert.equal(
      freeSettings.reactBitsFloatingLinesMiddleWaveX,
      DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesMiddleWaveX,
    )
    assert.equal(
      freeSettings.reactBitsFloatingLinesMiddleWaveY,
      DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesMiddleWaveY,
    )
    assert.equal(
      freeSettings.reactBitsFloatingLinesMiddleWaveRotate,
      DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesMiddleWaveRotate,
    )
    assert.equal(
      freeSettings.reactBitsFloatingLinesBottomWaveX,
      DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesBottomWaveX,
    )
    assert.equal(
      freeSettings.reactBitsFloatingLinesBottomWaveY,
      DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesBottomWaveY,
    )
    assert.equal(
      freeSettings.reactBitsFloatingLinesBottomWaveRotate,
      DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesBottomWaveRotate,
    )
    assert.equal(
      freeSettings.reactBitsFloatingLinesAnimationSpeed,
      DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesAnimationSpeed,
    )
    assert.equal(
      freeSettings.reactBitsFloatingLinesInteractive,
      DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesInteractive,
    )
    assert.equal(
      freeSettings.reactBitsFloatingLinesBendRadius,
      DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesBendRadius,
    )
    assert.equal(
      freeSettings.reactBitsFloatingLinesBendStrength,
      DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesBendStrength,
    )
    assert.equal(
      freeSettings.reactBitsFloatingLinesMouseDamping,
      DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesMouseDamping,
    )
    assert.equal(freeSettings.reactBitsFloatingLinesParallax, DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesParallax)
    assert.equal(
      freeSettings.reactBitsFloatingLinesParallaxStrength,
      DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesParallaxStrength,
    )
    assert.equal(
      freeSettings.reactBitsFloatingLinesBlendMode,
      DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesBlendMode,
    )

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, ["premium_backgrounds"])

    assert.equal(premiumSettings.backgroundId, "react-bits-floating-lines")
    assert.equal(premiumSettings.reactBitsFloatingLinesPaletteMode, "harmony")
    assert.equal(premiumSettings.reactBitsFloatingLinesPrimaryColor, "#123456")
    assert.equal(premiumSettings.reactBitsFloatingLinesHarmony, "triad")
    assert.equal(premiumSettings.reactBitsFloatingLinesColorOne, "#ABCDEF")
    assert.equal(premiumSettings.reactBitsFloatingLinesColorTwo, "#FEDCBA")
    assert.equal(premiumSettings.reactBitsFloatingLinesColorThree, "#010203")
    assert.equal(premiumSettings.reactBitsFloatingLinesEnableTop, false)
    assert.equal(premiumSettings.reactBitsFloatingLinesEnableMiddle, false)
    assert.equal(premiumSettings.reactBitsFloatingLinesEnableBottom, true)
    assert.equal(premiumSettings.reactBitsFloatingLinesTopLineCount, 12)
    assert.equal(premiumSettings.reactBitsFloatingLinesMiddleLineCount, 10)
    assert.equal(premiumSettings.reactBitsFloatingLinesBottomLineCount, 8)
    assert.equal(premiumSettings.reactBitsFloatingLinesTopLineDistance, 4.5)
    assert.equal(premiumSettings.reactBitsFloatingLinesMiddleLineDistance, 3.5)
    assert.equal(premiumSettings.reactBitsFloatingLinesBottomLineDistance, 2.5)
    assert.equal(premiumSettings.reactBitsFloatingLinesTopWaveX, 4.4)
    assert.equal(premiumSettings.reactBitsFloatingLinesTopWaveY, 0.4)
    assert.equal(premiumSettings.reactBitsFloatingLinesTopWaveRotate, -0.3)
    assert.equal(premiumSettings.reactBitsFloatingLinesMiddleWaveX, 3.3)
    assert.equal(premiumSettings.reactBitsFloatingLinesMiddleWaveY, 0.2)
    assert.equal(premiumSettings.reactBitsFloatingLinesMiddleWaveRotate, 0.5)
    assert.equal(premiumSettings.reactBitsFloatingLinesBottomWaveX, 2.2)
    assert.equal(premiumSettings.reactBitsFloatingLinesBottomWaveY, -0.6)
    assert.equal(premiumSettings.reactBitsFloatingLinesBottomWaveRotate, -0.9)
    assert.equal(premiumSettings.reactBitsFloatingLinesAnimationSpeed, 1.5)
    assert.equal(premiumSettings.reactBitsFloatingLinesInteractive, false)
    assert.equal(premiumSettings.reactBitsFloatingLinesBendRadius, 7)
    assert.equal(premiumSettings.reactBitsFloatingLinesBendStrength, -0.8)
    assert.equal(premiumSettings.reactBitsFloatingLinesMouseDamping, 0.08)
    assert.equal(premiumSettings.reactBitsFloatingLinesParallax, false)
    assert.equal(premiumSettings.reactBitsFloatingLinesParallaxStrength, 0.4)
    assert.equal(premiumSettings.reactBitsFloatingLinesBlendMode, "normal")
  })

  it("resets React Bits Side Rays controls without premium background access", () => {
    const input = {
      backgroundId: "react-bits-side-rays",
      reactBitsSideRaysPaletteMode: "harmony",
      reactBitsSideRaysPrimaryColor: "#EAB308",
      reactBitsSideRaysHarmony: "triad",
      reactBitsSideRaysColorOne: "#ABCDEF",
      reactBitsSideRaysColorTwo: "#FEDCBA",
      reactBitsSideRaysSpeed: 3.5,
      reactBitsSideRaysIntensity: 4,
      reactBitsSideRaysSpread: 3,
      reactBitsSideRaysOrigin: "bottom-left",
      reactBitsSideRaysTilt: 22,
      reactBitsSideRaysSaturation: 2,
      reactBitsSideRaysBlend: 0.4,
      reactBitsSideRaysFalloff: 2.2,
      reactBitsSideRaysOpacity: 0.7,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    assert.equal(freeSettings.reactBitsSideRaysPaletteMode, DEFAULT_CHIMER_SETTINGS.reactBitsSideRaysPaletteMode)
    assert.equal(freeSettings.reactBitsSideRaysPrimaryColor, DEFAULT_CHIMER_SETTINGS.reactBitsSideRaysPrimaryColor)
    assert.equal(freeSettings.reactBitsSideRaysHarmony, DEFAULT_CHIMER_SETTINGS.reactBitsSideRaysHarmony)
    assert.equal(freeSettings.reactBitsSideRaysColorOne, DEFAULT_CHIMER_SETTINGS.reactBitsSideRaysColorOne)
    assert.equal(freeSettings.reactBitsSideRaysColorTwo, DEFAULT_CHIMER_SETTINGS.reactBitsSideRaysColorTwo)
    assert.equal(freeSettings.reactBitsSideRaysSpeed, DEFAULT_CHIMER_SETTINGS.reactBitsSideRaysSpeed)
    assert.equal(freeSettings.reactBitsSideRaysIntensity, DEFAULT_CHIMER_SETTINGS.reactBitsSideRaysIntensity)
    assert.equal(freeSettings.reactBitsSideRaysSpread, DEFAULT_CHIMER_SETTINGS.reactBitsSideRaysSpread)
    assert.equal(freeSettings.reactBitsSideRaysOrigin, DEFAULT_CHIMER_SETTINGS.reactBitsSideRaysOrigin)
    assert.equal(freeSettings.reactBitsSideRaysTilt, DEFAULT_CHIMER_SETTINGS.reactBitsSideRaysTilt)
    assert.equal(freeSettings.reactBitsSideRaysSaturation, DEFAULT_CHIMER_SETTINGS.reactBitsSideRaysSaturation)
    assert.equal(freeSettings.reactBitsSideRaysBlend, DEFAULT_CHIMER_SETTINGS.reactBitsSideRaysBlend)
    assert.equal(freeSettings.reactBitsSideRaysFalloff, DEFAULT_CHIMER_SETTINGS.reactBitsSideRaysFalloff)
    assert.equal(freeSettings.reactBitsSideRaysOpacity, DEFAULT_CHIMER_SETTINGS.reactBitsSideRaysOpacity)

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "react-bits-side-rays")
    assert.equal(premiumSettings.reactBitsSideRaysPaletteMode, "harmony")
    assert.equal(premiumSettings.reactBitsSideRaysPrimaryColor, "#EAB308")
    assert.equal(premiumSettings.reactBitsSideRaysHarmony, "triad")
    assert.equal(premiumSettings.reactBitsSideRaysColorOne, "#ABCDEF")
    assert.equal(premiumSettings.reactBitsSideRaysColorTwo, "#FEDCBA")
    assert.equal(premiumSettings.reactBitsSideRaysSpeed, 3.5)
    assert.equal(premiumSettings.reactBitsSideRaysIntensity, 4)
    assert.equal(premiumSettings.reactBitsSideRaysSpread, 3)
    assert.equal(premiumSettings.reactBitsSideRaysOrigin, "bottom-left")
    assert.equal(premiumSettings.reactBitsSideRaysTilt, 22)
    assert.equal(premiumSettings.reactBitsSideRaysSaturation, 2)
    assert.equal(premiumSettings.reactBitsSideRaysBlend, 0.4)
    assert.equal(premiumSettings.reactBitsSideRaysFalloff, 2.2)
    assert.equal(premiumSettings.reactBitsSideRaysOpacity, 0.7)
  })

  it("resets React Bits Light Rays controls without premium background access", () => {
    const input = {
      backgroundId: "react-bits-light-rays",
      reactBitsLightRaysPaletteMode: "harmony",
      reactBitsLightRaysPrimaryColor: "#FFFFFF",
      reactBitsLightRaysHarmony: "triad",
      reactBitsLightRaysColor: "#ABCDEF",
      reactBitsLightRaysOrigin: "bottom-center",
      reactBitsLightRaysSpeed: 3.5,
      reactBitsLightRaysSpread: 3,
      reactBitsLightRaysLength: 4,
      reactBitsLightRaysPulsating: true,
      reactBitsLightRaysFadeDistance: 2.2,
      reactBitsLightRaysSaturation: 2,
      reactBitsLightRaysFollowMouse: true,
      reactBitsLightRaysMouseInfluence: 0.7,
      reactBitsLightRaysNoiseAmount: 0.45,
      reactBitsLightRaysDistortion: 1.5,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    assert.equal(freeSettings.reactBitsLightRaysPaletteMode, DEFAULT_CHIMER_SETTINGS.reactBitsLightRaysPaletteMode)
    assert.equal(freeSettings.reactBitsLightRaysPrimaryColor, DEFAULT_CHIMER_SETTINGS.reactBitsLightRaysPrimaryColor)
    assert.equal(freeSettings.reactBitsLightRaysHarmony, DEFAULT_CHIMER_SETTINGS.reactBitsLightRaysHarmony)
    assert.equal(freeSettings.reactBitsLightRaysColor, DEFAULT_CHIMER_SETTINGS.reactBitsLightRaysColor)
    assert.equal(freeSettings.reactBitsLightRaysOrigin, DEFAULT_CHIMER_SETTINGS.reactBitsLightRaysOrigin)
    assert.equal(freeSettings.reactBitsLightRaysSpeed, DEFAULT_CHIMER_SETTINGS.reactBitsLightRaysSpeed)
    assert.equal(freeSettings.reactBitsLightRaysSpread, DEFAULT_CHIMER_SETTINGS.reactBitsLightRaysSpread)
    assert.equal(freeSettings.reactBitsLightRaysLength, DEFAULT_CHIMER_SETTINGS.reactBitsLightRaysLength)
    assert.equal(freeSettings.reactBitsLightRaysPulsating, DEFAULT_CHIMER_SETTINGS.reactBitsLightRaysPulsating)
    assert.equal(freeSettings.reactBitsLightRaysFadeDistance, DEFAULT_CHIMER_SETTINGS.reactBitsLightRaysFadeDistance)
    assert.equal(freeSettings.reactBitsLightRaysSaturation, DEFAULT_CHIMER_SETTINGS.reactBitsLightRaysSaturation)
    assert.equal(freeSettings.reactBitsLightRaysFollowMouse, DEFAULT_CHIMER_SETTINGS.reactBitsLightRaysFollowMouse)
    assert.equal(freeSettings.reactBitsLightRaysMouseInfluence, DEFAULT_CHIMER_SETTINGS.reactBitsLightRaysMouseInfluence)
    assert.equal(freeSettings.reactBitsLightRaysNoiseAmount, DEFAULT_CHIMER_SETTINGS.reactBitsLightRaysNoiseAmount)
    assert.equal(freeSettings.reactBitsLightRaysDistortion, DEFAULT_CHIMER_SETTINGS.reactBitsLightRaysDistortion)

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "react-bits-light-rays")
    assert.equal(premiumSettings.reactBitsLightRaysPaletteMode, "harmony")
    assert.equal(premiumSettings.reactBitsLightRaysPrimaryColor, "#FFFFFF")
    assert.equal(premiumSettings.reactBitsLightRaysHarmony, "triad")
    assert.equal(premiumSettings.reactBitsLightRaysColor, "#ABCDEF")
    assert.equal(premiumSettings.reactBitsLightRaysOrigin, "bottom-center")
    assert.equal(premiumSettings.reactBitsLightRaysSpeed, 3.5)
    assert.equal(premiumSettings.reactBitsLightRaysSpread, 3)
    assert.equal(premiumSettings.reactBitsLightRaysLength, 4)
    assert.equal(premiumSettings.reactBitsLightRaysPulsating, true)
    assert.equal(premiumSettings.reactBitsLightRaysFadeDistance, 2.2)
    assert.equal(premiumSettings.reactBitsLightRaysSaturation, 2)
    assert.equal(premiumSettings.reactBitsLightRaysFollowMouse, true)
    assert.equal(premiumSettings.reactBitsLightRaysMouseInfluence, 0.7)
    assert.equal(premiumSettings.reactBitsLightRaysNoiseAmount, 0.45)
    assert.equal(premiumSettings.reactBitsLightRaysDistortion, 1.5)
  })

  it("resets React Bits Pixel Blast controls without premium background access", () => {
    const input = {
      backgroundId: "react-bits-pixel-blast",
      reactBitsPixelBlastPaletteMode: "harmony",
      reactBitsPixelBlastPrimaryColor: "#FFFFFF",
      reactBitsPixelBlastHarmony: "triad",
      reactBitsPixelBlastColor: "#ABCDEF",
      reactBitsPixelBlastVariant: "diamond",
      reactBitsPixelBlastPixelSize: 12,
      reactBitsPixelBlastAntialias: false,
      reactBitsPixelBlastPatternScale: 4,
      reactBitsPixelBlastPatternDensity: 1.5,
      reactBitsPixelBlastLiquid: true,
      reactBitsPixelBlastLiquidStrength: 0.24,
      reactBitsPixelBlastLiquidRadius: 2.5,
      reactBitsPixelBlastPixelSizeJitter: 0.4,
      reactBitsPixelBlastEnableRipples: false,
      reactBitsPixelBlastRippleIntensityScale: 2.5,
      reactBitsPixelBlastRippleThickness: 0.24,
      reactBitsPixelBlastRippleSpeed: 1.2,
      reactBitsPixelBlastLiquidWobbleSpeed: 6,
      reactBitsPixelBlastAutoPauseOffscreen: false,
      reactBitsPixelBlastSpeed: 1.8,
      reactBitsPixelBlastTransparent: false,
      reactBitsPixelBlastEdgeFade: 0.2,
      reactBitsPixelBlastNoiseAmount: 0.18,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    for (const key of [
      "reactBitsPixelBlastPaletteMode",
      "reactBitsPixelBlastPrimaryColor",
      "reactBitsPixelBlastHarmony",
      "reactBitsPixelBlastColor",
      "reactBitsPixelBlastVariant",
      "reactBitsPixelBlastPixelSize",
      "reactBitsPixelBlastAntialias",
      "reactBitsPixelBlastPatternScale",
      "reactBitsPixelBlastPatternDensity",
      "reactBitsPixelBlastLiquid",
      "reactBitsPixelBlastLiquidStrength",
      "reactBitsPixelBlastLiquidRadius",
      "reactBitsPixelBlastPixelSizeJitter",
      "reactBitsPixelBlastEnableRipples",
      "reactBitsPixelBlastRippleIntensityScale",
      "reactBitsPixelBlastRippleThickness",
      "reactBitsPixelBlastRippleSpeed",
      "reactBitsPixelBlastLiquidWobbleSpeed",
      "reactBitsPixelBlastAutoPauseOffscreen",
      "reactBitsPixelBlastSpeed",
      "reactBitsPixelBlastTransparent",
      "reactBitsPixelBlastEdgeFade",
      "reactBitsPixelBlastNoiseAmount",
    ]) {
      assert.equal(freeSettings[key], DEFAULT_CHIMER_SETTINGS[key])
    }

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "react-bits-pixel-blast")
    assert.equal(premiumSettings.reactBitsPixelBlastPaletteMode, "harmony")
    assert.equal(premiumSettings.reactBitsPixelBlastPrimaryColor, "#FFFFFF")
    assert.equal(premiumSettings.reactBitsPixelBlastHarmony, "triad")
    assert.equal(premiumSettings.reactBitsPixelBlastColor, "#ABCDEF")
    assert.equal(premiumSettings.reactBitsPixelBlastVariant, "diamond")
    assert.equal(premiumSettings.reactBitsPixelBlastPixelSize, 12)
    assert.equal(premiumSettings.reactBitsPixelBlastAntialias, false)
    assert.equal(premiumSettings.reactBitsPixelBlastPatternScale, 4)
    assert.equal(premiumSettings.reactBitsPixelBlastPatternDensity, 1.5)
    assert.equal(premiumSettings.reactBitsPixelBlastLiquid, true)
    assert.equal(premiumSettings.reactBitsPixelBlastLiquidStrength, 0.24)
    assert.equal(premiumSettings.reactBitsPixelBlastLiquidRadius, 2.5)
    assert.equal(premiumSettings.reactBitsPixelBlastPixelSizeJitter, 0.4)
    assert.equal(premiumSettings.reactBitsPixelBlastEnableRipples, false)
    assert.equal(premiumSettings.reactBitsPixelBlastRippleIntensityScale, 2.5)
    assert.equal(premiumSettings.reactBitsPixelBlastRippleThickness, 0.24)
    assert.equal(premiumSettings.reactBitsPixelBlastRippleSpeed, 1.2)
    assert.equal(premiumSettings.reactBitsPixelBlastLiquidWobbleSpeed, 6)
    assert.equal(premiumSettings.reactBitsPixelBlastAutoPauseOffscreen, false)
    assert.equal(premiumSettings.reactBitsPixelBlastSpeed, 1.8)
    assert.equal(premiumSettings.reactBitsPixelBlastTransparent, false)
    assert.equal(premiumSettings.reactBitsPixelBlastEdgeFade, 0.2)
    assert.equal(premiumSettings.reactBitsPixelBlastNoiseAmount, 0.18)
  })

  it("resets React Bits Color Bends controls without premium background access", () => {
    const input = {
      backgroundId: "react-bits-color-bends",
      reactBitsColorBendsPaletteMode: "harmony",
      reactBitsColorBendsPrimaryColor: "#FFFFFF",
      reactBitsColorBendsHarmony: "triad",
      reactBitsColorBendsColorOne: "#ABCDEF",
      reactBitsColorBendsColorTwo: "#123456",
      reactBitsColorBendsColorThree: "#654321",
      reactBitsColorBendsColorFour: "#010203",
      reactBitsColorBendsRotation: 180,
      reactBitsColorBendsSpeed: 1.8,
      reactBitsColorBendsTransparent: false,
      reactBitsColorBendsAutoRotate: 42,
      reactBitsColorBendsScale: 2.5,
      reactBitsColorBendsFrequency: 2.2,
      reactBitsColorBendsWarpStrength: 2.4,
      reactBitsColorBendsInteractive: true,
      reactBitsColorBendsMouseInfluence: 2.2,
      reactBitsColorBendsParallax: 1.2,
      reactBitsColorBendsNoise: 0.6,
      reactBitsColorBendsIterations: 4,
      reactBitsColorBendsIntensity: 2.5,
      reactBitsColorBendsBandWidth: 10,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    for (const key of [
      "reactBitsColorBendsPaletteMode",
      "reactBitsColorBendsPrimaryColor",
      "reactBitsColorBendsHarmony",
      "reactBitsColorBendsColorOne",
      "reactBitsColorBendsColorTwo",
      "reactBitsColorBendsColorThree",
      "reactBitsColorBendsColorFour",
      "reactBitsColorBendsRotation",
      "reactBitsColorBendsSpeed",
      "reactBitsColorBendsTransparent",
      "reactBitsColorBendsAutoRotate",
      "reactBitsColorBendsScale",
      "reactBitsColorBendsFrequency",
      "reactBitsColorBendsWarpStrength",
      "reactBitsColorBendsInteractive",
      "reactBitsColorBendsMouseInfluence",
      "reactBitsColorBendsParallax",
      "reactBitsColorBendsNoise",
      "reactBitsColorBendsIterations",
      "reactBitsColorBendsIntensity",
      "reactBitsColorBendsBandWidth",
    ]) {
      assert.equal(freeSettings[key], DEFAULT_CHIMER_SETTINGS[key])
    }

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "react-bits-color-bends")
    assert.equal(premiumSettings.reactBitsColorBendsPaletteMode, "harmony")
    assert.equal(premiumSettings.reactBitsColorBendsPrimaryColor, "#FFFFFF")
    assert.equal(premiumSettings.reactBitsColorBendsHarmony, "triad")
    assert.equal(premiumSettings.reactBitsColorBendsColorOne, "#ABCDEF")
    assert.equal(premiumSettings.reactBitsColorBendsColorTwo, "#123456")
    assert.equal(premiumSettings.reactBitsColorBendsColorThree, "#654321")
    assert.equal(premiumSettings.reactBitsColorBendsColorFour, "#010203")
    assert.equal(premiumSettings.reactBitsColorBendsRotation, 180)
    assert.equal(premiumSettings.reactBitsColorBendsSpeed, 1.8)
    assert.equal(premiumSettings.reactBitsColorBendsTransparent, false)
    assert.equal(premiumSettings.reactBitsColorBendsAutoRotate, 42)
    assert.equal(premiumSettings.reactBitsColorBendsScale, 2.5)
    assert.equal(premiumSettings.reactBitsColorBendsFrequency, 2.2)
    assert.equal(premiumSettings.reactBitsColorBendsWarpStrength, 2.4)
    assert.equal(premiumSettings.reactBitsColorBendsInteractive, true)
    assert.equal(premiumSettings.reactBitsColorBendsMouseInfluence, 2.2)
    assert.equal(premiumSettings.reactBitsColorBendsParallax, 1.2)
    assert.equal(premiumSettings.reactBitsColorBendsNoise, 0.6)
    assert.equal(premiumSettings.reactBitsColorBendsIterations, 4)
    assert.equal(premiumSettings.reactBitsColorBendsIntensity, 2.5)
    assert.equal(premiumSettings.reactBitsColorBendsBandWidth, 10)
  })

  it("resets React Bits Evil Eye controls without premium background access", () => {
    const input = {
      backgroundId: "react-bits-evil-eye",
      reactBitsEvilEyePaletteMode: "harmony",
      reactBitsEvilEyePrimaryColor: "#FFFFFF",
      reactBitsEvilEyeHarmony: "triad",
      reactBitsEvilEyeColor: "#ABCDEF",
      reactBitsEvilEyeBackgroundColor: "#010203",
      reactBitsEvilEyeIntensity: 2.2,
      reactBitsEvilEyePupilSize: 1.2,
      reactBitsEvilEyeIrisWidth: 0.4,
      reactBitsEvilEyeGlowIntensity: 0.8,
      reactBitsEvilEyeScale: 1.3,
      reactBitsEvilEyeNoiseScale: 2.2,
      reactBitsEvilEyePupilFollow: 1.4,
      reactBitsEvilEyeFlameSpeed: 1.8,
      reactBitsEvilEyeInteractive: true,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    for (const key of [
      "reactBitsEvilEyePaletteMode",
      "reactBitsEvilEyePrimaryColor",
      "reactBitsEvilEyeHarmony",
      "reactBitsEvilEyeColor",
      "reactBitsEvilEyeBackgroundColor",
      "reactBitsEvilEyeIntensity",
      "reactBitsEvilEyePupilSize",
      "reactBitsEvilEyeIrisWidth",
      "reactBitsEvilEyeGlowIntensity",
      "reactBitsEvilEyeScale",
      "reactBitsEvilEyeNoiseScale",
      "reactBitsEvilEyePupilFollow",
      "reactBitsEvilEyeFlameSpeed",
      "reactBitsEvilEyeInteractive",
    ]) {
      assert.equal(freeSettings[key], DEFAULT_CHIMER_SETTINGS[key])
    }

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "react-bits-evil-eye")
    assert.equal(premiumSettings.reactBitsEvilEyePaletteMode, "harmony")
    assert.equal(premiumSettings.reactBitsEvilEyePrimaryColor, "#FFFFFF")
    assert.equal(premiumSettings.reactBitsEvilEyeHarmony, "triad")
    assert.equal(premiumSettings.reactBitsEvilEyeColor, "#ABCDEF")
    assert.equal(premiumSettings.reactBitsEvilEyeBackgroundColor, "#010203")
    assert.equal(premiumSettings.reactBitsEvilEyeIntensity, 2.2)
    assert.equal(premiumSettings.reactBitsEvilEyePupilSize, 1.2)
    assert.equal(premiumSettings.reactBitsEvilEyeIrisWidth, 0.4)
    assert.equal(premiumSettings.reactBitsEvilEyeGlowIntensity, 0.8)
    assert.equal(premiumSettings.reactBitsEvilEyeScale, 1.3)
    assert.equal(premiumSettings.reactBitsEvilEyeNoiseScale, 2.2)
    assert.equal(premiumSettings.reactBitsEvilEyePupilFollow, 1.4)
    assert.equal(premiumSettings.reactBitsEvilEyeFlameSpeed, 1.8)
    assert.equal(premiumSettings.reactBitsEvilEyeInteractive, true)
  })

  it("resets React Bits Line Waves controls without premium background access", () => {
    const input = {
      backgroundId: "react-bits-line-waves",
      reactBitsLineWavesPaletteMode: "harmony",
      reactBitsLineWavesPrimaryColor: "#FFFFFF",
      reactBitsLineWavesHarmony: "triad",
      reactBitsLineWavesColorOne: "#ABCDEF",
      reactBitsLineWavesColorTwo: "#123456",
      reactBitsLineWavesColorThree: "#654321",
      reactBitsLineWavesSpeed: 1.5,
      reactBitsLineWavesInnerLineCount: 48,
      reactBitsLineWavesOuterLineCount: 60,
      reactBitsLineWavesWarpIntensity: 1.8,
      reactBitsLineWavesRotation: -24,
      reactBitsLineWavesEdgeFadeWidth: 0.3,
      reactBitsLineWavesColorCycleSpeed: 1.7,
      reactBitsLineWavesBrightness: 0.8,
      reactBitsLineWavesEnableMouseInteraction: true,
      reactBitsLineWavesMouseInfluence: 2.8,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    for (const key of [
      "reactBitsLineWavesPaletteMode",
      "reactBitsLineWavesPrimaryColor",
      "reactBitsLineWavesHarmony",
      "reactBitsLineWavesColorOne",
      "reactBitsLineWavesColorTwo",
      "reactBitsLineWavesColorThree",
      "reactBitsLineWavesSpeed",
      "reactBitsLineWavesInnerLineCount",
      "reactBitsLineWavesOuterLineCount",
      "reactBitsLineWavesWarpIntensity",
      "reactBitsLineWavesRotation",
      "reactBitsLineWavesEdgeFadeWidth",
      "reactBitsLineWavesColorCycleSpeed",
      "reactBitsLineWavesBrightness",
      "reactBitsLineWavesEnableMouseInteraction",
      "reactBitsLineWavesMouseInfluence",
    ]) {
      assert.equal(freeSettings[key], DEFAULT_CHIMER_SETTINGS[key])
    }

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "react-bits-line-waves")
    assert.equal(premiumSettings.reactBitsLineWavesPaletteMode, "harmony")
    assert.equal(premiumSettings.reactBitsLineWavesPrimaryColor, "#FFFFFF")
    assert.equal(premiumSettings.reactBitsLineWavesHarmony, "triad")
    assert.equal(premiumSettings.reactBitsLineWavesColorOne, "#ABCDEF")
    assert.equal(premiumSettings.reactBitsLineWavesColorTwo, "#123456")
    assert.equal(premiumSettings.reactBitsLineWavesColorThree, "#654321")
    assert.equal(premiumSettings.reactBitsLineWavesSpeed, 1.5)
    assert.equal(premiumSettings.reactBitsLineWavesInnerLineCount, 48)
    assert.equal(premiumSettings.reactBitsLineWavesOuterLineCount, 60)
    assert.equal(premiumSettings.reactBitsLineWavesWarpIntensity, 1.8)
    assert.equal(premiumSettings.reactBitsLineWavesRotation, -24)
    assert.equal(premiumSettings.reactBitsLineWavesEdgeFadeWidth, 0.3)
    assert.equal(premiumSettings.reactBitsLineWavesColorCycleSpeed, 1.7)
    assert.equal(premiumSettings.reactBitsLineWavesBrightness, 0.8)
    assert.equal(premiumSettings.reactBitsLineWavesEnableMouseInteraction, true)
    assert.equal(premiumSettings.reactBitsLineWavesMouseInfluence, 2.8)
  })

  it("resets React Bits Radar controls without premium background access", () => {
    const input = {
      backgroundId: "react-bits-radar",
      reactBitsRadarPaletteMode: "harmony",
      reactBitsRadarPrimaryColor: "#FFFFFF",
      reactBitsRadarHarmony: "triad",
      reactBitsRadarColor: "#ABCDEF",
      reactBitsRadarBackgroundColor: "#010203",
      reactBitsRadarSpeed: 1.6,
      reactBitsRadarScale: 0.8,
      reactBitsRadarRingCount: 18,
      reactBitsRadarSpokeCount: 16,
      reactBitsRadarRingThickness: 0.08,
      reactBitsRadarSpokeThickness: 0.04,
      reactBitsRadarSweepSpeed: 1.4,
      reactBitsRadarSweepWidth: 4,
      reactBitsRadarSweepLobes: 3,
      reactBitsRadarFalloff: 3.2,
      reactBitsRadarBrightness: 1.7,
      reactBitsRadarEnableMouseInteraction: true,
      reactBitsRadarMouseInfluence: 0.4,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    for (const key of [
      "reactBitsRadarPaletteMode",
      "reactBitsRadarPrimaryColor",
      "reactBitsRadarHarmony",
      "reactBitsRadarColor",
      "reactBitsRadarBackgroundColor",
      "reactBitsRadarSpeed",
      "reactBitsRadarScale",
      "reactBitsRadarRingCount",
      "reactBitsRadarSpokeCount",
      "reactBitsRadarRingThickness",
      "reactBitsRadarSpokeThickness",
      "reactBitsRadarSweepSpeed",
      "reactBitsRadarSweepWidth",
      "reactBitsRadarSweepLobes",
      "reactBitsRadarFalloff",
      "reactBitsRadarBrightness",
      "reactBitsRadarEnableMouseInteraction",
      "reactBitsRadarMouseInfluence",
    ]) {
      assert.equal(freeSettings[key], DEFAULT_CHIMER_SETTINGS[key])
    }

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "react-bits-radar")
    assert.equal(premiumSettings.reactBitsRadarPaletteMode, "harmony")
    assert.equal(premiumSettings.reactBitsRadarPrimaryColor, "#FFFFFF")
    assert.equal(premiumSettings.reactBitsRadarHarmony, "triad")
    assert.equal(premiumSettings.reactBitsRadarColor, "#ABCDEF")
    assert.equal(premiumSettings.reactBitsRadarBackgroundColor, "#010203")
    assert.equal(premiumSettings.reactBitsRadarSpeed, 1.6)
    assert.equal(premiumSettings.reactBitsRadarScale, 0.8)
    assert.equal(premiumSettings.reactBitsRadarRingCount, 18)
    assert.equal(premiumSettings.reactBitsRadarSpokeCount, 16)
    assert.equal(premiumSettings.reactBitsRadarRingThickness, 0.08)
    assert.equal(premiumSettings.reactBitsRadarSpokeThickness, 0.04)
    assert.equal(premiumSettings.reactBitsRadarSweepSpeed, 1.4)
    assert.equal(premiumSettings.reactBitsRadarSweepWidth, 4)
    assert.equal(premiumSettings.reactBitsRadarSweepLobes, 3)
    assert.equal(premiumSettings.reactBitsRadarFalloff, 3.2)
    assert.equal(premiumSettings.reactBitsRadarBrightness, 1.7)
    assert.equal(premiumSettings.reactBitsRadarEnableMouseInteraction, true)
    assert.equal(premiumSettings.reactBitsRadarMouseInfluence, 0.4)
  })

  it("resets React Bits Soft Aurora controls without premium background access", () => {
    const input = {
      backgroundId: "react-bits-soft-aurora",
      reactBitsSoftAuroraPaletteMode: "harmony",
      reactBitsSoftAuroraPrimaryColor: "#FFFFFF",
      reactBitsSoftAuroraHarmony: "triad",
      reactBitsSoftAuroraColorOne: "#ABCDEF",
      reactBitsSoftAuroraColorTwo: "#010203",
      reactBitsSoftAuroraSpeed: 1.6,
      reactBitsSoftAuroraScale: 2.2,
      reactBitsSoftAuroraBrightness: 1.7,
      reactBitsSoftAuroraNoiseFrequency: 3.4,
      reactBitsSoftAuroraNoiseAmplitude: 1.8,
      reactBitsSoftAuroraBandHeight: 0.7,
      reactBitsSoftAuroraBandSpread: 1.9,
      reactBitsSoftAuroraOctaveDecay: 0.4,
      reactBitsSoftAuroraLayerOffset: 2.5,
      reactBitsSoftAuroraColorSpeed: 1.3,
      reactBitsSoftAuroraEnableMouseInteraction: true,
      reactBitsSoftAuroraMouseInfluence: 0.4,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    for (const key of [
      "reactBitsSoftAuroraPaletteMode",
      "reactBitsSoftAuroraPrimaryColor",
      "reactBitsSoftAuroraHarmony",
      "reactBitsSoftAuroraColorOne",
      "reactBitsSoftAuroraColorTwo",
      "reactBitsSoftAuroraSpeed",
      "reactBitsSoftAuroraScale",
      "reactBitsSoftAuroraBrightness",
      "reactBitsSoftAuroraNoiseFrequency",
      "reactBitsSoftAuroraNoiseAmplitude",
      "reactBitsSoftAuroraBandHeight",
      "reactBitsSoftAuroraBandSpread",
      "reactBitsSoftAuroraOctaveDecay",
      "reactBitsSoftAuroraLayerOffset",
      "reactBitsSoftAuroraColorSpeed",
      "reactBitsSoftAuroraEnableMouseInteraction",
      "reactBitsSoftAuroraMouseInfluence",
    ]) {
      assert.equal(freeSettings[key], DEFAULT_CHIMER_SETTINGS[key])
    }

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "react-bits-soft-aurora")
    assert.equal(premiumSettings.reactBitsSoftAuroraPaletteMode, "harmony")
    assert.equal(premiumSettings.reactBitsSoftAuroraPrimaryColor, "#FFFFFF")
    assert.equal(premiumSettings.reactBitsSoftAuroraHarmony, "triad")
    assert.equal(premiumSettings.reactBitsSoftAuroraColorOne, "#ABCDEF")
    assert.equal(premiumSettings.reactBitsSoftAuroraColorTwo, "#010203")
    assert.equal(premiumSettings.reactBitsSoftAuroraSpeed, 1.6)
    assert.equal(premiumSettings.reactBitsSoftAuroraScale, 2.2)
    assert.equal(premiumSettings.reactBitsSoftAuroraBrightness, 1.7)
    assert.equal(premiumSettings.reactBitsSoftAuroraNoiseFrequency, 3.4)
    assert.equal(premiumSettings.reactBitsSoftAuroraNoiseAmplitude, 1.8)
    assert.equal(premiumSettings.reactBitsSoftAuroraBandHeight, 0.7)
    assert.equal(premiumSettings.reactBitsSoftAuroraBandSpread, 1.9)
    assert.equal(premiumSettings.reactBitsSoftAuroraOctaveDecay, 0.4)
    assert.equal(premiumSettings.reactBitsSoftAuroraLayerOffset, 2.5)
    assert.equal(premiumSettings.reactBitsSoftAuroraColorSpeed, 1.3)
    assert.equal(premiumSettings.reactBitsSoftAuroraEnableMouseInteraction, true)
    assert.equal(premiumSettings.reactBitsSoftAuroraMouseInfluence, 0.4)
  })

  it("resets React Bits Plasma controls without premium background access", () => {
    const input = {
      backgroundId: "react-bits-plasma",
      reactBitsPlasmaPaletteMode: "harmony",
      reactBitsPlasmaPrimaryColor: "#FFFFFF",
      reactBitsPlasmaHarmony: "triad",
      reactBitsPlasmaColor: "#ABCDEF",
      reactBitsPlasmaSpeed: 1.6,
      reactBitsPlasmaDirection: "pingpong",
      reactBitsPlasmaScale: 2.2,
      reactBitsPlasmaOpacity: 0.7,
      reactBitsPlasmaMouseInteractive: true,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    for (const key of [
      "reactBitsPlasmaPaletteMode",
      "reactBitsPlasmaPrimaryColor",
      "reactBitsPlasmaHarmony",
      "reactBitsPlasmaColor",
      "reactBitsPlasmaSpeed",
      "reactBitsPlasmaDirection",
      "reactBitsPlasmaScale",
      "reactBitsPlasmaOpacity",
      "reactBitsPlasmaMouseInteractive",
    ]) {
      assert.equal(freeSettings[key], DEFAULT_CHIMER_SETTINGS[key])
    }

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "react-bits-plasma")
    assert.equal(premiumSettings.reactBitsPlasmaPaletteMode, "harmony")
    assert.equal(premiumSettings.reactBitsPlasmaPrimaryColor, "#FFFFFF")
    assert.equal(premiumSettings.reactBitsPlasmaHarmony, "triad")
    assert.equal(premiumSettings.reactBitsPlasmaColor, "#ABCDEF")
    assert.equal(premiumSettings.reactBitsPlasmaSpeed, 1.6)
    assert.equal(premiumSettings.reactBitsPlasmaDirection, "pingpong")
    assert.equal(premiumSettings.reactBitsPlasmaScale, 2.2)
    assert.equal(premiumSettings.reactBitsPlasmaOpacity, 0.7)
    assert.equal(premiumSettings.reactBitsPlasmaMouseInteractive, true)
  })

  it("resets React Bits Plasma Wave controls without premium background access", () => {
    const input = {
      backgroundId: "react-bits-plasma-wave",
      reactBitsPlasmaWavePaletteMode: "harmony",
      reactBitsPlasmaWavePrimaryColor: "#FFFFFF",
      reactBitsPlasmaWaveHarmony: "triad",
      reactBitsPlasmaWaveColorOne: "#ABCDEF",
      reactBitsPlasmaWaveColorTwo: "#010203",
      reactBitsPlasmaWaveXOffset: 120,
      reactBitsPlasmaWaveYOffset: -140,
      reactBitsPlasmaWaveRotationDeg: 35,
      reactBitsPlasmaWaveFocalLength: 1.2,
      reactBitsPlasmaWaveSpeedOne: 0.2,
      reactBitsPlasmaWaveSpeedTwo: 0.3,
      reactBitsPlasmaWaveDirectionTwo: -1,
      reactBitsPlasmaWaveBendOne: 1.4,
      reactBitsPlasmaWaveBendTwo: 0.8,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    for (const key of [
      "reactBitsPlasmaWavePaletteMode",
      "reactBitsPlasmaWavePrimaryColor",
      "reactBitsPlasmaWaveHarmony",
      "reactBitsPlasmaWaveColorOne",
      "reactBitsPlasmaWaveColorTwo",
      "reactBitsPlasmaWaveXOffset",
      "reactBitsPlasmaWaveYOffset",
      "reactBitsPlasmaWaveRotationDeg",
      "reactBitsPlasmaWaveFocalLength",
      "reactBitsPlasmaWaveSpeedOne",
      "reactBitsPlasmaWaveSpeedTwo",
      "reactBitsPlasmaWaveDirectionTwo",
      "reactBitsPlasmaWaveBendOne",
      "reactBitsPlasmaWaveBendTwo",
    ]) {
      assert.equal(freeSettings[key], DEFAULT_CHIMER_SETTINGS[key])
    }

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "react-bits-plasma-wave")
    assert.equal(premiumSettings.reactBitsPlasmaWavePaletteMode, "harmony")
    assert.equal(premiumSettings.reactBitsPlasmaWavePrimaryColor, "#FFFFFF")
    assert.equal(premiumSettings.reactBitsPlasmaWaveHarmony, "triad")
    assert.equal(premiumSettings.reactBitsPlasmaWaveColorOne, "#ABCDEF")
    assert.equal(premiumSettings.reactBitsPlasmaWaveColorTwo, "#010203")
    assert.equal(premiumSettings.reactBitsPlasmaWaveXOffset, 120)
    assert.equal(premiumSettings.reactBitsPlasmaWaveYOffset, -140)
    assert.equal(premiumSettings.reactBitsPlasmaWaveRotationDeg, 35)
    assert.equal(premiumSettings.reactBitsPlasmaWaveFocalLength, 1.2)
    assert.equal(premiumSettings.reactBitsPlasmaWaveSpeedOne, 0.2)
    assert.equal(premiumSettings.reactBitsPlasmaWaveSpeedTwo, 0.3)
    assert.equal(premiumSettings.reactBitsPlasmaWaveDirectionTwo, -1)
    assert.equal(premiumSettings.reactBitsPlasmaWaveBendOne, 1.4)
    assert.equal(premiumSettings.reactBitsPlasmaWaveBendTwo, 0.8)
  })

  it("resets React Bits Particles controls without premium background access", () => {
    const input = {
      backgroundId: "react-bits-particles",
      reactBitsParticlesPaletteMode: "harmony",
      reactBitsParticlesPrimaryColor: "#FFFFFF",
      reactBitsParticlesHarmony: "triad",
      reactBitsParticlesColorOne: "#ABCDEF",
      reactBitsParticlesColorTwo: "#010203",
      reactBitsParticlesColorThree: "#111111",
      reactBitsParticlesCount: 420,
      reactBitsParticlesSpread: 12,
      reactBitsParticlesSpeed: 0.4,
      reactBitsParticlesMoveOnHover: true,
      reactBitsParticlesHoverFactor: 1.6,
      reactBitsParticlesAlpha: true,
      reactBitsParticlesBaseSize: 130,
      reactBitsParticlesSizeRandomness: 1.5,
      reactBitsParticlesCameraDistance: 24,
      reactBitsParticlesDisableRotation: true,
      reactBitsParticlesPixelRatio: 1.4,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    for (const key of [
      "reactBitsParticlesPaletteMode",
      "reactBitsParticlesPrimaryColor",
      "reactBitsParticlesHarmony",
      "reactBitsParticlesColorOne",
      "reactBitsParticlesColorTwo",
      "reactBitsParticlesColorThree",
      "reactBitsParticlesCount",
      "reactBitsParticlesSpread",
      "reactBitsParticlesSpeed",
      "reactBitsParticlesMoveOnHover",
      "reactBitsParticlesHoverFactor",
      "reactBitsParticlesAlpha",
      "reactBitsParticlesBaseSize",
      "reactBitsParticlesSizeRandomness",
      "reactBitsParticlesCameraDistance",
      "reactBitsParticlesDisableRotation",
      "reactBitsParticlesPixelRatio",
    ]) {
      assert.equal(freeSettings[key], DEFAULT_CHIMER_SETTINGS[key])
    }

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "react-bits-particles")
    assert.equal(premiumSettings.reactBitsParticlesPaletteMode, "harmony")
    assert.equal(premiumSettings.reactBitsParticlesPrimaryColor, "#FFFFFF")
    assert.equal(premiumSettings.reactBitsParticlesHarmony, "triad")
    assert.equal(premiumSettings.reactBitsParticlesColorOne, "#ABCDEF")
    assert.equal(premiumSettings.reactBitsParticlesColorTwo, "#010203")
    assert.equal(premiumSettings.reactBitsParticlesColorThree, "#111111")
    assert.equal(premiumSettings.reactBitsParticlesCount, 420)
    assert.equal(premiumSettings.reactBitsParticlesSpread, 12)
    assert.equal(premiumSettings.reactBitsParticlesSpeed, 0.4)
    assert.equal(premiumSettings.reactBitsParticlesMoveOnHover, true)
    assert.equal(premiumSettings.reactBitsParticlesHoverFactor, 1.6)
    assert.equal(premiumSettings.reactBitsParticlesAlpha, true)
    assert.equal(premiumSettings.reactBitsParticlesBaseSize, 130)
    assert.equal(premiumSettings.reactBitsParticlesSizeRandomness, 1.5)
    assert.equal(premiumSettings.reactBitsParticlesCameraDistance, 24)
    assert.equal(premiumSettings.reactBitsParticlesDisableRotation, true)
    assert.equal(premiumSettings.reactBitsParticlesPixelRatio, 1.4)
  })

  it("resets React Bits Gradient Blinds controls without premium background access", () => {
    const input = {
      backgroundId: "react-bits-gradient-blinds",
      reactBitsGradientBlindsPaletteMode: "harmony",
      reactBitsGradientBlindsPrimaryColor: "#FF9FFC",
      reactBitsGradientBlindsHarmony: "triad",
      reactBitsGradientBlindsColorOne: "#ABCDEF",
      reactBitsGradientBlindsColorTwo: "#010203",
      reactBitsGradientBlindsAngle: 30,
      reactBitsGradientBlindsNoise: 0.44,
      reactBitsGradientBlindsBlindCount: 24,
      reactBitsGradientBlindsBlindMinWidth: 72,
      reactBitsGradientBlindsMouseDampening: 0.32,
      reactBitsGradientBlindsMirror: true,
      reactBitsGradientBlindsSpotlightRadius: 0.8,
      reactBitsGradientBlindsSpotlightSoftness: 1.6,
      reactBitsGradientBlindsSpotlightOpacity: 1.2,
      reactBitsGradientBlindsDistort: 1.8,
      reactBitsGradientBlindsShineDirection: "right",
      reactBitsGradientBlindsBlendMode: "screen",
      reactBitsGradientBlindsDpr: 1.4,
      reactBitsGradientBlindsEnableMouseInteraction: true,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    for (const key of [
      "reactBitsGradientBlindsPaletteMode",
      "reactBitsGradientBlindsPrimaryColor",
      "reactBitsGradientBlindsHarmony",
      "reactBitsGradientBlindsColorOne",
      "reactBitsGradientBlindsColorTwo",
      "reactBitsGradientBlindsAngle",
      "reactBitsGradientBlindsNoise",
      "reactBitsGradientBlindsBlindCount",
      "reactBitsGradientBlindsBlindMinWidth",
      "reactBitsGradientBlindsMouseDampening",
      "reactBitsGradientBlindsMirror",
      "reactBitsGradientBlindsSpotlightRadius",
      "reactBitsGradientBlindsSpotlightSoftness",
      "reactBitsGradientBlindsSpotlightOpacity",
      "reactBitsGradientBlindsDistort",
      "reactBitsGradientBlindsShineDirection",
      "reactBitsGradientBlindsBlendMode",
      "reactBitsGradientBlindsDpr",
      "reactBitsGradientBlindsEnableMouseInteraction",
    ]) {
      assert.equal(freeSettings[key], DEFAULT_CHIMER_SETTINGS[key])
    }

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "react-bits-gradient-blinds")
    assert.equal(premiumSettings.reactBitsGradientBlindsPaletteMode, "harmony")
    assert.equal(premiumSettings.reactBitsGradientBlindsPrimaryColor, "#FF9FFC")
    assert.equal(premiumSettings.reactBitsGradientBlindsHarmony, "triad")
    assert.equal(premiumSettings.reactBitsGradientBlindsColorOne, "#ABCDEF")
    assert.equal(premiumSettings.reactBitsGradientBlindsColorTwo, "#010203")
    assert.equal(premiumSettings.reactBitsGradientBlindsAngle, 30)
    assert.equal(premiumSettings.reactBitsGradientBlindsNoise, 0.44)
    assert.equal(premiumSettings.reactBitsGradientBlindsBlindCount, 24)
    assert.equal(premiumSettings.reactBitsGradientBlindsBlindMinWidth, 72)
    assert.equal(premiumSettings.reactBitsGradientBlindsMouseDampening, 0.32)
    assert.equal(premiumSettings.reactBitsGradientBlindsMirror, true)
    assert.equal(premiumSettings.reactBitsGradientBlindsSpotlightRadius, 0.8)
    assert.equal(premiumSettings.reactBitsGradientBlindsSpotlightSoftness, 1.6)
    assert.equal(premiumSettings.reactBitsGradientBlindsSpotlightOpacity, 1.2)
    assert.equal(premiumSettings.reactBitsGradientBlindsDistort, 1.8)
    assert.equal(premiumSettings.reactBitsGradientBlindsShineDirection, "right")
    assert.equal(premiumSettings.reactBitsGradientBlindsBlendMode, "screen")
    assert.equal(premiumSettings.reactBitsGradientBlindsDpr, 1.4)
    assert.equal(premiumSettings.reactBitsGradientBlindsEnableMouseInteraction, true)
  })

  it("resets React Bits Grainient controls without premium background access", () => {
    const input = {
      backgroundId: "react-bits-grainient",
      reactBitsGrainientPaletteMode: "harmony",
      reactBitsGrainientPrimaryColor: "#FF9FFC",
      reactBitsGrainientHarmony: "triad",
      reactBitsGrainientColorOne: "#ABCDEF",
      reactBitsGrainientColorTwo: "#010203",
      reactBitsGrainientColorThree: "#111111",
      reactBitsGrainientTimeSpeed: 0.8,
      reactBitsGrainientColorBalance: 0.4,
      reactBitsGrainientWarpStrength: 1.7,
      reactBitsGrainientWarpFrequency: 8,
      reactBitsGrainientWarpSpeed: 2.4,
      reactBitsGrainientWarpAmplitude: 64,
      reactBitsGrainientBlendAngle: 22,
      reactBitsGrainientBlendSoftness: 0.18,
      reactBitsGrainientRotationAmount: 700,
      reactBitsGrainientNoiseScale: 3,
      reactBitsGrainientGrainAmount: 0.25,
      reactBitsGrainientGrainScale: 4,
      reactBitsGrainientGrainAnimated: true,
      reactBitsGrainientContrast: 1.7,
      reactBitsGrainientGamma: 1.2,
      reactBitsGrainientSaturation: 1.3,
      reactBitsGrainientCenterX: 0.2,
      reactBitsGrainientCenterY: -0.2,
      reactBitsGrainientZoom: 1.1,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    for (const key of [
      "reactBitsGrainientPaletteMode",
      "reactBitsGrainientPrimaryColor",
      "reactBitsGrainientHarmony",
      "reactBitsGrainientColorOne",
      "reactBitsGrainientColorTwo",
      "reactBitsGrainientColorThree",
      "reactBitsGrainientTimeSpeed",
      "reactBitsGrainientColorBalance",
      "reactBitsGrainientWarpStrength",
      "reactBitsGrainientWarpFrequency",
      "reactBitsGrainientWarpSpeed",
      "reactBitsGrainientWarpAmplitude",
      "reactBitsGrainientBlendAngle",
      "reactBitsGrainientBlendSoftness",
      "reactBitsGrainientRotationAmount",
      "reactBitsGrainientNoiseScale",
      "reactBitsGrainientGrainAmount",
      "reactBitsGrainientGrainScale",
      "reactBitsGrainientGrainAnimated",
      "reactBitsGrainientContrast",
      "reactBitsGrainientGamma",
      "reactBitsGrainientSaturation",
      "reactBitsGrainientCenterX",
      "reactBitsGrainientCenterY",
      "reactBitsGrainientZoom",
    ]) {
      assert.equal(freeSettings[key], DEFAULT_CHIMER_SETTINGS[key])
    }

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "react-bits-grainient")
    assert.equal(premiumSettings.reactBitsGrainientPaletteMode, "harmony")
    assert.equal(premiumSettings.reactBitsGrainientPrimaryColor, "#FF9FFC")
    assert.equal(premiumSettings.reactBitsGrainientHarmony, "triad")
    assert.equal(premiumSettings.reactBitsGrainientColorOne, "#ABCDEF")
    assert.equal(premiumSettings.reactBitsGrainientColorTwo, "#010203")
    assert.equal(premiumSettings.reactBitsGrainientColorThree, "#111111")
    assert.equal(premiumSettings.reactBitsGrainientTimeSpeed, 0.8)
    assert.equal(premiumSettings.reactBitsGrainientColorBalance, 0.4)
    assert.equal(premiumSettings.reactBitsGrainientWarpStrength, 1.7)
    assert.equal(premiumSettings.reactBitsGrainientWarpFrequency, 8)
    assert.equal(premiumSettings.reactBitsGrainientWarpSpeed, 2.4)
    assert.equal(premiumSettings.reactBitsGrainientWarpAmplitude, 64)
    assert.equal(premiumSettings.reactBitsGrainientBlendAngle, 22)
    assert.equal(premiumSettings.reactBitsGrainientBlendSoftness, 0.18)
    assert.equal(premiumSettings.reactBitsGrainientRotationAmount, 700)
    assert.equal(premiumSettings.reactBitsGrainientNoiseScale, 3)
    assert.equal(premiumSettings.reactBitsGrainientGrainAmount, 0.25)
    assert.equal(premiumSettings.reactBitsGrainientGrainScale, 4)
    assert.equal(premiumSettings.reactBitsGrainientGrainAnimated, true)
    assert.equal(premiumSettings.reactBitsGrainientContrast, 1.7)
    assert.equal(premiumSettings.reactBitsGrainientGamma, 1.2)
    assert.equal(premiumSettings.reactBitsGrainientSaturation, 1.3)
    assert.equal(premiumSettings.reactBitsGrainientCenterX, 0.2)
    assert.equal(premiumSettings.reactBitsGrainientCenterY, -0.2)
    assert.equal(premiumSettings.reactBitsGrainientZoom, 1.1)
  })

  it("resets React Bits Grid Scan controls without premium background access", () => {
    const input = {
      backgroundId: "react-bits-grid-scan",
      reactBitsGridScanPaletteMode: "harmony",
      reactBitsGridScanPrimaryColor: "#FF9FFC",
      reactBitsGridScanHarmony: "triad",
      reactBitsGridScanLinesColor: "#ABCDEF",
      reactBitsGridScanScanColor: "#010203",
      reactBitsGridScanSensitivity: 0.7,
      reactBitsGridScanLineThickness: 2.4,
      reactBitsGridScanScanOpacity: 0.6,
      reactBitsGridScanGridScale: 0.2,
      reactBitsGridScanLineStyle: "dotted",
      reactBitsGridScanLineJitter: 0.5,
      reactBitsGridScanDirection: "backward",
      reactBitsGridScanNoiseIntensity: 0.08,
      reactBitsGridScanBloomOpacity: 0.4,
      reactBitsGridScanScanGlow: 1.2,
      reactBitsGridScanScanSoftness: 3.2,
      reactBitsGridScanPhaseTaper: 0.25,
      reactBitsGridScanScanDuration: 3,
      reactBitsGridScanScanDelay: 1,
      reactBitsGridScanEnablePointerInteraction: true,
      reactBitsGridScanScanOnClick: true,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    for (const key of [
      "reactBitsGridScanPaletteMode",
      "reactBitsGridScanPrimaryColor",
      "reactBitsGridScanHarmony",
      "reactBitsGridScanLinesColor",
      "reactBitsGridScanScanColor",
      "reactBitsGridScanSensitivity",
      "reactBitsGridScanLineThickness",
      "reactBitsGridScanScanOpacity",
      "reactBitsGridScanGridScale",
      "reactBitsGridScanLineStyle",
      "reactBitsGridScanLineJitter",
      "reactBitsGridScanDirection",
      "reactBitsGridScanNoiseIntensity",
      "reactBitsGridScanBloomOpacity",
      "reactBitsGridScanScanGlow",
      "reactBitsGridScanScanSoftness",
      "reactBitsGridScanPhaseTaper",
      "reactBitsGridScanScanDuration",
      "reactBitsGridScanScanDelay",
      "reactBitsGridScanEnablePointerInteraction",
      "reactBitsGridScanScanOnClick",
    ]) {
      assert.equal(freeSettings[key], DEFAULT_CHIMER_SETTINGS[key])
    }

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "react-bits-grid-scan")
    assert.equal(premiumSettings.reactBitsGridScanPaletteMode, "harmony")
    assert.equal(premiumSettings.reactBitsGridScanPrimaryColor, "#FF9FFC")
    assert.equal(premiumSettings.reactBitsGridScanHarmony, "triad")
    assert.equal(premiumSettings.reactBitsGridScanLinesColor, "#ABCDEF")
    assert.equal(premiumSettings.reactBitsGridScanScanColor, "#010203")
    assert.equal(premiumSettings.reactBitsGridScanSensitivity, 0.7)
    assert.equal(premiumSettings.reactBitsGridScanLineThickness, 2.4)
    assert.equal(premiumSettings.reactBitsGridScanScanOpacity, 0.6)
    assert.equal(premiumSettings.reactBitsGridScanGridScale, 0.2)
    assert.equal(premiumSettings.reactBitsGridScanLineStyle, "dotted")
    assert.equal(premiumSettings.reactBitsGridScanLineJitter, 0.5)
    assert.equal(premiumSettings.reactBitsGridScanDirection, "backward")
    assert.equal(premiumSettings.reactBitsGridScanNoiseIntensity, 0.08)
    assert.equal(premiumSettings.reactBitsGridScanBloomOpacity, 0.4)
    assert.equal(premiumSettings.reactBitsGridScanScanGlow, 1.2)
    assert.equal(premiumSettings.reactBitsGridScanScanSoftness, 3.2)
    assert.equal(premiumSettings.reactBitsGridScanPhaseTaper, 0.25)
    assert.equal(premiumSettings.reactBitsGridScanScanDuration, 3)
    assert.equal(premiumSettings.reactBitsGridScanScanDelay, 1)
    assert.equal(premiumSettings.reactBitsGridScanEnablePointerInteraction, true)
    assert.equal(premiumSettings.reactBitsGridScanScanOnClick, true)
  })

  it("resets React Bits Beams controls without premium background access", () => {
    const input = {
      backgroundId: "react-bits-beams",
      reactBitsBeamsPaletteMode: "harmony",
      reactBitsBeamsPrimaryColor: "#ABCDEF",
      reactBitsBeamsHarmony: "triad",
      reactBitsBeamsLightColor: "#010203",
      reactBitsBeamsBeamWidth: 3.2,
      reactBitsBeamsBeamHeight: 18,
      reactBitsBeamsBeamNumber: 18,
      reactBitsBeamsSpeed: 3.5,
      reactBitsBeamsNoiseIntensity: 2.4,
      reactBitsBeamsScale: 0.42,
      reactBitsBeamsRotation: 24,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    for (const key of [
      "reactBitsBeamsPaletteMode",
      "reactBitsBeamsPrimaryColor",
      "reactBitsBeamsHarmony",
      "reactBitsBeamsLightColor",
      "reactBitsBeamsBeamWidth",
      "reactBitsBeamsBeamHeight",
      "reactBitsBeamsBeamNumber",
      "reactBitsBeamsSpeed",
      "reactBitsBeamsNoiseIntensity",
      "reactBitsBeamsScale",
      "reactBitsBeamsRotation",
    ]) {
      assert.equal(freeSettings[key], DEFAULT_CHIMER_SETTINGS[key])
    }

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "react-bits-beams")
    assert.equal(premiumSettings.reactBitsBeamsPaletteMode, "harmony")
    assert.equal(premiumSettings.reactBitsBeamsPrimaryColor, "#ABCDEF")
    assert.equal(premiumSettings.reactBitsBeamsHarmony, "triad")
    assert.equal(premiumSettings.reactBitsBeamsLightColor, "#010203")
    assert.equal(premiumSettings.reactBitsBeamsBeamWidth, 3.2)
    assert.equal(premiumSettings.reactBitsBeamsBeamHeight, 18)
    assert.equal(premiumSettings.reactBitsBeamsBeamNumber, 18)
    assert.equal(premiumSettings.reactBitsBeamsSpeed, 3.5)
    assert.equal(premiumSettings.reactBitsBeamsNoiseIntensity, 2.4)
    assert.equal(premiumSettings.reactBitsBeamsScale, 0.42)
    assert.equal(premiumSettings.reactBitsBeamsRotation, 24)
  })

  it("resets React Bits Pixel Snow controls without premium background access", () => {
    const input = {
      backgroundId: "react-bits-pixel-snow",
      reactBitsPixelSnowPaletteMode: "harmony",
      reactBitsPixelSnowPrimaryColor: "#ABCDEF",
      reactBitsPixelSnowHarmony: "triad",
      reactBitsPixelSnowColor: "#010203",
      reactBitsPixelSnowFlakeSize: 0.04,
      reactBitsPixelSnowMinFlakeSize: 2.5,
      reactBitsPixelSnowPixelResolution: 320,
      reactBitsPixelSnowSpeed: 2.5,
      reactBitsPixelSnowDepthFade: 16,
      reactBitsPixelSnowFarPlane: 36,
      reactBitsPixelSnowBrightness: 2,
      reactBitsPixelSnowGamma: 0.75,
      reactBitsPixelSnowDensity: 0.6,
      reactBitsPixelSnowVariant: "snowflake",
      reactBitsPixelSnowDirection: 220,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    for (const key of [
      "reactBitsPixelSnowPaletteMode",
      "reactBitsPixelSnowPrimaryColor",
      "reactBitsPixelSnowHarmony",
      "reactBitsPixelSnowColor",
      "reactBitsPixelSnowFlakeSize",
      "reactBitsPixelSnowMinFlakeSize",
      "reactBitsPixelSnowPixelResolution",
      "reactBitsPixelSnowSpeed",
      "reactBitsPixelSnowDepthFade",
      "reactBitsPixelSnowFarPlane",
      "reactBitsPixelSnowBrightness",
      "reactBitsPixelSnowGamma",
      "reactBitsPixelSnowDensity",
      "reactBitsPixelSnowVariant",
      "reactBitsPixelSnowDirection",
    ]) {
      assert.equal(freeSettings[key], DEFAULT_CHIMER_SETTINGS[key])
    }

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "react-bits-pixel-snow")
    assert.equal(premiumSettings.reactBitsPixelSnowPaletteMode, "harmony")
    assert.equal(premiumSettings.reactBitsPixelSnowPrimaryColor, "#ABCDEF")
    assert.equal(premiumSettings.reactBitsPixelSnowHarmony, "triad")
    assert.equal(premiumSettings.reactBitsPixelSnowColor, "#010203")
    assert.equal(premiumSettings.reactBitsPixelSnowFlakeSize, 0.04)
    assert.equal(premiumSettings.reactBitsPixelSnowMinFlakeSize, 2.5)
    assert.equal(premiumSettings.reactBitsPixelSnowPixelResolution, 320)
    assert.equal(premiumSettings.reactBitsPixelSnowSpeed, 2.5)
    assert.equal(premiumSettings.reactBitsPixelSnowDepthFade, 16)
    assert.equal(premiumSettings.reactBitsPixelSnowFarPlane, 36)
    assert.equal(premiumSettings.reactBitsPixelSnowBrightness, 2)
    assert.equal(premiumSettings.reactBitsPixelSnowGamma, 0.75)
    assert.equal(premiumSettings.reactBitsPixelSnowDensity, 0.6)
    assert.equal(premiumSettings.reactBitsPixelSnowVariant, "snowflake")
    assert.equal(premiumSettings.reactBitsPixelSnowDirection, 220)
  })

  it("resets React Bits Lightning controls without premium background access", () => {
    const input = {
      backgroundId: "react-bits-lightning",
      reactBitsLightningPaletteMode: "harmony",
      reactBitsLightningPrimaryColor: "#ABCDEF",
      reactBitsLightningHarmony: "triad",
      reactBitsLightningColor: "#010203",
      reactBitsLightningHue: 310,
      reactBitsLightningXOffset: -0.5,
      reactBitsLightningSpeed: 2.25,
      reactBitsLightningIntensity: 3.5,
      reactBitsLightningSize: 1.8,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    for (const key of [
      "reactBitsLightningPaletteMode",
      "reactBitsLightningPrimaryColor",
      "reactBitsLightningHarmony",
      "reactBitsLightningColor",
      "reactBitsLightningHue",
      "reactBitsLightningXOffset",
      "reactBitsLightningSpeed",
      "reactBitsLightningIntensity",
      "reactBitsLightningSize",
    ]) {
      assert.equal(freeSettings[key], DEFAULT_CHIMER_SETTINGS[key])
    }

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "react-bits-lightning")
    assert.equal(premiumSettings.reactBitsLightningPaletteMode, "harmony")
    assert.equal(premiumSettings.reactBitsLightningPrimaryColor, "#ABCDEF")
    assert.equal(premiumSettings.reactBitsLightningHarmony, "triad")
    assert.equal(premiumSettings.reactBitsLightningColor, "#010203")
    assert.equal(premiumSettings.reactBitsLightningHue, 310)
    assert.equal(premiumSettings.reactBitsLightningXOffset, -0.5)
    assert.equal(premiumSettings.reactBitsLightningSpeed, 2.25)
    assert.equal(premiumSettings.reactBitsLightningIntensity, 3.5)
    assert.equal(premiumSettings.reactBitsLightningSize, 1.8)
  })

  it("resets React Bits Prismatic Burst controls without premium background access", () => {
    const input = {
      backgroundId: "react-bits-prismatic-burst",
      reactBitsPrismaticBurstPaletteMode: "harmony",
      reactBitsPrismaticBurstPrimaryColor: "#ABCDEF",
      reactBitsPrismaticBurstHarmony: "triad",
      reactBitsPrismaticBurstColorOne: "#010203",
      reactBitsPrismaticBurstColorTwo: "#AABBCC",
      reactBitsPrismaticBurstColorThree: "#DDEEFF",
      reactBitsPrismaticBurstColorFour: "#112233",
      reactBitsPrismaticBurstIntensity: 3.25,
      reactBitsPrismaticBurstSpeed: 1.75,
      reactBitsPrismaticBurstAnimationType: "hover",
      reactBitsPrismaticBurstDistort: 18,
      reactBitsPrismaticBurstOffsetX: 240,
      reactBitsPrismaticBurstOffsetY: -160,
      reactBitsPrismaticBurstHoverDampness: 0.42,
      reactBitsPrismaticBurstRayCount: 24,
      reactBitsPrismaticBurstMixBlendMode: "screen",
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    for (const key of [
      "reactBitsPrismaticBurstPaletteMode",
      "reactBitsPrismaticBurstPrimaryColor",
      "reactBitsPrismaticBurstHarmony",
      "reactBitsPrismaticBurstColorOne",
      "reactBitsPrismaticBurstColorTwo",
      "reactBitsPrismaticBurstColorThree",
      "reactBitsPrismaticBurstColorFour",
      "reactBitsPrismaticBurstIntensity",
      "reactBitsPrismaticBurstSpeed",
      "reactBitsPrismaticBurstAnimationType",
      "reactBitsPrismaticBurstDistort",
      "reactBitsPrismaticBurstOffsetX",
      "reactBitsPrismaticBurstOffsetY",
      "reactBitsPrismaticBurstHoverDampness",
      "reactBitsPrismaticBurstRayCount",
      "reactBitsPrismaticBurstMixBlendMode",
    ]) {
      assert.equal(freeSettings[key], DEFAULT_CHIMER_SETTINGS[key])
    }

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "react-bits-prismatic-burst")
    assert.equal(premiumSettings.reactBitsPrismaticBurstPaletteMode, "harmony")
    assert.equal(premiumSettings.reactBitsPrismaticBurstPrimaryColor, "#ABCDEF")
    assert.equal(premiumSettings.reactBitsPrismaticBurstHarmony, "triad")
    assert.equal(premiumSettings.reactBitsPrismaticBurstColorOne, "#010203")
    assert.equal(premiumSettings.reactBitsPrismaticBurstColorTwo, "#AABBCC")
    assert.equal(premiumSettings.reactBitsPrismaticBurstColorThree, "#DDEEFF")
    assert.equal(premiumSettings.reactBitsPrismaticBurstColorFour, "#112233")
    assert.equal(premiumSettings.reactBitsPrismaticBurstIntensity, 3.25)
    assert.equal(premiumSettings.reactBitsPrismaticBurstSpeed, 1.75)
    assert.equal(premiumSettings.reactBitsPrismaticBurstAnimationType, "hover")
    assert.equal(premiumSettings.reactBitsPrismaticBurstDistort, 18)
    assert.equal(premiumSettings.reactBitsPrismaticBurstOffsetX, 240)
    assert.equal(premiumSettings.reactBitsPrismaticBurstOffsetY, -160)
    assert.equal(premiumSettings.reactBitsPrismaticBurstHoverDampness, 0.42)
    assert.equal(premiumSettings.reactBitsPrismaticBurstRayCount, 24)
    assert.equal(premiumSettings.reactBitsPrismaticBurstMixBlendMode, "screen")
  })

  it("resets React Bits Galaxy controls without premium background access", () => {
    const input = {
      backgroundId: "react-bits-galaxy",
      reactBitsGalaxyPaletteMode: "harmony",
      reactBitsGalaxyPrimaryColor: "#ABCDEF",
      reactBitsGalaxyHarmony: "triad",
      reactBitsGalaxyColor: "#010203",
      reactBitsGalaxyHueShift: 310,
      reactBitsGalaxyFocalX: 0.2,
      reactBitsGalaxyFocalY: 0.8,
      reactBitsGalaxyRotationDeg: 45,
      reactBitsGalaxyStarSpeed: 1.25,
      reactBitsGalaxyDensity: 1.6,
      reactBitsGalaxySpeed: 1.75,
      reactBitsGalaxyMouseInteraction: false,
      reactBitsGalaxyGlowIntensity: 0.85,
      reactBitsGalaxySaturation: 1.4,
      reactBitsGalaxyMouseRepulsion: false,
      reactBitsGalaxyRepulsionStrength: 3.25,
      reactBitsGalaxyTwinkleIntensity: 0.72,
      reactBitsGalaxyRotationSpeed: -0.25,
      reactBitsGalaxyAutoCenterRepulsion: 1.5,
      reactBitsGalaxyTransparent: false,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    for (const key of [
      "reactBitsGalaxyPaletteMode",
      "reactBitsGalaxyPrimaryColor",
      "reactBitsGalaxyHarmony",
      "reactBitsGalaxyColor",
      "reactBitsGalaxyHueShift",
      "reactBitsGalaxyFocalX",
      "reactBitsGalaxyFocalY",
      "reactBitsGalaxyRotationDeg",
      "reactBitsGalaxyStarSpeed",
      "reactBitsGalaxyDensity",
      "reactBitsGalaxySpeed",
      "reactBitsGalaxyMouseInteraction",
      "reactBitsGalaxyGlowIntensity",
      "reactBitsGalaxySaturation",
      "reactBitsGalaxyMouseRepulsion",
      "reactBitsGalaxyRepulsionStrength",
      "reactBitsGalaxyTwinkleIntensity",
      "reactBitsGalaxyRotationSpeed",
      "reactBitsGalaxyAutoCenterRepulsion",
      "reactBitsGalaxyTransparent",
    ]) {
      assert.equal(freeSettings[key], DEFAULT_CHIMER_SETTINGS[key])
    }

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "react-bits-galaxy")
    assert.equal(premiumSettings.reactBitsGalaxyPaletteMode, "harmony")
    assert.equal(premiumSettings.reactBitsGalaxyPrimaryColor, "#ABCDEF")
    assert.equal(premiumSettings.reactBitsGalaxyHarmony, "triad")
    assert.equal(premiumSettings.reactBitsGalaxyColor, "#010203")
    assert.equal(premiumSettings.reactBitsGalaxyHueShift, 310)
    assert.equal(premiumSettings.reactBitsGalaxyFocalX, 0.2)
    assert.equal(premiumSettings.reactBitsGalaxyFocalY, 0.8)
    assert.equal(premiumSettings.reactBitsGalaxyRotationDeg, 45)
    assert.equal(premiumSettings.reactBitsGalaxyStarSpeed, 1.25)
    assert.equal(premiumSettings.reactBitsGalaxyDensity, 1.6)
    assert.equal(premiumSettings.reactBitsGalaxySpeed, 1.75)
    assert.equal(premiumSettings.reactBitsGalaxyMouseInteraction, false)
    assert.equal(premiumSettings.reactBitsGalaxyGlowIntensity, 0.85)
    assert.equal(premiumSettings.reactBitsGalaxySaturation, 1.4)
    assert.equal(premiumSettings.reactBitsGalaxyMouseRepulsion, false)
    assert.equal(premiumSettings.reactBitsGalaxyRepulsionStrength, 3.25)
    assert.equal(premiumSettings.reactBitsGalaxyTwinkleIntensity, 0.72)
    assert.equal(premiumSettings.reactBitsGalaxyRotationSpeed, -0.25)
    assert.equal(premiumSettings.reactBitsGalaxyAutoCenterRepulsion, 1.5)
    assert.equal(premiumSettings.reactBitsGalaxyTransparent, false)
  })

  it("resets React Bits Dither controls without premium background access", () => {
    const input = {
      backgroundId: "react-bits-dither",
      reactBitsDitherPaletteMode: "harmony",
      reactBitsDitherPrimaryColor: "#ABCDEF",
      reactBitsDitherHarmony: "triad",
      reactBitsDitherColor: "#010203",
      reactBitsDitherWaveSpeed: 0.22,
      reactBitsDitherWaveFrequency: 5.5,
      reactBitsDitherWaveAmplitude: 0.62,
      reactBitsDitherColorNum: 9,
      reactBitsDitherPixelSize: 8,
      reactBitsDitherMouseInteraction: false,
      reactBitsDitherMouseRadius: 1.75,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    for (const key of [
      "reactBitsDitherPaletteMode",
      "reactBitsDitherPrimaryColor",
      "reactBitsDitherHarmony",
      "reactBitsDitherColor",
      "reactBitsDitherWaveSpeed",
      "reactBitsDitherWaveFrequency",
      "reactBitsDitherWaveAmplitude",
      "reactBitsDitherColorNum",
      "reactBitsDitherPixelSize",
      "reactBitsDitherMouseInteraction",
      "reactBitsDitherMouseRadius",
    ]) {
      assert.equal(freeSettings[key], DEFAULT_CHIMER_SETTINGS[key])
    }

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "react-bits-dither")
    assert.equal(premiumSettings.reactBitsDitherPaletteMode, "harmony")
    assert.equal(premiumSettings.reactBitsDitherPrimaryColor, "#ABCDEF")
    assert.equal(premiumSettings.reactBitsDitherHarmony, "triad")
    assert.equal(premiumSettings.reactBitsDitherColor, "#010203")
    assert.equal(premiumSettings.reactBitsDitherWaveSpeed, 0.22)
    assert.equal(premiumSettings.reactBitsDitherWaveFrequency, 5.5)
    assert.equal(premiumSettings.reactBitsDitherWaveAmplitude, 0.62)
    assert.equal(premiumSettings.reactBitsDitherColorNum, 9)
    assert.equal(premiumSettings.reactBitsDitherPixelSize, 8)
    assert.equal(premiumSettings.reactBitsDitherMouseInteraction, false)
    assert.equal(premiumSettings.reactBitsDitherMouseRadius, 1.75)
  })

  it("resets Aceternity 3D Globe controls without premium background access", () => {
    const input = {
      backgroundId: "aceternity-3d-globe",
      aceternity3DGlobeViewStyle: "graphic",
      aceternity3DGlobeBackgroundColor: "#010203",
      aceternity3DGlobeGlobeColor: "#123456",
      aceternity3DGlobeGraphicMapColor: "#E6E6E6",
      aceternity3DGlobeGraphicGlowColor: "#F8FAFC",
      aceternity3DGlobeGraphicMarkerColor: "#FB6415",
      aceternity3DGlobeGraphicMapSamples: 9000,
      aceternity3DGlobeAutoRotateSpeed: 1.2,
      aceternity3DGlobeReverseSpin: false,
      aceternity3DGlobeScale: 0.72,
      aceternity3DGlobeBumpScale: 1.8,
      aceternity3DGlobeAmbientIntensity: 1.1,
      aceternity3DGlobePointLightIntensity: 2.4,
      aceternity3DGlobeLightingMode: "sun",
      aceternity3DGlobeEnablePan: true,
      aceternity3DGlobePanX: -24,
      aceternity3DGlobePanY: 18,
      aceternity3DGlobeShowTilt: false,
      aceternity3DGlobeShowAtmosphere: true,
      aceternity3DGlobeAtmosphereColor: "#AABBCC",
      aceternity3DGlobeAtmosphereIntensity: 1.4,
      aceternity3DGlobeAtmosphereBlur: 3.5,
      aceternity3DGlobeShowWireframe: true,
      aceternity3DGlobeWireframeColor: "#DDEEFF",
      aceternity3DGlobeMarkerEnabled: true,
      aceternity3DGlobeMarkerLat: 37.7749,
      aceternity3DGlobeMarkerLng: -122.4194,
      aceternity3DGlobeMarkerLabel: "San Francisco",
      aceternity3DGlobeMarkerIcon: "star",
      aceternity3DGlobeMarkerSize: 0.12,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    assert.equal(freeSettings.aceternity3DGlobeViewStyle, DEFAULT_CHIMER_SETTINGS.aceternity3DGlobeViewStyle)
    assert.equal(freeSettings.aceternity3DGlobeBackgroundColor, DEFAULT_CHIMER_SETTINGS.aceternity3DGlobeBackgroundColor)
    assert.equal(freeSettings.aceternity3DGlobeGlobeColor, DEFAULT_CHIMER_SETTINGS.aceternity3DGlobeGlobeColor)
    assert.equal(freeSettings.aceternity3DGlobeGraphicMapColor, DEFAULT_CHIMER_SETTINGS.aceternity3DGlobeGraphicMapColor)
    assert.equal(freeSettings.aceternity3DGlobeGraphicGlowColor, DEFAULT_CHIMER_SETTINGS.aceternity3DGlobeGraphicGlowColor)
    assert.equal(freeSettings.aceternity3DGlobeGraphicMarkerColor, DEFAULT_CHIMER_SETTINGS.aceternity3DGlobeGraphicMarkerColor)
    assert.equal(freeSettings.aceternity3DGlobeGraphicMapSamples, DEFAULT_CHIMER_SETTINGS.aceternity3DGlobeGraphicMapSamples)
    assert.equal(freeSettings.aceternity3DGlobeAutoRotateSpeed, DEFAULT_CHIMER_SETTINGS.aceternity3DGlobeAutoRotateSpeed)
    assert.equal(freeSettings.aceternity3DGlobeReverseSpin, DEFAULT_CHIMER_SETTINGS.aceternity3DGlobeReverseSpin)
    assert.equal(freeSettings.aceternity3DGlobeScale, DEFAULT_CHIMER_SETTINGS.aceternity3DGlobeScale)
    assert.equal(freeSettings.aceternity3DGlobeBumpScale, DEFAULT_CHIMER_SETTINGS.aceternity3DGlobeBumpScale)
    assert.equal(freeSettings.aceternity3DGlobeAmbientIntensity, DEFAULT_CHIMER_SETTINGS.aceternity3DGlobeAmbientIntensity)
    assert.equal(freeSettings.aceternity3DGlobePointLightIntensity, DEFAULT_CHIMER_SETTINGS.aceternity3DGlobePointLightIntensity)
    assert.equal(freeSettings.aceternity3DGlobeLightingMode, DEFAULT_CHIMER_SETTINGS.aceternity3DGlobeLightingMode)
    assert.equal(freeSettings.aceternity3DGlobeEnablePan, DEFAULT_CHIMER_SETTINGS.aceternity3DGlobeEnablePan)
    assert.equal(freeSettings.aceternity3DGlobePanX, DEFAULT_CHIMER_SETTINGS.aceternity3DGlobePanX)
    assert.equal(freeSettings.aceternity3DGlobePanY, DEFAULT_CHIMER_SETTINGS.aceternity3DGlobePanY)
    assert.equal(freeSettings.aceternity3DGlobeShowTilt, DEFAULT_CHIMER_SETTINGS.aceternity3DGlobeShowTilt)
    assert.equal(freeSettings.aceternity3DGlobeShowAtmosphere, DEFAULT_CHIMER_SETTINGS.aceternity3DGlobeShowAtmosphere)
    assert.equal(freeSettings.aceternity3DGlobeAtmosphereColor, DEFAULT_CHIMER_SETTINGS.aceternity3DGlobeAtmosphereColor)
    assert.equal(freeSettings.aceternity3DGlobeAtmosphereIntensity, DEFAULT_CHIMER_SETTINGS.aceternity3DGlobeAtmosphereIntensity)
    assert.equal(freeSettings.aceternity3DGlobeAtmosphereBlur, DEFAULT_CHIMER_SETTINGS.aceternity3DGlobeAtmosphereBlur)
    assert.equal(freeSettings.aceternity3DGlobeShowWireframe, DEFAULT_CHIMER_SETTINGS.aceternity3DGlobeShowWireframe)
    assert.equal(freeSettings.aceternity3DGlobeWireframeColor, DEFAULT_CHIMER_SETTINGS.aceternity3DGlobeWireframeColor)
    assert.equal(freeSettings.aceternity3DGlobeMarkerEnabled, DEFAULT_CHIMER_SETTINGS.aceternity3DGlobeMarkerEnabled)
    assert.equal(freeSettings.aceternity3DGlobeMarkerLat, DEFAULT_CHIMER_SETTINGS.aceternity3DGlobeMarkerLat)
    assert.equal(freeSettings.aceternity3DGlobeMarkerLng, DEFAULT_CHIMER_SETTINGS.aceternity3DGlobeMarkerLng)
    assert.equal(freeSettings.aceternity3DGlobeMarkerLabel, DEFAULT_CHIMER_SETTINGS.aceternity3DGlobeMarkerLabel)
    assert.equal(freeSettings.aceternity3DGlobeMarkerIcon, DEFAULT_CHIMER_SETTINGS.aceternity3DGlobeMarkerIcon)
    assert.equal(freeSettings.aceternity3DGlobeMarkerSize, DEFAULT_CHIMER_SETTINGS.aceternity3DGlobeMarkerSize)

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "aceternity-3d-globe")
    assert.equal(premiumSettings.aceternity3DGlobeViewStyle, "graphic")
    assert.equal(premiumSettings.aceternity3DGlobeBackgroundColor, "#010203")
    assert.equal(premiumSettings.aceternity3DGlobeGlobeColor, "#123456")
    assert.equal(premiumSettings.aceternity3DGlobeGraphicMapColor, "#E6E6E6")
    assert.equal(premiumSettings.aceternity3DGlobeGraphicGlowColor, "#F8FAFC")
    assert.equal(premiumSettings.aceternity3DGlobeGraphicMarkerColor, "#FB6415")
    assert.equal(premiumSettings.aceternity3DGlobeGraphicMapSamples, 9000)
    assert.equal(premiumSettings.aceternity3DGlobeAutoRotateSpeed, 1.2)
    assert.equal(premiumSettings.aceternity3DGlobeReverseSpin, true)
    assert.equal(premiumSettings.aceternity3DGlobeScale, 0.72)
    assert.equal(premiumSettings.aceternity3DGlobeBumpScale, 1.8)
    assert.equal(premiumSettings.aceternity3DGlobeAmbientIntensity, 1.1)
    assert.equal(premiumSettings.aceternity3DGlobePointLightIntensity, 2.4)
    assert.equal(premiumSettings.aceternity3DGlobeLightingMode, "sun")
    assert.equal(premiumSettings.aceternity3DGlobeEnablePan, true)
    assert.equal(premiumSettings.aceternity3DGlobePanX, -24)
    assert.equal(premiumSettings.aceternity3DGlobePanY, 18)
    assert.equal(premiumSettings.aceternity3DGlobeShowTilt, true)
    assert.equal(premiumSettings.aceternity3DGlobeShowAtmosphere, true)
    assert.equal(premiumSettings.aceternity3DGlobeAtmosphereColor, "#AABBCC")
    assert.equal(premiumSettings.aceternity3DGlobeAtmosphereIntensity, 1.4)
    assert.equal(premiumSettings.aceternity3DGlobeAtmosphereBlur, 3.5)
    assert.equal(premiumSettings.aceternity3DGlobeShowWireframe, true)
    assert.equal(premiumSettings.aceternity3DGlobeWireframeColor, "#DDEEFF")
    assert.equal(premiumSettings.aceternity3DGlobeMarkerEnabled, true)
    assert.equal(premiumSettings.aceternity3DGlobeMarkerLat, 37.7749)
    assert.equal(premiumSettings.aceternity3DGlobeMarkerLng, -122.4194)
    assert.equal(premiumSettings.aceternity3DGlobeMarkerLabel, "San Francisco")
    assert.equal(premiumSettings.aceternity3DGlobeMarkerIcon, "star")
    assert.equal(premiumSettings.aceternity3DGlobeMarkerSize, 0.12)
  })

  it("resets Magic UI Retro Grid controls without premium background access", () => {
    const input = {
      backgroundId: "magicui-retro-grid",
      magicRetroGridBackgroundColor: "#010203",
      magicRetroGridLightLineColor: "#AABBCC",
      magicRetroGridDarkLineColor: "#112233",
      magicRetroGridAngle: 72,
      magicRetroGridCellSize: 88,
      magicRetroGridOpacity: 0.72,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    assert.equal(freeSettings.magicRetroGridBackgroundColor, DEFAULT_CHIMER_SETTINGS.magicRetroGridBackgroundColor)
    assert.equal(freeSettings.magicRetroGridLightLineColor, DEFAULT_CHIMER_SETTINGS.magicRetroGridLightLineColor)
    assert.equal(freeSettings.magicRetroGridDarkLineColor, DEFAULT_CHIMER_SETTINGS.magicRetroGridDarkLineColor)
    assert.equal(freeSettings.magicRetroGridAngle, DEFAULT_CHIMER_SETTINGS.magicRetroGridAngle)
    assert.equal(freeSettings.magicRetroGridCellSize, DEFAULT_CHIMER_SETTINGS.magicRetroGridCellSize)
    assert.equal(freeSettings.magicRetroGridOpacity, DEFAULT_CHIMER_SETTINGS.magicRetroGridOpacity)

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "magicui-retro-grid")
    assert.equal(premiumSettings.magicRetroGridBackgroundColor, "#010203")
    assert.equal(premiumSettings.magicRetroGridLightLineColor, "#AABBCC")
    assert.equal(premiumSettings.magicRetroGridDarkLineColor, "#112233")
    assert.equal(premiumSettings.magicRetroGridAngle, 72)
    assert.equal(premiumSettings.magicRetroGridCellSize, 88)
    assert.equal(premiumSettings.magicRetroGridOpacity, 0.72)
  })

  it("resets Magic UI Light Rays controls without premium background access", () => {
    const input = {
      backgroundId: "magicui-light-rays",
      magicLightRaysBackgroundColor: "#010203",
      magicLightRaysColor: "#A0D2FF",
      magicLightRaysCount: 12,
      magicLightRaysBlur: 48,
      magicLightRaysSpeed: 18,
      magicLightRaysLength: 96,
      magicLightRaysOpacity: 0.82,
    }

    const freeSettings = sanitizeChimerSettingsForEntitlements(input, [])

    assert.equal(freeSettings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    assert.equal(freeSettings.magicLightRaysBackgroundColor, DEFAULT_CHIMER_SETTINGS.magicLightRaysBackgroundColor)
    assert.equal(freeSettings.magicLightRaysColor, DEFAULT_CHIMER_SETTINGS.magicLightRaysColor)
    assert.equal(freeSettings.magicLightRaysCount, DEFAULT_CHIMER_SETTINGS.magicLightRaysCount)
    assert.equal(freeSettings.magicLightRaysBlur, DEFAULT_CHIMER_SETTINGS.magicLightRaysBlur)
    assert.equal(freeSettings.magicLightRaysSpeed, DEFAULT_CHIMER_SETTINGS.magicLightRaysSpeed)
    assert.equal(freeSettings.magicLightRaysLength, DEFAULT_CHIMER_SETTINGS.magicLightRaysLength)
    assert.equal(freeSettings.magicLightRaysOpacity, DEFAULT_CHIMER_SETTINGS.magicLightRaysOpacity)

    const premiumSettings = sanitizeChimerSettingsForEntitlements(input, [FEATURE_KEYS.premiumBackgrounds])

    assert.equal(premiumSettings.backgroundId, "magicui-light-rays")
    assert.equal(premiumSettings.magicLightRaysBackgroundColor, "#010203")
    assert.equal(premiumSettings.magicLightRaysColor, "#A0D2FF")
    assert.equal(premiumSettings.magicLightRaysCount, 12)
    assert.equal(premiumSettings.magicLightRaysBlur, 48)
    assert.equal(premiumSettings.magicLightRaysSpeed, 18)
    assert.equal(premiumSettings.magicLightRaysLength, 96)
    assert.equal(premiumSettings.magicLightRaysOpacity, 0.82)
  })

  it("strips custom colors for users without the Chimer custom colors feature", () => {
    const settings = sanitizeChimerSettingsForEntitlements({
      primaryFontColor: "#000000",
      secondaryFontColor: "#123456",
      clockModeFontColor: "#654321",
      movingBackgroundMainColor: "#ABCDEF",
      movingBackgroundOrbColor: "#FEDCBA",
      movingBackgroundEnabled: false,
      backgroundId: "aceternity-aurora",
      sparklesParticleColor: "#ABC123",
      sparklesParticleDensity: 180,
      sparklesSpeed: 6,
      gradientAnimationFirstColor: "#112233",
      gradientAnimationSpeed: 2,
      animateUiGradientPrimaryColor: "#102030",
      animateUiGradientHarmony: "split-complementary",
      animateUiGradientOpacity: 0.42,
      animateUiStarsColor: "#EAF6FF",
      animateUiStarsSpeed: 72,
      animateUiStarsDensity: 1.2,
      animateUiStarsParallax: 0.08,
      animateUiHoleStrokeColor: "#112233",
      animateUiHoleParticleColor: "#EAF6FF",
      animateUiHoleLineCount: 72,
      animateUiHoleDiscCount: 64,
      chamaacLightSpeedWarpSpeed: 3.5,
      chamaacLightSpeedWarpSpeedVersion: 2,
      chamaacLightSpeedParticleCount: 180,
      chamaacLightSpeedLightColor: "#33B2FF",
      chamaacLightSpeedIntensity: 4.5,
      chamaacLightSpeedRadius: 42,
      chamaacLightSpeedCylinderLength: 220,
      chamaacElectricMistColor: "#33B2FF",
      chamaacElectricMistSpeed: 250,
      chamaacElectricMistControlVersion: 2,
      chamaacElectricMistDetail: 2.4,
      chamaacElectricMistDistortion: 5.5,
      chamaacElectricMistBrightness: 80,
      chamaacAstralFlowPaletteMode: "harmony",
      chamaacAstralFlowPrimaryColor: "#33B2FF",
      chamaacAstralFlowHarmony: "split-complementary",
      chamaacAstralFlowColorOne: "#112233",
      chamaacAstralFlowColorTwo: "#445566",
      chamaacAstralFlowColorThree: "#778899",
      chamaacAstralFlowSpeed: 2.1,
      chamaacAstralFlowFlowMin: 4.2,
      chamaacAstralFlowFlowMax: 8.4,
      chamaacDeepSpaceNebulaPaletteMode: "harmony",
      chamaacDeepSpaceNebulaPrimaryColor: "#763B65",
      chamaacDeepSpaceNebulaHarmony: "complementary",
      chamaacDeepSpaceNebulaColorOne: "#5EFFF4",
      chamaacDeepSpaceNebulaColorTwo: "#763B65",
      chamaacDeepSpaceNebulaColorThree: "#1A0B2E",
      chamaacDeepSpaceNebulaSpeed: 3.6,
      chamaacGridBloomColor: "#E040FB",
      chamaacGridBloomSpeed: 2.4,
      chamaacGridBloomGridScale: 18,
      chamaacGridBloomRotationSpeed: 0.8,
      chamaacGridBloomFadeFalloff: 14,
      chamaacGridBloomDistortionAmount: 0.18,
      chamaacGridBloomFlowSpeedX: -0.6,
      chamaacGridBloomFlowSpeedY: 0.5,
      chamaacLiquidChromePaletteMode: "harmony",
      chamaacLiquidChromePrimaryColor: "#C0C0C0",
      chamaacLiquidChromeHarmony: "monochromatic",
      chamaacLiquidChromeColorOne: "#C0C0C0",
      chamaacLiquidChromeColorTwo: "#4A4A4A",
      chamaacLiquidChromeFlowSpeed: 1.4,
      chamaacLiquidChromeTimeScale: 0.4,
      chamaacWavesPaletteMode: "harmony",
      chamaacWavesPrimaryColor: "#071697",
      chamaacWavesHarmony: "triad",
      chamaacWavesBackgroundColor: "#000000",
      chamaacWavesColorOne: "#071697",
      chamaacWavesColorTwo: "#00D4FF",
      chamaacWavesColorThree: "#000000",
      chamaacWavesSpeedX: 0.08,
      chamaacWavesSpeedY: 0.04,
      chamaacWavesAmplitude: 48,
      chamaacSynthesisPaletteMode: "harmony",
      chamaacSynthesisPrimaryColor: "#33B2FF",
      chamaacSynthesisHarmony: "split-complementary",
      chamaacSynthesisColorOne: "#112233",
      chamaacSynthesisColorTwo: "#445566",
      chamaacSynthesisColorThree: "#778899",
      chamaacSynthesisSpeed: 1.8,
      chamaacSynthesisComplexity: 16,
      chamaacSynthesisScale: 2.4,
      chamaacSynthesisDistortion: 1.4,
      chamaacSynthesisGlowIntensity: 1.6,
      chamaacSynthesisFlowFrequency: 7.5,
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

    assert.equal(settings.primaryFontColor, DEFAULT_CHIMER_SETTINGS.primaryFontColor)
    assert.equal(settings.secondaryFontColor, DEFAULT_CHIMER_SETTINGS.secondaryFontColor)
    assert.equal(settings.clockModeFontColor, DEFAULT_CHIMER_SETTINGS.clockModeFontColor)
    assert.equal(settings.movingBackgroundMainColor, DEFAULT_CHIMER_SETTINGS.movingBackgroundMainColor)
    assert.equal(settings.movingBackgroundOrbColor, DEFAULT_CHIMER_SETTINGS.movingBackgroundOrbColor)
    assert.equal(settings.movingBackgroundEnabled, false)
    assert.equal(settings.backgroundId, DEFAULT_CHIMER_SETTINGS.backgroundId)
    assert.equal(settings.sparklesParticleColor, DEFAULT_CHIMER_SETTINGS.sparklesParticleColor)
    assert.equal(settings.sparklesParticleDensity, DEFAULT_CHIMER_SETTINGS.sparklesParticleDensity)
    assert.equal(settings.sparklesSpeed, DEFAULT_CHIMER_SETTINGS.sparklesSpeed)
    assert.equal(settings.gradientAnimationFirstColor, DEFAULT_CHIMER_SETTINGS.gradientAnimationFirstColor)
    assert.equal(settings.gradientAnimationSpeed, DEFAULT_CHIMER_SETTINGS.gradientAnimationSpeed)
    assert.equal(settings.animateUiGradientPrimaryColor, DEFAULT_CHIMER_SETTINGS.animateUiGradientPrimaryColor)
    assert.equal(settings.animateUiGradientHarmony, DEFAULT_CHIMER_SETTINGS.animateUiGradientHarmony)
    assert.equal(settings.animateUiGradientOpacity, DEFAULT_CHIMER_SETTINGS.animateUiGradientOpacity)
    assert.equal(settings.animateUiStarsColor, DEFAULT_CHIMER_SETTINGS.animateUiStarsColor)
    assert.equal(settings.animateUiStarsSpeed, DEFAULT_CHIMER_SETTINGS.animateUiStarsSpeed)
    assert.equal(settings.animateUiStarsDensity, DEFAULT_CHIMER_SETTINGS.animateUiStarsDensity)
    assert.equal(settings.animateUiStarsParallax, DEFAULT_CHIMER_SETTINGS.animateUiStarsParallax)
    assert.equal(settings.animateUiHoleStrokeColor, DEFAULT_CHIMER_SETTINGS.animateUiHoleStrokeColor)
    assert.equal(settings.animateUiHoleParticleColor, DEFAULT_CHIMER_SETTINGS.animateUiHoleParticleColor)
    assert.equal(settings.animateUiHoleLineCount, DEFAULT_CHIMER_SETTINGS.animateUiHoleLineCount)
    assert.equal(settings.animateUiHoleDiscCount, DEFAULT_CHIMER_SETTINGS.animateUiHoleDiscCount)
    assert.equal(settings.chamaacLightSpeedWarpSpeed, DEFAULT_CHIMER_SETTINGS.chamaacLightSpeedWarpSpeed)
    assert.equal(settings.chamaacLightSpeedParticleCount, DEFAULT_CHIMER_SETTINGS.chamaacLightSpeedParticleCount)
    assert.equal(settings.chamaacLightSpeedLightColor, DEFAULT_CHIMER_SETTINGS.chamaacLightSpeedLightColor)
    assert.equal(settings.chamaacLightSpeedIntensity, DEFAULT_CHIMER_SETTINGS.chamaacLightSpeedIntensity)
    assert.equal(settings.chamaacLightSpeedRadius, DEFAULT_CHIMER_SETTINGS.chamaacLightSpeedRadius)
    assert.equal(settings.chamaacLightSpeedCylinderLength, DEFAULT_CHIMER_SETTINGS.chamaacLightSpeedCylinderLength)
    assert.equal(settings.chamaacElectricMistColor, DEFAULT_CHIMER_SETTINGS.chamaacElectricMistColor)
    assert.equal(settings.chamaacElectricMistSpeed, DEFAULT_CHIMER_SETTINGS.chamaacElectricMistSpeed)
    assert.equal(settings.chamaacElectricMistControlVersion, DEFAULT_CHIMER_SETTINGS.chamaacElectricMistControlVersion)
    assert.equal(settings.chamaacElectricMistDetail, DEFAULT_CHIMER_SETTINGS.chamaacElectricMistDetail)
    assert.equal(settings.chamaacElectricMistDistortion, DEFAULT_CHIMER_SETTINGS.chamaacElectricMistDistortion)
    assert.equal(settings.chamaacElectricMistBrightness, DEFAULT_CHIMER_SETTINGS.chamaacElectricMistBrightness)
    assert.equal(settings.chamaacAstralFlowPaletteMode, DEFAULT_CHIMER_SETTINGS.chamaacAstralFlowPaletteMode)
    assert.equal(settings.chamaacAstralFlowPrimaryColor, DEFAULT_CHIMER_SETTINGS.chamaacAstralFlowPrimaryColor)
    assert.equal(settings.chamaacAstralFlowHarmony, DEFAULT_CHIMER_SETTINGS.chamaacAstralFlowHarmony)
    assert.equal(settings.chamaacAstralFlowColorOne, DEFAULT_CHIMER_SETTINGS.chamaacAstralFlowColorOne)
    assert.equal(settings.chamaacAstralFlowColorTwo, DEFAULT_CHIMER_SETTINGS.chamaacAstralFlowColorTwo)
    assert.equal(settings.chamaacAstralFlowColorThree, DEFAULT_CHIMER_SETTINGS.chamaacAstralFlowColorThree)
    assert.equal(settings.chamaacAstralFlowSpeed, DEFAULT_CHIMER_SETTINGS.chamaacAstralFlowSpeed)
    assert.equal(settings.chamaacAstralFlowFlowMin, DEFAULT_CHIMER_SETTINGS.chamaacAstralFlowFlowMin)
    assert.equal(settings.chamaacAstralFlowFlowMax, DEFAULT_CHIMER_SETTINGS.chamaacAstralFlowFlowMax)
    assert.equal(settings.chamaacDeepSpaceNebulaPaletteMode, DEFAULT_CHIMER_SETTINGS.chamaacDeepSpaceNebulaPaletteMode)
    assert.equal(settings.chamaacDeepSpaceNebulaPrimaryColor, DEFAULT_CHIMER_SETTINGS.chamaacDeepSpaceNebulaPrimaryColor)
    assert.equal(settings.chamaacDeepSpaceNebulaHarmony, DEFAULT_CHIMER_SETTINGS.chamaacDeepSpaceNebulaHarmony)
    assert.equal(settings.chamaacDeepSpaceNebulaColorOne, DEFAULT_CHIMER_SETTINGS.chamaacDeepSpaceNebulaColorOne)
    assert.equal(settings.chamaacDeepSpaceNebulaColorTwo, DEFAULT_CHIMER_SETTINGS.chamaacDeepSpaceNebulaColorTwo)
    assert.equal(settings.chamaacDeepSpaceNebulaColorThree, DEFAULT_CHIMER_SETTINGS.chamaacDeepSpaceNebulaColorThree)
    assert.equal(settings.chamaacDeepSpaceNebulaSpeed, DEFAULT_CHIMER_SETTINGS.chamaacDeepSpaceNebulaSpeed)
    assert.equal(settings.chamaacGridBloomColor, DEFAULT_CHIMER_SETTINGS.chamaacGridBloomColor)
    assert.equal(settings.chamaacGridBloomSpeed, DEFAULT_CHIMER_SETTINGS.chamaacGridBloomSpeed)
    assert.equal(settings.chamaacGridBloomGridScale, DEFAULT_CHIMER_SETTINGS.chamaacGridBloomGridScale)
    assert.equal(settings.chamaacGridBloomRotationSpeed, DEFAULT_CHIMER_SETTINGS.chamaacGridBloomRotationSpeed)
    assert.equal(settings.chamaacGridBloomFadeFalloff, DEFAULT_CHIMER_SETTINGS.chamaacGridBloomFadeFalloff)
    assert.equal(settings.chamaacGridBloomDistortionAmount, DEFAULT_CHIMER_SETTINGS.chamaacGridBloomDistortionAmount)
    assert.equal(settings.chamaacGridBloomFlowSpeedX, DEFAULT_CHIMER_SETTINGS.chamaacGridBloomFlowSpeedX)
    assert.equal(settings.chamaacGridBloomFlowSpeedY, DEFAULT_CHIMER_SETTINGS.chamaacGridBloomFlowSpeedY)
    assert.equal(settings.chamaacLiquidChromePaletteMode, DEFAULT_CHIMER_SETTINGS.chamaacLiquidChromePaletteMode)
    assert.equal(settings.chamaacLiquidChromePrimaryColor, DEFAULT_CHIMER_SETTINGS.chamaacLiquidChromePrimaryColor)
    assert.equal(settings.chamaacLiquidChromeHarmony, DEFAULT_CHIMER_SETTINGS.chamaacLiquidChromeHarmony)
    assert.equal(settings.chamaacLiquidChromeColorOne, DEFAULT_CHIMER_SETTINGS.chamaacLiquidChromeColorOne)
    assert.equal(settings.chamaacLiquidChromeColorTwo, DEFAULT_CHIMER_SETTINGS.chamaacLiquidChromeColorTwo)
    assert.equal(settings.chamaacLiquidChromeFlowSpeed, DEFAULT_CHIMER_SETTINGS.chamaacLiquidChromeFlowSpeed)
    assert.equal(settings.chamaacLiquidChromeTimeScale, DEFAULT_CHIMER_SETTINGS.chamaacLiquidChromeTimeScale)
    assert.equal(settings.chamaacWavesPaletteMode, DEFAULT_CHIMER_SETTINGS.chamaacWavesPaletteMode)
    assert.equal(settings.chamaacWavesPrimaryColor, DEFAULT_CHIMER_SETTINGS.chamaacWavesPrimaryColor)
    assert.equal(settings.chamaacWavesHarmony, DEFAULT_CHIMER_SETTINGS.chamaacWavesHarmony)
    assert.equal(settings.chamaacWavesBackgroundColor, DEFAULT_CHIMER_SETTINGS.chamaacWavesBackgroundColor)
    assert.equal(settings.chamaacWavesColorOne, DEFAULT_CHIMER_SETTINGS.chamaacWavesColorOne)
    assert.equal(settings.chamaacWavesColorTwo, DEFAULT_CHIMER_SETTINGS.chamaacWavesColorTwo)
    assert.equal(settings.chamaacWavesColorThree, DEFAULT_CHIMER_SETTINGS.chamaacWavesColorThree)
    assert.equal(settings.chamaacWavesSpeedX, DEFAULT_CHIMER_SETTINGS.chamaacWavesSpeedX)
    assert.equal(settings.chamaacWavesSpeedY, DEFAULT_CHIMER_SETTINGS.chamaacWavesSpeedY)
    assert.equal(settings.chamaacWavesAmplitude, DEFAULT_CHIMER_SETTINGS.chamaacWavesAmplitude)
    assert.equal(settings.chamaacSynthesisPaletteMode, DEFAULT_CHIMER_SETTINGS.chamaacSynthesisPaletteMode)
    assert.equal(settings.chamaacSynthesisPrimaryColor, DEFAULT_CHIMER_SETTINGS.chamaacSynthesisPrimaryColor)
    assert.equal(settings.chamaacSynthesisHarmony, DEFAULT_CHIMER_SETTINGS.chamaacSynthesisHarmony)
    assert.equal(settings.chamaacSynthesisColorOne, DEFAULT_CHIMER_SETTINGS.chamaacSynthesisColorOne)
    assert.equal(settings.chamaacSynthesisColorTwo, DEFAULT_CHIMER_SETTINGS.chamaacSynthesisColorTwo)
    assert.equal(settings.chamaacSynthesisColorThree, DEFAULT_CHIMER_SETTINGS.chamaacSynthesisColorThree)
    assert.equal(settings.chamaacSynthesisSpeed, DEFAULT_CHIMER_SETTINGS.chamaacSynthesisSpeed)
    assert.equal(settings.chamaacSynthesisComplexity, DEFAULT_CHIMER_SETTINGS.chamaacSynthesisComplexity)
    assert.equal(settings.chamaacSynthesisScale, DEFAULT_CHIMER_SETTINGS.chamaacSynthesisScale)
    assert.equal(settings.chamaacSynthesisDistortion, DEFAULT_CHIMER_SETTINGS.chamaacSynthesisDistortion)
    assert.equal(settings.chamaacSynthesisGlowIntensity, DEFAULT_CHIMER_SETTINGS.chamaacSynthesisGlowIntensity)
    assert.equal(settings.chamaacSynthesisFlowFrequency, DEFAULT_CHIMER_SETTINGS.chamaacSynthesisFlowFrequency)
    assert.equal(settings.backgroundLinesDuration, DEFAULT_CHIMER_SETTINGS.backgroundLinesDuration)
    assert.equal(settings.wavyBackgroundFill, DEFAULT_CHIMER_SETTINGS.wavyBackgroundFill)
    assert.equal(settings.wavyColorOne, DEFAULT_CHIMER_SETTINGS.wavyColorOne)
    assert.equal(settings.wavyWaveWidth, DEFAULT_CHIMER_SETTINGS.wavyWaveWidth)
    assert.equal(settings.wavySpeed, DEFAULT_CHIMER_SETTINGS.wavySpeed)
    assert.equal(settings.wavyWaveOpacity, DEFAULT_CHIMER_SETTINGS.wavyWaveOpacity)
    assert.equal(settings.shootingStarsStarColor, DEFAULT_CHIMER_SETTINGS.shootingStarsStarColor)
    assert.equal(settings.shootingStarsTrailColor, DEFAULT_CHIMER_SETTINGS.shootingStarsTrailColor)
    assert.equal(settings.shootingStarsShootingStarColor, DEFAULT_CHIMER_SETTINGS.shootingStarsShootingStarColor)
    assert.equal(settings.shootingStarsDensity, DEFAULT_CHIMER_SETTINGS.shootingStarsDensity)
    assert.equal(settings.shootingStarsTwinkle, DEFAULT_CHIMER_SETTINGS.shootingStarsTwinkle)
    assert.equal(settings.shootingStarsTwinkleSpeed, DEFAULT_CHIMER_SETTINGS.shootingStarsTwinkleSpeed)
    assert.equal(settings.shootingStarsShootingSpeed, DEFAULT_CHIMER_SETTINGS.shootingStarsShootingSpeed)
    assert.equal(settings.shootingStarsFrequency, DEFAULT_CHIMER_SETTINGS.shootingStarsFrequency)
    assert.equal(settings.canvasRevealDotsBackgroundColor, DEFAULT_CHIMER_SETTINGS.canvasRevealDotsBackgroundColor)
    assert.equal(settings.canvasRevealDotsDotColor, DEFAULT_CHIMER_SETTINGS.canvasRevealDotsDotColor)
    assert.equal(settings.canvasRevealDotsAccentColor, DEFAULT_CHIMER_SETTINGS.canvasRevealDotsAccentColor)
    assert.equal(settings.canvasRevealDotsDotSize, DEFAULT_CHIMER_SETTINGS.canvasRevealDotsDotSize)
    assert.equal(settings.canvasRevealDotsDotSpacing, DEFAULT_CHIMER_SETTINGS.canvasRevealDotsDotSpacing)
    assert.equal(settings.canvasRevealDotsOpacity, DEFAULT_CHIMER_SETTINGS.canvasRevealDotsOpacity)
    assert.equal(settings.canvasRevealDotsAnimationSpeed, DEFAULT_CHIMER_SETTINGS.canvasRevealDotsAnimationSpeed)
    assert.equal(settings.canvasRevealDotsShowGradient, DEFAULT_CHIMER_SETTINGS.canvasRevealDotsShowGradient)
    assert.equal(settings.spotlightColor, DEFAULT_CHIMER_SETTINGS.spotlightColor)
    assert.equal(settings.spotlightOpacity, DEFAULT_CHIMER_SETTINGS.spotlightOpacity)
    assert.equal(settings.spotlightWidth, DEFAULT_CHIMER_SETTINGS.spotlightWidth)
    assert.equal(settings.spotlightHeight, DEFAULT_CHIMER_SETTINGS.spotlightHeight)
    assert.equal(settings.spotlightSmallWidth, DEFAULT_CHIMER_SETTINGS.spotlightSmallWidth)
    assert.equal(settings.spotlightTranslateY, DEFAULT_CHIMER_SETTINGS.spotlightTranslateY)
    assert.equal(settings.spotlightDuration, DEFAULT_CHIMER_SETTINGS.spotlightDuration)
    assert.equal(settings.spotlightXOffset, DEFAULT_CHIMER_SETTINGS.spotlightXOffset)
    assert.equal(settings.lampBackgroundColor, DEFAULT_CHIMER_SETTINGS.lampBackgroundColor)
    assert.equal(settings.lampColor, DEFAULT_CHIMER_SETTINGS.lampColor)
    assert.equal(settings.lampGlowOpacity, DEFAULT_CHIMER_SETTINGS.lampGlowOpacity)
    assert.equal(settings.lampBeamWidth, DEFAULT_CHIMER_SETTINGS.lampBeamWidth)
    assert.equal(settings.lampGlowWidth, DEFAULT_CHIMER_SETTINGS.lampGlowWidth)
    assert.equal(settings.lampVerticalOffset, DEFAULT_CHIMER_SETTINGS.lampVerticalOffset)
    assert.equal(settings.lampPulseSpeed, DEFAULT_CHIMER_SETTINGS.lampPulseSpeed)
    assert.equal(settings.vortexBackgroundColor, DEFAULT_CHIMER_SETTINGS.vortexBackgroundColor)
    assert.equal(settings.vortexBaseHue, DEFAULT_CHIMER_SETTINGS.vortexBaseHue)
    assert.equal(settings.vortexParticleCount, DEFAULT_CHIMER_SETTINGS.vortexParticleCount)
    assert.equal(settings.vortexRangeY, DEFAULT_CHIMER_SETTINGS.vortexRangeY)
    assert.equal(settings.vortexBaseSpeed, DEFAULT_CHIMER_SETTINGS.vortexBaseSpeed)
    assert.equal(settings.vortexRangeSpeed, DEFAULT_CHIMER_SETTINGS.vortexRangeSpeed)
    assert.equal(settings.vortexBaseRadius, DEFAULT_CHIMER_SETTINGS.vortexBaseRadius)
    assert.equal(settings.vortexRangeRadius, DEFAULT_CHIMER_SETTINGS.vortexRangeRadius)
    assert.equal(settings.auroraBarsBackgroundColor, DEFAULT_CHIMER_SETTINGS.auroraBarsBackgroundColor)
    assert.equal(settings.auroraBarsPaletteMode, DEFAULT_CHIMER_SETTINGS.auroraBarsPaletteMode)
    assert.equal(settings.auroraBarsPrimaryColor, DEFAULT_CHIMER_SETTINGS.auroraBarsPrimaryColor)
    assert.equal(settings.auroraBarsColorOne, DEFAULT_CHIMER_SETTINGS.auroraBarsColorOne)
    assert.equal(settings.auroraBarsColorTwo, DEFAULT_CHIMER_SETTINGS.auroraBarsColorTwo)
    assert.equal(settings.auroraBarsColorThree, DEFAULT_CHIMER_SETTINGS.auroraBarsColorThree)
    assert.equal(settings.auroraBarsColorFour, DEFAULT_CHIMER_SETTINGS.auroraBarsColorFour)
    assert.equal(settings.auroraBarsColorFive, DEFAULT_CHIMER_SETTINGS.auroraBarsColorFive)
    assert.equal(settings.auroraBarsBarCount, DEFAULT_CHIMER_SETTINGS.auroraBarsBarCount)
    assert.equal(settings.auroraBarsSpeed, DEFAULT_CHIMER_SETTINGS.auroraBarsSpeed)
    assert.equal(settings.auroraBarsBlur, DEFAULT_CHIMER_SETTINGS.auroraBarsBlur)
    assert.equal(settings.auroraBarsGap, DEFAULT_CHIMER_SETTINGS.auroraBarsGap)
    assert.equal(settings.auroraBarsMaxHeightRatio, DEFAULT_CHIMER_SETTINGS.auroraBarsMaxHeightRatio)
    assert.equal(settings.auroraBarsMinHeightRatio, DEFAULT_CHIMER_SETTINGS.auroraBarsMinHeightRatio)
    assert.equal(settings.pixelLiquidBackgroundColor, DEFAULT_CHIMER_SETTINGS.pixelLiquidBackgroundColor)
    assert.equal(settings.pixelLiquidBaseColor, DEFAULT_CHIMER_SETTINGS.pixelLiquidBaseColor)
    assert.equal(settings.pixelLiquidAccentColor, DEFAULT_CHIMER_SETTINGS.pixelLiquidAccentColor)
    assert.equal(settings.pixelLiquidHighlightColor, DEFAULT_CHIMER_SETTINGS.pixelLiquidHighlightColor)
    assert.equal(settings.pixelLiquidPixelSize, DEFAULT_CHIMER_SETTINGS.pixelLiquidPixelSize)
    assert.equal(settings.pixelLiquidDetail, DEFAULT_CHIMER_SETTINGS.pixelLiquidDetail)
    assert.equal(settings.pixelLiquidMotionSpeed, DEFAULT_CHIMER_SETTINGS.pixelLiquidMotionSpeed)
    assert.equal(settings.tileGridPaletteMode, DEFAULT_CHIMER_SETTINGS.tileGridPaletteMode)
    assert.equal(settings.tileGridPrimaryColor, DEFAULT_CHIMER_SETTINGS.tileGridPrimaryColor)
    assert.equal(settings.tileGridColorOne, DEFAULT_CHIMER_SETTINGS.tileGridColorOne)
    assert.equal(settings.tileGridColorTwo, DEFAULT_CHIMER_SETTINGS.tileGridColorTwo)
    assert.equal(settings.tileGridColorThree, DEFAULT_CHIMER_SETTINGS.tileGridColorThree)
    assert.equal(settings.tileGridColorFour, DEFAULT_CHIMER_SETTINGS.tileGridColorFour)
    assert.equal(settings.tileGridColorFive, DEFAULT_CHIMER_SETTINGS.tileGridColorFive)
    assert.equal(settings.tileGridTileSize, DEFAULT_CHIMER_SETTINGS.tileGridTileSize)
    assert.equal(settings.tileGridJointSize, DEFAULT_CHIMER_SETTINGS.tileGridJointSize)
    assert.equal(settings.tileGridChangeFrequency, DEFAULT_CHIMER_SETTINGS.tileGridChangeFrequency)
    assert.equal(settings.tileGridActivePercent, DEFAULT_CHIMER_SETTINGS.tileGridActivePercent)
    assert.equal(settings.tileGridOpacity, DEFAULT_CHIMER_SETTINGS.tileGridOpacity)
    assert.equal(settings.hexGridPrimaryColor, DEFAULT_CHIMER_SETTINGS.hexGridPrimaryColor)
    assert.equal(settings.hexGridHarmony, DEFAULT_CHIMER_SETTINGS.hexGridHarmony)
    assert.equal(settings.hexGridHexSize, DEFAULT_CHIMER_SETTINGS.hexGridHexSize)
    assert.equal(settings.hexGridJointSize, DEFAULT_CHIMER_SETTINGS.hexGridJointSize)
    assert.equal(settings.hexGridChangeFrequency, DEFAULT_CHIMER_SETTINGS.hexGridChangeFrequency)
    assert.equal(settings.hexGridActivePercent, DEFAULT_CHIMER_SETTINGS.hexGridActivePercent)
    assert.equal(settings.hexGridOpacity, DEFAULT_CHIMER_SETTINGS.hexGridOpacity)
  })

  it("preserves premium backgrounds and custom colors for users with both features", () => {
    const settings = sanitizeChimerSettingsForEntitlements({
      primaryFontColor: "#000000",
      secondaryFontColor: "#123456",
      clockModeFontColor: "#654321",
      movingBackgroundMainColor: "#ABCDEF",
      movingBackgroundOrbColor: "#FEDCBA",
      backgroundId: "aceternity-sparkles",
      sparklesParticleColor: "#ABC123",
      sparklesParticleDensity: 180,
      sparklesSpeed: 6,
      gradientAnimationFirstColor: "#112233",
      gradientAnimationSpeed: 2,
      animateUiGradientPrimaryColor: "#102030",
      animateUiGradientHarmony: "split-complementary",
      animateUiGradientOpacity: 0.42,
      animateUiStarsColor: "#EAF6FF",
      animateUiStarsSpeed: 72,
      animateUiStarsDensity: 1.2,
      animateUiStarsParallax: 0.08,
      animateUiHoleStrokeColor: "#112233",
      animateUiHoleParticleColor: "#EAF6FF",
      animateUiHoleLineCount: 72,
      animateUiHoleDiscCount: 64,
      chamaacLightSpeedWarpSpeed: 3.5,
      chamaacLightSpeedWarpSpeedVersion: 2,
      chamaacLightSpeedParticleCount: 180,
      chamaacLightSpeedLightColor: "#33B2FF",
      chamaacLightSpeedIntensity: 4.5,
      chamaacLightSpeedRadius: 42,
      chamaacLightSpeedCylinderLength: 220,
      chamaacElectricMistColor: "#33B2FF",
      chamaacElectricMistSpeed: 250,
      chamaacElectricMistControlVersion: 2,
      chamaacElectricMistDetail: 2.4,
      chamaacElectricMistDistortion: 5.5,
      chamaacElectricMistBrightness: 80,
      chamaacAstralFlowPaletteMode: "harmony",
      chamaacAstralFlowPrimaryColor: "#33B2FF",
      chamaacAstralFlowHarmony: "split-complementary",
      chamaacAstralFlowColorOne: "#112233",
      chamaacAstralFlowColorTwo: "#445566",
      chamaacAstralFlowColorThree: "#778899",
      chamaacAstralFlowSpeed: 2.1,
      chamaacAstralFlowFlowMin: 4.2,
      chamaacAstralFlowFlowMax: 8.4,
      chamaacDeepSpaceNebulaPaletteMode: "harmony",
      chamaacDeepSpaceNebulaPrimaryColor: "#763B65",
      chamaacDeepSpaceNebulaHarmony: "complementary",
      chamaacDeepSpaceNebulaColorOne: "#5EFFF4",
      chamaacDeepSpaceNebulaColorTwo: "#763B65",
      chamaacDeepSpaceNebulaColorThree: "#1A0B2E",
      chamaacDeepSpaceNebulaSpeed: 3.6,
      chamaacGridBloomColor: "#E040FB",
      chamaacGridBloomSpeed: 2.4,
      chamaacGridBloomGridScale: 18,
      chamaacGridBloomRotationSpeed: 0.8,
      chamaacGridBloomFadeFalloff: 14,
      chamaacGridBloomDistortionAmount: 0.18,
      chamaacGridBloomFlowSpeedX: -0.6,
      chamaacGridBloomFlowSpeedY: 0.5,
      chamaacLiquidChromePaletteMode: "harmony",
      chamaacLiquidChromePrimaryColor: "#C0C0C0",
      chamaacLiquidChromeHarmony: "monochromatic",
      chamaacLiquidChromeColorOne: "#C0C0C0",
      chamaacLiquidChromeColorTwo: "#4A4A4A",
      chamaacLiquidChromeFlowSpeed: 1.4,
      chamaacLiquidChromeTimeScale: 0.4,
      chamaacWavesPaletteMode: "harmony",
      chamaacWavesPrimaryColor: "#071697",
      chamaacWavesHarmony: "triad",
      chamaacWavesBackgroundColor: "#000000",
      chamaacWavesColorOne: "#071697",
      chamaacWavesColorTwo: "#00D4FF",
      chamaacWavesColorThree: "#000000",
      chamaacWavesSpeedX: 0.08,
      chamaacWavesSpeedY: 0.04,
      chamaacWavesAmplitude: 48,
      chamaacSynthesisPaletteMode: "harmony",
      chamaacSynthesisPrimaryColor: "#33B2FF",
      chamaacSynthesisHarmony: "split-complementary",
      chamaacSynthesisColorOne: "#112233",
      chamaacSynthesisColorTwo: "#445566",
      chamaacSynthesisColorThree: "#778899",
      chamaacSynthesisSpeed: 1.8,
      chamaacSynthesisComplexity: 16,
      chamaacSynthesisScale: 2.4,
      chamaacSynthesisDistortion: 1.4,
      chamaacSynthesisGlowIntensity: 1.6,
      chamaacSynthesisFlowFrequency: 7.5,
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
    }, [FEATURE_KEYS.chimerCustomColors, FEATURE_KEYS.premiumBackgrounds])

    assert.equal(settings.primaryFontColor, "#000000")
    assert.equal(settings.secondaryFontColor, "#123456")
    assert.equal(settings.clockModeFontColor, "#654321")
    assert.equal(settings.movingBackgroundMainColor, "#ABCDEF")
    assert.equal(settings.movingBackgroundOrbColor, "#FEDCBA")
    assert.equal(settings.backgroundId, "aceternity-sparkles")
    assert.equal(settings.sparklesParticleColor, "#ABC123")
    assert.equal(settings.sparklesParticleDensity, 180)
    assert.equal(settings.sparklesSpeed, 6)
    assert.equal(settings.gradientAnimationFirstColor, "#112233")
    assert.equal(settings.gradientAnimationSpeed, 2)
    assert.equal(settings.animateUiGradientPrimaryColor, "#102030")
    assert.equal(settings.animateUiGradientHarmony, "split-complementary")
    assert.equal(settings.animateUiGradientOpacity, 0.42)
    assert.equal(settings.animateUiStarsColor, "#EAF6FF")
    assert.equal(settings.animateUiStarsSpeed, 72)
    assert.equal(settings.animateUiStarsDensity, 1.2)
    assert.equal(settings.animateUiStarsParallax, 0.08)
    assert.equal(settings.animateUiHoleStrokeColor, "#112233")
    assert.equal(settings.animateUiHoleParticleColor, "#EAF6FF")
    assert.equal(settings.animateUiHoleLineCount, 72)
    assert.equal(settings.animateUiHoleDiscCount, 64)
    assert.equal(settings.chamaacLightSpeedWarpSpeed, 3.5)
    assert.equal(settings.chamaacLightSpeedParticleCount, 180)
    assert.equal(settings.chamaacLightSpeedLightColor, "#33B2FF")
    assert.equal(settings.chamaacLightSpeedIntensity, 4.5)
    assert.equal(settings.chamaacLightSpeedRadius, 42)
    assert.equal(settings.chamaacLightSpeedCylinderLength, 220)
    assert.equal(settings.chamaacElectricMistColor, "#33B2FF")
    assert.equal(settings.chamaacElectricMistSpeed, 250)
    assert.equal(settings.chamaacElectricMistControlVersion, 2)
    assert.equal(settings.chamaacElectricMistDetail, 2.4)
    assert.equal(settings.chamaacElectricMistDistortion, 5.5)
    assert.equal(settings.chamaacElectricMistBrightness, 80)
    assert.equal(settings.chamaacAstralFlowPaletteMode, "harmony")
    assert.equal(settings.chamaacAstralFlowPrimaryColor, "#33B2FF")
    assert.equal(settings.chamaacAstralFlowHarmony, "split-complementary")
    assert.equal(settings.chamaacAstralFlowColorOne, "#112233")
    assert.equal(settings.chamaacAstralFlowColorTwo, "#445566")
    assert.equal(settings.chamaacAstralFlowColorThree, "#778899")
    assert.equal(settings.chamaacAstralFlowSpeed, 2.1)
    assert.equal(settings.chamaacAstralFlowFlowMin, 4.2)
    assert.equal(settings.chamaacAstralFlowFlowMax, 8.4)
    assert.equal(settings.chamaacDeepSpaceNebulaPaletteMode, "harmony")
    assert.equal(settings.chamaacDeepSpaceNebulaPrimaryColor, "#763B65")
    assert.equal(settings.chamaacDeepSpaceNebulaHarmony, "complementary")
    assert.equal(settings.chamaacDeepSpaceNebulaColorOne, "#5EFFF4")
    assert.equal(settings.chamaacDeepSpaceNebulaColorTwo, "#763B65")
    assert.equal(settings.chamaacDeepSpaceNebulaColorThree, "#1A0B2E")
    assert.equal(settings.chamaacDeepSpaceNebulaSpeed, 3.6)
    assert.equal(settings.chamaacGridBloomColor, "#E040FB")
    assert.equal(settings.chamaacGridBloomSpeed, 2.4)
    assert.equal(settings.chamaacGridBloomGridScale, 18)
    assert.equal(settings.chamaacGridBloomRotationSpeed, 0.8)
    assert.equal(settings.chamaacGridBloomFadeFalloff, 14)
    assert.equal(settings.chamaacGridBloomDistortionAmount, 0.18)
    assert.equal(settings.chamaacGridBloomFlowSpeedX, -0.6)
    assert.equal(settings.chamaacGridBloomFlowSpeedY, 0.5)
    assert.equal(settings.chamaacLiquidChromePaletteMode, "harmony")
    assert.equal(settings.chamaacLiquidChromePrimaryColor, "#C0C0C0")
    assert.equal(settings.chamaacLiquidChromeHarmony, "monochromatic")
    assert.equal(settings.chamaacLiquidChromeColorOne, "#C0C0C0")
    assert.equal(settings.chamaacLiquidChromeColorTwo, "#4A4A4A")
    assert.equal(settings.chamaacLiquidChromeFlowSpeed, 1.4)
    assert.equal(settings.chamaacLiquidChromeTimeScale, 0.4)
    assert.equal(settings.chamaacWavesPaletteMode, "harmony")
    assert.equal(settings.chamaacWavesPrimaryColor, "#071697")
    assert.equal(settings.chamaacWavesHarmony, "triad")
    assert.equal(settings.chamaacWavesBackgroundColor, "#000000")
    assert.equal(settings.chamaacWavesColorOne, "#071697")
    assert.equal(settings.chamaacWavesColorTwo, "#00D4FF")
    assert.equal(settings.chamaacWavesColorThree, "#000000")
    assert.equal(settings.chamaacWavesSpeedX, 0.08)
    assert.equal(settings.chamaacWavesSpeedY, 0.04)
    assert.equal(settings.chamaacWavesAmplitude, 48)
    assert.equal(settings.chamaacSynthesisPaletteMode, "harmony")
    assert.equal(settings.chamaacSynthesisPrimaryColor, "#33B2FF")
    assert.equal(settings.chamaacSynthesisHarmony, "split-complementary")
    assert.equal(settings.chamaacSynthesisColorOne, "#112233")
    assert.equal(settings.chamaacSynthesisColorTwo, "#445566")
    assert.equal(settings.chamaacSynthesisColorThree, "#778899")
    assert.equal(settings.chamaacSynthesisSpeed, 1.8)
    assert.equal(settings.chamaacSynthesisComplexity, 16)
    assert.equal(settings.chamaacSynthesisScale, 2.4)
    assert.equal(settings.chamaacSynthesisDistortion, 1.4)
    assert.equal(settings.chamaacSynthesisGlowIntensity, 1.6)
    assert.equal(settings.chamaacSynthesisFlowFrequency, 7.5)
    assert.equal(settings.backgroundLinesDuration, 16)
    assert.equal(settings.wavyBackgroundFill, "#111111")
    assert.equal(settings.wavyColorOne, "#ABC123")
    assert.equal(settings.wavyWaveWidth, 80)
    assert.equal(settings.wavySpeed, "slow")
    assert.equal(settings.wavyWaveOpacity, 0.8)
    assert.equal(settings.shootingStarsStarColor, "#101010")
    assert.equal(settings.shootingStarsTrailColor, "#202020")
    assert.equal(settings.shootingStarsShootingStarColor, "#303030")
    assert.equal(settings.shootingStarsDensity, 0.00028)
    assert.equal(settings.shootingStarsTwinkle, false)
    assert.equal(settings.shootingStarsTwinkleSpeed, 2)
    assert.equal(settings.shootingStarsShootingSpeed, 1.8)
    assert.equal(settings.shootingStarsFrequency, 1.6)
    assert.equal(settings.canvasRevealDotsBackgroundColor, "#040404")
    assert.equal(settings.canvasRevealDotsDotColor, "#00FFCC")
    assert.equal(settings.canvasRevealDotsAccentColor, "#CC7722")
    assert.equal(settings.canvasRevealDotsDotSize, 3.2)
    assert.equal(settings.canvasRevealDotsDotSpacing, 14)
    assert.equal(settings.canvasRevealDotsOpacity, 0.6)
    assert.equal(settings.canvasRevealDotsAnimationSpeed, 0.8)
    assert.equal(settings.canvasRevealDotsShowGradient, false)
    assert.equal(settings.spotlightColor, "#AABBCC")
    assert.equal(settings.spotlightOpacity, 1.4)
    assert.equal(settings.spotlightWidth, 820)
    assert.equal(settings.spotlightHeight, 1700)
    assert.equal(settings.spotlightSmallWidth, 360)
    assert.equal(settings.spotlightTranslateY, -520)
    assert.equal(settings.spotlightDuration, 12)
    assert.equal(settings.spotlightXOffset, 180)
    assert.equal(settings.lampBackgroundColor, "#050505")
    assert.equal(settings.lampColor, "#22D3EE")
    assert.equal(settings.lampGlowOpacity, 0.9)
    assert.equal(settings.lampBeamWidth, 780)
    assert.equal(settings.lampGlowWidth, 720)
    assert.equal(settings.lampVerticalOffset, -200)
    assert.equal(settings.lampPulseSpeed, 14)
    assert.equal(settings.vortexBackgroundColor, "#040404")
    assert.equal(settings.vortexBaseHue, 280)
    assert.equal(settings.vortexParticleCount, 620)
    assert.equal(settings.vortexRangeY, 200)
    assert.equal(settings.vortexBaseSpeed, 0.5)
    assert.equal(settings.vortexRangeSpeed, 1.8)
    assert.equal(settings.vortexBaseRadius, 1.7)
    assert.equal(settings.vortexRangeRadius, 3.2)
    assert.equal(settings.auroraBarsBackgroundColor, "#010203")
    assert.equal(settings.auroraBarsPaletteMode, "custom")
    assert.equal(settings.auroraBarsPrimaryColor, "#334455")
    assert.equal(settings.auroraBarsColorOne, "#AABBCC")
    assert.equal(settings.auroraBarsColorTwo, "#223344")
    assert.equal(settings.auroraBarsColorThree, "#445566")
    assert.equal(settings.auroraBarsColorFour, "#667788")
    assert.equal(settings.auroraBarsColorFive, "#8899AA")
    assert.equal(settings.auroraBarsBarCount, 64)
    assert.equal(settings.auroraBarsSpeed, 1.5)
    assert.equal(settings.auroraBarsBlur, 9)
    assert.equal(settings.auroraBarsGap, 7)
    assert.equal(settings.auroraBarsMaxHeightRatio, 0.84)
    assert.equal(settings.auroraBarsMinHeightRatio, 0.2)
    assert.equal(settings.pixelLiquidBackgroundColor, "#080512")
    assert.equal(settings.pixelLiquidBaseColor, "#5C2CA2")
    assert.equal(settings.pixelLiquidAccentColor, "#C562FF")
    assert.equal(settings.pixelLiquidHighlightColor, "#F2D6FF")
    assert.equal(settings.pixelLiquidPixelSize, 14)
    assert.equal(settings.pixelLiquidDetail, "high")
    assert.equal(settings.pixelLiquidMotionSpeed, 1.2)
    assert.equal(settings.tileGridPaletteMode, "custom")
    assert.equal(settings.tileGridPrimaryColor, "#112233")
    assert.equal(settings.tileGridColorOne, "#AABBCC")
    assert.equal(settings.tileGridColorTwo, "#223344")
    assert.equal(settings.tileGridColorThree, "#445566")
    assert.equal(settings.tileGridColorFour, "#667788")
    assert.equal(settings.tileGridColorFive, "#8899AA")
    assert.equal(settings.tileGridTileSize, 64)
    assert.equal(settings.tileGridJointSize, 6)
    assert.equal(settings.tileGridChangeFrequency, 2.5)
    assert.equal(settings.tileGridActivePercent, 32)
    assert.equal(settings.tileGridOpacity, 0.93)
    assert.equal(settings.hexGridPrimaryColor, "#223344")
    assert.equal(settings.hexGridHarmony, "triad")
    assert.equal(settings.hexGridHexSize, 72)
    assert.equal(settings.hexGridJointSize, 5)
    assert.equal(settings.hexGridChangeFrequency, 3.5)
    assert.equal(settings.hexGridActivePercent, 28)
    assert.equal(settings.hexGridOpacity, 0.82)
  })

  it("allows premium background controls without unlocking custom Chimer display colors", () => {
    const settings = sanitizeChimerSettingsForEntitlements({
      primaryFontColor: "#000000",
      backgroundId: "aceternity-gradient-animation",
      sparklesParticleColor: "#ABC123",
      sparklesParticleDensity: 180,
      gradientAnimationSecondColor: "#224466",
      gradientAnimationSize: 100,
      animateUiGradientPrimaryColor: "#102030",
      animateUiGradientHarmony: "split-complementary",
      animateUiGradientOpacity: 0.42,
      animateUiStarsColor: "#EAF6FF",
      animateUiStarsSpeed: 72,
      animateUiStarsDensity: 1.2,
      animateUiStarsParallax: 0.08,
      animateUiHoleStrokeColor: "#112233",
      animateUiHoleParticleColor: "#EAF6FF",
      animateUiHoleLineCount: 72,
      animateUiHoleDiscCount: 64,
      chamaacLightSpeedWarpSpeed: 3.5,
      chamaacLightSpeedWarpSpeedVersion: 2,
      chamaacLightSpeedParticleCount: 180,
      chamaacLightSpeedLightColor: "#33B2FF",
      chamaacLightSpeedIntensity: 4.5,
      chamaacLightSpeedRadius: 42,
      chamaacLightSpeedCylinderLength: 220,
      chamaacElectricMistColor: "#33B2FF",
      chamaacElectricMistSpeed: 250,
      chamaacElectricMistControlVersion: 2,
      chamaacElectricMistDetail: 2.4,
      chamaacElectricMistDistortion: 5.5,
      chamaacElectricMistBrightness: 80,
      chamaacAstralFlowPaletteMode: "harmony",
      chamaacAstralFlowPrimaryColor: "#33B2FF",
      chamaacAstralFlowHarmony: "split-complementary",
      chamaacAstralFlowColorOne: "#112233",
      chamaacAstralFlowColorTwo: "#445566",
      chamaacAstralFlowColorThree: "#778899",
      chamaacAstralFlowSpeed: 2.1,
      chamaacAstralFlowFlowMin: 4.2,
      chamaacAstralFlowFlowMax: 8.4,
      chamaacDeepSpaceNebulaPaletteMode: "harmony",
      chamaacDeepSpaceNebulaPrimaryColor: "#763B65",
      chamaacDeepSpaceNebulaHarmony: "complementary",
      chamaacDeepSpaceNebulaColorOne: "#5EFFF4",
      chamaacDeepSpaceNebulaColorTwo: "#763B65",
      chamaacDeepSpaceNebulaColorThree: "#1A0B2E",
      chamaacDeepSpaceNebulaSpeed: 3.6,
      chamaacGridBloomColor: "#E040FB",
      chamaacGridBloomSpeed: 2.4,
      chamaacGridBloomGridScale: 18,
      chamaacGridBloomRotationSpeed: 0.8,
      chamaacGridBloomFadeFalloff: 14,
      chamaacGridBloomDistortionAmount: 0.18,
      chamaacGridBloomFlowSpeedX: -0.6,
      chamaacGridBloomFlowSpeedY: 0.5,
      chamaacLiquidChromePaletteMode: "harmony",
      chamaacLiquidChromePrimaryColor: "#C0C0C0",
      chamaacLiquidChromeHarmony: "monochromatic",
      chamaacLiquidChromeColorOne: "#C0C0C0",
      chamaacLiquidChromeColorTwo: "#4A4A4A",
      chamaacLiquidChromeFlowSpeed: 1.4,
      chamaacLiquidChromeTimeScale: 0.4,
      chamaacWavesPaletteMode: "harmony",
      chamaacWavesPrimaryColor: "#071697",
      chamaacWavesHarmony: "triad",
      chamaacWavesBackgroundColor: "#000000",
      chamaacWavesColorOne: "#071697",
      chamaacWavesColorTwo: "#00D4FF",
      chamaacWavesColorThree: "#000000",
      chamaacWavesSpeedX: 0.08,
      chamaacWavesSpeedY: 0.04,
      chamaacWavesAmplitude: 48,
      chamaacSynthesisPaletteMode: "harmony",
      chamaacSynthesisPrimaryColor: "#33B2FF",
      chamaacSynthesisHarmony: "split-complementary",
      chamaacSynthesisColorOne: "#112233",
      chamaacSynthesisColorTwo: "#445566",
      chamaacSynthesisColorThree: "#778899",
      chamaacSynthesisSpeed: 1.8,
      chamaacSynthesisComplexity: 16,
      chamaacSynthesisScale: 2.4,
      chamaacSynthesisDistortion: 1.4,
      chamaacSynthesisGlowIntensity: 1.6,
      chamaacSynthesisFlowFrequency: 7.5,
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

    assert.equal(settings.primaryFontColor, DEFAULT_CHIMER_SETTINGS.primaryFontColor)
    assert.equal(settings.backgroundId, "aceternity-gradient-animation")
    assert.equal(settings.sparklesParticleColor, "#ABC123")
    assert.equal(settings.sparklesParticleDensity, 180)
    assert.equal(settings.gradientAnimationSecondColor, "#224466")
    assert.equal(settings.gradientAnimationSize, 100)
    assert.equal(settings.animateUiGradientPrimaryColor, "#102030")
    assert.equal(settings.animateUiGradientHarmony, "split-complementary")
    assert.equal(settings.animateUiGradientOpacity, 0.42)
    assert.equal(settings.animateUiStarsColor, "#EAF6FF")
    assert.equal(settings.animateUiStarsSpeed, 72)
    assert.equal(settings.animateUiStarsDensity, 1.2)
    assert.equal(settings.animateUiStarsParallax, 0.08)
    assert.equal(settings.animateUiHoleStrokeColor, "#112233")
    assert.equal(settings.animateUiHoleParticleColor, "#EAF6FF")
    assert.equal(settings.animateUiHoleLineCount, 72)
    assert.equal(settings.animateUiHoleDiscCount, 64)
    assert.equal(settings.chamaacLightSpeedWarpSpeed, 3.5)
    assert.equal(settings.chamaacLightSpeedParticleCount, 180)
    assert.equal(settings.chamaacLightSpeedLightColor, "#33B2FF")
    assert.equal(settings.chamaacLightSpeedIntensity, 4.5)
    assert.equal(settings.chamaacLightSpeedRadius, 42)
    assert.equal(settings.chamaacLightSpeedCylinderLength, 220)
    assert.equal(settings.chamaacElectricMistColor, "#33B2FF")
    assert.equal(settings.chamaacElectricMistSpeed, 250)
    assert.equal(settings.chamaacElectricMistControlVersion, 2)
    assert.equal(settings.chamaacElectricMistDetail, 2.4)
    assert.equal(settings.chamaacElectricMistDistortion, 5.5)
    assert.equal(settings.chamaacElectricMistBrightness, 80)
    assert.equal(settings.chamaacAstralFlowPaletteMode, "harmony")
    assert.equal(settings.chamaacAstralFlowPrimaryColor, "#33B2FF")
    assert.equal(settings.chamaacAstralFlowHarmony, "split-complementary")
    assert.equal(settings.chamaacAstralFlowColorOne, "#112233")
    assert.equal(settings.chamaacAstralFlowColorTwo, "#445566")
    assert.equal(settings.chamaacAstralFlowColorThree, "#778899")
    assert.equal(settings.chamaacAstralFlowSpeed, 2.1)
    assert.equal(settings.chamaacAstralFlowFlowMin, 4.2)
    assert.equal(settings.chamaacAstralFlowFlowMax, 8.4)
    assert.equal(settings.chamaacDeepSpaceNebulaPaletteMode, "harmony")
    assert.equal(settings.chamaacDeepSpaceNebulaPrimaryColor, "#763B65")
    assert.equal(settings.chamaacDeepSpaceNebulaHarmony, "complementary")
    assert.equal(settings.chamaacDeepSpaceNebulaColorOne, "#5EFFF4")
    assert.equal(settings.chamaacDeepSpaceNebulaColorTwo, "#763B65")
    assert.equal(settings.chamaacDeepSpaceNebulaColorThree, "#1A0B2E")
    assert.equal(settings.chamaacDeepSpaceNebulaSpeed, 3.6)
    assert.equal(settings.chamaacGridBloomColor, "#E040FB")
    assert.equal(settings.chamaacGridBloomSpeed, 2.4)
    assert.equal(settings.chamaacGridBloomGridScale, 18)
    assert.equal(settings.chamaacGridBloomRotationSpeed, 0.8)
    assert.equal(settings.chamaacGridBloomFadeFalloff, 14)
    assert.equal(settings.chamaacGridBloomDistortionAmount, 0.18)
    assert.equal(settings.chamaacGridBloomFlowSpeedX, -0.6)
    assert.equal(settings.chamaacGridBloomFlowSpeedY, 0.5)
    assert.equal(settings.chamaacLiquidChromePaletteMode, "harmony")
    assert.equal(settings.chamaacLiquidChromePrimaryColor, "#C0C0C0")
    assert.equal(settings.chamaacLiquidChromeHarmony, "monochromatic")
    assert.equal(settings.chamaacLiquidChromeColorOne, "#C0C0C0")
    assert.equal(settings.chamaacLiquidChromeColorTwo, "#4A4A4A")
    assert.equal(settings.chamaacLiquidChromeFlowSpeed, 1.4)
    assert.equal(settings.chamaacLiquidChromeTimeScale, 0.4)
    assert.equal(settings.chamaacWavesPaletteMode, "harmony")
    assert.equal(settings.chamaacWavesPrimaryColor, "#071697")
    assert.equal(settings.chamaacWavesHarmony, "triad")
    assert.equal(settings.chamaacWavesBackgroundColor, "#000000")
    assert.equal(settings.chamaacWavesColorOne, "#071697")
    assert.equal(settings.chamaacWavesColorTwo, "#00D4FF")
    assert.equal(settings.chamaacWavesColorThree, "#000000")
    assert.equal(settings.chamaacWavesSpeedX, 0.08)
    assert.equal(settings.chamaacWavesSpeedY, 0.04)
    assert.equal(settings.chamaacWavesAmplitude, 48)
    assert.equal(settings.chamaacSynthesisPaletteMode, "harmony")
    assert.equal(settings.chamaacSynthesisPrimaryColor, "#33B2FF")
    assert.equal(settings.chamaacSynthesisHarmony, "split-complementary")
    assert.equal(settings.chamaacSynthesisColorOne, "#112233")
    assert.equal(settings.chamaacSynthesisColorTwo, "#445566")
    assert.equal(settings.chamaacSynthesisColorThree, "#778899")
    assert.equal(settings.chamaacSynthesisSpeed, 1.8)
    assert.equal(settings.chamaacSynthesisComplexity, 16)
    assert.equal(settings.chamaacSynthesisScale, 2.4)
    assert.equal(settings.chamaacSynthesisDistortion, 1.4)
    assert.equal(settings.chamaacSynthesisGlowIntensity, 1.6)
    assert.equal(settings.chamaacSynthesisFlowFrequency, 7.5)
    assert.equal(settings.backgroundLinesDuration, 16)
    assert.equal(settings.wavyBackgroundFill, "#111111")
    assert.equal(settings.wavyColorTwo, "#ABC123")
    assert.equal(settings.wavyBlur, 14)
    assert.equal(settings.wavyWaveOpacity, 0.75)
    assert.equal(settings.shootingStarsTrailColor, "#202020")
    assert.equal(settings.shootingStarsDensity, 0.00024)
    assert.equal(settings.shootingStarsTwinkle, false)
    assert.equal(settings.shootingStarsFrequency, 1.5)
    assert.equal(settings.canvasRevealDotsDotColor, "#00FFCC")
    assert.equal(settings.canvasRevealDotsDotSpacing, 14)
    assert.equal(settings.canvasRevealDotsShowGradient, false)
    assert.equal(settings.spotlightColor, "#AABBCC")
    assert.equal(settings.spotlightDuration, 12)
    assert.equal(settings.spotlightXOffset, 180)
    assert.equal(settings.lampColor, "#22D3EE")
    assert.equal(settings.lampGlowOpacity, 0.9)
    assert.equal(settings.lampPulseSpeed, 14)
    assert.equal(settings.vortexBackgroundColor, "#040404")
    assert.equal(settings.vortexBaseHue, 180)
    assert.equal(settings.vortexParticleCount, 500)
    assert.equal(settings.vortexRangeSpeed, 1.7)
    assert.equal(settings.auroraBarsBackgroundColor, "#010203")
    assert.equal(settings.auroraBarsPaletteMode, "custom")
    assert.equal(settings.auroraBarsPrimaryColor, "#334455")
    assert.equal(settings.auroraBarsColorOne, "#AABBCC")
    assert.equal(settings.auroraBarsBarCount, 64)
    assert.equal(settings.auroraBarsSpeed, 1.5)
    assert.equal(settings.pixelLiquidBackgroundColor, "#110603")
    assert.equal(settings.pixelLiquidBaseColor, "#A4360C")
    assert.equal(settings.pixelLiquidAccentColor, "#FF7A1A")
    assert.equal(settings.pixelLiquidHighlightColor, "#FFE2AB")
    assert.equal(settings.pixelLiquidPixelSize, 11)
    assert.equal(settings.pixelLiquidDetail, "low")
    assert.equal(settings.pixelLiquidMotionSpeed, 0.5)
    assert.equal(settings.tileGridPaletteMode, "custom")
    assert.equal(settings.tileGridPrimaryColor, "#112233")
    assert.equal(settings.tileGridColorOne, "#AABBCC")
    assert.equal(settings.tileGridColorTwo, "#223344")
    assert.equal(settings.tileGridColorThree, "#445566")
    assert.equal(settings.tileGridColorFour, "#667788")
    assert.equal(settings.tileGridColorFive, "#8899AA")
    assert.equal(settings.tileGridTileSize, 64)
    assert.equal(settings.tileGridJointSize, 6)
    assert.equal(settings.tileGridChangeFrequency, 2.5)
    assert.equal(settings.tileGridActivePercent, 32)
    assert.equal(settings.tileGridOpacity, 0.93)
    assert.equal(settings.hexGridPrimaryColor, "#223344")
    assert.equal(settings.hexGridHarmony, "triad")
    assert.equal(settings.hexGridHexSize, 72)
    assert.equal(settings.hexGridJointSize, 5)
    assert.equal(settings.hexGridChangeFrequency, 3.5)
    assert.equal(settings.hexGridActivePercent, 28)
    assert.equal(settings.hexGridOpacity, 0.82)
  })

  it("treats the existing paid Chimer color entitlement as premium background access", () => {
    const settings = sanitizeChimerSettingsForEntitlements({
      primaryFontColor: "#000000",
      movingBackgroundMainColor: "#ABCDEF",
      movingBackgroundOrbColor: "#FEDCBA",
      backgroundId: "aceternity-aurora",
    }, [FEATURE_KEYS.chimerCustomColors])

    assert.equal(settings.primaryFontColor, "#000000")
    assert.equal(settings.movingBackgroundMainColor, "#ABCDEF")
    assert.equal(settings.movingBackgroundOrbColor, "#FEDCBA")
    assert.equal(settings.backgroundId, "aceternity-aurora")
  })
})
