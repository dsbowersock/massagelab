"use client"

import { createContext, useContext, useEffect, useState } from "react"

type SidebarPosition = "left" | "right"
type SidebarNarrowPosition = "top" | "bottom"
type SidebarBehavior = "responsive" | "fixed"

interface Settings {
  sidebarPosition: SidebarPosition
  sidebarNarrowPosition: SidebarNarrowPosition
  sidebarBehavior: SidebarBehavior
}

interface SettingsContextType {
  settings: Settings
  updateSettings: (newSettings: Partial<Settings>) => void
}

const defaultSettings: Settings = {
  sidebarPosition: "left",
  sidebarNarrowPosition: "bottom",
  sidebarBehavior: "responsive"
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<Settings>(defaultSettings)

  useEffect(() => {
    const savedSettings = localStorage.getItem("massage-lab-settings")
    if (savedSettings) {
      setSettings(JSON.parse(savedSettings))
    }
  }, [])

  const updateSettings = (newSettings: Partial<Settings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings }
      localStorage.setItem("massage-lab-settings", JSON.stringify(updated))
      return updated
    })
  }

  return (
    <SettingsContext.Provider value={{ settings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const context = useContext(SettingsContext)
  if (context === undefined) {
    throw new Error("useSettings must be used within a SettingsProvider")
  }
  return context
}

