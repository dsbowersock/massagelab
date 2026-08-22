// @ts-check

/** @typedef {import("../../lib/atmoshaper/recipe.js").AtmoShaperLayer} AtmoShaperLayer */
/** @typedef {import("../../lib/atmoshaper/recipe.js").AtmoShaperRecipe} AtmoShaperRecipe */
/** @typedef {{ layer: AtmoShaperLayer, status: "loading" | "playing" | "paused" | "failed", error?: string } | null} AtmoShaperPreview */
/** @typedef {"commit" | "select-existing" | "rail"} AtmoShaperLayerSelectionReason */
/** @typedef {{ layerId: string, requestKey: number, opener: HTMLElement | null, reason: AtmoShaperLayerSelectionReason }} AtmoShaperLayerSelectionRequest */
/** @typedef {{ status: "promoted" } | { status: "failed", error: string } | { status: "superseded" }} AtmoShaperPromotionResult */
/** @typedef {{ generation: number, sourceKey: string, sourceName: string, priorRecipe: AtmoShaperRecipe, optimisticRecipe: AtmoShaperRecipe }} SoundLibraryPendingCommit */
/** @typedef {{ sourceKey: string, sourceName: string, status: "loading" | "playing" | "paused" | "failed" }} SoundLibraryPreviewAnnouncementState */

/**
 * Creates a distinct focus/open request even when the requested layer remains
 * unchanged. Task 4 can reuse the same epoch when rail and drawer selection
 * replace the temporary desktop/Sheet editor boundary.
 *
 * @param {AtmoShaperLayerSelectionRequest | null} previousRequest
 * @param {string} layerId
 * @param {{ opener?: HTMLElement | null, reason?: AtmoShaperLayerSelectionReason }} [options]
 * @returns {AtmoShaperLayerSelectionRequest}
 */
export function createAtmoShaperLayerSelectionRequest(previousRequest, layerId, options = {}) {
  return {
    layerId,
    requestKey: (previousRequest?.requestKey ?? 0) + 1,
    opener: options.opener ?? null,
    reason: options.reason ?? "commit",
  }
}

/**
 * Starts one source-keyed commit unless that exact source is already pending.
 * Other source keys remain eligible so provider lease rules retain ownership.
 *
 * @param {SoundLibraryPendingCommit[]} pendingTransactions
 * @param {SoundLibraryPendingCommit} transaction
 */
export function beginSoundLibraryPendingCommit(pendingTransactions, transaction) {
  if (pendingTransactions.some(({ sourceKey }) => sourceKey === transaction.sourceKey)) {
    return { status: "ignored", pendingTransactions }
  }
  return {
    status: "started",
    transaction,
    pendingTransactions: [...pendingTransactions, transaction],
  }
}

/**
 * Removes only the exact settled generation. A stale completion therefore
 * cannot clear a newer transaction, even when both use the same source key.
 *
 * @param {SoundLibraryPendingCommit[]} pendingTransactions
 * @param {number} generation
 */
export function settleSoundLibraryPendingCommit(pendingTransactions, generation) {
  const owned = pendingTransactions.some((transaction) => transaction.generation === generation)
  return {
    owned,
    pendingTransactions: owned
      ? pendingTransactions.filter((transaction) => transaction.generation !== generation)
      : pendingTransactions,
  }
}

/** @param {SoundLibraryPendingCommit[]} pendingTransactions @param {string} sourceKey */
export function soundLibraryCommitIsPending(pendingTransactions, sourceKey) {
  return pendingTransactions.some((transaction) => transaction.sourceKey === sourceKey)
}

/**
 * Decides whether an optimistic recipe can be safely restored after provider
 * settlement. Intervening user edits are retained and receive a recoverable
 * announcement instead of being overwritten wholesale. Failed outcomes also
 * advance UI sync once because provider rollback may restore the same recipe
 * id without changing the hook's ordinary recipe dependency.
 *
 * @param {AtmoShaperRecipe} currentRecipe
 * @param {SoundLibraryPendingCommit} transaction
 * @param {AtmoShaperPromotionResult} settlement
 */
export function resolveSoundLibraryPromotionSettlement(currentRecipe, transaction, settlement) {
  if (settlement.status === "promoted") {
    return {
      type: "keep",
      recipe: currentRecipe,
      announcement: `${transaction.sourceName} added.`,
      syncRevisionDelta: 0,
    }
  }

  const canRestorePriorRecipe = soundLibraryRecipesEqual(
    currentRecipe,
    transaction.optimisticRecipe,
  )
  if (canRestorePriorRecipe) {
    return {
      type: "rollback",
      recipe: transaction.priorRecipe,
      announcement: settlement.status === "failed"
        ? `${transaction.sourceName} preview could not be added: ${settlement.error}`
        : null,
      syncRevisionDelta: settlement.status === "failed" ? 1 : 0,
    }
  }

  return {
    type: "retain",
    recipe: currentRecipe,
    announcement: settlement.status === "failed"
      ? `${transaction.sourceName} preview could not finish adding: ${settlement.error} Your other mix edits were kept and are being applied normally.`
      : `${transaction.sourceName} changed before it finished adding. Your current mix edits were kept.`,
    syncRevisionDelta: settlement.status === "failed" ? 1 : 0,
  }
}

/** @param {AtmoShaperRecipe} left @param {AtmoShaperRecipe} right */
export function soundLibraryRecipesEqual(left, right) {
  return stablePlainData(left) === stablePlainData(right)
}

/**
 * Deduplicates preview lifecycle announcements by source configuration and
 * status, leaving preview-volume changes silent.
 *
 * @param {SoundLibraryPreviewAnnouncementState | null} previousState
 * @param {AtmoShaperPreview} preview
 * @param {string | null} sourceName
 */
export function resolveSoundLibraryPreviewAnnouncement(previousState, preview, sourceName) {
  if (!preview) {
    return {
      state: null,
      message: previousState ? `${previousState.sourceName} preview stopped.` : null,
    }
  }

  const nextState = {
    sourceKey: getAtmoShaperSourceConfigurationKey(preview.layer),
    sourceName: sourceName ?? "Sound",
    status: preview.status,
  }
  if (
    previousState?.sourceKey === nextState.sourceKey
    && previousState.status === nextState.status
  ) {
    return { state: nextState, message: null }
  }
  return {
    state: nextState,
    message: preview.status === "failed"
      ? `${nextState.sourceName} preview failed: ${preview.error ?? "This preview could not start."}`
      : `${nextState.sourceName} preview ${preview.status}.`,
  }
}

/**
 * Builds one deterministic library candidate. Its id is stable for the same
 * source configuration so Preview and Add can share an adoptable identity.
 * Preview volume is deliberately excluded because it is an audition control,
 * not part of the source configuration.
 *
 * @param {Omit<AtmoShaperLayer, "id">} input
 * @returns {AtmoShaperLayer}
 */
export function createSoundLibraryCandidateLayer(input) {
  const layer = {
    kind: input.kind,
    sourceId: input.sourceId,
    volume: input.volume,
    muted: input.muted,
    settings: clonePlainData(input.settings),
  }
  const key = getAtmoShaperSourceConfigurationKey(layer)
  return {
    id: `library:${layer.kind}:${hashStableKey(key)}`,
    ...layer,
  }
}

/**
 * Produces the comparison identity used by cards, previews, and committed
 * layers. Layer ids, volume, and mute state are intentionally presentation or
 * runtime state and therefore do not create another logical library source.
 *
 * @param {Pick<AtmoShaperLayer, "kind" | "sourceId" | "settings">} layer
 */
export function getAtmoShaperSourceConfigurationKey(layer) {
  return `${layer.kind}\u0000${layer.sourceId}\u0000${stablePlainData(layer.settings)}`
}

/** @param {AtmoShaperPreview} preview @param {AtmoShaperLayer} candidate */
export function atmoShaperPreviewMatchesCandidate(preview, candidate) {
  return Boolean(
    preview
    && getAtmoShaperSourceConfigurationKey(preview.layer)
      === getAtmoShaperSourceConfigurationKey(candidate),
  )
}

/**
 * Selects an exact committed source instead of creating a duplicate. Exclusive
 * sources with different settings remain commits so the recipe domain helper
 * can perform its existing replacement behavior.
 *
 * @param {AtmoShaperRecipe} recipe
 * @param {AtmoShaperLayer} layer
 * @returns {{ type: "select-existing", layerId: string } | { type: "commit", layer: AtmoShaperLayer }}
 */
export function resolveSoundLibraryCommit(recipe, layer) {
  const sourceKey = getAtmoShaperSourceConfigurationKey(layer)
  const existingLayer = recipe.layers.find((candidate) => (
    getAtmoShaperSourceConfigurationKey(candidate) === sourceKey
  ))
  return existingLayer
    ? { type: "select-existing", layerId: existingLayer.id }
    : { type: "commit", layer }
}

/** @param {unknown} value @returns {any} */
function clonePlainData(value) {
  if (Array.isArray(value)) return value.map(clonePlainData)
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, clonePlainData(entry)]))
  }
  return value
}

/** @param {unknown} value @returns {string} */
function stablePlainData(value) {
  if (Array.isArray(value)) return `[${value.map(stablePlainData).join(",")}]`
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stablePlainData(entry)}`)
      .join(",")}}`
  }
  return JSON.stringify(value) ?? String(value)
}

/** FNV-1a supplies a compact deterministic DOM-safe identity. @param {string} value */
function hashStableKey(value) {
  let hash = 0x811c9dc5
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(36)
}
