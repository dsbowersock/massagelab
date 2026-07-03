"use client"

import { useEffect, useMemo, useRef } from "react"
import { cn } from "@/lib/utils"
import styles from "@/components/backgrounds/BackgroundHost.module.css"
import type { BackgroundEffectProps, PixelLiquidOptions } from "./css-backgrounds"

type PixelDetail = NonNullable<PixelLiquidOptions["detail"]>
type RgbColor = [number, number, number]

interface ResolvedPixelLiquidOptions {
  pixelSize: number
  detail: PixelDetail
  motionSpeed: number
  background: string
  shadow: RgbColor
  base: RgbColor
  accent: RgbColor
  hot: RgbColor
}

const DEFAULT_PIXEL_LIQUID_COLORS: {
  background: string
  base: string
  accent: string
  highlight: string
} = {
  background: "#020A0D",
  base: "#007C84",
  accent: "#00E0D7",
  highlight: "#98FFF3",
}

const detailCaps: Record<PixelDetail, { cols: number; rows: number }> = {
  low: { cols: 90, rows: 58 },
  medium: { cols: 132, rows: 82 },
  high: { cols: 178, rows: 108 },
}

const bayer4 = [
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5,
] as const

export default function UnlumenPixelLiquidBackground({ className, pixelLiquid }: BackgroundEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const backgroundColor = pixelLiquid?.backgroundColor
  const baseColor = pixelLiquid?.baseColor
  const accentColor = pixelLiquid?.accentColor
  const highlightColor = pixelLiquid?.highlightColor
  const pixelSize = pixelLiquid?.pixelSize
  const detail = pixelLiquid?.detail
  const motionSpeed = pixelLiquid?.motionSpeed
  const options = useMemo(
    () => resolvePixelLiquidOptions({
      backgroundColor,
      baseColor,
      accentColor,
      highlightColor,
      pixelSize,
      detail,
      motionSpeed,
    }),
    [accentColor, backgroundColor, baseColor, detail, highlightColor, motionSpeed, pixelSize],
  )

  useEffect(() => {
    const canvas = canvasRef.current

    if (!canvas) {
      return undefined
    }

    const context = canvas.getContext("2d", { alpha: false })

    if (!context) {
      return undefined
    }

    let disposed = false
    let frame = 0
    let animationFrame: number | null = null
    let width = 0
    let height = 0
    let cols = 0
    let rows = 0
    let cellWidth = 1
    let cellHeight = 1
    let density = new Float32Array(0)
    let nextDensity = new Float32Array(0)
    let velocityX = new Float32Array(0)
    let velocityY = new Float32Array(0)
    let nextVelocityX = new Float32Array(0)
    let nextVelocityY = new Float32Array(0)
    let lastFrameTime = performance.now()
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")

    const resetField = () => {
      const aspect = Math.max(0.55, Math.min(2.8, width / Math.max(1, height)))
      const caps = detailCaps[options.detail]
      const desiredCols = Math.round(width / options.pixelSize)
      cols = clampInteger(desiredCols, 54, caps.cols)
      rows = clampInteger(Math.round(cols / aspect), 34, caps.rows)
      cellWidth = width / cols
      cellHeight = height / rows
      const total = cols * rows
      density = new Float32Array(total)
      nextDensity = new Float32Array(total)
      velocityX = new Float32Array(total)
      velocityY = new Float32Array(total)
      nextVelocityX = new Float32Array(total)
      nextVelocityY = new Float32Array(total)

      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < cols; x += 1) {
          const index = y * cols + x
          const normalizedX = x / Math.max(1, cols - 1)
          const normalizedY = y / Math.max(1, rows - 1)
          const centerX = normalizedX - 0.5
          const centerY = normalizedY - 0.52
          const radius = Math.sqrt(centerX * centerX + centerY * centerY)
          const turbulence = seededFraction(x * 41.12 + y * 17.23)
          const diagonal = Math.sin((x + y) * 0.09) * 0.025
          density[index] = clampRange(0.18 - radius * 0.28 + turbulence * 0.08 + diagonal, 0, 0.42)
          velocityX[index] = Math.sin(y * 0.11) * 0.014
          velocityY[index] = Math.cos(x * 0.1) * 0.014
        }
      }
    }

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      width = Math.max(1, Math.floor(rect.width))
      height = Math.max(1, Math.floor(rect.height))
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5)
      canvas.width = Math.max(1, Math.floor(width * pixelRatio))
      canvas.height = Math.max(1, Math.floor(height * pixelRatio))
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
      context.imageSmoothingEnabled = false
      resetField()
      draw(performance.now())
    }

    const addImpulse = (
      normalizedX: number,
      normalizedY: number,
      force: number,
      radiusScale: number,
      vectorX: number,
      vectorY: number,
    ) => {
      const centerX = Math.round(normalizedX * (cols - 1))
      const centerY = Math.round(normalizedY * (rows - 1))
      const radius = Math.max(3, Math.round(Math.min(cols, rows) * radiusScale))
      const safeVectorX = Math.abs(vectorX) + Math.abs(vectorY) > 0.001 ? vectorX : 0.58
      const safeVectorY = Math.abs(vectorX) + Math.abs(vectorY) > 0.001 ? vectorY : -0.22

      for (let y = centerY - radius; y <= centerY + radius; y += 1) {
        if (y < 0 || y >= rows) {
          continue
        }

        for (let x = centerX - radius; x <= centerX + radius; x += 1) {
          if (x < 0 || x >= cols) {
            continue
          }

          const distanceX = (x - centerX) / radius
          const distanceY = (y - centerY) / radius
          const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY)

          if (distance > 1) {
            continue
          }

          const falloff = (1 - distance) * (1 - distance)
          const index = y * cols + x
          density[index] = clampRange(density[index] + force * falloff, 0, 1.4)
          velocityX[index] += (safeVectorX * 0.55 - distanceY * 0.18) * force * falloff
          velocityY[index] += (safeVectorY * 0.55 + distanceX * 0.18) * force * falloff
        }
      }
    }

    const step = (time: number) => {
      const speed = options.motionSpeed
      const seconds = time * 0.001
      const elapsed = Math.min(0.05, (time - lastFrameTime) * 0.001) * speed
      lastFrameTime = time

      const autoX = 0.5 + Math.sin(seconds * 0.38 * speed) * 0.24 + Math.sin(seconds * 0.17) * 0.05
      const autoY = 0.5 + Math.cos(seconds * 0.29 * speed) * 0.2
      const vectorX = Math.cos(seconds * 0.38 * speed) * 0.22
      const vectorY = -Math.sin(seconds * 0.29 * speed) * 0.18
      addImpulse(autoX, autoY, 0.032 * speed, 0.105, vectorX, vectorY)

      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < cols; x += 1) {
          const index = y * cols + x
          const left = y * cols + Math.max(0, x - 1)
          const right = y * cols + Math.min(cols - 1, x + 1)
          const up = Math.max(0, y - 1) * cols + x
          const down = Math.min(rows - 1, y + 1) * cols + x
          const sampleX = clampInteger(Math.round(x - velocityX[index] * 4.2), 0, cols - 1)
          const sampleY = clampInteger(Math.round(y - velocityY[index] * 4.2), 0, rows - 1)
          const source = sampleY * cols + sampleX
          const neighborDensity = (density[left] + density[right] + density[up] + density[down]) * 0.25
          const neighborVelocityX = (velocityX[left] + velocityX[right] + velocityX[up] + velocityX[down]) * 0.25
          const neighborVelocityY = (velocityY[left] + velocityY[right] + velocityY[up] + velocityY[down]) * 0.25
          const curl = Math.sin(x * 0.14 + seconds * 0.7) * Math.cos(y * 0.17 - seconds * 0.62)
          const lowFrequencyFlow = Math.sin((x - y) * 0.035 + seconds * 0.33) * 0.0045
          const noise = seededFraction(x * 9.1 + y * 13.7 + Math.floor(frame / 48) * 3.17)
          const grain = noise > 0.986 ? 0.014 : 0

          nextDensity[index] = clampRange(
            density[source] * (0.958 - elapsed * 0.18) + neighborDensity * 0.034 + grain,
            0,
            1.35,
          )
          nextVelocityX[index] = (velocityX[source] * 0.88 + neighborVelocityX * 0.1 + curl * 0.008 + lowFrequencyFlow) * 0.984
          nextVelocityY[index] = (velocityY[source] * 0.88 + neighborVelocityY * 0.1 - curl * 0.007) * 0.984
        }
      }

      const densitySwap = density
      density = nextDensity
      nextDensity = densitySwap
      const velocityXSwap = velocityX
      velocityX = nextVelocityX
      nextVelocityX = velocityXSwap
      const velocityYSwap = velocityY
      velocityY = nextVelocityY
      nextVelocityY = velocityYSwap
    }

    const draw = (time: number) => {
      context.fillStyle = options.background
      context.fillRect(0, 0, width, height)
      const globalPulse = Math.sin(time * 0.00045 * options.motionSpeed) * 0.055
      const inset = Math.min(cellWidth, cellHeight) * 0.12
      const pixelWidth = Math.max(1, Math.ceil(cellWidth - inset))
      const pixelHeight = Math.max(1, Math.ceil(cellHeight - inset))

      for (let y = 0; y < rows; y += 1) {
        for (let x = 0; x < cols; x += 1) {
          const index = y * cols + x
          const dither = ((bayer4[(y % 4) * 4 + (x % 4)] ?? 0) / 15 - 0.5) * 0.18
          const shimmer = Math.sin(x * 0.21 + y * 0.13 + time * 0.0012 * options.motionSpeed) * 0.03
          const value = clampRange(density[index] + dither + shimmer + globalPulse, 0.025, 1)
          const baseAmount = clampRange(value * 1.15, 0, 1)
          const hotAmount = clampRange((value - 0.62) / 0.38, 0, 1)
          const color = mixColor(
            mixColor(options.shadow, options.base, baseAmount),
            mixColor(options.accent, options.hot, hotAmount),
            clampRange((value - 0.32) / 0.68, 0, 1),
          )
          const alpha = clampRange(0.17 + value * 0.76, 0.12, 0.96)

          context.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha})`
          context.fillRect(Math.floor(x * cellWidth), Math.floor(y * cellHeight), pixelWidth, pixelHeight)
        }
      }

      const glow = context.createRadialGradient(width * 0.5, height * 0.48, 0, width * 0.5, height * 0.48, Math.max(width, height) * 0.56)
      glow.addColorStop(0, `rgba(${options.accent[0]}, ${options.accent[1]}, ${options.accent[2]}, 0.14)`)
      glow.addColorStop(0.48, "rgba(0, 0, 0, 0)")
      glow.addColorStop(1, "rgba(0, 0, 0, 0.38)")
      context.fillStyle = glow
      context.fillRect(0, 0, width, height)
    }

    const schedule = () => {
      if (animationFrame !== null || disposed || motionQuery.matches || document.visibilityState === "hidden") {
        return
      }

      animationFrame = window.requestAnimationFrame(loop)
    }

    const loop = (time: number) => {
      animationFrame = null

      if (disposed) {
        return
      }

      step(time)
      draw(time)
      frame += 1
      schedule()
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden" && animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame)
        animationFrame = null
        return
      }

      lastFrameTime = performance.now()
      schedule()
    }

    const handleMotionChange = () => {
      if (motionQuery.matches) {
        if (animationFrame !== null) {
          window.cancelAnimationFrame(animationFrame)
          animationFrame = null
        }
        draw(performance.now())
        return
      }

      schedule()
    }

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(canvas)
    window.addEventListener("resize", resize)
    document.addEventListener("visibilitychange", handleVisibilityChange)
    motionQuery.addEventListener("change", handleMotionChange)
    resize()
    if (!motionQuery.matches) {
      schedule()
    }

    return () => {
      disposed = true
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame)
      }
      resizeObserver.disconnect()
      window.removeEventListener("resize", resize)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      motionQuery.removeEventListener("change", handleMotionChange)
    }
  }, [options])

  return (
    <div className={cn(styles.unlumenPixelLiquid, className)}>
      <canvas ref={canvasRef} className={styles.pixelLiquidCanvas} />
      <span className={styles.pixelLiquidOverlay} />
    </div>
  )
}

function resolvePixelLiquidOptions(options: PixelLiquidOptions | undefined): ResolvedPixelLiquidOptions {
  const background = normalizeHexColor(options?.backgroundColor, DEFAULT_PIXEL_LIQUID_COLORS.background)
  const base = parseHexColorToRgb(normalizeHexColor(options?.baseColor, DEFAULT_PIXEL_LIQUID_COLORS.base))
  const accent = parseHexColorToRgb(normalizeHexColor(options?.accentColor, DEFAULT_PIXEL_LIQUID_COLORS.accent))
  const hot = parseHexColorToRgb(normalizeHexColor(options?.highlightColor, DEFAULT_PIXEL_LIQUID_COLORS.highlight))
  const backgroundRgb = parseHexColorToRgb(background)

  return {
    pixelSize: clampNumber(options?.pixelSize, 8, 4, 18),
    detail: options?.detail === "low" || options?.detail === "high" || options?.detail === "medium" ? options.detail : "medium",
    motionSpeed: clampNumber(options?.motionSpeed, 0.72, 0.2, 1.4),
    background,
    shadow: mixColor(backgroundRgb, base, 0.18),
    base,
    accent,
    hot,
  }
}

function normalizeHexColor(value: string | undefined, fallback: string) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value.toUpperCase() : fallback
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue)) {
    return fallback
  }

  return Math.min(Math.max(numericValue, min), max)
}

function clampRange(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

function clampInteger(value: unknown, min: number, max: number) {
  const numericValue = Number(value)

  if (!Number.isFinite(numericValue)) {
    return min
  }

  return Math.min(Math.max(Math.trunc(numericValue), min), max)
}

function seededFraction(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453
  return value - Math.floor(value)
}

function mixColor(from: RgbColor, to: RgbColor, amount: number): RgbColor {
  return [
    Math.round(from[0] + (to[0] - from[0]) * amount),
    Math.round(from[1] + (to[1] - from[1]) * amount),
    Math.round(from[2] + (to[2] - from[2]) * amount),
  ]
}

function parseHexColorToRgb(value: string): RgbColor {
  const hex = normalizeHexColor(value, "#FFFFFF").slice(1)
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ]
}
