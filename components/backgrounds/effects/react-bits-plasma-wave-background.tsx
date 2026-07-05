"use client"

import { useEffect, useMemo, useRef } from "react"
import { shouldAnimateAmbientBackground } from "@/lib/motion-preferences"
import { cn } from "@/lib/utils"
import styles from "@/components/backgrounds/BackgroundHost.module.css"
import type { BackgroundEffectProps, ReactBitsPlasmaWaveOptions } from "./css-backgrounds"

type RgbColor = [number, number, number]
type ResolvedPlasmaWaveOptions = Omit<Required<ReactBitsPlasmaWaveOptions>, "colors"> & {
  colors: [string, string]
}

type PlasmaWaveResources = {
  program: WebGLProgram
  vertexShader: WebGLShader
  fragmentShader: WebGLShader
  positionBuffer: WebGLBuffer
  attributes: { position: number }
  uniforms: {
    time: WebGLUniformLocation
    resolution: WebGLUniformLocation
    offset: WebGLUniformLocation
    rotation: WebGLUniformLocation
    focalLength: WebGLUniformLocation
    speed1: WebGLUniformLocation
    speed2: WebGLUniformLocation
    dir2: WebGLUniformLocation
    bend1: WebGLUniformLocation
    bend2: WebGLUniformLocation
    color1: WebGLUniformLocation
    color2: WebGLUniformLocation
  }
}

const DEFAULT_REACT_BITS_PLASMA_WAVE: ResolvedPlasmaWaveOptions = {
  xOffset: 0,
  yOffset: 0,
  rotationDeg: 0,
  focalLength: 0.8,
  speed1: 0.05,
  speed2: 0.05,
  dir2: 1,
  bend1: 1,
  bend2: 0.5,
  colors: ["#A855F7", "#06B6D4"],
}

const vertexShaderSource = `
  attribute vec2 position;

  void main() {
    gl_Position = vec4(position, 0.0, 1.0);
  }
`

const fragmentShaderSource = `
  precision mediump float;

  uniform float iTime;
  uniform vec2 iResolution;
  uniform vec2 uOffset;
  uniform float uRotation;
  uniform float uFocalLength;
  uniform float uSpeed1;
  uniform float uSpeed2;
  uniform float uDir2;
  uniform float uBend1;
  uniform float uBend2;
  uniform vec3 uColor1;
  uniform vec3 uColor2;

  const float lt = 0.3;
  const float pi = 3.14159;
  const float pi2 = 6.28318;
  const float pi_2 = 1.5708;
  #define MAX_STEPS 14

  void mainImage(out vec4 C, in vec2 U) {
    float t = iTime * pi;
    float s = 1.0;
    float d = 0.0;
    vec2 R = iResolution;

    vec3 o = vec3(0.0, 0.0, -7.0);
    vec3 u = normalize(vec3((U - 0.5 * R) / R.y, uFocalLength));
    vec2 k = vec2(0.0);
    vec3 p;

    float t1 = t * 0.7;
    float t2 = t * 0.9;
    float tSpeed1 = t * uSpeed1;
    float tSpeed2 = t * uSpeed2 * uDir2;

    for (int i = 0; i < MAX_STEPS; ++i) {
      p = o + u * d;
      p.x -= 15.0;

      float px = p.x;
      float wob1 = uBend1 + sin(t1 + px * 0.8) * 0.1;
      float wob2 = uBend2 + cos(t2 + px * 1.1) * 0.1;

      float px2 = px + pi_2;
      vec2 sinOffset = sin(vec2(px, px2) + tSpeed1) * wob1;
      vec2 cosOffset = cos(vec2(px, px2) + tSpeed2) * wob2;

      vec2 yz = p.yz;
      float pxLt = px + lt;
      k.x = max(pxLt, length(yz - sinOffset) - lt);
      k.y = max(pxLt, length(yz - cosOffset) - lt);

      float current = min(k.x, k.y);
      s = min(s, current);
      if (s < 0.001 || d > 300.0) break;
      d += s * 0.7;
    }

    float sqrtD = sqrt(d);
    vec3 raw = max(cos(d * pi2) - s * sqrtD - vec3(k, 0.0), 0.0);
    raw.gb += 0.1;
    float maxC = max(raw.r, max(raw.g, raw.b));
    if (maxC < 0.15) discard;
    raw = raw * 0.4 + raw.brg * 0.6 + raw * raw;
    float lum = dot(raw, vec3(0.299, 0.587, 0.114));
    float w1 = max(0.0, 1.0 - k.x * 2.0);
    float w2 = max(0.0, 1.0 - k.y * 2.0);
    float wt = w1 + w2 + 0.001;
    vec3 c = (uColor1 * w1 + uColor2 * w2) / wt * lum * 3.5;
    C = vec4(c, 1.0);
  }

  void main() {
    vec2 coord = gl_FragCoord.xy + uOffset;
    coord -= 0.5 * iResolution;
    float c = cos(uRotation);
    float s = sin(uRotation);
    coord = mat2(c, -s, s, c) * coord;
    coord += 0.5 * iResolution;

    vec4 color;
    mainImage(color, coord);
    gl_FragColor = color;
  }
`

// React Bits Plasma Wave is an OGL full-screen raymarch shader. MassageLab
// keeps the source offset, rotation, speed, bend, and two-color wave uniforms.
export default function ReactBitsPlasmaWaveBackground({
  className,
  reactBitsPlasmaWave,
}: BackgroundEffectProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const options = useMemo(
    () => resolvePlasmaWaveOptions(reactBitsPlasmaWave),
    [
      reactBitsPlasmaWave?.xOffset,
      reactBitsPlasmaWave?.yOffset,
      reactBitsPlasmaWave?.rotationDeg,
      reactBitsPlasmaWave?.focalLength,
      reactBitsPlasmaWave?.speed1,
      reactBitsPlasmaWave?.speed2,
      reactBitsPlasmaWave?.dir2,
      reactBitsPlasmaWave?.bend1,
      reactBitsPlasmaWave?.bend2,
      reactBitsPlasmaWave?.colors,
    ],
  )
  const colors = useMemo(
    () => [parseHexColorToRgb(options.colors[0]), parseHexColorToRgb(options.colors[1])] as const,
    [options.colors],
  )

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    const context = canvas?.getContext("webgl", {
      alpha: true,
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

    const resources = createPlasmaWaveResources(context)

    if (!resources) {
      return undefined
    }

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const compactViewportQuery = window.matchMedia("(max-width: 480px)")
    const startTime = performance.now()
    let animationFrame = 0
    let resizeRetryFrame = 0
    let shouldRun = false

    const resizeCanvas = () => {
      const bounds = container.getBoundingClientRect()
      const width = Math.max(1, Math.floor(bounds.width))
      const height = Math.max(1, Math.floor(bounds.height))

      if (width <= 1 || height <= 1) {
        return false
      }

      const dpr = Math.min(1.5, window.devicePixelRatio || 1)
      const pixelWidth = Math.max(1, Math.floor(width * dpr))
      const pixelHeight = Math.max(1, Math.floor(height * dpr))

      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth
        canvas.height = pixelHeight
      }

      context.viewport(0, 0, pixelWidth, pixelHeight)
      context.uniform2f(resources.uniforms.resolution, pixelWidth, pixelHeight)
      return true
    }

    const requestResizeRetry = () => {
      if (resizeRetryFrame) {
        return
      }

      resizeRetryFrame = window.requestAnimationFrame(() => {
        resizeRetryFrame = 0
        if (resizeCanvas()) {
          drawFrame(performance.now())
        }
      })
    }

    const bindStaticUniforms = () => {
      context.useProgram(resources.program)
      context.bindBuffer(context.ARRAY_BUFFER, resources.positionBuffer)
      context.enableVertexAttribArray(resources.attributes.position)
      context.vertexAttribPointer(resources.attributes.position, 2, context.FLOAT, false, 0, 0)
      context.uniform2f(resources.uniforms.offset, options.xOffset, options.yOffset)
      context.uniform1f(resources.uniforms.rotation, degreesToRadians(options.rotationDeg))
      context.uniform1f(resources.uniforms.focalLength, options.focalLength)
      context.uniform1f(resources.uniforms.speed1, options.speed1)
      context.uniform1f(resources.uniforms.speed2, options.speed2)
      context.uniform1f(resources.uniforms.dir2, options.dir2)
      context.uniform1f(resources.uniforms.bend1, options.bend1)
      context.uniform1f(resources.uniforms.bend2, options.bend2)
      context.uniform3f(resources.uniforms.color1, colors[0][0], colors[0][1], colors[0][2])
      context.uniform3f(resources.uniforms.color2, colors[1][0], colors[1][1], colors[1][2])
      context.clearColor(0, 0, 0, 0)
    }

    const drawFrame = (time: number) => {
      context.clear(context.COLOR_BUFFER_BIT)
      context.uniform1f(resources.uniforms.time, (time - startTime) * 0.001)
      context.drawArrays(context.TRIANGLES, 0, 3)
    }

    const draw = (time: number) => {
      if (!shouldRun) {
        return
      }

      drawFrame(time)
      animationFrame = window.requestAnimationFrame(draw)
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
        drawFrame(performance.now())
        return
      }

      if (!shouldRun) {
        shouldRun = true
        animationFrame = window.requestAnimationFrame(draw)
      }
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

    bindStaticUniforms()
    resizeObserver.observe(container)
    window.addEventListener("resize", startAnimation)
    document.addEventListener("visibilitychange", handleVisibilityChange)
    reducedMotionQuery.addEventListener("change", handleMotionChange)
    compactViewportQuery.addEventListener("change", handleMotionChange)
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
      context.deleteBuffer(resources.positionBuffer)
      context.deleteProgram(resources.program)
      context.deleteShader(resources.vertexShader)
      context.deleteShader(resources.fragmentShader)
    }
  }, [colors, options])

  return (
    <div className={cn(styles.effectLayer, styles.reactBitsPlasmaWave, className)} ref={containerRef}>
      <canvas className={styles.reactBitsPlasmaWaveCanvas} ref={canvasRef} />
    </div>
  )
}

function createPlasmaWaveResources(context: WebGLRenderingContext): PlasmaWaveResources | null {
  const vertexShader = compileShader(context, context.VERTEX_SHADER, vertexShaderSource)
  const fragmentShader = compileShader(context, context.FRAGMENT_SHADER, fragmentShaderSource)

  if (!vertexShader || !fragmentShader) {
    if (vertexShader) context.deleteShader(vertexShader)
    if (fragmentShader) context.deleteShader(fragmentShader)
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
  context.bufferData(context.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), context.STATIC_DRAW)

  return {
    program,
    vertexShader,
    fragmentShader,
    positionBuffer,
    attributes: {
      position: context.getAttribLocation(program, "position"),
    },
    uniforms: {
      time: getUniformLocation(context, program, "iTime"),
      resolution: getUniformLocation(context, program, "iResolution"),
      offset: getUniformLocation(context, program, "uOffset"),
      rotation: getUniformLocation(context, program, "uRotation"),
      focalLength: getUniformLocation(context, program, "uFocalLength"),
      speed1: getUniformLocation(context, program, "uSpeed1"),
      speed2: getUniformLocation(context, program, "uSpeed2"),
      dir2: getUniformLocation(context, program, "uDir2"),
      bend1: getUniformLocation(context, program, "uBend1"),
      bend2: getUniformLocation(context, program, "uBend2"),
      color1: getUniformLocation(context, program, "uColor1"),
      color2: getUniformLocation(context, program, "uColor2"),
    },
  }
}

function compileShader(context: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
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
    throw new Error(`Missing React Bits Plasma Wave uniform: ${name}`)
  }

  return location
}

function resolvePlasmaWaveOptions(options?: ReactBitsPlasmaWaveOptions): ResolvedPlasmaWaveOptions {
  return {
    xOffset: clampNumber(options?.xOffset, DEFAULT_REACT_BITS_PLASMA_WAVE.xOffset, -800, 800),
    yOffset: clampNumber(options?.yOffset, DEFAULT_REACT_BITS_PLASMA_WAVE.yOffset, -800, 800),
    rotationDeg: clampNumber(options?.rotationDeg, DEFAULT_REACT_BITS_PLASMA_WAVE.rotationDeg, -180, 180),
    focalLength: clampNumber(options?.focalLength, DEFAULT_REACT_BITS_PLASMA_WAVE.focalLength, 0.2, 2),
    speed1: clampNumber(options?.speed1, DEFAULT_REACT_BITS_PLASMA_WAVE.speed1, 0, 0.5),
    speed2: clampNumber(options?.speed2, DEFAULT_REACT_BITS_PLASMA_WAVE.speed2, 0, 0.5),
    dir2: options?.dir2 === -1 ? -1 : 1,
    bend1: clampNumber(options?.bend1, DEFAULT_REACT_BITS_PLASMA_WAVE.bend1, 0, 3),
    bend2: clampNumber(options?.bend2, DEFAULT_REACT_BITS_PLASMA_WAVE.bend2, 0, 3),
    colors: normalizeColorList(options?.colors, DEFAULT_REACT_BITS_PLASMA_WAVE.colors),
  }
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback
  }

  return Math.min(max, Math.max(min, value))
}

function normalizeColorList(value: unknown, fallback: [string, string]): [string, string] {
  if (!Array.isArray(value)) {
    return fallback
  }

  return [
    normalizeHexColor(value[0], fallback[0]),
    normalizeHexColor(value[1], fallback[1]),
  ]
}

function normalizeHexColor(value: unknown, fallback: string): string {
  if (typeof value !== "string" || !/^#[0-9a-fA-F]{6}$/.test(value)) {
    return fallback
  }

  return value.toUpperCase()
}

function parseHexColorToRgb(hex: string): RgbColor {
  const normalized = normalizeHexColor(hex, "#FFFFFF").slice(1)
  const red = Number.parseInt(normalized.slice(0, 2), 16) / 255
  const green = Number.parseInt(normalized.slice(2, 4), 16) / 255
  const blue = Number.parseInt(normalized.slice(4, 6), 16) / 255

  return [red, green, blue]
}

function degreesToRadians(value: number): number {
  return (value * Math.PI) / 180
}
