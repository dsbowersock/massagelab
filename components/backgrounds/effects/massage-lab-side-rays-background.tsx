"use client"

import { useEffect, useMemo, useRef } from "react"
import { shouldAnimateAmbientBackground } from "@/lib/motion-preferences"
import { cn } from "@/lib/utils"
import styles from "@/components/backgrounds/BackgroundHost.module.css"
import type { BackgroundEffectProps, MassageLabSideRaysOptions } from "./css-backgrounds"

type RgbColor = [number, number, number]
type ResolvedSideRaysOptions = Required<MassageLabSideRaysOptions>

type SideRaysResources = {
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
    speed: WebGLUniformLocation
    rayColor1: WebGLUniformLocation
    rayColor2: WebGLUniformLocation
    intensity: WebGLUniformLocation
    spread: WebGLUniformLocation
    flipX: WebGLUniformLocation
    flipY: WebGLUniformLocation
    tilt: WebGLUniformLocation
    saturation: WebGLUniformLocation
    blend: WebGLUniformLocation
    falloff: WebGLUniformLocation
    opacity: WebGLUniformLocation
  }
}

const DEFAULT_MASSAGELAB_SIDE_RAYS: ResolvedSideRaysOptions = {
  speed: 2.5,
  rayColor1: "#EAB308",
  rayColor2: "#96C8FF",
  intensity: 2,
  spread: 2,
  origin: "top-right",
  tilt: 0,
  saturation: 1.5,
  blend: 0.75,
  falloff: 1.6,
  opacity: 1,
}

const vertexShaderSource = `
  attribute vec2 aPosition;

  void main() {
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`

const fragmentShaderSource = `
  precision highp float;

  uniform float iTime;
  uniform vec2 iResolution;
  uniform float iSpeed;
  uniform vec3 iRayColor1;
  uniform vec3 iRayColor2;
  uniform float iIntensity;
  uniform float iSpread;
  uniform float iFlipX;
  uniform float iFlipY;
  uniform float iTilt;
  uniform float iSaturation;
  uniform float iBlend;
  uniform float iFalloff;
  uniform float iOpacity;

  float rayStrength(vec2 raySource, vec2 rayRefDirection, vec2 coord, float seedA, float seedB, float speed) {
    vec2 sourceToCoord = coord - raySource;
    float cosAngle = dot(normalize(sourceToCoord), rayRefDirection);

    return clamp(
      (0.45 + 0.15 * sin(cosAngle * seedA + iTime * speed)) +
      (0.3 + 0.2 * cos(-cosAngle * seedB + iTime * speed)),
      0.0,
      1.0
    ) * clamp((iResolution.x - length(sourceToCoord)) / iResolution.x, 0.5, 1.0);
  }

  void main() {
    vec2 fragCoord = gl_FragCoord.xy;

    if (iFlipX > 0.5) {
      fragCoord.x = iResolution.x - fragCoord.x;
    }

    if (iFlipY > 0.5) {
      fragCoord.y = iResolution.y - fragCoord.y;
    }

    vec2 coord = vec2(fragCoord.x, iResolution.y - fragCoord.y);
    vec2 rayPos = vec2(iResolution.x * 1.1, -0.5 * iResolution.y);
    float tiltRad = iTilt * 3.14159265 / 180.0;
    float cs = cos(tiltRad);
    float sn = sin(tiltRad);
    vec2 rel = coord - rayPos;
    vec2 tiltedCoord = vec2(rel.x * cs - rel.y * sn, rel.x * sn + rel.y * cs) + rayPos;
    float halfSpread = iSpread * 0.275;
    vec2 rayRefDir1 = normalize(vec2(cos(0.785398 + halfSpread), sin(0.785398 + halfSpread)));
    vec2 rayRefDir2 = normalize(vec2(cos(0.785398 - halfSpread), sin(0.785398 - halfSpread)));
    vec4 rays1 = vec4(iRayColor1, 1.0) * rayStrength(rayPos, rayRefDir1, tiltedCoord, 36.2214, 21.11349, iSpeed);
    vec4 rays2 = vec4(iRayColor2, 1.0) * rayStrength(rayPos, rayRefDir2, tiltedCoord, 22.3991, 18.0234, iSpeed * 0.2);
    vec4 color = rays1 * (1.0 - iBlend) * 0.9 + rays2 * iBlend * 0.9;
    float distanceToLight = length(fragCoord.xy - vec2(rayPos.x, iResolution.y - rayPos.y)) / iResolution.y;
    float brightness = iIntensity * 0.4 / pow(max(distanceToLight, 0.001), iFalloff);

    color.rgb *= brightness;

    float gray = dot(color.rgb, vec3(0.299, 0.587, 0.114));
    color.rgb = mix(vec3(gray), color.rgb, iSaturation);
    color.a = max(color.r, max(color.g, color.b)) * iOpacity;
    gl_FragColor = color;
  }
`

// MassageLab Side Rays ships as an OGL full-screen shader. MassageLab keeps
// the shader and origin math while replacing OGL with a native WebGL shell.
export default function MassageLabSideRaysBackground({
  className,
  massageLabSideRays,
}: BackgroundEffectProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const colorKey = `${massageLabSideRays?.rayColor1 ?? ""}|${massageLabSideRays?.rayColor2 ?? ""}`
  const options = useMemo(
    () => resolveSideRaysOptions(massageLabSideRays),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      colorKey,
      massageLabSideRays?.speed,
      massageLabSideRays?.intensity,
      massageLabSideRays?.spread,
      massageLabSideRays?.origin,
      massageLabSideRays?.tilt,
      massageLabSideRays?.saturation,
      massageLabSideRays?.blend,
      massageLabSideRays?.falloff,
      massageLabSideRays?.opacity,
    ],
  )
  const rayColor1 = useMemo(() => parseHexColorToRgb(options.rayColor1), [options.rayColor1])
  const rayColor2 = useMemo(() => parseHexColorToRgb(options.rayColor2), [options.rayColor2])

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

    const resources = createSideRaysResources(context)

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

    const bindStaticUniforms = () => {
      const [flipX, flipY] = originToFlip(options.origin)

      context.useProgram(resources.program)
      context.uniform1f(resources.uniforms.speed, options.speed)
      context.uniform3fv(resources.uniforms.rayColor1, rayColor1)
      context.uniform3fv(resources.uniforms.rayColor2, rayColor2)
      context.uniform1f(resources.uniforms.intensity, options.intensity)
      context.uniform1f(resources.uniforms.spread, options.spread)
      context.uniform1f(resources.uniforms.flipX, flipX)
      context.uniform1f(resources.uniforms.flipY, flipY)
      context.uniform1f(resources.uniforms.tilt, options.tilt)
      context.uniform1f(resources.uniforms.saturation, options.saturation)
      context.uniform1f(resources.uniforms.blend, options.blend)
      context.uniform1f(resources.uniforms.falloff, options.falloff)
      context.uniform1f(resources.uniforms.opacity, options.opacity)
    }

    const drawFrame = (timestamp: number, animate: boolean) => {
      if (canvas.width <= 1 || canvas.height <= 1) {
        return false
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
      context.drawArrays(context.TRIANGLES, 0, 3)

      return animate && options.speed >= 1e-6
    }

    const resizeCanvas = () => {
      const bounds = container.getBoundingClientRect()
      const width = Math.floor(bounds.width)
      const height = Math.floor(bounds.height)

      if (width <= 0 || height <= 0) {
        return false
      }

      const dpr = Math.min(window.devicePixelRatio || 1, compactViewportQuery.matches ? 1 : 2)
      const targetWidth = Math.max(1, Math.floor(width * dpr))
      const targetHeight = Math.max(1, Math.floor(height * dpr))

      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth
        canvas.height = targetHeight
      }

      canvas.style.width = `${width}px`
      canvas.style.height = `${height}px`
      return true
    }

    const scheduleFrame = () => {
      animationFrame = window.requestAnimationFrame((timestamp) => {
        animationFrame = 0
        if (!shouldRun) {
          return
        }

        const continueAnimating = drawFrame(timestamp, shouldAnimate())
        if (continueAnimating) {
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

    const shouldAnimate = () => shouldAnimateAmbientBackground({
      prefersReducedMotion: reducedMotionQuery.matches,
      compactViewport: compactViewportQuery.matches,
      documentHidden: document.visibilityState !== "visible",
    })

    const render = () => {
      stopFrame()
      window.cancelAnimationFrame(resizeRetryFrame)
      const hasSize = resizeCanvas()

      if (!hasSize) {
        resizeRetryFrame = window.requestAnimationFrame(render)
        return
      }

      bindStaticUniforms()
      const animate = shouldAnimate()
      shouldRun = animate
      const keepAnimating = drawFrame(performance.now(), animate)

      if (keepAnimating) {
        scheduleFrame()
      }
    }

    const handleVisibilityChange = () => render()
    const resizeObserver = new ResizeObserver(render)
    resizeObserver.observe(container)
    window.addEventListener("resize", render)
    document.addEventListener("visibilitychange", handleVisibilityChange)
    reducedMotionQuery.addEventListener("change", render)
    compactViewportQuery.addEventListener("change", render)
    render()

    return () => {
      shouldRun = false
      stopFrame()
      window.cancelAnimationFrame(resizeRetryFrame)
      resizeObserver.disconnect()
      window.removeEventListener("resize", render)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
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
  }, [options, rayColor1, rayColor2])

  return (
    <div
      ref={containerRef}
      className={cn(styles.effectLayer, styles.massageLabSideRays, className)}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className={styles.massageLabSideRaysCanvas} />
    </div>
  )
}

function createSideRaysResources(context: WebGLRenderingContext): SideRaysResources | null {
  const vertexShader = compileShader(context, context.VERTEX_SHADER, vertexShaderSource)
  const fragmentShader = compileShader(context, context.FRAGMENT_SHADER, fragmentShaderSource)

  if (!vertexShader || !fragmentShader) {
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
      position: context.getAttribLocation(program, "aPosition"),
    },
    uniforms: {
      time: getUniformLocation(context, program, "iTime"),
      resolution: getUniformLocation(context, program, "iResolution"),
      speed: getUniformLocation(context, program, "iSpeed"),
      rayColor1: getUniformLocation(context, program, "iRayColor1"),
      rayColor2: getUniformLocation(context, program, "iRayColor2"),
      intensity: getUniformLocation(context, program, "iIntensity"),
      spread: getUniformLocation(context, program, "iSpread"),
      flipX: getUniformLocation(context, program, "iFlipX"),
      flipY: getUniformLocation(context, program, "iFlipY"),
      tilt: getUniformLocation(context, program, "iTilt"),
      saturation: getUniformLocation(context, program, "iSaturation"),
      blend: getUniformLocation(context, program, "iBlend"),
      falloff: getUniformLocation(context, program, "iFalloff"),
      opacity: getUniformLocation(context, program, "iOpacity"),
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
    throw new Error(`Missing MassageLab Side Rays shader uniform: ${name}`)
  }

  return location
}

function resolveSideRaysOptions(options: MassageLabSideRaysOptions | undefined): ResolvedSideRaysOptions {
  return {
    speed: resolveNumber(options?.speed, DEFAULT_MASSAGELAB_SIDE_RAYS.speed, 0, 8),
    rayColor1: resolveHexColor(options?.rayColor1, DEFAULT_MASSAGELAB_SIDE_RAYS.rayColor1),
    rayColor2: resolveHexColor(options?.rayColor2, DEFAULT_MASSAGELAB_SIDE_RAYS.rayColor2),
    intensity: resolveNumber(options?.intensity, DEFAULT_MASSAGELAB_SIDE_RAYS.intensity, 0, 6),
    spread: resolveNumber(options?.spread, DEFAULT_MASSAGELAB_SIDE_RAYS.spread, 0.1, 5),
    origin: resolveOrigin(options?.origin),
    tilt: resolveNumber(options?.tilt, DEFAULT_MASSAGELAB_SIDE_RAYS.tilt, -90, 90),
    saturation: resolveNumber(options?.saturation, DEFAULT_MASSAGELAB_SIDE_RAYS.saturation, 0, 3),
    blend: resolveNumber(options?.blend, DEFAULT_MASSAGELAB_SIDE_RAYS.blend, 0, 1),
    falloff: resolveNumber(options?.falloff, DEFAULT_MASSAGELAB_SIDE_RAYS.falloff, 0.2, 4),
    opacity: resolveNumber(options?.opacity, DEFAULT_MASSAGELAB_SIDE_RAYS.opacity, 0, 1),
  }
}

function originToFlip(origin: MassageLabSideRaysOptions["origin"]): [number, number] {
  switch (origin) {
    case "top-left":
      return [1, 0]
    case "bottom-right":
      return [0, 1]
    case "bottom-left":
      return [1, 1]
    case "top-right":
    default:
      return [0, 0]
  }
}

function resolveOrigin(value: MassageLabSideRaysOptions["origin"] | undefined): ResolvedSideRaysOptions["origin"] {
  if (value === "top-left" || value === "bottom-right" || value === "bottom-left" || value === "top-right") {
    return value
  }

  return DEFAULT_MASSAGELAB_SIDE_RAYS.origin
}

function parseHexColorToRgb(color: string): RgbColor {
  const normalized = resolveHexColor(color, DEFAULT_MASSAGELAB_SIDE_RAYS.rayColor1).replace("#", "")
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
