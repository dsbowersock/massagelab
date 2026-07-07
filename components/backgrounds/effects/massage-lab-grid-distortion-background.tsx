"use client"

import { useEffect, useMemo, useRef } from "react"
import { shouldAnimateAmbientBackground } from "@/lib/motion-preferences"
import { cn } from "@/lib/utils"
import styles from "@/components/backgrounds/BackgroundHost.module.css"
import type { BackgroundEffectProps, MassageLabGridDistortionOptions } from "./css-backgrounds"

type ResolvedGridDistortionOptions = Required<MassageLabGridDistortionOptions>

type GridDistortionResources = {
  program: WebGLProgram
  positionBuffer: WebGLBuffer
  uvBuffer: WebGLBuffer
  imageTexture: WebGLTexture
  dataTexture: WebGLTexture
  vertexShader: WebGLShader
  fragmentShader: WebGLShader
  attributes: {
    position: number
    uv: number
  }
  uniforms: {
    imageTexture: WebGLUniformLocation
    dataTexture: WebGLUniformLocation
    resolution: WebGLUniformLocation
    time: WebGLUniformLocation
  }
}

type MouseState = {
  x: number
  y: number
  prevX: number
  prevY: number
  vX: number
  vY: number
  active: boolean
}

const DEFAULT_MASSAGELAB_GRID_DISTORTION: ResolvedGridDistortionOptions = {
  grid: 15,
  mouse: 0.1,
  strength: 0.15,
  relaxation: 0.9,
  colorOne: "#101827",
  colorTwo: "#5B7CFA",
  colorThree: "#F7B7D2",
  cursorInteraction: true,
}

const vertexShaderSource = `
attribute vec2 position;
attribute vec2 uv;
uniform float time;
varying vec2 vUv;
varying vec3 vPosition;

void main() {
  vUv = uv;
  vPosition = vec3(position, 0.0);
  gl_Position = vec4(position, 0.0, 1.0);
}`

const fragmentShaderSource = `
precision highp float;

uniform sampler2D uDataTexture;
uniform sampler2D uTexture;
uniform vec4 resolution;
uniform float time;
varying vec2 vUv;

void main() {
  vec2 uv = vUv + vec2(time, resolution.x) * 0.000000001;
  vec4 offset = texture2D(uDataTexture, vUv);
  gl_FragColor = texture2D(uTexture, uv - 0.02 * offset.rg);
}`

// MassageLab Grid Distortion uses a Three.js plane, image texture, and float
// data texture. This port keeps that shader/data-texture model in raw WebGL.
export default function MassageLabGridDistortionBackground({
  className,
  massageLabGridDistortion,
}: BackgroundEffectProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const options = useMemo(
    () => resolveGridDistortionOptions(massageLabGridDistortion),
    [massageLabGridDistortion],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    const context = canvas?.getContext("webgl", {
      alpha: true,
      antialias: true,
      depth: false,
      powerPreference: "high-performance",
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      stencil: false,
    })

    if (!canvas || !container || !context) {
      return undefined
    }

    const gl = context
    const floatTextureExtension = context.getExtension("OES_texture_float")
    if (!floatTextureExtension) {
      return undefined
    }

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const compactViewportQuery = window.matchMedia("(max-width: 360px), (max-height: 360px)")
    const size = Math.max(2, Math.round(options.grid))
    const data = new Float32Array(4 * size * size)
    const mouseState: MouseState = { x: 0, y: 0, prevX: 0, prevY: 0, vX: 0, vY: 0, active: false }
    let animationFrame = 0
    let resizeFrame = 0
    let disposed = false
    let width = 1
    let height = 1
    let offsetLeft = 0
    let offsetTop = 0
    let resources: GridDistortionResources | null = null

    for (let index = 0; index < size * size; index += 1) {
      data[index * 4] = seededCentered(index * 2) * 255 - 125
      data[index * 4 + 1] = seededCentered(index * 2 + 1) * 255 - 125
    }

    const shouldAnimate = () => shouldAnimateAmbientBackground({
      prefersReducedMotion: reducedMotionQuery.matches,
      compactViewport: compactViewportQuery.matches,
      documentHidden: document.visibilityState !== "visible",
    })

    try {
      resources = createGridDistortionResources(context, options, data, size)
    } catch {
      return undefined
    }

    const resizeNow = () => {
      const bounds = container.getBoundingClientRect()
      width = Math.max(1, bounds.width)
      height = Math.max(1, bounds.height)
      offsetLeft = bounds.left
      offsetTop = bounds.top
      const dpr = Math.min(window.devicePixelRatio || 1, compactViewportQuery.matches ? 1 : 2)
      canvas.width = Math.max(1, Math.floor(width * dpr))
      canvas.height = Math.max(1, Math.floor(height * dpr))
      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      context.viewport(0, 0, canvas.width, canvas.height)
      if (resources) {
        context.useProgram(resources.program)
        context.uniform4f(resources.uniforms.resolution, width, height, 1, 1)
      }
    }

    const queueResize = () => {
      window.cancelAnimationFrame(resizeFrame)
      resizeFrame = window.requestAnimationFrame(() => {
        resizeNow()
        renderFrame(0)
      })
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!options.cursorInteraction || width <= 0 || height <= 0) {
        return
      }

      const x = (event.clientX - offsetLeft) / width
      const y = 1 - (event.clientY - offsetTop) / height
      if (x < 0 || x > 1 || y < 0 || y > 1) {
        mouseState.active = false
        return
      }

      mouseState.vX = x - mouseState.prevX
      mouseState.vY = y - mouseState.prevY
      mouseState.x = x
      mouseState.y = y
      mouseState.prevX = x
      mouseState.prevY = y
      mouseState.active = true
    }

    const handlePointerLeave = () => {
      mouseState.x = 0
      mouseState.y = 0
      mouseState.prevX = 0
      mouseState.prevY = 0
      mouseState.vX = 0
      mouseState.vY = 0
      mouseState.active = false
    }

    const updateDataTexture = () => {
      for (let index = 0; index < size * size; index += 1) {
        data[index * 4] *= options.relaxation
        data[index * 4 + 1] *= options.relaxation
      }

      if (options.cursorInteraction && mouseState.active) {
        const gridMouseX = size * mouseState.x
        const gridMouseY = size * mouseState.y
        const maxDist = size * options.mouse

        for (let i = 0; i < size; i += 1) {
          for (let j = 0; j < size; j += 1) {
            const distSq = (gridMouseX - i) ** 2 + (gridMouseY - j) ** 2
            if (distSq < maxDist * maxDist) {
              const index = 4 * (i + size * j)
              const power = Math.min(maxDist / Math.max(Math.sqrt(distSq), 0.0001), 10)
              data[index] += options.strength * 100 * mouseState.vX * power
              data[index + 1] -= options.strength * 100 * mouseState.vY * power
            }
          }
        }
      }

      context.activeTexture(context.TEXTURE1)
      context.bindTexture(context.TEXTURE_2D, resources?.dataTexture ?? null)
      context.texSubImage2D(context.TEXTURE_2D, 0, 0, 0, size, size, context.RGBA, context.FLOAT, data)
    }

    function renderFrame(time: number) {
      if (!resources) {
        return
      }

      const animate = shouldAnimate()
      if (animate) {
        updateDataTexture()
      }

      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.useProgram(resources.program)
      gl.uniform1f(resources.uniforms.time, time * 0.0008)
      gl.activeTexture(gl.TEXTURE0)
      gl.bindTexture(gl.TEXTURE_2D, resources.imageTexture)
      gl.uniform1i(resources.uniforms.imageTexture, 0)
      gl.activeTexture(gl.TEXTURE1)
      gl.bindTexture(gl.TEXTURE_2D, resources.dataTexture)
      gl.uniform1i(resources.uniforms.dataTexture, 1)
      gl.bindBuffer(gl.ARRAY_BUFFER, resources.positionBuffer)
      gl.enableVertexAttribArray(resources.attributes.position)
      gl.vertexAttribPointer(resources.attributes.position, 2, gl.FLOAT, false, 0, 0)
      gl.bindBuffer(gl.ARRAY_BUFFER, resources.uvBuffer)
      gl.enableVertexAttribArray(resources.attributes.uv)
      gl.vertexAttribPointer(resources.attributes.uv, 2, gl.FLOAT, false, 0, 0)
      gl.drawArrays(gl.TRIANGLES, 0, 6)

      if (animate && !disposed) {
        animationFrame = window.requestAnimationFrame(renderFrame)
      }
    }

    const render = () => {
      window.cancelAnimationFrame(animationFrame)
      renderFrame(0)
    }

    resizeNow()
    const resizeObserver = new ResizeObserver(queueResize)
    resizeObserver.observe(container)
    window.addEventListener("resize", queueResize, { passive: true })
    document.addEventListener("visibilitychange", render)
    reducedMotionQuery.addEventListener("change", render)
    compactViewportQuery.addEventListener("change", queueResize)
    if (options.cursorInteraction) {
      window.addEventListener("pointermove", handlePointerMove, { passive: true })
      window.addEventListener("pointerleave", handlePointerLeave, { passive: true })
    }
    renderFrame(0)

    return () => {
      disposed = true
      window.cancelAnimationFrame(animationFrame)
      window.cancelAnimationFrame(resizeFrame)
      resizeObserver.disconnect()
      window.removeEventListener("resize", queueResize)
      document.removeEventListener("visibilitychange", render)
      reducedMotionQuery.removeEventListener("change", render)
      compactViewportQuery.removeEventListener("change", queueResize)
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerleave", handlePointerLeave)
      if (resources) {
        context.deleteBuffer(resources.positionBuffer)
        context.deleteBuffer(resources.uvBuffer)
        context.deleteTexture(resources.imageTexture)
        context.deleteTexture(resources.dataTexture)
        context.deleteProgram(resources.program)
        context.deleteShader(resources.vertexShader)
        context.deleteShader(resources.fragmentShader)
      }
      canvas.width = 1
      canvas.height = 1
    }
  }, [options])

  return (
    <div className={cn(styles.effectLayer, styles.massageLabGridDistortion, className)} ref={containerRef}>
      <canvas className={styles.massageLabGridDistortionCanvas} ref={canvasRef} />
    </div>
  )
}

function createGridDistortionResources(
  context: WebGLRenderingContext,
  options: ResolvedGridDistortionOptions,
  data: Float32Array,
  size: number,
): GridDistortionResources {
  const vertexShader = compileShader(context, context.VERTEX_SHADER, vertexShaderSource)
  const fragmentShader = compileShader(context, context.FRAGMENT_SHADER, fragmentShaderSource)
  const program = context.createProgram()
  if (!program) {
    throw new Error("Unable to create MassageLab Grid Distortion program")
  }

  context.attachShader(program, vertexShader)
  context.attachShader(program, fragmentShader)
  context.linkProgram(program)
  if (!context.getProgramParameter(program, context.LINK_STATUS)) {
    throw new Error(context.getProgramInfoLog(program) ?? "Unable to link MassageLab Grid Distortion program")
  }

  const positionBuffer = createBuffer(context, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]))
  const uvBuffer = createBuffer(context, new Float32Array([0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 1, 1]))
  const imageTexture = createImageTexture(context, options)
  const dataTexture = context.createTexture()
  if (!dataTexture) {
    throw new Error("Unable to create MassageLab Grid Distortion data texture")
  }

  context.bindTexture(context.TEXTURE_2D, dataTexture)
  context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MIN_FILTER, context.NEAREST)
  context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MAG_FILTER, context.NEAREST)
  context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_S, context.CLAMP_TO_EDGE)
  context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_T, context.CLAMP_TO_EDGE)
  context.texImage2D(context.TEXTURE_2D, 0, context.RGBA, size, size, 0, context.RGBA, context.FLOAT, data)

  return {
    program,
    positionBuffer,
    uvBuffer,
    imageTexture,
    dataTexture,
    vertexShader,
    fragmentShader,
    attributes: {
      position: context.getAttribLocation(program, "position"),
      uv: context.getAttribLocation(program, "uv"),
    },
    uniforms: {
      imageTexture: getUniformLocation(context, program, "uTexture"),
      dataTexture: getUniformLocation(context, program, "uDataTexture"),
      resolution: getUniformLocation(context, program, "resolution"),
      time: getUniformLocation(context, program, "time"),
    },
  }
}

function createImageTexture(context: WebGLRenderingContext, options: ResolvedGridDistortionOptions) {
  const textureCanvas = document.createElement("canvas")
  textureCanvas.width = 512
  textureCanvas.height = 512
  const textureContext = textureCanvas.getContext("2d")
  if (!textureContext) {
    throw new Error("Unable to create MassageLab Grid Distortion image texture canvas")
  }

  const gradient = textureContext.createLinearGradient(0, 0, 512, 512)
  gradient.addColorStop(0, options.colorOne)
  gradient.addColorStop(0.52, options.colorTwo)
  gradient.addColorStop(1, options.colorThree)
  textureContext.fillStyle = gradient
  textureContext.fillRect(0, 0, 512, 512)
  textureContext.globalAlpha = 0.32
  for (let index = 0; index < 22; index += 1) {
    const x = seededCentered(index * 3 + 5) * 512
    const y = seededCentered(index * 3 + 6) * 512
    const radius = 28 + seededCentered(index * 3 + 7) * 110
    const glow = textureContext.createRadialGradient(x, y, 0, x, y, radius)
    glow.addColorStop(0, "rgba(255,255,255,0.75)")
    glow.addColorStop(1, "rgba(255,255,255,0)")
    textureContext.fillStyle = glow
    textureContext.beginPath()
    textureContext.arc(x, y, radius, 0, Math.PI * 2)
    textureContext.fill()
  }

  const texture = context.createTexture()
  if (!texture) {
    throw new Error("Unable to create MassageLab Grid Distortion image texture")
  }

  context.bindTexture(context.TEXTURE_2D, texture)
  context.pixelStorei(context.UNPACK_FLIP_Y_WEBGL, 0)
  context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MIN_FILTER, context.LINEAR)
  context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MAG_FILTER, context.LINEAR)
  context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_S, context.CLAMP_TO_EDGE)
  context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_T, context.CLAMP_TO_EDGE)
  context.texImage2D(context.TEXTURE_2D, 0, context.RGBA, context.RGBA, context.UNSIGNED_BYTE, textureCanvas)
  return texture
}

function createBuffer(context: WebGLRenderingContext, data: Float32Array) {
  const buffer = context.createBuffer()
  if (!buffer) {
    throw new Error("Unable to create MassageLab Grid Distortion buffer")
  }
  context.bindBuffer(context.ARRAY_BUFFER, buffer)
  context.bufferData(context.ARRAY_BUFFER, data, context.STATIC_DRAW)
  return buffer
}

function compileShader(context: WebGLRenderingContext, type: number, source: string) {
  const shader = context.createShader(type)
  if (!shader) {
    throw new Error("Unable to create MassageLab Grid Distortion shader")
  }
  context.shaderSource(shader, source)
  context.compileShader(shader)
  if (!context.getShaderParameter(shader, context.COMPILE_STATUS)) {
    throw new Error(context.getShaderInfoLog(shader) ?? "Unable to compile MassageLab Grid Distortion shader")
  }
  return shader
}

function getUniformLocation(context: WebGLRenderingContext, program: WebGLProgram, name: string) {
  const location = context.getUniformLocation(program, name)
  if (!location) {
    throw new Error(`Missing MassageLab Grid Distortion uniform: ${name}`)
  }
  return location
}

function resolveGridDistortionOptions(options?: MassageLabGridDistortionOptions): ResolvedGridDistortionOptions {
  return {
    grid: Math.round(resolveNumber(options?.grid, DEFAULT_MASSAGELAB_GRID_DISTORTION.grid, 4, 40)),
    mouse: resolveNumber(options?.mouse, DEFAULT_MASSAGELAB_GRID_DISTORTION.mouse, 0.02, 0.5),
    strength: resolveNumber(options?.strength, DEFAULT_MASSAGELAB_GRID_DISTORTION.strength, 0, 0.6),
    relaxation: resolveNumber(options?.relaxation, DEFAULT_MASSAGELAB_GRID_DISTORTION.relaxation, 0.75, 0.99),
    colorOne: resolveHex(options?.colorOne, DEFAULT_MASSAGELAB_GRID_DISTORTION.colorOne),
    colorTwo: resolveHex(options?.colorTwo, DEFAULT_MASSAGELAB_GRID_DISTORTION.colorTwo),
    colorThree: resolveHex(options?.colorThree, DEFAULT_MASSAGELAB_GRID_DISTORTION.colorThree),
    cursorInteraction: options?.cursorInteraction ?? DEFAULT_MASSAGELAB_GRID_DISTORTION.cursorInteraction,
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

function seededCentered(index: number) {
  const value = Math.sin(index * 12.9898 + 78.233) * 43_758.5453
  return value - Math.floor(value)
}
