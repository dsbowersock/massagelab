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

  return (
    <span
      key={prefersReducedMotion ? "reduced-motion" : word}
      data-testid="home-flip-word"
      className={cn(
        "inline-flex min-w-[8.5ch] justify-center text-primary motion-reduce:min-w-0",
        !prefersReducedMotion && "animate-[ml-flip-word-in_280ms_ease-out]",
        className,
      )}
    >
      {word}
    </span>
  )
}
