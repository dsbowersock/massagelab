"use client"

import { useEffect, useMemo, useRef } from "react"
import { shouldAnimateAmbientBackground } from "@/lib/motion-preferences"
import { cn } from "@/lib/utils"
import styles from "@/components/backgrounds/BackgroundHost.module.css"
import type { BackgroundEffectProps, ReactBitsPixelSnowOptions } from "./css-backgrounds"

type RgbColor = [number, number, number]
type PixelSnowVariant = NonNullable<ReactBitsPixelSnowOptions["variant"]>
type ResolvedPixelSnowOptions = Required<ReactBitsPixelSnowOptions>

type PixelSnowResources = {
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
    flakeSize: WebGLUniformLocation
    minFlakeSize: WebGLUniformLocation
    pixelResolution: WebGLUniformLocation
    speed: WebGLUniformLocation
    depthFade: WebGLUniformLocation
    farPlane: WebGLUniformLocation
    color: WebGLUniformLocation
    brightness: WebGLUniformLocation
    gamma: WebGLUniformLocation
    density: WebGLUniformLocation
    variant: WebGLUniformLocation
    direction: WebGLUniformLocation
  }
}

const DEFAULT_REACT_BITS_PIXEL_SNOW: ResolvedPixelSnowOptions = {
  color: "#FFFFFF",
  flakeSize: 0.01,
  minFlakeSize: 1.25,
  pixelResolution: 200,
  speed: 1.25,
  depthFade: 8,
  farPlane: 20,
  brightness: 1,
  gamma: 0.4545,
  density: 0.3,
  variant: "square",
  direction: 125,
}

const vertexShaderSource = `#version 300 es
  in vec2 aPosition;

  void main() {
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`

const fragmentShaderSource = `#version 300 es
  precision highp float;
  precision highp int;

  uniform float uTime;
  uniform vec2 uResolution;
  uniform float uFlakeSize;
  uniform float uMinFlakeSize;
  uniform float uPixelResolution;
  uniform float uSpeed;
  uniform float uDepthFade;
  uniform float uFarPlane;
  uniform vec3 uColor;
  uniform float uBrightness;
  uniform float uGamma;
  uniform float uDensity;
  uniform float uVariant;
  uniform float uDirection;

  out vec4 fragColor;

  #define PI 3.14159265
  #define PI_OVER_6 0.5235988
  #define PI_OVER_3 1.0471976
  #define M1 1597334677u
  #define M2 3812015801u
  #define M3 3299493293u
  #define F0 2.3283064e-10
  #define hash(n) (n * (n ^ (n >> 15)))
  #define coord3(p) (uvec3(p).x * M1 ^ uvec3(p).y * M2 ^ uvec3(p).z * M3)

  const vec3 camK = vec3(0.57735027, 0.57735027, 0.57735027);
  const vec3 camI = vec3(0.70710678, 0.0, -0.70710678);
  const vec3 camJ = vec3(-0.40824829, 0.81649658, -0.40824829);
  const vec2 b1d = vec2(0.574, 0.819);

  vec3 hash3(uint n) {
    uvec3 hashed = hash(n) * uvec3(1u, 511u, 262143u);
    return vec3(hashed) * F0;
  }

  float snowflakeDist(vec2 p) {
    float r = length(p);
    float a = atan(p.y, p.x);
    a = abs(mod(a + PI_OVER_6, PI_OVER_3) - PI_OVER_6);
    vec2 q = r * vec2(cos(a), sin(a));
    float dMain = max(abs(q.y), max(-q.x, q.x - 1.0));
    float b1t = clamp(dot(q - vec2(0.4, 0.0), b1d), 0.0, 0.4);
    float dB1 = length(q - vec2(0.4, 0.0) - b1t * b1d);
    float b2t = clamp(dot(q - vec2(0.7, 0.0), b1d), 0.0, 0.25);
    float dB2 = length(q - vec2(0.7, 0.0) - b2t * b1d);
    return min(dMain, min(dB1, dB2)) * 10.0;
  }

  void main() {
    float invPixelRes = 1.0 / uPixelResolution;
    float pixelSize = max(1.0, floor(0.5 + uResolution.x * invPixelRes));
    float invPixelSize = 1.0 / pixelSize;

    vec2 fragCoord = floor(gl_FragCoord.xy * invPixelSize);
    vec2 res = uResolution * invPixelSize;
    float invResX = 1.0 / res.x;

    vec3 ray = normalize(vec3((fragCoord - res * 0.5) * invResX, 1.0));
    ray = ray.x * camI + ray.y * camJ + ray.z * camK;

    float timeSpeed = uTime * uSpeed;
    float windX = cos(uDirection) * 0.4;
    float windY = sin(uDirection) * 0.4;
    vec3 camPos = (windX * camI + windY * camJ + 0.1 * camK) * timeSpeed;
    vec3 pos = camPos;

    vec3 absRay = max(abs(ray), vec3(0.001));
    vec3 strides = 1.0 / absRay;
    vec3 raySign = step(ray, vec3(0.0));
    vec3 phase = fract(pos) * strides;
    phase = mix(strides - phase, phase, raySign);

    float rayDotCamK = dot(ray, camK);
    float invRayDotCamK = 1.0 / rayDotCamK;
    float invDepthFade = 1.0 / uDepthFade;
    float halfInvResX = 0.5 * invResX;
    vec3 timeAnim = timeSpeed * 0.1 * vec3(7.0, 8.0, 5.0);

    float t = 0.0;
    for (int i = 0; i < 128; i += 1) {
      if (t >= uFarPlane) {
        break;
      }

      vec3 fpos = floor(pos);
      uint cellCoord = coord3(fpos);
      float cellHash = hash3(cellCoord).x;

      if (cellHash < uDensity) {
        vec3 h = hash3(cellCoord);
        vec3 sinArg1 = fpos.yzx * 0.073;
        vec3 sinArg2 = fpos.zxy * 0.27;
        vec3 flakePos = 0.5 - 0.5 * cos(4.0 * sin(sinArg1) + 4.0 * sin(sinArg2) + 2.0 * h + timeAnim);
        flakePos = flakePos * 0.8 + 0.1 + fpos;

        float toIntersection = dot(flakePos - pos, camK) * invRayDotCamK;

        if (toIntersection > 0.0) {
          vec3 testPos = pos + ray * toIntersection - flakePos;
          float testX = dot(testPos, camI);
          float testY = dot(testPos, camJ);
          vec2 testUV = abs(vec2(testX, testY));
          float depth = dot(flakePos - camPos, camK);
          float flakeSize = max(uFlakeSize, uMinFlakeSize * depth * halfInvResX);
          float dist;

          if (uVariant < 0.5) {
            dist = max(testUV.x, testUV.y);
          } else if (uVariant < 1.5) {
            dist = length(testUV);
          } else {
            float invFlakeSize = 1.0 / flakeSize;
            dist = snowflakeDist(vec2(testX, testY) * invFlakeSize) * flakeSize;
          }

          if (dist < flakeSize) {
            float flakeSizeRatio = uFlakeSize / flakeSize;
            float intensity = exp2(-(t + toIntersection) * invDepthFade) *
              min(1.0, flakeSizeRatio * flakeSizeRatio) * uBrightness;
            fragColor = vec4(uColor * pow(vec3(intensity), vec3(uGamma)), 1.0);
            return;
          }
        }
      }

      float nextStep = min(min(phase.x, phase.y), phase.z);
      vec3 sel = step(phase, vec3(nextStep));
      phase = phase - nextStep + strides * sel;
      t += nextStep;
      pos = mix(pos + ray * nextStep, floor(pos + ray * nextStep + 0.5), sel);
    }

    fragColor = vec4(0.0);
  }
`

// React Bits Pixel Snow is a full-screen ray-marched fragment shader. MassageLab
// keeps that shader model in WebGL2 and removes the source Three/R3F wrapper.
export default function ReactBitsPixelSnowBackground({
  className,
  reactBitsPixelSnow,
}: BackgroundEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const options = useMemo(
    () => resolvePixelSnowOptions(reactBitsPixelSnow),
    [
      reactBitsPixelSnow?.color,
      reactBitsPixelSnow?.flakeSize,
      reactBitsPixelSnow?.minFlakeSize,
      reactBitsPixelSnow?.pixelResolution,
      reactBitsPixelSnow?.speed,
      reactBitsPixelSnow?.depthFade,
      reactBitsPixelSnow?.farPlane,
      reactBitsPixelSnow?.brightness,
      reactBitsPixelSnow?.gamma,
      reactBitsPixelSnow?.density,
      reactBitsPixelSnow?.variant,
      reactBitsPixelSnow?.direction,
    ],
  )
  const color = useMemo(() => parseHexColorToRgb(options.color), [options.color])

  useEffect(() => {
    const canvas = canvasRef.current
    const gl = canvas?.getContext("webgl2", {
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

    const resources = createPixelSnowResources(gl)
    if (!resources) {
      return undefined
    }

    gl.disable(gl.DEPTH_TEST)
    gl.disable(gl.CULL_FACE)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const compactViewportQuery = window.matchMedia("(max-width: 480px), (max-height: 480px)")
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
      const time = animate ? (timestamp - startTime) * 0.001 : 0
      renderPixelSnow(gl, resources, options, color, width, height, time)

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
      disposePixelSnowResources(gl, resources)
      canvas.width = 1
      canvas.height = 1
    }
  }, [color, options])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn(styles.reactBitsPixelSnowCanvas, className)}
    />
  )
}

function createPixelSnowResources(gl: WebGL2RenderingContext): PixelSnowResources | null {
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

  const positions = new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1])
  const positionBuffer = gl.createBuffer()
  if (!positionBuffer) {
    gl.deleteProgram(program)
    gl.deleteShader(vertexShader)
    gl.deleteShader(fragmentShader)
    return null
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW)

  return {
    program,
    vertexShader,
    fragmentShader,
    positionBuffer,
    attributes: {
      position: gl.getAttribLocation(program, "aPosition"),
    },
    uniforms: {
      time: getUniformLocation(gl, program, "uTime"),
      resolution: getUniformLocation(gl, program, "uResolution"),
      flakeSize: getUniformLocation(gl, program, "uFlakeSize"),
      minFlakeSize: getUniformLocation(gl, program, "uMinFlakeSize"),
      pixelResolution: getUniformLocation(gl, program, "uPixelResolution"),
      speed: getUniformLocation(gl, program, "uSpeed"),
      depthFade: getUniformLocation(gl, program, "uDepthFade"),
      farPlane: getUniformLocation(gl, program, "uFarPlane"),
      color: getUniformLocation(gl, program, "uColor"),
      brightness: getUniformLocation(gl, program, "uBrightness"),
      gamma: getUniformLocation(gl, program, "uGamma"),
      density: getUniformLocation(gl, program, "uDensity"),
      variant: getUniformLocation(gl, program, "uVariant"),
      direction: getUniformLocation(gl, program, "uDirection"),
    },
  }
}

function renderPixelSnow(
  gl: WebGL2RenderingContext,
  resources: PixelSnowResources,
  options: ResolvedPixelSnowOptions,
  color: RgbColor,
  width: number,
  height: number,
  time: number,
) {
  gl.clearColor(0, 0, 0, 0)
  gl.clear(gl.COLOR_BUFFER_BIT)
  gl.useProgram(resources.program)
  gl.bindBuffer(gl.ARRAY_BUFFER, resources.positionBuffer)
  gl.enableVertexAttribArray(resources.attributes.position)
  gl.vertexAttribPointer(resources.attributes.position, 2, gl.FLOAT, false, 0, 0)
  gl.uniform1f(resources.uniforms.time, time)
  gl.uniform2f(resources.uniforms.resolution, width, height)
  gl.uniform1f(resources.uniforms.flakeSize, options.flakeSize)
  gl.uniform1f(resources.uniforms.minFlakeSize, options.minFlakeSize)
  gl.uniform1f(resources.uniforms.pixelResolution, options.pixelResolution)
  gl.uniform1f(resources.uniforms.speed, options.speed)
  gl.uniform1f(resources.uniforms.depthFade, options.depthFade)
  gl.uniform1f(resources.uniforms.farPlane, options.farPlane)
  gl.uniform3fv(resources.uniforms.color, color)
  gl.uniform1f(resources.uniforms.brightness, options.brightness)
  gl.uniform1f(resources.uniforms.gamma, options.gamma)
  gl.uniform1f(resources.uniforms.density, options.density)
  gl.uniform1f(resources.uniforms.variant, variantToShaderValue(options.variant))
  gl.uniform1f(resources.uniforms.direction, degreesToRadians(options.direction))
  gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
}

function disposePixelSnowResources(gl: WebGL2RenderingContext, resources: PixelSnowResources) {
  gl.deleteBuffer(resources.positionBuffer)
  gl.detachShader(resources.program, resources.vertexShader)
  gl.detachShader(resources.program, resources.fragmentShader)
  gl.deleteShader(resources.vertexShader)
  gl.deleteShader(resources.fragmentShader)
  gl.deleteProgram(resources.program)
}

function compileShader(
  gl: WebGL2RenderingContext,
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
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  name: string,
): WebGLUniformLocation {
  const location = gl.getUniformLocation(program, name)

  if (!location) {
    throw new Error(`Missing React Bits Pixel Snow shader uniform: ${name}`)
  }

  return location
}

function resolvePixelSnowOptions(options: ReactBitsPixelSnowOptions | undefined): ResolvedPixelSnowOptions {
  return {
    color: resolveHexColor(options?.color, DEFAULT_REACT_BITS_PIXEL_SNOW.color),
    flakeSize: resolveNumber(options?.flakeSize, DEFAULT_REACT_BITS_PIXEL_SNOW.flakeSize, 0.001, 0.08),
    minFlakeSize: resolveNumber(
      options?.minFlakeSize,
      DEFAULT_REACT_BITS_PIXEL_SNOW.minFlakeSize,
      0.1,
      6,
    ),
    pixelResolution: resolveNumber(
      options?.pixelResolution,
      DEFAULT_REACT_BITS_PIXEL_SNOW.pixelResolution,
      40,
      640,
    ),
    speed: resolveNumber(options?.speed, DEFAULT_REACT_BITS_PIXEL_SNOW.speed, 0, 5),
    depthFade: resolveNumber(options?.depthFade, DEFAULT_REACT_BITS_PIXEL_SNOW.depthFade, 1, 40),
    farPlane: resolveNumber(options?.farPlane, DEFAULT_REACT_BITS_PIXEL_SNOW.farPlane, 4, 80),
    brightness: resolveNumber(options?.brightness, DEFAULT_REACT_BITS_PIXEL_SNOW.brightness, 0.1, 4),
    gamma: resolveNumber(options?.gamma, DEFAULT_REACT_BITS_PIXEL_SNOW.gamma, 0.1, 2),
    density: resolveNumber(options?.density, DEFAULT_REACT_BITS_PIXEL_SNOW.density, 0.02, 1),
    variant: resolveVariant(options?.variant),
    direction: resolveNumber(options?.direction, DEFAULT_REACT_BITS_PIXEL_SNOW.direction, 0, 360),
  }
}

function resolveVariant(value: PixelSnowVariant | undefined): PixelSnowVariant {
  if (value === "round" || value === "snowflake" || value === "square") {
    return value
  }

  return DEFAULT_REACT_BITS_PIXEL_SNOW.variant
}

function variantToShaderValue(value: PixelSnowVariant) {
  if (value === "round") {
    return 1
  }

  if (value === "snowflake") {
    return 2
  }

  return 0
}

function parseHexColorToRgb(value: string): RgbColor {
  const color = resolveHexColor(value, DEFAULT_REACT_BITS_PIXEL_SNOW.color).slice(1)
  const integer = Number.parseInt(color, 16)

  return [
    ((integer >> 16) & 255) / 255,
    ((integer >> 8) & 255) / 255,
    (integer & 255) / 255,
  ]
}

function resolveHexColor(value: string | undefined, fallback: string) {
  if (typeof value !== "string" || !/^#[0-9a-fA-F]{6}$/.test(value)) {
    return fallback
  }

  return value.toUpperCase()
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

function degreesToRadians(value: number) {
  return value * (Math.PI / 180)
}
