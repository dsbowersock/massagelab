// @ts-check

export function createAtmosphereRuntimeController({ adapters }) {
  let activeStationId = null
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
    async start(station) {
      await stop()

      const adapterId = station?.runtime?.adapterId
      const adapter = adapters?.[adapterId]
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
