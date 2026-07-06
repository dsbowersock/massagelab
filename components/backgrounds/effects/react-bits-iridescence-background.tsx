"use client"

import { useEffect, useMemo, useRef } from "react"
import { shouldAnimateAmbientBackground } from "@/lib/motion-preferences"
import { cn } from "@/lib/utils"
import styles from "@/components/backgrounds/BackgroundHost.module.css"
import type { BackgroundEffectProps, ReactBitsIridescenceOptions } from "./css-backgrounds"

type RgbColor = [number, number, number]
type ResolvedIridescenceOptions = Required<ReactBitsIridescenceOptions>

type IridescenceResources = {
  program: WebGLProgram
  vertexShader: WebGLShader
  fragmentShader: WebGLShader
  positionBuffer: WebGLBuffer
  uvBuffer: WebGLBuffer
  attributes: {
    position: number
    uv: number
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

const DEFAULT_REACT_BITS_IRIDESCENCE: ResolvedIridescenceOptions = {
  color: "#FFFFFF",
  speed: 1,
  amplitude: 0.1,
  mouseReact: true,
}

const MAX_RENDER_DIMENSION = 1920

const vertexShaderSource = `
  attribute vec2 uv;
  attribute vec2 position;

  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position, 0.0, 1.0);
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

// React Bits Iridescence ships as an OGL full-screen shader. MassageLab keeps
// the source fragment loop and mouse offset uniforms in dependency-free WebGL.
export default function ReactBitsIridescenceBackground({
  className,
  reactBitsIridescence,
}: BackgroundEffectProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const options = useMemo(
    () => resolveIridescenceOptions(reactBitsIridescence),
    [
      reactBitsIridescence?.color,
      reactBitsIridescence?.speed,
      reactBitsIridescence?.amplitude,
      reactBitsIridescence?.mouseReact,
    ],
  )
  const color = useMemo(() => parseHexColorToRgb(options.color), [options.color])

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    const context = canvas?.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      powerPreference: "high-performance",
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      stencil: false,
    })

    if (!container || !canvas || !context) {
      return undefined
    }

    const resources = createIridescenceResources(context)

    if (!resources) {
      return undefined
    }

    context.disable(context.DEPTH_TEST)
    context.disable(context.CULL_FACE)

    const resolution = new Float32Array(3)
    const startTimestamp = performance.now()
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const compactViewportQuery = window.matchMedia("(max-width: 360px), (max-height: 360px)")
    let animationFrame = 0
    let resizeRetryFrame = 0
    let shouldRun = false
    let mouseTarget = { x: 0.5, y: 0.5 }
    let mouseCurrent = { x: 0.5, y: 0.5 }

    const drawFrame = (timestamp: number, animate: boolean) => {
      if (canvas.width <= 1 || canvas.height <= 1) {
        return false
      }

      if (options.mouseReact && animate) {
        mouseCurrent = {
          x: mouseCurrent.x + 0.08 * (mouseTarget.x - mouseCurrent.x),
          y: mouseCurrent.y + 0.08 * (mouseTarget.y - mouseCurrent.y),
        }
      } else {
        mouseCurrent = { x: 0.5, y: 0.5 }
      }

      const elapsedSeconds = animate ? Math.max(0, (timestamp - startTimestamp) / 1000) : 0
      context.viewport(0, 0, canvas.width, canvas.height)
      context.clearColor(1, 1, 1, 1)
      context.clear(context.COLOR_BUFFER_BIT)
      context.useProgram(resources.program)
      context.bindBuffer(context.ARRAY_BUFFER, resources.positionBuffer)
      context.enableVertexAttribArray(resources.attributes.position)
      context.vertexAttribPointer(resources.attributes.position, 2, context.FLOAT, false, 0, 0)
      context.bindBuffer(context.ARRAY_BUFFER, resources.uvBuffer)
      context.enableVertexAttribArray(resources.attributes.uv)
      context.vertexAttribPointer(resources.attributes.uv, 2, context.FLOAT, false, 0, 0)
      context.uniform1f(resources.uniforms.time, elapsedSeconds)
      context.uniform3fv(resources.uniforms.color, color)
      context.uniform3fv(resources.uniforms.resolution, resolution)
      context.uniform2f(resources.uniforms.mouse, mouseCurrent.x, mouseCurrent.y)
      context.uniform1f(resources.uniforms.amplitude, options.amplitude)
      context.uniform1f(resources.uniforms.speed, options.speed)
      context.drawArrays(context.TRIANGLES, 0, 3)

      return animate && (options.speed > 0 || (options.mouseReact && options.amplitude > 0))
    }

    const resizeCanvas = () => {
      const bounds = container.getBoundingClientRect()
      const width = Math.floor(bounds.width)
      const height = Math.floor(bounds.height)

      if (width <= 0 || height <= 0) {
        return false
      }

      const baseDpr = Math.min(window.devicePixelRatio || 1, 2)
      const longestSide = Math.max(width, height) * baseDpr
      const dpr = longestSide > MAX_RENDER_DIMENSION
        ? (baseDpr * MAX_RENDER_DIMENSION) / longestSide
        : baseDpr
      canvas.width = Math.max(1, Math.floor(width * dpr))
      canvas.height = Math.max(1, Math.floor(height * dpr))
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      resolution[0] = canvas.width
      resolution[1] = canvas.height
      resolution[2] = canvas.width / Math.max(1, canvas.height)
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

      if (drawFrame(timestamp, true)) {
        animationFrame = window.requestAnimationFrame(draw)
      } else {
        animationFrame = 0
      }
    }

    const stopAnimation = () => {
      shouldRun = false
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame)
        animationFrame = 0
      }
    }

    const startAnimation = () => {
      const bounds = container.getBoundingClientRect()
      const animate = shouldAnimateAmbientBackground({
        prefersReducedMotion: reducedMotionQuery.matches,
        compactViewport: Math.min(bounds.width, bounds.height) < 360 || compactViewportQuery.matches,
        allowCompactViewport: true,
        documentHidden: document.hidden,
      })

      if (!resizeCanvas()) {
        requestResizeRetry()
      }

      if (!animate) {
        stopAnimation()
        drawFrame(performance.now(), false)
        return
      }

      if (!shouldRun) {
        shouldRun = true
        animationFrame = window.requestAnimationFrame(draw)
      }
    }

    const handlePointerMove = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect()
      if (bounds.width <= 0 || bounds.height <= 0) {
        return
      }

      mouseTarget = {
        x: (event.clientX - bounds.left) / bounds.width,
        y: 1 - (event.clientY - bounds.top) / bounds.height,
      }
    }

    const handlePointerLeave = () => {
      mouseTarget = { x: 0.5, y: 0.5 }
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopAnimation()
        return
      }

      startAnimation()
    }
    const handleMotionChange = () => startAnimation()
    const resizeObserver = new ResizeObserver(() => {
      if (!resizeCanvas()) {
        requestResizeRetry()
      }
    })

    resizeObserver.observe(container)
    window.addEventListener("resize", startAnimation)
    document.addEventListener("visibilitychange", handleVisibilityChange)
    reducedMotionQuery.addEventListener("change", handleMotionChange)
    compactViewportQuery.addEventListener("change", handleMotionChange)
    if (options.mouseReact) {
      window.addEventListener("pointermove", handlePointerMove)
      window.addEventListener("pointerleave", handlePointerLeave)
    }
    startAnimation()

    return () => {
      stopAnimation()
      if (resizeRetryFrame) {
        window.cancelAnimationFrame(resizeRetryFrame)
      }
      resizeObserver.disconnect()
      window.removeEventListener("resize", startAnimation)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      reducedMotionQuery.removeEventListener("change", handleMotionChange)
      compactViewportQuery.removeEventListener("change", handleMotionChange)
      if (options.mouseReact) {
        window.removeEventListener("pointermove", handlePointerMove)
        window.removeEventListener("pointerleave", handlePointerLeave)
      }
      context.deleteBuffer(resources.positionBuffer)
      context.deleteBuffer(resources.uvBuffer)
      context.deleteProgram(resources.program)
      context.deleteShader(resources.vertexShader)
      context.deleteShader(resources.fragmentShader)
    }
  }, [color, options])

  return (
    <div className={cn(styles.effectLayer, styles.reactBitsIridescence, className)} ref={containerRef}>
      <canvas className={styles.reactBitsIridescenceCanvas} ref={canvasRef} />
    </div>
  )
}

function createIridescenceResources(context: WebGLRenderingContext): IridescenceResources | null {
  const vertexShader = compileShader(context, context.VERTEX_SHADER, vertexShaderSource)
  const fragmentShader = compileShader(context, context.FRAGMENT_SHADER, fragmentShaderSource)

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
  const uvBuffer = context.createBuffer()

  if (!positionBuffer || !uvBuffer) {
    if (positionBuffer) {
      context.deleteBuffer(positionBuffer)
    }
    if (uvBuffer) {
      context.deleteBuffer(uvBuffer)
    }
    context.deleteProgram(program)
    context.deleteShader(vertexShader)
    context.deleteShader(fragmentShader)
    return null
  }

  context.bindBuffer(context.ARRAY_BUFFER, positionBuffer)
  context.bufferData(context.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), context.STATIC_DRAW)
  context.bindBuffer(context.ARRAY_BUFFER, uvBuffer)
  context.bufferData(context.ARRAY_BUFFER, new Float32Array([0, 0, 2, 0, 0, 2]), context.STATIC_DRAW)

  return {
    program,
    vertexShader,
    fragmentShader,
    positionBuffer,
    uvBuffer,
    attributes: {
      position: context.getAttribLocation(program, "position"),
      uv: context.getAttribLocation(program, "uv"),
    },
    uniforms: {
      time: getUniformLocation(context, program, "uTime"),
      color: getUniformLocation(context, program, "uColor"),
      resolution: getUniformLocation(context, program, "uResolution"),
      mouse: getUniformLocation(context, program, "uMouse"),
      amplitude: getUniformLocation(context, program, "uAmplitude"),
      speed: getUniformLocation(context, program, "uSpeed"),
    },
  }
}

function compileShader(
  context: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader | null {
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

function getUniformLocation(
  context: WebGLRenderingContext,
  program: WebGLProgram,
  name: string,
): WebGLUniformLocation {
  const location = context.getUniformLocation(program, name)

  if (!location) {
    throw new Error(`Missing React Bits Iridescence uniform: ${name}`)
  }

  return location
}

function resolveIridescenceOptions(options?: ReactBitsIridescenceOptions): ResolvedIridescenceOptions {
  return {
    color: normalizeHexColor(options?.color, DEFAULT_REACT_BITS_IRIDESCENCE.color),
    speed: clampNumber(options?.speed, DEFAULT_REACT_BITS_IRIDESCENCE.speed, 0, 3),
    amplitude: clampNumber(options?.amplitude, DEFAULT_REACT_BITS_IRIDESCENCE.amplitude, 0, 1),
    mouseReact: typeof options?.mouseReact === "boolean"
      ? options.mouseReact
      : DEFAULT_REACT_BITS_IRIDESCENCE.mouseReact,
  }
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback
  }

  return Math.min(max, Math.max(min, value))
}

function normalizeHexColor(value: unknown, fallback: string): string {
  if (typeof value !== "string" || !/^#[0-9a-fA-F]{6}$/.test(value)) {
    return fallback
  }

  return value.toUpperCase()
}

function parseHexColorToRgb(hex: string): RgbColor {
  const normalized = normalizeHexColor(hex, "#FFFFFF").slice(1)
  return [
    Number.parseInt(normalized.slice(0, 2), 16) / 255,
    Number.parseInt(normalized.slice(2, 4), 16) / 255,
    Number.parseInt(normalized.slice(4, 6), 16) / 255,
  ]
}
