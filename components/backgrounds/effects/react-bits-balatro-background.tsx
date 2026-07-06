"use client"

import { useEffect, useMemo, useRef } from "react"
import { shouldAnimateAmbientBackground } from "@/lib/motion-preferences"
import { cn } from "@/lib/utils"
import styles from "@/components/backgrounds/BackgroundHost.module.css"
import type { BackgroundEffectProps, ReactBitsBalatroOptions } from "./css-backgrounds"

type ResolvedBalatroOptions = Required<ReactBitsBalatroOptions>

type BalatroResources = {
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
    spinRotation: WebGLUniformLocation
    spinSpeed: WebGLUniformLocation
    offset: WebGLUniformLocation
    color1: WebGLUniformLocation
    color2: WebGLUniformLocation
    color3: WebGLUniformLocation
    contrast: WebGLUniformLocation
    lighting: WebGLUniformLocation
    spinAmount: WebGLUniformLocation
    pixelFilter: WebGLUniformLocation
    spinEase: WebGLUniformLocation
    isRotate: WebGLUniformLocation
    mouse: WebGLUniformLocation
  }
}

const DEFAULT_REACT_BITS_BALATRO: ResolvedBalatroOptions = {
  spinRotation: -2,
  spinSpeed: 7,
  offsetX: 0,
  offsetY: 0,
  color1: "#DE443B",
  color2: "#006BB4",
  color3: "#162325",
  contrast: 3.5,
  lighting: 0.4,
  spinAmount: 0.25,
  pixelFilter: 745,
  spinEase: 1,
  isRotate: false,
  mouseInteraction: true,
}

const vertexShaderSource = `
attribute vec2 uv;
attribute vec2 position;
varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}`

const fragmentShaderSource = `
precision highp float;

#define PI 3.14159265359

uniform float iTime;
uniform vec3 iResolution;
uniform float uSpinRotation;
uniform float uSpinSpeed;
uniform vec2 uOffset;
uniform vec4 uColor1;
uniform vec4 uColor2;
uniform vec4 uColor3;
uniform float uContrast;
uniform float uLighting;
uniform float uSpinAmount;
uniform float uPixelFilter;
uniform float uSpinEase;
uniform bool uIsRotate;
uniform vec2 uMouse;

varying vec2 vUv;

vec4 effect(vec2 screenSize, vec2 screen_coords) {
  float pixel_size = length(screenSize.xy) / uPixelFilter;
  vec2 uv = (floor(screen_coords.xy * (1.0 / pixel_size)) * pixel_size - 0.5 * screenSize.xy) / length(screenSize.xy) - uOffset;
  float uv_len = length(uv);
  float speed = uSpinRotation * uSpinEase * 0.2;

  if (uIsRotate) {
    speed = iTime * speed;
  }

  speed += 302.2;
  float mouseInfluence = uMouse.x * 2.0 - 1.0;
  speed += mouseInfluence * 0.1;
  float new_pixel_angle = atan(uv.y, uv.x) + speed - uSpinEase * 20.0 * (uSpinAmount * uv_len + (1.0 - uSpinAmount));
  vec2 mid = (screenSize.xy / length(screenSize.xy)) / 2.0;
  uv = vec2(uv_len * cos(new_pixel_angle) + mid.x, uv_len * sin(new_pixel_angle) + mid.y) - mid;
  uv *= 30.0;
  float baseSpeed = iTime * uSpinSpeed;
  speed = baseSpeed + mouseInfluence * 2.0;
  vec2 uv2 = vec2(uv.x + uv.y);

  for (int i = 0; i < 5; i++) {
    uv2 += sin(max(uv.x, uv.y)) + uv;
    uv += 0.5 * vec2(
      cos(5.1123314 + 0.353 * uv2.y + speed * 0.131121),
      sin(uv2.x - 0.113 * speed)
    );
    uv -= cos(uv.x + uv.y) - sin(uv.x * 0.711 - uv.y);
  }

  float contrast_mod = 0.25 * uContrast + 0.5 * uSpinAmount + 1.2;
  float paint_res = min(2.0, max(0.0, length(uv) * 0.035 * contrast_mod));
  float c1p = max(0.0, 1.0 - contrast_mod * abs(1.0 - paint_res));
  float c2p = max(0.0, 1.0 - contrast_mod * abs(paint_res));
  float c3p = 1.0 - min(1.0, c1p + c2p);
  float light = (uLighting - 0.2) * max(c1p * 5.0 - 4.0, 0.0) + uLighting * max(c2p * 5.0 - 4.0, 0.0);

  return (0.3 / uContrast) * uColor1
    + (1.0 - 0.3 / uContrast) * (uColor1 * c1p + uColor2 * c2p + vec4(c3p * uColor3.rgb, c3p * uColor1.a))
    + light;
}

void main() {
  vec2 uv = vUv * iResolution.xy;
  gl_FragColor = effect(iResolution.xy, uv);
}`

// React Bits Balatro is an OGL shader inspired by the game title treatment.
// This port keeps the same uniforms in raw WebGL for internal app backgrounds.
export default function ReactBitsBalatroBackground({
  className,
  reactBitsBalatro,
}: BackgroundEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const mouseRef = useRef<[number, number]>([0.5, 0.5])
  const options = useMemo(
    () => resolveBalatroOptions(reactBitsBalatro),
    [
      reactBitsBalatro?.spinRotation,
      reactBitsBalatro?.spinSpeed,
      reactBitsBalatro?.offsetX,
      reactBitsBalatro?.offsetY,
      reactBitsBalatro?.color1,
      reactBitsBalatro?.color2,
      reactBitsBalatro?.color3,
      reactBitsBalatro?.contrast,
      reactBitsBalatro?.lighting,
      reactBitsBalatro?.spinAmount,
      reactBitsBalatro?.pixelFilter,
      reactBitsBalatro?.spinEase,
      reactBitsBalatro?.isRotate,
      reactBitsBalatro?.mouseInteraction,
    ],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    const gl = canvas?.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false,
      stencil: false,
    })

    if (!canvas || !gl) {
      return undefined
    }

    const resources = createBalatroResources(gl)
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
      if (!options.mouseInteraction) {
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
      const color1 = hexToVec4(options.color1)
      const color2 = hexToVec4(options.color2)
      const color3 = hexToVec4(options.color3)
      gl.clearColor(0, 0, 0, 1)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.useProgram(resources.program)
      gl.bindBuffer(gl.ARRAY_BUFFER, resources.vertexBuffer)
      gl.enableVertexAttribArray(resources.attributes.position)
      gl.vertexAttribPointer(resources.attributes.position, 2, gl.FLOAT, false, 0, 0)
      gl.bindBuffer(gl.ARRAY_BUFFER, resources.uvBuffer)
      gl.enableVertexAttribArray(resources.attributes.uv)
      gl.vertexAttribPointer(resources.attributes.uv, 2, gl.FLOAT, false, 0, 0)
      gl.uniform1f(resources.uniforms.time, animate ? (timestamp - start) * 0.001 : 0)
      gl.uniform3f(resources.uniforms.resolution, width, height, width / Math.max(height, 1))
      gl.uniform1f(resources.uniforms.spinRotation, options.spinRotation)
      gl.uniform1f(resources.uniforms.spinSpeed, options.spinSpeed)
      gl.uniform2f(resources.uniforms.offset, options.offsetX, options.offsetY)
      gl.uniform4f(resources.uniforms.color1, color1[0], color1[1], color1[2], color1[3])
      gl.uniform4f(resources.uniforms.color2, color2[0], color2[1], color2[2], color2[3])
      gl.uniform4f(resources.uniforms.color3, color3[0], color3[1], color3[2], color3[3])
      gl.uniform1f(resources.uniforms.contrast, options.contrast)
      gl.uniform1f(resources.uniforms.lighting, options.lighting)
      gl.uniform1f(resources.uniforms.spinAmount, options.spinAmount)
      gl.uniform1f(resources.uniforms.pixelFilter, options.pixelFilter)
      gl.uniform1f(resources.uniforms.spinEase, options.spinEase)
      gl.uniform1i(resources.uniforms.isRotate, options.isRotate ? 1 : 0)
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
    if (options.mouseInteraction) {
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
      disposeBalatroResources(gl, resources)
      canvas.width = 1
      canvas.height = 1
    }
  }, [options])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn(styles.reactBitsBalatroCanvas, className)}
    />
  )
}

function createBalatroResources(gl: WebGLRenderingContext): BalatroResources | null {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource)
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource)
  const program = gl.createProgram()
  if (!vertexShader || !fragmentShader || !program) {
    if (vertexShader) {
      gl.deleteShader(vertexShader)
    }
    if (fragmentShader) {
      gl.deleteShader(fragmentShader)
    }
    if (program) {
      gl.deleteProgram(program)
    }
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

  const vertexBuffer = createBuffer(gl, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]))
  const uvBuffer = createBuffer(gl, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]))
  if (!vertexBuffer || !uvBuffer) {
    if (vertexBuffer) {
      gl.deleteBuffer(vertexBuffer)
    }
    if (uvBuffer) {
      gl.deleteBuffer(uvBuffer)
    }
    gl.deleteProgram(program)
    gl.deleteShader(vertexShader)
    gl.deleteShader(fragmentShader)
    return null
  }

  const attributes = {
    position: gl.getAttribLocation(program, "position"),
    uv: gl.getAttribLocation(program, "uv"),
  }
  const uniforms = {
    time: getUniformLocation(gl, program, "iTime"),
    resolution: getUniformLocation(gl, program, "iResolution"),
    spinRotation: getUniformLocation(gl, program, "uSpinRotation"),
    spinSpeed: getUniformLocation(gl, program, "uSpinSpeed"),
    offset: getUniformLocation(gl, program, "uOffset"),
    color1: getUniformLocation(gl, program, "uColor1"),
    color2: getUniformLocation(gl, program, "uColor2"),
    color3: getUniformLocation(gl, program, "uColor3"),
    contrast: getUniformLocation(gl, program, "uContrast"),
    lighting: getUniformLocation(gl, program, "uLighting"),
    spinAmount: getUniformLocation(gl, program, "uSpinAmount"),
    pixelFilter: getUniformLocation(gl, program, "uPixelFilter"),
    spinEase: getUniformLocation(gl, program, "uSpinEase"),
    isRotate: getUniformLocation(gl, program, "uIsRotate"),
    mouse: getUniformLocation(gl, program, "uMouse"),
  }

  if (attributes.position < 0 || attributes.uv < 0 || hasMissingUniforms(uniforms)) {
    gl.deleteBuffer(vertexBuffer)
    gl.deleteBuffer(uvBuffer)
    gl.deleteProgram(program)
    gl.deleteShader(vertexShader)
    gl.deleteShader(fragmentShader)
    return null
  }

  return {
    program,
    vertexShader,
    fragmentShader,
    vertexBuffer,
    uvBuffer,
    attributes,
    uniforms: uniforms as BalatroResources["uniforms"],
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

function disposeBalatroResources(gl: WebGLRenderingContext, resources: BalatroResources) {
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
  return gl.getUniformLocation(program, name)
}

function hasMissingUniforms(uniforms: Record<string, WebGLUniformLocation | null>) {
  return Object.values(uniforms).some((location) => location === null)
}

function resolveBalatroOptions(options?: ReactBitsBalatroOptions): ResolvedBalatroOptions {
  return {
    spinRotation: resolveNumber(options?.spinRotation, DEFAULT_REACT_BITS_BALATRO.spinRotation, -8, 8),
    spinSpeed: resolveNumber(options?.spinSpeed, DEFAULT_REACT_BITS_BALATRO.spinSpeed, 0, 14),
    offsetX: resolveNumber(options?.offsetX, DEFAULT_REACT_BITS_BALATRO.offsetX, -1, 1),
    offsetY: resolveNumber(options?.offsetY, DEFAULT_REACT_BITS_BALATRO.offsetY, -1, 1),
    color1: resolveHex(options?.color1, DEFAULT_REACT_BITS_BALATRO.color1),
    color2: resolveHex(options?.color2, DEFAULT_REACT_BITS_BALATRO.color2),
    color3: resolveHex(options?.color3, DEFAULT_REACT_BITS_BALATRO.color3),
    contrast: resolveNumber(options?.contrast, DEFAULT_REACT_BITS_BALATRO.contrast, 0.5, 8),
    lighting: resolveNumber(options?.lighting, DEFAULT_REACT_BITS_BALATRO.lighting, 0, 1),
    spinAmount: resolveNumber(options?.spinAmount, DEFAULT_REACT_BITS_BALATRO.spinAmount, 0, 1),
    pixelFilter: resolveNumber(options?.pixelFilter, DEFAULT_REACT_BITS_BALATRO.pixelFilter, 120, 1200),
    spinEase: resolveNumber(options?.spinEase, DEFAULT_REACT_BITS_BALATRO.spinEase, 0, 3),
    isRotate: options?.isRotate ?? DEFAULT_REACT_BITS_BALATRO.isRotate,
    mouseInteraction: options?.mouseInteraction ?? DEFAULT_REACT_BITS_BALATRO.mouseInteraction,
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

function hexToVec4(hex: string): [number, number, number, number] {
  const value = resolveHex(hex, "#000000").slice(1)
  return [
    parseInt(value.slice(0, 2), 16) / 255,
    parseInt(value.slice(2, 4), 16) / 255,
    parseInt(value.slice(4, 6), 16) / 255,
    1,
  ]
}
