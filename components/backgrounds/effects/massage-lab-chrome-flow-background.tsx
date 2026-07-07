"use client"

import { useEffect, useMemo, useRef } from "react"
import { shouldAnimateAmbientBackground } from "@/lib/motion-preferences"
import { cn } from "@/lib/utils"
import styles from "@/components/backgrounds/BackgroundHost.module.css"
import type { BackgroundEffectProps, MassageLabChromeFlowOptions } from "./css-backgrounds"

type RgbColor = [number, number, number]

type ResolvedLiquidChromeOptions = Required<MassageLabChromeFlowOptions>

type LiquidChromeWebGlResources = {
  program: WebGLProgram
  vertexShader: WebGLShader
  fragmentShader: WebGLShader
  positionBuffer: WebGLBuffer
  attributes: {
    position: number
  }
  uniforms: {
    time: WebGLUniformLocation
    timeScale: WebGLUniformLocation
    color: WebGLUniformLocation
    color2: WebGLUniformLocation
  }
}

const DEFAULT_MASSAGELAB_LIQUID_CHROME: ResolvedLiquidChromeOptions = {
  speed: 0.35,
  timeScale: 0.225,
  color: "#C0C0C0",
  color2: "#4A4A4A",
}

const vertexShaderSource = `
  attribute vec2 aPosition;
  varying vec2 vUv;

  void main() {
    vUv = aPosition * 0.5 + 0.5;
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`

const fragmentShaderSource = `
  precision mediump float;

  uniform float uTime;
  uniform float uTimeScale;
  uniform vec3 uColor;
  uniform vec3 uColor2;
  varying vec2 vUv;

  vec3 permute(vec3 x) {
    return mod(((x * 34.0) + 1.0) * x, 289.0);
  }

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
    i = mod(i, 289.0);
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

  void main() {
    vec2 uv = vUv;

    // Domain warping for the source silk/liquid-metal look.
    vec2 q = vec2(0.0);
    q.x = snoise(uv * 1.5 + vec2(uTime * uTimeScale));
    q.y = snoise(uv * 1.5 + vec2(uTime * (uTimeScale * 1.2)));

    vec2 r = vec2(0.0);
    r.x = snoise(uv * 2.0 + 1.0 * q + vec2(1.7, 9.2) + vec2(uTime * (uTimeScale * 1.5)));
    r.y = snoise(uv * 2.0 + 1.0 * q + vec2(8.3, 2.8) + vec2(uTime * (uTimeScale * 1.3)));

    float f = snoise(uv * 3.0 + r);
    float mixFactor = smoothstep(-1.0, 1.0, f + q.x);
    vec3 col = mix(uColor, uColor2, mixFactor);

    float eps = 0.001;
    float fx = snoise(uv * 3.0 + r + vec2(eps, 0.0)) - f;
    float fy = snoise(uv * 3.0 + r + vec2(0.0, eps)) - f;
    vec3 normal = normalize(vec3(fx * 20.0, fy * 20.0, 1.0));

    vec3 lightPos = vec3(0.5, 0.5, 2.0);
    vec3 lightDir = normalize(lightPos);
    float diff = max(dot(normal, lightDir), 0.0);

    vec3 viewDir = vec3(0.0, 0.0, 1.0);
    vec3 reflectDir = reflect(-lightDir, normal);
    float spec = pow(max(dot(viewDir, reflectDir), 0.0), 64.0);
    float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 4.0);

    col = col * (0.6 + 0.4 * diff);
    col += vec3(1.0) * spec * 0.8;
    col += uColor2 * fresnel * 1.0;
    col = col / (1.0 + col * 0.2);

    gl_FragColor = vec4(col, 1.0);
  }
`

// MassageLab Chrome Flow ships as a Three/R3F shader component. This native
// WebGL port keeps the source uniforms while avoiding that dependency stack.
export default function MassageLabChromeFlowBackground({
  className,
  massageLabChromeFlow,
}: BackgroundEffectProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const speed = massageLabChromeFlow?.speed
  const timeScale = massageLabChromeFlow?.timeScale
  const color = massageLabChromeFlow?.color
  const color2 = massageLabChromeFlow?.color2
  const options = useMemo(
    () => resolveLiquidChromeOptions({
      speed,
      timeScale,
      color,
      color2,
    }),
    [color, color2, speed, timeScale],
  )
  const palette = useMemo(
    () => [
      parseHexColorToRgb(options.color),
      parseHexColorToRgb(options.color2),
    ] as const,
    [options.color, options.color2],
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

    const resources = createLiquidChromeResources(context)

    if (!resources) {
      return undefined
    }

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

      const elapsedSeconds = Math.max(0, (timestamp - startTimestamp) / 1000)
      const time = animate ? (elapsedSeconds % (60 * Math.PI)) * options.speed : 0

      context.viewport(0, 0, canvas.width, canvas.height)
      context.useProgram(resources.program)
      context.uniform1f(resources.uniforms.time, time)
      context.uniform1f(resources.uniforms.timeScale, options.timeScale)
      context.uniform3f(resources.uniforms.color, palette[0][0], palette[0][1], palette[0][2])
      context.uniform3f(resources.uniforms.color2, palette[1][0], palette[1][1], palette[1][2])
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
      const dpr = Math.min(2, Math.max(1, window.devicePixelRatio || 1))
      canvas.width = Math.max(1, Math.floor(width * dpr))
      canvas.height = Math.max(1, Math.floor(height * dpr))
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
      className={cn(styles.effectLayer, styles.massageLabChromeFlow, className)}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className={styles.massageLabChromeFlowCanvas} />
    </div>
  )
}

function createLiquidChromeResources(context: WebGLRenderingContext): LiquidChromeWebGlResources | null {
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
      time: getUniformLocation(context, program, "uTime"),
      timeScale: getUniformLocation(context, program, "uTimeScale"),
      color: getUniformLocation(context, program, "uColor"),
      color2: getUniformLocation(context, program, "uColor2"),
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
    throw new Error(`Missing MassageLab Chrome Flow shader uniform: ${name}`)
  }

  return location
}

function resolveLiquidChromeOptions(options: MassageLabChromeFlowOptions): ResolvedLiquidChromeOptions {
  return {
    speed: clampNumber(options.speed, DEFAULT_MASSAGELAB_LIQUID_CHROME.speed, 0.01, 2),
    timeScale: clampNumber(options.timeScale, DEFAULT_MASSAGELAB_LIQUID_CHROME.timeScale, 0.001, 1),
    color: normalizeHexColor(options.color, DEFAULT_MASSAGELAB_LIQUID_CHROME.color),
    color2: normalizeHexColor(options.color2, DEFAULT_MASSAGELAB_LIQUID_CHROME.color2),
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
