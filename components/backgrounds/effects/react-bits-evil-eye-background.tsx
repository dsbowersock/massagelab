"use client"

import { useEffect, useMemo, useRef } from "react"
import { shouldAnimateAmbientBackground } from "@/lib/motion-preferences"
import { cn } from "@/lib/utils"
import styles from "@/components/backgrounds/BackgroundHost.module.css"
import type { BackgroundEffectProps, ReactBitsEvilEyeOptions } from "./css-backgrounds"

type ResolvedEvilEyeOptions = Required<ReactBitsEvilEyeOptions>

type EvilEyeResources = {
  program: WebGLProgram
  vertexShader: WebGLShader
  fragmentShader: WebGLShader
  positionBuffer: WebGLBuffer
  noiseTexture: WebGLTexture
  attributes: {
    position: number
  }
  uniforms: {
    resolution: WebGLUniformLocation
    time: WebGLUniformLocation
    noiseTexture: WebGLUniformLocation
    pupilSize: WebGLUniformLocation
    irisWidth: WebGLUniformLocation
    glowIntensity: WebGLUniformLocation
    intensity: WebGLUniformLocation
    scale: WebGLUniformLocation
    noiseScale: WebGLUniformLocation
    mouse: WebGLUniformLocation
    pupilFollow: WebGLUniformLocation
    flameSpeed: WebGLUniformLocation
    eyeColor: WebGLUniformLocation
    backgroundColor: WebGLUniformLocation
  }
}

const DEFAULT_REACT_BITS_EVIL_EYE: ResolvedEvilEyeOptions = {
  eyeColor: "#FF6F37",
  intensity: 1.5,
  pupilSize: 0.6,
  irisWidth: 0.25,
  glowIntensity: 0.35,
  scale: 0.8,
  noiseScale: 1,
  pupilFollow: 1,
  flameSpeed: 1,
  backgroundColor: "#000000",
  interactive: false,
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
  uniform sampler2D uNoiseTexture;
  uniform float uPupilSize;
  uniform float uIrisWidth;
  uniform float uGlowIntensity;
  uniform float uIntensity;
  uniform float uScale;
  uniform float uNoiseScale;
  uniform vec2 uMouse;
  uniform float uPupilFollow;
  uniform float uFlameSpeed;
  uniform vec3 uEyeColor;
  uniform vec3 uBgColor;

  void main() {
    vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution.xy) / uResolution.y;
    uv /= uScale;
    float ft = uTime * uFlameSpeed;

    float polarRadius = length(uv) * 2.0;
    float polarAngle = (2.0 * atan(uv.x, uv.y)) / 6.28 * 0.3;
    vec2 polarUv = vec2(polarRadius, polarAngle);

    vec4 noiseA = texture2D(uNoiseTexture, polarUv * vec2(0.2, 7.0) * uNoiseScale + vec2(-ft * 0.1, 0.0));
    vec4 noiseB = texture2D(uNoiseTexture, polarUv * vec2(0.3, 4.0) * uNoiseScale + vec2(-ft * 0.2, 0.0));
    vec4 noiseC = texture2D(uNoiseTexture, polarUv * vec2(0.1, 5.0) * uNoiseScale + vec2(-ft * 0.1, 0.0));

    float distanceMask = 1.0 - length(uv);

    float innerRing = clamp(-1.0 * ((distanceMask - 0.7) / uIrisWidth), 0.0, 1.0);
    innerRing = (innerRing * distanceMask - 0.2) / 0.28;
    innerRing += noiseA.r - 0.5;
    innerRing *= 1.3;
    innerRing = clamp(innerRing, 0.0, 1.0);

    float outerRing = clamp(-1.0 * ((distanceMask - 0.5) / 0.2), 0.0, 1.0);
    outerRing = (outerRing * distanceMask - 0.1) / 0.38;
    outerRing += noiseC.r - 0.5;
    outerRing *= 1.3;
    outerRing = clamp(outerRing, 0.0, 1.0);

    innerRing += outerRing;

    float innerEye = distanceMask - 0.1 * 2.0;
    innerEye *= noiseB.r * 2.0;

    vec2 pupilOffset = uMouse * uPupilFollow * 0.12;
    vec2 pupilUv = uv - pupilOffset;
    float pupil = 1.0 - length(pupilUv * vec2(9.0, 2.3));
    pupil *= uPupilSize;
    pupil = clamp(pupil, 0.0, 1.0);
    pupil /= 0.35;

    float outerEyeGlow = 1.0 - length(uv * vec2(0.5, 1.5));
    outerEyeGlow = clamp(outerEyeGlow + 0.5, 0.0, 1.0);
    outerEyeGlow += noiseC.r - 0.5;
    float outerBgGlow = outerEyeGlow;
    outerEyeGlow = pow(outerEyeGlow, 2.0);
    outerEyeGlow += distanceMask;
    outerEyeGlow *= uGlowIntensity;
    outerEyeGlow = clamp(outerEyeGlow, 0.0, 1.0);
    outerEyeGlow *= pow(1.0 - distanceMask, 2.0) * 2.5;

    outerBgGlow += distanceMask;
    outerBgGlow = pow(outerBgGlow, 0.5);
    outerBgGlow *= 0.15;

    vec3 color = uEyeColor * uIntensity * clamp(max(innerRing + innerEye, outerEyeGlow + outerBgGlow) - pupil, 0.0, 3.0);
    color += uBgColor;

    gl_FragColor = vec4(color, 1.0);
  }
`

// React Bits Evil Eye ships as an OGL full-screen shader. MassageLab keeps the
// source noise texture and fragment math while using explicit WebGL resources.
export default function ReactBitsEvilEyeBackground({
  className,
  reactBitsEvilEye,
}: BackgroundEffectProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const eyeColor = reactBitsEvilEye?.eyeColor
  const intensity = reactBitsEvilEye?.intensity
  const pupilSize = reactBitsEvilEye?.pupilSize
  const irisWidth = reactBitsEvilEye?.irisWidth
  const glowIntensity = reactBitsEvilEye?.glowIntensity
  const scale = reactBitsEvilEye?.scale
  const noiseScale = reactBitsEvilEye?.noiseScale
  const pupilFollow = reactBitsEvilEye?.pupilFollow
  const flameSpeed = reactBitsEvilEye?.flameSpeed
  const backgroundColor = reactBitsEvilEye?.backgroundColor
  const interactive = reactBitsEvilEye?.interactive
  const options = useMemo(
    () =>
      resolveEvilEyeOptions({
        backgroundColor,
        eyeColor,
        flameSpeed,
        glowIntensity,
        intensity,
        interactive,
        irisWidth,
        noiseScale,
        pupilFollow,
        pupilSize,
        scale,
      }),
    [
      backgroundColor,
      eyeColor,
      flameSpeed,
      glowIntensity,
      intensity,
      interactive,
      irisWidth,
      noiseScale,
      pupilFollow,
      pupilSize,
      scale,
    ],
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

    const resources = createEvilEyeResources(context)

    if (!resources) {
      return undefined
    }

    context.disable(context.DEPTH_TEST)
    context.disable(context.CULL_FACE)
    context.disable(context.BLEND)

    const resolution = new Float32Array(3)
    const mouse = { x: 0, y: 0, targetX: 0, targetY: 0 }
    const startTimestamp = performance.now()
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const compactViewportQuery = window.matchMedia("(max-width: 360px), (max-height: 360px)")
    let animationFrame = 0
    let resizeRetryFrame = 0
    let shouldRun = false
    let viewportWidth = 1
    let viewportHeight = 1

    const bindStaticUniforms = () => {
      context.useProgram(resources.program)
      context.activeTexture(context.TEXTURE0)
      context.bindTexture(context.TEXTURE_2D, resources.noiseTexture)
      context.uniform1i(resources.uniforms.noiseTexture, 0)
      context.uniform1f(resources.uniforms.pupilSize, options.pupilSize)
      context.uniform1f(resources.uniforms.irisWidth, options.irisWidth)
      context.uniform1f(resources.uniforms.glowIntensity, options.glowIntensity)
      context.uniform1f(resources.uniforms.intensity, options.intensity)
      context.uniform1f(resources.uniforms.scale, options.scale)
      context.uniform1f(resources.uniforms.noiseScale, options.noiseScale)
      context.uniform1f(resources.uniforms.pupilFollow, options.interactive ? options.pupilFollow : 0)
      context.uniform1f(resources.uniforms.flameSpeed, options.flameSpeed)
      context.uniform3fv(resources.uniforms.eyeColor, hexToRgb(options.eyeColor))
      context.uniform3fv(resources.uniforms.backgroundColor, hexToRgb(options.backgroundColor))
    }

    const drawFrame = (timestamp: number, animate: boolean) => {
      if (canvas.width <= 1 || canvas.height <= 1) {
        return false
      }

      if (options.interactive) {
        mouse.x += (mouse.targetX - mouse.x) * 0.05
        mouse.y += (mouse.targetY - mouse.y) * 0.05
      } else {
        mouse.x += (0 - mouse.x) * 0.05
        mouse.y += (0 - mouse.y) * 0.05
      }

      const elapsedSeconds = animate ? Math.max(0, (timestamp - startTimestamp) / 1000) : 0
      context.viewport(0, 0, canvas.width, canvas.height)
      context.clearColor(0, 0, 0, 0)
      context.clear(context.COLOR_BUFFER_BIT)
      context.useProgram(resources.program)
      context.bindBuffer(context.ARRAY_BUFFER, resources.positionBuffer)
      context.enableVertexAttribArray(resources.attributes.position)
      context.vertexAttribPointer(resources.attributes.position, 2, context.FLOAT, false, 0, 0)
      context.activeTexture(context.TEXTURE0)
      context.bindTexture(context.TEXTURE_2D, resources.noiseTexture)
      context.uniform3fv(resources.uniforms.resolution, resolution)
      context.uniform2f(resources.uniforms.mouse, mouse.x, mouse.y)
      context.uniform1f(resources.uniforms.time, elapsedSeconds)
      context.drawArrays(context.TRIANGLES, 0, 3)

      return animate && options.flameSpeed >= 1e-6
    }

    const resizeCanvas = () => {
      const bounds = container.getBoundingClientRect()
      const width = Math.floor(bounds.width)
      const height = Math.floor(bounds.height)

      if (width <= 0 || height <= 0) {
        return false
      }

      viewportWidth = width
      viewportHeight = height
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
        shouldRun = false
        animationFrame = 0
      }
    }

    const stopAnimation = () => {
      shouldRun = false
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame)
        animationFrame = 0
      }
      if (resizeRetryFrame) {
        window.cancelAnimationFrame(resizeRetryFrame)
        resizeRetryFrame = 0
      }
      drawFrame(performance.now(), false)
    }

    const startAnimation = () => {
      if (shouldRun) {
        return
      }

      if (options.flameSpeed < 1e-6) {
        resizeCanvas()
        return
      }

      shouldRun = true
      if (!resizeCanvas()) {
        requestResizeRetry()
        return
      }
      animationFrame = window.requestAnimationFrame(draw)
    }

    const updateAnimationState = () => {
      const shouldAnimate = shouldAnimateAmbientBackground({
        prefersReducedMotion: reducedMotionQuery.matches,
        compactViewport: Math.min(viewportWidth, viewportHeight) < 360 || compactViewportQuery.matches,
        allowCompactViewport: true,
        documentHidden: document.hidden,
      })

      if (shouldAnimate) {
        startAnimation()
      } else {
        stopAnimation()
      }
    }

    const handleResize = () => {
      if (!resizeCanvas()) {
        requestResizeRetry()
      }
    }

    const handlePointerMove = (event: PointerEvent) => {
      const bounds = container.getBoundingClientRect()
      if (bounds.width <= 0 || bounds.height <= 0) {
        return
      }
      mouse.targetX = ((event.clientX - bounds.left) / bounds.width) * 2 - 1
      mouse.targetY = -(((event.clientY - bounds.top) / bounds.height) * 2 - 1)
    }

    const handlePointerLeave = () => {
      mouse.targetX = 0
      mouse.targetY = 0
    }

    bindStaticUniforms()
    const resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(container)
    window.addEventListener("resize", handleResize)
    reducedMotionQuery.addEventListener("change", updateAnimationState)
    compactViewportQuery.addEventListener("change", updateAnimationState)
    document.addEventListener("visibilitychange", updateAnimationState)
    if (options.interactive) {
      window.addEventListener("pointermove", handlePointerMove, { passive: true })
      window.addEventListener("pointerleave", handlePointerLeave)
    }
    updateAnimationState()

    return () => {
      stopAnimation()
      resizeObserver.disconnect()
      window.removeEventListener("resize", handleResize)
      reducedMotionQuery.removeEventListener("change", updateAnimationState)
      compactViewportQuery.removeEventListener("change", updateAnimationState)
      document.removeEventListener("visibilitychange", updateAnimationState)
      if (options.interactive) {
        window.removeEventListener("pointermove", handlePointerMove)
        window.removeEventListener("pointerleave", handlePointerLeave)
      }
      context.deleteTexture(resources.noiseTexture)
      context.deleteBuffer(resources.positionBuffer)
      context.deleteProgram(resources.program)
      context.deleteShader(resources.vertexShader)
      context.deleteShader(resources.fragmentShader)
      canvas.width = 1
      canvas.height = 1
    }
  }, [options])

  return (
    <div
      ref={containerRef}
      className={cn(styles.effectLayer, styles.reactBitsEvilEye, className)}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className={styles.reactBitsEvilEyeCanvas} />
    </div>
  )
}

function createEvilEyeResources(context: WebGLRenderingContext): EvilEyeResources | null {
  const vertexShader = createShader(context, context.VERTEX_SHADER, vertexShaderSource)
  const fragmentShader = createShader(context, context.FRAGMENT_SHADER, fragmentShaderSource)

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
  const noiseTexture = context.createTexture()
  const position = context.getAttribLocation(program, "aPosition")

  if (!positionBuffer || !noiseTexture || position < 0) {
    if (positionBuffer) {
      context.deleteBuffer(positionBuffer)
    }
    if (noiseTexture) {
      context.deleteTexture(noiseTexture)
    }
    context.deleteProgram(program)
    context.deleteShader(vertexShader)
    context.deleteShader(fragmentShader)
    return null
  }

  context.bindBuffer(context.ARRAY_BUFFER, positionBuffer)
  context.bufferData(context.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), context.STATIC_DRAW)
  context.bindTexture(context.TEXTURE_2D, noiseTexture)
  context.pixelStorei(context.UNPACK_ALIGNMENT, 1)
  context.texImage2D(
    context.TEXTURE_2D,
    0,
    context.RGBA,
    256,
    256,
    0,
    context.RGBA,
    context.UNSIGNED_BYTE,
    generateNoiseTexture(256),
  )
  context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MIN_FILTER, context.LINEAR)
  context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MAG_FILTER, context.LINEAR)
  context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_S, context.REPEAT)
  context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_T, context.REPEAT)

  return {
    program,
    vertexShader,
    fragmentShader,
    positionBuffer,
    noiseTexture,
    attributes: {
      position,
    },
    uniforms: {
      resolution: getUniformLocation(context, program, "uResolution"),
      time: getUniformLocation(context, program, "uTime"),
      noiseTexture: getUniformLocation(context, program, "uNoiseTexture"),
      pupilSize: getUniformLocation(context, program, "uPupilSize"),
      irisWidth: getUniformLocation(context, program, "uIrisWidth"),
      glowIntensity: getUniformLocation(context, program, "uGlowIntensity"),
      intensity: getUniformLocation(context, program, "uIntensity"),
      scale: getUniformLocation(context, program, "uScale"),
      noiseScale: getUniformLocation(context, program, "uNoiseScale"),
      mouse: getUniformLocation(context, program, "uMouse"),
      pupilFollow: getUniformLocation(context, program, "uPupilFollow"),
      flameSpeed: getUniformLocation(context, program, "uFlameSpeed"),
      eyeColor: getUniformLocation(context, program, "uEyeColor"),
      backgroundColor: getUniformLocation(context, program, "uBgColor"),
    },
  }
}

function generateNoiseTexture(size: number) {
  const data = new Uint8Array(size * size * 4)

  const hash = (x: number, y: number, seed: number) => {
    let n = x * 374761393 + y * 668265263 + seed * 1274126177
    n = Math.imul(n ^ (n >>> 13), 1274126177)
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296
  }

  const noise = (px: number, py: number, freq: number, seed: number) => {
    const fx = (px / size) * freq
    const fy = (py / size) * freq
    const ix = Math.floor(fx)
    const iy = Math.floor(fy)
    const tx = fx - ix
    const ty = fy - iy
    const wrap = freq | 0
    const v00 = hash(((ix % wrap) + wrap) % wrap, ((iy % wrap) + wrap) % wrap, seed)
    const v10 = hash((((ix + 1) % wrap) + wrap) % wrap, ((iy % wrap) + wrap) % wrap, seed)
    const v01 = hash(((ix % wrap) + wrap) % wrap, (((iy + 1) % wrap) + wrap) % wrap, seed)
    const v11 = hash((((ix + 1) % wrap) + wrap) % wrap, (((iy + 1) % wrap) + wrap) % wrap, seed)

    return v00 * (1 - tx) * (1 - ty) + v10 * tx * (1 - ty) + v01 * (1 - tx) * ty + v11 * tx * ty
  }

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let value = 0
      let amplitude = 0.4
      let totalAmplitude = 0

      for (let octave = 0; octave < 8; octave += 1) {
        const frequency = 32 * (1 << octave)
        value += amplitude * noise(x, y, frequency, octave * 31)
        totalAmplitude += amplitude
        amplitude *= 0.65
      }

      value /= totalAmplitude
      value = (value - 0.5) * 2.2 + 0.5
      value = Math.max(0, Math.min(1, value))

      const shade = Math.round(value * 255)
      const index = (y * size + x) * 4
      data[index] = shade
      data[index + 1] = shade
      data[index + 2] = shade
      data[index + 3] = 255
    }
  }

  return data
}

function createShader(context: WebGLRenderingContext, type: number, source: string) {
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

function getUniformLocation(context: WebGLRenderingContext, program: WebGLProgram, name: string) {
  const location = context.getUniformLocation(program, name)

  if (location === null) {
    throw new Error(`Missing React Bits Evil Eye shader uniform: ${name}`)
  }

  return location
}

function resolveEvilEyeOptions(options: ReactBitsEvilEyeOptions | undefined): ResolvedEvilEyeOptions {
  return {
    eyeColor: normalizeHexColor(options?.eyeColor, DEFAULT_REACT_BITS_EVIL_EYE.eyeColor),
    intensity: clampNumber(options?.intensity, DEFAULT_REACT_BITS_EVIL_EYE.intensity, 0, 3),
    pupilSize: clampNumber(options?.pupilSize, DEFAULT_REACT_BITS_EVIL_EYE.pupilSize, 0.1, 2),
    irisWidth: clampNumber(options?.irisWidth, DEFAULT_REACT_BITS_EVIL_EYE.irisWidth, 0.05, 1),
    glowIntensity: clampNumber(options?.glowIntensity, DEFAULT_REACT_BITS_EVIL_EYE.glowIntensity, 0, 1.5),
    scale: clampNumber(options?.scale, DEFAULT_REACT_BITS_EVIL_EYE.scale, 0.25, 2),
    noiseScale: clampNumber(options?.noiseScale, DEFAULT_REACT_BITS_EVIL_EYE.noiseScale, 0.1, 4),
    pupilFollow: clampNumber(options?.pupilFollow, DEFAULT_REACT_BITS_EVIL_EYE.pupilFollow, 0, 2),
    flameSpeed: clampNumber(options?.flameSpeed, DEFAULT_REACT_BITS_EVIL_EYE.flameSpeed, 0, 3),
    backgroundColor: normalizeHexColor(options?.backgroundColor, DEFAULT_REACT_BITS_EVIL_EYE.backgroundColor),
    interactive: typeof options?.interactive === "boolean" ? options.interactive : DEFAULT_REACT_BITS_EVIL_EYE.interactive,
  }
}

function normalizeHexColor(value: unknown, fallback: string) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback
}

function hexToRgb(value: string) {
  const hex = normalizeHexColor(value, "#000000").slice(1)
  return new Float32Array([
    Number.parseInt(hex.slice(0, 2), 16) / 255,
    Number.parseInt(hex.slice(2, 4), 16) / 255,
    Number.parseInt(hex.slice(4, 6), 16) / 255,
  ])
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback
}
