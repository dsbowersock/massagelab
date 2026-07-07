"use client"

import { useEffect, useMemo, useRef } from "react"
import { shouldAnimateAmbientBackground } from "@/lib/motion-preferences"
import { cn } from "@/lib/utils"
import styles from "@/components/backgrounds/BackgroundHost.module.css"
import type { BackgroundEffectProps, MassageLabRippleGridOptions } from "./css-backgrounds"

type ResolvedRippleGridOptions = Required<MassageLabRippleGridOptions>

type RippleGridResources = {
  program: WebGLProgram
  vertexShader: WebGLShader
  fragmentShader: WebGLShader
  vertexBuffer: WebGLBuffer
  attributePosition: number
  uniforms: {
    time: WebGLUniformLocation
    resolution: WebGLUniformLocation
    enableRainbow: WebGLUniformLocation
    gridColor: WebGLUniformLocation
    rippleIntensity: WebGLUniformLocation
    gridSize: WebGLUniformLocation
    gridThickness: WebGLUniformLocation
    fadeDistance: WebGLUniformLocation
    vignetteStrength: WebGLUniformLocation
    glowIntensity: WebGLUniformLocation
    opacity: WebGLUniformLocation
    gridRotation: WebGLUniformLocation
    mouseInteraction: WebGLUniformLocation
    mousePosition: WebGLUniformLocation
    mouseInfluence: WebGLUniformLocation
    mouseInteractionRadius: WebGLUniformLocation
  }
}

const DEFAULT_MASSAGELAB_RIPPLE_GRID: ResolvedRippleGridOptions = {
  enableRainbow: false,
  gridColor: "#FFFFFF",
  rippleIntensity: 0.05,
  gridSize: 10,
  gridThickness: 15,
  fadeDistance: 1.5,
  vignetteStrength: 2,
  glowIntensity: 0.1,
  opacity: 1,
  gridRotation: 0,
  mouseInteraction: true,
  mouseInteractionRadius: 1,
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
uniform float iTime;
uniform vec2 iResolution;
uniform bool enableRainbow;
uniform vec3 gridColor;
uniform float rippleIntensity;
uniform float gridSize;
uniform float gridThickness;
uniform float fadeDistance;
uniform float vignetteStrength;
uniform float glowIntensity;
uniform float opacity;
uniform float gridRotation;
uniform bool mouseInteraction;
uniform vec2 mousePosition;
uniform float mouseInfluence;
uniform float mouseInteractionRadius;
varying vec2 vUv;

float pi = 3.141592;

mat2 rotate(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat2(c, -s, s, c);
}

void main() {
    vec2 uv = vUv * 2.0 - 1.0;
    uv.x *= iResolution.x / iResolution.y;

    if (gridRotation != 0.0) {
        uv = rotate(gridRotation * pi / 180.0) * uv;
    }

    float dist = length(uv);
    float func = sin(pi * (iTime - dist));
    vec2 rippleUv = uv + uv * func * rippleIntensity;

    if (mouseInteraction && mouseInfluence > 0.0) {
        vec2 mouseUv = (mousePosition * 2.0 - 1.0);
        mouseUv.x *= iResolution.x / iResolution.y;
        float mouseDist = length(uv - mouseUv);

        float influence = mouseInfluence * exp(-mouseDist * mouseDist / (mouseInteractionRadius * mouseInteractionRadius));

        float mouseWave = sin(pi * (iTime * 2.0 - mouseDist * 3.0)) * influence;
        rippleUv += normalize(uv - mouseUv) * mouseWave * rippleIntensity * 0.3;
    }

    vec2 a = sin(gridSize * 0.5 * pi * rippleUv - pi / 2.0);
    vec2 b = abs(a);

    float aaWidth = 0.5;
    vec2 smoothB = vec2(
        smoothstep(0.0, aaWidth, b.x),
        smoothstep(0.0, aaWidth, b.y)
    );

    vec3 color = vec3(0.0);
    color += exp(-gridThickness * smoothB.x * (0.8 + 0.5 * sin(pi * iTime)));
    color += exp(-gridThickness * smoothB.y);
    color += 0.5 * exp(-(gridThickness / 4.0) * sin(smoothB.x));
    color += 0.5 * exp(-(gridThickness / 3.0) * smoothB.y);

    if (glowIntensity > 0.0) {
        color += glowIntensity * exp(-gridThickness * 0.5 * smoothB.x);
        color += glowIntensity * exp(-gridThickness * 0.5 * smoothB.y);
    }

    float ddd = exp(-2.0 * clamp(pow(dist, fadeDistance), 0.0, 1.0));

    vec2 vignetteCoords = vUv - 0.5;
    float vignetteDistance = length(vignetteCoords);
    float vignette = 1.0 - pow(vignetteDistance * 2.0, vignetteStrength);
    vignette = clamp(vignette, 0.0, 1.0);

    vec3 t;
    if (enableRainbow) {
        t = vec3(
            uv.x * 0.5 + 0.5 * sin(iTime),
            uv.y * 0.5 + 0.5 * cos(iTime),
            pow(cos(iTime), 4.0)
        ) + 0.5;
    } else {
        t = gridColor;
    }

    float finalFade = ddd * vignette;
    float alpha = length(color) * finalFade * opacity;
    gl_FragColor = vec4(color * t * finalFade * opacity, alpha);
}
`

// MassageLab Ripple Grid is an OGL shader. MassageLab keeps the source ripple
// grid uniforms while replacing the OGL wrapper with raw WebGL and cleanup.
export default function MassageLabRippleGridBackground({
  className,
  massageLabRippleGrid,
}: BackgroundEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const targetMouseRef = useRef<[number, number]>([0.5, 0.5])
  const smoothMouseRef = useRef<[number, number]>([0.5, 0.5])
  const targetInfluenceRef = useRef(0)
  const smoothInfluenceRef = useRef(0)
  const options = useMemo(
    () => resolveRippleGridOptions(massageLabRippleGrid),
    [massageLabRippleGrid],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    const gl = canvas?.getContext("webgl", {
      alpha: true,
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

    const resources = createRippleGridResources(gl)
    if (!resources) {
      return undefined
    }

    gl.clearColor(0, 0, 0, 0)
    gl.disable(gl.DEPTH_TEST)
    gl.disable(gl.CULL_FACE)
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const compactViewportQuery = window.matchMedia("(max-width: 360px), (max-height: 360px)")
    const startTime = performance.now()
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

    const draw = (timestamp: number) => {
      if (disposed) {
        return
      }

      const animate = shouldAnimate()
      const time = animate ? (timestamp - startTime) / 1000 : 0

      if (options.mouseInteraction) {
        const smooth = smoothMouseRef.current
        const target = targetMouseRef.current
        smooth[0] += (target[0] - smooth[0]) * 0.1
        smooth[1] += (target[1] - smooth[1]) * 0.1
        smoothInfluenceRef.current += (targetInfluenceRef.current - smoothInfluenceRef.current) * 0.05
      }

      renderRippleGrid(gl, resources, width, height, time, smoothMouseRef.current, smoothInfluenceRef.current, options)

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
      if (!options.mouseInteraction) {
        return
      }

      const bounds = canvas.getBoundingClientRect()
      const x = (event.clientX - bounds.left) / Math.max(1, bounds.width)
      const y = (event.clientY - bounds.top) / Math.max(1, bounds.height)
      const inside = x >= 0 && x <= 1 && y >= 0 && y <= 1
      targetInfluenceRef.current = inside ? 1 : 0
      if (inside) {
        targetMouseRef.current = [x, 1 - y]
      }
    }

    const resizeObserver = new ResizeObserver(render)
    resizeObserver.observe(canvas)
    window.addEventListener("resize", render, { passive: true })
    document.addEventListener("visibilitychange", render)
    reducedMotionQuery.addEventListener("change", render)
    compactViewportQuery.addEventListener("change", render)
    if (options.mouseInteraction) {
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
      disposeRippleGridResources(gl, resources)
      canvas.width = 1
      canvas.height = 1
    }
  }, [options])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={cn(styles.massageLabRippleGridCanvas, className)}
    />
  )
}

function createRippleGridResources(gl: WebGLRenderingContext): RippleGridResources | null {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource)
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource)
  const program = gl.createProgram()
  const vertexBuffer = gl.createBuffer()
  if (!vertexShader || !fragmentShader || !program || !vertexBuffer) {
    if (vertexShader) gl.deleteShader(vertexShader)
    if (fragmentShader) gl.deleteShader(fragmentShader)
    if (program) gl.deleteProgram(program)
    if (vertexBuffer) gl.deleteBuffer(vertexBuffer)
    return null
  }

  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("MassageLab Ripple Grid program link failed", gl.getProgramInfoLog(program))
    gl.deleteProgram(program)
    gl.deleteBuffer(vertexBuffer)
    gl.deleteShader(vertexShader)
    gl.deleteShader(fragmentShader)
    return null
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
  gl.bindBuffer(gl.ARRAY_BUFFER, null)

  return {
    program,
    vertexShader,
    fragmentShader,
    vertexBuffer,
    attributePosition: gl.getAttribLocation(program, "position"),
    uniforms: {
      time: getUniform(gl, program, "iTime"),
      resolution: getUniform(gl, program, "iResolution"),
      enableRainbow: getUniform(gl, program, "enableRainbow"),
      gridColor: getUniform(gl, program, "gridColor"),
      rippleIntensity: getUniform(gl, program, "rippleIntensity"),
      gridSize: getUniform(gl, program, "gridSize"),
      gridThickness: getUniform(gl, program, "gridThickness"),
      fadeDistance: getUniform(gl, program, "fadeDistance"),
      vignetteStrength: getUniform(gl, program, "vignetteStrength"),
      glowIntensity: getUniform(gl, program, "glowIntensity"),
      opacity: getUniform(gl, program, "opacity"),
      gridRotation: getUniform(gl, program, "gridRotation"),
      mouseInteraction: getUniform(gl, program, "mouseInteraction"),
      mousePosition: getUniform(gl, program, "mousePosition"),
      mouseInfluence: getUniform(gl, program, "mouseInfluence"),
      mouseInteractionRadius: getUniform(gl, program, "mouseInteractionRadius"),
    },
  }
}

function renderRippleGrid(
  gl: WebGLRenderingContext,
  resources: RippleGridResources,
  width: number,
  height: number,
  time: number,
  mouse: [number, number],
  mouseInfluence: number,
  options: ResolvedRippleGridOptions,
) {
  const [red, green, blue] = hexToRgb(options.gridColor)

  gl.useProgram(resources.program)
  gl.bindBuffer(gl.ARRAY_BUFFER, resources.vertexBuffer)
  gl.enableVertexAttribArray(resources.attributePosition)
  gl.vertexAttribPointer(resources.attributePosition, 2, gl.FLOAT, false, 0, 0)

  gl.uniform1f(resources.uniforms.time, time)
  gl.uniform2f(resources.uniforms.resolution, width, height)
  gl.uniform1i(resources.uniforms.enableRainbow, options.enableRainbow ? 1 : 0)
  gl.uniform3f(resources.uniforms.gridColor, red, green, blue)
  gl.uniform1f(resources.uniforms.rippleIntensity, options.rippleIntensity)
  gl.uniform1f(resources.uniforms.gridSize, options.gridSize)
  gl.uniform1f(resources.uniforms.gridThickness, options.gridThickness)
  gl.uniform1f(resources.uniforms.fadeDistance, options.fadeDistance)
  gl.uniform1f(resources.uniforms.vignetteStrength, options.vignetteStrength)
  gl.uniform1f(resources.uniforms.glowIntensity, options.glowIntensity)
  gl.uniform1f(resources.uniforms.opacity, options.opacity)
  gl.uniform1f(resources.uniforms.gridRotation, options.gridRotation)
  gl.uniform1i(resources.uniforms.mouseInteraction, options.mouseInteraction ? 1 : 0)
  gl.uniform2f(resources.uniforms.mousePosition, mouse[0], mouse[1])
  gl.uniform1f(resources.uniforms.mouseInfluence, mouseInfluence)
  gl.uniform1f(resources.uniforms.mouseInteractionRadius, options.mouseInteractionRadius)

  gl.clear(gl.COLOR_BUFFER_BIT)
  gl.drawArrays(gl.TRIANGLES, 0, 3)
  gl.bindBuffer(gl.ARRAY_BUFFER, null)
}

function disposeRippleGridResources(gl: WebGLRenderingContext, resources: RippleGridResources) {
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
    console.error("MassageLab Ripple Grid shader compile failed", gl.getShaderInfoLog(shader))
    gl.deleteShader(shader)
    return null
  }

  return shader
}

function getUniform(gl: WebGLRenderingContext, program: WebGLProgram, name: string): WebGLUniformLocation {
  const location = gl.getUniformLocation(program, name)
  if (!location) {
    throw new Error(`Missing MassageLab Ripple Grid shader uniform: ${name}`)
  }

  return location
}

function resolveRippleGridOptions(options: MassageLabRippleGridOptions | undefined): ResolvedRippleGridOptions {
  return {
    enableRainbow: options?.enableRainbow ?? DEFAULT_MASSAGELAB_RIPPLE_GRID.enableRainbow,
    gridColor: resolveHex(options?.gridColor, DEFAULT_MASSAGELAB_RIPPLE_GRID.gridColor),
    rippleIntensity: resolveNumber(options?.rippleIntensity, DEFAULT_MASSAGELAB_RIPPLE_GRID.rippleIntensity, 0, 0.3),
    gridSize: resolveNumber(options?.gridSize, DEFAULT_MASSAGELAB_RIPPLE_GRID.gridSize, 2, 30),
    gridThickness: resolveNumber(options?.gridThickness, DEFAULT_MASSAGELAB_RIPPLE_GRID.gridThickness, 1, 50),
    fadeDistance: resolveNumber(options?.fadeDistance, DEFAULT_MASSAGELAB_RIPPLE_GRID.fadeDistance, 0.2, 5),
    vignetteStrength: resolveNumber(options?.vignetteStrength, DEFAULT_MASSAGELAB_RIPPLE_GRID.vignetteStrength, 0.1, 6),
    glowIntensity: resolveNumber(options?.glowIntensity, DEFAULT_MASSAGELAB_RIPPLE_GRID.glowIntensity, 0, 1),
    opacity: resolveNumber(options?.opacity, DEFAULT_MASSAGELAB_RIPPLE_GRID.opacity, 0, 1),
    gridRotation: resolveNumber(options?.gridRotation, DEFAULT_MASSAGELAB_RIPPLE_GRID.gridRotation, -180, 180),
    mouseInteraction: options?.mouseInteraction ?? DEFAULT_MASSAGELAB_RIPPLE_GRID.mouseInteraction,
    mouseInteractionRadius: resolveNumber(
      options?.mouseInteractionRadius,
      DEFAULT_MASSAGELAB_RIPPLE_GRID.mouseInteractionRadius,
      0.1,
      5,
    ),
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
