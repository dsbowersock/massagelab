"use client"

import { useEffect, useMemo, useRef } from "react"
import { shouldAnimateAmbientBackground } from "@/lib/motion-preferences"
import { cn } from "@/lib/utils"
import styles from "@/components/backgrounds/BackgroundHost.module.css"
import type { BackgroundEffectProps, MassageLabGridScanOptions } from "./css-backgrounds"

type RgbColor = [number, number, number]
type ScanDirection = "forward" | "backward" | "pingpong"
type LineStyle = "solid" | "dashed" | "dotted"
type Vec2 = { x: number; y: number }
type ResolvedGridScanOptions = Required<MassageLabGridScanOptions>

type GridScanResources = {
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
    skew: WebGLUniformLocation
    tilt: WebGLUniformLocation
    yaw: WebGLUniformLocation
    lineThickness: WebGLUniformLocation
    linesColor: WebGLUniformLocation
    scanColor: WebGLUniformLocation
    gridScale: WebGLUniformLocation
    lineStyle: WebGLUniformLocation
    lineJitter: WebGLUniformLocation
    scanOpacity: WebGLUniformLocation
    scanDirection: WebGLUniformLocation
    noise: WebGLUniformLocation
    bloomOpacity: WebGLUniformLocation
    scanGlow: WebGLUniformLocation
    scanSoftness: WebGLUniformLocation
    phaseTaper: WebGLUniformLocation
    scanDuration: WebGLUniformLocation
    scanDelay: WebGLUniformLocation
    scanStarts: WebGLUniformLocation
    scanCount: WebGLUniformLocation
  }
}

const MAX_SCANS = 8

const DEFAULT_MASSAGELAB_GRID_SCAN: ResolvedGridScanOptions = {
  sensitivity: 0.55,
  lineThickness: 1,
  linesColor: "#2F293A",
  scanColor: "#FF9FFC",
  scanOpacity: 0.4,
  gridScale: 0.1,
  lineStyle: "solid",
  lineJitter: 0.1,
  scanDirection: "pingpong",
  noiseIntensity: 0.01,
  bloomOpacity: 0,
  scanGlow: 0.5,
  scanSoftness: 2,
  scanPhaseTaper: 0.49,
  scanDuration: 2,
  scanDelay: 2,
  enablePointerInteraction: false,
  scanOnClick: false,
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
  uniform vec3 iResolution;
  uniform float iTime;
  uniform vec2 uSkew;
  uniform float uTilt;
  uniform float uYaw;
  uniform float uLineThickness;
  uniform vec3 uLinesColor;
  uniform vec3 uScanColor;
  uniform float uGridScale;
  uniform float uLineStyle;
  uniform float uLineJitter;
  uniform float uScanOpacity;
  uniform float uScanDirection;
  uniform float uNoise;
  uniform float uBloomOpacity;
  uniform float uScanGlow;
  uniform float uScanSoftness;
  uniform float uPhaseTaper;
  uniform float uScanDuration;
  uniform float uScanDelay;
  uniform float uScanStarts[8];
  uniform float uScanCount;
  varying vec2 vUv;

  const int MAX_SCANS = 8;

  float smoother01(float a, float b, float x) {
    float t = clamp((x - a) / max(1e-5, (b - a)), 0.0, 1.0);
    return t * t * t * (t * (t * 6.0 - 15.0) + 10.0);
  }

  void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 p = (2.0 * fragCoord - iResolution.xy) / iResolution.y;

    vec3 ro = vec3(0.0);
    vec3 rd = normalize(vec3(p, 2.0));

    float cR = cos(uTilt), sR = sin(uTilt);
    rd.xy = mat2(cR, -sR, sR, cR) * rd.xy;

    float cY = cos(uYaw), sY = sin(uYaw);
    rd.xz = mat2(cY, -sY, sY, cY) * rd.xz;

    vec2 skew = clamp(uSkew, vec2(-0.7), vec2(0.7));
    rd.xy += skew * rd.z;

    vec3 color = vec3(0.0);
    float minT = 1e20;
    float gridScale = max(1e-5, uGridScale);
    float fadeStrength = 2.0;
    vec2 gridUV = vec2(0.0);

    float hitIsY = 1.0;
    for (int i = 0; i < 4; i++) {
      float isY = float(i < 2);
      float pos = mix(-0.2, 0.2, float(i)) * isY + mix(-0.5, 0.5, float(i - 2)) * (1.0 - isY);
      float num = pos - (isY * ro.y + (1.0 - isY) * ro.x);
      float den = isY * rd.y + (1.0 - isY) * rd.x;
      float t = num / den;
      vec3 h = ro + rd * t;

      float depthBoost = smoothstep(0.0, 3.0, h.z);
      h.xy += skew * 0.15 * depthBoost;

      bool use = t > 0.0 && t < minT;
      gridUV = use ? mix(h.zy, h.xz, isY) / gridScale : gridUV;
      minT = use ? t : minT;
      hitIsY = use ? isY : hitIsY;
    }

    vec3 hit = ro + rd * minT;
    float dist = length(hit - ro);

    float jitterAmt = clamp(uLineJitter, 0.0, 1.0);
    if (jitterAmt > 0.0) {
      vec2 j = vec2(
        sin(gridUV.y * 2.7 + iTime * 1.8),
        cos(gridUV.x * 2.3 - iTime * 1.6)
      ) * (0.15 * jitterAmt);
      gridUV += j;
    }

    float fx = fract(gridUV.x);
    float fy = fract(gridUV.y);
    float ax = min(fx, 1.0 - fx);
    float ay = min(fy, 1.0 - fy);
    float wx = fwidth(gridUV.x);
    float wy = fwidth(gridUV.y);
    float halfPx = max(0.0, uLineThickness) * 0.5;

    float tx = halfPx * wx;
    float ty = halfPx * wy;
    float aax = wx;
    float aay = wy;

    float lineX = 1.0 - smoothstep(tx, tx + aax, ax);
    float lineY = 1.0 - smoothstep(ty, ty + aay, ay);
    if (uLineStyle > 0.5) {
      float dashRepeat = 4.0;
      float dashDuty = 0.5;
      float vy = fract(gridUV.y * dashRepeat);
      float vx = fract(gridUV.x * dashRepeat);
      float dashMaskY = step(vy, dashDuty);
      float dashMaskX = step(vx, dashDuty);
      if (uLineStyle < 1.5) {
        lineX *= dashMaskY;
        lineY *= dashMaskX;
      } else {
        float dotRepeat = 6.0;
        float dotWidth = 0.18;
        float cy = abs(fract(gridUV.y * dotRepeat) - 0.5);
        float cx = abs(fract(gridUV.x * dotRepeat) - 0.5);
        float dotMaskY = 1.0 - smoothstep(dotWidth, dotWidth + fwidth(gridUV.y * dotRepeat), cy);
        float dotMaskX = 1.0 - smoothstep(dotWidth, dotWidth + fwidth(gridUV.x * dotRepeat), cx);
        lineX *= dotMaskY;
        lineY *= dotMaskX;
      }
    }
    float primaryMask = max(lineX, lineY);

    vec2 gridUV2 = (hitIsY > 0.5 ? hit.xz : hit.zy) / gridScale;
    if (jitterAmt > 0.0) {
      vec2 j2 = vec2(
        cos(gridUV2.y * 2.1 - iTime * 1.4),
        sin(gridUV2.x * 2.5 + iTime * 1.7)
      ) * (0.15 * jitterAmt);
      gridUV2 += j2;
    }

    float fx2 = fract(gridUV2.x);
    float fy2 = fract(gridUV2.y);
    float ax2 = min(fx2, 1.0 - fx2);
    float ay2 = min(fy2, 1.0 - fy2);
    float wx2 = fwidth(gridUV2.x);
    float wy2 = fwidth(gridUV2.y);
    float tx2 = halfPx * wx2;
    float ty2 = halfPx * wy2;
    float aax2 = wx2;
    float aay2 = wy2;
    float lineX2 = 1.0 - smoothstep(tx2, tx2 + aax2, ax2);
    float lineY2 = 1.0 - smoothstep(ty2, ty2 + aay2, ay2);

    if (uLineStyle > 0.5) {
      float dashRepeat2 = 4.0;
      float dashDuty2 = 0.5;
      float vy2m = fract(gridUV2.y * dashRepeat2);
      float vx2m = fract(gridUV2.x * dashRepeat2);
      float dashMaskY2 = step(vy2m, dashDuty2);
      float dashMaskX2 = step(vx2m, dashDuty2);
      if (uLineStyle < 1.5) {
        lineX2 *= dashMaskY2;
        lineY2 *= dashMaskX2;
      } else {
        float dotRepeat2 = 6.0;
        float dotWidth2 = 0.18;
        float cy2 = abs(fract(gridUV2.y * dotRepeat2) - 0.5);
        float cx2 = abs(fract(gridUV2.x * dotRepeat2) - 0.5);
        float dotMaskY2 = 1.0 - smoothstep(dotWidth2, dotWidth2 + fwidth(gridUV2.y * dotRepeat2), cy2);
        float dotMaskX2 = 1.0 - smoothstep(dotWidth2, dotWidth2 + fwidth(gridUV2.x * dotRepeat2), cx2);
        lineX2 *= dotMaskY2;
        lineY2 *= dotMaskX2;
      }
    }

    float altMask = max(lineX2, lineY2);
    float edgeDistX = min(abs(hit.x - (-0.5)), abs(hit.x - 0.5));
    float edgeDistY = min(abs(hit.y - (-0.2)), abs(hit.y - 0.2));
    float edgeDist = mix(edgeDistY, edgeDistX, hitIsY);
    float edgeGate = 1.0 - smoothstep(gridScale * 0.5, gridScale * 2.0, edgeDist);
    altMask *= edgeGate;

    float lineMask = max(primaryMask, altMask);
    float fade = exp(-dist * fadeStrength);

    float dur = max(0.05, uScanDuration);
    float del = max(0.0, uScanDelay);
    float scanZMax = 2.0;
    float widthScale = max(0.1, uScanGlow);
    float sigma = max(0.001, 0.18 * widthScale * uScanSoftness);
    float sigmaA = sigma * 2.0;

    float combinedPulse = 0.0;
    float combinedAura = 0.0;

    float cycle = dur + del;
    float tCycle = mod(iTime, cycle);
    float scanPhase = clamp((tCycle - del) / dur, 0.0, 1.0);
    float phase = scanPhase;
    if (uScanDirection > 0.5 && uScanDirection < 1.5) {
      phase = 1.0 - phase;
    } else if (uScanDirection > 1.5) {
      float t2 = mod(max(0.0, iTime - del), 2.0 * dur);
      phase = (t2 < dur) ? (t2 / dur) : (1.0 - (t2 - dur) / dur);
    }

    float scanZ = phase * scanZMax;
    float dz = abs(hit.z - scanZ);
    float lineBand = exp(-0.5 * (dz * dz) / (sigma * sigma));
    float taper = clamp(uPhaseTaper, 0.0, 0.49);
    float headW = taper;
    float tailW = taper;
    float headFade = smoother01(0.0, headW, phase);
    float tailFade = 1.0 - smoother01(1.0 - tailW, 1.0, phase);
    float phaseWindow = headFade * tailFade;
    float pulseBase = lineBand * phaseWindow;
    combinedPulse += pulseBase * clamp(uScanOpacity, 0.0, 1.0);
    float auraBand = exp(-0.5 * (dz * dz) / (sigmaA * sigmaA));
    combinedAura += (auraBand * 0.25) * phaseWindow * clamp(uScanOpacity, 0.0, 1.0);

    for (int i = 0; i < MAX_SCANS; i++) {
      if (float(i) >= uScanCount) break;
      float tActiveI = iTime - uScanStarts[i];
      float phaseI = clamp(tActiveI / dur, 0.0, 1.0);
      if (uScanDirection > 0.5 && uScanDirection < 1.5) {
        phaseI = 1.0 - phaseI;
      } else if (uScanDirection > 1.5) {
        phaseI = (phaseI < 0.5) ? (phaseI * 2.0) : (1.0 - (phaseI - 0.5) * 2.0);
      }
      float scanZI = phaseI * scanZMax;
      float dzI = abs(hit.z - scanZI);
      float lineBandI = exp(-0.5 * (dzI * dzI) / (sigma * sigma));
      float headFadeI = smoother01(0.0, headW, phaseI);
      float tailFadeI = 1.0 - smoother01(1.0 - tailW, 1.0, phaseI);
      float phaseWindowI = headFadeI * tailFadeI;
      combinedPulse += lineBandI * phaseWindowI * clamp(uScanOpacity, 0.0, 1.0);
      float auraBandI = exp(-0.5 * (dzI * dzI) / (sigmaA * sigmaA));
      combinedAura += (auraBandI * 0.25) * phaseWindowI * clamp(uScanOpacity, 0.0, 1.0);
    }

    float lineVis = lineMask;
    vec3 gridCol = uLinesColor * lineVis * fade;
    vec3 scanCol = uScanColor * combinedPulse;
    vec3 scanAura = uScanColor * combinedAura;
    color = gridCol + scanCol + scanAura;

    float n = fract(sin(dot(gl_FragCoord.xy + vec2(iTime * 123.4), vec2(12.9898, 78.233))) * 43758.5453123);
    color += (n - 0.5) * uNoise;
    color = clamp(color, 0.0, 1.0);

    float alpha = clamp(max(lineVis, combinedPulse), 0.0, 1.0);
    float gx = 1.0 - smoothstep(tx * 2.0, tx * 2.0 + aax * 2.0, ax);
    float gy = 1.0 - smoothstep(ty * 2.0, ty * 2.0 + aay * 2.0, ay);
    float halo = max(gx, gy) * fade;
    alpha = max(alpha, halo * clamp(uBloomOpacity, 0.0, 1.0));
    fragColor = vec4(color, alpha);
  }

  void main() {
    vec4 c;
    mainImage(c, vUv * iResolution.xy);
    gl_FragColor = c;
  }
`

export default function MassageLabGridScanBackground({
  className,
  massageLabGridScan,
}: BackgroundEffectProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const options = useMemo(
    () => resolveGridScanOptions(massageLabGridScan),
    [massageLabGridScan],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) {
      return undefined
    }

    const gl = canvas.getContext("webgl", {
      alpha: true,
      antialias: true,
      depth: false,
      powerPreference: "high-performance",
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
      stencil: false,
    })

    if (!gl) {
      return undefined
    }

    const derivatives = gl.getExtension("OES_standard_derivatives")
    if (!derivatives) {
      return undefined
    }

    const resources = createGridScanResources(gl)
    if (!resources) {
      return undefined
    }

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const compactViewportQuery = window.matchMedia("(max-width: 640px)")
    const scanStarts: number[] = []
    const scanBuffer = new Float32Array(MAX_SCANS)
    const targetLook: Vec2 = { x: 0, y: 0 }
    const currentLook: Vec2 = { x: 0, y: 0 }
    const targetTilt = { value: 0 }
    const currentTilt = { value: 0 }
    const targetYaw = { value: 0 }
    const currentYaw = { value: 0 }
    let frame = 0
    let lastTime = performance.now()
    let elapsedSeconds = 0
    let width = 1
    let height = 1
    let disposed = false
    let shouldAnimate = true
    let snapBackTimer = 0

    const sensitivity = clampNumber(options.sensitivity, 0.55, 0, 1)
    const skewScale = lerp(0.06, 0.2, sensitivity)
    const tiltScale = lerp(0.12, 0.3, sensitivity)
    const yawScale = lerp(0.1, 0.28, sensitivity)
    const smoothFactor = lerp(0.06, 0.22, sensitivity)
    const yBoost = lerp(1.2, 1.6, sensitivity)

    const getShouldAnimate = () => {
      const bounds = canvas.getBoundingClientRect()
      return shouldAnimateAmbientBackground({
        prefersReducedMotion: reducedMotionQuery.matches,
        compactViewport: Math.min(bounds.width, bounds.height) < 360 || compactViewportQuery.matches,
        allowCompactViewport: true,
        documentHidden: document.hidden,
      })
    }

    const pushScan = (time: number) => {
      if (scanStarts.length >= MAX_SCANS) {
        scanStarts.shift()
      }
      scanStarts.push(time)
    }

    const resize = () => {
      const bounds = canvas.getBoundingClientRect()
      const nextWidth = Math.max(1, Math.floor(bounds.width))
      const nextHeight = Math.max(1, Math.floor(bounds.height))
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = Math.max(1, Math.floor(nextWidth * dpr))
      height = Math.max(1, Math.floor(nextHeight * dpr))
      canvas.width = width
      canvas.height = height
      gl.viewport(0, 0, width, height)
      renderGridScan(gl, resources, options, width, height, elapsedSeconds, currentLook, currentTilt.value, currentYaw.value, scanStarts, scanBuffer)
    }

    const draw = (now: number) => {
      const deltaSeconds = Math.min((now - lastTime) / 1000, 0.05)
      lastTime = now
      if (shouldAnimate) {
        elapsedSeconds += deltaSeconds
      }

      currentLook.x += (targetLook.x - currentLook.x) * smoothFactor
      currentLook.y += (targetLook.y - currentLook.y) * smoothFactor
      currentTilt.value += (targetTilt.value - currentTilt.value) * smoothFactor
      currentYaw.value += (targetYaw.value - currentYaw.value) * smoothFactor

      const skewLook = {
        x: currentLook.x * skewScale,
        y: -currentLook.y * yBoost * skewScale,
      }
      renderGridScan(gl, resources, options, width, height, elapsedSeconds, skewLook, currentTilt.value * tiltScale, clampNumber(currentYaw.value * yawScale, 0, -0.6, 0.6), scanStarts, scanBuffer)

      if (!disposed && shouldAnimate) {
        frame = window.requestAnimationFrame(draw)
      }
    }

    const updateMotion = () => {
      shouldAnimate = getShouldAnimate()
      if (frame) {
        window.cancelAnimationFrame(frame)
        frame = 0
      }
      lastTime = performance.now()
      if (shouldAnimate) {
        frame = window.requestAnimationFrame(draw)
      } else {
        draw(lastTime)
      }
    }

    const onPointerMove = (event: PointerEvent) => {
      if (!options.enablePointerInteraction) {
        return
      }
      const bounds = canvas.getBoundingClientRect()
      if (bounds.width <= 0 || bounds.height <= 0) {
        return
      }
      targetLook.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1
      targetLook.y = -(((event.clientY - bounds.top) / bounds.height) * 2 - 1)
      targetTilt.value = targetLook.x * 0.35
      targetYaw.value = targetLook.x
    }

    const onPointerLeave = () => {
      if (snapBackTimer) {
        window.clearTimeout(snapBackTimer)
      }
      snapBackTimer = window.setTimeout(() => {
        targetLook.x = 0
        targetLook.y = 0
        targetTilt.value = 0
        targetYaw.value = 0
      }, 250)
    }

    const onPointerDown = () => {
      if (options.scanOnClick) {
        pushScan(elapsedSeconds)
      }
    }

    const resizeObserver = new ResizeObserver(() => {
      resize()
      updateMotion()
    })

    const onVisibilityChange = () => updateMotion()
    const onResize = () => {
      resize()
      updateMotion()
    }

    resizeObserver.observe(canvas)
    window.addEventListener("resize", onResize)
    document.addEventListener("visibilitychange", onVisibilityChange)
    addMediaListener(reducedMotionQuery, updateMotion)
    addMediaListener(compactViewportQuery, updateMotion)
    window.addEventListener("pointermove", onPointerMove, { passive: true })
    window.addEventListener("pointerleave", onPointerLeave)
    window.addEventListener("pointerdown", onPointerDown, { passive: true })

    resize()
    updateMotion()

    return () => {
      disposed = true
      if (frame) {
        window.cancelAnimationFrame(frame)
      }
      if (snapBackTimer) {
        window.clearTimeout(snapBackTimer)
      }
      resizeObserver.disconnect()
      window.removeEventListener("resize", onResize)
      document.removeEventListener("visibilitychange", onVisibilityChange)
      removeMediaListener(reducedMotionQuery, updateMotion)
      removeMediaListener(compactViewportQuery, updateMotion)
      window.removeEventListener("pointermove", onPointerMove)
      window.removeEventListener("pointerleave", onPointerLeave)
      window.removeEventListener("pointerdown", onPointerDown)
      disposeGridScanResources(gl, resources)
    }
  }, [options])

  return (
    <div className={cn(styles.massageLabGridScan, className)} aria-hidden="true">
      <canvas ref={canvasRef} className={styles.massageLabGridScanCanvas} />
    </div>
  )
}

function addMediaListener(query: MediaQueryList, listener: () => void) {
  if (typeof query.addEventListener === "function") {
    query.addEventListener("change", listener)
  } else {
    query.addListener(listener)
  }
}

function removeMediaListener(query: MediaQueryList, listener: () => void) {
  if (typeof query.removeEventListener === "function") {
    query.removeEventListener("change", listener)
  } else {
    query.removeListener(listener)
  }
}

function createGridScanResources(gl: WebGLRenderingContext): GridScanResources | null {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexShaderSource)
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource)
  const program = gl.createProgram()
  if (!vertexShader || !fragmentShader || !program) {
    if (vertexShader) gl.deleteShader(vertexShader)
    if (fragmentShader) gl.deleteShader(fragmentShader)
    if (program) gl.deleteProgram(program)
    return null
  }

  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program)
    gl.deleteShader(vertexShader)
    gl.deleteShader(fragmentShader)
    return null
  }

  const positionBuffer = createArrayBuffer(gl, new Float32Array([-1, -1, 3, -1, -1, 3]))
  if (!positionBuffer) {
    gl.deleteProgram(program)
    gl.deleteShader(vertexShader)
    gl.deleteShader(fragmentShader)
    return null
  }

  return {
    program,
    vertexShader,
    fragmentShader,
    positionBuffer,
    attributes: {
      position: gl.getAttribLocation(program, "position"),
    },
    uniforms: {
      resolution: getUniformLocation(gl, program, "iResolution"),
      time: getUniformLocation(gl, program, "iTime"),
      skew: getUniformLocation(gl, program, "uSkew"),
      tilt: getUniformLocation(gl, program, "uTilt"),
      yaw: getUniformLocation(gl, program, "uYaw"),
      lineThickness: getUniformLocation(gl, program, "uLineThickness"),
      linesColor: getUniformLocation(gl, program, "uLinesColor"),
      scanColor: getUniformLocation(gl, program, "uScanColor"),
      gridScale: getUniformLocation(gl, program, "uGridScale"),
      lineStyle: getUniformLocation(gl, program, "uLineStyle"),
      lineJitter: getUniformLocation(gl, program, "uLineJitter"),
      scanOpacity: getUniformLocation(gl, program, "uScanOpacity"),
      scanDirection: getUniformLocation(gl, program, "uScanDirection"),
      noise: getUniformLocation(gl, program, "uNoise"),
      bloomOpacity: getUniformLocation(gl, program, "uBloomOpacity"),
      scanGlow: getUniformLocation(gl, program, "uScanGlow"),
      scanSoftness: getUniformLocation(gl, program, "uScanSoftness"),
      phaseTaper: getUniformLocation(gl, program, "uPhaseTaper"),
      scanDuration: getUniformLocation(gl, program, "uScanDuration"),
      scanDelay: getUniformLocation(gl, program, "uScanDelay"),
      scanStarts: getUniformLocation(gl, program, "uScanStarts"),
      scanCount: getUniformLocation(gl, program, "uScanCount"),
    },
  }
}

function renderGridScan(
  gl: WebGLRenderingContext,
  resources: GridScanResources,
  options: ResolvedGridScanOptions,
  width: number,
  height: number,
  time: number,
  skew: Vec2,
  tilt: number,
  yaw: number,
  scanStarts: number[],
  scanBuffer: Float32Array,
) {
  scanBuffer.fill(0)
  for (let index = 0; index < Math.min(MAX_SCANS, scanStarts.length); index += 1) {
    scanBuffer[index] = scanStarts[index]
  }

  gl.clearColor(0, 0, 0, 0)
  gl.clear(gl.COLOR_BUFFER_BIT)
  gl.disable(gl.DEPTH_TEST)
  gl.useProgram(resources.program)
  bindAttribute(gl, resources.positionBuffer, resources.attributes.position, 2)

  setUniformColor(gl, resources.uniforms.linesColor, hexToLinearRgbColor(options.linesColor))
  setUniformColor(gl, resources.uniforms.scanColor, hexToLinearRgbColor(options.scanColor))
  gl.uniform3f(resources.uniforms.resolution, width, height, Math.min(window.devicePixelRatio || 1, 2))
  gl.uniform1f(resources.uniforms.time, time)
  gl.uniform2f(resources.uniforms.skew, skew.x, skew.y)
  gl.uniform1f(resources.uniforms.tilt, tilt)
  gl.uniform1f(resources.uniforms.yaw, yaw)
  gl.uniform1f(resources.uniforms.lineThickness, options.lineThickness)
  gl.uniform1f(resources.uniforms.gridScale, options.gridScale)
  gl.uniform1f(resources.uniforms.lineStyle, lineStyleToUniform(options.lineStyle))
  gl.uniform1f(resources.uniforms.lineJitter, options.lineJitter)
  gl.uniform1f(resources.uniforms.scanOpacity, options.scanOpacity)
  gl.uniform1f(resources.uniforms.scanDirection, directionToUniform(options.scanDirection))
  gl.uniform1f(resources.uniforms.noise, options.noiseIntensity)
  gl.uniform1f(resources.uniforms.bloomOpacity, options.bloomOpacity)
  gl.uniform1f(resources.uniforms.scanGlow, options.scanGlow)
  gl.uniform1f(resources.uniforms.scanSoftness, options.scanSoftness)
  gl.uniform1f(resources.uniforms.phaseTaper, options.scanPhaseTaper)
  gl.uniform1f(resources.uniforms.scanDuration, options.scanDuration)
  gl.uniform1f(resources.uniforms.scanDelay, options.scanDelay)
  gl.uniform1fv(resources.uniforms.scanStarts, scanBuffer)
  gl.uniform1f(resources.uniforms.scanCount, Math.min(MAX_SCANS, scanStarts.length))
  gl.drawArrays(gl.TRIANGLES, 0, 3)
}

function bindAttribute(gl: WebGLRenderingContext, buffer: WebGLBuffer, location: number, size: number) {
  if (location < 0) {
    return
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.enableVertexAttribArray(location)
  gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0)
}

function createArrayBuffer(gl: WebGLRenderingContext, data: Float32Array): WebGLBuffer | null {
  const buffer = gl.createBuffer()
  if (!buffer) {
    return null
  }

  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW)
  return buffer
}

function disposeGridScanResources(gl: WebGLRenderingContext, resources: GridScanResources) {
  gl.deleteBuffer(resources.positionBuffer)
  gl.deleteProgram(resources.program)
  gl.deleteShader(resources.vertexShader)
  gl.deleteShader(resources.fragmentShader)
}

function compileShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type)
  if (!shader) {
    return null
  }

  const sourceWithDerivatives = type === gl.FRAGMENT_SHADER
    ? `#extension GL_OES_standard_derivatives : enable\n${source}`
    : source
  gl.shaderSource(shader, sourceWithDerivatives)
  gl.compileShader(shader)

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader)
    return null
  }

  return shader
}

function getUniformLocation(
  gl: WebGLRenderingContext,
  program: WebGLProgram,
  name: string,
): WebGLUniformLocation {
  const location = gl.getUniformLocation(program, name)
  if (!location) {
    throw new Error(`Missing MassageLab Grid Scan uniform: ${name}`)
  }
  return location
}

function resolveGridScanOptions(options?: MassageLabGridScanOptions): ResolvedGridScanOptions {
  return {
    sensitivity: clampNumber(options?.sensitivity, DEFAULT_MASSAGELAB_GRID_SCAN.sensitivity, 0, 1),
    lineThickness: clampNumber(options?.lineThickness, DEFAULT_MASSAGELAB_GRID_SCAN.lineThickness, 0.2, 6),
    linesColor: normalizeHexColor(options?.linesColor, DEFAULT_MASSAGELAB_GRID_SCAN.linesColor),
    scanColor: normalizeHexColor(options?.scanColor, DEFAULT_MASSAGELAB_GRID_SCAN.scanColor),
    scanOpacity: clampNumber(options?.scanOpacity, DEFAULT_MASSAGELAB_GRID_SCAN.scanOpacity, 0, 1),
    gridScale: clampNumber(options?.gridScale, DEFAULT_MASSAGELAB_GRID_SCAN.gridScale, 0.02, 0.5),
    lineStyle: normalizeLineStyle(options?.lineStyle),
    lineJitter: clampNumber(options?.lineJitter, DEFAULT_MASSAGELAB_GRID_SCAN.lineJitter, 0, 1),
    scanDirection: normalizeScanDirection(options?.scanDirection),
    noiseIntensity: clampNumber(options?.noiseIntensity, DEFAULT_MASSAGELAB_GRID_SCAN.noiseIntensity, 0, 0.25),
    bloomOpacity: clampNumber(options?.bloomOpacity, DEFAULT_MASSAGELAB_GRID_SCAN.bloomOpacity, 0, 2),
    scanGlow: clampNumber(options?.scanGlow, DEFAULT_MASSAGELAB_GRID_SCAN.scanGlow, 0.1, 3),
    scanSoftness: clampNumber(options?.scanSoftness, DEFAULT_MASSAGELAB_GRID_SCAN.scanSoftness, 0.2, 6),
    scanPhaseTaper: clampNumber(options?.scanPhaseTaper, DEFAULT_MASSAGELAB_GRID_SCAN.scanPhaseTaper, 0, 0.49),
    scanDuration: clampNumber(options?.scanDuration, DEFAULT_MASSAGELAB_GRID_SCAN.scanDuration, 0.05, 10),
    scanDelay: clampNumber(options?.scanDelay, DEFAULT_MASSAGELAB_GRID_SCAN.scanDelay, 0, 10),
    enablePointerInteraction: options?.enablePointerInteraction === true,
    scanOnClick: options?.scanOnClick === true,
  }
}

function normalizeLineStyle(value: unknown): LineStyle {
  return value === "dashed" || value === "dotted" || value === "solid"
    ? value
    : DEFAULT_MASSAGELAB_GRID_SCAN.lineStyle
}

function normalizeScanDirection(value: unknown): ScanDirection {
  return value === "forward" || value === "backward" || value === "pingpong"
    ? value
    : DEFAULT_MASSAGELAB_GRID_SCAN.scanDirection
}

function lineStyleToUniform(value: LineStyle): number {
  if (value === "dashed") return 1
  if (value === "dotted") return 2
  return 0
}

function directionToUniform(value: ScanDirection): number {
  if (value === "backward") return 1
  if (value === "pingpong") return 2
  return 0
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback
  }

  return Math.min(max, Math.max(min, value))
}

function normalizeHexColor(value: unknown, fallback: string): string {
  if (typeof value !== "string") {
    return fallback
  }

  const normalized = value.trim()
  return /^#[0-9a-f]{6}$/i.test(normalized) ? normalized.toUpperCase() : fallback
}

function hexToLinearRgbColor(hex: string): RgbColor {
  const normalized = normalizeHexColor(hex, "#FFFFFF").slice(1).padEnd(6, "0")
  const value = Number.parseInt(normalized, 16)
  return [
    srgbToLinear(((value >> 16) & 255) / 255),
    srgbToLinear(((value >> 8) & 255) / 255),
    srgbToLinear((value & 255) / 255),
  ]
}

function srgbToLinear(value: number): number {
  return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
}

function setUniformColor(gl: WebGLRenderingContext, location: WebGLUniformLocation, color: RgbColor) {
  gl.uniform3f(location, color[0], color[1], color[2])
}

function lerp(min: number, max: number, amount: number): number {
  return min + (max - min) * amount
}
