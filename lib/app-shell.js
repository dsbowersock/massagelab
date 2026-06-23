// @ts-check

import { normalizeAppSettings } from "./app-settings.js"

export const mainBarItemIds = Object.freeze([
  "home",
  "music",
  "clock",
  "quick-create",
  "theme",
  "calendar",
  "more",
])

const leftDrawerMainBarItemIds = mainBarItemIds
const rightDrawerMainBarItemIds = Object.freeze([
  "more",
  "music",
  "clock",
  "quick-create",
  "theme",
  "calendar",
  "home",
])

/**
 * Orders persistent shell controls so the More drawer trigger sits closest to
 * the configured drawer side while Home remains available at the opposite edge.
 *
 * @param {unknown} value
 * @returns {string[]}
 */
export function resolveMainBarItemOrder(value) {
  const settings = normalizeAppSettings(value)
  return [...(settings.sidebarPosition === "right" ? rightDrawerMainBarItemIds : leftDrawerMainBarItemIds)]
}

/**
 * Music controls stay bottom-based so active playback stacks with the mobile
 * main bar instead of jumping to the opposite edge.
 *
 * @param {unknown} value
 * @returns {"bottom"}
 */
export function getMusicPlayerPlacement(value) {
  void value
  return "bottom"
}
