"use client"

import { useEffect, useMemo, useRef } from "react"
import { shouldAnimateAmbientBackground } from "@/lib/motion-preferences"
import { cn } from "@/lib/utils"
import styles from "@/components/backgrounds/BackgroundHost.module.css"
import type { BackgroundEffectProps, MassageLabThreadsOptions } from "./css-backgrounds"

type RgbColor = [number, number, number]
type ResolvedThreadsOptions = Required<MassageLabThreadsOptions>

type ThreadsResources = {
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
    color: WebGLUniformLocation
    amplitude: WebGLUniformLocation
    distance: WebGLUniformLocation
    mouse: WebGLUniformLocation
  }
}

const DEFAULT_MASSAGELAB_THREADS: ResolvedThreadsOptions = {
  color: "#FFFFFF",
  amplitude: 1,
  distance: 0,
  enableMouseInteraction: false,
}

const MAX_RENDER_DIMENSION = 1920

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
  uniform vec3 uColor;
  uniform float uAmplitude;
  uniform float uDistance;
  uniform vec2 uMouse;

  #define PI 3.1415926538

  const int u_line_count = 40;
  const float u_line_width = 7.0;
  const float u_line_blur = 10.0;

  float Perlin2D(vec2 P) {
      vec2 Pi = floor(P);
      vec4 Pf_Pfmin1 = P.xyxy - vec4(Pi, Pi + 1.0);
      vec4 Pt = vec4(Pi.xy, Pi.xy + 1.0);
      Pt = Pt - floor(Pt * (1.0 / 71.0)) * 71.0;
      Pt += vec2(26.0, 161.0).xyxy;
      Pt *= Pt;
      Pt = Pt.xzxz * Pt.yyww;
      vec4 hash_x = fract(Pt * (1.0 / 951.135664));
      vec4 hash_y = fract(Pt * (1.0 / 642.949883));
      vec4 grad_x = hash_x - 0.49999;
      vec4 grad_y = hash_y - 0.49999;
      vec4 grad_results = inversesqrt(grad_x * grad_x + grad_y * grad_y)
          * (grad_x * Pf_Pfmin1.xzxz + grad_y * Pf_Pfmin1.yyww);
      grad_results *= 1.4142135623730950;
      vec2 blend = Pf_Pfmin1.xy * Pf_Pfmin1.xy * Pf_Pfmin1.xy
                 * (Pf_Pfmin1.xy * (Pf_Pfmin1.xy * 6.0 - 15.0) + 10.0);
      vec4 blend2 = vec4(blend, vec2(1.0 - blend));
      return dot(grad_results, blend2.zxzx * blend2.wwyy);
  }

  float pixel(float count, vec2 resolution) {
      return (1.0 / max(resolution.x, resolution.y)) * count;
  }

  float lineFn(vec2 st, float width, float perc, vec2 mouse, float time, float amplitude, float distance) {
      float split_offset = (perc * 0.4);
      float split_point = 0.1 + split_offset;

      float amplitude_normal = smoothstep(split_point, 0.7, st.x);
      float amplitude_strength = 0.5;
      float finalAmplitude = amplitude_normal * amplitude_strength
                             * amplitude * (1.0 + (mouse.y - 0.5) * 0.2);

      float time_scaled = time / 10.0 + (mouse.x - 0.5) * 1.0;
      float blur = smoothstep(split_point, split_point + 0.05, st.x) * perc;

      float xnoise = mix(
          Perlin2D(vec2(time_scaled, st.x + perc) * 2.5),
          Perlin2D(vec2(time_scaled, st.x + time_scaled) * 3.5) / 1.5,
          st.x * 0.3
      );

      float y = 0.5 + (perc - 0.5) * distance + xnoise / 2.0 * finalAmplitude;

      float line_start = smoothstep(
          y + (width / 2.0) + (u_line_blur * pixel(1.0, uResolution.xy) * blur),
          y,
          st.y
      );

      float line_end = smoothstep(
          y,
          y - (width / 2.0) - (u_line_blur * pixel(1.0, uResolution.xy) * blur),
          st.y
      );

      return clamp(
          (line_start - line_end) * (1.0 - smoothstep(0.0, 1.0, pow(perc, 0.3))),
          0.0,
          1.0
      );
  }

  void main() {
      vec2 uv = gl_FragCoord.xy / uResolution.xy;

      float line_strength = 1.0;
      for (int i = 0; i < u_line_count; i++) {
          float p = float(i) / float(u_line_count);
          line_strength *= (1.0 - lineFn(
              uv,
              u_line_width * pixel(1.0, uResolution.xy) * (1.0 - p),
              p,
              uMouse,
              uTime,
              uAmplitude,
              uDistance
          ));
      }

      float colorVal = 1.0 - line_strength;
      gl_FragColor = vec4(uColor * colorVal, colorVal);
  }
`

// MassageLab Threads ships as an OGL shader. MassageLab keeps the source
// Perlin thread field and mouse smoothing in raw WebGL without adding OGL.
export default function MassageLabThreadsBackground({
  className,
  massageLabThreads,
}: BackgroundEffectProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const options = useMemo(
    () => resolveThreadsOptions(massageLabThreads),
    [massageLabThreads],
  )
  const color = useMemo(() => parseHexColorToRgb(options.color), [options.color])

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

    const resources = createThreadsResources(context)

    if (!resources) {
      return undefined
    }

    context.disable(context.DEPTH_TEST)
    context.disable(context.CULL_FACE)
    context.enable(context.BLEND)
    context.blendFunc(context.SRC_ALPHA, context.ONE_MINUS_SRC_ALPHA)

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
      context.uniform3fv(resources.uniforms.color, color)
      context.uniform1f(resources.uniforms.amplitude, options.amplitude)
      context.uniform1f(resources.uniforms.distance, options.distance)
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

      return animate && (options.amplitude > 0 || options.enableMouseInteraction)
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
  }, [color, options])

  return (
    <div className={cn(styles.effectLayer, styles.massageLabThreads, className)} ref={containerRef}>
      <canvas className={styles.massageLabThreadsCanvas} ref={canvasRef} />
    </div>
  )
}

function createThreadsResources(context: WebGLRenderingContext): ThreadsResources | null {
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
      color: getUniformLocation(context, program, "uColor"),
      amplitude: getUniformLocation(context, program, "uAmplitude"),
      distance: getUniformLocation(context, program, "uDistance"),
      mouse: getUniformLocation(context, program, "uMouse"),
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
    throw new Error(`Missing MassageLab Threads uniform: ${name}`)
  }

  return location
}

function resolveThreadsOptions(options?: MassageLabThreadsOptions): ResolvedThreadsOptions {
  return {
    color: normalizeHexColor(options?.color, DEFAULT_MASSAGELAB_THREADS.color),
    amplitude: clampNumber(options?.amplitude, DEFAULT_MASSAGELAB_THREADS.amplitude, 0, 3),
    distance: clampNumber(options?.distance, DEFAULT_MASSAGELAB_THREADS.distance, -1, 1.5),
    enableMouseInteraction: typeof options?.enableMouseInteraction === "boolean"
      ? options.enableMouseInteraction
      : DEFAULT_MASSAGELAB_THREADS.enableMouseInteraction,
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
