// @ts-check

/** @typedef {{ id: string, kind: string, volume: number }} AtmoShaperLayer */
/** @typedef {{ layers: AtmoShaperLayer[] }} AtmoShaperRecipe */
/** @typedef {{ fadeIn: () => Promise<void>, update: (layer: AtmoShaperLayer) => Promise<void>, pause: () => Promise<void>, resume: () => Promise<void>, fadeOutAndDispose: () => Promise<void> }} AtmoShaperLayerHandle */
/** @typedef {{ status: "loading" | "playing" | "paused" | "failed", error?: string }} AtmoShaperLayerState */

/**
 * Coordinates independently failing layer adapters behind one request lease.
 * Recipe equality is determined by stable layer ids; callers own normalization.
 *
 * @param {{ createAdapter: (layer: AtmoShaperLayer) => AtmoShaperLayerHandle | Promise<AtmoShaperLayerHandle>, onSnapshot?: (snapshot: { status: string, recipe: AtmoShaperRecipe | null, layers: Record<string, AtmoShaperLayerState> }) => void }} options
 */
export function createAtmoShaperMixController({ createAdapter, onSnapshot = () => undefined }) {
  let requestId = 0
  let disposed = false
  let status = "stopped"
  /** @type {AtmoShaperRecipe | null} */
  let recipe = null
  /** @type {Map<string, AtmoShaperLayerHandle>} */
  const handles = new Map()
  /** @type {Map<string, AtmoShaperLayerState>} */
  const layerStates = new Map()

  function publish() {
    onSnapshot({
      status,
      recipe,
      layers: Object.fromEntries(layerStates),
    })
  }

  /** @param {AtmoShaperRecipe} nextRecipe */
  async function start(nextRecipe) {
    if (disposed) return

    const lease = ++requestId
    recipe = nextRecipe
    layerStates.clear()
    status = "loading"
    publish()
    await reconcile(nextRecipe, lease, true)
    if (lease !== requestId || disposed) return
    status = hasWorkingLayer() ? "playing" : "failed"
    publish()
  }

  /** Updates a running mix, but persists stopped edits without opening audio adapters. */
  async function applyRecipe(nextRecipe) {
    if (disposed) return

    recipe = nextRecipe
    if (!isActive()) {
      layerStates.clear()
      publish()
      return
    }

    const lease = ++requestId
    const wasPaused = status === "paused"
    publish()
    await reconcile(nextRecipe, lease, true)
    if (lease !== requestId || disposed) return
    status = hasWorkingLayer() ? (wasPaused ? "paused" : "playing") : "failed"
    publish()
  }

  /** Pauses each active handle independently so one adapter cannot block the mix. */
  async function pause() {
    if (disposed || !isActive()) return

    const lease = ++requestId
    for (const [layerId, handle] of [...handles]) {
      if (lease !== requestId || disposed) return
      try {
        await handle.pause()
        if (lease !== requestId || disposed) return
        layerStates.set(layerId, { status: "paused" })
      } catch (error) {
        if (lease !== requestId || disposed) return
        layerStates.set(layerId, failedState(error))
      }
    }
    if (lease !== requestId || disposed) return
    status = hasWorkingLayer() ? "paused" : "failed"
    publish()
  }

  /** Resumes each active handle independently so one adapter cannot block the mix. */
  async function resume() {
    if (disposed || !isActive()) return

    const lease = ++requestId
    for (const [layerId, handle] of [...handles]) {
      if (lease !== requestId || disposed) return
      try {
        await handle.resume()
        if (lease !== requestId || disposed) return
        layerStates.set(layerId, { status: "playing" })
      } catch (error) {
        if (lease !== requestId || disposed) return
        layerStates.set(layerId, failedState(error))
      }
    }
    if (lease !== requestId || disposed) return
    status = hasWorkingLayer() ? "playing" : "failed"
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

    for (const [layerId, handle] of [...handles]) {
      if (!nextLayers.has(layerId)) continue
      if (lease !== requestId || disposed) return
      try {
        await handle.update(/** @type {AtmoShaperLayer} */ (nextLayers.get(layerId)))
        if (lease !== requestId || disposed) return
        layerStates.set(layerId, { status: status === "paused" ? "paused" : "playing" })
      } catch (error) {
        if (lease !== requestId || disposed) return
        layerStates.set(layerId, failedState(error))
      }
    }

    for (const nextLayer of nextRecipe.layers) {
      if (handles.has(nextLayer.id)) continue
      if (lease !== requestId || disposed) return
      layerStates.set(nextLayer.id, { status: "loading" })

      /** @type {AtmoShaperLayerHandle | undefined} */
      let handle
      try {
        handle = await createAdapter(nextLayer)
        if (lease !== requestId || disposed) {
          await disposeHandle(handle)
          return
        }

        handles.set(nextLayer.id, handle)
        if (shouldFadeIn) await handle.fadeIn()
        if (lease !== requestId || disposed) {
          await releaseHandle(nextLayer.id, handle)
          return
        }
        layerStates.set(nextLayer.id, { status: status === "paused" ? "paused" : "playing" })
      } catch (error) {
        if (lease !== requestId || disposed) {
          if (handle && handles.get(nextLayer.id) !== handle) await disposeHandle(handle)
          return
        }
        if (handle) await releaseHandle(nextLayer.id, handle)
        layerStates.set(nextLayer.id, failedState(error))
      }
    }

    for (const [layerId, handle] of [...handles]) {
      if (nextLayers.has(layerId)) continue
      if (lease !== requestId || disposed) return
      handles.delete(layerId)
      await disposeHandle(handle)
      if (lease !== requestId || disposed) return
      layerStates.delete(layerId)
    }
  }

  /** Invalidates pending work and clears live runtime state without discarding the recipe. */
  async function stopRuntime() {
    const lease = ++requestId
    const activeHandles = [...handles.values()]
    handles.clear()
    layerStates.clear()
    status = "stopped"
    await Promise.all(activeHandles.map((handle) => disposeHandle(handle)))
    if (lease === requestId) publish()
  }

  /** @param {string} layerId @param {AtmoShaperLayerHandle} handle */
  async function releaseHandle(layerId, handle) {
    if (handles.get(layerId) !== handle) return
    handles.delete(layerId)
    await disposeHandle(handle)
  }

  /** Adapter cleanup is best-effort because failures must not block other layers. @param {AtmoShaperLayerHandle} handle */
  async function disposeHandle(handle) {
    try {
      await handle.fadeOutAndDispose()
    } catch {
      // Disposal is terminal cleanup; there is no remaining handle to report against.
    }
  }

  function hasWorkingLayer() {
    return [...layerStates.values()].some(({ status: layerStatus }) => (
      layerStatus === "playing" || layerStatus === "paused"
    ))
  }

  function isActive() {
    return status === "loading" || status === "playing" || status === "paused"
  }

  /** @param {unknown} error @returns {AtmoShaperLayerState} */
  function failedState(error) {
    return { status: "failed", error: error instanceof Error ? error.message : String(error) }
  }

  return {
    start,
    applyRecipe,
    pause,
    resume,
    stop,
    dispose,
    getSnapshot: () => ({ status, recipe, layers: Object.fromEntries(layerStates) }),
  }
}
