"use client"

import { useEffect, useMemo, useRef } from "react"
import type { CSSProperties } from "react"
import { shouldAnimateAmbientBackground } from "@/lib/motion-preferences"
import { cn } from "@/lib/utils"
import styles from "@/components/backgrounds/BackgroundHost.module.css"
import type { BackgroundEffectProps, MassageLabFloatingLinesOptions } from "./css-backgrounds"

type RgbColor = [number, number, number]
type ResolvedFloatingLinesOptions = Required<Omit<MassageLabFloatingLinesOptions, "linesGradient">> & {
  linesGradient: RgbColor[]
}

type FloatingLinesResources = {
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
    animationSpeed: WebGLUniformLocation
    enableTop: WebGLUniformLocation
    enableMiddle: WebGLUniformLocation
    enableBottom: WebGLUniformLocation
    topLineCount: WebGLUniformLocation
    middleLineCount: WebGLUniformLocation
    bottomLineCount: WebGLUniformLocation
    topLineDistance: WebGLUniformLocation
    middleLineDistance: WebGLUniformLocation
    bottomLineDistance: WebGLUniformLocation
    topWavePosition: WebGLUniformLocation
    middleWavePosition: WebGLUniformLocation
    bottomWavePosition: WebGLUniformLocation
    mouse: WebGLUniformLocation
    interactive: WebGLUniformLocation
    bendRadius: WebGLUniformLocation
    bendStrength: WebGLUniformLocation
    bendInfluence: WebGLUniformLocation
    parallax: WebGLUniformLocation
    parallaxOffset: WebGLUniformLocation
    lineGradient: WebGLUniformLocation
    lineGradientCount: WebGLUniformLocation
  }
}

const MAX_GRADIENT_STOPS = 8
const MAX_LINE_COUNT = 32

const DEFAULT_MASSAGELAB_FLOATING_LINES: ResolvedFloatingLinesOptions = {
  linesGradient: [],
  enableTop: true,
  enableMiddle: true,
  enableBottom: true,
  topLineCount: 6,
  middleLineCount: 6,
  bottomLineCount: 6,
  topLineDistance: 5,
  middleLineDistance: 0.1,
  bottomLineDistance: 0.1,
  topWaveX: 10,
  topWaveY: 0.5,
  topWaveRotate: -0.4,
  middleWaveX: 5,
  middleWaveY: 0,
  middleWaveRotate: 0.2,
  bottomWaveX: 2,
  bottomWaveY: -0.7,
  bottomWaveRotate: -1,
  animationSpeed: 1,
  interactive: true,
  bendRadius: 5,
  bendStrength: -0.5,
  mouseDamping: 0.05,
  parallax: true,
  parallaxStrength: 0.2,
  mixBlendMode: "screen",
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
  uniform vec3  iResolution;
  uniform float animationSpeed;

  uniform bool enableTop;
  uniform bool enableMiddle;
  uniform bool enableBottom;

  uniform int topLineCount;
  uniform int middleLineCount;
  uniform int bottomLineCount;

  uniform float topLineDistance;
  uniform float middleLineDistance;
  uniform float bottomLineDistance;

  uniform vec3 topWavePosition;
  uniform vec3 middleWavePosition;
  uniform vec3 bottomWavePosition;

  uniform vec2 iMouse;
  uniform bool interactive;
  uniform float bendRadius;
  uniform float bendStrength;
  uniform float bendInfluence;

  uniform bool parallax;
  uniform vec2 parallaxOffset;

  uniform vec3 lineGradient[8];
  uniform int lineGradientCount;

  const int MAX_LINES = 32;
  const vec3 BLACK = vec3(0.0);
  const vec3 PINK  = vec3(233.0, 71.0, 245.0) / 255.0;
  const vec3 BLUE  = vec3(47.0,  75.0, 162.0) / 255.0;

  mat2 rotate(float r) {
    return mat2(cos(r), sin(r), -sin(r), cos(r));
  }

  vec3 background_color(vec2 uv) {
    vec3 col = vec3(0.0);

    float y = sin(uv.x - 0.2) * 0.3 - 0.1;
    float m = uv.y - y;

    col += mix(BLUE, BLACK, smoothstep(0.0, 1.0, abs(m)));
    col += mix(PINK, BLACK, smoothstep(0.0, 1.0, abs(m - 0.8)));
    return col * 0.5;
  }

  vec3 getGradientStop(int idx) {
    if (idx == 0) return lineGradient[0];
    if (idx == 1) return lineGradient[1];
    if (idx == 2) return lineGradient[2];
    if (idx == 3) return lineGradient[3];
    if (idx == 4) return lineGradient[4];
    if (idx == 5) return lineGradient[5];
    if (idx == 6) return lineGradient[6];
    return lineGradient[7];
  }

  vec3 getLineColor(float t, vec3 baseColor) {
    if (lineGradientCount <= 0) {
      return baseColor;
    }

    vec3 gradientColor;

    if (lineGradientCount == 1) {
      gradientColor = lineGradient[0];
    } else {
      float clampedT = clamp(t, 0.0, 0.9999);
      float scaled = clampedT * float(lineGradientCount - 1);
      int idx = int(floor(scaled));
      float f = fract(scaled);
      int idx2 = idx + 1;

      if (idx2 >= lineGradientCount) {
        idx2 = lineGradientCount - 1;
      }

      vec3 c1 = getGradientStop(idx);
      vec3 c2 = getGradientStop(idx2);

      gradientColor = mix(c1, c2, f);
    }

    return gradientColor * 0.5;
  }

  float wave(vec2 uv, float offset, vec2 screenUv, vec2 mouseUv, bool shouldBend) {
    float time = iTime * animationSpeed;

    float x_offset   = offset;
    float x_movement = time * 0.1;
    float amp        = sin(offset + time * 0.2) * 0.3;
    float y          = sin(uv.x + x_offset + x_movement) * amp;

    if (shouldBend) {
      vec2 d = screenUv - mouseUv;
      float influence = exp(-dot(d, d) * bendRadius);
      float bendOffset = (mouseUv.y - screenUv.y) * influence * bendStrength * bendInfluence;
      y += bendOffset;
    }

    float m = uv.y - y;
    return 0.0175 / max(abs(m) + 0.01, 1e-3) + 0.01;
  }

  void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 baseUv = (2.0 * fragCoord - iResolution.xy) / iResolution.y;
    baseUv.y *= -1.0;

    if (parallax) {
      baseUv += parallaxOffset;
    }

    vec3 col = vec3(0.0);
    vec3 b = lineGradientCount > 0 ? vec3(0.0) : background_color(baseUv);

    vec2 mouseUv = vec2(0.0);
    if (interactive) {
      mouseUv = (2.0 * iMouse - iResolution.xy) / iResolution.y;
      mouseUv.y *= -1.0;
    }

    if (enableBottom) {
      for (int i = 0; i < MAX_LINES; ++i) {
        if (i < bottomLineCount) {
          float fi = float(i);
          float t = fi / max(float(bottomLineCount - 1), 1.0);
          vec3 lineCol = getLineColor(t, b);

          float angle = bottomWavePosition.z * log(length(baseUv) + 1.0);
          vec2 ruv = baseUv * rotate(angle);
          col += lineCol * wave(
            ruv + vec2(bottomLineDistance * fi + bottomWavePosition.x, bottomWavePosition.y),
            1.5 + 0.2 * fi,
            baseUv,
            mouseUv,
            interactive
          ) * 0.2;
        }
      }
    }

    if (enableMiddle) {
      for (int i = 0; i < MAX_LINES; ++i) {
        if (i < middleLineCount) {
          float fi = float(i);
          float t = fi / max(float(middleLineCount - 1), 1.0);
          vec3 lineCol = getLineColor(t, b);

          float angle = middleWavePosition.z * log(length(baseUv) + 1.0);
          vec2 ruv = baseUv * rotate(angle);
          col += lineCol * wave(
            ruv + vec2(middleLineDistance * fi + middleWavePosition.x, middleWavePosition.y),
            2.0 + 0.15 * fi,
            baseUv,
            mouseUv,
            interactive
          );
        }
      }
    }

    if (enableTop) {
      for (int i = 0; i < MAX_LINES; ++i) {
        if (i < topLineCount) {
          float fi = float(i);
          float t = fi / max(float(topLineCount - 1), 1.0);
          vec3 lineCol = getLineColor(t, b);

          float angle = topWavePosition.z * log(length(baseUv) + 1.0);
          vec2 ruv = baseUv * rotate(angle);
          ruv.x *= -1.0;
          col += lineCol * wave(
            ruv + vec2(topLineDistance * fi + topWavePosition.x, topWavePosition.y),
            1.0 + 0.2 * fi,
            baseUv,
            mouseUv,
            interactive
          ) * 0.1;
        }
      }
    }

    fragColor = vec4(col, 1.0);
  }

  void main() {
    vec4 color = vec4(0.0);
    mainImage(color, gl_FragCoord.xy);
    gl_FragColor = color;
  }
`

// MassageLab Floating Lines ships as a Three.js ShaderMaterial. MassageLab
// keeps the shader model and interaction math while owning the WebGL shell.
export default function MassageLabFloatingLinesBackground({
  className,
  massageLabFloatingLines,
}: BackgroundEffectProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const gradientKey = massageLabFloatingLines?.linesGradient?.join("|") ?? ""
  const options = useMemo(
    () => resolveFloatingLinesOptions(massageLabFloatingLines),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      gradientKey,
      massageLabFloatingLines?.enableTop,
      massageLabFloatingLines?.enableMiddle,
      massageLabFloatingLines?.enableBottom,
      massageLabFloatingLines?.topLineCount,
      massageLabFloatingLines?.middleLineCount,
      massageLabFloatingLines?.bottomLineCount,
      massageLabFloatingLines?.topLineDistance,
      massageLabFloatingLines?.middleLineDistance,
      massageLabFloatingLines?.bottomLineDistance,
      massageLabFloatingLines?.topWaveX,
      massageLabFloatingLines?.topWaveY,
      massageLabFloatingLines?.topWaveRotate,
      massageLabFloatingLines?.middleWaveX,
      massageLabFloatingLines?.middleWaveY,
      massageLabFloatingLines?.middleWaveRotate,
      massageLabFloatingLines?.bottomWaveX,
      massageLabFloatingLines?.bottomWaveY,
      massageLabFloatingLines?.bottomWaveRotate,
      massageLabFloatingLines?.animationSpeed,
      massageLabFloatingLines?.interactive,
      massageLabFloatingLines?.bendRadius,
      massageLabFloatingLines?.bendStrength,
      massageLabFloatingLines?.mouseDamping,
      massageLabFloatingLines?.parallax,
      massageLabFloatingLines?.parallaxStrength,
      massageLabFloatingLines?.mixBlendMode,
    ],
  )

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    const context = canvas?.getContext("webgl", {
      alpha: false,
      antialias: true,
      depth: false,
      powerPreference: "high-performance",
      preserveDrawingBuffer: false,
      stencil: false,
    })

    if (!container || !canvas || !context) {
      return undefined
    }

    const resources = createFloatingLinesResources(context)

    if (!resources) {
      return undefined
    }

    context.disable(context.DEPTH_TEST)
    context.disable(context.CULL_FACE)
    context.disable(context.BLEND)

    const startTimestamp = performance.now()
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const compactViewportQuery = window.matchMedia("(max-width: 360px), (max-height: 360px)")
    const targetMouse = { x: -1000, y: -1000 }
    const currentMouse = { x: -1000, y: -1000 }
    const targetParallax = { x: 0, y: 0 }
    const currentParallax = { x: 0, y: 0 }
    let targetInfluence = 0
    let currentInfluence = 0
    let animationFrame = 0
    let resizeRetryFrame = 0
    let shouldRun = false

    const bindStaticUniforms = () => {
      const gradient = flattenGradient(options.linesGradient)
      context.useProgram(resources.program)
      context.uniform1f(resources.uniforms.animationSpeed, options.animationSpeed)
      context.uniform1i(resources.uniforms.enableTop, options.enableTop ? 1 : 0)
      context.uniform1i(resources.uniforms.enableMiddle, options.enableMiddle ? 1 : 0)
      context.uniform1i(resources.uniforms.enableBottom, options.enableBottom ? 1 : 0)
      context.uniform1i(resources.uniforms.topLineCount, options.topLineCount)
      context.uniform1i(resources.uniforms.middleLineCount, options.middleLineCount)
      context.uniform1i(resources.uniforms.bottomLineCount, options.bottomLineCount)
      context.uniform1f(resources.uniforms.topLineDistance, options.topLineDistance * 0.01)
      context.uniform1f(resources.uniforms.middleLineDistance, options.middleLineDistance * 0.01)
      context.uniform1f(resources.uniforms.bottomLineDistance, options.bottomLineDistance * 0.01)
      context.uniform3f(resources.uniforms.topWavePosition, options.topWaveX, options.topWaveY, options.topWaveRotate)
      context.uniform3f(
        resources.uniforms.middleWavePosition,
        options.middleWaveX,
        options.middleWaveY,
        options.middleWaveRotate,
      )
      context.uniform3f(
        resources.uniforms.bottomWavePosition,
        options.bottomWaveX,
        options.bottomWaveY,
        options.bottomWaveRotate,
      )
      context.uniform1i(resources.uniforms.interactive, options.interactive ? 1 : 0)
      context.uniform1f(resources.uniforms.bendRadius, options.bendRadius)
      context.uniform1f(resources.uniforms.bendStrength, options.bendStrength)
      context.uniform1i(resources.uniforms.parallax, options.parallax ? 1 : 0)
      context.uniform3fv(resources.uniforms.lineGradient, gradient)
      context.uniform1i(resources.uniforms.lineGradientCount, options.linesGradient.length)
    }

    const updateMotionUniforms = (animate: boolean) => {
      if (animate && options.interactive) {
        currentMouse.x += (targetMouse.x - currentMouse.x) * options.mouseDamping
        currentMouse.y += (targetMouse.y - currentMouse.y) * options.mouseDamping
        currentInfluence += (targetInfluence - currentInfluence) * options.mouseDamping
      } else if (!animate) {
        currentInfluence = 0
      }

      if (animate && options.parallax) {
        currentParallax.x += (targetParallax.x - currentParallax.x) * options.mouseDamping
        currentParallax.y += (targetParallax.y - currentParallax.y) * options.mouseDamping
      }

      context.uniform2f(resources.uniforms.mouse, currentMouse.x, currentMouse.y)
      context.uniform1f(resources.uniforms.bendInfluence, currentInfluence)
      context.uniform2f(resources.uniforms.parallaxOffset, currentParallax.x, currentParallax.y)
    }

    const drawFrame = (timestamp: number, animate: boolean) => {
      if (canvas.width <= 1 || canvas.height <= 1) {
        return false
      }

      const elapsedSeconds = animate ? Math.max(0, (timestamp - startTimestamp) / 1000) : 0
      context.viewport(0, 0, canvas.width, canvas.height)
      context.clearColor(0, 0, 0, 1)
      context.clear(context.COLOR_BUFFER_BIT)
      context.useProgram(resources.program)
      context.bindBuffer(context.ARRAY_BUFFER, resources.positionBuffer)
      context.enableVertexAttribArray(resources.attributes.position)
      context.vertexAttribPointer(resources.attributes.position, 2, context.FLOAT, false, 0, 0)
      context.uniform1f(resources.uniforms.time, elapsedSeconds)
      context.uniform3f(resources.uniforms.resolution, canvas.width, canvas.height, 1)
      updateMotionUniforms(animate)
      context.drawArrays(context.TRIANGLES, 0, 3)

      return animate && (options.animationSpeed >= 1e-6 || options.interactive || options.parallax)
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

    const handlePointerMove = (event: PointerEvent) => {
      if (!options.interactive && !options.parallax) {
        return
      }

      const rect = canvas.getBoundingClientRect()

      if (rect.width <= 0 || rect.height <= 0) {
        return
      }

      const x = event.clientX - rect.left
      const y = event.clientY - rect.top
      const dprX = canvas.width / rect.width
      const dprY = canvas.height / rect.height
      targetMouse.x = x * dprX
      targetMouse.y = (rect.height - y) * dprY
      targetInfluence = 1

      if (options.parallax) {
        const centerX = rect.width / 2
        const centerY = rect.height / 2
        const offsetX = (x - centerX) / rect.width
        const offsetY = -(y - centerY) / rect.height
        targetParallax.x = offsetX * options.parallaxStrength
        targetParallax.y = offsetY * options.parallaxStrength
      }
    }

    const handlePointerOut = (event: PointerEvent) => {
      if (!event.relatedTarget) {
        targetInfluence = 0
      }
    }

    const handleVisibilityChange = () => render()
    const resizeObserver = new ResizeObserver(render)
    resizeObserver.observe(container)
    window.addEventListener("resize", render)
    document.addEventListener("visibilitychange", handleVisibilityChange)
    reducedMotionQuery.addEventListener("change", render)
    compactViewportQuery.addEventListener("change", render)
    if (options.interactive || options.parallax) {
      window.addEventListener("pointermove", handlePointerMove)
      window.addEventListener("pointerout", handlePointerOut)
    }
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
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerout", handlePointerOut)
      context.deleteBuffer(resources.positionBuffer)
      context.detachShader(resources.program, resources.vertexShader)
      context.detachShader(resources.program, resources.fragmentShader)
      context.deleteShader(resources.vertexShader)
      context.deleteShader(resources.fragmentShader)
      context.deleteProgram(resources.program)
      canvas.width = 1
      canvas.height = 1
    }
  }, [options])

  return (
    <div
      ref={containerRef}
      className={cn(styles.effectLayer, styles.massageLabFloatingLines, className)}
      style={{ mixBlendMode: options.mixBlendMode } as CSSProperties}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className={styles.massageLabFloatingLinesCanvas} />
    </div>
  )
}

function createFloatingLinesResources(context: WebGLRenderingContext): FloatingLinesResources | null {
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
      animationSpeed: getUniformLocation(context, program, "animationSpeed"),
      enableTop: getUniformLocation(context, program, "enableTop"),
      enableMiddle: getUniformLocation(context, program, "enableMiddle"),
      enableBottom: getUniformLocation(context, program, "enableBottom"),
      topLineCount: getUniformLocation(context, program, "topLineCount"),
      middleLineCount: getUniformLocation(context, program, "middleLineCount"),
      bottomLineCount: getUniformLocation(context, program, "bottomLineCount"),
      topLineDistance: getUniformLocation(context, program, "topLineDistance"),
      middleLineDistance: getUniformLocation(context, program, "middleLineDistance"),
      bottomLineDistance: getUniformLocation(context, program, "bottomLineDistance"),
      topWavePosition: getUniformLocation(context, program, "topWavePosition"),
      middleWavePosition: getUniformLocation(context, program, "middleWavePosition"),
      bottomWavePosition: getUniformLocation(context, program, "bottomWavePosition"),
      mouse: getUniformLocation(context, program, "iMouse"),
      interactive: getUniformLocation(context, program, "interactive"),
      bendRadius: getUniformLocation(context, program, "bendRadius"),
      bendStrength: getUniformLocation(context, program, "bendStrength"),
      bendInfluence: getUniformLocation(context, program, "bendInfluence"),
      parallax: getUniformLocation(context, program, "parallax"),
      parallaxOffset: getUniformLocation(context, program, "parallaxOffset"),
      lineGradient: getUniformLocation(context, program, "lineGradient[0]"),
      lineGradientCount: getUniformLocation(context, program, "lineGradientCount"),
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
    throw new Error(`Missing MassageLab Floating Lines shader uniform: ${name}`)
  }

  return location
}

function resolveFloatingLinesOptions(
  options: MassageLabFloatingLinesOptions | undefined,
): ResolvedFloatingLinesOptions {
  return {
    linesGradient: resolveGradient(options?.linesGradient),
    enableTop: resolveBoolean(options?.enableTop, DEFAULT_MASSAGELAB_FLOATING_LINES.enableTop),
    enableMiddle: resolveBoolean(options?.enableMiddle, DEFAULT_MASSAGELAB_FLOATING_LINES.enableMiddle),
    enableBottom: resolveBoolean(options?.enableBottom, DEFAULT_MASSAGELAB_FLOATING_LINES.enableBottom),
    topLineCount: Math.trunc(resolveNumber(options?.topLineCount, DEFAULT_MASSAGELAB_FLOATING_LINES.topLineCount, 0, MAX_LINE_COUNT)),
    middleLineCount: Math.trunc(resolveNumber(options?.middleLineCount, DEFAULT_MASSAGELAB_FLOATING_LINES.middleLineCount, 0, MAX_LINE_COUNT)),
    bottomLineCount: Math.trunc(resolveNumber(options?.bottomLineCount, DEFAULT_MASSAGELAB_FLOATING_LINES.bottomLineCount, 0, MAX_LINE_COUNT)),
    topLineDistance: resolveNumber(options?.topLineDistance, DEFAULT_MASSAGELAB_FLOATING_LINES.topLineDistance, 0.1, 20),
    middleLineDistance: resolveNumber(options?.middleLineDistance, DEFAULT_MASSAGELAB_FLOATING_LINES.middleLineDistance, 0.1, 20),
    bottomLineDistance: resolveNumber(options?.bottomLineDistance, DEFAULT_MASSAGELAB_FLOATING_LINES.bottomLineDistance, 0.1, 20),
    topWaveX: resolveNumber(options?.topWaveX, DEFAULT_MASSAGELAB_FLOATING_LINES.topWaveX, -20, 20),
    topWaveY: resolveNumber(options?.topWaveY, DEFAULT_MASSAGELAB_FLOATING_LINES.topWaveY, -4, 4),
    topWaveRotate: resolveNumber(options?.topWaveRotate, DEFAULT_MASSAGELAB_FLOATING_LINES.topWaveRotate, -4, 4),
    middleWaveX: resolveNumber(options?.middleWaveX, DEFAULT_MASSAGELAB_FLOATING_LINES.middleWaveX, -20, 20),
    middleWaveY: resolveNumber(options?.middleWaveY, DEFAULT_MASSAGELAB_FLOATING_LINES.middleWaveY, -4, 4),
    middleWaveRotate: resolveNumber(options?.middleWaveRotate, DEFAULT_MASSAGELAB_FLOATING_LINES.middleWaveRotate, -4, 4),
    bottomWaveX: resolveNumber(options?.bottomWaveX, DEFAULT_MASSAGELAB_FLOATING_LINES.bottomWaveX, -20, 20),
    bottomWaveY: resolveNumber(options?.bottomWaveY, DEFAULT_MASSAGELAB_FLOATING_LINES.bottomWaveY, -4, 4),
    bottomWaveRotate: resolveNumber(options?.bottomWaveRotate, DEFAULT_MASSAGELAB_FLOATING_LINES.bottomWaveRotate, -4, 4),
    animationSpeed: resolveNumber(options?.animationSpeed, DEFAULT_MASSAGELAB_FLOATING_LINES.animationSpeed, 0, 4),
    interactive: resolveBoolean(options?.interactive, DEFAULT_MASSAGELAB_FLOATING_LINES.interactive),
    bendRadius: resolveNumber(options?.bendRadius, DEFAULT_MASSAGELAB_FLOATING_LINES.bendRadius, 0.1, 20),
    bendStrength: resolveNumber(options?.bendStrength, DEFAULT_MASSAGELAB_FLOATING_LINES.bendStrength, -2, 2),
    mouseDamping: resolveNumber(options?.mouseDamping, DEFAULT_MASSAGELAB_FLOATING_LINES.mouseDamping, 0.01, 1),
    parallax: resolveBoolean(options?.parallax, DEFAULT_MASSAGELAB_FLOATING_LINES.parallax),
    parallaxStrength: resolveNumber(options?.parallaxStrength, DEFAULT_MASSAGELAB_FLOATING_LINES.parallaxStrength, 0, 1),
    mixBlendMode: resolveBlendMode(options?.mixBlendMode),
  }
}

function resolveGradient(colors: string[] | undefined): RgbColor[] {
  if (!Array.isArray(colors)) {
    return []
  }

  return colors
    .slice(0, MAX_GRADIENT_STOPS)
    .map((color) => parseHexColorToRgb(color))
}

function flattenGradient(colors: RgbColor[]) {
  const values = new Float32Array(MAX_GRADIENT_STOPS * 3)
  colors.slice(0, MAX_GRADIENT_STOPS).forEach((color, index) => {
    values[index * 3] = color[0]
    values[index * 3 + 1] = color[1]
    values[index * 3 + 2] = color[2]
  })
  return values
}

function parseHexColorToRgb(color: string): RgbColor {
  const normalized = resolveHexColor(color, "#FFFFFF").replace("#", "")
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

function resolveBoolean(value: boolean | undefined, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback
}

function resolveBlendMode(value: string | undefined): ResolvedFloatingLinesOptions["mixBlendMode"] {
  if (value === "normal" || value === "lighten" || value === "plus-lighter") {
    return value
  }

  return "screen"
}
