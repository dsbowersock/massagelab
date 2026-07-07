"use client"

import { useEffect, useMemo, useRef } from "react"
import { shouldAnimateAmbientBackground } from "@/lib/motion-preferences"
import { cn } from "@/lib/utils"
import styles from "@/components/backgrounds/BackgroundHost.module.css"
import type { BackgroundEffectProps, MassageLabShapeGridOptions } from "./css-backgrounds"

type GridCell = { x: number; y: number }
type ShapeGridShape = "square" | "circle" | "triangle" | "hexagon"
type ShapeGridDirection = "right" | "left" | "up" | "down" | "diagonal"
type ResolvedShapeGridOptions = Required<MassageLabShapeGridOptions> & {
  shape: ShapeGridShape
  direction: ShapeGridDirection
}

const DEFAULT_MASSAGELAB_SHAPE_GRID: ResolvedShapeGridOptions = {
  direction: "right",
  speed: 1,
  borderColor: "#999999",
  squareSize: 40,
  hoverFillColor: "#222222",
  shape: "square",
  hoverTrailAmount: 0,
  cursorInteraction: true,
}

// MassageLab Shape Grid is a moving canvas grid. This port keeps the source
// shape drawing, directional wrap, hover cell, and trail-opacity model.
export default function MassageLabShapeGridBackground({
  className,
  massageLabShapeGrid,
}: BackgroundEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const gridOffsetRef = useRef({ x: 0, y: 0 })
  const hoveredCellRef = useRef<GridCell | null>(null)
  const trailCellsRef = useRef<GridCell[]>([])
  const cellOpacitiesRef = useRef<Map<string, number>>(new Map())
  const options = useMemo(
    () => resolveShapeGridOptions(massageLabShapeGrid),
    [massageLabShapeGrid],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext("2d", { alpha: true })

    if (!canvas || !context) {
      return undefined
    }

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const compactViewportQuery = window.matchMedia("(max-width: 360px), (max-height: 360px)")
    const cellOpacities = cellOpacitiesRef.current
    const isHex = options.shape === "hexagon"
    const isTri = options.shape === "triangle"
    const hexHoriz = options.squareSize * 1.5
    const hexVert = options.squareSize * Math.sqrt(3)
    let animationFrame = 0
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

    const resize = () => {
      const bounds = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, compactViewportQuery.matches ? 1 : 2)
      width = Math.max(1, bounds.width)
      height = Math.max(1, bounds.height)
      offsetLeft = bounds.left
      offsetTop = bounds.top
      canvas.width = Math.max(1, Math.floor(width * dpr))
      canvas.height = Math.max(1, Math.floor(height * dpr))
      context.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const drawHex = (cx: number, cy: number, size: number) => {
      context.beginPath()
      for (let i = 0; i < 6; i += 1) {
        const angle = (Math.PI / 3) * i
        const vx = cx + size * Math.cos(angle)
        const vy = cy + size * Math.sin(angle)
        if (i === 0) {
          context.moveTo(vx, vy)
        } else {
          context.lineTo(vx, vy)
        }
      }
      context.closePath()
    }

    const drawCircle = (cx: number, cy: number, size: number) => {
      context.beginPath()
      context.arc(cx, cy, size / 2, 0, Math.PI * 2)
      context.closePath()
    }

    const drawTriangle = (cx: number, cy: number, size: number, flip: boolean) => {
      context.beginPath()
      if (flip) {
        context.moveTo(cx, cy + size / 2)
        context.lineTo(cx + size / 2, cy - size / 2)
        context.lineTo(cx - size / 2, cy - size / 2)
      } else {
        context.moveTo(cx, cy - size / 2)
        context.lineTo(cx + size / 2, cy + size / 2)
        context.lineTo(cx - size / 2, cy + size / 2)
      }
      context.closePath()
    }

    const paintCellFill = (cellKey: string, drawPath: () => void) => {
      const alpha = cellOpacities.get(cellKey)
      if (!alpha) {
        return
      }

      context.globalAlpha = alpha
      drawPath()
      context.fillStyle = options.hoverFillColor
      context.fill()
      context.globalAlpha = 1
    }

    const drawGrid = () => {
      context.clearRect(0, 0, width, height)
      context.lineWidth = 1
      context.strokeStyle = options.borderColor

      if (isHex) {
        const colShift = Math.floor(gridOffsetRef.current.x / hexHoriz)
        const offsetX = positiveModulo(gridOffsetRef.current.x, hexHoriz)
        const offsetY = positiveModulo(gridOffsetRef.current.y, hexVert)
        const cols = Math.ceil(width / hexHoriz) + 3
        const rows = Math.ceil(height / hexVert) + 3

        for (let col = -2; col < cols; col += 1) {
          for (let row = -2; row < rows; row += 1) {
            const cx = col * hexHoriz + offsetX
            const cy = row * hexVert + ((col + colShift) % 2 !== 0 ? hexVert / 2 : 0) + offsetY
            const drawPath = () => drawHex(cx, cy, options.squareSize)
            paintCellFill(`${col},${row}`, drawPath)
            drawPath()
            context.stroke()
          }
        }
      } else if (isTri) {
        const halfW = options.squareSize / 2
        const colShift = Math.floor(gridOffsetRef.current.x / halfW)
        const rowShift = Math.floor(gridOffsetRef.current.y / options.squareSize)
        const offsetX = positiveModulo(gridOffsetRef.current.x, halfW)
        const offsetY = positiveModulo(gridOffsetRef.current.y, options.squareSize)
        const cols = Math.ceil(width / halfW) + 4
        const rows = Math.ceil(height / options.squareSize) + 4

        for (let col = -2; col < cols; col += 1) {
          for (let row = -2; row < rows; row += 1) {
            const cx = col * halfW + offsetX
            const cy = row * options.squareSize + options.squareSize / 2 + offsetY
            const flip = ((col + colShift + row + rowShift) % 2 + 2) % 2 !== 0
            const drawPath = () => drawTriangle(cx, cy, options.squareSize, flip)
            paintCellFill(`${col},${row}`, drawPath)
            drawPath()
            context.stroke()
          }
        }
      } else if (options.shape === "circle") {
        const offsetX = positiveModulo(gridOffsetRef.current.x, options.squareSize)
        const offsetY = positiveModulo(gridOffsetRef.current.y, options.squareSize)
        const cols = Math.ceil(width / options.squareSize) + 3
        const rows = Math.ceil(height / options.squareSize) + 3

        for (let col = -2; col < cols; col += 1) {
          for (let row = -2; row < rows; row += 1) {
            const cx = col * options.squareSize + options.squareSize / 2 + offsetX
            const cy = row * options.squareSize + options.squareSize / 2 + offsetY
            const drawPath = () => drawCircle(cx, cy, options.squareSize)
            paintCellFill(`${col},${row}`, drawPath)
            drawPath()
            context.stroke()
          }
        }
      } else {
        const offsetX = positiveModulo(gridOffsetRef.current.x, options.squareSize)
        const offsetY = positiveModulo(gridOffsetRef.current.y, options.squareSize)
        const cols = Math.ceil(width / options.squareSize) + 3
        const rows = Math.ceil(height / options.squareSize) + 3

        for (let col = -2; col < cols; col += 1) {
          for (let row = -2; row < rows; row += 1) {
            const x = col * options.squareSize + offsetX
            const y = row * options.squareSize + offsetY
            const alpha = cellOpacities.get(`${col},${row}`)
            if (alpha) {
              context.globalAlpha = alpha
              context.fillStyle = options.hoverFillColor
              context.fillRect(x, y, options.squareSize, options.squareSize)
              context.globalAlpha = 1
            }
            context.strokeRect(x, y, options.squareSize, options.squareSize)
          }
        }
      }
    }

    const updateCellOpacities = () => {
      const targets = new Map<string, number>()
      if (hoveredCellRef.current) {
        targets.set(`${hoveredCellRef.current.x},${hoveredCellRef.current.y}`, 1)
      }

      if (options.hoverTrailAmount > 0) {
        for (let index = 0; index < trailCellsRef.current.length; index += 1) {
          const cell = trailCellsRef.current[index]
          const key = `${cell.x},${cell.y}`
          if (!targets.has(key)) {
            targets.set(key, (trailCellsRef.current.length - index) / (trailCellsRef.current.length + 1))
          }
        }
      }

      for (const key of targets.keys()) {
        if (!cellOpacities.has(key)) {
          cellOpacities.set(key, 0)
        }
      }

      for (const [key, opacity] of cellOpacities) {
        const target = targets.get(key) ?? 0
        const next = opacity + (target - opacity) * 0.15
        if (next < 0.005) {
          cellOpacities.delete(key)
        } else {
          cellOpacities.set(key, next)
        }
      }
    }

    const pushTrail = (cell: GridCell | null) => {
      if (!cell || options.hoverTrailAmount <= 0) {
        return
      }
      trailCellsRef.current.unshift({ ...cell })
      if (trailCellsRef.current.length > options.hoverTrailAmount) {
        trailCellsRef.current.length = options.hoverTrailAmount
      }
    }

    const setHoveredCell = (cell: GridCell) => {
      if (hoveredCellRef.current?.x === cell.x && hoveredCellRef.current.y === cell.y) {
        return
      }
      pushTrail(hoveredCellRef.current)
      hoveredCellRef.current = cell
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!options.cursorInteraction) {
        return
      }

      const mouseX = event.clientX - offsetLeft
      const mouseY = event.clientY - offsetTop
      if (mouseX < 0 || mouseY < 0 || mouseX > width || mouseY > height) {
        pushTrail(hoveredCellRef.current)
        hoveredCellRef.current = null
        return
      }

      if (isHex) {
        const colShift = Math.floor(gridOffsetRef.current.x / hexHoriz)
        const adjustedX = mouseX - positiveModulo(gridOffsetRef.current.x, hexHoriz)
        const adjustedY = mouseY - positiveModulo(gridOffsetRef.current.y, hexVert)
        const col = Math.round(adjustedX / hexHoriz)
        const rowOffset = (col + colShift) % 2 !== 0 ? hexVert / 2 : 0
        setHoveredCell({ x: col, y: Math.round((adjustedY - rowOffset) / hexVert) })
        return
      }

      if (isTri) {
        const halfW = options.squareSize / 2
        const adjustedX = mouseX - positiveModulo(gridOffsetRef.current.x, halfW)
        const adjustedY = mouseY - positiveModulo(gridOffsetRef.current.y, options.squareSize)
        setHoveredCell({
          x: Math.round(adjustedX / halfW),
          y: Math.floor(adjustedY / options.squareSize),
        })
        return
      }

      const adjustedX = mouseX - positiveModulo(gridOffsetRef.current.x, options.squareSize)
      const adjustedY = mouseY - positiveModulo(gridOffsetRef.current.y, options.squareSize)
      const cell = options.shape === "circle"
        ? {
            x: Math.round(adjustedX / options.squareSize),
            y: Math.round(adjustedY / options.squareSize),
          }
        : {
            x: Math.floor(adjustedX / options.squareSize),
            y: Math.floor(adjustedY / options.squareSize),
          }
      setHoveredCell(cell)
    }

    const handlePointerLeave = () => {
      pushTrail(hoveredCellRef.current)
      hoveredCellRef.current = null
    }

    const updateAnimation = () => {
      const animate = shouldAnimate()
      if (animate) {
        const effectiveSpeed = Math.max(options.speed, 0.1)
        const wrapX = isHex ? hexHoriz * 2 : options.squareSize
        const wrapY = isHex ? hexVert : isTri ? options.squareSize * 2 : options.squareSize

        switch (options.direction) {
          case "right":
            gridOffsetRef.current.x = positiveModulo(gridOffsetRef.current.x - effectiveSpeed, wrapX)
            break
          case "left":
            gridOffsetRef.current.x = positiveModulo(gridOffsetRef.current.x + effectiveSpeed, wrapX)
            break
          case "up":
            gridOffsetRef.current.y = positiveModulo(gridOffsetRef.current.y + effectiveSpeed, wrapY)
            break
          case "down":
            gridOffsetRef.current.y = positiveModulo(gridOffsetRef.current.y - effectiveSpeed, wrapY)
            break
          case "diagonal":
            gridOffsetRef.current.x = positiveModulo(gridOffsetRef.current.x - effectiveSpeed, wrapX)
            gridOffsetRef.current.y = positiveModulo(gridOffsetRef.current.y - effectiveSpeed, wrapY)
            break
          default:
            break
        }
      }

      updateCellOpacities()
      drawGrid()
      if (animate && !disposed) {
        animationFrame = window.requestAnimationFrame(updateAnimation)
      }
    }

    const render = () => {
      window.cancelAnimationFrame(animationFrame)
      updateAnimation()
    }

    resize()
    const resizeObserver = new ResizeObserver(() => {
      resize()
      render()
    })
    resizeObserver.observe(canvas)
    window.addEventListener("resize", resize, { passive: true })
    document.addEventListener("visibilitychange", render)
    reducedMotionQuery.addEventListener("change", render)
    compactViewportQuery.addEventListener("change", render)
    if (options.cursorInteraction) {
      window.addEventListener("pointermove", handlePointerMove, { passive: true })
      window.addEventListener("pointerleave", handlePointerLeave, { passive: true })
    }
    render()

    return () => {
      disposed = true
      window.cancelAnimationFrame(animationFrame)
      resizeObserver.disconnect()
      window.removeEventListener("resize", resize)
      document.removeEventListener("visibilitychange", render)
      reducedMotionQuery.removeEventListener("change", render)
      compactViewportQuery.removeEventListener("change", render)
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerleave", handlePointerLeave)
      cellOpacities.clear()
      trailCellsRef.current = []
      hoveredCellRef.current = null
      context.clearRect(0, 0, width, height)
      canvas.width = 1
      canvas.height = 1
    }
  }, [options])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn(styles.massageLabShapeGridCanvas, className)}
    />
  )
}

function resolveShapeGridOptions(options?: MassageLabShapeGridOptions): ResolvedShapeGridOptions {
  return {
    direction: resolveDirection(options?.direction),
    speed: resolveNumber(options?.speed, DEFAULT_MASSAGELAB_SHAPE_GRID.speed, 0.1, 8),
    borderColor: resolveHex(options?.borderColor, DEFAULT_MASSAGELAB_SHAPE_GRID.borderColor),
    squareSize: resolveNumber(options?.squareSize, DEFAULT_MASSAGELAB_SHAPE_GRID.squareSize, 12, 96),
    hoverFillColor: resolveHex(options?.hoverFillColor, DEFAULT_MASSAGELAB_SHAPE_GRID.hoverFillColor),
    shape: resolveShape(options?.shape),
    hoverTrailAmount: Math.trunc(resolveNumber(
      options?.hoverTrailAmount,
      DEFAULT_MASSAGELAB_SHAPE_GRID.hoverTrailAmount,
      0,
      24,
    )),
    cursorInteraction: options?.cursorInteraction ?? DEFAULT_MASSAGELAB_SHAPE_GRID.cursorInteraction,
  }
}

function resolveDirection(value: string | undefined): ShapeGridDirection {
  return value === "right" || value === "left" || value === "up" || value === "down" || value === "diagonal"
    ? value
    : DEFAULT_MASSAGELAB_SHAPE_GRID.direction
}

function resolveShape(value: string | undefined): ShapeGridShape {
  return value === "square" || value === "circle" || value === "triangle" || value === "hexagon"
    ? value
    : DEFAULT_MASSAGELAB_SHAPE_GRID.shape
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

function positiveModulo(value: number, divisor: number) {
  return ((value % divisor) + divisor) % divisor
}
