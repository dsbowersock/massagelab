/**
 * Clears captured effect slots before running every cleanup, optionally in
 * reverse mount order, and surfaces failures only after the full drain.
 */
export function drainEffectCleanups(effectSlots, { label, reverse = false }) {
  const cleanupErrors = []
  const mountedSlots = effectSlots.splice(0)
  const orderedSlots = reverse ? mountedSlots.toReversed() : mountedSlots

  for (const slot of orderedSlots) {
    try {
      slot?.cleanup?.()
    } catch (error) {
      cleanupErrors.push(error)
    }
  }

  if (cleanupErrors.length === 1) throw cleanupErrors[0]
  if (cleanupErrors.length > 1) {
    throw new AggregateError(cleanupErrors, `${label} effect cleanups failed`)
  }
}
