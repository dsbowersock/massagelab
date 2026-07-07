"use client"

import { useEffect, useMemo, useRef } from "react"
import { shouldAnimateAmbientBackground } from "@/lib/motion-preferences"
import { cn } from "@/lib/utils"
import styles from "@/components/backgrounds/BackgroundHost.module.css"
import type { BackgroundEffectProps, MassageLabLightRaysOptions } from "./css-backgrounds"

type RgbColor = [number, number, number]
type LightRaysOrigin = NonNullable<MassageLabLightRaysOptions["raysOrigin"]>
type ResolvedLightRaysOptions = Required<MassageLabLightRaysOptions>

type LightRaysResources = {
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
    rayPosition: WebGLUniformLocation
    rayDirection: WebGLUniformLocation
    color: WebGLUniformLocation
    speed: WebGLUniformLocation
    spread: WebGLUniformLocation
    length: WebGLUniformLocation
    pulsating: WebGLUniformLocation
    fadeDistance: WebGLUniformLocation
    saturation: WebGLUniformLocation
    mousePosition: WebGLUniformLocation
    mouseInfluence: WebGLUniformLocation
    noiseAmount: WebGLUniformLocation
    distortion: WebGLUniformLocation
  }
}

const DEFAULT_MASSAGELAB_LIGHT_RAYS: ResolvedLightRaysOptions = {
  raysOrigin: "top-center",
  raysColor: "#FFFFFF",
  raysSpeed: 1,
  lightSpread: 1,
  rayLength: 2,
  pulsating: false,
  fadeDistance: 1,
  saturation: 1,
  followMouse: false,
  mouseInfluence: 0.1,
  noiseAmount: 0,
  distortion: 0,
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
  precision highp float;

  uniform float iTime;
  uniform vec2 iResolution;
  uniform vec2 rayPos;
  uniform vec2 rayDir;
  uniform vec3 raysColor;
  uniform float raysSpeed;
  uniform float lightSpread;
  uniform float rayLength;
  uniform float pulsating;
  uniform float fadeDistance;
  uniform float saturation;
  uniform vec2 mousePos;
  uniform float mouseInfluence;
  uniform float noiseAmount;
  uniform float distortion;

  varying vec2 vUv;

  float noise(vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
  }

  float rayStrength(vec2 raySource, vec2 rayRefDirection, vec2 coord, float seedA, float seedB, float speed) {
    vec2 sourceToCoord = coord - raySource;
    vec2 dirNorm = normalize(sourceToCoord);
    float cosAngle = dot(dirNorm, rayRefDirection);
    float distortedAngle = cosAngle + distortion * sin(iTime * 2.0 + length(sourceToCoord) * 0.01) * 0.2;
    float spreadFactor = pow(max(distortedAngle, 0.0), 1.0 / max(lightSpread, 0.001));
    float distance = length(sourceToCoord);
    float maxDistance = iResolution.x * rayLength;
    float lengthFalloff = clamp((maxDistance - distance) / maxDistance, 0.0, 1.0);
    float fadeFalloff = clamp(
      (iResolution.x * fadeDistance - distance) / (iResolution.x * fadeDistance),
      0.5,
      1.0
    );
    float pulse = pulsating > 0.5 ? (0.8 + 0.2 * sin(iTime * speed * 3.0)) : 1.0;
    float baseStrength = clamp(
      (0.45 + 0.15 * sin(distortedAngle * seedA + iTime * speed)) +
      (0.3 + 0.2 * cos(-distortedAngle * seedB + iTime * speed)),
      0.0,
      1.0
    );

    return baseStrength * lengthFalloff * fadeFalloff * spreadFactor * pulse;
  }

  void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 coord = vec2(fragCoord.x, iResolution.y - fragCoord.y);
    vec2 finalRayDir = rayDir;

    if (mouseInfluence > 0.0) {
      vec2 mouseScreenPos = mousePos * iResolution.xy;
      vec2 mouseDirection = normalize(mouseScreenPos - rayPos);
      finalRayDir = normalize(mix(rayDir, mouseDirection, mouseInfluence));
    }

    vec4 rays1 = vec4(1.0) * rayStrength(rayPos, finalRayDir, coord, 36.2214, 21.11349, 1.5 * raysSpeed);
    vec4 rays2 = vec4(1.0) * rayStrength(rayPos, finalRayDir, coord, 22.3991, 18.0234, 1.1 * raysSpeed);
    fragColor = rays1 * 0.5 + rays2 * 0.4;

    if (noiseAmount > 0.0) {
      float n = noise(coord * 0.01 + iTime * 0.1);
      fragColor.rgb *= (1.0 - noiseAmount + noiseAmount * n);
    }

    float brightness = 1.0 - (coord.y / iResolution.y);
    fragColor.x *= 0.1 + brightness * 0.8;
    fragColor.y *= 0.3 + brightness * 0.6;
    fragColor.z *= 0.5 + brightness * 0.5;

    if (saturation != 1.0) {
      float gray = dot(fragColor.rgb, vec3(0.299, 0.587, 0.114));
      fragColor.rgb = mix(vec3(gray), fragColor.rgb, saturation);
    }

    fragColor.rgb *= raysColor;
  }

  void main() {
    vec4 color;
    mainImage(color, vUv * iResolution.xy);
    gl_FragColor = color;
  }
`

// MassageLab Light Rays ships as an OGL full-screen shader. MassageLab ports
// the source shader, placement helper, and optional mouse-follow math directly.
export default function MassageLabLightRaysBackground({
  className,
  massageLabLightRays,
}: BackgroundEffectProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const options = useMemo(
    () => resolveLightRaysOptions(massageLabLightRays),
    [massageLabLightRays],
  )
  const raysColor = useMemo(() => parseHexColorToRgb(options.raysColor), [options.raysColor])

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

    const resources = createLightRaysResources(context)

    if (!resources) {
      return undefined
    }

    context.disable(context.DEPTH_TEST)
    context.disable(context.CULL_FACE)
    context.disable(context.BLEND)

    const startTimestamp = performance.now()
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const compactViewportQuery = window.matchMedia("(max-width: 360px), (max-height: 360px)")
    let animationFrame = 0
    let resizeRetryFrame = 0
    let shouldRun = false
    let viewportWidth = 1
    let viewportHeight = 1
    let mouseTarget = { x: 0.5, y: 0.5 }
    let mouseCurrent = { x: 0.5, y: 0.5 }

    const bindStaticUniforms = () => {
      context.useProgram(resources.program)
      context.uniform3fv(resources.uniforms.color, raysColor)
      context.uniform1f(resources.uniforms.speed, options.raysSpeed)
      context.uniform1f(resources.uniforms.spread, options.lightSpread)
      context.uniform1f(resources.uniforms.length, options.rayLength)
      context.uniform1f(resources.uniforms.pulsating, options.pulsating ? 1 : 0)
      context.uniform1f(resources.uniforms.fadeDistance, options.fadeDistance)
      context.uniform1f(resources.uniforms.saturation, options.saturation)
      context.uniform1f(resources.uniforms.mouseInfluence, options.followMouse ? options.mouseInfluence : 0)
      context.uniform1f(resources.uniforms.noiseAmount, options.noiseAmount)
      context.uniform1f(resources.uniforms.distortion, options.distortion)
    }

    const updatePlacementUniforms = () => {
      const placement = getAnchorAndDir(options.raysOrigin, canvas.width, canvas.height)
      context.useProgram(resources.program)
      context.uniform2f(resources.uniforms.rayPosition, placement.anchor[0], placement.anchor[1])
      context.uniform2f(resources.uniforms.rayDirection, placement.dir[0], placement.dir[1])
    }

    const drawFrame = (timestamp: number, animate: boolean) => {
      if (canvas.width <= 1 || canvas.height <= 1) {
        return false
      }

      if (options.followMouse && options.mouseInfluence > 0) {
        const smoothing = animate ? 0.92 : 0
        mouseCurrent = {
          x: mouseCurrent.x * smoothing + mouseTarget.x * (1 - smoothing),
          y: mouseCurrent.y * smoothing + mouseTarget.y * (1 - smoothing),
        }
      } else {
        mouseCurrent = { x: 0.5, y: 0.5 }
      }

      const elapsedSeconds = animate ? Math.max(0, (timestamp - startTimestamp) / 1000) : 0
      context.viewport(0, 0, canvas.width, canvas.height)
      context.clearColor(0, 0, 0, 0)
      context.clear(context.COLOR_BUFFER_BIT)
      context.useProgram(resources.program)
      context.bindBuffer(context.ARRAY_BUFFER, resources.positionBuffer)
      context.enableVertexAttribArray(resources.attributes.position)
      context.vertexAttribPointer(resources.attributes.position, 2, context.FLOAT, false, 0, 0)
      context.uniform1f(resources.uniforms.time, elapsedSeconds)
      context.uniform2f(resources.uniforms.resolution, canvas.width, canvas.height)
      context.uniform2f(resources.uniforms.mousePosition, mouseCurrent.x, mouseCurrent.y)
      context.drawArrays(context.TRIANGLES, 0, 3)

      return animate && shouldContinueAnimating(options)
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
      const dpr = Math.min(window.devicePixelRatio || 1, compactViewportQuery.matches ? 1 : 2)
      const targetWidth = Math.max(1, Math.floor(width * dpr))
      const targetHeight = Math.max(1, Math.floor(height * dpr))

      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth
        canvas.height = targetHeight
      }

      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      bindStaticUniforms()
      updatePlacementUniforms()
      return true
    }

    const handlePointerMove = (event: PointerEvent) => {
      const bounds = container.getBoundingClientRect()
      if (bounds.width <= 0 || bounds.height <= 0) {
        return
      }

      mouseTarget = {
        x: Math.min(1, Math.max(0, (event.clientX - bounds.left) / bounds.width)),
        y: Math.min(1, Math.max(0, (event.clientY - bounds.top) / bounds.height)),
      }
    }

    const shouldAnimate = () => shouldAnimateAmbientBackground({
      prefersReducedMotion: reducedMotionQuery.matches,
      compactViewport: Math.min(viewportWidth, viewportHeight) < 360 || compactViewportQuery.matches,
      allowCompactViewport: true,
      documentHidden: document.visibilityState !== "visible",
    })

    const scheduleFrame = () => {
      animationFrame = window.requestAnimationFrame((timestamp) => {
        animationFrame = 0
        if (!shouldRun) {
          return
        }

        if (drawFrame(timestamp, shouldAnimate())) {
          scheduleFrame()
        }
      })
    }

    const stopFrame = () => {
      if (animationFrame) {
        window.cancelAnimationFrame(animationFrame)
        animationFrame = 0
      }
    }

    const render = () => {
      stopFrame()
      window.cancelAnimationFrame(resizeRetryFrame)
      const hasSize = resizeCanvas()

      if (!hasSize) {
        resizeRetryFrame = window.requestAnimationFrame(render)
        return
      }

      const animate = shouldAnimate()
      shouldRun = animate
      if (drawFrame(performance.now(), animate)) {
        scheduleFrame()
      }
    }

    const resizeObserver = new ResizeObserver(render)
    resizeObserver.observe(container)
    window.addEventListener("resize", render)
    if (options.followMouse) {
      window.addEventListener("pointermove", handlePointerMove, { passive: true })
    }
    document.addEventListener("visibilitychange", render)
    reducedMotionQuery.addEventListener("change", render)
    compactViewportQuery.addEventListener("change", render)
    render()

    return () => {
      shouldRun = false
      stopFrame()
      window.cancelAnimationFrame(resizeRetryFrame)
      resizeObserver.disconnect()
      window.removeEventListener("resize", render)
      if (options.followMouse) {
        window.removeEventListener("pointermove", handlePointerMove)
      }
      document.removeEventListener("visibilitychange", render)
      reducedMotionQuery.removeEventListener("change", render)
      compactViewportQuery.removeEventListener("change", render)
      context.deleteBuffer(resources.positionBuffer)
      context.detachShader(resources.program, resources.vertexShader)
      context.detachShader(resources.program, resources.fragmentShader)
      context.deleteShader(resources.vertexShader)
      context.deleteShader(resources.fragmentShader)
      context.deleteProgram(resources.program)
      canvas.width = 1
      canvas.height = 1
    }
  }, [options, raysColor])

  return (
    <div
      ref={containerRef}
      className={cn(styles.effectLayer, styles.massageLabLightRays, className)}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className={styles.massageLabLightRaysCanvas} />
    </div>
  )
}

function createLightRaysResources(context: WebGLRenderingContext): LightRaysResources | null {
  const vertexShader = compileShader(context, context.VERTEX_SHADER, vertexShaderSource)
  const fragmentShader = compileShader(context, context.FRAGMENT_SHADER, fragmentShaderSource)

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

  context.bindBuffer(context.ARRAY_BUFFER, positionBuffer)
  context.bufferData(
    context.ARRAY_BUFFER,
    new Float32Array([
      -1, -1,
      3, -1,
      -1, 3,
    ]),
    context.STATIC_DRAW,
  )

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
      rayPosition: getUniformLocation(context, program, "rayPos"),
      rayDirection: getUniformLocation(context, program, "rayDir"),
      color: getUniformLocation(context, program, "raysColor"),
      speed: getUniformLocation(context, program, "raysSpeed"),
      spread: getUniformLocation(context, program, "lightSpread"),
      length: getUniformLocation(context, program, "rayLength"),
      pulsating: getUniformLocation(context, program, "pulsating"),
      fadeDistance: getUniformLocation(context, program, "fadeDistance"),
      saturation: getUniformLocation(context, program, "saturation"),
      mousePosition: getUniformLocation(context, program, "mousePos"),
      mouseInfluence: getUniformLocation(context, program, "mouseInfluence"),
      noiseAmount: getUniformLocation(context, program, "noiseAmount"),
      distortion: getUniformLocation(context, program, "distortion"),
    },
  }
}

function compileShader(context: WebGLRenderingContext, type: number, source: string) {
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
    throw new Error(`Missing MassageLab Light Rays shader uniform: ${name}`)
  }

  return location
}

function getAnchorAndDir(origin: LightRaysOrigin, width: number, height: number) {
  const outside = 0.2

  switch (origin) {
    case "top-left":
      return { anchor: [0, -outside * height], dir: [0, 1] } as const
    case "top-right":
      return { anchor: [width, -outside * height], dir: [0, 1] } as const
    case "left":
      return { anchor: [-outside * width, 0.5 * height], dir: [1, 0] } as const
    case "right":
      return { anchor: [(1 + outside) * width, 0.5 * height], dir: [-1, 0] } as const
    case "bottom-left":
      return { anchor: [0, (1 + outside) * height], dir: [0, -1] } as const
    case "bottom-center":
      return { anchor: [0.5 * width, (1 + outside) * height], dir: [0, -1] } as const
    case "bottom-right":
      return { anchor: [width, (1 + outside) * height], dir: [0, -1] } as const
    case "top-center":
    default:
      return { anchor: [0.5 * width, -outside * height], dir: [0, 1] } as const
  }
}

function resolveLightRaysOptions(options: MassageLabLightRaysOptions | undefined): ResolvedLightRaysOptions {
  return {
    raysOrigin: resolveOrigin(options?.raysOrigin),
    raysColor: resolveHexColor(options?.raysColor, DEFAULT_MASSAGELAB_LIGHT_RAYS.raysColor),
    raysSpeed: resolveNumber(options?.raysSpeed, DEFAULT_MASSAGELAB_LIGHT_RAYS.raysSpeed, 0, 4),
    lightSpread: resolveNumber(options?.lightSpread, DEFAULT_MASSAGELAB_LIGHT_RAYS.lightSpread, 0.1, 4),
    rayLength: resolveNumber(options?.rayLength, DEFAULT_MASSAGELAB_LIGHT_RAYS.rayLength, 0.25, 5),
    pulsating: options?.pulsating === true,
    fadeDistance: resolveNumber(options?.fadeDistance, DEFAULT_MASSAGELAB_LIGHT_RAYS.fadeDistance, 0.1, 3),
    saturation: resolveNumber(options?.saturation, DEFAULT_MASSAGELAB_LIGHT_RAYS.saturation, 0, 3),
    followMouse: options?.followMouse === true,
    mouseInfluence: resolveNumber(options?.mouseInfluence, DEFAULT_MASSAGELAB_LIGHT_RAYS.mouseInfluence, 0, 1),
    noiseAmount: resolveNumber(options?.noiseAmount, DEFAULT_MASSAGELAB_LIGHT_RAYS.noiseAmount, 0, 1),
    distortion: resolveNumber(options?.distortion, DEFAULT_MASSAGELAB_LIGHT_RAYS.distortion, 0, 2),
  }
}

function resolveOrigin(value: MassageLabLightRaysOptions["raysOrigin"] | undefined): LightRaysOrigin {
  if (
    value === "top-left"
    || value === "top-center"
    || value === "top-right"
    || value === "left"
    || value === "right"
    || value === "bottom-left"
    || value === "bottom-center"
    || value === "bottom-right"
  ) {
    return value
  }

  return DEFAULT_MASSAGELAB_LIGHT_RAYS.raysOrigin
}

function shouldContinueAnimating(options: ResolvedLightRaysOptions) {
  return options.raysSpeed > 1e-6
    || options.pulsating
    || (options.followMouse && options.mouseInfluence > 0)
    || options.noiseAmount > 0
    || options.distortion > 0
}

function parseHexColorToRgb(color: string): RgbColor {
  const normalized = resolveHexColor(color, DEFAULT_MASSAGELAB_LIGHT_RAYS.raysColor).replace("#", "")
  return [
    Number.parseInt(normalized.slice(0, 2), 16) / 255,
    Number.parseInt(normalized.slice(2, 4), 16) / 255,
    Number.parseInt(normalized.slice(4, 6), 16) / 255,
  ]
}

function resolveHexColor(value: string | undefined, fallback: string) {
  if (typeof value !== "string" || !/^#[0-9a-fA-F]{6}$/.test(value)) {
    return fallback
  }

  return value.toUpperCase()
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
