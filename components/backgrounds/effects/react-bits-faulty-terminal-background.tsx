"use client"

import { useEffect, useMemo, useRef } from "react"
import { shouldAnimateAmbientBackground } from "@/lib/motion-preferences"
import { cn } from "@/lib/utils"
import styles from "@/components/backgrounds/BackgroundHost.module.css"
import type { BackgroundEffectProps, ReactBitsFaultyTerminalOptions } from "./css-backgrounds"

type ResolvedFaultyTerminalOptions = Required<ReactBitsFaultyTerminalOptions>

type FaultyTerminalResources = {
  program: WebGLProgram
  vertexShader: WebGLShader
  fragmentShader: WebGLShader
  vertexBuffer: WebGLBuffer
  attributePosition: number
  attributeUv: number
  uniforms: {
    time: WebGLUniformLocation
    resolution: WebGLUniformLocation
    scale: WebGLUniformLocation
    gridMul: WebGLUniformLocation
    digitSize: WebGLUniformLocation
    scanlineIntensity: WebGLUniformLocation
    glitchAmount: WebGLUniformLocation
    flickerAmount: WebGLUniformLocation
    noiseAmp: WebGLUniformLocation
    chromaticAberration: WebGLUniformLocation
    dither: WebGLUniformLocation
    curvature: WebGLUniformLocation
    tint: WebGLUniformLocation
    mouse: WebGLUniformLocation
    mouseStrength: WebGLUniformLocation
    useMouse: WebGLUniformLocation
    pageLoadProgress: WebGLUniformLocation
    usePageLoadAnimation: WebGLUniformLocation
    brightness: WebGLUniformLocation
  }
}

const DEFAULT_REACT_BITS_FAULTY_TERMINAL: ResolvedFaultyTerminalOptions = {
  scale: 1,
  gridMulX: 2,
  gridMulY: 1,
  digitSize: 1.5,
  timeScale: 0.3,
  scanlineIntensity: 0.3,
  glitchAmount: 1,
  flickerAmount: 1,
  noiseAmp: 0,
  chromaticAberration: 0,
  dither: 0,
  curvature: 0.2,
  tint: "#FFFFFF",
  mouseReact: true,
  mouseStrength: 0.2,
  pageLoadAnimation: true,
  brightness: 1,
}

const vertexShaderSource = `
attribute vec2 position;
attribute vec2 uv;
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`

const fragmentShaderSource = `
precision mediump float;

varying vec2 vUv;

uniform float iTime;
uniform vec3  iResolution;
uniform float uScale;

uniform vec2  uGridMul;
uniform float uDigitSize;
uniform float uScanlineIntensity;
uniform float uGlitchAmount;
uniform float uFlickerAmount;
uniform float uNoiseAmp;
uniform float uChromaticAberration;
uniform float uDither;
uniform float uCurvature;
uniform vec3  uTint;
uniform vec2  uMouse;
uniform float uMouseStrength;
uniform float uUseMouse;
uniform float uPageLoadProgress;
uniform float uUsePageLoadAnimation;
uniform float uBrightness;

float time;

float hash21(vec2 p){
  p = fract(p * 234.56);
  p += dot(p, p + 34.56);
  return fract(p.x * p.y);
}

float noise(vec2 p)
{
  return sin(p.x * 10.0) * sin(p.y * (3.0 + sin(time * 0.090909))) + 0.2;
}

mat2 rotate(float angle)
{
  float c = cos(angle);
  float s = sin(angle);
  return mat2(c, -s, s, c);
}

float fbm(vec2 p)
{
  p *= 1.1;
  float f = 0.0;
  float amp = 0.5 * uNoiseAmp;

  mat2 modify0 = rotate(time * 0.02);
  f += amp * noise(p);
  p = modify0 * p * 2.0;
  amp *= 0.454545;

  mat2 modify1 = rotate(time * 0.02);
  f += amp * noise(p);
  p = modify1 * p * 2.0;
  amp *= 0.454545;

  mat2 modify2 = rotate(time * 0.08);
  f += amp * noise(p);

  return f;
}

float pattern(vec2 p, out vec2 q, out vec2 r) {
  vec2 offset1 = vec2(1.0);
  vec2 offset0 = vec2(0.0);
  mat2 rot01 = rotate(0.1 * time);
  mat2 rot1 = rotate(0.1);

  q = vec2(fbm(p + offset1), fbm(rot01 * p + offset1));
  r = vec2(fbm(rot1 * q + offset0), fbm(q + offset0));
  return fbm(p + r);
}

float digit(vec2 p){
    vec2 grid = uGridMul * 15.0;
    vec2 s = floor(p * grid) / grid;
    p = p * grid;
    vec2 q, r;
    float intensity = pattern(s * 0.1, q, r) * 1.3 - 0.03;

    if(uUseMouse > 0.5){
        vec2 mouseWorld = uMouse * uScale;
        float distToMouse = distance(s, mouseWorld);
        float mouseInfluence = exp(-distToMouse * 8.0) * uMouseStrength * 10.0;
        intensity += mouseInfluence;

        float ripple = sin(distToMouse * 20.0 - iTime * 5.0) * 0.1 * mouseInfluence;
        intensity += ripple;
    }

    if(uUsePageLoadAnimation > 0.5){
        float cellRandom = fract(sin(dot(s, vec2(12.9898, 78.233))) * 43758.5453);
        float cellDelay = cellRandom * 0.8;
        float cellProgress = clamp((uPageLoadProgress - cellDelay) / 0.2, 0.0, 1.0);

        float fadeAlpha = smoothstep(0.0, 1.0, cellProgress);
        intensity *= fadeAlpha;
    }

    p = fract(p);
    p *= uDigitSize;

    float px5 = p.x * 5.0;
    float py5 = (1.0 - p.y) * 5.0;
    float x = fract(px5);
    float y = fract(py5);

    float i = floor(py5) - 2.0;
    float j = floor(px5) - 2.0;
    float n = i * i + j * j;
    float f = n * 0.0625;

    float isOn = step(0.1, intensity - f);
    float brightness = isOn * (0.2 + y * 0.8) * (0.75 + x * 0.25);

    return step(0.0, p.x) * step(p.x, 1.0) * step(0.0, p.y) * step(p.y, 1.0) * brightness;
}

float onOff(float a, float b, float c)
{
  return step(c, sin(iTime + a * cos(iTime * b))) * uFlickerAmount;
}

float displace(vec2 look)
{
    float y = look.y - mod(iTime * 0.25, 1.0);
    float window = 1.0 / (1.0 + 50.0 * y * y);
    return sin(look.y * 20.0 + iTime) * 0.0125 * onOff(4.0, 2.0, 0.8) * (1.0 + cos(iTime * 60.0)) * window;
}

vec3 getColor(vec2 p){

    float bar = step(mod(p.y + time * 20.0, 1.0), 0.2) * 0.4 + 1.0;
    bar *= uScanlineIntensity;

    float displacement = displace(p);
    p.x += displacement;

    if (uGlitchAmount != 1.0) {
      float extra = displacement * (uGlitchAmount - 1.0);
      p.x += extra;
    }

    float middle = digit(p);

    const float off = 0.002;
    float sum = digit(p + vec2(-off, -off)) + digit(p + vec2(0.0, -off)) + digit(p + vec2(off, -off)) +
                digit(p + vec2(-off, 0.0)) + digit(p + vec2(0.0, 0.0)) + digit(p + vec2(off, 0.0)) +
                digit(p + vec2(-off, off)) + digit(p + vec2(0.0, off)) + digit(p + vec2(off, off));

    vec3 baseColor = vec3(0.9) * middle + sum * 0.1 * vec3(1.0) * bar;
    return baseColor;
}

vec2 barrel(vec2 uv){
  vec2 c = uv * 2.0 - 1.0;
  float r2 = dot(c, c);
  c *= 1.0 + uCurvature * r2;
  return c * 0.5 + 0.5;
}

void main() {
    time = iTime * 0.333333;
    vec2 uv = vUv;

    if(uCurvature != 0.0){
      uv = barrel(uv);
    }

    vec2 p = uv * uScale;
    vec3 col = getColor(p);

    if(uChromaticAberration != 0.0){
      vec2 ca = vec2(uChromaticAberration) / iResolution.xy;
      col.r = getColor(p + ca).r;
      col.b = getColor(p - ca).b;
    }

    col *= uTint;
    col *= uBrightness;

    if(uDither > 0.0){
      float rnd = hash21(gl_FragCoord.xy);
      col += (rnd - 0.5) * (uDither * 0.003922);
    }

    gl_FragColor = vec4(col, 1.0);
}
`

// React Bits Faulty Terminal is an OGL terminal shader. MassageLab keeps the
// source uniform model while owning the raw WebGL sizing, motion, and cleanup.
export default function ReactBitsFaultyTerminalBackground({
  className,
  reactBitsFaultyTerminal,
}: BackgroundEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const targetMouseRef = useRef<[number, number]>([0.5, 0.5])
  const smoothMouseRef = useRef<[number, number]>([0.5, 0.5])
  const timeOffsetRef = useRef(Math.random() * 100)
  const options = useMemo(
    () => resolveFaultyTerminalOptions(reactBitsFaultyTerminal),
    [reactBitsFaultyTerminal],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    const gl = canvas?.getContext("webgl", {
      alpha: false,
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

    const resources = createFaultyTerminalResources(gl)
    if (!resources) {
      return undefined
    }

    gl.clearColor(0, 0, 0, 1)
    gl.disable(gl.DEPTH_TEST)
    gl.disable(gl.CULL_FACE)
    gl.disable(gl.BLEND)

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const compactViewportQuery = window.matchMedia("(max-width: 360px), (max-height: 360px)")
    let frame = 0
    let disposed = false
    let width = 1
    let height = 1
    let loadStart = 0
    let frozenTime = 0

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
      if (loadStart === 0) {
        loadStart = timestamp
      }

      if (animate) {
        frozenTime = (timestamp * 0.001 + timeOffsetRef.current) * options.timeScale
      }

      if (options.mouseReact) {
        const smooth = smoothMouseRef.current
        const target = targetMouseRef.current
        smooth[0] += (target[0] - smooth[0]) * 0.08
        smooth[1] += (target[1] - smooth[1]) * 0.08
      }

      const pageLoadProgress = options.pageLoadAnimation && animate
        ? Math.min((timestamp - loadStart) / 2000, 1)
        : 1

      renderFaultyTerminal(
        gl,
        resources,
        width,
        height,
        frozenTime,
        smoothMouseRef.current,
        pageLoadProgress,
        options,
      )

      if (animate) {
        frame = window.requestAnimationFrame(draw)
      }
    }

    const render = () => {
      window.cancelAnimationFrame(frame)
      resize()
      draw(performance.now())
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!options.mouseReact) {
        return
      }

      const bounds = canvas.getBoundingClientRect()
      targetMouseRef.current = [
        Math.max(0, Math.min(1, (event.clientX - bounds.left) / Math.max(1, bounds.width))),
        1 - Math.max(0, Math.min(1, (event.clientY - bounds.top) / Math.max(1, bounds.height))),
      ]
    }

    const resizeObserver = new ResizeObserver(render)
    resizeObserver.observe(canvas)
    window.addEventListener("resize", render, { passive: true })
    document.addEventListener("visibilitychange", render)
    reducedMotionQuery.addEventListener("change", render)
    compactViewportQuery.addEventListener("change", render)
    if (options.mouseReact) {
      window.addEventListener("pointermove", handlePointerMove, { passive: true })
    }
    render()

    return () => {
      disposed = true
      window.cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      window.removeEventListener("resize", render)
      document.removeEventListener("visibilitychange", render)
      reducedMotionQuery.removeEventListener("change", render)
      compactViewportQuery.removeEventListener("change", render)
      window.removeEventListener("pointermove", handlePointerMove)
      disposeFaultyTerminalResources(gl, resources)
      canvas.width = 1
      canvas.height = 1
    }
  }, [options])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn(styles.reactBitsFaultyTerminalCanvas, className)}
    />
  )
}

function createFaultyTerminalResources(gl: WebGLRenderingContext): FaultyTerminalResources | null {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource)
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource)

  if (!vertexShader || !fragmentShader) {
    return null
  }

  const program = gl.createProgram()
  const vertexBuffer = gl.createBuffer()
  if (!program || !vertexBuffer) {
    if (program) gl.deleteProgram(program)
    if (vertexBuffer) gl.deleteBuffer(vertexBuffer)
    gl.deleteShader(vertexShader)
    gl.deleteShader(fragmentShader)
    return null
  }

  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("React Bits Faulty Terminal program link failed", gl.getProgramInfoLog(program))
    gl.deleteProgram(program)
    gl.deleteBuffer(vertexBuffer)
    gl.deleteShader(vertexShader)
    gl.deleteShader(fragmentShader)
    return null
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([
      -1, -1, 0, 0,
      3, -1, 2, 0,
      -1, 3, 0, 2,
    ]),
    gl.STATIC_DRAW,
  )
  gl.bindBuffer(gl.ARRAY_BUFFER, null)

  return {
    program,
    vertexShader,
    fragmentShader,
    vertexBuffer,
    attributePosition: gl.getAttribLocation(program, "position"),
    attributeUv: gl.getAttribLocation(program, "uv"),
    uniforms: {
      time: getUniform(gl, program, "iTime"),
      resolution: getUniform(gl, program, "iResolution"),
      scale: getUniform(gl, program, "uScale"),
      gridMul: getUniform(gl, program, "uGridMul"),
      digitSize: getUniform(gl, program, "uDigitSize"),
      scanlineIntensity: getUniform(gl, program, "uScanlineIntensity"),
      glitchAmount: getUniform(gl, program, "uGlitchAmount"),
      flickerAmount: getUniform(gl, program, "uFlickerAmount"),
      noiseAmp: getUniform(gl, program, "uNoiseAmp"),
      chromaticAberration: getUniform(gl, program, "uChromaticAberration"),
      dither: getUniform(gl, program, "uDither"),
      curvature: getUniform(gl, program, "uCurvature"),
      tint: getUniform(gl, program, "uTint"),
      mouse: getUniform(gl, program, "uMouse"),
      mouseStrength: getUniform(gl, program, "uMouseStrength"),
      useMouse: getUniform(gl, program, "uUseMouse"),
      pageLoadProgress: getUniform(gl, program, "uPageLoadProgress"),
      usePageLoadAnimation: getUniform(gl, program, "uUsePageLoadAnimation"),
      brightness: getUniform(gl, program, "uBrightness"),
    },
  }
}

function renderFaultyTerminal(
  gl: WebGLRenderingContext,
  resources: FaultyTerminalResources,
  width: number,
  height: number,
  time: number,
  mouse: [number, number],
  pageLoadProgress: number,
  options: ResolvedFaultyTerminalOptions,
) {
  const [red, green, blue] = hexToRgb(options.tint)

  gl.useProgram(resources.program)
  gl.bindBuffer(gl.ARRAY_BUFFER, resources.vertexBuffer)
  gl.enableVertexAttribArray(resources.attributePosition)
  gl.vertexAttribPointer(resources.attributePosition, 2, gl.FLOAT, false, 16, 0)
  gl.enableVertexAttribArray(resources.attributeUv)
  gl.vertexAttribPointer(resources.attributeUv, 2, gl.FLOAT, false, 16, 8)

  gl.uniform1f(resources.uniforms.time, time)
  gl.uniform3f(resources.uniforms.resolution, width, height, width / Math.max(1, height))
  gl.uniform1f(resources.uniforms.scale, options.scale)
  gl.uniform2f(resources.uniforms.gridMul, options.gridMulX, options.gridMulY)
  gl.uniform1f(resources.uniforms.digitSize, options.digitSize)
  gl.uniform1f(resources.uniforms.scanlineIntensity, options.scanlineIntensity)
  gl.uniform1f(resources.uniforms.glitchAmount, options.glitchAmount)
  gl.uniform1f(resources.uniforms.flickerAmount, options.flickerAmount)
  gl.uniform1f(resources.uniforms.noiseAmp, options.noiseAmp)
  gl.uniform1f(resources.uniforms.chromaticAberration, options.chromaticAberration)
  gl.uniform1f(resources.uniforms.dither, options.dither)
  gl.uniform1f(resources.uniforms.curvature, options.curvature)
  gl.uniform3f(resources.uniforms.tint, red, green, blue)
  gl.uniform2f(resources.uniforms.mouse, mouse[0], mouse[1])
  gl.uniform1f(resources.uniforms.mouseStrength, options.mouseStrength)
  gl.uniform1f(resources.uniforms.useMouse, options.mouseReact ? 1 : 0)
  gl.uniform1f(resources.uniforms.pageLoadProgress, pageLoadProgress)
  gl.uniform1f(resources.uniforms.usePageLoadAnimation, options.pageLoadAnimation ? 1 : 0)
  gl.uniform1f(resources.uniforms.brightness, options.brightness)

  gl.clear(gl.COLOR_BUFFER_BIT)
  gl.drawArrays(gl.TRIANGLES, 0, 3)
  gl.bindBuffer(gl.ARRAY_BUFFER, null)
}

function disposeFaultyTerminalResources(gl: WebGLRenderingContext, resources: FaultyTerminalResources) {
  gl.deleteBuffer(resources.vertexBuffer)
  gl.deleteProgram(resources.program)
  gl.deleteShader(resources.vertexShader)
  gl.deleteShader(resources.fragmentShader)
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type)
  if (!shader) {
    return null
  }

  gl.shaderSource(shader, source)
  gl.compileShader(shader)

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("React Bits Faulty Terminal shader compile failed", gl.getShaderInfoLog(shader))
    gl.deleteShader(shader)
    return null
  }

  return shader
}

function getUniform(gl: WebGLRenderingContext, program: WebGLProgram, name: string): WebGLUniformLocation {
  const location = gl.getUniformLocation(program, name)
  if (!location) {
    throw new Error(`Missing React Bits Faulty Terminal shader uniform: ${name}`)
  }

  return location
}

function resolveFaultyTerminalOptions(
  options: ReactBitsFaultyTerminalOptions | undefined,
): ResolvedFaultyTerminalOptions {
  return {
    scale: resolveNumber(options?.scale, DEFAULT_REACT_BITS_FAULTY_TERMINAL.scale, 0.25, 4),
    gridMulX: resolveNumber(options?.gridMulX, DEFAULT_REACT_BITS_FAULTY_TERMINAL.gridMulX, 0.25, 6),
    gridMulY: resolveNumber(options?.gridMulY, DEFAULT_REACT_BITS_FAULTY_TERMINAL.gridMulY, 0.25, 6),
    digitSize: resolveNumber(options?.digitSize, DEFAULT_REACT_BITS_FAULTY_TERMINAL.digitSize, 0.5, 4),
    timeScale: resolveNumber(options?.timeScale, DEFAULT_REACT_BITS_FAULTY_TERMINAL.timeScale, 0, 2),
    scanlineIntensity: resolveNumber(
      options?.scanlineIntensity,
      DEFAULT_REACT_BITS_FAULTY_TERMINAL.scanlineIntensity,
      0,
      2,
    ),
    glitchAmount: resolveNumber(options?.glitchAmount, DEFAULT_REACT_BITS_FAULTY_TERMINAL.glitchAmount, 0, 3),
    flickerAmount: resolveNumber(options?.flickerAmount, DEFAULT_REACT_BITS_FAULTY_TERMINAL.flickerAmount, 0, 2),
    noiseAmp: resolveNumber(options?.noiseAmp, DEFAULT_REACT_BITS_FAULTY_TERMINAL.noiseAmp, 0, 2),
    chromaticAberration: resolveNumber(
      options?.chromaticAberration,
      DEFAULT_REACT_BITS_FAULTY_TERMINAL.chromaticAberration,
      0,
      8,
    ),
    dither: resolveNumber(options?.dither, DEFAULT_REACT_BITS_FAULTY_TERMINAL.dither, 0, 255),
    curvature: resolveNumber(options?.curvature, DEFAULT_REACT_BITS_FAULTY_TERMINAL.curvature, 0, 1),
    tint: resolveHex(options?.tint, DEFAULT_REACT_BITS_FAULTY_TERMINAL.tint),
    mouseReact: options?.mouseReact ?? DEFAULT_REACT_BITS_FAULTY_TERMINAL.mouseReact,
    mouseStrength: resolveNumber(options?.mouseStrength, DEFAULT_REACT_BITS_FAULTY_TERMINAL.mouseStrength, 0, 2),
    pageLoadAnimation: options?.pageLoadAnimation ?? DEFAULT_REACT_BITS_FAULTY_TERMINAL.pageLoadAnimation,
    brightness: resolveNumber(options?.brightness, DEFAULT_REACT_BITS_FAULTY_TERMINAL.brightness, 0.1, 3),
  }
}

function resolveNumber(value: number | undefined, fallback: number, min: number, max: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback
  }

  return Math.min(max, Math.max(min, value))
}

function resolveHex(value: string | undefined, fallback: string) {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value) ? value.toUpperCase() : fallback
}

function hexToRgb(hex: string): [number, number, number] {
  const value = hex.replace("#", "")
  return [
    parseInt(value.slice(0, 2), 16) / 255,
    parseInt(value.slice(2, 4), 16) / 255,
    parseInt(value.slice(4, 6), 16) / 255,
  ]
}
