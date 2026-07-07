"use client"

import { useEffect, useMemo, useRef } from "react"
import { shouldAnimateAmbientBackground } from "@/lib/motion-preferences"
import { cn } from "@/lib/utils"
import styles from "@/components/backgrounds/BackgroundHost.module.css"
import type { BackgroundEffectProps, MassageLabSynthesisOptions } from "./css-backgrounds"

type RgbColor = [number, number, number]

type ResolvedSynthesisOptions = Required<MassageLabSynthesisOptions>

// 60 * Math.PI keeps shader time bounded as a precision guard while avoiding a
// simplified cycle that would make the synthesis pattern visibly repeat.
const TIME_LOOP_SECONDS = 60 * Math.PI

type SynthesisWebGlResources = {
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
    color1: WebGLUniformLocation
    color2: WebGLUniformLocation
    color3: WebGLUniformLocation
    scale: WebGLUniformLocation
    complexity: WebGLUniformLocation
    distortion: WebGLUniformLocation
    glowIntensity: WebGLUniformLocation
    flowFrequency: WebGLUniformLocation
    contrast: WebGLUniformLocation
  }
}

const DEFAULT_MASSAGE_LAB_SYNTHESIS: ResolvedSynthesisOptions = {
  color1: "#0F172A",
  color2: "#3B0764",
  color3: "#0EA5E9",
  speed: 0.4,
  complexity: 6,
  scale: 1,
  distortion: 0.6,
  glowIntensity: 0.4,
  flowFrequency: 3,
  contrast: 1.2,
}

const vertexShaderSource = `
  attribute vec2 aPosition;

  void main() {
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`

const fragmentShaderSource = `
  precision mediump float;

  uniform vec2 uResolution;
  uniform float uTime;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;
  uniform float uScale;
  uniform float uComplexity;
  uniform float uDistortion;
  uniform float uGlowIntensity;
  uniform float uFlowFrequency;
  uniform float uContrast;

  mat2 rot(float a) {
    float s = sin(a), c = cos(a);
    return mat2(c, -s, s, c);
  }

  void main() {
    float minRes = min(uResolution.x, uResolution.y);
    vec2 uv = (gl_FragCoord.xy * 2.0 - uResolution.xy) / minRes;
    vec2 p = uv * uScale;
    float t = uTime;

    for(int i = 1; i < 20; i++) {
      float fi = float(i);
      if(fi >= uComplexity) {
        break;
      }
      p *= rot(t * 0.08 + fi * 0.15);
      p += vec2(
        sin(p.x * fi + t),
        cos(p.x * fi - t)
      ) * (uDistortion / fi);
    }

    float flow1 = 0.5 + 0.5 * sin(p.x * (uFlowFrequency * 0.8) + t);
    float flow2 = 0.5 + 0.5 * sin(p.y * uFlowFrequency + t * 1.1);

    vec3 color = mix(uColor1, uColor2, flow1);
    color = mix(color, uColor3, flow2);

    float dist = length(uv);
    float glow = exp(-dist * 1.5);
    color += uColor3 * glow * uGlowIntensity;

    color = smoothstep(vec3(0.0), vec3(uContrast), color);

    gl_FragColor = vec4(color, 1.0);
  }
`

// MassageLab Synthesis is a Three/R3F shader component. This internal WebGL
// renderer ports the source fragment shader directly without adding that stack.
export default function MassageLabSynthesisBackground({
  className,
  massageLabSynthesis,
}: BackgroundEffectProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const color1 = massageLabSynthesis?.color1
  const color2 = massageLabSynthesis?.color2
  const color3 = massageLabSynthesis?.color3
  const speed = massageLabSynthesis?.speed
  const complexity = massageLabSynthesis?.complexity
  const scale = massageLabSynthesis?.scale
  const distortion = massageLabSynthesis?.distortion
  const glowIntensity = massageLabSynthesis?.glowIntensity
  const flowFrequency = massageLabSynthesis?.flowFrequency
  const contrast = massageLabSynthesis?.contrast
  const options = useMemo(
    () => resolveSynthesisOptions({
      color1,
      color2,
      color3,
      speed,
      complexity,
      scale,
      distortion,
      glowIntensity,
      flowFrequency,
      contrast,
    }),
    [color1, color2, color3, complexity, contrast, distortion, flowFrequency, glowIntensity, scale, speed],
  )
  const palette = useMemo(
    () => [
      parseHexColorToRgb(options.color1),
      parseHexColorToRgb(options.color2),
      parseHexColorToRgb(options.color3),
    ] as const,
    [options.color1, options.color2, options.color3],
  )

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    const context = canvas?.getContext("webgl", {
      alpha: false,
      antialias: false,
      depth: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false,
      stencil: false,
    })

    if (!container || !canvas || !context) {
      return undefined
    }

    const resources = createSynthesisResources(context)

    if (!resources) {
      return undefined
    }

    let animationFrame = 0
    let resizeRetryFrame = 0
    let shouldRun = false
    let viewportWidth = 1
    let viewportHeight = 1
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const compactViewportQuery = window.matchMedia("(max-width: 640px)")

    const drawFrame = (timestamp: number, animate: boolean) => {
      if (canvas.width <= 1 || canvas.height <= 1) {
        return
      }

      const time = animate ? ((timestamp / 1000) * options.speed) % TIME_LOOP_SECONDS : 0

      context.viewport(0, 0, canvas.width, canvas.height)
      context.useProgram(resources.program)
      context.uniform2f(resources.uniforms.resolution, canvas.width, canvas.height)
      context.uniform1f(resources.uniforms.time, time)
      context.uniform3f(resources.uniforms.color1, palette[0][0], palette[0][1], palette[0][2])
      context.uniform3f(resources.uniforms.color2, palette[1][0], palette[1][1], palette[1][2])
      context.uniform3f(resources.uniforms.color3, palette[2][0], palette[2][1], palette[2][2])
      context.uniform1f(resources.uniforms.scale, options.scale)
      context.uniform1f(resources.uniforms.complexity, options.complexity)
      context.uniform1f(resources.uniforms.distortion, options.distortion)
      context.uniform1f(resources.uniforms.glowIntensity, options.glowIntensity)
      context.uniform1f(resources.uniforms.flowFrequency, options.flowFrequency)
      context.uniform1f(resources.uniforms.contrast, options.contrast)
      context.drawArrays(context.TRIANGLE_STRIP, 0, 4)
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
      canvas.width = width
      canvas.height = height
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
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

      drawFrame(timestamp, true)
      animationFrame = window.requestAnimationFrame(draw)
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

    const resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(container)
    window.addEventListener("resize", handleResize)
    reducedMotionQuery.addEventListener("change", updateAnimationState)
    compactViewportQuery.addEventListener("change", updateAnimationState)
    document.addEventListener("visibilitychange", updateAnimationState)
    updateAnimationState()

    return () => {
      stopAnimation()
      resizeObserver.disconnect()
      window.removeEventListener("resize", handleResize)
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
  }, [options, palette])

  return (
    <div
      ref={containerRef}
      className={cn(styles.effectLayer, styles.massageLabSynthesis, className)}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className={styles.massageLabSynthesisCanvas} />
    </div>
  )
}

function createSynthesisResources(context: WebGLRenderingContext): SynthesisWebGlResources | null {
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

  if (!positionBuffer) {
    context.deleteProgram(program)
    context.deleteShader(vertexShader)
    context.deleteShader(fragmentShader)
    return null
  }

  const position = context.getAttribLocation(program, "aPosition")

  if (position < 0) {
    context.deleteBuffer(positionBuffer)
    context.deleteProgram(program)
    context.deleteShader(vertexShader)
    context.deleteShader(fragmentShader)
    return null
  }

  context.useProgram(program)
  context.bindBuffer(context.ARRAY_BUFFER, positionBuffer)
  context.bufferData(
    context.ARRAY_BUFFER,
    new Float32Array([
      -1, -1,
      1, -1,
      -1, 1,
      1, 1,
    ]),
    context.STATIC_DRAW,
  )
  context.enableVertexAttribArray(position)
  context.vertexAttribPointer(position, 2, context.FLOAT, false, 0, 0)

  return {
    program,
    vertexShader,
    fragmentShader,
    positionBuffer,
    attributes: {
      position,
    },
    uniforms: {
      resolution: getUniformLocation(context, program, "uResolution"),
      time: getUniformLocation(context, program, "uTime"),
      color1: getUniformLocation(context, program, "uColor1"),
      color2: getUniformLocation(context, program, "uColor2"),
      color3: getUniformLocation(context, program, "uColor3"),
      scale: getUniformLocation(context, program, "uScale"),
      complexity: getUniformLocation(context, program, "uComplexity"),
      distortion: getUniformLocation(context, program, "uDistortion"),
      glowIntensity: getUniformLocation(context, program, "uGlowIntensity"),
      flowFrequency: getUniformLocation(context, program, "uFlowFrequency"),
      contrast: getUniformLocation(context, program, "uContrast"),
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
    throw new Error(`Missing MassageLab Synthesis shader uniform: ${name}`)
  }

  return location
}

function resolveSynthesisOptions(options: MassageLabSynthesisOptions): ResolvedSynthesisOptions {
  return {
    color1: normalizeHexColor(options.color1, DEFAULT_MASSAGE_LAB_SYNTHESIS.color1),
    color2: normalizeHexColor(options.color2, DEFAULT_MASSAGE_LAB_SYNTHESIS.color2),
    color3: normalizeHexColor(options.color3, DEFAULT_MASSAGE_LAB_SYNTHESIS.color3),
    speed: clampNumber(options.speed, DEFAULT_MASSAGE_LAB_SYNTHESIS.speed, 0.1, 2),
    complexity: Math.trunc(clampNumber(options.complexity, DEFAULT_MASSAGE_LAB_SYNTHESIS.complexity, 1, 20)),
    scale: clampNumber(options.scale, DEFAULT_MASSAGE_LAB_SYNTHESIS.scale, 0.1, 5),
    distortion: clampNumber(options.distortion, DEFAULT_MASSAGE_LAB_SYNTHESIS.distortion, 0, 2),
    glowIntensity: clampNumber(options.glowIntensity, DEFAULT_MASSAGE_LAB_SYNTHESIS.glowIntensity, 0, 2),
    flowFrequency: clampNumber(options.flowFrequency, DEFAULT_MASSAGE_LAB_SYNTHESIS.flowFrequency, 0.5, 10),
    contrast: clampNumber(options.contrast, DEFAULT_MASSAGE_LAB_SYNTHESIS.contrast, 0.5, 2),
  }
}

function normalizeHexColor(value: string | undefined, fallback: string) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value.toUpperCase() : fallback
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback
}

function parseHexColorToRgb(value: string): RgbColor {
  const hex = normalizeHexColor(value, "#FFFFFF").slice(1)
  return [
    Number.parseInt(hex.slice(0, 2), 16) / 255,
    Number.parseInt(hex.slice(2, 4), 16) / 255,
    Number.parseInt(hex.slice(4, 6), 16) / 255,
  ]
}
