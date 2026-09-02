// @ts-check

import { normalizeAppSettings } from "./app-settings.js"
import { normalizeMusicVisualizerAccountPreferences } from "./music-visualizer.js"

/**
 * Projects stored account settings into the only fields safe for global shell
 * hydration. Raw settings and unrelated account or clinical data never cross
 * this boundary.
 *
 * @param {unknown} value
 */
export function projectAccountShellAppSettings(value) {
  const source = /** @type {Record<string, unknown>} */ (
    value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {}
  )

  return {
    app: normalizeAppSettings(source),
    musicVisualizer: normalizeMusicVisualizerAccountPreferences(source.musicVisualizer),
  }
}
