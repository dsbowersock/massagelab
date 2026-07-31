import { FEATURE_KEYS, hasFeature, hasPremiumBackgroundAccess } from "./membership.js"
import { DEFAULT_BACKGROUND_ID, normalizeBackgroundId } from "./background-options.js"
import {
  normalizeSharedBackgroundVisualPreferences,
  omitLegacyBackgroundColorSettings,
} from "./background-palette.js"
import {
  clampTileGridFadeSeconds,
  TILE_GRID_FADE_SECONDS_DEFAULT,
} from "./tile-grid-background.js"

export const CHIMER_STORAGE_KEY = "massagelab-chimer-settings"

const ALERT_TYPES = Object.freeze([
  "chime",
  "flash",
  "both",
  "haptic",
  "chime-haptic",
  "flash-haptic",
  "all",
  "silent",
])
const CLOCK_FONT_FAMILIES = Object.freeze(["digital", "mono", "sans", "serif"])
const MASSAGE_LAB_LIGHT_SPEED_WARP_SPEED_VERSION = 2
const MASSAGE_LAB_LIGHT_SPEED_LEGACY_WARP_SCALE = 10
const MASSAGE_LAB_ELECTRIC_MIST_CONTROL_VERSION = 2
export const MASSAGE_LAB_3D_GLOBE_MIN_SCALE = 0.05
export const MASSAGE_LAB_3D_GLOBE_MAX_SCALE = 0.95
export const MASSAGE_LAB_3D_GLOBE_GRAPHIC_MAP_SAMPLES_MIN = 1000
export const MASSAGE_LAB_3D_GLOBE_GRAPHIC_MAP_SAMPLES_MAX = 10000

const CHIMER_SETTINGS_WITH_RENDERER_SOURCE_DEFAULTS = Object.freeze({
  hours: 0,
  minutes: 0,
  intervalType: "preset",
  customInterval: 15,
  areasToMassage: 4,
  alertType: "chime",
  alertVolume: 0.7,
  hapticIntensityMs: 15,
  movingBackgroundEnabled: true,
  backgroundId: DEFAULT_BACKGROUND_ID,
  backgroundVisualPreferences: normalizeSharedBackgroundVisualPreferences(),
  keepTimerScreenAwake: true,
  showClockDisplay: true,
  // Rotation uses a 2–20° yaw over 10–120s; forward glow persists unitless
  // strength (0–1), projection length (0.5–4), and blur radius (0–64px).
  clockRotationEnabled: false,
  clockRotationRange: 10,
  clockRotationDuration: 40,
  clockForwardGlowEnabled: false,
  clockForwardGlowStrength: 1,
  clockForwardGlowLength: 1,
  clockForwardGlowBlur: 28,
  showTimerSeconds: true,
  showCurrentTimeSeconds: false,
  timeFormat: "12h",
  primaryFontColor: "#FFFFFF",
  secondaryFontColor: "#FF7A1A",
  clockModeFontColor: "#FFFFFF",
  clockFontFamily: "digital",
  clockStrokeEnabled: false,
  clockStrokeColor: "#050505",
  clockStrokeWidth: 1,
  clockShadowEnabled: true,
  clockShadowColor: "#000000",
  clockShadowStrength: 0.42,
  clockShadowDirection: 45,
  clockShadowDistance: 10,
  clockShadowFeather: 8,
  clockGlowEnabled: true,
  clockGlowColor: "#FF7A1A",
  clockGlowStrength: 0.72,
  sparklesMaxSize: 3,
  sparklesMinSize: 1,
  sparklesParticleDensity: 84,
  sparklesSpeed: 2,
  gradientAnimationSpeed: 1,
  gradientAnimationSize: 80,
  massageLabGradientOpacity: 1,
  massageLabStarsSpeed: 50,
  massageLabStarsDensity: 1,
  massageLabStarsParallax: 0.05,
  massageLabHoleLineCount: 50,
  massageLabHoleDiscCount: 50,
  massageLabLightSpeedWarpSpeed: 1,
  massageLabLightSpeedWarpSpeedVersion: MASSAGE_LAB_LIGHT_SPEED_WARP_SPEED_VERSION,
  massageLabLightSpeedParticleCount: 200,
  massageLabLightSpeedIntensity: 3,
  massageLabLightSpeedRadius: 25,
  massageLabLightSpeedCylinderLength: 150,
  massageLabElectricMistSpeed: 100,
  massageLabElectricMistControlVersion: MASSAGE_LAB_ELECTRIC_MIST_CONTROL_VERSION,
  massageLabElectricMistDetail: 1.5,
  massageLabElectricMistDistortion: 3,
  massageLabElectricMistBrightness: 100,
  massageLabAstralFlowSpeed: 1.5,
  massageLabAstralFlowFlowMin: 3,
  massageLabAstralFlowFlowMax: 7,
  massageLabDeepSpaceNebulaSpeed: 2,
  massageLabGridBloomSpeed: 1,
  massageLabGridBloomGridScale: 12,
  massageLabGridBloomRotationSpeed: 0,
  massageLabGridBloomFadeFalloff: 10,
  massageLabGridBloomDistortionAmount: 0.05,
  massageLabGridBloomFlowSpeedX: -0.2,
  massageLabGridBloomFlowSpeedY: -0.4,
  massageLabChromeFlowFlowSpeed: 0.35,
  massageLabChromeFlowTimeScale: 0.225,
  massageLabWaveCurrentSpeedX: 0.0125,
  massageLabWaveCurrentSpeedY: 0.005,
  massageLabWaveCurrentAmplitude: 32,
  massageLabFerrofluidSpeed: 0.5,
  massageLabFerrofluidScale: 1.6,
  massageLabFerrofluidTurbulence: 1,
  massageLabFerrofluidFluidity: 0.1,
  massageLabFerrofluidRimWidth: 0.2,
  massageLabFerrofluidSharpness: 2.5,
  massageLabFerrofluidShimmer: 1.5,
  massageLabFerrofluidGlow: 2,
  massageLabFerrofluidFlowDirection: "down",
  massageLabFerrofluidOpacity: 1,
  massageLabLightfallSpeed: 0.5,
  massageLabLightfallStreakCount: 2,
  massageLabLightfallStreakWidth: 1,
  massageLabLightfallStreakLength: 1,
  massageLabLightfallGlow: 1,
  massageLabLightfallDensity: 0.6,
  massageLabLightfallTwinkle: 1,
  massageLabLightfallZoom: 3,
  massageLabLightfallBackgroundGlow: 0.5,
  massageLabLightfallOpacity: 1,
  massageLabLightfallCursorEnabled: false,
  massageLabLightfallCursorStrength: 0.5,
  massageLabLightfallCursorRadius: 1,
  massageLabLightfallCursorDampening: 0.15,
  massageLabLiquidEtherCursorEnabled: false,
  massageLabLiquidEtherMouseForce: 20,
  massageLabLiquidEtherCursorSize: 100,
  massageLabLiquidEtherIsViscous: false,
  massageLabLiquidEtherViscous: 30,
  massageLabLiquidEtherIterationsViscous: 32,
  massageLabLiquidEtherIterationsPoisson: 32,
  massageLabLiquidEtherDt: 0.014,
  massageLabLiquidEtherBfecc: true,
  massageLabLiquidEtherResolution: 0.5,
  massageLabLiquidEtherIsBounce: false,
  massageLabLiquidEtherAutoDemo: true,
  massageLabLiquidEtherAutoSpeed: 0.5,
  massageLabLiquidEtherAutoIntensity: 2.2,
  massageLabLiquidEtherAutoResumeDelay: 1000,
  massageLabLiquidEtherAutoRampDuration: 0.6,
  massageLabLiquidEtherOpacity: 1,
  massageLabPrismHeight: 3.5,
  massageLabPrismBaseWidth: 5.5,
  massageLabPrismAnimationType: "rotate",
  massageLabPrismGlow: 1,
  massageLabPrismOffsetX: 0,
  massageLabPrismOffsetY: 0,
  massageLabPrismNoise: 0.5,
  massageLabPrismTransparent: true,
  massageLabPrismScale: 3.6,
  massageLabPrismHueShift: 0,
  massageLabPrismColorFrequency: 1,
  massageLabPrismHoverStrength: 2,
  massageLabPrismInertia: 0.05,
  massageLabPrismBloom: 1,
  massageLabPrismTimeScale: 0.5,
  massageLabDarkVeilHueShift: 0,
  massageLabDarkVeilNoiseIntensity: 0,
  massageLabDarkVeilScanlineIntensity: 0,
  massageLabDarkVeilSpeed: 0.5,
  massageLabDarkVeilScanlineFrequency: 0,
  massageLabDarkVeilWarpAmount: 0,
  massageLabDarkVeilResolutionScale: 1,
  massageLabLightPillarIntensity: 1,
  massageLabLightPillarRotationSpeed: 0.3,
  massageLabLightPillarInteractive: false,
  massageLabLightPillarGlowAmount: 0.005,
  massageLabLightPillarWidth: 3,
  massageLabLightPillarHeight: 0.4,
  massageLabLightPillarNoiseIntensity: 0.5,
  massageLabLightPillarBlendMode: "screen",
  massageLabLightPillarRotation: 0,
  massageLabLightPillarQuality: "high",
  massageLabSilkSpeed: 5,
  massageLabSilkScale: 1,
  massageLabSilkNoiseIntensity: 1.5,
  massageLabSilkRotation: 0,
  massageLabFloatingLinesEnableTop: true,
  massageLabFloatingLinesEnableMiddle: true,
  massageLabFloatingLinesEnableBottom: true,
  massageLabFloatingLinesTopLineCount: 6,
  massageLabFloatingLinesMiddleLineCount: 6,
  massageLabFloatingLinesBottomLineCount: 6,
  massageLabFloatingLinesTopLineDistance: 5,
  massageLabFloatingLinesMiddleLineDistance: 0.1,
  massageLabFloatingLinesBottomLineDistance: 0.1,
  massageLabFloatingLinesTopWaveX: 10,
  massageLabFloatingLinesTopWaveY: 0.5,
  massageLabFloatingLinesTopWaveRotate: -0.4,
  massageLabFloatingLinesMiddleWaveX: 5,
  massageLabFloatingLinesMiddleWaveY: 0,
  massageLabFloatingLinesMiddleWaveRotate: 0.2,
  massageLabFloatingLinesBottomWaveX: 2,
  massageLabFloatingLinesBottomWaveY: -0.7,
  massageLabFloatingLinesBottomWaveRotate: -1,
  massageLabFloatingLinesAnimationSpeed: 1,
  massageLabFloatingLinesInteractive: true,
  massageLabFloatingLinesBendRadius: 5,
  massageLabFloatingLinesBendStrength: -0.5,
  massageLabFloatingLinesMouseDamping: 0.05,
  massageLabFloatingLinesParallax: true,
  massageLabFloatingLinesParallaxStrength: 0.2,
  massageLabFloatingLinesBlendMode: "screen",
  massageLabSideRaysSpeed: 2.5,
  massageLabSideRaysIntensity: 2,
  massageLabSideRaysSpread: 2,
  massageLabSideRaysOrigin: "top-right",
  massageLabSideRaysTilt: 0,
  massageLabSideRaysSaturation: 1.5,
  massageLabSideRaysBlend: 0.75,
  massageLabSideRaysFalloff: 1.6,
  massageLabSideRaysOpacity: 1,
  massageLabLightRaysOrigin: "top-center",
  massageLabLightRaysSpeed: 1,
  massageLabLightRaysSpread: 1,
  massageLabLightRaysLength: 2,
  massageLabLightRaysPulsating: false,
  massageLabLightRaysFadeDistance: 1,
  massageLabLightRaysSaturation: 1,
  massageLabLightRaysFollowMouse: false,
  massageLabLightRaysMouseInfluence: 0.1,
  massageLabLightRaysNoiseAmount: 0,
  massageLabLightRaysDistortion: 0,
  massageLabPixelBlastVariant: "square",
  massageLabPixelBlastPixelSize: 3,
  massageLabPixelBlastAntialias: true,
  massageLabPixelBlastPatternScale: 2,
  massageLabPixelBlastPatternDensity: 1,
  massageLabPixelBlastLiquid: false,
  massageLabPixelBlastLiquidStrength: 0.1,
  massageLabPixelBlastLiquidRadius: 1,
  massageLabPixelBlastPixelSizeJitter: 0,
  massageLabPixelBlastEnableRipples: true,
  massageLabPixelBlastRippleIntensityScale: 1,
  massageLabPixelBlastRippleThickness: 0.1,
  massageLabPixelBlastRippleSpeed: 0.3,
  massageLabPixelBlastLiquidWobbleSpeed: 4.5,
  massageLabPixelBlastAutoPauseOffscreen: true,
  massageLabPixelBlastSpeed: 0.5,
  massageLabPixelBlastTransparent: true,
  massageLabPixelBlastEdgeFade: 0.5,
  massageLabPixelBlastNoiseAmount: 0,
  massageLabColorBendsRotation: 90,
  massageLabColorBendsSpeed: 0.2,
  massageLabColorBendsTransparent: true,
  massageLabColorBendsAutoRotate: 0,
  massageLabColorBendsScale: 1,
  massageLabColorBendsFrequency: 1,
  massageLabColorBendsWarpStrength: 1,
  massageLabColorBendsInteractive: false,
  massageLabColorBendsMouseInfluence: 1,
  massageLabColorBendsParallax: 0.5,
  massageLabColorBendsNoise: 0.15,
  massageLabColorBendsIterations: 1,
  massageLabColorBendsIntensity: 1.5,
  massageLabColorBendsBandWidth: 6,
  massageLabEvilEyeIntensity: 1.5,
  massageLabEvilEyePupilSize: 0.6,
  massageLabEvilEyeIrisWidth: 0.25,
  massageLabEvilEyeGlowIntensity: 0.35,
  massageLabEvilEyeScale: 0.8,
  massageLabEvilEyeNoiseScale: 1,
  massageLabEvilEyePupilFollow: 1,
  massageLabEvilEyeFlameSpeed: 1,
  massageLabEvilEyeInteractive: false,
  massageLabLineWavesSpeed: 0.3,
  massageLabLineWavesInnerLineCount: 32,
  massageLabLineWavesOuterLineCount: 36,
  massageLabLineWavesWarpIntensity: 1,
  massageLabLineWavesRotation: -45,
  massageLabLineWavesEdgeFadeWidth: 0,
  massageLabLineWavesColorCycleSpeed: 1,
  massageLabLineWavesBrightness: 0.2,
  massageLabLineWavesEnableMouseInteraction: false,
  massageLabLineWavesMouseInfluence: 2,
  massageLabRadarSpeed: 1,
  massageLabRadarScale: 0.5,
  massageLabRadarRingCount: 10,
  massageLabRadarSpokeCount: 10,
  massageLabRadarRingThickness: 0.05,
  massageLabRadarSpokeThickness: 0.01,
  massageLabRadarSweepSpeed: 1,
  massageLabRadarSweepWidth: 2,
  massageLabRadarSweepLobes: 1,
  massageLabRadarFalloff: 2,
  massageLabRadarBrightness: 1,
  massageLabRadarEnableMouseInteraction: false,
  massageLabRadarMouseInfluence: 0.1,
  massageLabSoftAuroraSpeed: 0.6,
  massageLabSoftAuroraScale: 1.5,
  massageLabSoftAuroraBrightness: 1,
  massageLabSoftAuroraNoiseFrequency: 2.5,
  massageLabSoftAuroraNoiseAmplitude: 1,
  massageLabSoftAuroraBandHeight: 0.5,
  massageLabSoftAuroraBandSpread: 1,
  massageLabSoftAuroraOctaveDecay: 0.1,
  massageLabSoftAuroraLayerOffset: 0,
  massageLabSoftAuroraColorSpeed: 1,
  massageLabSoftAuroraEnableMouseInteraction: false,
  massageLabSoftAuroraMouseInfluence: 0.25,
  massageLabPlasmaSpeed: 1,
  massageLabPlasmaDirection: "forward",
  massageLabPlasmaScale: 1,
  massageLabPlasmaOpacity: 1,
  massageLabPlasmaMouseInteractive: false,
  massageLabPlasmaWaveXOffset: 0,
  massageLabPlasmaWaveYOffset: 0,
  massageLabPlasmaWaveRotationDeg: 0,
  massageLabPlasmaWaveFocalLength: 0.8,
  massageLabPlasmaWaveSpeedOne: 0.05,
  massageLabPlasmaWaveSpeedTwo: 0.05,
  massageLabPlasmaWaveDirectionTwo: 1,
  massageLabPlasmaWaveBendOne: 1,
  massageLabPlasmaWaveBendTwo: 0.5,
  massageLabParticlesCount: 200,
  massageLabParticlesSpread: 10,
  massageLabParticlesSpeed: 0.1,
  massageLabParticlesMoveOnHover: false,
  massageLabParticlesHoverFactor: 1,
  massageLabParticlesAlpha: false,
  massageLabParticlesBaseSize: 100,
  massageLabParticlesSizeRandomness: 1,
  massageLabParticlesCameraDistance: 20,
  massageLabParticlesDisableRotation: false,
  massageLabParticlesPixelRatio: 1,
  massageLabGradientBlindsAngle: 0,
  massageLabGradientBlindsNoise: 0.3,
  massageLabGradientBlindsBlindCount: 16,
  massageLabGradientBlindsBlindMinWidth: 60,
  massageLabGradientBlindsMouseDampening: 0.15,
  massageLabGradientBlindsMirror: false,
  massageLabGradientBlindsSpotlightRadius: 0.5,
  massageLabGradientBlindsSpotlightSoftness: 1,
  massageLabGradientBlindsSpotlightOpacity: 1,
  massageLabGradientBlindsDistort: 0,
  massageLabGradientBlindsShineDirection: "left",
  massageLabGradientBlindsBlendMode: "lighten",
  massageLabGradientBlindsDpr: 1,
  massageLabGradientBlindsEnableMouseInteraction: false,
  massageLabGrainientTimeSpeed: 0.25,
  massageLabGrainientColorBalance: 0,
  massageLabGrainientWarpStrength: 1,
  massageLabGrainientWarpFrequency: 5,
  massageLabGrainientWarpSpeed: 2,
  massageLabGrainientWarpAmplitude: 50,
  massageLabGrainientBlendAngle: 0,
  massageLabGrainientBlendSoftness: 0.05,
  massageLabGrainientRotationAmount: 500,
  massageLabGrainientNoiseScale: 2,
  massageLabGrainientGrainAmount: 0.1,
  massageLabGrainientGrainScale: 2,
  massageLabGrainientGrainAnimated: false,
  massageLabGrainientContrast: 1.5,
  massageLabGrainientGamma: 1,
  massageLabGrainientSaturation: 1,
  massageLabGrainientCenterX: 0,
  massageLabGrainientCenterY: 0,
  massageLabGrainientZoom: 0.9,
  massageLabGridScanSensitivity: 0.55,
  massageLabGridScanLineThickness: 1,
  massageLabGridScanScanOpacity: 0.4,
  massageLabGridScanGridScale: 0.1,
  massageLabGridScanLineStyle: "solid",
  massageLabGridScanLineJitter: 0.1,
  massageLabGridScanDirection: "pingpong",
  massageLabGridScanNoiseIntensity: 0.01,
  massageLabGridScanBloomOpacity: 0,
  massageLabGridScanScanGlow: 0.5,
  massageLabGridScanScanSoftness: 2,
  massageLabGridScanPhaseTaper: 0.49,
  massageLabGridScanScanDuration: 2,
  massageLabGridScanScanDelay: 2,
  massageLabGridScanEnablePointerInteraction: false,
  massageLabGridScanScanOnClick: false,
  massageLabBeamsBeamWidth: 2,
  massageLabBeamsBeamHeight: 15,
  massageLabBeamsBeamNumber: 12,
  massageLabBeamsSpeed: 2,
  massageLabBeamsNoiseIntensity: 1.75,
  massageLabBeamsScale: 0.2,
  massageLabBeamsRotation: 0,
  massageLabPixelSnowFlakeSize: 0.01,
  massageLabPixelSnowMinFlakeSize: 1.25,
  massageLabPixelSnowPixelResolution: 200,
  massageLabPixelSnowSpeed: 1.25,
  massageLabPixelSnowDepthFade: 8,
  massageLabPixelSnowFarPlane: 20,
  massageLabPixelSnowBrightness: 1,
  massageLabPixelSnowGamma: 0.4545,
  massageLabPixelSnowDensity: 0.3,
  massageLabPixelSnowVariant: "square",
  massageLabPixelSnowDirection: 125,
  massageLabLightningXOffset: 0,
  massageLabLightningSpeed: 1,
  massageLabLightningIntensity: 1,
  massageLabLightningSize: 1,
  massageLabPrismaticBurstIntensity: 2,
  massageLabPrismaticBurstSpeed: 0.5,
  massageLabPrismaticBurstAnimationType: "rotate3d",
  massageLabPrismaticBurstDistort: 0,
  massageLabPrismaticBurstOffsetX: 0,
  massageLabPrismaticBurstOffsetY: 0,
  massageLabPrismaticBurstHoverDampness: 0,
  massageLabPrismaticBurstRayCount: 0,
  massageLabPrismaticBurstMixBlendMode: "lighten",
  massageLabGalaxyHueShift: 140,
  massageLabGalaxyFocalX: 0.5,
  massageLabGalaxyFocalY: 0.5,
  massageLabGalaxyRotationDeg: 0,
  massageLabGalaxyStarSpeed: 0.5,
  massageLabGalaxyDensity: 1,
  massageLabGalaxySpeed: 1,
  massageLabGalaxyMouseInteraction: true,
  massageLabGalaxyGlowIntensity: 0.3,
  massageLabGalaxySaturation: 0,
  massageLabGalaxyMouseRepulsion: true,
  massageLabGalaxyRepulsionStrength: 2,
  massageLabGalaxyTwinkleIntensity: 0.3,
  massageLabGalaxyRotationSpeed: 0.1,
  massageLabGalaxyAutoCenterRepulsion: 0,
  massageLabGalaxyTransparent: true,
  massageLabDitherWaveSpeed: 0.05,
  massageLabDitherWaveFrequency: 3,
  massageLabDitherWaveAmplitude: 0.3,
  massageLabDitherColorNum: 4,
  massageLabDitherPixelSize: 2,
  massageLabDitherMouseInteraction: true,
  massageLabDitherMouseRadius: 1,
  massageLabFaultyTerminalScale: 1,
  massageLabFaultyTerminalGridMulX: 2,
  massageLabFaultyTerminalGridMulY: 1,
  massageLabFaultyTerminalDigitSize: 1.5,
  massageLabFaultyTerminalTimeScale: 0.3,
  massageLabFaultyTerminalScanlineIntensity: 0.3,
  massageLabFaultyTerminalGlitchAmount: 1,
  massageLabFaultyTerminalFlickerAmount: 1,
  massageLabFaultyTerminalNoiseAmp: 0,
  massageLabFaultyTerminalChromaticAberration: 0,
  massageLabFaultyTerminalDither: 0,
  massageLabFaultyTerminalCurvature: 0.2,
  massageLabFaultyTerminalMouseReact: true,
  massageLabFaultyTerminalMouseStrength: 0.2,
  massageLabFaultyTerminalPageLoadAnimation: true,
  massageLabFaultyTerminalBrightness: 1,
  massageLabRippleGridRippleIntensity: 0.05,
  massageLabRippleGridGridSize: 10,
  massageLabRippleGridGridThickness: 15,
  massageLabRippleGridFadeDistance: 1.5,
  massageLabRippleGridVignetteStrength: 2,
  massageLabRippleGridGlowIntensity: 0.1,
  massageLabRippleGridOpacity: 1,
  massageLabRippleGridGridRotation: 0,
  massageLabRippleGridMouseInteraction: true,
  massageLabRippleGridMouseInteractionRadius: 1,
  massageLabDotFieldDotRadius: 1.5,
  massageLabDotFieldDotSpacing: 14,
  massageLabDotFieldCursorRadius: 500,
  massageLabDotFieldCursorForce: 0.1,
  massageLabDotFieldBulgeOnly: true,
  massageLabDotFieldBulgeStrength: 67,
  massageLabDotFieldGlowRadius: 160,
  massageLabDotFieldSparkle: false,
  massageLabDotFieldWaveAmplitude: 0,
  massageLabDotFieldCursorInteraction: true,
  massageLabDotGridDotSize: 16,
  massageLabDotGridGap: 32,
  massageLabDotGridProximity: 150,
  massageLabDotGridSpeedTrigger: 100,
  massageLabDotGridShockRadius: 250,
  massageLabDotGridShockStrength: 5,
  massageLabDotGridMaxSpeed: 5000,
  massageLabDotGridResistance: 750,
  massageLabDotGridReturnDuration: 1.5,
  massageLabDotGridCursorInteraction: true,
  massageLabDotGridClickShock: true,
  massageLabThreadsAmplitude: 1,
  massageLabThreadsDistance: 0,
  massageLabThreadsEnableMouseInteraction: false,
  massageLabIridescenceSpeed: 1,
  massageLabIridescenceAmplitude: 0.1,
  massageLabIridescenceMouseReact: true,
  massageLabWavesTransparentBackground: true,
  massageLabWavesSpeedX: 0.0125,
  massageLabWavesSpeedY: 0.005,
  massageLabWavesAmplitudeX: 32,
  massageLabWavesAmplitudeY: 16,
  massageLabWavesGapX: 10,
  massageLabWavesGapY: 32,
  massageLabWavesFriction: 0.925,
  massageLabWavesTension: 0.005,
  massageLabWavesMaxCursorMove: 100,
  massageLabWavesCursorInteraction: true,
  massageLabGridDistortionGrid: 15,
  massageLabGridDistortionMouse: 0.1,
  massageLabGridDistortionStrength: 0.15,
  massageLabGridDistortionRelaxation: 0.9,
  massageLabGridDistortionCursorInteraction: true,
  massageLabOrbHoverIntensity: 0.2,
  massageLabOrbRotateOnHover: true,
  massageLabOrbForceHoverState: false,
  massageLabOrbCursorInteraction: true,
  massageLabLetterGlitchGlitchSpeed: 50,
  massageLabLetterGlitchCenterVignette: false,
  massageLabLetterGlitchOuterVignette: true,
  massageLabLetterGlitchSmooth: true,
  massageLabLetterGlitchCharacters: "ABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$&*()-_+=/[]{};:<>.,0123456789",
  massageLabGridMotionMaxMoveAmount: 300,
  massageLabGridMotionBaseDuration: 0.8,
  massageLabGridMotionCursorInteraction: true,
  massageLabShapeGridDirection: "right",
  massageLabShapeGridSpeed: 1,
  massageLabShapeGridSquareSize: 40,
  massageLabShapeGridShape: "square",
  massageLabShapeGridHoverTrailAmount: 0,
  massageLabShapeGridCursorInteraction: true,
  massageLabLiquidChromeSpeed: 0.2,
  massageLabLiquidChromeAmplitude: 0.3,
  massageLabLiquidChromeFrequencyX: 3,
  massageLabLiquidChromeFrequencyY: 3,
  massageLabLiquidChromeInteractive: true,
  massageLabBalatroSpinRotation: -2,
  massageLabBalatroSpinSpeed: 7,
  massageLabBalatroOffsetX: 0,
  massageLabBalatroOffsetY: 0,
  massageLabBalatroContrast: 3.5,
  massageLabBalatroLighting: 0.4,
  massageLabBalatroSpinAmount: 0.25,
  massageLabBalatroPixelFilter: 745,
  massageLabBalatroSpinEase: 1,
  massageLabBalatroIsRotate: false,
  massageLabBalatroMouseInteraction: true,
  massageLabNovatrixSpeed: 1,
  massageLabNovatrixAmplitude: 0.1,
  massageLabMatrixRainSpeed: 1,
  massageLabMatrixRainFontSize: 8,
  massageLabPhotonBeamLineCount: 80,
  massageLabPhotonBeamSpreadHeight: 50,
  massageLabPhotonBeamSpreadDepth: 0,
  massageLabPhotonBeamCurveLength: 50,
  massageLabPhotonBeamStraightLength: 100,
  massageLabPhotonBeamCurvePower: 0.8265,
  massageLabPhotonBeamWaveSpeed: 2.48,
  massageLabPhotonBeamWaveHeight: 0.145,
  massageLabPhotonBeamLineOpacity: 0.557,
  massageLabPhotonBeamSignalCount: 94,
  massageLabPhotonBeamSpeedGlobal: 0.345,
  massageLabPhotonBeamTrailLength: 3,
  massageLabPhotonBeamBloomStrength: 3,
  massageLabPhotonBeamBloomRadius: 0.5,
  massageLab3DGlobeViewStyle: "realistic",
  massageLab3DGlobeGraphicMapSamples: 8000,
  massageLab3DGlobeAutoRotateSpeed: 0.3,
  massageLab3DGlobeReverseSpin: true,
  massageLab3DGlobeScale: 0.4,
  massageLab3DGlobeBumpScale: 1,
  massageLab3DGlobeAmbientIntensity: 0.6,
  massageLab3DGlobePointLightIntensity: 1.5,
  massageLab3DGlobeLightingMode: "manual",
  massageLab3DGlobeEnablePan: false,
  massageLab3DGlobePanX: 0,
  massageLab3DGlobePanY: 0,
  massageLab3DGlobeShowTilt: true,
  massageLab3DGlobeShowAtmosphere: false,
  massageLab3DGlobeAtmosphereIntensity: 0.5,
  massageLab3DGlobeAtmosphereBlur: 2,
  massageLab3DGlobeShowWireframe: false,
  massageLab3DGlobeMarkerEnabled: false,
  massageLab3DGlobeMarkerLat: 39.8283,
  massageLab3DGlobeMarkerLng: -98.5795,
  massageLab3DGlobeMarkerLabel: "Your location",
  massageLab3DGlobeMarkerIcon: "pin",
  massageLab3DGlobeMarkerSize: 0.06,
  massageLabRetroGridAngle: 65,
  massageLabRetroGridCellSize: 60,
  massageLabRetroGridOpacity: 0.5,
  massageLabAerialRaysCount: 7,
  massageLabAerialRaysBlur: 36,
  massageLabAerialRaysSpeed: 14,
  massageLabAerialRaysLength: 70,
  massageLabAerialRaysOpacity: 0.65,
  massageLabDnaStrandCount: 13,
  massageLabDnaNodeMotionSpeed: 1,
  massageLabDnaStrandRotationSpeed: 1,
  massageLabDnaStrandAngle: 30,
  massageLabDnaScale: 1,
  massageLabDnaPositionX: 0,
  massageLabDnaPositionY: 0,
  massageLabDnaStrandSpacing: 0.5,
  massageLabDnaConnectorWidth: 94,
  massageLabDnaConnectorThickness: 30,
  massageLabDnaOutlineThickness: 0.5,
  massageLabTwistedCubesLayerCount: 20,
  massageLabTwistedCubesRotationSpeed: 1,
  massageLabTwistedCubesLayerStagger: 0.1,
  massageLabTwistedCubesViewAngleX: -35,
  massageLabTwistedCubesViewAngleY: -45,
  massageLabTwistedCubesScale: 1,
  massageLabTwistedCubesPositionX: 0,
  massageLabTwistedCubesPositionY: 0,
  massageLabTwistedCubesLayerDepthSpacing: 50,
  massageLabTwistedCubesOpacityFalloff: 0.85,
  massageLabTwistedCubesOutlineThickness: 0.0075,
  massageLabSynthesisSpeed: 0.4,
  massageLabSynthesisComplexity: 6,
  massageLabSynthesisScale: 1,
  massageLabSynthesisDistortion: 0.6,
  massageLabSynthesisGlowIntensity: 0.4,
  massageLabSynthesisFlowFrequency: 3,
  backgroundLinesDuration: 10,
  shootingStarsDensity: 0.00015,
  shootingStarsTwinkle: true,
  shootingStarsTwinkleSpeed: 1,
  shootingStarsShootingSpeed: 1,
  shootingStarsFrequency: 1,
  canvasRevealDotsDotSize: 3,
  canvasRevealDotsDotSpacing: 6,
  canvasRevealDotsOpacity: 0.72,
  canvasRevealDotsAnimationSpeed: 0.4,
  canvasRevealDotsShowGradient: false,
  spotlightOpacity: 1,
  spotlightWidth: 560,
  spotlightHeight: 1380,
  spotlightSmallWidth: 240,
  spotlightTranslateY: -350,
  spotlightDuration: 7,
  spotlightXOffset: 100,
  lampGlowOpacity: 0.5,
  lampBeamWidth: 480,
  lampGlowWidth: 448,
  lampVerticalOffset: -112,
  lampPulseSpeed: 9,
  vortexParticleCount: 420,
  vortexRangeY: 120,
  vortexBaseSpeed: 0,
  vortexRangeSpeed: 1.2,
  vortexBaseRadius: 1,
  vortexRangeRadius: 2,
  wavyWaveWidth: 50,
  wavyBlur: 10,
  wavySpeed: "fast",
  wavyWaveOpacity: 0.5,
  auroraBarsBarCount: 24,
  auroraBarsSpeed: 0.5,
  auroraBarsBlur: 0,
  auroraBarsGap: 3,
  auroraBarsMaxHeightRatio: 0.92,
  auroraBarsMinHeightRatio: 0.18,
  pixelLiquidPixelSize: 8,
  pixelLiquidDetail: "medium",
  pixelLiquidCursorForce: 0.7,
  pixelLiquidCursorSize: 0.12,
  pixelLiquidAutoDemo: true,
  pixelLiquidMotionSpeed: 0.72,
  tileGridTileSize: 44,
  tileGridJointSize: 3,
  tileGridChangeFrequency: TILE_GRID_FADE_SECONDS_DEFAULT,
  tileGridActivePercent: 14,
  tileGridOpacity: 0.68,
  hexGridHexSize: 48,
  hexGridJointSize: 3,
  hexGridChangeFrequency: TILE_GRID_FADE_SECONDS_DEFAULT,
  hexGridActivePercent: 14,
  hexGridOpacity: 0.72,
})

/** Renderer source colors stay adapter-owned and are never written to account or local settings. */

export const DEFAULT_CHIMER_SETTINGS = Object.freeze(
  omitLegacyBackgroundColorSettings(CHIMER_SETTINGS_WITH_RENDERER_SOURCE_DEFAULTS),
)

const LEGACY_CANVAS_REVEAL_DOTS_DEFAULTS = Object.freeze({
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

/**
 * Parses a globe coordinate draft without coercing an empty or partial input
 * to zero. Callers commit only the finite value returned within the axis range.
 */
export function parseGlobeCoordinateDraft(value, min, max) {
  if (typeof value !== "string" && typeof value !== "number") {
    return null
  }
  if (typeof value === "string" && value.trim() === "") {
    return null
  }
  const number = Number(value)
  return Number.isFinite(number) && number >= min && number <= max ? number : null
}

export function getMassageLab3DGlobeScaleDisplayPercent(value) {
  const scale = normalizeNumber(
    value,
    DEFAULT_CHIMER_SETTINGS.massageLab3DGlobeScale,
    MASSAGE_LAB_3D_GLOBE_MIN_SCALE,
    MASSAGE_LAB_3D_GLOBE_MAX_SCALE,
  )
  return Math.round(
    1
      + ((scale - MASSAGE_LAB_3D_GLOBE_MIN_SCALE)
        / (MASSAGE_LAB_3D_GLOBE_MAX_SCALE - MASSAGE_LAB_3D_GLOBE_MIN_SCALE)) * 99,
  )
}

export function getMassageLab3DGlobeScaleFromDisplayPercent(value) {
  const percent = normalizeNumber(
    value,
    getMassageLab3DGlobeScaleDisplayPercent(DEFAULT_CHIMER_SETTINGS.massageLab3DGlobeScale),
    1,
    100,
  )
  const scale = MASSAGE_LAB_3D_GLOBE_MIN_SCALE
    + ((percent - 1) / 99) * (MASSAGE_LAB_3D_GLOBE_MAX_SCALE - MASSAGE_LAB_3D_GLOBE_MIN_SCALE)
  return Number(scale.toFixed(4))
}

function normalizeMassageLab3DGlobeLightingMode(value, fallback) {
  return value === "sun" || value === "manual" ? value : fallback
}

function normalizeMassageLab3DGlobeViewStyle(value, fallback) {
  return value === "graphic" || value === "realistic" ? value : fallback
}

function normalizeMassageLabLightSpeedWarpSpeed(value, fallback, version) {
  const number = Number(value)
  if (!Number.isFinite(number)) {
    return fallback
  }

  // Version 1 stored the source-scale value where 0.10 was MassageLab's slow default.
  // Version 2 stores the user-facing multiplier where 1.00 renders at that same pace.
  const scaledValue = version === MASSAGE_LAB_LIGHT_SPEED_WARP_SPEED_VERSION
    ? number
    : number * MASSAGE_LAB_LIGHT_SPEED_LEGACY_WARP_SCALE
  return normalizeNumber(scaledValue, fallback, 0.1, 24)
}

function normalizeMassageLabElectricMistSpeedPercent(value, fallback, version) {
  const number = Number(value)
  if (!Number.isFinite(number)) {
    return fallback
  }

  // Version 1 stored the source-scale speed where 1.00 was the default. Version 2
  // stores the user-facing percentage so the control can show 100% as default.
  const percentValue = Number(version) === MASSAGE_LAB_ELECTRIC_MIST_CONTROL_VERSION ? number : number * 100
  return normalizeNumber(percentValue, fallback, 1, 400)
}

function normalizeMassageLabElectricMistBrightnessPercent(value, fallback, version) {
  const number = Number(value)
  if (!Number.isFinite(number)) {
    return fallback
  }

  // Version 1 stored the source shader brightness multiplier. Version 2 stores a
  // direct output-intensity percentage, including a true 1% lower bound.
  const percentValue = Number(version) === MASSAGE_LAB_ELECTRIC_MIST_CONTROL_VERSION ? number : number * 100
  return normalizeNumber(percentValue, fallback, 1, 100)
}

function normalizeChoice(value, fallback, choices) {
  return choices.includes(value) ? value : fallback
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

/**
 * Normalizes nested shared visual preferences against a caller-injected
 * adapter inventory. Missing inventory fails closed, while accepted visual
 * values reuse the canonical Chimer clamps.
 */
export function normalizeChimerBackgroundVisualPreferences(value, backgroundPreferenceOptions = {}) {
  return normalizeSharedBackgroundVisualPreferences(value, {
    ...backgroundPreferenceOptions,
    normalizeVisualProperties: (properties) => {
      const sanitized = sanitizeChimerSettings(properties, { skipBackgroundVisualPreferences: true })
      return Object.fromEntries(
        Object.keys(properties)
          .map((key) => [key, sanitized[key]]),
      )
    },
  })
}

export function sanitizeChimerSettings(input = {}, options = {}) {
  const fallback = CHIMER_SETTINGS_WITH_RENDERER_SOURCE_DEFAULTS
  const duration = normalizeDuration(input.hours, input.minutes)
  const intervalType = ["preset", "custom", "areas"].includes(input.intervalType)
    ? input.intervalType
    : fallback.intervalType
  const alertType = normalizeChoice(input.alertType, fallback.alertType, ALERT_TYPES)
  const timeFormat = normalizeTimeFormat(
    input.timeFormat,
    input.showCurrentTimeAmPm === false ? "24h" : fallback.timeFormat,
  )
  const massageLabLightSpeedWarpSpeedVersion = input.massageLabLightSpeedWarpSpeedVersion === MASSAGE_LAB_LIGHT_SPEED_WARP_SPEED_VERSION
    ? MASSAGE_LAB_LIGHT_SPEED_WARP_SPEED_VERSION
    : 1

  const sanitizedSettings = {
    hours: duration.hours,
    minutes: duration.minutes,
    intervalType,
    customInterval: normalizeInteger(input.customInterval, fallback.customInterval, 1, 240),
    areasToMassage: normalizeInteger(input.areasToMassage, fallback.areasToMassage, 1, 24),
    alertType,
    alertVolume: normalizeNumber(input.alertVolume, fallback.alertVolume, 0, 1),
    hapticIntensityMs: normalizeInteger(input.hapticIntensityMs, fallback.hapticIntensityMs, 10, 30),
    movingBackgroundEnabled:
      typeof input.movingBackgroundEnabled === "boolean" ? input.movingBackgroundEnabled : fallback.movingBackgroundEnabled,
    backgroundId: normalizeBackgroundId(input.backgroundId, fallback.backgroundId),
    keepTimerScreenAwake:
      typeof input.keepTimerScreenAwake === "boolean" ? input.keepTimerScreenAwake : fallback.keepTimerScreenAwake,
    showClockDisplay:
      typeof input.showClockDisplay === "boolean" ? input.showClockDisplay : fallback.showClockDisplay,
    clockRotationEnabled:
      typeof input.clockRotationEnabled === "boolean" ? input.clockRotationEnabled : fallback.clockRotationEnabled,
    clockRotationRange: normalizeNumber(input.clockRotationRange, fallback.clockRotationRange, 2, 20),
    clockRotationDuration: normalizeNumber(input.clockRotationDuration, fallback.clockRotationDuration, 10, 120),
    clockForwardGlowEnabled:
      typeof input.clockForwardGlowEnabled === "boolean"
        ? input.clockForwardGlowEnabled
        : fallback.clockForwardGlowEnabled,
    clockForwardGlowStrength: normalizeNumber(
      input.clockForwardGlowStrength,
      fallback.clockForwardGlowStrength,
      0,
      1,
    ),
    clockForwardGlowLength: normalizeNumber(input.clockForwardGlowLength, fallback.clockForwardGlowLength, 0.5, 4),
    clockForwardGlowBlur: normalizeNumber(input.clockForwardGlowBlur, fallback.clockForwardGlowBlur, 0, 64),
    showTimerSeconds:
      typeof input.showTimerSeconds === "boolean" ? input.showTimerSeconds : fallback.showTimerSeconds,
    showCurrentTimeSeconds:
      typeof input.showCurrentTimeSeconds === "boolean" ? input.showCurrentTimeSeconds : fallback.showCurrentTimeSeconds,
    timeFormat,
    primaryFontColor: normalizeHexColor(input.primaryFontColor, fallback.primaryFontColor),
    secondaryFontColor: normalizeHexColor(input.secondaryFontColor, fallback.secondaryFontColor),
    clockModeFontColor: normalizeHexColor(input.clockModeFontColor, fallback.clockModeFontColor),
    clockFontFamily: normalizeChoice(input.clockFontFamily, fallback.clockFontFamily, CLOCK_FONT_FAMILIES),
    clockStrokeEnabled:
      typeof input.clockStrokeEnabled === "boolean" ? input.clockStrokeEnabled : fallback.clockStrokeEnabled,
    clockStrokeColor: normalizeHexColor(input.clockStrokeColor, fallback.clockStrokeColor),
    clockStrokeWidth: normalizeNumber(input.clockStrokeWidth, fallback.clockStrokeWidth, 0, 3),
    clockShadowEnabled:
      typeof input.clockShadowEnabled === "boolean" ? input.clockShadowEnabled : fallback.clockShadowEnabled,
    clockShadowColor: normalizeHexColor(input.clockShadowColor, fallback.clockShadowColor),
    clockShadowStrength: normalizeNumber(input.clockShadowStrength, fallback.clockShadowStrength, 0, 1),
    clockShadowDirection: normalizeNumber(input.clockShadowDirection, fallback.clockShadowDirection, 0, 360),
    clockShadowDistance: normalizeNumber(input.clockShadowDistance, fallback.clockShadowDistance, 0, 32),
    clockShadowFeather: normalizeNumber(input.clockShadowFeather, fallback.clockShadowFeather, 0, 32),
    clockGlowEnabled:
      typeof input.clockGlowEnabled === "boolean" ? input.clockGlowEnabled : fallback.clockGlowEnabled,
    clockGlowColor: normalizeHexColor(input.clockGlowColor, fallback.clockGlowColor),
    clockGlowStrength: normalizeNumber(input.clockGlowStrength, fallback.clockGlowStrength, 0, 1),
    sparklesMaxSize: normalizeNumber(input.sparklesMaxSize, fallback.sparklesMaxSize, 1, 6),
    sparklesMinSize: normalizeNumber(input.sparklesMinSize, fallback.sparklesMinSize, 0.5, 4),
    sparklesParticleDensity: normalizeInteger(input.sparklesParticleDensity, fallback.sparklesParticleDensity, 20, 220),
    sparklesSpeed: normalizeNumber(input.sparklesSpeed, fallback.sparklesSpeed, 0.5, 8),
    gradientAnimationSpeed: normalizeNumber(input.gradientAnimationSpeed, fallback.gradientAnimationSpeed, 0.25, 2.5),
    gradientAnimationSize: normalizeNumber(input.gradientAnimationSize, fallback.gradientAnimationSize, 45, 120),
    massageLabGradientOpacity: normalizeNumber(input.massageLabGradientOpacity, fallback.massageLabGradientOpacity, 0.15, 1),
    massageLabStarsSpeed: normalizeNumber(input.massageLabStarsSpeed, fallback.massageLabStarsSpeed, 18, 120),
    massageLabStarsDensity: normalizeNumber(input.massageLabStarsDensity, fallback.massageLabStarsDensity, 0.25, 1.5),
    massageLabStarsParallax: normalizeNumber(input.massageLabStarsParallax, fallback.massageLabStarsParallax, 0, 0.12),
    massageLabHoleLineCount: normalizeInteger(input.massageLabHoleLineCount, fallback.massageLabHoleLineCount, 12, 96),
    massageLabHoleDiscCount: normalizeInteger(input.massageLabHoleDiscCount, fallback.massageLabHoleDiscCount, 12, 96),
    massageLabLightSpeedWarpSpeed: normalizeMassageLabLightSpeedWarpSpeed(
      input.massageLabLightSpeedWarpSpeed,
      fallback.massageLabLightSpeedWarpSpeed,
      massageLabLightSpeedWarpSpeedVersion,
    ),
    massageLabLightSpeedWarpSpeedVersion: MASSAGE_LAB_LIGHT_SPEED_WARP_SPEED_VERSION,
    massageLabLightSpeedParticleCount: normalizeInteger(input.massageLabLightSpeedParticleCount, fallback.massageLabLightSpeedParticleCount, 20, 200),
    massageLabLightSpeedIntensity: normalizeNumber(input.massageLabLightSpeedIntensity, fallback.massageLabLightSpeedIntensity, 0.25, 6),
    massageLabLightSpeedRadius: normalizeNumber(input.massageLabLightSpeedRadius, fallback.massageLabLightSpeedRadius, 6, 60),
    massageLabLightSpeedCylinderLength: normalizeNumber(input.massageLabLightSpeedCylinderLength, fallback.massageLabLightSpeedCylinderLength, 40, 300),
    massageLabElectricMistSpeed: normalizeMassageLabElectricMistSpeedPercent(
      input.massageLabElectricMistSpeed,
      fallback.massageLabElectricMistSpeed,
      input.massageLabElectricMistControlVersion,
    ),
    massageLabElectricMistControlVersion: MASSAGE_LAB_ELECTRIC_MIST_CONTROL_VERSION,
    massageLabElectricMistDetail: normalizeNumber(input.massageLabElectricMistDetail, fallback.massageLabElectricMistDetail, 0.5, 4),
    massageLabElectricMistDistortion: normalizeNumber(input.massageLabElectricMistDistortion, fallback.massageLabElectricMistDistortion, 0, 8),
    massageLabElectricMistBrightness: normalizeMassageLabElectricMistBrightnessPercent(
      input.massageLabElectricMistBrightness,
      fallback.massageLabElectricMistBrightness,
      input.massageLabElectricMistControlVersion,
    ),
    massageLabAstralFlowSpeed: normalizeNumber(input.massageLabAstralFlowSpeed, fallback.massageLabAstralFlowSpeed, 0.1, 3),
    massageLabAstralFlowFlowMin: normalizeNumber(input.massageLabAstralFlowFlowMin, fallback.massageLabAstralFlowFlowMin, 0.5, 10),
    massageLabAstralFlowFlowMax: normalizeNumber(input.massageLabAstralFlowFlowMax, fallback.massageLabAstralFlowFlowMax, 1, 12),
    massageLabDeepSpaceNebulaSpeed: normalizeNumber(
      input.massageLabDeepSpaceNebulaSpeed,
      fallback.massageLabDeepSpaceNebulaSpeed,
      0.1,
      5,
    ),
    massageLabGridBloomSpeed: normalizeNumber(input.massageLabGridBloomSpeed, fallback.massageLabGridBloomSpeed, 0.1, 3),
    massageLabGridBloomGridScale: normalizeNumber(
      input.massageLabGridBloomGridScale,
      fallback.massageLabGridBloomGridScale,
      4,
      32,
    ),
    massageLabGridBloomRotationSpeed: normalizeNumber(
      input.massageLabGridBloomRotationSpeed,
      fallback.massageLabGridBloomRotationSpeed,
      -3,
      3,
    ),
    massageLabGridBloomFadeFalloff: normalizeNumber(
      input.massageLabGridBloomFadeFalloff,
      fallback.massageLabGridBloomFadeFalloff,
      1,
      24,
    ),
    massageLabGridBloomDistortionAmount: normalizeNumber(
      input.massageLabGridBloomDistortionAmount,
      fallback.massageLabGridBloomDistortionAmount,
      0,
      0.5,
    ),
    massageLabGridBloomFlowSpeedX: normalizeNumber(
      input.massageLabGridBloomFlowSpeedX,
      fallback.massageLabGridBloomFlowSpeedX,
      -2,
      2,
    ),
    massageLabGridBloomFlowSpeedY: normalizeNumber(
      input.massageLabGridBloomFlowSpeedY,
      fallback.massageLabGridBloomFlowSpeedY,
      -2,
      2,
    ),
    massageLabChromeFlowFlowSpeed: normalizeNumber(
      input.massageLabChromeFlowFlowSpeed,
      fallback.massageLabChromeFlowFlowSpeed,
      0.01,
      2,
    ),
    massageLabChromeFlowTimeScale: normalizeNumber(
      input.massageLabChromeFlowTimeScale,
      fallback.massageLabChromeFlowTimeScale,
      0.001,
      1,
    ),
    massageLabWaveCurrentSpeedX: normalizeNumber(
      input.massageLabWaveCurrentSpeedX,
      fallback.massageLabWaveCurrentSpeedX,
      0.001,
      0.1,
    ),
    massageLabWaveCurrentSpeedY: normalizeNumber(
      input.massageLabWaveCurrentSpeedY,
      fallback.massageLabWaveCurrentSpeedY,
      0.001,
      0.1,
    ),
    massageLabWaveCurrentAmplitude: normalizeNumber(
      input.massageLabWaveCurrentAmplitude,
      fallback.massageLabWaveCurrentAmplitude,
      8,
      64,
    ),
    massageLabFerrofluidSpeed: normalizeNumber(
      input.massageLabFerrofluidSpeed,
      fallback.massageLabFerrofluidSpeed,
      0.05,
      2,
    ),
    massageLabFerrofluidScale: normalizeNumber(
      input.massageLabFerrofluidScale,
      fallback.massageLabFerrofluidScale,
      0.5,
      4,
    ),
    massageLabFerrofluidTurbulence: normalizeNumber(
      input.massageLabFerrofluidTurbulence,
      fallback.massageLabFerrofluidTurbulence,
      0,
      2,
    ),
    massageLabFerrofluidFluidity: normalizeNumber(
      input.massageLabFerrofluidFluidity,
      fallback.massageLabFerrofluidFluidity,
      0.001,
      0.4,
    ),
    massageLabFerrofluidRimWidth: normalizeNumber(
      input.massageLabFerrofluidRimWidth,
      fallback.massageLabFerrofluidRimWidth,
      0.03,
      0.5,
    ),
    massageLabFerrofluidSharpness: normalizeNumber(
      input.massageLabFerrofluidSharpness,
      fallback.massageLabFerrofluidSharpness,
      0.5,
      6,
    ),
    massageLabFerrofluidShimmer: normalizeNumber(
      input.massageLabFerrofluidShimmer,
      fallback.massageLabFerrofluidShimmer,
      0,
      4,
    ),
    massageLabFerrofluidGlow: normalizeNumber(
      input.massageLabFerrofluidGlow,
      fallback.massageLabFerrofluidGlow,
      0.1,
      5,
    ),
    massageLabFerrofluidFlowDirection: normalizeChoice(
      input.massageLabFerrofluidFlowDirection,
      fallback.massageLabFerrofluidFlowDirection,
      ["up", "down", "left", "right"],
    ),
    massageLabFerrofluidOpacity: normalizeNumber(
      input.massageLabFerrofluidOpacity,
      fallback.massageLabFerrofluidOpacity,
      0.05,
      1,
    ),
    massageLabLightfallSpeed: normalizeNumber(
      input.massageLabLightfallSpeed,
      fallback.massageLabLightfallSpeed,
      0.05,
      2,
    ),
    massageLabLightfallStreakCount: Math.trunc(normalizeNumber(
      input.massageLabLightfallStreakCount,
      fallback.massageLabLightfallStreakCount,
      1,
      16,
    )),
    massageLabLightfallStreakWidth: normalizeNumber(
      input.massageLabLightfallStreakWidth,
      fallback.massageLabLightfallStreakWidth,
      0.2,
      3,
    ),
    massageLabLightfallStreakLength: normalizeNumber(
      input.massageLabLightfallStreakLength,
      fallback.massageLabLightfallStreakLength,
      0.2,
      3,
    ),
    massageLabLightfallGlow: normalizeNumber(
      input.massageLabLightfallGlow,
      fallback.massageLabLightfallGlow,
      0.1,
      3,
    ),
    massageLabLightfallDensity: normalizeNumber(
      input.massageLabLightfallDensity,
      fallback.massageLabLightfallDensity,
      0.05,
      2,
    ),
    massageLabLightfallTwinkle: normalizeNumber(
      input.massageLabLightfallTwinkle,
      fallback.massageLabLightfallTwinkle,
      0,
      1,
    ),
    massageLabLightfallZoom: normalizeNumber(
      input.massageLabLightfallZoom,
      fallback.massageLabLightfallZoom,
      1,
      6,
    ),
    massageLabLightfallBackgroundGlow: normalizeNumber(
      input.massageLabLightfallBackgroundGlow,
      fallback.massageLabLightfallBackgroundGlow,
      0,
      1.5,
    ),
    massageLabLightfallOpacity: normalizeNumber(
      input.massageLabLightfallOpacity,
      fallback.massageLabLightfallOpacity,
      0.05,
      1,
    ),
    massageLabLightfallCursorEnabled:
      typeof input.massageLabLightfallCursorEnabled === "boolean"
        ? input.massageLabLightfallCursorEnabled
        : fallback.massageLabLightfallCursorEnabled,
    massageLabLightfallCursorStrength: normalizeNumber(
      input.massageLabLightfallCursorStrength,
      fallback.massageLabLightfallCursorStrength,
      0,
      2,
    ),
    massageLabLightfallCursorRadius: normalizeNumber(
      input.massageLabLightfallCursorRadius,
      fallback.massageLabLightfallCursorRadius,
      0.05,
      3,
    ),
    massageLabLightfallCursorDampening: normalizeNumber(
      input.massageLabLightfallCursorDampening,
      fallback.massageLabLightfallCursorDampening,
      0,
      1,
    ),
    massageLabLiquidEtherCursorEnabled:
      typeof input.massageLabLiquidEtherCursorEnabled === "boolean"
        ? input.massageLabLiquidEtherCursorEnabled
        : fallback.massageLabLiquidEtherCursorEnabled,
    massageLabLiquidEtherMouseForce: normalizeNumber(
      input.massageLabLiquidEtherMouseForce,
      fallback.massageLabLiquidEtherMouseForce,
      0,
      80,
    ),
    massageLabLiquidEtherCursorSize: normalizeNumber(
      input.massageLabLiquidEtherCursorSize,
      fallback.massageLabLiquidEtherCursorSize,
      20,
      280,
    ),
    massageLabLiquidEtherIsViscous:
      typeof input.massageLabLiquidEtherIsViscous === "boolean"
        ? input.massageLabLiquidEtherIsViscous
        : fallback.massageLabLiquidEtherIsViscous,
    massageLabLiquidEtherViscous: normalizeNumber(
      input.massageLabLiquidEtherViscous,
      fallback.massageLabLiquidEtherViscous,
      0,
      80,
    ),
    massageLabLiquidEtherIterationsViscous: Math.trunc(normalizeNumber(
      input.massageLabLiquidEtherIterationsViscous,
      fallback.massageLabLiquidEtherIterationsViscous,
      4,
      64,
    )),
    massageLabLiquidEtherIterationsPoisson: Math.trunc(normalizeNumber(
      input.massageLabLiquidEtherIterationsPoisson,
      fallback.massageLabLiquidEtherIterationsPoisson,
      4,
      64,
    )),
    massageLabLiquidEtherDt: normalizeNumber(
      input.massageLabLiquidEtherDt,
      fallback.massageLabLiquidEtherDt,
      0.004,
      0.04,
    ),
    massageLabLiquidEtherBfecc:
      typeof input.massageLabLiquidEtherBfecc === "boolean"
        ? input.massageLabLiquidEtherBfecc
        : fallback.massageLabLiquidEtherBfecc,
    massageLabLiquidEtherResolution: normalizeNumber(
      input.massageLabLiquidEtherResolution,
      fallback.massageLabLiquidEtherResolution,
      0.2,
      1,
    ),
    massageLabLiquidEtherIsBounce:
      typeof input.massageLabLiquidEtherIsBounce === "boolean"
        ? input.massageLabLiquidEtherIsBounce
        : fallback.massageLabLiquidEtherIsBounce,
    massageLabLiquidEtherAutoDemo:
      typeof input.massageLabLiquidEtherAutoDemo === "boolean"
        ? input.massageLabLiquidEtherAutoDemo
        : fallback.massageLabLiquidEtherAutoDemo,
    massageLabLiquidEtherAutoSpeed: normalizeNumber(
      input.massageLabLiquidEtherAutoSpeed,
      fallback.massageLabLiquidEtherAutoSpeed,
      0.05,
      2,
    ),
    massageLabLiquidEtherAutoIntensity: normalizeNumber(
      input.massageLabLiquidEtherAutoIntensity,
      fallback.massageLabLiquidEtherAutoIntensity,
      0,
      5,
    ),
    massageLabLiquidEtherAutoResumeDelay: normalizeNumber(
      input.massageLabLiquidEtherAutoResumeDelay,
      fallback.massageLabLiquidEtherAutoResumeDelay,
      250,
      5000,
    ),
    massageLabLiquidEtherAutoRampDuration: normalizeNumber(
      input.massageLabLiquidEtherAutoRampDuration,
      fallback.massageLabLiquidEtherAutoRampDuration,
      0,
      3,
    ),
    massageLabLiquidEtherOpacity: normalizeNumber(
      input.massageLabLiquidEtherOpacity,
      fallback.massageLabLiquidEtherOpacity,
      0.05,
      1,
    ),
    massageLabPrismHeight: normalizeNumber(
      input.massageLabPrismHeight,
      fallback.massageLabPrismHeight,
      0.5,
      8,
    ),
    massageLabPrismBaseWidth: normalizeNumber(
      input.massageLabPrismBaseWidth,
      fallback.massageLabPrismBaseWidth,
      0.5,
      10,
    ),
    massageLabPrismAnimationType: normalizeChoice(
      input.massageLabPrismAnimationType,
      fallback.massageLabPrismAnimationType,
      ["rotate", "3drotate", "hover"],
    ),
    massageLabPrismGlow: normalizeNumber(
      input.massageLabPrismGlow,
      fallback.massageLabPrismGlow,
      0,
      3,
    ),
    massageLabPrismOffsetX: normalizeNumber(
      input.massageLabPrismOffsetX,
      fallback.massageLabPrismOffsetX,
      -400,
      400,
    ),
    massageLabPrismOffsetY: normalizeNumber(
      input.massageLabPrismOffsetY,
      fallback.massageLabPrismOffsetY,
      -400,
      400,
    ),
    massageLabPrismNoise: normalizeNumber(
      input.massageLabPrismNoise,
      fallback.massageLabPrismNoise,
      0,
      1,
    ),
    massageLabPrismTransparent:
      typeof input.massageLabPrismTransparent === "boolean"
        ? input.massageLabPrismTransparent
        : fallback.massageLabPrismTransparent,
    massageLabPrismScale: normalizeNumber(
      input.massageLabPrismScale,
      fallback.massageLabPrismScale,
      0.5,
      7,
    ),
    massageLabPrismHueShift: normalizeNumber(
      input.massageLabPrismHueShift,
      fallback.massageLabPrismHueShift,
      -Math.PI,
      Math.PI,
    ),
    massageLabPrismColorFrequency: normalizeNumber(
      input.massageLabPrismColorFrequency,
      fallback.massageLabPrismColorFrequency,
      0.1,
      3,
    ),
    massageLabPrismHoverStrength: normalizeNumber(
      input.massageLabPrismHoverStrength,
      fallback.massageLabPrismHoverStrength,
      0,
      4,
    ),
    massageLabPrismInertia: normalizeNumber(
      input.massageLabPrismInertia,
      fallback.massageLabPrismInertia,
      0.01,
      0.4,
    ),
    massageLabPrismBloom: normalizeNumber(
      input.massageLabPrismBloom,
      fallback.massageLabPrismBloom,
      0,
      3,
    ),
    massageLabPrismTimeScale: normalizeNumber(
      input.massageLabPrismTimeScale,
      fallback.massageLabPrismTimeScale,
      0,
      2,
    ),
    massageLabDarkVeilHueShift: normalizeNumber(
      input.massageLabDarkVeilHueShift,
      fallback.massageLabDarkVeilHueShift,
      -180,
      180,
    ),
    massageLabDarkVeilNoiseIntensity: normalizeNumber(
      input.massageLabDarkVeilNoiseIntensity,
      fallback.massageLabDarkVeilNoiseIntensity,
      0,
      1,
    ),
    massageLabDarkVeilScanlineIntensity: normalizeNumber(
      input.massageLabDarkVeilScanlineIntensity,
      fallback.massageLabDarkVeilScanlineIntensity,
      0,
      1,
    ),
    massageLabDarkVeilSpeed: normalizeNumber(
      input.massageLabDarkVeilSpeed,
      fallback.massageLabDarkVeilSpeed,
      0,
      2,
    ),
    massageLabDarkVeilScanlineFrequency: normalizeNumber(
      input.massageLabDarkVeilScanlineFrequency,
      fallback.massageLabDarkVeilScanlineFrequency,
      0,
      40,
    ),
    massageLabDarkVeilWarpAmount: normalizeNumber(
      input.massageLabDarkVeilWarpAmount,
      fallback.massageLabDarkVeilWarpAmount,
      0,
      2,
    ),
    massageLabDarkVeilResolutionScale: normalizeNumber(
      input.massageLabDarkVeilResolutionScale,
      fallback.massageLabDarkVeilResolutionScale,
      0.25,
      1,
    ),
    massageLabLightPillarIntensity: normalizeNumber(
      input.massageLabLightPillarIntensity,
      fallback.massageLabLightPillarIntensity,
      0.1,
      3,
    ),
    massageLabLightPillarRotationSpeed: normalizeNumber(
      input.massageLabLightPillarRotationSpeed,
      fallback.massageLabLightPillarRotationSpeed,
      0,
      2,
    ),
    massageLabLightPillarInteractive:
      typeof input.massageLabLightPillarInteractive === "boolean"
        ? input.massageLabLightPillarInteractive
        : fallback.massageLabLightPillarInteractive,
    massageLabLightPillarGlowAmount: normalizeNumber(
      input.massageLabLightPillarGlowAmount,
      fallback.massageLabLightPillarGlowAmount,
      0.001,
      0.03,
    ),
    massageLabLightPillarWidth: normalizeNumber(
      input.massageLabLightPillarWidth,
      fallback.massageLabLightPillarWidth,
      0.5,
      8,
    ),
    massageLabLightPillarHeight: normalizeNumber(
      input.massageLabLightPillarHeight,
      fallback.massageLabLightPillarHeight,
      0.1,
      2,
    ),
    massageLabLightPillarNoiseIntensity: normalizeNumber(
      input.massageLabLightPillarNoiseIntensity,
      fallback.massageLabLightPillarNoiseIntensity,
      0,
      1,
    ),
    massageLabLightPillarBlendMode: normalizeChoice(
      input.massageLabLightPillarBlendMode,
      fallback.massageLabLightPillarBlendMode,
      ["screen", "normal", "lighten", "plus-lighter"],
    ),
    massageLabLightPillarRotation: normalizeNumber(
      input.massageLabLightPillarRotation,
      fallback.massageLabLightPillarRotation,
      -180,
      180,
    ),
    massageLabLightPillarQuality: normalizeChoice(
      input.massageLabLightPillarQuality,
      fallback.massageLabLightPillarQuality,
      ["low", "medium", "high"],
    ),
    massageLabSilkSpeed: normalizeNumber(
      input.massageLabSilkSpeed,
      fallback.massageLabSilkSpeed,
      0,
      10,
    ),
    massageLabSilkScale: normalizeNumber(
      input.massageLabSilkScale,
      fallback.massageLabSilkScale,
      0.2,
      4,
    ),
    massageLabSilkNoiseIntensity: normalizeNumber(
      input.massageLabSilkNoiseIntensity,
      fallback.massageLabSilkNoiseIntensity,
      0,
      4,
    ),
    massageLabSilkRotation: normalizeNumber(
      input.massageLabSilkRotation,
      fallback.massageLabSilkRotation,
      -Math.PI,
      Math.PI,
    ),
    massageLabFloatingLinesEnableTop: typeof input.massageLabFloatingLinesEnableTop === "boolean"
      ? input.massageLabFloatingLinesEnableTop
      : fallback.massageLabFloatingLinesEnableTop,
    massageLabFloatingLinesEnableMiddle: typeof input.massageLabFloatingLinesEnableMiddle === "boolean"
      ? input.massageLabFloatingLinesEnableMiddle
      : fallback.massageLabFloatingLinesEnableMiddle,
    massageLabFloatingLinesEnableBottom: typeof input.massageLabFloatingLinesEnableBottom === "boolean"
      ? input.massageLabFloatingLinesEnableBottom
      : fallback.massageLabFloatingLinesEnableBottom,
    massageLabFloatingLinesTopLineCount: normalizeInteger(
      input.massageLabFloatingLinesTopLineCount,
      fallback.massageLabFloatingLinesTopLineCount,
      0,
      32,
    ),
    massageLabFloatingLinesMiddleLineCount: normalizeInteger(
      input.massageLabFloatingLinesMiddleLineCount,
      fallback.massageLabFloatingLinesMiddleLineCount,
      0,
      32,
    ),
    massageLabFloatingLinesBottomLineCount: normalizeInteger(
      input.massageLabFloatingLinesBottomLineCount,
      fallback.massageLabFloatingLinesBottomLineCount,
      0,
      32,
    ),
    massageLabFloatingLinesTopLineDistance: normalizeNumber(
      input.massageLabFloatingLinesTopLineDistance,
      fallback.massageLabFloatingLinesTopLineDistance,
      0.1,
      20,
    ),
    massageLabFloatingLinesMiddleLineDistance: normalizeNumber(
      input.massageLabFloatingLinesMiddleLineDistance,
      fallback.massageLabFloatingLinesMiddleLineDistance,
      0.1,
      20,
    ),
    massageLabFloatingLinesBottomLineDistance: normalizeNumber(
      input.massageLabFloatingLinesBottomLineDistance,
      fallback.massageLabFloatingLinesBottomLineDistance,
      0.1,
      20,
    ),
    massageLabFloatingLinesTopWaveX: normalizeNumber(
      input.massageLabFloatingLinesTopWaveX,
      fallback.massageLabFloatingLinesTopWaveX,
      -20,
      20,
    ),
    massageLabFloatingLinesTopWaveY: normalizeNumber(
      input.massageLabFloatingLinesTopWaveY,
      fallback.massageLabFloatingLinesTopWaveY,
      -4,
      4,
    ),
    massageLabFloatingLinesTopWaveRotate: normalizeNumber(
      input.massageLabFloatingLinesTopWaveRotate,
      fallback.massageLabFloatingLinesTopWaveRotate,
      -4,
      4,
    ),
    massageLabFloatingLinesMiddleWaveX: normalizeNumber(
      input.massageLabFloatingLinesMiddleWaveX,
      fallback.massageLabFloatingLinesMiddleWaveX,
      -20,
      20,
    ),
    massageLabFloatingLinesMiddleWaveY: normalizeNumber(
      input.massageLabFloatingLinesMiddleWaveY,
      fallback.massageLabFloatingLinesMiddleWaveY,
      -4,
      4,
    ),
    massageLabFloatingLinesMiddleWaveRotate: normalizeNumber(
      input.massageLabFloatingLinesMiddleWaveRotate,
      fallback.massageLabFloatingLinesMiddleWaveRotate,
      -4,
      4,
    ),
    massageLabFloatingLinesBottomWaveX: normalizeNumber(
      input.massageLabFloatingLinesBottomWaveX,
      fallback.massageLabFloatingLinesBottomWaveX,
      -20,
      20,
    ),
    massageLabFloatingLinesBottomWaveY: normalizeNumber(
      input.massageLabFloatingLinesBottomWaveY,
      fallback.massageLabFloatingLinesBottomWaveY,
      -4,
      4,
    ),
    massageLabFloatingLinesBottomWaveRotate: normalizeNumber(
      input.massageLabFloatingLinesBottomWaveRotate,
      fallback.massageLabFloatingLinesBottomWaveRotate,
      -4,
      4,
    ),
    massageLabFloatingLinesAnimationSpeed: normalizeNumber(
      input.massageLabFloatingLinesAnimationSpeed,
      fallback.massageLabFloatingLinesAnimationSpeed,
      0,
      4,
    ),
    massageLabFloatingLinesInteractive: typeof input.massageLabFloatingLinesInteractive === "boolean"
      ? input.massageLabFloatingLinesInteractive
      : fallback.massageLabFloatingLinesInteractive,
    massageLabFloatingLinesBendRadius: normalizeNumber(
      input.massageLabFloatingLinesBendRadius,
      fallback.massageLabFloatingLinesBendRadius,
      0.1,
      20,
    ),
    massageLabFloatingLinesBendStrength: normalizeNumber(
      input.massageLabFloatingLinesBendStrength,
      fallback.massageLabFloatingLinesBendStrength,
      -2,
      2,
    ),
    massageLabFloatingLinesMouseDamping: normalizeNumber(
      input.massageLabFloatingLinesMouseDamping,
      fallback.massageLabFloatingLinesMouseDamping,
      0.01,
      1,
    ),
    massageLabFloatingLinesParallax: typeof input.massageLabFloatingLinesParallax === "boolean"
      ? input.massageLabFloatingLinesParallax
      : fallback.massageLabFloatingLinesParallax,
    massageLabFloatingLinesParallaxStrength: normalizeNumber(
      input.massageLabFloatingLinesParallaxStrength,
      fallback.massageLabFloatingLinesParallaxStrength,
      0,
      1,
    ),
    massageLabFloatingLinesBlendMode: normalizeChoice(
      input.massageLabFloatingLinesBlendMode,
      fallback.massageLabFloatingLinesBlendMode,
      ["screen", "normal", "lighten", "plus-lighter"],
    ),
    massageLabSideRaysSpeed: normalizeNumber(
      input.massageLabSideRaysSpeed,
      fallback.massageLabSideRaysSpeed,
      0,
      8,
    ),
    massageLabSideRaysIntensity: normalizeNumber(
      input.massageLabSideRaysIntensity,
      fallback.massageLabSideRaysIntensity,
      0,
      6,
    ),
    massageLabSideRaysSpread: normalizeNumber(
      input.massageLabSideRaysSpread,
      fallback.massageLabSideRaysSpread,
      0.1,
      5,
    ),
    massageLabSideRaysOrigin: normalizeChoice(
      input.massageLabSideRaysOrigin,
      fallback.massageLabSideRaysOrigin,
      ["top-right", "top-left", "bottom-right", "bottom-left"],
    ),
    massageLabSideRaysTilt: normalizeNumber(
      input.massageLabSideRaysTilt,
      fallback.massageLabSideRaysTilt,
      -90,
      90,
    ),
    massageLabSideRaysSaturation: normalizeNumber(
      input.massageLabSideRaysSaturation,
      fallback.massageLabSideRaysSaturation,
      0,
      3,
    ),
    massageLabSideRaysBlend: normalizeNumber(
      input.massageLabSideRaysBlend,
      fallback.massageLabSideRaysBlend,
      0,
      1,
    ),
    massageLabSideRaysFalloff: normalizeNumber(
      input.massageLabSideRaysFalloff,
      fallback.massageLabSideRaysFalloff,
      0.2,
      4,
    ),
    massageLabSideRaysOpacity: normalizeNumber(
      input.massageLabSideRaysOpacity,
      fallback.massageLabSideRaysOpacity,
      0,
      1,
    ),
    massageLabLightRaysOrigin: normalizeChoice(
      input.massageLabLightRaysOrigin,
      fallback.massageLabLightRaysOrigin,
      ["top-left", "top-center", "top-right", "left", "right", "bottom-left", "bottom-center", "bottom-right"],
    ),
    massageLabLightRaysSpeed: normalizeNumber(
      input.massageLabLightRaysSpeed,
      fallback.massageLabLightRaysSpeed,
      0,
      4,
    ),
    massageLabLightRaysSpread: normalizeNumber(
      input.massageLabLightRaysSpread,
      fallback.massageLabLightRaysSpread,
      0.1,
      4,
    ),
    massageLabLightRaysLength: normalizeNumber(
      input.massageLabLightRaysLength,
      fallback.massageLabLightRaysLength,
      0.25,
      5,
    ),
    massageLabLightRaysPulsating: typeof input.massageLabLightRaysPulsating === "boolean"
      ? input.massageLabLightRaysPulsating
      : fallback.massageLabLightRaysPulsating,
    massageLabLightRaysFadeDistance: normalizeNumber(
      input.massageLabLightRaysFadeDistance,
      fallback.massageLabLightRaysFadeDistance,
      0.1,
      3,
    ),
    massageLabLightRaysSaturation: normalizeNumber(
      input.massageLabLightRaysSaturation,
      fallback.massageLabLightRaysSaturation,
      0,
      3,
    ),
    massageLabLightRaysFollowMouse: typeof input.massageLabLightRaysFollowMouse === "boolean"
      ? input.massageLabLightRaysFollowMouse
      : fallback.massageLabLightRaysFollowMouse,
    massageLabLightRaysMouseInfluence: normalizeNumber(
      input.massageLabLightRaysMouseInfluence,
      fallback.massageLabLightRaysMouseInfluence,
      0,
      1,
    ),
    massageLabLightRaysNoiseAmount: normalizeNumber(
      input.massageLabLightRaysNoiseAmount,
      fallback.massageLabLightRaysNoiseAmount,
      0,
      1,
    ),
    massageLabLightRaysDistortion: normalizeNumber(
      input.massageLabLightRaysDistortion,
      fallback.massageLabLightRaysDistortion,
      0,
      2,
    ),
    massageLabPixelBlastVariant: normalizeChoice(
      input.massageLabPixelBlastVariant,
      fallback.massageLabPixelBlastVariant,
      ["square", "circle", "triangle", "diamond"],
    ),
    massageLabPixelBlastPixelSize: normalizeNumber(
      input.massageLabPixelBlastPixelSize,
      fallback.massageLabPixelBlastPixelSize,
      1,
      16,
    ),
    massageLabPixelBlastAntialias: typeof input.massageLabPixelBlastAntialias === "boolean"
      ? input.massageLabPixelBlastAntialias
      : fallback.massageLabPixelBlastAntialias,
    massageLabPixelBlastPatternScale: normalizeNumber(
      input.massageLabPixelBlastPatternScale,
      fallback.massageLabPixelBlastPatternScale,
      0.25,
      8,
    ),
    massageLabPixelBlastPatternDensity: normalizeNumber(
      input.massageLabPixelBlastPatternDensity,
      fallback.massageLabPixelBlastPatternDensity,
      0,
      2,
    ),
    massageLabPixelBlastLiquid: typeof input.massageLabPixelBlastLiquid === "boolean"
      ? input.massageLabPixelBlastLiquid
      : fallback.massageLabPixelBlastLiquid,
    massageLabPixelBlastLiquidStrength: normalizeNumber(
      input.massageLabPixelBlastLiquidStrength,
      fallback.massageLabPixelBlastLiquidStrength,
      0,
      0.4,
    ),
    massageLabPixelBlastLiquidRadius: normalizeNumber(
      input.massageLabPixelBlastLiquidRadius,
      fallback.massageLabPixelBlastLiquidRadius,
      0.1,
      4,
    ),
    massageLabPixelBlastPixelSizeJitter: normalizeNumber(
      input.massageLabPixelBlastPixelSizeJitter,
      fallback.massageLabPixelBlastPixelSizeJitter,
      0,
      1,
    ),
    massageLabPixelBlastEnableRipples: typeof input.massageLabPixelBlastEnableRipples === "boolean"
      ? input.massageLabPixelBlastEnableRipples
      : fallback.massageLabPixelBlastEnableRipples,
    massageLabPixelBlastRippleIntensityScale: normalizeNumber(
      input.massageLabPixelBlastRippleIntensityScale,
      fallback.massageLabPixelBlastRippleIntensityScale,
      0,
      4,
    ),
    massageLabPixelBlastRippleThickness: normalizeNumber(
      input.massageLabPixelBlastRippleThickness,
      fallback.massageLabPixelBlastRippleThickness,
      0.01,
      0.5,
    ),
    massageLabPixelBlastRippleSpeed: normalizeNumber(
      input.massageLabPixelBlastRippleSpeed,
      fallback.massageLabPixelBlastRippleSpeed,
      0.05,
      2,
    ),
    massageLabPixelBlastLiquidWobbleSpeed: normalizeNumber(
      input.massageLabPixelBlastLiquidWobbleSpeed,
      fallback.massageLabPixelBlastLiquidWobbleSpeed,
      0,
      10,
    ),
    massageLabPixelBlastAutoPauseOffscreen: typeof input.massageLabPixelBlastAutoPauseOffscreen === "boolean"
      ? input.massageLabPixelBlastAutoPauseOffscreen
      : fallback.massageLabPixelBlastAutoPauseOffscreen,
    massageLabPixelBlastSpeed: normalizeNumber(
      input.massageLabPixelBlastSpeed,
      fallback.massageLabPixelBlastSpeed,
      0,
      3,
    ),
    massageLabPixelBlastTransparent: typeof input.massageLabPixelBlastTransparent === "boolean"
      ? input.massageLabPixelBlastTransparent
      : fallback.massageLabPixelBlastTransparent,
    massageLabPixelBlastEdgeFade: normalizeNumber(
      input.massageLabPixelBlastEdgeFade,
      fallback.massageLabPixelBlastEdgeFade,
      0,
      1,
    ),
    massageLabPixelBlastNoiseAmount: normalizeNumber(
      input.massageLabPixelBlastNoiseAmount,
      fallback.massageLabPixelBlastNoiseAmount,
      0,
      0.4,
    ),
    massageLabColorBendsRotation: normalizeNumber(
      input.massageLabColorBendsRotation,
      fallback.massageLabColorBendsRotation,
      -360,
      360,
    ),
    massageLabColorBendsSpeed: normalizeNumber(
      input.massageLabColorBendsSpeed,
      fallback.massageLabColorBendsSpeed,
      0,
      3,
    ),
    massageLabColorBendsTransparent: typeof input.massageLabColorBendsTransparent === "boolean"
      ? input.massageLabColorBendsTransparent
      : fallback.massageLabColorBendsTransparent,
    massageLabColorBendsAutoRotate: normalizeNumber(
      input.massageLabColorBendsAutoRotate,
      fallback.massageLabColorBendsAutoRotate,
      -180,
      180,
    ),
    massageLabColorBendsScale: normalizeNumber(
      input.massageLabColorBendsScale,
      fallback.massageLabColorBendsScale,
      0.1,
      4,
    ),
    massageLabColorBendsFrequency: normalizeNumber(
      input.massageLabColorBendsFrequency,
      fallback.massageLabColorBendsFrequency,
      0.1,
      4,
    ),
    massageLabColorBendsWarpStrength: normalizeNumber(
      input.massageLabColorBendsWarpStrength,
      fallback.massageLabColorBendsWarpStrength,
      0,
      3,
    ),
    massageLabColorBendsInteractive: typeof input.massageLabColorBendsInteractive === "boolean"
      ? input.massageLabColorBendsInteractive
      : fallback.massageLabColorBendsInteractive,
    massageLabColorBendsMouseInfluence: normalizeNumber(
      input.massageLabColorBendsMouseInfluence,
      fallback.massageLabColorBendsMouseInfluence,
      0,
      3,
    ),
    massageLabColorBendsParallax: normalizeNumber(
      input.massageLabColorBendsParallax,
      fallback.massageLabColorBendsParallax,
      0,
      2,
    ),
    massageLabColorBendsNoise: normalizeNumber(
      input.massageLabColorBendsNoise,
      fallback.massageLabColorBendsNoise,
      0,
      1,
    ),
    massageLabColorBendsIterations: normalizeInteger(
      input.massageLabColorBendsIterations,
      fallback.massageLabColorBendsIterations,
      1,
      5,
    ),
    massageLabColorBendsIntensity: normalizeNumber(
      input.massageLabColorBendsIntensity,
      fallback.massageLabColorBendsIntensity,
      0.1,
      4,
    ),
    massageLabColorBendsBandWidth: normalizeNumber(
      input.massageLabColorBendsBandWidth,
      fallback.massageLabColorBendsBandWidth,
      0.5,
      16,
    ),
    massageLabEvilEyeIntensity: normalizeNumber(
      input.massageLabEvilEyeIntensity,
      fallback.massageLabEvilEyeIntensity,
      0,
      3,
    ),
    massageLabEvilEyePupilSize: normalizeNumber(
      input.massageLabEvilEyePupilSize,
      fallback.massageLabEvilEyePupilSize,
      0.1,
      2,
    ),
    massageLabEvilEyeIrisWidth: normalizeNumber(
      input.massageLabEvilEyeIrisWidth,
      fallback.massageLabEvilEyeIrisWidth,
      0.05,
      1,
    ),
    massageLabEvilEyeGlowIntensity: normalizeNumber(
      input.massageLabEvilEyeGlowIntensity,
      fallback.massageLabEvilEyeGlowIntensity,
      0,
      1.5,
    ),
    massageLabEvilEyeScale: normalizeNumber(
      input.massageLabEvilEyeScale,
      fallback.massageLabEvilEyeScale,
      0.25,
      2,
    ),
    massageLabEvilEyeNoiseScale: normalizeNumber(
      input.massageLabEvilEyeNoiseScale,
      fallback.massageLabEvilEyeNoiseScale,
      0.1,
      4,
    ),
    massageLabEvilEyePupilFollow: normalizeNumber(
      input.massageLabEvilEyePupilFollow,
      fallback.massageLabEvilEyePupilFollow,
      0,
      2,
    ),
    massageLabEvilEyeFlameSpeed: normalizeNumber(
      input.massageLabEvilEyeFlameSpeed,
      fallback.massageLabEvilEyeFlameSpeed,
      0,
      3,
    ),
    massageLabEvilEyeInteractive: typeof input.massageLabEvilEyeInteractive === "boolean"
      ? input.massageLabEvilEyeInteractive
      : fallback.massageLabEvilEyeInteractive,
    massageLabLineWavesSpeed: normalizeNumber(
      input.massageLabLineWavesSpeed,
      fallback.massageLabLineWavesSpeed,
      0,
      3,
    ),
    massageLabLineWavesInnerLineCount: normalizeNumber(
      input.massageLabLineWavesInnerLineCount,
      fallback.massageLabLineWavesInnerLineCount,
      1,
      96,
    ),
    massageLabLineWavesOuterLineCount: normalizeNumber(
      input.massageLabLineWavesOuterLineCount,
      fallback.massageLabLineWavesOuterLineCount,
      1,
      96,
    ),
    massageLabLineWavesWarpIntensity: normalizeNumber(
      input.massageLabLineWavesWarpIntensity,
      fallback.massageLabLineWavesWarpIntensity,
      0,
      3,
    ),
    massageLabLineWavesRotation: normalizeNumber(
      input.massageLabLineWavesRotation,
      fallback.massageLabLineWavesRotation,
      -180,
      180,
    ),
    massageLabLineWavesEdgeFadeWidth: normalizeNumber(
      input.massageLabLineWavesEdgeFadeWidth,
      fallback.massageLabLineWavesEdgeFadeWidth,
      -1,
      1,
    ),
    massageLabLineWavesColorCycleSpeed: normalizeNumber(
      input.massageLabLineWavesColorCycleSpeed,
      fallback.massageLabLineWavesColorCycleSpeed,
      0,
      4,
    ),
    massageLabLineWavesBrightness: normalizeNumber(
      input.massageLabLineWavesBrightness,
      fallback.massageLabLineWavesBrightness,
      0,
      1.5,
    ),
    massageLabLineWavesEnableMouseInteraction: typeof input.massageLabLineWavesEnableMouseInteraction === "boolean"
      ? input.massageLabLineWavesEnableMouseInteraction
      : fallback.massageLabLineWavesEnableMouseInteraction,
    massageLabLineWavesMouseInfluence: normalizeNumber(
      input.massageLabLineWavesMouseInfluence,
      fallback.massageLabLineWavesMouseInfluence,
      0,
      4,
    ),
    massageLabRadarSpeed: normalizeNumber(input.massageLabRadarSpeed, fallback.massageLabRadarSpeed, 0, 3),
    massageLabRadarScale: normalizeNumber(input.massageLabRadarScale, fallback.massageLabRadarScale, 0.1, 2),
    massageLabRadarRingCount: normalizeNumber(
      input.massageLabRadarRingCount,
      fallback.massageLabRadarRingCount,
      1,
      40,
    ),
    massageLabRadarSpokeCount: normalizeNumber(
      input.massageLabRadarSpokeCount,
      fallback.massageLabRadarSpokeCount,
      1,
      40,
    ),
    massageLabRadarRingThickness: normalizeNumber(
      input.massageLabRadarRingThickness,
      fallback.massageLabRadarRingThickness,
      0.001,
      0.25,
    ),
    massageLabRadarSpokeThickness: normalizeNumber(
      input.massageLabRadarSpokeThickness,
      fallback.massageLabRadarSpokeThickness,
      0.001,
      0.1,
    ),
    massageLabRadarSweepSpeed: normalizeNumber(
      input.massageLabRadarSweepSpeed,
      fallback.massageLabRadarSweepSpeed,
      0,
      4,
    ),
    massageLabRadarSweepWidth: normalizeNumber(
      input.massageLabRadarSweepWidth,
      fallback.massageLabRadarSweepWidth,
      0.1,
      12,
    ),
    massageLabRadarSweepLobes: normalizeNumber(
      input.massageLabRadarSweepLobes,
      fallback.massageLabRadarSweepLobes,
      1,
      12,
    ),
    massageLabRadarFalloff: normalizeNumber(input.massageLabRadarFalloff, fallback.massageLabRadarFalloff, 0, 8),
    massageLabRadarBrightness: normalizeNumber(
      input.massageLabRadarBrightness,
      fallback.massageLabRadarBrightness,
      0,
      3,
    ),
    massageLabRadarEnableMouseInteraction: typeof input.massageLabRadarEnableMouseInteraction === "boolean"
      ? input.massageLabRadarEnableMouseInteraction
      : fallback.massageLabRadarEnableMouseInteraction,
    massageLabRadarMouseInfluence: normalizeNumber(
      input.massageLabRadarMouseInfluence,
      fallback.massageLabRadarMouseInfluence,
      0,
      1,
    ),
    massageLabSoftAuroraSpeed: normalizeNumber(
      input.massageLabSoftAuroraSpeed,
      fallback.massageLabSoftAuroraSpeed,
      0,
      3,
    ),
    massageLabSoftAuroraScale: normalizeNumber(
      input.massageLabSoftAuroraScale,
      fallback.massageLabSoftAuroraScale,
      0.1,
      4,
    ),
    massageLabSoftAuroraBrightness: normalizeNumber(
      input.massageLabSoftAuroraBrightness,
      fallback.massageLabSoftAuroraBrightness,
      0,
      3,
    ),
    massageLabSoftAuroraNoiseFrequency: normalizeNumber(
      input.massageLabSoftAuroraNoiseFrequency,
      fallback.massageLabSoftAuroraNoiseFrequency,
      0.1,
      8,
    ),
    massageLabSoftAuroraNoiseAmplitude: normalizeNumber(
      input.massageLabSoftAuroraNoiseAmplitude,
      fallback.massageLabSoftAuroraNoiseAmplitude,
      0,
      4,
    ),
    massageLabSoftAuroraBandHeight: normalizeNumber(
      input.massageLabSoftAuroraBandHeight,
      fallback.massageLabSoftAuroraBandHeight,
      -1,
      2,
    ),
    massageLabSoftAuroraBandSpread: normalizeNumber(
      input.massageLabSoftAuroraBandSpread,
      fallback.massageLabSoftAuroraBandSpread,
      0.1,
      4,
    ),
    massageLabSoftAuroraOctaveDecay: normalizeNumber(
      input.massageLabSoftAuroraOctaveDecay,
      fallback.massageLabSoftAuroraOctaveDecay,
      0,
      1,
    ),
    massageLabSoftAuroraLayerOffset: normalizeNumber(
      input.massageLabSoftAuroraLayerOffset,
      fallback.massageLabSoftAuroraLayerOffset,
      -6,
      6,
    ),
    massageLabSoftAuroraColorSpeed: normalizeNumber(
      input.massageLabSoftAuroraColorSpeed,
      fallback.massageLabSoftAuroraColorSpeed,
      0,
      4,
    ),
    massageLabSoftAuroraEnableMouseInteraction: typeof input.massageLabSoftAuroraEnableMouseInteraction === "boolean"
      ? input.massageLabSoftAuroraEnableMouseInteraction
      : fallback.massageLabSoftAuroraEnableMouseInteraction,
    massageLabSoftAuroraMouseInfluence: normalizeNumber(
      input.massageLabSoftAuroraMouseInfluence,
      fallback.massageLabSoftAuroraMouseInfluence,
      0,
      1,
    ),
    massageLabPlasmaSpeed: normalizeNumber(input.massageLabPlasmaSpeed, fallback.massageLabPlasmaSpeed, 0, 3),
    massageLabPlasmaDirection: normalizeChoice(
      input.massageLabPlasmaDirection,
      fallback.massageLabPlasmaDirection,
      ["forward", "reverse", "pingpong"],
    ),
    massageLabPlasmaScale: normalizeNumber(input.massageLabPlasmaScale, fallback.massageLabPlasmaScale, 0.2, 4),
    massageLabPlasmaOpacity: normalizeNumber(input.massageLabPlasmaOpacity, fallback.massageLabPlasmaOpacity, 0, 1),
    massageLabPlasmaMouseInteractive: typeof input.massageLabPlasmaMouseInteractive === "boolean"
      ? input.massageLabPlasmaMouseInteractive
      : fallback.massageLabPlasmaMouseInteractive,
    massageLabPlasmaWaveXOffset: normalizeNumber(
      input.massageLabPlasmaWaveXOffset,
      fallback.massageLabPlasmaWaveXOffset,
      -800,
      800,
    ),
    massageLabPlasmaWaveYOffset: normalizeNumber(
      input.massageLabPlasmaWaveYOffset,
      fallback.massageLabPlasmaWaveYOffset,
      -800,
      800,
    ),
    massageLabPlasmaWaveRotationDeg: normalizeNumber(
      input.massageLabPlasmaWaveRotationDeg,
      fallback.massageLabPlasmaWaveRotationDeg,
      -180,
      180,
    ),
    massageLabPlasmaWaveFocalLength: normalizeNumber(
      input.massageLabPlasmaWaveFocalLength,
      fallback.massageLabPlasmaWaveFocalLength,
      0.2,
      2,
    ),
    massageLabPlasmaWaveSpeedOne: normalizeNumber(
      input.massageLabPlasmaWaveSpeedOne,
      fallback.massageLabPlasmaWaveSpeedOne,
      0,
      0.5,
    ),
    massageLabPlasmaWaveSpeedTwo: normalizeNumber(
      input.massageLabPlasmaWaveSpeedTwo,
      fallback.massageLabPlasmaWaveSpeedTwo,
      0,
      0.5,
    ),
    massageLabPlasmaWaveDirectionTwo: normalizeChoice(
      input.massageLabPlasmaWaveDirectionTwo,
      fallback.massageLabPlasmaWaveDirectionTwo,
      [1, -1],
    ),
    massageLabPlasmaWaveBendOne: normalizeNumber(
      input.massageLabPlasmaWaveBendOne,
      fallback.massageLabPlasmaWaveBendOne,
      0,
      3,
    ),
    massageLabPlasmaWaveBendTwo: normalizeNumber(
      input.massageLabPlasmaWaveBendTwo,
      fallback.massageLabPlasmaWaveBendTwo,
      0,
      3,
    ),
    massageLabParticlesCount: Math.round(
      normalizeNumber(input.massageLabParticlesCount, fallback.massageLabParticlesCount, 20, 1500),
    ),
    massageLabParticlesSpread: normalizeNumber(input.massageLabParticlesSpread, fallback.massageLabParticlesSpread, 1, 30),
    massageLabParticlesSpeed: normalizeNumber(input.massageLabParticlesSpeed, fallback.massageLabParticlesSpeed, 0, 1),
    massageLabParticlesMoveOnHover: typeof input.massageLabParticlesMoveOnHover === "boolean"
      ? input.massageLabParticlesMoveOnHover
      : fallback.massageLabParticlesMoveOnHover,
    massageLabParticlesHoverFactor: normalizeNumber(
      input.massageLabParticlesHoverFactor,
      fallback.massageLabParticlesHoverFactor,
      0,
      5,
    ),
    massageLabParticlesAlpha: typeof input.massageLabParticlesAlpha === "boolean"
      ? input.massageLabParticlesAlpha
      : fallback.massageLabParticlesAlpha,
    massageLabParticlesBaseSize: normalizeNumber(
      input.massageLabParticlesBaseSize,
      fallback.massageLabParticlesBaseSize,
      10,
      300,
    ),
    massageLabParticlesSizeRandomness: normalizeNumber(
      input.massageLabParticlesSizeRandomness,
      fallback.massageLabParticlesSizeRandomness,
      0,
      3,
    ),
    massageLabParticlesCameraDistance: normalizeNumber(
      input.massageLabParticlesCameraDistance,
      fallback.massageLabParticlesCameraDistance,
      5,
      60,
    ),
    massageLabParticlesDisableRotation: typeof input.massageLabParticlesDisableRotation === "boolean"
      ? input.massageLabParticlesDisableRotation
      : fallback.massageLabParticlesDisableRotation,
    massageLabParticlesPixelRatio: normalizeNumber(
      input.massageLabParticlesPixelRatio,
      fallback.massageLabParticlesPixelRatio,
      0.5,
      2,
    ),
    massageLabGradientBlindsAngle: normalizeNumber(
      input.massageLabGradientBlindsAngle,
      fallback.massageLabGradientBlindsAngle,
      -180,
      180,
    ),
    massageLabGradientBlindsNoise: normalizeNumber(input.massageLabGradientBlindsNoise, fallback.massageLabGradientBlindsNoise, 0, 1),
    massageLabGradientBlindsBlindCount: Math.round(
      normalizeNumber(input.massageLabGradientBlindsBlindCount, fallback.massageLabGradientBlindsBlindCount, 1, 80),
    ),
    massageLabGradientBlindsBlindMinWidth: normalizeNumber(
      input.massageLabGradientBlindsBlindMinWidth,
      fallback.massageLabGradientBlindsBlindMinWidth,
      0,
      240,
    ),
    massageLabGradientBlindsMouseDampening: normalizeNumber(
      input.massageLabGradientBlindsMouseDampening,
      fallback.massageLabGradientBlindsMouseDampening,
      0,
      1,
    ),
    massageLabGradientBlindsMirror: typeof input.massageLabGradientBlindsMirror === "boolean"
      ? input.massageLabGradientBlindsMirror
      : fallback.massageLabGradientBlindsMirror,
    massageLabGradientBlindsSpotlightRadius: normalizeNumber(
      input.massageLabGradientBlindsSpotlightRadius,
      fallback.massageLabGradientBlindsSpotlightRadius,
      0.05,
      1.5,
    ),
    massageLabGradientBlindsSpotlightSoftness: normalizeNumber(
      input.massageLabGradientBlindsSpotlightSoftness,
      fallback.massageLabGradientBlindsSpotlightSoftness,
      0.2,
      4,
    ),
    massageLabGradientBlindsSpotlightOpacity: normalizeNumber(
      input.massageLabGradientBlindsSpotlightOpacity,
      fallback.massageLabGradientBlindsSpotlightOpacity,
      0,
      2,
    ),
    massageLabGradientBlindsDistort: normalizeNumber(
      input.massageLabGradientBlindsDistort,
      fallback.massageLabGradientBlindsDistort,
      0,
      5,
    ),
    massageLabGradientBlindsShineDirection: normalizeChoice(
      input.massageLabGradientBlindsShineDirection,
      fallback.massageLabGradientBlindsShineDirection,
      ["left", "right"],
    ),
    massageLabGradientBlindsBlendMode: normalizeChoice(
      input.massageLabGradientBlindsBlendMode,
      fallback.massageLabGradientBlindsBlendMode,
      ["normal", "screen", "lighten", "plus-lighter"],
    ),
    massageLabGradientBlindsDpr: normalizeNumber(input.massageLabGradientBlindsDpr, fallback.massageLabGradientBlindsDpr, 0.5, 2),
    massageLabGradientBlindsEnableMouseInteraction: typeof input.massageLabGradientBlindsEnableMouseInteraction === "boolean"
      ? input.massageLabGradientBlindsEnableMouseInteraction
      : fallback.massageLabGradientBlindsEnableMouseInteraction,
    massageLabGrainientTimeSpeed: normalizeNumber(input.massageLabGrainientTimeSpeed, fallback.massageLabGrainientTimeSpeed, 0, 2),
    massageLabGrainientColorBalance: normalizeNumber(input.massageLabGrainientColorBalance, fallback.massageLabGrainientColorBalance, -1, 1),
    massageLabGrainientWarpStrength: normalizeNumber(input.massageLabGrainientWarpStrength, fallback.massageLabGrainientWarpStrength, 0, 5),
    massageLabGrainientWarpFrequency: normalizeNumber(input.massageLabGrainientWarpFrequency, fallback.massageLabGrainientWarpFrequency, 0.1, 20),
    massageLabGrainientWarpSpeed: normalizeNumber(input.massageLabGrainientWarpSpeed, fallback.massageLabGrainientWarpSpeed, 0, 6),
    massageLabGrainientWarpAmplitude: normalizeNumber(input.massageLabGrainientWarpAmplitude, fallback.massageLabGrainientWarpAmplitude, 1, 160),
    massageLabGrainientBlendAngle: normalizeNumber(input.massageLabGrainientBlendAngle, fallback.massageLabGrainientBlendAngle, -180, 180),
    massageLabGrainientBlendSoftness: normalizeNumber(input.massageLabGrainientBlendSoftness, fallback.massageLabGrainientBlendSoftness, 0, 1),
    massageLabGrainientRotationAmount: normalizeNumber(input.massageLabGrainientRotationAmount, fallback.massageLabGrainientRotationAmount, 0, 1200),
    massageLabGrainientNoiseScale: normalizeNumber(input.massageLabGrainientNoiseScale, fallback.massageLabGrainientNoiseScale, 0.1, 8),
    massageLabGrainientGrainAmount: normalizeNumber(input.massageLabGrainientGrainAmount, fallback.massageLabGrainientGrainAmount, 0, 1),
    massageLabGrainientGrainScale: normalizeNumber(input.massageLabGrainientGrainScale, fallback.massageLabGrainientGrainScale, 0.1, 12),
    massageLabGrainientGrainAnimated: typeof input.massageLabGrainientGrainAnimated === "boolean"
      ? input.massageLabGrainientGrainAnimated
      : fallback.massageLabGrainientGrainAnimated,
    massageLabGrainientContrast: normalizeNumber(input.massageLabGrainientContrast, fallback.massageLabGrainientContrast, 0.2, 4),
    massageLabGrainientGamma: normalizeNumber(input.massageLabGrainientGamma, fallback.massageLabGrainientGamma, 0.2, 4),
    massageLabGrainientSaturation: normalizeNumber(input.massageLabGrainientSaturation, fallback.massageLabGrainientSaturation, 0, 3),
    massageLabGrainientCenterX: normalizeNumber(input.massageLabGrainientCenterX, fallback.massageLabGrainientCenterX, -1, 1),
    massageLabGrainientCenterY: normalizeNumber(input.massageLabGrainientCenterY, fallback.massageLabGrainientCenterY, -1, 1),
    massageLabGrainientZoom: normalizeNumber(input.massageLabGrainientZoom, fallback.massageLabGrainientZoom, 0.2, 3),
    massageLabGridScanSensitivity: normalizeNumber(input.massageLabGridScanSensitivity, fallback.massageLabGridScanSensitivity, 0, 1),
    massageLabGridScanLineThickness: normalizeNumber(input.massageLabGridScanLineThickness, fallback.massageLabGridScanLineThickness, 0.2, 6),
    massageLabGridScanScanOpacity: normalizeNumber(input.massageLabGridScanScanOpacity, fallback.massageLabGridScanScanOpacity, 0, 1),
    massageLabGridScanGridScale: normalizeNumber(input.massageLabGridScanGridScale, fallback.massageLabGridScanGridScale, 0.02, 0.5),
    massageLabGridScanLineStyle: normalizeChoice(
      input.massageLabGridScanLineStyle,
      fallback.massageLabGridScanLineStyle,
      ["solid", "dashed", "dotted"],
    ),
    massageLabGridScanLineJitter: normalizeNumber(input.massageLabGridScanLineJitter, fallback.massageLabGridScanLineJitter, 0, 1),
    massageLabGridScanDirection: normalizeChoice(
      input.massageLabGridScanDirection,
      fallback.massageLabGridScanDirection,
      ["forward", "backward", "pingpong"],
    ),
    massageLabGridScanNoiseIntensity: normalizeNumber(input.massageLabGridScanNoiseIntensity, fallback.massageLabGridScanNoiseIntensity, 0, 0.25),
    massageLabGridScanBloomOpacity: normalizeNumber(input.massageLabGridScanBloomOpacity, fallback.massageLabGridScanBloomOpacity, 0, 2),
    massageLabGridScanScanGlow: normalizeNumber(input.massageLabGridScanScanGlow, fallback.massageLabGridScanScanGlow, 0.1, 3),
    massageLabGridScanScanSoftness: normalizeNumber(input.massageLabGridScanScanSoftness, fallback.massageLabGridScanScanSoftness, 0.2, 6),
    massageLabGridScanPhaseTaper: normalizeNumber(input.massageLabGridScanPhaseTaper, fallback.massageLabGridScanPhaseTaper, 0, 0.49),
    massageLabGridScanScanDuration: normalizeNumber(input.massageLabGridScanScanDuration, fallback.massageLabGridScanScanDuration, 0.05, 10),
    massageLabGridScanScanDelay: normalizeNumber(input.massageLabGridScanScanDelay, fallback.massageLabGridScanScanDelay, 0, 10),
    massageLabGridScanEnablePointerInteraction: typeof input.massageLabGridScanEnablePointerInteraction === "boolean"
      ? input.massageLabGridScanEnablePointerInteraction
      : fallback.massageLabGridScanEnablePointerInteraction,
    massageLabGridScanScanOnClick: typeof input.massageLabGridScanScanOnClick === "boolean"
      ? input.massageLabGridScanScanOnClick
      : fallback.massageLabGridScanScanOnClick,
    massageLabBeamsBeamWidth: normalizeNumber(input.massageLabBeamsBeamWidth, fallback.massageLabBeamsBeamWidth, 0.2, 6),
    massageLabBeamsBeamHeight: normalizeNumber(input.massageLabBeamsBeamHeight, fallback.massageLabBeamsBeamHeight, 4, 32),
    massageLabBeamsBeamNumber: Math.trunc(
      normalizeNumber(input.massageLabBeamsBeamNumber, fallback.massageLabBeamsBeamNumber, 1, 48),
    ),
    massageLabBeamsSpeed: normalizeNumber(input.massageLabBeamsSpeed, fallback.massageLabBeamsSpeed, 0, 8),
    massageLabBeamsNoiseIntensity: normalizeNumber(
      input.massageLabBeamsNoiseIntensity,
      fallback.massageLabBeamsNoiseIntensity,
      0,
      4,
    ),
    massageLabBeamsScale: normalizeNumber(input.massageLabBeamsScale, fallback.massageLabBeamsScale, 0.02, 1.5),
    massageLabBeamsRotation: normalizeNumber(input.massageLabBeamsRotation, fallback.massageLabBeamsRotation, -180, 180),
    massageLabPixelSnowFlakeSize: normalizeNumber(
      input.massageLabPixelSnowFlakeSize,
      fallback.massageLabPixelSnowFlakeSize,
      0.001,
      0.08,
    ),
    massageLabPixelSnowMinFlakeSize: normalizeNumber(
      input.massageLabPixelSnowMinFlakeSize,
      fallback.massageLabPixelSnowMinFlakeSize,
      0.1,
      6,
    ),
    massageLabPixelSnowPixelResolution: normalizeNumber(
      input.massageLabPixelSnowPixelResolution,
      fallback.massageLabPixelSnowPixelResolution,
      40,
      640,
    ),
    massageLabPixelSnowSpeed: normalizeNumber(input.massageLabPixelSnowSpeed, fallback.massageLabPixelSnowSpeed, 0, 5),
    massageLabPixelSnowDepthFade: normalizeNumber(
      input.massageLabPixelSnowDepthFade,
      fallback.massageLabPixelSnowDepthFade,
      1,
      40,
    ),
    massageLabPixelSnowFarPlane: normalizeNumber(
      input.massageLabPixelSnowFarPlane,
      fallback.massageLabPixelSnowFarPlane,
      4,
      80,
    ),
    massageLabPixelSnowBrightness: normalizeNumber(
      input.massageLabPixelSnowBrightness,
      fallback.massageLabPixelSnowBrightness,
      0.1,
      4,
    ),
    massageLabPixelSnowGamma: normalizeNumber(input.massageLabPixelSnowGamma, fallback.massageLabPixelSnowGamma, 0.1, 2),
    massageLabPixelSnowDensity: normalizeNumber(
      input.massageLabPixelSnowDensity,
      fallback.massageLabPixelSnowDensity,
      0.02,
      1,
    ),
    massageLabPixelSnowVariant: normalizeChoice(
      input.massageLabPixelSnowVariant,
      fallback.massageLabPixelSnowVariant,
      ["square", "round", "snowflake"],
    ),
    massageLabPixelSnowDirection: normalizeNumber(
      input.massageLabPixelSnowDirection,
      fallback.massageLabPixelSnowDirection,
      0,
      360,
    ),
    massageLabLightningXOffset: normalizeNumber(
      input.massageLabLightningXOffset,
      fallback.massageLabLightningXOffset,
      -2,
      2,
    ),
    massageLabLightningSpeed: normalizeNumber(input.massageLabLightningSpeed, fallback.massageLabLightningSpeed, 0, 5),
    massageLabLightningIntensity: normalizeNumber(
      input.massageLabLightningIntensity,
      fallback.massageLabLightningIntensity,
      0.1,
      5,
    ),
    massageLabLightningSize: normalizeNumber(input.massageLabLightningSize, fallback.massageLabLightningSize, 0.2, 5),
    massageLabPrismaticBurstIntensity: normalizeNumber(
      input.massageLabPrismaticBurstIntensity,
      fallback.massageLabPrismaticBurstIntensity,
      0,
      5,
    ),
    massageLabPrismaticBurstSpeed: normalizeNumber(
      input.massageLabPrismaticBurstSpeed,
      fallback.massageLabPrismaticBurstSpeed,
      0,
      3,
    ),
    massageLabPrismaticBurstAnimationType: normalizeChoice(
      input.massageLabPrismaticBurstAnimationType,
      fallback.massageLabPrismaticBurstAnimationType,
      ["rotate", "rotate3d", "hover"],
    ),
    massageLabPrismaticBurstDistort: normalizeNumber(
      input.massageLabPrismaticBurstDistort,
      fallback.massageLabPrismaticBurstDistort,
      0,
      50,
    ),
    massageLabPrismaticBurstOffsetX: normalizeNumber(
      input.massageLabPrismaticBurstOffsetX,
      fallback.massageLabPrismaticBurstOffsetX,
      -1000,
      1000,
    ),
    massageLabPrismaticBurstOffsetY: normalizeNumber(
      input.massageLabPrismaticBurstOffsetY,
      fallback.massageLabPrismaticBurstOffsetY,
      -1000,
      1000,
    ),
    massageLabPrismaticBurstHoverDampness: normalizeNumber(
      input.massageLabPrismaticBurstHoverDampness,
      fallback.massageLabPrismaticBurstHoverDampness,
      0,
      1,
    ),
    massageLabPrismaticBurstRayCount: Math.trunc(
      normalizeNumber(
        input.massageLabPrismaticBurstRayCount,
        fallback.massageLabPrismaticBurstRayCount,
        0,
        64,
      ),
    ),
    massageLabPrismaticBurstMixBlendMode: normalizeChoice(
      input.massageLabPrismaticBurstMixBlendMode,
      fallback.massageLabPrismaticBurstMixBlendMode,
      ["lighten", "screen", "none"],
    ),
    massageLabGalaxyHueShift: normalizeNumber(input.massageLabGalaxyHueShift, fallback.massageLabGalaxyHueShift, 0, 360),
    massageLabGalaxyFocalX: normalizeNumber(input.massageLabGalaxyFocalX, fallback.massageLabGalaxyFocalX, 0, 1),
    massageLabGalaxyFocalY: normalizeNumber(input.massageLabGalaxyFocalY, fallback.massageLabGalaxyFocalY, 0, 1),
    massageLabGalaxyRotationDeg: normalizeNumber(
      input.massageLabGalaxyRotationDeg,
      fallback.massageLabGalaxyRotationDeg,
      -360,
      360,
    ),
    massageLabGalaxyStarSpeed: normalizeNumber(input.massageLabGalaxyStarSpeed, fallback.massageLabGalaxyStarSpeed, 0, 5),
    massageLabGalaxyDensity: normalizeNumber(input.massageLabGalaxyDensity, fallback.massageLabGalaxyDensity, 0.1, 3),
    massageLabGalaxySpeed: normalizeNumber(input.massageLabGalaxySpeed, fallback.massageLabGalaxySpeed, 0, 5),
    massageLabGalaxyMouseInteraction: typeof input.massageLabGalaxyMouseInteraction === "boolean"
      ? input.massageLabGalaxyMouseInteraction
      : fallback.massageLabGalaxyMouseInteraction,
    massageLabGalaxyGlowIntensity: normalizeNumber(
      input.massageLabGalaxyGlowIntensity,
      fallback.massageLabGalaxyGlowIntensity,
      0.01,
      2,
    ),
    massageLabGalaxySaturation: normalizeNumber(
      input.massageLabGalaxySaturation,
      fallback.massageLabGalaxySaturation,
      0,
      2,
    ),
    massageLabGalaxyMouseRepulsion: typeof input.massageLabGalaxyMouseRepulsion === "boolean"
      ? input.massageLabGalaxyMouseRepulsion
      : fallback.massageLabGalaxyMouseRepulsion,
    massageLabGalaxyRepulsionStrength: normalizeNumber(
      input.massageLabGalaxyRepulsionStrength,
      fallback.massageLabGalaxyRepulsionStrength,
      0,
      6,
    ),
    massageLabGalaxyTwinkleIntensity: normalizeNumber(
      input.massageLabGalaxyTwinkleIntensity,
      fallback.massageLabGalaxyTwinkleIntensity,
      0,
      1,
    ),
    massageLabGalaxyRotationSpeed: normalizeNumber(
      input.massageLabGalaxyRotationSpeed,
      fallback.massageLabGalaxyRotationSpeed,
      -2,
      2,
    ),
    massageLabGalaxyAutoCenterRepulsion: normalizeNumber(
      input.massageLabGalaxyAutoCenterRepulsion,
      fallback.massageLabGalaxyAutoCenterRepulsion,
      0,
      6,
    ),
    massageLabGalaxyTransparent: typeof input.massageLabGalaxyTransparent === "boolean"
      ? input.massageLabGalaxyTransparent
      : fallback.massageLabGalaxyTransparent,
    massageLabDitherWaveSpeed: normalizeNumber(input.massageLabDitherWaveSpeed, fallback.massageLabDitherWaveSpeed, 0, 0.5),
    massageLabDitherWaveFrequency: normalizeNumber(
      input.massageLabDitherWaveFrequency,
      fallback.massageLabDitherWaveFrequency,
      0.5,
      8,
    ),
    massageLabDitherWaveAmplitude: normalizeNumber(
      input.massageLabDitherWaveAmplitude,
      fallback.massageLabDitherWaveAmplitude,
      0,
      1,
    ),
    massageLabDitherColorNum: normalizeInteger(input.massageLabDitherColorNum, fallback.massageLabDitherColorNum, 2, 16),
    massageLabDitherPixelSize: normalizeInteger(input.massageLabDitherPixelSize, fallback.massageLabDitherPixelSize, 1, 24),
    massageLabDitherMouseInteraction: typeof input.massageLabDitherMouseInteraction === "boolean"
      ? input.massageLabDitherMouseInteraction
      : fallback.massageLabDitherMouseInteraction,
    massageLabDitherMouseRadius: normalizeNumber(
      input.massageLabDitherMouseRadius,
      fallback.massageLabDitherMouseRadius,
      0.05,
      3,
    ),
    massageLabFaultyTerminalScale: normalizeNumber(
      input.massageLabFaultyTerminalScale,
      fallback.massageLabFaultyTerminalScale,
      0.25,
      4,
    ),
    massageLabFaultyTerminalGridMulX: normalizeNumber(
      input.massageLabFaultyTerminalGridMulX,
      fallback.massageLabFaultyTerminalGridMulX,
      0.25,
      6,
    ),
    massageLabFaultyTerminalGridMulY: normalizeNumber(
      input.massageLabFaultyTerminalGridMulY,
      fallback.massageLabFaultyTerminalGridMulY,
      0.25,
      6,
    ),
    massageLabFaultyTerminalDigitSize: normalizeNumber(
      input.massageLabFaultyTerminalDigitSize,
      fallback.massageLabFaultyTerminalDigitSize,
      0.5,
      4,
    ),
    massageLabFaultyTerminalTimeScale: normalizeNumber(
      input.massageLabFaultyTerminalTimeScale,
      fallback.massageLabFaultyTerminalTimeScale,
      0,
      2,
    ),
    massageLabFaultyTerminalScanlineIntensity: normalizeNumber(
      input.massageLabFaultyTerminalScanlineIntensity,
      fallback.massageLabFaultyTerminalScanlineIntensity,
      0,
      2,
    ),
    massageLabFaultyTerminalGlitchAmount: normalizeNumber(
      input.massageLabFaultyTerminalGlitchAmount,
      fallback.massageLabFaultyTerminalGlitchAmount,
      0,
      3,
    ),
    massageLabFaultyTerminalFlickerAmount: normalizeNumber(
      input.massageLabFaultyTerminalFlickerAmount,
      fallback.massageLabFaultyTerminalFlickerAmount,
      0,
      2,
    ),
    massageLabFaultyTerminalNoiseAmp: normalizeNumber(
      input.massageLabFaultyTerminalNoiseAmp,
      fallback.massageLabFaultyTerminalNoiseAmp,
      0,
      2,
    ),
    massageLabFaultyTerminalChromaticAberration: normalizeNumber(
      input.massageLabFaultyTerminalChromaticAberration,
      fallback.massageLabFaultyTerminalChromaticAberration,
      0,
      8,
    ),
    massageLabFaultyTerminalDither: normalizeNumber(
      input.massageLabFaultyTerminalDither,
      fallback.massageLabFaultyTerminalDither,
      0,
      255,
    ),
    massageLabFaultyTerminalCurvature: normalizeNumber(
      input.massageLabFaultyTerminalCurvature,
      fallback.massageLabFaultyTerminalCurvature,
      0,
      1,
    ),
    massageLabFaultyTerminalMouseReact: typeof input.massageLabFaultyTerminalMouseReact === "boolean"
      ? input.massageLabFaultyTerminalMouseReact
      : fallback.massageLabFaultyTerminalMouseReact,
    massageLabFaultyTerminalMouseStrength: normalizeNumber(
      input.massageLabFaultyTerminalMouseStrength,
      fallback.massageLabFaultyTerminalMouseStrength,
      0,
      2,
    ),
    massageLabFaultyTerminalPageLoadAnimation: typeof input.massageLabFaultyTerminalPageLoadAnimation === "boolean"
      ? input.massageLabFaultyTerminalPageLoadAnimation
      : fallback.massageLabFaultyTerminalPageLoadAnimation,
    massageLabFaultyTerminalBrightness: normalizeNumber(
      input.massageLabFaultyTerminalBrightness,
      fallback.massageLabFaultyTerminalBrightness,
      0.1,
      3,
    ),
    massageLabRippleGridRippleIntensity: normalizeNumber(
      input.massageLabRippleGridRippleIntensity,
      fallback.massageLabRippleGridRippleIntensity,
      0,
      0.3,
    ),
    massageLabRippleGridGridSize: normalizeNumber(
      input.massageLabRippleGridGridSize,
      fallback.massageLabRippleGridGridSize,
      2,
      30,
    ),
    massageLabRippleGridGridThickness: normalizeNumber(
      input.massageLabRippleGridGridThickness,
      fallback.massageLabRippleGridGridThickness,
      1,
      50,
    ),
    massageLabRippleGridFadeDistance: normalizeNumber(
      input.massageLabRippleGridFadeDistance,
      fallback.massageLabRippleGridFadeDistance,
      0.2,
      5,
    ),
    massageLabRippleGridVignetteStrength: normalizeNumber(
      input.massageLabRippleGridVignetteStrength,
      fallback.massageLabRippleGridVignetteStrength,
      0.1,
      6,
    ),
    massageLabRippleGridGlowIntensity: normalizeNumber(
      input.massageLabRippleGridGlowIntensity,
      fallback.massageLabRippleGridGlowIntensity,
      0,
      1,
    ),
    massageLabRippleGridOpacity: normalizeNumber(input.massageLabRippleGridOpacity, fallback.massageLabRippleGridOpacity, 0, 1),
    massageLabRippleGridGridRotation: normalizeNumber(
      input.massageLabRippleGridGridRotation,
      fallback.massageLabRippleGridGridRotation,
      -180,
      180,
    ),
    massageLabRippleGridMouseInteraction: typeof input.massageLabRippleGridMouseInteraction === "boolean"
      ? input.massageLabRippleGridMouseInteraction
      : fallback.massageLabRippleGridMouseInteraction,
    massageLabRippleGridMouseInteractionRadius: normalizeNumber(
      input.massageLabRippleGridMouseInteractionRadius,
      fallback.massageLabRippleGridMouseInteractionRadius,
      0.1,
      5,
    ),
    massageLabDotFieldDotRadius: normalizeNumber(input.massageLabDotFieldDotRadius, fallback.massageLabDotFieldDotRadius, 0.5, 8),
    massageLabDotFieldDotSpacing: normalizeNumber(
      input.massageLabDotFieldDotSpacing,
      fallback.massageLabDotFieldDotSpacing,
      4,
      48,
    ),
    massageLabDotFieldCursorRadius: normalizeNumber(
      input.massageLabDotFieldCursorRadius,
      fallback.massageLabDotFieldCursorRadius,
      60,
      900,
    ),
    massageLabDotFieldCursorForce: normalizeNumber(
      input.massageLabDotFieldCursorForce,
      fallback.massageLabDotFieldCursorForce,
      0.01,
      1,
    ),
    massageLabDotFieldBulgeOnly: typeof input.massageLabDotFieldBulgeOnly === "boolean"
      ? input.massageLabDotFieldBulgeOnly
      : fallback.massageLabDotFieldBulgeOnly,
    massageLabDotFieldBulgeStrength: normalizeNumber(
      input.massageLabDotFieldBulgeStrength,
      fallback.massageLabDotFieldBulgeStrength,
      0,
      160,
    ),
    massageLabDotFieldGlowRadius: normalizeNumber(
      input.massageLabDotFieldGlowRadius,
      fallback.massageLabDotFieldGlowRadius,
      0,
      360,
    ),
    massageLabDotFieldSparkle: typeof input.massageLabDotFieldSparkle === "boolean"
      ? input.massageLabDotFieldSparkle
      : fallback.massageLabDotFieldSparkle,
    massageLabDotFieldWaveAmplitude: normalizeNumber(
      input.massageLabDotFieldWaveAmplitude,
      fallback.massageLabDotFieldWaveAmplitude,
      0,
      48,
    ),
    massageLabDotFieldCursorInteraction: typeof input.massageLabDotFieldCursorInteraction === "boolean"
      ? input.massageLabDotFieldCursorInteraction
      : fallback.massageLabDotFieldCursorInteraction,
    massageLabDotGridDotSize: normalizeNumber(input.massageLabDotGridDotSize, fallback.massageLabDotGridDotSize, 2, 40),
    massageLabDotGridGap: normalizeNumber(input.massageLabDotGridGap, fallback.massageLabDotGridGap, 4, 80),
    massageLabDotGridProximity: normalizeNumber(
      input.massageLabDotGridProximity,
      fallback.massageLabDotGridProximity,
      40,
      500,
    ),
    massageLabDotGridSpeedTrigger: normalizeNumber(
      input.massageLabDotGridSpeedTrigger,
      fallback.massageLabDotGridSpeedTrigger,
      0,
      1000,
    ),
    massageLabDotGridShockRadius: normalizeNumber(
      input.massageLabDotGridShockRadius,
      fallback.massageLabDotGridShockRadius,
      40,
      700,
    ),
    massageLabDotGridShockStrength: normalizeNumber(
      input.massageLabDotGridShockStrength,
      fallback.massageLabDotGridShockStrength,
      0,
      12,
    ),
    massageLabDotGridMaxSpeed: normalizeNumber(
      input.massageLabDotGridMaxSpeed,
      fallback.massageLabDotGridMaxSpeed,
      100,
      8000,
    ),
    massageLabDotGridResistance: normalizeNumber(
      input.massageLabDotGridResistance,
      fallback.massageLabDotGridResistance,
      120,
      1600,
    ),
    massageLabDotGridReturnDuration: normalizeNumber(
      input.massageLabDotGridReturnDuration,
      fallback.massageLabDotGridReturnDuration,
      0.1,
      4,
    ),
    massageLabDotGridCursorInteraction: typeof input.massageLabDotGridCursorInteraction === "boolean"
      ? input.massageLabDotGridCursorInteraction
      : fallback.massageLabDotGridCursorInteraction,
    massageLabDotGridClickShock: typeof input.massageLabDotGridClickShock === "boolean"
      ? input.massageLabDotGridClickShock
      : fallback.massageLabDotGridClickShock,
    massageLabThreadsAmplitude: normalizeNumber(
      input.massageLabThreadsAmplitude,
      fallback.massageLabThreadsAmplitude,
      0,
      3,
    ),
    massageLabThreadsDistance: normalizeNumber(
      input.massageLabThreadsDistance,
      fallback.massageLabThreadsDistance,
      -1,
      1.5,
    ),
    massageLabThreadsEnableMouseInteraction: typeof input.massageLabThreadsEnableMouseInteraction === "boolean"
      ? input.massageLabThreadsEnableMouseInteraction
      : fallback.massageLabThreadsEnableMouseInteraction,
    massageLabIridescenceSpeed: normalizeNumber(
      input.massageLabIridescenceSpeed,
      fallback.massageLabIridescenceSpeed,
      0,
      3,
    ),
    massageLabIridescenceAmplitude: normalizeNumber(
      input.massageLabIridescenceAmplitude,
      fallback.massageLabIridescenceAmplitude,
      0,
      1,
    ),
    massageLabIridescenceMouseReact: typeof input.massageLabIridescenceMouseReact === "boolean"
      ? input.massageLabIridescenceMouseReact
      : fallback.massageLabIridescenceMouseReact,
    massageLabWavesTransparentBackground: typeof input.massageLabWavesTransparentBackground === "boolean"
      ? input.massageLabWavesTransparentBackground
      : fallback.massageLabWavesTransparentBackground,
    massageLabWavesSpeedX: normalizeNumber(input.massageLabWavesSpeedX, fallback.massageLabWavesSpeedX, 0, 0.05),
    massageLabWavesSpeedY: normalizeNumber(input.massageLabWavesSpeedY, fallback.massageLabWavesSpeedY, 0, 0.05),
    massageLabWavesAmplitudeX: normalizeNumber(
      input.massageLabWavesAmplitudeX,
      fallback.massageLabWavesAmplitudeX,
      0,
      96,
    ),
    massageLabWavesAmplitudeY: normalizeNumber(
      input.massageLabWavesAmplitudeY,
      fallback.massageLabWavesAmplitudeY,
      0,
      96,
    ),
    massageLabWavesGapX: normalizeNumber(input.massageLabWavesGapX, fallback.massageLabWavesGapX, 4, 40),
    massageLabWavesGapY: normalizeNumber(input.massageLabWavesGapY, fallback.massageLabWavesGapY, 8, 96),
    massageLabWavesFriction: normalizeNumber(input.massageLabWavesFriction, fallback.massageLabWavesFriction, 0.8, 0.99),
    massageLabWavesTension: normalizeNumber(input.massageLabWavesTension, fallback.massageLabWavesTension, 0.001, 0.05),
    massageLabWavesMaxCursorMove: normalizeNumber(
      input.massageLabWavesMaxCursorMove,
      fallback.massageLabWavesMaxCursorMove,
      0,
      240,
    ),
    massageLabWavesCursorInteraction: typeof input.massageLabWavesCursorInteraction === "boolean"
      ? input.massageLabWavesCursorInteraction
      : fallback.massageLabWavesCursorInteraction,
    massageLabGridDistortionGrid: Math.trunc(normalizeNumber(
      input.massageLabGridDistortionGrid,
      fallback.massageLabGridDistortionGrid,
      4,
      40,
    )),
    massageLabGridDistortionMouse: normalizeNumber(
      input.massageLabGridDistortionMouse,
      fallback.massageLabGridDistortionMouse,
      0.02,
      0.5,
    ),
    massageLabGridDistortionStrength: normalizeNumber(
      input.massageLabGridDistortionStrength,
      fallback.massageLabGridDistortionStrength,
      0,
      0.6,
    ),
    massageLabGridDistortionRelaxation: normalizeNumber(
      input.massageLabGridDistortionRelaxation,
      fallback.massageLabGridDistortionRelaxation,
      0.75,
      0.99,
    ),
    massageLabGridDistortionCursorInteraction: typeof input.massageLabGridDistortionCursorInteraction === "boolean"
      ? input.massageLabGridDistortionCursorInteraction
      : fallback.massageLabGridDistortionCursorInteraction,
    massageLabOrbHoverIntensity: normalizeNumber(
      input.massageLabOrbHoverIntensity,
      fallback.massageLabOrbHoverIntensity,
      0,
      1,
    ),
    massageLabOrbRotateOnHover: typeof input.massageLabOrbRotateOnHover === "boolean"
      ? input.massageLabOrbRotateOnHover
      : fallback.massageLabOrbRotateOnHover,
    massageLabOrbForceHoverState: typeof input.massageLabOrbForceHoverState === "boolean"
      ? input.massageLabOrbForceHoverState
      : fallback.massageLabOrbForceHoverState,
    massageLabOrbCursorInteraction: typeof input.massageLabOrbCursorInteraction === "boolean"
      ? input.massageLabOrbCursorInteraction
      : fallback.massageLabOrbCursorInteraction,
    massageLabLetterGlitchGlitchSpeed: normalizeNumber(
      input.massageLabLetterGlitchGlitchSpeed,
      fallback.massageLabLetterGlitchGlitchSpeed,
      16,
      500,
    ),
    massageLabLetterGlitchCenterVignette: typeof input.massageLabLetterGlitchCenterVignette === "boolean"
      ? input.massageLabLetterGlitchCenterVignette
      : fallback.massageLabLetterGlitchCenterVignette,
    massageLabLetterGlitchOuterVignette: typeof input.massageLabLetterGlitchOuterVignette === "boolean"
      ? input.massageLabLetterGlitchOuterVignette
      : fallback.massageLabLetterGlitchOuterVignette,
    massageLabLetterGlitchSmooth: typeof input.massageLabLetterGlitchSmooth === "boolean"
      ? input.massageLabLetterGlitchSmooth
      : fallback.massageLabLetterGlitchSmooth,
    massageLabLetterGlitchCharacters: typeof input.massageLabLetterGlitchCharacters === "string"
      && input.massageLabLetterGlitchCharacters.trim().length > 0
      ? input.massageLabLetterGlitchCharacters.slice(0, 120)
      : fallback.massageLabLetterGlitchCharacters,
    massageLabGridMotionMaxMoveAmount: normalizeNumber(
      input.massageLabGridMotionMaxMoveAmount,
      fallback.massageLabGridMotionMaxMoveAmount,
      0,
      600,
    ),
    massageLabGridMotionBaseDuration: normalizeNumber(
      input.massageLabGridMotionBaseDuration,
      fallback.massageLabGridMotionBaseDuration,
      0.1,
      2,
    ),
    massageLabGridMotionCursorInteraction: typeof input.massageLabGridMotionCursorInteraction === "boolean"
      ? input.massageLabGridMotionCursorInteraction
      : fallback.massageLabGridMotionCursorInteraction,
    massageLabShapeGridDirection: normalizeChoice(input.massageLabShapeGridDirection, fallback.massageLabShapeGridDirection, [
      "right",
      "left",
      "up",
      "down",
      "diagonal",
    ]),
    massageLabShapeGridSpeed: normalizeNumber(input.massageLabShapeGridSpeed, fallback.massageLabShapeGridSpeed, 0.1, 8),
    massageLabShapeGridSquareSize: normalizeNumber(
      input.massageLabShapeGridSquareSize,
      fallback.massageLabShapeGridSquareSize,
      12,
      96,
    ),
    massageLabShapeGridShape: normalizeChoice(input.massageLabShapeGridShape, fallback.massageLabShapeGridShape, [
      "square",
      "circle",
      "triangle",
      "hexagon",
    ]),
    massageLabShapeGridHoverTrailAmount: Math.trunc(normalizeNumber(
      input.massageLabShapeGridHoverTrailAmount,
      fallback.massageLabShapeGridHoverTrailAmount,
      0,
      24,
    )),
    massageLabShapeGridCursorInteraction: typeof input.massageLabShapeGridCursorInteraction === "boolean"
      ? input.massageLabShapeGridCursorInteraction
      : fallback.massageLabShapeGridCursorInteraction,
    massageLabLiquidChromeSpeed: normalizeNumber(
      input.massageLabLiquidChromeSpeed,
      fallback.massageLabLiquidChromeSpeed,
      0,
      3,
    ),
    massageLabLiquidChromeAmplitude: normalizeNumber(
      input.massageLabLiquidChromeAmplitude,
      fallback.massageLabLiquidChromeAmplitude,
      0,
      1,
    ),
    massageLabLiquidChromeFrequencyX: normalizeNumber(
      input.massageLabLiquidChromeFrequencyX,
      fallback.massageLabLiquidChromeFrequencyX,
      0.1,
      12,
    ),
    massageLabLiquidChromeFrequencyY: normalizeNumber(
      input.massageLabLiquidChromeFrequencyY,
      fallback.massageLabLiquidChromeFrequencyY,
      0.1,
      12,
    ),
    massageLabLiquidChromeInteractive: typeof input.massageLabLiquidChromeInteractive === "boolean"
      ? input.massageLabLiquidChromeInteractive
      : fallback.massageLabLiquidChromeInteractive,
    massageLabBalatroSpinRotation: normalizeNumber(
      input.massageLabBalatroSpinRotation,
      fallback.massageLabBalatroSpinRotation,
      -8,
      8,
    ),
    massageLabBalatroSpinSpeed: normalizeNumber(input.massageLabBalatroSpinSpeed, fallback.massageLabBalatroSpinSpeed, 0, 14),
    massageLabBalatroOffsetX: normalizeNumber(input.massageLabBalatroOffsetX, fallback.massageLabBalatroOffsetX, -1, 1),
    massageLabBalatroOffsetY: normalizeNumber(input.massageLabBalatroOffsetY, fallback.massageLabBalatroOffsetY, -1, 1),
    massageLabBalatroContrast: normalizeNumber(input.massageLabBalatroContrast, fallback.massageLabBalatroContrast, 0.5, 8),
    massageLabBalatroLighting: normalizeNumber(input.massageLabBalatroLighting, fallback.massageLabBalatroLighting, 0, 1),
    massageLabBalatroSpinAmount: normalizeNumber(input.massageLabBalatroSpinAmount, fallback.massageLabBalatroSpinAmount, 0, 1),
    massageLabBalatroPixelFilter: normalizeNumber(
      input.massageLabBalatroPixelFilter,
      fallback.massageLabBalatroPixelFilter,
      120,
      1200,
    ),
    massageLabBalatroSpinEase: normalizeNumber(input.massageLabBalatroSpinEase, fallback.massageLabBalatroSpinEase, 0, 3),
    massageLabBalatroIsRotate: typeof input.massageLabBalatroIsRotate === "boolean"
      ? input.massageLabBalatroIsRotate
      : fallback.massageLabBalatroIsRotate,
    massageLabBalatroMouseInteraction: typeof input.massageLabBalatroMouseInteraction === "boolean"
      ? input.massageLabBalatroMouseInteraction
      : fallback.massageLabBalatroMouseInteraction,
    massageLabNovatrixSpeed: normalizeNumber(input.massageLabNovatrixSpeed, fallback.massageLabNovatrixSpeed, 0.02, 3),
    massageLabNovatrixAmplitude: normalizeNumber(
      input.massageLabNovatrixAmplitude,
      fallback.massageLabNovatrixAmplitude,
      0.01,
      0.45,
    ),
    massageLabMatrixRainSpeed: normalizeNumber(input.massageLabMatrixRainSpeed, fallback.massageLabMatrixRainSpeed, 0.05, 3),
    massageLabMatrixRainFontSize: normalizeInteger(input.massageLabMatrixRainFontSize, fallback.massageLabMatrixRainFontSize, 8, 28),
    massageLabPhotonBeamLineCount: normalizeInteger(input.massageLabPhotonBeamLineCount, fallback.massageLabPhotonBeamLineCount, 12, 160),
    massageLabPhotonBeamSpreadHeight: normalizeNumber(input.massageLabPhotonBeamSpreadHeight, fallback.massageLabPhotonBeamSpreadHeight, 5, 90),
    massageLabPhotonBeamSpreadDepth: normalizeNumber(input.massageLabPhotonBeamSpreadDepth, fallback.massageLabPhotonBeamSpreadDepth, 0, 60),
    massageLabPhotonBeamCurveLength: normalizeNumber(input.massageLabPhotonBeamCurveLength, fallback.massageLabPhotonBeamCurveLength, 16, 120),
    massageLabPhotonBeamStraightLength: normalizeNumber(input.massageLabPhotonBeamStraightLength, fallback.massageLabPhotonBeamStraightLength, 40, 220),
    massageLabPhotonBeamCurvePower: normalizeNumber(input.massageLabPhotonBeamCurvePower, fallback.massageLabPhotonBeamCurvePower, 0.2, 2),
    massageLabPhotonBeamWaveSpeed: normalizeNumber(input.massageLabPhotonBeamWaveSpeed, fallback.massageLabPhotonBeamWaveSpeed, 0, 8),
    massageLabPhotonBeamWaveHeight: normalizeNumber(input.massageLabPhotonBeamWaveHeight, fallback.massageLabPhotonBeamWaveHeight, 0, 1),
    massageLabPhotonBeamLineOpacity: normalizeNumber(input.massageLabPhotonBeamLineOpacity, fallback.massageLabPhotonBeamLineOpacity, 0.05, 1),
    massageLabPhotonBeamSignalCount: normalizeInteger(input.massageLabPhotonBeamSignalCount, fallback.massageLabPhotonBeamSignalCount, 0, 220),
    massageLabPhotonBeamSpeedGlobal: normalizeNumber(input.massageLabPhotonBeamSpeedGlobal, fallback.massageLabPhotonBeamSpeedGlobal, 0.02, 2),
    massageLabPhotonBeamTrailLength: normalizeInteger(input.massageLabPhotonBeamTrailLength, fallback.massageLabPhotonBeamTrailLength, 1, 16),
    massageLabPhotonBeamBloomStrength: normalizeNumber(input.massageLabPhotonBeamBloomStrength, fallback.massageLabPhotonBeamBloomStrength, 0, 6),
    massageLabPhotonBeamBloomRadius: normalizeNumber(input.massageLabPhotonBeamBloomRadius, fallback.massageLabPhotonBeamBloomRadius, 0, 1.5),
    massageLab3DGlobeViewStyle: normalizeMassageLab3DGlobeViewStyle(
      input.massageLab3DGlobeViewStyle,
      fallback.massageLab3DGlobeViewStyle,
    ),
    massageLab3DGlobeGraphicMapSamples: normalizeInteger(
      input.massageLab3DGlobeGraphicMapSamples,
      fallback.massageLab3DGlobeGraphicMapSamples,
      MASSAGE_LAB_3D_GLOBE_GRAPHIC_MAP_SAMPLES_MIN,
      MASSAGE_LAB_3D_GLOBE_GRAPHIC_MAP_SAMPLES_MAX,
    ),
    massageLab3DGlobeAutoRotateSpeed: normalizeNumber(
      input.massageLab3DGlobeAutoRotateSpeed,
      fallback.massageLab3DGlobeAutoRotateSpeed,
      0.01,
      2,
    ),
    // Reverse spin is a fixed product default; ignore legacy persisted toggle values.
    massageLab3DGlobeReverseSpin: true,
    massageLab3DGlobeScale: normalizeNumber(
      input.massageLab3DGlobeScale,
      fallback.massageLab3DGlobeScale,
      MASSAGE_LAB_3D_GLOBE_MIN_SCALE,
      MASSAGE_LAB_3D_GLOBE_MAX_SCALE,
    ),
    massageLab3DGlobeBumpScale: normalizeNumber(input.massageLab3DGlobeBumpScale, fallback.massageLab3DGlobeBumpScale, 0, 3),
    massageLab3DGlobeAmbientIntensity: normalizeNumber(
      input.massageLab3DGlobeAmbientIntensity,
      fallback.massageLab3DGlobeAmbientIntensity,
      0,
      2,
    ),
    massageLab3DGlobePointLightIntensity: normalizeNumber(
      input.massageLab3DGlobePointLightIntensity,
      fallback.massageLab3DGlobePointLightIntensity,
      0,
      4,
    ),
    massageLab3DGlobeLightingMode: normalizeMassageLab3DGlobeLightingMode(
      input.massageLab3DGlobeLightingMode,
      fallback.massageLab3DGlobeLightingMode,
    ),
    massageLab3DGlobeEnablePan:
      typeof input.massageLab3DGlobeEnablePan === "boolean"
        ? input.massageLab3DGlobeEnablePan
        : fallback.massageLab3DGlobeEnablePan,
    massageLab3DGlobePanX: normalizeNumber(
      input.massageLab3DGlobePanX,
      fallback.massageLab3DGlobePanX,
      -50,
      50,
    ),
    massageLab3DGlobePanY: normalizeNumber(
      input.massageLab3DGlobePanY,
      fallback.massageLab3DGlobePanY,
      -50,
      50,
    ),
    // Earth tilt is a fixed product default; ignore legacy persisted toggle values.
    massageLab3DGlobeShowTilt: true,
    massageLab3DGlobeShowAtmosphere:
      typeof input.massageLab3DGlobeShowAtmosphere === "boolean"
        ? input.massageLab3DGlobeShowAtmosphere
        : fallback.massageLab3DGlobeShowAtmosphere,
    massageLab3DGlobeAtmosphereIntensity: normalizeNumber(
      input.massageLab3DGlobeAtmosphereIntensity,
      fallback.massageLab3DGlobeAtmosphereIntensity,
      0,
      2,
    ),
    massageLab3DGlobeAtmosphereBlur: normalizeNumber(
      input.massageLab3DGlobeAtmosphereBlur,
      fallback.massageLab3DGlobeAtmosphereBlur,
      0.5,
      5,
    ),
    massageLab3DGlobeShowWireframe:
      typeof input.massageLab3DGlobeShowWireframe === "boolean"
        ? input.massageLab3DGlobeShowWireframe
        : fallback.massageLab3DGlobeShowWireframe,
    massageLab3DGlobeMarkerEnabled:
      typeof input.massageLab3DGlobeMarkerEnabled === "boolean"
        ? input.massageLab3DGlobeMarkerEnabled
        : fallback.massageLab3DGlobeMarkerEnabled,
    massageLab3DGlobeMarkerLat: normalizeNumber(
      input.massageLab3DGlobeMarkerLat,
      fallback.massageLab3DGlobeMarkerLat,
      -90,
      90,
    ),
    massageLab3DGlobeMarkerLng: normalizeNumber(
      input.massageLab3DGlobeMarkerLng,
      fallback.massageLab3DGlobeMarkerLng,
      -180,
      180,
    ),
    massageLab3DGlobeMarkerLabel: normalizeOptionalShortString(
      input.massageLab3DGlobeMarkerLabel,
      fallback.massageLab3DGlobeMarkerLabel,
      80,
    ),
    massageLab3DGlobeMarkerIcon: normalizeChoice(
      input.massageLab3DGlobeMarkerIcon,
      fallback.massageLab3DGlobeMarkerIcon,
      ["pin", "person", "heart", "star", "home"],
    ),
    massageLab3DGlobeMarkerSize: normalizeNumber(
      input.massageLab3DGlobeMarkerSize,
      fallback.massageLab3DGlobeMarkerSize,
      0.03,
      0.16,
    ),
    massageLabRetroGridAngle: normalizeNumber(input.massageLabRetroGridAngle, fallback.massageLabRetroGridAngle, 1, 89),
    massageLabRetroGridCellSize: normalizeNumber(input.massageLabRetroGridCellSize, fallback.massageLabRetroGridCellSize, 12, 160),
    massageLabRetroGridOpacity: normalizeNumber(input.massageLabRetroGridOpacity, fallback.massageLabRetroGridOpacity, 0.05, 1),
    massageLabAerialRaysCount: normalizeInteger(input.massageLabAerialRaysCount, fallback.massageLabAerialRaysCount, 1, 20),
    massageLabAerialRaysBlur: normalizeNumber(input.massageLabAerialRaysBlur, fallback.massageLabAerialRaysBlur, 0, 80),
    massageLabAerialRaysSpeed: normalizeNumber(input.massageLabAerialRaysSpeed, fallback.massageLabAerialRaysSpeed, 2, 40),
    massageLabAerialRaysLength: normalizeNumber(input.massageLabAerialRaysLength, fallback.massageLabAerialRaysLength, 24, 120),
    massageLabAerialRaysOpacity: normalizeNumber(input.massageLabAerialRaysOpacity, fallback.massageLabAerialRaysOpacity, 0.05, 1),
    massageLabDnaStrandCount: normalizeInteger(input.massageLabDnaStrandCount, fallback.massageLabDnaStrandCount, 7, 25),
    massageLabDnaNodeMotionSpeed: normalizeNumber(input.massageLabDnaNodeMotionSpeed, fallback.massageLabDnaNodeMotionSpeed, 0.25, 3),
    massageLabDnaStrandRotationSpeed: normalizeNumber(input.massageLabDnaStrandRotationSpeed, fallback.massageLabDnaStrandRotationSpeed, 0.1, 3),
    massageLabDnaStrandAngle: normalizeNumber(input.massageLabDnaStrandAngle, fallback.massageLabDnaStrandAngle, -180, 180),
    massageLabDnaScale: normalizeNumber(input.massageLabDnaScale, fallback.massageLabDnaScale, 0.4, 1.2),
    massageLabDnaPositionX: normalizeNumber(input.massageLabDnaPositionX, fallback.massageLabDnaPositionX, -35, 35),
    massageLabDnaPositionY: normalizeNumber(input.massageLabDnaPositionY, fallback.massageLabDnaPositionY, -35, 35),
    massageLabDnaStrandSpacing: normalizeNumber(input.massageLabDnaStrandSpacing, fallback.massageLabDnaStrandSpacing, 0, 2),
    massageLabDnaConnectorWidth: normalizeNumber(input.massageLabDnaConnectorWidth, fallback.massageLabDnaConnectorWidth, 60, 100),
    massageLabDnaConnectorThickness: normalizeNumber(input.massageLabDnaConnectorThickness, fallback.massageLabDnaConnectorThickness, 10, 60),
    massageLabDnaOutlineThickness: normalizeNumber(input.massageLabDnaOutlineThickness, fallback.massageLabDnaOutlineThickness, 0, 1.5),
    massageLabTwistedCubesLayerCount: normalizeInteger(input.massageLabTwistedCubesLayerCount, fallback.massageLabTwistedCubesLayerCount, 6, 30),
    massageLabTwistedCubesRotationSpeed: normalizeNumber(input.massageLabTwistedCubesRotationSpeed, fallback.massageLabTwistedCubesRotationSpeed, 0.25, 3),
    massageLabTwistedCubesLayerStagger: normalizeNumber(input.massageLabTwistedCubesLayerStagger, fallback.massageLabTwistedCubesLayerStagger, 0, 0.3),
    massageLabTwistedCubesViewAngleX: normalizeNumber(input.massageLabTwistedCubesViewAngleX, fallback.massageLabTwistedCubesViewAngleX, -80, 80),
    massageLabTwistedCubesViewAngleY: normalizeNumber(input.massageLabTwistedCubesViewAngleY, fallback.massageLabTwistedCubesViewAngleY, -80, 80),
    massageLabTwistedCubesScale: normalizeNumber(input.massageLabTwistedCubesScale, fallback.massageLabTwistedCubesScale, 0.4, 1.2),
    massageLabTwistedCubesPositionX: normalizeNumber(input.massageLabTwistedCubesPositionX, fallback.massageLabTwistedCubesPositionX, -35, 35),
    massageLabTwistedCubesPositionY: normalizeNumber(input.massageLabTwistedCubesPositionY, fallback.massageLabTwistedCubesPositionY, -35, 35),
    massageLabTwistedCubesLayerDepthSpacing: normalizeNumber(input.massageLabTwistedCubesLayerDepthSpacing, fallback.massageLabTwistedCubesLayerDepthSpacing, 10, 70),
    massageLabTwistedCubesOpacityFalloff: normalizeNumber(input.massageLabTwistedCubesOpacityFalloff, fallback.massageLabTwistedCubesOpacityFalloff, 0, 0.95),
    massageLabTwistedCubesOutlineThickness: normalizeNumber(input.massageLabTwistedCubesOutlineThickness, fallback.massageLabTwistedCubesOutlineThickness, 0.0025, 0.02),
    massageLabSynthesisSpeed: normalizeNumber(input.massageLabSynthesisSpeed, fallback.massageLabSynthesisSpeed, 0.004, 2),
    massageLabSynthesisComplexity: normalizeInteger(input.massageLabSynthesisComplexity, fallback.massageLabSynthesisComplexity, 1, 20),
    massageLabSynthesisScale: normalizeNumber(input.massageLabSynthesisScale, fallback.massageLabSynthesisScale, 0.1, 5),
    massageLabSynthesisDistortion: normalizeNumber(input.massageLabSynthesisDistortion, fallback.massageLabSynthesisDistortion, 0, 2),
    massageLabSynthesisGlowIntensity: normalizeNumber(input.massageLabSynthesisGlowIntensity, fallback.massageLabSynthesisGlowIntensity, 0, 2),
    massageLabSynthesisFlowFrequency: normalizeNumber(input.massageLabSynthesisFlowFrequency, fallback.massageLabSynthesisFlowFrequency, 0.5, 10),
    backgroundLinesDuration: normalizeNumber(input.backgroundLinesDuration, fallback.backgroundLinesDuration, 4, 18),
    shootingStarsDensity: normalizeNumber(input.shootingStarsDensity, fallback.shootingStarsDensity, 0.00005, 0.00035),
    shootingStarsTwinkle:
      typeof input.shootingStarsTwinkle === "boolean" ? input.shootingStarsTwinkle : fallback.shootingStarsTwinkle,
    shootingStarsTwinkleSpeed: normalizeNumber(input.shootingStarsTwinkleSpeed, fallback.shootingStarsTwinkleSpeed, 0.4, 2.5),
    shootingStarsShootingSpeed: normalizeNumber(input.shootingStarsShootingSpeed, fallback.shootingStarsShootingSpeed, 0.5, 2),
    shootingStarsFrequency: normalizeNumber(input.shootingStarsFrequency, fallback.shootingStarsFrequency, 0.4, 2),
    canvasRevealDotsDotSize: normalizeNumber(input.canvasRevealDotsDotSize, fallback.canvasRevealDotsDotSize, 1, 5),
    canvasRevealDotsDotSpacing: normalizeNumber(input.canvasRevealDotsDotSpacing, fallback.canvasRevealDotsDotSpacing, 4, 24),
    canvasRevealDotsOpacity: normalizeNumber(input.canvasRevealDotsOpacity, fallback.canvasRevealDotsOpacity, 0.08, 1),
    canvasRevealDotsAnimationSpeed: normalizeNumber(input.canvasRevealDotsAnimationSpeed, fallback.canvasRevealDotsAnimationSpeed, 0.1, 1),
    canvasRevealDotsShowGradient:
      typeof input.canvasRevealDotsShowGradient === "boolean" ? input.canvasRevealDotsShowGradient : fallback.canvasRevealDotsShowGradient,
    spotlightOpacity: normalizeNumber(input.spotlightOpacity, fallback.spotlightOpacity, 0.25, 1.5),
    spotlightWidth: normalizeNumber(input.spotlightWidth, fallback.spotlightWidth, 240, 900),
    spotlightHeight: normalizeNumber(input.spotlightHeight, fallback.spotlightHeight, 600, 1800),
    spotlightSmallWidth: normalizeNumber(input.spotlightSmallWidth, fallback.spotlightSmallWidth, 120, 420),
    spotlightTranslateY: normalizeNumber(input.spotlightTranslateY, fallback.spotlightTranslateY, -650, 120),
    spotlightDuration: normalizeNumber(input.spotlightDuration, fallback.spotlightDuration, 3, 16),
    spotlightXOffset: normalizeNumber(input.spotlightXOffset, fallback.spotlightXOffset, 0, 220),
    lampGlowOpacity: normalizeNumber(input.lampGlowOpacity, fallback.lampGlowOpacity, 0.18, 0.95),
    lampBeamWidth: normalizeNumber(input.lampBeamWidth, fallback.lampBeamWidth, 240, 900),
    lampGlowWidth: normalizeNumber(input.lampGlowWidth, fallback.lampGlowWidth, 180, 900),
    lampVerticalOffset: normalizeNumber(input.lampVerticalOffset, fallback.lampVerticalOffset, -320, 160),
    lampPulseSpeed: normalizeNumber(input.lampPulseSpeed, fallback.lampPulseSpeed, 4, 18),
    vortexParticleCount: normalizeInteger(input.vortexParticleCount, fallback.vortexParticleCount, 120, 700),
    vortexRangeY: normalizeNumber(input.vortexRangeY, fallback.vortexRangeY, 40, 220),
    vortexBaseSpeed: normalizeNumber(input.vortexBaseSpeed, fallback.vortexBaseSpeed, 0, 1),
    vortexRangeSpeed: normalizeNumber(input.vortexRangeSpeed, fallback.vortexRangeSpeed, 0.2, 2),
    vortexBaseRadius: normalizeNumber(input.vortexBaseRadius, fallback.vortexBaseRadius, 0.5, 2.5),
    vortexRangeRadius: normalizeNumber(input.vortexRangeRadius, fallback.vortexRangeRadius, 0.5, 4),
    wavyWaveWidth: normalizeNumber(input.wavyWaveWidth, fallback.wavyWaveWidth, 10, 90),
    wavyBlur: normalizeNumber(input.wavyBlur, fallback.wavyBlur, 0, 20),
    wavySpeed: input.wavySpeed === "slow" || input.wavySpeed === "fast" ? input.wavySpeed : fallback.wavySpeed,
    wavyWaveOpacity: normalizeNumber(input.wavyWaveOpacity, fallback.wavyWaveOpacity, 0.15, 0.85),
    auroraBarsBarCount: normalizeInteger(input.auroraBarsBarCount, fallback.auroraBarsBarCount, 8, 80),
    auroraBarsSpeed: normalizeNumber(input.auroraBarsSpeed, fallback.auroraBarsSpeed, 0.08, 2),
    auroraBarsBlur: normalizeNumber(input.auroraBarsBlur, fallback.auroraBarsBlur, 0, 18),
    auroraBarsGap: normalizeNumber(input.auroraBarsGap, fallback.auroraBarsGap, 0, 16),
    auroraBarsMaxHeightRatio: normalizeNumber(input.auroraBarsMaxHeightRatio, fallback.auroraBarsMaxHeightRatio, 0.1, 1),
    auroraBarsMinHeightRatio: normalizeNumber(input.auroraBarsMinHeightRatio, fallback.auroraBarsMinHeightRatio, 0.04, 0.78),
    pixelLiquidPixelSize: normalizeNumber(input.pixelLiquidPixelSize, fallback.pixelLiquidPixelSize, 4, 18),
    pixelLiquidDetail: normalizeChoice(input.pixelLiquidDetail, fallback.pixelLiquidDetail, ["low", "medium", "high"]),
    pixelLiquidCursorForce: normalizeNumber(input.pixelLiquidCursorForce, fallback.pixelLiquidCursorForce, 0, 1),
    pixelLiquidCursorSize: normalizeNumber(input.pixelLiquidCursorSize, fallback.pixelLiquidCursorSize, 0.04, 0.24),
    pixelLiquidAutoDemo:
      typeof input.pixelLiquidAutoDemo === "boolean" ? input.pixelLiquidAutoDemo : fallback.pixelLiquidAutoDemo,
    pixelLiquidMotionSpeed: normalizeNumber(input.pixelLiquidMotionSpeed, fallback.pixelLiquidMotionSpeed, 0.2, 1.4),
    tileGridTileSize: normalizeNumber(input.tileGridTileSize, fallback.tileGridTileSize, 18, 120),
    tileGridJointSize: normalizeNumber(input.tileGridJointSize, fallback.tileGridJointSize, 1, 10),
    tileGridChangeFrequency: clampTileGridFadeSeconds(input.tileGridChangeFrequency, fallback.tileGridChangeFrequency),
    tileGridActivePercent: normalizeNumber(input.tileGridActivePercent, fallback.tileGridActivePercent, 1, 60),
    tileGridOpacity: normalizeNumber(input.tileGridOpacity, fallback.tileGridOpacity, 0.15, 1),
    hexGridHexSize: normalizeNumber(input.hexGridHexSize, fallback.hexGridHexSize, 18, 120),
    hexGridJointSize: normalizeNumber(input.hexGridJointSize, fallback.hexGridJointSize, 1, 10),
    hexGridChangeFrequency: clampTileGridFadeSeconds(input.hexGridChangeFrequency, fallback.hexGridChangeFrequency),
    hexGridActivePercent: normalizeNumber(input.hexGridActivePercent, fallback.hexGridActivePercent, 1, 60),
    hexGridOpacity: normalizeNumber(input.hexGridOpacity, fallback.hexGridOpacity, 0.15, 1),
  }

  const migratedSettings = omitLegacyBackgroundColorSettings(
    migrateLegacyCanvasRevealDotsDefaults(sanitizedSettings),
  )
  if (options.skipBackgroundVisualPreferences) {
    return migratedSettings
  }
  return {
    ...migratedSettings,
    backgroundVisualPreferences: normalizeChimerBackgroundVisualPreferences(
      input.backgroundVisualPreferences,
      options.backgroundPreferenceOptions,
    ),
  }
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
    canvasRevealDotsDotSize: DEFAULT_CHIMER_SETTINGS.canvasRevealDotsDotSize,
    canvasRevealDotsDotSpacing: DEFAULT_CHIMER_SETTINGS.canvasRevealDotsDotSpacing,
    canvasRevealDotsOpacity: DEFAULT_CHIMER_SETTINGS.canvasRevealDotsOpacity,
    canvasRevealDotsAnimationSpeed: DEFAULT_CHIMER_SETTINGS.canvasRevealDotsAnimationSpeed,
    canvasRevealDotsShowGradient: DEFAULT_CHIMER_SETTINGS.canvasRevealDotsShowGradient,
  }
}

export function sanitizeChimerSettingsForEntitlements(
  input = {},
  accessInput = /** @type {readonly string[] | {featureKeys?: readonly string[], ownedBackgroundIds?: readonly string[]}} */ ([]),
  options = {},
) {
  const settings = sanitizeChimerSettings(input, {
    backgroundPreferenceOptions: options.backgroundPreferenceOptions,
  })
  // Array input remains accepted for older callers while runtime code now
  // carries one authoritative feature-and-ownership access snapshot.
  const access = Array.isArray(accessInput)
    ? {
        featureKeys: accessInput,
        ownedBackgroundIds: Array.isArray(options.ownedBackgroundIds)
          ? options.ownedBackgroundIds
          : [],
      }
    : {
        featureKeys: Array.isArray(accessInput?.featureKeys) ? accessInput.featureKeys : [],
        ownedBackgroundIds: Array.isArray(accessInput?.ownedBackgroundIds)
          ? accessInput.ownedBackgroundIds
          : [],
      }
  const ownsSelectedBackground = access.ownedBackgroundIds.includes(settings.backgroundId)
  const canUsePremiumBackgrounds =
    hasPremiumBackgroundAccess(access.featureKeys) || ownsSelectedBackground
  const canUseCustomColors =
    hasFeature(access.featureKeys, FEATURE_KEYS.chimerCustomColors)
  // Clock stroke is a basic readability control; richer custom color, shadow,
  // and glow styling remains feature-gated below.
  // Signed-in accounts can keep the original Lamp clock/color trio; broader visual color controls stay feature-gated.
  const canUseAccountColorControls = canUseCustomColors || Boolean(options.canUseAccountColorControls)

  if (canUseCustomColors && canUsePremiumBackgrounds) {
    return settings
  }

  const sanitizedSettings = {
    ...settings,
    ...(!canUseCustomColors ? {
      primaryFontColor: DEFAULT_CHIMER_SETTINGS.primaryFontColor,
      secondaryFontColor: DEFAULT_CHIMER_SETTINGS.secondaryFontColor,
      clockFontFamily: DEFAULT_CHIMER_SETTINGS.clockFontFamily,
      clockShadowEnabled: DEFAULT_CHIMER_SETTINGS.clockShadowEnabled,
      clockShadowColor: DEFAULT_CHIMER_SETTINGS.clockShadowColor,
      clockShadowStrength: DEFAULT_CHIMER_SETTINGS.clockShadowStrength,
      clockShadowDirection: DEFAULT_CHIMER_SETTINGS.clockShadowDirection,
      clockShadowDistance: DEFAULT_CHIMER_SETTINGS.clockShadowDistance,
      clockShadowFeather: DEFAULT_CHIMER_SETTINGS.clockShadowFeather,
      clockGlowEnabled: DEFAULT_CHIMER_SETTINGS.clockGlowEnabled,
      clockGlowColor: DEFAULT_CHIMER_SETTINGS.clockGlowColor,
      clockGlowStrength: DEFAULT_CHIMER_SETTINGS.clockGlowStrength,
    } : {}),
    ...(!canUseAccountColorControls ? {
      clockModeFontColor: DEFAULT_CHIMER_SETTINGS.clockModeFontColor,
    } : {}),
    ...(!canUsePremiumBackgrounds ? {
      backgroundId: DEFAULT_CHIMER_SETTINGS.backgroundId,
      sparklesMaxSize: DEFAULT_CHIMER_SETTINGS.sparklesMaxSize,
      sparklesMinSize: DEFAULT_CHIMER_SETTINGS.sparklesMinSize,
      sparklesParticleDensity: DEFAULT_CHIMER_SETTINGS.sparklesParticleDensity,
      sparklesSpeed: DEFAULT_CHIMER_SETTINGS.sparklesSpeed,
      gradientAnimationSpeed: DEFAULT_CHIMER_SETTINGS.gradientAnimationSpeed,
      gradientAnimationSize: DEFAULT_CHIMER_SETTINGS.gradientAnimationSize,
      massageLabGradientOpacity: DEFAULT_CHIMER_SETTINGS.massageLabGradientOpacity,
      massageLabStarsSpeed: DEFAULT_CHIMER_SETTINGS.massageLabStarsSpeed,
      massageLabStarsDensity: DEFAULT_CHIMER_SETTINGS.massageLabStarsDensity,
      massageLabStarsParallax: DEFAULT_CHIMER_SETTINGS.massageLabStarsParallax,
      massageLabHoleLineCount: DEFAULT_CHIMER_SETTINGS.massageLabHoleLineCount,
      massageLabHoleDiscCount: DEFAULT_CHIMER_SETTINGS.massageLabHoleDiscCount,
      massageLabLightSpeedWarpSpeed: DEFAULT_CHIMER_SETTINGS.massageLabLightSpeedWarpSpeed,
      massageLabLightSpeedWarpSpeedVersion: DEFAULT_CHIMER_SETTINGS.massageLabLightSpeedWarpSpeedVersion,
      massageLabLightSpeedParticleCount: DEFAULT_CHIMER_SETTINGS.massageLabLightSpeedParticleCount,
      massageLabLightSpeedIntensity: DEFAULT_CHIMER_SETTINGS.massageLabLightSpeedIntensity,
      massageLabLightSpeedRadius: DEFAULT_CHIMER_SETTINGS.massageLabLightSpeedRadius,
      massageLabLightSpeedCylinderLength: DEFAULT_CHIMER_SETTINGS.massageLabLightSpeedCylinderLength,
      massageLabElectricMistSpeed: DEFAULT_CHIMER_SETTINGS.massageLabElectricMistSpeed,
      massageLabElectricMistControlVersion: DEFAULT_CHIMER_SETTINGS.massageLabElectricMistControlVersion,
      massageLabElectricMistDetail: DEFAULT_CHIMER_SETTINGS.massageLabElectricMistDetail,
      massageLabElectricMistDistortion: DEFAULT_CHIMER_SETTINGS.massageLabElectricMistDistortion,
      massageLabElectricMistBrightness: DEFAULT_CHIMER_SETTINGS.massageLabElectricMistBrightness,
      massageLabAstralFlowSpeed: DEFAULT_CHIMER_SETTINGS.massageLabAstralFlowSpeed,
      massageLabAstralFlowFlowMin: DEFAULT_CHIMER_SETTINGS.massageLabAstralFlowFlowMin,
      massageLabAstralFlowFlowMax: DEFAULT_CHIMER_SETTINGS.massageLabAstralFlowFlowMax,
      massageLabDeepSpaceNebulaSpeed: DEFAULT_CHIMER_SETTINGS.massageLabDeepSpaceNebulaSpeed,
      massageLabGridBloomSpeed: DEFAULT_CHIMER_SETTINGS.massageLabGridBloomSpeed,
      massageLabGridBloomGridScale: DEFAULT_CHIMER_SETTINGS.massageLabGridBloomGridScale,
      massageLabGridBloomRotationSpeed: DEFAULT_CHIMER_SETTINGS.massageLabGridBloomRotationSpeed,
      massageLabGridBloomFadeFalloff: DEFAULT_CHIMER_SETTINGS.massageLabGridBloomFadeFalloff,
      massageLabGridBloomDistortionAmount: DEFAULT_CHIMER_SETTINGS.massageLabGridBloomDistortionAmount,
      massageLabGridBloomFlowSpeedX: DEFAULT_CHIMER_SETTINGS.massageLabGridBloomFlowSpeedX,
      massageLabGridBloomFlowSpeedY: DEFAULT_CHIMER_SETTINGS.massageLabGridBloomFlowSpeedY,
      massageLabChromeFlowFlowSpeed: DEFAULT_CHIMER_SETTINGS.massageLabChromeFlowFlowSpeed,
      massageLabChromeFlowTimeScale: DEFAULT_CHIMER_SETTINGS.massageLabChromeFlowTimeScale,
      massageLabWaveCurrentSpeedX: DEFAULT_CHIMER_SETTINGS.massageLabWaveCurrentSpeedX,
      massageLabWaveCurrentSpeedY: DEFAULT_CHIMER_SETTINGS.massageLabWaveCurrentSpeedY,
      massageLabWaveCurrentAmplitude: DEFAULT_CHIMER_SETTINGS.massageLabWaveCurrentAmplitude,
      massageLabFerrofluidSpeed: DEFAULT_CHIMER_SETTINGS.massageLabFerrofluidSpeed,
      massageLabFerrofluidScale: DEFAULT_CHIMER_SETTINGS.massageLabFerrofluidScale,
      massageLabFerrofluidTurbulence: DEFAULT_CHIMER_SETTINGS.massageLabFerrofluidTurbulence,
      massageLabFerrofluidFluidity: DEFAULT_CHIMER_SETTINGS.massageLabFerrofluidFluidity,
      massageLabFerrofluidRimWidth: DEFAULT_CHIMER_SETTINGS.massageLabFerrofluidRimWidth,
      massageLabFerrofluidSharpness: DEFAULT_CHIMER_SETTINGS.massageLabFerrofluidSharpness,
      massageLabFerrofluidShimmer: DEFAULT_CHIMER_SETTINGS.massageLabFerrofluidShimmer,
      massageLabFerrofluidGlow: DEFAULT_CHIMER_SETTINGS.massageLabFerrofluidGlow,
      massageLabFerrofluidFlowDirection: DEFAULT_CHIMER_SETTINGS.massageLabFerrofluidFlowDirection,
      massageLabFerrofluidOpacity: DEFAULT_CHIMER_SETTINGS.massageLabFerrofluidOpacity,
      massageLabLightfallSpeed: DEFAULT_CHIMER_SETTINGS.massageLabLightfallSpeed,
      massageLabLightfallStreakCount: DEFAULT_CHIMER_SETTINGS.massageLabLightfallStreakCount,
      massageLabLightfallStreakWidth: DEFAULT_CHIMER_SETTINGS.massageLabLightfallStreakWidth,
      massageLabLightfallStreakLength: DEFAULT_CHIMER_SETTINGS.massageLabLightfallStreakLength,
      massageLabLightfallGlow: DEFAULT_CHIMER_SETTINGS.massageLabLightfallGlow,
      massageLabLightfallDensity: DEFAULT_CHIMER_SETTINGS.massageLabLightfallDensity,
      massageLabLightfallTwinkle: DEFAULT_CHIMER_SETTINGS.massageLabLightfallTwinkle,
      massageLabLightfallZoom: DEFAULT_CHIMER_SETTINGS.massageLabLightfallZoom,
      massageLabLightfallBackgroundGlow: DEFAULT_CHIMER_SETTINGS.massageLabLightfallBackgroundGlow,
      massageLabLightfallOpacity: DEFAULT_CHIMER_SETTINGS.massageLabLightfallOpacity,
      massageLabLightfallCursorEnabled: DEFAULT_CHIMER_SETTINGS.massageLabLightfallCursorEnabled,
      massageLabLightfallCursorStrength: DEFAULT_CHIMER_SETTINGS.massageLabLightfallCursorStrength,
      massageLabLightfallCursorRadius: DEFAULT_CHIMER_SETTINGS.massageLabLightfallCursorRadius,
      massageLabLightfallCursorDampening: DEFAULT_CHIMER_SETTINGS.massageLabLightfallCursorDampening,
      massageLabLiquidEtherCursorEnabled: DEFAULT_CHIMER_SETTINGS.massageLabLiquidEtherCursorEnabled,
      massageLabLiquidEtherMouseForce: DEFAULT_CHIMER_SETTINGS.massageLabLiquidEtherMouseForce,
      massageLabLiquidEtherCursorSize: DEFAULT_CHIMER_SETTINGS.massageLabLiquidEtherCursorSize,
      massageLabLiquidEtherIsViscous: DEFAULT_CHIMER_SETTINGS.massageLabLiquidEtherIsViscous,
      massageLabLiquidEtherViscous: DEFAULT_CHIMER_SETTINGS.massageLabLiquidEtherViscous,
      massageLabLiquidEtherIterationsViscous: DEFAULT_CHIMER_SETTINGS.massageLabLiquidEtherIterationsViscous,
      massageLabLiquidEtherIterationsPoisson: DEFAULT_CHIMER_SETTINGS.massageLabLiquidEtherIterationsPoisson,
      massageLabLiquidEtherDt: DEFAULT_CHIMER_SETTINGS.massageLabLiquidEtherDt,
      massageLabLiquidEtherBfecc: DEFAULT_CHIMER_SETTINGS.massageLabLiquidEtherBfecc,
      massageLabLiquidEtherResolution: DEFAULT_CHIMER_SETTINGS.massageLabLiquidEtherResolution,
      massageLabLiquidEtherIsBounce: DEFAULT_CHIMER_SETTINGS.massageLabLiquidEtherIsBounce,
      massageLabLiquidEtherAutoDemo: DEFAULT_CHIMER_SETTINGS.massageLabLiquidEtherAutoDemo,
      massageLabLiquidEtherAutoSpeed: DEFAULT_CHIMER_SETTINGS.massageLabLiquidEtherAutoSpeed,
      massageLabLiquidEtherAutoIntensity: DEFAULT_CHIMER_SETTINGS.massageLabLiquidEtherAutoIntensity,
      massageLabLiquidEtherAutoResumeDelay: DEFAULT_CHIMER_SETTINGS.massageLabLiquidEtherAutoResumeDelay,
      massageLabLiquidEtherAutoRampDuration: DEFAULT_CHIMER_SETTINGS.massageLabLiquidEtherAutoRampDuration,
      massageLabLiquidEtherOpacity: DEFAULT_CHIMER_SETTINGS.massageLabLiquidEtherOpacity,
      massageLabPrismHeight: DEFAULT_CHIMER_SETTINGS.massageLabPrismHeight,
      massageLabPrismBaseWidth: DEFAULT_CHIMER_SETTINGS.massageLabPrismBaseWidth,
      massageLabPrismAnimationType: DEFAULT_CHIMER_SETTINGS.massageLabPrismAnimationType,
      massageLabPrismGlow: DEFAULT_CHIMER_SETTINGS.massageLabPrismGlow,
      massageLabPrismOffsetX: DEFAULT_CHIMER_SETTINGS.massageLabPrismOffsetX,
      massageLabPrismOffsetY: DEFAULT_CHIMER_SETTINGS.massageLabPrismOffsetY,
      massageLabPrismNoise: DEFAULT_CHIMER_SETTINGS.massageLabPrismNoise,
      massageLabPrismTransparent: DEFAULT_CHIMER_SETTINGS.massageLabPrismTransparent,
      massageLabPrismScale: DEFAULT_CHIMER_SETTINGS.massageLabPrismScale,
      massageLabPrismHueShift: DEFAULT_CHIMER_SETTINGS.massageLabPrismHueShift,
      massageLabPrismColorFrequency: DEFAULT_CHIMER_SETTINGS.massageLabPrismColorFrequency,
      massageLabPrismHoverStrength: DEFAULT_CHIMER_SETTINGS.massageLabPrismHoverStrength,
      massageLabPrismInertia: DEFAULT_CHIMER_SETTINGS.massageLabPrismInertia,
      massageLabPrismBloom: DEFAULT_CHIMER_SETTINGS.massageLabPrismBloom,
      massageLabPrismTimeScale: DEFAULT_CHIMER_SETTINGS.massageLabPrismTimeScale,
      massageLabDarkVeilHueShift: DEFAULT_CHIMER_SETTINGS.massageLabDarkVeilHueShift,
      massageLabDarkVeilNoiseIntensity: DEFAULT_CHIMER_SETTINGS.massageLabDarkVeilNoiseIntensity,
      massageLabDarkVeilScanlineIntensity: DEFAULT_CHIMER_SETTINGS.massageLabDarkVeilScanlineIntensity,
      massageLabDarkVeilSpeed: DEFAULT_CHIMER_SETTINGS.massageLabDarkVeilSpeed,
      massageLabDarkVeilScanlineFrequency: DEFAULT_CHIMER_SETTINGS.massageLabDarkVeilScanlineFrequency,
      massageLabDarkVeilWarpAmount: DEFAULT_CHIMER_SETTINGS.massageLabDarkVeilWarpAmount,
      massageLabDarkVeilResolutionScale: DEFAULT_CHIMER_SETTINGS.massageLabDarkVeilResolutionScale,
      massageLabLightPillarIntensity: DEFAULT_CHIMER_SETTINGS.massageLabLightPillarIntensity,
      massageLabLightPillarRotationSpeed: DEFAULT_CHIMER_SETTINGS.massageLabLightPillarRotationSpeed,
      massageLabLightPillarInteractive: DEFAULT_CHIMER_SETTINGS.massageLabLightPillarInteractive,
      massageLabLightPillarGlowAmount: DEFAULT_CHIMER_SETTINGS.massageLabLightPillarGlowAmount,
      massageLabLightPillarWidth: DEFAULT_CHIMER_SETTINGS.massageLabLightPillarWidth,
      massageLabLightPillarHeight: DEFAULT_CHIMER_SETTINGS.massageLabLightPillarHeight,
      massageLabLightPillarNoiseIntensity: DEFAULT_CHIMER_SETTINGS.massageLabLightPillarNoiseIntensity,
      massageLabLightPillarBlendMode: DEFAULT_CHIMER_SETTINGS.massageLabLightPillarBlendMode,
      massageLabLightPillarRotation: DEFAULT_CHIMER_SETTINGS.massageLabLightPillarRotation,
      massageLabLightPillarQuality: DEFAULT_CHIMER_SETTINGS.massageLabLightPillarQuality,
      massageLabSilkSpeed: DEFAULT_CHIMER_SETTINGS.massageLabSilkSpeed,
      massageLabSilkScale: DEFAULT_CHIMER_SETTINGS.massageLabSilkScale,
      massageLabSilkNoiseIntensity: DEFAULT_CHIMER_SETTINGS.massageLabSilkNoiseIntensity,
      massageLabSilkRotation: DEFAULT_CHIMER_SETTINGS.massageLabSilkRotation,
      massageLabFloatingLinesEnableTop: DEFAULT_CHIMER_SETTINGS.massageLabFloatingLinesEnableTop,
      massageLabFloatingLinesEnableMiddle: DEFAULT_CHIMER_SETTINGS.massageLabFloatingLinesEnableMiddle,
      massageLabFloatingLinesEnableBottom: DEFAULT_CHIMER_SETTINGS.massageLabFloatingLinesEnableBottom,
      massageLabFloatingLinesTopLineCount: DEFAULT_CHIMER_SETTINGS.massageLabFloatingLinesTopLineCount,
      massageLabFloatingLinesMiddleLineCount: DEFAULT_CHIMER_SETTINGS.massageLabFloatingLinesMiddleLineCount,
      massageLabFloatingLinesBottomLineCount: DEFAULT_CHIMER_SETTINGS.massageLabFloatingLinesBottomLineCount,
      massageLabFloatingLinesTopLineDistance: DEFAULT_CHIMER_SETTINGS.massageLabFloatingLinesTopLineDistance,
      massageLabFloatingLinesMiddleLineDistance: DEFAULT_CHIMER_SETTINGS.massageLabFloatingLinesMiddleLineDistance,
      massageLabFloatingLinesBottomLineDistance: DEFAULT_CHIMER_SETTINGS.massageLabFloatingLinesBottomLineDistance,
      massageLabFloatingLinesTopWaveX: DEFAULT_CHIMER_SETTINGS.massageLabFloatingLinesTopWaveX,
      massageLabFloatingLinesTopWaveY: DEFAULT_CHIMER_SETTINGS.massageLabFloatingLinesTopWaveY,
      massageLabFloatingLinesTopWaveRotate: DEFAULT_CHIMER_SETTINGS.massageLabFloatingLinesTopWaveRotate,
      massageLabFloatingLinesMiddleWaveX: DEFAULT_CHIMER_SETTINGS.massageLabFloatingLinesMiddleWaveX,
      massageLabFloatingLinesMiddleWaveY: DEFAULT_CHIMER_SETTINGS.massageLabFloatingLinesMiddleWaveY,
      massageLabFloatingLinesMiddleWaveRotate: DEFAULT_CHIMER_SETTINGS.massageLabFloatingLinesMiddleWaveRotate,
      massageLabFloatingLinesBottomWaveX: DEFAULT_CHIMER_SETTINGS.massageLabFloatingLinesBottomWaveX,
      massageLabFloatingLinesBottomWaveY: DEFAULT_CHIMER_SETTINGS.massageLabFloatingLinesBottomWaveY,
      massageLabFloatingLinesBottomWaveRotate: DEFAULT_CHIMER_SETTINGS.massageLabFloatingLinesBottomWaveRotate,
      massageLabFloatingLinesAnimationSpeed: DEFAULT_CHIMER_SETTINGS.massageLabFloatingLinesAnimationSpeed,
      massageLabFloatingLinesInteractive: DEFAULT_CHIMER_SETTINGS.massageLabFloatingLinesInteractive,
      massageLabFloatingLinesBendRadius: DEFAULT_CHIMER_SETTINGS.massageLabFloatingLinesBendRadius,
      massageLabFloatingLinesBendStrength: DEFAULT_CHIMER_SETTINGS.massageLabFloatingLinesBendStrength,
      massageLabFloatingLinesMouseDamping: DEFAULT_CHIMER_SETTINGS.massageLabFloatingLinesMouseDamping,
      massageLabFloatingLinesParallax: DEFAULT_CHIMER_SETTINGS.massageLabFloatingLinesParallax,
      massageLabFloatingLinesParallaxStrength: DEFAULT_CHIMER_SETTINGS.massageLabFloatingLinesParallaxStrength,
      massageLabFloatingLinesBlendMode: DEFAULT_CHIMER_SETTINGS.massageLabFloatingLinesBlendMode,
      massageLabSideRaysSpeed: DEFAULT_CHIMER_SETTINGS.massageLabSideRaysSpeed,
      massageLabSideRaysIntensity: DEFAULT_CHIMER_SETTINGS.massageLabSideRaysIntensity,
      massageLabSideRaysSpread: DEFAULT_CHIMER_SETTINGS.massageLabSideRaysSpread,
      massageLabSideRaysOrigin: DEFAULT_CHIMER_SETTINGS.massageLabSideRaysOrigin,
      massageLabSideRaysTilt: DEFAULT_CHIMER_SETTINGS.massageLabSideRaysTilt,
      massageLabSideRaysSaturation: DEFAULT_CHIMER_SETTINGS.massageLabSideRaysSaturation,
      massageLabSideRaysBlend: DEFAULT_CHIMER_SETTINGS.massageLabSideRaysBlend,
      massageLabSideRaysFalloff: DEFAULT_CHIMER_SETTINGS.massageLabSideRaysFalloff,
      massageLabSideRaysOpacity: DEFAULT_CHIMER_SETTINGS.massageLabSideRaysOpacity,
      massageLabLightRaysOrigin: DEFAULT_CHIMER_SETTINGS.massageLabLightRaysOrigin,
      massageLabLightRaysSpeed: DEFAULT_CHIMER_SETTINGS.massageLabLightRaysSpeed,
      massageLabLightRaysSpread: DEFAULT_CHIMER_SETTINGS.massageLabLightRaysSpread,
      massageLabLightRaysLength: DEFAULT_CHIMER_SETTINGS.massageLabLightRaysLength,
      massageLabLightRaysPulsating: DEFAULT_CHIMER_SETTINGS.massageLabLightRaysPulsating,
      massageLabLightRaysFadeDistance: DEFAULT_CHIMER_SETTINGS.massageLabLightRaysFadeDistance,
      massageLabLightRaysSaturation: DEFAULT_CHIMER_SETTINGS.massageLabLightRaysSaturation,
      massageLabLightRaysFollowMouse: DEFAULT_CHIMER_SETTINGS.massageLabLightRaysFollowMouse,
      massageLabLightRaysMouseInfluence: DEFAULT_CHIMER_SETTINGS.massageLabLightRaysMouseInfluence,
      massageLabLightRaysNoiseAmount: DEFAULT_CHIMER_SETTINGS.massageLabLightRaysNoiseAmount,
      massageLabLightRaysDistortion: DEFAULT_CHIMER_SETTINGS.massageLabLightRaysDistortion,
      massageLabPixelBlastVariant: DEFAULT_CHIMER_SETTINGS.massageLabPixelBlastVariant,
      massageLabPixelBlastPixelSize: DEFAULT_CHIMER_SETTINGS.massageLabPixelBlastPixelSize,
      massageLabPixelBlastAntialias: DEFAULT_CHIMER_SETTINGS.massageLabPixelBlastAntialias,
      massageLabPixelBlastPatternScale: DEFAULT_CHIMER_SETTINGS.massageLabPixelBlastPatternScale,
      massageLabPixelBlastPatternDensity: DEFAULT_CHIMER_SETTINGS.massageLabPixelBlastPatternDensity,
      massageLabPixelBlastLiquid: DEFAULT_CHIMER_SETTINGS.massageLabPixelBlastLiquid,
      massageLabPixelBlastLiquidStrength: DEFAULT_CHIMER_SETTINGS.massageLabPixelBlastLiquidStrength,
      massageLabPixelBlastLiquidRadius: DEFAULT_CHIMER_SETTINGS.massageLabPixelBlastLiquidRadius,
      massageLabPixelBlastPixelSizeJitter: DEFAULT_CHIMER_SETTINGS.massageLabPixelBlastPixelSizeJitter,
      massageLabPixelBlastEnableRipples: DEFAULT_CHIMER_SETTINGS.massageLabPixelBlastEnableRipples,
      massageLabPixelBlastRippleIntensityScale: DEFAULT_CHIMER_SETTINGS.massageLabPixelBlastRippleIntensityScale,
      massageLabPixelBlastRippleThickness: DEFAULT_CHIMER_SETTINGS.massageLabPixelBlastRippleThickness,
      massageLabPixelBlastRippleSpeed: DEFAULT_CHIMER_SETTINGS.massageLabPixelBlastRippleSpeed,
      massageLabPixelBlastLiquidWobbleSpeed: DEFAULT_CHIMER_SETTINGS.massageLabPixelBlastLiquidWobbleSpeed,
      massageLabPixelBlastAutoPauseOffscreen: DEFAULT_CHIMER_SETTINGS.massageLabPixelBlastAutoPauseOffscreen,
      massageLabPixelBlastSpeed: DEFAULT_CHIMER_SETTINGS.massageLabPixelBlastSpeed,
      massageLabPixelBlastTransparent: DEFAULT_CHIMER_SETTINGS.massageLabPixelBlastTransparent,
      massageLabPixelBlastEdgeFade: DEFAULT_CHIMER_SETTINGS.massageLabPixelBlastEdgeFade,
      massageLabPixelBlastNoiseAmount: DEFAULT_CHIMER_SETTINGS.massageLabPixelBlastNoiseAmount,
      massageLabColorBendsRotation: DEFAULT_CHIMER_SETTINGS.massageLabColorBendsRotation,
      massageLabColorBendsSpeed: DEFAULT_CHIMER_SETTINGS.massageLabColorBendsSpeed,
      massageLabColorBendsTransparent: DEFAULT_CHIMER_SETTINGS.massageLabColorBendsTransparent,
      massageLabColorBendsAutoRotate: DEFAULT_CHIMER_SETTINGS.massageLabColorBendsAutoRotate,
      massageLabColorBendsScale: DEFAULT_CHIMER_SETTINGS.massageLabColorBendsScale,
      massageLabColorBendsFrequency: DEFAULT_CHIMER_SETTINGS.massageLabColorBendsFrequency,
      massageLabColorBendsWarpStrength: DEFAULT_CHIMER_SETTINGS.massageLabColorBendsWarpStrength,
      massageLabColorBendsInteractive: DEFAULT_CHIMER_SETTINGS.massageLabColorBendsInteractive,
      massageLabColorBendsMouseInfluence: DEFAULT_CHIMER_SETTINGS.massageLabColorBendsMouseInfluence,
      massageLabColorBendsParallax: DEFAULT_CHIMER_SETTINGS.massageLabColorBendsParallax,
      massageLabColorBendsNoise: DEFAULT_CHIMER_SETTINGS.massageLabColorBendsNoise,
      massageLabColorBendsIterations: DEFAULT_CHIMER_SETTINGS.massageLabColorBendsIterations,
      massageLabColorBendsIntensity: DEFAULT_CHIMER_SETTINGS.massageLabColorBendsIntensity,
      massageLabColorBendsBandWidth: DEFAULT_CHIMER_SETTINGS.massageLabColorBendsBandWidth,
      massageLabEvilEyeIntensity: DEFAULT_CHIMER_SETTINGS.massageLabEvilEyeIntensity,
      massageLabEvilEyePupilSize: DEFAULT_CHIMER_SETTINGS.massageLabEvilEyePupilSize,
      massageLabEvilEyeIrisWidth: DEFAULT_CHIMER_SETTINGS.massageLabEvilEyeIrisWidth,
      massageLabEvilEyeGlowIntensity: DEFAULT_CHIMER_SETTINGS.massageLabEvilEyeGlowIntensity,
      massageLabEvilEyeScale: DEFAULT_CHIMER_SETTINGS.massageLabEvilEyeScale,
      massageLabEvilEyeNoiseScale: DEFAULT_CHIMER_SETTINGS.massageLabEvilEyeNoiseScale,
      massageLabEvilEyePupilFollow: DEFAULT_CHIMER_SETTINGS.massageLabEvilEyePupilFollow,
      massageLabEvilEyeFlameSpeed: DEFAULT_CHIMER_SETTINGS.massageLabEvilEyeFlameSpeed,
      massageLabEvilEyeInteractive: DEFAULT_CHIMER_SETTINGS.massageLabEvilEyeInteractive,
      massageLabLineWavesSpeed: DEFAULT_CHIMER_SETTINGS.massageLabLineWavesSpeed,
      massageLabLineWavesInnerLineCount: DEFAULT_CHIMER_SETTINGS.massageLabLineWavesInnerLineCount,
      massageLabLineWavesOuterLineCount: DEFAULT_CHIMER_SETTINGS.massageLabLineWavesOuterLineCount,
      massageLabLineWavesWarpIntensity: DEFAULT_CHIMER_SETTINGS.massageLabLineWavesWarpIntensity,
      massageLabLineWavesRotation: DEFAULT_CHIMER_SETTINGS.massageLabLineWavesRotation,
      massageLabLineWavesEdgeFadeWidth: DEFAULT_CHIMER_SETTINGS.massageLabLineWavesEdgeFadeWidth,
      massageLabLineWavesColorCycleSpeed: DEFAULT_CHIMER_SETTINGS.massageLabLineWavesColorCycleSpeed,
      massageLabLineWavesBrightness: DEFAULT_CHIMER_SETTINGS.massageLabLineWavesBrightness,
      massageLabLineWavesEnableMouseInteraction: DEFAULT_CHIMER_SETTINGS.massageLabLineWavesEnableMouseInteraction,
      massageLabLineWavesMouseInfluence: DEFAULT_CHIMER_SETTINGS.massageLabLineWavesMouseInfluence,
      massageLabRadarSpeed: DEFAULT_CHIMER_SETTINGS.massageLabRadarSpeed,
      massageLabRadarScale: DEFAULT_CHIMER_SETTINGS.massageLabRadarScale,
      massageLabRadarRingCount: DEFAULT_CHIMER_SETTINGS.massageLabRadarRingCount,
      massageLabRadarSpokeCount: DEFAULT_CHIMER_SETTINGS.massageLabRadarSpokeCount,
      massageLabRadarRingThickness: DEFAULT_CHIMER_SETTINGS.massageLabRadarRingThickness,
      massageLabRadarSpokeThickness: DEFAULT_CHIMER_SETTINGS.massageLabRadarSpokeThickness,
      massageLabRadarSweepSpeed: DEFAULT_CHIMER_SETTINGS.massageLabRadarSweepSpeed,
      massageLabRadarSweepWidth: DEFAULT_CHIMER_SETTINGS.massageLabRadarSweepWidth,
      massageLabRadarSweepLobes: DEFAULT_CHIMER_SETTINGS.massageLabRadarSweepLobes,
      massageLabRadarFalloff: DEFAULT_CHIMER_SETTINGS.massageLabRadarFalloff,
      massageLabRadarBrightness: DEFAULT_CHIMER_SETTINGS.massageLabRadarBrightness,
      massageLabRadarEnableMouseInteraction: DEFAULT_CHIMER_SETTINGS.massageLabRadarEnableMouseInteraction,
      massageLabRadarMouseInfluence: DEFAULT_CHIMER_SETTINGS.massageLabRadarMouseInfluence,
      massageLabSoftAuroraSpeed: DEFAULT_CHIMER_SETTINGS.massageLabSoftAuroraSpeed,
      massageLabSoftAuroraScale: DEFAULT_CHIMER_SETTINGS.massageLabSoftAuroraScale,
      massageLabSoftAuroraBrightness: DEFAULT_CHIMER_SETTINGS.massageLabSoftAuroraBrightness,
      massageLabSoftAuroraNoiseFrequency: DEFAULT_CHIMER_SETTINGS.massageLabSoftAuroraNoiseFrequency,
      massageLabSoftAuroraNoiseAmplitude: DEFAULT_CHIMER_SETTINGS.massageLabSoftAuroraNoiseAmplitude,
      massageLabSoftAuroraBandHeight: DEFAULT_CHIMER_SETTINGS.massageLabSoftAuroraBandHeight,
      massageLabSoftAuroraBandSpread: DEFAULT_CHIMER_SETTINGS.massageLabSoftAuroraBandSpread,
      massageLabSoftAuroraOctaveDecay: DEFAULT_CHIMER_SETTINGS.massageLabSoftAuroraOctaveDecay,
      massageLabSoftAuroraLayerOffset: DEFAULT_CHIMER_SETTINGS.massageLabSoftAuroraLayerOffset,
      massageLabSoftAuroraColorSpeed: DEFAULT_CHIMER_SETTINGS.massageLabSoftAuroraColorSpeed,
      massageLabSoftAuroraEnableMouseInteraction: DEFAULT_CHIMER_SETTINGS.massageLabSoftAuroraEnableMouseInteraction,
      massageLabSoftAuroraMouseInfluence: DEFAULT_CHIMER_SETTINGS.massageLabSoftAuroraMouseInfluence,
      massageLabPlasmaSpeed: DEFAULT_CHIMER_SETTINGS.massageLabPlasmaSpeed,
      massageLabPlasmaDirection: DEFAULT_CHIMER_SETTINGS.massageLabPlasmaDirection,
      massageLabPlasmaScale: DEFAULT_CHIMER_SETTINGS.massageLabPlasmaScale,
      massageLabPlasmaOpacity: DEFAULT_CHIMER_SETTINGS.massageLabPlasmaOpacity,
      massageLabPlasmaMouseInteractive: DEFAULT_CHIMER_SETTINGS.massageLabPlasmaMouseInteractive,
      massageLabPlasmaWaveXOffset: DEFAULT_CHIMER_SETTINGS.massageLabPlasmaWaveXOffset,
      massageLabPlasmaWaveYOffset: DEFAULT_CHIMER_SETTINGS.massageLabPlasmaWaveYOffset,
      massageLabPlasmaWaveRotationDeg: DEFAULT_CHIMER_SETTINGS.massageLabPlasmaWaveRotationDeg,
      massageLabPlasmaWaveFocalLength: DEFAULT_CHIMER_SETTINGS.massageLabPlasmaWaveFocalLength,
      massageLabPlasmaWaveSpeedOne: DEFAULT_CHIMER_SETTINGS.massageLabPlasmaWaveSpeedOne,
      massageLabPlasmaWaveSpeedTwo: DEFAULT_CHIMER_SETTINGS.massageLabPlasmaWaveSpeedTwo,
      massageLabPlasmaWaveDirectionTwo: DEFAULT_CHIMER_SETTINGS.massageLabPlasmaWaveDirectionTwo,
      massageLabPlasmaWaveBendOne: DEFAULT_CHIMER_SETTINGS.massageLabPlasmaWaveBendOne,
      massageLabPlasmaWaveBendTwo: DEFAULT_CHIMER_SETTINGS.massageLabPlasmaWaveBendTwo,
      massageLabParticlesCount: DEFAULT_CHIMER_SETTINGS.massageLabParticlesCount,
      massageLabParticlesSpread: DEFAULT_CHIMER_SETTINGS.massageLabParticlesSpread,
      massageLabParticlesSpeed: DEFAULT_CHIMER_SETTINGS.massageLabParticlesSpeed,
      massageLabParticlesMoveOnHover: DEFAULT_CHIMER_SETTINGS.massageLabParticlesMoveOnHover,
      massageLabParticlesHoverFactor: DEFAULT_CHIMER_SETTINGS.massageLabParticlesHoverFactor,
      massageLabParticlesAlpha: DEFAULT_CHIMER_SETTINGS.massageLabParticlesAlpha,
      massageLabParticlesBaseSize: DEFAULT_CHIMER_SETTINGS.massageLabParticlesBaseSize,
      massageLabParticlesSizeRandomness: DEFAULT_CHIMER_SETTINGS.massageLabParticlesSizeRandomness,
      massageLabParticlesCameraDistance: DEFAULT_CHIMER_SETTINGS.massageLabParticlesCameraDistance,
      massageLabParticlesDisableRotation: DEFAULT_CHIMER_SETTINGS.massageLabParticlesDisableRotation,
      massageLabParticlesPixelRatio: DEFAULT_CHIMER_SETTINGS.massageLabParticlesPixelRatio,
      massageLabGradientBlindsAngle: DEFAULT_CHIMER_SETTINGS.massageLabGradientBlindsAngle,
      massageLabGradientBlindsNoise: DEFAULT_CHIMER_SETTINGS.massageLabGradientBlindsNoise,
      massageLabGradientBlindsBlindCount: DEFAULT_CHIMER_SETTINGS.massageLabGradientBlindsBlindCount,
      massageLabGradientBlindsBlindMinWidth: DEFAULT_CHIMER_SETTINGS.massageLabGradientBlindsBlindMinWidth,
      massageLabGradientBlindsMouseDampening: DEFAULT_CHIMER_SETTINGS.massageLabGradientBlindsMouseDampening,
      massageLabGradientBlindsMirror: DEFAULT_CHIMER_SETTINGS.massageLabGradientBlindsMirror,
      massageLabGradientBlindsSpotlightRadius: DEFAULT_CHIMER_SETTINGS.massageLabGradientBlindsSpotlightRadius,
      massageLabGradientBlindsSpotlightSoftness: DEFAULT_CHIMER_SETTINGS.massageLabGradientBlindsSpotlightSoftness,
      massageLabGradientBlindsSpotlightOpacity: DEFAULT_CHIMER_SETTINGS.massageLabGradientBlindsSpotlightOpacity,
      massageLabGradientBlindsDistort: DEFAULT_CHIMER_SETTINGS.massageLabGradientBlindsDistort,
      massageLabGradientBlindsShineDirection: DEFAULT_CHIMER_SETTINGS.massageLabGradientBlindsShineDirection,
      massageLabGradientBlindsBlendMode: DEFAULT_CHIMER_SETTINGS.massageLabGradientBlindsBlendMode,
      massageLabGradientBlindsDpr: DEFAULT_CHIMER_SETTINGS.massageLabGradientBlindsDpr,
      massageLabGradientBlindsEnableMouseInteraction: DEFAULT_CHIMER_SETTINGS.massageLabGradientBlindsEnableMouseInteraction,
      massageLabGrainientTimeSpeed: DEFAULT_CHIMER_SETTINGS.massageLabGrainientTimeSpeed,
      massageLabGrainientColorBalance: DEFAULT_CHIMER_SETTINGS.massageLabGrainientColorBalance,
      massageLabGrainientWarpStrength: DEFAULT_CHIMER_SETTINGS.massageLabGrainientWarpStrength,
      massageLabGrainientWarpFrequency: DEFAULT_CHIMER_SETTINGS.massageLabGrainientWarpFrequency,
      massageLabGrainientWarpSpeed: DEFAULT_CHIMER_SETTINGS.massageLabGrainientWarpSpeed,
      massageLabGrainientWarpAmplitude: DEFAULT_CHIMER_SETTINGS.massageLabGrainientWarpAmplitude,
      massageLabGrainientBlendAngle: DEFAULT_CHIMER_SETTINGS.massageLabGrainientBlendAngle,
      massageLabGrainientBlendSoftness: DEFAULT_CHIMER_SETTINGS.massageLabGrainientBlendSoftness,
      massageLabGrainientRotationAmount: DEFAULT_CHIMER_SETTINGS.massageLabGrainientRotationAmount,
      massageLabGrainientNoiseScale: DEFAULT_CHIMER_SETTINGS.massageLabGrainientNoiseScale,
      massageLabGrainientGrainAmount: DEFAULT_CHIMER_SETTINGS.massageLabGrainientGrainAmount,
      massageLabGrainientGrainScale: DEFAULT_CHIMER_SETTINGS.massageLabGrainientGrainScale,
      massageLabGrainientGrainAnimated: DEFAULT_CHIMER_SETTINGS.massageLabGrainientGrainAnimated,
      massageLabGrainientContrast: DEFAULT_CHIMER_SETTINGS.massageLabGrainientContrast,
      massageLabGrainientGamma: DEFAULT_CHIMER_SETTINGS.massageLabGrainientGamma,
      massageLabGrainientSaturation: DEFAULT_CHIMER_SETTINGS.massageLabGrainientSaturation,
      massageLabGrainientCenterX: DEFAULT_CHIMER_SETTINGS.massageLabGrainientCenterX,
      massageLabGrainientCenterY: DEFAULT_CHIMER_SETTINGS.massageLabGrainientCenterY,
      massageLabGrainientZoom: DEFAULT_CHIMER_SETTINGS.massageLabGrainientZoom,
      massageLabGridScanSensitivity: DEFAULT_CHIMER_SETTINGS.massageLabGridScanSensitivity,
      massageLabGridScanLineThickness: DEFAULT_CHIMER_SETTINGS.massageLabGridScanLineThickness,
      massageLabGridScanScanOpacity: DEFAULT_CHIMER_SETTINGS.massageLabGridScanScanOpacity,
      massageLabGridScanGridScale: DEFAULT_CHIMER_SETTINGS.massageLabGridScanGridScale,
      massageLabGridScanLineStyle: DEFAULT_CHIMER_SETTINGS.massageLabGridScanLineStyle,
      massageLabGridScanLineJitter: DEFAULT_CHIMER_SETTINGS.massageLabGridScanLineJitter,
      massageLabGridScanDirection: DEFAULT_CHIMER_SETTINGS.massageLabGridScanDirection,
      massageLabGridScanNoiseIntensity: DEFAULT_CHIMER_SETTINGS.massageLabGridScanNoiseIntensity,
      massageLabGridScanBloomOpacity: DEFAULT_CHIMER_SETTINGS.massageLabGridScanBloomOpacity,
      massageLabGridScanScanGlow: DEFAULT_CHIMER_SETTINGS.massageLabGridScanScanGlow,
      massageLabGridScanScanSoftness: DEFAULT_CHIMER_SETTINGS.massageLabGridScanScanSoftness,
      massageLabGridScanPhaseTaper: DEFAULT_CHIMER_SETTINGS.massageLabGridScanPhaseTaper,
      massageLabGridScanScanDuration: DEFAULT_CHIMER_SETTINGS.massageLabGridScanScanDuration,
      massageLabGridScanScanDelay: DEFAULT_CHIMER_SETTINGS.massageLabGridScanScanDelay,
      massageLabGridScanEnablePointerInteraction: DEFAULT_CHIMER_SETTINGS.massageLabGridScanEnablePointerInteraction,
      massageLabGridScanScanOnClick: DEFAULT_CHIMER_SETTINGS.massageLabGridScanScanOnClick,
      massageLabBeamsBeamWidth: DEFAULT_CHIMER_SETTINGS.massageLabBeamsBeamWidth,
      massageLabBeamsBeamHeight: DEFAULT_CHIMER_SETTINGS.massageLabBeamsBeamHeight,
      massageLabBeamsBeamNumber: DEFAULT_CHIMER_SETTINGS.massageLabBeamsBeamNumber,
      massageLabBeamsSpeed: DEFAULT_CHIMER_SETTINGS.massageLabBeamsSpeed,
      massageLabBeamsNoiseIntensity: DEFAULT_CHIMER_SETTINGS.massageLabBeamsNoiseIntensity,
      massageLabBeamsScale: DEFAULT_CHIMER_SETTINGS.massageLabBeamsScale,
      massageLabBeamsRotation: DEFAULT_CHIMER_SETTINGS.massageLabBeamsRotation,
      massageLabPixelSnowFlakeSize: DEFAULT_CHIMER_SETTINGS.massageLabPixelSnowFlakeSize,
      massageLabPixelSnowMinFlakeSize: DEFAULT_CHIMER_SETTINGS.massageLabPixelSnowMinFlakeSize,
      massageLabPixelSnowPixelResolution: DEFAULT_CHIMER_SETTINGS.massageLabPixelSnowPixelResolution,
      massageLabPixelSnowSpeed: DEFAULT_CHIMER_SETTINGS.massageLabPixelSnowSpeed,
      massageLabPixelSnowDepthFade: DEFAULT_CHIMER_SETTINGS.massageLabPixelSnowDepthFade,
      massageLabPixelSnowFarPlane: DEFAULT_CHIMER_SETTINGS.massageLabPixelSnowFarPlane,
      massageLabPixelSnowBrightness: DEFAULT_CHIMER_SETTINGS.massageLabPixelSnowBrightness,
      massageLabPixelSnowGamma: DEFAULT_CHIMER_SETTINGS.massageLabPixelSnowGamma,
      massageLabPixelSnowDensity: DEFAULT_CHIMER_SETTINGS.massageLabPixelSnowDensity,
      massageLabPixelSnowVariant: DEFAULT_CHIMER_SETTINGS.massageLabPixelSnowVariant,
      massageLabPixelSnowDirection: DEFAULT_CHIMER_SETTINGS.massageLabPixelSnowDirection,
      massageLabLightningXOffset: DEFAULT_CHIMER_SETTINGS.massageLabLightningXOffset,
      massageLabLightningSpeed: DEFAULT_CHIMER_SETTINGS.massageLabLightningSpeed,
      massageLabLightningIntensity: DEFAULT_CHIMER_SETTINGS.massageLabLightningIntensity,
      massageLabLightningSize: DEFAULT_CHIMER_SETTINGS.massageLabLightningSize,
      massageLabPrismaticBurstIntensity: DEFAULT_CHIMER_SETTINGS.massageLabPrismaticBurstIntensity,
      massageLabPrismaticBurstSpeed: DEFAULT_CHIMER_SETTINGS.massageLabPrismaticBurstSpeed,
      massageLabPrismaticBurstAnimationType: DEFAULT_CHIMER_SETTINGS.massageLabPrismaticBurstAnimationType,
      massageLabPrismaticBurstDistort: DEFAULT_CHIMER_SETTINGS.massageLabPrismaticBurstDistort,
      massageLabPrismaticBurstOffsetX: DEFAULT_CHIMER_SETTINGS.massageLabPrismaticBurstOffsetX,
      massageLabPrismaticBurstOffsetY: DEFAULT_CHIMER_SETTINGS.massageLabPrismaticBurstOffsetY,
      massageLabPrismaticBurstHoverDampness: DEFAULT_CHIMER_SETTINGS.massageLabPrismaticBurstHoverDampness,
      massageLabPrismaticBurstRayCount: DEFAULT_CHIMER_SETTINGS.massageLabPrismaticBurstRayCount,
      massageLabPrismaticBurstMixBlendMode: DEFAULT_CHIMER_SETTINGS.massageLabPrismaticBurstMixBlendMode,
      massageLabGalaxyHueShift: DEFAULT_CHIMER_SETTINGS.massageLabGalaxyHueShift,
      massageLabGalaxyFocalX: DEFAULT_CHIMER_SETTINGS.massageLabGalaxyFocalX,
      massageLabGalaxyFocalY: DEFAULT_CHIMER_SETTINGS.massageLabGalaxyFocalY,
      massageLabGalaxyRotationDeg: DEFAULT_CHIMER_SETTINGS.massageLabGalaxyRotationDeg,
      massageLabGalaxyStarSpeed: DEFAULT_CHIMER_SETTINGS.massageLabGalaxyStarSpeed,
      massageLabGalaxyDensity: DEFAULT_CHIMER_SETTINGS.massageLabGalaxyDensity,
      massageLabGalaxySpeed: DEFAULT_CHIMER_SETTINGS.massageLabGalaxySpeed,
      massageLabGalaxyMouseInteraction: DEFAULT_CHIMER_SETTINGS.massageLabGalaxyMouseInteraction,
      massageLabGalaxyGlowIntensity: DEFAULT_CHIMER_SETTINGS.massageLabGalaxyGlowIntensity,
      massageLabGalaxySaturation: DEFAULT_CHIMER_SETTINGS.massageLabGalaxySaturation,
      massageLabGalaxyMouseRepulsion: DEFAULT_CHIMER_SETTINGS.massageLabGalaxyMouseRepulsion,
      massageLabGalaxyRepulsionStrength: DEFAULT_CHIMER_SETTINGS.massageLabGalaxyRepulsionStrength,
      massageLabGalaxyTwinkleIntensity: DEFAULT_CHIMER_SETTINGS.massageLabGalaxyTwinkleIntensity,
      massageLabGalaxyRotationSpeed: DEFAULT_CHIMER_SETTINGS.massageLabGalaxyRotationSpeed,
      massageLabGalaxyAutoCenterRepulsion: DEFAULT_CHIMER_SETTINGS.massageLabGalaxyAutoCenterRepulsion,
      massageLabGalaxyTransparent: DEFAULT_CHIMER_SETTINGS.massageLabGalaxyTransparent,
      massageLabDitherWaveSpeed: DEFAULT_CHIMER_SETTINGS.massageLabDitherWaveSpeed,
      massageLabDitherWaveFrequency: DEFAULT_CHIMER_SETTINGS.massageLabDitherWaveFrequency,
      massageLabDitherWaveAmplitude: DEFAULT_CHIMER_SETTINGS.massageLabDitherWaveAmplitude,
      massageLabDitherColorNum: DEFAULT_CHIMER_SETTINGS.massageLabDitherColorNum,
      massageLabDitherPixelSize: DEFAULT_CHIMER_SETTINGS.massageLabDitherPixelSize,
      massageLabDitherMouseInteraction: DEFAULT_CHIMER_SETTINGS.massageLabDitherMouseInteraction,
      massageLabDitherMouseRadius: DEFAULT_CHIMER_SETTINGS.massageLabDitherMouseRadius,
      massageLabFaultyTerminalScale: DEFAULT_CHIMER_SETTINGS.massageLabFaultyTerminalScale,
      massageLabFaultyTerminalGridMulX: DEFAULT_CHIMER_SETTINGS.massageLabFaultyTerminalGridMulX,
      massageLabFaultyTerminalGridMulY: DEFAULT_CHIMER_SETTINGS.massageLabFaultyTerminalGridMulY,
      massageLabFaultyTerminalDigitSize: DEFAULT_CHIMER_SETTINGS.massageLabFaultyTerminalDigitSize,
      massageLabFaultyTerminalTimeScale: DEFAULT_CHIMER_SETTINGS.massageLabFaultyTerminalTimeScale,
      massageLabFaultyTerminalScanlineIntensity: DEFAULT_CHIMER_SETTINGS.massageLabFaultyTerminalScanlineIntensity,
      massageLabFaultyTerminalGlitchAmount: DEFAULT_CHIMER_SETTINGS.massageLabFaultyTerminalGlitchAmount,
      massageLabFaultyTerminalFlickerAmount: DEFAULT_CHIMER_SETTINGS.massageLabFaultyTerminalFlickerAmount,
      massageLabFaultyTerminalNoiseAmp: DEFAULT_CHIMER_SETTINGS.massageLabFaultyTerminalNoiseAmp,
      massageLabFaultyTerminalChromaticAberration: DEFAULT_CHIMER_SETTINGS.massageLabFaultyTerminalChromaticAberration,
      massageLabFaultyTerminalDither: DEFAULT_CHIMER_SETTINGS.massageLabFaultyTerminalDither,
      massageLabFaultyTerminalCurvature: DEFAULT_CHIMER_SETTINGS.massageLabFaultyTerminalCurvature,
      massageLabFaultyTerminalMouseReact: DEFAULT_CHIMER_SETTINGS.massageLabFaultyTerminalMouseReact,
      massageLabFaultyTerminalMouseStrength: DEFAULT_CHIMER_SETTINGS.massageLabFaultyTerminalMouseStrength,
      massageLabFaultyTerminalPageLoadAnimation: DEFAULT_CHIMER_SETTINGS.massageLabFaultyTerminalPageLoadAnimation,
      massageLabFaultyTerminalBrightness: DEFAULT_CHIMER_SETTINGS.massageLabFaultyTerminalBrightness,
      massageLabRippleGridRippleIntensity: DEFAULT_CHIMER_SETTINGS.massageLabRippleGridRippleIntensity,
      massageLabRippleGridGridSize: DEFAULT_CHIMER_SETTINGS.massageLabRippleGridGridSize,
      massageLabRippleGridGridThickness: DEFAULT_CHIMER_SETTINGS.massageLabRippleGridGridThickness,
      massageLabRippleGridFadeDistance: DEFAULT_CHIMER_SETTINGS.massageLabRippleGridFadeDistance,
      massageLabRippleGridVignetteStrength: DEFAULT_CHIMER_SETTINGS.massageLabRippleGridVignetteStrength,
      massageLabRippleGridGlowIntensity: DEFAULT_CHIMER_SETTINGS.massageLabRippleGridGlowIntensity,
      massageLabRippleGridOpacity: DEFAULT_CHIMER_SETTINGS.massageLabRippleGridOpacity,
      massageLabRippleGridGridRotation: DEFAULT_CHIMER_SETTINGS.massageLabRippleGridGridRotation,
      massageLabRippleGridMouseInteraction: DEFAULT_CHIMER_SETTINGS.massageLabRippleGridMouseInteraction,
      massageLabRippleGridMouseInteractionRadius: DEFAULT_CHIMER_SETTINGS.massageLabRippleGridMouseInteractionRadius,
      massageLabDotFieldDotRadius: DEFAULT_CHIMER_SETTINGS.massageLabDotFieldDotRadius,
      massageLabDotFieldDotSpacing: DEFAULT_CHIMER_SETTINGS.massageLabDotFieldDotSpacing,
      massageLabDotFieldCursorRadius: DEFAULT_CHIMER_SETTINGS.massageLabDotFieldCursorRadius,
      massageLabDotFieldCursorForce: DEFAULT_CHIMER_SETTINGS.massageLabDotFieldCursorForce,
      massageLabDotFieldBulgeOnly: DEFAULT_CHIMER_SETTINGS.massageLabDotFieldBulgeOnly,
      massageLabDotFieldBulgeStrength: DEFAULT_CHIMER_SETTINGS.massageLabDotFieldBulgeStrength,
      massageLabDotFieldGlowRadius: DEFAULT_CHIMER_SETTINGS.massageLabDotFieldGlowRadius,
      massageLabDotFieldSparkle: DEFAULT_CHIMER_SETTINGS.massageLabDotFieldSparkle,
      massageLabDotFieldWaveAmplitude: DEFAULT_CHIMER_SETTINGS.massageLabDotFieldWaveAmplitude,
      massageLabDotFieldCursorInteraction: DEFAULT_CHIMER_SETTINGS.massageLabDotFieldCursorInteraction,
      massageLabDotGridDotSize: DEFAULT_CHIMER_SETTINGS.massageLabDotGridDotSize,
      massageLabDotGridGap: DEFAULT_CHIMER_SETTINGS.massageLabDotGridGap,
      massageLabDotGridProximity: DEFAULT_CHIMER_SETTINGS.massageLabDotGridProximity,
      massageLabDotGridSpeedTrigger: DEFAULT_CHIMER_SETTINGS.massageLabDotGridSpeedTrigger,
      massageLabDotGridShockRadius: DEFAULT_CHIMER_SETTINGS.massageLabDotGridShockRadius,
      massageLabDotGridShockStrength: DEFAULT_CHIMER_SETTINGS.massageLabDotGridShockStrength,
      massageLabDotGridMaxSpeed: DEFAULT_CHIMER_SETTINGS.massageLabDotGridMaxSpeed,
      massageLabDotGridResistance: DEFAULT_CHIMER_SETTINGS.massageLabDotGridResistance,
      massageLabDotGridReturnDuration: DEFAULT_CHIMER_SETTINGS.massageLabDotGridReturnDuration,
      massageLabDotGridCursorInteraction: DEFAULT_CHIMER_SETTINGS.massageLabDotGridCursorInteraction,
      massageLabDotGridClickShock: DEFAULT_CHIMER_SETTINGS.massageLabDotGridClickShock,
      massageLabThreadsAmplitude: DEFAULT_CHIMER_SETTINGS.massageLabThreadsAmplitude,
      massageLabThreadsDistance: DEFAULT_CHIMER_SETTINGS.massageLabThreadsDistance,
      massageLabThreadsEnableMouseInteraction: DEFAULT_CHIMER_SETTINGS.massageLabThreadsEnableMouseInteraction,
      massageLabIridescenceSpeed: DEFAULT_CHIMER_SETTINGS.massageLabIridescenceSpeed,
      massageLabIridescenceAmplitude: DEFAULT_CHIMER_SETTINGS.massageLabIridescenceAmplitude,
      massageLabIridescenceMouseReact: DEFAULT_CHIMER_SETTINGS.massageLabIridescenceMouseReact,
      massageLabWavesTransparentBackground: DEFAULT_CHIMER_SETTINGS.massageLabWavesTransparentBackground,
      massageLabWavesSpeedX: DEFAULT_CHIMER_SETTINGS.massageLabWavesSpeedX,
      massageLabWavesSpeedY: DEFAULT_CHIMER_SETTINGS.massageLabWavesSpeedY,
      massageLabWavesAmplitudeX: DEFAULT_CHIMER_SETTINGS.massageLabWavesAmplitudeX,
      massageLabWavesAmplitudeY: DEFAULT_CHIMER_SETTINGS.massageLabWavesAmplitudeY,
      massageLabWavesGapX: DEFAULT_CHIMER_SETTINGS.massageLabWavesGapX,
      massageLabWavesGapY: DEFAULT_CHIMER_SETTINGS.massageLabWavesGapY,
      massageLabWavesFriction: DEFAULT_CHIMER_SETTINGS.massageLabWavesFriction,
      massageLabWavesTension: DEFAULT_CHIMER_SETTINGS.massageLabWavesTension,
      massageLabWavesMaxCursorMove: DEFAULT_CHIMER_SETTINGS.massageLabWavesMaxCursorMove,
      massageLabWavesCursorInteraction: DEFAULT_CHIMER_SETTINGS.massageLabWavesCursorInteraction,
      massageLabGridDistortionGrid: DEFAULT_CHIMER_SETTINGS.massageLabGridDistortionGrid,
      massageLabGridDistortionMouse: DEFAULT_CHIMER_SETTINGS.massageLabGridDistortionMouse,
      massageLabGridDistortionStrength: DEFAULT_CHIMER_SETTINGS.massageLabGridDistortionStrength,
      massageLabGridDistortionRelaxation: DEFAULT_CHIMER_SETTINGS.massageLabGridDistortionRelaxation,
      massageLabGridDistortionCursorInteraction: DEFAULT_CHIMER_SETTINGS.massageLabGridDistortionCursorInteraction,
      massageLabOrbHoverIntensity: DEFAULT_CHIMER_SETTINGS.massageLabOrbHoverIntensity,
      massageLabOrbRotateOnHover: DEFAULT_CHIMER_SETTINGS.massageLabOrbRotateOnHover,
      massageLabOrbForceHoverState: DEFAULT_CHIMER_SETTINGS.massageLabOrbForceHoverState,
      massageLabOrbCursorInteraction: DEFAULT_CHIMER_SETTINGS.massageLabOrbCursorInteraction,
      massageLabLetterGlitchGlitchSpeed: DEFAULT_CHIMER_SETTINGS.massageLabLetterGlitchGlitchSpeed,
      massageLabLetterGlitchCenterVignette: DEFAULT_CHIMER_SETTINGS.massageLabLetterGlitchCenterVignette,
      massageLabLetterGlitchOuterVignette: DEFAULT_CHIMER_SETTINGS.massageLabLetterGlitchOuterVignette,
      massageLabLetterGlitchSmooth: DEFAULT_CHIMER_SETTINGS.massageLabLetterGlitchSmooth,
      massageLabLetterGlitchCharacters: DEFAULT_CHIMER_SETTINGS.massageLabLetterGlitchCharacters,
      massageLabGridMotionMaxMoveAmount: DEFAULT_CHIMER_SETTINGS.massageLabGridMotionMaxMoveAmount,
      massageLabGridMotionBaseDuration: DEFAULT_CHIMER_SETTINGS.massageLabGridMotionBaseDuration,
      massageLabGridMotionCursorInteraction: DEFAULT_CHIMER_SETTINGS.massageLabGridMotionCursorInteraction,
      massageLabShapeGridDirection: DEFAULT_CHIMER_SETTINGS.massageLabShapeGridDirection,
      massageLabShapeGridSpeed: DEFAULT_CHIMER_SETTINGS.massageLabShapeGridSpeed,
      massageLabShapeGridSquareSize: DEFAULT_CHIMER_SETTINGS.massageLabShapeGridSquareSize,
      massageLabShapeGridShape: DEFAULT_CHIMER_SETTINGS.massageLabShapeGridShape,
      massageLabShapeGridHoverTrailAmount: DEFAULT_CHIMER_SETTINGS.massageLabShapeGridHoverTrailAmount,
      massageLabShapeGridCursorInteraction: DEFAULT_CHIMER_SETTINGS.massageLabShapeGridCursorInteraction,
      massageLabLiquidChromeSpeed: DEFAULT_CHIMER_SETTINGS.massageLabLiquidChromeSpeed,
      massageLabLiquidChromeAmplitude: DEFAULT_CHIMER_SETTINGS.massageLabLiquidChromeAmplitude,
      massageLabLiquidChromeFrequencyX: DEFAULT_CHIMER_SETTINGS.massageLabLiquidChromeFrequencyX,
      massageLabLiquidChromeFrequencyY: DEFAULT_CHIMER_SETTINGS.massageLabLiquidChromeFrequencyY,
      massageLabLiquidChromeInteractive: DEFAULT_CHIMER_SETTINGS.massageLabLiquidChromeInteractive,
      massageLabBalatroSpinRotation: DEFAULT_CHIMER_SETTINGS.massageLabBalatroSpinRotation,
      massageLabBalatroSpinSpeed: DEFAULT_CHIMER_SETTINGS.massageLabBalatroSpinSpeed,
      massageLabBalatroOffsetX: DEFAULT_CHIMER_SETTINGS.massageLabBalatroOffsetX,
      massageLabBalatroOffsetY: DEFAULT_CHIMER_SETTINGS.massageLabBalatroOffsetY,
      massageLabBalatroContrast: DEFAULT_CHIMER_SETTINGS.massageLabBalatroContrast,
      massageLabBalatroLighting: DEFAULT_CHIMER_SETTINGS.massageLabBalatroLighting,
      massageLabBalatroSpinAmount: DEFAULT_CHIMER_SETTINGS.massageLabBalatroSpinAmount,
      massageLabBalatroPixelFilter: DEFAULT_CHIMER_SETTINGS.massageLabBalatroPixelFilter,
      massageLabBalatroSpinEase: DEFAULT_CHIMER_SETTINGS.massageLabBalatroSpinEase,
      massageLabBalatroIsRotate: DEFAULT_CHIMER_SETTINGS.massageLabBalatroIsRotate,
      massageLabBalatroMouseInteraction: DEFAULT_CHIMER_SETTINGS.massageLabBalatroMouseInteraction,
      massageLabNovatrixSpeed: DEFAULT_CHIMER_SETTINGS.massageLabNovatrixSpeed,
      massageLabNovatrixAmplitude: DEFAULT_CHIMER_SETTINGS.massageLabNovatrixAmplitude,
      massageLabMatrixRainSpeed: DEFAULT_CHIMER_SETTINGS.massageLabMatrixRainSpeed,
      massageLabMatrixRainFontSize: DEFAULT_CHIMER_SETTINGS.massageLabMatrixRainFontSize,
      massageLabPhotonBeamLineCount: DEFAULT_CHIMER_SETTINGS.massageLabPhotonBeamLineCount,
      massageLabPhotonBeamSpreadHeight: DEFAULT_CHIMER_SETTINGS.massageLabPhotonBeamSpreadHeight,
      massageLabPhotonBeamSpreadDepth: DEFAULT_CHIMER_SETTINGS.massageLabPhotonBeamSpreadDepth,
      massageLabPhotonBeamCurveLength: DEFAULT_CHIMER_SETTINGS.massageLabPhotonBeamCurveLength,
      massageLabPhotonBeamStraightLength: DEFAULT_CHIMER_SETTINGS.massageLabPhotonBeamStraightLength,
      massageLabPhotonBeamCurvePower: DEFAULT_CHIMER_SETTINGS.massageLabPhotonBeamCurvePower,
      massageLabPhotonBeamWaveSpeed: DEFAULT_CHIMER_SETTINGS.massageLabPhotonBeamWaveSpeed,
      massageLabPhotonBeamWaveHeight: DEFAULT_CHIMER_SETTINGS.massageLabPhotonBeamWaveHeight,
      massageLabPhotonBeamLineOpacity: DEFAULT_CHIMER_SETTINGS.massageLabPhotonBeamLineOpacity,
      massageLabPhotonBeamSignalCount: DEFAULT_CHIMER_SETTINGS.massageLabPhotonBeamSignalCount,
      massageLabPhotonBeamSpeedGlobal: DEFAULT_CHIMER_SETTINGS.massageLabPhotonBeamSpeedGlobal,
      massageLabPhotonBeamTrailLength: DEFAULT_CHIMER_SETTINGS.massageLabPhotonBeamTrailLength,
      massageLabPhotonBeamBloomStrength: DEFAULT_CHIMER_SETTINGS.massageLabPhotonBeamBloomStrength,
      massageLabPhotonBeamBloomRadius: DEFAULT_CHIMER_SETTINGS.massageLabPhotonBeamBloomRadius,
      massageLab3DGlobeViewStyle: DEFAULT_CHIMER_SETTINGS.massageLab3DGlobeViewStyle,
      massageLab3DGlobeGraphicMapSamples: DEFAULT_CHIMER_SETTINGS.massageLab3DGlobeGraphicMapSamples,
      massageLab3DGlobeAutoRotateSpeed: DEFAULT_CHIMER_SETTINGS.massageLab3DGlobeAutoRotateSpeed,
      massageLab3DGlobeReverseSpin: DEFAULT_CHIMER_SETTINGS.massageLab3DGlobeReverseSpin,
      massageLab3DGlobeScale: DEFAULT_CHIMER_SETTINGS.massageLab3DGlobeScale,
      massageLab3DGlobeBumpScale: DEFAULT_CHIMER_SETTINGS.massageLab3DGlobeBumpScale,
      massageLab3DGlobeAmbientIntensity: DEFAULT_CHIMER_SETTINGS.massageLab3DGlobeAmbientIntensity,
      massageLab3DGlobePointLightIntensity: DEFAULT_CHIMER_SETTINGS.massageLab3DGlobePointLightIntensity,
      massageLab3DGlobeLightingMode: DEFAULT_CHIMER_SETTINGS.massageLab3DGlobeLightingMode,
      massageLab3DGlobeEnablePan: DEFAULT_CHIMER_SETTINGS.massageLab3DGlobeEnablePan,
      massageLab3DGlobePanX: DEFAULT_CHIMER_SETTINGS.massageLab3DGlobePanX,
      massageLab3DGlobePanY: DEFAULT_CHIMER_SETTINGS.massageLab3DGlobePanY,
      massageLab3DGlobeShowTilt: DEFAULT_CHIMER_SETTINGS.massageLab3DGlobeShowTilt,
      massageLab3DGlobeShowAtmosphere: DEFAULT_CHIMER_SETTINGS.massageLab3DGlobeShowAtmosphere,
      massageLab3DGlobeAtmosphereIntensity: DEFAULT_CHIMER_SETTINGS.massageLab3DGlobeAtmosphereIntensity,
      massageLab3DGlobeAtmosphereBlur: DEFAULT_CHIMER_SETTINGS.massageLab3DGlobeAtmosphereBlur,
      massageLab3DGlobeShowWireframe: DEFAULT_CHIMER_SETTINGS.massageLab3DGlobeShowWireframe,
      massageLab3DGlobeMarkerEnabled: DEFAULT_CHIMER_SETTINGS.massageLab3DGlobeMarkerEnabled,
      massageLab3DGlobeMarkerLat: DEFAULT_CHIMER_SETTINGS.massageLab3DGlobeMarkerLat,
      massageLab3DGlobeMarkerLng: DEFAULT_CHIMER_SETTINGS.massageLab3DGlobeMarkerLng,
      massageLab3DGlobeMarkerLabel: DEFAULT_CHIMER_SETTINGS.massageLab3DGlobeMarkerLabel,
      massageLab3DGlobeMarkerIcon: DEFAULT_CHIMER_SETTINGS.massageLab3DGlobeMarkerIcon,
      massageLab3DGlobeMarkerSize: DEFAULT_CHIMER_SETTINGS.massageLab3DGlobeMarkerSize,
      massageLabRetroGridAngle: DEFAULT_CHIMER_SETTINGS.massageLabRetroGridAngle,
      massageLabRetroGridCellSize: DEFAULT_CHIMER_SETTINGS.massageLabRetroGridCellSize,
      massageLabRetroGridOpacity: DEFAULT_CHIMER_SETTINGS.massageLabRetroGridOpacity,
      massageLabAerialRaysCount: DEFAULT_CHIMER_SETTINGS.massageLabAerialRaysCount,
      massageLabAerialRaysBlur: DEFAULT_CHIMER_SETTINGS.massageLabAerialRaysBlur,
      massageLabAerialRaysSpeed: DEFAULT_CHIMER_SETTINGS.massageLabAerialRaysSpeed,
      massageLabAerialRaysLength: DEFAULT_CHIMER_SETTINGS.massageLabAerialRaysLength,
      massageLabAerialRaysOpacity: DEFAULT_CHIMER_SETTINGS.massageLabAerialRaysOpacity,
      massageLabDnaStrandCount: DEFAULT_CHIMER_SETTINGS.massageLabDnaStrandCount,
      massageLabDnaNodeMotionSpeed: DEFAULT_CHIMER_SETTINGS.massageLabDnaNodeMotionSpeed,
      massageLabDnaStrandRotationSpeed: DEFAULT_CHIMER_SETTINGS.massageLabDnaStrandRotationSpeed,
      massageLabDnaStrandAngle: DEFAULT_CHIMER_SETTINGS.massageLabDnaStrandAngle,
      massageLabDnaScale: DEFAULT_CHIMER_SETTINGS.massageLabDnaScale,
      massageLabDnaPositionX: DEFAULT_CHIMER_SETTINGS.massageLabDnaPositionX,
      massageLabDnaPositionY: DEFAULT_CHIMER_SETTINGS.massageLabDnaPositionY,
      massageLabDnaStrandSpacing: DEFAULT_CHIMER_SETTINGS.massageLabDnaStrandSpacing,
      massageLabDnaConnectorWidth: DEFAULT_CHIMER_SETTINGS.massageLabDnaConnectorWidth,
      massageLabDnaConnectorThickness: DEFAULT_CHIMER_SETTINGS.massageLabDnaConnectorThickness,
      massageLabDnaOutlineThickness: DEFAULT_CHIMER_SETTINGS.massageLabDnaOutlineThickness,
      massageLabTwistedCubesLayerCount: DEFAULT_CHIMER_SETTINGS.massageLabTwistedCubesLayerCount,
      massageLabTwistedCubesRotationSpeed: DEFAULT_CHIMER_SETTINGS.massageLabTwistedCubesRotationSpeed,
      massageLabTwistedCubesLayerStagger: DEFAULT_CHIMER_SETTINGS.massageLabTwistedCubesLayerStagger,
      massageLabTwistedCubesViewAngleX: DEFAULT_CHIMER_SETTINGS.massageLabTwistedCubesViewAngleX,
      massageLabTwistedCubesViewAngleY: DEFAULT_CHIMER_SETTINGS.massageLabTwistedCubesViewAngleY,
      massageLabTwistedCubesScale: DEFAULT_CHIMER_SETTINGS.massageLabTwistedCubesScale,
      massageLabTwistedCubesPositionX: DEFAULT_CHIMER_SETTINGS.massageLabTwistedCubesPositionX,
      massageLabTwistedCubesPositionY: DEFAULT_CHIMER_SETTINGS.massageLabTwistedCubesPositionY,
      massageLabTwistedCubesLayerDepthSpacing: DEFAULT_CHIMER_SETTINGS.massageLabTwistedCubesLayerDepthSpacing,
      massageLabTwistedCubesOpacityFalloff: DEFAULT_CHIMER_SETTINGS.massageLabTwistedCubesOpacityFalloff,
      massageLabTwistedCubesOutlineThickness: DEFAULT_CHIMER_SETTINGS.massageLabTwistedCubesOutlineThickness,
      massageLabSynthesisSpeed: DEFAULT_CHIMER_SETTINGS.massageLabSynthesisSpeed,
      massageLabSynthesisComplexity: DEFAULT_CHIMER_SETTINGS.massageLabSynthesisComplexity,
      massageLabSynthesisScale: DEFAULT_CHIMER_SETTINGS.massageLabSynthesisScale,
      massageLabSynthesisDistortion: DEFAULT_CHIMER_SETTINGS.massageLabSynthesisDistortion,
      massageLabSynthesisGlowIntensity: DEFAULT_CHIMER_SETTINGS.massageLabSynthesisGlowIntensity,
      massageLabSynthesisFlowFrequency: DEFAULT_CHIMER_SETTINGS.massageLabSynthesisFlowFrequency,
      backgroundLinesDuration: DEFAULT_CHIMER_SETTINGS.backgroundLinesDuration,
      shootingStarsDensity: DEFAULT_CHIMER_SETTINGS.shootingStarsDensity,
      shootingStarsTwinkle: DEFAULT_CHIMER_SETTINGS.shootingStarsTwinkle,
      shootingStarsTwinkleSpeed: DEFAULT_CHIMER_SETTINGS.shootingStarsTwinkleSpeed,
      shootingStarsShootingSpeed: DEFAULT_CHIMER_SETTINGS.shootingStarsShootingSpeed,
      shootingStarsFrequency: DEFAULT_CHIMER_SETTINGS.shootingStarsFrequency,
      canvasRevealDotsDotSize: DEFAULT_CHIMER_SETTINGS.canvasRevealDotsDotSize,
      canvasRevealDotsDotSpacing: DEFAULT_CHIMER_SETTINGS.canvasRevealDotsDotSpacing,
      canvasRevealDotsOpacity: DEFAULT_CHIMER_SETTINGS.canvasRevealDotsOpacity,
      canvasRevealDotsAnimationSpeed: DEFAULT_CHIMER_SETTINGS.canvasRevealDotsAnimationSpeed,
      canvasRevealDotsShowGradient: DEFAULT_CHIMER_SETTINGS.canvasRevealDotsShowGradient,
      spotlightOpacity: DEFAULT_CHIMER_SETTINGS.spotlightOpacity,
      spotlightWidth: DEFAULT_CHIMER_SETTINGS.spotlightWidth,
      spotlightHeight: DEFAULT_CHIMER_SETTINGS.spotlightHeight,
      spotlightSmallWidth: DEFAULT_CHIMER_SETTINGS.spotlightSmallWidth,
      spotlightTranslateY: DEFAULT_CHIMER_SETTINGS.spotlightTranslateY,
      spotlightDuration: DEFAULT_CHIMER_SETTINGS.spotlightDuration,
      spotlightXOffset: DEFAULT_CHIMER_SETTINGS.spotlightXOffset,
      lampGlowOpacity: DEFAULT_CHIMER_SETTINGS.lampGlowOpacity,
      lampBeamWidth: DEFAULT_CHIMER_SETTINGS.lampBeamWidth,
      lampGlowWidth: DEFAULT_CHIMER_SETTINGS.lampGlowWidth,
      lampVerticalOffset: DEFAULT_CHIMER_SETTINGS.lampVerticalOffset,
      lampPulseSpeed: DEFAULT_CHIMER_SETTINGS.lampPulseSpeed,
      vortexParticleCount: DEFAULT_CHIMER_SETTINGS.vortexParticleCount,
      vortexRangeY: DEFAULT_CHIMER_SETTINGS.vortexRangeY,
      vortexBaseSpeed: DEFAULT_CHIMER_SETTINGS.vortexBaseSpeed,
      vortexRangeSpeed: DEFAULT_CHIMER_SETTINGS.vortexRangeSpeed,
      vortexBaseRadius: DEFAULT_CHIMER_SETTINGS.vortexBaseRadius,
      vortexRangeRadius: DEFAULT_CHIMER_SETTINGS.vortexRangeRadius,
      wavyWaveWidth: DEFAULT_CHIMER_SETTINGS.wavyWaveWidth,
      wavyBlur: DEFAULT_CHIMER_SETTINGS.wavyBlur,
      wavySpeed: DEFAULT_CHIMER_SETTINGS.wavySpeed,
      wavyWaveOpacity: DEFAULT_CHIMER_SETTINGS.wavyWaveOpacity,
      auroraBarsBarCount: DEFAULT_CHIMER_SETTINGS.auroraBarsBarCount,
      auroraBarsSpeed: DEFAULT_CHIMER_SETTINGS.auroraBarsSpeed,
      auroraBarsBlur: DEFAULT_CHIMER_SETTINGS.auroraBarsBlur,
      auroraBarsGap: DEFAULT_CHIMER_SETTINGS.auroraBarsGap,
      auroraBarsMaxHeightRatio: DEFAULT_CHIMER_SETTINGS.auroraBarsMaxHeightRatio,
      auroraBarsMinHeightRatio: DEFAULT_CHIMER_SETTINGS.auroraBarsMinHeightRatio,
      pixelLiquidPixelSize: DEFAULT_CHIMER_SETTINGS.pixelLiquidPixelSize,
      pixelLiquidDetail: DEFAULT_CHIMER_SETTINGS.pixelLiquidDetail,
      pixelLiquidCursorForce: DEFAULT_CHIMER_SETTINGS.pixelLiquidCursorForce,
      pixelLiquidCursorSize: DEFAULT_CHIMER_SETTINGS.pixelLiquidCursorSize,
      pixelLiquidAutoDemo: DEFAULT_CHIMER_SETTINGS.pixelLiquidAutoDemo,
      pixelLiquidMotionSpeed: DEFAULT_CHIMER_SETTINGS.pixelLiquidMotionSpeed,
      tileGridTileSize: DEFAULT_CHIMER_SETTINGS.tileGridTileSize,
      tileGridJointSize: DEFAULT_CHIMER_SETTINGS.tileGridJointSize,
      tileGridChangeFrequency: DEFAULT_CHIMER_SETTINGS.tileGridChangeFrequency,
      tileGridActivePercent: DEFAULT_CHIMER_SETTINGS.tileGridActivePercent,
      tileGridOpacity: DEFAULT_CHIMER_SETTINGS.tileGridOpacity,
      hexGridHexSize: DEFAULT_CHIMER_SETTINGS.hexGridHexSize,
      hexGridJointSize: DEFAULT_CHIMER_SETTINGS.hexGridJointSize,
      hexGridChangeFrequency: DEFAULT_CHIMER_SETTINGS.hexGridChangeFrequency,
      hexGridActivePercent: DEFAULT_CHIMER_SETTINGS.hexGridActivePercent,
      hexGridOpacity: DEFAULT_CHIMER_SETTINGS.hexGridOpacity,
    } : {}),
  }

  return omitLegacyBackgroundColorSettings(sanitizedSettings)
}

/**
 * Sanitizes an ordinary settings patch without letting the canonical Chimer
 * background erase untouched renderer tuning authorized by owned Music
 * backgrounds. Only normalized, unpatched properties declared by the injected
 * adapter inventory are restored; explicit visual-property edits and revoked
 * ownership continue through the fail-closed entitlement sanitizer.
 *
 * @param {object} currentSettings
 * @param {object} patch
 * @param {readonly string[] | {featureKeys?: readonly string[], ownedBackgroundIds?: readonly string[]}} accessInput
 * @param {{backgroundPreferenceOptions?: {getVisualPropertyKeys?: (backgroundId: string) => readonly string[] | null}, canUseAccountColorControls?: boolean, ownedBackgroundIds?: readonly string[]}} options
 */
export function sanitizeChimerSettingsPatchForEntitlements(
  currentSettings = {},
  patch = {},
  accessInput = [],
  options = {},
) {
  const normalizedCandidate = sanitizeChimerSettings({
    ...currentSettings,
    ...patch,
  }, {
    backgroundPreferenceOptions: options.backgroundPreferenceOptions,
  })
  const sanitized = sanitizeChimerSettingsForEntitlements(
    normalizedCandidate,
    accessInput,
    options,
  )
  const ownedBackgroundIds = Array.isArray(accessInput)
    ? Array.isArray(options.ownedBackgroundIds) ? options.ownedBackgroundIds : []
    : Array.isArray(accessInput?.ownedBackgroundIds) ? accessInput.ownedBackgroundIds : []
  const getVisualPropertyKeys =
    options.backgroundPreferenceOptions?.getVisualPropertyKeys
  if (ownedBackgroundIds.length === 0 || typeof getVisualPropertyKeys !== "function") {
    return sanitized
  }

  const patchedKeys = new Set(Object.keys(patch))
  for (const backgroundId of ownedBackgroundIds) {
    const visualPropertyKeys = getVisualPropertyKeys(backgroundId)
    if (!Array.isArray(visualPropertyKeys)) {
      continue
    }
    for (const propertyKey of visualPropertyKeys) {
      if (
        !patchedKeys.has(propertyKey)
        && Object.prototype.hasOwnProperty.call(normalizedCandidate, propertyKey)
      ) {
        sanitized[propertyKey] = normalizedCandidate[propertyKey]
      }
    }
  }
  return sanitized
}

/**
 * Sanitizes a Visual Apply against each visual background's own access scope,
 * preserves untouched renderer tuning for every owned background, then
 * overlays only the edited renderers' declared non-color property keys onto
 * the canonically selected Chimer settings.
 *
 * @param {{
 *   currentSettings?: object,
 *   candidateProperties?: Record<string, unknown>,
 *   canonicalBackgroundId?: string,
 *   visualBackgroundIds?: readonly string[],
 *   visualPropertyKeysByBackground?: Record<string, readonly string[]>,
 *   backgroundVisualPreferences?: unknown,
 * }} input
 * @param {readonly string[] | {featureKeys?: readonly string[], ownedBackgroundIds?: readonly string[]}} accessInput
 * @param {Record<string, unknown>} options
 */
export function sanitizeChimerVisualCommitForEntitlements(
  input = {},
  accessInput = [],
  options = {},
) {
  const currentSettings =
    input.currentSettings && typeof input.currentSettings === "object"
      ? input.currentSettings
      : {}
  const candidateProperties =
    input.candidateProperties && typeof input.candidateProperties === "object"
      ? input.candidateProperties
      : {}
  const canonicalBackgroundId =
    typeof input.canonicalBackgroundId === "string"
      ? input.canonicalBackgroundId
      : DEFAULT_CHIMER_SETTINGS.backgroundId
  const visualBackgroundIds = Array.isArray(input.visualBackgroundIds)
    ? [...new Set(input.visualBackgroundIds.filter((value) => typeof value === "string"))]
    : []
  const visualPropertyKeysByBackground =
    input.visualPropertyKeysByBackground
      && typeof input.visualPropertyKeysByBackground === "object"
      ? input.visualPropertyKeysByBackground
      : {}
  const candidateSettings = {
    ...currentSettings,
    ...candidateProperties,
    backgroundId: canonicalBackgroundId,
    backgroundVisualPreferences: input.backgroundVisualPreferences,
  }
  const canonicalSettings = sanitizeChimerSettingsPatchForEntitlements(
    currentSettings,
    {
      ...candidateProperties,
      backgroundId: canonicalBackgroundId,
      backgroundVisualPreferences: input.backgroundVisualPreferences,
    },
    accessInput,
    options,
  )
  /** @type {Record<string, unknown>} */
  const authorizedVisualProperties = {}

  for (const visualBackgroundId of visualBackgroundIds) {
    const visualSettings = sanitizeChimerSettingsForEntitlements({
      ...candidateSettings,
      backgroundId: visualBackgroundId,
    }, accessInput, options)
    const visualPropertyKeys = visualPropertyKeysByBackground[visualBackgroundId]

    if (!Array.isArray(visualPropertyKeys)) {
      continue
    }

    for (const propertyKey of visualPropertyKeys) {
      if (Object.prototype.hasOwnProperty.call(candidateProperties, propertyKey)) {
        authorizedVisualProperties[propertyKey] = visualSettings[propertyKey]
      }
    }
  }

  return {
    ...canonicalSettings,
    ...authorizedVisualProperties,
  }
}
