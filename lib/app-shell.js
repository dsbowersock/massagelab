// @ts-check

import { normalizeAppSettings } from "./app-settings.js"

/**
 * Keeps the drawer toggle and shared brand at the configured outer edge while
 * mirroring global tools toward the opposite edge.
 *
 * @param {unknown} value
 * @returns {{ drawerEdge: "left" | "right", edgeItemIds: string[], toolItemIds: string[] }}
 */
export function resolveMainBarLayout(value) {
  const settings = normalizeAppSettings(value)
  return settings.sidebarPosition === "right"
    ? {
        drawerEdge: "right",
        edgeItemIds: ["brand", "more"],
        toolItemIds: ["theme", "calendar", "quick-create", "clock", "music"],
      }
    : {
        drawerEdge: "left",
        edgeItemIds: ["more", "brand"],
        toolItemIds: ["music", "clock", "quick-create", "calendar", "theme"],
      }
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
