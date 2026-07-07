"use client"

import { useEffect, useMemo, useRef } from "react"
import { shouldAnimateAmbientBackground } from "@/lib/motion-preferences"
import { cn } from "@/lib/utils"
import styles from "@/components/backgrounds/BackgroundHost.module.css"
import type { BackgroundEffectProps, ReactBitsGalaxyOptions } from "./css-backgrounds"

type ResolvedGalaxyOptions = Required<ReactBitsGalaxyOptions>

type GalaxyResources = {
  program: WebGLProgram
  vertexShader: WebGLShader
  fragmentShader: WebGLShader
  vertexBuffer: WebGLBuffer
  attributePosition: number
  uniforms: {
    time: WebGLUniformLocation
    resolution: WebGLUniformLocation
    focal: WebGLUniformLocation
    rotation: WebGLUniformLocation
    starSpeed: WebGLUniformLocation
    density: WebGLUniformLocation
    hueShift: WebGLUniformLocation
    speed: WebGLUniformLocation
    mouse: WebGLUniformLocation
    glowIntensity: WebGLUniformLocation
    saturation: WebGLUniformLocation
    mouseRepulsion: WebGLUniformLocation
    twinkleIntensity: WebGLUniformLocation
    rotationSpeed: WebGLUniformLocation
    repulsionStrength: WebGLUniformLocation
    mouseActiveFactor: WebGLUniformLocation
    autoCenterRepulsion: WebGLUniformLocation
    transparent: WebGLUniformLocation
  }
}

const DEFAULT_REACT_BITS_GALAXY: ResolvedGalaxyOptions = {
  focalX: 0.5,
  focalY: 0.5,
  rotationDeg: 0,
  starSpeed: 0.5,
  density: 1,
  hueShift: 140,
  speed: 1,
  mouseInteraction: true,
  glowIntensity: 0.3,
  saturation: 0,
  mouseRepulsion: true,
  repulsionStrength: 2,
  twinkleIntensity: 0.3,
  rotationSpeed: 0.1,
  autoCenterRepulsion: 0,
  transparent: true,
}

const vertexShaderSource = `
  attribute vec2 position;

  varying vec2 vUv;

  void main() {
    vUv = position * 0.5 + 0.5;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`

const fragmentShaderSource = `
  precision highp float;

  uniform float uTime;
  uniform vec3 uResolution;
  uniform vec2 uFocal;
  uniform vec2 uRotation;
  uniform float uStarSpeed;
  uniform float uDensity;
  uniform float uHueShift;
  uniform float uSpeed;
  uniform vec2 uMouse;
  uniform float uGlowIntensity;
  uniform float uSaturation;
  uniform bool uMouseRepulsion;
  uniform float uTwinkleIntensity;
  uniform float uRotationSpeed;
  uniform float uRepulsionStrength;
  uniform float uMouseActiveFactor;
  uniform float uAutoCenterRepulsion;
  uniform bool uTransparent;

  varying vec2 vUv;

  #define NUM_LAYER 4.0
  #define STAR_COLOR_CUTOFF 0.2
  #define MAT45 mat2(0.7071, -0.7071, 0.7071, 0.7071)
  #define PERIOD 3.0

  float Hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float tri(float x) {
    return abs(fract(x) * 2.0 - 1.0);
  }

  float tris(float x) {
    float t = fract(x);
    return 1.0 - smoothstep(0.0, 1.0, abs(2.0 * t - 1.0));
  }

  float trisn(float x) {
    float t = fract(x);
    return 2.0 * (1.0 - smoothstep(0.0, 1.0, abs(2.0 * t - 1.0))) - 1.0;
  }

  vec3 hsv2rgb(vec3 c) {
    vec4 K = vec4(1.0, 2.0 / 3.0, 1.0 / 3.0, 3.0);
    vec3 p = abs(fract(c.xxx + K.xyz) * 6.0 - K.www);
    return c.z * mix(K.xxx, clamp(p - K.xxx, 0.0, 1.0), c.y);
  }

  float Star(vec2 uv, float flare) {
    float d = max(length(uv), 0.0001);
    float m = (0.05 * uGlowIntensity) / d;
    float rays = smoothstep(0.0, 1.0, 1.0 - abs(uv.x * uv.y * 1000.0));
    m += rays * flare * uGlowIntensity;
    uv *= MAT45;
    rays = smoothstep(0.0, 1.0, 1.0 - abs(uv.x * uv.y * 1000.0));
    m += rays * 0.3 * flare * uGlowIntensity;
    m *= smoothstep(1.0, 0.2, d);
    return m;
  }

  vec3 StarLayer(vec2 uv) {
    vec3 col = vec3(0.0);
    vec2 gv = fract(uv) - 0.5;
    vec2 id = floor(uv);

    for (int y = -1; y <= 1; y++) {
      for (int x = -1; x <= 1; x++) {
        vec2 offset = vec2(float(x), float(y));
        vec2 si = id + vec2(float(x), float(y));
        float seed = Hash21(si);
        float size = fract(seed * 345.32);
        float glossLocal = tri(uStarSpeed / (PERIOD * seed + 1.0));
        float flareSize = smoothstep(0.9, 1.0, size) * glossLocal;

        float red = smoothstep(STAR_COLOR_CUTOFF, 1.0, Hash21(si + 1.0)) + STAR_COLOR_CUTOFF;
        float blu = smoothstep(STAR_COLOR_CUTOFF, 1.0, Hash21(si + 3.0)) + STAR_COLOR_CUTOFF;
        float grn = min(red, blu) * seed;
        vec3 base = vec3(red, grn, blu);

        float hue = atan(base.g - base.r, base.b - base.r) / (2.0 * 3.14159) + 0.5;
        hue = fract(hue + uHueShift / 360.0);
        float sat = length(base - vec3(dot(base, vec3(0.299, 0.587, 0.114)))) * uSaturation;
        float val = max(max(base.r, base.g), base.b);
        base = hsv2rgb(vec3(hue, sat, val));

        vec2 pad = vec2(
          tris(seed * 34.0 + uTime * uSpeed / 10.0),
          tris(seed * 38.0 + uTime * uSpeed / 30.0)
        ) - 0.5;

        float star = Star(gv - offset - pad, flareSize);
        float twinkle = trisn(uTime * uSpeed + seed * 6.2831) * 0.5 + 1.0;
        twinkle = mix(1.0, twinkle, uTwinkleIntensity);
        star *= twinkle;
        col += star * size * base;
      }
    }

    return col;
  }

  void main() {
    vec2 focalPx = uFocal * uResolution.xy;
    vec2 uv = (vUv * uResolution.xy - focalPx) / uResolution.y;
    vec2 mouseNorm = uMouse - vec2(0.5);

    if (uAutoCenterRepulsion > 0.0) {
      float centerDist = length(uv);
      vec2 centerDir = centerDist > 0.0001 ? uv / centerDist : vec2(0.0);
      vec2 repulsion = centerDir * (uAutoCenterRepulsion / (centerDist + 0.1));
      uv += repulsion * 0.05;
    } else if (uMouseRepulsion) {
      vec2 mousePosUV = (uMouse * uResolution.xy - focalPx) / uResolution.y;
      vec2 mouseDelta = uv - mousePosUV;
      float mouseDist = length(mouseDelta);
      vec2 mouseDir = mouseDist > 0.0001 ? mouseDelta / mouseDist : vec2(0.0);
      vec2 repulsion = mouseDir * (uRepulsionStrength / (mouseDist + 0.1));
      uv += repulsion * 0.05 * uMouseActiveFactor;
    } else {
      vec2 mouseOffset = mouseNorm * 0.1 * uMouseActiveFactor;
      uv += mouseOffset;
    }

    float autoRotAngle = uTime * uRotationSpeed;
    mat2 autoRot = mat2(cos(autoRotAngle), -sin(autoRotAngle), sin(autoRotAngle), cos(autoRotAngle));
    uv = autoRot * uv;
    uv = mat2(uRotation.x, -uRotation.y, uRotation.y, uRotation.x) * uv;

    vec3 col = vec3(0.0);

    for (float i = 0.0; i < 1.0; i += 1.0 / NUM_LAYER) {
      float depth = fract(i + uStarSpeed * uSpeed);
      float scale = mix(20.0 * uDensity, 0.5 * uDensity, depth);
      float fade = depth * smoothstep(1.0, 0.9, depth);
      col += StarLayer(uv * scale + i * 453.32) * fade;
    }

    if (uTransparent) {
      float alpha = length(col);
      alpha = smoothstep(0.0, 0.3, alpha);
      alpha = min(alpha, 1.0);
      gl_FragColor = vec4(col, alpha);
    } else {
      gl_FragColor = vec4(col, 1.0);
    }
  }
`

// React Bits Galaxy is an OGL shader. MassageLab keeps the star-layer,
// hue-shift, twinkle, rotation, and cursor-repulsion uniforms with owned WebGL cleanup.
export default function ReactBitsGalaxyBackground({
  className,
  reactBitsGalaxy,
}: BackgroundEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const targetMouseRef = useRef<[number, number]>([0.5, 0.5])
  const smoothMouseRef = useRef<[number, number]>([0.5, 0.5])
  const targetActiveRef = useRef(0)
  const smoothActiveRef = useRef(0)
  const options = useMemo(
    () => resolveGalaxyOptions(reactBitsGalaxy),
    [reactBitsGalaxy],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    const gl = canvas?.getContext("webgl", {
      alpha: options.transparent,
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

    const resources = createGalaxyResources(gl)
    if (!resources) {
      return undefined
    }

    if (options.transparent) {
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
      gl.clearColor(0, 0, 0, 0)
    } else {
      gl.disable(gl.BLEND)
      gl.clearColor(0, 0, 0, 1)
    }

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const compactViewportQuery = window.matchMedia("(max-width: 360px), (max-height: 360px)")
    const startTime = performance.now()
    let frame = 0
    let disposed = false
    let width = 1
    let height = 1
    let lastFrameTime = startTime
    let inactiveTimer = 0

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

    const handlePointerMove = (event: PointerEvent) => {
      if (!options.mouseInteraction) {
        return
      }

      const bounds = canvas.getBoundingClientRect()
      const x = (event.clientX - bounds.left) / Math.max(bounds.width, 1)
      const y = 1 - ((event.clientY - bounds.top) / Math.max(bounds.height, 1))
      targetMouseRef.current = [
        Math.min(1, Math.max(0, x)),
        Math.min(1, Math.max(0, y)),
      ]
      targetActiveRef.current = 1
      window.clearTimeout(inactiveTimer)
      inactiveTimer = window.setTimeout(() => {
        targetActiveRef.current = 0
      }, 1200)
    }

    const draw = (timestamp: number) => {
      if (disposed) {
        return
      }

      const dt = Math.max(0, timestamp - lastFrameTime) / 1000
      lastFrameTime = timestamp
      const animate = shouldAnimate()
      const time = animate ? (timestamp - startTime) / 1000 : 0

      const mouse = smoothMouseRef.current
      const targetMouse = targetMouseRef.current
      const lerpFactor = Math.min(1, 1 - Math.pow(0.05, Math.max(dt, 1 / 60) * 60))
      mouse[0] += (targetMouse[0] - mouse[0]) * lerpFactor
      mouse[1] += (targetMouse[1] - mouse[1]) * lerpFactor
      smoothActiveRef.current += (targetActiveRef.current - smoothActiveRef.current) * lerpFactor

      renderGalaxy(
        gl,
        resources,
        width,
        height,
        time,
        mouse,
        options.mouseInteraction ? smoothActiveRef.current : 0,
        animate,
        options,
      )

      if (animate && (options.speed > 1e-6 || options.rotationSpeed !== 0 || options.mouseInteraction)) {
        frame = window.requestAnimationFrame(draw)
      }
    }

    const render = () => {
      window.cancelAnimationFrame(frame)
      resize()
      lastFrameTime = performance.now()
      draw(lastFrameTime)
    }

    const resizeObserver = new ResizeObserver(render)
    resizeObserver.observe(canvas)
    window.addEventListener("resize", render, { passive: true })
    window.addEventListener("pointermove", handlePointerMove, { passive: true })
    document.addEventListener("visibilitychange", render)
    reducedMotionQuery.addEventListener("change", render)
    compactViewportQuery.addEventListener("change", render)
    render()

    return () => {
      disposed = true
      window.cancelAnimationFrame(frame)
      window.clearTimeout(inactiveTimer)
      resizeObserver.disconnect()
      window.removeEventListener("resize", render)
      window.removeEventListener("pointermove", handlePointerMove)
      document.removeEventListener("visibilitychange", render)
      reducedMotionQuery.removeEventListener("change", render)
      compactViewportQuery.removeEventListener("change", render)
      disposeGalaxyResources(gl, resources)
      canvas.width = 1
      canvas.height = 1
    }
  }, [options])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn(styles.reactBitsGalaxyCanvas, className)}
    />
  )
}

function createGalaxyResources(gl: WebGLRenderingContext): GalaxyResources | null {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource)
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource)

  if (!vertexShader || !fragmentShader) {
    return null
  }

  const program = gl.createProgram()
  if (!program) {
    gl.deleteShader(vertexShader)
    gl.deleteShader(fragmentShader)
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

  const vertexBuffer = gl.createBuffer()
  if (!vertexBuffer) {
    gl.deleteProgram(program)
    gl.deleteShader(vertexShader)
    gl.deleteShader(fragmentShader)
    return null
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
    gl.STATIC_DRAW,
  )

  return {
    program,
    vertexShader,
    fragmentShader,
    vertexBuffer,
    attributePosition: gl.getAttribLocation(program, "position"),
    uniforms: {
      time: getUniformLocation(gl, program, "uTime"),
      resolution: getUniformLocation(gl, program, "uResolution"),
      focal: getUniformLocation(gl, program, "uFocal"),
      rotation: getUniformLocation(gl, program, "uRotation"),
      starSpeed: getUniformLocation(gl, program, "uStarSpeed"),
      density: getUniformLocation(gl, program, "uDensity"),
      hueShift: getUniformLocation(gl, program, "uHueShift"),
      speed: getUniformLocation(gl, program, "uSpeed"),
      mouse: getUniformLocation(gl, program, "uMouse"),
      glowIntensity: getUniformLocation(gl, program, "uGlowIntensity"),
      saturation: getUniformLocation(gl, program, "uSaturation"),
      mouseRepulsion: getUniformLocation(gl, program, "uMouseRepulsion"),
      twinkleIntensity: getUniformLocation(gl, program, "uTwinkleIntensity"),
      rotationSpeed: getUniformLocation(gl, program, "uRotationSpeed"),
      repulsionStrength: getUniformLocation(gl, program, "uRepulsionStrength"),
      mouseActiveFactor: getUniformLocation(gl, program, "uMouseActiveFactor"),
      autoCenterRepulsion: getUniformLocation(gl, program, "uAutoCenterRepulsion"),
      transparent: getUniformLocation(gl, program, "uTransparent"),
    },
  }
}

function renderGalaxy(
  gl: WebGLRenderingContext,
  resources: GalaxyResources,
  width: number,
  height: number,
  time: number,
  mouse: [number, number],
  mouseActiveFactor: number,
  animate: boolean,
  options: ResolvedGalaxyOptions,
) {
  const rotationRadians = (options.rotationDeg * Math.PI) / 180
  const starPhase = animate ? (time * options.starSpeed) / 10 : options.starSpeed

  gl.clear(gl.COLOR_BUFFER_BIT)
  gl.disable(gl.DEPTH_TEST)
  gl.disable(gl.CULL_FACE)
  gl.useProgram(resources.program)
  gl.bindBuffer(gl.ARRAY_BUFFER, resources.vertexBuffer)
  gl.enableVertexAttribArray(resources.attributePosition)
  gl.vertexAttribPointer(resources.attributePosition, 2, gl.FLOAT, false, 0, 0)
  gl.uniform1f(resources.uniforms.time, time)
  gl.uniform3f(resources.uniforms.resolution, width, height, width / Math.max(height, 1))
  gl.uniform2f(resources.uniforms.focal, options.focalX, options.focalY)
  gl.uniform2f(resources.uniforms.rotation, Math.cos(rotationRadians), Math.sin(rotationRadians))
  gl.uniform1f(resources.uniforms.starSpeed, starPhase)
  gl.uniform1f(resources.uniforms.density, options.density)
  gl.uniform1f(resources.uniforms.hueShift, options.hueShift)
  gl.uniform1f(resources.uniforms.speed, options.speed)
  gl.uniform2f(resources.uniforms.mouse, mouse[0], mouse[1])
  gl.uniform1f(resources.uniforms.glowIntensity, options.glowIntensity)
  gl.uniform1f(resources.uniforms.saturation, options.saturation)
  gl.uniform1i(resources.uniforms.mouseRepulsion, options.mouseRepulsion ? 1 : 0)
  gl.uniform1f(resources.uniforms.twinkleIntensity, options.twinkleIntensity)
  gl.uniform1f(resources.uniforms.rotationSpeed, options.rotationSpeed)
  gl.uniform1f(resources.uniforms.repulsionStrength, options.repulsionStrength)
  gl.uniform1f(resources.uniforms.mouseActiveFactor, mouseActiveFactor)
  gl.uniform1f(resources.uniforms.autoCenterRepulsion, options.autoCenterRepulsion)
  gl.uniform1i(resources.uniforms.transparent, options.transparent ? 1 : 0)
  gl.drawArrays(gl.TRIANGLES, 0, 6)
}

function disposeGalaxyResources(gl: WebGLRenderingContext, resources: GalaxyResources) {
  gl.deleteBuffer(resources.vertexBuffer)
  gl.detachShader(resources.program, resources.vertexShader)
  gl.detachShader(resources.program, resources.fragmentShader)
  gl.deleteShader(resources.vertexShader)
  gl.deleteShader(resources.fragmentShader)
  gl.deleteProgram(resources.program)
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
    throw new Error(`Missing React Bits Galaxy shader uniform: ${name}`)
  }

  return location
}

function resolveGalaxyOptions(options: ReactBitsGalaxyOptions | undefined): ResolvedGalaxyOptions {
  return {
    focalX: resolveNumber(options?.focalX, DEFAULT_REACT_BITS_GALAXY.focalX, 0, 1),
    focalY: resolveNumber(options?.focalY, DEFAULT_REACT_BITS_GALAXY.focalY, 0, 1),
    rotationDeg: resolveNumber(options?.rotationDeg, DEFAULT_REACT_BITS_GALAXY.rotationDeg, -360, 360),
    starSpeed: resolveNumber(options?.starSpeed, DEFAULT_REACT_BITS_GALAXY.starSpeed, 0, 5),
    density: resolveNumber(options?.density, DEFAULT_REACT_BITS_GALAXY.density, 0.1, 3),
    hueShift: resolveNumber(options?.hueShift, DEFAULT_REACT_BITS_GALAXY.hueShift, 0, 360),
    speed: resolveNumber(options?.speed, DEFAULT_REACT_BITS_GALAXY.speed, 0, 5),
    mouseInteraction: typeof options?.mouseInteraction === "boolean"
      ? options.mouseInteraction
      : DEFAULT_REACT_BITS_GALAXY.mouseInteraction,
    glowIntensity: resolveNumber(options?.glowIntensity, DEFAULT_REACT_BITS_GALAXY.glowIntensity, 0.01, 2),
    saturation: resolveNumber(options?.saturation, DEFAULT_REACT_BITS_GALAXY.saturation, 0, 2),
    mouseRepulsion: typeof options?.mouseRepulsion === "boolean"
      ? options.mouseRepulsion
      : DEFAULT_REACT_BITS_GALAXY.mouseRepulsion,
    repulsionStrength: resolveNumber(
      options?.repulsionStrength,
      DEFAULT_REACT_BITS_GALAXY.repulsionStrength,
      0,
      6,
    ),
    twinkleIntensity: resolveNumber(
      options?.twinkleIntensity,
      DEFAULT_REACT_BITS_GALAXY.twinkleIntensity,
      0,
      1,
    ),
    rotationSpeed: resolveNumber(options?.rotationSpeed, DEFAULT_REACT_BITS_GALAXY.rotationSpeed, -2, 2),
    autoCenterRepulsion: resolveNumber(
      options?.autoCenterRepulsion,
      DEFAULT_REACT_BITS_GALAXY.autoCenterRepulsion,
      0,
      6,
    ),
    transparent: typeof options?.transparent === "boolean"
      ? options.transparent
      : DEFAULT_REACT_BITS_GALAXY.transparent,
  }
}

function resolveNumber(
  value: number | undefined,
  fallback: number,
  min: number,
  max: number,
) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback
  }

  return Math.min(max, Math.max(min, value))
}
