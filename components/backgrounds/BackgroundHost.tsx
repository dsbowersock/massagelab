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
  massageLabGradient,
  massageLabHole,
  massageLabStars,
  massageLabLightSpeed,
  massageLabElectricMist,
  massageLabAstralFlow,
  massageLabDeepSpaceNebula,
  massageLabGridBloom,
  massageLabChromeFlow,
  massageLabWaveCurrent,
  massageLabSynthesis,
  massageLabFerrofluid,
  massageLabLightfall,
  massageLabLiquidEther,
  massageLabPrism,
  massageLabDarkVeil,
  massageLabLightPillar,
  massageLabSilk,
  massageLabFloatingLines,
  massageLabSideRays,
  massageLabLightRays,
  massageLabPixelBlast,
  massageLabColorBends,
  massageLabEvilEye,
  massageLabLineWaves,
  massageLabRadar,
  massageLabSoftAurora,
  massageLabPlasma,
  massageLabPlasmaWave,
  massageLabParticles,
  massageLabGradientBlinds,
  massageLabGrainient,
  massageLabGridScan,
  massageLabBeams,
  massageLabPixelSnow,
  massageLabLightning,
  massageLabPrismaticBurst,
  massageLabGalaxy,
  massageLabDither,
  massageLabFaultyTerminal,
  massageLabRippleGrid,
  massageLabDotField,
  massageLabDotGrid,
  massageLabThreads,
  massageLabIridescence,
  massageLabWaves,
  massageLabGridDistortion,
  massageLabOrb,
  massageLabLetterGlitch,
  massageLabGridMotion,
  massageLabShapeGrid,
  massageLabLiquidChrome,
  massageLabBalatro,
  massageLabNovatrix,
  massageLabMatrixRain,
  massageLabPhotonBeam,
  massageLab3DGlobe,
  massageLabRetroGrid,
  massageLabAerialRays,
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
          massageLabGradient={massageLabGradient}
          massageLabHole={massageLabHole}
          massageLabStars={massageLabStars}
          massageLabLightSpeed={massageLabLightSpeed}
          massageLabElectricMist={massageLabElectricMist}
          massageLabAstralFlow={massageLabAstralFlow}
          massageLabDeepSpaceNebula={massageLabDeepSpaceNebula}
          massageLabGridBloom={massageLabGridBloom}
          massageLabChromeFlow={massageLabChromeFlow}
          massageLabWaveCurrent={massageLabWaveCurrent}
          massageLabSynthesis={massageLabSynthesis}
          massageLabFerrofluid={massageLabFerrofluid}
          massageLabLightfall={massageLabLightfall}
          massageLabLiquidEther={massageLabLiquidEther}
          massageLabPrism={massageLabPrism}
          massageLabDarkVeil={massageLabDarkVeil}
          massageLabLightPillar={massageLabLightPillar}
          massageLabSilk={massageLabSilk}
          massageLabFloatingLines={massageLabFloatingLines}
          massageLabSideRays={massageLabSideRays}
          massageLabLightRays={massageLabLightRays}
          massageLabPixelBlast={massageLabPixelBlast}
          massageLabColorBends={massageLabColorBends}
          massageLabEvilEye={massageLabEvilEye}
          massageLabLineWaves={massageLabLineWaves}
          massageLabRadar={massageLabRadar}
          massageLabSoftAurora={massageLabSoftAurora}
          massageLabPlasma={massageLabPlasma}
          massageLabPlasmaWave={massageLabPlasmaWave}
          massageLabParticles={massageLabParticles}
          massageLabGradientBlinds={massageLabGradientBlinds}
          massageLabGrainient={massageLabGrainient}
          massageLabGridScan={massageLabGridScan}
          massageLabBeams={massageLabBeams}
          massageLabPixelSnow={massageLabPixelSnow}
          massageLabLightning={massageLabLightning}
          massageLabPrismaticBurst={massageLabPrismaticBurst}
          massageLabGalaxy={massageLabGalaxy}
          massageLabDither={massageLabDither}
          massageLabFaultyTerminal={massageLabFaultyTerminal}
          massageLabRippleGrid={massageLabRippleGrid}
          massageLabDotField={massageLabDotField}
          massageLabDotGrid={massageLabDotGrid}
          massageLabThreads={massageLabThreads}
          massageLabIridescence={massageLabIridescence}
          massageLabWaves={massageLabWaves}
          massageLabGridDistortion={massageLabGridDistortion}
          massageLabOrb={massageLabOrb}
          massageLabLetterGlitch={massageLabLetterGlitch}
          massageLabGridMotion={massageLabGridMotion}
          massageLabShapeGrid={massageLabShapeGrid}
          massageLabLiquidChrome={massageLabLiquidChrome}
          massageLabBalatro={massageLabBalatro}
          massageLabNovatrix={massageLabNovatrix}
          massageLabMatrixRain={massageLabMatrixRain}
          massageLabPhotonBeam={massageLabPhotonBeam}
          massageLab3DGlobe={massageLab3DGlobe}
          massageLabRetroGrid={massageLabRetroGrid}
          massageLabAerialRays={massageLabAerialRays}
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
