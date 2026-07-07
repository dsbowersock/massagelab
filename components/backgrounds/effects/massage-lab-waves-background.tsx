"use client"

import { useEffect, useMemo, useRef } from "react"
import { shouldAnimateAmbientBackground } from "@/lib/motion-preferences"
import { cn } from "@/lib/utils"
import styles from "@/components/backgrounds/BackgroundHost.module.css"
import type { BackgroundEffectProps, MassageLabWavesOptions } from "./css-backgrounds"

type WavePoint = {
  x: number
  y: number
  wave: { x: number; y: number }
  cursor: { x: number; y: number; vx: number; vy: number }
}

type MouseState = {
  x: number
  y: number
  lx: number
  ly: number
  sx: number
  sy: number
  v: number
  vs: number
  a: number
  set: boolean
}

type ResolvedWavesOptions = Required<MassageLabWavesOptions>

class Grad {
  constructor(
    private readonly x: number,
    private readonly y: number,
    private readonly z: number,
  ) {}

  dot2(x: number, y: number) {
    void this.z
    return this.x * x + this.y * y
  }
}

class Noise {
  private readonly grad3 = [
    new Grad(1, 1, 0),
    new Grad(-1, 1, 0),
    new Grad(1, -1, 0),
    new Grad(-1, -1, 0),
    new Grad(1, 0, 1),
    new Grad(-1, 0, 1),
    new Grad(1, 0, -1),
    new Grad(-1, 0, -1),
    new Grad(0, 1, 1),
    new Grad(0, -1, 1),
    new Grad(0, 1, -1),
    new Grad(0, -1, -1),
  ]
  private readonly p = [
    151, 160, 137, 91, 90, 15, 131, 13, 201, 95, 96, 53, 194, 233, 7, 225, 140, 36, 103, 30, 69, 142, 8, 99, 37, 240,
    21, 10, 23, 190, 6, 148, 247, 120, 234, 75, 0, 26, 197, 62, 94, 252, 219, 203, 117, 35, 11, 32, 57, 177, 33, 88,
    237, 149, 56, 87, 174, 20, 125, 136, 171, 168, 68, 175, 74, 165, 71, 134, 139, 48, 27, 166, 77, 146, 158, 231, 83,
    111, 229, 122, 60, 211, 133, 230, 220, 105, 92, 41, 55, 46, 245, 40, 244, 102, 143, 54, 65, 25, 63, 161, 1, 216,
    80, 73, 209, 76, 132, 187, 208, 89, 18, 169, 200, 196, 135, 130, 116, 188, 159, 86, 164, 100, 109, 198, 173, 186,
    3, 64, 52, 217, 226, 250, 124, 123, 5, 202, 38, 147, 118, 126, 255, 82, 85, 212, 207, 206, 59, 227, 47, 16, 58,
    17, 182, 189, 28, 42, 223, 183, 170, 213, 119, 248, 152, 2, 44, 154, 163, 70, 221, 153, 101, 155, 167, 43, 172, 9,
    129, 22, 39, 253, 19, 98, 108, 110, 79, 113, 224, 232, 178, 185, 112, 104, 218, 246, 97, 228, 251, 34, 242, 193,
    238, 210, 144, 12, 191, 179, 162, 241, 81, 51, 145, 235, 249, 14, 239, 107, 49, 192, 214, 31, 181, 199, 106, 157,
    184, 84, 204, 176, 115, 121, 50, 45, 127, 4, 150, 254, 138, 236, 205, 93, 222, 114, 67, 29, 24, 72, 243, 141, 128,
    195, 78, 66, 215, 61, 156, 180,
  ]
  private readonly perm = new Array<number>(512)
  private readonly gradP = new Array<Grad>(512)

  constructor(seed = 0.5) {
    this.seed(seed)
  }

  seed(seed: number) {
    let normalizedSeed = seed
    if (normalizedSeed > 0 && normalizedSeed < 1) {
      normalizedSeed *= 65_536
    }
    normalizedSeed = Math.floor(normalizedSeed)
    if (normalizedSeed < 256) {
      normalizedSeed |= normalizedSeed << 8
    }

    for (let index = 0; index < 256; index += 1) {
      const value = index & 1
        ? this.p[index] ^ (normalizedSeed & 255)
        : this.p[index] ^ ((normalizedSeed >> 8) & 255)
      this.perm[index] = value
      this.perm[index + 256] = value
      this.gradP[index] = this.grad3[value % 12]
      this.gradP[index + 256] = this.grad3[value % 12]
    }
  }

  fade(t: number) {
    return t * t * t * (t * (t * 6 - 15) + 10)
  }

  lerp(a: number, b: number, t: number) {
    return (1 - t) * a + t * b
  }

  perlin2(x: number, y: number) {
    let xFloor = Math.floor(x)
    let yFloor = Math.floor(y)
    const relativeX = x - xFloor
    const relativeY = y - yFloor
    xFloor &= 255
    yFloor &= 255

    const n00 = this.gradP[xFloor + this.perm[yFloor]].dot2(relativeX, relativeY)
    const n01 = this.gradP[xFloor + this.perm[yFloor + 1]].dot2(relativeX, relativeY - 1)
    const n10 = this.gradP[xFloor + 1 + this.perm[yFloor]].dot2(relativeX - 1, relativeY)
    const n11 = this.gradP[xFloor + 1 + this.perm[yFloor + 1]].dot2(relativeX - 1, relativeY - 1)
    const u = this.fade(relativeX)

    return this.lerp(this.lerp(n00, n10, u), this.lerp(n01, n11, u), this.fade(relativeY))
  }
}

const DEFAULT_MASSAGELAB_WAVES: ResolvedWavesOptions = {
  lineColor: "#000000",
  backgroundColor: "#000000",
  transparentBackground: true,
  waveSpeedX: 0.0125,
  waveSpeedY: 0.005,
  waveAmpX: 32,
  waveAmpY: 16,
  xGap: 10,
  yGap: 32,
  friction: 0.925,
  tension: 0.005,
  maxCursorMove: 100,
  cursorInteraction: true,
}

const OFFSCREEN_MOUSE_X = -10

// MassageLab Waves is a dependency-free canvas simulation. MassageLab keeps the
// source Perlin line grid and cursor spring math, then wraps it with route-safe
// sizing, reduced-motion, and listener cleanup.
export default function MassageLabWavesBackground({
  className,
  massageLabWaves,
}: BackgroundEffectProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const linesRef = useRef<WavePoint[][]>([])
  const mouseRef = useRef<MouseState>({
    x: OFFSCREEN_MOUSE_X,
    y: 0,
    lx: 0,
    ly: 0,
    sx: 0,
    sy: 0,
    v: 0,
    vs: 0,
    a: 0,
    set: false,
  })
  const noiseRef = useRef(new Noise(0.5))
  const lineColor = massageLabWaves?.lineColor
  const backgroundColor = massageLabWaves?.backgroundColor
  const transparentBackground = massageLabWaves?.transparentBackground
  const waveSpeedX = massageLabWaves?.waveSpeedX
  const waveSpeedY = massageLabWaves?.waveSpeedY
  const waveAmpX = massageLabWaves?.waveAmpX
  const waveAmpY = massageLabWaves?.waveAmpY
  const xGap = massageLabWaves?.xGap
  const yGap = massageLabWaves?.yGap
  const friction = massageLabWaves?.friction
  const tension = massageLabWaves?.tension
  const maxCursorMove = massageLabWaves?.maxCursorMove
  const cursorInteraction = massageLabWaves?.cursorInteraction
  const options = useMemo(
    () =>
      resolveWavesOptions({
        lineColor,
        backgroundColor,
        transparentBackground,
        waveSpeedX,
        waveSpeedY,
        waveAmpX,
        waveAmpY,
        xGap,
        yGap,
        friction,
        tension,
        maxCursorMove,
        cursorInteraction,
      }),
    [
      backgroundColor,
      cursorInteraction,
      friction,
      lineColor,
      maxCursorMove,
      tension,
      transparentBackground,
      waveAmpX,
      waveAmpY,
      waveSpeedX,
      waveSpeedY,
      xGap,
      yGap,
    ],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    const context = canvas?.getContext("2d", { alpha: true })

    if (!canvas || !container || !context) {
      return undefined
    }

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const compactViewportQuery = window.matchMedia("(max-width: 360px), (max-height: 360px)")
    let animationFrame = 0
    let resizeFrame = 0
    let disposed = false
    let width = 1
    let height = 1
    let dpr = 1
    let offsetLeft = 0
    let offsetTop = 0

    const shouldAnimate = () => shouldAnimateAmbientBackground({
      prefersReducedMotion: reducedMotionQuery.matches,
      compactViewport: compactViewportQuery.matches,
      documentHidden: document.visibilityState !== "visible",
    })

    const setLines = () => {
      const oWidth = width + 200
      const oHeight = height + 30
      const totalLines = Math.ceil(oWidth / options.xGap)
      const totalPoints = Math.ceil(oHeight / options.yGap)
      const xStart = (width - options.xGap * totalLines) / 2
      const yStart = (height - options.yGap * totalPoints) / 2
      const lines: WavePoint[][] = []

      for (let lineIndex = 0; lineIndex <= totalLines; lineIndex += 1) {
        const points: WavePoint[] = []
        for (let pointIndex = 0; pointIndex <= totalPoints; pointIndex += 1) {
          points.push({
            x: xStart + options.xGap * lineIndex,
            y: yStart + options.yGap * pointIndex,
            wave: { x: 0, y: 0 },
            cursor: { x: 0, y: 0, vx: 0, vy: 0 },
          })
        }
        lines.push(points)
      }

      linesRef.current = lines
    }

    const resizeNow = () => {
      const bounds = container.getBoundingClientRect()
      width = Math.max(1, bounds.width)
      height = Math.max(1, bounds.height)
      offsetLeft = bounds.left
      offsetTop = bounds.top
      dpr = Math.min(window.devicePixelRatio || 1, compactViewportQuery.matches ? 1 : 2)
      canvas.width = Math.max(1, Math.floor(width * dpr))
      canvas.height = Math.max(1, Math.floor(height * dpr))
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      setLines()
    }

    const queueResize = () => {
      window.cancelAnimationFrame(resizeFrame)
      resizeFrame = window.requestAnimationFrame(() => {
        resizeNow()
        render()
      })
    }

    const updateMouse = (clientX: number, clientY: number) => {
      const mouse = mouseRef.current
      mouse.x = clientX - offsetLeft
      mouse.y = clientY - offsetTop
      if (!mouse.set) {
        mouse.sx = mouse.x
        mouse.sy = mouse.y
        mouse.lx = mouse.x
        mouse.ly = mouse.y
        mouse.set = true
      }
    }

    const handlePointerMove = (event: PointerEvent) => {
      updateMouse(event.clientX, event.clientY)
    }

    const handlePointerLeave = () => {
      mouseRef.current.set = false
      mouseRef.current.x = OFFSCREEN_MOUSE_X
      mouseRef.current.y = 0
      mouseRef.current.v = 0
      mouseRef.current.vs = 0
    }

    const movePoints = (time: number, animate: boolean) => {
      const mouse = mouseRef.current
      const noise = noiseRef.current
      const includeCursor = options.cursorInteraction && mouse.set && animate

      for (const points of linesRef.current) {
        for (const point of points) {
          const move = noise.perlin2(
            (point.x + time * options.waveSpeedX) * 0.002,
            (point.y + time * options.waveSpeedY) * 0.0015,
          ) * 12
          point.wave.x = Math.cos(move) * options.waveAmpX
          point.wave.y = Math.sin(move) * options.waveAmpY

          if (includeCursor) {
            const dx = point.x - mouse.sx
            const dy = point.y - mouse.sy
            const dist = Math.hypot(dx, dy)
            const limit = Math.max(175, mouse.vs)
            if (dist < limit) {
              const s = 1 - dist / limit
              const force = Math.cos(dist * 0.001) * s
              point.cursor.vx += Math.cos(mouse.a) * force * limit * mouse.vs * 0.00065
              point.cursor.vy += Math.sin(mouse.a) * force * limit * mouse.vs * 0.00065
            }
          }

          point.cursor.vx += (0 - point.cursor.x) * options.tension
          point.cursor.vy += (0 - point.cursor.y) * options.tension
          point.cursor.vx *= options.friction
          point.cursor.vy *= options.friction
          point.cursor.x += point.cursor.vx * 2
          point.cursor.y += point.cursor.vy * 2
          point.cursor.x = Math.min(options.maxCursorMove, Math.max(-options.maxCursorMove, point.cursor.x))
          point.cursor.y = Math.min(options.maxCursorMove, Math.max(-options.maxCursorMove, point.cursor.y))
        }
      }
    }

    const moved = (point: WavePoint, withCursor = true) => {
      const x = point.x + point.wave.x + (withCursor ? point.cursor.x : 0)
      const y = point.y + point.wave.y + (withCursor ? point.cursor.y : 0)
      return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 }
    }

    const drawLines = () => {
      context.clearRect(0, 0, width, height)
      if (!options.transparentBackground) {
        context.fillStyle = options.backgroundColor
        context.fillRect(0, 0, width, height)
      }
      context.beginPath()
      context.strokeStyle = options.lineColor
      context.lineWidth = 1

      for (const points of linesRef.current) {
        let p1 = moved(points[0], false)
        context.moveTo(p1.x, p1.y)
        points.forEach((point, index) => {
          const isLast = index === points.length - 1
          p1 = moved(point, !isLast)
          const p2 = moved(points[index + 1] ?? points[points.length - 1], !isLast)
          context.lineTo(p1.x, p1.y)
          if (isLast) {
            context.moveTo(p2.x, p2.y)
          }
        })
      }

      context.stroke()
    }

    function renderFrame(time = 0) {
      const animate = shouldAnimate()
      const mouse = mouseRef.current
      if (options.cursorInteraction && mouse.set && animate) {
        mouse.sx += (mouse.x - mouse.sx) * 0.1
        mouse.sy += (mouse.y - mouse.sy) * 0.1
        const dx = mouse.x - mouse.lx
        const dy = mouse.y - mouse.ly
        const distance = Math.hypot(dx, dy)
        mouse.v = distance
        mouse.vs += (distance - mouse.vs) * 0.1
        mouse.vs = Math.min(100, mouse.vs)
        mouse.lx = mouse.x
        mouse.ly = mouse.y
        mouse.a = Math.atan2(dy, dx)
      }

      movePoints(animate ? time : 0, animate)
      drawLines()

      if (animate && !disposed) {
        animationFrame = window.requestAnimationFrame(renderFrame)
      }
    }

    function render() {
      window.cancelAnimationFrame(animationFrame)
      renderFrame()
    }

    resizeNow()
    const resizeObserver = new ResizeObserver(queueResize)
    resizeObserver.observe(container)
    window.addEventListener("resize", queueResize, { passive: true })
    document.addEventListener("visibilitychange", render)
    reducedMotionQuery.addEventListener("change", render)
    compactViewportQuery.addEventListener("change", queueResize)
    if (options.cursorInteraction) {
      window.addEventListener("pointermove", handlePointerMove, { passive: true })
      window.addEventListener("pointerleave", handlePointerLeave, { passive: true })
    }
    renderFrame()

    return () => {
      disposed = true
      window.cancelAnimationFrame(animationFrame)
      window.cancelAnimationFrame(resizeFrame)
      resizeObserver.disconnect()
      window.removeEventListener("resize", queueResize)
      document.removeEventListener("visibilitychange", render)
      reducedMotionQuery.removeEventListener("change", render)
      compactViewportQuery.removeEventListener("change", queueResize)
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerleave", handlePointerLeave)
      linesRef.current = []
      context.clearRect(0, 0, width, height)
      canvas.width = 1
      canvas.height = 1
    }
  }, [options])

  return (
    <div
      className={cn(styles.effectLayer, styles.massageLabWaves, className)}
      ref={containerRef}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className={styles.massageLabWavesCanvas} />
    </div>
  )
}

function resolveWavesOptions(options: MassageLabWavesOptions | undefined): ResolvedWavesOptions {
  return {
    lineColor: resolveHex(options?.lineColor, DEFAULT_MASSAGELAB_WAVES.lineColor),
    backgroundColor: resolveHex(options?.backgroundColor, DEFAULT_MASSAGELAB_WAVES.backgroundColor),
    transparentBackground: options?.transparentBackground ?? DEFAULT_MASSAGELAB_WAVES.transparentBackground,
    waveSpeedX: resolveNumber(options?.waveSpeedX, DEFAULT_MASSAGELAB_WAVES.waveSpeedX, 0, 0.05),
    waveSpeedY: resolveNumber(options?.waveSpeedY, DEFAULT_MASSAGELAB_WAVES.waveSpeedY, 0, 0.05),
    waveAmpX: resolveNumber(options?.waveAmpX, DEFAULT_MASSAGELAB_WAVES.waveAmpX, 0, 96),
    waveAmpY: resolveNumber(options?.waveAmpY, DEFAULT_MASSAGELAB_WAVES.waveAmpY, 0, 96),
    xGap: resolveNumber(options?.xGap, DEFAULT_MASSAGELAB_WAVES.xGap, 4, 40),
    yGap: resolveNumber(options?.yGap, DEFAULT_MASSAGELAB_WAVES.yGap, 8, 96),
    friction: resolveNumber(options?.friction, DEFAULT_MASSAGELAB_WAVES.friction, 0.8, 0.99),
    tension: resolveNumber(options?.tension, DEFAULT_MASSAGELAB_WAVES.tension, 0.001, 0.05),
    maxCursorMove: resolveNumber(options?.maxCursorMove, DEFAULT_MASSAGELAB_WAVES.maxCursorMove, 0, 240),
    cursorInteraction: options?.cursorInteraction ?? DEFAULT_MASSAGELAB_WAVES.cursorInteraction,
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
