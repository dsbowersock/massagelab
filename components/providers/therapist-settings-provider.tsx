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

/** Keeps denied or full browser storage from interrupting in-memory/cloud profile flow. */
function writeTherapistSettingsStorage(storageKey: string, settings: TherapistSettings): boolean {
  try {
    localStorage.setItem(storageKey, JSON.stringify(settings))
    return true
  } catch {
    return false
  }
}

/** Keeps unavailable or malformed browser storage from blocking owner adoption. */
function removeTherapistSettingsStorage(storageKey: string): void {
  try {
    localStorage.removeItem(storageKey)
  } catch {
    // In-memory and cloud state remain authoritative when storage is denied.
  }
}

/** Reads and projects one owner snapshot without allowing storage/JSON failures to escape. */
function readTherapistSettingsStorage(storageKey: string): TherapistSettings | null {
  try {
    const savedSettings = localStorage.getItem(storageKey)
    if (!savedSettings) return null
    const storedSettings = projectStoredTherapistSettings(JSON.parse(savedSettings))
    if (!storedSettings) removeTherapistSettingsStorage(storageKey)
    return storedSettings
  } catch {
    removeTherapistSettingsStorage(storageKey)
    return null
  }
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

/**
 * Serializes full profile snapshots per owner, supersedes only queued work,
 * and retains the latest failed snapshot for an explicit or subsequent retry.
 */
export function createTherapistProfileWriter({
  send,
}: {
  send: (request: { ownerKey: string, settings: TherapistSettings }) => Promise<boolean>
}) {
  type Batch = {
    ownerKey: string
    settings: TherapistSettings
    settle: Array<(succeeded: boolean) => void>
  }
  let activeBatch: Batch | null = null
  let queuedBatch: Batch | null = null
  let disposed = false
  const failedByOwner = new Map<string, TherapistSettings>()

  const drain = async () => {
    if (activeBatch) return

    while (queuedBatch) {
      const batch = queuedBatch
      queuedBatch = null
      activeBatch = batch
      let succeeded = false
      try {
        succeeded = await send({ ownerKey: batch.ownerKey, settings: batch.settings })
      } catch {
        succeeded = false
      }
      const nextQueuedBatch = queuedBatch as Batch | null
      const newerSameOwner = nextQueuedBatch?.ownerKey === batch.ownerKey
      if (succeeded) {
        if (!newerSameOwner) failedByOwner.delete(batch.ownerKey)
      } else if (!newerSameOwner) {
        failedByOwner.set(batch.ownerKey, batch.settings)
      }
      for (const settle of batch.settle) settle(succeeded)
      activeBatch = null
    }
  }

  const enqueue = (request: { ownerKey: string, settings: TherapistSettings }) => {
    if (disposed || !request.ownerKey) return Promise.resolve(false)
    failedByOwner.delete(request.ownerKey)
    return new Promise<boolean>((resolve) => {
      if (queuedBatch?.ownerKey === request.ownerKey) {
        queuedBatch.settings = request.settings
        queuedBatch.settle.push(resolve)
      } else {
        if (queuedBatch) {
          for (const settle of queuedBatch.settle) settle(false)
        }
        queuedBatch = { ...request, settle: [resolve] }
      }
      void drain()
    })
  }

  return {
    enqueue,
    getFailed(ownerKey: string) {
      return failedByOwner.get(ownerKey) ?? null
    },
    retry(ownerKey: string) {
      const settings = failedByOwner.get(ownerKey)
      return settings ? enqueue({ ownerKey, settings }) : Promise.resolve(false)
    },
    dispose() {
      disposed = true
      failedByOwner.clear()
      if (queuedBatch) {
        for (const settle of queuedBatch.settle) settle(false)
        queuedBatch = null
      }
    },
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
  onHydrationStarted = () => undefined,
}: {
  applyProfile: (ownerKey: string, settings: TherapistSettings) => void
  initialOwnerKey: string | null
  initialSyncEnabled: boolean
  loadProfile?: LoadTherapistProfile
  onHydrationStarted?: (ownerKey: string) => void
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
    onHydrationStarted(requestOwnerKey)
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
  const profileWriteOwnerRef = useRef({ ownerKey, syncEnabled })
  const profileWriteControllerRef = useRef<AbortController | null>(null)
  const profileWriterRef = useRef<ReturnType<typeof createTherapistProfileWriter> | null>(null)
  const sendProfileWrite = useCallback(async ({
    ownerKey: requestOwnerKey,
    settings: nextSettings,
  }: {
    ownerKey: string
    settings: TherapistSettings
  }) => {
    const currentOwner = profileWriteOwnerRef.current
    if (currentOwner.ownerKey !== requestOwnerKey || !currentOwner.syncEnabled) {
      return false
    }
    const controller = new AbortController()
    profileWriteControllerRef.current = controller
    try {
      const response = await fetchWithTimeout("/api/account/profile", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ therapistSettings: nextSettings }),
      })
      return response.ok
        && !controller.signal.aborted
        && profileWriteOwnerRef.current.ownerKey === requestOwnerKey
    } catch {
      return false
    } finally {
      if (profileWriteControllerRef.current === controller) {
        profileWriteControllerRef.current = null
      }
    }
  }, [])
  const getProfileWriter = useCallback(() => {
    if (!profileWriterRef.current) {
      profileWriterRef.current = createTherapistProfileWriter({ send: sendProfileWrite })
    }
    return profileWriterRef.current
  }, [sendProfileWrite])
  const enqueueProfileWrite = useCallback((profileOwnerKey: string, nextSettings: TherapistSettings) => (
    getProfileWriter().enqueue({ ownerKey: profileOwnerKey, settings: nextSettings })
  ), [getProfileWriter])
  const retryFailedProfileWrite = useCallback((retryOwnerKey: string) => {
    const currentOwner = profileWriteOwnerRef.current
    if (
      currentOwner.ownerKey !== retryOwnerKey
      || !currentOwner.syncEnabled
      || !profileWriterRef.current
    ) {
      return Promise.resolve(false)
    }
    return profileWriterRef.current.retry(retryOwnerKey)
  }, [])
  const hydrationEditsRef = useRef<{
    fields: Set<keyof TherapistSettings>
    ownerKey: string | null
  }>({ fields: new Set(), ownerKey: null })
  const markCloudHydrationStarted = useCallback((profileOwnerKey: string) => {
    if (hydrationEditsRef.current.ownerKey !== profileOwnerKey) {
      hydrationEditsRef.current = { fields: new Set(), ownerKey: profileOwnerKey }
    }
  }, [])
  const applyCloudProfile = useCallback((profileOwnerKey: string, nextSettings: TherapistSettings) => {
    const currentSettings = settingsRef.current.ownerKey === profileOwnerKey
      ? settingsRef.current.settings
      : defaultSettings
    const hydrationEdits = hydrationEditsRef.current.ownerKey === profileOwnerKey
      ? hydrationEditsRef.current.fields
      : new Set<keyof TherapistSettings>()
    const reconciledSettings = { ...nextSettings }
    for (const field of hydrationEdits) {
      reconciledSettings[field] = currentSettings[field]
    }
    const nextOwnedSettings = { ownerKey: profileOwnerKey, settings: reconciledSettings }
    settingsRef.current = nextOwnedSettings
    writeTherapistSettingsStorage(
      therapistSettingsStorageKey(profileOwnerKey),
      reconciledSettings,
    )
    setOwnedSettings(nextOwnedSettings)
    hydrationEditsRef.current = { fields: new Set(), ownerKey: null }
    if (hydrationEdits.size > 0) {
      void enqueueProfileWrite(profileOwnerKey, reconciledSettings)
    }
  }, [enqueueProfileWrite])
  // Construction stores the callback; only a later demanded network result can invoke it.
  // eslint-disable-next-line react-hooks/refs -- no ref access occurs during this render.
  const [coordinator] = useState(() => createTherapistSettingsCloudCoordinator({
    initialOwnerKey: ownerKey,
    initialSyncEnabled: syncEnabled,
    applyProfile: applyCloudProfile,
    onHydrationStarted: markCloudHydrationStarted,
  }))
  const [cloudState, setCloudState] = useState<TherapistCloudState>(() => coordinator.getState())
  const adoptedOwnerRef = useRef({ ownerKey, syncEnabled })

  useEffect(() => {
    let nextSettings = defaultSettings
    const storageKey = therapistSettingsStorageKey(ownerKey)
    const storedSettings = readTherapistSettingsStorage(storageKey)
    if (storedSettings) {
      nextSettings = storedSettings
    }
    const nextOwnedSettings = { ownerKey, settings: nextSettings }
    if (hydrationEditsRef.current.ownerKey !== ownerKey) {
      hydrationEditsRef.current = { fields: new Set(), ownerKey: null }
    }
    if (storedSettings) {
      writeTherapistSettingsStorage(storageKey, nextSettings)
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
    profileWriteControllerRef.current?.abort()
    profileWriteControllerRef.current = null
    profileWriteOwnerRef.current = { ownerKey, syncEnabled }
    return coordinator.adopt({ ownerKey, syncEnabled })
  }, [coordinator, ownerKey, syncEnabled])

  useEffect(() => {
    void adoptCurrentOwner()
  }, [adoptCurrentOwner])

  useEffect(() => {
    if (!ownerKey || !syncEnabled) return
    const retryOwnerKey = ownerKey
    const handleOnline = () => {
      void retryFailedProfileWrite(retryOwnerKey)
    }
    window.addEventListener("online", handleOnline)
    return () => window.removeEventListener("online", handleOnline)
  }, [ownerKey, retryFailedProfileWrite, syncEnabled])

  useEffect(() => () => {
    profileWriteControllerRef.current?.abort()
    profileWriteControllerRef.current = null
    profileWriterRef.current?.dispose()
    profileWriterRef.current = null
    coordinator.dispose()
  }, [coordinator])

  const ensureCloudHydrated = useCallback(
    async () => {
      const currentCloudState = coordinator.getState()
      if (
        ownerKey
        && (
          currentCloudState.ownerKey !== ownerKey
          || currentCloudState.status !== "ready"
        )
      ) {
        markCloudHydrationStarted(ownerKey)
      }
      await adoptCurrentOwner()
      await coordinator.ensureCloudHydrated()
      if (ownerKey) await retryFailedProfileWrite(ownerKey)
    },
    [
      adoptCurrentOwner,
      coordinator,
      markCloudHydrationStarted,
      ownerKey,
      retryFailedProfileWrite,
    ],
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
    writeTherapistSettingsStorage(therapistSettingsStorageKey(ownerKey), updated)
    setOwnedSettings(nextOwnedSettings)

    if (hydrationEditsRef.current.ownerKey === ownerKey) {
      for (const field of Object.keys(newSettings) as Array<keyof TherapistSettings>) {
        hydrationEditsRef.current.fields.add(field)
      }
    }

    if (canSync && ownerKey) {
      void enqueueProfileWrite(ownerKey, updated)
    }
  }, [canSync, enqueueProfileWrite, ownerKey])
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
