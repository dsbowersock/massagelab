"use client"

import { useEffect, useState } from "react"

export const BACKGROUND_COMPACT_VIEWPORT_QUERY = "(max-width: 479px), (max-height: 479px)"
export const AMBIENT_REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)"

/** Tracks one browser media query from an SSR-safe initial match value. */
export function useMediaQuery(query: string, initialMatches = false) {
  const [matches, setMatches] = useState(initialMatches)

  useEffect(() => {
    const mediaQuery = window.matchMedia(query)
    const handleChange = () => setMatches(mediaQuery.matches)

    handleChange()
    mediaQuery.addEventListener("change", handleChange)
    return () => mediaQuery.removeEventListener("change", handleChange)
  }, [query])

  return matches
}
