"use client"

import { useEffect, useMemo, useRef } from "react"
import { shouldAnimateAmbientBackground } from "@/lib/motion-preferences"
import { cn } from "@/lib/utils"
import styles from "@/components/backgrounds/BackgroundHost.module.css"
import type { BackgroundEffectProps, ChamaacAstralFlowOptions } from "./css-backgrounds"

type RgbColor = [number, number, number]

type ResolvedAstralFlowOptions = Required<ChamaacAstralFlowOptions>

type AstralFlowWebGlResources = {
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
    flowMin: WebGLUniformLocation
    flowMax: WebGLUniformLocation
  }
}

const DEFAULT_CHAMAAC_ASTRAL_FLOW: ResolvedAstralFlowOptions = {
  color1: "#05070A",
  color2: "#2E1A38",
  color3: "#A0769A",
  speed: 1.5,
  flowMin: 3,
  flowMax: 7,
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
  uniform float uFlowMin;
  uniform float uFlowMax;

  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

  float snoise(vec2 v) {
    const vec4 C = vec4(
      0.211324865405187,
      0.366025403784439,
      -0.577350269189626,
      0.024390243902439
    );
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(
      permute(i.y + vec3(0.0, i1.y, 1.0))
        + i.x + vec3(0.0, i1.x, 1.0)
    );
    vec3 m = max(
      0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)),
      0.0
    );
    m = m * m;
    m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  float fbm(vec2 x) {
    float v = 0.0;
    float a = 0.5;
    vec2 shift = vec2(100.0);
    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));

    for (int i = 0; i < 5; ++i) {
      v += a * snoise(x);
      x = rot * x * 2.0 + shift;
      a *= 0.5;
    }

    return v;
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / uResolution.xy;
    vec2 p = uv * 2.0 - 1.0;
    p.x *= uResolution.x / uResolution.y;

    float flowMin = min(uFlowMin, uFlowMax);
    float flowMax = max(uFlowMin, uFlowMax);
    float midpoint = (flowMax + flowMin) * 0.5;
    float amplitude = (flowMax - flowMin) * 0.5;
    float flowTime = (midpoint + amplitude * sin(uTime * 0.5 - 1.5708)) * 0.25;
    vec2 drift = vec2(sin(uTime * 0.15), cos(uTime * 0.15));

    float radius = length(p);
    vec2 dir = p / (radius + 0.1);

    vec2 q = vec2(0.0);
    q.x = fbm(p - dir * flowTime);
    q.y = fbm(p - dir * flowTime + vec2(1.0));

    vec2 r = vec2(0.0);
    r.x = fbm(p + q + vec2(1.7, 9.2) - dir * flowTime * 0.8 + drift);
    r.y = fbm(p + q + vec2(8.3, 2.8) - dir * flowTime * 0.6 + drift);

    float f = fbm(p + r);
    vec3 color = mix(
      uColor1,
      uColor2,
      clamp((f * f) * 4.0, 0.0, 1.0)
    );

    color = mix(color, uColor3, clamp(length(q), 0.0, 1.0));

    float vignette = length(uv - 0.5);
    color = mix(color, vec3(0.0), smoothstep(0.4, 1.5, vignette));

    float opacity = smoothstep(0.1, 0.9, f + 0.4);
    gl_FragColor = vec4(color, opacity);
  }
`

// Chamaac UI Astral Flow ships as a Three/R3F shader component. This keeps the
// same shader controls in MassageLab without adding that dependency stack.
export default function ChamaacAstralFlowBackground({
  className,
  chamaacAstralFlow,
}: BackgroundEffectProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const color1 = chamaacAstralFlow?.color1
  const color2 = chamaacAstralFlow?.color2
  const color3 = chamaacAstralFlow?.color3
  const speed = chamaacAstralFlow?.speed
  const flowMin = chamaacAstralFlow?.flowMin
  const flowMax = chamaacAstralFlow?.flowMax
  const options = useMemo(
    () => resolveAstralFlowOptions({
      color1,
      color2,
      color3,
      speed,
      flowMin,
      flowMax,
    }),
    [color1, color2, color3, flowMax, flowMin, speed],
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
      alpha: true,
      antialias: false,
      depth: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false,
      stencil: false,
    })

    if (!container || !canvas || !context) {
      return undefined
    }

    const resources = createAstralFlowResources(context)

    if (!resources) {
      return undefined
    }

    // Three's transparent shader material blends the full-screen quad before the
    // browser composites the canvas; keep the native WebGL port on that path.
    context.enable(context.BLEND)
    context.blendFunc(context.SRC_ALPHA, context.ONE_MINUS_SRC_ALPHA)

    let animationFrame = 0
    let resizeRetryFrame = 0
    let shouldRun = false
    let viewportWidth = 1
    let viewportHeight = 1
    const startTimestamp = performance.now()
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const compactViewportQuery = window.matchMedia("(max-width: 640px)")

    const drawFrame = (timestamp: number, animate: boolean) => {
      if (canvas.width <= 1 || canvas.height <= 1) {
        return
      }

      // Match the Chamaac/R3F source, where shader time starts when the canvas mounts.
      const elapsedSeconds = Math.max(0, (timestamp - startTimestamp) / 1000)
      const time = animate ? (elapsedSeconds * options.speed) % (40 * Math.PI) : 0

      context.clearColor(0, 0, 0, 0)
      context.clear(context.COLOR_BUFFER_BIT)
      context.viewport(0, 0, canvas.width, canvas.height)
      context.useProgram(resources.program)
      context.uniform2f(resources.uniforms.resolution, canvas.width, canvas.height)
      context.uniform1f(resources.uniforms.time, time)
      context.uniform3f(resources.uniforms.color1, palette[0][0], palette[0][1], palette[0][2])
      context.uniform3f(resources.uniforms.color2, palette[1][0], palette[1][1], palette[1][2])
      context.uniform3f(resources.uniforms.color3, palette[2][0], palette[2][1], palette[2][2])
      context.uniform1f(resources.uniforms.flowMin, options.flowMin)
      context.uniform1f(resources.uniforms.flowMax, options.flowMax)
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
      className={cn(styles.effectLayer, styles.chamaacAstralFlow, className)}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className={styles.chamaacAstralFlowCanvas} />
      <div className={styles.chamaacAstralFlowNoise} />
    </div>
  )
}

function createAstralFlowResources(context: WebGLRenderingContext): AstralFlowWebGlResources | null {
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
      flowMin: getUniformLocation(context, program, "uFlowMin"),
      flowMax: getUniformLocation(context, program, "uFlowMax"),
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
    throw new Error(`Missing Chamaac Astral Flow shader uniform: ${name}`)
  }

  return location
}

function resolveAstralFlowOptions(options: ChamaacAstralFlowOptions): ResolvedAstralFlowOptions {
  const flowMin = clampNumber(options.flowMin, DEFAULT_CHAMAAC_ASTRAL_FLOW.flowMin, 0.5, 10)
  const flowMax = clampNumber(options.flowMax, DEFAULT_CHAMAAC_ASTRAL_FLOW.flowMax, 1, 12)

  return {
    color1: normalizeHexColor(options.color1, DEFAULT_CHAMAAC_ASTRAL_FLOW.color1),
    color2: normalizeHexColor(options.color2, DEFAULT_CHAMAAC_ASTRAL_FLOW.color2),
    color3: normalizeHexColor(options.color3, DEFAULT_CHAMAAC_ASTRAL_FLOW.color3),
    speed: clampNumber(options.speed, DEFAULT_CHAMAAC_ASTRAL_FLOW.speed, 0.1, 3),
    flowMin: Math.min(flowMin, flowMax),
    flowMax: Math.max(flowMin, flowMax),
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
