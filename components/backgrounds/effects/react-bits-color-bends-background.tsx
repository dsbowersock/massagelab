"use client"

import { useEffect, useMemo, useRef } from "react"
import { shouldAnimateAmbientBackground } from "@/lib/motion-preferences"
import { cn } from "@/lib/utils"
import styles from "@/components/backgrounds/BackgroundHost.module.css"
import type { BackgroundEffectProps, ReactBitsColorBendsOptions } from "./css-backgrounds"

type RgbColor = [number, number, number]
type ResolvedColorBendsOptions = Required<ReactBitsColorBendsOptions>

type ColorBendsResources = {
  program: WebGLProgram
  vertexShader: WebGLShader
  fragmentShader: WebGLShader
  positionBuffer: WebGLBuffer
  attributes: {
    position: number
  }
  uniforms: {
    canvas: WebGLUniformLocation
    time: WebGLUniformLocation
    speed: WebGLUniformLocation
    rotation: WebGLUniformLocation
    colorCount: WebGLUniformLocation
    colors: WebGLUniformLocation
    transparent: WebGLUniformLocation
    scale: WebGLUniformLocation
    frequency: WebGLUniformLocation
    warpStrength: WebGLUniformLocation
    pointer: WebGLUniformLocation
    mouseInfluence: WebGLUniformLocation
    parallax: WebGLUniformLocation
    noise: WebGLUniformLocation
    iterations: WebGLUniformLocation
    intensity: WebGLUniformLocation
    bandWidth: WebGLUniformLocation
  }
}

const MAX_COLORS = 8

const DEFAULT_REACT_BITS_COLOR_BENDS: ResolvedColorBendsOptions = {
  rotation: 90,
  speed: 0.2,
  colors: [],
  transparent: true,
  autoRotate: 0,
  scale: 1,
  frequency: 1,
  warpStrength: 1,
  mouseInfluence: 1,
  parallax: 0.5,
  noise: 0.15,
  iterations: 1,
  intensity: 1.5,
  bandWidth: 6,
  interactive: false,
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

  #define MAX_COLORS ${MAX_COLORS}

  uniform vec2 uCanvas;
  uniform float uTime;
  uniform float uSpeed;
  uniform vec2 uRot;
  uniform int uColorCount;
  uniform vec3 uColors[MAX_COLORS];
  uniform int uTransparent;
  uniform float uScale;
  uniform float uFrequency;
  uniform float uWarpStrength;
  uniform vec2 uPointer;
  uniform float uMouseInfluence;
  uniform float uParallax;
  uniform float uNoise;
  uniform int uIterations;
  uniform float uIntensity;
  uniform float uBandWidth;

  varying vec2 vUv;

  vec3 linearToSrgb(vec3 color) {
    vec3 clamped = max(color, vec3(0.0));
    return mix(
      clamped * 12.92,
      1.055 * pow(clamped, vec3(1.0 / 2.4)) - 0.055,
      step(vec3(0.0031308), clamped)
    );
  }

  void main() {
    float t = uTime * uSpeed;
    vec2 p = vUv * 2.0 - 1.0;
    p += uPointer * uParallax * 0.1;
    vec2 rp = vec2(p.x * uRot.x - p.y * uRot.y, p.x * uRot.y + p.y * uRot.x);
    vec2 q = vec2(rp.x * (uCanvas.x / uCanvas.y), rp.y);
    q /= max(uScale, 0.0001);
    q /= 0.5 + 0.2 * dot(q, q);
    q += 0.2 * cos(t) - 7.56;
    vec2 toward = (uPointer - rp);
    q += toward * uMouseInfluence * 0.2;

    for (int j = 0; j < 5; j++) {
      if (j >= uIterations - 1) break;
      vec2 rr = sin(1.5 * (q.yx * uFrequency) + 2.0 * cos(q * uFrequency));
      q += (rr - q) * 0.15;
    }

    vec3 col = vec3(0.0);
    float a = 1.0;

    if (uColorCount > 0) {
      vec2 s = q;
      vec3 sumCol = vec3(0.0);
      float cover = 0.0;

      for (int i = 0; i < MAX_COLORS; ++i) {
        if (i >= uColorCount) break;
        s -= 0.01;
        vec2 r = sin(1.5 * (s.yx * uFrequency) + 2.0 * cos(s * uFrequency));
        float m0 = length(r + sin(5.0 * r.y * uFrequency - 3.0 * t + float(i)) / 4.0);
        float kBelow = clamp(uWarpStrength, 0.0, 1.0);
        float kMix = pow(kBelow, 0.3);
        float gain = 1.0 + max(uWarpStrength - 1.0, 0.0);
        vec2 disp = (r - s) * kBelow;
        vec2 warped = s + disp * gain;
        float m1 = length(warped + sin(5.0 * warped.y * uFrequency - 3.0 * t + float(i)) / 4.0);
        float m = mix(m0, m1, kMix);
        float w = 1.0 - exp(-uBandWidth / exp(uBandWidth * m));
        sumCol += uColors[i] * w;
        cover = max(cover, w);
      }

      col = clamp(sumCol, 0.0, 1.0);
      a = uTransparent > 0 ? cover : 1.0;
    } else {
      vec2 s = q;

      for (int k = 0; k < 3; ++k) {
        s -= 0.01;
        vec2 r = sin(1.5 * (s.yx * uFrequency) + 2.0 * cos(s * uFrequency));
        float m0 = length(r + sin(5.0 * r.y * uFrequency - 3.0 * t + float(k)) / 4.0);
        float kBelow = clamp(uWarpStrength, 0.0, 1.0);
        float kMix = pow(kBelow, 0.3);
        float gain = 1.0 + max(uWarpStrength - 1.0, 0.0);
        vec2 disp = (r - s) * kBelow;
        vec2 warped = s + disp * gain;
        float m1 = length(warped + sin(5.0 * warped.y * uFrequency - 3.0 * t + float(k)) / 4.0);
        float m = mix(m0, m1, kMix);
        col[k] = 1.0 - exp(-uBandWidth / exp(uBandWidth * m));
      }

      a = uTransparent > 0 ? max(max(col.r, col.g), col.b) : 1.0;
    }

    col *= uIntensity;

    if (uNoise > 0.0001) {
      float n = fract(sin(dot(gl_FragCoord.xy + vec2(uTime), vec2(12.9898, 78.233))) * 43758.5453123);
      col += (n - 0.5) * uNoise;
      col = clamp(col, 0.0, 1.0);
    }

    vec3 rgb = (uTransparent > 0) ? col * a : col;
    gl_FragColor = vec4(linearToSrgb(rgb), a);
  }
`

// React Bits Color Bends ships as a Three.js shader plane. MassageLab keeps
// the source fragment shader and ports only the scene/material plumbing to WebGL.
export default function ReactBitsColorBendsBackground({
  className,
  reactBitsColorBends,
}: BackgroundEffectProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const options = useMemo(
    () => resolveColorBendsOptions(reactBitsColorBends),
    [
      reactBitsColorBends?.rotation,
      reactBitsColorBends?.speed,
      reactBitsColorBends?.colors,
      reactBitsColorBends?.transparent,
      reactBitsColorBends?.autoRotate,
      reactBitsColorBends?.scale,
      reactBitsColorBends?.frequency,
      reactBitsColorBends?.warpStrength,
      reactBitsColorBends?.mouseInfluence,
      reactBitsColorBends?.parallax,
      reactBitsColorBends?.noise,
      reactBitsColorBends?.iterations,
      reactBitsColorBends?.intensity,
      reactBitsColorBends?.bandWidth,
      reactBitsColorBends?.interactive,
    ],
  )
  const colors = useMemo(() => {
    return options.colors.slice(0, MAX_COLORS).map(parseHexColorToRgb)
  }, [options.colors])

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    const context = canvas?.getContext("webgl", {
      alpha: true,
      antialias: false,
      depth: false,
      powerPreference: "high-performance",
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
      stencil: false,
    })

    if (!container || !canvas || !context) {
      return undefined
    }

    const resources = createColorBendsResources(context)

    if (!resources) {
      return undefined
    }

    context.disable(context.DEPTH_TEST)
    context.disable(context.CULL_FACE)
    context.disable(context.BLEND)

    const startTimestamp = performance.now()
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const compactViewportQuery = window.matchMedia("(max-width: 360px), (max-height: 360px)")
    const colorBuffer = new Float32Array(MAX_COLORS * 3)
    let animationFrame = 0
    let resizeRetryFrame = 0
    let shouldRun = false
    let pointerTarget = { x: 0, y: 0 }
    let pointerCurrent = { x: 0, y: 0 }
    let lastTimestamp = startTimestamp

    const bindStaticUniforms = () => {
      context.useProgram(resources.program)

      for (let index = 0; index < MAX_COLORS; index += 1) {
        const color = colors[index] ?? [0, 0, 0]
        const offset = index * 3
        colorBuffer[offset] = color[0]
        colorBuffer[offset + 1] = color[1]
        colorBuffer[offset + 2] = color[2]
      }

      context.uniform1f(resources.uniforms.speed, options.speed)
      context.uniform1i(resources.uniforms.colorCount, colors.length)
      context.uniform3fv(resources.uniforms.colors, colorBuffer)
      context.uniform1i(resources.uniforms.transparent, options.transparent ? 1 : 0)
      context.uniform1f(resources.uniforms.scale, options.scale)
      context.uniform1f(resources.uniforms.frequency, options.frequency)
      context.uniform1f(resources.uniforms.warpStrength, options.warpStrength)
      context.uniform1f(resources.uniforms.mouseInfluence, options.interactive ? options.mouseInfluence : 0)
      context.uniform1f(resources.uniforms.parallax, options.interactive ? options.parallax : 0)
      context.uniform1f(resources.uniforms.noise, options.noise)
      context.uniform1i(resources.uniforms.iterations, options.iterations)
      context.uniform1f(resources.uniforms.intensity, options.intensity)
      context.uniform1f(resources.uniforms.bandWidth, options.bandWidth)
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

    const drawFrame = (timestamp: number, animate: boolean) => {
      if (canvas.width <= 1 || canvas.height <= 1) {
        return false
      }

      const elapsedSeconds = animate ? Math.max(0, (timestamp - startTimestamp) / 1000) : 0
      const deltaSeconds = Math.max(0, Math.min(0.05, (timestamp - lastTimestamp) / 1000))
      const pointerDamping = Math.min(1, deltaSeconds * 8)
      lastTimestamp = timestamp

      pointerCurrent = {
        x: pointerCurrent.x + (pointerTarget.x - pointerCurrent.x) * pointerDamping,
        y: pointerCurrent.y + (pointerTarget.y - pointerCurrent.y) * pointerDamping,
      }

      const degrees = options.rotation + options.autoRotate * elapsedSeconds
      const radians = degrees * Math.PI / 180
      const cosRotation = Math.cos(radians)
      const sinRotation = Math.sin(radians)

      context.viewport(0, 0, canvas.width, canvas.height)
      context.clearColor(0, 0, 0, options.transparent ? 0 : 1)
      context.clear(context.COLOR_BUFFER_BIT)
      context.useProgram(resources.program)
      context.bindBuffer(context.ARRAY_BUFFER, resources.positionBuffer)
      context.enableVertexAttribArray(resources.attributes.position)
      context.vertexAttribPointer(resources.attributes.position, 2, context.FLOAT, false, 0, 0)
      context.uniform2f(resources.uniforms.canvas, canvas.width, canvas.height)
      context.uniform1f(resources.uniforms.time, elapsedSeconds)
      context.uniform2f(resources.uniforms.rotation, cosRotation, sinRotation)
      context.uniform2f(resources.uniforms.pointer, pointerCurrent.x, pointerCurrent.y)
      context.drawArrays(context.TRIANGLES, 0, 3)

      return animate && shouldContinueAnimating(options)
    }

    const shouldAnimate = () => shouldAnimateAmbientBackground({
      prefersReducedMotion: reducedMotionQuery.matches,
      compactViewport: compactViewportQuery.matches,
      documentHidden: document.visibilityState !== "visible",
    })

    const scheduleFrame = () => {
      animationFrame = window.requestAnimationFrame((timestamp) => {
        animationFrame = 0

        if (!shouldRun) {
          return
        }

        if (drawFrame(timestamp, shouldAnimate())) {
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
      lastTimestamp = performance.now()
      if (drawFrame(lastTimestamp, animate)) {
        scheduleFrame()
      }
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!options.interactive) {
        return
      }

      const bounds = container.getBoundingClientRect()

      if (bounds.width <= 0 || bounds.height <= 0) {
        return
      }

      const x = (event.clientX - bounds.left) / bounds.width
      const y = (event.clientY - bounds.top) / bounds.height

      if (x < 0 || y < 0 || x > 1 || y > 1) {
        pointerTarget = { x: 0, y: 0 }
        return
      }

      pointerTarget = {
        x: x * 2 - 1,
        y: -(y * 2 - 1),
      }
    }

    const resizeObserver = new ResizeObserver(render)
    resizeObserver.observe(container)
    window.addEventListener("resize", render)
    document.addEventListener("visibilitychange", render)
    reducedMotionQuery.addEventListener("change", render)
    compactViewportQuery.addEventListener("change", render)
    if (options.interactive) {
      window.addEventListener("pointermove", handlePointerMove, { passive: true })
    }
    render()

    return () => {
      shouldRun = false
      stopFrame()
      window.cancelAnimationFrame(resizeRetryFrame)
      resizeObserver.disconnect()
      window.removeEventListener("resize", render)
      document.removeEventListener("visibilitychange", render)
      reducedMotionQuery.removeEventListener("change", render)
      compactViewportQuery.removeEventListener("change", render)
      window.removeEventListener("pointermove", handlePointerMove)
      context.deleteBuffer(resources.positionBuffer)
      context.detachShader(resources.program, resources.vertexShader)
      context.detachShader(resources.program, resources.fragmentShader)
      context.deleteShader(resources.vertexShader)
      context.deleteShader(resources.fragmentShader)
      context.deleteProgram(resources.program)
      canvas.width = 1
      canvas.height = 1
    }
  }, [colors, options])

  return (
    <div
      ref={containerRef}
      className={cn(styles.effectLayer, styles.reactBitsColorBends, className)}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className={styles.reactBitsColorBendsCanvas} />
    </div>
  )
}

function createColorBendsResources(context: WebGLRenderingContext): ColorBendsResources | null {
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
  context.bindAttribLocation(program, 0, "aPosition")
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
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    context.STATIC_DRAW,
  )

  const attributes = {
    position: context.getAttribLocation(program, "aPosition"),
  }
  const uniforms = {
    canvas: context.getUniformLocation(program, "uCanvas"),
    time: context.getUniformLocation(program, "uTime"),
    speed: context.getUniformLocation(program, "uSpeed"),
    rotation: context.getUniformLocation(program, "uRot"),
    colorCount: context.getUniformLocation(program, "uColorCount"),
    colors: context.getUniformLocation(program, "uColors[0]"),
    transparent: context.getUniformLocation(program, "uTransparent"),
    scale: context.getUniformLocation(program, "uScale"),
    frequency: context.getUniformLocation(program, "uFrequency"),
    warpStrength: context.getUniformLocation(program, "uWarpStrength"),
    pointer: context.getUniformLocation(program, "uPointer"),
    mouseInfluence: context.getUniformLocation(program, "uMouseInfluence"),
    parallax: context.getUniformLocation(program, "uParallax"),
    noise: context.getUniformLocation(program, "uNoise"),
    iterations: context.getUniformLocation(program, "uIterations"),
    intensity: context.getUniformLocation(program, "uIntensity"),
    bandWidth: context.getUniformLocation(program, "uBandWidth"),
  }

  if (
    attributes.position < 0
    || Object.values(uniforms).some((uniform) => uniform === null)
  ) {
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
    attributes,
    uniforms: uniforms as ColorBendsResources["uniforms"],
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

function resolveColorBendsOptions(options?: ReactBitsColorBendsOptions): ResolvedColorBendsOptions {
  return {
    rotation: clampNumber(options?.rotation, DEFAULT_REACT_BITS_COLOR_BENDS.rotation, -360, 360),
    speed: clampNumber(options?.speed, DEFAULT_REACT_BITS_COLOR_BENDS.speed, 0, 3),
    colors: Array.isArray(options?.colors) ? options.colors.filter(isHexColor).slice(0, MAX_COLORS) : [],
    transparent: typeof options?.transparent === "boolean" ? options.transparent : DEFAULT_REACT_BITS_COLOR_BENDS.transparent,
    autoRotate: clampNumber(options?.autoRotate, DEFAULT_REACT_BITS_COLOR_BENDS.autoRotate, -180, 180),
    scale: clampNumber(options?.scale, DEFAULT_REACT_BITS_COLOR_BENDS.scale, 0.1, 4),
    frequency: clampNumber(options?.frequency, DEFAULT_REACT_BITS_COLOR_BENDS.frequency, 0.1, 4),
    warpStrength: clampNumber(options?.warpStrength, DEFAULT_REACT_BITS_COLOR_BENDS.warpStrength, 0, 3),
    mouseInfluence: clampNumber(options?.mouseInfluence, DEFAULT_REACT_BITS_COLOR_BENDS.mouseInfluence, 0, 3),
    parallax: clampNumber(options?.parallax, DEFAULT_REACT_BITS_COLOR_BENDS.parallax, 0, 2),
    noise: clampNumber(options?.noise, DEFAULT_REACT_BITS_COLOR_BENDS.noise, 0, 1),
    iterations: clampInteger(options?.iterations, DEFAULT_REACT_BITS_COLOR_BENDS.iterations, 1, 5),
    intensity: clampNumber(options?.intensity, DEFAULT_REACT_BITS_COLOR_BENDS.intensity, 0.1, 4),
    bandWidth: clampNumber(options?.bandWidth, DEFAULT_REACT_BITS_COLOR_BENDS.bandWidth, 0.5, 16),
    interactive: typeof options?.interactive === "boolean" ? options.interactive : DEFAULT_REACT_BITS_COLOR_BENDS.interactive,
  }
}

function shouldContinueAnimating(options: ResolvedColorBendsOptions) {
  return options.speed > 0 || options.autoRotate !== 0 || options.interactive
}

function parseHexColorToRgb(color: string): RgbColor {
  const normalized = isHexColor(color) ? color : "#FFFFFF"
  const value = normalized.slice(1)

  return [
    Number.parseInt(value.slice(0, 2), 16) / 255,
    Number.parseInt(value.slice(2, 4), 16) / 255,
    Number.parseInt(value.slice(4, 6), 16) / 255,
  ]
}

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value)
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const numeric = Number(value)

  if (!Number.isFinite(numeric)) {
    return fallback
  }

  return Math.min(Math.max(numeric, min), max)
}

function clampInteger(value: unknown, fallback: number, min: number, max: number) {
  return Math.trunc(clampNumber(value, fallback, min, max))
}
