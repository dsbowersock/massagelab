"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { AdaptiveCarouselStage } from "@/components/carousels/adaptive-carousel-stage"
import {
  getResponsiveBackgroundCarouselTuning,
  resolveAdaptiveCarouselViewportProfile,
} from "@/components/carousels/adaptive-carousel-model"
import { BackgroundCarouselCard } from "@/components/backgrounds/background-carousel-card"
import { useBackgroundCommerce } from "@/components/backgrounds/BackgroundCommerceProvider"
import {
  type BackgroundDefinition,
  type BackgroundId,
  userCanUseBackground,
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
  featureKeys?: string[]
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
  featureKeys = [],
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
  const [reducedMotion, setReducedMotion] = useState(false)
  const { state: commerceClientState, signedIn } = useBackgroundCommerce()
  const snapshot = commerceClientState.snapshot

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    const update = () => setReducedMotion(query.matches)
    update()
    query.addEventListener("change", update)
    return () => query.removeEventListener("change", update)
  }, [])

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
      const canUse = userCanUseBackground(option, {
        featureKeys,
        ownedBackgroundIds: snapshot?.ownedBackgroundIds ?? [],
      })
      const commerceState = backgroundCardCommerceState({
        background: option,
        access: {
          canUse,
          accessSource: option.requiresSubscription && canUse
            ? "subscription"
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
    [featureKeys, options, snapshot],
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
        renderItem={(option, { detailLevel }) => (
          <BackgroundCarouselCard
            option={option}
            detailLevel={detailLevel}
            commerceState={option.commerceState}
            selected={selectedId === option.id}
            saved={savedIds.includes(option.id)}
            active={active}
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
