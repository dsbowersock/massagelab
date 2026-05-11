// @ts-check

export const defaultAppSettings = Object.freeze({
  sidebarPosition: "left",
  sidebarTriggerPosition: "top",
  themeMode: "dark",
})

/**
 * @typedef {"left" | "right"} SidebarPosition
 * @typedef {"top" | "bottom"} SidebarTriggerPosition
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
    sidebarTriggerPosition: source.sidebarTriggerPosition === "bottom" ? "bottom" : "top",
    themeMode: source.themeMode === "light" ? "light" : "dark",
  }
}
