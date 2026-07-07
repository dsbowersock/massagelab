"use client"

import { useEffect, useMemo, useRef } from "react"
import { shouldAnimateAmbientBackground } from "@/lib/motion-preferences"
import { cn } from "@/lib/utils"
import styles from "@/components/backgrounds/BackgroundHost.module.css"
import type { BackgroundEffectProps, ReactBitsDotFieldOptions } from "./css-backgrounds"

type Dot = {
  ax: number
  ay: number
  sx: number
  sy: number
  vx: number
  vy: number
  x: number
  y: number
}

type MouseState = {
  x: number
  y: number
  prevX: number
  prevY: number
  speed: number
}

type ResolvedDotFieldOptions = Required<ReactBitsDotFieldOptions>

const TWO_PI = Math.PI * 2
const OFFSCREEN_MOUSE = -9999
const DEFAULT_REACT_BITS_DOT_FIELD: ResolvedDotFieldOptions = {
  dotRadius: 1.5,
  dotSpacing: 14,
  cursorRadius: 500,
  cursorForce: 0.1,
  bulgeOnly: true,
  bulgeStrength: 67,
  glowRadius: 160,
  sparkle: false,
  waveAmplitude: 0,
  gradientFrom: "rgba(168, 85, 247, 0.35)",
  gradientTo: "rgba(180, 151, 207, 0.25)",
  glowColor: "#120F17",
  cursorInteraction: true,
}

// React Bits Dot Field is a canvas/SVG simulation rather than a shader. This
// port keeps the source dot physics and glow model while adding app cleanup.
export default function ReactBitsDotFieldBackground({
  className,
  reactBitsDotField,
}: BackgroundEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const glowRef = useRef<SVGCircleElement | null>(null)
  const dotsRef = useRef<Dot[]>([])
  const mouseRef = useRef<MouseState>({
    x: OFFSCREEN_MOUSE,
    y: OFFSCREEN_MOUSE,
    prevX: OFFSCREEN_MOUSE,
    prevY: OFFSCREEN_MOUSE,
    speed: 0,
  })
  const glowOpacityRef = useRef(0)
  const engagementRef = useRef(0)
  const options = useMemo(
    () => resolveDotFieldOptions(reactBitsDotField),
    [reactBitsDotField],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext("2d", { alpha: true })
    const glow = glowRef.current

    if (!canvas || !context) {
      return undefined
    }

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const compactViewportQuery = window.matchMedia("(max-width: 360px), (max-height: 360px)")
    let animationFrame = 0
    let speedInterval = 0
    let resizeTimer = 0
    let frameCount = 0
    let disposed = false
    let width = 1
    let height = 1
    let offsetLeft = 0
    let offsetTop = 0

    const shouldAnimate = () => shouldAnimateAmbientBackground({
      prefersReducedMotion: reducedMotionQuery.matches,
      compactViewport: compactViewportQuery.matches,
      documentHidden: document.visibilityState !== "visible",
    })

    const buildDots = () => {
      const step = options.dotRadius + options.dotSpacing
      const cols = Math.floor(width / step)
      const rows = Math.floor(height / step)
      const padX = (width % step) / 2
      const padY = (height % step) / 2
      const dots: Dot[] = new Array(rows * cols)
      let index = 0

      for (let row = 0; row < rows; row += 1) {
        for (let col = 0; col < cols; col += 1) {
          const ax = padX + col * step + step / 2
          const ay = padY + row * step + step / 2
          dots[index] = { ax, ay, sx: ax, sy: ay, vx: 0, vy: 0, x: ax, y: ay }
          index += 1
        }
      }

      dotsRef.current = dots
    }

    const resizeNow = () => {
      const bounds = canvas.parentElement?.getBoundingClientRect() ?? canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, compactViewportQuery.matches ? 1 : 2)
      width = Math.max(1, bounds.width)
      height = Math.max(1, bounds.height)
      offsetLeft = bounds.left + window.scrollX
      offsetTop = bounds.top + window.scrollY
      canvas.width = Math.max(1, Math.floor(width * dpr))
      canvas.height = Math.max(1, Math.floor(height * dpr))
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      buildDots()
    }

    const queueResize = () => {
      window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(() => {
        resizeNow()
        render()
      }, 100)
    }

    const updateMouseSpeed = () => {
      const mouse = mouseRef.current
      const dx = mouse.prevX - mouse.x
      const dy = mouse.prevY - mouse.y
      const distance = Math.sqrt(dx * dx + dy * dy)
      mouse.speed += (distance - mouse.speed) * 0.5
      if (mouse.speed < 0.001) {
        mouse.speed = 0
      }
      mouse.prevX = mouse.x
      mouse.prevY = mouse.y
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!options.cursorInteraction) {
        return
      }

      mouseRef.current.x = event.pageX - offsetLeft
      mouseRef.current.y = event.pageY - offsetTop
    }

    const draw = () => {
      const animate = shouldAnimate()
      const dots = dotsRef.current
      const mouse = mouseRef.current
      const length = dots.length
      const time = animate ? frameCount * 0.02 : 0
      const targetEngagement = animate && options.cursorInteraction ? Math.min(mouse.speed / 5, 1) : 0

      if (animate) {
        frameCount += 1
      }

      engagementRef.current += (targetEngagement - engagementRef.current) * 0.06
      if (engagementRef.current < 0.001) {
        engagementRef.current = 0
      }

      glowOpacityRef.current += (engagementRef.current - glowOpacityRef.current) * 0.08

      if (glow) {
        glow.setAttribute("cx", String(mouse.x))
        glow.setAttribute("cy", String(mouse.y))
        glow.style.opacity = String(glowOpacityRef.current)
      }

      context.clearRect(0, 0, width, height)

      const gradient = context.createLinearGradient(0, 0, width, height)
      gradient.addColorStop(0, options.gradientFrom)
      gradient.addColorStop(1, options.gradientTo)
      context.fillStyle = gradient

      const cursorRadiusSq = options.cursorRadius * options.cursorRadius
      const dotDrawRadius = options.dotRadius / 2
      const engagement = engagementRef.current

      context.beginPath()

      for (let index = 0; index < length; index += 1) {
        const dot = dots[index]
        const dx = mouse.x - dot.ax
        const dy = mouse.y - dot.ay
        const distanceSq = dx * dx + dy * dy

        if (distanceSq < cursorRadiusSq && engagement > 0.01) {
          const distance = Math.sqrt(distanceSq)
          const angle = Math.atan2(dy, dx)

          if (options.bulgeOnly) {
            const influence = 1 - distance / options.cursorRadius
            const push = influence * influence * options.bulgeStrength * engagement
            dot.sx += (dot.ax - Math.cos(angle) * push - dot.sx) * 0.15
            dot.sy += (dot.ay - Math.sin(angle) * push - dot.sy) * 0.15
          } else {
            const safeDistance = Math.max(distance, 0.001)
            const move = (500 / safeDistance) * (mouse.speed * options.cursorForce)
            dot.vx += Math.cos(angle) * -move
            dot.vy += Math.sin(angle) * -move
          }
        } else if (options.bulgeOnly) {
          dot.sx += (dot.ax - dot.sx) * 0.1
          dot.sy += (dot.ay - dot.sy) * 0.1
        }

        if (!options.bulgeOnly) {
          dot.vx *= 0.9
          dot.vy *= 0.9
          dot.x = dot.ax + dot.vx
          dot.y = dot.ay + dot.vy
          dot.sx += (dot.x - dot.sx) * 0.1
          dot.sy += (dot.y - dot.sy) * 0.1
        }

        let drawX = dot.sx
        let drawY = dot.sy
        if (options.waveAmplitude > 0 && animate) {
          drawY += Math.sin(dot.ax * 0.03 + time) * options.waveAmplitude
          drawX += Math.cos(dot.ay * 0.03 + time * 0.7) * options.waveAmplitude * 0.5
        }

        const sparkleRadius = options.sparkle && animate && (((index * 2_654_435_761) ^ (frameCount >> 3)) >>> 0) % 100 < 3
          ? dotDrawRadius * 1.8
          : dotDrawRadius
        context.moveTo(drawX + sparkleRadius, drawY)
        context.arc(drawX, drawY, sparkleRadius, 0, TWO_PI)
      }

      context.fill()

      if (animate && !disposed) {
        animationFrame = window.requestAnimationFrame(draw)
      }
    }

    const render = () => {
      window.cancelAnimationFrame(animationFrame)
      draw()
    }

    resizeNow()
    const resizeObserver = new ResizeObserver(queueResize)
    resizeObserver.observe(canvas)
    window.addEventListener("resize", queueResize, { passive: true })
    document.addEventListener("visibilitychange", render)
    reducedMotionQuery.addEventListener("change", render)
    compactViewportQuery.addEventListener("change", render)
    if (options.cursorInteraction) {
      window.addEventListener("pointermove", handlePointerMove, { passive: true })
      speedInterval = window.setInterval(updateMouseSpeed, 20)
    }
    draw()

    return () => {
      disposed = true
      window.cancelAnimationFrame(animationFrame)
      window.clearInterval(speedInterval)
      window.clearTimeout(resizeTimer)
      resizeObserver.disconnect()
      window.removeEventListener("resize", queueResize)
      document.removeEventListener("visibilitychange", render)
      reducedMotionQuery.removeEventListener("change", render)
      compactViewportQuery.removeEventListener("change", render)
      window.removeEventListener("pointermove", handlePointerMove)
      dotsRef.current = []
      context.clearRect(0, 0, width, height)
      canvas.width = 1
      canvas.height = 1
    }
  }, [options])

  return (
    <div className={cn(styles.reactBitsDotField, className)} aria-hidden="true">
      <canvas ref={canvasRef} className={styles.reactBitsDotFieldCanvas} />
      <svg className={styles.reactBitsDotFieldGlowSvg}>
        <defs>
          <radialGradient id="react-bits-dot-field-glow">
            <stop offset="0%" stopColor={options.glowColor} />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        </defs>
        <circle
          ref={glowRef}
          cx={OFFSCREEN_MOUSE}
          cy={OFFSCREEN_MOUSE}
          r={options.glowRadius}
          fill="url(#react-bits-dot-field-glow)"
          className={styles.reactBitsDotFieldGlow}
        />
      </svg>
    </div>
  )
}

function resolveDotFieldOptions(options: ReactBitsDotFieldOptions | undefined): ResolvedDotFieldOptions {
  return {
    dotRadius: resolveNumber(options?.dotRadius, DEFAULT_REACT_BITS_DOT_FIELD.dotRadius, 0.5, 8),
    dotSpacing: resolveNumber(options?.dotSpacing, DEFAULT_REACT_BITS_DOT_FIELD.dotSpacing, 4, 48),
    cursorRadius: resolveNumber(options?.cursorRadius, DEFAULT_REACT_BITS_DOT_FIELD.cursorRadius, 60, 900),
    cursorForce: resolveNumber(options?.cursorForce, DEFAULT_REACT_BITS_DOT_FIELD.cursorForce, 0.01, 1),
    bulgeOnly: options?.bulgeOnly ?? DEFAULT_REACT_BITS_DOT_FIELD.bulgeOnly,
    bulgeStrength: resolveNumber(options?.bulgeStrength, DEFAULT_REACT_BITS_DOT_FIELD.bulgeStrength, 0, 160),
    glowRadius: resolveNumber(options?.glowRadius, DEFAULT_REACT_BITS_DOT_FIELD.glowRadius, 0, 360),
    sparkle: options?.sparkle ?? DEFAULT_REACT_BITS_DOT_FIELD.sparkle,
    waveAmplitude: resolveNumber(options?.waveAmplitude, DEFAULT_REACT_BITS_DOT_FIELD.waveAmplitude, 0, 48),
    gradientFrom: resolveCssColor(options?.gradientFrom, DEFAULT_REACT_BITS_DOT_FIELD.gradientFrom),
    gradientTo: resolveCssColor(options?.gradientTo, DEFAULT_REACT_BITS_DOT_FIELD.gradientTo),
    glowColor: resolveHex(options?.glowColor, DEFAULT_REACT_BITS_DOT_FIELD.glowColor),
    cursorInteraction: options?.cursorInteraction ?? DEFAULT_REACT_BITS_DOT_FIELD.cursorInteraction,
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

function resolveCssColor(value: string | undefined, fallback: string) {
  if (typeof value !== "string") {
    return fallback
  }

  if (/^#[0-9a-f]{6}$/i.test(value)) {
    return value.toUpperCase()
  }

  return /^rgba?\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}(?:\s*,\s*(?:0|1|0?\.\d+))?\s*\)$/i.test(value)
    ? value
    : fallback
}
