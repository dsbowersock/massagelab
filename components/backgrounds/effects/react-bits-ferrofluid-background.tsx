"use client"

import { useEffect, useMemo, useRef } from "react"
import { shouldAnimateAmbientBackground } from "@/lib/motion-preferences"
import { cn } from "@/lib/utils"
import styles from "@/components/backgrounds/BackgroundHost.module.css"
import type { BackgroundEffectProps, ReactBitsFerrofluidOptions } from "./css-backgrounds"

type FlowDirection = NonNullable<ReactBitsFerrofluidOptions["flowDirection"]>
type RgbColor = [number, number, number]
type ResolvedFerrofluidOptions = Required<Omit<ReactBitsFerrofluidOptions, "colors">> & {
  colors: string[]
}

type FerrofluidWebGlResources = {
  program: WebGLProgram
  vertexShader: WebGLShader
  fragmentShader: WebGLShader
  positionBuffer: WebGLBuffer
  attributes: {
    position: number
  }
  uniforms: {
    resolution: WebGLUniformLocation
    mouse: WebGLUniformLocation
    time: WebGLUniformLocation
    color0: WebGLUniformLocation
    color1: WebGLUniformLocation
    color2: WebGLUniformLocation
    color3: WebGLUniformLocation
    color4: WebGLUniformLocation
    color5: WebGLUniformLocation
    color6: WebGLUniformLocation
    color7: WebGLUniformLocation
    colorCount: WebGLUniformLocation
    flow: WebGLUniformLocation
    speed: WebGLUniformLocation
    scale: WebGLUniformLocation
    turbulence: WebGLUniformLocation
    fluidity: WebGLUniformLocation
    rimWidth: WebGLUniformLocation
    sharpness: WebGLUniformLocation
    shimmer: WebGLUniformLocation
    glow: WebGLUniformLocation
    opacity: WebGLUniformLocation
    mouseEnabled: WebGLUniformLocation
    mouseStrength: WebGLUniformLocation
    mouseRadius: WebGLUniformLocation
  }
}

const MAX_FERROFLUID_COLORS = 8
const DEFAULT_REACT_BITS_FERROFLUID: ResolvedFerrofluidOptions = {
  colors: ["#FFFFFF", "#FFFFFF", "#FFFFFF"],
  speed: 0.5,
  scale: 1.6,
  turbulence: 1,
  fluidity: 0.1,
  rimWidth: 0.2,
  sharpness: 2.5,
  shimmer: 1.5,
  glow: 2,
  flowDirection: "down",
  opacity: 1,
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

  uniform vec3  iResolution;
  uniform vec2  iMouse;
  uniform float iTime;

  uniform vec3  uColor0;
  uniform vec3  uColor1;
  uniform vec3  uColor2;
  uniform vec3  uColor3;
  uniform vec3  uColor4;
  uniform vec3  uColor5;
  uniform vec3  uColor6;
  uniform vec3  uColor7;
  uniform int   uColorCount;

  uniform vec2  uFlow;
  uniform float uSpeed;
  uniform float uScale;
  uniform float uTurbulence;
  uniform float uFluidity;
  uniform float uRimWidth;
  uniform float uSharpness;
  uniform float uShimmer;
  uniform float uGlow;
  uniform float uOpacity;
  uniform float uMouseEnabled;
  uniform float uMouseStrength;
  uniform float uMouseRadius;

  varying vec2 vUv;

  #define PI 3.14159265

  vec3 palette(float h) {
    int count = uColorCount;
    if (count < 1) count = 1;
    int idx = int(floor(clamp(h, 0.0, 0.999999) * float(count)));
    if (idx <= 0) return uColor0;
    if (idx == 1) return uColor1;
    if (idx == 2) return uColor2;
    if (idx == 3) return uColor3;
    if (idx == 4) return uColor4;
    if (idx == 5) return uColor5;
    if (idx == 6) return uColor6;
    return uColor7;
  }

  float hash(vec3 p3) {
    p3 = fract(p3 * 0.1031);
    p3 += dot(p3, p3.zyx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  float smin(float a, float b, float k) {
    float r = exp2(-a / k) + exp2(-b / k);
    return -k * log2(r);
  }

  float sinlerp(float a, float b, float w) {
    return mix(a, b, (sin(w * PI - PI / 2.0) + 1.0) / 2.0);
  }

  float vn(vec2 p, float s, float seed) {
    vec2 cellp = floor(p / s);
    vec2 relp = mod(p, s);
    float g1 = hash(vec3(cellp, seed));
    float g2 = hash(vec3(cellp.x + 1.0, cellp.y, seed));
    float g3 = hash(vec3(cellp.x + 1.0, cellp.y + 1.0, seed));
    float g4 = hash(vec3(cellp.x, cellp.y + 1.0, seed));
    float bx = sinlerp(g1, g2, relp.x / s);
    float tx = sinlerp(g4, g3, relp.x / s);
    return sinlerp(bx, tx, relp.y / s);
  }

  float dbn(vec2 p, float s, float seed) {
    float o = s / 2.0;
    float n0 = vn(p, s, seed);
    float n1 = vn(p + vec2(o, o), s, seed + 0.1);
    float n2 = vn(p + vec2(-o, o), s, seed + 0.2);
    float n3 = vn(p + vec2(o, -o), s, seed + 0.3);
    float n4 = vn(p + vec2(-o, -o), s, seed + 0.4);
    return (2.0 * n0 + 1.5 * n1 + 1.25 * n2 + 1.125 * n3 + n4) / 7.0;
  }

  void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    float ref = 700.0 / max(uScale, 0.05);
    vec2 p = fragCoord / iResolution.y * ref;

    float spd = 200.0 * uSpeed;
    float t = iTime;

    vec2 dir = uFlow;
    vec2 perp = vec2(-dir.y, dir.x);

    float distort1 = vn(p + perp * (t * spd), 60.0, 10.0) * 50.0 * uTurbulence;
    float distort2 = vn(p - perp * (t * spd), 120.0, 15.0) * 100.0 * uTurbulence;

    float peaks = dbn(p + distort1 + dir * (t * spd * 0.5), 40.0, 1.0);
    float peaks2 = dbn(p + distort2 - dir * (t * spd * 0.5), 40.0, 0.0);

    float mapeaks = smin(peaks, peaks2, max(uFluidity, 0.001));

    float mGlow = 0.0;
    if (uMouseEnabled > 0.5) {
      vec2 mp = iMouse / iResolution.y * ref;
      float md = length(p - mp) / ref;
      float rr = max(uMouseRadius, 0.02);
      mGlow = exp(-md * md / (rr * rr)) * uMouseStrength;
    }

    float band = (uRimWidth - abs((mapeaks - 0.4) * 2.0)) * 5.0;
    float ltn = clamp(band - vn(p + dir * (t * spd * 0.5), 60.0, 12.0) * uShimmer, 0.0, 1.0);
    ltn = pow(ltn, uSharpness) * uGlow;
    ltn *= clamp(1.0 - mGlow, 0.0, 1.0);

    float h = clamp(0.5 + (peaks - peaks2) * 0.8, 0.0, 1.0);
    vec3 col = palette(h);

    vec3 outc = col * ltn;
    float a = clamp(max(outc.r, max(outc.g, outc.b)), 0.0, 1.0);
    fragColor = vec4(outc, a * uOpacity);
  }

  void main() {
    vec4 color;
    mainImage(color, vUv * iResolution.xy);
    gl_FragColor = color;
  }
`

// React Bits Ferrofluid ships as an OGL component. MassageLab ports the shader
// directly so the premium background stays dependency-free and pointer-passive.
export default function ReactBitsFerrofluidBackground({
  className,
  reactBitsFerrofluid,
}: BackgroundEffectProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const colorsKey = (reactBitsFerrofluid?.colors ?? []).join("|")
  const speed = reactBitsFerrofluid?.speed
  const scale = reactBitsFerrofluid?.scale
  const turbulence = reactBitsFerrofluid?.turbulence
  const fluidity = reactBitsFerrofluid?.fluidity
  const rimWidth = reactBitsFerrofluid?.rimWidth
  const sharpness = reactBitsFerrofluid?.sharpness
  const shimmer = reactBitsFerrofluid?.shimmer
  const glow = reactBitsFerrofluid?.glow
  const flowDirection = reactBitsFerrofluid?.flowDirection
  const opacity = reactBitsFerrofluid?.opacity
  const options = useMemo(
    () => resolveFerrofluidOptions({
      colors: colorsKey ? colorsKey.split("|") : undefined,
      speed,
      scale,
      turbulence,
      fluidity,
      rimWidth,
      sharpness,
      shimmer,
      glow,
      flowDirection,
      opacity,
    }),
    [colorsKey, flowDirection, fluidity, glow, opacity, rimWidth, scale, sharpness, shimmer, speed, turbulence],
  )
  const palette = useMemo(() => prepFerrofluidColors(options.colors), [options.colors])
  const flow = useMemo(() => getFlowVector(options.flowDirection), [options.flowDirection])

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    const context = canvas?.getContext("webgl", {
      alpha: true,
      antialias: true,
      depth: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false,
      stencil: false,
    })

    if (!container || !canvas || !context) {
      return undefined
    }

    const resources = createFerrofluidResources(context)

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

    const setColorUniforms = () => {
      context.uniform3f(resources.uniforms.color0, palette.arr[0][0], palette.arr[0][1], palette.arr[0][2])
      context.uniform3f(resources.uniforms.color1, palette.arr[1][0], palette.arr[1][1], palette.arr[1][2])
      context.uniform3f(resources.uniforms.color2, palette.arr[2][0], palette.arr[2][1], palette.arr[2][2])
      context.uniform3f(resources.uniforms.color3, palette.arr[3][0], palette.arr[3][1], palette.arr[3][2])
      context.uniform3f(resources.uniforms.color4, palette.arr[4][0], palette.arr[4][1], palette.arr[4][2])
      context.uniform3f(resources.uniforms.color5, palette.arr[5][0], palette.arr[5][1], palette.arr[5][2])
      context.uniform3f(resources.uniforms.color6, palette.arr[6][0], palette.arr[6][1], palette.arr[6][2])
      context.uniform3f(resources.uniforms.color7, palette.arr[7][0], palette.arr[7][1], palette.arr[7][2])
      context.uniform1i(resources.uniforms.colorCount, palette.count)
    }

    const drawFrame = (timestamp: number, animate: boolean) => {
      if (canvas.width <= 1 || canvas.height <= 1) {
        return
      }

      const elapsedSeconds = Math.max(0, (timestamp - startTimestamp) / 1000)
      const time = animate ? elapsedSeconds % (60 * Math.PI) : 0

      context.viewport(0, 0, canvas.width, canvas.height)
      context.clearColor(0, 0, 0, 0)
      context.clear(context.COLOR_BUFFER_BIT)
      context.useProgram(resources.program)
      context.bindBuffer(context.ARRAY_BUFFER, resources.positionBuffer)
      context.enableVertexAttribArray(resources.attributes.position)
      context.vertexAttribPointer(resources.attributes.position, 2, context.FLOAT, false, 0, 0)
      context.enable(context.BLEND)
      context.blendFunc(context.SRC_ALPHA, context.ONE_MINUS_SRC_ALPHA)
      context.uniform3f(resources.uniforms.resolution, canvas.width, canvas.height, 1)
      context.uniform2f(resources.uniforms.mouse, canvas.width * 0.5, canvas.height * 0.5)
      context.uniform1f(resources.uniforms.time, time)
      setColorUniforms()
      context.uniform2f(resources.uniforms.flow, flow[0], flow[1])
      context.uniform1f(resources.uniforms.speed, options.speed)
      context.uniform1f(resources.uniforms.scale, options.scale)
      context.uniform1f(resources.uniforms.turbulence, options.turbulence)
      context.uniform1f(resources.uniforms.fluidity, options.fluidity)
      context.uniform1f(resources.uniforms.rimWidth, options.rimWidth)
      context.uniform1f(resources.uniforms.sharpness, options.sharpness)
      context.uniform1f(resources.uniforms.shimmer, options.shimmer)
      context.uniform1f(resources.uniforms.glow, options.glow)
      context.uniform1f(resources.uniforms.opacity, options.opacity)
      context.uniform1f(resources.uniforms.mouseEnabled, 0)
      context.uniform1f(resources.uniforms.mouseStrength, 0)
      context.uniform1f(resources.uniforms.mouseRadius, 0.35)
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
  }, [flow, options, palette])

  return (
    <div
      ref={containerRef}
      className={cn(styles.effectLayer, styles.reactBitsFerrofluid, className)}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className={styles.reactBitsFerrofluidCanvas} />
    </div>
  )
}

function createFerrofluidResources(context: WebGLRenderingContext): FerrofluidWebGlResources | null {
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
      resolution: getUniformLocation(context, program, "iResolution"),
      mouse: getUniformLocation(context, program, "iMouse"),
      time: getUniformLocation(context, program, "iTime"),
      color0: getUniformLocation(context, program, "uColor0"),
      color1: getUniformLocation(context, program, "uColor1"),
      color2: getUniformLocation(context, program, "uColor2"),
      color3: getUniformLocation(context, program, "uColor3"),
      color4: getUniformLocation(context, program, "uColor4"),
      color5: getUniformLocation(context, program, "uColor5"),
      color6: getUniformLocation(context, program, "uColor6"),
      color7: getUniformLocation(context, program, "uColor7"),
      colorCount: getUniformLocation(context, program, "uColorCount"),
      flow: getUniformLocation(context, program, "uFlow"),
      speed: getUniformLocation(context, program, "uSpeed"),
      scale: getUniformLocation(context, program, "uScale"),
      turbulence: getUniformLocation(context, program, "uTurbulence"),
      fluidity: getUniformLocation(context, program, "uFluidity"),
      rimWidth: getUniformLocation(context, program, "uRimWidth"),
      sharpness: getUniformLocation(context, program, "uSharpness"),
      shimmer: getUniformLocation(context, program, "uShimmer"),
      glow: getUniformLocation(context, program, "uGlow"),
      opacity: getUniformLocation(context, program, "uOpacity"),
      mouseEnabled: getUniformLocation(context, program, "uMouseEnabled"),
      mouseStrength: getUniformLocation(context, program, "uMouseStrength"),
      mouseRadius: getUniformLocation(context, program, "uMouseRadius"),
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
    throw new Error(`Missing React Bits Ferrofluid shader uniform: ${name}`)
  }

  return location
}

function resolveFerrofluidOptions(options: ReactBitsFerrofluidOptions | undefined): ResolvedFerrofluidOptions {
  return {
    colors: resolveFerrofluidColors(options?.colors),
    speed: clampNumber(options?.speed, DEFAULT_REACT_BITS_FERROFLUID.speed, 0.05, 2),
    scale: clampNumber(options?.scale, DEFAULT_REACT_BITS_FERROFLUID.scale, 0.5, 4),
    turbulence: clampNumber(options?.turbulence, DEFAULT_REACT_BITS_FERROFLUID.turbulence, 0, 2),
    fluidity: clampNumber(options?.fluidity, DEFAULT_REACT_BITS_FERROFLUID.fluidity, 0.001, 0.4),
    rimWidth: clampNumber(options?.rimWidth, DEFAULT_REACT_BITS_FERROFLUID.rimWidth, 0.03, 0.5),
    sharpness: clampNumber(options?.sharpness, DEFAULT_REACT_BITS_FERROFLUID.sharpness, 0.5, 6),
    shimmer: clampNumber(options?.shimmer, DEFAULT_REACT_BITS_FERROFLUID.shimmer, 0, 4),
    glow: clampNumber(options?.glow, DEFAULT_REACT_BITS_FERROFLUID.glow, 0.1, 5),
    flowDirection: resolveFlowDirection(options?.flowDirection),
    opacity: clampNumber(options?.opacity, DEFAULT_REACT_BITS_FERROFLUID.opacity, 0.05, 1),
  }
}

function resolveFerrofluidColors(colors: string[] | undefined) {
  const sanitized = (Array.isArray(colors) ? colors : [])
    .map((color) => normalizeHexColor(color, ""))
    .filter(Boolean)
    .slice(0, MAX_FERROFLUID_COLORS)

  return sanitized.length ? sanitized : DEFAULT_REACT_BITS_FERROFLUID.colors
}

function prepFerrofluidColors(colors: string[]) {
  const base = resolveFerrofluidColors(colors)
  const arr: RgbColor[] = []
  for (let index = 0; index < MAX_FERROFLUID_COLORS; index += 1) {
    arr.push(parseHexColorToRgb(base[Math.min(index, base.length - 1)] ?? DEFAULT_REACT_BITS_FERROFLUID.colors[0]))
  }

  return {
    arr,
    count: base.length,
  }
}

function resolveFlowDirection(value: FlowDirection | undefined): FlowDirection {
  return value === "up" || value === "left" || value === "right" || value === "down"
    ? value
    : DEFAULT_REACT_BITS_FERROFLUID.flowDirection
}

function getFlowVector(direction: FlowDirection): [number, number] {
  switch (direction) {
    case "up":
      return [0, 1]
    case "left":
      return [-1, 0]
    case "right":
      return [1, 0]
    case "down":
    default:
      return [0, -1]
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
