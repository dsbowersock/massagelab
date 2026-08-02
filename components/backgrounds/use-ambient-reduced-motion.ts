import type { AmbientMotionMode } from "@/components/providers/settings-provider"
import { useMediaQuery } from "@/components/backgrounds/use-media-query"
import { shouldReduceAmbientMotion } from "@/lib/motion-preferences"

/** Combines the OS media query with MassageLab's ambient-motion preference. */
export function useAmbientReducedMotion(ambientMotionMode: AmbientMotionMode) {
  const prefersReducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)")

  return shouldReduceAmbientMotion({ prefersReducedMotion, ambientMotionMode })
}
