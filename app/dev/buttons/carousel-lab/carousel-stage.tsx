"use client"

import { useEffect, useMemo, type CSSProperties, type ReactNode } from "react"
import { normalizeCarouselLabItems } from "./carousel-lab-model"
import { useCarouselLabController, type CarouselLabItem } from "./use-carousel-lab-controller"
import styles from "./carousel-stage.module.css"

type CarouselDetailLevel = "full" | "summary" | "shell"

interface CarouselItemRenderState {
  centered: boolean
  nearby: boolean
  detailLevel: CarouselDetailLevel
}

export interface CarouselStageProps<T extends CarouselLabItem> {
  items: readonly T[]
  initialItemId?: string | null
  selectedItemId?: string | null
  surface: "backgrounds" | "stations"
  presentation: "existing" | "cover-flow" | "three-d"
  tuning: Record<string, number | boolean>
  reducedMotion: boolean
  renderItem: (item: T, state: CarouselItemRenderState) => ReactNode
  onCenteredItemChange?: (itemId: string) => void
  onEffectiveLoopChange?: (value: boolean) => void
}

type CarouselRootStyle = CSSProperties & {
  "--lab-card-width": string
  "--lab-gap": string
  "--lab-perspective": string
  "--lab-reflection-opacity": string
  "--lab-reflection-gap": string
  "--lab-mask-lower": string
  "--lab-mask-upper": string
}

function finiteTuningValue(value: number | boolean | undefined, fallback: number) {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

/**
 * Presents normalized carousel identities through one accessible Embla stage.
 * Distant items keep their slide semantics while avoiding expensive renderers.
 */
export function CarouselStage<T extends CarouselLabItem>({
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
}: CarouselStageProps<T>) {
  // This is the sole identity boundary used by keys, counts, Embla, and navigation.
  const items = useMemo(
    () => normalizeCarouselLabItems(sourceItems) as T[],
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
  } = useCarouselLabController({
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

  const rootStyle: CarouselRootStyle = {
    "--lab-card-width": `${finiteTuningValue(tuning.cardWidth, 208)}px`,
    "--lab-gap": `${finiteTuningValue(tuning.gap, 16)}px`,
    "--lab-perspective": `${finiteTuningValue(tuning.perspective, 900)}px`,
    "--lab-reflection-opacity": String(finiteTuningValue(tuning.reflectionOpacity, 0.4)),
    "--lab-reflection-gap": `${finiteTuningValue(tuning.reflectionGap, 8)}px`,
    "--lab-mask-lower": String(finiteTuningValue(tuning.nearMask, 0.9)),
    "--lab-mask-upper": String(finiteTuningValue(tuning.farMask, 1.8)),
  }

  return (
    <section
      className={styles.root}
      data-surface={surface}
      data-presentation={presentation}
      data-reflection={presentation === "cover-flow" && tuning.reflection === true}
      data-reduced-motion={reducedMotion || tuning.motion === false}
      style={rootStyle}
      aria-label={`${surface === "backgrounds" ? "Background" : "Station"} carousel`}
    >
      <div
        ref={viewportRef}
        className={styles.stage}
        data-testid="carousel-lab-stage"
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        <div className={styles.track}>
          {items.map((item, index) => {
            const nearby = mountedIds.has(item.id)
            const centered = centeredId === item.id
            const detailLevel = centered ? "full" : nearby ? "summary" : "shell"
            const availability = item.statusLabel ?? (item.disabled ? "disabled" : "available")
            const accessibleLabel = `${item.label}, item ${index + 1} of ${items.length}, ${availability}`

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
                data-centered={centered}
                data-detail-level={detailLevel}
                onClick={(event) => {
                  if (item.id === centeredId) return
                  if ((event.target as HTMLElement).closest("button, a, input, select, textarea")) return
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
        <button
          type="button"
          className={styles.navigationButton}
          aria-label="Previous carousel item"
          disabled={!canGoPrevious}
          onClick={goPrevious}
        >
          Previous
        </button>
        <button
          type="button"
          className={styles.navigationButton}
          aria-label="Next carousel item"
          disabled={!canGoNext}
          onClick={goNext}
        >
          Next
        </button>
      </div>

      <p className={styles.status} aria-live="polite" aria-atomic="true">
        {statusText}
      </p>
    </section>
  )
}
