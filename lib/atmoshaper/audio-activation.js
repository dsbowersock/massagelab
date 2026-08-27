/**
 * Requests the shared Tone AudioContext resume without crossing an asynchronous
 * boundary first. Browsers that require a user gesture inspect the call stack,
 * so callers must invoke this directly from the accepted Play or Preview event.
 *
 * @param {{
 *   getAtmosphereAudioContext(): { state: unknown },
 *   startAtmosphereAudioContext(): Promise<void>
 * } | null} runtime
 * @returns {Promise<void>}
 */
export function resumeAtmoShaperAudioContext(runtime) {
  if (!runtime) {
    return Promise.reject(new Error("AtmoShaper audio setup is still preparing."))
  }

  try {
    const context = runtime.getAtmosphereAudioContext()
    return context.state === "running"
      ? Promise.resolve()
      : Promise.resolve(runtime.startAtmosphereAudioContext())
  } catch (error) {
    return Promise.reject(error)
  }
}
