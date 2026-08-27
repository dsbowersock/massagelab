// @ts-check

import { ATMOSHAPER_EXCLUSIVE_KINDS } from "./recipe.js"

/** @typedef {import("./recipe.js").AtmoShaperLayer} AtmoShaperLayer */
/** @typedef {import("./recipe.js").AtmoShaperRecipe} AtmoShaperRecipe */
/** @typedef {{ fadeIn: () => Promise<void>, update: (layer: AtmoShaperLayer) => Promise<void>, pause: () => Promise<void>, resume: () => Promise<void>, fadeOutAndDispose: () => Promise<void> }} AtmoShaperLayerHandle */
/** @typedef {{ status: "loading" | "playing" | "paused" | "failed", error?: string }} AtmoShaperLayerState */
/** @typedef {{ layer: AtmoShaperLayer, status: "loading" | "playing" | "paused" | "failed", error?: string }} AtmoShaperPreviewState */
/** @typedef {{ layer: AtmoShaperLayer, handle: AtmoShaperLayerHandle }} ActivePreview */

/**
 * Coordinates independently failing layer adapters behind one request lease.
 * Recipe equality is determined by stable layer ids; callers own normalization.
 *
 * @param {{ createAdapter: (layer: AtmoShaperLayer, isCurrent: () => boolean, reportFailure: (error: unknown) => void) => AtmoShaperLayerHandle | Promise<AtmoShaperLayerHandle>, onSnapshot?: (snapshot: { status: string, recipe: AtmoShaperRecipe | null, layers: Record<string, AtmoShaperLayerState>, activeLayers: Record<string, AtmoShaperLayer>, preview: AtmoShaperPreviewState | null }) => void }} options
 */
export function createAtmoShaperMixController({ createAdapter, onSnapshot = () => undefined }) {
  let requestId = 0
  let previewRequestId = 0
  let transportRequestId = 0
  let disposed = false
  let status = "stopped"
  /** @type {"playing" | "paused" | "stopped"} */
  let desiredTransport = "stopped"
  /** @type {AtmoShaperRecipe | null} */
  let recipe = null
  /** @type {Map<string, AtmoShaperLayerHandle>} */
  const handles = new Map()
  /** Tracks active layer kinds so failed exclusive replacements can retain their predecessor. @type {Map<string, AtmoShaperLayer>} */
  const activeLayers = new Map()
  /** @type {Map<string, AtmoShaperLayerState>} */
  const layerStates = new Map()
  /** @type {AtmoShaperPreviewState | null} */
  let preview = null
  /** @type {ActivePreview | null} */
  let activePreview = null
  /** Serializes audible preview swaps without blocking silent adapter preparation. @type {Promise<void>} */
  let previewTransition = Promise.resolve()

  function publish() {
    onSnapshot(getSnapshot())
  }

  /** @param {AtmoShaperRecipe} nextRecipe */
  async function start(nextRecipe) {
    if (disposed) return

    const lease = ++requestId
    desiredTransport = "playing"
    recipe = nextRecipe
    for (const layerId of layerStates.keys()) {
      if (!handles.has(layerId)) layerStates.delete(layerId)
    }
    status = "loading"
    publish()
    await reconcile(nextRecipe, lease, true)
    if (lease !== requestId || disposed) return
    settleRecipeStatus(nextRecipe)
    publish()
  }

  /** Updates a running mix, but persists stopped edits without opening audio adapters. @param {AtmoShaperRecipe} nextRecipe */
  async function applyRecipe(nextRecipe) {
    if (disposed) return

    recipe = nextRecipe
    if (!isActive()) {
      layerStates.clear()
      publish()
      return
    }

    const lease = ++requestId
    publish()
    await reconcile(nextRecipe, lease, true)
    if (lease !== requestId || disposed) return
    settleRecipeStatus(nextRecipe)
    publish()
  }

  /**
   * Prepares one ephemeral source through the canonical adapter factory. A new
   * handle stays silent until the prior preview has completed terminal cleanup.
   *
   * @param {AtmoShaperLayer} nextLayer
   */
  async function startPreview(nextLayer) {
    if (disposed) return

    const lease = ++previewRequestId
    if (!isActive() && !activePreview) {
      desiredTransport = "playing"
      transportRequestId += 1
    }
    preview = { layer: nextLayer, status: "loading" }
    publish()

    /** @type {AtmoShaperLayerHandle | undefined} */
    let stagedHandle
    /** @type {unknown} */
    let stagedFailure
    let adapterActivated = false
    try {
      const preparedHandle = await createAdapter(
        nextLayer,
        () => lease === previewRequestId && !disposed,
        (error) => {
          if (!adapterActivated) stagedFailure ??= error
          else if (stagedHandle) void reportAdapterFailure(stagedHandle, error)
        },
      )
      stagedHandle = preparedHandle
      if (stagedFailure) throw stagedFailure
      if (lease !== previewRequestId || disposed) {
        await disposeHandle(preparedHandle)
        return
      }

      await enqueuePreviewTransition(async () => {
        if (lease !== previewRequestId || disposed) {
          await disposeHandle(preparedHandle)
          return
        }

        const targetLayer = preview?.status === "loading" ? preview.layer : nextLayer
        if (targetLayer !== nextLayer) {
          await preparedHandle.update(targetLayer)
          if (lease !== previewRequestId || disposed) {
            await disposeHandle(preparedHandle)
            return
          }
        }

        const priorPreview = activePreview
        activePreview = null
        if (priorPreview) await disposeHandle(priorPreview.handle)
        if (lease !== previewRequestId || disposed) {
          await disposeHandle(preparedHandle)
          return
        }

        await convergeHandleTransport(preparedHandle, true)
        if (stagedFailure) throw stagedFailure
        if (lease !== previewRequestId || disposed) {
          await disposeHandle(preparedHandle)
          return
        }

        activePreview = {
          layer: targetLayer,
          handle: preparedHandle,
        }
        adapterActivated = true
        preview = {
          layer: targetLayer,
          status: desiredTransport === "paused" ? "paused" : "playing",
        }
        publish()
      })
    } catch (error) {
      if (stagedHandle) await disposeHandle(stagedHandle)
      if (lease !== previewRequestId || disposed) return

      await enqueuePreviewTransition(async () => {
        if (lease !== previewRequestId || disposed) return
        const priorPreview = activePreview
        activePreview = null
        if (priorPreview) await disposeHandle(priorPreview.handle)
        if (lease !== previewRequestId || disposed) return
        const failedLayer = preview?.status === "loading" ? preview.layer : nextLayer
        preview = { layer: failedLayer, ...failedState(error) }
        settlePreviewTransport()
        publish()
      })
    }
  }

  /** Updates only the requested preview layer and its private adapter output. @param {number} volume */
  async function setPreviewVolume(volume) {
    if (disposed || !preview) return

    const lease = previewRequestId
    const nextLayer = { ...preview.layer, volume: normalizedVolume(volume, preview.layer.volume) }
    preview = { ...preview, layer: nextLayer }
    publish()
    if (preview.status === "loading") return

    await enqueuePreviewTransition(async () => {
      if (lease !== previewRequestId || disposed || !activePreview) return
      if (!isSamePreviewSource(activePreview.layer, nextLayer)) return
      const previewHandle = activePreview.handle
      try {
        await previewHandle.update(nextLayer)
        if (lease !== previewRequestId || disposed || activePreview?.handle !== previewHandle) return
        activePreview = { layer: nextLayer, handle: previewHandle }
        preview = {
          layer: nextLayer,
          status: desiredTransport === "paused" ? "paused" : "playing",
        }
        publish()
      } catch (error) {
        if (lease !== previewRequestId || disposed || activePreview?.handle !== previewHandle) return
        activePreview = null
        await disposeHandle(previewHandle)
        if (lease !== previewRequestId || disposed) return
        preview = { layer: nextLayer, ...failedState(error) }
        settlePreviewTransport()
        publish()
      }
    })
  }

  /** Fades out and retires preview audio without changing the committed recipe. */
  async function stopPreview() {
    if (disposed) return

    const lease = ++previewRequestId
    await enqueuePreviewTransition(async () => {
      if (lease !== previewRequestId || disposed) return
      const priorPreview = activePreview
      activePreview = null
      preview = null
      if (priorPreview) await disposeHandle(priorPreview.handle)
      if (lease !== previewRequestId || disposed) return
      settlePreviewTransport()
      publish()
    })
  }

  /**
   * Moves an exact id/kind/source preview handle into the committed map, then
   * reconciles the rest of the recipe without creating or restarting it.
   *
   * @param {AtmoShaperRecipe} nextRecipe
   */
  async function promotePreview(nextRecipe) {
    if (disposed) return

    const previewLease = ++previewRequestId
    const lease = ++requestId
    await enqueuePreviewTransition(async () => {
      if (previewLease !== previewRequestId || lease !== requestId || disposed) return

      const priorPreview = activePreview
      const promotedLayer = priorPreview
        ? nextRecipe.layers.find((nextLayer) => isSamePreviewSource(priorPreview.layer, nextLayer))
        : undefined
      const canAdopt = Boolean(
        promotedLayer
        && preview?.status !== "loading"
        && !handles.has(promotedLayer.id),
      )

      activePreview = null
      preview = null
      if (priorPreview && canAdopt) {
        try {
          // Pause/resume may have snapshotted committed handles before this
          // preview was adopted. Converging here closes that transport gap.
          await convergeHandleTransport(priorPreview.handle, false)
        } catch (error) {
          await disposeHandle(priorPreview.handle)
          if (previewLease !== previewRequestId || lease !== requestId || disposed) return
          preview = { layer: priorPreview.layer, ...failedState(error) }
          settlePreviewTransport()
          publish()
          return
        }
      }
      if (priorPreview && !canAdopt) await disposeHandle(priorPreview.handle)
      if (previewLease !== previewRequestId || lease !== requestId || disposed) {
        if (priorPreview && canAdopt) await disposeHandle(priorPreview.handle)
        return
      }

      if (!isActive() && !canAdopt) {
        desiredTransport = "playing"
        transportRequestId += 1
      }
      recipe = nextRecipe
      for (const layerId of layerStates.keys()) {
        if (!handles.has(layerId)) layerStates.delete(layerId)
      }
      status = "loading"

      if (priorPreview && promotedLayer && canAdopt) {
        handles.set(promotedLayer.id, priorPreview.handle)
        activeLayers.set(promotedLayer.id, priorPreview.layer)
        layerStates.set(promotedLayer.id, {
          status: desiredTransport === "paused" ? "paused" : "playing",
        })
      }
      publish()

      await reconcile(nextRecipe, lease, true)
      if (lease !== requestId || disposed) return
      settleRecipeStatus(nextRecipe)
      publish()
    })
  }

  /** Pauses each active handle independently so one adapter cannot block the mix. */
  async function pause() {
    if (disposed || (!isActive() && !preview)) return

    desiredTransport = "paused"
    const transportLease = ++transportRequestId
    for (const [layerId, handle] of [...handles]) {
      if (transportLease !== transportRequestId || disposed) return
      try {
        await handle.pause()
        if (transportLease !== transportRequestId || disposed) return
        layerStates.set(layerId, { status: "paused" })
      } catch (error) {
        if (transportLease !== transportRequestId || disposed) return
        layerStates.set(layerId, failedState(error))
      }
    }
    const previewHandle = activePreview?.handle
    if (previewHandle && transportLease === transportRequestId && !disposed) {
      try {
        await previewHandle.pause()
        if (transportLease !== transportRequestId || disposed) return
        if (activePreview?.handle === previewHandle) {
          preview = { layer: activePreview.layer, status: "paused" }
        }
      } catch (error) {
        if (transportLease !== transportRequestId || disposed) return
        if (activePreview?.handle === previewHandle) {
          const failedLayer = activePreview.layer
          activePreview = null
          await disposeHandle(previewHandle)
          if (transportLease !== transportRequestId || disposed) return
          preview = { layer: failedLayer, ...failedState(error) }
          settlePreviewTransport()
          if (transportLease !== transportRequestId) {
            publish()
            return
          }
        }
      }
    }
    if (transportLease !== transportRequestId || disposed) return
    status = hasWorkingLayer() ? "paused" : status
    publish()
  }

  /** Resumes each active handle independently so one adapter cannot block the mix. */
  async function resume() {
    if (disposed || (!isActive() && !preview)) return

    desiredTransport = "playing"
    const transportLease = ++transportRequestId
    for (const [layerId, handle] of [...handles]) {
      if (transportLease !== transportRequestId || disposed) return
      try {
        await handle.resume()
        if (transportLease !== transportRequestId || disposed) return
        layerStates.set(layerId, { status: "playing" })
      } catch (error) {
        if (transportLease !== transportRequestId || disposed) return
        layerStates.set(layerId, failedState(error))
      }
    }
    const previewHandle = activePreview?.handle
    if (previewHandle && transportLease === transportRequestId && !disposed) {
      try {
        await previewHandle.resume()
        if (transportLease !== transportRequestId || disposed) return
        if (activePreview?.handle === previewHandle) {
          preview = { layer: activePreview.layer, status: "playing" }
        }
      } catch (error) {
        if (transportLease !== transportRequestId || disposed) return
        if (activePreview?.handle === previewHandle) {
          const failedLayer = activePreview.layer
          activePreview = null
          await disposeHandle(previewHandle)
          if (transportLease !== transportRequestId || disposed) return
          preview = { layer: failedLayer, ...failedState(error) }
          settlePreviewTransport()
          if (transportLease !== transportRequestId) {
            publish()
            return
          }
        }
      }
    }
    if (transportLease !== transportRequestId || disposed) return
    status = hasWorkingLayer() ? "playing" : status
    publish()
  }

  /** Stops live handles while retaining the last recipe for subsequent editing or restart. */
  async function stop() {
    await stopRuntime()
  }

  /** Permanently retires the controller and any adapters that arrive from an old request. */
  async function dispose() {
    if (disposed) return
    disposed = true
    await stopRuntime()
  }

  /**
   * Reconciles retained ids first, then stages additions before disposing removed handles.
   * This ordering prevents an exclusive-kind replacement from creating a silent gap.
   *
   * @param {AtmoShaperRecipe} nextRecipe
   * @param {number} lease
   * @param {boolean} shouldFadeIn
   */
  async function reconcile(nextRecipe, lease, shouldFadeIn) {
    const nextLayers = new Map(nextRecipe.layers.map((layer) => [layer.id, layer]))
    const protectedPredecessors = new Set()

    for (const layerId of layerStates.keys()) {
      if (!handles.has(layerId) && !nextLayers.has(layerId)) layerStates.delete(layerId)
    }

    for (const [layerId, handle] of [...handles]) {
      if (!nextLayers.has(layerId)) continue
      const nextLayer = /** @type {AtmoShaperLayer} */ (nextLayers.get(layerId))
      if (!isRetainedLayer(layerId, nextLayer)) continue
      if (lease !== requestId || disposed) return
      try {
        await handle.update(nextLayer)
        if (lease !== requestId || disposed) return
        activeLayers.set(layerId, nextLayer)
        layerStates.set(layerId, { status: desiredTransport === "paused" ? "paused" : "playing" })
      } catch (error) {
        if (lease !== requestId || disposed) return
        layerStates.set(layerId, failedState(error))
      }
    }

    for (const nextLayer of nextRecipe.layers) {
      if (isRetainedLayer(nextLayer.id, nextLayer)) continue
      if (lease !== requestId || disposed) return
      const predecessorId = findReplacementPredecessor(nextLayer, nextLayers)
      const previousState = layerStates.get(nextLayer.id)
      layerStates.set(nextLayer.id, { status: "loading" })

      /** @type {AtmoShaperLayerHandle | undefined} */
      let stagedHandle
      /** @type {unknown} */
      let stagedFailure
      let adapterActivated = false
      try {
        stagedHandle = await createAdapter(
          nextLayer,
          () => lease === requestId && !disposed,
          (error) => {
            if (!adapterActivated) stagedFailure ??= error
            else if (stagedHandle) void reportAdapterFailure(stagedHandle, error)
          },
        )
        if (stagedFailure) throw stagedFailure
        if (lease !== requestId || disposed) {
          await disposeHandle(stagedHandle)
          return
        }

        await convergeHandleTransport(stagedHandle, shouldFadeIn)
        if (stagedFailure) throw stagedFailure
        if (lease !== requestId || disposed) {
          await disposeHandle(stagedHandle)
          return
        }
        if (predecessorId) {
          const predecessorHandle = handles.get(predecessorId)
          if (predecessorHandle) {
            handles.delete(predecessorId)
            activeLayers.delete(predecessorId)
            await disposeHandle(predecessorHandle)
            if (lease !== requestId || disposed) {
              await disposeHandle(stagedHandle)
              return
            }
            if (predecessorId !== nextLayer.id) layerStates.delete(predecessorId)
          }
        }
        handles.set(nextLayer.id, stagedHandle)
        activeLayers.set(nextLayer.id, nextLayer)
        adapterActivated = true
        layerStates.set(nextLayer.id, { status: desiredTransport === "paused" ? "paused" : "playing" })
      } catch (error) {
        if (stagedHandle) await disposeHandle(stagedHandle)
        if (lease !== requestId || disposed) return
        const failedReplacement = failedState(error)
        if (predecessorId) {
          protectedPredecessors.add(predecessorId)
          if (predecessorId === nextLayer.id && previousState) {
            layerStates.set(nextLayer.id, { ...previousState, error: failedReplacement.error })
          } else {
            layerStates.set(nextLayer.id, failedReplacement)
          }
          if (!layerStates.has(predecessorId)) {
            layerStates.set(predecessorId, { status: desiredTransport === "paused" ? "paused" : "playing" })
          }
        } else {
          layerStates.set(nextLayer.id, failedReplacement)
        }
      }
    }

    for (const [layerId, handle] of [...handles]) {
      if (nextLayers.has(layerId) || protectedPredecessors.has(layerId)) continue
      if (lease !== requestId || disposed) return
      handles.delete(layerId)
      activeLayers.delete(layerId)
      await disposeHandle(handle)
      if (lease !== requestId || disposed) return
      layerStates.delete(layerId)
    }
  }

  /** Invalidates pending work and clears live runtime state without discarding the recipe. */
  async function stopRuntime() {
    const lease = ++requestId
    previewRequestId += 1
    transportRequestId += 1
    desiredTransport = "stopped"
    const activeHandles = [...handles.values()]
    const previewHandle = activePreview?.handle
    handles.clear()
    activeLayers.clear()
    layerStates.clear()
    activePreview = null
    preview = null
    status = "stopped"
    await Promise.all([
      ...activeHandles.map((handle) => disposeHandle(handle)),
      ...(previewHandle ? [disposeHandle(previewHandle)] : []),
    ])
    if (lease === requestId) publish()
  }

  /** Runs audible preview ownership changes one at a time. @param {() => Promise<void>} transition */
  function enqueuePreviewTransition(transition) {
    const queuedTransition = previewTransition.then(transition, transition)
    previewTransition = queuedTransition.catch(() => undefined)
    return queuedTransition
  }

  /**
   * Lets transport intent change without invalidating in-flight layer preparation.
   * @param {AtmoShaperLayerHandle} handle
   * @param {boolean} shouldFadeIn
   */
  async function convergeHandleTransport(handle, shouldFadeIn) {
    let firstPlayingAction = true
    while (!disposed && desiredTransport !== "stopped") {
      const intendedTransport = desiredTransport
      const transportLease = transportRequestId
      if (intendedTransport === "paused") {
        await handle.pause()
      } else if (firstPlayingAction && shouldFadeIn) {
        await handle.fadeIn()
      } else {
        await handle.resume()
      }
      firstPlayingAction = false
      if (
        intendedTransport === desiredTransport
        && transportLease === transportRequestId
      ) return
    }
  }

  /** Adapter cleanup is best-effort because failures must not block other layers. @param {AtmoShaperLayerHandle} handle */
  async function disposeHandle(handle) {
    try {
      await handle.fadeOutAndDispose()
    } catch {
      // Disposal is terminal cleanup; there is no remaining handle to report against.
    }
  }

  /**
   * Converts an adapter failure that occurs after startup into the same
   * retryable state as a preparation failure. Handle identity follows a
   * promoted preview into the committed map and rejects stale callbacks.
   * @param {AtmoShaperLayerHandle} handle
   * @param {unknown} error
   */
  async function reportAdapterFailure(handle, error) {
    const committedEntry = [...handles].find(([, candidate]) => candidate === handle)
    if (committedEntry) {
      const [layerId] = committedEntry
      const failedLayer = activeLayers.get(layerId)
      handles.delete(layerId)
      activeLayers.delete(layerId)
      await disposeHandle(handle)
      const currentRecipe = recipe
      const desiredLayer = currentRecipe?.layers.find((layer) => layer.id === layerId)
      if (
        disposed
        || handles.has(layerId)
        || !currentRecipe
        || !failedLayer
        || !desiredLayer
        || desiredLayer.kind !== failedLayer.kind
        || desiredLayer.sourceId !== failedLayer.sourceId
      ) return
      layerStates.set(layerId, failedState(error))
      settleRecipeStatus(currentRecipe)
      publish()
      return
    }

    if (activePreview?.handle !== handle) return
    const failedLayer = activePreview.layer
    activePreview = null
    await disposeHandle(handle)
    if (disposed || activePreview || !preview || !isSamePreviewSource(preview.layer, failedLayer)) return
    preview = { layer: failedLayer, ...failedState(error) }
    settlePreviewTransport()
    publish()
  }

  function hasWorkingLayer() {
    return [...layerStates.values()].some(({ status: layerStatus }) => (
      layerStatus === "playing" || layerStatus === "paused"
    ))
  }

  /** Empty recipes are stopped edits, while non-empty recipes with no live handle are genuine failures. @param {AtmoShaperRecipe} nextRecipe */
  function settleRecipeStatus(nextRecipe) {
    if (nextRecipe.layers.length === 0) {
      desiredTransport = "stopped"
      status = "stopped"
      return
    }
    status = hasWorkingLayer() ? desiredTransport : "failed"
  }

  function isActive() {
    return status === "loading" || status === "playing" || status === "paused"
  }

  /** Restores a stopped transport only when preview was the sole live owner. */
  function settlePreviewTransport() {
    if (isActive() || handles.size > 0 || activePreview) return
    desiredTransport = "stopped"
    transportRequestId += 1
  }

  /** @param {string} layerId @param {AtmoShaperLayer} nextLayer */
  function isRetainedLayer(layerId, nextLayer) {
    return handles.has(layerId) && activeLayers.get(layerId)?.kind === nextLayer.kind
  }

  /** Finds either a same-id kind replacement or the displaced exclusive-kind predecessor. @param {AtmoShaperLayer} nextLayer @param {Map<string, AtmoShaperLayer>} nextLayers */
  function findReplacementPredecessor(nextLayer, nextLayers) {
    if (handles.has(nextLayer.id) && !isRetainedLayer(nextLayer.id, nextLayer)) return nextLayer.id
    if (!ATMOSHAPER_EXCLUSIVE_KINDS.has(nextLayer.kind)) return undefined
    for (const [layerId, activeLayer] of activeLayers) {
      if (!nextLayers.has(layerId) && activeLayer.kind === nextLayer.kind) return layerId
    }
    return undefined
  }

  /** Promotion identity excludes mutable mix controls while preserving the source and adapter kind. @param {AtmoShaperLayer} left @param {AtmoShaperLayer} right */
  function isSamePreviewSource(left, right) {
    return left.id === right.id && left.kind === right.kind && left.sourceId === right.sourceId
  }

  /** @param {number} volume @param {number} fallback */
  function normalizedVolume(volume, fallback) {
    return Math.min(1, Math.max(0, Number.isFinite(volume) ? volume : fallback))
  }

  /** @param {unknown} error @returns {AtmoShaperLayerState} */
  function failedState(error) {
    return { status: "failed", error: error instanceof Error ? error.message : String(error) }
  }

  function getSnapshot() {
    return {
      status,
      recipe,
      layers: Object.fromEntries(layerStates),
      activeLayers: Object.fromEntries(activeLayers),
      preview,
    }
  }

  return {
    start,
    applyRecipe,
    startPreview,
    setPreviewVolume,
    stopPreview,
    promotePreview,
    pause,
    resume,
    stop,
    dispose,
    getSnapshot,
  }
}
