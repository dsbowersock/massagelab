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
    if (prefersReducedMotion || safeWords.length <= 1) return undefined

    const intervalId = window.setInterval(() => {
      setIndex((current) => (current + 1) % safeWords.length)
    }, duration)

    return () => window.clearInterval(intervalId)
  }, [duration, prefersReducedMotion, safeWords.length])

  const word = safeWords[index] ?? safeWords[0]

  /**
   * The outer span keeps the headline width stable while the keyed inner span
   * remounts for the flip animation. Reduced-motion visitors keep the first
   * word without a timer so the headline does not keep changing.
   */
  return (
    <span
      className={cn(
        "inline-grid min-w-[8.5ch] justify-center overflow-hidden align-baseline [perspective:900px] motion-reduce:min-w-0",
        className,
      )}
    >
      <span
        key={prefersReducedMotion ? "reduced-motion" : word}
        data-testid="home-flip-word"
        className={cn(
          "inline-flex justify-center text-primary [backface-visibility:hidden] [transform-style:preserve-3d]",
          !prefersReducedMotion && "animate-[ml-flip-word-in_520ms_cubic-bezier(0.2,0.8,0.2,1)]",
        )}
      >
        {word}
      </span>
    </span>
  )
}
