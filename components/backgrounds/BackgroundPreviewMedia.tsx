"use client"

import { type CSSProperties, useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

interface BackgroundPreviewMediaProps {
  videoUrl?: string
  posterUrl?: string
  fallbackStyle?: CSSProperties
  active: boolean
  reducedMotion: boolean
  className?: string
}

const BACKGROUND_PREVIEW_FALLBACK_COLOR = "#0f172a"

/**
 * Keeps a registry-owned fallback behind optional preview assets, starts video
 * playback only for the explicitly active card, and preserves a paused frame
 * for legacy entries that do not yet have an authored poster.
 */
export function BackgroundPreviewMedia({
  videoUrl,
  posterUrl,
  fallbackStyle,
  active,
  reducedMotion,
  className,
}: BackgroundPreviewMediaProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [videoFailed, setVideoFailed] = useState(false)
  const [posterFailed, setPosterFailed] = useState(false)
  const shouldPlayVideo = active && !reducedMotion && Boolean(videoUrl) && !videoFailed
  const showPoster = Boolean(posterUrl) && !posterFailed && !shouldPlayVideo
  const showVideo = Boolean(videoUrl) && !videoFailed && (!showPoster || shouldPlayVideo)

  useEffect(() => {
    setVideoFailed(false)
    setPosterFailed(false)
  }, [posterUrl, videoUrl])

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
    document.addEventListener("visibilitychange", syncPlayback)
    return () => {
      disposed = true
      document.removeEventListener("visibilitychange", syncPlayback)
      video.pause()
    }
    // A nonempty source can change while playback stays active, so resync after the browser reloads it.
  }, [shouldPlayVideo, videoUrl])

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
          src={videoUrl}
          poster={posterUrl}
          muted
          loop
          playsInline
          preload="metadata"
          className="absolute inset-0 size-full object-cover"
          aria-hidden="true"
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
