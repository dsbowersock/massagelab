// @ts-check

export const SIDEBAR_PHONE_PORTRAIT_MAX_WIDTH = 600
export const SIDEBAR_COMPACT_LANDSCAPE_MAX_WIDTH = 1023
export const SIDEBAR_COMPACT_LANDSCAPE_MAX_HEIGHT = 520

/**
 * @typedef {"drawer" | "compact-rail" | "desktop"} SidebarRenderMode
 * @typedef {{ width: number, height: number }} SidebarViewport
 */

/**
 * @param {SidebarViewport} viewport
 * @returns {SidebarRenderMode}
 */
export function getSidebarRenderMode(viewport) {
  const width = Number(viewport.width) || 0
  const height = Number(viewport.height) || 0

  if (
    width <= SIDEBAR_COMPACT_LANDSCAPE_MAX_WIDTH
    && height <= SIDEBAR_COMPACT_LANDSCAPE_MAX_HEIGHT
    && width > height
  ) {
    return "compact-rail"
  }

  if (width <= SIDEBAR_PHONE_PORTRAIT_MAX_WIDTH && height > width) {
    return "drawer"
  }

  return "desktop"
}

/**
 * @param {{ renderMode?: unknown, state?: unknown }} sidebar
 * @returns {boolean}
 */
export function shouldExpandSidebarFromRail(sidebar) {
  return sidebar?.state === "collapsed" && sidebar?.renderMode !== "drawer"
}

/**
 * @param {{
 *   renderMode?: unknown,
 *   state?: unknown,
 *   targetInsideSidebar?: unknown,
 *   targetInsideSidebarPortal?: unknown,
 * }} sidebar
 * @returns {boolean}
 */
export function shouldCollapseSidebarFromOutsidePointer(sidebar) {
  return (
    sidebar?.state === "expanded"
    && sidebar?.renderMode !== "drawer"
    && sidebar?.targetInsideSidebar !== true
    && sidebar?.targetInsideSidebarPortal !== true
  )
}
