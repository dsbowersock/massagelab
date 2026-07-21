"use client"

import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import { Lock } from "lucide-react"
import { Loader } from "@/components/chimer-controls/Loader"
import type { AdaptiveCarouselDetailLevel } from "@/components/carousels/adaptive-carousel-stage"
import type { BackgroundDefinition } from "@/components/backgrounds/backgroundRegistry"
import { Button } from "@/components/ui/button"
import { purpleGlowClassName } from "@/components/ui/carousel-button-classes"
import { MetalFavoriteIcon } from "@/components/ui/metal-favorite-icon"
import {
  getBackgroundPreviewMedia,
  getBackgroundVisualTags,
} from "@/lib/background-catalog"

interface BackgroundCarouselCardProps {
  option: BackgroundDefinition
  detailLevel: AdaptiveCarouselDetailLevel
  canUse: boolean
  selected: boolean
  saved: boolean
  active: boolean
  reducedMotion: boolean
  onSelect: () => void
  onLockedSelect?: () => void
  onToggleSaved: () => void
}

/**
 * Renders the approved production Background card while keeping entitlement
 * decisions and persisted selection in its owning surface.
 */
export function BackgroundCarouselCard({
  option,
  detailLevel,
  canUse,
  selected,
  saved,
  active,
  reducedMotion,
  onSelect,
  onLockedSelect,
  onToggleSaved,
}: BackgroundCarouselCardProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [videoReady, setVideoReady] = useState(false)
  const media = getBackgroundPreviewMedia(option, "landscape")
  const showVideo =
    active
    && detailLevel !== "shell"
    && !reducedMotion
    && media?.type === "video"
  const previewTags = getBackgroundVisualTags(option)
    .filter((tag) => !["shader", "video"].includes(tag.toLowerCase()))
    .slice(0, 4)

  useEffect(() => {
    setVideoReady(false)
  }, [media?.source, showVideo])

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
  }, [showVideo])

  return (
    <article
      className="relative grid aspect-[5/7] h-full overflow-hidden rounded-2xl border border-white/20 bg-black text-white shadow-2xl"
      data-background-id={option.id}
      data-background-selected={selected}
      data-background-access-state={canUse ? "available" : "locked"}
    >
      <div
        className="absolute inset-0 overflow-hidden rounded-[inherit]"
        data-carousel-artwork
      >
        {showVideo ? (
          <video
            ref={videoRef}
            data-testid="carousel-background-video"
            src={media.source}
            muted
            loop
            playsInline
            preload="metadata"
            onCanPlay={() => setVideoReady(true)}
            onLoadedData={() => setVideoReady(true)}
            className="size-full object-cover"
            aria-hidden="true"
          />
        ) : media?.type === "image" || option.previewImageUrl ? (
          <Image
            src={media?.type === "image" ? media.source : option.previewImageUrl ?? ""}
            alt=""
            fill
            sizes="(max-width: 640px) 70vw, 280px"
            className="object-cover"
            unoptimized
            aria-hidden="true"
          />
        ) : (
          <div
            className="size-full"
            style={option.fallbackStyle ?? { background: "#0f172a" }}
            aria-hidden="true"
          />
        )}
        {showVideo && !videoReady ? (
          <div className="absolute inset-0 grid place-items-center bg-black/45">
            <Loader
              size={26}
              label="Loading preview"
              aria-hidden={detailLevel !== "full"}
            />
          </div>
        ) : null}
      </div>

      {detailLevel === "full" ? (
        <div className="absolute inset-x-3 top-3 z-20 flex items-start justify-between gap-2">
          <Button
            data-carousel-primary-action
            aria-disabled={!canUse}
            aria-label={`${selected ? "Selected" : "Select"} ${option.label} background`}
            onClick={() => {
              if (!canUse) {
                onLockedSelect?.()
                return
              }
              onSelect()
            }}
            size="sm"
            variant="glow"
          >
            {!canUse ? <Lock aria-hidden="true" /> : null}
            {selected ? "Selected" : "Select"}
          </Button>
          <Button
            data-carousel-favorite-action
            aria-label={`${saved ? "Unsave" : "Save"} ${option.label}`}
            aria-pressed={saved}
            onClick={onToggleSaved}
            size="icon"
            variant="glow"
            className={purpleGlowClassName}
          >
            <MetalFavoriteIcon kind="star" selected={saved} />
          </Button>
        </div>
      ) : null}

      <div className="relative z-10 mt-auto grid gap-2 self-end bg-gradient-to-t from-black/95 via-black/70 to-transparent p-3 pt-14">
        <div>
          <h3 className="font-semibold">{option.label}</h3>
          {previewTags.length > 0 ? (
            <p className="mt-1 text-xs text-white/70">
              {previewTags.join(" - ")}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  )
}
