"use client"

import type { ComponentType, CSSProperties } from "react"
import { useEffect, useMemo, useState } from "react"
import { useSettings } from "@/components/providers/settings-provider"
import { shouldReduceAmbientMotion } from "@/lib/motion-preferences"
import { cn } from "@/lib/utils"
import {
  resolveAccessibleBackgroundDefinition,
  type BackgroundCategory,
  type BackgroundId,
} from "@/components/backgrounds/backgroundRegistry"
import type {
  AnimateUiGradientOptions,
  AnimateUiHoleOptions,
  AnimateUiStarsOptions,
  BackgroundLinesOptions,
  CanvasRevealDotsOptions,
  BackgroundEffectProps,
  ChamaacLightSpeedOptions,
  ChamaacElectricMistOptions,
  ChamaacAstralFlowOptions,
  ChamaacDeepSpaceNebulaOptions,
  ChamaacGridBloomOptions,
  ChamaacLiquidChromeOptions,
  ChamaacWavesOptions,
  ChamaacSynthesisOptions,
  EldoraHackerOptions,
  EldoraNovatrixOptions,
  EldoraPhotonBeamOptions,
  GradientAnimationOptions,
  HexGridOptions,
  LampSectionOptions,
  MagicRetroGridOptions,
  PixelLiquidOptions,
  SparklesBackgroundOptions,
  SpotlightNewOptions,
  ShootingStarsBackgroundOptions,
  VortexBackgroundOptions,
  AuroraBarsOptions,
  TileGridOptions,
  WavyBackgroundOptions,
} from "@/components/backgrounds/effects/css-backgrounds"
import styles from "@/components/backgrounds/BackgroundHost.module.css"

interface BackgroundHostProps {
  selectedId?: BackgroundId | string | null
  featureKeys?: string[]
  category?: BackgroundCategory
  className?: string
  mainColor?: string
  orbColor?: string
  sparkles?: SparklesBackgroundOptions
  gradientAnimation?: GradientAnimationOptions
  animateUiGradient?: AnimateUiGradientOptions
  animateUiHole?: AnimateUiHoleOptions
  animateUiStars?: AnimateUiStarsOptions
  chamaacLightSpeed?: ChamaacLightSpeedOptions
  chamaacElectricMist?: ChamaacElectricMistOptions
  chamaacAstralFlow?: ChamaacAstralFlowOptions
  chamaacDeepSpaceNebula?: ChamaacDeepSpaceNebulaOptions
  chamaacGridBloom?: ChamaacGridBloomOptions
  chamaacLiquidChrome?: ChamaacLiquidChromeOptions
  chamaacWaves?: ChamaacWavesOptions
  chamaacSynthesis?: ChamaacSynthesisOptions
  eldoraNovatrix?: EldoraNovatrixOptions
  eldoraHacker?: EldoraHackerOptions
  eldoraPhotonBeam?: EldoraPhotonBeamOptions
  magicRetroGrid?: MagicRetroGridOptions
  backgroundLines?: BackgroundLinesOptions
  shootingStars?: ShootingStarsBackgroundOptions
  canvasRevealDots?: CanvasRevealDotsOptions
  spotlight?: SpotlightNewOptions
  lamp?: LampSectionOptions
  vortex?: VortexBackgroundOptions
  wavy?: WavyBackgroundOptions
  pixelLiquid?: PixelLiquidOptions
  tileGrid?: TileGridOptions
  hexGrid?: HexGridOptions
  auroraBars?: AuroraBarsOptions
  style?: CSSProperties
  testId?: string
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    const handleChange = () => setPrefersReducedMotion(query.matches)

    handleChange()
    query.addEventListener("change", handleChange)
    return () => query.removeEventListener("change", handleChange)
  }, [])

  return prefersReducedMotion
}

export function BackgroundHost({
  selectedId,
  featureKeys = [],
  category,
  className,
  mainColor,
  orbColor,
  sparkles,
  gradientAnimation,
  animateUiGradient,
  animateUiHole,
  animateUiStars,
  chamaacLightSpeed,
  chamaacElectricMist,
  chamaacAstralFlow,
  chamaacDeepSpaceNebula,
  chamaacGridBloom,
  chamaacLiquidChrome,
  chamaacWaves,
  chamaacSynthesis,
  eldoraNovatrix,
  eldoraHacker,
  eldoraPhotonBeam,
  magicRetroGrid,
  backgroundLines,
  shootingStars,
  canvasRevealDots,
  spotlight,
  lamp,
  vortex,
  wavy,
  pixelLiquid,
  tileGrid,
  hexGrid,
  auroraBars,
  style,
  testId = "background-host",
}: BackgroundHostProps) {
  const { settings } = useSettings()
  const prefersReducedMotion = usePrefersReducedMotion()
  const entry = useMemo(
    () => resolveAccessibleBackgroundDefinition(selectedId, featureKeys, category),
    [category, featureKeys, selectedId],
  )
  const reduceMotion = shouldReduceAmbientMotion({
    prefersReducedMotion,
    ambientMotionMode: settings.ambientMotionMode,
  })
  const [BackgroundComponent, setBackgroundComponent] = useState<ComponentType<BackgroundEffectProps> | null>(null)
  const shouldLoadEffect = Boolean(entry.component && (!reduceMotion || entry.motionIntensity === "static"))

  useEffect(() => {
    let mounted = true

    if (!shouldLoadEffect || !entry.component) {
      setBackgroundComponent(null)
      return () => {
        mounted = false
      }
    }

    entry.component().then((module) => {
      if (mounted) {
        setBackgroundComponent(() => module.default)
      }
    })

    return () => {
      mounted = false
    }
  }, [entry, shouldLoadEffect])

  return (
    <div
      aria-hidden="true"
      className={cn(styles.host, !className && styles.hostDefault, className)}
      data-background-id={entry.id}
      data-background-provider={entry.provider}
      data-testid={testId}
      style={style}
    >
      <div className={cn(styles.fallback, entry.fallbackClassName)} style={entry.fallbackStyle} />
      {BackgroundComponent ? (
        <BackgroundComponent
          mainColor={mainColor}
          orbColor={orbColor}
          sparkles={sparkles}
          gradientAnimation={gradientAnimation}
          animateUiGradient={animateUiGradient}
          animateUiHole={animateUiHole}
          animateUiStars={animateUiStars}
          chamaacLightSpeed={chamaacLightSpeed}
          chamaacElectricMist={chamaacElectricMist}
          chamaacAstralFlow={chamaacAstralFlow}
          chamaacDeepSpaceNebula={chamaacDeepSpaceNebula}
          chamaacGridBloom={chamaacGridBloom}
          chamaacLiquidChrome={chamaacLiquidChrome}
          chamaacWaves={chamaacWaves}
          chamaacSynthesis={chamaacSynthesis}
          eldoraNovatrix={eldoraNovatrix}
          eldoraHacker={eldoraHacker}
          eldoraPhotonBeam={eldoraPhotonBeam}
          magicRetroGrid={magicRetroGrid}
          backgroundLines={backgroundLines}
          shootingStars={shootingStars}
          canvasRevealDots={canvasRevealDots}
          spotlight={spotlight}
          lamp={lamp}
          vortex={vortex}
          wavy={wavy}
          pixelLiquid={pixelLiquid}
          tileGrid={tileGrid}
          hexGrid={hexGrid}
          auroraBars={auroraBars}
        />
      ) : null}
    </div>
  )
}
