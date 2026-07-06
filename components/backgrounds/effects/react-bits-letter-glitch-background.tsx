"use client"

import { useEffect, useMemo, useRef } from "react"
import { shouldAnimateAmbientBackground } from "@/lib/motion-preferences"
import { cn } from "@/lib/utils"
import styles from "@/components/backgrounds/BackgroundHost.module.css"
import type { BackgroundEffectProps, ReactBitsLetterGlitchOptions } from "./css-backgrounds"

type LetterCell = {
  char: string
  color: string
  targetColor: string
  colorProgress: number
}

type ResolvedLetterGlitchOptions = Required<ReactBitsLetterGlitchOptions>

const DEFAULT_CHARACTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ!@#$&*()-_+=/[]{};:<>.,0123456789"
const DEFAULT_REACT_BITS_LETTER_GLITCH: ResolvedLetterGlitchOptions = {
  colorOne: "#2B4539",
  colorTwo: "#61DCA3",
  colorThree: "#61B3DC",
  glitchSpeed: 50,
  centerVignette: false,
  outerVignette: true,
  smooth: true,
  characters: DEFAULT_CHARACTERS,
}

const FONT_SIZE = 16
const CHAR_WIDTH = 10
const CHAR_HEIGHT = 20

// React Bits Letter Glitch is a canvas character grid. MassageLab keeps the
// source grid, color interpolation, vignettes, and update cadence with cleanup.
export default function ReactBitsLetterGlitchBackground({
  className,
  reactBitsLetterGlitch,
}: BackgroundEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const lettersRef = useRef<LetterCell[]>([])
  const gridRef = useRef({ columns: 0, rows: 0 })
  const seedRef = useRef(1)
  const options = useMemo(
    () => resolveLetterGlitchOptions(reactBitsLetterGlitch),
    [
      reactBitsLetterGlitch?.colorOne,
      reactBitsLetterGlitch?.colorTwo,
      reactBitsLetterGlitch?.colorThree,
      reactBitsLetterGlitch?.glitchSpeed,
      reactBitsLetterGlitch?.centerVignette,
      reactBitsLetterGlitch?.outerVignette,
      reactBitsLetterGlitch?.smooth,
      reactBitsLetterGlitch?.characters,
    ],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext("2d", { alpha: true })

    if (!canvas || !context) {
      return undefined
    }

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const compactViewportQuery = window.matchMedia("(max-width: 360px), (max-height: 360px)")
    const colors = [options.colorOne, options.colorTwo, options.colorThree]
    const characters = Array.from(options.characters)
    let animationFrame = 0
    let resizeTimer = 0
    let disposed = false
    let width = 1
    let height = 1
    let lastGlitchTime = 0

    const shouldAnimate = () => shouldAnimateAmbientBackground({
      prefersReducedMotion: reducedMotionQuery.matches,
      compactViewport: compactViewportQuery.matches,
      documentHidden: document.visibilityState !== "visible",
    })

    const random = () => {
      seedRef.current = (seedRef.current * 1664525 + 1013904223) >>> 0
      return seedRef.current / 0x100000000
    }

    const randomChar = () => characters[Math.floor(random() * characters.length)] ?? " "
    const randomColor = () => colors[Math.floor(random() * colors.length)] ?? colors[0]

    const initializeLetters = (columns: number, rows: number) => {
      gridRef.current = { columns, rows }
      lettersRef.current = Array.from({ length: columns * rows }, () => ({
        char: randomChar(),
        color: randomColor(),
        targetColor: randomColor(),
        colorProgress: 1,
      }))
    }

    const drawLetters = () => {
      context.clearRect(0, 0, width, height)
      context.font = `${FONT_SIZE}px monospace`
      context.textBaseline = "top"

      const { columns } = gridRef.current
      for (let index = 0; index < lettersRef.current.length; index += 1) {
        const letter = lettersRef.current[index]
        const x = (index % columns) * CHAR_WIDTH
        const y = Math.floor(index / columns) * CHAR_HEIGHT
        context.fillStyle = letter.color
        context.fillText(letter.char, x, y)
      }
    }

    const resizeNow = () => {
      const bounds = canvas.parentElement?.getBoundingClientRect() ?? canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, compactViewportQuery.matches ? 1 : 2)
      width = Math.max(1, bounds.width)
      height = Math.max(1, bounds.height)
      canvas.width = Math.max(1, Math.floor(width * dpr))
      canvas.height = Math.max(1, Math.floor(height * dpr))
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
      initializeLetters(Math.ceil(width / CHAR_WIDTH), Math.ceil(height / CHAR_HEIGHT))
      drawLetters()
    }

    const updateLetters = () => {
      const updateCount = Math.max(1, Math.floor(lettersRef.current.length * 0.05))
      for (let index = 0; index < updateCount; index += 1) {
        const letterIndex = Math.floor(random() * lettersRef.current.length)
        const letter = lettersRef.current[letterIndex]
        if (!letter) {
          continue
        }

        letter.char = randomChar()
        letter.targetColor = randomColor()
        if (options.smooth) {
          letter.colorProgress = 0
        } else {
          letter.color = letter.targetColor
          letter.colorProgress = 1
        }
      }
    }

    const handleSmoothTransitions = () => {
      let needsRedraw = false
      for (const letter of lettersRef.current) {
        if (letter.colorProgress >= 1) {
          continue
        }

        letter.colorProgress = Math.min(1, letter.colorProgress + 0.05)
        const start = hexToRgb(letter.color)
        const end = hexToRgb(letter.targetColor)
        letter.color = interpolateColor(start, end, letter.colorProgress)
        needsRedraw = true
      }

      if (needsRedraw) {
        drawLetters()
      }
    }

    const draw = (timestamp: number) => {
      const animate = shouldAnimate()
      if (animate && timestamp - lastGlitchTime >= options.glitchSpeed) {
        updateLetters()
        drawLetters()
        lastGlitchTime = timestamp
      }

      if (animate && options.smooth) {
        handleSmoothTransitions()
      }

      if (animate && !disposed) {
        animationFrame = window.requestAnimationFrame(draw)
      }
    }

    const render = () => {
      window.cancelAnimationFrame(animationFrame)
      draw(performance.now())
    }

    const queueResize = () => {
      window.clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(() => {
        window.cancelAnimationFrame(animationFrame)
        resizeNow()
        render()
      }, 100)
    }

    resizeNow()
    const resizeObserver = new ResizeObserver(queueResize)
    resizeObserver.observe(canvas)
    window.addEventListener("resize", queueResize, { passive: true })
    document.addEventListener("visibilitychange", render)
    reducedMotionQuery.addEventListener("change", render)
    compactViewportQuery.addEventListener("change", queueResize)
    render()

    return () => {
      disposed = true
      window.cancelAnimationFrame(animationFrame)
      window.clearTimeout(resizeTimer)
      resizeObserver.disconnect()
      window.removeEventListener("resize", queueResize)
      document.removeEventListener("visibilitychange", render)
      reducedMotionQuery.removeEventListener("change", render)
      compactViewportQuery.removeEventListener("change", queueResize)
      lettersRef.current = []
      context.clearRect(0, 0, width, height)
      canvas.width = 1
      canvas.height = 1
    }
  }, [options])

  return (
    <div className={cn(styles.reactBitsLetterGlitch, className)} aria-hidden="true">
      <canvas ref={canvasRef} className={styles.reactBitsLetterGlitchCanvas} />
      {options.outerVignette ? <span className={styles.reactBitsLetterGlitchOuterVignette} /> : null}
      {options.centerVignette ? <span className={styles.reactBitsLetterGlitchCenterVignette} /> : null}
    </div>
  )
}

function resolveLetterGlitchOptions(options?: ReactBitsLetterGlitchOptions): ResolvedLetterGlitchOptions {
  return {
    colorOne: resolveHex(options?.colorOne, DEFAULT_REACT_BITS_LETTER_GLITCH.colorOne),
    colorTwo: resolveHex(options?.colorTwo, DEFAULT_REACT_BITS_LETTER_GLITCH.colorTwo),
    colorThree: resolveHex(options?.colorThree, DEFAULT_REACT_BITS_LETTER_GLITCH.colorThree),
    glitchSpeed: resolveNumber(options?.glitchSpeed, DEFAULT_REACT_BITS_LETTER_GLITCH.glitchSpeed, 16, 500),
    centerVignette: options?.centerVignette ?? DEFAULT_REACT_BITS_LETTER_GLITCH.centerVignette,
    outerVignette: options?.outerVignette ?? DEFAULT_REACT_BITS_LETTER_GLITCH.outerVignette,
    smooth: options?.smooth ?? DEFAULT_REACT_BITS_LETTER_GLITCH.smooth,
    characters: typeof options?.characters === "string" && options.characters.trim().length > 0
      ? options.characters.slice(0, 120)
      : DEFAULT_REACT_BITS_LETTER_GLITCH.characters,
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

function hexToRgb(hex: string) {
  const normalized = resolveHex(hex, "#000000").slice(1)
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  }
}

function interpolateColor(
  start: { r: number; g: number; b: number },
  end: { r: number; g: number; b: number },
  factor: number,
) {
  const red = Math.round(start.r + (end.r - start.r) * factor)
  const green = Math.round(start.g + (end.g - start.g) * factor)
  const blue = Math.round(start.b + (end.b - start.b) * factor)
  return `rgb(${red}, ${green}, ${blue})`
}
