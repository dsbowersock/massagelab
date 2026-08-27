// @ts-check

/**
 * @typedef {object} AtmosphereRuntimeStation
 * @property {string} id
 * @property {{ adapterId?: string, defaultOptions?: Record<string, number>, [key: string]: unknown }} [runtime]
 *
 * @typedef {(() => void | Promise<void>) & { dispose?: () => void | Promise<void> }} AtmosphereRuntimeCleanup
 * @typedef {(payload: { station: AtmosphereRuntimeStation, isCurrent: () => boolean }) => Promise<void | AtmosphereRuntimeCleanup> | void | AtmosphereRuntimeCleanup} AtmosphereRuntimeAdapter
 * @typedef {Record<string, AtmosphereRuntimeAdapter>} AtmosphereRuntimeAdapters
 */

/** @param {{ adapters: AtmosphereRuntimeAdapters }} params */
export function createAtmosphereRuntimeController({ adapters }) {
  /** @type {number} */
  let latestRequestId = 0
  /** @type {null | { stationId: string, cleanup: null | AtmosphereRuntimeCleanup }} */
  let active = null
  /** @type {Set<Promise<{ status: "active" | "stale", requestId: number }>>} */
  const pendingStarts = new Set()

  /** Detaches current audio before a later request begins its own preparation. */
  function detachActive() {
    const current = active
    active = null
    current?.cleanup?.()
  }

  /** Detaches through the handle's awaitable terminal path when one exists. */
  async function detachActiveAndWait() {
    const current = active
    active = null
    if (!current?.cleanup) return
    if (typeof current.cleanup.dispose === "function") {
      await current.cleanup.dispose()
    } else {
      await current.cleanup()
    }
  }

  /** @param {AtmosphereRuntimeStation} station */
  function resolveAdapter(station) {
    const adapterId = station?.runtime?.adapterId
    if (typeof adapterId !== "string") {
      throw new Error("No Atmosphere runtime adapter registered: undefined")
    }

    const adapter = adapters[adapterId]
    if (typeof adapter !== "function") {
      throw new Error(`No Atmosphere runtime adapter registered: ${adapterId}`)
    }

    return adapter
  }

  function stop() {
    const requestId = ++latestRequestId
    detachActive()
    return { requestId }
  }

  async function stopAndWait() {
    const requestId = ++latestRequestId
    const startsToRetire = [...pendingStarts]
    const activeDisposal = detachActiveAndWait()
    // An adapter that was still preparing owns no active slot yet, but its
    // start promise performs stale-handle disposal before this barrier settles.
    await Promise.allSettled([activeDisposal, ...startsToRetire])
    return { requestId }
  }

  /**
   * @param {AtmosphereRuntimeStation} station
   * @returns {Promise<{ status: "active" | "stale", requestId: number }>}
   */
  async function startRequest(station) {
    const requestId = ++latestRequestId
    detachActive()

    // Adapters that prepare asynchronously must verify this lease immediately
    // before claiming shared audio resources such as Tone.Transport.
    const isCurrent = () => requestId === latestRequestId
    const nextCleanup = await resolveAdapter(station)({ station, isCurrent })
    if (requestId !== latestRequestId) {
      if (typeof nextCleanup === "function") {
        if (typeof nextCleanup.dispose === "function") await nextCleanup.dispose()
        else await nextCleanup()
      }
      return { status: "stale", requestId }
    }

    active = {
      stationId: station.id,
      cleanup: typeof nextCleanup === "function" ? nextCleanup : null,
    }
    return { status: "active", requestId }
  }

  return {
    /**
     * @param {AtmosphereRuntimeStation} station
     * @returns {Promise<{ status: "active" | "stale", requestId: number }>}
     */
    start(station) {
      const starting = startRequest(station)
      pendingStarts.add(starting)
      void starting.then(
        () => pendingStarts.delete(starting),
        () => pendingStarts.delete(starting),
      )
      return starting
    },
    stop,
    stopAndWait,
    getActiveStationId() {
      return active?.stationId ?? null
    },
  }
}
