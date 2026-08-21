"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import useEmblaCarousel from "embla-carousel-react"
import {
  getAdaptiveCarouselPresentationProgress,
  getAdaptiveCarouselPresentationVariables,
  getMountedAdaptiveCarouselItemIds,
  reconcileAdaptiveCarouselCenter,
  resolveEffectiveCarouselLoop,
} from "./adaptive-carousel-model"

const interactiveSlideSelector =
  "button, a, input, select, textarea, [role='button'], [role='option']"
const interactiveDragSurfaceSelector = "[data-carousel-drag-surface='true']"

/**
 * Normalizes Element and Text-node event targets before deciding whether Embla
 * may start a drag. Interactive controls may drag only when that same element
 * is the explicitly approved drag surface, keeping Play/Stop and Favorite
 * actions protected while station details can support both taps and swipes.
 */
function shouldStartCarouselDrag(event: MouseEvent | TouchEvent) {
  const target = event.target
  const targetElement = target instanceof Element
    ? target
    : target instanceof Node
      ? target.parentElement
      : null
  if (!targetElement) return true

  const interactive = targetElement.closest(interactiveSlideSelector)
  if (!interactive) return true

  const dragSurface = targetElement.closest(interactiveDragSurfaceSelector)
  return dragSurface === interactive && dragSurface.matches(interactiveSlideSelector)
}

export interface AdaptiveCarouselItem {
  id: string
  label: string
  disabled?: boolean
  statusLabel?: string
  canonicalId?: string
  loopClone?: boolean
}

interface UseAdaptiveCarouselControllerOptions {
  items: readonly AdaptiveCarouselItem[]
  initialItemId?: string | null
  selectedItemId?: string | null
  surface: "backgrounds" | "stations"
  presentation: "existing" | "cover-flow" | "three-d" | "background-picker"
  tuning: Record<string, number | boolean>
  reducedMotion: boolean
  onCenteredItemChange?: (itemId: string) => void
}

/**
 * Owns looped Embla navigation and presentation transforms without coupling
 * the shared stage to Background or Music Station state.
 */
export function useAdaptiveCarouselController(
  options: UseAdaptiveCarouselControllerOptions,
) {
  const {
    items,
    initialItemId,
    selectedItemId,
    surface,
    presentation,
    tuning,
    reducedMotion,
  } = options
  const staticPresentation = reducedMotion || tuning.motion === false
  // Station navigation remains circular when motion is suppressed; Background
  // keeps its existing finite reduced-motion rail and edge semantics.
  const logicalItems = useMemo(
    () => items.filter((item) => !item.loopClone),
    [items],
  )
  const bufferedLoop = items.some((item) => item.loopClone)
  const visibleRadius = Math.min(
    Number(tuning.visibleRadius),
    Math.floor(Math.max(0, logicalItems.length - 1) / 2),
  )
  const effectiveLoop = surface === "stations" || !staticPresentation
    ? resolveEffectiveCarouselLoop(
        logicalItems.length,
        visibleRadius,
        Boolean(tuning.loop),
      )
    : false
  const emblaLoop = effectiveLoop && !bufferedLoop
  const [initialCenter] = useState(() => {
    const id = reconcileAdaptiveCarouselCenter(items, initialItemId, selectedItemId)
    const index = Math.max(0, items.findIndex((item) => item.id === id))
    return { id, index }
  })
  const [viewportRef, api] = useEmblaCarousel({
    align: "center",
    containScroll: false,
    dragFree: false,
    loop: emblaLoop,
    skipSnaps: false,
    duration: staticPresentation ? 0 : 45,
    startIndex: initialCenter.index,
    watchDrag: (_api, event) => shouldStartCarouselDrag(event),
  })
  const itemElements = useRef(new Map<string, HTMLElement>())
  const frameRef = useRef<number | null>(null)
  const onCenteredItemChangeRef = useRef(options.onCenteredItemChange)
  const [centeredId, setCenteredId] = useState<string | null>(initialCenter.id)
  const [canGoPrevious, setCanGoPrevious] = useState(false)
  const [canGoNext, setCanGoNext] = useState(false)
  /** True once Embla has initialized its drag and navigation listeners. */
  const isCarouselReady = Boolean(api)

  const centeredIndex = Math.max(0, items.findIndex(({ id }) => id === centeredId))
  const centeredCanonicalId = items[centeredIndex]?.canonicalId ?? centeredId
  const centeredLogicalIndex = Math.max(
    0,
    logicalItems.findIndex(({ id }) => id === centeredCanonicalId),
  )
  const mountedIds = useMemo(
    () => getMountedAdaptiveCarouselItemIds(
      items,
      centeredId,
      visibleRadius,
      emblaLoop,
    ),
    [centeredId, emblaLoop, items, visibleRadius],
  )

  useEffect(() => {
    onCenteredItemChangeRef.current = options.onCenteredItemChange
  }, [options.onCenteredItemChange])

  const writeTransforms = useCallback(() => {
    if (!api) return
    const snaps = api.scrollSnapList()
    const current = api.scrollProgress()
    items.forEach((item, index) => {
      let difference = (snaps[index] ?? 0) - current
      if (emblaLoop && difference > 0.5) difference -= 1
      if (emblaLoop && difference < -0.5) difference += 1
      const physicalProgress = difference * Math.max(1, items.length - 1)
      const progress = getAdaptiveCarouselPresentationProgress(
        physicalProgress,
        logicalItems.length,
        bufferedLoop,
      )
      const variables = getAdaptiveCarouselPresentationVariables(
        presentation,
        surface,
        progress,
        visibleRadius === Number(tuning.visibleRadius)
          ? tuning
          : { ...tuning, visibleRadius },
        reducedMotion,
        items.length,
      )
      const element = itemElements.current.get(item.id)
      if (!element) return
      element.style.setProperty("--carousel-progress", String(progress))
      Object.entries(variables).forEach(([name, value]) => {
        element.style.setProperty(name, String(value))
      })
    })
  }, [
    api,
    bufferedLoop,
    emblaLoop,
    items,
    logicalItems.length,
    presentation,
    reducedMotion,
    surface,
    tuning,
    visibleRadius,
  ])

  const scheduleTransformWrite = useCallback(() => {
    if (frameRef.current !== null) return
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null
      writeTransforms()
    })
  }, [writeTransforms])

  useEffect(() => {
    if (!api) return
    const select = () => {
      const item = items[api.selectedScrollSnap()]
      setCenteredId(item?.id ?? null)
      setCanGoPrevious(effectiveLoop || api.canScrollPrev())
      setCanGoNext(effectiveLoop || api.canScrollNext())
      if (item?.loopClone) {
        const canonicalIndex = items.findIndex((candidate) => (
          !candidate.loopClone && candidate.id === item.canonicalId
        ))
        if (canonicalIndex >= 0) {
          api.scrollTo(canonicalIndex, true)
          return
        }
      }
      if (item) onCenteredItemChangeRef.current?.(item.canonicalId ?? item.id)
      scheduleTransformWrite()
    }
    select()
    api.on("select", select)
    api.on("reInit", select)
    api.on("scroll", scheduleTransformWrite)
    return () => {
      api.off("select", select)
      api.off("reInit", select)
      api.off("scroll", scheduleTransformWrite)
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current)
        frameRef.current = null
      }
    }
  }, [api, effectiveLoop, items, scheduleTransformWrite])

  useEffect(() => () => {
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current)
    itemElements.current.forEach((element) => element.removeAttribute("style"))
    itemElements.current.clear()
  }, [])

  useEffect(() => {
    if (!api) return
    const nextId = reconcileAdaptiveCarouselCenter(items, selectedItemId, null)
    const nextIndex = items.findIndex(({ id }) => id === nextId)
    if (
      selectedItemId
      && nextIndex >= 0
      && items[api.selectedScrollSnap()]?.id !== nextId
    ) {
      api.scrollTo(nextIndex)
    }
  }, [api, items, selectedItemId])

  const centerItem = useCallback((id: string, jump = false) => {
    const index = items.findIndex((item) => item.id === id)
    if (index >= 0) api?.scrollTo(index, jump)
  }, [api, items])

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault()
      api?.scrollPrev()
    }
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault()
      api?.scrollNext()
    }
    if (!effectiveLoop && event.key === "Home") {
      event.preventDefault()
      api?.scrollTo(0)
    }
    if (!effectiveLoop && event.key === "End") {
      event.preventDefault()
      api?.scrollTo(items.length - 1)
    }
  }, [api, effectiveLoop, items.length])

  return {
    viewportRef,
    isCarouselReady,
    centeredId,
    centeredIndex,
    mountedIds,
    effectiveLoop,
    canGoPrevious,
    canGoNext,
    centerItem,
    goPrevious: () => api?.scrollPrev(),
    goNext: () => api?.scrollNext(),
    handleKeyDown,
    registerItemElement(id: string, element: HTMLElement | null) {
      if (element) itemElements.current.set(id, element)
      else itemElements.current.delete(id)
    },
    statusText: centeredId
      ? `${items[centeredIndex]?.label ?? "Item"}, item ${centeredLogicalIndex + 1} of ${logicalItems.length}`
      : "No carousel items",
  }
}
