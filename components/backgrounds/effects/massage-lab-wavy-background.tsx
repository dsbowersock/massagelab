"use client"

import { type CSSProperties, useEffect, useMemo, useRef } from "react"
import { createNoise3D } from "simplex-noise"
import { shouldAnimateAmbientBackground } from "@/lib/motion-preferences"
import { cn } from "@/lib/utils"
import styles from "@/components/backgrounds/BackgroundHost.module.css"
import type { BackgroundEffectProps, WavyBackgroundOptions } from "./css-backgrounds"

const DEFAULT_WAVY: Required<WavyBackgroundOptions> = {
  colors: ["#38BDF8", "#818CF8", "#C084FC", "#E879F9", "#22D3EE"],
  waveWidth: 50,
  backgroundFill: "#000000",
  blur: 10,
  speed: "fast",
  waveOpacity: 0.5,
}

const WAVE_COUNT = 5
const NOISE_Y_STEP = 0.3

// MassageLab Wavy Background by Manu Arora, adapted as an internal MassageLab premium visual effect.
export default function MassageLabWavyBackground({ className, wavy }: BackgroundEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const wavyInputColors = Array.isArray(wavy?.colors) ? wavy.colors : []
  const wavyBackgroundFill = wavy?.backgroundFill
  const wavyBlur = wavy?.blur
  const wavySpeed = wavy?.speed
  const wavyWaveOpacity = wavy?.waveOpacity
  const wavyWaveWidth = wavy?.waveWidth
  const wavyColorOne = wavyInputColors[0]
  const wavyColorTwo = wavyInputColors[1]
  const wavyColorThree = wavyInputColors[2]
  const wavyColorFour = wavyInputColors[3]
  const wavyColorFive = wavyInputColors[4]
  const resolved = useMemo(
    () =>
      resolveWavyOptions({
        backgroundFill: wavyBackgroundFill,
        blur: wavyBlur,
        colors: [wavyColorOne, wavyColorTwo, wavyColorThree, wavyColorFour, wavyColorFive].filter(
          (color): color is string => typeof color === "string",
        ),
        speed: wavySpeed,
        waveOpacity: wavyWaveOpacity,
        waveWidth: wavyWaveWidth,
      }),
    [
      wavyBackgroundFill,
      wavyBlur,
      wavyColorFive,
      wavyColorFour,
      wavyColorOne,
      wavyColorThree,
      wavyColorTwo,
      wavySpeed,
      wavyWaveOpacity,
      wavyWaveWidth,
    ],
  )
  const waveColors = resolved.colors

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext("2d")
    const container = canvas?.parentElement

    if (!canvas || !context || !container) {
      return undefined
    }

    const noise = createNoise3D()
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const compactViewportQuery = window.matchMedia("(max-width: 767px)")
    let animationFrame = 0
    let resizeFrame = 0
    let canvasWidth = 0
    let canvasHeight = 0
    let pixelRatio = 1
    let noiseTime = 0
    let shouldRun = false

    const measureCanvasArea = () => {
      const containerRect = container.getBoundingClientRect()
      const viewportWidth = window.visualViewport?.width ?? window.innerWidth
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight

      return {
        width: Math.max(1, Math.floor(containerRect.width || viewportWidth)),
        height: Math.max(1, Math.floor(containerRect.height || viewportHeight)),
      }
    }

    const resizeCanvas = () => {
      const { width, height } = measureCanvasArea()
      const nextPixelRatio = Math.min(Math.max(window.devicePixelRatio || 1, 1), 1.5)

      if (canvasWidth === width && canvasHeight === height && pixelRatio === nextPixelRatio) {
        return
      }

      canvasWidth = width
      canvasHeight = height
      pixelRatio = nextPixelRatio
      canvas.width = Math.floor(width * pixelRatio)
      canvas.height = Math.floor(height * pixelRatio)
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
    }

    const getSpeedStep = () => (resolved.speed === "fast" ? 0.002 : 0.001)

    const drawWave = () => {
      noiseTime += getSpeedStep()

      for (let waveIndex = 0; waveIndex < WAVE_COUNT; waveIndex += 1) {
        context.beginPath()
        context.lineWidth = resolved.waveWidth
        context.strokeStyle = waveColors[waveIndex % waveColors.length]

        for (let x = 0; x < canvasWidth; x += 5) {
          const y = noise(x / 800, NOISE_Y_STEP * waveIndex, noiseTime) * 100
          context.lineTo(x, y + canvasHeight * 0.5)
        }

        context.stroke()
        context.closePath()
      }
    }

    const render = () => {
      if (!shouldRun) {
        return
      }

      resizeCanvas()
      context.fillStyle = resolved.backgroundFill
      context.globalAlpha = resolved.waveOpacity
      context.fillRect(0, 0, canvasWidth, canvasHeight)
      drawWave()
      context.globalAlpha = 1
      animationFrame = window.requestAnimationFrame(render)
    }

    const stopAnimation = () => {
      shouldRun = false
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame)
        animationFrame = 0
      }

      if (resizeFrame) {
        window.cancelAnimationFrame(resizeFrame)
        resizeFrame = 0
      }

      canvas.hidden = true
      context.clearRect(0, 0, canvasWidth, canvasHeight)
    }

    const startAnimation = () => {
      if (shouldRun) {
        return
      }

      shouldRun = true
      canvas.hidden = false
      resizeCanvas()
      animationFrame = window.requestAnimationFrame(render)
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

    const handleResize = () => {
      if (!shouldRun || resizeFrame) {
        return
      }

      resizeFrame = window.requestAnimationFrame(() => {
        resizeFrame = 0
        resizeCanvas()
      })
    }

    const resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(container)
    window.addEventListener("resize", handleResize)
    reducedMotionQuery.addEventListener("change", updateAnimationState)
    compactViewportQuery.addEventListener("change", updateAnimationState)
    document.addEventListener("visibilitychange", updateAnimationState)
    updateAnimationState()

    return () => {
      stopAnimation()
      resizeObserver.disconnect()
      window.removeEventListener("resize", handleResize)
      reducedMotionQuery.removeEventListener("change", updateAnimationState)
      compactViewportQuery.removeEventListener("change", updateAnimationState)
      document.removeEventListener("visibilitychange", updateAnimationState)
    }
  }, [
    resolved.backgroundFill,
    resolved.blur,
    resolved.speed,
    resolved.waveOpacity,
    resolved.waveWidth,
    waveColors,
  ])

  return (
    <div
      className={cn(styles.effectLayer, styles.massageLabWavyBackground, className)}
      style={{ "--ml-wavy-blur": `${resolved.blur}px` } as CSSProperties}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className={styles.wavyBackgroundCanvas} />
    </div>
  )
}

function resolveWavyOptions(wavy: WavyBackgroundOptions | undefined): Required<WavyBackgroundOptions> {
  const colors = Array.isArray(wavy?.colors)
    ? wavy.colors
        .map((color) => normalizeHexColor(color, ""))
        .filter(Boolean)
        .slice(0, WAVE_COUNT)
    : []

  return {
    colors: colors.length ? colors : DEFAULT_WAVY.colors,
    waveWidth: clampNumber(wavy?.waveWidth, DEFAULT_WAVY.waveWidth, 10, 90),
    backgroundFill: normalizeHexColor(wavy?.backgroundFill, DEFAULT_WAVY.backgroundFill),
    blur: clampNumber(wavy?.blur, DEFAULT_WAVY.blur, 0, 20),
    speed: wavy?.speed === "slow" || wavy?.speed === "fast" ? wavy.speed : DEFAULT_WAVY.speed,
    waveOpacity: clampNumber(wavy?.waveOpacity, DEFAULT_WAVY.waveOpacity, 0.15, 0.85),
  }
}

function normalizeHexColor(value: string | undefined, fallback: string) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value.toUpperCase() : fallback
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback
}
