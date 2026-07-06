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
  BackgroundEffectProps,
} from "@/components/backgrounds/effects/css-backgrounds"
import styles from "@/components/backgrounds/BackgroundHost.module.css"

const EMPTY_FEATURE_KEYS: string[] = []

interface BackgroundHostProps extends BackgroundEffectProps {
  selectedId?: BackgroundId | string | null
  featureKeys?: string[]
  category?: BackgroundCategory
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
  featureKeys = EMPTY_FEATURE_KEYS,
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
  reactBitsFerrofluid,
  reactBitsLightfall,
  reactBitsLiquidEther,
  reactBitsPrism,
  reactBitsDarkVeil,
  reactBitsLightPillar,
  reactBitsSilk,
  reactBitsFloatingLines,
  reactBitsSideRays,
  reactBitsLightRays,
  reactBitsPixelBlast,
  reactBitsColorBends,
  reactBitsEvilEye,
  reactBitsLineWaves,
  reactBitsRadar,
  reactBitsSoftAurora,
  reactBitsPlasma,
  reactBitsPlasmaWave,
  reactBitsParticles,
  reactBitsGradientBlinds,
  reactBitsGrainient,
  reactBitsGridScan,
  reactBitsBeams,
  reactBitsPixelSnow,
  reactBitsLightning,
  reactBitsPrismaticBurst,
  reactBitsGalaxy,
  reactBitsDither,
  reactBitsFaultyTerminal,
  reactBitsRippleGrid,
  reactBitsDotField,
  reactBitsDotGrid,
  reactBitsThreads,
  reactBitsIridescence,
  reactBitsWaves,
  reactBitsGridDistortion,
  reactBitsOrb,
  reactBitsLetterGlitch,
  reactBitsGridMotion,
  reactBitsShapeGrid,
  reactBitsLiquidChrome,
  reactBitsBalatro,
  eldoraNovatrix,
  eldoraHacker,
  eldoraPhotonBeam,
  aceternity3DGlobe,
  magicRetroGrid,
  magicLightRays,
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

    entry.component()
      .then((module) => {
        if (mounted) {
          setBackgroundComponent(() => module.default)
        }
      })
      .catch(() => {
        if (mounted) {
          setBackgroundComponent(null)
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
          reactBitsFerrofluid={reactBitsFerrofluid}
          reactBitsLightfall={reactBitsLightfall}
          reactBitsLiquidEther={reactBitsLiquidEther}
          reactBitsPrism={reactBitsPrism}
          reactBitsDarkVeil={reactBitsDarkVeil}
          reactBitsLightPillar={reactBitsLightPillar}
          reactBitsSilk={reactBitsSilk}
          reactBitsFloatingLines={reactBitsFloatingLines}
          reactBitsSideRays={reactBitsSideRays}
          reactBitsLightRays={reactBitsLightRays}
          reactBitsPixelBlast={reactBitsPixelBlast}
          reactBitsColorBends={reactBitsColorBends}
          reactBitsEvilEye={reactBitsEvilEye}
          reactBitsLineWaves={reactBitsLineWaves}
          reactBitsRadar={reactBitsRadar}
          reactBitsSoftAurora={reactBitsSoftAurora}
          reactBitsPlasma={reactBitsPlasma}
          reactBitsPlasmaWave={reactBitsPlasmaWave}
          reactBitsParticles={reactBitsParticles}
          reactBitsGradientBlinds={reactBitsGradientBlinds}
          reactBitsGrainient={reactBitsGrainient}
          reactBitsGridScan={reactBitsGridScan}
          reactBitsBeams={reactBitsBeams}
          reactBitsPixelSnow={reactBitsPixelSnow}
          reactBitsLightning={reactBitsLightning}
          reactBitsPrismaticBurst={reactBitsPrismaticBurst}
          reactBitsGalaxy={reactBitsGalaxy}
          reactBitsDither={reactBitsDither}
          reactBitsFaultyTerminal={reactBitsFaultyTerminal}
          reactBitsRippleGrid={reactBitsRippleGrid}
          reactBitsDotField={reactBitsDotField}
          reactBitsDotGrid={reactBitsDotGrid}
          reactBitsThreads={reactBitsThreads}
          reactBitsIridescence={reactBitsIridescence}
          reactBitsWaves={reactBitsWaves}
          reactBitsGridDistortion={reactBitsGridDistortion}
          reactBitsOrb={reactBitsOrb}
          reactBitsLetterGlitch={reactBitsLetterGlitch}
          reactBitsGridMotion={reactBitsGridMotion}
          reactBitsShapeGrid={reactBitsShapeGrid}
          reactBitsLiquidChrome={reactBitsLiquidChrome}
          reactBitsBalatro={reactBitsBalatro}
          eldoraNovatrix={eldoraNovatrix}
          eldoraHacker={eldoraHacker}
          eldoraPhotonBeam={eldoraPhotonBeam}
          aceternity3DGlobe={aceternity3DGlobe}
          magicRetroGrid={magicRetroGrid}
          magicLightRays={magicLightRays}
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
