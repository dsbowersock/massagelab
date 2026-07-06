"use client"

import { type CSSProperties, useEffect, useMemo, useRef } from "react"
import { shouldAnimateAmbientBackground } from "@/lib/motion-preferences"
import { cn } from "@/lib/utils"
import styles from "@/components/backgrounds/BackgroundHost.module.css"
import type {
  BackgroundEffectProps,
  ReactBitsLightPillarOptions,
} from "./css-backgrounds"

type LightPillarQuality = NonNullable<ReactBitsLightPillarOptions["quality"]>
type LightPillarBlendMode = NonNullable<ReactBitsLightPillarOptions["mixBlendMode"]>
type ResolvedLightPillarOptions = Required<ReactBitsLightPillarOptions>
type RgbColor = [number, number, number]

type LightPillarQualitySettings = {
  iterations: number
  pixelRatio: number
  precision: "mediump" | "highp"
  stepMultiplier: number
  targetFps: number
  waveIterations: number
}

type LightPillarResources = {
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
    mouse: WebGLUniformLocation
    topColor: WebGLUniformLocation
    bottomColor: WebGLUniformLocation
    intensity: WebGLUniformLocation
    interactive: WebGLUniformLocation
    glowAmount: WebGLUniformLocation
    pillarWidth: WebGLUniformLocation
    pillarHeight: WebGLUniformLocation
    noiseIntensity: WebGLUniformLocation
    rotationCos: WebGLUniformLocation
    rotationSin: WebGLUniformLocation
    pillarRotationCos: WebGLUniformLocation
    pillarRotationSin: WebGLUniformLocation
    waveSin: WebGLUniformLocation
    waveCos: WebGLUniformLocation
  }
}

const DEFAULT_REACT_BITS_LIGHT_PILLAR: ResolvedLightPillarOptions = {
  topColor: "#5227FF",
  bottomColor: "#FF9FFC",
  intensity: 1,
  rotationSpeed: 0.3,
  interactive: false,
  glowAmount: 0.005,
  pillarWidth: 3,
  pillarHeight: 0.4,
  noiseIntensity: 0.5,
  mixBlendMode: "screen",
  pillarRotation: 0,
  quality: "high",
}

const QUALITY_SETTINGS: Record<LightPillarQuality, LightPillarQualitySettings> = {
  low: {
    iterations: 24,
    waveIterations: 1,
    pixelRatio: 0.5,
    precision: "mediump",
    stepMultiplier: 1.5,
    targetFps: 30,
  },
  medium: {
    iterations: 40,
    waveIterations: 2,
    pixelRatio: 0.65,
    precision: "mediump",
    stepMultiplier: 1.2,
    targetFps: 60,
  },
  high: {
    iterations: 80,
    waveIterations: 4,
    pixelRatio: 1,
    precision: "highp",
    stepMultiplier: 1,
    targetFps: 60,
  },
}

const vertexShaderSource = `
  attribute vec2 aPosition;
  varying vec2 vUv;

  void main() {
    vUv = aPosition * 0.5 + 0.5;
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`

// React Bits Light Pillar ships as a Three.js shader material. MassageLab keeps
// the source raymarching shader and quality presets, replacing only the runtime
// shell with native WebGL so no new heavy dependency is added.
export default function ReactBitsLightPillarBackground({
  className,
  reactBitsLightPillar,
}: BackgroundEffectProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const topColor = reactBitsLightPillar?.topColor
  const bottomColor = reactBitsLightPillar?.bottomColor
  const intensity = reactBitsLightPillar?.intensity
  const rotationSpeed = reactBitsLightPillar?.rotationSpeed
  const interactive = reactBitsLightPillar?.interactive
  const glowAmount = reactBitsLightPillar?.glowAmount
  const pillarWidth = reactBitsLightPillar?.pillarWidth
  const pillarHeight = reactBitsLightPillar?.pillarHeight
  const noiseIntensity = reactBitsLightPillar?.noiseIntensity
  const mixBlendMode = reactBitsLightPillar?.mixBlendMode
  const pillarRotation = reactBitsLightPillar?.pillarRotation
  const quality = reactBitsLightPillar?.quality
  const options = useMemo(
    () => resolveLightPillarOptions({
      topColor,
      bottomColor,
      intensity,
      rotationSpeed,
      interactive,
      glowAmount,
      pillarWidth,
      pillarHeight,
      noiseIntensity,
      mixBlendMode,
      pillarRotation,
      quality,
    }),
    [
      bottomColor,
      glowAmount,
      intensity,
      interactive,
      mixBlendMode,
      noiseIntensity,
      pillarHeight,
      pillarRotation,
      pillarWidth,
      quality,
      rotationSpeed,
      topColor,
    ],
  )
  const topRgb = useMemo(() => parseHexColorToRgb(options.topColor), [options.topColor])
  const bottomRgb = useMemo(() => parseHexColorToRgb(options.bottomColor), [options.bottomColor])
  const style = {
    mixBlendMode: options.mixBlendMode,
  } as CSSProperties

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    const effectiveQuality = resolveEffectiveQuality(options.quality)
    const qualitySettings = QUALITY_SETTINGS[effectiveQuality]
    const context = canvas?.getContext("webgl", {
      alpha: true,
      antialias: false,
      depth: false,
      powerPreference: effectiveQuality === "high" ? "high-performance" : "low-power",
      preserveDrawingBuffer: false,
      stencil: false,
    })

    if (!container || !canvas || !context) {
      return undefined
    }

    const resources = createLightPillarResources(context, qualitySettings)

    if (!resources) {
      return undefined
    }

    context.disable(context.DEPTH_TEST)
    context.disable(context.CULL_FACE)
    context.disable(context.BLEND)

    const resolution = new Float32Array(2)
    const mouse = new Float32Array([0, 0])
    const pillarRotationRadians = (options.pillarRotation * Math.PI) / 180
    const waveSin = Math.sin(0.4)
    const waveCos = Math.cos(0.4)
    const frameTime = 1000 / qualitySettings.targetFps
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const compactViewportQuery = window.matchMedia("(max-width: 360px), (max-height: 360px)")
    let animationFrame = 0
    let resizeRetryFrame = 0
    let shouldRun = false
    let viewportWidth = 1
    let viewportHeight = 1
    let time = 0
    let lastFrameTimestamp = performance.now()
    let hasPointer = false

    const bindStaticUniforms = () => {
      context.useProgram(resources.program)
      context.uniform3f(resources.uniforms.topColor, topRgb[0], topRgb[1], topRgb[2])
      context.uniform3f(resources.uniforms.bottomColor, bottomRgb[0], bottomRgb[1], bottomRgb[2])
      context.uniform1f(resources.uniforms.intensity, options.intensity)
      context.uniform1i(resources.uniforms.interactive, options.interactive ? 1 : 0)
      context.uniform1f(resources.uniforms.glowAmount, options.glowAmount)
      context.uniform1f(resources.uniforms.pillarWidth, options.pillarWidth)
      context.uniform1f(resources.uniforms.pillarHeight, options.pillarHeight)
      context.uniform1f(resources.uniforms.noiseIntensity, options.noiseIntensity)
      context.uniform1f(resources.uniforms.pillarRotationCos, Math.cos(pillarRotationRadians))
      context.uniform1f(resources.uniforms.pillarRotationSin, Math.sin(pillarRotationRadians))
      context.uniform1f(resources.uniforms.waveSin, waveSin)
      context.uniform1f(resources.uniforms.waveCos, waveCos)
    }

    const drawFrame = (timestamp: number, animate: boolean) => {
      if (canvas.width <= 1 || canvas.height <= 1) {
        return false
      }

      const deltaMs = timestamp - lastFrameTimestamp
      if (animate && deltaMs < frameTime) {
        return true
      }

      if (animate) {
        time += 0.016 * options.rotationSpeed
        lastFrameTimestamp = timestamp - (deltaMs % frameTime)
      } else {
        time = 0
        lastFrameTimestamp = timestamp
      }

      const rotationCos = Math.cos(time * 0.3)
      const rotationSin = Math.sin(time * 0.3)
      context.viewport(0, 0, canvas.width, canvas.height)
      context.clearColor(0, 0, 0, 0)
      context.clear(context.COLOR_BUFFER_BIT)
      context.useProgram(resources.program)
      context.bindBuffer(context.ARRAY_BUFFER, resources.positionBuffer)
      context.enableVertexAttribArray(resources.attributes.position)
      context.vertexAttribPointer(resources.attributes.position, 2, context.FLOAT, false, 0, 0)
      context.uniform1f(resources.uniforms.time, time)
      context.uniform2fv(resources.uniforms.resolution, resolution)
      context.uniform2fv(resources.uniforms.mouse, hasPointer ? mouse : new Float32Array([0, 0]))
      context.uniform1f(resources.uniforms.rotationCos, rotationCos)
      context.uniform1f(resources.uniforms.rotationSin, rotationSin)
      context.drawArrays(context.TRIANGLES, 0, 3)

      return animate && (options.rotationSpeed > 1e-6 || options.interactive)
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
      const highQualityDpr = Math.min(window.devicePixelRatio || 1, 2)
      const pixelRatio = effectiveQuality === "high" ? highQualityDpr : qualitySettings.pixelRatio
      canvas.width = Math.max(1, Math.floor(width * pixelRatio))
      canvas.height = Math.max(1, Math.floor(height * pixelRatio))
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      resolution[0] = width
      resolution[1] = height
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

      if (options.rotationSpeed < 1e-6 && !options.interactive) {
        resizeCanvas()
        return
      }

      shouldRun = true
      lastFrameTimestamp = performance.now()
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

      mouse[0] = ((event.clientX - bounds.left) / bounds.width) * 2 - 1
      mouse[1] = -((event.clientY - bounds.top) / bounds.height) * 2 + 1
      hasPointer = true
      if (!shouldRun) {
        updateAnimationState()
      }
    }

    const handlePointerLeave = () => {
      hasPointer = false
    }

    bindStaticUniforms()
    const resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(container)
    window.addEventListener("resize", handleResize)
    if (options.interactive) {
      window.addEventListener("pointermove", handlePointerMove, { passive: true })
      window.addEventListener("mouseleave", handlePointerLeave)
      window.addEventListener("blur", handlePointerLeave)
    }
    reducedMotionQuery.addEventListener("change", updateAnimationState)
    compactViewportQuery.addEventListener("change", updateAnimationState)
    document.addEventListener("visibilitychange", updateAnimationState)
    updateAnimationState()

    return () => {
      stopAnimation()
      resizeObserver.disconnect()
      window.removeEventListener("resize", handleResize)
      if (options.interactive) {
        window.removeEventListener("pointermove", handlePointerMove)
        window.removeEventListener("mouseleave", handlePointerLeave)
        window.removeEventListener("blur", handlePointerLeave)
      }
      reducedMotionQuery.removeEventListener("change", updateAnimationState)
      compactViewportQuery.removeEventListener("change", updateAnimationState)
      document.removeEventListener("visibilitychange", updateAnimationState)
      context.deleteBuffer(resources.positionBuffer)
      context.deleteProgram(resources.program)
      context.deleteShader(resources.vertexShader)
      context.deleteShader(resources.fragmentShader)
      canvas.width = 1
      canvas.height = 1
    }
  }, [bottomRgb, options, topRgb])

  return (
    <div
      ref={containerRef}
      className={cn(styles.effectLayer, styles.reactBitsLightPillar, className)}
      style={style}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className={styles.reactBitsLightPillarCanvas} />
    </div>
  )
}

function buildFragmentShaderSource(settings: LightPillarQualitySettings) {
  return `
    precision ${settings.precision} float;

    uniform float uTime;
    uniform vec2 uResolution;
    uniform vec2 uMouse;
    uniform vec3 uTopColor;
    uniform vec3 uBottomColor;
    uniform float uIntensity;
    uniform bool uInteractive;
    uniform float uGlowAmount;
    uniform float uPillarWidth;
    uniform float uPillarHeight;
    uniform float uNoiseIntensity;
    uniform float uRotCos;
    uniform float uRotSin;
    uniform float uPillarRotCos;
    uniform float uPillarRotSin;
    uniform float uWaveSin;
    uniform float uWaveCos;
    varying vec2 vUv;

    const float STEP_MULT = ${settings.stepMultiplier.toFixed(1)};
    const int MAX_ITER = ${settings.iterations};
    const int WAVE_ITER = ${settings.waveIterations};

    vec3 tanh3(vec3 x) {
      vec3 e2x = exp(2.0 * x);
      return (e2x - 1.0) / (e2x + 1.0);
    }

    void main() {
      vec2 uv = (vUv * 2.0 - 1.0) * vec2(uResolution.x / uResolution.y, 1.0);
      uv = vec2(uPillarRotCos * uv.x - uPillarRotSin * uv.y, uPillarRotSin * uv.x + uPillarRotCos * uv.y);

      vec3 ro = vec3(0.0, 0.0, -10.0);
      vec3 rd = normalize(vec3(uv, 1.0));

      float rotC = uRotCos;
      float rotS = uRotSin;
      if(uInteractive && (uMouse.x != 0.0 || uMouse.y != 0.0)) {
        float a = uMouse.x * 6.283185;
        rotC = cos(a);
        rotS = sin(a);
      }

      vec3 col = vec3(0.0);
      float t = 0.1;

      for(int i = 0; i < MAX_ITER; i++) {
        vec3 p = ro + rd * t;
        p.xz = vec2(rotC * p.x - rotS * p.z, rotS * p.x + rotC * p.z);

        vec3 q = p;
        q.y = p.y * uPillarHeight + uTime;

        float freq = 1.0;
        float amp = 1.0;
        for(int j = 0; j < WAVE_ITER; j++) {
          q.xz = vec2(uWaveCos * q.x - uWaveSin * q.z, uWaveSin * q.x + uWaveCos * q.z);
          q += cos(q.zxy * freq - uTime * float(j) * 2.0) * amp;
          freq *= 2.0;
          amp *= 0.5;
        }

        float d = length(cos(q.xz)) - 0.2;
        float bound = length(p.xz) - uPillarWidth;
        float k = 4.0;
        float h = max(k - abs(d - bound), 0.0);
        d = max(d, bound) + h * h * 0.0625 / k;
        d = abs(d) * 0.15 + 0.01;

        float grad = clamp((15.0 - p.y) / 30.0, 0.0, 1.0);
        col += mix(uBottomColor, uTopColor, grad) / d;

        t += d * STEP_MULT;
        if(t > 50.0) break;
      }

      float widthNorm = uPillarWidth / 3.0;
      col = tanh3(col * uGlowAmount / widthNorm);

      col -= fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453) / 15.0 * uNoiseIntensity;

      gl_FragColor = vec4(col * uIntensity, 1.0);
    }
  `
}

function createLightPillarResources(
  context: WebGLRenderingContext,
  settings: LightPillarQualitySettings,
): LightPillarResources | null {
  const vertexShader = createShader(context, context.VERTEX_SHADER, vertexShaderSource)
  const fragmentShader = createShader(context, context.FRAGMENT_SHADER, buildFragmentShaderSource(settings))

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
  const position = context.getAttribLocation(program, "aPosition")

  if (!positionBuffer || position < 0) {
    if (positionBuffer) {
      context.deleteBuffer(positionBuffer)
    }
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
      position,
    },
    uniforms: {
      time: getUniformLocation(context, program, "uTime"),
      resolution: getUniformLocation(context, program, "uResolution"),
      mouse: getUniformLocation(context, program, "uMouse"),
      topColor: getUniformLocation(context, program, "uTopColor"),
      bottomColor: getUniformLocation(context, program, "uBottomColor"),
      intensity: getUniformLocation(context, program, "uIntensity"),
      interactive: getUniformLocation(context, program, "uInteractive"),
      glowAmount: getUniformLocation(context, program, "uGlowAmount"),
      pillarWidth: getUniformLocation(context, program, "uPillarWidth"),
      pillarHeight: getUniformLocation(context, program, "uPillarHeight"),
      noiseIntensity: getUniformLocation(context, program, "uNoiseIntensity"),
      rotationCos: getUniformLocation(context, program, "uRotCos"),
      rotationSin: getUniformLocation(context, program, "uRotSin"),
      pillarRotationCos: getUniformLocation(context, program, "uPillarRotCos"),
      pillarRotationSin: getUniformLocation(context, program, "uPillarRotSin"),
      waveSin: getUniformLocation(context, program, "uWaveSin"),
      waveCos: getUniformLocation(context, program, "uWaveCos"),
    },
  }
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
    throw new Error(`Missing React Bits Light Pillar shader uniform: ${name}`)
  }

  return location
}

function resolveEffectiveQuality(requestedQuality: LightPillarQuality): LightPillarQuality {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  const hardwareConcurrency = navigator.hardwareConcurrency || 8
  const isLowEndDevice = isMobile || hardwareConcurrency <= 4

  if (isMobile && requestedQuality !== "low") {
    return "low"
  }
  if (isLowEndDevice && requestedQuality === "high") {
    return "medium"
  }

  return requestedQuality
}

function resolveLightPillarOptions(
  options: ReactBitsLightPillarOptions | undefined,
): ResolvedLightPillarOptions {
  return {
    topColor: normalizeHexColor(options?.topColor, DEFAULT_REACT_BITS_LIGHT_PILLAR.topColor),
    bottomColor: normalizeHexColor(options?.bottomColor, DEFAULT_REACT_BITS_LIGHT_PILLAR.bottomColor),
    intensity: clampNumber(options?.intensity, DEFAULT_REACT_BITS_LIGHT_PILLAR.intensity, 0.1, 3),
    rotationSpeed: clampNumber(options?.rotationSpeed, DEFAULT_REACT_BITS_LIGHT_PILLAR.rotationSpeed, 0, 2),
    interactive: options?.interactive === true,
    glowAmount: clampNumber(options?.glowAmount, DEFAULT_REACT_BITS_LIGHT_PILLAR.glowAmount, 0.001, 0.03),
    pillarWidth: clampNumber(options?.pillarWidth, DEFAULT_REACT_BITS_LIGHT_PILLAR.pillarWidth, 0.5, 8),
    pillarHeight: clampNumber(options?.pillarHeight, DEFAULT_REACT_BITS_LIGHT_PILLAR.pillarHeight, 0.1, 2),
    noiseIntensity: clampNumber(options?.noiseIntensity, DEFAULT_REACT_BITS_LIGHT_PILLAR.noiseIntensity, 0, 1),
    mixBlendMode: resolveBlendMode(options?.mixBlendMode),
    pillarRotation: clampNumber(options?.pillarRotation, DEFAULT_REACT_BITS_LIGHT_PILLAR.pillarRotation, -180, 180),
    quality: resolveQuality(options?.quality),
  }
}

function resolveQuality(value: LightPillarQuality | undefined): LightPillarQuality {
  return value === "low" || value === "medium" || value === "high"
    ? value
    : DEFAULT_REACT_BITS_LIGHT_PILLAR.quality
}

function resolveBlendMode(value: LightPillarBlendMode | undefined): LightPillarBlendMode {
  return value === "normal" || value === "lighten" || value === "plus-lighter" || value === "screen"
    ? value
    : DEFAULT_REACT_BITS_LIGHT_PILLAR.mixBlendMode
}

function normalizeHexColor(value: string | undefined, fallback: string) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value.toUpperCase() : fallback
}

function parseHexColorToRgb(value: string): RgbColor {
  const hex = normalizeHexColor(value, "#FFFFFF").slice(1)
  return [
    Number.parseInt(hex.slice(0, 2), 16) / 255,
    Number.parseInt(hex.slice(2, 4), 16) / 255,
    Number.parseInt(hex.slice(4, 6), 16) / 255,
  ]
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback
}
