// @ts-check

import { normalizeAppSettings } from "./app-settings.js"

export const mainBarItemIds = Object.freeze([
  "more",
  "music",
  "clock",
  "quick-create",
  "calendar",
  "home",
  "theme",
])

const leftDrawerMainBarItemIds = mainBarItemIds
const rightDrawerMainBarItemIds = Object.freeze([
  "theme",
  "home",
  "calendar",
  "quick-create",
  "clock",
  "music",
  "more",
])

/**
 * Orders persistent shell controls as edge-start, clustered tools, then edge-end.
 * The drawer toggle sits beside the chosen drawer edge and Theme mirrors it.
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
