"use client"

import { useEffect, useReducer } from "react"

const PENDING_ACTION_RENDER_NUDGE_CADENCE_MS = 300
const PENDING_ACTION_RENDER_NUDGE_CAP_MS = 30_000

/**
 * Nudges only local render state while a connected action is pending to work
 * around Next.js issues #96233 and #97990. Remove this compatibility hook once
 * the pinned Next release fixes both issues and the connected Admin action
 * browser checks pass without it.
 */
export function usePendingActionRenderNudge(pending: boolean) {
  const [, nudgeLocalRevision] = useReducer((revision: number) => revision + 1, 0)

  useEffect(() => {
    if (!pending) return

    const intervalId = setInterval(nudgeLocalRevision, PENDING_ACTION_RENDER_NUDGE_CADENCE_MS)
    const capId = setTimeout(() => {
      clearInterval(intervalId)
      clearTimeout(capId)
    }, PENDING_ACTION_RENDER_NUDGE_CAP_MS)

    return () => {
      clearInterval(intervalId)
      clearTimeout(capId)
    }
  }, [pending])
}
