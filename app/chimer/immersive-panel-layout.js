const SAFE_STAGE_GAP_PX = 16
const MIN_DOCK_HEIGHT_PX = 144

const normalizeMeasurement = (value) => (
  Number.isFinite(value) ? Math.max(0, value) : 0
)

/**
 * Chooses a bottom dock whenever the protected display leaves enough room, then
 * falls back to the top. Cramped layouts reserve only the space that exists.
 *
 * @param {{viewportHeight: number, displayTop: number, displayBottom: number, panelHeight: number}} input
 * @returns {{edge: "bottom" | "top", reservedPx: number, maxPanelPx: number}}
 */
export function calculateDockPlacement({
  viewportHeight,
  displayTop,
  displayBottom,
  panelHeight,
}) {
  const normalizedViewportHeight = normalizeMeasurement(viewportHeight)
  const normalizedDisplayTop = Math.min(normalizeMeasurement(displayTop), normalizedViewportHeight)
  const normalizedDisplayBottom = Math.min(normalizeMeasurement(displayBottom), normalizedViewportHeight)
  const requestedPanelPx = Math.max(MIN_DOCK_HEIGHT_PX, normalizeMeasurement(panelHeight))
  const bottomSpace = Math.max(0, normalizedViewportHeight - normalizedDisplayBottom)

  if (bottomSpace >= requestedPanelPx + SAFE_STAGE_GAP_PX) {
    return {
      edge: "bottom",
      reservedPx: requestedPanelPx + SAFE_STAGE_GAP_PX,
      maxPanelPx: requestedPanelPx,
    }
  }

  const topSpace = normalizedDisplayTop
  if (topSpace >= requestedPanelPx + SAFE_STAGE_GAP_PX) {
    return {
      edge: "top",
      reservedPx: requestedPanelPx + SAFE_STAGE_GAP_PX,
      maxPanelPx: requestedPanelPx,
    }
  }

  const edge = bottomSpace >= topSpace ? "bottom" : "top"
  const remainingSpace = Math.max(bottomSpace, topSpace)
  const maxPanelPx = Math.max(0, remainingSpace - SAFE_STAGE_GAP_PX)
  return {
    edge,
    reservedPx: Math.min(remainingSpace, maxPanelPx + SAFE_STAGE_GAP_PX),
    maxPanelPx,
  }
}
