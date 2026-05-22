"use client"

import * as React from "react"
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

const defaultCalendarContext = emptySidebarCalendarContext as SidebarCalendarContext

const SidebarCalendarContextValue = React.createContext<SidebarCalendarProviderValue>({
  calendarContext: defaultCalendarContext,
  refreshCalendarContext: () => undefined,
})

export function SidebarCalendarProvider({
  children,
  enabled,
  initialContext = defaultCalendarContext,
}: {
  children: React.ReactNode
  enabled: boolean
  initialContext?: SidebarCalendarContext
}) {
  const [calendarContext, setCalendarContext] = React.useState<SidebarCalendarContext>(initialContext)
  const [reloadToken, setReloadToken] = React.useState(0)

  const refreshCalendarContext = React.useCallback(() => {
    setReloadToken((token) => token + 1)
  }, [])

  React.useEffect(() => {
    let cancelled = false

    if (!enabled) {
      setCalendarContext(defaultCalendarContext)
      return
    }

    fetch("/api/calendar/sidebar-context")
      .then((response) => response.ok ? response.json() : defaultCalendarContext)
      .then((nextCalendarContext) => {
        if (!cancelled) {
          setCalendarContext(nextCalendarContext as SidebarCalendarContext)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCalendarContext(defaultCalendarContext)
        }
      })

    return () => {
      cancelled = true
    }
  }, [enabled, reloadToken])

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
