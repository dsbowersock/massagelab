"use client"

import * as React from "react"
import { MetalFx, type MetalFxPreset, type MetalFxTheme, type MetalFxVariant } from "metal-fx"

import { Button, type ButtonProps } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type MetalAttentionMode = "cycle" | "pulse" | "always" | "off"
type MetalAttentionMotionState = "playing" | "settling" | "paused" | "off"

interface MetalAttentionOptions {
  /** `cycle` keeps the ring visible while randomly alternating moving and paused states; `pulse` is a backwards-compatible alias. */
  metalMode?: MetalAttentionMode
  /** Deprecated pulse-era fallback; use `metalPauseMinDurationMs`/`metalPauseMaxDurationMs`. */
  metalPulseIntervalMs?: number
  /** Deprecated pulse-era fallback; use `metalPauseMinDurationMs`. */
  metalPulseMinIntervalMs?: number
  /** Deprecated pulse-era fallback; use `metalPauseMaxDurationMs`. */
  metalPulseMaxIntervalMs?: number
  /** Deprecated pulse-era fallback; use `metalPlayMinDurationMs`/`metalPlayMaxDurationMs`. */
  metalPulseDurationMs?: number
  /** Deprecated pulse-era fallback; use `metalSettleDurationMs`. */
  metalFadeOutDurationMs?: number
  /** Minimum milliseconds the ring animation plays before it starts settling. */
  metalPlayMinDurationMs?: number
  /** Maximum milliseconds the ring animation plays before it starts settling. */
  metalPlayMaxDurationMs?: number
  /** Minimum milliseconds the visible ring stays paused before motion resumes. */
  metalPauseMinDurationMs?: number
  /** Maximum milliseconds the visible ring stays paused before motion resumes. */
  metalPauseMaxDurationMs?: number
  /** Milliseconds used to visually settle the ring before freezing the animation. */
  metalSettleDurationMs?: number
  /** Visual strength of the visible paused ring; keeps the ring present without reading as active motion. */
  metalPausedStrength?: number
  /** MetalFx preset from the upstream package. */
  metalPreset?: MetalFxPreset
  /** MetalFx theme; defaults to the app's resolved light/dark class instead of the OS setting. */
  metalTheme?: MetalFxTheme
  /** MetalFx ring geometry. */
  metalVariant?: MetalFxVariant
  /** Effect opacity and glow strength. */
  metalStrength?: number
  metalRingCssPx?: number
  metalScale?: number
  metalShaderScale?: number
  metalFullWidth?: boolean
  disableMetalGlow?: boolean
}

export interface MetalAttentionRingProps extends MetalAttentionOptions {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

export interface MetalAttentionButtonProps extends ButtonProps, MetalAttentionOptions {
  metalFxClassName?: string
  metalFxStyle?: React.CSSProperties
}

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false)

  React.useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    const updatePreference = () => setPrefersReducedMotion(query.matches)

    updatePreference()
    query.addEventListener("change", updatePreference)

    return () => query.removeEventListener("change", updatePreference)
  }, [])

  return prefersReducedMotion
}

function useResolvedAppMetalTheme(explicitTheme: MetalFxTheme | undefined) {
  const [resolvedTheme, setResolvedTheme] = React.useState<Exclude<MetalFxTheme, "auto">>("dark")

  React.useEffect(() => {
    if (explicitTheme) {
      return
    }

    const root = document.documentElement
    const syncTheme = () => setResolvedTheme(root.classList.contains("dark") ? "dark" : "light")
    const observer = new MutationObserver(syncTheme)

    syncTheme()
    observer.observe(root, { attributes: true, attributeFilter: ["class"] })

    return () => observer.disconnect()
  }, [explicitTheme])

  return explicitTheme ?? resolvedTheme
}

function randomDurationMs(minMs: number, maxMs: number) {
  return Math.round(minMs + Math.random() * (maxMs - minMs))
}

function useMetalAttentionMotionState({
  mode,
  pauseMaxDurationMs,
  pauseMinDurationMs,
  playMaxDurationMs,
  playMinDurationMs,
  reducedMotion,
  settleDurationMs,
}: {
  mode: MetalAttentionMode
  pauseMaxDurationMs: number
  pauseMinDurationMs: number
  playMaxDurationMs: number
  playMinDurationMs: number
  reducedMotion: boolean
  settleDurationMs: number
}) {
  const [motionState, setMotionState] = React.useState<MetalAttentionMotionState>("playing")

  React.useEffect(() => {
    if (mode === "off") {
      setMotionState("off")
      return
    }

    if (reducedMotion) {
      setMotionState("paused")
      return
    }

    if (mode === "always") {
      setMotionState("playing")
      return
    }

    const safePlayMinMs = Math.max(500, playMinDurationMs)
    const safePlayMaxMs = Math.max(safePlayMinMs, playMaxDurationMs)
    const safePauseMinMs = Math.max(500, pauseMinDurationMs)
    const safePauseMaxMs = Math.max(safePauseMinMs, pauseMaxDurationMs)
    const safeSettleMs = Math.max(0, settleDurationMs)
    let timer: number | undefined

    const startPlaying = () => {
      setMotionState("playing")
      timer = window.setTimeout(startSettling, randomDurationMs(safePlayMinMs, safePlayMaxMs))
    }

    const startSettling = () => {
      setMotionState("settling")
      timer = window.setTimeout(startPaused, safeSettleMs)
    }

    const startPaused = () => {
      setMotionState("paused")
      timer = window.setTimeout(startPlaying, randomDurationMs(safePauseMinMs, safePauseMaxMs))
    }

    startPlaying()

    return () => {
      window.clearTimeout(timer)
    }
  }, [
    mode,
    pauseMaxDurationMs,
    pauseMinDurationMs,
    playMaxDurationMs,
    playMinDurationMs,
    reducedMotion,
    settleDurationMs,
  ])

  return motionState
}

/**
 * Reusable strategic attention ring for any already-rendered CTA/control.
 * The ring stays visible while its motion randomly plays, settles, and pauses.
 */
export function MetalAttentionRing({
  children,
  className,
  metalFadeOutDurationMs,
  metalMode = "cycle",
  metalPulseDurationMs,
  metalPulseIntervalMs,
  metalPulseMinIntervalMs,
  metalPulseMaxIntervalMs,
  metalPlayMinDurationMs,
  metalPlayMaxDurationMs,
  metalPauseMinDurationMs,
  metalPauseMaxDurationMs,
  metalSettleDurationMs,
  metalPausedStrength = 0.72,
  metalPreset = "chromatic",
  metalTheme,
  metalVariant = "button",
  metalStrength = 1,
  metalRingCssPx = 1,
  metalScale,
  metalShaderScale = 1.35,
  metalFullWidth = false,
  disableMetalGlow = false,
  style,
}: MetalAttentionRingProps) {
  const reducedMotion = usePrefersReducedMotion()
  const suppressMetalMotion = reducedMotion && metalMode !== "always"
  const resolvedSettleDurationMs = metalSettleDurationMs ?? metalFadeOutDurationMs ?? 1800
  const resolvedTheme = useResolvedAppMetalTheme(metalTheme)
  const motionState = useMetalAttentionMotionState({
    mode: metalMode,
    pauseMaxDurationMs: metalPauseMaxDurationMs ?? metalPulseMaxIntervalMs ?? 20000,
    pauseMinDurationMs: metalPauseMinDurationMs ?? metalPulseMinIntervalMs ?? metalPulseIntervalMs ?? 5000,
    playMaxDurationMs: metalPlayMaxDurationMs ?? metalPulseDurationMs ?? 20000,
    playMinDurationMs: metalPlayMinDurationMs ?? metalPulseDurationMs ?? 4000,
    reducedMotion: suppressMetalMotion,
    settleDurationMs: resolvedSettleDurationMs,
  })
  const ringVisualStrength = motionState === "playing"
    ? 1
    : Math.max(0.1, Math.min(1, metalPausedStrength))
  const ringStyle = {
    ...style,
    "--ml-metal-attention-opacity": ringVisualStrength,
    "--ml-metal-attention-transition-ms": `${resolvedSettleDurationMs}ms`,
  } as React.CSSProperties

  if (motionState === "off") {
    return (
      <span
        className={cn("ml-metal-attention-root ml-metal-attention-root-idle", className)}
        data-ml-metal-full-width={metalFullWidth ? "true" : undefined}
        style={style}
      >
        {children}
      </span>
    )
  }

  return (
    <MetalFx
      className={cn(
        "ml-metal-attention-root",
        `ml-metal-attention-root-${motionState}`,
        className,
      )}
      data-ml-metal-full-width={metalFullWidth ? "true" : undefined}
      data-ml-metal-motion-state={motionState}
      disableGlow={disableMetalGlow}
      normalizeHostStyles={false}
      paused={motionState === "paused"}
      preset={metalPreset}
      ringCssPx={metalRingCssPx}
      scale={metalScale}
      shaderScale={metalShaderScale}
      strength={metalStrength}
      style={ringStyle}
      theme={resolvedTheme}
      variant={metalVariant}
    >
      {children}
    </MetalFx>
  )
}

/**
 * Convenience CTA wrapper for the shared Button component.
 */
export function MetalAttentionButton({
  className,
  disableMetalGlow,
  metalFullWidth,
  metalFxClassName,
  metalFxStyle,
  metalFadeOutDurationMs,
  metalMode,
  metalPausedStrength,
  metalPauseMaxDurationMs,
  metalPauseMinDurationMs,
  metalPlayMaxDurationMs,
  metalPlayMinDurationMs,
  metalPreset,
  metalPulseDurationMs,
  metalPulseIntervalMs,
  metalPulseMaxIntervalMs,
  metalPulseMinIntervalMs,
  metalRingCssPx,
  metalScale,
  metalShaderScale,
  metalStrength,
  metalSettleDurationMs,
  metalTheme,
  metalVariant,
  variant = "attention",
  ...buttonProps
}: MetalAttentionButtonProps) {
  return (
    <MetalAttentionRing
      className={metalFxClassName}
      disableMetalGlow={disableMetalGlow}
      metalFadeOutDurationMs={metalFadeOutDurationMs}
      metalFullWidth={metalFullWidth}
      metalMode={metalMode}
      metalPausedStrength={metalPausedStrength}
      metalPauseMaxDurationMs={metalPauseMaxDurationMs}
      metalPauseMinDurationMs={metalPauseMinDurationMs}
      metalPlayMaxDurationMs={metalPlayMaxDurationMs}
      metalPlayMinDurationMs={metalPlayMinDurationMs}
      metalPreset={metalPreset}
      metalPulseDurationMs={metalPulseDurationMs}
      metalPulseIntervalMs={metalPulseIntervalMs}
      metalPulseMaxIntervalMs={metalPulseMaxIntervalMs}
      metalPulseMinIntervalMs={metalPulseMinIntervalMs}
      metalRingCssPx={metalRingCssPx}
      metalScale={metalScale}
      metalShaderScale={metalShaderScale}
      metalStrength={metalStrength}
      metalSettleDurationMs={metalSettleDurationMs}
      metalTheme={metalTheme}
      metalVariant={metalVariant}
      style={metalFxStyle}
    >
      <Button className={cn("ml-metal-attention-button", className)} variant={variant} {...buttonProps} />
    </MetalAttentionRing>
  )
}
