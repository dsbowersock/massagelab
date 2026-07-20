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
import {
  ATMOSPHERE_STORAGE_KEY,
  LEGACY_ATMOSPHERE_STORAGE_KEY,
  createDefaultAtmosphereStorage,
  parseAtmosphereStorage,
  serializeAtmosphereStorage,
} from "@/lib/atmosphere/storage"
import { BACKGROUND_STORAGE_KEYS } from "@/lib/background-options"
import { canSyncAccountPreferencesFromSession } from "@/lib/account-preferences"
import { fetchWithTimeout } from "@/lib/client-fetch"
import {
  normalizeMusicVisualizerAccountPreferences,
  normalizeMusicVisualizerDevicePreferences,
} from "@/lib/music-visualizer"

type PlaybackState = "stopped" | "loading" | "playing" | "failed"

export interface MusicVisualizerState {
  backgroundId: string | null
  accountDefaultBackgroundId: string | null
  showClock: boolean
  storageStatus: "loading" | "available" | "unavailable" | "unsupported-version"
  storageError: string | null
  accountStatus: "anonymous" | "loading" | "synced" | "saving" | "error"
  accountError: string | null
  signedIn: boolean
}

interface MusicContextType {
  activeStationId: string | null
  activeStationTitle: string | null
  playbackState: PlaybackState
  loadingProgress: number | null
  loadingStartedAt: number | null
  error: string | null
  favorites: string[]
  recentStations: string[]
  volume: number
  miniPlayerCollapsed: boolean
  visualizer: MusicVisualizerState
  playStation: (stationId: string) => Promise<void>
  playNextStation: () => Promise<void>
  playPreviousStation: () => Promise<void>
  prewarmStation: (
    stationId: string,
    options?: { includeSamplePayloads?: boolean, signal?: AbortSignal },
  ) => Promise<void>
  stopCurrent: () => Promise<void>
  setVolume: (volume: number) => void
  toggleFavorite: (stationId: string) => void
  setMiniPlayerCollapsed: (collapsed: boolean) => void
  selectVisualizerBackground: (backgroundId: string) => void
  setVisualizerShowClock: (showClock: boolean) => void
  setCurrentVisualizerBackgroundAsDefault: () => Promise<void>
  restoreVisualizerAccountDefault: () => void
  retryVisualizerAccountSync: () => Promise<void>
}

interface AtmosphereStorageState {
  version: number
  favorites: string[]
  recentStations: string[]
  volume: number
  miniPlayerCollapsed: boolean
  visualizer: {
    backgroundId: string | null
    showClock: boolean
  }
  migrations: {
    legacyMusicBackground: true
  }
}

type MusicVisualizerAccountPreferences = {
  defaultBackgroundId: string | null
  showClock: boolean
}

type StoredAtmosphereHydration = {
  state: AtmosphereStorageState
  storageStatus: MusicVisualizerState["storageStatus"]
  storageError: string | null
}

interface RuntimeAdapterPayload {
  station: {
    id: string
    title?: string
    artist?: string
    attribution?: {
      artist?: string
    }
    enabled?: boolean
    disabledReason?: string
    runtime?: {
      adapterId?: string
      defaultOptions?: Record<string, number>
      hostedSampleIndexUrl?: string
      hostedSampleIndexFormatUrls?: Partial<Record<"opus" | "aac" | "mp3", string>>
      pieceId?: string
      sampleNameGroups?: Array<string | string[]>
    }
  }
}

type AtmosphereMediaSessionAction = "play" | "pause" | "stop" | "previoustrack" | "nexttrack"

interface AtmosphereMediaSession {
  metadata: unknown
  playbackState: "none" | "paused" | "playing"
  setActionHandler: (action: AtmosphereMediaSessionAction, handler: (() => void) | null) => void
}

interface AtmosphereMediaMetadataInit {
  title: string
  artist: string
  album: string
  artwork: Array<{ src: string; sizes: string; type: string }>
}

type AtmosphereStation = RuntimeAdapterPayload["station"] & {
  id: string
  title: string
  artist: string
  enabled: boolean
  attribution: {
    artist?: string
  }
}

type AtmosphereRuntimeAdapter = (payload: RuntimeAdapterPayload) => Promise<void | (() => void)> | void | (() => void)

type AtmosphereRuntimeController = {
  start: (station: RuntimeAdapterPayload["station"]) => Promise<void>
  stop: () => Promise<void>
  getActiveStationId: () => string | null
}

type AtmosphereRuntimeModules = {
  getAtmosphereStationById: (stationId: string) => AtmosphereStation
  playableStationIds: string[]
  createAtmosphereRuntimeController: (params: {
    adapters: Record<string, AtmosphereRuntimeAdapter>
  }) => AtmosphereRuntimeController
  prewarmGenerativeFmPiece: (options: {
    station: RuntimeAdapterPayload["station"]
    includeSamplePayloads?: boolean
    signal?: AbortSignal
  }) => Promise<void>
  setGenerativeFmPieceVolume: (volume: number) => void
  setToneProofDroneVolume: (volume: number) => void
  startGenerativeFmPiece: (options: {
    onLoadProgress?: (progress: number) => void
    station: RuntimeAdapterPayload["station"]
    volume?: number
  }) => Promise<void | (() => void)>
  startToneProofDrone: (options?: {
    baseFrequency?: number
    detuneCents?: number
    fadeSeconds?: number
    volume?: number
  }) => Promise<void | (() => void)>
}

type LoadedAtmosphereRuntime = AtmosphereRuntimeModules & {
  controller: AtmosphereRuntimeController
}

const defaultStorage = createDefaultAtmosphereStorage() as AtmosphereStorageState
const mediaSessionActions: AtmosphereMediaSessionAction[] = ["play", "pause", "stop", "previoustrack", "nexttrack"]

const defaultMusicContext: MusicContextType = {
  activeStationId: null,
  activeStationTitle: null,
  playbackState: "stopped",
  loadingProgress: null,
  loadingStartedAt: null,
  error: null,
  favorites: defaultStorage.favorites,
  recentStations: defaultStorage.recentStations,
  volume: defaultStorage.volume,
  miniPlayerCollapsed: defaultStorage.miniPlayerCollapsed,
  visualizer: {
    backgroundId: defaultStorage.visualizer.backgroundId,
    accountDefaultBackgroundId: null,
    showClock: defaultStorage.visualizer.showClock,
    storageStatus: "loading",
    storageError: null,
    accountStatus: "loading",
    accountError: null,
    signedIn: false,
  },
  playStation: async () => undefined,
  playNextStation: async () => undefined,
  playPreviousStation: async () => undefined,
  prewarmStation: async () => undefined,
  stopCurrent: async () => undefined,
  setVolume: () => undefined,
  toggleFavorite: () => undefined,
  setMiniPlayerCollapsed: () => undefined,
  selectVisualizerBackground: () => undefined,
  setVisualizerShowClock: () => undefined,
  setCurrentVisualizerBackgroundAsDefault: async () => undefined,
  restoreVisualizerAccountDefault: () => undefined,
  retryVisualizerAccountSync: async () => undefined,
}

const MusicContext = createContext<MusicContextType>(defaultMusicContext)

export function MusicProvider({ children }: { children: ReactNode }) {
  const [activeStationId, setActiveStationId] = useState<string | null>(null)
  const [activeStationTitle, setActiveStationTitle] = useState<string | null>(null)
  const [activeStationArtist, setActiveStationArtist] = useState<string | null>(null)
  const [playbackState, setPlaybackState] = useState<PlaybackState>("stopped")
  const [loadingProgress, setLoadingProgress] = useState<number | null>(null)
  const [loadingStartedAt, setLoadingStartedAt] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [storageState, setStorageState] = useState(defaultStorage)
  const [storageHydrated, setStorageHydrated] = useState(false)
  const [storageStatus, setStorageStatus] = useState<MusicVisualizerState["storageStatus"]>("loading")
  const [storageError, setStorageError] = useState<string | null>(null)
  const [accountDefaultBackgroundId, setAccountDefaultBackgroundId] = useState<string | null>(null)
  const [accountStatus, setAccountStatus] = useState<MusicVisualizerState["accountStatus"]>("loading")
  const [accountError, setAccountError] = useState<string | null>(null)
  const [accountSignedIn, setAccountSignedIn] = useState(false)
  const playbackRequestIdRef = useRef(0)
  const loadingStationIdRef = useRef<string | null>(null)
  const volumeRef = useRef(defaultStorage.volume)
  const runtimeRef = useRef<LoadedAtmosphereRuntime | null>(null)
  const runtimeLoadPromiseRef = useRef<Promise<LoadedAtmosphereRuntime> | null>(null)
  const storageStateRef = useRef(defaultStorage)
  const accountRequestIdRef = useRef(0)
  const accountAbortControllerRef = useRef<AbortController | null>(null)
  const accountSyncVerifiedRef = useRef(false)
  const accountPreferencesHydratedRef = useRef(false)
  const accountDefaultBackgroundIdRef = useRef<string | null>(null)
  const pendingAccountDefaultBackgroundIdRef = useRef<string | null>(null)
  const failedAccountPayloadRef = useRef<MusicVisualizerAccountPreferences | null>(null)
  const isMountedRef = useRef(true)

  const reportStationLoadProgress = useCallback((stationId: string, progress: number) => {
    if (loadingStationIdRef.current !== stationId) {
      return
    }

    setLoadingProgress((current) => Math.max(current ?? 0, clampLoadingProgress(progress)))
  }, [])

  const getRuntime = useCallback(() => {
    if (runtimeRef.current) {
      return Promise.resolve(runtimeRef.current)
    }

    runtimeLoadPromiseRef.current = runtimeLoadPromiseRef.current ?? loadAtmosphereRuntimeModules().then((modules) => {
      const controller = modules.createAtmosphereRuntimeController({
        adapters: {
          "tone-proof-drone": async ({ station }) => modules.startToneProofDrone({
            ...station.runtime?.defaultOptions,
            volume: volumeRef.current,
          }),
          "generative-fm-piece": async ({ station }) => modules.startGenerativeFmPiece({
            onLoadProgress: (progress) => reportStationLoadProgress(station.id, progress),
            station,
            volume: volumeRef.current,
          }),
        },
      })
      const runtime = { ...modules, controller }
      runtimeRef.current = runtime
      return runtime
    }).catch((error) => {
      runtimeLoadPromiseRef.current = null
      throw error
    })

    return runtimeLoadPromiseRef.current
  }, [reportStationLoadProgress])

  const beginAccountRequest = useCallback(() => {
    accountAbortControllerRef.current?.abort()
    const controller = new AbortController()
    const requestId = accountRequestIdRef.current + 1
    accountAbortControllerRef.current = controller
    accountRequestIdRef.current = requestId
    return { controller, requestId }
  }, [])

  const persistVisualizerAccountPreferences = useCallback(async (
    preferences: MusicVisualizerAccountPreferences,
  ) => {
    if (!accountSyncVerifiedRef.current) {
      setAccountStatus("anonymous")
      setAccountError("Sign in to save a Music visualizer default.")
      return
    }

    const payload = normalizeMusicVisualizerAccountPreferences(preferences)
    const { controller, requestId } = beginAccountRequest()
    setAccountStatus("saving")
    setAccountError(null)

    try {
      const response = await fetchWithTimeout("/api/account/preferences", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          appSettings: {
            musicVisualizer: payload,
          },
        }),
      })

      if (!response.ok) {
        throw new Error("Music visualizer preferences could not be saved.")
      }

      const responsePayload = await response.json().catch(() => null)
      if (!isMountedRef.current || requestId !== accountRequestIdRef.current) {
        return
      }

      const confirmedPreferences = readMusicVisualizerAccountPreferences(responsePayload) ?? payload
      accountPreferencesHydratedRef.current = true
      accountDefaultBackgroundIdRef.current = confirmedPreferences.defaultBackgroundId
      pendingAccountDefaultBackgroundIdRef.current = null
      failedAccountPayloadRef.current = null
      setAccountDefaultBackgroundId(confirmedPreferences.defaultBackgroundId)
      setAccountStatus("synced")
      setAccountError(null)
    } catch (caughtError) {
      if (
        isAbortError(caughtError)
        || !isMountedRef.current
        || requestId !== accountRequestIdRef.current
      ) {
        return
      }

      failedAccountPayloadRef.current = payload
      setAccountStatus("error")
      setAccountError("Music visualizer preferences could not be saved. Try again.")
    }
  }, [beginAccountRequest])

  const syncVisualizerAccountPreferences = useCallback(async () => {
    const { controller, requestId } = beginAccountRequest()
    accountSyncVerifiedRef.current = false
    accountPreferencesHydratedRef.current = false
    setAccountSignedIn(false)
    setAccountStatus("loading")
    setAccountError(null)

    try {
      const sessionResponse = await fetchWithTimeout("/api/auth/session", {
        signal: controller.signal,
      })
      if (!sessionResponse.ok) {
        throw new Error("Music visualizer account status could not be verified.")
      }
      const session = await sessionResponse.json().catch(() => null)

      if (!isMountedRef.current || requestId !== accountRequestIdRef.current) {
        return
      }

      if (!canSyncAccountPreferencesFromSession(session)) {
        accountDefaultBackgroundIdRef.current = null
        pendingAccountDefaultBackgroundIdRef.current = null
        failedAccountPayloadRef.current = null
        setAccountDefaultBackgroundId(null)
        setAccountStatus("anonymous")
        setAccountError(null)
        setAccountSignedIn(false)
        return
      }

      accountSyncVerifiedRef.current = true
      setAccountSignedIn(true)
      const response = await fetchWithTimeout("/api/account/preferences", {
        signal: controller.signal,
      })
      if (!response.ok) {
        throw new Error("Music visualizer preferences could not be loaded.")
      }

      const responsePayload = await response.json().catch(() => null)
      if (!isMountedRef.current || requestId !== accountRequestIdRef.current) {
        return
      }

      const accountPreferences = readMusicVisualizerAccountPreferences(responsePayload)
        ?? normalizeMusicVisualizerAccountPreferences(null)
      accountPreferencesHydratedRef.current = true
      accountDefaultBackgroundIdRef.current = accountPreferences.defaultBackgroundId
      pendingAccountDefaultBackgroundIdRef.current = null
      failedAccountPayloadRef.current = null
      setAccountDefaultBackgroundId(accountPreferences.defaultBackgroundId)
      setStorageState((current) => {
        return {
          ...current,
          visualizer: {
            ...current.visualizer,
            showClock: accountPreferences.showClock,
          },
        }
      })
      setAccountStatus("synced")
      setAccountError(null)
    } catch (caughtError) {
      if (
        isAbortError(caughtError)
        || !isMountedRef.current
        || requestId !== accountRequestIdRef.current
      ) {
        return
      }

      setAccountStatus("error")
      setAccountError("Music visualizer preferences could not be loaded. Try again.")
    }
  }, [beginAccountRequest])

  // Keep the provider mounted globally for route-persistent playback, but load
  // the audio catalog/runtime only after a user plays or prewarms a station.
  useEffect(() => () => {
    const runtime = runtimeRef.current
    runtimeRef.current = null
    runtimeLoadPromiseRef.current = null
    void runtime?.controller.stop()
  }, [])

  useEffect(() => {
    isMountedRef.current = true
    return () => {
      isMountedRef.current = false
      accountRequestIdRef.current += 1
      accountAbortControllerRef.current?.abort()
      accountAbortControllerRef.current = null
    }
  }, [])

  // Hydrate non-PHI audio preferences after mount and tolerate storage-denied
  // browser modes without breaking the public workbench.
  useEffect(() => {
    const hydration = readStoredAtmosphereState()
    storageStateRef.current = hydration.state
    setStorageState(hydration.state)
    setStorageStatus(hydration.storageStatus)
    setStorageError(hydration.storageError)
    setStorageHydrated(true)
  }, [])

  // Mirror committed browser preferences for callbacks that need the latest
  // state without introducing side effects inside React state updaters.
  useEffect(() => {
    storageStateRef.current = storageState
  }, [storageState])

  // Persist only after hydration so the default state cannot overwrite an
  // existing browser preference before it has been read.
  useEffect(() => {
    if (!storageHydrated || storageStatus !== "available") {
      return
    }

    const persistenceError = persistStoredAtmosphereState(storageState)
    if (persistenceError) {
      setStorageStatus("unavailable")
      setStorageError(persistenceError)
    }
  }, [storageHydrated, storageState, storageStatus])

  useEffect(() => {
    if (!storageHydrated) {
      return
    }

    void syncVisualizerAccountPreferences()
  }, [storageHydrated, syncVisualizerAccountPreferences])

  // Keep the active Tone graph in sync with saved volume changes without
  // restarting the station or creating a second audio context.
  useEffect(() => {
    volumeRef.current = storageState.volume
    runtimeRef.current?.setToneProofDroneVolume(storageState.volume)
    runtimeRef.current?.setGenerativeFmPieceVolume(storageState.volume)
  }, [storageState.volume])

  const playStation = useCallback(async (stationId: string) => {
    const requestId = playbackRequestIdRef.current + 1
    playbackRequestIdRef.current = requestId
    setActiveStationId(stationId)
    setActiveStationTitle(null)
    setActiveStationArtist(null)
    setPlaybackState("loading")
    setLoadingProgress(0.02)
    setLoadingStartedAt(Date.now())
    loadingStationIdRef.current = stationId
    setError(null)

    let runtime: LoadedAtmosphereRuntime
    let station: AtmosphereStation
    try {
      runtime = await getRuntime()
      station = runtime.getAtmosphereStationById(stationId)
    } catch (caughtError) {
      if (requestId !== playbackRequestIdRef.current) {
        return
      }

      loadingStationIdRef.current = null
      setLoadingProgress(null)
      setLoadingStartedAt(null)
      setPlaybackState("failed")
      setError(caughtError instanceof Error ? caughtError.message : "Audio runtime could not load.")
      return
    }

    if (requestId !== playbackRequestIdRef.current) {
      return
    }

    if (!station.enabled) {
      setActiveStationId(station.id)
      setActiveStationTitle(station.title)
      setActiveStationArtist(getStationArtist(station))
      setPlaybackState("failed")
      setLoadingProgress(null)
      setLoadingStartedAt(null)
      loadingStationIdRef.current = null
      setError(station.disabledReason ?? "This station is not playable yet.")
      return
    }

    setActiveStationId(station.id)
    setActiveStationTitle(station.title)
    setActiveStationArtist(getStationArtist(station))
    setPlaybackState("loading")
    setLoadingProgress(0.05)
    setLoadingStartedAt(Date.now())
    loadingStationIdRef.current = station.id
    setError(null)

    try {
      await runtime.controller.start(station)
      if (requestId !== playbackRequestIdRef.current) {
        return
      }

      loadingStationIdRef.current = null
      setLoadingProgress(null)
      setLoadingStartedAt(null)
      setPlaybackState("playing")
      setStorageState((current) => ({
        ...current,
        recentStations: [station.id, ...current.recentStations.filter((id) => id !== station.id)].slice(0, 12),
      }))
    } catch (caughtError) {
      if (requestId !== playbackRequestIdRef.current) {
        return
      }

      loadingStationIdRef.current = null
      setLoadingProgress(null)
      setLoadingStartedAt(null)
      setPlaybackState("failed")
      setError(caughtError instanceof Error ? caughtError.message : "Audio could not start.")
    }
  }, [getRuntime])

  const playAdjacentStation = useCallback(async (direction: 1 | -1) => {
    const runtime = await getRuntime()
    const playableStationIds = runtime.playableStationIds
    if (playableStationIds.length === 0) {
      return
    }

    const currentIndex = activeStationId ? playableStationIds.indexOf(activeStationId) : -1
    const fallbackIndex = direction === 1 ? -1 : 0
    const nextIndex = (currentIndex >= 0 ? currentIndex : fallbackIndex) + direction
    const normalizedIndex = (nextIndex + playableStationIds.length) % playableStationIds.length
    await playStation(playableStationIds[normalizedIndex])
  }, [activeStationId, getRuntime, playStation])

  const playNextStation = useCallback(async () => {
    await playAdjacentStation(1)
  }, [playAdjacentStation])

  const playPreviousStation = useCallback(async () => {
    await playAdjacentStation(-1)
  }, [playAdjacentStation])

  const prewarmStation = useCallback(async (
    stationId: string,
    options: { includeSamplePayloads?: boolean, signal?: AbortSignal } = {},
  ) => {
    try {
      const runtime = await getRuntime()
      const station = runtime.getAtmosphereStationById(stationId)
      if (!station.enabled || station.runtime?.adapterId !== "generative-fm-piece") {
        return
      }

      await runtime.prewarmGenerativeFmPiece({
        station,
        includeSamplePayloads: options.includeSamplePayloads ?? false,
        signal: options.signal,
      })
    } catch {
      // Prewarm is opportunistic; playback should surface any real runtime error.
    }
  }, [getRuntime])

  const stopCurrent = useCallback(async () => {
    const requestId = playbackRequestIdRef.current + 1
    playbackRequestIdRef.current = requestId
    setPlaybackState("stopped")
    setLoadingProgress(null)
    setLoadingStartedAt(null)
    loadingStationIdRef.current = null
    setError(null)

    try {
      await runtimeRef.current?.controller.stop()
    } catch (caughtError) {
      if (requestId !== playbackRequestIdRef.current) {
        return
      }

      setPlaybackState("failed")
      setError(caughtError instanceof Error ? caughtError.message : "Audio could not stop.")
    }
  }, [])

  // Expose the active station to Android/iOS/browser media surfaces when the
  // browser supports Media Session. Unsupported actions are ignored because
  // browser notification controls vary by device and installed browser.
  useEffect(() => {
    const mediaSession = (navigator as unknown as { mediaSession?: AtmosphereMediaSession }).mediaSession
    if (!mediaSession) {
      return undefined
    }

    if (!activeStationId || playbackState === "stopped" || playbackState === "failed") {
      mediaSession.playbackState = "none"
      mediaSession.metadata = null
      clearAtmosphereMediaSessionHandlers(mediaSession)
      return undefined
    }

    mediaSession.playbackState = "playing"
    setAtmosphereMediaSessionMetadata(mediaSession, {
      artist: activeStationArtist,
      title: activeStationTitle ?? "Atmosphere",
    })
    setAtmosphereMediaSessionHandler(mediaSession, "play", () => {
      void playStation(activeStationId)
    })
    setAtmosphereMediaSessionHandler(mediaSession, "pause", () => {
      void stopCurrent()
    })
    setAtmosphereMediaSessionHandler(mediaSession, "stop", () => {
      void stopCurrent()
    })
    setAtmosphereMediaSessionHandler(mediaSession, "previoustrack", () => {
      void playPreviousStation()
    })
    setAtmosphereMediaSessionHandler(mediaSession, "nexttrack", () => {
      void playNextStation()
    })

    return () => {
      clearAtmosphereMediaSessionHandlers(mediaSession)
    }
  }, [
    activeStationArtist,
    activeStationId,
    activeStationTitle,
    playNextStation,
    playPreviousStation,
    playStation,
    playbackState,
    stopCurrent,
  ])

  const setVolume = useCallback((nextVolume: number) => {
    const clampedVolume = Math.min(1, Math.max(0, nextVolume))
    volumeRef.current = clampedVolume
    runtimeRef.current?.setToneProofDroneVolume(clampedVolume)
    runtimeRef.current?.setGenerativeFmPieceVolume(clampedVolume)
    setStorageState((current) => ({
      ...current,
      volume: clampedVolume,
    }))
  }, [])

  const toggleFavorite = useCallback((stationId: string) => {
    setStorageState((current) => {
      const isFavorite = current.favorites.includes(stationId)
      return {
        ...current,
        favorites: isFavorite
          ? current.favorites.filter((id) => id !== stationId)
          : [stationId, ...current.favorites],
      }
    })
  }, [])

  const setMiniPlayerCollapsed = useCallback((collapsed: boolean) => {
    setStorageState((current) => ({ ...current, miniPlayerCollapsed: collapsed }))
  }, [])

  const selectVisualizerBackground = useCallback((backgroundId: string) => {
    setStorageState((current) => {
      const visualizer = normalizeMusicVisualizerDevicePreferences({
        ...current.visualizer,
        backgroundId,
      })
      return { ...current, visualizer }
    })
  }, [])

  const setVisualizerShowClock = useCallback((showClock: boolean) => {
    const normalizedShowClock = showClock === true
    setStorageState((current) => {
      return {
        ...current,
        visualizer: {
          ...current.visualizer,
          showClock: normalizedShowClock,
        },
      }
    })

    if (accountSyncVerifiedRef.current && accountPreferencesHydratedRef.current) {
      void persistVisualizerAccountPreferences({
        defaultBackgroundId:
          pendingAccountDefaultBackgroundIdRef.current
          ?? accountDefaultBackgroundIdRef.current,
        showClock: normalizedShowClock,
      })
    }
  }, [persistVisualizerAccountPreferences])

  const setCurrentVisualizerBackgroundAsDefault = useCallback(async () => {
    if (!accountSyncVerifiedRef.current) {
      setAccountStatus("anonymous")
      setAccountError("Sign in to save a Music visualizer default.")
      return
    }

    const backgroundId = storageStateRef.current.visualizer.backgroundId
      ?? accountDefaultBackgroundIdRef.current
    if (!backgroundId) {
      setAccountStatus("error")
      setAccountError("Choose an available Music background before saving a default.")
      return
    }

    pendingAccountDefaultBackgroundIdRef.current = backgroundId
    await persistVisualizerAccountPreferences({
      defaultBackgroundId: backgroundId,
      showClock: storageStateRef.current.visualizer.showClock,
    })
  }, [persistVisualizerAccountPreferences])

  const restoreVisualizerAccountDefault = useCallback(() => {
    setStorageState((current) => {
      return {
        ...current,
        visualizer: {
          ...current.visualizer,
          backgroundId: null,
        },
      }
    })
  }, [])

  const retryVisualizerAccountSync = useCallback(async () => {
    const failedPayload = failedAccountPayloadRef.current
    if (failedPayload) {
      await persistVisualizerAccountPreferences(failedPayload)
      return
    }

    await syncVisualizerAccountPreferences()
  }, [persistVisualizerAccountPreferences, syncVisualizerAccountPreferences])

  const value = useMemo<MusicContextType>(() => ({
    activeStationId,
    activeStationTitle,
    playbackState,
    loadingProgress,
    loadingStartedAt,
    error,
    favorites: storageState.favorites,
    recentStations: storageState.recentStations,
    volume: storageState.volume,
    miniPlayerCollapsed: storageState.miniPlayerCollapsed,
    visualizer: {
      backgroundId: storageState.visualizer.backgroundId,
      accountDefaultBackgroundId,
      showClock: storageState.visualizer.showClock,
      storageStatus,
      storageError,
      accountStatus,
      accountError,
      signedIn: accountSignedIn,
    },
    playStation,
    playNextStation,
    playPreviousStation,
    prewarmStation,
    stopCurrent,
    setVolume,
    toggleFavorite,
    setMiniPlayerCollapsed,
    selectVisualizerBackground,
    setVisualizerShowClock,
    setCurrentVisualizerBackgroundAsDefault,
    restoreVisualizerAccountDefault,
    retryVisualizerAccountSync,
  }), [
    accountDefaultBackgroundId,
    accountError,
    accountSignedIn,
    accountStatus,
    activeStationId,
    activeStationTitle,
    error,
    loadingProgress,
    loadingStartedAt,
    playNextStation,
    playPreviousStation,
    playStation,
    playbackState,
    prewarmStation,
    restoreVisualizerAccountDefault,
    retryVisualizerAccountSync,
    selectVisualizerBackground,
    setMiniPlayerCollapsed,
    setCurrentVisualizerBackgroundAsDefault,
    setVisualizerShowClock,
    setVolume,
    stopCurrent,
    storageState,
    storageError,
    storageStatus,
    toggleFavorite,
  ])

  return <MusicContext.Provider value={value}>{children}</MusicContext.Provider>
}

export function useMusic() {
  return useContext(MusicContext)
}

function readStoredAtmosphereState(): StoredAtmosphereHydration {
  try {
    const parsed = parseAtmosphereStorage(
      window.localStorage.getItem(ATMOSPHERE_STORAGE_KEY),
      {
        legacyRawValue: window.localStorage.getItem(LEGACY_ATMOSPHERE_STORAGE_KEY),
        legacyBackgroundId: window.localStorage.getItem(BACKGROUND_STORAGE_KEYS.music),
      },
    )

    if (parsed.status === "unsupported-version") {
      return {
        state: createDefaultAtmosphereStorage() as AtmosphereStorageState,
        storageStatus: "unsupported-version",
        storageError: "A newer version of Atmosphere preferences is stored on this device.",
      }
    }

    return {
      state: parsed.state as AtmosphereStorageState,
      storageStatus: "available",
      storageError: null,
    }
  } catch {
    return {
      state: createDefaultAtmosphereStorage() as AtmosphereStorageState,
      storageStatus: "unavailable",
      storageError: "This browser blocked local Atmosphere preferences.",
    }
  }
}

function persistStoredAtmosphereState(storageState: AtmosphereStorageState) {
  try {
    window.localStorage.setItem(ATMOSPHERE_STORAGE_KEY, serializeAtmosphereStorage(storageState))
    return null
  } catch {
    return "This browser blocked local Atmosphere preferences."
  }
}

/**
 * Reads only the account-scoped visualizer namespace from the merged app
 * settings response, leaving unrelated settings owned by their providers.
 */
function readMusicVisualizerAccountPreferences(
  value: unknown,
): MusicVisualizerAccountPreferences | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null
  }

  const appSettings = (value as { appSettings?: unknown }).appSettings
  if (!appSettings || typeof appSettings !== "object" || Array.isArray(appSettings)) {
    return null
  }

  if (!Object.prototype.hasOwnProperty.call(appSettings, "musicVisualizer")) {
    return null
  }

  return normalizeMusicVisualizerAccountPreferences(
    (appSettings as { musicVisualizer?: unknown }).musicVisualizer,
  )
}

function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError"
}

function clampLoadingProgress(progress: number) {
  return Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0))
}

/**
 * Loads the station catalog and browser audio runtimes only after playback or
 * prewarm needs them, keeping Tone and Generative.fm out of the global shell.
 */
async function loadAtmosphereRuntimeModules(): Promise<AtmosphereRuntimeModules> {
  const [
    stations,
    runtimeController,
    generativeRuntime,
    toneProofRuntime,
  ] = await Promise.all([
    import("@/lib/atmosphere/stations"),
    import("@/lib/atmosphere/runtime-controller"),
    import("@/lib/atmosphere/generative-fm-runtime"),
    import("@/lib/atmosphere/tone-proof-runtime"),
  ])

  return {
    createAtmosphereRuntimeController: runtimeController.createAtmosphereRuntimeController,
    getAtmosphereStationById: stations.getAtmosphereStationById as AtmosphereRuntimeModules["getAtmosphereStationById"],
    playableStationIds: stations.getPlayableAtmosphereStations().map((station: AtmosphereStation) => station.id),
    prewarmGenerativeFmPiece: generativeRuntime.prewarmGenerativeFmPiece,
    setGenerativeFmPieceVolume: generativeRuntime.setGenerativeFmPieceVolume,
    setToneProofDroneVolume: toneProofRuntime.setToneProofDroneVolume,
    startGenerativeFmPiece: generativeRuntime.startGenerativeFmPiece,
    startToneProofDrone: toneProofRuntime.startToneProofDrone,
  }
}

function getStationArtist(station: AtmosphereStation) {
  return station.artist || station.attribution?.artist || "MassageLab"
}

function setAtmosphereMediaSessionMetadata(
  mediaSession: AtmosphereMediaSession,
  station: { artist?: string | null, title: string },
) {
  const MediaMetadataConstructor = (window as unknown as {
    MediaMetadata?: new (init: AtmosphereMediaMetadataInit) => unknown
  }).MediaMetadata
  if (!MediaMetadataConstructor) {
    return
  }

  try {
    mediaSession.metadata = new MediaMetadataConstructor({
      title: station.title,
      artist: station.artist || "MassageLab",
      album: "MassageLab Atmosphere",
      artwork: [
        { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
    })
  } catch {
    // Metadata failures should not interrupt playback.
  }
}

function setAtmosphereMediaSessionHandler(
  mediaSession: AtmosphereMediaSession,
  action: AtmosphereMediaSessionAction,
  handler: () => void,
) {
  try {
    mediaSession.setActionHandler(action, handler)
  } catch {
    // Some browsers expose Media Session but reject individual controls.
  }
}

function clearAtmosphereMediaSessionHandlers(mediaSession: AtmosphereMediaSession) {
  for (const action of mediaSessionActions) {
    try {
      mediaSession.setActionHandler(action, null)
    } catch {
      // Clearing handlers is best-effort for the same device-variance reason.
    }
  }
}
