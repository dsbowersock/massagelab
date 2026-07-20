"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import useEmblaCarousel from "embla-carousel-react"
import {
  getMountedItemIds,
  getPresentationVariables,
  reconcileCenteredId,
  resolveEffectiveLoop,
} from "./carousel-lab-model"

export interface CarouselLabItem {
  id: string
  label: string
  disabled?: boolean
  statusLabel?: string
}

interface UseCarouselLabControllerOptions {
  items: readonly CarouselLabItem[]
  initialItemId?: string | null
  selectedItemId?: string | null
  surface: "backgrounds" | "stations"
  presentation: "existing" | "cover-flow" | "three-d"
  tuning: Record<string, number | boolean>
  reducedMotion: boolean
  onCenteredItemChange?: (itemId: string) => void
}

/**
 * Owns Embla navigation and writes presentation variables without coupling the
 * shared stage to either the background or station card implementations.
 */
export function useCarouselLabController(options: UseCarouselLabControllerOptions) {
  const { items, initialItemId, selectedItemId, surface, presentation, tuning, reducedMotion } = options
  const effectiveLoop = reducedMotion
    ? false
    : resolveEffectiveLoop(items.length, Number(tuning.visibleRadius), Boolean(tuning.loop))
  const [viewportRef, api] = useEmblaCarousel({
    align: "center",
    containScroll: effectiveLoop ? false : "trimSnaps",
    dragFree: false,
    loop: effectiveLoop,
    skipSnaps: false,
    duration: reducedMotion || tuning.motion === false ? 0 : 24,
  })
  const itemElements = useRef(new Map<string, HTMLElement>())
  const frameRef = useRef<number | null>(null)
  const onCenteredItemChangeRef = useRef(options.onCenteredItemChange)
  const [centeredId, setCenteredId] = useState<string | null>(() =>
    reconcileCenteredId(items, initialItemId, selectedItemId),
  )
  const [canGoPrevious, setCanGoPrevious] = useState(false)
  const [canGoNext, setCanGoNext] = useState(false)

  const centeredIndex = Math.max(0, items.findIndex(({ id }) => id === centeredId))
  const mountedIds = useMemo(
    () => getMountedItemIds(items, centeredId, Number(tuning.visibleRadius), effectiveLoop),
    [centeredId, effectiveLoop, items, tuning.visibleRadius],
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
      if (effectiveLoop && difference > 0.5) difference -= 1
      if (effectiveLoop && difference < -0.5) difference += 1
      const progress = difference * Math.max(1, items.length - 1)
      const variables = getPresentationVariables(presentation, surface, progress, tuning, reducedMotion)
      const element = itemElements.current.get(item.id)
      if (!element) return
      element.style.setProperty("--lab-progress", String(progress))
      Object.entries(variables).forEach(([name, value]) => element.style.setProperty(name, String(value)))
    })
  }, [api, effectiveLoop, items, presentation, reducedMotion, surface, tuning])

  // Embla can emit several scroll events per frame, so transform writes are coalesced.
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
      if (item) onCenteredItemChangeRef.current?.(item.id)
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
    }
  }, [api, effectiveLoop, items, scheduleTransformWrite])

  useEffect(() => () => {
    if (frameRef.current !== null) window.cancelAnimationFrame(frameRef.current)
    itemElements.current.forEach((element) => element.removeAttribute("style"))
    itemElements.current.clear()
  }, [])

  useEffect(() => {
    if (!api) return
    const nextId = reconcileCenteredId(items, centeredId, selectedItemId)
    const nextIndex = items.findIndex(({ id }) => id === nextId)
    if (nextIndex >= 0) api.scrollTo(nextIndex, true)
  }, [api, centeredId, items, selectedItemId])

  const centerItem = useCallback((id: string, jump = false) => {
    const index = items.findIndex((item) => item.id === id)
    if (index >= 0) api?.scrollTo(index, jump)
  }, [api, items])

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    if (event.key === "ArrowLeft") { event.preventDefault(); api?.scrollPrev() }
    if (event.key === "ArrowRight") { event.preventDefault(); api?.scrollNext() }
    if (!effectiveLoop && event.key === "Home") { event.preventDefault(); api?.scrollTo(0) }
    if (!effectiveLoop && event.key === "End") { event.preventDefault(); api?.scrollTo(items.length - 1) }
  }, [api, effectiveLoop, items.length])

  return {
    viewportRef,
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
      ? `${items[centeredIndex]?.label ?? "Item"}, item ${centeredIndex + 1} of ${items.length}`
      : "No carousel items",
  }
}
