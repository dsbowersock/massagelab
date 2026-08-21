"use client"

import { useEffect, useMemo, type CSSProperties, type ReactNode, type Ref } from "react"
import { StepBack, StepForward } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  createAdaptiveCarouselLoopBuffer,
  normalizeAdaptiveCarouselItems,
} from "./adaptive-carousel-model"
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

/**
 * Exposes carousel navigation to surface-owned controls while preserving the
 * stage's centralized navigation analytics and boundary state.
 */
export interface AdaptiveCarouselControlState {
  centeredItemId: string | null
  canGoPrevious: boolean
  canGoNext: boolean
  goPrevious: () => void
  goNext: () => void
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
  renderControls?: (state: AdaptiveCarouselControlState) => ReactNode
  customControlsVisible?: boolean
  stageRef?: Ref<HTMLElement>
}

type BufferedAdaptiveCarouselItem<T extends AdaptiveCarouselItem> = T & {
  canonicalId?: string
  loopClone?: boolean
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
  items: sourceItemInput,
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
  renderControls,
  customControlsVisible = true,
  stageRef,
}: AdaptiveCarouselStageProps<T>) {
  const sourceItems = useMemo(
    () => normalizeAdaptiveCarouselItems(sourceItemInput) as T[],
    [sourceItemInput],
  )
  const sourceItemsById = useMemo(
    () => new Map(sourceItems.map((item) => [item.id, item])),
    [sourceItems],
  )
  const items = useMemo(
    () => createAdaptiveCarouselLoopBuffer(
      sourceItems,
      Number(tuning.visibleRadius),
      surface === "stations" && Boolean(tuning.loop),
    ) as BufferedAdaptiveCarouselItem<T>[],
    [sourceItems, surface, tuning.loop, tuning.visibleRadius],
  )
  const {
    viewportRef,
    isCarouselReady,
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
  // Station previews are square so their artwork and title remain complete.
  // Navigation is an independently overlaid affordance and must not change
  // card geometry when pointer or reduced-motion capability changes live.
  const approvedSummaryCardHeight = Math.min(cardHeight, cardWidth)
  const summaryCardHeight = surface === "stations"
    ? `${approvedSummaryCardHeight}px`
    : `${cardHeight}px`
  const rootStyle: CarouselRootStyle = {
    "--carousel-card-width": `${cardWidth}px`,
    "--carousel-card-height": `${cardHeight}px`,
    "--carousel-summary-card-height": summaryCardHeight,
    "--carousel-gap": `${finiteTuningValue(tuning.gap, 16)}px`,
    "--carousel-perspective": `${finiteTuningValue(tuning.perspective, 900)}px`,
  }
  const itemLabel = surface === "backgrounds" ? "background" : "station"
  const controlState: AdaptiveCarouselControlState = {
    centeredItemId: centeredId,
    canGoPrevious,
    canGoNext,
    goPrevious: () => {
      onNavigate?.()
      goPrevious()
    },
    goNext: () => {
      onNavigate?.()
      goNext()
    },
  }
  const stationControlsVisible = surface === "stations"
    && Boolean(renderControls)
    && customControlsVisible
  const defaultNavigation = (
    <div className={styles.navigation}>
      <Button
        type="button"
        className={styles.navigationButton}
        aria-label={`Previous ${itemLabel}`}
        title={`Previous ${itemLabel}`}
        disabled={!canGoPrevious}
        onClick={controlState.goPrevious}
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
        onClick={controlState.goNext}
        size="icon"
        variant="glow"
      >
        <StepForward aria-hidden="true" />
      </Button>
    </div>
  )
  const renderedControls = renderControls && customControlsVisible
    ? renderControls(controlState)
    : !renderControls
      ? defaultNavigation
      : null

  return (
    <section
      ref={stageRef}
      className={styles.root}
      data-surface={surface}
      data-presentation={presentation}
      data-carousel-ready={isCarouselReady ? "true" : "false"}
      data-reduced-motion={reducedMotion || tuning.motion === false}
      data-carousel-responsive-profile={viewportProfile}
      data-has-custom-controls={Boolean(renderControls)}
      style={rootStyle}
      aria-label={`${surface === "backgrounds" ? "Background" : "Station"} carousel`}
    >
      <div
        ref={viewportRef}
        className={styles.stage}
        data-testid={testId}
        tabIndex={0}
        onKeyDownCapture={(event) => {
          if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(event.key)) {
            onNavigate?.()
          }
          handleKeyDown(event)
        }}
      >
        <div className={styles.track}>
          {items.map((item) => {
            const canonicalId = item.canonicalId ?? item.id
            const sourceItem = sourceItemsById.get(canonicalId)
            if (!sourceItem) return null
            const nearby = mountedIds.has(item.id)
            const centered = centeredId === item.id
            const detailLevel = centered ? "full" : nearby ? "summary" : "shell"
            const availability =
              item.statusLabel ?? (item.disabled ? "disabled" : "available")
            const logicalIndex = sourceItems.findIndex(({ id }) => id === canonicalId)
            const accessibleLabel =
              `${item.label}, item ${logicalIndex + 1} of ${sourceItems.length}, ${availability}`

            return (
              <div
                key={item.id}
                ref={(element) => registerItemElement(item.id, element)}
                className={styles.slide}
                role={item.loopClone ? undefined : "group"}
                aria-roledescription={item.loopClone ? undefined : "slide"}
                aria-current={!item.loopClone && centered ? "true" : undefined}
                aria-label={item.loopClone ? undefined : accessibleLabel}
                aria-hidden={item.loopClone ? "true" : undefined}
                data-carousel-slide="true"
                data-carousel-item-id={item.id}
                data-carousel-canonical-id={canonicalId}
                data-carousel-loop-clone={item.loopClone ? "true" : undefined}
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
                  ) : centered && !item.loopClone ? (
                    <div className={styles.renderer}>
                      {renderItem(sourceItem, { centered, nearby, detailLevel })}
                    </div>
                  ) : (
                    <div className={styles.summary} aria-hidden="true" inert>
                      {renderItem(sourceItem, { centered, nearby, detailLevel })}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {renderedControls ? (
        <div
          className={styles.controls}
          data-station-carousel-controls={stationControlsVisible && viewportProfile === "music-fit"
            ? "true"
            : undefined}
        >
          {renderedControls}
        </div>
      ) : null}

      <p className={styles.status} aria-live="polite" aria-atomic="true">
        {statusText}
      </p>
    </section>
  )
}
