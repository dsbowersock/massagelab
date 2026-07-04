"use client"

import { useEffect, useMemo, useRef } from "react"
import { shouldAnimateAmbientBackground } from "@/lib/motion-preferences"
import { cn } from "@/lib/utils"
import styles from "@/components/backgrounds/BackgroundHost.module.css"
import type { BackgroundEffectProps, EldoraPhotonBeamOptions } from "./css-backgrounds"

type RgbColor = [number, number, number]

type BeamPoint = {
  x: number
  y: number
  z: number
}

type PhotonSignal = {
  laneIndex: number
  speed: number
  progress: number
  history: BeamPoint[]
  color: string
}

type ResolvedPhotonBeamOptions = Required<EldoraPhotonBeamOptions>

const DEFAULT_ELDORA_PHOTON_BEAM: ResolvedPhotonBeamOptions = {
  colorBg: "#080808",
  colorLine: "#005F6F",
  colorSignal: "#00D9FF",
  useColor2: false,
  colorSignal2: "#00FFFF",
  useColor3: false,
  colorSignal3: "#00B8D4",
  lineCount: 80,
  spreadHeight: 30.33,
  spreadDepth: 0,
  curveLength: 50,
  straightLength: 100,
  curvePower: 0.8265,
  waveSpeed: 2.48,
  waveHeight: 0.145,
  lineOpacity: 0.557,
  signalCount: 94,
  speedGlobal: 0.345,
  trailLength: 3,
  bloomStrength: 3,
  bloomRadius: 0.5,
}

const SEGMENT_COUNT = 150
const TARGET_FRAME_MS = 1000 / 30

// Eldora UI's source renders a Three.js line field with bloom. MassageLab keeps
// the path, lane, signal, wave, and bloom controls in a dependency-free canvas
// renderer so this remains an internal app background instead of a bundled copy.
export default function EldoraPhotonBeamBackground({
  className,
  eldoraPhotonBeam,
}: BackgroundEffectProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const {
    colorBg,
    colorLine,
    colorSignal,
    useColor2,
    colorSignal2,
    useColor3,
    colorSignal3,
    lineCount,
    spreadHeight,
    spreadDepth,
    curveLength,
    straightLength,
    curvePower,
    waveSpeed,
    waveHeight,
    lineOpacity,
    signalCount,
    speedGlobal,
    trailLength,
    bloomStrength,
    bloomRadius,
  } = eldoraPhotonBeam ?? {}
  const options = useMemo(
    () => resolvePhotonBeamOptions({
      colorBg,
      colorLine,
      colorSignal,
      useColor2,
      colorSignal2,
      useColor3,
      colorSignal3,
      lineCount,
      spreadHeight,
      spreadDepth,
      curveLength,
      straightLength,
      curvePower,
      waveSpeed,
      waveHeight,
      lineOpacity,
      signalCount,
      speedGlobal,
      trailLength,
      bloomStrength,
      bloomRadius,
    }),
    [
      bloomRadius,
      bloomStrength,
      colorBg,
      colorLine,
      colorSignal,
      colorSignal2,
      colorSignal3,
      curveLength,
      curvePower,
      lineCount,
      lineOpacity,
      signalCount,
      speedGlobal,
      spreadDepth,
      spreadHeight,
      straightLength,
      trailLength,
      useColor2,
      useColor3,
      waveHeight,
      waveSpeed,
    ],
  )
  const lineRgb = useMemo(() => parseHexColorToRgb(options.colorLine), [options.colorLine])

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    const context = canvas?.getContext("2d", { alpha: false })

    if (!container || !canvas || !context) {
      return undefined
    }

    let animationFrame = 0
    let resizeRetryFrame = 0
    let shouldRun = false
    let viewportWidth = 1
    let viewportHeight = 1
    let pixelRatio = 1
    let lastDrawTimestamp = 0
    let startTimestamp = performance.now()
    const random = createSeededRandom(0x9c01f0)
    let signals = buildSignals(options, random)
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const compactViewportQuery = window.matchMedia("(max-width: 640px)")

    const getPathPoint = (t: number, lineIndex: number, time: number): BeamPoint => {
      const totalLength = options.curveLength + options.straightLength
      const currentX = -options.curveLength + t * totalLength
      const spreadFactor = (lineIndex / Math.max(1, options.lineCount) - 0.5) * 2
      let y = 0
      let z = 0

      if (currentX < 0) {
        const ratio = (currentX + options.curveLength) / Math.max(1, options.curveLength)
        const shapeBase = (Math.cos(ratio * Math.PI) + 1) / 2
        const shapeFactor = Math.pow(shapeBase, options.curvePower)
        const wave =
          Math.sin(time * options.waveSpeed + currentX * 0.1 + lineIndex)
          * options.waveHeight
          * shapeFactor

        y = spreadFactor * options.spreadHeight * shapeFactor + wave
        z = spreadFactor * options.spreadDepth * shapeFactor
      }

      return { x: currentX, y, z }
    }

    const projectPoint = (point: BeamPoint) => {
      const totalLength = options.curveLength + options.straightLength
      const normalX = (point.x + options.curveLength) / Math.max(1, totalLength)
      const scaleX = viewportWidth / Math.max(1, totalLength)
      const scaleY = Math.min(
        viewportHeight / Math.max(1, options.spreadHeight * 2.5),
        scaleX * 1.08,
      )
      const depthShift = options.spreadDepth > 0 ? point.z * scaleY * 0.18 : 0

      return {
        x: normalX * viewportWidth,
        y: viewportHeight * 0.5 + point.y * scaleY + depthShift,
        depth: point.z,
      }
    }

    const drawLane = (lineIndex: number, time: number) => {
      context.beginPath()

      for (let segment = 0; segment < SEGMENT_COUNT; segment += 1) {
        const t = segment / (SEGMENT_COUNT - 1)
        const point = projectPoint(getPathPoint(t, lineIndex, time))

        if (segment === 0) {
          context.moveTo(point.x, point.y)
        } else {
          context.lineTo(point.x, point.y)
        }
      }

      context.stroke()
    }

    const drawSignal = (signal: PhotonSignal) => {
      if (signal.history.length <= 0) {
        return
      }

      const trailSteps = Math.max(1, Math.min(signal.history.length, Math.round(options.trailLength) + 1))
      const glowAlpha = Math.min(1, 0.18 + options.bloomStrength * 0.16)

      context.lineCap = "round"
      context.lineJoin = "round"
      context.shadowColor = signal.color
      context.shadowBlur = Math.max(0, options.bloomRadius * 36 + options.bloomStrength * 4)
      context.globalCompositeOperation = "lighter"

      for (let index = trailSteps - 1; index > 0; index -= 1) {
        const current = signal.history[signal.history.length - index]
        const next = signal.history[signal.history.length - index - 1]

        if (!current || !next) {
          continue
        }

        const currentPoint = projectPoint(current)
        const nextPoint = projectPoint(next)
        const alpha = Math.max(0.05, (trailSteps - index) / trailSteps)

        context.beginPath()
        context.strokeStyle = signal.color
        context.globalAlpha = glowAlpha * alpha
        context.lineWidth = 1.2 + options.bloomStrength * 0.28
        context.moveTo(nextPoint.x, nextPoint.y)
        context.lineTo(currentPoint.x, currentPoint.y)
        context.stroke()
      }

      const head = projectPoint(signal.history[signal.history.length - 1])
      context.shadowBlur = Math.max(8, options.bloomRadius * 48 + options.bloomStrength * 5)
      context.fillStyle = signal.color
      context.globalAlpha = Math.min(1, 0.42 + options.bloomStrength * 0.14)
      context.beginPath()
      context.arc(head.x, head.y, 1.4 + options.bloomStrength * 0.35, 0, Math.PI * 2)
      context.fill()
      context.globalAlpha = 1
      context.shadowBlur = 0
      context.globalCompositeOperation = "source-over"
    }

    const drawFrame = (timestamp: number, animate: boolean) => {
      if (canvas.width <= 1 || canvas.height <= 1) {
        return
      }

      const elapsedSeconds = Math.max(0, (timestamp - startTimestamp) / 1000)

      context.save()
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
      context.fillStyle = options.colorBg
      context.fillRect(0, 0, viewportWidth, viewportHeight)

      const backgroundGlow = context.createRadialGradient(
        viewportWidth * 0.58,
        viewportHeight * 0.5,
        0,
        viewportWidth * 0.58,
        viewportHeight * 0.5,
        Math.max(viewportWidth, viewportHeight) * 0.74,
      )
      backgroundGlow.addColorStop(0, `rgba(${lineRgb[0]}, ${lineRgb[1]}, ${lineRgb[2]}, 0.2)`)
      backgroundGlow.addColorStop(0.45, `rgba(${lineRgb[0]}, ${lineRgb[1]}, ${lineRgb[2]}, 0.08)`)
      backgroundGlow.addColorStop(1, "rgba(0, 0, 0, 0)")
      context.fillStyle = backgroundGlow
      context.fillRect(0, 0, viewportWidth, viewportHeight)

      context.strokeStyle = `rgba(${lineRgb[0]}, ${lineRgb[1]}, ${lineRgb[2]}, ${options.lineOpacity})`
      context.lineWidth = 0.7
      context.lineCap = "round"
      context.lineJoin = "round"
      context.shadowColor = options.colorLine
      context.shadowBlur = Math.max(0, options.bloomRadius * 8)

      for (let lineIndex = 0; lineIndex < options.lineCount; lineIndex += 1) {
        drawLane(lineIndex, elapsedSeconds)
      }

      context.shadowBlur = 0

      if (animate) {
        const frameScale = Math.max(0.2, Math.min(2, (timestamp - lastDrawTimestamp) / 16.67 || 1))
        signals.forEach((signal) => {
          signal.progress += signal.speed * 0.005 * options.speedGlobal * frameScale

          if (signal.progress > 1) {
            signal.progress = 0
            signal.laneIndex = Math.floor(random() * options.lineCount)
            signal.history = []
            signal.color = pickSignalColor(options, random)
          }

          signal.history.push(getPathPoint(signal.progress, signal.laneIndex, elapsedSeconds))

          while (signal.history.length > Math.round(options.trailLength) + 1) {
            signal.history.shift()
          }
        })
      } else if (signals.every((signal) => signal.history.length === 0)) {
        signals.forEach((signal) => {
          signal.history.push(getPathPoint(signal.progress, signal.laneIndex, elapsedSeconds))
        })
      }

      signals.forEach(drawSignal)
      context.restore()
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
      pixelRatio = Math.min(2, Math.max(1, window.devicePixelRatio || 1))
      canvas.width = Math.max(1, Math.floor(width * pixelRatio))
      canvas.height = Math.max(1, Math.floor(height * pixelRatio))
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      signals = buildSignals(options, random)
      startTimestamp = performance.now()
      lastDrawTimestamp = 0
      drawFrame(performance.now(), shouldRun)

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

      if (timestamp - lastDrawTimestamp >= TARGET_FRAME_MS) {
        drawFrame(timestamp, true)
        lastDrawTimestamp = timestamp
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
      drawFrame(performance.now(), false)
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
  }, [lineRgb, options])

  return (
    <div
      ref={containerRef}
      className={cn(styles.effectLayer, styles.eldoraPhotonBeamBackground, className)}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className={styles.eldoraPhotonBeamCanvas} />
    </div>
  )
}

function resolvePhotonBeamOptions(options: EldoraPhotonBeamOptions): ResolvedPhotonBeamOptions {
  return {
    colorBg: normalizeHexColor(options.colorBg, DEFAULT_ELDORA_PHOTON_BEAM.colorBg),
    colorLine: normalizeHexColor(options.colorLine, DEFAULT_ELDORA_PHOTON_BEAM.colorLine),
    colorSignal: normalizeHexColor(options.colorSignal, DEFAULT_ELDORA_PHOTON_BEAM.colorSignal),
    useColor2: typeof options.useColor2 === "boolean" ? options.useColor2 : DEFAULT_ELDORA_PHOTON_BEAM.useColor2,
    colorSignal2: normalizeHexColor(options.colorSignal2, DEFAULT_ELDORA_PHOTON_BEAM.colorSignal2),
    useColor3: typeof options.useColor3 === "boolean" ? options.useColor3 : DEFAULT_ELDORA_PHOTON_BEAM.useColor3,
    colorSignal3: normalizeHexColor(options.colorSignal3, DEFAULT_ELDORA_PHOTON_BEAM.colorSignal3),
    lineCount: Math.round(clampNumber(options.lineCount, DEFAULT_ELDORA_PHOTON_BEAM.lineCount, 12, 160)),
    spreadHeight: clampNumber(options.spreadHeight, DEFAULT_ELDORA_PHOTON_BEAM.spreadHeight, 5, 90),
    spreadDepth: clampNumber(options.spreadDepth, DEFAULT_ELDORA_PHOTON_BEAM.spreadDepth, 0, 60),
    curveLength: clampNumber(options.curveLength, DEFAULT_ELDORA_PHOTON_BEAM.curveLength, 16, 120),
    straightLength: clampNumber(options.straightLength, DEFAULT_ELDORA_PHOTON_BEAM.straightLength, 40, 220),
    curvePower: clampNumber(options.curvePower, DEFAULT_ELDORA_PHOTON_BEAM.curvePower, 0.2, 2),
    waveSpeed: clampNumber(options.waveSpeed, DEFAULT_ELDORA_PHOTON_BEAM.waveSpeed, 0, 8),
    waveHeight: clampNumber(options.waveHeight, DEFAULT_ELDORA_PHOTON_BEAM.waveHeight, 0, 1),
    lineOpacity: clampNumber(options.lineOpacity, DEFAULT_ELDORA_PHOTON_BEAM.lineOpacity, 0.05, 1),
    signalCount: Math.round(clampNumber(options.signalCount, DEFAULT_ELDORA_PHOTON_BEAM.signalCount, 0, 220)),
    speedGlobal: clampNumber(options.speedGlobal, DEFAULT_ELDORA_PHOTON_BEAM.speedGlobal, 0.02, 2),
    trailLength: Math.round(clampNumber(options.trailLength, DEFAULT_ELDORA_PHOTON_BEAM.trailLength, 1, 16)),
    bloomStrength: clampNumber(options.bloomStrength, DEFAULT_ELDORA_PHOTON_BEAM.bloomStrength, 0, 6),
    bloomRadius: clampNumber(options.bloomRadius, DEFAULT_ELDORA_PHOTON_BEAM.bloomRadius, 0, 1.5),
  }
}

function buildSignals(options: ResolvedPhotonBeamOptions, random: () => number): PhotonSignal[] {
  return Array.from({ length: options.signalCount }, () => ({
    laneIndex: Math.floor(random() * options.lineCount),
    speed: 0.2 + random() * 0.5,
    progress: random(),
    history: [],
    color: pickSignalColor(options, random),
  }))
}

function pickSignalColor(options: ResolvedPhotonBeamOptions, random: () => number) {
  const colors = [options.colorSignal]

  if (options.useColor2) {
    colors.push(options.colorSignal2)
  }
  if (options.useColor3) {
    colors.push(options.colorSignal3)
  }

  return colors[Math.floor(random() * colors.length)] ?? options.colorSignal
}

function normalizeHexColor(value: string | undefined, fallback: string) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value.toUpperCase() : fallback
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback
}

function parseHexColorToRgb(value: string): RgbColor {
  const hex = normalizeHexColor(value, "#FFFFFF").slice(1)
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ]
}

function createSeededRandom(seed: number) {
  let state = seed >>> 0

  return () => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 0x100000000
  }
}
