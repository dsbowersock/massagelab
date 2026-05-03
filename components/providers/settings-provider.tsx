"use client"

import { fetchWithTimeout } from "@/lib/client-fetch"
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
  const [canSync, setCanSync] = useState(false)

  useEffect(() => {
    let isMounted = true

    const loadLocalSettings = () => {
      let nextSettings = defaultSettings
      const savedSettings = localStorage.getItem("massage-lab-settings")

      if (savedSettings) {
        try {
          nextSettings = { ...defaultSettings, ...JSON.parse(savedSettings) }
        } catch {
          localStorage.removeItem("massage-lab-settings")
        }
      }

      localStorage.setItem("massage-lab-settings", JSON.stringify(nextSettings))
      setSettings(nextSettings)
    }

    async function syncCloudSettings() {
      try {
        const response = await fetchWithTimeout("/api/account/preferences")

        if (!isMounted) {
          return
        }

        if (!response.ok) {
          setCanSync(false)
          return
        }

        const preferences = await response.json()

        if (!isMounted) {
          return
        }

        setCanSync(true)

        if (preferences.appSettings && typeof preferences.appSettings === "object") {
          const nextSettings = { ...defaultSettings, ...(preferences.appSettings as Partial<Settings>) }
          localStorage.setItem("massage-lab-settings", JSON.stringify(nextSettings))
          setSettings(nextSettings)
        }
      } catch {
        if (!isMounted) {
          return
        }
        setCanSync(false)
      }
    }

    loadLocalSettings()
    void syncCloudSettings()

    return () => {
      isMounted = false
    }
  }, [])

  const updateSettings = (newSettings: Partial<Settings>) => {
    setSettings(prev => {
      const updated = { ...prev, ...newSettings }
      localStorage.setItem("massage-lab-settings", JSON.stringify(updated))

      if (canSync) {
        void fetchWithTimeout("/api/account/preferences", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ appSettings: updated }),
        }).catch(() => undefined)
      }

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

