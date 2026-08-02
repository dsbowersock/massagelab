"use client"

import { useState } from "react"

import { BackgroundPreviewMedia } from "@/components/backgrounds/BackgroundPreviewMedia"
import { backgroundPreviewManifest } from "@/components/backgrounds/backgroundPreviewManifest"
import { Button } from "@/components/ui/button"

/** Development-only browser fixture for preview playback and fallback behavior. */
export function BackgroundPreviewMediaReview() {
  const [active, setActive] = useState(false)
  const [mounted, setMounted] = useState(true)
  const [alternateSource, setAlternateSource] = useState(false)
  const [missingVideo, setMissingVideo] = useState(false)
  const previewName = alternateSource ? "massage-lab-twisted-cubes" : "massage-lab-dna"
  const preview = backgroundPreviewManifest[previewName]
  const verticalPreview = preview?.variants?.vertical
  const videoUrl = missingVideo
    ? "/chimer/background-previews/__missing-preview__.webm"
    : verticalPreview?.previewMediaUrl
      ?? preview?.previewVerticalVideoUrl
      ?? preview?.previewMediaUrl
      ?? `/chimer/background-previews/${previewName}-vertical.webm`
  const posterUrl = verticalPreview?.previewPosterUrl
    ?? preview?.previewVerticalImageUrl
    ?? preview?.previewImageUrl
    ?? `/chimer/background-previews/${previewName}-vertical.webp`

  return (
    <section
      aria-labelledby="background-preview-media-review-heading"
      className="space-y-4"
      data-testid="background-preview-media-review"
    >
      <div>
        <h3 id="background-preview-media-review-heading" className="text-xl font-semibold">
          Preview media behavior
        </h3>
        <p className="text-sm text-muted-foreground">
          Exercise the production poster, playback, failure, and cleanup states.
        </p>
      </div>
      <div className="relative aspect-[5/7] w-48 overflow-hidden rounded-xl border border-border">
        {mounted ? (
          <BackgroundPreviewMedia
            videoUrl={videoUrl}
            posterUrl={posterUrl}
            fallbackStyle={{ background: "rgb(18, 52, 86)" }}
            active={active}
            reducedMotion={false}
          />
        ) : null}
      </div>
      <div className="flex flex-wrap gap-2">
        <Button size="compact" onClick={() => setActive((current) => !current)}>
          {active ? "Deactivate preview" : "Activate preview"}
        </Button>
        <Button size="compact" variant="secondary" onClick={() => setMounted((current) => !current)}>
          {mounted ? "Unmount preview" : "Mount preview"}
        </Button>
        <Button size="compact" variant="secondary" onClick={() => setAlternateSource((current) => !current)}>
          Swap preview source
        </Button>
        <Button size="compact" variant="secondary" onClick={() => setMissingVideo((current) => !current)}>
          {missingVideo ? "Use working video" : "Use missing video"}
        </Button>
      </div>
    </section>
  )
}
