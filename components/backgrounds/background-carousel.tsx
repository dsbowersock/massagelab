"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AdaptiveCarouselStage } from "@/components/carousels/adaptive-carousel-stage"
import {
  getResponsiveBackgroundCarouselTuning,
  resolveAdaptiveCarouselViewportProfile,
} from "@/components/carousels/adaptive-carousel-model"
import { BackgroundCarouselCard } from "@/components/backgrounds/background-carousel-card"
import { Button } from "@/components/ui/button"
import { useAmbientReducedMotion } from "@/components/backgrounds/use-ambient-reduced-motion"
import { useBackgroundCommerce } from "@/components/backgrounds/BackgroundCommerceProvider"
import { useSettings } from "@/components/providers/settings-provider"
import {
  type BackgroundAccessSnapshot,
  type BackgroundDefinition,
  type BackgroundId,
  resolveBackgroundCommerceAccessSource,
} from "@/components/backgrounds/backgroundRegistry"
import { backgroundCardCommerceState } from "@/lib/background-commerce-client.js"

type BackgroundViewportProfile =
  | "phone-portrait"
  | "short-landscape"
  | "tablet"
  | "compact-desktop"
  | "wide-landscape"

interface BackgroundCarouselProps {
  options: readonly BackgroundDefinition[]
  selectedId?: string | null
  access: BackgroundAccessSnapshot
  savedIds: readonly BackgroundId[]
  active?: boolean
  onSelect: (backgroundId: BackgroundId) => void
  onLockedSelect?: (option: BackgroundDefinition) => void
  onKeepPermanently?: (option: BackgroundDefinition) => void
  onToggleSaved: (backgroundId: BackgroundId) => void
  onCenteredItemChange?: (backgroundId: BackgroundId) => void
  onEffectiveLoopChange?: (value: boolean) => void
  onNavigate?: () => void
  testId?: string
}

/**
 * Promotes the approved responsive Background carousel to production data while
 * adapting the one authoritative commerce snapshot into card presentation.
 */
export function BackgroundCarousel({
  options,
  selectedId = null,
  access,
  savedIds,
  active = true,
  onSelect,
  onLockedSelect,
  onKeepPermanently,
  onToggleSaved,
  onCenteredItemChange,
  onEffectiveLoopChange,
  onNavigate,
  testId = "background-carousel-stage",
}: BackgroundCarouselProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const [profile, setProfile] =
    useState<BackgroundViewportProfile>("compact-desktop")
  const [playPreviews, setPlayPreviews] = useState(false)
  const { settings } = useSettings()
  const { state: commerceClientState, signedIn } = useBackgroundCommerce()
  const snapshot = commerceClientState.snapshot

  // Keep the carousel, preview cards, and host on the shared ambient-motion source of truth.
  const reducedMotion = useAmbientReducedMotion(settings.ambientMotionMode)
  const previewPlaybackActive = playPreviews && active && !reducedMotion

  useEffect(() => {
    // Do not silently resume previews if reduced motion is later turned off.
    if (reducedMotion) setPlayPreviews(false)
  }, [reducedMotion])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    let frame: number | null = null
    const measure = () => {
      frame = null
      const nextProfile = resolveAdaptiveCarouselViewportProfile({
        containerWidth: host.getBoundingClientRect().width,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
      }) as BackgroundViewportProfile
      setProfile((current) => current === nextProfile ? current : nextProfile)
    }
    const scheduleMeasure = () => {
      if (frame !== null) window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(measure)
    }
    const observer = typeof ResizeObserver === "undefined"
      ? null
      : new ResizeObserver(scheduleMeasure)
    observer?.observe(host)
    window.addEventListener("resize", scheduleMeasure)
    scheduleMeasure()
    return () => {
      observer?.disconnect()
      window.removeEventListener("resize", scheduleMeasure)
      if (frame !== null) window.cancelAnimationFrame(frame)
    }
  }, [])

  const items = useMemo(
    () => options.map((option) => {
      const accessSource = resolveBackgroundCommerceAccessSource(option, access)
      const commerceState = backgroundCardCommerceState({
        background: option,
        access: {
          canUse: accessSource !== "locked",
          accessSource,
        },
        snapshot,
      })
      return {
        ...option,
        commerceState,
        disabled: commerceState.state === "unavailable",
        statusLabel: commerceState.state,
      }
    }),
    [access, options, snapshot],
  )
  const initialItemId = items.some((option) => option.id === selectedId)
    ? selectedId
    : items[0]?.id ?? null
  const tuning = useMemo(
    () => getResponsiveBackgroundCarouselTuning(profile),
    [profile],
  )

  return (
    <div ref={hostRef} className="min-w-0" data-background-carousel>
      <div className="mb-2 flex justify-end">
        <Button
          type="button"
          size="sm"
          variant="outline"
          aria-pressed={previewPlaybackActive}
          disabled={reducedMotion}
          onClick={() => setPlayPreviews((current) => !current)}
        >
          {reducedMotion
            ? "Previews off (reduced motion)"
            : playPreviews
              ? "Pause Previews"
              : "Play Preview"}
        </Button>
      </div>
      <AdaptiveCarouselStage
        key={items.map(({ id }) => id).join("|")}
        items={items}
        initialItemId={initialItemId}
        selectedItemId={selectedId}
        surface="backgrounds"
        presentation="existing"
        tuning={tuning}
        reducedMotion={reducedMotion}
        testId={testId}
        viewportProfile={profile}
        onCenteredItemChange={(itemId) => {
          onCenteredItemChange?.(itemId as BackgroundId)
        }}
        onEffectiveLoopChange={onEffectiveLoopChange}
        onNavigate={onNavigate}
        renderItem={(option, { detailLevel }) => (
          <BackgroundCarouselCard
            option={option}
            detailLevel={detailLevel}
            commerceState={option.commerceState}
            selected={selectedId === option.id}
            saved={savedIds.includes(option.id)}
            active={active}
            playPreviews={previewPlaybackActive}
            signedIn={signedIn}
            reducedMotion={reducedMotion}
            onSelect={() => onSelect(option.id)}
            onLockedSelect={() => onLockedSelect?.(option)}
            onKeepPermanently={() => onKeepPermanently?.(option)}
            onToggleSaved={() => onToggleSaved(option.id)}
          />
        )}
      />
    </div>
  )
}
