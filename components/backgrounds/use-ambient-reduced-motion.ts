import type { AmbientMotionMode } from "@/components/providers/settings-provider"
import {
  AMBIENT_REDUCED_MOTION_QUERY,
  useMediaQuery,
} from "@/components/backgrounds/use-media-query"
import { shouldReduceAmbientMotion } from "@/lib/motion-preferences"

/** Combines the OS media query with MassageLab's ambient-motion preference. */
export function useAmbientReducedMotion(ambientMotionMode: AmbientMotionMode) {
  // Conservatively suppress the hydration frame until the OS query resolves,
  // so a reduced-motion user never receives an animated first paint.
  const prefersReducedMotion = useMediaQuery(AMBIENT_REDUCED_MOTION_QUERY, true)

  return shouldReduceAmbientMotion({ prefersReducedMotion, ambientMotionMode })
}
