"use client"

import { useEffect, useMemo, useRef } from "react"
import { shouldAnimateAmbientBackground } from "@/lib/motion-preferences"
import { cn } from "@/lib/utils"
import styles from "@/components/backgrounds/BackgroundHost.module.css"
import type { BackgroundEffectProps, ReactBitsSilkOptions } from "./css-backgrounds"

type RgbColor = [number, number, number]
type ResolvedSilkOptions = Required<ReactBitsSilkOptions>

type SilkResources = {
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
    speed: WebGLUniformLocation
    scale: WebGLUniformLocation
    rotation: WebGLUniformLocation
    noiseIntensity: WebGLUniformLocation
  }
}

const DEFAULT_REACT_BITS_SILK: ResolvedSilkOptions = {
  color: "#7B7481",
  speed: 5,
  scale: 1,
  noiseIntensity: 1.5,
  rotation: 0,
}

const vertexShaderSource = `
  attribute vec2 aPosition;
  varying vec2 vUv;
  varying vec3 vPosition;

  void main() {
    vPosition = vec3(aPosition, 0.0);
    vUv = aPosition * 0.5 + 0.5;
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`

const fragmentShaderSource = `
  precision highp float;

  varying vec2 vUv;
  varying vec3 vPosition;

  uniform float uTime;
  uniform vec3  uColor;
  uniform float uSpeed;
  uniform float uScale;
  uniform float uRotation;
  uniform float uNoiseIntensity;

  const float e = 2.71828182845904523536;

  float noise(vec2 texCoord) {
    float G = e;
    vec2  r = (G * sin(G * texCoord));
    return fract(r.x * r.y * (1.0 + texCoord.x));
  }

  vec2 rotateUvs(vec2 uv, float angle) {
    float c = cos(angle);
    float s = sin(angle);
    mat2  rot = mat2(c, -s, s, c);
    return rot * uv;
  }

  void main() {
    float rnd        = noise(gl_FragCoord.xy);
    vec2  uv         = rotateUvs(vUv * uScale, uRotation);
    vec2  tex        = uv * uScale;
    float tOffset    = uSpeed * uTime;

    tex.y += 0.03 * sin(8.0 * tex.x - tOffset);

    float pattern = 0.6 +
                    0.4 * sin(5.0 * (tex.x + tex.y +
                                     cos(3.0 * tex.x + 5.0 * tex.y) +
                                     0.02 * tOffset) +
                             sin(20.0 * (tex.x + tex.y - 0.1 * tOffset)));

    vec4 col = vec4(uColor, 1.0) * vec4(pattern) - rnd / 15.0 * uNoiseIntensity;
    col.a = 1.0;
    gl_FragColor = col;
  }
`

// React Bits Silk ships as a Three/R3F shader plane. MassageLab keeps the
// source shader math and replaces only the rendering shell with native WebGL.
export default function ReactBitsSilkBackground({
  className,
  reactBitsSilk,
}: BackgroundEffectProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const color = reactBitsSilk?.color
  const speed = reactBitsSilk?.speed
  const scale = reactBitsSilk?.scale
  const noiseIntensity = reactBitsSilk?.noiseIntensity
  const rotation = reactBitsSilk?.rotation
  const options = useMemo(
    () => resolveSilkOptions({
      color,
      speed,
      scale,
      noiseIntensity,
      rotation,
    }),
    [color, noiseIntensity, rotation, scale, speed],
  )
  const rgbColor = useMemo(() => parseHexColorToRgb(options.color), [options.color])

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

    const resources = createSilkResources(context)

    if (!resources) {
      return undefined
    }

    context.disable(context.DEPTH_TEST)
    context.disable(context.CULL_FACE)
    context.disable(context.BLEND)

    const startTimestamp = performance.now()
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const compactViewportQuery = window.matchMedia("(max-width: 360px), (max-height: 360px)")
    let animationFrame = 0
    let resizeRetryFrame = 0
    let shouldRun = false

    const bindStaticUniforms = () => {
      context.useProgram(resources.program)
      context.uniform3fv(resources.uniforms.color, rgbColor)
      context.uniform1f(resources.uniforms.speed, options.speed)
      context.uniform1f(resources.uniforms.scale, options.scale)
      context.uniform1f(resources.uniforms.rotation, options.rotation)
      context.uniform1f(resources.uniforms.noiseIntensity, options.noiseIntensity)
    }

    const drawFrame = (timestamp: number, animate: boolean) => {
      if (canvas.width <= 1 || canvas.height <= 1) {
        return false
      }

      const elapsedSeconds = animate ? Math.max(0, (timestamp - startTimestamp) / 1000) : 0
      const sourceTime = elapsedSeconds * 0.1

      context.viewport(0, 0, canvas.width, canvas.height)
      context.clearColor(0, 0, 0, 1)
      context.clear(context.COLOR_BUFFER_BIT)
      context.useProgram(resources.program)
      context.bindBuffer(context.ARRAY_BUFFER, resources.positionBuffer)
      context.enableVertexAttribArray(resources.attributes.position)
      context.vertexAttribPointer(resources.attributes.position, 2, context.FLOAT, false, 0, 0)
      context.uniform1f(resources.uniforms.time, sourceTime)
      context.drawArrays(context.TRIANGLES, 0, 3)

      return animate && options.speed >= 1e-6
    }

    const resizeCanvas = () => {
      const bounds = container.getBoundingClientRect()
      const width = Math.floor(bounds.width)
      const height = Math.floor(bounds.height)

      if (width <= 0 || height <= 0) {
        return false
      }

      const dpr = Math.min(window.devicePixelRatio || 1, compactViewportQuery.matches ? 1 : 2)
      const targetWidth = Math.max(1, Math.floor(width * dpr))
      const targetHeight = Math.max(1, Math.floor(height * dpr))

      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth
        canvas.height = targetHeight
      }

      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      return true
    }

    const scheduleFrame = () => {
      animationFrame = window.requestAnimationFrame((timestamp) => {
        animationFrame = 0
        if (!shouldRun) {
          return
        }

        const continueAnimating = drawFrame(timestamp, shouldAnimate())
        if (continueAnimating) {
          scheduleFrame()
        }
      })
    }

    const stopFrame = () => {
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame)
        animationFrame = 0
      }
    }

    const shouldAnimate = () => shouldAnimateAmbientBackground({
      prefersReducedMotion: reducedMotionQuery.matches,
      compactViewport: compactViewportQuery.matches,
      documentHidden: document.visibilityState !== "visible",
    })

    const render = () => {
      stopFrame()
      window.cancelAnimationFrame(resizeRetryFrame)
      const hasSize = resizeCanvas()

      if (!hasSize) {
        resizeRetryFrame = window.requestAnimationFrame(render)
        return
      }

      bindStaticUniforms()
      const animate = shouldAnimate()
      shouldRun = animate
      const keepAnimating = drawFrame(performance.now(), animate)

      if (keepAnimating) {
        scheduleFrame()
      }
    }

    const handleVisibilityChange = () => render()
    const resizeObserver = new ResizeObserver(render)
    resizeObserver.observe(container)
    window.addEventListener("resize", render)
    document.addEventListener("visibilitychange", handleVisibilityChange)
    reducedMotionQuery.addEventListener("change", render)
    compactViewportQuery.addEventListener("change", render)
    render()

    return () => {
      shouldRun = false
      stopFrame()
      window.cancelAnimationFrame(resizeRetryFrame)
      resizeObserver.disconnect()
      window.removeEventListener("resize", render)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      reducedMotionQuery.removeEventListener("change", render)
      compactViewportQuery.removeEventListener("change", render)
      context.deleteBuffer(resources.positionBuffer)
      context.detachShader(resources.program, resources.vertexShader)
      context.detachShader(resources.program, resources.fragmentShader)
      context.deleteShader(resources.vertexShader)
      context.deleteShader(resources.fragmentShader)
      context.deleteProgram(resources.program)
      canvas.width = 1
      canvas.height = 1
    }
  }, [options, rgbColor])

  return (
    <div
      ref={containerRef}
      className={cn(styles.effectLayer, styles.reactBitsSilk, className)}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className={styles.reactBitsSilkCanvas} />
    </div>
  )
}

function createSilkResources(context: WebGLRenderingContext): SilkResources | null {
  const vertexShader = compileShader(context, context.VERTEX_SHADER, vertexShaderSource)
  const fragmentShader = compileShader(context, context.FRAGMENT_SHADER, fragmentShaderSource)

  if (!vertexShader || !fragmentShader) {
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

  return {
    program,
    vertexShader,
    fragmentShader,
    positionBuffer,
    attributes: {
      position: context.getAttribLocation(program, "aPosition"),
    },
    uniforms: {
      time: getUniformLocation(context, program, "uTime"),
      color: getUniformLocation(context, program, "uColor"),
      speed: getUniformLocation(context, program, "uSpeed"),
      scale: getUniformLocation(context, program, "uScale"),
      rotation: getUniformLocation(context, program, "uRotation"),
      noiseIntensity: getUniformLocation(context, program, "uNoiseIntensity"),
    },
  }
}

function compileShader(context: WebGLRenderingContext, type: number, source: string) {
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
    throw new Error(`Missing React Bits Silk shader uniform: ${name}`)
  }

  return location
}

function resolveSilkOptions(options: ReactBitsSilkOptions | undefined): ResolvedSilkOptions {
  return {
    color: resolveHexColor(options?.color, DEFAULT_REACT_BITS_SILK.color),
    speed: resolveNumber(options?.speed, DEFAULT_REACT_BITS_SILK.speed, 0, 10),
    scale: resolveNumber(options?.scale, DEFAULT_REACT_BITS_SILK.scale, 0.2, 4),
    noiseIntensity: resolveNumber(
      options?.noiseIntensity,
      DEFAULT_REACT_BITS_SILK.noiseIntensity,
      0,
      4,
    ),
    rotation: resolveNumber(options?.rotation, DEFAULT_REACT_BITS_SILK.rotation, -Math.PI, Math.PI),
  }
}

function parseHexColorToRgb(color: string): RgbColor {
  const normalized = resolveHexColor(color, DEFAULT_REACT_BITS_SILK.color).replace("#", "")
  return [
    Number.parseInt(normalized.slice(0, 2), 16) / 255,
    Number.parseInt(normalized.slice(2, 4), 16) / 255,
    Number.parseInt(normalized.slice(4, 6), 16) / 255,
  ]
}

function resolveHexColor(value: string | undefined, fallback: string) {
  if (typeof value !== "string" || !/^#[0-9a-fA-F]{6}$/.test(value)) {
    return fallback
  }

  return value.toUpperCase()
}

function resolveNumber(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number,
) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback
  }

  return Math.min(max, Math.max(min, value))
}
