"use client"

import { fetchWithTimeout } from "@/lib/client-fetch"
import { defaultAppSettings, normalizeAppSettings } from "@/lib/app-settings"
import { createContext, useContext, useEffect, useState } from "react"

type SidebarPosition = "left" | "right"
type SidebarTriggerPosition = "top" | "bottom"
export type AppBarPosition = "top" | "bottom"
export type ThemeMode = "dark" | "light" | "system"
export type ResolvedThemeMode = "dark" | "light"

interface Settings {
  appBarPosition: AppBarPosition
  sidebarPosition: SidebarPosition
  sidebarTriggerPosition: SidebarTriggerPosition
  themeMode: ThemeMode
}

interface SettingsContextType {
  settings: Settings
  updateSettings: (newSettings: Partial<Settings>) => void
}

const defaultSettings = defaultAppSettings as Settings

function normalizeSettings(value: unknown): Settings {
  return normalizeAppSettings(value) as Settings
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined)

export function resolveThemeMode(themeMode: ThemeMode): ResolvedThemeMode {
  if (themeMode !== "system") {
    return themeMode
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

export function applyThemeClass(themeMode: ThemeMode) {
  const root = document.documentElement
  const resolvedThemeMode = resolveThemeMode(themeMode)

  root.classList.toggle("dark", resolvedThemeMode === "dark")
  root.classList.toggle("light", resolvedThemeMode === "light")
  root.dataset.themeMode = themeMode
  root.dataset.resolvedThemeMode = resolvedThemeMode
  root.style.colorScheme = resolvedThemeMode
}

export function SettingsProvider({
  children,
  syncEnabled = false,
}: {
  children: React.ReactNode
  syncEnabled?: boolean
}) {
  const [settings, setSettings] = useState<Settings>(defaultSettings)
  const [canSync, setCanSync] = useState(false)

  useEffect(() => {
    applyThemeClass(settings.themeMode)

    if (settings.themeMode !== "system") {
      return
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const handleSystemThemeChange = () => applyThemeClass("system")

    mediaQuery.addEventListener("change", handleSystemThemeChange)

    return () => {
      mediaQuery.removeEventListener("change", handleSystemThemeChange)
    }
  }, [settings.themeMode])

  useEffect(() => {
    let isMounted = true

    const loadLocalSettings = () => {
      let nextSettings = defaultSettings
      const savedSettings = localStorage.getItem("massage-lab-settings")

      if (savedSettings) {
        try {
          nextSettings = normalizeSettings(JSON.parse(savedSettings))
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
          const nextSettings = normalizeSettings(preferences.appSettings)
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
    if (syncEnabled) {
      void syncCloudSettings()
    } else {
      setCanSync(false)
    }

    return () => {
      isMounted = false
    }
  }, [syncEnabled])

  const updateSettings = (newSettings: Partial<Settings>) => {
    setSettings(prev => {
      const updated = normalizeSettings({ ...prev, ...newSettings })
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

