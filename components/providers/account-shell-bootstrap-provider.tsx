"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import type { AccountShellBootstrap } from "@/components/sidebar/sidebar"
import { projectAccountShellAppSettings } from "@/lib/account-shell-bootstrap"
import { createSerializedAppSettingsPatchWriter } from "@/lib/account-preferences"
import { fetchJsonWithTimeout, fetchWithTimeout } from "@/lib/client-fetch"

type BootstrapAppSettings = AccountShellBootstrap["appSettings"]
type BootstrapStatus = "anonymous" | "ready" | "fallback-loading" | "failed"
export type AccountAppSettingsPatch = Partial<BootstrapAppSettings["app"]> & {
  musicVisualizer?: BootstrapAppSettings["musicVisualizer"]
}

type BootstrapValue = {
  ownerKey: string | null
  syncEnabled: boolean
  status: BootstrapStatus
  appSettings: BootstrapAppSettings
}

type BootstrapContextValue = BootstrapValue & {
  retryFallback: () => Promise<void>
  writeAppSettingsPatch: (patch: AccountAppSettingsPatch) => Promise<boolean>
}

type LoadPreferences = (input: {
  ownerKey: string
  signal: AbortSignal
}) => Promise<unknown>

type BootstrapCoordinator = {
  adopt: (bootstrap: AccountShellBootstrap) => Promise<void>
  dispose: () => void
  getValue: () => BootstrapValue
  retryFallback: () => Promise<void>
  subscribe: (listener: (value: BootstrapValue) => void) => () => void
}

const AccountShellBootstrapContext = createContext<BootstrapContextValue | null>(null)

function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

/** Re-normalizes the trusted server projection without accepting extra keys. */
function normalizeServerProjection(value: BootstrapAppSettings): BootstrapAppSettings {
  const projected = objectRecord(value)
  const app = objectRecord(projected.app)
  const musicVisualizer = objectRecord(projected.musicVisualizer)

  return projectAccountShellAppSettings({
    appBarPosition: app.appBarPosition,
    sidebarPosition: app.sidebarPosition,
    sidebarTriggerPosition: app.sidebarTriggerPosition,
    ambientMotionMode: app.ambientMotionMode,
    themeMode: app.themeMode,
    hapticFeedbackEnabled: app.hapticFeedbackEnabled,
    musicVisualizer: {
      defaultBackgroundId: musicVisualizer.defaultBackgroundId,
      showClock: musicVisualizer.showClock,
    },
  })
}

function valueFromServer(bootstrap: AccountShellBootstrap): BootstrapValue {
  if (!bootstrap.ownerKey || bootstrap.preferenceStatus === "anonymous") {
    return {
      ownerKey: null,
      syncEnabled: false,
      status: "anonymous",
      appSettings: projectAccountShellAppSettings(undefined),
    }
  }

  if (bootstrap.preferenceStatus === "ready") {
    return {
      ownerKey: bootstrap.ownerKey,
      syncEnabled: bootstrap.syncEnabled,
      status: "ready",
      appSettings: normalizeServerProjection(bootstrap.appSettings),
    }
  }

  return {
    ownerKey: bootstrap.ownerKey,
    syncEnabled: bootstrap.syncEnabled,
    status: "failed",
    appSettings: projectAccountShellAppSettings(undefined),
  }
}

async function loadAccountShellPreferences({ signal }: { signal: AbortSignal }) {
  const { response, json } = await fetchJsonWithTimeout<unknown>(
    "/api/account/preferences",
    {
      method: "GET",
      cache: "no-store",
      credentials: "same-origin",
      headers: { accept: "application/json" },
      signal,
    },
    10_000,
  )

  if (!response.ok) {
    throw new Error("Account preferences are temporarily unavailable.")
  }

  return json
}

/**
 * Owns the current account generation and its sole failure-only fallback.
 * Raw response data is projected before listeners can observe it.
 */
export function createAccountShellBootstrapCoordinator({
  initialBootstrap,
  loadPreferences = loadAccountShellPreferences,
}: {
  initialBootstrap: AccountShellBootstrap
  loadPreferences?: LoadPreferences
}): BootstrapCoordinator {
  let value = valueFromServer(initialBootstrap)
  let generation = 0
  let fallbackController: AbortController | null = null
  let inFlight: Promise<void> | null = null
  const listeners = new Set<(nextValue: BootstrapValue) => void>()

  function publish(nextValue: BootstrapValue) {
    value = nextValue
    for (const listener of listeners) {
      listener(value)
    }
  }

  function startFallback(): Promise<void> {
    if (inFlight) {
      return inFlight
    }
    if (!value.ownerKey || !value.syncEnabled || value.status !== "failed") {
      return Promise.resolve()
    }

    const requestOwnerKey = value.ownerKey
    const requestGeneration = generation
    const requestController = new AbortController()
    fallbackController = requestController
    publish({ ...value, status: "fallback-loading" })

    const operation = (async () => {
      try {
        const body = objectRecord(await loadPreferences({
          ownerKey: requestOwnerKey,
          signal: requestController.signal,
        }))
        if (
          requestController.signal.aborted
          || requestGeneration !== generation
          || value.ownerKey !== requestOwnerKey
        ) {
          return
        }

        publish({
          ownerKey: requestOwnerKey,
          syncEnabled: value.syncEnabled,
          status: "ready",
          appSettings: projectAccountShellAppSettings(body.appSettings),
        })
      } catch {
        if (
          requestController.signal.aborted
          || requestGeneration !== generation
          || value.ownerKey !== requestOwnerKey
        ) {
          return
        }

        publish({
          ownerKey: requestOwnerKey,
          syncEnabled: value.syncEnabled,
          status: "failed",
          appSettings: projectAccountShellAppSettings(undefined),
        })
      }
    })()

    const request = operation.finally(() => {
      if (fallbackController !== requestController) {
        return
      }
      inFlight = null
      fallbackController = null
    })
    inFlight = request
    return request
  }

  return {
    adopt(bootstrap) {
      generation += 1
      fallbackController?.abort()
      fallbackController = null
      inFlight = null
      publish(valueFromServer(bootstrap))
      return startFallback()
    },
    dispose() {
      generation += 1
      fallbackController?.abort()
      fallbackController = null
      inFlight = null
      listeners.clear()
    },
    getValue() {
      return value
    },
    retryFallback() {
      return startFallback()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

export function AccountShellBootstrapProvider({
  children,
  initialBootstrap,
}: {
  children: ReactNode
  initialBootstrap: AccountShellBootstrap
}) {
  const [coordinator] = useState(() => (
    createAccountShellBootstrapCoordinator({ initialBootstrap })
  ))
  const [value, setValue] = useState<BootstrapValue>(() => coordinator.getValue())
  const initialBootstrapKey = JSON.stringify({
    syncEnabled: initialBootstrap.syncEnabled,
    preferenceStatus: initialBootstrap.preferenceStatus,
    appSettings: initialBootstrap.appSettings,
    hasPracticeMembership: initialBootstrap.hasPracticeMembership,
  })
  const adoptedBootstrapKeyRef = useRef<string | null>(null)
  const appSettingsWriteOwnerRef = useRef({
    ownerKey: value.ownerKey,
    syncEnabled: value.syncEnabled,
  })
  const appSettingsWriteControllerRef = useRef<AbortController | null>(null)
  const appSettingsPatchWriterRef = useRef<ReturnType<
    typeof createSerializedAppSettingsPatchWriter
  > | null>(null)

  useEffect(() => coordinator.subscribe(setValue), [coordinator])

  useEffect(() => {
    const adoptedBootstrapKey = `${initialBootstrap.ownerKey ?? "anonymous"}:${initialBootstrapKey}`
    if (adoptedBootstrapKeyRef.current === adoptedBootstrapKey) {
      return
    }
    adoptedBootstrapKeyRef.current = adoptedBootstrapKey
    void coordinator.adopt(initialBootstrap)
  }, [coordinator, initialBootstrap, initialBootstrapKey])

  useEffect(() => {
    const previousOwner = appSettingsWriteOwnerRef.current
    if (
      previousOwner.ownerKey !== value.ownerKey
      || previousOwner.syncEnabled !== value.syncEnabled
    ) {
      appSettingsWriteControllerRef.current?.abort()
      appSettingsWriteControllerRef.current = null
      appSettingsWriteOwnerRef.current = {
        ownerKey: value.ownerKey,
        syncEnabled: value.syncEnabled,
      }
    }
  }, [value.ownerKey, value.syncEnabled])

  useEffect(() => () => {
    adoptedBootstrapKeyRef.current = null
    appSettingsWriteControllerRef.current?.abort()
    appSettingsWriteControllerRef.current = null
    appSettingsPatchWriterRef.current?.dispose()
    appSettingsPatchWriterRef.current = null
    coordinator.dispose()
  }, [coordinator])

  const sendAppSettingsPatch = useCallback(async ({
    ownerKey: requestOwnerKey,
    patch,
  }: {
    ownerKey: string
    patch: Record<string, unknown>
  }) => {
    const currentOwner = appSettingsWriteOwnerRef.current
    if (currentOwner.ownerKey !== requestOwnerKey || !currentOwner.syncEnabled) {
      return false
    }

    const controller = new AbortController()
    appSettingsWriteControllerRef.current = controller
    try {
      const response = await fetchWithTimeout("/api/account/preferences", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ appSettings: patch }),
      })
      return response.ok
        && !controller.signal.aborted
        && appSettingsWriteOwnerRef.current.ownerKey === requestOwnerKey
    } catch {
      return false
    } finally {
      if (appSettingsWriteControllerRef.current === controller) {
        appSettingsWriteControllerRef.current = null
      }
    }
  }, [])

  const getAppSettingsPatchWriter = useCallback(() => {
    if (!appSettingsPatchWriterRef.current) {
      appSettingsPatchWriterRef.current = createSerializedAppSettingsPatchWriter({
        send: sendAppSettingsPatch,
      })
    }
    return appSettingsPatchWriterRef.current
  }, [sendAppSettingsPatch])

  const writeAppSettingsPatch = useCallback((patch: AccountAppSettingsPatch) => {
    if (!value.ownerKey || !value.syncEnabled) return Promise.resolve(false)
    return getAppSettingsPatchWriter().enqueue({
      ownerKey: value.ownerKey,
      patch,
    })
  }, [getAppSettingsPatchWriter, value.ownerKey, value.syncEnabled])

  const retryFallback = useCallback(
    () => coordinator.retryFallback(),
    [coordinator],
  )
  const contextValue = useMemo<BootstrapContextValue>(() => ({
    ...value,
    retryFallback,
    writeAppSettingsPatch,
  }), [retryFallback, value, writeAppSettingsPatch])

  return (
    <AccountShellBootstrapContext.Provider value={contextValue}>
      {children}
    </AccountShellBootstrapContext.Provider>
  )
}

export function useAccountShellBootstrap(): BootstrapContextValue {
  const context = useContext(AccountShellBootstrapContext)
  if (!context) {
    throw new Error("useAccountShellBootstrap must be used inside AccountShellBootstrapProvider.")
  }
  return context
}
