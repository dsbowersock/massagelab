"use client"

import { useEffect, useMemo, useRef } from "react"
import { shouldAnimateAmbientBackground } from "@/lib/motion-preferences"
import { cn } from "@/lib/utils"
import styles from "@/components/backgrounds/BackgroundHost.module.css"
import type { BackgroundEffectProps, ReactBitsBeamsOptions } from "./css-backgrounds"

type RgbColor = [number, number, number]
type ResolvedBeamsOptions = Required<ReactBitsBeamsOptions>

type BeamsGeometry = {
  positions: Float32Array
  uvs: Float32Array
  indices: Uint16Array | Uint32Array
  indexType: number
  indexCount: number
}

type BeamsResources = {
  program: WebGLProgram
  vertexShader: WebGLShader
  fragmentShader: WebGLShader
  positionBuffer: WebGLBuffer
  uvBuffer: WebGLBuffer
  indexBuffer: WebGLBuffer
  indexType: number
  indexCount: number
  attributes: {
    position: number
    uv: number
  }
  uniforms: {
    time: WebGLUniformLocation
    resolution: WebGLUniformLocation
    speed: WebGLUniformLocation
    noiseIntensity: WebGLUniformLocation
    scale: WebGLUniformLocation
    rotation: WebGLUniformLocation
    lightColor: WebGLUniformLocation
  }
}

const HEIGHT_SEGMENTS = 100

const DEFAULT_REACT_BITS_BEAMS: ResolvedBeamsOptions = {
  beamWidth: 2,
  beamHeight: 15,
  beamNumber: 12,
  lightColor: "#FFFFFF",
  speed: 2,
  noiseIntensity: 1.75,
  scale: 0.2,
  rotation: 0,
}

const vertexShaderSource = `
  attribute vec3 aPosition;
  attribute vec2 aUv;

  uniform float uTime;
  uniform float uSpeed;
  uniform float uScale;
  uniform float uRotation;
  uniform vec2 uResolution;

  varying vec3 vWorldPosition;
  varying vec3 vNormal;
  varying vec2 vUv;

  vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}
  vec3 fade(vec3 t) {return t*t*t*(t*(t*6.0-15.0)+10.0);}

  float cnoise(vec3 P){
    vec3 Pi0 = floor(P);
    vec3 Pi1 = Pi0 + vec3(1.0);
    Pi0 = mod(Pi0, 289.0);
    Pi1 = mod(Pi1, 289.0);
    vec3 Pf0 = fract(P);
    vec3 Pf1 = Pf0 - vec3(1.0);
    vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);
    vec4 iy = vec4(Pi0.yy, Pi1.yy);
    vec4 iz0 = Pi0.zzzz;
    vec4 iz1 = Pi1.zzzz;
    vec4 ixy = permute(permute(ix) + iy);
    vec4 ixy0 = permute(ixy + iz0);
    vec4 ixy1 = permute(ixy + iz1);
    vec4 gx0 = ixy0 / 7.0;
    vec4 gy0 = fract(floor(gx0) / 7.0) - 0.5;
    gx0 = fract(gx0);
    vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);
    vec4 sz0 = step(gz0, vec4(0.0));
    gx0 -= sz0 * (step(0.0, gx0) - 0.5);
    gy0 -= sz0 * (step(0.0, gy0) - 0.5);
    vec4 gx1 = ixy1 / 7.0;
    vec4 gy1 = fract(floor(gx1) / 7.0) - 0.5;
    gx1 = fract(gx1);
    vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);
    vec4 sz1 = step(gz1, vec4(0.0));
    gx1 -= sz1 * (step(0.0, gx1) - 0.5);
    gy1 -= sz1 * (step(0.0, gy1) - 0.5);
    vec3 g000 = vec3(gx0.x,gy0.x,gz0.x);
    vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);
    vec3 g010 = vec3(gx0.z,gy0.z,gz0.z);
    vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);
    vec3 g001 = vec3(gx1.x,gy1.x,gz1.x);
    vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);
    vec3 g011 = vec3(gx1.z,gy1.z,gz1.z);
    vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);
    vec4 norm0 = taylorInvSqrt(vec4(dot(g000,g000),dot(g010,g010),dot(g100,g100),dot(g110,g110)));
    g000 *= norm0.x; g010 *= norm0.y; g100 *= norm0.z; g110 *= norm0.w;
    vec4 norm1 = taylorInvSqrt(vec4(dot(g001,g001),dot(g011,g011),dot(g101,g101),dot(g111,g111)));
    g001 *= norm1.x; g011 *= norm1.y; g101 *= norm1.z; g111 *= norm1.w;
    float n000 = dot(g000, Pf0);
    float n100 = dot(g100, vec3(Pf1.x,Pf0.yz));
    float n010 = dot(g010, vec3(Pf0.x,Pf1.y,Pf0.z));
    float n110 = dot(g110, vec3(Pf1.xy,Pf0.z));
    float n001 = dot(g001, vec3(Pf0.xy,Pf1.z));
    float n101 = dot(g101, vec3(Pf1.x,Pf0.y,Pf1.z));
    float n011 = dot(g011, vec3(Pf0.x,Pf1.yz));
    float n111 = dot(g111, Pf1);
    vec3 fade_xyz = fade(Pf0);
    vec4 n_z = mix(vec4(n000,n100,n010,n110),vec4(n001,n101,n011,n111),fade_xyz.z);
    vec2 n_yz = mix(n_z.xy,n_z.zw,fade_xyz.y);
    float n_xyz = mix(n_yz.x,n_yz.y,fade_xyz.x);
    return 2.2 * n_xyz;
  }

  float getPos(vec3 pos, vec2 uv) {
    vec3 noisePos = vec3(pos.x * 0.0, pos.y - uv.y, pos.z + uTime * uSpeed * 3.0) * uScale;
    return cnoise(noisePos);
  }

  vec3 getCurrentPos(vec3 pos, vec2 uv) {
    vec3 newpos = pos;
    newpos.z += getPos(pos, uv);
    return newpos;
  }

  vec3 getNormal(vec3 pos, vec2 uv) {
    vec3 curpos = getCurrentPos(pos, uv);
    vec3 nextposX = getCurrentPos(pos + vec3(0.01, 0.0, 0.0), uv);
    vec3 nextposZ = getCurrentPos(pos + vec3(0.0, -0.01, 0.0), uv);
    vec3 tangentX = normalize(nextposX - curpos);
    vec3 tangentZ = normalize(nextposZ - curpos);
    return normalize(cross(tangentZ, tangentX));
  }

  void main() {
    vec3 displaced = getCurrentPos(aPosition, aUv);
    vec3 normal = getNormal(aPosition, aUv);
    float c = cos(uRotation);
    float s = sin(uRotation);
    mat2 rot = mat2(c, -s, s, c);
    displaced.xy = rot * displaced.xy;
    normal.xy = rot * normal.xy;

    float aspect = max(0.01, uResolution.x / max(1.0, uResolution.y));
    float cameraZ = 20.0;
    float fovScale = tan(radians(30.0) * 0.5);
    float viewZ = max(0.01, cameraZ - displaced.z);
    vec2 projected = vec2(
      displaced.x / (viewZ * fovScale * aspect),
      displaced.y / (viewZ * fovScale)
    );

    vUv = aUv;
    vWorldPosition = displaced;
    vNormal = normal;
    gl_Position = vec4(projected, 0.0, 1.0);
  }
`

const fragmentShaderSource = `
  precision highp float;

  uniform vec3 uLightColor;
  uniform float uNoiseIntensity;

  varying vec3 vWorldPosition;
  varying vec3 vNormal;
  varying vec2 vUv;

  float random(in vec2 st) {
    return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
  }

  float noise(in vec2 st) {
    vec2 i = floor(st);
    vec2 f = fract(st);
    float a = random(i);
    float b = random(i + vec2(1.0, 0.0));
    float c = random(i + vec2(0.0, 1.0));
    float d = random(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) +
      (c - a) * u.y * (1.0 - u.x) +
      (d - b) * u.x * u.y;
  }

  void main() {
    vec3 normal = normalize(vNormal);
    vec3 lightDir = normalize(vec3(0.0, 3.0, 10.0));
    vec3 viewDir = normalize(vec3(0.0, 0.0, 20.0) - vWorldPosition);
    vec3 halfDir = normalize(lightDir + viewDir);
    float specular = pow(max(dot(normal, halfDir), 0.0), 48.0);
    float edge = pow(1.0 - abs(dot(normal, viewDir)), 2.2);
    float verticalFade = 1.0;
    float beamBody = specular * 0.85 + edge * 0.18;
    vec3 color = uLightColor * beamBody * verticalFade;
    float randomNoise = noise(gl_FragCoord.xy);
    color -= randomNoise / 15.0 * uNoiseIntensity;
    color = max(color, vec3(0.0));
    gl_FragColor = vec4(color, 1.0);
  }
`

// React Bits Beams ships as stacked Three/R3F planes with a modified physical
// material. MassageLab keeps the plane geometry and shader displacement in a
// raw WebGL renderer so the premium background does not add Three/R3F.
export default function ReactBitsBeamsBackground({
  className,
  reactBitsBeams,
}: BackgroundEffectProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const options = useMemo(
    () => resolveBeamsOptions(reactBitsBeams),
    [
      reactBitsBeams?.beamWidth,
      reactBitsBeams?.beamHeight,
      reactBitsBeams?.beamNumber,
      reactBitsBeams?.lightColor,
      reactBitsBeams?.speed,
      reactBitsBeams?.noiseIntensity,
      reactBitsBeams?.scale,
      reactBitsBeams?.rotation,
    ],
  )
  const lightColor = useMemo(() => parseHexColorToRgb(options.lightColor), [options.lightColor])

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

    const geometry = createStackedPlanesGeometry(
      options.beamNumber,
      options.beamWidth,
      options.beamHeight,
      0,
      HEIGHT_SEGMENTS,
      context,
    )
    const resources = createBeamsResources(context, geometry)

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
      context.useProgram(resources.program)
      context.uniform1f(resources.uniforms.speed, options.speed)
      context.uniform1f(resources.uniforms.noiseIntensity, options.noiseIntensity)
      context.uniform1f(resources.uniforms.scale, options.scale)
      context.uniform1f(resources.uniforms.rotation, degreesToRadians(options.rotation))
      context.uniform3fv(resources.uniforms.lightColor, lightColor)
    }

    const drawFrame = (timestamp: number, animate: boolean) => {
      if (canvas.width <= 1 || canvas.height <= 1) {
        return false
      }

      const elapsedSeconds = animate ? Math.max(0, (timestamp - startTimestamp) / 1000) : 0
      const sourceTime = elapsedSeconds * 0.1

      context.viewport(0, 0, canvas.width, canvas.height)
      context.clearColor(0, 0, 0, 1)
      context.clear(context.COLOR_BUFFER_BIT)
      context.useProgram(resources.program)
      context.uniform1f(resources.uniforms.time, sourceTime)
      context.uniform2f(resources.uniforms.resolution, canvas.width, canvas.height)
      bindAttribute(context, resources.positionBuffer, resources.attributes.position, 3)
      bindAttribute(context, resources.uvBuffer, resources.attributes.uv, 2)
      context.bindBuffer(context.ELEMENT_ARRAY_BUFFER, resources.indexBuffer)
      context.drawElements(context.TRIANGLES, resources.indexCount, resources.indexType, 0)

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

    const shouldAnimate = () => shouldAnimateAmbientBackground({
      prefersReducedMotion: reducedMotionQuery.matches,
      compactViewport: compactViewportQuery.matches,
      documentHidden: document.visibilityState !== "visible",
    })

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
      disposeBeamsResources(context, resources)
      canvas.width = 1
      canvas.height = 1
    }
  }, [lightColor, options])

  return (
    <div
      ref={containerRef}
      className={cn(styles.effectLayer, styles.reactBitsBeams, className)}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className={styles.reactBitsBeamsCanvas} />
    </div>
  )
}

function createBeamsResources(
  context: WebGLRenderingContext,
  geometry: BeamsGeometry,
): BeamsResources | null {
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

  const positionBuffer = createArrayBuffer(context, geometry.positions)
  const uvBuffer = createArrayBuffer(context, geometry.uvs)
  const indexBuffer = context.createBuffer()

  if (!positionBuffer || !uvBuffer || !indexBuffer) {
    if (positionBuffer) context.deleteBuffer(positionBuffer)
    if (uvBuffer) context.deleteBuffer(uvBuffer)
    if (indexBuffer) context.deleteBuffer(indexBuffer)
    context.deleteProgram(program)
    context.deleteShader(vertexShader)
    context.deleteShader(fragmentShader)
    return null
  }

  context.bindBuffer(context.ELEMENT_ARRAY_BUFFER, indexBuffer)
  context.bufferData(context.ELEMENT_ARRAY_BUFFER, geometry.indices, context.STATIC_DRAW)

  return {
    program,
    vertexShader,
    fragmentShader,
    positionBuffer,
    uvBuffer,
    indexBuffer,
    indexType: geometry.indexType,
    indexCount: geometry.indexCount,
    attributes: {
      position: context.getAttribLocation(program, "aPosition"),
      uv: context.getAttribLocation(program, "aUv"),
    },
    uniforms: {
      time: getUniformLocation(context, program, "uTime"),
      resolution: getUniformLocation(context, program, "uResolution"),
      speed: getUniformLocation(context, program, "uSpeed"),
      noiseIntensity: getUniformLocation(context, program, "uNoiseIntensity"),
      scale: getUniformLocation(context, program, "uScale"),
      rotation: getUniformLocation(context, program, "uRotation"),
      lightColor: getUniformLocation(context, program, "uLightColor"),
    },
  }
}

function createStackedPlanesGeometry(
  count: number,
  width: number,
  height: number,
  spacing: number,
  heightSegments: number,
  context: WebGLRenderingContext,
): BeamsGeometry {
  const vertexCount = count * (heightSegments + 1) * 2
  const indexCount = count * heightSegments * 6
  const positions = new Float32Array(vertexCount * 3)
  const uvs = new Float32Array(vertexCount * 2)
  const canUseUint32 = vertexCount > 65535 && Boolean(context.getExtension("OES_element_index_uint"))
  const indices = canUseUint32 ? new Uint32Array(indexCount) : new Uint16Array(indexCount)
  const totalWidth = count * width + (count - 1) * spacing
  const xOffsetBase = -totalWidth / 2
  let vertexOffset = 0
  let indexOffset = 0
  let uvOffset = 0

  for (let beamIndex = 0; beamIndex < count; beamIndex += 1) {
    const xOffset = xOffsetBase + beamIndex * (width + spacing)
    const uvXOffset = seededFraction(beamIndex * 37 + 11) * 300
    const uvYOffset = seededFraction(beamIndex * 53 + 29) * 300

    for (let segmentIndex = 0; segmentIndex <= heightSegments; segmentIndex += 1) {
      const y = height * (segmentIndex / heightSegments - 0.5)
      positions.set([xOffset, y, 0, xOffset + width, y, 0], vertexOffset * 3)

      const uvY = segmentIndex / heightSegments
      uvs.set([uvXOffset, uvY + uvYOffset, uvXOffset + 1, uvY + uvYOffset], uvOffset)

      if (segmentIndex < heightSegments) {
        const a = vertexOffset
        const b = vertexOffset + 1
        const c = vertexOffset + 2
        const d = vertexOffset + 3
        indices.set([a, b, c, c, b, d], indexOffset)
        indexOffset += 6
      }

      vertexOffset += 2
      uvOffset += 4
    }
  }

  return {
    positions,
    uvs,
    indices,
    indexType: canUseUint32 ? context.UNSIGNED_INT : context.UNSIGNED_SHORT,
    indexCount,
  }
}

function bindAttribute(
  context: WebGLRenderingContext,
  buffer: WebGLBuffer,
  location: number,
  size: number,
) {
  if (location < 0) {
    return
  }

  context.bindBuffer(context.ARRAY_BUFFER, buffer)
  context.enableVertexAttribArray(location)
  context.vertexAttribPointer(location, size, context.FLOAT, false, 0, 0)
}

function createArrayBuffer(context: WebGLRenderingContext, data: Float32Array): WebGLBuffer | null {
  const buffer = context.createBuffer()
  if (!buffer) {
    return null
  }

  context.bindBuffer(context.ARRAY_BUFFER, buffer)
  context.bufferData(context.ARRAY_BUFFER, data, context.STATIC_DRAW)
  return buffer
}

function disposeBeamsResources(context: WebGLRenderingContext, resources: BeamsResources) {
  context.deleteBuffer(resources.positionBuffer)
  context.deleteBuffer(resources.uvBuffer)
  context.deleteBuffer(resources.indexBuffer)
  context.detachShader(resources.program, resources.vertexShader)
  context.detachShader(resources.program, resources.fragmentShader)
  context.deleteShader(resources.vertexShader)
  context.deleteShader(resources.fragmentShader)
  context.deleteProgram(resources.program)
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
    throw new Error(`Missing React Bits Beams shader uniform: ${name}`)
  }

  return location
}

function resolveBeamsOptions(options: ReactBitsBeamsOptions | undefined): ResolvedBeamsOptions {
  return {
    beamWidth: resolveNumber(options?.beamWidth, DEFAULT_REACT_BITS_BEAMS.beamWidth, 0.2, 6),
    beamHeight: resolveNumber(options?.beamHeight, DEFAULT_REACT_BITS_BEAMS.beamHeight, 4, 32),
    beamNumber: Math.trunc(resolveNumber(options?.beamNumber, DEFAULT_REACT_BITS_BEAMS.beamNumber, 1, 48)),
    lightColor: resolveHexColor(options?.lightColor, DEFAULT_REACT_BITS_BEAMS.lightColor),
    speed: resolveNumber(options?.speed, DEFAULT_REACT_BITS_BEAMS.speed, 0, 8),
    noiseIntensity: resolveNumber(
      options?.noiseIntensity,
      DEFAULT_REACT_BITS_BEAMS.noiseIntensity,
      0,
      4,
    ),
    scale: resolveNumber(options?.scale, DEFAULT_REACT_BITS_BEAMS.scale, 0.02, 1.5),
    rotation: resolveNumber(options?.rotation, DEFAULT_REACT_BITS_BEAMS.rotation, -180, 180),
  }
}

function parseHexColorToRgb(color: string): RgbColor {
  const normalized = resolveHexColor(color, DEFAULT_REACT_BITS_BEAMS.lightColor).replace("#", "")
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

function degreesToRadians(value: number) {
  return value * (Math.PI / 180)
}

function seededFraction(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453
  return value - Math.floor(value)
}
