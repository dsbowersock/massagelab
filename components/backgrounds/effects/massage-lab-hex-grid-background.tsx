"use client"

import { useEffect, useMemo, useRef } from "react"
import { shouldAnimateAmbientBackground } from "@/lib/motion-preferences"
import {
  TILE_GRID_FADE_SECONDS_DEFAULT,
  TILE_GRID_FADE_SECONDS_MAX,
  TILE_GRID_FADE_SECONDS_MIN,
} from "@/lib/tile-grid-background"
import { cn } from "@/lib/utils"
import styles from "@/components/backgrounds/BackgroundHost.module.css"
import type { BackgroundEffectProps, ColorHarmony, HexGridOptions } from "./css-backgrounds"

type RgbColor = [number, number, number]

type HexCell = {
  seed: number
  phaseOffset: number
  shade: number
  bevelAlpha: number
}

type ResolvedHexGridOptions = {
  palette: RgbColor[]
  hexSize: number
  jointSize: number
  changeFrequency: number
  activePercent: number
  opacity: number
}

type HexPoint = {
  x: number
  y: number
}

const DEFAULT_PRIMARY_COLOR = "#22D3EE"
const DEFAULT_BACKGROUND = "#12161A"
const HARMONY_FALLBACK: ColorHarmony = "analogous"
const HARMONIES = new Set<ColorHarmony>([
  "analogous",
  "complementary",
  "split-complementary",
  "triad",
  "square",
  "compound",
  "shades",
  "monochromatic",
])

export default function MassageLabHexGridBackground({ className, hexGrid }: BackgroundEffectProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const hexGridPrimaryColor = hexGrid?.primaryColor
  const hexGridHarmony = hexGrid?.harmony
  const hexGridHexSize = hexGrid?.hexSize
  const hexGridJointSize = hexGrid?.jointSize
  const hexGridChangeFrequency = hexGrid?.changeFrequency
  const hexGridActivePercent = hexGrid?.activePercent
  const hexGridOpacity = hexGrid?.opacity

  /*
   * The Chimer clock ticks every second. Memoizing by primitive options keeps
   * the canvas lifecycle stable while the display re-renders.
   */
  const resolved = useMemo(
    () =>
      resolveHexGridOptions({
        primaryColor: hexGridPrimaryColor,
        harmony: hexGridHarmony,
        hexSize: hexGridHexSize,
        jointSize: hexGridJointSize,
        changeFrequency: hexGridChangeFrequency,
        activePercent: hexGridActivePercent,
        opacity: hexGridOpacity,
      }),
    [
      hexGridPrimaryColor,
      hexGridHarmony,
      hexGridHexSize,
      hexGridJointSize,
      hexGridChangeFrequency,
      hexGridActivePercent,
      hexGridOpacity,
    ],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    const context = canvas?.getContext("2d", { alpha: false })

    if (!canvas || !container || !context) {
      return undefined
    }

    let disposed = false
    let animationFrame: number | null = null
    let width = 0
    let height = 0
    let pixelRatio = 1
    let columns = 0
    let rows = 0
    let lastPaint = 0
    let cells: HexCell[] = []
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const compactViewportQuery = window.matchMedia("(max-width: 640px), (max-height: 480px)")

    const getGeometry = () => {
      const radius = Math.max(6, resolved.hexSize / 2)
      const horizontalPitch = radius * 1.5 + resolved.jointSize
      const verticalPitch = Math.sqrt(3) * radius + resolved.jointSize

      return { radius, horizontalPitch, verticalPitch }
    }

    const buildCells = () => {
      const { radius, horizontalPitch, verticalPitch } = getGeometry()
      columns = Math.ceil((width + radius * 4) / horizontalPitch) + 2
      rows = Math.ceil((height + verticalPitch * 3) / verticalPitch) + 2
      cells = Array.from({ length: columns * rows }, (_, index) => {
        const seed = seededFraction(index * 43.71 + columns * 7.17 + rows * 13.19)

        return {
          seed,
          phaseOffset: seededFraction(seed + index * 0.29),
          shade: 34 + Math.round(seed * 22),
          bevelAlpha: 0.06 + seed * 0.04,
        }
      })
    }

    const resize = () => {
      const bounds = container.getBoundingClientRect()
      width = Math.max(1, Math.floor(bounds.width))
      height = Math.max(1, Math.floor(bounds.height))
      pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5)
      canvas.width = Math.max(1, Math.floor(width * pixelRatio))
      canvas.height = Math.max(1, Math.floor(height * pixelRatio))
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
      context.imageSmoothingEnabled = false
      buildCells()
      draw(false)
    }

    const draw = (animate: boolean, timestamp = performance.now()) => {
      const { radius, horizontalPitch, verticalPitch } = getGeometry()
      const drawRadius = Math.max(5, radius - resolved.jointSize * 0.38)
      const colorRadius = Math.max(3, drawRadius - Math.max(1, resolved.jointSize * 0.75))
      const offsetX = -radius * 2
      const offsetY = -verticalPitch * 1.5

      context.fillStyle = DEFAULT_BACKGROUND
      context.fillRect(0, 0, width, height)

      for (let index = 0; index < cells.length; index += 1) {
        const cell = cells[index]
        if (!cell) {
          continue
        }

        const column = index % columns
        const row = Math.floor(index / columns)
        const x = offsetX + column * horizontalPitch
        const y = offsetY + row * verticalPitch + (column % 2) * (verticalPitch / 2)
        const hexState = getHexVisualState(cell, timestamp, resolved, animate)

        drawHex(context, x, y, drawRadius)
        context.fillStyle = `rgb(${cell.shade}, ${cell.shade + 1}, ${cell.shade + 4})`
        context.fill()

        if (hexState.alpha > 0.004) {
          const color = resolved.palette[hexState.colorIndex] ?? resolved.palette[0] ?? [34, 211, 238]
          drawHex(context, x, y, colorRadius)
          context.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${hexState.alpha})`
          context.fill()
        }

        drawBevel(context, x, y, drawRadius, cell.bevelAlpha)
        drawHex(context, x, y, drawRadius)
        context.lineWidth = Math.max(0.5, Math.min(1.1, resolved.jointSize * 0.22))
        context.strokeStyle = "rgba(205, 205, 205, 0.16)"
        context.stroke()
      }
    }

    const loop = (timestamp: number) => {
      animationFrame = null

      if (disposed) {
        return
      }

      if (timestamp - lastPaint >= 1000 / 30) {
        draw(true, timestamp)
        lastPaint = timestamp
      }

      schedule()
    }

    const schedule = () => {
      if (animationFrame !== null || disposed) {
        return
      }

      const shouldAnimate = shouldAnimateAmbientBackground({
        prefersReducedMotion: reducedMotionQuery.matches,
        compactViewport: compactViewportQuery.matches,
        allowCompactViewport: true,
        documentHidden: document.hidden,
      })

      if (!shouldAnimate) {
        return
      }

      animationFrame = window.requestAnimationFrame(loop)
    }

    const stop = () => {
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame)
        animationFrame = null
      }
    }

    const updateAnimationState = () => {
      const shouldAnimate = shouldAnimateAmbientBackground({
        prefersReducedMotion: reducedMotionQuery.matches,
        compactViewport: compactViewportQuery.matches,
        allowCompactViewport: true,
        documentHidden: document.hidden,
      })

      if (!shouldAnimate) {
        stop()
        draw(false)
        return
      }

      lastPaint = 0
      schedule()
    }

    const resizeObserver = new ResizeObserver(resize)
    resizeObserver.observe(container)
    window.addEventListener("resize", resize)
    reducedMotionQuery.addEventListener("change", updateAnimationState)
    compactViewportQuery.addEventListener("change", updateAnimationState)
    document.addEventListener("visibilitychange", updateAnimationState)
    resize()
    schedule()

    return () => {
      disposed = true
      stop()
      resizeObserver.disconnect()
      window.removeEventListener("resize", resize)
      reducedMotionQuery.removeEventListener("change", updateAnimationState)
      compactViewportQuery.removeEventListener("change", updateAnimationState)
      document.removeEventListener("visibilitychange", updateAnimationState)
    }
  }, [resolved])

  return (
    <div ref={containerRef} className={cn(styles.effectLayer, styles.massageLabHexGrid, className)} aria-hidden="true">
      <canvas ref={canvasRef} className={styles.hexGridCanvas} />
    </div>
  )
}

function resolveHexGridOptions(options: HexGridOptions | undefined): ResolvedHexGridOptions {
  const primaryColor = normalizeHexColor(options?.primaryColor, DEFAULT_PRIMARY_COLOR)
  const harmony = HARMONIES.has(options?.harmony as ColorHarmony)
    ? options?.harmony as ColorHarmony
    : HARMONY_FALLBACK

  return {
    palette: createHarmonyPalette(primaryColor, harmony).map(parseHexColorToRgb),
    hexSize: clampNumber(options?.hexSize, 48, 18, 120),
    jointSize: clampNumber(options?.jointSize, 3, 1, 10),
    changeFrequency: clampNumber(
      options?.changeFrequency,
      TILE_GRID_FADE_SECONDS_DEFAULT,
      TILE_GRID_FADE_SECONDS_MIN,
      TILE_GRID_FADE_SECONDS_MAX,
    ),
    activePercent: clampNumber(options?.activePercent, 14, 1, 60),
    opacity: clampNumber(options?.opacity, 0.72, 0.15, 1),
  }
}

function createHarmonyPalette(primaryColor: string, harmony: ColorHarmony) {
  const [hue, saturation, lightness] = rgbToHsl(parseHexColorToRgb(primaryColor))
  const vividSaturation = clampNumber(Math.max(0.28, saturation), 0.72, 0, 1)
  const vividLightness = clampNumber(lightness, 0.56, 0.24, 0.72)

  if (harmony === "monochromatic") {
    return [
      hslToHex(hue, vividSaturation * 0.58, vividLightness - 0.2),
      hslToHex(hue, vividSaturation * 0.72, vividLightness - 0.1),
      hslToHex(hue, vividSaturation, vividLightness),
      hslToHex(hue, Math.min(1, vividSaturation * 1.08), vividLightness + 0.1),
      hslToHex(hue, Math.min(1, vividSaturation * 1.12), vividLightness + 0.18),
    ]
  }

  if (harmony === "shades") {
    return [
      hslToHex(hue, vividSaturation, vividLightness - 0.24),
      hslToHex(hue, vividSaturation, vividLightness - 0.12),
      hslToHex(hue, vividSaturation, vividLightness),
      hslToHex(hue, vividSaturation, vividLightness + 0.1),
      hslToHex(hue, vividSaturation, vividLightness + 0.2),
    ]
  }

  const hueOffsetsByHarmony: Record<Exclude<ColorHarmony, "monochromatic" | "shades">, number[]> = {
    analogous: [-34, -16, 0, 16, 34],
    complementary: [-10, 0, 170, 180, 190],
    "split-complementary": [-18, 0, 150, 210, 18],
    triad: [0, 120, 240, 105, 255],
    square: [0, 90, 180, 270, 45],
    compound: [-28, 0, 28, 180, 208],
  }

  return hueOffsetsByHarmony[harmony].map((offset, index) => {
    const saturationBias = index % 2 === 0 ? 1 : 0.9
    const lightnessBias = index === 0 ? -0.08 : index === 4 ? 0.08 : 0

    return hslToHex(hue + offset, vividSaturation * saturationBias, vividLightness + lightnessBias)
  })
}

function drawHex(context: CanvasRenderingContext2D, x: number, y: number, radius: number) {
  const points = getHexPoints(x, y, radius)
  context.beginPath()
  context.moveTo(points[0]?.x ?? x, points[0]?.y ?? y)

  for (let index = 1; index < points.length; index += 1) {
    const point = points[index]
    if (point) {
      context.lineTo(point.x, point.y)
    }
  }

  context.closePath()
}

function drawBevel(context: CanvasRenderingContext2D, x: number, y: number, radius: number, bevelAlpha: number) {
  const points = getHexPoints(x, y, radius)
  context.save()
  drawHex(context, x, y, radius)
  context.clip()
  const gradient = context.createLinearGradient(x - radius, y - radius, x + radius, y + radius)
  gradient.addColorStop(0, `rgba(255, 255, 255, ${bevelAlpha})`)
  gradient.addColorStop(0.5, "rgba(255, 255, 255, 0)")
  gradient.addColorStop(1, "rgba(0, 0, 0, 0.32)")
  context.fillStyle = gradient
  context.fillRect(x - radius, y - radius, radius * 2, radius * 2)
  context.restore()

  context.beginPath()
  context.strokeStyle = `rgba(255, 255, 255, ${bevelAlpha + 0.02})`
  context.lineWidth = 0.8
  context.moveTo(points[3]?.x ?? x, points[3]?.y ?? y)
  context.lineTo(points[4]?.x ?? x, points[4]?.y ?? y)
  context.lineTo(points[5]?.x ?? x, points[5]?.y ?? y)
  context.stroke()

  context.beginPath()
  context.strokeStyle = "rgba(0, 0, 0, 0.32)"
  context.moveTo(points[0]?.x ?? x, points[0]?.y ?? y)
  context.lineTo(points[1]?.x ?? x, points[1]?.y ?? y)
  context.lineTo(points[2]?.x ?? x, points[2]?.y ?? y)
  context.stroke()
}

function getHexPoints(x: number, y: number, radius: number): HexPoint[] {
  return Array.from({ length: 6 }, (_, index) => {
    const angle = (Math.PI / 3) * index

    return {
      x: x + Math.cos(angle) * radius,
      y: y + Math.sin(angle) * radius,
    }
  })
}

function getHexVisualState(
  cell: HexCell,
  timestamp: number,
  resolved: ResolvedHexGridOptions,
  animate: boolean,
) {
  const paletteLength = Math.max(1, resolved.palette.length)
  const staticColorIndex = getHexColorIndex(cell, 0, paletteLength)
  const activeFraction = resolved.activePercent / 100

  if (!animate) {
    return {
      alpha: cell.phaseOffset < activeFraction ? resolved.opacity : 0,
      colorIndex: staticColorIndex,
    }
  }

  const fadeDuration = getFadeDuration(resolved.changeFrequency)
  const cycleDuration = fadeDuration / activeFraction
  const elapsed = timestamp + cell.phaseOffset * cycleDuration
  const cycleIndex = Math.floor(elapsed / cycleDuration)
  const cycleProgress = elapsed - cycleIndex * cycleDuration
  const colorIndex = getHexColorIndex(cell, cycleIndex, paletteLength)

  if (cycleProgress >= fadeDuration) {
    return { alpha: 0, colorIndex }
  }

  const progress = cycleProgress / fadeDuration
  const fadeProgress = progress <= 0.5 ? progress * 2 : (1 - progress) * 2

  return {
    alpha: resolved.opacity * easeInOutSine(clampNumber(fadeProgress, 0, 0, 1)),
    colorIndex,
  }
}

function getFadeDuration(changeFrequency: number) {
  return changeFrequency * 1000
}

function getHexColorIndex(cell: HexCell, cycleIndex: number, colorCount: number) {
  return Math.floor(seededFraction(cell.seed + cycleIndex * 19.37 + 0.53) * colorCount) % colorCount
}

function easeInOutSine(progress: number) {
  return -(Math.cos(Math.PI * progress) - 1) / 2
}

function seededFraction(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453
  return value - Math.floor(value)
}

function normalizeHexColor(value: string | undefined, fallback: string) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value.toUpperCase() : fallback
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? Math.min(Math.max(numericValue, min), max) : fallback
}

function parseHexColorToRgb(value: string): RgbColor {
  const hex = normalizeHexColor(value, "#FFFFFF").slice(1)
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ]
}

function rgbToHsl([red, green, blue]: RgbColor): RgbColor {
  const r = red / 255
  const g = green / 255
  const b = blue / 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  const lightness = (max + min) / 2

  if (max === min) {
    return [0, 0, lightness]
  }

  const delta = max - min
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min)
  let hue = 0

  if (max === r) {
    hue = (g - b) / delta + (g < b ? 6 : 0)
  } else if (max === g) {
    hue = (b - r) / delta + 2
  } else {
    hue = (r - g) / delta + 4
  }

  return [hue * 60, saturation, lightness]
}

function hslToHex(rawHue: number, rawSaturation: number, rawLightness: number) {
  const hue = ((rawHue % 360) + 360) % 360
  const saturation = clampNumber(rawSaturation, 0.72, 0, 1)
  const lightness = clampNumber(rawLightness, 0.56, 0.18, 0.82)
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation
  const second = chroma * (1 - Math.abs(((hue / 60) % 2) - 1))
  const match = lightness - chroma / 2
  let rgb: RgbColor = [0, 0, 0]

  if (hue < 60) {
    rgb = [chroma, second, 0] as RgbColor
  } else if (hue < 120) {
    rgb = [second, chroma, 0] as RgbColor
  } else if (hue < 180) {
    rgb = [0, chroma, second] as RgbColor
  } else if (hue < 240) {
    rgb = [0, second, chroma] as RgbColor
  } else if (hue < 300) {
    rgb = [second, 0, chroma] as RgbColor
  } else {
    rgb = [chroma, 0, second] as RgbColor
  }

  return `#${rgb.map((value) => (
    Math.round((value + match) * 255).toString(16).padStart(2, "0")
  )).join("")}`.toUpperCase()
}
