// @ts-check

import { normalizeAppSettings } from "./app-settings.js"

/**
 * The global tool sequence stays stable when the drawer or app bar moves so
 * responsive layout changes do not retrain muscle memory.
 */
export const MAIN_BAR_TOOL_ITEM_IDS = Object.freeze(/** @type {const} */ ([
  "quick-create",
  "music",
  "clock",
  "calendar",
  "theme",
]))

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
        toolItemIds: [...MAIN_BAR_TOOL_ITEM_IDS],
      }
    : {
        drawerEdge: "left",
        edgeItemIds: ["more", "brand"],
        toolItemIds: [...MAIN_BAR_TOOL_ITEM_IDS],
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
