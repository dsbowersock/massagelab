import type { AtmoShaperLayer, AtmoShaperRecipe } from "./recipe.js"

export type AtmoShaperProviderCommandResult<T> =
  | { status: "executed", value: T }
  | { status: "superseded" }

export type AtmoShaperPromotionAdoptionReceipt = {
  runtimeLease: number
  layer: AtmoShaperLayer
}

type AtmoShaperProviderRuntimeSnapshot = {
  recipe: AtmoShaperRecipe | null
  activeLayers: Record<string, AtmoShaperLayer>
  preview: {
    layer: AtmoShaperLayer
    status: "loading" | "playing" | "paused" | "failed"
  } | null
}

type AtmoShaperPromotionRuntime<TSnapshot extends AtmoShaperProviderRuntimeSnapshot> = {
  getSnapshot: () => TSnapshot
  promotePreview: (recipe: AtmoShaperRecipe) => Promise<void>
  applyRecipe: (recipe: AtmoShaperRecipe) => Promise<void>
}

type AtmoShaperProviderCommand<T> = {
  /** Rechecked only after all older runtime mutations have settled. */
  isCurrent: () => boolean
  execute: () => Promise<T>
}

/**
 * Serializes provider-issued runtime mutations without owning audio, playback
 * lifecycle, or Media Session state. Callers retain all admission decisions.
 */
export function createAtmoShaperProviderCommandGate() {
  let tail: Promise<void> = Promise.resolve()

  return {
    run<T>({ isCurrent, execute }: AtmoShaperProviderCommand<T>) {
      const result = tail.then(async (): Promise<AtmoShaperProviderCommandResult<T>> => {
        if (!isCurrent()) return { status: "superseded" }
        return { status: "executed", value: await execute() }
      })
      tail = result.then(() => undefined, () => undefined)
      return result
    },
  }
}

/**
 * Adopts a live preview once, or safely reconciles a newer serialized command
 * against the receipt proving that an older command adopted that exact source.
 */
export async function executeAtmoShaperPromotionCommand<
  TSnapshot extends AtmoShaperProviderRuntimeSnapshot,
>(options: {
  runtime: AtmoShaperPromotionRuntime<TSnapshot>
  runtimeLease: number
  previewLayer: AtmoShaperLayer
  desiredRecipe: AtmoShaperRecipe
  priorReceipt: AtmoShaperPromotionAdoptionReceipt | null
}) {
  const { runtime, runtimeLease, previewLayer, desiredRecipe } = options
  const beforeSnapshot = runtime.getSnapshot()
  const livePreview = beforeSnapshot.preview

  if (
    livePreview
    && (livePreview.status === "playing" || livePreview.status === "paused")
    && isSameAtmoShaperLayerSource(livePreview.layer, previewLayer)
  ) {
    await runtime.promotePreview(desiredRecipe)
    const promotedSnapshot = runtime.getSnapshot()
    const promotedLayer = desiredRecipe.layers.find((layer) => (
      isSameAtmoShaperLayerSource(layer, previewLayer)
    ))
    if (!promotedLayer || !hasAdoptedPreview(promotedSnapshot, runtimeLease, previewLayer, {
      runtimeLease,
      layer: promotedLayer,
    })) {
      throw new Error("The live preview handle could not be adopted.")
    }
    return {
      recipe: desiredRecipe,
      snapshot: promotedSnapshot,
      receipt: { runtimeLease, layer: promotedLayer } satisfies AtmoShaperPromotionAdoptionReceipt,
    }
  }

  if (!hasAdoptedPreview(beforeSnapshot, runtimeLease, previewLayer, options.priorReceipt)) {
    throw new Error("The live preview handle is no longer available.")
  }
  if (!areAtmoShaperRecipesEqual(beforeSnapshot.recipe, desiredRecipe)) {
    await runtime.applyRecipe(desiredRecipe)
  }
  const reconciledSnapshot = runtime.getSnapshot()
  if (!hasAdoptedPreview(reconciledSnapshot, runtimeLease, previewLayer, options.priorReceipt)) {
    throw new Error("The adopted preview handle was not retained.")
  }
  return {
    recipe: desiredRecipe,
    snapshot: reconciledSnapshot,
    receipt: options.priorReceipt as AtmoShaperPromotionAdoptionReceipt,
  }
}

/** Coalesces recipe sync behind preview adoption and skips already-converged recipes. */
export async function executeAtmoShaperRecipeReconciliation<
  TSnapshot extends AtmoShaperProviderRuntimeSnapshot,
>(options: {
  runtime: Pick<AtmoShaperPromotionRuntime<TSnapshot>, "getSnapshot" | "applyRecipe">
  desiredRecipe: AtmoShaperRecipe
  /** Explicit retry requests must revisit failed adapters even when recipe data is unchanged. */
  force?: boolean
}) {
  const { runtime, desiredRecipe, force = false } = options
  const currentSnapshot = runtime.getSnapshot()
  const previewLayer = currentSnapshot.preview?.layer
  if (desiredRecipe.layers.some((layer) => isSameAtmoShaperLayerSource(layer, previewLayer))) {
    return { status: "preview-pending" as const, snapshot: currentSnapshot }
  }
  if (!force && areAtmoShaperRecipesEqual(currentSnapshot.recipe, desiredRecipe)) {
    return { status: "unchanged" as const, snapshot: currentSnapshot }
  }
  await runtime.applyRecipe(desiredRecipe)
  return { status: "reconciled" as const, snapshot: runtime.getSnapshot() }
}

/** Matches the preview identity the production controller is allowed to adopt. */
export function isSameAtmoShaperLayerSource(
  left: AtmoShaperLayer | null | undefined,
  right: AtmoShaperLayer | null | undefined,
) {
  return Boolean(
    left
    && right
    && left.id === right.id
    && left.kind === right.kind
    && left.sourceId === right.sourceId,
  )
}

/** Compares normalized recipe data independent of plain-object key ordering. */
export function areAtmoShaperRecipesEqual(
  left: AtmoShaperRecipe | null | undefined,
  right: AtmoShaperRecipe | null | undefined,
) {
  return stablePlainData(left) === stablePlainData(right)
}

function hasAdoptedPreview(
  snapshot: AtmoShaperProviderRuntimeSnapshot,
  runtimeLease: number,
  previewLayer: AtmoShaperLayer,
  receipt: AtmoShaperPromotionAdoptionReceipt | null,
) {
  if (
    !receipt
    || receipt.runtimeLease !== runtimeLease
    || !isSameAtmoShaperLayerSource(receipt.layer, previewLayer)
  ) return false
  const promotedLayer = snapshot.recipe?.layers.find((layer) => (
    isSameAtmoShaperLayerSource(layer, previewLayer)
  ))
  return Boolean(
    promotedLayer
    && !snapshot.preview
    && isSameAtmoShaperLayerSource(snapshot.activeLayers[promotedLayer.id], promotedLayer),
  )
}

function stablePlainData(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stablePlainData).join(",")}]`
  if (value !== null && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
      .map(([key, entryValue]) => `${JSON.stringify(key)}:${stablePlainData(entryValue)}`)
    return `{${entries.join(",")}}`
  }
  return JSON.stringify(value) ?? "undefined"
}
