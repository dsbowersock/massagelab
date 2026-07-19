"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/utils"

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    setPrefersReducedMotion(query.matches)

    const updatePreference = () => setPrefersReducedMotion(query.matches)
    query.addEventListener("change", updatePreference)
    return () => query.removeEventListener("change", updatePreference)
  }, [])

  return prefersReducedMotion
}

export function FlipWords({
  words,
  duration = 3000,
  className,
}: {
  words: string[]
  duration?: number
  className?: string
}) {
  const prefersReducedMotion = usePrefersReducedMotion()
  const safeWords = words.length > 0 ? words : [""]
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (prefersReducedMotion || safeWords.length <= 1) {
      setIndex(0)
      return undefined
    }

    const intervalId = window.setInterval(() => {
      setIndex((current) => (current + 1) % safeWords.length)
    }, duration)

    return () => window.clearInterval(intervalId)
  }, [duration, prefersReducedMotion, safeWords.length])

  const word = safeWords[index] ?? safeWords[0]

  /**
   * Invisible phrases share the active word's grid cell, so the browser
   * reserves the widest rendered option in the actual headline font. Only the
   * keyed active phrase reaches the accessibility tree or animates.
   */
  return (
    <span
      data-testid="home-flip-word-slot"
      className={cn(
        "inline-grid justify-items-center overflow-hidden align-baseline [perspective:900px]",
        className,
      )}
    >
      {safeWords.map((candidate) => (
        <span
          key={`flip-word-sizer-${candidate}`}
          aria-hidden="true"
          className="invisible col-start-1 row-start-1 whitespace-nowrap"
        >
          {candidate}
        </span>
      ))}
      <span
        key={prefersReducedMotion ? "reduced-motion" : word}
        data-testid="home-flip-word"
        className={cn(
          "ml-home-flip-word col-start-1 row-start-1 inline-flex justify-self-center whitespace-nowrap text-primary [backface-visibility:hidden] [transform-style:preserve-3d]",
          !prefersReducedMotion && "animate-[ml-flip-word-in_520ms_cubic-bezier(0.2,0.8,0.2,1)]",
        )}
      >
        {word}
      </span>
    </span>
  )
}
