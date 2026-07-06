"use client"

import { useEffect, useMemo, useRef } from "react"
import { shouldAnimateAmbientBackground } from "@/lib/motion-preferences"
import { cn } from "@/lib/utils"
import styles from "@/components/backgrounds/BackgroundHost.module.css"
import type { BackgroundEffectProps, ChamaacWavesOptions } from "./css-backgrounds"

type RgbColor = [number, number, number]

type ResolvedWavesOptions = Required<ChamaacWavesOptions>

type WavesGeometry = {
  positions: Float32Array
  indices: Uint16Array
}

type WavesWebGlResources = {
  program: WebGLProgram
  vertexShader: WebGLShader
  fragmentShader: WebGLShader
  positionBuffer: WebGLBuffer
  indexBuffer: WebGLBuffer
  indexCount: number
  attributes: {
    position: number
  }
  uniforms: {
    time: WebGLUniformLocation
    aspect: WebGLUniformLocation
    color1: WebGLUniformLocation
    color2: WebGLUniformLocation
    color3: WebGLUniformLocation
    speedX: WebGLUniformLocation
    speedY: WebGLUniformLocation
    amplitude: WebGLUniformLocation
    noiseFrequency: WebGLUniformLocation
  }
}

const DEFAULT_CHAMAAC_WAVES: ResolvedWavesOptions = {
  backgroundColor: "#000000",
  waveColor1: "#071697",
  waveColor2: "#00D4FF",
  waveColor3: "#000000",
  waveSpeedX: 0.0125,
  waveSpeedY: 0.005,
  waveAmpX: 32,
}

const WAVES_GRID_SEGMENTS = 128

const noiseGlsl = `
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec4 permute(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v) {
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
      i.z + vec4(0.0, i1.z, i2.z, 1.0))
      + i.y + vec4(0.0, i1.y, i2.y, 1.0))
      + i.x + vec4(0.0, i1.x, i2.x, 1.0)
    );
    vec4 j = p - 49.0 * floor(p * (1.0/49.0));
    vec4 x_ = floor(j * (1.0/7.0));
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * (1.0/7.0) + 0.5/7.0;
    vec4 y = y_ * (1.0/7.0) + 0.5/7.0;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0) * 2.0 + 1.0;
    vec4 s1 = floor(b1) * 2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }
`

const vertexShaderSource = `
  precision mediump float;

  attribute vec2 aPosition;
  uniform float uTime;
  uniform float uAspect;
  uniform float uSpeedX;
  uniform float uSpeedY;
  uniform float uAmp;
  uniform float uNoiseFreq;
  varying float vNoise;
  varying vec2 vUv;

  ${noiseGlsl}

  void main() {
    vUv = aPosition * 0.5 + 0.5;

    float planeScale = 4.7;
    vec2 plane = vec2(aPosition.x * uAspect * planeScale, aPosition.y * planeScale);

    // Source Waves uses directional simplex noise over a tilted R3F plane.
    vec3 noisePos = vec3(plane * uNoiseFreq - vec2(uTime * uSpeedX, 0.0), uTime * uSpeedY);
    float noise = snoise(noisePos);
    vNoise = noise;

    vec3 pos = vec3(plane, noise * uAmp);
    float angle = -0.2;
    float c = cos(angle);
    float s = sin(angle);
    pos = vec3(pos.x, pos.y * c - pos.z * s, pos.y * s + pos.z * c);

    float cameraZ = 4.0;
    vec3 viewPos = vec3(pos.xy, pos.z - cameraZ);
    float projectionScale = 1.3032254;
    float clipX = (viewPos.x * projectionScale / uAspect) / -viewPos.z;
    float clipY = (viewPos.y * projectionScale) / -viewPos.z;

    gl_Position = vec4(clipX, clipY, 0.0, 1.0);
  }
`

const fragmentShaderSource = `
  precision mediump float;

  varying vec2 vUv;
  varying float vNoise;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform vec3 uColor3;

  void main() {
    float n = vNoise * 0.5 + 0.5;
    vec3 color;

    if (n < 0.5) {
      color = mix(uColor3, uColor1, smoothstep(0.0, 0.5, n));
    } else {
      color = mix(uColor1, uColor2, smoothstep(0.6, 1.0, n));
    }

    gl_FragColor = vec4(color, 1.0);
  }
`

// Chamaac UI Waves ships as a Three/R3F/Drei shader plane. MassageLab keeps the
// same shader uniforms and tilted plane behavior in native WebGL.
export default function ChamaacWavesBackground({
  className,
  chamaacWaves,
}: BackgroundEffectProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const backgroundColor = chamaacWaves?.backgroundColor
  const waveColor1 = chamaacWaves?.waveColor1
  const waveColor2 = chamaacWaves?.waveColor2
  const waveColor3 = chamaacWaves?.waveColor3
  const waveSpeedX = chamaacWaves?.waveSpeedX
  const waveSpeedY = chamaacWaves?.waveSpeedY
  const waveAmpX = chamaacWaves?.waveAmpX
  const options = useMemo(
    () => resolveWavesOptions({
      backgroundColor,
      waveColor1,
      waveColor2,
      waveColor3,
      waveSpeedX,
      waveSpeedY,
      waveAmpX,
    }),
    [backgroundColor, waveAmpX, waveColor1, waveColor2, waveColor3, waveSpeedX, waveSpeedY],
  )
  const palette = useMemo(
    () => [
      parseHexColorToRgb(options.backgroundColor),
      parseHexColorToRgb(options.waveColor1),
      parseHexColorToRgb(options.waveColor2),
      parseHexColorToRgb(options.waveColor3),
    ] as const,
    [options.backgroundColor, options.waveColor1, options.waveColor2, options.waveColor3],
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

    const resources = createWavesResources(context)

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
      const time = animate ? elapsedSeconds % (60 * Math.PI) : 0
      const aspect = canvas.width / Math.max(1, canvas.height)

      context.clearColor(palette[0][0], palette[0][1], palette[0][2], 1)
      context.clear(context.COLOR_BUFFER_BIT)
      context.viewport(0, 0, canvas.width, canvas.height)
      context.useProgram(resources.program)
      context.bindBuffer(context.ARRAY_BUFFER, resources.positionBuffer)
      context.vertexAttribPointer(resources.attributes.position, 2, context.FLOAT, false, 0, 0)
      context.bindBuffer(context.ELEMENT_ARRAY_BUFFER, resources.indexBuffer)
      context.uniform1f(resources.uniforms.time, time)
      context.uniform1f(resources.uniforms.aspect, aspect)
      context.uniform3f(resources.uniforms.color1, palette[1][0], palette[1][1], palette[1][2])
      context.uniform3f(resources.uniforms.color2, palette[2][0], palette[2][1], palette[2][2])
      context.uniform3f(resources.uniforms.color3, palette[3][0], palette[3][1], palette[3][2])
      context.uniform1f(resources.uniforms.speedX, options.waveSpeedX * 10.0)
      context.uniform1f(resources.uniforms.speedY, options.waveSpeedY * 10.0)
      context.uniform1f(resources.uniforms.amplitude, (options.waveAmpX / 32.0) * 1.5)
      context.uniform1f(resources.uniforms.noiseFrequency, 0.25)
      context.drawElements(context.TRIANGLES, resources.indexCount, context.UNSIGNED_SHORT, 0)
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
      context.deleteBuffer(resources.indexBuffer)
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
      className={cn(styles.effectLayer, styles.chamaacWaves, className)}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className={styles.chamaacWavesCanvas} />
    </div>
  )
}

function createWavesResources(context: WebGLRenderingContext): WavesWebGlResources | null {
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
  const indexBuffer = context.createBuffer()

  if (!positionBuffer || !indexBuffer) {
    if (positionBuffer) {
      context.deleteBuffer(positionBuffer)
    }
    if (indexBuffer) {
      context.deleteBuffer(indexBuffer)
    }
    context.deleteProgram(program)
    context.deleteShader(vertexShader)
    context.deleteShader(fragmentShader)
    return null
  }

  const position = context.getAttribLocation(program, "aPosition")

  if (position < 0) {
    context.deleteBuffer(positionBuffer)
    context.deleteBuffer(indexBuffer)
    context.deleteProgram(program)
    context.deleteShader(vertexShader)
    context.deleteShader(fragmentShader)
    return null
  }

  const geometry = createWavesGeometry(WAVES_GRID_SEGMENTS)

  context.useProgram(program)
  context.bindBuffer(context.ARRAY_BUFFER, positionBuffer)
  context.bufferData(context.ARRAY_BUFFER, geometry.positions, context.STATIC_DRAW)
  context.enableVertexAttribArray(position)
  context.vertexAttribPointer(position, 2, context.FLOAT, false, 0, 0)
  context.bindBuffer(context.ELEMENT_ARRAY_BUFFER, indexBuffer)
  context.bufferData(context.ELEMENT_ARRAY_BUFFER, geometry.indices, context.STATIC_DRAW)

  return {
    program,
    vertexShader,
    fragmentShader,
    positionBuffer,
    indexBuffer,
    indexCount: geometry.indices.length,
    attributes: {
      position,
    },
    uniforms: {
      time: getUniformLocation(context, program, "uTime"),
      aspect: getUniformLocation(context, program, "uAspect"),
      color1: getUniformLocation(context, program, "uColor1"),
      color2: getUniformLocation(context, program, "uColor2"),
      color3: getUniformLocation(context, program, "uColor3"),
      speedX: getUniformLocation(context, program, "uSpeedX"),
      speedY: getUniformLocation(context, program, "uSpeedY"),
      amplitude: getUniformLocation(context, program, "uAmp"),
      noiseFrequency: getUniformLocation(context, program, "uNoiseFreq"),
    },
  }
}

function createWavesGeometry(segments: number): WavesGeometry {
  const positions: number[] = []
  const indices: number[] = []

  for (let y = 0; y <= segments; y += 1) {
    for (let x = 0; x <= segments; x += 1) {
      positions.push((x / segments) * 2 - 1, (y / segments) * 2 - 1)
    }
  }

  for (let y = 0; y < segments; y += 1) {
    for (let x = 0; x < segments; x += 1) {
      const topLeft = y * (segments + 1) + x
      const topRight = topLeft + 1
      const bottomLeft = topLeft + segments + 1
      const bottomRight = bottomLeft + 1
      indices.push(topLeft, bottomLeft, topRight, topRight, bottomLeft, bottomRight)
    }
  }

  return {
    positions: new Float32Array(positions),
    indices: new Uint16Array(indices),
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
    throw new Error(`Missing Chamaac Waves shader uniform: ${name}`)
  }

  return location
}

function resolveWavesOptions(options: ChamaacWavesOptions): ResolvedWavesOptions {
  return {
    backgroundColor: normalizeHexColor(options.backgroundColor, DEFAULT_CHAMAAC_WAVES.backgroundColor),
    waveColor1: normalizeHexColor(options.waveColor1, DEFAULT_CHAMAAC_WAVES.waveColor1),
    waveColor2: normalizeHexColor(options.waveColor2, DEFAULT_CHAMAAC_WAVES.waveColor2),
    waveColor3: normalizeHexColor(options.waveColor3, DEFAULT_CHAMAAC_WAVES.waveColor3),
    waveSpeedX: clampNumber(options.waveSpeedX, DEFAULT_CHAMAAC_WAVES.waveSpeedX, 0.001, 0.1),
    waveSpeedY: clampNumber(options.waveSpeedY, DEFAULT_CHAMAAC_WAVES.waveSpeedY, 0.001, 0.1),
    waveAmpX: clampNumber(options.waveAmpX, DEFAULT_CHAMAAC_WAVES.waveAmpX, 8, 64),
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
