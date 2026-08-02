"use client"

import type { ComponentType, CSSProperties } from "react"
import { useEffect, useMemo, useState } from "react"
import { useSettings } from "@/components/providers/settings-provider"
import { cn } from "@/lib/utils"
import {
  resolveAccessibleBackgroundDefinition,
  type BackgroundAccessSnapshot,
  type BackgroundCategory,
  type BackgroundId,
  userCanUseBackground,
} from "@/components/backgrounds/backgroundRegistry"
import { backgroundPaletteRegistry } from "@/components/backgrounds/backgroundPaletteRegistry"
import {
  BACKGROUND_COMPACT_VIEWPORT_QUERY,
  useMediaQuery,
} from "@/components/backgrounds/use-media-query"
import {
  createBackgroundHostDiagnosticSnapshot,
  type BackgroundHostLoadStatus,
} from "@/components/backgrounds/backgroundHostDiagnostics"
import type {
  BackgroundEffectProps,
} from "@/components/backgrounds/effects/css-backgrounds"
import { resolveBackgroundEffectProps, resolveBackgroundFallbackStyle } from "@/components/backgrounds/resolveBackgroundEffectProps"
import { useAmbientReducedMotion } from "@/components/backgrounds/use-ambient-reduced-motion"
import { canCustomizeBackgroundColors } from "@/lib/background-palette"
import styles from "@/components/backgrounds/BackgroundHost.module.css"

interface BackgroundHostProps extends BackgroundEffectProps {
  selectedId?: BackgroundId | string | null
  access: BackgroundAccessSnapshot
  category?: BackgroundCategory
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
  /** Records guarded review intent without bypassing pause or reduced motion. */
  forceEffectMount?: boolean
  /**
   * Development-only review aid that bypasses ambient reduced-motion settings
   * while preserving an explicit `motionEnabled={false}` pause. Production
   * builds always ignore this override.
   */
  forceAmbientMotionForReview?: boolean
  testId?: string
  /** Exposes actual lazy-load and post-adapter props on data attributes for guarded QA surfaces. */
  diagnostics?: boolean
}

/** Reports compact rendering when either viewport dimension is at most 479px. */
function useCompactBackgroundViewport() {
  return useMediaQuery(BACKGROUND_COMPACT_VIEWPORT_QUERY)
}

export function BackgroundHost(props: BackgroundHostProps) {
  const {
    selectedId,
    access,
    category,
    backgroundPalette,
    className,
    style,
    motionEnabled = true,
    forceEffectMount = false,
    forceAmbientMotionForReview = false,
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
    massageLabDna,
    massageLabTwistedCubes,
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
  const ambientReducedMotion = useAmbientReducedMotion(settings.ambientMotionMode)
  const compactViewport = useCompactBackgroundViewport()
  const entry = useMemo(
    () => resolveAccessibleBackgroundDefinition(selectedId, access, category),
    [access, category, selectedId],
  )
  const canCustomize = canCustomizeBackgroundColors({
    hasBackgroundAccess: userCanUseBackground(entry, access),
  })
  // An explicit pause uses the same resolved renderer contract as ambient
  // reduced motion. Static-capable effects still mount, but pause internally.
  const allowAmbientMotionForReview = process.env.NODE_ENV !== "production"
    && forceAmbientMotionForReview
  const reduceMotion = !motionEnabled || (!allowAmbientMotionForReview && ambientReducedMotion)
  const [loadedEffect, setLoadedEffect] = useState<{
    id: string
    component: ComponentType<BackgroundEffectProps>
  } | null>(null)
  const [loadStatus, setLoadStatus] = useState<BackgroundHostLoadStatus>("idle")
  const [loadError, setLoadError] = useState<string | null>(null)
  const shouldLoadEffect = Boolean(
    entry.component &&
      (!reduceMotion || entry.motionIntensity === "static" || entry.supportsReducedMotionStatic),
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
    massageLabDna,
    massageLabTwistedCubes,
    reduceMotion,
    compactViewport,
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
      // A missing saved palette is Source mode, not an instruction to bypass
      // renderer-owned Source overrides such as Ripple Grid's rainbow switch.
      effectProps: resolveBackgroundEffectProps({
        selectedId: entry.id,
        effectProps: baseEffectProps,
        palette: backgroundPalette?.palette,
        mapping: backgroundPalette?.mapping,
        canCustomize,
      }),
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
    massageLabDna,
    massageLabTwistedCubes,
    reduceMotion,
    compactViewport,
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
  const fallbackRemountKey = useMemo(
    // The full resolved style signature is intentional: legacy fallbacks mix
    // shorthand and longhands, so palette edits must not retain stale families.
    () => `${entry.id}:${backgroundPalette?.palette.mode ?? "source"}:${canCustomize}:${JSON.stringify(fallbackStyle ?? null)}`,
    [backgroundPalette?.palette.mode, canCustomize, entry.id, fallbackStyle],
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
      data-background-review-mount-requested={diagnostics && forceEffectMount ? "true" : undefined}
      data-background-review-motion-forced={diagnostics && allowAmbientMotionForReview && ambientReducedMotion && motionEnabled ? "true" : undefined}
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
        // Registry fallbacks mix legacy background shorthand and longhands.
        // Remounting this decorative layer prevents React from reconciling
        // conflicting style families when the complete resolved style changes.
        key={fallbackRemountKey}
        className={cn(styles.fallback, entry.fallbackClassName)}
        style={fallbackStyle}
      />
      {BackgroundComponent ? (
        <BackgroundComponent {...effectProps} />
      ) : null}
    </div>
  )
}
