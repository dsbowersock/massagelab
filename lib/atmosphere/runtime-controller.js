// @ts-check

/**
 * @typedef {object} AtmosphereRuntimeStation
 * @property {string} id
 * @property {{ adapterId?: string, defaultOptions?: Record<string, number> }} [runtime]
 *
 * @typedef {(payload: { station: AtmosphereRuntimeStation }) => Promise<void | (() => void)> | void | (() => void)} AtmosphereRuntimeAdapter
 * @typedef {Record<string, AtmosphereRuntimeAdapter>} AtmosphereRuntimeAdapters
 */

/** @param {{ adapters: AtmosphereRuntimeAdapters }} params */
export function createAtmosphereRuntimeController({ adapters }) {
  /** @type {string | null} */
  let activeStationId = null
  /** @type {null | (() => void)} */
  let cleanup = null

  async function stop() {
    const cleanupToRun = cleanup
    cleanup = null
    activeStationId = null

    if (typeof cleanupToRun === "function") {
      cleanupToRun()
    }
  }

  return {
    /** @param {AtmosphereRuntimeStation} station */
    async start(station) {
      await stop()

      const adapterId = station?.runtime?.adapterId
      if (typeof adapterId !== "string") {
        throw new Error("No Atmosphere runtime adapter registered: undefined")
      }

      const adapter = adapters[adapterId]
      if (typeof adapter !== "function") {
        throw new Error(`No Atmosphere runtime adapter registered: ${adapterId}`)
      }

      const nextCleanup = await adapter({ station })
      activeStationId = station.id
      cleanup = typeof nextCleanup === "function" ? nextCleanup : null
    },
    stop,
    getActiveStationId() {
      return activeStationId
    },
  }
}
