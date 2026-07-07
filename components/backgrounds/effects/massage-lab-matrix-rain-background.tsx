"use client"

import { useEffect, useMemo, useRef } from "react"
import { shouldAnimateAmbientBackground } from "@/lib/motion-preferences"
import { cn } from "@/lib/utils"
import styles from "@/components/backgrounds/BackgroundHost.module.css"
import type { BackgroundEffectProps, MassageLabMatrixRainOptions } from "./css-backgrounds"

type ResolvedMatrixRainOptions = Required<MassageLabMatrixRainOptions>

const DEFAULT_MASSAGE_LAB_MATRIX_RAIN: ResolvedMatrixRainOptions = {
  color: "#00FF00",
  fontSize: 14,
  speed: 1,
}

const MATRIX_RAIN_CHARACTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%^&*()_+"
const SOURCE_FRAME_INTERVAL_MS = 33

// MassageLab's source is a 2D Matrix-rain canvas. MassageLab keeps that source
// shape while adapting sizing and lifecycle cleanup to the shared background host.
export default function MassageLabMatrixRainBackground({
  className,
  massageLabMatrixRain,
}: BackgroundEffectProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const color = massageLabMatrixRain?.color
  const fontSize = massageLabMatrixRain?.fontSize
  const speed = massageLabMatrixRain?.speed
  const options = useMemo(
    () => resolveMatrixRainOptions({
      color,
      fontSize,
      speed,
    }),
    [color, fontSize, speed],
  )

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    const context = canvas?.getContext("2d", { alpha: true })

    if (!container || !canvas || !context) {
      return undefined
    }

    let animationFrame = 0
    let resizeRetryFrame = 0
    let shouldRun = false
    let viewportWidth = 1
    let viewportHeight = 1
    let drops: number[] = []
    let lastDrawTimestamp = 0
    let hasPainted = false
    const random = createSeededRandom(0xedd0a4)
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const compactViewportQuery = window.matchMedia("(max-width: 640px)")

    const resetDrops = () => {
      const columns = Math.max(1, Math.ceil(viewportWidth / options.fontSize))
      drops = new Array(columns).fill(1)
    }

    const drawMatrix = (advance: boolean) => {
      if (canvas.width <= 1 || canvas.height <= 1) {
        return
      }

      context.fillStyle = hasPainted && advance ? "rgba(0, 0, 0, 0.05)" : "#000000"
      context.fillRect(0, 0, viewportWidth, viewportHeight)
      context.fillStyle = options.color
      context.font = `${options.fontSize}px monospace`
      context.textBaseline = "top"

      for (let column = 0; column < drops.length; column += 1) {
        const row = drops[column]
        const text = MATRIX_RAIN_CHARACTERS[Math.floor(random() * MATRIX_RAIN_CHARACTERS.length)]
        context.fillText(text, column * options.fontSize, row * options.fontSize)

        if (advance) {
          if (row * options.fontSize > viewportHeight && random() > 0.975) {
            drops[column] = 0
          }
          drops[column] += options.speed
        }
      }

      hasPainted = true
    }

    const resizeCanvas = () => {
      const bounds = container.getBoundingClientRect()
      const width = Math.floor(bounds.width)
      const height = Math.floor(bounds.height)

      if (width <= 0 || height <= 0) {
        return false
      }

      viewportWidth = width
      viewportHeight = height
      const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1))
      canvas.width = Math.max(1, Math.floor(width * dpr))
      canvas.height = Math.max(1, Math.floor(height * dpr))
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      hasPainted = false
      resetDrops()
      drawMatrix(false)

      return true
    }

    const requestResizeRetry = () => {
      if (resizeRetryFrame) {
        return
      }

      resizeRetryFrame = window.requestAnimationFrame(() => {
        resizeRetryFrame = 0
        if (!resizeCanvas() && shouldRun) {
          requestResizeRetry()
        }
      })
    }

    const draw = (timestamp: number) => {
      if (!shouldRun) {
        return
      }

      if (timestamp - lastDrawTimestamp >= SOURCE_FRAME_INTERVAL_MS) {
        lastDrawTimestamp = timestamp
        drawMatrix(true)
      }

      animationFrame = window.requestAnimationFrame(draw)
    }

    const stopAnimation = () => {
      shouldRun = false
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame)
        animationFrame = 0
      }
      if (resizeRetryFrame) {
        window.cancelAnimationFrame(resizeRetryFrame)
        resizeRetryFrame = 0
      }
      drawMatrix(false)
    }

    const startAnimation = () => {
      if (shouldRun) {
        return
      }

      shouldRun = true
      if (!resizeCanvas()) {
        requestResizeRetry()
        return
      }
      lastDrawTimestamp = performance.now()
      animationFrame = window.requestAnimationFrame(draw)
    }

    const updateAnimationState = () => {
      const shouldAnimate = shouldAnimateAmbientBackground({
        prefersReducedMotion: reducedMotionQuery.matches,
        compactViewport: Math.min(viewportWidth, viewportHeight) < 360 || compactViewportQuery.matches,
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
      if (!resizeCanvas()) {
        requestResizeRetry()
      }
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
      context.clearRect(0, 0, viewportWidth, viewportHeight)
      canvas.width = 1
      canvas.height = 1
    }
  }, [options])

  return (
    <div
      ref={containerRef}
      className={cn(styles.effectLayer, styles.massageLabMatrixRainBackground, className)}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className={styles.massageLabMatrixRainCanvas} />
    </div>
  )
}

function resolveMatrixRainOptions(options: MassageLabMatrixRainOptions): ResolvedMatrixRainOptions {
  return {
    color: normalizeHexColor(options.color, DEFAULT_MASSAGE_LAB_MATRIX_RAIN.color),
    fontSize: clampNumber(options.fontSize, DEFAULT_MASSAGE_LAB_MATRIX_RAIN.fontSize, 8, 28),
    speed: clampNumber(options.speed, DEFAULT_MASSAGE_LAB_MATRIX_RAIN.speed, 0.05, 3),
  }
}

function normalizeHexColor(value: string | undefined, fallback: string) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value.toUpperCase() : fallback
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback
}

function createSeededRandom(seed: number) {
  let state = seed >>> 0

  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
}
