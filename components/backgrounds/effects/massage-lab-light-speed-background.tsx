"use client"

import { useEffect, useMemo, useRef } from "react"
import { shouldAnimateAmbientBackground } from "@/lib/motion-preferences"
import { cn } from "@/lib/utils"
import styles from "@/components/backgrounds/BackgroundHost.module.css"
import type { BackgroundEffectProps, MassageLabLightSpeedOptions } from "./css-backgrounds"

type RgbColor = [number, number, number]

type LightSpeedParticle = {
  angle: number
  radius: number
  z: number
  speedMultiplier: number
  length: number
  resetCount: number
}

type LightSpeedProjection = {
  x: number
  y: number
  progress: number
  scale: number
}

type ResolvedLightSpeedOptions = Required<MassageLabLightSpeedOptions>

const DEFAULT_MASSAGE_LAB_LIGHT_SPEED: ResolvedLightSpeedOptions = {
  particleCount: 200,
  warpSpeed: 1,
  lightColor: "#B026FF",
  intensity: 3,
  radius: 25,
  cylinderLength: 150,
}

const CAMERA_END_Z = 5
const MASSAGE_LAB_LIGHT_SPEED_RENDER_SCALE = 0.1
const TWO_PI = Math.PI * 2

// MassageLab Light Speed uses a WebGL/R3F cylinder of stretched particles. This
// canvas adaptation keeps the same public prop model without adding that stack.
export default function MassageLabLightSpeedBackground({
  className,
  massageLabLightSpeed,
}: BackgroundEffectProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const particleCount = massageLabLightSpeed?.particleCount
  const warpSpeed = massageLabLightSpeed?.warpSpeed
  const lightColor = massageLabLightSpeed?.lightColor
  const intensity = massageLabLightSpeed?.intensity
  const radius = massageLabLightSpeed?.radius
  const cylinderLength = massageLabLightSpeed?.cylinderLength
  const options = useMemo(
    () => resolveLightSpeedOptions({
      particleCount,
      warpSpeed,
      lightColor,
      intensity,
      radius,
      cylinderLength,
    }),
    [cylinderLength, intensity, lightColor, particleCount, radius, warpSpeed],
  )
  const lightRgb = useMemo(() => parseHexColorToRgb(options.lightColor), [options.lightColor])

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current

    if (!container || !canvas) {
      return undefined
    }

    const context = canvas.getContext("2d", { alpha: false })

    if (!context) {
      return undefined
    }

    let disposed = false
    let animationFrame: number | null = null
    let width = 1
    let height = 1
    let lastFrameTime = performance.now()
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const particles = createParticles(options)

    const drawBackground = () => {
      context.globalCompositeOperation = "source-over"
      context.shadowBlur = 0
      context.fillStyle = "#000000"
      context.fillRect(0, 0, width, height)

      const centerGlow = context.createRadialGradient(
        width * 0.5,
        height * 0.5,
        0,
        width * 0.5,
        height * 0.5,
        Math.max(width, height) * 0.58,
      )
      const glowStrength = clampRange(options.intensity / 3, 0.2, 1.8)
      centerGlow.addColorStop(0, `rgba(${lightRgb[0]}, ${lightRgb[1]}, ${lightRgb[2]}, ${0.16 * glowStrength})`)
      centerGlow.addColorStop(0.34, `rgba(${lightRgb[0]}, ${lightRgb[1]}, ${lightRgb[2]}, ${0.06 * glowStrength})`)
      centerGlow.addColorStop(1, "rgba(0, 0, 0, 0)")
      context.fillStyle = centerGlow
      context.fillRect(0, 0, width, height)
    }

    const drawParticles = (elapsedSeconds: number, shouldMove: boolean) => {
      const startZ = -options.cylinderLength / 2
      const renderWarpSpeed = options.warpSpeed * MASSAGE_LAB_LIGHT_SPEED_RENDER_SCALE
      const intensityScale = clampRange(options.intensity / 3, 0.18, 1.85)
      context.globalCompositeOperation = "lighter"
      context.lineCap = "round"

      for (let index = 0; index < particles.length; index += 1) {
        const particle = particles[index]

        if (shouldMove) {
          particle.z += renderWarpSpeed * particle.speedMultiplier * elapsedSeconds * 50
        }

        const head = projectParticle(particle, particle.z, width, height, options)
        const tailDistance = (particle.length * 1.8 + renderWarpSpeed * particle.speedMultiplier * 18)
          * (0.8 + head.progress * 2.4)
        const tail = projectParticle(
          particle,
          Math.max(startZ, particle.z - tailDistance),
          width,
          height,
          options,
        )

        if (!isProjectionNearViewport(head, tail, width, height)) {
          if (shouldMove && particle.z > CAMERA_END_Z) {
            particle.resetCount += 1
            resetParticle(particle, index, options, false)
          }

          continue
        }

        const alpha = clampRange((0.14 + head.progress * 0.82) * intensityScale, 0.08, 0.98)
        const lineWidth = clampRange(0.38 + head.scale * 0.78 * intensityScale, 0.38, 4.2)
        const glow = clampRange(3 + options.intensity * (0.8 + head.progress * 2.4), 2, 28)

        const rayGradient = context.createLinearGradient(tail.x, tail.y, head.x, head.y)
        rayGradient.addColorStop(0, `rgba(${lightRgb[0]}, ${lightRgb[1]}, ${lightRgb[2]}, 0)`)
        rayGradient.addColorStop(0.35, `rgba(${lightRgb[0]}, ${lightRgb[1]}, ${lightRgb[2]}, ${alpha * 0.48})`)
        rayGradient.addColorStop(1, `rgba(${lightRgb[0]}, ${lightRgb[1]}, ${lightRgb[2]}, ${alpha})`)

        context.strokeStyle = rayGradient
        context.shadowColor = `rgba(${lightRgb[0]}, ${lightRgb[1]}, ${lightRgb[2]}, ${Math.min(0.82, alpha)})`
        context.shadowBlur = glow
        context.lineWidth = lineWidth
        context.beginPath()
        context.moveTo(tail.x, tail.y)
        context.lineTo(head.x, head.y)
        context.stroke()
      }

      context.shadowBlur = 0
      context.globalCompositeOperation = "source-over"
    }

    const shouldAnimate = () => shouldAnimateAmbientBackground({
      prefersReducedMotion: motionQuery.matches,
      compactViewport: Math.min(width, height) < 360,
      documentHidden: document.hidden,
      allowCompactViewport: true,
    })

    const drawFrame = (time: number) => {
      if (disposed) {
        return
      }

      const elapsedSeconds = Math.min(0.05, Math.max(0.001, (time - lastFrameTime) * 0.001 || 1 / 60))
      lastFrameTime = time
      const shouldMove = shouldAnimate()

      drawBackground()
      drawParticles(elapsedSeconds, shouldMove)

      if (shouldMove) {
        animationFrame = window.requestAnimationFrame(drawFrame)
      } else {
        animationFrame = null
      }
    }

    const resize = () => {
      const rect = container.getBoundingClientRect()
      width = Math.max(1, Math.floor(rect.width))
      height = Math.max(1, Math.floor(rect.height))
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5)
      canvas.width = Math.max(1, Math.floor(width * pixelRatio))
      canvas.height = Math.max(1, Math.floor(height * pixelRatio))
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
      lastFrameTime = performance.now()
      drawBackground()
      drawParticles(1 / 60, false)
    }

    const restart = () => {
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame)
        animationFrame = null
      }

      lastFrameTime = performance.now()
      drawFrame(lastFrameTime)
    }

    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(container)
    motionQuery.addEventListener("change", restart)
    document.addEventListener("visibilitychange", restart)
    restart()

    return () => {
      disposed = true
      if (animationFrame !== null) {
        window.cancelAnimationFrame(animationFrame)
      }
      observer.disconnect()
      motionQuery.removeEventListener("change", restart)
      document.removeEventListener("visibilitychange", restart)
      canvas.width = 1
      canvas.height = 1
    }
  }, [lightRgb, options])

  return (
    <div
      ref={containerRef}
      className={cn(styles.effectLayer, styles.massageLabLightSpeed, className)}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className={styles.massageLabLightSpeedCanvas} />
    </div>
  )
}

function resolveLightSpeedOptions(options: MassageLabLightSpeedOptions): ResolvedLightSpeedOptions {
  return {
    particleCount: Math.trunc(clampNumber(
      options.particleCount,
      DEFAULT_MASSAGE_LAB_LIGHT_SPEED.particleCount,
      20,
      200,
    )),
    warpSpeed: clampNumber(options.warpSpeed, DEFAULT_MASSAGE_LAB_LIGHT_SPEED.warpSpeed, 0.1, 24),
    lightColor: normalizeHexColor(options.lightColor, DEFAULT_MASSAGE_LAB_LIGHT_SPEED.lightColor),
    intensity: clampNumber(options.intensity, DEFAULT_MASSAGE_LAB_LIGHT_SPEED.intensity, 0.25, 6),
    radius: clampNumber(options.radius, DEFAULT_MASSAGE_LAB_LIGHT_SPEED.radius, 6, 60),
    cylinderLength: clampNumber(options.cylinderLength, DEFAULT_MASSAGE_LAB_LIGHT_SPEED.cylinderLength, 40, 300),
  }
}

function createParticles(options: ResolvedLightSpeedOptions) {
  const particles: LightSpeedParticle[] = []

  for (let index = 0; index < options.particleCount; index += 1) {
    const particle: LightSpeedParticle = {
      angle: 0,
      radius: 0,
      z: 0,
      speedMultiplier: 1,
      length: 1,
      resetCount: 0,
    }
    resetParticle(particle, index, options, true)
    prewarmParticle(particle, index, options)
    particles.push(particle)
  }

  return particles
}

function resetParticle(
  particle: LightSpeedParticle,
  index: number,
  options: ResolvedLightSpeedOptions,
  initial: boolean,
) {
  const seed = index * 193.13 + particle.resetCount * 991.37
  particle.angle = seededFraction(seed + 0.17) * TWO_PI
  particle.radius = 2 + seededFraction(seed + 0.41) * Math.max(0.1, options.radius - 2)
  particle.z = initial
    ? (seededFraction(seed + 0.73) - 0.5) * options.cylinderLength
    : -options.cylinderLength / 2
  particle.speedMultiplier = 0.5 + seededFraction(seed + 0.97) * 0.5
  particle.length = 1 + seededFraction(seed + 1.29) * 2
}

function prewarmParticle(
  particle: LightSpeedParticle,
  index: number,
  options: ResolvedLightSpeedOptions,
) {
  const renderWarpSpeed = options.warpSpeed * MASSAGE_LAB_LIGHT_SPEED_RENDER_SCALE

  for (let step = 0; step < 90; step += 1) {
    particle.z += renderWarpSpeed * particle.speedMultiplier * (1 / 60) * 50
    if (particle.z > CAMERA_END_Z) {
      particle.resetCount += 1
      resetParticle(particle, index, options, false)
    }
  }
}

function projectParticle(
  particle: LightSpeedParticle,
  z: number,
  width: number,
  height: number,
  options: ResolvedLightSpeedOptions,
): LightSpeedProjection {
  const startZ = -options.cylinderLength / 2
  const rawProgress = (z - startZ) / Math.max(1, CAMERA_END_Z - startZ)
  const progress = clampRange(rawProgress, 0, 1)
  const projectionProgress = clampRange(rawProgress, 0, 4)
  const eased = projectionProgress * projectionProgress
  const radiusScale = Math.min(width, height) / Math.max(1, options.radius * 2)
  const spread = 0.12 + eased * 2.35 + projectionProgress * projectionProgress * projectionProgress * 0.8
  const x = width * 0.5 + Math.cos(particle.angle) * particle.radius * radiusScale * spread
  const y = height * 0.5 + Math.sin(particle.angle) * particle.radius * radiusScale * spread

  return {
    x,
    y,
    progress,
    scale: 0.35 + progress * progress * 2.8,
  }
}

function isProjectionNearViewport(
  head: LightSpeedProjection,
  tail: LightSpeedProjection,
  width: number,
  height: number,
) {
  const insetX = width * -0.18
  const insetY = height * -0.18
  const maxX = width * 1.18
  const maxY = height * 1.18

  return (
    (head.x >= insetX && head.x <= maxX && head.y >= insetY && head.y <= maxY)
    || (tail.x >= insetX && tail.x <= maxX && tail.y >= insetY && tail.y <= maxY)
  )
}

function normalizeHexColor(value: string | undefined, fallback: string) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value.toUpperCase() : fallback
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback
}

function clampRange(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
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
