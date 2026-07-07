"use client"

import { useEffect, useMemo, useRef } from "react"
import { shouldAnimateAmbientBackground } from "@/lib/motion-preferences"
import { cn } from "@/lib/utils"
import styles from "@/components/backgrounds/BackgroundHost.module.css"
import type { BackgroundEffectProps, MassageLabGridBloomOptions } from "./css-backgrounds"

type RgbColor = [number, number, number]

type ResolvedGridBloomOptions = Required<MassageLabGridBloomOptions>

type GridBloomWebGlResources = {
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
    color: WebGLUniformLocation
    speed: WebGLUniformLocation
    gridScale: WebGLUniformLocation
    rotationSpeed: WebGLUniformLocation
    fadeFalloff: WebGLUniformLocation
    distortionAmount: WebGLUniformLocation
    flowSpeedX: WebGLUniformLocation
    flowSpeedY: WebGLUniformLocation
  }
}

const DEFAULT_MASSAGE_LAB_GRID_BLOOM: ResolvedGridBloomOptions = {
  color: "#E040FB",
  speed: 1,
  gridScale: 12,
  rotationSpeed: 0,
  fadeFalloff: 10,
  distortionAmount: 0.05,
  flowSpeedX: -0.2,
  flowSpeedY: -0.4,
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

  uniform float iTime;
  uniform vec2 iResolution;
  uniform vec3 uColor;
  uniform float uSpeed;
  uniform float uGridScale;
  uniform float uRotationSpeed;
  uniform float uFadeFalloff;
  uniform float uDistortionAmount;
  uniform float uFlowSpeedX;
  uniform float uFlowSpeedY;
  varying vec2 vUv;

  vec3 permute(vec3 x) {
    return mod(((x * 34.0) + 10.0) * x, 289.0);
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
    m *= 1.792843 - 0.853735 * (a0 * a0 + h * h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 unrotatedP = (fragCoord.xy - 0.5 * iResolution.xy) / iResolution.y;

    float rot = iTime * uRotationSpeed * 0.3;
    mat2 m = mat2(cos(rot), -sin(rot), sin(rot), cos(rot));
    vec2 p = m * unrotatedP;

    float noiseDist = snoise(p * 1.5 + iTime * uSpeed * 0.15);
    vec2 distortedPos = p + vec2(noiseDist * uDistortionAmount);

    vec2 gridPos = distortedPos * uGridScale;
    gridPos.x += iTime * uSpeed * uFlowSpeedX;
    gridPos.y += iTime * uSpeed * uFlowSpeedY;

    vec2 cell = fract(gridPos);
    vec2 cellCenter = abs(cell - 0.5);

    float lineWidth = 0.015;
    float smoothEdge = 0.03;
    vec2 lines = smoothstep(0.5 - lineWidth - smoothEdge, 0.5 - lineWidth, cellCenter);
    float gridAlpha = max(lines.x, lines.y);

    float intersections = lines.x * lines.y;
    float glowMask = snoise(floor(gridPos) * 0.4 + iTime * uSpeed * 0.4);
    float glow = smoothstep(0.2, 0.5, cellCenter.x) * smoothstep(0.2, 0.5, cellCenter.y);
    glow *= smoothstep(0.3, 0.8, glowMask);

    float pulseDist = length(p);
    float pulse = 0.5 + 0.5 * sin(pulseDist * 8.0 - iTime * uSpeed * 1.5 + noiseDist * 2.0);

    float finalAlpha = (gridAlpha * 0.3) + (intersections * 0.8) + (glow * 0.6);
    finalAlpha *= (0.6 + 0.4 * snoise(p * 4.0 - iTime * uSpeed * 0.5));
    finalAlpha += finalAlpha * pulse * 0.4;

    float vignette = 1.0 - smoothstep(0.1, uFadeFalloff, pulseDist);
    float breathing = 0.8 + 0.2 * sin(iTime * uSpeed * 0.8);

    fragColor = vec4(uColor, clamp(finalAlpha * vignette * breathing, 0.0, 1.0));
  }

  void main() {
    mainImage(gl_FragColor, vUv * iResolution);
  }
`

// MassageLab Grid Bloom ships as a Three/R3F shader. MassageLab keeps the
// source's passive shader uniforms in a native WebGL background layer.
export default function MassageLabGridBloomBackground({
  className,
  massageLabGridBloom,
}: BackgroundEffectProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const color = massageLabGridBloom?.color
  const speed = massageLabGridBloom?.speed
  const gridScale = massageLabGridBloom?.gridScale
  const rotationSpeed = massageLabGridBloom?.rotationSpeed
  const fadeFalloff = massageLabGridBloom?.fadeFalloff
  const distortionAmount = massageLabGridBloom?.distortionAmount
  const flowSpeedX = massageLabGridBloom?.flowSpeedX
  const flowSpeedY = massageLabGridBloom?.flowSpeedY
  const options = useMemo(
    () => resolveGridBloomOptions({
      color,
      speed,
      gridScale,
      rotationSpeed,
      fadeFalloff,
      distortionAmount,
      flowSpeedX,
      flowSpeedY,
    }),
    [
      color,
      distortionAmount,
      fadeFalloff,
      flowSpeedX,
      flowSpeedY,
      gridScale,
      rotationSpeed,
      speed,
    ],
  )
  const resolvedColor = useMemo(() => parseHexColorToRgb(options.color), [options.color])

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

    const resources = createGridBloomResources(context)

    if (!resources) {
      return undefined
    }

    context.enable(context.BLEND)
    context.blendFunc(context.SRC_ALPHA, context.ONE)

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
      const time = animate ? elapsedSeconds % (60 * Math.PI) : 0

      context.clearColor(0, 0, 0, 0)
      context.clear(context.COLOR_BUFFER_BIT)
      context.viewport(0, 0, canvas.width, canvas.height)
      context.useProgram(resources.program)
      context.uniform1f(resources.uniforms.time, time)
      context.uniform2f(resources.uniforms.resolution, canvas.width, canvas.height)
      context.uniform3f(resources.uniforms.color, resolvedColor[0], resolvedColor[1], resolvedColor[2])
      context.uniform1f(resources.uniforms.speed, options.speed)
      context.uniform1f(resources.uniforms.gridScale, options.gridScale)
      context.uniform1f(resources.uniforms.rotationSpeed, options.rotationSpeed)
      context.uniform1f(resources.uniforms.fadeFalloff, options.fadeFalloff)
      context.uniform1f(resources.uniforms.distortionAmount, options.distortionAmount)
      context.uniform1f(resources.uniforms.flowSpeedX, options.flowSpeedX)
      context.uniform1f(resources.uniforms.flowSpeedY, options.flowSpeedY)
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
  }, [options, resolvedColor])

  return (
    <div
      ref={containerRef}
      className={cn(styles.effectLayer, styles.massageLabGridBloom, className)}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className={styles.massageLabGridBloomCanvas} />
    </div>
  )
}

function createGridBloomResources(context: WebGLRenderingContext): GridBloomWebGlResources | null {
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
      time: getUniformLocation(context, program, "iTime"),
      resolution: getUniformLocation(context, program, "iResolution"),
      color: getUniformLocation(context, program, "uColor"),
      speed: getUniformLocation(context, program, "uSpeed"),
      gridScale: getUniformLocation(context, program, "uGridScale"),
      rotationSpeed: getUniformLocation(context, program, "uRotationSpeed"),
      fadeFalloff: getUniformLocation(context, program, "uFadeFalloff"),
      distortionAmount: getUniformLocation(context, program, "uDistortionAmount"),
      flowSpeedX: getUniformLocation(context, program, "uFlowSpeedX"),
      flowSpeedY: getUniformLocation(context, program, "uFlowSpeedY"),
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
    throw new Error(`Missing MassageLab Grid Bloom shader uniform: ${name}`)
  }

  return location
}

function resolveGridBloomOptions(options: MassageLabGridBloomOptions): ResolvedGridBloomOptions {
  return {
    color: normalizeHexColor(options.color, DEFAULT_MASSAGE_LAB_GRID_BLOOM.color),
    speed: clampNumber(options.speed, DEFAULT_MASSAGE_LAB_GRID_BLOOM.speed, 0.1, 3),
    gridScale: clampNumber(options.gridScale, DEFAULT_MASSAGE_LAB_GRID_BLOOM.gridScale, 4, 32),
    rotationSpeed: clampNumber(options.rotationSpeed, DEFAULT_MASSAGE_LAB_GRID_BLOOM.rotationSpeed, -3, 3),
    fadeFalloff: clampNumber(options.fadeFalloff, DEFAULT_MASSAGE_LAB_GRID_BLOOM.fadeFalloff, 1, 24),
    distortionAmount: clampNumber(options.distortionAmount, DEFAULT_MASSAGE_LAB_GRID_BLOOM.distortionAmount, 0, 0.5),
    flowSpeedX: clampNumber(options.flowSpeedX, DEFAULT_MASSAGE_LAB_GRID_BLOOM.flowSpeedX, -2, 2),
    flowSpeedY: clampNumber(options.flowSpeedY, DEFAULT_MASSAGE_LAB_GRID_BLOOM.flowSpeedY, -2, 2),
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
