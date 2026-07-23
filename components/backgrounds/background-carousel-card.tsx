"use client"

import Image from "next/image"
import { useEffect, useRef, useState } from "react"
import { Lock } from "lucide-react"
import type { AdaptiveCarouselDetailLevel } from "@/components/carousels/adaptive-carousel-stage"
import type { BackgroundDefinition } from "@/components/backgrounds/backgroundRegistry"
import { Loader } from "@/components/chimer-controls/Loader"
import { Button } from "@/components/ui/button"
import { purpleGlowClassName } from "@/components/ui/carousel-button-classes"
import { MetalFavoriteIcon } from "@/components/ui/metal-favorite-icon"
import {
  getBackgroundPreviewMedia,
  getBackgroundVisualTags,
} from "@/lib/background-catalog"
import { cn } from "@/lib/utils"

type BackgroundCardCommerceState = {
  state: string
  canSelect: boolean
  showKeepPermanently: boolean
  isInCart: boolean
  isReserved: boolean
  ownershipStatus: string | null
  ownershipSource: string | null
}

interface BackgroundCarouselCardProps {
  option: BackgroundDefinition
  detailLevel: AdaptiveCarouselDetailLevel
  commerceState: BackgroundCardCommerceState
  selected: boolean
  saved: boolean
  active: boolean
  reducedMotion: boolean
  onSelect: () => void
  onLockedSelect?: () => void
  onKeepPermanently?: () => void
  onToggleSaved: () => void
}

/** Maps the carousel adapter's access and ownership states to user-facing status labels. */
function accessLabel(commerceState: BackgroundCardCommerceState) {
  if (commerceState.ownershipStatus === "refund_pending") return "Refund pending"
  if (commerceState.ownershipStatus === "dispute_suspended") return "Dispute suspended"
  if (commerceState.ownershipStatus === "refund_revoked") return "Refund revoked"
  if (commerceState.ownershipStatus === "dispute_revoked") return "Dispute revoked"
  if (commerceState.ownershipStatus === "retired") return "Retired"
  if (commerceState.state === "owned-credit" || commerceState.state === "owned-purchase") return "Owned"
  if (commerceState.state === "included-subscription") return "Included"
  if (commerceState.state === "unavailable") return "Unavailable"
  return null
}

/** Maps the authoritative ownership source to the compact provenance label. */
function ownershipSourceLabel(source: string | null) {
  if (source === "purchase") return "Purchased"
  if (source === "credit") return "Credit"
  return null
}

/**
 * Renders authoritative acquisition metadata without changing carousel focus,
 * preview playback, favorite, or persisted-selection ownership.
 */
export function BackgroundCarouselCard({
  option,
  detailLevel,
  commerceState,
  selected,
  saved,
  active,
  reducedMotion,
  onSelect,
  onLockedSelect,
  onKeepPermanently,
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
  const statusLabel = accessLabel(commerceState)
  const sourceLabel = ownershipSourceLabel(commerceState.ownershipSource)
  const unavailable = commerceState.state === "unavailable"

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
      data-background-access-state={commerceState.state}
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
          <div className="flex flex-wrap gap-2">
            <Button
              data-carousel-primary-action
              disabled={unavailable}
              aria-label={unavailable
                ? `${option.label} background unavailable`
                : `${selected ? "Selected" : "Select"} ${option.label} background`}
              onClick={() => {
                if (!commerceState.canSelect) {
                  onLockedSelect?.()
                  return
                }
                onSelect()
              }}
              size="sm"
              variant="glow"
            >
              {!commerceState.canSelect && !unavailable ? <Lock aria-hidden="true" /> : null}
              {unavailable ? "Unavailable" : selected ? "Selected" : "Select"}
            </Button>
            {commerceState.showKeepPermanently ? (
              <Button
                type="button"
                size="sm"
                variant="glow"
                onClick={() => onKeepPermanently?.()}
                aria-label={`Keep ${option.label} permanently`}
              >
                Keep permanently
              </Button>
            ) : null}
          </div>
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
        <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold">
          {statusLabel ? (
            <span className={cn(
              "rounded-full border border-white/30 bg-black/55 px-2 py-1",
              unavailable && "text-white/75",
            )}>
              {statusLabel}
              {statusLabel === "Owned" && sourceLabel ? (
                <span className="sr-only"> - {sourceLabel}</span>
              ) : null}
            </span>
          ) : null}
          {commerceState.isReserved ? (
            <span className="rounded-full border border-amber-200/50 bg-amber-950/70 px-2 py-1">
              Reserved
            </span>
          ) : commerceState.isInCart ? (
            <span className="rounded-full border border-white/30 bg-black/55 px-2 py-1">
              In cart
            </span>
          ) : null}
        </div>
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
