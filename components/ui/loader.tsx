"use client"

import * as React from "react"

import { cn } from "@/lib/utils"
import { ShaderMount } from "./shader-mount"
import {
  blurFragmentShader,
  ditherFragmentShader,
  hexToRgba,
  plainFragmentShader,
} from "./shaders"

type LoaderShape = "sphere" | "swirl" | "ripple"
type LoaderStyle = "plain" | "blur" | "dither"

const randomLoaderShapes = ["sphere", "swirl", "ripple"] as const
const contextualColorPattern = /(?:currentColor|var\()/i

const sizeConfig = {
  sm: { width: 48, height: 48 },
  default: { width: 80, height: 80 },
  lg: { width: 120, height: 120 },
}

const shapeMap: Record<LoaderShape, number> = {
  sphere: 1,
  swirl: 2,
  ripple: 3,
}

const shaderMap: Record<LoaderStyle, string> = {
  plain: plainFragmentShader,
  blur: blurFragmentShader,
  dither: ditherFragmentShader,
}

interface LoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Base shape of the loader. Omit to randomly pick a canonical shape per instance. */
  shape?: LoaderShape
  /** Visual style: plain (solid), blur (soft), or dither (pixelated) */
  variant?: LoaderStyle
  /** Size preset or exact square pixel size. */
  size?: keyof typeof sizeConfig | number
  /** Custom width (overrides size preset) */
  width?: number
  /** Custom height (overrides size preset) */
  height?: number
  /** Animation speed multiplier */
  speed?: number
  /** Primary color */
  color?: string
  /** Background color */
  colorBack?: string
  /** Accessible label for visible loading states. */
  label?: string
}

/** Pick one canonical loader shape for callers that want visual variety by default. */
function pickRandomLoaderShape(): LoaderShape {
  const crypto = globalThis.crypto
  if (typeof crypto?.getRandomValues === "function") {
    const values = new Uint32Array(1)
    crypto.getRandomValues(values)
    const randomValue = values[0] ?? 0

    return randomLoaderShapes[randomValue % randomLoaderShapes.length] ?? "sphere"
  }

  const randomIndex = Math.floor(Math.random() * randomLoaderShapes.length)

  return randomLoaderShapes[randomIndex] ?? "sphere"
}

/** Resolve named size presets and custom numeric sizes to bounded canvas pixels. */
function resolveSize(size: LoaderProps["size"]) {
  if (typeof size === "number" && Number.isFinite(size) && size > 0) {
    const resolvedSize = Math.max(14, Math.min(140, Math.round(size)))

    return { width: resolvedSize, height: resolvedSize }
  }

  const sizePreset = typeof size === "string" ? size : "default"

  return sizeConfig[sizePreset]
}

/** Build shader color uniforms from CSS colors in the mounted loader context. */
function resolveColorUniforms(
  color: string,
  colorBack: string,
  colorResolutionEpoch: number,
  contextElement: HTMLElement | null
) {
  const canResolveColors = Number.isFinite(colorResolutionEpoch)

  return {
    u_colorFront: hexToRgba(canResolveColors ? color : "transparent", contextElement),
    u_colorBack: hexToRgba(canResolveColors ? colorBack : "transparent", contextElement),
  }
}

/**
 * Shared indeterminate loader using MassageLab's dithered shader shapes.
 *
 * Omit `shape` for a per-instance random sphere/swirl/ripple choice; pass a
 * shape explicitly for deterministic comparison galleries or route-owned UI.
 */
function Loader({
  shape,
  variant = "dither",
  size = "default",
  width,
  height,
  speed = 1,
  color = "#ea580c",
  colorBack = "transparent",
  label = "Loading",
  className,
  style,
  role,
  "aria-live": ariaLive,
  "aria-atomic": ariaAtomic,
  "aria-hidden": ariaHidden,
  ...props
}: LoaderProps) {
  const [loaderElement, setLoaderElement] = React.useState<HTMLDivElement | null>(null)
  const sizeDefaults = resolveSize(size)
  const resolvedWidth = width ?? sizeDefaults.width
  const resolvedHeight = height ?? sizeDefaults.height

  const [randomShape] = React.useState<LoaderShape>(pickRandomLoaderShape)
  const resolvedShape = shape ?? randomShape

  const fragmentShader = shaderMap[variant]
  const shapeValue = shapeMap[resolvedShape]
  const scale = variant === "blur" ? 0.52 : 0.6
  const usesContextualColor = contextualColorPattern.test(`${color} ${colorBack}`)
  const [colorResolutionEpoch, setColorResolutionEpoch] = React.useState(0)
  const isAriaHidden = ariaHidden === true || ariaHidden === "true"

  React.useEffect(() => {
    if (typeof document === "undefined") {
      return
    }

    const bumpColorResolutionEpoch = () => {
      setColorResolutionEpoch((value) => value + 1)
    }

    // Resolve once after mount so browser-only names and contextual colors see
    // the mounted loader element instead of a body-level fallback probe.
    bumpColorResolutionEpoch()

    if (!usesContextualColor) {
      return
    }

    // Contextual colors can change when themes or tokens change.

    const attributeFilter = ["class", "style", "data-theme"]
    const observer = new MutationObserver(bumpColorResolutionEpoch)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter,
    })
    if (document.body) {
      observer.observe(document.body, {
        attributes: true,
        attributeFilter,
      })
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)")
    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", bumpColorResolutionEpoch)
    } else {
      media.addListener(bumpColorResolutionEpoch)
    }

    return () => {
      observer.disconnect()
      if (typeof media.removeEventListener === "function") {
        media.removeEventListener("change", bumpColorResolutionEpoch)
      } else {
        media.removeListener(bumpColorResolutionEpoch)
      }
    }
  }, [color, colorBack, usesContextualColor])

  const colorUniforms = React.useMemo(
    () => resolveColorUniforms(color, colorBack, colorResolutionEpoch, loaderElement),
    [color, colorBack, colorResolutionEpoch, loaderElement]
  )

  const uniforms = React.useMemo(
    () => ({
      ...colorUniforms,
      u_shape: shapeValue,
      u_scale: scale,
      u_pxSize: 2, // Pixel size for dithering
    }),
    [colorUniforms, shapeValue, scale]
  )

  return (
    <div
      {...props}
      ref={setLoaderElement}
      role={isAriaHidden ? role : role ?? "status"}
      aria-live={isAriaHidden ? ariaLive : ariaLive ?? "polite"}
      aria-atomic={isAriaHidden ? ariaAtomic : ariaAtomic ?? true}
      aria-hidden={ariaHidden}
      data-slot="loader"
      className={cn("relative overflow-hidden rounded-full", className)}
      style={{
        width: resolvedWidth,
        height: resolvedHeight,
        ...style,
      }}
    >
      <ShaderMount
        fragmentShader={fragmentShader}
        uniforms={uniforms}
        speed={speed}
        width={resolvedWidth}
        height={resolvedHeight}
      />
      {isAriaHidden ? null : <span className="sr-only">{label.trim() || "Loading"}</span>}
    </div>
  )
}

export { Loader, sizeConfig }
export type { LoaderProps, LoaderShape, LoaderStyle }
