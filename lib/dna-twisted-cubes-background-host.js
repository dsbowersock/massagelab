import { getDnaBackgroundOptionsFromChimerSettings } from "./dna-background.js"
import { getTwistedCubesBackgroundOptionsFromChimerSettings } from "./twisted-cubes-background.js"

const SUPPORTED_BACKGROUND_HOST_CATEGORIES = new Set([
  "chimer",
  "clock",
  "music",
  "ambient",
])

/**
 * Resolves the exact compact prop object consumed by the shared BackgroundHost
 * call. Keeping the category at this boundary makes every supported context
 * exercise the same option plumbing while still failing closed for unknown
 * callers.
 *
 * @param {{ settings: Record<string, unknown>, category: string }} input
 */
export function resolveDnaTwistedCubesBackgroundHostProps({ settings, category } = {}) {
  if (!SUPPORTED_BACKGROUND_HOST_CATEGORIES.has(category)) {
    throw new TypeError(`Unsupported background Host category: ${String(category)}`)
  }

  return {
    massageLabDna: getDnaBackgroundOptionsFromChimerSettings(settings),
    massageLabTwistedCubes: getTwistedCubesBackgroundOptionsFromChimerSettings(settings),
  }
}
