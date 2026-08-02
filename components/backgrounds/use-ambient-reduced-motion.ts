"use client"

import { useEffect, useState } from "react"
import type { AmbientMotionMode } from "@/components/providers/settings-provider"
import { shouldReduceAmbientMotion } from "@/lib/motion-preferences"

/** Combines the OS media query with MassageLab's ambient-motion preference. */
export function useAmbientReducedMotion(ambientMotionMode: AmbientMotionMode) {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)")
    const handleChange = () => setPrefersReducedMotion(query.matches)

    handleChange()
    query.addEventListener("change", handleChange)
    return () => query.removeEventListener("change", handleChange)
  }, [])

  return shouldReduceAmbientMotion({ prefersReducedMotion, ambientMotionMode })
}
