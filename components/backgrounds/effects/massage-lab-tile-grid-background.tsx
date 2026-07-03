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
import type { BackgroundEffectProps, TileGridOptions } from "./css-backgrounds"

type RgbColor = [number, number, number]

type Tile = {
  seed: number
  phaseOffset: number
  shade: number
  bevelAlpha: number
}

type ResolvedTileGridOptions = {
  palette: RgbColor[]
  tileSize: number
  jointSize: number
  changeFrequency: number
  activePercent: number
  opacity: number
}

const DEFAULT_TILE_GRID_COLORS = [
  "#FF7A1A",
  "#4169E1",
  "#22D3EE",
  "#B45CFF",
  "#F6C453",
] as const

const DEFAULT_PRIMARY_COLOR = "#FF7A1A"
const DEFAULT_BACKGROUND = "#15191D"

export default function MassageLabTileGridBackground({ className, tileGrid }: BackgroundEffectProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const tileGridPaletteMode = tileGrid?.paletteMode
  const tileGridPrimaryColor = tileGrid?.primaryColor
  const tileGridColorOne = tileGrid?.colors?.[0]
  const tileGridColorTwo = tileGrid?.colors?.[1]
  const tileGridColorThree = tileGrid?.colors?.[2]
  const tileGridColorFour = tileGrid?.colors?.[3]
  const tileGridColorFive = tileGrid?.colors?.[4]
  const tileGridTileSize = tileGrid?.tileSize
  const tileGridJointSize = tileGrid?.jointSize
  const tileGridChangeFrequency = tileGrid?.changeFrequency
  const tileGridActivePercent = tileGrid?.activePercent
  const tileGridOpacity = tileGrid?.opacity

  /*
   * The clock re-renders every second, and callers build tileGrid with an
   * inline object. Memoize by primitive settings so the canvas animation is not
   * torn down and rebuilt on each clock tick.
   */
  const resolved = useMemo(
    () =>
      resolveTileGridOptions({
        paletteMode: tileGridPaletteMode,
        primaryColor: tileGridPrimaryColor,
        colors: [
          tileGridColorOne,
          tileGridColorTwo,
          tileGridColorThree,
          tileGridColorFour,
          tileGridColorFive,
        ].map((color) => color ?? ""),
        tileSize: tileGridTileSize,
        jointSize: tileGridJointSize,
        changeFrequency: tileGridChangeFrequency,
        activePercent: tileGridActivePercent,
        opacity: tileGridOpacity,
      }),
    [
      tileGridPaletteMode,
      tileGridPrimaryColor,
      tileGridColorOne,
      tileGridColorTwo,
      tileGridColorThree,
      tileGridColorFour,
      tileGridColorFive,
      tileGridTileSize,
      tileGridJointSize,
      tileGridChangeFrequency,
      tileGridActivePercent,
      tileGridOpacity,
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
    let tiles: Tile[] = []
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const compactViewportQuery = window.matchMedia("(max-width: 640px), (max-height: 480px)")

    const buildTiles = () => {
      const pitch = resolved.tileSize + resolved.jointSize
      columns = Math.ceil(width / pitch) + 2
      rows = Math.ceil(height / pitch) + 2
      tiles = Array.from({ length: columns * rows }, (_, index) => {
        const seed = seededFraction(index * 37.17 + columns * 11.31 + rows * 5.13)

        return {
          seed,
          phaseOffset: seededFraction(seed + index * 0.31),
          shade: 42 + Math.round(seed * 24),
          bevelAlpha: 0.08 + seed * 0.04,
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
      buildTiles()
      draw(false)
    }

    const draw = (animate: boolean, timestamp = performance.now()) => {
      const pitch = resolved.tileSize + resolved.jointSize
      const inset = Math.max(0.5, Math.min(2.5, resolved.jointSize * 0.32))
      const tileSize = Math.max(4, resolved.tileSize)
      const offsetX = -((columns * pitch - width) / 2)
      const offsetY = -((rows * pitch - height) / 2)

      context.fillStyle = DEFAULT_BACKGROUND
      context.fillRect(0, 0, width, height)

      for (let index = 0; index < tiles.length; index += 1) {
        const tile = tiles[index]
        if (!tile) {
          continue
        }

        const column = index % columns
        const row = Math.floor(index / columns)
        const x = offsetX + column * pitch + resolved.jointSize / 2
        const y = offsetY + row * pitch + resolved.jointSize / 2
        const tileState = getTileVisualState(tile, timestamp, resolved, animate)

        context.fillStyle = `rgb(${tile.shade}, ${tile.shade + 1}, ${tile.shade + 3})`
        context.fillRect(x, y, tileSize, tileSize)

        if (tileState.alpha > 0.004) {
          const color = resolved.palette[tileState.colorIndex] ?? resolved.palette[0] ?? [255, 122, 26]
          context.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${tileState.alpha})`
          context.fillRect(x + inset, y + inset, Math.max(1, tileSize - inset * 2), Math.max(1, tileSize - inset * 2))
        }

        context.lineWidth = Math.max(0.5, Math.min(1, resolved.jointSize * 0.2))
        context.strokeStyle = "rgba(205, 205, 205, 0.16)"
        context.strokeRect(x + 0.5, y + 0.5, Math.max(1, tileSize - 1), Math.max(1, tileSize - 1))

        context.beginPath()
        context.strokeStyle = `rgba(255, 255, 255, ${tile.bevelAlpha})`
        context.moveTo(x + 1, y + 1)
        context.lineTo(x + tileSize - 1, y + 1)
        context.moveTo(x + 1, y + 1)
        context.lineTo(x + 1, y + tileSize - 1)
        context.stroke()

        context.beginPath()
        context.strokeStyle = "rgba(0, 0, 0, 0.3)"
        context.moveTo(x + tileSize - 0.5, y + 1)
        context.lineTo(x + tileSize - 0.5, y + tileSize - 0.5)
        context.moveTo(x + 1, y + tileSize - 0.5)
        context.lineTo(x + tileSize - 0.5, y + tileSize - 0.5)
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
    <div ref={containerRef} className={cn(styles.effectLayer, styles.massageLabTileGrid, className)} aria-hidden="true">
      <canvas ref={canvasRef} className={styles.tileGridCanvas} />
    </div>
  )
}

function resolveTileGridOptions(options: TileGridOptions | undefined): ResolvedTileGridOptions {
  const paletteMode = options?.paletteMode === "custom" ? "custom" : "auto"
  const customColors = Array.from({ length: 5 }, (_, index) => (
    normalizeHexColor(options?.colors?.[index], DEFAULT_TILE_GRID_COLORS[index] ?? DEFAULT_PRIMARY_COLOR)
  ))
  const primaryColor = normalizeHexColor(options?.primaryColor, DEFAULT_PRIMARY_COLOR)
  const colors = paletteMode === "custom" ? customColors : createAutoPalette(primaryColor)

  return {
    palette: colors.map(parseHexColorToRgb),
    tileSize: clampNumber(options?.tileSize, 44, 18, 120),
    jointSize: clampNumber(options?.jointSize, 3, 1, 10),
    changeFrequency: clampNumber(
      options?.changeFrequency,
      TILE_GRID_FADE_SECONDS_DEFAULT,
      TILE_GRID_FADE_SECONDS_MIN,
      TILE_GRID_FADE_SECONDS_MAX,
    ),
    activePercent: clampNumber(options?.activePercent, 14, 1, 60),
    opacity: clampNumber(options?.opacity, 0.68, 0.15, 1),
  }
}

function createAutoPalette(primaryColor: string) {
  const [hue, saturation, lightness] = rgbToHsl(parseHexColorToRgb(primaryColor))

  // Auto palettes stay analogous to the selected primary so the grid feels cohesive.
  return [
    hslToHex(hue - 30, Math.min(0.92, saturation * 0.9), Math.max(0.3, lightness - 0.05)),
    hslToHex(hue - 15, Math.min(0.95, saturation * 0.98), Math.min(0.66, lightness + 0.03)),
    hslToHex(hue, saturation, lightness),
    hslToHex(hue + 15, Math.min(0.95, saturation * 1.02), Math.min(0.68, lightness + 0.05)),
    hslToHex(hue + 30, Math.min(0.9, saturation * 0.88), Math.max(0.34, lightness - 0.02)),
  ]
}

function normalizeHexColor(value: string | undefined, fallback: string) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value.toUpperCase() : fallback
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? Math.min(Math.max(numericValue, min), max) : fallback
}

function getFadeDuration(changeFrequency: number) {
  return changeFrequency * 1000
}

function getTileVisualState(
  tile: Tile,
  timestamp: number,
  resolved: ResolvedTileGridOptions,
  animate: boolean,
) {
  const paletteLength = Math.max(1, resolved.palette.length)
  const staticColorIndex = getTileColorIndex(tile, 0, paletteLength)
  const activeFraction = resolved.activePercent / 100

  if (!animate) {
    return {
      alpha: tile.phaseOffset < activeFraction ? resolved.opacity : 0,
      colorIndex: staticColorIndex,
    }
  }

  const fadeDuration = getFadeDuration(resolved.changeFrequency)
  const cycleDuration = fadeDuration / activeFraction
  const elapsed = timestamp + tile.phaseOffset * cycleDuration
  const cycleIndex = Math.floor(elapsed / cycleDuration)
  const cycleProgress = elapsed - cycleIndex * cycleDuration
  const colorIndex = getTileColorIndex(tile, cycleIndex, paletteLength)

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

function getTileColorIndex(tile: Tile, cycleIndex: number, colorCount: number) {
  return Math.floor(seededFraction(tile.seed + cycleIndex * 17.23 + 0.41) * colorCount) % colorCount
}

function easeInOutSine(progress: number) {
  return -(Math.cos(Math.PI * progress) - 1) / 2
}

function seededFraction(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453
  return value - Math.floor(value)
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

function hslToHex(rawHue: number, saturation: number, lightness: number) {
  const hue = ((rawHue % 360) + 360) % 360
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
