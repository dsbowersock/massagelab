"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AdaptiveCarouselStage } from "@/components/carousels/adaptive-carousel-stage"
import {
  getResponsiveBackgroundCarouselTuning,
  resolveAdaptiveCarouselViewportProfile,
} from "@/components/carousels/adaptive-carousel-model"
import { BackgroundCarouselCard } from "@/components/backgrounds/background-carousel-card"
import { BackgroundCarouselControlTray } from "@/components/backgrounds/background-carousel-control-tray"
import { useAmbientReducedMotion } from "@/components/backgrounds/use-ambient-reduced-motion"
import { useBackgroundCommerce } from "@/components/backgrounds/BackgroundCommerceProvider"
import { useSettings } from "@/components/providers/settings-provider"
import {
  type BackgroundAccessSnapshot,
  type BackgroundDefinition,
  type BackgroundId,
  userCanUseBackground,
} from "@/components/backgrounds/backgroundRegistry"
import { backgroundCardCommerceState } from "@/lib/background-commerce-client.js"
import {
  readBackgroundPreviewPreference,
  writeBackgroundPreviewPreference,
} from "@/lib/background-preview-preference.js"

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
  const [previewPreferenceEnabled, setPreviewPreferenceEnabled] = useState(true)
  const [preferenceHydrated, setPreferenceHydrated] = useState(false)
  const { settings } = useSettings()
  const { state: commerceClientState, signedIn } = useBackgroundCommerce()
  const snapshot = commerceClientState.snapshot

  // Keep the carousel, preview cards, and host on the shared ambient-motion source of truth.
  const reducedMotion = useAmbientReducedMotion(settings.ambientMotionMode)
  const previewPlaybackActive =
    preferenceHydrated && previewPreferenceEnabled && active && !reducedMotion

  useEffect(() => {
    setPreviewPreferenceEnabled(readBackgroundPreviewPreference(window.localStorage))
    setPreferenceHydrated(true)
  }, [])

  /**
   * Keeps saved device intent distinct from a temporary reduced-motion pause.
   * A blocked localStorage write must not prevent the current session changing.
   */
  function handlePreviewPreferenceChange(enabled: boolean) {
    setPreviewPreferenceEnabled(enabled)
    writeBackgroundPreviewPreference(window.localStorage, enabled)
  }

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
      const canUse = userCanUseBackground(option, access)
      // Access-owned IDs are permanent acquisitions even while the provider
      // refreshes; other usable premium IDs are subscription-backed membership
      // access.
      const isOwnedByAccess = access.ownedBackgroundIds.includes(option.id)
      const commerceState = backgroundCardCommerceState({
        background: option,
        access: {
          canUse,
          accessSource: option.requiresSubscription && canUse
            ? isOwnedByAccess
              ? "ownership"
              : "subscription"
            : canUse
              ? "free"
              : "locked",
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
        renderControls={(controls) => {
          const centeredOption = items.find(({ id }) => id === controls.centeredItemId)
          if (!centeredOption) return null

          return (
            <BackgroundCarouselControlTray
              option={centeredOption}
              commerceState={centeredOption.commerceState}
              selected={selectedId === centeredOption.id}
              saved={savedIds.includes(centeredOption.id)}
              signedIn={signedIn}
              previewPreferenceEnabled={previewPreferenceEnabled}
              reducedMotion={reducedMotion}
              canGoPrevious={controls.canGoPrevious}
              canGoNext={controls.canGoNext}
              onPrevious={controls.goPrevious}
              onNext={controls.goNext}
              onSelect={() => onSelect(centeredOption.id)}
              onLockedSelect={() => onLockedSelect?.(centeredOption)}
              onKeepPermanently={() => onKeepPermanently?.(centeredOption)}
              onToggleSaved={() => onToggleSaved(centeredOption.id)}
              onPreviewPreferenceChange={handlePreviewPreferenceChange}
            />
          )
        }}
        renderItem={(option, { detailLevel }) => (
          <BackgroundCarouselCard
            option={option}
            detailLevel={detailLevel}
            selected={selectedId === option.id}
            active={active}
            playPreviews={previewPlaybackActive}
            reducedMotion={reducedMotion}
          />
        )}
      />
    </div>
  )
}
