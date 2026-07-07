"use client"

import { useEffect, useMemo, useRef } from "react"
import { shouldAnimateAmbientBackground } from "@/lib/motion-preferences"
import { cn } from "@/lib/utils"
import styles from "@/components/backgrounds/BackgroundHost.module.css"
import type { BackgroundEffectProps, MassageLabDitherOptions } from "./css-backgrounds"

type ResolvedDitherOptions = Required<MassageLabDitherOptions>

type DitherResources = {
  vertexBuffer: WebGLBuffer
  waveProgram: WebGLProgram
  waveVertexShader: WebGLShader
  waveFragmentShader: WebGLShader
  ditherProgram: WebGLProgram
  ditherVertexShader: WebGLShader
  ditherFragmentShader: WebGLShader
  framebuffer: WebGLFramebuffer
  texture: WebGLTexture
  width: number
  height: number
  uniforms: {
    waveResolution: WebGLUniformLocation
    time: WebGLUniformLocation
    waveSpeed: WebGLUniformLocation
    waveFrequency: WebGLUniformLocation
    waveAmplitude: WebGLUniformLocation
    waveColor: WebGLUniformLocation
    mousePos: WebGLUniformLocation
    enableMouseInteraction: WebGLUniformLocation
    mouseRadius: WebGLUniformLocation
    inputBuffer: WebGLUniformLocation
    ditherResolution: WebGLUniformLocation
    colorNum: WebGLUniformLocation
    pixelSize: WebGLUniformLocation
  }
}

const DEFAULT_MASSAGELAB_DITHER: ResolvedDitherOptions = {
  color: "#808080",
  waveSpeed: 0.05,
  waveFrequency: 3,
  waveAmplitude: 0.3,
  colorNum: 4,
  pixelSize: 2,
  mouseInteraction: true,
  mouseRadius: 1,
}

const vertexShaderSource = `
#version 300 es
precision highp float;
in vec2 position;
out vec2 vUv;

void main() {
  vUv = position * 0.5 + 0.5;
  gl_Position = vec4(position, 0.0, 1.0);
}
`

const waveFragmentShaderSource = `
#version 300 es
precision highp float;
precision highp int;
uniform vec2 resolution;
uniform float time;
uniform float waveSpeed;
uniform float waveFrequency;
uniform float waveAmplitude;
uniform vec3 waveColor;
uniform vec2 mousePos;
uniform int enableMouseInteraction;
uniform float mouseRadius;
out vec4 fragColor;

vec4 mod289(vec4 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
vec2 fade(vec2 t) { return t*t*t*(t*(t*6.0-15.0)+10.0); }

float cnoise(vec2 P) {
  vec4 Pi = floor(P.xyxy) + vec4(0.0,0.0,1.0,1.0);
  vec4 Pf = fract(P.xyxy) - vec4(0.0,0.0,1.0,1.0);
  Pi = mod289(Pi);
  vec4 ix = Pi.xzxz;
  vec4 iy = Pi.yyww;
  vec4 fx = Pf.xzxz;
  vec4 fy = Pf.yyww;
  vec4 i = permute(permute(ix) + iy);
  vec4 gx = fract(i * (1.0/41.0)) * 2.0 - 1.0;
  vec4 gy = abs(gx) - 0.5;
  vec4 tx = floor(gx + 0.5);
  gx = gx - tx;
  vec2 g00 = vec2(gx.x, gy.x);
  vec2 g10 = vec2(gx.y, gy.y);
  vec2 g01 = vec2(gx.z, gy.z);
  vec2 g11 = vec2(gx.w, gy.w);
  vec4 norm = taylorInvSqrt(vec4(dot(g00,g00), dot(g01,g01), dot(g10,g10), dot(g11,g11)));
  g00 *= norm.x; g01 *= norm.y; g10 *= norm.z; g11 *= norm.w;
  float n00 = dot(g00, vec2(fx.x, fy.x));
  float n10 = dot(g10, vec2(fx.y, fy.y));
  float n01 = dot(g01, vec2(fx.z, fy.z));
  float n11 = dot(g11, vec2(fx.w, fy.w));
  vec2 fade_xy = fade(Pf.xy);
  vec2 n_x = mix(vec2(n00, n01), vec2(n10, n11), fade_xy.x);
  return 2.3 * mix(n_x.x, n_x.y, fade_xy.y);
}

const int OCTAVES = 4;
float fbm(vec2 p) {
  float value = 0.0;
  float amp = 1.0;
  float freq = waveFrequency;
  for (int i = 0; i < OCTAVES; i++) {
    value += amp * abs(cnoise(p));
    p *= freq;
    amp *= waveAmplitude;
  }
  return value;
}

float pattern(vec2 p) {
  vec2 p2 = p - time * waveSpeed;
  return fbm(p + fbm(p2));
}

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  uv -= 0.5;
  uv.x *= resolution.x / resolution.y;
  float f = pattern(uv);
  if (enableMouseInteraction == 1) {
    vec2 mouseNDC = (mousePos / resolution - 0.5) * vec2(1.0, -1.0);
    mouseNDC.x *= resolution.x / resolution.y;
    float dist = length(uv - mouseNDC);
    float effect = 1.0 - smoothstep(0.0, mouseRadius, dist);
    f -= 0.5 * effect;
  }
  vec3 col = mix(vec3(0.0), waveColor, f);
  fragColor = vec4(col, 1.0);
}
`

const ditherFragmentShaderSource = `
#version 300 es
precision highp float;
precision highp int;
uniform sampler2D inputBuffer;
uniform vec2 resolution;
uniform float colorNum;
uniform float pixelSize;
in vec2 vUv;
out vec4 fragColor;

const float bayerMatrix8x8[64] = float[64](
  0.0/64.0, 48.0/64.0, 12.0/64.0, 60.0/64.0,  3.0/64.0, 51.0/64.0, 15.0/64.0, 63.0/64.0,
  32.0/64.0,16.0/64.0, 44.0/64.0, 28.0/64.0, 35.0/64.0,19.0/64.0, 47.0/64.0, 31.0/64.0,
  8.0/64.0, 56.0/64.0,  4.0/64.0, 52.0/64.0, 11.0/64.0,59.0/64.0,  7.0/64.0, 55.0/64.0,
  40.0/64.0,24.0/64.0, 36.0/64.0, 20.0/64.0, 43.0/64.0,27.0/64.0, 39.0/64.0, 23.0/64.0,
  2.0/64.0, 50.0/64.0, 14.0/64.0, 62.0/64.0,  1.0/64.0,49.0/64.0, 13.0/64.0, 61.0/64.0,
  34.0/64.0,18.0/64.0, 46.0/64.0, 30.0/64.0, 33.0/64.0,17.0/64.0, 45.0/64.0, 29.0/64.0,
  10.0/64.0,58.0/64.0,  6.0/64.0, 54.0/64.0,  9.0/64.0,57.0/64.0,  5.0/64.0, 53.0/64.0,
  42.0/64.0,26.0/64.0, 38.0/64.0, 22.0/64.0, 41.0/64.0,25.0/64.0, 37.0/64.0, 21.0/64.0
);

vec3 dither(vec2 uv, vec3 color) {
  vec2 scaledCoord = floor(uv * resolution / pixelSize);
  int x = int(mod(scaledCoord.x, 8.0));
  int y = int(mod(scaledCoord.y, 8.0));
  float threshold = bayerMatrix8x8[y * 8 + x] - 0.25;
  float step = 1.0 / (colorNum - 1.0);
  color += threshold * step;
  float bias = 0.2;
  color = clamp(color - bias, 0.0, 1.0);
  return floor(color * (colorNum - 1.0) + 0.5) / (colorNum - 1.0);
}

void main() {
  vec2 normalizedPixelSize = vec2(pixelSize) / resolution;
  vec2 uvPixel = normalizedPixelSize * floor(vUv / normalizedPixelSize);
  vec4 color = texture(inputBuffer, uvPixel);
  color.rgb = dither(vUv, color.rgb);
  fragColor = color;
}
`

// MassageLab Dither combines a wave/noise shader with a Bayer dither postprocess.
// MassageLab keeps that two-pass shape while owning the WebGL framebuffer cleanup.
export default function MassageLabDitherBackground({
  className,
  massageLabDither,
}: BackgroundEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const mouseRef = useRef<[number, number]>([0, 0])
  const options = useMemo(
    () => resolveDitherOptions(massageLabDither),
    [massageLabDither],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    const gl = canvas?.getContext("webgl2", {
      alpha: false,
      antialias: true,
      depth: false,
      powerPreference: "high-performance",
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      stencil: false,
    })

    if (!canvas || !gl) {
      return undefined
    }

    const resources = createDitherResources(gl)
    if (!resources) {
      return undefined
    }

    let animationFrame = 0
    let disposed = false
    let startTime = performance.now()
    const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const compactViewportQuery = window.matchMedia("(max-width: 640px)")
    let resizeObserver: ResizeObserver | null = null
    let animate = shouldAnimateAmbientBackground({
      prefersReducedMotion: motionQuery.matches,
      compactViewport: compactViewportQuery.matches,
      documentHidden: document.visibilityState !== "visible",
    })

    const resolveAnimate = () => {
      animate = shouldAnimateAmbientBackground({
        prefersReducedMotion: motionQuery.matches,
        compactViewport: compactViewportQuery.matches,
        documentHidden: document.visibilityState !== "visible",
      })
    }

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      const width = Math.max(1, Math.floor(rect.width * dpr))
      const height = Math.max(1, Math.floor(rect.height * dpr))
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width
        canvas.height = height
      }
      resizeDitherTarget(gl, resources, width, height)
    }

    const render = (timestamp: number) => {
      if (disposed) {
        return
      }

      const elapsedSeconds = animate ? (timestamp - startTime) / 1000 : 0
      renderDither(gl, resources, elapsedSeconds, mouseRef.current, options)

      if (animate) {
        animationFrame = window.requestAnimationFrame(render)
      }
    }

    const requestRender = () => {
      if (animationFrame === 0) {
        animationFrame = window.requestAnimationFrame((timestamp) => {
          animationFrame = 0
          render(timestamp)
        })
      }
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!options.mouseInteraction) {
        return
      }

      const rect = canvas.getBoundingClientRect()
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
      mouseRef.current = [
        Math.max(0, Math.min(rect.width, event.clientX - rect.left)) * dpr,
        Math.max(0, Math.min(rect.height, event.clientY - rect.top)) * dpr,
      ]

      if (!animate) {
        requestRender()
      }
    }

    const handleVisibilityChange = () => {
      resolveAnimate()
      if (document.hidden) {
        window.cancelAnimationFrame(animationFrame)
        animationFrame = 0
        return
      }
      startTime = performance.now()
      requestRender()
    }

    const handleResize = () => {
      resize()
      requestRender()
    }

    motionQuery.addEventListener("change", handleVisibilityChange)
    compactViewportQuery.addEventListener("change", handleVisibilityChange)

    resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(canvas)
    window.addEventListener("resize", handleResize)
    window.addEventListener("pointermove", handlePointerMove, { passive: true })
    document.addEventListener("visibilitychange", handleVisibilityChange)

    resize()
    render(startTime)

    return () => {
      disposed = true
      window.cancelAnimationFrame(animationFrame)
      resizeObserver?.disconnect()
      window.removeEventListener("resize", handleResize)
      window.removeEventListener("pointermove", handlePointerMove)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      motionQuery.removeEventListener("change", handleVisibilityChange)
      compactViewportQuery.removeEventListener("change", handleVisibilityChange)
      disposeDitherResources(gl, resources)
      canvas.width = 0
      canvas.height = 0
    }
  }, [options])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn(styles.massageLabDitherCanvas, className)}
    />
  )
}

function createDitherResources(gl: WebGL2RenderingContext): DitherResources | null {
  const waveVertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource)
  const waveFragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, waveFragmentShaderSource)
  const ditherVertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource)
  const ditherFragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, ditherFragmentShaderSource)
  if (!waveVertexShader || !waveFragmentShader || !ditherVertexShader || !ditherFragmentShader) {
    return null
  }

  const waveProgram = linkProgram(gl, waveVertexShader, waveFragmentShader)
  const ditherProgram = linkProgram(gl, ditherVertexShader, ditherFragmentShader)
  const vertexBuffer = gl.createBuffer()
  const framebuffer = gl.createFramebuffer()
  const texture = gl.createTexture()
  if (!waveProgram || !ditherProgram || !vertexBuffer || !framebuffer || !texture) {
    return null
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  )
  gl.bindBuffer(gl.ARRAY_BUFFER, null)

  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.bindTexture(gl.TEXTURE_2D, null)

  return {
    vertexBuffer,
    waveProgram,
    waveVertexShader,
    waveFragmentShader,
    ditherProgram,
    ditherVertexShader,
    ditherFragmentShader,
    framebuffer,
    texture,
    width: 0,
    height: 0,
    uniforms: {
      waveResolution: getUniform(gl, waveProgram, "resolution"),
      time: getUniform(gl, waveProgram, "time"),
      waveSpeed: getUniform(gl, waveProgram, "waveSpeed"),
      waveFrequency: getUniform(gl, waveProgram, "waveFrequency"),
      waveAmplitude: getUniform(gl, waveProgram, "waveAmplitude"),
      waveColor: getUniform(gl, waveProgram, "waveColor"),
      mousePos: getUniform(gl, waveProgram, "mousePos"),
      enableMouseInteraction: getUniform(gl, waveProgram, "enableMouseInteraction"),
      mouseRadius: getUniform(gl, waveProgram, "mouseRadius"),
      inputBuffer: getUniform(gl, ditherProgram, "inputBuffer"),
      ditherResolution: getUniform(gl, ditherProgram, "resolution"),
      colorNum: getUniform(gl, ditherProgram, "colorNum"),
      pixelSize: getUniform(gl, ditherProgram, "pixelSize"),
    },
  }
}

function resizeDitherTarget(
  gl: WebGL2RenderingContext,
  resources: DitherResources,
  width: number,
  height: number,
) {
  if (resources.width === width && resources.height === height) {
    return
  }

  resources.width = width
  resources.height = height
  gl.bindTexture(gl.TEXTURE_2D, resources.texture)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
  gl.bindFramebuffer(gl.FRAMEBUFFER, resources.framebuffer)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, resources.texture, 0)
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  gl.bindTexture(gl.TEXTURE_2D, null)
}

function renderDither(
  gl: WebGL2RenderingContext,
  resources: DitherResources,
  elapsedSeconds: number,
  mouse: [number, number],
  options: ResolvedDitherOptions,
) {
  const [red, green, blue] = hexToRgb(options.color)

  gl.disable(gl.DEPTH_TEST)
  gl.disable(gl.BLEND)
  gl.bindBuffer(gl.ARRAY_BUFFER, resources.vertexBuffer)

  gl.bindFramebuffer(gl.FRAMEBUFFER, resources.framebuffer)
  gl.viewport(0, 0, resources.width, resources.height)
  gl.useProgram(resources.waveProgram)
  enablePositionAttribute(gl, resources.waveProgram)
  gl.uniform2f(resources.uniforms.waveResolution, resources.width, resources.height)
  gl.uniform1f(resources.uniforms.time, elapsedSeconds)
  gl.uniform1f(resources.uniforms.waveSpeed, options.waveSpeed)
  gl.uniform1f(resources.uniforms.waveFrequency, options.waveFrequency)
  gl.uniform1f(resources.uniforms.waveAmplitude, options.waveAmplitude)
  gl.uniform3f(resources.uniforms.waveColor, red, green, blue)
  gl.uniform2f(resources.uniforms.mousePos, mouse[0], mouse[1])
  gl.uniform1i(resources.uniforms.enableMouseInteraction, options.mouseInteraction ? 1 : 0)
  gl.uniform1f(resources.uniforms.mouseRadius, options.mouseRadius)
  gl.clearColor(0, 0, 0, 1)
  gl.clear(gl.COLOR_BUFFER_BIT)
  gl.drawArrays(gl.TRIANGLES, 0, 3)

  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  gl.viewport(0, 0, resources.width, resources.height)
  gl.useProgram(resources.ditherProgram)
  enablePositionAttribute(gl, resources.ditherProgram)
  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, resources.texture)
  gl.uniform1i(resources.uniforms.inputBuffer, 0)
  gl.uniform2f(resources.uniforms.ditherResolution, resources.width, resources.height)
  gl.uniform1f(resources.uniforms.colorNum, options.colorNum)
  gl.uniform1f(resources.uniforms.pixelSize, options.pixelSize)
  gl.drawArrays(gl.TRIANGLES, 0, 3)
  gl.bindTexture(gl.TEXTURE_2D, null)
  gl.bindBuffer(gl.ARRAY_BUFFER, null)
}

function disposeDitherResources(gl: WebGL2RenderingContext, resources: DitherResources) {
  gl.deleteTexture(resources.texture)
  gl.deleteFramebuffer(resources.framebuffer)
  gl.deleteBuffer(resources.vertexBuffer)
  gl.deleteProgram(resources.waveProgram)
  gl.deleteShader(resources.waveVertexShader)
  gl.deleteShader(resources.waveFragmentShader)
  gl.deleteProgram(resources.ditherProgram)
  gl.deleteShader(resources.ditherVertexShader)
  gl.deleteShader(resources.ditherFragmentShader)
}

function compileShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type)
  if (!shader) {
    return null
  }

  // WebGL2 requires `#version` to be the first bytes in the submitted shader.
  gl.shaderSource(shader, source.trimStart())
  gl.compileShader(shader)

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error("MassageLab Dither shader compile failed", gl.getShaderInfoLog(shader))
    gl.deleteShader(shader)
    return null
  }

  return shader
}

function linkProgram(
  gl: WebGL2RenderingContext,
  vertexShader: WebGLShader,
  fragmentShader: WebGLShader,
): WebGLProgram | null {
  const program = gl.createProgram()
  if (!program) {
    return null
  }

  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("MassageLab Dither program link failed", gl.getProgramInfoLog(program))
    gl.deleteProgram(program)
    return null
  }

  return program
}

function enablePositionAttribute(gl: WebGL2RenderingContext, program: WebGLProgram) {
  const position = gl.getAttribLocation(program, "position")
  if (position < 0) {
    return
  }

  gl.enableVertexAttribArray(position)
  gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)
}

function getUniform(gl: WebGL2RenderingContext, program: WebGLProgram, name: string): WebGLUniformLocation {
  const location = gl.getUniformLocation(program, name)
  if (!location) {
    throw new Error(`Missing MassageLab Dither shader uniform: ${name}`)
  }

  return location
}

function resolveDitherOptions(options: MassageLabDitherOptions | undefined): ResolvedDitherOptions {
  return {
    color: resolveHex(options?.color, DEFAULT_MASSAGELAB_DITHER.color),
    waveSpeed: resolveNumber(options?.waveSpeed, DEFAULT_MASSAGELAB_DITHER.waveSpeed, 0, 0.5),
    waveFrequency: resolveNumber(options?.waveFrequency, DEFAULT_MASSAGELAB_DITHER.waveFrequency, 0.5, 8),
    waveAmplitude: resolveNumber(options?.waveAmplitude, DEFAULT_MASSAGELAB_DITHER.waveAmplitude, 0, 1),
    colorNum: Math.round(resolveNumber(options?.colorNum, DEFAULT_MASSAGELAB_DITHER.colorNum, 2, 16)),
    pixelSize: resolveNumber(options?.pixelSize, DEFAULT_MASSAGELAB_DITHER.pixelSize, 1, 24),
    mouseInteraction: options?.mouseInteraction ?? DEFAULT_MASSAGELAB_DITHER.mouseInteraction,
    mouseRadius: resolveNumber(options?.mouseRadius, DEFAULT_MASSAGELAB_DITHER.mouseRadius, 0.05, 3),
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
  const red = parseInt(value.slice(0, 2), 16) / 255
  const green = parseInt(value.slice(2, 4), 16) / 255
  const blue = parseInt(value.slice(4, 6), 16) / 255
  return [red, green, blue]
}
