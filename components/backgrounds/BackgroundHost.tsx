"use client"

import type { ComponentType, CSSProperties } from "react"
import { useEffect, useMemo, useState } from "react"
import { useSettings } from "@/components/providers/settings-provider"
import { shouldReduceAmbientMotion } from "@/lib/motion-preferences"
import { cn } from "@/lib/utils"
import {
  resolveAccessibleBackgroundDefinition,
  type BackgroundAccessSnapshot,
  type BackgroundCategory,
  type BackgroundId,
} from "@/components/backgrounds/backgroundRegistry"
import { backgroundPaletteRegistry } from "@/components/backgrounds/backgroundPaletteRegistry"
import {
  createBackgroundHostDiagnosticSnapshot,
  type BackgroundHostLoadStatus,
} from "@/components/backgrounds/backgroundHostDiagnostics"
import type {
  BackgroundEffectProps,
} from "@/components/backgrounds/effects/css-backgrounds"
import { resolveBackgroundEffectProps, resolveBackgroundFallbackStyle } from "@/components/backgrounds/resolveBackgroundEffectProps"
import { canCustomizeBackgroundColors } from "@/lib/background-palette"
import { FEATURE_KEYS } from "@/lib/membership"
import styles from "@/components/backgrounds/BackgroundHost.module.css"

interface BackgroundHostProps extends BackgroundEffectProps {
  selectedId?: BackgroundId | string | null
  access: BackgroundAccessSnapshot
  category?: BackgroundCategory
  /**
   * Preserves the signed-in account color permission for the original free
   * Lamp without widening palette access for other backgrounds.
   */
  canUseAccountColorControls?: boolean
  /**
   * Supplies the one committed-or-draft palette contract shared by Chimer,
   * Clock, and Music. Unsupported media intentionally ignores this input.
   */
  backgroundPalette?: {
    palette: {
      mode: string
      primaryColor: string
      harmony: string
      swatches: readonly string[]
    }
    mapping: Readonly<Record<string, number>>
  } | null
  style?: CSSProperties
  /** Renders the static representative while avoiding animated effect work. */
  motionEnabled?: boolean
  testId?: string
  /** Exposes actual lazy-load and post-adapter props on data attributes for guarded QA surfaces. */
  diagnostics?: boolean
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

export function BackgroundHost(props: BackgroundHostProps) {
  const {
    selectedId,
    access,
    category,
    canUseAccountColorControls = false,
    backgroundPalette,
    className,
    style,
    motionEnabled = true,
    testId = "background-host",
    diagnostics = false,
    ...effectPropsInput
  } = props
  // Running timer ticks recreate the JSX prop objects. Canonicalizing the
  // complete effect-only input keeps adapter resolution stable until an
  // actual renderer value changes.
  const effectPropsInputSignature = JSON.stringify(effectPropsInput)
  const stableEffectPropsInput = useMemo(
    () => JSON.parse(effectPropsInputSignature) as BackgroundEffectProps,
    [effectPropsInputSignature],
  )
  const {
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
  } = stableEffectPropsInput
  const { settings } = useSettings()
  const prefersReducedMotion = usePrefersReducedMotion()
  const entry = useMemo(
    () => resolveAccessibleBackgroundDefinition(selectedId, access, category),
    [access, category, selectedId],
  )
  const canCustomize = canCustomizeBackgroundColors({
    hasCustomColorFeature: access.featureKeys.includes(FEATURE_KEYS.chimerCustomColors),
    hasAccountColorAccess: canUseAccountColorControls,
    selectedBackgroundId: entry.id,
    permanentlyOwnedBackgroundIds: access.ownedBackgroundIds,
  })
  const reduceMotion = shouldReduceAmbientMotion({
    prefersReducedMotion,
    ambientMotionMode: settings.ambientMotionMode,
  })
  const [loadedEffect, setLoadedEffect] = useState<{
    id: string
    component: ComponentType<BackgroundEffectProps>
  } | null>(null)
  const [loadStatus, setLoadStatus] = useState<BackgroundHostLoadStatus>("idle")
  const [loadError, setLoadError] = useState<string | null>(null)
  const shouldLoadEffect = Boolean(
    entry.component
    && (entry.motionIntensity === "static" || (motionEnabled && !reduceMotion)),
  )
  const { baseEffectProps, effectProps } = useMemo(() => {
    const baseEffectProps = {
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
    }
    return {
      baseEffectProps,
      effectProps: backgroundPalette
        ? resolveBackgroundEffectProps({
            selectedId: entry.id,
            effectProps: baseEffectProps,
            palette: backgroundPalette.palette,
            mapping: backgroundPalette.mapping,
            canCustomize,
          })
        : baseEffectProps,
    }
  }, [
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
    backgroundPalette,
    canCustomize,
    entry.id,
  ])

  useEffect(() => {
    let mounted = true
    setLoadedEffect(null)
    setLoadError(null)

    if (!shouldLoadEffect || !entry.component) {
      setLoadStatus("idle")
      return () => {
        mounted = false
      }
    }

    setLoadStatus("loading")
    entry.component()
      .then((module) => {
        if (mounted) {
          setLoadedEffect({
            id: entry.id,
            component: module.default,
          })
          setLoadStatus("loaded")
        }
      })
      .catch((error: unknown) => {
        if (mounted) {
          setLoadedEffect(null)
          setLoadStatus("error")
          setLoadError(error instanceof Error ? error.message : "Background renderer failed to load.")
        }
      })

    return () => {
      mounted = false
    }
  }, [entry, shouldLoadEffect])

  const BackgroundComponent = loadedEffect?.id === entry.id
    ? loadedEffect.component
    : null
  const adapter = backgroundPaletteRegistry[entry.id]
  const fallbackStyle = useMemo(
    () => (backgroundPalette
      ? resolveBackgroundFallbackStyle({
          selectedId: entry.id,
          fallbackStyle: entry.fallbackStyle,
          palette: backgroundPalette.palette,
          mapping: backgroundPalette.mapping,
          canCustomize,
        })
      : entry.fallbackStyle),
    [backgroundPalette, canCustomize, entry.fallbackStyle, entry.id],
  )
  const diagnosticSnapshot = diagnostics && adapter
    ? createBackgroundHostDiagnosticSnapshot({
        requestedId: entry.id,
        loadedId: loadedEffect?.id ?? null,
        loadStatus,
        adapter,
        baseEffectProps,
        appliedEffectProps: effectProps,
        reducedMotion: reduceMotion,
        error: loadError,
      })
    : null

  return (
    <div
      aria-hidden="true"
      className={cn(styles.host, !className && styles.hostDefault, className)}
      data-background-id={entry.id}
      data-background-effect-mounted={BackgroundComponent ? "true" : "false"}
      data-background-fallback-only={
        shouldLoadEffect && !BackgroundComponent ? "true" : "false"
      }
      data-background-motion={motionEnabled ? "playing" : "paused"}
      data-background-provider={entry.provider}
      data-background-diagnostic-requested-id={diagnosticSnapshot?.requestedId}
      data-background-diagnostic-loaded-id={diagnosticSnapshot?.loadedId ?? undefined}
      data-background-diagnostic-status={diagnosticSnapshot?.status}
      data-background-diagnostic-family={diagnosticSnapshot?.rendererFamily}
      data-background-diagnostic-targets={
        diagnosticSnapshot
          ? JSON.stringify(diagnosticSnapshot.resolvedRendererTargets)
          : undefined
      }
      data-background-diagnostic-application-changed={
        diagnosticSnapshot ? String(diagnosticSnapshot.applicationChanged) : undefined
      }
      data-background-diagnostic-applied={
        diagnosticSnapshot
          ? String(Boolean(backgroundPalette && adapter?.status === "supported"))
          : undefined
      }
      data-background-diagnostic-fallback={
        diagnosticSnapshot ? String(diagnosticSnapshot.fallback) : undefined
      }
      data-background-diagnostic-error={diagnosticSnapshot?.error ?? undefined}
      data-background-diagnostic-reduced-motion={
        diagnosticSnapshot ? String(diagnosticSnapshot.reducedMotion) : undefined
      }
      data-testid={testId}
      style={style}
    >
      <div
        className={cn(styles.fallback, entry.fallbackClassName)}
        style={fallbackStyle}
      />
      {BackgroundComponent ? (
        <BackgroundComponent {...effectProps} />
      ) : null}
    </div>
  )
}
