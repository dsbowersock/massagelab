"use client"

import { useEffect, useMemo, useRef } from "react"
import { shouldAnimateAmbientBackground } from "@/lib/motion-preferences"
import { cn } from "@/lib/utils"
import styles from "@/components/backgrounds/BackgroundHost.module.css"
import type { BackgroundEffectProps, ReactBitsPixelBlastOptions } from "./css-backgrounds"

type RgbColor = [number, number, number]
type PixelBlastVariant = NonNullable<ReactBitsPixelBlastOptions["variant"]>
type ResolvedPixelBlastOptions = Required<ReactBitsPixelBlastOptions>

type PixelBlastResources = {
  program: WebGLProgram
  vertexShader: WebGLShader
  fragmentShader: WebGLShader
  positionBuffer: WebGLBuffer
  attributes: {
    position: number
  }
  uniforms: {
    color: WebGLUniformLocation
    resolution: WebGLUniformLocation
    time: WebGLUniformLocation
    pixelSize: WebGLUniformLocation
    scale: WebGLUniformLocation
    density: WebGLUniformLocation
    pixelJitter: WebGLUniformLocation
    enableRipples: WebGLUniformLocation
    rippleSpeed: WebGLUniformLocation
    rippleThickness: WebGLUniformLocation
    rippleIntensity: WebGLUniformLocation
    edgeFade: WebGLUniformLocation
    shapeType: WebGLUniformLocation
    clickPosition: WebGLUniformLocation
    clickTimes: WebGLUniformLocation
    liquid: WebGLUniformLocation
    touchTexture: WebGLUniformLocation
    liquidStrength: WebGLUniformLocation
    liquidWobbleSpeed: WebGLUniformLocation
    noiseAmount: WebGLUniformLocation
  }
}

type TouchTexture = {
  texture: WebGLTexture
  addTouch: (point: { x: number; y: number }) => void
  update: () => void
  radiusScale: number
}

const MAX_CLICKS = 10
const SHAPE_MAP: Record<PixelBlastVariant, number> = {
  square: 0,
  circle: 1,
  triangle: 2,
  diamond: 3,
}

const DEFAULT_REACT_BITS_PIXEL_BLAST: ResolvedPixelBlastOptions = {
  variant: "square",
  pixelSize: 3,
  color: "#B497CF",
  antialias: true,
  patternScale: 2,
  patternDensity: 1,
  liquid: false,
  liquidStrength: 0.1,
  liquidRadius: 1,
  pixelSizeJitter: 0,
  enableRipples: true,
  rippleIntensityScale: 1,
  rippleThickness: 0.1,
  rippleSpeed: 0.3,
  liquidWobbleSpeed: 4.5,
  autoPauseOffscreen: true,
  speed: 0.5,
  transparent: true,
  edgeFade: 0.5,
  noiseAmount: 0,
}

const vertexShaderSource = `
  attribute vec2 aPosition;

  void main() {
    gl_Position = vec4(aPosition, 0.0, 1.0);
  }
`

const fragmentShaderSource = `
  #extension GL_OES_standard_derivatives : enable
  precision highp float;

  uniform vec3 uColor;
  uniform vec2 uResolution;
  uniform float uTime;
  uniform float uPixelSize;
  uniform float uScale;
  uniform float uDensity;
  uniform float uPixelJitter;
  uniform int uEnableRipples;
  uniform float uRippleSpeed;
  uniform float uRippleThickness;
  uniform float uRippleIntensity;
  uniform float uEdgeFade;
  uniform int uShapeType;
  uniform vec2 uClickPos[10];
  uniform float uClickTimes[10];
  uniform int uLiquid;
  uniform sampler2D uTouchTexture;
  uniform float uLiquidStrength;
  uniform float uLiquidWobbleSpeed;
  uniform float uNoiseAmount;

  const int SHAPE_SQUARE = 0;
  const int SHAPE_CIRCLE = 1;
  const int SHAPE_TRIANGLE = 2;
  const int SHAPE_DIAMOND = 3;
  const int MAX_CLICKS = 10;
  const int FBM_OCTAVES = 5;
  const float FBM_LACUNARITY = 1.25;
  const float FBM_GAIN = 1.0;

  float Bayer2(vec2 a) {
    a = floor(a);
    return fract(a.x / 2.0 + a.y * a.y * 0.75);
  }

  #define Bayer4(a) (Bayer2(0.5 * (a)) * 0.25 + Bayer2(a))
  #define Bayer8(a) (Bayer4(0.5 * (a)) * 0.25 + Bayer2(a))

  float hash11(float n) {
    return fract(sin(n) * 43758.5453);
  }

  float hash21(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  float vnoise(vec3 p) {
    vec3 ip = floor(p);
    vec3 fp = fract(p);
    float n000 = hash11(dot(ip + vec3(0.0, 0.0, 0.0), vec3(1.0, 57.0, 113.0)));
    float n100 = hash11(dot(ip + vec3(1.0, 0.0, 0.0), vec3(1.0, 57.0, 113.0)));
    float n010 = hash11(dot(ip + vec3(0.0, 1.0, 0.0), vec3(1.0, 57.0, 113.0)));
    float n110 = hash11(dot(ip + vec3(1.0, 1.0, 0.0), vec3(1.0, 57.0, 113.0)));
    float n001 = hash11(dot(ip + vec3(0.0, 0.0, 1.0), vec3(1.0, 57.0, 113.0)));
    float n101 = hash11(dot(ip + vec3(1.0, 0.0, 1.0), vec3(1.0, 57.0, 113.0)));
    float n011 = hash11(dot(ip + vec3(0.0, 1.0, 1.0), vec3(1.0, 57.0, 113.0)));
    float n111 = hash11(dot(ip + vec3(1.0, 1.0, 1.0), vec3(1.0, 57.0, 113.0)));
    vec3 w = fp * fp * fp * (fp * (fp * 6.0 - 15.0) + 10.0);
    float x00 = mix(n000, n100, w.x);
    float x10 = mix(n010, n110, w.x);
    float x01 = mix(n001, n101, w.x);
    float x11 = mix(n011, n111, w.x);
    float y0 = mix(x00, x10, w.y);
    float y1 = mix(x01, x11, w.y);
    return mix(y0, y1, w.z) * 2.0 - 1.0;
  }

  float fbm2(vec2 uv, float t) {
    vec3 p = vec3(uv * uScale, t);
    float amp = 1.0;
    float freq = 1.0;
    float sum = 1.0;

    for (int i = 0; i < FBM_OCTAVES; ++i) {
      sum += amp * vnoise(p * freq);
      freq *= FBM_LACUNARITY;
      amp *= FBM_GAIN;
    }

    return sum * 0.5 + 0.5;
  }

  float maskCircle(vec2 p, float cov) {
    float r = sqrt(cov) * 0.25;
    float d = length(p - 0.5) - r;
    float aa = 0.5 * fwidth(d);
    return cov * (1.0 - smoothstep(-aa, aa, d * 2.0));
  }

  float maskTriangle(vec2 p, vec2 id, float cov) {
    bool flip = mod(id.x + id.y, 2.0) > 0.5;
    if (flip) p.x = 1.0 - p.x;
    float r = sqrt(cov);
    float d = p.y - r * (1.0 - p.x);
    float aa = fwidth(d);
    return cov * clamp(0.5 - d / aa, 0.0, 1.0);
  }

  float maskDiamond(vec2 p, float cov) {
    float r = sqrt(cov) * 0.564;
    return step(abs(p.x - 0.49) + abs(p.y - 0.49), r);
  }

  vec4 renderPixelBlast(vec2 fragCoord) {
    float pixelSize = max(uPixelSize, 0.5);
    vec2 centeredCoord = fragCoord - uResolution * 0.5;
    float aspectRatio = uResolution.x / uResolution.y;
    vec2 pixelId = floor(centeredCoord / pixelSize);
    vec2 pixelUV = fract(centeredCoord / pixelSize);
    float cellPixelSize = 8.0 * pixelSize;
    vec2 cellId = floor(centeredCoord / cellPixelSize);
    vec2 cellCoord = cellId * cellPixelSize;
    vec2 uv = cellCoord / uResolution * vec2(aspectRatio, 1.0);
    float base = fbm2(uv, uTime * 0.05);
    base = base * 0.5 - 0.65;
    float feed = base + (uDensity - 0.5) * 0.3;
    const float dampT = 1.0;
    const float dampR = 10.0;

    if (uEnableRipples == 1) {
      for (int i = 0; i < MAX_CLICKS; ++i) {
        vec2 pos = uClickPos[i];
        if (pos.x >= 0.0) {
          vec2 cuv = (((pos - uResolution * 0.5 - cellPixelSize * 0.5) / uResolution)) * vec2(aspectRatio, 1.0);
          float t = max(uTime - uClickTimes[i], 0.0);
          float r = distance(uv, cuv);
          float waveR = uRippleSpeed * t;
          float ring = exp(-pow((r - waveR) / max(uRippleThickness, 0.001), 2.0));
          float atten = exp(-dampT * t) * exp(-dampR * r);
          feed = max(feed, ring * atten * uRippleIntensity);
        }
      }
    }

    float bayer = Bayer8(centeredCoord / pixelSize) - 0.5;
    float bw = step(0.5, feed + bayer);
    float h = hash21(floor(centeredCoord / pixelSize));
    float jitterScale = 1.0 + (h - 0.5) * uPixelJitter;
    float coverage = bw * jitterScale;
    float mask;

    if (uShapeType == SHAPE_CIRCLE) {
      mask = maskCircle(pixelUV, coverage);
    } else if (uShapeType == SHAPE_TRIANGLE) {
      mask = maskTriangle(pixelUV, pixelId, coverage);
    } else if (uShapeType == SHAPE_DIAMOND) {
      mask = maskDiamond(pixelUV, coverage);
    } else {
      mask = coverage;
    }

    if (uEdgeFade > 0.0) {
      vec2 norm = fragCoord / uResolution;
      float edge = min(min(norm.x, norm.y), min(1.0 - norm.x, 1.0 - norm.y));
      float fade = smoothstep(0.0, uEdgeFade, edge);
      mask *= fade;
    }

    vec3 color = uColor;
    vec3 srgbColor = mix(
      color * 12.92,
      1.055 * pow(color, vec3(1.0 / 2.4)) - 0.055,
      step(0.0031308, color)
    );
    return vec4(srgbColor, clamp(mask, 0.0, 1.0));
  }

  void main() {
    vec2 fragCoord = gl_FragCoord.xy;

    if (uLiquid == 1) {
      vec2 uv = fragCoord / uResolution;
      vec4 tex = texture2D(uTouchTexture, uv);
      float vx = tex.r * 2.0 - 1.0;
      float vy = tex.g * 2.0 - 1.0;
      float intensity = tex.b;
      float wave = 0.5 + 0.5 * sin(uTime * uLiquidWobbleSpeed + intensity * 6.2831853);
      float amount = uLiquidStrength * intensity * wave;
      fragCoord += vec2(vx, vy) * amount * uResolution;
    }

    vec4 color = renderPixelBlast(fragCoord);

    if (uNoiseAmount > 0.0) {
      float n = hash21(floor((gl_FragCoord.xy / uResolution) * vec2(1920.0, 1080.0)) + floor(uTime * 60.0));
      float grain = (n - 0.5) * uNoiseAmount;
      color.rgb += vec3(grain);
    }

    gl_FragColor = color;
  }
`

// React Bits Pixel Blast ships as a Three.js/postprocessing shader. MassageLab
// ports the pixel shader, ripple clicks, and liquid touch texture to raw WebGL.
export default function ReactBitsPixelBlastBackground({
  className,
  reactBitsPixelBlast,
}: BackgroundEffectProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const options = useMemo(
    () => resolvePixelBlastOptions(reactBitsPixelBlast),
    [
      reactBitsPixelBlast?.variant,
      reactBitsPixelBlast?.pixelSize,
      reactBitsPixelBlast?.color,
      reactBitsPixelBlast?.antialias,
      reactBitsPixelBlast?.patternScale,
      reactBitsPixelBlast?.patternDensity,
      reactBitsPixelBlast?.liquid,
      reactBitsPixelBlast?.liquidStrength,
      reactBitsPixelBlast?.liquidRadius,
      reactBitsPixelBlast?.pixelSizeJitter,
      reactBitsPixelBlast?.enableRipples,
      reactBitsPixelBlast?.rippleIntensityScale,
      reactBitsPixelBlast?.rippleThickness,
      reactBitsPixelBlast?.rippleSpeed,
      reactBitsPixelBlast?.liquidWobbleSpeed,
      reactBitsPixelBlast?.autoPauseOffscreen,
      reactBitsPixelBlast?.speed,
      reactBitsPixelBlast?.transparent,
      reactBitsPixelBlast?.edgeFade,
      reactBitsPixelBlast?.noiseAmount,
    ],
  )
  const color = useMemo(() => parseHexColorToLinearRgb(options.color), [options.color])

  useEffect(() => {
    const container = containerRef.current
    const canvas = canvasRef.current
    const context = canvas?.getContext("webgl", {
      alpha: true,
      antialias: options.antialias,
      depth: false,
      powerPreference: "high-performance",
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      stencil: false,
    })

    if (!container || !canvas || !context) {
      return undefined
    }

    const derivatives = context.getExtension("OES_standard_derivatives")

    if (!derivatives) {
      return undefined
    }

    const resources = createPixelBlastResources(context)

    if (!resources) {
      return undefined
    }

    const touchTexture = createTouchTexture(context)

    if (!touchTexture) {
      context.deleteBuffer(resources.positionBuffer)
      context.deleteShader(resources.vertexShader)
      context.deleteShader(resources.fragmentShader)
      context.deleteProgram(resources.program)
      return undefined
    }

    context.disable(context.DEPTH_TEST)
    context.disable(context.CULL_FACE)
    context.disable(context.BLEND)

    const startTimestamp = performance.now()
    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const compactViewportQuery = window.matchMedia("(max-width: 360px), (max-height: 360px)")
    const clickPositions = new Float32Array(MAX_CLICKS * 2)
    const clickTimes = new Float32Array(MAX_CLICKS)
    clickPositions.fill(-1)

    let animationFrame = 0
    let resizeRetryFrame = 0
    let shouldRun = false
    let clickIndex = 0

    const bindStaticUniforms = () => {
      context.useProgram(resources.program)
      context.uniform3fv(resources.uniforms.color, color)
      context.uniform1f(resources.uniforms.scale, options.patternScale)
      context.uniform1f(resources.uniforms.density, options.patternDensity)
      context.uniform1f(resources.uniforms.pixelJitter, options.pixelSizeJitter)
      context.uniform1i(resources.uniforms.enableRipples, options.enableRipples ? 1 : 0)
      context.uniform1f(resources.uniforms.rippleSpeed, options.rippleSpeed)
      context.uniform1f(resources.uniforms.rippleThickness, options.rippleThickness)
      context.uniform1f(resources.uniforms.rippleIntensity, options.rippleIntensityScale)
      context.uniform1f(resources.uniforms.edgeFade, options.edgeFade)
      context.uniform1i(resources.uniforms.shapeType, SHAPE_MAP[options.variant])
      context.uniform1i(resources.uniforms.liquid, options.liquid ? 1 : 0)
      context.uniform1f(resources.uniforms.liquidStrength, options.liquidStrength)
      context.uniform1f(resources.uniforms.liquidWobbleSpeed, options.liquidWobbleSpeed)
      context.uniform1f(resources.uniforms.noiseAmount, options.noiseAmount)
      context.uniform1i(resources.uniforms.touchTexture, 0)
      touchTexture.radiusScale = options.liquidRadius
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
      context.useProgram(resources.program)
      context.uniform1f(resources.uniforms.pixelSize, options.pixelSize * dpr)
      return true
    }

    const drawFrame = (timestamp: number, animate: boolean) => {
      if (canvas.width <= 1 || canvas.height <= 1) {
        return false
      }

      const elapsedSeconds = animate ? Math.max(0, (timestamp - startTimestamp) / 1000) : 0
      const sourceTime = elapsedSeconds * options.speed

      context.viewport(0, 0, canvas.width, canvas.height)
      context.clearColor(0, 0, 0, options.transparent ? 0 : 1)
      context.clear(context.COLOR_BUFFER_BIT)
      context.useProgram(resources.program)
      context.activeTexture(context.TEXTURE0)
      context.bindTexture(context.TEXTURE_2D, touchTexture.texture)
      if (options.liquid && animate) {
        touchTexture.update()
      }
      context.bindBuffer(context.ARRAY_BUFFER, resources.positionBuffer)
      context.enableVertexAttribArray(resources.attributes.position)
      context.vertexAttribPointer(resources.attributes.position, 2, context.FLOAT, false, 0, 0)
      context.uniform2f(resources.uniforms.resolution, canvas.width, canvas.height)
      context.uniform1f(resources.uniforms.time, sourceTime)
      context.uniform2fv(resources.uniforms.clickPosition, clickPositions)
      context.uniform1fv(resources.uniforms.clickTimes, clickTimes)
      context.drawArrays(context.TRIANGLES, 0, 3)

      return animate && shouldContinueAnimating(options)
    }

    const shouldAnimate = () => shouldAnimateAmbientBackground({
      prefersReducedMotion: reducedMotionQuery.matches,
      compactViewport: compactViewportQuery.matches,
      documentHidden: options.autoPauseOffscreen && document.visibilityState !== "visible",
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

      bindStaticUniforms()
      const animate = shouldAnimate()
      shouldRun = animate
      if (drawFrame(performance.now(), animate)) {
        scheduleFrame()
      }
    }

    const mapPointerToPixels = (event: PointerEvent) => {
      const rect = container.getBoundingClientRect()

      if (rect.width <= 0 || rect.height <= 0) {
        return null
      }

      const x = event.clientX - rect.left
      const y = event.clientY - rect.top

      if (x < 0 || y < 0 || x > rect.width || y > rect.height) {
        return null
      }

      const scaleX = canvas.width / rect.width
      const scaleY = canvas.height / rect.height
      return {
        fx: x * scaleX,
        fy: (rect.height - y) * scaleY,
        normalizedX: x / rect.width,
        normalizedY: y / rect.height,
      }
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!options.enableRipples) {
        return
      }

      const point = mapPointerToPixels(event)

      if (!point) {
        return
      }

      const offset = clickIndex * 2
      clickPositions[offset] = point.fx
      clickPositions[offset + 1] = point.fy
      clickTimes[clickIndex] = Math.max(0, (performance.now() - startTimestamp) / 1000) * options.speed
      clickIndex = (clickIndex + 1) % MAX_CLICKS
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!options.liquid) {
        return
      }

      const point = mapPointerToPixels(event)

      if (!point) {
        return
      }

      touchTexture.addTouch({
        x: point.normalizedX,
        y: 1 - point.normalizedY,
      })
    }

    const resizeObserver = new ResizeObserver(render)
    resizeObserver.observe(container)
    window.addEventListener("resize", render)
    document.addEventListener("visibilitychange", render)
    reducedMotionQuery.addEventListener("change", render)
    compactViewportQuery.addEventListener("change", render)
    if (options.enableRipples) {
      window.addEventListener("pointerdown", handlePointerDown, { passive: true })
    }
    if (options.liquid) {
      window.addEventListener("pointermove", handlePointerMove, { passive: true })
    }
    render()

    return () => {
      shouldRun = false
      stopFrame()
      window.cancelAnimationFrame(resizeRetryFrame)
      resizeObserver.disconnect()
      window.removeEventListener("resize", render)
      document.removeEventListener("visibilitychange", render)
      reducedMotionQuery.removeEventListener("change", render)
      compactViewportQuery.removeEventListener("change", render)
      window.removeEventListener("pointerdown", handlePointerDown)
      window.removeEventListener("pointermove", handlePointerMove)
      context.deleteTexture(touchTexture.texture)
      context.deleteBuffer(resources.positionBuffer)
      context.detachShader(resources.program, resources.vertexShader)
      context.detachShader(resources.program, resources.fragmentShader)
      context.deleteShader(resources.vertexShader)
      context.deleteShader(resources.fragmentShader)
      context.deleteProgram(resources.program)
      canvas.width = 1
      canvas.height = 1
    }
  }, [color, options])

  return (
    <div
      ref={containerRef}
      className={cn(styles.effectLayer, styles.reactBitsPixelBlast, className)}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className={styles.reactBitsPixelBlastCanvas} />
    </div>
  )
}

function createPixelBlastResources(context: WebGLRenderingContext): PixelBlastResources | null {
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
      color: getUniformLocation(context, program, "uColor"),
      resolution: getUniformLocation(context, program, "uResolution"),
      time: getUniformLocation(context, program, "uTime"),
      pixelSize: getUniformLocation(context, program, "uPixelSize"),
      scale: getUniformLocation(context, program, "uScale"),
      density: getUniformLocation(context, program, "uDensity"),
      pixelJitter: getUniformLocation(context, program, "uPixelJitter"),
      enableRipples: getUniformLocation(context, program, "uEnableRipples"),
      rippleSpeed: getUniformLocation(context, program, "uRippleSpeed"),
      rippleThickness: getUniformLocation(context, program, "uRippleThickness"),
      rippleIntensity: getUniformLocation(context, program, "uRippleIntensity"),
      edgeFade: getUniformLocation(context, program, "uEdgeFade"),
      shapeType: getUniformLocation(context, program, "uShapeType"),
      clickPosition: getUniformLocation(context, program, "uClickPos[0]"),
      clickTimes: getUniformLocation(context, program, "uClickTimes[0]"),
      liquid: getUniformLocation(context, program, "uLiquid"),
      touchTexture: getUniformLocation(context, program, "uTouchTexture"),
      liquidStrength: getUniformLocation(context, program, "uLiquidStrength"),
      liquidWobbleSpeed: getUniformLocation(context, program, "uLiquidWobbleSpeed"),
      noiseAmount: getUniformLocation(context, program, "uNoiseAmount"),
    },
  }
}

function createTouchTexture(context: WebGLRenderingContext): TouchTexture | null {
  const size = 64
  const canvas = document.createElement("canvas")
  canvas.width = size
  canvas.height = size
  const texture = context.createTexture()
  const drawingContext = canvas.getContext("2d")

  if (!texture || !drawingContext) {
    if (texture) {
      context.deleteTexture(texture)
    }
    return null
  }

  drawingContext.fillStyle = "black"
  drawingContext.fillRect(0, 0, size, size)
  context.bindTexture(context.TEXTURE_2D, texture)
  context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MIN_FILTER, context.LINEAR)
  context.texParameteri(context.TEXTURE_2D, context.TEXTURE_MAG_FILTER, context.LINEAR)
  context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_S, context.CLAMP_TO_EDGE)
  context.texParameteri(context.TEXTURE_2D, context.TEXTURE_WRAP_T, context.CLAMP_TO_EDGE)
  context.texImage2D(context.TEXTURE_2D, 0, context.RGBA, context.RGBA, context.UNSIGNED_BYTE, canvas)

  const trail: Array<{ x: number; y: number; age: number; force: number; vx: number; vy: number }> = []
  const maxAge = 64
  const trailSpeed = 1 / maxAge
  let last: { x: number; y: number } | null = null
  let radius = 0.1 * size

  const clear = () => {
    drawingContext.fillStyle = "black"
    drawingContext.fillRect(0, 0, size, size)
  }

  const drawPoint = (point: { x: number; y: number; age: number; force: number; vx: number; vy: number }) => {
    const pos = { x: point.x * size, y: (1 - point.y) * size }
    const easeOutSine = (t: number) => Math.sin((t * Math.PI) / 2)
    const easeOutQuad = (t: number) => -t * (t - 2)
    let intensity = 1

    if (point.age < maxAge * 0.3) {
      intensity = easeOutSine(point.age / (maxAge * 0.3))
    } else {
      intensity = easeOutQuad(1 - (point.age - maxAge * 0.3) / (maxAge * 0.7)) || 0
    }

    intensity *= point.force
    const color = `${((point.vx + 1) / 2) * 255}, ${((point.vy + 1) / 2) * 255}, ${intensity * 255}`
    const offset = size * 5
    drawingContext.shadowOffsetX = offset
    drawingContext.shadowOffsetY = offset
    drawingContext.shadowBlur = radius
    drawingContext.shadowColor = `rgba(${color},${0.22 * intensity})`
    drawingContext.beginPath()
    drawingContext.fillStyle = "rgba(255,0,0,1)"
    drawingContext.arc(pos.x - offset, pos.y - offset, radius, 0, Math.PI * 2)
    drawingContext.fill()
  }

  return {
    texture,
    addTouch(point) {
      let force = 0
      let vx = 0
      let vy = 0

      if (last) {
        const dx = point.x - last.x
        const dy = point.y - last.y

        if (dx === 0 && dy === 0) {
          return
        }

        const distanceSquared = dx * dx + dy * dy
        const distance = Math.sqrt(distanceSquared)
        vx = dx / (distance || 1)
        vy = dy / (distance || 1)
        force = Math.min(distanceSquared * 10000, 1)
      }

      last = { x: point.x, y: point.y }
      trail.push({ x: point.x, y: point.y, age: 0, force, vx, vy })
    },
    update() {
      clear()
      for (let index = trail.length - 1; index >= 0; index -= 1) {
        const point = trail[index]
        const force = point.force * trailSpeed * (1 - point.age / maxAge)
        point.x += point.vx * force
        point.y += point.vy * force
        point.age += 1

        if (point.age > maxAge) {
          trail.splice(index, 1)
        }
      }

      for (const point of trail) {
        drawPoint(point)
      }

      context.bindTexture(context.TEXTURE_2D, texture)
      context.texImage2D(context.TEXTURE_2D, 0, context.RGBA, context.RGBA, context.UNSIGNED_BYTE, canvas)
    },
    set radiusScale(value: number) {
      radius = 0.1 * size * value
    },
    get radiusScale() {
      return radius / (0.1 * size)
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
    throw new Error(`Missing React Bits Pixel Blast shader uniform: ${name}`)
  }

  return location
}

function resolvePixelBlastOptions(
  options: ReactBitsPixelBlastOptions | undefined,
): ResolvedPixelBlastOptions {
  return {
    variant: resolveVariant(options?.variant),
    pixelSize: resolveNumber(options?.pixelSize, DEFAULT_REACT_BITS_PIXEL_BLAST.pixelSize, 1, 16),
    color: resolveHexColor(options?.color, DEFAULT_REACT_BITS_PIXEL_BLAST.color),
    antialias: resolveBoolean(options?.antialias, DEFAULT_REACT_BITS_PIXEL_BLAST.antialias),
    patternScale: resolveNumber(options?.patternScale, DEFAULT_REACT_BITS_PIXEL_BLAST.patternScale, 0.25, 8),
    patternDensity: resolveNumber(options?.patternDensity, DEFAULT_REACT_BITS_PIXEL_BLAST.patternDensity, 0, 2),
    liquid: resolveBoolean(options?.liquid, DEFAULT_REACT_BITS_PIXEL_BLAST.liquid),
    liquidStrength: resolveNumber(options?.liquidStrength, DEFAULT_REACT_BITS_PIXEL_BLAST.liquidStrength, 0, 0.4),
    liquidRadius: resolveNumber(options?.liquidRadius, DEFAULT_REACT_BITS_PIXEL_BLAST.liquidRadius, 0.1, 4),
    pixelSizeJitter: resolveNumber(
      options?.pixelSizeJitter,
      DEFAULT_REACT_BITS_PIXEL_BLAST.pixelSizeJitter,
      0,
      1,
    ),
    enableRipples: resolveBoolean(options?.enableRipples, DEFAULT_REACT_BITS_PIXEL_BLAST.enableRipples),
    rippleIntensityScale: resolveNumber(
      options?.rippleIntensityScale,
      DEFAULT_REACT_BITS_PIXEL_BLAST.rippleIntensityScale,
      0,
      4,
    ),
    rippleThickness: resolveNumber(
      options?.rippleThickness,
      DEFAULT_REACT_BITS_PIXEL_BLAST.rippleThickness,
      0.01,
      0.5,
    ),
    rippleSpeed: resolveNumber(options?.rippleSpeed, DEFAULT_REACT_BITS_PIXEL_BLAST.rippleSpeed, 0.05, 2),
    liquidWobbleSpeed: resolveNumber(
      options?.liquidWobbleSpeed,
      DEFAULT_REACT_BITS_PIXEL_BLAST.liquidWobbleSpeed,
      0,
      10,
    ),
    autoPauseOffscreen: resolveBoolean(
      options?.autoPauseOffscreen,
      DEFAULT_REACT_BITS_PIXEL_BLAST.autoPauseOffscreen,
    ),
    speed: resolveNumber(options?.speed, DEFAULT_REACT_BITS_PIXEL_BLAST.speed, 0, 3),
    transparent: resolveBoolean(options?.transparent, DEFAULT_REACT_BITS_PIXEL_BLAST.transparent),
    edgeFade: resolveNumber(options?.edgeFade, DEFAULT_REACT_BITS_PIXEL_BLAST.edgeFade, 0, 1),
    noiseAmount: resolveNumber(options?.noiseAmount, DEFAULT_REACT_BITS_PIXEL_BLAST.noiseAmount, 0, 0.4),
  }
}

function resolveVariant(value: ReactBitsPixelBlastOptions["variant"] | undefined): PixelBlastVariant {
  if (value === "square" || value === "circle" || value === "triangle" || value === "diamond") {
    return value
  }

  return DEFAULT_REACT_BITS_PIXEL_BLAST.variant
}

function shouldContinueAnimating(options: ResolvedPixelBlastOptions) {
  return options.speed > 1e-6
    || options.enableRipples
    || options.liquid
    || options.noiseAmount > 0
}

function parseHexColorToLinearRgb(color: string): RgbColor {
  const normalized = resolveHexColor(color, DEFAULT_REACT_BITS_PIXEL_BLAST.color).replace("#", "")
  return [
    srgbToLinear(Number.parseInt(normalized.slice(0, 2), 16) / 255),
    srgbToLinear(Number.parseInt(normalized.slice(2, 4), 16) / 255),
    srgbToLinear(Number.parseInt(normalized.slice(4, 6), 16) / 255),
  ]
}

function srgbToLinear(value: number) {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
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
