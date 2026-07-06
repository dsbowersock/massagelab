"use client"

import { useEffect, useMemo, useRef } from "react"
import { shouldAnimateAmbientBackground } from "@/lib/motion-preferences"
import { cn } from "@/lib/utils"
import styles from "@/components/backgrounds/BackgroundHost.module.css"
import type { BackgroundEffectProps, ChamaacElectricMistOptions } from "./css-backgrounds"

type RgbColor = [number, number, number]

type ResolvedElectricMistOptions = Required<ChamaacElectricMistOptions>

// 60 * Math.PI intentionally bounds shader time before float precision drift can
// show while avoiding a visible loop snap in the mist animation.
const TIME_LOOP_SECONDS = 60 * Math.PI

type ElectricMistWebGlResources = {
  program: WebGLProgram
  vertexShader: WebGLShader
  fragmentShader: WebGLShader
  positionBuffer: WebGLBuffer
  attributes: {
    position: number
  }
  uniforms: {
    resolution: WebGLUniformLocation
    time: WebGLUniformLocation
    color: WebGLUniformLocation
    detail: WebGLUniformLocation
    distortion: WebGLUniformLocation
    brightness: WebGLUniformLocation
  }
}

const DEFAULT_CHAMAAC_ELECTRIC_MIST: ResolvedElectricMistOptions = {
  color: "#191970",
  speed: 100,
  detail: 1.5,
  distortion: 3,
  brightness: 100,
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
  precision mediump float;

  uniform float uTime;
  uniform vec2 uResolution;
  uniform vec3 uColor;
  uniform float uDetail;
  uniform float uDistortion;
  uniform float uBrightness;
  varying vec2 vUv;

  #define time uTime * 0.2

  mat2 makem2(in float theta) {
    float c = cos(theta);
    float s = sin(theta);
    return mat2(c, -s, s, c);
  }

  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
  }

  float noise(in vec2 x, float detail) {
    x *= detail;
    vec2 p = floor(x);
    vec2 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    float a = hash(p + vec2(0.0, 0.0));
    float b = hash(p + vec2(1.0, 0.0));
    float c = hash(p + vec2(0.0, 1.0));
    float d = hash(p + vec2(1.0, 1.0));
    return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
  }

  mat2 m2 = mat2(0.80, 0.60, -0.60, 0.80);

  float fbm(in vec2 p, float detail, int octaves) {
    float z = 2.0;
    float rz = 0.0;
    for (int i = 0; i < 7; i++) {
      if (i >= octaves) {
        break;
      }
      rz += abs((noise(p, detail) - 0.5) * 4.0) / z;
      z = z * 2.0;
      p = p * 2.0;
      p *= m2;
    }
    return rz;
  }

  float electricMask(vec2 bp, vec2 p) {
    vec2 drift = vec2(sin(time * 0.31), cos(time * 0.23));
    float field = fbm(bp * 1.25 + drift * 1.35, uDetail, 4);
    vec2 directionA = normalize(vec2(0.76, 0.44));
    vec2 directionB = normalize(vec2(-0.42, 0.91));
    vec2 directionC = normalize(vec2(cos(time * 0.11 + 1.7), sin(time * 0.15 + 0.4)));

    float ridgeA = abs(sin(dot(bp, directionA) * 1.05 + field * 2.4 - time * 2.35));
    float ridgeB = abs(sin(dot(bp, directionB) * 0.9 - field * 2.1 + time * 1.75));
    float ridgeC = abs(sin(dot(bp, directionC) * 0.72 + length(bp + drift * 0.35) * 0.8 - time * 1.1));
    float moving = max(smoothstep(0.54, 0.96, ridgeA), smoothstep(0.68, 0.99, ridgeB) * 0.7);
    moving = max(moving, smoothstep(0.74, 0.99, ridgeC) * 0.5);

    float breakup = smoothstep(0.12, 0.92, fbm(p * 2.1 + vec2(-time * 0.22, time * 0.31), uDetail, 4));
    return clamp(0.2 + moving * breakup * 0.85, 0.0, 1.15);
  }

  void main() {
    vec2 p = vUv * 2.0 - 1.0;
    p.x *= uResolution.x / uResolution.y;
    vec2 bp = p;
    p += 5.0;
    p *= 0.5;

    float rb = fbm(p * 0.5 + time * 0.17, uDetail, 3) * 0.1;
    p *= makem2(rb * 0.2 + atan(p.y, p.x) * uDistortion);

    float rz = fbm(p * 0.9 - time * 0.7, uDetail, 5);
    rz *= 12.0;
    rz *= electricMask(bp, p);

    vec3 col = sqrt(abs(uColor / (1.05 - rz)));
    col *= 0.08 + uBrightness * 0.92;
    col += uColor * (0.035 + rb * 0.6) * uBrightness;

    gl_FragColor = vec4(col, 1.0);
  }
`

// Chamaac UI Electric Mist is published as a Three/R3F shader component. This
// ports the source shader into a native WebGL layer so Clock/Chimer avoid that stack.
export default function ChamaacElectricMistBackground({
  className,
  chamaacElectricMist,
}: BackgroundEffectProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const color = chamaacElectricMist?.color
  const speed = chamaacElectricMist?.speed
  const detail = chamaacElectricMist?.detail
  const distortion = chamaacElectricMist?.distortion
  const brightness = chamaacElectricMist?.brightness
  const options = useMemo(
    () => resolveElectricMistOptions({
      color,
      speed,
      detail,
      distortion,
      brightness,
    }),
    [brightness, color, detail, distortion, speed],
  )
  const colorRgb = useMemo(() => parseHexColorToRgb(options.color), [options.color])

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

    const resources = createElectricMistResources(context)

    if (!resources) {
      return undefined
    }

    let animationFrame = 0
    let resizeRetryFrame = 0
    let shouldRun = false
    let viewportWidth = 1
    let viewportHeight = 1
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const compactViewportQuery = window.matchMedia("(max-width: 640px)")

    const drawFrame = (timestamp: number, animate: boolean) => {
      if (canvas.width <= 1 || canvas.height <= 1) {
        return
      }

      const time = animate ? ((timestamp / 1000) * (options.speed / 100)) % TIME_LOOP_SECONDS : 0

      context.viewport(0, 0, canvas.width, canvas.height)
      context.useProgram(resources.program)
      context.uniform2f(resources.uniforms.resolution, canvas.width, canvas.height)
      context.uniform1f(resources.uniforms.time, time)
      context.uniform3f(resources.uniforms.color, colorRgb[0], colorRgb[1], colorRgb[2])
      context.uniform1f(resources.uniforms.detail, options.detail)
      context.uniform1f(resources.uniforms.distortion, options.distortion)
      context.uniform1f(resources.uniforms.brightness, options.brightness / 100)
      context.drawArrays(context.TRIANGLE_STRIP, 0, 4)
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
      canvas.width = width
      canvas.height = height
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
  }, [colorRgb, options])

  return (
    <div
      ref={containerRef}
      className={cn(styles.effectLayer, styles.chamaacElectricMist, className)}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className={styles.chamaacElectricMistCanvas} />
    </div>
  )
}

function createElectricMistResources(context: WebGLRenderingContext): ElectricMistWebGlResources | null {
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
      1, -1,
      -1, 1,
      1, 1,
    ]),
    context.STATIC_DRAW,
  )
  context.enableVertexAttribArray(position)
  context.vertexAttribPointer(position, 2, context.FLOAT, false, 0, 0)

  return {
    program,
    vertexShader,
    fragmentShader,
    positionBuffer,
    attributes: {
      position,
    },
    uniforms: {
      resolution: getUniformLocation(context, program, "uResolution"),
      time: getUniformLocation(context, program, "uTime"),
      color: getUniformLocation(context, program, "uColor"),
      detail: getUniformLocation(context, program, "uDetail"),
      distortion: getUniformLocation(context, program, "uDistortion"),
      brightness: getUniformLocation(context, program, "uBrightness"),
    },
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
  const location = context.getUniformLocation(program, name)

  if (location === null) {
    throw new Error(`Missing Chamaac Electric Mist shader uniform: ${name}`)
  }

  return location
}

function resolveElectricMistOptions(options: ChamaacElectricMistOptions): ResolvedElectricMistOptions {
  return {
    color: normalizeHexColor(options.color, DEFAULT_CHAMAAC_ELECTRIC_MIST.color),
    speed: clampNumber(options.speed, DEFAULT_CHAMAAC_ELECTRIC_MIST.speed, 1, 400),
    detail: clampNumber(options.detail, DEFAULT_CHAMAAC_ELECTRIC_MIST.detail, 0.5, 4),
    distortion: clampNumber(options.distortion, DEFAULT_CHAMAAC_ELECTRIC_MIST.distortion, 0, 8),
    brightness: clampNumber(options.brightness, DEFAULT_CHAMAAC_ELECTRIC_MIST.brightness, 1, 100),
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
