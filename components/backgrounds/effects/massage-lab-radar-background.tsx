"use client"

import { useEffect, useMemo, useRef } from "react"
import { shouldAnimateAmbientBackground } from "@/lib/motion-preferences"
import { cn } from "@/lib/utils"
import styles from "@/components/backgrounds/BackgroundHost.module.css"
import type { BackgroundEffectProps, MassageLabRadarOptions } from "./css-backgrounds"

type RgbColor = [number, number, number]
type ResolvedRadarOptions = Required<MassageLabRadarOptions>

type RadarResources = {
  program: WebGLProgram
  vertexShader: WebGLShader
  fragmentShader: WebGLShader
  positionBuffer: WebGLBuffer
  attributes: { position: number }
  uniforms: {
    time: WebGLUniformLocation
    resolution: WebGLUniformLocation
    speed: WebGLUniformLocation
    scale: WebGLUniformLocation
    ringCount: WebGLUniformLocation
    spokeCount: WebGLUniformLocation
    ringThickness: WebGLUniformLocation
    spokeThickness: WebGLUniformLocation
    sweepSpeed: WebGLUniformLocation
    sweepWidth: WebGLUniformLocation
    sweepLobes: WebGLUniformLocation
    color: WebGLUniformLocation
    backgroundColor: WebGLUniformLocation
    falloff: WebGLUniformLocation
    brightness: WebGLUniformLocation
    mouse: WebGLUniformLocation
    mouseInfluence: WebGLUniformLocation
    enableMouse: WebGLUniformLocation
  }
}

const DEFAULT_MASSAGELAB_RADAR: ResolvedRadarOptions = {
  speed: 1,
  scale: 0.5,
  ringCount: 10,
  spokeCount: 10,
  ringThickness: 0.05,
  spokeThickness: 0.01,
  sweepSpeed: 1,
  sweepWidth: 2,
  sweepLobes: 1,
  color: "#9F29FF",
  backgroundColor: "#000000",
  falloff: 2,
  brightness: 1,
  enableMouseInteraction: false,
  mouseInfluence: 0.1,
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
  uniform float uScale;
  uniform float uRingCount;
  uniform float uSpokeCount;
  uniform float uRingThickness;
  uniform float uSpokeThickness;
  uniform float uSweepSpeed;
  uniform float uSweepWidth;
  uniform float uSweepLobes;
  uniform vec3 uColor;
  uniform vec3 uBgColor;
  uniform float uFalloff;
  uniform float uBrightness;
  uniform vec2 uMouse;
  uniform float uMouseInfluence;
  uniform bool uEnableMouse;

  #define TAU 6.28318530718

  void main() {
    vec2 st = gl_FragCoord.xy / uResolution.xy;
    st = st * 2.0 - 1.0;
    st.x *= uResolution.x / uResolution.y;

    if (uEnableMouse) {
      vec2 mShift = (uMouse * 2.0 - 1.0);
      mShift.x *= uResolution.x / uResolution.y;
      st -= mShift * uMouseInfluence;
    }

    st *= uScale;

    float dist = length(st);
    float theta = atan(st.y, st.x);
    float t = uTime * uSpeed;

    float ringPhase = dist * uRingCount - t;
    float ringDist = abs(fract(ringPhase) - 0.5);
    float ringGlow = 1.0 - smoothstep(0.0, uRingThickness, ringDist);

    float spokeAngle = abs(fract(theta * uSpokeCount / TAU + 0.5) - 0.5) * TAU / uSpokeCount;
    float arcDist = spokeAngle * dist;
    float spokeGlow = (1.0 - smoothstep(0.0, uSpokeThickness, arcDist)) * smoothstep(0.0, 0.1, dist);

    float sweepPhase = t * uSweepSpeed;
    float sweepBeam = pow(max(0.5 * sin(uSweepLobes * theta + sweepPhase) + 0.5, 0.0), uSweepWidth);

    float fade = smoothstep(1.05, 0.85, dist) * pow(max(1.0 - dist, 0.0), uFalloff);

    float intensity = max((ringGlow + spokeGlow + sweepBeam) * fade * uBrightness, 0.0);
    vec3 col = uColor * intensity + uBgColor;

    float alpha = clamp(length(col), 0.0, 1.0);
    gl_FragColor = vec4(col, alpha);
  }
`

// MassageLab Radar ships as an OGL full-screen shader. MassageLab keeps the
// source ring, spoke, sweep, falloff, and optional mouse-offset math in WebGL.
export default function MassageLabRadarBackground({
  className,
  massageLabRadar,
}: BackgroundEffectProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const options = useMemo(
    () => resolveRadarOptions(massageLabRadar),
    [massageLabRadar],
  )
  const color = useMemo(() => parseHexColorToRgb(options.color), [options.color])
  const backgroundColor = useMemo(
    () => parseHexColorToRgb(options.backgroundColor),
    [options.backgroundColor],
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

    const resources = createRadarResources(context)

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
      context.uniform1f(resources.uniforms.scale, options.scale)
      context.uniform1f(resources.uniforms.ringCount, options.ringCount)
      context.uniform1f(resources.uniforms.spokeCount, options.spokeCount)
      context.uniform1f(resources.uniforms.ringThickness, options.ringThickness)
      context.uniform1f(resources.uniforms.spokeThickness, options.spokeThickness)
      context.uniform1f(resources.uniforms.sweepSpeed, options.sweepSpeed)
      context.uniform1f(resources.uniforms.sweepWidth, options.sweepWidth)
      context.uniform1f(resources.uniforms.sweepLobes, options.sweepLobes)
      context.uniform3fv(resources.uniforms.color, color)
      context.uniform3fv(resources.uniforms.backgroundColor, backgroundColor)
      context.uniform1f(resources.uniforms.falloff, options.falloff)
      context.uniform1f(resources.uniforms.brightness, options.brightness)
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
  }, [backgroundColor, color, options])

  return (
    <div className={cn(styles.effectLayer, styles.massageLabRadar, className)} ref={containerRef}>
      <canvas className={styles.massageLabRadarCanvas} ref={canvasRef} />
    </div>
  )
}

function createRadarResources(context: WebGLRenderingContext): RadarResources | null {
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
      position: context.getAttribLocation(program, "aPosition"),
    },
    uniforms: {
      time: getUniformLocation(context, program, "uTime"),
      resolution: getUniformLocation(context, program, "uResolution"),
      speed: getUniformLocation(context, program, "uSpeed"),
      scale: getUniformLocation(context, program, "uScale"),
      ringCount: getUniformLocation(context, program, "uRingCount"),
      spokeCount: getUniformLocation(context, program, "uSpokeCount"),
      ringThickness: getUniformLocation(context, program, "uRingThickness"),
      spokeThickness: getUniformLocation(context, program, "uSpokeThickness"),
      sweepSpeed: getUniformLocation(context, program, "uSweepSpeed"),
      sweepWidth: getUniformLocation(context, program, "uSweepWidth"),
      sweepLobes: getUniformLocation(context, program, "uSweepLobes"),
      color: getUniformLocation(context, program, "uColor"),
      backgroundColor: getUniformLocation(context, program, "uBgColor"),
      falloff: getUniformLocation(context, program, "uFalloff"),
      brightness: getUniformLocation(context, program, "uBrightness"),
      mouse: getUniformLocation(context, program, "uMouse"),
      mouseInfluence: getUniformLocation(context, program, "uMouseInfluence"),
      enableMouse: getUniformLocation(context, program, "uEnableMouse"),
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
    throw new Error(`Missing MassageLab Radar uniform: ${name}`)
  }

  return location
}

function resolveRadarOptions(options?: MassageLabRadarOptions): ResolvedRadarOptions {
  return {
    speed: clampNumber(options?.speed, DEFAULT_MASSAGELAB_RADAR.speed, 0, 3),
    scale: clampNumber(options?.scale, DEFAULT_MASSAGELAB_RADAR.scale, 0.1, 2),
    ringCount: clampNumber(options?.ringCount, DEFAULT_MASSAGELAB_RADAR.ringCount, 1, 40),
    spokeCount: clampNumber(options?.spokeCount, DEFAULT_MASSAGELAB_RADAR.spokeCount, 1, 40),
    ringThickness: clampNumber(options?.ringThickness, DEFAULT_MASSAGELAB_RADAR.ringThickness, 0.001, 0.25),
    spokeThickness: clampNumber(options?.spokeThickness, DEFAULT_MASSAGELAB_RADAR.spokeThickness, 0.001, 0.1),
    sweepSpeed: clampNumber(options?.sweepSpeed, DEFAULT_MASSAGELAB_RADAR.sweepSpeed, 0, 4),
    sweepWidth: clampNumber(options?.sweepWidth, DEFAULT_MASSAGELAB_RADAR.sweepWidth, 0.1, 12),
    sweepLobes: clampNumber(options?.sweepLobes, DEFAULT_MASSAGELAB_RADAR.sweepLobes, 1, 12),
    color: normalizeHexColor(options?.color, DEFAULT_MASSAGELAB_RADAR.color),
    backgroundColor: normalizeHexColor(options?.backgroundColor, DEFAULT_MASSAGELAB_RADAR.backgroundColor),
    falloff: clampNumber(options?.falloff, DEFAULT_MASSAGELAB_RADAR.falloff, 0, 8),
    brightness: clampNumber(options?.brightness, DEFAULT_MASSAGELAB_RADAR.brightness, 0, 3),
    enableMouseInteraction: typeof options?.enableMouseInteraction === "boolean"
      ? options.enableMouseInteraction
      : DEFAULT_MASSAGELAB_RADAR.enableMouseInteraction,
    mouseInfluence: clampNumber(options?.mouseInfluence, DEFAULT_MASSAGELAB_RADAR.mouseInfluence, 0, 1),
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
