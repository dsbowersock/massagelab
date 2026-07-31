"use client"

import { type CSSProperties, useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

interface BackgroundPreviewMediaProps {
  videoUrl?: string
  posterUrl?: string
  fallbackStyle?: CSSProperties
  active: boolean
  className?: string
}

/**
 * Keeps a registry-owned fallback behind optional preview assets and only
 * starts video playback when the owning picker card is explicitly active.
 */
export function BackgroundPreviewMedia({
  videoUrl,
  posterUrl,
  fallbackStyle,
  active,
  className,
}: BackgroundPreviewMediaProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [videoFailed, setVideoFailed] = useState(false)
  const [posterFailed, setPosterFailed] = useState(false)
  const showVideo = active && Boolean(videoUrl) && !videoFailed
  const showPoster = Boolean(posterUrl) && !posterFailed && !showVideo

  useEffect(() => {
    setVideoFailed(false)
    setPosterFailed(false)
  }, [posterUrl, videoUrl])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const syncPlayback = () => {
      if (!showVideo || document.visibilityState !== "visible") {
        video.pause()
        return
      }
      void video.play().catch(() => undefined)
    }
    syncPlayback()
    document.addEventListener("visibilitychange", syncPlayback)
    return () => {
      document.removeEventListener("visibilitychange", syncPlayback)
      video.pause()
    }
    // A nonempty source can change while showVideo stays true, so resync after the browser reloads it.
  }, [showVideo, videoUrl])

  return (
    <div className={cn("relative size-full overflow-hidden", className)} aria-hidden="true">
      <div
        data-testid="background-preview-fallback"
        className="absolute inset-0"
        style={fallbackStyle ?? { background: "#0f172a" }}
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
