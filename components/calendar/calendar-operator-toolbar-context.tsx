"use client"

import { createContext, useContext, useEffect, useState, type ReactNode } from "react"

const CalendarOperatorToolbarSlotContext = createContext<ReactNode>(null)
const CalendarOperatorToolbarSetterContext = createContext<((controls: ReactNode) => void) | null>(null)

export function CalendarOperatorToolbarProvider({ children }: { children: ReactNode }) {
  const [controls, setControls] = useState<ReactNode>(null)

  return (
    <CalendarOperatorToolbarSetterContext.Provider value={setControls}>
      <CalendarOperatorToolbarSlotContext.Provider value={controls}>
        {children}
      </CalendarOperatorToolbarSlotContext.Provider>
    </CalendarOperatorToolbarSetterContext.Provider>
  )
}

export function useCalendarOperatorToolbarSlot() {
  return useContext(CalendarOperatorToolbarSlotContext)
}

export function useCalendarOperatorToolbarControls(controls: ReactNode) {
  const setControls = useContext(CalendarOperatorToolbarSetterContext)

  useEffect(() => {
    if (!setControls) return
    setControls(controls)
    return () => setControls(null)
  }, [setControls, controls])
}
