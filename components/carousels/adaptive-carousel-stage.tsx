"use client"

import { useEffect, useMemo, type CSSProperties, type ReactNode } from "react"
import { StepBack, StepForward } from "lucide-react"
import { Button } from "@/components/ui/button"
import { normalizeAdaptiveCarouselItems } from "./adaptive-carousel-model"
import {
  useAdaptiveCarouselController,
  type AdaptiveCarouselItem,
} from "./use-adaptive-carousel-controller"
import styles from "./adaptive-carousel-stage.module.css"

export type AdaptiveCarouselDetailLevel = "full" | "summary" | "shell"

interface AdaptiveCarouselItemRenderState {
  centered: boolean
  nearby: boolean
  detailLevel: AdaptiveCarouselDetailLevel
}

export interface AdaptiveCarouselStageProps<T extends AdaptiveCarouselItem> {
  items: readonly T[]
  initialItemId?: string | null
  selectedItemId?: string | null
  surface: "backgrounds" | "stations"
  presentation: "existing" | "cover-flow" | "three-d" | "background-picker"
  tuning: Record<string, number | boolean>
  reducedMotion: boolean
  renderItem: (item: T, state: AdaptiveCarouselItemRenderState) => ReactNode
  onCenteredItemChange?: (itemId: string) => void
  onEffectiveLoopChange?: (value: boolean) => void
  onNavigate?: () => void
  testId?: string
  viewportProfile?: string
}

type CarouselRootStyle = CSSProperties & {
  "--carousel-card-width": string
  "--carousel-card-height": string
  "--carousel-summary-card-height": string
  "--carousel-gap": string
  "--carousel-perspective": string
}

function finiteTuningValue(value: number | boolean | undefined, fallback: number) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

/**
 * Presents normalized identities through one accessible, resource-bounded
 * Embla stage shared by production and the development review surface.
 */
export function AdaptiveCarouselStage<T extends AdaptiveCarouselItem>({
  items: sourceItems,
  initialItemId,
  selectedItemId,
  surface,
  presentation,
  tuning,
  reducedMotion,
  renderItem,
  onCenteredItemChange,
  onEffectiveLoopChange,
  onNavigate,
  testId = "adaptive-carousel-stage",
  viewportProfile,
}: AdaptiveCarouselStageProps<T>) {
  const items = useMemo(
    () => normalizeAdaptiveCarouselItems(sourceItems) as T[],
    [sourceItems],
  )
  const {
    viewportRef,
    centeredId,
    mountedIds,
    effectiveLoop,
    canGoPrevious,
    canGoNext,
    centerItem,
    goPrevious,
    goNext,
    handleKeyDown,
    registerItemElement,
    statusText,
  } = useAdaptiveCarouselController({
    items,
    initialItemId,
    selectedItemId,
    surface,
    presentation,
    tuning,
    reducedMotion,
    onCenteredItemChange,
  })

  useEffect(() => {
    onEffectiveLoopChange?.(effectiveLoop)
  }, [effectiveLoop, onEffectiveLoopChange])

  const cardWidth = finiteTuningValue(tuning.cardWidth, 208)
  const cardHeight = finiteTuningValue(tuning.cardHeight, 304)
  const summaryCardHeight = surface === "stations"
    ? Math.min(cardHeight, cardWidth + 1)
    : cardHeight
  const rootStyle: CarouselRootStyle = {
    "--carousel-card-width": `${cardWidth}px`,
    "--carousel-card-height": `${cardHeight}px`,
    "--carousel-summary-card-height": `${summaryCardHeight}px`,
    "--carousel-gap": `${finiteTuningValue(tuning.gap, 16)}px`,
    "--carousel-perspective": `${finiteTuningValue(tuning.perspective, 900)}px`,
  }
  const itemLabel = surface === "backgrounds" ? "background" : "station"

  return (
    <section
      className={styles.root}
      data-surface={surface}
      data-presentation={presentation}
      data-reduced-motion={reducedMotion || tuning.motion === false}
      data-carousel-responsive-profile={viewportProfile}
      style={rootStyle}
      aria-label={`${surface === "backgrounds" ? "Background" : "Station"} carousel`}
    >
      <div
        ref={viewportRef}
        className={styles.stage}
        data-testid={testId}
        tabIndex={0}
        onKeyDown={(event) => {
          if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
            onNavigate?.()
          }
          handleKeyDown(event)
        }}
      >
        <div className={styles.track}>
          {items.map((item, index) => {
            const nearby = mountedIds.has(item.id)
            const centered = centeredId === item.id
            const detailLevel = centered ? "full" : nearby ? "summary" : "shell"
            const availability =
              item.statusLabel ?? (item.disabled ? "disabled" : "available")
            const accessibleLabel =
              `${item.label}, item ${index + 1} of ${items.length}, ${availability}`

            return (
              <div
                key={item.id}
                ref={(element) => registerItemElement(item.id, element)}
                className={styles.slide}
                role="group"
                aria-roledescription="slide"
                aria-current={centered ? "true" : undefined}
                aria-label={accessibleLabel}
                data-carousel-slide="true"
                data-carousel-item-id={item.id}
                data-centered={centered}
                data-detail-level={detailLevel}
                onClick={(event) => {
                  if (item.id === centeredId) return
                  if ((event.target as HTMLElement).closest(
                    "button, a, input, select, textarea",
                  )) return
                  onNavigate?.()
                  centerItem(item.id)
                }}
                onFocusCapture={() => {
                  if (item.id !== centeredId) centerItem(item.id)
                }}
              >
                <div className={styles.presentation} data-carousel-transform="true">
                  {detailLevel === "shell" ? (
                    <div className={styles.shell} aria-hidden="true" />
                  ) : centered ? (
                    <div className={styles.renderer}>
                      {renderItem(item, { centered, nearby, detailLevel })}
                    </div>
                  ) : (
                    <div className={styles.summary} aria-hidden="true" inert>
                      {renderItem(item, { centered, nearby, detailLevel })}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className={styles.navigation}>
        <Button
          type="button"
          className={styles.navigationButton}
          aria-label={`Previous ${itemLabel}`}
          title={`Previous ${itemLabel}`}
          disabled={!canGoPrevious}
          onClick={() => {
            onNavigate?.()
            goPrevious()
          }}
          size="icon"
          variant="glow"
        >
          <StepBack aria-hidden="true" />
        </Button>
        <Button
          type="button"
          className={styles.navigationButton}
          aria-label={`Next ${itemLabel}`}
          title={`Next ${itemLabel}`}
          disabled={!canGoNext}
          onClick={() => {
            onNavigate?.()
            goNext()
          }}
          size="icon"
          variant="glow"
        >
          <StepForward aria-hidden="true" />
        </Button>
      </div>

      <p className={styles.status} aria-live="polite" aria-atomic="true">
        {statusText}
      </p>
    </section>
  )
}
