"use client"

import { type PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from "react"
import { BookOpen, Brain, ShieldCheck } from "lucide-react"
import { AppSurface } from "@/components/ui/app-surface"
import { cn } from "@/lib/utils"

const FLASHCARD_DETAIL_INTERVAL_MS = 5600
const FLASHCARD_DETAIL_SWIPE_THRESHOLD_PX = 42

const flashcardDetails = [
  {
    title: "Reviewed anatomy source set",
    description: "Cards are generated from the same sourced anatomy study adapter used by Anatomime.",
    icon: ShieldCheck,
  },
  {
    title: "Massage-friendly prompt modes",
    description: "Study image identification, names, regions, categories, and muscle action/attachment prompts.",
    icon: BookOpen,
  },
  {
    title: "Saved progress when signed in",
    description: "Practice anonymously, then create an account when you want mastery and deck templates to persist.",
    icon: Brain,
  },
] as const

export function FlashcardDetailsCarousel() {
  const [activeIndex, setActiveIndex] = useState(0)
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null)
  const activeDetail = flashcardDetails[activeIndex] ?? flashcardDetails[0]
  const ActiveIcon = activeDetail.icon

  const moveCarousel = useCallback((direction: 1 | -1) => {
    setActiveIndex((current) => (current + direction + flashcardDetails.length) % flashcardDetails.length)
  }, [])

  useEffect(() => {
    // Reset the autoplay delay after dot taps or swipe navigation.
    const intervalId = window.setInterval(() => {
      moveCarousel(1)
    }, FLASHCARD_DETAIL_INTERVAL_MS)

    return () => window.clearInterval(intervalId)
  }, [activeIndex, moveCarousel])

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === "mouse") {
      return
    }

    swipeStartRef.current = {
      x: event.clientX,
      y: event.clientY,
    }
  }, [])

  const handlePointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const swipeStart = swipeStartRef.current
    swipeStartRef.current = null
    if (!swipeStart) {
      return
    }

    const deltaX = event.clientX - swipeStart.x
    const deltaY = event.clientY - swipeStart.y
    const isHorizontalSwipe =
      Math.abs(deltaX) >= FLASHCARD_DETAIL_SWIPE_THRESHOLD_PX
      && Math.abs(deltaX) > Math.abs(deltaY) * 1.35

    if (!isHorizontalSwipe) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    moveCarousel(deltaX > 0 ? -1 : 1)
  }, [moveCarousel])

  const handlePointerCancel = useCallback(() => {
    swipeStartRef.current = null
  }, [])

  return (
    <section className="mx-auto w-full max-w-7xl p-4 pt-4 sm:p-6 sm:pt-4 lg:p-8 lg:pt-4" aria-label="Flashcard details">
      <div
        className="overflow-hidden rounded-lg"
        style={{ touchAction: "pan-y" }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerCancel}
      >
        <AppSurface
          key={activeDetail.title}
          title={activeDetail.title}
          description={activeDetail.description}
          icon={<ActiveIcon className="h-5 w-5" aria-hidden="true" />}
          className="ml-info-carousel-slide min-h-[12.5rem]"
        />
      </div>
      <div className="mt-3 flex justify-center gap-2" aria-label="Flashcard detail slides">
        {flashcardDetails.map((detail, index) => (
          <button
            key={detail.title}
            type="button"
            aria-current={index === activeIndex}
            aria-label={`Flashcard detail slide ${index + 1}`}
            className={cn(
              "h-2.5 w-2.5 rounded-full border border-primary/70 transition",
              index === activeIndex ? "bg-primary shadow-[0_0_10px_hsl(var(--primary)/0.35)]" : "bg-muted/40"
            )}
            onClick={() => setActiveIndex(index)}
          />
        ))}
      </div>
    </section>
  )
}
