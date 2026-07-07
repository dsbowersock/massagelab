"use client"

import { type CSSProperties, useEffect, useMemo, useRef } from "react"
import { shouldAnimateAmbientBackground } from "@/lib/motion-preferences"
import { cn } from "@/lib/utils"
import styles from "@/components/backgrounds/BackgroundHost.module.css"
import type { AuroraBarsOptions, BackgroundEffectProps } from "./css-backgrounds"

const DEFAULT_AURORA_BARS: Required<Omit<AuroraBarsOptions, "audioLevel">> = {
  paletteMode: "auto",
  primaryColor: "#FF5AA6",
  barCount: 24,
  colors: ["#FFD6EB", "#FF9ACB", "#FF5AA6", "#FF2D78", "#00000000"],
  maxHeightRatio: 0.92,
  minHeightRatio: 0.18,
  speed: 0.5,
  gap: 3,
  blur: 0,
  background: "#000000",
  visualizerActive: false,
}

type ResolvedAuroraBarsOptions = typeof DEFAULT_AURORA_BARS & {
  audioLevel?: number
}

type RgbColor = [number, number, number]

// MassageLab Aurora Bars adapted as an internal MassageLab premium effect.
// Music can opt into a visualizer mode; Clock and Chimer use the passive source motion.
export default function MassageLabAuroraBarsBackground({
  auroraBars,
  className,
}: BackgroundEffectProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const barRefs = useRef<Array<HTMLSpanElement | null>>([])
  const paletteMode = auroraBars?.paletteMode
  const primaryColor = auroraBars?.primaryColor
  const barCount = auroraBars?.barCount
  const colorOne = auroraBars?.colors?.[0]
  const colorTwo = auroraBars?.colors?.[1]
  const colorThree = auroraBars?.colors?.[2]
  const colorFour = auroraBars?.colors?.[3]
  const colorFive = auroraBars?.colors?.[4]
  const maxHeightRatio = auroraBars?.maxHeightRatio
  const minHeightRatio = auroraBars?.minHeightRatio
  const speed = auroraBars?.speed
  const gap = auroraBars?.gap
  const blur = auroraBars?.blur
  const background = auroraBars?.background
  const visualizerActive = auroraBars?.visualizerActive
  const audioLevel = auroraBars?.audioLevel
  const resolved = useMemo(
    () => resolveAuroraBarsOptions({
      audioLevel,
      background,
      barCount,
      blur,
      colors: [colorOne, colorTwo, colorThree, colorFour, colorFive].filter((color): color is string => Boolean(color)),
      gap,
      maxHeightRatio,
      minHeightRatio,
      paletteMode,
      primaryColor,
      speed,
      visualizerActive,
    }),
    [
      audioLevel,
      background,
      barCount,
      blur,
      colorFive,
      colorFour,
      colorOne,
      colorThree,
      colorTwo,
      gap,
      maxHeightRatio,
      minHeightRatio,
      paletteMode,
      primaryColor,
      speed,
      visualizerActive,
    ],
  )
  const bars = useMemo(() => Array.from({ length: resolved.barCount }, (_, index) => index), [resolved.barCount])
  const gradient = `linear-gradient(to top, ${resolved.colors.join(", ")})`
  const style = {
    "--ml-aurora-bars-background": resolved.background,
    "--ml-aurora-bars-gap": `${resolved.gap}px`,
    "--ml-aurora-bars-gradient": gradient,
    "--ml-aurora-bars-blur": `${resolved.blur}px`,
  } as CSSProperties

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return undefined
    }

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const compactViewportQuery = window.matchMedia("(max-width: 640px), (max-height: 480px)")
    let animationFrame = 0
    let shouldRun = false

    const setBarHeights = (timestamp: number, animate: boolean) => {
      const time = animate ? (timestamp / 1000) * resolved.speed : 0
      const total = Math.max(1, resolved.barCount)
      const fallbackAudioLevel = resolved.visualizerActive
        ? 0.56
          + Math.sin(time * 2.4) * 0.16
          + Math.sin(time * 1.35 + 1.9) * 0.12
        : 0
      const audioLevel = resolved.visualizerActive
        ? clampNumber(resolved.audioLevel ?? fallbackAudioLevel, 0, 1)
        : 0

      barRefs.current.forEach((bar, index) => {
        if (!bar) {
          return
        }

        const baseHeight = calculateBarHeight(index, total, time, resolved)
        const localPhase = (index / total) * Math.PI * 4
        const localResponse = 0.44 + ((Math.sin(time * 4.2 + localPhase) + 1) / 2) * 0.56
        const visualizerLift = resolved.visualizerActive
          ? audioLevel * localResponse * (resolved.maxHeightRatio - resolved.minHeightRatio) * 0.24
          : 0
        const height = clampNumber(baseHeight + visualizerLift, resolved.minHeightRatio, resolved.maxHeightRatio)

        bar.style.height = `${height * 100}%`
      })
    }

    const draw = (timestamp: number) => {
      if (!shouldRun) {
        return
      }

      setBarHeights(timestamp, true)
      animationFrame = window.requestAnimationFrame(draw)
    }

    const stopAnimation = () => {
      shouldRun = false
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame)
        animationFrame = 0
      }

      setBarHeights(performance.now(), false)
    }

    const startAnimation = () => {
      if (shouldRun) {
        return
      }

      shouldRun = true
      animationFrame = window.requestAnimationFrame(draw)
    }

    const updateAnimationState = () => {
      const shouldAnimate = shouldAnimateAmbientBackground({
        prefersReducedMotion: reducedMotionQuery.matches,
        compactViewport: compactViewportQuery.matches,
        allowCompactViewport: true,
        documentHidden: document.hidden,
      })

      if (shouldAnimate) {
        startAnimation()
      } else {
        stopAnimation()
      }
    }

    reducedMotionQuery.addEventListener("change", updateAnimationState)
    compactViewportQuery.addEventListener("change", updateAnimationState)
    document.addEventListener("visibilitychange", updateAnimationState)
    updateAnimationState()

    return () => {
      stopAnimation()
      reducedMotionQuery.removeEventListener("change", updateAnimationState)
      compactViewportQuery.removeEventListener("change", updateAnimationState)
      document.removeEventListener("visibilitychange", updateAnimationState)
    }
  }, [resolved])

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={cn(styles.effectLayer, styles.massageLabAuroraBars, className)}
      data-visualizer-active={resolved.visualizerActive ? "true" : "false"}
      style={style}
    >
      <div className={styles.auroraBarsTrack}>
        {bars.map((index) => (
          <span
            key={index}
            ref={(element) => {
              barRefs.current[index] = element
            }}
            className={styles.auroraBarsBar}
          >
            <span className={styles.auroraBarsBarInner} />
          </span>
        ))}
      </div>
      <span className={styles.auroraBarsVignette} />
    </div>
  )
}

function resolveAuroraBarsOptions(auroraBars: AuroraBarsOptions | undefined): ResolvedAuroraBarsOptions {
  const minHeightRatio = clampNumber(auroraBars?.minHeightRatio, 0.04, 0.78, DEFAULT_AURORA_BARS.minHeightRatio)
  const maxHeightRatio = clampNumber(
    auroraBars?.maxHeightRatio,
    Math.min(1, minHeightRatio + 0.02),
    1,
    Math.max(DEFAULT_AURORA_BARS.maxHeightRatio, minHeightRatio + 0.02),
  )
  const paletteMode = auroraBars?.paletteMode === "custom" ? "custom" : "auto"
  const primaryColor = normalizeHexColor(auroraBars?.primaryColor, DEFAULT_AURORA_BARS.primaryColor)
  const customColors = normalizeColorStops(auroraBars?.colors, DEFAULT_AURORA_BARS.colors)

  return {
    paletteMode,
    primaryColor,
    barCount: Math.round(clampNumber(auroraBars?.barCount, 8, 80, DEFAULT_AURORA_BARS.barCount)),
    colors: paletteMode === "custom" ? customColors : createMonochromaticPalette(primaryColor),
    maxHeightRatio,
    minHeightRatio,
    speed: clampNumber(auroraBars?.speed, 0.08, 2, DEFAULT_AURORA_BARS.speed),
    gap: clampNumber(auroraBars?.gap, 0, 16, DEFAULT_AURORA_BARS.gap),
    blur: clampNumber(auroraBars?.blur, 0, 18, DEFAULT_AURORA_BARS.blur),
    background: normalizeHexColor(auroraBars?.background, DEFAULT_AURORA_BARS.background),
    visualizerActive: auroraBars?.visualizerActive === true,
    audioLevel: Number.isFinite(auroraBars?.audioLevel)
      ? clampNumber(auroraBars?.audioLevel, 0, 1, 0)
      : undefined,
  }
}

function calculateBarHeight(
  index: number,
  total: number,
  time: number,
  options: ResolvedAuroraBarsOptions,
) {
  if (total <= 1) {
    return options.maxHeightRatio
  }

  const norm = index / (total - 1)
  const arch = Math.sin(norm * Math.PI)
  const phase1 = (index / total) * Math.PI * 2
  const phase2 = (index / total) * Math.PI * 5.3
  const wave = 0.5
    + 0.25 * Math.sin(time * 1.1 + phase1)
    + 0.25 * Math.sin(time * 0.7 + phase2)
  const blended = arch * 0.65 + wave * 0.35

  return options.minHeightRatio + blended * (options.maxHeightRatio - options.minHeightRatio)
}

function normalizeColorStops(value: string[] | undefined, fallback: string[]) {
  const colors = Array.isArray(value)
    ? value
      .map((color) => normalizeHexColor(color, ""))
      .filter(Boolean)
      .slice(0, 8)
    : []

  return colors.length >= 2 ? colors : fallback
}

function createMonochromaticPalette(primaryColor: string) {
  const [hue, saturation, lightness] = rgbToHsl(parseHexColorToRgb(primaryColor))
  const boostedSaturation = Math.max(0.08, saturation)

  // Auto mode keeps one hue family and changes brightness only, matching the MassageLab bar gradient shape.
  return [
    hslToHex(hue, Math.min(0.78, boostedSaturation * 0.62), Math.min(0.88, lightness + 0.34)),
    hslToHex(hue, Math.min(0.9, boostedSaturation * 0.82), Math.min(0.74, lightness + 0.18)),
    hslToHex(hue, boostedSaturation, lightness),
    hslToHex(hue, Math.min(0.95, boostedSaturation * 1.06), Math.max(0.24, lightness - 0.14)),
    hslToHex(hue, Math.min(0.88, boostedSaturation * 0.9), Math.max(0.08, lightness - 0.32)),
  ]
}

function normalizeHexColor(value: string | undefined, fallback: string) {
  if (typeof value !== "string") {
    return fallback
  }

  const normalized = value.trim().toUpperCase()
  return /^#[0-9A-F]{6}([0-9A-F]{2})?$/.test(normalized) ? normalized : fallback
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

function clampNumber(value: unknown, min: number, max: number, fallback: number): number
function clampNumber(value: unknown, min: number, max: number): number
function clampNumber(value: unknown, min: number, max: number, fallback = min) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback
}
