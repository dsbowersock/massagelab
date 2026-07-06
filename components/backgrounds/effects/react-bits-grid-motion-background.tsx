"use client"

import { useEffect, useMemo, useRef, type CSSProperties } from "react"
import { shouldAnimateAmbientBackground } from "@/lib/motion-preferences"
import { cn } from "@/lib/utils"
import styles from "@/components/backgrounds/BackgroundHost.module.css"
import type { BackgroundEffectProps, ReactBitsGridMotionOptions } from "./css-backgrounds"

type ResolvedGridMotionOptions = Required<ReactBitsGridMotionOptions>

const DEFAULT_REACT_BITS_GRID_MOTION: ResolvedGridMotionOptions = {
  gradientColor: "#000000",
  tileColor: "#111111",
  textColor: "#F8FAFC",
  maxMoveAmount: 300,
  baseDuration: 0.8,
  cursorInteraction: true,
}

const DEFAULT_ITEMS = [
  "focus",
  "breathe",
  "release",
  "restore",
  "quiet",
  "flow",
  "center",
  "pause",
  "warmth",
  "balance",
  "calm",
  "depth",
  "soft",
  "reset",
  "ease",
  "length",
  "still",
  "drift",
  "glow",
  "space",
  "slow",
  "ground",
  "unwind",
  "exhale",
  "open",
  "settle",
  "melt",
  "rest",
]

// React Bits Grid Motion uses GSAP to slide four rows from cursor X. This
// keeps the same row layout and inertia feel with local RAF smoothing.
export default function ReactBitsGridMotionBackground({
  className,
  reactBitsGridMotion,
}: BackgroundEffectProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const rowRefs = useRef<Array<HTMLDivElement | null>>([])
  const mouseXRef = useRef(0.5)
  const currentOffsetsRef = useRef([0, 0, 0, 0])
  const options = useMemo(
    () => resolveGridMotionOptions(reactBitsGridMotion),
    [
      reactBitsGridMotion?.gradientColor,
      reactBitsGridMotion?.tileColor,
      reactBitsGridMotion?.textColor,
      reactBitsGridMotion?.maxMoveAmount,
      reactBitsGridMotion?.baseDuration,
      reactBitsGridMotion?.cursorInteraction,
    ],
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return undefined
    }

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const compactViewportQuery = window.matchMedia("(max-width: 360px), (max-height: 360px)")
    const inertiaFactors = [0.6, 0.4, 0.3, 0.2]
    let animationFrame = 0
    let disposed = false

    const shouldAnimate = () => shouldAnimateAmbientBackground({
      prefersReducedMotion: reducedMotionQuery.matches,
      compactViewport: compactViewportQuery.matches,
      documentHidden: document.visibilityState !== "visible",
    })

    const handlePointerMove = (event: PointerEvent) => {
      if (!options.cursorInteraction) {
        return
      }

      const bounds = container.getBoundingClientRect()
      mouseXRef.current = Math.min(1, Math.max(0, (event.clientX - bounds.left) / Math.max(bounds.width, 1)))
    }

    const updateMotion = () => {
      const animate = shouldAnimate()
      rowRefs.current.forEach((row, index) => {
        if (!row) {
          return
        }

        const direction = index % 2 === 0 ? 1 : -1
        const target = ((mouseXRef.current * options.maxMoveAmount) - options.maxMoveAmount / 2) * direction
        const duration = options.baseDuration + inertiaFactors[index % inertiaFactors.length]
        const smoothing = animate ? Math.min(0.32, 1 / Math.max(8, duration * 60)) : 1
        currentOffsetsRef.current[index] += (target - currentOffsetsRef.current[index]) * smoothing
        row.style.transform = `translate3d(${currentOffsetsRef.current[index].toFixed(2)}px, 0, 0)`
      })

      if (animate && !disposed) {
        animationFrame = window.requestAnimationFrame(updateMotion)
      }
    }

    const render = () => {
      window.cancelAnimationFrame(animationFrame)
      updateMotion()
    }

    if (options.cursorInteraction) {
      window.addEventListener("pointermove", handlePointerMove, { passive: true })
    }
    document.addEventListener("visibilitychange", render)
    reducedMotionQuery.addEventListener("change", render)
    compactViewportQuery.addEventListener("change", render)
    render()

    return () => {
      disposed = true
      window.cancelAnimationFrame(animationFrame)
      window.removeEventListener("pointermove", handlePointerMove)
      document.removeEventListener("visibilitychange", render)
      reducedMotionQuery.removeEventListener("change", render)
      compactViewportQuery.removeEventListener("change", render)
      rowRefs.current = []
    }
  }, [options])

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={cn(styles.reactBitsGridMotion, className)}
      style={{
        "--react-bits-grid-motion-gradient": options.gradientColor,
        "--react-bits-grid-motion-tile": options.tileColor,
        "--react-bits-grid-motion-text": options.textColor,
      } as CSSProperties}
    >
      <section className={styles.reactBitsGridMotionIntro}>
        <div className={styles.reactBitsGridMotionContainer}>
          {Array.from({ length: 4 }).map((_, rowIndex) => (
            <div
              className={styles.reactBitsGridMotionRow}
              key={rowIndex}
              ref={(node) => {
                rowRefs.current[rowIndex] = node
              }}
            >
              {Array.from({ length: 7 }).map((__, itemIndex) => {
                const item = DEFAULT_ITEMS[rowIndex * 7 + itemIndex] ?? ""
                return (
                  <div className={styles.reactBitsGridMotionItem} key={item}>
                    <div className={styles.reactBitsGridMotionItemInner}>
                      <span>{item}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function resolveGridMotionOptions(options?: ReactBitsGridMotionOptions): ResolvedGridMotionOptions {
  return {
    gradientColor: resolveHex(options?.gradientColor, DEFAULT_REACT_BITS_GRID_MOTION.gradientColor),
    tileColor: resolveHex(options?.tileColor, DEFAULT_REACT_BITS_GRID_MOTION.tileColor),
    textColor: resolveHex(options?.textColor, DEFAULT_REACT_BITS_GRID_MOTION.textColor),
    maxMoveAmount: resolveNumber(options?.maxMoveAmount, DEFAULT_REACT_BITS_GRID_MOTION.maxMoveAmount, 0, 600),
    baseDuration: resolveNumber(options?.baseDuration, DEFAULT_REACT_BITS_GRID_MOTION.baseDuration, 0.1, 2),
    cursorInteraction: options?.cursorInteraction ?? DEFAULT_REACT_BITS_GRID_MOTION.cursorInteraction,
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
