"use client"

import { type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { ChevronLeft, ChevronRight, Maximize2, Minimize2, Minus, Pause, Play, Plus, Settings, Star, X } from "lucide-react"
import Image from "next/image"
import { DEFAULT_BACKGROUND_ID } from "@/lib/background-options"
import { BackgroundHost } from "@/components/backgrounds/BackgroundHost"
import {
  canUseBackgroundId,
  getBackgroundOptionsForCategory,
  resolveAccessibleBackgroundDefinition,
  type BackgroundId,
  type BackgroundDefinition,
  userCanUseBackground,
} from "@/components/backgrounds/backgroundRegistry"
import { triggerHapticFeedback } from "@/lib/haptics"
import { Loader } from "@/components/chimer-controls/Loader"
import { MovingBackground } from "@/components/moving-background"
import { CHIMER_HARMONY_OPTIONS, HarmonyToggleGroup, type ChimerHarmonyValue } from "@/components/chimer-controls/HarmonyToggleGroup"
import {
  CHIMER_CONTROL_PORTAL_SELECTOR,
  ColorPickerInput,
  ColorPickerSwatch,
  GlobalColorPicker,
  type GlobalColorValues,
} from "@/components/chimer-controls/GlobalColorPicker"
import { StyledRangeControl } from "@/components/chimer-controls/StyledRangeControl"
import { StyledToggleControl } from "@/components/chimer-controls/StyledToggleControl"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DEFAULT_CHIMER_SETTINGS } from "@/lib/chimer-timer"
import {
  MASSAGE_LAB_GRADIENT_HARMONY_OPTIONS,
  MASSAGE_LAB_ASTRAL_FLOW_DISPLAY_SPEED_MAX,
  MASSAGE_LAB_ASTRAL_FLOW_DISPLAY_SPEED_MIN,
  MASSAGE_LAB_ASTRAL_FLOW_DISPLAY_SPEED_STEP,
  MASSAGE_LAB_DEEP_SPACE_NEBULA_DISPLAY_SPEED_MAX,
  MASSAGE_LAB_DEEP_SPACE_NEBULA_DISPLAY_SPEED_MIN,
  MASSAGE_LAB_DEEP_SPACE_NEBULA_DISPLAY_SPEED_STEP,
  MASSAGE_LAB_GRID_BLOOM_DISPLAY_SPEED_MAX,
  MASSAGE_LAB_GRID_BLOOM_DISPLAY_SPEED_MIN,
  MASSAGE_LAB_GRID_BLOOM_DISPLAY_SPEED_STEP,
  MASSAGE_LAB_LIQUID_CHROME_DISPLAY_FLOW_SPEED_MAX,
  MASSAGE_LAB_LIQUID_CHROME_DISPLAY_FLOW_SPEED_MIN,
  MASSAGE_LAB_LIQUID_CHROME_DISPLAY_FLOW_SPEED_STEP,
  MASSAGE_LAB_LIQUID_CHROME_DISPLAY_TIME_SCALE_MAX,
  MASSAGE_LAB_LIQUID_CHROME_DISPLAY_TIME_SCALE_MIN,
  MASSAGE_LAB_LIQUID_CHROME_DISPLAY_TIME_SCALE_STEP,
  MASSAGE_LAB_WAVES_DISPLAY_SPEED_MAX,
  MASSAGE_LAB_WAVES_DISPLAY_SPEED_MIN,
  MASSAGE_LAB_WAVES_DISPLAY_SPEED_STEP,
  MASSAGE_LAB_SYNTHESIS_DISPLAY_SPEED_MAX,
  MASSAGE_LAB_SYNTHESIS_DISPLAY_SPEED_MIN,
  MASSAGE_LAB_SYNTHESIS_DISPLAY_SPEED_STEP,
  COLOR_HARMONY_OPTIONS,
  MASSAGE_LAB_NOVATRIX_DISPLAY_AMPLITUDE_MAX,
  MASSAGE_LAB_NOVATRIX_DISPLAY_AMPLITUDE_MIN,
  MASSAGE_LAB_NOVATRIX_DISPLAY_AMPLITUDE_STEP,
  MASSAGE_LAB_NOVATRIX_DISPLAY_SPEED_MAX,
  MASSAGE_LAB_NOVATRIX_DISPLAY_SPEED_MIN,
  MASSAGE_LAB_NOVATRIX_DISPLAY_SPEED_STEP,
  MASSAGE_LAB_HACKER_DISPLAY_SPEED_MAX,
  MASSAGE_LAB_HACKER_DISPLAY_SPEED_MIN,
  MASSAGE_LAB_HACKER_DISPLAY_SPEED_STEP,
  MASSAGE_LAB_PHOTON_BEAM_DISPLAY_SPEED_MAX,
  MASSAGE_LAB_PHOTON_BEAM_DISPLAY_SPEED_MIN,
  MASSAGE_LAB_PHOTON_BEAM_DISPLAY_SPEED_STEP,
  getMassageLabAstralFlowDisplaySpeed,
  getMassageLabAstralFlowSourceSpeed,
  getMassageLabDeepSpaceNebulaDisplaySpeed,
  getMassageLabDeepSpaceNebulaSourceSpeed,
  getMassageLabGridBloomDisplaySpeed,
  getMassageLabGridBloomSourceSpeed,
  getMassageLabChromeFlowDisplayFlowSpeed,
  getMassageLabChromeFlowDisplayTimeScale,
  getMassageLabChromeFlowSourceFlowSpeed,
  getMassageLabChromeFlowSourceTimeScale,
  getMassageLabWaveCurrentDisplaySpeed,
  getMassageLabWaveCurrentSourceSpeed,
  getMassageLabSynthesisDisplaySpeed,
  getMassageLabSynthesisSourceSpeed,
  getMassageLabNovatrixDisplayAmplitude,
  getMassageLabNovatrixDisplaySpeed,
  getMassageLabNovatrixSourceAmplitude,
  getMassageLabNovatrixSourceSpeed,
  getMassageLabMatrixRainDisplaySpeed,
  getMassageLabMatrixRainSourceSpeed,
  getMassageLab3DGlobeScaleDisplayPercent,
  getMassageLab3DGlobeScaleFromDisplayPercent,
  getMassageLabPhotonBeamDisplaySpeed,
  getMassageLabPhotonBeamSourceSpeed,
  resolveMassageLabAstralFlowColors,
  resolveMassageLabDeepSpaceNebulaColors,
  resolveMassageLabChromeFlowColors,
  resolveMassageLabWaveCurrentColors,
  resolveMassageLabSynthesisColors,
  resolveMassageLabFerrofluidColors,
  resolveMassageLabLightfallColors,
  resolveMassageLabLiquidEtherColors,
  resolveMassageLabLightPillarColors,
  resolveMassageLabFloatingLinesGradient,
  resolveMassageLabSideRaysColors,
  resolveMassageLabLightRaysColor,
  resolveMassageLabPixelBlastColor,
  resolveMassageLabColorBendsColors,
  resolveMassageLabEvilEyeColor,
  resolveMassageLabLineWavesColors,
  resolveMassageLabRadarColor,
  resolveMassageLabSoftAuroraColors,
  resolveMassageLabPlasmaColor,
  resolveMassageLabPlasmaWaveColors,
  resolveMassageLabParticlesColors,
  resolveMassageLabGradientBlindsColors,
  resolveMassageLabGrainientColors,
  resolveMassageLabGridScanColors,
  resolveMassageLabBeamsColor,
  resolveMassageLabPixelSnowColor,
  resolveMassageLabLightningHue,
  resolveMassageLabPrismaticBurstColors,
  resolveMassageLabGalaxyHueShift,
  resolveMassageLabDitherColor,
  resolveMassageLabFaultyTerminalTint,
  resolveMassageLabRippleGridColor,
  resolveMassageLabDotFieldColors,
  resolveMassageLabDotGridColors,
  resolveMassageLabThreadsColor,
  resolveMassageLabIridescenceColor,
  resolveMassageLabWavesLineColor,
  resolveMassageLabGridDistortionColors,
  resolveMassageLabOrbHue,
  resolveMassageLabLetterGlitchColors,
  resolveMassageLabGridMotionColors,
  resolveMassageLabShapeGridColors,
  resolveMassageLabLiquidChromeBaseColor,
  resolveMassageLabBalatroColors,
  resolveMassageLabSilkColor,
  resolveMassageLabMatrixRainColor,
  resolveMassageLabNovatrixColor,
  resolveMassageLabPhotonBeamColors,
  type MassageLabGradientHarmony,
  type MassageLabAstralFlowPaletteMode,
  type MassageLabDeepSpaceNebulaPaletteMode,
  type MassageLabChromeFlowPaletteMode,
  type MassageLabWaveCurrentPaletteMode,
  type MassageLabSynthesisPaletteMode,
  type MassageLabFerrofluidPaletteMode,
  type MassageLabLightfallPaletteMode,
  type MassageLabLiquidEtherPaletteMode,
  type MassageLabPrismAnimationType,
  type MassageLabLightPillarBlendMode,
  type MassageLabFloatingLinesBlendMode,
  type MassageLabFloatingLinesPaletteMode,
  type MassageLabSideRaysOrigin,
  type MassageLabSideRaysPaletteMode,
  type MassageLabLightRaysOrigin,
  type MassageLabLightRaysPaletteMode,
  type MassageLabPixelBlastPaletteMode,
  type MassageLabPixelBlastVariant,
  type MassageLabColorBendsPaletteMode,
  type MassageLabEvilEyePaletteMode,
  type MassageLabLineWavesPaletteMode,
  type MassageLabRadarPaletteMode,
  type MassageLabSoftAuroraPaletteMode,
  type MassageLabPlasmaDirection,
  type MassageLabPlasmaPaletteMode,
  type MassageLabPlasmaWavePaletteMode,
  type MassageLabParticlesPaletteMode,
  type MassageLabGradientBlindsBlendMode,
  type MassageLabGradientBlindsPaletteMode,
  type MassageLabGradientBlindsShineDirection,
  type MassageLabGrainientPaletteMode,
  type MassageLabGridScanDirection,
  type MassageLabGridScanLineStyle,
  type MassageLabGridScanPaletteMode,
  type MassageLabBeamsPaletteMode,
  type MassageLabPixelSnowPaletteMode,
  type MassageLabPixelSnowVariant,
  type MassageLabLightningPaletteMode,
  type MassageLabPrismaticBurstAnimationType,
  type MassageLabPrismaticBurstMixBlendMode,
  type MassageLabPrismaticBurstPaletteMode,
  type MassageLabGalaxyPaletteMode,
  type MassageLabDitherPaletteMode,
  type MassageLabFaultyTerminalPaletteMode,
  type MassageLabRippleGridPaletteMode,
  type MassageLabDotFieldPaletteMode,
  type MassageLabDotGridPaletteMode,
  type MassageLabThreadsPaletteMode,
  type MassageLabIridescencePaletteMode,
  type MassageLabWavesPaletteMode,
  type MassageLabGridDistortionPaletteMode,
  type MassageLabOrbPaletteMode,
  type MassageLabLetterGlitchPaletteMode,
  type MassageLabGridMotionPaletteMode,
  type MassageLabShapeGridPaletteMode,
  type MassageLabLiquidChromePaletteMode,
  type MassageLabBalatroPaletteMode,
  type MassageLabLightPillarPaletteMode,
  type MassageLabLightPillarQuality,
  type MassageLabSilkPaletteMode,
  type MassageLabMatrixRainPaletteMode,
  type MassageLabNovatrixPaletteMode,
  type MassageLabPhotonBeamPaletteMode,
  type ChimerSettings,
  type ColorHarmony,
} from "./set-timer"
import styles from "./running-timer.module.css"
import { TileGridFadeTimeControl } from "./tile-grid-fade-time-control"

type PrimaryDisplay = "timer" | "currentTime"
type SettingsTab = "clock" | "visual" | "backgrounds"
type BackgroundVisualCategory = "all" | "animated" | "image" | "interactive" | "premium" | "saved" | "static" | "shader" | "video"

const BACKGROUND_VISUAL_CATEGORIES: ReadonlyArray<{ value: BackgroundVisualCategory; label: string }> = [
  { value: "all", label: "All" },
  { value: "static", label: "Static" },
  { value: "animated", label: "Animated" },
  { value: "interactive", label: "Interactive" },
  { value: "shader", label: "Shader" },
  { value: "image", label: "Image" },
  { value: "video", label: "Video" },
  { value: "premium", label: "Premium" },
  { value: "saved", label: "Saved" },
]

const CHIMER_SAVED_BACKGROUND_IDS_STORAGE_KEY = "massagelab-chimer-saved-background-ids-v1"
const CHIMER_GLOBAL_COLOR_STORAGE_KEY = "massagelab-chimer-global-color-v1"
const CHIMER_GLOBAL_PALETTE_STORAGE_KEY = "massagelab-chimer-global-palettes-v1"
const IMAGE_SOURCE_PATTERNS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".avif",
  ".heic",
  ".heif",
  ".svg",
]
const VIDEO_SOURCE_PATTERNS = [".mp4", ".webm", ".mov", ".m4v", ".ogg", ".ogv"]
const INTERACTIVE_HINT_PATTERNS = [
  "interactive",
  "hover",
  "cursor",
  "rotate",
  "orbit",
  "spin",
  "mouse",
  "tap",
  "drag",
  "pan",
]
const SHADER_HINT_PATTERNS = ["shader", "canvas", "webgl", "glsl", "fragment", "uniform", "three", "custom"]

type CurrentTimeParts = {
  time: string
  meridiem: string
}

const MIN_FONT_SIZE = 12
const MAX_FONT_SIZE = 70
const FONT_SIZE_STEP = 3
const FONT_FIT_EDGE_INSET_PX = 2
const SWAP_ANIMATION_MS = 360
const SETTINGS_AUTO_CLOSE_MS = 60_000
const DEFAULT_PRIMARY_FONT_COLOR = "#FFFFFF"
const DEFAULT_SECONDARY_FONT_COLOR = "#FF7A1A"
const DEFAULT_CLOCK_MODE_FONT_COLOR = "#FFFFFF"
const BACKGROUND_RADIAL_CARD_SPREAD_DEGREES = 35
const BACKGROUND_RADIAL_CARD_RADIUS_PX = 285
const BACKGROUND_RADIAL_VISIBLE_OFFSET = 3
const BACKGROUND_CAROUSEL_SWIPE_THRESHOLD_PX = 42

const getCircularCarouselOffset = (index: number, activeIndex: number, total: number) => {
  if (total <= 0) {
    return 0
  }

  const rawOffset = (index - activeIndex + total) % total
  return rawOffset > total / 2 ? rawOffset - total : rawOffset
}
const PREMIUM_CUSTOM_COLOR_SETTING_KEYS = new Set([
  "primaryFontColor",
  "secondaryFontColor",
])
const ACCOUNT_COLOR_SETTING_KEYS = new Set([
  "clockModeFontColor",
  "movingBackgroundMainColor",
  "movingBackgroundOrbColor",
])

const DEFAULT_CHIMER_GLOBAL_COLORS: GlobalColorValues = {
  primary: "#f97316",
  secondary: "#fb923c",
  accent: "#fb7185",
  background: "#0f172a",
  foreground: "#f8fafc",
  ctaStart: "#db2777",
  ctaEnd: "#ea580c",
}
const DEFAULT_CHIMER_GLOBAL_HARMONY = "custom" as ChimerHarmonyValue
const GLOBAL_HARMONY_OPTIONS = CHIMER_HARMONY_OPTIONS.filter(
  (option) => option.value !== "custom",
)
const CHIMER_GLOBAL_PALETTE_DEFAULT_NAME = "Saved palette"
const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i

type ChimerSavedPalette = {
  id: string
  name: string
  sourceColor: string
  harmony: ChimerHarmonyValue
  colors: GlobalColorValues
  generated: string[]
  isDefault: boolean
  createdAt: string
}

type BackgroundPreviewMedia = {
  type: "image" | "video"
  source: string
}

type BackgroundDefinitionWithPreview = BackgroundDefinition & {
  previewMediaUrl?: string
  previewMediaType?: BackgroundPreviewMedia["type"]
  previewImageUrl?: string
  previewVideoUrl?: string
  previewSquareVideoUrl?: string
  previewVerticalVideoUrl?: string
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function normalizeHexColor(value: string, fallback: string) {
  if (typeof value !== "string") {
    return fallback
  }

  const trimmed = value.trim()
  if (!HEX_COLOR_PATTERN.test(trimmed)) {
    return fallback
  }

  if (trimmed.length === 4) {
    return `#${trimmed[1]}${trimmed[1]}${trimmed[2]}${trimmed[2]}${trimmed[3]}${trimmed[3]}`.toLowerCase()
  }

  return trimmed.toLowerCase()
}

function getCssHsl(color: string, fallback: string) {
  const normalized = normalizeHexColor(color, fallback)
  const { red, green, blue } = parseColorToRgb(normalized)
  const { h, s, l } = rgbToHsl(red, green, blue)

  return `${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%`
}

function getCssHslColor(color: string, fallback: string, alpha = 1) {
  return `hsl(${getCssHsl(color, fallback)} / ${clampNumber(alpha, 0, 1)})`
}

function getClockFontStack(fontFamily: ChimerSettings["clockFontFamily"]) {
  switch (fontFamily) {
    case "mono":
      return "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, \"Liberation Mono\", monospace"
    case "sans":
      return "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif"
    case "serif":
      return "Georgia, Cambria, \"Times New Roman\", Times, serif"
    case "digital":
    default:
      return "\"Digital\", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace"
  }
}

function buildClockTextShadow(params: {
  shadowEnabled: boolean
  shadowColor: string
  shadowStrength: number
  shadowDirection: number
  shadowDistance: number
  shadowFeather: number
  glowEnabled: boolean
  glowColor: string
  glowStrength: number
}) {
  const parts: string[] = []

  if (params.shadowEnabled && params.shadowStrength > 0) {
    const alpha = 0.14 + params.shadowStrength * 0.48
    const angleRadians = (params.shadowDirection * Math.PI) / 180
    const distance = clampNumber(params.shadowDistance, 0, 32)
    const offsetX = Math.cos(angleRadians) * distance
    const offsetY = Math.sin(angleRadians) * distance
    const feather = clampNumber(params.shadowFeather, 0, 32)
    parts.push(`${offsetX.toFixed(1)}px ${offsetY.toFixed(1)}px ${feather.toFixed(1)}px ${getCssHslColor(params.shadowColor, "#000000", alpha)}`)
  }

  if (params.glowEnabled && params.glowStrength > 0) {
    const alpha = 0.12 + params.glowStrength * 0.34
    parts.push(
      `0 0 ${0.045 + params.glowStrength * 0.08}em ${getCssHslColor(params.glowColor, DEFAULT_CHIMER_GLOBAL_COLORS.accent, alpha)}`,
      `0 0 ${0.18 + params.glowStrength * 0.2}em ${getCssHslColor(params.glowColor, DEFAULT_CHIMER_GLOBAL_COLORS.accent, alpha * 0.7)}`,
      `0 0 ${0.42 + params.glowStrength * 0.26}em ${getCssHslColor(params.glowColor, DEFAULT_CHIMER_GLOBAL_COLORS.accent, alpha * 0.42)}`,
    )
  }

  return parts.length > 0 ? parts.join(", ") : "none"
}

function resolvePaletteDrivenColor(params: {
  value: string
  defaultValue: string
  globalValue: string
}) {
  const normalizedValue = normalizeHexColor(params.value, params.defaultValue)
  const normalizedDefault = normalizeHexColor(params.defaultValue, params.value)

  return normalizedValue === normalizedDefault ? params.globalValue : normalizedValue
}

function sanitizeGlobalColorValues(values: Partial<GlobalColorValues> | undefined) {
  if (!values || typeof values !== "object") {
    return DEFAULT_CHIMER_GLOBAL_COLORS
  }

  return {
    primary: normalizeHexColor(String(values.primary ?? DEFAULT_CHIMER_GLOBAL_COLORS.primary), DEFAULT_CHIMER_GLOBAL_COLORS.primary),
    secondary: normalizeHexColor(String(values.secondary ?? DEFAULT_CHIMER_GLOBAL_COLORS.secondary), DEFAULT_CHIMER_GLOBAL_COLORS.secondary),
    accent: normalizeHexColor(String(values.accent ?? DEFAULT_CHIMER_GLOBAL_COLORS.accent), DEFAULT_CHIMER_GLOBAL_COLORS.accent),
    background: normalizeHexColor(String(values.background ?? DEFAULT_CHIMER_GLOBAL_COLORS.background), DEFAULT_CHIMER_GLOBAL_COLORS.background),
    foreground: normalizeHexColor(String(values.foreground ?? DEFAULT_CHIMER_GLOBAL_COLORS.foreground), DEFAULT_CHIMER_GLOBAL_COLORS.foreground),
    ctaStart: normalizeHexColor(String(values.ctaStart ?? DEFAULT_CHIMER_GLOBAL_COLORS.ctaStart), DEFAULT_CHIMER_GLOBAL_COLORS.ctaStart),
    ctaEnd: normalizeHexColor(String(values.ctaEnd ?? DEFAULT_CHIMER_GLOBAL_COLORS.ctaEnd), DEFAULT_CHIMER_GLOBAL_COLORS.ctaEnd),
  } satisfies GlobalColorValues
}

function parseColorToRgb(value: string) {
  const normalized = normalizeHexColor(value, "#000000")
  const hex = normalized.slice(1)
  return {
    red: Number.parseInt(hex.slice(0, 2), 16),
    green: Number.parseInt(hex.slice(2, 4), 16),
    blue: Number.parseInt(hex.slice(4, 6), 16),
  }
}

function rgbToHsl(red: number, green: number, blue: number) {
  const r = clampNumber(red, 0, 255) / 255
  const g = clampNumber(green, 0, 255) / 255
  const b = clampNumber(blue, 0, 255) / 255
  const maxChannel = Math.max(r, g, b)
  const minChannel = Math.min(r, g, b)
  const delta = maxChannel - minChannel
  let hue = 0
  let saturation = 0
  const lightness = (maxChannel + minChannel) / 2

  if (delta !== 0) {
    saturation = lightness > 0.5 ? delta / (2 - maxChannel - minChannel) : delta / (maxChannel + minChannel)

    switch (maxChannel) {
      case r: {
        hue = ((g - b) / delta) + (g < b ? 6 : 0)
        break
      }
      case g: {
        hue = (b - r) / delta + 2
        break
      }
      case b: {
        hue = (r - g) / delta + 4
        break
      }
    }

    hue *= 60
  }

  return {
    h: clampNumber(hue, 0, 360),
    s: clampNumber(saturation * 100, 0, 100),
    l: clampNumber(lightness * 100, 0, 100),
  }
}

function hslToRgbChannel(channel: number, hue: number, saturation: number, lightness: number) {
  const huePrime = (hue % 360 + 360) % 360
  const sat = saturation / 100
  const light = lightness / 100
  const chroma = (1 - Math.abs(2 * light - 1)) * sat
  const x = chroma * (1 - Math.abs((huePrime / 60) % 2 - 1))
  const m = light - chroma / 2
  let red = 0
  let green = 0
  let blue = 0

  if (huePrime < 60) {
    red = chroma
    green = x
  } else if (huePrime < 120) {
    red = x
    green = chroma
  } else if (huePrime < 180) {
    green = chroma
    blue = x
  } else if (huePrime < 240) {
    green = x
    blue = chroma
  } else if (huePrime < 300) {
    red = x
    blue = chroma
  } else {
    red = chroma
    blue = x
  }

  const values = [red, green, blue]
  return Math.round((values[channel] + m) * 255)
}

function hslToHex(hue: number, saturation: number, lightness: number) {
  const toByte = (value: number) => Math.max(0, Math.min(255, value)).toString(16).padStart(2, "0")
  const red = hslToRgbChannel(0, hue, saturation, lightness)
  const green = hslToRgbChannel(1, hue, saturation, lightness)
  const blue = hslToRgbChannel(2, hue, saturation, lightness)
  return `#${toByte(red)}${toByte(green)}${toByte(blue)}`
}

function shiftHue(baseColor: string, hueOffset: number, saturationOffset = 0, lightnessOffset = 0) {
  const { red, green, blue } = parseColorToRgb(baseColor)
  const hsl = rgbToHsl(red, green, blue)
  return hslToHex(
    hsl.h + hueOffset,
    hsl.s + saturationOffset,
    hsl.l + lightnessOffset,
  )
}

function getHarmonyColorsFromPrimary(primaryColor: string, harmony: ChimerHarmonyValue): GlobalColorValues {
  const normalizedPrimary = normalizeHexColor(primaryColor, DEFAULT_CHIMER_GLOBAL_COLORS.primary)
  const sourceColor = normalizedPrimary
  const safeDefaults = sanitizeGlobalColorValues(DEFAULT_CHIMER_GLOBAL_COLORS)
  const derivedBackground = shiftHue(sourceColor, 0, -24, -38)
  const derivedBase = {
    ...safeDefaults,
    primary: sourceColor,
    background: derivedBackground,
  }

  if (harmony === "custom") {
    return {
      ...safeDefaults,
      primary: sourceColor,
    }
  }

  switch (harmony) {
    case "analogous": {
      return {
        ...derivedBase,
        secondary: shiftHue(sourceColor, 18),
        accent: shiftHue(sourceColor, -18),
        ctaStart: shiftHue(sourceColor, 0),
        ctaEnd: shiftHue(sourceColor, 36),
      }
    }
    case "complementary": {
      return {
        ...derivedBase,
        secondary: shiftHue(sourceColor, 180),
        accent: shiftHue(sourceColor, -180),
        ctaStart: shiftHue(sourceColor, 180),
        ctaEnd: shiftHue(sourceColor, 195),
      }
    }
    case "split-complementary": {
      return {
        ...derivedBase,
        secondary: shiftHue(sourceColor, 150),
        accent: shiftHue(sourceColor, -150),
        ctaStart: shiftHue(sourceColor, 150),
        ctaEnd: shiftHue(sourceColor, -150),
      }
    }
    case "triad": {
      return {
        ...derivedBase,
        secondary: shiftHue(sourceColor, 120),
        accent: shiftHue(sourceColor, -120),
        ctaStart: shiftHue(sourceColor, 120),
        ctaEnd: shiftHue(sourceColor, -120),
      }
    }
    case "square": {
      return {
        ...derivedBase,
        secondary: shiftHue(sourceColor, 90),
        accent: shiftHue(sourceColor, -90),
        ctaStart: shiftHue(sourceColor, 90),
        ctaEnd: shiftHue(sourceColor, 180),
      }
    }
    case "compound": {
      return {
        ...derivedBase,
        secondary: shiftHue(sourceColor, 150),
        accent: shiftHue(sourceColor, 330),
        ctaStart: shiftHue(sourceColor, 30),
        ctaEnd: shiftHue(sourceColor, -150),
      }
    }
    case "shades": {
      return {
        ...derivedBase,
        secondary: shiftHue(sourceColor, 0, 0, -8),
        accent: shiftHue(sourceColor, 0, 0, 10),
        ctaStart: shiftHue(sourceColor, 0, 0, -16),
        ctaEnd: shiftHue(sourceColor, 0, 0, 22),
      }
    }
    case "monochromatic": {
      return {
        ...derivedBase,
        secondary: shiftHue(sourceColor, 0, -12, 8),
        accent: shiftHue(sourceColor, 0, 14, 16),
        ctaStart: shiftHue(sourceColor, 0, -6, 2),
        ctaEnd: shiftHue(sourceColor, 0, 8, 20),
      }
    }
  }

  return derivedBase
}

function getPaletteColorsFromGlobalValues(values: GlobalColorValues) {
  return [
    values.primary,
    values.secondary,
    values.accent,
    values.ctaStart,
    values.ctaEnd,
  ]
}

function getGlobalColorsFromStorage() {
  if (typeof window === "undefined") {
    return DEFAULT_CHIMER_GLOBAL_COLORS
  }

  try {
    const raw = window.localStorage.getItem(CHIMER_GLOBAL_COLOR_STORAGE_KEY)
    if (!raw) {
      return DEFAULT_CHIMER_GLOBAL_COLORS
    }

    const parsed = JSON.parse(raw)
    return sanitizeGlobalColorValues(parsed?.colors ?? parsed)
  } catch {
    return DEFAULT_CHIMER_GLOBAL_COLORS
  }
}

function getGlobalHarmonyFromStorage() {
  if (typeof window === "undefined") {
    return DEFAULT_CHIMER_GLOBAL_HARMONY
  }

  try {
    const raw = window.localStorage.getItem(CHIMER_GLOBAL_COLOR_STORAGE_KEY)
    if (!raw) {
      return DEFAULT_CHIMER_GLOBAL_HARMONY
    }

    const parsed = JSON.parse(raw)
    const storedHarmony = String(parsed?.harmony ?? "")
    return CHIMER_HARMONY_OPTIONS.some((option) => option.value === storedHarmony)
      ? storedHarmony as ChimerHarmonyValue
      : DEFAULT_CHIMER_GLOBAL_HARMONY
  } catch {
    return DEFAULT_CHIMER_GLOBAL_HARMONY
  }
}

function saveGlobalColorState(values: GlobalColorValues, harmony: ChimerHarmonyValue) {
  if (typeof window === "undefined") {
    return
  }

  try {
    window.localStorage.setItem(
      CHIMER_GLOBAL_COLOR_STORAGE_KEY,
      JSON.stringify({
        colors: sanitizeGlobalColorValues(values),
        harmony,
        updatedAt: new Date().toISOString(),
      }),
    )
  } catch {
    // noop
  }
}

function getSavedGlobalPalettesFromStorage() {
  if (typeof window === "undefined") {
    return []
  }

  try {
    const raw = window.localStorage.getItem(CHIMER_GLOBAL_PALETTE_STORAGE_KEY)
    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter((entry): entry is ChimerSavedPalette => {
      if (!entry || typeof entry !== "object") {
        return false
      }

      return (
        typeof entry.id === "string"
        && typeof entry.name === "string"
        && typeof entry.sourceColor === "string"
        && CHIMER_HARMONY_OPTIONS.some((option) => option.value === entry.harmony)
        && Array.isArray(entry.generated)
        && typeof entry.colors?.primary === "string"
      )
    })
  } catch {
    return []
  }
}

function saveGlobalPalettesToStorage(palettes: ChimerSavedPalette[]) {
  if (typeof window === "undefined") {
    return
  }

  try {
    window.localStorage.setItem(CHIMER_GLOBAL_PALETTE_STORAGE_KEY, JSON.stringify(palettes))
  } catch {
    // noop
  }
}

function getBackgroundPreviewMedia(
  option: BackgroundDefinition,
  preferredVariant: "landscape" | "square" | "vertical" = "landscape",
): BackgroundPreviewMedia | null {
  const optionWithPreview = option as BackgroundDefinitionWithPreview
  const resolveTypeFromSource = (source: string): BackgroundPreviewMedia["type"] | null => {
    const normalizedSource = source.toLowerCase()

    if (VIDEO_SOURCE_PATTERNS.some((pattern) => normalizedSource.includes(pattern))) {
      return "video"
    }

    if (IMAGE_SOURCE_PATTERNS.some((pattern) => normalizedSource.includes(pattern)) || normalizedSource.includes("/media/")) {
      return "image"
    }

    return null
  }

  const videoCandidates =
    preferredVariant === "vertical"
      ? [optionWithPreview.previewVerticalVideoUrl, optionWithPreview.previewSquareVideoUrl, optionWithPreview.previewVideoUrl]
      : preferredVariant === "square"
        ? [optionWithPreview.previewSquareVideoUrl, optionWithPreview.previewVideoUrl, optionWithPreview.previewVerticalVideoUrl]
        : [optionWithPreview.previewVideoUrl, optionWithPreview.previewSquareVideoUrl, optionWithPreview.previewVerticalVideoUrl]
  const previewCandidates: Array<{ typeHint?: BackgroundPreviewMedia["type"]; source?: string }> = [
    ...videoCandidates.map((source) => ({ typeHint: "video" as const, source })),
    { typeHint: optionWithPreview.previewMediaType, source: optionWithPreview.previewMediaUrl },
    { typeHint: "image", source: optionWithPreview.previewImageUrl },
  ]

  for (const candidate of previewCandidates) {
    if (!candidate.source) {
      continue
    }

    const candidateType = candidate.typeHint ?? resolveTypeFromSource(candidate.source)
    if (candidateType) {
      return { type: candidateType, source: candidate.source }
    }
  }

  const source = option.sourceUrl.toLowerCase()
  const sourceType = resolveTypeFromSource(source)
  if (sourceType) {
    return { type: sourceType, source: option.sourceUrl }
  }

  return null
}

const getSavedBackgroundIdsFromStorage = (): BackgroundId[] => {
  if (typeof window === "undefined") {
    return []
  }

  try {
    const raw = window.localStorage.getItem(CHIMER_SAVED_BACKGROUND_IDS_STORAGE_KEY)
    if (!raw) {
      return []
    }

    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) {
      return []
    }

    return parsed.filter((entry): entry is BackgroundId => typeof entry === "string")
  } catch {
    return []
  }
}

const saveBackgroundIdsToStorage = (ids: BackgroundId[]) => {
  if (typeof window === "undefined") {
    return
  }

  try {
    window.localStorage.setItem(CHIMER_SAVED_BACKGROUND_IDS_STORAGE_KEY, JSON.stringify(ids))
  } catch {
    // noop
  }
}

const hasPreviewMediaType = (option: BackgroundDefinition, type: BackgroundPreviewMedia["type"]) => {
  const optionWithPreview = option as BackgroundDefinitionWithPreview
  if (optionWithPreview.previewMediaType === type) {
    return true
  }

  return type === "image"
    ? Boolean(optionWithPreview.previewImageUrl)
    : Boolean(optionWithPreview.previewVideoUrl || optionWithPreview.previewSquareVideoUrl || optionWithPreview.previewVerticalVideoUrl)
}

// Interactive backgrounds are identified from behavior hints until background
// definitions grow first-class interaction metadata.
const isInteractiveBackgroundOption = (option: BackgroundDefinition) => {
  const haystack = `${option.id} ${option.label} ${option.recommendedUse} ${option.customizationSummary ?? ""}`.toLowerCase()
  return INTERACTIVE_HINT_PATTERNS.some((pattern) => haystack.includes(pattern))
}

// Keep the Shader filter restricted to metadata that actually hints at shader,
// canvas, WebGL, GLSL, or Three.js rendering.
const isShaderBackgroundOption = (option: BackgroundDefinition) => {
  const haystack = [
    option.id,
    option.label,
    option.provider,
    option.sourceUrl,
    option.recommendedUse,
    option.customizationSummary ?? "",
  ].join(" ").toLowerCase()
  return SHADER_HINT_PATTERNS.some((pattern) => haystack.includes(pattern))
}

const isBackgroundCategoryMatch = (
  option: BackgroundDefinition,
  filter: BackgroundVisualCategory,
  savedBackgroundIds: string[],
) => {
  if (filter === "all") {
    return true
  }

  if (filter === "saved") {
    return savedBackgroundIds.includes(option.id)
  }

  if (filter === "premium") {
    return option.requiresSubscription
  }

  if (filter === "static") {
    return option.motionIntensity === "static"
  }

  if (filter === "animated") {
    return option.motionIntensity !== "static"
  }

  if (filter === "interactive") {
    return isInteractiveBackgroundOption(option)
  }

  if (filter === "shader") {
    return isShaderBackgroundOption(option)
  }

  if (filter === "image") {
    return hasPreviewMediaType(option, "image")
  }

  return hasPreviewMediaType(option, "video")
}

const getBackgroundVisualTags = (option: BackgroundDefinition) => {
  const tags: string[] = []

  if (option.motionIntensity === "static") {
    tags.push("Static")
  } else {
    tags.push("Animated")
  }

  if (isInteractiveBackgroundOption(option)) {
    tags.push("Interactive")
  }

  if (isShaderBackgroundOption(option)) {
    tags.push("Shader")
  }

  if (hasPreviewMediaType(option, "image")) {
    tags.push("Image")
  } else if (hasPreviewMediaType(option, "video")) {
    tags.push("Video")
  }

  if (option.requiresSubscription) {
    tags.push("Premium")
  } else {
    tags.push("Free")
  }

  return Array.from(new Set(tags))
}

interface RunningTimerProps {
  timeDisplay: { hours: string; minutes: string; seconds: string }
  activeTimeDisplay: { hours: string; minutes: string; seconds: string }
  currentTime: CurrentTimeParts
  status: "running" | "paused" | "complete" | "clock"
  isFullscreen: boolean
  isAlerting: boolean
  fontSize: number
  movingBackgroundEnabled: boolean
  backgroundId: ChimerSettings["backgroundId"]
  keepTimerScreenAwake: boolean
  showTimerSeconds: boolean
  showCurrentTimeSeconds: boolean
  timeFormat: ChimerSettings["timeFormat"]
  primaryFontColor: string
  secondaryFontColor: string
  clockModeFontColor: string
  clockFontFamily: ChimerSettings["clockFontFamily"]
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
  massageLabLightSpeedParticleCount: number
  massageLabLightSpeedLightColor: string
  massageLabLightSpeedIntensity: number
  massageLabLightSpeedRadius: number
  massageLabLightSpeedCylinderLength: number
  massageLabElectricMistColor: string
  massageLabElectricMistSpeed: number
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
  massageLabFerrofluidFlowDirection: ChimerSettings["massageLabFerrofluidFlowDirection"]
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
  massageLabShapeGridDirection: ChimerSettings["massageLabShapeGridDirection"]
  massageLabShapeGridSpeed: number
  massageLabShapeGridSquareSize: number
  massageLabShapeGridShape: ChimerSettings["massageLabShapeGridShape"]
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
  massageLab3DGlobeViewStyle: ChimerSettings["massageLab3DGlobeViewStyle"]
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
  auroraBarsPaletteMode: ChimerSettings["auroraBarsPaletteMode"]
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
  pixelLiquidDetail: ChimerSettings["pixelLiquidDetail"]
  pixelLiquidMotionSpeed: number
  tileGridPaletteMode: ChimerSettings["tileGridPaletteMode"]
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
  canUseCustomColors: boolean
  canUseAccountColorControls: boolean
  featureKeys: string[]
  activeIntervalMinutes: number | null
  onClose: () => void
  onPause: () => void
  onFullscreen: () => void
  onSettingsChange: (settings: Partial<ChimerSettings>) => void
  onFontSizeChange: (fontSize: number) => void
  onAdjustActiveRemainingMinutes: (deltaMinutes: number) => void
  onSetActiveRemainingDuration: (hours: number, minutes: number) => void
  onSetActiveIntervalMinutes: (minutes: number) => void
  hapticsEnabled: boolean
}

export function RunningTimer({
  timeDisplay,
  activeTimeDisplay,
  currentTime,
  status,
  isFullscreen,
  isAlerting,
  fontSize,
  movingBackgroundEnabled,
  backgroundId,
  keepTimerScreenAwake,
  showTimerSeconds,
  showCurrentTimeSeconds,
  timeFormat,
  primaryFontColor,
  secondaryFontColor,
  clockModeFontColor,
  clockFontFamily,
  clockStrokeEnabled,
  clockStrokeColor,
  clockStrokeWidth,
  clockShadowEnabled,
  clockShadowColor,
  clockShadowStrength,
  clockShadowDirection,
  clockShadowDistance,
  clockShadowFeather,
  clockGlowEnabled,
  clockGlowColor,
  clockGlowStrength,
  movingBackgroundMainColor,
  movingBackgroundOrbColor,
  sparklesMaxSize,
  sparklesMinSize,
  sparklesParticleColor,
  sparklesParticleDensity,
  sparklesSpeed,
  gradientAnimationBackgroundStartColor,
  gradientAnimationBackgroundEndColor,
  gradientAnimationFirstColor,
  gradientAnimationSecondColor,
  gradientAnimationThirdColor,
  gradientAnimationFourthColor,
  gradientAnimationFifthColor,
  gradientAnimationSpeed,
  gradientAnimationSize,
  massageLabGradientPrimaryColor,
  massageLabGradientHarmony,
  massageLabGradientOpacity,
  massageLabStarsColor,
  massageLabStarsSpeed,
  massageLabStarsDensity,
  massageLabStarsParallax,
  massageLabHoleStrokeColor,
  massageLabHoleParticleColor,
  massageLabHoleLineCount,
  massageLabHoleDiscCount,
  massageLabLightSpeedWarpSpeed,
  massageLabLightSpeedParticleCount,
  massageLabLightSpeedLightColor,
  massageLabLightSpeedIntensity,
  massageLabLightSpeedRadius,
  massageLabLightSpeedCylinderLength,
  massageLabElectricMistColor,
  massageLabElectricMistSpeed,
  massageLabElectricMistDetail,
  massageLabElectricMistDistortion,
  massageLabElectricMistBrightness,
  massageLabAstralFlowPaletteMode,
  massageLabAstralFlowPrimaryColor,
  massageLabAstralFlowHarmony,
  massageLabAstralFlowColorOne,
  massageLabAstralFlowColorTwo,
  massageLabAstralFlowColorThree,
  massageLabAstralFlowSpeed,
  massageLabAstralFlowFlowMin,
  massageLabAstralFlowFlowMax,
  massageLabDeepSpaceNebulaPaletteMode,
  massageLabDeepSpaceNebulaPrimaryColor,
  massageLabDeepSpaceNebulaHarmony,
  massageLabDeepSpaceNebulaColorOne,
  massageLabDeepSpaceNebulaColorTwo,
  massageLabDeepSpaceNebulaColorThree,
  massageLabDeepSpaceNebulaSpeed,
  massageLabGridBloomColor,
  massageLabGridBloomSpeed,
  massageLabGridBloomGridScale,
  massageLabGridBloomRotationSpeed,
  massageLabGridBloomFadeFalloff,
  massageLabGridBloomDistortionAmount,
  massageLabGridBloomFlowSpeedX,
  massageLabGridBloomFlowSpeedY,
  massageLabChromeFlowPaletteMode,
  massageLabChromeFlowPrimaryColor,
  massageLabChromeFlowHarmony,
  massageLabChromeFlowColorOne,
  massageLabChromeFlowColorTwo,
  massageLabChromeFlowFlowSpeed,
  massageLabChromeFlowTimeScale,
  massageLabWaveCurrentPaletteMode,
  massageLabWaveCurrentPrimaryColor,
  massageLabWaveCurrentHarmony,
  massageLabWaveCurrentBackgroundColor,
  massageLabWaveCurrentColorOne,
  massageLabWaveCurrentColorTwo,
  massageLabWaveCurrentColorThree,
  massageLabWaveCurrentSpeedX,
  massageLabWaveCurrentSpeedY,
  massageLabWaveCurrentAmplitude,
  massageLabFerrofluidPaletteMode,
  massageLabFerrofluidPrimaryColor,
  massageLabFerrofluidHarmony,
  massageLabFerrofluidColorOne,
  massageLabFerrofluidColorTwo,
  massageLabFerrofluidColorThree,
  massageLabFerrofluidSpeed,
  massageLabFerrofluidScale,
  massageLabFerrofluidTurbulence,
  massageLabFerrofluidFluidity,
  massageLabFerrofluidRimWidth,
  massageLabFerrofluidSharpness,
  massageLabFerrofluidShimmer,
  massageLabFerrofluidGlow,
  massageLabFerrofluidFlowDirection,
  massageLabFerrofluidOpacity,
  massageLabLightfallPaletteMode,
  massageLabLightfallPrimaryColor,
  massageLabLightfallHarmony,
  massageLabLightfallColorOne,
  massageLabLightfallColorTwo,
  massageLabLightfallColorThree,
  massageLabLightfallBackgroundColor,
  massageLabLightfallSpeed,
  massageLabLightfallStreakCount,
  massageLabLightfallStreakWidth,
  massageLabLightfallStreakLength,
  massageLabLightfallGlow,
  massageLabLightfallDensity,
  massageLabLightfallTwinkle,
  massageLabLightfallZoom,
  massageLabLightfallBackgroundGlow,
  massageLabLightfallOpacity,
  massageLabLightfallCursorEnabled,
  massageLabLightfallCursorStrength,
  massageLabLightfallCursorRadius,
  massageLabLightfallCursorDampening,
  massageLabLiquidEtherPaletteMode,
  massageLabLiquidEtherPrimaryColor,
  massageLabLiquidEtherHarmony,
  massageLabLiquidEtherColorOne,
  massageLabLiquidEtherColorTwo,
  massageLabLiquidEtherColorThree,
  massageLabLiquidEtherCursorEnabled,
  massageLabLiquidEtherMouseForce,
  massageLabLiquidEtherCursorSize,
  massageLabLiquidEtherIsViscous,
  massageLabLiquidEtherViscous,
  massageLabLiquidEtherIterationsViscous,
  massageLabLiquidEtherIterationsPoisson,
  massageLabLiquidEtherDt,
  massageLabLiquidEtherBfecc,
  massageLabLiquidEtherResolution,
  massageLabLiquidEtherIsBounce,
  massageLabLiquidEtherAutoDemo,
  massageLabLiquidEtherAutoSpeed,
  massageLabLiquidEtherAutoIntensity,
  massageLabLiquidEtherAutoResumeDelay,
  massageLabLiquidEtherAutoRampDuration,
  massageLabLiquidEtherOpacity,
  massageLabPrismHeight,
  massageLabPrismBaseWidth,
  massageLabPrismAnimationType,
  massageLabPrismGlow,
  massageLabPrismOffsetX,
  massageLabPrismOffsetY,
  massageLabPrismNoise,
  massageLabPrismTransparent,
  massageLabPrismScale,
  massageLabPrismHueShift,
  massageLabPrismColorFrequency,
  massageLabPrismHoverStrength,
  massageLabPrismInertia,
  massageLabPrismBloom,
  massageLabPrismTimeScale,
  massageLabDarkVeilHueShift,
  massageLabDarkVeilNoiseIntensity,
  massageLabDarkVeilScanlineIntensity,
  massageLabDarkVeilSpeed,
  massageLabDarkVeilScanlineFrequency,
  massageLabDarkVeilWarpAmount,
  massageLabDarkVeilResolutionScale,
  massageLabLightPillarPaletteMode,
  massageLabLightPillarPrimaryColor,
  massageLabLightPillarHarmony,
  massageLabLightPillarTopColor,
  massageLabLightPillarBottomColor,
  massageLabLightPillarIntensity,
  massageLabLightPillarRotationSpeed,
  massageLabLightPillarInteractive,
  massageLabLightPillarGlowAmount,
  massageLabLightPillarWidth,
  massageLabLightPillarHeight,
  massageLabLightPillarNoiseIntensity,
  massageLabLightPillarBlendMode,
  massageLabLightPillarRotation,
  massageLabLightPillarQuality,
  massageLabSilkPaletteMode,
  massageLabSilkPrimaryColor,
  massageLabSilkHarmony,
  massageLabSilkColor,
  massageLabSilkSpeed,
  massageLabSilkScale,
  massageLabSilkNoiseIntensity,
  massageLabSilkRotation,
  massageLabFloatingLinesPaletteMode,
  massageLabFloatingLinesPrimaryColor,
  massageLabFloatingLinesHarmony,
  massageLabFloatingLinesColorOne,
  massageLabFloatingLinesColorTwo,
  massageLabFloatingLinesColorThree,
  massageLabFloatingLinesEnableTop,
  massageLabFloatingLinesEnableMiddle,
  massageLabFloatingLinesEnableBottom,
  massageLabFloatingLinesTopLineCount,
  massageLabFloatingLinesMiddleLineCount,
  massageLabFloatingLinesBottomLineCount,
  massageLabFloatingLinesTopLineDistance,
  massageLabFloatingLinesMiddleLineDistance,
  massageLabFloatingLinesBottomLineDistance,
  massageLabFloatingLinesTopWaveX,
  massageLabFloatingLinesTopWaveY,
  massageLabFloatingLinesTopWaveRotate,
  massageLabFloatingLinesMiddleWaveX,
  massageLabFloatingLinesMiddleWaveY,
  massageLabFloatingLinesMiddleWaveRotate,
  massageLabFloatingLinesBottomWaveX,
  massageLabFloatingLinesBottomWaveY,
  massageLabFloatingLinesBottomWaveRotate,
  massageLabFloatingLinesAnimationSpeed,
  massageLabFloatingLinesInteractive,
  massageLabFloatingLinesBendRadius,
  massageLabFloatingLinesBendStrength,
  massageLabFloatingLinesMouseDamping,
  massageLabFloatingLinesParallax,
  massageLabFloatingLinesParallaxStrength,
  massageLabFloatingLinesBlendMode,
  massageLabSideRaysPaletteMode,
  massageLabSideRaysPrimaryColor,
  massageLabSideRaysHarmony,
  massageLabSideRaysColorOne,
  massageLabSideRaysColorTwo,
  massageLabSideRaysSpeed,
  massageLabSideRaysIntensity,
  massageLabSideRaysSpread,
  massageLabSideRaysOrigin,
  massageLabSideRaysTilt,
  massageLabSideRaysSaturation,
  massageLabSideRaysBlend,
  massageLabSideRaysFalloff,
  massageLabSideRaysOpacity,
  massageLabLightRaysPaletteMode,
  massageLabLightRaysPrimaryColor,
  massageLabLightRaysHarmony,
  massageLabLightRaysColor,
  massageLabLightRaysOrigin,
  massageLabLightRaysSpeed,
  massageLabLightRaysSpread,
  massageLabLightRaysLength,
  massageLabLightRaysPulsating,
  massageLabLightRaysFadeDistance,
  massageLabLightRaysSaturation,
  massageLabLightRaysFollowMouse,
  massageLabLightRaysMouseInfluence,
  massageLabLightRaysNoiseAmount,
  massageLabLightRaysDistortion,
  massageLabPixelBlastPaletteMode,
  massageLabPixelBlastPrimaryColor,
  massageLabPixelBlastHarmony,
  massageLabPixelBlastColor,
  massageLabPixelBlastVariant,
  massageLabPixelBlastPixelSize,
  massageLabPixelBlastAntialias,
  massageLabPixelBlastPatternScale,
  massageLabPixelBlastPatternDensity,
  massageLabPixelBlastLiquid,
  massageLabPixelBlastLiquidStrength,
  massageLabPixelBlastLiquidRadius,
  massageLabPixelBlastPixelSizeJitter,
  massageLabPixelBlastEnableRipples,
  massageLabPixelBlastRippleIntensityScale,
  massageLabPixelBlastRippleThickness,
  massageLabPixelBlastRippleSpeed,
  massageLabPixelBlastLiquidWobbleSpeed,
  massageLabPixelBlastAutoPauseOffscreen,
  massageLabPixelBlastSpeed,
  massageLabPixelBlastTransparent,
  massageLabPixelBlastEdgeFade,
  massageLabPixelBlastNoiseAmount,
  massageLabColorBendsPaletteMode,
  massageLabColorBendsPrimaryColor,
  massageLabColorBendsHarmony,
  massageLabColorBendsColorOne,
  massageLabColorBendsColorTwo,
  massageLabColorBendsColorThree,
  massageLabColorBendsColorFour,
  massageLabColorBendsRotation,
  massageLabColorBendsSpeed,
  massageLabColorBendsTransparent,
  massageLabColorBendsAutoRotate,
  massageLabColorBendsScale,
  massageLabColorBendsFrequency,
  massageLabColorBendsWarpStrength,
  massageLabColorBendsInteractive,
  massageLabColorBendsMouseInfluence,
  massageLabColorBendsParallax,
  massageLabColorBendsNoise,
  massageLabColorBendsIterations,
  massageLabColorBendsIntensity,
  massageLabColorBendsBandWidth,
  massageLabEvilEyePaletteMode,
  massageLabEvilEyePrimaryColor,
  massageLabEvilEyeHarmony,
  massageLabEvilEyeColor,
  massageLabEvilEyeBackgroundColor,
  massageLabEvilEyeIntensity,
  massageLabEvilEyePupilSize,
  massageLabEvilEyeIrisWidth,
  massageLabEvilEyeGlowIntensity,
  massageLabEvilEyeScale,
  massageLabEvilEyeNoiseScale,
  massageLabEvilEyePupilFollow,
  massageLabEvilEyeFlameSpeed,
  massageLabEvilEyeInteractive,
  massageLabLineWavesPaletteMode,
  massageLabLineWavesPrimaryColor,
  massageLabLineWavesHarmony,
  massageLabLineWavesColorOne,
  massageLabLineWavesColorTwo,
  massageLabLineWavesColorThree,
  massageLabLineWavesSpeed,
  massageLabLineWavesInnerLineCount,
  massageLabLineWavesOuterLineCount,
  massageLabLineWavesWarpIntensity,
  massageLabLineWavesRotation,
  massageLabLineWavesEdgeFadeWidth,
  massageLabLineWavesColorCycleSpeed,
  massageLabLineWavesBrightness,
  massageLabLineWavesEnableMouseInteraction,
  massageLabLineWavesMouseInfluence,
  massageLabRadarPaletteMode,
  massageLabRadarPrimaryColor,
  massageLabRadarHarmony,
  massageLabRadarColor,
  massageLabRadarBackgroundColor,
  massageLabRadarSpeed,
  massageLabRadarScale,
  massageLabRadarRingCount,
  massageLabRadarSpokeCount,
  massageLabRadarRingThickness,
  massageLabRadarSpokeThickness,
  massageLabRadarSweepSpeed,
  massageLabRadarSweepWidth,
  massageLabRadarSweepLobes,
  massageLabRadarFalloff,
  massageLabRadarBrightness,
  massageLabRadarEnableMouseInteraction,
  massageLabRadarMouseInfluence,
  massageLabSoftAuroraPaletteMode,
  massageLabSoftAuroraPrimaryColor,
  massageLabSoftAuroraHarmony,
  massageLabSoftAuroraColorOne,
  massageLabSoftAuroraColorTwo,
  massageLabSoftAuroraSpeed,
  massageLabSoftAuroraScale,
  massageLabSoftAuroraBrightness,
  massageLabSoftAuroraNoiseFrequency,
  massageLabSoftAuroraNoiseAmplitude,
  massageLabSoftAuroraBandHeight,
  massageLabSoftAuroraBandSpread,
  massageLabSoftAuroraOctaveDecay,
  massageLabSoftAuroraLayerOffset,
  massageLabSoftAuroraColorSpeed,
  massageLabSoftAuroraEnableMouseInteraction,
  massageLabSoftAuroraMouseInfluence,
  massageLabPlasmaPaletteMode,
  massageLabPlasmaPrimaryColor,
  massageLabPlasmaHarmony,
  massageLabPlasmaColor,
  massageLabPlasmaSpeed,
  massageLabPlasmaDirection,
  massageLabPlasmaScale,
  massageLabPlasmaOpacity,
  massageLabPlasmaMouseInteractive,
  massageLabPlasmaWavePaletteMode,
  massageLabPlasmaWavePrimaryColor,
  massageLabPlasmaWaveHarmony,
  massageLabPlasmaWaveColorOne,
  massageLabPlasmaWaveColorTwo,
  massageLabPlasmaWaveXOffset,
  massageLabPlasmaWaveYOffset,
  massageLabPlasmaWaveRotationDeg,
  massageLabPlasmaWaveFocalLength,
  massageLabPlasmaWaveSpeedOne,
  massageLabPlasmaWaveSpeedTwo,
  massageLabPlasmaWaveDirectionTwo,
  massageLabPlasmaWaveBendOne,
  massageLabPlasmaWaveBendTwo,
  massageLabParticlesPaletteMode,
  massageLabParticlesPrimaryColor,
  massageLabParticlesHarmony,
  massageLabParticlesColorOne,
  massageLabParticlesColorTwo,
  massageLabParticlesColorThree,
  massageLabParticlesCount,
  massageLabParticlesSpread,
  massageLabParticlesSpeed,
  massageLabParticlesMoveOnHover,
  massageLabParticlesHoverFactor,
  massageLabParticlesAlpha,
  massageLabParticlesBaseSize,
  massageLabParticlesSizeRandomness,
  massageLabParticlesCameraDistance,
  massageLabParticlesDisableRotation,
  massageLabParticlesPixelRatio,
  massageLabGradientBlindsPaletteMode,
  massageLabGradientBlindsPrimaryColor,
  massageLabGradientBlindsHarmony,
  massageLabGradientBlindsColorOne,
  massageLabGradientBlindsColorTwo,
  massageLabGradientBlindsAngle,
  massageLabGradientBlindsNoise,
  massageLabGradientBlindsBlindCount,
  massageLabGradientBlindsBlindMinWidth,
  massageLabGradientBlindsMouseDampening,
  massageLabGradientBlindsMirror,
  massageLabGradientBlindsSpotlightRadius,
  massageLabGradientBlindsSpotlightSoftness,
  massageLabGradientBlindsSpotlightOpacity,
  massageLabGradientBlindsDistort,
  massageLabGradientBlindsShineDirection,
  massageLabGradientBlindsBlendMode,
  massageLabGradientBlindsDpr,
  massageLabGradientBlindsEnableMouseInteraction,
  massageLabGrainientPaletteMode,
  massageLabGrainientPrimaryColor,
  massageLabGrainientHarmony,
  massageLabGrainientColorOne,
  massageLabGrainientColorTwo,
  massageLabGrainientColorThree,
  massageLabGrainientTimeSpeed,
  massageLabGrainientColorBalance,
  massageLabGrainientWarpStrength,
  massageLabGrainientWarpFrequency,
  massageLabGrainientWarpSpeed,
  massageLabGrainientWarpAmplitude,
  massageLabGrainientBlendAngle,
  massageLabGrainientBlendSoftness,
  massageLabGrainientRotationAmount,
  massageLabGrainientNoiseScale,
  massageLabGrainientGrainAmount,
  massageLabGrainientGrainScale,
  massageLabGrainientGrainAnimated,
  massageLabGrainientContrast,
  massageLabGrainientGamma,
  massageLabGrainientSaturation,
  massageLabGrainientCenterX,
  massageLabGrainientCenterY,
  massageLabGrainientZoom,
  massageLabGridScanPaletteMode,
  massageLabGridScanPrimaryColor,
  massageLabGridScanHarmony,
  massageLabGridScanLinesColor,
  massageLabGridScanScanColor,
  massageLabGridScanSensitivity,
  massageLabGridScanLineThickness,
  massageLabGridScanScanOpacity,
  massageLabGridScanGridScale,
  massageLabGridScanLineStyle,
  massageLabGridScanLineJitter,
  massageLabGridScanDirection,
  massageLabGridScanNoiseIntensity,
  massageLabGridScanBloomOpacity,
  massageLabGridScanScanGlow,
  massageLabGridScanScanSoftness,
  massageLabGridScanPhaseTaper,
  massageLabGridScanScanDuration,
  massageLabGridScanScanDelay,
  massageLabGridScanEnablePointerInteraction,
  massageLabGridScanScanOnClick,
  massageLabBeamsPaletteMode,
  massageLabBeamsPrimaryColor,
  massageLabBeamsHarmony,
  massageLabBeamsLightColor,
  massageLabBeamsBeamWidth,
  massageLabBeamsBeamHeight,
  massageLabBeamsBeamNumber,
  massageLabBeamsSpeed,
  massageLabBeamsNoiseIntensity,
  massageLabBeamsScale,
  massageLabBeamsRotation,
  massageLabPixelSnowPaletteMode,
  massageLabPixelSnowPrimaryColor,
  massageLabPixelSnowHarmony,
  massageLabPixelSnowColor,
  massageLabPixelSnowFlakeSize,
  massageLabPixelSnowMinFlakeSize,
  massageLabPixelSnowPixelResolution,
  massageLabPixelSnowSpeed,
  massageLabPixelSnowDepthFade,
  massageLabPixelSnowFarPlane,
  massageLabPixelSnowBrightness,
  massageLabPixelSnowGamma,
  massageLabPixelSnowDensity,
  massageLabPixelSnowVariant,
  massageLabPixelSnowDirection,
  massageLabLightningPaletteMode,
  massageLabLightningPrimaryColor,
  massageLabLightningHarmony,
  massageLabLightningColor,
  massageLabLightningHue,
  massageLabLightningXOffset,
  massageLabLightningSpeed,
  massageLabLightningIntensity,
  massageLabLightningSize,
  massageLabPrismaticBurstPaletteMode,
  massageLabPrismaticBurstPrimaryColor,
  massageLabPrismaticBurstHarmony,
  massageLabPrismaticBurstColorOne,
  massageLabPrismaticBurstColorTwo,
  massageLabPrismaticBurstColorThree,
  massageLabPrismaticBurstColorFour,
  massageLabPrismaticBurstIntensity,
  massageLabPrismaticBurstSpeed,
  massageLabPrismaticBurstAnimationType,
  massageLabPrismaticBurstDistort,
  massageLabPrismaticBurstOffsetX,
  massageLabPrismaticBurstOffsetY,
  massageLabPrismaticBurstHoverDampness,
  massageLabPrismaticBurstRayCount,
  massageLabPrismaticBurstMixBlendMode,
  massageLabGalaxyPaletteMode,
  massageLabGalaxyPrimaryColor,
  massageLabGalaxyHarmony,
  massageLabGalaxyColor,
  massageLabGalaxyHueShift,
  massageLabGalaxyFocalX,
  massageLabGalaxyFocalY,
  massageLabGalaxyRotationDeg,
  massageLabGalaxyStarSpeed,
  massageLabGalaxyDensity,
  massageLabGalaxySpeed,
  massageLabGalaxyMouseInteraction,
  massageLabGalaxyGlowIntensity,
  massageLabGalaxySaturation,
  massageLabGalaxyMouseRepulsion,
  massageLabGalaxyRepulsionStrength,
  massageLabGalaxyTwinkleIntensity,
  massageLabGalaxyRotationSpeed,
  massageLabGalaxyAutoCenterRepulsion,
  massageLabGalaxyTransparent,
  massageLabDitherPaletteMode,
  massageLabDitherPrimaryColor,
  massageLabDitherHarmony,
  massageLabDitherColor,
  massageLabDitherWaveSpeed,
  massageLabDitherWaveFrequency,
  massageLabDitherWaveAmplitude,
  massageLabDitherColorNum,
  massageLabDitherPixelSize,
  massageLabDitherMouseInteraction,
  massageLabDitherMouseRadius,
  massageLabFaultyTerminalPaletteMode,
  massageLabFaultyTerminalPrimaryColor,
  massageLabFaultyTerminalHarmony,
  massageLabFaultyTerminalTint,
  massageLabFaultyTerminalScale,
  massageLabFaultyTerminalGridMulX,
  massageLabFaultyTerminalGridMulY,
  massageLabFaultyTerminalDigitSize,
  massageLabFaultyTerminalTimeScale,
  massageLabFaultyTerminalScanlineIntensity,
  massageLabFaultyTerminalGlitchAmount,
  massageLabFaultyTerminalFlickerAmount,
  massageLabFaultyTerminalNoiseAmp,
  massageLabFaultyTerminalChromaticAberration,
  massageLabFaultyTerminalDither,
  massageLabFaultyTerminalCurvature,
  massageLabFaultyTerminalMouseReact,
  massageLabFaultyTerminalMouseStrength,
  massageLabFaultyTerminalPageLoadAnimation,
  massageLabFaultyTerminalBrightness,
  massageLabRippleGridPaletteMode,
  massageLabRippleGridPrimaryColor,
  massageLabRippleGridHarmony,
  massageLabRippleGridColor,
  massageLabRippleGridRippleIntensity,
  massageLabRippleGridGridSize,
  massageLabRippleGridGridThickness,
  massageLabRippleGridFadeDistance,
  massageLabRippleGridVignetteStrength,
  massageLabRippleGridGlowIntensity,
  massageLabRippleGridOpacity,
  massageLabRippleGridGridRotation,
  massageLabRippleGridMouseInteraction,
  massageLabRippleGridMouseInteractionRadius,
  massageLabDotFieldPaletteMode,
  massageLabDotFieldPrimaryColor,
  massageLabDotFieldHarmony,
  massageLabDotFieldGradientFromColor,
  massageLabDotFieldGradientFromAlpha,
  massageLabDotFieldGradientToColor,
  massageLabDotFieldGradientToAlpha,
  massageLabDotFieldGlowColor,
  massageLabDotFieldDotRadius,
  massageLabDotFieldDotSpacing,
  massageLabDotFieldCursorRadius,
  massageLabDotFieldCursorForce,
  massageLabDotFieldBulgeOnly,
  massageLabDotFieldBulgeStrength,
  massageLabDotFieldGlowRadius,
  massageLabDotFieldSparkle,
  massageLabDotFieldWaveAmplitude,
  massageLabDotFieldCursorInteraction,
  massageLabDotGridPaletteMode,
  massageLabDotGridPrimaryColor,
  massageLabDotGridHarmony,
  massageLabDotGridBaseColor,
  massageLabDotGridActiveColor,
  massageLabDotGridDotSize,
  massageLabDotGridGap,
  massageLabDotGridProximity,
  massageLabDotGridSpeedTrigger,
  massageLabDotGridShockRadius,
  massageLabDotGridShockStrength,
  massageLabDotGridMaxSpeed,
  massageLabDotGridResistance,
  massageLabDotGridReturnDuration,
  massageLabDotGridCursorInteraction,
  massageLabDotGridClickShock,
  massageLabThreadsPaletteMode,
  massageLabThreadsPrimaryColor,
  massageLabThreadsHarmony,
  massageLabThreadsColor,
  massageLabThreadsAmplitude,
  massageLabThreadsDistance,
  massageLabThreadsEnableMouseInteraction,
  massageLabIridescencePaletteMode,
  massageLabIridescencePrimaryColor,
  massageLabIridescenceHarmony,
  massageLabIridescenceColor,
  massageLabIridescenceSpeed,
  massageLabIridescenceAmplitude,
  massageLabIridescenceMouseReact,
  massageLabWavesPaletteMode,
  massageLabWavesPrimaryColor,
  massageLabWavesHarmony,
  massageLabWavesLineColor,
  massageLabWavesBackgroundColor,
  massageLabWavesTransparentBackground,
  massageLabWavesSpeedX,
  massageLabWavesSpeedY,
  massageLabWavesAmplitudeX,
  massageLabWavesAmplitudeY,
  massageLabWavesGapX,
  massageLabWavesGapY,
  massageLabWavesFriction,
  massageLabWavesTension,
  massageLabWavesMaxCursorMove,
  massageLabWavesCursorInteraction,
  massageLabGridDistortionPaletteMode,
  massageLabGridDistortionPrimaryColor,
  massageLabGridDistortionHarmony,
  massageLabGridDistortionColorOne,
  massageLabGridDistortionColorTwo,
  massageLabGridDistortionColorThree,
  massageLabGridDistortionGrid,
  massageLabGridDistortionMouse,
  massageLabGridDistortionStrength,
  massageLabGridDistortionRelaxation,
  massageLabGridDistortionCursorInteraction,
  massageLabOrbPaletteMode,
  massageLabOrbPrimaryColor,
  massageLabOrbHarmony,
  massageLabOrbColor,
  massageLabOrbHue,
  massageLabOrbHoverIntensity,
  massageLabOrbRotateOnHover,
  massageLabOrbForceHoverState,
  massageLabOrbBackgroundColor,
  massageLabOrbCursorInteraction,
  massageLabLetterGlitchPaletteMode,
  massageLabLetterGlitchPrimaryColor,
  massageLabLetterGlitchHarmony,
  massageLabLetterGlitchColorOne,
  massageLabLetterGlitchColorTwo,
  massageLabLetterGlitchColorThree,
  massageLabLetterGlitchGlitchSpeed,
  massageLabLetterGlitchCenterVignette,
  massageLabLetterGlitchOuterVignette,
  massageLabLetterGlitchSmooth,
  massageLabLetterGlitchCharacters,
  massageLabGridMotionPaletteMode,
  massageLabGridMotionPrimaryColor,
  massageLabGridMotionHarmony,
  massageLabGridMotionGradientColor,
  massageLabGridMotionTileColor,
  massageLabGridMotionTextColor,
  massageLabGridMotionMaxMoveAmount,
  massageLabGridMotionBaseDuration,
  massageLabGridMotionCursorInteraction,
  massageLabShapeGridPaletteMode,
  massageLabShapeGridPrimaryColor,
  massageLabShapeGridHarmony,
  massageLabShapeGridBorderColor,
  massageLabShapeGridHoverFillColor,
  massageLabShapeGridDirection,
  massageLabShapeGridSpeed,
  massageLabShapeGridSquareSize,
  massageLabShapeGridShape,
  massageLabShapeGridHoverTrailAmount,
  massageLabShapeGridCursorInteraction,
  massageLabLiquidChromePaletteMode,
  massageLabLiquidChromePrimaryColor,
  massageLabLiquidChromeHarmony,
  massageLabLiquidChromeBaseColor,
  massageLabLiquidChromeSpeed,
  massageLabLiquidChromeAmplitude,
  massageLabLiquidChromeFrequencyX,
  massageLabLiquidChromeFrequencyY,
  massageLabLiquidChromeInteractive,
  massageLabBalatroPaletteMode,
  massageLabBalatroPrimaryColor,
  massageLabBalatroHarmony,
  massageLabBalatroColorOne,
  massageLabBalatroColorTwo,
  massageLabBalatroColorThree,
  massageLabBalatroSpinRotation,
  massageLabBalatroSpinSpeed,
  massageLabBalatroOffsetX,
  massageLabBalatroOffsetY,
  massageLabBalatroContrast,
  massageLabBalatroLighting,
  massageLabBalatroSpinAmount,
  massageLabBalatroPixelFilter,
  massageLabBalatroSpinEase,
  massageLabBalatroIsRotate,
  massageLabBalatroMouseInteraction,
  massageLabNovatrixPaletteMode,
  massageLabNovatrixPrimaryColor,
  massageLabNovatrixHarmony,
  massageLabNovatrixColor,
  massageLabNovatrixSpeed,
  massageLabNovatrixAmplitude,
  massageLabMatrixRainPaletteMode,
  massageLabMatrixRainPrimaryColor,
  massageLabMatrixRainHarmony,
  massageLabMatrixRainColor,
  massageLabMatrixRainSpeed,
  massageLabMatrixRainFontSize,
  massageLabPhotonBeamPaletteMode,
  massageLabPhotonBeamPrimaryColor,
  massageLabPhotonBeamHarmony,
  massageLabPhotonBeamColorBg,
  massageLabPhotonBeamColorLine,
  massageLabPhotonBeamColorSignal,
  massageLabPhotonBeamUseColor2,
  massageLabPhotonBeamColorSignal2,
  massageLabPhotonBeamUseColor3,
  massageLabPhotonBeamColorSignal3,
  massageLabPhotonBeamLineCount,
  massageLabPhotonBeamSpreadHeight,
  massageLabPhotonBeamSpreadDepth,
  massageLabPhotonBeamCurveLength,
  massageLabPhotonBeamStraightLength,
  massageLabPhotonBeamCurvePower,
  massageLabPhotonBeamWaveSpeed,
  massageLabPhotonBeamWaveHeight,
  massageLabPhotonBeamLineOpacity,
  massageLabPhotonBeamSignalCount,
  massageLabPhotonBeamSpeedGlobal,
  massageLabPhotonBeamTrailLength,
  massageLabPhotonBeamBloomStrength,
  massageLabPhotonBeamBloomRadius,
  massageLab3DGlobeViewStyle,
  massageLab3DGlobeBackgroundColor,
  massageLab3DGlobeGlobeColor,
  massageLab3DGlobeGraphicMapColor,
  massageLab3DGlobeGraphicGlowColor,
  massageLab3DGlobeGraphicMarkerColor,
  massageLab3DGlobeGraphicMapSamples,
  massageLab3DGlobeAutoRotateSpeed,
  massageLab3DGlobeReverseSpin,
  massageLab3DGlobeScale,
  massageLab3DGlobeBumpScale,
  massageLab3DGlobeAmbientIntensity,
  massageLab3DGlobePointLightIntensity,
  massageLab3DGlobeLightingMode,
  massageLab3DGlobeEnablePan,
  massageLab3DGlobePanX,
  massageLab3DGlobePanY,
  massageLab3DGlobeShowTilt,
  massageLab3DGlobeShowAtmosphere,
  massageLab3DGlobeAtmosphereColor,
  massageLab3DGlobeAtmosphereIntensity,
  massageLab3DGlobeAtmosphereBlur,
  massageLab3DGlobeShowWireframe,
  massageLab3DGlobeWireframeColor,
  massageLab3DGlobeMarkerEnabled,
  massageLab3DGlobeMarkerLat,
  massageLab3DGlobeMarkerLng,
  massageLab3DGlobeMarkerLabel,
  massageLab3DGlobeMarkerIcon,
  massageLab3DGlobeMarkerSize,
  massageLabRetroGridBackgroundColor,
  massageLabRetroGridLightLineColor,
  massageLabRetroGridDarkLineColor,
  massageLabRetroGridAngle,
  massageLabRetroGridCellSize,
  massageLabRetroGridOpacity,
  massageLabAerialRaysBackgroundColor,
  massageLabAerialRaysColor,
  massageLabAerialRaysCount,
  massageLabAerialRaysBlur,
  massageLabAerialRaysSpeed,
  massageLabAerialRaysLength,
  massageLabAerialRaysOpacity,
  massageLabSynthesisPaletteMode,
  massageLabSynthesisPrimaryColor,
  massageLabSynthesisHarmony,
  massageLabSynthesisColorOne,
  massageLabSynthesisColorTwo,
  massageLabSynthesisColorThree,
  massageLabSynthesisSpeed,
  massageLabSynthesisComplexity,
  massageLabSynthesisScale,
  massageLabSynthesisDistortion,
  massageLabSynthesisGlowIntensity,
  massageLabSynthesisFlowFrequency,
  backgroundLinesDuration,
  shootingStarsStarColor,
  shootingStarsTrailColor,
  shootingStarsShootingStarColor,
  shootingStarsDensity,
  shootingStarsTwinkle,
  shootingStarsTwinkleSpeed,
  shootingStarsShootingSpeed,
  shootingStarsFrequency,
  canvasRevealDotsBackgroundColor,
  canvasRevealDotsDotColor,
  canvasRevealDotsAccentColor,
  canvasRevealDotsDotSize,
  canvasRevealDotsDotSpacing,
  canvasRevealDotsOpacity,
  canvasRevealDotsAnimationSpeed,
  canvasRevealDotsShowGradient,
  spotlightColor,
  spotlightOpacity,
  spotlightWidth,
  spotlightHeight,
  spotlightSmallWidth,
  spotlightTranslateY,
  spotlightDuration,
  spotlightXOffset,
  lampBackgroundColor,
  lampColor,
  lampGlowOpacity,
  lampBeamWidth,
  lampGlowWidth,
  lampVerticalOffset,
  lampPulseSpeed,
  vortexBackgroundColor,
  vortexBaseHue,
  vortexParticleCount,
  vortexRangeY,
  vortexBaseSpeed,
  vortexRangeSpeed,
  vortexBaseRadius,
  vortexRangeRadius,
  wavyBackgroundFill,
  wavyColorOne,
  wavyColorTwo,
  wavyColorThree,
  wavyColorFour,
  wavyColorFive,
  wavyWaveWidth,
  wavyBlur,
  wavySpeed,
  wavyWaveOpacity,
  auroraBarsBackgroundColor,
  auroraBarsPaletteMode,
  auroraBarsPrimaryColor,
  auroraBarsColorOne,
  auroraBarsColorTwo,
  auroraBarsColorThree,
  auroraBarsColorFour,
  auroraBarsColorFive,
  auroraBarsBarCount,
  auroraBarsSpeed,
  auroraBarsBlur,
  auroraBarsGap,
  auroraBarsMaxHeightRatio,
  auroraBarsMinHeightRatio,
  pixelLiquidBackgroundColor,
  pixelLiquidBaseColor,
  pixelLiquidAccentColor,
  pixelLiquidHighlightColor,
  pixelLiquidPixelSize,
  pixelLiquidDetail,
  pixelLiquidMotionSpeed,
  tileGridPaletteMode,
  tileGridPrimaryColor,
  tileGridColorOne,
  tileGridColorTwo,
  tileGridColorThree,
  tileGridColorFour,
  tileGridColorFive,
  tileGridTileSize,
  tileGridJointSize,
  tileGridChangeFrequency,
  tileGridActivePercent,
  tileGridOpacity,
  hexGridPrimaryColor,
  hexGridHarmony,
  hexGridHexSize,
  hexGridJointSize,
  hexGridChangeFrequency,
  hexGridActivePercent,
  hexGridOpacity,
  canUseCustomColors,
  canUseAccountColorControls,
  featureKeys,
  activeIntervalMinutes,
  onClose,
  onPause,
  onFullscreen,
  onSettingsChange,
  onFontSizeChange,
  onAdjustActiveRemainingMinutes,
  onSetActiveRemainingDuration,
  onSetActiveIntervalMinutes,
  hapticsEnabled,
}: RunningTimerProps) {
  const isPaused = status === "paused"
  const isComplete = status === "complete"
  const isClockMode = status === "clock"
  const canEditActiveTimer = status === "running" || status === "paused"
  const backgroundCategory = isClockMode ? "clock" : "chimer"
  // Preserve the original Lamp path; BackgroundHost owns static fallbacks for premium alternatives.
  const useOriginalLampBackground = backgroundId === DEFAULT_BACKGROUND_ID
  const isLiveBackgroundSession = status === "running" || status === "paused" || status === "clock"
  const shouldRenderLiveBackground = movingBackgroundEnabled && isLiveBackgroundSession
    || !canUseBackgroundId(backgroundId, featureKeys, backgroundCategory)
  const astralFlowDisplaySpeed = getMassageLabAstralFlowDisplaySpeed(massageLabAstralFlowSpeed)
  const astralFlowColors = resolveMassageLabAstralFlowColors({
    massageLabAstralFlowPaletteMode,
    massageLabAstralFlowPrimaryColor,
    massageLabAstralFlowHarmony,
    massageLabAstralFlowColorOne,
    massageLabAstralFlowColorTwo,
    massageLabAstralFlowColorThree,
  })
  const deepSpaceNebulaDisplaySpeed = getMassageLabDeepSpaceNebulaDisplaySpeed(massageLabDeepSpaceNebulaSpeed)
  const deepSpaceNebulaColors = resolveMassageLabDeepSpaceNebulaColors({
    massageLabDeepSpaceNebulaPaletteMode,
    massageLabDeepSpaceNebulaPrimaryColor,
    massageLabDeepSpaceNebulaHarmony,
    massageLabDeepSpaceNebulaColorOne,
    massageLabDeepSpaceNebulaColorTwo,
    massageLabDeepSpaceNebulaColorThree,
  })
  const gridBloomDisplaySpeed = getMassageLabGridBloomDisplaySpeed(massageLabGridBloomSpeed)
  const liquidChromeFlowSpeed = getMassageLabChromeFlowDisplayFlowSpeed(massageLabChromeFlowFlowSpeed)
  const liquidChromeTimeScale = getMassageLabChromeFlowDisplayTimeScale(massageLabChromeFlowTimeScale)
  const liquidChromeColors = resolveMassageLabChromeFlowColors({
    massageLabChromeFlowPaletteMode,
    massageLabChromeFlowPrimaryColor,
    massageLabChromeFlowHarmony,
    massageLabChromeFlowColorOne,
    massageLabChromeFlowColorTwo,
  })
  const wavesSpeedX = getMassageLabWaveCurrentDisplaySpeed(massageLabWaveCurrentSpeedX)
  const wavesSpeedY = getMassageLabWaveCurrentDisplaySpeed(massageLabWaveCurrentSpeedY)
  const wavesColors = resolveMassageLabWaveCurrentColors({
    massageLabWaveCurrentPaletteMode,
    massageLabWaveCurrentPrimaryColor,
    massageLabWaveCurrentHarmony,
    massageLabWaveCurrentBackgroundColor,
    massageLabWaveCurrentColorOne,
    massageLabWaveCurrentColorTwo,
    massageLabWaveCurrentColorThree,
  })
  const ferrofluidColors = resolveMassageLabFerrofluidColors({
    massageLabFerrofluidPaletteMode,
    massageLabFerrofluidPrimaryColor,
    massageLabFerrofluidHarmony,
    massageLabFerrofluidColorOne,
    massageLabFerrofluidColorTwo,
    massageLabFerrofluidColorThree,
  })
  const lightfallColors = resolveMassageLabLightfallColors({
    massageLabLightfallPaletteMode,
    massageLabLightfallPrimaryColor,
    massageLabLightfallHarmony,
    massageLabLightfallColorOne,
    massageLabLightfallColorTwo,
    massageLabLightfallColorThree,
  })
  const lightPillarColors = resolveMassageLabLightPillarColors({
    massageLabLightPillarPaletteMode,
    massageLabLightPillarPrimaryColor,
    massageLabLightPillarHarmony,
    massageLabLightPillarTopColor,
    massageLabLightPillarBottomColor,
  })
  const silkColor = resolveMassageLabSilkColor({
    massageLabSilkPaletteMode,
    massageLabSilkPrimaryColor,
    massageLabSilkHarmony,
    massageLabSilkColor,
  })
  const floatingLinesGradient = resolveMassageLabFloatingLinesGradient({
    massageLabFloatingLinesPaletteMode,
    massageLabFloatingLinesPrimaryColor,
    massageLabFloatingLinesHarmony,
    massageLabFloatingLinesColorOne,
    massageLabFloatingLinesColorTwo,
    massageLabFloatingLinesColorThree,
  })
  const sideRaysColors = resolveMassageLabSideRaysColors({
    massageLabSideRaysPaletteMode,
    massageLabSideRaysPrimaryColor,
    massageLabSideRaysHarmony,
    massageLabSideRaysColorOne,
    massageLabSideRaysColorTwo,
  })
  const lightRaysColor = resolveMassageLabLightRaysColor({
    massageLabLightRaysPaletteMode,
    massageLabLightRaysPrimaryColor,
    massageLabLightRaysHarmony,
    massageLabLightRaysColor,
  })
  const pixelBlastColor = resolveMassageLabPixelBlastColor({
    massageLabPixelBlastPaletteMode,
    massageLabPixelBlastPrimaryColor,
    massageLabPixelBlastHarmony,
    massageLabPixelBlastColor,
  })
  const colorBendsColors = resolveMassageLabColorBendsColors({
    massageLabColorBendsPaletteMode,
    massageLabColorBendsPrimaryColor,
    massageLabColorBendsHarmony,
    massageLabColorBendsColorOne,
    massageLabColorBendsColorTwo,
    massageLabColorBendsColorThree,
    massageLabColorBendsColorFour,
  })
  const evilEyeColor = resolveMassageLabEvilEyeColor({
    massageLabEvilEyePaletteMode,
    massageLabEvilEyePrimaryColor,
    massageLabEvilEyeHarmony,
    massageLabEvilEyeColor,
  })
  const lineWavesColors = resolveMassageLabLineWavesColors({
    massageLabLineWavesPaletteMode,
    massageLabLineWavesPrimaryColor,
    massageLabLineWavesHarmony,
    massageLabLineWavesColorOne,
    massageLabLineWavesColorTwo,
    massageLabLineWavesColorThree,
  })
  const radarColor = resolveMassageLabRadarColor({
    massageLabRadarPaletteMode,
    massageLabRadarPrimaryColor,
    massageLabRadarHarmony,
    massageLabRadarColor,
  })
  const softAuroraColors = resolveMassageLabSoftAuroraColors({
    massageLabSoftAuroraPaletteMode,
    massageLabSoftAuroraPrimaryColor,
    massageLabSoftAuroraHarmony,
    massageLabSoftAuroraColorOne,
    massageLabSoftAuroraColorTwo,
  })
  const plasmaColor = resolveMassageLabPlasmaColor({
    massageLabPlasmaPaletteMode,
    massageLabPlasmaPrimaryColor,
    massageLabPlasmaHarmony,
    massageLabPlasmaColor,
  })
  const plasmaWaveColors = resolveMassageLabPlasmaWaveColors({
    massageLabPlasmaWavePaletteMode,
    massageLabPlasmaWavePrimaryColor,
    massageLabPlasmaWaveHarmony,
    massageLabPlasmaWaveColorOne,
    massageLabPlasmaWaveColorTwo,
  })
  const particlesColors = resolveMassageLabParticlesColors({
    massageLabParticlesPaletteMode,
    massageLabParticlesPrimaryColor,
    massageLabParticlesHarmony,
    massageLabParticlesColorOne,
    massageLabParticlesColorTwo,
    massageLabParticlesColorThree,
  })
  const gradientBlindsColors = resolveMassageLabGradientBlindsColors({
    massageLabGradientBlindsPaletteMode,
    massageLabGradientBlindsPrimaryColor,
    massageLabGradientBlindsHarmony,
    massageLabGradientBlindsColorOne,
    massageLabGradientBlindsColorTwo,
  })
  const grainientColors = resolveMassageLabGrainientColors({
    massageLabGrainientPaletteMode,
    massageLabGrainientPrimaryColor,
    massageLabGrainientHarmony,
    massageLabGrainientColorOne,
    massageLabGrainientColorTwo,
    massageLabGrainientColorThree,
  })
  const gridScanColors = resolveMassageLabGridScanColors({
    massageLabGridScanPaletteMode,
    massageLabGridScanPrimaryColor,
    massageLabGridScanHarmony,
    massageLabGridScanLinesColor,
    massageLabGridScanScanColor,
  })
  const beamsColor = resolveMassageLabBeamsColor({
    massageLabBeamsPaletteMode,
    massageLabBeamsPrimaryColor,
    massageLabBeamsHarmony,
    massageLabBeamsLightColor,
  })
  const pixelSnowColor = resolveMassageLabPixelSnowColor({
    massageLabPixelSnowPaletteMode,
    massageLabPixelSnowPrimaryColor,
    massageLabPixelSnowHarmony,
    massageLabPixelSnowColor,
  })
  const lightningHue = resolveMassageLabLightningHue({
    massageLabLightningPaletteMode,
    massageLabLightningPrimaryColor,
    massageLabLightningHarmony,
    massageLabLightningColor,
    massageLabLightningHue,
  })
  const prismaticBurstColors = resolveMassageLabPrismaticBurstColors({
    massageLabPrismaticBurstPaletteMode,
    massageLabPrismaticBurstPrimaryColor,
    massageLabPrismaticBurstHarmony,
    massageLabPrismaticBurstColorOne,
    massageLabPrismaticBurstColorTwo,
    massageLabPrismaticBurstColorThree,
    massageLabPrismaticBurstColorFour,
  })
  const galaxyHueShift = resolveMassageLabGalaxyHueShift({
    massageLabGalaxyPaletteMode,
    massageLabGalaxyPrimaryColor,
    massageLabGalaxyHarmony,
    massageLabGalaxyColor,
    massageLabGalaxyHueShift,
  })
  const ditherColor = resolveMassageLabDitherColor({
    massageLabDitherPaletteMode,
    massageLabDitherPrimaryColor,
    massageLabDitherHarmony,
    massageLabDitherColor,
  })
  const faultyTerminalTint = resolveMassageLabFaultyTerminalTint({
    massageLabFaultyTerminalPaletteMode,
    massageLabFaultyTerminalPrimaryColor,
    massageLabFaultyTerminalHarmony,
    massageLabFaultyTerminalTint,
  })
  const rippleGridColor = resolveMassageLabRippleGridColor({
    massageLabRippleGridPaletteMode,
    massageLabRippleGridPrimaryColor,
    massageLabRippleGridHarmony,
    massageLabRippleGridColor,
  })
  const dotFieldColors = resolveMassageLabDotFieldColors({
    massageLabDotFieldPaletteMode,
    massageLabDotFieldPrimaryColor,
    massageLabDotFieldHarmony,
    massageLabDotFieldGradientFromColor,
    massageLabDotFieldGradientFromAlpha,
    massageLabDotFieldGradientToColor,
    massageLabDotFieldGradientToAlpha,
    massageLabDotFieldGlowColor,
  })
  const dotGridColors = resolveMassageLabDotGridColors({
    massageLabDotGridPaletteMode,
    massageLabDotGridPrimaryColor,
    massageLabDotGridHarmony,
    massageLabDotGridBaseColor,
    massageLabDotGridActiveColor,
  })
  const threadsColor = resolveMassageLabThreadsColor({
    massageLabThreadsPaletteMode,
    massageLabThreadsPrimaryColor,
    massageLabThreadsHarmony,
    massageLabThreadsColor,
  })
  const iridescenceColor = resolveMassageLabIridescenceColor({
    massageLabIridescencePaletteMode,
    massageLabIridescencePrimaryColor,
    massageLabIridescenceHarmony,
    massageLabIridescenceColor,
  })
  const wavesLineColor = resolveMassageLabWavesLineColor({
    massageLabWavesPaletteMode,
    massageLabWavesPrimaryColor,
    massageLabWavesHarmony,
    massageLabWavesLineColor,
  })
  const gridDistortionColors = resolveMassageLabGridDistortionColors({
    massageLabGridDistortionPaletteMode,
    massageLabGridDistortionPrimaryColor,
    massageLabGridDistortionHarmony,
    massageLabGridDistortionColorOne,
    massageLabGridDistortionColorTwo,
    massageLabGridDistortionColorThree,
  })
  const orbHue = resolveMassageLabOrbHue({
    massageLabOrbPaletteMode,
    massageLabOrbPrimaryColor,
    massageLabOrbHarmony,
    massageLabOrbColor,
    massageLabOrbHue,
  })
  const letterGlitchColors = resolveMassageLabLetterGlitchColors({
    massageLabLetterGlitchPaletteMode,
    massageLabLetterGlitchPrimaryColor,
    massageLabLetterGlitchHarmony,
    massageLabLetterGlitchColorOne,
    massageLabLetterGlitchColorTwo,
    massageLabLetterGlitchColorThree,
  })
  const gridMotionColors = resolveMassageLabGridMotionColors({
    massageLabGridMotionPaletteMode,
    massageLabGridMotionPrimaryColor,
    massageLabGridMotionHarmony,
    massageLabGridMotionGradientColor,
    massageLabGridMotionTileColor,
    massageLabGridMotionTextColor,
  })
  const shapeGridColors = resolveMassageLabShapeGridColors({
    massageLabShapeGridPaletteMode,
    massageLabShapeGridPrimaryColor,
    massageLabShapeGridHarmony,
    massageLabShapeGridBorderColor,
    massageLabShapeGridHoverFillColor,
  })
  const liquidChromeBaseColor = resolveMassageLabLiquidChromeBaseColor({
    massageLabLiquidChromePaletteMode,
    massageLabLiquidChromePrimaryColor,
    massageLabLiquidChromeHarmony,
    massageLabLiquidChromeBaseColor,
  })
  const balatroColors = resolveMassageLabBalatroColors({
    massageLabBalatroPaletteMode,
    massageLabBalatroPrimaryColor,
    massageLabBalatroHarmony,
    massageLabBalatroColorOne,
    massageLabBalatroColorTwo,
    massageLabBalatroColorThree,
  })
  const liquidEtherColors = resolveMassageLabLiquidEtherColors({
    massageLabLiquidEtherPaletteMode,
    massageLabLiquidEtherPrimaryColor,
    massageLabLiquidEtherHarmony,
    massageLabLiquidEtherColorOne,
    massageLabLiquidEtherColorTwo,
    massageLabLiquidEtherColorThree,
  })
  const novatrixSpeed = getMassageLabNovatrixDisplaySpeed(massageLabNovatrixSpeed)
  const novatrixAmplitude = getMassageLabNovatrixDisplayAmplitude(massageLabNovatrixAmplitude)
  const novatrixColor = resolveMassageLabNovatrixColor({
    massageLabNovatrixPaletteMode,
    massageLabNovatrixPrimaryColor,
    massageLabNovatrixHarmony,
    massageLabNovatrixColor,
  })
  const matrixRainSpeed = getMassageLabMatrixRainDisplaySpeed(massageLabMatrixRainSpeed)
  const matrixRainColor = resolveMassageLabMatrixRainColor({
    massageLabMatrixRainPaletteMode,
    massageLabMatrixRainPrimaryColor,
    massageLabMatrixRainHarmony,
    massageLabMatrixRainColor,
  })
  const photonBeamSpeed = getMassageLabPhotonBeamDisplaySpeed(massageLabPhotonBeamSpeedGlobal)
  const photonBeamColors = resolveMassageLabPhotonBeamColors({
    massageLabPhotonBeamPaletteMode,
    massageLabPhotonBeamPrimaryColor,
    massageLabPhotonBeamHarmony,
    massageLabPhotonBeamColorBg,
    massageLabPhotonBeamColorLine,
    massageLabPhotonBeamColorSignal,
    massageLabPhotonBeamUseColor2,
    massageLabPhotonBeamColorSignal2,
    massageLabPhotonBeamUseColor3,
    massageLabPhotonBeamColorSignal3,
  })
  const synthesisDisplaySpeed = getMassageLabSynthesisDisplaySpeed(massageLabSynthesisSpeed)
  const synthesisColors = resolveMassageLabSynthesisColors({
    massageLabSynthesisPaletteMode,
    massageLabSynthesisPrimaryColor,
    massageLabSynthesisHarmony,
    massageLabSynthesisColorOne,
    massageLabSynthesisColorTwo,
    massageLabSynthesisColorThree,
  })
  const [primaryDisplay, setPrimaryDisplay] = useState<PrimaryDisplay>(isClockMode ? "currentTime" : "timer")
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("clock")
  const [backgroundCategoryFilter, setBackgroundCategoryFilter] =
    useState<BackgroundVisualCategory>("all")
  const [savedBackgroundIds, setSavedBackgroundIds] = useState<BackgroundId[]>([])
  const [activeBackgroundCarouselIndex, setActiveBackgroundCarouselIndex] = useState(0)
  const [globalColors, setGlobalColors] = useState<GlobalColorValues>(DEFAULT_CHIMER_GLOBAL_COLORS)
  const [globalHarmony, setGlobalHarmony] = useState<ChimerHarmonyValue>(DEFAULT_CHIMER_GLOBAL_HARMONY)
  const [globalPalettes, setGlobalPalettes] = useState<ChimerSavedPalette[]>([])
  const [globalPaletteName, setGlobalPaletteName] = useState(CHIMER_GLOBAL_PALETTE_DEFAULT_NAME)
  const harmonyPreviewColors = useMemo(() => Object.fromEntries(
    GLOBAL_HARMONY_OPTIONS.map((option) => [
      option.value,
      getPaletteColorsFromGlobalValues(getHarmonyColorsFromPrimary(globalColors.primary, option.value)),
    ]),
  ), [globalColors.primary])
  const [visibleBackgroundPreviewIds, setVisibleBackgroundPreviewIds] = useState<Set<BackgroundId>>(new Set())
  const [controlState, setControlState] = useState<"visible" | "faded" | "hidden">("visible")
  const pressHaptic = useCallback(
    () => {
      triggerHapticFeedback(hapticsEnabled)
    },
    [hapticsEnabled],
  )
  const [fitFontSize, setFitFontSize] = useState<number | null>(null)
  const [maxFittedFontSize, setMaxFittedFontSize] = useState<number | null>(null)
  const [swapAnimationTarget, setSwapAnimationTarget] = useState<PrimaryDisplay | null>(null)
  const fadeTimerRef = useRef<number | null>(null)
  const hideTimerRef = useRef<number | null>(null)
  const settingsAutoCloseTimerRef = useRef<number | null>(null)
  const settingsButtonRef = useRef<HTMLButtonElement | null>(null)
  const settingsPanelRef = useRef<HTMLDivElement | null>(null)
  const primaryDisplayRef = useRef<HTMLButtonElement | null>(null)
  const primaryContentRef = useRef<HTMLSpanElement | null>(null)
  const backgroundVideoRefMap = useRef<Map<BackgroundId, HTMLVideoElement | null>>(new Map())
  const backgroundCarouselSwipeStartRef = useRef<{ x: number; y: number } | null>(null)
  const isTimerPrimary = primaryDisplay === "timer"
  const isCurrentTimePrimary = isClockMode || !isTimerPrimary
  const resolvedShowTimerSeconds = showTimerSeconds !== false
  const resolvedPrimaryFontColor = primaryFontColor || globalColors.primary || DEFAULT_PRIMARY_FONT_COLOR
  const resolvedSecondaryFontColor = secondaryFontColor || globalColors.secondary || DEFAULT_SECONDARY_FONT_COLOR
  const resolvedClockModeFontColor = clockModeFontColor || globalColors.accent || DEFAULT_CLOCK_MODE_FONT_COLOR
  const resolvedTimerDisplayColor = isTimerPrimary ? resolvedPrimaryFontColor : resolvedSecondaryFontColor
  const resolvedCurrentTimeDisplayColor = isClockMode
    ? resolvedClockModeFontColor
    : isCurrentTimePrimary ? resolvedPrimaryFontColor : resolvedSecondaryFontColor
  const [
    globalPalettePrimary,
    globalPaletteSecondary,
    globalPaletteAccent,
    globalPaletteCtaStart,
    globalPaletteCtaEnd,
  ] = getPaletteColorsFromGlobalValues(globalColors)
  const globalPaletteBackground = globalColors.background
  const globalPaletteForeground = globalColors.foreground
  const resolvedClockStrokeColor = resolvePaletteDrivenColor({
    value: clockStrokeColor,
    defaultValue: DEFAULT_CHIMER_SETTINGS.clockStrokeColor,
    globalValue: globalPaletteBackground,
  })
  const resolvedClockShadowColor = resolvePaletteDrivenColor({
    value: clockShadowColor,
    defaultValue: DEFAULT_CHIMER_SETTINGS.clockShadowColor,
    globalValue: globalPaletteBackground,
  })
  const resolvedClockGlowColor = resolvePaletteDrivenColor({
    value: clockGlowColor,
    defaultValue: DEFAULT_CHIMER_SETTINGS.clockGlowColor,
    globalValue: globalPaletteAccent,
  })
  const resolvedClockTextShadow = buildClockTextShadow({
    shadowEnabled: clockShadowEnabled,
    shadowColor: resolvedClockShadowColor,
    shadowStrength: clockShadowStrength,
    shadowDirection: clockShadowDirection,
    shadowDistance: clockShadowDistance,
    shadowFeather: clockShadowFeather,
    glowEnabled: clockGlowEnabled,
    glowColor: resolvedClockGlowColor,
    glowStrength: clockGlowStrength,
  })
  // Global colors provide Lamp defaults without making its specialized controls inert.
  const resolvedMovingBackgroundMainColor = resolvePaletteDrivenColor({
    value: movingBackgroundMainColor,
    defaultValue: DEFAULT_CHIMER_SETTINGS.movingBackgroundMainColor,
    globalValue: globalPalettePrimary,
  })
  const resolvedMovingBackgroundOrbColor = resolvePaletteDrivenColor({
    value: movingBackgroundOrbColor,
    defaultValue: DEFAULT_CHIMER_SETTINGS.movingBackgroundOrbColor,
    globalValue: globalPaletteSecondary,
  })
  const resolvedSparklesParticleColor = resolvePaletteDrivenColor({
    value: sparklesParticleColor,
    defaultValue: DEFAULT_CHIMER_SETTINGS.sparklesParticleColor,
    globalValue: globalPaletteForeground,
  })
  const resolvedGradientAnimationBackgroundStartColor = resolvePaletteDrivenColor({
    value: gradientAnimationBackgroundStartColor,
    defaultValue: DEFAULT_CHIMER_SETTINGS.gradientAnimationBackgroundStartColor,
    globalValue: globalPaletteBackground,
  })
  const resolvedGradientAnimationBackgroundEndColor = resolvePaletteDrivenColor({
    value: gradientAnimationBackgroundEndColor,
    defaultValue: DEFAULT_CHIMER_SETTINGS.gradientAnimationBackgroundEndColor,
    globalValue: globalPaletteForeground,
  })
  const resolvedGradientAnimationFirstColor = resolvePaletteDrivenColor({
    value: gradientAnimationFirstColor,
    defaultValue: DEFAULT_CHIMER_SETTINGS.gradientAnimationFirstColor,
    globalValue: globalPalettePrimary,
  })
  const resolvedGradientAnimationSecondColor = resolvePaletteDrivenColor({
    value: gradientAnimationSecondColor,
    defaultValue: DEFAULT_CHIMER_SETTINGS.gradientAnimationSecondColor,
    globalValue: globalPaletteSecondary,
  })
  const resolvedGradientAnimationThirdColor = resolvePaletteDrivenColor({
    value: gradientAnimationThirdColor,
    defaultValue: DEFAULT_CHIMER_SETTINGS.gradientAnimationThirdColor,
    globalValue: globalPaletteAccent,
  })
  const resolvedGradientAnimationFourthColor = resolvePaletteDrivenColor({
    value: gradientAnimationFourthColor,
    defaultValue: DEFAULT_CHIMER_SETTINGS.gradientAnimationFourthColor,
    globalValue: globalPaletteCtaStart,
  })
  const resolvedGradientAnimationFifthColor = resolvePaletteDrivenColor({
    value: gradientAnimationFifthColor,
    defaultValue: DEFAULT_CHIMER_SETTINGS.gradientAnimationFifthColor,
    globalValue: globalPaletteCtaEnd,
  })
  const resolvedMassageLabGradientPrimaryColor = resolvePaletteDrivenColor({
    value: massageLabGradientPrimaryColor,
    defaultValue: DEFAULT_CHIMER_SETTINGS.massageLabGradientPrimaryColor,
    globalValue: globalPalettePrimary,
  })
  const resolvedMassageLabStarsColor = resolvePaletteDrivenColor({
    value: massageLabStarsColor,
    defaultValue: DEFAULT_CHIMER_SETTINGS.massageLabStarsColor,
    globalValue: globalPaletteForeground,
  })
  const resolvedMassageLabHoleStrokeColor = resolvePaletteDrivenColor({
    value: massageLabHoleStrokeColor,
    defaultValue: DEFAULT_CHIMER_SETTINGS.massageLabHoleStrokeColor,
    globalValue: globalPaletteAccent,
  })
  const resolvedMassageLabHoleParticleColor = resolvePaletteDrivenColor({
    value: massageLabHoleParticleColor,
    defaultValue: DEFAULT_CHIMER_SETTINGS.massageLabHoleParticleColor,
    globalValue: globalPalettePrimary,
  })
  const resolvedMassageLabLightSpeedLightColor = resolvePaletteDrivenColor({
    value: massageLabLightSpeedLightColor,
    defaultValue: DEFAULT_CHIMER_SETTINGS.massageLabLightSpeedLightColor,
    globalValue: globalPaletteAccent,
  })
  const resolvedMassageLabElectricMistColor = resolvePaletteDrivenColor({
    value: massageLabElectricMistColor,
    defaultValue: DEFAULT_CHIMER_SETTINGS.massageLabElectricMistColor,
    globalValue: globalPaletteForeground,
  })
  const primaryActionLabel = isPaused ? "Resume timer" : "Pause timer"
  const statusText = isComplete ? "Session complete" : isPaused ? "Paused" : "Running"
  const hasTimerSeconds = Boolean(timeDisplay.seconds)
  const timerDisplayFitUnits = hasTimerSeconds
    ? timeDisplay.hours === "00" ? 3.02 : 4.35
    : timeDisplay.hours === "00" ? 1.45 : 3.1
  const currentTimeSegmentCount = currentTime.time ? currentTime.time.split(":").length : 2
  const currentTimeDisplayFitUnits = currentTimeSegmentCount > 2 ? 3.42 : 2.38
  const primaryDisplayFitUnits = isTimerPrimary ? timerDisplayFitUnits : currentTimeDisplayFitUnits
  const currentTimeDisplayShapeKey = currentTime.time.includes(":")
    ? `${currentTimeSegmentCount}:${currentTime.meridiem ? "meridiem" : "plain"}`
    : `${currentTime.time}:${currentTime.meridiem}`
  const primaryDisplayContentKey = isTimerPrimary
    ? `${timeDisplay.hours}:${timeDisplay.minutes}:${timeDisplay.seconds}`
    : currentTimeDisplayShapeKey
  const effectiveMaxFontSize = Math.min(MAX_FONT_SIZE, maxFittedFontSize ?? MAX_FONT_SIZE)
  const effectiveFontSize = Math.min(fontSize, effectiveMaxFontSize)
  const canIncreaseFontSize = effectiveFontSize < effectiveMaxFontSize - 0.05
  const canDecreaseFontSize = effectiveFontSize > MIN_FONT_SIZE + 0.05
  const activeRemainingHours = Number(activeTimeDisplay.hours)
  const activeRemainingMinutes = Number(activeTimeDisplay.minutes)
  const selectedBackgroundDefinition = resolveAccessibleBackgroundDefinition(
    backgroundId,
    featureKeys,
    backgroundCategory,
  )
  const visibleBackgroundOptions = useMemo(
    () => getBackgroundOptionsForCategory(backgroundCategory).filter((option) => isBackgroundCategoryMatch(
      option,
      backgroundCategoryFilter,
      savedBackgroundIds,
    )),
    [backgroundCategory, backgroundCategoryFilter, savedBackgroundIds],
  )
  const hasVisibleBackgrounds = visibleBackgroundOptions.length > 0
  const activeBackgroundOption = visibleBackgroundOptions[activeBackgroundCarouselIndex] ?? visibleBackgroundOptions[0] ?? null

  const clearControlTimers = useCallback(() => {
    if (fadeTimerRef.current) {
      window.clearTimeout(fadeTimerRef.current)
      fadeTimerRef.current = null
    }

    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
  }, [])

  const clearSettingsAutoCloseTimer = useCallback(() => {
    if (settingsAutoCloseTimerRef.current) {
      window.clearTimeout(settingsAutoCloseTimerRef.current)
      settingsAutoCloseTimerRef.current = null
    }
  }, [])

  const scheduleSettingsAutoClose = useCallback(() => {
    clearSettingsAutoCloseTimer()
    settingsAutoCloseTimerRef.current = window.setTimeout(() => {
      setIsSettingsOpen(false)
    }, SETTINGS_AUTO_CLOSE_MS)
  }, [clearSettingsAutoCloseTimer])

  const scheduleControlHide = useCallback((options: { force?: boolean } = {}) => {
    clearControlTimers()

    if (isSettingsOpen && !options.force) {
      setControlState("visible")
      return
    }

    fadeTimerRef.current = window.setTimeout(() => setControlState("faded"), 3000)
    hideTimerRef.current = window.setTimeout(() => setControlState("hidden"), 6000)
  }, [clearControlTimers, isSettingsOpen])

  const revealControls = useCallback(() => {
    setControlState("visible")
    scheduleControlHide()
  }, [scheduleControlHide])

  const scheduleHideAfterControlAction = useCallback(
    (options: { force?: boolean } = {}) => {
      window.setTimeout(() => scheduleControlHide(options), 0)
    },
    [scheduleControlHide],
  )

  useEffect(() => {
    if (isComplete || isClockMode) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat) {
        return
      }

      const target = event.target as HTMLElement | null
      if (target?.closest("input, textarea, select, [contenteditable='true'], [data-chimer-control='true']")) {
        return
      }

      event.preventDefault()
      onPause()
      scheduleHideAfterControlAction({ force: true })
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isClockMode, isComplete, onPause, scheduleHideAfterControlAction])

  useEffect(() => {
    revealControls()
    const options: AddEventListenerOptions = { passive: true }
    const handleInteraction = () => revealControls()

    window.addEventListener("pointermove", handleInteraction, options)
    window.addEventListener("pointerdown", handleInteraction, options)
    window.addEventListener("touchstart", handleInteraction, options)
    window.addEventListener("keydown", handleInteraction)
    window.addEventListener("focusin", handleInteraction)

    return () => {
      clearControlTimers()
      window.removeEventListener("pointermove", handleInteraction)
      window.removeEventListener("pointerdown", handleInteraction)
      window.removeEventListener("touchstart", handleInteraction)
      window.removeEventListener("keydown", handleInteraction)
      window.removeEventListener("focusin", handleInteraction)
    }
  }, [clearControlTimers, revealControls])

  useEffect(() => {
    if (isClockMode) {
      setPrimaryDisplay("currentTime")
      setSwapAnimationTarget(null)
    }
  }, [isClockMode])

  useEffect(() => {
    if (!swapAnimationTarget) {
      return
    }

    const timeout = window.setTimeout(() => setSwapAnimationTarget(null), SWAP_ANIMATION_MS)
    return () => window.clearTimeout(timeout)
  }, [swapAnimationTarget])

  useEffect(() => {
    if (!isSettingsOpen) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (!target) {
        return
      }

      if (settingsPanelRef.current?.contains(target) || settingsButtonRef.current?.contains(target)) {
        return
      }

      // The color picker is portaled to document.body so it can escape panel clipping.
      if (target instanceof Element && target.closest(CHIMER_CONTROL_PORTAL_SELECTOR)) {
        return
      }

      setIsSettingsOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsSettingsOpen(false)
      }
    }

    document.addEventListener("pointerdown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [isSettingsOpen])

  useEffect(() => {
    if (isSettingsOpen) {
      clearControlTimers()
      setControlState("visible")
      return
    }

    scheduleControlHide()
  }, [clearControlTimers, isSettingsOpen, scheduleControlHide])

  useEffect(() => {
    if (!isSettingsOpen) {
      clearSettingsAutoCloseTimer()
      return
    }

    scheduleSettingsAutoClose()
    return () => clearSettingsAutoCloseTimer()
  }, [clearSettingsAutoCloseTimer, isSettingsOpen, scheduleSettingsAutoClose])

  useEffect(() => {
    const loadedSavedBackgroundIds = getSavedBackgroundIdsFromStorage()
    setSavedBackgroundIds(loadedSavedBackgroundIds)
  }, [])

  useEffect(() => {
    setActiveBackgroundCarouselIndex((currentIndex) => {
      if (visibleBackgroundOptions.length === 0) {
        return 0
      }

      const selectedIndex = visibleBackgroundOptions.findIndex((option) => option.id === backgroundId)
      if (selectedIndex >= 0) {
        return selectedIndex
      }

      return Math.min(currentIndex, visibleBackgroundOptions.length - 1)
    })
  }, [backgroundId, visibleBackgroundOptions])

  useEffect(() => {
    const loadedGlobalColors = getGlobalColorsFromStorage()
    const loadedHarmony = getGlobalHarmonyFromStorage()
    const loadedPalettes = getSavedGlobalPalettesFromStorage()
    const defaultPalette = loadedPalettes.find((palette) => palette.isDefault)
    const normalizedColors = loadedHarmony === "custom"
      ? loadedGlobalColors
      : getHarmonyColorsFromPrimary(loadedGlobalColors.primary, loadedHarmony)

    setGlobalColors(normalizedColors)
    setGlobalHarmony(loadedHarmony)
    setGlobalPalettes(loadedPalettes)
    setGlobalPaletteName(defaultPalette?.name ?? CHIMER_GLOBAL_PALETTE_DEFAULT_NAME)
    saveGlobalColorState(normalizedColors, loadedHarmony)
    saveGlobalPalettesToStorage(loadedPalettes)
  }, [])

  useEffect(() => {
    // The radial carousel renders several absolute cards, so preview loading is based on the active arc instead of scroll observation.
    if (!isSettingsOpen || settingsTab !== "backgrounds") {
      setVisibleBackgroundPreviewIds(new Set())
      backgroundVideoRefMap.current.forEach((videoRef) => {
        videoRef?.pause()
      })
      return
    }

    const nextVisibleIds = new Set<BackgroundId>([selectedBackgroundDefinition.id])
    const totalOptions = visibleBackgroundOptions.length

    visibleBackgroundOptions.forEach((option, index) => {
      const offset = getCircularCarouselOffset(index, activeBackgroundCarouselIndex, totalOptions)
      if (Math.abs(offset) <= 2) {
        nextVisibleIds.add(option.id)
      }
    })

    setVisibleBackgroundPreviewIds(nextVisibleIds)
  }, [
    activeBackgroundCarouselIndex,
    isSettingsOpen,
    selectedBackgroundDefinition.id,
    settingsTab,
    visibleBackgroundOptions,
  ])

  useEffect(() => {
    backgroundVideoRefMap.current.forEach((videoRef, previewId) => {
      if (!videoRef) {
        return
      }

      if (visibleBackgroundPreviewIds.has(previewId) && isSettingsOpen && settingsTab === "backgrounds") {
        void videoRef.play().catch(() => undefined)
      } else {
        videoRef.pause()
      }
    })
  }, [isSettingsOpen, settingsTab, visibleBackgroundPreviewIds])

  useLayoutEffect(() => {
    const primaryElement = primaryDisplayRef.current
    const contentElement = primaryContentRef.current

    if (!primaryElement || !contentElement) {
      return
    }

    let animationFrame = 0

    const fitPrimaryDisplay = () => {
      window.cancelAnimationFrame(animationFrame)
      animationFrame = window.requestAnimationFrame(() => {
        const preferredFontSize = Math.max(1, window.innerWidth * (fontSize / 100))
        const availableRect = primaryElement.getBoundingClientRect()
        const availableWidth = availableRect.width
        const availableHeight = availableRect.height
        const viewportWidth = window.innerWidth
        if (!availableWidth || !availableHeight || !viewportWidth) {
          return
        }

        const targetWidth = Math.max(1, availableWidth - FONT_FIT_EDGE_INSET_PX)
        const targetHeight = Math.max(1, availableHeight - FONT_FIT_EDGE_INSET_PX)
        primaryElement.style.setProperty("--chimer-fit-font-size", `${preferredFontSize}px`)
        const contentRect = contentElement.getBoundingClientRect()
        const contentWidth = isCurrentTimePrimary
          ? contentRect.width
          : Math.max(contentElement.scrollWidth, contentRect.width)
        const contentHeight = isCurrentTimePrimary
          ? contentRect.height
          : Math.max(contentElement.scrollHeight, contentRect.height)

        if (!contentWidth || !contentHeight) {
          return
        }

        const measuredMaxFontSizePx = Math.max(1, preferredFontSize * (targetWidth / contentWidth))
        const measuredMaxHeightFontSizePx = Math.max(1, preferredFontSize * (targetHeight / contentHeight))
        const profiledMaxFontSizePx = primaryDisplayFitUnits
          ? targetWidth / primaryDisplayFitUnits
          : Number.POSITIVE_INFINITY
        const maxFontSizePx = Math.min(measuredMaxFontSizePx, measuredMaxHeightFontSizePx, profiledMaxFontSizePx)
        const nextFontSize = Math.min(preferredFontSize, maxFontSizePx)
        const nextMaxFittedFontSize = Math.min(MAX_FONT_SIZE, (maxFontSizePx / viewportWidth) * 100)
        primaryElement.style.setProperty("--chimer-fit-font-size", `${nextFontSize}px`)
        setMaxFittedFontSize((current) => {
          if (current !== null && Math.abs(current - nextMaxFittedFontSize) < 0.05) {
            return current
          }

          return nextMaxFittedFontSize
        })
        setFitFontSize((current) => {
          if (current !== null && Math.abs(current - nextFontSize) < 0.5) {
            return current
          }

          return nextFontSize
        })
      })
    }

    fitPrimaryDisplay()

    const resizeObserver = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(fitPrimaryDisplay)
      : null

    resizeObserver?.observe(primaryElement)
    window.addEventListener("resize", fitPrimaryDisplay)
    void document.fonts?.ready.then(fitPrimaryDisplay).catch(() => undefined)

    return () => {
      window.cancelAnimationFrame(animationFrame)
      resizeObserver?.disconnect()
      window.removeEventListener("resize", fitPrimaryDisplay)
    }
  }, [
    fontSize,
    isClockMode,
    isCurrentTimePrimary,
    primaryDisplay,
    primaryDisplayContentKey,
    primaryDisplayFitUnits,
    showCurrentTimeSeconds,
  ])

  const handlePrimarySwitch = (nextDisplay: PrimaryDisplay) => {
    if (nextDisplay === primaryDisplay) {
      return
    }

    setSwapAnimationTarget(nextDisplay)
    setPrimaryDisplay(nextDisplay)
    scheduleHideAfterControlAction({ force: true })
  }

  const handleFontSizeChange = (direction: "increase" | "decrease") => {
    const clampedCurrent = Math.min(fontSize, effectiveMaxFontSize)
    const nextFontSize = direction === "increase"
      ? Math.min(effectiveMaxFontSize, clampedCurrent + FONT_SIZE_STEP)
      : Math.max(MIN_FONT_SIZE, clampedCurrent - FONT_SIZE_STEP)

    if (Math.abs(nextFontSize - fontSize) < 0.05) {
      scheduleHideAfterControlAction({ force: true })
      return
    }

    onFontSizeChange(Number(nextFontSize.toFixed(2)))
    scheduleHideAfterControlAction({ force: true })
  }

  const handleFontSizeRangeChange = (nextFontSize: number) => {
    const clampedNextFontSize = Math.min(effectiveMaxFontSize, Math.max(MIN_FONT_SIZE, nextFontSize))

    if (Math.abs(clampedNextFontSize - fontSize) < 0.05) {
      scheduleHideAfterControlAction({ force: true })
      return
    }

    onFontSizeChange(Number(clampedNextFontSize.toFixed(2)))
    scheduleHideAfterControlAction({ force: true })
  }

  const handleBackgroundFilterChange = (nextFilter: BackgroundVisualCategory) => {
    if (nextFilter === backgroundCategoryFilter) {
      return
    }

    setBackgroundCategoryFilter(nextFilter)
    scheduleSettingsAutoClose()
  }

  const handleBackgroundSelection = (nextBackgroundId: BackgroundId) => {
    const nextBackgroundDefinition = visibleBackgroundOptions.find((option) => option.id === nextBackgroundId)

    if (!nextBackgroundDefinition || !userCanUseBackground(nextBackgroundDefinition, featureKeys)) {
      return
    }

    handleSettingsChange({ movingBackgroundEnabled: true, backgroundId: nextBackgroundId })
  }

  const moveBackgroundCarousel = useCallback(
    (direction: 1 | -1, shouldPlayHaptic = true) => {
      if (visibleBackgroundOptions.length <= 1) {
        return
      }

      if (shouldPlayHaptic) {
        triggerHapticFeedback(hapticsEnabled)
      }
      setActiveBackgroundCarouselIndex((currentIndex) => (
        currentIndex + direction + visibleBackgroundOptions.length
      ) % visibleBackgroundOptions.length)
    },
    [hapticsEnabled, visibleBackgroundOptions.length],
  )

  const handleBackgroundCarouselKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>) => {
      if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
        event.preventDefault()
        moveBackgroundCarousel(-1)
      }

      if (event.key === "ArrowRight" || event.key === "ArrowDown") {
        event.preventDefault()
        moveBackgroundCarousel(1)
      }
    },
    [moveBackgroundCarousel],
  )

  const handleBackgroundCarouselPointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse") {
      return
    }

    backgroundCarouselSwipeStartRef.current = {
      x: event.clientX,
      y: event.clientY,
    }
  }, [])

  const handleBackgroundCarouselPointerUp = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const swipeStart = backgroundCarouselSwipeStartRef.current
      backgroundCarouselSwipeStartRef.current = null

      if (!swipeStart) {
        return
      }

      const deltaX = event.clientX - swipeStart.x
      const deltaY = event.clientY - swipeStart.y
      const isHorizontalSwipe =
        Math.abs(deltaX) >= BACKGROUND_CAROUSEL_SWIPE_THRESHOLD_PX &&
        Math.abs(deltaX) > Math.abs(deltaY) * 1.35

      if (!isHorizontalSwipe) {
        return
      }

      event.preventDefault()
      event.stopPropagation()
      moveBackgroundCarousel(deltaX > 0 ? -1 : 1)
    },
    [moveBackgroundCarousel],
  )

  const handleBackgroundCarouselPointerCancel = useCallback(() => {
    backgroundCarouselSwipeStartRef.current = null
  }, [])

  const handleBackgroundSavedToggle = (nextBackgroundId: BackgroundId) => {
    setSavedBackgroundIds((current) => {
      const isSaved = current.includes(nextBackgroundId)
      const next = isSaved
        ? current.filter((id) => id !== nextBackgroundId)
        : [...current, nextBackgroundId]

      saveBackgroundIdsToStorage(next)
      return next
    })
    scheduleSettingsAutoClose()
  }

  const handleGlobalColorsChange = (nextColors: GlobalColorValues) => {
    const sanitizedColors = sanitizeGlobalColorValues(nextColors)
    const primaryChanged = sanitizedColors.primary !== globalColors.primary

    if (globalHarmony !== "custom" && primaryChanged) {
      const nextHarmonyColors = getHarmonyColorsFromPrimary(sanitizedColors.primary, globalHarmony)
      setGlobalColors(nextHarmonyColors)
      saveGlobalColorState(nextHarmonyColors, globalHarmony)
      return
    }

    setGlobalColors(sanitizedColors)

    if (globalHarmony === "custom") {
      saveGlobalColorState(sanitizedColors, globalHarmony)
      return
    }

    setGlobalHarmony(DEFAULT_CHIMER_GLOBAL_HARMONY)
    saveGlobalColorState(sanitizedColors, DEFAULT_CHIMER_GLOBAL_HARMONY)
  }

  const handleGlobalHarmonyChange = (nextHarmony: ChimerHarmonyValue) => {
    const nextColors = nextHarmony === "custom"
      ? globalColors
      : getHarmonyColorsFromPrimary(globalColors.primary, nextHarmony)

    setGlobalColors(nextColors)
    setGlobalHarmony(nextHarmony)
    saveGlobalColorState(nextColors, nextHarmony)
  }

  /** Switches between direct palette editing and primary-color harmony generation. */
  const handleGlobalCustomColorToggle = (customColorsEnabled: boolean) => {
    handleGlobalHarmonyChange(customColorsEnabled ? "custom" : "analogous")
  }

  const handleGlobalPaletteNameChange = (nextName: string) => {
    setGlobalPaletteName(nextName.trim() || CHIMER_GLOBAL_PALETTE_DEFAULT_NAME)
  }

  const handleGlobalPaletteSave = (nextColors: GlobalColorValues, paletteName: string) => {
    const sourceColorName = paletteName.trim() || CHIMER_GLOBAL_PALETTE_DEFAULT_NAME
    const normalizedColors = sanitizeGlobalColorValues(nextColors)
    const generatedColors = getPaletteColorsFromGlobalValues(normalizedColors)
    const hasExistingDefault = globalPalettes.some((palette) => palette.isDefault)

    setGlobalPalettes((current) => {
      const matchIndex = current.findIndex(
        (palette) => palette.name.trim().toLowerCase() === sourceColorName.toLowerCase(),
      )
      const paletteId = matchIndex >= 0 ? current[matchIndex].id : `palette-${Date.now()}`
      const nextPalette: ChimerSavedPalette = {
        id: paletteId,
        name: sourceColorName,
        sourceColor: normalizedColors.primary,
        harmony: globalHarmony,
        colors: normalizedColors,
        generated: generatedColors,
        isDefault: current[matchIndex]?.isDefault ?? !hasExistingDefault,
        createdAt: new Date().toISOString(),
      }

      if (matchIndex >= 0) {
        const nextPalettes = [...current]
        nextPalettes[matchIndex] = nextPalette
        saveGlobalPalettesToStorage(nextPalettes)
        return nextPalettes
      }

      const nextPalettes = [nextPalette, ...current]
      saveGlobalPalettesToStorage(nextPalettes)
      return nextPalettes
    })

    setGlobalPaletteName(sourceColorName)
  }

  const handleGlobalPaletteLoad = (palette: ChimerSavedPalette) => {
    const normalizedColors = sanitizeGlobalColorValues(palette.colors)
    const nextHarmony = palette.harmony
    const nextColors = nextHarmony === "custom"
      ? normalizedColors
      : getHarmonyColorsFromPrimary(normalizedColors.primary, nextHarmony)

    setGlobalColors(nextColors)
    setGlobalHarmony(nextHarmony)
    setGlobalPaletteName(palette.name)

    const nextPalettes = globalPalettes.map((entry) => ({
      ...entry,
      isDefault: entry.id === palette.id,
    }))
    setGlobalPalettes(nextPalettes)

    saveGlobalColorState(nextColors, nextHarmony)
    saveGlobalPalettesToStorage(nextPalettes)
    scheduleSettingsAutoClose()
  }

  const handlePauseControl = () => {
    onPause()
    scheduleHideAfterControlAction({ force: true })
  }

  const handleFullscreenControl = () => {
    onFullscreen()
    scheduleHideAfterControlAction({ force: true })
  }

  const handleSettingsButtonClick = () => {
    if (isSettingsOpen) {
      setIsSettingsOpen(false)
      scheduleHideAfterControlAction({ force: true })
      return
    }

    clearControlTimers()
    setControlState("visible")
    setSettingsTab("clock")
    setIsSettingsOpen(true)
  }

  const canUseCoreColorControls = canUseCustomColors || canUseAccountColorControls

  const handleSettingsChange = (nextSettings: Partial<ChimerSettings>) => {
    const settingKeys = Object.keys(nextSettings)

    if (!canUseCustomColors && settingKeys.some((key) => PREMIUM_CUSTOM_COLOR_SETTING_KEYS.has(key))) {
      return
    }

    if (!canUseCoreColorControls && settingKeys.some((key) => ACCOUNT_COLOR_SETTING_KEYS.has(key))) {
      return
    }

    onSettingsChange(nextSettings)
    scheduleSettingsAutoClose()
    scheduleControlHide()
  }

  const handleSettingsPanelActivity = () => {
    scheduleSettingsAutoClose()
  }

  const handleSettingsTabChange = (nextTab: string) => {
    if (nextTab === "clock" || nextTab === "visual" || nextTab === "backgrounds") {
      setSettingsTab(nextTab)
    }
    scheduleSettingsAutoClose()
  }

  const handleActiveRemainingHoursChange = (value: string) => {
    onSetActiveRemainingDuration(Number(value), activeRemainingMinutes)
    scheduleSettingsAutoClose()
  }

  const handleActiveRemainingMinutesChange = (value: string) => {
    onSetActiveRemainingDuration(activeRemainingHours, Number(value))
    scheduleSettingsAutoClose()
  }

  const handleActiveIntervalChange = (value: string) => {
    onSetActiveIntervalMinutes(Number(value))
    scheduleSettingsAutoClose()
  }

  const handleActiveRemainingStep = (deltaMinutes: number) => {
    onAdjustActiveRemainingMinutes(deltaMinutes)
    scheduleSettingsAutoClose()
  }

  const getCurrentLocationForGlobe = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      return
    }

    navigator.geolocation.getCurrentPosition(({ coords }) => {
      handleSettingsChange({
        massageLab3DGlobeMarkerEnabled: true,
        massageLab3DGlobeMarkerLat: Number(coords.latitude.toFixed(4)),
        massageLab3DGlobeMarkerLng: Number(coords.longitude.toFixed(4)),
      })
    })
  }

  const massageLab3DGlobeScaleDisplayPercent = getMassageLab3DGlobeScaleDisplayPercent(massageLab3DGlobeScale)
  const isGraphicGlobe = massageLab3DGlobeViewStyle === "graphic"
  const followSun = massageLab3DGlobeLightingMode === "sun"
  /** Render a lightweight preview for catalog cards while keeping live rendering only on selected background activation. */
  const renderBackgroundPreview = (
    option: BackgroundDefinition,
    isLoaded: boolean,
    fallbackStyle?: CSSProperties,
  ) => {
    const media = getBackgroundPreviewMedia(option, "landscape")
    const fallback = fallbackStyle ?? option.fallbackStyle ?? { background: "#0f172a" }

    if (!media || !isLoaded) {
      return (
        <div className={styles.backgroundCardPreview} style={fallback}>
          {media ? (
            <Loader
              shape="sphere"
              variant="dither"
              color="#ea580c"
              size={38}
              className={styles.backgroundCardLoader}
              label="Loading preview"
            />
          ) : null}
        </div>
      )
    }

    if (media.type === "image") {
      return (
        <div className={styles.backgroundCardPreview} style={fallback}>
          <Image
            src={media.source}
            alt=""
            className={styles.backgroundCardMedia}
            fill
            sizes="100vw"
            unoptimized
            aria-hidden="true"
          />
        </div>
      )
    }

    return (
      <div className={styles.backgroundCardPreview} style={fallback}>
        <video
          ref={(element) => {
            if (element) {
              backgroundVideoRefMap.current.set(option.id, element)
            } else {
              backgroundVideoRefMap.current.delete(option.id)
            }
          }}
          className={styles.backgroundCardMedia}
          src={media.source}
          muted
          loop
          playsInline
          preload="none"
          aria-hidden="true"
        />
      </div>
    )
  }

  const renderBackgroundControls = (option: BackgroundDefinition) => (
    <div className={styles.backgroundCardControls}>
      {!isClockMode && (
        <div className={styles.colorRow} title={customColorDisabledHint}>
          <span>Primary color</span>
          <ColorPickerSwatch
            label="Primary display color"
            value={resolvedPrimaryFontColor}
            fallback={DEFAULT_PRIMARY_FONT_COLOR}
            disabled={!canUseCustomColors}
            onChange={(nextColor) => handleSettingsChange({ primaryFontColor: nextColor })}
            className={styles.colorSwatchPicker}
            buttonClassName={styles.colorSwatchButton}
          />
        </div>
      )}

      <div
        className={styles.colorRow}
        title={isClockMode ? accountColorDisabledHint : customColorDisabledHint}
      >
        <span>{isClockMode ? "Clock color" : "Secondary color"}</span>
        <ColorPickerSwatch
          label={isClockMode ? "Clock color" : "Secondary display color"}
          value={isClockMode ? resolvedClockModeFontColor : resolvedSecondaryFontColor}
          fallback={isClockMode ? DEFAULT_CLOCK_MODE_FONT_COLOR : DEFAULT_SECONDARY_FONT_COLOR}
          disabled={isClockMode ? !canUseCoreColorControls : !canUseCustomColors}
          onChange={(nextColor) => handleSettingsChange(
            isClockMode
              ? { clockModeFontColor: nextColor }
              : { secondaryFontColor: nextColor },
          )}
          className={styles.colorSwatchPicker}
          buttonClassName={styles.colorSwatchButton}
        />
      </div>

      {option.id === "massage-lab-moving-gradient" && (
        <>
          <div className={styles.colorRow} title={accountColorDisabledHint}>
            <span>Lamp main color</span>
            <ColorPickerSwatch
              label="Lamp main color"
              value={movingBackgroundMainColor}
              fallback={DEFAULT_CHIMER_SETTINGS.movingBackgroundMainColor}
              disabled={!canUseCoreColorControls}
              onChange={(nextColor) => handleSettingsChange({ movingBackgroundMainColor: nextColor })}
              className={styles.colorSwatchPicker}
              buttonClassName={styles.colorSwatchButton}
            />
          </div>

          <div className={styles.colorRow} title={accountColorDisabledHint}>
            <span>Lamp orb color</span>
            <ColorPickerSwatch
              label="Lamp orb color"
              value={movingBackgroundOrbColor}
              fallback={DEFAULT_CHIMER_SETTINGS.movingBackgroundOrbColor}
              disabled={!canUseCoreColorControls}
              onChange={(nextColor) => handleSettingsChange({ movingBackgroundOrbColor: nextColor })}
              className={styles.colorSwatchPicker}
              buttonClassName={styles.colorSwatchButton}
            />
          </div>
        </>
      )}

      {option.id === "massage-lab-gradient-animation" && (
        <>
          <div className={styles.colorRow}>
            <span>Base start</span>
            <ColorPickerInput
              value={gradientAnimationBackgroundStartColor}
              onValueChange={(nextColor) => handleSettingsChange({ gradientAnimationBackgroundStartColor: nextColor })}
              label="Animated gradient background start color"
            />
          </div>

          <div className={styles.colorRow}>
            <span>Base end</span>
            <ColorPickerInput
              value={gradientAnimationBackgroundEndColor}
              onValueChange={(nextColor) => handleSettingsChange({ gradientAnimationBackgroundEndColor: nextColor })}
              label="Animated gradient background end color"
            />
          </div>

          <div className={styles.colorRow}>
            <span>Glow 1</span>
            <ColorPickerInput
              value={gradientAnimationFirstColor}
              onValueChange={(nextColor) => handleSettingsChange({ gradientAnimationFirstColor: nextColor })}
              label="Animated gradient first glow color"
            />
          </div>

          <div className={styles.colorRow}>
            <span>Glow 2</span>
            <ColorPickerInput
              value={gradientAnimationSecondColor}
              onValueChange={(nextColor) => handleSettingsChange({ gradientAnimationSecondColor: nextColor })}
              label="Animated gradient second glow color"
            />
          </div>

          <div className={styles.colorRow}>
            <span>Glow 3</span>
            <ColorPickerInput
              value={gradientAnimationThirdColor}
              onValueChange={(nextColor) => handleSettingsChange({ gradientAnimationThirdColor: nextColor })}
              label="Animated gradient third glow color"
            />
          </div>

          <div className={styles.colorRow}>
            <span>Glow 4</span>
            <ColorPickerInput
              value={gradientAnimationFourthColor}
              onValueChange={(nextColor) => handleSettingsChange({ gradientAnimationFourthColor: nextColor })}
              label="Animated gradient fourth glow color"
            />
          </div>

          <div className={styles.colorRow}>
            <span>Glow 5</span>
            <ColorPickerInput
              value={gradientAnimationFifthColor}
              onValueChange={(nextColor) => handleSettingsChange({ gradientAnimationFifthColor: nextColor })}
              label="Animated gradient fifth glow color"
            />
          </div>

          <label className={styles.rangeRow}>
            <span>Speed</span>
            <input
              type="range"
              min="0.25"
              max="2.5"
              step="0.25"
              value={gradientAnimationSpeed}
              onChange={(event) => handleSettingsChange({ gradientAnimationSpeed: Number(event.target.value) })}
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
              value={gradientAnimationSize}
              onChange={(event) => handleSettingsChange({ gradientAnimationSize: Number(event.target.value) })}
              aria-label="Animated gradient glow size"
            />
          </label>
        </>
      )}

      {option.id === "massage-lab-gradient" && (
        <>
          <div className={styles.colorRow}>
            <span>Primary color</span>
            <ColorPickerInput
              value={massageLabGradientPrimaryColor}
              onValueChange={(nextColor) => handleSettingsChange({ massageLabGradientPrimaryColor: nextColor })}
              label="MassageLab gradient primary color"
            />
          </div>

          <label className={styles.selectRow}>
            <span>Color harmony</span>
            <select
              value={massageLabGradientHarmony}
              onChange={(event) => handleSettingsChange({
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
            <span>Opacity ({Math.round(massageLabGradientOpacity * 100)}%)</span>
            <input
              type="range"
              min="0.15"
              max="1"
              step="0.01"
              value={massageLabGradientOpacity}
              onChange={(event) => handleSettingsChange({ massageLabGradientOpacity: Number(event.target.value) })}
              aria-label="MassageLab gradient opacity"
            />
          </label>
        </>
      )}

      {option.id === "massage-lab-hole" && (
        <>
          <div className={styles.colorRow}>
            <span>Grid line color</span>
            <ColorPickerInput
              value={massageLabHoleStrokeColor}
              onValueChange={(nextColor) => handleSettingsChange({ massageLabHoleStrokeColor: nextColor })}
              label="MassageLab Hole grid line color"
            />
          </div>

          <div className={styles.colorRow}>
            <span>Particle color</span>
            <ColorPickerInput
              value={massageLabHoleParticleColor}
              onValueChange={(nextColor) => handleSettingsChange({ massageLabHoleParticleColor: nextColor })}
              label="MassageLab Hole particle color"
            />
          </div>

          <label className={styles.rangeRow}>
            <span>Line count ({massageLabHoleLineCount})</span>
            <input
              type="range"
              min="12"
              max="96"
              step="1"
              value={massageLabHoleLineCount}
              onChange={(event) => handleSettingsChange({ massageLabHoleLineCount: Number(event.target.value) })}
              aria-label="MassageLab Hole line count"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Disc count ({massageLabHoleDiscCount})</span>
            <input
              type="range"
              min="12"
              max="96"
              step="1"
              value={massageLabHoleDiscCount}
              onChange={(event) => handleSettingsChange({ massageLabHoleDiscCount: Number(event.target.value) })}
              aria-label="MassageLab Hole disc count"
            />
          </label>
        </>
      )}

      {option.id === "massage-lab-light-speed" && (
        <>
          <div className={styles.colorRow}>
            <span>Light color</span>
            <ColorPickerInput
              value={massageLabLightSpeedLightColor}
              onValueChange={(nextColor) => handleSettingsChange({ massageLabLightSpeedLightColor: nextColor })}
              label="Light Speed light color"
            />
          </div>

          <label className={styles.rangeRow}>
            <span>Warp speed ({massageLabLightSpeedWarpSpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0.1"
              max="24"
              step="0.01"
              value={massageLabLightSpeedWarpSpeed}
              onChange={(event) => handleSettingsChange({ massageLabLightSpeedWarpSpeed: Number(event.target.value) })}
              aria-label="Light Speed warp speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Particles ({massageLabLightSpeedParticleCount})</span>
            <input
              type="range"
              min="20"
              max="200"
              step="5"
              value={massageLabLightSpeedParticleCount}
              onChange={(event) => handleSettingsChange({ massageLabLightSpeedParticleCount: Number(event.target.value) })}
              aria-label="Light Speed particle count"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Glow ({massageLabLightSpeedIntensity.toFixed(2)}x)</span>
            <input
              type="range"
              min="0.25"
              max="6"
              step="0.05"
              value={massageLabLightSpeedIntensity}
              onChange={(event) => handleSettingsChange({ massageLabLightSpeedIntensity: Number(event.target.value) })}
              aria-label="Light Speed glow intensity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Tunnel radius ({massageLabLightSpeedRadius}px)</span>
            <input
              type="range"
              min="6"
              max="60"
              step="1"
              value={massageLabLightSpeedRadius}
              onChange={(event) => handleSettingsChange({ massageLabLightSpeedRadius: Number(event.target.value) })}
              aria-label="Light Speed tunnel radius"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Field length ({massageLabLightSpeedCylinderLength}px)</span>
            <input
              type="range"
              min="40"
              max="300"
              step="5"
              value={massageLabLightSpeedCylinderLength}
              onChange={(event) => handleSettingsChange({ massageLabLightSpeedCylinderLength: Number(event.target.value) })}
              aria-label="Light Speed field length"
            />
          </label>
        </>
      )}

      {option.id === "massage-lab-stars" && (
        <>
          <div className={styles.colorRow}>
            <span>Star color</span>
            <ColorPickerInput
              value={massageLabStarsColor}
              onValueChange={(nextColor) => handleSettingsChange({ massageLabStarsColor: nextColor })}
              label="MassageLab Stars star color"
            />
          </div>

          <label className={styles.rangeRow}>
            <span>Speed ({massageLabStarsSpeed}s)</span>
            <input
              type="range"
              min="18"
              max="120"
              step="1"
              value={massageLabStarsSpeed}
              onChange={(event) => handleSettingsChange({ massageLabStarsSpeed: Number(event.target.value) })}
              aria-label="MassageLab Stars speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Density ({Math.round(massageLabStarsDensity * 100)}%)</span>
            <input
              type="range"
              min="0.25"
              max="1.5"
              step="0.05"
              value={massageLabStarsDensity}
              onChange={(event) => handleSettingsChange({ massageLabStarsDensity: Number(event.target.value) })}
              aria-label="MassageLab Stars density"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Parallax ({Math.round(massageLabStarsParallax * 1000) / 10}%)</span>
            <input
              type="range"
              min="0"
              max="0.12"
              step="0.005"
              value={massageLabStarsParallax}
              onChange={(event) => handleSettingsChange({ massageLabStarsParallax: Number(event.target.value) })}
              aria-label="MassageLab Stars parallax strength"
            />
          </label>
        </>
      )}

      {option.id === "massage-lab-sparkles" && (
        <>
          <div className={styles.colorRow}>
            <span>Sparkle color</span>
            <ColorPickerInput
              value={sparklesParticleColor}
              onValueChange={(nextColor) => handleSettingsChange({ sparklesParticleColor: nextColor })}
              label="Sparkles particle color"
            />
          </div>

          <label className={styles.rangeRow}>
            <span>Density</span>
            <input
              type="range"
              min="20"
              max="220"
              step="1"
              value={sparklesParticleDensity}
              onChange={(event) => handleSettingsChange({ sparklesParticleDensity: Number(event.target.value) })}
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
              value={sparklesSpeed}
              onChange={(event) => handleSettingsChange({ sparklesSpeed: Number(event.target.value) })}
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
              value={sparklesMaxSize}
              onChange={(event) => handleSettingsChange({ sparklesMaxSize: Number(event.target.value) })}
              aria-label="Sparkles particle size"
            />
          </label>
        </>
      )}

      {option.id === "massage-lab-electric-mist" && (
        <>
          <div className={styles.colorRow}>
            <span>Lightning color</span>
            <ColorPickerInput
              value={massageLabElectricMistColor}
              onValueChange={(nextColor) => handleSettingsChange({ massageLabElectricMistColor: nextColor })}
              label="Electric Mist lightning color"
            />
          </div>

          <label className={styles.rangeRow}>
            <span>Animation speed ({Math.round(massageLabElectricMistSpeed)}%)</span>
            <input
              type="range"
              min="1"
              max="400"
              step="1"
              value={massageLabElectricMistSpeed}
              onChange={(event) => handleSettingsChange({ massageLabElectricMistSpeed: Number(event.target.value) })}
              aria-label="Electric Mist animation speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Noise detail ({massageLabElectricMistDetail.toFixed(1)})</span>
            <input
              type="range"
              min="0.5"
              max="4"
              step="0.1"
              value={massageLabElectricMistDetail}
              onChange={(event) => handleSettingsChange({ massageLabElectricMistDetail: Number(event.target.value) })}
              aria-label="Electric Mist noise detail"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Distortion ({massageLabElectricMistDistortion.toFixed(1)}x)</span>
            <input
              type="range"
              min="0"
              max="6"
              step="0.1"
              value={massageLabElectricMistDistortion}
              onChange={(event) => handleSettingsChange({ massageLabElectricMistDistortion: Number(event.target.value) })}
              aria-label="Electric Mist distortion"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Brightness ({Math.round(massageLabElectricMistBrightness)}%)</span>
            <input
              type="range"
              min="1"
              max="100"
              step="1"
              value={massageLabElectricMistBrightness}
              onChange={(event) => handleSettingsChange({ massageLabElectricMistBrightness: Number(event.target.value) })}
              aria-label="Electric Mist brightness"
            />
          </label>
        </>
      )}

      {option.id === "massage-lab-astral-flow" && (
        <>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={massageLabAstralFlowPaletteMode}
              onChange={(event) => handleSettingsChange({
                massageLabAstralFlowPaletteMode: event.target.value as MassageLabAstralFlowPaletteMode,
              })}
              aria-label="Astral Flow color mode"
            >
              <option value="custom">Custom colors</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {massageLabAstralFlowPaletteMode === "custom" ? (
            <>
              <div className={styles.colorRow}>
                <span>Color 1 (deep)</span>
                <ColorPickerInput
                  value={massageLabAstralFlowColorOne}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabAstralFlowColorOne: nextColor })}
                  label="Astral Flow color 1"
                />
              </div>

              <div className={styles.colorRow}>
                <span>Color 2 (mid)</span>
                <ColorPickerInput
                  value={massageLabAstralFlowColorTwo}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabAstralFlowColorTwo: nextColor })}
                  label="Astral Flow color 2"
                />
              </div>

              <div className={styles.colorRow}>
                <span>Color 3 (highlights)</span>
                <ColorPickerInput
                  value={massageLabAstralFlowColorThree}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabAstralFlowColorThree: nextColor })}
                  label="Astral Flow color 3"
                />
              </div>
            </>
          ) : (
            <>
              <div className={styles.colorRow}>
                <span>Primary color</span>
                <ColorPickerInput
                  value={massageLabAstralFlowPrimaryColor}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabAstralFlowPrimaryColor: nextColor })}
                  label="Astral Flow primary color"
                />
              </div>

              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={massageLabAstralFlowHarmony}
                  onChange={(event) => handleSettingsChange({
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
              onChange={(event) => handleSettingsChange({
                massageLabAstralFlowSpeed: getMassageLabAstralFlowSourceSpeed(Number(event.target.value)),
              })}
              aria-label="Astral Flow animation speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Flow min ({massageLabAstralFlowFlowMin.toFixed(1)})</span>
            <input
              type="range"
              min="0.5"
              max="10"
              step="0.1"
              value={massageLabAstralFlowFlowMin}
              onChange={(event) => handleSettingsChange({ massageLabAstralFlowFlowMin: Number(event.target.value) })}
              aria-label="Astral Flow flow min"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Flow max ({massageLabAstralFlowFlowMax.toFixed(1)})</span>
            <input
              type="range"
              min="1"
              max="12"
              step="0.1"
              value={massageLabAstralFlowFlowMax}
              onChange={(event) => handleSettingsChange({ massageLabAstralFlowFlowMax: Number(event.target.value) })}
              aria-label="Astral Flow flow max"
            />
          </label>
        </>
      )}

      {option.id === "massage-lab-deep-space-nebula" && (
        <>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={massageLabDeepSpaceNebulaPaletteMode}
              onChange={(event) => handleSettingsChange({
                massageLabDeepSpaceNebulaPaletteMode: event.target.value as MassageLabDeepSpaceNebulaPaletteMode,
              })}
              aria-label="Deep Space Nebula color mode"
            >
              <option value="custom">Custom colors</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {massageLabDeepSpaceNebulaPaletteMode === "custom" ? (
            <>
              <div className={styles.colorRow}>
                <span>Highlight</span>
                <ColorPickerInput
                  value={massageLabDeepSpaceNebulaColorOne}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabDeepSpaceNebulaColorOne: nextColor })}
                  label="Deep Space Nebula highlight color"
                />
              </div>

              <div className={styles.colorRow}>
                <span>Nebula cloud</span>
                <ColorPickerInput
                  value={massageLabDeepSpaceNebulaColorTwo}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabDeepSpaceNebulaColorTwo: nextColor })}
                  label="Deep Space Nebula cloud color"
                />
              </div>

              <div className={styles.colorRow}>
                <span>Deep space</span>
                <ColorPickerInput
                  value={massageLabDeepSpaceNebulaColorThree}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabDeepSpaceNebulaColorThree: nextColor })}
                  label="Deep Space Nebula deep-space color"
                />
              </div>
            </>
          ) : (
            <>
              <div className={styles.colorRow}>
                <span>Nebula color</span>
                <ColorPickerInput
                  value={massageLabDeepSpaceNebulaPrimaryColor}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabDeepSpaceNebulaPrimaryColor: nextColor })}
                  label="Deep Space Nebula primary color"
                />
              </div>

              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={massageLabDeepSpaceNebulaHarmony}
                  onChange={(event) => handleSettingsChange({
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
            <span>Animation speed ({deepSpaceNebulaDisplaySpeed}%)</span>
            <input
              type="range"
              min={MASSAGE_LAB_DEEP_SPACE_NEBULA_DISPLAY_SPEED_MIN}
              max={MASSAGE_LAB_DEEP_SPACE_NEBULA_DISPLAY_SPEED_MAX}
              step={MASSAGE_LAB_DEEP_SPACE_NEBULA_DISPLAY_SPEED_STEP}
              value={deepSpaceNebulaDisplaySpeed}
              onChange={(event) => handleSettingsChange({
                massageLabDeepSpaceNebulaSpeed: getMassageLabDeepSpaceNebulaSourceSpeed(Number(event.target.value)),
              })}
              aria-label="Deep Space Nebula animation speed"
            />
          </label>
        </>
      )}

      {option.id === "massage-lab-grid-bloom" && (
        <>
          <div className={styles.colorRow}>
            <span>Bloom color</span>
            <ColorPickerInput
              value={massageLabGridBloomColor}
              onValueChange={(nextColor) => handleSettingsChange({ massageLabGridBloomColor: nextColor })}
              label="Grid Bloom bloom color"
            />
          </div>

          <label className={styles.rangeRow}>
            <span>Animation speed ({gridBloomDisplaySpeed}%)</span>
            <input
              type="range"
              min={MASSAGE_LAB_GRID_BLOOM_DISPLAY_SPEED_MIN}
              max={MASSAGE_LAB_GRID_BLOOM_DISPLAY_SPEED_MAX}
              step={MASSAGE_LAB_GRID_BLOOM_DISPLAY_SPEED_STEP}
              value={gridBloomDisplaySpeed}
              onChange={(event) => handleSettingsChange({
                massageLabGridBloomSpeed: getMassageLabGridBloomSourceSpeed(Number(event.target.value)),
              })}
              aria-label="Grid Bloom animation speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Grid density ({massageLabGridBloomGridScale.toFixed(0)})</span>
            <input
              type="range"
              min="4"
              max="32"
              step="1"
              value={massageLabGridBloomGridScale}
              onChange={(event) => handleSettingsChange({ massageLabGridBloomGridScale: Number(event.target.value) })}
              aria-label="Grid Bloom grid density"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Rotation speed ({massageLabGridBloomRotationSpeed.toFixed(1)}x)</span>
            <input
              type="range"
              min="-3"
              max="3"
              step="0.1"
              value={massageLabGridBloomRotationSpeed}
              onChange={(event) => handleSettingsChange({ massageLabGridBloomRotationSpeed: Number(event.target.value) })}
              aria-label="Grid Bloom rotation speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Fade falloff ({massageLabGridBloomFadeFalloff.toFixed(1)})</span>
            <input
              type="range"
              min="1"
              max="24"
              step="0.5"
              value={massageLabGridBloomFadeFalloff}
              onChange={(event) => handleSettingsChange({ massageLabGridBloomFadeFalloff: Number(event.target.value) })}
              aria-label="Grid Bloom fade falloff"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Distortion ({massageLabGridBloomDistortionAmount.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="0.5"
              step="0.01"
              value={massageLabGridBloomDistortionAmount}
              onChange={(event) => handleSettingsChange({
                massageLabGridBloomDistortionAmount: Number(event.target.value),
              })}
              aria-label="Grid Bloom distortion"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Flow X ({massageLabGridBloomFlowSpeedX.toFixed(1)})</span>
            <input
              type="range"
              min="-2"
              max="2"
              step="0.1"
              value={massageLabGridBloomFlowSpeedX}
              onChange={(event) => handleSettingsChange({ massageLabGridBloomFlowSpeedX: Number(event.target.value) })}
              aria-label="Grid Bloom flow X"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Flow Y ({massageLabGridBloomFlowSpeedY.toFixed(1)})</span>
            <input
              type="range"
              min="-2"
              max="2"
              step="0.1"
              value={massageLabGridBloomFlowSpeedY}
              onChange={(event) => handleSettingsChange({ massageLabGridBloomFlowSpeedY: Number(event.target.value) })}
              aria-label="Grid Bloom flow Y"
            />
          </label>
        </>
      )}

      {option.id === "massage-lab-chrome-flow" && (
        <>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={massageLabChromeFlowPaletteMode}
              onChange={(event) => handleSettingsChange({
                massageLabChromeFlowPaletteMode: event.target.value as MassageLabChromeFlowPaletteMode,
              })}
              aria-label="Liquid Chrome color mode"
            >
              <option value="custom">Custom colors</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {massageLabChromeFlowPaletteMode === "custom" ? (
            <>
              <div className={styles.colorRow}>
                <span>Chrome color</span>
                <ColorPickerInput
                  value={massageLabChromeFlowColorOne}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabChromeFlowColorOne: nextColor })}
                  label="Liquid Chrome chrome color"
                />
              </div>

              <div className={styles.colorRow}>
                <span>Shadow color</span>
                <ColorPickerInput
                  value={massageLabChromeFlowColorTwo}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabChromeFlowColorTwo: nextColor })}
                  label="Liquid Chrome shadow color"
                />
              </div>
            </>
          ) : (
            <>
              <div className={styles.colorRow}>
                <span>Primary chrome</span>
                <ColorPickerInput
                  value={massageLabChromeFlowPrimaryColor}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabChromeFlowPrimaryColor: nextColor })}
                  label="Liquid Chrome primary color"
                />
              </div>

              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={massageLabChromeFlowHarmony}
                  onChange={(event) => handleSettingsChange({
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
              onChange={(event) => handleSettingsChange({
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
              onChange={(event) => handleSettingsChange({
                massageLabChromeFlowTimeScale: getMassageLabChromeFlowSourceTimeScale(Number(event.target.value)),
              })}
              aria-label="Liquid Chrome time scale"
            />
          </label>
        </>
      )}

      {option.id === "massage-lab-3d-globe" && (
        <>
          <label className={styles.selectRow}>
            <span>View style</span>
            <select
              value={massageLab3DGlobeViewStyle}
              onChange={(event) => handleSettingsChange({
                massageLab3DGlobeViewStyle: event.target.value as ChimerSettings["massageLab3DGlobeViewStyle"],
              })}
              aria-label="3D Globe view style"
            >
              <option value="realistic">Realistic</option>
              <option value="graphic">Graphic</option>
            </select>
          </label>

          <div className={styles.colorRow}>
            <span>Background</span>
            <ColorPickerInput
              value={massageLab3DGlobeBackgroundColor}
              onValueChange={(nextColor) => handleSettingsChange({ massageLab3DGlobeBackgroundColor: nextColor })}
              label="3D Globe background color"
            />
          </div>

          {isGraphicGlobe ? (
            <>
              <div className={styles.colorRow}>
                <span>Map dots</span>
                <ColorPickerInput
                  value={massageLab3DGlobeGraphicMapColor}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLab3DGlobeGraphicMapColor: nextColor })}
                  label="3D Globe graphic map dot color"
                />
              </div>
              <div className={styles.colorRow}>
                <span>Outer Glow</span>
                <ColorPickerInput
                  value={massageLab3DGlobeGraphicGlowColor}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLab3DGlobeGraphicGlowColor: nextColor })}
                  label="3D Globe graphic outer glow color"
                />
              </div>
              <div className={styles.colorRow}>
                <span>Marker dots</span>
                <ColorPickerInput
                  value={massageLab3DGlobeGraphicMarkerColor}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLab3DGlobeGraphicMarkerColor: nextColor })}
                  label="3D Globe graphic marker color"
                />
              </div>
              <label className={styles.rangeRow}>
                <span>Dot density ({Math.round(massageLab3DGlobeGraphicMapSamples / 1000)}k)</span>
                <input
                  type="range"
                  min="1000"
                  max="10000"
                  step="1000"
                  value={massageLab3DGlobeGraphicMapSamples}
                  onChange={(event) => handleSettingsChange({
                    massageLab3DGlobeGraphicMapSamples: Number(event.target.value),
                  })}
                  aria-label="3D Globe graphic dot density"
                />
              </label>
            </>
          ) : (
            <div className={styles.colorRow}>
              <span>Globe tint</span>
              <ColorPickerInput
                value={massageLab3DGlobeGlobeColor}
                onValueChange={(nextColor) => handleSettingsChange({ massageLab3DGlobeGlobeColor: nextColor })}
                label="3D Globe tint color"
              />
            </div>
          )}

          {!followSun && (
            <>
              <label className={styles.rangeRow}>
                <span>Rotation speed ({massageLab3DGlobeAutoRotateSpeed.toFixed(2)}x)</span>
                <input
                  type="range"
                  min="0.01"
                  max="2"
                  step="0.01"
                  value={massageLab3DGlobeAutoRotateSpeed}
                  onChange={(event) => handleSettingsChange({ massageLab3DGlobeAutoRotateSpeed: Number(event.target.value) })}
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
              onChange={(event) => handleSettingsChange({ massageLab3DGlobeLightingMode: event.target.checked ? "sun" : "manual" })}
              aria-label="3D Globe follow sun"
            />
          </label>

          <label className={styles.switchRow}>
            <span>Pan controls</span>
            <input
              type="checkbox"
              checked={massageLab3DGlobeEnablePan}
              onChange={(event) => handleSettingsChange({ massageLab3DGlobeEnablePan: event.target.checked })}
              aria-label="3D Globe pan controls"
            />
          </label>

          {massageLab3DGlobeEnablePan && (
            <>
              <label className={styles.rangeRow}>
                <span>Pan X Left/Right ({Math.round(massageLab3DGlobePanX)}%)</span>
                <input
                  type="range"
                  min="-50"
                  max="50"
                  step="1"
                  value={massageLab3DGlobePanX}
                  onChange={(event) => handleSettingsChange({ massageLab3DGlobePanX: Number(event.target.value) })}
                  aria-label="3D Globe pan X left right"
                />
              </label>

              <label className={styles.rangeRow}>
                <span>Pan Y Up/Down ({Math.round(massageLab3DGlobePanY)}%)</span>
                <input
                  type="range"
                  min="-50"
                  max="50"
                  step="1"
                  value={massageLab3DGlobePanY}
                  onChange={(event) => handleSettingsChange({ massageLab3DGlobePanY: Number(event.target.value) })}
                  aria-label="3D Globe pan Y up down"
                />
              </label>
            </>
          )}

          <label className={styles.rangeRow}>
            <span>Globe size ({massageLab3DGlobeScaleDisplayPercent}%)</span>
            <input
              type="range"
              min="1"
              max="100"
              step="1"
              value={massageLab3DGlobeScaleDisplayPercent}
              onChange={(event) => handleSettingsChange({
                massageLab3DGlobeScale: getMassageLab3DGlobeScaleFromDisplayPercent(Number(event.target.value)),
              })}
              aria-label="3D Globe size"
            />
          </label>

          {!isGraphicGlobe && (
            <label className={styles.rangeRow}>
              <span>Bump scale ({massageLab3DGlobeBumpScale.toFixed(1)})</span>
              <input
                type="range"
                min="0"
                max="3"
                step="0.1"
                value={massageLab3DGlobeBumpScale}
                onChange={(event) => handleSettingsChange({ massageLab3DGlobeBumpScale: Number(event.target.value) })}
                aria-label="3D Globe bump scale"
              />
            </label>
          )}

          {!followSun && (
            <>
              <label className={styles.rangeRow}>
                <span>Ambient light ({massageLab3DGlobeAmbientIntensity.toFixed(1)})</span>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={massageLab3DGlobeAmbientIntensity}
                  onChange={(event) => handleSettingsChange({ massageLab3DGlobeAmbientIntensity: Number(event.target.value) })}
                  aria-label="3D Globe ambient light"
                />
              </label>

              <label className={styles.rangeRow}>
                <span>Point light ({massageLab3DGlobePointLightIntensity.toFixed(1)})</span>
                <input
                  type="range"
                  min="0"
                  max="4"
                  step="0.1"
                  value={massageLab3DGlobePointLightIntensity}
                  onChange={(event) => handleSettingsChange({ massageLab3DGlobePointLightIntensity: Number(event.target.value) })}
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
                  checked={massageLab3DGlobeShowAtmosphere}
                  onChange={(event) => handleSettingsChange({ massageLab3DGlobeShowAtmosphere: event.target.checked })}
                  aria-label="3D Globe show atmosphere"
                />
              </label>

              {massageLab3DGlobeShowAtmosphere && (
                <>
                  <div className={styles.colorRow}>
                    <span>Atmosphere color</span>
                    <ColorPickerInput
                      value={massageLab3DGlobeAtmosphereColor}
                      onValueChange={(nextColor) => handleSettingsChange({ massageLab3DGlobeAtmosphereColor: nextColor })}
                      label="3D Globe atmosphere color"
                    />
                  </div>
                  <label className={styles.rangeRow}>
                    <span>Atmosphere ({massageLab3DGlobeAtmosphereIntensity.toFixed(1)})</span>
                    <input
                      type="range"
                      min="0"
                      max="2"
                      step="0.1"
                      value={massageLab3DGlobeAtmosphereIntensity}
                      onChange={(event) => handleSettingsChange({ massageLab3DGlobeAtmosphereIntensity: Number(event.target.value) })}
                      aria-label="3D Globe atmosphere intensity"
                    />
                  </label>
                  <label className={styles.rangeRow}>
                    <span>Atmosphere blur ({massageLab3DGlobeAtmosphereBlur.toFixed(1)})</span>
                    <input
                      type="range"
                      min="0.5"
                      max="5"
                      step="0.1"
                      value={massageLab3DGlobeAtmosphereBlur}
                      onChange={(event) => handleSettingsChange({ massageLab3DGlobeAtmosphereBlur: Number(event.target.value) })}
                      aria-label="3D Globe atmosphere blur"
                    />
                  </label>
                </>
              )}

              <label className={styles.switchRow}>
                <span>Wireframe</span>
                <input
                  type="checkbox"
                  checked={massageLab3DGlobeShowWireframe}
                  onChange={(event) => handleSettingsChange({ massageLab3DGlobeShowWireframe: event.target.checked })}
                  aria-label="3D Globe show wireframe"
                />
              </label>

              {massageLab3DGlobeShowWireframe && (
                <div className={styles.colorRow}>
                  <span>Wireframe color</span>
                  <ColorPickerInput
                    value={massageLab3DGlobeWireframeColor}
                    onValueChange={(nextColor) => handleSettingsChange({ massageLab3DGlobeWireframeColor: nextColor })}
                    label="3D Globe wireframe color"
                  />
                </div>
              )}
            </>
          )}

          <label className={styles.switchRow}>
            <span>Location marker</span>
            <input
              type="checkbox"
              checked={massageLab3DGlobeMarkerEnabled}
              onChange={(event) => handleSettingsChange({ massageLab3DGlobeMarkerEnabled: event.target.checked })}
              aria-label="3D Globe location marker"
            />
          </label>

          {massageLab3DGlobeMarkerEnabled && (
            <>
              <div className={styles.locationGrid}>
                <label className={styles.textField}>
                  <span>Latitude</span>
                  <input
                    type="number"
                    min="-90"
                    max="90"
                    step="0.0001"
                    value={massageLab3DGlobeMarkerLat}
                    onChange={(event) => handleSettingsChange({ massageLab3DGlobeMarkerLat: Number(event.target.value) })}
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
                    value={massageLab3DGlobeMarkerLng}
                    onChange={(event) => handleSettingsChange({ massageLab3DGlobeMarkerLng: Number(event.target.value) })}
                    aria-label="3D Globe marker longitude"
                  />
                </label>
              </div>
              <button
                type="button"
                className={`${styles.inlineButton} ${styles.tactileButton}`}
                onClick={() => {
                  pressHaptic()
                  getCurrentLocationForGlobe()
                }}
              >
                Use my location
              </button>
              <label className={styles.textField}>
                <span>Marker label</span>
                <input
                  type="text"
                  placeholder="Optional"
                  value={massageLab3DGlobeMarkerLabel}
                  onChange={(event) => handleSettingsChange({ massageLab3DGlobeMarkerLabel: event.target.value })}
                  aria-label="3D Globe marker label"
                />
              </label>
              <label className={styles.selectRow}>
                <span>Marker icon</span>
                <select
                  value={massageLab3DGlobeMarkerIcon}
                  onChange={(event) => handleSettingsChange({
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
                <span>Marker size ({Math.round(massageLab3DGlobeMarkerSize * 100)}%)</span>
                <input
                  type="range"
                  min="0.03"
                  max="0.16"
                  step="0.005"
                  value={massageLab3DGlobeMarkerSize}
                  onChange={(event) => handleSettingsChange({ massageLab3DGlobeMarkerSize: Number(event.target.value) })}
                  aria-label="3D Globe marker size"
                />
              </label>
            </>
          )}
        </>
      )}

      {option.id === "massage-lab-retro-grid" && (
        <>
          <div className={styles.colorRow}>
            <span>Background</span>
            <ColorPickerInput
              value={massageLabRetroGridBackgroundColor}
              onValueChange={(nextColor) => handleSettingsChange({ massageLabRetroGridBackgroundColor: nextColor })}
              label="Retro Grid background color"
            />
          </div>

          <div className={styles.colorRow}>
            <span>Light line color</span>
            <ColorPickerInput
              value={massageLabRetroGridLightLineColor}
              onValueChange={(nextColor) => handleSettingsChange({ massageLabRetroGridLightLineColor: nextColor })}
              label="Retro Grid light line color"
            />
          </div>

          <div className={styles.colorRow}>
            <span>Dark line color</span>
            <ColorPickerInput
              value={massageLabRetroGridDarkLineColor}
              onValueChange={(nextColor) => handleSettingsChange({ massageLabRetroGridDarkLineColor: nextColor })}
              label="Retro Grid dark line color"
            />
          </div>

          <label className={styles.rangeRow}>
            <span>Angle ({massageLabRetroGridAngle.toFixed(0)} deg)</span>
            <input
              type="range"
              min="1"
              max="89"
              step="1"
              value={massageLabRetroGridAngle}
              onChange={(event) => handleSettingsChange({ massageLabRetroGridAngle: Number(event.target.value) })}
              aria-label="Retro Grid angle"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Cell size ({massageLabRetroGridCellSize.toFixed(0)}px)</span>
            <input
              type="range"
              min="12"
              max="160"
              step="1"
              value={massageLabRetroGridCellSize}
              onChange={(event) => handleSettingsChange({ massageLabRetroGridCellSize: Number(event.target.value) })}
              aria-label="Retro Grid cell size"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Grid opacity ({Math.round(massageLabRetroGridOpacity * 100)}%)</span>
            <input
              type="range"
              min="0.05"
              max="1"
              step="0.01"
              value={massageLabRetroGridOpacity}
              onChange={(event) => handleSettingsChange({ massageLabRetroGridOpacity: Number(event.target.value) })}
              aria-label="Retro Grid opacity"
            />
          </label>
        </>
      )}

      {option.id === "massage-lab-aerial-rays" && (
        <>
          <div className={styles.colorRow}>
            <span>Background</span>
            <ColorPickerInput
              value={massageLabAerialRaysBackgroundColor}
              onValueChange={(nextColor) => handleSettingsChange({ massageLabAerialRaysBackgroundColor: nextColor })}
              label="Light Rays background color"
            />
          </div>

          <div className={styles.colorRow}>
            <span>Ray color</span>
            <ColorPickerInput
              value={massageLabAerialRaysColor}
              onValueChange={(nextColor) => handleSettingsChange({ massageLabAerialRaysColor: nextColor })}
              label="Light Rays color"
            />
          </div>

          <label className={styles.rangeRow}>
            <span>Ray count ({massageLabAerialRaysCount})</span>
            <input
              type="range"
              min="1"
              max="20"
              step="1"
              value={massageLabAerialRaysCount}
              onChange={(event) => handleSettingsChange({ massageLabAerialRaysCount: Number(event.target.value) })}
              aria-label="Light Rays count"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Blur ({massageLabAerialRaysBlur.toFixed(0)}px)</span>
            <input
              type="range"
              min="0"
              max="80"
              step="1"
              value={massageLabAerialRaysBlur}
              onChange={(event) => handleSettingsChange({ massageLabAerialRaysBlur: Number(event.target.value) })}
              aria-label="Light Rays blur"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Speed ({massageLabAerialRaysSpeed.toFixed(1)}s)</span>
            <input
              type="range"
              min="2"
              max="40"
              step="0.5"
              value={massageLabAerialRaysSpeed}
              onChange={(event) => handleSettingsChange({ massageLabAerialRaysSpeed: Number(event.target.value) })}
              aria-label="Light Rays speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Ray length ({massageLabAerialRaysLength.toFixed(0)}vh)</span>
            <input
              type="range"
              min="24"
              max="120"
              step="1"
              value={massageLabAerialRaysLength}
              onChange={(event) => handleSettingsChange({ massageLabAerialRaysLength: Number(event.target.value) })}
              aria-label="Light Rays length"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Ray opacity ({Math.round(massageLabAerialRaysOpacity * 100)}%)</span>
            <input
              type="range"
              min="0.05"
              max="1"
              step="0.01"
              value={massageLabAerialRaysOpacity}
              onChange={(event) => handleSettingsChange({ massageLabAerialRaysOpacity: Number(event.target.value) })}
              aria-label="Light Rays opacity"
            />
          </label>
        </>
      )}

      {option.id === "massage-lab-wave-current" && (
        <>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={massageLabWaveCurrentPaletteMode}
              onChange={(event) => handleSettingsChange({
                massageLabWaveCurrentPaletteMode: event.target.value as MassageLabWaveCurrentPaletteMode,
              })}
              aria-label="Waves color mode"
            >
              <option value="custom">Custom colors</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {massageLabWaveCurrentPaletteMode === "custom" ? (
            <>
              <div className={styles.colorRow}>
                <span>Background</span>
                <ColorPickerInput
                  value={massageLabWaveCurrentBackgroundColor}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabWaveCurrentBackgroundColor: nextColor })}
                  label="Waves background color"
                />
              </div>

              <div className={styles.colorRow}>
                <span>Primary wave</span>
                <ColorPickerInput
                  value={massageLabWaveCurrentColorOne}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabWaveCurrentColorOne: nextColor })}
                  label="Waves primary wave color"
                />
              </div>

              <div className={styles.colorRow}>
                <span>Highlight</span>
                <ColorPickerInput
                  value={massageLabWaveCurrentColorTwo}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabWaveCurrentColorTwo: nextColor })}
                  label="Waves highlight color"
                />
              </div>

              <div className={styles.colorRow}>
                <span>Valley</span>
                <ColorPickerInput
                  value={massageLabWaveCurrentColorThree}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabWaveCurrentColorThree: nextColor })}
                  label="Waves valley color"
                />
              </div>
            </>
          ) : (
            <>
              <div className={styles.colorRow}>
                <span>Primary wave</span>
                <ColorPickerInput
                  value={massageLabWaveCurrentPrimaryColor}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabWaveCurrentPrimaryColor: nextColor })}
                  label="Waves primary color"
                />
              </div>

              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={massageLabWaveCurrentHarmony}
                  onChange={(event) => handleSettingsChange({
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
              onChange={(event) => handleSettingsChange({
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
              onChange={(event) => handleSettingsChange({
                massageLabWaveCurrentSpeedY: getMassageLabWaveCurrentSourceSpeed(Number(event.target.value)),
              })}
              aria-label="Waves speed Y"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Amplitude ({massageLabWaveCurrentAmplitude.toFixed(0)})</span>
            <input
              type="range"
              min="8"
              max="64"
              step="1"
              value={massageLabWaveCurrentAmplitude}
              onChange={(event) => handleSettingsChange({ massageLabWaveCurrentAmplitude: Number(event.target.value) })}
              aria-label="Waves amplitude"
            />
          </label>
        </>
      )}

      {option.id === "massage-lab-ferrofluid" && (
        <>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={massageLabFerrofluidPaletteMode}
              onChange={(event) => handleSettingsChange({
                massageLabFerrofluidPaletteMode: event.target.value as MassageLabFerrofluidPaletteMode,
              })}
              aria-label="Ferrofluid color mode"
            >
              <option value="custom">Custom colors</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {massageLabFerrofluidPaletteMode === "custom" ? (
            <>
              <div className={styles.colorRow}>
                <span>Color 1</span>
                <ColorPickerInput
                  value={massageLabFerrofluidColorOne}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabFerrofluidColorOne: nextColor })}
                  label="Ferrofluid first color"
                />
              </div>
              <div className={styles.colorRow}>
                <span>Color 2</span>
                <ColorPickerInput
                  value={massageLabFerrofluidColorTwo}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabFerrofluidColorTwo: nextColor })}
                  label="Ferrofluid second color"
                />
              </div>
              <div className={styles.colorRow}>
                <span>Color 3</span>
                <ColorPickerInput
                  value={massageLabFerrofluidColorThree}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabFerrofluidColorThree: nextColor })}
                  label="Ferrofluid third color"
                />
              </div>
            </>
          ) : (
            <>
              <div className={styles.colorRow}>
                <span>Primary color</span>
                <ColorPickerInput
                  value={massageLabFerrofluidPrimaryColor}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabFerrofluidPrimaryColor: nextColor })}
                  label="Ferrofluid primary color"
                />
              </div>
              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={massageLabFerrofluidHarmony}
                  onChange={(event) => handleSettingsChange({
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
              value={massageLabFerrofluidFlowDirection}
              onChange={(event) => handleSettingsChange({
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
            <span>Animation speed ({massageLabFerrofluidSpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0.05"
              max="2"
              step="0.05"
              value={massageLabFerrofluidSpeed}
              onChange={(event) => handleSettingsChange({ massageLabFerrofluidSpeed: Number(event.target.value) })}
              aria-label="Ferrofluid animation speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Scale ({massageLabFerrofluidScale.toFixed(1)})</span>
            <input
              type="range"
              min="0.5"
              max="4"
              step="0.1"
              value={massageLabFerrofluidScale}
              onChange={(event) => handleSettingsChange({ massageLabFerrofluidScale: Number(event.target.value) })}
              aria-label="Ferrofluid scale"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Turbulence ({massageLabFerrofluidTurbulence.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.05"
              value={massageLabFerrofluidTurbulence}
              onChange={(event) => handleSettingsChange({ massageLabFerrofluidTurbulence: Number(event.target.value) })}
              aria-label="Ferrofluid turbulence"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Fluidity ({massageLabFerrofluidFluidity.toFixed(3)})</span>
            <input
              type="range"
              min="0.001"
              max="0.4"
              step="0.001"
              value={massageLabFerrofluidFluidity}
              onChange={(event) => handleSettingsChange({ massageLabFerrofluidFluidity: Number(event.target.value) })}
              aria-label="Ferrofluid fluidity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Rim width ({massageLabFerrofluidRimWidth.toFixed(2)})</span>
            <input
              type="range"
              min="0.03"
              max="0.5"
              step="0.01"
              value={massageLabFerrofluidRimWidth}
              onChange={(event) => handleSettingsChange({ massageLabFerrofluidRimWidth: Number(event.target.value) })}
              aria-label="Ferrofluid rim width"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Sharpness ({massageLabFerrofluidSharpness.toFixed(1)})</span>
            <input
              type="range"
              min="0.5"
              max="6"
              step="0.1"
              value={massageLabFerrofluidSharpness}
              onChange={(event) => handleSettingsChange({ massageLabFerrofluidSharpness: Number(event.target.value) })}
              aria-label="Ferrofluid sharpness"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Shimmer ({massageLabFerrofluidShimmer.toFixed(1)})</span>
            <input
              type="range"
              min="0"
              max="4"
              step="0.1"
              value={massageLabFerrofluidShimmer}
              onChange={(event) => handleSettingsChange({ massageLabFerrofluidShimmer: Number(event.target.value) })}
              aria-label="Ferrofluid shimmer"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Glow ({massageLabFerrofluidGlow.toFixed(1)})</span>
            <input
              type="range"
              min="0.1"
              max="5"
              step="0.1"
              value={massageLabFerrofluidGlow}
              onChange={(event) => handleSettingsChange({ massageLabFerrofluidGlow: Number(event.target.value) })}
              aria-label="Ferrofluid glow"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Opacity ({Math.round(massageLabFerrofluidOpacity * 100)}%)</span>
            <input
              type="range"
              min="0.05"
              max="1"
              step="0.01"
              value={massageLabFerrofluidOpacity}
              onChange={(event) => handleSettingsChange({ massageLabFerrofluidOpacity: Number(event.target.value) })}
              aria-label="Ferrofluid opacity"
            />
          </label>
        </>
      )}

      {option.id === "massage-lab-lightfall" && (
        <>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={massageLabLightfallPaletteMode}
              onChange={(event) => handleSettingsChange({
                massageLabLightfallPaletteMode: event.target.value as MassageLabLightfallPaletteMode,
              })}
              aria-label="Lightfall color mode"
            >
              <option value="custom">Custom colors</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {massageLabLightfallPaletteMode === "custom" ? (
            <>
              <div className={styles.colorRow}>
                <span>Color 1</span>
                <ColorPickerInput
                  value={massageLabLightfallColorOne}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabLightfallColorOne: nextColor })}
                  label="Lightfall first color"
                />
              </div>
              <div className={styles.colorRow}>
                <span>Color 2</span>
                <ColorPickerInput
                  value={massageLabLightfallColorTwo}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabLightfallColorTwo: nextColor })}
                  label="Lightfall second color"
                />
              </div>
              <div className={styles.colorRow}>
                <span>Color 3</span>
                <ColorPickerInput
                  value={massageLabLightfallColorThree}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabLightfallColorThree: nextColor })}
                  label="Lightfall third color"
                />
              </div>
            </>
          ) : (
            <>
              <div className={styles.colorRow}>
                <span>Primary color</span>
                <ColorPickerInput
                  value={massageLabLightfallPrimaryColor}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabLightfallPrimaryColor: nextColor })}
                  label="Lightfall primary color"
                />
              </div>
              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={massageLabLightfallHarmony}
                  onChange={(event) => handleSettingsChange({
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

          <div className={styles.colorRow}>
            <span>Background</span>
            <ColorPickerInput
              value={massageLabLightfallBackgroundColor}
              onValueChange={(nextColor) => handleSettingsChange({ massageLabLightfallBackgroundColor: nextColor })}
              label="Lightfall background color"
            />
          </div>

          <label className={styles.rangeRow}>
            <span>Animation speed ({massageLabLightfallSpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0.05"
              max="2"
              step="0.05"
              value={massageLabLightfallSpeed}
              onChange={(event) => handleSettingsChange({ massageLabLightfallSpeed: Number(event.target.value) })}
              aria-label="Lightfall animation speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Streak count ({massageLabLightfallStreakCount.toFixed(0)})</span>
            <input
              type="range"
              min="1"
              max="16"
              step="1"
              value={massageLabLightfallStreakCount}
              onChange={(event) => handleSettingsChange({ massageLabLightfallStreakCount: Number(event.target.value) })}
              aria-label="Lightfall streak count"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Streak width ({massageLabLightfallStreakWidth.toFixed(1)})</span>
            <input
              type="range"
              min="0.2"
              max="3"
              step="0.1"
              value={massageLabLightfallStreakWidth}
              onChange={(event) => handleSettingsChange({ massageLabLightfallStreakWidth: Number(event.target.value) })}
              aria-label="Lightfall streak width"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Streak length ({massageLabLightfallStreakLength.toFixed(1)})</span>
            <input
              type="range"
              min="0.2"
              max="3"
              step="0.1"
              value={massageLabLightfallStreakLength}
              onChange={(event) => handleSettingsChange({ massageLabLightfallStreakLength: Number(event.target.value) })}
              aria-label="Lightfall streak length"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Glow ({massageLabLightfallGlow.toFixed(1)})</span>
            <input
              type="range"
              min="0.1"
              max="3"
              step="0.1"
              value={massageLabLightfallGlow}
              onChange={(event) => handleSettingsChange({ massageLabLightfallGlow: Number(event.target.value) })}
              aria-label="Lightfall glow"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Density ({massageLabLightfallDensity.toFixed(2)})</span>
            <input
              type="range"
              min="0.05"
              max="2"
              step="0.05"
              value={massageLabLightfallDensity}
              onChange={(event) => handleSettingsChange({ massageLabLightfallDensity: Number(event.target.value) })}
              aria-label="Lightfall density"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Twinkle ({Math.round(massageLabLightfallTwinkle * 100)}%)</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={massageLabLightfallTwinkle}
              onChange={(event) => handleSettingsChange({ massageLabLightfallTwinkle: Number(event.target.value) })}
              aria-label="Lightfall twinkle"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Zoom ({massageLabLightfallZoom.toFixed(1)})</span>
            <input
              type="range"
              min="1"
              max="6"
              step="0.1"
              value={massageLabLightfallZoom}
              onChange={(event) => handleSettingsChange({ massageLabLightfallZoom: Number(event.target.value) })}
              aria-label="Lightfall zoom"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Background glow ({massageLabLightfallBackgroundGlow.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1.5"
              step="0.05"
              value={massageLabLightfallBackgroundGlow}
              onChange={(event) => handleSettingsChange({ massageLabLightfallBackgroundGlow: Number(event.target.value) })}
              aria-label="Lightfall background glow"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Opacity ({Math.round(massageLabLightfallOpacity * 100)}%)</span>
            <input
              type="range"
              min="0.05"
              max="1"
              step="0.01"
              value={massageLabLightfallOpacity}
              onChange={(event) => handleSettingsChange({ massageLabLightfallOpacity: Number(event.target.value) })}
              aria-label="Lightfall opacity"
            />
          </label>

          <label className={styles.switchRow}>
            <span>Cursor glow</span>
            <input
              type="checkbox"
              checked={massageLabLightfallCursorEnabled}
              onChange={(event) => handleSettingsChange({ massageLabLightfallCursorEnabled: event.target.checked })}
              aria-label="Lightfall cursor glow"
            />
          </label>

          {massageLabLightfallCursorEnabled && (
            <>
              <label className={styles.rangeRow}>
                <span>Cursor strength ({massageLabLightfallCursorStrength.toFixed(2)})</span>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.05"
                  value={massageLabLightfallCursorStrength}
                  onChange={(event) => handleSettingsChange({
                    massageLabLightfallCursorStrength: Number(event.target.value),
                  })}
                  aria-label="Lightfall cursor strength"
                />
              </label>

              <label className={styles.rangeRow}>
                <span>Cursor radius ({massageLabLightfallCursorRadius.toFixed(2)})</span>
                <input
                  type="range"
                  min="0.05"
                  max="3"
                  step="0.05"
                  value={massageLabLightfallCursorRadius}
                  onChange={(event) => handleSettingsChange({
                    massageLabLightfallCursorRadius: Number(event.target.value),
                  })}
                  aria-label="Lightfall cursor radius"
                />
              </label>

              <label className={styles.rangeRow}>
                <span>Cursor smoothing ({massageLabLightfallCursorDampening.toFixed(2)})</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={massageLabLightfallCursorDampening}
                  onChange={(event) => handleSettingsChange({
                    massageLabLightfallCursorDampening: Number(event.target.value),
                  })}
                  aria-label="Lightfall cursor smoothing"
                />
              </label>
            </>
          )}
        </>
      )}

      {option.id === "massage-lab-liquid-ether" && (
        <>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={massageLabLiquidEtherPaletteMode}
              onChange={(event) => handleSettingsChange({
                massageLabLiquidEtherPaletteMode: event.target.value as MassageLabLiquidEtherPaletteMode,
              })}
              aria-label="Liquid Ether color mode"
            >
              <option value="custom">Custom colors</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {massageLabLiquidEtherPaletteMode === "custom" ? (
            <>
              <div className={styles.colorRow}>
                <span>Color 1</span>
                <ColorPickerInput
                  value={massageLabLiquidEtherColorOne}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabLiquidEtherColorOne: nextColor })}
                  label="Liquid Ether first color"
                />
              </div>
              <div className={styles.colorRow}>
                <span>Color 2</span>
                <ColorPickerInput
                  value={massageLabLiquidEtherColorTwo}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabLiquidEtherColorTwo: nextColor })}
                  label="Liquid Ether second color"
                />
              </div>
              <div className={styles.colorRow}>
                <span>Color 3</span>
                <ColorPickerInput
                  value={massageLabLiquidEtherColorThree}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabLiquidEtherColorThree: nextColor })}
                  label="Liquid Ether third color"
                />
              </div>
            </>
          ) : (
            <>
              <div className={styles.colorRow}>
                <span>Primary color</span>
                <ColorPickerInput
                  value={massageLabLiquidEtherPrimaryColor}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabLiquidEtherPrimaryColor: nextColor })}
                  label="Liquid Ether primary color"
                />
              </div>
              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={massageLabLiquidEtherHarmony}
                  onChange={(event) => handleSettingsChange({
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
              checked={massageLabLiquidEtherCursorEnabled}
              onChange={(event) => handleSettingsChange({ massageLabLiquidEtherCursorEnabled: event.target.checked })}
              aria-label="Liquid Ether cursor fluid push"
            />
          </label>

          {massageLabLiquidEtherCursorEnabled && (
            <>
              <label className={styles.rangeRow}>
                <span>Mouse force ({massageLabLiquidEtherMouseForce.toFixed(0)})</span>
                <input
                  type="range"
                  min="0"
                  max="80"
                  step="1"
                  value={massageLabLiquidEtherMouseForce}
                  onChange={(event) => handleSettingsChange({
                    massageLabLiquidEtherMouseForce: Number(event.target.value),
                  })}
                  aria-label="Liquid Ether mouse force"
                />
              </label>

              <label className={styles.rangeRow}>
                <span>Cursor size ({massageLabLiquidEtherCursorSize.toFixed(0)}px)</span>
                <input
                  type="range"
                  min="20"
                  max="280"
                  step="5"
                  value={massageLabLiquidEtherCursorSize}
                  onChange={(event) => handleSettingsChange({
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
              checked={massageLabLiquidEtherAutoDemo}
              onChange={(event) => handleSettingsChange({ massageLabLiquidEtherAutoDemo: event.target.checked })}
              aria-label="Liquid Ether auto demo motion"
            />
          </label>

          {massageLabLiquidEtherAutoDemo && (
            <>
              <label className={styles.rangeRow}>
                <span>Auto speed ({massageLabLiquidEtherAutoSpeed.toFixed(2)}x)</span>
                <input
                  type="range"
                  min="0.05"
                  max="2"
                  step="0.05"
                  value={massageLabLiquidEtherAutoSpeed}
                  onChange={(event) => handleSettingsChange({
                    massageLabLiquidEtherAutoSpeed: Number(event.target.value),
                  })}
                  aria-label="Liquid Ether auto speed"
                />
              </label>

              <label className={styles.rangeRow}>
                <span>Auto intensity ({massageLabLiquidEtherAutoIntensity.toFixed(1)})</span>
                <input
                  type="range"
                  min="0"
                  max="5"
                  step="0.1"
                  value={massageLabLiquidEtherAutoIntensity}
                  onChange={(event) => handleSettingsChange({
                    massageLabLiquidEtherAutoIntensity: Number(event.target.value),
                  })}
                  aria-label="Liquid Ether auto intensity"
                />
              </label>

              <label className={styles.rangeRow}>
                <span>Auto resume ({(massageLabLiquidEtherAutoResumeDelay / 1000).toFixed(1)}s)</span>
                <input
                  type="range"
                  min="250"
                  max="5000"
                  step="250"
                  value={massageLabLiquidEtherAutoResumeDelay}
                  onChange={(event) => handleSettingsChange({
                    massageLabLiquidEtherAutoResumeDelay: Number(event.target.value),
                  })}
                  aria-label="Liquid Ether auto resume delay"
                />
              </label>

              <label className={styles.rangeRow}>
                <span>Auto ramp ({massageLabLiquidEtherAutoRampDuration.toFixed(1)}s)</span>
                <input
                  type="range"
                  min="0"
                  max="3"
                  step="0.1"
                  value={massageLabLiquidEtherAutoRampDuration}
                  onChange={(event) => handleSettingsChange({
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
              checked={massageLabLiquidEtherIsViscous}
              onChange={(event) => handleSettingsChange({ massageLabLiquidEtherIsViscous: event.target.checked })}
              aria-label="Liquid Ether viscous fluid"
            />
          </label>

          {massageLabLiquidEtherIsViscous && (
            <label className={styles.rangeRow}>
              <span>Viscosity ({massageLabLiquidEtherViscous.toFixed(0)})</span>
              <input
                type="range"
                min="0"
                max="80"
                step="1"
                value={massageLabLiquidEtherViscous}
                onChange={(event) => handleSettingsChange({ massageLabLiquidEtherViscous: Number(event.target.value) })}
                aria-label="Liquid Ether viscosity"
              />
            </label>
          )}

          <label className={styles.rangeRow}>
            <span>Viscous iterations ({massageLabLiquidEtherIterationsViscous.toFixed(0)})</span>
            <input
              type="range"
              min="4"
              max="64"
              step="1"
              value={massageLabLiquidEtherIterationsViscous}
              onChange={(event) => handleSettingsChange({
                massageLabLiquidEtherIterationsViscous: Number(event.target.value),
              })}
              aria-label="Liquid Ether viscous iterations"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Poisson iterations ({massageLabLiquidEtherIterationsPoisson.toFixed(0)})</span>
            <input
              type="range"
              min="4"
              max="64"
              step="1"
              value={massageLabLiquidEtherIterationsPoisson}
              onChange={(event) => handleSettingsChange({
                massageLabLiquidEtherIterationsPoisson: Number(event.target.value),
              })}
              aria-label="Liquid Ether Poisson iterations"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Delta time ({massageLabLiquidEtherDt.toFixed(3)})</span>
            <input
              type="range"
              min="0.004"
              max="0.04"
              step="0.001"
              value={massageLabLiquidEtherDt}
              onChange={(event) => handleSettingsChange({ massageLabLiquidEtherDt: Number(event.target.value) })}
              aria-label="Liquid Ether delta time"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Resolution ({massageLabLiquidEtherResolution.toFixed(2)})</span>
            <input
              type="range"
              min="0.2"
              max="1"
              step="0.05"
              value={massageLabLiquidEtherResolution}
              onChange={(event) => handleSettingsChange({ massageLabLiquidEtherResolution: Number(event.target.value) })}
              aria-label="Liquid Ether resolution"
            />
          </label>

          <label className={styles.switchRow}>
            <span>BFECC advection</span>
            <input
              type="checkbox"
              checked={massageLabLiquidEtherBfecc}
              onChange={(event) => handleSettingsChange({ massageLabLiquidEtherBfecc: event.target.checked })}
              aria-label="Liquid Ether BFECC advection"
            />
          </label>

          <label className={styles.switchRow}>
            <span>Bounce edges</span>
            <input
              type="checkbox"
              checked={massageLabLiquidEtherIsBounce}
              onChange={(event) => handleSettingsChange({ massageLabLiquidEtherIsBounce: event.target.checked })}
              aria-label="Liquid Ether bounce edges"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Opacity ({Math.round(massageLabLiquidEtherOpacity * 100)}%)</span>
            <input
              type="range"
              min="0.05"
              max="1"
              step="0.01"
              value={massageLabLiquidEtherOpacity}
              onChange={(event) => handleSettingsChange({ massageLabLiquidEtherOpacity: Number(event.target.value) })}
              aria-label="Liquid Ether opacity"
            />
          </label>
        </>
      )}

      {option.id === "massage-lab-prism" && (
        <>
          <label className={styles.selectRow}>
            <span>Rotation mode</span>
            <select
              value={massageLabPrismAnimationType}
              onChange={(event) => handleSettingsChange({
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
            <span>Height ({massageLabPrismHeight.toFixed(1)})</span>
            <input
              type="range"
              min="0.5"
              max="8"
              step="0.1"
              value={massageLabPrismHeight}
              onChange={(event) => handleSettingsChange({ massageLabPrismHeight: Number(event.target.value) })}
              aria-label="Prism height"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Base width ({massageLabPrismBaseWidth.toFixed(1)})</span>
            <input
              type="range"
              min="0.5"
              max="10"
              step="0.1"
              value={massageLabPrismBaseWidth}
              onChange={(event) => handleSettingsChange({ massageLabPrismBaseWidth: Number(event.target.value) })}
              aria-label="Prism base width"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Glow ({massageLabPrismGlow.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={massageLabPrismGlow}
              onChange={(event) => handleSettingsChange({ massageLabPrismGlow: Number(event.target.value) })}
              aria-label="Prism glow"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Bloom ({massageLabPrismBloom.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={massageLabPrismBloom}
              onChange={(event) => handleSettingsChange({ massageLabPrismBloom: Number(event.target.value) })}
              aria-label="Prism bloom"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Noise ({massageLabPrismNoise.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.02"
              value={massageLabPrismNoise}
              onChange={(event) => handleSettingsChange({ massageLabPrismNoise: Number(event.target.value) })}
              aria-label="Prism noise"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Scale ({massageLabPrismScale.toFixed(1)})</span>
            <input
              type="range"
              min="0.5"
              max="7"
              step="0.1"
              value={massageLabPrismScale}
              onChange={(event) => handleSettingsChange({ massageLabPrismScale: Number(event.target.value) })}
              aria-label="Prism scale"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Hue shift ({massageLabPrismHueShift.toFixed(2)})</span>
            <input
              type="range"
              min="-3.1416"
              max="3.1416"
              step="0.05"
              value={massageLabPrismHueShift}
              onChange={(event) => handleSettingsChange({ massageLabPrismHueShift: Number(event.target.value) })}
              aria-label="Prism hue shift"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Color frequency ({massageLabPrismColorFrequency.toFixed(2)})</span>
            <input
              type="range"
              min="0.1"
              max="3"
              step="0.05"
              value={massageLabPrismColorFrequency}
              onChange={(event) => handleSettingsChange({ massageLabPrismColorFrequency: Number(event.target.value) })}
              aria-label="Prism color frequency"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Time scale ({massageLabPrismTimeScale.toFixed(2)}x)</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.05"
              value={massageLabPrismTimeScale}
              onChange={(event) => handleSettingsChange({ massageLabPrismTimeScale: Number(event.target.value) })}
              aria-label="Prism time scale"
            />
          </label>

          {massageLabPrismAnimationType === "hover" && (
            <>
              <label className={styles.rangeRow}>
                <span>Hover strength ({massageLabPrismHoverStrength.toFixed(1)})</span>
                <input
                  type="range"
                  min="0"
                  max="4"
                  step="0.1"
                  value={massageLabPrismHoverStrength}
                  onChange={(event) => handleSettingsChange({ massageLabPrismHoverStrength: Number(event.target.value) })}
                  aria-label="Prism hover strength"
                />
              </label>

              <label className={styles.rangeRow}>
                <span>Hover inertia ({massageLabPrismInertia.toFixed(2)})</span>
                <input
                  type="range"
                  min="0.01"
                  max="0.4"
                  step="0.01"
                  value={massageLabPrismInertia}
                  onChange={(event) => handleSettingsChange({ massageLabPrismInertia: Number(event.target.value) })}
                  aria-label="Prism hover inertia"
                />
              </label>
            </>
          )}

          <label className={styles.rangeRow}>
            <span>Offset X ({massageLabPrismOffsetX.toFixed(0)}px)</span>
            <input
              type="range"
              min="-400"
              max="400"
              step="10"
              value={massageLabPrismOffsetX}
              onChange={(event) => handleSettingsChange({ massageLabPrismOffsetX: Number(event.target.value) })}
              aria-label="Prism horizontal offset"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Offset Y ({massageLabPrismOffsetY.toFixed(0)}px)</span>
            <input
              type="range"
              min="-400"
              max="400"
              step="10"
              value={massageLabPrismOffsetY}
              onChange={(event) => handleSettingsChange({ massageLabPrismOffsetY: Number(event.target.value) })}
              aria-label="Prism vertical offset"
            />
          </label>

          <label className={styles.switchRow}>
            <span>Transparent blend</span>
            <input
              type="checkbox"
              checked={massageLabPrismTransparent}
              onChange={(event) => handleSettingsChange({ massageLabPrismTransparent: event.target.checked })}
              aria-label="Prism transparent blend"
            />
          </label>
        </>
      )}

      {option.id === "massage-lab-dark-veil" && (
        <>
          <label className={styles.rangeRow}>
            <span>Hue shift ({massageLabDarkVeilHueShift.toFixed(0)} deg)</span>
            <input
              type="range"
              min="-180"
              max="180"
              step="1"
              value={massageLabDarkVeilHueShift}
              onChange={(event) => handleSettingsChange({ massageLabDarkVeilHueShift: Number(event.target.value) })}
              aria-label="Dark Veil hue shift"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Animation speed ({massageLabDarkVeilSpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.05"
              value={massageLabDarkVeilSpeed}
              onChange={(event) => handleSettingsChange({ massageLabDarkVeilSpeed: Number(event.target.value) })}
              aria-label="Dark Veil animation speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Noise ({massageLabDarkVeilNoiseIntensity.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={massageLabDarkVeilNoiseIntensity}
              onChange={(event) => handleSettingsChange({
                massageLabDarkVeilNoiseIntensity: Number(event.target.value),
              })}
              aria-label="Dark Veil noise intensity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Scanline intensity ({massageLabDarkVeilScanlineIntensity.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={massageLabDarkVeilScanlineIntensity}
              onChange={(event) => handleSettingsChange({
                massageLabDarkVeilScanlineIntensity: Number(event.target.value),
              })}
              aria-label="Dark Veil scanline intensity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Scanline frequency ({massageLabDarkVeilScanlineFrequency.toFixed(1)})</span>
            <input
              type="range"
              min="0"
              max="40"
              step="0.5"
              value={massageLabDarkVeilScanlineFrequency}
              onChange={(event) => handleSettingsChange({
                massageLabDarkVeilScanlineFrequency: Number(event.target.value),
              })}
              aria-label="Dark Veil scanline frequency"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Warp ({massageLabDarkVeilWarpAmount.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.01"
              value={massageLabDarkVeilWarpAmount}
              onChange={(event) => handleSettingsChange({ massageLabDarkVeilWarpAmount: Number(event.target.value) })}
              aria-label="Dark Veil warp amount"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Resolution scale ({massageLabDarkVeilResolutionScale.toFixed(2)})</span>
            <input
              type="range"
              min="0.25"
              max="1"
              step="0.05"
              value={massageLabDarkVeilResolutionScale}
              onChange={(event) => handleSettingsChange({
                massageLabDarkVeilResolutionScale: Number(event.target.value),
              })}
              aria-label="Dark Veil resolution scale"
            />
          </label>
        </>
      )}

      {option.id === "massage-lab-light-pillar" && (
        <>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={massageLabLightPillarPaletteMode}
              onChange={(event) => handleSettingsChange({
                massageLabLightPillarPaletteMode: event.target.value as MassageLabLightPillarPaletteMode,
              })}
              aria-label="Light Pillar color mode"
            >
              <option value="custom">Custom colors</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {massageLabLightPillarPaletteMode === "custom" ? (
            <>
              <div className={styles.colorRow}>
                <span>Top color</span>
                <ColorPickerInput
                  value={massageLabLightPillarTopColor}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabLightPillarTopColor: nextColor })}
                  label="Light Pillar top color"
                />
              </div>
              <div className={styles.colorRow}>
                <span>Bottom color</span>
                <ColorPickerInput
                  value={massageLabLightPillarBottomColor}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabLightPillarBottomColor: nextColor })}
                  label="Light Pillar bottom color"
                />
              </div>
            </>
          ) : (
            <>
              <div className={styles.colorRow}>
                <span>Primary color</span>
                <ColorPickerInput
                  value={massageLabLightPillarPrimaryColor}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabLightPillarPrimaryColor: nextColor })}
                  label="Light Pillar primary color"
                />
              </div>
              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={massageLabLightPillarHarmony}
                  onChange={(event) => handleSettingsChange({
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
              value={massageLabLightPillarQuality}
              onChange={(event) => handleSettingsChange({
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
              value={massageLabLightPillarBlendMode}
              onChange={(event) => handleSettingsChange({
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
            <span>Intensity ({massageLabLightPillarIntensity.toFixed(2)})</span>
            <input
              type="range"
              min="0.1"
              max="3"
              step="0.05"
              value={massageLabLightPillarIntensity}
              onChange={(event) => handleSettingsChange({ massageLabLightPillarIntensity: Number(event.target.value) })}
              aria-label="Light Pillar intensity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Rotation speed ({massageLabLightPillarRotationSpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.05"
              value={massageLabLightPillarRotationSpeed}
              onChange={(event) => handleSettingsChange({
                massageLabLightPillarRotationSpeed: Number(event.target.value),
              })}
              aria-label="Light Pillar rotation speed"
            />
          </label>

          <label className={styles.switchRow}>
            <span>Cursor rotation</span>
            <input
              type="checkbox"
              checked={massageLabLightPillarInteractive}
              onChange={(event) => handleSettingsChange({ massageLabLightPillarInteractive: event.target.checked })}
              aria-label="Light Pillar cursor rotation"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Glow amount ({massageLabLightPillarGlowAmount.toFixed(3)})</span>
            <input
              type="range"
              min="0.001"
              max="0.03"
              step="0.001"
              value={massageLabLightPillarGlowAmount}
              onChange={(event) => handleSettingsChange({ massageLabLightPillarGlowAmount: Number(event.target.value) })}
              aria-label="Light Pillar glow amount"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Pillar width ({massageLabLightPillarWidth.toFixed(1)})</span>
            <input
              type="range"
              min="0.5"
              max="8"
              step="0.1"
              value={massageLabLightPillarWidth}
              onChange={(event) => handleSettingsChange({ massageLabLightPillarWidth: Number(event.target.value) })}
              aria-label="Light Pillar width"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Pillar height ({massageLabLightPillarHeight.toFixed(2)})</span>
            <input
              type="range"
              min="0.1"
              max="2"
              step="0.05"
              value={massageLabLightPillarHeight}
              onChange={(event) => handleSettingsChange({ massageLabLightPillarHeight: Number(event.target.value) })}
              aria-label="Light Pillar height"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Noise ({massageLabLightPillarNoiseIntensity.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={massageLabLightPillarNoiseIntensity}
              onChange={(event) => handleSettingsChange({
                massageLabLightPillarNoiseIntensity: Number(event.target.value),
              })}
              aria-label="Light Pillar noise intensity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Pillar rotation ({massageLabLightPillarRotation.toFixed(0)} deg)</span>
            <input
              type="range"
              min="-180"
              max="180"
              step="1"
              value={massageLabLightPillarRotation}
              onChange={(event) => handleSettingsChange({ massageLabLightPillarRotation: Number(event.target.value) })}
              aria-label="Light Pillar rotation"
            />
          </label>
        </>
      )}

      {option.id === "massage-lab-silk" && (
        <>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={massageLabSilkPaletteMode}
              onChange={(event) => handleSettingsChange({
                massageLabSilkPaletteMode: event.target.value as MassageLabSilkPaletteMode,
              })}
              aria-label="Silk color mode"
            >
              <option value="custom">Custom color</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {massageLabSilkPaletteMode === "custom" ? (
            <div className={styles.colorRow}>
              <span>Silk color</span>
              <ColorPickerInput
                value={massageLabSilkColor}
                onValueChange={(nextColor) => handleSettingsChange({ massageLabSilkColor: nextColor })}
                label="Silk color"
              />
            </div>
          ) : (
            <>
              <div className={styles.colorRow}>
                <span>Primary color</span>
                <ColorPickerInput
                  value={massageLabSilkPrimaryColor}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabSilkPrimaryColor: nextColor })}
                  label="Silk primary color"
                />
              </div>
              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={massageLabSilkHarmony}
                  onChange={(event) => handleSettingsChange({
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
            <span>Speed ({massageLabSilkSpeed.toFixed(1)}x)</span>
            <input
              type="range"
              min="0"
              max="10"
              step="0.1"
              value={massageLabSilkSpeed}
              onChange={(event) => handleSettingsChange({ massageLabSilkSpeed: Number(event.target.value) })}
              aria-label="Silk speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Scale ({massageLabSilkScale.toFixed(2)})</span>
            <input
              type="range"
              min="0.2"
              max="4"
              step="0.05"
              value={massageLabSilkScale}
              onChange={(event) => handleSettingsChange({ massageLabSilkScale: Number(event.target.value) })}
              aria-label="Silk scale"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Noise ({massageLabSilkNoiseIntensity.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="4"
              step="0.05"
              value={massageLabSilkNoiseIntensity}
              onChange={(event) => handleSettingsChange({ massageLabSilkNoiseIntensity: Number(event.target.value) })}
              aria-label="Silk noise intensity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Rotation ({massageLabSilkRotation.toFixed(2)} rad)</span>
            <input
              type="range"
              min="-3.1416"
              max="3.1416"
              step="0.05"
              value={massageLabSilkRotation}
              onChange={(event) => handleSettingsChange({ massageLabSilkRotation: Number(event.target.value) })}
              aria-label="Silk rotation"
            />
          </label>
        </>
      )}

      {option.id === "massage-lab-floating-lines" && (
        <>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={massageLabFloatingLinesPaletteMode}
              onChange={(event) => handleSettingsChange({
                massageLabFloatingLinesPaletteMode: event.target.value as MassageLabFloatingLinesPaletteMode,
              })}
              aria-label="Floating Lines color mode"
            >
              <option value="source">Source blue/pink</option>
              <option value="custom">Custom gradient</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {massageLabFloatingLinesPaletteMode === "custom" ? (
            <>
              <div className={styles.colorRow}>
                <span>Gradient 1</span>
                <ColorPickerInput
                  value={massageLabFloatingLinesColorOne}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabFloatingLinesColorOne: nextColor })}
                  label="Floating Lines gradient color 1"
                />
              </div>
              <div className={styles.colorRow}>
                <span>Gradient 2</span>
                <ColorPickerInput
                  value={massageLabFloatingLinesColorTwo}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabFloatingLinesColorTwo: nextColor })}
                  label="Floating Lines gradient color 2"
                />
              </div>
              <div className={styles.colorRow}>
                <span>Gradient 3</span>
                <ColorPickerInput
                  value={massageLabFloatingLinesColorThree}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabFloatingLinesColorThree: nextColor })}
                  label="Floating Lines gradient color 3"
                />
              </div>
            </>
          ) : null}

          {massageLabFloatingLinesPaletteMode === "harmony" ? (
            <>
              <div className={styles.colorRow}>
                <span>Primary color</span>
                <ColorPickerInput
                  value={massageLabFloatingLinesPrimaryColor}
                  onValueChange={(nextColor) => handleSettingsChange({
                    massageLabFloatingLinesPrimaryColor: nextColor,
                  })}
                  label="Floating Lines primary color"
                />
              </div>
              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={massageLabFloatingLinesHarmony}
                  onChange={(event) => handleSettingsChange({
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
          ) : null}

          <label className={styles.selectRow}>
            <span>Blend mode</span>
            <select
              value={massageLabFloatingLinesBlendMode}
              onChange={(event) => handleSettingsChange({
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
            <span>Animation speed ({massageLabFloatingLinesAnimationSpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0"
              max="4"
              step="0.05"
              value={massageLabFloatingLinesAnimationSpeed}
              onChange={(event) => handleSettingsChange({
                massageLabFloatingLinesAnimationSpeed: Number(event.target.value),
              })}
              aria-label="Floating Lines animation speed"
            />
          </label>

          <label className={styles.switchRow}>
            <span>Top wave</span>
            <input
              type="checkbox"
              checked={massageLabFloatingLinesEnableTop}
              onChange={(event) => handleSettingsChange({ massageLabFloatingLinesEnableTop: event.target.checked })}
              aria-label="Floating Lines top wave"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Top count ({massageLabFloatingLinesTopLineCount})</span>
            <input
              type="range"
              min="0"
              max="32"
              step="1"
              value={massageLabFloatingLinesTopLineCount}
              onChange={(event) => handleSettingsChange({ massageLabFloatingLinesTopLineCount: Number(event.target.value) })}
              aria-label="Floating Lines top line count"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Top spacing ({massageLabFloatingLinesTopLineDistance.toFixed(1)})</span>
            <input
              type="range"
              min="0.1"
              max="20"
              step="0.1"
              value={massageLabFloatingLinesTopLineDistance}
              onChange={(event) => handleSettingsChange({
                massageLabFloatingLinesTopLineDistance: Number(event.target.value),
              })}
              aria-label="Floating Lines top line spacing"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Top X ({massageLabFloatingLinesTopWaveX.toFixed(1)})</span>
            <input
              type="range"
              min="-20"
              max="20"
              step="0.1"
              value={massageLabFloatingLinesTopWaveX}
              onChange={(event) => handleSettingsChange({ massageLabFloatingLinesTopWaveX: Number(event.target.value) })}
              aria-label="Floating Lines top wave X"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Top Y ({massageLabFloatingLinesTopWaveY.toFixed(1)})</span>
            <input
              type="range"
              min="-4"
              max="4"
              step="0.1"
              value={massageLabFloatingLinesTopWaveY}
              onChange={(event) => handleSettingsChange({ massageLabFloatingLinesTopWaveY: Number(event.target.value) })}
              aria-label="Floating Lines top wave Y"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Top rotation ({massageLabFloatingLinesTopWaveRotate.toFixed(2)})</span>
            <input
              type="range"
              min="-4"
              max="4"
              step="0.05"
              value={massageLabFloatingLinesTopWaveRotate}
              onChange={(event) => handleSettingsChange({
                massageLabFloatingLinesTopWaveRotate: Number(event.target.value),
              })}
              aria-label="Floating Lines top wave rotation"
            />
          </label>

          <label className={styles.switchRow}>
            <span>Middle wave</span>
            <input
              type="checkbox"
              checked={massageLabFloatingLinesEnableMiddle}
              onChange={(event) => handleSettingsChange({ massageLabFloatingLinesEnableMiddle: event.target.checked })}
              aria-label="Floating Lines middle wave"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Middle count ({massageLabFloatingLinesMiddleLineCount})</span>
            <input
              type="range"
              min="0"
              max="32"
              step="1"
              value={massageLabFloatingLinesMiddleLineCount}
              onChange={(event) => handleSettingsChange({
                massageLabFloatingLinesMiddleLineCount: Number(event.target.value),
              })}
              aria-label="Floating Lines middle line count"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Middle spacing ({massageLabFloatingLinesMiddleLineDistance.toFixed(1)})</span>
            <input
              type="range"
              min="0.1"
              max="20"
              step="0.1"
              value={massageLabFloatingLinesMiddleLineDistance}
              onChange={(event) => handleSettingsChange({
                massageLabFloatingLinesMiddleLineDistance: Number(event.target.value),
              })}
              aria-label="Floating Lines middle line spacing"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Middle X ({massageLabFloatingLinesMiddleWaveX.toFixed(1)})</span>
            <input
              type="range"
              min="-20"
              max="20"
              step="0.1"
              value={massageLabFloatingLinesMiddleWaveX}
              onChange={(event) => handleSettingsChange({
                massageLabFloatingLinesMiddleWaveX: Number(event.target.value),
              })}
              aria-label="Floating Lines middle wave X"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Middle Y ({massageLabFloatingLinesMiddleWaveY.toFixed(1)})</span>
            <input
              type="range"
              min="-4"
              max="4"
              step="0.1"
              value={massageLabFloatingLinesMiddleWaveY}
              onChange={(event) => handleSettingsChange({
                massageLabFloatingLinesMiddleWaveY: Number(event.target.value),
              })}
              aria-label="Floating Lines middle wave Y"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Middle rotation ({massageLabFloatingLinesMiddleWaveRotate.toFixed(2)})</span>
            <input
              type="range"
              min="-4"
              max="4"
              step="0.05"
              value={massageLabFloatingLinesMiddleWaveRotate}
              onChange={(event) => handleSettingsChange({
                massageLabFloatingLinesMiddleWaveRotate: Number(event.target.value),
              })}
              aria-label="Floating Lines middle wave rotation"
            />
          </label>

          <label className={styles.switchRow}>
            <span>Bottom wave</span>
            <input
              type="checkbox"
              checked={massageLabFloatingLinesEnableBottom}
              onChange={(event) => handleSettingsChange({ massageLabFloatingLinesEnableBottom: event.target.checked })}
              aria-label="Floating Lines bottom wave"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Bottom count ({massageLabFloatingLinesBottomLineCount})</span>
            <input
              type="range"
              min="0"
              max="32"
              step="1"
              value={massageLabFloatingLinesBottomLineCount}
              onChange={(event) => handleSettingsChange({
                massageLabFloatingLinesBottomLineCount: Number(event.target.value),
              })}
              aria-label="Floating Lines bottom line count"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Bottom spacing ({massageLabFloatingLinesBottomLineDistance.toFixed(1)})</span>
            <input
              type="range"
              min="0.1"
              max="20"
              step="0.1"
              value={massageLabFloatingLinesBottomLineDistance}
              onChange={(event) => handleSettingsChange({
                massageLabFloatingLinesBottomLineDistance: Number(event.target.value),
              })}
              aria-label="Floating Lines bottom line spacing"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Bottom X ({massageLabFloatingLinesBottomWaveX.toFixed(1)})</span>
            <input
              type="range"
              min="-20"
              max="20"
              step="0.1"
              value={massageLabFloatingLinesBottomWaveX}
              onChange={(event) => handleSettingsChange({
                massageLabFloatingLinesBottomWaveX: Number(event.target.value),
              })}
              aria-label="Floating Lines bottom wave X"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Bottom Y ({massageLabFloatingLinesBottomWaveY.toFixed(1)})</span>
            <input
              type="range"
              min="-4"
              max="4"
              step="0.1"
              value={massageLabFloatingLinesBottomWaveY}
              onChange={(event) => handleSettingsChange({
                massageLabFloatingLinesBottomWaveY: Number(event.target.value),
              })}
              aria-label="Floating Lines bottom wave Y"
            />
          </label>
          <label className={styles.rangeRow}>
            <span>Bottom rotation ({massageLabFloatingLinesBottomWaveRotate.toFixed(2)})</span>
            <input
              type="range"
              min="-4"
              max="4"
              step="0.05"
              value={massageLabFloatingLinesBottomWaveRotate}
              onChange={(event) => handleSettingsChange({
                massageLabFloatingLinesBottomWaveRotate: Number(event.target.value),
              })}
              aria-label="Floating Lines bottom wave rotation"
            />
          </label>

          <label className={styles.switchRow}>
            <span>Cursor bend</span>
            <input
              type="checkbox"
              checked={massageLabFloatingLinesInteractive}
              onChange={(event) => handleSettingsChange({
                massageLabFloatingLinesInteractive: event.target.checked,
              })}
              aria-label="Floating Lines cursor bend"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Bend radius ({massageLabFloatingLinesBendRadius.toFixed(1)})</span>
            <input
              type="range"
              min="0.1"
              max="20"
              step="0.1"
              value={massageLabFloatingLinesBendRadius}
              onChange={(event) => handleSettingsChange({
                massageLabFloatingLinesBendRadius: Number(event.target.value),
              })}
              aria-label="Floating Lines bend radius"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Bend strength ({massageLabFloatingLinesBendStrength.toFixed(2)})</span>
            <input
              type="range"
              min="-2"
              max="2"
              step="0.05"
              value={massageLabFloatingLinesBendStrength}
              onChange={(event) => handleSettingsChange({
                massageLabFloatingLinesBendStrength: Number(event.target.value),
              })}
              aria-label="Floating Lines bend strength"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Mouse damping ({massageLabFloatingLinesMouseDamping.toFixed(2)})</span>
            <input
              type="range"
              min="0.01"
              max="1"
              step="0.01"
              value={massageLabFloatingLinesMouseDamping}
              onChange={(event) => handleSettingsChange({
                massageLabFloatingLinesMouseDamping: Number(event.target.value),
              })}
              aria-label="Floating Lines mouse damping"
            />
          </label>

          <label className={styles.switchRow}>
            <span>Parallax</span>
            <input
              type="checkbox"
              checked={massageLabFloatingLinesParallax}
              onChange={(event) => handleSettingsChange({ massageLabFloatingLinesParallax: event.target.checked })}
              aria-label="Floating Lines parallax"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Parallax strength ({massageLabFloatingLinesParallaxStrength.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={massageLabFloatingLinesParallaxStrength}
              onChange={(event) => handleSettingsChange({
                massageLabFloatingLinesParallaxStrength: Number(event.target.value),
              })}
              aria-label="Floating Lines parallax strength"
            />
          </label>
        </>
      )}

      {option.id === "massage-lab-side-rays" && (
        <>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={massageLabSideRaysPaletteMode}
              onChange={(event) => handleSettingsChange({
                massageLabSideRaysPaletteMode: event.target.value as MassageLabSideRaysPaletteMode,
              })}
              aria-label="Side Rays color mode"
            >
              <option value="source">Source yellow/blue</option>
              <option value="custom">Custom rays</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {massageLabSideRaysPaletteMode === "custom" ? (
            <>
              <div className={styles.colorRow}>
                <span>Ray color 1</span>
                <ColorPickerInput
                  value={massageLabSideRaysColorOne}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabSideRaysColorOne: nextColor })}
                  label="Side Rays color 1"
                />
              </div>
              <div className={styles.colorRow}>
                <span>Ray color 2</span>
                <ColorPickerInput
                  value={massageLabSideRaysColorTwo}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabSideRaysColorTwo: nextColor })}
                  label="Side Rays color 2"
                />
              </div>
            </>
          ) : null}

          {massageLabSideRaysPaletteMode === "harmony" ? (
            <>
              <div className={styles.colorRow}>
                <span>Primary color</span>
                <ColorPickerInput
                  value={massageLabSideRaysPrimaryColor}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabSideRaysPrimaryColor: nextColor })}
                  label="Side Rays primary color"
                />
              </div>
              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={massageLabSideRaysHarmony}
                  onChange={(event) => handleSettingsChange({
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
          ) : null}

          <label className={styles.selectRow}>
            <span>Origin</span>
            <select
              value={massageLabSideRaysOrigin}
              onChange={(event) => handleSettingsChange({
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
            <span>Speed ({massageLabSideRaysSpeed.toFixed(1)}x)</span>
            <input
              type="range"
              min="0"
              max="8"
              step="0.1"
              value={massageLabSideRaysSpeed}
              onChange={(event) => handleSettingsChange({ massageLabSideRaysSpeed: Number(event.target.value) })}
              aria-label="Side Rays speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Intensity ({massageLabSideRaysIntensity.toFixed(1)})</span>
            <input
              type="range"
              min="0"
              max="6"
              step="0.1"
              value={massageLabSideRaysIntensity}
              onChange={(event) => handleSettingsChange({ massageLabSideRaysIntensity: Number(event.target.value) })}
              aria-label="Side Rays intensity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Spread ({massageLabSideRaysSpread.toFixed(1)})</span>
            <input
              type="range"
              min="0.1"
              max="5"
              step="0.1"
              value={massageLabSideRaysSpread}
              onChange={(event) => handleSettingsChange({ massageLabSideRaysSpread: Number(event.target.value) })}
              aria-label="Side Rays spread"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Tilt ({massageLabSideRaysTilt.toFixed(0)} deg)</span>
            <input
              type="range"
              min="-90"
              max="90"
              step="1"
              value={massageLabSideRaysTilt}
              onChange={(event) => handleSettingsChange({ massageLabSideRaysTilt: Number(event.target.value) })}
              aria-label="Side Rays tilt"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Saturation ({massageLabSideRaysSaturation.toFixed(1)})</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.1"
              value={massageLabSideRaysSaturation}
              onChange={(event) => handleSettingsChange({ massageLabSideRaysSaturation: Number(event.target.value) })}
              aria-label="Side Rays saturation"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Blend ({massageLabSideRaysBlend.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={massageLabSideRaysBlend}
              onChange={(event) => handleSettingsChange({ massageLabSideRaysBlend: Number(event.target.value) })}
              aria-label="Side Rays blend"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Falloff ({massageLabSideRaysFalloff.toFixed(1)})</span>
            <input
              type="range"
              min="0.2"
              max="4"
              step="0.1"
              value={massageLabSideRaysFalloff}
              onChange={(event) => handleSettingsChange({ massageLabSideRaysFalloff: Number(event.target.value) })}
              aria-label="Side Rays falloff"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Opacity ({Math.round(massageLabSideRaysOpacity * 100)}%)</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={massageLabSideRaysOpacity}
              onChange={(event) => handleSettingsChange({ massageLabSideRaysOpacity: Number(event.target.value) })}
              aria-label="Side Rays opacity"
            />
          </label>
        </>
      )}

      {option.id === "massage-lab-light-rays" && (
        <>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={massageLabLightRaysPaletteMode}
              onChange={(event) => handleSettingsChange({
                massageLabLightRaysPaletteMode: event.target.value as MassageLabLightRaysPaletteMode,
              })}
              aria-label="Light Rays color mode"
            >
              <option value="source">Source white</option>
              <option value="custom">Custom ray</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {massageLabLightRaysPaletteMode === "custom" ? (
            <div className={styles.colorRow}>
              <span>Ray color</span>
              <ColorPickerInput
                value={massageLabLightRaysColor}
                onValueChange={(nextColor) => handleSettingsChange({ massageLabLightRaysColor: nextColor })}
                label="Light Rays color"
              />
            </div>
          ) : null}

          {massageLabLightRaysPaletteMode === "harmony" ? (
            <>
              <div className={styles.colorRow}>
                <span>Primary color</span>
                <ColorPickerInput
                  value={massageLabLightRaysPrimaryColor}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabLightRaysPrimaryColor: nextColor })}
                  label="Light Rays primary color"
                />
              </div>
              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={massageLabLightRaysHarmony}
                  onChange={(event) => handleSettingsChange({
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
          ) : null}

          <label className={styles.selectRow}>
            <span>Origin</span>
            <select
              value={massageLabLightRaysOrigin}
              onChange={(event) => handleSettingsChange({
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
              checked={massageLabLightRaysPulsating}
              onChange={(event) => handleSettingsChange({ massageLabLightRaysPulsating: event.target.checked })}
              aria-label="Light Rays pulsating"
            />
            <span>Pulsating rays</span>
          </label>

          <label className={styles.selectRow}>
            <input
              type="checkbox"
              checked={massageLabLightRaysFollowMouse}
              onChange={(event) => handleSettingsChange({ massageLabLightRaysFollowMouse: event.target.checked })}
              aria-label="Light Rays follow mouse"
            />
            <span>Follow cursor</span>
          </label>

          <label className={styles.rangeRow}>
            <span>Speed ({massageLabLightRaysSpeed.toFixed(1)}x)</span>
            <input
              type="range"
              min="0"
              max="4"
              step="0.1"
              value={massageLabLightRaysSpeed}
              onChange={(event) => handleSettingsChange({ massageLabLightRaysSpeed: Number(event.target.value) })}
              aria-label="Light Rays speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Spread ({massageLabLightRaysSpread.toFixed(1)})</span>
            <input
              type="range"
              min="0.1"
              max="4"
              step="0.1"
              value={massageLabLightRaysSpread}
              onChange={(event) => handleSettingsChange({ massageLabLightRaysSpread: Number(event.target.value) })}
              aria-label="Light Rays spread"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Length ({massageLabLightRaysLength.toFixed(1)})</span>
            <input
              type="range"
              min="0.25"
              max="5"
              step="0.05"
              value={massageLabLightRaysLength}
              onChange={(event) => handleSettingsChange({ massageLabLightRaysLength: Number(event.target.value) })}
              aria-label="Light Rays length"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Fade distance ({massageLabLightRaysFadeDistance.toFixed(1)})</span>
            <input
              type="range"
              min="0.1"
              max="3"
              step="0.1"
              value={massageLabLightRaysFadeDistance}
              onChange={(event) => handleSettingsChange({ massageLabLightRaysFadeDistance: Number(event.target.value) })}
              aria-label="Light Rays fade distance"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Saturation ({massageLabLightRaysSaturation.toFixed(1)})</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.1"
              value={massageLabLightRaysSaturation}
              onChange={(event) => handleSettingsChange({ massageLabLightRaysSaturation: Number(event.target.value) })}
              aria-label="Light Rays saturation"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Mouse influence ({massageLabLightRaysMouseInfluence.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={massageLabLightRaysMouseInfluence}
              onChange={(event) => handleSettingsChange({ massageLabLightRaysMouseInfluence: Number(event.target.value) })}
              aria-label="Light Rays mouse influence"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Noise ({massageLabLightRaysNoiseAmount.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={massageLabLightRaysNoiseAmount}
              onChange={(event) => handleSettingsChange({ massageLabLightRaysNoiseAmount: Number(event.target.value) })}
              aria-label="Light Rays noise amount"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Distortion ({massageLabLightRaysDistortion.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.01"
              value={massageLabLightRaysDistortion}
              onChange={(event) => handleSettingsChange({ massageLabLightRaysDistortion: Number(event.target.value) })}
              aria-label="Light Rays distortion"
            />
          </label>
        </>
      )}

      {option.id === "massage-lab-pixel-blast" && (
        <>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={massageLabPixelBlastPaletteMode}
              onChange={(event) => handleSettingsChange({
                massageLabPixelBlastPaletteMode: event.target.value as MassageLabPixelBlastPaletteMode,
              })}
              aria-label="MassageLab Pixel Blast color mode"
            >
              <option value="source">Source lavender</option>
              <option value="custom">Custom pixel</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {massageLabPixelBlastPaletteMode === "custom" ? (
            <div className={styles.colorRow}>
              <span>Pixel color</span>
              <ColorPickerInput
                value={massageLabPixelBlastColor}
                onValueChange={(nextColor) => handleSettingsChange({ massageLabPixelBlastColor: nextColor })}
                label="MassageLab Pixel Blast color"
              />
            </div>
          ) : null}

          {massageLabPixelBlastPaletteMode === "harmony" ? (
            <>
              <div className={styles.colorRow}>
                <span>Primary color</span>
                <ColorPickerInput
                  value={massageLabPixelBlastPrimaryColor}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabPixelBlastPrimaryColor: nextColor })}
                  label="MassageLab Pixel Blast primary color"
                />
              </div>
              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={massageLabPixelBlastHarmony}
                  onChange={(event) => handleSettingsChange({
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
          ) : null}

          <label className={styles.selectRow}>
            <span>Shape</span>
            <select
              value={massageLabPixelBlastVariant}
              onChange={(event) => handleSettingsChange({
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
              checked={massageLabPixelBlastAntialias}
              onChange={(event) => handleSettingsChange({ massageLabPixelBlastAntialias: event.target.checked })}
              aria-label="MassageLab Pixel Blast antialias"
            />
            <span>Antialias edges</span>
          </label>

          <label className={styles.selectRow}>
            <input
              type="checkbox"
              checked={massageLabPixelBlastEnableRipples}
              onChange={(event) => handleSettingsChange({ massageLabPixelBlastEnableRipples: event.target.checked })}
              aria-label="MassageLab Pixel Blast ripple clicks"
            />
            <span>Ripple clicks</span>
          </label>

          <label className={styles.selectRow}>
            <input
              type="checkbox"
              checked={massageLabPixelBlastLiquid}
              onChange={(event) => handleSettingsChange({ massageLabPixelBlastLiquid: event.target.checked })}
              aria-label="MassageLab Pixel Blast liquid pointer warp"
            />
            <span>Liquid pointer warp</span>
          </label>

          <label className={styles.selectRow}>
            <input
              type="checkbox"
              checked={massageLabPixelBlastTransparent}
              onChange={(event) => handleSettingsChange({ massageLabPixelBlastTransparent: event.target.checked })}
              aria-label="MassageLab Pixel Blast transparent background"
            />
            <span>Transparent background</span>
          </label>

          <label className={styles.selectRow}>
            <input
              type="checkbox"
              checked={massageLabPixelBlastAutoPauseOffscreen}
              onChange={(event) => handleSettingsChange({ massageLabPixelBlastAutoPauseOffscreen: event.target.checked })}
              aria-label="MassageLab Pixel Blast pause offscreen"
            />
            <span>Pause offscreen</span>
          </label>

          <label className={styles.rangeRow}>
            <span>Pixel size ({massageLabPixelBlastPixelSize.toFixed(0)})</span>
            <input
              type="range"
              min="1"
              max="16"
              step="1"
              value={massageLabPixelBlastPixelSize}
              onChange={(event) => handleSettingsChange({ massageLabPixelBlastPixelSize: Number(event.target.value) })}
              aria-label="MassageLab Pixel Blast pixel size"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Pattern scale ({massageLabPixelBlastPatternScale.toFixed(2)})</span>
            <input
              type="range"
              min="0.25"
              max="8"
              step="0.05"
              value={massageLabPixelBlastPatternScale}
              onChange={(event) => handleSettingsChange({ massageLabPixelBlastPatternScale: Number(event.target.value) })}
              aria-label="MassageLab Pixel Blast pattern scale"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Density ({massageLabPixelBlastPatternDensity.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.05"
              value={massageLabPixelBlastPatternDensity}
              onChange={(event) => handleSettingsChange({
                massageLabPixelBlastPatternDensity: Number(event.target.value),
              })}
              aria-label="MassageLab Pixel Blast pattern density"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Speed ({massageLabPixelBlastSpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={massageLabPixelBlastSpeed}
              onChange={(event) => handleSettingsChange({ massageLabPixelBlastSpeed: Number(event.target.value) })}
              aria-label="MassageLab Pixel Blast speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Pixel jitter ({massageLabPixelBlastPixelSizeJitter.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={massageLabPixelBlastPixelSizeJitter}
              onChange={(event) => handleSettingsChange({
                massageLabPixelBlastPixelSizeJitter: Number(event.target.value),
              })}
              aria-label="MassageLab Pixel Blast pixel jitter"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Edge fade ({massageLabPixelBlastEdgeFade.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={massageLabPixelBlastEdgeFade}
              onChange={(event) => handleSettingsChange({ massageLabPixelBlastEdgeFade: Number(event.target.value) })}
              aria-label="MassageLab Pixel Blast edge fade"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Ripple intensity ({massageLabPixelBlastRippleIntensityScale.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="4"
              step="0.05"
              value={massageLabPixelBlastRippleIntensityScale}
              onChange={(event) => handleSettingsChange({
                massageLabPixelBlastRippleIntensityScale: Number(event.target.value),
              })}
              aria-label="MassageLab Pixel Blast ripple intensity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Ripple thickness ({massageLabPixelBlastRippleThickness.toFixed(2)})</span>
            <input
              type="range"
              min="0.01"
              max="0.5"
              step="0.01"
              value={massageLabPixelBlastRippleThickness}
              onChange={(event) => handleSettingsChange({
                massageLabPixelBlastRippleThickness: Number(event.target.value),
              })}
              aria-label="MassageLab Pixel Blast ripple thickness"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Ripple speed ({massageLabPixelBlastRippleSpeed.toFixed(2)})</span>
            <input
              type="range"
              min="0.05"
              max="2"
              step="0.05"
              value={massageLabPixelBlastRippleSpeed}
              onChange={(event) => handleSettingsChange({ massageLabPixelBlastRippleSpeed: Number(event.target.value) })}
              aria-label="MassageLab Pixel Blast ripple speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Liquid strength ({massageLabPixelBlastLiquidStrength.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="0.4"
              step="0.01"
              value={massageLabPixelBlastLiquidStrength}
              onChange={(event) => handleSettingsChange({
                massageLabPixelBlastLiquidStrength: Number(event.target.value),
              })}
              aria-label="MassageLab Pixel Blast liquid strength"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Liquid radius ({massageLabPixelBlastLiquidRadius.toFixed(1)})</span>
            <input
              type="range"
              min="0.1"
              max="4"
              step="0.1"
              value={massageLabPixelBlastLiquidRadius}
              onChange={(event) => handleSettingsChange({ massageLabPixelBlastLiquidRadius: Number(event.target.value) })}
              aria-label="MassageLab Pixel Blast liquid radius"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Liquid wobble ({massageLabPixelBlastLiquidWobbleSpeed.toFixed(1)})</span>
            <input
              type="range"
              min="0"
              max="10"
              step="0.1"
              value={massageLabPixelBlastLiquidWobbleSpeed}
              onChange={(event) => handleSettingsChange({
                massageLabPixelBlastLiquidWobbleSpeed: Number(event.target.value),
              })}
              aria-label="MassageLab Pixel Blast liquid wobble speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Noise ({massageLabPixelBlastNoiseAmount.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="0.4"
              step="0.01"
              value={massageLabPixelBlastNoiseAmount}
              onChange={(event) => handleSettingsChange({ massageLabPixelBlastNoiseAmount: Number(event.target.value) })}
              aria-label="MassageLab Pixel Blast noise amount"
            />
          </label>
        </>
      )}

      {option.id === "massage-lab-color-bends" && (
        <>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={massageLabColorBendsPaletteMode}
              onChange={(event) => handleSettingsChange({
                massageLabColorBendsPaletteMode: event.target.value as MassageLabColorBendsPaletteMode,
              })}
              aria-label="MassageLab Color Bends color mode"
            >
              <option value="source">Source RGB bands</option>
              <option value="custom">Custom bends</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {massageLabColorBendsPaletteMode === "custom" ? (
            <>
              {[
                ["Color 1", "massageLabColorBendsColorOne", massageLabColorBendsColorOne],
                ["Color 2", "massageLabColorBendsColorTwo", massageLabColorBendsColorTwo],
                ["Color 3", "massageLabColorBendsColorThree", massageLabColorBendsColorThree],
                ["Color 4", "massageLabColorBendsColorFour", massageLabColorBendsColorFour],
              ].map(([label, key, value]) => (
                <div key={key} className={styles.colorRow}>
                  <span>{label}</span>
                  <ColorPickerInput
                    value={value}
                    onValueChange={(nextColor) => handleSettingsChange({ [key]: nextColor })}
                    label={`MassageLab Color Bends ${label.toLowerCase()}`}
                  />
                </div>
              ))}
            </>
          ) : null}

          {massageLabColorBendsPaletteMode === "harmony" ? (
            <>
              <div className={styles.colorRow}>
                <span>Primary color</span>
                <ColorPickerInput
                  value={massageLabColorBendsPrimaryColor}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabColorBendsPrimaryColor: nextColor })}
                  label="MassageLab Color Bends primary color"
                />
              </div>
              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={massageLabColorBendsHarmony}
                  onChange={(event) => handleSettingsChange({
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
          ) : null}

          <label className={styles.selectRow}>
            <input
              type="checkbox"
              checked={massageLabColorBendsTransparent}
              onChange={(event) => handleSettingsChange({ massageLabColorBendsTransparent: event.target.checked })}
              aria-label="MassageLab Color Bends transparent background"
            />
            <span>Transparent background</span>
          </label>

          <label className={styles.selectRow}>
            <input
              type="checkbox"
              checked={massageLabColorBendsInteractive}
              onChange={(event) => handleSettingsChange({ massageLabColorBendsInteractive: event.target.checked })}
              aria-label="MassageLab Color Bends pointer interaction"
            />
            <span>Pointer interaction</span>
          </label>

          <label className={styles.rangeRow}>
            <span>Rotation ({massageLabColorBendsRotation.toFixed(0)}deg)</span>
            <input
              type="range"
              min="-360"
              max="360"
              step="1"
              value={massageLabColorBendsRotation}
              onChange={(event) => handleSettingsChange({ massageLabColorBendsRotation: Number(event.target.value) })}
              aria-label="MassageLab Color Bends rotation"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Speed ({massageLabColorBendsSpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={massageLabColorBendsSpeed}
              onChange={(event) => handleSettingsChange({ massageLabColorBendsSpeed: Number(event.target.value) })}
              aria-label="MassageLab Color Bends speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Auto rotate ({massageLabColorBendsAutoRotate.toFixed(0)}deg/s)</span>
            <input
              type="range"
              min="-180"
              max="180"
              step="1"
              value={massageLabColorBendsAutoRotate}
              onChange={(event) => handleSettingsChange({ massageLabColorBendsAutoRotate: Number(event.target.value) })}
              aria-label="MassageLab Color Bends auto rotate"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Scale ({massageLabColorBendsScale.toFixed(2)})</span>
            <input
              type="range"
              min="0.1"
              max="4"
              step="0.05"
              value={massageLabColorBendsScale}
              onChange={(event) => handleSettingsChange({ massageLabColorBendsScale: Number(event.target.value) })}
              aria-label="MassageLab Color Bends scale"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Frequency ({massageLabColorBendsFrequency.toFixed(2)})</span>
            <input
              type="range"
              min="0.1"
              max="4"
              step="0.05"
              value={massageLabColorBendsFrequency}
              onChange={(event) => handleSettingsChange({ massageLabColorBendsFrequency: Number(event.target.value) })}
              aria-label="MassageLab Color Bends frequency"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Warp ({massageLabColorBendsWarpStrength.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={massageLabColorBendsWarpStrength}
              onChange={(event) => handleSettingsChange({ massageLabColorBendsWarpStrength: Number(event.target.value) })}
              aria-label="MassageLab Color Bends warp strength"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Mouse influence ({massageLabColorBendsMouseInfluence.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={massageLabColorBendsMouseInfluence}
              onChange={(event) => handleSettingsChange({ massageLabColorBendsMouseInfluence: Number(event.target.value) })}
              aria-label="MassageLab Color Bends mouse influence"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Parallax ({massageLabColorBendsParallax.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.05"
              value={massageLabColorBendsParallax}
              onChange={(event) => handleSettingsChange({ massageLabColorBendsParallax: Number(event.target.value) })}
              aria-label="MassageLab Color Bends parallax"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Noise ({massageLabColorBendsNoise.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={massageLabColorBendsNoise}
              onChange={(event) => handleSettingsChange({ massageLabColorBendsNoise: Number(event.target.value) })}
              aria-label="MassageLab Color Bends noise"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Iterations ({massageLabColorBendsIterations.toFixed(0)})</span>
            <input
              type="range"
              min="1"
              max="5"
              step="1"
              value={massageLabColorBendsIterations}
              onChange={(event) => handleSettingsChange({ massageLabColorBendsIterations: Number(event.target.value) })}
              aria-label="MassageLab Color Bends iterations"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Intensity ({massageLabColorBendsIntensity.toFixed(2)})</span>
            <input
              type="range"
              min="0.1"
              max="4"
              step="0.05"
              value={massageLabColorBendsIntensity}
              onChange={(event) => handleSettingsChange({ massageLabColorBendsIntensity: Number(event.target.value) })}
              aria-label="MassageLab Color Bends intensity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Band width ({massageLabColorBendsBandWidth.toFixed(1)})</span>
            <input
              type="range"
              min="0.5"
              max="16"
              step="0.1"
              value={massageLabColorBendsBandWidth}
              onChange={(event) => handleSettingsChange({ massageLabColorBendsBandWidth: Number(event.target.value) })}
              aria-label="MassageLab Color Bends band width"
            />
          </label>
        </>
      )}

      {option.id === "massage-lab-evil-eye" && (
        <>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={massageLabEvilEyePaletteMode}
              onChange={(event) => handleSettingsChange({
                massageLabEvilEyePaletteMode: event.target.value as MassageLabEvilEyePaletteMode,
              })}
              aria-label="MassageLab Evil Eye color mode"
            >
              <option value="source">Source orange</option>
              <option value="custom">Custom eye</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {massageLabEvilEyePaletteMode === "custom" ? (
            <div className={styles.colorRow}>
              <span>Eye color</span>
              <ColorPickerInput
                value={massageLabEvilEyeColor}
                onValueChange={(nextColor) => handleSettingsChange({ massageLabEvilEyeColor: nextColor })}
                label="MassageLab Evil Eye eye color"
              />
            </div>
          ) : null}

          {massageLabEvilEyePaletteMode === "harmony" ? (
            <>
              <div className={styles.colorRow}>
                <span>Primary color</span>
                <ColorPickerInput
                  value={massageLabEvilEyePrimaryColor}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabEvilEyePrimaryColor: nextColor })}
                  label="MassageLab Evil Eye primary color"
                />
              </div>
              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={massageLabEvilEyeHarmony}
                  onChange={(event) => handleSettingsChange({
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
          ) : null}

          <div className={styles.colorRow}>
            <span>Background</span>
            <ColorPickerInput
              value={massageLabEvilEyeBackgroundColor}
              onValueChange={(nextColor) => handleSettingsChange({ massageLabEvilEyeBackgroundColor: nextColor })}
              label="MassageLab Evil Eye background color"
            />
          </div>

          <label className={styles.selectRow}>
            <input
              type="checkbox"
              checked={massageLabEvilEyeInteractive}
              onChange={(event) => handleSettingsChange({ massageLabEvilEyeInteractive: event.target.checked })}
              aria-label="MassageLab Evil Eye pointer interaction"
            />
            <span>Pointer pupil follow</span>
          </label>

          <label className={styles.rangeRow}>
            <span>Intensity ({massageLabEvilEyeIntensity.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={massageLabEvilEyeIntensity}
              onChange={(event) => handleSettingsChange({ massageLabEvilEyeIntensity: Number(event.target.value) })}
              aria-label="MassageLab Evil Eye intensity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Pupil size ({massageLabEvilEyePupilSize.toFixed(2)})</span>
            <input
              type="range"
              min="0.1"
              max="2"
              step="0.05"
              value={massageLabEvilEyePupilSize}
              onChange={(event) => handleSettingsChange({ massageLabEvilEyePupilSize: Number(event.target.value) })}
              aria-label="MassageLab Evil Eye pupil size"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Iris width ({massageLabEvilEyeIrisWidth.toFixed(2)})</span>
            <input
              type="range"
              min="0.05"
              max="1"
              step="0.01"
              value={massageLabEvilEyeIrisWidth}
              onChange={(event) => handleSettingsChange({ massageLabEvilEyeIrisWidth: Number(event.target.value) })}
              aria-label="MassageLab Evil Eye iris width"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Glow ({massageLabEvilEyeGlowIntensity.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1.5"
              step="0.05"
              value={massageLabEvilEyeGlowIntensity}
              onChange={(event) => handleSettingsChange({ massageLabEvilEyeGlowIntensity: Number(event.target.value) })}
              aria-label="MassageLab Evil Eye glow intensity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Scale ({massageLabEvilEyeScale.toFixed(2)})</span>
            <input
              type="range"
              min="0.25"
              max="2"
              step="0.05"
              value={massageLabEvilEyeScale}
              onChange={(event) => handleSettingsChange({ massageLabEvilEyeScale: Number(event.target.value) })}
              aria-label="MassageLab Evil Eye scale"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Noise scale ({massageLabEvilEyeNoiseScale.toFixed(2)})</span>
            <input
              type="range"
              min="0.1"
              max="4"
              step="0.05"
              value={massageLabEvilEyeNoiseScale}
              onChange={(event) => handleSettingsChange({ massageLabEvilEyeNoiseScale: Number(event.target.value) })}
              aria-label="MassageLab Evil Eye noise scale"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Pupil follow ({massageLabEvilEyePupilFollow.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.05"
              value={massageLabEvilEyePupilFollow}
              onChange={(event) => handleSettingsChange({ massageLabEvilEyePupilFollow: Number(event.target.value) })}
              aria-label="MassageLab Evil Eye pupil follow"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Flame speed ({massageLabEvilEyeFlameSpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={massageLabEvilEyeFlameSpeed}
              onChange={(event) => handleSettingsChange({ massageLabEvilEyeFlameSpeed: Number(event.target.value) })}
              aria-label="MassageLab Evil Eye flame speed"
            />
          </label>
        </>
      )}

      {option.id === "massage-lab-line-waves" && (
        <>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={massageLabLineWavesPaletteMode}
              onChange={(event) => handleSettingsChange({
                massageLabLineWavesPaletteMode: event.target.value as MassageLabLineWavesPaletteMode,
              })}
              aria-label="MassageLab Line Waves color mode"
            >
              <option value="source">Source white</option>
              <option value="custom">Custom lines</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {massageLabLineWavesPaletteMode === "custom" ? (
            <>
              <div className={styles.colorRow}>
                <span>Color 1</span>
                <ColorPickerInput
                  value={massageLabLineWavesColorOne}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabLineWavesColorOne: nextColor })}
                  label="MassageLab Line Waves color 1"
                />
              </div>
              <div className={styles.colorRow}>
                <span>Color 2</span>
                <ColorPickerInput
                  value={massageLabLineWavesColorTwo}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabLineWavesColorTwo: nextColor })}
                  label="MassageLab Line Waves color 2"
                />
              </div>
              <div className={styles.colorRow}>
                <span>Color 3</span>
                <ColorPickerInput
                  value={massageLabLineWavesColorThree}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabLineWavesColorThree: nextColor })}
                  label="MassageLab Line Waves color 3"
                />
              </div>
            </>
          ) : null}

          {massageLabLineWavesPaletteMode === "harmony" ? (
            <>
              <div className={styles.colorRow}>
                <span>Primary color</span>
                <ColorPickerInput
                  value={massageLabLineWavesPrimaryColor}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabLineWavesPrimaryColor: nextColor })}
                  label="MassageLab Line Waves primary color"
                />
              </div>
              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={massageLabLineWavesHarmony}
                  onChange={(event) => handleSettingsChange({
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
          ) : null}

          <label className={styles.selectRow}>
            <input
              type="checkbox"
              checked={massageLabLineWavesEnableMouseInteraction}
              onChange={(event) => handleSettingsChange({
                massageLabLineWavesEnableMouseInteraction: event.target.checked,
              })}
              aria-label="MassageLab Line Waves mouse warp"
            />
            <span>Pointer warp</span>
          </label>

          <label className={styles.rangeRow}>
            <span>Speed ({massageLabLineWavesSpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={massageLabLineWavesSpeed}
              onChange={(event) => handleSettingsChange({ massageLabLineWavesSpeed: Number(event.target.value) })}
              aria-label="MassageLab Line Waves speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Inner lines ({massageLabLineWavesInnerLineCount.toFixed(0)})</span>
            <input
              type="range"
              min="1"
              max="96"
              step="1"
              value={massageLabLineWavesInnerLineCount}
              onChange={(event) => handleSettingsChange({
                massageLabLineWavesInnerLineCount: Number(event.target.value),
              })}
              aria-label="MassageLab Line Waves inner line count"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Outer lines ({massageLabLineWavesOuterLineCount.toFixed(0)})</span>
            <input
              type="range"
              min="1"
              max="96"
              step="1"
              value={massageLabLineWavesOuterLineCount}
              onChange={(event) => handleSettingsChange({
                massageLabLineWavesOuterLineCount: Number(event.target.value),
              })}
              aria-label="MassageLab Line Waves outer line count"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Warp ({massageLabLineWavesWarpIntensity.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={massageLabLineWavesWarpIntensity}
              onChange={(event) => handleSettingsChange({ massageLabLineWavesWarpIntensity: Number(event.target.value) })}
              aria-label="MassageLab Line Waves warp intensity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Rotation ({massageLabLineWavesRotation.toFixed(0)}deg)</span>
            <input
              type="range"
              min="-180"
              max="180"
              step="1"
              value={massageLabLineWavesRotation}
              onChange={(event) => handleSettingsChange({ massageLabLineWavesRotation: Number(event.target.value) })}
              aria-label="MassageLab Line Waves rotation"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Edge fade ({massageLabLineWavesEdgeFadeWidth.toFixed(2)})</span>
            <input
              type="range"
              min="-1"
              max="1"
              step="0.05"
              value={massageLabLineWavesEdgeFadeWidth}
              onChange={(event) => handleSettingsChange({ massageLabLineWavesEdgeFadeWidth: Number(event.target.value) })}
              aria-label="MassageLab Line Waves edge fade width"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Color cycle ({massageLabLineWavesColorCycleSpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0"
              max="4"
              step="0.05"
              value={massageLabLineWavesColorCycleSpeed}
              onChange={(event) => handleSettingsChange({
                massageLabLineWavesColorCycleSpeed: Number(event.target.value),
              })}
              aria-label="MassageLab Line Waves color cycle speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Brightness ({massageLabLineWavesBrightness.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1.5"
              step="0.05"
              value={massageLabLineWavesBrightness}
              onChange={(event) => handleSettingsChange({ massageLabLineWavesBrightness: Number(event.target.value) })}
              aria-label="MassageLab Line Waves brightness"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Mouse influence ({massageLabLineWavesMouseInfluence.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="4"
              step="0.05"
              value={massageLabLineWavesMouseInfluence}
              onChange={(event) => handleSettingsChange({ massageLabLineWavesMouseInfluence: Number(event.target.value) })}
              aria-label="MassageLab Line Waves mouse influence"
            />
          </label>
        </>
      )}

      {option.id === "massage-lab-radar" && (
        <>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={massageLabRadarPaletteMode}
              onChange={(event) => handleSettingsChange({
                massageLabRadarPaletteMode: event.target.value as MassageLabRadarPaletteMode,
              })}
              aria-label="MassageLab Radar color mode"
            >
              <option value="source">Source purple</option>
              <option value="custom">Custom radar</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {massageLabRadarPaletteMode === "custom" ? (
            <div className={styles.colorRow}>
              <span>Radar color</span>
              <ColorPickerInput
                value={massageLabRadarColor}
                onValueChange={(nextColor) => handleSettingsChange({ massageLabRadarColor: nextColor })}
                label="MassageLab Radar color"
              />
            </div>
          ) : null}

          {massageLabRadarPaletteMode === "harmony" ? (
            <>
              <div className={styles.colorRow}>
                <span>Primary color</span>
                <ColorPickerInput
                  value={massageLabRadarPrimaryColor}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabRadarPrimaryColor: nextColor })}
                  label="MassageLab Radar primary color"
                />
              </div>
              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={massageLabRadarHarmony}
                  onChange={(event) => handleSettingsChange({
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
          ) : null}

          <div className={styles.colorRow}>
            <span>Background</span>
            <ColorPickerInput
              value={massageLabRadarBackgroundColor}
              onValueChange={(nextColor) => handleSettingsChange({ massageLabRadarBackgroundColor: nextColor })}
              label="MassageLab Radar background color"
            />
          </div>

          <label className={styles.selectRow}>
            <input
              type="checkbox"
              checked={massageLabRadarEnableMouseInteraction}
              onChange={(event) => handleSettingsChange({
                massageLabRadarEnableMouseInteraction: event.target.checked,
              })}
              aria-label="MassageLab Radar pointer offset"
            />
            <span>Pointer offset</span>
          </label>

          <label className={styles.rangeRow}>
            <span>Speed ({massageLabRadarSpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={massageLabRadarSpeed}
              onChange={(event) => handleSettingsChange({ massageLabRadarSpeed: Number(event.target.value) })}
              aria-label="MassageLab Radar speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Scale ({massageLabRadarScale.toFixed(2)})</span>
            <input
              type="range"
              min="0.1"
              max="2"
              step="0.05"
              value={massageLabRadarScale}
              onChange={(event) => handleSettingsChange({ massageLabRadarScale: Number(event.target.value) })}
              aria-label="MassageLab Radar scale"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Rings ({massageLabRadarRingCount.toFixed(0)})</span>
            <input
              type="range"
              min="1"
              max="40"
              step="1"
              value={massageLabRadarRingCount}
              onChange={(event) => handleSettingsChange({ massageLabRadarRingCount: Number(event.target.value) })}
              aria-label="MassageLab Radar ring count"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Spokes ({massageLabRadarSpokeCount.toFixed(0)})</span>
            <input
              type="range"
              min="1"
              max="40"
              step="1"
              value={massageLabRadarSpokeCount}
              onChange={(event) => handleSettingsChange({ massageLabRadarSpokeCount: Number(event.target.value) })}
              aria-label="MassageLab Radar spoke count"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Ring thickness ({massageLabRadarRingThickness.toFixed(3)})</span>
            <input
              type="range"
              min="0.001"
              max="0.25"
              step="0.001"
              value={massageLabRadarRingThickness}
              onChange={(event) => handleSettingsChange({ massageLabRadarRingThickness: Number(event.target.value) })}
              aria-label="MassageLab Radar ring thickness"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Spoke thickness ({massageLabRadarSpokeThickness.toFixed(3)})</span>
            <input
              type="range"
              min="0.001"
              max="0.1"
              step="0.001"
              value={massageLabRadarSpokeThickness}
              onChange={(event) => handleSettingsChange({ massageLabRadarSpokeThickness: Number(event.target.value) })}
              aria-label="MassageLab Radar spoke thickness"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Sweep speed ({massageLabRadarSweepSpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0"
              max="4"
              step="0.05"
              value={massageLabRadarSweepSpeed}
              onChange={(event) => handleSettingsChange({ massageLabRadarSweepSpeed: Number(event.target.value) })}
              aria-label="MassageLab Radar sweep speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Sweep width ({massageLabRadarSweepWidth.toFixed(2)})</span>
            <input
              type="range"
              min="0.1"
              max="12"
              step="0.1"
              value={massageLabRadarSweepWidth}
              onChange={(event) => handleSettingsChange({ massageLabRadarSweepWidth: Number(event.target.value) })}
              aria-label="MassageLab Radar sweep width"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Sweep lobes ({massageLabRadarSweepLobes.toFixed(0)})</span>
            <input
              type="range"
              min="1"
              max="12"
              step="1"
              value={massageLabRadarSweepLobes}
              onChange={(event) => handleSettingsChange({ massageLabRadarSweepLobes: Number(event.target.value) })}
              aria-label="MassageLab Radar sweep lobes"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Falloff ({massageLabRadarFalloff.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="8"
              step="0.1"
              value={massageLabRadarFalloff}
              onChange={(event) => handleSettingsChange({ massageLabRadarFalloff: Number(event.target.value) })}
              aria-label="MassageLab Radar falloff"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Brightness ({massageLabRadarBrightness.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={massageLabRadarBrightness}
              onChange={(event) => handleSettingsChange({ massageLabRadarBrightness: Number(event.target.value) })}
              aria-label="MassageLab Radar brightness"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Mouse influence ({massageLabRadarMouseInfluence.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={massageLabRadarMouseInfluence}
              onChange={(event) => handleSettingsChange({ massageLabRadarMouseInfluence: Number(event.target.value) })}
              aria-label="MassageLab Radar mouse influence"
            />
          </label>
        </>
      )}

      {option.id === "massage-lab-soft-aurora" && (
        <>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={massageLabSoftAuroraPaletteMode}
              onChange={(event) => handleSettingsChange({
                massageLabSoftAuroraPaletteMode: event.target.value as MassageLabSoftAuroraPaletteMode,
              })}
              aria-label="MassageLab Soft Aurora color mode"
            >
              <option value="source">Source white and magenta</option>
              <option value="custom">Custom aurora</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {massageLabSoftAuroraPaletteMode === "custom" ? (
            <>
              <div className={styles.colorRow}>
                <span>Aurora color 1</span>
                <ColorPickerInput
                  value={massageLabSoftAuroraColorOne}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabSoftAuroraColorOne: nextColor })}
                  label="MassageLab Soft Aurora color 1"
                />
              </div>
              <div className={styles.colorRow}>
                <span>Aurora color 2</span>
                <ColorPickerInput
                  value={massageLabSoftAuroraColorTwo}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabSoftAuroraColorTwo: nextColor })}
                  label="MassageLab Soft Aurora color 2"
                />
              </div>
            </>
          ) : null}

          {massageLabSoftAuroraPaletteMode === "harmony" ? (
            <>
              <div className={styles.colorRow}>
                <span>Primary color</span>
                <ColorPickerInput
                  value={massageLabSoftAuroraPrimaryColor}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabSoftAuroraPrimaryColor: nextColor })}
                  label="MassageLab Soft Aurora primary color"
                />
              </div>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={massageLabSoftAuroraHarmony}
                  onChange={(event) => handleSettingsChange({
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
              checked={massageLabSoftAuroraEnableMouseInteraction}
              onChange={(event) => handleSettingsChange({
                massageLabSoftAuroraEnableMouseInteraction: event.target.checked,
              })}
              aria-label="MassageLab Soft Aurora mouse shift"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Speed ({massageLabSoftAuroraSpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={massageLabSoftAuroraSpeed}
              onChange={(event) => handleSettingsChange({ massageLabSoftAuroraSpeed: Number(event.target.value) })}
              aria-label="MassageLab Soft Aurora speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Scale ({massageLabSoftAuroraScale.toFixed(2)})</span>
            <input
              type="range"
              min="0.1"
              max="4"
              step="0.05"
              value={massageLabSoftAuroraScale}
              onChange={(event) => handleSettingsChange({ massageLabSoftAuroraScale: Number(event.target.value) })}
              aria-label="MassageLab Soft Aurora scale"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Brightness ({massageLabSoftAuroraBrightness.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={massageLabSoftAuroraBrightness}
              onChange={(event) => handleSettingsChange({ massageLabSoftAuroraBrightness: Number(event.target.value) })}
              aria-label="MassageLab Soft Aurora brightness"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Noise frequency ({massageLabSoftAuroraNoiseFrequency.toFixed(2)})</span>
            <input
              type="range"
              min="0.1"
              max="8"
              step="0.05"
              value={massageLabSoftAuroraNoiseFrequency}
              onChange={(event) => handleSettingsChange({
                massageLabSoftAuroraNoiseFrequency: Number(event.target.value),
              })}
              aria-label="MassageLab Soft Aurora noise frequency"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Noise amplitude ({massageLabSoftAuroraNoiseAmplitude.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="4"
              step="0.05"
              value={massageLabSoftAuroraNoiseAmplitude}
              onChange={(event) => handleSettingsChange({
                massageLabSoftAuroraNoiseAmplitude: Number(event.target.value),
              })}
              aria-label="MassageLab Soft Aurora noise amplitude"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Band height ({massageLabSoftAuroraBandHeight.toFixed(2)})</span>
            <input
              type="range"
              min="-1"
              max="2"
              step="0.05"
              value={massageLabSoftAuroraBandHeight}
              onChange={(event) => handleSettingsChange({ massageLabSoftAuroraBandHeight: Number(event.target.value) })}
              aria-label="MassageLab Soft Aurora band height"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Band spread ({massageLabSoftAuroraBandSpread.toFixed(2)})</span>
            <input
              type="range"
              min="0.1"
              max="4"
              step="0.05"
              value={massageLabSoftAuroraBandSpread}
              onChange={(event) => handleSettingsChange({ massageLabSoftAuroraBandSpread: Number(event.target.value) })}
              aria-label="MassageLab Soft Aurora band spread"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Octave decay ({massageLabSoftAuroraOctaveDecay.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={massageLabSoftAuroraOctaveDecay}
              onChange={(event) => handleSettingsChange({ massageLabSoftAuroraOctaveDecay: Number(event.target.value) })}
              aria-label="MassageLab Soft Aurora octave decay"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Layer offset ({massageLabSoftAuroraLayerOffset.toFixed(2)})</span>
            <input
              type="range"
              min="-6"
              max="6"
              step="0.05"
              value={massageLabSoftAuroraLayerOffset}
              onChange={(event) => handleSettingsChange({ massageLabSoftAuroraLayerOffset: Number(event.target.value) })}
              aria-label="MassageLab Soft Aurora layer offset"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Color speed ({massageLabSoftAuroraColorSpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0"
              max="4"
              step="0.05"
              value={massageLabSoftAuroraColorSpeed}
              onChange={(event) => handleSettingsChange({ massageLabSoftAuroraColorSpeed: Number(event.target.value) })}
              aria-label="MassageLab Soft Aurora color speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Mouse influence ({massageLabSoftAuroraMouseInfluence.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={massageLabSoftAuroraMouseInfluence}
              onChange={(event) => handleSettingsChange({
                massageLabSoftAuroraMouseInfluence: Number(event.target.value),
              })}
              aria-label="MassageLab Soft Aurora mouse influence"
            />
          </label>
        </>
      )}

      {option.id === "massage-lab-plasma" && (
        <>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={massageLabPlasmaPaletteMode}
              onChange={(event) => handleSettingsChange({
                massageLabPlasmaPaletteMode: event.target.value as MassageLabPlasmaPaletteMode,
              })}
              aria-label="MassageLab Plasma color mode"
            >
              <option value="source">Source white</option>
              <option value="custom">Custom plasma</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {massageLabPlasmaPaletteMode === "custom" ? (
            <div className={styles.colorRow}>
              <span>Plasma color</span>
              <ColorPickerInput
                value={massageLabPlasmaColor}
                onValueChange={(nextColor) => handleSettingsChange({ massageLabPlasmaColor: nextColor })}
                label="MassageLab Plasma color"
              />
            </div>
          ) : null}

          {massageLabPlasmaPaletteMode === "harmony" ? (
            <>
              <div className={styles.colorRow}>
                <span>Primary color</span>
                <ColorPickerInput
                  value={massageLabPlasmaPrimaryColor}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabPlasmaPrimaryColor: nextColor })}
                  label="MassageLab Plasma primary color"
                />
              </div>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={massageLabPlasmaHarmony}
                  onChange={(event) => handleSettingsChange({
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
              value={massageLabPlasmaDirection}
              onChange={(event) => handleSettingsChange({
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
              checked={massageLabPlasmaMouseInteractive}
              onChange={(event) => handleSettingsChange({ massageLabPlasmaMouseInteractive: event.target.checked })}
              aria-label="MassageLab Plasma mouse warp"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Speed ({massageLabPlasmaSpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={massageLabPlasmaSpeed}
              onChange={(event) => handleSettingsChange({ massageLabPlasmaSpeed: Number(event.target.value) })}
              aria-label="MassageLab Plasma speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Scale ({massageLabPlasmaScale.toFixed(2)})</span>
            <input
              type="range"
              min="0.2"
              max="4"
              step="0.05"
              value={massageLabPlasmaScale}
              onChange={(event) => handleSettingsChange({ massageLabPlasmaScale: Number(event.target.value) })}
              aria-label="MassageLab Plasma scale"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Opacity ({Math.round(massageLabPlasmaOpacity * 100)}%)</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={massageLabPlasmaOpacity}
              onChange={(event) => handleSettingsChange({ massageLabPlasmaOpacity: Number(event.target.value) })}
              aria-label="MassageLab Plasma opacity"
            />
          </label>
        </>
      )}

      {option.id === "massage-lab-plasma-wave" && (
        <>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={massageLabPlasmaWavePaletteMode}
              onChange={(event) => handleSettingsChange({
                massageLabPlasmaWavePaletteMode: event.target.value as MassageLabPlasmaWavePaletteMode,
              })}
              aria-label="MassageLab Plasma Wave color mode"
            >
              <option value="source">Source violet and cyan</option>
              <option value="custom">Custom waves</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {massageLabPlasmaWavePaletteMode === "custom" ? (
            <>
              <div className={styles.colorRow}>
                <span>Wave color 1</span>
                <ColorPickerInput
                  value={massageLabPlasmaWaveColorOne}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabPlasmaWaveColorOne: nextColor })}
                  label="MassageLab Plasma Wave color 1"
                />
              </div>
              <div className={styles.colorRow}>
                <span>Wave color 2</span>
                <ColorPickerInput
                  value={massageLabPlasmaWaveColorTwo}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabPlasmaWaveColorTwo: nextColor })}
                  label="MassageLab Plasma Wave color 2"
                />
              </div>
            </>
          ) : null}

          {massageLabPlasmaWavePaletteMode === "harmony" ? (
            <>
              <div className={styles.colorRow}>
                <span>Primary color</span>
                <ColorPickerInput
                  value={massageLabPlasmaWavePrimaryColor}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabPlasmaWavePrimaryColor: nextColor })}
                  label="MassageLab Plasma Wave primary color"
                />
              </div>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={massageLabPlasmaWaveHarmony}
                  onChange={(event) => handleSettingsChange({
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
              value={massageLabPlasmaWaveDirectionTwo}
              onChange={(event) => handleSettingsChange({
                massageLabPlasmaWaveDirectionTwo: Number(event.target.value) as 1 | -1,
              })}
              aria-label="MassageLab Plasma Wave secondary direction"
            >
              <option value={1}>Forward</option>
              <option value={-1}>Reverse</option>
            </select>
          </label>

          <label className={styles.rangeRow}>
            <span>Rotation ({massageLabPlasmaWaveRotationDeg.toFixed(0)}deg)</span>
            <input
              type="range"
              min="-180"
              max="180"
              step="1"
              value={massageLabPlasmaWaveRotationDeg}
              onChange={(event) => handleSettingsChange({ massageLabPlasmaWaveRotationDeg: Number(event.target.value) })}
              aria-label="MassageLab Plasma Wave rotation"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Focal length ({massageLabPlasmaWaveFocalLength.toFixed(2)})</span>
            <input
              type="range"
              min="0.2"
              max="2"
              step="0.05"
              value={massageLabPlasmaWaveFocalLength}
              onChange={(event) => handleSettingsChange({ massageLabPlasmaWaveFocalLength: Number(event.target.value) })}
              aria-label="MassageLab Plasma Wave focal length"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Wave 1 speed ({massageLabPlasmaWaveSpeedOne.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="0.5"
              step="0.01"
              value={massageLabPlasmaWaveSpeedOne}
              onChange={(event) => handleSettingsChange({ massageLabPlasmaWaveSpeedOne: Number(event.target.value) })}
              aria-label="MassageLab Plasma Wave speed 1"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Wave 2 speed ({massageLabPlasmaWaveSpeedTwo.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="0.5"
              step="0.01"
              value={massageLabPlasmaWaveSpeedTwo}
              onChange={(event) => handleSettingsChange({ massageLabPlasmaWaveSpeedTwo: Number(event.target.value) })}
              aria-label="MassageLab Plasma Wave speed 2"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Wave 1 bend ({massageLabPlasmaWaveBendOne.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={massageLabPlasmaWaveBendOne}
              onChange={(event) => handleSettingsChange({ massageLabPlasmaWaveBendOne: Number(event.target.value) })}
              aria-label="MassageLab Plasma Wave bend 1"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Wave 2 bend ({massageLabPlasmaWaveBendTwo.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={massageLabPlasmaWaveBendTwo}
              onChange={(event) => handleSettingsChange({ massageLabPlasmaWaveBendTwo: Number(event.target.value) })}
              aria-label="MassageLab Plasma Wave bend 2"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>X offset ({massageLabPlasmaWaveXOffset.toFixed(0)}px)</span>
            <input
              type="range"
              min="-800"
              max="800"
              step="10"
              value={massageLabPlasmaWaveXOffset}
              onChange={(event) => handleSettingsChange({ massageLabPlasmaWaveXOffset: Number(event.target.value) })}
              aria-label="MassageLab Plasma Wave x offset"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Y offset ({massageLabPlasmaWaveYOffset.toFixed(0)}px)</span>
            <input
              type="range"
              min="-800"
              max="800"
              step="10"
              value={massageLabPlasmaWaveYOffset}
              onChange={(event) => handleSettingsChange({ massageLabPlasmaWaveYOffset: Number(event.target.value) })}
              aria-label="MassageLab Plasma Wave y offset"
            />
          </label>
        </>
      )}

      {option.id === "massage-lab-particles" && (
        <>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={massageLabParticlesPaletteMode}
              onChange={(event) => handleSettingsChange({
                massageLabParticlesPaletteMode: event.target.value as MassageLabParticlesPaletteMode,
              })}
              aria-label="MassageLab Particles color mode"
            >
              <option value="source">Source white particles</option>
              <option value="custom">Custom particles</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {massageLabParticlesPaletteMode === "custom" ? (
            <>
              <div className={styles.colorRow}>
                <span>Particle color 1</span>
                <ColorPickerInput
                  value={massageLabParticlesColorOne}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabParticlesColorOne: nextColor })}
                  label="MassageLab Particles color 1"
                />
              </div>
              <div className={styles.colorRow}>
                <span>Particle color 2</span>
                <ColorPickerInput
                  value={massageLabParticlesColorTwo}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabParticlesColorTwo: nextColor })}
                  label="MassageLab Particles color 2"
                />
              </div>
              <div className={styles.colorRow}>
                <span>Particle color 3</span>
                <ColorPickerInput
                  value={massageLabParticlesColorThree}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabParticlesColorThree: nextColor })}
                  label="MassageLab Particles color 3"
                />
              </div>
            </>
          ) : null}

          {massageLabParticlesPaletteMode === "harmony" ? (
            <>
              <div className={styles.colorRow}>
                <span>Primary color</span>
                <ColorPickerInput
                  value={massageLabParticlesPrimaryColor}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabParticlesPrimaryColor: nextColor })}
                  label="MassageLab Particles primary color"
                />
              </div>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={massageLabParticlesHarmony}
                  onChange={(event) => handleSettingsChange({
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
              checked={massageLabParticlesMoveOnHover}
              onChange={(event) => handleSettingsChange({ massageLabParticlesMoveOnHover: event.target.checked })}
            />
            <span>Move on cursor</span>
          </label>

          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={massageLabParticlesAlpha}
              onChange={(event) => handleSettingsChange({ massageLabParticlesAlpha: event.target.checked })}
            />
            <span>Soft alpha particles</span>
          </label>

          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={!massageLabParticlesDisableRotation}
              onChange={(event) => handleSettingsChange({ massageLabParticlesDisableRotation: !event.target.checked })}
            />
            <span>Rotate cloud</span>
          </label>

          <label className={styles.rangeRow}>
            <span>Particle count ({massageLabParticlesCount.toFixed(0)})</span>
            <input
              type="range"
              min="20"
              max="1500"
              step="10"
              value={massageLabParticlesCount}
              onChange={(event) => handleSettingsChange({ massageLabParticlesCount: Number(event.target.value) })}
              aria-label="MassageLab Particles particle count"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Spread ({massageLabParticlesSpread.toFixed(1)})</span>
            <input
              type="range"
              min="1"
              max="30"
              step="0.5"
              value={massageLabParticlesSpread}
              onChange={(event) => handleSettingsChange({ massageLabParticlesSpread: Number(event.target.value) })}
              aria-label="MassageLab Particles spread"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Speed ({massageLabParticlesSpeed.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={massageLabParticlesSpeed}
              onChange={(event) => handleSettingsChange({ massageLabParticlesSpeed: Number(event.target.value) })}
              aria-label="MassageLab Particles speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Hover push ({massageLabParticlesHoverFactor.toFixed(1)})</span>
            <input
              type="range"
              min="0"
              max="5"
              step="0.1"
              value={massageLabParticlesHoverFactor}
              onChange={(event) => handleSettingsChange({ massageLabParticlesHoverFactor: Number(event.target.value) })}
              aria-label="MassageLab Particles hover push"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Base size ({massageLabParticlesBaseSize.toFixed(0)})</span>
            <input
              type="range"
              min="10"
              max="300"
              step="5"
              value={massageLabParticlesBaseSize}
              onChange={(event) => handleSettingsChange({ massageLabParticlesBaseSize: Number(event.target.value) })}
              aria-label="MassageLab Particles base size"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Size randomness ({massageLabParticlesSizeRandomness.toFixed(1)})</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.1"
              value={massageLabParticlesSizeRandomness}
              onChange={(event) => handleSettingsChange({ massageLabParticlesSizeRandomness: Number(event.target.value) })}
              aria-label="MassageLab Particles size randomness"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Camera distance ({massageLabParticlesCameraDistance.toFixed(0)})</span>
            <input
              type="range"
              min="5"
              max="60"
              step="1"
              value={massageLabParticlesCameraDistance}
              onChange={(event) => handleSettingsChange({ massageLabParticlesCameraDistance: Number(event.target.value) })}
              aria-label="MassageLab Particles camera distance"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Pixel ratio ({massageLabParticlesPixelRatio.toFixed(1)})</span>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={massageLabParticlesPixelRatio}
              onChange={(event) => handleSettingsChange({ massageLabParticlesPixelRatio: Number(event.target.value) })}
              aria-label="MassageLab Particles pixel ratio"
            />
          </label>
        </>
      )}

      {option.id === "massage-lab-gradient-blinds" && (
        <>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={massageLabGradientBlindsPaletteMode}
              onChange={(event) => handleSettingsChange({
                massageLabGradientBlindsPaletteMode: event.target.value as MassageLabGradientBlindsPaletteMode,
              })}
              aria-label="MassageLab Gradient Blinds color mode"
            >
              <option value="source">Source magenta and violet</option>
              <option value="custom">Custom gradient</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {massageLabGradientBlindsPaletteMode === "custom" ? (
            <>
              <div className={styles.colorRow}>
                <span>Gradient color 1</span>
                <ColorPickerInput
                  value={massageLabGradientBlindsColorOne}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabGradientBlindsColorOne: nextColor })}
                  label="MassageLab Gradient Blinds color 1"
                />
              </div>
              <div className={styles.colorRow}>
                <span>Gradient color 2</span>
                <ColorPickerInput
                  value={massageLabGradientBlindsColorTwo}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabGradientBlindsColorTwo: nextColor })}
                  label="MassageLab Gradient Blinds color 2"
                />
              </div>
            </>
          ) : null}

          {massageLabGradientBlindsPaletteMode === "harmony" ? (
            <>
              <div className={styles.colorRow}>
                <span>Primary color</span>
                <ColorPickerInput
                  value={massageLabGradientBlindsPrimaryColor}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabGradientBlindsPrimaryColor: nextColor })}
                  label="MassageLab Gradient Blinds primary color"
                />
              </div>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={massageLabGradientBlindsHarmony}
                  onChange={(event) => handleSettingsChange({
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
              checked={massageLabGradientBlindsEnableMouseInteraction}
              onChange={(event) => handleSettingsChange({
                massageLabGradientBlindsEnableMouseInteraction: event.target.checked,
              })}
            />
            <span>Enable cursor spotlight</span>
          </label>

          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={massageLabGradientBlindsMirror}
              onChange={(event) => handleSettingsChange({ massageLabGradientBlindsMirror: event.target.checked })}
            />
            <span>Mirror gradient</span>
          </label>

          <label className={styles.selectRow}>
            <span>Shine direction</span>
            <select
              value={massageLabGradientBlindsShineDirection}
              onChange={(event) => handleSettingsChange({
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
              value={massageLabGradientBlindsBlendMode}
              onChange={(event) => handleSettingsChange({
                massageLabGradientBlindsBlendMode: event.target.value as MassageLabGradientBlindsBlendMode,
              })}
              aria-label="MassageLab Gradient Blinds blend mode"
            >
              <option value="normal">Normal</option>
              <option value="screen">Screen</option>
              <option value="lighten">Lighten</option>
              <option value="plus-lighter">Plus lighter</option>
            </select>
          </label>

          <label className={styles.rangeRow}>
            <span>Angle ({massageLabGradientBlindsAngle.toFixed(0)}deg)</span>
            <input
              type="range"
              min="-180"
              max="180"
              step="1"
              value={massageLabGradientBlindsAngle}
              onChange={(event) => handleSettingsChange({ massageLabGradientBlindsAngle: Number(event.target.value) })}
              aria-label="MassageLab Gradient Blinds angle"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Noise ({massageLabGradientBlindsNoise.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={massageLabGradientBlindsNoise}
              onChange={(event) => handleSettingsChange({ massageLabGradientBlindsNoise: Number(event.target.value) })}
              aria-label="MassageLab Gradient Blinds noise"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Blind count ({massageLabGradientBlindsBlindCount.toFixed(0)})</span>
            <input
              type="range"
              min="1"
              max="80"
              step="1"
              value={massageLabGradientBlindsBlindCount}
              onChange={(event) => handleSettingsChange({
                massageLabGradientBlindsBlindCount: Number(event.target.value),
              })}
              aria-label="MassageLab Gradient Blinds blind count"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Min blind width ({massageLabGradientBlindsBlindMinWidth.toFixed(0)}px)</span>
            <input
              type="range"
              min="0"
              max="240"
              step="5"
              value={massageLabGradientBlindsBlindMinWidth}
              onChange={(event) => handleSettingsChange({
                massageLabGradientBlindsBlindMinWidth: Number(event.target.value),
              })}
              aria-label="MassageLab Gradient Blinds minimum blind width"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Mouse damping ({massageLabGradientBlindsMouseDampening.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={massageLabGradientBlindsMouseDampening}
              onChange={(event) => handleSettingsChange({
                massageLabGradientBlindsMouseDampening: Number(event.target.value),
              })}
              aria-label="MassageLab Gradient Blinds mouse damping"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Spotlight radius ({massageLabGradientBlindsSpotlightRadius.toFixed(2)})</span>
            <input
              type="range"
              min="0.05"
              max="1.5"
              step="0.01"
              value={massageLabGradientBlindsSpotlightRadius}
              onChange={(event) => handleSettingsChange({
                massageLabGradientBlindsSpotlightRadius: Number(event.target.value),
              })}
              aria-label="MassageLab Gradient Blinds spotlight radius"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Spotlight softness ({massageLabGradientBlindsSpotlightSoftness.toFixed(1)})</span>
            <input
              type="range"
              min="0.2"
              max="4"
              step="0.1"
              value={massageLabGradientBlindsSpotlightSoftness}
              onChange={(event) => handleSettingsChange({
                massageLabGradientBlindsSpotlightSoftness: Number(event.target.value),
              })}
              aria-label="MassageLab Gradient Blinds spotlight softness"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Spotlight opacity ({massageLabGradientBlindsSpotlightOpacity.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.01"
              value={massageLabGradientBlindsSpotlightOpacity}
              onChange={(event) => handleSettingsChange({
                massageLabGradientBlindsSpotlightOpacity: Number(event.target.value),
              })}
              aria-label="MassageLab Gradient Blinds spotlight opacity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Distortion ({massageLabGradientBlindsDistort.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="5"
              step="0.05"
              value={massageLabGradientBlindsDistort}
              onChange={(event) => handleSettingsChange({ massageLabGradientBlindsDistort: Number(event.target.value) })}
              aria-label="MassageLab Gradient Blinds distortion"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Pixel ratio ({massageLabGradientBlindsDpr.toFixed(1)})</span>
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              value={massageLabGradientBlindsDpr}
              onChange={(event) => handleSettingsChange({ massageLabGradientBlindsDpr: Number(event.target.value) })}
              aria-label="MassageLab Gradient Blinds pixel ratio"
            />
          </label>
        </>
      )}

      {option.id === "massage-lab-grainient" && (
        <>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={massageLabGrainientPaletteMode}
              onChange={(event) => handleSettingsChange({
                massageLabGrainientPaletteMode: event.target.value as MassageLabGrainientPaletteMode,
              })}
              aria-label="MassageLab Grainient color mode"
            >
              <option value="source">Source magenta, violet, and mauve</option>
              <option value="custom">Custom grain colors</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {massageLabGrainientPaletteMode === "custom" ? (
            <>
              <div className={styles.colorRow}>
                <span>Color 1</span>
                <ColorPickerInput
                  value={massageLabGrainientColorOne}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabGrainientColorOne: nextColor })}
                  label="MassageLab Grainient color 1"
                />
              </div>
              <div className={styles.colorRow}>
                <span>Color 2</span>
                <ColorPickerInput
                  value={massageLabGrainientColorTwo}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabGrainientColorTwo: nextColor })}
                  label="MassageLab Grainient color 2"
                />
              </div>
              <div className={styles.colorRow}>
                <span>Color 3</span>
                <ColorPickerInput
                  value={massageLabGrainientColorThree}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabGrainientColorThree: nextColor })}
                  label="MassageLab Grainient color 3"
                />
              </div>
            </>
          ) : null}

          {massageLabGrainientPaletteMode === "harmony" ? (
            <>
              <div className={styles.colorRow}>
                <span>Primary color</span>
                <ColorPickerInput
                  value={massageLabGrainientPrimaryColor}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabGrainientPrimaryColor: nextColor })}
                  label="MassageLab Grainient primary color"
                />
              </div>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={massageLabGrainientHarmony}
                  onChange={(event) => handleSettingsChange({
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
              checked={massageLabGrainientGrainAnimated}
              onChange={(event) => handleSettingsChange({ massageLabGrainientGrainAnimated: event.target.checked })}
            />
            <span>Animated grain</span>
          </label>

          <label className={styles.rangeRow}>
            <span>Time speed ({massageLabGrainientTimeSpeed.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.01"
              value={massageLabGrainientTimeSpeed}
              onChange={(event) => handleSettingsChange({ massageLabGrainientTimeSpeed: Number(event.target.value) })}
              aria-label="MassageLab Grainient time speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Color balance ({massageLabGrainientColorBalance.toFixed(2)})</span>
            <input
              type="range"
              min="-1"
              max="1"
              step="0.01"
              value={massageLabGrainientColorBalance}
              onChange={(event) => handleSettingsChange({ massageLabGrainientColorBalance: Number(event.target.value) })}
              aria-label="MassageLab Grainient color balance"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Warp strength ({massageLabGrainientWarpStrength.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="5"
              step="0.05"
              value={massageLabGrainientWarpStrength}
              onChange={(event) => handleSettingsChange({ massageLabGrainientWarpStrength: Number(event.target.value) })}
              aria-label="MassageLab Grainient warp strength"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Warp frequency ({massageLabGrainientWarpFrequency.toFixed(1)})</span>
            <input
              type="range"
              min="0.1"
              max="20"
              step="0.1"
              value={massageLabGrainientWarpFrequency}
              onChange={(event) => handleSettingsChange({ massageLabGrainientWarpFrequency: Number(event.target.value) })}
              aria-label="MassageLab Grainient warp frequency"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Warp speed ({massageLabGrainientWarpSpeed.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="6"
              step="0.05"
              value={massageLabGrainientWarpSpeed}
              onChange={(event) => handleSettingsChange({ massageLabGrainientWarpSpeed: Number(event.target.value) })}
              aria-label="MassageLab Grainient warp speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Warp amplitude ({massageLabGrainientWarpAmplitude.toFixed(0)})</span>
            <input
              type="range"
              min="1"
              max="160"
              step="1"
              value={massageLabGrainientWarpAmplitude}
              onChange={(event) => handleSettingsChange({ massageLabGrainientWarpAmplitude: Number(event.target.value) })}
              aria-label="MassageLab Grainient warp amplitude"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Blend angle ({massageLabGrainientBlendAngle.toFixed(0)}deg)</span>
            <input
              type="range"
              min="-180"
              max="180"
              step="1"
              value={massageLabGrainientBlendAngle}
              onChange={(event) => handleSettingsChange({ massageLabGrainientBlendAngle: Number(event.target.value) })}
              aria-label="MassageLab Grainient blend angle"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Blend softness ({massageLabGrainientBlendSoftness.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={massageLabGrainientBlendSoftness}
              onChange={(event) => handleSettingsChange({ massageLabGrainientBlendSoftness: Number(event.target.value) })}
              aria-label="MassageLab Grainient blend softness"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Rotation amount ({massageLabGrainientRotationAmount.toFixed(0)})</span>
            <input
              type="range"
              min="0"
              max="1200"
              step="10"
              value={massageLabGrainientRotationAmount}
              onChange={(event) => handleSettingsChange({ massageLabGrainientRotationAmount: Number(event.target.value) })}
              aria-label="MassageLab Grainient rotation amount"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Noise scale ({massageLabGrainientNoiseScale.toFixed(1)})</span>
            <input
              type="range"
              min="0.1"
              max="8"
              step="0.1"
              value={massageLabGrainientNoiseScale}
              onChange={(event) => handleSettingsChange({ massageLabGrainientNoiseScale: Number(event.target.value) })}
              aria-label="MassageLab Grainient noise scale"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Grain amount ({massageLabGrainientGrainAmount.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={massageLabGrainientGrainAmount}
              onChange={(event) => handleSettingsChange({ massageLabGrainientGrainAmount: Number(event.target.value) })}
              aria-label="MassageLab Grainient grain amount"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Grain scale ({massageLabGrainientGrainScale.toFixed(1)})</span>
            <input
              type="range"
              min="0.1"
              max="12"
              step="0.1"
              value={massageLabGrainientGrainScale}
              onChange={(event) => handleSettingsChange({ massageLabGrainientGrainScale: Number(event.target.value) })}
              aria-label="MassageLab Grainient grain scale"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Contrast ({massageLabGrainientContrast.toFixed(2)})</span>
            <input
              type="range"
              min="0.2"
              max="4"
              step="0.05"
              value={massageLabGrainientContrast}
              onChange={(event) => handleSettingsChange({ massageLabGrainientContrast: Number(event.target.value) })}
              aria-label="MassageLab Grainient contrast"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Gamma ({massageLabGrainientGamma.toFixed(2)})</span>
            <input
              type="range"
              min="0.2"
              max="4"
              step="0.05"
              value={massageLabGrainientGamma}
              onChange={(event) => handleSettingsChange({ massageLabGrainientGamma: Number(event.target.value) })}
              aria-label="MassageLab Grainient gamma"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Saturation ({massageLabGrainientSaturation.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={massageLabGrainientSaturation}
              onChange={(event) => handleSettingsChange({ massageLabGrainientSaturation: Number(event.target.value) })}
              aria-label="MassageLab Grainient saturation"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Center X ({massageLabGrainientCenterX.toFixed(2)})</span>
            <input
              type="range"
              min="-1"
              max="1"
              step="0.01"
              value={massageLabGrainientCenterX}
              onChange={(event) => handleSettingsChange({ massageLabGrainientCenterX: Number(event.target.value) })}
              aria-label="MassageLab Grainient center X"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Center Y ({massageLabGrainientCenterY.toFixed(2)})</span>
            <input
              type="range"
              min="-1"
              max="1"
              step="0.01"
              value={massageLabGrainientCenterY}
              onChange={(event) => handleSettingsChange({ massageLabGrainientCenterY: Number(event.target.value) })}
              aria-label="MassageLab Grainient center Y"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Zoom ({massageLabGrainientZoom.toFixed(2)})</span>
            <input
              type="range"
              min="0.2"
              max="3"
              step="0.05"
              value={massageLabGrainientZoom}
              onChange={(event) => handleSettingsChange({ massageLabGrainientZoom: Number(event.target.value) })}
              aria-label="MassageLab Grainient zoom"
            />
          </label>
        </>
      )}

      {option.id === "massage-lab-grid-scan" && (
        <>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={massageLabGridScanPaletteMode}
              onChange={(event) => handleSettingsChange({
                massageLabGridScanPaletteMode: event.target.value as MassageLabGridScanPaletteMode,
              })}
              aria-label="MassageLab Grid Scan color mode"
            >
              <option value="source">Source dark grid and magenta scan</option>
              <option value="custom">Custom grid and scan colors</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {massageLabGridScanPaletteMode === "custom" ? (
            <>
              <div className={styles.colorRow}>
                <span>Grid lines</span>
                <ColorPickerInput
                  value={massageLabGridScanLinesColor}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabGridScanLinesColor: nextColor })}
                  label="MassageLab Grid Scan line color"
                />
              </div>
              <div className={styles.colorRow}>
                <span>Scan color</span>
                <ColorPickerInput
                  value={massageLabGridScanScanColor}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabGridScanScanColor: nextColor })}
                  label="MassageLab Grid Scan scan color"
                />
              </div>
            </>
          ) : null}

          {massageLabGridScanPaletteMode === "harmony" ? (
            <>
              <div className={styles.colorRow}>
                <span>Primary color</span>
                <ColorPickerInput
                  value={massageLabGridScanPrimaryColor}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabGridScanPrimaryColor: nextColor })}
                  label="MassageLab Grid Scan primary color"
                />
              </div>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={massageLabGridScanHarmony}
                  onChange={(event) => handleSettingsChange({
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
              checked={massageLabGridScanEnablePointerInteraction}
              onChange={(event) => handleSettingsChange({
                massageLabGridScanEnablePointerInteraction: event.target.checked,
              })}
            />
            <span>Pointer skew</span>
          </label>

          <label className={styles.checkboxRow}>
            <input
              type="checkbox"
              checked={massageLabGridScanScanOnClick}
              onChange={(event) => handleSettingsChange({ massageLabGridScanScanOnClick: event.target.checked })}
            />
            <span>Click scan pulses</span>
          </label>

          <label className={styles.selectRow}>
            <span>Line style</span>
            <select
              value={massageLabGridScanLineStyle}
              onChange={(event) => handleSettingsChange({
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
              value={massageLabGridScanDirection}
              onChange={(event) => handleSettingsChange({
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
            <span>Sensitivity ({massageLabGridScanSensitivity.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={massageLabGridScanSensitivity}
              onChange={(event) => handleSettingsChange({ massageLabGridScanSensitivity: Number(event.target.value) })}
              aria-label="MassageLab Grid Scan sensitivity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Line thickness ({massageLabGridScanLineThickness.toFixed(1)})</span>
            <input
              type="range"
              min="0.2"
              max="6"
              step="0.1"
              value={massageLabGridScanLineThickness}
              onChange={(event) => handleSettingsChange({ massageLabGridScanLineThickness: Number(event.target.value) })}
              aria-label="MassageLab Grid Scan line thickness"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Scan opacity ({massageLabGridScanScanOpacity.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={massageLabGridScanScanOpacity}
              onChange={(event) => handleSettingsChange({ massageLabGridScanScanOpacity: Number(event.target.value) })}
              aria-label="MassageLab Grid Scan opacity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Grid scale ({massageLabGridScanGridScale.toFixed(2)})</span>
            <input
              type="range"
              min="0.02"
              max="0.5"
              step="0.01"
              value={massageLabGridScanGridScale}
              onChange={(event) => handleSettingsChange({ massageLabGridScanGridScale: Number(event.target.value) })}
              aria-label="MassageLab Grid Scan grid scale"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Line jitter ({massageLabGridScanLineJitter.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={massageLabGridScanLineJitter}
              onChange={(event) => handleSettingsChange({ massageLabGridScanLineJitter: Number(event.target.value) })}
              aria-label="MassageLab Grid Scan line jitter"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Noise ({massageLabGridScanNoiseIntensity.toFixed(3)})</span>
            <input
              type="range"
              min="0"
              max="0.25"
              step="0.005"
              value={massageLabGridScanNoiseIntensity}
              onChange={(event) => handleSettingsChange({ massageLabGridScanNoiseIntensity: Number(event.target.value) })}
              aria-label="MassageLab Grid Scan noise"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Bloom opacity ({massageLabGridScanBloomOpacity.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.05"
              value={massageLabGridScanBloomOpacity}
              onChange={(event) => handleSettingsChange({ massageLabGridScanBloomOpacity: Number(event.target.value) })}
              aria-label="MassageLab Grid Scan bloom opacity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Scan glow ({massageLabGridScanScanGlow.toFixed(2)})</span>
            <input
              type="range"
              min="0.1"
              max="3"
              step="0.05"
              value={massageLabGridScanScanGlow}
              onChange={(event) => handleSettingsChange({ massageLabGridScanScanGlow: Number(event.target.value) })}
              aria-label="MassageLab Grid Scan glow"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Scan softness ({massageLabGridScanScanSoftness.toFixed(1)})</span>
            <input
              type="range"
              min="0.2"
              max="6"
              step="0.1"
              value={massageLabGridScanScanSoftness}
              onChange={(event) => handleSettingsChange({ massageLabGridScanScanSoftness: Number(event.target.value) })}
              aria-label="MassageLab Grid Scan softness"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Phase taper ({massageLabGridScanPhaseTaper.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="0.49"
              step="0.01"
              value={massageLabGridScanPhaseTaper}
              onChange={(event) => handleSettingsChange({ massageLabGridScanPhaseTaper: Number(event.target.value) })}
              aria-label="MassageLab Grid Scan phase taper"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Scan duration ({massageLabGridScanScanDuration.toFixed(2)}s)</span>
            <input
              type="range"
              min="0.05"
              max="10"
              step="0.05"
              value={massageLabGridScanScanDuration}
              onChange={(event) => handleSettingsChange({ massageLabGridScanScanDuration: Number(event.target.value) })}
              aria-label="MassageLab Grid Scan duration"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Scan delay ({massageLabGridScanScanDelay.toFixed(2)}s)</span>
            <input
              type="range"
              min="0"
              max="10"
              step="0.05"
              value={massageLabGridScanScanDelay}
              onChange={(event) => handleSettingsChange({ massageLabGridScanScanDelay: Number(event.target.value) })}
              aria-label="MassageLab Grid Scan delay"
            />
          </label>
        </>
      )}

      {option.id === "massage-lab-beams" && (
        <>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={massageLabBeamsPaletteMode}
              onChange={(event) => handleSettingsChange({
                massageLabBeamsPaletteMode: event.target.value as MassageLabBeamsPaletteMode,
              })}
              aria-label="MassageLab Beams color mode"
            >
              <option value="source">Source white light</option>
              <option value="custom">Custom light color</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {massageLabBeamsPaletteMode === "custom" ? (
            <div className={styles.colorRow}>
              <span>Light color</span>
              <ColorPickerInput
                value={massageLabBeamsLightColor}
                onValueChange={(nextColor) => handleSettingsChange({ massageLabBeamsLightColor: nextColor })}
                label="MassageLab Beams light color"
              />
            </div>
          ) : null}

          {massageLabBeamsPaletteMode === "harmony" ? (
            <>
              <div className={styles.colorRow}>
                <span>Primary color</span>
                <ColorPickerInput
                  value={massageLabBeamsPrimaryColor}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabBeamsPrimaryColor: nextColor })}
                  label="MassageLab Beams primary color"
                />
              </div>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={massageLabBeamsHarmony}
                  onChange={(event) => handleSettingsChange({
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
            <span>Beam width ({massageLabBeamsBeamWidth.toFixed(1)})</span>
            <input
              type="range"
              min="0.2"
              max="6"
              step="0.1"
              value={massageLabBeamsBeamWidth}
              onChange={(event) => handleSettingsChange({ massageLabBeamsBeamWidth: Number(event.target.value) })}
              aria-label="MassageLab Beams width"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Beam height ({massageLabBeamsBeamHeight.toFixed(0)})</span>
            <input
              type="range"
              min="4"
              max="32"
              step="1"
              value={massageLabBeamsBeamHeight}
              onChange={(event) => handleSettingsChange({ massageLabBeamsBeamHeight: Number(event.target.value) })}
              aria-label="MassageLab Beams height"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Beam count ({massageLabBeamsBeamNumber.toFixed(0)})</span>
            <input
              type="range"
              min="1"
              max="48"
              step="1"
              value={massageLabBeamsBeamNumber}
              onChange={(event) => handleSettingsChange({ massageLabBeamsBeamNumber: Number(event.target.value) })}
              aria-label="MassageLab Beams count"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Speed ({massageLabBeamsSpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0"
              max="8"
              step="0.05"
              value={massageLabBeamsSpeed}
              onChange={(event) => handleSettingsChange({ massageLabBeamsSpeed: Number(event.target.value) })}
              aria-label="MassageLab Beams speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Noise ({massageLabBeamsNoiseIntensity.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="4"
              step="0.05"
              value={massageLabBeamsNoiseIntensity}
              onChange={(event) => handleSettingsChange({ massageLabBeamsNoiseIntensity: Number(event.target.value) })}
              aria-label="MassageLab Beams noise"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Scale ({massageLabBeamsScale.toFixed(2)})</span>
            <input
              type="range"
              min="0.02"
              max="1.5"
              step="0.01"
              value={massageLabBeamsScale}
              onChange={(event) => handleSettingsChange({ massageLabBeamsScale: Number(event.target.value) })}
              aria-label="MassageLab Beams scale"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Rotation ({massageLabBeamsRotation.toFixed(0)}deg)</span>
            <input
              type="range"
              min="-180"
              max="180"
              step="1"
              value={massageLabBeamsRotation}
              onChange={(event) => handleSettingsChange({ massageLabBeamsRotation: Number(event.target.value) })}
              aria-label="MassageLab Beams rotation"
            />
          </label>
        </>
      )}

      {option.id === "massage-lab-pixel-snow" && (
        <>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={massageLabPixelSnowPaletteMode}
              onChange={(event) => handleSettingsChange({
                massageLabPixelSnowPaletteMode: event.target.value as MassageLabPixelSnowPaletteMode,
              })}
              aria-label="MassageLab Pixel Snow color mode"
            >
              <option value="source">Source white snow</option>
              <option value="custom">Custom snow color</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {massageLabPixelSnowPaletteMode === "custom" ? (
            <div className={styles.colorRow}>
              <span>Snow color</span>
              <ColorPickerInput
                value={massageLabPixelSnowColor}
                onValueChange={(nextColor) => handleSettingsChange({ massageLabPixelSnowColor: nextColor })}
                label="MassageLab Pixel Snow color"
              />
            </div>
          ) : null}

          {massageLabPixelSnowPaletteMode === "harmony" ? (
            <>
              <div className={styles.colorRow}>
                <span>Primary color</span>
                <ColorPickerInput
                  value={massageLabPixelSnowPrimaryColor}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabPixelSnowPrimaryColor: nextColor })}
                  label="MassageLab Pixel Snow primary color"
                />
              </div>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={massageLabPixelSnowHarmony}
                  onChange={(event) => handleSettingsChange({
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
              value={massageLabPixelSnowVariant}
              onChange={(event) => handleSettingsChange({
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
            <span>Flake size ({massageLabPixelSnowFlakeSize.toFixed(3)})</span>
            <input
              type="range"
              min="0.001"
              max="0.08"
              step="0.001"
              value={massageLabPixelSnowFlakeSize}
              onChange={(event) => handleSettingsChange({ massageLabPixelSnowFlakeSize: Number(event.target.value) })}
              aria-label="MassageLab Pixel Snow flake size"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Minimum flake ({massageLabPixelSnowMinFlakeSize.toFixed(2)})</span>
            <input
              type="range"
              min="0.1"
              max="6"
              step="0.05"
              value={massageLabPixelSnowMinFlakeSize}
              onChange={(event) => handleSettingsChange({ massageLabPixelSnowMinFlakeSize: Number(event.target.value) })}
              aria-label="MassageLab Pixel Snow minimum flake size"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Pixel resolution ({massageLabPixelSnowPixelResolution.toFixed(0)})</span>
            <input
              type="range"
              min="40"
              max="640"
              step="10"
              value={massageLabPixelSnowPixelResolution}
              onChange={(event) => handleSettingsChange({ massageLabPixelSnowPixelResolution: Number(event.target.value) })}
              aria-label="MassageLab Pixel Snow pixel resolution"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Speed ({massageLabPixelSnowSpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0"
              max="5"
              step="0.05"
              value={massageLabPixelSnowSpeed}
              onChange={(event) => handleSettingsChange({ massageLabPixelSnowSpeed: Number(event.target.value) })}
              aria-label="MassageLab Pixel Snow speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Depth fade ({massageLabPixelSnowDepthFade.toFixed(1)})</span>
            <input
              type="range"
              min="1"
              max="40"
              step="0.5"
              value={massageLabPixelSnowDepthFade}
              onChange={(event) => handleSettingsChange({ massageLabPixelSnowDepthFade: Number(event.target.value) })}
              aria-label="MassageLab Pixel Snow depth fade"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Far plane ({massageLabPixelSnowFarPlane.toFixed(0)})</span>
            <input
              type="range"
              min="4"
              max="80"
              step="1"
              value={massageLabPixelSnowFarPlane}
              onChange={(event) => handleSettingsChange({ massageLabPixelSnowFarPlane: Number(event.target.value) })}
              aria-label="MassageLab Pixel Snow far plane"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Brightness ({massageLabPixelSnowBrightness.toFixed(2)})</span>
            <input
              type="range"
              min="0.1"
              max="4"
              step="0.05"
              value={massageLabPixelSnowBrightness}
              onChange={(event) => handleSettingsChange({ massageLabPixelSnowBrightness: Number(event.target.value) })}
              aria-label="MassageLab Pixel Snow brightness"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Gamma ({massageLabPixelSnowGamma.toFixed(3)})</span>
            <input
              type="range"
              min="0.1"
              max="2"
              step="0.01"
              value={massageLabPixelSnowGamma}
              onChange={(event) => handleSettingsChange({ massageLabPixelSnowGamma: Number(event.target.value) })}
              aria-label="MassageLab Pixel Snow gamma"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Density ({massageLabPixelSnowDensity.toFixed(2)})</span>
            <input
              type="range"
              min="0.02"
              max="1"
              step="0.01"
              value={massageLabPixelSnowDensity}
              onChange={(event) => handleSettingsChange({ massageLabPixelSnowDensity: Number(event.target.value) })}
              aria-label="MassageLab Pixel Snow density"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Direction ({massageLabPixelSnowDirection.toFixed(0)}deg)</span>
            <input
              type="range"
              min="0"
              max="360"
              step="1"
              value={massageLabPixelSnowDirection}
              onChange={(event) => handleSettingsChange({ massageLabPixelSnowDirection: Number(event.target.value) })}
              aria-label="MassageLab Pixel Snow direction"
            />
          </label>
        </>
      )}

      {option.id === "massage-lab-lightning" && (
        <>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={massageLabLightningPaletteMode}
              onChange={(event) => handleSettingsChange({
                massageLabLightningPaletteMode: event.target.value as MassageLabLightningPaletteMode,
              })}
              aria-label="MassageLab Lightning color mode"
            >
              <option value="source">Source hue</option>
              <option value="custom">Custom color</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {massageLabLightningPaletteMode === "source" ? (
            <label className={styles.rangeRow}>
              <span>Hue ({massageLabLightningHue.toFixed(0)}deg)</span>
              <input
                type="range"
                min="0"
                max="360"
                step="1"
                value={massageLabLightningHue}
                onChange={(event) => handleSettingsChange({ massageLabLightningHue: Number(event.target.value) })}
                aria-label="MassageLab Lightning hue"
              />
            </label>
          ) : null}

          {massageLabLightningPaletteMode === "custom" ? (
            <div className={styles.colorRow}>
              <span>Lightning color</span>
              <ColorPickerInput
                value={massageLabLightningColor}
                onValueChange={(nextColor) => handleSettingsChange({ massageLabLightningColor: nextColor })}
                label="MassageLab Lightning color"
              />
            </div>
          ) : null}

          {massageLabLightningPaletteMode === "harmony" ? (
            <>
              <div className={styles.colorRow}>
                <span>Primary color</span>
                <ColorPickerInput
                  value={massageLabLightningPrimaryColor}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabLightningPrimaryColor: nextColor })}
                  label="MassageLab Lightning primary color"
                />
              </div>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={massageLabLightningHarmony}
                  onChange={(event) => handleSettingsChange({
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
            <span>X offset ({massageLabLightningXOffset.toFixed(2)})</span>
            <input
              type="range"
              min="-2"
              max="2"
              step="0.05"
              value={massageLabLightningXOffset}
              onChange={(event) => handleSettingsChange({ massageLabLightningXOffset: Number(event.target.value) })}
              aria-label="MassageLab Lightning X offset"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Speed ({massageLabLightningSpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0"
              max="5"
              step="0.05"
              value={massageLabLightningSpeed}
              onChange={(event) => handleSettingsChange({ massageLabLightningSpeed: Number(event.target.value) })}
              aria-label="MassageLab Lightning speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Intensity ({massageLabLightningIntensity.toFixed(2)})</span>
            <input
              type="range"
              min="0.1"
              max="5"
              step="0.05"
              value={massageLabLightningIntensity}
              onChange={(event) => handleSettingsChange({ massageLabLightningIntensity: Number(event.target.value) })}
              aria-label="MassageLab Lightning intensity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Size ({massageLabLightningSize.toFixed(2)})</span>
            <input
              type="range"
              min="0.2"
              max="5"
              step="0.05"
              value={massageLabLightningSize}
              onChange={(event) => handleSettingsChange({ massageLabLightningSize: Number(event.target.value) })}
              aria-label="MassageLab Lightning size"
            />
          </label>
        </>
      )}

      {option.id === "massage-lab-prismatic-burst" && (
        <>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={massageLabPrismaticBurstPaletteMode}
              onChange={(event) => handleSettingsChange({
                massageLabPrismaticBurstPaletteMode: event.target.value as MassageLabPrismaticBurstPaletteMode,
              })}
              aria-label="MassageLab Prismatic Burst color mode"
            >
              <option value="source">Source spectrum</option>
              <option value="custom">Custom gradient</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {massageLabPrismaticBurstPaletteMode === "custom" ? (
            <>
              <div className={styles.colorRow}>
                <span>Color 1</span>
                <ColorPickerInput
                  value={massageLabPrismaticBurstColorOne}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabPrismaticBurstColorOne: nextColor })}
                  label="MassageLab Prismatic Burst color 1"
                />
              </div>
              <div className={styles.colorRow}>
                <span>Color 2</span>
                <ColorPickerInput
                  value={massageLabPrismaticBurstColorTwo}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabPrismaticBurstColorTwo: nextColor })}
                  label="MassageLab Prismatic Burst color 2"
                />
              </div>
              <div className={styles.colorRow}>
                <span>Color 3</span>
                <ColorPickerInput
                  value={massageLabPrismaticBurstColorThree}
                  onValueChange={(nextColor) => handleSettingsChange({
                    massageLabPrismaticBurstColorThree: nextColor,
                  })}
                  label="MassageLab Prismatic Burst color 3"
                />
              </div>
              <div className={styles.colorRow}>
                <span>Color 4</span>
                <ColorPickerInput
                  value={massageLabPrismaticBurstColorFour}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabPrismaticBurstColorFour: nextColor })}
                  label="MassageLab Prismatic Burst color 4"
                />
              </div>
            </>
          ) : null}

          {massageLabPrismaticBurstPaletteMode === "harmony" ? (
            <>
              <div className={styles.colorRow}>
                <span>Primary color</span>
                <ColorPickerInput
                  value={massageLabPrismaticBurstPrimaryColor}
                  onValueChange={(nextColor) => handleSettingsChange({
                    massageLabPrismaticBurstPrimaryColor: nextColor,
                  })}
                  label="MassageLab Prismatic Burst primary color"
                />
              </div>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={massageLabPrismaticBurstHarmony}
                  onChange={(event) => handleSettingsChange({
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
              value={massageLabPrismaticBurstAnimationType}
              onChange={(event) => handleSettingsChange({
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
              value={massageLabPrismaticBurstMixBlendMode}
              onChange={(event) => handleSettingsChange({
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
            <span>Intensity ({massageLabPrismaticBurstIntensity.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="5"
              step="0.05"
              value={massageLabPrismaticBurstIntensity}
              onChange={(event) => handleSettingsChange({
                massageLabPrismaticBurstIntensity: Number(event.target.value),
              })}
              aria-label="MassageLab Prismatic Burst intensity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Speed ({massageLabPrismaticBurstSpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={massageLabPrismaticBurstSpeed}
              onChange={(event) => handleSettingsChange({ massageLabPrismaticBurstSpeed: Number(event.target.value) })}
              aria-label="MassageLab Prismatic Burst speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Distortion ({massageLabPrismaticBurstDistort.toFixed(1)})</span>
            <input
              type="range"
              min="0"
              max="50"
              step="0.5"
              value={massageLabPrismaticBurstDistort}
              onChange={(event) => handleSettingsChange({
                massageLabPrismaticBurstDistort: Number(event.target.value),
              })}
              aria-label="MassageLab Prismatic Burst distortion"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Offset X ({massageLabPrismaticBurstOffsetX.toFixed(0)}px)</span>
            <input
              type="range"
              min="-1000"
              max="1000"
              step="10"
              value={massageLabPrismaticBurstOffsetX}
              onChange={(event) => handleSettingsChange({ massageLabPrismaticBurstOffsetX: Number(event.target.value) })}
              aria-label="MassageLab Prismatic Burst offset X"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Offset Y ({massageLabPrismaticBurstOffsetY.toFixed(0)}px)</span>
            <input
              type="range"
              min="-1000"
              max="1000"
              step="10"
              value={massageLabPrismaticBurstOffsetY}
              onChange={(event) => handleSettingsChange({ massageLabPrismaticBurstOffsetY: Number(event.target.value) })}
              aria-label="MassageLab Prismatic Burst offset Y"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Hover damping ({massageLabPrismaticBurstHoverDampness.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={massageLabPrismaticBurstHoverDampness}
              onChange={(event) => handleSettingsChange({
                massageLabPrismaticBurstHoverDampness: Number(event.target.value),
              })}
              aria-label="MassageLab Prismatic Burst hover damping"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Ray count ({massageLabPrismaticBurstRayCount.toFixed(0)})</span>
            <input
              type="range"
              min="0"
              max="64"
              step="1"
              value={massageLabPrismaticBurstRayCount}
              onChange={(event) => handleSettingsChange({ massageLabPrismaticBurstRayCount: Number(event.target.value) })}
              aria-label="MassageLab Prismatic Burst ray count"
            />
          </label>
        </>
      )}

      {option.id === "massage-lab-galaxy" && (
        <>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={massageLabGalaxyPaletteMode}
              onChange={(event) => handleSettingsChange({
                massageLabGalaxyPaletteMode: event.target.value as MassageLabGalaxyPaletteMode,
              })}
              aria-label="MassageLab Galaxy color mode"
            >
              <option value="source">Source hue shift</option>
              <option value="custom">Custom color</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {massageLabGalaxyPaletteMode === "source" ? (
            <label className={styles.rangeRow}>
              <span>Hue shift ({massageLabGalaxyHueShift.toFixed(0)}deg)</span>
              <input
                type="range"
                min="0"
                max="360"
                step="1"
                value={massageLabGalaxyHueShift}
                onChange={(event) => handleSettingsChange({ massageLabGalaxyHueShift: Number(event.target.value) })}
                aria-label="MassageLab Galaxy hue shift"
              />
            </label>
          ) : null}

          {massageLabGalaxyPaletteMode === "custom" ? (
            <div className={styles.colorRow}>
              <span>Galaxy color</span>
              <ColorPickerInput
                value={massageLabGalaxyColor}
                onValueChange={(nextColor) => handleSettingsChange({ massageLabGalaxyColor: nextColor })}
                label="MassageLab Galaxy color"
              />
            </div>
          ) : null}

          {massageLabGalaxyPaletteMode === "harmony" ? (
            <>
              <div className={styles.colorRow}>
                <span>Primary color</span>
                <ColorPickerInput
                  value={massageLabGalaxyPrimaryColor}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabGalaxyPrimaryColor: nextColor })}
                  label="MassageLab Galaxy primary color"
                />
              </div>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={massageLabGalaxyHarmony}
                  onChange={(event) => handleSettingsChange({
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
              checked={massageLabGalaxyTransparent}
              onChange={(event) => handleSettingsChange({ massageLabGalaxyTransparent: event.target.checked })}
              aria-label="MassageLab Galaxy transparent background"
            />
            <span>Transparent background</span>
          </label>

          <label className={styles.selectRow}>
            <input
              type="checkbox"
              checked={massageLabGalaxyMouseInteraction}
              onChange={(event) => handleSettingsChange({ massageLabGalaxyMouseInteraction: event.target.checked })}
              aria-label="MassageLab Galaxy cursor interaction"
            />
            <span>Cursor interaction</span>
          </label>

          <label className={styles.selectRow}>
            <input
              type="checkbox"
              checked={massageLabGalaxyMouseRepulsion}
              onChange={(event) => handleSettingsChange({ massageLabGalaxyMouseRepulsion: event.target.checked })}
              aria-label="MassageLab Galaxy cursor repulsion"
            />
            <span>Cursor repulsion</span>
          </label>

          <label className={styles.rangeRow}>
            <span>Focal X ({massageLabGalaxyFocalX.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={massageLabGalaxyFocalX}
              onChange={(event) => handleSettingsChange({ massageLabGalaxyFocalX: Number(event.target.value) })}
              aria-label="MassageLab Galaxy focal X"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Focal Y ({massageLabGalaxyFocalY.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={massageLabGalaxyFocalY}
              onChange={(event) => handleSettingsChange({ massageLabGalaxyFocalY: Number(event.target.value) })}
              aria-label="MassageLab Galaxy focal Y"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Rotation ({massageLabGalaxyRotationDeg.toFixed(0)}deg)</span>
            <input
              type="range"
              min="-360"
              max="360"
              step="1"
              value={massageLabGalaxyRotationDeg}
              onChange={(event) => handleSettingsChange({ massageLabGalaxyRotationDeg: Number(event.target.value) })}
              aria-label="MassageLab Galaxy rotation"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Star speed ({massageLabGalaxyStarSpeed.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="5"
              step="0.05"
              value={massageLabGalaxyStarSpeed}
              onChange={(event) => handleSettingsChange({ massageLabGalaxyStarSpeed: Number(event.target.value) })}
              aria-label="MassageLab Galaxy star speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Density ({massageLabGalaxyDensity.toFixed(2)})</span>
            <input
              type="range"
              min="0.1"
              max="3"
              step="0.05"
              value={massageLabGalaxyDensity}
              onChange={(event) => handleSettingsChange({ massageLabGalaxyDensity: Number(event.target.value) })}
              aria-label="MassageLab Galaxy density"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Speed ({massageLabGalaxySpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0"
              max="5"
              step="0.05"
              value={massageLabGalaxySpeed}
              onChange={(event) => handleSettingsChange({ massageLabGalaxySpeed: Number(event.target.value) })}
              aria-label="MassageLab Galaxy speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Glow ({massageLabGalaxyGlowIntensity.toFixed(2)})</span>
            <input
              type="range"
              min="0.01"
              max="2"
              step="0.01"
              value={massageLabGalaxyGlowIntensity}
              onChange={(event) => handleSettingsChange({ massageLabGalaxyGlowIntensity: Number(event.target.value) })}
              aria-label="MassageLab Galaxy glow intensity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Saturation ({massageLabGalaxySaturation.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.01"
              value={massageLabGalaxySaturation}
              onChange={(event) => handleSettingsChange({ massageLabGalaxySaturation: Number(event.target.value) })}
              aria-label="MassageLab Galaxy saturation"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Twinkle ({massageLabGalaxyTwinkleIntensity.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={massageLabGalaxyTwinkleIntensity}
              onChange={(event) => handleSettingsChange({ massageLabGalaxyTwinkleIntensity: Number(event.target.value) })}
              aria-label="MassageLab Galaxy twinkle intensity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Rotation speed ({massageLabGalaxyRotationSpeed.toFixed(2)})</span>
            <input
              type="range"
              min="-2"
              max="2"
              step="0.01"
              value={massageLabGalaxyRotationSpeed}
              onChange={(event) => handleSettingsChange({ massageLabGalaxyRotationSpeed: Number(event.target.value) })}
              aria-label="MassageLab Galaxy rotation speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Repulsion ({massageLabGalaxyRepulsionStrength.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="6"
              step="0.05"
              value={massageLabGalaxyRepulsionStrength}
              onChange={(event) => handleSettingsChange({ massageLabGalaxyRepulsionStrength: Number(event.target.value) })}
              aria-label="MassageLab Galaxy repulsion strength"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Center repulsion ({massageLabGalaxyAutoCenterRepulsion.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="6"
              step="0.05"
              value={massageLabGalaxyAutoCenterRepulsion}
              onChange={(event) => handleSettingsChange({
                massageLabGalaxyAutoCenterRepulsion: Number(event.target.value),
              })}
              aria-label="MassageLab Galaxy center repulsion"
            />
          </label>
        </>
      )}

      {option.id === "massage-lab-dither" && (
        <>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={massageLabDitherPaletteMode}
              onChange={(event) => handleSettingsChange({
                massageLabDitherPaletteMode: event.target.value as MassageLabDitherPaletteMode,
              })}
              aria-label="MassageLab Dither color mode"
            >
              <option value="source">Source grey</option>
              <option value="custom">Custom color</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {massageLabDitherPaletteMode === "custom" ? (
            <div className={styles.colorRow}>
              <span>Dither color</span>
              <ColorPickerInput
                value={massageLabDitherColor}
                onValueChange={(nextColor) => handleSettingsChange({ massageLabDitherColor: nextColor })}
                label="MassageLab Dither color"
              />
            </div>
          ) : null}

          {massageLabDitherPaletteMode === "harmony" ? (
            <>
              <div className={styles.colorRow}>
                <span>Primary color</span>
                <ColorPickerInput
                  value={massageLabDitherPrimaryColor}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabDitherPrimaryColor: nextColor })}
                  label="MassageLab Dither primary color"
                />
              </div>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={massageLabDitherHarmony}
                  onChange={(event) => handleSettingsChange({
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
              checked={massageLabDitherMouseInteraction}
              onChange={(event) => handleSettingsChange({ massageLabDitherMouseInteraction: event.target.checked })}
              aria-label="MassageLab Dither cursor interaction"
            />
            <span>Cursor interaction</span>
          </label>

          <label className={styles.rangeRow}>
            <span>Wave speed ({massageLabDitherWaveSpeed.toFixed(3)})</span>
            <input
              type="range"
              min="0"
              max="0.5"
              step="0.005"
              value={massageLabDitherWaveSpeed}
              onChange={(event) => handleSettingsChange({ massageLabDitherWaveSpeed: Number(event.target.value) })}
              aria-label="MassageLab Dither wave speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Wave frequency ({massageLabDitherWaveFrequency.toFixed(1)})</span>
            <input
              type="range"
              min="0.5"
              max="8"
              step="0.1"
              value={massageLabDitherWaveFrequency}
              onChange={(event) => handleSettingsChange({ massageLabDitherWaveFrequency: Number(event.target.value) })}
              aria-label="MassageLab Dither wave frequency"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Wave amplitude ({massageLabDitherWaveAmplitude.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={massageLabDitherWaveAmplitude}
              onChange={(event) => handleSettingsChange({ massageLabDitherWaveAmplitude: Number(event.target.value) })}
              aria-label="MassageLab Dither wave amplitude"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Color count ({massageLabDitherColorNum})</span>
            <input
              type="range"
              min="2"
              max="16"
              step="1"
              value={massageLabDitherColorNum}
              onChange={(event) => handleSettingsChange({ massageLabDitherColorNum: Number(event.target.value) })}
              aria-label="MassageLab Dither color count"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Pixel size ({massageLabDitherPixelSize}px)</span>
            <input
              type="range"
              min="1"
              max="24"
              step="1"
              value={massageLabDitherPixelSize}
              onChange={(event) => handleSettingsChange({ massageLabDitherPixelSize: Number(event.target.value) })}
              aria-label="MassageLab Dither pixel size"
            />
          </label>

          {massageLabDitherMouseInteraction ? (
            <label className={styles.rangeRow}>
              <span>Cursor radius ({massageLabDitherMouseRadius.toFixed(2)})</span>
              <input
                type="range"
                min="0.05"
                max="3"
                step="0.05"
                value={massageLabDitherMouseRadius}
                onChange={(event) => handleSettingsChange({ massageLabDitherMouseRadius: Number(event.target.value) })}
                aria-label="MassageLab Dither cursor radius"
              />
            </label>
          ) : null}
        </>
      )}

      {option.id === "massage-lab-faulty-terminal" && (
        <>
          <label className={styles.selectRow}>
            <span>Tint mode</span>
            <select
              value={massageLabFaultyTerminalPaletteMode}
              onChange={(event) => handleSettingsChange({
                massageLabFaultyTerminalPaletteMode: event.target.value as MassageLabFaultyTerminalPaletteMode,
              })}
              aria-label="MassageLab Faulty Terminal tint mode"
            >
              <option value="source">Source white</option>
              <option value="custom">Custom tint</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {massageLabFaultyTerminalPaletteMode === "custom" ? (
            <div className={styles.colorRow}>
              <span>Terminal tint</span>
              <ColorPickerInput
                value={massageLabFaultyTerminalTint}
                onValueChange={(nextColor) => handleSettingsChange({ massageLabFaultyTerminalTint: nextColor })}
                label="MassageLab Faulty Terminal tint"
              />
            </div>
          ) : null}

          {massageLabFaultyTerminalPaletteMode === "harmony" ? (
            <>
              <div className={styles.colorRow}>
                <span>Primary color</span>
                <ColorPickerInput
                  value={massageLabFaultyTerminalPrimaryColor}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabFaultyTerminalPrimaryColor: nextColor })}
                  label="MassageLab Faulty Terminal primary color"
                />
              </div>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={massageLabFaultyTerminalHarmony}
                  onChange={(event) => handleSettingsChange({
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
              checked={massageLabFaultyTerminalMouseReact}
              onChange={(event) => handleSettingsChange({ massageLabFaultyTerminalMouseReact: event.target.checked })}
              aria-label="MassageLab Faulty Terminal cursor reaction"
            />
            <span>Cursor reaction</span>
          </label>

          <label className={styles.selectRow}>
            <input
              type="checkbox"
              checked={massageLabFaultyTerminalPageLoadAnimation}
              onChange={(event) => handleSettingsChange({
                massageLabFaultyTerminalPageLoadAnimation: event.target.checked,
              })}
              aria-label="MassageLab Faulty Terminal page-load animation"
            />
            <span>Page-load animation</span>
          </label>

          <label className={styles.rangeRow}>
            <span>Scale ({massageLabFaultyTerminalScale.toFixed(2)})</span>
            <input
              type="range"
              min="0.25"
              max="4"
              step="0.05"
              value={massageLabFaultyTerminalScale}
              onChange={(event) => handleSettingsChange({ massageLabFaultyTerminalScale: Number(event.target.value) })}
              aria-label="MassageLab Faulty Terminal scale"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Grid X ({massageLabFaultyTerminalGridMulX.toFixed(2)})</span>
            <input
              type="range"
              min="0.25"
              max="6"
              step="0.05"
              value={massageLabFaultyTerminalGridMulX}
              onChange={(event) => handleSettingsChange({ massageLabFaultyTerminalGridMulX: Number(event.target.value) })}
              aria-label="MassageLab Faulty Terminal grid X multiplier"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Grid Y ({massageLabFaultyTerminalGridMulY.toFixed(2)})</span>
            <input
              type="range"
              min="0.25"
              max="6"
              step="0.05"
              value={massageLabFaultyTerminalGridMulY}
              onChange={(event) => handleSettingsChange({ massageLabFaultyTerminalGridMulY: Number(event.target.value) })}
              aria-label="MassageLab Faulty Terminal grid Y multiplier"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Digit size ({massageLabFaultyTerminalDigitSize.toFixed(2)})</span>
            <input
              type="range"
              min="0.5"
              max="4"
              step="0.05"
              value={massageLabFaultyTerminalDigitSize}
              onChange={(event) => handleSettingsChange({ massageLabFaultyTerminalDigitSize: Number(event.target.value) })}
              aria-label="MassageLab Faulty Terminal digit size"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Time scale ({massageLabFaultyTerminalTimeScale.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.01"
              value={massageLabFaultyTerminalTimeScale}
              onChange={(event) => handleSettingsChange({ massageLabFaultyTerminalTimeScale: Number(event.target.value) })}
              aria-label="MassageLab Faulty Terminal time scale"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Scanlines ({massageLabFaultyTerminalScanlineIntensity.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.01"
              value={massageLabFaultyTerminalScanlineIntensity}
              onChange={(event) => handleSettingsChange({
                massageLabFaultyTerminalScanlineIntensity: Number(event.target.value),
              })}
              aria-label="MassageLab Faulty Terminal scanline intensity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Glitch ({massageLabFaultyTerminalGlitchAmount.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.01"
              value={massageLabFaultyTerminalGlitchAmount}
              onChange={(event) => handleSettingsChange({
                massageLabFaultyTerminalGlitchAmount: Number(event.target.value),
              })}
              aria-label="MassageLab Faulty Terminal glitch amount"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Flicker ({massageLabFaultyTerminalFlickerAmount.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.01"
              value={massageLabFaultyTerminalFlickerAmount}
              onChange={(event) => handleSettingsChange({
                massageLabFaultyTerminalFlickerAmount: Number(event.target.value),
              })}
              aria-label="MassageLab Faulty Terminal flicker amount"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Noise ({massageLabFaultyTerminalNoiseAmp.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.01"
              value={massageLabFaultyTerminalNoiseAmp}
              onChange={(event) => handleSettingsChange({ massageLabFaultyTerminalNoiseAmp: Number(event.target.value) })}
              aria-label="MassageLab Faulty Terminal noise amplitude"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Chromatic ({massageLabFaultyTerminalChromaticAberration.toFixed(1)})</span>
            <input
              type="range"
              min="0"
              max="8"
              step="0.1"
              value={massageLabFaultyTerminalChromaticAberration}
              onChange={(event) => handleSettingsChange({
                massageLabFaultyTerminalChromaticAberration: Number(event.target.value),
              })}
              aria-label="MassageLab Faulty Terminal chromatic aberration"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Dither ({massageLabFaultyTerminalDither.toFixed(0)})</span>
            <input
              type="range"
              min="0"
              max="255"
              step="1"
              value={massageLabFaultyTerminalDither}
              onChange={(event) => handleSettingsChange({ massageLabFaultyTerminalDither: Number(event.target.value) })}
              aria-label="MassageLab Faulty Terminal dither"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Curvature ({massageLabFaultyTerminalCurvature.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={massageLabFaultyTerminalCurvature}
              onChange={(event) => handleSettingsChange({ massageLabFaultyTerminalCurvature: Number(event.target.value) })}
              aria-label="MassageLab Faulty Terminal curvature"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Brightness ({massageLabFaultyTerminalBrightness.toFixed(2)})</span>
            <input
              type="range"
              min="0.1"
              max="3"
              step="0.01"
              value={massageLabFaultyTerminalBrightness}
              onChange={(event) => handleSettingsChange({ massageLabFaultyTerminalBrightness: Number(event.target.value) })}
              aria-label="MassageLab Faulty Terminal brightness"
            />
          </label>

          {massageLabFaultyTerminalMouseReact ? (
            <label className={styles.rangeRow}>
              <span>Cursor strength ({massageLabFaultyTerminalMouseStrength.toFixed(2)})</span>
              <input
                type="range"
                min="0"
                max="2"
                step="0.01"
                value={massageLabFaultyTerminalMouseStrength}
                onChange={(event) => handleSettingsChange({
                  massageLabFaultyTerminalMouseStrength: Number(event.target.value),
                })}
                aria-label="MassageLab Faulty Terminal cursor strength"
              />
            </label>
          ) : null}
        </>
      )}

      {option.id === "massage-lab-ripple-grid" && (
        <>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={massageLabRippleGridPaletteMode}
              onChange={(event) => handleSettingsChange({
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

          {massageLabRippleGridPaletteMode === "custom" ? (
            <div className={styles.colorRow}>
              <span>Grid color</span>
              <ColorPickerInput
                value={massageLabRippleGridColor}
                onValueChange={(nextColor) => handleSettingsChange({ massageLabRippleGridColor: nextColor })}
                label="MassageLab Ripple Grid color"
              />
            </div>
          ) : null}

          {massageLabRippleGridPaletteMode === "harmony" ? (
            <>
              <div className={styles.colorRow}>
                <span>Primary color</span>
                <ColorPickerInput
                  value={massageLabRippleGridPrimaryColor}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabRippleGridPrimaryColor: nextColor })}
                  label="MassageLab Ripple Grid primary color"
                />
              </div>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={massageLabRippleGridHarmony}
                  onChange={(event) => handleSettingsChange({
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
              checked={massageLabRippleGridMouseInteraction}
              onChange={(event) => handleSettingsChange({ massageLabRippleGridMouseInteraction: event.target.checked })}
              aria-label="MassageLab Ripple Grid cursor interaction"
            />
            <span>Cursor interaction</span>
          </label>

          <label className={styles.rangeRow}>
            <span>Ripple ({massageLabRippleGridRippleIntensity.toFixed(3)})</span>
            <input
              type="range"
              min="0"
              max="0.3"
              step="0.005"
              value={massageLabRippleGridRippleIntensity}
              onChange={(event) => handleSettingsChange({
                massageLabRippleGridRippleIntensity: Number(event.target.value),
              })}
              aria-label="MassageLab Ripple Grid ripple intensity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Grid size ({massageLabRippleGridGridSize.toFixed(1)})</span>
            <input
              type="range"
              min="2"
              max="30"
              step="0.5"
              value={massageLabRippleGridGridSize}
              onChange={(event) => handleSettingsChange({ massageLabRippleGridGridSize: Number(event.target.value) })}
              aria-label="MassageLab Ripple Grid size"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Thickness ({massageLabRippleGridGridThickness.toFixed(1)})</span>
            <input
              type="range"
              min="1"
              max="50"
              step="0.5"
              value={massageLabRippleGridGridThickness}
              onChange={(event) => handleSettingsChange({ massageLabRippleGridGridThickness: Number(event.target.value) })}
              aria-label="MassageLab Ripple Grid thickness"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Fade ({massageLabRippleGridFadeDistance.toFixed(2)})</span>
            <input
              type="range"
              min="0.2"
              max="5"
              step="0.05"
              value={massageLabRippleGridFadeDistance}
              onChange={(event) => handleSettingsChange({ massageLabRippleGridFadeDistance: Number(event.target.value) })}
              aria-label="MassageLab Ripple Grid fade distance"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Vignette ({massageLabRippleGridVignetteStrength.toFixed(2)})</span>
            <input
              type="range"
              min="0.1"
              max="6"
              step="0.05"
              value={massageLabRippleGridVignetteStrength}
              onChange={(event) => handleSettingsChange({
                massageLabRippleGridVignetteStrength: Number(event.target.value),
              })}
              aria-label="MassageLab Ripple Grid vignette strength"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Glow ({massageLabRippleGridGlowIntensity.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={massageLabRippleGridGlowIntensity}
              onChange={(event) => handleSettingsChange({ massageLabRippleGridGlowIntensity: Number(event.target.value) })}
              aria-label="MassageLab Ripple Grid glow intensity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Opacity ({massageLabRippleGridOpacity.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={massageLabRippleGridOpacity}
              onChange={(event) => handleSettingsChange({ massageLabRippleGridOpacity: Number(event.target.value) })}
              aria-label="MassageLab Ripple Grid opacity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Rotation ({massageLabRippleGridGridRotation.toFixed(0)}deg)</span>
            <input
              type="range"
              min="-180"
              max="180"
              step="1"
              value={massageLabRippleGridGridRotation}
              onChange={(event) => handleSettingsChange({ massageLabRippleGridGridRotation: Number(event.target.value) })}
              aria-label="MassageLab Ripple Grid rotation"
            />
          </label>

          {massageLabRippleGridMouseInteraction ? (
            <label className={styles.rangeRow}>
              <span>Cursor radius ({massageLabRippleGridMouseInteractionRadius.toFixed(2)})</span>
              <input
                type="range"
                min="0.1"
                max="5"
                step="0.05"
                value={massageLabRippleGridMouseInteractionRadius}
                onChange={(event) => handleSettingsChange({
                  massageLabRippleGridMouseInteractionRadius: Number(event.target.value),
                })}
                aria-label="MassageLab Ripple Grid cursor radius"
              />
            </label>
          ) : null}
        </>
      )}

      {option.id === "massage-lab-dot-field" && (
        <>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={massageLabDotFieldPaletteMode}
              onChange={(event) => handleSettingsChange({
                massageLabDotFieldPaletteMode: event.target.value as MassageLabDotFieldPaletteMode,
              })}
              aria-label="MassageLab Dot Field color mode"
            >
              <option value="source">Source purple</option>
              <option value="custom">Custom colors</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {massageLabDotFieldPaletteMode === "custom" ? (
            <>
              <div className={styles.colorRow}>
                <span>Gradient start</span>
                <ColorPickerInput
                  value={massageLabDotFieldGradientFromColor}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabDotFieldGradientFromColor: nextColor })}
                  label="MassageLab Dot Field gradient start color"
                />
              </div>
              <div className={styles.colorRow}>
                <span>Gradient end</span>
                <ColorPickerInput
                  value={massageLabDotFieldGradientToColor}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabDotFieldGradientToColor: nextColor })}
                  label="MassageLab Dot Field gradient end color"
                />
              </div>
              <div className={styles.colorRow}>
                <span>Glow color</span>
                <ColorPickerInput
                  value={massageLabDotFieldGlowColor}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabDotFieldGlowColor: nextColor })}
                  label="MassageLab Dot Field glow color"
                />
              </div>
            </>
          ) : null}

          {massageLabDotFieldPaletteMode === "harmony" ? (
            <>
              <div className={styles.colorRow}>
                <span>Primary color</span>
                <ColorPickerInput
                  value={massageLabDotFieldPrimaryColor}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabDotFieldPrimaryColor: nextColor })}
                  label="MassageLab Dot Field primary color"
                />
              </div>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={massageLabDotFieldHarmony}
                  onChange={(event) => handleSettingsChange({
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

          {massageLabDotFieldPaletteMode !== "source" ? (
            <>
              <label className={styles.rangeRow}>
                <span>Start alpha ({massageLabDotFieldGradientFromAlpha.toFixed(2)})</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={massageLabDotFieldGradientFromAlpha}
                  onChange={(event) => handleSettingsChange({
                    massageLabDotFieldGradientFromAlpha: Number(event.target.value),
                  })}
                  aria-label="MassageLab Dot Field gradient start alpha"
                />
              </label>
              <label className={styles.rangeRow}>
                <span>End alpha ({massageLabDotFieldGradientToAlpha.toFixed(2)})</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={massageLabDotFieldGradientToAlpha}
                  onChange={(event) => handleSettingsChange({
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
              checked={massageLabDotFieldCursorInteraction}
              onChange={(event) => handleSettingsChange({ massageLabDotFieldCursorInteraction: event.target.checked })}
              aria-label="MassageLab Dot Field cursor interaction"
            />
          </label>

          <label className={styles.switchRow}>
            <span>Bulge mode</span>
            <input
              type="checkbox"
              checked={massageLabDotFieldBulgeOnly}
              onChange={(event) => handleSettingsChange({ massageLabDotFieldBulgeOnly: event.target.checked })}
              aria-label="MassageLab Dot Field bulge mode"
            />
          </label>

          <label className={styles.switchRow}>
            <span>Sparkle</span>
            <input
              type="checkbox"
              checked={massageLabDotFieldSparkle}
              onChange={(event) => handleSettingsChange({ massageLabDotFieldSparkle: event.target.checked })}
              aria-label="MassageLab Dot Field sparkle"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Dot radius ({massageLabDotFieldDotRadius.toFixed(1)})</span>
            <input
              type="range"
              min="0.5"
              max="8"
              step="0.1"
              value={massageLabDotFieldDotRadius}
              onChange={(event) => handleSettingsChange({ massageLabDotFieldDotRadius: Number(event.target.value) })}
              aria-label="MassageLab Dot Field dot radius"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Dot spacing ({massageLabDotFieldDotSpacing.toFixed(1)})</span>
            <input
              type="range"
              min="4"
              max="48"
              step="0.5"
              value={massageLabDotFieldDotSpacing}
              onChange={(event) => handleSettingsChange({ massageLabDotFieldDotSpacing: Number(event.target.value) })}
              aria-label="MassageLab Dot Field dot spacing"
            />
          </label>

          {massageLabDotFieldCursorInteraction ? (
            <>
              <label className={styles.rangeRow}>
                <span>Cursor radius ({massageLabDotFieldCursorRadius.toFixed(0)})</span>
                <input
                  type="range"
                  min="60"
                  max="900"
                  step="10"
                  value={massageLabDotFieldCursorRadius}
                  onChange={(event) => handleSettingsChange({ massageLabDotFieldCursorRadius: Number(event.target.value) })}
                  aria-label="MassageLab Dot Field cursor radius"
                />
              </label>
              <label className={styles.rangeRow}>
                <span>Cursor force ({massageLabDotFieldCursorForce.toFixed(2)})</span>
                <input
                  type="range"
                  min="0.01"
                  max="1"
                  step="0.01"
                  value={massageLabDotFieldCursorForce}
                  onChange={(event) => handleSettingsChange({ massageLabDotFieldCursorForce: Number(event.target.value) })}
                  aria-label="MassageLab Dot Field cursor force"
                />
              </label>
              <label className={styles.rangeRow}>
                <span>Bulge strength ({massageLabDotFieldBulgeStrength.toFixed(0)})</span>
                <input
                  type="range"
                  min="0"
                  max="160"
                  step="1"
                  value={massageLabDotFieldBulgeStrength}
                  onChange={(event) => handleSettingsChange({ massageLabDotFieldBulgeStrength: Number(event.target.value) })}
                  aria-label="MassageLab Dot Field bulge strength"
                />
              </label>
              <label className={styles.rangeRow}>
                <span>Glow radius ({massageLabDotFieldGlowRadius.toFixed(0)})</span>
                <input
                  type="range"
                  min="0"
                  max="360"
                  step="4"
                  value={massageLabDotFieldGlowRadius}
                  onChange={(event) => handleSettingsChange({ massageLabDotFieldGlowRadius: Number(event.target.value) })}
                  aria-label="MassageLab Dot Field glow radius"
                />
              </label>
            </>
          ) : null}

          <label className={styles.rangeRow}>
            <span>Wave ({massageLabDotFieldWaveAmplitude.toFixed(1)})</span>
            <input
              type="range"
              min="0"
              max="48"
              step="0.5"
              value={massageLabDotFieldWaveAmplitude}
              onChange={(event) => handleSettingsChange({ massageLabDotFieldWaveAmplitude: Number(event.target.value) })}
              aria-label="MassageLab Dot Field wave amplitude"
            />
          </label>
        </>
      )}

      {option.id === "massage-lab-dot-grid" && (
        <>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={massageLabDotGridPaletteMode}
              onChange={(event) => handleSettingsChange({
                massageLabDotGridPaletteMode: event.target.value as MassageLabDotGridPaletteMode,
              })}
              aria-label="MassageLab Dot Grid color mode"
            >
              <option value="source">Source violet</option>
              <option value="custom">Custom colors</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {massageLabDotGridPaletteMode === "custom" ? (
            <>
              <div className={styles.colorRow}>
                <span>Base color</span>
                <ColorPickerInput value={massageLabDotGridBaseColor} onValueChange={(nextColor) => handleSettingsChange({ massageLabDotGridBaseColor: nextColor })} label="MassageLab Dot Grid base color" />
              </div>
              <div className={styles.colorRow}>
                <span>Active color</span>
                <ColorPickerInput value={massageLabDotGridActiveColor} onValueChange={(nextColor) => handleSettingsChange({ massageLabDotGridActiveColor: nextColor })} label="MassageLab Dot Grid active color" />
              </div>
            </>
          ) : null}

          {massageLabDotGridPaletteMode === "harmony" ? (
            <>
              <div className={styles.colorRow}>
                <span>Primary color</span>
                <ColorPickerInput value={massageLabDotGridPrimaryColor} onValueChange={(nextColor) => handleSettingsChange({ massageLabDotGridPrimaryColor: nextColor })} label="MassageLab Dot Grid primary color" />
              </div>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select value={massageLabDotGridHarmony} onChange={(event) => handleSettingsChange({ massageLabDotGridHarmony: event.target.value as ColorHarmony })} aria-label="MassageLab Dot Grid color harmony">
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
            <input type="checkbox" checked={massageLabDotGridCursorInteraction} onChange={(event) => handleSettingsChange({ massageLabDotGridCursorInteraction: event.target.checked })} aria-label="MassageLab Dot Grid cursor interaction" />
          </label>
          <label className={styles.switchRow}>
            <span>Click shock</span>
            <input type="checkbox" checked={massageLabDotGridClickShock} onChange={(event) => handleSettingsChange({ massageLabDotGridClickShock: event.target.checked })} aria-label="MassageLab Dot Grid click shock" />
          </label>

          <label className={styles.rangeRow}><span>Dot size ({massageLabDotGridDotSize.toFixed(1)})</span><input type="range" min="2" max="40" step="0.5" value={massageLabDotGridDotSize} onChange={(event) => handleSettingsChange({ massageLabDotGridDotSize: Number(event.target.value) })} aria-label="MassageLab Dot Grid dot size" /></label>
          <label className={styles.rangeRow}><span>Gap ({massageLabDotGridGap.toFixed(1)})</span><input type="range" min="4" max="80" step="0.5" value={massageLabDotGridGap} onChange={(event) => handleSettingsChange({ massageLabDotGridGap: Number(event.target.value) })} aria-label="MassageLab Dot Grid gap" /></label>
          <label className={styles.rangeRow}><span>Proximity ({massageLabDotGridProximity.toFixed(0)})</span><input type="range" min="40" max="500" step="5" value={massageLabDotGridProximity} onChange={(event) => handleSettingsChange({ massageLabDotGridProximity: Number(event.target.value) })} aria-label="MassageLab Dot Grid proximity" /></label>
          <label className={styles.rangeRow}><span>Speed trigger ({massageLabDotGridSpeedTrigger.toFixed(0)})</span><input type="range" min="0" max="1000" step="10" value={massageLabDotGridSpeedTrigger} onChange={(event) => handleSettingsChange({ massageLabDotGridSpeedTrigger: Number(event.target.value) })} aria-label="MassageLab Dot Grid speed trigger" /></label>
          <label className={styles.rangeRow}><span>Shock radius ({massageLabDotGridShockRadius.toFixed(0)})</span><input type="range" min="40" max="700" step="10" value={massageLabDotGridShockRadius} onChange={(event) => handleSettingsChange({ massageLabDotGridShockRadius: Number(event.target.value) })} aria-label="MassageLab Dot Grid shock radius" /></label>
          <label className={styles.rangeRow}><span>Shock strength ({massageLabDotGridShockStrength.toFixed(1)})</span><input type="range" min="0" max="12" step="0.1" value={massageLabDotGridShockStrength} onChange={(event) => handleSettingsChange({ massageLabDotGridShockStrength: Number(event.target.value) })} aria-label="MassageLab Dot Grid shock strength" /></label>
          <label className={styles.rangeRow}><span>Max speed ({massageLabDotGridMaxSpeed.toFixed(0)})</span><input type="range" min="100" max="8000" step="100" value={massageLabDotGridMaxSpeed} onChange={(event) => handleSettingsChange({ massageLabDotGridMaxSpeed: Number(event.target.value) })} aria-label="MassageLab Dot Grid max speed" /></label>
          <label className={styles.rangeRow}><span>Resistance ({massageLabDotGridResistance.toFixed(0)})</span><input type="range" min="120" max="1600" step="20" value={massageLabDotGridResistance} onChange={(event) => handleSettingsChange({ massageLabDotGridResistance: Number(event.target.value) })} aria-label="MassageLab Dot Grid resistance" /></label>
          <label className={styles.rangeRow}><span>Return ({massageLabDotGridReturnDuration.toFixed(2)}s)</span><input type="range" min="0.1" max="4" step="0.05" value={massageLabDotGridReturnDuration} onChange={(event) => handleSettingsChange({ massageLabDotGridReturnDuration: Number(event.target.value) })} aria-label="MassageLab Dot Grid return duration" /></label>
        </>
      )}

      {option.id === "massage-lab-threads" && (
        <>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={massageLabThreadsPaletteMode}
              onChange={(event) => handleSettingsChange({
                massageLabThreadsPaletteMode: event.target.value as MassageLabThreadsPaletteMode,
              })}
              aria-label="MassageLab Threads color mode"
            >
              <option value="source">Source white</option>
              <option value="custom">Custom color</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {massageLabThreadsPaletteMode === "custom" ? (
            <div className={styles.colorRow}>
              <span>Thread color</span>
              <ColorPickerInput
                value={massageLabThreadsColor}
                onValueChange={(nextColor) => handleSettingsChange({ massageLabThreadsColor: nextColor })}
                label="MassageLab Threads color"
              />
            </div>
          ) : null}

          {massageLabThreadsPaletteMode === "harmony" ? (
            <>
              <div className={styles.colorRow}>
                <span>Primary color</span>
                <ColorPickerInput
                  value={massageLabThreadsPrimaryColor}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabThreadsPrimaryColor: nextColor })}
                  label="MassageLab Threads primary color"
                />
              </div>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={massageLabThreadsHarmony}
                  onChange={(event) => handleSettingsChange({
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
              checked={massageLabThreadsEnableMouseInteraction}
              onChange={(event) => handleSettingsChange({
                massageLabThreadsEnableMouseInteraction: event.target.checked,
              })}
              aria-label="MassageLab Threads mouse interaction"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Amplitude ({massageLabThreadsAmplitude.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={massageLabThreadsAmplitude}
              onChange={(event) => handleSettingsChange({ massageLabThreadsAmplitude: Number(event.target.value) })}
              aria-label="MassageLab Threads amplitude"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Distance ({massageLabThreadsDistance.toFixed(2)})</span>
            <input
              type="range"
              min="-1"
              max="1.5"
              step="0.05"
              value={massageLabThreadsDistance}
              onChange={(event) => handleSettingsChange({ massageLabThreadsDistance: Number(event.target.value) })}
              aria-label="MassageLab Threads distance"
            />
          </label>
        </>
      )}

      {option.id === "massage-lab-iridescence" && (
        <>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={massageLabIridescencePaletteMode}
              onChange={(event) => handleSettingsChange({
                massageLabIridescencePaletteMode: event.target.value as MassageLabIridescencePaletteMode,
              })}
              aria-label="MassageLab Iridescence color mode"
            >
              <option value="source">Source white</option>
              <option value="custom">Custom color</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {massageLabIridescencePaletteMode === "custom" ? (
            <div className={styles.colorRow}>
              <span>Tint color</span>
              <ColorPickerInput
                value={massageLabIridescenceColor}
                onValueChange={(nextColor) => handleSettingsChange({ massageLabIridescenceColor: nextColor })}
                label="MassageLab Iridescence tint color"
              />
            </div>
          ) : null}

          {massageLabIridescencePaletteMode === "harmony" ? (
            <>
              <div className={styles.colorRow}>
                <span>Primary color</span>
                <ColorPickerInput
                  value={massageLabIridescencePrimaryColor}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabIridescencePrimaryColor: nextColor })}
                  label="MassageLab Iridescence primary color"
                />
              </div>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={massageLabIridescenceHarmony}
                  onChange={(event) => handleSettingsChange({
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
              checked={massageLabIridescenceMouseReact}
              onChange={(event) => handleSettingsChange({
                massageLabIridescenceMouseReact: event.target.checked,
              })}
              aria-label="MassageLab Iridescence mouse reaction"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Speed ({massageLabIridescenceSpeed.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.05"
              value={massageLabIridescenceSpeed}
              onChange={(event) => handleSettingsChange({ massageLabIridescenceSpeed: Number(event.target.value) })}
              aria-label="MassageLab Iridescence speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Amplitude ({massageLabIridescenceAmplitude.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={massageLabIridescenceAmplitude}
              onChange={(event) => handleSettingsChange({ massageLabIridescenceAmplitude: Number(event.target.value) })}
              aria-label="MassageLab Iridescence amplitude"
            />
          </label>
        </>
      )}

      {option.id === "massage-lab-waves" && (
        <>
          <label className={styles.selectRow}>
            <span>Line color mode</span>
            <select
              value={massageLabWavesPaletteMode}
              onChange={(event) => handleSettingsChange({
                massageLabWavesPaletteMode: event.target.value as MassageLabWavesPaletteMode,
              })}
              aria-label="MassageLab Waves line color mode"
            >
              <option value="source">Source black</option>
              <option value="custom">Custom color</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {massageLabWavesPaletteMode === "custom" ? (
            <div className={styles.colorRow}>
              <span>Line color</span>
              <ColorPickerInput
                value={massageLabWavesLineColor}
                onValueChange={(nextColor) => handleSettingsChange({ massageLabWavesLineColor: nextColor })}
                label="MassageLab Waves line color"
              />
            </div>
          ) : null}

          {massageLabWavesPaletteMode === "harmony" ? (
            <>
              <div className={styles.colorRow}>
                <span>Primary color</span>
                <ColorPickerInput
                  value={massageLabWavesPrimaryColor}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabWavesPrimaryColor: nextColor })}
                  label="MassageLab Waves primary color"
                />
              </div>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={massageLabWavesHarmony}
                  onChange={(event) => handleSettingsChange({
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
              checked={massageLabWavesTransparentBackground}
              onChange={(event) => handleSettingsChange({
                massageLabWavesTransparentBackground: event.target.checked,
              })}
              aria-label="MassageLab Waves transparent background"
            />
          </label>

          {!massageLabWavesTransparentBackground ? (
            <div className={styles.colorRow}>
              <span>Background color</span>
              <ColorPickerInput
                value={massageLabWavesBackgroundColor}
                onValueChange={(nextColor) => handleSettingsChange({ massageLabWavesBackgroundColor: nextColor })}
                label="MassageLab Waves background color"
              />
            </div>
          ) : null}

          <label className={styles.switchRow}>
            <span>Cursor interaction</span>
            <input
              type="checkbox"
              checked={massageLabWavesCursorInteraction}
              onChange={(event) => handleSettingsChange({
                massageLabWavesCursorInteraction: event.target.checked,
              })}
              aria-label="MassageLab Waves cursor interaction"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Wave speed X ({massageLabWavesSpeedX.toFixed(4)})</span>
            <input
              type="range"
              min="0"
              max="0.05"
              step="0.0005"
              value={massageLabWavesSpeedX}
              onChange={(event) => handleSettingsChange({ massageLabWavesSpeedX: Number(event.target.value) })}
              aria-label="MassageLab Waves X speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Wave speed Y ({massageLabWavesSpeedY.toFixed(4)})</span>
            <input
              type="range"
              min="0"
              max="0.05"
              step="0.0005"
              value={massageLabWavesSpeedY}
              onChange={(event) => handleSettingsChange({ massageLabWavesSpeedY: Number(event.target.value) })}
              aria-label="MassageLab Waves Y speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Amplitude X ({massageLabWavesAmplitudeX.toFixed(0)})</span>
            <input
              type="range"
              min="0"
              max="96"
              step="1"
              value={massageLabWavesAmplitudeX}
              onChange={(event) => handleSettingsChange({ massageLabWavesAmplitudeX: Number(event.target.value) })}
              aria-label="MassageLab Waves X amplitude"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Amplitude Y ({massageLabWavesAmplitudeY.toFixed(0)})</span>
            <input
              type="range"
              min="0"
              max="96"
              step="1"
              value={massageLabWavesAmplitudeY}
              onChange={(event) => handleSettingsChange({ massageLabWavesAmplitudeY: Number(event.target.value) })}
              aria-label="MassageLab Waves Y amplitude"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Line gap X ({massageLabWavesGapX.toFixed(0)})</span>
            <input
              type="range"
              min="4"
              max="40"
              step="1"
              value={massageLabWavesGapX}
              onChange={(event) => handleSettingsChange({ massageLabWavesGapX: Number(event.target.value) })}
              aria-label="MassageLab Waves X gap"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Point gap Y ({massageLabWavesGapY.toFixed(0)})</span>
            <input
              type="range"
              min="8"
              max="96"
              step="1"
              value={massageLabWavesGapY}
              onChange={(event) => handleSettingsChange({ massageLabWavesGapY: Number(event.target.value) })}
              aria-label="MassageLab Waves Y gap"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Friction ({massageLabWavesFriction.toFixed(3)})</span>
            <input
              type="range"
              min="0.8"
              max="0.99"
              step="0.005"
              value={massageLabWavesFriction}
              onChange={(event) => handleSettingsChange({ massageLabWavesFriction: Number(event.target.value) })}
              aria-label="MassageLab Waves friction"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Tension ({massageLabWavesTension.toFixed(3)})</span>
            <input
              type="range"
              min="0.001"
              max="0.05"
              step="0.001"
              value={massageLabWavesTension}
              onChange={(event) => handleSettingsChange({ massageLabWavesTension: Number(event.target.value) })}
              aria-label="MassageLab Waves tension"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Cursor movement ({massageLabWavesMaxCursorMove.toFixed(0)})</span>
            <input
              type="range"
              min="0"
              max="240"
              step="5"
              value={massageLabWavesMaxCursorMove}
              onChange={(event) => handleSettingsChange({ massageLabWavesMaxCursorMove: Number(event.target.value) })}
              aria-label="MassageLab Waves max cursor movement"
            />
          </label>
        </>
      )}

      {option.id === "massage-lab-grid-distortion" && (
        <>
          <label className={styles.selectRow}>
            <span>Texture color mode</span>
            <select
              value={massageLabGridDistortionPaletteMode}
              onChange={(event) => handleSettingsChange({
                massageLabGridDistortionPaletteMode: event.target.value as MassageLabGridDistortionPaletteMode,
              })}
              aria-label="MassageLab Grid Distortion color mode"
            >
              <option value="source">Source generated texture</option>
              <option value="custom">Custom colors</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {massageLabGridDistortionPaletteMode === "custom" ? (
            <>
              <div className={styles.colorRow}>
                <span>Texture color 1</span>
                <ColorPickerInput
                  value={massageLabGridDistortionColorOne}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabGridDistortionColorOne: nextColor })}
                  label="MassageLab Grid Distortion texture color 1"
                />
              </div>
              <div className={styles.colorRow}>
                <span>Texture color 2</span>
                <ColorPickerInput
                  value={massageLabGridDistortionColorTwo}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabGridDistortionColorTwo: nextColor })}
                  label="MassageLab Grid Distortion texture color 2"
                />
              </div>
              <div className={styles.colorRow}>
                <span>Texture color 3</span>
                <ColorPickerInput
                  value={massageLabGridDistortionColorThree}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabGridDistortionColorThree: nextColor })}
                  label="MassageLab Grid Distortion texture color 3"
                />
              </div>
            </>
          ) : null}

          {massageLabGridDistortionPaletteMode === "harmony" ? (
            <>
              <div className={styles.colorRow}>
                <span>Primary color</span>
                <ColorPickerInput
                  value={massageLabGridDistortionPrimaryColor}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabGridDistortionPrimaryColor: nextColor })}
                  label="MassageLab Grid Distortion primary color"
                />
              </div>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={massageLabGridDistortionHarmony}
                  onChange={(event) => handleSettingsChange({
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
              checked={massageLabGridDistortionCursorInteraction}
              onChange={(event) => handleSettingsChange({
                massageLabGridDistortionCursorInteraction: event.target.checked,
              })}
              aria-label="MassageLab Grid Distortion cursor interaction"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Grid ({massageLabGridDistortionGrid.toFixed(0)})</span>
            <input
              type="range"
              min="4"
              max="40"
              step="1"
              value={massageLabGridDistortionGrid}
              onChange={(event) => handleSettingsChange({ massageLabGridDistortionGrid: Number(event.target.value) })}
              aria-label="MassageLab Grid Distortion grid"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Mouse radius ({massageLabGridDistortionMouse.toFixed(2)})</span>
            <input
              type="range"
              min="0.02"
              max="0.5"
              step="0.01"
              value={massageLabGridDistortionMouse}
              onChange={(event) => handleSettingsChange({ massageLabGridDistortionMouse: Number(event.target.value) })}
              aria-label="MassageLab Grid Distortion mouse radius"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Strength ({massageLabGridDistortionStrength.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="0.6"
              step="0.01"
              value={massageLabGridDistortionStrength}
              onChange={(event) => handleSettingsChange({ massageLabGridDistortionStrength: Number(event.target.value) })}
              aria-label="MassageLab Grid Distortion strength"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Relaxation ({massageLabGridDistortionRelaxation.toFixed(2)})</span>
            <input
              type="range"
              min="0.75"
              max="0.99"
              step="0.01"
              value={massageLabGridDistortionRelaxation}
              onChange={(event) => handleSettingsChange({ massageLabGridDistortionRelaxation: Number(event.target.value) })}
              aria-label="MassageLab Grid Distortion relaxation"
            />
          </label>
        </>
      )}

      {option.id === "massage-lab-orb" && (
        <>
          <label className={styles.selectRow}>
            <span>Orb color mode</span>
            <select
              value={massageLabOrbPaletteMode}
              onChange={(event) => handleSettingsChange({
                massageLabOrbPaletteMode: event.target.value as MassageLabOrbPaletteMode,
              })}
              aria-label="MassageLab Orb color mode"
            >
              <option value="source">Source hue</option>
              <option value="custom">Custom color</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {massageLabOrbPaletteMode === "source" ? (
            <label className={styles.rangeRow}>
              <span>Hue ({massageLabOrbHue.toFixed(0)})</span>
              <input
                type="range"
                min="0"
                max="360"
                step="1"
                value={massageLabOrbHue}
                onChange={(event) => handleSettingsChange({ massageLabOrbHue: Number(event.target.value) })}
                aria-label="MassageLab Orb hue"
              />
            </label>
          ) : null}

          {massageLabOrbPaletteMode === "custom" ? (
            <div className={styles.colorRow}>
              <span>Orb color</span>
              <ColorPickerInput
                value={massageLabOrbColor}
                onValueChange={(nextColor) => handleSettingsChange({ massageLabOrbColor: nextColor })}
                label="MassageLab Orb color"
              />
            </div>
          ) : null}

          {massageLabOrbPaletteMode === "harmony" ? (
            <>
              <div className={styles.colorRow}>
                <span>Primary color</span>
                <ColorPickerInput
                  value={massageLabOrbPrimaryColor}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabOrbPrimaryColor: nextColor })}
                  label="MassageLab Orb primary color"
                />
              </div>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={massageLabOrbHarmony}
                  onChange={(event) => handleSettingsChange({ massageLabOrbHarmony: event.target.value as ColorHarmony })}
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

          <div className={styles.colorRow}>
            <span>Background</span>
            <ColorPickerInput
              value={massageLabOrbBackgroundColor}
              onValueChange={(nextColor) => handleSettingsChange({ massageLabOrbBackgroundColor: nextColor })}
              label="MassageLab Orb background color"
            />
          </div>

          <label className={styles.switchRow}>
            <span>Cursor interaction</span>
            <input
              type="checkbox"
              checked={massageLabOrbCursorInteraction}
              onChange={(event) => handleSettingsChange({ massageLabOrbCursorInteraction: event.target.checked })}
              aria-label="MassageLab Orb cursor interaction"
            />
          </label>

          <label className={styles.switchRow}>
            <span>Rotate on hover</span>
            <input
              type="checkbox"
              checked={massageLabOrbRotateOnHover}
              onChange={(event) => handleSettingsChange({ massageLabOrbRotateOnHover: event.target.checked })}
              aria-label="MassageLab Orb rotate on hover"
            />
          </label>

          <label className={styles.switchRow}>
            <span>Force hover state</span>
            <input
              type="checkbox"
              checked={massageLabOrbForceHoverState}
              onChange={(event) => handleSettingsChange({ massageLabOrbForceHoverState: event.target.checked })}
              aria-label="MassageLab Orb force hover state"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Hover intensity ({massageLabOrbHoverIntensity.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={massageLabOrbHoverIntensity}
              onChange={(event) => handleSettingsChange({ massageLabOrbHoverIntensity: Number(event.target.value) })}
              aria-label="MassageLab Orb hover intensity"
            />
          </label>
        </>
      )}

      {option.id === "massage-lab-letter-glitch" && (
        <>
          <label className={styles.selectRow}>
            <span>Glitch color mode</span>
            <select
              value={massageLabLetterGlitchPaletteMode}
              onChange={(event) => handleSettingsChange({
                massageLabLetterGlitchPaletteMode: event.target.value as MassageLabLetterGlitchPaletteMode,
              })}
              aria-label="MassageLab Letter Glitch color mode"
            >
              <option value="source">Source colors</option>
              <option value="custom">Custom colors</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {massageLabLetterGlitchPaletteMode === "custom" ? (
            <>
              <div className={styles.colorRow}>
                <span>Color 1</span>
                <ColorPickerInput
                  value={massageLabLetterGlitchColorOne}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabLetterGlitchColorOne: nextColor })}
                  label="MassageLab Letter Glitch color 1"
                />
              </div>
              <div className={styles.colorRow}>
                <span>Color 2</span>
                <ColorPickerInput
                  value={massageLabLetterGlitchColorTwo}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabLetterGlitchColorTwo: nextColor })}
                  label="MassageLab Letter Glitch color 2"
                />
              </div>
              <div className={styles.colorRow}>
                <span>Color 3</span>
                <ColorPickerInput
                  value={massageLabLetterGlitchColorThree}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabLetterGlitchColorThree: nextColor })}
                  label="MassageLab Letter Glitch color 3"
                />
              </div>
            </>
          ) : null}

          {massageLabLetterGlitchPaletteMode === "harmony" ? (
            <>
              <div className={styles.colorRow}>
                <span>Primary color</span>
                <ColorPickerInput
                  value={massageLabLetterGlitchPrimaryColor}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabLetterGlitchPrimaryColor: nextColor })}
                  label="MassageLab Letter Glitch primary color"
                />
              </div>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={massageLabLetterGlitchHarmony}
                  onChange={(event) => handleSettingsChange({
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
              checked={massageLabLetterGlitchCenterVignette}
              onChange={(event) => handleSettingsChange({ massageLabLetterGlitchCenterVignette: event.target.checked })}
              aria-label="MassageLab Letter Glitch center vignette"
            />
          </label>

          <label className={styles.switchRow}>
            <span>Outer vignette</span>
            <input
              type="checkbox"
              checked={massageLabLetterGlitchOuterVignette}
              onChange={(event) => handleSettingsChange({ massageLabLetterGlitchOuterVignette: event.target.checked })}
              aria-label="MassageLab Letter Glitch outer vignette"
            />
          </label>

          <label className={styles.switchRow}>
            <span>Smooth colors</span>
            <input
              type="checkbox"
              checked={massageLabLetterGlitchSmooth}
              onChange={(event) => handleSettingsChange({ massageLabLetterGlitchSmooth: event.target.checked })}
              aria-label="MassageLab Letter Glitch smooth colors"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Glitch speed ({massageLabLetterGlitchGlitchSpeed.toFixed(0)} ms)</span>
            <input
              type="range"
              min="16"
              max="500"
              step="1"
              value={massageLabLetterGlitchGlitchSpeed}
              onChange={(event) => handleSettingsChange({ massageLabLetterGlitchGlitchSpeed: Number(event.target.value) })}
              aria-label="MassageLab Letter Glitch speed"
            />
          </label>
        </>
      )}

      {option.id === "massage-lab-grid-motion" && (
        <>
          <label className={styles.selectRow}>
            <span>Motion color mode</span>
            <select
              value={massageLabGridMotionPaletteMode}
              onChange={(event) => handleSettingsChange({
                massageLabGridMotionPaletteMode: event.target.value as MassageLabGridMotionPaletteMode,
              })}
              aria-label="MassageLab Grid Motion color mode"
            >
              <option value="source">Source colors</option>
              <option value="custom">Custom colors</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {massageLabGridMotionPaletteMode === "custom" ? (
            <>
              <div className={styles.colorRow}>
                <span>Gradient</span>
                <ColorPickerInput
                  value={massageLabGridMotionGradientColor}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabGridMotionGradientColor: nextColor })}
                  label="MassageLab Grid Motion gradient color"
                />
              </div>
              <div className={styles.colorRow}>
                <span>Tile</span>
                <ColorPickerInput
                  value={massageLabGridMotionTileColor}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabGridMotionTileColor: nextColor })}
                  label="MassageLab Grid Motion tile color"
                />
              </div>
              <div className={styles.colorRow}>
                <span>Text</span>
                <ColorPickerInput
                  value={massageLabGridMotionTextColor}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabGridMotionTextColor: nextColor })}
                  label="MassageLab Grid Motion text color"
                />
              </div>
            </>
          ) : null}

          {massageLabGridMotionPaletteMode === "harmony" ? (
            <>
              <div className={styles.colorRow}>
                <span>Primary color</span>
                <ColorPickerInput
                  value={massageLabGridMotionPrimaryColor}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabGridMotionPrimaryColor: nextColor })}
                  label="MassageLab Grid Motion primary color"
                />
              </div>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={massageLabGridMotionHarmony}
                  onChange={(event) => handleSettingsChange({
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
              checked={massageLabGridMotionCursorInteraction}
              onChange={(event) => handleSettingsChange({ massageLabGridMotionCursorInteraction: event.target.checked })}
              aria-label="MassageLab Grid Motion cursor interaction"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Row travel ({massageLabGridMotionMaxMoveAmount.toFixed(0)})</span>
            <input
              type="range"
              min="0"
              max="600"
              step="10"
              value={massageLabGridMotionMaxMoveAmount}
              onChange={(event) => handleSettingsChange({ massageLabGridMotionMaxMoveAmount: Number(event.target.value) })}
              aria-label="MassageLab Grid Motion row travel"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Ease duration ({massageLabGridMotionBaseDuration.toFixed(2)}s)</span>
            <input
              type="range"
              min="0.1"
              max="2"
              step="0.05"
              value={massageLabGridMotionBaseDuration}
              onChange={(event) => handleSettingsChange({ massageLabGridMotionBaseDuration: Number(event.target.value) })}
              aria-label="MassageLab Grid Motion base duration"
            />
          </label>
        </>
      )}

      {option.id === "massage-lab-shape-grid" && (
        <>
          <label className={styles.selectRow}>
            <span>Grid color mode</span>
            <select
              value={massageLabShapeGridPaletteMode}
              onChange={(event) => handleSettingsChange({
                massageLabShapeGridPaletteMode: event.target.value as MassageLabShapeGridPaletteMode,
              })}
              aria-label="MassageLab Shape Grid color mode"
            >
              <option value="source">Source colors</option>
              <option value="custom">Custom colors</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {massageLabShapeGridPaletteMode === "custom" ? (
            <>
              <div className={styles.colorRow}>
                <span>Border</span>
                <ColorPickerInput
                  value={massageLabShapeGridBorderColor}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabShapeGridBorderColor: nextColor })}
                  label="MassageLab Shape Grid border color"
                />
              </div>
              <div className={styles.colorRow}>
                <span>Hover fill</span>
                <ColorPickerInput
                  value={massageLabShapeGridHoverFillColor}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabShapeGridHoverFillColor: nextColor })}
                  label="MassageLab Shape Grid hover fill color"
                />
              </div>
            </>
          ) : null}

          {massageLabShapeGridPaletteMode === "harmony" ? (
            <>
              <div className={styles.colorRow}>
                <span>Primary color</span>
                <ColorPickerInput
                  value={massageLabShapeGridPrimaryColor}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabShapeGridPrimaryColor: nextColor })}
                  label="MassageLab Shape Grid primary color"
                />
              </div>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={massageLabShapeGridHarmony}
                  onChange={(event) => handleSettingsChange({
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
              value={massageLabShapeGridDirection}
              onChange={(event) => handleSettingsChange({
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
              value={massageLabShapeGridShape}
              onChange={(event) => handleSettingsChange({
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
              checked={massageLabShapeGridCursorInteraction}
              onChange={(event) => handleSettingsChange({ massageLabShapeGridCursorInteraction: event.target.checked })}
              aria-label="MassageLab Shape Grid cursor interaction"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Speed ({massageLabShapeGridSpeed.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="4"
              step="0.05"
              value={massageLabShapeGridSpeed}
              onChange={(event) => handleSettingsChange({ massageLabShapeGridSpeed: Number(event.target.value) })}
              aria-label="MassageLab Shape Grid speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Cell size ({massageLabShapeGridSquareSize.toFixed(0)})</span>
            <input
              type="range"
              min="12"
              max="96"
              step="1"
              value={massageLabShapeGridSquareSize}
              onChange={(event) => handleSettingsChange({ massageLabShapeGridSquareSize: Number(event.target.value) })}
              aria-label="MassageLab Shape Grid cell size"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Hover trail ({massageLabShapeGridHoverTrailAmount.toFixed(0)})</span>
            <input
              type="range"
              min="0"
              max="12"
              step="1"
              value={massageLabShapeGridHoverTrailAmount}
              onChange={(event) => handleSettingsChange({ massageLabShapeGridHoverTrailAmount: Number(event.target.value) })}
              aria-label="MassageLab Shape Grid hover trail"
            />
          </label>
        </>
      )}

      {option.id === "massage-lab-liquid-chrome" && (
        <>
          <label className={styles.selectRow}>
            <span>Chrome color mode</span>
            <select
              value={massageLabLiquidChromePaletteMode}
              onChange={(event) => handleSettingsChange({
                massageLabLiquidChromePaletteMode: event.target.value as MassageLabLiquidChromePaletteMode,
              })}
              aria-label="MassageLab Liquid Chrome color mode"
            >
              <option value="source">Source base color</option>
              <option value="custom">Custom color</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {massageLabLiquidChromePaletteMode === "custom" ? (
            <div className={styles.colorRow}>
              <span>Base color</span>
              <ColorPickerInput
                value={massageLabLiquidChromeBaseColor}
                onValueChange={(nextColor) => handleSettingsChange({ massageLabLiquidChromeBaseColor: nextColor })}
                label="MassageLab Liquid Chrome base color"
              />
            </div>
          ) : null}

          {massageLabLiquidChromePaletteMode === "harmony" ? (
            <>
              <div className={styles.colorRow}>
                <span>Primary color</span>
                <ColorPickerInput
                  value={massageLabLiquidChromePrimaryColor}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabLiquidChromePrimaryColor: nextColor })}
                  label="MassageLab Liquid Chrome primary color"
                />
              </div>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={massageLabLiquidChromeHarmony}
                  onChange={(event) => handleSettingsChange({
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
              checked={massageLabLiquidChromeInteractive}
              onChange={(event) => handleSettingsChange({ massageLabLiquidChromeInteractive: event.target.checked })}
              aria-label="MassageLab Liquid Chrome cursor interaction"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Speed ({massageLabLiquidChromeSpeed.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.01"
              value={massageLabLiquidChromeSpeed}
              onChange={(event) => handleSettingsChange({ massageLabLiquidChromeSpeed: Number(event.target.value) })}
              aria-label="MassageLab Liquid Chrome speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Amplitude ({massageLabLiquidChromeAmplitude.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={massageLabLiquidChromeAmplitude}
              onChange={(event) => handleSettingsChange({ massageLabLiquidChromeAmplitude: Number(event.target.value) })}
              aria-label="MassageLab Liquid Chrome amplitude"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Frequency X ({massageLabLiquidChromeFrequencyX.toFixed(1)})</span>
            <input
              type="range"
              min="0.1"
              max="12"
              step="0.1"
              value={massageLabLiquidChromeFrequencyX}
              onChange={(event) => handleSettingsChange({ massageLabLiquidChromeFrequencyX: Number(event.target.value) })}
              aria-label="MassageLab Liquid Chrome frequency X"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Frequency Y ({massageLabLiquidChromeFrequencyY.toFixed(1)})</span>
            <input
              type="range"
              min="0.1"
              max="12"
              step="0.1"
              value={massageLabLiquidChromeFrequencyY}
              onChange={(event) => handleSettingsChange({ massageLabLiquidChromeFrequencyY: Number(event.target.value) })}
              aria-label="MassageLab Liquid Chrome frequency Y"
            />
          </label>
        </>
      )}

      {option.id === "massage-lab-balatro" && (
        <>
          <label className={styles.selectRow}>
            <span>Balatro color mode</span>
            <select
              value={massageLabBalatroPaletteMode}
              onChange={(event) => handleSettingsChange({
                massageLabBalatroPaletteMode: event.target.value as MassageLabBalatroPaletteMode,
              })}
              aria-label="MassageLab Balatro color mode"
            >
              <option value="source">Source colors</option>
              <option value="custom">Custom colors</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {massageLabBalatroPaletteMode === "custom" ? (
            <>
              <div className={styles.colorRow}>
                <span>Color 1</span>
                <ColorPickerInput
                  value={massageLabBalatroColorOne}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabBalatroColorOne: nextColor })}
                  label="MassageLab Balatro color 1"
                />
              </div>
              <div className={styles.colorRow}>
                <span>Color 2</span>
                <ColorPickerInput
                  value={massageLabBalatroColorTwo}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabBalatroColorTwo: nextColor })}
                  label="MassageLab Balatro color 2"
                />
              </div>
              <div className={styles.colorRow}>
                <span>Color 3</span>
                <ColorPickerInput
                  value={massageLabBalatroColorThree}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabBalatroColorThree: nextColor })}
                  label="MassageLab Balatro color 3"
                />
              </div>
            </>
          ) : null}

          {massageLabBalatroPaletteMode === "harmony" ? (
            <>
              <div className={styles.colorRow}>
                <span>Primary color</span>
                <ColorPickerInput
                  value={massageLabBalatroPrimaryColor}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabBalatroPrimaryColor: nextColor })}
                  label="MassageLab Balatro primary color"
                />
              </div>
              <label className={styles.selectRow}>
                <span>Harmony</span>
                <select
                  value={massageLabBalatroHarmony}
                  onChange={(event) => handleSettingsChange({ massageLabBalatroHarmony: event.target.value as ColorHarmony })}
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
              checked={massageLabBalatroMouseInteraction}
              onChange={(event) => handleSettingsChange({ massageLabBalatroMouseInteraction: event.target.checked })}
              aria-label="MassageLab Balatro mouse interaction"
            />
          </label>

          <label className={styles.switchRow}>
            <span>Rotate field</span>
            <input
              type="checkbox"
              checked={massageLabBalatroIsRotate}
              onChange={(event) => handleSettingsChange({ massageLabBalatroIsRotate: event.target.checked })}
              aria-label="MassageLab Balatro rotate field"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Spin speed ({massageLabBalatroSpinSpeed.toFixed(1)})</span>
            <input
              type="range"
              min="0"
              max="14"
              step="0.1"
              value={massageLabBalatroSpinSpeed}
              onChange={(event) => handleSettingsChange({ massageLabBalatroSpinSpeed: Number(event.target.value) })}
              aria-label="MassageLab Balatro spin speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Spin rotation ({massageLabBalatroSpinRotation.toFixed(1)})</span>
            <input
              type="range"
              min="-8"
              max="8"
              step="0.1"
              value={massageLabBalatroSpinRotation}
              onChange={(event) => handleSettingsChange({ massageLabBalatroSpinRotation: Number(event.target.value) })}
              aria-label="MassageLab Balatro spin rotation"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Contrast ({massageLabBalatroContrast.toFixed(1)})</span>
            <input
              type="range"
              min="0.5"
              max="8"
              step="0.1"
              value={massageLabBalatroContrast}
              onChange={(event) => handleSettingsChange({ massageLabBalatroContrast: Number(event.target.value) })}
              aria-label="MassageLab Balatro contrast"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Lighting ({massageLabBalatroLighting.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={massageLabBalatroLighting}
              onChange={(event) => handleSettingsChange({ massageLabBalatroLighting: Number(event.target.value) })}
              aria-label="MassageLab Balatro lighting"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Spin amount ({massageLabBalatroSpinAmount.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={massageLabBalatroSpinAmount}
              onChange={(event) => handleSettingsChange({ massageLabBalatroSpinAmount: Number(event.target.value) })}
              aria-label="MassageLab Balatro spin amount"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Pixel filter ({massageLabBalatroPixelFilter.toFixed(0)})</span>
            <input
              type="range"
              min="120"
              max="1200"
              step="5"
              value={massageLabBalatroPixelFilter}
              onChange={(event) => handleSettingsChange({ massageLabBalatroPixelFilter: Number(event.target.value) })}
              aria-label="MassageLab Balatro pixel filter"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Spin ease ({massageLabBalatroSpinEase.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="3"
              step="0.01"
              value={massageLabBalatroSpinEase}
              onChange={(event) => handleSettingsChange({ massageLabBalatroSpinEase: Number(event.target.value) })}
              aria-label="MassageLab Balatro spin ease"
            />
          </label>
        </>
      )}

      {option.id === "massage-lab-photon-beam" && (
        <>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={massageLabPhotonBeamPaletteMode}
              onChange={(event) => handleSettingsChange({
                massageLabPhotonBeamPaletteMode: event.target.value as MassageLabPhotonBeamPaletteMode,
              })}
              aria-label="Photon Beam color mode"
            >
              <option value="custom">Custom colors</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {massageLabPhotonBeamPaletteMode === "custom" ? (
            <>
              <div className={styles.colorRow}>
                <span>Background</span>
                <ColorPickerInput
                  value={massageLabPhotonBeamColorBg}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabPhotonBeamColorBg: nextColor })}
                  label="Photon Beam background color"
                />
              </div>
              <div className={styles.colorRow}>
                <span>Beam lines</span>
                <ColorPickerInput
                  value={massageLabPhotonBeamColorLine}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabPhotonBeamColorLine: nextColor })}
                  label="Photon Beam line color"
                />
              </div>
              <div className={styles.colorRow}>
                <span>Signal 1</span>
                <ColorPickerInput
                  value={massageLabPhotonBeamColorSignal}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabPhotonBeamColorSignal: nextColor })}
                  label="Photon Beam signal color"
                />
              </div>
              <label className={styles.switchRow}>
                <span>Signal 2</span>
                <input
                  type="checkbox"
                  checked={massageLabPhotonBeamUseColor2}
                  onChange={(event) => handleSettingsChange({ massageLabPhotonBeamUseColor2: event.target.checked })}
                  aria-label="Photon Beam use second signal color"
                />
              </label>
              {massageLabPhotonBeamUseColor2 && (
                <div className={styles.colorRow}>
                  <span>Signal 2 color</span>
                  <ColorPickerInput
                    value={massageLabPhotonBeamColorSignal2}
                    onValueChange={(nextColor) => handleSettingsChange({ massageLabPhotonBeamColorSignal2: nextColor })}
                    label="Photon Beam second signal color"
                  />
                </div>
              )}
              <label className={styles.switchRow}>
                <span>Signal 3</span>
                <input
                  type="checkbox"
                  checked={massageLabPhotonBeamUseColor3}
                  onChange={(event) => handleSettingsChange({ massageLabPhotonBeamUseColor3: event.target.checked })}
                  aria-label="Photon Beam use third signal color"
                />
              </label>
              {massageLabPhotonBeamUseColor3 && (
                <div className={styles.colorRow}>
                  <span>Signal 3 color</span>
                  <ColorPickerInput
                    value={massageLabPhotonBeamColorSignal3}
                    onValueChange={(nextColor) => handleSettingsChange({ massageLabPhotonBeamColorSignal3: nextColor })}
                    label="Photon Beam third signal color"
                  />
                </div>
              )}
            </>
          ) : (
            <>
              <div className={styles.colorRow}>
                <span>Primary color</span>
                <ColorPickerInput
                  value={massageLabPhotonBeamPrimaryColor}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabPhotonBeamPrimaryColor: nextColor })}
                  label="Photon Beam primary color"
                />
              </div>

              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={massageLabPhotonBeamHarmony}
                  onChange={(event) => handleSettingsChange({
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
            <span>Animation speed ({photonBeamSpeed}%)</span>
            <input
              type="range"
              min={MASSAGE_LAB_PHOTON_BEAM_DISPLAY_SPEED_MIN}
              max={MASSAGE_LAB_PHOTON_BEAM_DISPLAY_SPEED_MAX}
              step={MASSAGE_LAB_PHOTON_BEAM_DISPLAY_SPEED_STEP}
              value={photonBeamSpeed}
              onChange={(event) => handleSettingsChange({
                massageLabPhotonBeamSpeedGlobal: getMassageLabPhotonBeamSourceSpeed(Number(event.target.value)),
              })}
              aria-label="Photon Beam animation speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Lines ({massageLabPhotonBeamLineCount})</span>
            <input
              type="range"
              min="12"
              max="160"
              step="1"
              value={massageLabPhotonBeamLineCount}
              onChange={(event) => handleSettingsChange({ massageLabPhotonBeamLineCount: Number(event.target.value) })}
              aria-label="Photon Beam line count"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Signals ({massageLabPhotonBeamSignalCount})</span>
            <input
              type="range"
              min="0"
              max="220"
              step="1"
              value={massageLabPhotonBeamSignalCount}
              onChange={(event) => handleSettingsChange({ massageLabPhotonBeamSignalCount: Number(event.target.value) })}
              aria-label="Photon Beam signal count"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Spread ({massageLabPhotonBeamSpreadHeight.toFixed(0)})</span>
            <input
              type="range"
              min="5"
              max="90"
              step="1"
              value={massageLabPhotonBeamSpreadHeight}
              onChange={(event) => handleSettingsChange({ massageLabPhotonBeamSpreadHeight: Number(event.target.value) })}
              aria-label="Photon Beam spread height"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Depth ({massageLabPhotonBeamSpreadDepth.toFixed(0)})</span>
            <input
              type="range"
              min="0"
              max="60"
              step="1"
              value={massageLabPhotonBeamSpreadDepth}
              onChange={(event) => handleSettingsChange({ massageLabPhotonBeamSpreadDepth: Number(event.target.value) })}
              aria-label="Photon Beam spread depth"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Trail length ({massageLabPhotonBeamTrailLength})</span>
            <input
              type="range"
              min="1"
              max="16"
              step="1"
              value={massageLabPhotonBeamTrailLength}
              onChange={(event) => handleSettingsChange({ massageLabPhotonBeamTrailLength: Number(event.target.value) })}
              aria-label="Photon Beam trail length"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Line opacity ({Math.round(massageLabPhotonBeamLineOpacity * 100)}%)</span>
            <input
              type="range"
              min="0.05"
              max="1"
              step="0.01"
              value={massageLabPhotonBeamLineOpacity}
              onChange={(event) => handleSettingsChange({ massageLabPhotonBeamLineOpacity: Number(event.target.value) })}
              aria-label="Photon Beam line opacity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Bloom strength ({massageLabPhotonBeamBloomStrength.toFixed(1)})</span>
            <input
              type="range"
              min="0"
              max="6"
              step="0.1"
              value={massageLabPhotonBeamBloomStrength}
              onChange={(event) => handleSettingsChange({ massageLabPhotonBeamBloomStrength: Number(event.target.value) })}
              aria-label="Photon Beam bloom strength"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Bloom radius ({massageLabPhotonBeamBloomRadius.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="1.5"
              step="0.05"
              value={massageLabPhotonBeamBloomRadius}
              onChange={(event) => handleSettingsChange({ massageLabPhotonBeamBloomRadius: Number(event.target.value) })}
              aria-label="Photon Beam bloom radius"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Wave speed ({massageLabPhotonBeamWaveSpeed.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="8"
              step="0.05"
              value={massageLabPhotonBeamWaveSpeed}
              onChange={(event) => handleSettingsChange({ massageLabPhotonBeamWaveSpeed: Number(event.target.value) })}
              aria-label="Photon Beam wave speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Wave height ({massageLabPhotonBeamWaveHeight.toFixed(3)})</span>
            <input
              type="range"
              min="0"
              max="1"
              step="0.005"
              value={massageLabPhotonBeamWaveHeight}
              onChange={(event) => handleSettingsChange({ massageLabPhotonBeamWaveHeight: Number(event.target.value) })}
              aria-label="Photon Beam wave height"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Curve length ({massageLabPhotonBeamCurveLength.toFixed(0)})</span>
            <input
              type="range"
              min="16"
              max="120"
              step="1"
              value={massageLabPhotonBeamCurveLength}
              onChange={(event) => handleSettingsChange({ massageLabPhotonBeamCurveLength: Number(event.target.value) })}
              aria-label="Photon Beam curve length"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Straight length ({massageLabPhotonBeamStraightLength.toFixed(0)})</span>
            <input
              type="range"
              min="40"
              max="220"
              step="1"
              value={massageLabPhotonBeamStraightLength}
              onChange={(event) => handleSettingsChange({ massageLabPhotonBeamStraightLength: Number(event.target.value) })}
              aria-label="Photon Beam straight length"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Curve power ({massageLabPhotonBeamCurvePower.toFixed(2)})</span>
            <input
              type="range"
              min="0.2"
              max="2"
              step="0.01"
              value={massageLabPhotonBeamCurvePower}
              onChange={(event) => handleSettingsChange({ massageLabPhotonBeamCurvePower: Number(event.target.value) })}
              aria-label="Photon Beam curve power"
            />
          </label>
        </>
      )}

      {option.id === "massage-lab-matrix-rain" && (
        <>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={massageLabMatrixRainPaletteMode}
              onChange={(event) => handleSettingsChange({
                massageLabMatrixRainPaletteMode: event.target.value as MassageLabMatrixRainPaletteMode,
              })}
              aria-label="Matrix Rain color mode"
            >
              <option value="custom">Custom color</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {massageLabMatrixRainPaletteMode === "custom" ? (
            <div className={styles.colorRow}>
              <span>Character color</span>
              <ColorPickerInput
                value={massageLabMatrixRainColor}
                onValueChange={(nextColor) => handleSettingsChange({ massageLabMatrixRainColor: nextColor })}
                label="Matrix Rain character color"
              />
            </div>
          ) : (
            <>
              <div className={styles.colorRow}>
                <span>Primary color</span>
                <ColorPickerInput
                  value={massageLabMatrixRainPrimaryColor}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabMatrixRainPrimaryColor: nextColor })}
                  label="Matrix Rain primary color"
                />
              </div>

              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={massageLabMatrixRainHarmony}
                  onChange={(event) => handleSettingsChange({
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
              onChange={(event) => handleSettingsChange({
                massageLabMatrixRainSpeed: getMassageLabMatrixRainSourceSpeed(Number(event.target.value)),
              })}
              aria-label="Matrix Rain animation speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Font size ({massageLabMatrixRainFontSize}px)</span>
            <input
              type="range"
              min="8"
              max="28"
              step="1"
              value={massageLabMatrixRainFontSize}
              onChange={(event) => handleSettingsChange({ massageLabMatrixRainFontSize: Number(event.target.value) })}
              aria-label="Matrix Rain font size"
            />
          </label>
        </>
      )}

      {option.id === "massage-lab-novatrix" && (
        <>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={massageLabNovatrixPaletteMode}
              onChange={(event) => handleSettingsChange({
                massageLabNovatrixPaletteMode: event.target.value as MassageLabNovatrixPaletteMode,
              })}
              aria-label="Novatrix color mode"
            >
              <option value="custom">Custom color</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {massageLabNovatrixPaletteMode === "custom" ? (
            <div className={styles.colorRow}>
              <span>Animation color</span>
              <ColorPickerInput
                value={massageLabNovatrixColor}
                onValueChange={(nextColor) => handleSettingsChange({ massageLabNovatrixColor: nextColor })}
                label="Novatrix animation color"
              />
            </div>
          ) : (
            <>
              <div className={styles.colorRow}>
                <span>Primary color</span>
                <ColorPickerInput
                  value={massageLabNovatrixPrimaryColor}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabNovatrixPrimaryColor: nextColor })}
                  label="Novatrix primary color"
                />
              </div>

              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={massageLabNovatrixHarmony}
                  onChange={(event) => handleSettingsChange({
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
              onChange={(event) => handleSettingsChange({
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
              onChange={(event) => handleSettingsChange({
                massageLabNovatrixAmplitude: getMassageLabNovatrixSourceAmplitude(Number(event.target.value)),
              })}
              aria-label="Novatrix amplitude"
            />
          </label>
        </>
      )}

      {option.id === "massage-lab-synthesis" && (
        <>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={massageLabSynthesisPaletteMode}
              onChange={(event) => handleSettingsChange({
                massageLabSynthesisPaletteMode: event.target.value as MassageLabSynthesisPaletteMode,
              })}
              aria-label="Synthesis color mode"
            >
              <option value="custom">Custom colors</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {massageLabSynthesisPaletteMode === "custom" ? (
            <>
              <div className={styles.colorRow}>
                <span>Color 1</span>
                <ColorPickerInput
                  value={massageLabSynthesisColorOne}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabSynthesisColorOne: nextColor })}
                  label="Synthesis color 1"
                />
              </div>

              <div className={styles.colorRow}>
                <span>Color 2</span>
                <ColorPickerInput
                  value={massageLabSynthesisColorTwo}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabSynthesisColorTwo: nextColor })}
                  label="Synthesis color 2"
                />
              </div>

              <div className={styles.colorRow}>
                <span>Color 3</span>
                <ColorPickerInput
                  value={massageLabSynthesisColorThree}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabSynthesisColorThree: nextColor })}
                  label="Synthesis color 3"
                />
              </div>
            </>
          ) : (
            <>
              <div className={styles.colorRow}>
                <span>Primary color</span>
                <ColorPickerInput
                  value={massageLabSynthesisPrimaryColor}
                  onValueChange={(nextColor) => handleSettingsChange({ massageLabSynthesisPrimaryColor: nextColor })}
                  label="Synthesis primary color"
                />
              </div>

              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={massageLabSynthesisHarmony}
                  onChange={(event) => handleSettingsChange({
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
              onChange={(event) => handleSettingsChange({
                massageLabSynthesisSpeed: getMassageLabSynthesisSourceSpeed(Number(event.target.value)),
              })}
              aria-label="Synthesis animation speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Complexity ({massageLabSynthesisComplexity})</span>
            <input
              type="range"
              min="1"
              max="20"
              step="1"
              value={massageLabSynthesisComplexity}
              onChange={(event) => handleSettingsChange({ massageLabSynthesisComplexity: Number(event.target.value) })}
              aria-label="Synthesis complexity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Zoom scale ({massageLabSynthesisScale.toFixed(1)}x)</span>
            <input
              type="range"
              min="0.1"
              max="5"
              step="0.1"
              value={massageLabSynthesisScale}
              onChange={(event) => handleSettingsChange({ massageLabSynthesisScale: Number(event.target.value) })}
              aria-label="Synthesis zoom scale"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Distortion ({massageLabSynthesisDistortion.toFixed(1)}x)</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={massageLabSynthesisDistortion}
              onChange={(event) => handleSettingsChange({ massageLabSynthesisDistortion: Number(event.target.value) })}
              aria-label="Synthesis distortion"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Glow intensity ({massageLabSynthesisGlowIntensity.toFixed(1)}x)</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={massageLabSynthesisGlowIntensity}
              onChange={(event) => handleSettingsChange({ massageLabSynthesisGlowIntensity: Number(event.target.value) })}
              aria-label="Synthesis glow intensity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Flow frequency ({massageLabSynthesisFlowFrequency.toFixed(1)})</span>
            <input
              type="range"
              min="0.5"
              max="10"
              step="0.5"
              value={massageLabSynthesisFlowFrequency}
              onChange={(event) => handleSettingsChange({ massageLabSynthesisFlowFrequency: Number(event.target.value) })}
              aria-label="Synthesis flow frequency"
            />
          </label>
        </>
      )}

      {option.id === "massage-lab-background-lines" && (
        <label className={styles.rangeRow}>
          <span>Line duration</span>
          <input
            type="range"
            min="4"
            max="18"
            step="1"
            value={backgroundLinesDuration}
            onChange={(event) => handleSettingsChange({ backgroundLinesDuration: Number(event.target.value) })}
            aria-label="Light lines animation duration"
          />
        </label>
      )}

      {option.id === "massage-lab-shooting-stars" && (
        <>
          <div className={styles.colorRow}>
            <span>Stars</span>
            <ColorPickerInput
              value={shootingStarsStarColor}
              onValueChange={(nextColor) => handleSettingsChange({ shootingStarsStarColor: nextColor })}
              label="Shooting stars background star color"
            />
          </div>

          <div className={styles.colorRow}>
            <span>Trail</span>
            <ColorPickerInput
              value={shootingStarsTrailColor}
              onValueChange={(nextColor) => handleSettingsChange({ shootingStarsTrailColor: nextColor })}
              label="Shooting stars trail color"
            />
          </div>

          <div className={styles.colorRow}>
            <span>Shooting star</span>
            <ColorPickerInput
              value={shootingStarsShootingStarColor}
              onValueChange={(nextColor) => handleSettingsChange({ shootingStarsShootingStarColor: nextColor })}
              label="Shooting star color"
            />
          </div>

          <label className={styles.rangeRow}>
            <span>Star density</span>
            <input
              type="range"
              min="0.00005"
              max="0.00035"
              step="0.00001"
              value={shootingStarsDensity}
              onChange={(event) => handleSettingsChange({ shootingStarsDensity: Number(event.target.value) })}
              aria-label="Shooting stars background star density"
            />
          </label>

          <label className={styles.switchRow}>
            <span>Twinkle stars</span>
            <input
              type="checkbox"
              checked={shootingStarsTwinkle}
              onChange={(event) => handleSettingsChange({ shootingStarsTwinkle: event.target.checked })}
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Twinkle speed</span>
            <input
              type="range"
              min="0.4"
              max="2.5"
              step="0.1"
              value={shootingStarsTwinkleSpeed}
              onChange={(event) => handleSettingsChange({ shootingStarsTwinkleSpeed: Number(event.target.value) })}
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
              value={shootingStarsShootingSpeed}
              onChange={(event) => handleSettingsChange({ shootingStarsShootingSpeed: Number(event.target.value) })}
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
              value={shootingStarsFrequency}
              onChange={(event) => handleSettingsChange({ shootingStarsFrequency: Number(event.target.value) })}
              aria-label="Shooting star frequency"
            />
          </label>
        </>
      )}

      {option.id === "massage-lab-reveal-dots" && (
        <>
          <div className={styles.colorRow}>
            <span>Background</span>
            <ColorPickerInput
              value={canvasRevealDotsBackgroundColor}
              onValueChange={(nextColor) => handleSettingsChange({ canvasRevealDotsBackgroundColor: nextColor })}
              label="Reveal dots background color"
            />
          </div>

          <div className={styles.colorRow}>
            <span>Dot color</span>
            <ColorPickerInput
              value={canvasRevealDotsDotColor}
              onValueChange={(nextColor) => handleSettingsChange({ canvasRevealDotsDotColor: nextColor })}
              label="Reveal dots dot color"
            />
          </div>

          <div className={styles.colorRow}>
            <span>Accent</span>
            <ColorPickerInput
              value={canvasRevealDotsAccentColor}
              onValueChange={(nextColor) => handleSettingsChange({ canvasRevealDotsAccentColor: nextColor })}
              label="Reveal dots accent color"
            />
          </div>

          <label className={styles.rangeRow}>
            <span>Dot size</span>
            <input
              type="range"
              min="1"
              max="5"
              step="0.2"
              value={canvasRevealDotsDotSize}
              onChange={(event) => handleSettingsChange({ canvasRevealDotsDotSize: Number(event.target.value) })}
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
              value={canvasRevealDotsDotSpacing}
              onChange={(event) => handleSettingsChange({ canvasRevealDotsDotSpacing: Number(event.target.value) })}
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
              value={canvasRevealDotsOpacity}
              onChange={(event) => handleSettingsChange({ canvasRevealDotsOpacity: Number(event.target.value) })}
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
              value={canvasRevealDotsAnimationSpeed}
              onChange={(event) => handleSettingsChange({ canvasRevealDotsAnimationSpeed: Number(event.target.value) })}
              aria-label="Reveal dots motion speed"
            />
          </label>

          <label className={styles.switchRow}>
            <span>Gradient overlay</span>
            <input
              type="checkbox"
              checked={canvasRevealDotsShowGradient}
              onChange={(event) => handleSettingsChange({ canvasRevealDotsShowGradient: event.target.checked })}
            />
          </label>
        </>
      )}

      {option.id === "massage-lab-spotlight" && (
        <>
          <div className={styles.colorRow}>
            <span>Spotlight color</span>
            <ColorPickerInput
              value={spotlightColor}
              onValueChange={(nextColor) => handleSettingsChange({ spotlightColor: nextColor })}
              label="Spotlight color"
            />
          </div>

          <label className={styles.rangeRow}>
            <span>Intensity</span>
            <input
              type="range"
              min="0.25"
              max="1.5"
              step="0.05"
              value={spotlightOpacity}
              onChange={(event) => handleSettingsChange({ spotlightOpacity: Number(event.target.value) })}
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
              value={spotlightWidth}
              onChange={(event) => handleSettingsChange({ spotlightWidth: Number(event.target.value) })}
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
              value={spotlightHeight}
              onChange={(event) => handleSettingsChange({ spotlightHeight: Number(event.target.value) })}
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
              value={spotlightSmallWidth}
              onChange={(event) => handleSettingsChange({ spotlightSmallWidth: Number(event.target.value) })}
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
              value={spotlightTranslateY}
              onChange={(event) => handleSettingsChange({ spotlightTranslateY: Number(event.target.value) })}
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
              value={spotlightXOffset}
              onChange={(event) => handleSettingsChange({ spotlightXOffset: Number(event.target.value) })}
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
              value={spotlightDuration}
              onChange={(event) => handleSettingsChange({ spotlightDuration: Number(event.target.value) })}
              aria-label="Spotlight animation duration"
            />
          </label>
        </>
      )}

      {option.id === "massage-lab-lamp-effect" && (
        <>
          <div className={styles.colorRow}>
            <span>Background</span>
            <ColorPickerInput
              value={lampBackgroundColor}
              onValueChange={(nextColor) => handleSettingsChange({ lampBackgroundColor: nextColor })}
              label="Lamp background color"
            />
          </div>

          <div className={styles.colorRow}>
            <span>Beam color</span>
            <ColorPickerInput
              value={lampColor}
              onValueChange={(nextColor) => handleSettingsChange({ lampColor: nextColor })}
              label="Lamp beam color"
            />
          </div>

          <label className={styles.rangeRow}>
            <span>Glow intensity</span>
            <input
              type="range"
              min="0.18"
              max="0.95"
              step="0.05"
              value={lampGlowOpacity}
              onChange={(event) => handleSettingsChange({ lampGlowOpacity: Number(event.target.value) })}
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
              value={lampBeamWidth}
              onChange={(event) => handleSettingsChange({ lampBeamWidth: Number(event.target.value) })}
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
              value={lampGlowWidth}
              onChange={(event) => handleSettingsChange({ lampGlowWidth: Number(event.target.value) })}
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
              value={lampVerticalOffset}
              onChange={(event) => handleSettingsChange({ lampVerticalOffset: Number(event.target.value) })}
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
              value={lampPulseSpeed}
              onChange={(event) => handleSettingsChange({ lampPulseSpeed: Number(event.target.value) })}
              aria-label="Lamp pulse speed"
            />
          </label>
        </>
      )}

      {option.id === "massage-lab-vortex" && (
        <>
          <div className={styles.colorRow}>
            <span>Background</span>
            <ColorPickerInput
              value={vortexBackgroundColor}
              onValueChange={(nextColor) => handleSettingsChange({ vortexBackgroundColor: nextColor })}
              label="Vortex field color"
            />
          </div>

          <label className={styles.rangeRow}>
            <span>Hue</span>
            <input
              type="range"
              min="0"
              max="360"
              step="1"
              value={vortexBaseHue}
              onChange={(event) => handleSettingsChange({ vortexBaseHue: Number(event.target.value) })}
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
              value={vortexParticleCount}
              onChange={(event) => handleSettingsChange({ vortexParticleCount: Number(event.target.value) })}
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
              value={vortexRangeY}
              onChange={(event) => handleSettingsChange({ vortexRangeY: Number(event.target.value) })}
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
              value={vortexBaseSpeed}
              onChange={(event) => handleSettingsChange({ vortexBaseSpeed: Number(event.target.value) })}
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
              value={vortexRangeSpeed}
              onChange={(event) => handleSettingsChange({ vortexRangeSpeed: Number(event.target.value) })}
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
              value={vortexBaseRadius}
              onChange={(event) => handleSettingsChange({ vortexBaseRadius: Number(event.target.value) })}
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
              value={vortexRangeRadius}
              onChange={(event) => handleSettingsChange({ vortexRangeRadius: Number(event.target.value) })}
              aria-label="Vortex particle size range"
            />
          </label>
        </>
      )}

      {option.id === "massage-lab-wavy-background" && (
        <>
          <div className={styles.colorRow}>
            <span>Background</span>
            <ColorPickerInput
              value={wavyBackgroundFill}
              onValueChange={(nextColor) => handleSettingsChange({ wavyBackgroundFill: nextColor })}
              label="Wave flow fill color"
            />
          </div>

          <div className={styles.colorRow}>
            <span>Wave 1</span>
            <ColorPickerInput
              value={wavyColorOne}
              onValueChange={(nextColor) => handleSettingsChange({ wavyColorOne: nextColor })}
              label="Wavy first wave color"
            />
          </div>

          <div className={styles.colorRow}>
            <span>Wave 2</span>
            <ColorPickerInput
              value={wavyColorTwo}
              onValueChange={(nextColor) => handleSettingsChange({ wavyColorTwo: nextColor })}
              label="Wavy second wave color"
            />
          </div>

          <div className={styles.colorRow}>
            <span>Wave 3</span>
            <ColorPickerInput
              value={wavyColorThree}
              onValueChange={(nextColor) => handleSettingsChange({ wavyColorThree: nextColor })}
              label="Wavy third wave color"
            />
          </div>

          <div className={styles.colorRow}>
            <span>Wave 4</span>
            <ColorPickerInput
              value={wavyColorFour}
              onValueChange={(nextColor) => handleSettingsChange({ wavyColorFour: nextColor })}
              label="Wavy fourth wave color"
            />
          </div>

          <div className={styles.colorRow}>
            <span>Wave 5</span>
            <ColorPickerInput
              value={wavyColorFive}
              onValueChange={(nextColor) => handleSettingsChange({ wavyColorFive: nextColor })}
              label="Wavy fifth wave color"
            />
          </div>

          <label className={styles.rangeRow}>
            <span>Wave width</span>
            <input
              type="range"
              min="10"
              max="90"
              step="5"
              value={wavyWaveWidth}
              onChange={(event) => handleSettingsChange({ wavyWaveWidth: Number(event.target.value) })}
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
              value={wavyBlur}
              onChange={(event) => handleSettingsChange({ wavyBlur: Number(event.target.value) })}
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
              value={wavyWaveOpacity}
              onChange={(event) => handleSettingsChange({ wavyWaveOpacity: Number(event.target.value) })}
              aria-label="Wavy wave opacity"
            />
          </label>

          <label className={styles.selectRow}>
            <span>Speed</span>
            <select
              value={wavySpeed}
              onChange={(event) => handleSettingsChange({ wavySpeed: event.target.value as ChimerSettings["wavySpeed"] })}
              aria-label="Wavy animation speed"
            >
              <option value="slow">Slow</option>
              <option value="fast">Fast</option>
            </select>
          </label>
        </>
      )}

      {option.id === "massage-lab-aurora-bars" && (
        <>
          <div className={styles.colorRow}>
            <span>Background</span>
            <ColorPickerInput
              value={auroraBarsBackgroundColor}
              onValueChange={(nextColor) => handleSettingsChange({ auroraBarsBackgroundColor: nextColor })}
              label="Aurora bars background color"
            />
          </div>

          <label className={styles.selectRow}>
            <span>Palette</span>
            <select
              value={auroraBarsPaletteMode}
              onChange={(event) => handleSettingsChange({
                auroraBarsPaletteMode: event.target.value as ChimerSettings["auroraBarsPaletteMode"],
              })}
              aria-label="Aurora bars palette mode"
            >
              <option value="auto">Auto monochrome</option>
              <option value="custom">Custom five colors</option>
            </select>
          </label>

          {auroraBarsPaletteMode === "custom" ? (
            <>
              <div className={styles.colorRow}>
                <span>Bar color 1</span>
                <ColorPickerInput
                  value={auroraBarsColorOne}
                  onValueChange={(nextColor) => handleSettingsChange({ auroraBarsColorOne: nextColor })}
                  label="Aurora bars first color"
                />
              </div>

              <div className={styles.colorRow}>
                <span>Bar color 2</span>
                <ColorPickerInput
                  value={auroraBarsColorTwo}
                  onValueChange={(nextColor) => handleSettingsChange({ auroraBarsColorTwo: nextColor })}
                  label="Aurora bars second color"
                />
              </div>

              <div className={styles.colorRow}>
                <span>Bar color 3</span>
                <ColorPickerInput
                  value={auroraBarsColorThree}
                  onValueChange={(nextColor) => handleSettingsChange({ auroraBarsColorThree: nextColor })}
                  label="Aurora bars third color"
                />
              </div>

              <div className={styles.colorRow}>
                <span>Bar color 4</span>
                <ColorPickerInput
                  value={auroraBarsColorFour}
                  onValueChange={(nextColor) => handleSettingsChange({ auroraBarsColorFour: nextColor })}
                  label="Aurora bars fourth color"
                />
              </div>

              <div className={styles.colorRow}>
                <span>Bar color 5</span>
                <ColorPickerInput
                  value={auroraBarsColorFive}
                  onValueChange={(nextColor) => handleSettingsChange({ auroraBarsColorFive: nextColor })}
                  label="Aurora bars fifth color"
                />
              </div>
            </>
          ) : (
            <div className={styles.colorRow}>
              <span>Primary color</span>
              <ColorPickerInput
                value={auroraBarsPrimaryColor}
                onValueChange={(nextColor) => handleSettingsChange({ auroraBarsPrimaryColor: nextColor })}
                label="Aurora bars primary color"
              />
            </div>
          )}

          <label className={styles.rangeRow}>
            <span>Bars ({auroraBarsBarCount})</span>
            <input
              type="range"
              min="8"
              max="80"
              step="1"
              value={auroraBarsBarCount}
              onChange={(event) => handleSettingsChange({ auroraBarsBarCount: Number(event.target.value) })}
              aria-label="Aurora bars bar count"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Speed ({auroraBarsSpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0.08"
              max="2"
              step="0.04"
              value={auroraBarsSpeed}
              onChange={(event) => handleSettingsChange({ auroraBarsSpeed: Number(event.target.value) })}
              aria-label="Aurora bars speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Blur ({auroraBarsBlur}px)</span>
            <input
              type="range"
              min="0"
              max="18"
              step="1"
              value={auroraBarsBlur}
              onChange={(event) => handleSettingsChange({ auroraBarsBlur: Number(event.target.value) })}
              aria-label="Aurora bars blur"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Gap ({auroraBarsGap}px)</span>
            <input
              type="range"
              min="0"
              max="16"
              step="1"
              value={auroraBarsGap}
              onChange={(event) => handleSettingsChange({ auroraBarsGap: Number(event.target.value) })}
              aria-label="Aurora bars gap"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Max height ({Math.round(auroraBarsMaxHeightRatio * 100)}%)</span>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.01"
              value={auroraBarsMaxHeightRatio}
              onChange={(event) => handleSettingsChange({ auroraBarsMaxHeightRatio: Number(event.target.value) })}
              aria-label="Aurora bars maximum height"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Min height ({Math.round(auroraBarsMinHeightRatio * 100)}%)</span>
            <input
              type="range"
              min="0.04"
              max="0.78"
              step="0.01"
              value={auroraBarsMinHeightRatio}
              onChange={(event) => handleSettingsChange({ auroraBarsMinHeightRatio: Number(event.target.value) })}
              aria-label="Aurora bars minimum height"
            />
          </label>
        </>
      )}

      {option.id === "massage-lab-pixel-liquid" && (
        <>
          <div className={styles.colorRow}>
            <span>Background color</span>
            <ColorPickerInput
              value={pixelLiquidBackgroundColor}
              onValueChange={(nextColor) => handleSettingsChange({ pixelLiquidBackgroundColor: nextColor })}
              label="Pixel liquid background color"
            />
          </div>

          <div className={styles.colorRow}>
            <span>Base color</span>
            <ColorPickerInput
              value={pixelLiquidBaseColor}
              onValueChange={(nextColor) => handleSettingsChange({ pixelLiquidBaseColor: nextColor })}
              label="Pixel liquid base color"
            />
          </div>

          <div className={styles.colorRow}>
            <span>Accent color</span>
            <ColorPickerInput
              value={pixelLiquidAccentColor}
              onValueChange={(nextColor) => handleSettingsChange({ pixelLiquidAccentColor: nextColor })}
              label="Pixel liquid accent color"
            />
          </div>

          <div className={styles.colorRow}>
            <span>Highlight color</span>
            <ColorPickerInput
              value={pixelLiquidHighlightColor}
              onValueChange={(nextColor) => handleSettingsChange({ pixelLiquidHighlightColor: nextColor })}
              label="Pixel liquid highlight color"
            />
          </div>

          <label className={styles.selectRow}>
            <span>Detail</span>
            <select
              value={pixelLiquidDetail}
              onChange={(event) => handleSettingsChange({
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
              value={pixelLiquidPixelSize}
              onChange={(event) => handleSettingsChange({ pixelLiquidPixelSize: Number(event.target.value) })}
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
              value={pixelLiquidMotionSpeed}
              onChange={(event) => handleSettingsChange({ pixelLiquidMotionSpeed: Number(event.target.value) })}
              aria-label="Pixel liquid motion speed"
            />
          </label>
        </>
      )}

      {option.id === "massage-lab-tile-grid" && (
        <>
          <label className={styles.selectRow}>
            <span>Palette</span>
            <select
              value={tileGridPaletteMode}
              onChange={(event) => handleSettingsChange({
                tileGridPaletteMode: event.target.value as ChimerSettings["tileGridPaletteMode"],
              })}
              aria-label="Tile grid palette mode"
            >
              <option value="auto">Auto from primary</option>
              <option value="custom">Custom five colors</option>
            </select>
          </label>

          {tileGridPaletteMode === "custom" ? (
            <>
              <div className={styles.colorRow}>
                <span>Color 1</span>
                <ColorPickerInput
                  value={tileGridColorOne}
                  onValueChange={(nextColor) => handleSettingsChange({ tileGridColorOne: nextColor })}
                  label="Tile grid first color"
                />
              </div>

              <div className={styles.colorRow}>
                <span>Color 2</span>
                <ColorPickerInput
                  value={tileGridColorTwo}
                  onValueChange={(nextColor) => handleSettingsChange({ tileGridColorTwo: nextColor })}
                  label="Tile grid second color"
                />
              </div>

              <div className={styles.colorRow}>
                <span>Color 3</span>
                <ColorPickerInput
                  value={tileGridColorThree}
                  onValueChange={(nextColor) => handleSettingsChange({ tileGridColorThree: nextColor })}
                  label="Tile grid third color"
                />
              </div>

              <div className={styles.colorRow}>
                <span>Color 4</span>
                <ColorPickerInput
                  value={tileGridColorFour}
                  onValueChange={(nextColor) => handleSettingsChange({ tileGridColorFour: nextColor })}
                  label="Tile grid fourth color"
                />
              </div>

              <div className={styles.colorRow}>
                <span>Color 5</span>
                <ColorPickerInput
                  value={tileGridColorFive}
                  onValueChange={(nextColor) => handleSettingsChange({ tileGridColorFive: nextColor })}
                  label="Tile grid fifth color"
                />
              </div>
            </>
          ) : (
            <div className={styles.colorRow}>
              <span>Primary color</span>
              <ColorPickerInput
                value={tileGridPrimaryColor}
                onValueChange={(nextColor) => handleSettingsChange({ tileGridPrimaryColor: nextColor })}
                label="Tile grid primary color"
              />
            </div>
          )}

          <label className={styles.rangeRow}>
            <span>Tile size ({tileGridTileSize}px)</span>
            <input
              type="range"
              min="18"
              max="120"
              step="2"
              value={tileGridTileSize}
              onChange={(event) => handleSettingsChange({ tileGridTileSize: Number(event.target.value) })}
              aria-label="Tile grid tile size"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Joint size ({tileGridJointSize}px)</span>
            <input
              type="range"
              min="1"
              max="10"
              step="1"
              value={tileGridJointSize}
              onChange={(event) => handleSettingsChange({ tileGridJointSize: Number(event.target.value) })}
              aria-label="Tile grid joint size"
            />
          </label>

          <TileGridFadeTimeControl
            fadeSeconds={tileGridChangeFrequency}
            onFadeSecondsChange={(tileGridChangeFrequency) => handleSettingsChange({ tileGridChangeFrequency })}
            rowClassName={styles.durationRow}
            pickerClassName={styles.durationPicker}
            fieldClassName={styles.durationField}
          />

          <label className={styles.rangeRow}>
            <span>Active tiles ({tileGridActivePercent}%)</span>
            <input
              type="range"
              min="1"
              max="60"
              step="1"
              value={tileGridActivePercent}
              onChange={(event) => handleSettingsChange({ tileGridActivePercent: Number(event.target.value) })}
              aria-label="Tile grid active tile percentage"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Tile opacity ({Math.round(tileGridOpacity * 100)}%)</span>
            <input
              type="range"
              min="0.15"
              max="1"
              step="0.01"
              value={tileGridOpacity}
              onChange={(event) => handleSettingsChange({ tileGridOpacity: Number(event.target.value) })}
              aria-label="Tile grid tile opacity"
            />
          </label>
        </>
      )}

      {option.id === "massage-lab-hex-grid" && (
        <>
          <div className={styles.colorRow}>
            <span>Primary color</span>
            <ColorPickerInput
              value={hexGridPrimaryColor}
              onValueChange={(nextColor) => handleSettingsChange({ hexGridPrimaryColor: nextColor })}
              label="Hex grid primary color"
            />
          </div>

          <label className={styles.selectRow}>
            <span>Color harmony</span>
            <select
              value={hexGridHarmony}
              onChange={(event) => handleSettingsChange({
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
            <span>Hex size ({hexGridHexSize}px)</span>
            <input
              type="range"
              min="18"
              max="120"
              step="2"
              value={hexGridHexSize}
              onChange={(event) => handleSettingsChange({ hexGridHexSize: Number(event.target.value) })}
              aria-label="Hex grid hex size"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Joint size ({hexGridJointSize}px)</span>
            <input
              type="range"
              min="1"
              max="10"
              step="1"
              value={hexGridJointSize}
              onChange={(event) => handleSettingsChange({ hexGridJointSize: Number(event.target.value) })}
              aria-label="Hex grid joint size"
            />
          </label>

          <TileGridFadeTimeControl
            fadeSeconds={hexGridChangeFrequency}
            onFadeSecondsChange={(hexGridChangeFrequency) => handleSettingsChange({ hexGridChangeFrequency })}
            rowClassName={styles.durationRow}
            pickerClassName={styles.durationPicker}
            fieldClassName={styles.durationField}
          />

          <label className={styles.rangeRow}>
            <span>Active hexes ({hexGridActivePercent}%)</span>
            <input
              type="range"
              min="1"
              max="60"
              step="1"
              value={hexGridActivePercent}
              onChange={(event) => handleSettingsChange({ hexGridActivePercent: Number(event.target.value) })}
              aria-label="Hex grid active hex percentage"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Hex opacity ({Math.round(hexGridOpacity * 100)}%)</span>
            <input
              type="range"
              min="0.15"
              max="1"
              step="0.01"
              value={hexGridOpacity}
              onChange={(event) => handleSettingsChange({ hexGridOpacity: Number(event.target.value) })}
              aria-label="Hex grid hex opacity"
            />
          </label>
        </>
      )}
    </div>
  )

  const renderTimerUnitLabel = (label: "h" | "m" | "s") => (
    <span className={styles.timerUnitLabel} aria-hidden="true">{label}</span>
  )

  const renderCurrentTimeMeridiem = (meridiem = currentTime.meridiem) => (
    meridiem ? <span className={styles.currentTimeMeridiem}>{meridiem}</span> : null
  )

  const renderTimerDisplay = () => {
    const hasHours = timeDisplay.hours !== "00"
    const hasSeconds = Boolean(timeDisplay.seconds)

    return (
      <>
        {hasHours && (
          <>
            <span className={styles.timeUnit}>{timeDisplay.hours}</span>
            {renderTimerUnitLabel("h")}
            <span className={styles.colon}>:</span>
          </>
        )}
        <span className={styles.timeUnit}>{timeDisplay.minutes}</span>
        {renderTimerUnitLabel("m")}
        {hasSeconds && (
          <>
            <span className={styles.colon}>:</span>
            <span className={styles.timeUnit}>{timeDisplay.seconds}</span>
            {renderTimerUnitLabel("s")}
          </>
        )}
      </>
    )
  }

  const renderCurrentTimeDisplay = (isPrimary: boolean) => {
    const [hour = "", minute = "", second = ""] = currentTime.time.split(":")

    const renderDigitSlots = (value: string) => (
      value.padStart(2, "0").split("").map((digit, index) => (
        <span key={`${value}-${index}`} className={styles.currentTimeDigit}>{digit}</span>
      ))
    )

    if (!minute) {
      return (
        <span className={isPrimary ? styles.currentTimeStack : styles.currentTimeInline}>
          <span className={styles.currentTimeRow}>
            <span className={styles.currentTimeValue}>{currentTime.time}</span>
            {renderCurrentTimeMeridiem()}
          </span>
        </span>
      )
    }

    const renderTimeRow = (rowHour: string, rowMinute: string, rowSecond: string, meridiem: string) => (
      <span className={styles.currentTimeRow}>
        <span className={`${styles.timeUnit} ${styles.currentTimeUnit}`}>{renderDigitSlots(rowHour)}</span>
        <span className={`${styles.colon} ${styles.clockColon}`}>:</span>
        <span className={`${styles.timeUnit} ${styles.currentTimeUnit}`}>{renderDigitSlots(rowMinute)}</span>
        {rowSecond && (
          <>
            <span className={`${styles.colon} ${styles.clockColon}`}>:</span>
            <span className={`${styles.timeUnit} ${styles.currentTimeUnit}`}>{renderDigitSlots(rowSecond)}</span>
          </>
        )}
        {renderCurrentTimeMeridiem(meridiem)}
      </span>
    )

    return (
      <span className={isPrimary ? styles.currentTimeStack : styles.currentTimeInline}>
        {renderTimeRow(hour, minute, second, currentTime.meridiem)}
      </span>
    )
  }

  const chromeClassName = [
    styles.chrome,
    controlState === "faded" ? styles.chromeFaded : "",
    controlState === "hidden" ? styles.chromeHidden : "",
  ].filter(Boolean).join(" ")
  const containerStyle = {
    "--chimer-timer-color": resolvedTimerDisplayColor,
    "--chimer-clock-color": resolvedCurrentTimeDisplayColor,
    "--chimer-display-font-family": getClockFontStack(clockFontFamily),
    "--chimer-digit-stroke-width": clockStrokeEnabled ? `${clockStrokeWidth}px` : "0px",
    "--chimer-digit-stroke-color": resolvedClockStrokeColor,
    "--chimer-digit-glow": resolvedClockTextShadow,
    "--brand-orange": getCssHsl(globalPalettePrimary, DEFAULT_CHIMER_GLOBAL_COLORS.primary),
    "--brand-orange-soft": getCssHsl(globalPaletteSecondary, DEFAULT_CHIMER_GLOBAL_COLORS.secondary),
    "--brand-orange-glow": getCssHsl(globalPaletteAccent, DEFAULT_CHIMER_GLOBAL_COLORS.accent),
  } as CSSProperties
  const primaryDisplayStyle = {
    "--chimer-primary-font-size": `${fontSize}vw`,
    ...(fitFontSize ? { "--chimer-fit-font-size": `${fitFontSize}px` } : {}),
  } as CSSProperties
  const timerSwapClass = swapAnimationTarget
    ? swapAnimationTarget === "timer" ? styles.swapToPrimary : styles.swapToSecondary
    : ""
  const currentTimeSwapClass = swapAnimationTarget
    ? swapAnimationTarget === "currentTime" ? styles.swapToPrimary : styles.swapToSecondary
    : ""
  const accountColorDisabledHint = canUseCoreColorControls ? undefined : "Sign in to set clock and Lamp colors."
  const customColorDisabledHint = canUseCustomColors ? undefined : "Subscribe to unlock advanced custom color controls."
  const premiumBackgroundClassName = [
    styles.runningBackground,
    isFullscreen && backgroundId === "massage-lab-lamp-effect" ? styles.runningLampFullscreenBackground : "",
  ].filter(Boolean).join(" ")
  const fullscreenLampBeamScale = Math.min(4.2, Math.max(2.75, 2.25 + fontSize * 0.03))
  const fullscreenLampGlowScale = Math.min(3.65, Math.max(2.35, 1.95 + fontSize * 0.026))
  const fullscreenLampLineWidth = Math.min(78, Math.max(62, 48 + fontSize * 0.42))
  const fullscreenLampGlowWidth = Math.min(68, Math.max(52, 42 + fontSize * 0.36))
  const fullscreenLampCoreGlowWidth = Math.min(42, Math.max(30, 24 + fontSize * 0.2))
  const premiumBackgroundStyle = isFullscreen && backgroundId === "massage-lab-lamp-effect"
    ? {
      "--ml-lamp-beam-scale": fullscreenLampBeamScale,
      "--ml-lamp-glow-scale": fullscreenLampGlowScale,
      "--ml-lamp-min-render-width": `${fullscreenLampLineWidth}vw`,
      "--ml-lamp-min-glow-width": `${fullscreenLampGlowWidth}vw`,
      "--ml-lamp-min-core-glow-width": `${fullscreenLampCoreGlowWidth}vw`,
    } as CSSProperties
    : undefined

  return (
    <section
      className={`${styles.container} ${isClockMode ? styles.clockMode : ""} ${isAlerting ? styles.alerting : ""}`}
      aria-label={isClockMode ? "Chimer clock" : "Running Chimer timer"}
      style={containerStyle}
    >
      {shouldRenderLiveBackground && useOriginalLampBackground && (
        <MovingBackground
          className={styles.runningBackground}
          mainColor={resolvedMovingBackgroundMainColor}
          orbColor={resolvedMovingBackgroundOrbColor}
          testId="chimer-premium-background"
        />
      )}

      {shouldRenderLiveBackground && !useOriginalLampBackground && (
        <BackgroundHost
          className={premiumBackgroundClassName}
          style={premiumBackgroundStyle}
          selectedId={backgroundId}
          featureKeys={featureKeys}
          category={backgroundCategory}
          palette={getPaletteColorsFromGlobalValues(globalColors)}
          mainColor={resolvedMovingBackgroundMainColor}
          orbColor={resolvedMovingBackgroundOrbColor}
          sparkles={{
            maxSize: sparklesMaxSize,
            minSize: sparklesMinSize,
            particleColor: resolvedSparklesParticleColor,
            particleDensity: sparklesParticleDensity,
            speed: sparklesSpeed,
          }}
          gradientAnimation={{
            backgroundStartColor: resolvedGradientAnimationBackgroundStartColor,
            backgroundEndColor: resolvedGradientAnimationBackgroundEndColor,
            firstColor: resolvedGradientAnimationFirstColor,
            secondColor: resolvedGradientAnimationSecondColor,
            thirdColor: resolvedGradientAnimationThirdColor,
            fourthColor: resolvedGradientAnimationFourthColor,
            fifthColor: resolvedGradientAnimationFifthColor,
            speed: gradientAnimationSpeed,
            size: gradientAnimationSize,
          }}
          massageLabGradient={{
            primaryColor: resolvedMassageLabGradientPrimaryColor,
            harmony: massageLabGradientHarmony,
            opacity: massageLabGradientOpacity,
          }}
          massageLabStars={{
            starColor: resolvedMassageLabStarsColor,
            speed: massageLabStarsSpeed,
            density: massageLabStarsDensity,
            factor: massageLabStarsParallax,
          }}
          massageLabHole={{
            strokeColor: resolvedMassageLabHoleStrokeColor,
            particleColor: resolvedMassageLabHoleParticleColor,
            numberOfLines: massageLabHoleLineCount,
            numberOfDiscs: massageLabHoleDiscCount,
          }}
          massageLabLightSpeed={{
            warpSpeed: massageLabLightSpeedWarpSpeed,
            particleCount: massageLabLightSpeedParticleCount,
            lightColor: resolvedMassageLabLightSpeedLightColor,
            intensity: massageLabLightSpeedIntensity,
            radius: massageLabLightSpeedRadius,
            cylinderLength: massageLabLightSpeedCylinderLength,
          }}
          massageLabElectricMist={{
            color: resolvedMassageLabElectricMistColor,
            speed: massageLabElectricMistSpeed,
            detail: massageLabElectricMistDetail,
            distortion: massageLabElectricMistDistortion,
            brightness: massageLabElectricMistBrightness,
          }}
          massageLabAstralFlow={{
            color1: astralFlowColors[0],
            color2: astralFlowColors[1],
            color3: astralFlowColors[2],
            speed: massageLabAstralFlowSpeed,
            flowMin: massageLabAstralFlowFlowMin,
            flowMax: massageLabAstralFlowFlowMax,
          }}
          massageLabDeepSpaceNebula={{
            color1: deepSpaceNebulaColors[0],
            color2: deepSpaceNebulaColors[1],
            color3: deepSpaceNebulaColors[2],
            speed: massageLabDeepSpaceNebulaSpeed,
          }}
          massageLabGridBloom={{
            color: massageLabGridBloomColor,
            speed: massageLabGridBloomSpeed,
            gridScale: massageLabGridBloomGridScale,
            rotationSpeed: massageLabGridBloomRotationSpeed,
            fadeFalloff: massageLabGridBloomFadeFalloff,
            distortionAmount: massageLabGridBloomDistortionAmount,
            flowSpeedX: massageLabGridBloomFlowSpeedX,
            flowSpeedY: massageLabGridBloomFlowSpeedY,
          }}
          massageLabChromeFlow={{
            color: liquidChromeColors[0],
            color2: liquidChromeColors[1],
            speed: massageLabChromeFlowFlowSpeed,
            timeScale: massageLabChromeFlowTimeScale,
          }}
          massageLabWaveCurrent={{
            backgroundColor: wavesColors[0],
            waveColor1: wavesColors[1],
            waveColor2: wavesColors[2],
            waveColor3: wavesColors[3],
            waveSpeedX: massageLabWaveCurrentSpeedX,
            waveSpeedY: massageLabWaveCurrentSpeedY,
            waveAmpX: massageLabWaveCurrentAmplitude,
          }}
          massageLabFerrofluid={{
            colors: ferrofluidColors,
            speed: massageLabFerrofluidSpeed,
            scale: massageLabFerrofluidScale,
            turbulence: massageLabFerrofluidTurbulence,
            fluidity: massageLabFerrofluidFluidity,
            rimWidth: massageLabFerrofluidRimWidth,
            sharpness: massageLabFerrofluidSharpness,
            shimmer: massageLabFerrofluidShimmer,
            glow: massageLabFerrofluidGlow,
            flowDirection: massageLabFerrofluidFlowDirection,
            opacity: massageLabFerrofluidOpacity,
          }}
          massageLabLightfall={{
            colors: lightfallColors,
            backgroundColor: massageLabLightfallBackgroundColor,
            speed: massageLabLightfallSpeed,
            streakCount: massageLabLightfallStreakCount,
            streakWidth: massageLabLightfallStreakWidth,
            streakLength: massageLabLightfallStreakLength,
            glow: massageLabLightfallGlow,
            density: massageLabLightfallDensity,
            twinkle: massageLabLightfallTwinkle,
            zoom: massageLabLightfallZoom,
            backgroundGlow: massageLabLightfallBackgroundGlow,
            opacity: massageLabLightfallOpacity,
            mouseInteraction: massageLabLightfallCursorEnabled,
            mouseStrength: massageLabLightfallCursorStrength,
            mouseRadius: massageLabLightfallCursorRadius,
            mouseDampening: massageLabLightfallCursorDampening,
          }}
          massageLabLiquidEther={{
            colors: liquidEtherColors,
            mouseInteraction: massageLabLiquidEtherCursorEnabled,
            mouseForce: massageLabLiquidEtherMouseForce,
            cursorSize: massageLabLiquidEtherCursorSize,
            isViscous: massageLabLiquidEtherIsViscous,
            viscous: massageLabLiquidEtherViscous,
            iterationsViscous: massageLabLiquidEtherIterationsViscous,
            iterationsPoisson: massageLabLiquidEtherIterationsPoisson,
            dt: massageLabLiquidEtherDt,
            bfecc: massageLabLiquidEtherBfecc,
            resolution: massageLabLiquidEtherResolution,
            isBounce: massageLabLiquidEtherIsBounce,
            autoDemo: massageLabLiquidEtherAutoDemo,
            autoSpeed: massageLabLiquidEtherAutoSpeed,
            autoIntensity: massageLabLiquidEtherAutoIntensity,
            autoResumeDelay: massageLabLiquidEtherAutoResumeDelay,
            autoRampDuration: massageLabLiquidEtherAutoRampDuration,
            opacity: massageLabLiquidEtherOpacity,
          }}
          massageLabPrism={{
            height: massageLabPrismHeight,
            baseWidth: massageLabPrismBaseWidth,
            animationType: massageLabPrismAnimationType,
            glow: massageLabPrismGlow,
            offsetX: massageLabPrismOffsetX,
            offsetY: massageLabPrismOffsetY,
            noise: massageLabPrismNoise,
            transparent: massageLabPrismTransparent,
            scale: massageLabPrismScale,
            hueShift: massageLabPrismHueShift,
            colorFrequency: massageLabPrismColorFrequency,
            hoverStrength: massageLabPrismHoverStrength,
            inertia: massageLabPrismInertia,
            bloom: massageLabPrismBloom,
            timeScale: massageLabPrismTimeScale,
          }}
          massageLabDarkVeil={{
            hueShift: massageLabDarkVeilHueShift,
            noiseIntensity: massageLabDarkVeilNoiseIntensity,
            scanlineIntensity: massageLabDarkVeilScanlineIntensity,
            speed: massageLabDarkVeilSpeed,
            scanlineFrequency: massageLabDarkVeilScanlineFrequency,
            warpAmount: massageLabDarkVeilWarpAmount,
            resolutionScale: massageLabDarkVeilResolutionScale,
          }}
          massageLabLightPillar={{
            topColor: lightPillarColors[0],
            bottomColor: lightPillarColors[1],
            intensity: massageLabLightPillarIntensity,
            rotationSpeed: massageLabLightPillarRotationSpeed,
            interactive: massageLabLightPillarInteractive,
            glowAmount: massageLabLightPillarGlowAmount,
            pillarWidth: massageLabLightPillarWidth,
            pillarHeight: massageLabLightPillarHeight,
            noiseIntensity: massageLabLightPillarNoiseIntensity,
            mixBlendMode: massageLabLightPillarBlendMode,
            pillarRotation: massageLabLightPillarRotation,
            quality: massageLabLightPillarQuality,
          }}
          massageLabSilk={{
            color: silkColor,
            speed: massageLabSilkSpeed,
            scale: massageLabSilkScale,
            noiseIntensity: massageLabSilkNoiseIntensity,
            rotation: massageLabSilkRotation,
          }}
          massageLabFloatingLines={{
            linesGradient: floatingLinesGradient,
            enableTop: massageLabFloatingLinesEnableTop,
            enableMiddle: massageLabFloatingLinesEnableMiddle,
            enableBottom: massageLabFloatingLinesEnableBottom,
            topLineCount: massageLabFloatingLinesTopLineCount,
            middleLineCount: massageLabFloatingLinesMiddleLineCount,
            bottomLineCount: massageLabFloatingLinesBottomLineCount,
            topLineDistance: massageLabFloatingLinesTopLineDistance,
            middleLineDistance: massageLabFloatingLinesMiddleLineDistance,
            bottomLineDistance: massageLabFloatingLinesBottomLineDistance,
            topWaveX: massageLabFloatingLinesTopWaveX,
            topWaveY: massageLabFloatingLinesTopWaveY,
            topWaveRotate: massageLabFloatingLinesTopWaveRotate,
            middleWaveX: massageLabFloatingLinesMiddleWaveX,
            middleWaveY: massageLabFloatingLinesMiddleWaveY,
            middleWaveRotate: massageLabFloatingLinesMiddleWaveRotate,
            bottomWaveX: massageLabFloatingLinesBottomWaveX,
            bottomWaveY: massageLabFloatingLinesBottomWaveY,
            bottomWaveRotate: massageLabFloatingLinesBottomWaveRotate,
            animationSpeed: massageLabFloatingLinesAnimationSpeed,
            interactive: massageLabFloatingLinesInteractive,
            bendRadius: massageLabFloatingLinesBendRadius,
            bendStrength: massageLabFloatingLinesBendStrength,
            mouseDamping: massageLabFloatingLinesMouseDamping,
            parallax: massageLabFloatingLinesParallax,
            parallaxStrength: massageLabFloatingLinesParallaxStrength,
            mixBlendMode: massageLabFloatingLinesBlendMode,
          }}
          massageLabSideRays={{
            rayColor1: sideRaysColors[0],
            rayColor2: sideRaysColors[1],
            speed: massageLabSideRaysSpeed,
            intensity: massageLabSideRaysIntensity,
            spread: massageLabSideRaysSpread,
            origin: massageLabSideRaysOrigin,
            tilt: massageLabSideRaysTilt,
            saturation: massageLabSideRaysSaturation,
            blend: massageLabSideRaysBlend,
            falloff: massageLabSideRaysFalloff,
            opacity: massageLabSideRaysOpacity,
          }}
          massageLabLightRays={{
            raysOrigin: massageLabLightRaysOrigin,
            raysColor: lightRaysColor,
            raysSpeed: massageLabLightRaysSpeed,
            lightSpread: massageLabLightRaysSpread,
            rayLength: massageLabLightRaysLength,
            pulsating: massageLabLightRaysPulsating,
            fadeDistance: massageLabLightRaysFadeDistance,
            saturation: massageLabLightRaysSaturation,
            followMouse: massageLabLightRaysFollowMouse,
            mouseInfluence: massageLabLightRaysMouseInfluence,
            noiseAmount: massageLabLightRaysNoiseAmount,
            distortion: massageLabLightRaysDistortion,
          }}
          massageLabPixelBlast={{
            variant: massageLabPixelBlastVariant,
            pixelSize: massageLabPixelBlastPixelSize,
            color: pixelBlastColor,
            antialias: massageLabPixelBlastAntialias,
            patternScale: massageLabPixelBlastPatternScale,
            patternDensity: massageLabPixelBlastPatternDensity,
            liquid: massageLabPixelBlastLiquid,
            liquidStrength: massageLabPixelBlastLiquidStrength,
            liquidRadius: massageLabPixelBlastLiquidRadius,
            pixelSizeJitter: massageLabPixelBlastPixelSizeJitter,
            enableRipples: massageLabPixelBlastEnableRipples,
            rippleIntensityScale: massageLabPixelBlastRippleIntensityScale,
            rippleThickness: massageLabPixelBlastRippleThickness,
            rippleSpeed: massageLabPixelBlastRippleSpeed,
            liquidWobbleSpeed: massageLabPixelBlastLiquidWobbleSpeed,
            autoPauseOffscreen: massageLabPixelBlastAutoPauseOffscreen,
            speed: massageLabPixelBlastSpeed,
            transparent: massageLabPixelBlastTransparent,
            edgeFade: massageLabPixelBlastEdgeFade,
            noiseAmount: massageLabPixelBlastNoiseAmount,
          }}
          massageLabColorBends={{
            rotation: massageLabColorBendsRotation,
            speed: massageLabColorBendsSpeed,
            colors: colorBendsColors,
            transparent: massageLabColorBendsTransparent,
            autoRotate: massageLabColorBendsAutoRotate,
            scale: massageLabColorBendsScale,
            frequency: massageLabColorBendsFrequency,
            warpStrength: massageLabColorBendsWarpStrength,
            interactive: massageLabColorBendsInteractive,
            mouseInfluence: massageLabColorBendsMouseInfluence,
            parallax: massageLabColorBendsParallax,
            noise: massageLabColorBendsNoise,
            iterations: massageLabColorBendsIterations,
            intensity: massageLabColorBendsIntensity,
            bandWidth: massageLabColorBendsBandWidth,
          }}
          massageLabEvilEye={{
            eyeColor: evilEyeColor,
            intensity: massageLabEvilEyeIntensity,
            pupilSize: massageLabEvilEyePupilSize,
            irisWidth: massageLabEvilEyeIrisWidth,
            glowIntensity: massageLabEvilEyeGlowIntensity,
            scale: massageLabEvilEyeScale,
            noiseScale: massageLabEvilEyeNoiseScale,
            pupilFollow: massageLabEvilEyePupilFollow,
            flameSpeed: massageLabEvilEyeFlameSpeed,
            backgroundColor: massageLabEvilEyeBackgroundColor,
            interactive: massageLabEvilEyeInteractive,
          }}
          massageLabLineWaves={{
            color1: lineWavesColors[0],
            color2: lineWavesColors[1],
            color3: lineWavesColors[2],
            speed: massageLabLineWavesSpeed,
            innerLineCount: massageLabLineWavesInnerLineCount,
            outerLineCount: massageLabLineWavesOuterLineCount,
            warpIntensity: massageLabLineWavesWarpIntensity,
            rotation: massageLabLineWavesRotation,
            edgeFadeWidth: massageLabLineWavesEdgeFadeWidth,
            colorCycleSpeed: massageLabLineWavesColorCycleSpeed,
            brightness: massageLabLineWavesBrightness,
            enableMouseInteraction: massageLabLineWavesEnableMouseInteraction,
            mouseInfluence: massageLabLineWavesMouseInfluence,
          }}
          massageLabRadar={{
            color: radarColor,
            backgroundColor: massageLabRadarBackgroundColor,
            speed: massageLabRadarSpeed,
            scale: massageLabRadarScale,
            ringCount: massageLabRadarRingCount,
            spokeCount: massageLabRadarSpokeCount,
            ringThickness: massageLabRadarRingThickness,
            spokeThickness: massageLabRadarSpokeThickness,
            sweepSpeed: massageLabRadarSweepSpeed,
            sweepWidth: massageLabRadarSweepWidth,
            sweepLobes: massageLabRadarSweepLobes,
            falloff: massageLabRadarFalloff,
            brightness: massageLabRadarBrightness,
            enableMouseInteraction: massageLabRadarEnableMouseInteraction,
            mouseInfluence: massageLabRadarMouseInfluence,
          }}
          massageLabSoftAurora={{
            color1: softAuroraColors[0],
            color2: softAuroraColors[1],
            speed: massageLabSoftAuroraSpeed,
            scale: massageLabSoftAuroraScale,
            brightness: massageLabSoftAuroraBrightness,
            noiseFrequency: massageLabSoftAuroraNoiseFrequency,
            noiseAmplitude: massageLabSoftAuroraNoiseAmplitude,
            bandHeight: massageLabSoftAuroraBandHeight,
            bandSpread: massageLabSoftAuroraBandSpread,
            octaveDecay: massageLabSoftAuroraOctaveDecay,
            layerOffset: massageLabSoftAuroraLayerOffset,
            colorSpeed: massageLabSoftAuroraColorSpeed,
            enableMouseInteraction: massageLabSoftAuroraEnableMouseInteraction,
            mouseInfluence: massageLabSoftAuroraMouseInfluence,
          }}
          massageLabPlasma={{
            color: plasmaColor,
            speed: massageLabPlasmaSpeed,
            direction: massageLabPlasmaDirection,
            scale: massageLabPlasmaScale,
            opacity: massageLabPlasmaOpacity,
            mouseInteractive: massageLabPlasmaMouseInteractive,
          }}
          massageLabPlasmaWave={{
            colors: plasmaWaveColors,
            xOffset: massageLabPlasmaWaveXOffset,
            yOffset: massageLabPlasmaWaveYOffset,
            rotationDeg: massageLabPlasmaWaveRotationDeg,
            focalLength: massageLabPlasmaWaveFocalLength,
            speed1: massageLabPlasmaWaveSpeedOne,
            speed2: massageLabPlasmaWaveSpeedTwo,
            dir2: massageLabPlasmaWaveDirectionTwo,
            bend1: massageLabPlasmaWaveBendOne,
            bend2: massageLabPlasmaWaveBendTwo,
          }}
          massageLabParticles={{
            colors: particlesColors,
            particleCount: massageLabParticlesCount,
            particleSpread: massageLabParticlesSpread,
            speed: massageLabParticlesSpeed,
            moveParticlesOnHover: massageLabParticlesMoveOnHover,
            particleHoverFactor: massageLabParticlesHoverFactor,
            alphaParticles: massageLabParticlesAlpha,
            particleBaseSize: massageLabParticlesBaseSize,
            sizeRandomness: massageLabParticlesSizeRandomness,
            cameraDistance: massageLabParticlesCameraDistance,
            disableRotation: massageLabParticlesDisableRotation,
            pixelRatio: massageLabParticlesPixelRatio,
          }}
          massageLabGradientBlinds={{
            dpr: massageLabGradientBlindsDpr,
            gradientColors: gradientBlindsColors,
            angle: massageLabGradientBlindsAngle,
            noise: massageLabGradientBlindsNoise,
            blindCount: massageLabGradientBlindsBlindCount,
            blindMinWidth: massageLabGradientBlindsBlindMinWidth,
            mouseDampening: massageLabGradientBlindsMouseDampening,
            mirrorGradient: massageLabGradientBlindsMirror,
            spotlightRadius: massageLabGradientBlindsSpotlightRadius,
            spotlightSoftness: massageLabGradientBlindsSpotlightSoftness,
            spotlightOpacity: massageLabGradientBlindsSpotlightOpacity,
            distortAmount: massageLabGradientBlindsDistort,
            shineDirection: massageLabGradientBlindsShineDirection,
            mixBlendMode: massageLabGradientBlindsBlendMode,
            enableMouseInteraction: massageLabGradientBlindsEnableMouseInteraction,
          }}
          massageLabGrainient={{
            color1: grainientColors[0],
            color2: grainientColors[1],
            color3: grainientColors[2],
            timeSpeed: massageLabGrainientTimeSpeed,
            colorBalance: massageLabGrainientColorBalance,
            warpStrength: massageLabGrainientWarpStrength,
            warpFrequency: massageLabGrainientWarpFrequency,
            warpSpeed: massageLabGrainientWarpSpeed,
            warpAmplitude: massageLabGrainientWarpAmplitude,
            blendAngle: massageLabGrainientBlendAngle,
            blendSoftness: massageLabGrainientBlendSoftness,
            rotationAmount: massageLabGrainientRotationAmount,
            noiseScale: massageLabGrainientNoiseScale,
            grainAmount: massageLabGrainientGrainAmount,
            grainScale: massageLabGrainientGrainScale,
            grainAnimated: massageLabGrainientGrainAnimated,
            contrast: massageLabGrainientContrast,
            gamma: massageLabGrainientGamma,
            saturation: massageLabGrainientSaturation,
            centerX: massageLabGrainientCenterX,
            centerY: massageLabGrainientCenterY,
            zoom: massageLabGrainientZoom,
          }}
          massageLabGridScan={{
            linesColor: gridScanColors[0],
            scanColor: gridScanColors[1],
            sensitivity: massageLabGridScanSensitivity,
            lineThickness: massageLabGridScanLineThickness,
            scanOpacity: massageLabGridScanScanOpacity,
            gridScale: massageLabGridScanGridScale,
            lineStyle: massageLabGridScanLineStyle,
            lineJitter: massageLabGridScanLineJitter,
            scanDirection: massageLabGridScanDirection,
            noiseIntensity: massageLabGridScanNoiseIntensity,
            bloomOpacity: massageLabGridScanBloomOpacity,
            scanGlow: massageLabGridScanScanGlow,
            scanSoftness: massageLabGridScanScanSoftness,
            scanPhaseTaper: massageLabGridScanPhaseTaper,
            scanDuration: massageLabGridScanScanDuration,
            scanDelay: massageLabGridScanScanDelay,
            enablePointerInteraction: massageLabGridScanEnablePointerInteraction,
            scanOnClick: massageLabGridScanScanOnClick,
          }}
          massageLabBeams={{
            lightColor: beamsColor,
            beamWidth: massageLabBeamsBeamWidth,
            beamHeight: massageLabBeamsBeamHeight,
            beamNumber: massageLabBeamsBeamNumber,
            speed: massageLabBeamsSpeed,
            noiseIntensity: massageLabBeamsNoiseIntensity,
            scale: massageLabBeamsScale,
            rotation: massageLabBeamsRotation,
          }}
          massageLabPixelSnow={{
            color: pixelSnowColor,
            flakeSize: massageLabPixelSnowFlakeSize,
            minFlakeSize: massageLabPixelSnowMinFlakeSize,
            pixelResolution: massageLabPixelSnowPixelResolution,
            speed: massageLabPixelSnowSpeed,
            depthFade: massageLabPixelSnowDepthFade,
            farPlane: massageLabPixelSnowFarPlane,
            brightness: massageLabPixelSnowBrightness,
            gamma: massageLabPixelSnowGamma,
            density: massageLabPixelSnowDensity,
            variant: massageLabPixelSnowVariant,
            direction: massageLabPixelSnowDirection,
          }}
          massageLabLightning={{
            hue: lightningHue,
            xOffset: massageLabLightningXOffset,
            speed: massageLabLightningSpeed,
            intensity: massageLabLightningIntensity,
            size: massageLabLightningSize,
          }}
          massageLabPrismaticBurst={{
            colors: prismaticBurstColors,
            intensity: massageLabPrismaticBurstIntensity,
            speed: massageLabPrismaticBurstSpeed,
            animationType: massageLabPrismaticBurstAnimationType,
            distort: massageLabPrismaticBurstDistort,
            offsetX: massageLabPrismaticBurstOffsetX,
            offsetY: massageLabPrismaticBurstOffsetY,
            hoverDampness: massageLabPrismaticBurstHoverDampness,
            rayCount: massageLabPrismaticBurstRayCount,
            mixBlendMode: massageLabPrismaticBurstMixBlendMode,
          }}
          massageLabGalaxy={{
            focalX: massageLabGalaxyFocalX,
            focalY: massageLabGalaxyFocalY,
            rotationDeg: massageLabGalaxyRotationDeg,
            starSpeed: massageLabGalaxyStarSpeed,
            density: massageLabGalaxyDensity,
            hueShift: galaxyHueShift,
            speed: massageLabGalaxySpeed,
            mouseInteraction: massageLabGalaxyMouseInteraction,
            glowIntensity: massageLabGalaxyGlowIntensity,
            saturation: massageLabGalaxySaturation,
            mouseRepulsion: massageLabGalaxyMouseRepulsion,
            repulsionStrength: massageLabGalaxyRepulsionStrength,
            twinkleIntensity: massageLabGalaxyTwinkleIntensity,
            rotationSpeed: massageLabGalaxyRotationSpeed,
            autoCenterRepulsion: massageLabGalaxyAutoCenterRepulsion,
            transparent: massageLabGalaxyTransparent,
          }}
          massageLabDither={{
            color: ditherColor,
            waveSpeed: massageLabDitherWaveSpeed,
            waveFrequency: massageLabDitherWaveFrequency,
            waveAmplitude: massageLabDitherWaveAmplitude,
            colorNum: massageLabDitherColorNum,
            pixelSize: massageLabDitherPixelSize,
            mouseInteraction: massageLabDitherMouseInteraction,
            mouseRadius: massageLabDitherMouseRadius,
          }}
          massageLabFaultyTerminal={{
            tint: faultyTerminalTint,
            scale: massageLabFaultyTerminalScale,
            gridMulX: massageLabFaultyTerminalGridMulX,
            gridMulY: massageLabFaultyTerminalGridMulY,
            digitSize: massageLabFaultyTerminalDigitSize,
            timeScale: massageLabFaultyTerminalTimeScale,
            scanlineIntensity: massageLabFaultyTerminalScanlineIntensity,
            glitchAmount: massageLabFaultyTerminalGlitchAmount,
            flickerAmount: massageLabFaultyTerminalFlickerAmount,
            noiseAmp: massageLabFaultyTerminalNoiseAmp,
            chromaticAberration: massageLabFaultyTerminalChromaticAberration,
            dither: massageLabFaultyTerminalDither,
            curvature: massageLabFaultyTerminalCurvature,
            mouseReact: massageLabFaultyTerminalMouseReact,
            mouseStrength: massageLabFaultyTerminalMouseStrength,
            pageLoadAnimation: massageLabFaultyTerminalPageLoadAnimation,
            brightness: massageLabFaultyTerminalBrightness,
          }}
          massageLabRippleGrid={{
            enableRainbow: massageLabRippleGridPaletteMode === "rainbow",
            gridColor: rippleGridColor,
            rippleIntensity: massageLabRippleGridRippleIntensity,
            gridSize: massageLabRippleGridGridSize,
            gridThickness: massageLabRippleGridGridThickness,
            fadeDistance: massageLabRippleGridFadeDistance,
            vignetteStrength: massageLabRippleGridVignetteStrength,
            glowIntensity: massageLabRippleGridGlowIntensity,
            opacity: massageLabRippleGridOpacity,
            gridRotation: massageLabRippleGridGridRotation,
            mouseInteraction: massageLabRippleGridMouseInteraction,
            mouseInteractionRadius: massageLabRippleGridMouseInteractionRadius,
          }}
          massageLabDotField={{
            dotRadius: massageLabDotFieldDotRadius,
            dotSpacing: massageLabDotFieldDotSpacing,
            cursorRadius: massageLabDotFieldCursorRadius,
            cursorForce: massageLabDotFieldCursorForce,
            bulgeOnly: massageLabDotFieldBulgeOnly,
            bulgeStrength: massageLabDotFieldBulgeStrength,
            glowRadius: massageLabDotFieldGlowRadius,
            sparkle: massageLabDotFieldSparkle,
            waveAmplitude: massageLabDotFieldWaveAmplitude,
            gradientFrom: dotFieldColors.gradientFrom,
            gradientTo: dotFieldColors.gradientTo,
            glowColor: dotFieldColors.glowColor,
            cursorInteraction: massageLabDotFieldCursorInteraction,
          }}
          massageLabDotGrid={{
            dotSize: massageLabDotGridDotSize,
            gap: massageLabDotGridGap,
            baseColor: dotGridColors[0],
            activeColor: dotGridColors[1],
            proximity: massageLabDotGridProximity,
            speedTrigger: massageLabDotGridSpeedTrigger,
            shockRadius: massageLabDotGridShockRadius,
            shockStrength: massageLabDotGridShockStrength,
            maxSpeed: massageLabDotGridMaxSpeed,
            resistance: massageLabDotGridResistance,
            returnDuration: massageLabDotGridReturnDuration,
            cursorInteraction: massageLabDotGridCursorInteraction,
            clickShock: massageLabDotGridClickShock,
          }}
          massageLabThreads={{
            color: threadsColor,
            amplitude: massageLabThreadsAmplitude,
            distance: massageLabThreadsDistance,
            enableMouseInteraction: massageLabThreadsEnableMouseInteraction,
          }}
          massageLabIridescence={{
            color: iridescenceColor,
            speed: massageLabIridescenceSpeed,
            amplitude: massageLabIridescenceAmplitude,
            mouseReact: massageLabIridescenceMouseReact,
          }}
          massageLabWaves={{
            lineColor: wavesLineColor,
            backgroundColor: massageLabWavesBackgroundColor,
            transparentBackground: massageLabWavesTransparentBackground,
            waveSpeedX: massageLabWavesSpeedX,
            waveSpeedY: massageLabWavesSpeedY,
            waveAmpX: massageLabWavesAmplitudeX,
            waveAmpY: massageLabWavesAmplitudeY,
            xGap: massageLabWavesGapX,
            yGap: massageLabWavesGapY,
            friction: massageLabWavesFriction,
            tension: massageLabWavesTension,
            maxCursorMove: massageLabWavesMaxCursorMove,
            cursorInteraction: massageLabWavesCursorInteraction,
          }}
          massageLabGridDistortion={{
            colorOne: gridDistortionColors[0],
            colorTwo: gridDistortionColors[1],
            colorThree: gridDistortionColors[2],
            grid: massageLabGridDistortionGrid,
            mouse: massageLabGridDistortionMouse,
            strength: massageLabGridDistortionStrength,
            relaxation: massageLabGridDistortionRelaxation,
            cursorInteraction: massageLabGridDistortionCursorInteraction,
          }}
          massageLabOrb={{
            hue: orbHue,
            hoverIntensity: massageLabOrbHoverIntensity,
            rotateOnHover: massageLabOrbRotateOnHover,
            forceHoverState: massageLabOrbForceHoverState,
            backgroundColor: massageLabOrbBackgroundColor,
            cursorInteraction: massageLabOrbCursorInteraction,
          }}
          massageLabLetterGlitch={{
            colorOne: letterGlitchColors[0],
            colorTwo: letterGlitchColors[1],
            colorThree: letterGlitchColors[2],
            glitchSpeed: massageLabLetterGlitchGlitchSpeed,
            centerVignette: massageLabLetterGlitchCenterVignette,
            outerVignette: massageLabLetterGlitchOuterVignette,
            smooth: massageLabLetterGlitchSmooth,
            characters: massageLabLetterGlitchCharacters,
          }}
          massageLabGridMotion={{
            gradientColor: gridMotionColors[0],
            tileColor: gridMotionColors[1],
            textColor: gridMotionColors[2],
            maxMoveAmount: massageLabGridMotionMaxMoveAmount,
            baseDuration: massageLabGridMotionBaseDuration,
            cursorInteraction: massageLabGridMotionCursorInteraction,
          }}
          massageLabShapeGrid={{
            borderColor: shapeGridColors[0],
            hoverFillColor: shapeGridColors[1],
            direction: massageLabShapeGridDirection,
            speed: massageLabShapeGridSpeed,
            squareSize: massageLabShapeGridSquareSize,
            shape: massageLabShapeGridShape,
            hoverTrailAmount: massageLabShapeGridHoverTrailAmount,
            cursorInteraction: massageLabShapeGridCursorInteraction,
          }}
          massageLabLiquidChrome={{
            baseColor: liquidChromeBaseColor,
            speed: massageLabLiquidChromeSpeed,
            amplitude: massageLabLiquidChromeAmplitude,
            frequencyX: massageLabLiquidChromeFrequencyX,
            frequencyY: massageLabLiquidChromeFrequencyY,
            interactive: massageLabLiquidChromeInteractive,
          }}
          massageLabBalatro={{
            color1: balatroColors[0],
            color2: balatroColors[1],
            color3: balatroColors[2],
            spinRotation: massageLabBalatroSpinRotation,
            spinSpeed: massageLabBalatroSpinSpeed,
            offsetX: massageLabBalatroOffsetX,
            offsetY: massageLabBalatroOffsetY,
            contrast: massageLabBalatroContrast,
            lighting: massageLabBalatroLighting,
            spinAmount: massageLabBalatroSpinAmount,
            pixelFilter: massageLabBalatroPixelFilter,
            spinEase: massageLabBalatroSpinEase,
            isRotate: massageLabBalatroIsRotate,
            mouseInteraction: massageLabBalatroMouseInteraction,
          }}
          massageLabNovatrix={{
            color: novatrixColor,
            speed: massageLabNovatrixSpeed,
            amplitude: massageLabNovatrixAmplitude,
          }}
          massageLabMatrixRain={{
            color: matrixRainColor,
            speed: massageLabMatrixRainSpeed,
            fontSize: massageLabMatrixRainFontSize,
          }}
          massageLabPhotonBeam={{
            colorBg: photonBeamColors[0],
            colorLine: photonBeamColors[1],
            colorSignal: photonBeamColors[2],
            useColor2: photonBeamColors[3],
            colorSignal2: photonBeamColors[4],
            useColor3: photonBeamColors[5],
            colorSignal3: photonBeamColors[6],
            lineCount: massageLabPhotonBeamLineCount,
            spreadHeight: massageLabPhotonBeamSpreadHeight,
            spreadDepth: massageLabPhotonBeamSpreadDepth,
            curveLength: massageLabPhotonBeamCurveLength,
            straightLength: massageLabPhotonBeamStraightLength,
            curvePower: massageLabPhotonBeamCurvePower,
            waveSpeed: massageLabPhotonBeamWaveSpeed,
            waveHeight: massageLabPhotonBeamWaveHeight,
            lineOpacity: massageLabPhotonBeamLineOpacity,
            signalCount: massageLabPhotonBeamSignalCount,
            speedGlobal: massageLabPhotonBeamSpeedGlobal,
            trailLength: massageLabPhotonBeamTrailLength,
            bloomStrength: massageLabPhotonBeamBloomStrength,
            bloomRadius: massageLabPhotonBeamBloomRadius,
          }}
          massageLab3DGlobe={{
            viewStyle: massageLab3DGlobeViewStyle,
            backgroundColor: massageLab3DGlobeBackgroundColor,
            globeColor: massageLab3DGlobeGlobeColor,
            graphicMapColor: massageLab3DGlobeGraphicMapColor,
            graphicGlowColor: massageLab3DGlobeGraphicGlowColor,
            graphicMarkerColor: massageLab3DGlobeGraphicMarkerColor,
            graphicMapSamples: massageLab3DGlobeGraphicMapSamples,
            autoRotateSpeed: massageLab3DGlobeAutoRotateSpeed,
            reverseSpin: massageLab3DGlobeReverseSpin,
            globeScale: massageLab3DGlobeScale,
            bumpScale: massageLab3DGlobeBumpScale,
            ambientIntensity: massageLab3DGlobeAmbientIntensity,
            pointLightIntensity: massageLab3DGlobePointLightIntensity,
            lightingMode: massageLab3DGlobeLightingMode,
            enablePan: massageLab3DGlobeEnablePan,
            panX: massageLab3DGlobePanX,
            panY: massageLab3DGlobePanY,
            showTilt: massageLab3DGlobeShowTilt,
            showAtmosphere: massageLab3DGlobeShowAtmosphere,
            atmosphereColor: massageLab3DGlobeAtmosphereColor,
            atmosphereIntensity: massageLab3DGlobeAtmosphereIntensity,
            atmosphereBlur: massageLab3DGlobeAtmosphereBlur,
            showWireframe: massageLab3DGlobeShowWireframe,
            wireframeColor: massageLab3DGlobeWireframeColor,
            markerEnabled: massageLab3DGlobeMarkerEnabled,
            markerLat: massageLab3DGlobeMarkerLat,
            markerLng: massageLab3DGlobeMarkerLng,
            markerLabel: massageLab3DGlobeMarkerLabel,
            markerIcon: massageLab3DGlobeMarkerIcon,
            markerSize: massageLab3DGlobeMarkerSize,
          }}
          massageLabRetroGrid={{
            backgroundColor: massageLabRetroGridBackgroundColor,
            lightLineColor: massageLabRetroGridLightLineColor,
            darkLineColor: massageLabRetroGridDarkLineColor,
            angle: massageLabRetroGridAngle,
            cellSize: massageLabRetroGridCellSize,
            opacity: massageLabRetroGridOpacity,
          }}
          massageLabAerialRays={{
            backgroundColor: massageLabAerialRaysBackgroundColor,
            color: massageLabAerialRaysColor,
            count: massageLabAerialRaysCount,
            blur: massageLabAerialRaysBlur,
            speed: massageLabAerialRaysSpeed,
            length: massageLabAerialRaysLength,
            opacity: massageLabAerialRaysOpacity,
          }}
          massageLabSynthesis={{
            color1: synthesisColors[0],
            color2: synthesisColors[1],
            color3: synthesisColors[2],
            speed: massageLabSynthesisSpeed,
            complexity: massageLabSynthesisComplexity,
            scale: massageLabSynthesisScale,
            distortion: massageLabSynthesisDistortion,
            glowIntensity: massageLabSynthesisGlowIntensity,
            flowFrequency: massageLabSynthesisFlowFrequency,
          }}
          backgroundLines={{
            duration: backgroundLinesDuration,
          }}
          shootingStars={{
            starColor: shootingStarsStarColor,
            trailColor: shootingStarsTrailColor,
            shootingStarColor: shootingStarsShootingStarColor,
            starDensity: shootingStarsDensity,
            twinkle: shootingStarsTwinkle,
            twinkleSpeed: shootingStarsTwinkleSpeed,
            shootingStarSpeed: shootingStarsShootingSpeed,
            shootingStarFrequency: shootingStarsFrequency,
          }}
          canvasRevealDots={{
            backgroundColor: canvasRevealDotsBackgroundColor,
            dotColor: canvasRevealDotsDotColor,
            accentColor: canvasRevealDotsAccentColor,
            dotSize: canvasRevealDotsDotSize,
            dotSpacing: canvasRevealDotsDotSpacing,
            opacity: canvasRevealDotsOpacity,
            animationSpeed: canvasRevealDotsAnimationSpeed,
            showGradient: canvasRevealDotsShowGradient,
          }}
          spotlight={{
            color: spotlightColor,
            opacity: spotlightOpacity,
            width: spotlightWidth,
            height: spotlightHeight,
            smallWidth: spotlightSmallWidth,
            translateY: spotlightTranslateY,
            duration: spotlightDuration,
            xOffset: spotlightXOffset,
          }}
          lamp={{
            backgroundColor: lampBackgroundColor,
            color: lampColor,
            glowOpacity: lampGlowOpacity,
            beamWidth: lampBeamWidth,
            glowWidth: lampGlowWidth,
            verticalOffset: lampVerticalOffset,
            pulseSpeed: lampPulseSpeed,
          }}
          vortex={{
            backgroundColor: vortexBackgroundColor,
            baseHue: vortexBaseHue,
            particleCount: vortexParticleCount,
            rangeY: vortexRangeY,
            baseSpeed: vortexBaseSpeed,
            rangeSpeed: vortexRangeSpeed,
            baseRadius: vortexBaseRadius,
            rangeRadius: vortexRangeRadius,
          }}
          wavy={{
            backgroundFill: wavyBackgroundFill,
            colors: [
              wavyColorOne,
              wavyColorTwo,
              wavyColorThree,
              wavyColorFour,
              wavyColorFive,
            ],
            waveWidth: wavyWaveWidth,
            blur: wavyBlur,
            speed: wavySpeed,
            waveOpacity: wavyWaveOpacity,
          }}
          auroraBars={{
            background: auroraBarsBackgroundColor,
            paletteMode: auroraBarsPaletteMode,
            primaryColor: auroraBarsPrimaryColor,
            colors: [
              auroraBarsColorOne,
              auroraBarsColorTwo,
              auroraBarsColorThree,
              auroraBarsColorFour,
              auroraBarsColorFive,
            ],
            barCount: auroraBarsBarCount,
            speed: auroraBarsSpeed,
            blur: auroraBarsBlur,
            gap: auroraBarsGap,
            maxHeightRatio: auroraBarsMaxHeightRatio,
            minHeightRatio: auroraBarsMinHeightRatio,
          }}
          pixelLiquid={{
            backgroundColor: pixelLiquidBackgroundColor,
            baseColor: pixelLiquidBaseColor,
            accentColor: pixelLiquidAccentColor,
            highlightColor: pixelLiquidHighlightColor,
            pixelSize: pixelLiquidPixelSize,
            detail: pixelLiquidDetail,
            motionSpeed: pixelLiquidMotionSpeed,
          }}
          tileGrid={{
            paletteMode: tileGridPaletteMode,
            primaryColor: tileGridPrimaryColor,
            colors: [
              tileGridColorOne,
              tileGridColorTwo,
              tileGridColorThree,
              tileGridColorFour,
              tileGridColorFive,
            ],
            tileSize: tileGridTileSize,
            jointSize: tileGridJointSize,
            changeFrequency: tileGridChangeFrequency,
            activePercent: tileGridActivePercent,
            opacity: tileGridOpacity,
          }}
          hexGrid={{
            primaryColor: hexGridPrimaryColor,
            harmony: hexGridHarmony,
            hexSize: hexGridHexSize,
            jointSize: hexGridJointSize,
            changeFrequency: hexGridChangeFrequency,
            activePercent: hexGridActivePercent,
            opacity: hexGridOpacity,
          }}
          testId="chimer-premium-background"
        />
      )}

      {!isClockMode && (
        <button
        type="button"
        className={`${styles.displayButton} ${isTimerPrimary ? styles.primaryDisplay : styles.secondaryDisplay} ${isTimerPrimary && !hasTimerSeconds ? styles.timerModeCompactTimer : ""} ${styles.timerDisplay} ${timerSwapClass}`}
        onClick={() => {
          triggerHapticFeedback(hapticsEnabled)
          ;(isTimerPrimary ? handlePauseControl : () => handlePrimarySwitch("timer"))()
        }}
        disabled={isTimerPrimary && isComplete}
        ref={isTimerPrimary ? primaryDisplayRef : undefined}
        style={isTimerPrimary ? primaryDisplayStyle : undefined}
          aria-label={isTimerPrimary ? (isComplete ? "Session complete" : `${primaryActionLabel} from center display`) : "Show timer in center"}
          aria-live={isTimerPrimary ? "polite" : undefined}
          data-testid="running-timer-clock"
        >
          <span ref={isTimerPrimary ? primaryContentRef : undefined} className={styles.displayContent}>
            {renderTimerDisplay()}
          </span>
        </button>
      )}

      <button
        type="button"
        className={`${styles.displayButton} ${isCurrentTimePrimary ? styles.primaryDisplay : styles.secondaryDisplay} ${isCurrentTimePrimary && !isClockMode ? styles.timerModeClockPrimary : ""} ${styles.currentTimeDisplay} ${currentTimeSwapClass}`}
        onClick={() => {
          triggerHapticFeedback(hapticsEnabled)
          ;(isCurrentTimePrimary ? (isClockMode ? revealControls : handlePauseControl) : () => handlePrimarySwitch("currentTime"))()
        }}
        disabled={isCurrentTimePrimary && isComplete}
        ref={isCurrentTimePrimary ? primaryDisplayRef : undefined}
        data-testid="running-current-time"
        aria-label={isCurrentTimePrimary ? (isClockMode ? "Reveal clock controls" : isComplete ? "Session complete" : `${primaryActionLabel} from center display`) : "Show current time in center"}
        style={isCurrentTimePrimary ? primaryDisplayStyle : undefined}
      >
        <span ref={isCurrentTimePrimary ? primaryContentRef : undefined} className={styles.displayContent}>
          {renderCurrentTimeDisplay(isCurrentTimePrimary)}
        </span>
      </button>

      <div className={chromeClassName}>
        <button
          className={`${styles.control} ${styles.closeButton} ${styles.tactileButton}`}
          onClick={() => {
            triggerHapticFeedback(hapticsEnabled)
            onClose()
          }}
          aria-label={isClockMode ? "Close clock" : "End timer"}
          data-chimer-control="true"
        >
          <X className="h-5 w-5" />
        </button>

        <button
          className={`${styles.control} ${styles.fullscreenButton} ${styles.tactileButton}`}
          onClick={() => {
            triggerHapticFeedback(hapticsEnabled)
            handleFullscreenControl()
          }}
          aria-label="Toggle fullscreen"
          data-chimer-control="true"
        >
          {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
        </button>

        <button
          ref={settingsButtonRef}
          className={`${styles.control} ${styles.settingsButton} ${styles.tactileButton}`}
          onClick={() => {
            triggerHapticFeedback(hapticsEnabled)
            handleSettingsButtonClick()
          }}
          aria-label={isSettingsOpen ? "Close clock settings" : "Open clock settings"}
          aria-expanded={isSettingsOpen}
          data-chimer-control="true"
        >
          <Settings className="h-5 w-5" />
        </button>

        {isSettingsOpen && (
          <div
            ref={settingsPanelRef}
            className={styles.settingsPanel}
            role="dialog"
            aria-label="Chimer settings"
            data-chimer-control="true"
            data-testid="chimer-settings-panel"
            onPointerDown={handleSettingsPanelActivity}
            onKeyDown={handleSettingsPanelActivity}
            onChange={handleSettingsPanelActivity}
            onInput={handleSettingsPanelActivity}
          >
            <Tabs value={settingsTab} onValueChange={handleSettingsTabChange} className={styles.settingsTabs}>
              <TabsList data-active-tab={settingsTab} className={`${styles.settingsTabList} ml-chimer-tabs`}>
                <TabsTrigger value="clock" className={`${styles.settingsTabTrigger} ml-chimer-tab`}>Clock</TabsTrigger>
                <TabsTrigger value="visual" className={`${styles.settingsTabTrigger} ml-chimer-tab`}>Visual</TabsTrigger>
                <TabsTrigger value="backgrounds" className={`${styles.settingsTabTrigger} ml-chimer-tab`}>Backgrounds</TabsTrigger>
              </TabsList>

              <TabsContent value="clock" className={styles.settingsTabContent}>
                <div className={styles.settingsSection}>
                  <div className={styles.settingsSectionHeader}>
                    <span>Clock text</span>
                    <span className={styles.settingsPill}>Display tuning</span>
                  </div>

                  {!isClockMode && (
                  <StyledToggleControl
                    label="Show timer seconds"
                    checked={resolvedShowTimerSeconds}
                    valueLabel={resolvedShowTimerSeconds ? "On" : "Off"}
                    hapticsEnabled={hapticsEnabled}
                    onCheckedChange={(value) => handleSettingsChange({ showTimerSeconds: value })}
                  />
                  )}

                  <StyledToggleControl
                    label="Show clock seconds"
                    checked={showCurrentTimeSeconds}
                    valueLabel={showCurrentTimeSeconds ? "On" : "Off"}
                    hapticsEnabled={hapticsEnabled}
                    onCheckedChange={(value) => handleSettingsChange({ showCurrentTimeSeconds: value })}
                  />

                  <StyledRangeControl
                    label="Font size"
                    value={effectiveFontSize}
                    min={MIN_FONT_SIZE}
                    max={effectiveMaxFontSize}
                    step={FONT_SIZE_STEP}
                    displayValue={`${Math.round(effectiveFontSize)}vw`}
                    hapticsEnabled={hapticsEnabled}
                    onChange={handleFontSizeRangeChange}
                  />

                  <div className={styles.clockCompactRow}>
                    <label className={styles.clockCompactField} title={customColorDisabledHint}>
                      <span>Clock font</span>
                      <select
                        value={clockFontFamily}
                        disabled={!canUseCustomColors}
                        onChange={(event) => handleSettingsChange({
                          clockFontFamily: event.target.value as ChimerSettings["clockFontFamily"],
                        })}
                        aria-label="Clock font"
                      >
                        <option value="digital">Digital</option>
                        <option value="mono">Mono</option>
                        <option value="sans">Sans</option>
                        <option value="serif">Serif</option>
                      </select>
                    </label>

                    <div className={styles.clockCompactField} title={accountColorDisabledHint}>
                      <span>Clock color</span>
                      <ColorPickerSwatch
                        label="Clock color"
                        value={clockModeFontColor}
                        fallback={DEFAULT_CLOCK_MODE_FONT_COLOR}
                        disabled={!canUseCoreColorControls}
                        onChange={(nextColor) => handleSettingsChange({ clockModeFontColor: nextColor })}
                        className={styles.colorSwatchPicker}
                        buttonClassName={styles.clockColorSwatchButton}
                      />
                    </div>

                    <div className={styles.clockCompactField}>
                      <span>Time format</span>
                      <div
                        className={`${styles.formatToggle} ml-time-format-choice`}
                        aria-label="Time format"
                        data-active-format={timeFormat}
                      >
                        <button
                          type="button"
                          className={`${styles.formatOption} ${styles.tactileButton} ml-time-format-option ${timeFormat === "12h" ? styles.formatOptionActive : ""}`}
                          aria-pressed={timeFormat === "12h"}
                          onClick={() => {
                            triggerHapticFeedback(hapticsEnabled)
                            handleSettingsChange({ timeFormat: "12h" })
                          }}
                        >
                          12h
                        </button>
                        <button
                          type="button"
                          className={`${styles.formatOption} ${styles.tactileButton} ml-time-format-option ${timeFormat === "24h" ? styles.formatOptionActive : ""}`}
                          aria-pressed={timeFormat === "24h"}
                          onClick={() => {
                            triggerHapticFeedback(hapticsEnabled)
                            handleSettingsChange({ timeFormat: "24h" })
                          }}
                        >
                          24h
                        </button>
                      </div>
                    </div>
                  </div>

                  {!isClockMode ? (
                    <div className={styles.clockControlGrid}>
                      <div className={styles.colorRow} title={customColorDisabledHint}>
                        <span>Timer color</span>
                        <ColorPickerInput
                          value={primaryFontColor}
                          disabled={!canUseCustomColors}
                          onValueChange={(nextColor) => handleSettingsChange({ primaryFontColor: nextColor })}
                          label="Timer color"
                        />
                      </div>
                      <div className={styles.colorRow} title={customColorDisabledHint}>
                        <span>Secondary color</span>
                        <ColorPickerInput
                          value={secondaryFontColor}
                          disabled={!canUseCustomColors}
                          onValueChange={(nextColor) => handleSettingsChange({ secondaryFontColor: nextColor })}
                          label="Secondary display color"
                        />
                      </div>
                    </div>
                  ) : null}

                  <div className={styles.controlGroup}>
                    <StyledToggleControl
                      label="Clock stroke"
                      checked={clockStrokeEnabled}
                      valueLabel={clockStrokeEnabled ? "On" : "Off"}
                      hapticsEnabled={hapticsEnabled}
                      className={styles.controlGroupToggle}
                      onCheckedChange={(value) => handleSettingsChange({ clockStrokeEnabled: value })}
                    />
                    {clockStrokeEnabled ? (
                      <div className={styles.controlGroupBody}>
                        <div className={styles.clockControlGrid}>
                          <div className={styles.colorRow}>
                            <span>Stroke color</span>
                            <ColorPickerInput
                              value={clockStrokeColor}
                              onValueChange={(nextColor) => handleSettingsChange({ clockStrokeColor: nextColor })}
                              label="Clock stroke color"
                            />
                          </div>
                          <StyledRangeControl
                            label="Stroke width"
                            value={clockStrokeWidth}
                            min={0}
                            max={3}
                            step={0.25}
                            displayValue={`${clockStrokeWidth.toFixed(2)}px`}
                            hapticsEnabled={hapticsEnabled}
                            onChange={(value) => handleSettingsChange({ clockStrokeWidth: value })}
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className={styles.controlGroup} title={customColorDisabledHint}>
                    <StyledToggleControl
                      label="Clock drop shadow"
                      checked={clockShadowEnabled}
                      valueLabel={clockShadowEnabled ? "On" : "Off"}
                      disabled={!canUseCustomColors}
                      hapticsEnabled={hapticsEnabled}
                      className={styles.controlGroupToggle}
                      onCheckedChange={(value) => handleSettingsChange({ clockShadowEnabled: value })}
                    />
                    {clockShadowEnabled ? (
                      <div className={styles.controlGroupBody}>
                        <div className={styles.clockControlGrid}>
                          <div className={styles.colorRow}>
                            <span>Shadow color</span>
                            <ColorPickerInput
                              value={clockShadowColor}
                              disabled={!canUseCustomColors}
                              onValueChange={(nextColor) => handleSettingsChange({ clockShadowColor: nextColor })}
                              label="Clock shadow color"
                            />
                          </div>
                          <StyledRangeControl
                            label="Shadow strength"
                            value={clockShadowStrength}
                            min={0}
                            max={1}
                            step={0.05}
                            displayValue={`${Math.round(clockShadowStrength * 100)}%`}
                            disabled={!canUseCustomColors}
                            hapticsEnabled={hapticsEnabled}
                            onChange={(value) => handleSettingsChange({ clockShadowStrength: value })}
                          />
                          <StyledRangeControl
                            label="Shadow direction"
                            value={clockShadowDirection}
                            min={0}
                            max={360}
                            step={1}
                            displayValue={`${Math.round(clockShadowDirection)}°`}
                            disabled={!canUseCustomColors}
                            hapticsEnabled={hapticsEnabled}
                            onChange={(value) => handleSettingsChange({ clockShadowDirection: value })}
                          />
                          <StyledRangeControl
                            label="Shadow distance"
                            value={clockShadowDistance}
                            min={0}
                            max={32}
                            step={1}
                            displayValue={`${Math.round(clockShadowDistance)}px`}
                            disabled={!canUseCustomColors}
                            hapticsEnabled={hapticsEnabled}
                            onChange={(value) => handleSettingsChange({ clockShadowDistance: value })}
                          />
                          <StyledRangeControl
                            label="Shadow feather"
                            value={clockShadowFeather}
                            min={0}
                            max={32}
                            step={1}
                            displayValue={`${Math.round(clockShadowFeather)}px`}
                            disabled={!canUseCustomColors}
                            hapticsEnabled={hapticsEnabled}
                            onChange={(value) => handleSettingsChange({ clockShadowFeather: value })}
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className={styles.controlGroup} title={customColorDisabledHint}>
                    <StyledToggleControl
                      label="Clock outer glow"
                      checked={clockGlowEnabled}
                      valueLabel={clockGlowEnabled ? "On" : "Off"}
                      disabled={!canUseCustomColors}
                      hapticsEnabled={hapticsEnabled}
                      className={styles.controlGroupToggle}
                      onCheckedChange={(value) => handleSettingsChange({ clockGlowEnabled: value })}
                    />
                    {clockGlowEnabled ? (
                      <div className={styles.controlGroupBody}>
                        <div className={styles.clockControlGrid}>
                          <div className={styles.colorRow}>
                            <span>Glow color</span>
                            <ColorPickerInput
                              value={clockGlowColor}
                              disabled={!canUseCustomColors}
                              onValueChange={(nextColor) => handleSettingsChange({ clockGlowColor: nextColor })}
                              label="Clock outer glow color"
                            />
                          </div>
                          <StyledRangeControl
                            label="Glow strength"
                            value={clockGlowStrength}
                            min={0}
                            max={1}
                            step={0.05}
                            displayValue={`${Math.round(clockGlowStrength * 100)}%`}
                            disabled={!canUseCustomColors}
                            hapticsEnabled={hapticsEnabled}
                            onChange={(value) => handleSettingsChange({ clockGlowStrength: value })}
                          />
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                {!isClockMode && (
                  <div className={styles.settingsSection}>
                    <div className={styles.settingsSectionHeader}>
                      <span>Timer tools</span>
                    </div>
                    {canEditActiveTimer ? (
                      <>
                        <div className={styles.settingsSection}>
                          <div className={styles.settingsSectionHeader}>
                            <span>Remaining time</span>
                            <span className={styles.settingsPill}>Active only</span>
                          </div>
                          <div className={styles.quickAdjustGrid} aria-label="Adjust remaining time">
                            <button
                              type="button"
                              className={styles.tactileButton}
                              onClick={() => {
                                triggerHapticFeedback(hapticsEnabled)
                                handleActiveRemainingStep(-5)
                              }}
                            >
                              -5m
                            </button>
                            <button
                              type="button"
                              className={styles.tactileButton}
                              onClick={() => {
                                triggerHapticFeedback(hapticsEnabled)
                                handleActiveRemainingStep(-1)
                              }}
                            >
                              -1m
                            </button>
                            <button
                              type="button"
                              className={styles.tactileButton}
                              onClick={() => {
                                triggerHapticFeedback(hapticsEnabled)
                                handleActiveRemainingStep(1)
                              }}
                            >
                              +1m
                            </button>
                            <button
                              type="button"
                              className={styles.tactileButton}
                              onClick={() => {
                                triggerHapticFeedback(hapticsEnabled)
                                handleActiveRemainingStep(5)
                              }}
                            >
                              +5m
                            </button>
                          </div>
                          <div className={styles.exactTimeGrid}>
                            <label className={styles.numberField}>
                              <span>Hours</span>
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={activeRemainingHours}
                                onChange={(event) => handleActiveRemainingHoursChange(event.target.value)}
                                aria-label="Exact remaining hours"
                              />
                            </label>
                            <label className={styles.numberField}>
                              <span>Minutes</span>
                              <input
                                type="text"
                                inputMode="numeric"
                                pattern="[0-9]*"
                                value={activeRemainingMinutes}
                                onChange={(event) => handleActiveRemainingMinutesChange(event.target.value)}
                                aria-label="Exact remaining minutes"
                              />
                            </label>
                          </div>
                        </div>

                        <div className={styles.settingsSection}>
                          <div className={styles.settingsSectionHeader}>
                            <span>Chime interval</span>
                            <span className={styles.settingsPill}>Active only</span>
                          </div>
                          <label className={styles.numberField}>
                            <span>Minutes between chimes</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={activeIntervalMinutes ?? ""}
                              onChange={(event) => handleActiveIntervalChange(event.target.value)}
                              aria-label="Active chime interval minutes"
                            />
                          </label>
                        </div>
                      </>
                    ) : (
                      <div className={styles.settingsEmptyState}>
                        {isComplete ? "Session complete. Active timer changes are disabled." : "Start or pause a timer to adjust it here."}
                      </div>
                    )}
                  </div>
                )}

                <div className={styles.switchRow}>
                  <StyledToggleControl
                    label="Keep timer screen awake"
                    checked={keepTimerScreenAwake}
                    valueLabel={keepTimerScreenAwake ? "On" : "Off"}
                    hapticsEnabled={hapticsEnabled}
                    onCheckedChange={(value) => handleSettingsChange({ keepTimerScreenAwake: value })}
                  />
                </div>

              </TabsContent>

              <TabsContent value="visual" className={styles.settingsTabContent}>
                <StyledToggleControl
                  label="Visual background"
                  checked={movingBackgroundEnabled}
                  valueLabel={movingBackgroundEnabled ? "On" : "Off"}
                  hapticsEnabled={hapticsEnabled}
                  onCheckedChange={(value) => handleSettingsChange({ movingBackgroundEnabled: value })}
                />

                <div className={styles.settingsSection}>
                  <div className={styles.settingsSectionHeader}>
                    <span>Selected background controls</span>
                    <span className={styles.settingsPill}>Visual tuning</span>
                  </div>
                  {movingBackgroundEnabled ? (
                    renderBackgroundControls(
                      selectedBackgroundDefinition,
                    )
                  ) : (
                    <div className={styles.settingsEmptyState}>Enable visual background to show visual controls.</div>
                  )}
                </div>

                <div className={styles.settingsSection}>
                  <GlobalColorPicker
                    value={globalColors}
                    title="Global Colors"
                    description={globalHarmony === "custom"
                      ? "Choose each palette color used by compatible backgrounds."
                      : "Choose a primary color and harmony; the remaining background colors update automatically."}
                    harmonyControl={(
                      <div className={styles.globalColorModeControls}>
                        <StyledToggleControl
                          label="Choose each color"
                          checked={globalHarmony === "custom"}
                          valueLabel={globalHarmony === "custom" ? "Custom" : "Harmony"}
                          hapticsEnabled={hapticsEnabled}
                          onCheckedChange={handleGlobalCustomColorToggle}
                        />
                        <HarmonyToggleGroup
                          label="Color harmony"
                          value={globalHarmony}
                          onChange={handleGlobalHarmonyChange}
                          options={GLOBAL_HARMONY_OPTIONS}
                          previewColors={harmonyPreviewColors}
                          disabled={globalHarmony === "custom"}
                          hapticsEnabled={hapticsEnabled}
                          description="Generate related palette families from your primary color."
                          embedded
                        />
                      </div>
                    )}
                    editableFields={globalHarmony === "custom" ? undefined : ["primary"]}
                    paletteName={globalPaletteName}
                    onPaletteNameChange={handleGlobalPaletteNameChange}
                    onChange={handleGlobalColorsChange}
                    onSave={handleGlobalPaletteSave}
                    saveButtonLabel="Save palette"
                  />
                </div>

                <div className={styles.settingsSection}>
                  <div className={styles.settingsSectionHeader}>
                    <span>Saved palettes</span>
                    <span className={styles.settingsPill}>Reusable</span>
                  </div>
                  {globalPalettes.length === 0 ? (
                    <div className={styles.settingsEmptyState}>Save a palette to reuse it on future sessions.</div>
                  ) : (
                    <div style={{ display: "grid", gap: "0.45rem" }}>
                      {globalPalettes.map((palette) => (
                        <button
                          key={palette.id}
                          type="button"
                          className={`${styles.inlineButton} ${styles.tactileButton}`}
                          onClick={() => {
                            triggerHapticFeedback(hapticsEnabled)
                            handleGlobalPaletteLoad(palette)
                          }}
                          aria-label={`Apply ${palette.name} palette`}
                        >
                          <div style={{ display: "grid", gap: "0.35rem", textAlign: "left" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                              <span style={{ fontWeight: 700 }}>{palette.name}</span>
                              {palette.isDefault ? <span className={styles.settingsPill}>Default</span> : null}
                            </div>
                            <span style={{ color: "rgba(255, 255, 255, 0.72)", fontSize: "0.76rem" }}>
                              {palette.harmony}
                            </span>
                            <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                              {palette.generated.slice(0, 6).map((color) => (
                                <span
                                  key={`${palette.id}-${color}`}
                                  aria-hidden="true"
                                  style={{
                                    width: "1rem",
                                    height: "1rem",
                                    borderRadius: "999px",
                                    border: "1px solid rgba(255, 255, 255, 0.24)",
                                    background: color,
                                  }}
                                />
                              ))}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="backgrounds" className={`${styles.settingsTabContent} ${styles.backgroundSettingsTabContent}`}>
                <div className={styles.backgroundCategoryRow} role="group" aria-label="Background visual filters">
                  {BACKGROUND_VISUAL_CATEGORIES.map((category) => (
                    <button
                      key={category.value}
                      type="button"
                      className={`${styles.backgroundCategoryButton} ${styles.tactileButton} ${backgroundCategoryFilter === category.value ? styles.backgroundCategoryButtonActive : ""}`}
                      onClick={() => {
                        triggerHapticFeedback(hapticsEnabled)
                        handleBackgroundFilterChange(category.value)
                      }}
                      aria-pressed={backgroundCategoryFilter === category.value}
                    >
                      {category.label}
                    </button>
                  ))}
                </div>

                {hasVisibleBackgrounds && activeBackgroundOption ? (
                  <div
                    className={styles.backgroundRadialCarousel}
                    role="group"
                    aria-label="Background visual carousel"
                    tabIndex={0}
                    onKeyDown={handleBackgroundCarouselKeyDown}
                    onPointerDown={handleBackgroundCarouselPointerDown}
                    onPointerUp={handleBackgroundCarouselPointerUp}
                    onPointerCancel={handleBackgroundCarouselPointerCancel}
                  >
                    <div className={styles.backgroundRadialStage}>
                      {visibleBackgroundOptions.map((option, optionIndex) => {
                        const totalOptions = visibleBackgroundOptions.length
                        const offset = getCircularCarouselOffset(optionIndex, activeBackgroundCarouselIndex, totalOptions)
                        const absOffset = Math.abs(offset)

                        if (absOffset > BACKGROUND_RADIAL_VISIBLE_OFFSET) {
                          return null
                        }

                        const canUse = userCanUseBackground(option, featureKeys)
                        const isSaved = savedBackgroundIds.includes(option.id)
                        const isSelected = movingBackgroundEnabled && option.id === backgroundId
                        const isActive = optionIndex === activeBackgroundCarouselIndex
                        const isPreviewLoaded =
                          visibleBackgroundPreviewIds.has(option.id) || option.id === selectedBackgroundDefinition.id || isActive
                        const angle = offset * BACKGROUND_RADIAL_CARD_SPREAD_DEGREES
                        const radians = (angle * Math.PI) / 180
                        const translateX = BACKGROUND_RADIAL_CARD_RADIUS_PX * Math.sin(radians)
                        const translateY = 0
                        const rotateY = -angle
                        const rotateX = 0
                        const scale = Math.max(0.5, 1 - absOffset * 0.16)
                        const opacity = Math.min(
                          canUse ? 1 : 0.58,
                          absOffset > 2 ? 0.18 : Math.max(0.18, 1 - absOffset * 0.36),
                        )
                        const cardStyle = {
                          opacity,
                          transform: `translate(-50%, -50%) translate3d(${translateX}px, ${translateY}px, ${-absOffset * 28}px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(${scale})`,
                          zIndex: 20 - absOffset,
                        } as CSSProperties

                        return (
                          <div
                            key={option.id}
                            className={`${styles.backgroundRadialCard} ${isActive ? styles.backgroundRadialCardActive : ""} ${isSelected ? styles.backgroundCardSelected : ""} ${!canUse ? styles.backgroundCardLocked : ""}`}
                            style={cardStyle}
                            aria-current={isSelected ? "true" : undefined}
                            data-background-id={option.id}
                            role="group"
                            aria-label={`${option.label} background`}
                          >
                            <button
                              type="button"
                              className={styles.backgroundRadialCardPreviewButton}
                              onClick={() => {
                                triggerHapticFeedback(hapticsEnabled)
                                setActiveBackgroundCarouselIndex(optionIndex)
                              }}
                              aria-label={`Preview ${option.label} background`}
                            >
                              {renderBackgroundPreview(
                                option,
                                isPreviewLoaded,
                                option.fallbackStyle ?? { background: "#0f172a" },
                              )}
                              <div className={styles.backgroundRadialCardVeil}>
                                <span className={styles.backgroundRadialCardCategory}>
                                  {getBackgroundVisualTags(option).slice(0, 2).join(" • ")}
                                </span>
                                <span className={styles.backgroundRadialCardTitle}>{option.label}</span>
                                {isActive ? (
                                  <span className={styles.backgroundRadialCardBadges}>
                                    <span>{option.requiresSubscription ? "Premium" : "Free"}</span>
                                    {isSelected ? <span>Selected</span> : null}
                                    {isSaved ? <span>Saved</span> : null}
                                  </span>
                                ) : null}
                              </div>
                            </button>

                            {isActive ? (
                              <div className={styles.backgroundRadialCardActions}>
                                <button
                                  type="button"
                                  className={`${styles.backgroundRadialCardAction} ${isSelected ? styles.backgroundRadialCardActionSelected : ""}`}
                                  onClick={() => {
                                    triggerHapticFeedback(hapticsEnabled)
                                    handleBackgroundSelection(option.id)
                                  }}
                                  disabled={!canUse}
                                  aria-label={`${isSelected ? "Selected" : "Select"} ${option.label} background`}
                                >
                                  {isSelected ? "Selected" : "Select"}
                                </button>
                                <button
                                  type="button"
                                  className={`${styles.backgroundRadialIconAction} ${isSaved ? styles.backgroundRadialIconActionActive : ""}`}
                                  onClick={() => {
                                    triggerHapticFeedback(hapticsEnabled)
                                    handleBackgroundSavedToggle(option.id)
                                  }}
                                  aria-label={`${isSaved ? "Unsave" : "Save"} ${option.label}`}
                                >
                                  <Star className="h-4 w-4" aria-hidden="true" />
                                </button>
                              </div>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>

                    <div className={styles.backgroundRadialNavRow}>
                      <Button
                        type="button"
                        variant="ctaBlue"
                        size="icon"
                        className={styles.backgroundCarouselNav}
                        onClick={() => moveBackgroundCarousel(-1, false)}
                        disabled={visibleBackgroundOptions.length <= 1}
                        aria-label="Previous background"
                      >
                        <ChevronLeft className="h-5 w-5" aria-hidden="true" />
                      </Button>
                      <Button
                        type="button"
                        variant="ctaBlue"
                        size="icon"
                        className={styles.backgroundCarouselNav}
                        onClick={() => moveBackgroundCarousel(1, false)}
                        disabled={visibleBackgroundOptions.length <= 1}
                        aria-label="Next background"
                      >
                        <ChevronRight className="h-5 w-5" aria-hidden="true" />
                      </Button>
                    </div>

                  </div>
                ) : (
                  <div className={styles.settingsEmptyState}>No backgrounds match this filter.</div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}

        <div className={styles.bottomControls}>
          <div className={styles.bottomButtonRow}>
            <button
              className={`${styles.fontButton} ${styles.decreaseFontButton}`}
              onClick={() => {
                triggerHapticFeedback(hapticsEnabled)
                handleFontSizeChange("decrease")
              }}
              disabled={!canDecreaseFontSize}
              aria-label="Decrease timer size"
              data-chimer-control="true"
            >
              <Minus className="h-5 w-5" />
            </button>
            {!isComplete && !isClockMode && (
              <button
                className={`${styles.control} ${styles.pauseButton}`}
                onClick={() => {
                  triggerHapticFeedback(hapticsEnabled)
                  handlePauseControl()
                }}
                aria-label={isPaused ? "Resume timer" : "Pause timer"}
                data-chimer-control="true"
              >
                {isPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
              </button>
            )}
            <button
              className={`${styles.fontButton} ${styles.increaseFontButton}`}
              onClick={() => {
                triggerHapticFeedback(hapticsEnabled)
                handleFontSizeChange("increase")
              }}
              disabled={!canIncreaseFontSize}
              aria-label="Increase timer size"
              data-chimer-control="true"
            >
              <Plus className="h-5 w-5" />
            </button>
          </div>
          {!isClockMode && <div className={styles.status}>{statusText}</div>}
        </div>
      </div>
    </section>
  )
}
