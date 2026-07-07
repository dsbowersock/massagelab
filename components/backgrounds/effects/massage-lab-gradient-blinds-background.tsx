"use client"

import { type CSSProperties, useEffect, useMemo, useRef } from "react"
import { shouldAnimateAmbientBackground } from "@/lib/motion-preferences"
import { cn } from "@/lib/utils"
import styles from "@/components/backgrounds/BackgroundHost.module.css"
import type { BackgroundEffectProps, MassageLabGradientBlindsOptions } from "./css-backgrounds"

type RgbColor = [number, number, number]
type GradientBlindsBlendMode = NonNullable<CSSProperties["mixBlendMode"]>
type ResolvedGradientBlindsOptions = Omit<Required<MassageLabGradientBlindsOptions>, "gradientColors" | "mixBlendMode"> & {
  gradientColors: [string, string]
  mixBlendMode: GradientBlindsBlendMode
}

type GradientBlindsResources = {
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
    resolution: WebGLUniformLocation
    mouse: WebGLUniformLocation
    time: WebGLUniformLocation
    angle: WebGLUniformLocation
    noise: WebGLUniformLocation
    blindCount: WebGLUniformLocation
    spotlightRadius: WebGLUniformLocation
    spotlightSoftness: WebGLUniformLocation
    spotlightOpacity: WebGLUniformLocation
    mirror: WebGLUniformLocation
    distort: WebGLUniformLocation
    shineFlip: WebGLUniformLocation
    color0: WebGLUniformLocation
    color1: WebGLUniformLocation
    color2: WebGLUniformLocation
    color3: WebGLUniformLocation
    color4: WebGLUniformLocation
    color5: WebGLUniformLocation
    color6: WebGLUniformLocation
    color7: WebGLUniformLocation
    colorCount: WebGLUniformLocation
  }
}

const MAX_COLORS = 8

const DEFAULT_MASSAGELAB_GRADIENT_BLINDS: ResolvedGradientBlindsOptions = {
  dpr: 1,
  gradientColors: ["#FF9FFC", "#5227FF"],
  angle: 0,
  noise: 0.3,
  blindCount: 16,
  blindMinWidth: 60,
  mouseDampening: 0.15,
  mirrorGradient: false,
  spotlightRadius: 0.5,
  spotlightSoftness: 1,
  spotlightOpacity: 1,
  distortAmount: 0,
  shineDirection: "left",
  mixBlendMode: "lighten",
  enableMouseInteraction: false,
}

const vertexShaderSource = `
  attribute vec2 position;
  attribute vec2 uv;
  varying vec2 vUv;

  void main() {
    vUv = uv;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`

const fragmentShaderSource = `
  precision mediump float;

  uniform vec3 iResolution;
  uniform vec2 iMouse;
  uniform float iTime;

  uniform float uAngle;
  uniform float uNoise;
  uniform float uBlindCount;
  uniform float uSpotlightRadius;
  uniform float uSpotlightSoftness;
  uniform float uSpotlightOpacity;
  uniform float uMirror;
  uniform float uDistort;
  uniform float uShineFlip;
  uniform vec3 uColor0;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;
  uniform vec3 uColor4;
  uniform vec3 uColor5;
  uniform vec3 uColor6;
  uniform vec3 uColor7;
  uniform int uColorCount;

  varying vec2 vUv;

  float rand(vec2 co) {
    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
  }

  vec2 rotate2D(vec2 p, float a) {
    float c = cos(a);
    float s = sin(a);
    return mat2(c, -s, s, c) * p;
  }

  vec3 getGradientColor(float t) {
    float tt = clamp(t, 0.0, 1.0);
    int count = uColorCount;
    if (count < 2) count = 2;
    float scaled = tt * float(count - 1);
    float seg = floor(scaled);
    float f = fract(scaled);

    if (seg < 1.0) return mix(uColor0, uColor1, f);
    if (seg < 2.0 && count > 2) return mix(uColor1, uColor2, f);
    if (seg < 3.0 && count > 3) return mix(uColor2, uColor3, f);
    if (seg < 4.0 && count > 4) return mix(uColor3, uColor4, f);
    if (seg < 5.0 && count > 5) return mix(uColor4, uColor5, f);
    if (seg < 6.0 && count > 6) return mix(uColor5, uColor6, f);
    if (seg < 7.0 && count > 7) return mix(uColor6, uColor7, f);
    if (count > 7) return uColor7;
    if (count > 6) return uColor6;
    if (count > 5) return uColor5;
    if (count > 4) return uColor4;
    if (count > 3) return uColor3;
    if (count > 2) return uColor2;
    return uColor1;
  }

  void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv0 = fragCoord.xy / iResolution.xy;

    float aspect = iResolution.x / iResolution.y;
    vec2 p = uv0 * 2.0 - 1.0;
    p.x *= aspect;
    vec2 pr = rotate2D(p, uAngle);
    pr.x /= aspect;
    vec2 uv = pr * 0.5 + 0.5;

    vec2 uvMod = uv;
    if (uDistort > 0.0) {
      float a = uvMod.y * 6.0;
      float b = uvMod.x * 6.0;
      float w = 0.01 * uDistort;
      uvMod.x += sin(a) * w;
      uvMod.y += cos(b) * w;
    }
    float t = uvMod.x;
    if (uMirror > 0.5) {
      t = 1.0 - abs(1.0 - 2.0 * fract(t));
    }
    vec3 base = getGradientColor(t);

    vec2 offset = vec2(iMouse.x / iResolution.x, iMouse.y / iResolution.y);
    float d = length(uv0 - offset);
    float r = max(uSpotlightRadius, 1e-4);
    float dn = d / r;
    float spot = (1.0 - 2.0 * pow(dn, uSpotlightSoftness)) * uSpotlightOpacity;
    vec3 cir = vec3(spot);
    float stripe = fract(uvMod.x * max(uBlindCount, 1.0));
    if (uShineFlip > 0.5) stripe = 1.0 - stripe;
    vec3 ran = vec3(stripe);

    vec3 col = cir + base - ran;
    col += (rand(gl_FragCoord.xy + iTime) - 0.5) * uNoise;

    fragColor = vec4(col, 1.0);
  }

  void main() {
    vec4 color;
    mainImage(color, vUv * iResolution.xy);
    gl_FragColor = color;
  }
`

export default function MassageLabGradientBlindsBackground({
  className,
  massageLabGradientBlinds,
}: BackgroundEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 })
  const options = useMemo(
    () => resolveGradientBlindsOptions(massageLabGradientBlinds),
    [massageLabGradientBlinds],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return undefined
    }

    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: true,
      depth: false,
      powerPreference: "high-performance",
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      stencil: false,
    })

    if (!gl) {
      return undefined
    }

    const resources = createGradientBlindsResources(gl)
    if (!resources) {
      return undefined
    }

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const compactViewportQuery = window.matchMedia("(max-width: 640px)")
    const colors = prepareStops(options.gradientColors)
    let frame = 0
    let lastTime = performance.now()
    let width = 1
    let height = 1
    let disposed = false
    let shouldAnimate = true

    const getShouldAnimate = () => {
      const bounds = canvas.getBoundingClientRect()
      return shouldAnimateAmbientBackground({
        prefersReducedMotion: reducedMotionQuery.matches,
        compactViewport: Math.min(bounds.width, bounds.height) < 360 || compactViewportQuery.matches,
        allowCompactViewport: true,
        documentHidden: document.hidden,
      })
    }

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = options.dpr
      width = Math.max(1, Math.floor(rect.width * dpr))
      height = Math.max(1, Math.floor(rect.height * dpr))

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }

      gl.viewport(0, 0, width, height)
      if (!options.enableMouseInteraction) {
        mouseRef.current.x = width / 2
        mouseRef.current.y = height / 2
        mouseRef.current.targetX = width / 2
        mouseRef.current.targetY = height / 2
      }
    }

    const getEffectiveBlindCount = () => {
      if (options.blindMinWidth <= 0) {
        return Math.max(1, options.blindCount)
      }

      const cssWidth = Math.max(1, canvas.getBoundingClientRect().width)
      const maxByMinWidth = Math.max(1, Math.floor(cssWidth / options.blindMinWidth))
      return Math.max(1, Math.min(options.blindCount, maxByMinWidth))
    }

    const draw = (now: number) => {
      if (disposed) {
        return
      }

      const delta = (now - lastTime) / 1000
      lastTime = now

      if (options.mouseDampening > 0) {
        const factor = Math.min(1, 1 - Math.exp(-delta / Math.max(0.0001, options.mouseDampening)))
        mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * factor
        mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * factor
      } else {
        mouseRef.current.x = mouseRef.current.targetX
        mouseRef.current.y = mouseRef.current.targetY
      }

      renderGradientBlinds(
        gl,
        resources,
        colors,
        options,
        width,
        height,
        getEffectiveBlindCount(),
        mouseRef.current.x,
        mouseRef.current.y,
        now * 0.001,
      )

      if (shouldAnimate) {
        frame = window.requestAnimationFrame(draw)
      }
    }

    const drawStatic = () => {
      window.cancelAnimationFrame(frame)
      draw(performance.now())
    }

    const start = () => {
      window.cancelAnimationFrame(frame)
      shouldAnimate = getShouldAnimate()
      lastTime = performance.now()
      if (shouldAnimate) {
        frame = window.requestAnimationFrame(draw)
      } else {
        drawStatic()
      }
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!options.enableMouseInteraction) {
        return
      }

      const rect = canvas.getBoundingClientRect()
      const scale = options.dpr
      mouseRef.current.targetX = (event.clientX - rect.left) * scale
      mouseRef.current.targetY = (rect.height - (event.clientY - rect.top)) * scale
      if (options.mouseDampening <= 0) {
        mouseRef.current.x = mouseRef.current.targetX
        mouseRef.current.y = mouseRef.current.targetY
      }
    }

    const handleVisibilityOrMotion = () => start()
    const resizeObserver = new ResizeObserver(() => {
      resize()
      shouldAnimate = getShouldAnimate()
      drawStatic()
    })

    resize()
    shouldAnimate = getShouldAnimate()
    resizeObserver.observe(canvas)
    document.addEventListener("visibilitychange", handleVisibilityOrMotion)
    window.addEventListener("resize", handleVisibilityOrMotion, { passive: true })
    reducedMotionQuery.addEventListener("change", handleVisibilityOrMotion)
    compactViewportQuery.addEventListener("change", handleVisibilityOrMotion)
    if (options.enableMouseInteraction) {
      window.addEventListener("pointermove", handlePointerMove, { passive: true })
    }
    start()

    return () => {
      disposed = true
      window.cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      document.removeEventListener("visibilitychange", handleVisibilityOrMotion)
      window.removeEventListener("resize", handleVisibilityOrMotion)
      reducedMotionQuery.removeEventListener("change", handleVisibilityOrMotion)
      compactViewportQuery.removeEventListener("change", handleVisibilityOrMotion)
      if (options.enableMouseInteraction) {
        window.removeEventListener("pointermove", handlePointerMove)
      }
      disposeGradientBlindsResources(gl, resources)
    }
  }, [options])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn(styles.massageLabGradientBlindsCanvas, className)}
      style={{ mixBlendMode: options.mixBlendMode }}
    />
  )
}

function createGradientBlindsResources(gl: WebGLRenderingContext): GradientBlindsResources | null {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource)
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource)
  if (!vertexShader || !fragmentShader) {
    return null
  }

  const program = gl.createProgram()
  if (!program) {
    return null
  }
  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program)
    gl.deleteShader(vertexShader)
    gl.deleteShader(fragmentShader)
    return null
  }

  const positionBuffer = createArrayBuffer(gl, new Float32Array([-1, -1, 3, -1, -1, 3]))
  const uvBuffer = createArrayBuffer(gl, new Float32Array([0, 0, 2, 0, 0, 2]))
  if (!positionBuffer || !uvBuffer) {
    gl.deleteProgram(program)
    gl.deleteShader(vertexShader)
    gl.deleteShader(fragmentShader)
    return null
  }

  return {
    program,
    vertexShader,
    fragmentShader,
    positionBuffer,
    uvBuffer,
    attributes: {
      position: gl.getAttribLocation(program, "position"),
      uv: gl.getAttribLocation(program, "uv"),
    },
    uniforms: {
      resolution: getUniformLocation(gl, program, "iResolution"),
      mouse: getUniformLocation(gl, program, "iMouse"),
      time: getUniformLocation(gl, program, "iTime"),
      angle: getUniformLocation(gl, program, "uAngle"),
      noise: getUniformLocation(gl, program, "uNoise"),
      blindCount: getUniformLocation(gl, program, "uBlindCount"),
      spotlightRadius: getUniformLocation(gl, program, "uSpotlightRadius"),
      spotlightSoftness: getUniformLocation(gl, program, "uSpotlightSoftness"),
      spotlightOpacity: getUniformLocation(gl, program, "uSpotlightOpacity"),
      mirror: getUniformLocation(gl, program, "uMirror"),
      distort: getUniformLocation(gl, program, "uDistort"),
      shineFlip: getUniformLocation(gl, program, "uShineFlip"),
      color0: getUniformLocation(gl, program, "uColor0"),
      color1: getUniformLocation(gl, program, "uColor1"),
      color2: getUniformLocation(gl, program, "uColor2"),
      color3: getUniformLocation(gl, program, "uColor3"),
      color4: getUniformLocation(gl, program, "uColor4"),
      color5: getUniformLocation(gl, program, "uColor5"),
      color6: getUniformLocation(gl, program, "uColor6"),
      color7: getUniformLocation(gl, program, "uColor7"),
      colorCount: getUniformLocation(gl, program, "uColorCount"),
    },
  }
}

function renderGradientBlinds(
  gl: WebGLRenderingContext,
  resources: GradientBlindsResources,
  colors: { values: RgbColor[]; count: number },
  options: ResolvedGradientBlindsOptions,
  width: number,
  height: number,
  blindCount: number,
  mouseX: number,
  mouseY: number,
  time: number,
) {
  gl.clearColor(0, 0, 0, 0)
  gl.clear(gl.COLOR_BUFFER_BIT)
  gl.disable(gl.DEPTH_TEST)
  gl.useProgram(resources.program)
  bindAttribute(gl, resources.positionBuffer, resources.attributes.position, 2)
  bindAttribute(gl, resources.uvBuffer, resources.attributes.uv, 2)

  gl.uniform3f(resources.uniforms.resolution, width, height, 1)
  gl.uniform2f(resources.uniforms.mouse, mouseX, mouseY)
  gl.uniform1f(resources.uniforms.time, time)
  gl.uniform1f(resources.uniforms.angle, (options.angle * Math.PI) / 180)
  gl.uniform1f(resources.uniforms.noise, options.noise)
  gl.uniform1f(resources.uniforms.blindCount, blindCount)
  gl.uniform1f(resources.uniforms.spotlightRadius, options.spotlightRadius)
  gl.uniform1f(resources.uniforms.spotlightSoftness, options.spotlightSoftness)
  gl.uniform1f(resources.uniforms.spotlightOpacity, options.spotlightOpacity)
  gl.uniform1f(resources.uniforms.mirror, options.mirrorGradient ? 1 : 0)
  gl.uniform1f(resources.uniforms.distort, options.distortAmount)
  gl.uniform1f(resources.uniforms.shineFlip, options.shineDirection === "right" ? 1 : 0)
  setUniformColor(gl, resources.uniforms.color0, colors.values[0])
  setUniformColor(gl, resources.uniforms.color1, colors.values[1])
  setUniformColor(gl, resources.uniforms.color2, colors.values[2])
  setUniformColor(gl, resources.uniforms.color3, colors.values[3])
  setUniformColor(gl, resources.uniforms.color4, colors.values[4])
  setUniformColor(gl, resources.uniforms.color5, colors.values[5])
  setUniformColor(gl, resources.uniforms.color6, colors.values[6])
  setUniformColor(gl, resources.uniforms.color7, colors.values[7])
  gl.uniform1i(resources.uniforms.colorCount, colors.count)
  gl.drawArrays(gl.TRIANGLES, 0, 3)
}

function bindAttribute(gl: WebGLRenderingContext, buffer: WebGLBuffer, location: number, size: number) {
  if (location < 0) {
    return
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.enableVertexAttribArray(location)
  gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0)
}

function createArrayBuffer(gl: WebGLRenderingContext, data: Float32Array): WebGLBuffer | null {
  const buffer = gl.createBuffer()
  if (!buffer) {
    return null
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
  return buffer
}

function disposeGradientBlindsResources(gl: WebGLRenderingContext, resources: GradientBlindsResources) {
  gl.deleteBuffer(resources.positionBuffer)
  gl.deleteBuffer(resources.uvBuffer)
  gl.deleteProgram(resources.program)
  gl.deleteShader(resources.vertexShader)
  gl.deleteShader(resources.fragmentShader)
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type)
  if (!shader) {
    return null
  }

  gl.shaderSource(shader, source)
  gl.compileShader(shader)

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader)
    return null
  }

  return shader
}

function getUniformLocation(
  gl: WebGLRenderingContext,
  program: WebGLProgram,
  name: string,
): WebGLUniformLocation {
  const location = gl.getUniformLocation(program, name)
  if (!location) {
    throw new Error(`Missing MassageLab Gradient Blinds uniform: ${name}`)
  }
  return location
}

function setUniformColor(gl: WebGLRenderingContext, location: WebGLUniformLocation, color?: RgbColor) {
  const [red, green, blue] = color ?? [1, 1, 1]
  gl.uniform3f(location, red, green, blue)
}

function prepareStops(stops: [string, string]) {
  const base = [...stops]
  if (base.length === 1) {
    base.push(base[0] ?? "#FFFFFF")
  }
  while (base.length < MAX_COLORS) {
    base.push(base[base.length - 1] ?? "#FFFFFF")
  }
  const values = base.slice(0, MAX_COLORS).map(hexToRgbColor)
  const count = Math.max(2, Math.min(MAX_COLORS, stops.length))
  return { values, count }
}

function resolveGradientBlindsOptions(options?: MassageLabGradientBlindsOptions): ResolvedGradientBlindsOptions {
  return {
    dpr: clampNumber(options?.dpr, DEFAULT_MASSAGELAB_GRADIENT_BLINDS.dpr, 0.5, 2),
    gradientColors: normalizeColorList(options?.gradientColors, DEFAULT_MASSAGELAB_GRADIENT_BLINDS.gradientColors),
    angle: clampNumber(options?.angle, DEFAULT_MASSAGELAB_GRADIENT_BLINDS.angle, -180, 180),
    noise: clampNumber(options?.noise, DEFAULT_MASSAGELAB_GRADIENT_BLINDS.noise, 0, 1),
    blindCount: Math.round(clampNumber(options?.blindCount, DEFAULT_MASSAGELAB_GRADIENT_BLINDS.blindCount, 1, 80)),
    blindMinWidth: clampNumber(options?.blindMinWidth, DEFAULT_MASSAGELAB_GRADIENT_BLINDS.blindMinWidth, 0, 240),
    mouseDampening: clampNumber(
      options?.mouseDampening,
      DEFAULT_MASSAGELAB_GRADIENT_BLINDS.mouseDampening,
      0,
      1,
    ),
    mirrorGradient: options?.mirrorGradient === true,
    spotlightRadius: clampNumber(
      options?.spotlightRadius,
      DEFAULT_MASSAGELAB_GRADIENT_BLINDS.spotlightRadius,
      0.05,
      1.5,
    ),
    spotlightSoftness: clampNumber(
      options?.spotlightSoftness,
      DEFAULT_MASSAGELAB_GRADIENT_BLINDS.spotlightSoftness,
      0.2,
      4,
    ),
    spotlightOpacity: clampNumber(
      options?.spotlightOpacity,
      DEFAULT_MASSAGELAB_GRADIENT_BLINDS.spotlightOpacity,
      0,
      2,
    ),
    distortAmount: clampNumber(options?.distortAmount, DEFAULT_MASSAGELAB_GRADIENT_BLINDS.distortAmount, 0, 5),
    shineDirection: options?.shineDirection === "right" ? "right" : "left",
    mixBlendMode: normalizeBlendMode(options?.mixBlendMode, DEFAULT_MASSAGELAB_GRADIENT_BLINDS.mixBlendMode),
    enableMouseInteraction: options?.enableMouseInteraction === true,
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
  if (typeof value !== "string") {
    return fallback
  }

  const normalized = value.trim()
  return /^#[0-9a-f]{6}$/i.test(normalized) ? normalized.toUpperCase() : fallback
}

function normalizeBlendMode(value: unknown, fallback: GradientBlindsBlendMode): GradientBlindsBlendMode {
  return value === "normal" || value === "screen" || value === "lighten" || value === "plus-lighter"
    ? value
    : fallback
}

function hexToRgbColor(hex: string): RgbColor {
  const normalized = normalizeHexColor(hex, "#FFFFFF").slice(1).padEnd(6, "0")
  const value = Number.parseInt(normalized, 16)
  return [
    ((value >> 16) & 255) / 255,
    ((value >> 8) & 255) / 255,
    (value & 255) / 255,
  ]
}
