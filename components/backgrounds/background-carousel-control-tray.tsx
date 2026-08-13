"use client"

import { useId } from "react"
import { Crown, DollarSign, Info, Lock, StepBack, StepForward } from "lucide-react"
import type { BackgroundDefinition } from "@/components/backgrounds/backgroundRegistry"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { MetalFavoriteIcon } from "@/components/ui/metal-favorite-icon"
import { ToggleControl } from "@/components/ui/toggle-control"
import { getBackgroundVisualTags } from "@/lib/background-catalog"
import { backgroundCarouselAccessLabel } from "@/lib/background-carousel-access-label.js"
import { hasActivePermanentOwnership } from "@/lib/background-commerce-client.js"
import styles from "./background-carousel-control-tray.module.css"

type BackgroundCardCommerceState = {
  state: string
  canSelect: boolean
  showKeepPermanently: boolean
  isInCart: boolean
  isReserved: boolean
  ownershipStatus: string | null
  ownershipSource: string | null
}

export interface BackgroundCarouselControlTrayProps {
  option: BackgroundDefinition
  commerceState: BackgroundCardCommerceState
  selected: boolean
  saved: boolean
  signedIn: boolean
  previewPreferenceEnabled: boolean
  reducedMotion: boolean
  canGoPrevious: boolean
  canGoNext: boolean
  onPrevious: () => void
  onNext: () => void
  onSelect: () => void
  onLockedSelect?: () => void
  onKeepPermanently?: () => void
  onToggleSaved: () => void
  onPreviewPreferenceChange: (enabled: boolean) => void
}

/** Maps permanent ownership provenance to the non-visual screen-reader detail. */
function ownershipSourceLabel(source: string | null) {
  if (source === "purchase") return "Purchased"
  if (source === "credit") return "Credit"
  return null
}

/**
 * Owns the centered Background's accessible metadata and actions so preview
 * artwork remains unobscured while all commerce decisions retain their source.
 */
export function BackgroundCarouselControlTray({
  option,
  commerceState,
  selected,
  saved,
  signedIn,
  previewPreferenceEnabled,
  reducedMotion,
  canGoPrevious,
  canGoNext,
  onPrevious,
  onNext,
  onSelect,
  onLockedSelect,
  onKeepPermanently,
  onToggleSaved,
  onPreviewPreferenceChange,
}: BackgroundCarouselControlTrayProps) {
  const statusLabel = backgroundCarouselAccessLabel(commerceState)
  const sourceLabel = ownershipSourceLabel(commerceState.ownershipSource)
  const permanentlyOwned = hasActivePermanentOwnership(commerceState)
  const unavailable = commerceState.state === "unavailable"
  const locked = !commerceState.canSelect && !unavailable
  const primaryLabel = unavailable
    ? "Unavailable"
    : locked
      ? "Unlock"
      : selected
        ? "Selected"
        : "Select"
  const acquisitionHint = signedIn
    ? "Use a credit, buy for $1, or unlock all premium backgrounds."
    : "Add this background now, then sign in or create an account at checkout."
  const previewTags = getBackgroundVisualTags(option)
    .filter((tag) => !["shader", "video"].includes(tag.toLowerCase()))
    .slice(0, 4)
  const acquisitionHintId = useId()
  const reducedMotionStatusId = useId()

  function handlePrimaryAction() {
    if (!commerceState.canSelect) {
      onLockedSelect?.()
      return
    }
    onSelect()
  }

  return (
    <section
      className={styles.tray}
      data-background-carousel-controls
      data-background-access-state={commerceState.state}
      data-testid="background-carousel-controls"
      aria-label={`Controls for ${option.label}`}
    >
      <div className={styles.metadata}>
        <h3>{option.label}</h3>
        <p className={styles.description}>{option.visualDescriptor}</p>
        <div className={styles.accessState}>
          <span data-background-access-label>
            {statusLabel}
            {statusLabel === "Owned" && sourceLabel ? <span className="sr-only"> - {sourceLabel}</span> : null}
          </span>
          {commerceState.isReserved ? <span>Reserved</span> : commerceState.isInCart ? <span>In cart</span> : null}
        </div>
        <div className={styles.supplementaryMetadata}>
          {previewTags.length > 0 ? <span>{previewTags.join(" - ")}</span> : null}
          {locked ? <span id={acquisitionHintId}>{acquisitionHint}</span> : null}
        </div>
      </div>
      <div className={styles.previewRegion}>
        <ToggleControl
          className={styles.previewToggle}
          label="Animated previews"
          valueLabel={previewPreferenceEnabled ? "On" : "Off"}
          checked={previewPreferenceEnabled}
          density="dense"
          tone="leaf"
          aria-describedby={reducedMotion ? reducedMotionStatusId : undefined}
          onCheckedChange={onPreviewPreferenceChange}
        />
        {reducedMotion ? (
          <p id={reducedMotionStatusId} role="status" className={styles.motionStatus}>
            Paused by your reduced-motion setting. Your preview preference is still saved.
          </p>
        ) : null}
      </div>
      <div className={styles.actions}>
        <Button className={styles.previousAction} data-background-tray-action="previous" type="button" size="icon" variant="glow" aria-label="Previous background" disabled={!canGoPrevious} onClick={onPrevious}>
          <StepBack aria-hidden="true" />
        </Button>
        <Button
          className={styles.primaryAction}
          type="button"
          data-carousel-primary-action
          data-carousel-primary-state={unavailable ? "unavailable" : locked ? "locked" : "available"}
          data-background-tray-action="primary"
          disabled={unavailable}
          aria-describedby={locked ? acquisitionHintId : undefined}
          aria-label={`${primaryLabel} ${option.label} background`}
          title={locked ? acquisitionHint : undefined}
          onClick={handlePrimaryAction}
          size="sm"
          variant={locked ? "default" : "glow"}
        >
          {locked ? <Lock aria-hidden="true" /> : null}
          {primaryLabel}
        </Button>
        {commerceState.showKeepPermanently && onKeepPermanently ? (
          <Button className={styles.permanentAction} data-background-tray-action="permanent" type="button" size="icon" variant="glow" onClick={onKeepPermanently} aria-label={`Open permanent ownership options for ${option.label}`} title="Keep permanently">
            <DollarSign aria-hidden="true" />
          </Button>
        ) : null}
        {permanentlyOwned ? (
          <span className={styles.ownershipBadge} data-background-tray-action="permanent-ownership" role="img" aria-label={`${option.label} is permanently owned`} title="Permanently owned">
            <Crown aria-hidden="true" />
          </span>
        ) : null}
        <Button className={styles.favoriteAction} data-background-tray-action="favorite" type="button" data-carousel-favorite-action aria-pressed={saved} aria-label={`${saved ? "Unsave" : "Save"} ${option.label}`} onClick={onToggleSaved} size="icon" variant="glow">
          <MetalFavoriteIcon kind="star" selected={saved} />
        </Button>
        <Button className={styles.nextAction} data-background-tray-action="next" type="button" size="icon" variant="glow" aria-label="Next background" disabled={!canGoNext} onClick={onNext}>
          <StepForward aria-hidden="true" />
        </Button>
        <Dialog>
          <DialogTrigger asChild>
            <Button type="button" className={styles.infoTrigger} data-background-tray-action="info" size="icon" variant="glow" aria-label={`More information about ${option.label}`} title="Background information">
              <Info aria-hidden="true" />
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{option.label}</DialogTitle>
              <DialogDescription>{option.visualDescriptor}</DialogDescription>
            </DialogHeader>
            <p>{statusLabel}</p>
            {previewTags.length > 0 ? <p>{previewTags.join(" - ")}</p> : null}
            {locked ? <p>{acquisitionHint}</p> : null}
          </DialogContent>
        </Dialog>
      </div>
    </section>
  )
}
