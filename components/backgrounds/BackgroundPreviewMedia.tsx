"use client"

import { type CSSProperties, useEffect, useRef, useState } from "react"
import type {
  BackgroundPreviewPublishedEntry,
  BackgroundPreviewPublishedQuality,
  BackgroundPreviewPublishedRendition,
} from "@/components/backgrounds/backgroundPreviewPublishedManifest"
import {
  chooseSupportedPreviewCodec,
  qualityForPreviewConnection,
  resolvePendingPreviewRendition,
  selectPublishedPreviewRendition,
} from "@/lib/background-preview-runtime.js"
import { cn } from "@/lib/utils"

interface PreviewNetworkInformation extends EventTarget {
  effectiveType?: string
  saveData?: boolean
}

interface PreviewNavigator extends Navigator {
  connection?: PreviewNetworkInformation
}

interface BackgroundPreviewMediaProps {
  videoUrl?: string
  posterUrl?: string
  fallbackStyle?: CSSProperties
  active: boolean
  reducedMotion: boolean
  strictCatalog?: boolean
  publishedEntry?: BackgroundPreviewPublishedEntry
  publishedCatalogBaseUrl?: string | null
  className?: string
}

const BACKGROUND_PREVIEW_FALLBACK_COLOR = "#0f172a"

function getPreviewConnection() {
  if (typeof navigator === "undefined") return undefined
  return (navigator as PreviewNavigator).connection
}

/**
 * Keeps legacy development callers unchanged while giving the production
 * carousel an opt-in, poster-first path with one vertical source per card.
 */
export function BackgroundPreviewMedia({
  videoUrl,
  posterUrl,
  fallbackStyle,
  active,
  reducedMotion,
  strictCatalog = false,
  publishedEntry,
  publishedCatalogBaseUrl = null,
  className,
}: BackgroundPreviewMediaProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const pendingQualityRef = useRef<BackgroundPreviewPublishedQuality | null>(null)
  const [videoFailed, setVideoFailed] = useState(false)
  const [posterFailed, setPosterFailed] = useState(false)
  const [documentVisible, setDocumentVisible] = useState(true)
  const [currentRendition, setCurrentRendition] =
    useState<BackgroundPreviewPublishedRendition | null>(null)
  const [legacyVideoSelected, setLegacyVideoSelected] = useState(false)
  const strictPosterOnly = publishedEntry?.mediaKind === "poster-only"
  const strictPlaybackEligible = strictCatalog
    && active
    && !reducedMotion
    && documentVisible
    && !videoFailed
    && !strictPosterOnly

  useEffect(() => {
    setVideoFailed(false)
    setPosterFailed(false)
  }, [posterUrl, videoUrl])

  // A fresh carousel play request may retry a source that failed previously;
  // legacy callers retain their URL-driven reset behavior above.
  useEffect(() => {
    if (strictCatalog) setVideoFailed(false)
  }, [active, strictCatalog])

  useEffect(() => {
    if (!strictCatalog) return
    const syncVisibility = () => {
      const visible = document.visibilityState === "visible"
      setDocumentVisible(visible)
      if (!visible) videoRef.current?.pause()
    }
    syncVisibility()
    document.addEventListener("visibilitychange", syncVisibility)
    return () => document.removeEventListener("visibilitychange", syncVisibility)
  }, [strictCatalog])

  useEffect(() => {
    if (!strictCatalog) return

    pendingQualityRef.current = null
    setCurrentRendition(null)
    setLegacyVideoSelected(false)
    if (!strictPlaybackEligible) return

    // Production deliberately falls back to the existing v1 vertical URL only
    // while the published catalog base is unavailable.
    if (!publishedCatalogBaseUrl) {
      setLegacyVideoSelected(Boolean(videoUrl))
      return
    }
    if (publishedEntry?.mediaKind !== "animated") return

    const connection = getPreviewConnection()
    const initialQuality = qualityForPreviewConnection(connection)
    const codecProbe = document.createElement("video")
    const codec = chooseSupportedPreviewCodec(
      publishedEntry.renditions,
      codecProbe.canPlayType.bind(codecProbe),
    )
    if (!codec) {
      setVideoFailed(true)
      return
    }
    const initialRendition = selectPublishedPreviewRendition({
      entry: publishedEntry,
      aspect: "vertical",
      quality: initialQuality,
      codec,
      catalogBaseUrl: publishedCatalogBaseUrl,
    }) as BackgroundPreviewPublishedRendition | null
    if (!initialRendition) {
      setVideoFailed(true)
      return
    }
    setCurrentRendition(initialRendition)

    if (!connection) return
    const handleConnectionChange = () => {
      pendingQualityRef.current = qualityForPreviewConnection(connection)
    }
    connection.addEventListener("change", handleConnectionChange)
    return () => connection.removeEventListener("change", handleConnectionChange)
  }, [
    publishedCatalogBaseUrl,
    publishedEntry,
    strictCatalog,
    strictPlaybackEligible,
    videoUrl,
  ])

  const strictVideoUrl = publishedCatalogBaseUrl
    ? currentRendition?.url
    : legacyVideoSelected
      ? videoUrl
      : undefined
  const legacyShouldPlayVideo = active && !reducedMotion && Boolean(videoUrl) && !videoFailed
  const legacyShowPoster = Boolean(posterUrl) && !posterFailed && !legacyShouldPlayVideo
  const showVideo = strictCatalog
    ? strictPlaybackEligible && Boolean(strictVideoUrl) && !videoFailed
    : Boolean(videoUrl) && !videoFailed && (!legacyShowPoster || legacyShouldPlayVideo)
  const showPoster = strictCatalog
    ? Boolean(posterUrl) && !posterFailed && !showVideo
    : legacyShowPoster
  const resolvedVideoUrl = strictCatalog ? strictVideoUrl : videoUrl

  const handleStrictEnded = () => {
    if (!strictCatalog || !strictPlaybackEligible) return
    const video = videoRef.current
    if (!video) return

    const pendingQuality = pendingQualityRef.current
    pendingQualityRef.current = null
    const pendingRendition = currentRendition && pendingQuality && publishedCatalogBaseUrl
      ? resolvePendingPreviewRendition({
          entry: publishedEntry,
          currentRendition,
          pendingQuality,
          catalogBaseUrl: publishedCatalogBaseUrl,
        }) as BackgroundPreviewPublishedRendition | null
      : null
    if (pendingRendition && pendingRendition.url !== currentRendition?.url) {
      setCurrentRendition(pendingRendition)
      return
    }

    video.currentTime = 0
    void video.play().catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") return
      setVideoFailed(true)
    })
  }

  const shouldPlayVideo = strictCatalog ? showVideo : legacyShouldPlayVideo

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    let disposed = false
    const syncPlayback = () => {
      if (!shouldPlayVideo || document.visibilityState !== "visible") {
        video.pause()
        return
      }
      void video.play().catch((error: unknown) => {
        if (disposed) return
        // pause(), source replacement, and unmount may abort an in-flight play
        // without indicating that the preview asset itself failed.
        if (error instanceof DOMException && error.name === "AbortError") return
        setVideoFailed(true)
      })
    }
    syncPlayback()
    if (!strictCatalog) document.addEventListener("visibilitychange", syncPlayback)
    return () => {
      disposed = true
      if (!strictCatalog) document.removeEventListener("visibilitychange", syncPlayback)
      video.pause()
    }
    // A nonempty source can change while playback stays active, so resync after the browser reloads it.
  }, [resolvedVideoUrl, shouldPlayVideo, strictCatalog])

  return (
    <div className={cn("relative size-full overflow-hidden", className)} aria-hidden="true">
      <div
        data-testid="background-preview-fallback"
        className="absolute inset-0"
        style={fallbackStyle ?? { background: BACKGROUND_PREVIEW_FALLBACK_COLOR }}
      />
      {showVideo ? (
        <video
          ref={videoRef}
          data-testid="carousel-background-video"
          data-preview-aspect={currentRendition?.aspect}
          data-preview-quality={currentRendition?.quality}
          data-preview-codec={currentRendition?.codec}
          src={resolvedVideoUrl}
          poster={posterUrl}
          muted
          loop={!strictCatalog}
          playsInline
          preload="metadata"
          className="absolute inset-0 size-full object-cover"
          aria-hidden="true"
          onEnded={handleStrictEnded}
          onError={() => setVideoFailed(true)}
        />
      ) : showPoster ? (
        // Native img lets a failed poster reveal the already-mounted registry fallback.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          data-testid="background-preview-poster"
          src={posterUrl}
          alt=""
          className="absolute inset-0 size-full object-cover"
          aria-hidden="true"
          onError={() => setPosterFailed(true)}
        />
      ) : null}
    </div>
  )
}
