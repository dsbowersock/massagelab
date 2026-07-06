"use client"

import { useEffect, useMemo, useRef } from "react"
import { shouldAnimateAmbientBackground } from "@/lib/motion-preferences"
import { cn } from "@/lib/utils"
import styles from "@/components/backgrounds/BackgroundHost.module.css"
import type { BackgroundEffectProps, EldoraNovatrixOptions } from "./css-backgrounds"

type RgbColor = [number, number, number]

type ResolvedNovatrixOptions = Required<EldoraNovatrixOptions>

type NovatrixWebGlResources = {
  program: WebGLProgram
  vertexShader: WebGLShader
  fragmentShader: WebGLShader
  positionBuffer: WebGLBuffer
  attributes: {
    position: number
  }
  uniforms: {
    time: WebGLUniformLocation
    color: WebGLUniformLocation
    resolution: WebGLUniformLocation
    mouse: WebGLUniformLocation
    amplitude: WebGLUniformLocation
    speed: WebGLUniformLocation
  }
}

const DEFAULT_ELDORA_NOVATRIX: ResolvedNovatrixOptions = {
  color: "#FFFFFF",
  speed: 1,
  amplitude: 0.1,
}

const vertexShaderSource = `
  attribute vec2 aPosition;
  varying vec2 vUv;

  void main() {
    vUv = aPosition * 0.5 + 0.5;
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`

const fragmentShaderSource = `
  precision highp float;

  uniform float uTime;
  uniform vec3 uColor;
  uniform vec3 uResolution;
  uniform vec2 uMouse;
  uniform float uAmplitude;
  uniform float uSpeed;

  varying vec2 vUv;

  void main() {
    float mr = min(uResolution.x, uResolution.y);
    vec2 uv = (vUv.xy * 2.0 - 1.0) * uResolution.xy / mr;

    uv += (uMouse - vec2(0.5)) * uAmplitude;

    float d = -uTime * 0.5 * uSpeed;
    float a = 0.0;
    for (float i = 0.0; i < 8.0; ++i) {
      a += cos(i - d - a * uv.x);
      d += sin(uv.y * i + a);
    }
    d += uTime * 0.5 * uSpeed;
    vec3 col = vec3(cos(uv * vec2(d, a)) * 0.6 + 0.4, cos(a + d) * 0.5 + 0.5);
    col = cos(col * cos(vec3(d, a, 2.5)) * 0.5 + 0.5) * uColor;
    gl_FragColor = vec4(col, 1.0);
  }
`

// Eldora UI Novatrix ships as an OGL component. MassageLab keeps the source
// shader uniforms in a native WebGL layer and replaces cursor reaction with
// passive drift so the shared background remains pointer-events free.
export default function EldoraNovatrixBackground({
  className,
  eldoraNovatrix,
}: BackgroundEffectProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const color = eldoraNovatrix?.color
  const speed = eldoraNovatrix?.speed
  const amplitude = eldoraNovatrix?.amplitude
  const options = useMemo(
    () => resolveNovatrixOptions({
      color,
      speed,
      amplitude,
    }),
    [amplitude, color, speed],
  )
  const resolvedColor = useMemo(() => parseHexColorToRgb(options.color), [options.color])

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    const context = canvas?.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false,
      stencil: false,
    })

    if (!container || !canvas || !context) {
      return undefined
    }

    const resources = createNovatrixResources(context)

    if (!resources) {
      return undefined
    }

    let animationFrame = 0
    let resizeRetryFrame = 0
    let shouldRun = false
    let viewportWidth = 1
    let viewportHeight = 1
    const startTimestamp = performance.now()
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const compactViewportQuery = window.matchMedia("(max-width: 640px)")

    const drawFrame = (timestamp: number, animate: boolean) => {
      if (canvas.width <= 1 || canvas.height <= 1) {
        return
      }

      const elapsedSeconds = Math.max(0, (timestamp - startTimestamp) / 1000)
      const time = animate ? elapsedSeconds % (60 * Math.PI) : 0
      const driftRate = 0.035 + options.amplitude * 0.18
      const mouseX = animate ? 0.5 + Math.cos(time * driftRate + 0.65) * 0.44 : 0.5
      const mouseY = animate ? 0.5 + Math.sin(time * (driftRate * 0.73) - 0.4) * 0.42 : 0.5

      context.clearColor(1, 1, 1, 1)
      context.clear(context.COLOR_BUFFER_BIT)
      context.viewport(0, 0, canvas.width, canvas.height)
      context.useProgram(resources.program)
      context.uniform1f(resources.uniforms.time, time)
      context.uniform3f(resources.uniforms.color, resolvedColor[0], resolvedColor[1], resolvedColor[2])
      context.uniform3f(resources.uniforms.resolution, canvas.width, canvas.height, canvas.width / Math.max(1, canvas.height))
      context.uniform2f(resources.uniforms.mouse, mouseX, mouseY)
      context.uniform1f(resources.uniforms.amplitude, options.amplitude)
      context.uniform1f(resources.uniforms.speed, options.speed)
      context.drawArrays(context.TRIANGLES, 0, 3)
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
      const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1))
      canvas.width = Math.max(1, Math.floor(width * dpr))
      canvas.height = Math.max(1, Math.floor(height * dpr))
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
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

      drawFrame(timestamp, true)
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
      context.deleteBuffer(resources.positionBuffer)
      context.deleteProgram(resources.program)
      context.deleteShader(resources.vertexShader)
      context.deleteShader(resources.fragmentShader)
      canvas.width = 1
      canvas.height = 1
    }
  }, [options, resolvedColor])

  return (
    <div
      ref={containerRef}
      className={cn(styles.effectLayer, styles.eldoraNovatrixBackground, className)}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className={styles.eldoraNovatrixCanvas} />
    </div>
  )
}

function createNovatrixResources(context: WebGLRenderingContext): NovatrixWebGlResources | null {
  const vertexShader = createShader(context, context.VERTEX_SHADER, vertexShaderSource)
  const fragmentShader = createShader(context, context.FRAGMENT_SHADER, fragmentShaderSource)

  if (!vertexShader || !fragmentShader) {
    if (vertexShader) {
      context.deleteShader(vertexShader)
    }
    if (fragmentShader) {
      context.deleteShader(fragmentShader)
    }
    return null
  }

  const program = context.createProgram()

  if (!program) {
    context.deleteShader(vertexShader)
    context.deleteShader(fragmentShader)
    return null
  }

  context.attachShader(program, vertexShader)
  context.attachShader(program, fragmentShader)
  context.linkProgram(program)

  if (!context.getProgramParameter(program, context.LINK_STATUS)) {
    context.deleteProgram(program)
    context.deleteShader(vertexShader)
    context.deleteShader(fragmentShader)
    return null
  }

  const positionBuffer = context.createBuffer()

  if (!positionBuffer) {
    context.deleteProgram(program)
    context.deleteShader(vertexShader)
    context.deleteShader(fragmentShader)
    return null
  }

  const position = context.getAttribLocation(program, "aPosition")

  if (position < 0) {
    context.deleteBuffer(positionBuffer)
    context.deleteProgram(program)
    context.deleteShader(vertexShader)
    context.deleteShader(fragmentShader)
    return null
  }

  context.useProgram(program)
  context.bindBuffer(context.ARRAY_BUFFER, positionBuffer)
  context.bufferData(
    context.ARRAY_BUFFER,
    new Float32Array([
      -1, -1,
      3, -1,
      -1, 3,
    ]),
    context.STATIC_DRAW,
  )
  context.enableVertexAttribArray(position)
  context.vertexAttribPointer(position, 2, context.FLOAT, false, 0, 0)

  const uniforms = {
    time: getUniformLocation(context, program, "uTime"),
    color: getUniformLocation(context, program, "uColor"),
    resolution: getUniformLocation(context, program, "uResolution"),
    mouse: getUniformLocation(context, program, "uMouse"),
    amplitude: getUniformLocation(context, program, "uAmplitude"),
    speed: getUniformLocation(context, program, "uSpeed"),
  }

  if (hasMissingUniforms(uniforms)) {
    context.deleteBuffer(positionBuffer)
    context.deleteProgram(program)
    context.deleteShader(vertexShader)
    context.deleteShader(fragmentShader)
    return null
  }

  return {
    program,
    vertexShader,
    fragmentShader,
    positionBuffer,
    attributes: {
      position,
    },
    uniforms: uniforms as NovatrixWebGlResources["uniforms"],
  }
}

function createShader(context: WebGLRenderingContext, type: number, source: string) {
  const shader = context.createShader(type)

  if (!shader) {
    return null
  }

  context.shaderSource(shader, source)
  context.compileShader(shader)

  if (!context.getShaderParameter(shader, context.COMPILE_STATUS)) {
    context.deleteShader(shader)
    return null
  }

  return shader
}

function getUniformLocation(context: WebGLRenderingContext, program: WebGLProgram, name: string) {
  return context.getUniformLocation(program, name)
}

function hasMissingUniforms(uniforms: Record<string, WebGLUniformLocation | null>) {
  return Object.values(uniforms).some((location) => location === null)
}

function resolveNovatrixOptions(options: EldoraNovatrixOptions): ResolvedNovatrixOptions {
  return {
    color: normalizeHexColor(options.color, DEFAULT_ELDORA_NOVATRIX.color),
    speed: clampNumber(options.speed, DEFAULT_ELDORA_NOVATRIX.speed, 0.02, 3),
    amplitude: clampNumber(options.amplitude, DEFAULT_ELDORA_NOVATRIX.amplitude, 0.01, 0.45),
  }
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
    Number.parseInt(hex.slice(0, 2), 16) / 255,
    Number.parseInt(hex.slice(2, 4), 16) / 255,
    Number.parseInt(hex.slice(4, 6), 16) / 255,
  ]
}
