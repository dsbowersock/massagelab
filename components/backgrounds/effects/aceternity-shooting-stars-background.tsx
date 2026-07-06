"use client"

import { type CSSProperties, useEffect, useId, useRef, useState } from "react"
import { shouldAnimateAmbientBackground } from "@/lib/motion-preferences"
import { cn } from "@/lib/utils"
import styles from "@/components/backgrounds/BackgroundHost.module.css"
import type { BackgroundEffectProps, ShootingStarsBackgroundOptions } from "./css-backgrounds"

type BackgroundStar = {
  x: number
  y: number
  radius: number
  opacity: number
  twinkleSpeed: number
  delay: number
}

type ShootingStarSequence = {
  side: 0 | 1 | 2 | 3
  offset: number
  speed: number
  delay: number
}

type ActiveShootingStar = {
  x: number
  y: number
  angle: number
  speed: number
  distance: number
  scale: number
}

const STAR_DENSITY = 0.00015
const MAX_STARS = 420
const SHOOTING_STAR_WIDTH = 10
const SHOOTING_STAR_HEIGHT = 1.5
const SHOOTING_STAR_BUFFER = 36
const DEFAULT_SHOOTING_STARS: Required<ShootingStarsBackgroundOptions> = {
  starColor: "#FFFFFF",
  trailColor: "#B4F2FF",
  shootingStarColor: "#48DCF9",
  starDensity: STAR_DENSITY,
  twinkle: true,
  twinkleSpeed: 1,
  shootingStarSpeed: 1,
  shootingStarFrequency: 1,
}

const shootingStarSequence: readonly ShootingStarSequence[] = [
  { side: 0, offset: 0.16, speed: 14, delay: 1200 },
  { side: 3, offset: 0.34, speed: 18, delay: 2800 },
  { side: 0, offset: 0.72, speed: 12, delay: 4200 },
  { side: 1, offset: 0.28, speed: 21, delay: 2200 },
  { side: 2, offset: 0.82, speed: 16, delay: 3600 },
  { side: 0, offset: 0.46, speed: 24, delay: 1800 },
  { side: 3, offset: 0.68, speed: 13, delay: 4000 },
  { side: 1, offset: 0.62, speed: 19, delay: 2600 },
]

function deterministicRandom(index: number, salt: number) {
  const value = Math.sin(index * 12.9898 + salt * 78.233) * 43758.5453
  return value - Math.floor(value)
}

function generateStars(width: number, height: number, starDensity: number) {
  const starCount = Math.min(MAX_STARS, Math.max(24, Math.floor(width * height * starDensity)))

  return Array.from({ length: starCount }, (_, index) => ({
    x: deterministicRandom(index, 1) * width,
    y: deterministicRandom(index, 2) * height,
    radius: deterministicRandom(index, 3) * 0.05 + 0.5,
    opacity: deterministicRandom(index, 4) * 0.5 + 0.5,
    twinkleSpeed: deterministicRandom(index, 5) * 0.5 + 0.5,
    delay: deterministicRandom(index, 6) * -1,
  }))
}

function createShootingStar(
  sequence: ShootingStarSequence,
  width: number,
  height: number,
  speedMultiplier: number,
): ActiveShootingStar {
  switch (sequence.side) {
    case 0:
      return { x: sequence.offset * width, y: 0, angle: 45, speed: sequence.speed * speedMultiplier, distance: 0, scale: 1 }
    case 1:
      return { x: width, y: sequence.offset * height, angle: 135, speed: sequence.speed * speedMultiplier, distance: 0, scale: 1 }
    case 2:
      return { x: sequence.offset * width, y: height, angle: 225, speed: sequence.speed * speedMultiplier, distance: 0, scale: 1 }
    case 3:
      return { x: 0, y: sequence.offset * height, angle: 315, speed: sequence.speed * speedMultiplier, distance: 0, scale: 1 }
  }
}

function isOutOfBounds(star: ActiveShootingStar, width: number, height: number) {
  return (
    star.x < -SHOOTING_STAR_BUFFER ||
    star.x > width + SHOOTING_STAR_BUFFER ||
    star.y < -SHOOTING_STAR_BUFFER ||
    star.y > height + SHOOTING_STAR_BUFFER
  )
}

// Aceternity UI Shooting Stars and Stars Background, adapted as an internal MassageLab premium visual effect.
export default function AceternityShootingStarsBackground({ className, shootingStars }: BackgroundEffectProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const shootingStarRef = useRef<SVGRectElement>(null)
  const [stars, setStars] = useState<BackgroundStar[]>([])
  const generatedId = useId()
  const gradientId = `ml-shooting-star-gradient-${generatedId.replace(/[^a-zA-Z0-9_-]/g, "")}`
  const resolved = resolveShootingStarsOptions(shootingStars)

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    let resizeFrame = 0

    const updateStars = () => {
      const { width, height } = container.getBoundingClientRect()
      if (width < 32 || height < 32) {
        return
      }

      setStars(generateStars(width, height, resolved.starDensity))
    }

    const scheduleUpdate = () => {
      if (resizeFrame) {
        return
      }

      resizeFrame = window.requestAnimationFrame(() => {
        resizeFrame = 0
        updateStars()
      })
    }

    const resizeObserver = new ResizeObserver(scheduleUpdate)
    resizeObserver.observe(container)
    updateStars()

    return () => {
      if (resizeFrame) {
        window.cancelAnimationFrame(resizeFrame)
      }

      resizeObserver.disconnect()
    }
  }, [resolved.starDensity])

  useEffect(() => {
    const container = containerRef.current
    const shootingStar = shootingStarRef.current
    if (!container || !shootingStar) {
      return
    }

    const containerElement = container
    const shootingStarElement = shootingStar
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const compactViewportQuery = window.matchMedia("(max-width: 560px)")
    let shouldRun = false
    let activeStar: ActiveShootingStar | null = null
    let sequenceIndex = 0
    let animationFrame = 0
    let timeoutId = 0

    const clearScheduledWork = () => {
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame)
        animationFrame = 0
      }

      if (timeoutId) {
        window.clearTimeout(timeoutId)
        timeoutId = 0
      }
    }

    const hideShootingStar = () => {
      shootingStarElement.style.opacity = "0"
      shootingStarElement.setAttribute("width", "0")
    }

    const renderShootingStar = (star: ActiveShootingStar) => {
      const width = SHOOTING_STAR_WIDTH * star.scale
      const centerX = star.x + width / 2
      const centerY = star.y + SHOOTING_STAR_HEIGHT / 2

      shootingStarElement.setAttribute("x", star.x.toFixed(2))
      shootingStarElement.setAttribute("y", star.y.toFixed(2))
      shootingStarElement.setAttribute("width", width.toFixed(2))
      shootingStarElement.setAttribute("height", String(SHOOTING_STAR_HEIGHT))
      shootingStarElement.setAttribute("transform", `rotate(${star.angle}, ${centerX.toFixed(2)}, ${centerY.toFixed(2)})`)
      shootingStarElement.style.opacity = "1"
    }

    const scheduleNextStar = (delay: number) => {
      timeoutId = window.setTimeout(() => {
        timeoutId = 0
        spawnShootingStar()
      }, delay)
    }

    const moveShootingStar = () => {
      if (!shouldRun || !activeStar) {
        return
      }

      const { width, height } = containerElement.getBoundingClientRect()
      if (width < 32 || height < 32) {
        activeStar = null
        hideShootingStar()
        scheduleNextStar(400)
        return
      }

      const angleInRadians = (activeStar.angle * Math.PI) / 180
      const nextDistance = activeStar.distance + activeStar.speed
      activeStar = {
        ...activeStar,
        x: activeStar.x + activeStar.speed * Math.cos(angleInRadians),
        y: activeStar.y + activeStar.speed * Math.sin(angleInRadians),
        distance: nextDistance,
        scale: 1 + nextDistance / 100,
      }

      if (isOutOfBounds(activeStar, width, height)) {
        const completedSequence = shootingStarSequence[(sequenceIndex - 1 + shootingStarSequence.length) % shootingStarSequence.length]
        activeStar = null
        hideShootingStar()
        scheduleNextStar(completedSequence.delay / resolved.shootingStarFrequency)
        return
      }

      renderShootingStar(activeStar)
      animationFrame = window.requestAnimationFrame(moveShootingStar)
    }

    function spawnShootingStar() {
      if (!shouldRun) {
        return
      }

      const { width, height } = containerElement.getBoundingClientRect()
      if (width < 32 || height < 32) {
        scheduleNextStar(400)
        return
      }

      const sequence = shootingStarSequence[sequenceIndex % shootingStarSequence.length]
      sequenceIndex += 1
      activeStar = createShootingStar(sequence, width, height, resolved.shootingStarSpeed)
      renderShootingStar(activeStar)
      animationFrame = window.requestAnimationFrame(moveShootingStar)
    }

    const stopAnimation = () => {
      shouldRun = false
      activeStar = null
      clearScheduledWork()
      hideShootingStar()
    }

    const startAnimation = () => {
      if (shouldRun) {
        return
      }

      shouldRun = true
      hideShootingStar()
      scheduleNextStar(600 / resolved.shootingStarFrequency)
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
  }, [resolved.shootingStarFrequency, resolved.shootingStarSpeed])

  return (
    <div ref={containerRef} className={cn(styles.effectLayer, styles.aceternityShootingStars, className)} aria-hidden="true">
      <svg className={styles.shootingStarsBackgroundSvg} preserveAspectRatio="none" focusable="false">
        <rect width="100%" height="100%" fill="none" />
        {stars.map((star, index) => (
          <circle
            key={index}
            className={cn(styles.shootingStarsBackgroundStar, !resolved.twinkle && styles.shootingStarsBackgroundStarStatic)}
            cx={star.x}
            cy={star.y}
            r={star.radius}
            fill={resolved.starColor}
            style={
              {
                "--ml-shooting-background-star-delay": `${star.delay}s`,
                "--ml-shooting-background-star-opacity": star.opacity,
                "--ml-shooting-background-star-speed": `${star.twinkleSpeed / resolved.twinkleSpeed}s`,
              } as CSSProperties
            }
          />
        ))}
      </svg>
      <svg className={styles.shootingStarsSvg} preserveAspectRatio="none" focusable="false">
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor={resolved.trailColor} stopOpacity="0" />
            <stop offset="100%" stopColor={resolved.shootingStarColor} stopOpacity="1" />
          </linearGradient>
        </defs>
        <rect ref={shootingStarRef} className={styles.shootingStarTrail} fill={`url(#${gradientId})`} />
      </svg>
    </div>
  )
}

function resolveShootingStarsOptions(
  shootingStars: ShootingStarsBackgroundOptions | undefined,
): Required<ShootingStarsBackgroundOptions> {
  return {
    starColor: normalizeColor(shootingStars?.starColor, DEFAULT_SHOOTING_STARS.starColor),
    trailColor: normalizeColor(shootingStars?.trailColor, DEFAULT_SHOOTING_STARS.trailColor),
    shootingStarColor: normalizeColor(shootingStars?.shootingStarColor, DEFAULT_SHOOTING_STARS.shootingStarColor),
    starDensity: clamp(
      Number(shootingStars?.starDensity),
      DEFAULT_SHOOTING_STARS.starDensity,
      0.00005,
      0.00035,
    ),
    twinkle: typeof shootingStars?.twinkle === "boolean" ? shootingStars.twinkle : DEFAULT_SHOOTING_STARS.twinkle,
    twinkleSpeed: clamp(Number(shootingStars?.twinkleSpeed), DEFAULT_SHOOTING_STARS.twinkleSpeed, 0.4, 2.5),
    shootingStarSpeed: clamp(
      Number(shootingStars?.shootingStarSpeed),
      DEFAULT_SHOOTING_STARS.shootingStarSpeed,
      0.5,
      2,
    ),
    shootingStarFrequency: clamp(
      Number(shootingStars?.shootingStarFrequency),
      DEFAULT_SHOOTING_STARS.shootingStarFrequency,
      0.4,
      2,
    ),
  }
}

function normalizeColor(value: string | undefined, fallback: string) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value.toUpperCase() : fallback
}

function clamp(value: number, fallback: number, min: number, max: number) {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback
}
