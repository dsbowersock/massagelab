"use client"

import type { AdaptiveCarouselDetailLevel } from "@/components/carousels/adaptive-carousel-stage"
import type { BackgroundDefinition } from "@/components/backgrounds/backgroundRegistry"
import { BackgroundPreviewMedia } from "@/components/backgrounds/BackgroundPreviewMedia"
import { backgroundPreviewPublishedManifest } from "@/components/backgrounds/backgroundPreviewPublishedManifest"
import { getBackgroundPreviewAssets } from "@/lib/background-catalog"
import {
  getVerticalPublishedPreviewPosterUrl,
  publishedPreviewCatalogBaseUrl,
} from "@/lib/background-preview-runtime.js"
import { cn } from "@/lib/utils"

interface BackgroundCarouselCardProps {
  option: BackgroundDefinition
  detailLevel: AdaptiveCarouselDetailLevel
  selected: boolean
  active: boolean
  playPreviews: boolean
  reducedMotion: boolean
}

/** Renders only the approved preview rendition; centered metadata belongs in the external tray. */
export function BackgroundCarouselCard({
  option,
  detailLevel,
  selected,
  active,
  playPreviews,
  reducedMotion,
}: BackgroundCarouselCardProps) {
  const { videoUrl: previewVideoUrl, posterUrl: previewPosterUrl } = getBackgroundPreviewAssets(option, "vertical")
  const publishedEntry = backgroundPreviewPublishedManifest.entries[option.id]
  const publishedPosterUrl = getVerticalPublishedPreviewPosterUrl(
    publishedEntry,
    publishedPreviewCatalogBaseUrl,
  )

  return (
    <article
      className={cn(
        "relative grid aspect-[5/7] h-full overflow-hidden rounded-2xl border bg-black text-white shadow-2xl",
        selected
          ? "border-primary/80 shadow-primary/20"
          : "border-white/20",
      )}
      data-background-id={option.id}
      data-background-selected={selected}
    >
      <div
        className="absolute inset-0 overflow-hidden rounded-[inherit]"
        data-carousel-artwork
      >
        {/* Prefer the approved catalog poster; the v1 poster remains the rollback fallback. */}
        <BackgroundPreviewMedia
          videoUrl={previewVideoUrl}
          posterUrl={publishedPosterUrl ?? previewPosterUrl}
          fallbackStyle={option.fallbackStyle}
          active={active && playPreviews && detailLevel !== "shell"}
          reducedMotion={reducedMotion}
          strictCatalog
          publishedEntry={publishedEntry}
          publishedCatalogBaseUrl={publishedPreviewCatalogBaseUrl}
        />
      </div>
    </article>
  )
}
