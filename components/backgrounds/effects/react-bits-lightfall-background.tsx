"use client"

import { useEffect, useMemo, useRef } from "react"
import { shouldAnimateAmbientBackground } from "@/lib/motion-preferences"
import { cn } from "@/lib/utils"
import styles from "@/components/backgrounds/BackgroundHost.module.css"
import type { BackgroundEffectProps, ReactBitsLightfallOptions } from "./css-backgrounds"

type RgbColor = [number, number, number]
type ResolvedLightfallOptions = Required<Omit<ReactBitsLightfallOptions, "colors">> & {
  colors: string[]
}

type LightfallWebGlResources = {
  program: WebGLProgram
  vertexShader: WebGLShader
  fragmentShader: WebGLShader
  positionBuffer: WebGLBuffer
  attributes: {
    position: number
  }
  uniforms: {
    resolution: WebGLUniformLocation
    mouse: WebGLUniformLocation
    time: WebGLUniformLocation
    color0: WebGLUniformLocation
    color1: WebGLUniformLocation
    color2: WebGLUniformLocation
    color3: WebGLUniformLocation
    color4: WebGLUniformLocation
    color5: WebGLUniformLocation
    color6: WebGLUniformLocation
    color7: WebGLUniformLocation
    colorCount: WebGLUniformLocation
    backgroundColor: WebGLUniformLocation
    mouseColor: WebGLUniformLocation
    speed: WebGLUniformLocation
    streakCount: WebGLUniformLocation
    streakWidth: WebGLUniformLocation
    streakLength: WebGLUniformLocation
    glow: WebGLUniformLocation
    density: WebGLUniformLocation
    twinkle: WebGLUniformLocation
    zoom: WebGLUniformLocation
    backgroundGlow: WebGLUniformLocation
    opacity: WebGLUniformLocation
    mouseEnabled: WebGLUniformLocation
    mouseStrength: WebGLUniformLocation
    mouseRadius: WebGLUniformLocation
  }
}

const MAX_LIGHTFALL_COLORS = 8
const DEFAULT_REACT_BITS_LIGHTFALL: ResolvedLightfallOptions = {
  colors: ["#A6C8FF", "#5227FF", "#FF9FFC"],
  backgroundColor: "#0A29FF",
  speed: 0.5,
  streakCount: 2,
  streakWidth: 1,
  streakLength: 1,
  glow: 1,
  density: 0.6,
  twinkle: 1,
  zoom: 3,
  backgroundGlow: 0.5,
  opacity: 1,
  mouseInteraction: false,
  mouseStrength: 0.5,
  mouseRadius: 1,
  mouseDampening: 0.15,
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

  uniform vec3  iResolution;
  uniform vec2  iMouse;
  uniform float iTime;

  uniform vec3  uColor0;
  uniform vec3  uColor1;
  uniform vec3  uColor2;
  uniform vec3  uColor3;
  uniform vec3  uColor4;
  uniform vec3  uColor5;
  uniform vec3  uColor6;
  uniform vec3  uColor7;
  uniform int   uColorCount;
  uniform vec3  uBgColor;
  uniform vec3  uMouseColor;
  uniform float uSpeed;
  uniform int   uStreakCount;
  uniform float uStreakWidth;
  uniform float uStreakLength;
  uniform float uGlow;
  uniform float uDensity;
  uniform float uTwinkle;
  uniform float uZoom;
  uniform float uBgGlow;
  uniform float uOpacity;
  uniform float uMouseEnabled;
  uniform float uMouseStrength;
  uniform float uMouseRadius;

  varying vec2 vUv;

  vec3 palette(float h) {
    int count = uColorCount;
    if (count < 1) count = 1;
    int idx = int(floor(clamp(h, 0.0, 0.999999) * float(count)));
    if (idx <= 0) return uColor0;
    if (idx == 1) return uColor1;
    if (idx == 2) return uColor2;
    if (idx == 3) return uColor3;
    if (idx == 4) return uColor4;
    if (idx == 5) return uColor5;
    if (idx == 6) return uColor6;
    return uColor7;
  }

  vec3 tanhv(vec3 x) {
    vec3 e = exp(-2.0 * x);
    return (1.0 - e) / (1.0 + e);
  }

  vec2 sceneC(vec2 frag, vec2 r) {
    vec2 P = (frag + frag - r) / r.x;
    float z = 0.0;
    float d = 1e3;
    vec4 O = vec4(0.0);

    for (int k = 0; k < 39; k++) {
      if (d <= 1e-4) {
        break;
      }

      O = z * normalize(vec4(P, uZoom, 0.0)) - vec4(0.0, 4.0, 1.0, 0.0) / 4.5;
      d = 1.0 - sqrt(length(O * O));
      z += d;
    }

    return vec2(O.x, atan(O.z, O.y));
  }

  void mainImage(out vec4 o, in vec2 fragCoord) {
    vec2 R = iResolution.xy;
    vec2 uv0 = (fragCoord + fragCoord - R) / R.x;
    float T = 0.1 * iTime * uSpeed + 9.0;
    float angRings = max(1.0, floor(6.28318530718 * max(uDensity, 0.05) + 0.5));
    vec2 Y = vec2(5e-3, 6.28318530718 / angRings);
    vec2 c0 = sceneC(fragCoord, R);
    vec2 cdx = sceneC(fragCoord + vec2(1.0, 0.0), R);
    vec2 cdy = sceneC(fragCoord + vec2(0.0, 1.0), R);
    vec2 dCx = cdx - c0;
    vec2 dCy = cdy - c0;
    dCx.y -= 6.28318530718 * floor(dCx.y / 6.28318530718 + 0.5);
    dCy.y -= 6.28318530718 * floor(dCy.y / 6.28318530718 + 0.5);
    vec2 fw = abs(dCx) + abs(dCy);
    vec2 C = c0;
    vec2 P = vec2(2.0, 1.0) * uv0 - (R / R.x) * vec2(0.0, 1.0);
    vec4 O = vec4(uBgColor * 90.0 * uBgGlow / (1e3 * dot(P, P) + 6.0), 0.0);

    float mGlow = 0.0;
    if (uMouseEnabled > 0.5) {
      vec2 mN = (iMouse + iMouse - R) / R.x;
      float md = length(uv0 - mN);
      mGlow = exp(-md * md / max(uMouseRadius * uMouseRadius, 1e-4)) * uMouseStrength;
      O.rgb += uMouseColor * mGlow * 0.25;
    }

    float zr = 5e-4 * uStreakWidth;
    vec2 rr = vec2(max(length(fw), 1e-5));
    float tail = 19.0 / max(uStreakLength, 0.05);

    for (int m = 0; m < 16; m++) {
      if (m >= uStreakCount) {
        break;
      }

      float jf = float(m) + 1.0;
      float ic = fract(sin(dot(vec2(jf, floor(C.x / Y.x + 0.5)), vec2(7.0, 11.0)) * 73.0));
      vec2 Pp = C - (T + T * ic) * vec2(0.0, 1.0);
      Pp -= floor(Pp / Y + 0.5) * Y;
      float h = fract(8663.0 * ic);
      vec3 col = palette(h);
      float weight = mix(1.5, 1.0 + sin(T + 7.0 * h + 4.0), uTwinkle);
      weight *= (1.0 + mGlow * 2.0);
      vec2 inner = vec2(length(max(Pp, vec2(-1.0, 0.0))), length(Pp) - zr) - zr;
      vec2 sm = vec2(1.0) - smoothstep(-rr, rr, inner);
      O.rgb += dot(sm, vec2(exp(tail * Pp.y), 3.0)) * col * weight;
      C.x += Y.x / 8.0;
    }

    vec3 colr = sqrt(tanhv(max(O.rgb * uGlow - vec3(0.04, 0.08, 0.02), 0.0)));
    o = vec4(colr, clamp(uOpacity, 0.0, 1.0));
  }

  void main() {
    vec4 color;
    mainImage(color, vUv * iResolution.xy);
    gl_FragColor = color;
  }
`

// React Bits Lightfall ships as an OGL component. MassageLab ports the shader
// directly so the premium background stays dependency-free and pointer-passive.
export default function ReactBitsLightfallBackground({
  className,
  reactBitsLightfall,
}: BackgroundEffectProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const colorsKey = (reactBitsLightfall?.colors ?? []).join("|")
  const backgroundColor = reactBitsLightfall?.backgroundColor
  const speed = reactBitsLightfall?.speed
  const streakCount = reactBitsLightfall?.streakCount
  const streakWidth = reactBitsLightfall?.streakWidth
  const streakLength = reactBitsLightfall?.streakLength
  const glow = reactBitsLightfall?.glow
  const density = reactBitsLightfall?.density
  const twinkle = reactBitsLightfall?.twinkle
  const zoom = reactBitsLightfall?.zoom
  const backgroundGlow = reactBitsLightfall?.backgroundGlow
  const opacity = reactBitsLightfall?.opacity
  const mouseInteraction = reactBitsLightfall?.mouseInteraction
  const mouseStrength = reactBitsLightfall?.mouseStrength
  const mouseRadius = reactBitsLightfall?.mouseRadius
  const mouseDampening = reactBitsLightfall?.mouseDampening
  const options = useMemo(
    () => resolveLightfallOptions({
      colors: colorsKey ? colorsKey.split("|") : undefined,
      backgroundColor,
      speed,
      streakCount,
      streakWidth,
      streakLength,
      glow,
      density,
      twinkle,
      zoom,
      backgroundGlow,
      opacity,
      mouseInteraction,
      mouseStrength,
      mouseRadius,
      mouseDampening,
    }),
    [backgroundColor, backgroundGlow, colorsKey, density, glow, mouseDampening, mouseInteraction, mouseRadius, mouseStrength, opacity, speed, streakCount, streakLength, streakWidth, twinkle, zoom],
  )
  const palette = useMemo(() => prepLightfallColors(options.colors), [options.colors])
  const backgroundRgb = useMemo(() => parseHexColorToRgb(options.backgroundColor), [options.backgroundColor])

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    const context = canvas?.getContext("webgl", {
      alpha: true,
      antialias: true,
      depth: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false,
      stencil: false,
    })

    if (!container || !canvas || !context) {
      return undefined
    }

    const resources = createLightfallResources(context)

    if (!resources) {
      return undefined
    }

    let animationFrame = 0
    let resizeRetryFrame = 0
    let shouldRun = false
    let viewportWidth = 1
    let viewportHeight = 1
    let mouseTarget: [number, number] = [0, 0]
    let mouseCurrent: [number, number] = [0, 0]
    let hasMouse = false
    const startTimestamp = performance.now()
    let lastFrameTimestamp = startTimestamp
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const compactViewportQuery = window.matchMedia("(max-width: 640px)")

    const setColorUniforms = () => {
      context.uniform3f(resources.uniforms.color0, palette.arr[0][0], palette.arr[0][1], palette.arr[0][2])
      context.uniform3f(resources.uniforms.color1, palette.arr[1][0], palette.arr[1][1], palette.arr[1][2])
      context.uniform3f(resources.uniforms.color2, palette.arr[2][0], palette.arr[2][1], palette.arr[2][2])
      context.uniform3f(resources.uniforms.color3, palette.arr[3][0], palette.arr[3][1], palette.arr[3][2])
      context.uniform3f(resources.uniforms.color4, palette.arr[4][0], palette.arr[4][1], palette.arr[4][2])
      context.uniform3f(resources.uniforms.color5, palette.arr[5][0], palette.arr[5][1], palette.arr[5][2])
      context.uniform3f(resources.uniforms.color6, palette.arr[6][0], palette.arr[6][1], palette.arr[6][2])
      context.uniform3f(resources.uniforms.color7, palette.arr[7][0], palette.arr[7][1], palette.arr[7][2])
      context.uniform1i(resources.uniforms.colorCount, palette.count)
    }

    const drawFrame = (timestamp: number, animate: boolean) => {
      if (canvas.width <= 1 || canvas.height <= 1) {
        return
      }

      const deltaSeconds = Math.max(0, (timestamp - lastFrameTimestamp) / 1000)
      lastFrameTimestamp = timestamp
      if (options.mouseInteraction && hasMouse) {
        if (options.mouseDampening > 0) {
          const factor = Math.min(1, 1 - Math.exp(-deltaSeconds / Math.max(0.0001, options.mouseDampening)))
          mouseCurrent = [
            mouseCurrent[0] + (mouseTarget[0] - mouseCurrent[0]) * factor,
            mouseCurrent[1] + (mouseTarget[1] - mouseCurrent[1]) * factor,
          ]
        } else {
          mouseCurrent = mouseTarget
        }
      } else {
        mouseCurrent = [canvas.width * 0.5, canvas.height * 0.5]
      }

      const elapsedSeconds = Math.max(0, (timestamp - startTimestamp) / 1000)
      const time = animate ? elapsedSeconds % (60 * Math.PI) : 0

      context.viewport(0, 0, canvas.width, canvas.height)
      context.clearColor(0, 0, 0, 0)
      context.clear(context.COLOR_BUFFER_BIT)
      context.useProgram(resources.program)
      context.bindBuffer(context.ARRAY_BUFFER, resources.positionBuffer)
      context.enableVertexAttribArray(resources.attributes.position)
      context.vertexAttribPointer(resources.attributes.position, 2, context.FLOAT, false, 0, 0)
      context.enable(context.BLEND)
      context.blendFunc(context.SRC_ALPHA, context.ONE_MINUS_SRC_ALPHA)
      context.uniform3f(resources.uniforms.resolution, canvas.width, canvas.height, 1)
      context.uniform2f(resources.uniforms.mouse, mouseCurrent[0], mouseCurrent[1])
      context.uniform1f(resources.uniforms.time, time)
      setColorUniforms()
      context.uniform3f(resources.uniforms.backgroundColor, backgroundRgb[0], backgroundRgb[1], backgroundRgb[2])
      context.uniform3f(resources.uniforms.mouseColor, palette.avg[0], palette.avg[1], palette.avg[2])
      context.uniform1f(resources.uniforms.speed, options.speed)
      context.uniform1i(resources.uniforms.streakCount, options.streakCount)
      context.uniform1f(resources.uniforms.streakWidth, options.streakWidth)
      context.uniform1f(resources.uniforms.streakLength, options.streakLength)
      context.uniform1f(resources.uniforms.glow, options.glow)
      context.uniform1f(resources.uniforms.density, options.density)
      context.uniform1f(resources.uniforms.twinkle, options.twinkle)
      context.uniform1f(resources.uniforms.zoom, options.zoom)
      context.uniform1f(resources.uniforms.backgroundGlow, options.backgroundGlow)
      context.uniform1f(resources.uniforms.opacity, options.opacity)
      context.uniform1f(resources.uniforms.mouseEnabled, options.mouseInteraction ? 1 : 0)
      context.uniform1f(resources.uniforms.mouseStrength, options.mouseStrength)
      context.uniform1f(resources.uniforms.mouseRadius, options.mouseRadius)
      context.drawArrays(context.TRIANGLE_STRIP, 0, 4)
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
      if (!hasMouse) {
        mouseTarget = [canvas.width * 0.5, canvas.height * 0.5]
        mouseCurrent = mouseTarget
      }
      drawFrame(performance.now(), shouldRun)

      return true
    }

    const handlePointerMove = (event: PointerEvent) => {
      const bounds = canvas.getBoundingClientRect()
      if (bounds.width <= 0 || bounds.height <= 0) {
        return
      }

      const x = (event.clientX - bounds.left) * (canvas.width / bounds.width)
      const y = (bounds.height - (event.clientY - bounds.top)) * (canvas.height / bounds.height)
      mouseTarget = [x, y]
      if (!hasMouse || options.mouseDampening <= 0) {
        mouseCurrent = mouseTarget
      }
      hasMouse = true
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

    const handleResize = () => {
      if (!resizeCanvas()) {
        requestResizeRetry()
      }
    }

    const resizeObserver = new ResizeObserver(handleResize)
    resizeObserver.observe(container)
    window.addEventListener("resize", handleResize)
    if (options.mouseInteraction) {
      window.addEventListener("pointermove", handlePointerMove, { passive: true })
    }
    reducedMotionQuery.addEventListener("change", updateAnimationState)
    compactViewportQuery.addEventListener("change", updateAnimationState)
    document.addEventListener("visibilitychange", updateAnimationState)
    updateAnimationState()

    return () => {
      stopAnimation()
      resizeObserver.disconnect()
      window.removeEventListener("resize", handleResize)
      if (options.mouseInteraction) {
        window.removeEventListener("pointermove", handlePointerMove)
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
  }, [backgroundRgb, options, palette])

  return (
    <div
      ref={containerRef}
      className={cn(styles.effectLayer, styles.reactBitsLightfall, className)}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className={styles.reactBitsLightfallCanvas} />
    </div>
  )
}

function createLightfallResources(context: WebGLRenderingContext): LightfallWebGlResources | null {
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

  context.useProgram(program)
  context.bindBuffer(context.ARRAY_BUFFER, positionBuffer)
  context.bufferData(
    context.ARRAY_BUFFER,
    new Float32Array([
      -1, -1,
      1, -1,
      -1, 1,
      1, 1,
    ]),
    context.STATIC_DRAW,
  )
  context.enableVertexAttribArray(position)
  context.vertexAttribPointer(position, 2, context.FLOAT, false, 0, 0)

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
      mouse: getUniformLocation(context, program, "iMouse"),
      time: getUniformLocation(context, program, "iTime"),
      color0: getUniformLocation(context, program, "uColor0"),
      color1: getUniformLocation(context, program, "uColor1"),
      color2: getUniformLocation(context, program, "uColor2"),
      color3: getUniformLocation(context, program, "uColor3"),
      color4: getUniformLocation(context, program, "uColor4"),
      color5: getUniformLocation(context, program, "uColor5"),
      color6: getUniformLocation(context, program, "uColor6"),
      color7: getUniformLocation(context, program, "uColor7"),
      colorCount: getUniformLocation(context, program, "uColorCount"),
      backgroundColor: getUniformLocation(context, program, "uBgColor"),
      mouseColor: getUniformLocation(context, program, "uMouseColor"),
      speed: getUniformLocation(context, program, "uSpeed"),
      streakCount: getUniformLocation(context, program, "uStreakCount"),
      streakWidth: getUniformLocation(context, program, "uStreakWidth"),
      streakLength: getUniformLocation(context, program, "uStreakLength"),
      glow: getUniformLocation(context, program, "uGlow"),
      density: getUniformLocation(context, program, "uDensity"),
      twinkle: getUniformLocation(context, program, "uTwinkle"),
      zoom: getUniformLocation(context, program, "uZoom"),
      backgroundGlow: getUniformLocation(context, program, "uBgGlow"),
      opacity: getUniformLocation(context, program, "uOpacity"),
      mouseEnabled: getUniformLocation(context, program, "uMouseEnabled"),
      mouseStrength: getUniformLocation(context, program, "uMouseStrength"),
      mouseRadius: getUniformLocation(context, program, "uMouseRadius"),
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
    throw new Error(`Missing React Bits Lightfall shader uniform: ${name}`)
  }

  return location
}

function resolveLightfallOptions(options: ReactBitsLightfallOptions | undefined): ResolvedLightfallOptions {
  return {
    colors: resolveLightfallColors(options?.colors),
    backgroundColor: normalizeHexColor(options?.backgroundColor, DEFAULT_REACT_BITS_LIGHTFALL.backgroundColor),
    speed: clampNumber(options?.speed, DEFAULT_REACT_BITS_LIGHTFALL.speed, 0.05, 2),
    streakCount: Math.trunc(clampNumber(options?.streakCount, DEFAULT_REACT_BITS_LIGHTFALL.streakCount, 1, 16)),
    streakWidth: clampNumber(options?.streakWidth, DEFAULT_REACT_BITS_LIGHTFALL.streakWidth, 0.2, 3),
    streakLength: clampNumber(options?.streakLength, DEFAULT_REACT_BITS_LIGHTFALL.streakLength, 0.2, 3),
    glow: clampNumber(options?.glow, DEFAULT_REACT_BITS_LIGHTFALL.glow, 0.1, 3),
    density: clampNumber(options?.density, DEFAULT_REACT_BITS_LIGHTFALL.density, 0.05, 2),
    twinkle: clampNumber(options?.twinkle, DEFAULT_REACT_BITS_LIGHTFALL.twinkle, 0, 1),
    zoom: clampNumber(options?.zoom, DEFAULT_REACT_BITS_LIGHTFALL.zoom, 1, 6),
    backgroundGlow: clampNumber(options?.backgroundGlow, DEFAULT_REACT_BITS_LIGHTFALL.backgroundGlow, 0, 1.5),
    opacity: clampNumber(options?.opacity, DEFAULT_REACT_BITS_LIGHTFALL.opacity, 0.05, 1),
    mouseInteraction: options?.mouseInteraction === true,
    mouseStrength: clampNumber(options?.mouseStrength, DEFAULT_REACT_BITS_LIGHTFALL.mouseStrength, 0, 2),
    mouseRadius: clampNumber(options?.mouseRadius, DEFAULT_REACT_BITS_LIGHTFALL.mouseRadius, 0.05, 3),
    mouseDampening: clampNumber(options?.mouseDampening, DEFAULT_REACT_BITS_LIGHTFALL.mouseDampening, 0, 1),
  }
}

function resolveLightfallColors(colors: string[] | undefined) {
  const sanitized = (Array.isArray(colors) ? colors : [])
    .map((color) => normalizeHexColor(color, ""))
    .filter(Boolean)
    .slice(0, MAX_LIGHTFALL_COLORS)

  return sanitized.length ? sanitized : DEFAULT_REACT_BITS_LIGHTFALL.colors
}

function prepLightfallColors(colors: string[]) {
  const base = resolveLightfallColors(colors)
  const arr: RgbColor[] = []
  for (let index = 0; index < MAX_LIGHTFALL_COLORS; index += 1) {
    arr.push(parseHexColorToRgb(base[Math.min(index, base.length - 1)] ?? DEFAULT_REACT_BITS_LIGHTFALL.colors[0]))
  }
  const avg: RgbColor = [0, 0, 0]
  for (let index = 0; index < base.length; index += 1) {
    avg[0] += arr[index][0]
    avg[1] += arr[index][1]
    avg[2] += arr[index][2]
  }
  avg[0] /= base.length
  avg[1] /= base.length
  avg[2] /= base.length

  return {
    arr,
    count: base.length,
    avg,
  }
}

function normalizeHexColor(value: string | undefined, fallback: string) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value) ? value.toUpperCase() : fallback
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback
}

function parseHexColorToRgb(value: string): RgbColor {
  const hex = normalizeHexColor(value, "#FFFFFF").slice(1)
  return [
    Number.parseInt(hex.slice(0, 2), 16) / 255,
    Number.parseInt(hex.slice(2, 4), 16) / 255,
    Number.parseInt(hex.slice(4, 6), 16) / 255,
  ]
}
