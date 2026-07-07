"use client"

import { useEffect, useMemo, useRef } from "react"
import { shouldAnimateAmbientBackground } from "@/lib/motion-preferences"
import { cn } from "@/lib/utils"
import styles from "@/components/backgrounds/BackgroundHost.module.css"
import type { BackgroundEffectProps, MassageLabPrismOptions } from "./css-backgrounds"

type PrismAnimationType = NonNullable<MassageLabPrismOptions["animationType"]>

type ResolvedPrismOptions = Required<MassageLabPrismOptions>

type PrismResources = {
  program: WebGLProgram
  vertexShader: WebGLShader
  fragmentShader: WebGLShader
  positionBuffer: WebGLBuffer
  attributes: {
    position: number
  }
  uniforms: {
    resolution: WebGLUniformLocation
    time: WebGLUniformLocation
    rotation: WebGLUniformLocation
    useBaseWobble: WebGLUniformLocation
    glow: WebGLUniformLocation
    offsetPx: WebGLUniformLocation
    noise: WebGLUniformLocation
    saturation: WebGLUniformLocation
    hueShift: WebGLUniformLocation
    colorFrequency: WebGLUniformLocation
    bloom: WebGLUniformLocation
    centerShift: WebGLUniformLocation
    invBaseHalf: WebGLUniformLocation
    invHeight: WebGLUniformLocation
    minAxis: WebGLUniformLocation
    pxScale: WebGLUniformLocation
    timeScale: WebGLUniformLocation
  }
}

const DEFAULT_MASSAGELAB_PRISM: ResolvedPrismOptions = {
  height: 3.5,
  baseWidth: 5.5,
  animationType: "rotate",
  glow: 1,
  offsetX: 0,
  offsetY: 0,
  noise: 0.5,
  transparent: true,
  scale: 3.6,
  hueShift: 0,
  colorFrequency: 1,
  hoverStrength: 2,
  inertia: 0.05,
  bloom: 1,
  timeScale: 0.5,
}

const vertexShaderSource = `
  attribute vec2 aPosition;

  void main() {
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`

const fragmentShaderSource = `
  precision highp float;

  uniform vec2  iResolution;
  uniform float iTime;

  uniform mat3  uRot;
  uniform int   uUseBaseWobble;
  uniform float uGlow;
  uniform vec2  uOffsetPx;
  uniform float uNoise;
  uniform float uSaturation;
  uniform float uHueShift;
  uniform float uColorFreq;
  uniform float uBloom;
  uniform float uCenterShift;
  uniform float uInvBaseHalf;
  uniform float uInvHeight;
  uniform float uMinAxis;
  uniform float uPxScale;
  uniform float uTimeScale;

  vec4 tanh4(vec4 x){
    vec4 e2x = exp(2.0*x);
    return (e2x - 1.0) / (e2x + 1.0);
  }

  float rand(vec2 co){
    return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453123);
  }

  float sdOctaAnisoInv(vec3 p){
    vec3 q = vec3(abs(p.x) * uInvBaseHalf, abs(p.y) * uInvHeight, abs(p.z) * uInvBaseHalf);
    float m = q.x + q.y + q.z - 1.0;
    return m * uMinAxis * 0.5773502691896258;
  }

  float sdPyramidUpInv(vec3 p){
    float oct = sdOctaAnisoInv(p);
    float halfSpace = -p.y;
    return max(oct, halfSpace);
  }

  mat3 hueRotation(float a){
    float c = cos(a), s = sin(a);
    mat3 W = mat3(
      0.299, 0.587, 0.114,
      0.299, 0.587, 0.114,
      0.299, 0.587, 0.114
    );
    mat3 U = mat3(
       0.701, -0.587, -0.114,
      -0.299,  0.413, -0.114,
      -0.300, -0.588,  0.886
    );
    mat3 V = mat3(
       0.168, -0.331,  0.500,
       0.328,  0.035, -0.500,
      -0.497,  0.296,  0.201
    );
    return W + U * c + V * s;
  }

  void main(){
    vec2 f = (gl_FragCoord.xy - 0.5 * iResolution.xy - uOffsetPx) * uPxScale;

    float z = 5.0;
    float d = 0.0;

    vec3 p;
    vec4 o = vec4(0.0);

    float centerShift = uCenterShift;
    float cf = uColorFreq;

    mat2 wob = mat2(1.0);
    if (uUseBaseWobble == 1) {
      float t = iTime * uTimeScale;
      float c0 = cos(t + 0.0);
      float c1 = cos(t + 33.0);
      float c2 = cos(t + 11.0);
      wob = mat2(c0, c1, c2, c0);
    }

    const int STEPS = 100;
    for (int i = 0; i < STEPS; i++) {
      p = vec3(f, z);
      p.xz = p.xz * wob;
      p = uRot * p;
      vec3 q = p;
      q.y += centerShift;
      d = 0.1 + 0.2 * abs(sdPyramidUpInv(q));
      z -= d;
      o += (sin((p.y + z) * cf + vec4(0.0, 1.0, 2.0, 3.0)) + 1.0) / d;
    }

    o = tanh4(o * o * (uGlow * uBloom) / 1e5);

    vec3 col = o.rgb;
    float n = rand(gl_FragCoord.xy + vec2(iTime));
    col += (n - 0.5) * uNoise;
    col = clamp(col, 0.0, 1.0);

    float L = dot(col, vec3(0.2126, 0.7152, 0.0722));
    col = clamp(mix(vec3(L), col, uSaturation), 0.0, 1.0);

    if(abs(uHueShift) > 0.0001){
      col = clamp(hueRotation(uHueShift) * col, 0.0, 1.0);
    }

    gl_FragColor = vec4(col, o.a);
  }
`

// MassageLab Prism ships as an OGL component. MassageLab ports the same ray-marched
// prism shader and source rotation logic directly to native WebGL.
export default function MassageLabPrismBackground({
  className,
  massageLabPrism,
}: BackgroundEffectProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const height = massageLabPrism?.height
  const baseWidth = massageLabPrism?.baseWidth
  const animationType = massageLabPrism?.animationType
  const glow = massageLabPrism?.glow
  const offsetX = massageLabPrism?.offsetX
  const offsetY = massageLabPrism?.offsetY
  const noise = massageLabPrism?.noise
  const transparent = massageLabPrism?.transparent
  const scale = massageLabPrism?.scale
  const hueShift = massageLabPrism?.hueShift
  const colorFrequency = massageLabPrism?.colorFrequency
  const hoverStrength = massageLabPrism?.hoverStrength
  const inertia = massageLabPrism?.inertia
  const bloom = massageLabPrism?.bloom
  const timeScale = massageLabPrism?.timeScale
  const options = useMemo(
    () => resolvePrismOptions({
      height,
      baseWidth,
      animationType,
      glow,
      offsetX,
      offsetY,
      noise,
      transparent,
      scale,
      hueShift,
      colorFrequency,
      hoverStrength,
      inertia,
      bloom,
      timeScale,
    }),
    [
      animationType,
      baseWidth,
      bloom,
      colorFrequency,
      glow,
      height,
      hoverStrength,
      hueShift,
      inertia,
      noise,
      offsetX,
      offsetY,
      scale,
      timeScale,
      transparent,
    ],
  )

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    const context = canvas?.getContext("webgl", {
      alpha: options.transparent,
      antialias: false,
      depth: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false,
      stencil: false,
    })

    if (!container || !canvas || !context) {
      return undefined
    }

    const resources = createPrismResources(context)

    if (!resources) {
      return undefined
    }

    context.disable(context.DEPTH_TEST)
    context.disable(context.CULL_FACE)
    context.disable(context.BLEND)

    const baseHalf = options.baseWidth * 0.5
    const saturation = options.transparent ? 1.5 : 1
    const random = () => Math.random()
    const angularVelocityX = 0.3 + random() * 0.6
    const angularVelocityY = 0.2 + random() * 0.7
    const angularVelocityZ = 0.1 + random() * 0.5
    const phaseX = random() * Math.PI * 2
    const phaseZ = random() * Math.PI * 2
    const rotationMatrix = new Float32Array(9)
    const resolution = new Float32Array(2)
    const offsetPx = new Float32Array(2)
    const pointer = { x: 0, y: 0, inside: true }
    const startTimestamp = performance.now()
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const compactViewportQuery = window.matchMedia("(max-width: 360px), (max-height: 360px)")
    let animationFrame = 0
    let resizeRetryFrame = 0
    let shouldRun = false
    let viewportWidth = 1
    let viewportHeight = 1
    let yaw = 0
    let pitch = 0
    let roll = 0

    const bindStaticUniforms = () => {
      context.useProgram(resources.program)
      context.uniform1f(resources.uniforms.glow, options.glow)
      context.uniform1f(resources.uniforms.noise, options.noise)
      context.uniform1f(resources.uniforms.saturation, saturation)
      context.uniform1f(resources.uniforms.hueShift, options.hueShift)
      context.uniform1f(resources.uniforms.colorFrequency, options.colorFrequency)
      context.uniform1f(resources.uniforms.bloom, options.bloom)
      context.uniform1f(resources.uniforms.centerShift, options.height * 0.25)
      context.uniform1f(resources.uniforms.invBaseHalf, 1 / baseHalf)
      context.uniform1f(resources.uniforms.invHeight, 1 / options.height)
      context.uniform1f(resources.uniforms.minAxis, Math.min(baseHalf, options.height))
      context.uniform1f(resources.uniforms.timeScale, options.timeScale)
      context.uniform1i(resources.uniforms.useBaseWobble, options.animationType === "rotate" ? 1 : 0)
    }

    const drawFrame = (timestamp: number, animate: boolean) => {
      if (canvas.width <= 1 || canvas.height <= 1) {
        return false
      }

      const elapsedSeconds = animate ? Math.max(0, (timestamp - startTimestamp) / 1000) : 0
      const scaledTime = elapsedSeconds * options.timeScale
      let shouldContinue = animate

      if (options.animationType === "hover") {
        const maxPitch = 0.6 * options.hoverStrength
        const maxYaw = 0.6 * options.hoverStrength
        const targetYaw = (pointer.inside ? -pointer.x : 0) * maxYaw
        const targetPitch = (pointer.inside ? pointer.y : 0) * maxPitch
        yaw = lerp(yaw, targetYaw, options.inertia)
        pitch = lerp(pitch, targetPitch, options.inertia)
        roll = lerp(roll, 0, 0.1)
        if (options.noise < 1e-6) {
          shouldContinue = (
            Math.abs(yaw - targetYaw) >= 1e-4
            || Math.abs(pitch - targetPitch) >= 1e-4
            || Math.abs(roll) >= 1e-4
          )
        }
      } else if (options.animationType === "3drotate") {
        yaw = scaledTime * angularVelocityY
        pitch = Math.sin(scaledTime * angularVelocityX + phaseX) * 0.6
        roll = Math.sin(scaledTime * angularVelocityZ + phaseZ) * 0.5
        shouldContinue = animate && options.timeScale >= 1e-6
      } else {
        yaw = 0
        pitch = 0
        roll = 0
        shouldContinue = animate && options.timeScale >= 1e-6
      }

      setMat3FromEuler(yaw, pitch, roll, rotationMatrix)
      context.viewport(0, 0, canvas.width, canvas.height)
      context.clearColor(0, 0, 0, 0)
      context.clear(context.COLOR_BUFFER_BIT)
      context.useProgram(resources.program)
      context.bindBuffer(context.ARRAY_BUFFER, resources.positionBuffer)
      context.enableVertexAttribArray(resources.attributes.position)
      context.vertexAttribPointer(resources.attributes.position, 2, context.FLOAT, false, 0, 0)
      context.uniform2fv(resources.uniforms.resolution, resolution)
      context.uniform2fv(resources.uniforms.offsetPx, offsetPx)
      context.uniform1f(resources.uniforms.time, elapsedSeconds)
      context.uniformMatrix3fv(resources.uniforms.rotation, false, rotationMatrix)
      context.drawArrays(context.TRIANGLES, 0, 3)

      return shouldContinue
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
      resolution[0] = canvas.width
      resolution[1] = canvas.height
      offsetPx[0] = options.offsetX * dpr
      offsetPx[1] = options.offsetY * dpr
      context.useProgram(resources.program)
      context.uniform1f(resources.uniforms.pxScale, 1 / ((canvas.height || 1) * 0.1 * options.scale))
      drawFrame(performance.now(), shouldRun)

      return true
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

      if (drawFrame(timestamp, true)) {
        animationFrame = window.requestAnimationFrame(draw)
      } else {
        shouldRun = false
        animationFrame = 0
      }
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

    const handleResize = () => {
      if (!resizeCanvas()) {
        requestResizeRetry()
      }
    }

    const handlePointerMove = (event: PointerEvent) => {
      const width = Math.max(1, window.innerWidth)
      const height = Math.max(1, window.innerHeight)
      pointer.x = clampNumber((event.clientX - width * 0.5) / (width * 0.5), 0, -1, 1)
      pointer.y = clampNumber((event.clientY - height * 0.5) / (height * 0.5), 0, -1, 1)
      pointer.inside = true
      if (!shouldRun) {
        updateAnimationState()
      }
    }

    const handlePointerLeave = () => {
      pointer.inside = false
    }

    bindStaticUniforms()
    const resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(container)
    window.addEventListener("resize", handleResize)
    if (options.animationType === "hover") {
      window.addEventListener("pointermove", handlePointerMove, { passive: true })
      window.addEventListener("mouseleave", handlePointerLeave)
      window.addEventListener("blur", handlePointerLeave)
    }
    reducedMotionQuery.addEventListener("change", updateAnimationState)
    compactViewportQuery.addEventListener("change", updateAnimationState)
    document.addEventListener("visibilitychange", updateAnimationState)
    updateAnimationState()

    return () => {
      stopAnimation()
      resizeObserver.disconnect()
      window.removeEventListener("resize", handleResize)
      if (options.animationType === "hover") {
        window.removeEventListener("pointermove", handlePointerMove)
        window.removeEventListener("mouseleave", handlePointerLeave)
        window.removeEventListener("blur", handlePointerLeave)
      }
      reducedMotionQuery.removeEventListener("change", updateAnimationState)
      compactViewportQuery.removeEventListener("change", updateAnimationState)
      document.removeEventListener("visibilitychange", updateAnimationState)
      context.deleteBuffer(resources.positionBuffer)
      context.deleteProgram(resources.program)
      context.deleteShader(resources.vertexShader)
      context.deleteShader(resources.fragmentShader)
      canvas.width = 1
      canvas.height = 1
    }
  }, [options])

  return (
    <div
      ref={containerRef}
      className={cn(styles.effectLayer, styles.massageLabPrism, className)}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className={styles.massageLabPrismCanvas} />
    </div>
  )
}

function createPrismResources(context: WebGLRenderingContext): PrismResources | null {
  const vertexShader = createShader(context, context.VERTEX_SHADER, vertexShaderSource)
  const fragmentShader = createShader(context, context.FRAGMENT_SHADER, fragmentShaderSource)

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
  const position = context.getAttribLocation(program, "aPosition")

  if (!positionBuffer || position < 0) {
    if (positionBuffer) {
      context.deleteBuffer(positionBuffer)
    }
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
      position,
    },
    uniforms: {
      resolution: getUniformLocation(context, program, "iResolution"),
      time: getUniformLocation(context, program, "iTime"),
      rotation: getUniformLocation(context, program, "uRot"),
      useBaseWobble: getUniformLocation(context, program, "uUseBaseWobble"),
      glow: getUniformLocation(context, program, "uGlow"),
      offsetPx: getUniformLocation(context, program, "uOffsetPx"),
      noise: getUniformLocation(context, program, "uNoise"),
      saturation: getUniformLocation(context, program, "uSaturation"),
      hueShift: getUniformLocation(context, program, "uHueShift"),
      colorFrequency: getUniformLocation(context, program, "uColorFreq"),
      bloom: getUniformLocation(context, program, "uBloom"),
      centerShift: getUniformLocation(context, program, "uCenterShift"),
      invBaseHalf: getUniformLocation(context, program, "uInvBaseHalf"),
      invHeight: getUniformLocation(context, program, "uInvHeight"),
      minAxis: getUniformLocation(context, program, "uMinAxis"),
      pxScale: getUniformLocation(context, program, "uPxScale"),
      timeScale: getUniformLocation(context, program, "uTimeScale"),
    },
  }
}

function createShader(context: WebGLRenderingContext, type: number, source: string) {
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

function getUniformLocation(context: WebGLRenderingContext, program: WebGLProgram, name: string) {
  const location = context.getUniformLocation(program, name)

  if (location === null) {
    throw new Error(`Missing MassageLab Prism shader uniform: ${name}`)
  }

  return location
}

function resolvePrismOptions(options: MassageLabPrismOptions | undefined): ResolvedPrismOptions {
  const height = clampNumber(options?.height, DEFAULT_MASSAGELAB_PRISM.height, 0.5, 8)
  const baseWidth = clampNumber(options?.baseWidth, DEFAULT_MASSAGELAB_PRISM.baseWidth, 0.5, 10)

  return {
    height,
    baseWidth,
    animationType: resolveAnimationType(options?.animationType),
    glow: clampNumber(options?.glow, DEFAULT_MASSAGELAB_PRISM.glow, 0, 3),
    offsetX: clampNumber(options?.offsetX, DEFAULT_MASSAGELAB_PRISM.offsetX, -400, 400),
    offsetY: clampNumber(options?.offsetY, DEFAULT_MASSAGELAB_PRISM.offsetY, -400, 400),
    noise: clampNumber(options?.noise, DEFAULT_MASSAGELAB_PRISM.noise, 0, 1),
    transparent:
      typeof options?.transparent === "boolean"
        ? options.transparent
        : DEFAULT_MASSAGELAB_PRISM.transparent,
    scale: clampNumber(options?.scale, DEFAULT_MASSAGELAB_PRISM.scale, 0.5, 7),
    hueShift: clampNumber(options?.hueShift, DEFAULT_MASSAGELAB_PRISM.hueShift, -Math.PI, Math.PI),
    colorFrequency: clampNumber(options?.colorFrequency, DEFAULT_MASSAGELAB_PRISM.colorFrequency, 0.1, 3),
    hoverStrength: clampNumber(options?.hoverStrength, DEFAULT_MASSAGELAB_PRISM.hoverStrength, 0, 4),
    inertia: clampNumber(options?.inertia, DEFAULT_MASSAGELAB_PRISM.inertia, 0.01, 0.4),
    bloom: clampNumber(options?.bloom, DEFAULT_MASSAGELAB_PRISM.bloom, 0, 3),
    timeScale: clampNumber(options?.timeScale, DEFAULT_MASSAGELAB_PRISM.timeScale, 0, 2),
  }
}

function resolveAnimationType(value: PrismAnimationType | undefined): PrismAnimationType {
  return value === "hover" || value === "3drotate" || value === "rotate"
    ? value
    : DEFAULT_MASSAGELAB_PRISM.animationType
}

function setMat3FromEuler(yawY: number, pitchX: number, rollZ: number, out: Float32Array) {
  const cy = Math.cos(yawY)
  const sy = Math.sin(yawY)
  const cx = Math.cos(pitchX)
  const sx = Math.sin(pitchX)
  const cz = Math.cos(rollZ)
  const sz = Math.sin(rollZ)
  const r00 = cy * cz + sy * sx * sz
  const r01 = -cy * sz + sy * sx * cz
  const r02 = sy * cx
  const r10 = cx * sz
  const r11 = cx * cz
  const r12 = -sx
  const r20 = -sy * cz + cy * sx * sz
  const r21 = sy * sz + cy * sx * cz
  const r22 = cy * cx

  out[0] = r00
  out[1] = r10
  out[2] = r20
  out[3] = r01
  out[4] = r11
  out[5] = r21
  out[6] = r02
  out[7] = r12
  out[8] = r22
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback
}
