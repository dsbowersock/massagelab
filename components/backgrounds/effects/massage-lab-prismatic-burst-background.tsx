"use client"

import { useEffect, useMemo, useRef } from "react"
import { shouldAnimateAmbientBackground } from "@/lib/motion-preferences"
import { cn } from "@/lib/utils"
import styles from "@/components/backgrounds/BackgroundHost.module.css"
import type { BackgroundEffectProps, MassageLabPrismaticBurstOptions } from "./css-backgrounds"

type ResolvedPrismaticBurstOptions = Required<Omit<MassageLabPrismaticBurstOptions, "colors">> & {
  colors: string[]
}

type PrismaticBurstResources = {
  program: WebGLProgram
  vertexShader: WebGLShader
  fragmentShader: WebGLShader
  vertexBuffer: WebGLBuffer
  gradientTexture: WebGLTexture
  attributePosition: number
  uniforms: {
    resolution: WebGLUniformLocation
    time: WebGLUniformLocation
    intensity: WebGLUniformLocation
    speed: WebGLUniformLocation
    animationType: WebGLUniformLocation
    mouse: WebGLUniformLocation
    colorCount: WebGLUniformLocation
    distort: WebGLUniformLocation
    offset: WebGLUniformLocation
    gradient: WebGLUniformLocation
    noiseAmount: WebGLUniformLocation
    rayCount: WebGLUniformLocation
  }
}

const DEFAULT_MASSAGELAB_PRISMATIC_BURST: ResolvedPrismaticBurstOptions = {
  intensity: 2,
  speed: 0.5,
  animationType: "rotate3d",
  colors: [],
  distort: 0,
  offsetX: 0,
  offsetY: 0,
  hoverDampness: 0,
  rayCount: 0,
  mixBlendMode: "lighten",
}

const vertexShaderSource = `#version 300 es
  in vec2 position;

  void main() {
    gl_Position = vec4(position, 0.0, 1.0);
  }
`

const fragmentShaderSource = `#version 300 es
  precision highp float;
  precision highp int;

  out vec4 fragColor;

  uniform vec2 uResolution;
  uniform float uTime;
  uniform float uIntensity;
  uniform float uSpeed;
  uniform int uAnimType;
  uniform vec2 uMouse;
  uniform int uColorCount;
  uniform float uDistort;
  uniform vec2 uOffset;
  uniform sampler2D uGradient;
  uniform float uNoiseAmount;
  uniform int uRayCount;

  float hash21(vec2 p) {
    p = floor(p);
    float f = 52.9829189 * fract(dot(p, vec2(0.065, 0.005)));
    return fract(f);
  }

  mat2 rot30() {
    return mat2(0.8, -0.5, 0.5, 0.8);
  }

  float layeredNoise(vec2 fragPx) {
    vec2 p = mod(fragPx + vec2(uTime * 30.0, -uTime * 21.0), 1024.0);
    vec2 q = rot30() * p;
    float n = 0.0;
    n += 0.40 * hash21(q);
    n += 0.25 * hash21(q * 2.0 + 17.0);
    n += 0.20 * hash21(q * 4.0 + 47.0);
    n += 0.10 * hash21(q * 8.0 + 113.0);
    n += 0.05 * hash21(q * 16.0 + 191.0);
    return n;
  }

  vec3 rayDir(vec2 frag, vec2 res, vec2 offset, float dist) {
    float focal = res.y * max(dist, 1e-3);
    return normalize(vec3(2.0 * (frag - offset) - res, focal));
  }

  float edgeFade(vec2 frag, vec2 res, vec2 offset) {
    vec2 toC = frag - 0.5 * res - offset;
    float r = length(toC) / (0.5 * min(res.x, res.y));
    float x = clamp(r, 0.0, 1.0);
    float q = x * x * x * (x * (x * 6.0 - 15.0) + 10.0);
    float s = q * 0.5;
    s = pow(s, 1.5);
    float tail = 1.0 - pow(1.0 - s, 2.0);
    s = mix(s, tail, 0.2);
    float dn = (layeredNoise(frag * 0.15) - 0.5) * 0.0015 * s;
    return clamp(s + dn, 0.0, 1.0);
  }

  mat3 rotX(float a) {
    float c = cos(a), s = sin(a);
    return mat3(1.0,0.0,0.0, 0.0,c,-s, 0.0,s,c);
  }

  mat3 rotY(float a) {
    float c = cos(a), s = sin(a);
    return mat3(c,0.0,s, 0.0,1.0,0.0, -s,0.0,c);
  }

  mat3 rotZ(float a) {
    float c = cos(a), s = sin(a);
    return mat3(c,-s,0.0, s,c,0.0, 0.0,0.0,1.0);
  }

  vec3 sampleGradient(float t) {
    t = clamp(t, 0.0, 1.0);
    return texture(uGradient, vec2(t, 0.5)).rgb;
  }

  vec2 rot2(vec2 v, float a) {
    float s = sin(a), c = cos(a);
    return mat2(c, -s, s, c) * v;
  }

  float bendAngle(vec3 q, float t) {
    float a = 0.8 * sin(q.x * 0.55 + t * 0.6)
      + 0.7 * sin(q.y * 0.50 - t * 0.5)
      + 0.6 * sin(q.z * 0.60 + t * 0.7);
    return a;
  }

  void main() {
    vec2 frag = gl_FragCoord.xy;
    float t = uTime * uSpeed;
    float jitterAmp = 0.1 * clamp(uNoiseAmount, 0.0, 1.0);
    vec3 dir = rayDir(frag, uResolution, uOffset, 1.0);
    float marchT = 0.0;
    vec3 col = vec3(0.0);
    float n = layeredNoise(frag);
    vec4 c = cos(t * 0.2 + vec4(0.0, 33.0, 11.0, 0.0));
    mat2 M2 = mat2(c.x, c.y, c.z, c.w);
    float amp = clamp(uDistort, 0.0, 50.0) * 0.15;
    mat3 rot3dMat = mat3(1.0);
    if (uAnimType == 1) {
      vec3 ang = vec3(t * 0.31, t * 0.21, t * 0.17);
      rot3dMat = rotZ(ang.z) * rotY(ang.y) * rotX(ang.x);
    }
    mat3 hoverMat = mat3(1.0);
    if (uAnimType == 2) {
      vec2 m = uMouse * 2.0 - 1.0;
      vec3 ang = vec3(m.y * 0.6, m.x * 0.6, 0.0);
      hoverMat = rotY(ang.y) * rotX(ang.x);
    }

    for (int i = 0; i < 44; ++i) {
      vec3 P = marchT * dir;
      P.z -= 2.0;
      float rad = length(P);
      vec3 Pl = P * (10.0 / max(rad, 1e-6));
      if (uAnimType == 0) {
        Pl.xz *= M2;
      } else if (uAnimType == 1) {
        Pl = rot3dMat * Pl;
      } else {
        Pl = hoverMat * Pl;
      }
      float stepLen = min(rad - 0.3, n * jitterAmp) + 0.1;
      float grow = smoothstep(0.35, 3.0, marchT);
      float a1 = amp * grow * bendAngle(Pl * 0.6, t);
      float a2 = 0.5 * amp * grow * bendAngle(Pl.zyx * 0.5 + 3.1, t * 0.9);
      vec3 Pb = Pl;
      Pb.xz = rot2(Pb.xz, a1);
      Pb.xy = rot2(Pb.xy, a2);
      float rayPattern = smoothstep(
        0.5,
        0.7,
        sin(Pb.x + cos(Pb.y) * cos(Pb.z)) * sin(Pb.z + sin(Pb.y) * cos(Pb.x + t))
      );
      if (uRayCount > 0) {
        float ang = atan(Pb.y, Pb.x);
        float comb = 0.5 + 0.5 * cos(float(uRayCount) * ang);
        comb = pow(comb, 3.0);
        rayPattern *= smoothstep(0.15, 0.95, comb);
      }
      vec3 spectralDefault = 1.0 + vec3(
        cos(marchT * 3.0 + 0.0),
        cos(marchT * 3.0 + 1.0),
        cos(marchT * 3.0 + 2.0)
      );
      float saw = fract(marchT * 0.25);
      float tRay = saw * saw * (3.0 - 2.0 * saw);
      vec3 userGradient = 2.0 * sampleGradient(tRay);
      vec3 spectral = (uColorCount > 0) ? userGradient : spectralDefault;
      vec3 base = (0.05 / (0.4 + stepLen)) * smoothstep(5.0, 0.0, rad) * spectral;
      col += base * rayPattern;
      marchT += stepLen;
    }

    col *= edgeFade(frag, uResolution, uOffset);
    col *= uIntensity;
    fragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  }
`

// MassageLab Prismatic Burst is a WebGL2/OGL shader. MassageLab keeps the
// shader math and gradient texture model while owning WebGL lifecycle cleanup.
export default function MassageLabPrismaticBurstBackground({
  className,
  massageLabPrismaticBurst,
}: BackgroundEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const pointerTargetRef = useRef<[number, number]>([0.5, 0.5])
  const pointerSmoothRef = useRef<[number, number]>([0.5, 0.5])
  const options = useMemo(
    () => resolvePrismaticBurstOptions(massageLabPrismaticBurst),
    [massageLabPrismaticBurst],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    const gl = canvas?.getContext("webgl2", {
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

    const resources = createPrismaticBurstResources(gl, options.colors)
    if (!resources) {
      return undefined
    }

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const compactViewportQuery = window.matchMedia("(max-width: 360px), (max-height: 360px)")
    const startTime = performance.now()
    let lastFrameTime = startTime
    let elapsedTime = 0
    let frame = 0
    let disposed = false
    let width = 1
    let height = 1

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
      if (options.animationType !== "hover") {
        return
      }

      const bounds = canvas.getBoundingClientRect()
      const x = (event.clientX - bounds.left) / Math.max(bounds.width, 1)
      const y = (event.clientY - bounds.top) / Math.max(bounds.height, 1)
      pointerTargetRef.current = [
        Math.min(1, Math.max(0, x)),
        Math.min(1, Math.max(0, y)),
      ]
    }

    const draw = (timestamp: number) => {
      if (disposed) {
        return
      }

      const dt = Math.max(0, timestamp - lastFrameTime) / 1000
      lastFrameTime = timestamp
      const animate = shouldAnimate()
      if (animate) {
        elapsedTime = (timestamp - startTime) / 1000
      }

      const tau = 0.02 + options.hoverDampness * 0.5
      const alpha = tau > 0 ? 1 - Math.exp(-dt / tau) : 1
      const target = pointerTargetRef.current
      const smooth = pointerSmoothRef.current
      smooth[0] += (target[0] - smooth[0]) * alpha
      smooth[1] += (target[1] - smooth[1]) * alpha

      renderPrismaticBurst(gl, resources, width, height, animate ? elapsedTime : 0, smooth, options)

      if (animate && (options.speed > 1e-6 || options.animationType === "hover")) {
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
      resizeObserver.disconnect()
      window.removeEventListener("resize", render)
      window.removeEventListener("pointermove", handlePointerMove)
      document.removeEventListener("visibilitychange", render)
      reducedMotionQuery.removeEventListener("change", render)
      compactViewportQuery.removeEventListener("change", render)
      disposePrismaticBurstResources(gl, resources)
      canvas.width = 1
      canvas.height = 1
    }
  }, [options])

  const mixBlendMode = options.mixBlendMode === "none" ? undefined : options.mixBlendMode

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn(styles.massageLabPrismaticBurstCanvas, className)}
      style={{ mixBlendMode }}
    />
  )
}

function createPrismaticBurstResources(
  gl: WebGL2RenderingContext,
  colors: string[],
): PrismaticBurstResources | null {
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

  const vertices = new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1])
  const vertexBuffer = gl.createBuffer()
  const gradientTexture = gl.createTexture()
  if (!vertexBuffer || !gradientTexture) {
    gl.deleteBuffer(vertexBuffer)
    gl.deleteTexture(gradientTexture)
    gl.deleteProgram(program)
    gl.deleteShader(vertexShader)
    gl.deleteShader(fragmentShader)
    return null
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW)
  updateGradientTexture(gl, gradientTexture, colors)

  return {
    program,
    vertexShader,
    fragmentShader,
    vertexBuffer,
    gradientTexture,
    attributePosition: gl.getAttribLocation(program, "position"),
    uniforms: {
      resolution: getUniformLocation(gl, program, "uResolution"),
      time: getUniformLocation(gl, program, "uTime"),
      intensity: getUniformLocation(gl, program, "uIntensity"),
      speed: getUniformLocation(gl, program, "uSpeed"),
      animationType: getUniformLocation(gl, program, "uAnimType"),
      mouse: getUniformLocation(gl, program, "uMouse"),
      colorCount: getUniformLocation(gl, program, "uColorCount"),
      distort: getUniformLocation(gl, program, "uDistort"),
      offset: getUniformLocation(gl, program, "uOffset"),
      gradient: getUniformLocation(gl, program, "uGradient"),
      noiseAmount: getUniformLocation(gl, program, "uNoiseAmount"),
      rayCount: getUniformLocation(gl, program, "uRayCount"),
    },
  }
}

function renderPrismaticBurst(
  gl: WebGL2RenderingContext,
  resources: PrismaticBurstResources,
  width: number,
  height: number,
  time: number,
  mouse: [number, number],
  options: ResolvedPrismaticBurstOptions,
) {
  gl.disable(gl.DEPTH_TEST)
  gl.disable(gl.CULL_FACE)
  gl.useProgram(resources.program)
  gl.bindBuffer(gl.ARRAY_BUFFER, resources.vertexBuffer)
  gl.enableVertexAttribArray(resources.attributePosition)
  gl.vertexAttribPointer(resources.attributePosition, 2, gl.FLOAT, false, 0, 0)
  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, resources.gradientTexture)
  gl.uniform2f(resources.uniforms.resolution, width, height)
  gl.uniform1f(resources.uniforms.time, time)
  gl.uniform1f(resources.uniforms.intensity, options.intensity)
  gl.uniform1f(resources.uniforms.speed, options.speed)
  gl.uniform1i(resources.uniforms.animationType, getAnimationTypeIndex(options.animationType))
  gl.uniform2f(resources.uniforms.mouse, mouse[0], mouse[1])
  gl.uniform1i(resources.uniforms.colorCount, options.colors.length)
  gl.uniform1f(resources.uniforms.distort, options.distort)
  gl.uniform2f(resources.uniforms.offset, options.offsetX, options.offsetY)
  gl.uniform1i(resources.uniforms.gradient, 0)
  gl.uniform1f(resources.uniforms.noiseAmount, 0.8)
  gl.uniform1i(resources.uniforms.rayCount, options.rayCount)
  gl.drawArrays(gl.TRIANGLES, 0, 6)
}

function updateGradientTexture(
  gl: WebGL2RenderingContext,
  texture: WebGLTexture,
  colors: string[],
) {
  const palette = colors.length > 0 ? colors.slice(0, 64) : ["#FFFFFF"]
  const data = new Uint8Array(palette.length * 4)

  palette.forEach((color, index) => {
    const [red, green, blue] = hexToRgb255(color)
    const offset = index * 4
    data[offset] = red
    data[offset + 1] = green
    data[offset + 2] = blue
    data[offset + 3] = 255
  })

  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    palette.length,
    1,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    data,
  )
}

function disposePrismaticBurstResources(
  gl: WebGL2RenderingContext,
  resources: PrismaticBurstResources,
) {
  gl.deleteTexture(resources.gradientTexture)
  gl.deleteBuffer(resources.vertexBuffer)
  gl.detachShader(resources.program, resources.vertexShader)
  gl.detachShader(resources.program, resources.fragmentShader)
  gl.deleteShader(resources.vertexShader)
  gl.deleteShader(resources.fragmentShader)
  gl.deleteProgram(resources.program)
}

function compileShader(
  gl: WebGL2RenderingContext,
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
  gl: WebGL2RenderingContext,
  program: WebGLProgram,
  name: string,
): WebGLUniformLocation {
  const location = gl.getUniformLocation(program, name)

  if (!location) {
    throw new Error(`Missing MassageLab Prismatic Burst shader uniform: ${name}`)
  }

  return location
}

function resolvePrismaticBurstOptions(
  options: MassageLabPrismaticBurstOptions | undefined,
): ResolvedPrismaticBurstOptions {
  const colors = Array.isArray(options?.colors)
    ? options.colors.filter((color): color is string => isHexColor(color)).slice(0, 64)
    : DEFAULT_MASSAGELAB_PRISMATIC_BURST.colors

  return {
    intensity: resolveNumber(options?.intensity, DEFAULT_MASSAGELAB_PRISMATIC_BURST.intensity, 0, 5),
    speed: resolveNumber(options?.speed, DEFAULT_MASSAGELAB_PRISMATIC_BURST.speed, 0, 3),
    animationType: resolveChoice(
      options?.animationType,
      DEFAULT_MASSAGELAB_PRISMATIC_BURST.animationType,
      ["rotate", "rotate3d", "hover"],
    ),
    colors,
    distort: resolveNumber(options?.distort, DEFAULT_MASSAGELAB_PRISMATIC_BURST.distort, 0, 50),
    offsetX: resolveNumber(options?.offsetX, DEFAULT_MASSAGELAB_PRISMATIC_BURST.offsetX, -1000, 1000),
    offsetY: resolveNumber(options?.offsetY, DEFAULT_MASSAGELAB_PRISMATIC_BURST.offsetY, -1000, 1000),
    hoverDampness: resolveNumber(
      options?.hoverDampness,
      DEFAULT_MASSAGELAB_PRISMATIC_BURST.hoverDampness,
      0,
      1,
    ),
    rayCount: Math.trunc(resolveNumber(options?.rayCount, DEFAULT_MASSAGELAB_PRISMATIC_BURST.rayCount, 0, 64)),
    mixBlendMode: resolveChoice(
      options?.mixBlendMode,
      DEFAULT_MASSAGELAB_PRISMATIC_BURST.mixBlendMode,
      ["lighten", "screen", "none"],
    ),
  }
}

function getAnimationTypeIndex(animationType: ResolvedPrismaticBurstOptions["animationType"]) {
  if (animationType === "rotate") {
    return 0
  }
  if (animationType === "hover") {
    return 2
  }
  return 1
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

function resolveChoice<T extends string>(
  value: T | undefined,
  fallback: T,
  options: readonly T[],
) {
  return typeof value === "string" && options.includes(value) ? value : fallback
}

function isHexColor(color: string) {
  return /^#[0-9a-f]{6}$/i.test(color)
}

function hexToRgb255(color: string): [number, number, number] {
  const normalized = isHexColor(color) ? color.slice(1) : "FFFFFF"
  const value = Number.parseInt(normalized, 16)
  return [
    (value >> 16) & 255,
    (value >> 8) & 255,
    value & 255,
  ]
}
