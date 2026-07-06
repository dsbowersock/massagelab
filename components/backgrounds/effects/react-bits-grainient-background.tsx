"use client"

import { useEffect, useMemo, useRef } from "react"
import { shouldAnimateAmbientBackground } from "@/lib/motion-preferences"
import { cn } from "@/lib/utils"
import styles from "@/components/backgrounds/BackgroundHost.module.css"
import type { BackgroundEffectProps, ReactBitsGrainientOptions } from "./css-backgrounds"

type RgbColor = [number, number, number]
type ResolvedGrainientOptions = Required<ReactBitsGrainientOptions>

type GrainientResources = {
  program: WebGLProgram
  vertexShader: WebGLShader
  fragmentShader: WebGLShader
  positionBuffer: WebGLBuffer
  attributes: {
    position: number
  }
  uniforms: {
    resolution: WebGLUniformLocation
    time: WebGLUniformLocation
    timeSpeed: WebGLUniformLocation
    colorBalance: WebGLUniformLocation
    warpStrength: WebGLUniformLocation
    warpFrequency: WebGLUniformLocation
    warpSpeed: WebGLUniformLocation
    warpAmplitude: WebGLUniformLocation
    blendAngle: WebGLUniformLocation
    blendSoftness: WebGLUniformLocation
    rotationAmount: WebGLUniformLocation
    noiseScale: WebGLUniformLocation
    grainAmount: WebGLUniformLocation
    grainScale: WebGLUniformLocation
    grainAnimated: WebGLUniformLocation
    contrast: WebGLUniformLocation
    gamma: WebGLUniformLocation
    saturation: WebGLUniformLocation
    centerOffset: WebGLUniformLocation
    zoom: WebGLUniformLocation
    color1: WebGLUniformLocation
    color2: WebGLUniformLocation
    color3: WebGLUniformLocation
  }
}

const DEFAULT_REACT_BITS_GRAINIENT: ResolvedGrainientOptions = {
  timeSpeed: 0.25,
  colorBalance: 0,
  warpStrength: 1,
  warpFrequency: 5,
  warpSpeed: 2,
  warpAmplitude: 50,
  blendAngle: 0,
  blendSoftness: 0.05,
  rotationAmount: 500,
  noiseScale: 2,
  grainAmount: 0.1,
  grainScale: 2,
  grainAnimated: false,
  contrast: 1.5,
  gamma: 1,
  saturation: 1,
  centerX: 0,
  centerY: 0,
  zoom: 0.9,
  color1: "#FF9FFC",
  color2: "#5227FF",
  color3: "#B497CF",
}

const vertexShaderSource = `#version 300 es
  in vec2 position;

  void main() {
    gl_Position = vec4(position, 0.0, 1.0);
  }
`

const fragmentShaderSource = `#version 300 es
  precision highp float;

  uniform vec2 iResolution;
  uniform float iTime;
  uniform float uTimeSpeed;
  uniform float uColorBalance;
  uniform float uWarpStrength;
  uniform float uWarpFrequency;
  uniform float uWarpSpeed;
  uniform float uWarpAmplitude;
  uniform float uBlendAngle;
  uniform float uBlendSoftness;
  uniform float uRotationAmount;
  uniform float uNoiseScale;
  uniform float uGrainAmount;
  uniform float uGrainScale;
  uniform float uGrainAnimated;
  uniform float uContrast;
  uniform float uGamma;
  uniform float uSaturation;
  uniform vec2 uCenterOffset;
  uniform float uZoom;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;

  out vec4 fragColor;

  #define S(a,b,t) smoothstep(a,b,t)

  mat2 Rot(float a) {
    float s = sin(a);
    float c = cos(a);
    return mat2(c, -s, s, c);
  }

  vec2 hash(vec2 p) {
    p = vec2(dot(p, vec2(2127.1, 81.17)), dot(p, vec2(1269.5, 283.37)));
    return fract(sin(p) * 43758.5453);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float n = mix(
      mix(
        dot(-1.0 + 2.0 * hash(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),
        dot(-1.0 + 2.0 * hash(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)),
        u.x
      ),
      mix(
        dot(-1.0 + 2.0 * hash(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
        dot(-1.0 + 2.0 * hash(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)),
        u.x
      ),
      u.y
    );
    return 0.5 + 0.5 * n;
  }

  void mainImage(out vec4 o, vec2 C) {
    float t = iTime * uTimeSpeed;
    vec2 uv = C / iResolution.xy;
    float ratio = iResolution.x / iResolution.y;
    vec2 tuv = uv - 0.5 + uCenterOffset;
    tuv /= max(uZoom, 0.001);

    float degree = noise(vec2(t * 0.1, tuv.x * tuv.y) * uNoiseScale);
    tuv.y *= 1.0 / ratio;
    tuv *= Rot(radians((degree - 0.5) * uRotationAmount + 180.0));
    tuv.y *= ratio;

    float frequency = uWarpFrequency;
    float ws = max(uWarpStrength, 0.001);
    float amplitude = uWarpAmplitude / ws;
    float warpTime = t * uWarpSpeed;
    tuv.x += sin(tuv.y * frequency + warpTime) / amplitude;
    tuv.y += sin(tuv.x * (frequency * 1.5) + warpTime) / (amplitude * 0.5);

    vec3 colLav = uColor1;
    vec3 colOrg = uColor2;
    vec3 colDark = uColor3;
    float b = uColorBalance;
    float s = max(uBlendSoftness, 0.0);
    mat2 blendRot = Rot(radians(uBlendAngle));
    float blendX = (tuv * blendRot).x;
    float edge0 = -0.3 - b - s;
    float edge1 = 0.2 - b + s;
    float v0 = 0.5 - b + s;
    float v1 = -0.3 - b - s;
    vec3 layer1 = mix(colDark, colOrg, S(edge0, edge1, blendX));
    vec3 layer2 = mix(colOrg, colLav, S(edge0, edge1, blendX));
    vec3 col = mix(layer1, layer2, S(v0, v1, tuv.y));

    vec2 grainUv = uv * max(uGrainScale, 0.001);
    if (uGrainAnimated > 0.5) {
      grainUv += vec2(iTime * 0.05);
    }
    float grain = fract(sin(dot(grainUv, vec2(12.9898, 78.233))) * 43758.5453);
    col += (grain - 0.5) * uGrainAmount;

    col = (col - 0.5) * uContrast + 0.5;
    float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = mix(vec3(luma), col, uSaturation);
    col = pow(max(col, 0.0), vec3(1.0 / max(uGamma, 0.001)));
    col = clamp(col, 0.0, 1.0);

    o = vec4(col, 1.0);
  }

  void main() {
    vec4 o = vec4(0.0);
    mainImage(o, gl_FragCoord.xy);
    fragColor = o;
  }
`

export default function ReactBitsGrainientBackground({
  className,
  reactBitsGrainient,
}: BackgroundEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const options = useMemo(
    () => resolveGrainientOptions(reactBitsGrainient),
    [
      reactBitsGrainient?.timeSpeed,
      reactBitsGrainient?.colorBalance,
      reactBitsGrainient?.warpStrength,
      reactBitsGrainient?.warpFrequency,
      reactBitsGrainient?.warpSpeed,
      reactBitsGrainient?.warpAmplitude,
      reactBitsGrainient?.blendAngle,
      reactBitsGrainient?.blendSoftness,
      reactBitsGrainient?.rotationAmount,
      reactBitsGrainient?.noiseScale,
      reactBitsGrainient?.grainAmount,
      reactBitsGrainient?.grainScale,
      reactBitsGrainient?.grainAnimated,
      reactBitsGrainient?.contrast,
      reactBitsGrainient?.gamma,
      reactBitsGrainient?.saturation,
      reactBitsGrainient?.centerX,
      reactBitsGrainient?.centerY,
      reactBitsGrainient?.zoom,
      reactBitsGrainient?.color1,
      reactBitsGrainient?.color2,
      reactBitsGrainient?.color3,
    ],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return undefined
    }

    const gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: false,
      depth: false,
      powerPreference: "high-performance",
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      stencil: false,
    })

    if (!gl) {
      return undefined
    }

    const resources = createGrainientResources(gl)
    if (!resources) {
      return undefined
    }

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const compactViewportQuery = window.matchMedia("(max-width: 640px)")
    let frame = 0
    let lastTime = performance.now()
    let elapsedSeconds = 0
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
      const bounds = canvas.getBoundingClientRect()
      const nextWidth = Math.max(1, Math.floor(bounds.width))
      const nextHeight = Math.max(1, Math.floor(bounds.height))
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = Math.max(1, Math.floor(nextWidth * dpr))
      height = Math.max(1, Math.floor(nextHeight * dpr))
      canvas.width = width
      canvas.height = height
      gl.viewport(0, 0, width, height)
      renderGrainient(gl, resources, options, width, height, elapsedSeconds)
    }

    const draw = (now: number) => {
      const deltaSeconds = Math.min((now - lastTime) / 1000, 0.05)
      lastTime = now
      if (shouldAnimate) {
        elapsedSeconds += deltaSeconds
      }
      renderGrainient(gl, resources, options, width, height, elapsedSeconds)

      if (!disposed && shouldAnimate) {
        frame = window.requestAnimationFrame(draw)
      }
    }

    const updateMotion = () => {
      shouldAnimate = getShouldAnimate()
      if (frame) {
        window.cancelAnimationFrame(frame)
        frame = 0
      }

      lastTime = performance.now()
      if (shouldAnimate) {
        frame = window.requestAnimationFrame(draw)
      } else {
        draw(lastTime)
      }
    }

    const resizeObserver = new ResizeObserver(() => {
      resize()
      updateMotion()
    })

    const onVisibilityChange = () => updateMotion()
    const onResize = () => {
      resize()
      updateMotion()
    }

    resizeObserver.observe(canvas)
    window.addEventListener("resize", onResize)
    document.addEventListener("visibilitychange", onVisibilityChange)
    addMediaListener(reducedMotionQuery, updateMotion)
    addMediaListener(compactViewportQuery, updateMotion)

    resize()
    updateMotion()

    return () => {
      disposed = true
      if (frame) {
        window.cancelAnimationFrame(frame)
      }
      resizeObserver.disconnect()
      window.removeEventListener("resize", onResize)
      document.removeEventListener("visibilitychange", onVisibilityChange)
      removeMediaListener(reducedMotionQuery, updateMotion)
      removeMediaListener(compactViewportQuery, updateMotion)
      disposeGrainientResources(gl, resources)
    }
  }, [options])

  return (
    <div className={cn(styles.reactBitsGrainient, className)} aria-hidden="true">
      <canvas ref={canvasRef} className={styles.reactBitsGrainientCanvas} />
    </div>
  )
}

function addMediaListener(query: MediaQueryList, listener: () => void) {
  if (typeof query.addEventListener === "function") {
    query.addEventListener("change", listener)
  } else {
    query.addListener(listener)
  }
}

function removeMediaListener(query: MediaQueryList, listener: () => void) {
  if (typeof query.removeEventListener === "function") {
    query.removeEventListener("change", listener)
  } else {
    query.removeListener(listener)
  }
}

function createGrainientResources(gl: WebGL2RenderingContext): GrainientResources | null {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource)
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource)
  const program = gl.createProgram()
  if (!vertexShader || !fragmentShader || !program) {
    if (vertexShader) gl.deleteShader(vertexShader)
    if (fragmentShader) gl.deleteShader(fragmentShader)
    if (program) gl.deleteProgram(program)
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
  if (!positionBuffer) {
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
    attributes: {
      position: gl.getAttribLocation(program, "position"),
    },
    uniforms: {
      resolution: getUniformLocation(gl, program, "iResolution"),
      time: getUniformLocation(gl, program, "iTime"),
      timeSpeed: getUniformLocation(gl, program, "uTimeSpeed"),
      colorBalance: getUniformLocation(gl, program, "uColorBalance"),
      warpStrength: getUniformLocation(gl, program, "uWarpStrength"),
      warpFrequency: getUniformLocation(gl, program, "uWarpFrequency"),
      warpSpeed: getUniformLocation(gl, program, "uWarpSpeed"),
      warpAmplitude: getUniformLocation(gl, program, "uWarpAmplitude"),
      blendAngle: getUniformLocation(gl, program, "uBlendAngle"),
      blendSoftness: getUniformLocation(gl, program, "uBlendSoftness"),
      rotationAmount: getUniformLocation(gl, program, "uRotationAmount"),
      noiseScale: getUniformLocation(gl, program, "uNoiseScale"),
      grainAmount: getUniformLocation(gl, program, "uGrainAmount"),
      grainScale: getUniformLocation(gl, program, "uGrainScale"),
      grainAnimated: getUniformLocation(gl, program, "uGrainAnimated"),
      contrast: getUniformLocation(gl, program, "uContrast"),
      gamma: getUniformLocation(gl, program, "uGamma"),
      saturation: getUniformLocation(gl, program, "uSaturation"),
      centerOffset: getUniformLocation(gl, program, "uCenterOffset"),
      zoom: getUniformLocation(gl, program, "uZoom"),
      color1: getUniformLocation(gl, program, "uColor1"),
      color2: getUniformLocation(gl, program, "uColor2"),
      color3: getUniformLocation(gl, program, "uColor3"),
    },
  }
}

function renderGrainient(
  gl: WebGL2RenderingContext,
  resources: GrainientResources,
  options: ResolvedGrainientOptions,
  width: number,
  height: number,
  time: number,
) {
  const color1 = hexToRgbColor(options.color1)
  const color2 = hexToRgbColor(options.color2)
  const color3 = hexToRgbColor(options.color3)

  gl.clearColor(0, 0, 0, 0)
  gl.clear(gl.COLOR_BUFFER_BIT)
  gl.disable(gl.DEPTH_TEST)
  gl.useProgram(resources.program)
  bindAttribute(gl, resources.positionBuffer, resources.attributes.position, 2)

  gl.uniform2f(resources.uniforms.resolution, width, height)
  gl.uniform1f(resources.uniforms.time, time)
  gl.uniform1f(resources.uniforms.timeSpeed, options.timeSpeed)
  gl.uniform1f(resources.uniforms.colorBalance, options.colorBalance)
  gl.uniform1f(resources.uniforms.warpStrength, options.warpStrength)
  gl.uniform1f(resources.uniforms.warpFrequency, options.warpFrequency)
  gl.uniform1f(resources.uniforms.warpSpeed, options.warpSpeed)
  gl.uniform1f(resources.uniforms.warpAmplitude, options.warpAmplitude)
  gl.uniform1f(resources.uniforms.blendAngle, options.blendAngle)
  gl.uniform1f(resources.uniforms.blendSoftness, options.blendSoftness)
  gl.uniform1f(resources.uniforms.rotationAmount, options.rotationAmount)
  gl.uniform1f(resources.uniforms.noiseScale, options.noiseScale)
  gl.uniform1f(resources.uniforms.grainAmount, options.grainAmount)
  gl.uniform1f(resources.uniforms.grainScale, options.grainScale)
  gl.uniform1f(resources.uniforms.grainAnimated, options.grainAnimated ? 1 : 0)
  gl.uniform1f(resources.uniforms.contrast, options.contrast)
  gl.uniform1f(resources.uniforms.gamma, options.gamma)
  gl.uniform1f(resources.uniforms.saturation, options.saturation)
  gl.uniform2f(resources.uniforms.centerOffset, options.centerX, options.centerY)
  gl.uniform1f(resources.uniforms.zoom, options.zoom)
  setUniformColor(gl, resources.uniforms.color1, color1)
  setUniformColor(gl, resources.uniforms.color2, color2)
  setUniformColor(gl, resources.uniforms.color3, color3)
  gl.drawArrays(gl.TRIANGLES, 0, 3)
}

function bindAttribute(gl: WebGL2RenderingContext, buffer: WebGLBuffer, location: number, size: number) {
  if (location < 0) {
    return
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.enableVertexAttribArray(location)
  gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0)
}

function createArrayBuffer(gl: WebGL2RenderingContext, data: Float32Array): WebGLBuffer | null {
  const buffer = gl.createBuffer()
  if (!buffer) {
    return null
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
  return buffer
}

function disposeGrainientResources(gl: WebGL2RenderingContext, resources: GrainientResources) {
  gl.deleteBuffer(resources.positionBuffer)
  gl.deleteProgram(resources.program)
  gl.deleteShader(resources.vertexShader)
  gl.deleteShader(resources.fragmentShader)
}

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
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
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  name: string,
): WebGLUniformLocation {
  const location = gl.getUniformLocation(program, name)
  if (!location) {
    throw new Error(`Missing React Bits Grainient uniform: ${name}`)
  }
  return location
}

function setUniformColor(gl: WebGL2RenderingContext, location: WebGLUniformLocation, color: RgbColor) {
  gl.uniform3f(location, color[0], color[1], color[2])
}

function resolveGrainientOptions(options?: ReactBitsGrainientOptions): ResolvedGrainientOptions {
  return {
    timeSpeed: clampNumber(options?.timeSpeed, DEFAULT_REACT_BITS_GRAINIENT.timeSpeed, 0, 2),
    colorBalance: clampNumber(options?.colorBalance, DEFAULT_REACT_BITS_GRAINIENT.colorBalance, -1, 1),
    warpStrength: clampNumber(options?.warpStrength, DEFAULT_REACT_BITS_GRAINIENT.warpStrength, 0, 5),
    warpFrequency: clampNumber(options?.warpFrequency, DEFAULT_REACT_BITS_GRAINIENT.warpFrequency, 0.1, 20),
    warpSpeed: clampNumber(options?.warpSpeed, DEFAULT_REACT_BITS_GRAINIENT.warpSpeed, 0, 6),
    warpAmplitude: clampNumber(options?.warpAmplitude, DEFAULT_REACT_BITS_GRAINIENT.warpAmplitude, 1, 160),
    blendAngle: clampNumber(options?.blendAngle, DEFAULT_REACT_BITS_GRAINIENT.blendAngle, -180, 180),
    blendSoftness: clampNumber(options?.blendSoftness, DEFAULT_REACT_BITS_GRAINIENT.blendSoftness, 0, 1),
    rotationAmount: clampNumber(options?.rotationAmount, DEFAULT_REACT_BITS_GRAINIENT.rotationAmount, 0, 1200),
    noiseScale: clampNumber(options?.noiseScale, DEFAULT_REACT_BITS_GRAINIENT.noiseScale, 0.1, 8),
    grainAmount: clampNumber(options?.grainAmount, DEFAULT_REACT_BITS_GRAINIENT.grainAmount, 0, 1),
    grainScale: clampNumber(options?.grainScale, DEFAULT_REACT_BITS_GRAINIENT.grainScale, 0.1, 12),
    grainAnimated: options?.grainAnimated === true,
    contrast: clampNumber(options?.contrast, DEFAULT_REACT_BITS_GRAINIENT.contrast, 0.2, 4),
    gamma: clampNumber(options?.gamma, DEFAULT_REACT_BITS_GRAINIENT.gamma, 0.2, 4),
    saturation: clampNumber(options?.saturation, DEFAULT_REACT_BITS_GRAINIENT.saturation, 0, 3),
    centerX: clampNumber(options?.centerX, DEFAULT_REACT_BITS_GRAINIENT.centerX, -1, 1),
    centerY: clampNumber(options?.centerY, DEFAULT_REACT_BITS_GRAINIENT.centerY, -1, 1),
    zoom: clampNumber(options?.zoom, DEFAULT_REACT_BITS_GRAINIENT.zoom, 0.2, 3),
    color1: normalizeHexColor(options?.color1, DEFAULT_REACT_BITS_GRAINIENT.color1),
    color2: normalizeHexColor(options?.color2, DEFAULT_REACT_BITS_GRAINIENT.color2),
    color3: normalizeHexColor(options?.color3, DEFAULT_REACT_BITS_GRAINIENT.color3),
  }
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback
  }

  return Math.min(max, Math.max(min, value))
}

function normalizeHexColor(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback
  }

  const normalized = value.trim()
  return /^#[0-9a-f]{6}$/i.test(normalized) ? normalized.toUpperCase() : fallback
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
