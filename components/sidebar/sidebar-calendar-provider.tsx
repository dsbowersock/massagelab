"use client"

import * as React from "react"
import { fetchJsonWithTimeout } from "@/lib/client-fetch"
import { emptySidebarCalendarContext } from "@/lib/sidebar-calendar-context"

export type SidebarCalendarContext = {
  practice: {
    id: string
    name: string
  } | null
  therapists: Array<{
    id: string
    label: string
  }>
  canManageAvailability: boolean
  pendingAppointmentRequestCount: number
  openWaitlistEntryCount: number
}

type SidebarCalendarProviderValue = {
  calendarContext: SidebarCalendarContext
  refreshCalendarContext: () => void
}

type LoadSidebarCalendarContext = (input: {
  ownerKey: string
  signal: AbortSignal
}) => Promise<SidebarCalendarContext>

type SidebarCalendarCoordinator = {
  adopt: (owner: { ownerKey: string | null, enabled: boolean }) => Promise<void>
  dispose: () => void
  getValue: () => SidebarCalendarContext
  refresh: () => Promise<void>
  subscribe: (listener: (value: SidebarCalendarContext) => void) => () => void
}

const defaultCalendarContext = emptySidebarCalendarContext as SidebarCalendarContext

const SidebarCalendarContextValue = React.createContext<SidebarCalendarProviderValue>({
  calendarContext: defaultCalendarContext,
  refreshCalendarContext: () => undefined,
})

async function loadSidebarCalendarContext({ signal }: { signal: AbortSignal }) {
  const { response, json } = await fetchJsonWithTimeout<SidebarCalendarContext>(
    "/api/calendar/sidebar-context",
    {
      method: "GET",
      cache: "no-store",
      credentials: "same-origin",
      headers: { accept: "application/json" },
      signal,
    },
    10_000,
  )
  return response.ok && json
    ? json
    : defaultCalendarContext
}

/** Owns cancellation and stale-owner rejection for the practice-only sidebar read. */
export function createSidebarCalendarCoordinator({
  initialContext = defaultCalendarContext,
  initialEnabled,
  initialOwnerKey,
  loadContext = loadSidebarCalendarContext,
}: {
  initialContext?: SidebarCalendarContext
  initialEnabled: boolean
  initialOwnerKey: string | null
  loadContext?: LoadSidebarCalendarContext
}): SidebarCalendarCoordinator {
  let calendarContext = initialContext
  let ownerKey = initialOwnerKey
  let enabled = initialEnabled
  let generation = 0
  let controller: AbortController | null = null
  const listeners = new Set<(value: SidebarCalendarContext) => void>()

  function publish(value: SidebarCalendarContext) {
    calendarContext = value
    for (const listener of listeners) listener(calendarContext)
  }

  function startLoad({ reset }: { reset: boolean }): Promise<void> {
    generation += 1
    controller?.abort()
    controller = null
    if (reset) publish(defaultCalendarContext)
    if (!ownerKey || !enabled) return Promise.resolve()

    const requestOwnerKey = ownerKey
    const requestGeneration = generation
    const requestController = new AbortController()
    controller = requestController

    return loadContext({ ownerKey: requestOwnerKey, signal: requestController.signal })
      .then((nextContext) => {
        if (
          requestController.signal.aborted
          || requestGeneration !== generation
          || ownerKey !== requestOwnerKey
        ) return
        publish(nextContext)
      })
      .catch(() => {
        if (
          requestController.signal.aborted
          || requestGeneration !== generation
          || ownerKey !== requestOwnerKey
        ) return
        publish(defaultCalendarContext)
      })
      .finally(() => {
        if (controller === requestController) controller = null
      })
  }

  return {
    adopt(nextOwner) {
      ownerKey = nextOwner.ownerKey
      enabled = nextOwner.enabled
      return startLoad({ reset: true })
    },
    dispose() {
      generation += 1
      controller?.abort()
      controller = null
      listeners.clear()
    },
    getValue() {
      return calendarContext
    },
    refresh() {
      return startLoad({ reset: false })
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

export function SidebarCalendarProvider({
  children,
  enabled,
  ownerKey,
  initialContext = defaultCalendarContext,
}: {
  children: React.ReactNode
  enabled: boolean
  ownerKey: string | null
  initialContext?: SidebarCalendarContext
}) {
  const [coordinator] = React.useState(() => createSidebarCalendarCoordinator({
    initialContext,
    initialEnabled: enabled,
    initialOwnerKey: ownerKey,
  }))
  const [calendarContext, setCalendarContext] = React.useState<SidebarCalendarContext>(
    () => coordinator.getValue(),
  )

  React.useEffect(() => coordinator.subscribe(setCalendarContext), [coordinator])

  React.useEffect(() => {
    void coordinator.adopt({ ownerKey, enabled })
  }, [coordinator, enabled, ownerKey])

  React.useEffect(() => () => coordinator.dispose(), [coordinator])

  const refreshCalendarContext = React.useCallback(() => {
    void coordinator.refresh()
  }, [coordinator])
  const value = React.useMemo<SidebarCalendarProviderValue>(() => ({
    calendarContext,
    refreshCalendarContext,
  }), [calendarContext, refreshCalendarContext])

  return (
    <SidebarCalendarContextValue.Provider value={value}>
      {children}
    </SidebarCalendarContextValue.Provider>
  )
}

export function useSidebarCalendarContext() {
  return React.useContext(SidebarCalendarContextValue)
}
