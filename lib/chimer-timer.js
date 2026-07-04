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
