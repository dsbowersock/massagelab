"use client"

import { useEffect, useMemo, useRef } from "react"
import { shouldAnimateAmbientBackground } from "@/lib/motion-preferences"
import { cn } from "@/lib/utils"
import styles from "@/components/backgrounds/BackgroundHost.module.css"
import type { BackgroundEffectProps, ReactBitsLiquidChromeOptions } from "./css-backgrounds"

type ResolvedLiquidChromeOptions = Required<ReactBitsLiquidChromeOptions>

type LiquidChromeResources = {
  program: WebGLProgram
  vertexShader: WebGLShader
  fragmentShader: WebGLShader
  vertexBuffer: WebGLBuffer
  uvBuffer: WebGLBuffer
  attributes: {
    position: number
    uv: number
  }
  uniforms: {
    time: WebGLUniformLocation
    resolution: WebGLUniformLocation
    baseColor: WebGLUniformLocation
    amplitude: WebGLUniformLocation
    frequencyX: WebGLUniformLocation
    frequencyY: WebGLUniformLocation
    mouse: WebGLUniformLocation
  }
}

const DEFAULT_REACT_BITS_LIQUID_CHROME: ResolvedLiquidChromeOptions = {
  baseColor: "#1A1A1A",
  speed: 0.2,
  amplitude: 0.3,
  frequencyX: 3,
  frequencyY: 3,
  interactive: true,
}

const vertexShaderSource = `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}`

const fragmentShaderSource = `
precision highp float;

uniform float uTime;
uniform vec3 uResolution;
uniform vec3 uBaseColor;
uniform float uAmplitude;
uniform float uFrequencyX;
uniform float uFrequencyY;
uniform vec2 uMouse;
varying vec2 vUv;

vec4 renderImage(vec2 uvCoord) {
  vec2 fragCoord = uvCoord * uResolution.xy;
  vec2 uv = (2.0 * fragCoord - uResolution.xy) / min(uResolution.x, uResolution.y);

  for (float i = 1.0; i < 10.0; i++) {
    uv.x += uAmplitude / i * cos(i * uFrequencyX * uv.y + uTime + uMouse.x * 3.14159);
    uv.y += uAmplitude / i * cos(i * uFrequencyY * uv.x + uTime + uMouse.y * 3.14159);
  }

  vec2 diff = uvCoord - uMouse;
  float dist = length(diff);
  float falloff = exp(-dist * 20.0);
  float ripple = sin(10.0 * dist - uTime * 2.0) * 0.03;
  uv += (diff / (dist + 0.0001)) * ripple * falloff;

  vec3 color = uBaseColor / abs(sin(uTime - uv.y - uv.x));
  return vec4(color, 1.0);
}

void main() {
  vec4 col = vec4(0.0);
  int samples = 0;

  for (int i = -1; i <= 1; i++) {
    for (int j = -1; j <= 1; j++) {
      vec2 offset = vec2(float(i), float(j)) * (1.0 / min(uResolution.x, uResolution.y));
      col += renderImage(vUv + offset);
      samples++;
    }
  }

  gl_FragColor = col / float(samples);
}`

// React Bits Liquid Chrome is an OGL full-screen shader. MassageLab ports the
// same ripple, frequency, amplitude, and pointer uniforms into raw WebGL.
export default function ReactBitsLiquidChromeBackground({
  className,
  reactBitsLiquidChrome,
}: BackgroundEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const mouseRef = useRef<[number, number]>([0, 0])
  const options = useMemo(
    () => resolveLiquidChromeOptions(reactBitsLiquidChrome),
    [reactBitsLiquidChrome],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    const gl = canvas?.getContext("webgl", {
      alpha: false,
      antialias: true,
      depth: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false,
      stencil: false,
    })

    if (!canvas || !gl) {
      return undefined
    }

    const resources = createLiquidChromeResources(gl)
    if (!resources) {
      return undefined
    }

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const compactViewportQuery = window.matchMedia("(max-width: 360px), (max-height: 360px)")
    let frame = 0
    let disposed = false
    let width = 1
    let height = 1
    const start = performance.now()

    const shouldAnimate = () => shouldAnimateAmbientBackground({
      prefersReducedMotion: reducedMotionQuery.matches,
      compactViewport: compactViewportQuery.matches,
      documentHidden: document.visibilityState !== "visible",
    })

    const resize = () => {
      const bounds = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, compactViewportQuery.matches ? 1 : 2)
      width = Math.max(1, Math.floor(bounds.width * dpr))
      height = Math.max(1, Math.floor(bounds.height * dpr))
      canvas.width = width
      canvas.height = height
      gl.viewport(0, 0, width, height)
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!options.interactive) {
        return
      }

      const bounds = canvas.getBoundingClientRect()
      mouseRef.current = [
        Math.min(1, Math.max(0, (event.clientX - bounds.left) / Math.max(bounds.width, 1))),
        Math.min(1, Math.max(0, 1 - (event.clientY - bounds.top) / Math.max(bounds.height, 1))),
      ]
    }

    const draw = (timestamp: number) => {
      if (disposed) {
        return
      }

      const animate = shouldAnimate()
      const base = hexToRgb(options.baseColor)
      const time = animate ? ((timestamp - start) * 0.001 * options.speed) : 0
      gl.clearColor(1, 1, 1, 1)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.useProgram(resources.program)
      gl.bindBuffer(gl.ARRAY_BUFFER, resources.vertexBuffer)
      gl.enableVertexAttribArray(resources.attributes.position)
      gl.vertexAttribPointer(resources.attributes.position, 2, gl.FLOAT, false, 0, 0)
      gl.bindBuffer(gl.ARRAY_BUFFER, resources.uvBuffer)
      gl.enableVertexAttribArray(resources.attributes.uv)
      gl.vertexAttribPointer(resources.attributes.uv, 2, gl.FLOAT, false, 0, 0)
      gl.uniform1f(resources.uniforms.time, time)
      gl.uniform3f(resources.uniforms.resolution, width, height, width / Math.max(height, 1))
      gl.uniform3f(resources.uniforms.baseColor, base[0], base[1], base[2])
      gl.uniform1f(resources.uniforms.amplitude, options.amplitude)
      gl.uniform1f(resources.uniforms.frequencyX, options.frequencyX)
      gl.uniform1f(resources.uniforms.frequencyY, options.frequencyY)
      gl.uniform2f(resources.uniforms.mouse, mouseRef.current[0], mouseRef.current[1])
      gl.drawArrays(gl.TRIANGLES, 0, 6)

      if (animate && !disposed) {
        frame = window.requestAnimationFrame(draw)
      }
    }

    const render = () => {
      window.cancelAnimationFrame(frame)
      resize()
      draw(performance.now())
    }

    const resizeObserver = new ResizeObserver(render)
    resizeObserver.observe(canvas)
    window.addEventListener("resize", render, { passive: true })
    document.addEventListener("visibilitychange", render)
    reducedMotionQuery.addEventListener("change", render)
    compactViewportQuery.addEventListener("change", render)
    if (options.interactive) {
      window.addEventListener("pointermove", handlePointerMove, { passive: true })
    }
    render()

    return () => {
      disposed = true
      window.cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      window.removeEventListener("resize", render)
      document.removeEventListener("visibilitychange", render)
      reducedMotionQuery.removeEventListener("change", render)
      compactViewportQuery.removeEventListener("change", render)
      window.removeEventListener("pointermove", handlePointerMove)
      disposeLiquidChromeResources(gl, resources)
      canvas.width = 1
      canvas.height = 1
    }
  }, [options])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn(styles.reactBitsLiquidChromeCanvas, className)}
    />
  )
}

function createLiquidChromeResources(gl: WebGLRenderingContext): LiquidChromeResources | null {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource)
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource)
  const program = gl.createProgram()
  if (!vertexShader || !fragmentShader || !program) {
    return null
  }

  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    return null
  }

  const vertexBuffer = createBuffer(gl, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]))
  const uvBuffer = createBuffer(gl, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]))
  if (!vertexBuffer || !uvBuffer) {
    return null
  }

  return {
    program,
    vertexShader,
    fragmentShader,
    vertexBuffer,
    uvBuffer,
    attributes: {
      position: gl.getAttribLocation(program, "position"),
      uv: gl.getAttribLocation(program, "uv"),
    },
    uniforms: {
      time: getUniformLocation(gl, program, "uTime"),
      resolution: getUniformLocation(gl, program, "uResolution"),
      baseColor: getUniformLocation(gl, program, "uBaseColor"),
      amplitude: getUniformLocation(gl, program, "uAmplitude"),
      frequencyX: getUniformLocation(gl, program, "uFrequencyX"),
      frequencyY: getUniformLocation(gl, program, "uFrequencyY"),
      mouse: getUniformLocation(gl, program, "uMouse"),
    },
  }
}

function createBuffer(gl: WebGLRenderingContext, data: Float32Array) {
  const buffer = gl.createBuffer()
  if (!buffer) {
    return null
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
  return buffer
}

function disposeLiquidChromeResources(gl: WebGLRenderingContext, resources: LiquidChromeResources) {
  gl.deleteBuffer(resources.vertexBuffer)
  gl.deleteBuffer(resources.uvBuffer)
  gl.deleteShader(resources.vertexShader)
  gl.deleteShader(resources.fragmentShader)
  gl.deleteProgram(resources.program)
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string) {
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

function getUniformLocation(gl: WebGLRenderingContext, program: WebGLProgram, name: string) {
  const location = gl.getUniformLocation(program, name)
  if (!location) {
    throw new Error(`Missing React Bits Liquid Chrome uniform: ${name}`)
  }
  return location
}

function resolveLiquidChromeOptions(options?: ReactBitsLiquidChromeOptions): ResolvedLiquidChromeOptions {
  return {
    baseColor: resolveHex(options?.baseColor, DEFAULT_REACT_BITS_LIQUID_CHROME.baseColor),
    speed: resolveNumber(options?.speed, DEFAULT_REACT_BITS_LIQUID_CHROME.speed, 0, 3),
    amplitude: resolveNumber(options?.amplitude, DEFAULT_REACT_BITS_LIQUID_CHROME.amplitude, 0, 1),
    frequencyX: resolveNumber(options?.frequencyX, DEFAULT_REACT_BITS_LIQUID_CHROME.frequencyX, 0.1, 12),
    frequencyY: resolveNumber(options?.frequencyY, DEFAULT_REACT_BITS_LIQUID_CHROME.frequencyY, 0.1, 12),
    interactive: options?.interactive ?? DEFAULT_REACT_BITS_LIQUID_CHROME.interactive,
  }
}

function resolveNumber(value: number | undefined, fallback: number, min: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback
  }
  return Math.min(max, Math.max(min, value))
}

function resolveHex(value: string | undefined, fallback: string) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value.toUpperCase() : fallback
}

function hexToRgb(hex: string): [number, number, number] {
  const value = resolveHex(hex, "#000000").slice(1)
  return [
    parseInt(value.slice(0, 2), 16) / 255,
    parseInt(value.slice(2, 4), 16) / 255,
    parseInt(value.slice(4, 6), 16) / 255,
  ]
}
