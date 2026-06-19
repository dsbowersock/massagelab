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
import { getAtmosphereStationById, getPlayableAtmosphereStations } from "@/lib/atmosphere/stations"
import { createAtmosphereRuntimeController } from "@/lib/atmosphere/runtime-controller"
import {
  ATMOSPHERE_STORAGE_KEY,
  createDefaultAtmosphereStorage,
  parseAtmosphereStorage,
  serializeAtmosphereStorage,
} from "@/lib/atmosphere/storage"
import {
  prewarmGenerativeFmPiece,
  setGenerativeFmPieceVolume,
  startGenerativeFmPiece,
} from "@/lib/atmosphere/generative-fm-runtime"
import { setToneProofDroneVolume, startToneProofDrone } from "@/lib/atmosphere/tone-proof-runtime"

type PlaybackState = "stopped" | "loading" | "playing" | "failed"

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
  playStation: (stationId: string) => Promise<void>
  playNextStation: () => Promise<void>
  playPreviousStation: () => Promise<void>
  prewarmStation: (stationId: string, options?: { includeSamplePayloads?: boolean }) => Promise<void>
  stopCurrent: () => Promise<void>
  setVolume: (volume: number) => void
  toggleFavorite: (stationId: string) => void
  setMiniPlayerCollapsed: (collapsed: boolean) => void
}

interface AtmosphereStorageState {
  version: number
  favorites: string[]
  recentStations: string[]
  volume: number
  miniPlayerCollapsed: boolean
}

interface RuntimeAdapterPayload {
  station: {
    id: string
    runtime?: {
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

const defaultStorage = createDefaultAtmosphereStorage() as AtmosphereStorageState
const playableStationIds = getPlayableAtmosphereStations().map((station) => station.id)
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
  playStation: async () => undefined,
  playNextStation: async () => undefined,
  playPreviousStation: async () => undefined,
  prewarmStation: async () => undefined,
  stopCurrent: async () => undefined,
  setVolume: () => undefined,
  toggleFavorite: () => undefined,
  setMiniPlayerCollapsed: () => undefined,
}

const MusicContext = createContext<MusicContextType>(defaultMusicContext)

export function MusicProvider({ children }: { children: ReactNode }) {
  const [activeStationId, setActiveStationId] = useState<string | null>(null)
  const [playbackState, setPlaybackState] = useState<PlaybackState>("stopped")
  const [loadingProgress, setLoadingProgress] = useState<number | null>(null)
  const [loadingStartedAt, setLoadingStartedAt] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [storageState, setStorageState] = useState(defaultStorage)
  const [storageHydrated, setStorageHydrated] = useState(false)
  const playbackRequestIdRef = useRef(0)
  const loadingStationIdRef = useRef<string | null>(null)
  const volumeRef = useRef(defaultStorage.volume)
  const controllerRef = useRef<ReturnType<typeof createAtmosphereRuntimeController> | null>(null)

  const reportStationLoadProgress = useCallback((stationId: string, progress: number) => {
    if (loadingStationIdRef.current !== stationId) {
      return
    }

    setLoadingProgress((current) => Math.max(current ?? 0, clampLoadingProgress(progress)))
  }, [])

  // Own one runtime controller for this provider lifetime; it is intentionally
  // above route content so client-side navigation does not tear down playback.
  useEffect(() => {
    const controller = createAtmosphereRuntimeController({
      adapters: {
        "tone-proof-drone": async ({ station }: RuntimeAdapterPayload) => startToneProofDrone({
          ...station.runtime?.defaultOptions,
          volume: volumeRef.current,
        }),
        "generative-fm-piece": async ({ station }: RuntimeAdapterPayload) => startGenerativeFmPiece({
          onLoadProgress: (progress) => reportStationLoadProgress(station.id, progress),
          station,
          volume: volumeRef.current,
        }),
      },
    })

    controllerRef.current = controller

    return () => {
      if (controllerRef.current === controller) {
        controllerRef.current = null
      }
      void controller.stop()
    }
  }, [reportStationLoadProgress])

  // Hydrate non-PHI audio preferences after mount and tolerate storage-denied
  // browser modes without breaking the public workbench.
  useEffect(() => {
    setStorageState(readStoredAtmosphereState())
    setStorageHydrated(true)
  }, [])

  // Persist only after hydration so the default state cannot overwrite an
  // existing browser preference before it has been read.
  useEffect(() => {
    if (storageHydrated) {
      persistStoredAtmosphereState(storageState)
    }
  }, [storageHydrated, storageState])

  // Keep the active Tone graph in sync with saved volume changes without
  // restarting the station or creating a second audio context.
  useEffect(() => {
    volumeRef.current = storageState.volume
    setToneProofDroneVolume(storageState.volume)
    setGenerativeFmPieceVolume(storageState.volume)
  }, [storageState.volume])

  const playStation = useCallback(async (stationId: string) => {
    const requestId = playbackRequestIdRef.current + 1
    playbackRequestIdRef.current = requestId
    const station = getAtmosphereStationById(stationId)
    const controller = controllerRef.current

    if (!station.enabled) {
      setActiveStationId(station.id)
      setPlaybackState("failed")
      setLoadingProgress(null)
      setLoadingStartedAt(null)
      loadingStationIdRef.current = null
      setError(station.disabledReason ?? "This station is not playable yet.")
      return
    }

    if (!controller) {
      setActiveStationId(station.id)
      setPlaybackState("failed")
      setLoadingProgress(null)
      setLoadingStartedAt(null)
      loadingStationIdRef.current = null
      setError("Audio runtime is still loading.")
      return
    }

    setActiveStationId(station.id)
    setPlaybackState("loading")
    setLoadingProgress(0.05)
    setLoadingStartedAt(Date.now())
    loadingStationIdRef.current = station.id
    setError(null)

    try {
      await controller.start(station)
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
  }, [])

  const playAdjacentStation = useCallback(async (direction: 1 | -1) => {
    if (playableStationIds.length === 0) {
      return
    }

    const currentIndex = activeStationId ? playableStationIds.indexOf(activeStationId) : -1
    const fallbackIndex = direction === 1 ? -1 : 0
    const nextIndex = (currentIndex >= 0 ? currentIndex : fallbackIndex) + direction
    const normalizedIndex = (nextIndex + playableStationIds.length) % playableStationIds.length
    await playStation(playableStationIds[normalizedIndex])
  }, [activeStationId, playStation])

  const playNextStation = useCallback(async () => {
    await playAdjacentStation(1)
  }, [playAdjacentStation])

  const playPreviousStation = useCallback(async () => {
    await playAdjacentStation(-1)
  }, [playAdjacentStation])

  const prewarmStation = useCallback(async (
    stationId: string,
    options: { includeSamplePayloads?: boolean } = {},
  ) => {
    try {
      const station = getAtmosphereStationById(stationId)
      if (!station.enabled || station.runtime?.adapterId !== "generative-fm-piece") {
        return
      }

      await prewarmGenerativeFmPiece({
        station,
        includeSamplePayloads: options.includeSamplePayloads ?? false,
      })
    } catch {
      // Prewarm is opportunistic; playback should surface any real runtime error.
    }
  }, [])

  const stopCurrent = useCallback(async () => {
    const requestId = playbackRequestIdRef.current + 1
    playbackRequestIdRef.current = requestId
    setActiveStationId(null)
    setPlaybackState("stopped")
    setLoadingProgress(null)
    setLoadingStartedAt(null)
    loadingStationIdRef.current = null
    setError(null)

    try {
      await controllerRef.current?.stop()
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

    const station = getAtmosphereStationById(activeStationId)
    mediaSession.playbackState = "playing"
    setAtmosphereMediaSessionMetadata(mediaSession, station)
    setAtmosphereMediaSessionHandler(mediaSession, "play", () => {
      void playStation(station.id)
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
  }, [activeStationId, playNextStation, playPreviousStation, playStation, playbackState, stopCurrent])

  const setVolume = useCallback((nextVolume: number) => {
    const clampedVolume = Math.min(1, Math.max(0, nextVolume))
    volumeRef.current = clampedVolume
    setToneProofDroneVolume(clampedVolume)
    setGenerativeFmPieceVolume(clampedVolume)
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

  const activeStationTitle = useMemo(() => {
    if (!activeStationId) {
      return null
    }
    return getAtmosphereStationById(activeStationId).title
  }, [activeStationId])

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
    playStation,
    playNextStation,
    playPreviousStation,
    prewarmStation,
    stopCurrent,
    setVolume,
    toggleFavorite,
    setMiniPlayerCollapsed,
  }), [
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
    setMiniPlayerCollapsed,
    setVolume,
    stopCurrent,
    storageState,
    toggleFavorite,
  ])

  return <MusicContext.Provider value={value}>{children}</MusicContext.Provider>
}

export function useMusic() {
  return useContext(MusicContext)
}

function readStoredAtmosphereState(): AtmosphereStorageState {
  try {
    return parseAtmosphereStorage(window.localStorage.getItem(ATMOSPHERE_STORAGE_KEY)) as AtmosphereStorageState
  } catch {
    return createDefaultAtmosphereStorage() as AtmosphereStorageState
  }
}

function persistStoredAtmosphereState(storageState: AtmosphereStorageState) {
  try {
    window.localStorage.setItem(ATMOSPHERE_STORAGE_KEY, serializeAtmosphereStorage(storageState))
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }
}

function clampLoadingProgress(progress: number) {
  return Math.min(1, Math.max(0, Number.isFinite(progress) ? progress : 0))
}

function setAtmosphereMediaSessionMetadata(
  mediaSession: AtmosphereMediaSession,
  station: ReturnType<typeof getAtmosphereStationById>,
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
      artist: station.artist || station.attribution.artist || "MassageLab",
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
