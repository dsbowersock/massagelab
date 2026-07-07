"use client"

import { useEffect, useMemo, useRef } from "react"
import { shouldAnimateAmbientBackground } from "@/lib/motion-preferences"
import { cn } from "@/lib/utils"
import styles from "@/components/backgrounds/BackgroundHost.module.css"
import type { BackgroundEffectProps, MassageLabLineWavesOptions } from "./css-backgrounds"

type RgbColor = [number, number, number]
type ResolvedLineWavesOptions = Required<MassageLabLineWavesOptions>

type LineWavesResources = {
  program: WebGLProgram
  vertexShader: WebGLShader
  fragmentShader: WebGLShader
  positionBuffer: WebGLBuffer
  attributes: {
    position: number
  }
  uniforms: {
    time: WebGLUniformLocation
    resolution: WebGLUniformLocation
    speed: WebGLUniformLocation
    innerLines: WebGLUniformLocation
    outerLines: WebGLUniformLocation
    warpIntensity: WebGLUniformLocation
    rotation: WebGLUniformLocation
    edgeFadeWidth: WebGLUniformLocation
    colorCycleSpeed: WebGLUniformLocation
    brightness: WebGLUniformLocation
    color1: WebGLUniformLocation
    color2: WebGLUniformLocation
    color3: WebGLUniformLocation
    mouse: WebGLUniformLocation
    mouseInfluence: WebGLUniformLocation
    enableMouse: WebGLUniformLocation
  }
}

const DEFAULT_MASSAGELAB_LINE_WAVES: ResolvedLineWavesOptions = {
  speed: 0.3,
  innerLineCount: 32,
  outerLineCount: 36,
  warpIntensity: 1,
  rotation: -45,
  edgeFadeWidth: 0,
  colorCycleSpeed: 1,
  brightness: 0.2,
  color1: "#FFFFFF",
  color2: "#FFFFFF",
  color3: "#FFFFFF",
  enableMouseInteraction: false,
  mouseInfluence: 2,
}

const vertexShaderSource = `
  attribute vec2 aPosition;

  void main() {
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`

const fragmentShaderSource = `
  precision highp float;

  uniform float uTime;
  uniform vec3 uResolution;
  uniform float uSpeed;
  uniform float uInnerLines;
  uniform float uOuterLines;
  uniform float uWarpIntensity;
  uniform float uRotation;
  uniform float uEdgeFadeWidth;
  uniform float uColorCycleSpeed;
  uniform float uBrightness;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;
  uniform vec2 uMouse;
  uniform float uMouseInfluence;
  uniform bool uEnableMouse;

  #define HALF_PI 1.5707963

  float hashF(float n) {
    return fract(sin(n * 127.1) * 43758.5453123);
  }

  float smoothNoise(float x) {
    float i = floor(x);
    float f = fract(x);
    float u = f * f * (3.0 - 2.0 * f);
    return mix(hashF(i), hashF(i + 1.0), u);
  }

  float displaceA(float coord, float t) {
    float result = sin(coord * 2.123) * 0.2;
    result += sin(coord * 3.234 + t * 4.345) * 0.1;
    result += sin(coord * 0.589 + t * 0.934) * 0.5;
    return result;
  }

  float displaceB(float coord, float t) {
    float result = sin(coord * 1.345) * 0.3;
    result += sin(coord * 2.734 + t * 3.345) * 0.2;
    result += sin(coord * 0.189 + t * 0.934) * 0.3;
    return result;
  }

  vec2 rotate2D(vec2 p, float angle) {
    float c = cos(angle);
    float s = sin(angle);
    return vec2(p.x * c - p.y * s, p.x * s + p.y * c);
  }

  void main() {
    vec2 coords = gl_FragCoord.xy / uResolution.xy;
    coords = coords * 2.0 - 1.0;
    coords = rotate2D(coords, uRotation);

    float halfT = uTime * uSpeed * 0.5;
    float fullT = uTime * uSpeed;

    float mouseWarp = 0.0;
    if (uEnableMouse) {
      vec2 mPos = rotate2D(uMouse * 2.0 - 1.0, uRotation);
      float mDist = length(coords - mPos);
      mouseWarp = uMouseInfluence * exp(-mDist * mDist * 4.0);
    }

    float warpAx = coords.x + displaceA(coords.y, halfT) * uWarpIntensity + mouseWarp;
    float warpAy = coords.y - displaceA(coords.x * cos(fullT) * 1.235, halfT) * uWarpIntensity;
    float warpBx = coords.x + displaceB(coords.y, halfT) * uWarpIntensity + mouseWarp;
    float warpBy = coords.y - displaceB(coords.x * sin(fullT) * 1.235, halfT) * uWarpIntensity;

    vec2 fieldA = vec2(warpAx, warpAy);
    vec2 fieldB = vec2(warpBx, warpBy);
    vec2 blended = mix(fieldA, fieldB, mix(fieldA, fieldB, 0.5));

    float fadeTop = smoothstep(uEdgeFadeWidth, uEdgeFadeWidth + 0.4, blended.y);
    float fadeBottom = smoothstep(-uEdgeFadeWidth, -(uEdgeFadeWidth + 0.4), blended.y);
    float vMask = 1.0 - max(fadeTop, fadeBottom);

    float tileCount = mix(uOuterLines, uInnerLines, vMask);
    float scaledY = blended.y * tileCount;
    float nY = smoothNoise(abs(scaledY));

    float ridge = pow(
      step(abs(nY - blended.x) * 2.0, HALF_PI) * cos(2.0 * (nY - blended.x)),
      5.0
    );

    float lines = 0.0;
    for (float i = 1.0; i < 3.0; i += 1.0) {
      lines += pow(max(fract(scaledY), fract(-scaledY)), i * 2.0);
    }

    float pattern = vMask * lines;

    float cycleT = fullT * uColorCycleSpeed;
    float rChannel = (pattern + lines * ridge) * (cos(blended.y + cycleT * 0.234) * 0.5 + 1.0);
    float gChannel = (pattern + vMask * ridge) * (sin(blended.x + cycleT * 1.745) * 0.5 + 1.0);
    float bChannel = (pattern + lines * ridge) * (cos(blended.x + cycleT * 0.534) * 0.5 + 1.0);

    vec3 col = (rChannel * uColor1 + gChannel * uColor2 + bChannel * uColor3) * uBrightness;
    float alpha = clamp(length(col), 0.0, 1.0);

    gl_FragColor = vec4(col, alpha);
  }
`

// MassageLab Line Waves ships as an OGL full-screen shader. MassageLab keeps
// the source displacement, line, color-cycle, and mouse-warp math in raw WebGL.
export default function MassageLabLineWavesBackground({
  className,
  massageLabLineWaves,
}: BackgroundEffectProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const options = useMemo(
    () => resolveLineWavesOptions(massageLabLineWaves),
    [massageLabLineWaves],
  )
  const color1 = useMemo(() => parseHexColorToRgb(options.color1), [options.color1])
  const color2 = useMemo(() => parseHexColorToRgb(options.color2), [options.color2])
  const color3 = useMemo(() => parseHexColorToRgb(options.color3), [options.color3])

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

    const resources = createLineWavesResources(context)

    if (!resources) {
      return undefined
    }

    context.disable(context.DEPTH_TEST)
    context.disable(context.CULL_FACE)
    context.disable(context.BLEND)

    const resolution = new Float32Array(3)
    const startTimestamp = performance.now()
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const compactViewportQuery = window.matchMedia("(max-width: 360px), (max-height: 360px)")
    let animationFrame = 0
    let resizeRetryFrame = 0
    let shouldRun = false
    let mouseTarget = { x: 0.5, y: 0.5 }
    let mouseCurrent = { x: 0.5, y: 0.5 }

    const bindStaticUniforms = () => {
      context.useProgram(resources.program)
      context.uniform1f(resources.uniforms.speed, options.speed)
      context.uniform1f(resources.uniforms.innerLines, options.innerLineCount)
      context.uniform1f(resources.uniforms.outerLines, options.outerLineCount)
      context.uniform1f(resources.uniforms.warpIntensity, options.warpIntensity)
      context.uniform1f(resources.uniforms.rotation, (options.rotation * Math.PI) / 180)
      context.uniform1f(resources.uniforms.edgeFadeWidth, options.edgeFadeWidth)
      context.uniform1f(resources.uniforms.colorCycleSpeed, options.colorCycleSpeed)
      context.uniform1f(resources.uniforms.brightness, options.brightness)
      context.uniform3fv(resources.uniforms.color1, color1)
      context.uniform3fv(resources.uniforms.color2, color2)
      context.uniform3fv(resources.uniforms.color3, color3)
      context.uniform1f(resources.uniforms.mouseInfluence, options.mouseInfluence)
      context.uniform1i(resources.uniforms.enableMouse, options.enableMouseInteraction ? 1 : 0)
    }

    const drawFrame = (timestamp: number, animate: boolean) => {
      if (canvas.width <= 1 || canvas.height <= 1) {
        return false
      }

      if (options.enableMouseInteraction && animate) {
        mouseCurrent = {
          x: mouseCurrent.x + 0.05 * (mouseTarget.x - mouseCurrent.x),
          y: mouseCurrent.y + 0.05 * (mouseTarget.y - mouseCurrent.y),
        }
      } else {
        mouseCurrent = { x: 0.5, y: 0.5 }
      }

      const elapsedSeconds = animate ? Math.max(0, (timestamp - startTimestamp) / 1000) : 0
      context.viewport(0, 0, canvas.width, canvas.height)
      context.clearColor(0, 0, 0, 0)
      context.clear(context.COLOR_BUFFER_BIT)
      context.useProgram(resources.program)
      context.bindBuffer(context.ARRAY_BUFFER, resources.positionBuffer)
      context.enableVertexAttribArray(resources.attributes.position)
      context.vertexAttribPointer(resources.attributes.position, 2, context.FLOAT, false, 0, 0)
      context.uniform1f(resources.uniforms.time, elapsedSeconds)
      context.uniform3fv(resources.uniforms.resolution, resolution)
      context.uniform2f(resources.uniforms.mouse, mouseCurrent.x, mouseCurrent.y)
      context.drawArrays(context.TRIANGLES, 0, 3)

      return animate && (options.speed >= 1e-6 || options.enableMouseInteraction)
    }

    const resizeCanvas = () => {
      const bounds = container.getBoundingClientRect()
      const width = Math.floor(bounds.width)
      const height = Math.floor(bounds.height)

      if (width <= 0 || height <= 0) {
        return false
      }

      const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1))
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

    bindStaticUniforms()
    resizeObserver.observe(container)
    window.addEventListener("resize", startAnimation)
    document.addEventListener("visibilitychange", handleVisibilityChange)
    reducedMotionQuery.addEventListener("change", handleMotionChange)
    compactViewportQuery.addEventListener("change", handleMotionChange)
    if (options.enableMouseInteraction) {
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
      if (options.enableMouseInteraction) {
        window.removeEventListener("pointermove", handlePointerMove)
        window.removeEventListener("pointerleave", handlePointerLeave)
      }
      context.deleteBuffer(resources.positionBuffer)
      context.deleteProgram(resources.program)
      context.deleteShader(resources.vertexShader)
      context.deleteShader(resources.fragmentShader)
    }
  }, [color1, color2, color3, options])

  return (
    <div className={cn(styles.effectLayer, styles.massageLabLineWaves, className)} ref={containerRef}>
      <canvas className={styles.massageLabLineWavesCanvas} ref={canvasRef} />
    </div>
  )
}

function createLineWavesResources(context: WebGLRenderingContext): LineWavesResources | null {
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
      resolution: getUniformLocation(context, program, "uResolution"),
      speed: getUniformLocation(context, program, "uSpeed"),
      innerLines: getUniformLocation(context, program, "uInnerLines"),
      outerLines: getUniformLocation(context, program, "uOuterLines"),
      warpIntensity: getUniformLocation(context, program, "uWarpIntensity"),
      rotation: getUniformLocation(context, program, "uRotation"),
      edgeFadeWidth: getUniformLocation(context, program, "uEdgeFadeWidth"),
      colorCycleSpeed: getUniformLocation(context, program, "uColorCycleSpeed"),
      brightness: getUniformLocation(context, program, "uBrightness"),
      color1: getUniformLocation(context, program, "uColor1"),
      color2: getUniformLocation(context, program, "uColor2"),
      color3: getUniformLocation(context, program, "uColor3"),
      mouse: getUniformLocation(context, program, "uMouse"),
      mouseInfluence: getUniformLocation(context, program, "uMouseInfluence"),
      enableMouse: getUniformLocation(context, program, "uEnableMouse"),
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
    throw new Error(`Missing MassageLab Line Waves uniform: ${name}`)
  }

  return location
}

function resolveLineWavesOptions(options?: MassageLabLineWavesOptions): ResolvedLineWavesOptions {
  return {
    speed: clampNumber(options?.speed, DEFAULT_MASSAGELAB_LINE_WAVES.speed, 0, 3),
    innerLineCount: clampNumber(options?.innerLineCount, DEFAULT_MASSAGELAB_LINE_WAVES.innerLineCount, 1, 96),
    outerLineCount: clampNumber(options?.outerLineCount, DEFAULT_MASSAGELAB_LINE_WAVES.outerLineCount, 1, 96),
    warpIntensity: clampNumber(options?.warpIntensity, DEFAULT_MASSAGELAB_LINE_WAVES.warpIntensity, 0, 3),
    rotation: clampNumber(options?.rotation, DEFAULT_MASSAGELAB_LINE_WAVES.rotation, -180, 180),
    edgeFadeWidth: clampNumber(options?.edgeFadeWidth, DEFAULT_MASSAGELAB_LINE_WAVES.edgeFadeWidth, -1, 1),
    colorCycleSpeed: clampNumber(options?.colorCycleSpeed, DEFAULT_MASSAGELAB_LINE_WAVES.colorCycleSpeed, 0, 4),
    brightness: clampNumber(options?.brightness, DEFAULT_MASSAGELAB_LINE_WAVES.brightness, 0, 1.5),
    color1: normalizeHexColor(options?.color1, DEFAULT_MASSAGELAB_LINE_WAVES.color1),
    color2: normalizeHexColor(options?.color2, DEFAULT_MASSAGELAB_LINE_WAVES.color2),
    color3: normalizeHexColor(options?.color3, DEFAULT_MASSAGELAB_LINE_WAVES.color3),
    enableMouseInteraction: typeof options?.enableMouseInteraction === "boolean"
      ? options.enableMouseInteraction
      : DEFAULT_MASSAGELAB_LINE_WAVES.enableMouseInteraction,
    mouseInfluence: clampNumber(options?.mouseInfluence, DEFAULT_MASSAGELAB_LINE_WAVES.mouseInfluence, 0, 4),
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
  const red = Number.parseInt(normalized.slice(0, 2), 16) / 255
  const green = Number.parseInt(normalized.slice(2, 4), 16) / 255
  const blue = Number.parseInt(normalized.slice(4, 6), 16) / 255

  return [red, green, blue]
}
