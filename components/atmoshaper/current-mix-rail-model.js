/**
 * @typedef {{ id: string, muted: boolean }} AtmoShaperMuteLayer
 */

/**
 * Capture the exact mute pattern before entering transient solo mode so leaving
 * solo can restore the listener's mix rather than unmuting every layer.
 *
 * @param {readonly AtmoShaperMuteLayer[]} layers
 * @returns {Record<string, boolean>}
 */
export function captureAtmoShaperMuteSnapshot(layers) {
  return Object.fromEntries(layers.map((layer) => [layer.id, layer.muted]))
}

/**
 * Resolve the collapsed rail's reversible solo gesture. Solo remains a UI
 * convenience built from the recipe's existing mute controls; it does not add
 * a persisted audio-engine state or a second source of playback truth.
 *
 * @param {{
 *   activeSoloLayerId: string | null,
 *   layers: readonly AtmoShaperMuteLayer[],
 *   layerId: string,
 *   muteSnapshot: Record<string, boolean> | null,
 * }} input
 * @returns {{
 *   activeSoloLayerId: string | null,
 *   muteSnapshot: Record<string, boolean> | null,
 *   mutedByLayerId: Record<string, boolean>,
 * }}
 */
export function resolveAtmoShaperSoloToggle({
  activeSoloLayerId,
  layers,
  layerId,
  muteSnapshot,
}) {
  const retainedSnapshot = muteSnapshot ?? captureAtmoShaperMuteSnapshot(layers)

  if (activeSoloLayerId === layerId) {
    return {
      activeSoloLayerId: null,
      muteSnapshot: null,
      mutedByLayerId: Object.fromEntries(layers.map((layer) => [
        layer.id,
        retainedSnapshot[layer.id] ?? layer.muted,
      ])),
    }
  }

  return {
    activeSoloLayerId: layerId,
    muteSnapshot: retainedSnapshot,
    mutedByLayerId: Object.fromEntries(layers.map((layer) => [layer.id, layer.id !== layerId])),
  }
}
