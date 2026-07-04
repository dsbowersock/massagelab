"use client"

import { useEffect, useMemo, useRef, type CSSProperties } from "react"
import { shouldAnimateAmbientBackground } from "@/lib/motion-preferences"
import { cn } from "@/lib/utils"
import type { Aceternity3DGlobeOptions, BackgroundEffectProps } from "./css-backgrounds"
import styles from "@/components/backgrounds/BackgroundHost.module.css"

const DEFAULT_EARTH_TEXTURE = "https://unpkg.com/three-globe@2.31.0/example/img/earth-blue-marble.jpg"
const DEFAULT_BUMP_TEXTURE = "https://unpkg.com/three-globe@2.31.0/example/img/earth-topology.png"

type RgbColor = [number, number, number]

interface ResolvedGlobeOptions {
  backgroundColor: string
  globeColor: string
  autoRotateSpeed: number
  globeScale: number
  bumpScale: number
  ambientIntensity: number
  pointLightIntensity: number
  showAtmosphere: boolean
  atmosphereColor: string
  atmosphereIntensity: number
  atmosphereBlur: number
  showWireframe: boolean
  wireframeColor: string
  markerEnabled: boolean
  markerLat: number
  markerLng: number
  markerLabel: string
  markerAvatarUrl: string
  markerSize: number
}

const DEFAULT_GLOBE_OPTIONS: ResolvedGlobeOptions = {
  backgroundColor: "#020617",
  globeColor: "#1A1A2E",
  autoRotateSpeed: 0.3,
  globeScale: 0.48,
  bumpScale: 1,
  ambientIntensity: 0.6,
  pointLightIntensity: 1.5,
  showAtmosphere: false,
  atmosphereColor: "#4DA6FF",
  atmosphereIntensity: 0.5,
  atmosphereBlur: 2,
  showWireframe: false,
  wireframeColor: "#4A9EFF",
  markerEnabled: false,
  markerLat: 39.8283,
  markerLng: -98.5795,
  markerLabel: "Your location",
  markerAvatarUrl: "",
  markerSize: 0.06,
}

function resolveGlobeOptions(options: Aceternity3DGlobeOptions | undefined): ResolvedGlobeOptions {
  return {
    backgroundColor: normalizeHexColor(options?.backgroundColor, DEFAULT_GLOBE_OPTIONS.backgroundColor),
    globeColor: normalizeHexColor(options?.globeColor, DEFAULT_GLOBE_OPTIONS.globeColor),
    autoRotateSpeed: clampNumber(options?.autoRotateSpeed, DEFAULT_GLOBE_OPTIONS.autoRotateSpeed, 0, 3),
    globeScale: clampNumber(options?.globeScale, DEFAULT_GLOBE_OPTIONS.globeScale, 0.34, 0.84),
    bumpScale: clampNumber(options?.bumpScale, DEFAULT_GLOBE_OPTIONS.bumpScale, 0, 3),
    ambientIntensity: clampNumber(options?.ambientIntensity, DEFAULT_GLOBE_OPTIONS.ambientIntensity, 0, 2),
    pointLightIntensity: clampNumber(options?.pointLightIntensity, DEFAULT_GLOBE_OPTIONS.pointLightIntensity, 0, 4),
    showAtmosphere:
      typeof options?.showAtmosphere === "boolean"
        ? options.showAtmosphere
        : DEFAULT_GLOBE_OPTIONS.showAtmosphere,
    atmosphereColor: normalizeHexColor(options?.atmosphereColor, DEFAULT_GLOBE_OPTIONS.atmosphereColor),
    atmosphereIntensity: clampNumber(
      options?.atmosphereIntensity,
      DEFAULT_GLOBE_OPTIONS.atmosphereIntensity,
      0,
      2,
    ),
    atmosphereBlur: clampNumber(options?.atmosphereBlur, DEFAULT_GLOBE_OPTIONS.atmosphereBlur, 0.5, 5),
    showWireframe:
      typeof options?.showWireframe === "boolean"
        ? options.showWireframe
        : DEFAULT_GLOBE_OPTIONS.showWireframe,
    wireframeColor: normalizeHexColor(options?.wireframeColor, DEFAULT_GLOBE_OPTIONS.wireframeColor),
    markerEnabled:
      typeof options?.markerEnabled === "boolean"
        ? options.markerEnabled
        : DEFAULT_GLOBE_OPTIONS.markerEnabled,
    markerLat: clampNumber(options?.markerLat, DEFAULT_GLOBE_OPTIONS.markerLat, -90, 90),
    markerLng: clampNumber(options?.markerLng, DEFAULT_GLOBE_OPTIONS.markerLng, -180, 180),
    markerLabel: normalizeShortText(options?.markerLabel, DEFAULT_GLOBE_OPTIONS.markerLabel, 80),
    markerAvatarUrl: normalizeHttpUrl(options?.markerAvatarUrl, DEFAULT_GLOBE_OPTIONS.markerAvatarUrl),
    markerSize: clampNumber(options?.markerSize, DEFAULT_GLOBE_OPTIONS.markerSize, 0.03, 0.16),
  }
}

export default function Aceternity3DGlobeBackground({
  className,
  aceternity3DGlobe,
}: BackgroundEffectProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const optionAmbientIntensity = aceternity3DGlobe?.ambientIntensity
  const optionAtmosphereBlur = aceternity3DGlobe?.atmosphereBlur
  const optionAtmosphereColor = aceternity3DGlobe?.atmosphereColor
  const optionAtmosphereIntensity = aceternity3DGlobe?.atmosphereIntensity
  const optionAutoRotateSpeed = aceternity3DGlobe?.autoRotateSpeed
  const optionBackgroundColor = aceternity3DGlobe?.backgroundColor
  const optionBumpScale = aceternity3DGlobe?.bumpScale
  const optionGlobeColor = aceternity3DGlobe?.globeColor
  const optionGlobeScale = aceternity3DGlobe?.globeScale
  const optionMarkerAvatarUrl = aceternity3DGlobe?.markerAvatarUrl
  const optionMarkerEnabled = aceternity3DGlobe?.markerEnabled
  const optionMarkerLabel = aceternity3DGlobe?.markerLabel
  const optionMarkerLat = aceternity3DGlobe?.markerLat
  const optionMarkerLng = aceternity3DGlobe?.markerLng
  const optionMarkerSize = aceternity3DGlobe?.markerSize
  const optionPointLightIntensity = aceternity3DGlobe?.pointLightIntensity
  const optionShowAtmosphere = aceternity3DGlobe?.showAtmosphere
  const optionShowWireframe = aceternity3DGlobe?.showWireframe
  const optionWireframeColor = aceternity3DGlobe?.wireframeColor
  const resolved = useMemo(() => resolveGlobeOptions({
    ambientIntensity: optionAmbientIntensity,
    atmosphereBlur: optionAtmosphereBlur,
    atmosphereColor: optionAtmosphereColor,
    atmosphereIntensity: optionAtmosphereIntensity,
    autoRotateSpeed: optionAutoRotateSpeed,
    backgroundColor: optionBackgroundColor,
    bumpScale: optionBumpScale,
    globeColor: optionGlobeColor,
    globeScale: optionGlobeScale,
    markerAvatarUrl: optionMarkerAvatarUrl,
    markerEnabled: optionMarkerEnabled,
    markerLabel: optionMarkerLabel,
    markerLat: optionMarkerLat,
    markerLng: optionMarkerLng,
    markerSize: optionMarkerSize,
    pointLightIntensity: optionPointLightIntensity,
    showAtmosphere: optionShowAtmosphere,
    showWireframe: optionShowWireframe,
    wireframeColor: optionWireframeColor,
  }), [
    optionAmbientIntensity,
    optionAtmosphereBlur,
    optionAtmosphereColor,
    optionAtmosphereIntensity,
    optionAutoRotateSpeed,
    optionBackgroundColor,
    optionBumpScale,
    optionGlobeColor,
    optionGlobeScale,
    optionMarkerAvatarUrl,
    optionMarkerEnabled,
    optionMarkerLabel,
    optionMarkerLat,
    optionMarkerLng,
    optionMarkerSize,
    optionPointLightIntensity,
    optionShowAtmosphere,
    optionShowWireframe,
    optionWireframeColor,
  ])
  const style = {
    "--ml-aceternity-globe-background": resolved.backgroundColor,
  } as CSSProperties

  useEffect(() => {
    const canvas = canvasRef.current
    const container = containerRef.current
    const context = canvas?.getContext("2d")

    if (!canvas || !container || !context) {
      return undefined
    }

    let animationFrame = 0
    let resizeRetryFrame = 0
    let shouldRun = false
    let pixelRatio = 1
    let canvasWidth = 0
    let canvasHeight = 0
    let lastPaint = 0
    let rotationDegrees = 0
    let textureReady = false
    let bumpReady = false
    let markerAvatarReady = false
    let paintFrame: (timestamp: number, animate: boolean) => void = () => undefined

    const earthTexture = new Image()
    earthTexture.crossOrigin = "anonymous"
    earthTexture.decoding = "async"
    earthTexture.onload = () => {
      textureReady = true
      paintFrame(performance.now(), shouldRun)
    }
    earthTexture.src = DEFAULT_EARTH_TEXTURE

    const bumpTexture = new Image()
    bumpTexture.crossOrigin = "anonymous"
    bumpTexture.decoding = "async"
    bumpTexture.onload = () => {
      bumpReady = true
      paintFrame(performance.now(), shouldRun)
    }
    bumpTexture.src = DEFAULT_BUMP_TEXTURE

    const markerAvatar = resolved.markerAvatarUrl ? new Image() : null
    if (markerAvatar) {
      markerAvatar.crossOrigin = "anonymous"
      markerAvatar.decoding = "async"
      markerAvatar.onload = () => {
        markerAvatarReady = true
        paintFrame(performance.now(), shouldRun)
      }
      markerAvatar.src = resolved.markerAvatarUrl
    }

    const backgroundRgb = parseHexColorToRgb(resolved.backgroundColor)
    const globeRgb = parseHexColorToRgb(resolved.globeColor)
    const atmosphereRgb = parseHexColorToRgb(resolved.atmosphereColor)
    const wireframeRgb = parseHexColorToRgb(resolved.wireframeColor)

    paintFrame = (timestamp: number, animate: boolean) => {
      if (!canvasWidth || !canvasHeight) {
        return
      }

      if (animate) {
        const deltaSeconds = lastPaint ? Math.min(0.08, (timestamp - lastPaint) / 1000) : 0
        rotationDegrees = (rotationDegrees + deltaSeconds * resolved.autoRotateSpeed * 18) % 360
      }
      lastPaint = timestamp

      const width = canvasWidth
      const height = canvasHeight
      const radius = Math.min(width, height) * resolved.globeScale
      const centerX = width / 2
      const centerY = height / 2

      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0)
      context.clearRect(0, 0, width, height)
      fillBackground(context, width, height, backgroundRgb, atmosphereRgb, resolved.atmosphereIntensity)

      if (resolved.showAtmosphere) {
        drawAtmosphere(context, centerX, centerY, radius, atmosphereRgb, resolved)
      }

      drawGlobeBody(context, {
        centerX,
        centerY,
        radius,
        rotationDegrees,
        textureReady,
        bumpReady,
        earthTexture,
        bumpTexture,
        globeRgb,
        atmosphereRgb,
        ambientIntensity: resolved.ambientIntensity,
        pointLightIntensity: resolved.pointLightIntensity,
        bumpScale: resolved.bumpScale,
      })

      if (resolved.showWireframe) {
        drawWireframe(context, centerX, centerY, radius, wireframeRgb)
      }

      if (resolved.markerEnabled) {
        drawMarker(context, {
          centerX,
          centerY,
          radius,
          rotationDegrees,
          markerLat: resolved.markerLat,
          markerLng: resolved.markerLng,
          markerSize: resolved.markerSize,
          markerLabel: resolved.markerLabel,
          markerAvatar,
          markerAvatarReady,
          atmosphereRgb,
        })
      }
    }

    const resizeCanvas = () => {
      const bounds = container.getBoundingClientRect()
      const width = Math.floor(bounds.width)
      const height = Math.floor(bounds.height)

      if (width <= 0 || height <= 0) {
        return false
      }

      pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5)
      canvasWidth = width
      canvasHeight = height
      canvas.width = Math.ceil(width * pixelRatio)
      canvas.height = Math.ceil(height * pixelRatio)
      paintFrame(performance.now(), shouldRun)
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

      if (timestamp - lastPaint >= 1000 / 30) {
        paintFrame(timestamp, true)
      }

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
      paintFrame(performance.now(), false)
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

    const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")
    const compactViewportQuery = window.matchMedia("(max-width: 720px)")

    const updateAnimationState = () => {
      const shouldAnimate = shouldAnimateAmbientBackground({
        prefersReducedMotion: reducedMotionQuery.matches,
        compactViewport: compactViewportQuery.matches,
        allowCompactViewport: true,
        documentHidden: document.hidden,
      })

      if (shouldAnimate && resolved.autoRotateSpeed > 0) {
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
    reducedMotionQuery.addEventListener("change", updateAnimationState)
    compactViewportQuery.addEventListener("change", updateAnimationState)
    document.addEventListener("visibilitychange", updateAnimationState)
    updateAnimationState()

    return () => {
      stopAnimation()
      resizeObserver.disconnect()
      window.removeEventListener("resize", handleResize)
      reducedMotionQuery.removeEventListener("change", updateAnimationState)
      compactViewportQuery.removeEventListener("change", updateAnimationState)
      document.removeEventListener("visibilitychange", updateAnimationState)
      earthTexture.onload = null
      bumpTexture.onload = null
      if (markerAvatar) {
        markerAvatar.onload = null
      }
    }
  }, [resolved])

  return (
    <div
      ref={containerRef}
      className={cn(styles.effectLayer, styles.aceternity3dGlobe, className)}
      style={style}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className={styles.aceternity3dGlobeCanvas} />
    </div>
  )
}

function fillBackground(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  backgroundRgb: RgbColor,
  atmosphereRgb: RgbColor,
  atmosphereIntensity: number,
) {
  context.fillStyle = `rgb(${backgroundRgb.join(", ")})`
  context.fillRect(0, 0, width, height)

  const glow = context.createRadialGradient(width * 0.5, height * 0.45, 0, width * 0.5, height * 0.48, Math.max(width, height) * 0.72)
  glow.addColorStop(0, rgba(atmosphereRgb, 0.12 * Math.max(0.25, atmosphereIntensity)))
  glow.addColorStop(0.46, rgba(atmosphereRgb, 0.05 * Math.max(0.25, atmosphereIntensity)))
  glow.addColorStop(1, "rgba(0, 0, 0, 0)")
  context.fillStyle = glow
  context.fillRect(0, 0, width, height)
}

function drawAtmosphere(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  atmosphereRgb: RgbColor,
  options: ResolvedGlobeOptions,
) {
  context.save()
  context.shadowColor = rgba(atmosphereRgb, 0.45 * options.atmosphereIntensity)
  context.shadowBlur = options.atmosphereBlur * 18
  context.strokeStyle = rgba(atmosphereRgb, 0.28 * options.atmosphereIntensity)
  context.lineWidth = Math.max(8, radius * 0.045)
  context.beginPath()
  context.arc(centerX, centerY, radius * 1.012, 0, Math.PI * 2)
  context.stroke()
  context.restore()
}

function drawGlobeBody(
  context: CanvasRenderingContext2D,
  details: {
    centerX: number
    centerY: number
    radius: number
    rotationDegrees: number
    textureReady: boolean
    bumpReady: boolean
    earthTexture: HTMLImageElement
    bumpTexture: HTMLImageElement
    globeRgb: RgbColor
    atmosphereRgb: RgbColor
    ambientIntensity: number
    pointLightIntensity: number
    bumpScale: number
  },
) {
  const {
    centerX,
    centerY,
    radius,
    rotationDegrees,
    textureReady,
    bumpReady,
    earthTexture,
    bumpTexture,
    globeRgb,
    atmosphereRgb,
    ambientIntensity,
    pointLightIntensity,
    bumpScale,
  } = details

  context.save()
  context.beginPath()
  context.arc(centerX, centerY, radius, 0, Math.PI * 2)
  context.clip()

  if (textureReady) {
    drawWrappedTexture(context, earthTexture, centerX, centerY, radius, rotationDegrees)
  } else {
    drawProceduralFallback(context, centerX, centerY, radius, globeRgb, atmosphereRgb)
  }

  context.globalCompositeOperation = "multiply"
  context.fillStyle = rgba(globeRgb, 0.28)
  context.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2)
  context.globalCompositeOperation = "source-over"

  if (bumpReady && bumpScale > 0) {
    context.globalAlpha = Math.min(0.24, 0.08 + bumpScale * 0.055)
    context.globalCompositeOperation = "overlay"
    drawWrappedTexture(context, bumpTexture, centerX, centerY, radius, rotationDegrees * 0.92)
    context.globalCompositeOperation = "source-over"
    context.globalAlpha = 1
  }

  const lightGradient = context.createRadialGradient(
    centerX - radius * 0.38,
    centerY - radius * 0.42,
    radius * 0.04,
    centerX + radius * 0.16,
    centerY + radius * 0.16,
    radius * 1.32,
  )
  lightGradient.addColorStop(0, rgba([255, 255, 255], Math.min(0.34, pointLightIntensity * 0.16)))
  lightGradient.addColorStop(0.34, rgba([255, 255, 255], 0.05 * Math.max(0.4, ambientIntensity)))
  lightGradient.addColorStop(0.72, rgba([0, 0, 0], Math.max(0.18, 0.56 - ambientIntensity * 0.16)))
  lightGradient.addColorStop(1, rgba([0, 0, 0], 0.76))
  context.fillStyle = lightGradient
  context.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2)

  const rimGradient = context.createRadialGradient(centerX, centerY, radius * 0.74, centerX, centerY, radius * 1.03)
  rimGradient.addColorStop(0, "rgba(0, 0, 0, 0)")
  rimGradient.addColorStop(0.78, "rgba(0, 0, 0, 0)")
  rimGradient.addColorStop(1, rgba([0, 0, 0], 0.52))
  context.fillStyle = rimGradient
  context.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2)
  context.restore()
}

function drawWrappedTexture(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  centerX: number,
  centerY: number,
  radius: number,
  rotationDegrees: number,
) {
  const textureHeight = radius * 2
  const textureWidth = textureHeight * (image.naturalWidth / Math.max(1, image.naturalHeight))
  const offset = ((rotationDegrees % 360) / 360) * textureWidth
  let startX = centerX - radius - offset

  while (startX > centerX - radius) {
    startX -= textureWidth
  }

  for (let x = startX; x < centerX + radius; x += textureWidth) {
    context.drawImage(image, x, centerY - radius, textureWidth, textureHeight)
  }
}

function drawProceduralFallback(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  globeRgb: RgbColor,
  atmosphereRgb: RgbColor,
) {
  const gradient = context.createRadialGradient(
    centerX - radius * 0.26,
    centerY - radius * 0.34,
    radius * 0.08,
    centerX,
    centerY,
    radius,
  )
  gradient.addColorStop(0, rgba(mixRgb(globeRgb, [255, 255, 255], 0.38), 1))
  gradient.addColorStop(0.48, rgba(mixRgb(globeRgb, atmosphereRgb, 0.36), 1))
  gradient.addColorStop(1, rgba([3, 7, 18], 1))
  context.fillStyle = gradient
  context.fillRect(centerX - radius, centerY - radius, radius * 2, radius * 2)

  context.fillStyle = rgba(mixRgb(globeRgb, atmosphereRgb, 0.54), 0.24)
  for (let index = 0; index < 28; index += 1) {
    const seed = seededFraction(index * 37 + 13)
    const angle = seed * Math.PI * 2
    const distance = radius * (0.12 + seededFraction(index * 41 + 7) * 0.78)
    const width = radius * (0.08 + seededFraction(index * 19 + 3) * 0.2)
    const height = radius * (0.025 + seededFraction(index * 23 + 17) * 0.09)
    context.beginPath()
    context.ellipse(
      centerX + Math.cos(angle) * distance,
      centerY + Math.sin(angle) * distance,
      width,
      height,
      angle + seed,
      0,
      Math.PI * 2,
    )
    context.fill()
  }
}

function drawWireframe(
  context: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  radius: number,
  wireframeRgb: RgbColor,
) {
  context.save()
  context.beginPath()
  context.arc(centerX, centerY, radius, 0, Math.PI * 2)
  context.clip()
  context.strokeStyle = rgba(wireframeRgb, 0.26)
  context.lineWidth = Math.max(0.75, radius * 0.003)

  for (let lat = -60; lat <= 60; lat += 20) {
    const latRad = (lat * Math.PI) / 180
    context.beginPath()
    context.ellipse(centerX, centerY - Math.sin(latRad) * radius, Math.cos(latRad) * radius, radius * 0.1, 0, 0, Math.PI * 2)
    context.stroke()
  }

  for (let lon = 0; lon < 180; lon += 20) {
    const lonRad = (lon * Math.PI) / 180
    context.beginPath()
    context.ellipse(centerX, centerY, Math.abs(Math.cos(lonRad)) * radius, radius, 0, 0, Math.PI * 2)
    context.stroke()
  }

  context.restore()
}

function drawMarker(
  context: CanvasRenderingContext2D,
  details: {
    centerX: number
    centerY: number
    radius: number
    rotationDegrees: number
    markerLat: number
    markerLng: number
    markerSize: number
    markerLabel: string
    markerAvatar: HTMLImageElement | null
    markerAvatarReady: boolean
    atmosphereRgb: RgbColor
  },
) {
  const {
    centerX,
    centerY,
    radius,
    rotationDegrees,
    markerLat,
    markerLng,
    markerSize,
    markerLabel,
    markerAvatar,
    markerAvatarReady,
    atmosphereRgb,
  } = details
  const latRad = (markerLat * Math.PI) / 180
  const lngRad = (((markerLng + rotationDegrees + 540) % 360 - 180) * Math.PI) / 180
  const surfaceX = centerX + radius * Math.cos(latRad) * Math.sin(lngRad)
  const surfaceY = centerY - radius * Math.sin(latRad)
  const surfaceZ = Math.cos(latRad) * Math.cos(lngRad)

  if (surfaceZ < -0.08) {
    return
  }

  const visibility = Math.min(1, Math.max(0, (surfaceZ + 0.08) / 0.35))
  const avatarRadius = Math.max(16, Math.min(58, radius * markerSize * 1.65))
  const avatarX = surfaceX
  const avatarY = surfaceY - avatarRadius * 1.5

  context.save()
  context.globalAlpha = visibility
  context.strokeStyle = rgba(atmosphereRgb, 0.78)
  context.lineWidth = Math.max(1.5, avatarRadius * 0.08)
  context.shadowColor = rgba(atmosphereRgb, 0.42)
  context.shadowBlur = avatarRadius * 0.4
  context.beginPath()
  context.moveTo(surfaceX, surfaceY)
  context.lineTo(avatarX, avatarY + avatarRadius)
  context.stroke()

  context.shadowBlur = avatarRadius * 0.35
  context.fillStyle = rgba([2, 6, 23], 0.72)
  context.strokeStyle = rgba([255, 255, 255], 0.9)
  context.lineWidth = Math.max(2, avatarRadius * 0.11)
  context.beginPath()
  context.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2)
  context.fill()
  context.stroke()

  context.save()
  context.beginPath()
  context.arc(avatarX, avatarY, avatarRadius * 0.82, 0, Math.PI * 2)
  context.clip()
  if (markerAvatar && markerAvatarReady) {
    context.drawImage(markerAvatar, avatarX - avatarRadius * 0.82, avatarY - avatarRadius * 0.82, avatarRadius * 1.64, avatarRadius * 1.64)
  } else {
    const avatarGradient = context.createLinearGradient(
      avatarX - avatarRadius,
      avatarY - avatarRadius,
      avatarX + avatarRadius,
      avatarY + avatarRadius,
    )
    avatarGradient.addColorStop(0, rgba(atmosphereRgb, 1))
    avatarGradient.addColorStop(1, "rgba(255, 122, 26, 1)")
    context.fillStyle = avatarGradient
    context.fillRect(avatarX - avatarRadius, avatarY - avatarRadius, avatarRadius * 2, avatarRadius * 2)
    context.fillStyle = "rgba(255, 255, 255, 0.95)"
    context.font = `700 ${Math.max(14, avatarRadius * 0.86)}px system-ui, sans-serif`
    context.textAlign = "center"
    context.textBaseline = "middle"
    context.fillText(markerLabel.trim().charAt(0).toUpperCase() || "M", avatarX, avatarY + avatarRadius * 0.02)
  }
  context.restore()

  context.shadowBlur = 0
  context.fillStyle = rgba([255, 255, 255], 0.98)
  context.beginPath()
  context.arc(surfaceX, surfaceY, Math.max(3, avatarRadius * 0.16), 0, Math.PI * 2)
  context.fill()

  if (markerLabel) {
    context.font = `700 ${Math.max(11, Math.min(15, avatarRadius * 0.36))}px system-ui, sans-serif`
    const labelWidth = Math.min(180, context.measureText(markerLabel).width + 18)
    const labelHeight = Math.max(22, avatarRadius * 0.48)
    const labelY = avatarY + avatarRadius + labelHeight * 0.74
    context.fillStyle = rgba([2, 6, 23], 0.72)
    roundRect(context, avatarX - labelWidth / 2, labelY - labelHeight / 2, labelWidth, labelHeight, labelHeight / 2)
    context.fill()
    context.fillStyle = "rgba(255, 255, 255, 0.92)"
    context.textAlign = "center"
    context.textBaseline = "middle"
    context.fillText(markerLabel, avatarX, labelY)
  }

  context.restore()
}

function roundRect(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath()
  context.moveTo(x + radius, y)
  context.lineTo(x + width - radius, y)
  context.quadraticCurveTo(x + width, y, x + width, y + radius)
  context.lineTo(x + width, y + height - radius)
  context.quadraticCurveTo(x + width, y + height, x + width - radius, y + height)
  context.lineTo(x + radius, y + height)
  context.quadraticCurveTo(x, y + height, x, y + height - radius)
  context.lineTo(x, y + radius)
  context.quadraticCurveTo(x, y, x + radius, y)
}

function normalizeHexColor(value: string | undefined, fallback: string) {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value.trim()) ? value.trim().toUpperCase() : fallback
}

function normalizeShortText(value: unknown, fallback: string, maxLength: number) {
  if (typeof value !== "string") {
    return fallback
  }

  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, maxLength) : fallback
}

function normalizeHttpUrl(value: unknown, fallback: string) {
  if (typeof value !== "string" || !value.trim()) {
    return fallback
  }

  try {
    const parsed = new URL(value.trim())
    return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.toString() : fallback
  } catch {
    return fallback
  }
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback
}

function parseHexColorToRgb(value: string): RgbColor {
  const hex = normalizeHexColor(value, "#FFFFFF").slice(1)
  return [
    Number.parseInt(hex.slice(0, 2), 16),
    Number.parseInt(hex.slice(2, 4), 16),
    Number.parseInt(hex.slice(4, 6), 16),
  ]
}

function rgba([red, green, blue]: RgbColor, alpha: number) {
  return `rgba(${red}, ${green}, ${blue}, ${Math.min(1, Math.max(0, alpha)).toFixed(3)})`
}

function mixRgb(first: RgbColor, second: RgbColor, amount: number): RgbColor {
  return [
    Math.round(first[0] + (second[0] - first[0]) * amount),
    Math.round(first[1] + (second[1] - first[1]) * amount),
    Math.round(first[2] + (second[2] - first[2]) * amount),
  ]
}

function seededFraction(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453
  return value - Math.floor(value)
}
