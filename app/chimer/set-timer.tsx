"use client"

import { BellRing, Clock, MonitorSmartphone, Play, SlidersHorizontal } from "lucide-react"
import { BackgroundSelector } from "@/components/backgrounds/BackgroundSelector"
import type { BackgroundCategory, BackgroundDefinition, BackgroundId } from "@/components/backgrounds/backgroundRegistry"
import { PageHeading } from "@/components/ui/page-heading"
import {
  getAceternity3DGlobeScaleDisplayPercent,
  getAceternity3DGlobeScaleFromDisplayPercent,
} from "@/lib/chimer-timer"
import styles from "./set-timer.module.css"
import { TileGridFadeTimeControl } from "./tile-grid-fade-time-control"

export {
  getAceternity3DGlobeScaleDisplayPercent,
  getAceternity3DGlobeScaleFromDisplayPercent,
}

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
export type ReactBitsFerrofluidPaletteMode = "harmony" | "custom"
export type ReactBitsLightfallPaletteMode = "harmony" | "custom"
export type ReactBitsLiquidEtherPaletteMode = "harmony" | "custom"
export type ReactBitsPrismAnimationType = "rotate" | "3drotate" | "hover"
export type ReactBitsLightPillarPaletteMode = "harmony" | "custom"
export type ReactBitsLightPillarBlendMode = "screen" | "normal" | "lighten" | "plus-lighter"
export type ReactBitsLightPillarQuality = "low" | "medium" | "high"
export type ReactBitsSilkPaletteMode = "harmony" | "custom"
export type ReactBitsFloatingLinesPaletteMode = "source" | "harmony" | "custom"
export type ReactBitsFloatingLinesBlendMode = "screen" | "normal" | "lighten" | "plus-lighter"
export type ReactBitsSideRaysPaletteMode = "source" | "harmony" | "custom"
export type ReactBitsSideRaysOrigin = "top-right" | "top-left" | "bottom-right" | "bottom-left"
export type ReactBitsLightRaysPaletteMode = "source" | "harmony" | "custom"
export type ReactBitsLightRaysOrigin =
  | "top-left"
  | "top-center"
  | "top-right"
  | "left"
  | "right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right"
export type ReactBitsPixelBlastPaletteMode = "source" | "harmony" | "custom"
export type ReactBitsPixelBlastVariant = "square" | "circle" | "triangle" | "diamond"
export type ReactBitsColorBendsPaletteMode = "source" | "harmony" | "custom"
export type ReactBitsEvilEyePaletteMode = "source" | "harmony" | "custom"
export type ReactBitsLineWavesPaletteMode = "source" | "harmony" | "custom"
export type ReactBitsRadarPaletteMode = "source" | "harmony" | "custom"
export type ReactBitsSoftAuroraPaletteMode = "source" | "harmony" | "custom"
export type ReactBitsPlasmaPaletteMode = "source" | "harmony" | "custom"
export type ReactBitsPlasmaDirection = "forward" | "reverse" | "pingpong"
export type ReactBitsPlasmaWavePaletteMode = "source" | "harmony" | "custom"
export type ReactBitsParticlesPaletteMode = "source" | "harmony" | "custom"
export type ReactBitsGradientBlindsPaletteMode = "source" | "harmony" | "custom"
export type ReactBitsGradientBlindsShineDirection = "left" | "right"
export type ReactBitsGradientBlindsBlendMode = "normal" | "screen" | "lighten" | "plus-lighter"
export type ReactBitsGrainientPaletteMode = "source" | "harmony" | "custom"
export type ReactBitsGridScanPaletteMode = "source" | "harmony" | "custom"
export type ReactBitsGridScanLineStyle = "solid" | "dashed" | "dotted"
export type ReactBitsGridScanDirection = "forward" | "backward" | "pingpong"
export type ReactBitsBeamsPaletteMode = "source" | "harmony" | "custom"
export type ReactBitsPixelSnowPaletteMode = "source" | "harmony" | "custom"
export type ReactBitsPixelSnowVariant = "square" | "round" | "snowflake"
export type ReactBitsLightningPaletteMode = "source" | "harmony" | "custom"
export type ReactBitsPrismaticBurstPaletteMode = "source" | "harmony" | "custom"
export type ReactBitsPrismaticBurstAnimationType = "rotate" | "rotate3d" | "hover"
export type ReactBitsPrismaticBurstMixBlendMode = "lighten" | "screen" | "none"
export type ReactBitsGalaxyPaletteMode = "source" | "harmony" | "custom"
export type ReactBitsDitherPaletteMode = "source" | "harmony" | "custom"
export type ReactBitsFaultyTerminalPaletteMode = "source" | "harmony" | "custom"
export type ReactBitsRippleGridPaletteMode = "source" | "rainbow" | "harmony" | "custom"
export type ReactBitsDotFieldPaletteMode = "source" | "harmony" | "custom"
export type ReactBitsDotGridPaletteMode = "source" | "harmony" | "custom"
export type ReactBitsThreadsPaletteMode = "source" | "harmony" | "custom"
export type ReactBitsIridescencePaletteMode = "source" | "harmony" | "custom"
export type ReactBitsWavesPaletteMode = "source" | "harmony" | "custom"
export type ReactBitsGridDistortionPaletteMode = "source" | "harmony" | "custom"
export type EldoraNovatrixPaletteMode = "harmony" | "custom"
export type EldoraHackerPaletteMode = "harmony" | "custom"
export type EldoraPhotonBeamPaletteMode = "harmony" | "custom"

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
export const ELDORA_PHOTON_BEAM_SOURCE_SPEED_MIN = 0.02
export const ELDORA_PHOTON_BEAM_SOURCE_SPEED_MAX = 2
export const ELDORA_PHOTON_BEAM_DISPLAY_SPEED_MIN = 1
export const ELDORA_PHOTON_BEAM_DISPLAY_SPEED_MAX = 100
export const ELDORA_PHOTON_BEAM_DISPLAY_SPEED_STEP = 1
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

// Photon Beam stores Eldora's source speed multiplier while users see a
// consistent 1%-100% control alongside the other premium backgrounds.
export function getEldoraPhotonBeamDisplaySpeed(sourceSpeed: number) {
  const clampedSpeed = Math.min(
    ELDORA_PHOTON_BEAM_SOURCE_SPEED_MAX,
    Math.max(ELDORA_PHOTON_BEAM_SOURCE_SPEED_MIN, sourceSpeed),
  )
  const sourceRange = ELDORA_PHOTON_BEAM_SOURCE_SPEED_MAX - ELDORA_PHOTON_BEAM_SOURCE_SPEED_MIN
  const displayRange = ELDORA_PHOTON_BEAM_DISPLAY_SPEED_MAX - ELDORA_PHOTON_BEAM_DISPLAY_SPEED_MIN
  return Math.round(
    ELDORA_PHOTON_BEAM_DISPLAY_SPEED_MIN
      + ((clampedSpeed - ELDORA_PHOTON_BEAM_SOURCE_SPEED_MIN) / sourceRange) * displayRange,
  )
}

export function getEldoraPhotonBeamSourceSpeed(displaySpeed: number) {
  const clampedDisplay = Math.min(
    ELDORA_PHOTON_BEAM_DISPLAY_SPEED_MAX,
    Math.max(ELDORA_PHOTON_BEAM_DISPLAY_SPEED_MIN, displaySpeed),
  )
  const sourceRange = ELDORA_PHOTON_BEAM_SOURCE_SPEED_MAX - ELDORA_PHOTON_BEAM_SOURCE_SPEED_MIN
  const displayRange = ELDORA_PHOTON_BEAM_DISPLAY_SPEED_MAX - ELDORA_PHOTON_BEAM_DISPLAY_SPEED_MIN
  return Math.round(
    (
      ELDORA_PHOTON_BEAM_SOURCE_SPEED_MIN
      + ((clampedDisplay - ELDORA_PHOTON_BEAM_DISPLAY_SPEED_MIN) / displayRange) * sourceRange
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
  reactBitsFerrofluidPaletteMode: ReactBitsFerrofluidPaletteMode
  reactBitsFerrofluidPrimaryColor: string
  reactBitsFerrofluidHarmony: ColorHarmony
  reactBitsFerrofluidColorOne: string
  reactBitsFerrofluidColorTwo: string
  reactBitsFerrofluidColorThree: string
  reactBitsFerrofluidSpeed: number
  reactBitsFerrofluidScale: number
  reactBitsFerrofluidTurbulence: number
  reactBitsFerrofluidFluidity: number
  reactBitsFerrofluidRimWidth: number
  reactBitsFerrofluidSharpness: number
  reactBitsFerrofluidShimmer: number
  reactBitsFerrofluidGlow: number
  reactBitsFerrofluidFlowDirection: "up" | "down" | "left" | "right"
  reactBitsFerrofluidOpacity: number
  reactBitsLightfallPaletteMode: ReactBitsLightfallPaletteMode
  reactBitsLightfallPrimaryColor: string
  reactBitsLightfallHarmony: ColorHarmony
  reactBitsLightfallColorOne: string
  reactBitsLightfallColorTwo: string
  reactBitsLightfallColorThree: string
  reactBitsLightfallBackgroundColor: string
  reactBitsLightfallSpeed: number
  reactBitsLightfallStreakCount: number
  reactBitsLightfallStreakWidth: number
  reactBitsLightfallStreakLength: number
  reactBitsLightfallGlow: number
  reactBitsLightfallDensity: number
  reactBitsLightfallTwinkle: number
  reactBitsLightfallZoom: number
  reactBitsLightfallBackgroundGlow: number
  reactBitsLightfallOpacity: number
  reactBitsLightfallCursorEnabled: boolean
  reactBitsLightfallCursorStrength: number
  reactBitsLightfallCursorRadius: number
  reactBitsLightfallCursorDampening: number
  reactBitsLiquidEtherPaletteMode: ReactBitsLiquidEtherPaletteMode
  reactBitsLiquidEtherPrimaryColor: string
  reactBitsLiquidEtherHarmony: ColorHarmony
  reactBitsLiquidEtherColorOne: string
  reactBitsLiquidEtherColorTwo: string
  reactBitsLiquidEtherColorThree: string
  reactBitsLiquidEtherCursorEnabled: boolean
  reactBitsLiquidEtherMouseForce: number
  reactBitsLiquidEtherCursorSize: number
  reactBitsLiquidEtherIsViscous: boolean
  reactBitsLiquidEtherViscous: number
  reactBitsLiquidEtherIterationsViscous: number
  reactBitsLiquidEtherIterationsPoisson: number
  reactBitsLiquidEtherDt: number
  reactBitsLiquidEtherBfecc: boolean
  reactBitsLiquidEtherResolution: number
  reactBitsLiquidEtherIsBounce: boolean
  reactBitsLiquidEtherAutoDemo: boolean
  reactBitsLiquidEtherAutoSpeed: number
  reactBitsLiquidEtherAutoIntensity: number
  reactBitsLiquidEtherAutoResumeDelay: number
  reactBitsLiquidEtherAutoRampDuration: number
  reactBitsLiquidEtherOpacity: number
  reactBitsPrismHeight: number
  reactBitsPrismBaseWidth: number
  reactBitsPrismAnimationType: ReactBitsPrismAnimationType
  reactBitsPrismGlow: number
  reactBitsPrismOffsetX: number
  reactBitsPrismOffsetY: number
  reactBitsPrismNoise: number
  reactBitsPrismTransparent: boolean
  reactBitsPrismScale: number
  reactBitsPrismHueShift: number
  reactBitsPrismColorFrequency: number
  reactBitsPrismHoverStrength: number
  reactBitsPrismInertia: number
  reactBitsPrismBloom: number
  reactBitsPrismTimeScale: number
  reactBitsDarkVeilHueShift: number
  reactBitsDarkVeilNoiseIntensity: number
  reactBitsDarkVeilScanlineIntensity: number
  reactBitsDarkVeilSpeed: number
  reactBitsDarkVeilScanlineFrequency: number
  reactBitsDarkVeilWarpAmount: number
  reactBitsDarkVeilResolutionScale: number
  reactBitsLightPillarPaletteMode: ReactBitsLightPillarPaletteMode
  reactBitsLightPillarPrimaryColor: string
  reactBitsLightPillarHarmony: ColorHarmony
  reactBitsLightPillarTopColor: string
  reactBitsLightPillarBottomColor: string
  reactBitsLightPillarIntensity: number
  reactBitsLightPillarRotationSpeed: number
  reactBitsLightPillarInteractive: boolean
  reactBitsLightPillarGlowAmount: number
  reactBitsLightPillarWidth: number
  reactBitsLightPillarHeight: number
  reactBitsLightPillarNoiseIntensity: number
  reactBitsLightPillarBlendMode: ReactBitsLightPillarBlendMode
  reactBitsLightPillarRotation: number
  reactBitsLightPillarQuality: ReactBitsLightPillarQuality
  reactBitsSilkPaletteMode: ReactBitsSilkPaletteMode
  reactBitsSilkPrimaryColor: string
  reactBitsSilkHarmony: ColorHarmony
  reactBitsSilkColor: string
  reactBitsSilkSpeed: number
  reactBitsSilkScale: number
  reactBitsSilkNoiseIntensity: number
  reactBitsSilkRotation: number
  reactBitsFloatingLinesPaletteMode: ReactBitsFloatingLinesPaletteMode
  reactBitsFloatingLinesPrimaryColor: string
  reactBitsFloatingLinesHarmony: ColorHarmony
  reactBitsFloatingLinesColorOne: string
  reactBitsFloatingLinesColorTwo: string
  reactBitsFloatingLinesColorThree: string
  reactBitsFloatingLinesEnableTop: boolean
  reactBitsFloatingLinesEnableMiddle: boolean
  reactBitsFloatingLinesEnableBottom: boolean
  reactBitsFloatingLinesTopLineCount: number
  reactBitsFloatingLinesMiddleLineCount: number
  reactBitsFloatingLinesBottomLineCount: number
  reactBitsFloatingLinesTopLineDistance: number
  reactBitsFloatingLinesMiddleLineDistance: number
  reactBitsFloatingLinesBottomLineDistance: number
  reactBitsFloatingLinesTopWaveX: number
  reactBitsFloatingLinesTopWaveY: number
  reactBitsFloatingLinesTopWaveRotate: number
  reactBitsFloatingLinesMiddleWaveX: number
  reactBitsFloatingLinesMiddleWaveY: number
  reactBitsFloatingLinesMiddleWaveRotate: number
  reactBitsFloatingLinesBottomWaveX: number
  reactBitsFloatingLinesBottomWaveY: number
  reactBitsFloatingLinesBottomWaveRotate: number
  reactBitsFloatingLinesAnimationSpeed: number
  reactBitsFloatingLinesInteractive: boolean
  reactBitsFloatingLinesBendRadius: number
  reactBitsFloatingLinesBendStrength: number
  reactBitsFloatingLinesMouseDamping: number
  reactBitsFloatingLinesParallax: boolean
  reactBitsFloatingLinesParallaxStrength: number
  reactBitsFloatingLinesBlendMode: ReactBitsFloatingLinesBlendMode
  reactBitsSideRaysPaletteMode: ReactBitsSideRaysPaletteMode
  reactBitsSideRaysPrimaryColor: string
  reactBitsSideRaysHarmony: ColorHarmony
  reactBitsSideRaysColorOne: string
  reactBitsSideRaysColorTwo: string
  reactBitsSideRaysSpeed: number
  reactBitsSideRaysIntensity: number
  reactBitsSideRaysSpread: number
  reactBitsSideRaysOrigin: ReactBitsSideRaysOrigin
  reactBitsSideRaysTilt: number
  reactBitsSideRaysSaturation: number
  reactBitsSideRaysBlend: number
  reactBitsSideRaysFalloff: number
  reactBitsSideRaysOpacity: number
  reactBitsLightRaysPaletteMode: ReactBitsLightRaysPaletteMode
  reactBitsLightRaysPrimaryColor: string
  reactBitsLightRaysHarmony: ColorHarmony
  reactBitsLightRaysColor: string
  reactBitsLightRaysOrigin: ReactBitsLightRaysOrigin
  reactBitsLightRaysSpeed: number
  reactBitsLightRaysSpread: number
  reactBitsLightRaysLength: number
  reactBitsLightRaysPulsating: boolean
  reactBitsLightRaysFadeDistance: number
  reactBitsLightRaysSaturation: number
  reactBitsLightRaysFollowMouse: boolean
  reactBitsLightRaysMouseInfluence: number
  reactBitsLightRaysNoiseAmount: number
  reactBitsLightRaysDistortion: number
  reactBitsPixelBlastPaletteMode: ReactBitsPixelBlastPaletteMode
  reactBitsPixelBlastPrimaryColor: string
  reactBitsPixelBlastHarmony: ColorHarmony
  reactBitsPixelBlastColor: string
  reactBitsPixelBlastVariant: ReactBitsPixelBlastVariant
  reactBitsPixelBlastPixelSize: number
  reactBitsPixelBlastAntialias: boolean
  reactBitsPixelBlastPatternScale: number
  reactBitsPixelBlastPatternDensity: number
  reactBitsPixelBlastLiquid: boolean
  reactBitsPixelBlastLiquidStrength: number
  reactBitsPixelBlastLiquidRadius: number
  reactBitsPixelBlastPixelSizeJitter: number
  reactBitsPixelBlastEnableRipples: boolean
  reactBitsPixelBlastRippleIntensityScale: number
  reactBitsPixelBlastRippleThickness: number
  reactBitsPixelBlastRippleSpeed: number
  reactBitsPixelBlastLiquidWobbleSpeed: number
  reactBitsPixelBlastAutoPauseOffscreen: boolean
  reactBitsPixelBlastSpeed: number
  reactBitsPixelBlastTransparent: boolean
  reactBitsPixelBlastEdgeFade: number
  reactBitsPixelBlastNoiseAmount: number
  reactBitsColorBendsPaletteMode: ReactBitsColorBendsPaletteMode
  reactBitsColorBendsPrimaryColor: string
  reactBitsColorBendsHarmony: ColorHarmony
  reactBitsColorBendsColorOne: string
  reactBitsColorBendsColorTwo: string
  reactBitsColorBendsColorThree: string
  reactBitsColorBendsColorFour: string
  reactBitsColorBendsRotation: number
  reactBitsColorBendsSpeed: number
  reactBitsColorBendsTransparent: boolean
  reactBitsColorBendsAutoRotate: number
  reactBitsColorBendsScale: number
  reactBitsColorBendsFrequency: number
  reactBitsColorBendsWarpStrength: number
  reactBitsColorBendsInteractive: boolean
  reactBitsColorBendsMouseInfluence: number
  reactBitsColorBendsParallax: number
  reactBitsColorBendsNoise: number
  reactBitsColorBendsIterations: number
  reactBitsColorBendsIntensity: number
  reactBitsColorBendsBandWidth: number
  reactBitsEvilEyePaletteMode: ReactBitsEvilEyePaletteMode
  reactBitsEvilEyePrimaryColor: string
  reactBitsEvilEyeHarmony: ColorHarmony
  reactBitsEvilEyeColor: string
  reactBitsEvilEyeBackgroundColor: string
  reactBitsEvilEyeIntensity: number
  reactBitsEvilEyePupilSize: number
  reactBitsEvilEyeIrisWidth: number
  reactBitsEvilEyeGlowIntensity: number
  reactBitsEvilEyeScale: number
  reactBitsEvilEyeNoiseScale: number
  reactBitsEvilEyePupilFollow: number
  reactBitsEvilEyeFlameSpeed: number
  reactBitsEvilEyeInteractive: boolean
  reactBitsLineWavesPaletteMode: ReactBitsLineWavesPaletteMode
  reactBitsLineWavesPrimaryColor: string
  reactBitsLineWavesHarmony: ColorHarmony
  reactBitsLineWavesColorOne: string
  reactBitsLineWavesColorTwo: string
  reactBitsLineWavesColorThree: string
  reactBitsLineWavesSpeed: number
  reactBitsLineWavesInnerLineCount: number
  reactBitsLineWavesOuterLineCount: number
  reactBitsLineWavesWarpIntensity: number
  reactBitsLineWavesRotation: number
  reactBitsLineWavesEdgeFadeWidth: number
  reactBitsLineWavesColorCycleSpeed: number
  reactBitsLineWavesBrightness: number
  reactBitsLineWavesEnableMouseInteraction: boolean
  reactBitsLineWavesMouseInfluence: number
  reactBitsRadarPaletteMode: ReactBitsRadarPaletteMode
  reactBitsRadarPrimaryColor: string
  reactBitsRadarHarmony: ColorHarmony
  reactBitsRadarColor: string
  reactBitsRadarBackgroundColor: string
  reactBitsRadarSpeed: number
  reactBitsRadarScale: number
  reactBitsRadarRingCount: number
  reactBitsRadarSpokeCount: number
  reactBitsRadarRingThickness: number
  reactBitsRadarSpokeThickness: number
  reactBitsRadarSweepSpeed: number
  reactBitsRadarSweepWidth: number
  reactBitsRadarSweepLobes: number
  reactBitsRadarFalloff: number
  reactBitsRadarBrightness: number
  reactBitsRadarEnableMouseInteraction: boolean
  reactBitsRadarMouseInfluence: number
  reactBitsSoftAuroraPaletteMode: ReactBitsSoftAuroraPaletteMode
  reactBitsSoftAuroraPrimaryColor: string
  reactBitsSoftAuroraHarmony: ColorHarmony
  reactBitsSoftAuroraColorOne: string
  reactBitsSoftAuroraColorTwo: string
  reactBitsSoftAuroraSpeed: number
  reactBitsSoftAuroraScale: number
  reactBitsSoftAuroraBrightness: number
  reactBitsSoftAuroraNoiseFrequency: number
  reactBitsSoftAuroraNoiseAmplitude: number
  reactBitsSoftAuroraBandHeight: number
  reactBitsSoftAuroraBandSpread: number
  reactBitsSoftAuroraOctaveDecay: number
  reactBitsSoftAuroraLayerOffset: number
  reactBitsSoftAuroraColorSpeed: number
  reactBitsSoftAuroraEnableMouseInteraction: boolean
  reactBitsSoftAuroraMouseInfluence: number
  reactBitsPlasmaPaletteMode: ReactBitsPlasmaPaletteMode
  reactBitsPlasmaPrimaryColor: string
  reactBitsPlasmaHarmony: ColorHarmony
  reactBitsPlasmaColor: string
  reactBitsPlasmaSpeed: number
  reactBitsPlasmaDirection: ReactBitsPlasmaDirection
  reactBitsPlasmaScale: number
  reactBitsPlasmaOpacity: number
  reactBitsPlasmaMouseInteractive: boolean
  reactBitsPlasmaWavePaletteMode: ReactBitsPlasmaWavePaletteMode
  reactBitsPlasmaWavePrimaryColor: string
  reactBitsPlasmaWaveHarmony: ColorHarmony
  reactBitsPlasmaWaveColorOne: string
  reactBitsPlasmaWaveColorTwo: string
  reactBitsPlasmaWaveXOffset: number
  reactBitsPlasmaWaveYOffset: number
  reactBitsPlasmaWaveRotationDeg: number
  reactBitsPlasmaWaveFocalLength: number
  reactBitsPlasmaWaveSpeedOne: number
  reactBitsPlasmaWaveSpeedTwo: number
  reactBitsPlasmaWaveDirectionTwo: 1 | -1
  reactBitsPlasmaWaveBendOne: number
  reactBitsPlasmaWaveBendTwo: number
  reactBitsParticlesPaletteMode: ReactBitsParticlesPaletteMode
  reactBitsParticlesPrimaryColor: string
  reactBitsParticlesHarmony: ColorHarmony
  reactBitsParticlesColorOne: string
  reactBitsParticlesColorTwo: string
  reactBitsParticlesColorThree: string
  reactBitsParticlesCount: number
  reactBitsParticlesSpread: number
  reactBitsParticlesSpeed: number
  reactBitsParticlesMoveOnHover: boolean
  reactBitsParticlesHoverFactor: number
  reactBitsParticlesAlpha: boolean
  reactBitsParticlesBaseSize: number
  reactBitsParticlesSizeRandomness: number
  reactBitsParticlesCameraDistance: number
  reactBitsParticlesDisableRotation: boolean
  reactBitsParticlesPixelRatio: number
  reactBitsGradientBlindsPaletteMode: ReactBitsGradientBlindsPaletteMode
  reactBitsGradientBlindsPrimaryColor: string
  reactBitsGradientBlindsHarmony: ColorHarmony
  reactBitsGradientBlindsColorOne: string
  reactBitsGradientBlindsColorTwo: string
  reactBitsGradientBlindsAngle: number
  reactBitsGradientBlindsNoise: number
  reactBitsGradientBlindsBlindCount: number
  reactBitsGradientBlindsBlindMinWidth: number
  reactBitsGradientBlindsMouseDampening: number
  reactBitsGradientBlindsMirror: boolean
  reactBitsGradientBlindsSpotlightRadius: number
  reactBitsGradientBlindsSpotlightSoftness: number
  reactBitsGradientBlindsSpotlightOpacity: number
  reactBitsGradientBlindsDistort: number
  reactBitsGradientBlindsShineDirection: ReactBitsGradientBlindsShineDirection
  reactBitsGradientBlindsBlendMode: ReactBitsGradientBlindsBlendMode
  reactBitsGradientBlindsDpr: number
  reactBitsGradientBlindsEnableMouseInteraction: boolean
  reactBitsGrainientPaletteMode: ReactBitsGrainientPaletteMode
  reactBitsGrainientPrimaryColor: string
  reactBitsGrainientHarmony: ColorHarmony
  reactBitsGrainientColorOne: string
  reactBitsGrainientColorTwo: string
  reactBitsGrainientColorThree: string
  reactBitsGrainientTimeSpeed: number
  reactBitsGrainientColorBalance: number
  reactBitsGrainientWarpStrength: number
  reactBitsGrainientWarpFrequency: number
  reactBitsGrainientWarpSpeed: number
  reactBitsGrainientWarpAmplitude: number
  reactBitsGrainientBlendAngle: number
  reactBitsGrainientBlendSoftness: number
  reactBitsGrainientRotationAmount: number
  reactBitsGrainientNoiseScale: number
  reactBitsGrainientGrainAmount: number
  reactBitsGrainientGrainScale: number
  reactBitsGrainientGrainAnimated: boolean
  reactBitsGrainientContrast: number
  reactBitsGrainientGamma: number
  reactBitsGrainientSaturation: number
  reactBitsGrainientCenterX: number
  reactBitsGrainientCenterY: number
  reactBitsGrainientZoom: number
  reactBitsGridScanPaletteMode: ReactBitsGridScanPaletteMode
  reactBitsGridScanPrimaryColor: string
  reactBitsGridScanHarmony: ColorHarmony
  reactBitsGridScanLinesColor: string
  reactBitsGridScanScanColor: string
  reactBitsGridScanSensitivity: number
  reactBitsGridScanLineThickness: number
  reactBitsGridScanScanOpacity: number
  reactBitsGridScanGridScale: number
  reactBitsGridScanLineStyle: ReactBitsGridScanLineStyle
  reactBitsGridScanLineJitter: number
  reactBitsGridScanDirection: ReactBitsGridScanDirection
  reactBitsGridScanNoiseIntensity: number
  reactBitsGridScanBloomOpacity: number
  reactBitsGridScanScanGlow: number
  reactBitsGridScanScanSoftness: number
  reactBitsGridScanPhaseTaper: number
  reactBitsGridScanScanDuration: number
  reactBitsGridScanScanDelay: number
  reactBitsGridScanEnablePointerInteraction: boolean
  reactBitsGridScanScanOnClick: boolean
  reactBitsBeamsPaletteMode: ReactBitsBeamsPaletteMode
  reactBitsBeamsPrimaryColor: string
  reactBitsBeamsHarmony: ColorHarmony
  reactBitsBeamsLightColor: string
  reactBitsBeamsBeamWidth: number
  reactBitsBeamsBeamHeight: number
  reactBitsBeamsBeamNumber: number
  reactBitsBeamsSpeed: number
  reactBitsBeamsNoiseIntensity: number
  reactBitsBeamsScale: number
  reactBitsBeamsRotation: number
  reactBitsPixelSnowPaletteMode: ReactBitsPixelSnowPaletteMode
  reactBitsPixelSnowPrimaryColor: string
  reactBitsPixelSnowHarmony: ColorHarmony
  reactBitsPixelSnowColor: string
  reactBitsPixelSnowFlakeSize: number
  reactBitsPixelSnowMinFlakeSize: number
  reactBitsPixelSnowPixelResolution: number
  reactBitsPixelSnowSpeed: number
  reactBitsPixelSnowDepthFade: number
  reactBitsPixelSnowFarPlane: number
  reactBitsPixelSnowBrightness: number
  reactBitsPixelSnowGamma: number
  reactBitsPixelSnowDensity: number
  reactBitsPixelSnowVariant: ReactBitsPixelSnowVariant
  reactBitsPixelSnowDirection: number
  reactBitsLightningPaletteMode: ReactBitsLightningPaletteMode
  reactBitsLightningPrimaryColor: string
  reactBitsLightningHarmony: ColorHarmony
  reactBitsLightningColor: string
  reactBitsLightningHue: number
  reactBitsLightningXOffset: number
  reactBitsLightningSpeed: number
  reactBitsLightningIntensity: number
  reactBitsLightningSize: number
  reactBitsPrismaticBurstPaletteMode: ReactBitsPrismaticBurstPaletteMode
  reactBitsPrismaticBurstPrimaryColor: string
  reactBitsPrismaticBurstHarmony: ColorHarmony
  reactBitsPrismaticBurstColorOne: string
  reactBitsPrismaticBurstColorTwo: string
  reactBitsPrismaticBurstColorThree: string
  reactBitsPrismaticBurstColorFour: string
  reactBitsPrismaticBurstIntensity: number
  reactBitsPrismaticBurstSpeed: number
  reactBitsPrismaticBurstAnimationType: ReactBitsPrismaticBurstAnimationType
  reactBitsPrismaticBurstDistort: number
  reactBitsPrismaticBurstOffsetX: number
  reactBitsPrismaticBurstOffsetY: number
  reactBitsPrismaticBurstHoverDampness: number
  reactBitsPrismaticBurstRayCount: number
  reactBitsPrismaticBurstMixBlendMode: ReactBitsPrismaticBurstMixBlendMode
  reactBitsGalaxyPaletteMode: ReactBitsGalaxyPaletteMode
  reactBitsGalaxyPrimaryColor: string
  reactBitsGalaxyHarmony: ColorHarmony
  reactBitsGalaxyColor: string
  reactBitsGalaxyHueShift: number
  reactBitsGalaxyFocalX: number
  reactBitsGalaxyFocalY: number
  reactBitsGalaxyRotationDeg: number
  reactBitsGalaxyStarSpeed: number
  reactBitsGalaxyDensity: number
  reactBitsGalaxySpeed: number
  reactBitsGalaxyMouseInteraction: boolean
  reactBitsGalaxyGlowIntensity: number
  reactBitsGalaxySaturation: number
  reactBitsGalaxyMouseRepulsion: boolean
  reactBitsGalaxyRepulsionStrength: number
  reactBitsGalaxyTwinkleIntensity: number
  reactBitsGalaxyRotationSpeed: number
  reactBitsGalaxyAutoCenterRepulsion: number
  reactBitsGalaxyTransparent: boolean
  reactBitsDitherPaletteMode: ReactBitsDitherPaletteMode
  reactBitsDitherPrimaryColor: string
  reactBitsDitherHarmony: ColorHarmony
  reactBitsDitherColor: string
  reactBitsDitherWaveSpeed: number
  reactBitsDitherWaveFrequency: number
  reactBitsDitherWaveAmplitude: number
  reactBitsDitherColorNum: number
  reactBitsDitherPixelSize: number
  reactBitsDitherMouseInteraction: boolean
  reactBitsDitherMouseRadius: number
  reactBitsFaultyTerminalPaletteMode: ReactBitsFaultyTerminalPaletteMode
  reactBitsFaultyTerminalPrimaryColor: string
  reactBitsFaultyTerminalHarmony: ColorHarmony
  reactBitsFaultyTerminalTint: string
  reactBitsFaultyTerminalScale: number
  reactBitsFaultyTerminalGridMulX: number
  reactBitsFaultyTerminalGridMulY: number
  reactBitsFaultyTerminalDigitSize: number
  reactBitsFaultyTerminalTimeScale: number
  reactBitsFaultyTerminalScanlineIntensity: number
  reactBitsFaultyTerminalGlitchAmount: number
  reactBitsFaultyTerminalFlickerAmount: number
  reactBitsFaultyTerminalNoiseAmp: number
  reactBitsFaultyTerminalChromaticAberration: number
  reactBitsFaultyTerminalDither: number
  reactBitsFaultyTerminalCurvature: number
  reactBitsFaultyTerminalMouseReact: boolean
  reactBitsFaultyTerminalMouseStrength: number
  reactBitsFaultyTerminalPageLoadAnimation: boolean
  reactBitsFaultyTerminalBrightness: number
  reactBitsRippleGridPaletteMode: ReactBitsRippleGridPaletteMode
  reactBitsRippleGridPrimaryColor: string
  reactBitsRippleGridHarmony: ColorHarmony
  reactBitsRippleGridColor: string
  reactBitsRippleGridRippleIntensity: number
  reactBitsRippleGridGridSize: number
  reactBitsRippleGridGridThickness: number
  reactBitsRippleGridFadeDistance: number
  reactBitsRippleGridVignetteStrength: number
  reactBitsRippleGridGlowIntensity: number
  reactBitsRippleGridOpacity: number
  reactBitsRippleGridGridRotation: number
  reactBitsRippleGridMouseInteraction: boolean
  reactBitsRippleGridMouseInteractionRadius: number
  reactBitsDotFieldPaletteMode: ReactBitsDotFieldPaletteMode
  reactBitsDotFieldPrimaryColor: string
  reactBitsDotFieldHarmony: ColorHarmony
  reactBitsDotFieldGradientFromColor: string
  reactBitsDotFieldGradientFromAlpha: number
  reactBitsDotFieldGradientToColor: string
  reactBitsDotFieldGradientToAlpha: number
  reactBitsDotFieldGlowColor: string
  reactBitsDotFieldDotRadius: number
  reactBitsDotFieldDotSpacing: number
  reactBitsDotFieldCursorRadius: number
  reactBitsDotFieldCursorForce: number
  reactBitsDotFieldBulgeOnly: boolean
  reactBitsDotFieldBulgeStrength: number
  reactBitsDotFieldGlowRadius: number
  reactBitsDotFieldSparkle: boolean
  reactBitsDotFieldWaveAmplitude: number
  reactBitsDotFieldCursorInteraction: boolean
  reactBitsDotGridPaletteMode: ReactBitsDotGridPaletteMode
  reactBitsDotGridPrimaryColor: string
  reactBitsDotGridHarmony: ColorHarmony
  reactBitsDotGridBaseColor: string
  reactBitsDotGridActiveColor: string
  reactBitsDotGridDotSize: number
  reactBitsDotGridGap: number
  reactBitsDotGridProximity: number
  reactBitsDotGridSpeedTrigger: number
  reactBitsDotGridShockRadius: number
  reactBitsDotGridShockStrength: number
  reactBitsDotGridMaxSpeed: number
  reactBitsDotGridResistance: number
  reactBitsDotGridReturnDuration: number
  reactBitsDotGridCursorInteraction: boolean
  reactBitsDotGridClickShock: boolean
  reactBitsThreadsPaletteMode: ReactBitsThreadsPaletteMode
  reactBitsThreadsPrimaryColor: string
  reactBitsThreadsHarmony: ColorHarmony
  reactBitsThreadsColor: string
  reactBitsThreadsAmplitude: number
  reactBitsThreadsDistance: number
  reactBitsThreadsEnableMouseInteraction: boolean
  reactBitsIridescencePaletteMode: ReactBitsIridescencePaletteMode
  reactBitsIridescencePrimaryColor: string
  reactBitsIridescenceHarmony: ColorHarmony
  reactBitsIridescenceColor: string
  reactBitsIridescenceSpeed: number
  reactBitsIridescenceAmplitude: number
  reactBitsIridescenceMouseReact: boolean
  reactBitsWavesPaletteMode: ReactBitsWavesPaletteMode
  reactBitsWavesPrimaryColor: string
  reactBitsWavesHarmony: ColorHarmony
  reactBitsWavesLineColor: string
  reactBitsWavesBackgroundColor: string
  reactBitsWavesTransparentBackground: boolean
  reactBitsWavesSpeedX: number
  reactBitsWavesSpeedY: number
  reactBitsWavesAmplitudeX: number
  reactBitsWavesAmplitudeY: number
  reactBitsWavesGapX: number
  reactBitsWavesGapY: number
  reactBitsWavesFriction: number
  reactBitsWavesTension: number
  reactBitsWavesMaxCursorMove: number
  reactBitsWavesCursorInteraction: boolean
  reactBitsGridDistortionPaletteMode: ReactBitsGridDistortionPaletteMode
  reactBitsGridDistortionPrimaryColor: string
  reactBitsGridDistortionHarmony: ColorHarmony
  reactBitsGridDistortionColorOne: string
  reactBitsGridDistortionColorTwo: string
  reactBitsGridDistortionColorThree: string
  reactBitsGridDistortionGrid: number
  reactBitsGridDistortionMouse: number
  reactBitsGridDistortionStrength: number
  reactBitsGridDistortionRelaxation: number
  reactBitsGridDistortionCursorInteraction: boolean
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
  eldoraPhotonBeamPaletteMode: EldoraPhotonBeamPaletteMode
  eldoraPhotonBeamPrimaryColor: string
  eldoraPhotonBeamHarmony: ColorHarmony
  eldoraPhotonBeamColorBg: string
  eldoraPhotonBeamColorLine: string
  eldoraPhotonBeamColorSignal: string
  eldoraPhotonBeamUseColor2: boolean
  eldoraPhotonBeamColorSignal2: string
  eldoraPhotonBeamUseColor3: boolean
  eldoraPhotonBeamColorSignal3: string
  eldoraPhotonBeamLineCount: number
  eldoraPhotonBeamSpreadHeight: number
  eldoraPhotonBeamSpreadDepth: number
  eldoraPhotonBeamCurveLength: number
  eldoraPhotonBeamStraightLength: number
  eldoraPhotonBeamCurvePower: number
  eldoraPhotonBeamWaveSpeed: number
  eldoraPhotonBeamWaveHeight: number
  eldoraPhotonBeamLineOpacity: number
  eldoraPhotonBeamSignalCount: number
  eldoraPhotonBeamSpeedGlobal: number
  eldoraPhotonBeamTrailLength: number
  eldoraPhotonBeamBloomStrength: number
  eldoraPhotonBeamBloomRadius: number
  aceternity3DGlobeViewStyle: "realistic" | "graphic"
  aceternity3DGlobeBackgroundColor: string
  aceternity3DGlobeGlobeColor: string
  aceternity3DGlobeGraphicMapColor: string
  aceternity3DGlobeGraphicGlowColor: string
  aceternity3DGlobeGraphicMarkerColor: string
  aceternity3DGlobeGraphicMapSamples: number
  aceternity3DGlobeAutoRotateSpeed: number
  aceternity3DGlobeReverseSpin: boolean
  aceternity3DGlobeScale: number
  aceternity3DGlobeBumpScale: number
  aceternity3DGlobeAmbientIntensity: number
  aceternity3DGlobePointLightIntensity: number
  aceternity3DGlobeLightingMode: "manual" | "sun"
  aceternity3DGlobeEnablePan: boolean
  aceternity3DGlobePanX: number
  aceternity3DGlobePanY: number
  aceternity3DGlobeShowTilt: boolean
  aceternity3DGlobeShowAtmosphere: boolean
  aceternity3DGlobeAtmosphereColor: string
  aceternity3DGlobeAtmosphereIntensity: number
  aceternity3DGlobeAtmosphereBlur: number
  aceternity3DGlobeShowWireframe: boolean
  aceternity3DGlobeWireframeColor: string
  aceternity3DGlobeMarkerEnabled: boolean
  aceternity3DGlobeMarkerLat: number
  aceternity3DGlobeMarkerLng: number
  aceternity3DGlobeMarkerLabel: string
  aceternity3DGlobeMarkerIcon: "pin" | "person" | "heart" | "star" | "home"
  aceternity3DGlobeMarkerSize: number
  magicRetroGridBackgroundColor: string
  magicRetroGridLightLineColor: string
  magicRetroGridDarkLineColor: string
  magicRetroGridAngle: number
  magicRetroGridCellSize: number
  magicRetroGridOpacity: number
  magicLightRaysBackgroundColor: string
  magicLightRaysColor: string
  magicLightRaysCount: number
  magicLightRaysBlur: number
  magicLightRaysSpeed: number
  magicLightRaysLength: number
  magicLightRaysOpacity: number
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

type ReactBitsFerrofluidColorSettings = Pick<
  ChimerSettings,
  | "reactBitsFerrofluidPaletteMode"
  | "reactBitsFerrofluidPrimaryColor"
  | "reactBitsFerrofluidHarmony"
  | "reactBitsFerrofluidColorOne"
  | "reactBitsFerrofluidColorTwo"
  | "reactBitsFerrofluidColorThree"
>

type ReactBitsLightfallColorSettings = Pick<
  ChimerSettings,
  | "reactBitsLightfallPaletteMode"
  | "reactBitsLightfallPrimaryColor"
  | "reactBitsLightfallHarmony"
  | "reactBitsLightfallColorOne"
  | "reactBitsLightfallColorTwo"
  | "reactBitsLightfallColorThree"
>

type ReactBitsLiquidEtherColorSettings = Pick<
  ChimerSettings,
  | "reactBitsLiquidEtherPaletteMode"
  | "reactBitsLiquidEtherPrimaryColor"
  | "reactBitsLiquidEtherHarmony"
  | "reactBitsLiquidEtherColorOne"
  | "reactBitsLiquidEtherColorTwo"
  | "reactBitsLiquidEtherColorThree"
>

type ReactBitsLightPillarColorSettings = Pick<
  ChimerSettings,
  | "reactBitsLightPillarPaletteMode"
  | "reactBitsLightPillarPrimaryColor"
  | "reactBitsLightPillarHarmony"
  | "reactBitsLightPillarTopColor"
  | "reactBitsLightPillarBottomColor"
>

type ReactBitsSilkColorSettings = Pick<
  ChimerSettings,
  | "reactBitsSilkPaletteMode"
  | "reactBitsSilkPrimaryColor"
  | "reactBitsSilkHarmony"
  | "reactBitsSilkColor"
>

type ReactBitsFloatingLinesColorSettings = Pick<
  ChimerSettings,
  | "reactBitsFloatingLinesPaletteMode"
  | "reactBitsFloatingLinesPrimaryColor"
  | "reactBitsFloatingLinesHarmony"
  | "reactBitsFloatingLinesColorOne"
  | "reactBitsFloatingLinesColorTwo"
  | "reactBitsFloatingLinesColorThree"
>

type ReactBitsSideRaysColorSettings = Pick<
  ChimerSettings,
  | "reactBitsSideRaysPaletteMode"
  | "reactBitsSideRaysPrimaryColor"
  | "reactBitsSideRaysHarmony"
  | "reactBitsSideRaysColorOne"
  | "reactBitsSideRaysColorTwo"
>

type ReactBitsLightRaysColorSettings = Pick<
  ChimerSettings,
  | "reactBitsLightRaysPaletteMode"
  | "reactBitsLightRaysPrimaryColor"
  | "reactBitsLightRaysHarmony"
  | "reactBitsLightRaysColor"
>

type ReactBitsPixelBlastColorSettings = Pick<
  ChimerSettings,
  | "reactBitsPixelBlastPaletteMode"
  | "reactBitsPixelBlastPrimaryColor"
  | "reactBitsPixelBlastHarmony"
  | "reactBitsPixelBlastColor"
>

type ReactBitsColorBendsColorSettings = Pick<
  ChimerSettings,
  | "reactBitsColorBendsPaletteMode"
  | "reactBitsColorBendsPrimaryColor"
  | "reactBitsColorBendsHarmony"
  | "reactBitsColorBendsColorOne"
  | "reactBitsColorBendsColorTwo"
  | "reactBitsColorBendsColorThree"
  | "reactBitsColorBendsColorFour"
>

type ReactBitsEvilEyeColorSettings = Pick<
  ChimerSettings,
  | "reactBitsEvilEyePaletteMode"
  | "reactBitsEvilEyePrimaryColor"
  | "reactBitsEvilEyeHarmony"
  | "reactBitsEvilEyeColor"
>

type ReactBitsLineWavesColorSettings = Pick<
  ChimerSettings,
  | "reactBitsLineWavesPaletteMode"
  | "reactBitsLineWavesPrimaryColor"
  | "reactBitsLineWavesHarmony"
  | "reactBitsLineWavesColorOne"
  | "reactBitsLineWavesColorTwo"
  | "reactBitsLineWavesColorThree"
>

type ReactBitsRadarColorSettings = Pick<
  ChimerSettings,
  | "reactBitsRadarPaletteMode"
  | "reactBitsRadarPrimaryColor"
  | "reactBitsRadarHarmony"
  | "reactBitsRadarColor"
>

type ReactBitsSoftAuroraColorSettings = Pick<
  ChimerSettings,
  | "reactBitsSoftAuroraPaletteMode"
  | "reactBitsSoftAuroraPrimaryColor"
  | "reactBitsSoftAuroraHarmony"
  | "reactBitsSoftAuroraColorOne"
  | "reactBitsSoftAuroraColorTwo"
>

type ReactBitsPlasmaColorSettings = Pick<
  ChimerSettings,
  | "reactBitsPlasmaPaletteMode"
  | "reactBitsPlasmaPrimaryColor"
  | "reactBitsPlasmaHarmony"
  | "reactBitsPlasmaColor"
>

type ReactBitsPlasmaWaveColorSettings = Pick<
  ChimerSettings,
  | "reactBitsPlasmaWavePaletteMode"
  | "reactBitsPlasmaWavePrimaryColor"
  | "reactBitsPlasmaWaveHarmony"
  | "reactBitsPlasmaWaveColorOne"
  | "reactBitsPlasmaWaveColorTwo"
>

type ReactBitsParticlesColorSettings = Pick<
  ChimerSettings,
  | "reactBitsParticlesPaletteMode"
  | "reactBitsParticlesPrimaryColor"
  | "reactBitsParticlesHarmony"
  | "reactBitsParticlesColorOne"
  | "reactBitsParticlesColorTwo"
  | "reactBitsParticlesColorThree"
>

type ReactBitsGradientBlindsColorSettings = Pick<
  ChimerSettings,
  | "reactBitsGradientBlindsPaletteMode"
  | "reactBitsGradientBlindsPrimaryColor"
  | "reactBitsGradientBlindsHarmony"
  | "reactBitsGradientBlindsColorOne"
  | "reactBitsGradientBlindsColorTwo"
>

type ReactBitsGrainientColorSettings = Pick<
  ChimerSettings,
  | "reactBitsGrainientPaletteMode"
  | "reactBitsGrainientPrimaryColor"
  | "reactBitsGrainientHarmony"
  | "reactBitsGrainientColorOne"
  | "reactBitsGrainientColorTwo"
  | "reactBitsGrainientColorThree"
>

type ReactBitsGridScanColorSettings = Pick<
  ChimerSettings,
  | "reactBitsGridScanPaletteMode"
  | "reactBitsGridScanPrimaryColor"
  | "reactBitsGridScanHarmony"
  | "reactBitsGridScanLinesColor"
  | "reactBitsGridScanScanColor"
>

type ReactBitsBeamsColorSettings = Pick<
  ChimerSettings,
  | "reactBitsBeamsPaletteMode"
  | "reactBitsBeamsPrimaryColor"
  | "reactBitsBeamsHarmony"
  | "reactBitsBeamsLightColor"
>

type ReactBitsPixelSnowColorSettings = Pick<
  ChimerSettings,
  | "reactBitsPixelSnowPaletteMode"
  | "reactBitsPixelSnowPrimaryColor"
  | "reactBitsPixelSnowHarmony"
  | "reactBitsPixelSnowColor"
>

type ReactBitsLightningColorSettings = Pick<
  ChimerSettings,
  | "reactBitsLightningPaletteMode"
  | "reactBitsLightningPrimaryColor"
  | "reactBitsLightningHarmony"
  | "reactBitsLightningColor"
  | "reactBitsLightningHue"
>

type ReactBitsPrismaticBurstColorSettings = Pick<
  ChimerSettings,
  | "reactBitsPrismaticBurstPaletteMode"
  | "reactBitsPrismaticBurstPrimaryColor"
  | "reactBitsPrismaticBurstHarmony"
  | "reactBitsPrismaticBurstColorOne"
  | "reactBitsPrismaticBurstColorTwo"
  | "reactBitsPrismaticBurstColorThree"
  | "reactBitsPrismaticBurstColorFour"
>

type ReactBitsGalaxyColorSettings = Pick<
  ChimerSettings,
  | "reactBitsGalaxyPaletteMode"
  | "reactBitsGalaxyPrimaryColor"
  | "reactBitsGalaxyHarmony"
  | "reactBitsGalaxyColor"
  | "reactBitsGalaxyHueShift"
>

type ReactBitsDitherColorSettings = Pick<
  ChimerSettings,
  | "reactBitsDitherPaletteMode"
  | "reactBitsDitherPrimaryColor"
  | "reactBitsDitherHarmony"
  | "reactBitsDitherColor"
>

type ReactBitsFaultyTerminalColorSettings = Pick<
  ChimerSettings,
  | "reactBitsFaultyTerminalPaletteMode"
  | "reactBitsFaultyTerminalPrimaryColor"
  | "reactBitsFaultyTerminalHarmony"
  | "reactBitsFaultyTerminalTint"
>

type ReactBitsRippleGridColorSettings = Pick<
  ChimerSettings,
  | "reactBitsRippleGridPaletteMode"
  | "reactBitsRippleGridPrimaryColor"
  | "reactBitsRippleGridHarmony"
  | "reactBitsRippleGridColor"
>

type ReactBitsDotFieldColorSettings = Pick<
  ChimerSettings,
  | "reactBitsDotFieldPaletteMode"
  | "reactBitsDotFieldPrimaryColor"
  | "reactBitsDotFieldHarmony"
  | "reactBitsDotFieldGradientFromColor"
  | "reactBitsDotFieldGradientFromAlpha"
  | "reactBitsDotFieldGradientToColor"
  | "reactBitsDotFieldGradientToAlpha"
  | "reactBitsDotFieldGlowColor"
>

type ReactBitsDotGridColorSettings = Pick<
  ChimerSettings,
  | "reactBitsDotGridPaletteMode"
  | "reactBitsDotGridPrimaryColor"
  | "reactBitsDotGridHarmony"
  | "reactBitsDotGridBaseColor"
  | "reactBitsDotGridActiveColor"
>

type ReactBitsThreadsColorSettings = Pick<
  ChimerSettings,
  | "reactBitsThreadsPaletteMode"
  | "reactBitsThreadsPrimaryColor"
  | "reactBitsThreadsHarmony"
  | "reactBitsThreadsColor"
>

type ReactBitsIridescenceColorSettings = Pick<
  ChimerSettings,
  | "reactBitsIridescencePaletteMode"
  | "reactBitsIridescencePrimaryColor"
  | "reactBitsIridescenceHarmony"
  | "reactBitsIridescenceColor"
>

type ReactBitsWavesColorSettings = Pick<
  ChimerSettings,
  | "reactBitsWavesPaletteMode"
  | "reactBitsWavesPrimaryColor"
  | "reactBitsWavesHarmony"
  | "reactBitsWavesLineColor"
>

type ReactBitsGridDistortionColorSettings = Pick<
  ChimerSettings,
  | "reactBitsGridDistortionPaletteMode"
  | "reactBitsGridDistortionPrimaryColor"
  | "reactBitsGridDistortionHarmony"
  | "reactBitsGridDistortionColorOne"
  | "reactBitsGridDistortionColorTwo"
  | "reactBitsGridDistortionColorThree"
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

type EldoraPhotonBeamColorSettings = Pick<
  ChimerSettings,
  | "eldoraPhotonBeamPaletteMode"
  | "eldoraPhotonBeamPrimaryColor"
  | "eldoraPhotonBeamHarmony"
  | "eldoraPhotonBeamColorBg"
  | "eldoraPhotonBeamColorLine"
  | "eldoraPhotonBeamColorSignal"
  | "eldoraPhotonBeamUseColor2"
  | "eldoraPhotonBeamColorSignal2"
  | "eldoraPhotonBeamUseColor3"
  | "eldoraPhotonBeamColorSignal3"
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

export function resolveReactBitsFerrofluidColors(settings: ReactBitsFerrofluidColorSettings): [string, string, string] {
  if (settings.reactBitsFerrofluidPaletteMode === "harmony") {
    return createReactBitsFerrofluidHarmonyPalette(
      settings.reactBitsFerrofluidPrimaryColor,
      settings.reactBitsFerrofluidHarmony,
    )
  }

  return [
    settings.reactBitsFerrofluidColorOne,
    settings.reactBitsFerrofluidColorTwo,
    settings.reactBitsFerrofluidColorThree,
  ]
}

export function resolveReactBitsLightfallColors(settings: ReactBitsLightfallColorSettings): [string, string, string] {
  if (settings.reactBitsLightfallPaletteMode === "harmony") {
    return createReactBitsLightfallHarmonyPalette(
      settings.reactBitsLightfallPrimaryColor,
      settings.reactBitsLightfallHarmony,
    )
  }

  return [
    settings.reactBitsLightfallColorOne,
    settings.reactBitsLightfallColorTwo,
    settings.reactBitsLightfallColorThree,
  ]
}

export function resolveReactBitsLiquidEtherColors(
  settings: ReactBitsLiquidEtherColorSettings,
): [string, string, string] {
  if (settings.reactBitsLiquidEtherPaletteMode === "harmony") {
    return createReactBitsLiquidEtherHarmonyPalette(
      settings.reactBitsLiquidEtherPrimaryColor,
      settings.reactBitsLiquidEtherHarmony,
    )
  }

  return [
    settings.reactBitsLiquidEtherColorOne,
    settings.reactBitsLiquidEtherColorTwo,
    settings.reactBitsLiquidEtherColorThree,
  ]
}

export function resolveReactBitsLightPillarColors(
  settings: ReactBitsLightPillarColorSettings,
): [string, string] {
  if (settings.reactBitsLightPillarPaletteMode === "harmony") {
    return createReactBitsLightPillarHarmonyPalette(
      settings.reactBitsLightPillarPrimaryColor,
      settings.reactBitsLightPillarHarmony,
    )
  }

  return [
    settings.reactBitsLightPillarTopColor,
    settings.reactBitsLightPillarBottomColor,
  ]
}

export function resolveReactBitsSilkColor(settings: ReactBitsSilkColorSettings): string {
  if (settings.reactBitsSilkPaletteMode === "harmony") {
    return createReactBitsSilkHarmonyColor(
      settings.reactBitsSilkPrimaryColor,
      settings.reactBitsSilkHarmony,
    )
  }

  return settings.reactBitsSilkColor
}

export function resolveReactBitsFloatingLinesGradient(
  settings: ReactBitsFloatingLinesColorSettings,
): string[] | undefined {
  if (settings.reactBitsFloatingLinesPaletteMode === "source") {
    return undefined
  }

  if (settings.reactBitsFloatingLinesPaletteMode === "harmony") {
    return createReactBitsFloatingLinesHarmonyGradient(
      settings.reactBitsFloatingLinesPrimaryColor,
      settings.reactBitsFloatingLinesHarmony,
    )
  }

  return [
    settings.reactBitsFloatingLinesColorOne,
    settings.reactBitsFloatingLinesColorTwo,
    settings.reactBitsFloatingLinesColorThree,
  ]
}

export function resolveReactBitsSideRaysColors(settings: ReactBitsSideRaysColorSettings): [string, string] {
  if (settings.reactBitsSideRaysPaletteMode === "source") {
    return ["#EAB308", "#96C8FF"]
  }

  if (settings.reactBitsSideRaysPaletteMode === "harmony") {
    return createReactBitsSideRaysHarmonyColors(
      settings.reactBitsSideRaysPrimaryColor,
      settings.reactBitsSideRaysHarmony,
    )
  }

  return [
    settings.reactBitsSideRaysColorOne,
    settings.reactBitsSideRaysColorTwo,
  ]
}

export function resolveReactBitsLightRaysColor(settings: ReactBitsLightRaysColorSettings): string {
  if (settings.reactBitsLightRaysPaletteMode === "source") {
    return "#FFFFFF"
  }

  if (settings.reactBitsLightRaysPaletteMode === "harmony") {
    return createReactBitsLightRaysHarmonyColor(
      settings.reactBitsLightRaysPrimaryColor,
      settings.reactBitsLightRaysHarmony,
    )
  }

  return settings.reactBitsLightRaysColor
}

export function resolveReactBitsPixelBlastColor(settings: ReactBitsPixelBlastColorSettings): string {
  if (settings.reactBitsPixelBlastPaletteMode === "source") {
    return "#B497CF"
  }

  if (settings.reactBitsPixelBlastPaletteMode === "harmony") {
    return createReactBitsPixelBlastHarmonyColor(
      settings.reactBitsPixelBlastPrimaryColor,
      settings.reactBitsPixelBlastHarmony,
    )
  }

  return settings.reactBitsPixelBlastColor
}

export function resolveReactBitsColorBendsColors(
  settings: ReactBitsColorBendsColorSettings,
): string[] | undefined {
  if (settings.reactBitsColorBendsPaletteMode === "source") {
    return undefined
  }

  if (settings.reactBitsColorBendsPaletteMode === "harmony") {
    return createReactBitsColorBendsHarmonyPalette(
      settings.reactBitsColorBendsPrimaryColor,
      settings.reactBitsColorBendsHarmony,
    )
  }

  return [
    settings.reactBitsColorBendsColorOne,
    settings.reactBitsColorBendsColorTwo,
    settings.reactBitsColorBendsColorThree,
    settings.reactBitsColorBendsColorFour,
  ]
}

export function resolveReactBitsEvilEyeColor(settings: ReactBitsEvilEyeColorSettings): string {
  if (settings.reactBitsEvilEyePaletteMode === "source") {
    return "#FF6F37"
  }

  if (settings.reactBitsEvilEyePaletteMode === "harmony") {
    return createReactBitsEvilEyeHarmonyColor(
      settings.reactBitsEvilEyePrimaryColor,
      settings.reactBitsEvilEyeHarmony,
    )
  }

  return settings.reactBitsEvilEyeColor
}

export function resolveReactBitsLineWavesColors(
  settings: ReactBitsLineWavesColorSettings,
): [string, string, string] {
  if (settings.reactBitsLineWavesPaletteMode === "source") {
    return ["#FFFFFF", "#FFFFFF", "#FFFFFF"]
  }

  if (settings.reactBitsLineWavesPaletteMode === "harmony") {
    return createReactBitsLineWavesHarmonyPalette(
      settings.reactBitsLineWavesPrimaryColor,
      settings.reactBitsLineWavesHarmony,
    )
  }

  return [
    settings.reactBitsLineWavesColorOne,
    settings.reactBitsLineWavesColorTwo,
    settings.reactBitsLineWavesColorThree,
  ]
}

export function resolveReactBitsRadarColor(settings: ReactBitsRadarColorSettings): string {
  if (settings.reactBitsRadarPaletteMode === "source") {
    return "#9F29FF"
  }

  if (settings.reactBitsRadarPaletteMode === "harmony") {
    return createReactBitsRadarHarmonyColor(
      settings.reactBitsRadarPrimaryColor,
      settings.reactBitsRadarHarmony,
    )
  }

  return settings.reactBitsRadarColor
}

export function resolveReactBitsSoftAuroraColors(settings: ReactBitsSoftAuroraColorSettings): string[] {
  if (settings.reactBitsSoftAuroraPaletteMode === "source") {
    return ["#F7F7F7", "#E100FF"]
  }

  if (settings.reactBitsSoftAuroraPaletteMode === "harmony") {
    return createReactBitsSoftAuroraHarmonyColors(
      settings.reactBitsSoftAuroraPrimaryColor,
      settings.reactBitsSoftAuroraHarmony,
    )
  }

  return [
    settings.reactBitsSoftAuroraColorOne,
    settings.reactBitsSoftAuroraColorTwo,
  ]
}

export function resolveReactBitsPlasmaColor(settings: ReactBitsPlasmaColorSettings): string {
  if (settings.reactBitsPlasmaPaletteMode === "source") {
    return "#FFFFFF"
  }

  if (settings.reactBitsPlasmaPaletteMode === "harmony") {
    return createReactBitsPlasmaHarmonyColor(
      settings.reactBitsPlasmaPrimaryColor,
      settings.reactBitsPlasmaHarmony,
    )
  }

  return settings.reactBitsPlasmaColor
}

export function resolveReactBitsPlasmaWaveColors(settings: ReactBitsPlasmaWaveColorSettings): string[] {
  if (settings.reactBitsPlasmaWavePaletteMode === "source") {
    return ["#A855F7", "#06B6D4"]
  }

  if (settings.reactBitsPlasmaWavePaletteMode === "harmony") {
    return createReactBitsPlasmaWaveHarmonyColors(
      settings.reactBitsPlasmaWavePrimaryColor,
      settings.reactBitsPlasmaWaveHarmony,
    )
  }

  return [
    settings.reactBitsPlasmaWaveColorOne,
    settings.reactBitsPlasmaWaveColorTwo,
  ]
}

export function resolveReactBitsParticlesColors(settings: ReactBitsParticlesColorSettings): string[] {
  if (settings.reactBitsParticlesPaletteMode === "source") {
    return ["#FFFFFF", "#FFFFFF", "#FFFFFF"]
  }

  if (settings.reactBitsParticlesPaletteMode === "harmony") {
    return createReactBitsParticlesHarmonyColors(
      settings.reactBitsParticlesPrimaryColor,
      settings.reactBitsParticlesHarmony,
    )
  }

  return [
    settings.reactBitsParticlesColorOne,
    settings.reactBitsParticlesColorTwo,
    settings.reactBitsParticlesColorThree,
  ]
}

export function resolveReactBitsGradientBlindsColors(settings: ReactBitsGradientBlindsColorSettings): string[] {
  if (settings.reactBitsGradientBlindsPaletteMode === "source") {
    return ["#FF9FFC", "#5227FF"]
  }

  if (settings.reactBitsGradientBlindsPaletteMode === "harmony") {
    return createReactBitsGradientBlindsHarmonyColors(
      settings.reactBitsGradientBlindsPrimaryColor,
      settings.reactBitsGradientBlindsHarmony,
    )
  }

  return [
    settings.reactBitsGradientBlindsColorOne,
    settings.reactBitsGradientBlindsColorTwo,
  ]
}

export function resolveReactBitsGrainientColors(settings: ReactBitsGrainientColorSettings): string[] {
  if (settings.reactBitsGrainientPaletteMode === "source") {
    return ["#FF9FFC", "#5227FF", "#B497CF"]
  }

  if (settings.reactBitsGrainientPaletteMode === "harmony") {
    return createReactBitsGrainientHarmonyColors(
      settings.reactBitsGrainientPrimaryColor,
      settings.reactBitsGrainientHarmony,
    )
  }

  return [
    settings.reactBitsGrainientColorOne,
    settings.reactBitsGrainientColorTwo,
    settings.reactBitsGrainientColorThree,
  ]
}

export function resolveReactBitsGridScanColors(settings: ReactBitsGridScanColorSettings): [string, string] {
  if (settings.reactBitsGridScanPaletteMode === "source") {
    return ["#2F293A", "#FF9FFC"]
  }

  if (settings.reactBitsGridScanPaletteMode === "harmony") {
    return createReactBitsGridScanHarmonyColors(
      settings.reactBitsGridScanPrimaryColor,
      settings.reactBitsGridScanHarmony,
    )
  }

  return [
    settings.reactBitsGridScanLinesColor,
    settings.reactBitsGridScanScanColor,
  ]
}

export function resolveReactBitsBeamsColor(settings: ReactBitsBeamsColorSettings): string {
  if (settings.reactBitsBeamsPaletteMode === "source") {
    return "#FFFFFF"
  }

  if (settings.reactBitsBeamsPaletteMode === "harmony") {
    return createReactBitsBeamsHarmonyColor(
      settings.reactBitsBeamsPrimaryColor,
      settings.reactBitsBeamsHarmony,
    )
  }

  return settings.reactBitsBeamsLightColor
}

export function resolveReactBitsPixelSnowColor(settings: ReactBitsPixelSnowColorSettings): string {
  if (settings.reactBitsPixelSnowPaletteMode === "source") {
    return "#FFFFFF"
  }

  if (settings.reactBitsPixelSnowPaletteMode === "harmony") {
    return createReactBitsPixelSnowHarmonyColor(
      settings.reactBitsPixelSnowPrimaryColor,
      settings.reactBitsPixelSnowHarmony,
    )
  }

  return settings.reactBitsPixelSnowColor
}

export function resolveReactBitsLightningHue(settings: ReactBitsLightningColorSettings): number {
  if (settings.reactBitsLightningPaletteMode === "source") {
    return normalizeHue(settings.reactBitsLightningHue)
  }

  if (settings.reactBitsLightningPaletteMode === "harmony") {
    return createReactBitsLightningHarmonyHue(
      settings.reactBitsLightningPrimaryColor,
      settings.reactBitsLightningHarmony,
    )
  }

  return getHueFromHexColor(settings.reactBitsLightningColor)
}

export function resolveReactBitsPrismaticBurstColors(
  settings: ReactBitsPrismaticBurstColorSettings,
): string[] {
  if (settings.reactBitsPrismaticBurstPaletteMode === "source") {
    return []
  }

  if (settings.reactBitsPrismaticBurstPaletteMode === "harmony") {
    return createReactBitsPrismaticBurstHarmonyPalette(
      settings.reactBitsPrismaticBurstPrimaryColor,
      settings.reactBitsPrismaticBurstHarmony,
    )
  }

  return [
    settings.reactBitsPrismaticBurstColorOne,
    settings.reactBitsPrismaticBurstColorTwo,
    settings.reactBitsPrismaticBurstColorThree,
    settings.reactBitsPrismaticBurstColorFour,
  ]
}

export function resolveReactBitsGalaxyHueShift(settings: ReactBitsGalaxyColorSettings): number {
  if (settings.reactBitsGalaxyPaletteMode === "source") {
    return normalizeHue(settings.reactBitsGalaxyHueShift)
  }

  if (settings.reactBitsGalaxyPaletteMode === "harmony") {
    return createReactBitsGalaxyHarmonyHue(
      settings.reactBitsGalaxyPrimaryColor,
      settings.reactBitsGalaxyHarmony,
    )
  }

  return getHueFromHexColor(settings.reactBitsGalaxyColor)
}

export function resolveReactBitsDitherColor(settings: ReactBitsDitherColorSettings): string {
  if (settings.reactBitsDitherPaletteMode === "source") {
    return "#808080"
  }

  if (settings.reactBitsDitherPaletteMode === "harmony") {
    return createReactBitsDitherHarmonyColor(
      settings.reactBitsDitherPrimaryColor,
      settings.reactBitsDitherHarmony,
    )
  }

  return settings.reactBitsDitherColor
}

export function resolveReactBitsFaultyTerminalTint(
  settings: ReactBitsFaultyTerminalColorSettings,
): string {
  if (settings.reactBitsFaultyTerminalPaletteMode === "source") {
    return "#FFFFFF"
  }

  if (settings.reactBitsFaultyTerminalPaletteMode === "harmony") {
    return createReactBitsFaultyTerminalHarmonyColor(
      settings.reactBitsFaultyTerminalPrimaryColor,
      settings.reactBitsFaultyTerminalHarmony,
    )
  }

  return settings.reactBitsFaultyTerminalTint
}

export function resolveReactBitsRippleGridColor(settings: ReactBitsRippleGridColorSettings): string {
  if (settings.reactBitsRippleGridPaletteMode === "source" || settings.reactBitsRippleGridPaletteMode === "rainbow") {
    return "#FFFFFF"
  }

  if (settings.reactBitsRippleGridPaletteMode === "harmony") {
    return createReactBitsRippleGridHarmonyColor(
      settings.reactBitsRippleGridPrimaryColor,
      settings.reactBitsRippleGridHarmony,
    )
  }

  return settings.reactBitsRippleGridColor
}

export function resolveReactBitsDotFieldColors(settings: ReactBitsDotFieldColorSettings): {
  gradientFrom: string
  gradientTo: string
  glowColor: string
} {
  if (settings.reactBitsDotFieldPaletteMode === "source") {
    return {
      gradientFrom: "rgba(168, 85, 247, 0.35)",
      gradientTo: "rgba(180, 151, 207, 0.25)",
      glowColor: "#120F17",
    }
  }

  if (settings.reactBitsDotFieldPaletteMode === "harmony") {
    const [fromColor, toColor, glowColor] = createReactBitsDotFieldHarmonyColors(
      settings.reactBitsDotFieldPrimaryColor,
      settings.reactBitsDotFieldHarmony,
    )

    return {
      gradientFrom: hexToRgba(fromColor, settings.reactBitsDotFieldGradientFromAlpha),
      gradientTo: hexToRgba(toColor, settings.reactBitsDotFieldGradientToAlpha),
      glowColor,
    }
  }

  return {
    gradientFrom: hexToRgba(settings.reactBitsDotFieldGradientFromColor, settings.reactBitsDotFieldGradientFromAlpha),
    gradientTo: hexToRgba(settings.reactBitsDotFieldGradientToColor, settings.reactBitsDotFieldGradientToAlpha),
    glowColor: settings.reactBitsDotFieldGlowColor,
  }
}

export function resolveReactBitsDotGridColors(settings: ReactBitsDotGridColorSettings): [string, string] {
  if (settings.reactBitsDotGridPaletteMode === "source") {
    return ["#5227FF", "#5227FF"]
  }

  if (settings.reactBitsDotGridPaletteMode === "harmony") {
    return createReactBitsDotGridHarmonyColors(
      settings.reactBitsDotGridPrimaryColor,
      settings.reactBitsDotGridHarmony,
    )
  }

  return [settings.reactBitsDotGridBaseColor, settings.reactBitsDotGridActiveColor]
}

export function resolveReactBitsThreadsColor(settings: ReactBitsThreadsColorSettings): string {
  if (settings.reactBitsThreadsPaletteMode === "source") {
    return "#FFFFFF"
  }

  if (settings.reactBitsThreadsPaletteMode === "harmony") {
    return createReactBitsThreadsHarmonyColor(
      settings.reactBitsThreadsPrimaryColor,
      settings.reactBitsThreadsHarmony,
    )
  }

  return settings.reactBitsThreadsColor
}

export function resolveReactBitsIridescenceColor(settings: ReactBitsIridescenceColorSettings): string {
  if (settings.reactBitsIridescencePaletteMode === "source") {
    return "#FFFFFF"
  }

  if (settings.reactBitsIridescencePaletteMode === "harmony") {
    return createReactBitsIridescenceHarmonyColor(
      settings.reactBitsIridescencePrimaryColor,
      settings.reactBitsIridescenceHarmony,
    )
  }

  return settings.reactBitsIridescenceColor
}

export function resolveReactBitsWavesLineColor(settings: ReactBitsWavesColorSettings): string {
  if (settings.reactBitsWavesPaletteMode === "source") {
    return "#000000"
  }

  if (settings.reactBitsWavesPaletteMode === "harmony") {
    return createReactBitsWavesHarmonyColor(settings.reactBitsWavesPrimaryColor, settings.reactBitsWavesHarmony)
  }

  return settings.reactBitsWavesLineColor
}

export function resolveReactBitsGridDistortionColors(
  settings: ReactBitsGridDistortionColorSettings,
): [string, string, string] {
  if (settings.reactBitsGridDistortionPaletteMode === "source") {
    return ["#101827", "#5B7CFA", "#F7B7D2"]
  }

  if (settings.reactBitsGridDistortionPaletteMode === "harmony") {
    return createReactBitsGridDistortionHarmonyPalette(
      settings.reactBitsGridDistortionPrimaryColor,
      settings.reactBitsGridDistortionHarmony,
    )
  }

  return [
    settings.reactBitsGridDistortionColorOne,
    settings.reactBitsGridDistortionColorTwo,
    settings.reactBitsGridDistortionColorThree,
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

export function resolveEldoraPhotonBeamColors(
  settings: EldoraPhotonBeamColorSettings,
): [string, string, string, boolean, string, boolean, string] {
  if (settings.eldoraPhotonBeamPaletteMode === "harmony") {
    return createEldoraPhotonBeamHarmonyPalette(
      settings.eldoraPhotonBeamPrimaryColor,
      settings.eldoraPhotonBeamHarmony,
    )
  }

  return [
    settings.eldoraPhotonBeamColorBg,
    settings.eldoraPhotonBeamColorLine,
    settings.eldoraPhotonBeamColorSignal,
    settings.eldoraPhotonBeamUseColor2,
    settings.eldoraPhotonBeamColorSignal2,
    settings.eldoraPhotonBeamUseColor3,
    settings.eldoraPhotonBeamColorSignal3,
  ]
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

export function createReactBitsFerrofluidHarmonyPalette(
  primaryColor: string,
  harmony: ColorHarmony,
): [string, string, string] {
  const [hue, saturation, lightness] = rgbToHsl(parseHexColorToRgb(primaryColor))
  const richSaturation = Math.min(0.98, Math.max(0.42, saturation))
  const darkLightness = Math.min(0.16, Math.max(0.04, lightness * 0.32))
  const midLightness = Math.min(0.52, Math.max(0.24, lightness))
  const highlightLightness = Math.min(0.9, Math.max(0.62, lightness + 0.2))

  switch (harmony) {
    case "complementary":
      return [
        hslToHex(hue, richSaturation * 0.62, darkLightness),
        hslToHex(hue, richSaturation, midLightness),
        hslToHex(hue + 180, Math.min(0.98, richSaturation * 1.04), highlightLightness),
      ]
    case "split-complementary":
      return [
        hslToHex(hue - 12, richSaturation * 0.64, darkLightness),
        hslToHex(hue + 150, richSaturation * 0.95, midLightness),
        hslToHex(hue + 210, Math.min(0.98, richSaturation * 1.05), highlightLightness),
      ]
    case "triad":
      return [
        hslToHex(hue, richSaturation * 0.62, darkLightness),
        hslToHex(hue + 120, richSaturation * 0.96, midLightness),
        hslToHex(hue + 240, richSaturation, highlightLightness),
      ]
    case "square":
      return [
        hslToHex(hue + 180, richSaturation * 0.58, darkLightness),
        hslToHex(hue + 90, richSaturation * 0.9, midLightness),
        hslToHex(hue, richSaturation, highlightLightness),
      ]
    case "compound":
      return [
        hslToHex(hue - 26, richSaturation * 0.64, darkLightness),
        hslToHex(hue, richSaturation * 0.92, midLightness),
        hslToHex(hue + 184, Math.min(0.96, richSaturation * 0.92), highlightLightness),
      ]
    case "shades":
      return [
        hslToHex(hue, richSaturation * 0.66, darkLightness),
        hslToHex(hue, richSaturation * 0.82, midLightness),
        hslToHex(hue, richSaturation * 0.62, highlightLightness),
      ]
    case "monochromatic":
      return [
        hslToHex(hue, richSaturation * 0.36, darkLightness),
        hslToHex(hue, richSaturation * 0.58, midLightness),
        hslToHex(hue, richSaturation * 0.42, highlightLightness),
      ]
    case "analogous":
    default:
      return [
        hslToHex(hue - 32, richSaturation * 0.64, darkLightness),
        hslToHex(hue, richSaturation, midLightness),
        hslToHex(hue + 32, Math.min(0.98, richSaturation * 1.02), highlightLightness),
      ]
  }
}

export function createReactBitsLightfallHarmonyPalette(
  primaryColor: string,
  harmony: ColorHarmony,
): [string, string, string] {
  const [hue, saturation, lightness] = rgbToHsl(parseHexColorToRgb(primaryColor))
  const vividSaturation = Math.min(0.98, Math.max(0.48, saturation))
  const baseLightness = Math.min(0.7, Math.max(0.34, lightness))
  const highlightLightness = Math.min(0.94, Math.max(0.68, lightness + 0.24))
  const midLightness = Math.min(0.66, Math.max(0.42, lightness + 0.06))

  switch (harmony) {
    case "complementary":
      return [
        hslToHex(hue, vividSaturation * 0.72, highlightLightness),
        hslToHex(hue + 180, Math.min(0.98, vividSaturation), midLightness),
        hslToHex(hue - 10, Math.min(0.96, vividSaturation * 0.88), baseLightness),
      ]
    case "split-complementary":
      return [
        hslToHex(hue, vividSaturation * 0.72, highlightLightness),
        hslToHex(hue + 150, Math.min(0.98, vividSaturation * 0.96), midLightness),
        hslToHex(hue + 210, Math.min(0.98, vividSaturation), baseLightness),
      ]
    case "triad":
      return [
        hslToHex(hue, vividSaturation * 0.72, highlightLightness),
        hslToHex(hue + 120, Math.min(0.96, vividSaturation * 0.9), midLightness),
        hslToHex(hue + 240, Math.min(0.98, vividSaturation), baseLightness),
      ]
    case "square":
      return [
        hslToHex(hue, vividSaturation * 0.72, highlightLightness),
        hslToHex(hue + 90, Math.min(0.94, vividSaturation * 0.9), midLightness),
        hslToHex(hue + 180, Math.min(0.98, vividSaturation), baseLightness),
      ]
    case "compound":
      return [
        hslToHex(hue - 18, Math.min(0.92, vividSaturation * 0.8), highlightLightness),
        hslToHex(hue, vividSaturation, midLightness),
        hslToHex(hue + 184, Math.min(0.98, vividSaturation * 0.94), baseLightness),
      ]
    case "shades":
      return [
        hslToHex(hue, vividSaturation * 0.62, highlightLightness),
        hslToHex(hue, vividSaturation * 0.82, midLightness),
        hslToHex(hue, vividSaturation, baseLightness),
      ]
    case "monochromatic":
      return [
        hslToHex(hue, vividSaturation * 0.52, highlightLightness),
        hslToHex(hue, vividSaturation * 0.78, midLightness),
        hslToHex(hue, vividSaturation, baseLightness),
      ]
    case "analogous":
    default:
      return [
        hslToHex(hue - 28, vividSaturation * 0.76, highlightLightness),
        hslToHex(hue, vividSaturation, midLightness),
        hslToHex(hue + 32, Math.min(0.98, vividSaturation * 1.02), baseLightness),
      ]
  }
}

export function createReactBitsLightPillarHarmonyPalette(
  primaryColor: string,
  harmony: ColorHarmony,
): [string, string] {
  const [hue, saturation, lightness] = rgbToHsl(parseHexColorToRgb(primaryColor))
  const vividSaturation = Math.min(0.98, Math.max(0.5, saturation))
  const topLightness = Math.min(0.68, Math.max(0.34, lightness))
  const bottomLightness = Math.min(0.88, Math.max(0.62, lightness + 0.22))

  switch (harmony) {
    case "complementary":
      return [
        hslToHex(hue, vividSaturation, topLightness),
        hslToHex(hue + 180, Math.min(0.98, vividSaturation * 0.9), bottomLightness),
      ]
    case "split-complementary":
      return [
        hslToHex(hue + 150, Math.min(0.96, vividSaturation * 0.92), topLightness),
        hslToHex(hue + 210, Math.min(0.98, vividSaturation), bottomLightness),
      ]
    case "triad":
      return [
        hslToHex(hue + 120, Math.min(0.96, vividSaturation * 0.9), topLightness),
        hslToHex(hue + 240, Math.min(0.98, vividSaturation), bottomLightness),
      ]
    case "square":
      return [
        hslToHex(hue + 90, Math.min(0.94, vividSaturation * 0.88), topLightness),
        hslToHex(hue + 180, Math.min(0.98, vividSaturation), bottomLightness),
      ]
    case "compound":
      return [
        hslToHex(hue - 18, Math.min(0.92, vividSaturation * 0.84), topLightness),
        hslToHex(hue + 184, Math.min(0.98, vividSaturation * 0.94), bottomLightness),
      ]
    case "shades":
      return [
        hslToHex(hue, vividSaturation, topLightness),
        hslToHex(hue, vividSaturation * 0.66, bottomLightness),
      ]
    case "monochromatic":
      return [
        hslToHex(hue, vividSaturation * 0.84, topLightness),
        hslToHex(hue, vividSaturation * 0.54, bottomLightness),
      ]
    case "analogous":
    default:
      return [
        hslToHex(hue - 28, vividSaturation * 0.86, topLightness),
        hslToHex(hue + 32, Math.min(0.98, vividSaturation), bottomLightness),
      ]
  }
}

export function createReactBitsSilkHarmonyColor(primaryColor: string, harmony: ColorHarmony): string {
  const [hue, saturation, lightness] = rgbToHsl(parseHexColorToRgb(primaryColor))
  const silkSaturation = Math.min(0.88, Math.max(0.24, saturation))
  const silkLightness = Math.min(0.72, Math.max(0.28, lightness))

  switch (harmony) {
    case "complementary":
      return hslToHex(hue + 180, Math.min(0.86, silkSaturation * 0.86), silkLightness)
    case "split-complementary":
      return hslToHex(hue + 150, Math.min(0.88, silkSaturation * 0.9), silkLightness)
    case "triad":
      return hslToHex(hue + 120, Math.min(0.88, silkSaturation * 0.92), silkLightness)
    case "square":
      return hslToHex(hue + 90, Math.min(0.84, silkSaturation * 0.88), silkLightness)
    case "compound":
      return hslToHex(hue + 184, Math.min(0.88, silkSaturation * 0.9), Math.min(0.74, silkLightness + 0.04))
    case "shades":
      return hslToHex(hue, Math.min(0.82, silkSaturation * 0.7), Math.min(0.78, silkLightness + 0.1))
    case "monochromatic":
      return hslToHex(hue, Math.min(0.78, silkSaturation * 0.58), Math.min(0.76, silkLightness + 0.06))
    case "analogous":
    default:
      return hslToHex(hue + 28, Math.min(0.88, silkSaturation * 0.86), silkLightness)
  }
}

export function createReactBitsFloatingLinesHarmonyGradient(
  primaryColor: string,
  harmony: ColorHarmony,
): [string, string, string] {
  const [hue, saturation, lightness] = rgbToHsl(parseHexColorToRgb(primaryColor))
  const vividSaturation = Math.min(0.96, Math.max(0.46, saturation))
  const baseLightness = Math.min(0.62, Math.max(0.34, lightness))
  const highlightLightness = Math.min(0.86, Math.max(0.62, lightness + 0.2))
  const shadowLightness = Math.min(0.34, Math.max(0.16, lightness * 0.6))

  switch (harmony) {
    case "complementary":
      return [
        hslToHex(hue, vividSaturation, highlightLightness),
        hslToHex(hue + 180, Math.min(0.94, vividSaturation * 0.92), baseLightness),
        hslToHex(hue + 12, vividSaturation * 0.72, shadowLightness),
      ]
    case "split-complementary":
      return [
        hslToHex(hue, vividSaturation, highlightLightness),
        hslToHex(hue + 150, Math.min(0.94, vividSaturation * 0.92), baseLightness),
        hslToHex(hue + 210, vividSaturation * 0.72, shadowLightness),
      ]
    case "triad":
      return [
        hslToHex(hue, vividSaturation, highlightLightness),
        hslToHex(hue + 120, Math.min(0.94, vividSaturation * 0.9), baseLightness),
        hslToHex(hue + 240, vividSaturation * 0.72, shadowLightness),
      ]
    case "square":
      return [
        hslToHex(hue, vividSaturation, highlightLightness),
        hslToHex(hue + 90, Math.min(0.92, vividSaturation * 0.88), baseLightness),
        hslToHex(hue + 180, vividSaturation * 0.72, shadowLightness),
      ]
    case "compound":
      return [
        hslToHex(hue - 18, vividSaturation * 0.86, highlightLightness),
        hslToHex(hue, vividSaturation, baseLightness),
        hslToHex(hue + 184, Math.min(0.94, vividSaturation * 0.92), shadowLightness),
      ]
    case "shades":
      return [
        hslToHex(hue, vividSaturation * 0.72, highlightLightness),
        hslToHex(hue, vividSaturation, baseLightness),
        hslToHex(hue, vividSaturation * 0.82, shadowLightness),
      ]
    case "monochromatic":
      return [
        hslToHex(hue, vividSaturation * 0.52, highlightLightness),
        hslToHex(hue, vividSaturation * 0.78, baseLightness),
        hslToHex(hue, vividSaturation, shadowLightness),
      ]
    case "analogous":
    default:
      return [
        hslToHex(hue - 28, vividSaturation * 0.88, highlightLightness),
        hslToHex(hue, vividSaturation, baseLightness),
        hslToHex(hue + 32, Math.min(0.94, vividSaturation * 0.94), shadowLightness),
      ]
  }
}

export function createReactBitsSideRaysHarmonyColors(
  primaryColor: string,
  harmony: ColorHarmony,
): [string, string] {
  const [hue, saturation, lightness] = rgbToHsl(parseHexColorToRgb(primaryColor))
  const raySaturation = Math.min(0.96, Math.max(0.48, saturation))
  const warmLightness = Math.min(0.72, Math.max(0.46, lightness + 0.04))
  const coolLightness = Math.min(0.82, Math.max(0.56, lightness + 0.14))

  switch (harmony) {
    case "complementary":
      return [
        hslToHex(hue, raySaturation, warmLightness),
        hslToHex(hue + 180, Math.min(0.9, raySaturation * 0.82), coolLightness),
      ]
    case "split-complementary":
      return [
        hslToHex(hue - 18, raySaturation, warmLightness),
        hslToHex(hue + 150, Math.min(0.92, raySaturation * 0.86), coolLightness),
      ]
    case "triad":
      return [
        hslToHex(hue, raySaturation, warmLightness),
        hslToHex(hue + 120, Math.min(0.9, raySaturation * 0.84), coolLightness),
      ]
    case "square":
      return [
        hslToHex(hue, raySaturation, warmLightness),
        hslToHex(hue + 90, Math.min(0.9, raySaturation * 0.82), coolLightness),
      ]
    case "compound":
      return [
        hslToHex(hue - 20, raySaturation * 0.96, warmLightness),
        hslToHex(hue + 184, Math.min(0.92, raySaturation * 0.88), coolLightness),
      ]
    case "shades":
      return [
        hslToHex(hue, Math.min(0.88, raySaturation * 0.7), warmLightness),
        hslToHex(hue, Math.min(0.94, raySaturation * 0.92), coolLightness),
      ]
    case "monochromatic":
      return [
        hslToHex(hue, Math.min(0.82, raySaturation * 0.62), warmLightness),
        hslToHex(hue, Math.min(0.9, raySaturation * 0.82), coolLightness),
      ]
    case "analogous":
    default:
      return [
        hslToHex(hue - 24, raySaturation, warmLightness),
        hslToHex(hue + 34, Math.min(0.9, raySaturation * 0.82), coolLightness),
      ]
  }
}

export function createReactBitsLiquidEtherHarmonyPalette(
  primaryColor: string,
  harmony: ColorHarmony,
): [string, string, string] {
  const [hue, saturation, lightness] = rgbToHsl(parseHexColorToRgb(primaryColor))
  const richSaturation = Math.min(0.98, Math.max(0.5, saturation))
  const darkLightness = Math.min(0.2, Math.max(0.06, lightness * 0.34))
  const midLightness = Math.min(0.58, Math.max(0.28, lightness))
  const highlightLightness = Math.min(0.86, Math.max(0.62, lightness + 0.22))

  switch (harmony) {
    case "complementary":
      return [
        hslToHex(hue, richSaturation * 0.74, darkLightness),
        hslToHex(hue, richSaturation, midLightness),
        hslToHex(hue + 180, Math.min(0.98, richSaturation * 1.04), highlightLightness),
      ]
    case "split-complementary":
      return [
        hslToHex(hue - 18, richSaturation * 0.72, darkLightness),
        hslToHex(hue + 150, richSaturation * 0.96, midLightness),
        hslToHex(hue + 210, Math.min(0.98, richSaturation * 1.04), highlightLightness),
      ]
    case "triad":
      return [
        hslToHex(hue, richSaturation * 0.7, darkLightness),
        hslToHex(hue + 120, richSaturation * 0.96, midLightness),
        hslToHex(hue + 240, richSaturation, highlightLightness),
      ]
    case "square":
      return [
        hslToHex(hue + 180, richSaturation * 0.68, darkLightness),
        hslToHex(hue + 90, richSaturation * 0.92, midLightness),
        hslToHex(hue + 270, Math.min(0.98, richSaturation * 1.02), highlightLightness),
      ]
    case "compound":
      return [
        hslToHex(hue - 16, richSaturation * 0.76, darkLightness),
        hslToHex(hue + 18, richSaturation, midLightness),
        hslToHex(hue + 178, Math.min(0.98, richSaturation * 1.04), highlightLightness),
      ]
    case "shades":
      return [
        hslToHex(hue, richSaturation * 0.68, darkLightness),
        hslToHex(hue, richSaturation, midLightness),
        hslToHex(hue, Math.min(0.96, richSaturation * 0.88), highlightLightness),
      ]
    case "monochromatic":
      return [
        hslToHex(hue, richSaturation * 0.72, darkLightness),
        hslToHex(hue, richSaturation, midLightness),
        hslToHex(hue, Math.min(0.98, richSaturation * 0.92), highlightLightness),
      ]
    case "analogous":
    default:
      return [
        hslToHex(hue - 28, richSaturation * 0.74, darkLightness),
        hslToHex(hue, richSaturation, midLightness),
        hslToHex(hue + 28, Math.min(0.98, richSaturation * 1.02), highlightLightness),
      ]
  }
}

export function createReactBitsLightRaysHarmonyColor(
  primaryColor: string,
  harmony: ColorHarmony,
): string {
  const [hue, saturation, lightness] = rgbToHsl(parseHexColorToRgb(primaryColor))
  const raySaturation = Math.min(0.92, Math.max(0.28, saturation))
  const rayLightness = Math.min(0.9, Math.max(0.5, lightness + 0.1))

  switch (harmony) {
    case "complementary":
      return hslToHex(hue + 180, Math.min(0.86, raySaturation * 0.9), rayLightness)
    case "split-complementary":
      return hslToHex(hue + 150, Math.min(0.9, raySaturation * 0.95), rayLightness)
    case "triad":
      return hslToHex(hue + 120, Math.min(0.9, raySaturation * 0.95), rayLightness)
    case "square":
      return hslToHex(hue + 90, Math.min(0.86, raySaturation * 0.9), rayLightness)
    case "compound":
      return hslToHex(hue - 24, Math.min(0.92, raySaturation), rayLightness)
    case "shades":
      return hslToHex(hue, raySaturation, Math.min(0.92, rayLightness + 0.08))
    case "monochromatic":
      return hslToHex(hue, Math.min(0.62, raySaturation * 0.7), rayLightness)
    case "analogous":
    default:
      return hslToHex(hue + 28, Math.min(0.9, raySaturation * 0.92), rayLightness)
  }
}

export function createReactBitsPixelBlastHarmonyColor(
  primaryColor: string,
  harmony: ColorHarmony,
): string {
  const [hue, saturation, lightness] = rgbToHsl(parseHexColorToRgb(primaryColor))
  const pixelSaturation = Math.min(0.9, Math.max(0.38, saturation))
  const pixelLightness = Math.min(0.82, Math.max(0.46, lightness + 0.04))

  switch (harmony) {
    case "complementary":
      return hslToHex(hue + 180, Math.min(0.84, pixelSaturation * 0.9), pixelLightness)
    case "split-complementary":
      return hslToHex(hue + 150, Math.min(0.86, pixelSaturation * 0.95), pixelLightness)
    case "triad":
      return hslToHex(hue + 120, Math.min(0.86, pixelSaturation * 0.95), pixelLightness)
    case "square":
      return hslToHex(hue + 90, Math.min(0.84, pixelSaturation * 0.9), pixelLightness)
    case "compound":
      return hslToHex(hue - 22, Math.min(0.9, pixelSaturation), pixelLightness)
    case "shades":
      return hslToHex(hue, pixelSaturation, Math.min(0.88, pixelLightness + 0.08))
    case "monochromatic":
      return hslToHex(hue, Math.min(0.58, pixelSaturation * 0.72), pixelLightness)
    case "analogous":
    default:
      return hslToHex(hue + 28, Math.min(0.88, pixelSaturation * 0.94), pixelLightness)
  }
}

export function createReactBitsColorBendsHarmonyPalette(
  primaryColor: string,
  harmony: ColorHarmony,
): [string, string, string, string] {
  const [hue, saturation, lightness] = rgbToHsl(parseHexColorToRgb(primaryColor))
  const richSaturation = Math.min(0.94, Math.max(0.42, saturation))
  const lowLightness = Math.max(0.06, Math.min(0.2, lightness * 0.32))
  const midLightness = Math.min(0.66, Math.max(0.34, lightness + 0.02))
  const highLightness = Math.min(0.82, Math.max(0.48, lightness + 0.16))

  switch (harmony) {
    case "complementary":
      return [
        hslToHex(hue, richSaturation, midLightness),
        hslToHex(hue + 180, Math.min(0.86, richSaturation * 0.88), highLightness),
        hslToHex(hue - 18, richSaturation * 0.8, lowLightness + 0.05),
        hslToHex(hue + 180, richSaturation * 0.72, lowLightness),
      ]
    case "split-complementary":
      return [
        hslToHex(hue, richSaturation, midLightness),
        hslToHex(hue + 150, richSaturation * 0.9, highLightness),
        hslToHex(hue - 150, richSaturation * 0.86, midLightness * 0.8),
        hslToHex(hue, richSaturation * 0.68, lowLightness),
      ]
    case "triad":
      return [
        hslToHex(hue, richSaturation, midLightness),
        hslToHex(hue + 120, richSaturation * 0.9, highLightness),
        hslToHex(hue + 240, richSaturation * 0.82, Math.max(0.24, midLightness * 0.68)),
        hslToHex(hue, richSaturation * 0.72, lowLightness),
      ]
    case "square":
      return [
        hslToHex(hue, richSaturation, midLightness),
        hslToHex(hue + 90, richSaturation * 0.84, highLightness),
        hslToHex(hue + 180, richSaturation * 0.78, Math.max(0.24, midLightness * 0.7)),
        hslToHex(hue + 270, richSaturation * 0.7, lowLightness + 0.04),
      ]
    case "compound":
      return [
        hslToHex(hue - 24, richSaturation, midLightness),
        hslToHex(hue + 28, richSaturation * 0.9, highLightness),
        hslToHex(hue + 172, richSaturation * 0.74, Math.max(0.24, midLightness * 0.66)),
        hslToHex(hue - 40, richSaturation * 0.72, lowLightness),
      ]
    case "shades":
      return [
        hslToHex(hue, richSaturation, highLightness),
        hslToHex(hue, richSaturation * 0.9, midLightness),
        hslToHex(hue, richSaturation * 0.78, Math.max(0.24, midLightness * 0.66)),
        hslToHex(hue, richSaturation * 0.68, lowLightness),
      ]
    case "monochromatic":
      return [
        hslToHex(hue, richSaturation * 0.72, highLightness),
        hslToHex(hue, richSaturation * 0.58, midLightness),
        hslToHex(hue, richSaturation * 0.46, Math.max(0.24, midLightness * 0.68)),
        hslToHex(hue, richSaturation * 0.36, lowLightness),
      ]
    case "analogous":
    default:
      return [
        hslToHex(hue - 28, richSaturation * 0.86, Math.max(0.28, midLightness * 0.82)),
        hslToHex(hue, richSaturation, highLightness),
        hslToHex(hue + 32, richSaturation * 0.94, midLightness),
        hslToHex(hue + 8, richSaturation * 0.68, lowLightness),
      ]
  }
}

export function createReactBitsEvilEyeHarmonyColor(
  primaryColor: string,
  harmony: ColorHarmony,
): string {
  const [hue, saturation, lightness] = rgbToHsl(parseHexColorToRgb(primaryColor))
  const eyeSaturation = Math.min(0.94, Math.max(0.46, saturation))
  const eyeLightness = Math.min(0.74, Math.max(0.42, lightness + 0.02))

  switch (harmony) {
    case "complementary":
      return hslToHex(hue + 180, Math.min(0.88, eyeSaturation * 0.92), eyeLightness)
    case "split-complementary":
      return hslToHex(hue + 150, Math.min(0.9, eyeSaturation * 0.96), eyeLightness)
    case "triad":
      return hslToHex(hue + 120, Math.min(0.92, eyeSaturation * 0.98), eyeLightness)
    case "square":
      return hslToHex(hue + 90, Math.min(0.88, eyeSaturation * 0.92), eyeLightness)
    case "compound":
      return hslToHex(hue - 24, Math.min(0.94, eyeSaturation), Math.min(0.78, eyeLightness + 0.02))
    case "shades":
      return hslToHex(hue, Math.min(0.78, eyeSaturation * 0.78), Math.min(0.82, eyeLightness + 0.08))
    case "monochromatic":
      return hslToHex(hue, Math.min(0.74, eyeSaturation * 0.72), eyeLightness)
    case "analogous":
    default:
      return hslToHex(hue + 28, Math.min(0.92, eyeSaturation * 0.96), eyeLightness)
  }
}

export function createReactBitsLineWavesHarmonyPalette(
  primaryColor: string,
  harmony: ColorHarmony,
): [string, string, string] {
  const [hue, saturation, lightness] = rgbToHsl(parseHexColorToRgb(primaryColor))
  const lineSaturation = Math.min(0.9, Math.max(0.24, saturation))
  const lowLightness = Math.min(0.72, Math.max(0.34, lightness))
  const midLightness = Math.min(0.84, Math.max(0.5, lightness + 0.12))
  const highLightness = Math.min(0.96, Math.max(0.68, lightness + 0.26))

  switch (harmony) {
    case "complementary":
      return [
        hslToHex(hue, lineSaturation * 0.72, highLightness),
        hslToHex(hue + 180, lineSaturation * 0.82, midLightness),
        hslToHex(hue + 180, lineSaturation * 0.58, lowLightness),
      ]
    case "split-complementary":
      return [
        hslToHex(hue, lineSaturation * 0.72, highLightness),
        hslToHex(hue + 150, lineSaturation * 0.86, midLightness),
        hslToHex(hue - 150, lineSaturation * 0.68, lowLightness),
      ]
    case "triad":
      return [
        hslToHex(hue, lineSaturation * 0.72, highLightness),
        hslToHex(hue + 120, lineSaturation * 0.84, midLightness),
        hslToHex(hue + 240, lineSaturation * 0.68, lowLightness),
      ]
    case "square":
      return [
        hslToHex(hue, lineSaturation * 0.72, highLightness),
        hslToHex(hue + 90, lineSaturation * 0.82, midLightness),
        hslToHex(hue + 180, lineSaturation * 0.66, lowLightness),
      ]
    case "compound":
      return [
        hslToHex(hue - 24, lineSaturation * 0.78, highLightness),
        hslToHex(hue + 30, lineSaturation * 0.88, midLightness),
        hslToHex(hue + 172, lineSaturation * 0.62, lowLightness),
      ]
    case "shades":
      return [
        hslToHex(hue, lineSaturation * 0.54, highLightness),
        hslToHex(hue, lineSaturation * 0.46, midLightness),
        hslToHex(hue, lineSaturation * 0.38, lowLightness),
      ]
    case "monochromatic":
      return [
        hslToHex(hue, lineSaturation * 0.42, highLightness),
        hslToHex(hue, lineSaturation * 0.34, midLightness),
        hslToHex(hue, lineSaturation * 0.28, lowLightness),
      ]
    case "analogous":
    default:
      return [
        hslToHex(hue - 28, lineSaturation * 0.76, highLightness),
        hslToHex(hue, lineSaturation * 0.82, midLightness),
        hslToHex(hue + 32, lineSaturation * 0.68, lowLightness),
      ]
  }
}

export function createReactBitsRadarHarmonyColor(
  primaryColor: string,
  harmony: ColorHarmony,
): string {
  const [hue, saturation, lightness] = rgbToHsl(parseHexColorToRgb(primaryColor))
  const radarSaturation = Math.min(0.96, Math.max(0.42, saturation))
  const radarLightness = Math.min(0.76, Math.max(0.42, lightness + 0.04))

  switch (harmony) {
    case "complementary":
      return hslToHex(hue + 180, Math.min(0.9, radarSaturation * 0.94), radarLightness)
    case "split-complementary":
      return hslToHex(hue + 150, Math.min(0.92, radarSaturation * 0.96), radarLightness)
    case "triad":
      return hslToHex(hue + 120, Math.min(0.94, radarSaturation * 0.98), radarLightness)
    case "square":
      return hslToHex(hue + 90, Math.min(0.9, radarSaturation * 0.94), radarLightness)
    case "compound":
      return hslToHex(hue - 24, Math.min(0.96, radarSaturation), Math.min(0.8, radarLightness + 0.02))
    case "shades":
      return hslToHex(hue, Math.min(0.78, radarSaturation * 0.78), Math.min(0.84, radarLightness + 0.08))
    case "monochromatic":
      return hslToHex(hue, Math.min(0.72, radarSaturation * 0.7), radarLightness)
    case "analogous":
    default:
      return hslToHex(hue + 28, Math.min(0.94, radarSaturation * 0.96), radarLightness)
  }
}

export function createReactBitsSoftAuroraHarmonyColors(
  primaryColor: string,
  harmony: ColorHarmony,
): [string, string] {
  const [hue, saturation, lightness] = rgbToHsl(parseHexColorToRgb(primaryColor))
  const auroraSaturation = Math.min(0.96, Math.max(0.38, saturation))
  const paleLightness = Math.min(0.92, Math.max(0.62, lightness + 0.18))
  const glowLightness = Math.min(0.72, Math.max(0.42, lightness + 0.02))

  switch (harmony) {
    case "complementary":
      return [
        hslToHex(hue, auroraSaturation * 0.24, paleLightness),
        hslToHex(hue + 180, auroraSaturation * 0.92, glowLightness),
      ]
    case "split-complementary":
      return [
        hslToHex(hue - 18, auroraSaturation * 0.28, paleLightness),
        hslToHex(hue + 150, auroraSaturation * 0.96, glowLightness),
      ]
    case "triad":
      return [
        hslToHex(hue + 120, auroraSaturation * 0.3, paleLightness),
        hslToHex(hue + 240, auroraSaturation * 0.9, glowLightness),
      ]
    case "square":
      return [
        hslToHex(hue + 90, auroraSaturation * 0.28, paleLightness),
        hslToHex(hue + 180, auroraSaturation * 0.9, glowLightness),
      ]
    case "compound":
      return [
        hslToHex(hue - 20, auroraSaturation * 0.32, paleLightness),
        hslToHex(hue + 34, auroraSaturation * 0.94, glowLightness),
      ]
    case "shades":
      return [
        hslToHex(hue, auroraSaturation * 0.22, paleLightness),
        hslToHex(hue, auroraSaturation * 0.72, Math.max(0.34, glowLightness - 0.08)),
      ]
    case "monochromatic":
      return [
        hslToHex(hue, auroraSaturation * 0.2, paleLightness),
        hslToHex(hue, auroraSaturation * 0.62, glowLightness),
      ]
    case "analogous":
    default:
      return [
        hslToHex(hue - 24, auroraSaturation * 0.26, paleLightness),
        hslToHex(hue + 30, auroraSaturation * 0.92, glowLightness),
      ]
  }
}

export function createReactBitsPlasmaHarmonyColor(
  primaryColor: string,
  harmony: ColorHarmony,
): string {
  const [hue, saturation, lightness] = rgbToHsl(parseHexColorToRgb(primaryColor))
  const plasmaSaturation = Math.min(0.96, Math.max(0.42, saturation))
  const plasmaLightness = Math.min(0.86, Math.max(0.48, lightness + 0.04))

  switch (harmony) {
    case "complementary":
      return hslToHex(hue + 180, Math.min(0.94, plasmaSaturation * 0.94), plasmaLightness)
    case "split-complementary":
      return hslToHex(hue + 150, Math.min(0.96, plasmaSaturation), Math.min(0.88, plasmaLightness + 0.02))
    case "triad":
      return hslToHex(hue + 120, Math.min(0.96, plasmaSaturation), plasmaLightness)
    case "square":
      return hslToHex(hue + 90, Math.min(0.94, plasmaSaturation * 0.94), Math.min(0.88, plasmaLightness + 0.02))
    case "compound":
      return hslToHex(hue - 28, Math.min(0.98, plasmaSaturation), Math.min(0.86, plasmaLightness + 0.02))
    case "shades":
      return hslToHex(hue, Math.min(0.78, plasmaSaturation * 0.78), Math.min(0.92, plasmaLightness + 0.12))
    case "monochromatic":
      return hslToHex(hue, plasmaSaturation, plasmaLightness)
    case "analogous":
    default:
      return hslToHex(hue + 28, Math.min(0.96, plasmaSaturation * 0.96), plasmaLightness)
  }
}

export function createReactBitsPlasmaWaveHarmonyColors(
  primaryColor: string,
  harmony: ColorHarmony,
): [string, string] {
  const [hue, saturation, lightness] = rgbToHsl(parseHexColorToRgb(primaryColor))
  const waveSaturation = Math.min(0.96, Math.max(0.46, saturation))
  const firstLightness = Math.min(0.74, Math.max(0.46, lightness + 0.02))
  const secondLightness = Math.min(0.72, Math.max(0.44, lightness))

  switch (harmony) {
    case "complementary":
      return [
        hslToHex(hue, waveSaturation, firstLightness),
        hslToHex(hue + 180, Math.min(0.94, waveSaturation * 0.92), secondLightness),
      ]
    case "split-complementary":
      return [
        hslToHex(hue - 18, waveSaturation, firstLightness),
        hslToHex(hue + 150, Math.min(0.96, waveSaturation), secondLightness),
      ]
    case "triad":
      return [
        hslToHex(hue + 120, waveSaturation, firstLightness),
        hslToHex(hue + 240, Math.min(0.94, waveSaturation * 0.94), secondLightness),
      ]
    case "square":
      return [
        hslToHex(hue + 90, Math.min(0.94, waveSaturation), firstLightness),
        hslToHex(hue + 180, Math.min(0.9, waveSaturation * 0.9), secondLightness),
      ]
    case "compound":
      return [
        hslToHex(hue - 24, waveSaturation, firstLightness),
        hslToHex(hue + 36, Math.min(0.96, waveSaturation), secondLightness),
      ]
    case "shades":
      return [
        hslToHex(hue, Math.min(0.86, waveSaturation * 0.86), Math.min(0.82, firstLightness + 0.08)),
        hslToHex(hue, Math.min(0.72, waveSaturation * 0.72), Math.max(0.34, secondLightness - 0.1)),
      ]
    case "monochromatic":
      return [
        hslToHex(hue, waveSaturation, firstLightness),
        hslToHex(hue, Math.min(0.78, waveSaturation * 0.78), Math.max(0.36, secondLightness - 0.08)),
      ]
    case "analogous":
    default:
      return [
        hslToHex(hue - 24, waveSaturation, firstLightness),
        hslToHex(hue + 34, Math.min(0.96, waveSaturation * 0.94), secondLightness),
      ]
  }
}

export function createReactBitsParticlesHarmonyColors(
  primaryColor: string,
  harmony: ColorHarmony,
): [string, string, string] {
  const [hue, saturation, lightness] = rgbToHsl(parseHexColorToRgb(primaryColor))
  const particleSaturation = Math.min(0.94, Math.max(0.28, saturation))
  const brightLightness = Math.min(0.9, Math.max(0.62, lightness + 0.14))
  const midLightness = Math.min(0.82, Math.max(0.5, lightness + 0.06))
  const dimLightness = Math.min(0.72, Math.max(0.42, lightness - 0.02))

  switch (harmony) {
    case "complementary":
      return [
        hslToHex(hue, particleSaturation * 0.72, brightLightness),
        hslToHex(hue + 180, Math.min(0.9, particleSaturation), midLightness),
        hslToHex(hue + 180, Math.min(0.72, particleSaturation * 0.72), brightLightness),
      ]
    case "split-complementary":
      return [
        hslToHex(hue, particleSaturation * 0.7, brightLightness),
        hslToHex(hue + 150, Math.min(0.92, particleSaturation), midLightness),
        hslToHex(hue - 150, Math.min(0.86, particleSaturation * 0.86), dimLightness),
      ]
    case "triad":
      return [
        hslToHex(hue, particleSaturation * 0.72, brightLightness),
        hslToHex(hue + 120, Math.min(0.9, particleSaturation), midLightness),
        hslToHex(hue + 240, Math.min(0.86, particleSaturation * 0.86), dimLightness),
      ]
    case "square":
      return [
        hslToHex(hue, particleSaturation * 0.72, brightLightness),
        hslToHex(hue + 90, Math.min(0.88, particleSaturation * 0.88), midLightness),
        hslToHex(hue + 180, Math.min(0.78, particleSaturation * 0.78), dimLightness),
      ]
    case "compound":
      return [
        hslToHex(hue - 22, Math.min(0.86, particleSaturation * 0.86), brightLightness),
        hslToHex(hue + 28, Math.min(0.92, particleSaturation), midLightness),
        hslToHex(hue + 180, Math.min(0.72, particleSaturation * 0.72), dimLightness),
      ]
    case "shades":
      return [
        hslToHex(hue, particleSaturation * 0.42, brightLightness),
        hslToHex(hue, particleSaturation * 0.58, midLightness),
        hslToHex(hue, particleSaturation * 0.72, dimLightness),
      ]
    case "monochromatic":
      return [
        hslToHex(hue, particleSaturation * 0.46, brightLightness),
        hslToHex(hue, particleSaturation * 0.66, midLightness),
        hslToHex(hue, particleSaturation, dimLightness),
      ]
    case "analogous":
    default:
      return [
        hslToHex(hue - 24, particleSaturation * 0.72, brightLightness),
        hslToHex(hue, Math.min(0.9, particleSaturation), midLightness),
        hslToHex(hue + 28, Math.min(0.84, particleSaturation * 0.84), dimLightness),
      ]
  }
}

export function createReactBitsGradientBlindsHarmonyColors(
  primaryColor: string,
  harmony: ColorHarmony,
): [string, string] {
  const [hue, saturation, lightness] = rgbToHsl(parseHexColorToRgb(primaryColor))
  const blindSaturation = Math.min(0.96, Math.max(0.44, saturation))
  const firstLightness = Math.min(0.78, Math.max(0.54, lightness + 0.08))
  const secondLightness = Math.min(0.7, Math.max(0.4, lightness - 0.02))

  switch (harmony) {
    case "complementary":
      return [
        hslToHex(hue, blindSaturation, firstLightness),
        hslToHex(hue + 180, Math.min(0.92, blindSaturation * 0.92), secondLightness),
      ]
    case "split-complementary":
      return [
        hslToHex(hue - 18, blindSaturation, firstLightness),
        hslToHex(hue + 150, Math.min(0.94, blindSaturation), secondLightness),
      ]
    case "triad":
      return [
        hslToHex(hue + 120, blindSaturation, firstLightness),
        hslToHex(hue + 240, Math.min(0.92, blindSaturation * 0.92), secondLightness),
      ]
    case "square":
      return [
        hslToHex(hue + 90, Math.min(0.94, blindSaturation), firstLightness),
        hslToHex(hue + 180, Math.min(0.86, blindSaturation * 0.86), secondLightness),
      ]
    case "compound":
      return [
        hslToHex(hue - 28, Math.min(0.94, blindSaturation), firstLightness),
        hslToHex(hue + 34, Math.min(0.96, blindSaturation), secondLightness),
      ]
    case "shades":
      return [
        hslToHex(hue, Math.min(0.82, blindSaturation * 0.82), firstLightness),
        hslToHex(hue, Math.min(0.68, blindSaturation * 0.68), secondLightness),
      ]
    case "monochromatic":
      return [
        hslToHex(hue, blindSaturation, firstLightness),
        hslToHex(hue, Math.min(0.76, blindSaturation * 0.76), secondLightness),
      ]
    case "analogous":
    default:
      return [
        hslToHex(hue - 24, blindSaturation, firstLightness),
        hslToHex(hue + 32, Math.min(0.94, blindSaturation * 0.94), secondLightness),
      ]
  }
}

export function createReactBitsGrainientHarmonyColors(
  primaryColor: string,
  harmony: ColorHarmony,
): [string, string, string] {
  const [hue, saturation, lightness] = rgbToHsl(parseHexColorToRgb(primaryColor))
  const grainSaturation = Math.min(0.95, Math.max(0.42, saturation))
  const brightLightness = Math.min(0.82, Math.max(0.56, lightness + 0.08))
  const midLightness = Math.min(0.72, Math.max(0.44, lightness - 0.02))
  const softLightness = Math.min(0.86, Math.max(0.52, lightness + 0.12))

  switch (harmony) {
    case "complementary":
      return [
        hslToHex(hue, grainSaturation, brightLightness),
        hslToHex(hue + 180, Math.min(0.92, grainSaturation * 0.95), midLightness),
        hslToHex(hue + 210, Math.min(0.72, grainSaturation * 0.5), softLightness),
      ]
    case "split-complementary":
      return [
        hslToHex(hue, grainSaturation, brightLightness),
        hslToHex(hue + 150, Math.min(0.92, grainSaturation * 0.92), midLightness),
        hslToHex(hue + 210, Math.min(0.82, grainSaturation * 0.72), softLightness),
      ]
    case "triad":
      return [
        hslToHex(hue, grainSaturation, brightLightness),
        hslToHex(hue + 120, Math.min(0.94, grainSaturation), midLightness),
        hslToHex(hue + 240, Math.min(0.84, grainSaturation * 0.82), softLightness),
      ]
    case "square":
      return [
        hslToHex(hue, grainSaturation, brightLightness),
        hslToHex(hue + 90, Math.min(0.9, grainSaturation * 0.9), midLightness),
        hslToHex(hue + 180, Math.min(0.78, grainSaturation * 0.72), softLightness),
      ]
    case "compound":
      return [
        hslToHex(hue - 24, Math.min(0.9, grainSaturation * 0.9), brightLightness),
        hslToHex(hue + 18, grainSaturation, midLightness),
        hslToHex(hue + 180, Math.min(0.74, grainSaturation * 0.68), softLightness),
      ]
    case "shades":
      return [
        hslToHex(hue, Math.min(0.82, grainSaturation * 0.82), brightLightness),
        hslToHex(hue, Math.min(0.64, grainSaturation * 0.64), midLightness),
        hslToHex(hue, Math.min(0.42, grainSaturation * 0.42), softLightness),
      ]
    case "monochromatic":
      return [
        hslToHex(hue, grainSaturation, brightLightness),
        hslToHex(hue, grainSaturation * 0.65, midLightness),
        hslToHex(hue, grainSaturation * 0.35, softLightness),
      ]
    case "analogous":
    default:
      return [
        hslToHex(hue - 24, grainSaturation, brightLightness),
        hslToHex(hue + 18, Math.min(0.92, grainSaturation * 0.95), midLightness),
        hslToHex(hue + 42, Math.min(0.74, grainSaturation * 0.58), softLightness),
      ]
  }
}

export function createReactBitsGridScanHarmonyColors(
  primaryColor: string,
  harmony: ColorHarmony,
): [string, string] {
  const [hue, saturation, lightness] = rgbToHsl(parseHexColorToRgb(primaryColor))
  const scanSaturation = Math.min(0.96, Math.max(0.44, saturation))
  const lineLightness = Math.min(0.24, Math.max(0.08, lightness * 0.34))
  const scanLightness = Math.min(0.82, Math.max(0.56, lightness + 0.12))

  switch (harmony) {
    case "complementary":
      return [
        hslToHex(hue + 180, scanSaturation * 0.5, lineLightness),
        hslToHex(hue, scanSaturation, scanLightness),
      ]
    case "split-complementary":
      return [
        hslToHex(hue + 210, scanSaturation * 0.48, lineLightness),
        hslToHex(hue - 18, scanSaturation, scanLightness),
      ]
    case "triad":
      return [
        hslToHex(hue + 240, scanSaturation * 0.52, lineLightness),
        hslToHex(hue + 120, Math.min(0.92, scanSaturation * 0.94), scanLightness),
      ]
    case "square":
      return [
        hslToHex(hue + 180, scanSaturation * 0.46, lineLightness),
        hslToHex(hue + 90, Math.min(0.92, scanSaturation), scanLightness),
      ]
    case "compound":
      return [
        hslToHex(hue + 180, scanSaturation * 0.42, lineLightness),
        hslToHex(hue + 24, Math.min(0.96, scanSaturation), scanLightness),
      ]
    case "shades":
      return [
        hslToHex(hue, scanSaturation * 0.36, lineLightness),
        hslToHex(hue, scanSaturation, scanLightness),
      ]
    case "monochromatic":
      return [
        hslToHex(hue, scanSaturation * 0.42, lineLightness),
        hslToHex(hue, scanSaturation, scanLightness),
      ]
    case "analogous":
    default:
      return [
        hslToHex(hue + 28, scanSaturation * 0.48, lineLightness),
        hslToHex(hue - 18, scanSaturation, scanLightness),
      ]
  }
}

export function createReactBitsBeamsHarmonyColor(
  primaryColor: string,
  harmony: ColorHarmony,
): string {
  const [hue, saturation, lightness] = rgbToHsl(parseHexColorToRgb(primaryColor))
  const beamSaturation = Math.min(0.88, Math.max(0.2, saturation * 0.8))
  const beamLightness = Math.min(0.96, Math.max(0.62, lightness + 0.22))

  switch (harmony) {
    case "complementary":
      return hslToHex(hue + 180, beamSaturation, beamLightness)
    case "split-complementary":
      return hslToHex(hue + 150, beamSaturation, beamLightness)
    case "triad":
      return hslToHex(hue + 120, beamSaturation, beamLightness)
    case "square":
      return hslToHex(hue + 90, beamSaturation, beamLightness)
    case "compound":
      return hslToHex(hue - 24, beamSaturation, beamLightness)
    case "shades":
    case "monochromatic":
      return hslToHex(hue, Math.min(0.58, beamSaturation * 0.7), beamLightness)
    case "analogous":
    default:
      return hslToHex(hue + 22, beamSaturation, beamLightness)
  }
}

export function createReactBitsPixelSnowHarmonyColor(
  primaryColor: string,
  harmony: ColorHarmony,
): string {
  const [hue, saturation, lightness] = rgbToHsl(parseHexColorToRgb(primaryColor))
  const snowSaturation = Math.min(0.76, Math.max(0.12, saturation * 0.55))
  const snowLightness = Math.min(0.98, Math.max(0.78, lightness + 0.28))

  switch (harmony) {
    case "complementary":
      return hslToHex(hue + 180, snowSaturation, snowLightness)
    case "split-complementary":
      return hslToHex(hue + 150, snowSaturation, snowLightness)
    case "triad":
      return hslToHex(hue + 120, snowSaturation, snowLightness)
    case "square":
      return hslToHex(hue + 90, snowSaturation, snowLightness)
    case "compound":
      return hslToHex(hue - 26, snowSaturation, snowLightness)
    case "shades":
    case "monochromatic":
      return hslToHex(hue, Math.min(0.48, snowSaturation), snowLightness)
    case "analogous":
    default:
      return hslToHex(hue + 24, snowSaturation, snowLightness)
  }
}

export function createReactBitsLightningHarmonyHue(
  primaryColor: string,
  harmony: ColorHarmony,
): number {
  const [hue] = rgbToHsl(parseHexColorToRgb(primaryColor))

  switch (harmony) {
    case "complementary":
      return normalizeHue(hue + 180)
    case "split-complementary":
      return normalizeHue(hue + 150)
    case "triad":
      return normalizeHue(hue + 120)
    case "square":
      return normalizeHue(hue + 90)
    case "compound":
      return normalizeHue(hue - 28)
    case "shades":
    case "monochromatic":
      return normalizeHue(hue)
    case "analogous":
    default:
      return normalizeHue(hue + 24)
  }
}

export function createReactBitsGalaxyHarmonyHue(
  primaryColor: string,
  harmony: ColorHarmony,
): number {
  return createReactBitsLightningHarmonyHue(primaryColor, harmony)
}

export function createReactBitsDitherHarmonyColor(
  primaryColor: string,
  harmony: ColorHarmony,
): string {
  return createReactBitsPixelSnowHarmonyColor(primaryColor, harmony)
}

export function createReactBitsFaultyTerminalHarmonyColor(
  primaryColor: string,
  harmony: ColorHarmony,
): string {
  return createReactBitsPixelSnowHarmonyColor(primaryColor, harmony)
}

export function createReactBitsRippleGridHarmonyColor(
  primaryColor: string,
  harmony: ColorHarmony,
): string {
  return createReactBitsPixelSnowHarmonyColor(primaryColor, harmony)
}

export function createReactBitsDotFieldHarmonyColors(
  primaryColor: string,
  harmony: ColorHarmony,
): [string, string, string] {
  const [hue, saturation, lightness] = rgbToHsl(parseHexColorToRgb(primaryColor))
  const dotSaturation = Math.min(0.86, Math.max(0.34, saturation * 0.78))
  const fromLightness = Math.min(0.72, Math.max(0.42, lightness + 0.06))
  const toLightness = Math.min(0.82, Math.max(0.5, lightness + 0.16))
  const glowLightness = Math.min(0.16, Math.max(0.04, lightness * 0.22))

  switch (harmony) {
    case "complementary":
      return [
        hslToHex(hue, dotSaturation, fromLightness),
        hslToHex(hue + 180, dotSaturation * 0.72, toLightness),
        hslToHex(hue, dotSaturation * 0.46, glowLightness),
      ]
    case "split-complementary":
      return [
        hslToHex(hue, dotSaturation, fromLightness),
        hslToHex(hue + 150, dotSaturation * 0.76, toLightness),
        hslToHex(hue + 210, dotSaturation * 0.42, glowLightness),
      ]
    case "triad":
      return [
        hslToHex(hue, dotSaturation, fromLightness),
        hslToHex(hue + 120, dotSaturation * 0.78, toLightness),
        hslToHex(hue + 240, dotSaturation * 0.42, glowLightness),
      ]
    case "square":
      return [
        hslToHex(hue + 90, dotSaturation * 0.84, fromLightness),
        hslToHex(hue + 180, dotSaturation * 0.72, toLightness),
        hslToHex(hue + 270, dotSaturation * 0.42, glowLightness),
      ]
    case "compound":
      return [
        hslToHex(hue - 24, dotSaturation * 0.86, fromLightness),
        hslToHex(hue + 184, dotSaturation * 0.68, toLightness),
        hslToHex(hue, dotSaturation * 0.42, glowLightness),
      ]
    case "shades":
    case "monochromatic":
      return [
        hslToHex(hue, dotSaturation * 0.62, fromLightness),
        hslToHex(hue, dotSaturation * 0.42, toLightness),
        hslToHex(hue, dotSaturation * 0.32, glowLightness),
      ]
    case "analogous":
    default:
      return [
        hslToHex(hue - 24, dotSaturation * 0.82, fromLightness),
        hslToHex(hue + 24, dotSaturation * 0.68, toLightness),
        hslToHex(hue, dotSaturation * 0.42, glowLightness),
      ]
  }
}

export function createReactBitsDotGridHarmonyColors(
  primaryColor: string,
  harmony: ColorHarmony,
): [string, string] {
  const [fromColor, toColor] = createReactBitsDotFieldHarmonyColors(primaryColor, harmony)
  return [fromColor, toColor]
}

export function createReactBitsThreadsHarmonyColor(primaryColor: string, harmony: ColorHarmony): string {
  return createReactBitsSilkHarmonyColor(primaryColor, harmony)
}

export function createReactBitsIridescenceHarmonyColor(primaryColor: string, harmony: ColorHarmony): string {
  return createReactBitsSilkHarmonyColor(primaryColor, harmony)
}

export function createReactBitsWavesHarmonyColor(primaryColor: string, harmony: ColorHarmony): string {
  return createReactBitsSilkHarmonyColor(primaryColor, harmony)
}

export function createReactBitsGridDistortionHarmonyPalette(
  primaryColor: string,
  harmony: ColorHarmony,
): [string, string, string] {
  const [first, second, third] = createReactBitsColorBendsHarmonyPalette(primaryColor, harmony)
  return [first, second, third]
}

export function createReactBitsPrismaticBurstHarmonyPalette(
  primaryColor: string,
  harmony: ColorHarmony,
): [string, string, string, string] {
  const [hue, saturation, lightness] = rgbToHsl(parseHexColorToRgb(primaryColor))
  const burstSaturation = Math.min(0.96, Math.max(0.5, saturation))
  const midLightness = Math.min(0.7, Math.max(0.42, lightness + 0.04))
  const brightLightness = Math.min(0.84, Math.max(0.58, lightness + 0.18))

  switch (harmony) {
    case "complementary":
      return [
        hslToHex(hue, burstSaturation, midLightness),
        hslToHex(hue + 180, burstSaturation * 0.9, brightLightness),
        hslToHex(hue - 18, burstSaturation * 0.82, midLightness * 0.82),
        hslToHex(hue + 180, burstSaturation * 0.72, 0.9),
      ]
    case "split-complementary":
      return [
        hslToHex(hue, burstSaturation, midLightness),
        hslToHex(hue + 150, burstSaturation * 0.94, brightLightness),
        hslToHex(hue - 150, burstSaturation * 0.88, midLightness),
        hslToHex(hue + 24, burstSaturation * 0.72, 0.88),
      ]
    case "triad":
      return [
        hslToHex(hue, burstSaturation, midLightness),
        hslToHex(hue + 120, burstSaturation * 0.92, brightLightness),
        hslToHex(hue + 240, burstSaturation * 0.86, midLightness),
        hslToHex(hue + 60, burstSaturation * 0.68, 0.9),
      ]
    case "square":
      return [
        hslToHex(hue, burstSaturation, midLightness),
        hslToHex(hue + 90, burstSaturation * 0.88, brightLightness),
        hslToHex(hue + 180, burstSaturation * 0.78, midLightness),
        hslToHex(hue + 270, burstSaturation * 0.76, 0.88),
      ]
    case "compound":
      return [
        hslToHex(hue, burstSaturation, midLightness),
        hslToHex(hue + 28, burstSaturation * 0.9, brightLightness),
        hslToHex(hue + 180, burstSaturation * 0.72, midLightness),
        hslToHex(hue - 34, burstSaturation * 0.76, 0.86),
      ]
    case "shades":
      return [
        hslToHex(hue, burstSaturation, Math.min(0.82, midLightness + 0.16)),
        hslToHex(hue, burstSaturation * 0.88, midLightness),
        hslToHex(hue, burstSaturation * 0.74, Math.max(0.28, midLightness - 0.18)),
        hslToHex(hue, burstSaturation * 0.56, 0.9),
      ]
    case "monochromatic":
      return [
        hslToHex(hue, burstSaturation, midLightness),
        hslToHex(hue, burstSaturation * 0.82, brightLightness),
        hslToHex(hue, burstSaturation * 0.66, Math.max(0.32, midLightness - 0.12)),
        hslToHex(hue, burstSaturation * 0.42, 0.9),
      ]
    case "analogous":
    default:
      return [
        hslToHex(hue - 28, burstSaturation * 0.86, midLightness),
        hslToHex(hue, burstSaturation, brightLightness),
        hslToHex(hue + 32, burstSaturation * 0.9, midLightness),
        hslToHex(hue + 58, burstSaturation * 0.72, 0.88),
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

export function createEldoraPhotonBeamHarmonyPalette(
  primaryColor: string,
  harmony: ColorHarmony,
): [string, string, string, boolean, string, boolean, string] {
  const [hue, saturation, lightness] = rgbToHsl(parseHexColorToRgb(primaryColor))
  const beamSaturation = Math.min(0.98, Math.max(0.48, saturation))
  const signalLightness = Math.min(0.74, Math.max(0.5, lightness + 0.1))
  const lineLightness = Math.min(0.34, Math.max(0.18, lightness * 0.5))
  const backgroundLightness = Math.min(0.055, Math.max(0.015, lightness * 0.12))

  switch (harmony) {
    case "complementary":
      return [
        hslToHex(hue + 180, beamSaturation * 0.56, backgroundLightness),
        hslToHex(hue, beamSaturation * 0.84, lineLightness),
        hslToHex(hue, beamSaturation, signalLightness),
        true,
        hslToHex(hue + 180, beamSaturation * 0.9, Math.min(0.78, signalLightness + 0.03)),
        true,
        hslToHex(hue + 12, beamSaturation, Math.max(0.44, signalLightness - 0.08)),
      ]
    case "split-complementary":
      return [
        hslToHex(hue + 210, beamSaturation * 0.54, backgroundLightness),
        hslToHex(hue - 10, beamSaturation * 0.82, lineLightness),
        hslToHex(hue, beamSaturation, signalLightness),
        true,
        hslToHex(hue + 150, beamSaturation * 0.92, Math.min(0.78, signalLightness + 0.02)),
        true,
        hslToHex(hue + 210, beamSaturation * 0.9, Math.max(0.42, signalLightness - 0.05)),
      ]
    case "triad":
      return [
        hslToHex(hue + 240, beamSaturation * 0.5, backgroundLightness),
        hslToHex(hue, beamSaturation * 0.82, lineLightness),
        hslToHex(hue, beamSaturation, signalLightness),
        true,
        hslToHex(hue + 120, beamSaturation * 0.92, Math.min(0.78, signalLightness + 0.02)),
        true,
        hslToHex(hue + 240, beamSaturation * 0.92, Math.max(0.42, signalLightness - 0.05)),
      ]
    case "square":
      return [
        hslToHex(hue + 180, beamSaturation * 0.52, backgroundLightness),
        hslToHex(hue + 90, beamSaturation * 0.8, lineLightness),
        hslToHex(hue, beamSaturation, signalLightness),
        true,
        hslToHex(hue + 90, beamSaturation * 0.9, Math.min(0.76, signalLightness + 0.02)),
        true,
        hslToHex(hue + 180, beamSaturation * 0.9, Math.max(0.42, signalLightness - 0.05)),
      ]
    case "compound":
      return [
        hslToHex(hue - 24, beamSaturation * 0.52, backgroundLightness),
        hslToHex(hue - 12, beamSaturation * 0.82, lineLightness),
        hslToHex(hue, beamSaturation, signalLightness),
        true,
        hslToHex(hue + 28, beamSaturation * 0.92, Math.min(0.78, signalLightness + 0.02)),
        true,
        hslToHex(hue + 180, beamSaturation * 0.82, Math.max(0.42, signalLightness - 0.07)),
      ]
    case "shades":
      return [
        hslToHex(hue, beamSaturation * 0.44, backgroundLightness),
        hslToHex(hue, beamSaturation * 0.7, lineLightness),
        hslToHex(hue, beamSaturation, signalLightness),
        true,
        hslToHex(hue, beamSaturation * 0.86, Math.min(0.84, signalLightness + 0.16)),
        true,
        hslToHex(hue, beamSaturation, Math.max(0.36, signalLightness - 0.14)),
      ]
    case "monochromatic":
      return [
        hslToHex(hue, beamSaturation * 0.42, backgroundLightness),
        hslToHex(hue, beamSaturation * 0.68, lineLightness),
        hslToHex(hue, beamSaturation, signalLightness),
        true,
        hslToHex(hue, beamSaturation * 0.82, Math.min(0.8, signalLightness + 0.08)),
        true,
        hslToHex(hue, beamSaturation * 0.9, Math.max(0.38, signalLightness - 0.1)),
      ]
    case "analogous":
    default:
      return [
        hslToHex(hue - 28, beamSaturation * 0.52, backgroundLightness),
        hslToHex(hue - 18, beamSaturation * 0.8, lineLightness),
        hslToHex(hue, beamSaturation, signalLightness),
        true,
        hslToHex(hue + 26, beamSaturation * 0.94, Math.min(0.78, signalLightness + 0.02)),
        true,
        hslToHex(hue + 44, beamSaturation * 0.88, Math.max(0.42, signalLightness - 0.06)),
      ]
  }
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

function hexToRgba(color: string, alpha: number): string {
  const [red, green, blue] = parseHexColorToRgb(color)
  return `rgba(${red}, ${green}, ${blue}, ${Math.min(1, Math.max(0, alpha)).toFixed(2)})`
}

function getHueFromHexColor(color: string): number {
  const [hue] = rgbToHsl(parseHexColorToRgb(color))
  return normalizeHue(hue)
}

function normalizeHue(hue: number): number {
  if (!Number.isFinite(hue)) {
    return 230
  }

  return ((hue % 360) + 360) % 360
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

  const useCurrentLocationForGlobe = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      return
    }

    navigator.geolocation.getCurrentPosition(({ coords }) => {
      onSettingsChange({
        aceternity3DGlobeMarkerEnabled: true,
        aceternity3DGlobeMarkerLat: Number(coords.latitude.toFixed(4)),
        aceternity3DGlobeMarkerLng: Number(coords.longitude.toFixed(4)),
      })
    })
  }

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

    if (option.id === "magicui-retro-grid") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.colorRow}>
            <span>Background</span>
            <input
              type="color"
              value={settings.magicRetroGridBackgroundColor}
              onChange={(event) => onSettingsChange({ magicRetroGridBackgroundColor: event.target.value })}
              aria-label="Retro Grid background color"
            />
          </label>

          <label className={styles.colorRow}>
            <span>Light line color</span>
            <input
              type="color"
              value={settings.magicRetroGridLightLineColor}
              onChange={(event) => onSettingsChange({ magicRetroGridLightLineColor: event.target.value })}
              aria-label="Retro Grid light line color"
            />
          </label>

          <label className={styles.colorRow}>
            <span>Dark line color</span>
            <input
              type="color"
              value={settings.magicRetroGridDarkLineColor}
              onChange={(event) => onSettingsChange({ magicRetroGridDarkLineColor: event.target.value })}
              aria-label="Retro Grid dark line color"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Angle ({settings.magicRetroGridAngle.toFixed(0)} deg)</span>
            <input
              type="range"
              min="1"
              max="89"
              step="1"
              value={settings.magicRetroGridAngle}
              onChange={(event) => onSettingsChange({ magicRetroGridAngle: Number(event.target.value) })}
              aria-label="Retro Grid angle"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Cell size ({settings.magicRetroGridCellSize.toFixed(0)}px)</span>
            <input
              type="range"
              min="12"
              max="160"
              step="1"
              value={settings.magicRetroGridCellSize}
              onChange={(event) => onSettingsChange({ magicRetroGridCellSize: Number(event.target.value) })}
              aria-label="Retro Grid cell size"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Grid opacity ({Math.round(settings.magicRetroGridOpacity * 100)}%)</span>
            <input
              type="range"
              min="0.05"
              max="1"
              step="0.01"
              value={settings.magicRetroGridOpacity}
              onChange={(event) => onSettingsChange({ magicRetroGridOpacity: Number(event.target.value) })}
              aria-label="Retro Grid opacity"
            />
          </label>
        </div>
      )
    }

    if (option.id === "aceternity-3d-globe") {
      const globeScaleDisplayPercent = getAceternity3DGlobeScaleDisplayPercent(settings.aceternity3DGlobeScale)
      const isGraphicGlobe = settings.aceternity3DGlobeViewStyle === "graphic"
      const followSun = settings.aceternity3DGlobeLightingMode === "sun"

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>View style</span>
            <select
              value={settings.aceternity3DGlobeViewStyle}
              onChange={(event) => onSettingsChange({
                aceternity3DGlobeViewStyle: event.target.value as ChimerSettings["aceternity3DGlobeViewStyle"],
              })}
              aria-label="3D Globe view style"
            >
              <option value="realistic">Realistic</option>
              <option value="graphic">Graphic</option>
            </select>
          </label>

          <label className={styles.colorRow}>
            <span>Background</span>
            <input
              type="color"
              value={settings.aceternity3DGlobeBackgroundColor}
              onChange={(event) => onSettingsChange({ aceternity3DGlobeBackgroundColor: event.target.value })}
              aria-label="3D Globe background color"
            />
          </label>

          {isGraphicGlobe ? (
            <>
              <label className={styles.colorRow}>
                <span>Map dots</span>
                <input
                  type="color"
                  value={settings.aceternity3DGlobeGraphicMapColor}
                  onChange={(event) => onSettingsChange({ aceternity3DGlobeGraphicMapColor: event.target.value })}
                  aria-label="3D Globe graphic map dot color"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Outer Glow</span>
                <input
                  type="color"
                  value={settings.aceternity3DGlobeGraphicGlowColor}
                  onChange={(event) => onSettingsChange({ aceternity3DGlobeGraphicGlowColor: event.target.value })}
                  aria-label="3D Globe graphic outer glow color"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Marker dots</span>
                <input
                  type="color"
                  value={settings.aceternity3DGlobeGraphicMarkerColor}
                  onChange={(event) => onSettingsChange({ aceternity3DGlobeGraphicMarkerColor: event.target.value })}
                  aria-label="3D Globe graphic marker color"
                />
              </label>
              <label className={styles.rangeRow}>
                <span>Dot density ({Math.round(settings.aceternity3DGlobeGraphicMapSamples / 1000)}k)</span>
                <input
                  type="range"
                  min="1000"
                  max="10000"
                  step="1000"
                  value={settings.aceternity3DGlobeGraphicMapSamples}
                  onChange={(event) => onSettingsChange({
                    aceternity3DGlobeGraphicMapSamples: Number(event.target.value),
                  })}
                  aria-label="3D Globe graphic dot density"
                />
              </label>
            </>
          ) : (
            <label className={styles.colorRow}>
              <span>Globe tint</span>
              <input
                type="color"
                value={settings.aceternity3DGlobeGlobeColor}
                onChange={(event) => onSettingsChange({ aceternity3DGlobeGlobeColor: event.target.value })}
                aria-label="3D Globe tint color"
              />
            </label>
          )}

          {!followSun && (
            <>
              <label className={styles.rangeRow}>
                <span>Rotation speed ({settings.aceternity3DGlobeAutoRotateSpeed.toFixed(2)}x)</span>
                <input
                  type="range"
                  min="0.01"
                  max="2"
                  step="0.01"
                  value={settings.aceternity3DGlobeAutoRotateSpeed}
                  onChange={(event) => onSettingsChange({ aceternity3DGlobeAutoRotateSpeed: Number(event.target.value) })}
                  aria-label="3D Globe rotation speed"
                />
              </label>

            </>
          )}

          <label className={styles.switchRow}>
            <span>Follow Sun</span>
            <input
              type="checkbox"
              checked={followSun}
              onChange={(event) => onSettingsChange({ aceternity3DGlobeLightingMode: event.target.checked ? "sun" : "manual" })}
              aria-label="3D Globe follow sun"
            />
          </label>

          <label className={styles.switchRow}>
            <span>Pan controls</span>
            <input
              type="checkbox"
              checked={settings.aceternity3DGlobeEnablePan}
              onChange={(event) => onSettingsChange({ aceternity3DGlobeEnablePan: event.target.checked })}
              aria-label="3D Globe pan controls"
            />
          </label>

          {settings.aceternity3DGlobeEnablePan && (
            <>
              <label className={styles.rangeRow}>
                <span>Pan X Left/Right ({Math.round(settings.aceternity3DGlobePanX)}%)</span>
                <input
                  type="range"
                  min="-50"
                  max="50"
                  step="1"
                  value={settings.aceternity3DGlobePanX}
                  onChange={(event) => onSettingsChange({ aceternity3DGlobePanX: Number(event.target.value) })}
                  aria-label="3D Globe pan X left right"
                />
              </label>

              <label className={styles.rangeRow}>
                <span>Pan Y Up/Down ({Math.round(settings.aceternity3DGlobePanY)}%)</span>
                <input
                  type="range"
                  min="-50"
                  max="50"
                  step="1"
                  value={settings.aceternity3DGlobePanY}
                  onChange={(event) => onSettingsChange({ aceternity3DGlobePanY: Number(event.target.value) })}
                  aria-label="3D Globe pan Y up down"
                />
              </label>
            </>
          )}

          <label className={styles.rangeRow}>
            <span>Globe size ({globeScaleDisplayPercent}%)</span>
            <input
              type="range"
              min="1"
              max="100"
              step="1"
              value={globeScaleDisplayPercent}
              onChange={(event) => onSettingsChange({
                aceternity3DGlobeScale: getAceternity3DGlobeScaleFromDisplayPercent(Number(event.target.value)),
              })}
              aria-label="3D Globe size"
            />
          </label>

          {!isGraphicGlobe && (
            <label className={styles.rangeRow}>
              <span>Bump scale ({settings.aceternity3DGlobeBumpScale.toFixed(1)})</span>
              <input
                type="range"
                min="0"
                max="3"
                step="0.1"
                value={settings.aceternity3DGlobeBumpScale}
                onChange={(event) => onSettingsChange({ aceternity3DGlobeBumpScale: Number(event.target.value) })}
                aria-label="3D Globe bump scale"
              />
            </label>
          )}

          {!followSun && (
            <>
              <label className={styles.rangeRow}>
                <span>Ambient light ({settings.aceternity3DGlobeAmbientIntensity.toFixed(1)})</span>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={settings.aceternity3DGlobeAmbientIntensity}
                  onChange={(event) => onSettingsChange({ aceternity3DGlobeAmbientIntensity: Number(event.target.value) })}
                  aria-label="3D Globe ambient light"
                />
              </label>

              <label className={styles.rangeRow}>
                <span>Point light ({settings.aceternity3DGlobePointLightIntensity.toFixed(1)})</span>
                <input
                  type="range"
                  min="0"
                  max="4"
                  step="0.1"
                  value={settings.aceternity3DGlobePointLightIntensity}
                  onChange={(event) => onSettingsChange({ aceternity3DGlobePointLightIntensity: Number(event.target.value) })}
                  aria-label="3D Globe point light"
                />
              </label>
            </>
          )}

          {!isGraphicGlobe && (
            <>
              <label className={styles.switchRow}>
                <span>Atmosphere</span>
                <input
                  type="checkbox"
                  checked={settings.aceternity3DGlobeShowAtmosphere}
                  onChange={(event) => onSettingsChange({ aceternity3DGlobeShowAtmosphere: event.target.checked })}
                  aria-label="3D Globe show atmosphere"
                />
              </label>

              {settings.aceternity3DGlobeShowAtmosphere && (
                <>
                  <label className={styles.colorRow}>
                    <span>Atmosphere color</span>
                    <input
                      type="color"
                      value={settings.aceternity3DGlobeAtmosphereColor}
                      onChange={(event) => onSettingsChange({ aceternity3DGlobeAtmosphereColor: event.target.value })}
                      aria-label="3D Globe atmosphere color"
                    />
                  </label>
                  <label className={styles.rangeRow}>
                    <span>Atmosphere ({settings.aceternity3DGlobeAtmosphereIntensity.toFixed(1)})</span>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={settings.aceternity3DGlobeAtmosphereIntensity}
                      onChange={(event) => onSettingsChange({ aceternity3DGlobeAtmosphereIntensity: Number(event.target.value) })}
                      aria-label="3D Globe atmosphere intensity"
                    />
                  </label>
                  <label className={styles.rangeRow}>
                    <span>Atmosphere blur ({settings.aceternity3DGlobeAtmosphereBlur.toFixed(1)})</span>
                    <input
                      type="range"
                      min="0.5"
                      max="5"
                      step="0.1"
                      value={settings.aceternity3DGlobeAtmosphereBlur}
                      onChange={(event) => onSettingsChange({ aceternity3DGlobeAtmosphereBlur: Number(event.target.value) })}
                      aria-label="3D Globe atmosphere blur"
                    />
                  </label>
                </>
              )}

              <label className={styles.switchRow}>
                <span>Wireframe</span>
                <input
                  type="checkbox"
                  checked={settings.aceternity3DGlobeShowWireframe}
                  onChange={(event) => onSettingsChange({ aceternity3DGlobeShowWireframe: event.target.checked })}
                  aria-label="3D Globe show wireframe"
                />
              </label>

              {settings.aceternity3DGlobeShowWireframe && (
                <label className={styles.colorRow}>
                  <span>Wireframe color</span>
                  <input
                    type="color"
                    value={settings.aceternity3DGlobeWireframeColor}
                    onChange={(event) => onSettingsChange({ aceternity3DGlobeWireframeColor: event.target.value })}
                    aria-label="3D Globe wireframe color"
                  />
                </label>
              )}
            </>
          )}

          <label className={styles.switchRow}>
            <span>Location marker</span>
            <input
              type="checkbox"
              checked={settings.aceternity3DGlobeMarkerEnabled}
              onChange={(event) => onSettingsChange({ aceternity3DGlobeMarkerEnabled: event.target.checked })}
              aria-label="3D Globe location marker"
            />
          </label>

          {settings.aceternity3DGlobeMarkerEnabled && (
            <>
              <div className={styles.locationGrid}>
                <label className={styles.textField}>
                  <span>Latitude</span>
                  <input
                    type="number"
                    min="-90"
                    max="90"
                    step="0.0001"
                    value={settings.aceternity3DGlobeMarkerLat}
                    onChange={(event) => onSettingsChange({ aceternity3DGlobeMarkerLat: Number(event.target.value) })}
                    aria-label="3D Globe marker latitude"
                  />
                </label>
                <label className={styles.textField}>
                  <span>Longitude</span>
                  <input
                    type="number"
                    min="-180"
                    max="180"
                    step="0.0001"
                    value={settings.aceternity3DGlobeMarkerLng}
                    onChange={(event) => onSettingsChange({ aceternity3DGlobeMarkerLng: Number(event.target.value) })}
                    aria-label="3D Globe marker longitude"
                  />
                </label>
              </div>
              <button type="button" className={styles.inlineButton} onClick={useCurrentLocationForGlobe}>
                Use my location
              </button>
              <label className={styles.textField}>
                <span>Marker label</span>
                <input
                  type="text"
                  placeholder="Optional"
                  value={settings.aceternity3DGlobeMarkerLabel}
                  onChange={(event) => onSettingsChange({ aceternity3DGlobeMarkerLabel: event.target.value })}
                  aria-label="3D Globe marker label"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Marker icon</span>
                <select
                  value={settings.aceternity3DGlobeMarkerIcon}
                  onChange={(event) => onSettingsChange({
                    aceternity3DGlobeMarkerIcon: event.target.value as ChimerSettings["aceternity3DGlobeMarkerIcon"],
                  })}
                  aria-label="3D Globe marker icon"
                >
                  <option value="pin">Pin</option>
                  <option value="person">Person</option>
                  <option value="heart">Heart</option>
                  <option value="star">Star</option>
                  <option value="home">Home</option>
                </select>
              </label>
              <label className={styles.rangeRow}>
                <span>Marker size ({Math.round(settings.aceternity3DGlobeMarkerSize * 100)}%)</span>
                <input
                  type="range"
                  min="0.03"
                  max="0.16"
                  step="0.005"
                  value={settings.aceternity3DGlobeMarkerSize}
                  onChange={(event) => onSettingsChange({ aceternity3DGlobeMarkerSize: Number(event.target.value) })}
                  aria-label="3D Globe marker size"
                />
              </label>
            </>
          )}
        </div>
      )
    }

    if (option.id === "magicui-light-rays") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.colorRow}>
            <span>Background</span>
            <input
              type="color"
              value={settings.magicLightRaysBackgroundColor}
              onChange={(event) => onSettingsChange({ magicLightRaysBackgroundColor: event.target.value })}
              aria-label="Light Rays background color"
            />
          </label>

          <label className={styles.colorRow}>
            <span>Ray color</span>
            <input
              type="color"
              value={settings.magicLightRaysColor}
              onChange={(event) => onSettingsChange({ magicLightRaysColor: event.target.value })}
              aria-label="Light Rays color"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Ray count ({settings.magicLightRaysCount})</span>
            <input
              type="range"
              min="1"
              max="20"
              step="1"
              value={settings.magicLightRaysCount}
              onChange={(event) => onSettingsChange({ magicLightRaysCount: Number(event.target.value) })}
              aria-label="Light Rays count"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Blur ({settings.magicLightRaysBlur.toFixed(0)}px)</span>
            <input
              type="range"
              min="0"
              max="80"
              step="1"
              value={settings.magicLightRaysBlur}
              onChange={(event) => onSettingsChange({ magicLightRaysBlur: Number(event.target.value) })}
              aria-label="Light Rays blur"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Speed ({settings.magicLightRaysSpeed.toFixed(1)}s)</span>
            <input
              type="range"
              min="2"
              max="40"
              step="0.5"
              value={settings.magicLightRaysSpeed}
              onChange={(event) => onSettingsChange({ magicLightRaysSpeed: Number(event.target.value) })}
              aria-label="Light Rays speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Ray length ({settings.magicLightRaysLength.toFixed(0)}vh)</span>
            <input
              type="range"
              min="24"
              max="120"
              step="1"
              value={settings.magicLightRaysLength}
              onChange={(event) => onSettingsChange({ magicLightRaysLength: Number(event.target.value) })}
              aria-label="Light Rays length"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Ray opacity ({Math.round(settings.magicLightRaysOpacity * 100)}%)</span>
            <input
              type="range"
              min="0.05"
              max="1"
              step="0.01"
              value={settings.magicLightRaysOpacity}
              onChange={(event) => onSettingsChange({ magicLightRaysOpacity: Number(event.target.value) })}
              aria-label="Light Rays opacity"
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

    if (option.id === "react-bits-ferrofluid") {
      const useCustomPalette = settings.reactBitsFerrofluidPaletteMode === "custom"

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.reactBitsFerrofluidPaletteMode}
              onChange={(event) => onSettingsChange({
                reactBitsFerrofluidPaletteMode: event.target.value as ReactBitsFerrofluidPaletteMode,
              })}
              aria-label="Ferrofluid color mode"
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
                  value={settings.reactBitsFerrofluidColorOne}
                  onChange={(event) => onSettingsChange({ reactBitsFerrofluidColorOne: event.target.value })}
                  aria-label="Ferrofluid first color"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Color 2</span>
                <input
                  type="color"
                  value={settings.reactBitsFerrofluidColorTwo}
                  onChange={(event) => onSettingsChange({ reactBitsFerrofluidColorTwo: event.target.value })}
                  aria-label="Ferrofluid second color"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Color 3</span>
                <input
                  type="color"
                  value={settings.reactBitsFerrofluidColorThree}
                  onChange={(event) => onSettingsChange({ reactBitsFerrofluidColorThree: event.target.value })}
                  aria-label="Ferrofluid third color"
                />
              </label>
            </>
          ) : (
            <>
              <label className={styles.colorRow}>
                <span>Primary color</span>
                <input
                  type="color"
                  value={settings.reactBitsFerrofluidPrimaryColor}
                  onChange={(event) => onSettingsChange({ reactBitsFerrofluidPrimaryColor: event.target.value })}
                  aria-label="Ferrofluid primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={settings.reactBitsFerrofluidHarmony}
                  onChange={(event) => onSettingsChange({
                    reactBitsFerrofluidHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="Ferrofluid color harmony"
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

          <label className={styles.selectRow}>
            <span>Flow direction</span>
            <select
              value={settings.reactBitsFerrofluidFlowDirection}
              onChange={(event) => onSettingsChange({
                reactBitsFerrofluidFlowDirection: event.target.value as ChimerSettings["reactBitsFerrofluidFlowDirection"],
              })}
              aria-label="Ferrofluid flow direction"
            >
              <option value="down">Down</option>
              <option value="up">Up</option>
              <option value="left">Left</option>
              <option value="right">Right</option>
            </select>
          </label>

          <label className={styles.rangeRow}>
            <span>Animation speed ({settings.reactBitsFerrofluidSpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0.05"
              max="2"
              step="0.05"
              value={settings.reactBitsFerrofluidSpeed}
              onChange={(event) => onSettingsChange({ reactBitsFerrofluidSpeed: Number(event.target.value) })}
              aria-label="Ferrofluid animation speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Scale ({settings.reactBitsFerrofluidScale.toFixed(1)})</span>
            <input
              type="range"
              min="0.5"
              max="4"
              step="0.1"
              value={settings.reactBitsFerrofluidScale}
              onChange={(event) => onSettingsChange({ reactBitsFerrofluidScale: Number(event.target.value) })}
              aria-label="Ferrofluid scale"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Turbulence ({settings.reactBitsFerrofluidTurbulence.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.05"
              value={settings.reactBitsFerrofluidTurbulence}
              onChange={(event) => onSettingsChange({ reactBitsFerrofluidTurbulence: Number(event.target.value) })}
              aria-label="Ferrofluid turbulence"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Fluidity ({settings.reactBitsFerrofluidFluidity.toFixed(3)})</span>
            <input
              type="range"
              min="0.001"
              max="0.4"
              step="0.001"
              value={settings.reactBitsFerrofluidFluidity}
              onChange={(event) => onSettingsChange({ reactBitsFerrofluidFluidity: Number(event.target.value) })}
              aria-label="Ferrofluid fluidity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Rim width ({settings.reactBitsFerrofluidRimWidth.toFixed(2)})</span>
            <input
              type="range"
              min="0.03"
              max="0.5"
              step="0.01"
              value={settings.reactBitsFerrofluidRimWidth}
              onChange={(event) => onSettingsChange({ reactBitsFerrofluidRimWidth: Number(event.target.value) })}
              aria-label="Ferrofluid rim width"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Sharpness ({settings.reactBitsFerrofluidSharpness.toFixed(1)})</span>
            <input
              type="range"
              min="0.5"
              max="6"
              step="0.1"
              value={settings.reactBitsFerrofluidSharpness}
              onChange={(event) => onSettingsChange({ reactBitsFerrofluidSharpness: Number(event.target.value) })}
              aria-label="Ferrofluid sharpness"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Shimmer ({settings.reactBitsFerrofluidShimmer.toFixed(1)})</span>
            <input
              type="range"
              min="0"
              max="4"
              step="0.1"
              value={settings.reactBitsFerrofluidShimmer}
              onChange={(event) => onSettingsChange({ reactBitsFerrofluidShimmer: Number(event.target.value) })}
              aria-label="Ferrofluid shimmer"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Glow ({settings.reactBitsFerrofluidGlow.toFixed(1)})</span>
            <input
              type="range"
              min="0.1"
              max="5"
              step="0.1"
              value={settings.reactBitsFerrofluidGlow}
              onChange={(event) => onSettingsChange({ reactBitsFerrofluidGlow: Number(event.target.value) })}
              aria-label="Ferrofluid glow"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Opacity ({Math.round(settings.reactBitsFerrofluidOpacity * 100)}%)</span>
            <input
              type="range"
              min="0.05"
              max="1"
              step="0.01"
              value={settings.reactBitsFerrofluidOpacity}
              onChange={(event) => onSettingsChange({ reactBitsFerrofluidOpacity: Number(event.target.value) })}
              aria-label="Ferrofluid opacity"
            />
          </label>
        </div>
      )
    }

    if (option.id === "react-bits-lightfall") {
      const useCustomPalette = settings.reactBitsLightfallPaletteMode === "custom"

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.reactBitsLightfallPaletteMode}
              onChange={(event) => onSettingsChange({
                reactBitsLightfallPaletteMode: event.target.value as ReactBitsLightfallPaletteMode,
              })}
              aria-label="Lightfall color mode"
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
                  value={settings.reactBitsLightfallColorOne}
                  onChange={(event) => onSettingsChange({ reactBitsLightfallColorOne: event.target.value })}
                  aria-label="Lightfall first color"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Color 2</span>
                <input
                  type="color"
                  value={settings.reactBitsLightfallColorTwo}
                  onChange={(event) => onSettingsChange({ reactBitsLightfallColorTwo: event.target.value })}
                  aria-label="Lightfall second color"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Color 3</span>
                <input
                  type="color"
                  value={settings.reactBitsLightfallColorThree}
                  onChange={(event) => onSettingsChange({ reactBitsLightfallColorThree: event.target.value })}
                  aria-label="Lightfall third color"
                />
              </label>
            </>
          ) : (
            <>
              <label className={styles.colorRow}>
                <span>Primary color</span>
                <input
                  type="color"
                  value={settings.reactBitsLightfallPrimaryColor}
                  onChange={(event) => onSettingsChange({ reactBitsLightfallPrimaryColor: event.target.value })}
                  aria-label="Lightfall primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={settings.reactBitsLightfallHarmony}
                  onChange={(event) => onSettingsChange({
                    reactBitsLightfallHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="Lightfall color harmony"
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

          <label className={styles.colorRow}>
            <span>Background</span>
            <input
              type="color"
              value={settings.reactBitsLightfallBackgroundColor}
              onChange={(event) => onSettingsChange({ reactBitsLightfallBackgroundColor: event.target.value })}
              aria-label="Lightfall background color"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Animation speed ({settings.reactBitsLightfallSpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0.05"
              max="2"
              step="0.05"
              value={settings.reactBitsLightfallSpeed}
              onChange={(event) => onSettingsChange({ reactBitsLightfallSpeed: Number(event.target.value) })}
              aria-label="Lightfall animation speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Streak count ({settings.reactBitsLightfallStreakCount.toFixed(0)})</span>
            <input
              type="range"
              min="1"
              max="16"
              step="1"
              value={settings.reactBitsLightfallStreakCount}
              onChange={(event) => onSettingsChange({ reactBitsLightfallStreakCount: Number(event.target.value) })}
              aria-label="Lightfall streak count"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Streak width ({settings.reactBitsLightfallStreakWidth.toFixed(1)})</span>
            <input
              type="range"
              min="0.2"
              max="3"
              step="0.1"
              value={settings.reactBitsLightfallStreakWidth}
              onChange={(event) => onSettingsChange({ reactBitsLightfallStreakWidth: Number(event.target.value) })}
              aria-label="Lightfall streak width"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Streak length ({settings.reactBitsLightfallStreakLength.toFixed(1)})</span>
            <input
              type="range"
              min="0.2"
              max="3"
              step="0.1"
              value={settings.reactBitsLightfallStreakLength}
              onChange={(event) => onSettingsChange({ reactBitsLightfallStreakLength: Number(event.target.value) })}
              aria-label="Lightfall streak length"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Glow ({settings.reactBitsLightfallGlow.toFixed(1)})</span>
            <input
              type="range"
              min="0.1"
              max="3"
              step="0.1"
              value={settings.reactBitsLightfallGlow}
              onChange={(event) => onSettingsChange({ reactBitsLightfallGlow: Number(event.target.value) })}
              aria-label="Lightfall glow"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Density ({settings.reactBitsLightfallDensity.toFixed(2)})</span>
            <input
              type="range"
              min="0.05"
              max="2"
              step="0.05"
              value={settings.reactBitsLightfallDensity}
              onChange={(event) => onSettingsChange({ reactBitsLightfallDensity: Number(event.target.value) })}
              aria-label="Lightfall density"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Twinkle ({Math.round(settings.reactBitsLightfallTwinkle * 100)}%)</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.reactBitsLightfallTwinkle}
              onChange={(event) => onSettingsChange({ reactBitsLightfallTwinkle: Number(event.target.value) })}
              aria-label="Lightfall twinkle"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Zoom ({settings.reactBitsLightfallZoom.toFixed(1)})</span>
            <input
              type="range"
              min="1"
              max="6"
              step="0.1"
              value={settings.reactBitsLightfallZoom}
              onChange={(event) => onSettingsChange({ reactBitsLightfallZoom: Number(event.target.value) })}
              aria-label="Lightfall zoom"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Background glow ({settings.reactBitsLightfallBackgroundGlow.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1.5"
              step="0.05"
              value={settings.reactBitsLightfallBackgroundGlow}
              onChange={(event) => onSettingsChange({ reactBitsLightfallBackgroundGlow: Number(event.target.value) })}
              aria-label="Lightfall background glow"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Opacity ({Math.round(settings.reactBitsLightfallOpacity * 100)}%)</span>
            <input
              type="range"
              min="0.05"
              max="1"
              step="0.01"
              value={settings.reactBitsLightfallOpacity}
              onChange={(event) => onSettingsChange({ reactBitsLightfallOpacity: Number(event.target.value) })}
              aria-label="Lightfall opacity"
            />
          </label>

          <label className={styles.switchRow}>
            <span>Cursor glow</span>
            <input
              type="checkbox"
              checked={settings.reactBitsLightfallCursorEnabled}
              onChange={(event) => onSettingsChange({ reactBitsLightfallCursorEnabled: event.target.checked })}
              aria-label="Lightfall cursor glow"
            />
          </label>

          {settings.reactBitsLightfallCursorEnabled && (
            <>
              <label className={styles.rangeRow}>
                <span>Cursor strength ({settings.reactBitsLightfallCursorStrength.toFixed(2)})</span>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.05"
                  value={settings.reactBitsLightfallCursorStrength}
                  onChange={(event) => onSettingsChange({
                    reactBitsLightfallCursorStrength: Number(event.target.value),
                  })}
                  aria-label="Lightfall cursor strength"
                />
              </label>

              <label className={styles.rangeRow}>
                <span>Cursor radius ({settings.reactBitsLightfallCursorRadius.toFixed(2)})</span>
                <input
                  type="range"
                  min="0.05"
                  max="3"
                  step="0.05"
                  value={settings.reactBitsLightfallCursorRadius}
                  onChange={(event) => onSettingsChange({
                    reactBitsLightfallCursorRadius: Number(event.target.value),
                  })}
                  aria-label="Lightfall cursor radius"
                />
              </label>

              <label className={styles.rangeRow}>
                <span>Cursor smoothing ({settings.reactBitsLightfallCursorDampening.toFixed(2)})</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.reactBitsLightfallCursorDampening}
                  onChange={(event) => onSettingsChange({
                    reactBitsLightfallCursorDampening: Number(event.target.value),
                  })}
                  aria-label="Lightfall cursor smoothing"
                />
              </label>
            </>
          )}
        </div>
      )
    }

    if (option.id === "react-bits-liquid-ether") {
      const useCustomPalette = settings.reactBitsLiquidEtherPaletteMode === "custom"

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.reactBitsLiquidEtherPaletteMode}
              onChange={(event) => onSettingsChange({
                reactBitsLiquidEtherPaletteMode: event.target.value as ReactBitsLiquidEtherPaletteMode,
              })}
              aria-label="Liquid Ether color mode"
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
                  value={settings.reactBitsLiquidEtherColorOne}
                  onChange={(event) => onSettingsChange({ reactBitsLiquidEtherColorOne: event.target.value })}
                  aria-label="Liquid Ether first color"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Color 2</span>
                <input
                  type="color"
                  value={settings.reactBitsLiquidEtherColorTwo}
                  onChange={(event) => onSettingsChange({ reactBitsLiquidEtherColorTwo: event.target.value })}
                  aria-label="Liquid Ether second color"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Color 3</span>
                <input
                  type="color"
                  value={settings.reactBitsLiquidEtherColorThree}
                  onChange={(event) => onSettingsChange({ reactBitsLiquidEtherColorThree: event.target.value })}
                  aria-label="Liquid Ether third color"
                />
              </label>
            </>
          ) : (
            <>
              <label className={styles.colorRow}>
                <span>Primary color</span>
                <input
                  type="color"
                  value={settings.reactBitsLiquidEtherPrimaryColor}
                  onChange={(event) => onSettingsChange({ reactBitsLiquidEtherPrimaryColor: event.target.value })}
                  aria-label="Liquid Ether primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={settings.reactBitsLiquidEtherHarmony}
                  onChange={(event) => onSettingsChange({
                    reactBitsLiquidEtherHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="Liquid Ether color harmony"
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

          <label className={styles.switchRow}>
            <span>Cursor fluid push</span>
            <input
              type="checkbox"
              checked={settings.reactBitsLiquidEtherCursorEnabled}
              onChange={(event) => onSettingsChange({ reactBitsLiquidEtherCursorEnabled: event.target.checked })}
              aria-label="Liquid Ether cursor fluid push"
            />
          </label>

          {settings.reactBitsLiquidEtherCursorEnabled && (
            <>
              <label className={styles.rangeRow}>
                <span>Mouse force ({settings.reactBitsLiquidEtherMouseForce.toFixed(0)})</span>
                <input
                  type="range"
                  min="0"
                  max="80"
                  step="1"
                  value={settings.reactBitsLiquidEtherMouseForce}
                  onChange={(event) => onSettingsChange({
                    reactBitsLiquidEtherMouseForce: Number(event.target.value),
                  })}
                  aria-label="Liquid Ether mouse force"
                />
              </label>

              <label className={styles.rangeRow}>
                <span>Cursor size ({settings.reactBitsLiquidEtherCursorSize.toFixed(0)}px)</span>
                <input
                  type="range"
                  min="20"
                  max="280"
                  step="5"
                  value={settings.reactBitsLiquidEtherCursorSize}
                  onChange={(event) => onSettingsChange({
                    reactBitsLiquidEtherCursorSize: Number(event.target.value),
                  })}
                  aria-label="Liquid Ether cursor size"
                />
              </label>
            </>
          )}

          <label className={styles.switchRow}>
            <span>Auto demo motion</span>
            <input
              type="checkbox"
              checked={settings.reactBitsLiquidEtherAutoDemo}
              onChange={(event) => onSettingsChange({ reactBitsLiquidEtherAutoDemo: event.target.checked })}
              aria-label="Liquid Ether auto demo motion"
            />
          </label>

          {settings.reactBitsLiquidEtherAutoDemo && (
            <>
              <label className={styles.rangeRow}>
                <span>Auto speed ({settings.reactBitsLiquidEtherAutoSpeed.toFixed(2)}x)</span>
                <input
                  type="range"
                  min="0.05"
                  max="2"
                  step="0.05"
                  value={settings.reactBitsLiquidEtherAutoSpeed}
                  onChange={(event) => onSettingsChange({
                    reactBitsLiquidEtherAutoSpeed: Number(event.target.value),
                  })}
                  aria-label="Liquid Ether auto speed"
                />
              </label>

              <label className={styles.rangeRow}>
                <span>Auto intensity ({settings.reactBitsLiquidEtherAutoIntensity.toFixed(1)})</span>
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="0.1"
                  value={settings.reactBitsLiquidEtherAutoIntensity}
                  onChange={(event) => onSettingsChange({
                    reactBitsLiquidEtherAutoIntensity: Number(event.target.value),
                  })}
                  aria-label="Liquid Ether auto intensity"
                />
              </label>

              <label className={styles.rangeRow}>
                <span>Auto resume ({(settings.reactBitsLiquidEtherAutoResumeDelay / 1000).toFixed(1)}s)</span>
                <input
                  type="range"
                  min="250"
                  max="5000"
                  step="250"
                  value={settings.reactBitsLiquidEtherAutoResumeDelay}
                  onChange={(event) => onSettingsChange({
                    reactBitsLiquidEtherAutoResumeDelay: Number(event.target.value),
                  })}
                  aria-label="Liquid Ether auto resume delay"
                />
              </label>

              <label className={styles.rangeRow}>
                <span>Auto ramp ({settings.reactBitsLiquidEtherAutoRampDuration.toFixed(1)}s)</span>
                <input
                  type="range"
                  min="0"
                  max="3"
                  step="0.1"
                  value={settings.reactBitsLiquidEtherAutoRampDuration}
                  onChange={(event) => onSettingsChange({
                    reactBitsLiquidEtherAutoRampDuration: Number(event.target.value),
                  })}
                  aria-label="Liquid Ether auto ramp duration"
                />
              </label>
            </>
          )}

          <label className={styles.switchRow}>
            <span>Viscous fluid</span>
            <input
              type="checkbox"
              checked={settings.reactBitsLiquidEtherIsViscous}
              onChange={(event) => onSettingsChange({ reactBitsLiquidEtherIsViscous: event.target.checked })}
              aria-label="Liquid Ether viscous fluid"
            />
          </label>

          {settings.reactBitsLiquidEtherIsViscous && (
            <label className={styles.rangeRow}>
              <span>Viscosity ({settings.reactBitsLiquidEtherViscous.toFixed(0)})</span>
              <input
                type="range"
                min="0"
                max="80"
                step="1"
                value={settings.reactBitsLiquidEtherViscous}
                onChange={(event) => onSettingsChange({ reactBitsLiquidEtherViscous: Number(event.target.value) })}
                aria-label="Liquid Ether viscosity"
              />
            </label>
          )}

          <label className={styles.rangeRow}>
            <span>Viscous iterations ({settings.reactBitsLiquidEtherIterationsViscous.toFixed(0)})</span>
            <input
              type="range"
              min="4"
              max="64"
              step="1"
              value={settings.reactBitsLiquidEtherIterationsViscous}
              onChange={(event) => onSettingsChange({
                reactBitsLiquidEtherIterationsViscous: Number(event.target.value),
              })}
              aria-label="Liquid Ether viscous iterations"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Poisson iterations ({settings.reactBitsLiquidEtherIterationsPoisson.toFixed(0)})</span>
            <input
              type="range"
              min="4"
              max="64"
              step="1"
              value={settings.reactBitsLiquidEtherIterationsPoisson}
              onChange={(event) => onSettingsChange({
                reactBitsLiquidEtherIterationsPoisson: Number(event.target.value),
              })}
              aria-label="Liquid Ether Poisson iterations"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Delta time ({settings.reactBitsLiquidEtherDt.toFixed(3)})</span>
            <input
              type="range"
              min="0.004"
              max="0.04"
              step="0.001"
              value={settings.reactBitsLiquidEtherDt}
              onChange={(event) => onSettingsChange({ reactBitsLiquidEtherDt: Number(event.target.value) })}
              aria-label="Liquid Ether delta time"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Resolution ({settings.reactBitsLiquidEtherResolution.toFixed(2)})</span>
            <input
              type="range"
              min="0.2"
              max="1"
              step="0.05"
              value={settings.reactBitsLiquidEtherResolution}
              onChange={(event) => onSettingsChange({ reactBitsLiquidEtherResolution: Number(event.target.value) })}
              aria-label="Liquid Ether resolution"
            />
          </label>

          <label className={styles.switchRow}>
            <span>BFECC advection</span>
            <input
              type="checkbox"
              checked={settings.reactBitsLiquidEtherBfecc}
              onChange={(event) => onSettingsChange({ reactBitsLiquidEtherBfecc: event.target.checked })}
              aria-label="Liquid Ether BFECC advection"
            />
          </label>

          <label className={styles.switchRow}>
            <span>Bounce edges</span>
            <input
              type="checkbox"
              checked={settings.reactBitsLiquidEtherIsBounce}
              onChange={(event) => onSettingsChange({ reactBitsLiquidEtherIsBounce: event.target.checked })}
              aria-label="Liquid Ether bounce edges"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Opacity ({Math.round(settings.reactBitsLiquidEtherOpacity * 100)}%)</span>
            <input
              type="range"
              min="0.05"
              max="1"
              step="0.01"
              value={settings.reactBitsLiquidEtherOpacity}
              onChange={(event) => onSettingsChange({ reactBitsLiquidEtherOpacity: Number(event.target.value) })}
              aria-label="Liquid Ether opacity"
            />
          </label>
        </div>
      )
    }

    if (option.id === "react-bits-prism") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Rotation mode</span>
            <select
              value={settings.reactBitsPrismAnimationType}
              onChange={(event) => onSettingsChange({
                reactBitsPrismAnimationType: event.target.value as ReactBitsPrismAnimationType,
              })}
              aria-label="Prism rotation mode"
            >
              <option value="rotate">Source rotate</option>
              <option value="3drotate">3D rotate</option>
              <option value="hover">Hover cursor</option>
            </select>
          </label>

          <label className={styles.rangeRow}>
            <span>Height ({settings.reactBitsPrismHeight.toFixed(1)})</span>
            <input
              type="range"
              min="0.5"
              max="8"
              step="0.1"
              value={settings.reactBitsPrismHeight}
              onChange={(event) => onSettingsChange({ reactBitsPrismHeight: Number(event.target.value) })}
              aria-label="Prism height"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Base width ({settings.reactBitsPrismBaseWidth.toFixed(1)})</span>
            <input
              type="range"
              min="0.5"
              max="10"
              step="0.1"
              value={settings.reactBitsPrismBaseWidth}
              onChange={(event) => onSettingsChange({ reactBitsPrismBaseWidth: Number(event.target.value) })}
              aria-label="Prism base width"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Glow ({settings.reactBitsPrismGlow.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={settings.reactBitsPrismGlow}
              onChange={(event) => onSettingsChange({ reactBitsPrismGlow: Number(event.target.value) })}
              aria-label="Prism glow"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Bloom ({settings.reactBitsPrismBloom.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={settings.reactBitsPrismBloom}
              onChange={(event) => onSettingsChange({ reactBitsPrismBloom: Number(event.target.value) })}
              aria-label="Prism bloom"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Noise ({settings.reactBitsPrismNoise.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.02"
              value={settings.reactBitsPrismNoise}
              onChange={(event) => onSettingsChange({ reactBitsPrismNoise: Number(event.target.value) })}
              aria-label="Prism noise"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Scale ({settings.reactBitsPrismScale.toFixed(1)})</span>
            <input
              type="range"
              min="0.5"
              max="7"
              step="0.1"
              value={settings.reactBitsPrismScale}
              onChange={(event) => onSettingsChange({ reactBitsPrismScale: Number(event.target.value) })}
              aria-label="Prism scale"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Hue shift ({settings.reactBitsPrismHueShift.toFixed(2)})</span>
            <input
              type="range"
              min="-3.1416"
              max="3.1416"
              step="0.05"
              value={settings.reactBitsPrismHueShift}
              onChange={(event) => onSettingsChange({ reactBitsPrismHueShift: Number(event.target.value) })}
              aria-label="Prism hue shift"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Color frequency ({settings.reactBitsPrismColorFrequency.toFixed(2)})</span>
            <input
              type="range"
              min="0.1"
              max="3"
              step="0.05"
              value={settings.reactBitsPrismColorFrequency}
              onChange={(event) => onSettingsChange({ reactBitsPrismColorFrequency: Number(event.target.value) })}
              aria-label="Prism color frequency"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Time scale ({settings.reactBitsPrismTimeScale.toFixed(2)}x)</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.05"
              value={settings.reactBitsPrismTimeScale}
              onChange={(event) => onSettingsChange({ reactBitsPrismTimeScale: Number(event.target.value) })}
              aria-label="Prism time scale"
            />
          </label>

          {settings.reactBitsPrismAnimationType === "hover" && (
            <>
              <label className={styles.rangeRow}>
                <span>Hover strength ({settings.reactBitsPrismHoverStrength.toFixed(1)})</span>
                <input
                  type="range"
                  min="0"
                  max="4"
                  step="0.1"
                  value={settings.reactBitsPrismHoverStrength}
                  onChange={(event) => onSettingsChange({ reactBitsPrismHoverStrength: Number(event.target.value) })}
                  aria-label="Prism hover strength"
                />
              </label>

              <label className={styles.rangeRow}>
                <span>Hover inertia ({settings.reactBitsPrismInertia.toFixed(2)})</span>
                <input
                  type="range"
                  min="0.01"
                  max="0.4"
                  step="0.01"
                  value={settings.reactBitsPrismInertia}
                  onChange={(event) => onSettingsChange({ reactBitsPrismInertia: Number(event.target.value) })}
                  aria-label="Prism hover inertia"
                />
              </label>
            </>
          )}

          <label className={styles.rangeRow}>
            <span>Offset X ({settings.reactBitsPrismOffsetX.toFixed(0)}px)</span>
            <input
              type="range"
              min="-400"
              max="400"
              step="10"
              value={settings.reactBitsPrismOffsetX}
              onChange={(event) => onSettingsChange({ reactBitsPrismOffsetX: Number(event.target.value) })}
              aria-label="Prism horizontal offset"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Offset Y ({settings.reactBitsPrismOffsetY.toFixed(0)}px)</span>
            <input
              type="range"
              min="-400"
              max="400"
              step="10"
              value={settings.reactBitsPrismOffsetY}
              onChange={(event) => onSettingsChange({ reactBitsPrismOffsetY: Number(event.target.value) })}
              aria-label="Prism vertical offset"
            />
          </label>

          <label className={styles.switchRow}>
            <span>Transparent blend</span>
            <input
              type="checkbox"
              checked={settings.reactBitsPrismTransparent}
              onChange={(event) => onSettingsChange({ reactBitsPrismTransparent: event.target.checked })}
              aria-label="Prism transparent blend"
            />
          </label>
        </div>
      )
    }

    if (option.id === "react-bits-dark-veil") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.rangeRow}>
            <span>Hue shift ({settings.reactBitsDarkVeilHueShift.toFixed(0)} deg)</span>
            <input
              type="range"
              min="-180"
              max="180"
              step="1"
              value={settings.reactBitsDarkVeilHueShift}
              onChange={(event) => onSettingsChange({ reactBitsDarkVeilHueShift: Number(event.target.value) })}
              aria-label="Dark Veil hue shift"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Animation speed ({settings.reactBitsDarkVeilSpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.05"
              value={settings.reactBitsDarkVeilSpeed}
              onChange={(event) => onSettingsChange({ reactBitsDarkVeilSpeed: Number(event.target.value) })}
              aria-label="Dark Veil animation speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Noise ({settings.reactBitsDarkVeilNoiseIntensity.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.reactBitsDarkVeilNoiseIntensity}
              onChange={(event) => onSettingsChange({ reactBitsDarkVeilNoiseIntensity: Number(event.target.value) })}
              aria-label="Dark Veil noise intensity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Scanline intensity ({settings.reactBitsDarkVeilScanlineIntensity.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.reactBitsDarkVeilScanlineIntensity}
              onChange={(event) => onSettingsChange({
                reactBitsDarkVeilScanlineIntensity: Number(event.target.value),
              })}
              aria-label="Dark Veil scanline intensity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Scanline frequency ({settings.reactBitsDarkVeilScanlineFrequency.toFixed(1)})</span>
            <input
              type="range"
              min="0"
              max="40"
              step="0.5"
              value={settings.reactBitsDarkVeilScanlineFrequency}
              onChange={(event) => onSettingsChange({
                reactBitsDarkVeilScanlineFrequency: Number(event.target.value),
              })}
              aria-label="Dark Veil scanline frequency"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Warp ({settings.reactBitsDarkVeilWarpAmount.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.01"
              value={settings.reactBitsDarkVeilWarpAmount}
              onChange={(event) => onSettingsChange({ reactBitsDarkVeilWarpAmount: Number(event.target.value) })}
              aria-label="Dark Veil warp amount"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Resolution scale ({settings.reactBitsDarkVeilResolutionScale.toFixed(2)})</span>
            <input
              type="range"
              min="0.25"
              max="1"
              step="0.05"
              value={settings.reactBitsDarkVeilResolutionScale}
              onChange={(event) => onSettingsChange({ reactBitsDarkVeilResolutionScale: Number(event.target.value) })}
              aria-label="Dark Veil resolution scale"
            />
          </label>
        </div>
      )
    }

    if (option.id === "react-bits-light-pillar") {
      const useCustomPalette = settings.reactBitsLightPillarPaletteMode === "custom"

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.reactBitsLightPillarPaletteMode}
              onChange={(event) => onSettingsChange({
                reactBitsLightPillarPaletteMode: event.target.value as ReactBitsLightPillarPaletteMode,
              })}
              aria-label="Light Pillar color mode"
            >
              <option value="custom">Custom colors</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {useCustomPalette ? (
            <>
              <label className={styles.colorRow}>
                <span>Top color</span>
                <input
                  type="color"
                  value={settings.reactBitsLightPillarTopColor}
                  onChange={(event) => onSettingsChange({ reactBitsLightPillarTopColor: event.target.value })}
                  aria-label="Light Pillar top color"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Bottom color</span>
                <input
                  type="color"
                  value={settings.reactBitsLightPillarBottomColor}
                  onChange={(event) => onSettingsChange({ reactBitsLightPillarBottomColor: event.target.value })}
                  aria-label="Light Pillar bottom color"
                />
              </label>
            </>
          ) : (
            <>
              <label className={styles.colorRow}>
                <span>Primary color</span>
                <input
                  type="color"
                  value={settings.reactBitsLightPillarPrimaryColor}
                  onChange={(event) => onSettingsChange({ reactBitsLightPillarPrimaryColor: event.target.value })}
                  aria-label="Light Pillar primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={settings.reactBitsLightPillarHarmony}
                  onChange={(event) => onSettingsChange({
                    reactBitsLightPillarHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="Light Pillar color harmony"
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

          <label className={styles.selectRow}>
            <span>Quality</span>
            <select
              value={settings.reactBitsLightPillarQuality}
              onChange={(event) => onSettingsChange({
                reactBitsLightPillarQuality: event.target.value as ReactBitsLightPillarQuality,
              })}
              aria-label="Light Pillar quality"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>

          <label className={styles.selectRow}>
            <span>Blend mode</span>
            <select
              value={settings.reactBitsLightPillarBlendMode}
              onChange={(event) => onSettingsChange({
                reactBitsLightPillarBlendMode: event.target.value as ReactBitsLightPillarBlendMode,
              })}
              aria-label="Light Pillar blend mode"
            >
              <option value="screen">Screen</option>
              <option value="normal">Normal</option>
              <option value="lighten">Lighten</option>
              <option value="plus-lighter">Plus lighter</option>
            </select>
          </label>

          <label className={styles.rangeRow}>
            <span>Intensity ({settings.reactBitsLightPillarIntensity.toFixed(2)})</span>
            <input
              type="range"
              min="0.1"
              max="3"
              step="0.05"
              value={settings.reactBitsLightPillarIntensity}
              onChange={(event) => onSettingsChange({ reactBitsLightPillarIntensity: Number(event.target.value) })}
              aria-label="Light Pillar intensity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Rotation speed ({settings.reactBitsLightPillarRotationSpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.05"
              value={settings.reactBitsLightPillarRotationSpeed}
              onChange={(event) => onSettingsChange({ reactBitsLightPillarRotationSpeed: Number(event.target.value) })}
              aria-label="Light Pillar rotation speed"
            />
          </label>

          <label className={styles.switchRow}>
            <span>Cursor rotation</span>
            <input
              type="checkbox"
              checked={settings.reactBitsLightPillarInteractive}
              onChange={(event) => onSettingsChange({ reactBitsLightPillarInteractive: event.target.checked })}
              aria-label="Light Pillar cursor rotation"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Glow amount ({settings.reactBitsLightPillarGlowAmount.toFixed(3)})</span>
            <input
              type="range"
              min="0.001"
              max="0.03"
              step="0.001"
              value={settings.reactBitsLightPillarGlowAmount}
              onChange={(event) => onSettingsChange({ reactBitsLightPillarGlowAmount: Number(event.target.value) })}
              aria-label="Light Pillar glow amount"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Pillar width ({settings.reactBitsLightPillarWidth.toFixed(1)})</span>
            <input
              type="range"
              min="0.5"
              max="8"
              step="0.1"
              value={settings.reactBitsLightPillarWidth}
              onChange={(event) => onSettingsChange({ reactBitsLightPillarWidth: Number(event.target.value) })}
              aria-label="Light Pillar width"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Pillar height ({settings.reactBitsLightPillarHeight.toFixed(2)})</span>
            <input
              type="range"
              min="0.1"
              max="2"
              step="0.05"
              value={settings.reactBitsLightPillarHeight}
              onChange={(event) => onSettingsChange({ reactBitsLightPillarHeight: Number(event.target.value) })}
              aria-label="Light Pillar height"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Noise ({settings.reactBitsLightPillarNoiseIntensity.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.reactBitsLightPillarNoiseIntensity}
              onChange={(event) => onSettingsChange({ reactBitsLightPillarNoiseIntensity: Number(event.target.value) })}
              aria-label="Light Pillar noise intensity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Pillar rotation ({settings.reactBitsLightPillarRotation.toFixed(0)} deg)</span>
            <input
              type="range"
              min="-180"
              max="180"
              step="1"
              value={settings.reactBitsLightPillarRotation}
              onChange={(event) => onSettingsChange({ reactBitsLightPillarRotation: Number(event.target.value) })}
              aria-label="Light Pillar rotation"
            />
          </label>
        </div>
      )
    }

    if (option.id === "react-bits-silk") {
      const useCustomColor = settings.reactBitsSilkPaletteMode === "custom"

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.reactBitsSilkPaletteMode}
              onChange={(event) => onSettingsChange({
                reactBitsSilkPaletteMode: event.target.value as ReactBitsSilkPaletteMode,
              })}
              aria-label="Silk color mode"
            >
              <option value="custom">Custom color</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {useCustomColor ? (
            <label className={styles.colorRow}>
              <span>Silk color</span>
              <input
                type="color"
                value={settings.reactBitsSilkColor}
                onChange={(event) => onSettingsChange({ reactBitsSilkColor: event.target.value })}
                aria-label="Silk color"
              />
            </label>
          ) : (
            <>
              <label className={styles.colorRow}>
                <span>Primary color</span>
                <input
                  type="color"
                  value={settings.reactBitsSilkPrimaryColor}
                  onChange={(event) => onSettingsChange({ reactBitsSilkPrimaryColor: event.target.value })}
                  aria-label="Silk primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={settings.reactBitsSilkHarmony}
                  onChange={(event) => onSettingsChange({
                    reactBitsSilkHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="Silk color harmony"
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
            <span>Speed ({settings.reactBitsSilkSpeed.toFixed(1)}x)</span>
            <input
              type="range"
              min="0"
              max="10"
              step="0.1"
              value={settings.reactBitsSilkSpeed}
              onChange={(event) => onSettingsChange({ reactBitsSilkSpeed: Number(event.target.value) })}
              aria-label="Silk speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Scale ({settings.reactBitsSilkScale.toFixed(2)})</span>
            <input
              type="range"
              min="0.2"
              max="4"
              step="0.05"
              value={settings.reactBitsSilkScale}
              onChange={(event) => onSettingsChange({ reactBitsSilkScale: Number(event.target.value) })}
              aria-label="Silk scale"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Noise ({settings.reactBitsSilkNoiseIntensity.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="4"
              step="0.05"
              value={settings.reactBitsSilkNoiseIntensity}
              onChange={(event) => onSettingsChange({ reactBitsSilkNoiseIntensity: Number(event.target.value) })}
              aria-label="Silk noise intensity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Rotation ({settings.reactBitsSilkRotation.toFixed(2)} rad)</span>
            <input
              type="range"
              min="-3.1416"
              max="3.1416"
              step="0.05"
              value={settings.reactBitsSilkRotation}
              onChange={(event) => onSettingsChange({ reactBitsSilkRotation: Number(event.target.value) })}
              aria-label="Silk rotation"
            />
          </label>
        </div>
      )
    }

    if (option.id === "react-bits-floating-lines") {
      const useCustomGradient = settings.reactBitsFloatingLinesPaletteMode === "custom"
      const useHarmonyGradient = settings.reactBitsFloatingLinesPaletteMode === "harmony"

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.reactBitsFloatingLinesPaletteMode}
              onChange={(event) => onSettingsChange({
                reactBitsFloatingLinesPaletteMode: event.target.value as ReactBitsFloatingLinesPaletteMode,
              })}
              aria-label="Floating Lines color mode"
            >
              <option value="source">Source blue/pink</option>
              <option value="custom">Custom gradient</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {useCustomGradient && (
            <>
              <label className={styles.colorRow}>
                <span>Gradient 1</span>
                <input
                  type="color"
                  value={settings.reactBitsFloatingLinesColorOne}
                  onChange={(event) => onSettingsChange({ reactBitsFloatingLinesColorOne: event.target.value })}
                  aria-label="Floating Lines gradient color 1"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Gradient 2</span>
                <input
                  type="color"
                  value={settings.reactBitsFloatingLinesColorTwo}
                  onChange={(event) => onSettingsChange({ reactBitsFloatingLinesColorTwo: event.target.value })}
                  aria-label="Floating Lines gradient color 2"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Gradient 3</span>
                <input
                  type="color"
                  value={settings.reactBitsFloatingLinesColorThree}
                  onChange={(event) => onSettingsChange({ reactBitsFloatingLinesColorThree: event.target.value })}
                  aria-label="Floating Lines gradient color 3"
                />
              </label>
            </>
          )}

          {useHarmonyGradient && (
            <>
              <label className={styles.colorRow}>
                <span>Primary color</span>
                <input
                  type="color"
                  value={settings.reactBitsFloatingLinesPrimaryColor}
                  onChange={(event) => onSettingsChange({ reactBitsFloatingLinesPrimaryColor: event.target.value })}
                  aria-label="Floating Lines primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={settings.reactBitsFloatingLinesHarmony}
                  onChange={(event) => onSettingsChange({
                    reactBitsFloatingLinesHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="Floating Lines color harmony"
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

          <label className={styles.selectRow}>
            <span>Blend mode</span>
            <select
              value={settings.reactBitsFloatingLinesBlendMode}
              onChange={(event) => onSettingsChange({
                reactBitsFloatingLinesBlendMode: event.target.value as ReactBitsFloatingLinesBlendMode,
              })}
              aria-label="Floating Lines blend mode"
            >
              <option value="screen">Screen</option>
              <option value="normal">Normal</option>
              <option value="lighten">Lighten</option>
              <option value="plus-lighter">Plus lighter</option>
            </select>
          </label>

          <label className={styles.rangeRow}>
            <span>Animation speed ({settings.reactBitsFloatingLinesAnimationSpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0"
              max="4"
              step="0.05"
              value={settings.reactBitsFloatingLinesAnimationSpeed}
              onChange={(event) => onSettingsChange({
                reactBitsFloatingLinesAnimationSpeed: Number(event.target.value),
              })}
              aria-label="Floating Lines animation speed"
            />
          </label>

          {(["Top", "Middle", "Bottom"] as const).map((waveName) => {
            const key = waveName.toLowerCase() as "top" | "middle" | "bottom"
            const enabledKey = `reactBitsFloatingLinesEnable${waveName}` as const
            const countKey = `reactBitsFloatingLines${waveName}LineCount` as const
            const distanceKey = `reactBitsFloatingLines${waveName}LineDistance` as const
            const waveXKey = `reactBitsFloatingLines${waveName}WaveX` as const
            const waveYKey = `reactBitsFloatingLines${waveName}WaveY` as const
            const rotateKey = `reactBitsFloatingLines${waveName}WaveRotate` as const

            return (
              <div key={key}>
                <label className={styles.switchRow}>
                  <span>{waveName} wave</span>
                  <input
                    type="checkbox"
                    checked={settings[enabledKey]}
                    onChange={(event) => onSettingsChange({ [enabledKey]: event.target.checked })}
                    aria-label={`Floating Lines ${key} wave`}
                  />
                </label>
                <label className={styles.rangeRow}>
                  <span>{waveName} count ({settings[countKey]})</span>
                  <input
                    type="range"
                    min="0"
                    max="32"
                    step="1"
                    value={settings[countKey]}
                    onChange={(event) => onSettingsChange({ [countKey]: Number(event.target.value) })}
                    aria-label={`Floating Lines ${key} line count`}
                  />
                </label>
                <label className={styles.rangeRow}>
                  <span>{waveName} spacing ({settings[distanceKey].toFixed(1)})</span>
                  <input
                    type="range"
                    min="0.1"
                    max="20"
                    step="0.1"
                    value={settings[distanceKey]}
                    onChange={(event) => onSettingsChange({ [distanceKey]: Number(event.target.value) })}
                    aria-label={`Floating Lines ${key} line spacing`}
                  />
                </label>
                <label className={styles.rangeRow}>
                  <span>{waveName} X ({settings[waveXKey].toFixed(1)})</span>
                  <input
                    type="range"
                    min="-20"
                    max="20"
                    step="0.1"
                    value={settings[waveXKey]}
                    onChange={(event) => onSettingsChange({ [waveXKey]: Number(event.target.value) })}
                    aria-label={`Floating Lines ${key} wave X`}
                  />
                </label>
                <label className={styles.rangeRow}>
                  <span>{waveName} Y ({settings[waveYKey].toFixed(1)})</span>
                  <input
                    type="range"
                    min="-4"
                    max="4"
                    step="0.1"
                    value={settings[waveYKey]}
                    onChange={(event) => onSettingsChange({ [waveYKey]: Number(event.target.value) })}
                    aria-label={`Floating Lines ${key} wave Y`}
                  />
                </label>
                <label className={styles.rangeRow}>
                  <span>{waveName} rotation ({settings[rotateKey].toFixed(2)})</span>
                  <input
                    type="range"
                    min="-4"
                    max="4"
                    step="0.05"
                    value={settings[rotateKey]}
                    onChange={(event) => onSettingsChange({ [rotateKey]: Number(event.target.value) })}
                    aria-label={`Floating Lines ${key} wave rotation`}
                  />
                </label>
              </div>
            )
          })}

          <label className={styles.switchRow}>
            <span>Cursor bend</span>
            <input
              type="checkbox"
              checked={settings.reactBitsFloatingLinesInteractive}
              onChange={(event) => onSettingsChange({ reactBitsFloatingLinesInteractive: event.target.checked })}
              aria-label="Floating Lines cursor bend"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Bend radius ({settings.reactBitsFloatingLinesBendRadius.toFixed(1)})</span>
            <input
              type="range"
              min="0.1"
              max="20"
              step="0.1"
              value={settings.reactBitsFloatingLinesBendRadius}
              onChange={(event) => onSettingsChange({ reactBitsFloatingLinesBendRadius: Number(event.target.value) })}
              aria-label="Floating Lines bend radius"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Bend strength ({settings.reactBitsFloatingLinesBendStrength.toFixed(2)})</span>
            <input
              type="range"
              min="-2"
              max="2"
              step="0.05"
              value={settings.reactBitsFloatingLinesBendStrength}
              onChange={(event) => onSettingsChange({
                reactBitsFloatingLinesBendStrength: Number(event.target.value),
              })}
              aria-label="Floating Lines bend strength"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Mouse damping ({settings.reactBitsFloatingLinesMouseDamping.toFixed(2)})</span>
            <input
              type="range"
              min="0.01"
              max="1"
              step="0.01"
              value={settings.reactBitsFloatingLinesMouseDamping}
              onChange={(event) => onSettingsChange({
                reactBitsFloatingLinesMouseDamping: Number(event.target.value),
              })}
              aria-label="Floating Lines mouse damping"
            />
          </label>

          <label className={styles.switchRow}>
            <span>Parallax</span>
            <input
              type="checkbox"
              checked={settings.reactBitsFloatingLinesParallax}
              onChange={(event) => onSettingsChange({ reactBitsFloatingLinesParallax: event.target.checked })}
              aria-label="Floating Lines parallax"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Parallax strength ({settings.reactBitsFloatingLinesParallaxStrength.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.reactBitsFloatingLinesParallaxStrength}
              onChange={(event) => onSettingsChange({
                reactBitsFloatingLinesParallaxStrength: Number(event.target.value),
              })}
              aria-label="Floating Lines parallax strength"
            />
          </label>
        </div>
      )
    }

    if (option.id === "react-bits-side-rays") {
      const useCustomRays = settings.reactBitsSideRaysPaletteMode === "custom"
      const useHarmonyRays = settings.reactBitsSideRaysPaletteMode === "harmony"

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.reactBitsSideRaysPaletteMode}
              onChange={(event) => onSettingsChange({
                reactBitsSideRaysPaletteMode: event.target.value as ReactBitsSideRaysPaletteMode,
              })}
              aria-label="Side Rays color mode"
            >
              <option value="source">Source yellow/blue</option>
              <option value="custom">Custom rays</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {useCustomRays && (
            <>
              <label className={styles.colorRow}>
                <span>Ray color 1</span>
                <input
                  type="color"
                  value={settings.reactBitsSideRaysColorOne}
                  onChange={(event) => onSettingsChange({ reactBitsSideRaysColorOne: event.target.value })}
                  aria-label="Side Rays color 1"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Ray color 2</span>
                <input
                  type="color"
                  value={settings.reactBitsSideRaysColorTwo}
                  onChange={(event) => onSettingsChange({ reactBitsSideRaysColorTwo: event.target.value })}
                  aria-label="Side Rays color 2"
                />
              </label>
            </>
          )}

          {useHarmonyRays && (
            <>
              <label className={styles.colorRow}>
                <span>Primary color</span>
                <input
                  type="color"
                  value={settings.reactBitsSideRaysPrimaryColor}
                  onChange={(event) => onSettingsChange({ reactBitsSideRaysPrimaryColor: event.target.value })}
                  aria-label="Side Rays primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={settings.reactBitsSideRaysHarmony}
                  onChange={(event) => onSettingsChange({
                    reactBitsSideRaysHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="Side Rays color harmony"
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

          <label className={styles.selectRow}>
            <span>Origin</span>
            <select
              value={settings.reactBitsSideRaysOrigin}
              onChange={(event) => onSettingsChange({
                reactBitsSideRaysOrigin: event.target.value as ReactBitsSideRaysOrigin,
              })}
              aria-label="Side Rays origin"
            >
              <option value="top-right">Top right</option>
              <option value="top-left">Top left</option>
              <option value="bottom-right">Bottom right</option>
              <option value="bottom-left">Bottom left</option>
            </select>
          </label>

          <label className={styles.rangeRow}>
            <span>Speed ({settings.reactBitsSideRaysSpeed.toFixed(1)}x)</span>
            <input
              type="range"
              min="0"
              max="8"
              step="0.1"
              value={settings.reactBitsSideRaysSpeed}
              onChange={(event) => onSettingsChange({ reactBitsSideRaysSpeed: Number(event.target.value) })}
              aria-label="Side Rays speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Intensity ({settings.reactBitsSideRaysIntensity.toFixed(1)})</span>
            <input
              type="range"
              min="0"
              max="6"
              step="0.1"
              value={settings.reactBitsSideRaysIntensity}
              onChange={(event) => onSettingsChange({ reactBitsSideRaysIntensity: Number(event.target.value) })}
              aria-label="Side Rays intensity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Spread ({settings.reactBitsSideRaysSpread.toFixed(1)})</span>
            <input
              type="range"
              min="0.1"
              max="5"
              step="0.1"
              value={settings.reactBitsSideRaysSpread}
              onChange={(event) => onSettingsChange({ reactBitsSideRaysSpread: Number(event.target.value) })}
              aria-label="Side Rays spread"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Tilt ({settings.reactBitsSideRaysTilt.toFixed(0)} deg)</span>
            <input
              type="range"
              min="-90"
              max="90"
              step="1"
              value={settings.reactBitsSideRaysTilt}
              onChange={(event) => onSettingsChange({ reactBitsSideRaysTilt: Number(event.target.value) })}
              aria-label="Side Rays tilt"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Saturation ({settings.reactBitsSideRaysSaturation.toFixed(1)})</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.1"
              value={settings.reactBitsSideRaysSaturation}
              onChange={(event) => onSettingsChange({ reactBitsSideRaysSaturation: Number(event.target.value) })}
              aria-label="Side Rays saturation"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Blend ({settings.reactBitsSideRaysBlend.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.reactBitsSideRaysBlend}
              onChange={(event) => onSettingsChange({ reactBitsSideRaysBlend: Number(event.target.value) })}
              aria-label="Side Rays blend"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Falloff ({settings.reactBitsSideRaysFalloff.toFixed(1)})</span>
            <input
              type="range"
              min="0.2"
              max="4"
              step="0.1"
              value={settings.reactBitsSideRaysFalloff}
              onChange={(event) => onSettingsChange({ reactBitsSideRaysFalloff: Number(event.target.value) })}
              aria-label="Side Rays falloff"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Opacity ({Math.round(settings.reactBitsSideRaysOpacity * 100)}%)</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.reactBitsSideRaysOpacity}
              onChange={(event) => onSettingsChange({ reactBitsSideRaysOpacity: Number(event.target.value) })}
              aria-label="Side Rays opacity"
            />
          </label>
        </div>
      )
    }

    if (option.id === "react-bits-light-rays") {
      const useCustomRayColor = settings.reactBitsLightRaysPaletteMode === "custom"
      const useHarmonyRayColor = settings.reactBitsLightRaysPaletteMode === "harmony"

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.reactBitsLightRaysPaletteMode}
              onChange={(event) => onSettingsChange({
                reactBitsLightRaysPaletteMode: event.target.value as ReactBitsLightRaysPaletteMode,
              })}
              aria-label="React Bits Light Rays color mode"
            >
              <option value="source">Source white</option>
              <option value="custom">Custom ray</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {useCustomRayColor && (
            <label className={styles.colorRow}>
              <span>Ray color</span>
              <input
                type="color"
                value={settings.reactBitsLightRaysColor}
                onChange={(event) => onSettingsChange({ reactBitsLightRaysColor: event.target.value })}
                aria-label="React Bits Light Rays color"
              />
            </label>
          )}

          {useHarmonyRayColor && (
            <>
              <label className={styles.colorRow}>
                <span>Primary color</span>
                <input
                  type="color"
                  value={settings.reactBitsLightRaysPrimaryColor}
                  onChange={(event) => onSettingsChange({ reactBitsLightRaysPrimaryColor: event.target.value })}
                  aria-label="React Bits Light Rays primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={settings.reactBitsLightRaysHarmony}
                  onChange={(event) => onSettingsChange({
                    reactBitsLightRaysHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="React Bits Light Rays color harmony"
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

          <label className={styles.selectRow}>
            <span>Origin</span>
            <select
              value={settings.reactBitsLightRaysOrigin}
              onChange={(event) => onSettingsChange({
                reactBitsLightRaysOrigin: event.target.value as ReactBitsLightRaysOrigin,
              })}
              aria-label="React Bits Light Rays origin"
            >
              <option value="top-left">Top left</option>
              <option value="top-center">Top center</option>
              <option value="top-right">Top right</option>
              <option value="left">Left</option>
              <option value="right">Right</option>
              <option value="bottom-left">Bottom left</option>
              <option value="bottom-center">Bottom center</option>
              <option value="bottom-right">Bottom right</option>
            </select>
          </label>

          <label className={styles.selectRow}>
            <input
              type="checkbox"
              checked={settings.reactBitsLightRaysPulsating}
              onChange={(event) => onSettingsChange({ reactBitsLightRaysPulsating: event.target.checked })}
              aria-label="React Bits Light Rays pulsating"
            />
            <span>Pulsating rays</span>
          </label>

          <label className={styles.selectRow}>
            <input
              type="checkbox"
              checked={settings.reactBitsLightRaysFollowMouse}
              onChange={(event) => onSettingsChange({ reactBitsLightRaysFollowMouse: event.target.checked })}
              aria-label="React Bits Light Rays follow mouse"
            />
            <span>Follow cursor</span>
          </label>

          <label className={styles.rangeRow}>
            <span>Speed ({settings.reactBitsLightRaysSpeed.toFixed(1)}x)</span>
            <input
              type="range"
              min="0"
              max="4"
              step="0.1"
              value={settings.reactBitsLightRaysSpeed}
              onChange={(event) => onSettingsChange({ reactBitsLightRaysSpeed: Number(event.target.value) })}
              aria-label="React Bits Light Rays speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Spread ({settings.reactBitsLightRaysSpread.toFixed(1)})</span>
            <input
              type="range"
              min="0.1"
              max="4"
              step="0.1"
              value={settings.reactBitsLightRaysSpread}
              onChange={(event) => onSettingsChange({ reactBitsLightRaysSpread: Number(event.target.value) })}
              aria-label="React Bits Light Rays spread"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Length ({settings.reactBitsLightRaysLength.toFixed(1)})</span>
            <input
              type="range"
              min="0.25"
              max="5"
              step="0.05"
              value={settings.reactBitsLightRaysLength}
              onChange={(event) => onSettingsChange({ reactBitsLightRaysLength: Number(event.target.value) })}
              aria-label="React Bits Light Rays length"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Fade distance ({settings.reactBitsLightRaysFadeDistance.toFixed(1)})</span>
            <input
              type="range"
              min="0.1"
              max="3"
              step="0.1"
              value={settings.reactBitsLightRaysFadeDistance}
              onChange={(event) => onSettingsChange({ reactBitsLightRaysFadeDistance: Number(event.target.value) })}
              aria-label="React Bits Light Rays fade distance"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Saturation ({settings.reactBitsLightRaysSaturation.toFixed(1)})</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.1"
              value={settings.reactBitsLightRaysSaturation}
              onChange={(event) => onSettingsChange({ reactBitsLightRaysSaturation: Number(event.target.value) })}
              aria-label="React Bits Light Rays saturation"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Mouse influence ({settings.reactBitsLightRaysMouseInfluence.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.reactBitsLightRaysMouseInfluence}
              onChange={(event) => onSettingsChange({ reactBitsLightRaysMouseInfluence: Number(event.target.value) })}
              aria-label="React Bits Light Rays mouse influence"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Noise ({settings.reactBitsLightRaysNoiseAmount.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.reactBitsLightRaysNoiseAmount}
              onChange={(event) => onSettingsChange({ reactBitsLightRaysNoiseAmount: Number(event.target.value) })}
              aria-label="React Bits Light Rays noise amount"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Distortion ({settings.reactBitsLightRaysDistortion.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.01"
              value={settings.reactBitsLightRaysDistortion}
              onChange={(event) => onSettingsChange({ reactBitsLightRaysDistortion: Number(event.target.value) })}
              aria-label="React Bits Light Rays distortion"
            />
          </label>
        </div>
      )
    }

    if (option.id === "react-bits-pixel-blast") {
      const useCustomPixelColor = settings.reactBitsPixelBlastPaletteMode === "custom"
      const useHarmonyPixelColor = settings.reactBitsPixelBlastPaletteMode === "harmony"

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.reactBitsPixelBlastPaletteMode}
              onChange={(event) => onSettingsChange({
                reactBitsPixelBlastPaletteMode: event.target.value as ReactBitsPixelBlastPaletteMode,
              })}
              aria-label="React Bits Pixel Blast color mode"
            >
              <option value="source">Source lavender</option>
              <option value="custom">Custom pixel</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {useCustomPixelColor && (
            <label className={styles.colorRow}>
              <span>Pixel color</span>
              <input
                type="color"
                value={settings.reactBitsPixelBlastColor}
                onChange={(event) => onSettingsChange({ reactBitsPixelBlastColor: event.target.value })}
                aria-label="React Bits Pixel Blast color"
              />
            </label>
          )}

          {useHarmonyPixelColor && (
            <>
              <label className={styles.colorRow}>
                <span>Primary color</span>
                <input
                  type="color"
                  value={settings.reactBitsPixelBlastPrimaryColor}
                  onChange={(event) => onSettingsChange({ reactBitsPixelBlastPrimaryColor: event.target.value })}
                  aria-label="React Bits Pixel Blast primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={settings.reactBitsPixelBlastHarmony}
                  onChange={(event) => onSettingsChange({
                    reactBitsPixelBlastHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="React Bits Pixel Blast color harmony"
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

          <label className={styles.selectRow}>
            <span>Shape</span>
            <select
              value={settings.reactBitsPixelBlastVariant}
              onChange={(event) => onSettingsChange({
                reactBitsPixelBlastVariant: event.target.value as ReactBitsPixelBlastVariant,
              })}
              aria-label="React Bits Pixel Blast shape"
            >
              <option value="square">Square</option>
              <option value="circle">Circle</option>
              <option value="triangle">Triangle</option>
              <option value="diamond">Diamond</option>
            </select>
          </label>

          <label className={styles.selectRow}>
            <input
              type="checkbox"
              checked={settings.reactBitsPixelBlastAntialias}
              onChange={(event) => onSettingsChange({ reactBitsPixelBlastAntialias: event.target.checked })}
              aria-label="React Bits Pixel Blast antialias"
            />
            <span>Antialias edges</span>
          </label>

          <label className={styles.selectRow}>
            <input
              type="checkbox"
              checked={settings.reactBitsPixelBlastEnableRipples}
              onChange={(event) => onSettingsChange({ reactBitsPixelBlastEnableRipples: event.target.checked })}
              aria-label="React Bits Pixel Blast ripple clicks"
            />
            <span>Ripple clicks</span>
          </label>

          <label className={styles.selectRow}>
            <input
              type="checkbox"
              checked={settings.reactBitsPixelBlastLiquid}
              onChange={(event) => onSettingsChange({ reactBitsPixelBlastLiquid: event.target.checked })}
              aria-label="React Bits Pixel Blast liquid pointer warp"
            />
            <span>Liquid pointer warp</span>
          </label>

          <label className={styles.selectRow}>
            <input
              type="checkbox"
              checked={settings.reactBitsPixelBlastTransparent}
              onChange={(event) => onSettingsChange({ reactBitsPixelBlastTransparent: event.target.checked })}
              aria-label="React Bits Pixel Blast transparent background"
            />
            <span>Transparent background</span>
          </label>

          <label className={styles.selectRow}>
            <input
              type="checkbox"
              checked={settings.reactBitsPixelBlastAutoPauseOffscreen}
              onChange={(event) => onSettingsChange({ reactBitsPixelBlastAutoPauseOffscreen: event.target.checked })}
              aria-label="React Bits Pixel Blast pause offscreen"
            />
            <span>Pause offscreen</span>
          </label>

          <label className={styles.rangeRow}>
            <span>Pixel size ({settings.reactBitsPixelBlastPixelSize.toFixed(0)})</span>
            <input
              type="range"
              min="1"
              max="16"
              step="1"
              value={settings.reactBitsPixelBlastPixelSize}
              onChange={(event) => onSettingsChange({ reactBitsPixelBlastPixelSize: Number(event.target.value) })}
              aria-label="React Bits Pixel Blast pixel size"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Pattern scale ({settings.reactBitsPixelBlastPatternScale.toFixed(2)})</span>
            <input
              type="range"
              min="0.25"
              max="8"
              step="0.05"
              value={settings.reactBitsPixelBlastPatternScale}
              onChange={(event) => onSettingsChange({ reactBitsPixelBlastPatternScale: Number(event.target.value) })}
              aria-label="React Bits Pixel Blast pattern scale"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Density ({settings.reactBitsPixelBlastPatternDensity.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.05"
              value={settings.reactBitsPixelBlastPatternDensity}
              onChange={(event) => onSettingsChange({ reactBitsPixelBlastPatternDensity: Number(event.target.value) })}
              aria-label="React Bits Pixel Blast pattern density"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Speed ({settings.reactBitsPixelBlastSpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={settings.reactBitsPixelBlastSpeed}
              onChange={(event) => onSettingsChange({ reactBitsPixelBlastSpeed: Number(event.target.value) })}
              aria-label="React Bits Pixel Blast speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Pixel jitter ({settings.reactBitsPixelBlastPixelSizeJitter.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.reactBitsPixelBlastPixelSizeJitter}
              onChange={(event) => onSettingsChange({ reactBitsPixelBlastPixelSizeJitter: Number(event.target.value) })}
              aria-label="React Bits Pixel Blast pixel jitter"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Edge fade ({settings.reactBitsPixelBlastEdgeFade.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.reactBitsPixelBlastEdgeFade}
              onChange={(event) => onSettingsChange({ reactBitsPixelBlastEdgeFade: Number(event.target.value) })}
              aria-label="React Bits Pixel Blast edge fade"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Ripple intensity ({settings.reactBitsPixelBlastRippleIntensityScale.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="4"
              step="0.05"
              value={settings.reactBitsPixelBlastRippleIntensityScale}
              onChange={(event) => onSettingsChange({
                reactBitsPixelBlastRippleIntensityScale: Number(event.target.value),
              })}
              aria-label="React Bits Pixel Blast ripple intensity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Ripple thickness ({settings.reactBitsPixelBlastRippleThickness.toFixed(2)})</span>
            <input
              type="range"
              min="0.01"
              max="0.5"
              step="0.01"
              value={settings.reactBitsPixelBlastRippleThickness}
              onChange={(event) => onSettingsChange({ reactBitsPixelBlastRippleThickness: Number(event.target.value) })}
              aria-label="React Bits Pixel Blast ripple thickness"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Ripple speed ({settings.reactBitsPixelBlastRippleSpeed.toFixed(2)})</span>
            <input
              type="range"
              min="0.05"
              max="2"
              step="0.05"
              value={settings.reactBitsPixelBlastRippleSpeed}
              onChange={(event) => onSettingsChange({ reactBitsPixelBlastRippleSpeed: Number(event.target.value) })}
              aria-label="React Bits Pixel Blast ripple speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Liquid strength ({settings.reactBitsPixelBlastLiquidStrength.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="0.4"
              step="0.01"
              value={settings.reactBitsPixelBlastLiquidStrength}
              onChange={(event) => onSettingsChange({ reactBitsPixelBlastLiquidStrength: Number(event.target.value) })}
              aria-label="React Bits Pixel Blast liquid strength"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Liquid radius ({settings.reactBitsPixelBlastLiquidRadius.toFixed(1)})</span>
            <input
              type="range"
              min="0.1"
              max="4"
              step="0.1"
              value={settings.reactBitsPixelBlastLiquidRadius}
              onChange={(event) => onSettingsChange({ reactBitsPixelBlastLiquidRadius: Number(event.target.value) })}
              aria-label="React Bits Pixel Blast liquid radius"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Liquid wobble ({settings.reactBitsPixelBlastLiquidWobbleSpeed.toFixed(1)})</span>
            <input
              type="range"
              min="0"
              max="10"
              step="0.1"
              value={settings.reactBitsPixelBlastLiquidWobbleSpeed}
              onChange={(event) => onSettingsChange({
                reactBitsPixelBlastLiquidWobbleSpeed: Number(event.target.value),
              })}
              aria-label="React Bits Pixel Blast liquid wobble speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Noise ({settings.reactBitsPixelBlastNoiseAmount.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="0.4"
              step="0.01"
              value={settings.reactBitsPixelBlastNoiseAmount}
              onChange={(event) => onSettingsChange({ reactBitsPixelBlastNoiseAmount: Number(event.target.value) })}
              aria-label="React Bits Pixel Blast noise amount"
            />
          </label>
        </div>
      )
    }

    if (option.id === "react-bits-color-bends") {
      const useCustomBendColors = settings.reactBitsColorBendsPaletteMode === "custom"
      const useHarmonyBendColors = settings.reactBitsColorBendsPaletteMode === "harmony"

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.reactBitsColorBendsPaletteMode}
              onChange={(event) => onSettingsChange({
                reactBitsColorBendsPaletteMode: event.target.value as ReactBitsColorBendsPaletteMode,
              })}
              aria-label="React Bits Color Bends color mode"
            >
              <option value="source">Source RGB bands</option>
              <option value="custom">Custom bends</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {useCustomBendColors && (
            <>
              {[
                ["Color 1", "reactBitsColorBendsColorOne"],
                ["Color 2", "reactBitsColorBendsColorTwo"],
                ["Color 3", "reactBitsColorBendsColorThree"],
                ["Color 4", "reactBitsColorBendsColorFour"],
              ].map(([label, key]) => (
                <label key={key} className={styles.colorRow}>
                  <span>{label}</span>
                  <input
                    type="color"
                    value={settings[key as keyof ChimerSettings] as string}
                    onChange={(event) => onSettingsChange({ [key]: event.target.value })}
                    aria-label={`React Bits Color Bends ${label.toLowerCase()}`}
                  />
                </label>
              ))}
            </>
          )}

          {useHarmonyBendColors && (
            <>
              <label className={styles.colorRow}>
                <span>Primary color</span>
                <input
                  type="color"
                  value={settings.reactBitsColorBendsPrimaryColor}
                  onChange={(event) => onSettingsChange({ reactBitsColorBendsPrimaryColor: event.target.value })}
                  aria-label="React Bits Color Bends primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={settings.reactBitsColorBendsHarmony}
                  onChange={(event) => onSettingsChange({
                    reactBitsColorBendsHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="React Bits Color Bends color harmony"
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

          <label className={styles.selectRow}>
            <input
              type="checkbox"
              checked={settings.reactBitsColorBendsTransparent}
              onChange={(event) => onSettingsChange({ reactBitsColorBendsTransparent: event.target.checked })}
              aria-label="React Bits Color Bends transparent background"
            />
            <span>Transparent background</span>
          </label>

          <label className={styles.selectRow}>
            <input
              type="checkbox"
              checked={settings.reactBitsColorBendsInteractive}
              onChange={(event) => onSettingsChange({ reactBitsColorBendsInteractive: event.target.checked })}
              aria-label="React Bits Color Bends pointer interaction"
            />
            <span>Pointer interaction</span>
          </label>

          <label className={styles.rangeRow}>
            <span>Rotation ({settings.reactBitsColorBendsRotation.toFixed(0)}deg)</span>
            <input
              type="range"
              min="-360"
              max="360"
              step="1"
              value={settings.reactBitsColorBendsRotation}
              onChange={(event) => onSettingsChange({ reactBitsColorBendsRotation: Number(event.target.value) })}
              aria-label="React Bits Color Bends rotation"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Speed ({settings.reactBitsColorBendsSpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={settings.reactBitsColorBendsSpeed}
              onChange={(event) => onSettingsChange({ reactBitsColorBendsSpeed: Number(event.target.value) })}
              aria-label="React Bits Color Bends speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Auto rotate ({settings.reactBitsColorBendsAutoRotate.toFixed(0)}deg/s)</span>
            <input
              type="range"
              min="-180"
              max="180"
              step="1"
              value={settings.reactBitsColorBendsAutoRotate}
              onChange={(event) => onSettingsChange({ reactBitsColorBendsAutoRotate: Number(event.target.value) })}
              aria-label="React Bits Color Bends auto rotate"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Scale ({settings.reactBitsColorBendsScale.toFixed(2)})</span>
            <input
              type="range"
              min="0.1"
              max="4"
              step="0.05"
              value={settings.reactBitsColorBendsScale}
              onChange={(event) => onSettingsChange({ reactBitsColorBendsScale: Number(event.target.value) })}
              aria-label="React Bits Color Bends scale"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Frequency ({settings.reactBitsColorBendsFrequency.toFixed(2)})</span>
            <input
              type="range"
              min="0.1"
              max="4"
              step="0.05"
              value={settings.reactBitsColorBendsFrequency}
              onChange={(event) => onSettingsChange({ reactBitsColorBendsFrequency: Number(event.target.value) })}
              aria-label="React Bits Color Bends frequency"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Warp ({settings.reactBitsColorBendsWarpStrength.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={settings.reactBitsColorBendsWarpStrength}
              onChange={(event) => onSettingsChange({ reactBitsColorBendsWarpStrength: Number(event.target.value) })}
              aria-label="React Bits Color Bends warp strength"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Mouse influence ({settings.reactBitsColorBendsMouseInfluence.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={settings.reactBitsColorBendsMouseInfluence}
              onChange={(event) => onSettingsChange({ reactBitsColorBendsMouseInfluence: Number(event.target.value) })}
              aria-label="React Bits Color Bends mouse influence"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Parallax ({settings.reactBitsColorBendsParallax.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.05"
              value={settings.reactBitsColorBendsParallax}
              onChange={(event) => onSettingsChange({ reactBitsColorBendsParallax: Number(event.target.value) })}
              aria-label="React Bits Color Bends parallax"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Noise ({settings.reactBitsColorBendsNoise.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.reactBitsColorBendsNoise}
              onChange={(event) => onSettingsChange({ reactBitsColorBendsNoise: Number(event.target.value) })}
              aria-label="React Bits Color Bends noise"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Iterations ({settings.reactBitsColorBendsIterations.toFixed(0)})</span>
            <input
              type="range"
              min="1"
              max="5"
              step="1"
              value={settings.reactBitsColorBendsIterations}
              onChange={(event) => onSettingsChange({ reactBitsColorBendsIterations: Number(event.target.value) })}
              aria-label="React Bits Color Bends iterations"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Intensity ({settings.reactBitsColorBendsIntensity.toFixed(2)})</span>
            <input
              type="range"
              min="0.1"
              max="4"
              step="0.05"
              value={settings.reactBitsColorBendsIntensity}
              onChange={(event) => onSettingsChange({ reactBitsColorBendsIntensity: Number(event.target.value) })}
              aria-label="React Bits Color Bends intensity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Band width ({settings.reactBitsColorBendsBandWidth.toFixed(1)})</span>
            <input
              type="range"
              min="0.5"
              max="16"
              step="0.1"
              value={settings.reactBitsColorBendsBandWidth}
              onChange={(event) => onSettingsChange({ reactBitsColorBendsBandWidth: Number(event.target.value) })}
              aria-label="React Bits Color Bends band width"
            />
          </label>
        </div>
      )
    }

    if (option.id === "react-bits-evil-eye") {
      const useCustomEyeColor = settings.reactBitsEvilEyePaletteMode === "custom"
      const useHarmonyEyeColor = settings.reactBitsEvilEyePaletteMode === "harmony"

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.reactBitsEvilEyePaletteMode}
              onChange={(event) => onSettingsChange({
                reactBitsEvilEyePaletteMode: event.target.value as ReactBitsEvilEyePaletteMode,
              })}
              aria-label="React Bits Evil Eye color mode"
            >
              <option value="source">Source orange</option>
              <option value="custom">Custom eye</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {useCustomEyeColor && (
            <label className={styles.colorRow}>
              <span>Eye color</span>
              <input
                type="color"
                value={settings.reactBitsEvilEyeColor}
                onChange={(event) => onSettingsChange({ reactBitsEvilEyeColor: event.target.value })}
                aria-label="React Bits Evil Eye eye color"
              />
            </label>
          )}

          {useHarmonyEyeColor && (
            <>
              <label className={styles.colorRow}>
                <span>Primary color</span>
                <input
                  type="color"
                  value={settings.reactBitsEvilEyePrimaryColor}
                  onChange={(event) => onSettingsChange({ reactBitsEvilEyePrimaryColor: event.target.value })}
                  aria-label="React Bits Evil Eye primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={settings.reactBitsEvilEyeHarmony}
                  onChange={(event) => onSettingsChange({
                    reactBitsEvilEyeHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="React Bits Evil Eye color harmony"
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

          <label className={styles.colorRow}>
            <span>Background</span>
            <input
              type="color"
              value={settings.reactBitsEvilEyeBackgroundColor}
              onChange={(event) => onSettingsChange({ reactBitsEvilEyeBackgroundColor: event.target.value })}
              aria-label="React Bits Evil Eye background color"
            />
          </label>

          <label className={styles.selectRow}>
            <input
              type="checkbox"
              checked={settings.reactBitsEvilEyeInteractive}
              onChange={(event) => onSettingsChange({ reactBitsEvilEyeInteractive: event.target.checked })}
              aria-label="React Bits Evil Eye pointer interaction"
            />
            <span>Pointer pupil follow</span>
          </label>

          <label className={styles.rangeRow}>
            <span>Intensity ({settings.reactBitsEvilEyeIntensity.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={settings.reactBitsEvilEyeIntensity}
              onChange={(event) => onSettingsChange({ reactBitsEvilEyeIntensity: Number(event.target.value) })}
              aria-label="React Bits Evil Eye intensity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Pupil size ({settings.reactBitsEvilEyePupilSize.toFixed(2)})</span>
            <input
              type="range"
              min="0.1"
              max="2"
              step="0.05"
              value={settings.reactBitsEvilEyePupilSize}
              onChange={(event) => onSettingsChange({ reactBitsEvilEyePupilSize: Number(event.target.value) })}
              aria-label="React Bits Evil Eye pupil size"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Iris width ({settings.reactBitsEvilEyeIrisWidth.toFixed(2)})</span>
            <input
              type="range"
              min="0.05"
              max="1"
              step="0.01"
              value={settings.reactBitsEvilEyeIrisWidth}
              onChange={(event) => onSettingsChange({ reactBitsEvilEyeIrisWidth: Number(event.target.value) })}
              aria-label="React Bits Evil Eye iris width"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Glow ({settings.reactBitsEvilEyeGlowIntensity.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1.5"
              step="0.05"
              value={settings.reactBitsEvilEyeGlowIntensity}
              onChange={(event) => onSettingsChange({ reactBitsEvilEyeGlowIntensity: Number(event.target.value) })}
              aria-label="React Bits Evil Eye glow intensity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Scale ({settings.reactBitsEvilEyeScale.toFixed(2)})</span>
            <input
              type="range"
              min="0.25"
              max="2"
              step="0.05"
              value={settings.reactBitsEvilEyeScale}
              onChange={(event) => onSettingsChange({ reactBitsEvilEyeScale: Number(event.target.value) })}
              aria-label="React Bits Evil Eye scale"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Noise scale ({settings.reactBitsEvilEyeNoiseScale.toFixed(2)})</span>
            <input
              type="range"
              min="0.1"
              max="4"
              step="0.05"
              value={settings.reactBitsEvilEyeNoiseScale}
              onChange={(event) => onSettingsChange({ reactBitsEvilEyeNoiseScale: Number(event.target.value) })}
              aria-label="React Bits Evil Eye noise scale"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Pupil follow ({settings.reactBitsEvilEyePupilFollow.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.05"
              value={settings.reactBitsEvilEyePupilFollow}
              onChange={(event) => onSettingsChange({ reactBitsEvilEyePupilFollow: Number(event.target.value) })}
              aria-label="React Bits Evil Eye pupil follow"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Flame speed ({settings.reactBitsEvilEyeFlameSpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={settings.reactBitsEvilEyeFlameSpeed}
              onChange={(event) => onSettingsChange({ reactBitsEvilEyeFlameSpeed: Number(event.target.value) })}
              aria-label="React Bits Evil Eye flame speed"
            />
          </label>
        </div>
      )
    }

    if (option.id === "react-bits-line-waves") {
      const useCustomColors = settings.reactBitsLineWavesPaletteMode === "custom"
      const useHarmonyColors = settings.reactBitsLineWavesPaletteMode === "harmony"

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.reactBitsLineWavesPaletteMode}
              onChange={(event) => onSettingsChange({
                reactBitsLineWavesPaletteMode: event.target.value as ReactBitsLineWavesPaletteMode,
              })}
              aria-label="React Bits Line Waves color mode"
            >
              <option value="source">Source white</option>
              <option value="custom">Custom lines</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {useCustomColors && (
            <>
              <label className={styles.colorRow}>
                <span>Color 1</span>
                <input
                  type="color"
                  value={settings.reactBitsLineWavesColorOne}
                  onChange={(event) => onSettingsChange({ reactBitsLineWavesColorOne: event.target.value })}
                  aria-label="React Bits Line Waves color 1"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Color 2</span>
                <input
                  type="color"
                  value={settings.reactBitsLineWavesColorTwo}
                  onChange={(event) => onSettingsChange({ reactBitsLineWavesColorTwo: event.target.value })}
                  aria-label="React Bits Line Waves color 2"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Color 3</span>
                <input
                  type="color"
                  value={settings.reactBitsLineWavesColorThree}
                  onChange={(event) => onSettingsChange({ reactBitsLineWavesColorThree: event.target.value })}
                  aria-label="React Bits Line Waves color 3"
                />
              </label>
            </>
          )}

          {useHarmonyColors && (
            <>
              <label className={styles.colorRow}>
                <span>Primary color</span>
                <input
                  type="color"
                  value={settings.reactBitsLineWavesPrimaryColor}
                  onChange={(event) => onSettingsChange({ reactBitsLineWavesPrimaryColor: event.target.value })}
                  aria-label="React Bits Line Waves primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={settings.reactBitsLineWavesHarmony}
                  onChange={(event) => onSettingsChange({
                    reactBitsLineWavesHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="React Bits Line Waves color harmony"
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

          <label className={styles.selectRow}>
            <input
              type="checkbox"
              checked={settings.reactBitsLineWavesEnableMouseInteraction}
              onChange={(event) => onSettingsChange({
                reactBitsLineWavesEnableMouseInteraction: event.target.checked,
              })}
              aria-label="React Bits Line Waves mouse warp"
            />
            <span>Pointer warp</span>
          </label>

          <label className={styles.rangeRow}>
            <span>Speed ({settings.reactBitsLineWavesSpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={settings.reactBitsLineWavesSpeed}
              onChange={(event) => onSettingsChange({ reactBitsLineWavesSpeed: Number(event.target.value) })}
              aria-label="React Bits Line Waves speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Inner lines ({settings.reactBitsLineWavesInnerLineCount.toFixed(0)})</span>
            <input
              type="range"
              min="1"
              max="96"
              step="1"
              value={settings.reactBitsLineWavesInnerLineCount}
              onChange={(event) => onSettingsChange({ reactBitsLineWavesInnerLineCount: Number(event.target.value) })}
              aria-label="React Bits Line Waves inner line count"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Outer lines ({settings.reactBitsLineWavesOuterLineCount.toFixed(0)})</span>
            <input
              type="range"
              min="1"
              max="96"
              step="1"
              value={settings.reactBitsLineWavesOuterLineCount}
              onChange={(event) => onSettingsChange({ reactBitsLineWavesOuterLineCount: Number(event.target.value) })}
              aria-label="React Bits Line Waves outer line count"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Warp ({settings.reactBitsLineWavesWarpIntensity.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={settings.reactBitsLineWavesWarpIntensity}
              onChange={(event) => onSettingsChange({ reactBitsLineWavesWarpIntensity: Number(event.target.value) })}
              aria-label="React Bits Line Waves warp intensity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Rotation ({settings.reactBitsLineWavesRotation.toFixed(0)}deg)</span>
            <input
              type="range"
              min="-180"
              max="180"
              step="1"
              value={settings.reactBitsLineWavesRotation}
              onChange={(event) => onSettingsChange({ reactBitsLineWavesRotation: Number(event.target.value) })}
              aria-label="React Bits Line Waves rotation"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Edge fade ({settings.reactBitsLineWavesEdgeFadeWidth.toFixed(2)})</span>
            <input
              type="range"
              min="-1"
              max="1"
              step="0.05"
              value={settings.reactBitsLineWavesEdgeFadeWidth}
              onChange={(event) => onSettingsChange({ reactBitsLineWavesEdgeFadeWidth: Number(event.target.value) })}
              aria-label="React Bits Line Waves edge fade width"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Color cycle ({settings.reactBitsLineWavesColorCycleSpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0"
              max="4"
              step="0.05"
              value={settings.reactBitsLineWavesColorCycleSpeed}
              onChange={(event) => onSettingsChange({ reactBitsLineWavesColorCycleSpeed: Number(event.target.value) })}
              aria-label="React Bits Line Waves color cycle speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Brightness ({settings.reactBitsLineWavesBrightness.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1.5"
              step="0.05"
              value={settings.reactBitsLineWavesBrightness}
              onChange={(event) => onSettingsChange({ reactBitsLineWavesBrightness: Number(event.target.value) })}
              aria-label="React Bits Line Waves brightness"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Mouse influence ({settings.reactBitsLineWavesMouseInfluence.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="4"
              step="0.05"
              value={settings.reactBitsLineWavesMouseInfluence}
              onChange={(event) => onSettingsChange({ reactBitsLineWavesMouseInfluence: Number(event.target.value) })}
              aria-label="React Bits Line Waves mouse influence"
            />
          </label>
        </div>
      )
    }

    if (option.id === "react-bits-radar") {
      const useCustomColor = settings.reactBitsRadarPaletteMode === "custom"
      const useHarmonyColor = settings.reactBitsRadarPaletteMode === "harmony"

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.reactBitsRadarPaletteMode}
              onChange={(event) => onSettingsChange({
                reactBitsRadarPaletteMode: event.target.value as ReactBitsRadarPaletteMode,
              })}
              aria-label="React Bits Radar color mode"
            >
              <option value="source">Source purple</option>
              <option value="custom">Custom radar</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {useCustomColor && (
            <label className={styles.colorRow}>
              <span>Radar color</span>
              <input
                type="color"
                value={settings.reactBitsRadarColor}
                onChange={(event) => onSettingsChange({ reactBitsRadarColor: event.target.value })}
                aria-label="React Bits Radar color"
              />
            </label>
          )}

          {useHarmonyColor && (
            <>
              <label className={styles.colorRow}>
                <span>Primary color</span>
                <input
                  type="color"
                  value={settings.reactBitsRadarPrimaryColor}
                  onChange={(event) => onSettingsChange({ reactBitsRadarPrimaryColor: event.target.value })}
                  aria-label="React Bits Radar primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={settings.reactBitsRadarHarmony}
                  onChange={(event) => onSettingsChange({
                    reactBitsRadarHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="React Bits Radar color harmony"
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

          <label className={styles.colorRow}>
            <span>Background</span>
            <input
              type="color"
              value={settings.reactBitsRadarBackgroundColor}
              onChange={(event) => onSettingsChange({ reactBitsRadarBackgroundColor: event.target.value })}
              aria-label="React Bits Radar background color"
            />
          </label>

          <label className={styles.selectRow}>
            <input
              type="checkbox"
              checked={settings.reactBitsRadarEnableMouseInteraction}
              onChange={(event) => onSettingsChange({
                reactBitsRadarEnableMouseInteraction: event.target.checked,
              })}
              aria-label="React Bits Radar pointer offset"
            />
            <span>Pointer offset</span>
          </label>

          <label className={styles.rangeRow}>
            <span>Speed ({settings.reactBitsRadarSpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={settings.reactBitsRadarSpeed}
              onChange={(event) => onSettingsChange({ reactBitsRadarSpeed: Number(event.target.value) })}
              aria-label="React Bits Radar speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Scale ({settings.reactBitsRadarScale.toFixed(2)})</span>
            <input
              type="range"
              min="0.1"
              max="2"
              step="0.05"
              value={settings.reactBitsRadarScale}
              onChange={(event) => onSettingsChange({ reactBitsRadarScale: Number(event.target.value) })}
              aria-label="React Bits Radar scale"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Rings ({settings.reactBitsRadarRingCount.toFixed(0)})</span>
            <input
              type="range"
              min="1"
              max="40"
              step="1"
              value={settings.reactBitsRadarRingCount}
              onChange={(event) => onSettingsChange({ reactBitsRadarRingCount: Number(event.target.value) })}
              aria-label="React Bits Radar ring count"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Spokes ({settings.reactBitsRadarSpokeCount.toFixed(0)})</span>
            <input
              type="range"
              min="1"
              max="40"
              step="1"
              value={settings.reactBitsRadarSpokeCount}
              onChange={(event) => onSettingsChange({ reactBitsRadarSpokeCount: Number(event.target.value) })}
              aria-label="React Bits Radar spoke count"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Ring thickness ({settings.reactBitsRadarRingThickness.toFixed(3)})</span>
            <input
              type="range"
              min="0.001"
              max="0.25"
              step="0.001"
              value={settings.reactBitsRadarRingThickness}
              onChange={(event) => onSettingsChange({ reactBitsRadarRingThickness: Number(event.target.value) })}
              aria-label="React Bits Radar ring thickness"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Spoke thickness ({settings.reactBitsRadarSpokeThickness.toFixed(3)})</span>
            <input
              type="range"
              min="0.001"
              max="0.1"
              step="0.001"
              value={settings.reactBitsRadarSpokeThickness}
              onChange={(event) => onSettingsChange({ reactBitsRadarSpokeThickness: Number(event.target.value) })}
              aria-label="React Bits Radar spoke thickness"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Sweep speed ({settings.reactBitsRadarSweepSpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0"
              max="4"
              step="0.05"
              value={settings.reactBitsRadarSweepSpeed}
              onChange={(event) => onSettingsChange({ reactBitsRadarSweepSpeed: Number(event.target.value) })}
              aria-label="React Bits Radar sweep speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Sweep width ({settings.reactBitsRadarSweepWidth.toFixed(2)})</span>
            <input
              type="range"
              min="0.1"
              max="12"
              step="0.1"
              value={settings.reactBitsRadarSweepWidth}
              onChange={(event) => onSettingsChange({ reactBitsRadarSweepWidth: Number(event.target.value) })}
              aria-label="React Bits Radar sweep width"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Sweep lobes ({settings.reactBitsRadarSweepLobes.toFixed(0)})</span>
            <input
              type="range"
              min="1"
              max="12"
              step="1"
              value={settings.reactBitsRadarSweepLobes}
              onChange={(event) => onSettingsChange({ reactBitsRadarSweepLobes: Number(event.target.value) })}
              aria-label="React Bits Radar sweep lobes"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Falloff ({settings.reactBitsRadarFalloff.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="8"
              step="0.1"
              value={settings.reactBitsRadarFalloff}
              onChange={(event) => onSettingsChange({ reactBitsRadarFalloff: Number(event.target.value) })}
              aria-label="React Bits Radar falloff"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Brightness ({settings.reactBitsRadarBrightness.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={settings.reactBitsRadarBrightness}
              onChange={(event) => onSettingsChange({ reactBitsRadarBrightness: Number(event.target.value) })}
              aria-label="React Bits Radar brightness"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Mouse influence ({settings.reactBitsRadarMouseInfluence.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.reactBitsRadarMouseInfluence}
              onChange={(event) => onSettingsChange({ reactBitsRadarMouseInfluence: Number(event.target.value) })}
              aria-label="React Bits Radar mouse influence"
            />
          </label>
        </div>
      )
    }

    if (option.id === "react-bits-soft-aurora") {
      const useCustomColor = settings.reactBitsSoftAuroraPaletteMode === "custom"
      const useHarmonyColor = settings.reactBitsSoftAuroraPaletteMode === "harmony"

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.reactBitsSoftAuroraPaletteMode}
              onChange={(event) => onSettingsChange({
                reactBitsSoftAuroraPaletteMode: event.target.value as ReactBitsSoftAuroraPaletteMode,
              })}
              aria-label="React Bits Soft Aurora color mode"
            >
              <option value="source">Source white and magenta</option>
              <option value="custom">Custom aurora</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {useCustomColor ? (
            <>
              <label className={styles.colorRow}>
                <span>Aurora color 1</span>
                <input
                  type="color"
                  value={settings.reactBitsSoftAuroraColorOne}
                  onChange={(event) => onSettingsChange({ reactBitsSoftAuroraColorOne: event.target.value })}
                  aria-label="React Bits Soft Aurora color 1"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Aurora color 2</span>
                <input
                  type="color"
                  value={settings.reactBitsSoftAuroraColorTwo}
                  onChange={(event) => onSettingsChange({ reactBitsSoftAuroraColorTwo: event.target.value })}
                  aria-label="React Bits Soft Aurora color 2"
                />
              </label>
            </>
          ) : null}

          {useHarmonyColor ? (
            <>
              <label className={styles.colorRow}>
                <span>Primary color</span>
                <input
                  type="color"
                  value={settings.reactBitsSoftAuroraPrimaryColor}
                  onChange={(event) => onSettingsChange({ reactBitsSoftAuroraPrimaryColor: event.target.value })}
                  aria-label="React Bits Soft Aurora primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={settings.reactBitsSoftAuroraHarmony}
                  onChange={(event) => onSettingsChange({
                    reactBitsSoftAuroraHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="React Bits Soft Aurora color harmony"
                >
                  {COLOR_HARMONY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}

          <label className={styles.checkboxRow}>
            <span>Mouse shift</span>
            <input
              type="checkbox"
              checked={settings.reactBitsSoftAuroraEnableMouseInteraction}
              onChange={(event) => onSettingsChange({
                reactBitsSoftAuroraEnableMouseInteraction: event.target.checked,
              })}
              aria-label="React Bits Soft Aurora mouse shift"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Speed ({settings.reactBitsSoftAuroraSpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={settings.reactBitsSoftAuroraSpeed}
              onChange={(event) => onSettingsChange({ reactBitsSoftAuroraSpeed: Number(event.target.value) })}
              aria-label="React Bits Soft Aurora speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Scale ({settings.reactBitsSoftAuroraScale.toFixed(2)})</span>
            <input
              type="range"
              min="0.1"
              max="4"
              step="0.05"
              value={settings.reactBitsSoftAuroraScale}
              onChange={(event) => onSettingsChange({ reactBitsSoftAuroraScale: Number(event.target.value) })}
              aria-label="React Bits Soft Aurora scale"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Brightness ({settings.reactBitsSoftAuroraBrightness.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={settings.reactBitsSoftAuroraBrightness}
              onChange={(event) => onSettingsChange({ reactBitsSoftAuroraBrightness: Number(event.target.value) })}
              aria-label="React Bits Soft Aurora brightness"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Noise frequency ({settings.reactBitsSoftAuroraNoiseFrequency.toFixed(2)})</span>
            <input
              type="range"
              min="0.1"
              max="8"
              step="0.05"
              value={settings.reactBitsSoftAuroraNoiseFrequency}
              onChange={(event) => onSettingsChange({
                reactBitsSoftAuroraNoiseFrequency: Number(event.target.value),
              })}
              aria-label="React Bits Soft Aurora noise frequency"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Noise amplitude ({settings.reactBitsSoftAuroraNoiseAmplitude.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="4"
              step="0.05"
              value={settings.reactBitsSoftAuroraNoiseAmplitude}
              onChange={(event) => onSettingsChange({
                reactBitsSoftAuroraNoiseAmplitude: Number(event.target.value),
              })}
              aria-label="React Bits Soft Aurora noise amplitude"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Band height ({settings.reactBitsSoftAuroraBandHeight.toFixed(2)})</span>
            <input
              type="range"
              min="-1"
              max="2"
              step="0.05"
              value={settings.reactBitsSoftAuroraBandHeight}
              onChange={(event) => onSettingsChange({ reactBitsSoftAuroraBandHeight: Number(event.target.value) })}
              aria-label="React Bits Soft Aurora band height"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Band spread ({settings.reactBitsSoftAuroraBandSpread.toFixed(2)})</span>
            <input
              type="range"
              min="0.1"
              max="4"
              step="0.05"
              value={settings.reactBitsSoftAuroraBandSpread}
              onChange={(event) => onSettingsChange({ reactBitsSoftAuroraBandSpread: Number(event.target.value) })}
              aria-label="React Bits Soft Aurora band spread"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Octave decay ({settings.reactBitsSoftAuroraOctaveDecay.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.reactBitsSoftAuroraOctaveDecay}
              onChange={(event) => onSettingsChange({ reactBitsSoftAuroraOctaveDecay: Number(event.target.value) })}
              aria-label="React Bits Soft Aurora octave decay"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Layer offset ({settings.reactBitsSoftAuroraLayerOffset.toFixed(2)})</span>
            <input
              type="range"
              min="-6"
              max="6"
              step="0.05"
              value={settings.reactBitsSoftAuroraLayerOffset}
              onChange={(event) => onSettingsChange({ reactBitsSoftAuroraLayerOffset: Number(event.target.value) })}
              aria-label="React Bits Soft Aurora layer offset"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Color speed ({settings.reactBitsSoftAuroraColorSpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0"
              max="4"
              step="0.05"
              value={settings.reactBitsSoftAuroraColorSpeed}
              onChange={(event) => onSettingsChange({ reactBitsSoftAuroraColorSpeed: Number(event.target.value) })}
              aria-label="React Bits Soft Aurora color speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Mouse influence ({settings.reactBitsSoftAuroraMouseInfluence.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.reactBitsSoftAuroraMouseInfluence}
              onChange={(event) => onSettingsChange({
                reactBitsSoftAuroraMouseInfluence: Number(event.target.value),
              })}
              aria-label="React Bits Soft Aurora mouse influence"
            />
          </label>
        </div>
      )
    }

    if (option.id === "react-bits-plasma") {
      const useCustomColor = settings.reactBitsPlasmaPaletteMode === "custom"
      const useHarmonyColor = settings.reactBitsPlasmaPaletteMode === "harmony"

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.reactBitsPlasmaPaletteMode}
              onChange={(event) => onSettingsChange({
                reactBitsPlasmaPaletteMode: event.target.value as ReactBitsPlasmaPaletteMode,
              })}
              aria-label="React Bits Plasma color mode"
            >
              <option value="source">Source white</option>
              <option value="custom">Custom plasma</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {useCustomColor ? (
            <label className={styles.colorRow}>
              <span>Plasma color</span>
              <input
                type="color"
                value={settings.reactBitsPlasmaColor}
                onChange={(event) => onSettingsChange({ reactBitsPlasmaColor: event.target.value })}
                aria-label="React Bits Plasma color"
              />
            </label>
          ) : null}

          {useHarmonyColor ? (
            <>
              <label className={styles.colorRow}>
                <span>Primary color</span>
                <input
                  type="color"
                  value={settings.reactBitsPlasmaPrimaryColor}
                  onChange={(event) => onSettingsChange({ reactBitsPlasmaPrimaryColor: event.target.value })}
                  aria-label="React Bits Plasma primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={settings.reactBitsPlasmaHarmony}
                  onChange={(event) => onSettingsChange({
                    reactBitsPlasmaHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="React Bits Plasma color harmony"
                >
                  {COLOR_HARMONY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}

          <label className={styles.selectRow}>
            <span>Direction</span>
            <select
              value={settings.reactBitsPlasmaDirection}
              onChange={(event) => onSettingsChange({
                reactBitsPlasmaDirection: event.target.value as ReactBitsPlasmaDirection,
              })}
              aria-label="React Bits Plasma direction"
            >
              <option value="forward">Forward</option>
              <option value="reverse">Reverse</option>
              <option value="pingpong">Ping-pong</option>
            </select>
          </label>

          <label className={styles.checkboxRow}>
            <span>Mouse warp</span>
            <input
              type="checkbox"
              checked={settings.reactBitsPlasmaMouseInteractive}
              onChange={(event) => onSettingsChange({ reactBitsPlasmaMouseInteractive: event.target.checked })}
              aria-label="React Bits Plasma mouse warp"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Speed ({settings.reactBitsPlasmaSpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={settings.reactBitsPlasmaSpeed}
              onChange={(event) => onSettingsChange({ reactBitsPlasmaSpeed: Number(event.target.value) })}
              aria-label="React Bits Plasma speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Scale ({settings.reactBitsPlasmaScale.toFixed(2)})</span>
            <input
              type="range"
              min="0.2"
              max="4"
              step="0.05"
              value={settings.reactBitsPlasmaScale}
              onChange={(event) => onSettingsChange({ reactBitsPlasmaScale: Number(event.target.value) })}
              aria-label="React Bits Plasma scale"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Opacity ({Math.round(settings.reactBitsPlasmaOpacity * 100)}%)</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.reactBitsPlasmaOpacity}
              onChange={(event) => onSettingsChange({ reactBitsPlasmaOpacity: Number(event.target.value) })}
              aria-label="React Bits Plasma opacity"
            />
          </label>
        </div>
      )
    }

    if (option.id === "react-bits-plasma-wave") {
      const useCustomColor = settings.reactBitsPlasmaWavePaletteMode === "custom"
      const useHarmonyColor = settings.reactBitsPlasmaWavePaletteMode === "harmony"

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.reactBitsPlasmaWavePaletteMode}
              onChange={(event) => onSettingsChange({
                reactBitsPlasmaWavePaletteMode: event.target.value as ReactBitsPlasmaWavePaletteMode,
              })}
              aria-label="React Bits Plasma Wave color mode"
            >
              <option value="source">Source violet and cyan</option>
              <option value="custom">Custom waves</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {useCustomColor ? (
            <>
              <label className={styles.colorRow}>
                <span>Wave color 1</span>
                <input
                  type="color"
                  value={settings.reactBitsPlasmaWaveColorOne}
                  onChange={(event) => onSettingsChange({ reactBitsPlasmaWaveColorOne: event.target.value })}
                  aria-label="React Bits Plasma Wave color 1"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Wave color 2</span>
                <input
                  type="color"
                  value={settings.reactBitsPlasmaWaveColorTwo}
                  onChange={(event) => onSettingsChange({ reactBitsPlasmaWaveColorTwo: event.target.value })}
                  aria-label="React Bits Plasma Wave color 2"
                />
              </label>
            </>
          ) : null}

          {useHarmonyColor ? (
            <>
              <label className={styles.colorRow}>
                <span>Primary color</span>
                <input
                  type="color"
                  value={settings.reactBitsPlasmaWavePrimaryColor}
                  onChange={(event) => onSettingsChange({ reactBitsPlasmaWavePrimaryColor: event.target.value })}
                  aria-label="React Bits Plasma Wave primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={settings.reactBitsPlasmaWaveHarmony}
                  onChange={(event) => onSettingsChange({
                    reactBitsPlasmaWaveHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="React Bits Plasma Wave color harmony"
                >
                  {COLOR_HARMONY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}

          <label className={styles.selectRow}>
            <span>Wave 2 direction</span>
            <select
              value={settings.reactBitsPlasmaWaveDirectionTwo}
              onChange={(event) => onSettingsChange({
                reactBitsPlasmaWaveDirectionTwo: Number(event.target.value) as 1 | -1,
              })}
              aria-label="React Bits Plasma Wave secondary direction"
            >
              <option value={1}>Forward</option>
              <option value={-1}>Reverse</option>
            </select>
          </label>

          <label className={styles.rangeRow}>
            <span>Rotation ({settings.reactBitsPlasmaWaveRotationDeg.toFixed(0)}deg)</span>
            <input
              type="range"
              min="-180"
              max="180"
              step="1"
              value={settings.reactBitsPlasmaWaveRotationDeg}
              onChange={(event) => onSettingsChange({ reactBitsPlasmaWaveRotationDeg: Number(event.target.value) })}
              aria-label="React Bits Plasma Wave rotation"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Focal length ({settings.reactBitsPlasmaWaveFocalLength.toFixed(2)})</span>
            <input
              type="range"
              min="0.2"
              max="2"
              step="0.05"
              value={settings.reactBitsPlasmaWaveFocalLength}
              onChange={(event) => onSettingsChange({ reactBitsPlasmaWaveFocalLength: Number(event.target.value) })}
              aria-label="React Bits Plasma Wave focal length"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Wave 1 speed ({settings.reactBitsPlasmaWaveSpeedOne.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="0.5"
              step="0.01"
              value={settings.reactBitsPlasmaWaveSpeedOne}
              onChange={(event) => onSettingsChange({ reactBitsPlasmaWaveSpeedOne: Number(event.target.value) })}
              aria-label="React Bits Plasma Wave speed 1"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Wave 2 speed ({settings.reactBitsPlasmaWaveSpeedTwo.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="0.5"
              step="0.01"
              value={settings.reactBitsPlasmaWaveSpeedTwo}
              onChange={(event) => onSettingsChange({ reactBitsPlasmaWaveSpeedTwo: Number(event.target.value) })}
              aria-label="React Bits Plasma Wave speed 2"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Wave 1 bend ({settings.reactBitsPlasmaWaveBendOne.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={settings.reactBitsPlasmaWaveBendOne}
              onChange={(event) => onSettingsChange({ reactBitsPlasmaWaveBendOne: Number(event.target.value) })}
              aria-label="React Bits Plasma Wave bend 1"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Wave 2 bend ({settings.reactBitsPlasmaWaveBendTwo.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={settings.reactBitsPlasmaWaveBendTwo}
              onChange={(event) => onSettingsChange({ reactBitsPlasmaWaveBendTwo: Number(event.target.value) })}
              aria-label="React Bits Plasma Wave bend 2"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>X offset ({settings.reactBitsPlasmaWaveXOffset.toFixed(0)}px)</span>
            <input
              type="range"
              min="-800"
              max="800"
              step="10"
              value={settings.reactBitsPlasmaWaveXOffset}
              onChange={(event) => onSettingsChange({ reactBitsPlasmaWaveXOffset: Number(event.target.value) })}
              aria-label="React Bits Plasma Wave x offset"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Y offset ({settings.reactBitsPlasmaWaveYOffset.toFixed(0)}px)</span>
            <input
              type="range"
              min="-800"
              max="800"
              step="10"
              value={settings.reactBitsPlasmaWaveYOffset}
              onChange={(event) => onSettingsChange({ reactBitsPlasmaWaveYOffset: Number(event.target.value) })}
              aria-label="React Bits Plasma Wave y offset"
            />
          </label>
        </div>
      )
    }

    if (option.id === "react-bits-particles") {
      const useCustomPalette = settings.reactBitsParticlesPaletteMode === "custom"
      const useHarmonyPalette = settings.reactBitsParticlesPaletteMode === "harmony"

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.reactBitsParticlesPaletteMode}
              onChange={(event) => onSettingsChange({
                reactBitsParticlesPaletteMode: event.target.value as ReactBitsParticlesPaletteMode,
              })}
              aria-label="React Bits Particles color mode"
            >
              <option value="source">Source white particles</option>
              <option value="custom">Custom particles</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {useCustomPalette ? (
            <>
              <label className={styles.colorRow}>
                <span>Particle color 1</span>
                <input
                  type="color"
                  value={settings.reactBitsParticlesColorOne}
                  onChange={(event) => onSettingsChange({ reactBitsParticlesColorOne: event.target.value })}
                  aria-label="React Bits Particles color 1"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Particle color 2</span>
                <input
                  type="color"
                  value={settings.reactBitsParticlesColorTwo}
                  onChange={(event) => onSettingsChange({ reactBitsParticlesColorTwo: event.target.value })}
                  aria-label="React Bits Particles color 2"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Particle color 3</span>
                <input
                  type="color"
                  value={settings.reactBitsParticlesColorThree}
                  onChange={(event) => onSettingsChange({ reactBitsParticlesColorThree: event.target.value })}
                  aria-label="React Bits Particles color 3"
                />
              </label>
            </>
          ) : null}

          {useHarmonyPalette ? (
            <>
              <label className={styles.colorRow}>
                <span>Primary color</span>
                <input
                  type="color"
                  value={settings.reactBitsParticlesPrimaryColor}
                  onChange={(event) => onSettingsChange({ reactBitsParticlesPrimaryColor: event.target.value })}
                  aria-label="React Bits Particles primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={settings.reactBitsParticlesHarmony}
                  onChange={(event) => onSettingsChange({
                    reactBitsParticlesHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="React Bits Particles color harmony"
                >
                  {COLOR_HARMONY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}

          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={settings.reactBitsParticlesMoveOnHover}
              onChange={(event) => onSettingsChange({ reactBitsParticlesMoveOnHover: event.target.checked })}
            />
            <span>Move on cursor</span>
          </label>

          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={settings.reactBitsParticlesAlpha}
              onChange={(event) => onSettingsChange({ reactBitsParticlesAlpha: event.target.checked })}
            />
            <span>Soft alpha particles</span>
          </label>

          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={!settings.reactBitsParticlesDisableRotation}
              onChange={(event) => onSettingsChange({ reactBitsParticlesDisableRotation: !event.target.checked })}
            />
            <span>Rotate cloud</span>
          </label>

          <label className={styles.rangeRow}>
            <span>Particle count ({settings.reactBitsParticlesCount.toFixed(0)})</span>
            <input
              type="range"
              min="20"
              max="1500"
              step="10"
              value={settings.reactBitsParticlesCount}
              onChange={(event) => onSettingsChange({ reactBitsParticlesCount: Number(event.target.value) })}
              aria-label="React Bits Particles particle count"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Spread ({settings.reactBitsParticlesSpread.toFixed(1)})</span>
            <input
              type="range"
              min="1"
              max="30"
              step="0.5"
              value={settings.reactBitsParticlesSpread}
              onChange={(event) => onSettingsChange({ reactBitsParticlesSpread: Number(event.target.value) })}
              aria-label="React Bits Particles spread"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Speed ({settings.reactBitsParticlesSpeed.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.reactBitsParticlesSpeed}
              onChange={(event) => onSettingsChange({ reactBitsParticlesSpeed: Number(event.target.value) })}
              aria-label="React Bits Particles speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Hover push ({settings.reactBitsParticlesHoverFactor.toFixed(1)})</span>
            <input
              type="range"
              min="0"
              max="5"
              step="0.1"
              value={settings.reactBitsParticlesHoverFactor}
              onChange={(event) => onSettingsChange({ reactBitsParticlesHoverFactor: Number(event.target.value) })}
              aria-label="React Bits Particles hover push"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Base size ({settings.reactBitsParticlesBaseSize.toFixed(0)})</span>
            <input
              type="range"
              min="10"
              max="300"
              step="5"
              value={settings.reactBitsParticlesBaseSize}
              onChange={(event) => onSettingsChange({ reactBitsParticlesBaseSize: Number(event.target.value) })}
              aria-label="React Bits Particles base size"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Size randomness ({settings.reactBitsParticlesSizeRandomness.toFixed(1)})</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.1"
              value={settings.reactBitsParticlesSizeRandomness}
              onChange={(event) => onSettingsChange({ reactBitsParticlesSizeRandomness: Number(event.target.value) })}
              aria-label="React Bits Particles size randomness"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Camera distance ({settings.reactBitsParticlesCameraDistance.toFixed(0)})</span>
            <input
              type="range"
              min="5"
              max="60"
              step="1"
              value={settings.reactBitsParticlesCameraDistance}
              onChange={(event) => onSettingsChange({ reactBitsParticlesCameraDistance: Number(event.target.value) })}
              aria-label="React Bits Particles camera distance"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Pixel ratio ({settings.reactBitsParticlesPixelRatio.toFixed(1)})</span>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={settings.reactBitsParticlesPixelRatio}
              onChange={(event) => onSettingsChange({ reactBitsParticlesPixelRatio: Number(event.target.value) })}
              aria-label="React Bits Particles pixel ratio"
            />
          </label>
        </div>
      )
    }

    if (option.id === "react-bits-gradient-blinds") {
      const useCustomGradient = settings.reactBitsGradientBlindsPaletteMode === "custom"
      const useHarmonyGradient = settings.reactBitsGradientBlindsPaletteMode === "harmony"

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.reactBitsGradientBlindsPaletteMode}
              onChange={(event) => onSettingsChange({
                reactBitsGradientBlindsPaletteMode: event.target.value as ReactBitsGradientBlindsPaletteMode,
              })}
              aria-label="React Bits Gradient Blinds color mode"
            >
              <option value="source">Source pink and purple</option>
              <option value="custom">Custom gradient</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {useCustomGradient ? (
            <>
              <label className={styles.colorRow}>
                <span>Gradient color 1</span>
                <input
                  type="color"
                  value={settings.reactBitsGradientBlindsColorOne}
                  onChange={(event) => onSettingsChange({ reactBitsGradientBlindsColorOne: event.target.value })}
                  aria-label="React Bits Gradient Blinds color 1"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Gradient color 2</span>
                <input
                  type="color"
                  value={settings.reactBitsGradientBlindsColorTwo}
                  onChange={(event) => onSettingsChange({ reactBitsGradientBlindsColorTwo: event.target.value })}
                  aria-label="React Bits Gradient Blinds color 2"
                />
              </label>
            </>
          ) : null}

          {useHarmonyGradient ? (
            <>
              <label className={styles.colorRow}>
                <span>Primary color</span>
                <input
                  type="color"
                  value={settings.reactBitsGradientBlindsPrimaryColor}
                  onChange={(event) => onSettingsChange({ reactBitsGradientBlindsPrimaryColor: event.target.value })}
                  aria-label="React Bits Gradient Blinds primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={settings.reactBitsGradientBlindsHarmony}
                  onChange={(event) => onSettingsChange({
                    reactBitsGradientBlindsHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="React Bits Gradient Blinds color harmony"
                >
                  {COLOR_HARMONY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}

          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={settings.reactBitsGradientBlindsEnableMouseInteraction}
              onChange={(event) => onSettingsChange({
                reactBitsGradientBlindsEnableMouseInteraction: event.target.checked,
              })}
            />
            <span>Cursor spotlight</span>
          </label>

          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={settings.reactBitsGradientBlindsMirror}
              onChange={(event) => onSettingsChange({ reactBitsGradientBlindsMirror: event.target.checked })}
            />
            <span>Mirror gradient</span>
          </label>

          <label className={styles.selectRow}>
            <span>Shine direction</span>
            <select
              value={settings.reactBitsGradientBlindsShineDirection}
              onChange={(event) => onSettingsChange({
                reactBitsGradientBlindsShineDirection: event.target.value as ReactBitsGradientBlindsShineDirection,
              })}
              aria-label="React Bits Gradient Blinds shine direction"
            >
              <option value="left">Left</option>
              <option value="right">Right</option>
            </select>
          </label>

          <label className={styles.selectRow}>
            <span>Blend mode</span>
            <select
              value={settings.reactBitsGradientBlindsBlendMode}
              onChange={(event) => onSettingsChange({
                reactBitsGradientBlindsBlendMode: event.target.value as ReactBitsGradientBlindsBlendMode,
              })}
              aria-label="React Bits Gradient Blinds blend mode"
            >
              <option value="lighten">Lighten</option>
              <option value="screen">Screen</option>
              <option value="plus-lighter">Plus lighter</option>
              <option value="normal">Normal</option>
            </select>
          </label>

          <label className={styles.rangeRow}>
            <span>Angle ({settings.reactBitsGradientBlindsAngle.toFixed(0)}deg)</span>
            <input
              type="range"
              min="-180"
              max="180"
              step="1"
              value={settings.reactBitsGradientBlindsAngle}
              onChange={(event) => onSettingsChange({ reactBitsGradientBlindsAngle: Number(event.target.value) })}
              aria-label="React Bits Gradient Blinds angle"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Noise ({settings.reactBitsGradientBlindsNoise.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.reactBitsGradientBlindsNoise}
              onChange={(event) => onSettingsChange({ reactBitsGradientBlindsNoise: Number(event.target.value) })}
              aria-label="React Bits Gradient Blinds noise"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Blind count ({settings.reactBitsGradientBlindsBlindCount.toFixed(0)})</span>
            <input
              type="range"
              min="1"
              max="80"
              step="1"
              value={settings.reactBitsGradientBlindsBlindCount}
              onChange={(event) => onSettingsChange({ reactBitsGradientBlindsBlindCount: Number(event.target.value) })}
              aria-label="React Bits Gradient Blinds blind count"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Min blind width ({settings.reactBitsGradientBlindsBlindMinWidth.toFixed(0)}px)</span>
            <input
              type="range"
              min="0"
              max="240"
              step="5"
              value={settings.reactBitsGradientBlindsBlindMinWidth}
              onChange={(event) => onSettingsChange({ reactBitsGradientBlindsBlindMinWidth: Number(event.target.value) })}
              aria-label="React Bits Gradient Blinds minimum blind width"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Mouse damping ({settings.reactBitsGradientBlindsMouseDampening.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.reactBitsGradientBlindsMouseDampening}
              onChange={(event) => onSettingsChange({ reactBitsGradientBlindsMouseDampening: Number(event.target.value) })}
              aria-label="React Bits Gradient Blinds mouse damping"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Spotlight radius ({settings.reactBitsGradientBlindsSpotlightRadius.toFixed(2)})</span>
            <input
              type="range"
              min="0.05"
              max="1.5"
              step="0.05"
              value={settings.reactBitsGradientBlindsSpotlightRadius}
              onChange={(event) => onSettingsChange({ reactBitsGradientBlindsSpotlightRadius: Number(event.target.value) })}
              aria-label="React Bits Gradient Blinds spotlight radius"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Spotlight softness ({settings.reactBitsGradientBlindsSpotlightSoftness.toFixed(1)})</span>
            <input
              type="range"
              min="0.2"
              max="4"
              step="0.1"
              value={settings.reactBitsGradientBlindsSpotlightSoftness}
              onChange={(event) => onSettingsChange({ reactBitsGradientBlindsSpotlightSoftness: Number(event.target.value) })}
              aria-label="React Bits Gradient Blinds spotlight softness"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Spotlight opacity ({settings.reactBitsGradientBlindsSpotlightOpacity.toFixed(1)})</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={settings.reactBitsGradientBlindsSpotlightOpacity}
              onChange={(event) => onSettingsChange({ reactBitsGradientBlindsSpotlightOpacity: Number(event.target.value) })}
              aria-label="React Bits Gradient Blinds spotlight opacity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Distortion ({settings.reactBitsGradientBlindsDistort.toFixed(1)})</span>
            <input
              type="range"
              min="0"
              max="5"
              step="0.1"
              value={settings.reactBitsGradientBlindsDistort}
              onChange={(event) => onSettingsChange({ reactBitsGradientBlindsDistort: Number(event.target.value) })}
              aria-label="React Bits Gradient Blinds distortion"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>DPR ({settings.reactBitsGradientBlindsDpr.toFixed(1)})</span>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={settings.reactBitsGradientBlindsDpr}
              onChange={(event) => onSettingsChange({ reactBitsGradientBlindsDpr: Number(event.target.value) })}
              aria-label="React Bits Gradient Blinds dpr"
            />
          </label>
        </div>
      )
    }

    if (option.id === "react-bits-grainient") {
      const useCustomGrainient = settings.reactBitsGrainientPaletteMode === "custom"
      const useHarmonyGrainient = settings.reactBitsGrainientPaletteMode === "harmony"

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.reactBitsGrainientPaletteMode}
              onChange={(event) => onSettingsChange({
                reactBitsGrainientPaletteMode: event.target.value as ReactBitsGrainientPaletteMode,
              })}
              aria-label="React Bits Grainient color mode"
            >
              <option value="source">Source magenta, violet, and mauve</option>
              <option value="custom">Custom grain colors</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {useCustomGrainient ? (
            <>
              <label className={styles.colorRow}>
                <span>Color 1</span>
                <input
                  type="color"
                  value={settings.reactBitsGrainientColorOne}
                  onChange={(event) => onSettingsChange({ reactBitsGrainientColorOne: event.target.value })}
                  aria-label="React Bits Grainient color 1"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Color 2</span>
                <input
                  type="color"
                  value={settings.reactBitsGrainientColorTwo}
                  onChange={(event) => onSettingsChange({ reactBitsGrainientColorTwo: event.target.value })}
                  aria-label="React Bits Grainient color 2"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Color 3</span>
                <input
                  type="color"
                  value={settings.reactBitsGrainientColorThree}
                  onChange={(event) => onSettingsChange({ reactBitsGrainientColorThree: event.target.value })}
                  aria-label="React Bits Grainient color 3"
                />
              </label>
            </>
          ) : null}

          {useHarmonyGrainient ? (
            <>
              <label className={styles.colorRow}>
                <span>Primary color</span>
                <input
                  type="color"
                  value={settings.reactBitsGrainientPrimaryColor}
                  onChange={(event) => onSettingsChange({ reactBitsGrainientPrimaryColor: event.target.value })}
                  aria-label="React Bits Grainient primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={settings.reactBitsGrainientHarmony}
                  onChange={(event) => onSettingsChange({
                    reactBitsGrainientHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="React Bits Grainient color harmony"
                >
                  {COLOR_HARMONY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}

          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={settings.reactBitsGrainientGrainAnimated}
              onChange={(event) => onSettingsChange({ reactBitsGrainientGrainAnimated: event.target.checked })}
            />
            <span>Animated grain</span>
          </label>

          <label className={styles.rangeRow}>
            <span>Time speed ({settings.reactBitsGrainientTimeSpeed.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.01"
              value={settings.reactBitsGrainientTimeSpeed}
              onChange={(event) => onSettingsChange({ reactBitsGrainientTimeSpeed: Number(event.target.value) })}
              aria-label="React Bits Grainient time speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Color balance ({settings.reactBitsGrainientColorBalance.toFixed(2)})</span>
            <input
              type="range"
              min="-1"
              max="1"
              step="0.01"
              value={settings.reactBitsGrainientColorBalance}
              onChange={(event) => onSettingsChange({ reactBitsGrainientColorBalance: Number(event.target.value) })}
              aria-label="React Bits Grainient color balance"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Warp strength ({settings.reactBitsGrainientWarpStrength.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="5"
              step="0.05"
              value={settings.reactBitsGrainientWarpStrength}
              onChange={(event) => onSettingsChange({ reactBitsGrainientWarpStrength: Number(event.target.value) })}
              aria-label="React Bits Grainient warp strength"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Warp frequency ({settings.reactBitsGrainientWarpFrequency.toFixed(1)})</span>
            <input
              type="range"
              min="0.1"
              max="20"
              step="0.1"
              value={settings.reactBitsGrainientWarpFrequency}
              onChange={(event) => onSettingsChange({ reactBitsGrainientWarpFrequency: Number(event.target.value) })}
              aria-label="React Bits Grainient warp frequency"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Warp speed ({settings.reactBitsGrainientWarpSpeed.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="6"
              step="0.05"
              value={settings.reactBitsGrainientWarpSpeed}
              onChange={(event) => onSettingsChange({ reactBitsGrainientWarpSpeed: Number(event.target.value) })}
              aria-label="React Bits Grainient warp speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Warp amplitude ({settings.reactBitsGrainientWarpAmplitude.toFixed(0)})</span>
            <input
              type="range"
              min="1"
              max="160"
              step="1"
              value={settings.reactBitsGrainientWarpAmplitude}
              onChange={(event) => onSettingsChange({ reactBitsGrainientWarpAmplitude: Number(event.target.value) })}
              aria-label="React Bits Grainient warp amplitude"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Blend angle ({settings.reactBitsGrainientBlendAngle.toFixed(0)}deg)</span>
            <input
              type="range"
              min="-180"
              max="180"
              step="1"
              value={settings.reactBitsGrainientBlendAngle}
              onChange={(event) => onSettingsChange({ reactBitsGrainientBlendAngle: Number(event.target.value) })}
              aria-label="React Bits Grainient blend angle"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Blend softness ({settings.reactBitsGrainientBlendSoftness.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.reactBitsGrainientBlendSoftness}
              onChange={(event) => onSettingsChange({ reactBitsGrainientBlendSoftness: Number(event.target.value) })}
              aria-label="React Bits Grainient blend softness"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Rotation amount ({settings.reactBitsGrainientRotationAmount.toFixed(0)})</span>
            <input
              type="range"
              min="0"
              max="1200"
              step="10"
              value={settings.reactBitsGrainientRotationAmount}
              onChange={(event) => onSettingsChange({ reactBitsGrainientRotationAmount: Number(event.target.value) })}
              aria-label="React Bits Grainient rotation amount"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Noise scale ({settings.reactBitsGrainientNoiseScale.toFixed(1)})</span>
            <input
              type="range"
              min="0.1"
              max="8"
              step="0.1"
              value={settings.reactBitsGrainientNoiseScale}
              onChange={(event) => onSettingsChange({ reactBitsGrainientNoiseScale: Number(event.target.value) })}
              aria-label="React Bits Grainient noise scale"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Grain amount ({settings.reactBitsGrainientGrainAmount.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.reactBitsGrainientGrainAmount}
              onChange={(event) => onSettingsChange({ reactBitsGrainientGrainAmount: Number(event.target.value) })}
              aria-label="React Bits Grainient grain amount"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Grain scale ({settings.reactBitsGrainientGrainScale.toFixed(1)})</span>
            <input
              type="range"
              min="0.1"
              max="12"
              step="0.1"
              value={settings.reactBitsGrainientGrainScale}
              onChange={(event) => onSettingsChange({ reactBitsGrainientGrainScale: Number(event.target.value) })}
              aria-label="React Bits Grainient grain scale"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Contrast ({settings.reactBitsGrainientContrast.toFixed(2)})</span>
            <input
              type="range"
              min="0.2"
              max="4"
              step="0.05"
              value={settings.reactBitsGrainientContrast}
              onChange={(event) => onSettingsChange({ reactBitsGrainientContrast: Number(event.target.value) })}
              aria-label="React Bits Grainient contrast"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Gamma ({settings.reactBitsGrainientGamma.toFixed(2)})</span>
            <input
              type="range"
              min="0.2"
              max="4"
              step="0.05"
              value={settings.reactBitsGrainientGamma}
              onChange={(event) => onSettingsChange({ reactBitsGrainientGamma: Number(event.target.value) })}
              aria-label="React Bits Grainient gamma"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Saturation ({settings.reactBitsGrainientSaturation.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={settings.reactBitsGrainientSaturation}
              onChange={(event) => onSettingsChange({ reactBitsGrainientSaturation: Number(event.target.value) })}
              aria-label="React Bits Grainient saturation"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Center X ({settings.reactBitsGrainientCenterX.toFixed(2)})</span>
            <input
              type="range"
              min="-1"
              max="1"
              step="0.01"
              value={settings.reactBitsGrainientCenterX}
              onChange={(event) => onSettingsChange({ reactBitsGrainientCenterX: Number(event.target.value) })}
              aria-label="React Bits Grainient center X"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Center Y ({settings.reactBitsGrainientCenterY.toFixed(2)})</span>
            <input
              type="range"
              min="-1"
              max="1"
              step="0.01"
              value={settings.reactBitsGrainientCenterY}
              onChange={(event) => onSettingsChange({ reactBitsGrainientCenterY: Number(event.target.value) })}
              aria-label="React Bits Grainient center Y"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Zoom ({settings.reactBitsGrainientZoom.toFixed(2)})</span>
            <input
              type="range"
              min="0.2"
              max="3"
              step="0.05"
              value={settings.reactBitsGrainientZoom}
              onChange={(event) => onSettingsChange({ reactBitsGrainientZoom: Number(event.target.value) })}
              aria-label="React Bits Grainient zoom"
            />
          </label>
        </div>
      )
    }

    if (option.id === "react-bits-grid-scan") {
      const useCustomGridScan = settings.reactBitsGridScanPaletteMode === "custom"
      const useHarmonyGridScan = settings.reactBitsGridScanPaletteMode === "harmony"

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.reactBitsGridScanPaletteMode}
              onChange={(event) => onSettingsChange({
                reactBitsGridScanPaletteMode: event.target.value as ReactBitsGridScanPaletteMode,
              })}
              aria-label="React Bits Grid Scan color mode"
            >
              <option value="source">Source dark grid and magenta scan</option>
              <option value="custom">Custom grid and scan colors</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {useCustomGridScan ? (
            <>
              <label className={styles.colorRow}>
                <span>Grid lines</span>
                <input
                  type="color"
                  value={settings.reactBitsGridScanLinesColor}
                  onChange={(event) => onSettingsChange({ reactBitsGridScanLinesColor: event.target.value })}
                  aria-label="React Bits Grid Scan line color"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Scan color</span>
                <input
                  type="color"
                  value={settings.reactBitsGridScanScanColor}
                  onChange={(event) => onSettingsChange({ reactBitsGridScanScanColor: event.target.value })}
                  aria-label="React Bits Grid Scan scan color"
                />
              </label>
            </>
          ) : null}

          {useHarmonyGridScan ? (
            <>
              <label className={styles.colorRow}>
                <span>Primary color</span>
                <input
                  type="color"
                  value={settings.reactBitsGridScanPrimaryColor}
                  onChange={(event) => onSettingsChange({ reactBitsGridScanPrimaryColor: event.target.value })}
                  aria-label="React Bits Grid Scan primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={settings.reactBitsGridScanHarmony}
                  onChange={(event) => onSettingsChange({
                    reactBitsGridScanHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="React Bits Grid Scan color harmony"
                >
                  {COLOR_HARMONY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}

          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={settings.reactBitsGridScanEnablePointerInteraction}
              onChange={(event) => onSettingsChange({
                reactBitsGridScanEnablePointerInteraction: event.target.checked,
              })}
            />
            <span>Pointer skew</span>
          </label>

          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={settings.reactBitsGridScanScanOnClick}
              onChange={(event) => onSettingsChange({ reactBitsGridScanScanOnClick: event.target.checked })}
            />
            <span>Click scan pulses</span>
          </label>

          <label className={styles.selectRow}>
            <span>Line style</span>
            <select
              value={settings.reactBitsGridScanLineStyle}
              onChange={(event) => onSettingsChange({
                reactBitsGridScanLineStyle: event.target.value as ReactBitsGridScanLineStyle,
              })}
              aria-label="React Bits Grid Scan line style"
            >
              <option value="solid">Solid</option>
              <option value="dashed">Dashed</option>
              <option value="dotted">Dotted</option>
            </select>
          </label>

          <label className={styles.selectRow}>
            <span>Scan direction</span>
            <select
              value={settings.reactBitsGridScanDirection}
              onChange={(event) => onSettingsChange({
                reactBitsGridScanDirection: event.target.value as ReactBitsGridScanDirection,
              })}
              aria-label="React Bits Grid Scan direction"
            >
              <option value="forward">Forward</option>
              <option value="backward">Backward</option>
              <option value="pingpong">Ping pong</option>
            </select>
          </label>

          <label className={styles.rangeRow}>
            <span>Sensitivity ({settings.reactBitsGridScanSensitivity.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.reactBitsGridScanSensitivity}
              onChange={(event) => onSettingsChange({ reactBitsGridScanSensitivity: Number(event.target.value) })}
              aria-label="React Bits Grid Scan sensitivity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Line thickness ({settings.reactBitsGridScanLineThickness.toFixed(1)})</span>
            <input
              type="range"
              min="0.2"
              max="6"
              step="0.1"
              value={settings.reactBitsGridScanLineThickness}
              onChange={(event) => onSettingsChange({ reactBitsGridScanLineThickness: Number(event.target.value) })}
              aria-label="React Bits Grid Scan line thickness"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Scan opacity ({settings.reactBitsGridScanScanOpacity.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.reactBitsGridScanScanOpacity}
              onChange={(event) => onSettingsChange({ reactBitsGridScanScanOpacity: Number(event.target.value) })}
              aria-label="React Bits Grid Scan opacity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Grid scale ({settings.reactBitsGridScanGridScale.toFixed(2)})</span>
            <input
              type="range"
              min="0.02"
              max="0.5"
              step="0.01"
              value={settings.reactBitsGridScanGridScale}
              onChange={(event) => onSettingsChange({ reactBitsGridScanGridScale: Number(event.target.value) })}
              aria-label="React Bits Grid Scan grid scale"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Line jitter ({settings.reactBitsGridScanLineJitter.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.reactBitsGridScanLineJitter}
              onChange={(event) => onSettingsChange({ reactBitsGridScanLineJitter: Number(event.target.value) })}
              aria-label="React Bits Grid Scan line jitter"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Noise ({settings.reactBitsGridScanNoiseIntensity.toFixed(3)})</span>
            <input
              type="range"
              min="0"
              max="0.25"
              step="0.005"
              value={settings.reactBitsGridScanNoiseIntensity}
              onChange={(event) => onSettingsChange({ reactBitsGridScanNoiseIntensity: Number(event.target.value) })}
              aria-label="React Bits Grid Scan noise"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Bloom opacity ({settings.reactBitsGridScanBloomOpacity.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.05"
              value={settings.reactBitsGridScanBloomOpacity}
              onChange={(event) => onSettingsChange({ reactBitsGridScanBloomOpacity: Number(event.target.value) })}
              aria-label="React Bits Grid Scan bloom opacity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Scan glow ({settings.reactBitsGridScanScanGlow.toFixed(2)})</span>
            <input
              type="range"
              min="0.1"
              max="3"
              step="0.05"
              value={settings.reactBitsGridScanScanGlow}
              onChange={(event) => onSettingsChange({ reactBitsGridScanScanGlow: Number(event.target.value) })}
              aria-label="React Bits Grid Scan glow"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Scan softness ({settings.reactBitsGridScanScanSoftness.toFixed(1)})</span>
            <input
              type="range"
              min="0.2"
              max="6"
              step="0.1"
              value={settings.reactBitsGridScanScanSoftness}
              onChange={(event) => onSettingsChange({ reactBitsGridScanScanSoftness: Number(event.target.value) })}
              aria-label="React Bits Grid Scan softness"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Phase taper ({settings.reactBitsGridScanPhaseTaper.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="0.49"
              step="0.01"
              value={settings.reactBitsGridScanPhaseTaper}
              onChange={(event) => onSettingsChange({ reactBitsGridScanPhaseTaper: Number(event.target.value) })}
              aria-label="React Bits Grid Scan phase taper"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Scan duration ({settings.reactBitsGridScanScanDuration.toFixed(2)}s)</span>
            <input
              type="range"
              min="0.05"
              max="10"
              step="0.05"
              value={settings.reactBitsGridScanScanDuration}
              onChange={(event) => onSettingsChange({ reactBitsGridScanScanDuration: Number(event.target.value) })}
              aria-label="React Bits Grid Scan duration"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Scan delay ({settings.reactBitsGridScanScanDelay.toFixed(2)}s)</span>
            <input
              type="range"
              min="0"
              max="10"
              step="0.05"
              value={settings.reactBitsGridScanScanDelay}
              onChange={(event) => onSettingsChange({ reactBitsGridScanScanDelay: Number(event.target.value) })}
              aria-label="React Bits Grid Scan delay"
            />
          </label>
        </div>
      )
    }

    if (option.id === "react-bits-beams") {
      const useCustomBeams = settings.reactBitsBeamsPaletteMode === "custom"
      const useHarmonyBeams = settings.reactBitsBeamsPaletteMode === "harmony"

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.reactBitsBeamsPaletteMode}
              onChange={(event) => onSettingsChange({
                reactBitsBeamsPaletteMode: event.target.value as ReactBitsBeamsPaletteMode,
              })}
              aria-label="React Bits Beams color mode"
            >
              <option value="source">Source white light</option>
              <option value="custom">Custom light color</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {useCustomBeams ? (
            <label className={styles.colorRow}>
              <span>Light color</span>
              <input
                type="color"
                value={settings.reactBitsBeamsLightColor}
                onChange={(event) => onSettingsChange({ reactBitsBeamsLightColor: event.target.value })}
                aria-label="React Bits Beams light color"
              />
            </label>
          ) : null}

          {useHarmonyBeams ? (
            <>
              <label className={styles.colorRow}>
                <span>Primary color</span>
                <input
                  type="color"
                  value={settings.reactBitsBeamsPrimaryColor}
                  onChange={(event) => onSettingsChange({ reactBitsBeamsPrimaryColor: event.target.value })}
                  aria-label="React Bits Beams primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={settings.reactBitsBeamsHarmony}
                  onChange={(event) => onSettingsChange({
                    reactBitsBeamsHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="React Bits Beams color harmony"
                >
                  {COLOR_HARMONY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}

          <label className={styles.rangeRow}>
            <span>Beam width ({settings.reactBitsBeamsBeamWidth.toFixed(1)})</span>
            <input
              type="range"
              min="0.2"
              max="6"
              step="0.1"
              value={settings.reactBitsBeamsBeamWidth}
              onChange={(event) => onSettingsChange({ reactBitsBeamsBeamWidth: Number(event.target.value) })}
              aria-label="React Bits Beams width"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Beam height ({settings.reactBitsBeamsBeamHeight.toFixed(0)})</span>
            <input
              type="range"
              min="4"
              max="32"
              step="1"
              value={settings.reactBitsBeamsBeamHeight}
              onChange={(event) => onSettingsChange({ reactBitsBeamsBeamHeight: Number(event.target.value) })}
              aria-label="React Bits Beams height"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Beam count ({settings.reactBitsBeamsBeamNumber.toFixed(0)})</span>
            <input
              type="range"
              min="1"
              max="48"
              step="1"
              value={settings.reactBitsBeamsBeamNumber}
              onChange={(event) => onSettingsChange({ reactBitsBeamsBeamNumber: Number(event.target.value) })}
              aria-label="React Bits Beams count"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Speed ({settings.reactBitsBeamsSpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0"
              max="8"
              step="0.05"
              value={settings.reactBitsBeamsSpeed}
              onChange={(event) => onSettingsChange({ reactBitsBeamsSpeed: Number(event.target.value) })}
              aria-label="React Bits Beams speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Noise ({settings.reactBitsBeamsNoiseIntensity.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="4"
              step="0.05"
              value={settings.reactBitsBeamsNoiseIntensity}
              onChange={(event) => onSettingsChange({ reactBitsBeamsNoiseIntensity: Number(event.target.value) })}
              aria-label="React Bits Beams noise"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Scale ({settings.reactBitsBeamsScale.toFixed(2)})</span>
            <input
              type="range"
              min="0.02"
              max="1.5"
              step="0.01"
              value={settings.reactBitsBeamsScale}
              onChange={(event) => onSettingsChange({ reactBitsBeamsScale: Number(event.target.value) })}
              aria-label="React Bits Beams scale"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Rotation ({settings.reactBitsBeamsRotation.toFixed(0)}deg)</span>
            <input
              type="range"
              min="-180"
              max="180"
              step="1"
              value={settings.reactBitsBeamsRotation}
              onChange={(event) => onSettingsChange({ reactBitsBeamsRotation: Number(event.target.value) })}
              aria-label="React Bits Beams rotation"
            />
          </label>
        </div>
      )
    }

    if (option.id === "react-bits-pixel-snow") {
      const useCustomPixelSnow = settings.reactBitsPixelSnowPaletteMode === "custom"
      const useHarmonyPixelSnow = settings.reactBitsPixelSnowPaletteMode === "harmony"

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.reactBitsPixelSnowPaletteMode}
              onChange={(event) => onSettingsChange({
                reactBitsPixelSnowPaletteMode: event.target.value as ReactBitsPixelSnowPaletteMode,
              })}
              aria-label="React Bits Pixel Snow color mode"
            >
              <option value="source">Source white snow</option>
              <option value="custom">Custom snow color</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {useCustomPixelSnow ? (
            <label className={styles.colorRow}>
              <span>Snow color</span>
              <input
                type="color"
                value={settings.reactBitsPixelSnowColor}
                onChange={(event) => onSettingsChange({ reactBitsPixelSnowColor: event.target.value })}
                aria-label="React Bits Pixel Snow color"
              />
            </label>
          ) : null}

          {useHarmonyPixelSnow ? (
            <>
              <label className={styles.colorRow}>
                <span>Primary color</span>
                <input
                  type="color"
                  value={settings.reactBitsPixelSnowPrimaryColor}
                  onChange={(event) => onSettingsChange({ reactBitsPixelSnowPrimaryColor: event.target.value })}
                  aria-label="React Bits Pixel Snow primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={settings.reactBitsPixelSnowHarmony}
                  onChange={(event) => onSettingsChange({
                    reactBitsPixelSnowHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="React Bits Pixel Snow color harmony"
                >
                  {COLOR_HARMONY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}

          <label className={styles.selectRow}>
            <span>Variant</span>
            <select
              value={settings.reactBitsPixelSnowVariant}
              onChange={(event) => onSettingsChange({
                reactBitsPixelSnowVariant: event.target.value as ReactBitsPixelSnowVariant,
              })}
              aria-label="React Bits Pixel Snow variant"
            >
              <option value="square">Square</option>
              <option value="round">Round</option>
              <option value="snowflake">Snowflake</option>
            </select>
          </label>

          <label className={styles.rangeRow}>
            <span>Flake size ({settings.reactBitsPixelSnowFlakeSize.toFixed(3)})</span>
            <input
              type="range"
              min="0.001"
              max="0.08"
              step="0.001"
              value={settings.reactBitsPixelSnowFlakeSize}
              onChange={(event) => onSettingsChange({ reactBitsPixelSnowFlakeSize: Number(event.target.value) })}
              aria-label="React Bits Pixel Snow flake size"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Minimum flake ({settings.reactBitsPixelSnowMinFlakeSize.toFixed(2)})</span>
            <input
              type="range"
              min="0.1"
              max="6"
              step="0.05"
              value={settings.reactBitsPixelSnowMinFlakeSize}
              onChange={(event) => onSettingsChange({ reactBitsPixelSnowMinFlakeSize: Number(event.target.value) })}
              aria-label="React Bits Pixel Snow minimum flake size"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Pixel resolution ({settings.reactBitsPixelSnowPixelResolution.toFixed(0)})</span>
            <input
              type="range"
              min="40"
              max="640"
              step="10"
              value={settings.reactBitsPixelSnowPixelResolution}
              onChange={(event) => onSettingsChange({ reactBitsPixelSnowPixelResolution: Number(event.target.value) })}
              aria-label="React Bits Pixel Snow pixel resolution"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Speed ({settings.reactBitsPixelSnowSpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0"
              max="5"
              step="0.05"
              value={settings.reactBitsPixelSnowSpeed}
              onChange={(event) => onSettingsChange({ reactBitsPixelSnowSpeed: Number(event.target.value) })}
              aria-label="React Bits Pixel Snow speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Depth fade ({settings.reactBitsPixelSnowDepthFade.toFixed(1)})</span>
            <input
              type="range"
              min="1"
              max="40"
              step="0.5"
              value={settings.reactBitsPixelSnowDepthFade}
              onChange={(event) => onSettingsChange({ reactBitsPixelSnowDepthFade: Number(event.target.value) })}
              aria-label="React Bits Pixel Snow depth fade"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Far plane ({settings.reactBitsPixelSnowFarPlane.toFixed(0)})</span>
            <input
              type="range"
              min="4"
              max="80"
              step="1"
              value={settings.reactBitsPixelSnowFarPlane}
              onChange={(event) => onSettingsChange({ reactBitsPixelSnowFarPlane: Number(event.target.value) })}
              aria-label="React Bits Pixel Snow far plane"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Brightness ({settings.reactBitsPixelSnowBrightness.toFixed(2)})</span>
            <input
              type="range"
              min="0.1"
              max="4"
              step="0.05"
              value={settings.reactBitsPixelSnowBrightness}
              onChange={(event) => onSettingsChange({ reactBitsPixelSnowBrightness: Number(event.target.value) })}
              aria-label="React Bits Pixel Snow brightness"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Gamma ({settings.reactBitsPixelSnowGamma.toFixed(3)})</span>
            <input
              type="range"
              min="0.1"
              max="2"
              step="0.01"
              value={settings.reactBitsPixelSnowGamma}
              onChange={(event) => onSettingsChange({ reactBitsPixelSnowGamma: Number(event.target.value) })}
              aria-label="React Bits Pixel Snow gamma"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Density ({settings.reactBitsPixelSnowDensity.toFixed(2)})</span>
            <input
              type="range"
              min="0.02"
              max="1"
              step="0.01"
              value={settings.reactBitsPixelSnowDensity}
              onChange={(event) => onSettingsChange({ reactBitsPixelSnowDensity: Number(event.target.value) })}
              aria-label="React Bits Pixel Snow density"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Direction ({settings.reactBitsPixelSnowDirection.toFixed(0)}deg)</span>
            <input
              type="range"
              min="0"
              max="360"
              step="1"
              value={settings.reactBitsPixelSnowDirection}
              onChange={(event) => onSettingsChange({ reactBitsPixelSnowDirection: Number(event.target.value) })}
              aria-label="React Bits Pixel Snow direction"
            />
          </label>
        </div>
      )
    }

    if (option.id === "react-bits-lightning") {
      const useSourceLightning = settings.reactBitsLightningPaletteMode === "source"
      const useCustomLightning = settings.reactBitsLightningPaletteMode === "custom"
      const useHarmonyLightning = settings.reactBitsLightningPaletteMode === "harmony"

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.reactBitsLightningPaletteMode}
              onChange={(event) => onSettingsChange({
                reactBitsLightningPaletteMode: event.target.value as ReactBitsLightningPaletteMode,
              })}
              aria-label="React Bits Lightning color mode"
            >
              <option value="source">Source hue</option>
              <option value="custom">Custom color</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {useSourceLightning ? (
            <label className={styles.rangeRow}>
              <span>Hue ({settings.reactBitsLightningHue.toFixed(0)}deg)</span>
              <input
                type="range"
                min="0"
                max="360"
                step="1"
                value={settings.reactBitsLightningHue}
                onChange={(event) => onSettingsChange({ reactBitsLightningHue: Number(event.target.value) })}
                aria-label="React Bits Lightning hue"
              />
            </label>
          ) : null}

          {useCustomLightning ? (
            <label className={styles.colorRow}>
              <span>Lightning color</span>
              <input
                type="color"
                value={settings.reactBitsLightningColor}
                onChange={(event) => onSettingsChange({ reactBitsLightningColor: event.target.value })}
                aria-label="React Bits Lightning color"
              />
            </label>
          ) : null}

          {useHarmonyLightning ? (
            <>
              <label className={styles.colorRow}>
                <span>Primary color</span>
                <input
                  type="color"
                  value={settings.reactBitsLightningPrimaryColor}
                  onChange={(event) => onSettingsChange({ reactBitsLightningPrimaryColor: event.target.value })}
                  aria-label="React Bits Lightning primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={settings.reactBitsLightningHarmony}
                  onChange={(event) => onSettingsChange({
                    reactBitsLightningHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="React Bits Lightning color harmony"
                >
                  {COLOR_HARMONY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}

          <label className={styles.rangeRow}>
            <span>X offset ({settings.reactBitsLightningXOffset.toFixed(2)})</span>
            <input
              type="range"
              min="-2"
              max="2"
              step="0.05"
              value={settings.reactBitsLightningXOffset}
              onChange={(event) => onSettingsChange({ reactBitsLightningXOffset: Number(event.target.value) })}
              aria-label="React Bits Lightning X offset"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Speed ({settings.reactBitsLightningSpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0"
              max="5"
              step="0.05"
              value={settings.reactBitsLightningSpeed}
              onChange={(event) => onSettingsChange({ reactBitsLightningSpeed: Number(event.target.value) })}
              aria-label="React Bits Lightning speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Intensity ({settings.reactBitsLightningIntensity.toFixed(2)})</span>
            <input
              type="range"
              min="0.1"
              max="5"
              step="0.05"
              value={settings.reactBitsLightningIntensity}
              onChange={(event) => onSettingsChange({ reactBitsLightningIntensity: Number(event.target.value) })}
              aria-label="React Bits Lightning intensity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Size ({settings.reactBitsLightningSize.toFixed(2)})</span>
            <input
              type="range"
              min="0.2"
              max="5"
              step="0.05"
              value={settings.reactBitsLightningSize}
              onChange={(event) => onSettingsChange({ reactBitsLightningSize: Number(event.target.value) })}
              aria-label="React Bits Lightning size"
            />
          </label>
        </div>
      )
    }

    if (option.id === "react-bits-prismatic-burst") {
      const useCustomPrismatic = settings.reactBitsPrismaticBurstPaletteMode === "custom"
      const useHarmonyPrismatic = settings.reactBitsPrismaticBurstPaletteMode === "harmony"

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.reactBitsPrismaticBurstPaletteMode}
              onChange={(event) => onSettingsChange({
                reactBitsPrismaticBurstPaletteMode: event.target.value as ReactBitsPrismaticBurstPaletteMode,
              })}
              aria-label="React Bits Prismatic Burst color mode"
            >
              <option value="source">Source spectrum</option>
              <option value="custom">Custom gradient</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {useCustomPrismatic ? (
            <>
              <label className={styles.colorRow}>
                <span>Color 1</span>
                <input
                  type="color"
                  value={settings.reactBitsPrismaticBurstColorOne}
                  onChange={(event) => onSettingsChange({ reactBitsPrismaticBurstColorOne: event.target.value })}
                  aria-label="React Bits Prismatic Burst color 1"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Color 2</span>
                <input
                  type="color"
                  value={settings.reactBitsPrismaticBurstColorTwo}
                  onChange={(event) => onSettingsChange({ reactBitsPrismaticBurstColorTwo: event.target.value })}
                  aria-label="React Bits Prismatic Burst color 2"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Color 3</span>
                <input
                  type="color"
                  value={settings.reactBitsPrismaticBurstColorThree}
                  onChange={(event) => onSettingsChange({ reactBitsPrismaticBurstColorThree: event.target.value })}
                  aria-label="React Bits Prismatic Burst color 3"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Color 4</span>
                <input
                  type="color"
                  value={settings.reactBitsPrismaticBurstColorFour}
                  onChange={(event) => onSettingsChange({ reactBitsPrismaticBurstColorFour: event.target.value })}
                  aria-label="React Bits Prismatic Burst color 4"
                />
              </label>
            </>
          ) : null}

          {useHarmonyPrismatic ? (
            <>
              <label className={styles.colorRow}>
                <span>Primary color</span>
                <input
                  type="color"
                  value={settings.reactBitsPrismaticBurstPrimaryColor}
                  onChange={(event) => onSettingsChange({ reactBitsPrismaticBurstPrimaryColor: event.target.value })}
                  aria-label="React Bits Prismatic Burst primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={settings.reactBitsPrismaticBurstHarmony}
                  onChange={(event) => onSettingsChange({
                    reactBitsPrismaticBurstHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="React Bits Prismatic Burst color harmony"
                >
                  {COLOR_HARMONY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}

          <label className={styles.selectRow}>
            <span>Animation</span>
            <select
              value={settings.reactBitsPrismaticBurstAnimationType}
              onChange={(event) => onSettingsChange({
                reactBitsPrismaticBurstAnimationType: event.target.value as ReactBitsPrismaticBurstAnimationType,
              })}
              aria-label="React Bits Prismatic Burst animation"
            >
              <option value="rotate3d">Rotate 3D</option>
              <option value="rotate">Rotate</option>
              <option value="hover">Cursor hover</option>
            </select>
          </label>

          <label className={styles.selectRow}>
            <span>Blend</span>
            <select
              value={settings.reactBitsPrismaticBurstMixBlendMode}
              onChange={(event) => onSettingsChange({
                reactBitsPrismaticBurstMixBlendMode: event.target.value as ReactBitsPrismaticBurstMixBlendMode,
              })}
              aria-label="React Bits Prismatic Burst blend mode"
            >
              <option value="lighten">Lighten</option>
              <option value="screen">Screen</option>
              <option value="none">None</option>
            </select>
          </label>

          <label className={styles.rangeRow}>
            <span>Intensity ({settings.reactBitsPrismaticBurstIntensity.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="5"
              step="0.05"
              value={settings.reactBitsPrismaticBurstIntensity}
              onChange={(event) => onSettingsChange({ reactBitsPrismaticBurstIntensity: Number(event.target.value) })}
              aria-label="React Bits Prismatic Burst intensity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Speed ({settings.reactBitsPrismaticBurstSpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={settings.reactBitsPrismaticBurstSpeed}
              onChange={(event) => onSettingsChange({ reactBitsPrismaticBurstSpeed: Number(event.target.value) })}
              aria-label="React Bits Prismatic Burst speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Distortion ({settings.reactBitsPrismaticBurstDistort.toFixed(1)})</span>
            <input
              type="range"
              min="0"
              max="50"
              step="0.5"
              value={settings.reactBitsPrismaticBurstDistort}
              onChange={(event) => onSettingsChange({ reactBitsPrismaticBurstDistort: Number(event.target.value) })}
              aria-label="React Bits Prismatic Burst distortion"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Offset X ({settings.reactBitsPrismaticBurstOffsetX.toFixed(0)}px)</span>
            <input
              type="range"
              min="-1000"
              max="1000"
              step="10"
              value={settings.reactBitsPrismaticBurstOffsetX}
              onChange={(event) => onSettingsChange({ reactBitsPrismaticBurstOffsetX: Number(event.target.value) })}
              aria-label="React Bits Prismatic Burst offset X"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Offset Y ({settings.reactBitsPrismaticBurstOffsetY.toFixed(0)}px)</span>
            <input
              type="range"
              min="-1000"
              max="1000"
              step="10"
              value={settings.reactBitsPrismaticBurstOffsetY}
              onChange={(event) => onSettingsChange({ reactBitsPrismaticBurstOffsetY: Number(event.target.value) })}
              aria-label="React Bits Prismatic Burst offset Y"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Hover damping ({settings.reactBitsPrismaticBurstHoverDampness.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.reactBitsPrismaticBurstHoverDampness}
              onChange={(event) => onSettingsChange({
                reactBitsPrismaticBurstHoverDampness: Number(event.target.value),
              })}
              aria-label="React Bits Prismatic Burst hover damping"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Ray count ({settings.reactBitsPrismaticBurstRayCount.toFixed(0)})</span>
            <input
              type="range"
              min="0"
              max="64"
              step="1"
              value={settings.reactBitsPrismaticBurstRayCount}
              onChange={(event) => onSettingsChange({ reactBitsPrismaticBurstRayCount: Number(event.target.value) })}
              aria-label="React Bits Prismatic Burst ray count"
            />
          </label>
        </div>
      )
    }

    if (option.id === "react-bits-galaxy") {
      const useSourceGalaxy = settings.reactBitsGalaxyPaletteMode === "source"
      const useCustomGalaxy = settings.reactBitsGalaxyPaletteMode === "custom"
      const useHarmonyGalaxy = settings.reactBitsGalaxyPaletteMode === "harmony"

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.reactBitsGalaxyPaletteMode}
              onChange={(event) => onSettingsChange({
                reactBitsGalaxyPaletteMode: event.target.value as ReactBitsGalaxyPaletteMode,
              })}
              aria-label="React Bits Galaxy color mode"
            >
              <option value="source">Source hue shift</option>
              <option value="custom">Custom color</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {useSourceGalaxy ? (
            <label className={styles.rangeRow}>
              <span>Hue shift ({settings.reactBitsGalaxyHueShift.toFixed(0)}deg)</span>
              <input
                type="range"
                min="0"
                max="360"
                step="1"
                value={settings.reactBitsGalaxyHueShift}
                onChange={(event) => onSettingsChange({ reactBitsGalaxyHueShift: Number(event.target.value) })}
                aria-label="React Bits Galaxy hue shift"
              />
            </label>
          ) : null}

          {useCustomGalaxy ? (
            <label className={styles.colorRow}>
              <span>Galaxy color</span>
              <input
                type="color"
                value={settings.reactBitsGalaxyColor}
                onChange={(event) => onSettingsChange({ reactBitsGalaxyColor: event.target.value })}
                aria-label="React Bits Galaxy color"
              />
            </label>
          ) : null}

          {useHarmonyGalaxy ? (
            <>
              <label className={styles.colorRow}>
                <span>Primary color</span>
                <input
                  type="color"
                  value={settings.reactBitsGalaxyPrimaryColor}
                  onChange={(event) => onSettingsChange({ reactBitsGalaxyPrimaryColor: event.target.value })}
                  aria-label="React Bits Galaxy primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={settings.reactBitsGalaxyHarmony}
                  onChange={(event) => onSettingsChange({
                    reactBitsGalaxyHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="React Bits Galaxy color harmony"
                >
                  {COLOR_HARMONY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}

          <label className={styles.selectRow}>
            <input
              type="checkbox"
              checked={settings.reactBitsGalaxyTransparent}
              onChange={(event) => onSettingsChange({ reactBitsGalaxyTransparent: event.target.checked })}
              aria-label="React Bits Galaxy transparent background"
            />
            <span>Transparent background</span>
          </label>

          <label className={styles.selectRow}>
            <input
              type="checkbox"
              checked={settings.reactBitsGalaxyMouseInteraction}
              onChange={(event) => onSettingsChange({ reactBitsGalaxyMouseInteraction: event.target.checked })}
              aria-label="React Bits Galaxy cursor interaction"
            />
            <span>Cursor interaction</span>
          </label>

          <label className={styles.selectRow}>
            <input
              type="checkbox"
              checked={settings.reactBitsGalaxyMouseRepulsion}
              onChange={(event) => onSettingsChange({ reactBitsGalaxyMouseRepulsion: event.target.checked })}
              aria-label="React Bits Galaxy cursor repulsion"
            />
            <span>Cursor repulsion</span>
          </label>

          <label className={styles.rangeRow}>
            <span>Focal X ({settings.reactBitsGalaxyFocalX.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.reactBitsGalaxyFocalX}
              onChange={(event) => onSettingsChange({ reactBitsGalaxyFocalX: Number(event.target.value) })}
              aria-label="React Bits Galaxy focal X"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Focal Y ({settings.reactBitsGalaxyFocalY.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.reactBitsGalaxyFocalY}
              onChange={(event) => onSettingsChange({ reactBitsGalaxyFocalY: Number(event.target.value) })}
              aria-label="React Bits Galaxy focal Y"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Rotation ({settings.reactBitsGalaxyRotationDeg.toFixed(0)}deg)</span>
            <input
              type="range"
              min="-360"
              max="360"
              step="1"
              value={settings.reactBitsGalaxyRotationDeg}
              onChange={(event) => onSettingsChange({ reactBitsGalaxyRotationDeg: Number(event.target.value) })}
              aria-label="React Bits Galaxy rotation"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Star speed ({settings.reactBitsGalaxyStarSpeed.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="5"
              step="0.05"
              value={settings.reactBitsGalaxyStarSpeed}
              onChange={(event) => onSettingsChange({ reactBitsGalaxyStarSpeed: Number(event.target.value) })}
              aria-label="React Bits Galaxy star speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Density ({settings.reactBitsGalaxyDensity.toFixed(2)})</span>
            <input
              type="range"
              min="0.1"
              max="3"
              step="0.05"
              value={settings.reactBitsGalaxyDensity}
              onChange={(event) => onSettingsChange({ reactBitsGalaxyDensity: Number(event.target.value) })}
              aria-label="React Bits Galaxy density"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Speed ({settings.reactBitsGalaxySpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0"
              max="5"
              step="0.05"
              value={settings.reactBitsGalaxySpeed}
              onChange={(event) => onSettingsChange({ reactBitsGalaxySpeed: Number(event.target.value) })}
              aria-label="React Bits Galaxy speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Glow ({settings.reactBitsGalaxyGlowIntensity.toFixed(2)})</span>
            <input
              type="range"
              min="0.01"
              max="2"
              step="0.01"
              value={settings.reactBitsGalaxyGlowIntensity}
              onChange={(event) => onSettingsChange({ reactBitsGalaxyGlowIntensity: Number(event.target.value) })}
              aria-label="React Bits Galaxy glow intensity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Saturation ({settings.reactBitsGalaxySaturation.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.01"
              value={settings.reactBitsGalaxySaturation}
              onChange={(event) => onSettingsChange({ reactBitsGalaxySaturation: Number(event.target.value) })}
              aria-label="React Bits Galaxy saturation"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Twinkle ({settings.reactBitsGalaxyTwinkleIntensity.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.reactBitsGalaxyTwinkleIntensity}
              onChange={(event) => onSettingsChange({ reactBitsGalaxyTwinkleIntensity: Number(event.target.value) })}
              aria-label="React Bits Galaxy twinkle intensity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Rotation speed ({settings.reactBitsGalaxyRotationSpeed.toFixed(2)})</span>
            <input
              type="range"
              min="-2"
              max="2"
              step="0.01"
              value={settings.reactBitsGalaxyRotationSpeed}
              onChange={(event) => onSettingsChange({ reactBitsGalaxyRotationSpeed: Number(event.target.value) })}
              aria-label="React Bits Galaxy rotation speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Repulsion ({settings.reactBitsGalaxyRepulsionStrength.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="6"
              step="0.05"
              value={settings.reactBitsGalaxyRepulsionStrength}
              onChange={(event) => onSettingsChange({ reactBitsGalaxyRepulsionStrength: Number(event.target.value) })}
              aria-label="React Bits Galaxy repulsion strength"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Center repulsion ({settings.reactBitsGalaxyAutoCenterRepulsion.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="6"
              step="0.05"
              value={settings.reactBitsGalaxyAutoCenterRepulsion}
              onChange={(event) => onSettingsChange({
                reactBitsGalaxyAutoCenterRepulsion: Number(event.target.value),
              })}
              aria-label="React Bits Galaxy center repulsion"
            />
          </label>
        </div>
      )
    }

    if (option.id === "react-bits-dither") {
      const useCustomDither = settings.reactBitsDitherPaletteMode === "custom"
      const useHarmonyDither = settings.reactBitsDitherPaletteMode === "harmony"

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.reactBitsDitherPaletteMode}
              onChange={(event) => onSettingsChange({
                reactBitsDitherPaletteMode: event.target.value as ReactBitsDitherPaletteMode,
              })}
              aria-label="React Bits Dither color mode"
            >
              <option value="source">Source grey</option>
              <option value="custom">Custom color</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {useCustomDither ? (
            <label className={styles.colorRow}>
              <span>Dither color</span>
              <input
                type="color"
                value={settings.reactBitsDitherColor}
                onChange={(event) => onSettingsChange({ reactBitsDitherColor: event.target.value })}
                aria-label="React Bits Dither color"
              />
            </label>
          ) : null}

          {useHarmonyDither ? (
            <>
              <label className={styles.colorRow}>
                <span>Primary color</span>
                <input
                  type="color"
                  value={settings.reactBitsDitherPrimaryColor}
                  onChange={(event) => onSettingsChange({ reactBitsDitherPrimaryColor: event.target.value })}
                  aria-label="React Bits Dither primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={settings.reactBitsDitherHarmony}
                  onChange={(event) => onSettingsChange({
                    reactBitsDitherHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="React Bits Dither color harmony"
                >
                  <option value="monochromatic">Monochromatic</option>
                  <option value="analogous">Analogous</option>
                  <option value="complementary">Complementary</option>
                  <option value="triad">Triad</option>
                </select>
              </label>
            </>
          ) : null}

          <label className={styles.selectRow}>
            <input
              type="checkbox"
              checked={settings.reactBitsDitherMouseInteraction}
              onChange={(event) => onSettingsChange({ reactBitsDitherMouseInteraction: event.target.checked })}
              aria-label="React Bits Dither cursor interaction"
            />
            <span>Cursor interaction</span>
          </label>

          <label className={styles.rangeRow}>
            <span>Wave speed ({settings.reactBitsDitherWaveSpeed.toFixed(3)})</span>
            <input
              type="range"
              min="0"
              max="0.5"
              step="0.005"
              value={settings.reactBitsDitherWaveSpeed}
              onChange={(event) => onSettingsChange({ reactBitsDitherWaveSpeed: Number(event.target.value) })}
              aria-label="React Bits Dither wave speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Wave frequency ({settings.reactBitsDitherWaveFrequency.toFixed(1)})</span>
            <input
              type="range"
              min="0.5"
              max="8"
              step="0.1"
              value={settings.reactBitsDitherWaveFrequency}
              onChange={(event) => onSettingsChange({ reactBitsDitherWaveFrequency: Number(event.target.value) })}
              aria-label="React Bits Dither wave frequency"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Wave amplitude ({settings.reactBitsDitherWaveAmplitude.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.reactBitsDitherWaveAmplitude}
              onChange={(event) => onSettingsChange({ reactBitsDitherWaveAmplitude: Number(event.target.value) })}
              aria-label="React Bits Dither wave amplitude"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Color count ({settings.reactBitsDitherColorNum})</span>
            <input
              type="range"
              min="2"
              max="16"
              step="1"
              value={settings.reactBitsDitherColorNum}
              onChange={(event) => onSettingsChange({ reactBitsDitherColorNum: Number(event.target.value) })}
              aria-label="React Bits Dither color count"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Pixel size ({settings.reactBitsDitherPixelSize}px)</span>
            <input
              type="range"
              min="1"
              max="24"
              step="1"
              value={settings.reactBitsDitherPixelSize}
              onChange={(event) => onSettingsChange({ reactBitsDitherPixelSize: Number(event.target.value) })}
              aria-label="React Bits Dither pixel size"
            />
          </label>

          {settings.reactBitsDitherMouseInteraction ? (
            <label className={styles.rangeRow}>
              <span>Cursor radius ({settings.reactBitsDitherMouseRadius.toFixed(2)})</span>
              <input
                type="range"
                min="0.05"
                max="3"
                step="0.05"
                value={settings.reactBitsDitherMouseRadius}
                onChange={(event) => onSettingsChange({ reactBitsDitherMouseRadius: Number(event.target.value) })}
                aria-label="React Bits Dither cursor radius"
              />
            </label>
          ) : null}
        </div>
      )
    }

    if (option.id === "react-bits-faulty-terminal") {
      const useCustomFaultyTerminal = settings.reactBitsFaultyTerminalPaletteMode === "custom"
      const useHarmonyFaultyTerminal = settings.reactBitsFaultyTerminalPaletteMode === "harmony"

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Tint mode</span>
            <select
              value={settings.reactBitsFaultyTerminalPaletteMode}
              onChange={(event) => onSettingsChange({
                reactBitsFaultyTerminalPaletteMode: event.target.value as ReactBitsFaultyTerminalPaletteMode,
              })}
              aria-label="React Bits Faulty Terminal tint mode"
            >
              <option value="source">Source white</option>
              <option value="custom">Custom tint</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {useCustomFaultyTerminal ? (
            <label className={styles.colorRow}>
              <span>Terminal tint</span>
              <input
                type="color"
                value={settings.reactBitsFaultyTerminalTint}
                onChange={(event) => onSettingsChange({ reactBitsFaultyTerminalTint: event.target.value })}
                aria-label="React Bits Faulty Terminal tint"
              />
            </label>
          ) : null}

          {useHarmonyFaultyTerminal ? (
            <>
              <label className={styles.colorRow}>
                <span>Primary color</span>
                <input
                  type="color"
                  value={settings.reactBitsFaultyTerminalPrimaryColor}
                  onChange={(event) => onSettingsChange({ reactBitsFaultyTerminalPrimaryColor: event.target.value })}
                  aria-label="React Bits Faulty Terminal primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={settings.reactBitsFaultyTerminalHarmony}
                  onChange={(event) => onSettingsChange({
                    reactBitsFaultyTerminalHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="React Bits Faulty Terminal color harmony"
                >
                  <option value="monochromatic">Monochromatic</option>
                  <option value="analogous">Analogous</option>
                  <option value="complementary">Complementary</option>
                  <option value="triad">Triad</option>
                </select>
              </label>
            </>
          ) : null}

          <label className={styles.selectRow}>
            <input
              type="checkbox"
              checked={settings.reactBitsFaultyTerminalMouseReact}
              onChange={(event) => onSettingsChange({ reactBitsFaultyTerminalMouseReact: event.target.checked })}
              aria-label="React Bits Faulty Terminal cursor reaction"
            />
            <span>Cursor reaction</span>
          </label>

          <label className={styles.selectRow}>
            <input
              type="checkbox"
              checked={settings.reactBitsFaultyTerminalPageLoadAnimation}
              onChange={(event) => onSettingsChange({
                reactBitsFaultyTerminalPageLoadAnimation: event.target.checked,
              })}
              aria-label="React Bits Faulty Terminal page-load animation"
            />
            <span>Page-load animation</span>
          </label>

          <label className={styles.rangeRow}>
            <span>Scale ({settings.reactBitsFaultyTerminalScale.toFixed(2)})</span>
            <input
              type="range"
              min="0.25"
              max="4"
              step="0.05"
              value={settings.reactBitsFaultyTerminalScale}
              onChange={(event) => onSettingsChange({ reactBitsFaultyTerminalScale: Number(event.target.value) })}
              aria-label="React Bits Faulty Terminal scale"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Grid X ({settings.reactBitsFaultyTerminalGridMulX.toFixed(2)})</span>
            <input
              type="range"
              min="0.25"
              max="6"
              step="0.05"
              value={settings.reactBitsFaultyTerminalGridMulX}
              onChange={(event) => onSettingsChange({ reactBitsFaultyTerminalGridMulX: Number(event.target.value) })}
              aria-label="React Bits Faulty Terminal grid X multiplier"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Grid Y ({settings.reactBitsFaultyTerminalGridMulY.toFixed(2)})</span>
            <input
              type="range"
              min="0.25"
              max="6"
              step="0.05"
              value={settings.reactBitsFaultyTerminalGridMulY}
              onChange={(event) => onSettingsChange({ reactBitsFaultyTerminalGridMulY: Number(event.target.value) })}
              aria-label="React Bits Faulty Terminal grid Y multiplier"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Digit size ({settings.reactBitsFaultyTerminalDigitSize.toFixed(2)})</span>
            <input
              type="range"
              min="0.5"
              max="4"
              step="0.05"
              value={settings.reactBitsFaultyTerminalDigitSize}
              onChange={(event) => onSettingsChange({ reactBitsFaultyTerminalDigitSize: Number(event.target.value) })}
              aria-label="React Bits Faulty Terminal digit size"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Time scale ({settings.reactBitsFaultyTerminalTimeScale.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.01"
              value={settings.reactBitsFaultyTerminalTimeScale}
              onChange={(event) => onSettingsChange({ reactBitsFaultyTerminalTimeScale: Number(event.target.value) })}
              aria-label="React Bits Faulty Terminal time scale"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Scanlines ({settings.reactBitsFaultyTerminalScanlineIntensity.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.01"
              value={settings.reactBitsFaultyTerminalScanlineIntensity}
              onChange={(event) => onSettingsChange({
                reactBitsFaultyTerminalScanlineIntensity: Number(event.target.value),
              })}
              aria-label="React Bits Faulty Terminal scanline intensity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Glitch ({settings.reactBitsFaultyTerminalGlitchAmount.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.01"
              value={settings.reactBitsFaultyTerminalGlitchAmount}
              onChange={(event) => onSettingsChange({ reactBitsFaultyTerminalGlitchAmount: Number(event.target.value) })}
              aria-label="React Bits Faulty Terminal glitch amount"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Flicker ({settings.reactBitsFaultyTerminalFlickerAmount.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.01"
              value={settings.reactBitsFaultyTerminalFlickerAmount}
              onChange={(event) => onSettingsChange({
                reactBitsFaultyTerminalFlickerAmount: Number(event.target.value),
              })}
              aria-label="React Bits Faulty Terminal flicker amount"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Noise ({settings.reactBitsFaultyTerminalNoiseAmp.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.01"
              value={settings.reactBitsFaultyTerminalNoiseAmp}
              onChange={(event) => onSettingsChange({ reactBitsFaultyTerminalNoiseAmp: Number(event.target.value) })}
              aria-label="React Bits Faulty Terminal noise amplitude"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Chromatic ({settings.reactBitsFaultyTerminalChromaticAberration.toFixed(1)})</span>
            <input
              type="range"
              min="0"
              max="8"
              step="0.1"
              value={settings.reactBitsFaultyTerminalChromaticAberration}
              onChange={(event) => onSettingsChange({
                reactBitsFaultyTerminalChromaticAberration: Number(event.target.value),
              })}
              aria-label="React Bits Faulty Terminal chromatic aberration"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Dither ({settings.reactBitsFaultyTerminalDither.toFixed(0)})</span>
            <input
              type="range"
              min="0"
              max="255"
              step="1"
              value={settings.reactBitsFaultyTerminalDither}
              onChange={(event) => onSettingsChange({ reactBitsFaultyTerminalDither: Number(event.target.value) })}
              aria-label="React Bits Faulty Terminal dither"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Curvature ({settings.reactBitsFaultyTerminalCurvature.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.reactBitsFaultyTerminalCurvature}
              onChange={(event) => onSettingsChange({ reactBitsFaultyTerminalCurvature: Number(event.target.value) })}
              aria-label="React Bits Faulty Terminal curvature"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Brightness ({settings.reactBitsFaultyTerminalBrightness.toFixed(2)})</span>
            <input
              type="range"
              min="0.1"
              max="3"
              step="0.01"
              value={settings.reactBitsFaultyTerminalBrightness}
              onChange={(event) => onSettingsChange({ reactBitsFaultyTerminalBrightness: Number(event.target.value) })}
              aria-label="React Bits Faulty Terminal brightness"
            />
          </label>

          {settings.reactBitsFaultyTerminalMouseReact ? (
            <label className={styles.rangeRow}>
              <span>Cursor strength ({settings.reactBitsFaultyTerminalMouseStrength.toFixed(2)})</span>
              <input
                type="range"
                min="0"
                max="2"
                step="0.01"
                value={settings.reactBitsFaultyTerminalMouseStrength}
                onChange={(event) => onSettingsChange({
                  reactBitsFaultyTerminalMouseStrength: Number(event.target.value),
                })}
                aria-label="React Bits Faulty Terminal cursor strength"
              />
            </label>
          ) : null}
        </div>
      )
    }

    if (option.id === "react-bits-ripple-grid") {
      const useCustomRippleGrid = settings.reactBitsRippleGridPaletteMode === "custom"
      const useHarmonyRippleGrid = settings.reactBitsRippleGridPaletteMode === "harmony"

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.reactBitsRippleGridPaletteMode}
              onChange={(event) => onSettingsChange({
                reactBitsRippleGridPaletteMode: event.target.value as ReactBitsRippleGridPaletteMode,
              })}
              aria-label="React Bits Ripple Grid color mode"
            >
              <option value="source">Source white</option>
              <option value="rainbow">Source rainbow</option>
              <option value="custom">Custom color</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {useCustomRippleGrid ? (
            <label className={styles.colorRow}>
              <span>Grid color</span>
              <input
                type="color"
                value={settings.reactBitsRippleGridColor}
                onChange={(event) => onSettingsChange({ reactBitsRippleGridColor: event.target.value })}
                aria-label="React Bits Ripple Grid color"
              />
            </label>
          ) : null}

          {useHarmonyRippleGrid ? (
            <>
              <label className={styles.colorRow}>
                <span>Primary color</span>
                <input
                  type="color"
                  value={settings.reactBitsRippleGridPrimaryColor}
                  onChange={(event) => onSettingsChange({ reactBitsRippleGridPrimaryColor: event.target.value })}
                  aria-label="React Bits Ripple Grid primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={settings.reactBitsRippleGridHarmony}
                  onChange={(event) => onSettingsChange({
                    reactBitsRippleGridHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="React Bits Ripple Grid color harmony"
                >
                  <option value="monochromatic">Monochromatic</option>
                  <option value="analogous">Analogous</option>
                  <option value="complementary">Complementary</option>
                  <option value="triad">Triad</option>
                </select>
              </label>
            </>
          ) : null}

          <label className={styles.selectRow}>
            <input
              type="checkbox"
              checked={settings.reactBitsRippleGridMouseInteraction}
              onChange={(event) => onSettingsChange({ reactBitsRippleGridMouseInteraction: event.target.checked })}
              aria-label="React Bits Ripple Grid cursor interaction"
            />
            <span>Cursor interaction</span>
          </label>

          <label className={styles.rangeRow}>
            <span>Ripple ({settings.reactBitsRippleGridRippleIntensity.toFixed(3)})</span>
            <input
              type="range"
              min="0"
              max="0.3"
              step="0.005"
              value={settings.reactBitsRippleGridRippleIntensity}
              onChange={(event) => onSettingsChange({
                reactBitsRippleGridRippleIntensity: Number(event.target.value),
              })}
              aria-label="React Bits Ripple Grid ripple intensity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Grid size ({settings.reactBitsRippleGridGridSize.toFixed(1)})</span>
            <input
              type="range"
              min="2"
              max="30"
              step="0.5"
              value={settings.reactBitsRippleGridGridSize}
              onChange={(event) => onSettingsChange({ reactBitsRippleGridGridSize: Number(event.target.value) })}
              aria-label="React Bits Ripple Grid size"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Thickness ({settings.reactBitsRippleGridGridThickness.toFixed(1)})</span>
            <input
              type="range"
              min="1"
              max="50"
              step="0.5"
              value={settings.reactBitsRippleGridGridThickness}
              onChange={(event) => onSettingsChange({ reactBitsRippleGridGridThickness: Number(event.target.value) })}
              aria-label="React Bits Ripple Grid thickness"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Fade ({settings.reactBitsRippleGridFadeDistance.toFixed(2)})</span>
            <input
              type="range"
              min="0.2"
              max="5"
              step="0.05"
              value={settings.reactBitsRippleGridFadeDistance}
              onChange={(event) => onSettingsChange({ reactBitsRippleGridFadeDistance: Number(event.target.value) })}
              aria-label="React Bits Ripple Grid fade distance"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Vignette ({settings.reactBitsRippleGridVignetteStrength.toFixed(2)})</span>
            <input
              type="range"
              min="0.1"
              max="6"
              step="0.05"
              value={settings.reactBitsRippleGridVignetteStrength}
              onChange={(event) => onSettingsChange({
                reactBitsRippleGridVignetteStrength: Number(event.target.value),
              })}
              aria-label="React Bits Ripple Grid vignette strength"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Glow ({settings.reactBitsRippleGridGlowIntensity.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.reactBitsRippleGridGlowIntensity}
              onChange={(event) => onSettingsChange({ reactBitsRippleGridGlowIntensity: Number(event.target.value) })}
              aria-label="React Bits Ripple Grid glow intensity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Opacity ({settings.reactBitsRippleGridOpacity.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.reactBitsRippleGridOpacity}
              onChange={(event) => onSettingsChange({ reactBitsRippleGridOpacity: Number(event.target.value) })}
              aria-label="React Bits Ripple Grid opacity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Rotation ({settings.reactBitsRippleGridGridRotation.toFixed(0)}deg)</span>
            <input
              type="range"
              min="-180"
              max="180"
              step="1"
              value={settings.reactBitsRippleGridGridRotation}
              onChange={(event) => onSettingsChange({ reactBitsRippleGridGridRotation: Number(event.target.value) })}
              aria-label="React Bits Ripple Grid rotation"
            />
          </label>

          {settings.reactBitsRippleGridMouseInteraction ? (
            <label className={styles.rangeRow}>
              <span>Cursor radius ({settings.reactBitsRippleGridMouseInteractionRadius.toFixed(2)})</span>
              <input
                type="range"
                min="0.1"
                max="5"
                step="0.05"
                value={settings.reactBitsRippleGridMouseInteractionRadius}
                onChange={(event) => onSettingsChange({
                  reactBitsRippleGridMouseInteractionRadius: Number(event.target.value),
                })}
                aria-label="React Bits Ripple Grid cursor radius"
              />
            </label>
          ) : null}
        </div>
      )
    }

    if (option.id === "react-bits-dot-field") {
      const useCustomDotField = settings.reactBitsDotFieldPaletteMode === "custom"
      const useHarmonyDotField = settings.reactBitsDotFieldPaletteMode === "harmony"

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.reactBitsDotFieldPaletteMode}
              onChange={(event) => onSettingsChange({
                reactBitsDotFieldPaletteMode: event.target.value as ReactBitsDotFieldPaletteMode,
              })}
              aria-label="React Bits Dot Field color mode"
            >
              <option value="source">Source purple</option>
              <option value="custom">Custom colors</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {useCustomDotField ? (
            <>
              <label className={styles.colorRow}>
                <span>Gradient start</span>
                <input
                  type="color"
                  value={settings.reactBitsDotFieldGradientFromColor}
                  onChange={(event) => onSettingsChange({ reactBitsDotFieldGradientFromColor: event.target.value })}
                  aria-label="React Bits Dot Field gradient start color"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Gradient end</span>
                <input
                  type="color"
                  value={settings.reactBitsDotFieldGradientToColor}
                  onChange={(event) => onSettingsChange({ reactBitsDotFieldGradientToColor: event.target.value })}
                  aria-label="React Bits Dot Field gradient end color"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Glow color</span>
                <input
                  type="color"
                  value={settings.reactBitsDotFieldGlowColor}
                  onChange={(event) => onSettingsChange({ reactBitsDotFieldGlowColor: event.target.value })}
                  aria-label="React Bits Dot Field glow color"
                />
              </label>
            </>
          ) : null}

          {useHarmonyDotField ? (
            <>
              <label className={styles.colorRow}>
                <span>Primary color</span>
                <input
                  type="color"
                  value={settings.reactBitsDotFieldPrimaryColor}
                  onChange={(event) => onSettingsChange({ reactBitsDotFieldPrimaryColor: event.target.value })}
                  aria-label="React Bits Dot Field primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={settings.reactBitsDotFieldHarmony}
                  onChange={(event) => onSettingsChange({
                    reactBitsDotFieldHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="React Bits Dot Field color harmony"
                >
                  <option value="monochromatic">Monochromatic</option>
                  <option value="analogous">Analogous</option>
                  <option value="complementary">Complementary</option>
                  <option value="triad">Triad</option>
                </select>
              </label>
            </>
          ) : null}

          {settings.reactBitsDotFieldPaletteMode !== "source" ? (
            <>
              <label className={styles.rangeRow}>
                <span>Start alpha ({settings.reactBitsDotFieldGradientFromAlpha.toFixed(2)})</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={settings.reactBitsDotFieldGradientFromAlpha}
                  onChange={(event) => onSettingsChange({
                    reactBitsDotFieldGradientFromAlpha: Number(event.target.value),
                  })}
                  aria-label="React Bits Dot Field gradient start alpha"
                />
              </label>
              <label className={styles.rangeRow}>
                <span>End alpha ({settings.reactBitsDotFieldGradientToAlpha.toFixed(2)})</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={settings.reactBitsDotFieldGradientToAlpha}
                  onChange={(event) => onSettingsChange({
                    reactBitsDotFieldGradientToAlpha: Number(event.target.value),
                  })}
                  aria-label="React Bits Dot Field gradient end alpha"
                />
              </label>
            </>
          ) : null}

          <label className={styles.switchRow}>
            <span>Cursor interaction</span>
            <input
              type="checkbox"
              checked={settings.reactBitsDotFieldCursorInteraction}
              onChange={(event) => onSettingsChange({ reactBitsDotFieldCursorInteraction: event.target.checked })}
              aria-label="React Bits Dot Field cursor interaction"
            />
          </label>

          <label className={styles.switchRow}>
            <span>Bulge mode</span>
            <input
              type="checkbox"
              checked={settings.reactBitsDotFieldBulgeOnly}
              onChange={(event) => onSettingsChange({ reactBitsDotFieldBulgeOnly: event.target.checked })}
              aria-label="React Bits Dot Field bulge mode"
            />
          </label>

          <label className={styles.switchRow}>
            <span>Sparkle</span>
            <input
              type="checkbox"
              checked={settings.reactBitsDotFieldSparkle}
              onChange={(event) => onSettingsChange({ reactBitsDotFieldSparkle: event.target.checked })}
              aria-label="React Bits Dot Field sparkle"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Dot radius ({settings.reactBitsDotFieldDotRadius.toFixed(1)})</span>
            <input
              type="range"
              min="0.5"
              max="8"
              step="0.1"
              value={settings.reactBitsDotFieldDotRadius}
              onChange={(event) => onSettingsChange({ reactBitsDotFieldDotRadius: Number(event.target.value) })}
              aria-label="React Bits Dot Field dot radius"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Dot spacing ({settings.reactBitsDotFieldDotSpacing.toFixed(1)})</span>
            <input
              type="range"
              min="4"
              max="48"
              step="0.5"
              value={settings.reactBitsDotFieldDotSpacing}
              onChange={(event) => onSettingsChange({ reactBitsDotFieldDotSpacing: Number(event.target.value) })}
              aria-label="React Bits Dot Field dot spacing"
            />
          </label>

          {settings.reactBitsDotFieldCursorInteraction ? (
            <>
              <label className={styles.rangeRow}>
                <span>Cursor radius ({settings.reactBitsDotFieldCursorRadius.toFixed(0)})</span>
                <input
                  type="range"
                  min="60"
                  max="900"
                  step="10"
                  value={settings.reactBitsDotFieldCursorRadius}
                  onChange={(event) => onSettingsChange({ reactBitsDotFieldCursorRadius: Number(event.target.value) })}
                  aria-label="React Bits Dot Field cursor radius"
                />
              </label>
              <label className={styles.rangeRow}>
                <span>Cursor force ({settings.reactBitsDotFieldCursorForce.toFixed(2)})</span>
                <input
                  type="range"
                  min="0.01"
                  max="1"
                  step="0.01"
                  value={settings.reactBitsDotFieldCursorForce}
                  onChange={(event) => onSettingsChange({ reactBitsDotFieldCursorForce: Number(event.target.value) })}
                  aria-label="React Bits Dot Field cursor force"
                />
              </label>
              <label className={styles.rangeRow}>
                <span>Bulge strength ({settings.reactBitsDotFieldBulgeStrength.toFixed(0)})</span>
                <input
                  type="range"
                  min="0"
                  max="160"
                  step="1"
                  value={settings.reactBitsDotFieldBulgeStrength}
                  onChange={(event) => onSettingsChange({ reactBitsDotFieldBulgeStrength: Number(event.target.value) })}
                  aria-label="React Bits Dot Field bulge strength"
                />
              </label>
              <label className={styles.rangeRow}>
                <span>Glow radius ({settings.reactBitsDotFieldGlowRadius.toFixed(0)})</span>
                <input
                  type="range"
                  min="0"
                  max="360"
                  step="4"
                  value={settings.reactBitsDotFieldGlowRadius}
                  onChange={(event) => onSettingsChange({ reactBitsDotFieldGlowRadius: Number(event.target.value) })}
                  aria-label="React Bits Dot Field glow radius"
                />
              </label>
            </>
          ) : null}

          <label className={styles.rangeRow}>
            <span>Wave ({settings.reactBitsDotFieldWaveAmplitude.toFixed(1)})</span>
            <input
              type="range"
              min="0"
              max="48"
              step="0.5"
              value={settings.reactBitsDotFieldWaveAmplitude}
              onChange={(event) => onSettingsChange({ reactBitsDotFieldWaveAmplitude: Number(event.target.value) })}
              aria-label="React Bits Dot Field wave amplitude"
            />
          </label>
        </div>
      )
    }

    if (option.id === "react-bits-dot-grid") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.reactBitsDotGridPaletteMode}
              onChange={(event) => onSettingsChange({
                reactBitsDotGridPaletteMode: event.target.value as ReactBitsDotGridPaletteMode,
              })}
              aria-label="React Bits Dot Grid color mode"
            >
              <option value="source">Source violet</option>
              <option value="custom">Custom colors</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {settings.reactBitsDotGridPaletteMode === "custom" ? (
            <>
              <label className={styles.colorRow}>
                <span>Base color</span>
                <input
                  type="color"
                  value={settings.reactBitsDotGridBaseColor}
                  onChange={(event) => onSettingsChange({ reactBitsDotGridBaseColor: event.target.value })}
                  aria-label="React Bits Dot Grid base color"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Active color</span>
                <input
                  type="color"
                  value={settings.reactBitsDotGridActiveColor}
                  onChange={(event) => onSettingsChange({ reactBitsDotGridActiveColor: event.target.value })}
                  aria-label="React Bits Dot Grid active color"
                />
              </label>
            </>
          ) : null}

          {settings.reactBitsDotGridPaletteMode === "harmony" ? (
            <>
              <label className={styles.colorRow}>
                <span>Primary color</span>
                <input
                  type="color"
                  value={settings.reactBitsDotGridPrimaryColor}
                  onChange={(event) => onSettingsChange({ reactBitsDotGridPrimaryColor: event.target.value })}
                  aria-label="React Bits Dot Grid primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={settings.reactBitsDotGridHarmony}
                  onChange={(event) => onSettingsChange({
                    reactBitsDotGridHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="React Bits Dot Grid color harmony"
                >
                  <option value="monochromatic">Monochromatic</option>
                  <option value="analogous">Analogous</option>
                  <option value="complementary">Complementary</option>
                  <option value="triad">Triad</option>
                </select>
              </label>
            </>
          ) : null}

          <label className={styles.switchRow}>
            <span>Cursor interaction</span>
            <input
              type="checkbox"
              checked={settings.reactBitsDotGridCursorInteraction}
              onChange={(event) => onSettingsChange({ reactBitsDotGridCursorInteraction: event.target.checked })}
              aria-label="React Bits Dot Grid cursor interaction"
            />
          </label>

          <label className={styles.switchRow}>
            <span>Click shock</span>
            <input
              type="checkbox"
              checked={settings.reactBitsDotGridClickShock}
              onChange={(event) => onSettingsChange({ reactBitsDotGridClickShock: event.target.checked })}
              aria-label="React Bits Dot Grid click shock"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Dot size ({settings.reactBitsDotGridDotSize.toFixed(1)})</span>
            <input type="range" min="2" max="40" step="0.5" value={settings.reactBitsDotGridDotSize} onChange={(event) => onSettingsChange({ reactBitsDotGridDotSize: Number(event.target.value) })} aria-label="React Bits Dot Grid dot size" />
          </label>
          <label className={styles.rangeRow}>
            <span>Gap ({settings.reactBitsDotGridGap.toFixed(1)})</span>
            <input type="range" min="4" max="80" step="0.5" value={settings.reactBitsDotGridGap} onChange={(event) => onSettingsChange({ reactBitsDotGridGap: Number(event.target.value) })} aria-label="React Bits Dot Grid gap" />
          </label>
          <label className={styles.rangeRow}>
            <span>Proximity ({settings.reactBitsDotGridProximity.toFixed(0)})</span>
            <input type="range" min="40" max="500" step="5" value={settings.reactBitsDotGridProximity} onChange={(event) => onSettingsChange({ reactBitsDotGridProximity: Number(event.target.value) })} aria-label="React Bits Dot Grid proximity" />
          </label>
          <label className={styles.rangeRow}>
            <span>Speed trigger ({settings.reactBitsDotGridSpeedTrigger.toFixed(0)})</span>
            <input type="range" min="0" max="1000" step="10" value={settings.reactBitsDotGridSpeedTrigger} onChange={(event) => onSettingsChange({ reactBitsDotGridSpeedTrigger: Number(event.target.value) })} aria-label="React Bits Dot Grid speed trigger" />
          </label>
          <label className={styles.rangeRow}>
            <span>Shock radius ({settings.reactBitsDotGridShockRadius.toFixed(0)})</span>
            <input type="range" min="40" max="700" step="10" value={settings.reactBitsDotGridShockRadius} onChange={(event) => onSettingsChange({ reactBitsDotGridShockRadius: Number(event.target.value) })} aria-label="React Bits Dot Grid shock radius" />
          </label>
          <label className={styles.rangeRow}>
            <span>Shock strength ({settings.reactBitsDotGridShockStrength.toFixed(1)})</span>
            <input type="range" min="0" max="12" step="0.1" value={settings.reactBitsDotGridShockStrength} onChange={(event) => onSettingsChange({ reactBitsDotGridShockStrength: Number(event.target.value) })} aria-label="React Bits Dot Grid shock strength" />
          </label>
          <label className={styles.rangeRow}>
            <span>Max speed ({settings.reactBitsDotGridMaxSpeed.toFixed(0)})</span>
            <input type="range" min="100" max="8000" step="100" value={settings.reactBitsDotGridMaxSpeed} onChange={(event) => onSettingsChange({ reactBitsDotGridMaxSpeed: Number(event.target.value) })} aria-label="React Bits Dot Grid max speed" />
          </label>
          <label className={styles.rangeRow}>
            <span>Resistance ({settings.reactBitsDotGridResistance.toFixed(0)})</span>
            <input type="range" min="120" max="1600" step="20" value={settings.reactBitsDotGridResistance} onChange={(event) => onSettingsChange({ reactBitsDotGridResistance: Number(event.target.value) })} aria-label="React Bits Dot Grid resistance" />
          </label>
          <label className={styles.rangeRow}>
            <span>Return ({settings.reactBitsDotGridReturnDuration.toFixed(2)}s)</span>
            <input type="range" min="0.1" max="4" step="0.05" value={settings.reactBitsDotGridReturnDuration} onChange={(event) => onSettingsChange({ reactBitsDotGridReturnDuration: Number(event.target.value) })} aria-label="React Bits Dot Grid return duration" />
          </label>
        </div>
      )
    }

    if (option.id === "react-bits-threads") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.reactBitsThreadsPaletteMode}
              onChange={(event) => onSettingsChange({
                reactBitsThreadsPaletteMode: event.target.value as ReactBitsThreadsPaletteMode,
              })}
              aria-label="React Bits Threads color mode"
            >
              <option value="source">Source white</option>
              <option value="custom">Custom color</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {settings.reactBitsThreadsPaletteMode === "custom" ? (
            <label className={styles.colorRow}>
              <span>Thread color</span>
              <input
                type="color"
                value={settings.reactBitsThreadsColor}
                onChange={(event) => onSettingsChange({ reactBitsThreadsColor: event.target.value })}
                aria-label="React Bits Threads color"
              />
            </label>
          ) : null}

          {settings.reactBitsThreadsPaletteMode === "harmony" ? (
            <>
              <label className={styles.colorRow}>
                <span>Primary color</span>
                <input
                  type="color"
                  value={settings.reactBitsThreadsPrimaryColor}
                  onChange={(event) => onSettingsChange({ reactBitsThreadsPrimaryColor: event.target.value })}
                  aria-label="React Bits Threads primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={settings.reactBitsThreadsHarmony}
                  onChange={(event) => onSettingsChange({
                    reactBitsThreadsHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="React Bits Threads color harmony"
                >
                  <option value="monochromatic">Monochromatic</option>
                  <option value="analogous">Analogous</option>
                  <option value="complementary">Complementary</option>
                  <option value="triad">Triad</option>
                </select>
              </label>
            </>
          ) : null}

          <label className={styles.switchRow}>
            <span>Mouse interaction</span>
            <input
              type="checkbox"
              checked={settings.reactBitsThreadsEnableMouseInteraction}
              onChange={(event) => onSettingsChange({
                reactBitsThreadsEnableMouseInteraction: event.target.checked,
              })}
              aria-label="React Bits Threads mouse interaction"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Amplitude ({settings.reactBitsThreadsAmplitude.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={settings.reactBitsThreadsAmplitude}
              onChange={(event) => onSettingsChange({ reactBitsThreadsAmplitude: Number(event.target.value) })}
              aria-label="React Bits Threads amplitude"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Distance ({settings.reactBitsThreadsDistance.toFixed(2)})</span>
            <input
              type="range"
              min="-1"
              max="1.5"
              step="0.05"
              value={settings.reactBitsThreadsDistance}
              onChange={(event) => onSettingsChange({ reactBitsThreadsDistance: Number(event.target.value) })}
              aria-label="React Bits Threads distance"
            />
          </label>
        </div>
      )
    }

    if (option.id === "react-bits-iridescence") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.reactBitsIridescencePaletteMode}
              onChange={(event) => onSettingsChange({
                reactBitsIridescencePaletteMode: event.target.value as ReactBitsIridescencePaletteMode,
              })}
              aria-label="React Bits Iridescence color mode"
            >
              <option value="source">Source white</option>
              <option value="custom">Custom color</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {settings.reactBitsIridescencePaletteMode === "custom" ? (
            <label className={styles.colorRow}>
              <span>Tint color</span>
              <input
                type="color"
                value={settings.reactBitsIridescenceColor}
                onChange={(event) => onSettingsChange({ reactBitsIridescenceColor: event.target.value })}
                aria-label="React Bits Iridescence tint color"
              />
            </label>
          ) : null}

          {settings.reactBitsIridescencePaletteMode === "harmony" ? (
            <>
              <label className={styles.colorRow}>
                <span>Primary color</span>
                <input
                  type="color"
                  value={settings.reactBitsIridescencePrimaryColor}
                  onChange={(event) => onSettingsChange({ reactBitsIridescencePrimaryColor: event.target.value })}
                  aria-label="React Bits Iridescence primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={settings.reactBitsIridescenceHarmony}
                  onChange={(event) => onSettingsChange({
                    reactBitsIridescenceHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="React Bits Iridescence color harmony"
                >
                  <option value="monochromatic">Monochromatic</option>
                  <option value="analogous">Analogous</option>
                  <option value="complementary">Complementary</option>
                  <option value="triad">Triad</option>
                  <option value="square">Square</option>
                </select>
              </label>
            </>
          ) : null}

          <label className={styles.switchRow}>
            <span>Mouse reaction</span>
            <input
              type="checkbox"
              checked={settings.reactBitsIridescenceMouseReact}
              onChange={(event) => onSettingsChange({
                reactBitsIridescenceMouseReact: event.target.checked,
              })}
              aria-label="React Bits Iridescence mouse reaction"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Speed ({settings.reactBitsIridescenceSpeed.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={settings.reactBitsIridescenceSpeed}
              onChange={(event) => onSettingsChange({ reactBitsIridescenceSpeed: Number(event.target.value) })}
              aria-label="React Bits Iridescence speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Amplitude ({settings.reactBitsIridescenceAmplitude.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.reactBitsIridescenceAmplitude}
              onChange={(event) => onSettingsChange({ reactBitsIridescenceAmplitude: Number(event.target.value) })}
              aria-label="React Bits Iridescence amplitude"
            />
          </label>
        </div>
      )
    }

    if (option.id === "react-bits-waves") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Line color mode</span>
            <select
              value={settings.reactBitsWavesPaletteMode}
              onChange={(event) => onSettingsChange({
                reactBitsWavesPaletteMode: event.target.value as ReactBitsWavesPaletteMode,
              })}
              aria-label="React Bits Waves line color mode"
            >
              <option value="source">Source black</option>
              <option value="custom">Custom color</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {settings.reactBitsWavesPaletteMode === "custom" ? (
            <label className={styles.colorRow}>
              <span>Line color</span>
              <input
                type="color"
                value={settings.reactBitsWavesLineColor}
                onChange={(event) => onSettingsChange({ reactBitsWavesLineColor: event.target.value })}
                aria-label="React Bits Waves line color"
              />
            </label>
          ) : null}

          {settings.reactBitsWavesPaletteMode === "harmony" ? (
            <>
              <label className={styles.colorRow}>
                <span>Primary color</span>
                <input
                  type="color"
                  value={settings.reactBitsWavesPrimaryColor}
                  onChange={(event) => onSettingsChange({ reactBitsWavesPrimaryColor: event.target.value })}
                  aria-label="React Bits Waves primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={settings.reactBitsWavesHarmony}
                  onChange={(event) => onSettingsChange({
                    reactBitsWavesHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="React Bits Waves color harmony"
                >
                  <option value="monochromatic">Monochromatic</option>
                  <option value="analogous">Analogous</option>
                  <option value="complementary">Complementary</option>
                  <option value="triad">Triad</option>
                  <option value="square">Square</option>
                </select>
              </label>
            </>
          ) : null}

          <label className={styles.switchRow}>
            <span>Transparent background</span>
            <input
              type="checkbox"
              checked={settings.reactBitsWavesTransparentBackground}
              onChange={(event) => onSettingsChange({
                reactBitsWavesTransparentBackground: event.target.checked,
              })}
              aria-label="React Bits Waves transparent background"
            />
          </label>

          {!settings.reactBitsWavesTransparentBackground ? (
            <label className={styles.colorRow}>
              <span>Background color</span>
              <input
                type="color"
                value={settings.reactBitsWavesBackgroundColor}
                onChange={(event) => onSettingsChange({ reactBitsWavesBackgroundColor: event.target.value })}
                aria-label="React Bits Waves background color"
              />
            </label>
          ) : null}

          <label className={styles.switchRow}>
            <span>Cursor interaction</span>
            <input
              type="checkbox"
              checked={settings.reactBitsWavesCursorInteraction}
              onChange={(event) => onSettingsChange({
                reactBitsWavesCursorInteraction: event.target.checked,
              })}
              aria-label="React Bits Waves cursor interaction"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Wave speed X ({settings.reactBitsWavesSpeedX.toFixed(4)})</span>
            <input
              type="range"
              min="0"
              max="0.05"
              step="0.0005"
              value={settings.reactBitsWavesSpeedX}
              onChange={(event) => onSettingsChange({ reactBitsWavesSpeedX: Number(event.target.value) })}
              aria-label="React Bits Waves X speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Wave speed Y ({settings.reactBitsWavesSpeedY.toFixed(4)})</span>
            <input
              type="range"
              min="0"
              max="0.05"
              step="0.0005"
              value={settings.reactBitsWavesSpeedY}
              onChange={(event) => onSettingsChange({ reactBitsWavesSpeedY: Number(event.target.value) })}
              aria-label="React Bits Waves Y speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Amplitude X ({settings.reactBitsWavesAmplitudeX.toFixed(0)})</span>
            <input
              type="range"
              min="0"
              max="96"
              step="1"
              value={settings.reactBitsWavesAmplitudeX}
              onChange={(event) => onSettingsChange({ reactBitsWavesAmplitudeX: Number(event.target.value) })}
              aria-label="React Bits Waves X amplitude"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Amplitude Y ({settings.reactBitsWavesAmplitudeY.toFixed(0)})</span>
            <input
              type="range"
              min="0"
              max="96"
              step="1"
              value={settings.reactBitsWavesAmplitudeY}
              onChange={(event) => onSettingsChange({ reactBitsWavesAmplitudeY: Number(event.target.value) })}
              aria-label="React Bits Waves Y amplitude"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Line gap X ({settings.reactBitsWavesGapX.toFixed(0)})</span>
            <input
              type="range"
              min="4"
              max="40"
              step="1"
              value={settings.reactBitsWavesGapX}
              onChange={(event) => onSettingsChange({ reactBitsWavesGapX: Number(event.target.value) })}
              aria-label="React Bits Waves X gap"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Point gap Y ({settings.reactBitsWavesGapY.toFixed(0)})</span>
            <input
              type="range"
              min="8"
              max="96"
              step="1"
              value={settings.reactBitsWavesGapY}
              onChange={(event) => onSettingsChange({ reactBitsWavesGapY: Number(event.target.value) })}
              aria-label="React Bits Waves Y gap"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Friction ({settings.reactBitsWavesFriction.toFixed(3)})</span>
            <input
              type="range"
              min="0.8"
              max="0.99"
              step="0.005"
              value={settings.reactBitsWavesFriction}
              onChange={(event) => onSettingsChange({ reactBitsWavesFriction: Number(event.target.value) })}
              aria-label="React Bits Waves friction"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Tension ({settings.reactBitsWavesTension.toFixed(3)})</span>
            <input
              type="range"
              min="0.001"
              max="0.05"
              step="0.001"
              value={settings.reactBitsWavesTension}
              onChange={(event) => onSettingsChange({ reactBitsWavesTension: Number(event.target.value) })}
              aria-label="React Bits Waves tension"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Cursor movement ({settings.reactBitsWavesMaxCursorMove.toFixed(0)})</span>
            <input
              type="range"
              min="0"
              max="240"
              step="5"
              value={settings.reactBitsWavesMaxCursorMove}
              onChange={(event) => onSettingsChange({ reactBitsWavesMaxCursorMove: Number(event.target.value) })}
              aria-label="React Bits Waves max cursor movement"
            />
          </label>
        </div>
      )
    }

    if (option.id === "react-bits-grid-distortion") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Texture color mode</span>
            <select
              value={settings.reactBitsGridDistortionPaletteMode}
              onChange={(event) => onSettingsChange({
                reactBitsGridDistortionPaletteMode: event.target.value as ReactBitsGridDistortionPaletteMode,
              })}
              aria-label="React Bits Grid Distortion color mode"
            >
              <option value="source">Source generated texture</option>
              <option value="custom">Custom colors</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {settings.reactBitsGridDistortionPaletteMode === "custom" ? (
            <>
              <label className={styles.colorRow}>
                <span>Texture color 1</span>
                <input
                  type="color"
                  value={settings.reactBitsGridDistortionColorOne}
                  onChange={(event) => onSettingsChange({ reactBitsGridDistortionColorOne: event.target.value })}
                  aria-label="React Bits Grid Distortion texture color 1"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Texture color 2</span>
                <input
                  type="color"
                  value={settings.reactBitsGridDistortionColorTwo}
                  onChange={(event) => onSettingsChange({ reactBitsGridDistortionColorTwo: event.target.value })}
                  aria-label="React Bits Grid Distortion texture color 2"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Texture color 3</span>
                <input
                  type="color"
                  value={settings.reactBitsGridDistortionColorThree}
                  onChange={(event) => onSettingsChange({ reactBitsGridDistortionColorThree: event.target.value })}
                  aria-label="React Bits Grid Distortion texture color 3"
                />
              </label>
            </>
          ) : null}

          {settings.reactBitsGridDistortionPaletteMode === "harmony" ? (
            <>
              <label className={styles.colorRow}>
                <span>Primary color</span>
                <input
                  type="color"
                  value={settings.reactBitsGridDistortionPrimaryColor}
                  onChange={(event) => onSettingsChange({ reactBitsGridDistortionPrimaryColor: event.target.value })}
                  aria-label="React Bits Grid Distortion primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={settings.reactBitsGridDistortionHarmony}
                  onChange={(event) => onSettingsChange({
                    reactBitsGridDistortionHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="React Bits Grid Distortion color harmony"
                >
                  <option value="monochromatic">Monochromatic</option>
                  <option value="analogous">Analogous</option>
                  <option value="complementary">Complementary</option>
                  <option value="triad">Triad</option>
                  <option value="square">Square</option>
                </select>
              </label>
            </>
          ) : null}

          <label className={styles.switchRow}>
            <span>Cursor interaction</span>
            <input
              type="checkbox"
              checked={settings.reactBitsGridDistortionCursorInteraction}
              onChange={(event) => onSettingsChange({
                reactBitsGridDistortionCursorInteraction: event.target.checked,
              })}
              aria-label="React Bits Grid Distortion cursor interaction"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Grid ({settings.reactBitsGridDistortionGrid.toFixed(0)})</span>
            <input
              type="range"
              min="4"
              max="40"
              step="1"
              value={settings.reactBitsGridDistortionGrid}
              onChange={(event) => onSettingsChange({ reactBitsGridDistortionGrid: Number(event.target.value) })}
              aria-label="React Bits Grid Distortion grid"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Mouse radius ({settings.reactBitsGridDistortionMouse.toFixed(2)})</span>
            <input
              type="range"
              min="0.02"
              max="0.5"
              step="0.01"
              value={settings.reactBitsGridDistortionMouse}
              onChange={(event) => onSettingsChange({ reactBitsGridDistortionMouse: Number(event.target.value) })}
              aria-label="React Bits Grid Distortion mouse radius"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Strength ({settings.reactBitsGridDistortionStrength.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="0.6"
              step="0.01"
              value={settings.reactBitsGridDistortionStrength}
              onChange={(event) => onSettingsChange({ reactBitsGridDistortionStrength: Number(event.target.value) })}
              aria-label="React Bits Grid Distortion strength"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Relaxation ({settings.reactBitsGridDistortionRelaxation.toFixed(2)})</span>
            <input
              type="range"
              min="0.75"
              max="0.99"
              step="0.01"
              value={settings.reactBitsGridDistortionRelaxation}
              onChange={(event) => onSettingsChange({ reactBitsGridDistortionRelaxation: Number(event.target.value) })}
              aria-label="React Bits Grid Distortion relaxation"
            />
          </label>
        </div>
      )
    }

    if (option.id === "eldora-photon-beam") {
      const useCustomPalette = settings.eldoraPhotonBeamPaletteMode === "custom"
      const photonSpeed = getEldoraPhotonBeamDisplaySpeed(settings.eldoraPhotonBeamSpeedGlobal)

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.eldoraPhotonBeamPaletteMode}
              onChange={(event) => onSettingsChange({
                eldoraPhotonBeamPaletteMode: event.target.value as EldoraPhotonBeamPaletteMode,
              })}
              aria-label="Photon Beam color mode"
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
                  value={settings.eldoraPhotonBeamColorBg}
                  onChange={(event) => onSettingsChange({ eldoraPhotonBeamColorBg: event.target.value })}
                  aria-label="Photon Beam background color"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Beam lines</span>
                <input
                  type="color"
                  value={settings.eldoraPhotonBeamColorLine}
                  onChange={(event) => onSettingsChange({ eldoraPhotonBeamColorLine: event.target.value })}
                  aria-label="Photon Beam line color"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Signal 1</span>
                <input
                  type="color"
                  value={settings.eldoraPhotonBeamColorSignal}
                  onChange={(event) => onSettingsChange({ eldoraPhotonBeamColorSignal: event.target.value })}
                  aria-label="Photon Beam signal color"
                />
              </label>
              <label className={styles.switchRow}>
                <span>Signal 2</span>
                <input
                  type="checkbox"
                  checked={settings.eldoraPhotonBeamUseColor2}
                  onChange={(event) => onSettingsChange({ eldoraPhotonBeamUseColor2: event.target.checked })}
                  aria-label="Photon Beam use second signal color"
                />
              </label>
              {settings.eldoraPhotonBeamUseColor2 && (
                <label className={styles.colorRow}>
                  <span>Signal 2 color</span>
                  <input
                    type="color"
                    value={settings.eldoraPhotonBeamColorSignal2}
                    onChange={(event) => onSettingsChange({ eldoraPhotonBeamColorSignal2: event.target.value })}
                    aria-label="Photon Beam second signal color"
                  />
                </label>
              )}
              <label className={styles.switchRow}>
                <span>Signal 3</span>
                <input
                  type="checkbox"
                  checked={settings.eldoraPhotonBeamUseColor3}
                  onChange={(event) => onSettingsChange({ eldoraPhotonBeamUseColor3: event.target.checked })}
                  aria-label="Photon Beam use third signal color"
                />
              </label>
              {settings.eldoraPhotonBeamUseColor3 && (
                <label className={styles.colorRow}>
                  <span>Signal 3 color</span>
                  <input
                    type="color"
                    value={settings.eldoraPhotonBeamColorSignal3}
                    onChange={(event) => onSettingsChange({ eldoraPhotonBeamColorSignal3: event.target.value })}
                    aria-label="Photon Beam third signal color"
                  />
                </label>
              )}
            </>
          ) : (
            <>
              <label className={styles.colorRow}>
                <span>Primary color</span>
                <input
                  type="color"
                  value={settings.eldoraPhotonBeamPrimaryColor}
                  onChange={(event) => onSettingsChange({ eldoraPhotonBeamPrimaryColor: event.target.value })}
                  aria-label="Photon Beam primary color"
                />
              </label>

              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={settings.eldoraPhotonBeamHarmony}
                  onChange={(event) => onSettingsChange({
                    eldoraPhotonBeamHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="Photon Beam color harmony"
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
            <span>Animation speed ({photonSpeed}%)</span>
            <input
              type="range"
              min={ELDORA_PHOTON_BEAM_DISPLAY_SPEED_MIN}
              max={ELDORA_PHOTON_BEAM_DISPLAY_SPEED_MAX}
              step={ELDORA_PHOTON_BEAM_DISPLAY_SPEED_STEP}
              value={photonSpeed}
              onChange={(event) => onSettingsChange({
                eldoraPhotonBeamSpeedGlobal: getEldoraPhotonBeamSourceSpeed(Number(event.target.value)),
              })}
              aria-label="Photon Beam animation speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Lines ({settings.eldoraPhotonBeamLineCount})</span>
            <input
              type="range"
              min="12"
              max="160"
              step="1"
              value={settings.eldoraPhotonBeamLineCount}
              onChange={(event) => onSettingsChange({ eldoraPhotonBeamLineCount: Number(event.target.value) })}
              aria-label="Photon Beam line count"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Signals ({settings.eldoraPhotonBeamSignalCount})</span>
            <input
              type="range"
              min="0"
              max="220"
              step="1"
              value={settings.eldoraPhotonBeamSignalCount}
              onChange={(event) => onSettingsChange({ eldoraPhotonBeamSignalCount: Number(event.target.value) })}
              aria-label="Photon Beam signal count"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Spread ({settings.eldoraPhotonBeamSpreadHeight.toFixed(0)})</span>
            <input
              type="range"
              min="5"
              max="90"
              step="1"
              value={settings.eldoraPhotonBeamSpreadHeight}
              onChange={(event) => onSettingsChange({ eldoraPhotonBeamSpreadHeight: Number(event.target.value) })}
              aria-label="Photon Beam spread height"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Depth ({settings.eldoraPhotonBeamSpreadDepth.toFixed(0)})</span>
            <input
              type="range"
              min="0"
              max="60"
              step="1"
              value={settings.eldoraPhotonBeamSpreadDepth}
              onChange={(event) => onSettingsChange({ eldoraPhotonBeamSpreadDepth: Number(event.target.value) })}
              aria-label="Photon Beam spread depth"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Trail length ({settings.eldoraPhotonBeamTrailLength})</span>
            <input
              type="range"
              min="1"
              max="16"
              step="1"
              value={settings.eldoraPhotonBeamTrailLength}
              onChange={(event) => onSettingsChange({ eldoraPhotonBeamTrailLength: Number(event.target.value) })}
              aria-label="Photon Beam trail length"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Line opacity ({Math.round(settings.eldoraPhotonBeamLineOpacity * 100)}%)</span>
            <input
              type="range"
              min="0.05"
              max="1"
              step="0.01"
              value={settings.eldoraPhotonBeamLineOpacity}
              onChange={(event) => onSettingsChange({ eldoraPhotonBeamLineOpacity: Number(event.target.value) })}
              aria-label="Photon Beam line opacity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Bloom strength ({settings.eldoraPhotonBeamBloomStrength.toFixed(1)})</span>
            <input
              type="range"
              min="0"
              max="6"
              step="0.1"
              value={settings.eldoraPhotonBeamBloomStrength}
              onChange={(event) => onSettingsChange({ eldoraPhotonBeamBloomStrength: Number(event.target.value) })}
              aria-label="Photon Beam bloom strength"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Bloom radius ({settings.eldoraPhotonBeamBloomRadius.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1.5"
              step="0.05"
              value={settings.eldoraPhotonBeamBloomRadius}
              onChange={(event) => onSettingsChange({ eldoraPhotonBeamBloomRadius: Number(event.target.value) })}
              aria-label="Photon Beam bloom radius"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Wave speed ({settings.eldoraPhotonBeamWaveSpeed.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="8"
              step="0.05"
              value={settings.eldoraPhotonBeamWaveSpeed}
              onChange={(event) => onSettingsChange({ eldoraPhotonBeamWaveSpeed: Number(event.target.value) })}
              aria-label="Photon Beam wave speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Wave height ({settings.eldoraPhotonBeamWaveHeight.toFixed(3)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.005"
              value={settings.eldoraPhotonBeamWaveHeight}
              onChange={(event) => onSettingsChange({ eldoraPhotonBeamWaveHeight: Number(event.target.value) })}
              aria-label="Photon Beam wave height"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Curve length ({settings.eldoraPhotonBeamCurveLength.toFixed(0)})</span>
            <input
              type="range"
              min="16"
              max="120"
              step="1"
              value={settings.eldoraPhotonBeamCurveLength}
              onChange={(event) => onSettingsChange({ eldoraPhotonBeamCurveLength: Number(event.target.value) })}
              aria-label="Photon Beam curve length"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Straight length ({settings.eldoraPhotonBeamStraightLength.toFixed(0)})</span>
            <input
              type="range"
              min="40"
              max="220"
              step="1"
              value={settings.eldoraPhotonBeamStraightLength}
              onChange={(event) => onSettingsChange({ eldoraPhotonBeamStraightLength: Number(event.target.value) })}
              aria-label="Photon Beam straight length"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Curve power ({settings.eldoraPhotonBeamCurvePower.toFixed(2)})</span>
            <input
              type="range"
              min="0.2"
              max="2"
              step="0.01"
              value={settings.eldoraPhotonBeamCurvePower}
              onChange={(event) => onSettingsChange({ eldoraPhotonBeamCurvePower: Number(event.target.value) })}
              aria-label="Photon Beam curve power"
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
