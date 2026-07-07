"use client"

import { useEffect, useMemo, useRef } from "react"
import { shouldAnimateAmbientBackground } from "@/lib/motion-preferences"
import { cn } from "@/lib/utils"
import styles from "@/components/backgrounds/BackgroundHost.module.css"
import type { BackgroundEffectProps, MassageLabSoftAuroraOptions } from "./css-backgrounds"

type RgbColor = [number, number, number]
type ResolvedSoftAuroraOptions = Required<MassageLabSoftAuroraOptions>

type SoftAuroraResources = {
  program: WebGLProgram
  vertexShader: WebGLShader
  fragmentShader: WebGLShader
  positionBuffer: WebGLBuffer
  attributes: { position: number }
  uniforms: {
    time: WebGLUniformLocation
    resolution: WebGLUniformLocation
    speed: WebGLUniformLocation
    scale: WebGLUniformLocation
    brightness: WebGLUniformLocation
    colorOne: WebGLUniformLocation
    colorTwo: WebGLUniformLocation
    noiseFrequency: WebGLUniformLocation
    noiseAmplitude: WebGLUniformLocation
    bandHeight: WebGLUniformLocation
    bandSpread: WebGLUniformLocation
    octaveDecay: WebGLUniformLocation
    layerOffset: WebGLUniformLocation
    colorSpeed: WebGLUniformLocation
    mouse: WebGLUniformLocation
    mouseInfluence: WebGLUniformLocation
    enableMouse: WebGLUniformLocation
  }
}

const DEFAULT_MASSAGELAB_SOFT_AURORA: ResolvedSoftAuroraOptions = {
  speed: 0.6,
  scale: 1.5,
  brightness: 1,
  color1: "#F7F7F7",
  color2: "#E100FF",
  noiseFrequency: 2.5,
  noiseAmplitude: 1,
  bandHeight: 0.5,
  bandSpread: 1,
  octaveDecay: 0.1,
  layerOffset: 0,
  colorSpeed: 1,
  enableMouseInteraction: false,
  mouseInfluence: 0.25,
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
  uniform float uSpeed;
  uniform float uScale;
  uniform float uBrightness;
  uniform vec3 uColor1;
  uniform vec3 uColor2;
  uniform float uNoiseFreq;
  uniform float uNoiseAmp;
  uniform float uBandHeight;
  uniform float uBandSpread;
  uniform float uOctaveDecay;
  uniform float uLayerOffset;
  uniform float uColorSpeed;
  uniform vec2 uMouse;
  uniform float uMouseInfluence;
  uniform bool uEnableMouse;

  #define TAU 6.28318

  vec3 gradientHash(vec3 p) {
    p = vec3(
      dot(p, vec3(127.1, 311.7, 234.6)),
      dot(p, vec3(269.5, 183.3, 198.3)),
      dot(p, vec3(169.5, 283.3, 156.9))
    );
    vec3 h = fract(sin(p) * 43758.5453123);
    float phi = acos(2.0 * h.x - 1.0);
    float theta = TAU * h.y;
    return vec3(cos(theta) * sin(phi), sin(theta) * cos(phi), cos(phi));
  }

  float quinticSmooth(float t) {
    float t2 = t * t;
    float t3 = t * t2;
    return 6.0 * t3 * t2 - 15.0 * t2 * t2 + 10.0 * t3;
  }

  vec3 cosineGradient(float t, vec3 a, vec3 b, vec3 c, vec3 d) {
    return a + b * cos(TAU * (c * t + d));
  }

  float perlin3D(float amplitude, float frequency, float px, float py, float pz) {
    float x = px * frequency;
    float y = py * frequency;

    float fx = floor(x); float fy = floor(y); float fz = floor(pz);
    float cx = ceil(x);  float cy = ceil(y);  float cz = ceil(pz);

    vec3 g000 = gradientHash(vec3(fx, fy, fz));
    vec3 g100 = gradientHash(vec3(cx, fy, fz));
    vec3 g010 = gradientHash(vec3(fx, cy, fz));
    vec3 g110 = gradientHash(vec3(cx, cy, fz));
    vec3 g001 = gradientHash(vec3(fx, fy, cz));
    vec3 g101 = gradientHash(vec3(cx, fy, cz));
    vec3 g011 = gradientHash(vec3(fx, cy, cz));
    vec3 g111 = gradientHash(vec3(cx, cy, cz));

    float d000 = dot(g000, vec3(x - fx, y - fy, pz - fz));
    float d100 = dot(g100, vec3(x - cx, y - fy, pz - fz));
    float d010 = dot(g010, vec3(x - fx, y - cy, pz - fz));
    float d110 = dot(g110, vec3(x - cx, y - cy, pz - fz));
    float d001 = dot(g001, vec3(x - fx, y - fy, pz - cz));
    float d101 = dot(g101, vec3(x - cx, y - fy, pz - cz));
    float d011 = dot(g011, vec3(x - fx, y - cy, pz - cz));
    float d111 = dot(g111, vec3(x - cx, y - cy, pz - cz));

    float sx = quinticSmooth(x - fx);
    float sy = quinticSmooth(y - fy);
    float sz = quinticSmooth(pz - fz);

    float lx00 = mix(d000, d100, sx);
    float lx10 = mix(d010, d110, sx);
    float lx01 = mix(d001, d101, sx);
    float lx11 = mix(d011, d111, sx);

    float ly0 = mix(lx00, lx10, sy);
    float ly1 = mix(lx01, lx11, sy);

    return amplitude * mix(ly0, ly1, sz);
  }

  float auroraGlow(float t, vec2 shift) {
    vec2 uv = gl_FragCoord.xy / uResolution.y;
    uv += shift;

    float noiseVal = 0.0;
    float freq = uNoiseFreq;
    float amp = uNoiseAmp;
    vec2 samplePos = uv * uScale;

    for (float i = 0.0; i < 3.0; i += 1.0) {
      noiseVal += perlin3D(amp, freq, samplePos.x, samplePos.y, t);
      amp *= uOctaveDecay;
      freq *= 2.0;
    }

    float yBand = uv.y * 10.0 - uBandHeight * 10.0;
    return 0.3 * max(exp(uBandSpread * (1.0 - 1.1 * abs(noiseVal + yBand))), 0.0);
  }

  void main() {
    vec2 uv = gl_FragCoord.xy / uResolution.xy;
    float t = uSpeed * 0.4 * uTime;

    vec2 shift = vec2(0.0);
    if (uEnableMouse) {
      shift = (uMouse - 0.5) * uMouseInfluence;
    }

    vec3 col = vec3(0.0);
    col += 0.99 * auroraGlow(t, shift)
      * cosineGradient(uv.x + uTime * uSpeed * 0.2 * uColorSpeed, vec3(0.5), vec3(0.5), vec3(1.0), vec3(0.3, 0.20, 0.20))
      * uColor1;
    col += 0.99 * auroraGlow(t + uLayerOffset, shift)
      * cosineGradient(uv.x + uTime * uSpeed * 0.1 * uColorSpeed, vec3(0.5), vec3(0.5), vec3(2.0, 1.0, 0.0), vec3(0.5, 0.20, 0.25))
      * uColor2;

    col *= uBrightness;
    float alpha = clamp(length(col), 0.0, 1.0);
    gl_FragColor = vec4(col, alpha);
  }
`

// MassageLab Soft Aurora ships as an OGL full-screen shader. MassageLab keeps
// the source Perlin band math and optional mouse shift while avoiding OGL.
export default function MassageLabSoftAuroraBackground({
  className,
  massageLabSoftAurora,
}: BackgroundEffectProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const options = useMemo(
    () => resolveSoftAuroraOptions(massageLabSoftAurora),
    [massageLabSoftAurora],
  )
  const colorOne = useMemo(() => parseHexColorToRgb(options.color1), [options.color1])
  const colorTwo = useMemo(() => parseHexColorToRgb(options.color2), [options.color2])

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

    const resources = createSoftAuroraResources(context)

    if (!resources) {
      return undefined
    }

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const compactViewportQuery = window.matchMedia("(max-width: 480px)")
    let animationFrame = 0
    let resizeRetryFrame = 0
    let shouldRun = false
    let mouseCurrent = { x: 0.5, y: 0.5 }
    let mouseTarget = { x: 0.5, y: 0.5 }

    const resizeCanvas = () => {
      const bounds = container.getBoundingClientRect()
      const width = Math.max(1, Math.floor(bounds.width))
      const height = Math.max(1, Math.floor(bounds.height))

      if (width <= 1 || height <= 1) {
        return false
      }

      const dpr = Math.min(2, window.devicePixelRatio || 1)
      const pixelWidth = Math.max(1, Math.floor(width * dpr))
      const pixelHeight = Math.max(1, Math.floor(height * dpr))

      if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
        canvas.width = pixelWidth
        canvas.height = pixelHeight
      }

      context.viewport(0, 0, pixelWidth, pixelHeight)
      context.uniform3f(resources.uniforms.resolution, pixelWidth, pixelHeight, pixelWidth / pixelHeight)
      return true
    }

    const requestResizeRetry = () => {
      if (resizeRetryFrame) {
        return
      }

      resizeRetryFrame = window.requestAnimationFrame(() => {
        resizeRetryFrame = 0
        if (resizeCanvas()) {
          drawFrame(performance.now(), false)
        }
      })
    }

    const bindStaticUniforms = () => {
      context.useProgram(resources.program)
      context.bindBuffer(context.ARRAY_BUFFER, resources.positionBuffer)
      context.enableVertexAttribArray(resources.attributes.position)
      context.vertexAttribPointer(resources.attributes.position, 2, context.FLOAT, false, 0, 0)
      context.uniform1f(resources.uniforms.speed, options.speed)
      context.uniform1f(resources.uniforms.scale, options.scale)
      context.uniform1f(resources.uniforms.brightness, options.brightness)
      context.uniform3f(resources.uniforms.colorOne, colorOne[0], colorOne[1], colorOne[2])
      context.uniform3f(resources.uniforms.colorTwo, colorTwo[0], colorTwo[1], colorTwo[2])
      context.uniform1f(resources.uniforms.noiseFrequency, options.noiseFrequency)
      context.uniform1f(resources.uniforms.noiseAmplitude, options.noiseAmplitude)
      context.uniform1f(resources.uniforms.bandHeight, options.bandHeight)
      context.uniform1f(resources.uniforms.bandSpread, options.bandSpread)
      context.uniform1f(resources.uniforms.octaveDecay, options.octaveDecay)
      context.uniform1f(resources.uniforms.layerOffset, options.layerOffset)
      context.uniform1f(resources.uniforms.colorSpeed, options.colorSpeed)
      context.uniform1f(resources.uniforms.mouseInfluence, options.mouseInfluence)
      context.uniform1i(resources.uniforms.enableMouse, options.enableMouseInteraction ? 1 : 0)
      context.clearColor(0, 0, 0, 0)
    }

    const drawFrame = (time: number, smoothMouse: boolean) => {
      context.clear(context.COLOR_BUFFER_BIT)
      context.uniform1f(resources.uniforms.time, time * 0.001)

      if (options.enableMouseInteraction && smoothMouse) {
        mouseCurrent = {
          x: mouseCurrent.x + (mouseTarget.x - mouseCurrent.x) * 0.05,
          y: mouseCurrent.y + (mouseTarget.y - mouseCurrent.y) * 0.05,
        }
      } else if (!options.enableMouseInteraction) {
        mouseCurrent = { x: 0.5, y: 0.5 }
      }

      context.uniform2f(resources.uniforms.mouse, mouseCurrent.x, mouseCurrent.y)
      context.drawArrays(context.TRIANGLES, 0, 3)
    }

    const draw = (time: number) => {
      if (!shouldRun) {
        return
      }

      drawFrame(time, true)
      animationFrame = window.requestAnimationFrame(draw)
    }

    const stopAnimation = () => {
      shouldRun = false
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame)
        animationFrame = 0
      }
    }

    const startAnimation = () => {
      const bounds = container.getBoundingClientRect()
      const animate = shouldAnimateAmbientBackground({
        prefersReducedMotion: reducedMotionQuery.matches,
        compactViewport: Math.min(bounds.width, bounds.height) < 360 || compactViewportQuery.matches,
        allowCompactViewport: true,
        documentHidden: document.hidden,
      })

      if (!resizeCanvas()) {
        requestResizeRetry()
      }

      if (!animate) {
        stopAnimation()
        drawFrame(performance.now(), false)
        return
      }

      if (!shouldRun) {
        shouldRun = true
        animationFrame = window.requestAnimationFrame(draw)
      }
    }

    const handlePointerMove = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect()
      if (bounds.width <= 0 || bounds.height <= 0) {
        return
      }

      mouseTarget = {
        x: (event.clientX - bounds.left) / bounds.width,
        y: 1 - (event.clientY - bounds.top) / bounds.height,
      }
    }

    const handlePointerLeave = () => {
      mouseTarget = { x: 0.5, y: 0.5 }
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopAnimation()
        return
      }

      startAnimation()
    }
    const handleMotionChange = () => startAnimation()
    const resizeObserver = new ResizeObserver(() => {
      if (!resizeCanvas()) {
        requestResizeRetry()
      }
    })

    bindStaticUniforms()
    resizeObserver.observe(container)
    window.addEventListener("resize", startAnimation)
    document.addEventListener("visibilitychange", handleVisibilityChange)
    reducedMotionQuery.addEventListener("change", handleMotionChange)
    compactViewportQuery.addEventListener("change", handleMotionChange)
    if (options.enableMouseInteraction) {
      window.addEventListener("pointermove", handlePointerMove)
      window.addEventListener("pointerleave", handlePointerLeave)
    }
    startAnimation()

    return () => {
      stopAnimation()
      if (resizeRetryFrame) {
        window.cancelAnimationFrame(resizeRetryFrame)
      }
      resizeObserver.disconnect()
      window.removeEventListener("resize", startAnimation)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      reducedMotionQuery.removeEventListener("change", handleMotionChange)
      compactViewportQuery.removeEventListener("change", handleMotionChange)
      if (options.enableMouseInteraction) {
        window.removeEventListener("pointermove", handlePointerMove)
        window.removeEventListener("pointerleave", handlePointerLeave)
      }
      context.deleteBuffer(resources.positionBuffer)
      context.deleteProgram(resources.program)
      context.deleteShader(resources.vertexShader)
      context.deleteShader(resources.fragmentShader)
    }
  }, [colorOne, colorTwo, options])

  return (
    <div className={cn(styles.effectLayer, styles.massageLabSoftAurora, className)} ref={containerRef}>
      <canvas className={styles.massageLabSoftAuroraCanvas} ref={canvasRef} />
    </div>
  )
}

function createSoftAuroraResources(context: WebGLRenderingContext): SoftAuroraResources | null {
  const vertexShader = compileShader(context, context.VERTEX_SHADER, vertexShaderSource)
  const fragmentShader = compileShader(context, context.FRAGMENT_SHADER, fragmentShaderSource)

  if (!vertexShader || !fragmentShader) {
    if (vertexShader) context.deleteShader(vertexShader)
    if (fragmentShader) context.deleteShader(fragmentShader)
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

  context.bindBuffer(context.ARRAY_BUFFER, positionBuffer)
  context.bufferData(context.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), context.STATIC_DRAW)

  return {
    program,
    vertexShader,
    fragmentShader,
    positionBuffer,
    attributes: {
      position: context.getAttribLocation(program, "aPosition"),
    },
    uniforms: {
      time: getUniformLocation(context, program, "uTime"),
      resolution: getUniformLocation(context, program, "uResolution"),
      speed: getUniformLocation(context, program, "uSpeed"),
      scale: getUniformLocation(context, program, "uScale"),
      brightness: getUniformLocation(context, program, "uBrightness"),
      colorOne: getUniformLocation(context, program, "uColor1"),
      colorTwo: getUniformLocation(context, program, "uColor2"),
      noiseFrequency: getUniformLocation(context, program, "uNoiseFreq"),
      noiseAmplitude: getUniformLocation(context, program, "uNoiseAmp"),
      bandHeight: getUniformLocation(context, program, "uBandHeight"),
      bandSpread: getUniformLocation(context, program, "uBandSpread"),
      octaveDecay: getUniformLocation(context, program, "uOctaveDecay"),
      layerOffset: getUniformLocation(context, program, "uLayerOffset"),
      colorSpeed: getUniformLocation(context, program, "uColorSpeed"),
      mouse: getUniformLocation(context, program, "uMouse"),
      mouseInfluence: getUniformLocation(context, program, "uMouseInfluence"),
      enableMouse: getUniformLocation(context, program, "uEnableMouse"),
    },
  }
}

function compileShader(context: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
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

function getUniformLocation(
  context: WebGLRenderingContext,
  program: WebGLProgram,
  name: string,
): WebGLUniformLocation {
  const location = context.getUniformLocation(program, name)

  if (!location) {
    throw new Error(`Missing MassageLab Soft Aurora uniform: ${name}`)
  }

  return location
}

function resolveSoftAuroraOptions(options?: MassageLabSoftAuroraOptions): ResolvedSoftAuroraOptions {
  return {
    speed: clampNumber(options?.speed, DEFAULT_MASSAGELAB_SOFT_AURORA.speed, 0, 3),
    scale: clampNumber(options?.scale, DEFAULT_MASSAGELAB_SOFT_AURORA.scale, 0.1, 4),
    brightness: clampNumber(options?.brightness, DEFAULT_MASSAGELAB_SOFT_AURORA.brightness, 0, 3),
    color1: normalizeHexColor(options?.color1, DEFAULT_MASSAGELAB_SOFT_AURORA.color1),
    color2: normalizeHexColor(options?.color2, DEFAULT_MASSAGELAB_SOFT_AURORA.color2),
    noiseFrequency: clampNumber(
      options?.noiseFrequency,
      DEFAULT_MASSAGELAB_SOFT_AURORA.noiseFrequency,
      0.1,
      8,
    ),
    noiseAmplitude: clampNumber(
      options?.noiseAmplitude,
      DEFAULT_MASSAGELAB_SOFT_AURORA.noiseAmplitude,
      0,
      4,
    ),
    bandHeight: clampNumber(options?.bandHeight, DEFAULT_MASSAGELAB_SOFT_AURORA.bandHeight, -1, 2),
    bandSpread: clampNumber(options?.bandSpread, DEFAULT_MASSAGELAB_SOFT_AURORA.bandSpread, 0.1, 4),
    octaveDecay: clampNumber(options?.octaveDecay, DEFAULT_MASSAGELAB_SOFT_AURORA.octaveDecay, 0, 1),
    layerOffset: clampNumber(options?.layerOffset, DEFAULT_MASSAGELAB_SOFT_AURORA.layerOffset, -6, 6),
    colorSpeed: clampNumber(options?.colorSpeed, DEFAULT_MASSAGELAB_SOFT_AURORA.colorSpeed, 0, 4),
    enableMouseInteraction: typeof options?.enableMouseInteraction === "boolean"
      ? options.enableMouseInteraction
      : DEFAULT_MASSAGELAB_SOFT_AURORA.enableMouseInteraction,
    mouseInfluence: clampNumber(
      options?.mouseInfluence,
      DEFAULT_MASSAGELAB_SOFT_AURORA.mouseInfluence,
      0,
      1,
    ),
  }
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback
  }

  return Math.min(max, Math.max(min, value))
}

function normalizeHexColor(value: unknown, fallback: string): string {
  if (typeof value !== "string" || !/^#[0-9a-fA-F]{6}$/.test(value)) {
    return fallback
  }

  return value.toUpperCase()
}

function parseHexColorToRgb(hex: string): RgbColor {
  const normalized = normalizeHexColor(hex, "#FFFFFF").slice(1)
  const red = Number.parseInt(normalized.slice(0, 2), 16) / 255
  const green = Number.parseInt(normalized.slice(2, 4), 16) / 255
  const blue = Number.parseInt(normalized.slice(4, 6), 16) / 255

  return [red, green, blue]
}
