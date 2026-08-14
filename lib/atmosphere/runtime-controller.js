// @ts-check

/**
 * @typedef {object} AtmosphereRuntimeStation
 * @property {string} id
 * @property {{ adapterId?: string, defaultOptions?: Record<string, number>, [key: string]: unknown }} [runtime]
 *
 * @typedef {(payload: { station: AtmosphereRuntimeStation }) => Promise<void | (() => void)> | void | (() => void)} AtmosphereRuntimeAdapter
 * @typedef {Record<string, AtmosphereRuntimeAdapter>} AtmosphereRuntimeAdapters
 */

/** @param {{ adapters: AtmosphereRuntimeAdapters }} params */
export function createAtmosphereRuntimeController({ adapters }) {
  /** @type {number} */
  let latestRequestId = 0
  /** @type {null | { stationId: string, cleanup: null | (() => void) }} */
  let active = null

  /** Detaches current audio before a later request begins its own preparation. */
  function detachActive() {
    const current = active
    active = null
    current?.cleanup?.()
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

  return {
    /**
     * @param {AtmosphereRuntimeStation} station
     * @returns {Promise<{ status: "active" | "stale", requestId: number }>}
     */
    async start(station) {
      const requestId = ++latestRequestId
      detachActive()

      const nextCleanup = await resolveAdapter(station)({ station })
      if (requestId !== latestRequestId) {
        if (typeof nextCleanup === "function") {
          nextCleanup()
        }
        return { status: "stale", requestId }
      }

      active = {
        stationId: station.id,
        cleanup: typeof nextCleanup === "function" ? nextCleanup : null,
      }
      return { status: "active", requestId }
    },
    stop,
    getActiveStationId() {
      return active?.stationId ?? null
    },
  }
}
