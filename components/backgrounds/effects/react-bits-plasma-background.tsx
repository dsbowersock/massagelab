"use client"

import { useEffect, useMemo, useRef } from "react"
import { shouldAnimateAmbientBackground } from "@/lib/motion-preferences"
import { cn } from "@/lib/utils"
import styles from "@/components/backgrounds/BackgroundHost.module.css"
import type { BackgroundEffectProps, ReactBitsPlasmaOptions } from "./css-backgrounds"

type RgbColor = [number, number, number]
type ResolvedPlasmaOptions = Required<ReactBitsPlasmaOptions>

type PlasmaResources = {
  program: WebGLProgram
  vertexShader: WebGLShader
  fragmentShader: WebGLShader
  positionBuffer: WebGLBuffer
  attributes: { position: number }
  uniforms: {
    time: WebGLUniformLocation
    resolution: WebGLUniformLocation
    customColor: WebGLUniformLocation
    useCustomColor: WebGLUniformLocation
    speed: WebGLUniformLocation
    direction: WebGLUniformLocation
    scale: WebGLUniformLocation
    opacity: WebGLUniformLocation
    mouse: WebGLUniformLocation
    mouseInteractive: WebGLUniformLocation
  }
}

const DEFAULT_REACT_BITS_PLASMA: ResolvedPlasmaOptions = {
  color: "#FFFFFF",
  speed: 1,
  direction: "forward",
  scale: 1,
  opacity: 1,
  mouseInteractive: false,
}

const vertexShaderSource = `#version 300 es
  precision highp float;
  in vec2 position;

  void main() {
    gl_Position = vec4(position, 0.0, 1.0);
  }
`

const fragmentShaderSource = `#version 300 es
  precision highp float;

  uniform vec2 iResolution;
  uniform float iTime;
  uniform vec3 uCustomColor;
  uniform float uUseCustomColor;
  uniform float uSpeed;
  uniform float uDirection;
  uniform float uScale;
  uniform float uOpacity;
  uniform vec2 uMouse;
  uniform float uMouseInteractive;
  out vec4 fragColor;

  void mainImage(out vec4 o, vec2 C) {
    vec2 center = iResolution.xy * 0.5;
    C = (C - center) / uScale + center;

    vec2 mouseOffset = (uMouse - center) * 0.0002;
    C += mouseOffset * length(C - center) * step(0.5, uMouseInteractive);

    float i = 0.0;
    float d = 0.0;
    float z = 0.0;
    float T = iTime * uSpeed * uDirection;
    vec3 O = vec3(0.0);
    vec3 p;
    vec3 S;

    for (vec2 r = iResolution.xy, Q; ++i < 60.0; O += o.w / d * o.xyz) {
      p = z * normalize(vec3(C - 0.5 * r, r.y));
      p.z -= 4.0;
      S = p;
      d = p.y - T;

      p.x += 0.4 * (1.0 + p.y) * sin(d + p.x * 0.1) * cos(0.34 * d + p.x * 0.05);
      Q = p.xz *= mat2(cos(p.y + vec4(0.0, 11.0, 33.0, 0.0) - T));
      z += d = abs(sqrt(length(Q * Q)) - 0.25 * (5.0 + S.y)) / 3.0 + 8e-4;
      o = 1.0 + sin(S.y + p.z * 0.5 + S.z - length(S - p) + vec4(2.0, 1.0, 0.0, 8.0));
    }

    o.xyz = tanh(O / 1e4);
  }

  bool finite1(float x) {
    return !(isnan(x) || isinf(x));
  }

  vec3 sanitize(vec3 c) {
    return vec3(
      finite1(c.r) ? c.r : 0.0,
      finite1(c.g) ? c.g : 0.0,
      finite1(c.b) ? c.b : 0.0
    );
  }

  void main() {
    vec4 o = vec4(0.0);
    mainImage(o, gl_FragCoord.xy);
    vec3 rgb = sanitize(o.rgb);

    float intensity = (rgb.r + rgb.g + rgb.b) / 3.0;
    vec3 customColor = intensity * uCustomColor;
    vec3 finalColor = mix(rgb, customColor, step(0.5, uUseCustomColor));

    float alpha = length(rgb) * uOpacity;
    fragColor = vec4(finalColor, alpha);
  }
`

// React Bits Plasma is a WebGL2/OGL raymarch shader. MassageLab keeps the
// source loop, direction modes, color branch, and optional mouse warp.
export default function ReactBitsPlasmaBackground({
  className,
  reactBitsPlasma,
}: BackgroundEffectProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const options = useMemo(
    () => resolvePlasmaOptions(reactBitsPlasma),
    [
      reactBitsPlasma?.color,
      reactBitsPlasma?.speed,
      reactBitsPlasma?.direction,
      reactBitsPlasma?.scale,
      reactBitsPlasma?.opacity,
      reactBitsPlasma?.mouseInteractive,
    ],
  )
  const color = useMemo(() => parseHexColorToRgb(options.color), [options.color])

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    const context = canvas?.getContext("webgl2", {
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

    const resources = createPlasmaResources(context)

    if (!resources) {
      return undefined
    }

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const compactViewportQuery = window.matchMedia("(max-width: 480px)")
    const startTime = performance.now()
    let animationFrame = 0
    let resizeRetryFrame = 0
    let shouldRun = false
    let mouse = { x: 0, y: 0 }

    const resizeCanvas = () => {
      const bounds = container.getBoundingClientRect()
      const width = Math.max(1, Math.floor(bounds.width))
      const height = Math.max(1, Math.floor(bounds.height))

      if (width <= 1 || height <= 1) {
        return false
      }

      const dpr = Math.min(2, window.devicePixelRatio || 1)
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
      context.uniform3f(resources.uniforms.customColor, color[0], color[1], color[2])
      context.uniform1f(resources.uniforms.useCustomColor, 1)
      context.uniform1f(resources.uniforms.speed, options.speed * 0.4)
      context.uniform1f(resources.uniforms.direction, options.direction === "reverse" ? -1 : 1)
      context.uniform1f(resources.uniforms.scale, options.scale)
      context.uniform1f(resources.uniforms.opacity, options.opacity)
      context.uniform1f(resources.uniforms.mouseInteractive, options.mouseInteractive ? 1 : 0)
      context.clearColor(0, 0, 0, 0)
    }

    const getShaderTime = (time: number) => {
      const elapsed = (time - startTime) * 0.001

      if (options.direction !== "pingpong") {
        return elapsed
      }

      const pingpongDuration = 10
      const segmentTime = elapsed % pingpongDuration
      const isForward = Math.floor(elapsed / pingpongDuration) % 2 === 0
      const unit = segmentTime / pingpongDuration
      const smooth = unit * unit * (3 - 2 * unit)
      return isForward ? smooth * pingpongDuration : (1 - smooth) * pingpongDuration
    }

    const drawFrame = (time: number) => {
      context.clear(context.COLOR_BUFFER_BIT)
      context.uniform1f(resources.uniforms.time, getShaderTime(time))
      context.uniform2f(resources.uniforms.mouse, mouse.x, mouse.y)
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

    const handlePointerMove = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect()
      if (bounds.width <= 0 || bounds.height <= 0) {
        return
      }

      mouse = {
        x: (event.clientX - bounds.left) * (canvas.width / bounds.width),
        y: (event.clientY - bounds.top) * (canvas.height / bounds.height),
      }
    }

    const handlePointerLeave = () => {
      mouse = { x: 0, y: 0 }
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
    if (options.mouseInteractive) {
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
      if (options.mouseInteractive) {
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
    <div className={cn(styles.effectLayer, styles.reactBitsPlasma, className)} ref={containerRef}>
      <canvas className={styles.reactBitsPlasmaCanvas} ref={canvasRef} />
    </div>
  )
}

function createPlasmaResources(context: WebGL2RenderingContext): PlasmaResources | null {
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
      customColor: getUniformLocation(context, program, "uCustomColor"),
      useCustomColor: getUniformLocation(context, program, "uUseCustomColor"),
      speed: getUniformLocation(context, program, "uSpeed"),
      direction: getUniformLocation(context, program, "uDirection"),
      scale: getUniformLocation(context, program, "uScale"),
      opacity: getUniformLocation(context, program, "uOpacity"),
      mouse: getUniformLocation(context, program, "uMouse"),
      mouseInteractive: getUniformLocation(context, program, "uMouseInteractive"),
    },
  }
}

function compileShader(context: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
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
  context: WebGL2RenderingContext,
  program: WebGLProgram,
  name: string,
): WebGLUniformLocation {
  const location = context.getUniformLocation(program, name)

  if (!location) {
    throw new Error(`Missing React Bits Plasma uniform: ${name}`)
  }

  return location
}

function resolvePlasmaOptions(options?: ReactBitsPlasmaOptions): ResolvedPlasmaOptions {
  return {
    color: normalizeHexColor(options?.color, DEFAULT_REACT_BITS_PLASMA.color),
    speed: clampNumber(options?.speed, DEFAULT_REACT_BITS_PLASMA.speed, 0, 3),
    direction: resolveDirection(options?.direction),
    scale: clampNumber(options?.scale, DEFAULT_REACT_BITS_PLASMA.scale, 0.2, 4),
    opacity: clampNumber(options?.opacity, DEFAULT_REACT_BITS_PLASMA.opacity, 0, 1),
    mouseInteractive: typeof options?.mouseInteractive === "boolean"
      ? options.mouseInteractive
      : DEFAULT_REACT_BITS_PLASMA.mouseInteractive,
  }
}

function resolveDirection(value: unknown): ResolvedPlasmaOptions["direction"] {
  return value === "reverse" || value === "pingpong" ? value : "forward"
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
