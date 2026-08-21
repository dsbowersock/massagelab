// @ts-check

import {
  ATMOSHAPER_EXCLUSIVE_KINDS,
  addAtmoShaperLayer,
  createAtmoShaperRecipe,
  removeAtmoShaperLayer,
} from "../../lib/atmoshaper/recipe.js"

/** @typedef {import("../../lib/atmoshaper/recipe.js").AtmoShaperLayer} AtmoShaperLayer */
/** @typedef {import("../../lib/atmoshaper/recipe.js").AtmoShaperRecipe} AtmoShaperRecipe */
/** @typedef {{ key: string, layer: AtmoShaperLayer, retained: boolean }} AtmoShaperVisibleRow */

/**
 * Reuses the provider-owned live recipe on a conditional workspace remount.
 * A new id is allocated only when there is no retained AtmoShaper owner.
 *
 * @param {{ activePlaybackKind: "station" | "atmoshaper" | null, retainedRecipe: AtmoShaperRecipe | null, createId: () => string }} input
 */
export function initializeAtmoShaperWorkspaceRecipe({
  activePlaybackKind,
  retainedRecipe,
  createId,
}) {
  if (activePlaybackKind === "atmoshaper" && retainedRecipe) return retainedRecipe
  return createAtmoShaperRecipe({ id: createId() })
}

/**
 * Prevents a locally initialized or edited recipe from mutating a different
 * live AtmoShaper owner. Explicit Play transfers provider ownership first.
 *
 * @param {{ activePlaybackKind: "station" | "atmoshaper" | null, localRecipeId: string, providerRecipeId: string | null }} input
 */
export function shouldSyncAtmoShaperWorkspaceRecipe({
  activePlaybackKind,
  localRecipeId,
  providerRecipeId,
}) {
  return activePlaybackKind !== "atmoshaper" || providerRecipeId === localRecipeId
}

/**
 * Chooses transport without pausing or restarting a foreign active mix.
 *
 * @param {{ activePlaybackKind: "station" | "atmoshaper" | null, localRecipeId: string, playbackState: string, providerRecipeId: string | null }} input
 * @returns {"pause" | "restart" | "play"}
 */
export function atmoShaperWorkspaceTransportAction({
  activePlaybackKind,
  localRecipeId,
  playbackState,
  providerRecipeId,
}) {
  const providerOwnsRecipe = activePlaybackKind === "atmoshaper"
    && providerRecipeId === localRecipeId
  if (!providerOwnsRecipe) return "play"
  return playbackState === "playing" ? "pause" : "restart"
}

/**
 * Finds runtime-active sources whose exact identity is no longer represented
 * by this workspace's current recipe. Foreign and stale provider snapshots
 * must not introduce rows into a recipe they do not own.
 *
 * @param {{ activePlaybackKind: "station" | "atmoshaper" | null, activeLayers: Record<string, AtmoShaperLayer>, localRecipe: AtmoShaperRecipe, providerRecipeId: string | null }} input
 */
export function projectRetainedAtmoShaperLayersForWorkspace({
  activePlaybackKind,
  activeLayers,
  localRecipe,
  providerRecipeId,
}) {
  if (activePlaybackKind !== "atmoshaper" || providerRecipeId !== localRecipe.id) return []
  const desiredLayers = localRecipe.layers
  return Object.values(activeLayers).filter((activeLayer) => {
    const desiredLayer = desiredLayers.find(({ id }) => id === activeLayer.id)
    return !desiredLayer
      || desiredLayer.kind !== activeLayer.kind
      || desiredLayer.sourceId !== activeLayer.sourceId
  })
}

/**
 * Makes a retained predecessor canonical again before applying one of its UI
 * controls. The recipe domain removes the failed desired exclusive layer.
 *
 * @param {AtmoShaperRecipe} recipe
 * @param {AtmoShaperLayer} retainedLayer
 * @param {Partial<AtmoShaperLayer>} patch
 */
export function restoreRetainedAtmoShaperLayer(recipe, retainedLayer, patch) {
  return addAtmoShaperLayer(recipe, {
    ...retainedLayer,
    ...patch,
    id: retainedLayer.id,
    kind: retainedLayer.kind,
  })
}

/**
 * Removes the failed desired exclusive layer with its retained predecessor so
 * the next controller reconciliation has one unambiguous disposal request.
 *
 * @param {AtmoShaperRecipe} recipe
 * @param {AtmoShaperLayer} retainedLayer
 */
export function removeRetainedAtmoShaperLayer(recipe, retainedLayer) {
  let nextRecipe = recipe
  if (ATMOSHAPER_EXCLUSIVE_KINDS.has(retainedLayer.kind)) {
    for (const layer of recipe.layers) {
      if (layer.kind === retainedLayer.kind) {
        nextRecipe = removeAtmoShaperLayer(nextRecipe, layer.id)
      }
    }
    return nextRecipe
  }
  return removeAtmoShaperLayer(nextRecipe, retainedLayer.id)
}

/**
 * Returns the stable row to focus after removal: next, then previous, with a
 * null result directing the component to its Current Mix heading.
 *
 * @param {string[]} rowIds
 * @param {string} removedId
 * @param {string[]} [alsoRemovedIds]
 * @returns {string | null}
 */
export function focusTargetAfterAtmoShaperLayerRemoval(rowIds, removedId, alsoRemovedIds = []) {
  const removedIndex = rowIds.indexOf(removedId)
  if (removedIndex === -1) return null
  const removedIds = new Set([removedId, ...alsoRemovedIds])
  for (let index = removedIndex + 1; index < rowIds.length; index += 1) {
    if (!removedIds.has(rowIds[index])) return rowIds[index]
  }
  for (let index = removedIndex - 1; index >= 0; index -= 1) {
    if (!removedIds.has(rowIds[index])) return rowIds[index]
  }
  return null
}

/**
 * Excludes both members of a failed exclusive replacement when either Remove
 * action will cause reconciliation to remove the pair.
 *
 * @param {AtmoShaperVisibleRow[]} rows
 * @param {string} removedKey
 */
export function focusTargetAfterAtmoShaperVisibleRowRemoval(rows, removedKey) {
  const removedRow = rows.find(({ key }) => key === removedKey)
  if (!removedRow) return null
  const coupledRemovalKeys = ATMOSHAPER_EXCLUSIVE_KINDS.has(removedRow.layer.kind)
    ? rows
        .filter((candidate) => (
          candidate.key !== removedKey
          && candidate.retained !== removedRow.retained
          && candidate.layer.kind === removedRow.layer.kind
        ))
        .map(({ key }) => key)
    : []
  return focusTargetAfterAtmoShaperLayerRemoval(
    rows.map(({ key }) => key),
    removedKey,
    coupledRemovalKeys,
  )
}
