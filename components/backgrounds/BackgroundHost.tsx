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
import { backgroundPaletteRegistry } from "@/components/backgrounds/backgroundPaletteRegistry"
import {
  createBackgroundHostDiagnosticSnapshot,
  type BackgroundHostLoadStatus,
} from "@/components/backgrounds/backgroundHostDiagnostics"
import type {
  BackgroundEffectProps,
} from "@/components/backgrounds/effects/css-backgrounds"
import {
  resolveBackgroundRoleColors,
  resolveEffectiveBackgroundPaletteMode,
} from "@/lib/background-palette"
import styles from "@/components/backgrounds/BackgroundHost.module.css"

const EMPTY_FEATURE_KEYS: string[] = []

interface BackgroundHostProps extends BackgroundEffectProps {
  selectedId?: BackgroundId | string | null
  featureKeys?: string[]
  category?: BackgroundCategory
  /** Applies one resolved palette across every color-capable background effect. */
  palette?: readonly string[]
  /** Applies registry colors only while the Visual editor owns a live draft. */
  draftPalettePreview?: {
    palette: {
      mode: string
      primaryColor: string
      harmony: string
      swatches: readonly string[]
    }
    mapping: Readonly<Record<string, number>>
    canCustomize: boolean
  } | null
  style?: CSSProperties
  /** Renders the static representative while avoiding animated effect work. */
  motionEnabled?: boolean
  testId?: string
  /** Exposes actual lazy-load and post-adapter props on data attributes for guarded QA surfaces. */
  diagnostics?: boolean
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
  draftPalettePreview,
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
  motionEnabled = true,
  testId = "background-host",
  diagnostics = false,
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
  const [loadedEffect, setLoadedEffect] = useState<{
    id: string
    component: ComponentType<BackgroundEffectProps>
  } | null>(null)
  const [loadStatus, setLoadStatus] = useState<BackgroundHostLoadStatus>("loading")
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
    const adapter = backgroundPaletteRegistry[entry.id]
    if (draftPalettePreview && adapter?.status === "supported") {
      const effectiveMode = resolveEffectiveBackgroundPaletteMode({
        savedMode: draftPalettePreview.palette.mode,
        canCustomize: draftPalettePreview.canCustomize,
      })
      const colors = resolveBackgroundRoleColors({
        palette: draftPalettePreview.palette,
        adapter,
        mapping: draftPalettePreview.mapping,
        canCustomize: draftPalettePreview.canCustomize,
      })
      return {
        baseEffectProps,
        effectProps: adapter.applyRoleColors(baseEffectProps, colors, effectiveMode),
      }
    }
    return {
      baseEffectProps,
      effectProps: applyPaletteToBackgroundEffects(baseEffectProps, palette),
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
    draftPalettePreview,
    entry.id,
    palette,
  ])
  const paletteFallbackStyle = palette?.length
    ? { background: `linear-gradient(135deg, ${palette.join(", ")})` }
    : undefined

  useEffect(() => {
    let mounted = true
    setLoadedEffect(null)
    setLoadError(null)
    setLoadStatus("loading")

    if (!shouldLoadEffect || !entry.component) {
      return () => {
        mounted = false
      }
    }

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
          ? String(Boolean(draftPalettePreview && adapter?.status === "supported"))
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
        style={{ ...entry.fallbackStyle, ...paletteFallbackStyle }}
      />
      {BackgroundComponent ? (
        <BackgroundComponent {...effectProps} />
      ) : null}
    </div>
  )
}
