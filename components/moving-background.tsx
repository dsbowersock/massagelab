"use client"

import { type CSSProperties, useEffect, useRef } from "react"

interface GradientOrb {
  x: number
  y: number
  vx: number
  vy: number
  radius: number
  color: string
  alpha: number
}

interface MovingBackgroundProps {
  className?: string
  mainColor?: string
  orbColor?: string
  testId?: string
}

export function MovingBackground({
  className = "pointer-events-none fixed inset-0 z-0 h-screen w-screen",
  mainColor = "#FF7F50",
  orbColor = "#4169E1",
  testId = "chimer-moving-background",
}: MovingBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const fallbackStyle = {
    "--ml-background-main": mainColor,
    "--ml-background-orb": orbColor,
  } as CSSProperties

  useEffect(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext("2d")
    if (!canvas || !context) {
      return undefined
    }

    const gradients: GradientOrb[] = []
    let animationFrame = 0

    const resizeCanvas = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight

      gradients.forEach((gradient) => {
        gradient.x = Math.min(gradient.x, canvas.width)
        gradient.y = Math.min(gradient.y, canvas.height)
        gradient.radius = canvas.width * 0.4
      })
    }

    resizeCanvas()

    for (let index = 0; index < 8; index += 1) {
      gradients.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        radius: canvas.width * (0.3 + Math.random() * 0.2),
        color: index % 2 === 0 ? mainColor : orbColor,
        alpha: 0.4 + Math.random() * 0.2,
      })
    }

    const animate = () => {
      context.fillStyle = "rgba(0, 0, 0, 0.01)"
      context.fillRect(0, 0, canvas.width, canvas.height)

      gradients.forEach((gradient) => {
        gradient.x += gradient.vx
        gradient.y += gradient.vy

        if (gradient.x < 0 || gradient.x > canvas.width) {
          gradient.vx *= -1
        }
        if (gradient.y < 0 || gradient.y > canvas.height) {
          gradient.vy *= -1
        }

        const radialGradient = context.createRadialGradient(
          gradient.x,
          gradient.y,
          0,
          gradient.x,
          gradient.y,
          gradient.radius,
        )
        const alphaHex = Math.floor(gradient.alpha * 255)
          .toString(16)
          .padStart(2, "0")

        radialGradient.addColorStop(0, `${gradient.color}${alphaHex}`)
        radialGradient.addColorStop(1, "transparent")

        context.fillStyle = radialGradient
        context.fillRect(0, 0, canvas.width, canvas.height)
      })

      animationFrame = window.requestAnimationFrame(animate)
    }

    window.addEventListener("resize", resizeCanvas)
    animate()

    return () => {
      window.cancelAnimationFrame(animationFrame)
      window.removeEventListener("resize", resizeCanvas)
    }
  }, [mainColor, orbColor])

  return (
    <div aria-hidden="true" className={className} data-testid={testId}>
      <div className="massagelab-background-fallback" style={fallbackStyle} />
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full"
        style={{ filter: "blur(100px)" }}
      />
    </div>
  )
}
