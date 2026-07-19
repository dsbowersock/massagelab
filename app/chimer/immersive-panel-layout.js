const SAFE_STAGE_GAP_PX = 16
const MIN_DOCK_HEIGHT_PX = 144

const normalizeMeasurement = (value) => (
  Number.isFinite(value) ? Math.max(0, value) : 0
)

const normalizeCoordinate = (value) => (
  Number.isFinite(value) ? value : 0
)

/**
 * Converts stable document-layout bounds into the visual viewport coordinate
 * system used by VisualViewport.height.
 *
 * @param {{layoutTop: number, layoutBottom: number, windowScrollY?: number, visualViewportOffsetTop?: number}} input
 * @returns {{top: number, bottom: number}}
 */
export function toVisualViewportBounds({
  layoutTop,
  layoutBottom,
  windowScrollY = 0,
  visualViewportOffsetTop = 0,
}) {
  const coordinateOffset = normalizeCoordinate(windowScrollY) + normalizeCoordinate(visualViewportOffsetTop)
  return {
    top: normalizeCoordinate(layoutTop) - coordinateOffset,
    bottom: normalizeCoordinate(layoutBottom) - coordinateOffset,
  }
}

/**
 * Chooses a bottom dock whenever the protected display leaves enough room, then
 * falls back to the top. Cramped layouts reserve only the space that exists.
 *
 * @param {{viewportHeight: number, displayTop: number, displayBottom: number, panelHeight: number, topInset?: number, bottomInset?: number}} input
 * @returns {{edge: "bottom" | "top", reservedPx: number, maxPanelPx: number}}
 */
export function calculateDockPlacement({
  viewportHeight,
  displayTop,
  displayBottom,
  panelHeight,
  topInset = 0,
  bottomInset = 0,
}) {
  const normalizedViewportHeight = normalizeMeasurement(viewportHeight)
  const normalizedDisplayTop = Math.min(normalizeMeasurement(displayTop), normalizedViewportHeight)
  const normalizedDisplayBottom = Math.min(normalizeMeasurement(displayBottom), normalizedViewportHeight)
  const requestedPanelPx = Math.max(MIN_DOCK_HEIGHT_PX, normalizeMeasurement(panelHeight))
  const normalizedTopInset = normalizeMeasurement(topInset)
  const normalizedBottomInset = normalizeMeasurement(bottomInset)
  const bottomSpace = Math.max(0, normalizedViewportHeight - normalizedDisplayBottom)

  if (bottomSpace >= requestedPanelPx + SAFE_STAGE_GAP_PX + normalizedBottomInset) {
    return {
      edge: "bottom",
      reservedPx: requestedPanelPx + SAFE_STAGE_GAP_PX + normalizedBottomInset,
      maxPanelPx: requestedPanelPx,
    }
  }

  const topSpace = normalizedDisplayTop
  if (topSpace >= requestedPanelPx + SAFE_STAGE_GAP_PX + normalizedTopInset) {
    return {
      edge: "top",
      reservedPx: requestedPanelPx + SAFE_STAGE_GAP_PX + normalizedTopInset,
      maxPanelPx: requestedPanelPx,
    }
  }

  const bottomUsableSpace = Math.max(0, bottomSpace - normalizedBottomInset)
  const topUsableSpace = Math.max(0, topSpace - normalizedTopInset)
  const edge = bottomUsableSpace >= topUsableSpace ? "bottom" : "top"
  const remainingSpace = edge === "bottom" ? bottomSpace : topSpace
  const edgeInset = edge === "bottom" ? normalizedBottomInset : normalizedTopInset
  const maxPanelPx = Math.max(0, remainingSpace - edgeInset - SAFE_STAGE_GAP_PX)
  return {
    edge,
    reservedPx: Math.min(remainingSpace, edgeInset + maxPanelPx + SAFE_STAGE_GAP_PX),
    maxPanelPx,
  }
}
