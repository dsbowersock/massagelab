"use client"

import { useEffect, useMemo, useRef } from "react"
import { createNoise3D } from "simplex-noise"
import { shouldAnimateAmbientBackground } from "@/lib/motion-preferences"
import { cn } from "@/lib/utils"
import styles from "@/components/backgrounds/BackgroundHost.module.css"
import type { BackgroundEffectProps, VortexBackgroundOptions } from "./css-backgrounds"

const DEFAULT_VORTEX: Required<VortexBackgroundOptions> = {
  particleCount: 420,
  rangeY: 120,
  baseHue: 220,
  baseSpeed: 0,
  rangeSpeed: 1.2,
  baseRadius: 1,
  rangeRadius: 2,
  backgroundColor: "#000000",
}

const PARTICLE_PROP_COUNT = 9
const BASE_TTL = 50
const RANGE_TTL = 150
const RANGE_HUE = 100
const NOISE_STEPS = 3
const X_OFFSET = 0.00125
const Y_OFFSET = 0.00125
const Z_OFFSET = 0.0005
const TAU = Math.PI * 2

// MassageLab Vortex by Manu Arora, adapted as an internal MassageLab premium visual effect.
export default function MassageLabVortexBackground({ className, vortex }: BackgroundEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const vortexParticleCount = vortex?.particleCount
  const vortexRangeY = vortex?.rangeY
  const vortexBaseHue = vortex?.baseHue
  const vortexBaseSpeed = vortex?.baseSpeed
  const vortexRangeSpeed = vortex?.rangeSpeed
  const vortexBaseRadius = vortex?.baseRadius
  const vortexRangeRadius = vortex?.rangeRadius
  const vortexBackgroundColor = vortex?.backgroundColor
  const resolved = useMemo(
    () =>
      resolveVortexOptions({
        particleCount: vortexParticleCount,
        rangeY: vortexRangeY,
        baseHue: vortexBaseHue,
        baseSpeed: vortexBaseSpeed,
        rangeSpeed: vortexRangeSpeed,
        baseRadius: vortexBaseRadius,
        rangeRadius: vortexRangeRadius,
        backgroundColor: vortexBackgroundColor,
      }),
    [
      vortexBackgroundColor,
      vortexBaseHue,
      vortexBaseRadius,
      vortexBaseSpeed,
      vortexParticleCount,
      vortexRangeRadius,
      vortexRangeSpeed,
      vortexRangeY,
    ],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext("2d")
    const container = canvas?.parentElement

    if (!canvas || !context || !container) {
      return undefined
    }

    const noise = createNoise3D()
    const particlePropsLength = resolved.particleCount * PARTICLE_PROP_COUNT
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const compactViewportQuery = window.matchMedia("(max-width: 767px)")
    let animationFrame = 0
    let resizeFrame = 0
    let canvasWidth = 0
    let canvasHeight = 0
    let pixelRatio = 1
    let centerY = 0
    let tick = 0
    let shouldRun = false
    let particleProps = new Float32Array(particlePropsLength)

    const rand = (value: number) => value * Math.random()
    const randRange = (value: number) => value - rand(2 * value)
    const lerp = (start: number, end: number, amount: number) => (1 - amount) * start + amount * end
    const fadeInOut = (time: number, max: number) => {
      const halfMax = 0.5 * max
      return Math.abs(((time + halfMax) % max) - halfMax) / halfMax
    }

    const measureCanvasArea = () => {
      const containerRect = container.getBoundingClientRect()
      const viewportWidth = window.visualViewport?.width ?? window.innerWidth
      const viewportHeight = window.visualViewport?.height ?? window.innerHeight

      return {
        width: Math.max(1, Math.floor(containerRect.width || viewportWidth)),
        height: Math.max(1, Math.floor(containerRect.height || viewportHeight)),
      }
    }

    const initParticle = (index: number) => {
      const x = rand(canvasWidth)
      const y = centerY + randRange(resolved.rangeY * pixelRatio)
      const ttl = BASE_TTL + rand(RANGE_TTL)
      const speed = resolved.baseSpeed + rand(resolved.rangeSpeed)
      const radius = resolved.baseRadius + rand(resolved.rangeRadius)
      const hue = resolved.baseHue + rand(RANGE_HUE)

      particleProps.set([x, y, 0, 0, 0, ttl, speed, radius, hue], index)
    }

    const initParticles = () => {
      tick = 0
      particleProps = new Float32Array(particlePropsLength)

      for (let index = 0; index < particlePropsLength; index += PARTICLE_PROP_COUNT) {
        initParticle(index)
      }
    }

    const resizeCanvas = () => {
      const { width, height } = measureCanvasArea()
      const nextPixelRatio = Math.min(Math.max(window.devicePixelRatio || 1, 1), 1.5)
      const nextWidth = Math.floor(width * nextPixelRatio)
      const nextHeight = Math.floor(height * nextPixelRatio)

      if (canvasWidth === nextWidth && canvasHeight === nextHeight && pixelRatio === nextPixelRatio) {
        return
      }

      canvasWidth = nextWidth
      canvasHeight = nextHeight
      pixelRatio = nextPixelRatio
      centerY = canvasHeight * 0.5
      canvas.width = canvasWidth
      canvas.height = canvasHeight
      initParticles()
    }

    const checkBounds = (x: number, y: number) => x > canvasWidth || x < 0 || y > canvasHeight || y < 0

    const drawParticle = (
      x: number,
      y: number,
      x2: number,
      y2: number,
      life: number,
      ttl: number,
      radius: number,
      hue: number,
    ) => {
      context.save()
      context.lineCap = "round"
      context.lineWidth = Math.max(0.5, radius * pixelRatio)
      context.strokeStyle = `hsla(${hue},100%,60%,${fadeInOut(life, ttl)})`
      context.beginPath()
      context.moveTo(x, y)
      context.lineTo(x2, y2)
      context.stroke()
      context.closePath()
      context.restore()
    }

    const updateParticle = (index: number) => {
      const yIndex = index + 1
      const vxIndex = index + 2
      const vyIndex = index + 3
      const lifeIndex = index + 4
      const ttlIndex = index + 5
      const speedIndex = index + 6
      const radiusIndex = index + 7
      const hueIndex = index + 8
      const x = particleProps[index]
      const y = particleProps[yIndex]
      const noiseAngle = noise(x * X_OFFSET, y * Y_OFFSET, tick * Z_OFFSET) * NOISE_STEPS * TAU
      const vx = lerp(particleProps[vxIndex], Math.cos(noiseAngle), 0.5)
      const vy = lerp(particleProps[vyIndex], Math.sin(noiseAngle), 0.5)
      const life = particleProps[lifeIndex]
      const ttl = particleProps[ttlIndex]
      const speed = particleProps[speedIndex]
      const x2 = x + vx * speed * pixelRatio
      const y2 = y + vy * speed * pixelRatio
      const radius = particleProps[radiusIndex]
      const hue = particleProps[hueIndex]

      drawParticle(x, y, x2, y2, life, ttl, radius, hue)

      particleProps[index] = x2
      particleProps[yIndex] = y2
      particleProps[vxIndex] = vx
      particleProps[vyIndex] = vy
      particleProps[lifeIndex] = life + 1

      if (checkBounds(x, y) || life > ttl) {
        initParticle(index)
      }
    }

    const drawParticles = () => {
      for (let index = 0; index < particlePropsLength; index += PARTICLE_PROP_COUNT) {
        updateParticle(index)
      }
    }

    const renderGlow = () => {
      context.save()
      context.filter = "blur(8px) brightness(190%)"
      context.globalCompositeOperation = "lighter"
      context.drawImage(canvas, 0, 0, canvasWidth, canvasHeight)
      context.restore()

      context.save()
      context.filter = "blur(4px) brightness(180%)"
      context.globalCompositeOperation = "lighter"
      context.drawImage(canvas, 0, 0, canvasWidth, canvasHeight)
      context.restore()
    }

    const render = () => {
      if (!shouldRun) {
        return
      }

      tick += 1
      resizeCanvas()
      context.clearRect(0, 0, canvasWidth, canvasHeight)
      context.fillStyle = resolved.backgroundColor
      context.fillRect(0, 0, canvasWidth, canvasHeight)
      drawParticles()
      renderGlow()
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
    resolved.backgroundColor,
    resolved.baseHue,
    resolved.baseRadius,
    resolved.baseSpeed,
    resolved.particleCount,
    resolved.rangeRadius,
    resolved.rangeSpeed,
    resolved.rangeY,
  ])

  return (
    <div className={cn(styles.effectLayer, styles.massageLabVortexBackground, className)} aria-hidden="true">
      <canvas ref={canvasRef} className={styles.vortexCanvas} />
    </div>
  )
}

function resolveVortexOptions(vortex: VortexBackgroundOptions | undefined): Required<VortexBackgroundOptions> {
  return {
    particleCount: clampInteger(vortex?.particleCount, DEFAULT_VORTEX.particleCount, 120, 700),
    rangeY: clampNumber(vortex?.rangeY, DEFAULT_VORTEX.rangeY, 40, 220),
    baseHue: clampNumber(vortex?.baseHue, DEFAULT_VORTEX.baseHue, 0, 360),
    baseSpeed: clampNumber(vortex?.baseSpeed, DEFAULT_VORTEX.baseSpeed, 0, 1),
    rangeSpeed: clampNumber(vortex?.rangeSpeed, DEFAULT_VORTEX.rangeSpeed, 0.2, 2),
    baseRadius: clampNumber(vortex?.baseRadius, DEFAULT_VORTEX.baseRadius, 0.5, 2.5),
    rangeRadius: clampNumber(vortex?.rangeRadius, DEFAULT_VORTEX.rangeRadius, 0.5, 4),
    backgroundColor: normalizeHexColor(vortex?.backgroundColor, DEFAULT_VORTEX.backgroundColor),
  }
}

function normalizeHexColor(value: string | undefined, fallback: string) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value.toUpperCase() : fallback
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback
}

function clampInteger(value: unknown, fallback: number, min: number, max: number) {
  return Math.trunc(clampNumber(value, fallback, min, max))
}
