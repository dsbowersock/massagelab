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
  /** @type {Promise<void>} */
  let operation = Promise.resolve()

  function stopInternal() {
    const cleanupToRun = cleanup
    cleanup = null
    activeStationId = null

    if (typeof cleanupToRun === "function") {
      cleanupToRun()
    }
  }

  /**
   * Runtime operations are serialized so a slow browser audio startup cannot
   * race with a newer play or stop action and leave an orphaned audio graph.
   *
   * @template T
   * @param {() => Promise<T> | T} task
   * @returns {Promise<T>}
   */
  function enqueue(task) {
    const nextOperation = operation.then(task, task)
    operation = nextOperation.then(() => undefined, () => undefined)
    return nextOperation
  }

  async function stop() {
    await enqueue(stopInternal)
  }

  return {
    /** @param {AtmosphereRuntimeStation} station */
    async start(station) {
      await enqueue(async () => {
        stopInternal()

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
      })
    },
    stop,
    getActiveStationId() {
      return activeStationId
    },
  }
}
