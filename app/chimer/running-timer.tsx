"use client"

import { type CSSProperties, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { Maximize2, Minimize2, Minus, Pause, Play, Plus, Settings, X } from "lucide-react"
import { DEFAULT_BACKGROUND_ID } from "@/lib/background-options"
import { BackgroundHost } from "@/components/backgrounds/BackgroundHost"
import { BackgroundSelector } from "@/components/backgrounds/BackgroundSelector"
import { canUseBackgroundId, type BackgroundDefinition } from "@/components/backgrounds/backgroundRegistry"
import { MovingBackground } from "@/components/moving-background"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ANIMATE_UI_GRADIENT_HARMONY_OPTIONS,
  CHAMAAC_ASTRAL_FLOW_DISPLAY_SPEED_MAX,
  CHAMAAC_ASTRAL_FLOW_DISPLAY_SPEED_MIN,
  CHAMAAC_ASTRAL_FLOW_DISPLAY_SPEED_STEP,
  CHAMAAC_DEEP_SPACE_NEBULA_DISPLAY_SPEED_MAX,
  CHAMAAC_DEEP_SPACE_NEBULA_DISPLAY_SPEED_MIN,
  CHAMAAC_DEEP_SPACE_NEBULA_DISPLAY_SPEED_STEP,
  CHAMAAC_GRID_BLOOM_DISPLAY_SPEED_MAX,
  CHAMAAC_GRID_BLOOM_DISPLAY_SPEED_MIN,
  CHAMAAC_GRID_BLOOM_DISPLAY_SPEED_STEP,
  CHAMAAC_LIQUID_CHROME_DISPLAY_FLOW_SPEED_MAX,
  CHAMAAC_LIQUID_CHROME_DISPLAY_FLOW_SPEED_MIN,
  CHAMAAC_LIQUID_CHROME_DISPLAY_FLOW_SPEED_STEP,
  CHAMAAC_LIQUID_CHROME_DISPLAY_TIME_SCALE_MAX,
  CHAMAAC_LIQUID_CHROME_DISPLAY_TIME_SCALE_MIN,
  CHAMAAC_LIQUID_CHROME_DISPLAY_TIME_SCALE_STEP,
  CHAMAAC_WAVES_DISPLAY_SPEED_MAX,
  CHAMAAC_WAVES_DISPLAY_SPEED_MIN,
  CHAMAAC_WAVES_DISPLAY_SPEED_STEP,
  CHAMAAC_SYNTHESIS_DISPLAY_SPEED_MAX,
  CHAMAAC_SYNTHESIS_DISPLAY_SPEED_MIN,
  CHAMAAC_SYNTHESIS_DISPLAY_SPEED_STEP,
  COLOR_HARMONY_OPTIONS,
  ELDORA_NOVATRIX_DISPLAY_AMPLITUDE_MAX,
  ELDORA_NOVATRIX_DISPLAY_AMPLITUDE_MIN,
  ELDORA_NOVATRIX_DISPLAY_AMPLITUDE_STEP,
  ELDORA_NOVATRIX_DISPLAY_SPEED_MAX,
  ELDORA_NOVATRIX_DISPLAY_SPEED_MIN,
  ELDORA_NOVATRIX_DISPLAY_SPEED_STEP,
  getChamaacAstralFlowDisplaySpeed,
  getChamaacAstralFlowSourceSpeed,
  getChamaacDeepSpaceNebulaDisplaySpeed,
  getChamaacDeepSpaceNebulaSourceSpeed,
  getChamaacGridBloomDisplaySpeed,
  getChamaacGridBloomSourceSpeed,
  getChamaacLiquidChromeDisplayFlowSpeed,
  getChamaacLiquidChromeDisplayTimeScale,
  getChamaacLiquidChromeSourceFlowSpeed,
  getChamaacLiquidChromeSourceTimeScale,
  getChamaacWavesDisplaySpeed,
  getChamaacWavesSourceSpeed,
  getChamaacSynthesisDisplaySpeed,
  getChamaacSynthesisSourceSpeed,
  getEldoraNovatrixDisplayAmplitude,
  getEldoraNovatrixDisplaySpeed,
  getEldoraNovatrixSourceAmplitude,
  getEldoraNovatrixSourceSpeed,
  resolveChamaacAstralFlowColors,
  resolveChamaacDeepSpaceNebulaColors,
  resolveChamaacLiquidChromeColors,
  resolveChamaacWavesColors,
  resolveChamaacSynthesisColors,
  resolveEldoraNovatrixColor,
  type AnimateUiGradientHarmony,
  type ChamaacAstralFlowPaletteMode,
  type ChamaacDeepSpaceNebulaPaletteMode,
  type ChamaacLiquidChromePaletteMode,
  type ChamaacWavesPaletteMode,
  type ChamaacSynthesisPaletteMode,
  type EldoraNovatrixPaletteMode,
  type ChimerSettings,
  type ColorHarmony,
} from "./set-timer"
import styles from "./running-timer.module.css"
import { TileGridFadeTimeControl } from "./tile-grid-fade-time-control"

type PrimaryDisplay = "timer" | "currentTime"
type SettingsTab = "timer" | "display" | "background"

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
const CUSTOM_COLOR_SETTING_KEYS = new Set([
  "primaryFontColor",
  "secondaryFontColor",
  "clockModeFontColor",
  "movingBackgroundMainColor",
  "movingBackgroundOrbColor",
])

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
  chamaacLightSpeedParticleCount: number
  chamaacLightSpeedLightColor: string
  chamaacLightSpeedIntensity: number
  chamaacLightSpeedRadius: number
  chamaacLightSpeedCylinderLength: number
  chamaacElectricMistColor: string
  chamaacElectricMistSpeed: number
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
  animateUiGradientPrimaryColor,
  animateUiGradientHarmony,
  animateUiGradientOpacity,
  animateUiStarsColor,
  animateUiStarsSpeed,
  animateUiStarsDensity,
  animateUiStarsParallax,
  animateUiHoleStrokeColor,
  animateUiHoleParticleColor,
  animateUiHoleLineCount,
  animateUiHoleDiscCount,
  chamaacLightSpeedWarpSpeed,
  chamaacLightSpeedParticleCount,
  chamaacLightSpeedLightColor,
  chamaacLightSpeedIntensity,
  chamaacLightSpeedRadius,
  chamaacLightSpeedCylinderLength,
  chamaacElectricMistColor,
  chamaacElectricMistSpeed,
  chamaacElectricMistDetail,
  chamaacElectricMistDistortion,
  chamaacElectricMistBrightness,
  chamaacAstralFlowPaletteMode,
  chamaacAstralFlowPrimaryColor,
  chamaacAstralFlowHarmony,
  chamaacAstralFlowColorOne,
  chamaacAstralFlowColorTwo,
  chamaacAstralFlowColorThree,
  chamaacAstralFlowSpeed,
  chamaacAstralFlowFlowMin,
  chamaacAstralFlowFlowMax,
  chamaacDeepSpaceNebulaPaletteMode,
  chamaacDeepSpaceNebulaPrimaryColor,
  chamaacDeepSpaceNebulaHarmony,
  chamaacDeepSpaceNebulaColorOne,
  chamaacDeepSpaceNebulaColorTwo,
  chamaacDeepSpaceNebulaColorThree,
  chamaacDeepSpaceNebulaSpeed,
  chamaacGridBloomColor,
  chamaacGridBloomSpeed,
  chamaacGridBloomGridScale,
  chamaacGridBloomRotationSpeed,
  chamaacGridBloomFadeFalloff,
  chamaacGridBloomDistortionAmount,
  chamaacGridBloomFlowSpeedX,
  chamaacGridBloomFlowSpeedY,
  chamaacLiquidChromePaletteMode,
  chamaacLiquidChromePrimaryColor,
  chamaacLiquidChromeHarmony,
  chamaacLiquidChromeColorOne,
  chamaacLiquidChromeColorTwo,
  chamaacLiquidChromeFlowSpeed,
  chamaacLiquidChromeTimeScale,
  chamaacWavesPaletteMode,
  chamaacWavesPrimaryColor,
  chamaacWavesHarmony,
  chamaacWavesBackgroundColor,
  chamaacWavesColorOne,
  chamaacWavesColorTwo,
  chamaacWavesColorThree,
  chamaacWavesSpeedX,
  chamaacWavesSpeedY,
  chamaacWavesAmplitude,
  eldoraNovatrixPaletteMode,
  eldoraNovatrixPrimaryColor,
  eldoraNovatrixHarmony,
  eldoraNovatrixColor,
  eldoraNovatrixSpeed,
  eldoraNovatrixAmplitude,
  chamaacSynthesisPaletteMode,
  chamaacSynthesisPrimaryColor,
  chamaacSynthesisHarmony,
  chamaacSynthesisColorOne,
  chamaacSynthesisColorTwo,
  chamaacSynthesisColorThree,
  chamaacSynthesisSpeed,
  chamaacSynthesisComplexity,
  chamaacSynthesisScale,
  chamaacSynthesisDistortion,
  chamaacSynthesisGlowIntensity,
  chamaacSynthesisFlowFrequency,
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
}: RunningTimerProps) {
  const isPaused = status === "paused"
  const isComplete = status === "complete"
  const isClockMode = status === "clock"
  const canEditActiveTimer = status === "running" || status === "paused"
  const backgroundCategory = isClockMode ? "clock" : "chimer"
  // Preserve the original Lamp path; BackgroundHost owns static fallbacks for premium alternatives.
  const useOriginalLampBackground = backgroundId === DEFAULT_BACKGROUND_ID
    || !canUseBackgroundId(backgroundId, featureKeys, backgroundCategory)
  const astralFlowDisplaySpeed = getChamaacAstralFlowDisplaySpeed(chamaacAstralFlowSpeed)
  const astralFlowColors = resolveChamaacAstralFlowColors({
    chamaacAstralFlowPaletteMode,
    chamaacAstralFlowPrimaryColor,
    chamaacAstralFlowHarmony,
    chamaacAstralFlowColorOne,
    chamaacAstralFlowColorTwo,
    chamaacAstralFlowColorThree,
  })
  const deepSpaceNebulaDisplaySpeed = getChamaacDeepSpaceNebulaDisplaySpeed(chamaacDeepSpaceNebulaSpeed)
  const deepSpaceNebulaColors = resolveChamaacDeepSpaceNebulaColors({
    chamaacDeepSpaceNebulaPaletteMode,
    chamaacDeepSpaceNebulaPrimaryColor,
    chamaacDeepSpaceNebulaHarmony,
    chamaacDeepSpaceNebulaColorOne,
    chamaacDeepSpaceNebulaColorTwo,
    chamaacDeepSpaceNebulaColorThree,
  })
  const gridBloomDisplaySpeed = getChamaacGridBloomDisplaySpeed(chamaacGridBloomSpeed)
  const liquidChromeFlowSpeed = getChamaacLiquidChromeDisplayFlowSpeed(chamaacLiquidChromeFlowSpeed)
  const liquidChromeTimeScale = getChamaacLiquidChromeDisplayTimeScale(chamaacLiquidChromeTimeScale)
  const liquidChromeColors = resolveChamaacLiquidChromeColors({
    chamaacLiquidChromePaletteMode,
    chamaacLiquidChromePrimaryColor,
    chamaacLiquidChromeHarmony,
    chamaacLiquidChromeColorOne,
    chamaacLiquidChromeColorTwo,
  })
  const wavesSpeedX = getChamaacWavesDisplaySpeed(chamaacWavesSpeedX)
  const wavesSpeedY = getChamaacWavesDisplaySpeed(chamaacWavesSpeedY)
  const wavesColors = resolveChamaacWavesColors({
    chamaacWavesPaletteMode,
    chamaacWavesPrimaryColor,
    chamaacWavesHarmony,
    chamaacWavesBackgroundColor,
    chamaacWavesColorOne,
    chamaacWavesColorTwo,
    chamaacWavesColorThree,
  })
  const novatrixSpeed = getEldoraNovatrixDisplaySpeed(eldoraNovatrixSpeed)
  const novatrixAmplitude = getEldoraNovatrixDisplayAmplitude(eldoraNovatrixAmplitude)
  const novatrixColor = resolveEldoraNovatrixColor({
    eldoraNovatrixPaletteMode,
    eldoraNovatrixPrimaryColor,
    eldoraNovatrixHarmony,
    eldoraNovatrixColor,
  })
  const synthesisDisplaySpeed = getChamaacSynthesisDisplaySpeed(chamaacSynthesisSpeed)
  const synthesisColors = resolveChamaacSynthesisColors({
    chamaacSynthesisPaletteMode,
    chamaacSynthesisPrimaryColor,
    chamaacSynthesisHarmony,
    chamaacSynthesisColorOne,
    chamaacSynthesisColorTwo,
    chamaacSynthesisColorThree,
  })
  const [primaryDisplay, setPrimaryDisplay] = useState<PrimaryDisplay>(isClockMode ? "currentTime" : "timer")
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<SettingsTab>(isClockMode ? "display" : "timer")
  const [controlState, setControlState] = useState<"visible" | "faded" | "hidden">("visible")
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
  const isTimerPrimary = primaryDisplay === "timer"
  const isCurrentTimePrimary = isClockMode || !isTimerPrimary
  const resolvedShowTimerSeconds = showTimerSeconds !== false
  const resolvedPrimaryFontColor = primaryFontColor || DEFAULT_PRIMARY_FONT_COLOR
  const resolvedSecondaryFontColor = secondaryFontColor || DEFAULT_SECONDARY_FONT_COLOR
  const resolvedClockModeFontColor = clockModeFontColor || DEFAULT_CLOCK_MODE_FONT_COLOR
  const resolvedTimerDisplayColor = isTimerPrimary ? resolvedPrimaryFontColor : resolvedSecondaryFontColor
  const resolvedCurrentTimeDisplayColor = isClockMode
    ? resolvedClockModeFontColor
    : isCurrentTimePrimary ? resolvedPrimaryFontColor : resolvedSecondaryFontColor
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
    setSettingsTab(isClockMode ? "display" : "timer")
    setIsSettingsOpen(true)
  }

  const handleSettingsChange = (nextSettings: Partial<ChimerSettings>) => {
    if (!canUseCustomColors && Object.keys(nextSettings).some((key) => CUSTOM_COLOR_SETTING_KEYS.has(key))) {
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
    setSettingsTab(nextTab as SettingsTab)
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

  const renderBackgroundControls = (option: BackgroundDefinition) => (
    <div className={styles.backgroundCardControls}>
      {!isClockMode && (
        <label className={styles.colorRow}>
          <span>Primary color</span>
          <input
            type="color"
            value={resolvedPrimaryFontColor}
            disabled={!canUseCustomColors}
            onChange={(event) => handleSettingsChange({ primaryFontColor: event.target.value })}
            aria-label="Primary display color"
          />
        </label>
      )}

      <label className={styles.colorRow}>
        <span>{isClockMode ? "Clock color" : "Secondary color"}</span>
        <input
          type="color"
          value={isClockMode ? resolvedClockModeFontColor : resolvedSecondaryFontColor}
          disabled={!canUseCustomColors}
          onChange={(event) => handleSettingsChange(
            isClockMode
              ? { clockModeFontColor: event.target.value }
              : { secondaryFontColor: event.target.value },
          )}
          aria-label={isClockMode ? "Clock color" : "Secondary display color"}
        />
      </label>

      {option.id === "massage-lab-moving-gradient" && (
        <>
          <label className={styles.colorRow}>
            <span>Lamp main color</span>
            <input
              type="color"
              value={movingBackgroundMainColor}
              disabled={!canUseCustomColors}
              onChange={(event) => handleSettingsChange({ movingBackgroundMainColor: event.target.value })}
              aria-label="Lamp main color"
            />
          </label>

          <label className={styles.colorRow}>
            <span>Lamp orb color</span>
            <input
              type="color"
              value={movingBackgroundOrbColor}
              disabled={!canUseCustomColors}
              onChange={(event) => handleSettingsChange({ movingBackgroundOrbColor: event.target.value })}
              aria-label="Lamp orb color"
            />
          </label>
        </>
      )}

      {option.id === "aceternity-gradient-animation" && (
        <>
          <label className={styles.colorRow}>
            <span>Base start</span>
            <input
              type="color"
              value={gradientAnimationBackgroundStartColor}
              onChange={(event) => handleSettingsChange({ gradientAnimationBackgroundStartColor: event.target.value })}
              aria-label="Gradient animation background start color"
            />
          </label>

          <label className={styles.colorRow}>
            <span>Base end</span>
            <input
              type="color"
              value={gradientAnimationBackgroundEndColor}
              onChange={(event) => handleSettingsChange({ gradientAnimationBackgroundEndColor: event.target.value })}
              aria-label="Gradient animation background end color"
            />
          </label>

          <label className={styles.colorRow}>
            <span>Glow 1</span>
            <input
              type="color"
              value={gradientAnimationFirstColor}
              onChange={(event) => handleSettingsChange({ gradientAnimationFirstColor: event.target.value })}
              aria-label="Gradient animation first glow color"
            />
          </label>

          <label className={styles.colorRow}>
            <span>Glow 2</span>
            <input
              type="color"
              value={gradientAnimationSecondColor}
              onChange={(event) => handleSettingsChange({ gradientAnimationSecondColor: event.target.value })}
              aria-label="Gradient animation second glow color"
            />
          </label>

          <label className={styles.colorRow}>
            <span>Glow 3</span>
            <input
              type="color"
              value={gradientAnimationThirdColor}
              onChange={(event) => handleSettingsChange({ gradientAnimationThirdColor: event.target.value })}
              aria-label="Gradient animation third glow color"
            />
          </label>

          <label className={styles.colorRow}>
            <span>Glow 4</span>
            <input
              type="color"
              value={gradientAnimationFourthColor}
              onChange={(event) => handleSettingsChange({ gradientAnimationFourthColor: event.target.value })}
              aria-label="Gradient animation fourth glow color"
            />
          </label>

          <label className={styles.colorRow}>
            <span>Glow 5</span>
            <input
              type="color"
              value={gradientAnimationFifthColor}
              onChange={(event) => handleSettingsChange({ gradientAnimationFifthColor: event.target.value })}
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
              value={gradientAnimationSpeed}
              onChange={(event) => handleSettingsChange({ gradientAnimationSpeed: Number(event.target.value) })}
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
              value={gradientAnimationSize}
              onChange={(event) => handleSettingsChange({ gradientAnimationSize: Number(event.target.value) })}
              aria-label="Gradient animation glow size"
            />
          </label>
        </>
      )}

      {option.id === "animate-ui-gradient" && (
        <>
          <label className={styles.colorRow}>
            <span>Primary color</span>
            <input
              type="color"
              value={animateUiGradientPrimaryColor}
              onChange={(event) => handleSettingsChange({ animateUiGradientPrimaryColor: event.target.value })}
              aria-label="Animate UI gradient primary color"
            />
          </label>

          <label className={styles.selectRow}>
            <span>Color harmony</span>
            <select
              value={animateUiGradientHarmony}
              onChange={(event) => handleSettingsChange({
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
            <span>Opacity ({Math.round(animateUiGradientOpacity * 100)}%)</span>
            <input
              type="range"
              min="0.15"
              max="1"
              step="0.01"
              value={animateUiGradientOpacity}
              onChange={(event) => handleSettingsChange({ animateUiGradientOpacity: Number(event.target.value) })}
              aria-label="Animate UI gradient opacity"
            />
          </label>
        </>
      )}

      {option.id === "animate-ui-hole" && (
        <>
          <label className={styles.colorRow}>
            <span>Grid line color</span>
            <input
              type="color"
              value={animateUiHoleStrokeColor}
              onChange={(event) => handleSettingsChange({ animateUiHoleStrokeColor: event.target.value })}
              aria-label="Animate UI Hole grid line color"
            />
          </label>

          <label className={styles.colorRow}>
            <span>Particle color</span>
            <input
              type="color"
              value={animateUiHoleParticleColor}
              onChange={(event) => handleSettingsChange({ animateUiHoleParticleColor: event.target.value })}
              aria-label="Animate UI Hole particle color"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Line count ({animateUiHoleLineCount})</span>
            <input
              type="range"
              min="12"
              max="96"
              step="1"
              value={animateUiHoleLineCount}
              onChange={(event) => handleSettingsChange({ animateUiHoleLineCount: Number(event.target.value) })}
              aria-label="Animate UI Hole line count"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Disc count ({animateUiHoleDiscCount})</span>
            <input
              type="range"
              min="12"
              max="96"
              step="1"
              value={animateUiHoleDiscCount}
              onChange={(event) => handleSettingsChange({ animateUiHoleDiscCount: Number(event.target.value) })}
              aria-label="Animate UI Hole disc count"
            />
          </label>
        </>
      )}

      {option.id === "chamaac-light-speed" && (
        <>
          <label className={styles.colorRow}>
            <span>Light color</span>
            <input
              type="color"
              value={chamaacLightSpeedLightColor}
              onChange={(event) => handleSettingsChange({ chamaacLightSpeedLightColor: event.target.value })}
              aria-label="Light Speed light color"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Warp speed ({chamaacLightSpeedWarpSpeed.toFixed(2)}x)</span>
            <input
              type="range"
              min="0.1"
              max="24"
              step="0.01"
              value={chamaacLightSpeedWarpSpeed}
              onChange={(event) => handleSettingsChange({ chamaacLightSpeedWarpSpeed: Number(event.target.value) })}
              aria-label="Light Speed warp speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Particles ({chamaacLightSpeedParticleCount})</span>
            <input
              type="range"
              min="20"
              max="200"
              step="5"
              value={chamaacLightSpeedParticleCount}
              onChange={(event) => handleSettingsChange({ chamaacLightSpeedParticleCount: Number(event.target.value) })}
              aria-label="Light Speed particle count"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Glow ({chamaacLightSpeedIntensity.toFixed(2)}x)</span>
            <input
              type="range"
              min="0.25"
              max="6"
              step="0.05"
              value={chamaacLightSpeedIntensity}
              onChange={(event) => handleSettingsChange({ chamaacLightSpeedIntensity: Number(event.target.value) })}
              aria-label="Light Speed glow intensity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Tunnel radius ({chamaacLightSpeedRadius}px)</span>
            <input
              type="range"
              min="6"
              max="60"
              step="1"
              value={chamaacLightSpeedRadius}
              onChange={(event) => handleSettingsChange({ chamaacLightSpeedRadius: Number(event.target.value) })}
              aria-label="Light Speed tunnel radius"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Field length ({chamaacLightSpeedCylinderLength}px)</span>
            <input
              type="range"
              min="40"
              max="300"
              step="5"
              value={chamaacLightSpeedCylinderLength}
              onChange={(event) => handleSettingsChange({ chamaacLightSpeedCylinderLength: Number(event.target.value) })}
              aria-label="Light Speed field length"
            />
          </label>
        </>
      )}

      {option.id === "animate-ui-stars" && (
        <>
          <label className={styles.colorRow}>
            <span>Star color</span>
            <input
              type="color"
              value={animateUiStarsColor}
              onChange={(event) => handleSettingsChange({ animateUiStarsColor: event.target.value })}
              aria-label="Animate UI Stars star color"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Speed ({animateUiStarsSpeed}s)</span>
            <input
              type="range"
              min="18"
              max="120"
              step="1"
              value={animateUiStarsSpeed}
              onChange={(event) => handleSettingsChange({ animateUiStarsSpeed: Number(event.target.value) })}
              aria-label="Animate UI Stars speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Density ({Math.round(animateUiStarsDensity * 100)}%)</span>
            <input
              type="range"
              min="0.25"
              max="1.5"
              step="0.05"
              value={animateUiStarsDensity}
              onChange={(event) => handleSettingsChange({ animateUiStarsDensity: Number(event.target.value) })}
              aria-label="Animate UI Stars density"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Parallax ({Math.round(animateUiStarsParallax * 1000) / 10}%)</span>
            <input
              type="range"
              min="0"
              max="0.12"
              step="0.005"
              value={animateUiStarsParallax}
              onChange={(event) => handleSettingsChange({ animateUiStarsParallax: Number(event.target.value) })}
              aria-label="Animate UI Stars parallax strength"
            />
          </label>
        </>
      )}

      {option.id === "aceternity-sparkles" && (
        <>
          <label className={styles.colorRow}>
            <span>Sparkle color</span>
            <input
              type="color"
              value={sparklesParticleColor}
              onChange={(event) => handleSettingsChange({ sparklesParticleColor: event.target.value })}
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

      {option.id === "chamaac-electric-mist" && (
        <>
          <label className={styles.colorRow}>
            <span>Lightning color</span>
            <input
              type="color"
              value={chamaacElectricMistColor}
              onChange={(event) => handleSettingsChange({ chamaacElectricMistColor: event.target.value })}
              aria-label="Electric Mist lightning color"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Animation speed ({Math.round(chamaacElectricMistSpeed)}%)</span>
            <input
              type="range"
              min="1"
              max="400"
              step="1"
              value={chamaacElectricMistSpeed}
              onChange={(event) => handleSettingsChange({ chamaacElectricMistSpeed: Number(event.target.value) })}
              aria-label="Electric Mist animation speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Noise detail ({chamaacElectricMistDetail.toFixed(1)})</span>
            <input
              type="range"
              min="0.5"
              max="4"
              step="0.1"
              value={chamaacElectricMistDetail}
              onChange={(event) => handleSettingsChange({ chamaacElectricMistDetail: Number(event.target.value) })}
              aria-label="Electric Mist noise detail"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Distortion ({chamaacElectricMistDistortion.toFixed(1)}x)</span>
            <input
              type="range"
              min="0"
              max="6"
              step="0.1"
              value={chamaacElectricMistDistortion}
              onChange={(event) => handleSettingsChange({ chamaacElectricMistDistortion: Number(event.target.value) })}
              aria-label="Electric Mist distortion"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Brightness ({Math.round(chamaacElectricMistBrightness)}%)</span>
            <input
              type="range"
              min="1"
              max="100"
              step="1"
              value={chamaacElectricMistBrightness}
              onChange={(event) => handleSettingsChange({ chamaacElectricMistBrightness: Number(event.target.value) })}
              aria-label="Electric Mist brightness"
            />
          </label>
        </>
      )}

      {option.id === "chamaac-astral-flow" && (
        <>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={chamaacAstralFlowPaletteMode}
              onChange={(event) => handleSettingsChange({
                chamaacAstralFlowPaletteMode: event.target.value as ChamaacAstralFlowPaletteMode,
              })}
              aria-label="Astral Flow color mode"
            >
              <option value="custom">Custom colors</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {chamaacAstralFlowPaletteMode === "custom" ? (
            <>
              <label className={styles.colorRow}>
                <span>Color 1 (deep)</span>
                <input
                  type="color"
                  value={chamaacAstralFlowColorOne}
                  onChange={(event) => handleSettingsChange({ chamaacAstralFlowColorOne: event.target.value })}
                  aria-label="Astral Flow color 1"
                />
              </label>

              <label className={styles.colorRow}>
                <span>Color 2 (mid)</span>
                <input
                  type="color"
                  value={chamaacAstralFlowColorTwo}
                  onChange={(event) => handleSettingsChange({ chamaacAstralFlowColorTwo: event.target.value })}
                  aria-label="Astral Flow color 2"
                />
              </label>

              <label className={styles.colorRow}>
                <span>Color 3 (highlights)</span>
                <input
                  type="color"
                  value={chamaacAstralFlowColorThree}
                  onChange={(event) => handleSettingsChange({ chamaacAstralFlowColorThree: event.target.value })}
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
                  value={chamaacAstralFlowPrimaryColor}
                  onChange={(event) => handleSettingsChange({ chamaacAstralFlowPrimaryColor: event.target.value })}
                  aria-label="Astral Flow primary color"
                />
              </label>

              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={chamaacAstralFlowHarmony}
                  onChange={(event) => handleSettingsChange({
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
              onChange={(event) => handleSettingsChange({
                chamaacAstralFlowSpeed: getChamaacAstralFlowSourceSpeed(Number(event.target.value)),
              })}
              aria-label="Astral Flow animation speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Flow min ({chamaacAstralFlowFlowMin.toFixed(1)})</span>
            <input
              type="range"
              min="0.5"
              max="10"
              step="0.1"
              value={chamaacAstralFlowFlowMin}
              onChange={(event) => handleSettingsChange({ chamaacAstralFlowFlowMin: Number(event.target.value) })}
              aria-label="Astral Flow flow min"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Flow max ({chamaacAstralFlowFlowMax.toFixed(1)})</span>
            <input
              type="range"
              min="1"
              max="12"
              step="0.1"
              value={chamaacAstralFlowFlowMax}
              onChange={(event) => handleSettingsChange({ chamaacAstralFlowFlowMax: Number(event.target.value) })}
              aria-label="Astral Flow flow max"
            />
          </label>
        </>
      )}

      {option.id === "chamaac-deep-space-nebula" && (
        <>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={chamaacDeepSpaceNebulaPaletteMode}
              onChange={(event) => handleSettingsChange({
                chamaacDeepSpaceNebulaPaletteMode: event.target.value as ChamaacDeepSpaceNebulaPaletteMode,
              })}
              aria-label="Deep Space Nebula color mode"
            >
              <option value="custom">Custom colors</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {chamaacDeepSpaceNebulaPaletteMode === "custom" ? (
            <>
              <label className={styles.colorRow}>
                <span>Highlight</span>
                <input
                  type="color"
                  value={chamaacDeepSpaceNebulaColorOne}
                  onChange={(event) => handleSettingsChange({ chamaacDeepSpaceNebulaColorOne: event.target.value })}
                  aria-label="Deep Space Nebula highlight color"
                />
              </label>

              <label className={styles.colorRow}>
                <span>Nebula cloud</span>
                <input
                  type="color"
                  value={chamaacDeepSpaceNebulaColorTwo}
                  onChange={(event) => handleSettingsChange({ chamaacDeepSpaceNebulaColorTwo: event.target.value })}
                  aria-label="Deep Space Nebula cloud color"
                />
              </label>

              <label className={styles.colorRow}>
                <span>Deep space</span>
                <input
                  type="color"
                  value={chamaacDeepSpaceNebulaColorThree}
                  onChange={(event) => handleSettingsChange({ chamaacDeepSpaceNebulaColorThree: event.target.value })}
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
                  value={chamaacDeepSpaceNebulaPrimaryColor}
                  onChange={(event) => handleSettingsChange({ chamaacDeepSpaceNebulaPrimaryColor: event.target.value })}
                  aria-label="Deep Space Nebula primary color"
                />
              </label>

              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={chamaacDeepSpaceNebulaHarmony}
                  onChange={(event) => handleSettingsChange({
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
            <span>Animation speed ({deepSpaceNebulaDisplaySpeed}%)</span>
            <input
              type="range"
              min={CHAMAAC_DEEP_SPACE_NEBULA_DISPLAY_SPEED_MIN}
              max={CHAMAAC_DEEP_SPACE_NEBULA_DISPLAY_SPEED_MAX}
              step={CHAMAAC_DEEP_SPACE_NEBULA_DISPLAY_SPEED_STEP}
              value={deepSpaceNebulaDisplaySpeed}
              onChange={(event) => handleSettingsChange({
                chamaacDeepSpaceNebulaSpeed: getChamaacDeepSpaceNebulaSourceSpeed(Number(event.target.value)),
              })}
              aria-label="Deep Space Nebula animation speed"
            />
          </label>
        </>
      )}

      {option.id === "chamaac-grid-bloom" && (
        <>
          <label className={styles.colorRow}>
            <span>Bloom color</span>
            <input
              type="color"
              value={chamaacGridBloomColor}
              onChange={(event) => handleSettingsChange({ chamaacGridBloomColor: event.target.value })}
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
              onChange={(event) => handleSettingsChange({
                chamaacGridBloomSpeed: getChamaacGridBloomSourceSpeed(Number(event.target.value)),
              })}
              aria-label="Grid Bloom animation speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Grid density ({chamaacGridBloomGridScale.toFixed(0)})</span>
            <input
              type="range"
              min="4"
              max="32"
              step="1"
              value={chamaacGridBloomGridScale}
              onChange={(event) => handleSettingsChange({ chamaacGridBloomGridScale: Number(event.target.value) })}
              aria-label="Grid Bloom grid density"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Rotation speed ({chamaacGridBloomRotationSpeed.toFixed(1)}x)</span>
            <input
              type="range"
              min="-3"
              max="3"
              step="0.1"
              value={chamaacGridBloomRotationSpeed}
              onChange={(event) => handleSettingsChange({ chamaacGridBloomRotationSpeed: Number(event.target.value) })}
              aria-label="Grid Bloom rotation speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Fade falloff ({chamaacGridBloomFadeFalloff.toFixed(1)})</span>
            <input
              type="range"
              min="1"
              max="24"
              step="0.5"
              value={chamaacGridBloomFadeFalloff}
              onChange={(event) => handleSettingsChange({ chamaacGridBloomFadeFalloff: Number(event.target.value) })}
              aria-label="Grid Bloom fade falloff"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Distortion ({chamaacGridBloomDistortionAmount.toFixed(2)})</span>
            <input
              type="range"
              min="0"
              max="0.5"
              step="0.01"
              value={chamaacGridBloomDistortionAmount}
              onChange={(event) => handleSettingsChange({
                chamaacGridBloomDistortionAmount: Number(event.target.value),
              })}
              aria-label="Grid Bloom distortion"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Flow X ({chamaacGridBloomFlowSpeedX.toFixed(1)})</span>
            <input
              type="range"
              min="-2"
              max="2"
              step="0.1"
              value={chamaacGridBloomFlowSpeedX}
              onChange={(event) => handleSettingsChange({ chamaacGridBloomFlowSpeedX: Number(event.target.value) })}
              aria-label="Grid Bloom flow X"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Flow Y ({chamaacGridBloomFlowSpeedY.toFixed(1)})</span>
            <input
              type="range"
              min="-2"
              max="2"
              step="0.1"
              value={chamaacGridBloomFlowSpeedY}
              onChange={(event) => handleSettingsChange({ chamaacGridBloomFlowSpeedY: Number(event.target.value) })}
              aria-label="Grid Bloom flow Y"
            />
          </label>
        </>
      )}

      {option.id === "chamaac-liquid-chrome" && (
        <>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={chamaacLiquidChromePaletteMode}
              onChange={(event) => handleSettingsChange({
                chamaacLiquidChromePaletteMode: event.target.value as ChamaacLiquidChromePaletteMode,
              })}
              aria-label="Liquid Chrome color mode"
            >
              <option value="custom">Custom colors</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {chamaacLiquidChromePaletteMode === "custom" ? (
            <>
              <label className={styles.colorRow}>
                <span>Chrome color</span>
                <input
                  type="color"
                  value={chamaacLiquidChromeColorOne}
                  onChange={(event) => handleSettingsChange({ chamaacLiquidChromeColorOne: event.target.value })}
                  aria-label="Liquid Chrome chrome color"
                />
              </label>

              <label className={styles.colorRow}>
                <span>Shadow color</span>
                <input
                  type="color"
                  value={chamaacLiquidChromeColorTwo}
                  onChange={(event) => handleSettingsChange({ chamaacLiquidChromeColorTwo: event.target.value })}
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
                  value={chamaacLiquidChromePrimaryColor}
                  onChange={(event) => handleSettingsChange({ chamaacLiquidChromePrimaryColor: event.target.value })}
                  aria-label="Liquid Chrome primary color"
                />
              </label>

              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={chamaacLiquidChromeHarmony}
                  onChange={(event) => handleSettingsChange({
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
              onChange={(event) => handleSettingsChange({
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
              onChange={(event) => handleSettingsChange({
                chamaacLiquidChromeTimeScale: getChamaacLiquidChromeSourceTimeScale(Number(event.target.value)),
              })}
              aria-label="Liquid Chrome time scale"
            />
          </label>
        </>
      )}

      {option.id === "chamaac-waves" && (
        <>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={chamaacWavesPaletteMode}
              onChange={(event) => handleSettingsChange({
                chamaacWavesPaletteMode: event.target.value as ChamaacWavesPaletteMode,
              })}
              aria-label="Waves color mode"
            >
              <option value="custom">Custom colors</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {chamaacWavesPaletteMode === "custom" ? (
            <>
              <label className={styles.colorRow}>
                <span>Background</span>
                <input
                  type="color"
                  value={chamaacWavesBackgroundColor}
                  onChange={(event) => handleSettingsChange({ chamaacWavesBackgroundColor: event.target.value })}
                  aria-label="Waves background color"
                />
              </label>

              <label className={styles.colorRow}>
                <span>Primary wave</span>
                <input
                  type="color"
                  value={chamaacWavesColorOne}
                  onChange={(event) => handleSettingsChange({ chamaacWavesColorOne: event.target.value })}
                  aria-label="Waves primary wave color"
                />
              </label>

              <label className={styles.colorRow}>
                <span>Highlight</span>
                <input
                  type="color"
                  value={chamaacWavesColorTwo}
                  onChange={(event) => handleSettingsChange({ chamaacWavesColorTwo: event.target.value })}
                  aria-label="Waves highlight color"
                />
              </label>

              <label className={styles.colorRow}>
                <span>Valley</span>
                <input
                  type="color"
                  value={chamaacWavesColorThree}
                  onChange={(event) => handleSettingsChange({ chamaacWavesColorThree: event.target.value })}
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
                  value={chamaacWavesPrimaryColor}
                  onChange={(event) => handleSettingsChange({ chamaacWavesPrimaryColor: event.target.value })}
                  aria-label="Waves primary color"
                />
              </label>

              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={chamaacWavesHarmony}
                  onChange={(event) => handleSettingsChange({
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
              onChange={(event) => handleSettingsChange({
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
              onChange={(event) => handleSettingsChange({
                chamaacWavesSpeedY: getChamaacWavesSourceSpeed(Number(event.target.value)),
              })}
              aria-label="Waves speed Y"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Amplitude ({chamaacWavesAmplitude.toFixed(0)})</span>
            <input
              type="range"
              min="8"
              max="64"
              step="1"
              value={chamaacWavesAmplitude}
              onChange={(event) => handleSettingsChange({ chamaacWavesAmplitude: Number(event.target.value) })}
              aria-label="Waves amplitude"
            />
          </label>
        </>
      )}

      {option.id === "eldora-novatrix-background" && (
        <>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={eldoraNovatrixPaletteMode}
              onChange={(event) => handleSettingsChange({
                eldoraNovatrixPaletteMode: event.target.value as EldoraNovatrixPaletteMode,
              })}
              aria-label="Novatrix color mode"
            >
              <option value="custom">Custom color</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {eldoraNovatrixPaletteMode === "custom" ? (
            <label className={styles.colorRow}>
              <span>Animation color</span>
              <input
                type="color"
                value={eldoraNovatrixColor}
                onChange={(event) => handleSettingsChange({ eldoraNovatrixColor: event.target.value })}
                aria-label="Novatrix animation color"
              />
            </label>
          ) : (
            <>
              <label className={styles.colorRow}>
                <span>Primary color</span>
                <input
                  type="color"
                  value={eldoraNovatrixPrimaryColor}
                  onChange={(event) => handleSettingsChange({ eldoraNovatrixPrimaryColor: event.target.value })}
                  aria-label="Novatrix primary color"
                />
              </label>

              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={eldoraNovatrixHarmony}
                  onChange={(event) => handleSettingsChange({
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
              onChange={(event) => handleSettingsChange({
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
              onChange={(event) => handleSettingsChange({
                eldoraNovatrixAmplitude: getEldoraNovatrixSourceAmplitude(Number(event.target.value)),
              })}
              aria-label="Novatrix amplitude"
            />
          </label>
        </>
      )}

      {option.id === "chamaac-synthesis" && (
        <>
          <label className={styles.selectRow}>
            <span>Color mode</span>
            <select
              value={chamaacSynthesisPaletteMode}
              onChange={(event) => handleSettingsChange({
                chamaacSynthesisPaletteMode: event.target.value as ChamaacSynthesisPaletteMode,
              })}
              aria-label="Synthesis color mode"
            >
              <option value="custom">Custom colors</option>
              <option value="harmony">Harmony from primary</option>
            </select>
          </label>

          {chamaacSynthesisPaletteMode === "custom" ? (
            <>
              <label className={styles.colorRow}>
                <span>Color 1</span>
                <input
                  type="color"
                  value={chamaacSynthesisColorOne}
                  onChange={(event) => handleSettingsChange({ chamaacSynthesisColorOne: event.target.value })}
                  aria-label="Synthesis color 1"
                />
              </label>

              <label className={styles.colorRow}>
                <span>Color 2</span>
                <input
                  type="color"
                  value={chamaacSynthesisColorTwo}
                  onChange={(event) => handleSettingsChange({ chamaacSynthesisColorTwo: event.target.value })}
                  aria-label="Synthesis color 2"
                />
              </label>

              <label className={styles.colorRow}>
                <span>Color 3</span>
                <input
                  type="color"
                  value={chamaacSynthesisColorThree}
                  onChange={(event) => handleSettingsChange({ chamaacSynthesisColorThree: event.target.value })}
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
                  value={chamaacSynthesisPrimaryColor}
                  onChange={(event) => handleSettingsChange({ chamaacSynthesisPrimaryColor: event.target.value })}
                  aria-label="Synthesis primary color"
                />
              </label>

              <label className={styles.selectRow}>
                <span>Color harmony</span>
                <select
                  value={chamaacSynthesisHarmony}
                  onChange={(event) => handleSettingsChange({
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
              onChange={(event) => handleSettingsChange({
                chamaacSynthesisSpeed: getChamaacSynthesisSourceSpeed(Number(event.target.value)),
              })}
              aria-label="Synthesis animation speed"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Complexity ({chamaacSynthesisComplexity})</span>
            <input
              type="range"
              min="1"
              max="20"
              step="1"
              value={chamaacSynthesisComplexity}
              onChange={(event) => handleSettingsChange({ chamaacSynthesisComplexity: Number(event.target.value) })}
              aria-label="Synthesis complexity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Zoom scale ({chamaacSynthesisScale.toFixed(1)}x)</span>
            <input
              type="range"
              min="0.1"
              max="5"
              step="0.1"
              value={chamaacSynthesisScale}
              onChange={(event) => handleSettingsChange({ chamaacSynthesisScale: Number(event.target.value) })}
              aria-label="Synthesis zoom scale"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Distortion ({chamaacSynthesisDistortion.toFixed(1)}x)</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={chamaacSynthesisDistortion}
              onChange={(event) => handleSettingsChange({ chamaacSynthesisDistortion: Number(event.target.value) })}
              aria-label="Synthesis distortion"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Glow intensity ({chamaacSynthesisGlowIntensity.toFixed(1)}x)</span>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={chamaacSynthesisGlowIntensity}
              onChange={(event) => handleSettingsChange({ chamaacSynthesisGlowIntensity: Number(event.target.value) })}
              aria-label="Synthesis glow intensity"
            />
          </label>

          <label className={styles.rangeRow}>
            <span>Flow frequency ({chamaacSynthesisFlowFrequency.toFixed(1)})</span>
            <input
              type="range"
              min="0.5"
              max="10"
              step="0.5"
              value={chamaacSynthesisFlowFrequency}
              onChange={(event) => handleSettingsChange({ chamaacSynthesisFlowFrequency: Number(event.target.value) })}
              aria-label="Synthesis flow frequency"
            />
          </label>
        </>
      )}

      {option.id === "aceternity-background-lines" && (
        <label className={styles.rangeRow}>
          <span>Line duration</span>
          <input
            type="range"
            min="4"
            max="18"
            step="1"
            value={backgroundLinesDuration}
            onChange={(event) => handleSettingsChange({ backgroundLinesDuration: Number(event.target.value) })}
            aria-label="Background lines animation duration"
          />
        </label>
      )}

      {option.id === "aceternity-shooting-stars" && (
        <>
          <label className={styles.colorRow}>
            <span>Stars</span>
            <input
              type="color"
              value={shootingStarsStarColor}
              onChange={(event) => handleSettingsChange({ shootingStarsStarColor: event.target.value })}
              aria-label="Shooting stars background star color"
            />
          </label>

          <label className={styles.colorRow}>
            <span>Trail</span>
            <input
              type="color"
              value={shootingStarsTrailColor}
              onChange={(event) => handleSettingsChange({ shootingStarsTrailColor: event.target.value })}
              aria-label="Shooting stars trail color"
            />
          </label>

          <label className={styles.colorRow}>
            <span>Shooting star</span>
            <input
              type="color"
              value={shootingStarsShootingStarColor}
              onChange={(event) => handleSettingsChange({ shootingStarsShootingStarColor: event.target.value })}
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

      {option.id === "aceternity-canvas-reveal-dots" && (
        <>
          <label className={styles.colorRow}>
            <span>Background</span>
            <input
              type="color"
              value={canvasRevealDotsBackgroundColor}
              onChange={(event) => handleSettingsChange({ canvasRevealDotsBackgroundColor: event.target.value })}
              aria-label="Canvas reveal dots background color"
            />
          </label>

          <label className={styles.colorRow}>
            <span>Dot color</span>
            <input
              type="color"
              value={canvasRevealDotsDotColor}
              onChange={(event) => handleSettingsChange({ canvasRevealDotsDotColor: event.target.value })}
              aria-label="Canvas reveal dots dot color"
            />
          </label>

          <label className={styles.colorRow}>
            <span>Accent</span>
            <input
              type="color"
              value={canvasRevealDotsAccentColor}
              onChange={(event) => handleSettingsChange({ canvasRevealDotsAccentColor: event.target.value })}
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
              value={canvasRevealDotsDotSize}
              onChange={(event) => handleSettingsChange({ canvasRevealDotsDotSize: Number(event.target.value) })}
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
              value={canvasRevealDotsDotSpacing}
              onChange={(event) => handleSettingsChange({ canvasRevealDotsDotSpacing: Number(event.target.value) })}
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
              value={canvasRevealDotsOpacity}
              onChange={(event) => handleSettingsChange({ canvasRevealDotsOpacity: Number(event.target.value) })}
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
              value={canvasRevealDotsAnimationSpeed}
              onChange={(event) => handleSettingsChange({ canvasRevealDotsAnimationSpeed: Number(event.target.value) })}
              aria-label="Canvas reveal dots motion speed"
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

      {option.id === "aceternity-spotlight-new" && (
        <>
          <label className={styles.colorRow}>
            <span>Spotlight color</span>
            <input
              type="color"
              value={spotlightColor}
              onChange={(event) => handleSettingsChange({ spotlightColor: event.target.value })}
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

      {option.id === "aceternity-lamp-effect" && (
        <>
          <label className={styles.colorRow}>
            <span>Background</span>
            <input
              type="color"
              value={lampBackgroundColor}
              onChange={(event) => handleSettingsChange({ lampBackgroundColor: event.target.value })}
              aria-label="Lamp background color"
            />
          </label>

          <label className={styles.colorRow}>
            <span>Beam color</span>
            <input
              type="color"
              value={lampColor}
              onChange={(event) => handleSettingsChange({ lampColor: event.target.value })}
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

      {option.id === "aceternity-vortex" && (
        <>
          <label className={styles.colorRow}>
            <span>Background</span>
            <input
              type="color"
              value={vortexBackgroundColor}
              onChange={(event) => handleSettingsChange({ vortexBackgroundColor: event.target.value })}
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

      {option.id === "aceternity-wavy-background" && (
        <>
          <label className={styles.colorRow}>
            <span>Background</span>
            <input
              type="color"
              value={wavyBackgroundFill}
              onChange={(event) => handleSettingsChange({ wavyBackgroundFill: event.target.value })}
              aria-label="Wavy background fill color"
            />
          </label>

          <label className={styles.colorRow}>
            <span>Wave 1</span>
            <input
              type="color"
              value={wavyColorOne}
              onChange={(event) => handleSettingsChange({ wavyColorOne: event.target.value })}
              aria-label="Wavy first wave color"
            />
          </label>

          <label className={styles.colorRow}>
            <span>Wave 2</span>
            <input
              type="color"
              value={wavyColorTwo}
              onChange={(event) => handleSettingsChange({ wavyColorTwo: event.target.value })}
              aria-label="Wavy second wave color"
            />
          </label>

          <label className={styles.colorRow}>
            <span>Wave 3</span>
            <input
              type="color"
              value={wavyColorThree}
              onChange={(event) => handleSettingsChange({ wavyColorThree: event.target.value })}
              aria-label="Wavy third wave color"
            />
          </label>

          <label className={styles.colorRow}>
            <span>Wave 4</span>
            <input
              type="color"
              value={wavyColorFour}
              onChange={(event) => handleSettingsChange({ wavyColorFour: event.target.value })}
              aria-label="Wavy fourth wave color"
            />
          </label>

          <label className={styles.colorRow}>
            <span>Wave 5</span>
            <input
              type="color"
              value={wavyColorFive}
              onChange={(event) => handleSettingsChange({ wavyColorFive: event.target.value })}
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

      {option.id === "unlumen-aurora-bars" && (
        <>
          <label className={styles.colorRow}>
            <span>Background</span>
            <input
              type="color"
              value={auroraBarsBackgroundColor}
              onChange={(event) => handleSettingsChange({ auroraBarsBackgroundColor: event.target.value })}
              aria-label="Aurora bars background color"
            />
          </label>

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
              <label className={styles.colorRow}>
                <span>Bar color 1</span>
                <input
                  type="color"
                  value={auroraBarsColorOne}
                  onChange={(event) => handleSettingsChange({ auroraBarsColorOne: event.target.value })}
                  aria-label="Aurora bars first color"
                />
              </label>

              <label className={styles.colorRow}>
                <span>Bar color 2</span>
                <input
                  type="color"
                  value={auroraBarsColorTwo}
                  onChange={(event) => handleSettingsChange({ auroraBarsColorTwo: event.target.value })}
                  aria-label="Aurora bars second color"
                />
              </label>

              <label className={styles.colorRow}>
                <span>Bar color 3</span>
                <input
                  type="color"
                  value={auroraBarsColorThree}
                  onChange={(event) => handleSettingsChange({ auroraBarsColorThree: event.target.value })}
                  aria-label="Aurora bars third color"
                />
              </label>

              <label className={styles.colorRow}>
                <span>Bar color 4</span>
                <input
                  type="color"
                  value={auroraBarsColorFour}
                  onChange={(event) => handleSettingsChange({ auroraBarsColorFour: event.target.value })}
                  aria-label="Aurora bars fourth color"
                />
              </label>

              <label className={styles.colorRow}>
                <span>Bar color 5</span>
                <input
                  type="color"
                  value={auroraBarsColorFive}
                  onChange={(event) => handleSettingsChange({ auroraBarsColorFive: event.target.value })}
                  aria-label="Aurora bars fifth color"
                />
              </label>
            </>
          ) : (
            <label className={styles.colorRow}>
              <span>Primary color</span>
              <input
                type="color"
                value={auroraBarsPrimaryColor}
                onChange={(event) => handleSettingsChange({ auroraBarsPrimaryColor: event.target.value })}
                aria-label="Aurora bars primary color"
              />
            </label>
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

      {option.id === "unlumen-pixel-liquid" && (
        <>
          <label className={styles.colorRow}>
            <span>Background color</span>
            <input
              type="color"
              value={pixelLiquidBackgroundColor}
              onChange={(event) => handleSettingsChange({ pixelLiquidBackgroundColor: event.target.value })}
              aria-label="Pixel liquid background color"
            />
          </label>

          <label className={styles.colorRow}>
            <span>Base color</span>
            <input
              type="color"
              value={pixelLiquidBaseColor}
              onChange={(event) => handleSettingsChange({ pixelLiquidBaseColor: event.target.value })}
              aria-label="Pixel liquid base color"
            />
          </label>

          <label className={styles.colorRow}>
            <span>Accent color</span>
            <input
              type="color"
              value={pixelLiquidAccentColor}
              onChange={(event) => handleSettingsChange({ pixelLiquidAccentColor: event.target.value })}
              aria-label="Pixel liquid accent color"
            />
          </label>

          <label className={styles.colorRow}>
            <span>Highlight color</span>
            <input
              type="color"
              value={pixelLiquidHighlightColor}
              onChange={(event) => handleSettingsChange({ pixelLiquidHighlightColor: event.target.value })}
              aria-label="Pixel liquid highlight color"
            />
          </label>

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
              <label className={styles.colorRow}>
                <span>Color 1</span>
                <input
                  type="color"
                  value={tileGridColorOne}
                  onChange={(event) => handleSettingsChange({ tileGridColorOne: event.target.value })}
                  aria-label="Tile grid first color"
                />
              </label>

              <label className={styles.colorRow}>
                <span>Color 2</span>
                <input
                  type="color"
                  value={tileGridColorTwo}
                  onChange={(event) => handleSettingsChange({ tileGridColorTwo: event.target.value })}
                  aria-label="Tile grid second color"
                />
              </label>

              <label className={styles.colorRow}>
                <span>Color 3</span>
                <input
                  type="color"
                  value={tileGridColorThree}
                  onChange={(event) => handleSettingsChange({ tileGridColorThree: event.target.value })}
                  aria-label="Tile grid third color"
                />
              </label>

              <label className={styles.colorRow}>
                <span>Color 4</span>
                <input
                  type="color"
                  value={tileGridColorFour}
                  onChange={(event) => handleSettingsChange({ tileGridColorFour: event.target.value })}
                  aria-label="Tile grid fourth color"
                />
              </label>

              <label className={styles.colorRow}>
                <span>Color 5</span>
                <input
                  type="color"
                  value={tileGridColorFive}
                  onChange={(event) => handleSettingsChange({ tileGridColorFive: event.target.value })}
                  aria-label="Tile grid fifth color"
                />
              </label>
            </>
          ) : (
            <label className={styles.colorRow}>
              <span>Primary color</span>
              <input
                type="color"
                value={tileGridPrimaryColor}
                onChange={(event) => handleSettingsChange({ tileGridPrimaryColor: event.target.value })}
                aria-label="Tile grid primary color"
              />
            </label>
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
          <label className={styles.colorRow}>
            <span>Primary color</span>
            <input
              type="color"
              value={hexGridPrimaryColor}
              onChange={(event) => handleSettingsChange({ hexGridPrimaryColor: event.target.value })}
              aria-label="Hex grid primary color"
            />
          </label>

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
  const premiumBackgroundClassName = [
    styles.runningBackground,
    isFullscreen && backgroundId === "aceternity-lamp-effect" ? styles.runningLampFullscreenBackground : "",
  ].filter(Boolean).join(" ")
  const fullscreenLampBeamScale = Math.min(4.2, Math.max(2.75, 2.25 + fontSize * 0.03))
  const fullscreenLampGlowScale = Math.min(3.65, Math.max(2.35, 1.95 + fontSize * 0.026))
  const fullscreenLampLineWidth = Math.min(78, Math.max(62, 48 + fontSize * 0.42))
  const fullscreenLampGlowWidth = Math.min(68, Math.max(52, 42 + fontSize * 0.36))
  const fullscreenLampCoreGlowWidth = Math.min(42, Math.max(30, 24 + fontSize * 0.2))
  const premiumBackgroundStyle = isFullscreen && backgroundId === "aceternity-lamp-effect"
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
      {movingBackgroundEnabled && useOriginalLampBackground && (
        <MovingBackground
          className={styles.runningBackground}
          mainColor={movingBackgroundMainColor}
          orbColor={movingBackgroundOrbColor}
          testId="chimer-premium-background"
        />
      )}

      {movingBackgroundEnabled && !useOriginalLampBackground && (
        <BackgroundHost
          className={premiumBackgroundClassName}
          style={premiumBackgroundStyle}
          selectedId={backgroundId}
          featureKeys={featureKeys}
          category={backgroundCategory}
          mainColor={movingBackgroundMainColor}
          orbColor={movingBackgroundOrbColor}
          sparkles={{
            maxSize: sparklesMaxSize,
            minSize: sparklesMinSize,
            particleColor: sparklesParticleColor,
            particleDensity: sparklesParticleDensity,
            speed: sparklesSpeed,
          }}
          gradientAnimation={{
            backgroundStartColor: gradientAnimationBackgroundStartColor,
            backgroundEndColor: gradientAnimationBackgroundEndColor,
            firstColor: gradientAnimationFirstColor,
            secondColor: gradientAnimationSecondColor,
            thirdColor: gradientAnimationThirdColor,
            fourthColor: gradientAnimationFourthColor,
            fifthColor: gradientAnimationFifthColor,
            speed: gradientAnimationSpeed,
            size: gradientAnimationSize,
          }}
          animateUiGradient={{
            primaryColor: animateUiGradientPrimaryColor,
            harmony: animateUiGradientHarmony,
            opacity: animateUiGradientOpacity,
          }}
          animateUiStars={{
            starColor: animateUiStarsColor,
            speed: animateUiStarsSpeed,
            density: animateUiStarsDensity,
            factor: animateUiStarsParallax,
          }}
          animateUiHole={{
            strokeColor: animateUiHoleStrokeColor,
            particleColor: animateUiHoleParticleColor,
            numberOfLines: animateUiHoleLineCount,
            numberOfDiscs: animateUiHoleDiscCount,
          }}
          chamaacLightSpeed={{
            warpSpeed: chamaacLightSpeedWarpSpeed,
            particleCount: chamaacLightSpeedParticleCount,
            lightColor: chamaacLightSpeedLightColor,
            intensity: chamaacLightSpeedIntensity,
            radius: chamaacLightSpeedRadius,
            cylinderLength: chamaacLightSpeedCylinderLength,
          }}
          chamaacElectricMist={{
            color: chamaacElectricMistColor,
            speed: chamaacElectricMistSpeed,
            detail: chamaacElectricMistDetail,
            distortion: chamaacElectricMistDistortion,
            brightness: chamaacElectricMistBrightness,
          }}
          chamaacAstralFlow={{
            color1: astralFlowColors[0],
            color2: astralFlowColors[1],
            color3: astralFlowColors[2],
            speed: chamaacAstralFlowSpeed,
            flowMin: chamaacAstralFlowFlowMin,
            flowMax: chamaacAstralFlowFlowMax,
          }}
          chamaacDeepSpaceNebula={{
            color1: deepSpaceNebulaColors[0],
            color2: deepSpaceNebulaColors[1],
            color3: deepSpaceNebulaColors[2],
            speed: chamaacDeepSpaceNebulaSpeed,
          }}
          chamaacGridBloom={{
            color: chamaacGridBloomColor,
            speed: chamaacGridBloomSpeed,
            gridScale: chamaacGridBloomGridScale,
            rotationSpeed: chamaacGridBloomRotationSpeed,
            fadeFalloff: chamaacGridBloomFadeFalloff,
            distortionAmount: chamaacGridBloomDistortionAmount,
            flowSpeedX: chamaacGridBloomFlowSpeedX,
            flowSpeedY: chamaacGridBloomFlowSpeedY,
          }}
          chamaacLiquidChrome={{
            color: liquidChromeColors[0],
            color2: liquidChromeColors[1],
            speed: chamaacLiquidChromeFlowSpeed,
            timeScale: chamaacLiquidChromeTimeScale,
          }}
          chamaacWaves={{
            backgroundColor: wavesColors[0],
            waveColor1: wavesColors[1],
            waveColor2: wavesColors[2],
            waveColor3: wavesColors[3],
            waveSpeedX: chamaacWavesSpeedX,
            waveSpeedY: chamaacWavesSpeedY,
            waveAmpX: chamaacWavesAmplitude,
          }}
          eldoraNovatrix={{
            color: novatrixColor,
            speed: eldoraNovatrixSpeed,
            amplitude: eldoraNovatrixAmplitude,
          }}
          chamaacSynthesis={{
            color1: synthesisColors[0],
            color2: synthesisColors[1],
            color3: synthesisColors[2],
            speed: chamaacSynthesisSpeed,
            complexity: chamaacSynthesisComplexity,
            scale: chamaacSynthesisScale,
            distortion: chamaacSynthesisDistortion,
            glowIntensity: chamaacSynthesisGlowIntensity,
            flowFrequency: chamaacSynthesisFlowFrequency,
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
          onClick={isTimerPrimary ? handlePauseControl : () => handlePrimarySwitch("timer")}
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
        onClick={isCurrentTimePrimary ? (isClockMode ? revealControls : handlePauseControl) : () => handlePrimarySwitch("currentTime")}
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
          className={`${styles.control} ${styles.closeButton}`}
          onClick={onClose}
          aria-label={isClockMode ? "Close clock" : "End timer"}
          data-chimer-control="true"
        >
          <X className="h-5 w-5" />
        </button>

        <button
          className={`${styles.control} ${styles.fullscreenButton}`}
          onClick={handleFullscreenControl}
          aria-label="Toggle fullscreen"
          data-chimer-control="true"
        >
          {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
        </button>

        <button
          ref={settingsButtonRef}
          className={`${styles.control} ${styles.settingsButton}`}
          onClick={handleSettingsButtonClick}
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
            <div className={styles.settingsHeaderBar}>
              <div>
                <div className={styles.settingsHeader}>Chimer Settings</div>
                <div className={styles.settingsSubheader}>
                  {isClockMode ? "Clock display and background" : "Active timer controls and preferences"}
                </div>
              </div>
            </div>

            <Tabs value={settingsTab} onValueChange={handleSettingsTabChange} className={styles.settingsTabs}>
              <TabsList className={styles.settingsTabList}>
                {!isClockMode && (
                  <TabsTrigger value="timer" className={styles.settingsTabTrigger}>Timer</TabsTrigger>
                )}
                <TabsTrigger value="display" className={styles.settingsTabTrigger}>Display</TabsTrigger>
                <TabsTrigger value="background" className={styles.settingsTabTrigger}>Visuals</TabsTrigger>
              </TabsList>

              {!isClockMode && (
                <TabsContent value="timer" className={styles.settingsTabContent}>
                  <label className={styles.switchRow}>
                    <span>Show timer seconds</span>
                    <input
                      type="checkbox"
                      checked={resolvedShowTimerSeconds}
                      onChange={(event) => handleSettingsChange({ showTimerSeconds: event.target.checked })}
                    />
                  </label>

                  {canEditActiveTimer ? (
                    <>
                      <div className={styles.settingsSection}>
                        <div className={styles.settingsSectionHeader}>
                          <span>Remaining time</span>
                          <span className={styles.settingsPill}>Active only</span>
                        </div>
                        <div className={styles.quickAdjustGrid} aria-label="Adjust remaining time">
                          <button type="button" onClick={() => handleActiveRemainingStep(-5)}>-5m</button>
                          <button type="button" onClick={() => handleActiveRemainingStep(-1)}>-1m</button>
                          <button type="button" onClick={() => handleActiveRemainingStep(1)}>+1m</button>
                          <button type="button" onClick={() => handleActiveRemainingStep(5)}>+5m</button>
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
                </TabsContent>
              )}

              <TabsContent value="display" className={styles.settingsTabContent}>
                <label className={styles.switchRow}>
                  <span>Show clock seconds</span>
                  <input
                    type="checkbox"
                    checked={showCurrentTimeSeconds}
                    onChange={(event) => handleSettingsChange({ showCurrentTimeSeconds: event.target.checked })}
                  />
                </label>

                <div className={styles.formatRow}>
                  <span>Time format</span>
                  <div className={styles.formatToggle} aria-label="Time format">
                    <button
                      type="button"
                      className={`${styles.formatOption} ${timeFormat === "12h" ? styles.formatOptionActive : ""}`}
                      aria-pressed={timeFormat === "12h"}
                      onClick={() => handleSettingsChange({ timeFormat: "12h" })}
                    >
                      12h
                    </button>
                    <button
                      type="button"
                      className={`${styles.formatOption} ${timeFormat === "24h" ? styles.formatOptionActive : ""}`}
                      aria-pressed={timeFormat === "24h"}
                      onClick={() => handleSettingsChange({ timeFormat: "24h" })}
                    >
                      24h
                    </button>
                  </div>
                </div>

                {!isClockMode && (
                  <label className={styles.switchRow}>
                    <span>Keep timer screen awake</span>
                    <input
                      type="checkbox"
                      checked={keepTimerScreenAwake}
                      onChange={(event) => handleSettingsChange({ keepTimerScreenAwake: event.target.checked })}
                    />
                  </label>
                )}

              </TabsContent>

              <TabsContent value="background" className={styles.settingsTabContent}>
                <label className={styles.switchRow}>
                  <span>Visual background</span>
                  <input
                    type="checkbox"
                    checked={movingBackgroundEnabled}
                    onChange={(event) => handleSettingsChange({ movingBackgroundEnabled: event.target.checked })}
                  />
                </label>

                {movingBackgroundEnabled && (
                  <BackgroundSelector
                    compact
                    value={backgroundId}
                    onChange={(nextBackgroundId) => handleSettingsChange({ backgroundId: nextBackgroundId })}
                    featureKeys={featureKeys}
                    category={isClockMode ? "clock" : "chimer"}
                    description="Premium visual candidates are paused while we review and add them one at a time."
                    renderSelectedControls={renderBackgroundControls}
                  />
                )}
              </TabsContent>
            </Tabs>
          </div>
        )}

        <div className={styles.bottomControls}>
          <div className={styles.bottomButtonRow}>
            <button className={`${styles.fontButton} ${styles.decreaseFontButton}`} onClick={() => handleFontSizeChange("decrease")} disabled={!canDecreaseFontSize} aria-label="Decrease timer size" data-chimer-control="true">
              <Minus className="h-5 w-5" />
            </button>
            {!isComplete && !isClockMode && (
              <button className={`${styles.control} ${styles.pauseButton}`} onClick={handlePauseControl} aria-label={isPaused ? "Resume timer" : "Pause timer"} data-chimer-control="true">
                {isPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
              </button>
            )}
            <button className={`${styles.fontButton} ${styles.increaseFontButton}`} onClick={() => handleFontSizeChange("increase")} disabled={!canIncreaseFontSize} aria-label="Increase timer size" data-chimer-control="true">
              <Plus className="h-5 w-5" />
            </button>
          </div>
          {!isClockMode && <div className={styles.status}>{statusText}</div>}
        </div>
      </div>
    </section>
  )
}
