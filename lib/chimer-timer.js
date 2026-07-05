import { FEATURE_KEYS, hasFeature, hasPremiumBackgroundAccess } from "./membership.js"
import { DEFAULT_BACKGROUND_ID, normalizeBackgroundId } from "./background-options.js"
import {
  clampTileGridFadeSeconds,
  TILE_GRID_FADE_SECONDS_DEFAULT,
} from "./tile-grid-background.js"

export const CHIMER_STORAGE_KEY = "massagelab-chimer-settings"

const PIXEL_LIQUID_COLOR_PRESETS = Object.freeze({
  teal: {
    backgroundColor: "#020A0D",
    baseColor: "#007C84",
    accentColor: "#00E0D7",
    highlightColor: "#98FFF3",
  },
  violet: {
    backgroundColor: "#080512",
    baseColor: "#5C2CA2",
    accentColor: "#C562FF",
    highlightColor: "#F2D6FF",
  },
  ember: {
    backgroundColor: "#110603",
    baseColor: "#A4360C",
    accentColor: "#FF7A1A",
    highlightColor: "#FFE2AB",
  },
  midnight: {
    backgroundColor: "#01040A",
    baseColor: "#164D94",
    accentColor: "#51ABFF",
    highlightColor: "#D6EFFF",
  },
})

const ANIMATE_UI_GRADIENT_HARMONIES = Object.freeze([
  "analogous",
  "complementary",
  "split-complementary",
  "triad",
  "square",
  "compound",
  "shades",
  "monochromatic",
])

const COLOR_HARMONIES = ANIMATE_UI_GRADIENT_HARMONIES
const CHAMAAC_LIGHT_SPEED_WARP_SPEED_VERSION = 2
const CHAMAAC_LIGHT_SPEED_LEGACY_WARP_SCALE = 10
const CHAMAAC_ELECTRIC_MIST_CONTROL_VERSION = 2
export const ACETERNITY_3D_GLOBE_MIN_SCALE = 0.05
export const ACETERNITY_3D_GLOBE_MAX_SCALE = 0.95
export const ACETERNITY_3D_GLOBE_GRAPHIC_MAP_SAMPLES_MIN = 1000
export const ACETERNITY_3D_GLOBE_GRAPHIC_MAP_SAMPLES_MAX = 10000

export const DEFAULT_CHIMER_SETTINGS = Object.freeze({
  hours: 0,
  minutes: 0,
  intervalType: "preset",
  customInterval: 15,
  areasToMassage: 4,
  alertType: "chime",
  movingBackgroundEnabled: true,
  backgroundId: DEFAULT_BACKGROUND_ID,
  keepTimerScreenAwake: true,
  showTimerSeconds: true,
  showCurrentTimeSeconds: false,
  timeFormat: "12h",
  primaryFontColor: "#FFFFFF",
  secondaryFontColor: "#FF7A1A",
  clockModeFontColor: "#FFFFFF",
  movingBackgroundMainColor: "#FF8C2A",
  movingBackgroundOrbColor: "#4169E1",
  sparklesMaxSize: 3,
  sparklesMinSize: 1,
  sparklesParticleColor: "#EAF6FF",
  sparklesParticleDensity: 84,
  sparklesSpeed: 2,
  gradientAnimationBackgroundStartColor: "#2A063F",
  gradientAnimationBackgroundEndColor: "#000D52",
  gradientAnimationFirstColor: "#1271FF",
  gradientAnimationSecondColor: "#DD4AFF",
  gradientAnimationThirdColor: "#64DCFF",
  gradientAnimationFourthColor: "#C83232",
  gradientAnimationFifthColor: "#B4B432",
  gradientAnimationSpeed: 1,
  gradientAnimationSize: 80,
  animateUiGradientPrimaryColor: "#3B82F6",
  animateUiGradientHarmony: "analogous",
  animateUiGradientOpacity: 1,
  animateUiStarsColor: "#FFFFFF",
  animateUiStarsSpeed: 50,
  animateUiStarsDensity: 1,
  animateUiStarsParallax: 0.05,
  animateUiHoleStrokeColor: "#737373",
  animateUiHoleParticleColor: "#FFFFFF",
  animateUiHoleLineCount: 50,
  animateUiHoleDiscCount: 50,
  chamaacLightSpeedWarpSpeed: 1,
  chamaacLightSpeedWarpSpeedVersion: CHAMAAC_LIGHT_SPEED_WARP_SPEED_VERSION,
  chamaacLightSpeedParticleCount: 200,
  chamaacLightSpeedLightColor: "#B026FF",
  chamaacLightSpeedIntensity: 3,
  chamaacLightSpeedRadius: 25,
  chamaacLightSpeedCylinderLength: 150,
  chamaacElectricMistColor: "#191970",
  chamaacElectricMistSpeed: 100,
  chamaacElectricMistControlVersion: CHAMAAC_ELECTRIC_MIST_CONTROL_VERSION,
  chamaacElectricMistDetail: 1.5,
  chamaacElectricMistDistortion: 3,
  chamaacElectricMistBrightness: 100,
  chamaacAstralFlowPaletteMode: "custom",
  chamaacAstralFlowPrimaryColor: "#A0769A",
  chamaacAstralFlowHarmony: "analogous",
  chamaacAstralFlowColorOne: "#05070A",
  chamaacAstralFlowColorTwo: "#2E1A38",
  chamaacAstralFlowColorThree: "#A0769A",
  chamaacAstralFlowSpeed: 1.5,
  chamaacAstralFlowFlowMin: 3,
  chamaacAstralFlowFlowMax: 7,
  chamaacDeepSpaceNebulaPaletteMode: "custom",
  chamaacDeepSpaceNebulaPrimaryColor: "#763B65",
  chamaacDeepSpaceNebulaHarmony: "complementary",
  chamaacDeepSpaceNebulaColorOne: "#5EFFF4",
  chamaacDeepSpaceNebulaColorTwo: "#763B65",
  chamaacDeepSpaceNebulaColorThree: "#1A0B2E",
  chamaacDeepSpaceNebulaSpeed: 2,
  chamaacGridBloomColor: "#E040FB",
  chamaacGridBloomSpeed: 1,
  chamaacGridBloomGridScale: 12,
  chamaacGridBloomRotationSpeed: 0,
  chamaacGridBloomFadeFalloff: 10,
  chamaacGridBloomDistortionAmount: 0.05,
  chamaacGridBloomFlowSpeedX: -0.2,
  chamaacGridBloomFlowSpeedY: -0.4,
  chamaacLiquidChromePaletteMode: "custom",
  chamaacLiquidChromePrimaryColor: "#C0C0C0",
  chamaacLiquidChromeHarmony: "monochromatic",
  chamaacLiquidChromeColorOne: "#C0C0C0",
  chamaacLiquidChromeColorTwo: "#4A4A4A",
  chamaacLiquidChromeFlowSpeed: 0.35,
  chamaacLiquidChromeTimeScale: 0.225,
  chamaacWavesPaletteMode: "custom",
  chamaacWavesPrimaryColor: "#071697",
  chamaacWavesHarmony: "analogous",
  chamaacWavesBackgroundColor: "#000000",
  chamaacWavesColorOne: "#071697",
  chamaacWavesColorTwo: "#00D4FF",
  chamaacWavesColorThree: "#000000",
  chamaacWavesSpeedX: 0.0125,
  chamaacWavesSpeedY: 0.005,
  chamaacWavesAmplitude: 32,
  reactBitsFerrofluidPaletteMode: "custom",
  reactBitsFerrofluidPrimaryColor: "#FFFFFF",
  reactBitsFerrofluidHarmony: "monochromatic",
  reactBitsFerrofluidColorOne: "#FFFFFF",
  reactBitsFerrofluidColorTwo: "#FFFFFF",
  reactBitsFerrofluidColorThree: "#FFFFFF",
  reactBitsFerrofluidSpeed: 0.5,
  reactBitsFerrofluidScale: 1.6,
  reactBitsFerrofluidTurbulence: 1,
  reactBitsFerrofluidFluidity: 0.1,
  reactBitsFerrofluidRimWidth: 0.2,
  reactBitsFerrofluidSharpness: 2.5,
  reactBitsFerrofluidShimmer: 1.5,
  reactBitsFerrofluidGlow: 2,
  reactBitsFerrofluidFlowDirection: "down",
  reactBitsFerrofluidOpacity: 1,
  reactBitsLightfallPaletteMode: "custom",
  reactBitsLightfallPrimaryColor: "#A6C8FF",
  reactBitsLightfallHarmony: "analogous",
  reactBitsLightfallColorOne: "#A6C8FF",
  reactBitsLightfallColorTwo: "#5227FF",
  reactBitsLightfallColorThree: "#FF9FFC",
  reactBitsLightfallBackgroundColor: "#0A29FF",
  reactBitsLightfallSpeed: 0.5,
  reactBitsLightfallStreakCount: 2,
  reactBitsLightfallStreakWidth: 1,
  reactBitsLightfallStreakLength: 1,
  reactBitsLightfallGlow: 1,
  reactBitsLightfallDensity: 0.6,
  reactBitsLightfallTwinkle: 1,
  reactBitsLightfallZoom: 3,
  reactBitsLightfallBackgroundGlow: 0.5,
  reactBitsLightfallOpacity: 1,
  reactBitsLightfallCursorEnabled: false,
  reactBitsLightfallCursorStrength: 0.5,
  reactBitsLightfallCursorRadius: 1,
  reactBitsLightfallCursorDampening: 0.15,
  reactBitsLiquidEtherPaletteMode: "custom",
  reactBitsLiquidEtherPrimaryColor: "#5227FF",
  reactBitsLiquidEtherHarmony: "analogous",
  reactBitsLiquidEtherColorOne: "#5227FF",
  reactBitsLiquidEtherColorTwo: "#FF9FFC",
  reactBitsLiquidEtherColorThree: "#B497CF",
  reactBitsLiquidEtherCursorEnabled: false,
  reactBitsLiquidEtherMouseForce: 20,
  reactBitsLiquidEtherCursorSize: 100,
  reactBitsLiquidEtherIsViscous: false,
  reactBitsLiquidEtherViscous: 30,
  reactBitsLiquidEtherIterationsViscous: 32,
  reactBitsLiquidEtherIterationsPoisson: 32,
  reactBitsLiquidEtherDt: 0.014,
  reactBitsLiquidEtherBfecc: true,
  reactBitsLiquidEtherResolution: 0.5,
  reactBitsLiquidEtherIsBounce: false,
  reactBitsLiquidEtherAutoDemo: true,
  reactBitsLiquidEtherAutoSpeed: 0.5,
  reactBitsLiquidEtherAutoIntensity: 2.2,
  reactBitsLiquidEtherAutoResumeDelay: 1000,
  reactBitsLiquidEtherAutoRampDuration: 0.6,
  reactBitsLiquidEtherOpacity: 1,
  reactBitsPrismHeight: 3.5,
  reactBitsPrismBaseWidth: 5.5,
  reactBitsPrismAnimationType: "rotate",
  reactBitsPrismGlow: 1,
  reactBitsPrismOffsetX: 0,
  reactBitsPrismOffsetY: 0,
  reactBitsPrismNoise: 0.5,
  reactBitsPrismTransparent: true,
  reactBitsPrismScale: 3.6,
  reactBitsPrismHueShift: 0,
  reactBitsPrismColorFrequency: 1,
  reactBitsPrismHoverStrength: 2,
  reactBitsPrismInertia: 0.05,
  reactBitsPrismBloom: 1,
  reactBitsPrismTimeScale: 0.5,
  reactBitsDarkVeilHueShift: 0,
  reactBitsDarkVeilNoiseIntensity: 0,
  reactBitsDarkVeilScanlineIntensity: 0,
  reactBitsDarkVeilSpeed: 0.5,
  reactBitsDarkVeilScanlineFrequency: 0,
  reactBitsDarkVeilWarpAmount: 0,
  reactBitsDarkVeilResolutionScale: 1,
  reactBitsLightPillarPaletteMode: "custom",
  reactBitsLightPillarPrimaryColor: "#5227FF",
  reactBitsLightPillarHarmony: "analogous",
  reactBitsLightPillarTopColor: "#5227FF",
  reactBitsLightPillarBottomColor: "#FF9FFC",
  reactBitsLightPillarIntensity: 1,
  reactBitsLightPillarRotationSpeed: 0.3,
  reactBitsLightPillarInteractive: false,
  reactBitsLightPillarGlowAmount: 0.005,
  reactBitsLightPillarWidth: 3,
  reactBitsLightPillarHeight: 0.4,
  reactBitsLightPillarNoiseIntensity: 0.5,
  reactBitsLightPillarBlendMode: "screen",
  reactBitsLightPillarRotation: 0,
  reactBitsLightPillarQuality: "high",
  reactBitsSilkPaletteMode: "custom",
  reactBitsSilkPrimaryColor: "#7B7481",
  reactBitsSilkHarmony: "analogous",
  reactBitsSilkColor: "#7B7481",
  reactBitsSilkSpeed: 5,
  reactBitsSilkScale: 1,
  reactBitsSilkNoiseIntensity: 1.5,
  reactBitsSilkRotation: 0,
  reactBitsFloatingLinesPaletteMode: "source",
  reactBitsFloatingLinesPrimaryColor: "#E947F5",
  reactBitsFloatingLinesHarmony: "analogous",
  reactBitsFloatingLinesColorOne: "#E947F5",
  reactBitsFloatingLinesColorTwo: "#2F4BA2",
  reactBitsFloatingLinesColorThree: "#FFFFFF",
  reactBitsFloatingLinesEnableTop: true,
  reactBitsFloatingLinesEnableMiddle: true,
  reactBitsFloatingLinesEnableBottom: true,
  reactBitsFloatingLinesTopLineCount: 6,
  reactBitsFloatingLinesMiddleLineCount: 6,
  reactBitsFloatingLinesBottomLineCount: 6,
  reactBitsFloatingLinesTopLineDistance: 5,
  reactBitsFloatingLinesMiddleLineDistance: 0.1,
  reactBitsFloatingLinesBottomLineDistance: 0.1,
  reactBitsFloatingLinesTopWaveX: 10,
  reactBitsFloatingLinesTopWaveY: 0.5,
  reactBitsFloatingLinesTopWaveRotate: -0.4,
  reactBitsFloatingLinesMiddleWaveX: 5,
  reactBitsFloatingLinesMiddleWaveY: 0,
  reactBitsFloatingLinesMiddleWaveRotate: 0.2,
  reactBitsFloatingLinesBottomWaveX: 2,
  reactBitsFloatingLinesBottomWaveY: -0.7,
  reactBitsFloatingLinesBottomWaveRotate: -1,
  reactBitsFloatingLinesAnimationSpeed: 1,
  reactBitsFloatingLinesInteractive: true,
  reactBitsFloatingLinesBendRadius: 5,
  reactBitsFloatingLinesBendStrength: -0.5,
  reactBitsFloatingLinesMouseDamping: 0.05,
  reactBitsFloatingLinesParallax: true,
  reactBitsFloatingLinesParallaxStrength: 0.2,
  reactBitsFloatingLinesBlendMode: "screen",
  eldoraNovatrixPaletteMode: "custom",
  eldoraNovatrixPrimaryColor: "#FFFFFF",
  eldoraNovatrixHarmony: "monochromatic",
  eldoraNovatrixColor: "#FFFFFF",
  eldoraNovatrixSpeed: 1,
  eldoraNovatrixAmplitude: 0.1,
  eldoraHackerPaletteMode: "custom",
  eldoraHackerPrimaryColor: "#00FF00",
  eldoraHackerHarmony: "monochromatic",
  eldoraHackerColor: "#00FF00",
  eldoraHackerSpeed: 1,
  eldoraHackerFontSize: 8,
  eldoraPhotonBeamPaletteMode: "custom",
  eldoraPhotonBeamPrimaryColor: "#00D9FF",
  eldoraPhotonBeamHarmony: "analogous",
  eldoraPhotonBeamColorBg: "#080808",
  eldoraPhotonBeamColorLine: "#005F6F",
  eldoraPhotonBeamColorSignal: "#00D9FF",
  eldoraPhotonBeamUseColor2: false,
  eldoraPhotonBeamColorSignal2: "#00FFFF",
  eldoraPhotonBeamUseColor3: false,
  eldoraPhotonBeamColorSignal3: "#00B8D4",
  eldoraPhotonBeamLineCount: 80,
  eldoraPhotonBeamSpreadHeight: 50,
  eldoraPhotonBeamSpreadDepth: 0,
  eldoraPhotonBeamCurveLength: 50,
  eldoraPhotonBeamStraightLength: 100,
  eldoraPhotonBeamCurvePower: 0.8265,
  eldoraPhotonBeamWaveSpeed: 2.48,
  eldoraPhotonBeamWaveHeight: 0.145,
  eldoraPhotonBeamLineOpacity: 0.557,
  eldoraPhotonBeamSignalCount: 94,
  eldoraPhotonBeamSpeedGlobal: 0.345,
  eldoraPhotonBeamTrailLength: 3,
  eldoraPhotonBeamBloomStrength: 3,
  eldoraPhotonBeamBloomRadius: 0.5,
  aceternity3DGlobeViewStyle: "realistic",
  aceternity3DGlobeBackgroundColor: "#020617",
  aceternity3DGlobeGlobeColor: "#1A1A2E",
  aceternity3DGlobeGraphicMapColor: "#FFFFFF",
  aceternity3DGlobeGraphicGlowColor: "#FFFFFF",
  aceternity3DGlobeGraphicMarkerColor: "#FB6415",
  aceternity3DGlobeGraphicMapSamples: 8000,
  aceternity3DGlobeAutoRotateSpeed: 0.3,
  aceternity3DGlobeReverseSpin: true,
  aceternity3DGlobeScale: 0.4,
  aceternity3DGlobeBumpScale: 1,
  aceternity3DGlobeAmbientIntensity: 0.6,
  aceternity3DGlobePointLightIntensity: 1.5,
  aceternity3DGlobeLightingMode: "manual",
  aceternity3DGlobeEnablePan: false,
  aceternity3DGlobePanX: 0,
  aceternity3DGlobePanY: 0,
  aceternity3DGlobeShowTilt: true,
  aceternity3DGlobeShowAtmosphere: false,
  aceternity3DGlobeAtmosphereColor: "#4DA6FF",
  aceternity3DGlobeAtmosphereIntensity: 0.5,
  aceternity3DGlobeAtmosphereBlur: 2,
  aceternity3DGlobeShowWireframe: false,
  aceternity3DGlobeWireframeColor: "#4A9EFF",
  aceternity3DGlobeMarkerEnabled: false,
  aceternity3DGlobeMarkerLat: 39.8283,
  aceternity3DGlobeMarkerLng: -98.5795,
  aceternity3DGlobeMarkerLabel: "Your location",
  aceternity3DGlobeMarkerIcon: "pin",
  aceternity3DGlobeMarkerSize: 0.06,
  magicRetroGridBackgroundColor: "#020617",
  magicRetroGridLightLineColor: "#808080",
  magicRetroGridDarkLineColor: "#808080",
  magicRetroGridAngle: 65,
  magicRetroGridCellSize: 60,
  magicRetroGridOpacity: 0.5,
  magicLightRaysBackgroundColor: "#020617",
  magicLightRaysColor: "#A0D2FF",
  magicLightRaysCount: 7,
  magicLightRaysBlur: 36,
  magicLightRaysSpeed: 14,
  magicLightRaysLength: 70,
  magicLightRaysOpacity: 0.65,
  chamaacSynthesisPaletteMode: "custom",
  chamaacSynthesisPrimaryColor: "#0EA5E9",
  chamaacSynthesisHarmony: "analogous",
  chamaacSynthesisColorOne: "#0F172A",
  chamaacSynthesisColorTwo: "#3B0764",
  chamaacSynthesisColorThree: "#0EA5E9",
  chamaacSynthesisSpeed: 0.4,
  chamaacSynthesisComplexity: 6,
  chamaacSynthesisScale: 1,
  chamaacSynthesisDistortion: 0.6,
  chamaacSynthesisGlowIntensity: 0.4,
  chamaacSynthesisFlowFrequency: 3,
  backgroundLinesDuration: 10,
  shootingStarsStarColor: "#FFFFFF",
  shootingStarsTrailColor: "#B4F2FF",
  shootingStarsShootingStarColor: "#48DCF9",
  shootingStarsDensity: 0.00015,
  shootingStarsTwinkle: true,
  shootingStarsTwinkleSpeed: 1,
  shootingStarsShootingSpeed: 1,
  shootingStarsFrequency: 1,
  canvasRevealDotsBackgroundColor: "#020617",
  canvasRevealDotsDotColor: "#00FFFF",
  canvasRevealDotsAccentColor: "#22D3EE",
  canvasRevealDotsDotSize: 3,
  canvasRevealDotsDotSpacing: 6,
  canvasRevealDotsOpacity: 0.72,
  canvasRevealDotsAnimationSpeed: 0.4,
  canvasRevealDotsShowGradient: false,
  spotlightColor: "#D5ECFF",
  spotlightOpacity: 1,
  spotlightWidth: 560,
  spotlightHeight: 1380,
  spotlightSmallWidth: 240,
  spotlightTranslateY: -350,
  spotlightDuration: 7,
  spotlightXOffset: 100,
  lampBackgroundColor: "#020617",
  lampColor: "#06B6D4",
  lampGlowOpacity: 0.5,
  lampBeamWidth: 480,
  lampGlowWidth: 448,
  lampVerticalOffset: -112,
  lampPulseSpeed: 9,
  vortexBackgroundColor: "#000000",
  vortexBaseHue: 220,
  vortexParticleCount: 420,
  vortexRangeY: 120,
  vortexBaseSpeed: 0,
  vortexRangeSpeed: 1.2,
  vortexBaseRadius: 1,
  vortexRangeRadius: 2,
  wavyBackgroundFill: "#000000",
  wavyColorOne: "#38BDF8",
  wavyColorTwo: "#818CF8",
  wavyColorThree: "#C084FC",
  wavyColorFour: "#E879F9",
  wavyColorFive: "#22D3EE",
  wavyWaveWidth: 50,
  wavyBlur: 10,
  wavySpeed: "fast",
  wavyWaveOpacity: 0.5,
  auroraBarsBackgroundColor: "#000000",
  auroraBarsPaletteMode: "auto",
  auroraBarsPrimaryColor: "#FF5AA6",
  auroraBarsColorOne: "#FFD6EB",
  auroraBarsColorTwo: "#FF9ACB",
  auroraBarsColorThree: "#FF5AA6",
  auroraBarsColorFour: "#FF2D78",
  auroraBarsColorFive: "#000000",
  auroraBarsBarCount: 24,
  auroraBarsSpeed: 0.5,
  auroraBarsBlur: 0,
  auroraBarsGap: 3,
  auroraBarsMaxHeightRatio: 0.92,
  auroraBarsMinHeightRatio: 0.18,
  pixelLiquidBackgroundColor: "#020A0D",
  pixelLiquidBaseColor: "#007C84",
  pixelLiquidAccentColor: "#00E0D7",
  pixelLiquidHighlightColor: "#98FFF3",
  pixelLiquidPalette: "teal",
  pixelLiquidPixelSize: 8,
  pixelLiquidDetail: "medium",
  pixelLiquidCursorForce: 0.7,
  pixelLiquidCursorSize: 0.12,
  pixelLiquidAutoDemo: true,
  pixelLiquidMotionSpeed: 0.72,
  tileGridPaletteMode: "auto",
  tileGridPrimaryColor: "#FF7A1A",
  tileGridColorOne: "#FF7A1A",
  tileGridColorTwo: "#4169E1",
  tileGridColorThree: "#22D3EE",
  tileGridColorFour: "#B45CFF",
  tileGridColorFive: "#F6C453",
  tileGridTileSize: 44,
  tileGridJointSize: 3,
  tileGridChangeFrequency: TILE_GRID_FADE_SECONDS_DEFAULT,
  tileGridActivePercent: 14,
  tileGridOpacity: 0.68,
  hexGridPrimaryColor: "#22D3EE",
  hexGridHarmony: "analogous",
  hexGridHexSize: 48,
  hexGridJointSize: 3,
  hexGridChangeFrequency: TILE_GRID_FADE_SECONDS_DEFAULT,
  hexGridActivePercent: 14,
  hexGridOpacity: 0.72,
})

const LEGACY_CANVAS_REVEAL_DOTS_DEFAULTS = Object.freeze({
  canvasRevealDotsBackgroundColor: "#000000",
  canvasRevealDotsDotColor: "#00FFFF",
  canvasRevealDotsAccentColor: "#FF7A1A",
  canvasRevealDotsDotSize: 1.6,
  canvasRevealDotsDotSpacing: 8,
  canvasRevealDotsOpacity: 0.34,
  canvasRevealDotsAnimationSpeed: 0.4,
  canvasRevealDotsShowGradient: true,
})

export const MAX_CHIMER_DURATION_MS = (23 * 60 + 59) * 60 * 1000

export function normalizeHexColor(value, fallback) {
  if (typeof value !== "string") {
    return fallback
  }

  const trimmed = value.trim()
  return /^#[0-9a-fA-F]{6}$/.test(trimmed) ? trimmed.toUpperCase() : fallback
}

export function normalizeInteger(value, fallback, min, max) {
  const number = Number(value)
  if (!Number.isFinite(number)) {
    return fallback
  }

  const integer = Math.trunc(number)
  return Math.min(Math.max(integer, min), max)
}

export function normalizeNumber(value, fallback, min, max) {
  const number = Number(value)
  if (!Number.isFinite(number)) {
    return fallback
  }

  return Math.min(Math.max(number, min), max)
}

export function getAceternity3DGlobeScaleDisplayPercent(value) {
  const scale = normalizeNumber(
    value,
    DEFAULT_CHIMER_SETTINGS.aceternity3DGlobeScale,
    ACETERNITY_3D_GLOBE_MIN_SCALE,
    ACETERNITY_3D_GLOBE_MAX_SCALE,
  )
  return Math.round(
    1
      + ((scale - ACETERNITY_3D_GLOBE_MIN_SCALE)
        / (ACETERNITY_3D_GLOBE_MAX_SCALE - ACETERNITY_3D_GLOBE_MIN_SCALE)) * 99,
  )
}

export function getAceternity3DGlobeScaleFromDisplayPercent(value) {
  const percent = normalizeNumber(
    value,
    getAceternity3DGlobeScaleDisplayPercent(DEFAULT_CHIMER_SETTINGS.aceternity3DGlobeScale),
    1,
    100,
  )
  const scale = ACETERNITY_3D_GLOBE_MIN_SCALE
    + ((percent - 1) / 99) * (ACETERNITY_3D_GLOBE_MAX_SCALE - ACETERNITY_3D_GLOBE_MIN_SCALE)
  return Number(scale.toFixed(4))
}

function normalizeAceternity3DGlobeLightingMode(value, fallback) {
  return value === "sun" || value === "manual" ? value : fallback
}

function normalizeAceternity3DGlobeViewStyle(value, fallback) {
  return value === "graphic" || value === "realistic" ? value : fallback
}

function normalizeChamaacLightSpeedWarpSpeed(value, fallback, version) {
  const number = Number(value)
  if (!Number.isFinite(number)) {
    return fallback
  }

  // Version 1 stored the source-scale value where 0.10 was MassageLab's slow default.
  // Version 2 stores the user-facing multiplier where 1.00 renders at that same pace.
  const scaledValue = version === CHAMAAC_LIGHT_SPEED_WARP_SPEED_VERSION
    ? number
    : number * CHAMAAC_LIGHT_SPEED_LEGACY_WARP_SCALE
  return normalizeNumber(scaledValue, fallback, 0.1, 24)
}

function normalizeChamaacElectricMistSpeedPercent(value, fallback, version) {
  const number = Number(value)
  if (!Number.isFinite(number)) {
    return fallback
  }

  // Version 1 stored the source-scale speed where 1.00 was the default. Version 2
  // stores the user-facing percentage so the control can show 100% as default.
  const percentValue = Number(version) === CHAMAAC_ELECTRIC_MIST_CONTROL_VERSION ? number : number * 100
  return normalizeNumber(percentValue, fallback, 1, 400)
}

function normalizeChamaacElectricMistBrightnessPercent(value, fallback, version) {
  const number = Number(value)
  if (!Number.isFinite(number)) {
    return fallback
  }

  // Version 1 stored the source shader brightness multiplier. Version 2 stores a
  // direct output-intensity percentage, including a true 1% lower bound.
  const percentValue = Number(version) === CHAMAAC_ELECTRIC_MIST_CONTROL_VERSION ? number : number * 100
  return normalizeNumber(percentValue, fallback, 1, 100)
}

function normalizeChoice(value, fallback, choices) {
  return choices.includes(value) ? value : fallback
}

function normalizeShortString(value, fallback, maxLength) {
  if (typeof value !== "string") {
    return fallback
  }

  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, maxLength) : fallback
}

function normalizeOptionalShortString(value, fallback, maxLength) {
  if (typeof value !== "string") {
    return fallback
  }

  return value.trim().slice(0, maxLength)
}

export function normalizeDuration(hours, minutes) {
  const normalizedHours = normalizeInteger(hours, DEFAULT_CHIMER_SETTINGS.hours, 0, 23)
  const minuteNumber = Number(minutes)

  if (!Number.isFinite(minuteNumber)) {
    return {
      hours: normalizedHours,
      minutes: DEFAULT_CHIMER_SETTINGS.minutes,
    }
  }

  const integerMinutes = Math.trunc(minuteNumber)

  if (integerMinutes >= 60) {
    const totalMinutes = Math.min(normalizedHours * 60 + integerMinutes, 23 * 60 + 59)
    return {
      hours: Math.floor(totalMinutes / 60),
      minutes: totalMinutes % 60,
    }
  }

  return {
    hours: normalizedHours,
    minutes: normalizeInteger(integerMinutes, DEFAULT_CHIMER_SETTINGS.minutes, 0, 59),
  }
}

export function getTotalTimerMs(hours, minutes) {
  const { hours: normalizedHours, minutes: normalizedMinutes } = normalizeDuration(hours, minutes)
  return (normalizedHours * 60 + normalizedMinutes) * 60 * 1000
}

export function clampActiveTimerMs(value) {
  const number = Number(value)
  if (!Number.isFinite(number)) {
    return 0
  }

  return Math.min(Math.max(Math.trunc(number), 0), MAX_CHIMER_DURATION_MS)
}

export function formatDurationParts(timeInMs, settings = {}) {
  const clamped = Math.max(0, Math.ceil(timeInMs / 1000) * 1000)
  const showSeconds = settings.showTimerSeconds !== false

  if (!showSeconds) {
    const totalMinutes = Math.floor(clamped / 60_000)
    const hours = Math.floor(totalMinutes / 60)
    const minutes = totalMinutes % 60

    return {
      hours: hours.toString().padStart(2, "0"),
      minutes: minutes.toString().padStart(2, "0"),
      seconds: "",
    }
  }

  const totalSeconds = Math.floor(clamped / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  return {
    hours: hours.toString().padStart(2, "0"),
    minutes: minutes.toString().padStart(2, "0"),
    seconds: seconds.toString().padStart(2, "0"),
  }
}

export function normalizeTimeFormat(input) {
  if (input === "12h" || input === "24h") {
    return input
  }

  if (input === undefined && arguments.length > 1) {
    return arguments[1]
  }

  return DEFAULT_CHIMER_SETTINGS.timeFormat
}

export function formatCurrentTimeParts(date = new Date(), settings = {}, locale = undefined) {
  const timeFormat = normalizeTimeFormat(
    settings.timeFormat,
    settings.showCurrentTimeAmPm === false ? "24h" : DEFAULT_CHIMER_SETTINGS.timeFormat,
  )
  const options = {
    hour: "2-digit",
    minute: "2-digit",
    hour12: timeFormat === "12h",
  }

  if (settings.showCurrentTimeSeconds === true) {
    options.second = "2-digit"
  }

  const parts = new Intl.DateTimeFormat(locale, options).formatToParts(date)
  const meridiem = timeFormat === "12h"
    ? parts.find((part) => part.type === "dayPeriod")?.value ?? ""
    : ""
  const time = parts
    .filter((part) => part.type !== "dayPeriod")
    .map((part) => part.value)
    .join("")
    .trim()

  return {
    time,
    meridiem,
  }
}

export function getIntervalMs(settings, totalDurationMs) {
  if (!settings || totalDurationMs <= 0) {
    return null
  }

  if (settings.intervalType === "areas") {
    const areas = normalizeInteger(settings.areasToMassage, DEFAULT_CHIMER_SETTINGS.areasToMassage, 1, 24)
    return Math.max(1000, Math.floor(totalDurationMs / areas))
  }

  if (settings.intervalType === "preset" || settings.intervalType === "custom") {
    const minutes = normalizeInteger(settings.customInterval, DEFAULT_CHIMER_SETTINGS.customInterval, 1, 240)
    return minutes * 60 * 1000
  }

  return null
}

export function getActiveTimerAlertSchedule({ status, now, remainingMs, intervalMs }) {
  const clampedRemainingMs = clampActiveTimerMs(remainingMs)
  const normalizedIntervalMs = clampActiveTimerMs(intervalMs)
  const shouldSchedule = normalizedIntervalMs > 0 && normalizedIntervalMs < clampedRemainingMs

  return {
    nextAlertAtMs: status === "running" && shouldSchedule ? now + normalizedIntervalMs : null,
    msUntilNextAlert: status === "paused" && shouldSchedule ? normalizedIntervalMs : null,
  }
}

export function sanitizeChimerSettings(input = {}) {
  const fallback = DEFAULT_CHIMER_SETTINGS
  const duration = normalizeDuration(input.hours, input.minutes)
  const intervalType = ["preset", "custom", "areas"].includes(input.intervalType)
    ? input.intervalType
    : fallback.intervalType
  const alertType = ["chime", "flash", "both", "silent"].includes(input.alertType)
    ? input.alertType
    : fallback.alertType
  const timeFormat = normalizeTimeFormat(
    input.timeFormat,
    input.showCurrentTimeAmPm === false ? "24h" : fallback.timeFormat,
  )
  const pixelLiquidPalette = normalizeChoice(
    input.pixelLiquidPalette,
    fallback.pixelLiquidPalette,
    ["teal", "violet", "ember", "midnight"],
  )
  const pixelLiquidPreset = PIXEL_LIQUID_COLOR_PRESETS[pixelLiquidPalette] ?? PIXEL_LIQUID_COLOR_PRESETS.teal
  const animateUiGradientPrimaryColor = input.animateUiGradientPrimaryColor ?? input.animateUiGradientFromColor
  const chamaacLightSpeedWarpSpeedVersion = input.chamaacLightSpeedWarpSpeedVersion === CHAMAAC_LIGHT_SPEED_WARP_SPEED_VERSION
    ? CHAMAAC_LIGHT_SPEED_WARP_SPEED_VERSION
    : 1

  const sanitizedSettings = {
    hours: duration.hours,
    minutes: duration.minutes,
    intervalType,
    customInterval: normalizeInteger(input.customInterval, fallback.customInterval, 1, 240),
    areasToMassage: normalizeInteger(input.areasToMassage, fallback.areasToMassage, 1, 24),
    alertType,
    movingBackgroundEnabled:
      typeof input.movingBackgroundEnabled === "boolean" ? input.movingBackgroundEnabled : fallback.movingBackgroundEnabled,
    backgroundId: normalizeBackgroundId(input.backgroundId, fallback.backgroundId),
    keepTimerScreenAwake:
      typeof input.keepTimerScreenAwake === "boolean" ? input.keepTimerScreenAwake : fallback.keepTimerScreenAwake,
    showTimerSeconds:
      typeof input.showTimerSeconds === "boolean" ? input.showTimerSeconds : fallback.showTimerSeconds,
    showCurrentTimeSeconds:
      typeof input.showCurrentTimeSeconds === "boolean" ? input.showCurrentTimeSeconds : fallback.showCurrentTimeSeconds,
    timeFormat,
    primaryFontColor: normalizeHexColor(input.primaryFontColor, fallback.primaryFontColor),
    secondaryFontColor: normalizeHexColor(input.secondaryFontColor, fallback.secondaryFontColor),
    clockModeFontColor: normalizeHexColor(input.clockModeFontColor, fallback.clockModeFontColor),
    movingBackgroundMainColor: normalizeHexColor(input.movingBackgroundMainColor, fallback.movingBackgroundMainColor),
    movingBackgroundOrbColor: normalizeHexColor(input.movingBackgroundOrbColor, fallback.movingBackgroundOrbColor),
    sparklesMaxSize: normalizeNumber(input.sparklesMaxSize, fallback.sparklesMaxSize, 1, 6),
    sparklesMinSize: normalizeNumber(input.sparklesMinSize, fallback.sparklesMinSize, 0.5, 4),
    sparklesParticleColor: normalizeHexColor(input.sparklesParticleColor, fallback.sparklesParticleColor),
    sparklesParticleDensity: normalizeInteger(input.sparklesParticleDensity, fallback.sparklesParticleDensity, 20, 220),
    sparklesSpeed: normalizeNumber(input.sparklesSpeed, fallback.sparklesSpeed, 0.5, 8),
    gradientAnimationBackgroundStartColor: normalizeHexColor(
      input.gradientAnimationBackgroundStartColor,
      fallback.gradientAnimationBackgroundStartColor,
    ),
    gradientAnimationBackgroundEndColor: normalizeHexColor(
      input.gradientAnimationBackgroundEndColor,
      fallback.gradientAnimationBackgroundEndColor,
    ),
    gradientAnimationFirstColor: normalizeHexColor(input.gradientAnimationFirstColor, fallback.gradientAnimationFirstColor),
    gradientAnimationSecondColor: normalizeHexColor(input.gradientAnimationSecondColor, fallback.gradientAnimationSecondColor),
    gradientAnimationThirdColor: normalizeHexColor(input.gradientAnimationThirdColor, fallback.gradientAnimationThirdColor),
    gradientAnimationFourthColor: normalizeHexColor(input.gradientAnimationFourthColor, fallback.gradientAnimationFourthColor),
    gradientAnimationFifthColor: normalizeHexColor(input.gradientAnimationFifthColor, fallback.gradientAnimationFifthColor),
    gradientAnimationSpeed: normalizeNumber(input.gradientAnimationSpeed, fallback.gradientAnimationSpeed, 0.25, 2.5),
    gradientAnimationSize: normalizeNumber(input.gradientAnimationSize, fallback.gradientAnimationSize, 45, 120),
    animateUiGradientPrimaryColor: normalizeHexColor(animateUiGradientPrimaryColor, fallback.animateUiGradientPrimaryColor),
    animateUiGradientHarmony: normalizeChoice(
      input.animateUiGradientHarmony,
      fallback.animateUiGradientHarmony,
      ANIMATE_UI_GRADIENT_HARMONIES,
    ),
    animateUiGradientOpacity: normalizeNumber(input.animateUiGradientOpacity, fallback.animateUiGradientOpacity, 0.15, 1),
    animateUiStarsColor: normalizeHexColor(input.animateUiStarsColor, fallback.animateUiStarsColor),
    animateUiStarsSpeed: normalizeNumber(input.animateUiStarsSpeed, fallback.animateUiStarsSpeed, 18, 120),
    animateUiStarsDensity: normalizeNumber(input.animateUiStarsDensity, fallback.animateUiStarsDensity, 0.25, 1.5),
    animateUiStarsParallax: normalizeNumber(input.animateUiStarsParallax, fallback.animateUiStarsParallax, 0, 0.12),
    animateUiHoleStrokeColor: normalizeHexColor(input.animateUiHoleStrokeColor, fallback.animateUiHoleStrokeColor),
    animateUiHoleParticleColor: normalizeHexColor(input.animateUiHoleParticleColor, fallback.animateUiHoleParticleColor),
    animateUiHoleLineCount: normalizeInteger(input.animateUiHoleLineCount, fallback.animateUiHoleLineCount, 12, 96),
    animateUiHoleDiscCount: normalizeInteger(input.animateUiHoleDiscCount, fallback.animateUiHoleDiscCount, 12, 96),
    chamaacLightSpeedWarpSpeed: normalizeChamaacLightSpeedWarpSpeed(
      input.chamaacLightSpeedWarpSpeed,
      fallback.chamaacLightSpeedWarpSpeed,
      chamaacLightSpeedWarpSpeedVersion,
    ),
    chamaacLightSpeedWarpSpeedVersion: CHAMAAC_LIGHT_SPEED_WARP_SPEED_VERSION,
    chamaacLightSpeedParticleCount: normalizeInteger(input.chamaacLightSpeedParticleCount, fallback.chamaacLightSpeedParticleCount, 20, 200),
    chamaacLightSpeedLightColor: normalizeHexColor(input.chamaacLightSpeedLightColor, fallback.chamaacLightSpeedLightColor),
    chamaacLightSpeedIntensity: normalizeNumber(input.chamaacLightSpeedIntensity, fallback.chamaacLightSpeedIntensity, 0.25, 6),
    chamaacLightSpeedRadius: normalizeNumber(input.chamaacLightSpeedRadius, fallback.chamaacLightSpeedRadius, 6, 60),
    chamaacLightSpeedCylinderLength: normalizeNumber(input.chamaacLightSpeedCylinderLength, fallback.chamaacLightSpeedCylinderLength, 40, 300),
    chamaacElectricMistColor: normalizeHexColor(input.chamaacElectricMistColor, fallback.chamaacElectricMistColor),
    chamaacElectricMistSpeed: normalizeChamaacElectricMistSpeedPercent(
      input.chamaacElectricMistSpeed,
      fallback.chamaacElectricMistSpeed,
      input.chamaacElectricMistControlVersion,
    ),
    chamaacElectricMistControlVersion: CHAMAAC_ELECTRIC_MIST_CONTROL_VERSION,
    chamaacElectricMistDetail: normalizeNumber(input.chamaacElectricMistDetail, fallback.chamaacElectricMistDetail, 0.5, 4),
    chamaacElectricMistDistortion: normalizeNumber(input.chamaacElectricMistDistortion, fallback.chamaacElectricMistDistortion, 0, 8),
    chamaacElectricMistBrightness: normalizeChamaacElectricMistBrightnessPercent(
      input.chamaacElectricMistBrightness,
      fallback.chamaacElectricMistBrightness,
      input.chamaacElectricMistControlVersion,
    ),
    chamaacAstralFlowPaletteMode: normalizeChoice(
      input.chamaacAstralFlowPaletteMode,
      fallback.chamaacAstralFlowPaletteMode,
      ["harmony", "custom"],
    ),
    chamaacAstralFlowPrimaryColor: normalizeHexColor(
      input.chamaacAstralFlowPrimaryColor,
      fallback.chamaacAstralFlowPrimaryColor,
    ),
    chamaacAstralFlowHarmony: normalizeChoice(
      input.chamaacAstralFlowHarmony,
      fallback.chamaacAstralFlowHarmony,
      COLOR_HARMONIES,
    ),
    chamaacAstralFlowColorOne: normalizeHexColor(input.chamaacAstralFlowColorOne, fallback.chamaacAstralFlowColorOne),
    chamaacAstralFlowColorTwo: normalizeHexColor(input.chamaacAstralFlowColorTwo, fallback.chamaacAstralFlowColorTwo),
    chamaacAstralFlowColorThree: normalizeHexColor(input.chamaacAstralFlowColorThree, fallback.chamaacAstralFlowColorThree),
    chamaacAstralFlowSpeed: normalizeNumber(input.chamaacAstralFlowSpeed, fallback.chamaacAstralFlowSpeed, 0.1, 3),
    chamaacAstralFlowFlowMin: normalizeNumber(input.chamaacAstralFlowFlowMin, fallback.chamaacAstralFlowFlowMin, 0.5, 10),
    chamaacAstralFlowFlowMax: normalizeNumber(input.chamaacAstralFlowFlowMax, fallback.chamaacAstralFlowFlowMax, 1, 12),
    chamaacDeepSpaceNebulaPaletteMode: normalizeChoice(
      input.chamaacDeepSpaceNebulaPaletteMode,
      fallback.chamaacDeepSpaceNebulaPaletteMode,
      ["harmony", "custom"],
    ),
    chamaacDeepSpaceNebulaPrimaryColor: normalizeHexColor(
      input.chamaacDeepSpaceNebulaPrimaryColor,
      fallback.chamaacDeepSpaceNebulaPrimaryColor,
    ),
    chamaacDeepSpaceNebulaHarmony: normalizeChoice(
      input.chamaacDeepSpaceNebulaHarmony,
      fallback.chamaacDeepSpaceNebulaHarmony,
      COLOR_HARMONIES,
    ),
    chamaacDeepSpaceNebulaColorOne: normalizeHexColor(
      input.chamaacDeepSpaceNebulaColorOne,
      fallback.chamaacDeepSpaceNebulaColorOne,
    ),
    chamaacDeepSpaceNebulaColorTwo: normalizeHexColor(
      input.chamaacDeepSpaceNebulaColorTwo,
      fallback.chamaacDeepSpaceNebulaColorTwo,
    ),
    chamaacDeepSpaceNebulaColorThree: normalizeHexColor(
      input.chamaacDeepSpaceNebulaColorThree,
      fallback.chamaacDeepSpaceNebulaColorThree,
    ),
    chamaacDeepSpaceNebulaSpeed: normalizeNumber(
      input.chamaacDeepSpaceNebulaSpeed,
      fallback.chamaacDeepSpaceNebulaSpeed,
      0.1,
      5,
    ),
    chamaacGridBloomColor: normalizeHexColor(input.chamaacGridBloomColor, fallback.chamaacGridBloomColor),
    chamaacGridBloomSpeed: normalizeNumber(input.chamaacGridBloomSpeed, fallback.chamaacGridBloomSpeed, 0.1, 3),
    chamaacGridBloomGridScale: normalizeNumber(
      input.chamaacGridBloomGridScale,
      fallback.chamaacGridBloomGridScale,
      4,
      32,
    ),
    chamaacGridBloomRotationSpeed: normalizeNumber(
      input.chamaacGridBloomRotationSpeed,
      fallback.chamaacGridBloomRotationSpeed,
      -3,
      3,
    ),
    chamaacGridBloomFadeFalloff: normalizeNumber(
      input.chamaacGridBloomFadeFalloff,
      fallback.chamaacGridBloomFadeFalloff,
      1,
      24,
    ),
    chamaacGridBloomDistortionAmount: normalizeNumber(
      input.chamaacGridBloomDistortionAmount,
      fallback.chamaacGridBloomDistortionAmount,
      0,
      0.5,
    ),
    chamaacGridBloomFlowSpeedX: normalizeNumber(
      input.chamaacGridBloomFlowSpeedX,
      fallback.chamaacGridBloomFlowSpeedX,
      -2,
      2,
    ),
    chamaacGridBloomFlowSpeedY: normalizeNumber(
      input.chamaacGridBloomFlowSpeedY,
      fallback.chamaacGridBloomFlowSpeedY,
      -2,
      2,
    ),
    chamaacLiquidChromePaletteMode: normalizeChoice(
      input.chamaacLiquidChromePaletteMode,
      fallback.chamaacLiquidChromePaletteMode,
      ["harmony", "custom"],
    ),
    chamaacLiquidChromePrimaryColor: normalizeHexColor(
      input.chamaacLiquidChromePrimaryColor,
      fallback.chamaacLiquidChromePrimaryColor,
    ),
    chamaacLiquidChromeHarmony: normalizeChoice(
      input.chamaacLiquidChromeHarmony,
      fallback.chamaacLiquidChromeHarmony,
      COLOR_HARMONIES,
    ),
    chamaacLiquidChromeColorOne: normalizeHexColor(
      input.chamaacLiquidChromeColorOne,
      fallback.chamaacLiquidChromeColorOne,
    ),
    chamaacLiquidChromeColorTwo: normalizeHexColor(
      input.chamaacLiquidChromeColorTwo,
      fallback.chamaacLiquidChromeColorTwo,
    ),
    chamaacLiquidChromeFlowSpeed: normalizeNumber(
      input.chamaacLiquidChromeFlowSpeed,
      fallback.chamaacLiquidChromeFlowSpeed,
      0.01,
      2,
    ),
    chamaacLiquidChromeTimeScale: normalizeNumber(
      input.chamaacLiquidChromeTimeScale,
      fallback.chamaacLiquidChromeTimeScale,
      0.001,
      1,
    ),
    chamaacWavesPaletteMode: normalizeChoice(
      input.chamaacWavesPaletteMode,
      fallback.chamaacWavesPaletteMode,
      ["harmony", "custom"],
    ),
    chamaacWavesPrimaryColor: normalizeHexColor(
      input.chamaacWavesPrimaryColor,
      fallback.chamaacWavesPrimaryColor,
    ),
    chamaacWavesHarmony: normalizeChoice(
      input.chamaacWavesHarmony,
      fallback.chamaacWavesHarmony,
      COLOR_HARMONIES,
    ),
    chamaacWavesBackgroundColor: normalizeHexColor(
      input.chamaacWavesBackgroundColor,
      fallback.chamaacWavesBackgroundColor,
    ),
    chamaacWavesColorOne: normalizeHexColor(
      input.chamaacWavesColorOne,
      fallback.chamaacWavesColorOne,
    ),
    chamaacWavesColorTwo: normalizeHexColor(
      input.chamaacWavesColorTwo,
      fallback.chamaacWavesColorTwo,
    ),
    chamaacWavesColorThree: normalizeHexColor(
      input.chamaacWavesColorThree,
      fallback.chamaacWavesColorThree,
    ),
    chamaacWavesSpeedX: normalizeNumber(
      input.chamaacWavesSpeedX,
      fallback.chamaacWavesSpeedX,
      0.001,
      0.1,
    ),
    chamaacWavesSpeedY: normalizeNumber(
      input.chamaacWavesSpeedY,
      fallback.chamaacWavesSpeedY,
      0.001,
      0.1,
    ),
    chamaacWavesAmplitude: normalizeNumber(
      input.chamaacWavesAmplitude,
      fallback.chamaacWavesAmplitude,
      8,
      64,
    ),
    reactBitsFerrofluidPaletteMode: normalizeChoice(
      input.reactBitsFerrofluidPaletteMode,
      fallback.reactBitsFerrofluidPaletteMode,
      ["harmony", "custom"],
    ),
    reactBitsFerrofluidPrimaryColor: normalizeHexColor(
      input.reactBitsFerrofluidPrimaryColor,
      fallback.reactBitsFerrofluidPrimaryColor,
    ),
    reactBitsFerrofluidHarmony: normalizeChoice(
      input.reactBitsFerrofluidHarmony,
      fallback.reactBitsFerrofluidHarmony,
      COLOR_HARMONIES,
    ),
    reactBitsFerrofluidColorOne: normalizeHexColor(
      input.reactBitsFerrofluidColorOne,
      fallback.reactBitsFerrofluidColorOne,
    ),
    reactBitsFerrofluidColorTwo: normalizeHexColor(
      input.reactBitsFerrofluidColorTwo,
      fallback.reactBitsFerrofluidColorTwo,
    ),
    reactBitsFerrofluidColorThree: normalizeHexColor(
      input.reactBitsFerrofluidColorThree,
      fallback.reactBitsFerrofluidColorThree,
    ),
    reactBitsFerrofluidSpeed: normalizeNumber(
      input.reactBitsFerrofluidSpeed,
      fallback.reactBitsFerrofluidSpeed,
      0.05,
      2,
    ),
    reactBitsFerrofluidScale: normalizeNumber(
      input.reactBitsFerrofluidScale,
      fallback.reactBitsFerrofluidScale,
      0.5,
      4,
    ),
    reactBitsFerrofluidTurbulence: normalizeNumber(
      input.reactBitsFerrofluidTurbulence,
      fallback.reactBitsFerrofluidTurbulence,
      0,
      2,
    ),
    reactBitsFerrofluidFluidity: normalizeNumber(
      input.reactBitsFerrofluidFluidity,
      fallback.reactBitsFerrofluidFluidity,
      0.001,
      0.4,
    ),
    reactBitsFerrofluidRimWidth: normalizeNumber(
      input.reactBitsFerrofluidRimWidth,
      fallback.reactBitsFerrofluidRimWidth,
      0.03,
      0.5,
    ),
    reactBitsFerrofluidSharpness: normalizeNumber(
      input.reactBitsFerrofluidSharpness,
      fallback.reactBitsFerrofluidSharpness,
      0.5,
      6,
    ),
    reactBitsFerrofluidShimmer: normalizeNumber(
      input.reactBitsFerrofluidShimmer,
      fallback.reactBitsFerrofluidShimmer,
      0,
      4,
    ),
    reactBitsFerrofluidGlow: normalizeNumber(
      input.reactBitsFerrofluidGlow,
      fallback.reactBitsFerrofluidGlow,
      0.1,
      5,
    ),
    reactBitsFerrofluidFlowDirection: normalizeChoice(
      input.reactBitsFerrofluidFlowDirection,
      fallback.reactBitsFerrofluidFlowDirection,
      ["up", "down", "left", "right"],
    ),
    reactBitsFerrofluidOpacity: normalizeNumber(
      input.reactBitsFerrofluidOpacity,
      fallback.reactBitsFerrofluidOpacity,
      0.05,
      1,
    ),
    reactBitsLightfallPaletteMode: normalizeChoice(
      input.reactBitsLightfallPaletteMode,
      fallback.reactBitsLightfallPaletteMode,
      ["harmony", "custom"],
    ),
    reactBitsLightfallPrimaryColor: normalizeHexColor(
      input.reactBitsLightfallPrimaryColor,
      fallback.reactBitsLightfallPrimaryColor,
    ),
    reactBitsLightfallHarmony: normalizeChoice(
      input.reactBitsLightfallHarmony,
      fallback.reactBitsLightfallHarmony,
      COLOR_HARMONIES,
    ),
    reactBitsLightfallColorOne: normalizeHexColor(
      input.reactBitsLightfallColorOne,
      fallback.reactBitsLightfallColorOne,
    ),
    reactBitsLightfallColorTwo: normalizeHexColor(
      input.reactBitsLightfallColorTwo,
      fallback.reactBitsLightfallColorTwo,
    ),
    reactBitsLightfallColorThree: normalizeHexColor(
      input.reactBitsLightfallColorThree,
      fallback.reactBitsLightfallColorThree,
    ),
    reactBitsLightfallBackgroundColor: normalizeHexColor(
      input.reactBitsLightfallBackgroundColor,
      fallback.reactBitsLightfallBackgroundColor,
    ),
    reactBitsLightfallSpeed: normalizeNumber(
      input.reactBitsLightfallSpeed,
      fallback.reactBitsLightfallSpeed,
      0.05,
      2,
    ),
    reactBitsLightfallStreakCount: Math.trunc(normalizeNumber(
      input.reactBitsLightfallStreakCount,
      fallback.reactBitsLightfallStreakCount,
      1,
      16,
    )),
    reactBitsLightfallStreakWidth: normalizeNumber(
      input.reactBitsLightfallStreakWidth,
      fallback.reactBitsLightfallStreakWidth,
      0.2,
      3,
    ),
    reactBitsLightfallStreakLength: normalizeNumber(
      input.reactBitsLightfallStreakLength,
      fallback.reactBitsLightfallStreakLength,
      0.2,
      3,
    ),
    reactBitsLightfallGlow: normalizeNumber(
      input.reactBitsLightfallGlow,
      fallback.reactBitsLightfallGlow,
      0.1,
      3,
    ),
    reactBitsLightfallDensity: normalizeNumber(
      input.reactBitsLightfallDensity,
      fallback.reactBitsLightfallDensity,
      0.05,
      2,
    ),
    reactBitsLightfallTwinkle: normalizeNumber(
      input.reactBitsLightfallTwinkle,
      fallback.reactBitsLightfallTwinkle,
      0,
      1,
    ),
    reactBitsLightfallZoom: normalizeNumber(
      input.reactBitsLightfallZoom,
      fallback.reactBitsLightfallZoom,
      1,
      6,
    ),
    reactBitsLightfallBackgroundGlow: normalizeNumber(
      input.reactBitsLightfallBackgroundGlow,
      fallback.reactBitsLightfallBackgroundGlow,
      0,
      1.5,
    ),
    reactBitsLightfallOpacity: normalizeNumber(
      input.reactBitsLightfallOpacity,
      fallback.reactBitsLightfallOpacity,
      0.05,
      1,
    ),
    reactBitsLightfallCursorEnabled:
      typeof input.reactBitsLightfallCursorEnabled === "boolean"
        ? input.reactBitsLightfallCursorEnabled
        : fallback.reactBitsLightfallCursorEnabled,
    reactBitsLightfallCursorStrength: normalizeNumber(
      input.reactBitsLightfallCursorStrength,
      fallback.reactBitsLightfallCursorStrength,
      0,
      2,
    ),
    reactBitsLightfallCursorRadius: normalizeNumber(
      input.reactBitsLightfallCursorRadius,
      fallback.reactBitsLightfallCursorRadius,
      0.05,
      3,
    ),
    reactBitsLightfallCursorDampening: normalizeNumber(
      input.reactBitsLightfallCursorDampening,
      fallback.reactBitsLightfallCursorDampening,
      0,
      1,
    ),
    reactBitsLiquidEtherPaletteMode: normalizeChoice(
      input.reactBitsLiquidEtherPaletteMode,
      fallback.reactBitsLiquidEtherPaletteMode,
      ["harmony", "custom"],
    ),
    reactBitsLiquidEtherPrimaryColor: normalizeHexColor(
      input.reactBitsLiquidEtherPrimaryColor,
      fallback.reactBitsLiquidEtherPrimaryColor,
    ),
    reactBitsLiquidEtherHarmony: normalizeChoice(
      input.reactBitsLiquidEtherHarmony,
      fallback.reactBitsLiquidEtherHarmony,
      COLOR_HARMONIES,
    ),
    reactBitsLiquidEtherColorOne: normalizeHexColor(
      input.reactBitsLiquidEtherColorOne,
      fallback.reactBitsLiquidEtherColorOne,
    ),
    reactBitsLiquidEtherColorTwo: normalizeHexColor(
      input.reactBitsLiquidEtherColorTwo,
      fallback.reactBitsLiquidEtherColorTwo,
    ),
    reactBitsLiquidEtherColorThree: normalizeHexColor(
      input.reactBitsLiquidEtherColorThree,
      fallback.reactBitsLiquidEtherColorThree,
    ),
    reactBitsLiquidEtherCursorEnabled:
      typeof input.reactBitsLiquidEtherCursorEnabled === "boolean"
        ? input.reactBitsLiquidEtherCursorEnabled
        : fallback.reactBitsLiquidEtherCursorEnabled,
    reactBitsLiquidEtherMouseForce: normalizeNumber(
      input.reactBitsLiquidEtherMouseForce,
      fallback.reactBitsLiquidEtherMouseForce,
      0,
      80,
    ),
    reactBitsLiquidEtherCursorSize: normalizeNumber(
      input.reactBitsLiquidEtherCursorSize,
      fallback.reactBitsLiquidEtherCursorSize,
      20,
      280,
    ),
    reactBitsLiquidEtherIsViscous:
      typeof input.reactBitsLiquidEtherIsViscous === "boolean"
        ? input.reactBitsLiquidEtherIsViscous
        : fallback.reactBitsLiquidEtherIsViscous,
    reactBitsLiquidEtherViscous: normalizeNumber(
      input.reactBitsLiquidEtherViscous,
      fallback.reactBitsLiquidEtherViscous,
      0,
      80,
    ),
    reactBitsLiquidEtherIterationsViscous: Math.trunc(normalizeNumber(
      input.reactBitsLiquidEtherIterationsViscous,
      fallback.reactBitsLiquidEtherIterationsViscous,
      4,
      64,
    )),
    reactBitsLiquidEtherIterationsPoisson: Math.trunc(normalizeNumber(
      input.reactBitsLiquidEtherIterationsPoisson,
      fallback.reactBitsLiquidEtherIterationsPoisson,
      4,
      64,
    )),
    reactBitsLiquidEtherDt: normalizeNumber(
      input.reactBitsLiquidEtherDt,
      fallback.reactBitsLiquidEtherDt,
      0.004,
      0.04,
    ),
    reactBitsLiquidEtherBfecc:
      typeof input.reactBitsLiquidEtherBfecc === "boolean"
        ? input.reactBitsLiquidEtherBfecc
        : fallback.reactBitsLiquidEtherBfecc,
    reactBitsLiquidEtherResolution: normalizeNumber(
      input.reactBitsLiquidEtherResolution,
      fallback.reactBitsLiquidEtherResolution,
      0.2,
      1,
    ),
    reactBitsLiquidEtherIsBounce:
      typeof input.reactBitsLiquidEtherIsBounce === "boolean"
        ? input.reactBitsLiquidEtherIsBounce
        : fallback.reactBitsLiquidEtherIsBounce,
    reactBitsLiquidEtherAutoDemo:
      typeof input.reactBitsLiquidEtherAutoDemo === "boolean"
        ? input.reactBitsLiquidEtherAutoDemo
        : fallback.reactBitsLiquidEtherAutoDemo,
    reactBitsLiquidEtherAutoSpeed: normalizeNumber(
      input.reactBitsLiquidEtherAutoSpeed,
      fallback.reactBitsLiquidEtherAutoSpeed,
      0.05,
      2,
    ),
    reactBitsLiquidEtherAutoIntensity: normalizeNumber(
      input.reactBitsLiquidEtherAutoIntensity,
      fallback.reactBitsLiquidEtherAutoIntensity,
      0,
      5,
    ),
    reactBitsLiquidEtherAutoResumeDelay: normalizeNumber(
      input.reactBitsLiquidEtherAutoResumeDelay,
      fallback.reactBitsLiquidEtherAutoResumeDelay,
      250,
      5000,
    ),
    reactBitsLiquidEtherAutoRampDuration: normalizeNumber(
      input.reactBitsLiquidEtherAutoRampDuration,
      fallback.reactBitsLiquidEtherAutoRampDuration,
      0,
      3,
    ),
    reactBitsLiquidEtherOpacity: normalizeNumber(
      input.reactBitsLiquidEtherOpacity,
      fallback.reactBitsLiquidEtherOpacity,
      0.05,
      1,
    ),
    reactBitsPrismHeight: normalizeNumber(
      input.reactBitsPrismHeight,
      fallback.reactBitsPrismHeight,
      0.5,
      8,
    ),
    reactBitsPrismBaseWidth: normalizeNumber(
      input.reactBitsPrismBaseWidth,
      fallback.reactBitsPrismBaseWidth,
      0.5,
      10,
    ),
    reactBitsPrismAnimationType: normalizeChoice(
      input.reactBitsPrismAnimationType,
      fallback.reactBitsPrismAnimationType,
      ["rotate", "3drotate", "hover"],
    ),
    reactBitsPrismGlow: normalizeNumber(
      input.reactBitsPrismGlow,
      fallback.reactBitsPrismGlow,
      0,
      3,
    ),
    reactBitsPrismOffsetX: normalizeNumber(
      input.reactBitsPrismOffsetX,
      fallback.reactBitsPrismOffsetX,
      -400,
      400,
    ),
    reactBitsPrismOffsetY: normalizeNumber(
      input.reactBitsPrismOffsetY,
      fallback.reactBitsPrismOffsetY,
      -400,
      400,
    ),
    reactBitsPrismNoise: normalizeNumber(
      input.reactBitsPrismNoise,
      fallback.reactBitsPrismNoise,
      0,
      1,
    ),
    reactBitsPrismTransparent:
      typeof input.reactBitsPrismTransparent === "boolean"
        ? input.reactBitsPrismTransparent
        : fallback.reactBitsPrismTransparent,
    reactBitsPrismScale: normalizeNumber(
      input.reactBitsPrismScale,
      fallback.reactBitsPrismScale,
      0.5,
      7,
    ),
    reactBitsPrismHueShift: normalizeNumber(
      input.reactBitsPrismHueShift,
      fallback.reactBitsPrismHueShift,
      -Math.PI,
      Math.PI,
    ),
    reactBitsPrismColorFrequency: normalizeNumber(
      input.reactBitsPrismColorFrequency,
      fallback.reactBitsPrismColorFrequency,
      0.1,
      3,
    ),
    reactBitsPrismHoverStrength: normalizeNumber(
      input.reactBitsPrismHoverStrength,
      fallback.reactBitsPrismHoverStrength,
      0,
      4,
    ),
    reactBitsPrismInertia: normalizeNumber(
      input.reactBitsPrismInertia,
      fallback.reactBitsPrismInertia,
      0.01,
      0.4,
    ),
    reactBitsPrismBloom: normalizeNumber(
      input.reactBitsPrismBloom,
      fallback.reactBitsPrismBloom,
      0,
      3,
    ),
    reactBitsPrismTimeScale: normalizeNumber(
      input.reactBitsPrismTimeScale,
      fallback.reactBitsPrismTimeScale,
      0,
      2,
    ),
    reactBitsDarkVeilHueShift: normalizeNumber(
      input.reactBitsDarkVeilHueShift,
      fallback.reactBitsDarkVeilHueShift,
      -180,
      180,
    ),
    reactBitsDarkVeilNoiseIntensity: normalizeNumber(
      input.reactBitsDarkVeilNoiseIntensity,
      fallback.reactBitsDarkVeilNoiseIntensity,
      0,
      1,
    ),
    reactBitsDarkVeilScanlineIntensity: normalizeNumber(
      input.reactBitsDarkVeilScanlineIntensity,
      fallback.reactBitsDarkVeilScanlineIntensity,
      0,
      1,
    ),
    reactBitsDarkVeilSpeed: normalizeNumber(
      input.reactBitsDarkVeilSpeed,
      fallback.reactBitsDarkVeilSpeed,
      0,
      2,
    ),
    reactBitsDarkVeilScanlineFrequency: normalizeNumber(
      input.reactBitsDarkVeilScanlineFrequency,
      fallback.reactBitsDarkVeilScanlineFrequency,
      0,
      40,
    ),
    reactBitsDarkVeilWarpAmount: normalizeNumber(
      input.reactBitsDarkVeilWarpAmount,
      fallback.reactBitsDarkVeilWarpAmount,
      0,
      2,
    ),
    reactBitsDarkVeilResolutionScale: normalizeNumber(
      input.reactBitsDarkVeilResolutionScale,
      fallback.reactBitsDarkVeilResolutionScale,
      0.25,
      1,
    ),
    reactBitsLightPillarPaletteMode: normalizeChoice(
      input.reactBitsLightPillarPaletteMode,
      fallback.reactBitsLightPillarPaletteMode,
      ["custom", "harmony"],
    ),
    reactBitsLightPillarPrimaryColor: normalizeHexColor(
      input.reactBitsLightPillarPrimaryColor,
      fallback.reactBitsLightPillarPrimaryColor,
    ),
    reactBitsLightPillarHarmony: normalizeChoice(
      input.reactBitsLightPillarHarmony,
      fallback.reactBitsLightPillarHarmony,
      COLOR_HARMONIES,
    ),
    reactBitsLightPillarTopColor: normalizeHexColor(
      input.reactBitsLightPillarTopColor,
      fallback.reactBitsLightPillarTopColor,
    ),
    reactBitsLightPillarBottomColor: normalizeHexColor(
      input.reactBitsLightPillarBottomColor,
      fallback.reactBitsLightPillarBottomColor,
    ),
    reactBitsLightPillarIntensity: normalizeNumber(
      input.reactBitsLightPillarIntensity,
      fallback.reactBitsLightPillarIntensity,
      0.1,
      3,
    ),
    reactBitsLightPillarRotationSpeed: normalizeNumber(
      input.reactBitsLightPillarRotationSpeed,
      fallback.reactBitsLightPillarRotationSpeed,
      0,
      2,
    ),
    reactBitsLightPillarInteractive:
      typeof input.reactBitsLightPillarInteractive === "boolean"
        ? input.reactBitsLightPillarInteractive
        : fallback.reactBitsLightPillarInteractive,
    reactBitsLightPillarGlowAmount: normalizeNumber(
      input.reactBitsLightPillarGlowAmount,
      fallback.reactBitsLightPillarGlowAmount,
      0.001,
      0.03,
    ),
    reactBitsLightPillarWidth: normalizeNumber(
      input.reactBitsLightPillarWidth,
      fallback.reactBitsLightPillarWidth,
      0.5,
      8,
    ),
    reactBitsLightPillarHeight: normalizeNumber(
      input.reactBitsLightPillarHeight,
      fallback.reactBitsLightPillarHeight,
      0.1,
      2,
    ),
    reactBitsLightPillarNoiseIntensity: normalizeNumber(
      input.reactBitsLightPillarNoiseIntensity,
      fallback.reactBitsLightPillarNoiseIntensity,
      0,
      1,
    ),
    reactBitsLightPillarBlendMode: normalizeChoice(
      input.reactBitsLightPillarBlendMode,
      fallback.reactBitsLightPillarBlendMode,
      ["screen", "normal", "lighten", "plus-lighter"],
    ),
    reactBitsLightPillarRotation: normalizeNumber(
      input.reactBitsLightPillarRotation,
      fallback.reactBitsLightPillarRotation,
      -180,
      180,
    ),
    reactBitsLightPillarQuality: normalizeChoice(
      input.reactBitsLightPillarQuality,
      fallback.reactBitsLightPillarQuality,
      ["low", "medium", "high"],
    ),
    reactBitsSilkPaletteMode: normalizeChoice(
      input.reactBitsSilkPaletteMode,
      fallback.reactBitsSilkPaletteMode,
      ["custom", "harmony"],
    ),
    reactBitsSilkPrimaryColor: normalizeHexColor(
      input.reactBitsSilkPrimaryColor,
      fallback.reactBitsSilkPrimaryColor,
    ),
    reactBitsSilkHarmony: normalizeChoice(
      input.reactBitsSilkHarmony,
      fallback.reactBitsSilkHarmony,
      COLOR_HARMONIES,
    ),
    reactBitsSilkColor: normalizeHexColor(input.reactBitsSilkColor, fallback.reactBitsSilkColor),
    reactBitsSilkSpeed: normalizeNumber(
      input.reactBitsSilkSpeed,
      fallback.reactBitsSilkSpeed,
      0,
      10,
    ),
    reactBitsSilkScale: normalizeNumber(
      input.reactBitsSilkScale,
      fallback.reactBitsSilkScale,
      0.2,
      4,
    ),
    reactBitsSilkNoiseIntensity: normalizeNumber(
      input.reactBitsSilkNoiseIntensity,
      fallback.reactBitsSilkNoiseIntensity,
      0,
      4,
    ),
    reactBitsSilkRotation: normalizeNumber(
      input.reactBitsSilkRotation,
      fallback.reactBitsSilkRotation,
      -Math.PI,
      Math.PI,
    ),
    reactBitsFloatingLinesPaletteMode: normalizeChoice(
      input.reactBitsFloatingLinesPaletteMode,
      fallback.reactBitsFloatingLinesPaletteMode,
      ["source", "harmony", "custom"],
    ),
    reactBitsFloatingLinesPrimaryColor: normalizeHexColor(
      input.reactBitsFloatingLinesPrimaryColor,
      fallback.reactBitsFloatingLinesPrimaryColor,
    ),
    reactBitsFloatingLinesHarmony: normalizeChoice(
      input.reactBitsFloatingLinesHarmony,
      fallback.reactBitsFloatingLinesHarmony,
      COLOR_HARMONIES,
    ),
    reactBitsFloatingLinesColorOne: normalizeHexColor(
      input.reactBitsFloatingLinesColorOne,
      fallback.reactBitsFloatingLinesColorOne,
    ),
    reactBitsFloatingLinesColorTwo: normalizeHexColor(
      input.reactBitsFloatingLinesColorTwo,
      fallback.reactBitsFloatingLinesColorTwo,
    ),
    reactBitsFloatingLinesColorThree: normalizeHexColor(
      input.reactBitsFloatingLinesColorThree,
      fallback.reactBitsFloatingLinesColorThree,
    ),
    reactBitsFloatingLinesEnableTop: typeof input.reactBitsFloatingLinesEnableTop === "boolean"
      ? input.reactBitsFloatingLinesEnableTop
      : fallback.reactBitsFloatingLinesEnableTop,
    reactBitsFloatingLinesEnableMiddle: typeof input.reactBitsFloatingLinesEnableMiddle === "boolean"
      ? input.reactBitsFloatingLinesEnableMiddle
      : fallback.reactBitsFloatingLinesEnableMiddle,
    reactBitsFloatingLinesEnableBottom: typeof input.reactBitsFloatingLinesEnableBottom === "boolean"
      ? input.reactBitsFloatingLinesEnableBottom
      : fallback.reactBitsFloatingLinesEnableBottom,
    reactBitsFloatingLinesTopLineCount: normalizeInteger(
      input.reactBitsFloatingLinesTopLineCount,
      fallback.reactBitsFloatingLinesTopLineCount,
      0,
      32,
    ),
    reactBitsFloatingLinesMiddleLineCount: normalizeInteger(
      input.reactBitsFloatingLinesMiddleLineCount,
      fallback.reactBitsFloatingLinesMiddleLineCount,
      0,
      32,
    ),
    reactBitsFloatingLinesBottomLineCount: normalizeInteger(
      input.reactBitsFloatingLinesBottomLineCount,
      fallback.reactBitsFloatingLinesBottomLineCount,
      0,
      32,
    ),
    reactBitsFloatingLinesTopLineDistance: normalizeNumber(
      input.reactBitsFloatingLinesTopLineDistance,
      fallback.reactBitsFloatingLinesTopLineDistance,
      0.1,
      20,
    ),
    reactBitsFloatingLinesMiddleLineDistance: normalizeNumber(
      input.reactBitsFloatingLinesMiddleLineDistance,
      fallback.reactBitsFloatingLinesMiddleLineDistance,
      0.1,
      20,
    ),
    reactBitsFloatingLinesBottomLineDistance: normalizeNumber(
      input.reactBitsFloatingLinesBottomLineDistance,
      fallback.reactBitsFloatingLinesBottomLineDistance,
      0.1,
      20,
    ),
    reactBitsFloatingLinesTopWaveX: normalizeNumber(
      input.reactBitsFloatingLinesTopWaveX,
      fallback.reactBitsFloatingLinesTopWaveX,
      -20,
      20,
    ),
    reactBitsFloatingLinesTopWaveY: normalizeNumber(
      input.reactBitsFloatingLinesTopWaveY,
      fallback.reactBitsFloatingLinesTopWaveY,
      -4,
      4,
    ),
    reactBitsFloatingLinesTopWaveRotate: normalizeNumber(
      input.reactBitsFloatingLinesTopWaveRotate,
      fallback.reactBitsFloatingLinesTopWaveRotate,
      -4,
      4,
    ),
    reactBitsFloatingLinesMiddleWaveX: normalizeNumber(
      input.reactBitsFloatingLinesMiddleWaveX,
      fallback.reactBitsFloatingLinesMiddleWaveX,
      -20,
      20,
    ),
    reactBitsFloatingLinesMiddleWaveY: normalizeNumber(
      input.reactBitsFloatingLinesMiddleWaveY,
      fallback.reactBitsFloatingLinesMiddleWaveY,
      -4,
      4,
    ),
    reactBitsFloatingLinesMiddleWaveRotate: normalizeNumber(
      input.reactBitsFloatingLinesMiddleWaveRotate,
      fallback.reactBitsFloatingLinesMiddleWaveRotate,
      -4,
      4,
    ),
    reactBitsFloatingLinesBottomWaveX: normalizeNumber(
      input.reactBitsFloatingLinesBottomWaveX,
      fallback.reactBitsFloatingLinesBottomWaveX,
      -20,
      20,
    ),
    reactBitsFloatingLinesBottomWaveY: normalizeNumber(
      input.reactBitsFloatingLinesBottomWaveY,
      fallback.reactBitsFloatingLinesBottomWaveY,
      -4,
      4,
    ),
    reactBitsFloatingLinesBottomWaveRotate: normalizeNumber(
      input.reactBitsFloatingLinesBottomWaveRotate,
      fallback.reactBitsFloatingLinesBottomWaveRotate,
      -4,
      4,
    ),
    reactBitsFloatingLinesAnimationSpeed: normalizeNumber(
      input.reactBitsFloatingLinesAnimationSpeed,
      fallback.reactBitsFloatingLinesAnimationSpeed,
      0,
      4,
    ),
    reactBitsFloatingLinesInteractive: typeof input.reactBitsFloatingLinesInteractive === "boolean"
      ? input.reactBitsFloatingLinesInteractive
      : fallback.reactBitsFloatingLinesInteractive,
    reactBitsFloatingLinesBendRadius: normalizeNumber(
      input.reactBitsFloatingLinesBendRadius,
      fallback.reactBitsFloatingLinesBendRadius,
      0.1,
      20,
    ),
    reactBitsFloatingLinesBendStrength: normalizeNumber(
      input.reactBitsFloatingLinesBendStrength,
      fallback.reactBitsFloatingLinesBendStrength,
      -2,
      2,
    ),
    reactBitsFloatingLinesMouseDamping: normalizeNumber(
      input.reactBitsFloatingLinesMouseDamping,
      fallback.reactBitsFloatingLinesMouseDamping,
      0.01,
      1,
    ),
    reactBitsFloatingLinesParallax: typeof input.reactBitsFloatingLinesParallax === "boolean"
      ? input.reactBitsFloatingLinesParallax
      : fallback.reactBitsFloatingLinesParallax,
    reactBitsFloatingLinesParallaxStrength: normalizeNumber(
      input.reactBitsFloatingLinesParallaxStrength,
      fallback.reactBitsFloatingLinesParallaxStrength,
      0,
      1,
    ),
    reactBitsFloatingLinesBlendMode: normalizeChoice(
      input.reactBitsFloatingLinesBlendMode,
      fallback.reactBitsFloatingLinesBlendMode,
      ["screen", "normal", "lighten", "plus-lighter"],
    ),
    eldoraNovatrixPaletteMode: normalizeChoice(
      input.eldoraNovatrixPaletteMode,
      fallback.eldoraNovatrixPaletteMode,
      ["harmony", "custom"],
    ),
    eldoraNovatrixPrimaryColor: normalizeHexColor(
      input.eldoraNovatrixPrimaryColor,
      fallback.eldoraNovatrixPrimaryColor,
    ),
    eldoraNovatrixHarmony: normalizeChoice(
      input.eldoraNovatrixHarmony,
      fallback.eldoraNovatrixHarmony,
      COLOR_HARMONIES,
    ),
    eldoraNovatrixColor: normalizeHexColor(input.eldoraNovatrixColor, fallback.eldoraNovatrixColor),
    eldoraNovatrixSpeed: normalizeNumber(input.eldoraNovatrixSpeed, fallback.eldoraNovatrixSpeed, 0.02, 3),
    eldoraNovatrixAmplitude: normalizeNumber(
      input.eldoraNovatrixAmplitude,
      fallback.eldoraNovatrixAmplitude,
      0.01,
      0.45,
    ),
    eldoraHackerPaletteMode: normalizeChoice(
      input.eldoraHackerPaletteMode,
      fallback.eldoraHackerPaletteMode,
      ["harmony", "custom"],
    ),
    eldoraHackerPrimaryColor: normalizeHexColor(
      input.eldoraHackerPrimaryColor,
      fallback.eldoraHackerPrimaryColor,
    ),
    eldoraHackerHarmony: normalizeChoice(
      input.eldoraHackerHarmony,
      fallback.eldoraHackerHarmony,
      COLOR_HARMONIES,
    ),
    eldoraHackerColor: normalizeHexColor(input.eldoraHackerColor, fallback.eldoraHackerColor),
    eldoraHackerSpeed: normalizeNumber(input.eldoraHackerSpeed, fallback.eldoraHackerSpeed, 0.05, 3),
    eldoraHackerFontSize: normalizeInteger(input.eldoraHackerFontSize, fallback.eldoraHackerFontSize, 8, 28),
    eldoraPhotonBeamPaletteMode: normalizeChoice(
      input.eldoraPhotonBeamPaletteMode,
      fallback.eldoraPhotonBeamPaletteMode,
      ["custom", "harmony"],
    ),
    eldoraPhotonBeamPrimaryColor: normalizeHexColor(
      input.eldoraPhotonBeamPrimaryColor,
      fallback.eldoraPhotonBeamPrimaryColor,
    ),
    eldoraPhotonBeamHarmony: normalizeChoice(
      input.eldoraPhotonBeamHarmony,
      fallback.eldoraPhotonBeamHarmony,
      COLOR_HARMONIES,
    ),
    eldoraPhotonBeamColorBg: normalizeHexColor(input.eldoraPhotonBeamColorBg, fallback.eldoraPhotonBeamColorBg),
    eldoraPhotonBeamColorLine: normalizeHexColor(input.eldoraPhotonBeamColorLine, fallback.eldoraPhotonBeamColorLine),
    eldoraPhotonBeamColorSignal: normalizeHexColor(input.eldoraPhotonBeamColorSignal, fallback.eldoraPhotonBeamColorSignal),
    eldoraPhotonBeamUseColor2:
      typeof input.eldoraPhotonBeamUseColor2 === "boolean"
        ? input.eldoraPhotonBeamUseColor2
        : fallback.eldoraPhotonBeamUseColor2,
    eldoraPhotonBeamColorSignal2: normalizeHexColor(
      input.eldoraPhotonBeamColorSignal2,
      fallback.eldoraPhotonBeamColorSignal2,
    ),
    eldoraPhotonBeamUseColor3:
      typeof input.eldoraPhotonBeamUseColor3 === "boolean"
        ? input.eldoraPhotonBeamUseColor3
        : fallback.eldoraPhotonBeamUseColor3,
    eldoraPhotonBeamColorSignal3: normalizeHexColor(
      input.eldoraPhotonBeamColorSignal3,
      fallback.eldoraPhotonBeamColorSignal3,
    ),
    eldoraPhotonBeamLineCount: normalizeInteger(input.eldoraPhotonBeamLineCount, fallback.eldoraPhotonBeamLineCount, 12, 160),
    eldoraPhotonBeamSpreadHeight: normalizeNumber(input.eldoraPhotonBeamSpreadHeight, fallback.eldoraPhotonBeamSpreadHeight, 5, 90),
    eldoraPhotonBeamSpreadDepth: normalizeNumber(input.eldoraPhotonBeamSpreadDepth, fallback.eldoraPhotonBeamSpreadDepth, 0, 60),
    eldoraPhotonBeamCurveLength: normalizeNumber(input.eldoraPhotonBeamCurveLength, fallback.eldoraPhotonBeamCurveLength, 16, 120),
    eldoraPhotonBeamStraightLength: normalizeNumber(input.eldoraPhotonBeamStraightLength, fallback.eldoraPhotonBeamStraightLength, 40, 220),
    eldoraPhotonBeamCurvePower: normalizeNumber(input.eldoraPhotonBeamCurvePower, fallback.eldoraPhotonBeamCurvePower, 0.2, 2),
    eldoraPhotonBeamWaveSpeed: normalizeNumber(input.eldoraPhotonBeamWaveSpeed, fallback.eldoraPhotonBeamWaveSpeed, 0, 8),
    eldoraPhotonBeamWaveHeight: normalizeNumber(input.eldoraPhotonBeamWaveHeight, fallback.eldoraPhotonBeamWaveHeight, 0, 1),
    eldoraPhotonBeamLineOpacity: normalizeNumber(input.eldoraPhotonBeamLineOpacity, fallback.eldoraPhotonBeamLineOpacity, 0.05, 1),
    eldoraPhotonBeamSignalCount: normalizeInteger(input.eldoraPhotonBeamSignalCount, fallback.eldoraPhotonBeamSignalCount, 0, 220),
    eldoraPhotonBeamSpeedGlobal: normalizeNumber(input.eldoraPhotonBeamSpeedGlobal, fallback.eldoraPhotonBeamSpeedGlobal, 0.02, 2),
    eldoraPhotonBeamTrailLength: normalizeInteger(input.eldoraPhotonBeamTrailLength, fallback.eldoraPhotonBeamTrailLength, 1, 16),
    eldoraPhotonBeamBloomStrength: normalizeNumber(input.eldoraPhotonBeamBloomStrength, fallback.eldoraPhotonBeamBloomStrength, 0, 6),
    eldoraPhotonBeamBloomRadius: normalizeNumber(input.eldoraPhotonBeamBloomRadius, fallback.eldoraPhotonBeamBloomRadius, 0, 1.5),
    aceternity3DGlobeViewStyle: normalizeAceternity3DGlobeViewStyle(
      input.aceternity3DGlobeViewStyle,
      fallback.aceternity3DGlobeViewStyle,
    ),
    aceternity3DGlobeBackgroundColor: normalizeHexColor(
      input.aceternity3DGlobeBackgroundColor,
      fallback.aceternity3DGlobeBackgroundColor,
    ),
    aceternity3DGlobeGlobeColor: normalizeHexColor(
      input.aceternity3DGlobeGlobeColor,
      fallback.aceternity3DGlobeGlobeColor,
    ),
    aceternity3DGlobeGraphicMapColor: normalizeHexColor(
      input.aceternity3DGlobeGraphicMapColor,
      fallback.aceternity3DGlobeGraphicMapColor,
    ),
    aceternity3DGlobeGraphicGlowColor: normalizeHexColor(
      input.aceternity3DGlobeGraphicGlowColor,
      fallback.aceternity3DGlobeGraphicGlowColor,
    ),
    aceternity3DGlobeGraphicMarkerColor: normalizeHexColor(
      input.aceternity3DGlobeGraphicMarkerColor,
      fallback.aceternity3DGlobeGraphicMarkerColor,
    ),
    aceternity3DGlobeGraphicMapSamples: normalizeInteger(
      input.aceternity3DGlobeGraphicMapSamples,
      fallback.aceternity3DGlobeGraphicMapSamples,
      ACETERNITY_3D_GLOBE_GRAPHIC_MAP_SAMPLES_MIN,
      ACETERNITY_3D_GLOBE_GRAPHIC_MAP_SAMPLES_MAX,
    ),
    aceternity3DGlobeAutoRotateSpeed: normalizeNumber(
      input.aceternity3DGlobeAutoRotateSpeed,
      fallback.aceternity3DGlobeAutoRotateSpeed,
      0.01,
      2,
    ),
    // Reverse spin is a fixed product default; ignore legacy persisted toggle values.
    aceternity3DGlobeReverseSpin: true,
    aceternity3DGlobeScale: normalizeNumber(
      input.aceternity3DGlobeScale,
      fallback.aceternity3DGlobeScale,
      ACETERNITY_3D_GLOBE_MIN_SCALE,
      ACETERNITY_3D_GLOBE_MAX_SCALE,
    ),
    aceternity3DGlobeBumpScale: normalizeNumber(input.aceternity3DGlobeBumpScale, fallback.aceternity3DGlobeBumpScale, 0, 3),
    aceternity3DGlobeAmbientIntensity: normalizeNumber(
      input.aceternity3DGlobeAmbientIntensity,
      fallback.aceternity3DGlobeAmbientIntensity,
      0,
      2,
    ),
    aceternity3DGlobePointLightIntensity: normalizeNumber(
      input.aceternity3DGlobePointLightIntensity,
      fallback.aceternity3DGlobePointLightIntensity,
      0,
      4,
    ),
    aceternity3DGlobeLightingMode: normalizeAceternity3DGlobeLightingMode(
      input.aceternity3DGlobeLightingMode,
      fallback.aceternity3DGlobeLightingMode,
    ),
    aceternity3DGlobeEnablePan:
      typeof input.aceternity3DGlobeEnablePan === "boolean"
        ? input.aceternity3DGlobeEnablePan
        : fallback.aceternity3DGlobeEnablePan,
    aceternity3DGlobePanX: normalizeNumber(
      input.aceternity3DGlobePanX,
      fallback.aceternity3DGlobePanX,
      -50,
      50,
    ),
    aceternity3DGlobePanY: normalizeNumber(
      input.aceternity3DGlobePanY,
      fallback.aceternity3DGlobePanY,
      -50,
      50,
    ),
    // Earth tilt is a fixed product default; ignore legacy persisted toggle values.
    aceternity3DGlobeShowTilt: true,
    aceternity3DGlobeShowAtmosphere:
      typeof input.aceternity3DGlobeShowAtmosphere === "boolean"
        ? input.aceternity3DGlobeShowAtmosphere
        : fallback.aceternity3DGlobeShowAtmosphere,
    aceternity3DGlobeAtmosphereColor: normalizeHexColor(
      input.aceternity3DGlobeAtmosphereColor,
      fallback.aceternity3DGlobeAtmosphereColor,
    ),
    aceternity3DGlobeAtmosphereIntensity: normalizeNumber(
      input.aceternity3DGlobeAtmosphereIntensity,
      fallback.aceternity3DGlobeAtmosphereIntensity,
      0,
      2,
    ),
    aceternity3DGlobeAtmosphereBlur: normalizeNumber(
      input.aceternity3DGlobeAtmosphereBlur,
      fallback.aceternity3DGlobeAtmosphereBlur,
      0.5,
      5,
    ),
    aceternity3DGlobeShowWireframe:
      typeof input.aceternity3DGlobeShowWireframe === "boolean"
        ? input.aceternity3DGlobeShowWireframe
        : fallback.aceternity3DGlobeShowWireframe,
    aceternity3DGlobeWireframeColor: normalizeHexColor(
      input.aceternity3DGlobeWireframeColor,
      fallback.aceternity3DGlobeWireframeColor,
    ),
    aceternity3DGlobeMarkerEnabled:
      typeof input.aceternity3DGlobeMarkerEnabled === "boolean"
        ? input.aceternity3DGlobeMarkerEnabled
        : fallback.aceternity3DGlobeMarkerEnabled,
    aceternity3DGlobeMarkerLat: normalizeNumber(
      input.aceternity3DGlobeMarkerLat,
      fallback.aceternity3DGlobeMarkerLat,
      -90,
      90,
    ),
    aceternity3DGlobeMarkerLng: normalizeNumber(
      input.aceternity3DGlobeMarkerLng,
      fallback.aceternity3DGlobeMarkerLng,
      -180,
      180,
    ),
    aceternity3DGlobeMarkerLabel: normalizeOptionalShortString(
      input.aceternity3DGlobeMarkerLabel,
      fallback.aceternity3DGlobeMarkerLabel,
      80,
    ),
    aceternity3DGlobeMarkerIcon: normalizeChoice(
      input.aceternity3DGlobeMarkerIcon,
      fallback.aceternity3DGlobeMarkerIcon,
      ["pin", "person", "heart", "star", "home"],
    ),
    aceternity3DGlobeMarkerSize: normalizeNumber(
      input.aceternity3DGlobeMarkerSize,
      fallback.aceternity3DGlobeMarkerSize,
      0.03,
      0.16,
    ),
    magicRetroGridBackgroundColor: normalizeHexColor(
      input.magicRetroGridBackgroundColor,
      fallback.magicRetroGridBackgroundColor,
    ),
    magicRetroGridLightLineColor: normalizeHexColor(
      input.magicRetroGridLightLineColor,
      fallback.magicRetroGridLightLineColor,
    ),
    magicRetroGridDarkLineColor: normalizeHexColor(
      input.magicRetroGridDarkLineColor,
      fallback.magicRetroGridDarkLineColor,
    ),
    magicRetroGridAngle: normalizeNumber(input.magicRetroGridAngle, fallback.magicRetroGridAngle, 1, 89),
    magicRetroGridCellSize: normalizeNumber(input.magicRetroGridCellSize, fallback.magicRetroGridCellSize, 12, 160),
    magicRetroGridOpacity: normalizeNumber(input.magicRetroGridOpacity, fallback.magicRetroGridOpacity, 0.05, 1),
    magicLightRaysBackgroundColor: normalizeHexColor(
      input.magicLightRaysBackgroundColor,
      fallback.magicLightRaysBackgroundColor,
    ),
    magicLightRaysColor: normalizeHexColor(input.magicLightRaysColor, fallback.magicLightRaysColor),
    magicLightRaysCount: normalizeInteger(input.magicLightRaysCount, fallback.magicLightRaysCount, 1, 20),
    magicLightRaysBlur: normalizeNumber(input.magicLightRaysBlur, fallback.magicLightRaysBlur, 0, 80),
    magicLightRaysSpeed: normalizeNumber(input.magicLightRaysSpeed, fallback.magicLightRaysSpeed, 2, 40),
    magicLightRaysLength: normalizeNumber(input.magicLightRaysLength, fallback.magicLightRaysLength, 24, 120),
    magicLightRaysOpacity: normalizeNumber(input.magicLightRaysOpacity, fallback.magicLightRaysOpacity, 0.05, 1),
    chamaacSynthesisPaletteMode: normalizeChoice(
      input.chamaacSynthesisPaletteMode,
      fallback.chamaacSynthesisPaletteMode,
      ["harmony", "custom"],
    ),
    chamaacSynthesisPrimaryColor: normalizeHexColor(
      input.chamaacSynthesisPrimaryColor,
      fallback.chamaacSynthesisPrimaryColor,
    ),
    chamaacSynthesisHarmony: normalizeChoice(
      input.chamaacSynthesisHarmony,
      fallback.chamaacSynthesisHarmony,
      COLOR_HARMONIES,
    ),
    chamaacSynthesisColorOne: normalizeHexColor(input.chamaacSynthesisColorOne, fallback.chamaacSynthesisColorOne),
    chamaacSynthesisColorTwo: normalizeHexColor(input.chamaacSynthesisColorTwo, fallback.chamaacSynthesisColorTwo),
    chamaacSynthesisColorThree: normalizeHexColor(input.chamaacSynthesisColorThree, fallback.chamaacSynthesisColorThree),
    chamaacSynthesisSpeed: normalizeNumber(input.chamaacSynthesisSpeed, fallback.chamaacSynthesisSpeed, 0.004, 2),
    chamaacSynthesisComplexity: normalizeInteger(input.chamaacSynthesisComplexity, fallback.chamaacSynthesisComplexity, 1, 20),
    chamaacSynthesisScale: normalizeNumber(input.chamaacSynthesisScale, fallback.chamaacSynthesisScale, 0.1, 5),
    chamaacSynthesisDistortion: normalizeNumber(input.chamaacSynthesisDistortion, fallback.chamaacSynthesisDistortion, 0, 2),
    chamaacSynthesisGlowIntensity: normalizeNumber(input.chamaacSynthesisGlowIntensity, fallback.chamaacSynthesisGlowIntensity, 0, 2),
    chamaacSynthesisFlowFrequency: normalizeNumber(input.chamaacSynthesisFlowFrequency, fallback.chamaacSynthesisFlowFrequency, 0.5, 10),
    backgroundLinesDuration: normalizeNumber(input.backgroundLinesDuration, fallback.backgroundLinesDuration, 4, 18),
    shootingStarsStarColor: normalizeHexColor(input.shootingStarsStarColor, fallback.shootingStarsStarColor),
    shootingStarsTrailColor: normalizeHexColor(input.shootingStarsTrailColor, fallback.shootingStarsTrailColor),
    shootingStarsShootingStarColor: normalizeHexColor(input.shootingStarsShootingStarColor, fallback.shootingStarsShootingStarColor),
    shootingStarsDensity: normalizeNumber(input.shootingStarsDensity, fallback.shootingStarsDensity, 0.00005, 0.00035),
    shootingStarsTwinkle:
      typeof input.shootingStarsTwinkle === "boolean" ? input.shootingStarsTwinkle : fallback.shootingStarsTwinkle,
    shootingStarsTwinkleSpeed: normalizeNumber(input.shootingStarsTwinkleSpeed, fallback.shootingStarsTwinkleSpeed, 0.4, 2.5),
    shootingStarsShootingSpeed: normalizeNumber(input.shootingStarsShootingSpeed, fallback.shootingStarsShootingSpeed, 0.5, 2),
    shootingStarsFrequency: normalizeNumber(input.shootingStarsFrequency, fallback.shootingStarsFrequency, 0.4, 2),
    canvasRevealDotsBackgroundColor: normalizeHexColor(input.canvasRevealDotsBackgroundColor, fallback.canvasRevealDotsBackgroundColor),
    canvasRevealDotsDotColor: normalizeHexColor(input.canvasRevealDotsDotColor, fallback.canvasRevealDotsDotColor),
    canvasRevealDotsAccentColor: normalizeHexColor(input.canvasRevealDotsAccentColor, fallback.canvasRevealDotsAccentColor),
    canvasRevealDotsDotSize: normalizeNumber(input.canvasRevealDotsDotSize, fallback.canvasRevealDotsDotSize, 1, 5),
    canvasRevealDotsDotSpacing: normalizeNumber(input.canvasRevealDotsDotSpacing, fallback.canvasRevealDotsDotSpacing, 4, 24),
    canvasRevealDotsOpacity: normalizeNumber(input.canvasRevealDotsOpacity, fallback.canvasRevealDotsOpacity, 0.08, 1),
    canvasRevealDotsAnimationSpeed: normalizeNumber(input.canvasRevealDotsAnimationSpeed, fallback.canvasRevealDotsAnimationSpeed, 0.1, 1),
    canvasRevealDotsShowGradient:
      typeof input.canvasRevealDotsShowGradient === "boolean" ? input.canvasRevealDotsShowGradient : fallback.canvasRevealDotsShowGradient,
    spotlightColor: normalizeHexColor(input.spotlightColor, fallback.spotlightColor),
    spotlightOpacity: normalizeNumber(input.spotlightOpacity, fallback.spotlightOpacity, 0.25, 1.5),
    spotlightWidth: normalizeNumber(input.spotlightWidth, fallback.spotlightWidth, 240, 900),
    spotlightHeight: normalizeNumber(input.spotlightHeight, fallback.spotlightHeight, 600, 1800),
    spotlightSmallWidth: normalizeNumber(input.spotlightSmallWidth, fallback.spotlightSmallWidth, 120, 420),
    spotlightTranslateY: normalizeNumber(input.spotlightTranslateY, fallback.spotlightTranslateY, -650, 120),
    spotlightDuration: normalizeNumber(input.spotlightDuration, fallback.spotlightDuration, 3, 16),
    spotlightXOffset: normalizeNumber(input.spotlightXOffset, fallback.spotlightXOffset, 0, 220),
    lampBackgroundColor: normalizeHexColor(input.lampBackgroundColor, fallback.lampBackgroundColor),
    lampColor: normalizeHexColor(input.lampColor, fallback.lampColor),
    lampGlowOpacity: normalizeNumber(input.lampGlowOpacity, fallback.lampGlowOpacity, 0.18, 0.95),
    lampBeamWidth: normalizeNumber(input.lampBeamWidth, fallback.lampBeamWidth, 240, 900),
    lampGlowWidth: normalizeNumber(input.lampGlowWidth, fallback.lampGlowWidth, 180, 900),
    lampVerticalOffset: normalizeNumber(input.lampVerticalOffset, fallback.lampVerticalOffset, -320, 160),
    lampPulseSpeed: normalizeNumber(input.lampPulseSpeed, fallback.lampPulseSpeed, 4, 18),
    vortexBackgroundColor: normalizeHexColor(input.vortexBackgroundColor, fallback.vortexBackgroundColor),
    vortexBaseHue: normalizeNumber(input.vortexBaseHue, fallback.vortexBaseHue, 0, 360),
    vortexParticleCount: normalizeInteger(input.vortexParticleCount, fallback.vortexParticleCount, 120, 700),
    vortexRangeY: normalizeNumber(input.vortexRangeY, fallback.vortexRangeY, 40, 220),
    vortexBaseSpeed: normalizeNumber(input.vortexBaseSpeed, fallback.vortexBaseSpeed, 0, 1),
    vortexRangeSpeed: normalizeNumber(input.vortexRangeSpeed, fallback.vortexRangeSpeed, 0.2, 2),
    vortexBaseRadius: normalizeNumber(input.vortexBaseRadius, fallback.vortexBaseRadius, 0.5, 2.5),
    vortexRangeRadius: normalizeNumber(input.vortexRangeRadius, fallback.vortexRangeRadius, 0.5, 4),
    wavyBackgroundFill: normalizeHexColor(input.wavyBackgroundFill, fallback.wavyBackgroundFill),
    wavyColorOne: normalizeHexColor(input.wavyColorOne, fallback.wavyColorOne),
    wavyColorTwo: normalizeHexColor(input.wavyColorTwo, fallback.wavyColorTwo),
    wavyColorThree: normalizeHexColor(input.wavyColorThree, fallback.wavyColorThree),
    wavyColorFour: normalizeHexColor(input.wavyColorFour, fallback.wavyColorFour),
    wavyColorFive: normalizeHexColor(input.wavyColorFive, fallback.wavyColorFive),
    wavyWaveWidth: normalizeNumber(input.wavyWaveWidth, fallback.wavyWaveWidth, 10, 90),
    wavyBlur: normalizeNumber(input.wavyBlur, fallback.wavyBlur, 0, 20),
    wavySpeed: input.wavySpeed === "slow" || input.wavySpeed === "fast" ? input.wavySpeed : fallback.wavySpeed,
    wavyWaveOpacity: normalizeNumber(input.wavyWaveOpacity, fallback.wavyWaveOpacity, 0.15, 0.85),
    auroraBarsBackgroundColor: normalizeHexColor(input.auroraBarsBackgroundColor, fallback.auroraBarsBackgroundColor),
    auroraBarsPaletteMode: normalizeChoice(input.auroraBarsPaletteMode, fallback.auroraBarsPaletteMode, ["auto", "custom"]),
    auroraBarsPrimaryColor: normalizeHexColor(input.auroraBarsPrimaryColor, fallback.auroraBarsPrimaryColor),
    auroraBarsColorOne: normalizeHexColor(input.auroraBarsColorOne, fallback.auroraBarsColorOne),
    auroraBarsColorTwo: normalizeHexColor(input.auroraBarsColorTwo, fallback.auroraBarsColorTwo),
    auroraBarsColorThree: normalizeHexColor(input.auroraBarsColorThree, fallback.auroraBarsColorThree),
    auroraBarsColorFour: normalizeHexColor(input.auroraBarsColorFour, fallback.auroraBarsColorFour),
    auroraBarsColorFive: normalizeHexColor(input.auroraBarsColorFive, fallback.auroraBarsColorFive),
    auroraBarsBarCount: normalizeInteger(input.auroraBarsBarCount, fallback.auroraBarsBarCount, 8, 80),
    auroraBarsSpeed: normalizeNumber(input.auroraBarsSpeed, fallback.auroraBarsSpeed, 0.08, 2),
    auroraBarsBlur: normalizeNumber(input.auroraBarsBlur, fallback.auroraBarsBlur, 0, 18),
    auroraBarsGap: normalizeNumber(input.auroraBarsGap, fallback.auroraBarsGap, 0, 16),
    auroraBarsMaxHeightRatio: normalizeNumber(input.auroraBarsMaxHeightRatio, fallback.auroraBarsMaxHeightRatio, 0.1, 1),
    auroraBarsMinHeightRatio: normalizeNumber(input.auroraBarsMinHeightRatio, fallback.auroraBarsMinHeightRatio, 0.04, 0.78),
    pixelLiquidBackgroundColor: normalizeHexColor(input.pixelLiquidBackgroundColor, pixelLiquidPreset.backgroundColor),
    pixelLiquidBaseColor: normalizeHexColor(input.pixelLiquidBaseColor, pixelLiquidPreset.baseColor),
    pixelLiquidAccentColor: normalizeHexColor(input.pixelLiquidAccentColor, pixelLiquidPreset.accentColor),
    pixelLiquidHighlightColor: normalizeHexColor(input.pixelLiquidHighlightColor, pixelLiquidPreset.highlightColor),
    pixelLiquidPalette,
    pixelLiquidPixelSize: normalizeNumber(input.pixelLiquidPixelSize, fallback.pixelLiquidPixelSize, 4, 18),
    pixelLiquidDetail: normalizeChoice(input.pixelLiquidDetail, fallback.pixelLiquidDetail, ["low", "medium", "high"]),
    pixelLiquidCursorForce: normalizeNumber(input.pixelLiquidCursorForce, fallback.pixelLiquidCursorForce, 0, 1),
    pixelLiquidCursorSize: normalizeNumber(input.pixelLiquidCursorSize, fallback.pixelLiquidCursorSize, 0.04, 0.24),
    pixelLiquidAutoDemo:
      typeof input.pixelLiquidAutoDemo === "boolean" ? input.pixelLiquidAutoDemo : fallback.pixelLiquidAutoDemo,
    pixelLiquidMotionSpeed: normalizeNumber(input.pixelLiquidMotionSpeed, fallback.pixelLiquidMotionSpeed, 0.2, 1.4),
    tileGridPaletteMode: normalizeChoice(input.tileGridPaletteMode, fallback.tileGridPaletteMode, ["auto", "custom"]),
    tileGridPrimaryColor: normalizeHexColor(input.tileGridPrimaryColor, fallback.tileGridPrimaryColor),
    tileGridColorOne: normalizeHexColor(input.tileGridColorOne, fallback.tileGridColorOne),
    tileGridColorTwo: normalizeHexColor(input.tileGridColorTwo, fallback.tileGridColorTwo),
    tileGridColorThree: normalizeHexColor(input.tileGridColorThree, fallback.tileGridColorThree),
    tileGridColorFour: normalizeHexColor(input.tileGridColorFour, fallback.tileGridColorFour),
    tileGridColorFive: normalizeHexColor(input.tileGridColorFive, fallback.tileGridColorFive),
    tileGridTileSize: normalizeNumber(input.tileGridTileSize, fallback.tileGridTileSize, 18, 120),
    tileGridJointSize: normalizeNumber(input.tileGridJointSize, fallback.tileGridJointSize, 1, 10),
    tileGridChangeFrequency: clampTileGridFadeSeconds(input.tileGridChangeFrequency, fallback.tileGridChangeFrequency),
    tileGridActivePercent: normalizeNumber(input.tileGridActivePercent, fallback.tileGridActivePercent, 1, 60),
    tileGridOpacity: normalizeNumber(input.tileGridOpacity, fallback.tileGridOpacity, 0.15, 1),
    hexGridPrimaryColor: normalizeHexColor(input.hexGridPrimaryColor, fallback.hexGridPrimaryColor),
    hexGridHarmony: normalizeChoice(input.hexGridHarmony, fallback.hexGridHarmony, COLOR_HARMONIES),
    hexGridHexSize: normalizeNumber(input.hexGridHexSize, fallback.hexGridHexSize, 18, 120),
    hexGridJointSize: normalizeNumber(input.hexGridJointSize, fallback.hexGridJointSize, 1, 10),
    hexGridChangeFrequency: clampTileGridFadeSeconds(input.hexGridChangeFrequency, fallback.hexGridChangeFrequency),
    hexGridActivePercent: normalizeNumber(input.hexGridActivePercent, fallback.hexGridActivePercent, 1, 60),
    hexGridOpacity: normalizeNumber(input.hexGridOpacity, fallback.hexGridOpacity, 0.15, 1),
  }

  return migrateLegacyCanvasRevealDotsDefaults(sanitizedSettings)
}

function migrateLegacyCanvasRevealDotsDefaults(settings) {
  // The first Canvas Reveal pass shipped as a teal CSS grid; migrate only that exact untouched default.
  const isLegacyCanvasRevealDotsDefault = Object.entries(LEGACY_CANVAS_REVEAL_DOTS_DEFAULTS).every(
    ([key, value]) => settings[key] === value,
  )

  if (!isLegacyCanvasRevealDotsDefault) {
    return settings
  }

  return {
    ...settings,
    canvasRevealDotsBackgroundColor: DEFAULT_CHIMER_SETTINGS.canvasRevealDotsBackgroundColor,
    canvasRevealDotsDotColor: DEFAULT_CHIMER_SETTINGS.canvasRevealDotsDotColor,
    canvasRevealDotsAccentColor: DEFAULT_CHIMER_SETTINGS.canvasRevealDotsAccentColor,
    canvasRevealDotsDotSize: DEFAULT_CHIMER_SETTINGS.canvasRevealDotsDotSize,
    canvasRevealDotsDotSpacing: DEFAULT_CHIMER_SETTINGS.canvasRevealDotsDotSpacing,
    canvasRevealDotsOpacity: DEFAULT_CHIMER_SETTINGS.canvasRevealDotsOpacity,
    canvasRevealDotsAnimationSpeed: DEFAULT_CHIMER_SETTINGS.canvasRevealDotsAnimationSpeed,
    canvasRevealDotsShowGradient: DEFAULT_CHIMER_SETTINGS.canvasRevealDotsShowGradient,
  }
}

export function sanitizeChimerSettingsForEntitlements(input = {}, features = []) {
  const settings = sanitizeChimerSettings(input)
  const canUsePremiumBackgrounds = hasPremiumBackgroundAccess(features)

  if (hasFeature(features, FEATURE_KEYS.chimerCustomColors) && canUsePremiumBackgrounds) {
    return settings
  }

  const sanitizedSettings = {
    ...settings,
    ...(!hasFeature(features, FEATURE_KEYS.chimerCustomColors) ? {
      primaryFontColor: DEFAULT_CHIMER_SETTINGS.primaryFontColor,
      secondaryFontColor: DEFAULT_CHIMER_SETTINGS.secondaryFontColor,
      clockModeFontColor: DEFAULT_CHIMER_SETTINGS.clockModeFontColor,
      movingBackgroundMainColor: DEFAULT_CHIMER_SETTINGS.movingBackgroundMainColor,
      movingBackgroundOrbColor: DEFAULT_CHIMER_SETTINGS.movingBackgroundOrbColor,
    } : {}),
    ...(!canUsePremiumBackgrounds ? {
      backgroundId: DEFAULT_CHIMER_SETTINGS.backgroundId,
      sparklesMaxSize: DEFAULT_CHIMER_SETTINGS.sparklesMaxSize,
      sparklesMinSize: DEFAULT_CHIMER_SETTINGS.sparklesMinSize,
      sparklesParticleColor: DEFAULT_CHIMER_SETTINGS.sparklesParticleColor,
      sparklesParticleDensity: DEFAULT_CHIMER_SETTINGS.sparklesParticleDensity,
      sparklesSpeed: DEFAULT_CHIMER_SETTINGS.sparklesSpeed,
      gradientAnimationBackgroundStartColor: DEFAULT_CHIMER_SETTINGS.gradientAnimationBackgroundStartColor,
      gradientAnimationBackgroundEndColor: DEFAULT_CHIMER_SETTINGS.gradientAnimationBackgroundEndColor,
      gradientAnimationFirstColor: DEFAULT_CHIMER_SETTINGS.gradientAnimationFirstColor,
      gradientAnimationSecondColor: DEFAULT_CHIMER_SETTINGS.gradientAnimationSecondColor,
      gradientAnimationThirdColor: DEFAULT_CHIMER_SETTINGS.gradientAnimationThirdColor,
      gradientAnimationFourthColor: DEFAULT_CHIMER_SETTINGS.gradientAnimationFourthColor,
      gradientAnimationFifthColor: DEFAULT_CHIMER_SETTINGS.gradientAnimationFifthColor,
      gradientAnimationSpeed: DEFAULT_CHIMER_SETTINGS.gradientAnimationSpeed,
      gradientAnimationSize: DEFAULT_CHIMER_SETTINGS.gradientAnimationSize,
      animateUiGradientPrimaryColor: DEFAULT_CHIMER_SETTINGS.animateUiGradientPrimaryColor,
      animateUiGradientHarmony: DEFAULT_CHIMER_SETTINGS.animateUiGradientHarmony,
      animateUiGradientOpacity: DEFAULT_CHIMER_SETTINGS.animateUiGradientOpacity,
      animateUiStarsColor: DEFAULT_CHIMER_SETTINGS.animateUiStarsColor,
      animateUiStarsSpeed: DEFAULT_CHIMER_SETTINGS.animateUiStarsSpeed,
      animateUiStarsDensity: DEFAULT_CHIMER_SETTINGS.animateUiStarsDensity,
      animateUiStarsParallax: DEFAULT_CHIMER_SETTINGS.animateUiStarsParallax,
      animateUiHoleStrokeColor: DEFAULT_CHIMER_SETTINGS.animateUiHoleStrokeColor,
      animateUiHoleParticleColor: DEFAULT_CHIMER_SETTINGS.animateUiHoleParticleColor,
      animateUiHoleLineCount: DEFAULT_CHIMER_SETTINGS.animateUiHoleLineCount,
      animateUiHoleDiscCount: DEFAULT_CHIMER_SETTINGS.animateUiHoleDiscCount,
      chamaacLightSpeedWarpSpeed: DEFAULT_CHIMER_SETTINGS.chamaacLightSpeedWarpSpeed,
      chamaacLightSpeedWarpSpeedVersion: DEFAULT_CHIMER_SETTINGS.chamaacLightSpeedWarpSpeedVersion,
      chamaacLightSpeedParticleCount: DEFAULT_CHIMER_SETTINGS.chamaacLightSpeedParticleCount,
      chamaacLightSpeedLightColor: DEFAULT_CHIMER_SETTINGS.chamaacLightSpeedLightColor,
      chamaacLightSpeedIntensity: DEFAULT_CHIMER_SETTINGS.chamaacLightSpeedIntensity,
      chamaacLightSpeedRadius: DEFAULT_CHIMER_SETTINGS.chamaacLightSpeedRadius,
      chamaacLightSpeedCylinderLength: DEFAULT_CHIMER_SETTINGS.chamaacLightSpeedCylinderLength,
      chamaacElectricMistColor: DEFAULT_CHIMER_SETTINGS.chamaacElectricMistColor,
      chamaacElectricMistSpeed: DEFAULT_CHIMER_SETTINGS.chamaacElectricMistSpeed,
      chamaacElectricMistControlVersion: DEFAULT_CHIMER_SETTINGS.chamaacElectricMistControlVersion,
      chamaacElectricMistDetail: DEFAULT_CHIMER_SETTINGS.chamaacElectricMistDetail,
      chamaacElectricMistDistortion: DEFAULT_CHIMER_SETTINGS.chamaacElectricMistDistortion,
      chamaacElectricMistBrightness: DEFAULT_CHIMER_SETTINGS.chamaacElectricMistBrightness,
      chamaacAstralFlowPaletteMode: DEFAULT_CHIMER_SETTINGS.chamaacAstralFlowPaletteMode,
      chamaacAstralFlowPrimaryColor: DEFAULT_CHIMER_SETTINGS.chamaacAstralFlowPrimaryColor,
      chamaacAstralFlowHarmony: DEFAULT_CHIMER_SETTINGS.chamaacAstralFlowHarmony,
      chamaacAstralFlowColorOne: DEFAULT_CHIMER_SETTINGS.chamaacAstralFlowColorOne,
      chamaacAstralFlowColorTwo: DEFAULT_CHIMER_SETTINGS.chamaacAstralFlowColorTwo,
      chamaacAstralFlowColorThree: DEFAULT_CHIMER_SETTINGS.chamaacAstralFlowColorThree,
      chamaacAstralFlowSpeed: DEFAULT_CHIMER_SETTINGS.chamaacAstralFlowSpeed,
      chamaacAstralFlowFlowMin: DEFAULT_CHIMER_SETTINGS.chamaacAstralFlowFlowMin,
      chamaacAstralFlowFlowMax: DEFAULT_CHIMER_SETTINGS.chamaacAstralFlowFlowMax,
      chamaacDeepSpaceNebulaPaletteMode: DEFAULT_CHIMER_SETTINGS.chamaacDeepSpaceNebulaPaletteMode,
      chamaacDeepSpaceNebulaPrimaryColor: DEFAULT_CHIMER_SETTINGS.chamaacDeepSpaceNebulaPrimaryColor,
      chamaacDeepSpaceNebulaHarmony: DEFAULT_CHIMER_SETTINGS.chamaacDeepSpaceNebulaHarmony,
      chamaacDeepSpaceNebulaColorOne: DEFAULT_CHIMER_SETTINGS.chamaacDeepSpaceNebulaColorOne,
      chamaacDeepSpaceNebulaColorTwo: DEFAULT_CHIMER_SETTINGS.chamaacDeepSpaceNebulaColorTwo,
      chamaacDeepSpaceNebulaColorThree: DEFAULT_CHIMER_SETTINGS.chamaacDeepSpaceNebulaColorThree,
      chamaacDeepSpaceNebulaSpeed: DEFAULT_CHIMER_SETTINGS.chamaacDeepSpaceNebulaSpeed,
      chamaacGridBloomColor: DEFAULT_CHIMER_SETTINGS.chamaacGridBloomColor,
      chamaacGridBloomSpeed: DEFAULT_CHIMER_SETTINGS.chamaacGridBloomSpeed,
      chamaacGridBloomGridScale: DEFAULT_CHIMER_SETTINGS.chamaacGridBloomGridScale,
      chamaacGridBloomRotationSpeed: DEFAULT_CHIMER_SETTINGS.chamaacGridBloomRotationSpeed,
      chamaacGridBloomFadeFalloff: DEFAULT_CHIMER_SETTINGS.chamaacGridBloomFadeFalloff,
      chamaacGridBloomDistortionAmount: DEFAULT_CHIMER_SETTINGS.chamaacGridBloomDistortionAmount,
      chamaacGridBloomFlowSpeedX: DEFAULT_CHIMER_SETTINGS.chamaacGridBloomFlowSpeedX,
      chamaacGridBloomFlowSpeedY: DEFAULT_CHIMER_SETTINGS.chamaacGridBloomFlowSpeedY,
      chamaacLiquidChromePaletteMode: DEFAULT_CHIMER_SETTINGS.chamaacLiquidChromePaletteMode,
      chamaacLiquidChromePrimaryColor: DEFAULT_CHIMER_SETTINGS.chamaacLiquidChromePrimaryColor,
      chamaacLiquidChromeHarmony: DEFAULT_CHIMER_SETTINGS.chamaacLiquidChromeHarmony,
      chamaacLiquidChromeColorOne: DEFAULT_CHIMER_SETTINGS.chamaacLiquidChromeColorOne,
      chamaacLiquidChromeColorTwo: DEFAULT_CHIMER_SETTINGS.chamaacLiquidChromeColorTwo,
      chamaacLiquidChromeFlowSpeed: DEFAULT_CHIMER_SETTINGS.chamaacLiquidChromeFlowSpeed,
      chamaacLiquidChromeTimeScale: DEFAULT_CHIMER_SETTINGS.chamaacLiquidChromeTimeScale,
      chamaacWavesPaletteMode: DEFAULT_CHIMER_SETTINGS.chamaacWavesPaletteMode,
      chamaacWavesPrimaryColor: DEFAULT_CHIMER_SETTINGS.chamaacWavesPrimaryColor,
      chamaacWavesHarmony: DEFAULT_CHIMER_SETTINGS.chamaacWavesHarmony,
      chamaacWavesBackgroundColor: DEFAULT_CHIMER_SETTINGS.chamaacWavesBackgroundColor,
      chamaacWavesColorOne: DEFAULT_CHIMER_SETTINGS.chamaacWavesColorOne,
      chamaacWavesColorTwo: DEFAULT_CHIMER_SETTINGS.chamaacWavesColorTwo,
      chamaacWavesColorThree: DEFAULT_CHIMER_SETTINGS.chamaacWavesColorThree,
      chamaacWavesSpeedX: DEFAULT_CHIMER_SETTINGS.chamaacWavesSpeedX,
      chamaacWavesSpeedY: DEFAULT_CHIMER_SETTINGS.chamaacWavesSpeedY,
      chamaacWavesAmplitude: DEFAULT_CHIMER_SETTINGS.chamaacWavesAmplitude,
      reactBitsFerrofluidPaletteMode: DEFAULT_CHIMER_SETTINGS.reactBitsFerrofluidPaletteMode,
      reactBitsFerrofluidPrimaryColor: DEFAULT_CHIMER_SETTINGS.reactBitsFerrofluidPrimaryColor,
      reactBitsFerrofluidHarmony: DEFAULT_CHIMER_SETTINGS.reactBitsFerrofluidHarmony,
      reactBitsFerrofluidColorOne: DEFAULT_CHIMER_SETTINGS.reactBitsFerrofluidColorOne,
      reactBitsFerrofluidColorTwo: DEFAULT_CHIMER_SETTINGS.reactBitsFerrofluidColorTwo,
      reactBitsFerrofluidColorThree: DEFAULT_CHIMER_SETTINGS.reactBitsFerrofluidColorThree,
      reactBitsFerrofluidSpeed: DEFAULT_CHIMER_SETTINGS.reactBitsFerrofluidSpeed,
      reactBitsFerrofluidScale: DEFAULT_CHIMER_SETTINGS.reactBitsFerrofluidScale,
      reactBitsFerrofluidTurbulence: DEFAULT_CHIMER_SETTINGS.reactBitsFerrofluidTurbulence,
      reactBitsFerrofluidFluidity: DEFAULT_CHIMER_SETTINGS.reactBitsFerrofluidFluidity,
      reactBitsFerrofluidRimWidth: DEFAULT_CHIMER_SETTINGS.reactBitsFerrofluidRimWidth,
      reactBitsFerrofluidSharpness: DEFAULT_CHIMER_SETTINGS.reactBitsFerrofluidSharpness,
      reactBitsFerrofluidShimmer: DEFAULT_CHIMER_SETTINGS.reactBitsFerrofluidShimmer,
      reactBitsFerrofluidGlow: DEFAULT_CHIMER_SETTINGS.reactBitsFerrofluidGlow,
      reactBitsFerrofluidFlowDirection: DEFAULT_CHIMER_SETTINGS.reactBitsFerrofluidFlowDirection,
      reactBitsFerrofluidOpacity: DEFAULT_CHIMER_SETTINGS.reactBitsFerrofluidOpacity,
      reactBitsLightfallPaletteMode: DEFAULT_CHIMER_SETTINGS.reactBitsLightfallPaletteMode,
      reactBitsLightfallPrimaryColor: DEFAULT_CHIMER_SETTINGS.reactBitsLightfallPrimaryColor,
      reactBitsLightfallHarmony: DEFAULT_CHIMER_SETTINGS.reactBitsLightfallHarmony,
      reactBitsLightfallColorOne: DEFAULT_CHIMER_SETTINGS.reactBitsLightfallColorOne,
      reactBitsLightfallColorTwo: DEFAULT_CHIMER_SETTINGS.reactBitsLightfallColorTwo,
      reactBitsLightfallColorThree: DEFAULT_CHIMER_SETTINGS.reactBitsLightfallColorThree,
      reactBitsLightfallBackgroundColor: DEFAULT_CHIMER_SETTINGS.reactBitsLightfallBackgroundColor,
      reactBitsLightfallSpeed: DEFAULT_CHIMER_SETTINGS.reactBitsLightfallSpeed,
      reactBitsLightfallStreakCount: DEFAULT_CHIMER_SETTINGS.reactBitsLightfallStreakCount,
      reactBitsLightfallStreakWidth: DEFAULT_CHIMER_SETTINGS.reactBitsLightfallStreakWidth,
      reactBitsLightfallStreakLength: DEFAULT_CHIMER_SETTINGS.reactBitsLightfallStreakLength,
      reactBitsLightfallGlow: DEFAULT_CHIMER_SETTINGS.reactBitsLightfallGlow,
      reactBitsLightfallDensity: DEFAULT_CHIMER_SETTINGS.reactBitsLightfallDensity,
      reactBitsLightfallTwinkle: DEFAULT_CHIMER_SETTINGS.reactBitsLightfallTwinkle,
      reactBitsLightfallZoom: DEFAULT_CHIMER_SETTINGS.reactBitsLightfallZoom,
      reactBitsLightfallBackgroundGlow: DEFAULT_CHIMER_SETTINGS.reactBitsLightfallBackgroundGlow,
      reactBitsLightfallOpacity: DEFAULT_CHIMER_SETTINGS.reactBitsLightfallOpacity,
      reactBitsLightfallCursorEnabled: DEFAULT_CHIMER_SETTINGS.reactBitsLightfallCursorEnabled,
      reactBitsLightfallCursorStrength: DEFAULT_CHIMER_SETTINGS.reactBitsLightfallCursorStrength,
      reactBitsLightfallCursorRadius: DEFAULT_CHIMER_SETTINGS.reactBitsLightfallCursorRadius,
      reactBitsLightfallCursorDampening: DEFAULT_CHIMER_SETTINGS.reactBitsLightfallCursorDampening,
      reactBitsLiquidEtherPaletteMode: DEFAULT_CHIMER_SETTINGS.reactBitsLiquidEtherPaletteMode,
      reactBitsLiquidEtherPrimaryColor: DEFAULT_CHIMER_SETTINGS.reactBitsLiquidEtherPrimaryColor,
      reactBitsLiquidEtherHarmony: DEFAULT_CHIMER_SETTINGS.reactBitsLiquidEtherHarmony,
      reactBitsLiquidEtherColorOne: DEFAULT_CHIMER_SETTINGS.reactBitsLiquidEtherColorOne,
      reactBitsLiquidEtherColorTwo: DEFAULT_CHIMER_SETTINGS.reactBitsLiquidEtherColorTwo,
      reactBitsLiquidEtherColorThree: DEFAULT_CHIMER_SETTINGS.reactBitsLiquidEtherColorThree,
      reactBitsLiquidEtherCursorEnabled: DEFAULT_CHIMER_SETTINGS.reactBitsLiquidEtherCursorEnabled,
      reactBitsLiquidEtherMouseForce: DEFAULT_CHIMER_SETTINGS.reactBitsLiquidEtherMouseForce,
      reactBitsLiquidEtherCursorSize: DEFAULT_CHIMER_SETTINGS.reactBitsLiquidEtherCursorSize,
      reactBitsLiquidEtherIsViscous: DEFAULT_CHIMER_SETTINGS.reactBitsLiquidEtherIsViscous,
      reactBitsLiquidEtherViscous: DEFAULT_CHIMER_SETTINGS.reactBitsLiquidEtherViscous,
      reactBitsLiquidEtherIterationsViscous: DEFAULT_CHIMER_SETTINGS.reactBitsLiquidEtherIterationsViscous,
      reactBitsLiquidEtherIterationsPoisson: DEFAULT_CHIMER_SETTINGS.reactBitsLiquidEtherIterationsPoisson,
      reactBitsLiquidEtherDt: DEFAULT_CHIMER_SETTINGS.reactBitsLiquidEtherDt,
      reactBitsLiquidEtherBfecc: DEFAULT_CHIMER_SETTINGS.reactBitsLiquidEtherBfecc,
      reactBitsLiquidEtherResolution: DEFAULT_CHIMER_SETTINGS.reactBitsLiquidEtherResolution,
      reactBitsLiquidEtherIsBounce: DEFAULT_CHIMER_SETTINGS.reactBitsLiquidEtherIsBounce,
      reactBitsLiquidEtherAutoDemo: DEFAULT_CHIMER_SETTINGS.reactBitsLiquidEtherAutoDemo,
      reactBitsLiquidEtherAutoSpeed: DEFAULT_CHIMER_SETTINGS.reactBitsLiquidEtherAutoSpeed,
      reactBitsLiquidEtherAutoIntensity: DEFAULT_CHIMER_SETTINGS.reactBitsLiquidEtherAutoIntensity,
      reactBitsLiquidEtherAutoResumeDelay: DEFAULT_CHIMER_SETTINGS.reactBitsLiquidEtherAutoResumeDelay,
      reactBitsLiquidEtherAutoRampDuration: DEFAULT_CHIMER_SETTINGS.reactBitsLiquidEtherAutoRampDuration,
      reactBitsLiquidEtherOpacity: DEFAULT_CHIMER_SETTINGS.reactBitsLiquidEtherOpacity,
      reactBitsPrismHeight: DEFAULT_CHIMER_SETTINGS.reactBitsPrismHeight,
      reactBitsPrismBaseWidth: DEFAULT_CHIMER_SETTINGS.reactBitsPrismBaseWidth,
      reactBitsPrismAnimationType: DEFAULT_CHIMER_SETTINGS.reactBitsPrismAnimationType,
      reactBitsPrismGlow: DEFAULT_CHIMER_SETTINGS.reactBitsPrismGlow,
      reactBitsPrismOffsetX: DEFAULT_CHIMER_SETTINGS.reactBitsPrismOffsetX,
      reactBitsPrismOffsetY: DEFAULT_CHIMER_SETTINGS.reactBitsPrismOffsetY,
      reactBitsPrismNoise: DEFAULT_CHIMER_SETTINGS.reactBitsPrismNoise,
      reactBitsPrismTransparent: DEFAULT_CHIMER_SETTINGS.reactBitsPrismTransparent,
      reactBitsPrismScale: DEFAULT_CHIMER_SETTINGS.reactBitsPrismScale,
      reactBitsPrismHueShift: DEFAULT_CHIMER_SETTINGS.reactBitsPrismHueShift,
      reactBitsPrismColorFrequency: DEFAULT_CHIMER_SETTINGS.reactBitsPrismColorFrequency,
      reactBitsPrismHoverStrength: DEFAULT_CHIMER_SETTINGS.reactBitsPrismHoverStrength,
      reactBitsPrismInertia: DEFAULT_CHIMER_SETTINGS.reactBitsPrismInertia,
      reactBitsPrismBloom: DEFAULT_CHIMER_SETTINGS.reactBitsPrismBloom,
      reactBitsPrismTimeScale: DEFAULT_CHIMER_SETTINGS.reactBitsPrismTimeScale,
      reactBitsDarkVeilHueShift: DEFAULT_CHIMER_SETTINGS.reactBitsDarkVeilHueShift,
      reactBitsDarkVeilNoiseIntensity: DEFAULT_CHIMER_SETTINGS.reactBitsDarkVeilNoiseIntensity,
      reactBitsDarkVeilScanlineIntensity: DEFAULT_CHIMER_SETTINGS.reactBitsDarkVeilScanlineIntensity,
      reactBitsDarkVeilSpeed: DEFAULT_CHIMER_SETTINGS.reactBitsDarkVeilSpeed,
      reactBitsDarkVeilScanlineFrequency: DEFAULT_CHIMER_SETTINGS.reactBitsDarkVeilScanlineFrequency,
      reactBitsDarkVeilWarpAmount: DEFAULT_CHIMER_SETTINGS.reactBitsDarkVeilWarpAmount,
      reactBitsDarkVeilResolutionScale: DEFAULT_CHIMER_SETTINGS.reactBitsDarkVeilResolutionScale,
      reactBitsLightPillarPaletteMode: DEFAULT_CHIMER_SETTINGS.reactBitsLightPillarPaletteMode,
      reactBitsLightPillarPrimaryColor: DEFAULT_CHIMER_SETTINGS.reactBitsLightPillarPrimaryColor,
      reactBitsLightPillarHarmony: DEFAULT_CHIMER_SETTINGS.reactBitsLightPillarHarmony,
      reactBitsLightPillarTopColor: DEFAULT_CHIMER_SETTINGS.reactBitsLightPillarTopColor,
      reactBitsLightPillarBottomColor: DEFAULT_CHIMER_SETTINGS.reactBitsLightPillarBottomColor,
      reactBitsLightPillarIntensity: DEFAULT_CHIMER_SETTINGS.reactBitsLightPillarIntensity,
      reactBitsLightPillarRotationSpeed: DEFAULT_CHIMER_SETTINGS.reactBitsLightPillarRotationSpeed,
      reactBitsLightPillarInteractive: DEFAULT_CHIMER_SETTINGS.reactBitsLightPillarInteractive,
      reactBitsLightPillarGlowAmount: DEFAULT_CHIMER_SETTINGS.reactBitsLightPillarGlowAmount,
      reactBitsLightPillarWidth: DEFAULT_CHIMER_SETTINGS.reactBitsLightPillarWidth,
      reactBitsLightPillarHeight: DEFAULT_CHIMER_SETTINGS.reactBitsLightPillarHeight,
      reactBitsLightPillarNoiseIntensity: DEFAULT_CHIMER_SETTINGS.reactBitsLightPillarNoiseIntensity,
      reactBitsLightPillarBlendMode: DEFAULT_CHIMER_SETTINGS.reactBitsLightPillarBlendMode,
      reactBitsLightPillarRotation: DEFAULT_CHIMER_SETTINGS.reactBitsLightPillarRotation,
      reactBitsLightPillarQuality: DEFAULT_CHIMER_SETTINGS.reactBitsLightPillarQuality,
      reactBitsSilkPaletteMode: DEFAULT_CHIMER_SETTINGS.reactBitsSilkPaletteMode,
      reactBitsSilkPrimaryColor: DEFAULT_CHIMER_SETTINGS.reactBitsSilkPrimaryColor,
      reactBitsSilkHarmony: DEFAULT_CHIMER_SETTINGS.reactBitsSilkHarmony,
      reactBitsSilkColor: DEFAULT_CHIMER_SETTINGS.reactBitsSilkColor,
      reactBitsSilkSpeed: DEFAULT_CHIMER_SETTINGS.reactBitsSilkSpeed,
      reactBitsSilkScale: DEFAULT_CHIMER_SETTINGS.reactBitsSilkScale,
      reactBitsSilkNoiseIntensity: DEFAULT_CHIMER_SETTINGS.reactBitsSilkNoiseIntensity,
      reactBitsSilkRotation: DEFAULT_CHIMER_SETTINGS.reactBitsSilkRotation,
      reactBitsFloatingLinesPaletteMode: DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesPaletteMode,
      reactBitsFloatingLinesPrimaryColor: DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesPrimaryColor,
      reactBitsFloatingLinesHarmony: DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesHarmony,
      reactBitsFloatingLinesColorOne: DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesColorOne,
      reactBitsFloatingLinesColorTwo: DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesColorTwo,
      reactBitsFloatingLinesColorThree: DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesColorThree,
      reactBitsFloatingLinesEnableTop: DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesEnableTop,
      reactBitsFloatingLinesEnableMiddle: DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesEnableMiddle,
      reactBitsFloatingLinesEnableBottom: DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesEnableBottom,
      reactBitsFloatingLinesTopLineCount: DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesTopLineCount,
      reactBitsFloatingLinesMiddleLineCount: DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesMiddleLineCount,
      reactBitsFloatingLinesBottomLineCount: DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesBottomLineCount,
      reactBitsFloatingLinesTopLineDistance: DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesTopLineDistance,
      reactBitsFloatingLinesMiddleLineDistance: DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesMiddleLineDistance,
      reactBitsFloatingLinesBottomLineDistance: DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesBottomLineDistance,
      reactBitsFloatingLinesTopWaveX: DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesTopWaveX,
      reactBitsFloatingLinesTopWaveY: DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesTopWaveY,
      reactBitsFloatingLinesTopWaveRotate: DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesTopWaveRotate,
      reactBitsFloatingLinesMiddleWaveX: DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesMiddleWaveX,
      reactBitsFloatingLinesMiddleWaveY: DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesMiddleWaveY,
      reactBitsFloatingLinesMiddleWaveRotate: DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesMiddleWaveRotate,
      reactBitsFloatingLinesBottomWaveX: DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesBottomWaveX,
      reactBitsFloatingLinesBottomWaveY: DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesBottomWaveY,
      reactBitsFloatingLinesBottomWaveRotate: DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesBottomWaveRotate,
      reactBitsFloatingLinesAnimationSpeed: DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesAnimationSpeed,
      reactBitsFloatingLinesInteractive: DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesInteractive,
      reactBitsFloatingLinesBendRadius: DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesBendRadius,
      reactBitsFloatingLinesBendStrength: DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesBendStrength,
      reactBitsFloatingLinesMouseDamping: DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesMouseDamping,
      reactBitsFloatingLinesParallax: DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesParallax,
      reactBitsFloatingLinesParallaxStrength: DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesParallaxStrength,
      reactBitsFloatingLinesBlendMode: DEFAULT_CHIMER_SETTINGS.reactBitsFloatingLinesBlendMode,
      eldoraNovatrixPaletteMode: DEFAULT_CHIMER_SETTINGS.eldoraNovatrixPaletteMode,
      eldoraNovatrixPrimaryColor: DEFAULT_CHIMER_SETTINGS.eldoraNovatrixPrimaryColor,
      eldoraNovatrixHarmony: DEFAULT_CHIMER_SETTINGS.eldoraNovatrixHarmony,
      eldoraNovatrixColor: DEFAULT_CHIMER_SETTINGS.eldoraNovatrixColor,
      eldoraNovatrixSpeed: DEFAULT_CHIMER_SETTINGS.eldoraNovatrixSpeed,
      eldoraNovatrixAmplitude: DEFAULT_CHIMER_SETTINGS.eldoraNovatrixAmplitude,
      eldoraHackerPaletteMode: DEFAULT_CHIMER_SETTINGS.eldoraHackerPaletteMode,
      eldoraHackerPrimaryColor: DEFAULT_CHIMER_SETTINGS.eldoraHackerPrimaryColor,
      eldoraHackerHarmony: DEFAULT_CHIMER_SETTINGS.eldoraHackerHarmony,
      eldoraHackerColor: DEFAULT_CHIMER_SETTINGS.eldoraHackerColor,
      eldoraHackerSpeed: DEFAULT_CHIMER_SETTINGS.eldoraHackerSpeed,
      eldoraHackerFontSize: DEFAULT_CHIMER_SETTINGS.eldoraHackerFontSize,
      eldoraPhotonBeamPaletteMode: DEFAULT_CHIMER_SETTINGS.eldoraPhotonBeamPaletteMode,
      eldoraPhotonBeamPrimaryColor: DEFAULT_CHIMER_SETTINGS.eldoraPhotonBeamPrimaryColor,
      eldoraPhotonBeamHarmony: DEFAULT_CHIMER_SETTINGS.eldoraPhotonBeamHarmony,
      eldoraPhotonBeamColorBg: DEFAULT_CHIMER_SETTINGS.eldoraPhotonBeamColorBg,
      eldoraPhotonBeamColorLine: DEFAULT_CHIMER_SETTINGS.eldoraPhotonBeamColorLine,
      eldoraPhotonBeamColorSignal: DEFAULT_CHIMER_SETTINGS.eldoraPhotonBeamColorSignal,
      eldoraPhotonBeamUseColor2: DEFAULT_CHIMER_SETTINGS.eldoraPhotonBeamUseColor2,
      eldoraPhotonBeamColorSignal2: DEFAULT_CHIMER_SETTINGS.eldoraPhotonBeamColorSignal2,
      eldoraPhotonBeamUseColor3: DEFAULT_CHIMER_SETTINGS.eldoraPhotonBeamUseColor3,
      eldoraPhotonBeamColorSignal3: DEFAULT_CHIMER_SETTINGS.eldoraPhotonBeamColorSignal3,
      eldoraPhotonBeamLineCount: DEFAULT_CHIMER_SETTINGS.eldoraPhotonBeamLineCount,
      eldoraPhotonBeamSpreadHeight: DEFAULT_CHIMER_SETTINGS.eldoraPhotonBeamSpreadHeight,
      eldoraPhotonBeamSpreadDepth: DEFAULT_CHIMER_SETTINGS.eldoraPhotonBeamSpreadDepth,
      eldoraPhotonBeamCurveLength: DEFAULT_CHIMER_SETTINGS.eldoraPhotonBeamCurveLength,
      eldoraPhotonBeamStraightLength: DEFAULT_CHIMER_SETTINGS.eldoraPhotonBeamStraightLength,
      eldoraPhotonBeamCurvePower: DEFAULT_CHIMER_SETTINGS.eldoraPhotonBeamCurvePower,
      eldoraPhotonBeamWaveSpeed: DEFAULT_CHIMER_SETTINGS.eldoraPhotonBeamWaveSpeed,
      eldoraPhotonBeamWaveHeight: DEFAULT_CHIMER_SETTINGS.eldoraPhotonBeamWaveHeight,
      eldoraPhotonBeamLineOpacity: DEFAULT_CHIMER_SETTINGS.eldoraPhotonBeamLineOpacity,
      eldoraPhotonBeamSignalCount: DEFAULT_CHIMER_SETTINGS.eldoraPhotonBeamSignalCount,
      eldoraPhotonBeamSpeedGlobal: DEFAULT_CHIMER_SETTINGS.eldoraPhotonBeamSpeedGlobal,
      eldoraPhotonBeamTrailLength: DEFAULT_CHIMER_SETTINGS.eldoraPhotonBeamTrailLength,
      eldoraPhotonBeamBloomStrength: DEFAULT_CHIMER_SETTINGS.eldoraPhotonBeamBloomStrength,
      eldoraPhotonBeamBloomRadius: DEFAULT_CHIMER_SETTINGS.eldoraPhotonBeamBloomRadius,
      aceternity3DGlobeViewStyle: DEFAULT_CHIMER_SETTINGS.aceternity3DGlobeViewStyle,
      aceternity3DGlobeBackgroundColor: DEFAULT_CHIMER_SETTINGS.aceternity3DGlobeBackgroundColor,
      aceternity3DGlobeGlobeColor: DEFAULT_CHIMER_SETTINGS.aceternity3DGlobeGlobeColor,
      aceternity3DGlobeGraphicMapColor: DEFAULT_CHIMER_SETTINGS.aceternity3DGlobeGraphicMapColor,
      aceternity3DGlobeGraphicGlowColor: DEFAULT_CHIMER_SETTINGS.aceternity3DGlobeGraphicGlowColor,
      aceternity3DGlobeGraphicMarkerColor: DEFAULT_CHIMER_SETTINGS.aceternity3DGlobeGraphicMarkerColor,
      aceternity3DGlobeGraphicMapSamples: DEFAULT_CHIMER_SETTINGS.aceternity3DGlobeGraphicMapSamples,
      aceternity3DGlobeAutoRotateSpeed: DEFAULT_CHIMER_SETTINGS.aceternity3DGlobeAutoRotateSpeed,
      aceternity3DGlobeReverseSpin: DEFAULT_CHIMER_SETTINGS.aceternity3DGlobeReverseSpin,
      aceternity3DGlobeScale: DEFAULT_CHIMER_SETTINGS.aceternity3DGlobeScale,
      aceternity3DGlobeBumpScale: DEFAULT_CHIMER_SETTINGS.aceternity3DGlobeBumpScale,
      aceternity3DGlobeAmbientIntensity: DEFAULT_CHIMER_SETTINGS.aceternity3DGlobeAmbientIntensity,
      aceternity3DGlobePointLightIntensity: DEFAULT_CHIMER_SETTINGS.aceternity3DGlobePointLightIntensity,
      aceternity3DGlobeLightingMode: DEFAULT_CHIMER_SETTINGS.aceternity3DGlobeLightingMode,
      aceternity3DGlobeEnablePan: DEFAULT_CHIMER_SETTINGS.aceternity3DGlobeEnablePan,
      aceternity3DGlobePanX: DEFAULT_CHIMER_SETTINGS.aceternity3DGlobePanX,
      aceternity3DGlobePanY: DEFAULT_CHIMER_SETTINGS.aceternity3DGlobePanY,
      aceternity3DGlobeShowTilt: DEFAULT_CHIMER_SETTINGS.aceternity3DGlobeShowTilt,
      aceternity3DGlobeShowAtmosphere: DEFAULT_CHIMER_SETTINGS.aceternity3DGlobeShowAtmosphere,
      aceternity3DGlobeAtmosphereColor: DEFAULT_CHIMER_SETTINGS.aceternity3DGlobeAtmosphereColor,
      aceternity3DGlobeAtmosphereIntensity: DEFAULT_CHIMER_SETTINGS.aceternity3DGlobeAtmosphereIntensity,
      aceternity3DGlobeAtmosphereBlur: DEFAULT_CHIMER_SETTINGS.aceternity3DGlobeAtmosphereBlur,
      aceternity3DGlobeShowWireframe: DEFAULT_CHIMER_SETTINGS.aceternity3DGlobeShowWireframe,
      aceternity3DGlobeWireframeColor: DEFAULT_CHIMER_SETTINGS.aceternity3DGlobeWireframeColor,
      aceternity3DGlobeMarkerEnabled: DEFAULT_CHIMER_SETTINGS.aceternity3DGlobeMarkerEnabled,
      aceternity3DGlobeMarkerLat: DEFAULT_CHIMER_SETTINGS.aceternity3DGlobeMarkerLat,
      aceternity3DGlobeMarkerLng: DEFAULT_CHIMER_SETTINGS.aceternity3DGlobeMarkerLng,
      aceternity3DGlobeMarkerLabel: DEFAULT_CHIMER_SETTINGS.aceternity3DGlobeMarkerLabel,
      aceternity3DGlobeMarkerIcon: DEFAULT_CHIMER_SETTINGS.aceternity3DGlobeMarkerIcon,
      aceternity3DGlobeMarkerSize: DEFAULT_CHIMER_SETTINGS.aceternity3DGlobeMarkerSize,
      magicRetroGridBackgroundColor: DEFAULT_CHIMER_SETTINGS.magicRetroGridBackgroundColor,
      magicRetroGridLightLineColor: DEFAULT_CHIMER_SETTINGS.magicRetroGridLightLineColor,
      magicRetroGridDarkLineColor: DEFAULT_CHIMER_SETTINGS.magicRetroGridDarkLineColor,
      magicRetroGridAngle: DEFAULT_CHIMER_SETTINGS.magicRetroGridAngle,
      magicRetroGridCellSize: DEFAULT_CHIMER_SETTINGS.magicRetroGridCellSize,
      magicRetroGridOpacity: DEFAULT_CHIMER_SETTINGS.magicRetroGridOpacity,
      magicLightRaysBackgroundColor: DEFAULT_CHIMER_SETTINGS.magicLightRaysBackgroundColor,
      magicLightRaysColor: DEFAULT_CHIMER_SETTINGS.magicLightRaysColor,
      magicLightRaysCount: DEFAULT_CHIMER_SETTINGS.magicLightRaysCount,
      magicLightRaysBlur: DEFAULT_CHIMER_SETTINGS.magicLightRaysBlur,
      magicLightRaysSpeed: DEFAULT_CHIMER_SETTINGS.magicLightRaysSpeed,
      magicLightRaysLength: DEFAULT_CHIMER_SETTINGS.magicLightRaysLength,
      magicLightRaysOpacity: DEFAULT_CHIMER_SETTINGS.magicLightRaysOpacity,
      chamaacSynthesisPaletteMode: DEFAULT_CHIMER_SETTINGS.chamaacSynthesisPaletteMode,
      chamaacSynthesisPrimaryColor: DEFAULT_CHIMER_SETTINGS.chamaacSynthesisPrimaryColor,
      chamaacSynthesisHarmony: DEFAULT_CHIMER_SETTINGS.chamaacSynthesisHarmony,
      chamaacSynthesisColorOne: DEFAULT_CHIMER_SETTINGS.chamaacSynthesisColorOne,
      chamaacSynthesisColorTwo: DEFAULT_CHIMER_SETTINGS.chamaacSynthesisColorTwo,
      chamaacSynthesisColorThree: DEFAULT_CHIMER_SETTINGS.chamaacSynthesisColorThree,
      chamaacSynthesisSpeed: DEFAULT_CHIMER_SETTINGS.chamaacSynthesisSpeed,
      chamaacSynthesisComplexity: DEFAULT_CHIMER_SETTINGS.chamaacSynthesisComplexity,
      chamaacSynthesisScale: DEFAULT_CHIMER_SETTINGS.chamaacSynthesisScale,
      chamaacSynthesisDistortion: DEFAULT_CHIMER_SETTINGS.chamaacSynthesisDistortion,
      chamaacSynthesisGlowIntensity: DEFAULT_CHIMER_SETTINGS.chamaacSynthesisGlowIntensity,
      chamaacSynthesisFlowFrequency: DEFAULT_CHIMER_SETTINGS.chamaacSynthesisFlowFrequency,
      backgroundLinesDuration: DEFAULT_CHIMER_SETTINGS.backgroundLinesDuration,
      shootingStarsStarColor: DEFAULT_CHIMER_SETTINGS.shootingStarsStarColor,
      shootingStarsTrailColor: DEFAULT_CHIMER_SETTINGS.shootingStarsTrailColor,
      shootingStarsShootingStarColor: DEFAULT_CHIMER_SETTINGS.shootingStarsShootingStarColor,
      shootingStarsDensity: DEFAULT_CHIMER_SETTINGS.shootingStarsDensity,
      shootingStarsTwinkle: DEFAULT_CHIMER_SETTINGS.shootingStarsTwinkle,
      shootingStarsTwinkleSpeed: DEFAULT_CHIMER_SETTINGS.shootingStarsTwinkleSpeed,
      shootingStarsShootingSpeed: DEFAULT_CHIMER_SETTINGS.shootingStarsShootingSpeed,
      shootingStarsFrequency: DEFAULT_CHIMER_SETTINGS.shootingStarsFrequency,
      canvasRevealDotsBackgroundColor: DEFAULT_CHIMER_SETTINGS.canvasRevealDotsBackgroundColor,
      canvasRevealDotsDotColor: DEFAULT_CHIMER_SETTINGS.canvasRevealDotsDotColor,
      canvasRevealDotsAccentColor: DEFAULT_CHIMER_SETTINGS.canvasRevealDotsAccentColor,
      canvasRevealDotsDotSize: DEFAULT_CHIMER_SETTINGS.canvasRevealDotsDotSize,
      canvasRevealDotsDotSpacing: DEFAULT_CHIMER_SETTINGS.canvasRevealDotsDotSpacing,
      canvasRevealDotsOpacity: DEFAULT_CHIMER_SETTINGS.canvasRevealDotsOpacity,
      canvasRevealDotsAnimationSpeed: DEFAULT_CHIMER_SETTINGS.canvasRevealDotsAnimationSpeed,
      canvasRevealDotsShowGradient: DEFAULT_CHIMER_SETTINGS.canvasRevealDotsShowGradient,
      spotlightColor: DEFAULT_CHIMER_SETTINGS.spotlightColor,
      spotlightOpacity: DEFAULT_CHIMER_SETTINGS.spotlightOpacity,
      spotlightWidth: DEFAULT_CHIMER_SETTINGS.spotlightWidth,
      spotlightHeight: DEFAULT_CHIMER_SETTINGS.spotlightHeight,
      spotlightSmallWidth: DEFAULT_CHIMER_SETTINGS.spotlightSmallWidth,
      spotlightTranslateY: DEFAULT_CHIMER_SETTINGS.spotlightTranslateY,
      spotlightDuration: DEFAULT_CHIMER_SETTINGS.spotlightDuration,
      spotlightXOffset: DEFAULT_CHIMER_SETTINGS.spotlightXOffset,
      lampBackgroundColor: DEFAULT_CHIMER_SETTINGS.lampBackgroundColor,
      lampColor: DEFAULT_CHIMER_SETTINGS.lampColor,
      lampGlowOpacity: DEFAULT_CHIMER_SETTINGS.lampGlowOpacity,
      lampBeamWidth: DEFAULT_CHIMER_SETTINGS.lampBeamWidth,
      lampGlowWidth: DEFAULT_CHIMER_SETTINGS.lampGlowWidth,
      lampVerticalOffset: DEFAULT_CHIMER_SETTINGS.lampVerticalOffset,
      lampPulseSpeed: DEFAULT_CHIMER_SETTINGS.lampPulseSpeed,
      vortexBackgroundColor: DEFAULT_CHIMER_SETTINGS.vortexBackgroundColor,
      vortexBaseHue: DEFAULT_CHIMER_SETTINGS.vortexBaseHue,
      vortexParticleCount: DEFAULT_CHIMER_SETTINGS.vortexParticleCount,
      vortexRangeY: DEFAULT_CHIMER_SETTINGS.vortexRangeY,
      vortexBaseSpeed: DEFAULT_CHIMER_SETTINGS.vortexBaseSpeed,
      vortexRangeSpeed: DEFAULT_CHIMER_SETTINGS.vortexRangeSpeed,
      vortexBaseRadius: DEFAULT_CHIMER_SETTINGS.vortexBaseRadius,
      vortexRangeRadius: DEFAULT_CHIMER_SETTINGS.vortexRangeRadius,
      wavyBackgroundFill: DEFAULT_CHIMER_SETTINGS.wavyBackgroundFill,
      wavyColorOne: DEFAULT_CHIMER_SETTINGS.wavyColorOne,
      wavyColorTwo: DEFAULT_CHIMER_SETTINGS.wavyColorTwo,
      wavyColorThree: DEFAULT_CHIMER_SETTINGS.wavyColorThree,
      wavyColorFour: DEFAULT_CHIMER_SETTINGS.wavyColorFour,
      wavyColorFive: DEFAULT_CHIMER_SETTINGS.wavyColorFive,
      wavyWaveWidth: DEFAULT_CHIMER_SETTINGS.wavyWaveWidth,
      wavyBlur: DEFAULT_CHIMER_SETTINGS.wavyBlur,
      wavySpeed: DEFAULT_CHIMER_SETTINGS.wavySpeed,
      wavyWaveOpacity: DEFAULT_CHIMER_SETTINGS.wavyWaveOpacity,
      auroraBarsBackgroundColor: DEFAULT_CHIMER_SETTINGS.auroraBarsBackgroundColor,
      auroraBarsPaletteMode: DEFAULT_CHIMER_SETTINGS.auroraBarsPaletteMode,
      auroraBarsPrimaryColor: DEFAULT_CHIMER_SETTINGS.auroraBarsPrimaryColor,
      auroraBarsColorOne: DEFAULT_CHIMER_SETTINGS.auroraBarsColorOne,
      auroraBarsColorTwo: DEFAULT_CHIMER_SETTINGS.auroraBarsColorTwo,
      auroraBarsColorThree: DEFAULT_CHIMER_SETTINGS.auroraBarsColorThree,
      auroraBarsColorFour: DEFAULT_CHIMER_SETTINGS.auroraBarsColorFour,
      auroraBarsColorFive: DEFAULT_CHIMER_SETTINGS.auroraBarsColorFive,
      auroraBarsBarCount: DEFAULT_CHIMER_SETTINGS.auroraBarsBarCount,
      auroraBarsSpeed: DEFAULT_CHIMER_SETTINGS.auroraBarsSpeed,
      auroraBarsBlur: DEFAULT_CHIMER_SETTINGS.auroraBarsBlur,
      auroraBarsGap: DEFAULT_CHIMER_SETTINGS.auroraBarsGap,
      auroraBarsMaxHeightRatio: DEFAULT_CHIMER_SETTINGS.auroraBarsMaxHeightRatio,
      auroraBarsMinHeightRatio: DEFAULT_CHIMER_SETTINGS.auroraBarsMinHeightRatio,
      pixelLiquidBackgroundColor: DEFAULT_CHIMER_SETTINGS.pixelLiquidBackgroundColor,
      pixelLiquidBaseColor: DEFAULT_CHIMER_SETTINGS.pixelLiquidBaseColor,
      pixelLiquidAccentColor: DEFAULT_CHIMER_SETTINGS.pixelLiquidAccentColor,
      pixelLiquidHighlightColor: DEFAULT_CHIMER_SETTINGS.pixelLiquidHighlightColor,
      pixelLiquidPalette: DEFAULT_CHIMER_SETTINGS.pixelLiquidPalette,
      pixelLiquidPixelSize: DEFAULT_CHIMER_SETTINGS.pixelLiquidPixelSize,
      pixelLiquidDetail: DEFAULT_CHIMER_SETTINGS.pixelLiquidDetail,
      pixelLiquidCursorForce: DEFAULT_CHIMER_SETTINGS.pixelLiquidCursorForce,
      pixelLiquidCursorSize: DEFAULT_CHIMER_SETTINGS.pixelLiquidCursorSize,
      pixelLiquidAutoDemo: DEFAULT_CHIMER_SETTINGS.pixelLiquidAutoDemo,
      pixelLiquidMotionSpeed: DEFAULT_CHIMER_SETTINGS.pixelLiquidMotionSpeed,
      tileGridPaletteMode: DEFAULT_CHIMER_SETTINGS.tileGridPaletteMode,
      tileGridPrimaryColor: DEFAULT_CHIMER_SETTINGS.tileGridPrimaryColor,
      tileGridColorOne: DEFAULT_CHIMER_SETTINGS.tileGridColorOne,
      tileGridColorTwo: DEFAULT_CHIMER_SETTINGS.tileGridColorTwo,
      tileGridColorThree: DEFAULT_CHIMER_SETTINGS.tileGridColorThree,
      tileGridColorFour: DEFAULT_CHIMER_SETTINGS.tileGridColorFour,
      tileGridColorFive: DEFAULT_CHIMER_SETTINGS.tileGridColorFive,
      tileGridTileSize: DEFAULT_CHIMER_SETTINGS.tileGridTileSize,
      tileGridJointSize: DEFAULT_CHIMER_SETTINGS.tileGridJointSize,
      tileGridChangeFrequency: DEFAULT_CHIMER_SETTINGS.tileGridChangeFrequency,
      tileGridActivePercent: DEFAULT_CHIMER_SETTINGS.tileGridActivePercent,
      tileGridOpacity: DEFAULT_CHIMER_SETTINGS.tileGridOpacity,
      hexGridPrimaryColor: DEFAULT_CHIMER_SETTINGS.hexGridPrimaryColor,
      hexGridHarmony: DEFAULT_CHIMER_SETTINGS.hexGridHarmony,
      hexGridHexSize: DEFAULT_CHIMER_SETTINGS.hexGridHexSize,
      hexGridJointSize: DEFAULT_CHIMER_SETTINGS.hexGridJointSize,
      hexGridChangeFrequency: DEFAULT_CHIMER_SETTINGS.hexGridChangeFrequency,
      hexGridActivePercent: DEFAULT_CHIMER_SETTINGS.hexGridActivePercent,
      hexGridOpacity: DEFAULT_CHIMER_SETTINGS.hexGridOpacity,
    } : {}),
  }

  return sanitizedSettings
}
