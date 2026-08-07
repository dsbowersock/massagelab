"use client"

import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react"
import type {
  BackgroundPreviewPublishedEntry,
  BackgroundPreviewPublishedCodec,
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

/** Distinguishes exact MIME/rendition attempts without retaining a second source. */
function renditionAttemptKey(rendition: BackgroundPreviewPublishedRendition) {
  return `${rendition.aspect}:${rendition.quality}:${rendition.codec}:${rendition.mimeType}`
}

/**
 * Probes only the candidates for one requested tier and records support by
 * exact rendition. H.264's profile/level MIME changes between quality tiers.
 */
function probePreviewRenditionCandidates(
  renditions: readonly BackgroundPreviewPublishedRendition[],
) {
  const codecProbe = document.createElement("video")
  const supportByMimeType = new Map<string, CanPlayTypeResult>()
  const supportedRenditionKeys = new Set<string>()
  for (const rendition of renditions) {
    let support = supportByMimeType.get(rendition.mimeType)
    if (support === undefined) {
      support = ""
      try {
        support = codecProbe.canPlayType(rendition.mimeType)
      } catch {
        // A throwing probe is equivalent to no declared support for this MIME.
      }
      supportByMimeType.set(rendition.mimeType, support)
    }
    if (support === "probably" || support === "maybe") {
      supportedRenditionKeys.add(renditionAttemptKey(rendition))
    }
  }
  return { supportByMimeType, supportedRenditionKeys }
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
  const attemptedRenditionsRef = useRef<Set<string>>(new Set())
  const supportedRenditionsRef = useRef<Set<string>>(new Set())
  const activeSourceUrlRef = useRef<string | null>(null)
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
    attemptedRenditionsRef.current = new Set()
    supportedRenditionsRef.current = new Set()
    activeSourceUrlRef.current = null
    setCurrentRendition(null)
    setLegacyVideoSelected(false)
    if (!strictPlaybackEligible) return

    // Production deliberately falls back to the existing v1 vertical URL only
    // while the published catalog base is unavailable.
    if (!publishedCatalogBaseUrl) {
      activeSourceUrlRef.current = videoUrl ?? null
      setLegacyVideoSelected(Boolean(videoUrl))
      return
    }
    if (publishedEntry?.mediaKind !== "animated") return

    const connection = getPreviewConnection()
    const initialQuality = qualityForPreviewConnection(connection)
    const targetRenditions = publishedEntry.renditions.filter((rendition) =>
      rendition.aspect === "vertical" && rendition.quality === initialQuality)
    const { supportByMimeType, supportedRenditionKeys } =
      probePreviewRenditionCandidates(targetRenditions)
    supportedRenditionsRef.current = supportedRenditionKeys
    const codec = chooseSupportedPreviewCodec({
      renditions: targetRenditions,
      aspect: "vertical",
      quality: initialQuality,
      canPlayType: (mimeType: string) => supportByMimeType.get(mimeType) ?? "",
    })
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
    attemptedRenditionsRef.current.add(renditionAttemptKey(initialRendition))
    activeSourceUrlRef.current = initialRendition.url
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

  const handleStrictPlaybackFailure = useCallback((failedSourceUrl?: string) => {
    if (!strictCatalog) {
      setVideoFailed(true)
      return
    }
    // An error and a rejected play promise can report the same old source.
    // Once a replacement is scheduled, ignore that stale duplicate signal.
    if (failedSourceUrl !== activeSourceUrlRef.current) return

    if (currentRendition && publishedCatalogBaseUrl) {
      const alternateCodec: BackgroundPreviewPublishedCodec =
        currentRendition.codec === "vp9" ? "h264" : "vp9"
      const alternateRendition = selectPublishedPreviewRendition({
        entry: publishedEntry,
        aspect: currentRendition.aspect,
        quality: currentRendition.quality,
        codec: alternateCodec,
        catalogBaseUrl: publishedCatalogBaseUrl,
      }) as BackgroundPreviewPublishedRendition | null
      if (alternateRendition) {
        const alternateAttemptKey = renditionAttemptKey(alternateRendition)
        if (supportedRenditionsRef.current.has(alternateAttemptKey)
          && !attemptedRenditionsRef.current.has(alternateAttemptKey)) {
          attemptedRenditionsRef.current.add(alternateAttemptKey)
          activeSourceUrlRef.current = alternateRendition.url
          setCurrentRendition(alternateRendition)
          return
        }
      }
    }

    setVideoFailed(true)
  }, [currentRendition, publishedCatalogBaseUrl, publishedEntry, strictCatalog])

  const handleStrictEnded = () => {
    if (!strictCatalog || !strictPlaybackEligible) return
    const video = videoRef.current
    if (!video) return

    const pendingQuality = pendingQualityRef.current
    pendingQualityRef.current = null
    if (currentRendition && pendingQuality && publishedEntry?.renditions) {
      const pendingCandidates = publishedEntry.renditions.filter((rendition) =>
        rendition.aspect === currentRendition.aspect && rendition.quality === pendingQuality)
      const { supportedRenditionKeys } = probePreviewRenditionCandidates(pendingCandidates)
      for (const key of supportedRenditionKeys) supportedRenditionsRef.current.add(key)
    }
    const pendingRendition = currentRendition && pendingQuality && publishedCatalogBaseUrl
      ? resolvePendingPreviewRendition({
          entry: publishedEntry,
          currentRendition,
          pendingQuality,
          catalogBaseUrl: publishedCatalogBaseUrl,
        }) as BackgroundPreviewPublishedRendition | null
      : null
    if (pendingRendition
      && supportedRenditionsRef.current.has(renditionAttemptKey(pendingRendition))
      && pendingRendition.url !== currentRendition?.url) {
      attemptedRenditionsRef.current.add(renditionAttemptKey(pendingRendition))
      activeSourceUrlRef.current = pendingRendition.url
      setCurrentRendition(pendingRendition)
      return
    }

    video.currentTime = 0
    void video.play().catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") return
      handleStrictPlaybackFailure(resolvedVideoUrl)
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
        handleStrictPlaybackFailure(resolvedVideoUrl)
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
  }, [handleStrictPlaybackFailure, resolvedVideoUrl, shouldPlayVideo, strictCatalog])

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
          onError={() => handleStrictPlaybackFailure(resolvedVideoUrl)}
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
