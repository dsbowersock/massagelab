// @ts-check

export const defaultAppSettings = Object.freeze({
  appBarPosition: "bottom",
  sidebarPosition: "left",
  sidebarTriggerPosition: "bottom",
  ambientMotionMode: "system",
  themeMode: "dark",
  hapticFeedbackEnabled: true,
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
 * @typedef {"top" | "bottom"} AppBarPosition
 * @typedef {"top-left" | "top-right" | "bottom-left" | "bottom-right"} SidebarButtonPosition
 * @typedef {"top" | "bottom"} AudioPlayerToolbarPlacement
 * @typedef {"dark" | "light" | "system"} ThemeMode
 * @typedef {"system" | "reduced"} AmbientMotionMode
 * @typedef {boolean} HapticFeedbackEnabled
 *
 * @typedef {Object} AppSettings
 * @property {AppBarPosition} appBarPosition
 * @property {SidebarPosition} sidebarPosition
 * @property {SidebarTriggerPosition} sidebarTriggerPosition
 * @property {AmbientMotionMode} ambientMotionMode
 * @property {ThemeMode} themeMode
 * @property {HapticFeedbackEnabled} hapticFeedbackEnabled
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
    appBarPosition: source.appBarPosition === "top" ? "top" : "bottom",
    sidebarPosition: source.sidebarPosition === "right" ? "right" : "left",
    sidebarTriggerPosition: source.sidebarTriggerPosition === "top" ? "top" : "bottom",
    ambientMotionMode: source.ambientMotionMode === "reduced" ? "reduced" : "system",
    themeMode: source.themeMode === "light" || source.themeMode === "system" ? source.themeMode : "dark",
    hapticFeedbackEnabled: source.hapticFeedbackEnabled !== false,
  }
}

/**
 * The music player stays on the bottom edge. When the main app bar is also at
 * the bottom, CSS stacks the player above the bar for a YouTube Music-style
 * playback layout.
 *
 * @param {unknown} value
 * @returns {AudioPlayerToolbarPlacement}
 */
export function getAudioPlayerToolbarPlacement(value) {
  void value
  return "bottom"
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
