// @ts-check

/**
 * @typedef {object} AtmosphereRuntimeStation
 * @property {string} id
 * @property {{ adapterId?: string, defaultOptions?: Record<string, number>, [key: string]: unknown }} [runtime]
 *
 * @typedef {(payload: { station: AtmosphereRuntimeStation, isCurrent: () => boolean }) => Promise<void | (() => void)> | void | (() => void)} AtmosphereRuntimeAdapter
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

      // Adapters that prepare asynchronously must verify this lease immediately
      // before claiming shared audio resources such as Tone.Transport.
      const isCurrent = () => requestId === latestRequestId
      const nextCleanup = await resolveAdapter(station)({ station, isCurrent })
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
