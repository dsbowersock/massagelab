"use client"

import { type FormEvent as ReactFormEvent, type MouseEvent as ReactMouseEvent, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Clock, Minus, Play, Plus } from "lucide-react"
import { BackgroundSelector } from "@/components/backgrounds/BackgroundSelector"
import { backgroundPaletteRegistry } from "@/components/backgrounds/backgroundPaletteRegistry"
import type { BackgroundAccessSnapshot, BackgroundCategory, BackgroundDefinition, BackgroundId } from "@/components/backgrounds/backgroundRegistry"
import { Button } from "@/components/ui/button"
import { AcceleratingStepButton } from "@/components/ui/accelerating-step-button"
import { useSettings } from "@/components/providers/settings-provider"
import { withChimerPress } from "@/lib/chimer-press-handler"
import { CTAButton } from "@/components/chimer-controls/CTAButton"
import { MetalAttentionRing } from "@/components/ui/metal-attention-button"
import { NumberField } from "@/components/chimer-controls/NumberField"
import { StyledRangeControl } from "@/components/chimer-controls/StyledRangeControl"
import { StyledToggleControl } from "@/components/chimer-controls/StyledToggleControl"
import { DarkVeilResolutionScaleControl } from "@/components/chimer-controls/DarkVeilBackgroundControls"
import { getMassageLab3DGlobeScaleDisplayPercent, getMassageLab3DGlobeScaleFromDisplayPercent, getMassageLabShapeGridSpeedDisplayPercent, getMassageLabShapeGridSpeedFromDisplayPercent, parseGlobeCoordinateDraft, sanitizeChimerSettings } from "@/lib/chimer-timer"
import { normalizeSharedBackgroundVisualPreferences } from "@/lib/background-palette"
import { buildBackgroundVisualOpeningSnapshot, buildBackgroundVisualPendingCommit } from "@/lib/background-visual-draft"
import styles from "./set-timer.module.css"
import { GridMotionMantraEditor } from "./grid-motion-mantra-editor"
import { TileGridFadeTimeControl } from "./tile-grid-fade-time-control"

export { getMassageLab3DGlobeScaleDisplayPercent, getMassageLab3DGlobeScaleFromDisplayPercent, getMassageLabShapeGridSpeedDisplayPercent, getMassageLabShapeGridSpeedFromDisplayPercent }

const CHIMER_SETUP_PRESETS_STORAGE_KEY = "chimer-setup-presets-v1"
const CHIMER_LAST_SETUP_STORAGE_KEY = "chimer-last-setup-v1"
const MAX_CHIMER_SETUP_PRESETS = 12
const CHIMER_SETUP_STEPS = ["Enter time", "Choose interval", "Choose notification", "Choose background", "Start timer"] as const
// Resolve from the canonical label so reordering is safe, but fail fast if a
// later label edit would otherwise turn the background step into index -1.
export const CHIMER_BACKGROUND_SETUP_STEP_INDEX = CHIMER_SETUP_STEPS.indexOf("Choose background")
if (CHIMER_BACKGROUND_SETUP_STEP_INDEX === -1) {
  throw new Error('CHIMER_SETUP_STEPS must include a "Choose background" step')
}
const CHIMER_SETUP_STEP_SHORT_NAMES = ["Time", "Interval", "Alerts", "Visual", "Start"] as const
const SYNC_NOTICE_EXIT_DURATION_MS = 420

type ChimerSetupPresetState = Pick<ChimerSettings, "hours" | "minutes" | "intervalType" | "customInterval" | "areasToMassage" | "alertType" | "alertVolume" | "hapticIntensityMs" | "movingBackgroundEnabled" | "backgroundId"> & {
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
const createChimerSetupPresetState = (settings: ChimerSettings, skipIntervalCues = false): ChimerSetupPresetState => ({
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
      const intervalSkip = candidate.settings && typeof candidate.settings === "object" ? (typeof candidate.settings.skipIntervalCues === "boolean" ? candidate.settings.skipIntervalCues : false) : false
      return [
        {
          id: candidate.id,
          name: typeof candidate.name === "string" && candidate.name.trim().length > 0 ? candidate.name.trim() : "Saved setup",
          createdAt: Number.isFinite(candidate.createdAt as number) ? Number(candidate.createdAt) : Date.now(),
          settings: {
            ...createChimerSetupPresetState(sanitized as ChimerSettings),
            skipIntervalCues: intervalSkip,
          },
        },
      ]
    })

    return normalized.sort((left, right) => right.createdAt - left.createdAt).slice(0, MAX_CHIMER_SETUP_PRESETS)
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
    const parsedState = parsed as ChimerSetupPresetState & {
      skipIntervalCues?: unknown
    }
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

export type MassageLabPrismAnimationType = "rotate" | "3drotate" | "hover"
export type MassageLabLightPillarBlendMode = "screen" | "normal" | "lighten" | "plus-lighter"
export type MassageLabLightPillarQuality = "low" | "medium" | "high"
export type MassageLabFloatingLinesBlendMode = "screen" | "normal" | "lighten" | "plus-lighter"
export type MassageLabSideRaysOrigin = "top-right" | "top-left" | "bottom-right" | "bottom-left"
export type MassageLabLightRaysOrigin = "top-left" | "top-center" | "top-right" | "left" | "right" | "bottom-left" | "bottom-center" | "bottom-right"
export type MassageLabPixelBlastVariant = "square" | "circle" | "triangle" | "diamond"
export type MassageLabPlasmaDirection = "forward" | "reverse" | "pingpong"
export type MassageLabGradientBlindsShineDirection = "left" | "right"
export type MassageLabGradientBlindsBlendMode = "normal" | "screen" | "lighten" | "plus-lighter"
export type MassageLabGridScanLineStyle = "solid" | "dashed" | "dotted"
export type MassageLabGridScanDirection = "forward" | "backward" | "pingpong"
export type MassageLabPixelSnowVariant = "square" | "round" | "snowflake"
export type MassageLabPrismaticBurstAnimationType = "rotate" | "rotate3d" | "hover"
export type MassageLabPrismaticBurstMixBlendMode = "lighten" | "screen" | "none"

export const MASSAGE_LAB_ELECTRIC_MIST_DISPLAY_SPEED_MIN = 1
export const MASSAGE_LAB_ELECTRIC_MIST_DISPLAY_SPEED_MAX = 100
export const MASSAGE_LAB_ELECTRIC_MIST_DISPLAY_SPEED_STEP = 1
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
export const MASSAGE_LAB_CATALOG_CHROME_FLOW_SOURCE_SPEED_MIN = 0.001
export const MASSAGE_LAB_CATALOG_CHROME_FLOW_SOURCE_SPEED_MAX = 3
export const MASSAGE_LAB_CATALOG_CHROME_FLOW_DISPLAY_SPEED_MIN = 0.1
export const MASSAGE_LAB_CATALOG_CHROME_FLOW_DISPLAY_SPEED_MAX = 100
export const MASSAGE_LAB_CATALOG_CHROME_FLOW_DISPLAY_SPEED_STEP = 0.1
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
  const clampedSpeed = Math.min(MASSAGE_LAB_ASTRAL_FLOW_SOURCE_SPEED_MAX, Math.max(MASSAGE_LAB_ASTRAL_FLOW_SOURCE_SPEED_MIN, sourceSpeed))
  const sourceRange = MASSAGE_LAB_ASTRAL_FLOW_SOURCE_SPEED_MAX - MASSAGE_LAB_ASTRAL_FLOW_SOURCE_SPEED_MIN
  const displayRange = MASSAGE_LAB_ASTRAL_FLOW_DISPLAY_SPEED_MAX - MASSAGE_LAB_ASTRAL_FLOW_DISPLAY_SPEED_MIN
  return Math.round(MASSAGE_LAB_ASTRAL_FLOW_DISPLAY_SPEED_MIN + ((clampedSpeed - MASSAGE_LAB_ASTRAL_FLOW_SOURCE_SPEED_MIN) / sourceRange) * displayRange)
}

export function getMassageLabAstralFlowSourceSpeed(displaySpeed: number) {
  const clampedDisplay = Math.min(MASSAGE_LAB_ASTRAL_FLOW_DISPLAY_SPEED_MAX, Math.max(MASSAGE_LAB_ASTRAL_FLOW_DISPLAY_SPEED_MIN, displaySpeed))
  const sourceRange = MASSAGE_LAB_ASTRAL_FLOW_SOURCE_SPEED_MAX - MASSAGE_LAB_ASTRAL_FLOW_SOURCE_SPEED_MIN
  const displayRange = MASSAGE_LAB_ASTRAL_FLOW_DISPLAY_SPEED_MAX - MASSAGE_LAB_ASTRAL_FLOW_DISPLAY_SPEED_MIN
  return Math.round((MASSAGE_LAB_ASTRAL_FLOW_SOURCE_SPEED_MIN + ((clampedDisplay - MASSAGE_LAB_ASTRAL_FLOW_DISPLAY_SPEED_MIN) / displayRange) * sourceRange) * 1000) / 1000
}

// Deep Space Nebula stores the source shader multiplier, while the UI maps the
// MassageLab source range 0.1-5 to a 1%-100% slider.
export function getMassageLabDeepSpaceNebulaDisplaySpeed(sourceSpeed: number) {
  const clampedSpeed = Math.min(MASSAGE_LAB_DEEP_SPACE_NEBULA_SOURCE_SPEED_MAX, Math.max(MASSAGE_LAB_DEEP_SPACE_NEBULA_SOURCE_SPEED_MIN, sourceSpeed))
  const sourceRange = MASSAGE_LAB_DEEP_SPACE_NEBULA_SOURCE_SPEED_MAX - MASSAGE_LAB_DEEP_SPACE_NEBULA_SOURCE_SPEED_MIN
  const displayRange = MASSAGE_LAB_DEEP_SPACE_NEBULA_DISPLAY_SPEED_MAX - MASSAGE_LAB_DEEP_SPACE_NEBULA_DISPLAY_SPEED_MIN
  return Math.round(MASSAGE_LAB_DEEP_SPACE_NEBULA_DISPLAY_SPEED_MIN + ((clampedSpeed - MASSAGE_LAB_DEEP_SPACE_NEBULA_SOURCE_SPEED_MIN) / sourceRange) * displayRange)
}

export function getMassageLabDeepSpaceNebulaSourceSpeed(displaySpeed: number) {
  const clampedDisplay = Math.min(MASSAGE_LAB_DEEP_SPACE_NEBULA_DISPLAY_SPEED_MAX, Math.max(MASSAGE_LAB_DEEP_SPACE_NEBULA_DISPLAY_SPEED_MIN, displaySpeed))
  const sourceRange = MASSAGE_LAB_DEEP_SPACE_NEBULA_SOURCE_SPEED_MAX - MASSAGE_LAB_DEEP_SPACE_NEBULA_SOURCE_SPEED_MIN
  const displayRange = MASSAGE_LAB_DEEP_SPACE_NEBULA_DISPLAY_SPEED_MAX - MASSAGE_LAB_DEEP_SPACE_NEBULA_DISPLAY_SPEED_MIN
  return Math.round((MASSAGE_LAB_DEEP_SPACE_NEBULA_SOURCE_SPEED_MIN + ((clampedDisplay - MASSAGE_LAB_DEEP_SPACE_NEBULA_DISPLAY_SPEED_MIN) / displayRange) * sourceRange) * 1000) / 1000
}

// Grid Bloom stores the MassageLab shader multiplier, while users see 1%-100%.
export function getMassageLabGridBloomDisplaySpeed(sourceSpeed: number) {
  const clampedSpeed = Math.min(MASSAGE_LAB_GRID_BLOOM_SOURCE_SPEED_MAX, Math.max(MASSAGE_LAB_GRID_BLOOM_SOURCE_SPEED_MIN, sourceSpeed))
  const sourceRange = MASSAGE_LAB_GRID_BLOOM_SOURCE_SPEED_MAX - MASSAGE_LAB_GRID_BLOOM_SOURCE_SPEED_MIN
  const displayRange = MASSAGE_LAB_GRID_BLOOM_DISPLAY_SPEED_MAX - MASSAGE_LAB_GRID_BLOOM_DISPLAY_SPEED_MIN
  return Math.round(MASSAGE_LAB_GRID_BLOOM_DISPLAY_SPEED_MIN + ((clampedSpeed - MASSAGE_LAB_GRID_BLOOM_SOURCE_SPEED_MIN) / sourceRange) * displayRange)
}

export function getMassageLabGridBloomSourceSpeed(displaySpeed: number) {
  const clampedDisplay = Math.min(MASSAGE_LAB_GRID_BLOOM_DISPLAY_SPEED_MAX, Math.max(MASSAGE_LAB_GRID_BLOOM_DISPLAY_SPEED_MIN, displaySpeed))
  const sourceRange = MASSAGE_LAB_GRID_BLOOM_SOURCE_SPEED_MAX - MASSAGE_LAB_GRID_BLOOM_SOURCE_SPEED_MIN
  const displayRange = MASSAGE_LAB_GRID_BLOOM_DISPLAY_SPEED_MAX - MASSAGE_LAB_GRID_BLOOM_DISPLAY_SPEED_MIN
  return Math.round((MASSAGE_LAB_GRID_BLOOM_SOURCE_SPEED_MIN + ((clampedDisplay - MASSAGE_LAB_GRID_BLOOM_DISPLAY_SPEED_MIN) / displayRange) * sourceRange) * 1000) / 1000
}

// Liquid Chrome stores the source shader values; users see 1%-100% sliders.
export function getMassageLabChromeFlowDisplayFlowSpeed(sourceSpeed: number) {
  const clampedSpeed = Math.min(MASSAGE_LAB_LIQUID_CHROME_SOURCE_FLOW_SPEED_MAX, Math.max(MASSAGE_LAB_LIQUID_CHROME_SOURCE_FLOW_SPEED_MIN, sourceSpeed))
  const sourceRange = MASSAGE_LAB_LIQUID_CHROME_SOURCE_FLOW_SPEED_MAX - MASSAGE_LAB_LIQUID_CHROME_SOURCE_FLOW_SPEED_MIN
  const displayRange = MASSAGE_LAB_LIQUID_CHROME_DISPLAY_FLOW_SPEED_MAX - MASSAGE_LAB_LIQUID_CHROME_DISPLAY_FLOW_SPEED_MIN
  return Math.round(MASSAGE_LAB_LIQUID_CHROME_DISPLAY_FLOW_SPEED_MIN + ((clampedSpeed - MASSAGE_LAB_LIQUID_CHROME_SOURCE_FLOW_SPEED_MIN) / sourceRange) * displayRange)
}

export function getMassageLabChromeFlowSourceFlowSpeed(displaySpeed: number) {
  const clampedDisplay = Math.min(MASSAGE_LAB_LIQUID_CHROME_DISPLAY_FLOW_SPEED_MAX, Math.max(MASSAGE_LAB_LIQUID_CHROME_DISPLAY_FLOW_SPEED_MIN, displaySpeed))
  const sourceRange = MASSAGE_LAB_LIQUID_CHROME_SOURCE_FLOW_SPEED_MAX - MASSAGE_LAB_LIQUID_CHROME_SOURCE_FLOW_SPEED_MIN
  const displayRange = MASSAGE_LAB_LIQUID_CHROME_DISPLAY_FLOW_SPEED_MAX - MASSAGE_LAB_LIQUID_CHROME_DISPLAY_FLOW_SPEED_MIN
  return Math.round((MASSAGE_LAB_LIQUID_CHROME_SOURCE_FLOW_SPEED_MIN + ((clampedDisplay - MASSAGE_LAB_LIQUID_CHROME_DISPLAY_FLOW_SPEED_MIN) / displayRange) * sourceRange) * 1000) / 1000
}

// The catalog's Chrome Flow is the separate React Bits liquid-chrome renderer.
// A tenth-percent display scale makes its sub-0.01 source speeds selectable.
export function getMassageLabCatalogChromeFlowDisplaySpeed(sourceSpeed: number) {
  const clampedSpeed = Math.min(MASSAGE_LAB_CATALOG_CHROME_FLOW_SOURCE_SPEED_MAX, Math.max(MASSAGE_LAB_CATALOG_CHROME_FLOW_SOURCE_SPEED_MIN, sourceSpeed))
  const sourceRange = MASSAGE_LAB_CATALOG_CHROME_FLOW_SOURCE_SPEED_MAX - MASSAGE_LAB_CATALOG_CHROME_FLOW_SOURCE_SPEED_MIN
  const displayRange = MASSAGE_LAB_CATALOG_CHROME_FLOW_DISPLAY_SPEED_MAX - MASSAGE_LAB_CATALOG_CHROME_FLOW_DISPLAY_SPEED_MIN
  return Math.round((MASSAGE_LAB_CATALOG_CHROME_FLOW_DISPLAY_SPEED_MIN + ((clampedSpeed - MASSAGE_LAB_CATALOG_CHROME_FLOW_SOURCE_SPEED_MIN) / sourceRange) * displayRange) * 10) / 10
}

export function getMassageLabCatalogChromeFlowSourceSpeed(displaySpeed: number) {
  const clampedDisplay = Math.min(MASSAGE_LAB_CATALOG_CHROME_FLOW_DISPLAY_SPEED_MAX, Math.max(MASSAGE_LAB_CATALOG_CHROME_FLOW_DISPLAY_SPEED_MIN, displaySpeed))
  const sourceRange = MASSAGE_LAB_CATALOG_CHROME_FLOW_SOURCE_SPEED_MAX - MASSAGE_LAB_CATALOG_CHROME_FLOW_SOURCE_SPEED_MIN
  const displayRange = MASSAGE_LAB_CATALOG_CHROME_FLOW_DISPLAY_SPEED_MAX - MASSAGE_LAB_CATALOG_CHROME_FLOW_DISPLAY_SPEED_MIN
  return Math.round((MASSAGE_LAB_CATALOG_CHROME_FLOW_SOURCE_SPEED_MIN + ((clampedDisplay - MASSAGE_LAB_CATALOG_CHROME_FLOW_DISPLAY_SPEED_MIN) / displayRange) * sourceRange) * 1000) / 1000
}

export function getMassageLabChromeFlowDisplayTimeScale(sourceTimeScale: number) {
  const clampedTimeScale = Math.min(MASSAGE_LAB_LIQUID_CHROME_SOURCE_TIME_SCALE_MAX, Math.max(MASSAGE_LAB_LIQUID_CHROME_SOURCE_TIME_SCALE_MIN, sourceTimeScale))
  const sourceRange = MASSAGE_LAB_LIQUID_CHROME_SOURCE_TIME_SCALE_MAX - MASSAGE_LAB_LIQUID_CHROME_SOURCE_TIME_SCALE_MIN
  const displayRange = MASSAGE_LAB_LIQUID_CHROME_DISPLAY_TIME_SCALE_MAX - MASSAGE_LAB_LIQUID_CHROME_DISPLAY_TIME_SCALE_MIN
  return Math.round(MASSAGE_LAB_LIQUID_CHROME_DISPLAY_TIME_SCALE_MIN + ((clampedTimeScale - MASSAGE_LAB_LIQUID_CHROME_SOURCE_TIME_SCALE_MIN) / sourceRange) * displayRange)
}

export function getMassageLabChromeFlowSourceTimeScale(displayTimeScale: number) {
  const clampedDisplay = Math.min(MASSAGE_LAB_LIQUID_CHROME_DISPLAY_TIME_SCALE_MAX, Math.max(MASSAGE_LAB_LIQUID_CHROME_DISPLAY_TIME_SCALE_MIN, displayTimeScale))
  const sourceRange = MASSAGE_LAB_LIQUID_CHROME_SOURCE_TIME_SCALE_MAX - MASSAGE_LAB_LIQUID_CHROME_SOURCE_TIME_SCALE_MIN
  const displayRange = MASSAGE_LAB_LIQUID_CHROME_DISPLAY_TIME_SCALE_MAX - MASSAGE_LAB_LIQUID_CHROME_DISPLAY_TIME_SCALE_MIN
  return Math.round((MASSAGE_LAB_LIQUID_CHROME_SOURCE_TIME_SCALE_MIN + ((clampedDisplay - MASSAGE_LAB_LIQUID_CHROME_DISPLAY_TIME_SCALE_MIN) / displayRange) * sourceRange) * 1000) / 1000
}

// Waves stores the MassageLab source speed values; users see 1%-100%.
export function getMassageLabWaveCurrentDisplaySpeed(sourceSpeed: number) {
  const clampedSpeed = Math.min(MASSAGE_LAB_WAVES_SOURCE_SPEED_MAX, Math.max(MASSAGE_LAB_WAVES_SOURCE_SPEED_MIN, sourceSpeed))
  const sourceRange = MASSAGE_LAB_WAVES_SOURCE_SPEED_MAX - MASSAGE_LAB_WAVES_SOURCE_SPEED_MIN
  const displayRange = MASSAGE_LAB_WAVES_DISPLAY_SPEED_MAX - MASSAGE_LAB_WAVES_DISPLAY_SPEED_MIN
  return Math.round(MASSAGE_LAB_WAVES_DISPLAY_SPEED_MIN + ((clampedSpeed - MASSAGE_LAB_WAVES_SOURCE_SPEED_MIN) / sourceRange) * displayRange)
}

export function getMassageLabWaveCurrentSourceSpeed(displaySpeed: number) {
  const clampedDisplay = Math.min(MASSAGE_LAB_WAVES_DISPLAY_SPEED_MAX, Math.max(MASSAGE_LAB_WAVES_DISPLAY_SPEED_MIN, displaySpeed))
  const sourceRange = MASSAGE_LAB_WAVES_SOURCE_SPEED_MAX - MASSAGE_LAB_WAVES_SOURCE_SPEED_MIN
  const displayRange = MASSAGE_LAB_WAVES_DISPLAY_SPEED_MAX - MASSAGE_LAB_WAVES_DISPLAY_SPEED_MIN
  return Math.round((MASSAGE_LAB_WAVES_SOURCE_SPEED_MIN + ((clampedDisplay - MASSAGE_LAB_WAVES_DISPLAY_SPEED_MIN) / displayRange) * sourceRange) * 10000) / 10000
}

// Novatrix keeps MassageLab's source speed/amplitude values but presents simple
// percentages so the slowest slider positions are visibly calm.
export function getMassageLabNovatrixDisplaySpeed(sourceSpeed: number) {
  const clampedSpeed = Math.min(MASSAGE_LAB_NOVATRIX_SOURCE_SPEED_MAX, Math.max(MASSAGE_LAB_NOVATRIX_SOURCE_SPEED_MIN, sourceSpeed))
  const sourceRange = MASSAGE_LAB_NOVATRIX_SOURCE_SPEED_MAX - MASSAGE_LAB_NOVATRIX_SOURCE_SPEED_MIN
  const displayRange = MASSAGE_LAB_NOVATRIX_DISPLAY_SPEED_MAX - MASSAGE_LAB_NOVATRIX_DISPLAY_SPEED_MIN
  return Math.round(MASSAGE_LAB_NOVATRIX_DISPLAY_SPEED_MIN + ((clampedSpeed - MASSAGE_LAB_NOVATRIX_SOURCE_SPEED_MIN) / sourceRange) * displayRange)
}

export function getMassageLabNovatrixSourceSpeed(displaySpeed: number) {
  const clampedDisplay = Math.min(MASSAGE_LAB_NOVATRIX_DISPLAY_SPEED_MAX, Math.max(MASSAGE_LAB_NOVATRIX_DISPLAY_SPEED_MIN, displaySpeed))
  const sourceRange = MASSAGE_LAB_NOVATRIX_SOURCE_SPEED_MAX - MASSAGE_LAB_NOVATRIX_SOURCE_SPEED_MIN
  const displayRange = MASSAGE_LAB_NOVATRIX_DISPLAY_SPEED_MAX - MASSAGE_LAB_NOVATRIX_DISPLAY_SPEED_MIN
  return Math.round((MASSAGE_LAB_NOVATRIX_SOURCE_SPEED_MIN + ((clampedDisplay - MASSAGE_LAB_NOVATRIX_DISPLAY_SPEED_MIN) / displayRange) * sourceRange) * 1000) / 1000
}

export function getMassageLabNovatrixDisplayAmplitude(sourceAmplitude: number) {
  const clampedAmplitude = Math.min(MASSAGE_LAB_NOVATRIX_SOURCE_AMPLITUDE_MAX, Math.max(MASSAGE_LAB_NOVATRIX_SOURCE_AMPLITUDE_MIN, sourceAmplitude))
  const sourceRange = MASSAGE_LAB_NOVATRIX_SOURCE_AMPLITUDE_MAX - MASSAGE_LAB_NOVATRIX_SOURCE_AMPLITUDE_MIN
  const displayRange = MASSAGE_LAB_NOVATRIX_DISPLAY_AMPLITUDE_MAX - MASSAGE_LAB_NOVATRIX_DISPLAY_AMPLITUDE_MIN
  return Math.round(MASSAGE_LAB_NOVATRIX_DISPLAY_AMPLITUDE_MIN + ((clampedAmplitude - MASSAGE_LAB_NOVATRIX_SOURCE_AMPLITUDE_MIN) / sourceRange) * displayRange)
}

export function getMassageLabNovatrixSourceAmplitude(displayAmplitude: number) {
  const clampedDisplay = Math.min(MASSAGE_LAB_NOVATRIX_DISPLAY_AMPLITUDE_MAX, Math.max(MASSAGE_LAB_NOVATRIX_DISPLAY_AMPLITUDE_MIN, displayAmplitude))
  const sourceRange = MASSAGE_LAB_NOVATRIX_SOURCE_AMPLITUDE_MAX - MASSAGE_LAB_NOVATRIX_SOURCE_AMPLITUDE_MIN
  const displayRange = MASSAGE_LAB_NOVATRIX_DISPLAY_AMPLITUDE_MAX - MASSAGE_LAB_NOVATRIX_DISPLAY_AMPLITUDE_MIN
  return Math.round((MASSAGE_LAB_NOVATRIX_SOURCE_AMPLITUDE_MIN + ((clampedDisplay - MASSAGE_LAB_NOVATRIX_DISPLAY_AMPLITUDE_MIN) / displayRange) * sourceRange) * 1000) / 1000
}

// Matrix Rain stores MassageLab's source speed multiplier; the UI maps it to
// a 1%-100% slider with a deliberately slow low end.
export function getMassageLabMatrixRainDisplaySpeed(sourceSpeed: number) {
  const clampedSpeed = Math.min(MASSAGE_LAB_MATRIX_RAIN_SOURCE_SPEED_MAX, Math.max(MASSAGE_LAB_MATRIX_RAIN_SOURCE_SPEED_MIN, sourceSpeed))
  const sourceRange = MASSAGE_LAB_MATRIX_RAIN_SOURCE_SPEED_MAX - MASSAGE_LAB_MATRIX_RAIN_SOURCE_SPEED_MIN
  const displayRange = MASSAGE_LAB_HACKER_DISPLAY_SPEED_MAX - MASSAGE_LAB_HACKER_DISPLAY_SPEED_MIN
  return Math.round(MASSAGE_LAB_HACKER_DISPLAY_SPEED_MIN + ((clampedSpeed - MASSAGE_LAB_MATRIX_RAIN_SOURCE_SPEED_MIN) / sourceRange) * displayRange)
}

export function getMassageLabMatrixRainSourceSpeed(displaySpeed: number) {
  const clampedDisplay = Math.min(MASSAGE_LAB_HACKER_DISPLAY_SPEED_MAX, Math.max(MASSAGE_LAB_HACKER_DISPLAY_SPEED_MIN, displaySpeed))
  const sourceRange = MASSAGE_LAB_MATRIX_RAIN_SOURCE_SPEED_MAX - MASSAGE_LAB_MATRIX_RAIN_SOURCE_SPEED_MIN
  const displayRange = MASSAGE_LAB_HACKER_DISPLAY_SPEED_MAX - MASSAGE_LAB_HACKER_DISPLAY_SPEED_MIN
  return Math.round((MASSAGE_LAB_MATRIX_RAIN_SOURCE_SPEED_MIN + ((clampedDisplay - MASSAGE_LAB_HACKER_DISPLAY_SPEED_MIN) / displayRange) * sourceRange) * 1000) / 1000
}

// Photon Beam stores MassageLab's source speed multiplier while users see a
// consistent 1%-100% control alongside the other premium backgrounds.
export function getMassageLabPhotonBeamDisplaySpeed(sourceSpeed: number) {
  const clampedSpeed = Math.min(MASSAGE_LAB_PHOTON_BEAM_SOURCE_SPEED_MAX, Math.max(MASSAGE_LAB_PHOTON_BEAM_SOURCE_SPEED_MIN, sourceSpeed))
  const sourceRange = MASSAGE_LAB_PHOTON_BEAM_SOURCE_SPEED_MAX - MASSAGE_LAB_PHOTON_BEAM_SOURCE_SPEED_MIN
  const displayRange = MASSAGE_LAB_PHOTON_BEAM_DISPLAY_SPEED_MAX - MASSAGE_LAB_PHOTON_BEAM_DISPLAY_SPEED_MIN
  return Math.round(MASSAGE_LAB_PHOTON_BEAM_DISPLAY_SPEED_MIN + ((clampedSpeed - MASSAGE_LAB_PHOTON_BEAM_SOURCE_SPEED_MIN) / sourceRange) * displayRange)
}

export function getMassageLabPhotonBeamSourceSpeed(displaySpeed: number) {
  const clampedDisplay = Math.min(MASSAGE_LAB_PHOTON_BEAM_DISPLAY_SPEED_MAX, Math.max(MASSAGE_LAB_PHOTON_BEAM_DISPLAY_SPEED_MIN, displaySpeed))
  const sourceRange = MASSAGE_LAB_PHOTON_BEAM_SOURCE_SPEED_MAX - MASSAGE_LAB_PHOTON_BEAM_SOURCE_SPEED_MIN
  const displayRange = MASSAGE_LAB_PHOTON_BEAM_DISPLAY_SPEED_MAX - MASSAGE_LAB_PHOTON_BEAM_DISPLAY_SPEED_MIN
  return Math.round((MASSAGE_LAB_PHOTON_BEAM_SOURCE_SPEED_MIN + ((clampedDisplay - MASSAGE_LAB_PHOTON_BEAM_DISPLAY_SPEED_MIN) / displayRange) * sourceRange) * 1000) / 1000
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
  backgroundVisualPreferences: ReturnType<typeof normalizeSharedBackgroundVisualPreferences>
  keepTimerScreenAwake: boolean
  showClockDisplay: boolean
  clockRotationEnabled: boolean
  clockRotationRange: number
  clockRotationDuration: number
  clockForwardGlowEnabled: boolean
  clockForwardGlowStrength: number
  clockForwardGlowLength: number
  clockForwardGlowBlur: number
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
  sparklesMaxSize: number
  sparklesMinSize: number
  sparklesParticleDensity: number
  sparklesSpeed: number
  gradientAnimationSpeed: number
  gradientAnimationSize: number
  staticGradientType: "linear" | "radial"
  staticGradientColorCount: number
  staticGradientAngle: number
  staticGradientCenterX: number
  staticGradientCenterY: number
  staticGradientRadialShape: "circle" | "ellipse"
  staticGradientRadialSize: "closest-side" | "farthest-side" | "closest-corner" | "farthest-corner"
  staticGradientStopPositions: number[]
  massageLabGradientOpacity: number
  massageLabStarsSpeed: number
  massageLabStarsDensity: number
  massageLabStarsParallax: number
  massageLabHoleLineCount: number
  massageLabHoleDiscCount: number
  massageLabLightSpeedWarpSpeed: number
  massageLabLightSpeedWarpSpeedVersion: number
  massageLabLightSpeedParticleCount: number
  massageLabLightSpeedIntensity: number
  massageLabLightSpeedRadius: number
  massageLabLightSpeedCylinderLength: number
  massageLabElectricMistSpeed: number
  massageLabElectricMistControlVersion: number
  massageLabElectricMistDetail: number
  massageLabElectricMistDistortion: number
  massageLabElectricMistBrightness: number
  massageLabAstralFlowSpeed: number
  massageLabAstralFlowFlowMin: number
  massageLabAstralFlowFlowMax: number
  massageLabDeepSpaceNebulaSpeed: number
  massageLabGridBloomSpeed: number
  massageLabGridBloomGridScale: number
  massageLabGridBloomRotationSpeed: number
  massageLabGridBloomFadeFalloff: number
  massageLabGridBloomDistortionAmount: number
  massageLabGridBloomFlowSpeedX: number
  massageLabGridBloomFlowSpeedY: number
  massageLabChromeFlowFlowSpeed: number
  massageLabChromeFlowTimeScale: number
  massageLabWaveCurrentSpeedX: number
  massageLabWaveCurrentSpeedY: number
  massageLabWaveCurrentAmplitude: number
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
  massageLabSilkSpeed: number
  massageLabSilkScale: number
  massageLabSilkNoiseIntensity: number
  massageLabSilkRotation: number
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
  massageLabSideRaysSpeed: number
  massageLabSideRaysIntensity: number
  massageLabSideRaysSpread: number
  massageLabSideRaysOrigin: MassageLabSideRaysOrigin
  massageLabSideRaysTilt: number
  massageLabSideRaysSaturation: number
  massageLabSideRaysBlend: number
  massageLabSideRaysFalloff: number
  massageLabSideRaysOpacity: number
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
  massageLabEvilEyeIntensity: number
  massageLabEvilEyePupilSize: number
  massageLabEvilEyeIrisWidth: number
  massageLabEvilEyeGlowIntensity: number
  massageLabEvilEyeScale: number
  massageLabEvilEyeNoiseScale: number
  massageLabEvilEyePupilFollow: number
  massageLabEvilEyeFlameSpeed: number
  massageLabEvilEyeInteractive: boolean
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
  massageLabPlasmaSpeed: number
  massageLabPlasmaDirection: MassageLabPlasmaDirection
  massageLabPlasmaScale: number
  massageLabPlasmaOpacity: number
  massageLabPlasmaMouseInteractive: boolean
  massageLabPlasmaWaveXOffset: number
  massageLabPlasmaWaveYOffset: number
  massageLabPlasmaWaveRotationDeg: number
  massageLabPlasmaWaveFocalLength: number
  massageLabPlasmaWaveSpeedOne: number
  massageLabPlasmaWaveSpeedTwo: number
  massageLabPlasmaWaveDirectionTwo: 1 | -1
  massageLabPlasmaWaveBendOne: number
  massageLabPlasmaWaveBendTwo: number
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
  massageLabBeamsBeamWidth: number
  massageLabBeamsBeamHeight: number
  massageLabBeamsBeamNumber: number
  massageLabBeamsSpeed: number
  massageLabBeamsNoiseIntensity: number
  massageLabBeamsScale: number
  massageLabBeamsRotation: number
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
  massageLabLightningXOffset: number
  massageLabLightningSpeed: number
  massageLabLightningIntensity: number
  massageLabLightningSize: number
  massageLabPrismaticBurstIntensity: number
  massageLabPrismaticBurstSpeed: number
  massageLabPrismaticBurstAnimationType: MassageLabPrismaticBurstAnimationType
  massageLabPrismaticBurstDistort: number
  massageLabPrismaticBurstOffsetX: number
  massageLabPrismaticBurstOffsetY: number
  massageLabPrismaticBurstHoverDampness: number
  massageLabPrismaticBurstRayCount: number
  massageLabPrismaticBurstMixBlendMode: MassageLabPrismaticBurstMixBlendMode
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
  massageLabDitherWaveSpeed: number
  massageLabDitherWaveFrequency: number
  massageLabDitherWaveAmplitude: number
  massageLabDitherColorNum: number
  massageLabDitherPixelSize: number
  massageLabDitherMouseInteraction: boolean
  massageLabDitherMouseRadius: number
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
  massageLabDotGridSimulateCursorInteraction: boolean
  massageLabDotGridSimulationSpeed: number
  massageLabDotGridClickShock: boolean
  massageLabThreadsAmplitude: number
  massageLabThreadsDistance: number
  massageLabThreadsEnableMouseInteraction: boolean
  massageLabIridescenceSpeed: number
  massageLabIridescenceAmplitude: number
  massageLabIridescenceMouseReact: boolean
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
  massageLabGridDistortionGrid: number
  massageLabGridDistortionMouse: number
  massageLabGridDistortionStrength: number
  massageLabGridDistortionRelaxation: number
  massageLabGridDistortionCursorInteraction: boolean
  massageLabGridDistortionSimulateCursorInteraction: boolean
  massageLabGridDistortionSimulationSpeed: number
  massageLabOrbHoverIntensity: number
  massageLabOrbRotateOnHover: boolean
  massageLabOrbForceHoverState: boolean
  massageLabOrbCursorInteraction: boolean
  massageLabLetterGlitchGlitchSpeed: number
  massageLabLetterGlitchCenterVignette: boolean
  massageLabLetterGlitchOuterVignette: boolean
  massageLabLetterGlitchSmooth: boolean
  massageLabLetterGlitchCharacters: string
  massageLabGridMotionMaxMoveAmount: number
  massageLabGridMotionBaseDuration: number
  massageLabGridMotionCursorInteraction: boolean
  massageLabGridMotionMantras: string[]
  massageLabShapeGridDirection: "right" | "left" | "up" | "down" | "diagonal"
  massageLabShapeGridSpeed: number
  massageLabShapeGridSpeedVersion: number
  massageLabShapeGridSquareSize: number
  massageLabShapeGridShape: "square" | "circle" | "triangle" | "hexagon"
  massageLabShapeGridHoverTrailAmount: number
  massageLabShapeGridCursorInteraction: boolean
  massageLabLiquidChromeSpeed: number
  massageLabLiquidChromeAmplitude: number
  massageLabLiquidChromeFrequencyX: number
  massageLabLiquidChromeFrequencyY: number
  massageLabLiquidChromeInteractive: boolean
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
  massageLabNovatrixSpeed: number
  massageLabNovatrixAmplitude: number
  massageLabMatrixRainSpeed: number
  massageLabMatrixRainFontSize: number
  massageLabPhotonBeamLineCount: number
  massageLabPhotonBeamDefaultsVersion: number
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
  massageLab3DGlobeAtmosphereIntensity: number
  massageLab3DGlobeAtmosphereBlur: number
  massageLab3DGlobeShowWireframe: boolean
  massageLab3DGlobeMarkerEnabled: boolean
  massageLab3DGlobeMarkerLat: number
  massageLab3DGlobeMarkerLng: number
  massageLab3DGlobeMarkerLabel: string
  massageLab3DGlobeMarkerIcon: "pin" | "person" | "heart" | "star" | "home"
  massageLab3DGlobeMarkerSize: number
  massageLabRetroGridAngle: number
  massageLabRetroGridCellSize: number
  massageLabRetroGridOpacity: number
  massageLabAerialRaysCount: number
  massageLabAerialRaysBlur: number
  massageLabAerialRaysSpeed: number
  massageLabAerialRaysLength: number
  massageLabAerialRaysOpacity: number
  massageLabSynthesisSpeed: number
  massageLabSynthesisComplexity: number
  massageLabSynthesisScale: number
  massageLabSynthesisDistortion: number
  massageLabSynthesisGlowIntensity: number
  massageLabSynthesisFlowFrequency: number
  backgroundLinesDuration: number
  shootingStarsDensity: number
  shootingStarsTwinkle: boolean
  shootingStarsTwinkleSpeed: number
  shootingStarsShootingSpeed: number
  shootingStarsFrequency: number
  canvasRevealDotsDotSize: number
  canvasRevealDotsDotSpacing: number
  canvasRevealDotsOpacity: number
  canvasRevealDotsAnimationSpeed: number
  canvasRevealDotsShowGradient: boolean
  spotlightOpacity: number
  spotlightWidth: number
  spotlightHeight: number
  spotlightSmallWidth: number
  spotlightTranslateY: number
  spotlightDuration: number
  spotlightXOffset: number
  lampGlowOpacity: number
  lampBeamWidth: number
  lampGlowWidth: number
  lampVerticalOffset: number
  lampPulseSpeed: number
  vortexParticleCount: number
  vortexRangeY: number
  vortexBaseSpeed: number
  vortexRangeSpeed: number
  vortexBaseRadius: number
  vortexRangeRadius: number
  wavyWaveWidth: number
  wavyBlur: number
  wavySpeed: "slow" | "fast"
  wavyWaveOpacity: number
  auroraBarsBarCount: number
  auroraBarsSpeed: number
  auroraBarsBlur: number
  auroraBarsGap: number
  auroraBarsMaxHeightRatio: number
  auroraBarsMinHeightRatio: number
  pixelLiquidPixelSize: number
  pixelLiquidDetail: "low" | "medium" | "high"
  pixelLiquidMotionSpeed: number
  tileGridTileSize: number
  tileGridJointSize: number
  tileGridChangeFrequency: number
  tileGridActivePercent: number
  tileGridOpacity: number
  hexGridHexSize: number
  hexGridJointSize: number
  hexGridChangeFrequency: number
  hexGridActivePercent: number
  hexGridOpacity: number
}

type AccountSyncStatus = "checking" | "local" | "synced" | "conflict"

interface SetTimerProps {
  settings: ChimerSettings
  totalDurationMs: number
  error: string | null
  syncStatus: AccountSyncStatus
  suppressSyncNotice?: boolean
  isResolvingSync: boolean
  backgroundAccess: BackgroundAccessSnapshot
  backgroundCategory: BackgroundCategory
  initialStep?: number
  onTimeClick: (unit: "hours" | "minutes") => void
  onSettingsChange: (
    settings: Partial<ChimerSettings>,
    accessOverride?: BackgroundAccessSnapshot,
  ) => void
  onBackgroundVisualCommit: (input: {
    visualBackgroundId: string
    sourceVisualBackgroundId: string
    backgroundId: BackgroundId
    backgroundVisualPreferences: ChimerSettings["backgroundVisualPreferences"]
    properties: Partial<ChimerSettings>
    accessOverride?: BackgroundAccessSnapshot
    activateBackground?: boolean
  }) => void
  onStartTimer: (options?: ChimerSetupStartOptions) => void
  onStartClock: () => void
  hapticsEnabled: boolean
  onTestAlert: () => void
  onUseDeviceSettings: () => void
  onUseSavedSettings: () => void
}

const ALERT_TYPE_OPTIONS: Array<{
  value: ChimerSettings["alertType"]
  label: string
}> = [
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

export function SetTimer({ settings, totalDurationMs, error, syncStatus, suppressSyncNotice = false, isResolvingSync, backgroundAccess, backgroundCategory, initialStep = 0, onTimeClick, onSettingsChange, onBackgroundVisualCommit, onStartTimer, onStartClock, hapticsEnabled, onTestAlert, onUseDeviceSettings, onUseSavedSettings }: SetTimerProps) {
  const [activeStep, setActiveStep] = useState(() => {
    // Route-derived or future callers may pass non-finite values; setup always
    // falls back to the first step before applying the normal finite bounds.
    const normalizedStep = Number.isFinite(initialStep) ? Math.trunc(initialStep) : 0
    return Math.min(CHIMER_SETUP_STEPS.length - 1, Math.max(0, normalizedStep))
  })
  useEffect(() => {
    const normalizedStep = Number.isFinite(initialStep) ? Math.trunc(initialStep) : 0
    setActiveStep(Math.min(CHIMER_SETUP_STEPS.length - 1, Math.max(0, normalizedStep)))
  }, [initialStep])
  const [savedPresets, setSavedPresets] = useState<ChimerSetupPreset[]>([])
  const [lastSetupPreset, setLastSetupPreset] = useState<ChimerSetupPresetState | null>(null)
  const [selectedPresetId, setSelectedPresetId] = useState("")
  const [newPresetName, setNewPresetName] = useState("")
  const [skipIntervalCues, setSkipIntervalCues] = useState(false)
  const [globeMarkerDraft, setGlobeMarkerDraft] = useState(() => ({
    latitude: String(settings.massageLab3DGlobeMarkerLat),
    longitude: String(settings.massageLab3DGlobeMarkerLng),
  }))
  const [globeLocationMessage, setGlobeLocationMessage] = useState<string | null>(null)
  const { settings: appShellSettings } = useSettings()
  const [syncNoticeDismissed, setSyncNoticeDismissed] = useState(false)
  const [isSyncNoticeExiting, setIsSyncNoticeExiting] = useState(false)
  const syncNoticeDismissTimerRef = useRef<number | null>(null)
  const syncNoticeExitTimerRef = useRef<number | null>(null)
  const containerRef = useRef<HTMLElement | null>(null)
  const nativeRangeInputSyncedRef = useRef(false)
  const isTimerSet = totalDurationMs > 0
  const withPress = (handler: () => void) => withChimerPress(handler, { hapticsEnabled })
  const setupPresetState = useMemo(() => createChimerSetupPresetState(settings, skipIntervalCues), [settings, skipIntervalCues])
  const handleBackgroundSelection = (
    nextBackgroundId: BackgroundId,
    accessOverride?: BackgroundAccessSnapshot,
  ) => {
    if (nextBackgroundId === settings.backgroundId) {
      // A redemption can confirm access to the already-selected canonical ID.
      // Retain that bridge without rebuilding or resetting its Visual snapshot.
      if (accessOverride) {
        onSettingsChange({}, accessOverride)
      }
      return
    }
    // Setup selection uses the same destination snapshot contract as the live
    // Visual picker so a saved default preset (or source defaults) is applied.
    const commit = buildBackgroundVisualPendingCommit({
      preferences: settings.backgroundVisualPreferences,
      currentBackgroundId: settings.backgroundId,
      currentSnapshot: buildBackgroundVisualOpeningSnapshot({
        preferences: settings.backgroundVisualPreferences,
        backgroundId: settings.backgroundId,
        committedSettings: settings,
        adapter: backgroundPaletteRegistry[settings.backgroundId],
      }),
      targetBackgroundId: nextBackgroundId,
      targetAdapter: backgroundPaletteRegistry[nextBackgroundId],
      commitCanonicalBackgroundSelection: true,
    })
    // The source and destination renderer inventories need per-background
    // entitlement scopes; an ordinary settings patch cannot safely carry both.
    // An explicit setup selection also activates motion in this scoped commit.
    onBackgroundVisualCommit({
      visualBackgroundId: nextBackgroundId,
      sourceVisualBackgroundId: settings.backgroundId,
      backgroundId: nextBackgroundId,
      backgroundVisualPreferences:
        commit.backgroundVisualPreferences as ChimerSettings["backgroundVisualPreferences"],
      properties: commit.properties as Partial<ChimerSettings>,
      ...(accessOverride ? { accessOverride } : {}),
      activateBackground: true,
    })
  }

  useEffect(() => {
    setGlobeMarkerDraft({
      latitude: String(settings.massageLab3DGlobeMarkerLat),
      longitude: String(settings.massageLab3DGlobeMarkerLng),
    })
  }, [settings.massageLab3DGlobeMarkerLat, settings.massageLab3DGlobeMarkerLng])

  const commitGlobeCoordinate = (axis: "latitude" | "longitude") => {
    const isLatitude = axis === "latitude"
    const value = parseGlobeCoordinateDraft(
      globeMarkerDraft[axis],
      isLatitude ? -90 : -180,
      isLatitude ? 90 : 180,
    )
    if (value === null) {
      setGlobeMarkerDraft((current) => ({
        ...current,
        [axis]: String(
          isLatitude
            ? settings.massageLab3DGlobeMarkerLat
            : settings.massageLab3DGlobeMarkerLng,
        ),
      }))
      return
    }
    onSettingsChange(isLatitude
      ? { massageLab3DGlobeMarkerLat: value }
      : { massageLab3DGlobeMarkerLng: value })
  }

  const syncMessage = {
    checking: "Checking account sync. Changes stay on this device until sync is available.",
    local: "Settings stay on this device. Sign in or create an account to sync Chimer settings across devices.",
    synced: "You're signed in. Chimer settings sync across devices.",
    conflict: "You're signed in. Choose whether this device or your saved favorites should control Chimer settings.",
  }[syncStatus]

  const useCurrentLocationForGlobe = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setGlobeLocationMessage("Location access is unavailable in this browser.")
      return
    }

    setGlobeLocationMessage(null)
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      setGlobeMarkerDraft({
        latitude: coords.latitude.toFixed(4),
        longitude: coords.longitude.toFixed(4),
      })
      onSettingsChange({
        massageLab3DGlobeMarkerEnabled: true,
        massageLab3DGlobeMarkerLat: Number(coords.latitude.toFixed(4)),
        massageLab3DGlobeMarkerLng: Number(coords.longitude.toFixed(4)),
      })
    }, () => {
      setGlobeLocationMessage("We could not access your location. Check browser permission and try again.")
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

    const rangeInputs = containerRef.current?.querySelectorAll<HTMLInputElement>(`.${styles.rangeRow} input[type="range"]`)

    rangeInputs?.forEach(syncNativeRangeFill)
  }, [settings])

  const handleNativeRangeInput = useCallback((event: ReactFormEvent<HTMLElement>) => {
    const target = event.target

    if (target instanceof HTMLInputElement && target.type === "range") {
      syncNativeRangeFill(target)
      nativeRangeInputSyncedRef.current = true
    }
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
    }, SYNC_NOTICE_EXIT_DURATION_MS)
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

  const handleUseDeviceSettingsClick = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      withChimerPress(
        () => {
          dismissSyncNotice()
          onUseDeviceSettings()
        },
        { hapticsEnabled },
      )(event)
    },
    [dismissSyncNotice, hapticsEnabled, onUseDeviceSettings],
  )

  const handleUseSavedSettingsClick = useCallback(
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      withChimerPress(
        () => {
          dismissSyncNotice()
          onUseSavedSettings()
        },
        { hapticsEnabled },
      )(event)
    },
    [dismissSyncNotice, hapticsEnabled, onUseSavedSettings],
  )

  const isFinalStep = activeStep === CHIMER_SETUP_STEPS.length - 1
  const canAdvanceStep = isTimerSet
  const shouldShowSyncNotice = syncStatus !== "synced" && !(syncStatus === "conflict" && suppressSyncNotice)

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
    const {
      skipIntervalCues: intervalSkip,
      backgroundId,
      ...settingsToApply
    } = preset
    // Commit the destination/source Visual scopes through the entitlement-aware
    // selection path before its synchronous settings ref feeds the rest.
    handleBackgroundSelection(backgroundId)
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

  const durationSettingsRef = useRef({
    hours: settings.hours,
    minutes: settings.minutes,
  })

  useEffect(() => {
    durationSettingsRef.current = {
      hours: settings.hours,
      minutes: settings.minutes,
    }
  }, [settings.hours, settings.minutes])

  /** Keeps accelerated hold updates monotonic even while parent settings rerender. */
  const stepDurationPart = useCallback(
    (unit: "hours" | "minutes", amount: number) => {
      const maximum = unit === "hours" ? 23 : 59
      const current = durationSettingsRef.current
      const nextValue = Math.min(maximum, Math.max(0, current[unit] + amount))

      durationSettingsRef.current = { ...current, [unit]: nextValue }
      onSettingsChange({ [unit]: nextValue })
    },
    [onSettingsChange],
  )

  const stepIntervalMode = skipIntervalCues ? "none" : settings.intervalType
  const selectedAlertUsesSound = SOUND_ALERT_TYPES.has(settings.alertType)
  const selectedAlertUsesHaptics = HAPTIC_ALERT_TYPES.has(settings.alertType)
  const canGoToStep = (stepIndex: number) => stepIndex <= activeStep || isTimerSet || stepIndex === 0

  const isStepComplete = (stepIndex: number) => (stepIndex === 0 ? isTimerSet : stepIndex < activeStep)

  const renderBackgroundControls = (option: BackgroundDefinition) => {
    if (option.id === "massage-lab-gradient-animation") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.rangeRow}>
            <span>Speed</span>
            <input
              type="range"
              min="0.25"
              max="2.5"
              step="0.25"
              value={settings.gradientAnimationSpeed}
              onChange={(event) =>
                onSettingsChange({
                  gradientAnimationSpeed: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  gradientAnimationSize: Number(event.target.value),
                })
              }
              aria-label="Animated gradient glow size"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-gradient") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.rangeRow}>
            <span>Opacity ({Math.round(settings.massageLabGradientOpacity * 100)}%)</span>
            <input
              type="range"
              min="0.15"
              max="1"
              step="0.01"
              value={settings.massageLabGradientOpacity}
              onChange={(event) =>
                onSettingsChange({
                  massageLabGradientOpacity: Number(event.target.value),
                })
              }
              aria-label="MassageLab gradient opacity"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-hole") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.rangeRow}>
            <span>Line count ({settings.massageLabHoleLineCount})</span>
            <input
              type="range"
              min="12"
              max="96"
              step="1"
              value={settings.massageLabHoleLineCount}
              onChange={(event) =>
                onSettingsChange({
                  massageLabHoleLineCount: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabHoleDiscCount: Number(event.target.value),
                })
              }
              aria-label="MassageLab Hole disc count"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-stars") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.rangeRow}>
            <span>Speed ({settings.massageLabStarsSpeed}s)</span>
            <input
              type="range"
              min="18"
              max="120"
              step="1"
              value={settings.massageLabStarsSpeed}
              onChange={(event) =>
                onSettingsChange({
                  massageLabStarsSpeed: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabStarsDensity: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabStarsParallax: Number(event.target.value),
                })
              }
              aria-label="MassageLab Stars parallax strength"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-sparkles") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.rangeRow}>
            <span>Density</span>
            <input
              type="range"
              min="20"
              max="220"
              step="1"
              value={settings.sparklesParticleDensity}
              onChange={(event) =>
                onSettingsChange({
                  sparklesParticleDensity: Number(event.target.value),
                })
              }
              aria-label="Sparkles particle density"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Speed</span>
            <input type="range" min="0.5" max="8" step="0.5" value={settings.sparklesSpeed} onChange={(event) => onSettingsChange({ sparklesSpeed: Number(event.target.value) })} aria-label="Sparkles animation speed" />
          </label>
          <label className={styles.rangeRow}>
            <span>Size</span>
            <input
              type="range"
              min="1"
              max="6"
              step="0.5"
              value={settings.sparklesMaxSize}
              onChange={(event) =>
                onSettingsChange({
                  sparklesMaxSize: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  backgroundLinesDuration: Number(event.target.value),
                })
              }
              aria-label="Light lines animation duration"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-shooting-stars") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.rangeRow}>
            <span>Star density</span>
            <input
              type="range"
              min="0.00005"
              max="0.00035"
              step="0.00001"
              value={settings.shootingStarsDensity}
              onChange={(event) =>
                onSettingsChange({
                  shootingStarsDensity: Number(event.target.value),
                })
              }
              aria-label="Shooting stars background star density"
            />
          </label>
          <label className={styles.switchRow}>
            <span>Twinkle stars</span>
            <input type="checkbox" checked={settings.shootingStarsTwinkle} onChange={(event) => onSettingsChange({ shootingStarsTwinkle: event.target.checked })} />
          </label>
          <label className={styles.rangeRow}>
            <span>Twinkle speed</span>
            <input
              type="range"
              min="0.4"
              max="2.5"
              step="0.1"
              value={settings.shootingStarsTwinkleSpeed}
              onChange={(event) =>
                onSettingsChange({
                  shootingStarsTwinkleSpeed: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  shootingStarsShootingSpeed: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  shootingStarsFrequency: Number(event.target.value),
                })
              }
              aria-label="Shooting star frequency"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-wavy-background") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.rangeRow}>
            <span>Wave width</span>
            <input type="range" min="10" max="90" step="5" value={settings.wavyWaveWidth} onChange={(event) => onSettingsChange({ wavyWaveWidth: Number(event.target.value) })} aria-label="Wavy wave width" />
          </label>
          <label className={styles.rangeRow}>
            <span>Blur</span>
            <input type="range" min="0" max="20" step="1" value={settings.wavyBlur} onChange={(event) => onSettingsChange({ wavyBlur: Number(event.target.value) })} aria-label="Wavy blur" />
          </label>
          <label className={styles.rangeRow}>
            <span>Opacity</span>
            <input
              type="range"
              min="0.15"
              max="0.85"
              step="0.05"
              value={settings.wavyWaveOpacity}
              onChange={(event) =>
                onSettingsChange({
                  wavyWaveOpacity: Number(event.target.value),
                })
              }
              aria-label="Wavy wave opacity"
            />
          </label>
          <label className={styles.selectRow}>
            <span>Speed</span>
            <select
              value={settings.wavySpeed}
              onChange={(event) =>
                onSettingsChange({
                  wavySpeed: event.target.value as ChimerSettings["wavySpeed"],
                })
              }
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
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.rangeRow}>
            <span>Bars ({settings.auroraBarsBarCount})</span>
            <input
              type="range"
              min="8"
              max="80"
              step="1"
              value={settings.auroraBarsBarCount}
              onChange={(event) =>
                onSettingsChange({
                  auroraBarsBarCount: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  auroraBarsSpeed: Number(event.target.value),
                })
              }
              aria-label="Aurora bars speed"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Blur ({settings.auroraBarsBlur}px)</span>
            <input type="range" min="0" max="18" step="1" value={settings.auroraBarsBlur} onChange={(event) => onSettingsChange({ auroraBarsBlur: Number(event.target.value) })} aria-label="Aurora bars blur" />
          </label>
          <label className={styles.rangeRow}>
            <span>Gap ({settings.auroraBarsGap}px)</span>
            <input type="range" min="0" max="16" step="1" value={settings.auroraBarsGap} onChange={(event) => onSettingsChange({ auroraBarsGap: Number(event.target.value) })} aria-label="Aurora bars gap" />
          </label>
          <label className={styles.rangeRow}>
            <span>
              Max height ({Math.round(settings.auroraBarsMaxHeightRatio * 100)}
              %)
            </span>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.01"
              value={settings.auroraBarsMaxHeightRatio}
              onChange={(event) =>
                onSettingsChange({
                  auroraBarsMaxHeightRatio: Number(event.target.value),
                })
              }
              aria-label="Aurora bars maximum height"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>
              Min height ({Math.round(settings.auroraBarsMinHeightRatio * 100)}
              %)
            </span>
            <input
              type="range"
              min="0.04"
              max="0.78"
              step="0.01"
              value={settings.auroraBarsMinHeightRatio}
              onChange={(event) =>
                onSettingsChange({
                  auroraBarsMinHeightRatio: Number(event.target.value),
                })
              }
              aria-label="Aurora bars minimum height"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-pixel-liquid") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Detail</span>
            <select
              value={settings.pixelLiquidDetail}
              onChange={(event) =>
                onSettingsChange({
                  pixelLiquidDetail: event.target.value as ChimerSettings["pixelLiquidDetail"],
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  pixelLiquidPixelSize: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  pixelLiquidMotionSpeed: Number(event.target.value),
                })
              }
              aria-label="Pixel liquid motion speed"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-tile-grid") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.rangeRow}>
            <span>Tile size ({settings.tileGridTileSize}px)</span>
            <input
              type="range"
              min="18"
              max="120"
              step="2"
              value={settings.tileGridTileSize}
              onChange={(event) =>
                onSettingsChange({
                  tileGridTileSize: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  tileGridJointSize: Number(event.target.value),
                })
              }
              aria-label="Tile grid joint size"
            />
          </label>
          <TileGridFadeTimeControl fadeSeconds={settings.tileGridChangeFrequency} onFadeSecondsChange={(tileGridChangeFrequency) => onSettingsChange({ tileGridChangeFrequency })} rowClassName={styles.durationRow} pickerClassName={styles.durationPicker} fieldClassName={styles.durationField} />
          <label className={styles.rangeRow}>
            <span>Active tiles ({settings.tileGridActivePercent}%)</span>
            <input
              type="range"
              min="1"
              max="60"
              step="1"
              value={settings.tileGridActivePercent}
              onChange={(event) =>
                onSettingsChange({
                  tileGridActivePercent: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  tileGridOpacity: Number(event.target.value),
                })
              }
              aria-label="Tile grid tile opacity"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-hex-grid") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.rangeRow}>
            <span>Hex size ({settings.hexGridHexSize}px)</span>
            <input type="range" min="18" max="120" step="2" value={settings.hexGridHexSize} onChange={(event) => onSettingsChange({ hexGridHexSize: Number(event.target.value) })} aria-label="Hex grid hex size" />
          </label>
          <label className={styles.rangeRow}>
            <span>Joint size ({settings.hexGridJointSize}px)</span>
            <input
              type="range"
              min="1"
              max="10"
              step="1"
              value={settings.hexGridJointSize}
              onChange={(event) =>
                onSettingsChange({
                  hexGridJointSize: Number(event.target.value),
                })
              }
              aria-label="Hex grid joint size"
            />
          </label>
          <TileGridFadeTimeControl fadeSeconds={settings.hexGridChangeFrequency} onFadeSecondsChange={(hexGridChangeFrequency) => onSettingsChange({ hexGridChangeFrequency })} rowClassName={styles.durationRow} pickerClassName={styles.durationPicker} fieldClassName={styles.durationField} />
          <label className={styles.rangeRow}>
            <span>Active hexes ({settings.hexGridActivePercent}%)</span>
            <input
              type="range"
              min="1"
              max="60"
              step="1"
              value={settings.hexGridActivePercent}
              onChange={(event) =>
                onSettingsChange({
                  hexGridActivePercent: Number(event.target.value),
                })
              }
              aria-label="Hex grid active hex percentage"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Hex opacity ({Math.round(settings.hexGridOpacity * 100)}%)</span>
            <input type="range" min="0.15" max="1" step="0.01" value={settings.hexGridOpacity} onChange={(event) => onSettingsChange({ hexGridOpacity: Number(event.target.value) })} aria-label="Hex grid hex opacity" />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-light-speed") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.rangeRow}>
            <span>Warp speed ({settings.massageLabLightSpeedWarpSpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0.1"
              max="24"
              step="0.01"
              value={settings.massageLabLightSpeedWarpSpeed}
              onChange={(event) =>
                onSettingsChange({
                  massageLabLightSpeedWarpSpeed: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabLightSpeedParticleCount: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabLightSpeedIntensity: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabLightSpeedRadius: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabLightSpeedCylinderLength: Number(event.target.value),
                })
              }
              aria-label="Light Speed field length"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-electric-mist") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.rangeRow}>
            <span>Animation speed ({Math.round(settings.massageLabElectricMistSpeed)}%)</span>
            <input
              type="range"
              min={MASSAGE_LAB_ELECTRIC_MIST_DISPLAY_SPEED_MIN}
              max={MASSAGE_LAB_ELECTRIC_MIST_DISPLAY_SPEED_MAX}
              step={MASSAGE_LAB_ELECTRIC_MIST_DISPLAY_SPEED_STEP}
              value={settings.massageLabElectricMistSpeed}
              onChange={(event) =>
                onSettingsChange({
                  massageLabElectricMistSpeed: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabElectricMistDetail: Number(event.target.value),
                })
              }
              aria-label="Electric Mist noise detail"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>
              Distortion ({settings.massageLabElectricMistDistortion.toFixed(1)}
              x)
            </span>
            <input
              type="range"
              min="0"
              max="6"
              step="0.1"
              value={settings.massageLabElectricMistDistortion}
              onChange={(event) =>
                onSettingsChange({
                  massageLabElectricMistDistortion: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabElectricMistBrightness: Number(event.target.value),
                })
              }
              aria-label="Electric Mist brightness"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-astral-flow") {
      const astralFlowDisplaySpeed = getMassageLabAstralFlowDisplaySpeed(settings.massageLabAstralFlowSpeed)

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.rangeRow}>
            <span>Animation speed ({astralFlowDisplaySpeed}%)</span>
            <input
              type="range"
              min={MASSAGE_LAB_ASTRAL_FLOW_DISPLAY_SPEED_MIN}
              max={MASSAGE_LAB_ASTRAL_FLOW_DISPLAY_SPEED_MAX}
              step={MASSAGE_LAB_ASTRAL_FLOW_DISPLAY_SPEED_STEP}
              value={astralFlowDisplaySpeed}
              onChange={(event) =>
                onSettingsChange({
                  massageLabAstralFlowSpeed: getMassageLabAstralFlowSourceSpeed(Number(event.target.value)),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabAstralFlowFlowMin: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabAstralFlowFlowMax: Number(event.target.value),
                })
              }
              aria-label="Astral Flow flow max"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-deep-space-nebula") {
      const nebulaDisplaySpeed = getMassageLabDeepSpaceNebulaDisplaySpeed(settings.massageLabDeepSpaceNebulaSpeed)

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.rangeRow}>
            <span>Animation speed ({nebulaDisplaySpeed}%)</span>
            <input
              type="range"
              min={MASSAGE_LAB_DEEP_SPACE_NEBULA_DISPLAY_SPEED_MIN}
              max={MASSAGE_LAB_DEEP_SPACE_NEBULA_DISPLAY_SPEED_MAX}
              step={MASSAGE_LAB_DEEP_SPACE_NEBULA_DISPLAY_SPEED_STEP}
              value={nebulaDisplaySpeed}
              onChange={(event) =>
                onSettingsChange({
                  massageLabDeepSpaceNebulaSpeed: getMassageLabDeepSpaceNebulaSourceSpeed(Number(event.target.value)),
                })
              }
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
          <label className={styles.rangeRow}>
            <span>Animation speed ({gridBloomDisplaySpeed}%)</span>
            <input
              type="range"
              min={MASSAGE_LAB_GRID_BLOOM_DISPLAY_SPEED_MIN}
              max={MASSAGE_LAB_GRID_BLOOM_DISPLAY_SPEED_MAX}
              step={MASSAGE_LAB_GRID_BLOOM_DISPLAY_SPEED_STEP}
              value={gridBloomDisplaySpeed}
              onChange={(event) =>
                onSettingsChange({
                  massageLabGridBloomSpeed: getMassageLabGridBloomSourceSpeed(Number(event.target.value)),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabGridBloomGridScale: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabGridBloomRotationSpeed: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabGridBloomFadeFalloff: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabGridBloomDistortionAmount: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabGridBloomFlowSpeedX: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabGridBloomFlowSpeedY: Number(event.target.value),
                })
              }
              aria-label="Grid Bloom flow Y"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-chrome-flow") {
      const liquidChromeFlowSpeed = getMassageLabChromeFlowDisplayFlowSpeed(settings.massageLabChromeFlowFlowSpeed)
      const liquidChromeTimeScale = getMassageLabChromeFlowDisplayTimeScale(settings.massageLabChromeFlowTimeScale)

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.rangeRow}>
            <span>Flow speed ({liquidChromeFlowSpeed}%)</span>
            <input
              type="range"
              min={MASSAGE_LAB_LIQUID_CHROME_DISPLAY_FLOW_SPEED_MIN}
              max={MASSAGE_LAB_LIQUID_CHROME_DISPLAY_FLOW_SPEED_MAX}
              step={MASSAGE_LAB_LIQUID_CHROME_DISPLAY_FLOW_SPEED_STEP}
              value={liquidChromeFlowSpeed}
              onChange={(event) =>
                onSettingsChange({
                  massageLabChromeFlowFlowSpeed: getMassageLabChromeFlowSourceFlowSpeed(Number(event.target.value)),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabChromeFlowTimeScale: getMassageLabChromeFlowSourceTimeScale(Number(event.target.value)),
                })
              }
              aria-label="Liquid Chrome time scale"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-retro-grid") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.rangeRow}>
            <span>Angle ({settings.massageLabRetroGridAngle.toFixed(0)} deg)</span>
            <input
              type="range"
              min="1"
              max="89"
              step="1"
              value={settings.massageLabRetroGridAngle}
              onChange={(event) =>
                onSettingsChange({
                  massageLabRetroGridAngle: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabRetroGridCellSize: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabRetroGridOpacity: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLab3DGlobeViewStyle: event.target.value as ChimerSettings["massageLab3DGlobeViewStyle"],
                })
              }
              aria-label="3D Globe view style"
            >
              <option value="realistic">Realistic</option>
              <option value="graphic">Graphic</option>
            </select>
          </label>

          {isGraphicGlobe ? (
            <>
              <label className={styles.rangeRow}>
                <span>
                  Dot density ({Math.round(settings.massageLab3DGlobeGraphicMapSamples / 1000)}
                  k)
                </span>
                <input
                  type="range"
                  min="1000"
                  max="10000"
                  step="1000"
                  value={settings.massageLab3DGlobeGraphicMapSamples}
                  onChange={(event) =>
                    onSettingsChange({
                      massageLab3DGlobeGraphicMapSamples: Number(event.target.value),
                    })
                  }
                  aria-label="3D Globe graphic dot density"
                />
              </label>
            </>
          ) : (
            <></>
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
                  onChange={(event) =>
                    onSettingsChange({
                      massageLab3DGlobeAutoRotateSpeed: Number(event.target.value),
                    })
                  }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLab3DGlobeLightingMode: event.target.checked ? "sun" : "manual",
                })
              }
              aria-label="3D Globe follow sun"
            />
          </label>

          <label className={styles.switchRow}>
            <span>Pan controls</span>
            <input
              type="checkbox"
              checked={settings.massageLab3DGlobeEnablePan}
              onChange={(event) =>
                onSettingsChange({
                  massageLab3DGlobeEnablePan: event.target.checked,
                })
              }
              aria-label="3D Globe pan controls"
            />
          </label>

          {settings.massageLab3DGlobeEnablePan && (
            <>
              <label className={styles.rangeRow}>
                <span>
                  Pan X Left/Right ({Math.round(settings.massageLab3DGlobePanX)}
                  %)
                </span>
                <input
                  type="range"
                  min="-50"
                  max="50"
                  step="1"
                  value={settings.massageLab3DGlobePanX}
                  onChange={(event) =>
                    onSettingsChange({
                      massageLab3DGlobePanX: Number(event.target.value),
                    })
                  }
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
                  onChange={(event) =>
                    onSettingsChange({
                      massageLab3DGlobePanY: Number(event.target.value),
                    })
                  }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLab3DGlobeScale: getMassageLab3DGlobeScaleFromDisplayPercent(Number(event.target.value)),
                })
              }
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
                onChange={(event) =>
                  onSettingsChange({
                    massageLab3DGlobeBumpScale: Number(event.target.value),
                  })
                }
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
                  onChange={(event) =>
                    onSettingsChange({
                      massageLab3DGlobeAmbientIntensity: Number(event.target.value),
                    })
                  }
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
                  onChange={(event) =>
                    onSettingsChange({
                      massageLab3DGlobePointLightIntensity: Number(event.target.value),
                    })
                  }
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
                  onChange={(event) =>
                    onSettingsChange({
                      massageLab3DGlobeShowAtmosphere: event.target.checked,
                    })
                  }
                  aria-label="3D Globe show atmosphere"
                />
              </label>

              {settings.massageLab3DGlobeShowAtmosphere && (
                <>
                  <label className={styles.rangeRow}>
                    <span>Atmosphere ({settings.massageLab3DGlobeAtmosphereIntensity.toFixed(1)})</span>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={settings.massageLab3DGlobeAtmosphereIntensity}
                      onChange={(event) =>
                        onSettingsChange({
                          massageLab3DGlobeAtmosphereIntensity: Number(event.target.value),
                        })
                      }
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
                      onChange={(event) =>
                        onSettingsChange({
                          massageLab3DGlobeAtmosphereBlur: Number(event.target.value),
                        })
                      }
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
                  onChange={(event) =>
                    onSettingsChange({
                      massageLab3DGlobeShowWireframe: event.target.checked,
                    })
                  }
                  aria-label="3D Globe show wireframe"
                />
              </label>

              {settings.massageLab3DGlobeShowWireframe && <></>}
            </>
          )}

          <label className={styles.switchRow}>
            <span>Location marker</span>
            <input
              type="checkbox"
              checked={settings.massageLab3DGlobeMarkerEnabled}
              onChange={(event) =>
                onSettingsChange({
                  massageLab3DGlobeMarkerEnabled: event.target.checked,
                })
              }
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
                    value={globeMarkerDraft.latitude}
                    onChange={(event) => setGlobeMarkerDraft((current) => ({
                      ...current,
                      latitude: event.target.value,
                    }))}
                    onBlur={() => commitGlobeCoordinate("latitude")}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") event.currentTarget.blur()
                    }}
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
                    value={globeMarkerDraft.longitude}
                    onChange={(event) => setGlobeMarkerDraft((current) => ({
                      ...current,
                      longitude: event.target.value,
                    }))}
                    onBlur={() => commitGlobeCoordinate("longitude")}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") event.currentTarget.blur()
                    }}
                    aria-label="3D Globe marker longitude"
                  />
                </label>
              </div>
              <button type="button" className={`${styles.inlineButton} ${styles.tactileButton}`} onClick={withPress(useCurrentLocationForGlobe)}>
                Use my location
              </button>
              {globeLocationMessage ? (
                <p className={styles.locationStatus} role="status" aria-live="polite">
                  {globeLocationMessage}
                </p>
              ) : null}
              <label className={styles.textField}>
                <span>Marker label</span>
                <input
                  type="text"
                  placeholder="Optional"
                  value={settings.massageLab3DGlobeMarkerLabel}
                  onChange={(event) =>
                    onSettingsChange({
                      massageLab3DGlobeMarkerLabel: event.target.value,
                    })
                  }
                  aria-label="3D Globe marker label"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Marker icon</span>
                <select
                  value={settings.massageLab3DGlobeMarkerIcon}
                  onChange={(event) =>
                    onSettingsChange({
                      massageLab3DGlobeMarkerIcon: event.target.value as ChimerSettings["massageLab3DGlobeMarkerIcon"],
                    })
                  }
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
                  onChange={(event) =>
                    onSettingsChange({
                      massageLab3DGlobeMarkerSize: Number(event.target.value),
                    })
                  }
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
          <label className={styles.rangeRow}>
            <span>Ray count ({settings.massageLabAerialRaysCount})</span>
            <input
              type="range"
              min="1"
              max="20"
              step="1"
              value={settings.massageLabAerialRaysCount}
              onChange={(event) =>
                onSettingsChange({
                  massageLabAerialRaysCount: Number(event.target.value),
                })
              }
              aria-label="Aerial Rays count"
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabAerialRaysBlur: Number(event.target.value),
                })
              }
              aria-label="Aerial Rays blur"
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabAerialRaysSpeed: Number(event.target.value),
                })
              }
              aria-label="Aerial Rays speed"
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabAerialRaysLength: Number(event.target.value),
                })
              }
              aria-label="Aerial Rays length"
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabAerialRaysOpacity: Number(event.target.value),
                })
              }
              aria-label="Aerial Rays opacity"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-wave-current") {
      const wavesSpeedX = getMassageLabWaveCurrentDisplaySpeed(settings.massageLabWaveCurrentSpeedX)
      const wavesSpeedY = getMassageLabWaveCurrentDisplaySpeed(settings.massageLabWaveCurrentSpeedY)

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.rangeRow}>
            <span>Speed X ({wavesSpeedX}%)</span>
            <input
              type="range"
              min={MASSAGE_LAB_WAVES_DISPLAY_SPEED_MIN}
              max={MASSAGE_LAB_WAVES_DISPLAY_SPEED_MAX}
              step={MASSAGE_LAB_WAVES_DISPLAY_SPEED_STEP}
              value={wavesSpeedX}
              onChange={(event) =>
                onSettingsChange({
                  massageLabWaveCurrentSpeedX: getMassageLabWaveCurrentSourceSpeed(Number(event.target.value)),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabWaveCurrentSpeedY: getMassageLabWaveCurrentSourceSpeed(Number(event.target.value)),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabWaveCurrentAmplitude: Number(event.target.value),
                })
              }
              aria-label="Waves amplitude"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-ferrofluid") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Flow direction</span>
            <select
              value={settings.massageLabFerrofluidFlowDirection}
              onChange={(event) =>
                onSettingsChange({
                  massageLabFerrofluidFlowDirection: event.target.value as ChimerSettings["massageLabFerrofluidFlowDirection"],
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabFerrofluidSpeed: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabFerrofluidScale: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabFerrofluidTurbulence: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabFerrofluidFluidity: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabFerrofluidRimWidth: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabFerrofluidSharpness: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabFerrofluidShimmer: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabFerrofluidGlow: Number(event.target.value),
                })
              }
              aria-label="Ferrofluid glow"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>
              Opacity ({Math.round(settings.massageLabFerrofluidOpacity * 100)}
              %)
            </span>
            <input
              type="range"
              min="0.05"
              max="1"
              step="0.01"
              value={settings.massageLabFerrofluidOpacity}
              onChange={(event) =>
                onSettingsChange({
                  massageLabFerrofluidOpacity: Number(event.target.value),
                })
              }
              aria-label="Ferrofluid opacity"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-lightfall") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.rangeRow}>
            <span>Animation speed ({settings.massageLabLightfallSpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0.05"
              max="2"
              step="0.05"
              value={settings.massageLabLightfallSpeed}
              onChange={(event) =>
                onSettingsChange({
                  massageLabLightfallSpeed: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabLightfallStreakCount: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabLightfallStreakWidth: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabLightfallStreakLength: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabLightfallGlow: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabLightfallDensity: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabLightfallTwinkle: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabLightfallZoom: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabLightfallBackgroundGlow: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabLightfallOpacity: Number(event.target.value),
                })
              }
              aria-label="Lightfall opacity"
            />
          </label>

          <label className={styles.switchRow}>
            <span>Cursor glow</span>
            <input
              type="checkbox"
              checked={settings.massageLabLightfallCursorEnabled}
              onChange={(event) =>
                onSettingsChange({
                  massageLabLightfallCursorEnabled: event.target.checked,
                })
              }
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
                  onChange={(event) =>
                    onSettingsChange({
                      massageLabLightfallCursorStrength: Number(event.target.value),
                    })
                  }
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
                  onChange={(event) =>
                    onSettingsChange({
                      massageLabLightfallCursorRadius: Number(event.target.value),
                    })
                  }
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
                  onChange={(event) =>
                    onSettingsChange({
                      massageLabLightfallCursorDampening: Number(event.target.value),
                    })
                  }
                  aria-label="Lightfall cursor smoothing"
                />
              </label>
            </>
          )}
        </div>
      )
    }

    if (option.id === "massage-lab-liquid-ether") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.switchRow}>
            <span>Cursor fluid push</span>
            <input
              type="checkbox"
              checked={settings.massageLabLiquidEtherCursorEnabled}
              onChange={(event) =>
                onSettingsChange({
                  massageLabLiquidEtherCursorEnabled: event.target.checked,
                })
              }
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
                  onChange={(event) =>
                    onSettingsChange({
                      massageLabLiquidEtherMouseForce: Number(event.target.value),
                    })
                  }
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
                  onChange={(event) =>
                    onSettingsChange({
                      massageLabLiquidEtherCursorSize: Number(event.target.value),
                    })
                  }
                  aria-label="Liquid Ether cursor size"
                />
              </label>
            </>
          )}

          <label className={styles.switchRow}>
            <span>Motion</span>
            <input
              type="checkbox"
              checked={settings.massageLabLiquidEtherAutoDemo}
              onChange={(event) =>
                onSettingsChange({
                  massageLabLiquidEtherAutoDemo: event.target.checked,
                })
              }
              aria-label="Liquid Ether motion"
            />
          </label>

          {settings.massageLabLiquidEtherAutoDemo && (
            <>
              <label className={styles.rangeRow}>
                <span>Speed ({settings.massageLabLiquidEtherAutoSpeed.toFixed(2)}x)</span>
                <input
                  type="range"
                  min="0.05"
                  max="2"
                  step="0.05"
                  value={settings.massageLabLiquidEtherAutoSpeed}
                  onChange={(event) =>
                    onSettingsChange({
                      massageLabLiquidEtherAutoSpeed: Number(event.target.value),
                    })
                  }
                  aria-label="Liquid Ether speed"
                />
              </label>

              <label className={styles.rangeRow}>
                <span>Intensity ({settings.massageLabLiquidEtherAutoIntensity.toFixed(1)})</span>
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="0.1"
                  value={settings.massageLabLiquidEtherAutoIntensity}
                  onChange={(event) =>
                    onSettingsChange({
                      massageLabLiquidEtherAutoIntensity: Number(event.target.value),
                    })
                  }
                  aria-label="Liquid Ether intensity"
                />
              </label>

              <label className={styles.rangeRow}>
                <span>
                  Resume ({(settings.massageLabLiquidEtherAutoResumeDelay / 1000).toFixed(1)}
                  s)
                </span>
                <input
                  type="range"
                  min="250"
                  max="5000"
                  step="250"
                  value={settings.massageLabLiquidEtherAutoResumeDelay}
                  onChange={(event) =>
                    onSettingsChange({
                      massageLabLiquidEtherAutoResumeDelay: Number(event.target.value),
                    })
                  }
                  aria-label="Liquid Ether resume delay"
                />
              </label>

              <label className={styles.rangeRow}>
                <span>Ramp ({settings.massageLabLiquidEtherAutoRampDuration.toFixed(1)}s)</span>
                <input
                  type="range"
                  min="0"
                  max="3"
                  step="0.1"
                  value={settings.massageLabLiquidEtherAutoRampDuration}
                  onChange={(event) =>
                    onSettingsChange({
                      massageLabLiquidEtherAutoRampDuration: Number(event.target.value),
                    })
                  }
                  aria-label="Liquid Ether ramp duration"
                />
              </label>
            </>
          )}

          <label className={styles.switchRow}>
            <span>Viscous fluid</span>
            <input
              type="checkbox"
              checked={settings.massageLabLiquidEtherIsViscous}
              onChange={(event) =>
                onSettingsChange({
                  massageLabLiquidEtherIsViscous: event.target.checked,
                })
              }
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
                onChange={(event) =>
                  onSettingsChange({
                    massageLabLiquidEtherViscous: Number(event.target.value),
                  })
                }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabLiquidEtherIterationsViscous: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabLiquidEtherIterationsPoisson: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabLiquidEtherDt: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabLiquidEtherResolution: Number(event.target.value),
                })
              }
              aria-label="Liquid Ether resolution"
            />
          </label>

          <label className={styles.switchRow}>
            <span>BFECC advection</span>
            <input
              type="checkbox"
              checked={settings.massageLabLiquidEtherBfecc}
              onChange={(event) =>
                onSettingsChange({
                  massageLabLiquidEtherBfecc: event.target.checked,
                })
              }
              aria-label="Liquid Ether BFECC advection"
            />
          </label>

          <label className={styles.switchRow}>
            <span>Bounce edges</span>
            <input
              type="checkbox"
              checked={settings.massageLabLiquidEtherIsBounce}
              onChange={(event) =>
                onSettingsChange({
                  massageLabLiquidEtherIsBounce: event.target.checked,
                })
              }
              aria-label="Liquid Ether bounce edges"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>
              Opacity ({Math.round(settings.massageLabLiquidEtherOpacity * 100)}
              %)
            </span>
            <input
              type="range"
              min="0.05"
              max="1"
              step="0.01"
              value={settings.massageLabLiquidEtherOpacity}
              onChange={(event) =>
                onSettingsChange({
                  massageLabLiquidEtherOpacity: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPrismAnimationType: event.target.value as MassageLabPrismAnimationType,
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPrismHeight: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPrismBaseWidth: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPrismGlow: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPrismBloom: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPrismNoise: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPrismScale: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPrismHueShift: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPrismColorFrequency: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPrismTimeScale: Number(event.target.value),
                })
              }
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
                  onChange={(event) =>
                    onSettingsChange({
                      massageLabPrismHoverStrength: Number(event.target.value),
                    })
                  }
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
                  onChange={(event) =>
                    onSettingsChange({
                      massageLabPrismInertia: Number(event.target.value),
                    })
                  }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPrismOffsetX: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPrismOffsetY: Number(event.target.value),
                })
              }
              aria-label="Prism vertical offset"
            />
          </label>

          <label className={styles.switchRow}>
            <span>Transparent blend</span>
            <input
              type="checkbox"
              checked={settings.massageLabPrismTransparent}
              onChange={(event) =>
                onSettingsChange({
                  massageLabPrismTransparent: event.target.checked,
                })
              }
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
            <span>Animation speed ({settings.massageLabDarkVeilSpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.05"
              value={settings.massageLabDarkVeilSpeed}
              onChange={(event) =>
                onSettingsChange({
                  massageLabDarkVeilSpeed: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabDarkVeilNoiseIntensity: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabDarkVeilScanlineIntensity: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabDarkVeilScanlineFrequency: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabDarkVeilWarpAmount: Number(event.target.value),
                })
              }
              aria-label="Dark Veil warp amount"
            />
          </label>

          <DarkVeilResolutionScaleControl
            value={settings.massageLabDarkVeilResolutionScale}
            onChange={(value) => onSettingsChange({ massageLabDarkVeilResolutionScale: value })}
          />
        </div>
      )
    }

    if (option.id === "massage-lab-light-pillar") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Quality</span>
            <select
              value={settings.massageLabLightPillarQuality}
              onChange={(event) =>
                onSettingsChange({
                  massageLabLightPillarQuality: event.target.value as MassageLabLightPillarQuality,
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabLightPillarBlendMode: event.target.value as MassageLabLightPillarBlendMode,
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabLightPillarIntensity: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabLightPillarRotationSpeed: Number(event.target.value),
                })
              }
              aria-label="Light Pillar rotation speed"
            />
          </label>

          <label className={styles.switchRow}>
            <span>Cursor rotation</span>
            <input
              type="checkbox"
              checked={settings.massageLabLightPillarInteractive}
              onChange={(event) =>
                onSettingsChange({
                  massageLabLightPillarInteractive: event.target.checked,
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabLightPillarGlowAmount: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabLightPillarWidth: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabLightPillarHeight: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabLightPillarNoiseIntensity: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabLightPillarRotation: Number(event.target.value),
                })
              }
              aria-label="Light Pillar rotation"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-silk") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.rangeRow}>
            <span>Speed ({settings.massageLabSilkSpeed.toFixed(1)}x)</span>
            <input
              type="range"
              min="0"
              max="10"
              step="0.1"
              value={settings.massageLabSilkSpeed}
              onChange={(event) =>
                onSettingsChange({
                  massageLabSilkSpeed: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabSilkScale: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabSilkNoiseIntensity: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabSilkRotation: Number(event.target.value),
                })
              }
              aria-label="Silk rotation"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-floating-lines") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Blend mode</span>
            <select
              value={settings.massageLabFloatingLinesBlendMode}
              onChange={(event) =>
                onSettingsChange({
                  massageLabFloatingLinesBlendMode: event.target.value as MassageLabFloatingLinesBlendMode,
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabFloatingLinesAnimationSpeed: Number(event.target.value),
                })
              }
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
                  <input type="checkbox" checked={settings[enabledKey]} onChange={(event) => onSettingsChange({ [enabledKey]: event.target.checked })} aria-label={`Floating Lines ${key} wave`} />
                </label>
                <label className={styles.rangeRow}>
                  <span>
                    {waveName} count ({settings[countKey]})
                  </span>
                  <input
                    type="range"
                    min="0"
                    max="32"
                    step="1"
                    value={settings[countKey]}
                    onChange={(event) =>
                      onSettingsChange({
                        [countKey]: Number(event.target.value),
                      })
                    }
                    aria-label={`Floating Lines ${key} line count`}
                  />
                </label>
                <label className={styles.rangeRow}>
                  <span>
                    {waveName} spacing ({settings[distanceKey].toFixed(1)})
                  </span>
                  <input
                    type="range"
                    min="0.1"
                    max="20"
                    step="0.1"
                    value={settings[distanceKey]}
                    onChange={(event) =>
                      onSettingsChange({
                        [distanceKey]: Number(event.target.value),
                      })
                    }
                    aria-label={`Floating Lines ${key} line spacing`}
                  />
                </label>
                <label className={styles.rangeRow}>
                  <span>
                    {waveName} X ({settings[waveXKey].toFixed(1)})
                  </span>
                  <input
                    type="range"
                    min="-20"
                    max="20"
                    step="0.1"
                    value={settings[waveXKey]}
                    onChange={(event) =>
                      onSettingsChange({
                        [waveXKey]: Number(event.target.value),
                      })
                    }
                    aria-label={`Floating Lines ${key} wave X`}
                  />
                </label>
                <label className={styles.rangeRow}>
                  <span>
                    {waveName} Y ({settings[waveYKey].toFixed(1)})
                  </span>
                  <input
                    type="range"
                    min="-4"
                    max="4"
                    step="0.1"
                    value={settings[waveYKey]}
                    onChange={(event) =>
                      onSettingsChange({
                        [waveYKey]: Number(event.target.value),
                      })
                    }
                    aria-label={`Floating Lines ${key} wave Y`}
                  />
                </label>
                <label className={styles.rangeRow}>
                  <span>
                    {waveName} rotation ({settings[rotateKey].toFixed(2)})
                  </span>
                  <input
                    type="range"
                    min="-4"
                    max="4"
                    step="0.05"
                    value={settings[rotateKey]}
                    onChange={(event) =>
                      onSettingsChange({
                        [rotateKey]: Number(event.target.value),
                      })
                    }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabFloatingLinesInteractive: event.target.checked,
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabFloatingLinesBendRadius: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabFloatingLinesBendStrength: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabFloatingLinesMouseDamping: Number(event.target.value),
                })
              }
              aria-label="Floating Lines mouse damping"
            />
          </label>

          <label className={styles.switchRow}>
            <span>Parallax</span>
            <input
              type="checkbox"
              checked={settings.massageLabFloatingLinesParallax}
              onChange={(event) =>
                onSettingsChange({
                  massageLabFloatingLinesParallax: event.target.checked,
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabFloatingLinesParallaxStrength: Number(event.target.value),
                })
              }
              aria-label="Floating Lines parallax strength"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-side-rays") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Origin</span>
            <select
              value={settings.massageLabSideRaysOrigin}
              onChange={(event) =>
                onSettingsChange({
                  massageLabSideRaysOrigin: event.target.value as MassageLabSideRaysOrigin,
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabSideRaysSpeed: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabSideRaysIntensity: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabSideRaysSpread: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabSideRaysTilt: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabSideRaysSaturation: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabSideRaysBlend: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabSideRaysFalloff: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabSideRaysOpacity: Number(event.target.value),
                })
              }
              aria-label="Side Rays opacity"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-light-rays") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Origin</span>
            <select
              value={settings.massageLabLightRaysOrigin}
              onChange={(event) =>
                onSettingsChange({
                  massageLabLightRaysOrigin: event.target.value as MassageLabLightRaysOrigin,
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabLightRaysPulsating: event.target.checked,
                })
              }
              aria-label="Light Rays pulsating"
            />
            <span>Pulsating rays</span>
          </label>

          <label className={styles.selectRow}>
            <input
              type="checkbox"
              checked={settings.massageLabLightRaysFollowMouse}
              onChange={(event) =>
                onSettingsChange({
                  massageLabLightRaysFollowMouse: event.target.checked,
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabLightRaysSpeed: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabLightRaysSpread: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabLightRaysLength: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabLightRaysFadeDistance: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabLightRaysSaturation: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabLightRaysMouseInfluence: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabLightRaysNoiseAmount: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabLightRaysDistortion: Number(event.target.value),
                })
              }
              aria-label="Light Rays distortion"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-pixel-blast") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Shape</span>
            <select
              value={settings.massageLabPixelBlastVariant}
              onChange={(event) =>
                onSettingsChange({
                  massageLabPixelBlastVariant: event.target.value as MassageLabPixelBlastVariant,
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPixelBlastAntialias: event.target.checked,
                })
              }
              aria-label="MassageLab Pixel Blast antialias"
            />
            <span>Antialias edges</span>
          </label>

          <label className={styles.selectRow}>
            <input
              type="checkbox"
              checked={settings.massageLabPixelBlastEnableRipples}
              onChange={(event) =>
                onSettingsChange({
                  massageLabPixelBlastEnableRipples: event.target.checked,
                })
              }
              aria-label="MassageLab Pixel Blast ripple clicks"
            />
            <span>Ripple clicks</span>
          </label>

          <label className={styles.selectRow}>
            <input
              type="checkbox"
              checked={settings.massageLabPixelBlastLiquid}
              onChange={(event) =>
                onSettingsChange({
                  massageLabPixelBlastLiquid: event.target.checked,
                })
              }
              aria-label="MassageLab Pixel Blast liquid pointer warp"
            />
            <span>Liquid pointer warp</span>
          </label>

          <label className={styles.selectRow}>
            <input
              type="checkbox"
              checked={settings.massageLabPixelBlastTransparent}
              onChange={(event) =>
                onSettingsChange({
                  massageLabPixelBlastTransparent: event.target.checked,
                })
              }
              aria-label="MassageLab Pixel Blast transparent background"
            />
            <span>Transparent background</span>
          </label>

          <label className={styles.selectRow}>
            <input
              type="checkbox"
              checked={settings.massageLabPixelBlastAutoPauseOffscreen}
              onChange={(event) =>
                onSettingsChange({
                  massageLabPixelBlastAutoPauseOffscreen: event.target.checked,
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPixelBlastPixelSize: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPixelBlastPatternScale: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPixelBlastPatternDensity: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPixelBlastSpeed: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPixelBlastPixelSizeJitter: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPixelBlastEdgeFade: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPixelBlastRippleIntensityScale: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPixelBlastRippleThickness: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPixelBlastRippleSpeed: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPixelBlastLiquidStrength: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPixelBlastLiquidRadius: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPixelBlastLiquidWobbleSpeed: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPixelBlastNoiseAmount: Number(event.target.value),
                })
              }
              aria-label="MassageLab Pixel Blast noise amount"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-color-bends") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <input
              type="checkbox"
              checked={settings.massageLabColorBendsTransparent}
              onChange={(event) =>
                onSettingsChange({
                  massageLabColorBendsTransparent: event.target.checked,
                })
              }
              aria-label="MassageLab Color Bends transparent background"
            />
            <span>Transparent background</span>
          </label>

          <label className={styles.selectRow}>
            <input
              type="checkbox"
              checked={settings.massageLabColorBendsInteractive}
              onChange={(event) =>
                onSettingsChange({
                  massageLabColorBendsInteractive: event.target.checked,
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabColorBendsRotation: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabColorBendsSpeed: Number(event.target.value),
                })
              }
              aria-label="MassageLab Color Bends speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>
              Auto rotate ({settings.massageLabColorBendsAutoRotate.toFixed(0)}
              deg/s)
            </span>
            <input
              type="range"
              min="-180"
              max="180"
              step="1"
              value={settings.massageLabColorBendsAutoRotate}
              onChange={(event) =>
                onSettingsChange({
                  massageLabColorBendsAutoRotate: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabColorBendsScale: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabColorBendsFrequency: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabColorBendsWarpStrength: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabColorBendsMouseInfluence: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabColorBendsParallax: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabColorBendsNoise: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabColorBendsIterations: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabColorBendsIntensity: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabColorBendsBandWidth: Number(event.target.value),
                })
              }
              aria-label="MassageLab Color Bends band width"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-evil-eye") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <input
              type="checkbox"
              checked={settings.massageLabEvilEyeInteractive}
              onChange={(event) =>
                onSettingsChange({
                  massageLabEvilEyeInteractive: event.target.checked,
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabEvilEyeIntensity: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabEvilEyePupilSize: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabEvilEyeIrisWidth: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabEvilEyeGlowIntensity: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabEvilEyeScale: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabEvilEyeNoiseScale: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabEvilEyePupilFollow: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabEvilEyeFlameSpeed: Number(event.target.value),
                })
              }
              aria-label="MassageLab Evil Eye flame speed"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-line-waves") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <input
              type="checkbox"
              checked={settings.massageLabLineWavesEnableMouseInteraction}
              onChange={(event) =>
                onSettingsChange({
                  massageLabLineWavesEnableMouseInteraction: event.target.checked,
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabLineWavesSpeed: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabLineWavesInnerLineCount: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabLineWavesOuterLineCount: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabLineWavesWarpIntensity: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabLineWavesRotation: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabLineWavesEdgeFadeWidth: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabLineWavesColorCycleSpeed: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabLineWavesBrightness: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabLineWavesMouseInfluence: Number(event.target.value),
                })
              }
              aria-label="MassageLab Line Waves mouse influence"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-radar") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <input
              type="checkbox"
              checked={settings.massageLabRadarEnableMouseInteraction}
              onChange={(event) =>
                onSettingsChange({
                  massageLabRadarEnableMouseInteraction: event.target.checked,
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabRadarSpeed: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabRadarScale: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabRadarRingCount: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabRadarSpokeCount: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabRadarRingThickness: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabRadarSpokeThickness: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabRadarSweepSpeed: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabRadarSweepWidth: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabRadarSweepLobes: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabRadarFalloff: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabRadarBrightness: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabRadarMouseInfluence: Number(event.target.value),
                })
              }
              aria-label="MassageLab Radar mouse influence"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-soft-aurora") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.checkboxRow}>
            <span>Mouse shift</span>
            <input
              type="checkbox"
              checked={settings.massageLabSoftAuroraEnableMouseInteraction}
              onChange={(event) =>
                onSettingsChange({
                  massageLabSoftAuroraEnableMouseInteraction: event.target.checked,
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabSoftAuroraSpeed: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabSoftAuroraScale: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabSoftAuroraBrightness: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabSoftAuroraNoiseFrequency: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabSoftAuroraNoiseAmplitude: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabSoftAuroraBandHeight: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabSoftAuroraBandSpread: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabSoftAuroraOctaveDecay: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabSoftAuroraLayerOffset: Number(event.target.value),
                })
              }
              aria-label="MassageLab Soft Aurora layer offset"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>
              Color speed ({settings.massageLabSoftAuroraColorSpeed.toFixed(2)}
              x)
            </span>
            <input
              type="range"
              min="0"
              max="4"
              step="0.05"
              value={settings.massageLabSoftAuroraColorSpeed}
              onChange={(event) =>
                onSettingsChange({
                  massageLabSoftAuroraColorSpeed: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabSoftAuroraMouseInfluence: Number(event.target.value),
                })
              }
              aria-label="MassageLab Soft Aurora mouse influence"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-plasma") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Direction</span>
            <select
              value={settings.massageLabPlasmaDirection}
              onChange={(event) =>
                onSettingsChange({
                  massageLabPlasmaDirection: event.target.value as MassageLabPlasmaDirection,
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPlasmaMouseInteractive: event.target.checked,
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPlasmaSpeed: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPlasmaScale: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPlasmaOpacity: Number(event.target.value),
                })
              }
              aria-label="MassageLab Plasma opacity"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-plasma-wave") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Wave 2 direction</span>
            <select
              value={settings.massageLabPlasmaWaveDirectionTwo}
              onChange={(event) =>
                onSettingsChange({
                  massageLabPlasmaWaveDirectionTwo: Number(event.target.value) as 1 | -1,
                })
              }
              aria-label="MassageLab Plasma Wave secondary direction"
            >
              <option value={1}>Forward</option>
              <option value={-1}>Reverse</option>
            </select>
          </label>

          <label className={styles.rangeRow}>
            <span>
              Rotation ({settings.massageLabPlasmaWaveRotationDeg.toFixed(0)}
              deg)
            </span>
            <input
              type="range"
              min="-180"
              max="180"
              step="1"
              value={settings.massageLabPlasmaWaveRotationDeg}
              onChange={(event) =>
                onSettingsChange({
                  massageLabPlasmaWaveRotationDeg: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPlasmaWaveFocalLength: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPlasmaWaveSpeedOne: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPlasmaWaveSpeedTwo: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPlasmaWaveBendOne: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPlasmaWaveBendTwo: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPlasmaWaveXOffset: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPlasmaWaveYOffset: Number(event.target.value),
                })
              }
              aria-label="MassageLab Plasma Wave y offset"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-particles") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={settings.massageLabParticlesMoveOnHover}
              onChange={(event) =>
                onSettingsChange({
                  massageLabParticlesMoveOnHover: event.target.checked,
                })
              }
            />
            <span>Move on cursor</span>
          </label>

          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={settings.massageLabParticlesAlpha}
              onChange={(event) =>
                onSettingsChange({
                  massageLabParticlesAlpha: event.target.checked,
                })
              }
            />
            <span>Soft alpha particles</span>
          </label>

          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={!settings.massageLabParticlesDisableRotation}
              onChange={(event) =>
                onSettingsChange({
                  massageLabParticlesDisableRotation: !event.target.checked,
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabParticlesCount: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabParticlesSpread: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabParticlesSpeed: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabParticlesHoverFactor: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabParticlesBaseSize: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabParticlesSizeRandomness: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabParticlesCameraDistance: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabParticlesPixelRatio: Number(event.target.value),
                })
              }
              aria-label="MassageLab Particles pixel ratio"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-gradient-blinds") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={settings.massageLabGradientBlindsEnableMouseInteraction}
              onChange={(event) =>
                onSettingsChange({
                  massageLabGradientBlindsEnableMouseInteraction: event.target.checked,
                })
              }
            />
            <span>Cursor spotlight</span>
          </label>

          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={settings.massageLabGradientBlindsMirror}
              onChange={(event) =>
                onSettingsChange({
                  massageLabGradientBlindsMirror: event.target.checked,
                })
              }
            />
            <span>Mirror gradient</span>
          </label>

          <label className={styles.selectRow}>
            <span>Shine direction</span>
            <select
              value={settings.massageLabGradientBlindsShineDirection}
              onChange={(event) =>
                onSettingsChange({
                  massageLabGradientBlindsShineDirection: event.target.value as MassageLabGradientBlindsShineDirection,
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabGradientBlindsBlendMode: event.target.value as MassageLabGradientBlindsBlendMode,
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabGradientBlindsAngle: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabGradientBlindsNoise: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabGradientBlindsBlindCount: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabGradientBlindsBlindMinWidth: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabGradientBlindsMouseDampening: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabGradientBlindsSpotlightRadius: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabGradientBlindsSpotlightSoftness: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabGradientBlindsSpotlightOpacity: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabGradientBlindsDistort: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabGradientBlindsDpr: Number(event.target.value),
                })
              }
              aria-label="MassageLab Gradient Blinds dpr"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-grainient") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={settings.massageLabGrainientGrainAnimated}
              onChange={(event) =>
                onSettingsChange({
                  massageLabGrainientGrainAnimated: event.target.checked,
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabGrainientTimeSpeed: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabGrainientColorBalance: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabGrainientWarpStrength: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabGrainientWarpFrequency: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabGrainientWarpSpeed: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabGrainientWarpAmplitude: Number(event.target.value),
                })
              }
              aria-label="MassageLab Grainient warp amplitude"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>
              Blend angle ({settings.massageLabGrainientBlendAngle.toFixed(0)}
              deg)
            </span>
            <input
              type="range"
              min="-180"
              max="180"
              step="1"
              value={settings.massageLabGrainientBlendAngle}
              onChange={(event) =>
                onSettingsChange({
                  massageLabGrainientBlendAngle: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabGrainientBlendSoftness: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabGrainientRotationAmount: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabGrainientNoiseScale: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabGrainientGrainAmount: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabGrainientGrainScale: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabGrainientContrast: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabGrainientGamma: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabGrainientSaturation: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabGrainientCenterX: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabGrainientCenterY: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabGrainientZoom: Number(event.target.value),
                })
              }
              aria-label="MassageLab Grainient zoom"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-grid-scan") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={settings.massageLabGridScanEnablePointerInteraction}
              onChange={(event) =>
                onSettingsChange({
                  massageLabGridScanEnablePointerInteraction: event.target.checked,
                })
              }
            />
            <span>Pointer skew</span>
          </label>

          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={settings.massageLabGridScanScanOnClick}
              onChange={(event) =>
                onSettingsChange({
                  massageLabGridScanScanOnClick: event.target.checked,
                })
              }
            />
            <span>Click scan pulses</span>
          </label>

          <label className={styles.selectRow}>
            <span>Line style</span>
            <select
              value={settings.massageLabGridScanLineStyle}
              onChange={(event) =>
                onSettingsChange({
                  massageLabGridScanLineStyle: event.target.value as MassageLabGridScanLineStyle,
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabGridScanDirection: event.target.value as MassageLabGridScanDirection,
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabGridScanSensitivity: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabGridScanLineThickness: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabGridScanScanOpacity: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabGridScanGridScale: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabGridScanLineJitter: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabGridScanNoiseIntensity: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabGridScanBloomOpacity: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabGridScanScanGlow: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabGridScanScanSoftness: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabGridScanPhaseTaper: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabGridScanScanDuration: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabGridScanScanDelay: Number(event.target.value),
                })
              }
              aria-label="MassageLab Grid Scan delay"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-beams") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.rangeRow}>
            <span>Beam width ({settings.massageLabBeamsBeamWidth.toFixed(1)})</span>
            <input
              type="range"
              min="0.2"
              max="6"
              step="0.1"
              value={settings.massageLabBeamsBeamWidth}
              onChange={(event) =>
                onSettingsChange({
                  massageLabBeamsBeamWidth: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabBeamsBeamHeight: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabBeamsBeamNumber: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabBeamsSpeed: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabBeamsNoiseIntensity: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabBeamsScale: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabBeamsRotation: Number(event.target.value),
                })
              }
              aria-label="MassageLab Beams rotation"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-pixel-snow") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Variant</span>
            <select
              value={settings.massageLabPixelSnowVariant}
              onChange={(event) =>
                onSettingsChange({
                  massageLabPixelSnowVariant: event.target.value as MassageLabPixelSnowVariant,
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPixelSnowFlakeSize: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPixelSnowMinFlakeSize: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPixelSnowPixelResolution: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPixelSnowSpeed: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPixelSnowDepthFade: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPixelSnowFarPlane: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPixelSnowBrightness: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPixelSnowGamma: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPixelSnowDensity: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPixelSnowDirection: Number(event.target.value),
                })
              }
              aria-label="MassageLab Pixel Snow direction"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-lightning") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.rangeRow}>
            <span>X offset ({settings.massageLabLightningXOffset.toFixed(2)})</span>
            <input
              type="range"
              min="-2"
              max="2"
              step="0.05"
              value={settings.massageLabLightningXOffset}
              onChange={(event) =>
                onSettingsChange({
                  massageLabLightningXOffset: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabLightningSpeed: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabLightningIntensity: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabLightningSize: Number(event.target.value),
                })
              }
              aria-label="MassageLab Lightning size"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-prismatic-burst") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Animation</span>
            <select
              value={settings.massageLabPrismaticBurstAnimationType}
              onChange={(event) =>
                onSettingsChange({
                  massageLabPrismaticBurstAnimationType: event.target.value as MassageLabPrismaticBurstAnimationType,
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPrismaticBurstMixBlendMode: event.target.value as MassageLabPrismaticBurstMixBlendMode,
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPrismaticBurstIntensity: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPrismaticBurstSpeed: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPrismaticBurstDistort: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPrismaticBurstOffsetX: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPrismaticBurstOffsetY: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPrismaticBurstHoverDampness: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPrismaticBurstRayCount: Number(event.target.value),
                })
              }
              aria-label="MassageLab Prismatic Burst ray count"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-galaxy") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <input
              type="checkbox"
              checked={settings.massageLabGalaxyTransparent}
              onChange={(event) =>
                onSettingsChange({
                  massageLabGalaxyTransparent: event.target.checked,
                })
              }
              aria-label="MassageLab Galaxy transparent background"
            />
            <span>Transparent background</span>
          </label>

          <label className={styles.selectRow}>
            <input
              type="checkbox"
              checked={settings.massageLabGalaxyMouseInteraction}
              onChange={(event) =>
                onSettingsChange({
                  massageLabGalaxyMouseInteraction: event.target.checked,
                })
              }
              aria-label="MassageLab Galaxy cursor interaction"
            />
            <span>Cursor interaction</span>
          </label>

          <label className={styles.selectRow}>
            <input
              type="checkbox"
              checked={settings.massageLabGalaxyMouseRepulsion}
              onChange={(event) =>
                onSettingsChange({
                  massageLabGalaxyMouseRepulsion: event.target.checked,
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabGalaxyFocalX: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabGalaxyFocalY: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabGalaxyRotationDeg: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabGalaxyStarSpeed: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabGalaxyDensity: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabGalaxySpeed: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabGalaxyGlowIntensity: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabGalaxySaturation: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabGalaxyTwinkleIntensity: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabGalaxyRotationSpeed: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabGalaxyRepulsionStrength: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabGalaxyAutoCenterRepulsion: Number(event.target.value),
                })
              }
              aria-label="MassageLab Galaxy center repulsion"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-dither") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <input
              type="checkbox"
              checked={settings.massageLabDitherMouseInteraction}
              onChange={(event) =>
                onSettingsChange({
                  massageLabDitherMouseInteraction: event.target.checked,
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabDitherWaveSpeed: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabDitherWaveFrequency: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabDitherWaveAmplitude: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabDitherColorNum: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabDitherPixelSize: Number(event.target.value),
                })
              }
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
                onChange={(event) =>
                  onSettingsChange({
                    massageLabDitherMouseRadius: Number(event.target.value),
                  })
                }
                aria-label="MassageLab Dither cursor radius"
              />
            </label>
          ) : null}
        </div>
      )
    }

    if (option.id === "massage-lab-faulty-terminal") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <input
              type="checkbox"
              checked={settings.massageLabFaultyTerminalMouseReact}
              onChange={(event) =>
                onSettingsChange({
                  massageLabFaultyTerminalMouseReact: event.target.checked,
                })
              }
              aria-label="MassageLab Faulty Terminal cursor reaction"
            />
            <span>Cursor reaction</span>
          </label>

          <label className={styles.selectRow}>
            <input
              type="checkbox"
              checked={settings.massageLabFaultyTerminalPageLoadAnimation}
              onChange={(event) =>
                onSettingsChange({
                  massageLabFaultyTerminalPageLoadAnimation: event.target.checked,
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabFaultyTerminalScale: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabFaultyTerminalGridMulX: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabFaultyTerminalGridMulY: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabFaultyTerminalDigitSize: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabFaultyTerminalTimeScale: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabFaultyTerminalScanlineIntensity: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabFaultyTerminalGlitchAmount: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabFaultyTerminalFlickerAmount: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabFaultyTerminalNoiseAmp: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabFaultyTerminalChromaticAberration: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabFaultyTerminalDither: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabFaultyTerminalCurvature: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabFaultyTerminalBrightness: Number(event.target.value),
                })
              }
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
                onChange={(event) =>
                  onSettingsChange({
                    massageLabFaultyTerminalMouseStrength: Number(event.target.value),
                  })
                }
                aria-label="MassageLab Faulty Terminal cursor strength"
              />
            </label>
          ) : null}
        </div>
      )
    }

    if (option.id === "massage-lab-ripple-grid") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <input
              type="checkbox"
              checked={settings.massageLabRippleGridMouseInteraction}
              onChange={(event) =>
                onSettingsChange({
                  massageLabRippleGridMouseInteraction: event.target.checked,
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabRippleGridRippleIntensity: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabRippleGridGridSize: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabRippleGridGridThickness: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabRippleGridFadeDistance: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabRippleGridVignetteStrength: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabRippleGridGlowIntensity: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabRippleGridOpacity: Number(event.target.value),
                })
              }
              aria-label="MassageLab Ripple Grid opacity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>
              Rotation ({settings.massageLabRippleGridGridRotation.toFixed(0)}
              deg)
            </span>
            <input
              type="range"
              min="-180"
              max="180"
              step="1"
              value={settings.massageLabRippleGridGridRotation}
              onChange={(event) =>
                onSettingsChange({
                  massageLabRippleGridGridRotation: Number(event.target.value),
                })
              }
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
                onChange={(event) =>
                  onSettingsChange({
                    massageLabRippleGridMouseInteractionRadius: Number(event.target.value),
                  })
                }
                aria-label="MassageLab Ripple Grid cursor radius"
              />
            </label>
          ) : null}
        </div>
      )
    }

    if (option.id === "massage-lab-dot-field") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.switchRow}>
            <span>Cursor interaction</span>
            <input
              type="checkbox"
              checked={settings.massageLabDotFieldCursorInteraction}
              onChange={(event) =>
                onSettingsChange({
                  massageLabDotFieldCursorInteraction: event.target.checked,
                })
              }
              aria-label="MassageLab Dot Field cursor interaction"
            />
          </label>

          <label className={styles.switchRow}>
            <span>Bulge mode</span>
            <input
              type="checkbox"
              checked={settings.massageLabDotFieldBulgeOnly}
              onChange={(event) =>
                onSettingsChange({
                  massageLabDotFieldBulgeOnly: event.target.checked,
                })
              }
              aria-label="MassageLab Dot Field bulge mode"
            />
          </label>

          <label className={styles.switchRow}>
            <span>Sparkle</span>
            <input
              type="checkbox"
              checked={settings.massageLabDotFieldSparkle}
              onChange={(event) =>
                onSettingsChange({
                  massageLabDotFieldSparkle: event.target.checked,
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabDotFieldDotRadius: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabDotFieldDotSpacing: Number(event.target.value),
                })
              }
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
                  onChange={(event) =>
                    onSettingsChange({
                      massageLabDotFieldCursorRadius: Number(event.target.value),
                    })
                  }
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
                  onChange={(event) =>
                    onSettingsChange({
                      massageLabDotFieldCursorForce: Number(event.target.value),
                    })
                  }
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
                  onChange={(event) =>
                    onSettingsChange({
                      massageLabDotFieldBulgeStrength: Number(event.target.value),
                    })
                  }
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
                  onChange={(event) =>
                    onSettingsChange({
                      massageLabDotFieldGlowRadius: Number(event.target.value),
                    })
                  }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabDotFieldWaveAmplitude: Number(event.target.value),
                })
              }
              aria-label="MassageLab Dot Field wave amplitude"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-dot-grid") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.switchRow}>
            <span>Cursor interaction</span>
            <input
              type="checkbox"
              checked={settings.massageLabDotGridCursorInteraction}
              onChange={(event) =>
                onSettingsChange({
                  massageLabDotGridCursorInteraction: event.target.checked,
                })
              }
              aria-label="MassageLab Dot Grid cursor interaction"
            />
          </label>

          <label className={styles.switchRow}>
            <span>Simulate cursor interaction</span>
            <input
              type="checkbox"
              checked={settings.massageLabDotGridSimulateCursorInteraction}
              onChange={(event) =>
                onSettingsChange({
                  massageLabDotGridSimulateCursorInteraction: event.target.checked,
                })
              }
              aria-label="MassageLab Dot Grid simulate cursor interaction"
            />
          </label>

          {settings.massageLabDotGridSimulateCursorInteraction ? (
            <label className={styles.rangeRow}>
              <span>Fake cursor speed ({settings.massageLabDotGridSimulationSpeed.toFixed(1)}x)</span>
              <input
                type="range"
                min="0.3"
                max="2"
                step="0.1"
                value={settings.massageLabDotGridSimulationSpeed}
                onChange={(event) =>
                  onSettingsChange({
                    massageLabDotGridSimulationSpeed: Number(event.target.value),
                  })
                }
                aria-label="MassageLab Dot Grid fake cursor speed"
              />
            </label>
          ) : null}

          <label className={styles.switchRow}>
            <span>Click shock</span>
            <input
              type="checkbox"
              checked={settings.massageLabDotGridClickShock}
              onChange={(event) =>
                onSettingsChange({
                  massageLabDotGridClickShock: event.target.checked,
                })
              }
              aria-label="MassageLab Dot Grid click shock"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Dot size ({settings.massageLabDotGridDotSize.toFixed(1)})</span>
            <input
              type="range"
              min="2"
              max="40"
              step="0.5"
              value={settings.massageLabDotGridDotSize}
              onChange={(event) =>
                onSettingsChange({
                  massageLabDotGridDotSize: Number(event.target.value),
                })
              }
              aria-label="MassageLab Dot Grid dot size"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Gap ({settings.massageLabDotGridGap.toFixed(1)})</span>
            <input
              type="range"
              min="4"
              max="80"
              step="0.5"
              value={settings.massageLabDotGridGap}
              onChange={(event) =>
                onSettingsChange({
                  massageLabDotGridGap: Number(event.target.value),
                })
              }
              aria-label="MassageLab Dot Grid gap"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Proximity ({settings.massageLabDotGridProximity.toFixed(0)})</span>
            <input
              type="range"
              min="40"
              max="500"
              step="5"
              value={settings.massageLabDotGridProximity}
              onChange={(event) =>
                onSettingsChange({
                  massageLabDotGridProximity: Number(event.target.value),
                })
              }
              aria-label="MassageLab Dot Grid proximity"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Speed trigger ({settings.massageLabDotGridSpeedTrigger.toFixed(0)})</span>
            <input
              type="range"
              min="0"
              max="1000"
              step="10"
              value={settings.massageLabDotGridSpeedTrigger}
              onChange={(event) =>
                onSettingsChange({
                  massageLabDotGridSpeedTrigger: Number(event.target.value),
                })
              }
              aria-label="MassageLab Dot Grid speed trigger"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Shock radius ({settings.massageLabDotGridShockRadius.toFixed(0)})</span>
            <input
              type="range"
              min="40"
              max="700"
              step="10"
              value={settings.massageLabDotGridShockRadius}
              onChange={(event) =>
                onSettingsChange({
                  massageLabDotGridShockRadius: Number(event.target.value),
                })
              }
              aria-label="MassageLab Dot Grid shock radius"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Shock strength ({settings.massageLabDotGridShockStrength.toFixed(1)})</span>
            <input
              type="range"
              min="0"
              max="12"
              step="0.1"
              value={settings.massageLabDotGridShockStrength}
              onChange={(event) =>
                onSettingsChange({
                  massageLabDotGridShockStrength: Number(event.target.value),
                })
              }
              aria-label="MassageLab Dot Grid shock strength"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Max speed ({settings.massageLabDotGridMaxSpeed.toFixed(0)})</span>
            <input
              type="range"
              min="100"
              max="8000"
              step="100"
              value={settings.massageLabDotGridMaxSpeed}
              onChange={(event) =>
                onSettingsChange({
                  massageLabDotGridMaxSpeed: Number(event.target.value),
                })
              }
              aria-label="MassageLab Dot Grid max speed"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Resistance ({settings.massageLabDotGridResistance.toFixed(0)})</span>
            <input
              type="range"
              min="120"
              max="1600"
              step="20"
              value={settings.massageLabDotGridResistance}
              onChange={(event) =>
                onSettingsChange({
                  massageLabDotGridResistance: Number(event.target.value),
                })
              }
              aria-label="MassageLab Dot Grid resistance"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Return ({settings.massageLabDotGridReturnDuration.toFixed(2)}s)</span>
            <input
              type="range"
              min="0.1"
              max="4"
              step="0.05"
              value={settings.massageLabDotGridReturnDuration}
              onChange={(event) =>
                onSettingsChange({
                  massageLabDotGridReturnDuration: Number(event.target.value),
                })
              }
              aria-label="MassageLab Dot Grid return duration"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-threads") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.switchRow}>
            <span>Mouse interaction</span>
            <input
              type="checkbox"
              checked={settings.massageLabThreadsEnableMouseInteraction}
              onChange={(event) =>
                onSettingsChange({
                  massageLabThreadsEnableMouseInteraction: event.target.checked,
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabThreadsAmplitude: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabThreadsDistance: Number(event.target.value),
                })
              }
              aria-label="MassageLab Threads distance"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-iridescence") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.switchRow}>
            <span>Mouse reaction</span>
            <input
              type="checkbox"
              checked={settings.massageLabIridescenceMouseReact}
              onChange={(event) =>
                onSettingsChange({
                  massageLabIridescenceMouseReact: event.target.checked,
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabIridescenceSpeed: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabIridescenceAmplitude: Number(event.target.value),
                })
              }
              aria-label="MassageLab Iridescence amplitude"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-waves") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.switchRow}>
            <span>Transparent background</span>
            <input
              type="checkbox"
              checked={settings.massageLabWavesTransparentBackground}
              onChange={(event) =>
                onSettingsChange({
                  massageLabWavesTransparentBackground: event.target.checked,
                })
              }
              aria-label="MassageLab Waves transparent background"
            />
          </label>

          {!settings.massageLabWavesTransparentBackground ? <></> : null}

          <label className={styles.switchRow}>
            <span>Cursor interaction</span>
            <input
              type="checkbox"
              checked={settings.massageLabWavesCursorInteraction}
              onChange={(event) =>
                onSettingsChange({
                  massageLabWavesCursorInteraction: event.target.checked,
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabWavesSpeedX: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabWavesSpeedY: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabWavesAmplitudeX: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabWavesAmplitudeY: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabWavesGapX: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabWavesGapY: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabWavesFriction: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabWavesTension: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabWavesMaxCursorMove: Number(event.target.value),
                })
              }
              aria-label="MassageLab Waves max cursor movement"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-grid-distortion") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.switchRow}>
            <span>Cursor interaction</span>
            <input
              type="checkbox"
              checked={settings.massageLabGridDistortionCursorInteraction}
              onChange={(event) =>
                onSettingsChange({
                  massageLabGridDistortionCursorInteraction: event.target.checked,
                })
              }
              aria-label="MassageLab Grid Distortion cursor interaction"
            />
          </label>

          <label className={styles.switchRow}>
            <span>Simulate cursor interaction</span>
            <input
              type="checkbox"
              checked={settings.massageLabGridDistortionSimulateCursorInteraction}
              onChange={(event) =>
                onSettingsChange({
                  massageLabGridDistortionSimulateCursorInteraction: event.target.checked,
                })
              }
              aria-label="MassageLab Grid Distortion simulate cursor interaction"
            />
          </label>

          {settings.massageLabGridDistortionSimulateCursorInteraction ? (
            <label className={styles.rangeRow}>
              <span>Fake cursor speed ({settings.massageLabGridDistortionSimulationSpeed.toFixed(1)}x)</span>
              <input
                type="range"
                min="0.3"
                max="2"
                step="0.1"
                value={settings.massageLabGridDistortionSimulationSpeed}
                onChange={(event) =>
                  onSettingsChange({
                    massageLabGridDistortionSimulationSpeed: Number(event.target.value),
                  })
                }
                aria-label="MassageLab Grid Distortion fake cursor speed"
              />
            </label>
          ) : null}

          <label className={styles.rangeRow}>
            <span>Grid ({settings.massageLabGridDistortionGrid.toFixed(0)})</span>
            <input
              type="range"
              min="4"
              max="40"
              step="1"
              value={settings.massageLabGridDistortionGrid}
              onChange={(event) =>
                onSettingsChange({
                  massageLabGridDistortionGrid: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabGridDistortionMouse: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabGridDistortionStrength: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabGridDistortionRelaxation: Number(event.target.value),
                })
              }
              aria-label="MassageLab Grid Distortion relaxation"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-orb") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.switchRow}>
            <span>Cursor interaction</span>
            <input
              type="checkbox"
              checked={settings.massageLabOrbCursorInteraction}
              onChange={(event) =>
                onSettingsChange({
                  massageLabOrbCursorInteraction: event.target.checked,
                })
              }
              aria-label="MassageLab Orb cursor interaction"
            />
          </label>

          <label className={styles.switchRow}>
            <span>Rotate on hover</span>
            <input
              type="checkbox"
              checked={settings.massageLabOrbRotateOnHover}
              onChange={(event) =>
                onSettingsChange({
                  massageLabOrbRotateOnHover: event.target.checked,
                })
              }
              aria-label="MassageLab Orb rotate on hover"
            />
          </label>

          <label className={styles.switchRow}>
            <span>Force hover state</span>
            <input
              type="checkbox"
              checked={settings.massageLabOrbForceHoverState}
              onChange={(event) =>
                onSettingsChange({
                  massageLabOrbForceHoverState: event.target.checked,
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabOrbHoverIntensity: Number(event.target.value),
                })
              }
              aria-label="MassageLab Orb hover intensity"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-letter-glitch") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.switchRow}>
            <span>Center vignette</span>
            <input
              type="checkbox"
              checked={settings.massageLabLetterGlitchCenterVignette}
              onChange={(event) =>
                onSettingsChange({
                  massageLabLetterGlitchCenterVignette: event.target.checked,
                })
              }
              aria-label="MassageLab Letter Glitch center vignette"
            />
          </label>

          <label className={styles.switchRow}>
            <span>Outer vignette</span>
            <input
              type="checkbox"
              checked={settings.massageLabLetterGlitchOuterVignette}
              onChange={(event) =>
                onSettingsChange({
                  massageLabLetterGlitchOuterVignette: event.target.checked,
                })
              }
              aria-label="MassageLab Letter Glitch outer vignette"
            />
          </label>

          <label className={styles.switchRow}>
            <span>Smooth colors</span>
            <input
              type="checkbox"
              checked={settings.massageLabLetterGlitchSmooth}
              onChange={(event) =>
                onSettingsChange({
                  massageLabLetterGlitchSmooth: event.target.checked,
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabLetterGlitchGlitchSpeed: Number(event.target.value),
                })
              }
              aria-label="MassageLab Letter Glitch speed"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-grid-motion") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.switchRow}>
            <span>Cursor interaction</span>
            <input
              type="checkbox"
              checked={settings.massageLabGridMotionCursorInteraction}
              onChange={(event) =>
                onSettingsChange({
                  massageLabGridMotionCursorInteraction: event.target.checked,
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabGridMotionMaxMoveAmount: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabGridMotionBaseDuration: Number(event.target.value),
                })
              }
              aria-label="MassageLab Grid Motion base duration"
            />
          </label>

          <GridMotionMantraEditor
            value={settings.massageLabGridMotionMantras}
            onChange={(massageLabGridMotionMantras) =>
              onSettingsChange({ massageLabGridMotionMantras })
            }
          />
        </div>
      )
    }

    if (option.id === "massage-lab-shape-grid") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.selectRow}>
            <span>Direction</span>
            <select
              value={settings.massageLabShapeGridDirection}
              onChange={(event) =>
                onSettingsChange({
                  massageLabShapeGridDirection: event.target.value as ChimerSettings["massageLabShapeGridDirection"],
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabShapeGridShape: event.target.value as ChimerSettings["massageLabShapeGridShape"],
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabShapeGridCursorInteraction: event.target.checked,
                })
              }
              aria-label="MassageLab Shape Grid cursor interaction"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Speed ({getMassageLabShapeGridSpeedDisplayPercent(settings.massageLabShapeGridSpeed)}%)</span>
            <input
              type="range"
              min="0"
              max="100"
              step="2.5"
              value={getMassageLabShapeGridSpeedDisplayPercent(settings.massageLabShapeGridSpeed)}
              onChange={(event) =>
                onSettingsChange({
                  massageLabShapeGridSpeed: getMassageLabShapeGridSpeedFromDisplayPercent(Number(event.target.value)),
                })
              }
              aria-label="MassageLab Shape Grid speed percentage"
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabShapeGridSquareSize: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabShapeGridHoverTrailAmount: Number(event.target.value),
                })
              }
              aria-label="MassageLab Shape Grid hover trail"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-liquid-chrome") {
      const liquidChromeDisplaySpeed = getMassageLabCatalogChromeFlowDisplaySpeed(settings.massageLabLiquidChromeSpeed)

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.switchRow}>
            <span>Cursor interaction</span>
            <input
              type="checkbox"
              checked={settings.massageLabLiquidChromeInteractive}
              onChange={(event) =>
                onSettingsChange({
                  massageLabLiquidChromeInteractive: event.target.checked,
                })
              }
              aria-label="MassageLab Liquid Chrome cursor interaction"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Speed ({liquidChromeDisplaySpeed}%)</span>
            <input
              type="range"
              min={MASSAGE_LAB_CATALOG_CHROME_FLOW_DISPLAY_SPEED_MIN}
              max={MASSAGE_LAB_CATALOG_CHROME_FLOW_DISPLAY_SPEED_MAX}
              step={MASSAGE_LAB_CATALOG_CHROME_FLOW_DISPLAY_SPEED_STEP}
              value={liquidChromeDisplaySpeed}
              onChange={(event) =>
                onSettingsChange({
                  massageLabLiquidChromeSpeed: getMassageLabCatalogChromeFlowSourceSpeed(Number(event.target.value)),
                })
              }
              aria-label="Chrome Flow speed percentage"
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabLiquidChromeAmplitude: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabLiquidChromeFrequencyX: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabLiquidChromeFrequencyY: Number(event.target.value),
                })
              }
              aria-label="MassageLab Liquid Chrome frequency Y"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-balatro") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.switchRow}>
            <span>Mouse interaction</span>
            <input
              type="checkbox"
              checked={settings.massageLabBalatroMouseInteraction}
              onChange={(event) =>
                onSettingsChange({
                  massageLabBalatroMouseInteraction: event.target.checked,
                })
              }
              aria-label="MassageLab Balatro mouse interaction"
            />
          </label>

          <label className={styles.switchRow}>
            <span>Rotate field</span>
            <input
              type="checkbox"
              checked={settings.massageLabBalatroIsRotate}
              onChange={(event) =>
                onSettingsChange({
                  massageLabBalatroIsRotate: event.target.checked,
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabBalatroSpinSpeed: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabBalatroSpinRotation: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabBalatroContrast: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabBalatroLighting: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabBalatroSpinAmount: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabBalatroPixelFilter: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabBalatroSpinEase: Number(event.target.value),
                })
              }
              aria-label="MassageLab Balatro spin ease"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-photon-beam") {
      const photonSpeed = getMassageLabPhotonBeamDisplaySpeed(settings.massageLabPhotonBeamSpeedGlobal)

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.rangeRow}>
            <span>Animation speed ({photonSpeed}%)</span>
            <input
              type="range"
              min={MASSAGE_LAB_PHOTON_BEAM_DISPLAY_SPEED_MIN}
              max={MASSAGE_LAB_PHOTON_BEAM_DISPLAY_SPEED_MAX}
              step={MASSAGE_LAB_PHOTON_BEAM_DISPLAY_SPEED_STEP}
              value={photonSpeed}
              onChange={(event) =>
                onSettingsChange({
                  massageLabPhotonBeamSpeedGlobal: getMassageLabPhotonBeamSourceSpeed(Number(event.target.value)),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPhotonBeamLineCount: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPhotonBeamSignalCount: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPhotonBeamSpreadHeight: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPhotonBeamSpreadDepth: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPhotonBeamTrailLength: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPhotonBeamLineOpacity: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPhotonBeamBloomStrength: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPhotonBeamBloomRadius: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPhotonBeamWaveSpeed: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPhotonBeamWaveHeight: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPhotonBeamCurveLength: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPhotonBeamStraightLength: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabPhotonBeamCurvePower: Number(event.target.value),
                })
              }
              aria-label="Photon Beam curve power"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-matrix-rain") {
      const matrixRainSpeed = getMassageLabMatrixRainDisplaySpeed(settings.massageLabMatrixRainSpeed)

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.rangeRow}>
            <span>Animation speed ({matrixRainSpeed}%)</span>
            <input
              type="range"
              min={MASSAGE_LAB_HACKER_DISPLAY_SPEED_MIN}
              max={MASSAGE_LAB_HACKER_DISPLAY_SPEED_MAX}
              step={MASSAGE_LAB_HACKER_DISPLAY_SPEED_STEP}
              value={matrixRainSpeed}
              onChange={(event) =>
                onSettingsChange({
                  massageLabMatrixRainSpeed: getMassageLabMatrixRainSourceSpeed(Number(event.target.value)),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabMatrixRainFontSize: Number(event.target.value),
                })
              }
              aria-label="Matrix Rain font size"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-novatrix") {
      const novatrixSpeed = getMassageLabNovatrixDisplaySpeed(settings.massageLabNovatrixSpeed)
      const novatrixAmplitude = getMassageLabNovatrixDisplayAmplitude(settings.massageLabNovatrixAmplitude)

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.rangeRow}>
            <span>Animation speed ({novatrixSpeed}%)</span>
            <input
              type="range"
              min={MASSAGE_LAB_NOVATRIX_DISPLAY_SPEED_MIN}
              max={MASSAGE_LAB_NOVATRIX_DISPLAY_SPEED_MAX}
              step={MASSAGE_LAB_NOVATRIX_DISPLAY_SPEED_STEP}
              value={novatrixSpeed}
              onChange={(event) =>
                onSettingsChange({
                  massageLabNovatrixSpeed: getMassageLabNovatrixSourceSpeed(Number(event.target.value)),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabNovatrixAmplitude: getMassageLabNovatrixSourceAmplitude(Number(event.target.value)),
                })
              }
              aria-label="Novatrix amplitude"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-synthesis") {
      const synthesisDisplaySpeed = getMassageLabSynthesisDisplaySpeed(settings.massageLabSynthesisSpeed)

      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.rangeRow}>
            <span>Animation speed ({synthesisDisplaySpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min={MASSAGE_LAB_SYNTHESIS_DISPLAY_SPEED_MIN}
              max={MASSAGE_LAB_SYNTHESIS_DISPLAY_SPEED_MAX}
              step={MASSAGE_LAB_SYNTHESIS_DISPLAY_SPEED_STEP}
              value={synthesisDisplaySpeed}
              onChange={(event) =>
                onSettingsChange({
                  massageLabSynthesisSpeed: getMassageLabSynthesisSourceSpeed(Number(event.target.value)),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabSynthesisComplexity: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabSynthesisScale: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabSynthesisDistortion: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabSynthesisGlowIntensity: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  massageLabSynthesisFlowFrequency: Number(event.target.value),
                })
              }
              aria-label="Synthesis flow frequency"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-reveal-dots") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.rangeRow}>
            <span>Dot size</span>
            <input
              type="range"
              min="1"
              max="5"
              step="0.2"
              value={settings.canvasRevealDotsDotSize}
              onChange={(event) =>
                onSettingsChange({
                  canvasRevealDotsDotSize: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  canvasRevealDotsDotSpacing: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  canvasRevealDotsOpacity: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  canvasRevealDotsAnimationSpeed: Number(event.target.value),
                })
              }
              aria-label="Reveal dots motion speed"
            />
          </label>
          <label className={styles.switchRow}>
            <span>Gradient overlay</span>
            <input
              type="checkbox"
              checked={settings.canvasRevealDotsShowGradient}
              onChange={(event) =>
                onSettingsChange({
                  canvasRevealDotsShowGradient: event.target.checked,
                })
              }
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-spotlight") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.rangeRow}>
            <span>Intensity</span>
            <input
              type="range"
              min="0.25"
              max="1.5"
              step="0.05"
              value={settings.spotlightOpacity}
              onChange={(event) =>
                onSettingsChange({
                  spotlightOpacity: Number(event.target.value),
                })
              }
              aria-label="Spotlight intensity"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Beam width</span>
            <input type="range" min="240" max="900" step="20" value={settings.spotlightWidth} onChange={(event) => onSettingsChange({ spotlightWidth: Number(event.target.value) })} aria-label="Spotlight beam width" />
          </label>
          <label className={styles.rangeRow}>
            <span>Beam height</span>
            <input
              type="range"
              min="600"
              max="1800"
              step="20"
              value={settings.spotlightHeight}
              onChange={(event) =>
                onSettingsChange({
                  spotlightHeight: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  spotlightSmallWidth: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  spotlightTranslateY: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  spotlightXOffset: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  spotlightDuration: Number(event.target.value),
                })
              }
              aria-label="Spotlight animation duration"
            />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-lamp-effect") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.rangeRow}>
            <span>Glow intensity</span>
            <input
              type="range"
              min="0.18"
              max="0.95"
              step="0.05"
              value={settings.lampGlowOpacity}
              onChange={(event) =>
                onSettingsChange({
                  lampGlowOpacity: Number(event.target.value),
                })
              }
              aria-label="Lamp glow intensity"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Beam width</span>
            <input type="range" min="240" max="900" step="20" value={settings.lampBeamWidth} onChange={(event) => onSettingsChange({ lampBeamWidth: Number(event.target.value) })} aria-label="Lamp beam width" />
          </label>
          <label className={styles.rangeRow}>
            <span>Glow width</span>
            <input type="range" min="180" max="900" step="20" value={settings.lampGlowWidth} onChange={(event) => onSettingsChange({ lampGlowWidth: Number(event.target.value) })} aria-label="Lamp glow width" />
          </label>
          <label className={styles.rangeRow}>
            <span>Vertical offset</span>
            <input
              type="range"
              min="-320"
              max="160"
              step="8"
              value={settings.lampVerticalOffset}
              onChange={(event) =>
                onSettingsChange({
                  lampVerticalOffset: Number(event.target.value),
                })
              }
              aria-label="Lamp vertical offset"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Pulse speed</span>
            <input type="range" min="4" max="18" step="0.5" value={settings.lampPulseSpeed} onChange={(event) => onSettingsChange({ lampPulseSpeed: Number(event.target.value) })} aria-label="Lamp pulse speed" />
          </label>
        </div>
      )
    }

    if (option.id === "massage-lab-vortex") {
      return (
        <div className={styles.backgroundCardControls}>
          <label className={styles.rangeRow}>
            <span>Particles</span>
            <input
              type="range"
              min="120"
              max="700"
              step="20"
              value={settings.vortexParticleCount}
              onChange={(event) =>
                onSettingsChange({
                  vortexParticleCount: Number(event.target.value),
                })
              }
              aria-label="Vortex particle count"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Vertical spread</span>
            <input type="range" min="40" max="220" step="10" value={settings.vortexRangeY} onChange={(event) => onSettingsChange({ vortexRangeY: Number(event.target.value) })} aria-label="Vortex vertical spread" />
          </label>
          <label className={styles.rangeRow}>
            <span>Base speed</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={settings.vortexBaseSpeed}
              onChange={(event) =>
                onSettingsChange({
                  vortexBaseSpeed: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  vortexRangeSpeed: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  vortexBaseRadius: Number(event.target.value),
                })
              }
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
              onChange={(event) =>
                onSettingsChange({
                  vortexRangeRadius: Number(event.target.value),
                })
              }
              aria-label="Vortex particle size range"
            />
          </label>
        </div>
      )
    }

    return null
  }

  return (
    <section ref={containerRef} className={styles.container} aria-label="Chimer setup" onInput={handleNativeRangeInput}>
      {shouldShowSyncNotice && !syncNoticeDismissed && (
        <div className={`${styles.syncNotice} ${isSyncNoticeExiting ? styles.syncNoticeExiting : ""}`} data-app-bar-position={appShellSettings.appBarPosition}>
          <p>{syncMessage}</p>
          {syncStatus === "conflict" && (
            <div className={styles.syncActions}>
              <button type="button" className={`${styles.syncButton} ${styles.tactileButton}`} onClick={handleUseDeviceSettingsClick} disabled={isResolvingSync}>
                Keep this device settings
              </button>
              <button type="button" className={`${styles.syncButton} ${styles.tactileButton}`} onClick={handleUseSavedSettingsClick} disabled={isResolvingSync}>
                Use saved favorites
              </button>
            </div>
          )}
        </div>
      )}

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
              <span className={styles.stepName}>{CHIMER_SETUP_STEP_SHORT_NAMES[stepIndex]}</span>
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

        <details className={styles.presetRecall}>
          <summary className={styles.presetDisclosureSummary}>Saved setups</summary>
          <div className={styles.presetControls}>
            <label className={`${styles.formGroup} ${styles.presetSelectField}`} htmlFor="chimer-setup-presets">
              <span className="sr-only">Saved setup</span>
              <select id="chimer-setup-presets" value={selectedPresetId} onChange={(event) => setSelectedPresetId(event.target.value)}>
                <option value="">Select a saved setup</option>
                {savedPresets.map((preset) => (
                  <option key={preset.id} value={preset.id}>
                    {preset.name}
                  </option>
                ))}
              </select>
            </label>
            <div className={styles.presetSelectRow}>
              <Button type="button" tone="setup" size="compact" onClick={applySelectedPreset} disabled={!selectedPreset}>
                Apply
              </Button>
              <Button type="button" tone="setup" size="compact" onClick={loadLastSetup} disabled={!lastSetupPreset}>
                Use last
              </Button>
            </div>
          </div>
        </details>

        <div className={`${styles.stepContent} ${activeStep === CHIMER_BACKGROUND_SETUP_STEP_INDEX ? styles.backgroundStepContent : ""}`}>
          {activeStep === 0 && (
            <div>
              <div className={styles.formGroup}>
                <div className={styles.durationHeader}>
                  <span>Session duration</span>
                  <CTAButton type="button" variant="ctaBlue" size="compact" className={styles.clockModeCtaButton} pressFeedback={false} onClick={withPress(onStartClock)}>
                    <Clock aria-hidden="true" />
                    Clock Mode
                  </CTAButton>
                </div>
                <div className={styles.clock} role="group" aria-label={`Session duration: ${formatDurationMinutes(settings.hours, settings.minutes)}`}>
                  <span className={`${styles.timerStatusBadge} ${isTimerSet ? styles.timerSet : styles.timerUnset}`}>{isTimerSet ? "Set" : "Not set"}</span>
                  <button type="button" className={`${styles.timeUnit} ${styles.timeUnitButton}`} onClick={withPress(() => onTimeClick("hours"))} aria-label={`Set hours. Current value ${settings.hours}.`}>
                    {settings.hours.toString().padStart(2, "0")}
                  </button>
                  <span className={styles.colon} aria-hidden="true">
                    :
                  </span>
                  <button type="button" className={`${styles.timeUnit} ${styles.timeUnitButton}`} onClick={withPress(() => onTimeClick("minutes"))} aria-label={`Set minutes. Current value ${settings.minutes}.`}>
                    {settings.minutes.toString().padStart(2, "0")}
                  </button>
                </div>
              </div>
              <p className={styles.durationHint}>Select the timer digits directly, or fine-tune the duration below.</p>
              <div className={styles.durationStepperGrid}>
                <div className={styles.durationStepperGroup}>
                  <span>Hours</span>
                  <div className={styles.durationStepperActions}>
                    <Button type="button" size="compact" tone="setup" aria-label="Decrease hours" onClick={() => stepDurationPart("hours", -1)}>
                      <Minus aria-hidden="true" />
                    </Button>
                    <Button type="button" size="compact" tone="setup" aria-label="Increase hours" onClick={() => stepDurationPart("hours", 1)}>
                      <Plus aria-hidden="true" />
                    </Button>
                  </div>
                </div>
                <div className={styles.durationStepperGroup}>
                  <span>Minutes</span>
                  <div className={styles.durationStepperActions}>
                    <AcceleratingStepButton type="button" size="compact" tone="setup" step={-1} doubleStep={-5} aria-label="Decrease minutes" onStep={(amount) => stepDurationPart("minutes", amount)}>
                      <Minus aria-hidden="true" />
                    </AcceleratingStepButton>
                    <AcceleratingStepButton type="button" size="compact" tone="setup" step={1} doubleStep={5} aria-label="Increase minutes" onStep={(amount) => stepDurationPart("minutes", amount)}>
                      <Plus aria-hidden="true" />
                    </AcceleratingStepButton>
                  </div>
                </div>
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
                    onSettingsChange({
                      intervalType: nextValue as ChimerSettings["intervalType"],
                    })
                  }}
                >
                  <option value="none">No interval</option>
                  <option value="preset">Common presets</option>
                  <option value="custom">Custom minutes</option>
                  <option value="areas">Divide by body areas</option>
                </select>
              </label>

              {!skipIntervalCues &&
                (settings.intervalType === "areas" ? (
                  <NumberField label="Body areas" value={settings.areasToMassage} min={1} max={24} step={1} hapticsEnabled={hapticsEnabled} onChange={(value) => onSettingsChange({ areasToMassage: value })} />
                ) : settings.intervalType === "preset" ? (
                  <label className={styles.formGroup} htmlFor="custom-interval-input">
                    <span>Preset minutes</span>
                    <select
                      id="custom-interval-input"
                      value={settings.customInterval}
                      onChange={(event) =>
                        onSettingsChange({
                          customInterval: Number(event.target.value),
                        })
                      }
                    >
                      <option value="1">1 minute</option>
                      <option value="5">5 minutes</option>
                      <option value="10">10 minutes</option>
                      <option value="15">15 minutes</option>
                      <option value="30">30 minutes</option>
                    </select>
                  </label>
                ) : (
                  <NumberField label="Custom minutes" value={settings.customInterval} min={1} max={240} step={1} unit="m" hapticsEnabled={hapticsEnabled} onChange={(value) => onSettingsChange({ customInterval: value })} />
                ))}
            </div>
          )}

          {activeStep === 2 && (
            <div>
              <label className={styles.formGroup} htmlFor="alert-type">
                <span>Notification</span>
                <select
                  id="alert-type"
                  value={settings.alertType}
                  onChange={(event) =>
                    onSettingsChange({
                      alertType: event.target.value as ChimerSettings["alertType"],
                    })
                  }
                >
                  {ALERT_TYPE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className={styles.notificationControlStack}>
                {selectedAlertUsesSound ? <StyledRangeControl label="Sound volume" value={settings.alertVolume} min={0} max={1} step={0.05} displayValue={`${Math.round(settings.alertVolume * 100)}%`} hapticsEnabled={hapticsEnabled} onChange={(value) => onSettingsChange({ alertVolume: value })} /> : null}
                {selectedAlertUsesHaptics ? <StyledRangeControl label="Haptic intensity" value={settings.hapticIntensityMs} min={10} max={30} step={1} displayValue={`${settings.hapticIntensityMs}ms`} hapticsEnabled={hapticsEnabled} onChange={(value) => onSettingsChange({ hapticIntensityMs: value })} /> : null}
              </div>

              {!selectedAlertUsesSound && !selectedAlertUsesHaptics ? <p className={styles.formHint}>Silent keeps interval timing active without sound, flash, or haptic cues.</p> : null}
            </div>
          )}

          {activeStep === CHIMER_BACKGROUND_SETUP_STEP_INDEX && (
            <>
              <div className={styles.backgroundSettings}>
                <StyledToggleControl label="Visual background" checked={settings.movingBackgroundEnabled} hapticsEnabled={hapticsEnabled} onCheckedChange={(value) => onSettingsChange({ movingBackgroundEnabled: value })} />
                {settings.movingBackgroundEnabled && <BackgroundSelector value={settings.backgroundId} onChange={handleBackgroundSelection} access={backgroundAccess} category={backgroundCategory} renderSelectedControls={renderBackgroundControls} />}
              </div>
              <p className={styles.formHint}>Backgrounds are fully applied when timer starts. Use this section to set your preferred background and any per-background controls.</p>
            </>
          )}

          {activeStep === 4 && (
            <div>
              <p className={styles.powerNotice}>“Chimer can use extra battery power, especially with animated backgrounds, sounds, haptics, and fullscreen mode. For the best experience on a phone, tablet, or laptop, plug in your device before starting so it does not lose power during the session.”</p>
              <div className={styles.presetSelection}>
                <label className={styles.formGroup} htmlFor="chimer-preset-name">
                  <span>Save this setup</span>
                  <input id="chimer-preset-name" type="text" value={newPresetName} onChange={(event) => setNewPresetName(event.target.value)} placeholder="Preset name (optional)" />
                </label>
                <Button type="button" tone="setup" className="w-full" onClick={saveCurrentPreset} disabled={!isTimerSet}>
                  Save as preset
                </Button>
              </div>
              <div className={styles.actions}>
                <Button type="button" tone="setup" className="w-full" onClick={onTestAlert}>
                  Test Alert
                </Button>
                <CTAButton type="button" withAttentionRing variant="default" tone="setup" className="w-full" onClick={() => handleStartTimer(false)} disabled={!isTimerSet}>
                  <Play className="h-5 w-5" />
                  Start Chimer
                </CTAButton>
                <Button type="button" tone="setup" className="w-full" onClick={() => handleStartTimer(true)} disabled={!isTimerSet}>
                  Start without animated background
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className={styles.stepNavActions}>
          {activeStep > 0 && (
            <Button type="button" variant="secondary" className="w-full" onClick={previousStep}>
              Back
            </Button>
          )}
          {!isFinalStep && (
            <MetalAttentionRing metalMode={canAdvanceStep ? "always" : "off"} metalFullWidth metalStrength={0.72}>
              <Button type="button" className="w-full" onClick={nextStep} disabled={!canAdvanceStep}>
                Continue
              </Button>
            </MetalAttentionRing>
          )}
        </div>
      </div>

      {error && <p className={styles.error}>{error}</p>}
    </section>
  )
}
