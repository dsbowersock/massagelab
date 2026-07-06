"use client"

import { useEffect, useMemo, useRef } from "react"
import { shouldAnimateAmbientBackground } from "@/lib/motion-preferences"
import { cn } from "@/lib/utils"
import styles from "@/components/backgrounds/BackgroundHost.module.css"
import type { BackgroundEffectProps, ReactBitsParticlesOptions } from "./css-backgrounds"

type RgbColor = [number, number, number]
type ResolvedParticlesOptions = Omit<Required<ReactBitsParticlesOptions>, "colors"> & {
  colors: [string, string, string]
}

type ParticlesResources = {
  program: WebGLProgram
  vertexShader: WebGLShader
  fragmentShader: WebGLShader
  positionBuffer: WebGLBuffer
  randomBuffer: WebGLBuffer
  colorBuffer: WebGLBuffer
  attributes: {
    position: number
    random: number
    color: number
  }
  uniforms: {
    modelMatrix: WebGLUniformLocation
    viewMatrix: WebGLUniformLocation
    projectionMatrix: WebGLUniformLocation
    time: WebGLUniformLocation
    spread: WebGLUniformLocation
    baseSize: WebGLUniformLocation
    sizeRandomness: WebGLUniformLocation
    alphaParticles: WebGLUniformLocation
  }
}

const DEFAULT_REACT_BITS_PARTICLES: ResolvedParticlesOptions = {
  particleCount: 200,
  particleSpread: 10,
  speed: 0.1,
  colors: ["#FFFFFF", "#FFFFFF", "#FFFFFF"],
  moveParticlesOnHover: false,
  particleHoverFactor: 1,
  alphaParticles: false,
  particleBaseSize: 100,
  sizeRandomness: 1,
  cameraDistance: 20,
  disableRotation: false,
  pixelRatio: 1,
}

const vertexShaderSource = `
  attribute vec3 position;
  attribute vec4 random;
  attribute vec3 color;

  uniform mat4 modelMatrix;
  uniform mat4 viewMatrix;
  uniform mat4 projectionMatrix;
  uniform float uTime;
  uniform float uSpread;
  uniform float uBaseSize;
  uniform float uSizeRandomness;

  varying vec4 vRandom;
  varying vec3 vColor;

  void main() {
    vRandom = random;
    vColor = color;

    vec3 pos = position * uSpread;
    pos.z *= 10.0;

    vec4 mPos = modelMatrix * vec4(pos, 1.0);
    float t = uTime;
    mPos.x += sin(t * random.z + 6.28 * random.w) * mix(0.1, 1.5, random.x);
    mPos.y += sin(t * random.y + 6.28 * random.x) * mix(0.1, 1.5, random.w);
    mPos.z += sin(t * random.w + 6.28 * random.y) * mix(0.1, 1.5, random.z);

    vec4 mvPos = viewMatrix * mPos;

    if (uSizeRandomness == 0.0) {
      gl_PointSize = uBaseSize;
    } else {
      gl_PointSize = (uBaseSize * (1.0 + uSizeRandomness * (random.x - 0.5))) / length(mvPos.xyz);
    }

    gl_Position = projectionMatrix * mvPos;
  }
`

const fragmentShaderSource = `
  precision highp float;

  uniform float uTime;
  uniform float uAlphaParticles;
  varying vec4 vRandom;
  varying vec3 vColor;

  void main() {
    vec2 uv = gl_PointCoord.xy;
    float d = length(uv - vec2(0.5));

    if (uAlphaParticles < 0.5) {
      if (d > 0.5) {
        discard;
      }
      gl_FragColor = vec4(vColor + 0.2 * sin(uv.yxx + uTime + vRandom.y * 6.28), 1.0);
    } else {
      float circle = smoothstep(0.5, 0.4, d) * 0.8;
      gl_FragColor = vec4(vColor + 0.2 * sin(uv.yxx + uTime + vRandom.y * 6.28), circle);
    }
  }
`

export default function ReactBitsParticlesBackground({
  className,
  reactBitsParticles,
}: BackgroundEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const mouseRef = useRef({ x: 0, y: 0 })
  const options = useMemo(
    () => resolveParticlesOptions(reactBitsParticles),
    [
      reactBitsParticles?.particleCount,
      reactBitsParticles?.particleSpread,
      reactBitsParticles?.speed,
      reactBitsParticles?.colors,
      reactBitsParticles?.moveParticlesOnHover,
      reactBitsParticles?.particleHoverFactor,
      reactBitsParticles?.alphaParticles,
      reactBitsParticles?.particleBaseSize,
      reactBitsParticles?.sizeRandomness,
      reactBitsParticles?.cameraDistance,
      reactBitsParticles?.disableRotation,
      reactBitsParticles?.pixelRatio,
    ],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return undefined
    }

    const gl = canvas.getContext("webgl", {
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

    const resources = createParticlesResources(gl, options)
    if (!resources) {
      return undefined
    }

    const projectionMatrix = new Float32Array(16)
    const viewMatrix = new Float32Array(16)
    const modelMatrix = new Float32Array(16)
    const pixelRatio = options.pixelRatio
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const compactViewportQuery = window.matchMedia("(max-width: 640px)")
    let frame = 0
    let lastTime = performance.now()
    let elapsed = 0
    let rotationZ = 0
    let width = 1
    let height = 1
    let disposed = false
    let isVisible = document.visibilityState !== "hidden"
    const getShouldAnimate = () => {
      const bounds = canvas.getBoundingClientRect()
      return shouldAnimateAmbientBackground({
        prefersReducedMotion: reducedMotionQuery.matches,
        compactViewport: Math.min(bounds.width, bounds.height) < 360 || compactViewportQuery.matches,
        allowCompactViewport: true,
        documentHidden: document.hidden,
      })
    }
    let shouldAnimate = getShouldAnimate()

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      width = Math.max(1, Math.floor(rect.width * pixelRatio))
      height = Math.max(1, Math.floor(rect.height * pixelRatio))

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }

      gl.viewport(0, 0, width, height)
      setPerspectiveMatrix(projectionMatrix, (15 * Math.PI) / 180, width / Math.max(1, height), 0.1, 1000)
      setTranslationMatrix(viewMatrix, 0, 0, -options.cameraDistance)
    }

    const draw = (now: number) => {
      if (disposed) {
        return
      }

      const delta = now - lastTime
      lastTime = now

      if (shouldAnimate && isVisible) {
        elapsed += delta * options.speed
      }

      if (options.disableRotation) {
        setModelMatrix(modelMatrix, -mouseRef.current.x, -mouseRef.current.y, 0, 0, 0, 0)
      } else {
        if (shouldAnimate && isVisible) {
          rotationZ += 0.01 * options.speed
        }
        setModelMatrix(
          modelMatrix,
          -mouseRef.current.x,
          -mouseRef.current.y,
          0,
          Math.sin(elapsed * 0.0002) * 0.1,
          Math.cos(elapsed * 0.0005) * 0.15,
          rotationZ,
        )
      }

      renderParticles(gl, resources, modelMatrix, viewMatrix, projectionMatrix, options, elapsed * 0.001)

      if (shouldAnimate && isVisible) {
        frame = window.requestAnimationFrame(draw)
      }
    }

    const renderStaticFrame = () => {
      window.cancelAnimationFrame(frame)
      draw(performance.now())
    }

    const start = () => {
      window.cancelAnimationFrame(frame)
      lastTime = performance.now()
      if (shouldAnimate && isVisible) {
        frame = window.requestAnimationFrame(draw)
      } else {
        renderStaticFrame()
      }
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!options.moveParticlesOnHover) {
        return
      }

      const rect = canvas.getBoundingClientRect()
      const x = ((event.clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1
      const y = -(((event.clientY - rect.top) / Math.max(1, rect.height)) * 2 - 1)
      mouseRef.current = {
        x: x * options.particleHoverFactor,
        y: y * options.particleHoverFactor,
      }
    }

    const handleVisibility = () => {
      isVisible = document.visibilityState !== "hidden"
      shouldAnimate = getShouldAnimate()
      start()
    }

    const handleMotionPreference = () => {
      shouldAnimate = getShouldAnimate()
      start()
    }

    const resizeObserver = new ResizeObserver(() => {
      resize()
      shouldAnimate = getShouldAnimate()
      renderStaticFrame()
    })

    resize()
    resizeObserver.observe(canvas)
    document.addEventListener("visibilitychange", handleVisibility)
    window.addEventListener("resize", resize, { passive: true })
    reducedMotionQuery.addEventListener("change", handleMotionPreference)
    compactViewportQuery.addEventListener("change", handleMotionPreference)
    if (options.moveParticlesOnHover) {
      window.addEventListener("pointermove", handlePointerMove, { passive: true })
    }
    start()

    return () => {
      disposed = true
      window.cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      document.removeEventListener("visibilitychange", handleVisibility)
      window.removeEventListener("resize", resize)
      reducedMotionQuery.removeEventListener("change", handleMotionPreference)
      compactViewportQuery.removeEventListener("change", handleMotionPreference)
      if (options.moveParticlesOnHover) {
        window.removeEventListener("pointermove", handlePointerMove)
      }
      disposeParticlesResources(gl, resources)
    }
  }, [options])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn(styles.reactBitsParticlesCanvas, className)}
    />
  )
}

function createParticlesResources(
  gl: WebGLRenderingContext,
  options: ResolvedParticlesOptions,
): ParticlesResources | null {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource)
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource)
  if (!vertexShader || !fragmentShader) {
    return null
  }

  const program = gl.createProgram()
  if (!program) {
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

  const data = createParticleData(options)
  const positionBuffer = createArrayBuffer(gl, data.positions)
  const randomBuffer = createArrayBuffer(gl, data.randoms)
  const colorBuffer = createArrayBuffer(gl, data.colors)
  if (!positionBuffer || !randomBuffer || !colorBuffer) {
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
    randomBuffer,
    colorBuffer,
    attributes: {
      position: gl.getAttribLocation(program, "position"),
      random: gl.getAttribLocation(program, "random"),
      color: gl.getAttribLocation(program, "color"),
    },
    uniforms: {
      modelMatrix: getUniformLocation(gl, program, "modelMatrix"),
      viewMatrix: getUniformLocation(gl, program, "viewMatrix"),
      projectionMatrix: getUniformLocation(gl, program, "projectionMatrix"),
      time: getUniformLocation(gl, program, "uTime"),
      spread: getUniformLocation(gl, program, "uSpread"),
      baseSize: getUniformLocation(gl, program, "uBaseSize"),
      sizeRandomness: getUniformLocation(gl, program, "uSizeRandomness"),
      alphaParticles: getUniformLocation(gl, program, "uAlphaParticles"),
    },
  }
}

function renderParticles(
  gl: WebGLRenderingContext,
  resources: ParticlesResources,
  modelMatrix: Float32Array,
  viewMatrix: Float32Array,
  projectionMatrix: Float32Array,
  options: ResolvedParticlesOptions,
  time: number,
) {
  gl.clearColor(0, 0, 0, 0)
  gl.clear(gl.COLOR_BUFFER_BIT)
  gl.disable(gl.DEPTH_TEST)
  gl.enable(gl.BLEND)
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
  gl.useProgram(resources.program)

  bindAttribute(gl, resources.positionBuffer, resources.attributes.position, 3)
  bindAttribute(gl, resources.randomBuffer, resources.attributes.random, 4)
  bindAttribute(gl, resources.colorBuffer, resources.attributes.color, 3)

  gl.uniformMatrix4fv(resources.uniforms.modelMatrix, false, modelMatrix)
  gl.uniformMatrix4fv(resources.uniforms.viewMatrix, false, viewMatrix)
  gl.uniformMatrix4fv(resources.uniforms.projectionMatrix, false, projectionMatrix)
  gl.uniform1f(resources.uniforms.time, time)
  gl.uniform1f(resources.uniforms.spread, options.particleSpread)
  gl.uniform1f(resources.uniforms.baseSize, options.particleBaseSize * options.pixelRatio)
  gl.uniform1f(resources.uniforms.sizeRandomness, options.sizeRandomness)
  gl.uniform1f(resources.uniforms.alphaParticles, options.alphaParticles ? 1 : 0)
  gl.drawArrays(gl.POINTS, 0, options.particleCount)
}

function bindAttribute(
  gl: WebGLRenderingContext,
  buffer: WebGLBuffer,
  location: number,
  size: number,
) {
  if (location < 0) {
    return
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.enableVertexAttribArray(location)
  gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0)
}

function createArrayBuffer(gl: WebGLRenderingContext, data: Float32Array): WebGLBuffer | null {
  const buffer = gl.createBuffer()
  if (!buffer) {
    return null
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
  return buffer
}

function createParticleData(options: ResolvedParticlesOptions) {
  const count = options.particleCount
  const positions = new Float32Array(count * 3)
  const randoms = new Float32Array(count * 4)
  const colors = new Float32Array(count * 3)
  const random = seededRandom(hashParticleOptions(options))
  const palette = options.colors.map(hexToRgbColor)

  for (let index = 0; index < count; index += 1) {
    let x = 0
    let y = 0
    let z = 0
    let len = 0
    do {
      x = random() * 2 - 1
      y = random() * 2 - 1
      z = random() * 2 - 1
      len = x * x + y * y + z * z
    } while (len > 1 || len === 0)

    const radius = Math.cbrt(random())
    positions.set([x * radius, y * radius, z * radius], index * 3)
    randoms.set([random(), random(), random(), random()], index * 4)
    colors.set(palette[Math.floor(random() * palette.length)] ?? palette[0], index * 3)
  }

  return { positions, randoms, colors }
}

function disposeParticlesResources(gl: WebGLRenderingContext, resources: ParticlesResources) {
  gl.deleteBuffer(resources.positionBuffer)
  gl.deleteBuffer(resources.randomBuffer)
  gl.deleteBuffer(resources.colorBuffer)
  gl.deleteProgram(resources.program)
  gl.deleteShader(resources.vertexShader)
  gl.deleteShader(resources.fragmentShader)
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
    throw new Error(`Missing React Bits Particles uniform: ${name}`)
  }

  return location
}

function setPerspectiveMatrix(
  matrix: Float32Array,
  fovRadians: number,
  aspect: number,
  near: number,
  far: number,
) {
  const f = 1 / Math.tan(fovRadians / 2)
  matrix.fill(0)
  matrix[0] = f / aspect
  matrix[5] = f
  matrix[10] = (far + near) / (near - far)
  matrix[11] = -1
  matrix[14] = (2 * far * near) / (near - far)
}

function setTranslationMatrix(matrix: Float32Array, x: number, y: number, z: number) {
  matrix.fill(0)
  matrix[0] = 1
  matrix[5] = 1
  matrix[10] = 1
  matrix[12] = x
  matrix[13] = y
  matrix[14] = z
  matrix[15] = 1
}

function setModelMatrix(
  matrix: Float32Array,
  x: number,
  y: number,
  z: number,
  rotationX: number,
  rotationY: number,
  rotationZ: number,
) {
  const cx = Math.cos(rotationX)
  const sx = Math.sin(rotationX)
  const cy = Math.cos(rotationY)
  const sy = Math.sin(rotationY)
  const cz = Math.cos(rotationZ)
  const sz = Math.sin(rotationZ)

  const r00 = cz * cy
  const r01 = cz * sy * sx - sz * cx
  const r02 = cz * sy * cx + sz * sx
  const r10 = sz * cy
  const r11 = sz * sy * sx + cz * cx
  const r12 = sz * sy * cx - cz * sx
  const r20 = -sy
  const r21 = cy * sx
  const r22 = cy * cx

  matrix[0] = r00
  matrix[1] = r10
  matrix[2] = r20
  matrix[3] = 0
  matrix[4] = r01
  matrix[5] = r11
  matrix[6] = r21
  matrix[7] = 0
  matrix[8] = r02
  matrix[9] = r12
  matrix[10] = r22
  matrix[11] = 0
  matrix[12] = x
  matrix[13] = y
  matrix[14] = z
  matrix[15] = 1
}

function resolveParticlesOptions(options?: ReactBitsParticlesOptions): ResolvedParticlesOptions {
  return {
    particleCount: Math.round(clampNumber(options?.particleCount, DEFAULT_REACT_BITS_PARTICLES.particleCount, 20, 1500)),
    particleSpread: clampNumber(options?.particleSpread, DEFAULT_REACT_BITS_PARTICLES.particleSpread, 1, 30),
    speed: clampNumber(options?.speed, DEFAULT_REACT_BITS_PARTICLES.speed, 0, 1),
    colors: normalizeColorList(options?.colors, DEFAULT_REACT_BITS_PARTICLES.colors),
    moveParticlesOnHover: options?.moveParticlesOnHover === true,
    particleHoverFactor: clampNumber(
      options?.particleHoverFactor,
      DEFAULT_REACT_BITS_PARTICLES.particleHoverFactor,
      0,
      5,
    ),
    alphaParticles: options?.alphaParticles === true,
    particleBaseSize: clampNumber(options?.particleBaseSize, DEFAULT_REACT_BITS_PARTICLES.particleBaseSize, 10, 300),
    sizeRandomness: clampNumber(options?.sizeRandomness, DEFAULT_REACT_BITS_PARTICLES.sizeRandomness, 0, 3),
    cameraDistance: clampNumber(options?.cameraDistance, DEFAULT_REACT_BITS_PARTICLES.cameraDistance, 5, 60),
    disableRotation: options?.disableRotation === true,
    pixelRatio: clampNumber(options?.pixelRatio, DEFAULT_REACT_BITS_PARTICLES.pixelRatio, 0.5, 2),
  }
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback
  }

  return Math.min(max, Math.max(min, value))
}

function normalizeColorList(value: unknown, fallback: [string, string, string]): [string, string, string] {
  if (!Array.isArray(value)) {
    return fallback
  }

  return [
    normalizeHexColor(value[0], fallback[0]),
    normalizeHexColor(value[1], fallback[1]),
    normalizeHexColor(value[2], fallback[2]),
  ]
}

function normalizeHexColor(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback
  }

  const normalized = value.trim()
  return /^#[0-9a-f]{6}$/i.test(normalized) ? normalized.toUpperCase() : fallback
}

function hexToRgbColor(hex: string): RgbColor {
  const normalized = normalizeHexColor(hex, "#FFFFFF").slice(1)
  const value = Number.parseInt(normalized, 16)
  return [
    ((value >> 16) & 255) / 255,
    ((value >> 8) & 255) / 255,
    (value & 255) / 255,
  ]
}

function hashParticleOptions(options: ResolvedParticlesOptions): number {
  const text = `${options.particleCount}:${options.colors.join(":")}`
  let hash = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function seededRandom(seed: number) {
  let state = seed || 1
  return () => {
    state = Math.imul(1664525, state) + 1013904223
    return ((state >>> 0) / 4294967296)
  }
}
