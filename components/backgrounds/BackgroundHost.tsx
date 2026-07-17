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
  /** Applies one resolved palette across every color-capable background effect. */
  palette?: readonly string[]
  style?: CSSProperties
  testId?: string
}

const COLOR_OPTION_PATTERN = /(color|gradient|tint)/i
const NON_COLOR_OPTION_PATTERN = /(balance|frequency|number|speed)/i

/**
 * Recolors heterogeneous background option objects without coupling the global
 * picker to every individual effect implementation. Non-color settings retain
 * their route-owned values, while color strings and color arrays consume the
 * resolved palette in declaration order.
 */
export function applyPaletteToBackgroundEffects(
  effectProps: BackgroundEffectProps,
  palette: readonly string[] | undefined,
): BackgroundEffectProps {
  const resolvedPalette = palette?.filter((value) => value.trim().length > 0) ?? []
  if (resolvedPalette.length === 0) {
    return effectProps
  }

  let paletteIndex = 0
  const nextColor = () => {
    const color = resolvedPalette[paletteIndex % resolvedPalette.length]
    paletteIndex += 1
    return color
  }

  const applyPalette = (value: unknown, key: string): unknown => {
    if (Array.isArray(value)) {
      if (!COLOR_OPTION_PATTERN.test(key) || NON_COLOR_OPTION_PATTERN.test(key)) {
        return value
      }
      return value.map((entry) => (typeof entry === "string" ? nextColor() : entry))
    }

    if (typeof value === "string") {
      return COLOR_OPTION_PATTERN.test(key) && !NON_COLOR_OPTION_PATTERN.test(key)
        ? nextColor()
        : value
    }

    if (value && typeof value === "object") {
      return Object.fromEntries(
        Object.entries(value).map(([entryKey, entryValue]) => [
          entryKey,
          applyPalette(entryValue, entryKey),
        ]),
      )
    }

    return value
  }

  return applyPalette(effectProps, "") as BackgroundEffectProps
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
  palette,
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
  const effectProps = useMemo(() => applyPaletteToBackgroundEffects({
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
  }, palette), [
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
    palette,
  ])
  const paletteFallbackStyle = palette?.length
    ? { background: `linear-gradient(135deg, ${palette.join(", ")})` }
    : undefined

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
      <div
        className={cn(styles.fallback, entry.fallbackClassName)}
        style={{ ...entry.fallbackStyle, ...paletteFallbackStyle }}
      />
      {BackgroundComponent ? (
        <BackgroundComponent {...effectProps} />
      ) : null}
    </div>
  )
}
