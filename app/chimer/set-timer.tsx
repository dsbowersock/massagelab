"use client"

import {
  type FormEvent as ReactFormEvent,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { BellRing, Clock, MonitorSmartphone, Play, SlidersHorizontal } from "lucide-react"
import { BackgroundSelector } from "@/components/backgrounds/BackgroundSelector"
import type { BackgroundCategory, BackgroundDefinition, BackgroundId } from "@/components/backgrounds/backgroundRegistry"
import { PageHeading } from "@/components/ui/page-heading"
import { useSettings } from "@/components/providers/settings-provider"
import { withChimerPress } from "@/lib/chimer-press-handler"
import { CTAButton } from "@/components/chimer-controls/CTAButton"
import { MetalAttentionRing } from "@/components/ui/metal-attention-button"
import { NumberField } from "@/components/chimer-controls/NumberField"
import { StyledRangeControl } from "@/components/chimer-controls/StyledRangeControl"
import { StyledToggleControl } from "@/components/chimer-controls/StyledToggleControl"
import {
  getMassageLab3DGlobeScaleDisplayPercent,
  getMassageLab3DGlobeScaleFromDisplayPercent,
  sanitizeChimerSettings,
} from "@/lib/chimer-timer"
import styles from "./set-timer.module.css"
import { TileGridFadeTimeControl } from "./tile-grid-fade-time-control"

export {
  getMassageLab3DGlobeScaleDisplayPercent,
  getMassageLab3DGlobeScaleFromDisplayPercent,
}

const CHIMER_SETUP_PRESETS_STORAGE_KEY = "chimer-setup-presets-v1"
const CHIMER_LAST_SETUP_STORAGE_KEY = "chimer-last-setup-v1"
const MAX_CHIMER_SETUP_PRESETS = 12
const QUICK_TIME_PRESETS_MINUTES = [1, 5, 10, 15, 20, 30, 45, 60] as const
const CHIMER_SETUP_STEPS = [
  "Enter time",
  "Choose interval",
  "Choose notification",
  "Choose background",
  "Start timer",
] as const
const INFO_CAROUSEL_SWIPE_THRESHOLD_PX = 42

type ChimerSetupPresetState = Pick<
  ChimerSettings,
  | "hours"
  | "minutes"
  | "intervalType"
  | "customInterval"
  | "areasToMassage"
  | "alertType"
  | "alertVolume"
  | "hapticIntensityMs"
  | "movingBackgroundEnabled"
  | "backgroundId"
> & {
  skipIntervalCues: boolean
}

type ChimerSetupPreset = {
  id: string
  name: string
  createdAt: number
  settings: ChimerSetupPresetState
}

export type ChimerSetupStartOptions = {
  startWithoutAnimatedBackground?: boolean
  skipIntervalCues?: boolean
}

// Saved setup presets store only pre-start choices so timer runtime state does
// not leak into reusable session templates.
const createChimerSetupPresetState = (
  settings: ChimerSettings,
  skipIntervalCues = false,
): ChimerSetupPresetState => ({
  hours: settings.hours,
  minutes: settings.minutes,
  intervalType: settings.intervalType,
  customInterval: settings.customInterval,
  areasToMassage: settings.areasToMassage,
  alertType: settings.alertType,
  alertVolume: settings.alertVolume,
  hapticIntensityMs: settings.hapticIntensityMs,
  movingBackgroundEnabled: settings.movingBackgroundEnabled,
  backgroundId: settings.backgroundId,
  skipIntervalCues,
})

// Local saved setups are normalized through the central Chimer sanitizer, sorted
// newest-first, and capped so malformed or stale storage never blocks setup.
const readChimerSetupPresets = (): ChimerSetupPreset[] => {
  if (typeof window === "undefined") {
    return []
  }

  const raw = window.localStorage.getItem(CHIMER_SETUP_PRESETS_STORAGE_KEY)
  if (!raw) {
    return []
  }

  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return []
    }

    const normalized = parsed.flatMap((entry) => {
      if (!entry || typeof entry !== "object") {
        return []
      }

      const candidate = entry as {
        id?: unknown
        name?: unknown
        createdAt?: unknown
        settings?: {
          skipIntervalCues?: unknown
        }
      }

      if (typeof candidate.id !== "string" || candidate.id.trim().length === 0) {
        return []
      }

      if (!candidate.settings) {
        return []
      }

      const sanitized = sanitizeChimerSettings(candidate.settings as ChimerSettings)
      const intervalSkip =
        candidate.settings && typeof candidate.settings === "object"
          ? typeof candidate.settings.skipIntervalCues === "boolean"
            ? candidate.settings.skipIntervalCues
            : false
          : false
      return [{
        id: candidate.id,
        name:
          typeof candidate.name === "string" && candidate.name.trim().length > 0
            ? candidate.name.trim()
            : "Saved setup",
        createdAt: Number.isFinite(candidate.createdAt as number) ? Number(candidate.createdAt) : Date.now(),
        settings: {
          ...createChimerSetupPresetState(sanitized as ChimerSettings),
          skipIntervalCues: intervalSkip,
        },
      }]
    })

    return normalized
      .sort((left, right) => right.createdAt - left.createdAt)
      .slice(0, MAX_CHIMER_SETUP_PRESETS)
  } catch {
    window.localStorage.removeItem(CHIMER_SETUP_PRESETS_STORAGE_KEY)
    return []
  }
}

// The quick-reuse setup is intentionally a single sanitized payload; corrupt
// storage is removed so returning users can continue with defaults.
const readLastChimerSetupPreset = (): ChimerSetupPresetState | null => {
  if (typeof window === "undefined") {
    return null
  }

  const raw = window.localStorage.getItem(CHIMER_LAST_SETUP_STORAGE_KEY)
  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== "object") {
      return null
    }

    const sanitized = sanitizeChimerSettings(parsed as ChimerSettings)
    const parsedState = parsed as ChimerSetupPresetState & { skipIntervalCues?: unknown }
    return {
      ...createChimerSetupPresetState(sanitized as ChimerSettings),
      skipIntervalCues: typeof parsedState.skipIntervalCues === "boolean" ? parsedState.skipIntervalCues : false,
    }
  } catch {
    window.localStorage.removeItem(CHIMER_LAST_SETUP_STORAGE_KEY)
    return null
  }
}

// Persist only a bounded list of sanitized setup presets.
const writeChimerSetupPresets = (presets: ChimerSetupPreset[]) => {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.setItem(CHIMER_SETUP_PRESETS_STORAGE_KEY, JSON.stringify(presets))
}

// Persist the latest setup separately from the named preset collection.
const writeChimerLastSetupPreset = (preset: ChimerSetupPresetState) => {
  if (typeof window === "undefined") {
    return
  }

  window.localStorage.setItem(CHIMER_LAST_SETUP_STORAGE_KEY, JSON.stringify(preset))
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

export const MASSAGE_LAB_GRADIENT_HARMONY_OPTIONS = COLOR_HARMONY_OPTIONS

export type ColorHarmony = typeof COLOR_HARMONY_OPTIONS[number]["value"]
export type MassageLabGradientHarmony = ColorHarmony
export type MassageLabAstralFlowPaletteMode = "harmony" | "custom"
export type MassageLabDeepSpaceNebulaPaletteMode = "harmony" | "custom"
export type MassageLabChromeFlowPaletteMode = "harmony" | "custom"
export type MassageLabWaveCurrentPaletteMode = "harmony" | "custom"
export type MassageLabSynthesisPaletteMode = "harmony" | "custom"
export type MassageLabFerrofluidPaletteMode = "harmony" | "custom"
export type MassageLabLightfallPaletteMode = "harmony" | "custom"
export type MassageLabLiquidEtherPaletteMode = "harmony" | "custom"
export type MassageLabPrismAnimationType = "rotate" | "3drotate" | "hover"
export type MassageLabLightPillarPaletteMode = "harmony" | "custom"
export type MassageLabLightPillarBlendMode = "screen" | "normal" | "lighten" | "plus-lighter"
export type MassageLabLightPillarQuality = "low" | "medium" | "high"
export type MassageLabSilkPaletteMode = "harmony" | "custom"
export type MassageLabFloatingLinesPaletteMode = "source" | "harmony" | "custom"
export type MassageLabFloatingLinesBlendMode = "screen" | "normal" | "lighten" | "plus-lighter"
export type MassageLabSideRaysPaletteMode = "source" | "harmony" | "custom"
export type MassageLabSideRaysOrigin = "top-right" | "top-left" | "bottom-right" | "bottom-left"
export type MassageLabLightRaysPaletteMode = "source" | "harmony" | "custom"
export type MassageLabLightRaysOrigin =
  | "top-left"
  | "top-center"
  | "top-right"
  | "left"
  | "right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right"
export type MassageLabPixelBlastPaletteMode = "source" | "harmony" | "custom"
export type MassageLabPixelBlastVariant = "square" | "circle" | "triangle" | "diamond"
export type MassageLabColorBendsPaletteMode = "source" | "harmony" | "custom"
export type MassageLabEvilEyePaletteMode = "source" | "harmony" | "custom"
export type MassageLabLineWavesPaletteMode = "source" | "harmony" | "custom"
export type MassageLabRadarPaletteMode = "source" | "harmony" | "custom"
export type MassageLabSoftAuroraPaletteMode = "source" | "harmony" | "custom"
export type MassageLabPlasmaPaletteMode = "source" | "harmony" | "custom"
export type MassageLabPlasmaDirection = "forward" | "reverse" | "pingpong"
export type MassageLabPlasmaWavePaletteMode = "source" | "harmony" | "custom"
export type MassageLabParticlesPaletteMode = "source" | "harmony" | "custom"
export type MassageLabGradientBlindsPaletteMode = "source" | "harmony" | "custom"
export type MassageLabGradientBlindsShineDirection = "left" | "right"
export type MassageLabGradientBlindsBlendMode = "normal" | "screen" | "lighten" | "plus-lighter"
export type MassageLabGrainientPaletteMode = "source" | "harmony" | "custom"
export type MassageLabGridScanPaletteMode = "source" | "harmony" | "custom"
export type MassageLabGridScanLineStyle = "solid" | "dashed" | "dotted"
export type MassageLabGridScanDirection = "forward" | "backward" | "pingpong"
export type MassageLabBeamsPaletteMode = "source" | "harmony" | "custom"
export type MassageLabPixelSnowPaletteMode = "source" | "harmony" | "custom"
export type MassageLabPixelSnowVariant = "square" | "round" | "snowflake"
export type MassageLabLightningPaletteMode = "source" | "harmony" | "custom"
export type MassageLabPrismaticBurstPaletteMode = "source" | "harmony" | "custom"
export type MassageLabPrismaticBurstAnimationType = "rotate" | "rotate3d" | "hover"
export type MassageLabPrismaticBurstMixBlendMode = "lighten" | "screen" | "none"
export type MassageLabGalaxyPaletteMode = "source" | "harmony" | "custom"
export type MassageLabDitherPaletteMode = "source" | "harmony" | "custom"
export type MassageLabFaultyTerminalPaletteMode = "source" | "harmony" | "custom"
export type MassageLabRippleGridPaletteMode = "source" | "rainbow" | "harmony" | "custom"
export type MassageLabDotFieldPaletteMode = "source" | "harmony" | "custom"
export type MassageLabDotGridPaletteMode = "source" | "harmony" | "custom"
export type MassageLabThreadsPaletteMode = "source" | "harmony" | "custom"
export type MassageLabIridescencePaletteMode = "source" | "harmony" | "custom"
export type MassageLabWavesPaletteMode = "source" | "harmony" | "custom"
export type MassageLabGridDistortionPaletteMode = "source" | "harmony" | "custom"
export type MassageLabOrbPaletteMode = "source" | "harmony" | "custom"
export type MassageLabLetterGlitchPaletteMode = "source" | "harmony" | "custom"
export type MassageLabGridMotionPaletteMode = "source" | "harmony" | "custom"
export type MassageLabShapeGridPaletteMode = "source" | "harmony" | "custom"
export type MassageLabLiquidChromePaletteMode = "source" | "harmony" | "custom"
export type MassageLabBalatroPaletteMode = "source" | "harmony" | "custom"
export type MassageLabNovatrixPaletteMode = "harmony" | "custom"
export type MassageLabMatrixRainPaletteMode = "harmony" | "custom"
export type MassageLabPhotonBeamPaletteMode = "harmony" | "custom"

export const MASSAGE_LAB_ASTRAL_FLOW_SOURCE_SPEED_MIN = 0.1
export const MASSAGE_LAB_ASTRAL_FLOW_SOURCE_SPEED_MAX = 3
export const MASSAGE_LAB_ASTRAL_FLOW_DISPLAY_SPEED_MIN = 10
export const MASSAGE_LAB_ASTRAL_FLOW_DISPLAY_SPEED_MAX = 100
export const MASSAGE_LAB_ASTRAL_FLOW_DISPLAY_SPEED_STEP = 1
export const MASSAGE_LAB_DEEP_SPACE_NEBULA_SOURCE_SPEED_MIN = 0.1
export const MASSAGE_LAB_DEEP_SPACE_NEBULA_SOURCE_SPEED_MAX = 5
export const MASSAGE_LAB_DEEP_SPACE_NEBULA_DISPLAY_SPEED_MIN = 1
export const MASSAGE_LAB_DEEP_SPACE_NEBULA_DISPLAY_SPEED_MAX = 100
export const MASSAGE_LAB_DEEP_SPACE_NEBULA_DISPLAY_SPEED_STEP = 1
export const MASSAGE_LAB_GRID_BLOOM_SOURCE_SPEED_MIN = 0.1
export const MASSAGE_LAB_GRID_BLOOM_SOURCE_SPEED_MAX = 3
export const MASSAGE_LAB_GRID_BLOOM_DISPLAY_SPEED_MIN = 1
export const MASSAGE_LAB_GRID_BLOOM_DISPLAY_SPEED_MAX = 100
export const MASSAGE_LAB_GRID_BLOOM_DISPLAY_SPEED_STEP = 1
export const MASSAGE_LAB_LIQUID_CHROME_SOURCE_FLOW_SPEED_MIN = 0.01
export const MASSAGE_LAB_LIQUID_CHROME_SOURCE_FLOW_SPEED_MAX = 2
export const MASSAGE_LAB_LIQUID_CHROME_DISPLAY_FLOW_SPEED_MIN = 1
export const MASSAGE_LAB_LIQUID_CHROME_DISPLAY_FLOW_SPEED_MAX = 100
export const MASSAGE_LAB_LIQUID_CHROME_DISPLAY_FLOW_SPEED_STEP = 1
export const MASSAGE_LAB_LIQUID_CHROME_SOURCE_TIME_SCALE_MIN = 0.001
export const MASSAGE_LAB_LIQUID_CHROME_SOURCE_TIME_SCALE_MAX = 1
export const MASSAGE_LAB_LIQUID_CHROME_DISPLAY_TIME_SCALE_MIN = 1
export const MASSAGE_LAB_LIQUID_CHROME_DISPLAY_TIME_SCALE_MAX = 100
export const MASSAGE_LAB_LIQUID_CHROME_DISPLAY_TIME_SCALE_STEP = 1
export const MASSAGE_LAB_WAVES_SOURCE_SPEED_MIN = 0.001
export const MASSAGE_LAB_WAVES_SOURCE_SPEED_MAX = 0.1
export const MASSAGE_LAB_WAVES_DISPLAY_SPEED_MIN = 1
export const MASSAGE_LAB_WAVES_DISPLAY_SPEED_MAX = 100
export const MASSAGE_LAB_WAVES_DISPLAY_SPEED_STEP = 1
export const MASSAGE_LAB_NOVATRIX_SOURCE_SPEED_MIN = 0.02
export const MASSAGE_LAB_NOVATRIX_SOURCE_SPEED_MAX = 3
export const MASSAGE_LAB_NOVATRIX_DISPLAY_SPEED_MIN = 1
export const MASSAGE_LAB_NOVATRIX_DISPLAY_SPEED_MAX = 100
export const MASSAGE_LAB_NOVATRIX_DISPLAY_SPEED_STEP = 1
export const MASSAGE_LAB_NOVATRIX_SOURCE_AMPLITUDE_MIN = 0.01
export const MASSAGE_LAB_NOVATRIX_SOURCE_AMPLITUDE_MAX = 0.45
export const MASSAGE_LAB_NOVATRIX_DISPLAY_AMPLITUDE_MIN = 1
export const MASSAGE_LAB_NOVATRIX_DISPLAY_AMPLITUDE_MAX = 100
export const MASSAGE_LAB_NOVATRIX_DISPLAY_AMPLITUDE_STEP = 1
export const MASSAGE_LAB_MATRIX_RAIN_SOURCE_SPEED_MIN = 0.05
export const MASSAGE_LAB_MATRIX_RAIN_SOURCE_SPEED_MAX = 3
export const MASSAGE_LAB_HACKER_DISPLAY_SPEED_MIN = 1
export const MASSAGE_LAB_HACKER_DISPLAY_SPEED_MAX = 100
export const MASSAGE_LAB_HACKER_DISPLAY_SPEED_STEP = 1
export const MASSAGE_LAB_PHOTON_BEAM_SOURCE_SPEED_MIN = 0.02
export const MASSAGE_LAB_PHOTON_BEAM_SOURCE_SPEED_MAX = 2
export const MASSAGE_LAB_PHOTON_BEAM_DISPLAY_SPEED_MIN = 1
export const MASSAGE_LAB_PHOTON_BEAM_DISPLAY_SPEED_MAX = 100
export const MASSAGE_LAB_PHOTON_BEAM_DISPLAY_SPEED_STEP = 1
export const MASSAGE_LAB_SYNTHESIS_SPEED_BASE = 0.4
export const MASSAGE_LAB_SYNTHESIS_DISPLAY_SPEED_MIN = 0.01
export const MASSAGE_LAB_SYNTHESIS_DISPLAY_SPEED_MAX = 5
export const MASSAGE_LAB_SYNTHESIS_DISPLAY_SPEED_STEP = 0.01

// Astral Flow stores the source shader multiplier, but the UI uses a compact
// percentage scale where the source range 0.1-3 maps to 10%-100%.
export function getMassageLabAstralFlowDisplaySpeed(sourceSpeed: number) {
  const clampedSpeed = Math.min(
    MASSAGE_LAB_ASTRAL_FLOW_SOURCE_SPEED_MAX,
    Math.max(MASSAGE_LAB_ASTRAL_FLOW_SOURCE_SPEED_MIN, sourceSpeed),
  )
  const sourceRange = MASSAGE_LAB_ASTRAL_FLOW_SOURCE_SPEED_MAX - MASSAGE_LAB_ASTRAL_FLOW_SOURCE_SPEED_MIN
  const displayRange = MASSAGE_LAB_ASTRAL_FLOW_DISPLAY_SPEED_MAX - MASSAGE_LAB_ASTRAL_FLOW_DISPLAY_SPEED_MIN
  return Math.round(
    MASSAGE_LAB_ASTRAL_FLOW_DISPLAY_SPEED_MIN
      + ((clampedSpeed - MASSAGE_LAB_ASTRAL_FLOW_SOURCE_SPEED_MIN) / sourceRange) * displayRange,
  )
}

export function getMassageLabAstralFlowSourceSpeed(displaySpeed: number) {
  const clampedDisplay = Math.min(
    MASSAGE_LAB_ASTRAL_FLOW_DISPLAY_SPEED_MAX,
    Math.max(MASSAGE_LAB_ASTRAL_FLOW_DISPLAY_SPEED_MIN, displaySpeed),
  )
  const sourceRange = MASSAGE_LAB_ASTRAL_FLOW_SOURCE_SPEED_MAX - MASSAGE_LAB_ASTRAL_FLOW_SOURCE_SPEED_MIN
  const displayRange = MASSAGE_LAB_ASTRAL_FLOW_DISPLAY_SPEED_MAX - MASSAGE_LAB_ASTRAL_FLOW_DISPLAY_SPEED_MIN
  return Math.round(
    (
      MASSAGE_LAB_ASTRAL_FLOW_SOURCE_SPEED_MIN
      + ((clampedDisplay - MASSAGE_LAB_ASTRAL_FLOW_DISPLAY_SPEED_MIN) / displayRange) * sourceRange
    ) * 1000,
  ) / 1000
}

// Deep Space Nebula stores the source shader multiplier, while the UI maps the
// MassageLab source range 0.1-5 to a 1%-100% slider.
export function getMassageLabDeepSpaceNebulaDisplaySpeed(sourceSpeed: number) {
  const clampedSpeed = Math.min(
    MASSAGE_LAB_DEEP_SPACE_NEBULA_SOURCE_SPEED_MAX,
    Math.max(MASSAGE_LAB_DEEP_SPACE_NEBULA_SOURCE_SPEED_MIN, sourceSpeed),
  )
  const sourceRange = MASSAGE_LAB_DEEP_SPACE_NEBULA_SOURCE_SPEED_MAX - MASSAGE_LAB_DEEP_SPACE_NEBULA_SOURCE_SPEED_MIN
  const displayRange = MASSAGE_LAB_DEEP_SPACE_NEBULA_DISPLAY_SPEED_MAX - MASSAGE_LAB_DEEP_SPACE_NEBULA_DISPLAY_SPEED_MIN
  return Math.round(
    MASSAGE_LAB_DEEP_SPACE_NEBULA_DISPLAY_SPEED_MIN
      + ((clampedSpeed - MASSAGE_LAB_DEEP_SPACE_NEBULA_SOURCE_SPEED_MIN) / sourceRange) * displayRange,
  )
}

export function getMassageLabDeepSpaceNebulaSourceSpeed(displaySpeed: number) {
  const clampedDisplay = Math.min(
    MASSAGE_LAB_DEEP_SPACE_NEBULA_DISPLAY_SPEED_MAX,
    Math.max(MASSAGE_LAB_DEEP_SPACE_NEBULA_DISPLAY_SPEED_MIN, displaySpeed),
  )
  const sourceRange = MASSAGE_LAB_DEEP_SPACE_NEBULA_SOURCE_SPEED_MAX - MASSAGE_LAB_DEEP_SPACE_NEBULA_SOURCE_SPEED_MIN
  const displayRange = MASSAGE_LAB_DEEP_SPACE_NEBULA_DISPLAY_SPEED_MAX - MASSAGE_LAB_DEEP_SPACE_NEBULA_DISPLAY_SPEED_MIN
  return Math.round(
    (
      MASSAGE_LAB_DEEP_SPACE_NEBULA_SOURCE_SPEED_MIN
      + ((clampedDisplay - MASSAGE_LAB_DEEP_SPACE_NEBULA_DISPLAY_SPEED_MIN) / displayRange) * sourceRange
    ) * 1000,
  ) / 1000
}

// Grid Bloom stores the MassageLab shader multiplier, while users see 1%-100%.
export function getMassageLabGridBloomDisplaySpeed(sourceSpeed: number) {
  const clampedSpeed = Math.min(
    MASSAGE_LAB_GRID_BLOOM_SOURCE_SPEED_MAX,
    Math.max(MASSAGE_LAB_GRID_BLOOM_SOURCE_SPEED_MIN, sourceSpeed),
  )
  const sourceRange = MASSAGE_LAB_GRID_BLOOM_SOURCE_SPEED_MAX - MASSAGE_LAB_GRID_BLOOM_SOURCE_SPEED_MIN
  const displayRange = MASSAGE_LAB_GRID_BLOOM_DISPLAY_SPEED_MAX - MASSAGE_LAB_GRID_BLOOM_DISPLAY_SPEED_MIN
  return Math.round(
    MASSAGE_LAB_GRID_BLOOM_DISPLAY_SPEED_MIN
      + ((clampedSpeed - MASSAGE_LAB_GRID_BLOOM_SOURCE_SPEED_MIN) / sourceRange) * displayRange,
  )
}

export function getMassageLabGridBloomSourceSpeed(displaySpeed: number) {
  const clampedDisplay = Math.min(
    MASSAGE_LAB_GRID_BLOOM_DISPLAY_SPEED_MAX,
    Math.max(MASSAGE_LAB_GRID_BLOOM_DISPLAY_SPEED_MIN, displaySpeed),
  )
  const sourceRange = MASSAGE_LAB_GRID_BLOOM_SOURCE_SPEED_MAX - MASSAGE_LAB_GRID_BLOOM_SOURCE_SPEED_MIN
  const displayRange = MASSAGE_LAB_GRID_BLOOM_DISPLAY_SPEED_MAX - MASSAGE_LAB_GRID_BLOOM_DISPLAY_SPEED_MIN
  return Math.round(
    (
      MASSAGE_LAB_GRID_BLOOM_SOURCE_SPEED_MIN
      + ((clampedDisplay - MASSAGE_LAB_GRID_BLOOM_DISPLAY_SPEED_MIN) / displayRange) * sourceRange
    ) * 1000,
  ) / 1000
}

// Liquid Chrome stores the source shader values; users see 1%-100% sliders.
export function getMassageLabChromeFlowDisplayFlowSpeed(sourceSpeed: number) {
  const clampedSpeed = Math.min(
    MASSAGE_LAB_LIQUID_CHROME_SOURCE_FLOW_SPEED_MAX,
    Math.max(MASSAGE_LAB_LIQUID_CHROME_SOURCE_FLOW_SPEED_MIN, sourceSpeed),
  )
  const sourceRange =
    MASSAGE_LAB_LIQUID_CHROME_SOURCE_FLOW_SPEED_MAX - MASSAGE_LAB_LIQUID_CHROME_SOURCE_FLOW_SPEED_MIN
  const displayRange =
    MASSAGE_LAB_LIQUID_CHROME_DISPLAY_FLOW_SPEED_MAX - MASSAGE_LAB_LIQUID_CHROME_DISPLAY_FLOW_SPEED_MIN
  return Math.round(
    MASSAGE_LAB_LIQUID_CHROME_DISPLAY_FLOW_SPEED_MIN
      + ((clampedSpeed - MASSAGE_LAB_LIQUID_CHROME_SOURCE_FLOW_SPEED_MIN) / sourceRange) * displayRange,
  )
}

export function getMassageLabChromeFlowSourceFlowSpeed(displaySpeed: number) {
  const clampedDisplay = Math.min(
    MASSAGE_LAB_LIQUID_CHROME_DISPLAY_FLOW_SPEED_MAX,
    Math.max(MASSAGE_LAB_LIQUID_CHROME_DISPLAY_FLOW_SPEED_MIN, displaySpeed),
  )
  const sourceRange =
    MASSAGE_LAB_LIQUID_CHROME_SOURCE_FLOW_SPEED_MAX - MASSAGE_LAB_LIQUID_CHROME_SOURCE_FLOW_SPEED_MIN
  const displayRange =
    MASSAGE_LAB_LIQUID_CHROME_DISPLAY_FLOW_SPEED_MAX - MASSAGE_LAB_LIQUID_CHROME_DISPLAY_FLOW_SPEED_MIN
  return Math.round(
    (
      MASSAGE_LAB_LIQUID_CHROME_SOURCE_FLOW_SPEED_MIN
      + ((clampedDisplay - MASSAGE_LAB_LIQUID_CHROME_DISPLAY_FLOW_SPEED_MIN) / displayRange) * sourceRange
    ) * 1000,
  ) / 1000
}

export function getMassageLabChromeFlowDisplayTimeScale(sourceTimeScale: number) {
  const clampedTimeScale = Math.min(
    MASSAGE_LAB_LIQUID_CHROME_SOURCE_TIME_SCALE_MAX,
    Math.max(MASSAGE_LAB_LIQUID_CHROME_SOURCE_TIME_SCALE_MIN, sourceTimeScale),
  )
  const sourceRange =
    MASSAGE_LAB_LIQUID_CHROME_SOURCE_TIME_SCALE_MAX - MASSAGE_LAB_LIQUID_CHROME_SOURCE_TIME_SCALE_MIN
  const displayRange =
    MASSAGE_LAB_LIQUID_CHROME_DISPLAY_TIME_SCALE_MAX - MASSAGE_LAB_LIQUID_CHROME_DISPLAY_TIME_SCALE_MIN
  return Math.round(
    MASSAGE_LAB_LIQUID_CHROME_DISPLAY_TIME_SCALE_MIN
      + ((clampedTimeScale - MASSAGE_LAB_LIQUID_CHROME_SOURCE_TIME_SCALE_MIN) / sourceRange) * displayRange,
  )
}

export function getMassageLabChromeFlowSourceTimeScale(displayTimeScale: number) {
  const clampedDisplay = Math.min(
    MASSAGE_LAB_LIQUID_CHROME_DISPLAY_TIME_SCALE_MAX,
    Math.max(MASSAGE_LAB_LIQUID_CHROME_DISPLAY_TIME_SCALE_MIN, displayTimeScale),
  )
  const sourceRange =
    MASSAGE_LAB_LIQUID_CHROME_SOURCE_TIME_SCALE_MAX - MASSAGE_LAB_LIQUID_CHROME_SOURCE_TIME_SCALE_MIN
  const displayRange =
    MASSAGE_LAB_LIQUID_CHROME_DISPLAY_TIME_SCALE_MAX - MASSAGE_LAB_LIQUID_CHROME_DISPLAY_TIME_SCALE_MIN
  return Math.round(
    (
      MASSAGE_LAB_LIQUID_CHROME_SOURCE_TIME_SCALE_MIN
      + ((clampedDisplay - MASSAGE_LAB_LIQUID_CHROME_DISPLAY_TIME_SCALE_MIN) / displayRange) * sourceRange
    ) * 1000,
  ) / 1000
}

// Waves stores the MassageLab source speed values; users see 1%-100%.
export function getMassageLabWaveCurrentDisplaySpeed(sourceSpeed: number) {
  const clampedSpeed = Math.min(
    MASSAGE_LAB_WAVES_SOURCE_SPEED_MAX,
    Math.max(MASSAGE_LAB_WAVES_SOURCE_SPEED_MIN, sourceSpeed),
  )
  const sourceRange = MASSAGE_LAB_WAVES_SOURCE_SPEED_MAX - MASSAGE_LAB_WAVES_SOURCE_SPEED_MIN
  const displayRange = MASSAGE_LAB_WAVES_DISPLAY_SPEED_MAX - MASSAGE_LAB_WAVES_DISPLAY_SPEED_MIN
  return Math.round(
    MASSAGE_LAB_WAVES_DISPLAY_SPEED_MIN
      + ((clampedSpeed - MASSAGE_LAB_WAVES_SOURCE_SPEED_MIN) / sourceRange) * displayRange,
  )
}

export function getMassageLabWaveCurrentSourceSpeed(displaySpeed: number) {
  const clampedDisplay = Math.min(
    MASSAGE_LAB_WAVES_DISPLAY_SPEED_MAX,
    Math.max(MASSAGE_LAB_WAVES_DISPLAY_SPEED_MIN, displaySpeed),
  )
  const sourceRange = MASSAGE_LAB_WAVES_SOURCE_SPEED_MAX - MASSAGE_LAB_WAVES_SOURCE_SPEED_MIN
  const displayRange = MASSAGE_LAB_WAVES_DISPLAY_SPEED_MAX - MASSAGE_LAB_WAVES_DISPLAY_SPEED_MIN
  return Math.round(
    (
      MASSAGE_LAB_WAVES_SOURCE_SPEED_MIN
      + ((clampedDisplay - MASSAGE_LAB_WAVES_DISPLAY_SPEED_MIN) / displayRange) * sourceRange
    ) * 10000,
  ) / 10000
}

// Novatrix keeps MassageLab's source speed/amplitude values but presents simple
// percentages so the slowest slider positions are visibly calm.
export function getMassageLabNovatrixDisplaySpeed(sourceSpeed: number) {
  const clampedSpeed = Math.min(
    MASSAGE_LAB_NOVATRIX_SOURCE_SPEED_MAX,
    Math.max(MASSAGE_LAB_NOVATRIX_SOURCE_SPEED_MIN, sourceSpeed),
  )
  const sourceRange = MASSAGE_LAB_NOVATRIX_SOURCE_SPEED_MAX - MASSAGE_LAB_NOVATRIX_SOURCE_SPEED_MIN
  const displayRange = MASSAGE_LAB_NOVATRIX_DISPLAY_SPEED_MAX - MASSAGE_LAB_NOVATRIX_DISPLAY_SPEED_MIN
  return Math.round(
    MASSAGE_LAB_NOVATRIX_DISPLAY_SPEED_MIN
      + ((clampedSpeed - MASSAGE_LAB_NOVATRIX_SOURCE_SPEED_MIN) / sourceRange) * displayRange,
  )
}

export function getMassageLabNovatrixSourceSpeed(displaySpeed: number) {
  const clampedDisplay = Math.min(
    MASSAGE_LAB_NOVATRIX_DISPLAY_SPEED_MAX,
    Math.max(MASSAGE_LAB_NOVATRIX_DISPLAY_SPEED_MIN, displaySpeed),
  )
  const sourceRange = MASSAGE_LAB_NOVATRIX_SOURCE_SPEED_MAX - MASSAGE_LAB_NOVATRIX_SOURCE_SPEED_MIN
  const displayRange = MASSAGE_LAB_NOVATRIX_DISPLAY_SPEED_MAX - MASSAGE_LAB_NOVATRIX_DISPLAY_SPEED_MIN
  return Math.round(
    (
      MASSAGE_LAB_NOVATRIX_SOURCE_SPEED_MIN
      + ((clampedDisplay - MASSAGE_LAB_NOVATRIX_DISPLAY_SPEED_MIN) / displayRange) * sourceRange
    ) * 1000,
  ) / 1000
}

export function getMassageLabNovatrixDisplayAmplitude(sourceAmplitude: number) {
  const clampedAmplitude = Math.min(
    MASSAGE_LAB_NOVATRIX_SOURCE_AMPLITUDE_MAX,
    Math.max(MASSAGE_LAB_NOVATRIX_SOURCE_AMPLITUDE_MIN, sourceAmplitude),
  )
  const sourceRange = MASSAGE_LAB_NOVATRIX_SOURCE_AMPLITUDE_MAX - MASSAGE_LAB_NOVATRIX_SOURCE_AMPLITUDE_MIN
  const displayRange = MASSAGE_LAB_NOVATRIX_DISPLAY_AMPLITUDE_MAX - MASSAGE_LAB_NOVATRIX_DISPLAY_AMPLITUDE_MIN
  return Math.round(
    MASSAGE_LAB_NOVATRIX_DISPLAY_AMPLITUDE_MIN
      + ((clampedAmplitude - MASSAGE_LAB_NOVATRIX_SOURCE_AMPLITUDE_MIN) / sourceRange) * displayRange,
  )
}

export function getMassageLabNovatrixSourceAmplitude(displayAmplitude: number) {
  const clampedDisplay = Math.min(
    MASSAGE_LAB_NOVATRIX_DISPLAY_AMPLITUDE_MAX,
    Math.max(MASSAGE_LAB_NOVATRIX_DISPLAY_AMPLITUDE_MIN, displayAmplitude),
  )
  const sourceRange = MASSAGE_LAB_NOVATRIX_SOURCE_AMPLITUDE_MAX - MASSAGE_LAB_NOVATRIX_SOURCE_AMPLITUDE_MIN
  const displayRange = MASSAGE_LAB_NOVATRIX_DISPLAY_AMPLITUDE_MAX - MASSAGE_LAB_NOVATRIX_DISPLAY_AMPLITUDE_MIN
  return Math.round(
    (
      MASSAGE_LAB_NOVATRIX_SOURCE_AMPLITUDE_MIN
      + ((clampedDisplay - MASSAGE_LAB_NOVATRIX_DISPLAY_AMPLITUDE_MIN) / displayRange) * sourceRange
    ) * 1000,
  ) / 1000
}

// Matrix Rain stores MassageLab's source speed multiplier; the UI maps it to
// a 1%-100% slider with a deliberately slow low end.
export function getMassageLabMatrixRainDisplaySpeed(sourceSpeed: number) {
  const clampedSpeed = Math.min(
    MASSAGE_LAB_MATRIX_RAIN_SOURCE_SPEED_MAX,
    Math.max(MASSAGE_LAB_MATRIX_RAIN_SOURCE_SPEED_MIN, sourceSpeed),
  )
  const sourceRange = MASSAGE_LAB_MATRIX_RAIN_SOURCE_SPEED_MAX - MASSAGE_LAB_MATRIX_RAIN_SOURCE_SPEED_MIN
  const displayRange = MASSAGE_LAB_HACKER_DISPLAY_SPEED_MAX - MASSAGE_LAB_HACKER_DISPLAY_SPEED_MIN
  return Math.round(
    MASSAGE_LAB_HACKER_DISPLAY_SPEED_MIN
      + ((clampedSpeed - MASSAGE_LAB_MATRIX_RAIN_SOURCE_SPEED_MIN) / sourceRange) * displayRange,
  )
}

export function getMassageLabMatrixRainSourceSpeed(displaySpeed: number) {
  const clampedDisplay = Math.min(
    MASSAGE_LAB_HACKER_DISPLAY_SPEED_MAX,
    Math.max(MASSAGE_LAB_HACKER_DISPLAY_SPEED_MIN, displaySpeed),
  )
  const sourceRange = MASSAGE_LAB_MATRIX_RAIN_SOURCE_SPEED_MAX - MASSAGE_LAB_MATRIX_RAIN_SOURCE_SPEED_MIN
  const displayRange = MASSAGE_LAB_HACKER_DISPLAY_SPEED_MAX - MASSAGE_LAB_HACKER_DISPLAY_SPEED_MIN
  return Math.round(
    (
      MASSAGE_LAB_MATRIX_RAIN_SOURCE_SPEED_MIN
      + ((clampedDisplay - MASSAGE_LAB_HACKER_DISPLAY_SPEED_MIN) / displayRange) * sourceRange
    ) * 1000,
  ) / 1000
}

// Photon Beam stores MassageLab's source speed multiplier while users see a
// consistent 1%-100% control alongside the other premium backgrounds.
export function getMassageLabPhotonBeamDisplaySpeed(sourceSpeed: number) {
  const clampedSpeed = Math.min(
    MASSAGE_LAB_PHOTON_BEAM_SOURCE_SPEED_MAX,
    Math.max(MASSAGE_LAB_PHOTON_BEAM_SOURCE_SPEED_MIN, sourceSpeed),
  )
  const sourceRange = MASSAGE_LAB_PHOTON_BEAM_SOURCE_SPEED_MAX - MASSAGE_LAB_PHOTON_BEAM_SOURCE_SPEED_MIN
  const displayRange = MASSAGE_LAB_PHOTON_BEAM_DISPLAY_SPEED_MAX - MASSAGE_LAB_PHOTON_BEAM_DISPLAY_SPEED_MIN
  return Math.round(
    MASSAGE_LAB_PHOTON_BEAM_DISPLAY_SPEED_MIN
      + ((clampedSpeed - MASSAGE_LAB_PHOTON_BEAM_SOURCE_SPEED_MIN) / sourceRange) * displayRange,
  )
}

export function getMassageLabPhotonBeamSourceSpeed(displaySpeed: number) {
  const clampedDisplay = Math.min(
    MASSAGE_LAB_PHOTON_BEAM_DISPLAY_SPEED_MAX,
    Math.max(MASSAGE_LAB_PHOTON_BEAM_DISPLAY_SPEED_MIN, displaySpeed),
  )
  const sourceRange = MASSAGE_LAB_PHOTON_BEAM_SOURCE_SPEED_MAX - MASSAGE_LAB_PHOTON_BEAM_SOURCE_SPEED_MIN
  const displayRange = MASSAGE_LAB_PHOTON_BEAM_DISPLAY_SPEED_MAX - MASSAGE_LAB_PHOTON_BEAM_DISPLAY_SPEED_MIN
  return Math.round(
    (
      MASSAGE_LAB_PHOTON_BEAM_SOURCE_SPEED_MIN
      + ((clampedDisplay - MASSAGE_LAB_PHOTON_BEAM_DISPLAY_SPEED_MIN) / displayRange) * sourceRange
    ) * 1000,
  ) / 1000
}

// The source MassageLab demo defaults to 0.4; MassageLab presents that as 1x.
export function getMassageLabSynthesisDisplaySpeed(sourceSpeed: number) {
  return Math.round((sourceSpeed / MASSAGE_LAB_SYNTHESIS_SPEED_BASE) * 100) / 100
}

export function getMassageLabSynthesisSourceSpeed(displaySpeed: number) {
  return Math.round(displaySpeed * MASSAGE_LAB_SYNTHESIS_SPEED_BASE * 1000) / 1000
}

export interface ChimerSettings {
  hours: number
  minutes: number
  intervalType: "preset" | "custom" | "areas"
  customInterval: number
  areasToMassage: number
  alertType: "chime" | "flash" | "both" | "haptic" | "chime-haptic" | "flash-haptic" | "all" | "silent"
  alertVolume: number
  hapticIntensityMs: number
  movingBackgroundEnabled: boolean
  backgroundId: BackgroundId
  keepTimerScreenAwake: boolean
  showTimerSeconds: boolean
  showCurrentTimeSeconds: boolean
  timeFormat: "12h" | "24h"
  primaryFontColor: string
  secondaryFontColor: string
  clockModeFontColor: string
  clockFontFamily: "digital" | "mono" | "sans" | "serif"
  clockStrokeEnabled: boolean
  clockStrokeColor: string
  clockStrokeWidth: number
  clockShadowEnabled: boolean
  clockShadowColor: string
  clockShadowStrength: number
  clockShadowDirection: number
  clockShadowDistance: number
  clockShadowFeather: number
  clockGlowEnabled: boolean
  clockGlowColor: string
  clockGlowStrength: number
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
  massageLabGradientPrimaryColor: string
  massageLabGradientHarmony: MassageLabGradientHarmony
  massageLabGradientOpacity: number
  massageLabStarsColor: string
  massageLabStarsSpeed: number
  massageLabStarsDensity: number
  massageLabStarsParallax: number
  massageLabHoleStrokeColor: string
  massageLabHoleParticleColor: string
  massageLabHoleLineCount: number
  massageLabHoleDiscCount: number
  massageLabLightSpeedWarpSpeed: number
  massageLabLightSpeedWarpSpeedVersion: number
  massageLabLightSpeedParticleCount: number
  massageLabLightSpeedLightColor: string
  massageLabLightSpeedIntensity: number
  massageLabLightSpeedRadius: number
  massageLabLightSpeedCylinderLength: number
  massageLabElectricMistColor: string
  massageLabElectricMistSpeed: number
  massageLabElectricMistControlVersion: number
  massageLabElectricMistDetail: number
  massageLabElectricMistDistortion: number
  massageLabElectricMistBrightness: number
  massageLabAstralFlowPaletteMode: MassageLabAstralFlowPaletteMode
  massageLabAstralFlowPrimaryColor: string
  massageLabAstralFlowHarmony: ColorHarmony
  massageLabAstralFlowColorOne: string
  massageLabAstralFlowColorTwo: string
  massageLabAstralFlowColorThree: string
  massageLabAstralFlowSpeed: number
  massageLabAstralFlowFlowMin: number
  massageLabAstralFlowFlowMax: number
  massageLabDeepSpaceNebulaPaletteMode: MassageLabDeepSpaceNebulaPaletteMode
  massageLabDeepSpaceNebulaPrimaryColor: string
  massageLabDeepSpaceNebulaHarmony: ColorHarmony
  massageLabDeepSpaceNebulaColorOne: string
  massageLabDeepSpaceNebulaColorTwo: string
  massageLabDeepSpaceNebulaColorThree: string
  massageLabDeepSpaceNebulaSpeed: number
  massageLabGridBloomColor: string
  massageLabGridBloomSpeed: number
  massageLabGridBloomGridScale: number
  massageLabGridBloomRotationSpeed: number
  massageLabGridBloomFadeFalloff: number
  massageLabGridBloomDistortionAmount: number
  massageLabGridBloomFlowSpeedX: number
  massageLabGridBloomFlowSpeedY: number
  massageLabChromeFlowPaletteMode: MassageLabChromeFlowPaletteMode
  massageLabChromeFlowPrimaryColor: string
  massageLabChromeFlowHarmony: ColorHarmony
  massageLabChromeFlowColorOne: string
  massageLabChromeFlowColorTwo: string
  massageLabChromeFlowFlowSpeed: number
  massageLabChromeFlowTimeScale: number
  massageLabWaveCurrentPaletteMode: MassageLabWaveCurrentPaletteMode
  massageLabWaveCurrentPrimaryColor: string
  massageLabWaveCurrentHarmony: ColorHarmony
  massageLabWaveCurrentBackgroundColor: string
  massageLabWaveCurrentColorOne: string
  massageLabWaveCurrentColorTwo: string
  massageLabWaveCurrentColorThree: string
  massageLabWaveCurrentSpeedX: number
  massageLabWaveCurrentSpeedY: number
  massageLabWaveCurrentAmplitude: number
  massageLabFerrofluidPaletteMode: MassageLabFerrofluidPaletteMode
  massageLabFerrofluidPrimaryColor: string
  massageLabFerrofluidHarmony: ColorHarmony
  massageLabFerrofluidColorOne: string
  massageLabFerrofluidColorTwo: string
  massageLabFerrofluidColorThree: string
  massageLabFerrofluidSpeed: number
  massageLabFerrofluidScale: number
  massageLabFerrofluidTurbulence: number
  massageLabFerrofluidFluidity: number
  massageLabFerrofluidRimWidth: number
  massageLabFerrofluidSharpness: number
  massageLabFerrofluidShimmer: number
  massageLabFerrofluidGlow: number
  massageLabFerrofluidFlowDirection: "up" | "down" | "left" | "right"
  massageLabFerrofluidOpacity: number
  massageLabLightfallPaletteMode: MassageLabLightfallPaletteMode
  massageLabLightfallPrimaryColor: string
  massageLabLightfallHarmony: ColorHarmony
  massageLabLightfallColorOne: string
  massageLabLightfallColorTwo: string
  massageLabLightfallColorThree: string
  massageLabLightfallBackgroundColor: string
  massageLabLightfallSpeed: number
  massageLabLightfallStreakCount: number
  massageLabLightfallStreakWidth: number
  massageLabLightfallStreakLength: number
  massageLabLightfallGlow: number
  massageLabLightfallDensity: number
  massageLabLightfallTwinkle: number
  massageLabLightfallZoom: number
  massageLabLightfallBackgroundGlow: number
  massageLabLightfallOpacity: number
  massageLabLightfallCursorEnabled: boolean
  massageLabLightfallCursorStrength: number
  massageLabLightfallCursorRadius: number
  massageLabLightfallCursorDampening: number
  massageLabLiquidEtherPaletteMode: MassageLabLiquidEtherPaletteMode
  massageLabLiquidEtherPrimaryColor: string
  massageLabLiquidEtherHarmony: ColorHarmony
  massageLabLiquidEtherColorOne: string
  massageLabLiquidEtherColorTwo: string
  massageLabLiquidEtherColorThree: string
  massageLabLiquidEtherCursorEnabled: boolean
  massageLabLiquidEtherMouseForce: number
  massageLabLiquidEtherCursorSize: number
  massageLabLiquidEtherIsViscous: boolean
  massageLabLiquidEtherViscous: number
  massageLabLiquidEtherIterationsViscous: number
  massageLabLiquidEtherIterationsPoisson: number
  massageLabLiquidEtherDt: number
  massageLabLiquidEtherBfecc: boolean
  massageLabLiquidEtherResolution: number
  massageLabLiquidEtherIsBounce: boolean
  massageLabLiquidEtherAutoDemo: boolean
  massageLabLiquidEtherAutoSpeed: number
  massageLabLiquidEtherAutoIntensity: number
  massageLabLiquidEtherAutoResumeDelay: number
  massageLabLiquidEtherAutoRampDuration: number
  massageLabLiquidEtherOpacity: number
  massageLabPrismHeight: number
  massageLabPrismBaseWidth: number
  massageLabPrismAnimationType: MassageLabPrismAnimationType
  massageLabPrismGlow: number
  massageLabPrismOffsetX: number
  massageLabPrismOffsetY: number
  massageLabPrismNoise: number
  massageLabPrismTransparent: boolean
  massageLabPrismScale: number
  massageLabPrismHueShift: number
  massageLabPrismColorFrequency: number
  massageLabPrismHoverStrength: number
  massageLabPrismInertia: number
  massageLabPrismBloom: number
  massageLabPrismTimeScale: number
  massageLabDarkVeilHueShift: number
  massageLabDarkVeilNoiseIntensity: number
  massageLabDarkVeilScanlineIntensity: number
  massageLabDarkVeilSpeed: number
  massageLabDarkVeilScanlineFrequency: number
  massageLabDarkVeilWarpAmount: number
  massageLabDarkVeilResolutionScale: number
  massageLabLightPillarPaletteMode: MassageLabLightPillarPaletteMode
  massageLabLightPillarPrimaryColor: string
  massageLabLightPillarHarmony: ColorHarmony
  massageLabLightPillarTopColor: string
  massageLabLightPillarBottomColor: string
  massageLabLightPillarIntensity: number
  massageLabLightPillarRotationSpeed: number
  massageLabLightPillarInteractive: boolean
  massageLabLightPillarGlowAmount: number
  massageLabLightPillarWidth: number
  massageLabLightPillarHeight: number
  massageLabLightPillarNoiseIntensity: number
  massageLabLightPillarBlendMode: MassageLabLightPillarBlendMode
  massageLabLightPillarRotation: number
  massageLabLightPillarQuality: MassageLabLightPillarQuality
  massageLabSilkPaletteMode: MassageLabSilkPaletteMode
  massageLabSilkPrimaryColor: string
  massageLabSilkHarmony: ColorHarmony
  massageLabSilkColor: string
  massageLabSilkSpeed: number
  massageLabSilkScale: number
  massageLabSilkNoiseIntensity: number
  massageLabSilkRotation: number
  massageLabFloatingLinesPaletteMode: MassageLabFloatingLinesPaletteMode
  massageLabFloatingLinesPrimaryColor: string
  massageLabFloatingLinesHarmony: ColorHarmony
  massageLabFloatingLinesColorOne: string
  massageLabFloatingLinesColorTwo: string
  massageLabFloatingLinesColorThree: string
  massageLabFloatingLinesEnableTop: boolean
  massageLabFloatingLinesEnableMiddle: boolean
  massageLabFloatingLinesEnableBottom: boolean
  massageLabFloatingLinesTopLineCount: number
  massageLabFloatingLinesMiddleLineCount: number
  massageLabFloatingLinesBottomLineCount: number
  massageLabFloatingLinesTopLineDistance: number
  massageLabFloatingLinesMiddleLineDistance: number
  massageLabFloatingLinesBottomLineDistance: number
  massageLabFloatingLinesTopWaveX: number
  massageLabFloatingLinesTopWaveY: number
  massageLabFloatingLinesTopWaveRotate: number
  massageLabFloatingLinesMiddleWaveX: number
  massageLabFloatingLinesMiddleWaveY: number
  massageLabFloatingLinesMiddleWaveRotate: number
  massageLabFloatingLinesBottomWaveX: number
  massageLabFloatingLinesBottomWaveY: number
  massageLabFloatingLinesBottomWaveRotate: number
  massageLabFloatingLinesAnimationSpeed: number
  massageLabFloatingLinesInteractive: boolean
  massageLabFloatingLinesBendRadius: number
  massageLabFloatingLinesBendStrength: number
  massageLabFloatingLinesMouseDamping: number
  massageLabFloatingLinesParallax: boolean
  massageLabFloatingLinesParallaxStrength: number
  massageLabFloatingLinesBlendMode: MassageLabFloatingLinesBlendMode
  massageLabSideRaysPaletteMode: MassageLabSideRaysPaletteMode
  massageLabSideRaysPrimaryColor: string
  massageLabSideRaysHarmony: ColorHarmony
  massageLabSideRaysColorOne: string
  massageLabSideRaysColorTwo: string
  massageLabSideRaysSpeed: number
  massageLabSideRaysIntensity: number
  massageLabSideRaysSpread: number
  massageLabSideRaysOrigin: MassageLabSideRaysOrigin
  massageLabSideRaysTilt: number
  massageLabSideRaysSaturation: number
  massageLabSideRaysBlend: number
  massageLabSideRaysFalloff: number
  massageLabSideRaysOpacity: number
  massageLabLightRaysPaletteMode: MassageLabLightRaysPaletteMode
  massageLabLightRaysPrimaryColor: string
  massageLabLightRaysHarmony: ColorHarmony
  massageLabLightRaysColor: string
  massageLabLightRaysOrigin: MassageLabLightRaysOrigin
  massageLabLightRaysSpeed: number
  massageLabLightRaysSpread: number
  massageLabLightRaysLength: number
  massageLabLightRaysPulsating: boolean
  massageLabLightRaysFadeDistance: number
  massageLabLightRaysSaturation: number
  massageLabLightRaysFollowMouse: boolean
  massageLabLightRaysMouseInfluence: number
  massageLabLightRaysNoiseAmount: number
  massageLabLightRaysDistortion: number
  massageLabPixelBlastPaletteMode: MassageLabPixelBlastPaletteMode
  massageLabPixelBlastPrimaryColor: string
  massageLabPixelBlastHarmony: ColorHarmony
  massageLabPixelBlastColor: string
  massageLabPixelBlastVariant: MassageLabPixelBlastVariant
  massageLabPixelBlastPixelSize: number
  massageLabPixelBlastAntialias: boolean
  massageLabPixelBlastPatternScale: number
  massageLabPixelBlastPatternDensity: number
  massageLabPixelBlastLiquid: boolean
  massageLabPixelBlastLiquidStrength: number
  massageLabPixelBlastLiquidRadius: number
  massageLabPixelBlastPixelSizeJitter: number
  massageLabPixelBlastEnableRipples: boolean
  massageLabPixelBlastRippleIntensityScale: number
  massageLabPixelBlastRippleThickness: number
  massageLabPixelBlastRippleSpeed: number
  massageLabPixelBlastLiquidWobbleSpeed: number
  massageLabPixelBlastAutoPauseOffscreen: boolean
  massageLabPixelBlastSpeed: number
  massageLabPixelBlastTransparent: boolean
  massageLabPixelBlastEdgeFade: number
  massageLabPixelBlastNoiseAmount: number
  massageLabColorBendsPaletteMode: MassageLabColorBendsPaletteMode
  massageLabColorBendsPrimaryColor: string
  massageLabColorBendsHarmony: ColorHarmony
  massageLabColorBendsColorOne: string
  massageLabColorBendsColorTwo: string
  massageLabColorBendsColorThree: string
  massageLabColorBendsColorFour: string
  massageLabColorBendsRotation: number
  massageLabColorBendsSpeed: number
  massageLabColorBendsTransparent: boolean
  massageLabColorBendsAutoRotate: number
  massageLabColorBendsScale: number
  massageLabColorBendsFrequency: number
  massageLabColorBendsWarpStrength: number
  massageLabColorBendsInteractive: boolean
  massageLabColorBendsMouseInfluence: number
  massageLabColorBendsParallax: number
  massageLabColorBendsNoise: number
  massageLabColorBendsIterations: number
  massageLabColorBendsIntensity: number
  massageLabColorBendsBandWidth: number
  massageLabEvilEyePaletteMode: MassageLabEvilEyePaletteMode
  massageLabEvilEyePrimaryColor: string
  massageLabEvilEyeHarmony: ColorHarmony
  massageLabEvilEyeColor: string
  massageLabEvilEyeBackgroundColor: string
  massageLabEvilEyeIntensity: number
  massageLabEvilEyePupilSize: number
  massageLabEvilEyeIrisWidth: number
  massageLabEvilEyeGlowIntensity: number
  massageLabEvilEyeScale: number
  massageLabEvilEyeNoiseScale: number
  massageLabEvilEyePupilFollow: number
  massageLabEvilEyeFlameSpeed: number
  massageLabEvilEyeInteractive: boolean
  massageLabLineWavesPaletteMode: MassageLabLineWavesPaletteMode
  massageLabLineWavesPrimaryColor: string
  massageLabLineWavesHarmony: ColorHarmony
  massageLabLineWavesColorOne: string
  massageLabLineWavesColorTwo: string
  massageLabLineWavesColorThree: string
  massageLabLineWavesSpeed: number
  massageLabLineWavesInnerLineCount: number
  massageLabLineWavesOuterLineCount: number
  massageLabLineWavesWarpIntensity: number
  massageLabLineWavesRotation: number
  massageLabLineWavesEdgeFadeWidth: number
  massageLabLineWavesColorCycleSpeed: number
  massageLabLineWavesBrightness: number
  massageLabLineWavesEnableMouseInteraction: boolean
  massageLabLineWavesMouseInfluence: number
  massageLabRadarPaletteMode: MassageLabRadarPaletteMode
  massageLabRadarPrimaryColor: string
  massageLabRadarHarmony: ColorHarmony
  massageLabRadarColor: string
  massageLabRadarBackgroundColor: string
  massageLabRadarSpeed: number
  massageLabRadarScale: number
  massageLabRadarRingCount: number
  massageLabRadarSpokeCount: number
  massageLabRadarRingThickness: number
  massageLabRadarSpokeThickness: number
  massageLabRadarSweepSpeed: number
  massageLabRadarSweepWidth: number
  massageLabRadarSweepLobes: number
  massageLabRadarFalloff: number
  massageLabRadarBrightness: number
  massageLabRadarEnableMouseInteraction: boolean
  massageLabRadarMouseInfluence: number
  massageLabSoftAuroraPaletteMode: MassageLabSoftAuroraPaletteMode
  massageLabSoftAuroraPrimaryColor: string
  massageLabSoftAuroraHarmony: ColorHarmony
  massageLabSoftAuroraColorOne: string
  massageLabSoftAuroraColorTwo: string
  massageLabSoftAuroraSpeed: number
  massageLabSoftAuroraScale: number
  massageLabSoftAuroraBrightness: number
  massageLabSoftAuroraNoiseFrequency: number
  massageLabSoftAuroraNoiseAmplitude: number
  massageLabSoftAuroraBandHeight: number
  massageLabSoftAuroraBandSpread: number
  massageLabSoftAuroraOctaveDecay: number
  massageLabSoftAuroraLayerOffset: number
  massageLabSoftAuroraColorSpeed: number
  massageLabSoftAuroraEnableMouseInteraction: boolean
  massageLabSoftAuroraMouseInfluence: number
  massageLabPlasmaPaletteMode: MassageLabPlasmaPaletteMode
  massageLabPlasmaPrimaryColor: string
  massageLabPlasmaHarmony: ColorHarmony
  massageLabPlasmaColor: string
  massageLabPlasmaSpeed: number
  massageLabPlasmaDirection: MassageLabPlasmaDirection
  massageLabPlasmaScale: number
  massageLabPlasmaOpacity: number
  massageLabPlasmaMouseInteractive: boolean
  massageLabPlasmaWavePaletteMode: MassageLabPlasmaWavePaletteMode
  massageLabPlasmaWavePrimaryColor: string
  massageLabPlasmaWaveHarmony: ColorHarmony
  massageLabPlasmaWaveColorOne: string
  massageLabPlasmaWaveColorTwo: string
  massageLabPlasmaWaveXOffset: number
  massageLabPlasmaWaveYOffset: number
  massageLabPlasmaWaveRotationDeg: number
  massageLabPlasmaWaveFocalLength: number
  massageLabPlasmaWaveSpeedOne: number
  massageLabPlasmaWaveSpeedTwo: number
  massageLabPlasmaWaveDirectionTwo: 1 | -1
  massageLabPlasmaWaveBendOne: number
  massageLabPlasmaWaveBendTwo: number
  massageLabParticlesPaletteMode: MassageLabParticlesPaletteMode
  massageLabParticlesPrimaryColor: string
  massageLabParticlesHarmony: ColorHarmony
  massageLabParticlesColorOne: string
  massageLabParticlesColorTwo: string
  massageLabParticlesColorThree: string
  massageLabParticlesCount: number
  massageLabParticlesSpread: number
  massageLabParticlesSpeed: number
  massageLabParticlesMoveOnHover: boolean
  massageLabParticlesHoverFactor: number
  massageLabParticlesAlpha: boolean
  massageLabParticlesBaseSize: number
  massageLabParticlesSizeRandomness: number
  massageLabParticlesCameraDistance: number
  massageLabParticlesDisableRotation: boolean
  massageLabParticlesPixelRatio: number
  massageLabGradientBlindsPaletteMode: MassageLabGradientBlindsPaletteMode
  massageLabGradientBlindsPrimaryColor: string
  massageLabGradientBlindsHarmony: ColorHarmony
  massageLabGradientBlindsColorOne: string
  massageLabGradientBlindsColorTwo: string
  massageLabGradientBlindsAngle: number
  massageLabGradientBlindsNoise: number
  massageLabGradientBlindsBlindCount: number
  massageLabGradientBlindsBlindMinWidth: number
  massageLabGradientBlindsMouseDampening: number
  massageLabGradientBlindsMirror: boolean
  massageLabGradientBlindsSpotlightRadius: number
  massageLabGradientBlindsSpotlightSoftness: number
  massageLabGradientBlindsSpotlightOpacity: number
  massageLabGradientBlindsDistort: number
  massageLabGradientBlindsShineDirection: MassageLabGradientBlindsShineDirection
  massageLabGradientBlindsBlendMode: MassageLabGradientBlindsBlendMode
  massageLabGradientBlindsDpr: number
  massageLabGradientBlindsEnableMouseInteraction: boolean
  massageLabGrainientPaletteMode: MassageLabGrainientPaletteMode
  massageLabGrainientPrimaryColor: string
  massageLabGrainientHarmony: ColorHarmony
  massageLabGrainientColorOne: string
  massageLabGrainientColorTwo: string
  massageLabGrainientColorThree: string
  massageLabGrainientTimeSpeed: number
  massageLabGrainientColorBalance: number
  massageLabGrainientWarpStrength: number
  massageLabGrainientWarpFrequency: number
  massageLabGrainientWarpSpeed: number
  massageLabGrainientWarpAmplitude: number
  massageLabGrainientBlendAngle: number
  massageLabGrainientBlendSoftness: number
  massageLabGrainientRotationAmount: number
  massageLabGrainientNoiseScale: number
  massageLabGrainientGrainAmount: number
  massageLabGrainientGrainScale: number
  massageLabGrainientGrainAnimated: boolean
  massageLabGrainientContrast: number
  massageLabGrainientGamma: number
  massageLabGrainientSaturation: number
  massageLabGrainientCenterX: number
  massageLabGrainientCenterY: number
  massageLabGrainientZoom: number
  massageLabGridScanPaletteMode: MassageLabGridScanPaletteMode
  massageLabGridScanPrimaryColor: string
  massageLabGridScanHarmony: ColorHarmony
  massageLabGridScanLinesColor: string
  massageLabGridScanScanColor: string
  massageLabGridScanSensitivity: number
  massageLabGridScanLineThickness: number
  massageLabGridScanScanOpacity: number
  massageLabGridScanGridScale: number
  massageLabGridScanLineStyle: MassageLabGridScanLineStyle
  massageLabGridScanLineJitter: number
  massageLabGridScanDirection: MassageLabGridScanDirection
  massageLabGridScanNoiseIntensity: number
  massageLabGridScanBloomOpacity: number
  massageLabGridScanScanGlow: number
  massageLabGridScanScanSoftness: number
  massageLabGridScanPhaseTaper: number
  massageLabGridScanScanDuration: number
  massageLabGridScanScanDelay: number
  massageLabGridScanEnablePointerInteraction: boolean
  massageLabGridScanScanOnClick: boolean
  massageLabBeamsPaletteMode: MassageLabBeamsPaletteMode
  massageLabBeamsPrimaryColor: string
  massageLabBeamsHarmony: ColorHarmony
  massageLabBeamsLightColor: string
  massageLabBeamsBeamWidth: number
  massageLabBeamsBeamHeight: number
  massageLabBeamsBeamNumber: number
  massageLabBeamsSpeed: number
  massageLabBeamsNoiseIntensity: number
  massageLabBeamsScale: number
  massageLabBeamsRotation: number
  massageLabPixelSnowPaletteMode: MassageLabPixelSnowPaletteMode
  massageLabPixelSnowPrimaryColor: string
  massageLabPixelSnowHarmony: ColorHarmony
  massageLabPixelSnowColor: string
  massageLabPixelSnowFlakeSize: number
  massageLabPixelSnowMinFlakeSize: number
  massageLabPixelSnowPixelResolution: number
  massageLabPixelSnowSpeed: number
  massageLabPixelSnowDepthFade: number
  massageLabPixelSnowFarPlane: number
  massageLabPixelSnowBrightness: number
  massageLabPixelSnowGamma: number
  massageLabPixelSnowDensity: number
  massageLabPixelSnowVariant: MassageLabPixelSnowVariant
  massageLabPixelSnowDirection: number
  massageLabLightningPaletteMode: MassageLabLightningPaletteMode
  massageLabLightningPrimaryColor: string
  massageLabLightningHarmony: ColorHarmony
  massageLabLightningColor: string
  massageLabLightningHue: number
  massageLabLightningXOffset: number
  massageLabLightningSpeed: number
  massageLabLightningIntensity: number
  massageLabLightningSize: number
  massageLabPrismaticBurstPaletteMode: MassageLabPrismaticBurstPaletteMode
  massageLabPrismaticBurstPrimaryColor: string
  massageLabPrismaticBurstHarmony: ColorHarmony
  massageLabPrismaticBurstColorOne: string
  massageLabPrismaticBurstColorTwo: string
  massageLabPrismaticBurstColorThree: string
  massageLabPrismaticBurstColorFour: string
  massageLabPrismaticBurstIntensity: number
  massageLabPrismaticBurstSpeed: number
  massageLabPrismaticBurstAnimationType: MassageLabPrismaticBurstAnimationType
  massageLabPrismaticBurstDistort: number
  massageLabPrismaticBurstOffsetX: number
  massageLabPrismaticBurstOffsetY: number
  massageLabPrismaticBurstHoverDampness: number
  massageLabPrismaticBurstRayCount: number
  massageLabPrismaticBurstMixBlendMode: MassageLabPrismaticBurstMixBlendMode
  massageLabGalaxyPaletteMode: MassageLabGalaxyPaletteMode
  massageLabGalaxyPrimaryColor: string
  massageLabGalaxyHarmony: ColorHarmony
  massageLabGalaxyColor: string
  massageLabGalaxyHueShift: number
  massageLabGalaxyFocalX: number
  massageLabGalaxyFocalY: number
  massageLabGalaxyRotationDeg: number
  massageLabGalaxyStarSpeed: number
  massageLabGalaxyDensity: number
  massageLabGalaxySpeed: number
  massageLabGalaxyMouseInteraction: boolean
  massageLabGalaxyGlowIntensity: number
  massageLabGalaxySaturation: number
  massageLabGalaxyMouseRepulsion: boolean
  massageLabGalaxyRepulsionStrength: number
  massageLabGalaxyTwinkleIntensity: number
  massageLabGalaxyRotationSpeed: number
  massageLabGalaxyAutoCenterRepulsion: number
  massageLabGalaxyTransparent: boolean
  massageLabDitherPaletteMode: MassageLabDitherPaletteMode
  massageLabDitherPrimaryColor: string
  massageLabDitherHarmony: ColorHarmony
  massageLabDitherColor: string
  massageLabDitherWaveSpeed: number
  massageLabDitherWaveFrequency: number
  massageLabDitherWaveAmplitude: number
  massageLabDitherColorNum: number
  massageLabDitherPixelSize: number
  massageLabDitherMouseInteraction: boolean
  massageLabDitherMouseRadius: number
  massageLabFaultyTerminalPaletteMode: MassageLabFaultyTerminalPaletteMode
  massageLabFaultyTerminalPrimaryColor: string
  massageLabFaultyTerminalHarmony: ColorHarmony
  massageLabFaultyTerminalTint: string
  massageLabFaultyTerminalScale: number
  massageLabFaultyTerminalGridMulX: number
  massageLabFaultyTerminalGridMulY: number
  massageLabFaultyTerminalDigitSize: number
  massageLabFaultyTerminalTimeScale: number
  massageLabFaultyTerminalScanlineIntensity: number
  massageLabFaultyTerminalGlitchAmount: number
  massageLabFaultyTerminalFlickerAmount: number
  massageLabFaultyTerminalNoiseAmp: number
  massageLabFaultyTerminalChromaticAberration: number
  massageLabFaultyTerminalDither: number
  massageLabFaultyTerminalCurvature: number
  massageLabFaultyTerminalMouseReact: boolean
  massageLabFaultyTerminalMouseStrength: number
  massageLabFaultyTerminalPageLoadAnimation: boolean
  massageLabFaultyTerminalBrightness: number
  massageLabRippleGridPaletteMode: MassageLabRippleGridPaletteMode
  massageLabRippleGridPrimaryColor: string
  massageLabRippleGridHarmony: ColorHarmony
  massageLabRippleGridColor: string
  massageLabRippleGridRippleIntensity: number
  massageLabRippleGridGridSize: number
  massageLabRippleGridGridThickness: number
  massageLabRippleGridFadeDistance: number
  massageLabRippleGridVignetteStrength: number
  massageLabRippleGridGlowIntensity: number
  massageLabRippleGridOpacity: number
  massageLabRippleGridGridRotation: number
  massageLabRippleGridMouseInteraction: boolean
  massageLabRippleGridMouseInteractionRadius: number
  massageLabDotFieldPaletteMode: MassageLabDotFieldPaletteMode
  massageLabDotFieldPrimaryColor: string
  massageLabDotFieldHarmony: ColorHarmony
  massageLabDotFieldGradientFromColor: string
  massageLabDotFieldGradientFromAlpha: number
  massageLabDotFieldGradientToColor: string
  massageLabDotFieldGradientToAlpha: number
  massageLabDotFieldGlowColor: string
  massageLabDotFieldDotRadius: number
  massageLabDotFieldDotSpacing: number
  massageLabDotFieldCursorRadius: number
  massageLabDotFieldCursorForce: number
  massageLabDotFieldBulgeOnly: boolean
  massageLabDotFieldBulgeStrength: number
  massageLabDotFieldGlowRadius: number
  massageLabDotFieldSparkle: boolean
  massageLabDotFieldWaveAmplitude: number
  massageLabDotFieldCursorInteraction: boolean
  massageLabDotGridPaletteMode: MassageLabDotGridPaletteMode
  massageLabDotGridPrimaryColor: string
  massageLabDotGridHarmony: ColorHarmony
  massageLabDotGridBaseColor: string
  massageLabDotGridActiveColor: string
  massageLabDotGridDotSize: number
  massageLabDotGridGap: number
  massageLabDotGridProximity: number
  massageLabDotGridSpeedTrigger: number
  massageLabDotGridShockRadius: number
  massageLabDotGridShockStrength: number
  massageLabDotGridMaxSpeed: number
  massageLabDotGridResistance: number
  massageLabDotGridReturnDuration: number
  massageLabDotGridCursorInteraction: boolean
  massageLabDotGridClickShock: boolean
  massageLabThreadsPaletteMode: MassageLabThreadsPaletteMode
  massageLabThreadsPrimaryColor: string
  massageLabThreadsHarmony: ColorHarmony
  massageLabThreadsColor: string
  massageLabThreadsAmplitude: number
  massageLabThreadsDistance: number
  massageLabThreadsEnableMouseInteraction: boolean
  massageLabIridescencePaletteMode: MassageLabIridescencePaletteMode
  massageLabIridescencePrimaryColor: string
  massageLabIridescenceHarmony: ColorHarmony
  massageLabIridescenceColor: string
  massageLabIridescenceSpeed: number
  massageLabIridescenceAmplitude: number
  massageLabIridescenceMouseReact: boolean
  massageLabWavesPaletteMode: MassageLabWavesPaletteMode
  massageLabWavesPrimaryColor: string
  massageLabWavesHarmony: ColorHarmony
  massageLabWavesLineColor: string
  massageLabWavesBackgroundColor: string
  massageLabWavesTransparentBackground: boolean
  massageLabWavesSpeedX: number
  massageLabWavesSpeedY: number
  massageLabWavesAmplitudeX: number
  massageLabWavesAmplitudeY: number
  massageLabWavesGapX: number
  massageLabWavesGapY: number
  massageLabWavesFriction: number
  massageLabWavesTension: number
  massageLabWavesMaxCursorMove: number
  massageLabWavesCursorInteraction: boolean
  massageLabGridDistortionPaletteMode: MassageLabGridDistortionPaletteMode
  massageLabGridDistortionPrimaryColor: string
  massageLabGridDistortionHarmony: ColorHarmony
  massageLabGridDistortionColorOne: string
  massageLabGridDistortionColorTwo: string
  massageLabGridDistortionColorThree: string
  massageLabGridDistortionGrid: number
  massageLabGridDistortionMouse: number
  massageLabGridDistortionStrength: number
  massageLabGridDistortionRelaxation: number
  massageLabGridDistortionCursorInteraction: boolean
  massageLabOrbPaletteMode: MassageLabOrbPaletteMode
  massageLabOrbPrimaryColor: string
  massageLabOrbHarmony: ColorHarmony
  massageLabOrbColor: string
  massageLabOrbHue: number
  massageLabOrbHoverIntensity: number
  massageLabOrbRotateOnHover: boolean
  massageLabOrbForceHoverState: boolean
  massageLabOrbBackgroundColor: string
  massageLabOrbCursorInteraction: boolean
  massageLabLetterGlitchPaletteMode: MassageLabLetterGlitchPaletteMode
  massageLabLetterGlitchPrimaryColor: string
  massageLabLetterGlitchHarmony: ColorHarmony
  massageLabLetterGlitchColorOne: string
  massageLabLetterGlitchColorTwo: string
  massageLabLetterGlitchColorThree: string
  massageLabLetterGlitchGlitchSpeed: number
  massageLabLetterGlitchCenterVignette: boolean
  massageLabLetterGlitchOuterVignette: boolean
  massageLabLetterGlitchSmooth: boolean
  massageLabLetterGlitchCharacters: string
  massageLabGridMotionPaletteMode: MassageLabGridMotionPaletteMode
  massageLabGridMotionPrimaryColor: string
  massageLabGridMotionHarmony: ColorHarmony
  massageLabGridMotionGradientColor: string
  massageLabGridMotionTileColor: string
  massageLabGridMotionTextColor: string
  massageLabGridMotionMaxMoveAmount: number
  massageLabGridMotionBaseDuration: number
  massageLabGridMotionCursorInteraction: boolean
  massageLabShapeGridPaletteMode: MassageLabShapeGridPaletteMode
  massageLabShapeGridPrimaryColor: string
  massageLabShapeGridHarmony: ColorHarmony
  massageLabShapeGridBorderColor: string
  massageLabShapeGridHoverFillColor: string
  massageLabShapeGridDirection: "right" | "left" | "up" | "down" | "diagonal"
  massageLabShapeGridSpeed: number
  massageLabShapeGridSquareSize: number
  massageLabShapeGridShape: "square" | "circle" | "triangle" | "hexagon"
  massageLabShapeGridHoverTrailAmount: number
  massageLabShapeGridCursorInteraction: boolean
  massageLabLiquidChromePaletteMode: MassageLabLiquidChromePaletteMode
  massageLabLiquidChromePrimaryColor: string
  massageLabLiquidChromeHarmony: ColorHarmony
  massageLabLiquidChromeBaseColor: string
  massageLabLiquidChromeSpeed: number
  massageLabLiquidChromeAmplitude: number
  massageLabLiquidChromeFrequencyX: number
  massageLabLiquidChromeFrequencyY: number
  massageLabLiquidChromeInteractive: boolean
  massageLabBalatroPaletteMode: MassageLabBalatroPaletteMode
  massageLabBalatroPrimaryColor: string
  massageLabBalatroHarmony: ColorHarmony
  massageLabBalatroColorOne: string
  massageLabBalatroColorTwo: string
  massageLabBalatroColorThree: string
  massageLabBalatroSpinRotation: number
  massageLabBalatroSpinSpeed: number
  massageLabBalatroOffsetX: number
  massageLabBalatroOffsetY: number
  massageLabBalatroContrast: number
  massageLabBalatroLighting: number
  massageLabBalatroSpinAmount: number
  massageLabBalatroPixelFilter: number
  massageLabBalatroSpinEase: number
  massageLabBalatroIsRotate: boolean
  massageLabBalatroMouseInteraction: boolean
  massageLabNovatrixPaletteMode: MassageLabNovatrixPaletteMode
  massageLabNovatrixPrimaryColor: string
  massageLabNovatrixHarmony: ColorHarmony
  massageLabNovatrixColor: string
  massageLabNovatrixSpeed: number
  massageLabNovatrixAmplitude: number
  massageLabMatrixRainPaletteMode: MassageLabMatrixRainPaletteMode
  massageLabMatrixRainPrimaryColor: string
  massageLabMatrixRainHarmony: ColorHarmony
  massageLabMatrixRainColor: string
  massageLabMatrixRainSpeed: number
  massageLabMatrixRainFontSize: number
  massageLabPhotonBeamPaletteMode: MassageLabPhotonBeamPaletteMode
  massageLabPhotonBeamPrimaryColor: string
  massageLabPhotonBeamHarmony: ColorHarmony
  massageLabPhotonBeamColorBg: string
  massageLabPhotonBeamColorLine: string
  massageLabPhotonBeamColorSignal: string
  massageLabPhotonBeamUseColor2: boolean
  massageLabPhotonBeamColorSignal2: string
  massageLabPhotonBeamUseColor3: boolean
  massageLabPhotonBeamColorSignal3: string
  massageLabPhotonBeamLineCount: number
  massageLabPhotonBeamSpreadHeight: number
  massageLabPhotonBeamSpreadDepth: number
  massageLabPhotonBeamCurveLength: number
  massageLabPhotonBeamStraightLength: number
  massageLabPhotonBeamCurvePower: number
  massageLabPhotonBeamWaveSpeed: number
  massageLabPhotonBeamWaveHeight: number
  massageLabPhotonBeamLineOpacity: number
  massageLabPhotonBeamSignalCount: number
  massageLabPhotonBeamSpeedGlobal: number
  massageLabPhotonBeamTrailLength: number
  massageLabPhotonBeamBloomStrength: number
  massageLabPhotonBeamBloomRadius: number
  massageLab3DGlobeViewStyle: "realistic" | "graphic"
  massageLab3DGlobeBackgroundColor: string
  massageLab3DGlobeGlobeColor: string
  massageLab3DGlobeGraphicMapColor: string
  massageLab3DGlobeGraphicGlowColor: string
  massageLab3DGlobeGraphicMarkerColor: string
  massageLab3DGlobeGraphicMapSamples: number
  massageLab3DGlobeAutoRotateSpeed: number
  massageLab3DGlobeReverseSpin: boolean
  massageLab3DGlobeScale: number
  massageLab3DGlobeBumpScale: number
  massageLab3DGlobeAmbientIntensity: number
  massageLab3DGlobePointLightIntensity: number
  massageLab3DGlobeLightingMode: "manual" | "sun"
  massageLab3DGlobeEnablePan: boolean
  massageLab3DGlobePanX: number
  massageLab3DGlobePanY: number
  massageLab3DGlobeShowTilt: boolean
  massageLab3DGlobeShowAtmosphere: boolean
  massageLab3DGlobeAtmosphereColor: string
  massageLab3DGlobeAtmosphereIntensity: number
  massageLab3DGlobeAtmosphereBlur: number
  massageLab3DGlobeShowWireframe: boolean
  massageLab3DGlobeWireframeColor: string
  massageLab3DGlobeMarkerEnabled: boolean
  massageLab3DGlobeMarkerLat: number
  massageLab3DGlobeMarkerLng: number
  massageLab3DGlobeMarkerLabel: string
  massageLab3DGlobeMarkerIcon: "pin" | "person" | "heart" | "star" | "home"
  massageLab3DGlobeMarkerSize: number
  massageLabRetroGridBackgroundColor: string
  massageLabRetroGridLightLineColor: string
  massageLabRetroGridDarkLineColor: string
  massageLabRetroGridAngle: number
  massageLabRetroGridCellSize: number
  massageLabRetroGridOpacity: number
  massageLabAerialRaysBackgroundColor: string
  massageLabAerialRaysColor: string
  massageLabAerialRaysCount: number
  massageLabAerialRaysBlur: number
  massageLabAerialRaysSpeed: number
  massageLabAerialRaysLength: number
  massageLabAerialRaysOpacity: number
  massageLabSynthesisPaletteMode: MassageLabSynthesisPaletteMode
  massageLabSynthesisPrimaryColor: string
  massageLabSynthesisHarmony: ColorHarmony
  massageLabSynthesisColorOne: string
  massageLabSynthesisColorTwo: string
  massageLabSynthesisColorThree: string
  massageLabSynthesisSpeed: number
  massageLabSynthesisComplexity: number
  massageLabSynthesisScale: number
  massageLabSynthesisDistortion: number
  massageLabSynthesisGlowIntensity: number
  massageLabSynthesisFlowFrequency: number
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

type MassageLabAstralFlowColorSettings = Pick<
  ChimerSettings,
  | "massageLabAstralFlowPaletteMode"
  | "massageLabAstralFlowPrimaryColor"
  | "massageLabAstralFlowHarmony"
  | "massageLabAstralFlowColorOne"
  | "massageLabAstralFlowColorTwo"
  | "massageLabAstralFlowColorThree"
>

type MassageLabDeepSpaceNebulaColorSettings = Pick<
  ChimerSettings,
  | "massageLabDeepSpaceNebulaPaletteMode"
  | "massageLabDeepSpaceNebulaPrimaryColor"
  | "massageLabDeepSpaceNebulaHarmony"
  | "massageLabDeepSpaceNebulaColorOne"
  | "massageLabDeepSpaceNebulaColorTwo"
  | "massageLabDeepSpaceNebulaColorThree"
>

type MassageLabSynthesisColorSettings = Pick<
  ChimerSettings,
  | "massageLabSynthesisPaletteMode"
  | "massageLabSynthesisPrimaryColor"
  | "massageLabSynthesisHarmony"
  | "massageLabSynthesisColorOne"
  | "massageLabSynthesisColorTwo"
  | "massageLabSynthesisColorThree"
>

type MassageLabChromeFlowColorSettings = Pick<
  ChimerSettings,
  | "massageLabChromeFlowPaletteMode"
  | "massageLabChromeFlowPrimaryColor"
  | "massageLabChromeFlowHarmony"
  | "massageLabChromeFlowColorOne"
  | "massageLabChromeFlowColorTwo"
>

type MassageLabWaveCurrentColorSettings = Pick<
  ChimerSettings,
  | "massageLabWaveCurrentPaletteMode"
  | "massageLabWaveCurrentPrimaryColor"
  | "massageLabWaveCurrentHarmony"
  | "massageLabWaveCurrentBackgroundColor"
  | "massageLabWaveCurrentColorOne"
  | "massageLabWaveCurrentColorTwo"
  | "massageLabWaveCurrentColorThree"
>

type MassageLabFerrofluidColorSettings = Pick<
  ChimerSettings,
  | "massageLabFerrofluidPaletteMode"
  | "massageLabFerrofluidPrimaryColor"
  | "massageLabFerrofluidHarmony"
  | "massageLabFerrofluidColorOne"
  | "massageLabFerrofluidColorTwo"
  | "massageLabFerrofluidColorThree"
>

type MassageLabLightfallColorSettings = Pick<
  ChimerSettings,
  | "massageLabLightfallPaletteMode"
  | "massageLabLightfallPrimaryColor"
  | "massageLabLightfallHarmony"
  | "massageLabLightfallColorOne"
  | "massageLabLightfallColorTwo"
  | "massageLabLightfallColorThree"
>

type MassageLabLiquidEtherColorSettings = Pick<
  ChimerSettings,
  | "massageLabLiquidEtherPaletteMode"
  | "massageLabLiquidEtherPrimaryColor"
  | "massageLabLiquidEtherHarmony"
  | "massageLabLiquidEtherColorOne"
  | "massageLabLiquidEtherColorTwo"
  | "massageLabLiquidEtherColorThree"
>

type MassageLabLightPillarColorSettings = Pick<
  ChimerSettings,
  | "massageLabLightPillarPaletteMode"
  | "massageLabLightPillarPrimaryColor"
  | "massageLabLightPillarHarmony"
  | "massageLabLightPillarTopColor"
  | "massageLabLightPillarBottomColor"
>

type MassageLabSilkColorSettings = Pick<
  ChimerSettings,
  | "massageLabSilkPaletteMode"
  | "massageLabSilkPrimaryColor"
  | "massageLabSilkHarmony"
  | "massageLabSilkColor"
>

type MassageLabFloatingLinesColorSettings = Pick<
  ChimerSettings,
  | "massageLabFloatingLinesPaletteMode"
  | "massageLabFloatingLinesPrimaryColor"
  | "massageLabFloatingLinesHarmony"
  | "massageLabFloatingLinesColorOne"
  | "massageLabFloatingLinesColorTwo"
  | "massageLabFloatingLinesColorThree"
>

type MassageLabSideRaysColorSettings = Pick<
  ChimerSettings,
  | "massageLabSideRaysPaletteMode"
  | "massageLabSideRaysPrimaryColor"
  | "massageLabSideRaysHarmony"
  | "massageLabSideRaysColorOne"
  | "massageLabSideRaysColorTwo"
>

type MassageLabLightRaysColorSettings = Pick<
  ChimerSettings,
  | "massageLabLightRaysPaletteMode"
  | "massageLabLightRaysPrimaryColor"
  | "massageLabLightRaysHarmony"
  | "massageLabLightRaysColor"
>

type MassageLabPixelBlastColorSettings = Pick<
  ChimerSettings,
  | "massageLabPixelBlastPaletteMode"
  | "massageLabPixelBlastPrimaryColor"
  | "massageLabPixelBlastHarmony"
  | "massageLabPixelBlastColor"
>

type MassageLabColorBendsColorSettings = Pick<
  ChimerSettings,
  | "massageLabColorBendsPaletteMode"
  | "massageLabColorBendsPrimaryColor"
  | "massageLabColorBendsHarmony"
  | "massageLabColorBendsColorOne"
  | "massageLabColorBendsColorTwo"
  | "massageLabColorBendsColorThree"
  | "massageLabColorBendsColorFour"
>

type MassageLabEvilEyeColorSettings = Pick<
  ChimerSettings,
  | "massageLabEvilEyePaletteMode"
  | "massageLabEvilEyePrimaryColor"
  | "massageLabEvilEyeHarmony"
  | "massageLabEvilEyeColor"
>

type MassageLabLineWavesColorSettings = Pick<
  ChimerSettings,
  | "massageLabLineWavesPaletteMode"
  | "massageLabLineWavesPrimaryColor"
  | "massageLabLineWavesHarmony"
  | "massageLabLineWavesColorOne"
  | "massageLabLineWavesColorTwo"
  | "massageLabLineWavesColorThree"
>

type MassageLabRadarColorSettings = Pick<
  ChimerSettings,
  | "massageLabRadarPaletteMode"
  | "massageLabRadarPrimaryColor"
  | "massageLabRadarHarmony"
  | "massageLabRadarColor"
>

type MassageLabSoftAuroraColorSettings = Pick<
  ChimerSettings,
  | "massageLabSoftAuroraPaletteMode"
  | "massageLabSoftAuroraPrimaryColor"
  | "massageLabSoftAuroraHarmony"
  | "massageLabSoftAuroraColorOne"
  | "massageLabSoftAuroraColorTwo"
>

type MassageLabPlasmaColorSettings = Pick<
  ChimerSettings,
  | "massageLabPlasmaPaletteMode"
  | "massageLabPlasmaPrimaryColor"
  | "massageLabPlasmaHarmony"
  | "massageLabPlasmaColor"
>

type MassageLabPlasmaWaveColorSettings = Pick<
  ChimerSettings,
  | "massageLabPlasmaWavePaletteMode"
  | "massageLabPlasmaWavePrimaryColor"
  | "massageLabPlasmaWaveHarmony"
  | "massageLabPlasmaWaveColorOne"
  | "massageLabPlasmaWaveColorTwo"
>

type MassageLabParticlesColorSettings = Pick<
  ChimerSettings,
  | "massageLabParticlesPaletteMode"
  | "massageLabParticlesPrimaryColor"
  | "massageLabParticlesHarmony"
  | "massageLabParticlesColorOne"
  | "massageLabParticlesColorTwo"
  | "massageLabParticlesColorThree"
>

type MassageLabGradientBlindsColorSettings = Pick<
  ChimerSettings,
  | "massageLabGradientBlindsPaletteMode"
  | "massageLabGradientBlindsPrimaryColor"
  | "massageLabGradientBlindsHarmony"
  | "massageLabGradientBlindsColorOne"
  | "massageLabGradientBlindsColorTwo"
>

type MassageLabGrainientColorSettings = Pick<
  ChimerSettings,
  | "massageLabGrainientPaletteMode"
  | "massageLabGrainientPrimaryColor"
  | "massageLabGrainientHarmony"
  | "massageLabGrainientColorOne"
  | "massageLabGrainientColorTwo"
  | "massageLabGrainientColorThree"
>

type MassageLabGridScanColorSettings = Pick<
  ChimerSettings,
  | "massageLabGridScanPaletteMode"
  | "massageLabGridScanPrimaryColor"
  | "massageLabGridScanHarmony"
  | "massageLabGridScanLinesColor"
  | "massageLabGridScanScanColor"
>

type MassageLabBeamsColorSettings = Pick<
  ChimerSettings,
  | "massageLabBeamsPaletteMode"
  | "massageLabBeamsPrimaryColor"
  | "massageLabBeamsHarmony"
  | "massageLabBeamsLightColor"
>

type MassageLabPixelSnowColorSettings = Pick<
  ChimerSettings,
  | "massageLabPixelSnowPaletteMode"
  | "massageLabPixelSnowPrimaryColor"
  | "massageLabPixelSnowHarmony"
  | "massageLabPixelSnowColor"
>

type MassageLabLightningColorSettings = Pick<
  ChimerSettings,
  | "massageLabLightningPaletteMode"
  | "massageLabLightningPrimaryColor"
  | "massageLabLightningHarmony"
  | "massageLabLightningColor"
  | "massageLabLightningHue"
>

type MassageLabPrismaticBurstColorSettings = Pick<
  ChimerSettings,
  | "massageLabPrismaticBurstPaletteMode"
  | "massageLabPrismaticBurstPrimaryColor"
  | "massageLabPrismaticBurstHarmony"
  | "massageLabPrismaticBurstColorOne"
  | "massageLabPrismaticBurstColorTwo"
  | "massageLabPrismaticBurstColorThree"
  | "massageLabPrismaticBurstColorFour"
>

type MassageLabGalaxyColorSettings = Pick<
  ChimerSettings,
  | "massageLabGalaxyPaletteMode"
  | "massageLabGalaxyPrimaryColor"
  | "massageLabGalaxyHarmony"
  | "massageLabGalaxyColor"
  | "massageLabGalaxyHueShift"
>

type MassageLabDitherColorSettings = Pick<
  ChimerSettings,
  | "massageLabDitherPaletteMode"
  | "massageLabDitherPrimaryColor"
  | "massageLabDitherHarmony"
  | "massageLabDitherColor"
>

type MassageLabFaultyTerminalColorSettings = Pick<
  ChimerSettings,
  | "massageLabFaultyTerminalPaletteMode"
  | "massageLabFaultyTerminalPrimaryColor"
  | "massageLabFaultyTerminalHarmony"
  | "massageLabFaultyTerminalTint"
>

type MassageLabRippleGridColorSettings = Pick<
  ChimerSettings,
  | "massageLabRippleGridPaletteMode"
  | "massageLabRippleGridPrimaryColor"
  | "massageLabRippleGridHarmony"
  | "massageLabRippleGridColor"
>

type MassageLabDotFieldColorSettings = Pick<
  ChimerSettings,
  | "massageLabDotFieldPaletteMode"
  | "massageLabDotFieldPrimaryColor"
  | "massageLabDotFieldHarmony"
  | "massageLabDotFieldGradientFromColor"
  | "massageLabDotFieldGradientFromAlpha"
  | "massageLabDotFieldGradientToColor"
  | "massageLabDotFieldGradientToAlpha"
  | "massageLabDotFieldGlowColor"
>

type MassageLabDotGridColorSettings = Pick<
  ChimerSettings,
  | "massageLabDotGridPaletteMode"
  | "massageLabDotGridPrimaryColor"
  | "massageLabDotGridHarmony"
  | "massageLabDotGridBaseColor"
  | "massageLabDotGridActiveColor"
>

type MassageLabThreadsColorSettings = Pick<
  ChimerSettings,
  | "massageLabThreadsPaletteMode"
  | "massageLabThreadsPrimaryColor"
  | "massageLabThreadsHarmony"
  | "massageLabThreadsColor"
>

type MassageLabIridescenceColorSettings = Pick<
  ChimerSettings,
  | "massageLabIridescencePaletteMode"
  | "massageLabIridescencePrimaryColor"
  | "massageLabIridescenceHarmony"
  | "massageLabIridescenceColor"
>

type MassageLabWavesColorSettings = Pick<
  ChimerSettings,
  | "massageLabWavesPaletteMode"
  | "massageLabWavesPrimaryColor"
  | "massageLabWavesHarmony"
  | "massageLabWavesLineColor"
>

type MassageLabGridDistortionColorSettings = Pick<
  ChimerSettings,
  | "massageLabGridDistortionPaletteMode"
  | "massageLabGridDistortionPrimaryColor"
  | "massageLabGridDistortionHarmony"
  | "massageLabGridDistortionColorOne"
  | "massageLabGridDistortionColorTwo"
  | "massageLabGridDistortionColorThree"
>

type MassageLabOrbColorSettings = Pick<
  ChimerSettings,
  | "massageLabOrbPaletteMode"
  | "massageLabOrbPrimaryColor"
  | "massageLabOrbHarmony"
  | "massageLabOrbColor"
  | "massageLabOrbHue"
>

type MassageLabLetterGlitchColorSettings = Pick<
  ChimerSettings,
  | "massageLabLetterGlitchPaletteMode"
  | "massageLabLetterGlitchPrimaryColor"
  | "massageLabLetterGlitchHarmony"
  | "massageLabLetterGlitchColorOne"
  | "massageLabLetterGlitchColorTwo"
  | "massageLabLetterGlitchColorThree"
>

type MassageLabGridMotionColorSettings = Pick<
  ChimerSettings,
  | "massageLabGridMotionPaletteMode"
  | "massageLabGridMotionPrimaryColor"
  | "massageLabGridMotionHarmony"
  | "massageLabGridMotionGradientColor"
  | "massageLabGridMotionTileColor"
  | "massageLabGridMotionTextColor"
>

type MassageLabShapeGridColorSettings = Pick<
  ChimerSettings,
  | "massageLabShapeGridPaletteMode"
  | "massageLabShapeGridPrimaryColor"
  | "massageLabShapeGridHarmony"
  | "massageLabShapeGridBorderColor"
  | "massageLabShapeGridHoverFillColor"
>

type MassageLabLiquidChromeColorSettings = Pick<
  ChimerSettings,
  | "massageLabLiquidChromePaletteMode"
  | "massageLabLiquidChromePrimaryColor"
  | "massageLabLiquidChromeHarmony"
  | "massageLabLiquidChromeBaseColor"
>

type MassageLabBalatroColorSettings = Pick<
  ChimerSettings,
  | "massageLabBalatroPaletteMode"
  | "massageLabBalatroPrimaryColor"
  | "massageLabBalatroHarmony"
  | "massageLabBalatroColorOne"
  | "massageLabBalatroColorTwo"
  | "massageLabBalatroColorThree"
>

type MassageLabNovatrixColorSettings = Pick<
  ChimerSettings,
  | "massageLabNovatrixPaletteMode"
  | "massageLabNovatrixPrimaryColor"
  | "massageLabNovatrixHarmony"
  | "massageLabNovatrixColor"
>

type MassageLabMatrixRainColorSettings = Pick<
  ChimerSettings,
  | "massageLabMatrixRainPaletteMode"
  | "massageLabMatrixRainPrimaryColor"
  | "massageLabMatrixRainHarmony"
  | "massageLabMatrixRainColor"
>

type MassageLabPhotonBeamColorSettings = Pick<
  ChimerSettings,
  | "massageLabPhotonBeamPaletteMode"
  | "massageLabPhotonBeamPrimaryColor"
  | "massageLabPhotonBeamHarmony"
  | "massageLabPhotonBeamColorBg"
  | "massageLabPhotonBeamColorLine"
  | "massageLabPhotonBeamColorSignal"
  | "massageLabPhotonBeamUseColor2"
  | "massageLabPhotonBeamColorSignal2"
  | "massageLabPhotonBeamUseColor3"
  | "massageLabPhotonBeamColorSignal3"
>

export function resolveMassageLabAstralFlowColors(settings: MassageLabAstralFlowColorSettings): [string, string, string] {
  if (settings.massageLabAstralFlowPaletteMode === "harmony") {
    return createMassageLabSynthesisHarmonyPalette(
      settings.massageLabAstralFlowPrimaryColor,
      settings.massageLabAstralFlowHarmony,
    )
  }

  return [
    settings.massageLabAstralFlowColorOne,
    settings.massageLabAstralFlowColorTwo,
    settings.massageLabAstralFlowColorThree,
  ]
}

export function resolveMassageLabDeepSpaceNebulaColors(
  settings: MassageLabDeepSpaceNebulaColorSettings,
): [string, string, string] {
  if (settings.massageLabDeepSpaceNebulaPaletteMode === "harmony") {
    return createMassageLabDeepSpaceNebulaHarmonyPalette(
      settings.massageLabDeepSpaceNebulaPrimaryColor,
      settings.massageLabDeepSpaceNebulaHarmony,
    )
  }

  return [
    settings.massageLabDeepSpaceNebulaColorOne,
    settings.massageLabDeepSpaceNebulaColorTwo,
    settings.massageLabDeepSpaceNebulaColorThree,
  ]
}

export function resolveMassageLabSynthesisColors(settings: MassageLabSynthesisColorSettings): [string, string, string] {
  if (settings.massageLabSynthesisPaletteMode === "harmony") {
    return createMassageLabSynthesisHarmonyPalette(
      settings.massageLabSynthesisPrimaryColor,
      settings.massageLabSynthesisHarmony,
    )
  }

  return [
    settings.massageLabSynthesisColorOne,
    settings.massageLabSynthesisColorTwo,
    settings.massageLabSynthesisColorThree,
  ]
}

export function resolveMassageLabChromeFlowColors(settings: MassageLabChromeFlowColorSettings): [string, string] {
  if (settings.massageLabChromeFlowPaletteMode === "harmony") {
    return createMassageLabChromeFlowHarmonyPalette(
      settings.massageLabChromeFlowPrimaryColor,
      settings.massageLabChromeFlowHarmony,
    )
  }

  return [
    settings.massageLabChromeFlowColorOne,
    settings.massageLabChromeFlowColorTwo,
  ]
}

export function resolveMassageLabWaveCurrentColors(settings: MassageLabWaveCurrentColorSettings): [string, string, string, string] {
  if (settings.massageLabWaveCurrentPaletteMode === "harmony") {
    return createMassageLabWaveCurrentHarmonyPalette(
      settings.massageLabWaveCurrentPrimaryColor,
      settings.massageLabWaveCurrentHarmony,
    )
  }

  return [
    settings.massageLabWaveCurrentBackgroundColor,
    settings.massageLabWaveCurrentColorOne,
    settings.massageLabWaveCurrentColorTwo,
    settings.massageLabWaveCurrentColorThree,
  ]
}

export function resolveMassageLabFerrofluidColors(settings: MassageLabFerrofluidColorSettings): [string, string, string] {
  if (settings.massageLabFerrofluidPaletteMode === "harmony") {
    return createMassageLabFerrofluidHarmonyPalette(
      settings.massageLabFerrofluidPrimaryColor,
      settings.massageLabFerrofluidHarmony,
    )
  }

  return [
    settings.massageLabFerrofluidColorOne,
    settings.massageLabFerrofluidColorTwo,
    settings.massageLabFerrofluidColorThree,
  ]
}

export function resolveMassageLabLightfallColors(settings: MassageLabLightfallColorSettings): [string, string, string] {
  if (settings.massageLabLightfallPaletteMode === "harmony") {
    return createMassageLabLightfallHarmonyPalette(
      settings.massageLabLightfallPrimaryColor,
      settings.massageLabLightfallHarmony,
    )
  }

  return [
    settings.massageLabLightfallColorOne,
    settings.massageLabLightfallColorTwo,
    settings.massageLabLightfallColorThree,
  ]
}

export function resolveMassageLabLiquidEtherColors(
  settings: MassageLabLiquidEtherColorSettings,
): [string, string, string] {
  if (settings.massageLabLiquidEtherPaletteMode === "harmony") {
    return createMassageLabLiquidEtherHarmonyPalette(
      settings.massageLabLiquidEtherPrimaryColor,
      settings.massageLabLiquidEtherHarmony,
    )
  }

  return [
    settings.massageLabLiquidEtherColorOne,
    settings.massageLabLiquidEtherColorTwo,
    settings.massageLabLiquidEtherColorThree,
  ]
}

export function resolveMassageLabLightPillarColors(
  settings: MassageLabLightPillarColorSettings,
): [string, string] {
  if (settings.massageLabLightPillarPaletteMode === "harmony") {
    return createMassageLabLightPillarHarmonyPalette(
      settings.massageLabLightPillarPrimaryColor,
      settings.massageLabLightPillarHarmony,
    )
  }

  return [
    settings.massageLabLightPillarTopColor,
    settings.massageLabLightPillarBottomColor,
  ]
}

export function resolveMassageLabSilkColor(settings: MassageLabSilkColorSettings): string {
  if (settings.massageLabSilkPaletteMode === "harmony") {
    return createMassageLabSilkHarmonyColor(
      settings.massageLabSilkPrimaryColor,
      settings.massageLabSilkHarmony,
    )
  }

  return settings.massageLabSilkColor
}

export function resolveMassageLabFloatingLinesGradient(
  settings: MassageLabFloatingLinesColorSettings,
): string[] | undefined {
  if (settings.massageLabFloatingLinesPaletteMode === "source") {
    return undefined
  }

  if (settings.massageLabFloatingLinesPaletteMode === "harmony") {
    return createMassageLabFloatingLinesHarmonyGradient(
      settings.massageLabFloatingLinesPrimaryColor,
      settings.massageLabFloatingLinesHarmony,
    )
  }

  return [
    settings.massageLabFloatingLinesColorOne,
    settings.massageLabFloatingLinesColorTwo,
    settings.massageLabFloatingLinesColorThree,
  ]
}

export function resolveMassageLabSideRaysColors(settings: MassageLabSideRaysColorSettings): [string, string] {
  if (settings.massageLabSideRaysPaletteMode === "source") {
    return ["#EAB308", "#96C8FF"]
  }

  if (settings.massageLabSideRaysPaletteMode === "harmony") {
    return createMassageLabSideRaysHarmonyColors(
      settings.massageLabSideRaysPrimaryColor,
      settings.massageLabSideRaysHarmony,
    )
  }

  return [
    settings.massageLabSideRaysColorOne,
    settings.massageLabSideRaysColorTwo,
  ]
}

export function resolveMassageLabLightRaysColor(settings: MassageLabLightRaysColorSettings): string {
  if (settings.massageLabLightRaysPaletteMode === "source") {
    return "#FFFFFF"
  }

  if (settings.massageLabLightRaysPaletteMode === "harmony") {
    return createMassageLabLightRaysHarmonyColor(
      settings.massageLabLightRaysPrimaryColor,
      settings.massageLabLightRaysHarmony,
    )
  }

  return settings.massageLabLightRaysColor
}

export function resolveMassageLabPixelBlastColor(settings: MassageLabPixelBlastColorSettings): string {
  if (settings.massageLabPixelBlastPaletteMode === "source") {
    return "#B497CF"
  }

  if (settings.massageLabPixelBlastPaletteMode === "harmony") {
    return createMassageLabPixelBlastHarmonyColor(
      settings.massageLabPixelBlastPrimaryColor,
      settings.massageLabPixelBlastHarmony,
    )
  }

  return settings.massageLabPixelBlastColor
}

export function resolveMassageLabColorBendsColors(
  settings: MassageLabColorBendsColorSettings,
): string[] | undefined {
  if (settings.massageLabColorBendsPaletteMode === "source") {
    return undefined
  }

  if (settings.massageLabColorBendsPaletteMode === "harmony") {
    return createMassageLabColorBendsHarmonyPalette(
      settings.massageLabColorBendsPrimaryColor,
      settings.massageLabColorBendsHarmony,
    )
  }

  return [
    settings.massageLabColorBendsColorOne,
    settings.massageLabColorBendsColorTwo,
    settings.massageLabColorBendsColorThree,
    settings.massageLabColorBendsColorFour,
  ]
}

export function resolveMassageLabEvilEyeColor(settings: MassageLabEvilEyeColorSettings): string {
  if (settings.massageLabEvilEyePaletteMode === "source") {
    return "#FF6F37"
  }

  if (settings.massageLabEvilEyePaletteMode === "harmony") {
    return createMassageLabEvilEyeHarmonyColor(
      settings.massageLabEvilEyePrimaryColor,
      settings.massageLabEvilEyeHarmony,
    )
  }

  return settings.massageLabEvilEyeColor
}

export function resolveMassageLabLineWavesColors(
  settings: MassageLabLineWavesColorSettings,
): [string, string, string] {
  if (settings.massageLabLineWavesPaletteMode === "source") {
    return ["#FFFFFF", "#FFFFFF", "#FFFFFF"]
  }

  if (settings.massageLabLineWavesPaletteMode === "harmony") {
    return createMassageLabLineWavesHarmonyPalette(
      settings.massageLabLineWavesPrimaryColor,
      settings.massageLabLineWavesHarmony,
    )
  }

  return [
    settings.massageLabLineWavesColorOne,
    settings.massageLabLineWavesColorTwo,
    settings.massageLabLineWavesColorThree,
  ]
}

export function resolveMassageLabRadarColor(settings: MassageLabRadarColorSettings): string {
  if (settings.massageLabRadarPaletteMode === "source") {
    return "#9F29FF"
  }

  if (settings.massageLabRadarPaletteMode === "harmony") {
    return createMassageLabRadarHarmonyColor(
      settings.massageLabRadarPrimaryColor,
      settings.massageLabRadarHarmony,
    )
  }

  return settings.massageLabRadarColor
}

export function resolveMassageLabSoftAuroraColors(settings: MassageLabSoftAuroraColorSettings): string[] {
  if (settings.massageLabSoftAuroraPaletteMode === "source") {
    return ["#F7F7F7", "#E100FF"]
  }

  if (settings.massageLabSoftAuroraPaletteMode === "harmony") {
    return createMassageLabSoftAuroraHarmonyColors(
      settings.massageLabSoftAuroraPrimaryColor,
      settings.massageLabSoftAuroraHarmony,
    )
  }

  return [
    settings.massageLabSoftAuroraColorOne,
    settings.massageLabSoftAuroraColorTwo,
  ]
}

export function resolveMassageLabPlasmaColor(settings: MassageLabPlasmaColorSettings): string {
  if (settings.massageLabPlasmaPaletteMode === "source") {
    return "#FFFFFF"
  }

  if (settings.massageLabPlasmaPaletteMode === "harmony") {
    return createMassageLabPlasmaHarmonyColor(
      settings.massageLabPlasmaPrimaryColor,
      settings.massageLabPlasmaHarmony,
    )
  }

  return settings.massageLabPlasmaColor
}

export function resolveMassageLabPlasmaWaveColors(settings: MassageLabPlasmaWaveColorSettings): string[] {
  if (settings.massageLabPlasmaWavePaletteMode === "source") {
    return ["#A855F7", "#06B6D4"]
  }

  if (settings.massageLabPlasmaWavePaletteMode === "harmony") {
    return createMassageLabPlasmaWaveHarmonyColors(
      settings.massageLabPlasmaWavePrimaryColor,
      settings.massageLabPlasmaWaveHarmony,
    )
  }

  return [
    settings.massageLabPlasmaWaveColorOne,
    settings.massageLabPlasmaWaveColorTwo,
  ]
}

export function resolveMassageLabParticlesColors(settings: MassageLabParticlesColorSettings): string[] {
  if (settings.massageLabParticlesPaletteMode === "source") {
    return ["#FFFFFF", "#FFFFFF", "#FFFFFF"]
  }

  if (settings.massageLabParticlesPaletteMode === "harmony") {
    return createMassageLabParticlesHarmonyColors(
      settings.massageLabParticlesPrimaryColor,
      settings.massageLabParticlesHarmony,
    )
  }

  return [
    settings.massageLabParticlesColorOne,
    settings.massageLabParticlesColorTwo,
    settings.massageLabParticlesColorThree,
  ]
}

export function resolveMassageLabGradientBlindsColors(settings: MassageLabGradientBlindsColorSettings): string[] {
  if (settings.massageLabGradientBlindsPaletteMode === "source") {
    return ["#FF9FFC", "#5227FF"]
  }

  if (settings.massageLabGradientBlindsPaletteMode === "harmony") {
    return createMassageLabGradientBlindsHarmonyColors(
      settings.massageLabGradientBlindsPrimaryColor,
      settings.massageLabGradientBlindsHarmony,
    )
  }

  return [
    settings.massageLabGradientBlindsColorOne,
    settings.massageLabGradientBlindsColorTwo,
  ]
}

export function resolveMassageLabGrainientColors(settings: MassageLabGrainientColorSettings): string[] {
  if (settings.massageLabGrainientPaletteMode === "source") {
    return ["#FF9FFC", "#5227FF", "#B497CF"]
  }

  if (settings.massageLabGrainientPaletteMode === "harmony") {
    return createMassageLabGrainientHarmonyColors(
      settings.massageLabGrainientPrimaryColor,
      settings.massageLabGrainientHarmony,
    )
  }

  return [
    settings.massageLabGrainientColorOne,
    settings.massageLabGrainientColorTwo,
    settings.massageLabGrainientColorThree,
  ]
}

export function resolveMassageLabGridScanColors(settings: MassageLabGridScanColorSettings): [string, string] {
  if (settings.massageLabGridScanPaletteMode === "source") {
    return ["#2F293A", "#FF9FFC"]
  }

  if (settings.massageLabGridScanPaletteMode === "harmony") {
    return createMassageLabGridScanHarmonyColors(
      settings.massageLabGridScanPrimaryColor,
      settings.massageLabGridScanHarmony,
    )
  }

  return [
    settings.massageLabGridScanLinesColor,
    settings.massageLabGridScanScanColor,
  ]
}

export function resolveMassageLabBeamsColor(settings: MassageLabBeamsColorSettings): string {
  if (settings.massageLabBeamsPaletteMode === "source") {
    return "#FFFFFF"
  }

  if (settings.massageLabBeamsPaletteMode === "harmony") {
    return createMassageLabBeamsHarmonyColor(
      settings.massageLabBeamsPrimaryColor,
      settings.massageLabBeamsHarmony,
    )
  }

  return settings.massageLabBeamsLightColor
}

export function resolveMassageLabPixelSnowColor(settings: MassageLabPixelSnowColorSettings): string {
  if (settings.massageLabPixelSnowPaletteMode === "source") {
    return "#FFFFFF"
  }

  if (settings.massageLabPixelSnowPaletteMode === "harmony") {
    return createMassageLabPixelSnowHarmonyColor(
      settings.massageLabPixelSnowPrimaryColor,
      settings.massageLabPixelSnowHarmony,
    )
  }

  return settings.massageLabPixelSnowColor
}

export function resolveMassageLabLightningHue(settings: MassageLabLightningColorSettings): number {
  if (settings.massageLabLightningPaletteMode === "source") {
    return normalizeHue(settings.massageLabLightningHue)
  }

  if (settings.massageLabLightningPaletteMode === "harmony") {
    return createMassageLabLightningHarmonyHue(
      settings.massageLabLightningPrimaryColor,
      settings.massageLabLightningHarmony,
    )
  }

  return getHueFromHexColor(settings.massageLabLightningColor)
}

export function resolveMassageLabPrismaticBurstColors(
  settings: MassageLabPrismaticBurstColorSettings,
): string[] {
  if (settings.massageLabPrismaticBurstPaletteMode === "source") {
    return []
  }

  if (settings.massageLabPrismaticBurstPaletteMode === "harmony") {
    return createMassageLabPrismaticBurstHarmonyPalette(
      settings.massageLabPrismaticBurstPrimaryColor,
      settings.massageLabPrismaticBurstHarmony,
    )
  }

  return [
    settings.massageLabPrismaticBurstColorOne,
    settings.massageLabPrismaticBurstColorTwo,
    settings.massageLabPrismaticBurstColorThree,
    settings.massageLabPrismaticBurstColorFour,
  ]
}

export function resolveMassageLabGalaxyHueShift(settings: MassageLabGalaxyColorSettings): number {
  if (settings.massageLabGalaxyPaletteMode === "source") {
    return normalizeHue(settings.massageLabGalaxyHueShift)
  }

  if (settings.massageLabGalaxyPaletteMode === "harmony") {
    return createMassageLabGalaxyHarmonyHue(
      settings.massageLabGalaxyPrimaryColor,
      settings.massageLabGalaxyHarmony,
    )
  }

  return getHueFromHexColor(settings.massageLabGalaxyColor)
}

export function resolveMassageLabDitherColor(settings: MassageLabDitherColorSettings): string {
  if (settings.massageLabDitherPaletteMode === "source") {
    return "#808080"
  }

  if (settings.massageLabDitherPaletteMode === "harmony") {
    return createMassageLabDitherHarmonyColor(
      settings.massageLabDitherPrimaryColor,
      settings.massageLabDitherHarmony,
    )
  }

  return settings.massageLabDitherColor
}

export function resolveMassageLabFaultyTerminalTint(
  settings: MassageLabFaultyTerminalColorSettings,
): string {
  if (settings.massageLabFaultyTerminalPaletteMode === "source") {
    return "#FFFFFF"
  }

  if (settings.massageLabFaultyTerminalPaletteMode === "harmony") {
    return createMassageLabFaultyTerminalHarmonyColor(
      settings.massageLabFaultyTerminalPrimaryColor,
      settings.massageLabFaultyTerminalHarmony,
    )
  }

  return settings.massageLabFaultyTerminalTint
}

export function resolveMassageLabRippleGridColor(settings: MassageLabRippleGridColorSettings): string {
  if (settings.massageLabRippleGridPaletteMode === "source" || settings.massageLabRippleGridPaletteMode === "rainbow") {
    return "#FFFFFF"
  }

  if (settings.massageLabRippleGridPaletteMode === "harmony") {
    return createMassageLabRippleGridHarmonyColor(
      settings.massageLabRippleGridPrimaryColor,
      settings.massageLabRippleGridHarmony,
    )
  }

  return settings.massageLabRippleGridColor
}

export function resolveMassageLabDotFieldColors(settings: MassageLabDotFieldColorSettings): {
  gradientFrom: string
  gradientTo: string
  glowColor: string
} {
  if (settings.massageLabDotFieldPaletteMode === "source") {
    return {
      gradientFrom: "rgba(168, 85, 247, 0.35)",
      gradientTo: "rgba(180, 151, 207, 0.25)",
      glowColor: "#120F17",
    }
  }

  if (settings.massageLabDotFieldPaletteMode === "harmony") {
    const [fromColor, toColor, glowColor] = createMassageLabDotFieldHarmonyColors(
      settings.massageLabDotFieldPrimaryColor,
      settings.massageLabDotFieldHarmony,
    )

    return {
      gradientFrom: hexToRgba(fromColor, settings.massageLabDotFieldGradientFromAlpha),
      gradientTo: hexToRgba(toColor, settings.massageLabDotFieldGradientToAlpha),
      glowColor,
    }
  }

  return {
    gradientFrom: hexToRgba(settings.massageLabDotFieldGradientFromColor, settings.massageLabDotFieldGradientFromAlpha),
    gradientTo: hexToRgba(settings.massageLabDotFieldGradientToColor, settings.massageLabDotFieldGradientToAlpha),
    glowColor: settings.massageLabDotFieldGlowColor,
  }
}

export function resolveMassageLabDotGridColors(settings: MassageLabDotGridColorSettings): [string, string] {
  if (settings.massageLabDotGridPaletteMode === "source") {
    return ["#5227FF", "#5227FF"]
  }

  if (settings.massageLabDotGridPaletteMode === "harmony") {
    return createMassageLabDotGridHarmonyColors(
      settings.massageLabDotGridPrimaryColor,
      settings.massageLabDotGridHarmony,
    )
  }

  return [settings.massageLabDotGridBaseColor, settings.massageLabDotGridActiveColor]
}

export function resolveMassageLabThreadsColor(settings: MassageLabThreadsColorSettings): string {
  if (settings.massageLabThreadsPaletteMode === "source") {
    return "#FFFFFF"
  }

  if (settings.massageLabThreadsPaletteMode === "harmony") {
    return createMassageLabThreadsHarmonyColor(
      settings.massageLabThreadsPrimaryColor,
      settings.massageLabThreadsHarmony,
    )
  }

  return settings.massageLabThreadsColor
}

export function resolveMassageLabIridescenceColor(settings: MassageLabIridescenceColorSettings): string {
  if (settings.massageLabIridescencePaletteMode === "source") {
    return "#FFFFFF"
  }

  if (settings.massageLabIridescencePaletteMode === "harmony") {
    return createMassageLabIridescenceHarmonyColor(
      settings.massageLabIridescencePrimaryColor,
      settings.massageLabIridescenceHarmony,
    )
  }

  return settings.massageLabIridescenceColor
}

export function resolveMassageLabWavesLineColor(settings: MassageLabWavesColorSettings): string {
  if (settings.massageLabWavesPaletteMode === "source") {
    return "#000000"
  }

  if (settings.massageLabWavesPaletteMode === "harmony") {
    return createMassageLabWavesHarmonyColor(settings.massageLabWavesPrimaryColor, settings.massageLabWavesHarmony)
  }

  return settings.massageLabWavesLineColor
}

export function resolveMassageLabGridDistortionColors(
  settings: MassageLabGridDistortionColorSettings,
): [string, string, string] {
  if (settings.massageLabGridDistortionPaletteMode === "source") {
    return ["#101827", "#5B7CFA", "#F7B7D2"]
  }

  if (settings.massageLabGridDistortionPaletteMode === "harmony") {
    return createMassageLabGridDistortionHarmonyPalette(
      settings.massageLabGridDistortionPrimaryColor,
      settings.massageLabGridDistortionHarmony,
    )
  }

  return [
    settings.massageLabGridDistortionColorOne,
    settings.massageLabGridDistortionColorTwo,
    settings.massageLabGridDistortionColorThree,
  ]
}

export function resolveMassageLabOrbHue(settings: MassageLabOrbColorSettings): number {
  if (settings.massageLabOrbPaletteMode === "source") {
    return normalizeHue(settings.massageLabOrbHue)
  }

  if (settings.massageLabOrbPaletteMode === "harmony") {
    return createMassageLabOrbHarmonyHue(settings.massageLabOrbPrimaryColor, settings.massageLabOrbHarmony)
  }

  return getHueFromHexColor(settings.massageLabOrbColor)
}

export function resolveMassageLabLetterGlitchColors(
  settings: MassageLabLetterGlitchColorSettings,
): [string, string, string] {
  if (settings.massageLabLetterGlitchPaletteMode === "source") {
    return ["#2B4539", "#61DCA3", "#61B3DC"]
  }

  if (settings.massageLabLetterGlitchPaletteMode === "harmony") {
    return createMassageLabLetterGlitchHarmonyPalette(
      settings.massageLabLetterGlitchPrimaryColor,
      settings.massageLabLetterGlitchHarmony,
    )
  }

  return [
    settings.massageLabLetterGlitchColorOne,
    settings.massageLabLetterGlitchColorTwo,
    settings.massageLabLetterGlitchColorThree,
  ]
}

export function resolveMassageLabGridMotionColors(
  settings: MassageLabGridMotionColorSettings,
): [string, string, string] {
  if (settings.massageLabGridMotionPaletteMode === "source") {
    return ["#000000", "#111111", "#F8FAFC"]
  }

  if (settings.massageLabGridMotionPaletteMode === "harmony") {
    return createMassageLabGridMotionHarmonyPalette(
      settings.massageLabGridMotionPrimaryColor,
      settings.massageLabGridMotionHarmony,
    )
  }

  return [
    settings.massageLabGridMotionGradientColor,
    settings.massageLabGridMotionTileColor,
    settings.massageLabGridMotionTextColor,
  ]
}

export function resolveMassageLabShapeGridColors(
  settings: MassageLabShapeGridColorSettings,
): [string, string] {
  if (settings.massageLabShapeGridPaletteMode === "source") {
    return ["#999999", "#222222"]
  }

  if (settings.massageLabShapeGridPaletteMode === "harmony") {
    return createMassageLabShapeGridHarmonyPalette(
      settings.massageLabShapeGridPrimaryColor,
      settings.massageLabShapeGridHarmony,
    )
  }

  return [
    settings.massageLabShapeGridBorderColor,
    settings.massageLabShapeGridHoverFillColor,
  ]
}

export function resolveMassageLabLiquidChromeBaseColor(settings: MassageLabLiquidChromeColorSettings): string {
  if (settings.massageLabLiquidChromePaletteMode === "source") {
    return "#1A1A1A"
  }

  if (settings.massageLabLiquidChromePaletteMode === "harmony") {
    return createMassageLabLiquidChromeHarmonyColor(
      settings.massageLabLiquidChromePrimaryColor,
      settings.massageLabLiquidChromeHarmony,
    )
  }

  return settings.massageLabLiquidChromeBaseColor
}

export function resolveMassageLabBalatroColors(settings: MassageLabBalatroColorSettings): [string, string, string] {
  if (settings.massageLabBalatroPaletteMode === "source") {
    return ["#DE443B", "#006BB4", "#162325"]
  }

  if (settings.massageLabBalatroPaletteMode === "harmony") {
    return createMassageLabBalatroHarmonyPalette(settings.massageLabBalatroPrimaryColor, settings.massageLabBalatroHarmony)
  }

  return [
    settings.massageLabBalatroColorOne,
    settings.massageLabBalatroColorTwo,
    settings.massageLabBalatroColorThree,
  ]
}

export function resolveMassageLabNovatrixColor(settings: MassageLabNovatrixColorSettings): string {
  if (settings.massageLabNovatrixPaletteMode === "harmony") {
    return createMassageLabNovatrixHarmonyColor(
      settings.massageLabNovatrixPrimaryColor,
      settings.massageLabNovatrixHarmony,
    )
  }

  return settings.massageLabNovatrixColor
}

export function resolveMassageLabMatrixRainColor(settings: MassageLabMatrixRainColorSettings): string {
  if (settings.massageLabMatrixRainPaletteMode === "harmony") {
    return createMassageLabMatrixRainHarmonyColor(
      settings.massageLabMatrixRainPrimaryColor,
      settings.massageLabMatrixRainHarmony,
    )
  }

  return settings.massageLabMatrixRainColor
}

export function resolveMassageLabPhotonBeamColors(
  settings: MassageLabPhotonBeamColorSettings,
): [string, string, string, boolean, string, boolean, string] {
  if (settings.massageLabPhotonBeamPaletteMode === "harmony") {
    return createMassageLabPhotonBeamHarmonyPalette(
      settings.massageLabPhotonBeamPrimaryColor,
      settings.massageLabPhotonBeamHarmony,
    )
  }

  return [
    settings.massageLabPhotonBeamColorBg,
    settings.massageLabPhotonBeamColorLine,
    settings.massageLabPhotonBeamColorSignal,
    settings.massageLabPhotonBeamUseColor2,
    settings.massageLabPhotonBeamColorSignal2,
    settings.massageLabPhotonBeamUseColor3,
    settings.massageLabPhotonBeamColorSignal3,
  ]
}

export function createMassageLabDeepSpaceNebulaHarmonyPalette(
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

export function createMassageLabSynthesisHarmonyPalette(
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

export function createMassageLabWaveCurrentHarmonyPalette(
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

export function createMassageLabFerrofluidHarmonyPalette(
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

export function createMassageLabLightfallHarmonyPalette(
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

export function createMassageLabLightPillarHarmonyPalette(
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

export function createMassageLabSilkHarmonyColor(primaryColor: string, harmony: ColorHarmony): string {
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

export function createMassageLabFloatingLinesHarmonyGradient(
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

export function createMassageLabSideRaysHarmonyColors(
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

export function createMassageLabLiquidEtherHarmonyPalette(
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

export function createMassageLabLightRaysHarmonyColor(
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

export function createMassageLabPixelBlastHarmonyColor(
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

export function createMassageLabColorBendsHarmonyPalette(
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

export function createMassageLabEvilEyeHarmonyColor(
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

export function createMassageLabLineWavesHarmonyPalette(
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

export function createMassageLabRadarHarmonyColor(
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

export function createMassageLabSoftAuroraHarmonyColors(
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

export function createMassageLabPlasmaHarmonyColor(
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

export function createMassageLabPlasmaWaveHarmonyColors(
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

export function createMassageLabParticlesHarmonyColors(
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

export function createMassageLabGradientBlindsHarmonyColors(
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

export function createMassageLabGrainientHarmonyColors(
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

export function createMassageLabGridScanHarmonyColors(
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

export function createMassageLabBeamsHarmonyColor(
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

export function createMassageLabPixelSnowHarmonyColor(
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

export function createMassageLabLightningHarmonyHue(
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

export function createMassageLabGalaxyHarmonyHue(
  primaryColor: string,
  harmony: ColorHarmony,
): number {
  return createMassageLabLightningHarmonyHue(primaryColor, harmony)
}

export function createMassageLabDitherHarmonyColor(
  primaryColor: string,
  harmony: ColorHarmony,
): string {
  return createMassageLabPixelSnowHarmonyColor(primaryColor, harmony)
}

export function createMassageLabFaultyTerminalHarmonyColor(
  primaryColor: string,
  harmony: ColorHarmony,
): string {
  return createMassageLabPixelSnowHarmonyColor(primaryColor, harmony)
}

export function createMassageLabRippleGridHarmonyColor(
  primaryColor: string,
  harmony: ColorHarmony,
): string {
  return createMassageLabPixelSnowHarmonyColor(primaryColor, harmony)
}

export function createMassageLabDotFieldHarmonyColors(
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

export function createMassageLabDotGridHarmonyColors(
  primaryColor: string,
  harmony: ColorHarmony,
): [string, string] {
  const [fromColor, toColor] = createMassageLabDotFieldHarmonyColors(primaryColor, harmony)
  return [fromColor, toColor]
}

export function createMassageLabThreadsHarmonyColor(primaryColor: string, harmony: ColorHarmony): string {
  return createMassageLabSilkHarmonyColor(primaryColor, harmony)
}

export function createMassageLabIridescenceHarmonyColor(primaryColor: string, harmony: ColorHarmony): string {
  return createMassageLabSilkHarmonyColor(primaryColor, harmony)
}

export function createMassageLabWavesHarmonyColor(primaryColor: string, harmony: ColorHarmony): string {
  return createMassageLabSilkHarmonyColor(primaryColor, harmony)
}

export function createMassageLabGridDistortionHarmonyPalette(
  primaryColor: string,
  harmony: ColorHarmony,
): [string, string, string] {
  const [first, second, third] = createMassageLabColorBendsHarmonyPalette(primaryColor, harmony)
  return [first, second, third]
}

export function createMassageLabOrbHarmonyHue(primaryColor: string, harmony: ColorHarmony): number {
  return createMassageLabLightningHarmonyHue(primaryColor, harmony)
}

export function createMassageLabLetterGlitchHarmonyPalette(
  primaryColor: string,
  harmony: ColorHarmony,
): [string, string, string] {
  return createMassageLabGridDistortionHarmonyPalette(primaryColor, harmony)
}

export function createMassageLabGridMotionHarmonyPalette(
  primaryColor: string,
  harmony: ColorHarmony,
): [string, string, string] {
  const [first, second, third] = createMassageLabGridDistortionHarmonyPalette(primaryColor, harmony)
  return ["#050507", second, third || first]
}

export function createMassageLabShapeGridHarmonyPalette(
  primaryColor: string,
  harmony: ColorHarmony,
): [string, string] {
  const [first, second] = createMassageLabGridDistortionHarmonyPalette(primaryColor, harmony)
  return [first, second]
}

export function createMassageLabLiquidChromeHarmonyColor(primaryColor: string, harmony: ColorHarmony): string {
  return createMassageLabPixelSnowHarmonyColor(primaryColor, harmony)
}

export function createMassageLabBalatroHarmonyPalette(
  primaryColor: string,
  harmony: ColorHarmony,
): [string, string, string] {
  return createMassageLabGridDistortionHarmonyPalette(primaryColor, harmony)
}

export function createMassageLabPrismaticBurstHarmonyPalette(
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

export function createMassageLabNovatrixHarmonyColor(
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

export function createMassageLabMatrixRainHarmonyColor(
  primaryColor: string,
  harmony: ColorHarmony,
) {
  return createMassageLabNovatrixHarmonyColor(primaryColor, harmony)
}

export function createMassageLabPhotonBeamHarmonyPalette(
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

export function createMassageLabChromeFlowHarmonyPalette(
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
  onStartTimer: (options?: ChimerSetupStartOptions) => void
  onStartClock: () => void
  hapticsEnabled: boolean
  onTestAlert: () => void
  onUseDeviceSettings: () => void
  onUseSavedSettings: () => void
}

const ALERT_TYPE_OPTIONS: Array<{ value: ChimerSettings["alertType"]; label: string }> = [
  { value: "chime", label: "Sound" },
  { value: "flash", label: "Visual flash" },
  { value: "haptic", label: "Haptic cue" },
  { value: "both", label: "Sound + visual" },
  { value: "chime-haptic", label: "Sound + haptic" },
  { value: "flash-haptic", label: "Visual + haptic" },
  { value: "all", label: "Sound + visual + haptic" },
  { value: "silent", label: "Silent" },
]

const SOUND_ALERT_TYPES = new Set<ChimerSettings["alertType"]>(["chime", "both", "chime-haptic", "all"])
const HAPTIC_ALERT_TYPES = new Set<ChimerSettings["alertType"]>(["haptic", "chime-haptic", "flash-haptic", "all"])

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

const NATIVE_RANGE_FILL_STYLE_PROPERTY = "--ml-native-range-fill"

/**
 * Computes a native range input's clamped fill percentage and writes it to the
 * CSS variable used by the WebKit track fill layer.
 */
function syncNativeRangeFill(rangeInput: HTMLInputElement) {
  const min = Number(rangeInput.min || 0)
  const max = Number(rangeInput.max || 100)
  const value = Number(rangeInput.value)
  const range = max - min
  const percentage = range > 0 ? ((value - min) / range) * 100 : 0
  const clampedPercentage = Math.min(100, Math.max(0, percentage))

  rangeInput.style.setProperty(NATIVE_RANGE_FILL_STYLE_PROPERTY, `${clampedPercentage}%`)
}

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
  hapticsEnabled,
  onTestAlert,
  onUseDeviceSettings,
  onUseSavedSettings,
}: SetTimerProps) {
  const [activeStep, setActiveStep] = useState(0)
  const [savedPresets, setSavedPresets] = useState<ChimerSetupPreset[]>([])
  const [lastSetupPreset, setLastSetupPreset] = useState<ChimerSetupPresetState | null>(null)
  const [selectedPresetId, setSelectedPresetId] = useState("")
  const [newPresetName, setNewPresetName] = useState("")
  const [skipIntervalCues, setSkipIntervalCues] = useState(false)
  const [activeProofIndex, setActiveProofIndex] = useState(0)
  const { settings: appShellSettings } = useSettings()
  const [syncNoticeDismissed, setSyncNoticeDismissed] = useState(false)
  const [isSyncNoticeExiting, setIsSyncNoticeExiting] = useState(false)
  const syncNoticeDismissTimerRef = useRef<number | null>(null)
  const syncNoticeExitTimerRef = useRef<number | null>(null)
  const containerRef = useRef<HTMLElement | null>(null)
  const nativeRangeInputSyncedRef = useRef(false)
  const proofSwipeStartRef = useRef<{ x: number; y: number } | null>(null)
  const isTimerSet = totalDurationMs > 0
  const withPress = (handler: () => void) => withChimerPress(handler, { hapticsEnabled })
  const setupPresetState = useMemo(() => createChimerSetupPresetState(settings, skipIntervalCues), [settings, skipIntervalCues])

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
        massageLab3DGlobeMarkerEnabled: true,
        massageLab3DGlobeMarkerLat: Number(coords.latitude.toFixed(4)),
        massageLab3DGlobeMarkerLng: Number(coords.longitude.toFixed(4)),
      })
    })
  }

  useEffect(() => {
    setSavedPresets(readChimerSetupPresets())
    setLastSetupPreset(readLastChimerSetupPreset())
  }, [])

  useEffect(() => {
    if (nativeRangeInputSyncedRef.current) {
      nativeRangeInputSyncedRef.current = false
      return
    }

    const rangeInputs = containerRef.current?.querySelectorAll<HTMLInputElement>(
      `.${styles.rangeRow} input[type="range"]`,
    )

    rangeInputs?.forEach(syncNativeRangeFill)
  }, [settings])

  const handleNativeRangeInput = useCallback((event: ReactFormEvent<HTMLElement>) => {
    const target = event.target

    if (target instanceof HTMLInputElement && target.type === "range") {
      syncNativeRangeFill(target)
      nativeRangeInputSyncedRef.current = true
    }
  }, [])

  const moveProofCarousel = useCallback((direction: 1 | -1) => {
    setActiveProofIndex((current) => (current + direction + timerProofs.length) % timerProofs.length)
  }, [])

  useEffect(() => {
    // Reset the autoplay delay after dot taps or swipe navigation.
    const interval = window.setInterval(() => {
      moveProofCarousel(1)
    }, 5500)

    return () => window.clearInterval(interval)
  }, [activeProofIndex, moveProofCarousel])

  const handleProofCarouselPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse") {
      return
    }

    proofSwipeStartRef.current = {
      x: event.clientX,
      y: event.clientY,
    }
  }, [])

  const handleProofCarouselPointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const swipeStart = proofSwipeStartRef.current
    proofSwipeStartRef.current = null
    if (!swipeStart) {
      return
    }

    const deltaX = event.clientX - swipeStart.x
    const deltaY = event.clientY - swipeStart.y
    const isHorizontalSwipe =
      Math.abs(deltaX) >= INFO_CAROUSEL_SWIPE_THRESHOLD_PX
      && Math.abs(deltaX) > Math.abs(deltaY) * 1.35

    if (!isHorizontalSwipe) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    moveProofCarousel(deltaX > 0 ? -1 : 1)
  }, [moveProofCarousel])

  const handleProofCarouselPointerCancel = useCallback(() => {
    proofSwipeStartRef.current = null
  }, [])

  const clearSyncNoticeTimers = useCallback(() => {
    if (syncNoticeDismissTimerRef.current) {
      window.clearTimeout(syncNoticeDismissTimerRef.current)
      syncNoticeDismissTimerRef.current = null
    }

    if (syncNoticeExitTimerRef.current) {
      window.clearTimeout(syncNoticeExitTimerRef.current)
      syncNoticeExitTimerRef.current = null
    }
  }, [])

  const dismissSyncNotice = useCallback(() => {
    clearSyncNoticeTimers()
    setIsSyncNoticeExiting(true)
    syncNoticeExitTimerRef.current = window.setTimeout(() => {
      setSyncNoticeDismissed(true)
      setIsSyncNoticeExiting(false)
      syncNoticeExitTimerRef.current = null
    }, 260)
  }, [clearSyncNoticeTimers])

  useEffect(() => {
    setSyncNoticeDismissed(false)
    setIsSyncNoticeExiting(false)
    clearSyncNoticeTimers()

    if (syncStatus === "synced") {
      setSyncNoticeDismissed(true)
      return clearSyncNoticeTimers
    }

    const visibleDuration = syncStatus === "conflict" ? 12000 : 7500
    syncNoticeDismissTimerRef.current = window.setTimeout(() => {
      dismissSyncNotice()
    }, visibleDuration)

    return clearSyncNoticeTimers
  }, [clearSyncNoticeTimers, dismissSyncNotice, syncStatus])

  const handleUseDeviceSettingsClick = useCallback((event: ReactMouseEvent<HTMLButtonElement>) => {
    withChimerPress(() => {
      dismissSyncNotice()
      onUseDeviceSettings()
    }, { hapticsEnabled })(event)
  }, [dismissSyncNotice, hapticsEnabled, onUseDeviceSettings])

  const handleUseSavedSettingsClick = useCallback((event: ReactMouseEvent<HTMLButtonElement>) => {
    withChimerPress(() => {
      dismissSyncNotice()
      onUseSavedSettings()
    }, { hapticsEnabled })(event)
  }, [dismissSyncNotice, hapticsEnabled, onUseSavedSettings])

  const isFinalStep = activeStep === CHIMER_SETUP_STEPS.length - 1
  const canAdvanceStep = activeStep !== 0 || totalDurationMs > 0
  const shouldShowSyncNotice = syncStatus !== "synced"

  const selectedPreset = savedPresets.find((entry) => entry.id === selectedPresetId) ?? null

  const nextStep = () => {
    setActiveStep((current) => Math.min(current + 1, CHIMER_SETUP_STEPS.length - 1))
  }

  const previousStep = () => {
    setActiveStep((current) => Math.max(current - 1, 0))
  }

  const formatDurationMinutes = (hours: number, minutes: number) => {
    if (hours > 0) {
      return `${hours}h ${minutes.toString().padStart(2, "0")}m`
    }
    return `${minutes}m`
  }

  const applyPreset = (preset: ChimerSetupPresetState) => {
    const { skipIntervalCues: intervalSkip, ...settingsToApply } = preset
    onSettingsChange(settingsToApply)
    setSkipIntervalCues(intervalSkip)
  }

  const loadLastSetup = () => {
    if (lastSetupPreset) {
      applyPreset(lastSetupPreset)
    }
  }

  const saveCurrentPreset = () => {
    const now = Date.now()
    const name = newPresetName.trim() || `Preset ${new Date(now).toLocaleDateString()} ${new Date(now).toLocaleTimeString()}`
    const nextPreset: ChimerSetupPreset = {
      id: `chimer-setup-${now}`,
      name,
      createdAt: now,
      settings: setupPresetState,
    }

    const remaining = savedPresets.filter((entry) => entry.id !== nextPreset.id)
    const merged = [nextPreset, ...remaining].slice(0, MAX_CHIMER_SETUP_PRESETS)

    setSavedPresets(merged)
    setNewPresetName("")
    writeChimerSetupPresets(merged)
    writeChimerLastSetupPreset(setupPresetState)
    setLastSetupPreset(setupPresetState)
  }

  const applySelectedPreset = () => {
    if (selectedPreset) {
      applyPreset(selectedPreset.settings)
    }
  }

  const handleStartTimer = (startWithoutAnimatedBackground = false) => {
    writeChimerLastSetupPreset(setupPresetState)
    setLastSetupPreset(setupPresetState)
    onStartTimer({
      startWithoutAnimatedBackground,
      skipIntervalCues,
    })
  }

  const setQuickDuration = (totalMinutes: number) => {
    const safeMinutes = Math.max(1, Math.min(240, totalMinutes))
    const nextHours = Math.floor(safeMinutes / 60)
    const nextMinutes = safeMinutes % 60
    onSettingsChange({ hours: nextHours, minutes: nextMinutes })
  }

  const stepIntervalMode = skipIntervalCues ? "none" : settings.intervalType
  const selectedAlertUsesSound = SOUND_ALERT_TYPES.has(settings.alertType)
  const selectedAlertUsesHaptics = HAPTIC_ALERT_TYPES.has(settings.alertType)
  const canGoToStep = (stepIndex: number) => (
    stepIndex <= activeStep || isTimerSet || stepIndex === 0
  )

  const isStepComplete = (stepIndex: number) => (
    stepIndex < activeStep || (stepIndex === 0 ? isTimerSet : false)
  )

  const renderBackgroundControls = (option: BackgroundDefinition) => {
    if (option.id === "massage-lab-gradient-animation") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.colorRow}>
            <span>Base start</span>
            <input
              type="color"
              value={settings.gradientAnimationBackgroundStartColor}
              onChange={(event) => onSettingsChange({ gradientAnimationBackgroundStartColor: event.target.value })}
              aria-label="Animated gradient background start color"
            />
          </label>
          <label className={styles.colorRow}>
            <span>Base end</span>
            <input
              type="color"
              value={settings.gradientAnimationBackgroundEndColor}
              onChange={(event) => onSettingsChange({ gradientAnimationBackgroundEndColor: event.target.value })}
              aria-label="Animated gradient background end color"
            />
          </label>
          <label className={styles.colorRow}>
            <span>Glow 1</span>
            <input
              type="color"
              value={settings.gradientAnimationFirstColor}
              onChange={(event) => onSettingsChange({ gradientAnimationFirstColor: event.target.value })}
              aria-label="Animated gradient first glow color"
            />
          </label>
          <label className={styles.colorRow}>
            <span>Glow 2</span>
            <input
              type="color"
              value={settings.gradientAnimationSecondColor}
              onChange={(event) => onSettingsChange({ gradientAnimationSecondColor: event.target.value })}
              aria-label="Animated gradient second glow color"
            />
          </label>
          <label className={styles.colorRow}>
            <span>Glow 3</span>
            <input
              type="color"
              value={settings.gradientAnimationThirdColor}
              onChange={(event) => onSettingsChange({ gradientAnimationThirdColor: event.target.value })}
              aria-label="Animated gradient third glow color"
            />
          </label>
          <label className={styles.colorRow}>
            <span>Glow 4</span>
            <input
              type="color"
              value={settings.gradientAnimationFourthColor}
              onChange={(event) => onSettingsChange({ gradientAnimationFourthColor: event.target.value })}
              aria-label="Animated gradient fourth glow color"
            />
          </label>
          <label className={styles.colorRow}>
            <span>Glow 5</span>
            <input
              type="color"
              value={settings.gradientAnimationFifthColor}
              onChange={(event) => onSettingsChange({ gradientAnimationFifthColor: event.target.value })}
              aria-label="Animated gradient fifth glow color"
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
              aria-label="Animated gradient speed"
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
              aria-label="Animated gradient glow size"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-gradient") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.colorRow}>
            <span>Primary color</span>
            <input
              type="color"
              value={settings.massageLabGradientPrimaryColor}
              onChange={(event) => onSettingsChange({ massageLabGradientPrimaryColor: event.target.value })}
              aria-label="MassageLab gradient primary color"
            />
          </label>
          <label className={styles.selectRow}>
            <span>Color harmony</span>
            <select
              value={settings.massageLabGradientHarmony}
              onChange={(event) => onSettingsChange({
                massageLabGradientHarmony: event.target.value as MassageLabGradientHarmony,
              })}
              aria-label="MassageLab gradient color harmony"
            >
              {MASSAGE_LAB_GRADIENT_HARMONY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.rangeRow}>
            <span>Opacity ({Math.round(settings.massageLabGradientOpacity * 100)}%)</span>
            <input
              type="range"
              min="0.15"
              max="1"
              step="0.01"
              value={settings.massageLabGradientOpacity}
              onChange={(event) => onSettingsChange({ massageLabGradientOpacity: Number(event.target.value) })}
              aria-label="MassageLab gradient opacity"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-hole") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.colorRow}>
            <span>Grid line color</span>
            <input
              type="color"
              value={settings.massageLabHoleStrokeColor}
              onChange={(event) => onSettingsChange({ massageLabHoleStrokeColor: event.target.value })}
              aria-label="MassageLab Hole grid line color"
            />
          </label>
          <label className={styles.colorRow}>
            <span>Particle color</span>
            <input
              type="color"
              value={settings.massageLabHoleParticleColor}
              onChange={(event) => onSettingsChange({ massageLabHoleParticleColor: event.target.value })}
              aria-label="MassageLab Hole particle color"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Line count ({settings.massageLabHoleLineCount})</span>
            <input
              type="range"
              min="12"
              max="96"
              step="1"
              value={settings.massageLabHoleLineCount}
              onChange={(event) => onSettingsChange({ massageLabHoleLineCount: Number(event.target.value) })}
              aria-label="MassageLab Hole line count"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Disc count ({settings.massageLabHoleDiscCount})</span>
            <input
              type="range"
              min="12"
              max="96"
              step="1"
              value={settings.massageLabHoleDiscCount}
              onChange={(event) => onSettingsChange({ massageLabHoleDiscCount: Number(event.target.value) })}
              aria-label="MassageLab Hole disc count"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-stars") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.colorRow}>
            <span>Star color</span>
            <input
              type="color"
              value={settings.massageLabStarsColor}
              onChange={(event) => onSettingsChange({ massageLabStarsColor: event.target.value })}
              aria-label="MassageLab Stars star color"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Speed ({settings.massageLabStarsSpeed}s)</span>
            <input
              type="range"
              min="18"
              max="120"
              step="1"
              value={settings.massageLabStarsSpeed}
              onChange={(event) => onSettingsChange({ massageLabStarsSpeed: Number(event.target.value) })}
              aria-label="MassageLab Stars speed"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Density ({Math.round(settings.massageLabStarsDensity * 100)}%)</span>
            <input
              type="range"
              min="0.25"
              max="1.5"
              step="0.05"
              value={settings.massageLabStarsDensity}
              onChange={(event) => onSettingsChange({ massageLabStarsDensity: Number(event.target.value) })}
              aria-label="MassageLab Stars density"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Parallax ({Math.round(settings.massageLabStarsParallax * 1000) / 10}%)</span>
            <input
              type="range"
              min="0"
              max="0.12"
              step="0.005"
              value={settings.massageLabStarsParallax}
              onChange={(event) => onSettingsChange({ massageLabStarsParallax: Number(event.target.value) })}
              aria-label="MassageLab Stars parallax strength"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-sparkles") {
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

    if (option.id === "massage-lab-background-lines") {
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
              aria-label="Light lines animation duration"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-shooting-stars") {
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

    if (option.id === "massage-lab-wavy-background") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.colorRow}>
            <span>Background</span>
            <input
              type="color"
              value={settings.wavyBackgroundFill}
              onChange={(event) => onSettingsChange({ wavyBackgroundFill: event.target.value })}
              aria-label="Wave flow fill color"
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

    if (option.id === "massage-lab-aurora-bars") {
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

    if (option.id === "massage-lab-pixel-liquid") {
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

    if (option.id === "massage-lab-light-speed") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.colorRow}>
            <span>Light color</span>
            <input
              type="color"
              value={settings.massageLabLightSpeedLightColor}
              onChange={(event) => onSettingsChange({ massageLabLightSpeedLightColor: event.target.value })}
              aria-label="Light Speed light color"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Warp speed ({settings.massageLabLightSpeedWarpSpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0.1"
              max="24"
              step="0.01"
              value={settings.massageLabLightSpeedWarpSpeed}
              onChange={(event) => onSettingsChange({ massageLabLightSpeedWarpSpeed: Number(event.target.value) })}
              aria-label="Light Speed warp speed"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Particles ({settings.massageLabLightSpeedParticleCount})</span>
            <input
              type="range"
              min="20"
              max="200"
              step="5"
              value={settings.massageLabLightSpeedParticleCount}
              onChange={(event) => onSettingsChange({ massageLabLightSpeedParticleCount: Number(event.target.value) })}
              aria-label="Light Speed particle count"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Glow ({settings.massageLabLightSpeedIntensity.toFixed(2)}x)</span>
            <input
              type="range"
              min="0.25"
              max="6"
              step="0.05"
              value={settings.massageLabLightSpeedIntensity}
              onChange={(event) => onSettingsChange({ massageLabLightSpeedIntensity: Number(event.target.value) })}
              aria-label="Light Speed glow intensity"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Tunnel radius ({settings.massageLabLightSpeedRadius}px)</span>
            <input
              type="range"
              min="6"
              max="60"
              step="1"
              value={settings.massageLabLightSpeedRadius}
              onChange={(event) => onSettingsChange({ massageLabLightSpeedRadius: Number(event.target.value) })}
              aria-label="Light Speed tunnel radius"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Field length ({settings.massageLabLightSpeedCylinderLength}px)</span>
            <input
              type="range"
              min="40"
              max="300"
              step="5"
              value={settings.massageLabLightSpeedCylinderLength}
              onChange={(event) => onSettingsChange({ massageLabLightSpeedCylinderLength: Number(event.target.value) })}
              aria-label="Light Speed field length"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-electric-mist") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.colorRow}>
            <span>Lightning color</span>
            <input
              type="color"
              value={settings.massageLabElectricMistColor}
              onChange={(event) => onSettingsChange({ massageLabElectricMistColor: event.target.value })}
              aria-label="Electric Mist lightning color"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Animation speed ({Math.round(settings.massageLabElectricMistSpeed)}%)</span>
            <input
              type="range"
              min="1"
              max="400"
              step="1"
              value={settings.massageLabElectricMistSpeed}
              onChange={(event) => onSettingsChange({ massageLabElectricMistSpeed: Number(event.target.value) })}
              aria-label="Electric Mist animation speed"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Noise detail ({settings.massageLabElectricMistDetail.toFixed(1)})</span>
            <input
              type="range"
              min="0.5"
              max="4"
              step="0.1"
              value={settings.massageLabElectricMistDetail}
              onChange={(event) => onSettingsChange({ massageLabElectricMistDetail: Number(event.target.value) })}
              aria-label="Electric Mist noise detail"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Distortion ({settings.massageLabElectricMistDistortion.toFixed(1)}x)</span>
            <input
              type="range"
              min="0"
              max="6"
              step="0.1"
              value={settings.massageLabElectricMistDistortion}
              onChange={(event) => onSettingsChange({ massageLabElectricMistDistortion: Number(event.target.value) })}
              aria-label="Electric Mist distortion"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Brightness ({Math.round(settings.massageLabElectricMistBrightness)}%)</span>
            <input
              type="range"
              min="1"
              max="100"
              step="1"
              value={settings.massageLabElectricMistBrightness}
              onChange={(event) => onSettingsChange({ massageLabElectricMistBrightness: Number(event.target.value) })}
              aria-label="Electric Mist brightness"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-astral-flow") {
      const useCustomPalette = settings.massageLabAstralFlowPaletteMode === "custom"
      const astralFlowDisplaySpeed = getMassageLabAstralFlowDisplaySpeed(settings.massageLabAstralFlowSpeed)

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.massageLabAstralFlowPaletteMode}
              onChange={(event) => onSettingsChange({
                massageLabAstralFlowPaletteMode: event.target.value as MassageLabAstralFlowPaletteMode,
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
                  value={settings.massageLabAstralFlowColorOne}
                  onChange={(event) => onSettingsChange({ massageLabAstralFlowColorOne: event.target.value })}
                  aria-label="Astral Flow color 1"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Color 2 (mid)</span>
                <input
                  type="color"
                  value={settings.massageLabAstralFlowColorTwo}
                  onChange={(event) => onSettingsChange({ massageLabAstralFlowColorTwo: event.target.value })}
                  aria-label="Astral Flow color 2"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Color 3 (highlights)</span>
                <input
                  type="color"
                  value={settings.massageLabAstralFlowColorThree}
                  onChange={(event) => onSettingsChange({ massageLabAstralFlowColorThree: event.target.value })}
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
                  value={settings.massageLabAstralFlowPrimaryColor}
                  onChange={(event) => onSettingsChange({ massageLabAstralFlowPrimaryColor: event.target.value })}
                  aria-label="Astral Flow primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={settings.massageLabAstralFlowHarmony}
                  onChange={(event) => onSettingsChange({
                    massageLabAstralFlowHarmony: event.target.value as ColorHarmony,
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
              min={MASSAGE_LAB_ASTRAL_FLOW_DISPLAY_SPEED_MIN}
              max={MASSAGE_LAB_ASTRAL_FLOW_DISPLAY_SPEED_MAX}
              step={MASSAGE_LAB_ASTRAL_FLOW_DISPLAY_SPEED_STEP}
              value={astralFlowDisplaySpeed}
              onChange={(event) => onSettingsChange({
                massageLabAstralFlowSpeed: getMassageLabAstralFlowSourceSpeed(Number(event.target.value)),
              })}
              aria-label="Astral Flow animation speed"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Flow min ({settings.massageLabAstralFlowFlowMin.toFixed(1)})</span>
            <input
              type="range"
              min="0.5"
              max="10"
              step="0.1"
              value={settings.massageLabAstralFlowFlowMin}
              onChange={(event) => onSettingsChange({ massageLabAstralFlowFlowMin: Number(event.target.value) })}
              aria-label="Astral Flow flow min"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Flow max ({settings.massageLabAstralFlowFlowMax.toFixed(1)})</span>
            <input
              type="range"
              min="1"
              max="12"
              step="0.1"
              value={settings.massageLabAstralFlowFlowMax}
              onChange={(event) => onSettingsChange({ massageLabAstralFlowFlowMax: Number(event.target.value) })}
              aria-label="Astral Flow flow max"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-deep-space-nebula") {
      const useCustomPalette = settings.massageLabDeepSpaceNebulaPaletteMode === "custom"
      const nebulaDisplaySpeed = getMassageLabDeepSpaceNebulaDisplaySpeed(settings.massageLabDeepSpaceNebulaSpeed)

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.massageLabDeepSpaceNebulaPaletteMode}
              onChange={(event) => onSettingsChange({
                massageLabDeepSpaceNebulaPaletteMode: event.target.value as MassageLabDeepSpaceNebulaPaletteMode,
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
                  value={settings.massageLabDeepSpaceNebulaColorOne}
                  onChange={(event) => onSettingsChange({ massageLabDeepSpaceNebulaColorOne: event.target.value })}
                  aria-label="Deep Space Nebula highlight color"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Nebula cloud</span>
                <input
                  type="color"
                  value={settings.massageLabDeepSpaceNebulaColorTwo}
                  onChange={(event) => onSettingsChange({ massageLabDeepSpaceNebulaColorTwo: event.target.value })}
                  aria-label="Deep Space Nebula cloud color"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Deep space</span>
                <input
                  type="color"
                  value={settings.massageLabDeepSpaceNebulaColorThree}
                  onChange={(event) => onSettingsChange({ massageLabDeepSpaceNebulaColorThree: event.target.value })}
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
                  value={settings.massageLabDeepSpaceNebulaPrimaryColor}
                  onChange={(event) => onSettingsChange({ massageLabDeepSpaceNebulaPrimaryColor: event.target.value })}
                  aria-label="Deep Space Nebula primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={settings.massageLabDeepSpaceNebulaHarmony}
                  onChange={(event) => onSettingsChange({
                    massageLabDeepSpaceNebulaHarmony: event.target.value as ColorHarmony,
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
              min={MASSAGE_LAB_DEEP_SPACE_NEBULA_DISPLAY_SPEED_MIN}
              max={MASSAGE_LAB_DEEP_SPACE_NEBULA_DISPLAY_SPEED_MAX}
              step={MASSAGE_LAB_DEEP_SPACE_NEBULA_DISPLAY_SPEED_STEP}
              value={nebulaDisplaySpeed}
              onChange={(event) => onSettingsChange({
                massageLabDeepSpaceNebulaSpeed: getMassageLabDeepSpaceNebulaSourceSpeed(Number(event.target.value)),
              })}
              aria-label="Deep Space Nebula animation speed"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-grid-bloom") {
      const gridBloomDisplaySpeed = getMassageLabGridBloomDisplaySpeed(settings.massageLabGridBloomSpeed)

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.colorRow}>
            <span>Bloom color</span>
            <input
              type="color"
              value={settings.massageLabGridBloomColor}
              onChange={(event) => onSettingsChange({ massageLabGridBloomColor: event.target.value })}
              aria-label="Grid Bloom bloom color"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Animation speed ({gridBloomDisplaySpeed}%)</span>
            <input
              type="range"
              min={MASSAGE_LAB_GRID_BLOOM_DISPLAY_SPEED_MIN}
              max={MASSAGE_LAB_GRID_BLOOM_DISPLAY_SPEED_MAX}
              step={MASSAGE_LAB_GRID_BLOOM_DISPLAY_SPEED_STEP}
              value={gridBloomDisplaySpeed}
              onChange={(event) => onSettingsChange({
                massageLabGridBloomSpeed: getMassageLabGridBloomSourceSpeed(Number(event.target.value)),
              })}
              aria-label="Grid Bloom animation speed"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Grid density ({settings.massageLabGridBloomGridScale.toFixed(0)})</span>
            <input
              type="range"
              min="4"
              max="32"
              step="1"
              value={settings.massageLabGridBloomGridScale}
              onChange={(event) => onSettingsChange({ massageLabGridBloomGridScale: Number(event.target.value) })}
              aria-label="Grid Bloom grid density"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Rotation speed ({settings.massageLabGridBloomRotationSpeed.toFixed(1)}x)</span>
            <input
              type="range"
              min="-3"
              max="3"
              step="0.1"
              value={settings.massageLabGridBloomRotationSpeed}
              onChange={(event) => onSettingsChange({ massageLabGridBloomRotationSpeed: Number(event.target.value) })}
              aria-label="Grid Bloom rotation speed"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Fade falloff ({settings.massageLabGridBloomFadeFalloff.toFixed(1)})</span>
            <input
              type="range"
              min="1"
              max="24"
              step="0.5"
              value={settings.massageLabGridBloomFadeFalloff}
              onChange={(event) => onSettingsChange({ massageLabGridBloomFadeFalloff: Number(event.target.value) })}
              aria-label="Grid Bloom fade falloff"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Distortion ({settings.massageLabGridBloomDistortionAmount.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="0.5"
              step="0.01"
              value={settings.massageLabGridBloomDistortionAmount}
              onChange={(event) => onSettingsChange({
                massageLabGridBloomDistortionAmount: Number(event.target.value),
              })}
              aria-label="Grid Bloom distortion"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Flow X ({settings.massageLabGridBloomFlowSpeedX.toFixed(1)})</span>
            <input
              type="range"
              min="-2"
              max="2"
              step="0.1"
              value={settings.massageLabGridBloomFlowSpeedX}
              onChange={(event) => onSettingsChange({ massageLabGridBloomFlowSpeedX: Number(event.target.value) })}
              aria-label="Grid Bloom flow X"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Flow Y ({settings.massageLabGridBloomFlowSpeedY.toFixed(1)})</span>
            <input
              type="range"
              min="-2"
              max="2"
              step="0.1"
              value={settings.massageLabGridBloomFlowSpeedY}
              onChange={(event) => onSettingsChange({ massageLabGridBloomFlowSpeedY: Number(event.target.value) })}
              aria-label="Grid Bloom flow Y"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-chrome-flow") {
      const useCustomPalette = settings.massageLabChromeFlowPaletteMode === "custom"
      const liquidChromeFlowSpeed = getMassageLabChromeFlowDisplayFlowSpeed(settings.massageLabChromeFlowFlowSpeed)
      const liquidChromeTimeScale = getMassageLabChromeFlowDisplayTimeScale(settings.massageLabChromeFlowTimeScale)

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.massageLabChromeFlowPaletteMode}
              onChange={(event) => onSettingsChange({
                massageLabChromeFlowPaletteMode: event.target.value as MassageLabChromeFlowPaletteMode,
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
                  value={settings.massageLabChromeFlowColorOne}
                  onChange={(event) => onSettingsChange({ massageLabChromeFlowColorOne: event.target.value })}
                  aria-label="Liquid Chrome chrome color"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Shadow color</span>
                <input
                  type="color"
                  value={settings.massageLabChromeFlowColorTwo}
                  onChange={(event) => onSettingsChange({ massageLabChromeFlowColorTwo: event.target.value })}
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
                  value={settings.massageLabChromeFlowPrimaryColor}
                  onChange={(event) => onSettingsChange({ massageLabChromeFlowPrimaryColor: event.target.value })}
                  aria-label="Liquid Chrome primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={settings.massageLabChromeFlowHarmony}
                  onChange={(event) => onSettingsChange({
                    massageLabChromeFlowHarmony: event.target.value as ColorHarmony,
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
              min={MASSAGE_LAB_LIQUID_CHROME_DISPLAY_FLOW_SPEED_MIN}
              max={MASSAGE_LAB_LIQUID_CHROME_DISPLAY_FLOW_SPEED_MAX}
              step={MASSAGE_LAB_LIQUID_CHROME_DISPLAY_FLOW_SPEED_STEP}
              value={liquidChromeFlowSpeed}
              onChange={(event) => onSettingsChange({
                massageLabChromeFlowFlowSpeed: getMassageLabChromeFlowSourceFlowSpeed(Number(event.target.value)),
              })}
              aria-label="Liquid Chrome flow speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Time scale ({liquidChromeTimeScale}%)</span>
            <input
              type="range"
              min={MASSAGE_LAB_LIQUID_CHROME_DISPLAY_TIME_SCALE_MIN}
              max={MASSAGE_LAB_LIQUID_CHROME_DISPLAY_TIME_SCALE_MAX}
              step={MASSAGE_LAB_LIQUID_CHROME_DISPLAY_TIME_SCALE_STEP}
              value={liquidChromeTimeScale}
              onChange={(event) => onSettingsChange({
                massageLabChromeFlowTimeScale: getMassageLabChromeFlowSourceTimeScale(Number(event.target.value)),
              })}
              aria-label="Liquid Chrome time scale"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-retro-grid") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.colorRow}>
            <span>Background</span>
            <input
              type="color"
              value={settings.massageLabRetroGridBackgroundColor}
              onChange={(event) => onSettingsChange({ massageLabRetroGridBackgroundColor: event.target.value })}
              aria-label="Retro Grid background color"
            />
          </label>

          <label className={styles.colorRow}>
            <span>Light line color</span>
            <input
              type="color"
              value={settings.massageLabRetroGridLightLineColor}
              onChange={(event) => onSettingsChange({ massageLabRetroGridLightLineColor: event.target.value })}
              aria-label="Retro Grid light line color"
            />
          </label>

          <label className={styles.colorRow}>
            <span>Dark line color</span>
            <input
              type="color"
              value={settings.massageLabRetroGridDarkLineColor}
              onChange={(event) => onSettingsChange({ massageLabRetroGridDarkLineColor: event.target.value })}
              aria-label="Retro Grid dark line color"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Angle ({settings.massageLabRetroGridAngle.toFixed(0)} deg)</span>
            <input
              type="range"
              min="1"
              max="89"
              step="1"
              value={settings.massageLabRetroGridAngle}
              onChange={(event) => onSettingsChange({ massageLabRetroGridAngle: Number(event.target.value) })}
              aria-label="Retro Grid angle"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Cell size ({settings.massageLabRetroGridCellSize.toFixed(0)}px)</span>
            <input
              type="range"
              min="12"
              max="160"
              step="1"
              value={settings.massageLabRetroGridCellSize}
              onChange={(event) => onSettingsChange({ massageLabRetroGridCellSize: Number(event.target.value) })}
              aria-label="Retro Grid cell size"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Grid opacity ({Math.round(settings.massageLabRetroGridOpacity * 100)}%)</span>
            <input
              type="range"
              min="0.05"
              max="1"
              step="0.01"
              value={settings.massageLabRetroGridOpacity}
              onChange={(event) => onSettingsChange({ massageLabRetroGridOpacity: Number(event.target.value) })}
              aria-label="Retro Grid opacity"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-3d-globe") {
      const globeScaleDisplayPercent = getMassageLab3DGlobeScaleDisplayPercent(settings.massageLab3DGlobeScale)
      const isGraphicGlobe = settings.massageLab3DGlobeViewStyle === "graphic"
      const followSun = settings.massageLab3DGlobeLightingMode === "sun"

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>View style</span>
            <select
              value={settings.massageLab3DGlobeViewStyle}
              onChange={(event) => onSettingsChange({
                massageLab3DGlobeViewStyle: event.target.value as ChimerSettings["massageLab3DGlobeViewStyle"],
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
              value={settings.massageLab3DGlobeBackgroundColor}
              onChange={(event) => onSettingsChange({ massageLab3DGlobeBackgroundColor: event.target.value })}
              aria-label="3D Globe background color"
            />
          </label>

          {isGraphicGlobe ? (
            <>
              <label className={styles.colorRow}>
                <span>Map dots</span>
                <input
                  type="color"
                  value={settings.massageLab3DGlobeGraphicMapColor}
                  onChange={(event) => onSettingsChange({ massageLab3DGlobeGraphicMapColor: event.target.value })}
                  aria-label="3D Globe graphic map dot color"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Outer Glow</span>
                <input
                  type="color"
                  value={settings.massageLab3DGlobeGraphicGlowColor}
                  onChange={(event) => onSettingsChange({ massageLab3DGlobeGraphicGlowColor: event.target.value })}
                  aria-label="3D Globe graphic outer glow color"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Marker dots</span>
                <input
                  type="color"
                  value={settings.massageLab3DGlobeGraphicMarkerColor}
                  onChange={(event) => onSettingsChange({ massageLab3DGlobeGraphicMarkerColor: event.target.value })}
                  aria-label="3D Globe graphic marker color"
                />
              </label>
              <label className={styles.rangeRow}>
                <span>Dot density ({Math.round(settings.massageLab3DGlobeGraphicMapSamples / 1000)}k)</span>
                <input
                  type="range"
                  min="1000"
                  max="10000"
                  step="1000"
                  value={settings.massageLab3DGlobeGraphicMapSamples}
                  onChange={(event) => onSettingsChange({
                    massageLab3DGlobeGraphicMapSamples: Number(event.target.value),
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
                value={settings.massageLab3DGlobeGlobeColor}
                onChange={(event) => onSettingsChange({ massageLab3DGlobeGlobeColor: event.target.value })}
                aria-label="3D Globe tint color"
              />
            </label>
          )}

          {!followSun && (
            <>
              <label className={styles.rangeRow}>
                <span>Rotation speed ({settings.massageLab3DGlobeAutoRotateSpeed.toFixed(2)}x)</span>
                <input
                  type="range"
                  min="0.01"
                  max="2"
                  step="0.01"
                  value={settings.massageLab3DGlobeAutoRotateSpeed}
                  onChange={(event) => onSettingsChange({ massageLab3DGlobeAutoRotateSpeed: Number(event.target.value) })}
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
              onChange={(event) => onSettingsChange({ massageLab3DGlobeLightingMode: event.target.checked ? "sun" : "manual" })}
              aria-label="3D Globe follow sun"
            />
          </label>

          <label className={styles.switchRow}>
            <span>Pan controls</span>
            <input
              type="checkbox"
              checked={settings.massageLab3DGlobeEnablePan}
              onChange={(event) => onSettingsChange({ massageLab3DGlobeEnablePan: event.target.checked })}
              aria-label="3D Globe pan controls"
            />
          </label>

          {settings.massageLab3DGlobeEnablePan && (
            <>
              <label className={styles.rangeRow}>
                <span>Pan X Left/Right ({Math.round(settings.massageLab3DGlobePanX)}%)</span>
                <input
                  type="range"
                  min="-50"
                  max="50"
                  step="1"
                  value={settings.massageLab3DGlobePanX}
                  onChange={(event) => onSettingsChange({ massageLab3DGlobePanX: Number(event.target.value) })}
                  aria-label="3D Globe pan X left right"
                />
              </label>

              <label className={styles.rangeRow}>
                <span>Pan Y Up/Down ({Math.round(settings.massageLab3DGlobePanY)}%)</span>
                <input
                  type="range"
                  min="-50"
                  max="50"
                  step="1"
                  value={settings.massageLab3DGlobePanY}
                  onChange={(event) => onSettingsChange({ massageLab3DGlobePanY: Number(event.target.value) })}
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
                massageLab3DGlobeScale: getMassageLab3DGlobeScaleFromDisplayPercent(Number(event.target.value)),
              })}
              aria-label="3D Globe size"
            />
          </label>

          {!isGraphicGlobe && (
            <label className={styles.rangeRow}>
              <span>Bump scale ({settings.massageLab3DGlobeBumpScale.toFixed(1)})</span>
              <input
                type="range"
                min="0"
                max="3"
                step="0.1"
                value={settings.massageLab3DGlobeBumpScale}
                onChange={(event) => onSettingsChange({ massageLab3DGlobeBumpScale: Number(event.target.value) })}
                aria-label="3D Globe bump scale"
              />
            </label>
          )}

          {!followSun && (
            <>
              <label className={styles.rangeRow}>
                <span>Ambient light ({settings.massageLab3DGlobeAmbientIntensity.toFixed(1)})</span>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={settings.massageLab3DGlobeAmbientIntensity}
                  onChange={(event) => onSettingsChange({ massageLab3DGlobeAmbientIntensity: Number(event.target.value) })}
                  aria-label="3D Globe ambient light"
                />
              </label>

              <label className={styles.rangeRow}>
                <span>Point light ({settings.massageLab3DGlobePointLightIntensity.toFixed(1)})</span>
                <input
                  type="range"
                  min="0"
                  max="4"
                  step="0.1"
                  value={settings.massageLab3DGlobePointLightIntensity}
                  onChange={(event) => onSettingsChange({ massageLab3DGlobePointLightIntensity: Number(event.target.value) })}
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
                  checked={settings.massageLab3DGlobeShowAtmosphere}
                  onChange={(event) => onSettingsChange({ massageLab3DGlobeShowAtmosphere: event.target.checked })}
                  aria-label="3D Globe show atmosphere"
                />
              </label>

              {settings.massageLab3DGlobeShowAtmosphere && (
                <>
                  <label className={styles.colorRow}>
                    <span>Atmosphere color</span>
                    <input
                      type="color"
                      value={settings.massageLab3DGlobeAtmosphereColor}
                      onChange={(event) => onSettingsChange({ massageLab3DGlobeAtmosphereColor: event.target.value })}
                      aria-label="3D Globe atmosphere color"
                    />
                  </label>
                  <label className={styles.rangeRow}>
                    <span>Atmosphere ({settings.massageLab3DGlobeAtmosphereIntensity.toFixed(1)})</span>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={settings.massageLab3DGlobeAtmosphereIntensity}
                      onChange={(event) => onSettingsChange({ massageLab3DGlobeAtmosphereIntensity: Number(event.target.value) })}
                      aria-label="3D Globe atmosphere intensity"
                    />
                  </label>
                  <label className={styles.rangeRow}>
                    <span>Atmosphere blur ({settings.massageLab3DGlobeAtmosphereBlur.toFixed(1)})</span>
                    <input
                      type="range"
                      min="0.5"
                      max="5"
                      step="0.1"
                      value={settings.massageLab3DGlobeAtmosphereBlur}
                      onChange={(event) => onSettingsChange({ massageLab3DGlobeAtmosphereBlur: Number(event.target.value) })}
                      aria-label="3D Globe atmosphere blur"
                    />
                  </label>
                </>
              )}

              <label className={styles.switchRow}>
                <span>Wireframe</span>
                <input
                  type="checkbox"
                  checked={settings.massageLab3DGlobeShowWireframe}
                  onChange={(event) => onSettingsChange({ massageLab3DGlobeShowWireframe: event.target.checked })}
                  aria-label="3D Globe show wireframe"
                />
              </label>

              {settings.massageLab3DGlobeShowWireframe && (
                <label className={styles.colorRow}>
                  <span>Wireframe color</span>
                  <input
                    type="color"
                    value={settings.massageLab3DGlobeWireframeColor}
                    onChange={(event) => onSettingsChange({ massageLab3DGlobeWireframeColor: event.target.value })}
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
              checked={settings.massageLab3DGlobeMarkerEnabled}
              onChange={(event) => onSettingsChange({ massageLab3DGlobeMarkerEnabled: event.target.checked })}
              aria-label="3D Globe location marker"
            />
          </label>

          {settings.massageLab3DGlobeMarkerEnabled && (
            <>
              <div className={styles.locationGrid}>
                <label className={styles.textField}>
                  <span>Latitude</span>
                  <input
                    type="number"
                    min="-90"
                    max="90"
                    step="0.0001"
                    value={settings.massageLab3DGlobeMarkerLat}
                    onChange={(event) => onSettingsChange({ massageLab3DGlobeMarkerLat: Number(event.target.value) })}
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
                    value={settings.massageLab3DGlobeMarkerLng}
                    onChange={(event) => onSettingsChange({ massageLab3DGlobeMarkerLng: Number(event.target.value) })}
                    aria-label="3D Globe marker longitude"
                  />
                </label>
              </div>
              <button
                type="button"
                className={`${styles.inlineButton} ${styles.tactileButton}`}
                onClick={withPress(useCurrentLocationForGlobe)}
              >
                Use my location
              </button>
              <label className={styles.textField}>
                <span>Marker label</span>
                <input
                  type="text"
                  placeholder="Optional"
                  value={settings.massageLab3DGlobeMarkerLabel}
                  onChange={(event) => onSettingsChange({ massageLab3DGlobeMarkerLabel: event.target.value })}
                  aria-label="3D Globe marker label"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Marker icon</span>
                <select
                  value={settings.massageLab3DGlobeMarkerIcon}
                  onChange={(event) => onSettingsChange({
                    massageLab3DGlobeMarkerIcon: event.target.value as ChimerSettings["massageLab3DGlobeMarkerIcon"],
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
                <span>Marker size ({Math.round(settings.massageLab3DGlobeMarkerSize * 100)}%)</span>
                <input
                  type="range"
                  min="0.03"
                  max="0.16"
                  step="0.005"
                  value={settings.massageLab3DGlobeMarkerSize}
                  onChange={(event) => onSettingsChange({ massageLab3DGlobeMarkerSize: Number(event.target.value) })}
                  aria-label="3D Globe marker size"
                />
              </label>
            </>
          )}
        </div>
      )
    }

    if (option.id === "massage-lab-aerial-rays") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.colorRow}>
            <span>Background</span>
            <input
              type="color"
              value={settings.massageLabAerialRaysBackgroundColor}
              onChange={(event) => onSettingsChange({ massageLabAerialRaysBackgroundColor: event.target.value })}
              aria-label="Light Rays background color"
            />
          </label>

          <label className={styles.colorRow}>
            <span>Ray color</span>
            <input
              type="color"
              value={settings.massageLabAerialRaysColor}
              onChange={(event) => onSettingsChange({ massageLabAerialRaysColor: event.target.value })}
              aria-label="Light Rays color"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Ray count ({settings.massageLabAerialRaysCount})</span>
            <input
              type="range"
              min="1"
              max="20"
              step="1"
              value={settings.massageLabAerialRaysCount}
              onChange={(event) => onSettingsChange({ massageLabAerialRaysCount: Number(event.target.value) })}
              aria-label="Light Rays count"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Blur ({settings.massageLabAerialRaysBlur.toFixed(0)}px)</span>
            <input
              type="range"
              min="0"
              max="80"
              step="1"
              value={settings.massageLabAerialRaysBlur}
              onChange={(event) => onSettingsChange({ massageLabAerialRaysBlur: Number(event.target.value) })}
              aria-label="Light Rays blur"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Speed ({settings.massageLabAerialRaysSpeed.toFixed(1)}s)</span>
            <input
              type="range"
              min="2"
              max="40"
              step="0.5"
              value={settings.massageLabAerialRaysSpeed}
              onChange={(event) => onSettingsChange({ massageLabAerialRaysSpeed: Number(event.target.value) })}
              aria-label="Light Rays speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Ray length ({settings.massageLabAerialRaysLength.toFixed(0)}vh)</span>
            <input
              type="range"
              min="24"
              max="120"
              step="1"
              value={settings.massageLabAerialRaysLength}
              onChange={(event) => onSettingsChange({ massageLabAerialRaysLength: Number(event.target.value) })}
              aria-label="Light Rays length"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Ray opacity ({Math.round(settings.massageLabAerialRaysOpacity * 100)}%)</span>
            <input
              type="range"
              min="0.05"
              max="1"
              step="0.01"
              value={settings.massageLabAerialRaysOpacity}
              onChange={(event) => onSettingsChange({ massageLabAerialRaysOpacity: Number(event.target.value) })}
              aria-label="Light Rays opacity"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-wave-current") {
      const useCustomPalette = settings.massageLabWaveCurrentPaletteMode === "custom"
      const wavesSpeedX = getMassageLabWaveCurrentDisplaySpeed(settings.massageLabWaveCurrentSpeedX)
      const wavesSpeedY = getMassageLabWaveCurrentDisplaySpeed(settings.massageLabWaveCurrentSpeedY)

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.massageLabWaveCurrentPaletteMode}
              onChange={(event) => onSettingsChange({
                massageLabWaveCurrentPaletteMode: event.target.value as MassageLabWaveCurrentPaletteMode,
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
                  value={settings.massageLabWaveCurrentBackgroundColor}
                  onChange={(event) => onSettingsChange({ massageLabWaveCurrentBackgroundColor: event.target.value })}
                  aria-label="Waves background color"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Primary wave</span>
                <input
                  type="color"
                  value={settings.massageLabWaveCurrentColorOne}
                  onChange={(event) => onSettingsChange({ massageLabWaveCurrentColorOne: event.target.value })}
                  aria-label="Waves primary wave color"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Highlight</span>
                <input
                  type="color"
                  value={settings.massageLabWaveCurrentColorTwo}
                  onChange={(event) => onSettingsChange({ massageLabWaveCurrentColorTwo: event.target.value })}
                  aria-label="Waves highlight color"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Valley</span>
                <input
                  type="color"
                  value={settings.massageLabWaveCurrentColorThree}
                  onChange={(event) => onSettingsChange({ massageLabWaveCurrentColorThree: event.target.value })}
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
                  value={settings.massageLabWaveCurrentPrimaryColor}
                  onChange={(event) => onSettingsChange({ massageLabWaveCurrentPrimaryColor: event.target.value })}
                  aria-label="Waves primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={settings.massageLabWaveCurrentHarmony}
                  onChange={(event) => onSettingsChange({
                    massageLabWaveCurrentHarmony: event.target.value as ColorHarmony,
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
              min={MASSAGE_LAB_WAVES_DISPLAY_SPEED_MIN}
              max={MASSAGE_LAB_WAVES_DISPLAY_SPEED_MAX}
              step={MASSAGE_LAB_WAVES_DISPLAY_SPEED_STEP}
              value={wavesSpeedX}
              onChange={(event) => onSettingsChange({
                massageLabWaveCurrentSpeedX: getMassageLabWaveCurrentSourceSpeed(Number(event.target.value)),
              })}
              aria-label="Waves speed X"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Speed Y ({wavesSpeedY}%)</span>
            <input
              type="range"
              min={MASSAGE_LAB_WAVES_DISPLAY_SPEED_MIN}
              max={MASSAGE_LAB_WAVES_DISPLAY_SPEED_MAX}
              step={MASSAGE_LAB_WAVES_DISPLAY_SPEED_STEP}
              value={wavesSpeedY}
              onChange={(event) => onSettingsChange({
                massageLabWaveCurrentSpeedY: getMassageLabWaveCurrentSourceSpeed(Number(event.target.value)),
              })}
              aria-label="Waves speed Y"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Amplitude ({settings.massageLabWaveCurrentAmplitude.toFixed(0)})</span>
            <input
              type="range"
              min="8"
              max="64"
              step="1"
              value={settings.massageLabWaveCurrentAmplitude}
              onChange={(event) => onSettingsChange({ massageLabWaveCurrentAmplitude: Number(event.target.value) })}
              aria-label="Waves amplitude"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-ferrofluid") {
      const useCustomPalette = settings.massageLabFerrofluidPaletteMode === "custom"

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.massageLabFerrofluidPaletteMode}
              onChange={(event) => onSettingsChange({
                massageLabFerrofluidPaletteMode: event.target.value as MassageLabFerrofluidPaletteMode,
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
                  value={settings.massageLabFerrofluidColorOne}
                  onChange={(event) => onSettingsChange({ massageLabFerrofluidColorOne: event.target.value })}
                  aria-label="Ferrofluid first color"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Color 2</span>
                <input
                  type="color"
                  value={settings.massageLabFerrofluidColorTwo}
                  onChange={(event) => onSettingsChange({ massageLabFerrofluidColorTwo: event.target.value })}
                  aria-label="Ferrofluid second color"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Color 3</span>
                <input
                  type="color"
                  value={settings.massageLabFerrofluidColorThree}
                  onChange={(event) => onSettingsChange({ massageLabFerrofluidColorThree: event.target.value })}
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
                  value={settings.massageLabFerrofluidPrimaryColor}
                  onChange={(event) => onSettingsChange({ massageLabFerrofluidPrimaryColor: event.target.value })}
                  aria-label="Ferrofluid primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={settings.massageLabFerrofluidHarmony}
                  onChange={(event) => onSettingsChange({
                    massageLabFerrofluidHarmony: event.target.value as ColorHarmony,
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
              value={settings.massageLabFerrofluidFlowDirection}
              onChange={(event) => onSettingsChange({
                massageLabFerrofluidFlowDirection: event.target.value as ChimerSettings["massageLabFerrofluidFlowDirection"],
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
            <span>Animation speed ({settings.massageLabFerrofluidSpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0.05"
              max="2"
              step="0.05"
              value={settings.massageLabFerrofluidSpeed}
              onChange={(event) => onSettingsChange({ massageLabFerrofluidSpeed: Number(event.target.value) })}
              aria-label="Ferrofluid animation speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Scale ({settings.massageLabFerrofluidScale.toFixed(1)})</span>
            <input
              type="range"
              min="0.5"
              max="4"
              step="0.1"
              value={settings.massageLabFerrofluidScale}
              onChange={(event) => onSettingsChange({ massageLabFerrofluidScale: Number(event.target.value) })}
              aria-label="Ferrofluid scale"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Turbulence ({settings.massageLabFerrofluidTurbulence.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.05"
              value={settings.massageLabFerrofluidTurbulence}
              onChange={(event) => onSettingsChange({ massageLabFerrofluidTurbulence: Number(event.target.value) })}
              aria-label="Ferrofluid turbulence"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Fluidity ({settings.massageLabFerrofluidFluidity.toFixed(3)})</span>
            <input
              type="range"
              min="0.001"
              max="0.4"
              step="0.001"
              value={settings.massageLabFerrofluidFluidity}
              onChange={(event) => onSettingsChange({ massageLabFerrofluidFluidity: Number(event.target.value) })}
              aria-label="Ferrofluid fluidity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Rim width ({settings.massageLabFerrofluidRimWidth.toFixed(2)})</span>
            <input
              type="range"
              min="0.03"
              max="0.5"
              step="0.01"
              value={settings.massageLabFerrofluidRimWidth}
              onChange={(event) => onSettingsChange({ massageLabFerrofluidRimWidth: Number(event.target.value) })}
              aria-label="Ferrofluid rim width"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Sharpness ({settings.massageLabFerrofluidSharpness.toFixed(1)})</span>
            <input
              type="range"
              min="0.5"
              max="6"
              step="0.1"
              value={settings.massageLabFerrofluidSharpness}
              onChange={(event) => onSettingsChange({ massageLabFerrofluidSharpness: Number(event.target.value) })}
              aria-label="Ferrofluid sharpness"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Shimmer ({settings.massageLabFerrofluidShimmer.toFixed(1)})</span>
            <input
              type="range"
              min="0"
              max="4"
              step="0.1"
              value={settings.massageLabFerrofluidShimmer}
              onChange={(event) => onSettingsChange({ massageLabFerrofluidShimmer: Number(event.target.value) })}
              aria-label="Ferrofluid shimmer"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Glow ({settings.massageLabFerrofluidGlow.toFixed(1)})</span>
            <input
              type="range"
              min="0.1"
              max="5"
              step="0.1"
              value={settings.massageLabFerrofluidGlow}
              onChange={(event) => onSettingsChange({ massageLabFerrofluidGlow: Number(event.target.value) })}
              aria-label="Ferrofluid glow"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Opacity ({Math.round(settings.massageLabFerrofluidOpacity * 100)}%)</span>
            <input
              type="range"
              min="0.05"
              max="1"
              step="0.01"
              value={settings.massageLabFerrofluidOpacity}
              onChange={(event) => onSettingsChange({ massageLabFerrofluidOpacity: Number(event.target.value) })}
              aria-label="Ferrofluid opacity"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-lightfall") {
      const useCustomPalette = settings.massageLabLightfallPaletteMode === "custom"

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.massageLabLightfallPaletteMode}
              onChange={(event) => onSettingsChange({
                massageLabLightfallPaletteMode: event.target.value as MassageLabLightfallPaletteMode,
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
                  value={settings.massageLabLightfallColorOne}
                  onChange={(event) => onSettingsChange({ massageLabLightfallColorOne: event.target.value })}
                  aria-label="Lightfall first color"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Color 2</span>
                <input
                  type="color"
                  value={settings.massageLabLightfallColorTwo}
                  onChange={(event) => onSettingsChange({ massageLabLightfallColorTwo: event.target.value })}
                  aria-label="Lightfall second color"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Color 3</span>
                <input
                  type="color"
                  value={settings.massageLabLightfallColorThree}
                  onChange={(event) => onSettingsChange({ massageLabLightfallColorThree: event.target.value })}
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
                  value={settings.massageLabLightfallPrimaryColor}
                  onChange={(event) => onSettingsChange({ massageLabLightfallPrimaryColor: event.target.value })}
                  aria-label="Lightfall primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={settings.massageLabLightfallHarmony}
                  onChange={(event) => onSettingsChange({
                    massageLabLightfallHarmony: event.target.value as ColorHarmony,
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
              value={settings.massageLabLightfallBackgroundColor}
              onChange={(event) => onSettingsChange({ massageLabLightfallBackgroundColor: event.target.value })}
              aria-label="Lightfall background color"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Animation speed ({settings.massageLabLightfallSpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0.05"
              max="2"
              step="0.05"
              value={settings.massageLabLightfallSpeed}
              onChange={(event) => onSettingsChange({ massageLabLightfallSpeed: Number(event.target.value) })}
              aria-label="Lightfall animation speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Streak count ({settings.massageLabLightfallStreakCount.toFixed(0)})</span>
            <input
              type="range"
              min="1"
              max="16"
              step="1"
              value={settings.massageLabLightfallStreakCount}
              onChange={(event) => onSettingsChange({ massageLabLightfallStreakCount: Number(event.target.value) })}
              aria-label="Lightfall streak count"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Streak width ({settings.massageLabLightfallStreakWidth.toFixed(1)})</span>
            <input
              type="range"
              min="0.2"
              max="3"
              step="0.1"
              value={settings.massageLabLightfallStreakWidth}
              onChange={(event) => onSettingsChange({ massageLabLightfallStreakWidth: Number(event.target.value) })}
              aria-label="Lightfall streak width"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Streak length ({settings.massageLabLightfallStreakLength.toFixed(1)})</span>
            <input
              type="range"
              min="0.2"
              max="3"
              step="0.1"
              value={settings.massageLabLightfallStreakLength}
              onChange={(event) => onSettingsChange({ massageLabLightfallStreakLength: Number(event.target.value) })}
              aria-label="Lightfall streak length"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Glow ({settings.massageLabLightfallGlow.toFixed(1)})</span>
            <input
              type="range"
              min="0.1"
              max="3"
              step="0.1"
              value={settings.massageLabLightfallGlow}
              onChange={(event) => onSettingsChange({ massageLabLightfallGlow: Number(event.target.value) })}
              aria-label="Lightfall glow"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Density ({settings.massageLabLightfallDensity.toFixed(2)})</span>
            <input
              type="range"
              min="0.05"
              max="2"
              step="0.05"
              value={settings.massageLabLightfallDensity}
              onChange={(event) => onSettingsChange({ massageLabLightfallDensity: Number(event.target.value) })}
              aria-label="Lightfall density"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Twinkle ({Math.round(settings.massageLabLightfallTwinkle * 100)}%)</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.massageLabLightfallTwinkle}
              onChange={(event) => onSettingsChange({ massageLabLightfallTwinkle: Number(event.target.value) })}
              aria-label="Lightfall twinkle"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Zoom ({settings.massageLabLightfallZoom.toFixed(1)})</span>
            <input
              type="range"
              min="1"
              max="6"
              step="0.1"
              value={settings.massageLabLightfallZoom}
              onChange={(event) => onSettingsChange({ massageLabLightfallZoom: Number(event.target.value) })}
              aria-label="Lightfall zoom"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Background glow ({settings.massageLabLightfallBackgroundGlow.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1.5"
              step="0.05"
              value={settings.massageLabLightfallBackgroundGlow}
              onChange={(event) => onSettingsChange({ massageLabLightfallBackgroundGlow: Number(event.target.value) })}
              aria-label="Lightfall background glow"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Opacity ({Math.round(settings.massageLabLightfallOpacity * 100)}%)</span>
            <input
              type="range"
              min="0.05"
              max="1"
              step="0.01"
              value={settings.massageLabLightfallOpacity}
              onChange={(event) => onSettingsChange({ massageLabLightfallOpacity: Number(event.target.value) })}
              aria-label="Lightfall opacity"
            />
          </label>

          <label className={styles.switchRow}>
            <span>Cursor glow</span>
            <input
              type="checkbox"
              checked={settings.massageLabLightfallCursorEnabled}
              onChange={(event) => onSettingsChange({ massageLabLightfallCursorEnabled: event.target.checked })}
              aria-label="Lightfall cursor glow"
            />
          </label>

          {settings.massageLabLightfallCursorEnabled && (
            <>
              <label className={styles.rangeRow}>
                <span>Cursor strength ({settings.massageLabLightfallCursorStrength.toFixed(2)})</span>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.05"
                  value={settings.massageLabLightfallCursorStrength}
                  onChange={(event) => onSettingsChange({
                    massageLabLightfallCursorStrength: Number(event.target.value),
                  })}
                  aria-label="Lightfall cursor strength"
                />
              </label>

              <label className={styles.rangeRow}>
                <span>Cursor radius ({settings.massageLabLightfallCursorRadius.toFixed(2)})</span>
                <input
                  type="range"
                  min="0.05"
                  max="3"
                  step="0.05"
                  value={settings.massageLabLightfallCursorRadius}
                  onChange={(event) => onSettingsChange({
                    massageLabLightfallCursorRadius: Number(event.target.value),
                  })}
                  aria-label="Lightfall cursor radius"
                />
              </label>

              <label className={styles.rangeRow}>
                <span>Cursor smoothing ({settings.massageLabLightfallCursorDampening.toFixed(2)})</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={settings.massageLabLightfallCursorDampening}
                  onChange={(event) => onSettingsChange({
                    massageLabLightfallCursorDampening: Number(event.target.value),
                  })}
                  aria-label="Lightfall cursor smoothing"
                />
              </label>
            </>
          )}
        </div>
      )
    }

    if (option.id === "massage-lab-liquid-ether") {
      const useCustomPalette = settings.massageLabLiquidEtherPaletteMode === "custom"

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.massageLabLiquidEtherPaletteMode}
              onChange={(event) => onSettingsChange({
                massageLabLiquidEtherPaletteMode: event.target.value as MassageLabLiquidEtherPaletteMode,
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
                  value={settings.massageLabLiquidEtherColorOne}
                  onChange={(event) => onSettingsChange({ massageLabLiquidEtherColorOne: event.target.value })}
                  aria-label="Liquid Ether first color"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Color 2</span>
                <input
                  type="color"
                  value={settings.massageLabLiquidEtherColorTwo}
                  onChange={(event) => onSettingsChange({ massageLabLiquidEtherColorTwo: event.target.value })}
                  aria-label="Liquid Ether second color"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Color 3</span>
                <input
                  type="color"
                  value={settings.massageLabLiquidEtherColorThree}
                  onChange={(event) => onSettingsChange({ massageLabLiquidEtherColorThree: event.target.value })}
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
                  value={settings.massageLabLiquidEtherPrimaryColor}
                  onChange={(event) => onSettingsChange({ massageLabLiquidEtherPrimaryColor: event.target.value })}
                  aria-label="Liquid Ether primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={settings.massageLabLiquidEtherHarmony}
                  onChange={(event) => onSettingsChange({
                    massageLabLiquidEtherHarmony: event.target.value as ColorHarmony,
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
              checked={settings.massageLabLiquidEtherCursorEnabled}
              onChange={(event) => onSettingsChange({ massageLabLiquidEtherCursorEnabled: event.target.checked })}
              aria-label="Liquid Ether cursor fluid push"
            />
          </label>

          {settings.massageLabLiquidEtherCursorEnabled && (
            <>
              <label className={styles.rangeRow}>
                <span>Mouse force ({settings.massageLabLiquidEtherMouseForce.toFixed(0)})</span>
                <input
                  type="range"
                  min="0"
                  max="80"
                  step="1"
                  value={settings.massageLabLiquidEtherMouseForce}
                  onChange={(event) => onSettingsChange({
                    massageLabLiquidEtherMouseForce: Number(event.target.value),
                  })}
                  aria-label="Liquid Ether mouse force"
                />
              </label>

              <label className={styles.rangeRow}>
                <span>Cursor size ({settings.massageLabLiquidEtherCursorSize.toFixed(0)}px)</span>
                <input
                  type="range"
                  min="20"
                  max="280"
                  step="5"
                  value={settings.massageLabLiquidEtherCursorSize}
                  onChange={(event) => onSettingsChange({
                    massageLabLiquidEtherCursorSize: Number(event.target.value),
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
              checked={settings.massageLabLiquidEtherAutoDemo}
              onChange={(event) => onSettingsChange({ massageLabLiquidEtherAutoDemo: event.target.checked })}
              aria-label="Liquid Ether auto demo motion"
            />
          </label>

          {settings.massageLabLiquidEtherAutoDemo && (
            <>
              <label className={styles.rangeRow}>
                <span>Auto speed ({settings.massageLabLiquidEtherAutoSpeed.toFixed(2)}x)</span>
                <input
                  type="range"
                  min="0.05"
                  max="2"
                  step="0.05"
                  value={settings.massageLabLiquidEtherAutoSpeed}
                  onChange={(event) => onSettingsChange({
                    massageLabLiquidEtherAutoSpeed: Number(event.target.value),
                  })}
                  aria-label="Liquid Ether auto speed"
                />
              </label>

              <label className={styles.rangeRow}>
                <span>Auto intensity ({settings.massageLabLiquidEtherAutoIntensity.toFixed(1)})</span>
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="0.1"
                  value={settings.massageLabLiquidEtherAutoIntensity}
                  onChange={(event) => onSettingsChange({
                    massageLabLiquidEtherAutoIntensity: Number(event.target.value),
                  })}
                  aria-label="Liquid Ether auto intensity"
                />
              </label>

              <label className={styles.rangeRow}>
                <span>Auto resume ({(settings.massageLabLiquidEtherAutoResumeDelay / 1000).toFixed(1)}s)</span>
                <input
                  type="range"
                  min="250"
                  max="5000"
                  step="250"
                  value={settings.massageLabLiquidEtherAutoResumeDelay}
                  onChange={(event) => onSettingsChange({
                    massageLabLiquidEtherAutoResumeDelay: Number(event.target.value),
                  })}
                  aria-label="Liquid Ether auto resume delay"
                />
              </label>

              <label className={styles.rangeRow}>
                <span>Auto ramp ({settings.massageLabLiquidEtherAutoRampDuration.toFixed(1)}s)</span>
                <input
                  type="range"
                  min="0"
                  max="3"
                  step="0.1"
                  value={settings.massageLabLiquidEtherAutoRampDuration}
                  onChange={(event) => onSettingsChange({
                    massageLabLiquidEtherAutoRampDuration: Number(event.target.value),
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
              checked={settings.massageLabLiquidEtherIsViscous}
              onChange={(event) => onSettingsChange({ massageLabLiquidEtherIsViscous: event.target.checked })}
              aria-label="Liquid Ether viscous fluid"
            />
          </label>

          {settings.massageLabLiquidEtherIsViscous && (
            <label className={styles.rangeRow}>
              <span>Viscosity ({settings.massageLabLiquidEtherViscous.toFixed(0)})</span>
              <input
                type="range"
                min="0"
                max="80"
                step="1"
                value={settings.massageLabLiquidEtherViscous}
                onChange={(event) => onSettingsChange({ massageLabLiquidEtherViscous: Number(event.target.value) })}
                aria-label="Liquid Ether viscosity"
              />
            </label>
          )}

          <label className={styles.rangeRow}>
            <span>Viscous iterations ({settings.massageLabLiquidEtherIterationsViscous.toFixed(0)})</span>
            <input
              type="range"
              min="4"
              max="64"
              step="1"
              value={settings.massageLabLiquidEtherIterationsViscous}
              onChange={(event) => onSettingsChange({
                massageLabLiquidEtherIterationsViscous: Number(event.target.value),
              })}
              aria-label="Liquid Ether viscous iterations"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Poisson iterations ({settings.massageLabLiquidEtherIterationsPoisson.toFixed(0)})</span>
            <input
              type="range"
              min="4"
              max="64"
              step="1"
              value={settings.massageLabLiquidEtherIterationsPoisson}
              onChange={(event) => onSettingsChange({
                massageLabLiquidEtherIterationsPoisson: Number(event.target.value),
              })}
              aria-label="Liquid Ether Poisson iterations"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Delta time ({settings.massageLabLiquidEtherDt.toFixed(3)})</span>
            <input
              type="range"
              min="0.004"
              max="0.04"
              step="0.001"
              value={settings.massageLabLiquidEtherDt}
              onChange={(event) => onSettingsChange({ massageLabLiquidEtherDt: Number(event.target.value) })}
              aria-label="Liquid Ether delta time"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Resolution ({settings.massageLabLiquidEtherResolution.toFixed(2)})</span>
            <input
              type="range"
              min="0.2"
              max="1"
              step="0.05"
              value={settings.massageLabLiquidEtherResolution}
              onChange={(event) => onSettingsChange({ massageLabLiquidEtherResolution: Number(event.target.value) })}
              aria-label="Liquid Ether resolution"
            />
          </label>

          <label className={styles.switchRow}>
            <span>BFECC advection</span>
            <input
              type="checkbox"
              checked={settings.massageLabLiquidEtherBfecc}
              onChange={(event) => onSettingsChange({ massageLabLiquidEtherBfecc: event.target.checked })}
              aria-label="Liquid Ether BFECC advection"
            />
          </label>

          <label className={styles.switchRow}>
            <span>Bounce edges</span>
            <input
              type="checkbox"
              checked={settings.massageLabLiquidEtherIsBounce}
              onChange={(event) => onSettingsChange({ massageLabLiquidEtherIsBounce: event.target.checked })}
              aria-label="Liquid Ether bounce edges"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Opacity ({Math.round(settings.massageLabLiquidEtherOpacity * 100)}%)</span>
            <input
              type="range"
              min="0.05"
              max="1"
              step="0.01"
              value={settings.massageLabLiquidEtherOpacity}
              onChange={(event) => onSettingsChange({ massageLabLiquidEtherOpacity: Number(event.target.value) })}
              aria-label="Liquid Ether opacity"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-prism") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Rotation mode</span>
            <select
              value={settings.massageLabPrismAnimationType}
              onChange={(event) => onSettingsChange({
                massageLabPrismAnimationType: event.target.value as MassageLabPrismAnimationType,
              })}
              aria-label="Prism rotation mode"
            >
              <option value="rotate">Source rotate</option>
              <option value="3drotate">3D rotate</option>
              <option value="hover">Hover cursor</option>
            </select>
          </label>

          <label className={styles.rangeRow}>
            <span>Height ({settings.massageLabPrismHeight.toFixed(1)})</span>
            <input
              type="range"
              min="0.5"
              max="8"
              step="0.1"
              value={settings.massageLabPrismHeight}
              onChange={(event) => onSettingsChange({ massageLabPrismHeight: Number(event.target.value) })}
              aria-label="Prism height"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Base width ({settings.massageLabPrismBaseWidth.toFixed(1)})</span>
            <input
              type="range"
              min="0.5"
              max="10"
              step="0.1"
              value={settings.massageLabPrismBaseWidth}
              onChange={(event) => onSettingsChange({ massageLabPrismBaseWidth: Number(event.target.value) })}
              aria-label="Prism base width"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Glow ({settings.massageLabPrismGlow.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={settings.massageLabPrismGlow}
              onChange={(event) => onSettingsChange({ massageLabPrismGlow: Number(event.target.value) })}
              aria-label="Prism glow"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Bloom ({settings.massageLabPrismBloom.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={settings.massageLabPrismBloom}
              onChange={(event) => onSettingsChange({ massageLabPrismBloom: Number(event.target.value) })}
              aria-label="Prism bloom"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Noise ({settings.massageLabPrismNoise.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.02"
              value={settings.massageLabPrismNoise}
              onChange={(event) => onSettingsChange({ massageLabPrismNoise: Number(event.target.value) })}
              aria-label="Prism noise"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Scale ({settings.massageLabPrismScale.toFixed(1)})</span>
            <input
              type="range"
              min="0.5"
              max="7"
              step="0.1"
              value={settings.massageLabPrismScale}
              onChange={(event) => onSettingsChange({ massageLabPrismScale: Number(event.target.value) })}
              aria-label="Prism scale"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Hue shift ({settings.massageLabPrismHueShift.toFixed(2)})</span>
            <input
              type="range"
              min="-3.1416"
              max="3.1416"
              step="0.05"
              value={settings.massageLabPrismHueShift}
              onChange={(event) => onSettingsChange({ massageLabPrismHueShift: Number(event.target.value) })}
              aria-label="Prism hue shift"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Color frequency ({settings.massageLabPrismColorFrequency.toFixed(2)})</span>
            <input
              type="range"
              min="0.1"
              max="3"
              step="0.05"
              value={settings.massageLabPrismColorFrequency}
              onChange={(event) => onSettingsChange({ massageLabPrismColorFrequency: Number(event.target.value) })}
              aria-label="Prism color frequency"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Time scale ({settings.massageLabPrismTimeScale.toFixed(2)}x)</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.05"
              value={settings.massageLabPrismTimeScale}
              onChange={(event) => onSettingsChange({ massageLabPrismTimeScale: Number(event.target.value) })}
              aria-label="Prism time scale"
            />
          </label>

          {settings.massageLabPrismAnimationType === "hover" && (
            <>
              <label className={styles.rangeRow}>
                <span>Hover strength ({settings.massageLabPrismHoverStrength.toFixed(1)})</span>
                <input
                  type="range"
                  min="0"
                  max="4"
                  step="0.1"
                  value={settings.massageLabPrismHoverStrength}
                  onChange={(event) => onSettingsChange({ massageLabPrismHoverStrength: Number(event.target.value) })}
                  aria-label="Prism hover strength"
                />
              </label>

              <label className={styles.rangeRow}>
                <span>Hover inertia ({settings.massageLabPrismInertia.toFixed(2)})</span>
                <input
                  type="range"
                  min="0.01"
                  max="0.4"
                  step="0.01"
                  value={settings.massageLabPrismInertia}
                  onChange={(event) => onSettingsChange({ massageLabPrismInertia: Number(event.target.value) })}
                  aria-label="Prism hover inertia"
                />
              </label>
            </>
          )}

          <label className={styles.rangeRow}>
            <span>Offset X ({settings.massageLabPrismOffsetX.toFixed(0)}px)</span>
            <input
              type="range"
              min="-400"
              max="400"
              step="10"
              value={settings.massageLabPrismOffsetX}
              onChange={(event) => onSettingsChange({ massageLabPrismOffsetX: Number(event.target.value) })}
              aria-label="Prism horizontal offset"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Offset Y ({settings.massageLabPrismOffsetY.toFixed(0)}px)</span>
            <input
              type="range"
              min="-400"
              max="400"
              step="10"
              value={settings.massageLabPrismOffsetY}
              onChange={(event) => onSettingsChange({ massageLabPrismOffsetY: Number(event.target.value) })}
              aria-label="Prism vertical offset"
            />
          </label>

          <label className={styles.switchRow}>
            <span>Transparent blend</span>
            <input
              type="checkbox"
              checked={settings.massageLabPrismTransparent}
              onChange={(event) => onSettingsChange({ massageLabPrismTransparent: event.target.checked })}
              aria-label="Prism transparent blend"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-dark-veil") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.rangeRow}>
            <span>Hue shift ({settings.massageLabDarkVeilHueShift.toFixed(0)} deg)</span>
            <input
              type="range"
              min="-180"
              max="180"
              step="1"
              value={settings.massageLabDarkVeilHueShift}
              onChange={(event) => onSettingsChange({ massageLabDarkVeilHueShift: Number(event.target.value) })}
              aria-label="Dark Veil hue shift"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Animation speed ({settings.massageLabDarkVeilSpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.05"
              value={settings.massageLabDarkVeilSpeed}
              onChange={(event) => onSettingsChange({ massageLabDarkVeilSpeed: Number(event.target.value) })}
              aria-label="Dark Veil animation speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Noise ({settings.massageLabDarkVeilNoiseIntensity.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.massageLabDarkVeilNoiseIntensity}
              onChange={(event) => onSettingsChange({ massageLabDarkVeilNoiseIntensity: Number(event.target.value) })}
              aria-label="Dark Veil noise intensity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Scanline intensity ({settings.massageLabDarkVeilScanlineIntensity.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.massageLabDarkVeilScanlineIntensity}
              onChange={(event) => onSettingsChange({
                massageLabDarkVeilScanlineIntensity: Number(event.target.value),
              })}
              aria-label="Dark Veil scanline intensity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Scanline frequency ({settings.massageLabDarkVeilScanlineFrequency.toFixed(1)})</span>
            <input
              type="range"
              min="0"
              max="40"
              step="0.5"
              value={settings.massageLabDarkVeilScanlineFrequency}
              onChange={(event) => onSettingsChange({
                massageLabDarkVeilScanlineFrequency: Number(event.target.value),
              })}
              aria-label="Dark Veil scanline frequency"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Warp ({settings.massageLabDarkVeilWarpAmount.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.01"
              value={settings.massageLabDarkVeilWarpAmount}
              onChange={(event) => onSettingsChange({ massageLabDarkVeilWarpAmount: Number(event.target.value) })}
              aria-label="Dark Veil warp amount"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Resolution scale ({settings.massageLabDarkVeilResolutionScale.toFixed(2)})</span>
            <input
              type="range"
              min="0.25"
              max="1"
              step="0.05"
              value={settings.massageLabDarkVeilResolutionScale}
              onChange={(event) => onSettingsChange({ massageLabDarkVeilResolutionScale: Number(event.target.value) })}
              aria-label="Dark Veil resolution scale"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-light-pillar") {
      const useCustomPalette = settings.massageLabLightPillarPaletteMode === "custom"

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.massageLabLightPillarPaletteMode}
              onChange={(event) => onSettingsChange({
                massageLabLightPillarPaletteMode: event.target.value as MassageLabLightPillarPaletteMode,
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
                  value={settings.massageLabLightPillarTopColor}
                  onChange={(event) => onSettingsChange({ massageLabLightPillarTopColor: event.target.value })}
                  aria-label="Light Pillar top color"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Bottom color</span>
                <input
                  type="color"
                  value={settings.massageLabLightPillarBottomColor}
                  onChange={(event) => onSettingsChange({ massageLabLightPillarBottomColor: event.target.value })}
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
                  value={settings.massageLabLightPillarPrimaryColor}
                  onChange={(event) => onSettingsChange({ massageLabLightPillarPrimaryColor: event.target.value })}
                  aria-label="Light Pillar primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={settings.massageLabLightPillarHarmony}
                  onChange={(event) => onSettingsChange({
                    massageLabLightPillarHarmony: event.target.value as ColorHarmony,
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
              value={settings.massageLabLightPillarQuality}
              onChange={(event) => onSettingsChange({
                massageLabLightPillarQuality: event.target.value as MassageLabLightPillarQuality,
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
              value={settings.massageLabLightPillarBlendMode}
              onChange={(event) => onSettingsChange({
                massageLabLightPillarBlendMode: event.target.value as MassageLabLightPillarBlendMode,
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
            <span>Intensity ({settings.massageLabLightPillarIntensity.toFixed(2)})</span>
            <input
              type="range"
              min="0.1"
              max="3"
              step="0.05"
              value={settings.massageLabLightPillarIntensity}
              onChange={(event) => onSettingsChange({ massageLabLightPillarIntensity: Number(event.target.value) })}
              aria-label="Light Pillar intensity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Rotation speed ({settings.massageLabLightPillarRotationSpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.05"
              value={settings.massageLabLightPillarRotationSpeed}
              onChange={(event) => onSettingsChange({ massageLabLightPillarRotationSpeed: Number(event.target.value) })}
              aria-label="Light Pillar rotation speed"
            />
          </label>

          <label className={styles.switchRow}>
            <span>Cursor rotation</span>
            <input
              type="checkbox"
              checked={settings.massageLabLightPillarInteractive}
              onChange={(event) => onSettingsChange({ massageLabLightPillarInteractive: event.target.checked })}
              aria-label="Light Pillar cursor rotation"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Glow amount ({settings.massageLabLightPillarGlowAmount.toFixed(3)})</span>
            <input
              type="range"
              min="0.001"
              max="0.03"
              step="0.001"
              value={settings.massageLabLightPillarGlowAmount}
              onChange={(event) => onSettingsChange({ massageLabLightPillarGlowAmount: Number(event.target.value) })}
              aria-label="Light Pillar glow amount"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Pillar width ({settings.massageLabLightPillarWidth.toFixed(1)})</span>
            <input
              type="range"
              min="0.5"
              max="8"
              step="0.1"
              value={settings.massageLabLightPillarWidth}
              onChange={(event) => onSettingsChange({ massageLabLightPillarWidth: Number(event.target.value) })}
              aria-label="Light Pillar width"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Pillar height ({settings.massageLabLightPillarHeight.toFixed(2)})</span>
            <input
              type="range"
              min="0.1"
              max="2"
              step="0.05"
              value={settings.massageLabLightPillarHeight}
              onChange={(event) => onSettingsChange({ massageLabLightPillarHeight: Number(event.target.value) })}
              aria-label="Light Pillar height"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Noise ({settings.massageLabLightPillarNoiseIntensity.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.massageLabLightPillarNoiseIntensity}
              onChange={(event) => onSettingsChange({ massageLabLightPillarNoiseIntensity: Number(event.target.value) })}
              aria-label="Light Pillar noise intensity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Pillar rotation ({settings.massageLabLightPillarRotation.toFixed(0)} deg)</span>
            <input
              type="range"
              min="-180"
              max="180"
              step="1"
              value={settings.massageLabLightPillarRotation}
              onChange={(event) => onSettingsChange({ massageLabLightPillarRotation: Number(event.target.value) })}
              aria-label="Light Pillar rotation"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-silk") {
      const useCustomColor = settings.massageLabSilkPaletteMode === "custom"

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.massageLabSilkPaletteMode}
              onChange={(event) => onSettingsChange({
                massageLabSilkPaletteMode: event.target.value as MassageLabSilkPaletteMode,
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
                value={settings.massageLabSilkColor}
                onChange={(event) => onSettingsChange({ massageLabSilkColor: event.target.value })}
                aria-label="Silk color"
              />
            </label>
          ) : (
            <>
              <label className={styles.colorRow}>
                <span>Primary color</span>
                <input
                  type="color"
                  value={settings.massageLabSilkPrimaryColor}
                  onChange={(event) => onSettingsChange({ massageLabSilkPrimaryColor: event.target.value })}
                  aria-label="Silk primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={settings.massageLabSilkHarmony}
                  onChange={(event) => onSettingsChange({
                    massageLabSilkHarmony: event.target.value as ColorHarmony,
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
            <span>Speed ({settings.massageLabSilkSpeed.toFixed(1)}x)</span>
            <input
              type="range"
              min="0"
              max="10"
              step="0.1"
              value={settings.massageLabSilkSpeed}
              onChange={(event) => onSettingsChange({ massageLabSilkSpeed: Number(event.target.value) })}
              aria-label="Silk speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Scale ({settings.massageLabSilkScale.toFixed(2)})</span>
            <input
              type="range"
              min="0.2"
              max="4"
              step="0.05"
              value={settings.massageLabSilkScale}
              onChange={(event) => onSettingsChange({ massageLabSilkScale: Number(event.target.value) })}
              aria-label="Silk scale"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Noise ({settings.massageLabSilkNoiseIntensity.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="4"
              step="0.05"
              value={settings.massageLabSilkNoiseIntensity}
              onChange={(event) => onSettingsChange({ massageLabSilkNoiseIntensity: Number(event.target.value) })}
              aria-label="Silk noise intensity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Rotation ({settings.massageLabSilkRotation.toFixed(2)} rad)</span>
            <input
              type="range"
              min="-3.1416"
              max="3.1416"
              step="0.05"
              value={settings.massageLabSilkRotation}
              onChange={(event) => onSettingsChange({ massageLabSilkRotation: Number(event.target.value) })}
              aria-label="Silk rotation"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-floating-lines") {
      const useCustomGradient = settings.massageLabFloatingLinesPaletteMode === "custom"
      const useHarmonyGradient = settings.massageLabFloatingLinesPaletteMode === "harmony"

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.massageLabFloatingLinesPaletteMode}
              onChange={(event) => onSettingsChange({
                massageLabFloatingLinesPaletteMode: event.target.value as MassageLabFloatingLinesPaletteMode,
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
                  value={settings.massageLabFloatingLinesColorOne}
                  onChange={(event) => onSettingsChange({ massageLabFloatingLinesColorOne: event.target.value })}
                  aria-label="Floating Lines gradient color 1"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Gradient 2</span>
                <input
                  type="color"
                  value={settings.massageLabFloatingLinesColorTwo}
                  onChange={(event) => onSettingsChange({ massageLabFloatingLinesColorTwo: event.target.value })}
                  aria-label="Floating Lines gradient color 2"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Gradient 3</span>
                <input
                  type="color"
                  value={settings.massageLabFloatingLinesColorThree}
                  onChange={(event) => onSettingsChange({ massageLabFloatingLinesColorThree: event.target.value })}
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
                  value={settings.massageLabFloatingLinesPrimaryColor}
                  onChange={(event) => onSettingsChange({ massageLabFloatingLinesPrimaryColor: event.target.value })}
                  aria-label="Floating Lines primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={settings.massageLabFloatingLinesHarmony}
                  onChange={(event) => onSettingsChange({
                    massageLabFloatingLinesHarmony: event.target.value as ColorHarmony,
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
              value={settings.massageLabFloatingLinesBlendMode}
              onChange={(event) => onSettingsChange({
                massageLabFloatingLinesBlendMode: event.target.value as MassageLabFloatingLinesBlendMode,
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
            <span>Animation speed ({settings.massageLabFloatingLinesAnimationSpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0"
              max="4"
              step="0.05"
              value={settings.massageLabFloatingLinesAnimationSpeed}
              onChange={(event) => onSettingsChange({
                massageLabFloatingLinesAnimationSpeed: Number(event.target.value),
              })}
              aria-label="Floating Lines animation speed"
            />
          </label>

          {(["Top", "Middle", "Bottom"] as const).map((waveName) => {
            const key = waveName.toLowerCase() as "top" | "middle" | "bottom"
            const enabledKey = `massageLabFloatingLinesEnable${waveName}` as const
            const countKey = `massageLabFloatingLines${waveName}LineCount` as const
            const distanceKey = `massageLabFloatingLines${waveName}LineDistance` as const
            const waveXKey = `massageLabFloatingLines${waveName}WaveX` as const
            const waveYKey = `massageLabFloatingLines${waveName}WaveY` as const
            const rotateKey = `massageLabFloatingLines${waveName}WaveRotate` as const

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
              checked={settings.massageLabFloatingLinesInteractive}
              onChange={(event) => onSettingsChange({ massageLabFloatingLinesInteractive: event.target.checked })}
              aria-label="Floating Lines cursor bend"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Bend radius ({settings.massageLabFloatingLinesBendRadius.toFixed(1)})</span>
            <input
              type="range"
              min="0.1"
              max="20"
              step="0.1"
              value={settings.massageLabFloatingLinesBendRadius}
              onChange={(event) => onSettingsChange({ massageLabFloatingLinesBendRadius: Number(event.target.value) })}
              aria-label="Floating Lines bend radius"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Bend strength ({settings.massageLabFloatingLinesBendStrength.toFixed(2)})</span>
            <input
              type="range"
              min="-2"
              max="2"
              step="0.05"
              value={settings.massageLabFloatingLinesBendStrength}
              onChange={(event) => onSettingsChange({
                massageLabFloatingLinesBendStrength: Number(event.target.value),
              })}
              aria-label="Floating Lines bend strength"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Mouse damping ({settings.massageLabFloatingLinesMouseDamping.toFixed(2)})</span>
            <input
              type="range"
              min="0.01"
              max="1"
              step="0.01"
              value={settings.massageLabFloatingLinesMouseDamping}
              onChange={(event) => onSettingsChange({
                massageLabFloatingLinesMouseDamping: Number(event.target.value),
              })}
              aria-label="Floating Lines mouse damping"
            />
          </label>

          <label className={styles.switchRow}>
            <span>Parallax</span>
            <input
              type="checkbox"
              checked={settings.massageLabFloatingLinesParallax}
              onChange={(event) => onSettingsChange({ massageLabFloatingLinesParallax: event.target.checked })}
              aria-label="Floating Lines parallax"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Parallax strength ({settings.massageLabFloatingLinesParallaxStrength.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.massageLabFloatingLinesParallaxStrength}
              onChange={(event) => onSettingsChange({
                massageLabFloatingLinesParallaxStrength: Number(event.target.value),
              })}
              aria-label="Floating Lines parallax strength"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-side-rays") {
      const useCustomRays = settings.massageLabSideRaysPaletteMode === "custom"
      const useHarmonyRays = settings.massageLabSideRaysPaletteMode === "harmony"

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.massageLabSideRaysPaletteMode}
              onChange={(event) => onSettingsChange({
                massageLabSideRaysPaletteMode: event.target.value as MassageLabSideRaysPaletteMode,
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
                  value={settings.massageLabSideRaysColorOne}
                  onChange={(event) => onSettingsChange({ massageLabSideRaysColorOne: event.target.value })}
                  aria-label="Side Rays color 1"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Ray color 2</span>
                <input
                  type="color"
                  value={settings.massageLabSideRaysColorTwo}
                  onChange={(event) => onSettingsChange({ massageLabSideRaysColorTwo: event.target.value })}
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
                  value={settings.massageLabSideRaysPrimaryColor}
                  onChange={(event) => onSettingsChange({ massageLabSideRaysPrimaryColor: event.target.value })}
                  aria-label="Side Rays primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={settings.massageLabSideRaysHarmony}
                  onChange={(event) => onSettingsChange({
                    massageLabSideRaysHarmony: event.target.value as ColorHarmony,
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
              value={settings.massageLabSideRaysOrigin}
              onChange={(event) => onSettingsChange({
                massageLabSideRaysOrigin: event.target.value as MassageLabSideRaysOrigin,
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
            <span>Speed ({settings.massageLabSideRaysSpeed.toFixed(1)}x)</span>
            <input
              type="range"
              min="0"
              max="8"
              step="0.1"
              value={settings.massageLabSideRaysSpeed}
              onChange={(event) => onSettingsChange({ massageLabSideRaysSpeed: Number(event.target.value) })}
              aria-label="Side Rays speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Intensity ({settings.massageLabSideRaysIntensity.toFixed(1)})</span>
            <input
              type="range"
              min="0"
              max="6"
              step="0.1"
              value={settings.massageLabSideRaysIntensity}
              onChange={(event) => onSettingsChange({ massageLabSideRaysIntensity: Number(event.target.value) })}
              aria-label="Side Rays intensity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Spread ({settings.massageLabSideRaysSpread.toFixed(1)})</span>
            <input
              type="range"
              min="0.1"
              max="5"
              step="0.1"
              value={settings.massageLabSideRaysSpread}
              onChange={(event) => onSettingsChange({ massageLabSideRaysSpread: Number(event.target.value) })}
              aria-label="Side Rays spread"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Tilt ({settings.massageLabSideRaysTilt.toFixed(0)} deg)</span>
            <input
              type="range"
              min="-90"
              max="90"
              step="1"
              value={settings.massageLabSideRaysTilt}
              onChange={(event) => onSettingsChange({ massageLabSideRaysTilt: Number(event.target.value) })}
              aria-label="Side Rays tilt"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Saturation ({settings.massageLabSideRaysSaturation.toFixed(1)})</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.1"
              value={settings.massageLabSideRaysSaturation}
              onChange={(event) => onSettingsChange({ massageLabSideRaysSaturation: Number(event.target.value) })}
              aria-label="Side Rays saturation"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Blend ({settings.massageLabSideRaysBlend.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.massageLabSideRaysBlend}
              onChange={(event) => onSettingsChange({ massageLabSideRaysBlend: Number(event.target.value) })}
              aria-label="Side Rays blend"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Falloff ({settings.massageLabSideRaysFalloff.toFixed(1)})</span>
            <input
              type="range"
              min="0.2"
              max="4"
              step="0.1"
              value={settings.massageLabSideRaysFalloff}
              onChange={(event) => onSettingsChange({ massageLabSideRaysFalloff: Number(event.target.value) })}
              aria-label="Side Rays falloff"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Opacity ({Math.round(settings.massageLabSideRaysOpacity * 100)}%)</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.massageLabSideRaysOpacity}
              onChange={(event) => onSettingsChange({ massageLabSideRaysOpacity: Number(event.target.value) })}
              aria-label="Side Rays opacity"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-light-rays") {
      const useCustomRayColor = settings.massageLabLightRaysPaletteMode === "custom"
      const useHarmonyRayColor = settings.massageLabLightRaysPaletteMode === "harmony"

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.massageLabLightRaysPaletteMode}
              onChange={(event) => onSettingsChange({
                massageLabLightRaysPaletteMode: event.target.value as MassageLabLightRaysPaletteMode,
              })}
              aria-label="Light Rays color mode"
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
                value={settings.massageLabLightRaysColor}
                onChange={(event) => onSettingsChange({ massageLabLightRaysColor: event.target.value })}
                aria-label="Light Rays color"
              />
            </label>
          )}

          {useHarmonyRayColor && (
            <>
              <label className={styles.colorRow}>
                <span>Primary color</span>
                <input
                  type="color"
                  value={settings.massageLabLightRaysPrimaryColor}
                  onChange={(event) => onSettingsChange({ massageLabLightRaysPrimaryColor: event.target.value })}
                  aria-label="Light Rays primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={settings.massageLabLightRaysHarmony}
                  onChange={(event) => onSettingsChange({
                    massageLabLightRaysHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="Light Rays color harmony"
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
              value={settings.massageLabLightRaysOrigin}
              onChange={(event) => onSettingsChange({
                massageLabLightRaysOrigin: event.target.value as MassageLabLightRaysOrigin,
              })}
              aria-label="Light Rays origin"
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
              checked={settings.massageLabLightRaysPulsating}
              onChange={(event) => onSettingsChange({ massageLabLightRaysPulsating: event.target.checked })}
              aria-label="Light Rays pulsating"
            />
            <span>Pulsating rays</span>
          </label>

          <label className={styles.selectRow}>
            <input
              type="checkbox"
              checked={settings.massageLabLightRaysFollowMouse}
              onChange={(event) => onSettingsChange({ massageLabLightRaysFollowMouse: event.target.checked })}
              aria-label="Light Rays follow mouse"
            />
            <span>Follow cursor</span>
          </label>

          <label className={styles.rangeRow}>
            <span>Speed ({settings.massageLabLightRaysSpeed.toFixed(1)}x)</span>
            <input
              type="range"
              min="0"
              max="4"
              step="0.1"
              value={settings.massageLabLightRaysSpeed}
              onChange={(event) => onSettingsChange({ massageLabLightRaysSpeed: Number(event.target.value) })}
              aria-label="Light Rays speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Spread ({settings.massageLabLightRaysSpread.toFixed(1)})</span>
            <input
              type="range"
              min="0.1"
              max="4"
              step="0.1"
              value={settings.massageLabLightRaysSpread}
              onChange={(event) => onSettingsChange({ massageLabLightRaysSpread: Number(event.target.value) })}
              aria-label="Light Rays spread"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Length ({settings.massageLabLightRaysLength.toFixed(1)})</span>
            <input
              type="range"
              min="0.25"
              max="5"
              step="0.05"
              value={settings.massageLabLightRaysLength}
              onChange={(event) => onSettingsChange({ massageLabLightRaysLength: Number(event.target.value) })}
              aria-label="Light Rays length"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Fade distance ({settings.massageLabLightRaysFadeDistance.toFixed(1)})</span>
            <input
              type="range"
              min="0.1"
              max="3"
              step="0.1"
              value={settings.massageLabLightRaysFadeDistance}
              onChange={(event) => onSettingsChange({ massageLabLightRaysFadeDistance: Number(event.target.value) })}
              aria-label="Light Rays fade distance"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Saturation ({settings.massageLabLightRaysSaturation.toFixed(1)})</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.1"
              value={settings.massageLabLightRaysSaturation}
              onChange={(event) => onSettingsChange({ massageLabLightRaysSaturation: Number(event.target.value) })}
              aria-label="Light Rays saturation"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Mouse influence ({settings.massageLabLightRaysMouseInfluence.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.massageLabLightRaysMouseInfluence}
              onChange={(event) => onSettingsChange({ massageLabLightRaysMouseInfluence: Number(event.target.value) })}
              aria-label="Light Rays mouse influence"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Noise ({settings.massageLabLightRaysNoiseAmount.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.massageLabLightRaysNoiseAmount}
              onChange={(event) => onSettingsChange({ massageLabLightRaysNoiseAmount: Number(event.target.value) })}
              aria-label="Light Rays noise amount"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Distortion ({settings.massageLabLightRaysDistortion.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.01"
              value={settings.massageLabLightRaysDistortion}
              onChange={(event) => onSettingsChange({ massageLabLightRaysDistortion: Number(event.target.value) })}
              aria-label="Light Rays distortion"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-pixel-blast") {
      const useCustomPixelColor = settings.massageLabPixelBlastPaletteMode === "custom"
      const useHarmonyPixelColor = settings.massageLabPixelBlastPaletteMode === "harmony"

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.massageLabPixelBlastPaletteMode}
              onChange={(event) => onSettingsChange({
                massageLabPixelBlastPaletteMode: event.target.value as MassageLabPixelBlastPaletteMode,
              })}
              aria-label="MassageLab Pixel Blast color mode"
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
                value={settings.massageLabPixelBlastColor}
                onChange={(event) => onSettingsChange({ massageLabPixelBlastColor: event.target.value })}
                aria-label="MassageLab Pixel Blast color"
              />
            </label>
          )}

          {useHarmonyPixelColor && (
            <>
              <label className={styles.colorRow}>
                <span>Primary color</span>
                <input
                  type="color"
                  value={settings.massageLabPixelBlastPrimaryColor}
                  onChange={(event) => onSettingsChange({ massageLabPixelBlastPrimaryColor: event.target.value })}
                  aria-label="MassageLab Pixel Blast primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={settings.massageLabPixelBlastHarmony}
                  onChange={(event) => onSettingsChange({
                    massageLabPixelBlastHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="MassageLab Pixel Blast color harmony"
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
              value={settings.massageLabPixelBlastVariant}
              onChange={(event) => onSettingsChange({
                massageLabPixelBlastVariant: event.target.value as MassageLabPixelBlastVariant,
              })}
              aria-label="MassageLab Pixel Blast shape"
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
              checked={settings.massageLabPixelBlastAntialias}
              onChange={(event) => onSettingsChange({ massageLabPixelBlastAntialias: event.target.checked })}
              aria-label="MassageLab Pixel Blast antialias"
            />
            <span>Antialias edges</span>
          </label>

          <label className={styles.selectRow}>
            <input
              type="checkbox"
              checked={settings.massageLabPixelBlastEnableRipples}
              onChange={(event) => onSettingsChange({ massageLabPixelBlastEnableRipples: event.target.checked })}
              aria-label="MassageLab Pixel Blast ripple clicks"
            />
            <span>Ripple clicks</span>
          </label>

          <label className={styles.selectRow}>
            <input
              type="checkbox"
              checked={settings.massageLabPixelBlastLiquid}
              onChange={(event) => onSettingsChange({ massageLabPixelBlastLiquid: event.target.checked })}
              aria-label="MassageLab Pixel Blast liquid pointer warp"
            />
            <span>Liquid pointer warp</span>
          </label>

          <label className={styles.selectRow}>
            <input
              type="checkbox"
              checked={settings.massageLabPixelBlastTransparent}
              onChange={(event) => onSettingsChange({ massageLabPixelBlastTransparent: event.target.checked })}
              aria-label="MassageLab Pixel Blast transparent background"
            />
            <span>Transparent background</span>
          </label>

          <label className={styles.selectRow}>
            <input
              type="checkbox"
              checked={settings.massageLabPixelBlastAutoPauseOffscreen}
              onChange={(event) => onSettingsChange({ massageLabPixelBlastAutoPauseOffscreen: event.target.checked })}
              aria-label="MassageLab Pixel Blast pause offscreen"
            />
            <span>Pause offscreen</span>
          </label>

          <label className={styles.rangeRow}>
            <span>Pixel size ({settings.massageLabPixelBlastPixelSize.toFixed(0)})</span>
            <input
              type="range"
              min="1"
              max="16"
              step="1"
              value={settings.massageLabPixelBlastPixelSize}
              onChange={(event) => onSettingsChange({ massageLabPixelBlastPixelSize: Number(event.target.value) })}
              aria-label="MassageLab Pixel Blast pixel size"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Pattern scale ({settings.massageLabPixelBlastPatternScale.toFixed(2)})</span>
            <input
              type="range"
              min="0.25"
              max="8"
              step="0.05"
              value={settings.massageLabPixelBlastPatternScale}
              onChange={(event) => onSettingsChange({ massageLabPixelBlastPatternScale: Number(event.target.value) })}
              aria-label="MassageLab Pixel Blast pattern scale"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Density ({settings.massageLabPixelBlastPatternDensity.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.05"
              value={settings.massageLabPixelBlastPatternDensity}
              onChange={(event) => onSettingsChange({ massageLabPixelBlastPatternDensity: Number(event.target.value) })}
              aria-label="MassageLab Pixel Blast pattern density"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Speed ({settings.massageLabPixelBlastSpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={settings.massageLabPixelBlastSpeed}
              onChange={(event) => onSettingsChange({ massageLabPixelBlastSpeed: Number(event.target.value) })}
              aria-label="MassageLab Pixel Blast speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Pixel jitter ({settings.massageLabPixelBlastPixelSizeJitter.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.massageLabPixelBlastPixelSizeJitter}
              onChange={(event) => onSettingsChange({ massageLabPixelBlastPixelSizeJitter: Number(event.target.value) })}
              aria-label="MassageLab Pixel Blast pixel jitter"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Edge fade ({settings.massageLabPixelBlastEdgeFade.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.massageLabPixelBlastEdgeFade}
              onChange={(event) => onSettingsChange({ massageLabPixelBlastEdgeFade: Number(event.target.value) })}
              aria-label="MassageLab Pixel Blast edge fade"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Ripple intensity ({settings.massageLabPixelBlastRippleIntensityScale.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="4"
              step="0.05"
              value={settings.massageLabPixelBlastRippleIntensityScale}
              onChange={(event) => onSettingsChange({
                massageLabPixelBlastRippleIntensityScale: Number(event.target.value),
              })}
              aria-label="MassageLab Pixel Blast ripple intensity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Ripple thickness ({settings.massageLabPixelBlastRippleThickness.toFixed(2)})</span>
            <input
              type="range"
              min="0.01"
              max="0.5"
              step="0.01"
              value={settings.massageLabPixelBlastRippleThickness}
              onChange={(event) => onSettingsChange({ massageLabPixelBlastRippleThickness: Number(event.target.value) })}
              aria-label="MassageLab Pixel Blast ripple thickness"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Ripple speed ({settings.massageLabPixelBlastRippleSpeed.toFixed(2)})</span>
            <input
              type="range"
              min="0.05"
              max="2"
              step="0.05"
              value={settings.massageLabPixelBlastRippleSpeed}
              onChange={(event) => onSettingsChange({ massageLabPixelBlastRippleSpeed: Number(event.target.value) })}
              aria-label="MassageLab Pixel Blast ripple speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Liquid strength ({settings.massageLabPixelBlastLiquidStrength.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="0.4"
              step="0.01"
              value={settings.massageLabPixelBlastLiquidStrength}
              onChange={(event) => onSettingsChange({ massageLabPixelBlastLiquidStrength: Number(event.target.value) })}
              aria-label="MassageLab Pixel Blast liquid strength"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Liquid radius ({settings.massageLabPixelBlastLiquidRadius.toFixed(1)})</span>
            <input
              type="range"
              min="0.1"
              max="4"
              step="0.1"
              value={settings.massageLabPixelBlastLiquidRadius}
              onChange={(event) => onSettingsChange({ massageLabPixelBlastLiquidRadius: Number(event.target.value) })}
              aria-label="MassageLab Pixel Blast liquid radius"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Liquid wobble ({settings.massageLabPixelBlastLiquidWobbleSpeed.toFixed(1)})</span>
            <input
              type="range"
              min="0"
              max="10"
              step="0.1"
              value={settings.massageLabPixelBlastLiquidWobbleSpeed}
              onChange={(event) => onSettingsChange({
                massageLabPixelBlastLiquidWobbleSpeed: Number(event.target.value),
              })}
              aria-label="MassageLab Pixel Blast liquid wobble speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Noise ({settings.massageLabPixelBlastNoiseAmount.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="0.4"
              step="0.01"
              value={settings.massageLabPixelBlastNoiseAmount}
              onChange={(event) => onSettingsChange({ massageLabPixelBlastNoiseAmount: Number(event.target.value) })}
              aria-label="MassageLab Pixel Blast noise amount"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-color-bends") {
      const useCustomBendColors = settings.massageLabColorBendsPaletteMode === "custom"
      const useHarmonyBendColors = settings.massageLabColorBendsPaletteMode === "harmony"

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.massageLabColorBendsPaletteMode}
              onChange={(event) => onSettingsChange({
                massageLabColorBendsPaletteMode: event.target.value as MassageLabColorBendsPaletteMode,
              })}
              aria-label="MassageLab Color Bends color mode"
            >
              <option value="source">Source RGB bands</option>
              <option value="custom">Custom bends</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {useCustomBendColors && (
            <>
              {[
                ["Color 1", "massageLabColorBendsColorOne"],
                ["Color 2", "massageLabColorBendsColorTwo"],
                ["Color 3", "massageLabColorBendsColorThree"],
                ["Color 4", "massageLabColorBendsColorFour"],
              ].map(([label, key]) => (
                <label key={key} className={styles.colorRow}>
                  <span>{label}</span>
                  <input
                    type="color"
                    value={settings[key as keyof ChimerSettings] as string}
                    onChange={(event) => onSettingsChange({ [key]: event.target.value })}
                    aria-label={`MassageLab Color Bends ${label.toLowerCase()}`}
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
                  value={settings.massageLabColorBendsPrimaryColor}
                  onChange={(event) => onSettingsChange({ massageLabColorBendsPrimaryColor: event.target.value })}
                  aria-label="MassageLab Color Bends primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={settings.massageLabColorBendsHarmony}
                  onChange={(event) => onSettingsChange({
                    massageLabColorBendsHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="MassageLab Color Bends color harmony"
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
              checked={settings.massageLabColorBendsTransparent}
              onChange={(event) => onSettingsChange({ massageLabColorBendsTransparent: event.target.checked })}
              aria-label="MassageLab Color Bends transparent background"
            />
            <span>Transparent background</span>
          </label>

          <label className={styles.selectRow}>
            <input
              type="checkbox"
              checked={settings.massageLabColorBendsInteractive}
              onChange={(event) => onSettingsChange({ massageLabColorBendsInteractive: event.target.checked })}
              aria-label="MassageLab Color Bends pointer interaction"
            />
            <span>Pointer interaction</span>
          </label>

          <label className={styles.rangeRow}>
            <span>Rotation ({settings.massageLabColorBendsRotation.toFixed(0)}deg)</span>
            <input
              type="range"
              min="-360"
              max="360"
              step="1"
              value={settings.massageLabColorBendsRotation}
              onChange={(event) => onSettingsChange({ massageLabColorBendsRotation: Number(event.target.value) })}
              aria-label="MassageLab Color Bends rotation"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Speed ({settings.massageLabColorBendsSpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={settings.massageLabColorBendsSpeed}
              onChange={(event) => onSettingsChange({ massageLabColorBendsSpeed: Number(event.target.value) })}
              aria-label="MassageLab Color Bends speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Auto rotate ({settings.massageLabColorBendsAutoRotate.toFixed(0)}deg/s)</span>
            <input
              type="range"
              min="-180"
              max="180"
              step="1"
              value={settings.massageLabColorBendsAutoRotate}
              onChange={(event) => onSettingsChange({ massageLabColorBendsAutoRotate: Number(event.target.value) })}
              aria-label="MassageLab Color Bends auto rotate"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Scale ({settings.massageLabColorBendsScale.toFixed(2)})</span>
            <input
              type="range"
              min="0.1"
              max="4"
              step="0.05"
              value={settings.massageLabColorBendsScale}
              onChange={(event) => onSettingsChange({ massageLabColorBendsScale: Number(event.target.value) })}
              aria-label="MassageLab Color Bends scale"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Frequency ({settings.massageLabColorBendsFrequency.toFixed(2)})</span>
            <input
              type="range"
              min="0.1"
              max="4"
              step="0.05"
              value={settings.massageLabColorBendsFrequency}
              onChange={(event) => onSettingsChange({ massageLabColorBendsFrequency: Number(event.target.value) })}
              aria-label="MassageLab Color Bends frequency"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Warp ({settings.massageLabColorBendsWarpStrength.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={settings.massageLabColorBendsWarpStrength}
              onChange={(event) => onSettingsChange({ massageLabColorBendsWarpStrength: Number(event.target.value) })}
              aria-label="MassageLab Color Bends warp strength"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Mouse influence ({settings.massageLabColorBendsMouseInfluence.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={settings.massageLabColorBendsMouseInfluence}
              onChange={(event) => onSettingsChange({ massageLabColorBendsMouseInfluence: Number(event.target.value) })}
              aria-label="MassageLab Color Bends mouse influence"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Parallax ({settings.massageLabColorBendsParallax.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.05"
              value={settings.massageLabColorBendsParallax}
              onChange={(event) => onSettingsChange({ massageLabColorBendsParallax: Number(event.target.value) })}
              aria-label="MassageLab Color Bends parallax"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Noise ({settings.massageLabColorBendsNoise.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.massageLabColorBendsNoise}
              onChange={(event) => onSettingsChange({ massageLabColorBendsNoise: Number(event.target.value) })}
              aria-label="MassageLab Color Bends noise"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Iterations ({settings.massageLabColorBendsIterations.toFixed(0)})</span>
            <input
              type="range"
              min="1"
              max="5"
              step="1"
              value={settings.massageLabColorBendsIterations}
              onChange={(event) => onSettingsChange({ massageLabColorBendsIterations: Number(event.target.value) })}
              aria-label="MassageLab Color Bends iterations"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Intensity ({settings.massageLabColorBendsIntensity.toFixed(2)})</span>
            <input
              type="range"
              min="0.1"
              max="4"
              step="0.05"
              value={settings.massageLabColorBendsIntensity}
              onChange={(event) => onSettingsChange({ massageLabColorBendsIntensity: Number(event.target.value) })}
              aria-label="MassageLab Color Bends intensity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Band width ({settings.massageLabColorBendsBandWidth.toFixed(1)})</span>
            <input
              type="range"
              min="0.5"
              max="16"
              step="0.1"
              value={settings.massageLabColorBendsBandWidth}
              onChange={(event) => onSettingsChange({ massageLabColorBendsBandWidth: Number(event.target.value) })}
              aria-label="MassageLab Color Bends band width"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-evil-eye") {
      const useCustomEyeColor = settings.massageLabEvilEyePaletteMode === "custom"
      const useHarmonyEyeColor = settings.massageLabEvilEyePaletteMode === "harmony"

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.massageLabEvilEyePaletteMode}
              onChange={(event) => onSettingsChange({
                massageLabEvilEyePaletteMode: event.target.value as MassageLabEvilEyePaletteMode,
              })}
              aria-label="MassageLab Evil Eye color mode"
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
                value={settings.massageLabEvilEyeColor}
                onChange={(event) => onSettingsChange({ massageLabEvilEyeColor: event.target.value })}
                aria-label="MassageLab Evil Eye eye color"
              />
            </label>
          )}

          {useHarmonyEyeColor && (
            <>
              <label className={styles.colorRow}>
                <span>Primary color</span>
                <input
                  type="color"
                  value={settings.massageLabEvilEyePrimaryColor}
                  onChange={(event) => onSettingsChange({ massageLabEvilEyePrimaryColor: event.target.value })}
                  aria-label="MassageLab Evil Eye primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={settings.massageLabEvilEyeHarmony}
                  onChange={(event) => onSettingsChange({
                    massageLabEvilEyeHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="MassageLab Evil Eye color harmony"
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
              value={settings.massageLabEvilEyeBackgroundColor}
              onChange={(event) => onSettingsChange({ massageLabEvilEyeBackgroundColor: event.target.value })}
              aria-label="MassageLab Evil Eye background color"
            />
          </label>

          <label className={styles.selectRow}>
            <input
              type="checkbox"
              checked={settings.massageLabEvilEyeInteractive}
              onChange={(event) => onSettingsChange({ massageLabEvilEyeInteractive: event.target.checked })}
              aria-label="MassageLab Evil Eye pointer interaction"
            />
            <span>Pointer pupil follow</span>
          </label>

          <label className={styles.rangeRow}>
            <span>Intensity ({settings.massageLabEvilEyeIntensity.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={settings.massageLabEvilEyeIntensity}
              onChange={(event) => onSettingsChange({ massageLabEvilEyeIntensity: Number(event.target.value) })}
              aria-label="MassageLab Evil Eye intensity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Pupil size ({settings.massageLabEvilEyePupilSize.toFixed(2)})</span>
            <input
              type="range"
              min="0.1"
              max="2"
              step="0.05"
              value={settings.massageLabEvilEyePupilSize}
              onChange={(event) => onSettingsChange({ massageLabEvilEyePupilSize: Number(event.target.value) })}
              aria-label="MassageLab Evil Eye pupil size"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Iris width ({settings.massageLabEvilEyeIrisWidth.toFixed(2)})</span>
            <input
              type="range"
              min="0.05"
              max="1"
              step="0.01"
              value={settings.massageLabEvilEyeIrisWidth}
              onChange={(event) => onSettingsChange({ massageLabEvilEyeIrisWidth: Number(event.target.value) })}
              aria-label="MassageLab Evil Eye iris width"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Glow ({settings.massageLabEvilEyeGlowIntensity.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1.5"
              step="0.05"
              value={settings.massageLabEvilEyeGlowIntensity}
              onChange={(event) => onSettingsChange({ massageLabEvilEyeGlowIntensity: Number(event.target.value) })}
              aria-label="MassageLab Evil Eye glow intensity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Scale ({settings.massageLabEvilEyeScale.toFixed(2)})</span>
            <input
              type="range"
              min="0.25"
              max="2"
              step="0.05"
              value={settings.massageLabEvilEyeScale}
              onChange={(event) => onSettingsChange({ massageLabEvilEyeScale: Number(event.target.value) })}
              aria-label="MassageLab Evil Eye scale"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Noise scale ({settings.massageLabEvilEyeNoiseScale.toFixed(2)})</span>
            <input
              type="range"
              min="0.1"
              max="4"
              step="0.05"
              value={settings.massageLabEvilEyeNoiseScale}
              onChange={(event) => onSettingsChange({ massageLabEvilEyeNoiseScale: Number(event.target.value) })}
              aria-label="MassageLab Evil Eye noise scale"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Pupil follow ({settings.massageLabEvilEyePupilFollow.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.05"
              value={settings.massageLabEvilEyePupilFollow}
              onChange={(event) => onSettingsChange({ massageLabEvilEyePupilFollow: Number(event.target.value) })}
              aria-label="MassageLab Evil Eye pupil follow"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Flame speed ({settings.massageLabEvilEyeFlameSpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={settings.massageLabEvilEyeFlameSpeed}
              onChange={(event) => onSettingsChange({ massageLabEvilEyeFlameSpeed: Number(event.target.value) })}
              aria-label="MassageLab Evil Eye flame speed"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-line-waves") {
      const useCustomColors = settings.massageLabLineWavesPaletteMode === "custom"
      const useHarmonyColors = settings.massageLabLineWavesPaletteMode === "harmony"

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.massageLabLineWavesPaletteMode}
              onChange={(event) => onSettingsChange({
                massageLabLineWavesPaletteMode: event.target.value as MassageLabLineWavesPaletteMode,
              })}
              aria-label="MassageLab Line Waves color mode"
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
                  value={settings.massageLabLineWavesColorOne}
                  onChange={(event) => onSettingsChange({ massageLabLineWavesColorOne: event.target.value })}
                  aria-label="MassageLab Line Waves color 1"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Color 2</span>
                <input
                  type="color"
                  value={settings.massageLabLineWavesColorTwo}
                  onChange={(event) => onSettingsChange({ massageLabLineWavesColorTwo: event.target.value })}
                  aria-label="MassageLab Line Waves color 2"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Color 3</span>
                <input
                  type="color"
                  value={settings.massageLabLineWavesColorThree}
                  onChange={(event) => onSettingsChange({ massageLabLineWavesColorThree: event.target.value })}
                  aria-label="MassageLab Line Waves color 3"
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
                  value={settings.massageLabLineWavesPrimaryColor}
                  onChange={(event) => onSettingsChange({ massageLabLineWavesPrimaryColor: event.target.value })}
                  aria-label="MassageLab Line Waves primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={settings.massageLabLineWavesHarmony}
                  onChange={(event) => onSettingsChange({
                    massageLabLineWavesHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="MassageLab Line Waves color harmony"
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
              checked={settings.massageLabLineWavesEnableMouseInteraction}
              onChange={(event) => onSettingsChange({
                massageLabLineWavesEnableMouseInteraction: event.target.checked,
              })}
              aria-label="MassageLab Line Waves mouse warp"
            />
            <span>Pointer warp</span>
          </label>

          <label className={styles.rangeRow}>
            <span>Speed ({settings.massageLabLineWavesSpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={settings.massageLabLineWavesSpeed}
              onChange={(event) => onSettingsChange({ massageLabLineWavesSpeed: Number(event.target.value) })}
              aria-label="MassageLab Line Waves speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Inner lines ({settings.massageLabLineWavesInnerLineCount.toFixed(0)})</span>
            <input
              type="range"
              min="1"
              max="96"
              step="1"
              value={settings.massageLabLineWavesInnerLineCount}
              onChange={(event) => onSettingsChange({ massageLabLineWavesInnerLineCount: Number(event.target.value) })}
              aria-label="MassageLab Line Waves inner line count"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Outer lines ({settings.massageLabLineWavesOuterLineCount.toFixed(0)})</span>
            <input
              type="range"
              min="1"
              max="96"
              step="1"
              value={settings.massageLabLineWavesOuterLineCount}
              onChange={(event) => onSettingsChange({ massageLabLineWavesOuterLineCount: Number(event.target.value) })}
              aria-label="MassageLab Line Waves outer line count"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Warp ({settings.massageLabLineWavesWarpIntensity.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={settings.massageLabLineWavesWarpIntensity}
              onChange={(event) => onSettingsChange({ massageLabLineWavesWarpIntensity: Number(event.target.value) })}
              aria-label="MassageLab Line Waves warp intensity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Rotation ({settings.massageLabLineWavesRotation.toFixed(0)}deg)</span>
            <input
              type="range"
              min="-180"
              max="180"
              step="1"
              value={settings.massageLabLineWavesRotation}
              onChange={(event) => onSettingsChange({ massageLabLineWavesRotation: Number(event.target.value) })}
              aria-label="MassageLab Line Waves rotation"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Edge fade ({settings.massageLabLineWavesEdgeFadeWidth.toFixed(2)})</span>
            <input
              type="range"
              min="-1"
              max="1"
              step="0.05"
              value={settings.massageLabLineWavesEdgeFadeWidth}
              onChange={(event) => onSettingsChange({ massageLabLineWavesEdgeFadeWidth: Number(event.target.value) })}
              aria-label="MassageLab Line Waves edge fade width"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Color cycle ({settings.massageLabLineWavesColorCycleSpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0"
              max="4"
              step="0.05"
              value={settings.massageLabLineWavesColorCycleSpeed}
              onChange={(event) => onSettingsChange({ massageLabLineWavesColorCycleSpeed: Number(event.target.value) })}
              aria-label="MassageLab Line Waves color cycle speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Brightness ({settings.massageLabLineWavesBrightness.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1.5"
              step="0.05"
              value={settings.massageLabLineWavesBrightness}
              onChange={(event) => onSettingsChange({ massageLabLineWavesBrightness: Number(event.target.value) })}
              aria-label="MassageLab Line Waves brightness"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Mouse influence ({settings.massageLabLineWavesMouseInfluence.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="4"
              step="0.05"
              value={settings.massageLabLineWavesMouseInfluence}
              onChange={(event) => onSettingsChange({ massageLabLineWavesMouseInfluence: Number(event.target.value) })}
              aria-label="MassageLab Line Waves mouse influence"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-radar") {
      const useCustomColor = settings.massageLabRadarPaletteMode === "custom"
      const useHarmonyColor = settings.massageLabRadarPaletteMode === "harmony"

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.massageLabRadarPaletteMode}
              onChange={(event) => onSettingsChange({
                massageLabRadarPaletteMode: event.target.value as MassageLabRadarPaletteMode,
              })}
              aria-label="MassageLab Radar color mode"
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
                value={settings.massageLabRadarColor}
                onChange={(event) => onSettingsChange({ massageLabRadarColor: event.target.value })}
                aria-label="MassageLab Radar color"
              />
            </label>
          )}

          {useHarmonyColor && (
            <>
              <label className={styles.colorRow}>
                <span>Primary color</span>
                <input
                  type="color"
                  value={settings.massageLabRadarPrimaryColor}
                  onChange={(event) => onSettingsChange({ massageLabRadarPrimaryColor: event.target.value })}
                  aria-label="MassageLab Radar primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={settings.massageLabRadarHarmony}
                  onChange={(event) => onSettingsChange({
                    massageLabRadarHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="MassageLab Radar color harmony"
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
              value={settings.massageLabRadarBackgroundColor}
              onChange={(event) => onSettingsChange({ massageLabRadarBackgroundColor: event.target.value })}
              aria-label="MassageLab Radar background color"
            />
          </label>

          <label className={styles.selectRow}>
            <input
              type="checkbox"
              checked={settings.massageLabRadarEnableMouseInteraction}
              onChange={(event) => onSettingsChange({
                massageLabRadarEnableMouseInteraction: event.target.checked,
              })}
              aria-label="MassageLab Radar pointer offset"
            />
            <span>Pointer offset</span>
          </label>

          <label className={styles.rangeRow}>
            <span>Speed ({settings.massageLabRadarSpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={settings.massageLabRadarSpeed}
              onChange={(event) => onSettingsChange({ massageLabRadarSpeed: Number(event.target.value) })}
              aria-label="MassageLab Radar speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Scale ({settings.massageLabRadarScale.toFixed(2)})</span>
            <input
              type="range"
              min="0.1"
              max="2"
              step="0.05"
              value={settings.massageLabRadarScale}
              onChange={(event) => onSettingsChange({ massageLabRadarScale: Number(event.target.value) })}
              aria-label="MassageLab Radar scale"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Rings ({settings.massageLabRadarRingCount.toFixed(0)})</span>
            <input
              type="range"
              min="1"
              max="40"
              step="1"
              value={settings.massageLabRadarRingCount}
              onChange={(event) => onSettingsChange({ massageLabRadarRingCount: Number(event.target.value) })}
              aria-label="MassageLab Radar ring count"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Spokes ({settings.massageLabRadarSpokeCount.toFixed(0)})</span>
            <input
              type="range"
              min="1"
              max="40"
              step="1"
              value={settings.massageLabRadarSpokeCount}
              onChange={(event) => onSettingsChange({ massageLabRadarSpokeCount: Number(event.target.value) })}
              aria-label="MassageLab Radar spoke count"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Ring thickness ({settings.massageLabRadarRingThickness.toFixed(3)})</span>
            <input
              type="range"
              min="0.001"
              max="0.25"
              step="0.001"
              value={settings.massageLabRadarRingThickness}
              onChange={(event) => onSettingsChange({ massageLabRadarRingThickness: Number(event.target.value) })}
              aria-label="MassageLab Radar ring thickness"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Spoke thickness ({settings.massageLabRadarSpokeThickness.toFixed(3)})</span>
            <input
              type="range"
              min="0.001"
              max="0.1"
              step="0.001"
              value={settings.massageLabRadarSpokeThickness}
              onChange={(event) => onSettingsChange({ massageLabRadarSpokeThickness: Number(event.target.value) })}
              aria-label="MassageLab Radar spoke thickness"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Sweep speed ({settings.massageLabRadarSweepSpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0"
              max="4"
              step="0.05"
              value={settings.massageLabRadarSweepSpeed}
              onChange={(event) => onSettingsChange({ massageLabRadarSweepSpeed: Number(event.target.value) })}
              aria-label="MassageLab Radar sweep speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Sweep width ({settings.massageLabRadarSweepWidth.toFixed(2)})</span>
            <input
              type="range"
              min="0.1"
              max="12"
              step="0.1"
              value={settings.massageLabRadarSweepWidth}
              onChange={(event) => onSettingsChange({ massageLabRadarSweepWidth: Number(event.target.value) })}
              aria-label="MassageLab Radar sweep width"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Sweep lobes ({settings.massageLabRadarSweepLobes.toFixed(0)})</span>
            <input
              type="range"
              min="1"
              max="12"
              step="1"
              value={settings.massageLabRadarSweepLobes}
              onChange={(event) => onSettingsChange({ massageLabRadarSweepLobes: Number(event.target.value) })}
              aria-label="MassageLab Radar sweep lobes"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Falloff ({settings.massageLabRadarFalloff.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="8"
              step="0.1"
              value={settings.massageLabRadarFalloff}
              onChange={(event) => onSettingsChange({ massageLabRadarFalloff: Number(event.target.value) })}
              aria-label="MassageLab Radar falloff"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Brightness ({settings.massageLabRadarBrightness.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={settings.massageLabRadarBrightness}
              onChange={(event) => onSettingsChange({ massageLabRadarBrightness: Number(event.target.value) })}
              aria-label="MassageLab Radar brightness"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Mouse influence ({settings.massageLabRadarMouseInfluence.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.massageLabRadarMouseInfluence}
              onChange={(event) => onSettingsChange({ massageLabRadarMouseInfluence: Number(event.target.value) })}
              aria-label="MassageLab Radar mouse influence"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-soft-aurora") {
      const useCustomColor = settings.massageLabSoftAuroraPaletteMode === "custom"
      const useHarmonyColor = settings.massageLabSoftAuroraPaletteMode === "harmony"

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.massageLabSoftAuroraPaletteMode}
              onChange={(event) => onSettingsChange({
                massageLabSoftAuroraPaletteMode: event.target.value as MassageLabSoftAuroraPaletteMode,
              })}
              aria-label="MassageLab Soft Aurora color mode"
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
                  value={settings.massageLabSoftAuroraColorOne}
                  onChange={(event) => onSettingsChange({ massageLabSoftAuroraColorOne: event.target.value })}
                  aria-label="MassageLab Soft Aurora color 1"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Aurora color 2</span>
                <input
                  type="color"
                  value={settings.massageLabSoftAuroraColorTwo}
                  onChange={(event) => onSettingsChange({ massageLabSoftAuroraColorTwo: event.target.value })}
                  aria-label="MassageLab Soft Aurora color 2"
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
                  value={settings.massageLabSoftAuroraPrimaryColor}
                  onChange={(event) => onSettingsChange({ massageLabSoftAuroraPrimaryColor: event.target.value })}
                  aria-label="MassageLab Soft Aurora primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={settings.massageLabSoftAuroraHarmony}
                  onChange={(event) => onSettingsChange({
                    massageLabSoftAuroraHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="MassageLab Soft Aurora color harmony"
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
              checked={settings.massageLabSoftAuroraEnableMouseInteraction}
              onChange={(event) => onSettingsChange({
                massageLabSoftAuroraEnableMouseInteraction: event.target.checked,
              })}
              aria-label="MassageLab Soft Aurora mouse shift"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Speed ({settings.massageLabSoftAuroraSpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={settings.massageLabSoftAuroraSpeed}
              onChange={(event) => onSettingsChange({ massageLabSoftAuroraSpeed: Number(event.target.value) })}
              aria-label="MassageLab Soft Aurora speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Scale ({settings.massageLabSoftAuroraScale.toFixed(2)})</span>
            <input
              type="range"
              min="0.1"
              max="4"
              step="0.05"
              value={settings.massageLabSoftAuroraScale}
              onChange={(event) => onSettingsChange({ massageLabSoftAuroraScale: Number(event.target.value) })}
              aria-label="MassageLab Soft Aurora scale"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Brightness ({settings.massageLabSoftAuroraBrightness.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={settings.massageLabSoftAuroraBrightness}
              onChange={(event) => onSettingsChange({ massageLabSoftAuroraBrightness: Number(event.target.value) })}
              aria-label="MassageLab Soft Aurora brightness"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Noise frequency ({settings.massageLabSoftAuroraNoiseFrequency.toFixed(2)})</span>
            <input
              type="range"
              min="0.1"
              max="8"
              step="0.05"
              value={settings.massageLabSoftAuroraNoiseFrequency}
              onChange={(event) => onSettingsChange({
                massageLabSoftAuroraNoiseFrequency: Number(event.target.value),
              })}
              aria-label="MassageLab Soft Aurora noise frequency"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Noise amplitude ({settings.massageLabSoftAuroraNoiseAmplitude.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="4"
              step="0.05"
              value={settings.massageLabSoftAuroraNoiseAmplitude}
              onChange={(event) => onSettingsChange({
                massageLabSoftAuroraNoiseAmplitude: Number(event.target.value),
              })}
              aria-label="MassageLab Soft Aurora noise amplitude"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Band height ({settings.massageLabSoftAuroraBandHeight.toFixed(2)})</span>
            <input
              type="range"
              min="-1"
              max="2"
              step="0.05"
              value={settings.massageLabSoftAuroraBandHeight}
              onChange={(event) => onSettingsChange({ massageLabSoftAuroraBandHeight: Number(event.target.value) })}
              aria-label="MassageLab Soft Aurora band height"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Band spread ({settings.massageLabSoftAuroraBandSpread.toFixed(2)})</span>
            <input
              type="range"
              min="0.1"
              max="4"
              step="0.05"
              value={settings.massageLabSoftAuroraBandSpread}
              onChange={(event) => onSettingsChange({ massageLabSoftAuroraBandSpread: Number(event.target.value) })}
              aria-label="MassageLab Soft Aurora band spread"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Octave decay ({settings.massageLabSoftAuroraOctaveDecay.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.massageLabSoftAuroraOctaveDecay}
              onChange={(event) => onSettingsChange({ massageLabSoftAuroraOctaveDecay: Number(event.target.value) })}
              aria-label="MassageLab Soft Aurora octave decay"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Layer offset ({settings.massageLabSoftAuroraLayerOffset.toFixed(2)})</span>
            <input
              type="range"
              min="-6"
              max="6"
              step="0.05"
              value={settings.massageLabSoftAuroraLayerOffset}
              onChange={(event) => onSettingsChange({ massageLabSoftAuroraLayerOffset: Number(event.target.value) })}
              aria-label="MassageLab Soft Aurora layer offset"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Color speed ({settings.massageLabSoftAuroraColorSpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0"
              max="4"
              step="0.05"
              value={settings.massageLabSoftAuroraColorSpeed}
              onChange={(event) => onSettingsChange({ massageLabSoftAuroraColorSpeed: Number(event.target.value) })}
              aria-label="MassageLab Soft Aurora color speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Mouse influence ({settings.massageLabSoftAuroraMouseInfluence.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.massageLabSoftAuroraMouseInfluence}
              onChange={(event) => onSettingsChange({
                massageLabSoftAuroraMouseInfluence: Number(event.target.value),
              })}
              aria-label="MassageLab Soft Aurora mouse influence"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-plasma") {
      const useCustomColor = settings.massageLabPlasmaPaletteMode === "custom"
      const useHarmonyColor = settings.massageLabPlasmaPaletteMode === "harmony"

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.massageLabPlasmaPaletteMode}
              onChange={(event) => onSettingsChange({
                massageLabPlasmaPaletteMode: event.target.value as MassageLabPlasmaPaletteMode,
              })}
              aria-label="MassageLab Plasma color mode"
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
                value={settings.massageLabPlasmaColor}
                onChange={(event) => onSettingsChange({ massageLabPlasmaColor: event.target.value })}
                aria-label="MassageLab Plasma color"
              />
            </label>
          ) : null}

          {useHarmonyColor ? (
            <>
              <label className={styles.colorRow}>
                <span>Primary color</span>
                <input
                  type="color"
                  value={settings.massageLabPlasmaPrimaryColor}
                  onChange={(event) => onSettingsChange({ massageLabPlasmaPrimaryColor: event.target.value })}
                  aria-label="MassageLab Plasma primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={settings.massageLabPlasmaHarmony}
                  onChange={(event) => onSettingsChange({
                    massageLabPlasmaHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="MassageLab Plasma color harmony"
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
              value={settings.massageLabPlasmaDirection}
              onChange={(event) => onSettingsChange({
                massageLabPlasmaDirection: event.target.value as MassageLabPlasmaDirection,
              })}
              aria-label="MassageLab Plasma direction"
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
              checked={settings.massageLabPlasmaMouseInteractive}
              onChange={(event) => onSettingsChange({ massageLabPlasmaMouseInteractive: event.target.checked })}
              aria-label="MassageLab Plasma mouse warp"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Speed ({settings.massageLabPlasmaSpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={settings.massageLabPlasmaSpeed}
              onChange={(event) => onSettingsChange({ massageLabPlasmaSpeed: Number(event.target.value) })}
              aria-label="MassageLab Plasma speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Scale ({settings.massageLabPlasmaScale.toFixed(2)})</span>
            <input
              type="range"
              min="0.2"
              max="4"
              step="0.05"
              value={settings.massageLabPlasmaScale}
              onChange={(event) => onSettingsChange({ massageLabPlasmaScale: Number(event.target.value) })}
              aria-label="MassageLab Plasma scale"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Opacity ({Math.round(settings.massageLabPlasmaOpacity * 100)}%)</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.massageLabPlasmaOpacity}
              onChange={(event) => onSettingsChange({ massageLabPlasmaOpacity: Number(event.target.value) })}
              aria-label="MassageLab Plasma opacity"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-plasma-wave") {
      const useCustomColor = settings.massageLabPlasmaWavePaletteMode === "custom"
      const useHarmonyColor = settings.massageLabPlasmaWavePaletteMode === "harmony"

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.massageLabPlasmaWavePaletteMode}
              onChange={(event) => onSettingsChange({
                massageLabPlasmaWavePaletteMode: event.target.value as MassageLabPlasmaWavePaletteMode,
              })}
              aria-label="MassageLab Plasma Wave color mode"
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
                  value={settings.massageLabPlasmaWaveColorOne}
                  onChange={(event) => onSettingsChange({ massageLabPlasmaWaveColorOne: event.target.value })}
                  aria-label="MassageLab Plasma Wave color 1"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Wave color 2</span>
                <input
                  type="color"
                  value={settings.massageLabPlasmaWaveColorTwo}
                  onChange={(event) => onSettingsChange({ massageLabPlasmaWaveColorTwo: event.target.value })}
                  aria-label="MassageLab Plasma Wave color 2"
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
                  value={settings.massageLabPlasmaWavePrimaryColor}
                  onChange={(event) => onSettingsChange({ massageLabPlasmaWavePrimaryColor: event.target.value })}
                  aria-label="MassageLab Plasma Wave primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={settings.massageLabPlasmaWaveHarmony}
                  onChange={(event) => onSettingsChange({
                    massageLabPlasmaWaveHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="MassageLab Plasma Wave color harmony"
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
              value={settings.massageLabPlasmaWaveDirectionTwo}
              onChange={(event) => onSettingsChange({
                massageLabPlasmaWaveDirectionTwo: Number(event.target.value) as 1 | -1,
              })}
              aria-label="MassageLab Plasma Wave secondary direction"
            >
              <option value={1}>Forward</option>
              <option value={-1}>Reverse</option>
            </select>
          </label>

          <label className={styles.rangeRow}>
            <span>Rotation ({settings.massageLabPlasmaWaveRotationDeg.toFixed(0)}deg)</span>
            <input
              type="range"
              min="-180"
              max="180"
              step="1"
              value={settings.massageLabPlasmaWaveRotationDeg}
              onChange={(event) => onSettingsChange({ massageLabPlasmaWaveRotationDeg: Number(event.target.value) })}
              aria-label="MassageLab Plasma Wave rotation"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Focal length ({settings.massageLabPlasmaWaveFocalLength.toFixed(2)})</span>
            <input
              type="range"
              min="0.2"
              max="2"
              step="0.05"
              value={settings.massageLabPlasmaWaveFocalLength}
              onChange={(event) => onSettingsChange({ massageLabPlasmaWaveFocalLength: Number(event.target.value) })}
              aria-label="MassageLab Plasma Wave focal length"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Wave 1 speed ({settings.massageLabPlasmaWaveSpeedOne.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="0.5"
              step="0.01"
              value={settings.massageLabPlasmaWaveSpeedOne}
              onChange={(event) => onSettingsChange({ massageLabPlasmaWaveSpeedOne: Number(event.target.value) })}
              aria-label="MassageLab Plasma Wave speed 1"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Wave 2 speed ({settings.massageLabPlasmaWaveSpeedTwo.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="0.5"
              step="0.01"
              value={settings.massageLabPlasmaWaveSpeedTwo}
              onChange={(event) => onSettingsChange({ massageLabPlasmaWaveSpeedTwo: Number(event.target.value) })}
              aria-label="MassageLab Plasma Wave speed 2"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Wave 1 bend ({settings.massageLabPlasmaWaveBendOne.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={settings.massageLabPlasmaWaveBendOne}
              onChange={(event) => onSettingsChange({ massageLabPlasmaWaveBendOne: Number(event.target.value) })}
              aria-label="MassageLab Plasma Wave bend 1"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Wave 2 bend ({settings.massageLabPlasmaWaveBendTwo.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={settings.massageLabPlasmaWaveBendTwo}
              onChange={(event) => onSettingsChange({ massageLabPlasmaWaveBendTwo: Number(event.target.value) })}
              aria-label="MassageLab Plasma Wave bend 2"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>X offset ({settings.massageLabPlasmaWaveXOffset.toFixed(0)}px)</span>
            <input
              type="range"
              min="-800"
              max="800"
              step="10"
              value={settings.massageLabPlasmaWaveXOffset}
              onChange={(event) => onSettingsChange({ massageLabPlasmaWaveXOffset: Number(event.target.value) })}
              aria-label="MassageLab Plasma Wave x offset"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Y offset ({settings.massageLabPlasmaWaveYOffset.toFixed(0)}px)</span>
            <input
              type="range"
              min="-800"
              max="800"
              step="10"
              value={settings.massageLabPlasmaWaveYOffset}
              onChange={(event) => onSettingsChange({ massageLabPlasmaWaveYOffset: Number(event.target.value) })}
              aria-label="MassageLab Plasma Wave y offset"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-particles") {
      const useCustomPalette = settings.massageLabParticlesPaletteMode === "custom"
      const useHarmonyPalette = settings.massageLabParticlesPaletteMode === "harmony"

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.massageLabParticlesPaletteMode}
              onChange={(event) => onSettingsChange({
                massageLabParticlesPaletteMode: event.target.value as MassageLabParticlesPaletteMode,
              })}
              aria-label="MassageLab Particles color mode"
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
                  value={settings.massageLabParticlesColorOne}
                  onChange={(event) => onSettingsChange({ massageLabParticlesColorOne: event.target.value })}
                  aria-label="MassageLab Particles color 1"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Particle color 2</span>
                <input
                  type="color"
                  value={settings.massageLabParticlesColorTwo}
                  onChange={(event) => onSettingsChange({ massageLabParticlesColorTwo: event.target.value })}
                  aria-label="MassageLab Particles color 2"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Particle color 3</span>
                <input
                  type="color"
                  value={settings.massageLabParticlesColorThree}
                  onChange={(event) => onSettingsChange({ massageLabParticlesColorThree: event.target.value })}
                  aria-label="MassageLab Particles color 3"
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
                  value={settings.massageLabParticlesPrimaryColor}
                  onChange={(event) => onSettingsChange({ massageLabParticlesPrimaryColor: event.target.value })}
                  aria-label="MassageLab Particles primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={settings.massageLabParticlesHarmony}
                  onChange={(event) => onSettingsChange({
                    massageLabParticlesHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="MassageLab Particles color harmony"
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
              checked={settings.massageLabParticlesMoveOnHover}
              onChange={(event) => onSettingsChange({ massageLabParticlesMoveOnHover: event.target.checked })}
            />
            <span>Move on cursor</span>
          </label>

          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={settings.massageLabParticlesAlpha}
              onChange={(event) => onSettingsChange({ massageLabParticlesAlpha: event.target.checked })}
            />
            <span>Soft alpha particles</span>
          </label>

          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={!settings.massageLabParticlesDisableRotation}
              onChange={(event) => onSettingsChange({ massageLabParticlesDisableRotation: !event.target.checked })}
            />
            <span>Rotate cloud</span>
          </label>

          <label className={styles.rangeRow}>
            <span>Particle count ({settings.massageLabParticlesCount.toFixed(0)})</span>
            <input
              type="range"
              min="20"
              max="1500"
              step="10"
              value={settings.massageLabParticlesCount}
              onChange={(event) => onSettingsChange({ massageLabParticlesCount: Number(event.target.value) })}
              aria-label="MassageLab Particles particle count"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Spread ({settings.massageLabParticlesSpread.toFixed(1)})</span>
            <input
              type="range"
              min="1"
              max="30"
              step="0.5"
              value={settings.massageLabParticlesSpread}
              onChange={(event) => onSettingsChange({ massageLabParticlesSpread: Number(event.target.value) })}
              aria-label="MassageLab Particles spread"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Speed ({settings.massageLabParticlesSpeed.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.massageLabParticlesSpeed}
              onChange={(event) => onSettingsChange({ massageLabParticlesSpeed: Number(event.target.value) })}
              aria-label="MassageLab Particles speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Hover push ({settings.massageLabParticlesHoverFactor.toFixed(1)})</span>
            <input
              type="range"
              min="0"
              max="5"
              step="0.1"
              value={settings.massageLabParticlesHoverFactor}
              onChange={(event) => onSettingsChange({ massageLabParticlesHoverFactor: Number(event.target.value) })}
              aria-label="MassageLab Particles hover push"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Base size ({settings.massageLabParticlesBaseSize.toFixed(0)})</span>
            <input
              type="range"
              min="10"
              max="300"
              step="5"
              value={settings.massageLabParticlesBaseSize}
              onChange={(event) => onSettingsChange({ massageLabParticlesBaseSize: Number(event.target.value) })}
              aria-label="MassageLab Particles base size"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Size randomness ({settings.massageLabParticlesSizeRandomness.toFixed(1)})</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.1"
              value={settings.massageLabParticlesSizeRandomness}
              onChange={(event) => onSettingsChange({ massageLabParticlesSizeRandomness: Number(event.target.value) })}
              aria-label="MassageLab Particles size randomness"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Camera distance ({settings.massageLabParticlesCameraDistance.toFixed(0)})</span>
            <input
              type="range"
              min="5"
              max="60"
              step="1"
              value={settings.massageLabParticlesCameraDistance}
              onChange={(event) => onSettingsChange({ massageLabParticlesCameraDistance: Number(event.target.value) })}
              aria-label="MassageLab Particles camera distance"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Pixel ratio ({settings.massageLabParticlesPixelRatio.toFixed(1)})</span>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={settings.massageLabParticlesPixelRatio}
              onChange={(event) => onSettingsChange({ massageLabParticlesPixelRatio: Number(event.target.value) })}
              aria-label="MassageLab Particles pixel ratio"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-gradient-blinds") {
      const useCustomGradient = settings.massageLabGradientBlindsPaletteMode === "custom"
      const useHarmonyGradient = settings.massageLabGradientBlindsPaletteMode === "harmony"

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.massageLabGradientBlindsPaletteMode}
              onChange={(event) => onSettingsChange({
                massageLabGradientBlindsPaletteMode: event.target.value as MassageLabGradientBlindsPaletteMode,
              })}
              aria-label="MassageLab Gradient Blinds color mode"
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
                  value={settings.massageLabGradientBlindsColorOne}
                  onChange={(event) => onSettingsChange({ massageLabGradientBlindsColorOne: event.target.value })}
                  aria-label="MassageLab Gradient Blinds color 1"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Gradient color 2</span>
                <input
                  type="color"
                  value={settings.massageLabGradientBlindsColorTwo}
                  onChange={(event) => onSettingsChange({ massageLabGradientBlindsColorTwo: event.target.value })}
                  aria-label="MassageLab Gradient Blinds color 2"
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
                  value={settings.massageLabGradientBlindsPrimaryColor}
                  onChange={(event) => onSettingsChange({ massageLabGradientBlindsPrimaryColor: event.target.value })}
                  aria-label="MassageLab Gradient Blinds primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={settings.massageLabGradientBlindsHarmony}
                  onChange={(event) => onSettingsChange({
                    massageLabGradientBlindsHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="MassageLab Gradient Blinds color harmony"
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
              checked={settings.massageLabGradientBlindsEnableMouseInteraction}
              onChange={(event) => onSettingsChange({
                massageLabGradientBlindsEnableMouseInteraction: event.target.checked,
              })}
            />
            <span>Cursor spotlight</span>
          </label>

          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={settings.massageLabGradientBlindsMirror}
              onChange={(event) => onSettingsChange({ massageLabGradientBlindsMirror: event.target.checked })}
            />
            <span>Mirror gradient</span>
          </label>

          <label className={styles.selectRow}>
            <span>Shine direction</span>
            <select
              value={settings.massageLabGradientBlindsShineDirection}
              onChange={(event) => onSettingsChange({
                massageLabGradientBlindsShineDirection: event.target.value as MassageLabGradientBlindsShineDirection,
              })}
              aria-label="MassageLab Gradient Blinds shine direction"
            >
              <option value="left">Left</option>
              <option value="right">Right</option>
            </select>
          </label>

          <label className={styles.selectRow}>
            <span>Blend mode</span>
            <select
              value={settings.massageLabGradientBlindsBlendMode}
              onChange={(event) => onSettingsChange({
                massageLabGradientBlindsBlendMode: event.target.value as MassageLabGradientBlindsBlendMode,
              })}
              aria-label="MassageLab Gradient Blinds blend mode"
            >
              <option value="lighten">Lighten</option>
              <option value="screen">Screen</option>
              <option value="plus-lighter">Plus lighter</option>
              <option value="normal">Normal</option>
            </select>
          </label>

          <label className={styles.rangeRow}>
            <span>Angle ({settings.massageLabGradientBlindsAngle.toFixed(0)}deg)</span>
            <input
              type="range"
              min="-180"
              max="180"
              step="1"
              value={settings.massageLabGradientBlindsAngle}
              onChange={(event) => onSettingsChange({ massageLabGradientBlindsAngle: Number(event.target.value) })}
              aria-label="MassageLab Gradient Blinds angle"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Noise ({settings.massageLabGradientBlindsNoise.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.massageLabGradientBlindsNoise}
              onChange={(event) => onSettingsChange({ massageLabGradientBlindsNoise: Number(event.target.value) })}
              aria-label="MassageLab Gradient Blinds noise"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Blind count ({settings.massageLabGradientBlindsBlindCount.toFixed(0)})</span>
            <input
              type="range"
              min="1"
              max="80"
              step="1"
              value={settings.massageLabGradientBlindsBlindCount}
              onChange={(event) => onSettingsChange({ massageLabGradientBlindsBlindCount: Number(event.target.value) })}
              aria-label="MassageLab Gradient Blinds blind count"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Min blind width ({settings.massageLabGradientBlindsBlindMinWidth.toFixed(0)}px)</span>
            <input
              type="range"
              min="0"
              max="240"
              step="5"
              value={settings.massageLabGradientBlindsBlindMinWidth}
              onChange={(event) => onSettingsChange({ massageLabGradientBlindsBlindMinWidth: Number(event.target.value) })}
              aria-label="MassageLab Gradient Blinds minimum blind width"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Mouse damping ({settings.massageLabGradientBlindsMouseDampening.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.massageLabGradientBlindsMouseDampening}
              onChange={(event) => onSettingsChange({ massageLabGradientBlindsMouseDampening: Number(event.target.value) })}
              aria-label="MassageLab Gradient Blinds mouse damping"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Spotlight radius ({settings.massageLabGradientBlindsSpotlightRadius.toFixed(2)})</span>
            <input
              type="range"
              min="0.05"
              max="1.5"
              step="0.05"
              value={settings.massageLabGradientBlindsSpotlightRadius}
              onChange={(event) => onSettingsChange({ massageLabGradientBlindsSpotlightRadius: Number(event.target.value) })}
              aria-label="MassageLab Gradient Blinds spotlight radius"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Spotlight softness ({settings.massageLabGradientBlindsSpotlightSoftness.toFixed(1)})</span>
            <input
              type="range"
              min="0.2"
              max="4"
              step="0.1"
              value={settings.massageLabGradientBlindsSpotlightSoftness}
              onChange={(event) => onSettingsChange({ massageLabGradientBlindsSpotlightSoftness: Number(event.target.value) })}
              aria-label="MassageLab Gradient Blinds spotlight softness"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Spotlight opacity ({settings.massageLabGradientBlindsSpotlightOpacity.toFixed(1)})</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={settings.massageLabGradientBlindsSpotlightOpacity}
              onChange={(event) => onSettingsChange({ massageLabGradientBlindsSpotlightOpacity: Number(event.target.value) })}
              aria-label="MassageLab Gradient Blinds spotlight opacity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Distortion ({settings.massageLabGradientBlindsDistort.toFixed(1)})</span>
            <input
              type="range"
              min="0"
              max="5"
              step="0.1"
              value={settings.massageLabGradientBlindsDistort}
              onChange={(event) => onSettingsChange({ massageLabGradientBlindsDistort: Number(event.target.value) })}
              aria-label="MassageLab Gradient Blinds distortion"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>DPR ({settings.massageLabGradientBlindsDpr.toFixed(1)})</span>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={settings.massageLabGradientBlindsDpr}
              onChange={(event) => onSettingsChange({ massageLabGradientBlindsDpr: Number(event.target.value) })}
              aria-label="MassageLab Gradient Blinds dpr"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-grainient") {
      const useCustomGrainient = settings.massageLabGrainientPaletteMode === "custom"
      const useHarmonyGrainient = settings.massageLabGrainientPaletteMode === "harmony"

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.massageLabGrainientPaletteMode}
              onChange={(event) => onSettingsChange({
                massageLabGrainientPaletteMode: event.target.value as MassageLabGrainientPaletteMode,
              })}
              aria-label="MassageLab Grainient color mode"
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
                  value={settings.massageLabGrainientColorOne}
                  onChange={(event) => onSettingsChange({ massageLabGrainientColorOne: event.target.value })}
                  aria-label="MassageLab Grainient color 1"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Color 2</span>
                <input
                  type="color"
                  value={settings.massageLabGrainientColorTwo}
                  onChange={(event) => onSettingsChange({ massageLabGrainientColorTwo: event.target.value })}
                  aria-label="MassageLab Grainient color 2"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Color 3</span>
                <input
                  type="color"
                  value={settings.massageLabGrainientColorThree}
                  onChange={(event) => onSettingsChange({ massageLabGrainientColorThree: event.target.value })}
                  aria-label="MassageLab Grainient color 3"
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
                  value={settings.massageLabGrainientPrimaryColor}
                  onChange={(event) => onSettingsChange({ massageLabGrainientPrimaryColor: event.target.value })}
                  aria-label="MassageLab Grainient primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={settings.massageLabGrainientHarmony}
                  onChange={(event) => onSettingsChange({
                    massageLabGrainientHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="MassageLab Grainient color harmony"
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
              checked={settings.massageLabGrainientGrainAnimated}
              onChange={(event) => onSettingsChange({ massageLabGrainientGrainAnimated: event.target.checked })}
            />
            <span>Animated grain</span>
          </label>

          <label className={styles.rangeRow}>
            <span>Time speed ({settings.massageLabGrainientTimeSpeed.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.01"
              value={settings.massageLabGrainientTimeSpeed}
              onChange={(event) => onSettingsChange({ massageLabGrainientTimeSpeed: Number(event.target.value) })}
              aria-label="MassageLab Grainient time speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Color balance ({settings.massageLabGrainientColorBalance.toFixed(2)})</span>
            <input
              type="range"
              min="-1"
              max="1"
              step="0.01"
              value={settings.massageLabGrainientColorBalance}
              onChange={(event) => onSettingsChange({ massageLabGrainientColorBalance: Number(event.target.value) })}
              aria-label="MassageLab Grainient color balance"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Warp strength ({settings.massageLabGrainientWarpStrength.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="5"
              step="0.05"
              value={settings.massageLabGrainientWarpStrength}
              onChange={(event) => onSettingsChange({ massageLabGrainientWarpStrength: Number(event.target.value) })}
              aria-label="MassageLab Grainient warp strength"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Warp frequency ({settings.massageLabGrainientWarpFrequency.toFixed(1)})</span>
            <input
              type="range"
              min="0.1"
              max="20"
              step="0.1"
              value={settings.massageLabGrainientWarpFrequency}
              onChange={(event) => onSettingsChange({ massageLabGrainientWarpFrequency: Number(event.target.value) })}
              aria-label="MassageLab Grainient warp frequency"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Warp speed ({settings.massageLabGrainientWarpSpeed.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="6"
              step="0.05"
              value={settings.massageLabGrainientWarpSpeed}
              onChange={(event) => onSettingsChange({ massageLabGrainientWarpSpeed: Number(event.target.value) })}
              aria-label="MassageLab Grainient warp speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Warp amplitude ({settings.massageLabGrainientWarpAmplitude.toFixed(0)})</span>
            <input
              type="range"
              min="1"
              max="160"
              step="1"
              value={settings.massageLabGrainientWarpAmplitude}
              onChange={(event) => onSettingsChange({ massageLabGrainientWarpAmplitude: Number(event.target.value) })}
              aria-label="MassageLab Grainient warp amplitude"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Blend angle ({settings.massageLabGrainientBlendAngle.toFixed(0)}deg)</span>
            <input
              type="range"
              min="-180"
              max="180"
              step="1"
              value={settings.massageLabGrainientBlendAngle}
              onChange={(event) => onSettingsChange({ massageLabGrainientBlendAngle: Number(event.target.value) })}
              aria-label="MassageLab Grainient blend angle"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Blend softness ({settings.massageLabGrainientBlendSoftness.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.massageLabGrainientBlendSoftness}
              onChange={(event) => onSettingsChange({ massageLabGrainientBlendSoftness: Number(event.target.value) })}
              aria-label="MassageLab Grainient blend softness"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Rotation amount ({settings.massageLabGrainientRotationAmount.toFixed(0)})</span>
            <input
              type="range"
              min="0"
              max="1200"
              step="10"
              value={settings.massageLabGrainientRotationAmount}
              onChange={(event) => onSettingsChange({ massageLabGrainientRotationAmount: Number(event.target.value) })}
              aria-label="MassageLab Grainient rotation amount"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Noise scale ({settings.massageLabGrainientNoiseScale.toFixed(1)})</span>
            <input
              type="range"
              min="0.1"
              max="8"
              step="0.1"
              value={settings.massageLabGrainientNoiseScale}
              onChange={(event) => onSettingsChange({ massageLabGrainientNoiseScale: Number(event.target.value) })}
              aria-label="MassageLab Grainient noise scale"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Grain amount ({settings.massageLabGrainientGrainAmount.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.massageLabGrainientGrainAmount}
              onChange={(event) => onSettingsChange({ massageLabGrainientGrainAmount: Number(event.target.value) })}
              aria-label="MassageLab Grainient grain amount"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Grain scale ({settings.massageLabGrainientGrainScale.toFixed(1)})</span>
            <input
              type="range"
              min="0.1"
              max="12"
              step="0.1"
              value={settings.massageLabGrainientGrainScale}
              onChange={(event) => onSettingsChange({ massageLabGrainientGrainScale: Number(event.target.value) })}
              aria-label="MassageLab Grainient grain scale"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Contrast ({settings.massageLabGrainientContrast.toFixed(2)})</span>
            <input
              type="range"
              min="0.2"
              max="4"
              step="0.05"
              value={settings.massageLabGrainientContrast}
              onChange={(event) => onSettingsChange({ massageLabGrainientContrast: Number(event.target.value) })}
              aria-label="MassageLab Grainient contrast"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Gamma ({settings.massageLabGrainientGamma.toFixed(2)})</span>
            <input
              type="range"
              min="0.2"
              max="4"
              step="0.05"
              value={settings.massageLabGrainientGamma}
              onChange={(event) => onSettingsChange({ massageLabGrainientGamma: Number(event.target.value) })}
              aria-label="MassageLab Grainient gamma"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Saturation ({settings.massageLabGrainientSaturation.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={settings.massageLabGrainientSaturation}
              onChange={(event) => onSettingsChange({ massageLabGrainientSaturation: Number(event.target.value) })}
              aria-label="MassageLab Grainient saturation"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Center X ({settings.massageLabGrainientCenterX.toFixed(2)})</span>
            <input
              type="range"
              min="-1"
              max="1"
              step="0.01"
              value={settings.massageLabGrainientCenterX}
              onChange={(event) => onSettingsChange({ massageLabGrainientCenterX: Number(event.target.value) })}
              aria-label="MassageLab Grainient center X"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Center Y ({settings.massageLabGrainientCenterY.toFixed(2)})</span>
            <input
              type="range"
              min="-1"
              max="1"
              step="0.01"
              value={settings.massageLabGrainientCenterY}
              onChange={(event) => onSettingsChange({ massageLabGrainientCenterY: Number(event.target.value) })}
              aria-label="MassageLab Grainient center Y"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Zoom ({settings.massageLabGrainientZoom.toFixed(2)})</span>
            <input
              type="range"
              min="0.2"
              max="3"
              step="0.05"
              value={settings.massageLabGrainientZoom}
              onChange={(event) => onSettingsChange({ massageLabGrainientZoom: Number(event.target.value) })}
              aria-label="MassageLab Grainient zoom"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-grid-scan") {
      const useCustomGridScan = settings.massageLabGridScanPaletteMode === "custom"
      const useHarmonyGridScan = settings.massageLabGridScanPaletteMode === "harmony"

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.massageLabGridScanPaletteMode}
              onChange={(event) => onSettingsChange({
                massageLabGridScanPaletteMode: event.target.value as MassageLabGridScanPaletteMode,
              })}
              aria-label="MassageLab Grid Scan color mode"
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
                  value={settings.massageLabGridScanLinesColor}
                  onChange={(event) => onSettingsChange({ massageLabGridScanLinesColor: event.target.value })}
                  aria-label="MassageLab Grid Scan line color"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Scan color</span>
                <input
                  type="color"
                  value={settings.massageLabGridScanScanColor}
                  onChange={(event) => onSettingsChange({ massageLabGridScanScanColor: event.target.value })}
                  aria-label="MassageLab Grid Scan scan color"
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
                  value={settings.massageLabGridScanPrimaryColor}
                  onChange={(event) => onSettingsChange({ massageLabGridScanPrimaryColor: event.target.value })}
                  aria-label="MassageLab Grid Scan primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={settings.massageLabGridScanHarmony}
                  onChange={(event) => onSettingsChange({
                    massageLabGridScanHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="MassageLab Grid Scan color harmony"
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
              checked={settings.massageLabGridScanEnablePointerInteraction}
              onChange={(event) => onSettingsChange({
                massageLabGridScanEnablePointerInteraction: event.target.checked,
              })}
            />
            <span>Pointer skew</span>
          </label>

          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={settings.massageLabGridScanScanOnClick}
              onChange={(event) => onSettingsChange({ massageLabGridScanScanOnClick: event.target.checked })}
            />
            <span>Click scan pulses</span>
          </label>

          <label className={styles.selectRow}>
            <span>Line style</span>
            <select
              value={settings.massageLabGridScanLineStyle}
              onChange={(event) => onSettingsChange({
                massageLabGridScanLineStyle: event.target.value as MassageLabGridScanLineStyle,
              })}
              aria-label="MassageLab Grid Scan line style"
            >
              <option value="solid">Solid</option>
              <option value="dashed">Dashed</option>
              <option value="dotted">Dotted</option>
            </select>
          </label>

          <label className={styles.selectRow}>
            <span>Scan direction</span>
            <select
              value={settings.massageLabGridScanDirection}
              onChange={(event) => onSettingsChange({
                massageLabGridScanDirection: event.target.value as MassageLabGridScanDirection,
              })}
              aria-label="MassageLab Grid Scan direction"
            >
              <option value="forward">Forward</option>
              <option value="backward">Backward</option>
              <option value="pingpong">Ping pong</option>
            </select>
          </label>

          <label className={styles.rangeRow}>
            <span>Sensitivity ({settings.massageLabGridScanSensitivity.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.massageLabGridScanSensitivity}
              onChange={(event) => onSettingsChange({ massageLabGridScanSensitivity: Number(event.target.value) })}
              aria-label="MassageLab Grid Scan sensitivity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Line thickness ({settings.massageLabGridScanLineThickness.toFixed(1)})</span>
            <input
              type="range"
              min="0.2"
              max="6"
              step="0.1"
              value={settings.massageLabGridScanLineThickness}
              onChange={(event) => onSettingsChange({ massageLabGridScanLineThickness: Number(event.target.value) })}
              aria-label="MassageLab Grid Scan line thickness"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Scan opacity ({settings.massageLabGridScanScanOpacity.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.massageLabGridScanScanOpacity}
              onChange={(event) => onSettingsChange({ massageLabGridScanScanOpacity: Number(event.target.value) })}
              aria-label="MassageLab Grid Scan opacity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Grid scale ({settings.massageLabGridScanGridScale.toFixed(2)})</span>
            <input
              type="range"
              min="0.02"
              max="0.5"
              step="0.01"
              value={settings.massageLabGridScanGridScale}
              onChange={(event) => onSettingsChange({ massageLabGridScanGridScale: Number(event.target.value) })}
              aria-label="MassageLab Grid Scan grid scale"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Line jitter ({settings.massageLabGridScanLineJitter.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.massageLabGridScanLineJitter}
              onChange={(event) => onSettingsChange({ massageLabGridScanLineJitter: Number(event.target.value) })}
              aria-label="MassageLab Grid Scan line jitter"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Noise ({settings.massageLabGridScanNoiseIntensity.toFixed(3)})</span>
            <input
              type="range"
              min="0"
              max="0.25"
              step="0.005"
              value={settings.massageLabGridScanNoiseIntensity}
              onChange={(event) => onSettingsChange({ massageLabGridScanNoiseIntensity: Number(event.target.value) })}
              aria-label="MassageLab Grid Scan noise"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Bloom opacity ({settings.massageLabGridScanBloomOpacity.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.05"
              value={settings.massageLabGridScanBloomOpacity}
              onChange={(event) => onSettingsChange({ massageLabGridScanBloomOpacity: Number(event.target.value) })}
              aria-label="MassageLab Grid Scan bloom opacity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Scan glow ({settings.massageLabGridScanScanGlow.toFixed(2)})</span>
            <input
              type="range"
              min="0.1"
              max="3"
              step="0.05"
              value={settings.massageLabGridScanScanGlow}
              onChange={(event) => onSettingsChange({ massageLabGridScanScanGlow: Number(event.target.value) })}
              aria-label="MassageLab Grid Scan glow"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Scan softness ({settings.massageLabGridScanScanSoftness.toFixed(1)})</span>
            <input
              type="range"
              min="0.2"
              max="6"
              step="0.1"
              value={settings.massageLabGridScanScanSoftness}
              onChange={(event) => onSettingsChange({ massageLabGridScanScanSoftness: Number(event.target.value) })}
              aria-label="MassageLab Grid Scan softness"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Phase taper ({settings.massageLabGridScanPhaseTaper.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="0.49"
              step="0.01"
              value={settings.massageLabGridScanPhaseTaper}
              onChange={(event) => onSettingsChange({ massageLabGridScanPhaseTaper: Number(event.target.value) })}
              aria-label="MassageLab Grid Scan phase taper"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Scan duration ({settings.massageLabGridScanScanDuration.toFixed(2)}s)</span>
            <input
              type="range"
              min="0.05"
              max="10"
              step="0.05"
              value={settings.massageLabGridScanScanDuration}
              onChange={(event) => onSettingsChange({ massageLabGridScanScanDuration: Number(event.target.value) })}
              aria-label="MassageLab Grid Scan duration"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Scan delay ({settings.massageLabGridScanScanDelay.toFixed(2)}s)</span>
            <input
              type="range"
              min="0"
              max="10"
              step="0.05"
              value={settings.massageLabGridScanScanDelay}
              onChange={(event) => onSettingsChange({ massageLabGridScanScanDelay: Number(event.target.value) })}
              aria-label="MassageLab Grid Scan delay"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-beams") {
      const useCustomBeams = settings.massageLabBeamsPaletteMode === "custom"
      const useHarmonyBeams = settings.massageLabBeamsPaletteMode === "harmony"

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.massageLabBeamsPaletteMode}
              onChange={(event) => onSettingsChange({
                massageLabBeamsPaletteMode: event.target.value as MassageLabBeamsPaletteMode,
              })}
              aria-label="MassageLab Beams color mode"
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
                value={settings.massageLabBeamsLightColor}
                onChange={(event) => onSettingsChange({ massageLabBeamsLightColor: event.target.value })}
                aria-label="MassageLab Beams light color"
              />
            </label>
          ) : null}

          {useHarmonyBeams ? (
            <>
              <label className={styles.colorRow}>
                <span>Primary color</span>
                <input
                  type="color"
                  value={settings.massageLabBeamsPrimaryColor}
                  onChange={(event) => onSettingsChange({ massageLabBeamsPrimaryColor: event.target.value })}
                  aria-label="MassageLab Beams primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={settings.massageLabBeamsHarmony}
                  onChange={(event) => onSettingsChange({
                    massageLabBeamsHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="MassageLab Beams color harmony"
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
            <span>Beam width ({settings.massageLabBeamsBeamWidth.toFixed(1)})</span>
            <input
              type="range"
              min="0.2"
              max="6"
              step="0.1"
              value={settings.massageLabBeamsBeamWidth}
              onChange={(event) => onSettingsChange({ massageLabBeamsBeamWidth: Number(event.target.value) })}
              aria-label="MassageLab Beams width"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Beam height ({settings.massageLabBeamsBeamHeight.toFixed(0)})</span>
            <input
              type="range"
              min="4"
              max="32"
              step="1"
              value={settings.massageLabBeamsBeamHeight}
              onChange={(event) => onSettingsChange({ massageLabBeamsBeamHeight: Number(event.target.value) })}
              aria-label="MassageLab Beams height"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Beam count ({settings.massageLabBeamsBeamNumber.toFixed(0)})</span>
            <input
              type="range"
              min="1"
              max="48"
              step="1"
              value={settings.massageLabBeamsBeamNumber}
              onChange={(event) => onSettingsChange({ massageLabBeamsBeamNumber: Number(event.target.value) })}
              aria-label="MassageLab Beams count"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Speed ({settings.massageLabBeamsSpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0"
              max="8"
              step="0.05"
              value={settings.massageLabBeamsSpeed}
              onChange={(event) => onSettingsChange({ massageLabBeamsSpeed: Number(event.target.value) })}
              aria-label="MassageLab Beams speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Noise ({settings.massageLabBeamsNoiseIntensity.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="4"
              step="0.05"
              value={settings.massageLabBeamsNoiseIntensity}
              onChange={(event) => onSettingsChange({ massageLabBeamsNoiseIntensity: Number(event.target.value) })}
              aria-label="MassageLab Beams noise"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Scale ({settings.massageLabBeamsScale.toFixed(2)})</span>
            <input
              type="range"
              min="0.02"
              max="1.5"
              step="0.01"
              value={settings.massageLabBeamsScale}
              onChange={(event) => onSettingsChange({ massageLabBeamsScale: Number(event.target.value) })}
              aria-label="MassageLab Beams scale"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Rotation ({settings.massageLabBeamsRotation.toFixed(0)}deg)</span>
            <input
              type="range"
              min="-180"
              max="180"
              step="1"
              value={settings.massageLabBeamsRotation}
              onChange={(event) => onSettingsChange({ massageLabBeamsRotation: Number(event.target.value) })}
              aria-label="MassageLab Beams rotation"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-pixel-snow") {
      const useCustomPixelSnow = settings.massageLabPixelSnowPaletteMode === "custom"
      const useHarmonyPixelSnow = settings.massageLabPixelSnowPaletteMode === "harmony"

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.massageLabPixelSnowPaletteMode}
              onChange={(event) => onSettingsChange({
                massageLabPixelSnowPaletteMode: event.target.value as MassageLabPixelSnowPaletteMode,
              })}
              aria-label="MassageLab Pixel Snow color mode"
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
                value={settings.massageLabPixelSnowColor}
                onChange={(event) => onSettingsChange({ massageLabPixelSnowColor: event.target.value })}
                aria-label="MassageLab Pixel Snow color"
              />
            </label>
          ) : null}

          {useHarmonyPixelSnow ? (
            <>
              <label className={styles.colorRow}>
                <span>Primary color</span>
                <input
                  type="color"
                  value={settings.massageLabPixelSnowPrimaryColor}
                  onChange={(event) => onSettingsChange({ massageLabPixelSnowPrimaryColor: event.target.value })}
                  aria-label="MassageLab Pixel Snow primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={settings.massageLabPixelSnowHarmony}
                  onChange={(event) => onSettingsChange({
                    massageLabPixelSnowHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="MassageLab Pixel Snow color harmony"
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
              value={settings.massageLabPixelSnowVariant}
              onChange={(event) => onSettingsChange({
                massageLabPixelSnowVariant: event.target.value as MassageLabPixelSnowVariant,
              })}
              aria-label="MassageLab Pixel Snow variant"
            >
              <option value="square">Square</option>
              <option value="round">Round</option>
              <option value="snowflake">Snowflake</option>
            </select>
          </label>

          <label className={styles.rangeRow}>
            <span>Flake size ({settings.massageLabPixelSnowFlakeSize.toFixed(3)})</span>
            <input
              type="range"
              min="0.001"
              max="0.08"
              step="0.001"
              value={settings.massageLabPixelSnowFlakeSize}
              onChange={(event) => onSettingsChange({ massageLabPixelSnowFlakeSize: Number(event.target.value) })}
              aria-label="MassageLab Pixel Snow flake size"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Minimum flake ({settings.massageLabPixelSnowMinFlakeSize.toFixed(2)})</span>
            <input
              type="range"
              min="0.1"
              max="6"
              step="0.05"
              value={settings.massageLabPixelSnowMinFlakeSize}
              onChange={(event) => onSettingsChange({ massageLabPixelSnowMinFlakeSize: Number(event.target.value) })}
              aria-label="MassageLab Pixel Snow minimum flake size"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Pixel resolution ({settings.massageLabPixelSnowPixelResolution.toFixed(0)})</span>
            <input
              type="range"
              min="40"
              max="640"
              step="10"
              value={settings.massageLabPixelSnowPixelResolution}
              onChange={(event) => onSettingsChange({ massageLabPixelSnowPixelResolution: Number(event.target.value) })}
              aria-label="MassageLab Pixel Snow pixel resolution"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Speed ({settings.massageLabPixelSnowSpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0"
              max="5"
              step="0.05"
              value={settings.massageLabPixelSnowSpeed}
              onChange={(event) => onSettingsChange({ massageLabPixelSnowSpeed: Number(event.target.value) })}
              aria-label="MassageLab Pixel Snow speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Depth fade ({settings.massageLabPixelSnowDepthFade.toFixed(1)})</span>
            <input
              type="range"
              min="1"
              max="40"
              step="0.5"
              value={settings.massageLabPixelSnowDepthFade}
              onChange={(event) => onSettingsChange({ massageLabPixelSnowDepthFade: Number(event.target.value) })}
              aria-label="MassageLab Pixel Snow depth fade"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Far plane ({settings.massageLabPixelSnowFarPlane.toFixed(0)})</span>
            <input
              type="range"
              min="4"
              max="80"
              step="1"
              value={settings.massageLabPixelSnowFarPlane}
              onChange={(event) => onSettingsChange({ massageLabPixelSnowFarPlane: Number(event.target.value) })}
              aria-label="MassageLab Pixel Snow far plane"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Brightness ({settings.massageLabPixelSnowBrightness.toFixed(2)})</span>
            <input
              type="range"
              min="0.1"
              max="4"
              step="0.05"
              value={settings.massageLabPixelSnowBrightness}
              onChange={(event) => onSettingsChange({ massageLabPixelSnowBrightness: Number(event.target.value) })}
              aria-label="MassageLab Pixel Snow brightness"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Gamma ({settings.massageLabPixelSnowGamma.toFixed(3)})</span>
            <input
              type="range"
              min="0.1"
              max="2"
              step="0.01"
              value={settings.massageLabPixelSnowGamma}
              onChange={(event) => onSettingsChange({ massageLabPixelSnowGamma: Number(event.target.value) })}
              aria-label="MassageLab Pixel Snow gamma"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Density ({settings.massageLabPixelSnowDensity.toFixed(2)})</span>
            <input
              type="range"
              min="0.02"
              max="1"
              step="0.01"
              value={settings.massageLabPixelSnowDensity}
              onChange={(event) => onSettingsChange({ massageLabPixelSnowDensity: Number(event.target.value) })}
              aria-label="MassageLab Pixel Snow density"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Direction ({settings.massageLabPixelSnowDirection.toFixed(0)}deg)</span>
            <input
              type="range"
              min="0"
              max="360"
              step="1"
              value={settings.massageLabPixelSnowDirection}
              onChange={(event) => onSettingsChange({ massageLabPixelSnowDirection: Number(event.target.value) })}
              aria-label="MassageLab Pixel Snow direction"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-lightning") {
      const useSourceLightning = settings.massageLabLightningPaletteMode === "source"
      const useCustomLightning = settings.massageLabLightningPaletteMode === "custom"
      const useHarmonyLightning = settings.massageLabLightningPaletteMode === "harmony"

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.massageLabLightningPaletteMode}
              onChange={(event) => onSettingsChange({
                massageLabLightningPaletteMode: event.target.value as MassageLabLightningPaletteMode,
              })}
              aria-label="MassageLab Lightning color mode"
            >
              <option value="source">Source hue</option>
              <option value="custom">Custom color</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {useSourceLightning ? (
            <label className={styles.rangeRow}>
              <span>Hue ({settings.massageLabLightningHue.toFixed(0)}deg)</span>
              <input
                type="range"
                min="0"
                max="360"
                step="1"
                value={settings.massageLabLightningHue}
                onChange={(event) => onSettingsChange({ massageLabLightningHue: Number(event.target.value) })}
                aria-label="MassageLab Lightning hue"
              />
            </label>
          ) : null}

          {useCustomLightning ? (
            <label className={styles.colorRow}>
              <span>Lightning color</span>
              <input
                type="color"
                value={settings.massageLabLightningColor}
                onChange={(event) => onSettingsChange({ massageLabLightningColor: event.target.value })}
                aria-label="MassageLab Lightning color"
              />
            </label>
          ) : null}

          {useHarmonyLightning ? (
            <>
              <label className={styles.colorRow}>
                <span>Primary color</span>
                <input
                  type="color"
                  value={settings.massageLabLightningPrimaryColor}
                  onChange={(event) => onSettingsChange({ massageLabLightningPrimaryColor: event.target.value })}
                  aria-label="MassageLab Lightning primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={settings.massageLabLightningHarmony}
                  onChange={(event) => onSettingsChange({
                    massageLabLightningHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="MassageLab Lightning color harmony"
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
            <span>X offset ({settings.massageLabLightningXOffset.toFixed(2)})</span>
            <input
              type="range"
              min="-2"
              max="2"
              step="0.05"
              value={settings.massageLabLightningXOffset}
              onChange={(event) => onSettingsChange({ massageLabLightningXOffset: Number(event.target.value) })}
              aria-label="MassageLab Lightning X offset"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Speed ({settings.massageLabLightningSpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0"
              max="5"
              step="0.05"
              value={settings.massageLabLightningSpeed}
              onChange={(event) => onSettingsChange({ massageLabLightningSpeed: Number(event.target.value) })}
              aria-label="MassageLab Lightning speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Intensity ({settings.massageLabLightningIntensity.toFixed(2)})</span>
            <input
              type="range"
              min="0.1"
              max="5"
              step="0.05"
              value={settings.massageLabLightningIntensity}
              onChange={(event) => onSettingsChange({ massageLabLightningIntensity: Number(event.target.value) })}
              aria-label="MassageLab Lightning intensity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Size ({settings.massageLabLightningSize.toFixed(2)})</span>
            <input
              type="range"
              min="0.2"
              max="5"
              step="0.05"
              value={settings.massageLabLightningSize}
              onChange={(event) => onSettingsChange({ massageLabLightningSize: Number(event.target.value) })}
              aria-label="MassageLab Lightning size"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-prismatic-burst") {
      const useCustomPrismatic = settings.massageLabPrismaticBurstPaletteMode === "custom"
      const useHarmonyPrismatic = settings.massageLabPrismaticBurstPaletteMode === "harmony"

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.massageLabPrismaticBurstPaletteMode}
              onChange={(event) => onSettingsChange({
                massageLabPrismaticBurstPaletteMode: event.target.value as MassageLabPrismaticBurstPaletteMode,
              })}
              aria-label="MassageLab Prismatic Burst color mode"
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
                  value={settings.massageLabPrismaticBurstColorOne}
                  onChange={(event) => onSettingsChange({ massageLabPrismaticBurstColorOne: event.target.value })}
                  aria-label="MassageLab Prismatic Burst color 1"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Color 2</span>
                <input
                  type="color"
                  value={settings.massageLabPrismaticBurstColorTwo}
                  onChange={(event) => onSettingsChange({ massageLabPrismaticBurstColorTwo: event.target.value })}
                  aria-label="MassageLab Prismatic Burst color 2"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Color 3</span>
                <input
                  type="color"
                  value={settings.massageLabPrismaticBurstColorThree}
                  onChange={(event) => onSettingsChange({ massageLabPrismaticBurstColorThree: event.target.value })}
                  aria-label="MassageLab Prismatic Burst color 3"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Color 4</span>
                <input
                  type="color"
                  value={settings.massageLabPrismaticBurstColorFour}
                  onChange={(event) => onSettingsChange({ massageLabPrismaticBurstColorFour: event.target.value })}
                  aria-label="MassageLab Prismatic Burst color 4"
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
                  value={settings.massageLabPrismaticBurstPrimaryColor}
                  onChange={(event) => onSettingsChange({ massageLabPrismaticBurstPrimaryColor: event.target.value })}
                  aria-label="MassageLab Prismatic Burst primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={settings.massageLabPrismaticBurstHarmony}
                  onChange={(event) => onSettingsChange({
                    massageLabPrismaticBurstHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="MassageLab Prismatic Burst color harmony"
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
              value={settings.massageLabPrismaticBurstAnimationType}
              onChange={(event) => onSettingsChange({
                massageLabPrismaticBurstAnimationType: event.target.value as MassageLabPrismaticBurstAnimationType,
              })}
              aria-label="MassageLab Prismatic Burst animation"
            >
              <option value="rotate3d">Rotate 3D</option>
              <option value="rotate">Rotate</option>
              <option value="hover">Cursor hover</option>
            </select>
          </label>

          <label className={styles.selectRow}>
            <span>Blend</span>
            <select
              value={settings.massageLabPrismaticBurstMixBlendMode}
              onChange={(event) => onSettingsChange({
                massageLabPrismaticBurstMixBlendMode: event.target.value as MassageLabPrismaticBurstMixBlendMode,
              })}
              aria-label="MassageLab Prismatic Burst blend mode"
            >
              <option value="lighten">Lighten</option>
              <option value="screen">Screen</option>
              <option value="none">None</option>
            </select>
          </label>

          <label className={styles.rangeRow}>
            <span>Intensity ({settings.massageLabPrismaticBurstIntensity.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="5"
              step="0.05"
              value={settings.massageLabPrismaticBurstIntensity}
              onChange={(event) => onSettingsChange({ massageLabPrismaticBurstIntensity: Number(event.target.value) })}
              aria-label="MassageLab Prismatic Burst intensity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Speed ({settings.massageLabPrismaticBurstSpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={settings.massageLabPrismaticBurstSpeed}
              onChange={(event) => onSettingsChange({ massageLabPrismaticBurstSpeed: Number(event.target.value) })}
              aria-label="MassageLab Prismatic Burst speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Distortion ({settings.massageLabPrismaticBurstDistort.toFixed(1)})</span>
            <input
              type="range"
              min="0"
              max="50"
              step="0.5"
              value={settings.massageLabPrismaticBurstDistort}
              onChange={(event) => onSettingsChange({ massageLabPrismaticBurstDistort: Number(event.target.value) })}
              aria-label="MassageLab Prismatic Burst distortion"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Offset X ({settings.massageLabPrismaticBurstOffsetX.toFixed(0)}px)</span>
            <input
              type="range"
              min="-1000"
              max="1000"
              step="10"
              value={settings.massageLabPrismaticBurstOffsetX}
              onChange={(event) => onSettingsChange({ massageLabPrismaticBurstOffsetX: Number(event.target.value) })}
              aria-label="MassageLab Prismatic Burst offset X"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Offset Y ({settings.massageLabPrismaticBurstOffsetY.toFixed(0)}px)</span>
            <input
              type="range"
              min="-1000"
              max="1000"
              step="10"
              value={settings.massageLabPrismaticBurstOffsetY}
              onChange={(event) => onSettingsChange({ massageLabPrismaticBurstOffsetY: Number(event.target.value) })}
              aria-label="MassageLab Prismatic Burst offset Y"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Hover damping ({settings.massageLabPrismaticBurstHoverDampness.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.massageLabPrismaticBurstHoverDampness}
              onChange={(event) => onSettingsChange({
                massageLabPrismaticBurstHoverDampness: Number(event.target.value),
              })}
              aria-label="MassageLab Prismatic Burst hover damping"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Ray count ({settings.massageLabPrismaticBurstRayCount.toFixed(0)})</span>
            <input
              type="range"
              min="0"
              max="64"
              step="1"
              value={settings.massageLabPrismaticBurstRayCount}
              onChange={(event) => onSettingsChange({ massageLabPrismaticBurstRayCount: Number(event.target.value) })}
              aria-label="MassageLab Prismatic Burst ray count"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-galaxy") {
      const useSourceGalaxy = settings.massageLabGalaxyPaletteMode === "source"
      const useCustomGalaxy = settings.massageLabGalaxyPaletteMode === "custom"
      const useHarmonyGalaxy = settings.massageLabGalaxyPaletteMode === "harmony"

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.massageLabGalaxyPaletteMode}
              onChange={(event) => onSettingsChange({
                massageLabGalaxyPaletteMode: event.target.value as MassageLabGalaxyPaletteMode,
              })}
              aria-label="MassageLab Galaxy color mode"
            >
              <option value="source">Source hue shift</option>
              <option value="custom">Custom color</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {useSourceGalaxy ? (
            <label className={styles.rangeRow}>
              <span>Hue shift ({settings.massageLabGalaxyHueShift.toFixed(0)}deg)</span>
              <input
                type="range"
                min="0"
                max="360"
                step="1"
                value={settings.massageLabGalaxyHueShift}
                onChange={(event) => onSettingsChange({ massageLabGalaxyHueShift: Number(event.target.value) })}
                aria-label="MassageLab Galaxy hue shift"
              />
            </label>
          ) : null}

          {useCustomGalaxy ? (
            <label className={styles.colorRow}>
              <span>Galaxy color</span>
              <input
                type="color"
                value={settings.massageLabGalaxyColor}
                onChange={(event) => onSettingsChange({ massageLabGalaxyColor: event.target.value })}
                aria-label="MassageLab Galaxy color"
              />
            </label>
          ) : null}

          {useHarmonyGalaxy ? (
            <>
              <label className={styles.colorRow}>
                <span>Primary color</span>
                <input
                  type="color"
                  value={settings.massageLabGalaxyPrimaryColor}
                  onChange={(event) => onSettingsChange({ massageLabGalaxyPrimaryColor: event.target.value })}
                  aria-label="MassageLab Galaxy primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={settings.massageLabGalaxyHarmony}
                  onChange={(event) => onSettingsChange({
                    massageLabGalaxyHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="MassageLab Galaxy color harmony"
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
              checked={settings.massageLabGalaxyTransparent}
              onChange={(event) => onSettingsChange({ massageLabGalaxyTransparent: event.target.checked })}
              aria-label="MassageLab Galaxy transparent background"
            />
            <span>Transparent background</span>
          </label>

          <label className={styles.selectRow}>
            <input
              type="checkbox"
              checked={settings.massageLabGalaxyMouseInteraction}
              onChange={(event) => onSettingsChange({ massageLabGalaxyMouseInteraction: event.target.checked })}
              aria-label="MassageLab Galaxy cursor interaction"
            />
            <span>Cursor interaction</span>
          </label>

          <label className={styles.selectRow}>
            <input
              type="checkbox"
              checked={settings.massageLabGalaxyMouseRepulsion}
              onChange={(event) => onSettingsChange({ massageLabGalaxyMouseRepulsion: event.target.checked })}
              aria-label="MassageLab Galaxy cursor repulsion"
            />
            <span>Cursor repulsion</span>
          </label>

          <label className={styles.rangeRow}>
            <span>Focal X ({settings.massageLabGalaxyFocalX.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.massageLabGalaxyFocalX}
              onChange={(event) => onSettingsChange({ massageLabGalaxyFocalX: Number(event.target.value) })}
              aria-label="MassageLab Galaxy focal X"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Focal Y ({settings.massageLabGalaxyFocalY.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.massageLabGalaxyFocalY}
              onChange={(event) => onSettingsChange({ massageLabGalaxyFocalY: Number(event.target.value) })}
              aria-label="MassageLab Galaxy focal Y"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Rotation ({settings.massageLabGalaxyRotationDeg.toFixed(0)}deg)</span>
            <input
              type="range"
              min="-360"
              max="360"
              step="1"
              value={settings.massageLabGalaxyRotationDeg}
              onChange={(event) => onSettingsChange({ massageLabGalaxyRotationDeg: Number(event.target.value) })}
              aria-label="MassageLab Galaxy rotation"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Star speed ({settings.massageLabGalaxyStarSpeed.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="5"
              step="0.05"
              value={settings.massageLabGalaxyStarSpeed}
              onChange={(event) => onSettingsChange({ massageLabGalaxyStarSpeed: Number(event.target.value) })}
              aria-label="MassageLab Galaxy star speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Density ({settings.massageLabGalaxyDensity.toFixed(2)})</span>
            <input
              type="range"
              min="0.1"
              max="3"
              step="0.05"
              value={settings.massageLabGalaxyDensity}
              onChange={(event) => onSettingsChange({ massageLabGalaxyDensity: Number(event.target.value) })}
              aria-label="MassageLab Galaxy density"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Speed ({settings.massageLabGalaxySpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0"
              max="5"
              step="0.05"
              value={settings.massageLabGalaxySpeed}
              onChange={(event) => onSettingsChange({ massageLabGalaxySpeed: Number(event.target.value) })}
              aria-label="MassageLab Galaxy speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Glow ({settings.massageLabGalaxyGlowIntensity.toFixed(2)})</span>
            <input
              type="range"
              min="0.01"
              max="2"
              step="0.01"
              value={settings.massageLabGalaxyGlowIntensity}
              onChange={(event) => onSettingsChange({ massageLabGalaxyGlowIntensity: Number(event.target.value) })}
              aria-label="MassageLab Galaxy glow intensity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Saturation ({settings.massageLabGalaxySaturation.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.01"
              value={settings.massageLabGalaxySaturation}
              onChange={(event) => onSettingsChange({ massageLabGalaxySaturation: Number(event.target.value) })}
              aria-label="MassageLab Galaxy saturation"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Twinkle ({settings.massageLabGalaxyTwinkleIntensity.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.massageLabGalaxyTwinkleIntensity}
              onChange={(event) => onSettingsChange({ massageLabGalaxyTwinkleIntensity: Number(event.target.value) })}
              aria-label="MassageLab Galaxy twinkle intensity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Rotation speed ({settings.massageLabGalaxyRotationSpeed.toFixed(2)})</span>
            <input
              type="range"
              min="-2"
              max="2"
              step="0.01"
              value={settings.massageLabGalaxyRotationSpeed}
              onChange={(event) => onSettingsChange({ massageLabGalaxyRotationSpeed: Number(event.target.value) })}
              aria-label="MassageLab Galaxy rotation speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Repulsion ({settings.massageLabGalaxyRepulsionStrength.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="6"
              step="0.05"
              value={settings.massageLabGalaxyRepulsionStrength}
              onChange={(event) => onSettingsChange({ massageLabGalaxyRepulsionStrength: Number(event.target.value) })}
              aria-label="MassageLab Galaxy repulsion strength"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Center repulsion ({settings.massageLabGalaxyAutoCenterRepulsion.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="6"
              step="0.05"
              value={settings.massageLabGalaxyAutoCenterRepulsion}
              onChange={(event) => onSettingsChange({
                massageLabGalaxyAutoCenterRepulsion: Number(event.target.value),
              })}
              aria-label="MassageLab Galaxy center repulsion"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-dither") {
      const useCustomDither = settings.massageLabDitherPaletteMode === "custom"
      const useHarmonyDither = settings.massageLabDitherPaletteMode === "harmony"

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.massageLabDitherPaletteMode}
              onChange={(event) => onSettingsChange({
                massageLabDitherPaletteMode: event.target.value as MassageLabDitherPaletteMode,
              })}
              aria-label="MassageLab Dither color mode"
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
                value={settings.massageLabDitherColor}
                onChange={(event) => onSettingsChange({ massageLabDitherColor: event.target.value })}
                aria-label="MassageLab Dither color"
              />
            </label>
          ) : null}

          {useHarmonyDither ? (
            <>
              <label className={styles.colorRow}>
                <span>Primary color</span>
                <input
                  type="color"
                  value={settings.massageLabDitherPrimaryColor}
                  onChange={(event) => onSettingsChange({ massageLabDitherPrimaryColor: event.target.value })}
                  aria-label="MassageLab Dither primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={settings.massageLabDitherHarmony}
                  onChange={(event) => onSettingsChange({
                    massageLabDitherHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="MassageLab Dither color harmony"
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
              checked={settings.massageLabDitherMouseInteraction}
              onChange={(event) => onSettingsChange({ massageLabDitherMouseInteraction: event.target.checked })}
              aria-label="MassageLab Dither cursor interaction"
            />
            <span>Cursor interaction</span>
          </label>

          <label className={styles.rangeRow}>
            <span>Wave speed ({settings.massageLabDitherWaveSpeed.toFixed(3)})</span>
            <input
              type="range"
              min="0"
              max="0.5"
              step="0.005"
              value={settings.massageLabDitherWaveSpeed}
              onChange={(event) => onSettingsChange({ massageLabDitherWaveSpeed: Number(event.target.value) })}
              aria-label="MassageLab Dither wave speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Wave frequency ({settings.massageLabDitherWaveFrequency.toFixed(1)})</span>
            <input
              type="range"
              min="0.5"
              max="8"
              step="0.1"
              value={settings.massageLabDitherWaveFrequency}
              onChange={(event) => onSettingsChange({ massageLabDitherWaveFrequency: Number(event.target.value) })}
              aria-label="MassageLab Dither wave frequency"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Wave amplitude ({settings.massageLabDitherWaveAmplitude.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.massageLabDitherWaveAmplitude}
              onChange={(event) => onSettingsChange({ massageLabDitherWaveAmplitude: Number(event.target.value) })}
              aria-label="MassageLab Dither wave amplitude"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Color count ({settings.massageLabDitherColorNum})</span>
            <input
              type="range"
              min="2"
              max="16"
              step="1"
              value={settings.massageLabDitherColorNum}
              onChange={(event) => onSettingsChange({ massageLabDitherColorNum: Number(event.target.value) })}
              aria-label="MassageLab Dither color count"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Pixel size ({settings.massageLabDitherPixelSize}px)</span>
            <input
              type="range"
              min="1"
              max="24"
              step="1"
              value={settings.massageLabDitherPixelSize}
              onChange={(event) => onSettingsChange({ massageLabDitherPixelSize: Number(event.target.value) })}
              aria-label="MassageLab Dither pixel size"
            />
          </label>

          {settings.massageLabDitherMouseInteraction ? (
            <label className={styles.rangeRow}>
              <span>Cursor radius ({settings.massageLabDitherMouseRadius.toFixed(2)})</span>
              <input
                type="range"
                min="0.05"
                max="3"
                step="0.05"
                value={settings.massageLabDitherMouseRadius}
                onChange={(event) => onSettingsChange({ massageLabDitherMouseRadius: Number(event.target.value) })}
                aria-label="MassageLab Dither cursor radius"
              />
            </label>
          ) : null}
        </div>
      )
    }

    if (option.id === "massage-lab-faulty-terminal") {
      const useCustomFaultyTerminal = settings.massageLabFaultyTerminalPaletteMode === "custom"
      const useHarmonyFaultyTerminal = settings.massageLabFaultyTerminalPaletteMode === "harmony"

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Tint mode</span>
            <select
              value={settings.massageLabFaultyTerminalPaletteMode}
              onChange={(event) => onSettingsChange({
                massageLabFaultyTerminalPaletteMode: event.target.value as MassageLabFaultyTerminalPaletteMode,
              })}
              aria-label="MassageLab Faulty Terminal tint mode"
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
                value={settings.massageLabFaultyTerminalTint}
                onChange={(event) => onSettingsChange({ massageLabFaultyTerminalTint: event.target.value })}
                aria-label="MassageLab Faulty Terminal tint"
              />
            </label>
          ) : null}

          {useHarmonyFaultyTerminal ? (
            <>
              <label className={styles.colorRow}>
                <span>Primary color</span>
                <input
                  type="color"
                  value={settings.massageLabFaultyTerminalPrimaryColor}
                  onChange={(event) => onSettingsChange({ massageLabFaultyTerminalPrimaryColor: event.target.value })}
                  aria-label="MassageLab Faulty Terminal primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={settings.massageLabFaultyTerminalHarmony}
                  onChange={(event) => onSettingsChange({
                    massageLabFaultyTerminalHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="MassageLab Faulty Terminal color harmony"
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
              checked={settings.massageLabFaultyTerminalMouseReact}
              onChange={(event) => onSettingsChange({ massageLabFaultyTerminalMouseReact: event.target.checked })}
              aria-label="MassageLab Faulty Terminal cursor reaction"
            />
            <span>Cursor reaction</span>
          </label>

          <label className={styles.selectRow}>
            <input
              type="checkbox"
              checked={settings.massageLabFaultyTerminalPageLoadAnimation}
              onChange={(event) => onSettingsChange({
                massageLabFaultyTerminalPageLoadAnimation: event.target.checked,
              })}
              aria-label="MassageLab Faulty Terminal page-load animation"
            />
            <span>Page-load animation</span>
          </label>

          <label className={styles.rangeRow}>
            <span>Scale ({settings.massageLabFaultyTerminalScale.toFixed(2)})</span>
            <input
              type="range"
              min="0.25"
              max="4"
              step="0.05"
              value={settings.massageLabFaultyTerminalScale}
              onChange={(event) => onSettingsChange({ massageLabFaultyTerminalScale: Number(event.target.value) })}
              aria-label="MassageLab Faulty Terminal scale"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Grid X ({settings.massageLabFaultyTerminalGridMulX.toFixed(2)})</span>
            <input
              type="range"
              min="0.25"
              max="6"
              step="0.05"
              value={settings.massageLabFaultyTerminalGridMulX}
              onChange={(event) => onSettingsChange({ massageLabFaultyTerminalGridMulX: Number(event.target.value) })}
              aria-label="MassageLab Faulty Terminal grid X multiplier"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Grid Y ({settings.massageLabFaultyTerminalGridMulY.toFixed(2)})</span>
            <input
              type="range"
              min="0.25"
              max="6"
              step="0.05"
              value={settings.massageLabFaultyTerminalGridMulY}
              onChange={(event) => onSettingsChange({ massageLabFaultyTerminalGridMulY: Number(event.target.value) })}
              aria-label="MassageLab Faulty Terminal grid Y multiplier"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Digit size ({settings.massageLabFaultyTerminalDigitSize.toFixed(2)})</span>
            <input
              type="range"
              min="0.5"
              max="4"
              step="0.05"
              value={settings.massageLabFaultyTerminalDigitSize}
              onChange={(event) => onSettingsChange({ massageLabFaultyTerminalDigitSize: Number(event.target.value) })}
              aria-label="MassageLab Faulty Terminal digit size"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Time scale ({settings.massageLabFaultyTerminalTimeScale.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.01"
              value={settings.massageLabFaultyTerminalTimeScale}
              onChange={(event) => onSettingsChange({ massageLabFaultyTerminalTimeScale: Number(event.target.value) })}
              aria-label="MassageLab Faulty Terminal time scale"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Scanlines ({settings.massageLabFaultyTerminalScanlineIntensity.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.01"
              value={settings.massageLabFaultyTerminalScanlineIntensity}
              onChange={(event) => onSettingsChange({
                massageLabFaultyTerminalScanlineIntensity: Number(event.target.value),
              })}
              aria-label="MassageLab Faulty Terminal scanline intensity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Glitch ({settings.massageLabFaultyTerminalGlitchAmount.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.01"
              value={settings.massageLabFaultyTerminalGlitchAmount}
              onChange={(event) => onSettingsChange({ massageLabFaultyTerminalGlitchAmount: Number(event.target.value) })}
              aria-label="MassageLab Faulty Terminal glitch amount"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Flicker ({settings.massageLabFaultyTerminalFlickerAmount.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.01"
              value={settings.massageLabFaultyTerminalFlickerAmount}
              onChange={(event) => onSettingsChange({
                massageLabFaultyTerminalFlickerAmount: Number(event.target.value),
              })}
              aria-label="MassageLab Faulty Terminal flicker amount"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Noise ({settings.massageLabFaultyTerminalNoiseAmp.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.01"
              value={settings.massageLabFaultyTerminalNoiseAmp}
              onChange={(event) => onSettingsChange({ massageLabFaultyTerminalNoiseAmp: Number(event.target.value) })}
              aria-label="MassageLab Faulty Terminal noise amplitude"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Chromatic ({settings.massageLabFaultyTerminalChromaticAberration.toFixed(1)})</span>
            <input
              type="range"
              min="0"
              max="8"
              step="0.1"
              value={settings.massageLabFaultyTerminalChromaticAberration}
              onChange={(event) => onSettingsChange({
                massageLabFaultyTerminalChromaticAberration: Number(event.target.value),
              })}
              aria-label="MassageLab Faulty Terminal chromatic aberration"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Dither ({settings.massageLabFaultyTerminalDither.toFixed(0)})</span>
            <input
              type="range"
              min="0"
              max="255"
              step="1"
              value={settings.massageLabFaultyTerminalDither}
              onChange={(event) => onSettingsChange({ massageLabFaultyTerminalDither: Number(event.target.value) })}
              aria-label="MassageLab Faulty Terminal dither"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Curvature ({settings.massageLabFaultyTerminalCurvature.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.massageLabFaultyTerminalCurvature}
              onChange={(event) => onSettingsChange({ massageLabFaultyTerminalCurvature: Number(event.target.value) })}
              aria-label="MassageLab Faulty Terminal curvature"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Brightness ({settings.massageLabFaultyTerminalBrightness.toFixed(2)})</span>
            <input
              type="range"
              min="0.1"
              max="3"
              step="0.01"
              value={settings.massageLabFaultyTerminalBrightness}
              onChange={(event) => onSettingsChange({ massageLabFaultyTerminalBrightness: Number(event.target.value) })}
              aria-label="MassageLab Faulty Terminal brightness"
            />
          </label>

          {settings.massageLabFaultyTerminalMouseReact ? (
            <label className={styles.rangeRow}>
              <span>Cursor strength ({settings.massageLabFaultyTerminalMouseStrength.toFixed(2)})</span>
              <input
                type="range"
                min="0"
                max="2"
                step="0.01"
                value={settings.massageLabFaultyTerminalMouseStrength}
                onChange={(event) => onSettingsChange({
                  massageLabFaultyTerminalMouseStrength: Number(event.target.value),
                })}
                aria-label="MassageLab Faulty Terminal cursor strength"
              />
            </label>
          ) : null}
        </div>
      )
    }

    if (option.id === "massage-lab-ripple-grid") {
      const useCustomRippleGrid = settings.massageLabRippleGridPaletteMode === "custom"
      const useHarmonyRippleGrid = settings.massageLabRippleGridPaletteMode === "harmony"

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.massageLabRippleGridPaletteMode}
              onChange={(event) => onSettingsChange({
                massageLabRippleGridPaletteMode: event.target.value as MassageLabRippleGridPaletteMode,
              })}
              aria-label="MassageLab Ripple Grid color mode"
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
                value={settings.massageLabRippleGridColor}
                onChange={(event) => onSettingsChange({ massageLabRippleGridColor: event.target.value })}
                aria-label="MassageLab Ripple Grid color"
              />
            </label>
          ) : null}

          {useHarmonyRippleGrid ? (
            <>
              <label className={styles.colorRow}>
                <span>Primary color</span>
                <input
                  type="color"
                  value={settings.massageLabRippleGridPrimaryColor}
                  onChange={(event) => onSettingsChange({ massageLabRippleGridPrimaryColor: event.target.value })}
                  aria-label="MassageLab Ripple Grid primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={settings.massageLabRippleGridHarmony}
                  onChange={(event) => onSettingsChange({
                    massageLabRippleGridHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="MassageLab Ripple Grid color harmony"
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
              checked={settings.massageLabRippleGridMouseInteraction}
              onChange={(event) => onSettingsChange({ massageLabRippleGridMouseInteraction: event.target.checked })}
              aria-label="MassageLab Ripple Grid cursor interaction"
            />
            <span>Cursor interaction</span>
          </label>

          <label className={styles.rangeRow}>
            <span>Ripple ({settings.massageLabRippleGridRippleIntensity.toFixed(3)})</span>
            <input
              type="range"
              min="0"
              max="0.3"
              step="0.005"
              value={settings.massageLabRippleGridRippleIntensity}
              onChange={(event) => onSettingsChange({
                massageLabRippleGridRippleIntensity: Number(event.target.value),
              })}
              aria-label="MassageLab Ripple Grid ripple intensity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Grid size ({settings.massageLabRippleGridGridSize.toFixed(1)})</span>
            <input
              type="range"
              min="2"
              max="30"
              step="0.5"
              value={settings.massageLabRippleGridGridSize}
              onChange={(event) => onSettingsChange({ massageLabRippleGridGridSize: Number(event.target.value) })}
              aria-label="MassageLab Ripple Grid size"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Thickness ({settings.massageLabRippleGridGridThickness.toFixed(1)})</span>
            <input
              type="range"
              min="1"
              max="50"
              step="0.5"
              value={settings.massageLabRippleGridGridThickness}
              onChange={(event) => onSettingsChange({ massageLabRippleGridGridThickness: Number(event.target.value) })}
              aria-label="MassageLab Ripple Grid thickness"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Fade ({settings.massageLabRippleGridFadeDistance.toFixed(2)})</span>
            <input
              type="range"
              min="0.2"
              max="5"
              step="0.05"
              value={settings.massageLabRippleGridFadeDistance}
              onChange={(event) => onSettingsChange({ massageLabRippleGridFadeDistance: Number(event.target.value) })}
              aria-label="MassageLab Ripple Grid fade distance"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Vignette ({settings.massageLabRippleGridVignetteStrength.toFixed(2)})</span>
            <input
              type="range"
              min="0.1"
              max="6"
              step="0.05"
              value={settings.massageLabRippleGridVignetteStrength}
              onChange={(event) => onSettingsChange({
                massageLabRippleGridVignetteStrength: Number(event.target.value),
              })}
              aria-label="MassageLab Ripple Grid vignette strength"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Glow ({settings.massageLabRippleGridGlowIntensity.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.massageLabRippleGridGlowIntensity}
              onChange={(event) => onSettingsChange({ massageLabRippleGridGlowIntensity: Number(event.target.value) })}
              aria-label="MassageLab Ripple Grid glow intensity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Opacity ({settings.massageLabRippleGridOpacity.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.massageLabRippleGridOpacity}
              onChange={(event) => onSettingsChange({ massageLabRippleGridOpacity: Number(event.target.value) })}
              aria-label="MassageLab Ripple Grid opacity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Rotation ({settings.massageLabRippleGridGridRotation.toFixed(0)}deg)</span>
            <input
              type="range"
              min="-180"
              max="180"
              step="1"
              value={settings.massageLabRippleGridGridRotation}
              onChange={(event) => onSettingsChange({ massageLabRippleGridGridRotation: Number(event.target.value) })}
              aria-label="MassageLab Ripple Grid rotation"
            />
          </label>

          {settings.massageLabRippleGridMouseInteraction ? (
            <label className={styles.rangeRow}>
              <span>Cursor radius ({settings.massageLabRippleGridMouseInteractionRadius.toFixed(2)})</span>
              <input
                type="range"
                min="0.1"
                max="5"
                step="0.05"
                value={settings.massageLabRippleGridMouseInteractionRadius}
                onChange={(event) => onSettingsChange({
                  massageLabRippleGridMouseInteractionRadius: Number(event.target.value),
                })}
                aria-label="MassageLab Ripple Grid cursor radius"
              />
            </label>
          ) : null}
        </div>
      )
    }

    if (option.id === "massage-lab-dot-field") {
      const useCustomDotField = settings.massageLabDotFieldPaletteMode === "custom"
      const useHarmonyDotField = settings.massageLabDotFieldPaletteMode === "harmony"

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.massageLabDotFieldPaletteMode}
              onChange={(event) => onSettingsChange({
                massageLabDotFieldPaletteMode: event.target.value as MassageLabDotFieldPaletteMode,
              })}
              aria-label="MassageLab Dot Field color mode"
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
                  value={settings.massageLabDotFieldGradientFromColor}
                  onChange={(event) => onSettingsChange({ massageLabDotFieldGradientFromColor: event.target.value })}
                  aria-label="MassageLab Dot Field gradient start color"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Gradient end</span>
                <input
                  type="color"
                  value={settings.massageLabDotFieldGradientToColor}
                  onChange={(event) => onSettingsChange({ massageLabDotFieldGradientToColor: event.target.value })}
                  aria-label="MassageLab Dot Field gradient end color"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Glow color</span>
                <input
                  type="color"
                  value={settings.massageLabDotFieldGlowColor}
                  onChange={(event) => onSettingsChange({ massageLabDotFieldGlowColor: event.target.value })}
                  aria-label="MassageLab Dot Field glow color"
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
                  value={settings.massageLabDotFieldPrimaryColor}
                  onChange={(event) => onSettingsChange({ massageLabDotFieldPrimaryColor: event.target.value })}
                  aria-label="MassageLab Dot Field primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={settings.massageLabDotFieldHarmony}
                  onChange={(event) => onSettingsChange({
                    massageLabDotFieldHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="MassageLab Dot Field color harmony"
                >
                  <option value="monochromatic">Monochromatic</option>
                  <option value="analogous">Analogous</option>
                  <option value="complementary">Complementary</option>
                  <option value="triad">Triad</option>
                </select>
              </label>
            </>
          ) : null}

          {settings.massageLabDotFieldPaletteMode !== "source" ? (
            <>
              <label className={styles.rangeRow}>
                <span>Start alpha ({settings.massageLabDotFieldGradientFromAlpha.toFixed(2)})</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={settings.massageLabDotFieldGradientFromAlpha}
                  onChange={(event) => onSettingsChange({
                    massageLabDotFieldGradientFromAlpha: Number(event.target.value),
                  })}
                  aria-label="MassageLab Dot Field gradient start alpha"
                />
              </label>
              <label className={styles.rangeRow}>
                <span>End alpha ({settings.massageLabDotFieldGradientToAlpha.toFixed(2)})</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={settings.massageLabDotFieldGradientToAlpha}
                  onChange={(event) => onSettingsChange({
                    massageLabDotFieldGradientToAlpha: Number(event.target.value),
                  })}
                  aria-label="MassageLab Dot Field gradient end alpha"
                />
              </label>
            </>
          ) : null}

          <label className={styles.switchRow}>
            <span>Cursor interaction</span>
            <input
              type="checkbox"
              checked={settings.massageLabDotFieldCursorInteraction}
              onChange={(event) => onSettingsChange({ massageLabDotFieldCursorInteraction: event.target.checked })}
              aria-label="MassageLab Dot Field cursor interaction"
            />
          </label>

          <label className={styles.switchRow}>
            <span>Bulge mode</span>
            <input
              type="checkbox"
              checked={settings.massageLabDotFieldBulgeOnly}
              onChange={(event) => onSettingsChange({ massageLabDotFieldBulgeOnly: event.target.checked })}
              aria-label="MassageLab Dot Field bulge mode"
            />
          </label>

          <label className={styles.switchRow}>
            <span>Sparkle</span>
            <input
              type="checkbox"
              checked={settings.massageLabDotFieldSparkle}
              onChange={(event) => onSettingsChange({ massageLabDotFieldSparkle: event.target.checked })}
              aria-label="MassageLab Dot Field sparkle"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Dot radius ({settings.massageLabDotFieldDotRadius.toFixed(1)})</span>
            <input
              type="range"
              min="0.5"
              max="8"
              step="0.1"
              value={settings.massageLabDotFieldDotRadius}
              onChange={(event) => onSettingsChange({ massageLabDotFieldDotRadius: Number(event.target.value) })}
              aria-label="MassageLab Dot Field dot radius"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Dot spacing ({settings.massageLabDotFieldDotSpacing.toFixed(1)})</span>
            <input
              type="range"
              min="4"
              max="48"
              step="0.5"
              value={settings.massageLabDotFieldDotSpacing}
              onChange={(event) => onSettingsChange({ massageLabDotFieldDotSpacing: Number(event.target.value) })}
              aria-label="MassageLab Dot Field dot spacing"
            />
          </label>

          {settings.massageLabDotFieldCursorInteraction ? (
            <>
              <label className={styles.rangeRow}>
                <span>Cursor radius ({settings.massageLabDotFieldCursorRadius.toFixed(0)})</span>
                <input
                  type="range"
                  min="60"
                  max="900"
                  step="10"
                  value={settings.massageLabDotFieldCursorRadius}
                  onChange={(event) => onSettingsChange({ massageLabDotFieldCursorRadius: Number(event.target.value) })}
                  aria-label="MassageLab Dot Field cursor radius"
                />
              </label>
              <label className={styles.rangeRow}>
                <span>Cursor force ({settings.massageLabDotFieldCursorForce.toFixed(2)})</span>
                <input
                  type="range"
                  min="0.01"
                  max="1"
                  step="0.01"
                  value={settings.massageLabDotFieldCursorForce}
                  onChange={(event) => onSettingsChange({ massageLabDotFieldCursorForce: Number(event.target.value) })}
                  aria-label="MassageLab Dot Field cursor force"
                />
              </label>
              <label className={styles.rangeRow}>
                <span>Bulge strength ({settings.massageLabDotFieldBulgeStrength.toFixed(0)})</span>
                <input
                  type="range"
                  min="0"
                  max="160"
                  step="1"
                  value={settings.massageLabDotFieldBulgeStrength}
                  onChange={(event) => onSettingsChange({ massageLabDotFieldBulgeStrength: Number(event.target.value) })}
                  aria-label="MassageLab Dot Field bulge strength"
                />
              </label>
              <label className={styles.rangeRow}>
                <span>Glow radius ({settings.massageLabDotFieldGlowRadius.toFixed(0)})</span>
                <input
                  type="range"
                  min="0"
                  max="360"
                  step="4"
                  value={settings.massageLabDotFieldGlowRadius}
                  onChange={(event) => onSettingsChange({ massageLabDotFieldGlowRadius: Number(event.target.value) })}
                  aria-label="MassageLab Dot Field glow radius"
                />
              </label>
            </>
          ) : null}

          <label className={styles.rangeRow}>
            <span>Wave ({settings.massageLabDotFieldWaveAmplitude.toFixed(1)})</span>
            <input
              type="range"
              min="0"
              max="48"
              step="0.5"
              value={settings.massageLabDotFieldWaveAmplitude}
              onChange={(event) => onSettingsChange({ massageLabDotFieldWaveAmplitude: Number(event.target.value) })}
              aria-label="MassageLab Dot Field wave amplitude"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-dot-grid") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.massageLabDotGridPaletteMode}
              onChange={(event) => onSettingsChange({
                massageLabDotGridPaletteMode: event.target.value as MassageLabDotGridPaletteMode,
              })}
              aria-label="MassageLab Dot Grid color mode"
            >
              <option value="source">Source violet</option>
              <option value="custom">Custom colors</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {settings.massageLabDotGridPaletteMode === "custom" ? (
            <>
              <label className={styles.colorRow}>
                <span>Base color</span>
                <input
                  type="color"
                  value={settings.massageLabDotGridBaseColor}
                  onChange={(event) => onSettingsChange({ massageLabDotGridBaseColor: event.target.value })}
                  aria-label="MassageLab Dot Grid base color"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Active color</span>
                <input
                  type="color"
                  value={settings.massageLabDotGridActiveColor}
                  onChange={(event) => onSettingsChange({ massageLabDotGridActiveColor: event.target.value })}
                  aria-label="MassageLab Dot Grid active color"
                />
              </label>
            </>
          ) : null}

          {settings.massageLabDotGridPaletteMode === "harmony" ? (
            <>
              <label className={styles.colorRow}>
                <span>Primary color</span>
                <input
                  type="color"
                  value={settings.massageLabDotGridPrimaryColor}
                  onChange={(event) => onSettingsChange({ massageLabDotGridPrimaryColor: event.target.value })}
                  aria-label="MassageLab Dot Grid primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={settings.massageLabDotGridHarmony}
                  onChange={(event) => onSettingsChange({
                    massageLabDotGridHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="MassageLab Dot Grid color harmony"
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
              checked={settings.massageLabDotGridCursorInteraction}
              onChange={(event) => onSettingsChange({ massageLabDotGridCursorInteraction: event.target.checked })}
              aria-label="MassageLab Dot Grid cursor interaction"
            />
          </label>

          <label className={styles.switchRow}>
            <span>Click shock</span>
            <input
              type="checkbox"
              checked={settings.massageLabDotGridClickShock}
              onChange={(event) => onSettingsChange({ massageLabDotGridClickShock: event.target.checked })}
              aria-label="MassageLab Dot Grid click shock"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Dot size ({settings.massageLabDotGridDotSize.toFixed(1)})</span>
            <input type="range" min="2" max="40" step="0.5" value={settings.massageLabDotGridDotSize} onChange={(event) => onSettingsChange({ massageLabDotGridDotSize: Number(event.target.value) })} aria-label="MassageLab Dot Grid dot size" />
          </label>
          <label className={styles.rangeRow}>
            <span>Gap ({settings.massageLabDotGridGap.toFixed(1)})</span>
            <input type="range" min="4" max="80" step="0.5" value={settings.massageLabDotGridGap} onChange={(event) => onSettingsChange({ massageLabDotGridGap: Number(event.target.value) })} aria-label="MassageLab Dot Grid gap" />
          </label>
          <label className={styles.rangeRow}>
            <span>Proximity ({settings.massageLabDotGridProximity.toFixed(0)})</span>
            <input type="range" min="40" max="500" step="5" value={settings.massageLabDotGridProximity} onChange={(event) => onSettingsChange({ massageLabDotGridProximity: Number(event.target.value) })} aria-label="MassageLab Dot Grid proximity" />
          </label>
          <label className={styles.rangeRow}>
            <span>Speed trigger ({settings.massageLabDotGridSpeedTrigger.toFixed(0)})</span>
            <input type="range" min="0" max="1000" step="10" value={settings.massageLabDotGridSpeedTrigger} onChange={(event) => onSettingsChange({ massageLabDotGridSpeedTrigger: Number(event.target.value) })} aria-label="MassageLab Dot Grid speed trigger" />
          </label>
          <label className={styles.rangeRow}>
            <span>Shock radius ({settings.massageLabDotGridShockRadius.toFixed(0)})</span>
            <input type="range" min="40" max="700" step="10" value={settings.massageLabDotGridShockRadius} onChange={(event) => onSettingsChange({ massageLabDotGridShockRadius: Number(event.target.value) })} aria-label="MassageLab Dot Grid shock radius" />
          </label>
          <label className={styles.rangeRow}>
            <span>Shock strength ({settings.massageLabDotGridShockStrength.toFixed(1)})</span>
            <input type="range" min="0" max="12" step="0.1" value={settings.massageLabDotGridShockStrength} onChange={(event) => onSettingsChange({ massageLabDotGridShockStrength: Number(event.target.value) })} aria-label="MassageLab Dot Grid shock strength" />
          </label>
          <label className={styles.rangeRow}>
            <span>Max speed ({settings.massageLabDotGridMaxSpeed.toFixed(0)})</span>
            <input type="range" min="100" max="8000" step="100" value={settings.massageLabDotGridMaxSpeed} onChange={(event) => onSettingsChange({ massageLabDotGridMaxSpeed: Number(event.target.value) })} aria-label="MassageLab Dot Grid max speed" />
          </label>
          <label className={styles.rangeRow}>
            <span>Resistance ({settings.massageLabDotGridResistance.toFixed(0)})</span>
            <input type="range" min="120" max="1600" step="20" value={settings.massageLabDotGridResistance} onChange={(event) => onSettingsChange({ massageLabDotGridResistance: Number(event.target.value) })} aria-label="MassageLab Dot Grid resistance" />
          </label>
          <label className={styles.rangeRow}>
            <span>Return ({settings.massageLabDotGridReturnDuration.toFixed(2)}s)</span>
            <input type="range" min="0.1" max="4" step="0.05" value={settings.massageLabDotGridReturnDuration} onChange={(event) => onSettingsChange({ massageLabDotGridReturnDuration: Number(event.target.value) })} aria-label="MassageLab Dot Grid return duration" />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-threads") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.massageLabThreadsPaletteMode}
              onChange={(event) => onSettingsChange({
                massageLabThreadsPaletteMode: event.target.value as MassageLabThreadsPaletteMode,
              })}
              aria-label="MassageLab Threads color mode"
            >
              <option value="source">Source white</option>
              <option value="custom">Custom color</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {settings.massageLabThreadsPaletteMode === "custom" ? (
            <label className={styles.colorRow}>
              <span>Thread color</span>
              <input
                type="color"
                value={settings.massageLabThreadsColor}
                onChange={(event) => onSettingsChange({ massageLabThreadsColor: event.target.value })}
                aria-label="MassageLab Threads color"
              />
            </label>
          ) : null}

          {settings.massageLabThreadsPaletteMode === "harmony" ? (
            <>
              <label className={styles.colorRow}>
                <span>Primary color</span>
                <input
                  type="color"
                  value={settings.massageLabThreadsPrimaryColor}
                  onChange={(event) => onSettingsChange({ massageLabThreadsPrimaryColor: event.target.value })}
                  aria-label="MassageLab Threads primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={settings.massageLabThreadsHarmony}
                  onChange={(event) => onSettingsChange({
                    massageLabThreadsHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="MassageLab Threads color harmony"
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
              checked={settings.massageLabThreadsEnableMouseInteraction}
              onChange={(event) => onSettingsChange({
                massageLabThreadsEnableMouseInteraction: event.target.checked,
              })}
              aria-label="MassageLab Threads mouse interaction"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Amplitude ({settings.massageLabThreadsAmplitude.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={settings.massageLabThreadsAmplitude}
              onChange={(event) => onSettingsChange({ massageLabThreadsAmplitude: Number(event.target.value) })}
              aria-label="MassageLab Threads amplitude"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Distance ({settings.massageLabThreadsDistance.toFixed(2)})</span>
            <input
              type="range"
              min="-1"
              max="1.5"
              step="0.05"
              value={settings.massageLabThreadsDistance}
              onChange={(event) => onSettingsChange({ massageLabThreadsDistance: Number(event.target.value) })}
              aria-label="MassageLab Threads distance"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-iridescence") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.massageLabIridescencePaletteMode}
              onChange={(event) => onSettingsChange({
                massageLabIridescencePaletteMode: event.target.value as MassageLabIridescencePaletteMode,
              })}
              aria-label="MassageLab Iridescence color mode"
            >
              <option value="source">Source white</option>
              <option value="custom">Custom color</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {settings.massageLabIridescencePaletteMode === "custom" ? (
            <label className={styles.colorRow}>
              <span>Tint color</span>
              <input
                type="color"
                value={settings.massageLabIridescenceColor}
                onChange={(event) => onSettingsChange({ massageLabIridescenceColor: event.target.value })}
                aria-label="MassageLab Iridescence tint color"
              />
            </label>
          ) : null}

          {settings.massageLabIridescencePaletteMode === "harmony" ? (
            <>
              <label className={styles.colorRow}>
                <span>Primary color</span>
                <input
                  type="color"
                  value={settings.massageLabIridescencePrimaryColor}
                  onChange={(event) => onSettingsChange({ massageLabIridescencePrimaryColor: event.target.value })}
                  aria-label="MassageLab Iridescence primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={settings.massageLabIridescenceHarmony}
                  onChange={(event) => onSettingsChange({
                    massageLabIridescenceHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="MassageLab Iridescence color harmony"
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
              checked={settings.massageLabIridescenceMouseReact}
              onChange={(event) => onSettingsChange({
                massageLabIridescenceMouseReact: event.target.checked,
              })}
              aria-label="MassageLab Iridescence mouse reaction"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Speed ({settings.massageLabIridescenceSpeed.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={settings.massageLabIridescenceSpeed}
              onChange={(event) => onSettingsChange({ massageLabIridescenceSpeed: Number(event.target.value) })}
              aria-label="MassageLab Iridescence speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Amplitude ({settings.massageLabIridescenceAmplitude.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.massageLabIridescenceAmplitude}
              onChange={(event) => onSettingsChange({ massageLabIridescenceAmplitude: Number(event.target.value) })}
              aria-label="MassageLab Iridescence amplitude"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-waves") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Line color mode</span>
            <select
              value={settings.massageLabWavesPaletteMode}
              onChange={(event) => onSettingsChange({
                massageLabWavesPaletteMode: event.target.value as MassageLabWavesPaletteMode,
              })}
              aria-label="MassageLab Waves line color mode"
            >
              <option value="source">Source black</option>
              <option value="custom">Custom color</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {settings.massageLabWavesPaletteMode === "custom" ? (
            <label className={styles.colorRow}>
              <span>Line color</span>
              <input
                type="color"
                value={settings.massageLabWavesLineColor}
                onChange={(event) => onSettingsChange({ massageLabWavesLineColor: event.target.value })}
                aria-label="MassageLab Waves line color"
              />
            </label>
          ) : null}

          {settings.massageLabWavesPaletteMode === "harmony" ? (
            <>
              <label className={styles.colorRow}>
                <span>Primary color</span>
                <input
                  type="color"
                  value={settings.massageLabWavesPrimaryColor}
                  onChange={(event) => onSettingsChange({ massageLabWavesPrimaryColor: event.target.value })}
                  aria-label="MassageLab Waves primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={settings.massageLabWavesHarmony}
                  onChange={(event) => onSettingsChange({
                    massageLabWavesHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="MassageLab Waves color harmony"
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
              checked={settings.massageLabWavesTransparentBackground}
              onChange={(event) => onSettingsChange({
                massageLabWavesTransparentBackground: event.target.checked,
              })}
              aria-label="MassageLab Waves transparent background"
            />
          </label>

          {!settings.massageLabWavesTransparentBackground ? (
            <label className={styles.colorRow}>
              <span>Background color</span>
              <input
                type="color"
                value={settings.massageLabWavesBackgroundColor}
                onChange={(event) => onSettingsChange({ massageLabWavesBackgroundColor: event.target.value })}
                aria-label="MassageLab Waves background color"
              />
            </label>
          ) : null}

          <label className={styles.switchRow}>
            <span>Cursor interaction</span>
            <input
              type="checkbox"
              checked={settings.massageLabWavesCursorInteraction}
              onChange={(event) => onSettingsChange({
                massageLabWavesCursorInteraction: event.target.checked,
              })}
              aria-label="MassageLab Waves cursor interaction"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Wave speed X ({settings.massageLabWavesSpeedX.toFixed(4)})</span>
            <input
              type="range"
              min="0"
              max="0.05"
              step="0.0005"
              value={settings.massageLabWavesSpeedX}
              onChange={(event) => onSettingsChange({ massageLabWavesSpeedX: Number(event.target.value) })}
              aria-label="MassageLab Waves X speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Wave speed Y ({settings.massageLabWavesSpeedY.toFixed(4)})</span>
            <input
              type="range"
              min="0"
              max="0.05"
              step="0.0005"
              value={settings.massageLabWavesSpeedY}
              onChange={(event) => onSettingsChange({ massageLabWavesSpeedY: Number(event.target.value) })}
              aria-label="MassageLab Waves Y speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Amplitude X ({settings.massageLabWavesAmplitudeX.toFixed(0)})</span>
            <input
              type="range"
              min="0"
              max="96"
              step="1"
              value={settings.massageLabWavesAmplitudeX}
              onChange={(event) => onSettingsChange({ massageLabWavesAmplitudeX: Number(event.target.value) })}
              aria-label="MassageLab Waves X amplitude"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Amplitude Y ({settings.massageLabWavesAmplitudeY.toFixed(0)})</span>
            <input
              type="range"
              min="0"
              max="96"
              step="1"
              value={settings.massageLabWavesAmplitudeY}
              onChange={(event) => onSettingsChange({ massageLabWavesAmplitudeY: Number(event.target.value) })}
              aria-label="MassageLab Waves Y amplitude"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Line gap X ({settings.massageLabWavesGapX.toFixed(0)})</span>
            <input
              type="range"
              min="4"
              max="40"
              step="1"
              value={settings.massageLabWavesGapX}
              onChange={(event) => onSettingsChange({ massageLabWavesGapX: Number(event.target.value) })}
              aria-label="MassageLab Waves X gap"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Point gap Y ({settings.massageLabWavesGapY.toFixed(0)})</span>
            <input
              type="range"
              min="8"
              max="96"
              step="1"
              value={settings.massageLabWavesGapY}
              onChange={(event) => onSettingsChange({ massageLabWavesGapY: Number(event.target.value) })}
              aria-label="MassageLab Waves Y gap"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Friction ({settings.massageLabWavesFriction.toFixed(3)})</span>
            <input
              type="range"
              min="0.8"
              max="0.99"
              step="0.005"
              value={settings.massageLabWavesFriction}
              onChange={(event) => onSettingsChange({ massageLabWavesFriction: Number(event.target.value) })}
              aria-label="MassageLab Waves friction"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Tension ({settings.massageLabWavesTension.toFixed(3)})</span>
            <input
              type="range"
              min="0.001"
              max="0.05"
              step="0.001"
              value={settings.massageLabWavesTension}
              onChange={(event) => onSettingsChange({ massageLabWavesTension: Number(event.target.value) })}
              aria-label="MassageLab Waves tension"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Cursor movement ({settings.massageLabWavesMaxCursorMove.toFixed(0)})</span>
            <input
              type="range"
              min="0"
              max="240"
              step="5"
              value={settings.massageLabWavesMaxCursorMove}
              onChange={(event) => onSettingsChange({ massageLabWavesMaxCursorMove: Number(event.target.value) })}
              aria-label="MassageLab Waves max cursor movement"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-grid-distortion") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Texture color mode</span>
            <select
              value={settings.massageLabGridDistortionPaletteMode}
              onChange={(event) => onSettingsChange({
                massageLabGridDistortionPaletteMode: event.target.value as MassageLabGridDistortionPaletteMode,
              })}
              aria-label="MassageLab Grid Distortion color mode"
            >
              <option value="source">Source generated texture</option>
              <option value="custom">Custom colors</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {settings.massageLabGridDistortionPaletteMode === "custom" ? (
            <>
              <label className={styles.colorRow}>
                <span>Texture color 1</span>
                <input
                  type="color"
                  value={settings.massageLabGridDistortionColorOne}
                  onChange={(event) => onSettingsChange({ massageLabGridDistortionColorOne: event.target.value })}
                  aria-label="MassageLab Grid Distortion texture color 1"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Texture color 2</span>
                <input
                  type="color"
                  value={settings.massageLabGridDistortionColorTwo}
                  onChange={(event) => onSettingsChange({ massageLabGridDistortionColorTwo: event.target.value })}
                  aria-label="MassageLab Grid Distortion texture color 2"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Texture color 3</span>
                <input
                  type="color"
                  value={settings.massageLabGridDistortionColorThree}
                  onChange={(event) => onSettingsChange({ massageLabGridDistortionColorThree: event.target.value })}
                  aria-label="MassageLab Grid Distortion texture color 3"
                />
              </label>
            </>
          ) : null}

          {settings.massageLabGridDistortionPaletteMode === "harmony" ? (
            <>
              <label className={styles.colorRow}>
                <span>Primary color</span>
                <input
                  type="color"
                  value={settings.massageLabGridDistortionPrimaryColor}
                  onChange={(event) => onSettingsChange({ massageLabGridDistortionPrimaryColor: event.target.value })}
                  aria-label="MassageLab Grid Distortion primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={settings.massageLabGridDistortionHarmony}
                  onChange={(event) => onSettingsChange({
                    massageLabGridDistortionHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="MassageLab Grid Distortion color harmony"
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
              checked={settings.massageLabGridDistortionCursorInteraction}
              onChange={(event) => onSettingsChange({
                massageLabGridDistortionCursorInteraction: event.target.checked,
              })}
              aria-label="MassageLab Grid Distortion cursor interaction"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Grid ({settings.massageLabGridDistortionGrid.toFixed(0)})</span>
            <input
              type="range"
              min="4"
              max="40"
              step="1"
              value={settings.massageLabGridDistortionGrid}
              onChange={(event) => onSettingsChange({ massageLabGridDistortionGrid: Number(event.target.value) })}
              aria-label="MassageLab Grid Distortion grid"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Mouse radius ({settings.massageLabGridDistortionMouse.toFixed(2)})</span>
            <input
              type="range"
              min="0.02"
              max="0.5"
              step="0.01"
              value={settings.massageLabGridDistortionMouse}
              onChange={(event) => onSettingsChange({ massageLabGridDistortionMouse: Number(event.target.value) })}
              aria-label="MassageLab Grid Distortion mouse radius"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Strength ({settings.massageLabGridDistortionStrength.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="0.6"
              step="0.01"
              value={settings.massageLabGridDistortionStrength}
              onChange={(event) => onSettingsChange({ massageLabGridDistortionStrength: Number(event.target.value) })}
              aria-label="MassageLab Grid Distortion strength"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Relaxation ({settings.massageLabGridDistortionRelaxation.toFixed(2)})</span>
            <input
              type="range"
              min="0.75"
              max="0.99"
              step="0.01"
              value={settings.massageLabGridDistortionRelaxation}
              onChange={(event) => onSettingsChange({ massageLabGridDistortionRelaxation: Number(event.target.value) })}
              aria-label="MassageLab Grid Distortion relaxation"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-orb") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Orb color mode</span>
            <select
              value={settings.massageLabOrbPaletteMode}
              onChange={(event) => onSettingsChange({
                massageLabOrbPaletteMode: event.target.value as MassageLabOrbPaletteMode,
              })}
              aria-label="MassageLab Orb color mode"
            >
              <option value="source">Source hue</option>
              <option value="custom">Custom color</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {settings.massageLabOrbPaletteMode === "source" ? (
            <label className={styles.rangeRow}>
              <span>Hue ({settings.massageLabOrbHue.toFixed(0)})</span>
              <input
                type="range"
                min="0"
                max="360"
                step="1"
                value={settings.massageLabOrbHue}
                onChange={(event) => onSettingsChange({ massageLabOrbHue: Number(event.target.value) })}
                aria-label="MassageLab Orb hue"
              />
            </label>
          ) : null}

          {settings.massageLabOrbPaletteMode === "custom" ? (
            <label className={styles.colorRow}>
              <span>Orb color</span>
              <input
                type="color"
                value={settings.massageLabOrbColor}
                onChange={(event) => onSettingsChange({ massageLabOrbColor: event.target.value })}
                aria-label="MassageLab Orb color"
              />
            </label>
          ) : null}

          {settings.massageLabOrbPaletteMode === "harmony" ? (
            <>
              <label className={styles.colorRow}>
                <span>Primary color</span>
                <input
                  type="color"
                  value={settings.massageLabOrbPrimaryColor}
                  onChange={(event) => onSettingsChange({ massageLabOrbPrimaryColor: event.target.value })}
                  aria-label="MassageLab Orb primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={settings.massageLabOrbHarmony}
                  onChange={(event) => onSettingsChange({ massageLabOrbHarmony: event.target.value as ColorHarmony })}
                  aria-label="MassageLab Orb color harmony"
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

          <label className={styles.colorRow}>
            <span>Background</span>
            <input
              type="color"
              value={settings.massageLabOrbBackgroundColor}
              onChange={(event) => onSettingsChange({ massageLabOrbBackgroundColor: event.target.value })}
              aria-label="MassageLab Orb background color"
            />
          </label>

          <label className={styles.switchRow}>
            <span>Cursor interaction</span>
            <input
              type="checkbox"
              checked={settings.massageLabOrbCursorInteraction}
              onChange={(event) => onSettingsChange({ massageLabOrbCursorInteraction: event.target.checked })}
              aria-label="MassageLab Orb cursor interaction"
            />
          </label>

          <label className={styles.switchRow}>
            <span>Rotate on hover</span>
            <input
              type="checkbox"
              checked={settings.massageLabOrbRotateOnHover}
              onChange={(event) => onSettingsChange({ massageLabOrbRotateOnHover: event.target.checked })}
              aria-label="MassageLab Orb rotate on hover"
            />
          </label>

          <label className={styles.switchRow}>
            <span>Force hover state</span>
            <input
              type="checkbox"
              checked={settings.massageLabOrbForceHoverState}
              onChange={(event) => onSettingsChange({ massageLabOrbForceHoverState: event.target.checked })}
              aria-label="MassageLab Orb force hover state"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Hover intensity ({settings.massageLabOrbHoverIntensity.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.massageLabOrbHoverIntensity}
              onChange={(event) => onSettingsChange({ massageLabOrbHoverIntensity: Number(event.target.value) })}
              aria-label="MassageLab Orb hover intensity"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-letter-glitch") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Glitch color mode</span>
            <select
              value={settings.massageLabLetterGlitchPaletteMode}
              onChange={(event) => onSettingsChange({
                massageLabLetterGlitchPaletteMode: event.target.value as MassageLabLetterGlitchPaletteMode,
              })}
              aria-label="MassageLab Letter Glitch color mode"
            >
              <option value="source">Source colors</option>
              <option value="custom">Custom colors</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {settings.massageLabLetterGlitchPaletteMode === "custom" ? (
            <>
              <label className={styles.colorRow}>
                <span>Color 1</span>
                <input
                  type="color"
                  value={settings.massageLabLetterGlitchColorOne}
                  onChange={(event) => onSettingsChange({ massageLabLetterGlitchColorOne: event.target.value })}
                  aria-label="MassageLab Letter Glitch color 1"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Color 2</span>
                <input
                  type="color"
                  value={settings.massageLabLetterGlitchColorTwo}
                  onChange={(event) => onSettingsChange({ massageLabLetterGlitchColorTwo: event.target.value })}
                  aria-label="MassageLab Letter Glitch color 2"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Color 3</span>
                <input
                  type="color"
                  value={settings.massageLabLetterGlitchColorThree}
                  onChange={(event) => onSettingsChange({ massageLabLetterGlitchColorThree: event.target.value })}
                  aria-label="MassageLab Letter Glitch color 3"
                />
              </label>
            </>
          ) : null}

          {settings.massageLabLetterGlitchPaletteMode === "harmony" ? (
            <>
              <label className={styles.colorRow}>
                <span>Primary color</span>
                <input
                  type="color"
                  value={settings.massageLabLetterGlitchPrimaryColor}
                  onChange={(event) => onSettingsChange({ massageLabLetterGlitchPrimaryColor: event.target.value })}
                  aria-label="MassageLab Letter Glitch primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={settings.massageLabLetterGlitchHarmony}
                  onChange={(event) => onSettingsChange({
                    massageLabLetterGlitchHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="MassageLab Letter Glitch color harmony"
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

          <label className={styles.switchRow}>
            <span>Center vignette</span>
            <input
              type="checkbox"
              checked={settings.massageLabLetterGlitchCenterVignette}
              onChange={(event) => onSettingsChange({ massageLabLetterGlitchCenterVignette: event.target.checked })}
              aria-label="MassageLab Letter Glitch center vignette"
            />
          </label>

          <label className={styles.switchRow}>
            <span>Outer vignette</span>
            <input
              type="checkbox"
              checked={settings.massageLabLetterGlitchOuterVignette}
              onChange={(event) => onSettingsChange({ massageLabLetterGlitchOuterVignette: event.target.checked })}
              aria-label="MassageLab Letter Glitch outer vignette"
            />
          </label>

          <label className={styles.switchRow}>
            <span>Smooth colors</span>
            <input
              type="checkbox"
              checked={settings.massageLabLetterGlitchSmooth}
              onChange={(event) => onSettingsChange({ massageLabLetterGlitchSmooth: event.target.checked })}
              aria-label="MassageLab Letter Glitch smooth colors"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Glitch speed ({settings.massageLabLetterGlitchGlitchSpeed.toFixed(0)} ms)</span>
            <input
              type="range"
              min="16"
              max="500"
              step="1"
              value={settings.massageLabLetterGlitchGlitchSpeed}
              onChange={(event) => onSettingsChange({ massageLabLetterGlitchGlitchSpeed: Number(event.target.value) })}
              aria-label="MassageLab Letter Glitch speed"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-grid-motion") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Motion color mode</span>
            <select
              value={settings.massageLabGridMotionPaletteMode}
              onChange={(event) => onSettingsChange({
                massageLabGridMotionPaletteMode: event.target.value as MassageLabGridMotionPaletteMode,
              })}
              aria-label="MassageLab Grid Motion color mode"
            >
              <option value="source">Source colors</option>
              <option value="custom">Custom colors</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {settings.massageLabGridMotionPaletteMode === "custom" ? (
            <>
              <label className={styles.colorRow}>
                <span>Gradient</span>
                <input
                  type="color"
                  value={settings.massageLabGridMotionGradientColor}
                  onChange={(event) => onSettingsChange({ massageLabGridMotionGradientColor: event.target.value })}
                  aria-label="MassageLab Grid Motion gradient color"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Tile</span>
                <input
                  type="color"
                  value={settings.massageLabGridMotionTileColor}
                  onChange={(event) => onSettingsChange({ massageLabGridMotionTileColor: event.target.value })}
                  aria-label="MassageLab Grid Motion tile color"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Text</span>
                <input
                  type="color"
                  value={settings.massageLabGridMotionTextColor}
                  onChange={(event) => onSettingsChange({ massageLabGridMotionTextColor: event.target.value })}
                  aria-label="MassageLab Grid Motion text color"
                />
              </label>
            </>
          ) : null}

          {settings.massageLabGridMotionPaletteMode === "harmony" ? (
            <>
              <label className={styles.colorRow}>
                <span>Primary color</span>
                <input
                  type="color"
                  value={settings.massageLabGridMotionPrimaryColor}
                  onChange={(event) => onSettingsChange({ massageLabGridMotionPrimaryColor: event.target.value })}
                  aria-label="MassageLab Grid Motion primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={settings.massageLabGridMotionHarmony}
                  onChange={(event) => onSettingsChange({
                    massageLabGridMotionHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="MassageLab Grid Motion color harmony"
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

          <label className={styles.switchRow}>
            <span>Cursor interaction</span>
            <input
              type="checkbox"
              checked={settings.massageLabGridMotionCursorInteraction}
              onChange={(event) => onSettingsChange({ massageLabGridMotionCursorInteraction: event.target.checked })}
              aria-label="MassageLab Grid Motion cursor interaction"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Row travel ({settings.massageLabGridMotionMaxMoveAmount.toFixed(0)})</span>
            <input
              type="range"
              min="0"
              max="600"
              step="10"
              value={settings.massageLabGridMotionMaxMoveAmount}
              onChange={(event) => onSettingsChange({ massageLabGridMotionMaxMoveAmount: Number(event.target.value) })}
              aria-label="MassageLab Grid Motion row travel"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Ease duration ({settings.massageLabGridMotionBaseDuration.toFixed(2)}s)</span>
            <input
              type="range"
              min="0.1"
              max="2"
              step="0.05"
              value={settings.massageLabGridMotionBaseDuration}
              onChange={(event) => onSettingsChange({ massageLabGridMotionBaseDuration: Number(event.target.value) })}
              aria-label="MassageLab Grid Motion base duration"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-shape-grid") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Grid color mode</span>
            <select
              value={settings.massageLabShapeGridPaletteMode}
              onChange={(event) => onSettingsChange({
                massageLabShapeGridPaletteMode: event.target.value as MassageLabShapeGridPaletteMode,
              })}
              aria-label="MassageLab Shape Grid color mode"
            >
              <option value="source">Source colors</option>
              <option value="custom">Custom colors</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {settings.massageLabShapeGridPaletteMode === "custom" ? (
            <>
              <label className={styles.colorRow}>
                <span>Border</span>
                <input
                  type="color"
                  value={settings.massageLabShapeGridBorderColor}
                  onChange={(event) => onSettingsChange({ massageLabShapeGridBorderColor: event.target.value })}
                  aria-label="MassageLab Shape Grid border color"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Hover fill</span>
                <input
                  type="color"
                  value={settings.massageLabShapeGridHoverFillColor}
                  onChange={(event) => onSettingsChange({ massageLabShapeGridHoverFillColor: event.target.value })}
                  aria-label="MassageLab Shape Grid hover fill color"
                />
              </label>
            </>
          ) : null}

          {settings.massageLabShapeGridPaletteMode === "harmony" ? (
            <>
              <label className={styles.colorRow}>
                <span>Primary color</span>
                <input
                  type="color"
                  value={settings.massageLabShapeGridPrimaryColor}
                  onChange={(event) => onSettingsChange({ massageLabShapeGridPrimaryColor: event.target.value })}
                  aria-label="MassageLab Shape Grid primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={settings.massageLabShapeGridHarmony}
                  onChange={(event) => onSettingsChange({
                    massageLabShapeGridHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="MassageLab Shape Grid color harmony"
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
              value={settings.massageLabShapeGridDirection}
              onChange={(event) => onSettingsChange({
                massageLabShapeGridDirection: event.target.value as ChimerSettings["massageLabShapeGridDirection"],
              })}
              aria-label="MassageLab Shape Grid direction"
            >
              <option value="right">Right</option>
              <option value="left">Left</option>
              <option value="up">Up</option>
              <option value="down">Down</option>
              <option value="diagonal">Diagonal</option>
            </select>
          </label>

          <label className={styles.selectRow}>
            <span>Shape</span>
            <select
              value={settings.massageLabShapeGridShape}
              onChange={(event) => onSettingsChange({
                massageLabShapeGridShape: event.target.value as ChimerSettings["massageLabShapeGridShape"],
              })}
              aria-label="MassageLab Shape Grid shape"
            >
              <option value="square">Square</option>
              <option value="circle">Circle</option>
              <option value="triangle">Triangle</option>
              <option value="hexagon">Hexagon</option>
            </select>
          </label>

          <label className={styles.switchRow}>
            <span>Cursor interaction</span>
            <input
              type="checkbox"
              checked={settings.massageLabShapeGridCursorInteraction}
              onChange={(event) => onSettingsChange({ massageLabShapeGridCursorInteraction: event.target.checked })}
              aria-label="MassageLab Shape Grid cursor interaction"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Speed ({settings.massageLabShapeGridSpeed.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="4"
              step="0.05"
              value={settings.massageLabShapeGridSpeed}
              onChange={(event) => onSettingsChange({ massageLabShapeGridSpeed: Number(event.target.value) })}
              aria-label="MassageLab Shape Grid speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Cell size ({settings.massageLabShapeGridSquareSize.toFixed(0)})</span>
            <input
              type="range"
              min="12"
              max="96"
              step="1"
              value={settings.massageLabShapeGridSquareSize}
              onChange={(event) => onSettingsChange({ massageLabShapeGridSquareSize: Number(event.target.value) })}
              aria-label="MassageLab Shape Grid cell size"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Hover trail ({settings.massageLabShapeGridHoverTrailAmount.toFixed(0)})</span>
            <input
              type="range"
              min="0"
              max="12"
              step="1"
              value={settings.massageLabShapeGridHoverTrailAmount}
              onChange={(event) => onSettingsChange({ massageLabShapeGridHoverTrailAmount: Number(event.target.value) })}
              aria-label="MassageLab Shape Grid hover trail"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-liquid-chrome") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Chrome color mode</span>
            <select
              value={settings.massageLabLiquidChromePaletteMode}
              onChange={(event) => onSettingsChange({
                massageLabLiquidChromePaletteMode: event.target.value as MassageLabLiquidChromePaletteMode,
              })}
              aria-label="MassageLab Liquid Chrome color mode"
            >
              <option value="source">Source base color</option>
              <option value="custom">Custom color</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {settings.massageLabLiquidChromePaletteMode === "custom" ? (
            <label className={styles.colorRow}>
              <span>Base color</span>
              <input
                type="color"
                value={settings.massageLabLiquidChromeBaseColor}
                onChange={(event) => onSettingsChange({ massageLabLiquidChromeBaseColor: event.target.value })}
                aria-label="MassageLab Liquid Chrome base color"
              />
            </label>
          ) : null}

          {settings.massageLabLiquidChromePaletteMode === "harmony" ? (
            <>
              <label className={styles.colorRow}>
                <span>Primary color</span>
                <input
                  type="color"
                  value={settings.massageLabLiquidChromePrimaryColor}
                  onChange={(event) => onSettingsChange({ massageLabLiquidChromePrimaryColor: event.target.value })}
                  aria-label="MassageLab Liquid Chrome primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={settings.massageLabLiquidChromeHarmony}
                  onChange={(event) => onSettingsChange({
                    massageLabLiquidChromeHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="MassageLab Liquid Chrome color harmony"
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

          <label className={styles.switchRow}>
            <span>Cursor interaction</span>
            <input
              type="checkbox"
              checked={settings.massageLabLiquidChromeInteractive}
              onChange={(event) => onSettingsChange({ massageLabLiquidChromeInteractive: event.target.checked })}
              aria-label="MassageLab Liquid Chrome cursor interaction"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Speed ({settings.massageLabLiquidChromeSpeed.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.01"
              value={settings.massageLabLiquidChromeSpeed}
              onChange={(event) => onSettingsChange({ massageLabLiquidChromeSpeed: Number(event.target.value) })}
              aria-label="MassageLab Liquid Chrome speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Amplitude ({settings.massageLabLiquidChromeAmplitude.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.massageLabLiquidChromeAmplitude}
              onChange={(event) => onSettingsChange({ massageLabLiquidChromeAmplitude: Number(event.target.value) })}
              aria-label="MassageLab Liquid Chrome amplitude"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Frequency X ({settings.massageLabLiquidChromeFrequencyX.toFixed(1)})</span>
            <input
              type="range"
              min="0.1"
              max="12"
              step="0.1"
              value={settings.massageLabLiquidChromeFrequencyX}
              onChange={(event) => onSettingsChange({ massageLabLiquidChromeFrequencyX: Number(event.target.value) })}
              aria-label="MassageLab Liquid Chrome frequency X"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Frequency Y ({settings.massageLabLiquidChromeFrequencyY.toFixed(1)})</span>
            <input
              type="range"
              min="0.1"
              max="12"
              step="0.1"
              value={settings.massageLabLiquidChromeFrequencyY}
              onChange={(event) => onSettingsChange({ massageLabLiquidChromeFrequencyY: Number(event.target.value) })}
              aria-label="MassageLab Liquid Chrome frequency Y"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-balatro") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Balatro color mode</span>
            <select
              value={settings.massageLabBalatroPaletteMode}
              onChange={(event) => onSettingsChange({
                massageLabBalatroPaletteMode: event.target.value as MassageLabBalatroPaletteMode,
              })}
              aria-label="MassageLab Balatro color mode"
            >
              <option value="source">Source colors</option>
              <option value="custom">Custom colors</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {settings.massageLabBalatroPaletteMode === "custom" ? (
            <>
              <label className={styles.colorRow}>
                <span>Color 1</span>
                <input
                  type="color"
                  value={settings.massageLabBalatroColorOne}
                  onChange={(event) => onSettingsChange({ massageLabBalatroColorOne: event.target.value })}
                  aria-label="MassageLab Balatro color 1"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Color 2</span>
                <input
                  type="color"
                  value={settings.massageLabBalatroColorTwo}
                  onChange={(event) => onSettingsChange({ massageLabBalatroColorTwo: event.target.value })}
                  aria-label="MassageLab Balatro color 2"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Color 3</span>
                <input
                  type="color"
                  value={settings.massageLabBalatroColorThree}
                  onChange={(event) => onSettingsChange({ massageLabBalatroColorThree: event.target.value })}
                  aria-label="MassageLab Balatro color 3"
                />
              </label>
            </>
          ) : null}

          {settings.massageLabBalatroPaletteMode === "harmony" ? (
            <>
              <label className={styles.colorRow}>
                <span>Primary color</span>
                <input
                  type="color"
                  value={settings.massageLabBalatroPrimaryColor}
                  onChange={(event) => onSettingsChange({ massageLabBalatroPrimaryColor: event.target.value })}
                  aria-label="MassageLab Balatro primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={settings.massageLabBalatroHarmony}
                  onChange={(event) => onSettingsChange({ massageLabBalatroHarmony: event.target.value as ColorHarmony })}
                  aria-label="MassageLab Balatro color harmony"
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

          <label className={styles.switchRow}>
            <span>Mouse interaction</span>
            <input
              type="checkbox"
              checked={settings.massageLabBalatroMouseInteraction}
              onChange={(event) => onSettingsChange({ massageLabBalatroMouseInteraction: event.target.checked })}
              aria-label="MassageLab Balatro mouse interaction"
            />
          </label>

          <label className={styles.switchRow}>
            <span>Rotate field</span>
            <input
              type="checkbox"
              checked={settings.massageLabBalatroIsRotate}
              onChange={(event) => onSettingsChange({ massageLabBalatroIsRotate: event.target.checked })}
              aria-label="MassageLab Balatro rotate field"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Spin speed ({settings.massageLabBalatroSpinSpeed.toFixed(1)})</span>
            <input
              type="range"
              min="0"
              max="14"
              step="0.1"
              value={settings.massageLabBalatroSpinSpeed}
              onChange={(event) => onSettingsChange({ massageLabBalatroSpinSpeed: Number(event.target.value) })}
              aria-label="MassageLab Balatro spin speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Spin rotation ({settings.massageLabBalatroSpinRotation.toFixed(1)})</span>
            <input
              type="range"
              min="-8"
              max="8"
              step="0.1"
              value={settings.massageLabBalatroSpinRotation}
              onChange={(event) => onSettingsChange({ massageLabBalatroSpinRotation: Number(event.target.value) })}
              aria-label="MassageLab Balatro spin rotation"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Contrast ({settings.massageLabBalatroContrast.toFixed(1)})</span>
            <input
              type="range"
              min="0.5"
              max="8"
              step="0.1"
              value={settings.massageLabBalatroContrast}
              onChange={(event) => onSettingsChange({ massageLabBalatroContrast: Number(event.target.value) })}
              aria-label="MassageLab Balatro contrast"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Lighting ({settings.massageLabBalatroLighting.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.massageLabBalatroLighting}
              onChange={(event) => onSettingsChange({ massageLabBalatroLighting: Number(event.target.value) })}
              aria-label="MassageLab Balatro lighting"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Spin amount ({settings.massageLabBalatroSpinAmount.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={settings.massageLabBalatroSpinAmount}
              onChange={(event) => onSettingsChange({ massageLabBalatroSpinAmount: Number(event.target.value) })}
              aria-label="MassageLab Balatro spin amount"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Pixel filter ({settings.massageLabBalatroPixelFilter.toFixed(0)})</span>
            <input
              type="range"
              min="120"
              max="1200"
              step="5"
              value={settings.massageLabBalatroPixelFilter}
              onChange={(event) => onSettingsChange({ massageLabBalatroPixelFilter: Number(event.target.value) })}
              aria-label="MassageLab Balatro pixel filter"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Spin ease ({settings.massageLabBalatroSpinEase.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.01"
              value={settings.massageLabBalatroSpinEase}
              onChange={(event) => onSettingsChange({ massageLabBalatroSpinEase: Number(event.target.value) })}
              aria-label="MassageLab Balatro spin ease"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-photon-beam") {
      const useCustomPalette = settings.massageLabPhotonBeamPaletteMode === "custom"
      const photonSpeed = getMassageLabPhotonBeamDisplaySpeed(settings.massageLabPhotonBeamSpeedGlobal)

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.massageLabPhotonBeamPaletteMode}
              onChange={(event) => onSettingsChange({
                massageLabPhotonBeamPaletteMode: event.target.value as MassageLabPhotonBeamPaletteMode,
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
                  value={settings.massageLabPhotonBeamColorBg}
                  onChange={(event) => onSettingsChange({ massageLabPhotonBeamColorBg: event.target.value })}
                  aria-label="Photon Beam background color"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Beam lines</span>
                <input
                  type="color"
                  value={settings.massageLabPhotonBeamColorLine}
                  onChange={(event) => onSettingsChange({ massageLabPhotonBeamColorLine: event.target.value })}
                  aria-label="Photon Beam line color"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Signal 1</span>
                <input
                  type="color"
                  value={settings.massageLabPhotonBeamColorSignal}
                  onChange={(event) => onSettingsChange({ massageLabPhotonBeamColorSignal: event.target.value })}
                  aria-label="Photon Beam signal color"
                />
              </label>
              <label className={styles.switchRow}>
                <span>Signal 2</span>
                <input
                  type="checkbox"
                  checked={settings.massageLabPhotonBeamUseColor2}
                  onChange={(event) => onSettingsChange({ massageLabPhotonBeamUseColor2: event.target.checked })}
                  aria-label="Photon Beam use second signal color"
                />
              </label>
              {settings.massageLabPhotonBeamUseColor2 && (
                <label className={styles.colorRow}>
                  <span>Signal 2 color</span>
                  <input
                    type="color"
                    value={settings.massageLabPhotonBeamColorSignal2}
                    onChange={(event) => onSettingsChange({ massageLabPhotonBeamColorSignal2: event.target.value })}
                    aria-label="Photon Beam second signal color"
                  />
                </label>
              )}
              <label className={styles.switchRow}>
                <span>Signal 3</span>
                <input
                  type="checkbox"
                  checked={settings.massageLabPhotonBeamUseColor3}
                  onChange={(event) => onSettingsChange({ massageLabPhotonBeamUseColor3: event.target.checked })}
                  aria-label="Photon Beam use third signal color"
                />
              </label>
              {settings.massageLabPhotonBeamUseColor3 && (
                <label className={styles.colorRow}>
                  <span>Signal 3 color</span>
                  <input
                    type="color"
                    value={settings.massageLabPhotonBeamColorSignal3}
                    onChange={(event) => onSettingsChange({ massageLabPhotonBeamColorSignal3: event.target.value })}
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
                  value={settings.massageLabPhotonBeamPrimaryColor}
                  onChange={(event) => onSettingsChange({ massageLabPhotonBeamPrimaryColor: event.target.value })}
                  aria-label="Photon Beam primary color"
                />
              </label>

              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={settings.massageLabPhotonBeamHarmony}
                  onChange={(event) => onSettingsChange({
                    massageLabPhotonBeamHarmony: event.target.value as ColorHarmony,
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
              min={MASSAGE_LAB_PHOTON_BEAM_DISPLAY_SPEED_MIN}
              max={MASSAGE_LAB_PHOTON_BEAM_DISPLAY_SPEED_MAX}
              step={MASSAGE_LAB_PHOTON_BEAM_DISPLAY_SPEED_STEP}
              value={photonSpeed}
              onChange={(event) => onSettingsChange({
                massageLabPhotonBeamSpeedGlobal: getMassageLabPhotonBeamSourceSpeed(Number(event.target.value)),
              })}
              aria-label="Photon Beam animation speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Lines ({settings.massageLabPhotonBeamLineCount})</span>
            <input
              type="range"
              min="12"
              max="160"
              step="1"
              value={settings.massageLabPhotonBeamLineCount}
              onChange={(event) => onSettingsChange({ massageLabPhotonBeamLineCount: Number(event.target.value) })}
              aria-label="Photon Beam line count"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Signals ({settings.massageLabPhotonBeamSignalCount})</span>
            <input
              type="range"
              min="0"
              max="220"
              step="1"
              value={settings.massageLabPhotonBeamSignalCount}
              onChange={(event) => onSettingsChange({ massageLabPhotonBeamSignalCount: Number(event.target.value) })}
              aria-label="Photon Beam signal count"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Spread ({settings.massageLabPhotonBeamSpreadHeight.toFixed(0)})</span>
            <input
              type="range"
              min="5"
              max="90"
              step="1"
              value={settings.massageLabPhotonBeamSpreadHeight}
              onChange={(event) => onSettingsChange({ massageLabPhotonBeamSpreadHeight: Number(event.target.value) })}
              aria-label="Photon Beam spread height"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Depth ({settings.massageLabPhotonBeamSpreadDepth.toFixed(0)})</span>
            <input
              type="range"
              min="0"
              max="60"
              step="1"
              value={settings.massageLabPhotonBeamSpreadDepth}
              onChange={(event) => onSettingsChange({ massageLabPhotonBeamSpreadDepth: Number(event.target.value) })}
              aria-label="Photon Beam spread depth"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Trail length ({settings.massageLabPhotonBeamTrailLength})</span>
            <input
              type="range"
              min="1"
              max="16"
              step="1"
              value={settings.massageLabPhotonBeamTrailLength}
              onChange={(event) => onSettingsChange({ massageLabPhotonBeamTrailLength: Number(event.target.value) })}
              aria-label="Photon Beam trail length"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Line opacity ({Math.round(settings.massageLabPhotonBeamLineOpacity * 100)}%)</span>
            <input
              type="range"
              min="0.05"
              max="1"
              step="0.01"
              value={settings.massageLabPhotonBeamLineOpacity}
              onChange={(event) => onSettingsChange({ massageLabPhotonBeamLineOpacity: Number(event.target.value) })}
              aria-label="Photon Beam line opacity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Bloom strength ({settings.massageLabPhotonBeamBloomStrength.toFixed(1)})</span>
            <input
              type="range"
              min="0"
              max="6"
              step="0.1"
              value={settings.massageLabPhotonBeamBloomStrength}
              onChange={(event) => onSettingsChange({ massageLabPhotonBeamBloomStrength: Number(event.target.value) })}
              aria-label="Photon Beam bloom strength"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Bloom radius ({settings.massageLabPhotonBeamBloomRadius.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1.5"
              step="0.05"
              value={settings.massageLabPhotonBeamBloomRadius}
              onChange={(event) => onSettingsChange({ massageLabPhotonBeamBloomRadius: Number(event.target.value) })}
              aria-label="Photon Beam bloom radius"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Wave speed ({settings.massageLabPhotonBeamWaveSpeed.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="8"
              step="0.05"
              value={settings.massageLabPhotonBeamWaveSpeed}
              onChange={(event) => onSettingsChange({ massageLabPhotonBeamWaveSpeed: Number(event.target.value) })}
              aria-label="Photon Beam wave speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Wave height ({settings.massageLabPhotonBeamWaveHeight.toFixed(3)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.005"
              value={settings.massageLabPhotonBeamWaveHeight}
              onChange={(event) => onSettingsChange({ massageLabPhotonBeamWaveHeight: Number(event.target.value) })}
              aria-label="Photon Beam wave height"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Curve length ({settings.massageLabPhotonBeamCurveLength.toFixed(0)})</span>
            <input
              type="range"
              min="12"
              max="96"
              step="1"
              value={settings.massageLabPhotonBeamCurveLength}
              onChange={(event) => onSettingsChange({ massageLabPhotonBeamCurveLength: Number(event.target.value) })}
              aria-label="Photon Beam curve length"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Straight length ({settings.massageLabPhotonBeamStraightLength.toFixed(0)})</span>
            <input
              type="range"
              min="40"
              max="220"
              step="1"
              value={settings.massageLabPhotonBeamStraightLength}
              onChange={(event) => onSettingsChange({ massageLabPhotonBeamStraightLength: Number(event.target.value) })}
              aria-label="Photon Beam straight length"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Curve power ({settings.massageLabPhotonBeamCurvePower.toFixed(2)})</span>
            <input
              type="range"
              min="0.2"
              max="2"
              step="0.01"
              value={settings.massageLabPhotonBeamCurvePower}
              onChange={(event) => onSettingsChange({ massageLabPhotonBeamCurvePower: Number(event.target.value) })}
              aria-label="Photon Beam curve power"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-matrix-rain") {
      const useCustomPalette = settings.massageLabMatrixRainPaletteMode === "custom"
      const matrixRainSpeed = getMassageLabMatrixRainDisplaySpeed(settings.massageLabMatrixRainSpeed)

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.massageLabMatrixRainPaletteMode}
              onChange={(event) => onSettingsChange({
                massageLabMatrixRainPaletteMode: event.target.value as MassageLabMatrixRainPaletteMode,
              })}
              aria-label="Matrix Rain color mode"
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
                value={settings.massageLabMatrixRainColor}
                onChange={(event) => onSettingsChange({ massageLabMatrixRainColor: event.target.value })}
                aria-label="Matrix Rain character color"
              />
            </label>
          ) : (
            <>
              <label className={styles.colorRow}>
                <span>Primary color</span>
                <input
                  type="color"
                  value={settings.massageLabMatrixRainPrimaryColor}
                  onChange={(event) => onSettingsChange({ massageLabMatrixRainPrimaryColor: event.target.value })}
                  aria-label="Matrix Rain primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={settings.massageLabMatrixRainHarmony}
                  onChange={(event) => onSettingsChange({
                    massageLabMatrixRainHarmony: event.target.value as ColorHarmony,
                  })}
                  aria-label="Matrix Rain color harmony"
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
            <span>Animation speed ({matrixRainSpeed}%)</span>
            <input
              type="range"
              min={MASSAGE_LAB_HACKER_DISPLAY_SPEED_MIN}
              max={MASSAGE_LAB_HACKER_DISPLAY_SPEED_MAX}
              step={MASSAGE_LAB_HACKER_DISPLAY_SPEED_STEP}
              value={matrixRainSpeed}
              onChange={(event) => onSettingsChange({
                massageLabMatrixRainSpeed: getMassageLabMatrixRainSourceSpeed(Number(event.target.value)),
              })}
              aria-label="Matrix Rain animation speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Font size ({settings.massageLabMatrixRainFontSize}px)</span>
            <input
              type="range"
              min="8"
              max="28"
              step="1"
              value={settings.massageLabMatrixRainFontSize}
              onChange={(event) => onSettingsChange({ massageLabMatrixRainFontSize: Number(event.target.value) })}
              aria-label="Matrix Rain font size"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-novatrix") {
      const useCustomPalette = settings.massageLabNovatrixPaletteMode === "custom"
      const novatrixSpeed = getMassageLabNovatrixDisplaySpeed(settings.massageLabNovatrixSpeed)
      const novatrixAmplitude = getMassageLabNovatrixDisplayAmplitude(settings.massageLabNovatrixAmplitude)

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.massageLabNovatrixPaletteMode}
              onChange={(event) => onSettingsChange({
                massageLabNovatrixPaletteMode: event.target.value as MassageLabNovatrixPaletteMode,
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
                value={settings.massageLabNovatrixColor}
                onChange={(event) => onSettingsChange({ massageLabNovatrixColor: event.target.value })}
                aria-label="Novatrix animation color"
              />
            </label>
          ) : (
            <>
              <label className={styles.colorRow}>
                <span>Primary color</span>
                <input
                  type="color"
                  value={settings.massageLabNovatrixPrimaryColor}
                  onChange={(event) => onSettingsChange({ massageLabNovatrixPrimaryColor: event.target.value })}
                  aria-label="Novatrix primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={settings.massageLabNovatrixHarmony}
                  onChange={(event) => onSettingsChange({
                    massageLabNovatrixHarmony: event.target.value as ColorHarmony,
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
              min={MASSAGE_LAB_NOVATRIX_DISPLAY_SPEED_MIN}
              max={MASSAGE_LAB_NOVATRIX_DISPLAY_SPEED_MAX}
              step={MASSAGE_LAB_NOVATRIX_DISPLAY_SPEED_STEP}
              value={novatrixSpeed}
              onChange={(event) => onSettingsChange({
                massageLabNovatrixSpeed: getMassageLabNovatrixSourceSpeed(Number(event.target.value)),
              })}
              aria-label="Novatrix animation speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Amplitude ({novatrixAmplitude}%)</span>
            <input
              type="range"
              min={MASSAGE_LAB_NOVATRIX_DISPLAY_AMPLITUDE_MIN}
              max={MASSAGE_LAB_NOVATRIX_DISPLAY_AMPLITUDE_MAX}
              step={MASSAGE_LAB_NOVATRIX_DISPLAY_AMPLITUDE_STEP}
              value={novatrixAmplitude}
              onChange={(event) => onSettingsChange({
                massageLabNovatrixAmplitude: getMassageLabNovatrixSourceAmplitude(Number(event.target.value)),
              })}
              aria-label="Novatrix amplitude"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-synthesis") {
      const useCustomPalette = settings.massageLabSynthesisPaletteMode === "custom"
      const synthesisDisplaySpeed = getMassageLabSynthesisDisplaySpeed(settings.massageLabSynthesisSpeed)

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={settings.massageLabSynthesisPaletteMode}
              onChange={(event) => onSettingsChange({
                massageLabSynthesisPaletteMode: event.target.value as MassageLabSynthesisPaletteMode,
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
                  value={settings.massageLabSynthesisColorOne}
                  onChange={(event) => onSettingsChange({ massageLabSynthesisColorOne: event.target.value })}
                  aria-label="Synthesis color 1"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Color 2</span>
                <input
                  type="color"
                  value={settings.massageLabSynthesisColorTwo}
                  onChange={(event) => onSettingsChange({ massageLabSynthesisColorTwo: event.target.value })}
                  aria-label="Synthesis color 2"
                />
              </label>
              <label className={styles.colorRow}>
                <span>Color 3</span>
                <input
                  type="color"
                  value={settings.massageLabSynthesisColorThree}
                  onChange={(event) => onSettingsChange({ massageLabSynthesisColorThree: event.target.value })}
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
                  value={settings.massageLabSynthesisPrimaryColor}
                  onChange={(event) => onSettingsChange({ massageLabSynthesisPrimaryColor: event.target.value })}
                  aria-label="Synthesis primary color"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={settings.massageLabSynthesisHarmony}
                  onChange={(event) => onSettingsChange({
                    massageLabSynthesisHarmony: event.target.value as ColorHarmony,
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
              min={MASSAGE_LAB_SYNTHESIS_DISPLAY_SPEED_MIN}
              max={MASSAGE_LAB_SYNTHESIS_DISPLAY_SPEED_MAX}
              step={MASSAGE_LAB_SYNTHESIS_DISPLAY_SPEED_STEP}
              value={synthesisDisplaySpeed}
              onChange={(event) => onSettingsChange({
                massageLabSynthesisSpeed: getMassageLabSynthesisSourceSpeed(Number(event.target.value)),
              })}
              aria-label="Synthesis animation speed"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Complexity ({settings.massageLabSynthesisComplexity})</span>
            <input
              type="range"
              min="1"
              max="20"
              step="1"
              value={settings.massageLabSynthesisComplexity}
              onChange={(event) => onSettingsChange({ massageLabSynthesisComplexity: Number(event.target.value) })}
              aria-label="Synthesis complexity"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Zoom scale ({settings.massageLabSynthesisScale.toFixed(1)}x)</span>
            <input
              type="range"
              min="0.1"
              max="5"
              step="0.1"
              value={settings.massageLabSynthesisScale}
              onChange={(event) => onSettingsChange({ massageLabSynthesisScale: Number(event.target.value) })}
              aria-label="Synthesis zoom scale"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Distortion ({settings.massageLabSynthesisDistortion.toFixed(1)}x)</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={settings.massageLabSynthesisDistortion}
              onChange={(event) => onSettingsChange({ massageLabSynthesisDistortion: Number(event.target.value) })}
              aria-label="Synthesis distortion"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Glow intensity ({settings.massageLabSynthesisGlowIntensity.toFixed(1)}x)</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={settings.massageLabSynthesisGlowIntensity}
              onChange={(event) => onSettingsChange({ massageLabSynthesisGlowIntensity: Number(event.target.value) })}
              aria-label="Synthesis glow intensity"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Flow frequency ({settings.massageLabSynthesisFlowFrequency.toFixed(1)})</span>
            <input
              type="range"
              min="0.5"
              max="10"
              step="0.5"
              value={settings.massageLabSynthesisFlowFrequency}
              onChange={(event) => onSettingsChange({ massageLabSynthesisFlowFrequency: Number(event.target.value) })}
              aria-label="Synthesis flow frequency"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-reveal-dots") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.colorRow}>
            <span>Background</span>
            <input
              type="color"
              value={settings.canvasRevealDotsBackgroundColor}
              onChange={(event) => onSettingsChange({ canvasRevealDotsBackgroundColor: event.target.value })}
              aria-label="Reveal dots background color"
            />
          </label>
          <label className={styles.colorRow}>
            <span>Dot color</span>
            <input
              type="color"
              value={settings.canvasRevealDotsDotColor}
              onChange={(event) => onSettingsChange({ canvasRevealDotsDotColor: event.target.value })}
              aria-label="Reveal dots dot color"
            />
          </label>
          <label className={styles.colorRow}>
            <span>Accent</span>
            <input
              type="color"
              value={settings.canvasRevealDotsAccentColor}
              onChange={(event) => onSettingsChange({ canvasRevealDotsAccentColor: event.target.value })}
              aria-label="Reveal dots accent color"
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
              aria-label="Reveal dots dot size"
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
              aria-label="Reveal dots spacing"
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
              aria-label="Reveal dots opacity"
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
              aria-label="Reveal dots motion speed"
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

    if (option.id === "massage-lab-spotlight") {
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

    if (option.id === "massage-lab-lamp-effect") {
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

    if (option.id === "massage-lab-vortex") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.colorRow}>
            <span>Background</span>
            <input
              type="color"
              value={settings.vortexBackgroundColor}
              onChange={(event) => onSettingsChange({ vortexBackgroundColor: event.target.value })}
              aria-label="Vortex field color"
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
    <section
      ref={containerRef}
      className={styles.container}
      aria-labelledby="chimer-heading"
      onInput={handleNativeRangeInput}
    >
      <div className={styles.header}>
        <PageHeading>Chimer</PageHeading>
        <p className={styles.subtitle}>Massage session timer for treatment pacing, interval chimes, and full-screen clock visibility.</p>
      </div>

      {shouldShowSyncNotice && !syncNoticeDismissed && (
        <div
          className={`${styles.syncNotice} ${isSyncNoticeExiting ? styles.syncNoticeExiting : ""}`}
          data-app-bar-position={appShellSettings.appBarPosition}
        >
          <p>{syncMessage}</p>
          {syncStatus === "conflict" && (
            <div className={styles.syncActions}>
              <button
                type="button"
                className={`${styles.syncButton} ${styles.tactileButton}`}
                onClick={handleUseDeviceSettingsClick}
                disabled={isResolvingSync}
              >
                Keep this device settings
              </button>
              <button
                type="button"
                className={`${styles.syncButton} ${styles.tactileButton}`}
                onClick={handleUseSavedSettingsClick}
                disabled={isResolvingSync}
              >
                Use saved favorites
              </button>
            </div>
          )}
        </div>
      )}

      <div
        className={styles.proofCarousel}
        aria-label="Chimer massage session timer features"
        onPointerDown={handleProofCarouselPointerDown}
        onPointerUp={handleProofCarouselPointerUp}
        onPointerCancel={handleProofCarouselPointerCancel}
      >
        {timerProofs.map((proof, proofIndex) => {
          const Icon = proof.icon
          const active = proofIndex === activeProofIndex

          return (
            <div key={proof.title} className={styles.proofSlide} hidden={!active} aria-hidden={!active}>
              <div className={styles.proofCard}>
                <Icon className="h-4 w-4" aria-hidden="true" />
                <div>
                  <p className={styles.proofTitle}>{proof.title}</p>
                  <p className={styles.proofDescription}>{proof.description}</p>
                </div>
              </div>
            </div>
          )
        })}
        <div className={styles.proofDots} aria-label="Chimer feature slides">
          {timerProofs.map((proof, proofIndex) => (
            <button
              key={proof.title}
              type="button"
              className={styles.proofDot}
              data-active={proofIndex === activeProofIndex ? "true" : "false"}
              aria-label={`Chimer detail slide ${proofIndex + 1}`}
              aria-current={proofIndex === activeProofIndex}
              onClick={() => setActiveProofIndex(proofIndex)}
            />
          ))}
        </div>
      </div>

      <CTAButton
        type="button"
        variant="cta"
        className={styles.clockModeCtaButton}
        pressFeedback={false}
        onClick={withPress(onStartClock)}
      >
        <Clock className="h-5 w-5" />
        Clock Mode
      </CTAButton>

      <div className={styles.stepper}>
        <div className={styles.stepHeader}>
          {CHIMER_SETUP_STEPS.map((stepName, stepIndex) => (
            <button
              key={stepName}
              type="button"
              className={`
                ${styles.step}
                ${stepIndex === activeStep ? styles.stepActive : ""}
                ${isStepComplete(stepIndex) ? styles.stepComplete : ""}
              `}
              disabled={!canGoToStep(stepIndex)}
              onClick={withPress(() => setActiveStep(stepIndex))}
            >
              <span className={styles.stepIndex}>{stepIndex + 1}</span>
              <span className={styles.stepName}>{stepName}</span>
            </button>
          ))}
        </div>

        <div className={styles.currentStepHeader} aria-live="polite">
          <span className={styles.stepIndex}>{activeStep + 1}</span>
          <span className={styles.currentStepText}>
            <span className={styles.currentStepLabel}>
              Step {activeStep + 1} of {CHIMER_SETUP_STEPS.length}
            </span>
            <span className={styles.currentStepName}>{CHIMER_SETUP_STEPS[activeStep]}</span>
          </span>
        </div>

        <div className={styles.presetSelection}>
          <label className={styles.formGroup} htmlFor="chimer-setup-presets">
            <span>Saved setups</span>
            <select
              id="chimer-setup-presets"
              value={selectedPresetId}
              onChange={(event) => setSelectedPresetId(event.target.value)}
            >
              <option value="">Select a saved setup</option>
              {savedPresets.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.name}
                </option>
              ))}
            </select>
          </label>
          <div className={styles.presetSelectRow}>
            <button
              type="button"
              className={`${styles.secondaryButton} ${styles.tactileButton}`}
              onClick={withPress(applySelectedPreset)}
              disabled={!selectedPreset}
            >
              Apply selected
            </button>
            <button
              type="button"
              className={`${styles.secondaryButton} ${styles.tactileButton}`}
              onClick={withPress(loadLastSetup)}
              disabled={!lastSetupPreset}
            >
              Use last setup
            </button>
          </div>
        </div>

        <div className={styles.stepContent}>
          {activeStep === 0 && (
            <div>
              <div className={styles.formGroup}>
                <span>Session duration</span>
                <div
                  className={styles.clock}
                  role="group"
                  aria-label={`Session duration: ${formatDurationMinutes(settings.hours, settings.minutes)}`}
                >
                  <span className={`${styles.timerStatusBadge} ${isTimerSet ? styles.timerSet : styles.timerUnset}`}>
                    {isTimerSet ? "Set" : "Not set"}
                  </span>
                  <button
                    type="button"
                    className={`${styles.timeUnit} ${styles.timeUnitButton}`}
                    onClick={withPress(() => onTimeClick("hours"))}
                    aria-label={`Set hours. Current value ${settings.hours}.`}
                  >
                    {settings.hours.toString().padStart(2, "0")}
                  </button>
                  <span className={styles.colon} aria-hidden="true">:</span>
                  <button
                    type="button"
                    className={`${styles.timeUnit} ${styles.timeUnitButton}`}
                    onClick={withPress(() => onTimeClick("minutes"))}
                    aria-label={`Set minutes. Current value ${settings.minutes}.`}
                  >
                    {settings.minutes.toString().padStart(2, "0")}
                  </button>
                </div>
              </div>
              <p className={styles.presetSummary}>
                {`Total length: ${formatDurationMinutes(settings.hours, settings.minutes)}`}
              </p>
              <div className={styles.quickPresetGrid}>
                {QUICK_TIME_PRESETS_MINUTES.map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    className={`${styles.inlineButton} ${styles.tactileButton}`}
                    onClick={withPress(() => setQuickDuration(minutes))}
                  >
                    {minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h ${minutes % 60}m`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {activeStep === 1 && (
            <div>
              <label className={styles.formGroup} htmlFor="interval-mode">
                <span>Interval cue</span>
                <select
                  id="interval-mode"
                  value={stepIntervalMode}
                  onChange={(event) => {
                    const nextValue = event.target.value
                    if (nextValue === "none") {
                      setSkipIntervalCues(true)
                      return
                    }

                    setSkipIntervalCues(false)
                    onSettingsChange({ intervalType: nextValue as ChimerSettings["intervalType"] })
                  }}
                >
                  <option value="none">No interval</option>
                  <option value="preset">Common presets</option>
                  <option value="custom">Custom minutes</option>
                  <option value="areas">Divide by body areas</option>
                </select>
              </label>

              {!skipIntervalCues && (
                settings.intervalType === "areas" ? (
                  <NumberField
                    label="Body areas"
                    value={settings.areasToMassage}
                    min={1}
                    max={24}
                    step={1}
                    hapticsEnabled={hapticsEnabled}
                    onChange={(value) => onSettingsChange({ areasToMassage: value })}
                  />
                ) : (
                  settings.intervalType === "preset" ? (
                    <label className={styles.formGroup} htmlFor="custom-interval-input">
                      <span>Preset minutes</span>
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
                    </label>
                  ) : (
                    <NumberField
                      label="Custom minutes"
                      value={settings.customInterval}
                      min={1}
                      max={240}
                      step={1}
                      unit="m"
                      hapticsEnabled={hapticsEnabled}
                      onChange={(value) => onSettingsChange({ customInterval: value })}
                    />
                  )
                )
              )}
            </div>
          )}

          {activeStep === 2 && (
            <div>
              <label className={styles.formGroup} htmlFor="alert-type">
                <span>Notification</span>
                <select
                  id="alert-type"
                  value={settings.alertType}
                  onChange={(event) => onSettingsChange({ alertType: event.target.value as ChimerSettings["alertType"] })}
                >
                  {ALERT_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
              </label>

              <div className={styles.notificationControlStack}>
                {selectedAlertUsesSound ? (
                  <StyledRangeControl
                    label="Sound volume"
                    value={settings.alertVolume}
                    min={0}
                    max={1}
                    step={0.05}
                    displayValue={`${Math.round(settings.alertVolume * 100)}%`}
                    hapticsEnabled={hapticsEnabled}
                    onChange={(value) => onSettingsChange({ alertVolume: value })}
                  />
                ) : null}
                {selectedAlertUsesHaptics ? (
                  <StyledRangeControl
                    label="Haptic intensity"
                    value={settings.hapticIntensityMs}
                    min={10}
                    max={30}
                    step={1}
                    displayValue={`${settings.hapticIntensityMs}ms`}
                    hapticsEnabled={hapticsEnabled}
                    onChange={(value) => onSettingsChange({ hapticIntensityMs: value })}
                  />
                ) : null}
              </div>

              {!selectedAlertUsesSound && !selectedAlertUsesHaptics ? (
                <p className={styles.formHint}>
                  Silent keeps interval timing active without sound, flash, or haptic cues.
                </p>
              ) : null}
            </div>
          )}

          {activeStep === 3 && (
            <div>
              <div className={styles.backgroundSettings}>
                <StyledToggleControl
                  label="Visual background"
                  checked={settings.movingBackgroundEnabled}
                  hapticsEnabled={hapticsEnabled}
                  onCheckedChange={(value) => onSettingsChange({ movingBackgroundEnabled: value })}
                />
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
              <p className={styles.formHint}>
                Backgrounds are fully applied when timer starts. Use this section to set your preferred background and any per-background controls.
              </p>
            </div>
          )}

          {activeStep === 4 && (
            <div>
              <p className={styles.powerNotice}>
                “Chimer can use extra battery power, especially with animated backgrounds, sounds, haptics, and fullscreen mode.
                For the best experience on a phone, tablet, or laptop, plug in your device before starting so it does not lose power during the session.”
              </p>
              <div className={styles.presetSelection}>
                <label className={styles.formGroup} htmlFor="chimer-preset-name">
                  <span>Save this setup</span>
                  <input
                    id="chimer-preset-name"
                    type="text"
                    value={newPresetName}
                    onChange={(event) => setNewPresetName(event.target.value)}
                    placeholder="Preset name (optional)"
                  />
                </label>
                <button
                  type="button"
                  className={`${styles.secondaryButton} ${styles.tactileButton}`}
                  onClick={withPress(saveCurrentPreset)}
                  disabled={!isTimerSet}
                >
                  Save as preset
                </button>
              </div>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={`${styles.secondaryButton} ${styles.tactileButton}`}
                  onClick={withPress(onTestAlert)}
                >
                  Test Alert
                </button>
                <CTAButton
                  type="button"
                  withAttentionRing
                  className={styles.button}
                  onClick={withPress(() => handleStartTimer(false))}
                  disabled={!isTimerSet}
                >
                  <Play className="h-5 w-5" />
                  Start Chimer
                </CTAButton>
                <button
                  type="button"
                  className={`${styles.secondaryButton} ${styles.tactileButton}`}
                  onClick={withPress(() => handleStartTimer(true))}
                  disabled={!isTimerSet}
                >
                  Start without animated background
                </button>
              </div>
            </div>
          )}
        </div>

        <div className={styles.stepNavActions}>
          {activeStep > 0 && (
            <button
              type="button"
              className={`${styles.secondaryButton} ${styles.tactileButton}`}
              onClick={withPress(previousStep)}
            >
              Back
            </button>
          )}
          {!isFinalStep && (
            <MetalAttentionRing
              metalMode={canAdvanceStep ? "cycle" : "off"}
              metalFullWidth
            >
              <button
                type="button"
                className={`${styles.button} ${styles.tactileButton}`}
                onClick={withPress(nextStep)}
                disabled={!canAdvanceStep}
              >
                Continue
              </button>
            </MetalAttentionRing>
          )}
        </div>
      </div>

      {error && <p className={styles.error}>{error}</p>}
    </section>
  )
}
