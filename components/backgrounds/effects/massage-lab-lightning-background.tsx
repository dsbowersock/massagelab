"use client"

import { useEffect, useMemo, useRef } from "react"
import { shouldAnimateAmbientBackground } from "@/lib/motion-preferences"
import { cn } from "@/lib/utils"
import styles from "@/components/backgrounds/BackgroundHost.module.css"
import type { BackgroundEffectProps, MassageLabLightningOptions } from "./css-backgrounds"

type ResolvedLightningOptions = Required<MassageLabLightningOptions>

type LightningResources = {
  program: WebGLProgram
  vertexShader: WebGLShader
  fragmentShader: WebGLShader
  vertexBuffer: WebGLBuffer
  attributePosition: number
  uniforms: {
    resolution: WebGLUniformLocation
    time: WebGLUniformLocation
    hue: WebGLUniformLocation
    xOffset: WebGLUniformLocation
    speed: WebGLUniformLocation
    intensity: WebGLUniformLocation
    size: WebGLUniformLocation
  }
}

const DEFAULT_MASSAGELAB_LIGHTNING: ResolvedLightningOptions = {
  hue: 230,
  xOffset: 0,
  speed: 1,
  intensity: 1,
  size: 1,
}

const vertexShaderSource = `
  attribute vec2 aPosition;

  void main() {
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`

const fragmentShaderSource = `
  precision mediump float;

  uniform vec2 iResolution;
  uniform float iTime;
  uniform float uHue;
  uniform float uXOffset;
  uniform float uSpeed;
  uniform float uIntensity;
  uniform float uSize;

  #define OCTAVE_COUNT 10

  vec3 hsv2rgb(vec3 c) {
    vec3 rgb = clamp(abs(mod(c.x * 6.0 + vec3(0.0,4.0,2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0);
    return c.z * mix(vec3(1.0), rgb, c.y);
  }

  float hash11(float p) {
    p = fract(p * .1031);
    p *= p + 33.33;
    p *= p + p;
    return fract(p);
  }

  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * .1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  mat2 rotate2d(float theta) {
    float c = cos(theta);
    float s = sin(theta);
    return mat2(c, -s, s, c);
  }

  float noise(vec2 p) {
    vec2 ip = floor(p);
    vec2 fp = fract(p);
    float a = hash12(ip);
    float b = hash12(ip + vec2(1.0, 0.0));
    float c = hash12(ip + vec2(0.0, 1.0));
    float d = hash12(ip + vec2(1.0, 1.0));
    vec2 t = smoothstep(0.0, 1.0, fp);
    return mix(mix(a, b, t.x), mix(c, d, t.x), t.y);
  }

  float fbm(vec2 p) {
    float value = 0.0;
    float amplitude = 0.5;
    for (int i = 0; i < OCTAVE_COUNT; ++i) {
      value += amplitude * noise(p);
      p *= rotate2d(0.45);
      p *= 2.0;
      amplitude *= 0.5;
    }
    return value;
  }

  void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;
    uv = 2.0 * uv - 1.0;
    uv.x *= iResolution.x / iResolution.y;
    uv.x += uXOffset;
    uv += 2.0 * fbm(uv * uSize + 0.8 * iTime * uSpeed) - 1.0;

    float dist = max(0.001, abs(uv.x));
    vec3 baseColor = hsv2rgb(vec3(uHue / 360.0, 0.7, 0.8));
    vec3 col = baseColor * pow(mix(0.0, 0.07, hash11(iTime * uSpeed)) / dist, 1.0) * uIntensity;
    col = pow(col, vec3(1.0));
    float alpha = clamp(max(col.r, max(col.g, col.b)), 0.0, 1.0);
    fragColor = vec4(col, alpha);
  }

  void main() {
    mainImage(gl_FragColor, gl_FragCoord.xy);
  }
`

// MassageLab Lightning already ships as a raw WebGL shader. MassageLab wraps the
// same shader with reduced-motion, resize, visibility, and resource cleanup.
export default function MassageLabLightningBackground({
  className,
  massageLabLightning,
}: BackgroundEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const options = useMemo(
    () => resolveLightningOptions(massageLabLightning),
    [massageLabLightning],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    const gl = canvas?.getContext("webgl", {
      alpha: true,
      antialias: false,
      depth: false,
      powerPreference: "high-performance",
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      stencil: false,
    })

    if (!canvas || !gl) {
      return undefined
    }

    const resources = createLightningResources(gl)
    if (!resources) {
      return undefined
    }

    gl.disable(gl.DEPTH_TEST)
    gl.disable(gl.CULL_FACE)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const compactViewportQuery = window.matchMedia("(max-width: 360px), (max-height: 360px)")
    const startTime = performance.now()
    let frame = 0
    let disposed = false
    let width = 1
    let height = 1

    const shouldAnimate = () => shouldAnimateAmbientBackground({
      prefersReducedMotion: reducedMotionQuery.matches,
      compactViewport: compactViewportQuery.matches,
      documentHidden: document.visibilityState !== "visible",
    })

    const resize = () => {
      const bounds = canvas.getBoundingClientRect()
      const cssWidth = Math.max(1, Math.floor(bounds.width))
      const cssHeight = Math.max(1, Math.floor(bounds.height))
      const dpr = Math.min(window.devicePixelRatio || 1, compactViewportQuery.matches ? 1 : 2)
      width = Math.max(1, Math.floor(cssWidth * dpr))
      height = Math.max(1, Math.floor(cssHeight * dpr))

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }

      gl.viewport(0, 0, width, height)
    }

    const draw = (timestamp: number) => {
      if (disposed) {
        return
      }

      const animate = shouldAnimate()
      const time = animate ? (timestamp - startTime) / 1000 : 0
      renderLightning(gl, resources, width, height, time, options)

      if (animate && options.speed > 1e-6) {
        frame = window.requestAnimationFrame(draw)
      }
    }

    const render = () => {
      window.cancelAnimationFrame(frame)
      resize()
      draw(performance.now())
    }

    const handleVisibilityChange = () => render()
    const resizeObserver = new ResizeObserver(render)
    resizeObserver.observe(canvas)
    window.addEventListener("resize", render, { passive: true })
    document.addEventListener("visibilitychange", handleVisibilityChange)
    reducedMotionQuery.addEventListener("change", render)
    compactViewportQuery.addEventListener("change", render)
    render()

    return () => {
      disposed = true
      window.cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      window.removeEventListener("resize", render)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      reducedMotionQuery.removeEventListener("change", render)
      compactViewportQuery.removeEventListener("change", render)
      disposeLightningResources(gl, resources)
      canvas.width = 1
      canvas.height = 1
    }
  }, [options])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn(styles.massageLabLightningCanvas, className)}
    />
  )
}

function createLightningResources(gl: WebGLRenderingContext): LightningResources | null {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource)
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource)

  if (!vertexShader || !fragmentShader) {
    return null
  }

  const program = gl.createProgram()
  if (!program) {
    gl.deleteShader(vertexShader)
    gl.deleteShader(fragmentShader)
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

  const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1])
  const vertexBuffer = gl.createBuffer()
  if (!vertexBuffer) {
    gl.deleteProgram(program)
    gl.deleteShader(vertexShader)
    gl.deleteShader(fragmentShader)
    return null
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW)

  return {
    program,
    vertexShader,
    fragmentShader,
    vertexBuffer,
    attributePosition: gl.getAttribLocation(program, "aPosition"),
    uniforms: {
      resolution: getUniformLocation(gl, program, "iResolution"),
      time: getUniformLocation(gl, program, "iTime"),
      hue: getUniformLocation(gl, program, "uHue"),
      xOffset: getUniformLocation(gl, program, "uXOffset"),
      speed: getUniformLocation(gl, program, "uSpeed"),
      intensity: getUniformLocation(gl, program, "uIntensity"),
      size: getUniformLocation(gl, program, "uSize"),
    },
  }
}

function renderLightning(
  gl: WebGLRenderingContext,
  resources: LightningResources,
  width: number,
  height: number,
  time: number,
  options: ResolvedLightningOptions,
) {
  gl.clearColor(0, 0, 0, 0)
  gl.clear(gl.COLOR_BUFFER_BIT)
  gl.useProgram(resources.program)
  gl.bindBuffer(gl.ARRAY_BUFFER, resources.vertexBuffer)
  gl.enableVertexAttribArray(resources.attributePosition)
  gl.vertexAttribPointer(resources.attributePosition, 2, gl.FLOAT, false, 0, 0)
  gl.uniform2f(resources.uniforms.resolution, width, height)
  gl.uniform1f(resources.uniforms.time, time)
  gl.uniform1f(resources.uniforms.hue, options.hue)
  gl.uniform1f(resources.uniforms.xOffset, options.xOffset)
  gl.uniform1f(resources.uniforms.speed, options.speed)
  gl.uniform1f(resources.uniforms.intensity, options.intensity)
  gl.uniform1f(resources.uniforms.size, options.size)
  gl.drawArrays(gl.TRIANGLES, 0, 6)
}

function disposeLightningResources(gl: WebGLRenderingContext, resources: LightningResources) {
  gl.deleteBuffer(resources.vertexBuffer)
  gl.detachShader(resources.program, resources.vertexShader)
  gl.detachShader(resources.program, resources.fragmentShader)
  gl.deleteShader(resources.vertexShader)
  gl.deleteShader(resources.fragmentShader)
  gl.deleteProgram(resources.program)
}

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string,
): WebGLShader | null {
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
    throw new Error(`Missing MassageLab Lightning shader uniform: ${name}`)
  }

  return location
}

function resolveLightningOptions(options: MassageLabLightningOptions | undefined): ResolvedLightningOptions {
  return {
    hue: resolveNumber(options?.hue, DEFAULT_MASSAGELAB_LIGHTNING.hue, 0, 360),
    xOffset: resolveNumber(options?.xOffset, DEFAULT_MASSAGELAB_LIGHTNING.xOffset, -2, 2),
    speed: resolveNumber(options?.speed, DEFAULT_MASSAGELAB_LIGHTNING.speed, 0, 5),
    intensity: resolveNumber(options?.intensity, DEFAULT_MASSAGELAB_LIGHTNING.intensity, 0.1, 5),
    size: resolveNumber(options?.size, DEFAULT_MASSAGELAB_LIGHTNING.size, 0.2, 5),
  }
}

function resolveNumber(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number,
) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback
  }

  return Math.min(max, Math.max(min, value))
}
