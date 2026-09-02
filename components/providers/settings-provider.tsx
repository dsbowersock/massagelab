"use client"

import {
  defaultAppSettings,
  normalizeAppSettings,
  reconcileAppSettingsAfterBootstrap,
} from "@/lib/app-settings"
import { useAccountShellBootstrap } from "@/components/providers/account-shell-bootstrap-provider"
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"

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
  const {
    ownerKey,
    syncEnabled,
    status,
    appSettings,
    writeAppSettingsPatch,
  } = useAccountShellBootstrap()
  const [settings, setSettings] = useState<Settings>(defaultSettings)
  const settingsRef = useRef<Settings>(defaultSettings)
  const [localHydrated, setLocalHydrated] = useState(false)
  const pendingPreReadySettingsRef = useRef<{
    ownerKey: string | null
    settings: Partial<Settings>
  }>({ ownerKey: null, settings: {} })
  const serverProjectionAdoptedRef = useRef<{
    ownerKey: string | null
    ready: boolean
  }>({ ownerKey: null, ready: false })
  const settingsWriteRevisionRef = useRef(0)
  const pendingSettingsWriteRef = useRef<{
    failed: boolean
    ownerKey: string
    revision: number
    settings: Settings
  } | null>(null)

  /** Retains the newest owner-scoped snapshot until the shared writer confirms it. */
  const queueSettingsWrite = useCallback((writeOwnerKey: string, updated: Settings) => {
    const revision = settingsWriteRevisionRef.current + 1
    settingsWriteRevisionRef.current = revision
    pendingSettingsWriteRef.current = {
      failed: false,
      ownerKey: writeOwnerKey,
      revision,
      settings: updated,
    }
    void writeAppSettingsPatch(updated).then((succeeded) => {
      const pendingWrite = pendingSettingsWriteRef.current
      if (
        pendingWrite?.ownerKey !== writeOwnerKey
        || pendingWrite.revision !== revision
      ) {
        return
      }
      if (!succeeded) {
        pendingWrite.failed = true
        return
      }
      pendingSettingsWriteRef.current = null
      if (pendingPreReadySettingsRef.current.ownerKey === writeOwnerKey) {
        pendingPreReadySettingsRef.current = { ownerKey: null, settings: {} }
      }
    })
  }, [writeAppSettingsPatch])

  useEffect(() => {
    if (!ownerKey || !syncEnabled || status !== "ready") return
    const retryOwnerKey = ownerKey
    const handleOnline = () => {
      const pendingWrite = pendingSettingsWriteRef.current
      if (pendingWrite?.ownerKey !== retryOwnerKey || !pendingWrite.failed) return
      queueSettingsWrite(retryOwnerKey, pendingWrite.settings)
    }
    window.addEventListener("online", handleOnline)
    return () => window.removeEventListener("online", handleOnline)
  }, [ownerKey, queueSettingsWrite, status, syncEnabled])

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
    settingsRef.current = nextSettings
    setSettings(nextSettings)
    setLocalHydrated(true)
  }, [])

  useEffect(() => {
    if (!ownerKey || !syncEnabled || status !== "ready") {
      serverProjectionAdoptedRef.current = { ownerKey, ready: false }
    }
  }, [ownerKey, status, syncEnabled])

  useEffect(() => {
    if (!localHydrated || !ownerKey || !syncEnabled || status !== "ready") {
      return
    }

    const pendingWrite = pendingSettingsWriteRef.current?.ownerKey === ownerKey
      ? pendingSettingsWriteRef.current
      : null
    const pendingLocalEdits = pendingWrite?.settings
      ?? (pendingPreReadySettingsRef.current.ownerKey === ownerKey
        ? pendingPreReadySettingsRef.current.settings
        : {})
    const nextSettings = reconcileAppSettingsAfterBootstrap(
      appSettings.app,
      pendingLocalEdits,
    ) as Settings
    serverProjectionAdoptedRef.current = { ownerKey, ready: true }
    localStorage.setItem("massage-lab-settings", JSON.stringify(nextSettings))
    settingsRef.current = nextSettings
    setSettings(nextSettings)
    if (Object.keys(pendingLocalEdits).length > 0) {
      queueSettingsWrite(ownerKey, nextSettings)
    }
  }, [appSettings.app, localHydrated, ownerKey, queueSettingsWrite, status, syncEnabled])

  const updateSettings = (newSettings: Partial<Settings>) => {
    const adoptedProjection = serverProjectionAdoptedRef.current
    const isPreReadyEdit = Boolean(
      ownerKey
      && syncEnabled
      && (
        status !== "ready"
        || adoptedProjection.ownerKey !== ownerKey
        || !adoptedProjection.ready
      ),
    )
    if (isPreReadyEdit) {
      const pendingSettings = pendingPreReadySettingsRef.current.ownerKey === ownerKey
        ? pendingPreReadySettingsRef.current.settings
        : {}
      pendingPreReadySettingsRef.current = {
        ownerKey,
        settings: {
          ...pendingSettings,
          ...newSettings,
        },
      }
    }
    const updated = normalizeSettings({ ...settingsRef.current, ...newSettings })
    settingsRef.current = updated
    localStorage.setItem("massage-lab-settings", JSON.stringify(updated))
    setSettings(updated)

    if (ownerKey && syncEnabled && status === "ready" && !isPreReadyEdit) {
      queueSettingsWrite(ownerKey, updated)
    }
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

