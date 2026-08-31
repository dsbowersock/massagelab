"use client"

import { useAccountShellBootstrap } from "@/components/providers/account-shell-bootstrap-provider"
import { fetchJsonWithTimeout, fetchWithTimeout } from "@/lib/client-fetch"
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

interface TherapistSettings {
  name: string
  location: string
  licenseNumber: string
  licenseOrganization: string
  npiNumber: string
}

type TherapistCloudStatus = "disabled" | "idle" | "loading" | "ready" | "failed"

type TherapistCloudState = {
  ownerKey: string | null
  status: TherapistCloudStatus
  canSync: boolean
}

type OwnedTherapistSettings = {
  ownerKey: string | null
  settings: TherapistSettings
}

type TherapistSettingsContextType = {
  settings: TherapistSettings
  updateSettings: (newSettings: Partial<TherapistSettings>) => void
  ensureCloudHydrated: () => Promise<void>
}

type LoadTherapistProfile = (input: {
  ownerKey: string
  signal: AbortSignal
}) => Promise<unknown>

type TherapistSettingsCloudCoordinator = {
  adopt: (owner: { ownerKey: string | null, syncEnabled: boolean }) => Promise<void>
  dispose: () => void
  ensureCloudHydrated: () => Promise<void>
  getState: () => TherapistCloudState
  subscribe: (listener: (state: TherapistCloudState) => void) => () => void
}

const THERAPIST_SETTINGS_STORAGE_KEY_PREFIX = "massage-lab-therapist-settings"

const defaultSettings: TherapistSettings = {
  name: "",
  location: "",
  licenseNumber: "",
  licenseOrganization: "",
  npiNumber: "",
}

const TherapistSettingsContext = createContext<TherapistSettingsContextType | undefined>(undefined)

/** Keeps browser persistence isolated to one authenticated or anonymous owner. */
export function therapistSettingsStorageKey(ownerKey: string | null): string {
  return ownerKey === null
    ? `${THERAPIST_SETTINGS_STORAGE_KEY_PREFIX}:anonymous`
    : `${THERAPIST_SETTINGS_STORAGE_KEY_PREFIX}:account:${encodeURIComponent(ownerKey)}`
}

function objectRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {}
}

/** Keeps device and cloud therapist settings on the existing five-field allowlist. */
function normalizeTherapistSettings(value: unknown): TherapistSettings {
  const settings = objectRecord(value)
  return {
    name: typeof settings.name === "string" ? settings.name : "",
    location: typeof settings.location === "string" ? settings.location : "",
    licenseNumber: typeof settings.licenseNumber === "string" ? settings.licenseNumber : "",
    licenseOrganization: typeof settings.licenseOrganization === "string"
      ? settings.licenseOrganization
      : "",
    npiNumber: typeof settings.npiNumber === "string" ? settings.npiNumber : "",
  }
}

/** Validates the complete browser snapshot and projects only its five allowed fields. */
export function projectStoredTherapistSettings(value: unknown): TherapistSettings | null {
  const settings = objectRecord(value)
  if (
    typeof settings.name !== "string"
    || typeof settings.location !== "string"
    || typeof settings.licenseNumber !== "string"
    || typeof settings.licenseOrganization !== "string"
    || typeof settings.npiNumber !== "string"
  ) {
    return null
  }
  return normalizeTherapistSettings(settings)
}

function projectTherapistProfile(value: unknown): TherapistSettings {
  const profile = objectRecord(value)
  return normalizeTherapistSettings({
    name: profile.therapistName,
    location: profile.therapistLocation,
    licenseNumber: profile.licenseNumber,
    licenseOrganization: profile.licenseOrganization,
    npiNumber: profile.npiNumber,
  })
}

async function loadTherapistProfile({ signal }: { signal: AbortSignal }) {
  const { response, json } = await fetchJsonWithTimeout<unknown>(
    "/api/account/profile",
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
    throw new Error("Therapist profile is temporarily unavailable.")
  }
  return json
}

/**
 * Owns the first-consumer profile read for one account generation.
 * Creation and owner adoption are intentionally network-free.
 */
export function createTherapistSettingsCloudCoordinator({
  applyProfile,
  initialOwnerKey,
  initialSyncEnabled,
  loadProfile = loadTherapistProfile,
}: {
  applyProfile: (ownerKey: string, settings: TherapistSettings) => void
  initialOwnerKey: string | null
  initialSyncEnabled: boolean
  loadProfile?: LoadTherapistProfile
}): TherapistSettingsCloudCoordinator {
  let ownerKey = initialOwnerKey
  let syncEnabled = initialSyncEnabled
  let generation = 0
  let attemptedOwnerKey: string | null = null
  let controller: AbortController | null = null
  let inFlight: Promise<void> | null = null
  let state: TherapistCloudState = {
    ownerKey,
    status: ownerKey && syncEnabled ? "idle" : "disabled",
    canSync: false,
  }
  const listeners = new Set<(nextState: TherapistCloudState) => void>()

  function publish(nextState: TherapistCloudState) {
    state = nextState
    for (const listener of listeners) listener(state)
  }

  function ensureCloudHydrated(): Promise<void> {
    if (!ownerKey || !syncEnabled) return Promise.resolve()
    if (inFlight) return inFlight
    if (attemptedOwnerKey === ownerKey) return Promise.resolve()

    attemptedOwnerKey = ownerKey
    const requestOwnerKey = ownerKey
    const requestGeneration = generation
    const requestController = new AbortController()
    controller = requestController
    publish({ ownerKey: requestOwnerKey, status: "loading", canSync: false })

    const operation = (async () => {
      try {
        const profile = await loadProfile({
          ownerKey: requestOwnerKey,
          signal: requestController.signal,
        })
        if (
          requestController.signal.aborted
          || requestGeneration !== generation
          || ownerKey !== requestOwnerKey
        ) return

        applyProfile(requestOwnerKey, projectTherapistProfile(profile))
        publish({ ownerKey: requestOwnerKey, status: "ready", canSync: true })
      } catch {
        if (
          requestController.signal.aborted
          || requestGeneration !== generation
          || ownerKey !== requestOwnerKey
        ) return
        attemptedOwnerKey = null
        publish({ ownerKey: requestOwnerKey, status: "failed", canSync: false })
      }
    })()

    const request = operation.finally(() => {
      if (controller !== requestController) return
      controller = null
      inFlight = null
    })
    inFlight = request
    return request
  }

  return {
    adopt(nextOwner) {
      generation += 1
      controller?.abort()
      controller = null
      inFlight = null
      attemptedOwnerKey = null
      ownerKey = nextOwner.ownerKey
      syncEnabled = nextOwner.syncEnabled
      publish({
        ownerKey,
        status: ownerKey && syncEnabled ? "idle" : "disabled",
        canSync: false,
      })
      return Promise.resolve()
    },
    dispose() {
      generation += 1
      controller?.abort()
      controller = null
      inFlight = null
      attemptedOwnerKey = null
      listeners.clear()
    },
    ensureCloudHydrated,
    getState() {
      return state
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

export function TherapistSettingsProvider({ children }: { children: ReactNode }) {
  const { ownerKey, syncEnabled } = useAccountShellBootstrap()
  const [ownedSettings, setOwnedSettings] = useState<OwnedTherapistSettings>(() => ({
    ownerKey,
    settings: defaultSettings,
  }))
  // A new account sees empty settings on its first render. Its own device or
  // cloud values can replace them only after owner-scoped hydration.
  const settings = ownedSettings.ownerKey === ownerKey
    ? ownedSettings.settings
    : defaultSettings
  // Compose back-to-back edits from the latest value without putting storage
  // or network side effects inside React's replayable state updater.
  const settingsRef = useRef<OwnedTherapistSettings>({ ownerKey, settings })
  const applyCloudProfile = useCallback((profileOwnerKey: string, nextSettings: TherapistSettings) => {
    const nextOwnedSettings = { ownerKey: profileOwnerKey, settings: nextSettings }
    settingsRef.current = nextOwnedSettings
    localStorage.setItem(
      therapistSettingsStorageKey(profileOwnerKey),
      JSON.stringify(nextSettings),
    )
    setOwnedSettings(nextOwnedSettings)
  }, [])
  // Construction stores the callback; only a later demanded network result can invoke it.
  // eslint-disable-next-line react-hooks/refs -- no ref access occurs during this render.
  const [coordinator] = useState(() => createTherapistSettingsCloudCoordinator({
    initialOwnerKey: ownerKey,
    initialSyncEnabled: syncEnabled,
    applyProfile: applyCloudProfile,
  }))
  const [cloudState, setCloudState] = useState<TherapistCloudState>(() => coordinator.getState())
  const adoptedOwnerRef = useRef({ ownerKey, syncEnabled })

  useEffect(() => {
    let nextSettings = defaultSettings
    const storageKey = therapistSettingsStorageKey(ownerKey)
    const savedSettings = localStorage.getItem(storageKey)
    let shouldNormalizeStoredSettings = false
    if (savedSettings) {
      try {
        const storedSettings = projectStoredTherapistSettings(JSON.parse(savedSettings))
        if (storedSettings) {
          nextSettings = storedSettings
          shouldNormalizeStoredSettings = true
        } else {
          localStorage.removeItem(storageKey)
        }
      } catch {
        localStorage.removeItem(storageKey)
      }
    }
    const nextOwnedSettings = { ownerKey, settings: nextSettings }
    if (shouldNormalizeStoredSettings) {
      localStorage.setItem(storageKey, JSON.stringify(nextSettings))
    }
    settingsRef.current = nextOwnedSettings
    setOwnedSettings(nextOwnedSettings)
  }, [ownerKey])

  useEffect(() => coordinator.subscribe(setCloudState), [coordinator])

  /** Adopts a changed account/sync generation once before any demanded read. */
  const adoptCurrentOwner = useCallback(() => {
    const adopted = adoptedOwnerRef.current
    if (adopted.ownerKey === ownerKey && adopted.syncEnabled === syncEnabled) {
      return Promise.resolve()
    }
    adoptedOwnerRef.current = { ownerKey, syncEnabled }
    return coordinator.adopt({ ownerKey, syncEnabled })
  }, [coordinator, ownerKey, syncEnabled])

  useEffect(() => {
    void adoptCurrentOwner()
  }, [adoptCurrentOwner])

  useEffect(() => () => coordinator.dispose(), [coordinator])

  const ensureCloudHydrated = useCallback(
    async () => {
      await adoptCurrentOwner()
      await coordinator.ensureCloudHydrated()
    },
    [adoptCurrentOwner, coordinator],
  )
  const canSync = Boolean(
    ownerKey
    && syncEnabled
    && cloudState.ownerKey === ownerKey
    && cloudState.canSync,
  )
  const updateSettings = useCallback((newSettings: Partial<TherapistSettings>) => {
    const currentSettings = settingsRef.current.ownerKey === ownerKey
      ? settingsRef.current.settings
      : defaultSettings
    const updated = normalizeTherapistSettings({ ...currentSettings, ...newSettings })
    const nextOwnedSettings = { ownerKey, settings: updated }
    settingsRef.current = nextOwnedSettings
    localStorage.setItem(therapistSettingsStorageKey(ownerKey), JSON.stringify(updated))
    setOwnedSettings(nextOwnedSettings)

    if (canSync) {
      void fetchWithTimeout("/api/account/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ therapistSettings: updated }),
      }).catch(() => undefined)
    }
  }, [canSync, ownerKey])
  const value = useMemo<TherapistSettingsContextType>(() => ({
    settings,
    updateSettings,
    ensureCloudHydrated,
  }), [ensureCloudHydrated, settings, updateSettings])

  return (
    <TherapistSettingsContext.Provider value={value}>
      {children}
    </TherapistSettingsContext.Provider>
  )
}

export function useTherapistSettings() {
  const context = useContext(TherapistSettingsContext)
  const ensureCloudHydrated = context?.ensureCloudHydrated
  useEffect(() => {
    if (ensureCloudHydrated) void ensureCloudHydrated()
  }, [ensureCloudHydrated])

  if (context === undefined) {
    throw new Error("useTherapistSettings must be used within a TherapistSettingsProvider")
  }
  return {
    settings: context.settings,
    updateSettings: context.updateSettings,
  }
}
