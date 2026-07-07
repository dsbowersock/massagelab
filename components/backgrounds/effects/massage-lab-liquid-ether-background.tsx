"use client"

import { useEffect, useMemo, useRef } from "react"
import { shouldAnimateAmbientBackground } from "@/lib/motion-preferences"
import { cn } from "@/lib/utils"
import styles from "@/components/backgrounds/BackgroundHost.module.css"
import type { BackgroundEffectProps, MassageLabLiquidEtherOptions } from "./css-backgrounds"

type RgbColor = [number, number, number]
type Vector2 = [number, number]
type ResolvedLiquidEtherOptions = Required<Omit<MassageLabLiquidEtherOptions, "colors">> & {
  colors: string[]
}

type RenderTarget = {
  texture: WebGLTexture
  framebuffer: WebGLFramebuffer
  width: number
  height: number
}

type ProgramInfo<TUniforms extends string> = {
  program: WebGLProgram
  position: number
  uniforms: Record<TUniforms, WebGLUniformLocation>
}

type FluidPrograms = {
  advection: ProgramInfo<"boundarySpace" | "fboSize" | "velocity" | "dt" | "isBFECC">
  externalForce: ProgramInfo<"force" | "center" | "scale" | "px">
  viscous: ProgramInfo<"boundarySpace" | "velocity" | "velocity_new" | "v" | "px" | "dt">
  divergence: ProgramInfo<"boundarySpace" | "velocity" | "px" | "dt">
  poisson: ProgramInfo<"boundarySpace" | "pressure" | "divergence" | "px">
  pressure: ProgramInfo<"boundarySpace" | "pressure" | "velocity" | "px" | "dt">
  color: ProgramInfo<"velocity" | "palette" | "bgColor" | "opacity">
}

type FluidResources = {
  buffer: WebGLBuffer
  programs: FluidPrograms
  targets: FluidTargets
  paletteTexture: WebGLTexture
  textureType: number
  textureFilter: number
  fboWidth: number
  fboHeight: number
  cellScale: Vector2
  boundarySpace: Vector2
}

type FluidTargets = {
  velocity0: RenderTarget
  velocity1: RenderTarget
  viscous0: RenderTarget
  viscous1: RenderTarget
  divergence: RenderTarget
  pressure0: RenderTarget
  pressure1: RenderTarget
}

type MouseState = {
  coords: Vector2
  previousCoords: Vector2
  diff: Vector2
  isHoverInside: boolean
  hasUserControl: boolean
  isAutoActive: boolean
  autoIntensity: number
  takeoverActive: boolean
  takeoverStartTime: number
  takeoverDuration: number
  takeoverFrom: Vector2
  takeoverTo: Vector2
}

type AutoState = {
  active: boolean
  current: Vector2
  target: Vector2
  lastTime: number
  activationTime: number
}

const MAX_LIQUID_ETHER_COLORS = 8
const DEFAULT_MASSAGELAB_LIQUID_ETHER: ResolvedLiquidEtherOptions = {
  colors: ["#5227FF", "#FF9FFC", "#B497CF"],
  mouseInteraction: false,
  mouseForce: 20,
  cursorSize: 100,
  isViscous: false,
  viscous: 30,
  iterationsViscous: 32,
  iterationsPoisson: 32,
  dt: 0.014,
  bfecc: true,
  resolution: 0.5,
  isBounce: false,
  autoDemo: true,
  autoSpeed: 0.5,
  autoIntensity: 2.2,
  autoResumeDelay: 1000,
  autoRampDuration: 0.6,
  opacity: 1,
}

const fullScreenVertex = `
  attribute vec2 aPosition;
  uniform vec2 boundarySpace;
  varying vec2 uv;
  precision highp float;

  void main() {
    vec2 scale = 1.0 - boundarySpace * 2.0;
    vec2 pos = aPosition * scale;
    uv = vec2(0.5) + pos * 0.5;
    gl_Position = vec4(pos, 0.0, 1.0);
  }
`

const externalForceVertex = `
  attribute vec2 aPosition;
  varying vec2 uv;
  varying vec2 clipPosition;
  precision highp float;

  void main() {
    uv = vec2(0.5) + aPosition * 0.5;
    clipPosition = aPosition;
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`

const advectionFragment = `
  precision highp float;
  uniform sampler2D velocity;
  uniform float dt;
  uniform bool isBFECC;
  uniform vec2 fboSize;
  uniform vec2 px;
  varying vec2 uv;

  void main() {
    vec2 ratio = max(fboSize.x, fboSize.y) / fboSize;
    if (isBFECC == false) {
      vec2 vel = texture2D(velocity, uv).xy;
      vec2 uv2 = uv - vel * dt * ratio;
      vec2 newVel = texture2D(velocity, uv2).xy;
      gl_FragColor = vec4(newVel, 0.0, 0.0);
    } else {
      vec2 spot_new = uv;
      vec2 vel_old = texture2D(velocity, uv).xy;
      vec2 spot_old = spot_new - vel_old * dt * ratio;
      vec2 vel_new1 = texture2D(velocity, spot_old).xy;
      vec2 spot_new2 = spot_old + vel_new1 * dt * ratio;
      vec2 error = spot_new2 - spot_new;
      vec2 spot_new3 = spot_new - error / 2.0;
      vec2 vel_2 = texture2D(velocity, spot_new3).xy;
      vec2 spot_old2 = spot_new3 - vel_2 * dt * ratio;
      vec2 newVel2 = texture2D(velocity, spot_old2).xy;
      gl_FragColor = vec4(newVel2, 0.0, 0.0);
    }
  }
`

const externalForceFragment = `
  precision highp float;
  uniform vec2 force;
  uniform vec2 center;
  uniform vec2 scale;
  uniform vec2 px;
  varying vec2 clipPosition;

  void main() {
    vec2 circle = (clipPosition - center) / max(scale * px, vec2(0.000001));
    float d = 1.0 - min(length(circle), 1.0);
    d *= d;
    gl_FragColor = vec4(force * d, 0.0, 1.0);
  }
`

const viscousFragment = `
  precision highp float;
  uniform sampler2D velocity;
  uniform sampler2D velocity_new;
  uniform float v;
  uniform vec2 px;
  uniform float dt;
  varying vec2 uv;

  void main() {
    vec2 old = texture2D(velocity, uv).xy;
    vec2 new0 = texture2D(velocity_new, uv + vec2(px.x * 2.0, 0.0)).xy;
    vec2 new1 = texture2D(velocity_new, uv - vec2(px.x * 2.0, 0.0)).xy;
    vec2 new2 = texture2D(velocity_new, uv + vec2(0.0, px.y * 2.0)).xy;
    vec2 new3 = texture2D(velocity_new, uv - vec2(0.0, px.y * 2.0)).xy;
    vec2 newv = 4.0 * old + v * dt * (new0 + new1 + new2 + new3);
    newv /= 4.0 * (1.0 + v * dt);
    gl_FragColor = vec4(newv, 0.0, 0.0);
  }
`

const divergenceFragment = `
  precision highp float;
  uniform sampler2D velocity;
  uniform float dt;
  uniform vec2 px;
  varying vec2 uv;

  void main() {
    float x0 = texture2D(velocity, uv - vec2(px.x, 0.0)).x;
    float x1 = texture2D(velocity, uv + vec2(px.x, 0.0)).x;
    float y0 = texture2D(velocity, uv - vec2(0.0, px.y)).y;
    float y1 = texture2D(velocity, uv + vec2(0.0, px.y)).y;
    float divergence = (x1 - x0 + y1 - y0) / 2.0;
    gl_FragColor = vec4(divergence / dt);
  }
`

const poissonFragment = `
  precision highp float;
  uniform sampler2D pressure;
  uniform sampler2D divergence;
  uniform vec2 px;
  varying vec2 uv;

  void main() {
    float p0 = texture2D(pressure, uv + vec2(px.x * 2.0, 0.0)).r;
    float p1 = texture2D(pressure, uv - vec2(px.x * 2.0, 0.0)).r;
    float p2 = texture2D(pressure, uv + vec2(0.0, px.y * 2.0)).r;
    float p3 = texture2D(pressure, uv - vec2(0.0, px.y * 2.0)).r;
    float div = texture2D(divergence, uv).r;
    float newP = (p0 + p1 + p2 + p3) / 4.0 - div;
    gl_FragColor = vec4(newP);
  }
`

const pressureFragment = `
  precision highp float;
  uniform sampler2D pressure;
  uniform sampler2D velocity;
  uniform vec2 px;
  uniform float dt;
  varying vec2 uv;

  void main() {
    float step = 1.0;
    float p0 = texture2D(pressure, uv + vec2(px.x * step, 0.0)).r;
    float p1 = texture2D(pressure, uv - vec2(px.x * step, 0.0)).r;
    float p2 = texture2D(pressure, uv + vec2(0.0, px.y * step)).r;
    float p3 = texture2D(pressure, uv - vec2(0.0, px.y * step)).r;
    vec2 v = texture2D(velocity, uv).xy;
    vec2 gradP = vec2(p0 - p1, p2 - p3) * 0.5;
    v = v - gradP * dt;
    gl_FragColor = vec4(v, 0.0, 1.0);
  }
`

const colorFragment = `
  precision highp float;
  uniform sampler2D velocity;
  uniform sampler2D palette;
  uniform vec4 bgColor;
  uniform float opacity;
  varying vec2 uv;

  void main() {
    vec2 vel = texture2D(velocity, uv).xy;
    float lenv = clamp(length(vel), 0.0, 1.0);
    vec3 c = texture2D(palette, vec2(lenv, 0.5)).rgb;
    vec3 outRGB = mix(bgColor.rgb, c, lenv);
    float outA = mix(bgColor.a, 1.0, lenv) * opacity;
    gl_FragColor = vec4(outRGB, outA);
  }
`

// Direct raw-WebGL port of the MassageLab Liquid Ether simulation passes.
// The source implementation uses Three.js wrappers; MassageLab keeps the same
// pass structure and shaders without adding Three as a runtime dependency.
export default function MassageLabLiquidEtherBackground({
  className,
  massageLabLiquidEther,
}: BackgroundEffectProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const colorsKey = (massageLabLiquidEther?.colors ?? []).join("|")
  const mouseInteraction = massageLabLiquidEther?.mouseInteraction
  const mouseForce = massageLabLiquidEther?.mouseForce
  const cursorSize = massageLabLiquidEther?.cursorSize
  const isViscous = massageLabLiquidEther?.isViscous
  const viscous = massageLabLiquidEther?.viscous
  const iterationsViscous = massageLabLiquidEther?.iterationsViscous
  const iterationsPoisson = massageLabLiquidEther?.iterationsPoisson
  const dt = massageLabLiquidEther?.dt
  const bfecc = massageLabLiquidEther?.bfecc
  const resolution = massageLabLiquidEther?.resolution
  const isBounce = massageLabLiquidEther?.isBounce
  const autoDemo = massageLabLiquidEther?.autoDemo
  const autoSpeed = massageLabLiquidEther?.autoSpeed
  const autoIntensity = massageLabLiquidEther?.autoIntensity
  const autoResumeDelay = massageLabLiquidEther?.autoResumeDelay
  const autoRampDuration = massageLabLiquidEther?.autoRampDuration
  const opacity = massageLabLiquidEther?.opacity
  const options = useMemo(
    () =>
      resolveLiquidEtherOptions({
        colors: colorsKey ? colorsKey.split("|") : undefined,
        mouseInteraction,
        mouseForce,
        cursorSize,
        isViscous,
        viscous,
        iterationsViscous,
        iterationsPoisson,
        dt,
        bfecc,
        resolution,
        isBounce,
        autoDemo,
        autoSpeed,
        autoIntensity,
        autoResumeDelay,
        autoRampDuration,
        opacity,
      }),
    [
      autoDemo,
      autoIntensity,
      autoRampDuration,
      autoResumeDelay,
      autoSpeed,
      bfecc,
      colorsKey,
      cursorSize,
      dt,
      isBounce,
      isViscous,
      iterationsPoisson,
      iterationsViscous,
      mouseForce,
      mouseInteraction,
      opacity,
      resolution,
      viscous,
    ],
  )
  const palette = useMemo(() => prepLiquidEtherColors(options.colors), [options.colors])

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    const context = canvas?.getContext("webgl", {
      alpha: true,
      antialias: true,
      depth: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
      stencil: false,
    })

    if (!canvas || !container || !context) {
      return
    }

    const targetType = resolveRenderTargetType(context)

    if (!targetType) {
      return
    }

    let resources: FluidResources | null = null
    let animationFrame = 0
    let resizeRetryFrame = 0
    let shouldRun = false
    let viewportWidth = 1
    let viewportHeight = 1
    let lastUserInteraction = performance.now()
    const mouse: MouseState = {
      coords: [0, 0],
      previousCoords: [0, 0],
      diff: [0, 0],
      isHoverInside: false,
      hasUserControl: false,
      isAutoActive: false,
      autoIntensity: options.autoIntensity,
      takeoverActive: false,
      takeoverStartTime: 0,
      takeoverDuration: 0.25,
      takeoverFrom: [0, 0],
      takeoverTo: [0, 0],
    }
    const auto: AutoState = {
      active: false,
      current: [0, 0],
      target: pickAutoTarget(),
      lastTime: performance.now(),
      activationTime: 0,
    }
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const compactViewportQuery = window.matchMedia("(max-width: 360px), (max-height: 360px)")

    const renderSimulation = () => {
      if (!resources) {
        return
      }

      const { programs, targets, cellScale, boundarySpace } = resources
      context.disable(context.BLEND)

      runAdvectionPass(context, programs.advection, resources.buffer, targets.velocity0, targets.velocity1, {
        bfecc: options.bfecc,
        boundarySpace,
        cellScale,
        dt: options.dt,
        fboWidth: resources.fboWidth,
        fboHeight: resources.fboHeight,
      })
      runExternalForcePass(context, programs.externalForce, resources.buffer, targets.velocity1, {
        cellScale,
        cursorSize: options.cursorSize,
        mouse,
        mouseForce: options.mouseForce,
      })

      let velocity = targets.velocity1
      if (options.isViscous) {
        velocity = runViscousPass(context, programs.viscous, resources.buffer, targets.velocity1, targets, {
          boundarySpace,
          cellScale,
          dt: options.dt,
          iterations: options.iterationsViscous,
          viscous: options.viscous,
        })
      }

      runDivergencePass(context, programs.divergence, resources.buffer, velocity, targets.divergence, {
        boundarySpace,
        cellScale,
        dt: options.dt,
      })
      const pressure = runPoissonPass(context, programs.poisson, resources.buffer, targets.divergence, targets, {
        boundarySpace,
        cellScale,
        iterations: options.iterationsPoisson,
      })
      runPressurePass(context, programs.pressure, resources.buffer, velocity, pressure, targets.velocity0, {
        boundarySpace,
        cellScale,
        dt: options.dt,
      })
      runColorPass(context, programs.color, resources.buffer, targets.velocity0, resources.paletteTexture, canvas, options.opacity)
    }

    const drawFrame = (timestamp: number, animate: boolean) => {
      updateAutoDriver(timestamp, auto, mouse, options, lastUserInteraction)
      updateMouseState(timestamp, mouse)

      if (!animate) {
        mouse.diff = [0, 0]
      }

      renderSimulation()
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
      resources = recreateFluidResources(context, resources, {
        cssWidth: width,
        cssHeight: height,
        palette,
        resolution: options.resolution,
        targetType,
      })
      drawFrame(performance.now(), shouldRun)

      return true
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!options.mouseInteraction) {
        return
      }

      const bounds = container.getBoundingClientRect()
      const inside =
        bounds.width > 0 &&
        bounds.height > 0 &&
        event.clientX >= bounds.left &&
        event.clientX <= bounds.right &&
        event.clientY >= bounds.top &&
        event.clientY <= bounds.bottom

      mouse.isHoverInside = inside
      if (!inside) {
        return
      }

      lastUserInteraction = performance.now()
      if (auto.active && !mouse.hasUserControl && !mouse.takeoverActive) {
        const normalized = clientToNormalized(event.clientX, event.clientY, bounds)
        mouse.takeoverFrom = [...mouse.coords]
        mouse.takeoverTo = normalized
        mouse.takeoverStartTime = performance.now()
        mouse.takeoverActive = true
        mouse.hasUserControl = true
        mouse.isAutoActive = false
        auto.active = false
        return
      }

      mouse.coords = clientToNormalized(event.clientX, event.clientY, bounds)
      mouse.hasUserControl = true
      auto.active = false
      mouse.isAutoActive = false
    }

    const handlePointerLeave = () => {
      mouse.isHoverInside = false
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

    const resizeObserver = new ResizeObserver(updateAnimationState)
    resizeObserver.observe(container)
    window.addEventListener("resize", updateAnimationState)
    if (options.mouseInteraction) {
      window.addEventListener("pointermove", handlePointerMove, { passive: true })
      document.addEventListener("mouseleave", handlePointerLeave)
    }
    reducedMotionQuery.addEventListener("change", updateAnimationState)
    compactViewportQuery.addEventListener("change", updateAnimationState)
    document.addEventListener("visibilitychange", updateAnimationState)
    updateAnimationState()

    return () => {
      stopAnimation()
      resizeObserver.disconnect()
      window.removeEventListener("resize", updateAnimationState)
      if (options.mouseInteraction) {
        window.removeEventListener("pointermove", handlePointerMove)
        document.removeEventListener("mouseleave", handlePointerLeave)
      }
      reducedMotionQuery.removeEventListener("change", updateAnimationState)
      compactViewportQuery.removeEventListener("change", updateAnimationState)
      document.removeEventListener("visibilitychange", updateAnimationState)
      if (resources) {
        disposeFluidResources(context, resources)
      }
      canvas.width = 1
      canvas.height = 1
    }
  }, [options, palette])

  return (
    <div
      ref={containerRef}
      className={cn(styles.effectLayer, styles.massageLabLiquidEther, className)}
      data-background-id="massage-lab-liquid-ether"
    >
      <canvas ref={canvasRef} className={styles.massageLabLiquidEtherCanvas} />
    </div>
  )
}

function resolveLiquidEtherOptions(input: MassageLabLiquidEtherOptions): ResolvedLiquidEtherOptions {
  return {
    colors: prepColorStops(input.colors),
    mouseInteraction: input.mouseInteraction ?? DEFAULT_MASSAGELAB_LIQUID_ETHER.mouseInteraction,
    mouseForce: clampNumber(input.mouseForce, DEFAULT_MASSAGELAB_LIQUID_ETHER.mouseForce, 0, 80),
    cursorSize: clampNumber(input.cursorSize, DEFAULT_MASSAGELAB_LIQUID_ETHER.cursorSize, 20, 280),
    isViscous: input.isViscous ?? DEFAULT_MASSAGELAB_LIQUID_ETHER.isViscous,
    viscous: clampNumber(input.viscous, DEFAULT_MASSAGELAB_LIQUID_ETHER.viscous, 0, 80),
    iterationsViscous: Math.trunc(clampNumber(
      input.iterationsViscous,
      DEFAULT_MASSAGELAB_LIQUID_ETHER.iterationsViscous,
      4,
      64,
    )),
    iterationsPoisson: Math.trunc(clampNumber(
      input.iterationsPoisson,
      DEFAULT_MASSAGELAB_LIQUID_ETHER.iterationsPoisson,
      4,
      64,
    )),
    dt: clampNumber(input.dt, DEFAULT_MASSAGELAB_LIQUID_ETHER.dt, 0.004, 0.04),
    bfecc: input.bfecc ?? DEFAULT_MASSAGELAB_LIQUID_ETHER.bfecc,
    resolution: clampNumber(input.resolution, DEFAULT_MASSAGELAB_LIQUID_ETHER.resolution, 0.2, 1),
    isBounce: input.isBounce ?? DEFAULT_MASSAGELAB_LIQUID_ETHER.isBounce,
    autoDemo: input.autoDemo ?? DEFAULT_MASSAGELAB_LIQUID_ETHER.autoDemo,
    autoSpeed: clampNumber(input.autoSpeed, DEFAULT_MASSAGELAB_LIQUID_ETHER.autoSpeed, 0.05, 2),
    autoIntensity: clampNumber(input.autoIntensity, DEFAULT_MASSAGELAB_LIQUID_ETHER.autoIntensity, 0, 5),
    autoResumeDelay: clampNumber(
      input.autoResumeDelay,
      DEFAULT_MASSAGELAB_LIQUID_ETHER.autoResumeDelay,
      250,
      5000,
    ),
    autoRampDuration: clampNumber(
      input.autoRampDuration,
      DEFAULT_MASSAGELAB_LIQUID_ETHER.autoRampDuration,
      0,
      3,
    ),
    opacity: clampNumber(input.opacity, DEFAULT_MASSAGELAB_LIQUID_ETHER.opacity, 0.05, 1),
  }
}

function prepColorStops(colors?: string[]) {
  const stops = Array.isArray(colors) && colors.length > 0
    ? colors.filter((color) => HEX_COLOR_PATTERN.test(color)).slice(0, MAX_LIQUID_ETHER_COLORS)
    : DEFAULT_MASSAGELAB_LIQUID_ETHER.colors

  if (stops.length === 1) {
    return [stops[0], stops[0]]
  }

  return stops.length > 0 ? stops : DEFAULT_MASSAGELAB_LIQUID_ETHER.colors
}

function prepLiquidEtherColors(colors: string[]) {
  return colors.map(hexToRgb)
}

function resolveRenderTargetType(context: WebGLRenderingContext) {
  const isIOS = typeof navigator !== "undefined" && /(iPad|iPhone|iPod)/i.test(navigator.userAgent)
  const halfFloat = context.getExtension("OES_texture_half_float")
  const halfFloatRenderable = context.getExtension("EXT_color_buffer_half_float")
  const floatTexture = context.getExtension("OES_texture_float")
  const floatRenderable = context.getExtension("WEBGL_color_buffer_float")
  const floatLinear = context.getExtension("OES_texture_float_linear")
  const halfFloatLinear = context.getExtension("OES_texture_half_float_linear")

  if (!isIOS && floatTexture && floatRenderable) {
    return {
      filter: floatLinear ? context.LINEAR : context.NEAREST,
      type: context.FLOAT,
    }
  }

  if (halfFloat && halfFloatRenderable) {
    return {
      filter: halfFloatLinear ? context.LINEAR : context.NEAREST,
      type: halfFloat.HALF_FLOAT_OES,
    }
  }

  return null
}

function recreateFluidResources(
  context: WebGLRenderingContext,
  existing: FluidResources | null,
  {
    cssHeight,
    cssWidth,
    palette,
    resolution,
    targetType,
  }: {
    cssHeight: number
    cssWidth: number
    palette: RgbColor[]
    resolution: number
    targetType: { filter: number; type: number }
  },
) {
  const fboWidth = Math.max(1, Math.round(cssWidth * resolution))
  const fboHeight = Math.max(1, Math.round(cssHeight * resolution))

  if (existing) {
    disposeFluidResources(context, existing)
  }

  const buffer = createQuadBuffer(context)
  const programs = createFluidPrograms(context)
  const targets = createFluidTargets(context, fboWidth, fboHeight, targetType.type, targetType.filter)
  const paletteTexture = createPaletteTexture(context, palette)
  const cellScale: Vector2 = [1 / fboWidth, 1 / fboHeight]
  const boundarySpace: Vector2 = [...cellScale]

  clearAllTargets(context, targets)

  return {
    buffer,
    programs,
    targets,
    paletteTexture,
    textureType: targetType.type,
    textureFilter: targetType.filter,
    fboWidth,
    fboHeight,
    cellScale,
    boundarySpace,
  }
}

function createFluidPrograms(context: WebGLRenderingContext): FluidPrograms {
  return {
    advection: createProgramInfo(context, fullScreenVertex, advectionFragment, [
      "boundarySpace",
      "fboSize",
      "velocity",
      "dt",
      "isBFECC",
    ]),
    externalForce: createProgramInfo(context, externalForceVertex, externalForceFragment, [
      "force",
      "center",
      "scale",
      "px",
    ]),
    viscous: createProgramInfo(context, fullScreenVertex, viscousFragment, [
      "boundarySpace",
      "velocity",
      "velocity_new",
      "v",
      "px",
      "dt",
    ]),
    divergence: createProgramInfo(context, fullScreenVertex, divergenceFragment, [
      "boundarySpace",
      "velocity",
      "px",
      "dt",
    ]),
    poisson: createProgramInfo(context, fullScreenVertex, poissonFragment, [
      "boundarySpace",
      "pressure",
      "divergence",
      "px",
    ]),
    pressure: createProgramInfo(context, fullScreenVertex, pressureFragment, [
      "boundarySpace",
      "pressure",
      "velocity",
      "px",
      "dt",
    ]),
    color: createProgramInfo(context, fullScreenVertex, colorFragment, ["velocity", "palette", "bgColor", "opacity"]),
  }
}

function createProgramInfo<TUniforms extends string>(
  context: WebGLRenderingContext,
  vertexSource: string,
  fragmentSource: string,
  uniforms: TUniforms[],
): ProgramInfo<TUniforms> {
  const vertexShader = compileShader(context, context.VERTEX_SHADER, vertexSource)
  const fragmentShader = compileShader(context, context.FRAGMENT_SHADER, fragmentSource)
  const program = context.createProgram()

  if (!program) {
    throw new Error("Could not create MassageLab Liquid Ether shader program.")
  }

  context.attachShader(program, vertexShader)
  context.attachShader(program, fragmentShader)
  context.linkProgram(program)

  if (!context.getProgramParameter(program, context.LINK_STATUS)) {
    const info = context.getProgramInfoLog(program) ?? "Unknown shader link failure."
    context.deleteProgram(program)
    context.deleteShader(vertexShader)
    context.deleteShader(fragmentShader)
    throw new Error(info)
  }

  context.deleteShader(vertexShader)
  context.deleteShader(fragmentShader)

  const position = context.getAttribLocation(program, "aPosition")
  if (position < 0) {
    context.deleteProgram(program)
    throw new Error("Missing MassageLab Liquid Ether shader attribute: aPosition")
  }

  const locations = {} as Record<TUniforms, WebGLUniformLocation>
  for (const uniformName of uniforms) {
    const location = context.getUniformLocation(program, uniformName)
    if (location === null) {
      context.deleteProgram(program)
      throw new Error(`Missing MassageLab Liquid Ether shader uniform: ${uniformName}`)
    }
    locations[uniformName] = location
  }

  return { program, position, uniforms: locations }
}

function compileShader(context: WebGLRenderingContext, type: number, source: string) {
  const shader = context.createShader(type)

  if (!shader) {
    throw new Error("Could not create MassageLab Liquid Ether shader.")
  }

  context.shaderSource(shader, source)
  context.compileShader(shader)

  if (!context.getShaderParameter(shader, context.COMPILE_STATUS)) {
    const info = context.getShaderInfoLog(shader) ?? "Unknown shader compile failure."
    context.deleteShader(shader)
    throw new Error(info)
  }

  return shader
}

function createQuadBuffer(context: WebGLRenderingContext) {
  const buffer = context.createBuffer()

  if (!buffer) {
    throw new Error("Could not create MassageLab Liquid Ether quad buffer.")
  }

  context.bindBuffer(context.ARRAY_BUFFER, buffer)
  context.bufferData(
    context.ARRAY_BUFFER,
    new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
    context.STATIC_DRAW,
  )

  return buffer
}

function createFluidTargets(
  context: WebGLRenderingContext,
  width: number,
  height: number,
  textureType: number,
  filter: number,
): FluidTargets {
  return {
    velocity0: createRenderTarget(context, width, height, textureType, filter),
    velocity1: createRenderTarget(context, width, height, textureType, filter),
    viscous0: createRenderTarget(context, width, height, textureType, filter),
    viscous1: createRenderTarget(context, width, height, textureType, filter),
    divergence: createRenderTarget(context, width, height, textureType, filter),
    pressure0: createRenderTarget(context, width, height, textureType, filter),
    pressure1: createRenderTarget(context, width, height, textureType, filter),
  }
}

function createRenderTarget(
  context: WebGLRenderingContext,
  width: number,
  height: number,
  textureType: number,
  filter: number,
): RenderTarget {
  const texture = context.createTexture()
  const framebuffer = context.createFramebuffer()

  if (!texture || !framebuffer) {
    throw new Error("Could not create MassageLab Liquid Ether render target.")
  }

  context.bindTexture(context.TEXTURE_2D, texture)
  context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MIN_FILTER, filter)
  context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MAG_FILTER, filter)
  context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_S, context.CLAMP_TO_EDGE)
  context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_T, context.CLAMP_TO_EDGE)
  context.texImage2D(context.TEXTURE_2D, 0, context.RGBA, width, height, 0, context.RGBA, textureType, null)
  context.bindFramebuffer(context.FRAMEBUFFER, framebuffer)
  context.framebufferTexture2D(context.FRAMEBUFFER, context.COLOR_ATTACHMENT0, context.TEXTURE_2D, texture, 0)

  if (context.checkFramebufferStatus(context.FRAMEBUFFER) !== context.FRAMEBUFFER_COMPLETE) {
    context.deleteTexture(texture)
    context.deleteFramebuffer(framebuffer)
    throw new Error("MassageLab Liquid Ether render target is incomplete.")
  }

  context.bindFramebuffer(context.FRAMEBUFFER, null)
  context.bindTexture(context.TEXTURE_2D, null)

  return { texture, framebuffer, width, height }
}

function createPaletteTexture(context: WebGLRenderingContext, palette: RgbColor[]) {
  const texture = context.createTexture()

  if (!texture) {
    throw new Error("Could not create MassageLab Liquid Ether palette texture.")
  }

  const width = Math.max(2, palette.length)
  const data = new Uint8Array(width * 4)
  for (let index = 0; index < width; index += 1) {
    const [r, g, b] = palette[Math.min(index, palette.length - 1)] ?? palette[0] ?? [1, 1, 1]
    data[index * 4] = Math.round(r * 255)
    data[index * 4 + 1] = Math.round(g * 255)
    data[index * 4 + 2] = Math.round(b * 255)
    data[index * 4 + 3] = 255
  }

  context.bindTexture(context.TEXTURE_2D, texture)
  context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MIN_FILTER, context.LINEAR)
  context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MAG_FILTER, context.LINEAR)
  context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_S, context.CLAMP_TO_EDGE)
  context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_T, context.CLAMP_TO_EDGE)
  context.texImage2D(context.TEXTURE_2D, 0, context.RGBA, width, 1, 0, context.RGBA, context.UNSIGNED_BYTE, data)
  context.bindTexture(context.TEXTURE_2D, null)

  return texture
}

function runAdvectionPass(
  context: WebGLRenderingContext,
  pass: FluidPrograms["advection"],
  buffer: WebGLBuffer,
  source: RenderTarget,
  target: RenderTarget,
  props: {
    bfecc: boolean
    boundarySpace: Vector2
    cellScale: Vector2
    dt: number
    fboHeight: number
    fboWidth: number
  },
) {
  bindTarget(context, target)
  bindProgram(context, pass, buffer)
  bindTextureUniform(context, pass.uniforms.velocity, source.texture, 0)
  context.uniform2f(pass.uniforms.boundarySpace, props.boundarySpace[0], props.boundarySpace[1])
  context.uniform2f(pass.uniforms.fboSize, props.fboWidth, props.fboHeight)
  context.uniform1f(pass.uniforms.dt, props.dt)
  context.uniform1i(pass.uniforms.isBFECC, props.bfecc ? 1 : 0)
  context.drawArrays(context.TRIANGLE_STRIP, 0, 4)
}

function runExternalForcePass(
  context: WebGLRenderingContext,
  pass: FluidPrograms["externalForce"],
  buffer: WebGLBuffer,
  target: RenderTarget,
  props: {
    cellScale: Vector2
    cursorSize: number
    mouse: MouseState
    mouseForce: number
  },
) {
  const forceX = (props.mouse.diff[0] / 2) * props.mouseForce
  const forceY = (props.mouse.diff[1] / 2) * props.mouseForce
  const cursorSizeX = props.cursorSize * props.cellScale[0]
  const cursorSizeY = props.cursorSize * props.cellScale[1]
  const centerX = clampNumber(
    props.mouse.coords[0],
    0,
    -1 + cursorSizeX + props.cellScale[0] * 2,
    1 - cursorSizeX - props.cellScale[0] * 2,
  )
  const centerY = clampNumber(
    props.mouse.coords[1],
    0,
    -1 + cursorSizeY + props.cellScale[1] * 2,
    1 - cursorSizeY - props.cellScale[1] * 2,
  )

  bindTarget(context, target)
  context.enable(context.BLEND)
  context.blendFunc(context.ONE, context.ONE)
  bindProgram(context, pass, buffer)
  context.uniform2f(pass.uniforms.force, forceX, forceY)
  context.uniform2f(pass.uniforms.center, centerX, centerY)
  context.uniform2f(pass.uniforms.scale, props.cursorSize, props.cursorSize)
  context.uniform2f(pass.uniforms.px, props.cellScale[0], props.cellScale[1])
  context.drawArrays(context.TRIANGLE_STRIP, 0, 4)
  context.disable(context.BLEND)
}

function runViscousPass(
  context: WebGLRenderingContext,
  pass: FluidPrograms["viscous"],
  buffer: WebGLBuffer,
  velocity: RenderTarget,
  targets: FluidTargets,
  props: {
    boundarySpace: Vector2
    cellScale: Vector2
    dt: number
    iterations: number
    viscous: number
  },
) {
  let output = targets.viscous1
  for (let index = 0; index < props.iterations; index += 1) {
    const input = index % 2 === 0 ? targets.viscous0 : targets.viscous1
    output = index % 2 === 0 ? targets.viscous1 : targets.viscous0
    bindTarget(context, output)
    bindProgram(context, pass, buffer)
    bindTextureUniform(context, pass.uniforms.velocity, velocity.texture, 0)
    bindTextureUniform(context, pass.uniforms.velocity_new, input.texture, 1)
    context.uniform2f(pass.uniforms.boundarySpace, props.boundarySpace[0], props.boundarySpace[1])
    context.uniform1f(pass.uniforms.v, props.viscous)
    context.uniform2f(pass.uniforms.px, props.cellScale[0], props.cellScale[1])
    context.uniform1f(pass.uniforms.dt, props.dt)
    context.drawArrays(context.TRIANGLE_STRIP, 0, 4)
  }

  return output
}

function runDivergencePass(
  context: WebGLRenderingContext,
  pass: FluidPrograms["divergence"],
  buffer: WebGLBuffer,
  velocity: RenderTarget,
  target: RenderTarget,
  props: {
    boundarySpace: Vector2
    cellScale: Vector2
    dt: number
  },
) {
  bindTarget(context, target)
  bindProgram(context, pass, buffer)
  bindTextureUniform(context, pass.uniforms.velocity, velocity.texture, 0)
  context.uniform2f(pass.uniforms.boundarySpace, props.boundarySpace[0], props.boundarySpace[1])
  context.uniform2f(pass.uniforms.px, props.cellScale[0], props.cellScale[1])
  context.uniform1f(pass.uniforms.dt, props.dt)
  context.drawArrays(context.TRIANGLE_STRIP, 0, 4)
}

function runPoissonPass(
  context: WebGLRenderingContext,
  pass: FluidPrograms["poisson"],
  buffer: WebGLBuffer,
  divergence: RenderTarget,
  targets: FluidTargets,
  props: {
    boundarySpace: Vector2
    cellScale: Vector2
    iterations: number
  },
) {
  let output = targets.pressure1
  for (let index = 0; index < props.iterations; index += 1) {
    const input = index % 2 === 0 ? targets.pressure0 : targets.pressure1
    output = index % 2 === 0 ? targets.pressure1 : targets.pressure0
    bindTarget(context, output)
    bindProgram(context, pass, buffer)
    bindTextureUniform(context, pass.uniforms.pressure, input.texture, 0)
    bindTextureUniform(context, pass.uniforms.divergence, divergence.texture, 1)
    context.uniform2f(pass.uniforms.boundarySpace, props.boundarySpace[0], props.boundarySpace[1])
    context.uniform2f(pass.uniforms.px, props.cellScale[0], props.cellScale[1])
    context.drawArrays(context.TRIANGLE_STRIP, 0, 4)
  }

  return output
}

function runPressurePass(
  context: WebGLRenderingContext,
  pass: FluidPrograms["pressure"],
  buffer: WebGLBuffer,
  velocity: RenderTarget,
  pressure: RenderTarget,
  target: RenderTarget,
  props: {
    boundarySpace: Vector2
    cellScale: Vector2
    dt: number
  },
) {
  bindTarget(context, target)
  bindProgram(context, pass, buffer)
  bindTextureUniform(context, pass.uniforms.pressure, pressure.texture, 0)
  bindTextureUniform(context, pass.uniforms.velocity, velocity.texture, 1)
  context.uniform2f(pass.uniforms.boundarySpace, props.boundarySpace[0], props.boundarySpace[1])
  context.uniform2f(pass.uniforms.px, props.cellScale[0], props.cellScale[1])
  context.uniform1f(pass.uniforms.dt, props.dt)
  context.drawArrays(context.TRIANGLE_STRIP, 0, 4)
}

function runColorPass(
  context: WebGLRenderingContext,
  pass: FluidPrograms["color"],
  buffer: WebGLBuffer,
  velocity: RenderTarget,
  paletteTexture: WebGLTexture,
  canvas: HTMLCanvasElement,
  opacity: number,
) {
  context.bindFramebuffer(context.FRAMEBUFFER, null)
  context.viewport(0, 0, canvas.width, canvas.height)
  context.clearColor(0, 0, 0, 0)
  context.clear(context.COLOR_BUFFER_BIT)
  context.enable(context.BLEND)
  context.blendFunc(context.SRC_ALPHA, context.ONE_MINUS_SRC_ALPHA)
  bindProgram(context, pass, buffer)
  bindTextureUniform(context, pass.uniforms.velocity, velocity.texture, 0)
  bindTextureUniform(context, pass.uniforms.palette, paletteTexture, 1)
  context.uniform4f(pass.uniforms.bgColor, 0, 0, 0, 0)
  context.uniform1f(pass.uniforms.opacity, opacity)
  context.drawArrays(context.TRIANGLE_STRIP, 0, 4)
  context.disable(context.BLEND)
}

function bindTarget(context: WebGLRenderingContext, target: RenderTarget) {
  context.bindFramebuffer(context.FRAMEBUFFER, target.framebuffer)
  context.viewport(0, 0, target.width, target.height)
}

function bindProgram<TUniforms extends string>(
  context: WebGLRenderingContext,
  pass: ProgramInfo<TUniforms>,
  buffer: WebGLBuffer,
) {
  context.useProgram(pass.program)
  context.bindBuffer(context.ARRAY_BUFFER, buffer)
  context.enableVertexAttribArray(pass.position)
  context.vertexAttribPointer(pass.position, 2, context.FLOAT, false, 0, 0)
}

function bindTextureUniform(
  context: WebGLRenderingContext,
  location: WebGLUniformLocation,
  texture: WebGLTexture,
  unit: number,
) {
  context.activeTexture(context.TEXTURE0 + unit)
  context.bindTexture(context.TEXTURE_2D, texture)
  context.uniform1i(location, unit)
}

function clearAllTargets(context: WebGLRenderingContext, targets: FluidTargets) {
  for (const target of Object.values(targets)) {
    context.bindFramebuffer(context.FRAMEBUFFER, target.framebuffer)
    context.viewport(0, 0, target.width, target.height)
    context.clearColor(0, 0, 0, 0)
    context.clear(context.COLOR_BUFFER_BIT)
  }
  context.bindFramebuffer(context.FRAMEBUFFER, null)
}

function disposeFluidResources(context: WebGLRenderingContext, resources: FluidResources) {
  context.deleteBuffer(resources.buffer)
  for (const program of Object.values(resources.programs)) {
    context.deleteProgram(program.program)
  }
  for (const target of Object.values(resources.targets)) {
    context.deleteTexture(target.texture)
    context.deleteFramebuffer(target.framebuffer)
  }
  context.deleteTexture(resources.paletteTexture)
}

function updateAutoDriver(
  timestamp: number,
  auto: AutoState,
  mouse: MouseState,
  options: ResolvedLiquidEtherOptions,
  lastUserInteraction: number,
) {
  if (!options.autoDemo) {
    auto.active = false
    mouse.isAutoActive = false
    return
  }

  const idle = timestamp - lastUserInteraction
  if (idle < options.autoResumeDelay || mouse.isHoverInside) {
    auto.active = false
    mouse.isAutoActive = false
    return
  }

  if (!auto.active) {
    auto.active = true
    auto.current = [...mouse.coords]
    auto.lastTime = timestamp
    auto.activationTime = timestamp
  }

  mouse.isAutoActive = true
  let dtSeconds = (timestamp - auto.lastTime) / 1000
  auto.lastTime = timestamp
  if (dtSeconds > 0.2) {
    dtSeconds = 0.016
  }

  const direction: Vector2 = [auto.target[0] - auto.current[0], auto.target[1] - auto.current[1]]
  const distance = Math.hypot(direction[0], direction[1])
  if (distance < 0.01) {
    auto.target = pickAutoTarget()
    return
  }

  const ramp = options.autoRampDuration > 0
    ? smoothstep(Math.min(1, (timestamp - auto.activationTime) / (options.autoRampDuration * 1000)))
    : 1
  const step = Math.min(options.autoSpeed * dtSeconds * ramp, distance)
  auto.current = [
    auto.current[0] + (direction[0] / distance) * step,
    auto.current[1] + (direction[1] / distance) * step,
  ]
  mouse.coords = [...auto.current]
}

function updateMouseState(timestamp: number, mouse: MouseState) {
  if (mouse.takeoverActive) {
    const progress = (timestamp - mouse.takeoverStartTime) / (mouse.takeoverDuration * 1000)
    if (progress >= 1) {
      mouse.takeoverActive = false
      mouse.coords = [...mouse.takeoverTo]
      mouse.previousCoords = [...mouse.coords]
      mouse.diff = [0, 0]
    } else {
      const k = smoothstep(progress)
      mouse.coords = [
        mouse.takeoverFrom[0] + (mouse.takeoverTo[0] - mouse.takeoverFrom[0]) * k,
        mouse.takeoverFrom[1] + (mouse.takeoverTo[1] - mouse.takeoverFrom[1]) * k,
      ]
    }
  }

  mouse.diff = [
    mouse.coords[0] - mouse.previousCoords[0],
    mouse.coords[1] - mouse.previousCoords[1],
  ]
  mouse.previousCoords = [...mouse.coords]
  if (mouse.previousCoords[0] === 0 && mouse.previousCoords[1] === 0) {
    mouse.diff = [0, 0]
  }
  if (mouse.isAutoActive && !mouse.takeoverActive) {
    mouse.diff = [mouse.diff[0] * mouse.autoIntensity, mouse.diff[1] * mouse.autoIntensity]
  }
}

function clientToNormalized(clientX: number, clientY: number, bounds: DOMRect): Vector2 {
  const nx = (clientX - bounds.left) / bounds.width
  const ny = (clientY - bounds.top) / bounds.height

  return [nx * 2 - 1, -(ny * 2 - 1)]
}

function pickAutoTarget(): Vector2 {
  const margin = 0.2

  return [
    (Math.random() * 2 - 1) * (1 - margin),
    (Math.random() * 2 - 1) * (1 - margin),
  ]
}

function smoothstep(value: number) {
  const t = clampNumber(value, 0, 0, 1)

  return t * t * (3 - 2 * t)
}

function hexToRgb(hex: string): RgbColor {
  const normalized = hex.replace("#", "")
  const value = Number.parseInt(normalized, 16)

  if (Number.isNaN(value)) {
    return [1, 1, 1]
  }

  return [
    ((value >> 16) & 255) / 255,
    ((value >> 8) & 255) / 255,
    (value & 255) / 255,
  ]
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return fallback
  }

  return Math.min(max, Math.max(min, value))
}

const HEX_COLOR_PATTERN = /^#[0-9a-f]{6}$/i
