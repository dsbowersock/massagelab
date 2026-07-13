"use client"

import * as React from "react"

import { vertexShaderSource } from "./shaders"

type ShaderUniformValue = number | number[]
const uniformKeyDelimiter = "\u001f"

interface ShaderMountProps {
  fragmentShader: string
  uniforms: Record<string, ShaderUniformValue>
  speed?: number
  width: number
  height: number
  className?: string
  style?: React.CSSProperties
}

/** Clamp shader color channels and fallback opacity into CSS rgba bounds. */
function clampUnit(value: number) {
  return Math.min(1, Math.max(0, value))
}

/** Convert shader RGBA uniforms back into CSS for the non-WebGL fallback mark. */
function uniformColorToCss(value: ShaderUniformValue | undefined) {
  if (!Array.isArray(value) || value.length < 3) {
    return "rgba(234, 88, 12, 1)"
  }

  const red = Math.round(clampUnit(value[0] ?? 0) * 255)
  const green = Math.round(clampUnit(value[1] ?? 0) * 255)
  const blue = Math.round(clampUnit(value[2] ?? 0) * 255)
  const alpha = clampUnit(value[3] ?? 1)

  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

/** Build a stable dependency key from uniform names without tracking values. */
function createUniformKeySignature(uniforms: Record<string, ShaderUniformValue>) {
  return Object.keys(uniforms).sort().join(uniformKeyDelimiter)
}

/** Compile a WebGL shader and report source-level failures without throwing. */
function createShader(
  gl: WebGL2RenderingContext,
  type: number,
  source: string
): WebGLShader | null {
  const shader = gl.createShader(type)
  if (!shader) return null

  gl.shaderSource(shader, source)
  gl.compileShader(shader)

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(
      "Shader compile error:",
      gl.getShaderInfoLog(shader)
    )
    gl.deleteShader(shader)
    return null
  }

  return shader
}

/** Link the loader vertex and fragment shaders into a disposable WebGL program. */
function createProgram(
  gl: WebGL2RenderingContext,
  vertexSource: string,
  fragmentSource: string
): WebGLProgram | null {
  const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexSource)
  const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentSource)

  if (!vertexShader || !fragmentShader) return null

  const program = gl.createProgram()
  if (!program) return null

  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error("Program link error:", gl.getProgramInfoLog(program))
    gl.deleteProgram(program)
    return null
  }

  // Clean up shaders after linking
  gl.detachShader(program, vertexShader)
  gl.detachShader(program, fragmentShader)
  gl.deleteShader(vertexShader)
  gl.deleteShader(fragmentShader)

  return program
}

/** Track the user's reduced-motion preference so animation work can pause. */
function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = React.useState(false)

  React.useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)")

    setPrefersReducedMotion(media.matches)

    const handleChange = () => {
      setPrefersReducedMotion(media.matches)
    }

    if (typeof media.addEventListener === "function") {
      media.addEventListener("change", handleChange)
      return () => media.removeEventListener("change", handleChange)
    }

    media.addListener(handleChange)
    return () => media.removeListener(handleChange)
  }, [])

  return prefersReducedMotion
}

/**
 * Mount a compact shader canvas and fall back to a static CSS mark when WebGL2
 * is unavailable, while keeping the loader's accessible wrapper in Loader.
 */
export function ShaderMount({
  fragmentShader,
  uniforms,
  speed = 1,
  width,
  height,
  className,
  style,
}: ShaderMountProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const glRef = React.useRef<WebGL2RenderingContext | null>(null)
  const programRef = React.useRef<WebGLProgram | null>(null)
  const uniformLocationsRef = React.useRef<
    Record<string, WebGLUniformLocation | null>
  >({})
  const rafRef = React.useRef<number | null>(null)
  const currentSpeedRef = React.useRef<number>(speed)
  const uniformsRef = React.useRef(uniforms)
  const [useFallback, setUseFallback] = React.useState(false)
  const prefersReducedMotion = usePrefersReducedMotion()
  const uniformKeySignature = React.useMemo(
    () => createUniformKeySignature(uniforms),
    [uniforms]
  )
  const fallbackColor = React.useMemo(
    () => uniformColorToCss(uniforms.u_colorFront),
    [uniforms]
  )
  const fallbackBackColor = React.useMemo(
    () => uniformColorToCss(uniforms.u_colorBack),
    [uniforms]
  )

  React.useEffect(() => {
    uniformsRef.current = uniforms
  }, [uniforms])

  // Update speed ref when prop changes
  React.useEffect(() => {
    currentSpeedRef.current = prefersReducedMotion ? 0 : speed
  }, [prefersReducedMotion, speed])

  // Initialize WebGL
  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const gl = canvas.getContext("webgl2", {
      alpha: true,
      premultipliedAlpha: true,
      antialias: true,
    })

    if (!gl) {
      console.error("WebGL2 not supported")
      setUseFallback(true)
      return
    }

    glRef.current = gl
    setUseFallback(false)

    const handleContextLost = (event: Event) => {
      event.preventDefault()
      setUseFallback(true)
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
    canvas.addEventListener("webglcontextlost", handleContextLost)

    // Create program
    const program = createProgram(gl, vertexShaderSource, fragmentShader)
    if (!program) {
      setUseFallback(true)
      canvas.removeEventListener("webglcontextlost", handleContextLost)
      return
    }

    programRef.current = program

    // Setup position attribute
    const positionBuffer = gl.createBuffer()
    if (!positionBuffer) {
      setUseFallback(true)
      canvas.removeEventListener("webglcontextlost", handleContextLost)
      gl.deleteProgram(program)
      return
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer)
    const positions = [-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.STATIC_DRAW)

    const positionLocation = gl.getAttribLocation(program, "a_position")
    gl.enableVertexAttribArray(positionLocation)
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0)

    // Get uniform locations
    const locations: Record<string, WebGLUniformLocation | null> = {
      u_time: gl.getUniformLocation(program, "u_time"),
      u_resolution: gl.getUniformLocation(program, "u_resolution"),
      u_pixelRatio: gl.getUniformLocation(program, "u_pixelRatio"),
    }

    const uniformKeys = uniformKeySignature
      ? uniformKeySignature.split(uniformKeyDelimiter)
      : []

    uniformKeys.forEach((key) => {
      locations[key] = gl.getUniformLocation(program, key)
    })

    uniformLocationsRef.current = locations

    // Enable blending for transparency
    gl.enable(gl.BLEND)
    gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
      canvas.removeEventListener("webglcontextlost", handleContextLost)
      gl.deleteBuffer(positionBuffer)
      gl.deleteProgram(program)
      if (glRef.current === gl) glRef.current = null
      if (programRef.current === program) programRef.current = null
    }
  }, [fragmentShader, uniformKeySignature])

  // Render loop
  React.useEffect(() => {
    const gl = glRef.current
    const program = programRef.current
    const locations = uniformLocationsRef.current

    if (!gl || !program || useFallback) return

    const pixelRatio = Math.min(window.devicePixelRatio, 2)
    const canvasWidth = width * pixelRatio
    const canvasHeight = height * pixelRatio

    const canvas = canvasRef.current
    if (canvas) {
      canvas.width = canvasWidth
      canvas.height = canvasHeight
    }

    gl.viewport(0, 0, canvasWidth, canvasHeight)

    let lastTime = performance.now()
    let accumulatedTime = 0

    const render = (currentTime: number) => {
      const currentSpeed = currentSpeedRef.current
      if (currentSpeed > 0) {
        const deltaTime = currentTime - lastTime
        lastTime = currentTime
        accumulatedTime += deltaTime * currentSpeed * 0.001
      }

      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.useProgram(program)

      // Set built-in uniforms
      if (locations.u_time) {
        gl.uniform1f(locations.u_time, accumulatedTime)
      }
      if (locations.u_resolution) {
        gl.uniform2f(locations.u_resolution, canvasWidth, canvasHeight)
      }
      if (locations.u_pixelRatio) {
        gl.uniform1f(locations.u_pixelRatio, pixelRatio)
      }

      // Set custom uniforms
      Object.entries(uniformsRef.current).forEach(([key, value]) => {
        const location = locations[key]
        if (!location) return

        if (Array.isArray(value)) {
          switch (value.length) {
            case 2:
              gl.uniform2fv(location, value)
              break
            case 3:
              gl.uniform3fv(location, value)
              break
            case 4:
              gl.uniform4fv(location, value)
              break
          }
        } else {
          gl.uniform1f(location, value)
        }
      })

      gl.drawArrays(gl.TRIANGLES, 0, 6)

      rafRef.current =
        currentSpeed > 0 ? requestAnimationFrame(render) : null
    }

    rafRef.current = requestAnimationFrame(render)

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [fragmentShader, uniformKeySignature, width, height, speed, prefersReducedMotion, useFallback])

  return (
    <span
      aria-hidden="true"
      className={className}
      style={{
        position: "relative",
        display: "block",
        width,
        height,
        ...style,
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: useFallback ? "none" : "block",
          width: "100%",
          height: "100%",
        }}
      />
      {useFallback ? (
        <span
          style={{
            position: "absolute",
            inset: 0,
            borderRadius: "9999px",
            backgroundColor: fallbackBackColor,
            backgroundImage: `radial-gradient(circle at center, ${fallbackColor} 1.5px, transparent 2px)`,
            backgroundSize: "6px 6px",
            opacity: 0.95,
          }}
        />
      ) : null}
    </span>
  )
}
