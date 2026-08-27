/**
 * Owns cancellable preview fade timers so the scheduler can await a complete
 * boundary while Stop still resolves every pending transition immediately.
 */
export function createSignatureSoundPreviewFadeController({
  isActive,
  registerTimer,
  retireVoice,
}) {
  const settlers = new Set()

  function settleAll() {
    for (const settle of settlers) settle()
    settlers.clear()
  }

  function fadeVoices(activeSession, outgoing, incoming, seconds) {
    return new Promise((resolve) => {
      // Keep long fades at roughly 20 gain updates per second so ten- and
      // fifteen-second review transitions do not become audible stair steps.
      // Very short fades retain at least 12 updates for a smooth boundary.
      const steps = Math.max(12, Math.ceil(seconds * 20))
      let step = 0
      let settled = false
      const settle = () => {
        if (settled) return
        settled = true
        settlers.delete(settle)
        resolve()
      }
      settlers.add(settle)
      const tick = () => {
        if (!isActive(activeSession)) {
          settle()
          return
        }
        step += 1
        outgoing.volume = (outgoing.previewTargetVolume ?? 1) * Math.max(0, 1 - step / steps)
        incoming.volume = (incoming.previewTargetVolume ?? 1) * Math.min(1, step / steps)
        if (step < steps) registerTimer(tick, seconds * 1000 / steps)
        else {
          retireVoice(outgoing)
          settle()
        }
      }
      registerTimer(tick, seconds * 1000 / steps)
    })
  }

  /** Fades one manually advanced event to silence before retiring its voice. */
  function fadeOutVoice(activeSession, outgoing, seconds) {
    if (seconds <= 0) {
      outgoing.volume = 0
      retireVoice(outgoing)
      return Promise.resolve()
    }
    return new Promise((resolve) => {
      const steps = Math.max(12, Math.ceil(seconds * 20))
      const startingVolume = outgoing.volume
      let step = 0
      let settled = false
      const settle = () => {
        if (settled) return
        settled = true
        settlers.delete(settle)
        resolve()
      }
      settlers.add(settle)
      const tick = () => {
        if (!isActive(activeSession)) {
          settle()
          return
        }
        step += 1
        outgoing.volume = startingVolume * Math.max(0, 1 - step / steps)
        if (step < steps) registerTimer(tick, seconds * 1000 / steps)
        else {
          retireVoice(outgoing)
          settle()
        }
      }
      registerTimer(tick, seconds * 1000 / steps)
    })
  }

  return { fadeVoices, fadeOutVoice, settleAll }
}
