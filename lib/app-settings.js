// @ts-check

export const defaultAppSettings = Object.freeze({
  sidebarPosition: "left",
  sidebarTriggerPosition: "bottom",
  themeMode: "dark",
})

export const sidebarButtonPositions = Object.freeze([
  "top-left",
  "top-right",
  "bottom-left",
  "bottom-right",
])

/**
 * @typedef {"left" | "right"} SidebarPosition
 * @typedef {"top" | "bottom"} SidebarTriggerPosition
 * @typedef {"top-left" | "top-right" | "bottom-left" | "bottom-right"} SidebarButtonPosition
 * @typedef {"dark" | "light"} ThemeMode
 *
 * @typedef {Object} AppSettings
 * @property {SidebarPosition} sidebarPosition
 * @property {SidebarTriggerPosition} sidebarTriggerPosition
 * @property {ThemeMode} themeMode
 */

/**
 * @param {unknown} value
 * @returns {AppSettings}
 */
export function normalizeAppSettings(value) {
  if (!value || typeof value !== "object") {
    return { ...defaultAppSettings }
  }

  const source = /** @type {Partial<AppSettings>} */ (value)

  return {
    sidebarPosition: source.sidebarPosition === "right" ? "right" : "left",
    sidebarTriggerPosition: source.sidebarTriggerPosition === "top" ? "top" : "bottom",
    themeMode: source.themeMode === "light" ? "light" : "dark",
  }
}

/**
 * @param {unknown} value
 * @returns {SidebarButtonPosition}
 */
export function getSidebarButtonPosition(value) {
  const settings = normalizeAppSettings(value)
  return `${settings.sidebarTriggerPosition}-${settings.sidebarPosition}`
}

/**
 * @param {unknown} value
 * @returns {{ sidebarPosition: SidebarPosition, sidebarTriggerPosition: SidebarTriggerPosition }}
 */
export function resolveSidebarButtonSettings(value) {
  switch (value) {
    case "top-right":
      return { sidebarPosition: "right", sidebarTriggerPosition: "top" }
    case "bottom-left":
      return { sidebarPosition: "left", sidebarTriggerPosition: "bottom" }
    case "bottom-right":
      return { sidebarPosition: "right", sidebarTriggerPosition: "bottom" }
    case "top-left":
      return { sidebarPosition: "left", sidebarTriggerPosition: "top" }
    default:
      return { sidebarPosition: "left", sidebarTriggerPosition: "bottom" }
  }
}
