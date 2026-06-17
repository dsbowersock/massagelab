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
import { getAtmosphereStationById } from "@/lib/atmosphere/stations"
import { createAtmosphereRuntimeController } from "@/lib/atmosphere/runtime-controller"
import {
  ATMOSPHERE_STORAGE_KEY,
  createDefaultAtmosphereStorage,
  parseAtmosphereStorage,
  serializeAtmosphereStorage,
} from "@/lib/atmosphere/storage"
import { setToneProofDroneVolume, startToneProofDrone } from "@/lib/atmosphere/tone-proof-runtime"

type PlaybackState = "stopped" | "loading" | "playing" | "failed"

interface MusicContextType {
  activeStationId: string | null
  activeStationTitle: string | null
  playbackState: PlaybackState
  error: string | null
  favorites: string[]
  recentStations: string[]
  volume: number
  miniPlayerCollapsed: boolean
  playStation: (stationId: string) => Promise<void>
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
    runtime?: {
      defaultOptions?: Record<string, number>
    }
  }
}

const defaultStorage = createDefaultAtmosphereStorage() as AtmosphereStorageState

const defaultMusicContext: MusicContextType = {
  activeStationId: null,
  activeStationTitle: null,
  playbackState: "stopped",
  error: null,
  favorites: defaultStorage.favorites,
  recentStations: defaultStorage.recentStations,
  volume: defaultStorage.volume,
  miniPlayerCollapsed: defaultStorage.miniPlayerCollapsed,
  playStation: async () => undefined,
  stopCurrent: async () => undefined,
  setVolume: () => undefined,
  toggleFavorite: () => undefined,
  setMiniPlayerCollapsed: () => undefined,
}

const MusicContext = createContext<MusicContextType>(defaultMusicContext)

export function MusicProvider({ children }: { children: ReactNode }) {
  const [activeStationId, setActiveStationId] = useState<string | null>(null)
  const [playbackState, setPlaybackState] = useState<PlaybackState>("stopped")
  const [error, setError] = useState<string | null>(null)
  const [storageState, setStorageState] = useState(defaultStorage)
  const volumeRef = useRef(defaultStorage.volume)
  const controllerRef = useRef<ReturnType<typeof createAtmosphereRuntimeController> | null>(null)

  if (!controllerRef.current) {
    controllerRef.current = createAtmosphereRuntimeController({
      adapters: {
        "tone-proof-drone": async ({ station }: RuntimeAdapterPayload) => startToneProofDrone({
          ...station.runtime?.defaultOptions,
          volume: volumeRef.current,
        }),
      },
    })
  }

  useEffect(() => {
    setStorageState(parseAtmosphereStorage(window.localStorage.getItem(ATMOSPHERE_STORAGE_KEY)) as AtmosphereStorageState)
  }, [])

  useEffect(() => {
    window.localStorage.setItem(ATMOSPHERE_STORAGE_KEY, serializeAtmosphereStorage(storageState))
  }, [storageState])

  useEffect(() => {
    volumeRef.current = storageState.volume
    setToneProofDroneVolume(storageState.volume)
  }, [storageState.volume])

  useEffect(() => {
    return () => {
      void controllerRef.current?.stop()
    }
  }, [])

  const playStation = useCallback(async (stationId: string) => {
    const station = getAtmosphereStationById(stationId)

    if (!station.enabled) {
      setActiveStationId(station.id)
      setPlaybackState("failed")
      setError(station.disabledReason ?? "This station is not playable yet.")
      return
    }

    setActiveStationId(station.id)
    setPlaybackState("loading")
    setError(null)

    try {
      await controllerRef.current?.start(station)
      setPlaybackState("playing")
      setStorageState((current) => ({
        ...current,
        recentStations: [station.id, ...current.recentStations.filter((id) => id !== station.id)].slice(0, 12),
      }))
    } catch (caughtError) {
      setPlaybackState("failed")
      setError(caughtError instanceof Error ? caughtError.message : "Audio could not start.")
    }
  }, [])

  const stopCurrent = useCallback(async () => {
    await controllerRef.current?.stop()
    setActiveStationId(null)
    setPlaybackState("stopped")
    setError(null)
  }, [])

  const setVolume = useCallback((nextVolume: number) => {
    const clampedVolume = Math.min(1, Math.max(0, nextVolume))
    volumeRef.current = clampedVolume
    setToneProofDroneVolume(clampedVolume)
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
    error,
    favorites: storageState.favorites,
    recentStations: storageState.recentStations,
    volume: storageState.volume,
    miniPlayerCollapsed: storageState.miniPlayerCollapsed,
    playStation,
    stopCurrent,
    setVolume,
    toggleFavorite,
    setMiniPlayerCollapsed,
  }), [
    activeStationId,
    activeStationTitle,
    error,
    playStation,
    playbackState,
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
