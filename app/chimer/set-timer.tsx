"use client"

import { BellRing, Clock, MonitorSmartphone, Play, SlidersHorizontal } from "lucide-react"
import { BackgroundSelector } from "@/components/backgrounds/BackgroundSelector"
import type { BackgroundCategory, BackgroundDefinition, BackgroundId } from "@/components/backgrounds/backgroundRegistry"
import { PageHeading } from "@/components/ui/page-heading"
import styles from "./set-timer.module.css"
import { TileGridFadeTimeControl } from "./tile-grid-fade-time-control"

export const COLOR_HARMONY_OPTIONS = [
  { value: "analogous", label: "Analogous" },
  { value: "complementary", label: "Complementary" },
  { value: "split-complementary", label: "Split complementary" },
  { value: "triad", label: "Triad" },
  { value: "square", label: "Square" },
  { value: "compound", label: "Compound" },
  { value: "shades", label: "Shades" },
  { value: "monochromatic", label: "Monochromatic" },
] as const

export const ANIMATE_UI_GRADIENT_HARMONY_OPTIONS = COLOR_HARMONY_OPTIONS

export type ColorHarmony = typeof COLOR_HARMONY_OPTIONS[number]["value"]
export type AnimateUiGradientHarmony = ColorHarmony
export type ChamaacAstralFlowPaletteMode = "harmony" | "custom"
export type ChamaacDeepSpaceNebulaPaletteMode = "harmony" | "custom"
export type ChamaacLiquidChromePaletteMode = "harmony" | "custom"
export type ChamaacWavesPaletteMode = "harmony" | "custom"
export type ChamaacSynthesisPaletteMode = "harmony" | "custom"
export type EldoraNovatrixPaletteMode = "harmony" | "custom"
export type EldoraHackerPaletteMode = "harmony" | "custom"

export const CHAMAAC_ASTRAL_FLOW_SOURCE_SPEED_MIN = 0.1
export const CHAMAAC_ASTRAL_FLOW_SOURCE_SPEED_MAX = 3
export const CHAMAAC_ASTRAL_FLOW_DISPLAY_SPEED_MIN = 10
export const CHAMAAC_ASTRAL_FLOW_DISPLAY_SPEED_MAX = 100
export const CHAMAAC_ASTRAL_FLOW_DISPLAY_SPEED_STEP = 1
export const CHAMAAC_DEEP_SPACE_NEBULA_SOURCE_SPEED_MIN = 0.1
export const CHAMAAC_DEEP_SPACE_NEBULA_SOURCE_SPEED_MAX = 5
export const CHAMAAC_DEEP_SPACE_NEBULA_DISPLAY_SPEED_MIN = 1
export const CHAMAAC_DEEP_SPACE_NEBULA_DISPLAY_SPEED_MAX = 100
export const CHAMAAC_DEEP_SPACE_NEBULA_DISPLAY_SPEED_STEP = 1
export const CHAMAAC_GRID_BLOOM_SOURCE_SPEED_MIN = 0.1
export const CHAMAAC_GRID_BLOOM_SOURCE_SPEED_MAX = 3
export const CHAMAAC_GRID_BLOOM_DISPLAY_SPEED_MIN = 1
export const CHAMAAC_GRID_BLOOM_DISPLAY_SPEED_MAX = 100
export const CHAMAAC_GRID_BLOOM_DISPLAY_SPEED_STEP = 1
export const CHAMAAC_LIQUID_CHROME_SOURCE_FLOW_SPEED_MIN = 0.01
export const CHAMAAC_LIQUID_CHROME_SOURCE_FLOW_SPEED_MAX = 2
export const CHAMAAC_LIQUID_CHROME_DISPLAY_FLOW_SPEED_MIN = 1
export const CHAMAAC_LIQUID_CHROME_DISPLAY_FLOW_SPEED_MAX = 100
export const CHAMAAC_LIQUID_CHROME_DISPLAY_FLOW_SPEED_STEP = 1
export const CHAMAAC_LIQUID_CHROME_SOURCE_TIME_SCALE_MIN = 0.001
export const CHAMAAC_LIQUID_CHROME_SOURCE_TIME_SCALE_MAX = 1
export const CHAMAAC_LIQUID_CHROME_DISPLAY_TIME_SCALE_MIN = 1
export const CHAMAAC_LIQUID_CHROME_DISPLAY_TIME_SCALE_MAX = 100
export const CHAMAAC_LIQUID_CHROME_DISPLAY_TIME_SCALE_STEP = 1
export const CHAMAAC_WAVES_SOURCE_SPEED_MIN = 0.001
export const CHAMAAC_WAVES_SOURCE_SPEED_MAX = 0.1
export const CHAMAAC_WAVES_DISPLAY_SPEED_MIN = 1
export const CHAMAAC_WAVES_DISPLAY_SPEED_MAX = 100
export const CHAMAAC_WAVES_DISPLAY_SPEED_STEP = 1
export const ELDORA_NOVATRIX_SOURCE_SPEED_MIN = 0.02
export const ELDORA_NOVATRIX_SOURCE_SPEED_MAX = 3
export const ELDORA_NOVATRIX_DISPLAY_SPEED_MIN = 1
export const ELDORA_NOVATRIX_DISPLAY_SPEED_MAX = 100
export const ELDORA_NOVATRIX_DISPLAY_SPEED_STEP = 1
export const ELDORA_NOVATRIX_SOURCE_AMPLITUDE_MIN = 0.01
export const ELDORA_NOVATRIX_SOURCE_AMPLITUDE_MAX = 0.45
export const ELDORA_NOVATRIX_DISPLAY_AMPLITUDE_MIN = 1
export const ELDORA_NOVATRIX_DISPLAY_AMPLITUDE_MAX = 100
export const ELDORA_NOVATRIX_DISPLAY_AMPLITUDE_STEP = 1
export const ELDORA_HACKER_SOURCE_SPEED_MIN = 0.05
export const ELDORA_HACKER_SOURCE_SPEED_MAX = 3
export const ELDORA_HACKER_DISPLAY_SPEED_MIN = 1
export const ELDORA_HACKER_DISPLAY_SPEED_MAX = 100
export const ELDORA_HACKER_DISPLAY_SPEED_STEP = 1
export const CHAMAAC_SYNTHESIS_SPEED_BASE = 0.4
export const CHAMAAC_SYNTHESIS_DISPLAY_SPEED_MIN = 0.01
export const CHAMAAC_SYNTHESIS_DISPLAY_SPEED_MAX = 5
export const CHAMAAC_SYNTHESIS_DISPLAY_SPEED_STEP = 0.01

// Astral Flow stores the source shader multiplier, but the UI uses a compact
// percentage scale where the source range 0.1-3 maps to 10%-100%.
export function getChamaacAstralFlowDisplaySpeed(sourceSpeed: number) {
  const clampedSpeed = Math.min(
    CHAMAAC_ASTRAL_FLOW_SOURCE_SPEED_MAX,
    Math.max(CHAMAAC_ASTRAL_FLOW_SOURCE_SPEED_MIN, sourceSpeed),
  )
  const sourceRange = CHAMAAC_ASTRAL_FLOW_SOURCE_SPEED_MAX - CHAMAAC_ASTRAL_FLOW_SOURCE_SPEED_MIN
  const displayRange = CHAMAAC_ASTRAL_FLOW_DISPLAY_SPEED_MAX - CHAMAAC_ASTRAL_FLOW_DISPLAY_SPEED_MIN
  return Math.round(
    CHAMAAC_ASTRAL_FLOW_DISPLAY_SPEED_MIN
      + ((clampedSpeed - CHAMAAC_ASTRAL_FLOW_SOURCE_SPEED_MIN) / sourceRange) * displayRange,
  )
}

export function getChamaacAstralFlowSourceSpeed(displaySpeed: number) {
  const clampedDisplay = Math.min(
    CHAMAAC_ASTRAL_FLOW_DISPLAY_SPEED_MAX,
    Math.max(CHAMAAC_ASTRAL_FLOW_DISPLAY_SPEED_MIN, displaySpeed),
  )
  const sourceRange = CHAMAAC_ASTRAL_FLOW_SOURCE_SPEED_MAX - CHAMAAC_ASTRAL_FLOW_SOURCE_SPEED_MIN
  const displayRange = CHAMAAC_ASTRAL_FLOW_DISPLAY_SPEED_MAX - CHAMAAC_ASTRAL_FLOW_DISPLAY_SPEED_MIN
  return Math.round(
    (
      CHAMAAC_ASTRAL_FLOW_SOURCE_SPEED_MIN
      + ((clampedDisplay - CHAMAAC_ASTRAL_FLOW_DISPLAY_SPEED_MIN) / displayRange) * sourceRange
    ) * 1000,
  ) / 1000
}

// Deep Space Nebula stores the source shader multiplier, while the UI maps the
// Chamaac source range 0.1-5 to a 1%-100% slider.
export function getChamaacDeepSpaceNebulaDisplaySpeed(sourceSpeed: number) {
  const clampedSpeed = Math.min(
    CHAMAAC_DEEP_SPACE_NEBULA_SOURCE_SPEED_MAX,
    Math.max(CHAMAAC_DEEP_SPACE_NEBULA_SOURCE_SPEED_MIN, sourceSpeed),
  )
  const sourceRange = CHAMAAC_DEEP_SPACE_NEBULA_SOURCE_SPEED_MAX - CHAMAAC_DEEP_SPACE_NEBULA_SOURCE_SPEED_MIN
  const displayRange = CHAMAAC_DEEP_SPACE_NEBULA_DISPLAY_SPEED_MAX - CHAMAAC_DEEP_SPACE_NEBULA_DISPLAY_SPEED_MIN
  return Math.round(
    CHAMAAC_DEEP_SPACE_NEBULA_DISPLAY_SPEED_MIN
      + ((clampedSpeed - CHAMAAC_DEEP_SPACE_NEBULA_SOURCE_SPEED_MIN) / sourceRange) * displayRange,
  )
}

export function getChamaacDeepSpaceNebulaSourceSpeed(displaySpeed: number) {
  const clampedDisplay = Math.min(
    CHAMAAC_DEEP_SPACE_NEBULA_DISPLAY_SPEED_MAX,
    Math.max(CHAMAAC_DEEP_SPACE_NEBULA_DISPLAY_SPEED_MIN, displaySpeed),
  )
  const sourceRange = CHAMAAC_DEEP_SPACE_NEBULA_SOURCE_SPEED_MAX - CHAMAAC_DEEP_SPACE_NEBULA_SOURCE_SPEED_MIN
  const displayRange = CHAMAAC_DEEP_SPACE_NEBULA_DISPLAY_SPEED_MAX - CHAMAAC_DEEP_SPACE_NEBULA_DISPLAY_SPEED_MIN
  return Math.round(
    (
      CHAMAAC_DEEP_SPACE_NEBULA_SOURCE_SPEED_MIN
      + ((clampedDisplay - CHAMAAC_DEEP_SPACE_NEBULA_DISPLAY_SPEED_MIN) / displayRange) * sourceRange
    ) * 1000,
  ) / 1000
}

// Grid Bloom stores the Chamaac shader multiplier, while users see 1%-100%.
export function getChamaacGridBloomDisplaySpeed(sourceSpeed: number) {
  const clampedSpeed = Math.min(
    CHAMAAC_GRID_BLOOM_SOURCE_SPEED_MAX,
    Math.max(CHAMAAC_GRID_BLOOM_SOURCE_SPEED_MIN, sourceSpeed),
  )
  const sourceRange = CHAMAAC_GRID_BLOOM_SOURCE_SPEED_MAX - CHAMAAC_GRID_BLOOM_SOURCE_SPEED_MIN
  const displayRange = CHAMAAC_GRID_BLOOM_DISPLAY_SPEED_MAX - CHAMAAC_GRID_BLOOM_DISPLAY_SPEED_MIN
  return Math.round(
    CHAMAAC_GRID_BLOOM_DISPLAY_SPEED_MIN
      + ((clampedSpeed - CHAMAAC_GRID_BLOOM_SOURCE_SPEED_MIN) / sourceRange) * displayRange,
  )
}

export function getChamaacGridBloomSourceSpeed(displaySpeed: number) {
  const clampedDisplay = Math.min(
    CHAMAAC_GRID_BLOOM_DISPLAY_SPEED_MAX,
    Math.max(CHAMAAC_GRID_BLOOM_DISPLAY_SPEED_MIN, displaySpeed),
  )
  const sourceRange = CHAMAAC_GRID_BLOOM_SOURCE_SPEED_MAX - CHAMAAC_GRID_BLOOM_SOURCE_SPEED_MIN
  const displayRange = CHAMAAC_GRID_BLOOM_DISPLAY_SPEED_MAX - CHAMAAC_GRID_BLOOM_DISPLAY_SPEED_MIN
  return Math.round(
    (
      CHAMAAC_GRID_BLOOM_SOURCE_SPEED_MIN
      + ((clampedDisplay - CHAMAAC_GRID_BLOOM_DISPLAY_SPEED_MIN) / displayRange) * sourceRange
    ) * 1000,
  ) / 1000
}

// Liquid Chrome stores the source shader values; users see 1%-100% sliders.
export function getChamaacLiquidChromeDisplayFlowSpeed(sourceSpeed: number) {
  const clampedSpeed = Math.min(
    CHAMAAC_LIQUID_CHROME_SOURCE_FLOW_SPEED_MAX,
    Math.max(CHAMAAC_LIQUID_CHROME_SOURCE_FLOW_SPEED_MIN, sourceSpeed),
  )
  const sourceRange =
    CHAMAAC_LIQUID_CHROME_SOURCE_FLOW_SPEED_MAX - CHAMAAC_LIQUID_CHROME_SOURCE_FLOW_SPEED_MIN
  const displayRange =
    CHAMAAC_LIQUID_CHROME_DISPLAY_FLOW_SPEED_MAX - CHAMAAC_LIQUID_CHROME_DISPLAY_FLOW_SPEED_MIN
  return Math.round(
    CHAMAAC_LIQUID_CHROME_DISPLAY_FLOW_SPEED_MIN
      + ((clampedSpeed - CHAMAAC_LIQUID_CHROME_SOURCE_FLOW_SPEED_MIN) / sourceRange) * displayRange,
  )
}

export function getChamaacLiquidChromeSourceFlowSpeed(displaySpeed: number) {
  const clampedDisplay = Math.min(
    CHAMAAC_LIQUID_CHROME_DISPLAY_FLOW_SPEED_MAX,
    Math.max(CHAMAAC_LIQUID_CHROME_DISPLAY_FLOW_SPEED_MIN, displaySpeed),
  )
  const sourceRange =
    CHAMAAC_LIQUID_CHROME_SOURCE_FLOW_SPEED_MAX - CHAMAAC_LIQUID_CHROME_SOURCE_FLOW_SPEED_MIN
  const displayRange =
    CHAMAAC_LIQUID_CHROME_DISPLAY_FLOW_SPEED_MAX - CHAMAAC_LIQUID_CHROME_DISPLAY_FLOW_SPEED_MIN
  return Math.round(
    (
      CHAMAAC_LIQUID_CHROME_SOURCE_FLOW_SPEED_MIN
      + ((clampedDisplay - CHAMAAC_LIQUID_CHROME_DISPLAY_FLOW_SPEED_MIN) / displayRange) * sourceRange
    ) * 1000,
  ) / 1000
}

export function getChamaacLiquidChromeDisplayTimeScale(sourceTimeScale: number) {
  const clampedTimeScale = Math.min(
    CHAMAAC_LIQUID_CHROME_SOURCE_TIME_SCALE_MAX,
    Math.max(CHAMAAC_LIQUID_CHROME_SOURCE_TIME_SCALE_MIN, sourceTimeScale),
  )
  const sourceRange =
    CHAMAAC_LIQUID_CHROME_SOURCE_TIME_SCALE_MAX - CHAMAAC_LIQUID_CHROME_SOURCE_TIME_SCALE_MIN
  const displayRange =
    CHAMAAC_LIQUID_CHROME_DISPLAY_TIME_SCALE_MAX - CHAMAAC_LIQUID_CHROME_DISPLAY_TIME_SCALE_MIN
  return Math.round(
    CHAMAAC_LIQUID_CHROME_DISPLAY_TIME_SCALE_MIN
      + ((clampedTimeScale - CHAMAAC_LIQUID_CHROME_SOURCE_TIME_SCALE_MIN) / sourceRange) * displayRange,
  )
}

export function getChamaacLiquidChromeSourceTimeScale(displayTimeScale: number) {
  const clampedDisplay = Math.min(
    CHAMAAC_LIQUID_CHROME_DISPLAY_TIME_SCALE_MAX,
    Math.max(CHAMAAC_LIQUID_CHROME_DISPLAY_TIME_SCALE_MIN, displayTimeScale),
  )
  const sourceRange =
    CHAMAAC_LIQUID_CHROME_SOURCE_TIME_SCALE_MAX - CHAMAAC_LIQUID_CHROME_SOURCE_TIME_SCALE_MIN
  const displayRange =
    CHAMAAC_LIQUID_CHROME_DISPLAY_TIME_SCALE_MAX - CHAMAAC_LIQUID_CHROME_DISPLAY_TIME_SCALE_MIN
  return Math.round(
    (
      CHAMAAC_LIQUID_CHROME_SOURCE_TIME_SCALE_MIN
      + ((clampedDisplay - CHAMAAC_LIQUID_CHROME_DISPLAY_TIME_SCALE_MIN) / displayRange) * sourceRange
    ) * 1000,
  ) / 1000
}

// Waves stores the Chamaac source speed values; users see 1%-100%.
export function getChamaacWavesDisplaySpeed(sourceSpeed: number) {
  const clampedSpeed = Math.min(
    CHAMAAC_WAVES_SOURCE_SPEED_MAX,
    Math.max(CHAMAAC_WAVES_SOURCE_SPEED_MIN, sourceSpeed),
  )
  const sourceRange = CHAMAAC_WAVES_SOURCE_SPEED_MAX - CHAMAAC_WAVES_SOURCE_SPEED_MIN
  const displayRange = CHAMAAC_WAVES_DISPLAY_SPEED_MAX - CHAMAAC_WAVES_DISPLAY_SPEED_MIN
  return Math.round(
    CHAMAAC_WAVES_DISPLAY_SPEED_MIN
      + ((clampedSpeed - CHAMAAC_WAVES_SOURCE_SPEED_MIN) / sourceRange) * displayRange,
  )
}

export function getChamaacWavesSourceSpeed(displaySpeed: number) {
  const clampedDisplay = Math.min(
    CHAMAAC_WAVES_DISPLAY_SPEED_MAX,
    Math.max(CHAMAAC_WAVES_DISPLAY_SPEED_MIN, displaySpeed),
  )
  const sourceRange = CHAMAAC_WAVES_SOURCE_SPEED_MAX - CHAMAAC_WAVES_SOURCE_SPEED_MIN
  const displayRange = CHAMAAC_WAVES_DISPLAY_SPEED_MAX - CHAMAAC_WAVES_DISPLAY_SPEED_MIN
  return Math.round(
    (
      CHAMAAC_WAVES_SOURCE_SPEED_MIN
      + ((clampedDisplay - CHAMAAC_WAVES_DISPLAY_SPEED_MIN) / displayRange) * sourceRange
    ) * 10000,
  ) / 10000
}

// Novatrix keeps Eldora's source speed/amplitude values but presents simple
// percentages so the slowest slider positions are visibly calm.
export function getEldoraNovatrixDisplaySpeed(sourceSpeed: number) {
  const clampedSpeed = Math.min(
    ELDORA_NOVATRIX_SOURCE_SPEED_MAX,
    Math.max(ELDORA_NOVATRIX_SOURCE_SPEED_MIN, sourceSpeed),
  )
  const sourceRange = ELDORA_NOVATRIX_SOURCE_SPEED_MAX - ELDORA_NOVATRIX_SOURCE_SPEED_MIN
  const displayRange = ELDORA_NOVATRIX_DISPLAY_SPEED_MAX - ELDORA_NOVATRIX_DISPLAY_SPEED_MIN
  return Math.round(
    ELDORA_NOVATRIX_DISPLAY_SPEED_MIN
      + ((clampedSpeed - ELDORA_NOVATRIX_SOURCE_SPEED_MIN) / sourceRange) * displayRange,
  )
}

export function getEldoraNovatrixSourceSpeed(displaySpeed: number) {
  const clampedDisplay = Math.min(
    ELDORA_NOVATRIX_DISPLAY_SPEED_MAX,
    Math.max(ELDORA_NOVATRIX_DISPLAY_SPEED_MIN, displaySpeed),
  )
  const sourceRange = ELDORA_NOVATRIX_SOURCE_SPEED_MAX - ELDORA_NOVATRIX_SOURCE_SPEED_MIN
  const displayRange = ELDORA_NOVATRIX_DISPLAY_SPEED_MAX - ELDORA_NOVATRIX_DISPLAY_SPEED_MIN
  return Math.round(
    (
      ELDORA_NOVATRIX_SOURCE_SPEED_MIN
      + ((clampedDisplay - ELDORA_NOVATRIX_DISPLAY_SPEED_MIN) / displayRange) * sourceRange
    ) * 1000,
  ) / 1000
}

export function getEldoraNovatrixDisplayAmplitude(sourceAmplitude: number) {
  const clampedAmplitude = Math.min(
    ELDORA_NOVATRIX_SOURCE_AMPLITUDE_MAX,
    Math.max(ELDORA_NOVATRIX_SOURCE_AMPLITUDE_MIN, sourceAmplitude),
  )
  const sourceRange = ELDORA_NOVATRIX_SOURCE_AMPLITUDE_MAX - ELDORA_NOVATRIX_SOURCE_AMPLITUDE_MIN
  const displayRange = ELDORA_NOVATRIX_DISPLAY_AMPLITUDE_MAX - ELDORA_NOVATRIX_DISPLAY_AMPLITUDE_MIN
  return Math.round(
    ELDORA_NOVATRIX_DISPLAY_AMPLITUDE_MIN
      + ((clampedAmplitude - ELDORA_NOVATRIX_SOURCE_AMPLITUDE_MIN) / sourceRange) * displayRange,
  )
}

export function getEldoraNovatrixSourceAmplitude(displayAmplitude: number) {
  const clampedDisplay = Math.min(
    ELDORA_NOVATRIX_DISPLAY_AMPLITUDE_MAX,
    Math.max(ELDORA_NOVATRIX_DISPLAY_AMPLITUDE_MIN, displayAmplitude),
  )
  const sourceRange = ELDORA_NOVATRIX_SOURCE_AMPLITUDE_MAX - ELDORA_NOVATRIX_SOURCE_AMPLITUDE_MIN
  const displayRange = ELDORA_NOVATRIX_DISPLAY_AMPLITUDE_MAX - ELDORA_NOVATRIX_DISPLAY_AMPLITUDE_MIN
  return Math.round(
    (
      ELDORA_NOVATRIX_SOURCE_AMPLITUDE_MIN
      + ((clampedDisplay - ELDORA_NOVATRIX_DISPLAY_AMPLITUDE_MIN) / displayRange) * sourceRange
    ) * 1000,
  ) / 1000
}

// Hacker Background stores Eldora's source speed multiplier; the UI maps it to
// a 1%-100% slider with a deliberately slow low end.
export function getEldoraHackerDisplaySpeed(sourceSpeed: number) {
  const clampedSpeed = Math.min(
    ELDORA_HACKER_SOURCE_SPEED_MAX,
    Math.max(ELDORA_HACKER_SOURCE_SPEED_MIN, sourceSpeed),
  )
  const sourceRange = ELDORA_HACKER_SOURCE_SPEED_MAX - ELDORA_HACKER_SOURCE_SPEED_MIN
  const displayRange = ELDORA_HACKER_DISPLAY_SPEED_MAX - ELDORA_HACKER_DISPLAY_SPEED_MIN
  return Math.round(
    ELDORA_HACKER_DISPLAY_SPEED_MIN
      + ((clampedSpeed - ELDORA_HACKER_SOURCE_SPEED_MIN) / sourceRange) * displayRange,
  )
}

export function getEldoraHackerSourceSpeed(displaySpeed: number) {
  const clampedDisplay = Math.min(
    ELDORA_HACKER_DISPLAY_SPEED_MAX,
    Math.max(ELDORA_HACKER_DISPLAY_SPEED_MIN, displaySpeed),
  )
  const sourceRange = ELDORA_HACKER_SOURCE_SPEED_MAX - ELDORA_HACKER_SOURCE_SPEED_MIN
  const displayRange = ELDORA_HACKER_DISPLAY_SPEED_MAX - ELDORA_HACKER_DISPLAY_SPEED_MIN
  return Math.round(
    (
      ELDORA_HACKER_SOURCE_SPEED_MIN
      + ((clampedDisplay - ELDORA_HACKER_DISPLAY_SPEED_MIN) / displayRange) * sourceRange
    ) * 1000,
  ) / 1000
}

// The source Chamaac demo defaults to 0.4; MassageLab presents that as 1x.
export function getChamaacSynthesisDisplaySpeed(sourceSpeed: number) {
  return Math.round((sourceSpeed / CHAMAAC_SYNTHESIS_SPEED_BASE) * 100) / 100
}

export function getChamaacSynthesisSourceSpeed(displaySpeed: number) {
  return Math.round(displaySpeed * CHAMAAC_SYNTHESIS_SPEED_BASE * 1000) / 1000
}

export interface ChimerSettings {
  hours: number
  minutes: number
  intervalType: "preset" | "custom" | "areas"
  customInterval: number
  areasToMassage: number
  alertType: "chime" | "flash" | "both" | "silent"
  movingBackgroundEnabled: boolean
  backgroundId: BackgroundId
  keepTimerScreenAwake: boolean
  showTimerSeconds: boolean
  showCurrentTimeSeconds: boolean
  timeFormat: "12h" | "24h"
  primaryFontColor: string
  secondaryFontColor: string
  clockModeFontColor: string
  movingBackgroundMainColor: string
  movingBackgroundOrbColor: string
  sparklesMaxSize: number
  sparklesMinSize: number
  sparklesParticleColor: string
  sparklesParticleDensity: number
  sparklesSpeed: number
  gradientAnimationBackgroundStartColor: string
  gradientAnimationBackgroundEndColor: string
  gradientAnimationFirstColor: string
  gradientAnimationSecondColor: string
  gradientAnimationThirdColor: string
  gradientAnimationFourthColor: string
  gradientAnimationFifthColor: string
  gradientAnimationSpeed: number
  gradientAnimationSize: number
  animateUiGradientPrimaryColor: string
  animateUiGradientHarmony: AnimateUiGradientHarmony
  animateUiGradientOpacity: number
  animateUiStarsColor: string
  animateUiStarsSpeed: number
  animateUiStarsDensity: number
  animateUiStarsParallax: number
  animateUiHoleStrokeColor: string
  animateUiHoleParticleColor: string
  animateUiHoleLineCount: number
  animateUiHoleDiscCount: number
  chamaacLightSpeedWarpSpeed: number
  chamaacLightSpeedWarpSpeedVersion: number
  chamaacLightSpeedParticleCount: number
  chamaacLightSpeedLightColor: string
  chamaacLightSpeedIntensity: number
  chamaacLightSpeedRadius: number
  chamaacLightSpeedCylinderLength: number
  chamaacElectricMistColor: string
  chamaacElectricMistSpeed: number
  chamaacElectricMistControlVersion: number
  chamaacElectricMistDetail: number
  chamaacElectricMistDistortion: number
  chamaacElectricMistBrightness: number
  chamaacAstralFlowPaletteMode: ChamaacAstralFlowPaletteMode
  chamaacAstralFlowPrimaryColor: string
  chamaacAstralFlowHarmony: ColorHarmony
  chamaacAstralFlowColorOne: string
  chamaacAstralFlowColorTwo: string
  chamaacAstralFlowColorThree: string
  chamaacAstralFlowSpeed: number
  chamaacAstralFlowFlowMin: number
  chamaacAstralFlowFlowMax: number
  chamaacDeepSpaceNebulaPaletteMode: ChamaacDeepSpaceNebulaPaletteMode
  chamaacDeepSpaceNebulaPrimaryColor: string
  chamaacDeepSpaceNebulaHarmony: ColorHarmony
  chamaacDeepSpaceNebulaColorOne: string
  chamaacDeepSpaceNebulaColorTwo: string
  chamaacDeepSpaceNebulaColorThree: string
  chamaacDeepSpaceNebulaSpeed: number
  chamaacGridBloomColor: string
  chamaacGridBloomSpeed: number
  chamaacGridBloomGridScale: number
  chamaacGridBloomRotationSpeed: number
  chamaacGridBloomFadeFalloff: number
  chamaacGridBloomDistortionAmount: number
  chamaacGridBloomFlowSpeedX: number
  chamaacGridBloomFlowSpeedY: number
  chamaacLiquidChromePaletteMode: ChamaacLiquidChromePaletteMode
  chamaacLiquidChromePrimaryColor: string
  chamaacLiquidChromeHarmony: ColorHarmony
  chamaacLiquidChromeColorOne: string
  chamaacLiquidChromeColorTwo: string
  chamaacLiquidChromeFlowSpeed: number
  chamaacLiquidChromeTimeScale: number
  chamaacWavesPaletteMode: ChamaacWavesPaletteMode
  chamaacWavesPrimaryColor: string
  chamaacWavesHarmony: ColorHarmony
  chamaacWavesBackgroundColor: string
  chamaacWavesColorOne: string
  chamaacWavesColorTwo: string
  chamaacWavesColorThree: string
  chamaacWavesSpeedX: number
  chamaacWavesSpeedY: number
  chamaacWavesAmplitude: number
  eldoraNovatrixPaletteMode: EldoraNovatrixPaletteMode
  eldoraNovatrixPrimaryColor: string
  eldoraNovatrixHarmony: ColorHarmony
  eldoraNovatrixColor: string
  eldoraNovatrixSpeed: number
  eldoraNovatrixAmplitude: number
  eldoraHackerPaletteMode: EldoraHackerPaletteMode
  eldoraHackerPrimaryColor: string
  eldoraHackerHarmony: ColorHarmony
  eldoraHackerColor: string
  eldoraHackerSpeed: number
  eldoraHackerFontSize: number
  chamaacSynthesisPaletteMode: ChamaacSynthesisPaletteMode
  chamaacSynthesisPrimaryColor: string
  chamaacSynthesisHarmony: ColorHarmony
  chamaacSynthesisColorOne: string
  chamaacSynthesisColorTwo: string
  chamaacSynthesisColorThree: string
  chamaacSynthesisSpeed: number
  chamaacSynthesisComplexity: number
  chamaacSynthesisScale: number
  chamaacSynthesisDistortion: number
  chamaacSynthesisGlowIntensity: number
  chamaacSynthesisFlowFrequency: number
  backgroundLinesDuration: number
  shootingStarsStarColor: string
  shootingStarsTrailColor: string
  shootingStarsShootingStarColor: string
  shootingStarsDensity: number
  shootingStarsTwinkle: boolean
  shootingStarsTwinkleSpeed: number
  shootingStarsShootingSpeed: number
  shootingStarsFrequency: number
  canvasRevealDotsBackgroundColor: string
  canvasRevealDotsDotColor: string
  canvasRevealDotsAccentColor: string
  canvasRevealDotsDotSize: number
  canvasRevealDotsDotSpacing: number
  canvasRevealDotsOpacity: number
  canvasRevealDotsAnimationSpeed: number
  canvasRevealDotsShowGradient: boolean
  spotlightColor: string
  spotlightOpacity: number
  spotlightWidth: number
  spotlightHeight: number
  spotlightSmallWidth: number
  spotlightTranslateY: number
  spotlightDuration: number
  spotlightXOffset: number
  lampBackgroundColor: string
  lampColor: string
  lampGlowOpacity: number
  lampBeamWidth: number
  lampGlowWidth: number
  lampVerticalOffset: number
  lampPulseSpeed: number
  vortexBackgroundColor: string
  vortexBaseHue: number
  vortexParticleCount: number
  vortexRangeY: number
  vortexBaseSpeed: number
  vortexRangeSpeed: number
  vortexBaseRadius: number
  vortexRangeRadius: number
  wavyBackgroundFill: string
  wavyColorOne: string
  wavyColorTwo: string
  wavyColorThree: string
  wavyColorFour: string
  wavyColorFive: string
  wavyWaveWidth: number
  wavyBlur: number
  wavySpeed: "slow" | "fast"
  wavyWaveOpacity: number
  auroraBarsBackgroundColor: string
  auroraBarsPaletteMode: "auto" | "custom"
  auroraBarsPrimaryColor: string
  auroraBarsColorOne: string
  auroraBarsColorTwo: string
  auroraBarsColorThree: string
  auroraBarsColorFour: string
  auroraBarsColorFive: string
  auroraBarsBarCount: number
  auroraBarsSpeed: number
  auroraBarsBlur: number
  auroraBarsGap: number
  auroraBarsMaxHeightRatio: number
  auroraBarsMinHeightRatio: number
  pixelLiquidBackgroundColor: string
  pixelLiquidBaseColor: string
  pixelLiquidAccentColor: string
  pixelLiquidHighlightColor: string
  pixelLiquidPixelSize: number
  pixelLiquidDetail: "low" | "medium" | "high"
  pixelLiquidMotionSpeed: number
  tileGridPaletteMode: "auto" | "custom"
  tileGridPrimaryColor: string
  tileGridColorOne: string
  tileGridColorTwo: string
  tileGridColorThree: string
  tileGridColorFour: string
  tileGridColorFive: string
  tileGridTileSize: number
  tileGridJointSize: number
  tileGridChangeFrequency: number
  tileGridActivePercent: number
  tileGridOpacity: number
  hexGridPrimaryColor: string
  hexGridHarmony: ColorHarmony
  hexGridHexSize: number
  hexGridJointSize: number
  hexGridChangeFrequency: number
  hexGridActivePercent: number
  hexGridOpacity: number
}

type ChamaacAstralFlowColorSettings = Pick<
  ChimerSettings,
  | "chamaacAstralFlowPaletteMode"
  | "chamaacAstralFlowPrimaryColor"
  | "chamaacAstralFlowHarmony"
  | "chamaacAstralFlowColorOne"
  | "chamaacAstralFlowColorTwo"
  | "chamaacAstralFlowColorThree"
>

type ChamaacDeepSpaceNebulaColorSettings = Pick<
  ChimerSettings,
  | "chamaacDeepSpaceNebulaPaletteMode"
  | "chamaacDeepSpaceNebulaPrimaryColor"
  | "chamaacDeepSpaceNebulaHarmony"
  | "chamaacDeepSpaceNebulaColorOne"
  | "chamaacDeepSpaceNebulaColorTwo"
  | "chamaacDeepSpaceNebulaColorThree"
>

type ChamaacSynthesisColorSettings = Pick<
  ChimerSettings,
  | "chamaacSynthesisPaletteMode"
  | "chamaacSynthesisPrimaryColor"
  | "chamaacSynthesisHarmony"
  | "chamaacSynthesisColorOne"
  | "chamaacSynthesisColorTwo"
  | "chamaacSynthesisColorThree"
>

type ChamaacLiquidChromeColorSettings = Pick<
  ChimerSettings,
  | "chamaacLiquidChromePaletteMode"
  | "chamaacLiquidChromePrimaryColor"
  | "chamaacLiquidChromeHarmony"
  | "chamaacLiquidChromeColorOne"
  | "chamaacLiquidChromeColorTwo"
>

type ChamaacWavesColorSettings = Pick<
  ChimerSettings,
  | "chamaacWavesPaletteMode"
  | "chamaacWavesPrimaryColor"
  | "chamaacWavesHarmony"
  | "chamaacWavesBackgroundColor"
  | "chamaacWavesColorOne"
  | "chamaacWavesColorTwo"
  | "chamaacWavesColorThree"
>

type EldoraNovatrixColorSettings = Pick<
  ChimerSettings,
  | "eldoraNovatrixPaletteMode"
  | "eldoraNovatrixPrimaryColor"
  | "eldoraNovatrixHarmony"
  | "eldoraNovatrixColor"
>

type EldoraHackerColorSettings = Pick<
  ChimerSettings,
  | "eldoraHackerPaletteMode"
  | "eldoraHackerPrimaryColor"
  | "eldoraHackerHarmony"
  | "eldoraHackerColor"
>

export function resolveChamaacAstralFlowColors(settings: ChamaacAstralFlowColorSettings): [string, string, string] {
  if (settings.chamaacAstralFlowPaletteMode === "harmony") {
    return createChamaacSynthesisHarmonyPalette(
      settings.chamaacAstralFlowPrimaryColor,
      settings.chamaacAstralFlowHarmony,
    )
  }

  return [
    settings.chamaacAstralFlowColorOne,
    settings.chamaacAstralFlowColorTwo,
    settings.chamaacAstralFlowColorThree,
  ]
}

export function resolveChamaacDeepSpaceNebulaColors(
  settings: ChamaacDeepSpaceNebulaColorSettings,
): [string, string, string] {
  if (settings.chamaacDeepSpaceNebulaPaletteMode === "harmony") {
    return createChamaacDeepSpaceNebulaHarmonyPalette(
      settings.chamaacDeepSpaceNebulaPrimaryColor,
      settings.chamaacDeepSpaceNebulaHarmony,
    )
  }

  return [
    settings.chamaacDeepSpaceNebulaColorOne,
    settings.chamaacDeepSpaceNebulaColorTwo,
    settings.chamaacDeepSpaceNebulaColorThree,
  ]
}

export function resolveChamaacSynthesisColors(settings: ChamaacSynthesisColorSettings): [string, string, string] {
  if (settings.chamaacSynthesisPaletteMode === "harmony") {
    return createChamaacSynthesisHarmonyPalette(
      settings.chamaacSynthesisPrimaryColor,
      settings.chamaacSynthesisHarmony,
    )
  }

  return [
    settings.chamaacSynthesisColorOne,
    settings.chamaacSynthesisColorTwo,
    settings.chamaacSynthesisColorThree,
  ]
}

export function resolveChamaacLiquidChromeColors(settings: ChamaacLiquidChromeColorSettings): [string, string] {
  if (settings.chamaacLiquidChromePaletteMode === "harmony") {
    return createChamaacLiquidChromeHarmonyPalette(
      settings.chamaacLiquidChromePrimaryColor,
      settings.chamaacLiquidChromeHarmony,
    )
  }

  return [
    settings.chamaacLiquidChromeColorOne,
    settings.chamaacLiquidChromeColorTwo,
  ]
}

export function resolveChamaacWavesColors(settings: ChamaacWavesColorSettings): [string, string, string, string] {
  if (settings.chamaacWavesPaletteMode === "harmony") {
    return createChamaacWavesHarmonyPalette(
      settings.chamaacWavesPrimaryColor,
      settings.chamaacWavesHarmony,
    )
  }

  return [
    settings.chamaacWavesBackgroundColor,
    settings.chamaacWavesColorOne,
    settings.chamaacWavesColorTwo,
    settings.chamaacWavesColorThree,
  ]
}

export function resolveEldoraNovatrixColor(settings: EldoraNovatrixColorSettings): string {
  if (settings.eldoraNovatrixPaletteMode === "harmony") {
    return createEldoraNovatrixHarmonyColor(
      settings.eldoraNovatrixPrimaryColor,
      settings.eldoraNovatrixHarmony,
    )
  }

  return settings.eldoraNovatrixColor
}

export function resolveEldoraHackerColor(settings: EldoraHackerColorSettings): string {
  if (settings.eldoraHackerPaletteMode === "harmony") {
    return createEldoraHackerHarmonyColor(
      settings.eldoraHackerPrimaryColor,
      settings.eldoraHackerHarmony,
    )
  }

  return settings.eldoraHackerColor
}

export function createChamaacDeepSpaceNebulaHarmonyPalette(
  primaryColor: string,
  harmony: ColorHarmony,
): [string, string, string] {
  const [hue, saturation, lightness] = rgbToHsl(parseHexColorToRgb(primaryColor))
  const richSaturation = Math.min(0.95, Math.max(0.44, saturation))
  const cloudLightness = Math.min(0.48, Math.max(0.25, lightness))
  const highlightLightness = Math.min(0.78, Math.max(0.56, cloudLightness + 0.28))
  const deepLightness = Math.min(0.16, Math.max(0.05, cloudLightness * 0.32))

  switch (harmony) {
    case "complementary":
      return [
        hslToHex(hue + 180, Math.min(0.96, richSaturation * 1.05), highlightLightness),
        hslToHex(hue, richSaturation, cloudLightness),
        hslToHex(hue + 12, richSaturation * 0.86, deepLightness),
      ]
    case "split-complementary":
      return [
        hslToHex(hue + 150, Math.min(0.96, richSaturation * 1.04), highlightLightness),
        hslToHex(hue, richSaturation, cloudLightness),
        hslToHex(hue + 210, richSaturation * 0.84, deepLightness),
      ]
    case "triad":
      return [
        hslToHex(hue + 120, Math.min(0.96, richSaturation * 1.02), highlightLightness),
        hslToHex(hue, richSaturation, cloudLightness),
        hslToHex(hue + 240, richSaturation * 0.84, deepLightness),
      ]
    case "square":
      return [
        hslToHex(hue + 90, Math.min(0.94, richSaturation * 0.98), highlightLightness),
        hslToHex(hue, richSaturation, cloudLightness),
        hslToHex(hue + 180, richSaturation * 0.84, deepLightness),
      ]
    case "compound":
      return [
        hslToHex(hue + 182, Math.min(0.96, richSaturation * 1.02), highlightLightness),
        hslToHex(hue - 18, richSaturation * 0.94, cloudLightness),
        hslToHex(hue + 18, richSaturation * 0.84, deepLightness),
      ]
    case "shades":
      return [
        hslToHex(hue, richSaturation * 0.86, highlightLightness),
        hslToHex(hue, richSaturation, cloudLightness),
        hslToHex(hue, richSaturation * 0.9, deepLightness),
      ]
    case "monochromatic":
      return [
        hslToHex(hue, richSaturation * 0.68, highlightLightness),
        hslToHex(hue, richSaturation, cloudLightness),
        hslToHex(hue, richSaturation * 0.88, deepLightness),
      ]
    case "analogous":
    default:
      return [
        hslToHex(hue - 34, Math.min(0.94, richSaturation * 0.96), highlightLightness),
        hslToHex(hue, richSaturation, cloudLightness),
        hslToHex(hue + 34, richSaturation * 0.84, deepLightness),
      ]
  }
}

export function createChamaacSynthesisHarmonyPalette(
  primaryColor: string,
  harmony: ColorHarmony,
): [string, string, string] {
  const [hue, saturation, lightness] = rgbToHsl(parseHexColorToRgb(primaryColor))
  const richSaturation = Math.min(0.92, Math.max(0.42, saturation))
  const darkLightness = Math.min(0.22, Math.max(0.06, lightness * 0.36))
  const midLightness = Math.min(0.36, Math.max(0.16, lightness * 0.68))
  const accentLightness = Math.min(0.68, Math.max(0.42, lightness + 0.12))

  switch (harmony) {
    case "complementary":
      return [
        hslToHex(hue - 8, richSaturation * 0.72, darkLightness),
        hslToHex(hue + 180, richSaturation * 0.88, midLightness),
        hslToHex(hue, richSaturation, accentLightness),
      ]
    case "split-complementary":
      return [
        hslToHex(hue, richSaturation * 0.7, darkLightness),
        hslToHex(hue + 150, richSaturation * 0.88, midLightness),
        hslToHex(hue + 210, richSaturation, accentLightness),
      ]
    case "triad":
      return [
        hslToHex(hue, richSaturation * 0.7, darkLightness),
        hslToHex(hue + 120, richSaturation * 0.88, midLightness),
        hslToHex(hue + 240, richSaturation, accentLightness),
      ]
    case "square":
      return [
        hslToHex(hue, richSaturation * 0.7, darkLightness),
        hslToHex(hue + 90, richSaturation * 0.88, midLightness),
        hslToHex(hue + 180, richSaturation, accentLightness),
      ]
    case "compound":
      return [
        hslToHex(hue - 28, richSaturation * 0.72, darkLightness),
        hslToHex(hue, richSaturation * 0.9, midLightness),
        hslToHex(hue + 178, richSaturation, accentLightness),
      ]
    case "shades":
      return [
        hslToHex(hue, richSaturation * 0.7, darkLightness),
        hslToHex(hue, richSaturation * 0.86, midLightness),
        hslToHex(hue, richSaturation, accentLightness),
      ]
    case "monochromatic":
      return [
        hslToHex(hue, richSaturation * 0.52, darkLightness),
        hslToHex(hue, richSaturation * 0.78, midLightness),
        hslToHex(hue, richSaturation, accentLightness),
      ]
    case "analogous":
    default:
      return [
        hslToHex(hue - 36, richSaturation * 0.72, darkLightness),
        hslToHex(hue + 18, richSaturation * 0.88, midLightness),
        hslToHex(hue, richSaturation, accentLightness),
      ]
  }
}

export function createChamaacWavesHarmonyPalette(
  primaryColor: string,
  harmony: ColorHarmony,
): [string, string, string, string] {
  const [hue, saturation, lightness] = rgbToHsl(parseHexColorToRgb(primaryColor))
  const waveSaturation = Math.min(0.96, Math.max(0.5, saturation))
  const primaryLightness = Math.min(0.42, Math.max(0.24, lightness))
  const highlightLightness = Math.min(0.72, Math.max(0.52, primaryLightness + 0.3))
  const valleyLightness = Math.min(0.12, Math.max(0.02, primaryLightness * 0.28))
  const backgroundLightness = Math.min(0.08, Math.max(0.01, valleyLightness * 0.55))

  switch (harmony) {
    case "complementary":
      return [
        hslToHex(hue + 8, waveSaturation * 0.9, backgroundLightness),
        hslToHex(hue, waveSaturation, primaryLightness),
        hslToHex(hue + 180, Math.min(0.98, waveSaturation * 1.08), highlightLightness),
        hslToHex(hue + 12, waveSaturation * 0.86, valleyLightness),
      ]
    case "split-complementary":
      return [
        hslToHex(hue + 18, waveSaturation * 0.86, backgroundLightness),
        hslToHex(hue, waveSaturation, primaryLightness),
        hslToHex(hue + 150, Math.min(0.98, waveSaturation * 1.05), highlightLightness),
        hslToHex(hue + 210, waveSaturation * 0.84, valleyLightness),
      ]
    case "triad":
      return [
        hslToHex(hue + 240, waveSaturation * 0.82, backgroundLightness),
        hslToHex(hue, waveSaturation, primaryLightness),
        hslToHex(hue + 120, Math.min(0.96, waveSaturation * 1.02), highlightLightness),
        hslToHex(hue + 240, waveSaturation * 0.84, valleyLightness),
      ]
    case "square":
      return [
        hslToHex(hue + 180, waveSaturation * 0.82, backgroundLightness),
        hslToHex(hue, waveSaturation, primaryLightness),
        hslToHex(hue + 90, Math.min(0.94, waveSaturation), highlightLightness),
        hslToHex(hue + 270, waveSaturation * 0.84, valleyLightness),
      ]
    case "compound":
      return [
        hslToHex(hue + 18, waveSaturation * 0.84, backgroundLightness),
        hslToHex(hue - 12, waveSaturation * 0.95, primaryLightness),
        hslToHex(hue + 182, Math.min(0.98, waveSaturation * 1.04), highlightLightness),
        hslToHex(hue + 24, waveSaturation * 0.84, valleyLightness),
      ]
    case "shades":
      return [
        hslToHex(hue, waveSaturation * 0.86, backgroundLightness),
        hslToHex(hue, waveSaturation, primaryLightness),
        hslToHex(hue, Math.min(0.95, waveSaturation * 0.95), highlightLightness),
        hslToHex(hue, waveSaturation * 0.86, valleyLightness),
      ]
    case "monochromatic":
      return [
        hslToHex(hue, waveSaturation * 0.8, backgroundLightness),
        hslToHex(hue, waveSaturation, primaryLightness),
        hslToHex(hue, Math.min(0.96, waveSaturation * 0.9), highlightLightness),
        hslToHex(hue, waveSaturation * 0.82, valleyLightness),
      ]
    case "analogous":
    default:
      return [
        hslToHex(hue - 18, waveSaturation * 0.82, backgroundLightness),
        hslToHex(hue, waveSaturation, primaryLightness),
        hslToHex(hue + 24, Math.min(0.96, waveSaturation * 1.02), highlightLightness),
        hslToHex(hue - 28, waveSaturation * 0.84, valleyLightness),
      ]
  }
}

export function createEldoraNovatrixHarmonyColor(
  primaryColor: string,
  harmony: ColorHarmony,
): string {
  const [hue, saturation, lightness] = rgbToHsl(parseHexColorToRgb(primaryColor))
  const vividSaturation = Math.min(0.95, Math.max(0.42, saturation))
  const balancedLightness = Math.min(0.86, Math.max(0.42, lightness))

  switch (harmony) {
    case "complementary":
      return hslToHex(hue + 180, Math.min(0.92, vividSaturation * 0.92), balancedLightness)
    case "split-complementary":
      return hslToHex(hue + 150, Math.min(0.92, vividSaturation * 0.9), Math.min(0.88, balancedLightness + 0.02))
    case "triad":
      return hslToHex(hue + 120, Math.min(0.94, vividSaturation * 0.95), balancedLightness)
    case "square":
      return hslToHex(hue + 90, Math.min(0.9, vividSaturation * 0.88), Math.min(0.86, balancedLightness + 0.02))
    case "compound":
      return hslToHex(hue + 30, Math.min(0.94, vividSaturation), Math.min(0.86, balancedLightness + 0.03))
    case "shades":
      return hslToHex(hue, Math.min(0.76, vividSaturation * 0.7), Math.min(0.92, balancedLightness + 0.16))
    case "monochromatic":
      return hslToHex(hue, vividSaturation, balancedLightness)
    case "analogous":
    default:
      return hslToHex(hue + 32, Math.min(0.94, vividSaturation * 0.96), Math.min(0.88, balancedLightness + 0.02))
  }
}

export function createEldoraHackerHarmonyColor(
  primaryColor: string,
  harmony: ColorHarmony,
) {
  return createEldoraNovatrixHarmonyColor(primaryColor, harmony)
}

export function createChamaacLiquidChromeHarmonyPalette(
  primaryColor: string,
  harmony: ColorHarmony,
): [string, string] {
  const [hue, saturation, lightness] = rgbToHsl(parseHexColorToRgb(primaryColor))
  const metalSaturation = Math.min(0.62, Math.max(0.04, saturation * 0.72))
  const brightLightness = Math.min(0.82, Math.max(0.54, lightness + 0.16))
  const darkLightness = Math.min(0.34, Math.max(0.08, lightness * 0.38))

  switch (harmony) {
    case "complementary":
      return [
        hslToHex(hue, metalSaturation, brightLightness),
        hslToHex(hue + 180, Math.min(0.68, metalSaturation * 1.18), darkLightness),
      ]
    case "split-complementary":
      return [
        hslToHex(hue, metalSaturation, brightLightness),
        hslToHex(hue + 150, Math.min(0.68, metalSaturation * 1.12), darkLightness),
      ]
    case "triad":
      return [
        hslToHex(hue, metalSaturation, brightLightness),
        hslToHex(hue + 120, Math.min(0.68, metalSaturation * 1.1), darkLightness),
      ]
    case "square":
      return [
        hslToHex(hue + 90, metalSaturation, brightLightness),
        hslToHex(hue + 180, Math.min(0.68, metalSaturation * 1.08), darkLightness),
      ]
    case "compound":
      return [
        hslToHex(hue - 18, metalSaturation, brightLightness),
        hslToHex(hue + 18, Math.min(0.68, metalSaturation * 1.08), darkLightness),
      ]
    case "shades":
      return [
        hslToHex(hue, metalSaturation * 0.7, brightLightness),
        hslToHex(hue, metalSaturation * 0.9, darkLightness),
      ]
    case "monochromatic":
      return [
        hslToHex(hue, metalSaturation * 0.48, brightLightness),
        hslToHex(hue, metalSaturation * 0.76, darkLightness),
      ]
    case "analogous":
    default:
      return [
        hslToHex(hue - 16, metalSaturation, brightLightness),
        hslToHex(hue + 24, Math.min(0.68, metalSaturation * 1.08), darkLightness),
      ]
  }
}

function parseHexColorToRgb(color: string): [number, number, number] {
  const normalized = color.trim().replace("#", "")
  const match = /^[0-9A-Fa-f]{6}$/.test(normalized) ? normalized : "0EA5E9"
  return [
    Number.parseInt(match.slice(0, 2), 16),
    Number.parseInt(match.slice(2, 4), 16),
    Number.parseInt(match.slice(4, 6), 16),
  ]
}

function rgbToHsl([red, green, blue]: [number, number, number]): [number, number, number] {
  const r = red / 255
  const g = green / 255
  const b = blue / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const lightness = (max + min) / 2

  if (max === min) {
    return [0, 0, lightness]
  }

  const delta = max - min
  const saturation = lightness > 0.5
    ? delta / (2 - max - min)
    : delta / (max + min)

  let hue = 0
  if (max === r) {
    hue = ((g - b) / delta + (g < b ? 6 : 0)) * 60
  } else if (max === g) {
    hue = ((b - r) / delta + 2) * 60
  } else {
    hue = ((r - g) / delta + 4) * 60
  }

  return [hue, saturation, lightness]
}

function hslToHex(rawHue: number, saturation: number, lightness: number) {
  const hue = ((rawHue % 360) + 360) % 360
  const s = Math.min(1, Math.max(0, saturation))
  const l = Math.min(1, Math.max(0, lightness))
  const chroma = (1 - Math.abs(2 * l - 1)) * s
  const x = chroma * (1 - Math.abs(((hue / 60) % 2) - 1))
  const match = l - chroma / 2
  let r = 0
  let g = 0
  let b = 0

  if (hue < 60) {
    r = chroma
    g = x
  } else if (hue < 120) {
    r = x
    g = chroma
  } else if (hue < 180) {
    g = chroma
    b = x
  } else if (hue < 240) {
    g = x
    b = chroma
  } else if (hue < 300) {
    r = x
    b = chroma
  } else {
    r = chroma
    b = x
  }

  return `#${[r, g, b]
    .map((channel) => Math.round((channel + match) * 255).toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`
}

type AccountSyncStatus = "checking" | "local" | "synced" | "conflict"

interface SetTimerProps {
  settings: ChimerSettings
  totalDurationMs: number
  error: string | null
  syncStatus: AccountSyncStatus
  isResolvingSync: boolean
  featureKeys: string[]
  backgroundCategory: BackgroundCategory
  onTimeClick: (unit: "hours" | "minutes") => void
  onSettingsChange: (settings: Partial<ChimerSettings>) => void
  onStartTimer: () => void
  onStartClock: () => void
  onTestAlert: () => void
  onUseDeviceSettings: () => void
  onUseSavedSettings: () => void
}

const timerProofs = [
  {
    title: "Treatment-room intervals",
    description: "Set a massage session length and choose preset, custom, or body-area alert pacing.",
    icon: BellRing,
  },
  {
    title: "Full-screen clock mode",
    description: "Switch from a session timer to a simple clock when visibility matters more than alerts.",
    icon: MonitorSmartphone,
  },
  {
    title: "Device-first settings",
    description: "Use Chimer locally, then sign in when you want favorite timer settings to sync.",
    icon: SlidersHorizontal,
  },
] as const

export function SetTimer({
  settings,
  totalDurationMs,
  error,
  syncStatus,
  isResolvingSync,
  featureKeys,
  backgroundCategory,
  onTimeClick,
  onSettingsChange,
  onStartTimer,
  onStartClock,
  onTestAlert,
  onUseDeviceSettings,
  onUseSavedSettings,
}: SetTimerProps) {
  const isTimerSet = totalDurationMs > 0
  const syncMessage = {
    checking: "Checking account sync. Changes stay on this device until sync is available.",
    local: "Settings stay on this device. Sign in or create an account to sync Chimer settings across devices.",
    synced: "You're signed in. Chimer settings sync across devices.",
    conflict: "You're signed in. Choose whether this device or your saved favorites should control Chimer settings.",
  }[syncStatus]
  const renderBackgroundControls = (option: BackgroundDefinition) => {
    if (option.id === "aceternity-gradient-animation") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.colorRow}>
            <span>Base start</span>
            <input
              type="color"
              value={settings.gradientAnimationBackgroundStartColor}
              onChange={(event) => onSettingsChange({ gradientAnimationBackgroundStartColor: event.target.value })}
              aria-label="Gradient animation background start color"
            />
          </label>
          <label className={styles.colorRow}>
            <span>Base end</span>
            <input
              type="color"
              value={settings.gradientAnimationBackgroundEndColor}
              onChange={(event) => onSettingsChange({ gradientAnimationBackgroundEndColor: event.target.value })}
              aria-label="Gradient animation background end color"
            />
          </label>
          <label className={styles.colorRow}>
            <span>Glow 1</span>
            <input
              type="color"
              value={settings.gradientAnimationFirstColor}
              onChange={(event) => onSettingsChange({ gradientAnimationFirstColor: event.target.value })}
              aria-label="Gradient animation first glow color"
            />
          </label>
          <label className={styles.colorRow}>
            <span>Glow 2</span>
            <input
              type="color"
              value={settings.gradientAnimationSecondColor}
              onChange={(event) => onSettingsChange({ gradientAnimationSecondColor: event.target.value })}
              aria-label="Gradient animation second glow color"
            />
          </label>
          <label className={styles.colorRow}>
            <span>Glow 3</span>
            <input
              type="color"
              value={settings.gradientAnimationThirdColor}
              onChange={(event) => onSettingsChange({ gradientAnimationThirdColor: event.target.value })}
              aria-label="Gradient animation third glow color"
            />
          </label>
          <label className={styles.colorRow}>
            <span>Glow 4</span>
            <input
              type="color"
              value={settings.gradientAnimationFourthColor}
              onChange={(event) => onSettingsChange({ gradientAnimationFourthColor: event.target.value })}
              aria-label="Gradient animation fourth glow color"
            />
          </label>
          <label className={styles.colorRow}>
            <span>Glow 5</span>
            <input
              type="color"
              value={settings.gradientAnimationFifthColor}
              onChange={(event) => onSettingsChange({ gradientAnimationFifthColor: event.target.value })}
              aria-label="Gradient animation fifth glow color"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Speed</span>
            <input
              type="range"
              min="0.25"
              max="2.5"
              step="0.25"
              value={settings.gradientAnimationSpeed}
              onChange={(event) => onSettingsChange({ gradientAnimationSpeed: Number(event.target.value) })}
              aria-label="Gradient animation speed"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Glow size</span>
            <input
              type="range"
              min="45"
              max="120"
              step="5"
              value={settings.gradientAnimationSize}
              onChange={(event) => onSettingsChange({ gradientAnimationSize: Number(event.target.value) })}
              aria-label="Gradient animation glow size"
            />
          </label>
        </div>
      )
    }

    if (option.id === "animate-ui-gradient") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.colorRow}>
            <span>Primary color</span>
            <input
              type="color"
              value={settings.animateUiGradientPrimaryColor}
              onChange={(event) => onSettingsChange({ animateUiGradientPrimaryColor: event.target.value })}
              aria-label="Animate UI gradient primary color"
            />
          </label>
          <label className={styles.selectRow}>
            <span>Color harmony</span>
            <select
              value={settings.animateUiGradientHarmony}
              onChange={(event) => onSettingsChange({
                animateUiGradientHarmony: event.target.value as AnimateUiGradientHarmony,
              })}
              aria-label="Animate UI gradient color harmony"
            >
              {ANIMATE_UI_GRADIENT_HARMONY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.rangeRow}>
            <span>Opacity ({Math.round(settings.animateUiGradientOpacity * 100)}%)</span>
            <input
              type="range"
              min="0.15"
              max="1"
              step="0.01"
              value={settings.animateUiGradientOpacity}
              onChange={(event) => onSettingsChange({ animateUiGradientOpacity: Number(event.target.value) })}
              aria-label="Animate UI gradient opacity"
            />
          </label>
        </div>
      )
    }

    if (option.id === "animate-ui-hole") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.colorRow}>
            <span>Grid line color</span>
            <input
              type="color"
              value={settings.animateUiHoleStrokeColor}
              onChange={(event) => onSettingsChange({ animateUiHoleStrokeColor: event.target.value })}
              aria-label="Animate UI Hole grid line color"
            />
          </label>
          <label className={styles.colorRow}>
            <span>Particle color</span>
            <input
              type="color"
              value={settings.animateUiHoleParticleColor}
              onChange={(event) => onSettingsChange({ animateUiHoleParticleColor: event.target.value })}
              aria-label="Animate UI Hole particle color"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Line count ({settings.animateUiHoleLineCount})</span>
            <input
              type="range"
              min="12"
              max="96"
              step="1"
              value={settings.animateUiHoleLineCount}
              onChange={(event) => onSettingsChange({ animateUiHoleLineCount: Number(event.target.value) })}
              aria-label="Animate UI Hole line count"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Disc count ({settings.animateUiHoleDiscCount})</span>
            <input
              type="range"
              min="12"
              max="96"
              step="1"
              value={settings.animateUiHoleDiscCount}
              onChange={(event) => onSettingsChange({ animateUiHoleDiscCount: Number(event.target.value) })}
              aria-label="Animate UI Hole disc count"
            />
          </label>
        </div>
      )
    }

    if (option.id === "animate-ui-stars") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.colorRow}>
            <span>Star color</span>
            <input
              type="color"
              value={settings.animateUiStarsColor}
              onChange={(event) => onSettingsChange({ animateUiStarsColor: event.target.value })}
              aria-label="Animate UI Stars star color"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Speed ({settings.animateUiStarsSpeed}s)</span>
            <input
              type="range"
              min="18"
              max="120"
              step="1"
              value={settings.animateUiStarsSpeed}
              onChange={(event) => onSettingsChange({ animateUiStarsSpeed: Number(event.target.value) })}
              aria-label="Animate UI Stars speed"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Density ({Math.round(settings.animateUiStarsDensity * 100)}%)</span>
            <input
              type="range"
              min="0.25"
              max="1.5"
              step="0.05"
              value={settings.animateUiStarsDensity}
              onChange={(event) => onSettingsChange({ animateUiStarsDensity: Number(event.target.value) })}
              aria-label="Animate UI Stars density"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Parallax ({Math.round(settings.animateUiStarsParallax * 1000) / 10}%)</span>
            <input
              type="range"
              min="0"
              max="0.12"
              step="0.005"
              value={settings.animateUiStarsParallax}
              onChange={(event) => onSettingsChange({ animateUiStarsParallax: Number(event.target.value) })}
              aria-label="Animate UI Stars parallax strength"
            />
          </label>
        </div>
      )
    }

    if (option.id === "aceternity-sparkles") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.colorRow}>
            <span>Sparkle color</span>
            <input
              type="color"
              value={settings.sparklesParticleColor}
              onChange={(event) => onSettingsChange({ sparklesParticleColor: event.target.value })}
              aria-label="Sparkles particle color"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Density</span>
            <input
              type="range"
              min="20"
              max="220"
              step="1"
              value={settings.sparklesParticleDensity}
              onChange={(event) => onSettingsChange({ sparklesParticleDensity: Number(event.target.value) })}
              aria-label="Sparkles particle density"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Speed</span>
            <input
              type="range"
              min="0.5"
              max="8"
              step="0.5"
              value={settings.sparklesSpeed}
              onChange={(event) => onSettingsChange({ sparklesSpeed: Number(event.target.value) })}
              aria-label="Sparkles animation speed"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Size</span>
            <input
              type="range"
              min="1"
              max="6"
              step="0.5"
              value={settings.sparklesMaxSize}
              onChange={(event) => onSettingsChange({ sparklesMaxSize: Number(event.target.value) })}
              aria-label="Sparkles particle size"
            />
          </label>
        </div>
      )
    }

    if (option.id === "aceternity-background-lines") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.rangeRow}>
            <span>Line duration</span>
            <input
              type="range"
              min="4"
              max="18"
              step="1"
              value={settings.backgroundLinesDuration}
              onChange={(event) => onSettingsChange({ backgroundLinesDuration: Number(event.target.value) })}
              aria-label="Background lines animation duration"
            />
          </label>
        </div>
      )
    }

    if (option.id === "aceternity-shooting-stars") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.colorRow}>
            <span>Stars</span>
            <input
              type="color"
              value={settings.shootingStarsStarColor}
              onChange={(event) => onSettingsChange({ shootingStarsStarColor: event.target.value })}
              aria-label="Shooting stars background star color"
            />
          </label>
          <label className={styles.colorRow}>
            <span>Trail</span>
            <input
              type="color"
              value={settings.shootingStarsTrailColor}
              onChange={(event) => onSettingsChange({ shootingStarsTrailColor: event.target.value })}
              aria-label="Shooting stars trail color"
            />
          </label>
          <label className={styles.colorRow}>
            <span>Shooting star</span>
            <input
              type="color"
              value={settings.shootingStarsShootingStarColor}
              onChange={(event) => onSettingsChange({ shootingStarsShootingStarColor: event.target.value })}
              aria-label="Shooting star color"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Star density</span>
            <input
              type="range"
              min="0.00005"
              max="0.00035"
              step="0.00001"
              value={settings.shootingStarsDensity}
              onChange={(event) => onSettingsChange({ shootingStarsDensity: Number(event.target.value) })}
              aria-label="Shooting stars background star density"
            />
          </label>
          <label className={styles.switchRow}>
            <span>Twinkle stars</span>
            <input
              type="checkbox"
              checked={settings.shootingStarsTwinkle}
              onChange={(event) => onSettingsChange({ shootingStarsTwinkle: event.target.checked })}
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Twinkle speed</span>
            <input
              type="range"
              min="0.4"
              max="2.5"
              step="0.1"
              value={settings.shootingStarsTwinkleSpeed}
              onChange={(event) => onSettingsChange({ shootingStarsTwinkleSpeed: Number(event.target.value) })}
              aria-label="Shooting stars twinkle speed"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Shooting speed</span>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={settings.shootingStarsShootingSpeed}
              onChange={(event) => onSettingsChange({ shootingStarsShootingSpeed: Number(event.target.value) })}
              aria-label="Shooting star speed"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Frequency</span>
            <input
              type="range"
              min="0.4"
              max="2"
              step="0.1"
              value={settings.shootingStarsFrequency}
              onChange={(event) => onSettingsChange({ shootingStarsFrequency: Number(event.target.value) })}
              aria-label="Shooting star frequency"
            />
          </label>
        </div>
      )
    }

    if (option.id === "aceternity-wavy-background") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.colorRow}>
            <span>Background</span>
            <input
              type="color"
              value={settings.wavyBackgroundFill}
              onChange={(event) => onSettingsChange({ wavyBackgroundFill: event.target.value })}
              aria-label="Wavy background fill color"
            />
          </label>
          <label className={styles.colorRow}>
            <span>Wave 1</span>
            <input
              type="color"
              value={settings.wavyColorOne}
              onChange={(event) => onSettingsChange({ wavyColorOne: event.target.value })}
              aria-label="Wavy first wave color"
            />
          </label>
          <label className={styles.colorRow}>
            <span>Wave 2</span>
            <input
              type="color"
              value={settings.wavyColorTwo}
              onChange={(event) => onSettingsChange({ wavyColorTwo: event.target.value })}
              aria-label="Wavy second wave color"
            />
          </label>
          <label className={styles.colorRow}>
            <span>Wave 3</span>
            <input
              type="color"
              value={settings.wavyColorThree}
              onChange={(event) => onSettingsChange({ wavyColorThree: event.target.value })}
              aria-label="Wavy third wave color"
            />
          </label>
          <label className={styles.colorRow}>
            <span>Wave 4</span>
            <input
              type="color"
              value={settings.wavyColorFour}
              onChange={(event) => onSettingsChange({ wavyColorFour: event.target.value })}
              aria-label="Wavy fourth wave color"
            />
          </label>
          <label className={styles.colorRow}>
            <span>Wave 5</span>
            <input
              type="color"
              value={settings.wavyColorFive}
              onChange={(event) => onSettingsChange({ wavyColorFive: event.target.value })}
              aria-label="Wavy fifth wave color"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Wave width</span>
            <input
              type="range"
              min="10"
              max="90"
              step="5"
              value={settings.wavyWaveWidth}
              onChange={(event) => onSettingsChange({ wavyWaveWidth: Number(event.target.value) })}
              aria-label="Wavy wave width"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Blur</span>
            <input
              type="range"
              min="0"
              max="20"
              step="1"
              value={settings.wavyBlur}
              onChange={(event) => onSettingsChange({ wavyBlur: Number(event.target.value) })}
              aria-label="Wavy blur"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Opacity</span>
            <input
              type="range"
              min="0.15"
              max="0.85"
              step="0.05"
              value={settings.wavyWaveOpacity}
              onChange={(event) => onSettingsChange({ wavyWaveOpacity: Number(event.target.value) })}
              aria-label="Wavy wave opacity"
            />
          </label>
          <label className={styles.selectRow}>
            <span>Speed</span>
            <select
              value={settings.wavySpeed}
              onChange={(event) => onSettingsChange({ wavySpeed: event.target.value as ChimerSettings["wavySpeed"] })}
              aria-label="Wavy animation speed"
            >
              <option value="slow">Slow</option>
              <option value="fast">Fast</option>
            </select>
          </label>
        </div>
      )
    }

    if (option.id === "unlumen-aurora-bars") {
      const useCustomPalette = settings.auroraBarsPaletteMode === "custom"

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.colorRow}>
            <span>Background</span>
            <input
              type="color"
              value={settings.auroraBarsBackgroundColor}
              onChange={(event) => onSettingsChange({ auroraBarsBackgroundColor: event.target.value })}
              aria-label="Aurora bars background color"
            />
          </label>
          <label className={styles.selectRow}>
            <span>Palette</span>
            <select
              value={settings.auroraBarsPaletteMode}
              onChange={(event) => onSettingsChange({
                auroraBarsPaletteMode: event.target.value as ChimerSettings["auroraBarsPaletteMode"],
              })}
              aria-label="Aurora bars palette mode"
            >
              <option value="auto">Auto monochrome</option>
              <option value="custom">Custom five colors</option>
            </select>
          </label>
          {useCustomPalette ? (
            <>
              <label className={styles.colorRow}>
                <span>Bar color 1</span>
                <input
                  type="color"
                  value={settings.auroraBarsColorOne}
                  onChange={(event) => onSettingsChange({ auroraBarsColorOne: event.target.value })}
                  aria-label="Aurora bars first color"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Bar color 2</span>
                <input
                  type="color"
                  value={settings.auroraBarsColorTwo}
                  onChange={(event) => onSettingsChange({ auroraBarsColorTwo: event.target.value })}
                  aria-label="Aurora bars second color"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Bar color 3</span>
                <input
                  type="color"
                  value={settings.auroraBarsColorThree}
                  onChange={(event) => onSettingsChange({ auroraBarsColorThree: event.target.value })}
                  aria-label="Aurora bars third color"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Bar color 4</span>
                <input
                  type="color"
                  value={settings.auroraBarsColorFour}
                  onChange={(event) => onSettingsChange({ auroraBarsColorFour: event.target.value })}
                  aria-label="Aurora bars fourth color"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Bar color 5</span>
                <input
                  type="color"
                  value={settings.auroraBarsColorFive}
                  onChange={(event) => onSettingsChange({ auroraBarsColorFive: event.target.value })}
                  aria-label="Aurora bars fifth color"
                />
              </label>
            </>
          ) : (
            <label className={styles.colorRow}>
              <span>Primary color</span>
              <input
                type="color"
                value={settings.auroraBarsPrimaryColor}
                onChange={(event) => onSettingsChange({ auroraBarsPrimaryColor: event.target.value })}
                aria-label="Aurora bars primary color"
              />
            </label>
          )}
          <label className={styles.rangeRow}>
            <span>Bars ({settings.auroraBarsBarCount})</span>
            <input
              type="range"
              min="8"
              max="80"
              step="1"
              value={settings.auroraBarsBarCount}
              onChange={(event) => onSettingsChange({ auroraBarsBarCount: Number(event.target.value) })}
              aria-label="Aurora bars bar count"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Speed ({settings.auroraBarsSpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0.08"
              max="2"
              step="0.04"
              value={settings.auroraBarsSpeed}
              onChange={(event) => onSettingsChange({ auroraBarsSpeed: Number(event.target.value) })}
              aria-label="Aurora bars speed"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Blur ({settings.auroraBarsBlur}px)</span>
            <input
              type="range"
              min="0"
              max="18"
              step="1"
              value={settings.auroraBarsBlur}
              onChange={(event) => onSettingsChange({ auroraBarsBlur: Number(event.target.value) })}
              aria-label="Aurora bars blur"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Gap ({settings.auroraBarsGap}px)</span>
            <input
              type="range"
              min="0"
              max="16"
              step="1"
              value={settings.auroraBarsGap}
              onChange={(event) => onSettingsChange({ auroraBarsGap: Number(event.target.value) })}
              aria-label="Aurora bars gap"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Max height ({Math.round(settings.auroraBarsMaxHeightRatio * 100)}%)</span>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.01"
              value={settings.auroraBarsMaxHeightRatio}
              onChange={(event) => onSettingsChange({ auroraBarsMaxHeightRatio: Number(event.target.value) })}
              aria-label="Aurora bars maximum height"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Min height ({Math.round(settings.auroraBarsMinHeightRatio * 100)}%)</span>
            <input
              type="range"
              min="0.04"
              max="0.78"
              step="0.01"
              value={settings.auroraBarsMinHeightRatio}
              onChange={(event) => onSettingsChange({ auroraBarsMinHeightRatio: Number(event.target.value) })}
              aria-label="Aurora bars minimum height"
            />
          </label>
        </div>
      )
    }

    if (option.id === "unlumen-pixel-liquid") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.colorRow}>
            <span>Background color</span>
            <input
              type="color"
              value={settings.pixelLiquidBackgroundColor}
              onChange={(event) => onSettingsChange({ pixelLiquidBackgroundColor: event.target.value })}
              aria-label="Pixel liquid background color"
            />
          </label>
          <label className={styles.colorRow}>
            <span>Base color</span>
            <input
              type="color"
              value={settings.pixelLiquidBaseColor}
              onChange={(event) => onSettingsChange({ pixelLiquidBaseColor: event.target.value })}
              aria-label="Pixel liquid base color"
            />
          </label>
          <label className={styles.colorRow}>
            <span>Accent color</span>
            <input
              type="color"
              value={settings.pixelLiquidAccentColor}
              onChange={(event) => onSettingsChange({ pixelLiquidAccentColor: event.target.value })}
              aria-label="Pixel liquid accent color"
            />
          </label>
          <label className={styles.colorRow}>
            <span>Highlight color</span>
            <input
              type="color"
              value={settings.pixelLiquidHighlightColor}
              onChange={(event) => onSettingsChange({ pixelLiquidHighlightColor: event.target.value })}
              aria-label="Pixel liquid highlight color"
            />
          </label>
          <label className={styles.selectRow}>
            <span>Detail</span>
            <select
              value={settings.pixelLiquidDetail}
              onChange={(event) => onSettingsChange({
                pixelLiquidDetail: event.target.value as ChimerSettings["pixelLiquidDetail"],
              })}
              aria-label="Pixel liquid detail"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
          <label className={styles.rangeRow}>
            <span>Pixel size</span>
            <input
              type="range"
              min="4"
              max="18"
              step="1"
              value={settings.pixelLiquidPixelSize}
              onChange={(event) => onSettingsChange({ pixelLiquidPixelSize: Number(event.target.value) })}
              aria-label="Pixel liquid pixel size"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Motion speed</span>
            <input
              type="range"
              min="0.2"
              max="1.4"
              step="0.05"
              value={settings.pixelLiquidMotionSpeed}
              onChange={(event) => onSettingsChange({ pixelLiquidMotionSpeed: Number(event.target.value) })}
              aria-label="Pixel liquid motion speed"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-tile-grid") {
      const useCustomPalette = settings.tileGridPaletteMode === "custom"

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Palette</span>
            <select
              value={settings.tileGridPaletteMode}
              onChange={(event) => onSettingsChange({
                tileGridPaletteMode: event.target.value as ChimerSettings["tileGridPaletteMode"],
              })}
              aria-label="Tile grid palette mode"
            >
              <option value="auto">Auto from primary</option>
              <option value="custom">Custom five colors</option>
            </select>
          </label>
          {useCustomPalette ? (
            <>
              <label className={styles.colorRow}>
                <span>Color 1</span>
                <input
                  type="color"
                  value={settings.tileGridColorOne}
                  onChange={(event) => onSettingsChange({ tileGridColorOne: event.target.value })}
                  aria-label="Tile grid first color"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Color 2</span>
                <input
                  type="color"
                  value={settings.tileGridColorTwo}
                  onChange={(event) => onSettingsChange({ tileGridColorTwo: event.target.value })}
                  aria-label="Tile grid second color"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Color 3</span>
                <input
                  type="color"
                  value={settings.tileGridColorThree}
                  onChange={(event) => onSettingsChange({ tileGridColorThree: event.target.value })}
                  aria-label="Tile grid third color"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Color 4</span>
                <input
                  type="color"
                  value={settings.tileGridColorFour}
                  onChange={(event) => onSettingsChange({ tileGridColorFour: event.target.value })}
                  aria-label="Tile grid fourth color"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Color 5</span>
                <input
                  type="color"
                  value={settings.tileGridColorFive}
                  onChange={(event) => onSettingsChange({ tileGridColorFive: event.target.value })}
                  aria-label="Tile grid fifth color"
                />
              </label>
            </>
          ) : (
            <label className={styles.colorRow}>
              <span>Primary color</span>
              <input
                type="color"
                value={settings.tileGridPrimaryColor}
                onChange={(event) => onSettingsChange({ tileGridPrimaryColor: event.target.value })}
                aria-label="Tile grid primary color"
              />
            </label>
          )}
          <label className={styles.rangeRow}>
            <span>Tile size ({settings.tileGridTileSize}px)</span>
            <input
              type="range"
              min="18"
              max="120"
              step="2"
              value={settings.tileGridTileSize}
              onChange={(event) => onSettingsChange({ tileGridTileSize: Number(event.target.value) })}
              aria-label="Tile grid tile size"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Joint size ({settings.tileGridJointSize}px)</span>
            <input
              type="range"
              min="1"
              max="10"
              step="1"
              value={settings.tileGridJointSize}
              onChange={(event) => onSettingsChange({ tileGridJointSize: Number(event.target.value) })}
              aria-label="Tile grid joint size"
            />
          </label>
          <TileGridFadeTimeControl
            fadeSeconds={settings.tileGridChangeFrequency}
            onFadeSecondsChange={(tileGridChangeFrequency) => onSettingsChange({ tileGridChangeFrequency })}
            rowClassName={styles.durationRow}
            pickerClassName={styles.durationPicker}
            fieldClassName={styles.durationField}
          />
          <label className={styles.rangeRow}>
            <span>Active tiles ({settings.tileGridActivePercent}%)</span>
            <input
              type="range"
              min="1"
              max="60"
              step="1"
              value={settings.tileGridActivePercent}
              onChange={(event) => onSettingsChange({ tileGridActivePercent: Number(event.target.value) })}
              aria-label="Tile grid active tile percentage"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Tile opacity ({Math.round(settings.tileGridOpacity * 100)}%)</span>
            <input
              type="range"
              min="0.15"
              max="1"
              step="0.01"
              value={settings.tileGridOpacity}
              onChange={(event) => onSettingsChange({ tileGridOpacity: Number(event.target.value) })}
              aria-label="Tile grid tile opacity"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-hex-grid") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.colorRow}>
            <span>Primary color</span>
            <input
              type="color"
              value={settings.hexGridPrimaryColor}
              onChange={(event) => onSettingsChange({ hexGridPrimaryColor: event.target.value })}
              aria-label="Hex grid primary color"
            />
          </label>
          <label className={styles.selectRow}>
            <span>Color harmony</span>
            <select
              value={settings.hexGridHarmony}
              onChange={(event) => onSettingsChange({
                hexGridHarmony: event.target.value as ChimerSettings["hexGridHarmony"],
              })}
              aria-label="Hex grid color harmony"
            >
              {COLOR_HARMONY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.rangeRow}>
            <span>Hex size ({settings.hexGridHexSize}px)</span>
            <input
              type="range"
              min="18"
              max="120"
              step="2"
              value={settings.hexGridHexSize}
              onChange={(event) => onSettingsChange({ hexGridHexSize: Number(event.target.value) })}
              aria-label="Hex grid hex size"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Joint size ({settings.hexGridJointSize}px)</span>
            <input
              type="range"
              min="1"
              max="10"
              step="1"
              value={settings.hexGridJointSize}
              onChange={(event) => onSettingsChange({ hexGridJointSize: Number(event.target.value) })}
              aria-label="Hex grid joint size"
            />
          </label>
          <TileGridFadeTimeControl
            fadeSeconds={settings.hexGridChangeFrequency}
            onFadeSecondsChange={(hexGridChangeFrequency) => onSettingsChange({ hexGridChangeFrequency })}
            rowClassName={styles.durationRow}
            pickerClassName={styles.durationPicker}
            fieldClassName={styles.durationField}
          />
          <label className={styles.rangeRow}>
            <span>Active hexes ({settings.hexGridActivePercent}%)</span>
            <input
              type="range"
              min="1"
              max="60"
              step="1"
              value={settings.hexGridActivePercent}
              onChange={(event) => onSettingsChange({ hexGridActivePercent: Number(event.target.value) })}
              aria-label="Hex grid active hex percentage"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Hex opacity ({Math.round(settings.hexGridOpacity * 100)}%)</span>
            <input
              type="range"
              min="0.15"
              max="1"
              step="0.01"
              value={settings.hexGridOpacity}
              onChange={(event) => onSettingsChange({ hexGridOpacity: Number(event.target.value) })}
              aria-label="Hex grid hex opacity"
            />
          </label>
        </div>
      )
    }

    if (option.id === "chamaac-light-speed") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.colorRow}>
            <span>Light color</span>
            <input
              type="color"
              value={settings.chamaacLightSpeedLightColor}
              onChange={(event) => onSettingsChange({ chamaacLightSpeedLightColor: event.target.value })}
              aria-label="Light Speed light color"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Warp speed ({settings.chamaacLightSpeedWarpSpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0.1"
              max="24"
              step="0.01"
              value={settings.chamaacLightSpeedWarpSpeed}
              onChange={(event) => onSettingsChange({ chamaacLightSpeedWarpSpeed: Number(event.target.value) })}
              aria-label="Light Speed warp speed"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Particles ({settings.chamaacLightSpeedParticleCount})</span>
            <input
              type="range"
              min="20"
              max="200"
              step="5"
              value={settings.chamaacLightSpeedParticleCount}
              onChange={(event) => onSettingsChange({ chamaacLightSpeedParticleCount: Number(event.target.value) })}
              aria-label="Light Speed particle count"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Glow ({settings.chamaacLightSpeedIntensity.toFixed(2)}x)</span>
            <input
              type="range"
              min="0.25"
              max="6"
              step="0.05"
              value={settings.chamaacLightSpeedIntensity}
              onChange={(event) => onSettingsChange({ chamaacLightSpeedIntensity: Number(event.target.value) })}
              aria-label="Light Speed glow intensity"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Tunnel radius ({settings.chamaacLightSpeedRadius}px)</span>
            <input
              type="range"
              min="6"
              max="60"
              step="1"
              value={settings.chamaacLightSpeedRadius}
              onChange={(event) => onSettingsChange({ chamaacLightSpeedRadius: Number(event.target.value) })}
              aria-label="Light Speed tunnel radius"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Field length ({settings.chamaacLightSpeedCylinderLength}px)</span>
            <input
              type="range"
              min="40"
              max="300"
              step="5"
              value={settings.chamaacLightSpeedCylinderLength}
              onChange={(event) => onSettingsChange({ chamaacLightSpeedCylinderLength: Number(event.target.value) })}
              aria-label="Light Speed field length"
            />
          </label>
        </div>
      )
    }

    if (option.id === "chamaac-electric-mist") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.colorRow}>
            <span>Lightning color</span>
            <input
              type="color"
              value={settings.chamaacElectricMistColor}
              onChange={(event) => onSettingsChange({ chamaacElectricMistColor: event.target.value })}
              aria-label="Electric Mist lightning color"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Animation speed ({Math.round(settings.chamaacElectricMistSpeed)}%)</span>
            <input
              type="range"
              min="1"
              max="400"
              step="1"
              value={settings.chamaacElectricMistSpeed}
              onChange={(event) => onSettingsChange({ chamaacElectricMistSpeed: Number(event.target.value) })}
              aria-label="Electric Mist animation speed"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Noise detail ({settings.chamaacElectricMistDetail.toFixed(1)})</span>
            <input
              type="range"
              min="0.5"
              max="4"
              step="0.1"
              value={settings.chamaacElectricMistDetail}
              onChange={(event) => onSettingsChange({ chamaacElectricMistDetail: Number(event.target.value) })}
              aria-label="Electric Mist noise detail"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Distortion ({settings.chamaacElectricMistDistortion.toFixed(1)}x)</span>
            <input
              type="range"
              min="0"
              max="6"
              step="0.1"
              value={settings.chamaacElectricMistDistortion}
              onChange={(event) => onSettingsChange({ chamaacElectricMistDistortion: Number(event.target.value) })}
              aria-label="Electric Mist distortion"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Brightness ({Math.round(settings.chamaacElectricMistBrightness)}%)</span>
            <input
              type="range"
              min="1"
              max="100"
              step="1"
              value={settings.chamaacElectricMistBrightness}
              onChange={(event) => onSettingsChange({ chamaacElectricMistBrightness: Number(event.target.value) })}
              aria-label="Electric Mist brightness"
            />
          </label>
        </div>
      )
    }

    if (option.id === "chamaac-astral-flow") {
      const useCustomPalette = settings.chamaacAstralFlowPaletteMode === "custom"
      const astralFlowDisplaySpeed = getChamaacAstralFlowDisplaySpeed(settings.chamaacAstralFlowSpeed)

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.chamaacAstralFlowPaletteMode}
              onChange={(event) => onSettingsChange({
                chamaacAstralFlowPaletteMode: event.target.value as ChamaacAstralFlowPaletteMode,
              })}
              aria-label="Astral Flow color mode"
            >
              <option value="custom">Custom colors</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>
          {useCustomPalette ? (
            <>
              <label className={styles.colorRow}>
                <span>Color 1 (deep)</span>
                <input
                  type="color"
                  value={settings.chamaacAstralFlowColorOne}
                  onChange={(event) => onSettingsChange({ chamaacAstralFlowColorOne: event.target.value })}
                  aria-label="Astral Flow color 1"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Color 2 (mid)</span>
                <input
                  type="color"
                  value={settings.chamaacAstralFlowColorTwo}
                  onChange={(event) => onSettingsChange({ chamaacAstralFlowColorTwo: event.target.value })}
                  aria-label="Astral Flow color 2"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Color 3 (highlights)</span>
                <input
                  type="color"
                  value={settings.chamaacAstralFlowColorThree}
                  onChange={(event) => onSettingsChange({ chamaacAstralFlowColorThree: event.target.value })}
                  aria-label="Astral Flow color 3"
                />
              </label>
            </>
          ) : (
            <>
              <label className={styles.colorRow}>
                <span>Primary color</span>
                <input
                  type="color"
                  value={settings.chamaacAstralFlowPrimaryColor}
                  onChange={(event) => onSettingsChange({ chamaacAstralFlowPrimaryColor: event.target.value })}
                  aria-label="Astral Flow primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={settings.chamaacAstralFlowHarmony}
                  onChange={(event) => onSettingsChange({
                    chamaacAstralFlowHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="Astral Flow color harmony"
                >
                  {COLOR_HARMONY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          <label className={styles.rangeRow}>
            <span>Animation speed ({astralFlowDisplaySpeed}%)</span>
            <input
              type="range"
              min={CHAMAAC_ASTRAL_FLOW_DISPLAY_SPEED_MIN}
              max={CHAMAAC_ASTRAL_FLOW_DISPLAY_SPEED_MAX}
              step={CHAMAAC_ASTRAL_FLOW_DISPLAY_SPEED_STEP}
              value={astralFlowDisplaySpeed}
              onChange={(event) => onSettingsChange({
                chamaacAstralFlowSpeed: getChamaacAstralFlowSourceSpeed(Number(event.target.value)),
              })}
              aria-label="Astral Flow animation speed"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Flow min ({settings.chamaacAstralFlowFlowMin.toFixed(1)})</span>
            <input
              type="range"
              min="0.5"
              max="10"
              step="0.1"
              value={settings.chamaacAstralFlowFlowMin}
              onChange={(event) => onSettingsChange({ chamaacAstralFlowFlowMin: Number(event.target.value) })}
              aria-label="Astral Flow flow min"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Flow max ({settings.chamaacAstralFlowFlowMax.toFixed(1)})</span>
            <input
              type="range"
              min="1"
              max="12"
              step="0.1"
              value={settings.chamaacAstralFlowFlowMax}
              onChange={(event) => onSettingsChange({ chamaacAstralFlowFlowMax: Number(event.target.value) })}
              aria-label="Astral Flow flow max"
            />
          </label>
        </div>
      )
    }

    if (option.id === "chamaac-deep-space-nebula") {
      const useCustomPalette = settings.chamaacDeepSpaceNebulaPaletteMode === "custom"
      const nebulaDisplaySpeed = getChamaacDeepSpaceNebulaDisplaySpeed(settings.chamaacDeepSpaceNebulaSpeed)

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.chamaacDeepSpaceNebulaPaletteMode}
              onChange={(event) => onSettingsChange({
                chamaacDeepSpaceNebulaPaletteMode: event.target.value as ChamaacDeepSpaceNebulaPaletteMode,
              })}
              aria-label="Deep Space Nebula color mode"
            >
              <option value="custom">Custom colors</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {useCustomPalette ? (
            <>
              <label className={styles.colorRow}>
                <span>Highlight</span>
                <input
                  type="color"
                  value={settings.chamaacDeepSpaceNebulaColorOne}
                  onChange={(event) => onSettingsChange({ chamaacDeepSpaceNebulaColorOne: event.target.value })}
                  aria-label="Deep Space Nebula highlight color"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Nebula cloud</span>
                <input
                  type="color"
                  value={settings.chamaacDeepSpaceNebulaColorTwo}
                  onChange={(event) => onSettingsChange({ chamaacDeepSpaceNebulaColorTwo: event.target.value })}
                  aria-label="Deep Space Nebula cloud color"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Deep space</span>
                <input
                  type="color"
                  value={settings.chamaacDeepSpaceNebulaColorThree}
                  onChange={(event) => onSettingsChange({ chamaacDeepSpaceNebulaColorThree: event.target.value })}
                  aria-label="Deep Space Nebula deep-space color"
                />
              </label>
            </>
          ) : (
            <>
              <label className={styles.colorRow}>
                <span>Nebula color</span>
                <input
                  type="color"
                  value={settings.chamaacDeepSpaceNebulaPrimaryColor}
                  onChange={(event) => onSettingsChange({ chamaacDeepSpaceNebulaPrimaryColor: event.target.value })}
                  aria-label="Deep Space Nebula primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={settings.chamaacDeepSpaceNebulaHarmony}
                  onChange={(event) => onSettingsChange({
                    chamaacDeepSpaceNebulaHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="Deep Space Nebula color harmony"
                >
                  {COLOR_HARMONY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}

          <label className={styles.rangeRow}>
            <span>Animation speed ({nebulaDisplaySpeed}%)</span>
            <input
              type="range"
              min={CHAMAAC_DEEP_SPACE_NEBULA_DISPLAY_SPEED_MIN}
              max={CHAMAAC_DEEP_SPACE_NEBULA_DISPLAY_SPEED_MAX}
              step={CHAMAAC_DEEP_SPACE_NEBULA_DISPLAY_SPEED_STEP}
              value={nebulaDisplaySpeed}
              onChange={(event) => onSettingsChange({
                chamaacDeepSpaceNebulaSpeed: getChamaacDeepSpaceNebulaSourceSpeed(Number(event.target.value)),
              })}
              aria-label="Deep Space Nebula animation speed"
            />
          </label>
        </div>
      )
    }

    if (option.id === "chamaac-grid-bloom") {
      const gridBloomDisplaySpeed = getChamaacGridBloomDisplaySpeed(settings.chamaacGridBloomSpeed)

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.colorRow}>
            <span>Bloom color</span>
            <input
              type="color"
              value={settings.chamaacGridBloomColor}
              onChange={(event) => onSettingsChange({ chamaacGridBloomColor: event.target.value })}
              aria-label="Grid Bloom bloom color"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Animation speed ({gridBloomDisplaySpeed}%)</span>
            <input
              type="range"
              min={CHAMAAC_GRID_BLOOM_DISPLAY_SPEED_MIN}
              max={CHAMAAC_GRID_BLOOM_DISPLAY_SPEED_MAX}
              step={CHAMAAC_GRID_BLOOM_DISPLAY_SPEED_STEP}
              value={gridBloomDisplaySpeed}
              onChange={(event) => onSettingsChange({
                chamaacGridBloomSpeed: getChamaacGridBloomSourceSpeed(Number(event.target.value)),
              })}
              aria-label="Grid Bloom animation speed"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Grid density ({settings.chamaacGridBloomGridScale.toFixed(0)})</span>
            <input
              type="range"
              min="4"
              max="32"
              step="1"
              value={settings.chamaacGridBloomGridScale}
              onChange={(event) => onSettingsChange({ chamaacGridBloomGridScale: Number(event.target.value) })}
              aria-label="Grid Bloom grid density"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Rotation speed ({settings.chamaacGridBloomRotationSpeed.toFixed(1)}x)</span>
            <input
              type="range"
              min="-3"
              max="3"
              step="0.1"
              value={settings.chamaacGridBloomRotationSpeed}
              onChange={(event) => onSettingsChange({ chamaacGridBloomRotationSpeed: Number(event.target.value) })}
              aria-label="Grid Bloom rotation speed"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Fade falloff ({settings.chamaacGridBloomFadeFalloff.toFixed(1)})</span>
            <input
              type="range"
              min="1"
              max="24"
              step="0.5"
              value={settings.chamaacGridBloomFadeFalloff}
              onChange={(event) => onSettingsChange({ chamaacGridBloomFadeFalloff: Number(event.target.value) })}
              aria-label="Grid Bloom fade falloff"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Distortion ({settings.chamaacGridBloomDistortionAmount.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="0.5"
              step="0.01"
              value={settings.chamaacGridBloomDistortionAmount}
              onChange={(event) => onSettingsChange({
                chamaacGridBloomDistortionAmount: Number(event.target.value),
              })}
              aria-label="Grid Bloom distortion"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Flow X ({settings.chamaacGridBloomFlowSpeedX.toFixed(1)})</span>
            <input
              type="range"
              min="-2"
              max="2"
              step="0.1"
              value={settings.chamaacGridBloomFlowSpeedX}
              onChange={(event) => onSettingsChange({ chamaacGridBloomFlowSpeedX: Number(event.target.value) })}
              aria-label="Grid Bloom flow X"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Flow Y ({settings.chamaacGridBloomFlowSpeedY.toFixed(1)})</span>
            <input
              type="range"
              min="-2"
              max="2"
              step="0.1"
              value={settings.chamaacGridBloomFlowSpeedY}
              onChange={(event) => onSettingsChange({ chamaacGridBloomFlowSpeedY: Number(event.target.value) })}
              aria-label="Grid Bloom flow Y"
            />
          </label>
        </div>
      )
    }

    if (option.id === "chamaac-liquid-chrome") {
      const useCustomPalette = settings.chamaacLiquidChromePaletteMode === "custom"
      const liquidChromeFlowSpeed = getChamaacLiquidChromeDisplayFlowSpeed(settings.chamaacLiquidChromeFlowSpeed)
      const liquidChromeTimeScale = getChamaacLiquidChromeDisplayTimeScale(settings.chamaacLiquidChromeTimeScale)

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.chamaacLiquidChromePaletteMode}
              onChange={(event) => onSettingsChange({
                chamaacLiquidChromePaletteMode: event.target.value as ChamaacLiquidChromePaletteMode,
              })}
              aria-label="Liquid Chrome color mode"
            >
              <option value="custom">Custom colors</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {useCustomPalette ? (
            <>
              <label className={styles.colorRow}>
                <span>Chrome color</span>
                <input
                  type="color"
                  value={settings.chamaacLiquidChromeColorOne}
                  onChange={(event) => onSettingsChange({ chamaacLiquidChromeColorOne: event.target.value })}
                  aria-label="Liquid Chrome chrome color"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Shadow color</span>
                <input
                  type="color"
                  value={settings.chamaacLiquidChromeColorTwo}
                  onChange={(event) => onSettingsChange({ chamaacLiquidChromeColorTwo: event.target.value })}
                  aria-label="Liquid Chrome shadow color"
                />
              </label>
            </>
          ) : (
            <>
              <label className={styles.colorRow}>
                <span>Primary chrome</span>
                <input
                  type="color"
                  value={settings.chamaacLiquidChromePrimaryColor}
                  onChange={(event) => onSettingsChange({ chamaacLiquidChromePrimaryColor: event.target.value })}
                  aria-label="Liquid Chrome primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={settings.chamaacLiquidChromeHarmony}
                  onChange={(event) => onSettingsChange({
                    chamaacLiquidChromeHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="Liquid Chrome color harmony"
                >
                  {COLOR_HARMONY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}

          <label className={styles.rangeRow}>
            <span>Flow speed ({liquidChromeFlowSpeed}%)</span>
            <input
              type="range"
              min={CHAMAAC_LIQUID_CHROME_DISPLAY_FLOW_SPEED_MIN}
              max={CHAMAAC_LIQUID_CHROME_DISPLAY_FLOW_SPEED_MAX}
              step={CHAMAAC_LIQUID_CHROME_DISPLAY_FLOW_SPEED_STEP}
              value={liquidChromeFlowSpeed}
              onChange={(event) => onSettingsChange({
                chamaacLiquidChromeFlowSpeed: getChamaacLiquidChromeSourceFlowSpeed(Number(event.target.value)),
              })}
              aria-label="Liquid Chrome flow speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Time scale ({liquidChromeTimeScale}%)</span>
            <input
              type="range"
              min={CHAMAAC_LIQUID_CHROME_DISPLAY_TIME_SCALE_MIN}
              max={CHAMAAC_LIQUID_CHROME_DISPLAY_TIME_SCALE_MAX}
              step={CHAMAAC_LIQUID_CHROME_DISPLAY_TIME_SCALE_STEP}
              value={liquidChromeTimeScale}
              onChange={(event) => onSettingsChange({
                chamaacLiquidChromeTimeScale: getChamaacLiquidChromeSourceTimeScale(Number(event.target.value)),
              })}
              aria-label="Liquid Chrome time scale"
            />
          </label>
        </div>
      )
    }

    if (option.id === "chamaac-waves") {
      const useCustomPalette = settings.chamaacWavesPaletteMode === "custom"
      const wavesSpeedX = getChamaacWavesDisplaySpeed(settings.chamaacWavesSpeedX)
      const wavesSpeedY = getChamaacWavesDisplaySpeed(settings.chamaacWavesSpeedY)

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.chamaacWavesPaletteMode}
              onChange={(event) => onSettingsChange({
                chamaacWavesPaletteMode: event.target.value as ChamaacWavesPaletteMode,
              })}
              aria-label="Waves color mode"
            >
              <option value="custom">Custom colors</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {useCustomPalette ? (
            <>
              <label className={styles.colorRow}>
                <span>Background</span>
                <input
                  type="color"
                  value={settings.chamaacWavesBackgroundColor}
                  onChange={(event) => onSettingsChange({ chamaacWavesBackgroundColor: event.target.value })}
                  aria-label="Waves background color"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Primary wave</span>
                <input
                  type="color"
                  value={settings.chamaacWavesColorOne}
                  onChange={(event) => onSettingsChange({ chamaacWavesColorOne: event.target.value })}
                  aria-label="Waves primary wave color"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Highlight</span>
                <input
                  type="color"
                  value={settings.chamaacWavesColorTwo}
                  onChange={(event) => onSettingsChange({ chamaacWavesColorTwo: event.target.value })}
                  aria-label="Waves highlight color"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Valley</span>
                <input
                  type="color"
                  value={settings.chamaacWavesColorThree}
                  onChange={(event) => onSettingsChange({ chamaacWavesColorThree: event.target.value })}
                  aria-label="Waves valley color"
                />
              </label>
            </>
          ) : (
            <>
              <label className={styles.colorRow}>
                <span>Primary wave</span>
                <input
                  type="color"
                  value={settings.chamaacWavesPrimaryColor}
                  onChange={(event) => onSettingsChange({ chamaacWavesPrimaryColor: event.target.value })}
                  aria-label="Waves primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={settings.chamaacWavesHarmony}
                  onChange={(event) => onSettingsChange({
                    chamaacWavesHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="Waves color harmony"
                >
                  {COLOR_HARMONY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}

          <label className={styles.rangeRow}>
            <span>Speed X ({wavesSpeedX}%)</span>
            <input
              type="range"
              min={CHAMAAC_WAVES_DISPLAY_SPEED_MIN}
              max={CHAMAAC_WAVES_DISPLAY_SPEED_MAX}
              step={CHAMAAC_WAVES_DISPLAY_SPEED_STEP}
              value={wavesSpeedX}
              onChange={(event) => onSettingsChange({
                chamaacWavesSpeedX: getChamaacWavesSourceSpeed(Number(event.target.value)),
              })}
              aria-label="Waves speed X"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Speed Y ({wavesSpeedY}%)</span>
            <input
              type="range"
              min={CHAMAAC_WAVES_DISPLAY_SPEED_MIN}
              max={CHAMAAC_WAVES_DISPLAY_SPEED_MAX}
              step={CHAMAAC_WAVES_DISPLAY_SPEED_STEP}
              value={wavesSpeedY}
              onChange={(event) => onSettingsChange({
                chamaacWavesSpeedY: getChamaacWavesSourceSpeed(Number(event.target.value)),
              })}
              aria-label="Waves speed Y"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Amplitude ({settings.chamaacWavesAmplitude.toFixed(0)})</span>
            <input
              type="range"
              min="8"
              max="64"
              step="1"
              value={settings.chamaacWavesAmplitude}
              onChange={(event) => onSettingsChange({ chamaacWavesAmplitude: Number(event.target.value) })}
              aria-label="Waves amplitude"
            />
          </label>
        </div>
      )
    }

    if (option.id === "eldora-hacker-background") {
      const useCustomPalette = settings.eldoraHackerPaletteMode === "custom"
      const hackerSpeed = getEldoraHackerDisplaySpeed(settings.eldoraHackerSpeed)

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.eldoraHackerPaletteMode}
              onChange={(event) => onSettingsChange({
                eldoraHackerPaletteMode: event.target.value as EldoraHackerPaletteMode,
              })}
              aria-label="Hacker Background color mode"
            >
              <option value="custom">Custom color</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {useCustomPalette ? (
            <label className={styles.colorRow}>
              <span>Character color</span>
              <input
                type="color"
                value={settings.eldoraHackerColor}
                onChange={(event) => onSettingsChange({ eldoraHackerColor: event.target.value })}
                aria-label="Hacker Background character color"
              />
            </label>
          ) : (
            <>
              <label className={styles.colorRow}>
                <span>Primary color</span>
                <input
                  type="color"
                  value={settings.eldoraHackerPrimaryColor}
                  onChange={(event) => onSettingsChange({ eldoraHackerPrimaryColor: event.target.value })}
                  aria-label="Hacker Background primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={settings.eldoraHackerHarmony}
                  onChange={(event) => onSettingsChange({
                    eldoraHackerHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="Hacker Background color harmony"
                >
                  {COLOR_HARMONY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}

          <label className={styles.rangeRow}>
            <span>Animation speed ({hackerSpeed}%)</span>
            <input
              type="range"
              min={ELDORA_HACKER_DISPLAY_SPEED_MIN}
              max={ELDORA_HACKER_DISPLAY_SPEED_MAX}
              step={ELDORA_HACKER_DISPLAY_SPEED_STEP}
              value={hackerSpeed}
              onChange={(event) => onSettingsChange({
                eldoraHackerSpeed: getEldoraHackerSourceSpeed(Number(event.target.value)),
              })}
              aria-label="Hacker Background animation speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Font size ({settings.eldoraHackerFontSize}px)</span>
            <input
              type="range"
              min="8"
              max="28"
              step="1"
              value={settings.eldoraHackerFontSize}
              onChange={(event) => onSettingsChange({ eldoraHackerFontSize: Number(event.target.value) })}
              aria-label="Hacker Background font size"
            />
          </label>
        </div>
      )
    }

    if (option.id === "eldora-novatrix-background") {
      const useCustomPalette = settings.eldoraNovatrixPaletteMode === "custom"
      const novatrixSpeed = getEldoraNovatrixDisplaySpeed(settings.eldoraNovatrixSpeed)
      const novatrixAmplitude = getEldoraNovatrixDisplayAmplitude(settings.eldoraNovatrixAmplitude)

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.eldoraNovatrixPaletteMode}
              onChange={(event) => onSettingsChange({
                eldoraNovatrixPaletteMode: event.target.value as EldoraNovatrixPaletteMode,
              })}
              aria-label="Novatrix color mode"
            >
              <option value="custom">Custom color</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {useCustomPalette ? (
            <label className={styles.colorRow}>
              <span>Animation color</span>
              <input
                type="color"
                value={settings.eldoraNovatrixColor}
                onChange={(event) => onSettingsChange({ eldoraNovatrixColor: event.target.value })}
                aria-label="Novatrix animation color"
              />
            </label>
          ) : (
            <>
              <label className={styles.colorRow}>
                <span>Primary color</span>
                <input
                  type="color"
                  value={settings.eldoraNovatrixPrimaryColor}
                  onChange={(event) => onSettingsChange({ eldoraNovatrixPrimaryColor: event.target.value })}
                  aria-label="Novatrix primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={settings.eldoraNovatrixHarmony}
                  onChange={(event) => onSettingsChange({
                    eldoraNovatrixHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="Novatrix color harmony"
                >
                  {COLOR_HARMONY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}

          <label className={styles.rangeRow}>
            <span>Animation speed ({novatrixSpeed}%)</span>
            <input
              type="range"
              min={ELDORA_NOVATRIX_DISPLAY_SPEED_MIN}
              max={ELDORA_NOVATRIX_DISPLAY_SPEED_MAX}
              step={ELDORA_NOVATRIX_DISPLAY_SPEED_STEP}
              value={novatrixSpeed}
              onChange={(event) => onSettingsChange({
                eldoraNovatrixSpeed: getEldoraNovatrixSourceSpeed(Number(event.target.value)),
              })}
              aria-label="Novatrix animation speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Amplitude ({novatrixAmplitude}%)</span>
            <input
              type="range"
              min={ELDORA_NOVATRIX_DISPLAY_AMPLITUDE_MIN}
              max={ELDORA_NOVATRIX_DISPLAY_AMPLITUDE_MAX}
              step={ELDORA_NOVATRIX_DISPLAY_AMPLITUDE_STEP}
              value={novatrixAmplitude}
              onChange={(event) => onSettingsChange({
                eldoraNovatrixAmplitude: getEldoraNovatrixSourceAmplitude(Number(event.target.value)),
              })}
              aria-label="Novatrix amplitude"
            />
          </label>
        </div>
      )
    }

    if (option.id === "chamaac-synthesis") {
      const useCustomPalette = settings.chamaacSynthesisPaletteMode === "custom"
      const synthesisDisplaySpeed = getChamaacSynthesisDisplaySpeed(settings.chamaacSynthesisSpeed)

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.chamaacSynthesisPaletteMode}
              onChange={(event) => onSettingsChange({
                chamaacSynthesisPaletteMode: event.target.value as ChamaacSynthesisPaletteMode,
              })}
              aria-label="Synthesis color mode"
            >
              <option value="custom">Custom colors</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>
          {useCustomPalette ? (
            <>
              <label className={styles.colorRow}>
                <span>Color 1</span>
                <input
                  type="color"
                  value={settings.chamaacSynthesisColorOne}
                  onChange={(event) => onSettingsChange({ chamaacSynthesisColorOne: event.target.value })}
                  aria-label="Synthesis color 1"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Color 2</span>
                <input
                  type="color"
                  value={settings.chamaacSynthesisColorTwo}
                  onChange={(event) => onSettingsChange({ chamaacSynthesisColorTwo: event.target.value })}
                  aria-label="Synthesis color 2"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Color 3</span>
                <input
                  type="color"
                  value={settings.chamaacSynthesisColorThree}
                  onChange={(event) => onSettingsChange({ chamaacSynthesisColorThree: event.target.value })}
                  aria-label="Synthesis color 3"
                />
              </label>
            </>
          ) : (
            <>
              <label className={styles.colorRow}>
                <span>Primary color</span>
                <input
                  type="color"
                  value={settings.chamaacSynthesisPrimaryColor}
                  onChange={(event) => onSettingsChange({ chamaacSynthesisPrimaryColor: event.target.value })}
                  aria-label="Synthesis primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={settings.chamaacSynthesisHarmony}
                  onChange={(event) => onSettingsChange({
                    chamaacSynthesisHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="Synthesis color harmony"
                >
                  {COLOR_HARMONY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          <label className={styles.rangeRow}>
            <span>Animation speed ({synthesisDisplaySpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min={CHAMAAC_SYNTHESIS_DISPLAY_SPEED_MIN}
              max={CHAMAAC_SYNTHESIS_DISPLAY_SPEED_MAX}
              step={CHAMAAC_SYNTHESIS_DISPLAY_SPEED_STEP}
              value={synthesisDisplaySpeed}
              onChange={(event) => onSettingsChange({
                chamaacSynthesisSpeed: getChamaacSynthesisSourceSpeed(Number(event.target.value)),
              })}
              aria-label="Synthesis animation speed"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Complexity ({settings.chamaacSynthesisComplexity})</span>
            <input
              type="range"
              min="1"
              max="20"
              step="1"
              value={settings.chamaacSynthesisComplexity}
              onChange={(event) => onSettingsChange({ chamaacSynthesisComplexity: Number(event.target.value) })}
              aria-label="Synthesis complexity"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Zoom scale ({settings.chamaacSynthesisScale.toFixed(1)}x)</span>
            <input
              type="range"
              min="0.1"
              max="5"
              step="0.1"
              value={settings.chamaacSynthesisScale}
              onChange={(event) => onSettingsChange({ chamaacSynthesisScale: Number(event.target.value) })}
              aria-label="Synthesis zoom scale"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Distortion ({settings.chamaacSynthesisDistortion.toFixed(1)}x)</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={settings.chamaacSynthesisDistortion}
              onChange={(event) => onSettingsChange({ chamaacSynthesisDistortion: Number(event.target.value) })}
              aria-label="Synthesis distortion"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Glow intensity ({settings.chamaacSynthesisGlowIntensity.toFixed(1)}x)</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={settings.chamaacSynthesisGlowIntensity}
              onChange={(event) => onSettingsChange({ chamaacSynthesisGlowIntensity: Number(event.target.value) })}
              aria-label="Synthesis glow intensity"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Flow frequency ({settings.chamaacSynthesisFlowFrequency.toFixed(1)})</span>
            <input
              type="range"
              min="0.5"
              max="10"
              step="0.5"
              value={settings.chamaacSynthesisFlowFrequency}
              onChange={(event) => onSettingsChange({ chamaacSynthesisFlowFrequency: Number(event.target.value) })}
              aria-label="Synthesis flow frequency"
            />
          </label>
        </div>
      )
    }

    if (option.id === "aceternity-canvas-reveal-dots") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.colorRow}>
            <span>Background</span>
            <input
              type="color"
              value={settings.canvasRevealDotsBackgroundColor}
              onChange={(event) => onSettingsChange({ canvasRevealDotsBackgroundColor: event.target.value })}
              aria-label="Canvas reveal dots background color"
            />
          </label>
          <label className={styles.colorRow}>
            <span>Dot color</span>
            <input
              type="color"
              value={settings.canvasRevealDotsDotColor}
              onChange={(event) => onSettingsChange({ canvasRevealDotsDotColor: event.target.value })}
              aria-label="Canvas reveal dots dot color"
            />
          </label>
          <label className={styles.colorRow}>
            <span>Accent</span>
            <input
              type="color"
              value={settings.canvasRevealDotsAccentColor}
              onChange={(event) => onSettingsChange({ canvasRevealDotsAccentColor: event.target.value })}
              aria-label="Canvas reveal dots accent color"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Dot size</span>
            <input
              type="range"
              min="1"
              max="5"
              step="0.2"
              value={settings.canvasRevealDotsDotSize}
              onChange={(event) => onSettingsChange({ canvasRevealDotsDotSize: Number(event.target.value) })}
              aria-label="Canvas reveal dots dot size"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Spacing</span>
            <input
              type="range"
              min="4"
              max="24"
              step="1"
              value={settings.canvasRevealDotsDotSpacing}
              onChange={(event) => onSettingsChange({ canvasRevealDotsDotSpacing: Number(event.target.value) })}
              aria-label="Canvas reveal dots spacing"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Opacity</span>
            <input
              type="range"
              min="0.08"
              max="1"
              step="0.02"
              value={settings.canvasRevealDotsOpacity}
              onChange={(event) => onSettingsChange({ canvasRevealDotsOpacity: Number(event.target.value) })}
              aria-label="Canvas reveal dots opacity"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Motion speed</span>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.1"
              value={settings.canvasRevealDotsAnimationSpeed}
              onChange={(event) => onSettingsChange({ canvasRevealDotsAnimationSpeed: Number(event.target.value) })}
              aria-label="Canvas reveal dots motion speed"
            />
          </label>
          <label className={styles.switchRow}>
            <span>Gradient overlay</span>
            <input
              type="checkbox"
              checked={settings.canvasRevealDotsShowGradient}
              onChange={(event) => onSettingsChange({ canvasRevealDotsShowGradient: event.target.checked })}
            />
          </label>
        </div>
      )
    }

    if (option.id === "aceternity-spotlight-new") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.colorRow}>
            <span>Spotlight color</span>
            <input
              type="color"
              value={settings.spotlightColor}
              onChange={(event) => onSettingsChange({ spotlightColor: event.target.value })}
              aria-label="Spotlight color"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Intensity</span>
            <input
              type="range"
              min="0.25"
              max="1.5"
              step="0.05"
              value={settings.spotlightOpacity}
              onChange={(event) => onSettingsChange({ spotlightOpacity: Number(event.target.value) })}
              aria-label="Spotlight intensity"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Beam width</span>
            <input
              type="range"
              min="240"
              max="900"
              step="20"
              value={settings.spotlightWidth}
              onChange={(event) => onSettingsChange({ spotlightWidth: Number(event.target.value) })}
              aria-label="Spotlight beam width"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Beam height</span>
            <input
              type="range"
              min="600"
              max="1800"
              step="20"
              value={settings.spotlightHeight}
              onChange={(event) => onSettingsChange({ spotlightHeight: Number(event.target.value) })}
              aria-label="Spotlight beam height"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Small beams</span>
            <input
              type="range"
              min="120"
              max="420"
              step="10"
              value={settings.spotlightSmallWidth}
              onChange={(event) => onSettingsChange({ spotlightSmallWidth: Number(event.target.value) })}
              aria-label="Spotlight small beam width"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Vertical offset</span>
            <input
              type="range"
              min="-650"
              max="120"
              step="10"
              value={settings.spotlightTranslateY}
              onChange={(event) => onSettingsChange({ spotlightTranslateY: Number(event.target.value) })}
              aria-label="Spotlight vertical offset"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Sweep</span>
            <input
              type="range"
              min="0"
              max="220"
              step="10"
              value={settings.spotlightXOffset}
              onChange={(event) => onSettingsChange({ spotlightXOffset: Number(event.target.value) })}
              aria-label="Spotlight sweep distance"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Duration</span>
            <input
              type="range"
              min="3"
              max="16"
              step="0.5"
              value={settings.spotlightDuration}
              onChange={(event) => onSettingsChange({ spotlightDuration: Number(event.target.value) })}
              aria-label="Spotlight animation duration"
            />
          </label>
        </div>
      )
    }

    if (option.id === "aceternity-lamp-effect") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.colorRow}>
            <span>Background</span>
            <input
              type="color"
              value={settings.lampBackgroundColor}
              onChange={(event) => onSettingsChange({ lampBackgroundColor: event.target.value })}
              aria-label="Lamp background color"
            />
          </label>
          <label className={styles.colorRow}>
            <span>Beam color</span>
            <input
              type="color"
              value={settings.lampColor}
              onChange={(event) => onSettingsChange({ lampColor: event.target.value })}
              aria-label="Lamp beam color"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Glow intensity</span>
            <input
              type="range"
              min="0.18"
              max="0.95"
              step="0.05"
              value={settings.lampGlowOpacity}
              onChange={(event) => onSettingsChange({ lampGlowOpacity: Number(event.target.value) })}
              aria-label="Lamp glow intensity"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Beam width</span>
            <input
              type="range"
              min="240"
              max="900"
              step="20"
              value={settings.lampBeamWidth}
              onChange={(event) => onSettingsChange({ lampBeamWidth: Number(event.target.value) })}
              aria-label="Lamp beam width"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Glow width</span>
            <input
              type="range"
              min="180"
              max="900"
              step="20"
              value={settings.lampGlowWidth}
              onChange={(event) => onSettingsChange({ lampGlowWidth: Number(event.target.value) })}
              aria-label="Lamp glow width"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Vertical offset</span>
            <input
              type="range"
              min="-320"
              max="160"
              step="8"
              value={settings.lampVerticalOffset}
              onChange={(event) => onSettingsChange({ lampVerticalOffset: Number(event.target.value) })}
              aria-label="Lamp vertical offset"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Pulse speed</span>
            <input
              type="range"
              min="4"
              max="18"
              step="0.5"
              value={settings.lampPulseSpeed}
              onChange={(event) => onSettingsChange({ lampPulseSpeed: Number(event.target.value) })}
              aria-label="Lamp pulse speed"
            />
          </label>
        </div>
      )
    }

    if (option.id === "aceternity-vortex") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.colorRow}>
            <span>Background</span>
            <input
              type="color"
              value={settings.vortexBackgroundColor}
              onChange={(event) => onSettingsChange({ vortexBackgroundColor: event.target.value })}
              aria-label="Vortex background color"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Hue</span>
            <input
              type="range"
              min="0"
              max="360"
              step="1"
              value={settings.vortexBaseHue}
              onChange={(event) => onSettingsChange({ vortexBaseHue: Number(event.target.value) })}
              aria-label="Vortex base hue"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Particles</span>
            <input
              type="range"
              min="120"
              max="700"
              step="20"
              value={settings.vortexParticleCount}
              onChange={(event) => onSettingsChange({ vortexParticleCount: Number(event.target.value) })}
              aria-label="Vortex particle count"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Vertical spread</span>
            <input
              type="range"
              min="40"
              max="220"
              step="10"
              value={settings.vortexRangeY}
              onChange={(event) => onSettingsChange({ vortexRangeY: Number(event.target.value) })}
              aria-label="Vortex vertical spread"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Base speed</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.vortexBaseSpeed}
              onChange={(event) => onSettingsChange({ vortexBaseSpeed: Number(event.target.value) })}
              aria-label="Vortex base speed"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Speed range</span>
            <input
              type="range"
              min="0.2"
              max="2"
              step="0.1"
              value={settings.vortexRangeSpeed}
              onChange={(event) => onSettingsChange({ vortexRangeSpeed: Number(event.target.value) })}
              aria-label="Vortex speed range"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Base size</span>
            <input
              type="range"
              min="0.5"
              max="2.5"
              step="0.1"
              value={settings.vortexBaseRadius}
              onChange={(event) => onSettingsChange({ vortexBaseRadius: Number(event.target.value) })}
              aria-label="Vortex base particle size"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Size range</span>
            <input
              type="range"
              min="0.5"
              max="4"
              step="0.1"
              value={settings.vortexRangeRadius}
              onChange={(event) => onSettingsChange({ vortexRangeRadius: Number(event.target.value) })}
              aria-label="Vortex particle size range"
            />
          </label>
        </div>
      )
    }

    return null
  }

  return (
    <section className={styles.container} aria-labelledby="chimer-heading">
      <div className={styles.header}>
        <PageHeading>Chimer</PageHeading>
        <p className={styles.subtitle}>Massage session timer for treatment pacing, interval chimes, and full-screen clock visibility.</p>
      </div>

      <div className={styles.syncNotice}>
        <p>{syncMessage}</p>
        {syncStatus === "conflict" && (
          <div className={styles.syncActions}>
            <button type="button" className={styles.syncButton} onClick={onUseDeviceSettings} disabled={isResolvingSync}>
              Keep this device settings
            </button>
            <button type="button" className={styles.syncButton} onClick={onUseSavedSettings} disabled={isResolvingSync}>
              Use saved favorites
            </button>
          </div>
        )}
      </div>

      <div className={styles.proofGrid} aria-label="Chimer massage session timer features">
        {timerProofs.map((proof) => {
          const Icon = proof.icon
          return (
            <div key={proof.title} className={styles.proofCard}>
              <Icon className="h-4 w-4" aria-hidden="true" />
              <div>
                <p className={styles.proofTitle}>{proof.title}</p>
                <p className={styles.proofDescription}>{proof.description}</p>
              </div>
            </div>
          )
        })}
      </div>

      <button
        type="button"
        className={styles.clock}
        onClick={() => onTimeClick("minutes")}
        aria-label="Set session length"
      >
        <span className={`${styles.timerStatusBadge} ${isTimerSet ? styles.timerSet : styles.timerUnset}`}>
          {isTimerSet ? "Set" : "Unset"}
        </span>
        <span className={styles.timeUnit} onClick={(event) => {
          event.stopPropagation()
          onTimeClick("hours")
        }}>
          {settings.hours.toString().padStart(2, "0")}
        </span>
        <span className={styles.colon}>:</span>
        <span className={styles.timeUnit} onClick={(event) => {
          event.stopPropagation()
          onTimeClick("minutes")
        }}>
          {settings.minutes.toString().padStart(2, "0")}
        </span>
      </button>

      <button type="button" className={styles.clockModeButton} onClick={onStartClock}>
        <Clock className="h-5 w-5" />
        Clock Mode
      </button>

      <div className={styles.grid}>
        <label className={styles.formGroup} htmlFor="interval-type">
          <span>Alert Frequency</span>
          <select
            id="interval-type"
            value={settings.intervalType}
            onChange={(event) => onSettingsChange({ intervalType: event.target.value as ChimerSettings["intervalType"] })}
          >
            <option value="preset">Preset interval</option>
            <option value="custom">Custom interval</option>
            <option value="areas">Divide by body areas</option>
          </select>
        </label>

        {(settings.intervalType === "preset" || settings.intervalType === "custom") && (
          <label className={styles.formGroup} htmlFor="custom-interval-input">
            <span>{settings.intervalType === "preset" ? "Preset minutes" : "Custom minutes"}</span>
            {settings.intervalType === "preset" ? (
              <select
                id="custom-interval-input"
                value={settings.customInterval}
                onChange={(event) => onSettingsChange({ customInterval: Number(event.target.value) })}
              >
                <option value="1">1 minute</option>
                <option value="5">5 minutes</option>
                <option value="10">10 minutes</option>
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
              </select>
            ) : (
              <input
                type="number"
                id="custom-interval-input"
                min="1"
                max="240"
                value={settings.customInterval}
                onChange={(event) => onSettingsChange({ customInterval: Number(event.target.value) })}
              />
            )}
          </label>
        )}

        {settings.intervalType === "areas" && (
          <label className={styles.formGroup} htmlFor="areas-input">
            <span>Body areas</span>
            <input
              type="number"
              id="areas-input"
              min="1"
              max="24"
              value={settings.areasToMassage}
              onChange={(event) => onSettingsChange({ areasToMassage: Number(event.target.value) })}
            />
          </label>
        )}

        <label className={styles.formGroup} htmlFor="alert-type">
          <span>Alert type</span>
          <select
            id="alert-type"
            value={settings.alertType}
            onChange={(event) => onSettingsChange({ alertType: event.target.value as ChimerSettings["alertType"] })}
          >
            <option value="chime">Chime</option>
            <option value="flash">Screen flash</option>
            <option value="both">Chime and flash</option>
            <option value="silent">Silent</option>
          </select>
        </label>
      </div>

      <div className={styles.backgroundSettings}>
        <label className={styles.switchRow}>
          <span>Visual background</span>
          <input
            type="checkbox"
            checked={settings.movingBackgroundEnabled}
            onChange={(event) => onSettingsChange({ movingBackgroundEnabled: event.target.checked })}
          />
        </label>
        {settings.movingBackgroundEnabled && (
          <BackgroundSelector
            value={settings.backgroundId}
            onChange={(backgroundId) => onSettingsChange({ backgroundId })}
            featureKeys={featureKeys}
            category={backgroundCategory}
            renderSelectedControls={renderBackgroundControls}
          />
        )}
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.actions}>
        <button type="button" className={styles.secondaryButton} onClick={onTestAlert}>
          Test Alert
        </button>
        <button
          type="button"
          className={styles.button}
          onClick={onStartTimer}
          disabled={totalDurationMs <= 0}
        >
          <Play className="h-5 w-5" />
          Start Timer
        </button>
      </div>
    </section>
  )
}
