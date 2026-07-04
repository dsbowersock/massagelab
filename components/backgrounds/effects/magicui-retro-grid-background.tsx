"use client"

import { type CSSProperties, useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"
import styles from "@/components/backgrounds/BackgroundHost.module.css"
import type { BackgroundEffectProps, MagicRetroGridOptions } from "./css-backgrounds"

const ANIMATION_DURATION_SECONDS = 15
const GRID_HEIGHT_RATIO = 3
const GRID_LINE_ALIGNMENT_OFFSET_PX = 0.5
const GRID_LINE_ANTIALIAS_MULTIPLIER = 0.9
const GRID_LINE_WIDTH_PX = 0.92
const GRID_START_OFFSET_RATIO = -0.5
const GRID_WIDTH_RATIO = 6
const GRID_X_OFFSET_RATIO = -2
const MAX_ANGLE = 89
const MAX_DEVICE_PIXEL_RATIO = 2
const MIN_ANGLE = 1
const PERSPECTIVE_PX = 200

const DEFAULT_MAGIC_RETRO_GRID = {
  angle: 65,
  cellSize: 60,
  opacity: 0.5,
  lightLineColor: "#808080",
  darkLineColor: "#808080",
  backgroundColor: "#020617",
} satisfies Required<MagicRetroGridOptions>

const VERTEX_SHADER_SOURCE = `
  attribute vec2 a_position;

  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`

const FRAGMENT_SHADER_SOURCE = `
  #extension GL_OES_standard_derivatives : enable

  precision highp float;

  uniform vec2 u_container_size;
  uniform vec2 u_viewport_size;
  uniform vec4 u_line_color;
  uniform float u_angle;
  uniform float u_cell_size;
  uniform float u_device_pixel_ratio;
  uniform float u_time;

  const float animationDurationSeconds = ${ANIMATION_DURATION_SECONDS.toFixed(1)};
  const float gridHeightRatio = ${GRID_HEIGHT_RATIO.toFixed(1)};
  const float gridStartOffsetRatio = ${GRID_START_OFFSET_RATIO.toFixed(1)};
  const float gridWidthRatio = ${GRID_WIDTH_RATIO.toFixed(1)};
  const float gridXOffsetRatio = ${GRID_X_OFFSET_RATIO.toFixed(1)};
  const float gridLineAlignmentOffsetPx = ${GRID_LINE_ALIGNMENT_OFFSET_PX.toFixed(1)};
  const float gridLineAntialiasMultiplier = ${GRID_LINE_ANTIALIAS_MULTIPLIER.toFixed(1)};
  const float horizontalLodLevelOneEndPx = 5.6;
  const float horizontalLodLevelOneStartPx = 2.8;
  const float horizontalLodLevelTwoEndPx = 3.0;
  const float horizontalLodLevelTwoStartPx = 1.4;
  const float horizontalCompressionEndPx = 2.8;
  const float horizontalCompressionStartPx = 1.2;
  const float lineWidthPx = ${GRID_LINE_WIDTH_PX.toFixed(2)};
  const float perspectivePx = ${PERSPECTIVE_PX.toFixed(1)};
  const float gridTravelRatio = 0.5;
  const float verticalCompressionEndPx = 2.6;
  const float verticalCompressionStartPx = 1.0;
  const float verticalEdgeCompressionEnd = 0.95;
  const float verticalEdgeCompressionStart = 0.45;
  const float verticalLodLevelEnd = 0.64;
  const float verticalLodLevelStart = 0.22;
  const float verticalTopCompressionEndCells = 6.0;
  const float verticalTopCompressionStartCells = 2.0;

  float renderGridLine(float wrappedCoord, float antiAliasWidth, float softnessBoost) {
    return 1.0 - smoothstep(lineWidthPx, lineWidthPx + (antiAliasWidth * (1.5 + softnessBoost)), wrappedCoord);
  }

  void main() {
    float angle = radians(clamp(u_angle, 1.0, 89.0));
    float sinAngle = sin(angle);
    float cosAngle = cos(angle);
    vec2 screen = vec2(
      (gl_FragCoord.x / u_device_pixel_ratio) - (u_container_size.x * 0.5),
      (u_container_size.y * 0.5) - (gl_FragCoord.y / u_device_pixel_ratio)
    );
    vec3 rayOrigin = vec3(0.0, 0.0, perspectivePx);
    vec3 rayDirection = normalize(vec3(screen, -perspectivePx));
    vec3 planeXAxis = vec3(1.0, 0.0, 0.0);
    vec3 planeYAxis = vec3(0.0, cosAngle, sinAngle);
    vec3 planeNormal = normalize(cross(planeXAxis, planeYAxis));
    float denominator = dot(rayDirection, planeNormal);

    if (abs(denominator) < 0.0001) {
      discard;
    }

    float distanceToPlane = dot(-rayOrigin, planeNormal) / denominator;

    if (distanceToPlane <= 0.0) {
      discard;
    }

    vec3 hitPoint = rayOrigin + (rayDirection * distanceToPlane);
    float localX = hitPoint.x;
    float localY = dot(hitPoint, planeYAxis);
    float gridWidth = u_viewport_size.x * gridWidthRatio;
    float gridHeight = u_viewport_size.y * gridHeightRatio;
    float gridScrollSpeed = (gridHeight * gridTravelRatio) / animationDurationSeconds;
    float patternOffsetY = u_time * gridScrollSpeed;
    float gridLeft = (-0.5 * u_container_size.x) + (gridXOffsetRatio * u_container_size.x);
    float gridTop = (-0.5 * u_container_size.y) + (gridStartOffsetRatio * gridHeight);
    vec2 planePosition = vec2(localX - gridLeft, localY - gridTop);

    if (planePosition.x < 0.0 || planePosition.y < 0.0 || planePosition.x > gridWidth || planePosition.y > gridHeight) {
      discard;
    }

    vec2 patternPosition = vec2(planePosition.x, planePosition.y - patternOffsetY);
    vec2 wrapped = mod(patternPosition + vec2(gridLineAlignmentOffsetPx), u_cell_size);
    vec2 patternDerivative = max(fwidth(patternPosition), vec2(0.0001));
    vec2 antiAliasWidth = patternDerivative * gridLineAntialiasMultiplier;
    float horizontalCellSpanPx = u_cell_size / patternDerivative.y;
    float horizontalCompression = 1.0 - smoothstep(horizontalCompressionStartPx, horizontalCompressionEndPx, horizontalCellSpanPx);
    float verticalCellSpanPx = u_cell_size / patternDerivative.x;
    float sideDistance = abs((planePosition.x / gridWidth) * 2.0 - 1.0);
    float verticalEdgeCompression = smoothstep(verticalEdgeCompressionStart, verticalEdgeCompressionEnd, sideDistance);
    float verticalTopCompression = 1.0 - smoothstep(
      u_cell_size * verticalTopCompressionStartCells,
      u_cell_size * verticalTopCompressionEndCells,
      planePosition.y
    );
    float verticalCompression =
      (1.0 - smoothstep(verticalCompressionStartPx, verticalCompressionEndPx, verticalCellSpanPx))
      * verticalEdgeCompression
      * verticalTopCompression;
    float horizontalSoftnessBoost = 1.0 + (horizontalCompression * 3.0);
    float verticalSoftnessBoost = 1.0 + (verticalCompression * 3.5);
    float verticalLod = smoothstep(verticalLodLevelStart, verticalLodLevelEnd, verticalCompression);
    float verticalLineFine = renderGridLine(wrapped.x, antiAliasWidth.x, verticalSoftnessBoost);
    float verticalWrappedLod = mod(patternPosition.x + gridLineAlignmentOffsetPx, u_cell_size * 2.0);
    float verticalLineCoarse = renderGridLine(verticalWrappedLod, antiAliasWidth.x, verticalSoftnessBoost + verticalLod);
    float verticalLine = max(verticalLineFine * (1.0 - verticalLod), verticalLineCoarse * verticalLod);
    float horizontalLodLevelOne = 1.0 - smoothstep(horizontalLodLevelOneStartPx, horizontalLodLevelOneEndPx, horizontalCellSpanPx);
    float horizontalLodLevelTwo = 1.0 - smoothstep(horizontalLodLevelTwoStartPx, horizontalLodLevelTwoEndPx, horizontalCellSpanPx);
    float horizontalLineFine = renderGridLine(wrapped.y, antiAliasWidth.y, horizontalSoftnessBoost);
    float horizontalWrappedLodOne = mod(patternPosition.y + gridLineAlignmentOffsetPx, u_cell_size * 2.0);
    float horizontalWrappedLodTwo = mod(patternPosition.y + gridLineAlignmentOffsetPx, u_cell_size * 4.0);
    float horizontalLineCoarse = renderGridLine(horizontalWrappedLodOne, antiAliasWidth.y, horizontalSoftnessBoost + horizontalLodLevelOne);
    float horizontalLineExtraCoarse = renderGridLine(
      horizontalWrappedLodTwo,
      antiAliasWidth.y,
      horizontalSoftnessBoost + horizontalLodLevelOne + horizontalLodLevelTwo
    );
    float horizontalLineReduced = max(horizontalLineFine * (1.0 - horizontalLodLevelOne), horizontalLineCoarse * horizontalLodLevelOne);
    float horizontalLine = max(horizontalLineReduced * (1.0 - horizontalLodLevelTwo), horizontalLineExtraCoarse * horizontalLodLevelTwo);
    float line = max(verticalLine, horizontalLine);

    if (line <= 0.001) {
      discard;
    }

    float alpha = u_line_color.a * line;
    gl_FragColor = vec4(u_line_color.rgb * alpha, alpha);
  }
`

interface ProgramInfo {
  attributeLocation: number
  program: WebGLProgram
  uniforms: {
    angle: WebGLUniformLocation
    cellSize: WebGLUniformLocation
    containerSize: WebGLUniformLocation
    devicePixelRatio: WebGLUniformLocation
    lineColor: WebGLUniformLocation
    time: WebGLUniformLocation
    viewportSize: WebGLUniformLocation
  }
}

export default function MagicRetroGridBackground({
  className,
  magicRetroGrid,
}: BackgroundEffectProps) {
  const resolved = resolveRetroGridOptions(magicRetroGrid)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const optionsRef = useRef(resolved)
  const syncSceneRef = useRef<(() => void) | null>(null)
  const [isWebGlReady, setIsWebGlReady] = useState(false)
  const [activeLineColor, setActiveLineColor] = useState(resolved.darkLineColor)

  useEffect(() => {
    optionsRef.current = resolved
    syncSceneRef.current?.()
  }, [resolved])

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current

    if (!canvas || !container) {
      return undefined
    }

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)")
    const colorScheme = window.matchMedia("(prefers-color-scheme: dark)")
    let animationFrameId: number | null = null
    let currentWidth = 0
    let currentHeight = 0
    let currentDevicePixelRatio = 1
    let gl: WebGLRenderingContext | null = null
    let isVisible = document.visibilityState === "visible"
    let isContextLost = false
    let positionBuffer: WebGLBuffer | null = null
    let programInfo: ProgramInfo | null = null

    const releasePipeline = (shouldDeleteResources: boolean) => {
      if (shouldDeleteResources && gl) {
        if (positionBuffer) {
          gl.deleteBuffer(positionBuffer)
        }

        if (programInfo) {
          gl.deleteProgram(programInfo.program)
        }
      }

      positionBuffer = null
      programInfo = null

      if (shouldDeleteResources) {
        gl = null
      }
    }

    const getContext = () => {
      const nextGl = canvas.getContext("webgl", {
        alpha: true,
        antialias: true,
        premultipliedAlpha: true,
      })

      if (!nextGl || !nextGl.getExtension("OES_standard_derivatives")) {
        return null
      }

      return nextGl
    }

    const initializePipeline = () => {
      const nextGl = getContext()

      if (!nextGl) {
        releasePipeline(false)
        return false
      }

      gl = nextGl
      releasePipeline(true)
      gl = nextGl

      const program = createProgram(nextGl)
      if (!program) {
        return false
      }

      const nextProgramInfo = getProgramInfo(nextGl, program)
      if (!nextProgramInfo) {
        nextGl.deleteProgram(program)
        return false
      }

      const nextPositionBuffer = nextGl.createBuffer()
      if (!nextPositionBuffer) {
        nextGl.deleteProgram(program)
        return false
      }

      nextGl.bindBuffer(nextGl.ARRAY_BUFFER, nextPositionBuffer)
      nextGl.bufferData(nextGl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), nextGl.STATIC_DRAW)
      positionBuffer = nextPositionBuffer
      programInfo = nextProgramInfo
      return true
    }

    const getActiveLineColor = () => (
      isDarkMode(colorScheme)
        ? optionsRef.current.darkLineColor
        : optionsRef.current.lightLineColor
    )

    const resizeCanvas = () => {
      currentWidth = Math.floor(container.clientWidth)
      currentHeight = Math.floor(container.clientHeight)

      if (currentWidth === 0 || currentHeight === 0 || !gl) {
        return
      }

      currentDevicePixelRatio = Math.min(window.devicePixelRatio || 1, MAX_DEVICE_PIXEL_RATIO)
      canvas.width = Math.floor(currentWidth * currentDevicePixelRatio)
      canvas.height = Math.floor(currentHeight * currentDevicePixelRatio)
      canvas.style.width = `${currentWidth}px`
      canvas.style.height = `${currentHeight}px`
      gl.viewport(0, 0, canvas.width, canvas.height)
    }

    const draw = (timestamp: number) => {
      if (
        currentWidth === 0
        || currentHeight === 0
        || !gl
        || !positionBuffer
        || !programInfo
        || isContextLost
      ) {
        return
      }

      const current = optionsRef.current
      const lineColor = hexToRgba(getActiveLineColor(), current.opacity)
      gl.useProgram(programInfo.program)
      gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
      gl.enableVertexAttribArray(programInfo.attributeLocation)
      gl.vertexAttribPointer(programInfo.attributeLocation, 2, gl.FLOAT, false, 0, 0)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.uniform1f(programInfo.uniforms.angle, current.angle)
      gl.uniform1f(programInfo.uniforms.cellSize, current.cellSize)
      gl.uniform2f(programInfo.uniforms.containerSize, currentWidth, currentHeight)
      gl.uniform1f(programInfo.uniforms.devicePixelRatio, currentDevicePixelRatio)
      gl.uniform4fv(programInfo.uniforms.lineColor, lineColor)
      gl.uniform1f(programInfo.uniforms.time, reducedMotion.matches ? 0 : timestamp / 1000)
      gl.uniform2f(programInfo.uniforms.viewportSize, window.innerWidth, window.innerHeight)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }

    const stopAnimation = () => {
      if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId)
        animationFrameId = null
      }
    }

    const frame = (timestamp: number) => {
      draw(timestamp)

      if (!reducedMotion.matches && isVisible) {
        animationFrameId = requestAnimationFrame(frame)
        return
      }

      animationFrameId = null
    }

    const syncScene = () => {
      if (isContextLost) {
        stopAnimation()
        setIsWebGlReady(false)
        return
      }

      if (!gl || !positionBuffer || !programInfo) {
        if (!initializePipeline()) {
          stopAnimation()
          setIsWebGlReady(false)
          return
        }
      }

      resizeCanvas()

      if (currentWidth === 0 || currentHeight === 0) {
        stopAnimation()
        return
      }

      setActiveLineColor(getActiveLineColor())
      draw(performance.now())
      setIsWebGlReady(true)

      if (reducedMotion.matches || !isVisible) {
        stopAnimation()
        return
      }

      if (animationFrameId === null) {
        animationFrameId = requestAnimationFrame(frame)
      }
    }

    syncSceneRef.current = syncScene

    const resizeObserver = new ResizeObserver(syncScene)
    resizeObserver.observe(container)

    const intersectionObserver = new IntersectionObserver(([entry]) => {
      isVisible = Boolean(entry?.isIntersecting) && document.visibilityState === "visible"

      if (isVisible) {
        syncScene()
        return
      }

      stopAnimation()
    })
    intersectionObserver.observe(container)

    const themeObserver = new MutationObserver(syncScene)
    themeObserver.observe(document.documentElement, {
      attributeFilter: ["class"],
      attributes: true,
    })

    const handleVisibilityChange = () => {
      isVisible = document.visibilityState === "visible"

      if (isVisible) {
        syncScene()
        return
      }

      stopAnimation()
    }
    const handleWindowResize = () => syncScene()
    const handleMotionChange = () => syncScene()
    const handleColorSchemeChange = () => syncScene()
    const handleContextLost = (event: Event) => {
      event.preventDefault()
      isContextLost = true
      stopAnimation()
      releasePipeline(false)
      setIsWebGlReady(false)
    }
    const handleContextRestored = () => {
      isContextLost = false
      syncScene()
    }

    reducedMotion.addEventListener("change", handleMotionChange)
    colorScheme.addEventListener("change", handleColorSchemeChange)
    document.addEventListener("visibilitychange", handleVisibilityChange)
    window.addEventListener("resize", handleWindowResize)
    canvas.addEventListener("webglcontextlost", handleContextLost)
    canvas.addEventListener("webglcontextrestored", handleContextRestored)
    syncScene()

    return () => {
      stopAnimation()
      resizeObserver.disconnect()
      intersectionObserver.disconnect()
      themeObserver.disconnect()
      reducedMotion.removeEventListener("change", handleMotionChange)
      colorScheme.removeEventListener("change", handleColorSchemeChange)
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      window.removeEventListener("resize", handleWindowResize)
      canvas.removeEventListener("webglcontextlost", handleContextLost)
      canvas.removeEventListener("webglcontextrestored", handleContextRestored)
      syncSceneRef.current = null
      releasePipeline(!isContextLost)
      canvas.width = 1
      canvas.height = 1
    }
  }, [])

  const wrapperStyle = {
    "--ml-retro-grid-background": resolved.backgroundColor,
    "--ml-retro-grid-opacity": resolved.opacity,
  } as CSSProperties
  const fallbackGridStyle = {
    "--ml-retro-grid-cell-size": `${resolved.cellSize}px`,
    "--ml-retro-grid-line-color": activeLineColor,
  } as CSSProperties
  const fallbackRotationStyle = {
    transform: `rotateX(${resolved.angle}deg)`,
  } as CSSProperties

  return (
    <div
      ref={containerRef}
      className={cn(styles.effectLayer, styles.magicRetroGridBackground, className)}
      style={wrapperStyle}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className={styles.magicRetroGridCanvas} />
      {!isWebGlReady ? (
        <div className={styles.magicRetroGridFallbackPerspective}>
          <div className={styles.magicRetroGridFallbackRotation} style={fallbackRotationStyle}>
            <div className={styles.magicRetroGridFallbackGrid} style={fallbackGridStyle} />
          </div>
        </div>
      ) : null}
    </div>
  )
}

function resolveRetroGridOptions(options?: MagicRetroGridOptions): Required<MagicRetroGridOptions> {
  return {
    angle: clampNumber(options?.angle, DEFAULT_MAGIC_RETRO_GRID.angle, MIN_ANGLE, MAX_ANGLE),
    cellSize: clampNumber(options?.cellSize, DEFAULT_MAGIC_RETRO_GRID.cellSize, 12, 160),
    opacity: clampNumber(options?.opacity, DEFAULT_MAGIC_RETRO_GRID.opacity, 0.05, 1),
    lightLineColor: normalizeHexColor(options?.lightLineColor, DEFAULT_MAGIC_RETRO_GRID.lightLineColor),
    darkLineColor: normalizeHexColor(options?.darkLineColor, DEFAULT_MAGIC_RETRO_GRID.darkLineColor),
    backgroundColor: normalizeHexColor(options?.backgroundColor, DEFAULT_MAGIC_RETRO_GRID.backgroundColor),
  }
}

function clampNumber(value: number | undefined, fallback: number, min: number, max: number) {
  if (!Number.isFinite(value)) {
    return fallback
  }

  return Math.min(max, Math.max(min, Number(value)))
}

function normalizeHexColor(value: string | undefined, fallback: string) {
  if (typeof value !== "string") {
    return fallback
  }

  const normalized = value.trim()

  if (/^#[0-9a-fA-F]{6}$/.test(normalized)) {
    return normalized.toUpperCase()
  }

  return fallback
}

function hexToRgba(value: string, opacity: number) {
  const normalized = normalizeHexColor(value, DEFAULT_MAGIC_RETRO_GRID.darkLineColor)
  const red = Number.parseInt(normalized.slice(1, 3), 16) / 255
  const green = Number.parseInt(normalized.slice(3, 5), 16) / 255
  const blue = Number.parseInt(normalized.slice(5, 7), 16) / 255

  return new Float32Array([red, green, blue, opacity])
}

function createShader(gl: WebGLRenderingContext, type: number, source: string) {
  const shader = gl.createShader(type)

  if (!shader) {
    return null
  }

  gl.shaderSource(shader, source)
  gl.compileShader(shader)

  if (gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    return shader
  }

  gl.deleteShader(shader)
  return null
}

function createProgram(gl: WebGLRenderingContext) {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, VERTEX_SHADER_SOURCE)
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER_SOURCE)

  if (!vertexShader || !fragmentShader) {
    return null
  }

  const program = gl.createProgram()

  if (!program) {
    gl.deleteShader(vertexShader)
    gl.deleteShader(fragmentShader)
    return null
  }

  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)
  gl.deleteShader(vertexShader)
  gl.deleteShader(fragmentShader)

  if (gl.getProgramParameter(program, gl.LINK_STATUS)) {
    return program
  }

  gl.deleteProgram(program)
  return null
}

function getProgramInfo(gl: WebGLRenderingContext, program: WebGLProgram): ProgramInfo | null {
  const attributeLocation = gl.getAttribLocation(program, "a_position")
  const angle = gl.getUniformLocation(program, "u_angle")
  const cellSize = gl.getUniformLocation(program, "u_cell_size")
  const containerSize = gl.getUniformLocation(program, "u_container_size")
  const devicePixelRatio = gl.getUniformLocation(program, "u_device_pixel_ratio")
  const lineColor = gl.getUniformLocation(program, "u_line_color")
  const time = gl.getUniformLocation(program, "u_time")
  const viewportSize = gl.getUniformLocation(program, "u_viewport_size")

  if (
    attributeLocation < 0
    || !angle
    || !cellSize
    || !containerSize
    || !devicePixelRatio
    || !lineColor
    || !time
    || !viewportSize
  ) {
    return null
  }

  return {
    attributeLocation,
    program,
    uniforms: {
      angle,
      cellSize,
      containerSize,
      devicePixelRatio,
      lineColor,
      time,
      viewportSize,
    },
  }
}

function isDarkMode(colorScheme: MediaQueryList) {
  const root = document.documentElement

  if (root.classList.contains("dark")) {
    return true
  }

  if (root.classList.contains("light")) {
    return false
  }

  return colorScheme.matches
}
