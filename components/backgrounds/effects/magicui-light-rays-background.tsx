"use client"

import { type CSSProperties, useMemo } from "react"
import { cn } from "@/lib/utils"
import styles from "@/components/backgrounds/BackgroundHost.module.css"
import type { BackgroundEffectProps, MagicLightRaysOptions } from "./css-backgrounds"

const DEFAULT_MAGIC_LIGHT_RAYS = {
  backgroundColor: "#020617",
  color: "#A0D2FF",
  count: 7,
  blur: 36,
  speed: 14,
  length: 70,
  opacity: 0.65,
} satisfies Required<MagicLightRaysOptions>

interface LightRay {
  id: string
  left: number
  rotate: number
  width: number
  swing: number
  delay: number
  duration: number
  intensity: number
}

export default function MagicLightRaysBackground({
  className,
  magicLightRays,
}: BackgroundEffectProps) {
  const options = resolveLightRaysOptions(magicLightRays)
  const rays = useMemo(
    () => createRays(options.count, options.speed),
    [options.count, options.speed],
  )
  const wrapperStyle = {
    "--ml-light-rays-background": options.backgroundColor,
    "--ml-light-rays-color": options.color,
    "--ml-light-rays-blur": `${options.blur}px`,
    "--ml-light-rays-length": `${options.length}vh`,
  } as CSSProperties

  return (
    <div
      className={cn(styles.effectLayer, styles.magicLightRaysBackground, className)}
      style={wrapperStyle}
      aria-hidden="true"
    >
      <div className={styles.magicLightRaysGlowOne} />
      <div className={styles.magicLightRaysGlowTwo} />
      {rays.map((ray) => {
        const peakOpacity = Math.min(1, options.opacity * ray.intensity)
        const rayStyle = {
          "--ml-light-rays-left": `${ray.left}%`,
          "--ml-light-rays-width": `${ray.width}px`,
          "--ml-light-rays-rotate-start": `${ray.rotate - ray.swing}deg`,
          "--ml-light-rays-rotate-end": `${ray.rotate + ray.swing}deg`,
          "--ml-light-rays-duration": `${ray.duration}s`,
          "--ml-light-rays-delay": `${-ray.delay}s`,
          "--ml-light-rays-peak-opacity": peakOpacity.toFixed(3),
          "--ml-light-rays-static-opacity": (peakOpacity * 0.58).toFixed(3),
        } as CSSProperties

        return <div key={ray.id} className={styles.magicLightRaysRay} style={rayStyle} />
      })}
    </div>
  )
}

function createRays(count: number, cycle: number): LightRay[] {
  if (count <= 0) {
    return []
  }

  return Array.from({ length: count }, (_, index) => {
    const seed = index + count * 13 + Math.round(cycle * 10)
    const left = 8 + randomUnit(seed, 1) * 84
    const rotate = -28 + randomUnit(seed, 2) * 56
    const width = 160 + randomUnit(seed, 3) * 160
    const swing = 0.8 + randomUnit(seed, 4) * 1.8
    const delay = randomUnit(seed, 5) * cycle
    const duration = cycle * (0.75 + randomUnit(seed, 6) * 0.5)
    const intensity = 0.6 + randomUnit(seed, 7) * 0.5

    return {
      id: `${index}-${Math.round(left * 10)}`,
      left,
      rotate,
      width,
      swing,
      delay,
      duration,
      intensity,
    }
  })
}

function resolveLightRaysOptions(options?: MagicLightRaysOptions): Required<MagicLightRaysOptions> {
  return {
    backgroundColor: normalizeHexColor(options?.backgroundColor, DEFAULT_MAGIC_LIGHT_RAYS.backgroundColor),
    color: normalizeHexColor(options?.color, DEFAULT_MAGIC_LIGHT_RAYS.color),
    count: clampInteger(options?.count, DEFAULT_MAGIC_LIGHT_RAYS.count, 1, 20),
    blur: clampNumber(options?.blur, DEFAULT_MAGIC_LIGHT_RAYS.blur, 0, 80),
    speed: clampNumber(options?.speed, DEFAULT_MAGIC_LIGHT_RAYS.speed, 2, 40),
    length: clampNumber(options?.length, DEFAULT_MAGIC_LIGHT_RAYS.length, 24, 120),
    opacity: clampNumber(options?.opacity, DEFAULT_MAGIC_LIGHT_RAYS.opacity, 0.05, 1),
  }
}

function randomUnit(seed: number, salt: number) {
  const value = Math.sin(seed * 12.9898 + salt * 78.233) * 43758.5453
  return value - Math.floor(value)
}

function clampInteger(value: number | undefined, fallback: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return fallback
  }

  return Math.min(max, Math.max(min, Math.trunc(Number(value))))
}

function clampNumber(value: number | undefined, fallback: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return fallback
  }

  return Math.min(max, Math.max(min, Number(value)))
}

function normalizeHexColor(value: string | undefined, fallback: string) {
  if (typeof value !== "string") {
    return fallback
  }

  const normalized = value.trim()

  if (/^#[0-9a-fA-F]{6}$/.test(normalized)) {
    return normalized.toUpperCase()
  }

  return fallback
}
