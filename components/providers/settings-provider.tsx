"use client"

import { fetchWithTimeout } from "@/lib/client-fetch"
import { defaultAppSettings, normalizeAppSettings } from "@/lib/app-settings"
import { useAccountShellBootstrap } from "@/components/providers/account-shell-bootstrap-provider"
import { createContext, useContext, useEffect, useState } from "react"

export type SidebarPosition = "left" | "right"
type SidebarTriggerPosition = "top" | "bottom"
export type AppBarPosition = "top" | "bottom"
export type ThemeMode = "dark" | "light" | "system"
export type ResolvedThemeMode = "dark" | "light"
export type AmbientMotionMode = "system" | "reduced"

interface Settings {
  appBarPosition: AppBarPosition
  sidebarPosition: SidebarPosition
  sidebarTriggerPosition: SidebarTriggerPosition
  ambientMotionMode: AmbientMotionMode
  themeMode: ThemeMode
  hapticFeedbackEnabled: boolean
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

export function applySidebarPositionAttribute(sidebarPosition: SidebarPosition) {
  document.documentElement.dataset.sidebarPosition = sidebarPosition
}

export function applyAppBarPositionAttribute(appBarPosition: AppBarPosition) {
  document.documentElement.dataset.appBarPosition = appBarPosition
}

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { ownerKey, syncEnabled, status, appSettings } = useAccountShellBootstrap()
  const [settings, setSettings] = useState<Settings>(defaultSettings)
  const [localHydrated, setLocalHydrated] = useState(false)
  const canSync = Boolean(ownerKey && syncEnabled && status === "ready")

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
    applySidebarPositionAttribute(settings.sidebarPosition)
  }, [settings.sidebarPosition])

  useEffect(() => {
    applyAppBarPositionAttribute(settings.appBarPosition)
  }, [settings.appBarPosition])

  useEffect(() => {
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
    setLocalHydrated(true)
  }, [])

  useEffect(() => {
    if (!localHydrated || !ownerKey || !syncEnabled || status !== "ready") {
      return
    }

    const nextSettings = normalizeSettings(appSettings.app)
    localStorage.setItem("massage-lab-settings", JSON.stringify(nextSettings))
    setSettings(nextSettings)
  }, [appSettings.app, localHydrated, ownerKey, status, syncEnabled])

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

/**
 * Resolves explicit and system theme settings for controls whose visual variant
 * must stay synchronized with the active document theme.
 */
export function useResolvedTheme(): ResolvedThemeMode {
  const { settings } = useSettings()
  const [systemTheme, setSystemTheme] = useState<ResolvedThemeMode>("dark")

  useEffect(() => {
    if (settings.themeMode !== "system") {
      return
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)")
    const updateSystemTheme = () => setSystemTheme(mediaQuery.matches ? "dark" : "light")

    updateSystemTheme()
    mediaQuery.addEventListener("change", updateSystemTheme)

    return () => mediaQuery.removeEventListener("change", updateSystemTheme)
  }, [settings.themeMode])

  return settings.themeMode === "system" ? systemTheme : settings.themeMode
}

