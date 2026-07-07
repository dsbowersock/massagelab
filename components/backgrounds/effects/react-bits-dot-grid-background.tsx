"use client"

import { useEffect, useMemo, useRef } from "react"
import { shouldAnimateAmbientBackground } from "@/lib/motion-preferences"
import { cn } from "@/lib/utils"
import styles from "@/components/backgrounds/BackgroundHost.module.css"
import type { BackgroundEffectProps, ReactBitsDotGridOptions } from "./css-backgrounds"

type RgbColor = { r: number; g: number; b: number }

type DotGridDot = {
  cx: number
  cy: number
  xOffset: number
  yOffset: number
  vx: number
  vy: number
}

type PointerState = {
  x: number
  y: number
  vx: number
  vy: number
  speed: number
  lastTime: number
  lastX: number
  lastY: number
  lastMove: number
}

type ResolvedDotGridOptions = Required<ReactBitsDotGridOptions>

const DEFAULT_REACT_BITS_DOT_GRID: ResolvedDotGridOptions = {
  dotSize: 16,
  gap: 32,
  baseColor: "#5227FF",
  activeColor: "#5227FF",
  proximity: 150,
  speedTrigger: 100,
  shockRadius: 250,
  shockStrength: 5,
  maxSpeed: 5000,
  resistance: 750,
  returnDuration: 1.5,
  cursorInteraction: true,
  clickShock: true,
}

const OFFSCREEN_POINTER = -9999

// React Bits Dot Grid uses canvas with GSAP InertiaPlugin. MassageLab keeps the
// source grid/proximity/shock model and replaces GSAP with local canvas physics.
export default function ReactBitsDotGridBackground({
  className,
  reactBitsDotGrid,
}: BackgroundEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const dotsRef = useRef<DotGridDot[]>([])
  const pointerRef = useRef<PointerState>({
    x: OFFSCREEN_POINTER,
    y: OFFSCREEN_POINTER,
    vx: 0,
    vy: 0,
    speed: 0,
    lastTime: 0,
    lastX: 0,
    lastY: 0,
    lastMove: 0,
  })
  const options = useMemo(
    () => resolveDotGridOptions(reactBitsDotGrid),
    [reactBitsDotGrid],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext("2d", { alpha: true })

    if (!canvas || !context) {
      return undefined
    }

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const compactViewportQuery = window.matchMedia("(max-width: 360px), (max-height: 360px)")
    const baseRgb = hexToRgb(options.baseColor)
    const activeRgb = hexToRgb(options.activeColor)
    let frame = 0
    let disposed = false
    let width = 1
    let height = 1
    let lastFrame = performance.now()

    const shouldAnimate = () => shouldAnimateAmbientBackground({
      prefersReducedMotion: reducedMotionQuery.matches,
      compactViewport: compactViewportQuery.matches,
      documentHidden: document.visibilityState !== "visible",
    })

    const buildGrid = () => {
      const bounds = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, compactViewportQuery.matches ? 1 : 2)
      width = Math.max(1, bounds.width)
      height = Math.max(1, bounds.height)
      canvas.width = Math.max(1, Math.floor(width * dpr))
      canvas.height = Math.max(1, Math.floor(height * dpr))
      context.setTransform(dpr, 0, 0, dpr, 0, 0)

      const cell = options.dotSize + options.gap
      const cols = Math.max(1, Math.floor((width + options.gap) / cell))
      const rows = Math.max(1, Math.floor((height + options.gap) / cell))
      const gridWidth = cell * cols - options.gap
      const gridHeight = cell * rows - options.gap
      const startX = (width - gridWidth) / 2 + options.dotSize / 2
      const startY = (height - gridHeight) / 2 + options.dotSize / 2
      const dots: DotGridDot[] = []

      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          dots.push({
            cx: startX + col * cell,
            cy: startY + row * cell,
            xOffset: 0,
            yOffset: 0,
            vx: 0,
            vy: 0,
          })
        }
      }

      dotsRef.current = dots
    }

    const applyImpulse = (originX: number, originY: number, velocityX: number, velocityY: number, radius: number, strength: number) => {
      for (const dot of dotsRef.current) {
        const distance = Math.hypot(dot.cx - originX, dot.cy - originY)
        if (distance >= radius) {
          continue
        }

        const falloff = Math.max(0, 1 - distance / radius)
        const pushX = (dot.cx - originX + velocityX * 0.005) * strength * falloff
        const pushY = (dot.cy - originY + velocityY * 0.005) * strength * falloff
        dot.vx += pushX * 0.035
        dot.vy += pushY * 0.035
      }
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!options.cursorInteraction) {
        return
      }

      const now = performance.now()
      const pointer = pointerRef.current
      if (now - pointer.lastMove < 50) {
        return
      }

      const bounds = canvas.getBoundingClientRect()
      const dt = pointer.lastTime ? Math.max(1, now - pointer.lastTime) : 16
      const dx = event.clientX - pointer.lastX
      const dy = event.clientY - pointer.lastY
      let vx = (dx / dt) * 1000
      let vy = (dy / dt) * 1000
      let speed = Math.hypot(vx, vy)
      if (speed > options.maxSpeed) {
        const scale = options.maxSpeed / speed
        vx *= scale
        vy *= scale
        speed = options.maxSpeed
      }

      pointer.lastTime = now
      pointer.lastMove = now
      pointer.lastX = event.clientX
      pointer.lastY = event.clientY
      pointer.vx = vx
      pointer.vy = vy
      pointer.speed = speed
      pointer.x = event.clientX - bounds.left
      pointer.y = event.clientY - bounds.top

      if (speed > options.speedTrigger) {
        applyImpulse(pointer.x, pointer.y, vx, vy, options.proximity, 1)
      }
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!options.clickShock) {
        return
      }

      const bounds = canvas.getBoundingClientRect()
      applyImpulse(
        event.clientX - bounds.left,
        event.clientY - bounds.top,
        0,
        0,
        options.shockRadius,
        options.shockStrength,
      )
    }

    const draw = (timestamp: number) => {
      const animate = shouldAnimate()
      const delta = Math.min(0.05, Math.max(0.001, (timestamp - lastFrame) / 1000))
      lastFrame = timestamp
      context.clearRect(0, 0, width, height)

      const pointer = pointerRef.current
      const proximitySq = options.proximity * options.proximity
      const damping = Math.pow(Math.max(0.82, 1 - 60 / options.resistance), delta * 60)
      const spring = options.returnDuration > 0 ? 0.14 / options.returnDuration : 0.18

      for (const dot of dotsRef.current) {
        if (animate) {
          dot.vx += -dot.xOffset * spring * delta * 60
          dot.vy += -dot.yOffset * spring * delta * 60
          dot.vx *= damping
          dot.vy *= damping
          dot.xOffset += dot.vx * delta * 60
          dot.yOffset += dot.vy * delta * 60
        } else {
          dot.xOffset *= 0.88
          dot.yOffset *= 0.88
          dot.vx = 0
          dot.vy = 0
        }

        const dx = dot.cx - pointer.x
        const dy = dot.cy - pointer.y
        const distanceSq = dx * dx + dy * dy
        let fill = options.baseColor

        if (distanceSq <= proximitySq && options.cursorInteraction) {
          const distance = Math.sqrt(distanceSq)
          const influence = 1 - distance / options.proximity
          const red = Math.round(baseRgb.r + (activeRgb.r - baseRgb.r) * influence)
          const green = Math.round(baseRgb.g + (activeRgb.g - baseRgb.g) * influence)
          const blue = Math.round(baseRgb.b + (activeRgb.b - baseRgb.b) * influence)
          fill = `rgb(${red},${green},${blue})`
        }

        context.beginPath()
        context.fillStyle = fill
        context.arc(dot.cx + dot.xOffset, dot.cy + dot.yOffset, options.dotSize / 2, 0, Math.PI * 2)
        context.fill()
      }

      if (animate && !disposed) {
        frame = window.requestAnimationFrame(draw)
      }
    }

    const render = () => {
      window.cancelAnimationFrame(frame)
      lastFrame = performance.now()
      draw(lastFrame)
    }

    buildGrid()
    const resizeObserver = new ResizeObserver(() => {
      buildGrid()
      render()
    })
    resizeObserver.observe(canvas)
    window.addEventListener("resize", buildGrid, { passive: true })
    document.addEventListener("visibilitychange", render)
    reducedMotionQuery.addEventListener("change", render)
    compactViewportQuery.addEventListener("change", render)
    if (options.cursorInteraction) {
      window.addEventListener("pointermove", handlePointerMove, { passive: true })
    }
    if (options.clickShock) {
      window.addEventListener("pointerdown", handlePointerDown)
    }
    render()

    return () => {
      disposed = true
      window.cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      window.removeEventListener("resize", buildGrid)
      document.removeEventListener("visibilitychange", render)
      reducedMotionQuery.removeEventListener("change", render)
      compactViewportQuery.removeEventListener("change", render)
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerdown", handlePointerDown)
      dotsRef.current = []
      context.clearRect(0, 0, width, height)
      canvas.width = 1
      canvas.height = 1
    }
  }, [options])

  return (
    <div className={cn(styles.reactBitsDotGrid, className)} aria-hidden="true">
      <canvas ref={canvasRef} className={styles.reactBitsDotGridCanvas} />
    </div>
  )
}

function resolveDotGridOptions(options: ReactBitsDotGridOptions | undefined): ResolvedDotGridOptions {
  return {
    dotSize: resolveNumber(options?.dotSize, DEFAULT_REACT_BITS_DOT_GRID.dotSize, 2, 40),
    gap: resolveNumber(options?.gap, DEFAULT_REACT_BITS_DOT_GRID.gap, 4, 80),
    baseColor: resolveHex(options?.baseColor, DEFAULT_REACT_BITS_DOT_GRID.baseColor),
    activeColor: resolveHex(options?.activeColor, DEFAULT_REACT_BITS_DOT_GRID.activeColor),
    proximity: resolveNumber(options?.proximity, DEFAULT_REACT_BITS_DOT_GRID.proximity, 40, 500),
    speedTrigger: resolveNumber(options?.speedTrigger, DEFAULT_REACT_BITS_DOT_GRID.speedTrigger, 0, 1000),
    shockRadius: resolveNumber(options?.shockRadius, DEFAULT_REACT_BITS_DOT_GRID.shockRadius, 40, 700),
    shockStrength: resolveNumber(options?.shockStrength, DEFAULT_REACT_BITS_DOT_GRID.shockStrength, 0, 12),
    maxSpeed: resolveNumber(options?.maxSpeed, DEFAULT_REACT_BITS_DOT_GRID.maxSpeed, 100, 8000),
    resistance: resolveNumber(options?.resistance, DEFAULT_REACT_BITS_DOT_GRID.resistance, 120, 1600),
    returnDuration: resolveNumber(options?.returnDuration, DEFAULT_REACT_BITS_DOT_GRID.returnDuration, 0.1, 4),
    cursorInteraction: options?.cursorInteraction ?? DEFAULT_REACT_BITS_DOT_GRID.cursorInteraction,
    clickShock: options?.clickShock ?? DEFAULT_REACT_BITS_DOT_GRID.clickShock,
  }
}

function resolveNumber(value: number | undefined, fallback: number, min: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback
  }

  return Math.min(max, Math.max(min, value))
}

function resolveHex(value: string | undefined, fallback: string) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value.toUpperCase() : fallback
}

function hexToRgb(hex: string): RgbColor {
  const value = resolveHex(hex, "#000000").slice(1)
  return {
    r: parseInt(value.slice(0, 2), 16),
    g: parseInt(value.slice(2, 4), 16),
    b: parseInt(value.slice(4, 6), 16),
  }
}
