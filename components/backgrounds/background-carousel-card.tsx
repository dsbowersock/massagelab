"use client"

import { useId } from "react"
import { Crown, DollarSign, Lock } from "lucide-react"
import type { AdaptiveCarouselDetailLevel } from "@/components/carousels/adaptive-carousel-stage"
import type { BackgroundDefinition } from "@/components/backgrounds/backgroundRegistry"
import { BackgroundPreviewMedia } from "@/components/backgrounds/BackgroundPreviewMedia"
import { backgroundPreviewPublishedManifest } from "@/components/backgrounds/backgroundPreviewPublishedManifest"
import { Button } from "@/components/ui/button"
import { purpleGlowClassName } from "@/components/ui/carousel-button-classes"
import { MetalFavoriteIcon } from "@/components/ui/metal-favorite-icon"
import {
  getBackgroundPreviewAssets,
  getBackgroundVisualTags,
} from "@/lib/background-catalog"
import { hasActivePermanentOwnership } from "@/lib/background-commerce-client.js"
import {
  getVerticalPublishedPreviewPosterUrl,
  publishedPreviewCatalogBaseUrl,
} from "@/lib/background-preview-runtime.js"
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
  playPreviews: boolean
  signedIn: boolean
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
  if (hasActivePermanentOwnership(commerceState)) return "Owned"
  if (commerceState.state === "included-subscription") return "Included with membership"
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
  playPreviews,
  signedIn,
  reducedMotion,
  onSelect,
  onLockedSelect,
  onKeepPermanently,
  onToggleSaved,
}: BackgroundCarouselCardProps) {
  const { videoUrl: previewVideoUrl, posterUrl: previewPosterUrl } = getBackgroundPreviewAssets(option, "vertical")
  const publishedEntry = backgroundPreviewPublishedManifest.entries[option.id]
  const publishedPosterUrl = getVerticalPublishedPreviewPosterUrl(
    publishedEntry,
    publishedPreviewCatalogBaseUrl,
  )
  const previewTags = getBackgroundVisualTags(option)
    .filter((tag) => !["shader", "video"].includes(tag.toLowerCase()))
    .slice(0, 4)
  const statusLabel = accessLabel(commerceState)
  const sourceLabel = ownershipSourceLabel(commerceState.ownershipSource)
  // A transient generic state stays selectable but cannot claim a permanent
  // acquisition until the authoritative ownership row reaches this card.
  const permanentlyOwned = hasActivePermanentOwnership(commerceState)
  const unavailable = commerceState.state === "unavailable"
  const locked = !commerceState.canSelect && !unavailable
  const generatedAcquisitionHintId = useId()
  const acquisitionHintId = locked && detailLevel === "full"
    ? generatedAcquisitionHintId
    : undefined
  const acquisitionHint = signedIn
    ? "Use a credit, buy for $1, or unlock all premium backgrounds."
    : "Add this background now, then sign in or create an account at checkout."

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

      {detailLevel === "full" ? (
        /* Keep favorite in its own column so the ownership action can wrap on narrow cards. */
        <div className="absolute inset-x-3 top-3 z-20 grid grid-cols-[minmax(0,1fr)_auto] items-start gap-2">
          <div className="flex min-w-0 flex-wrap gap-2">
            <Button
              type="button"
              data-carousel-primary-action
              disabled={unavailable}
              aria-describedby={acquisitionHintId}
              aria-label={unavailable
                ? `${option.label} background unavailable`
                : `${locked ? "Unlock" : selected ? "Selected" : "Select"} ${option.label} background`}
              title={locked ? acquisitionHint : undefined}
              onClick={() => {
                if (!commerceState.canSelect) {
                  onLockedSelect?.()
                  return
                }
                onSelect()
              }}
              size="sm"
              variant={locked ? "default" : "glow"}
            >
              {locked ? <Lock aria-hidden="true" /> : null}
              {unavailable ? "Unavailable" : locked ? "Unlock" : selected ? "Selected" : "Select"}
            </Button>
            {/* Temporary membership access offers conversion only with its handler;
                the crown is reserved for authoritative permanent ownership. */}
            {commerceState.showKeepPermanently && onKeepPermanently ? (
              <Button
                type="button"
                size="icon"
                variant="glow"
                onClick={onKeepPermanently}
                aria-label={`Open permanent ownership options for ${option.label}`}
                title="Keep permanently"
              >
                <DollarSign aria-hidden="true" />
              </Button>
            ) : null}
            {permanentlyOwned ? (
              <span
                className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-amber-300/55 bg-amber-950/70 text-amber-200 shadow-sm shadow-amber-300/25"
                role="img"
                aria-label={`${option.label} is permanently owned`}
                title="Permanently owned"
              >
                <Crown className="size-4" aria-hidden="true" />
              </span>
            ) : null}
          </div>
          <Button
            data-carousel-favorite-action
            aria-label={`${saved ? "Unsave" : "Save"} ${option.label}`}
            aria-pressed={saved}
            onClick={onToggleSaved}
            size="icon"
            variant="glow"
            className={cn("shrink-0", purpleGlowClassName)}
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
          <p className="mt-1 text-xs leading-4 text-white/80">
            {option.visualDescriptor}
          </p>
          {previewTags.length > 0 ? (
            <p className="mt-1 text-xs text-white/70">
              {previewTags.join(" - ")}
            </p>
          ) : null}
          {acquisitionHintId ? (
            <p id={acquisitionHintId} className="mt-1 text-[11px] leading-4 text-white/80">
              {signedIn
                ? "Credit, $1 purchase, or membership."
                : "Add now; sign in or create an account at checkout."}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  )
}
