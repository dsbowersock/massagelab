"use client"

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react"
import { normalizeGridMotionMantras } from "@/lib/grid-motion-mantras"
import { shouldAnimateAmbientBackground } from "@/lib/motion-preferences"
import { cn } from "@/lib/utils"
import styles from "@/components/backgrounds/BackgroundHost.module.css"
import type { BackgroundEffectProps, MassageLabGridMotionOptions } from "./css-backgrounds"

type ResolvedGridMotionOptions = Required<Omit<MassageLabGridMotionOptions, "mantras">> & {
  mantras: string[]
}

const DEFAULT_MASSAGELAB_GRID_MOTION: Omit<ResolvedGridMotionOptions, "mantras"> = {
  gradientColor: "#000000",
  tileColor: "#111111",
  textColor: "#F8FAFC",
  maxMoveAmount: 300,
  baseDuration: 0.8,
  cursorInteraction: true,
}

/** Returns enough rows to overfill a rotated phone viewport without over-rendering. */
export function resolveGridMotionRowCount(height: number): number {
  return Math.min(14, Math.max(6, Math.ceil(height / 76) + 1))
}

// Grid Motion keeps the original alternating-row inertia while adding a slow,
// continuous ambient drift so pointer input remains an optional enhancement.
export default function MassageLabGridMotionBackground({
  className,
  massageLabGridMotion,
}: BackgroundEffectProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const rowRefs = useRef<Array<HTMLDivElement | null>>([])
  const mouseXRef = useRef(0.5)
  const currentOffsetsRef = useRef<number[]>(Array.from({ length: 6 }, () => 0))
  const [rowCount, setRowCount] = useState(6)
  const {
    gradientColor,
    tileColor,
    textColor,
    maxMoveAmount,
    baseDuration,
    cursorInteraction,
    mantras: requestedMantras,
  } = massageLabGridMotion ?? {}
  const mantraDependency = Array.isArray(requestedMantras)
    ? requestedMantras.join("\u0000")
    : null
  const options = useMemo(
    () => resolveGridMotionOptions({
      gradientColor,
      tileColor,
      textColor,
      maxMoveAmount,
      baseDuration,
      cursorInteraction,
      mantras: mantraDependency?.split("\u0000"),
    }),
    [
      baseDuration,
      cursorInteraction,
      gradientColor,
      mantraDependency,
      maxMoveAmount,
      textColor,
      tileColor,
    ],
  )
  const { mantras } = options

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return undefined
    }

    const publishRowCount = (height: number) => {
      const nextRowCount = resolveGridMotionRowCount(height)
      currentOffsetsRef.current = Array.from(
        { length: nextRowCount },
        (_, index) => currentOffsetsRef.current[index] ?? 0,
      )
      rowRefs.current.length = nextRowCount
      setRowCount((currentRowCount) => (
        currentRowCount === nextRowCount ? currentRowCount : nextRowCount
      ))
    }

    publishRowCount(container.getBoundingClientRect().height)
    if (typeof ResizeObserver === "undefined") {
      return undefined
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        publishRowCount(entry.contentRect.height)
      }
    })
    observer.observe(container)

    return () => {
      observer.disconnect()
    }
  }, [])

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
    let startTimestamp: number | null = null

    const shouldAnimate = () => shouldAnimateAmbientBackground({
      prefersReducedMotion: reducedMotionQuery.matches,
      compactViewport: compactViewportQuery.matches,
      documentHidden: document.visibilityState !== "visible",
      allowCompactViewport: true,
      respectSystemReducedMotion: true,
    })

    const handlePointerMove = (event: PointerEvent) => {
      if (!options.cursorInteraction) {
        return
      }

      const bounds = container.getBoundingClientRect()
      mouseXRef.current = Math.min(1, Math.max(0, (event.clientX - bounds.left) / Math.max(bounds.width, 1)))
    }

    const updateMotion = (timestamp: number) => {
      const animate = shouldAnimate()
      startTimestamp ??= timestamp
      const elapsedSeconds = animate
        ? (timestamp - startTimestamp) / 1_000
        : 0

      rowRefs.current.forEach((row, index) => {
        if (!row) {
          return
        }

        const direction = index % 2 === 0 ? 1 : -1
        const ambientPhase = elapsedSeconds * 0.32 + index * 0.58
        const ambientTarget = Math.sin(ambientPhase) * options.maxMoveAmount * 0.34 * direction
        const pointerTarget = options.cursorInteraction
          ? (mouseXRef.current - 0.5) * options.maxMoveAmount * 0.66 * direction
          : 0
        const target = ambientTarget + pointerTarget
        const duration = options.baseDuration + inertiaFactors[index % inertiaFactors.length]
        if (animate) {
          const smoothing = Math.min(0.32, 1 / Math.max(8, duration * 60))
          currentOffsetsRef.current[index] += (target - currentOffsetsRef.current[index]) * smoothing
        } else {
          currentOffsetsRef.current[index] = target
        }
        row.style.transform = `translate3d(${currentOffsetsRef.current[index].toFixed(2)}px, 0, 0)`
      })

      if (animate && !disposed) {
        animationFrame = window.requestAnimationFrame(updateMotion)
      }
    }

    const render = () => {
      window.cancelAnimationFrame(animationFrame)
      startTimestamp = null
      updateMotion(window.performance.now())
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
    }
  }, [options, rowCount])

  return (
    <div
      ref={containerRef}
      aria-hidden="true"
      className={cn(styles.massageLabGridMotion, className)}
      style={{
        "--massage-lab-grid-motion-gradient": options.gradientColor,
        "--massage-lab-grid-motion-tile": options.tileColor,
        "--massage-lab-grid-motion-text": options.textColor,
      } as CSSProperties}
    >
      <section className={styles.massageLabGridMotionIntro}>
        <div className={styles.massageLabGridMotionContainer}>
          {Array.from({ length: rowCount }).map((_, rowIndex) => (
            <div
              className={styles.massageLabGridMotionRow}
              key={rowIndex}
              ref={(node) => {
                rowRefs.current[rowIndex] = node
              }}
            >
              {Array.from({ length: 7 }).map((__, itemIndex) => {
                const text = mantras[(rowIndex * 7 + itemIndex) % mantras.length]
                return (
                  <div
                    className={styles.massageLabGridMotionItem}
                    key={`${rowIndex}-${itemIndex}-${text}`}
                  >
                    <div className={styles.massageLabGridMotionItemInner}>
                      <span>{text}</span>
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

function resolveGridMotionOptions(options?: MassageLabGridMotionOptions): ResolvedGridMotionOptions {
  return {
    gradientColor: resolveHex(options?.gradientColor, DEFAULT_MASSAGELAB_GRID_MOTION.gradientColor),
    tileColor: resolveHex(options?.tileColor, DEFAULT_MASSAGELAB_GRID_MOTION.tileColor),
    textColor: resolveHex(options?.textColor, DEFAULT_MASSAGELAB_GRID_MOTION.textColor),
    maxMoveAmount: resolveNumber(options?.maxMoveAmount, DEFAULT_MASSAGELAB_GRID_MOTION.maxMoveAmount, 0, 600),
    baseDuration: resolveNumber(options?.baseDuration, DEFAULT_MASSAGELAB_GRID_MOTION.baseDuration, 0.1, 2),
    cursorInteraction: options?.cursorInteraction ?? DEFAULT_MASSAGELAB_GRID_MOTION.cursorInteraction,
    mantras: normalizeGridMotionMantras(options?.mantras),
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
