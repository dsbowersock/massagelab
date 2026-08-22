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
import { startAbortableGenerativeFmPrewarm } from "@/lib/atmosphere/generative-fm-provider"
import {
  resolveAtmosphereStationArtworkInput,
  type AtmosphereStationArtworkInput,
} from "@/lib/atmosphere/station-artwork"
import { createAtmosphereMediaCarrier } from "@/lib/atmosphere/media-playback-carrier"
import { createAtmosphereMediaSessionController } from "@/lib/atmosphere/media-session-controller"
import { createAtmosphereInterruptionMonitor } from "@/lib/atmosphere/media-interruption-monitor"
import {
  readAtmosphereInterruptionPreference,
  writeAtmosphereInterruptionPreference,
} from "@/lib/atmosphere/interruption-preference"
import {
  commitOwnedPlaybackEffect,
  createAtmospherePlaybackLifecycle,
  settleSourceRuntimeStartup,
  transitionAtmospherePlayback,
} from "@/lib/atmosphere/playback-lifecycle"
import {
  normalizeMusicVisualizerAccountPreferences,
  normalizeMusicVisualizerDevicePreferences,
} from "@/lib/music-visualizer"
import type { AtmoShaperLayer, AtmoShaperRecipe } from "@/lib/atmoshaper/recipe.js"

type PlaybackState = "stopped" | "loading" | "playing" | "interrupted" | "paused" | "failed"
export type MusicPlaybackKind = "station" | "atmoshaper" | null
type PlaybackKind = MusicPlaybackKind

type ToneProofDroneDiagnostics = {
  sessionId: number
  audioContextState: string
  startedAt: number
  currentTime: number
  elapsed: number
}

const STOPPED_PLAYER_RETENTION_MS = 60_000

type RuntimeReadinessState = {
  status: "idle" | "preparing" | "ready" | "error"
  error: string | null
}

type PlaybackStartOptions = {
  artworkInput?: AtmosphereStationArtworkInput
  origin?: "in-app" | "media-session"
  continueSession?: boolean
}

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

type AtmoShaperRuntimeSnapshot = {
  status: "stopped" | "loading" | "playing" | "paused" | "failed"
  recipe: AtmoShaperRecipe | null
  layers: Record<string, {
    status: "loading" | "playing" | "paused" | "failed"
    error?: string
  }>
  activeLayers: Record<string, AtmoShaperLayer>
}

type AtmoShaperBrowserQaDiagnostics = {
  activePlaybackKind: PlaybackKind
  activeStationId: string | null
  error: string | null
  playbackState: PlaybackState
  recipe: AtmoShaperRecipe | null
  runtime: AtmoShaperRuntimeSnapshot | null
}

type LoadedAtmoShaperRuntime = {
  start: (recipe: AtmoShaperRecipe) => Promise<void>
  applyRecipe: (recipe: AtmoShaperRecipe) => Promise<void>
  pause: () => Promise<void>
  resume: () => Promise<void>
  stop: () => Promise<void>
  dispose: () => Promise<void>
  setMasterVolume: (volume: number) => void
  getSnapshot: () => AtmoShaperRuntimeSnapshot
}

interface MusicContextType {
  activePlaybackKind: PlaybackKind
  activeStationId: string | null
  activeStationTitle: string | null
  activeStationArtwork: AtmosphereStationArtworkInput | null
  canNavigateStations: boolean
  atmoShaperSnapshot: AtmoShaperRuntimeSnapshot | null
  playbackState: PlaybackState
  loadingProgress: number | null
  loadingStartedAt: number | null
  error: string | null
  runtimeReadiness: RuntimeReadinessState
  favorites: string[]
  recentStations: string[]
  volume: number
  miniPlayerCollapsed: boolean
  visualizer: MusicVisualizerState
  playStation: (stationId: string, options?: PlaybackStartOptions) => Promise<void>
  playAtmoShaper: (recipe: AtmoShaperRecipe) => Promise<void>
  updateAtmoShaper: (recipe: AtmoShaperRecipe) => Promise<void>
  retryAtmoShaperLayer: (layerId: string) => Promise<void>
  playNextStation: () => Promise<void>
  playPreviousStation: () => Promise<void>
  prewarmStation: (
    stationId: string,
    options?: { includeSamplePayloads?: boolean, signal?: AbortSignal },
  ) => Promise<void>
  retryRuntimeReadiness: () => void
  pauseCurrent: () => Promise<void>
  restartCurrent: () => Promise<void>
  stopCurrent: () => Promise<void>
  mediaIntegrationAvailable: boolean
  resumeAfterInterruptionDefault: boolean
  resumeAfterInterruptionForSession: boolean
  interruptionNoticeSessionId: number | null
  setSessionResumeAfterInterruption: (value: boolean) => void
  setResumeAfterInterruptionDefault: (value: boolean) => void
  dismissInterruptionNotice: (sessionId: number) => void
  setVolume: (volume: number) => void
  toggleFavorite: (stationId: string) => void
  setMiniPlayerCollapsed: (collapsed: boolean) => void
  selectVisualizerBackground: (backgroundId: string) => void
  setVisualizerShowClock: (showClock: boolean) => void
  setCurrentVisualizerBackgroundAsDefault: () => Promise<void>
  restoreVisualizerAccountDefault: () => void
  retryVisualizerAccountSync: () => Promise<void>
  /** Reads the active production Tone graph for guarded continuity QA. */
  getPlaybackDiagnostics: () => ToneProofDroneDiagnostics | null
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
  isCurrent: () => boolean
  station: {
    id: string
    title?: string
    description?: string
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

interface AtmosphereMediaSession {
  metadata: unknown
  playbackState: "none" | "paused" | "playing"
  setActionHandler: (
    action: "play" | "pause" | "stop" | "previoustrack" | "nexttrack",
    handler: (() => void) | null,
  ) => void
  setPositionState?: (state?: object) => void
}

type AtmosphereStationMetadata = { id: string, title: string, artist: string }

type AtmosphereStation = RuntimeAdapterPayload["station"] & {
  id: string
  title: string
  artist: string
  enabled: boolean
  attribution: {
    artist?: string
  }
}

type AtmosphereRuntimeCleanup = (() => void | Promise<void>) & {
  dispose?: () => void | Promise<void>
}

type AtmosphereRuntimeAdapter = (
  payload: RuntimeAdapterPayload,
) => Promise<void | AtmosphereRuntimeCleanup> | void | AtmosphereRuntimeCleanup

type AtmosphereRuntimeStartResult = {
  status: "active" | "stale"
  requestId: number
}

type AtmosphereRuntimeStopResult = {
  requestId: number
}

type AtmosphereRuntimeController = {
  start: (station: RuntimeAdapterPayload["station"]) => Promise<AtmosphereRuntimeStartResult>
  stop: () => AtmosphereRuntimeStopResult
  stopAndWait: () => Promise<AtmosphereRuntimeStopResult>
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
  getToneProofDroneDiagnostics: () => ToneProofDroneDiagnostics | null
  getAtmosphereAudioContext: () => EventTarget & { state: unknown }
  startGenerativeFmPiece: (options: {
    isCurrent?: () => boolean
    onLoadProgress?: (progress: number) => void
    station: RuntimeAdapterPayload["station"]
    volume?: number
  }) => Promise<void | AtmosphereRuntimeCleanup>
  startToneProofDrone: (options?: {
    baseFrequency?: number
    detuneCents?: number
    fadeSeconds?: number
    volume?: number
    isCurrent?: () => boolean
  }) => Promise<void | AtmosphereRuntimeCleanup>
}

type LoadedAtmosphereRuntime = AtmosphereRuntimeModules & {
  controller: AtmosphereRuntimeController
}

const defaultStorage = createDefaultAtmosphereStorage() as AtmosphereStorageState

const defaultMusicContext: MusicContextType = {
  activePlaybackKind: null,
  activeStationId: null,
  activeStationTitle: null,
  activeStationArtwork: null,
  canNavigateStations: false,
  atmoShaperSnapshot: null,
  playbackState: "stopped",
  loadingProgress: null,
  loadingStartedAt: null,
  error: null,
  runtimeReadiness: { status: "idle", error: null },
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
  playAtmoShaper: async () => undefined,
  updateAtmoShaper: async () => undefined,
  retryAtmoShaperLayer: async () => undefined,
  playNextStation: async () => undefined,
  playPreviousStation: async () => undefined,
  prewarmStation: async () => undefined,
  retryRuntimeReadiness: () => undefined,
  pauseCurrent: async () => undefined,
  restartCurrent: async () => undefined,
  stopCurrent: async () => undefined,
  mediaIntegrationAvailable: false,
  resumeAfterInterruptionDefault: true,
  resumeAfterInterruptionForSession: true,
  interruptionNoticeSessionId: null,
  setSessionResumeAfterInterruption: () => undefined,
  setResumeAfterInterruptionDefault: () => undefined,
  dismissInterruptionNotice: () => undefined,
  setVolume: () => undefined,
  toggleFavorite: () => undefined,
  setMiniPlayerCollapsed: () => undefined,
  selectVisualizerBackground: () => undefined,
  setVisualizerShowClock: () => undefined,
  setCurrentVisualizerBackgroundAsDefault: async () => undefined,
  restoreVisualizerAccountDefault: () => undefined,
  retryVisualizerAccountSync: async () => undefined,
  getPlaybackDiagnostics: () => null,
}

const MusicContext = createContext<MusicContextType>(defaultMusicContext)

export function MusicProvider({
  children,
  accountSyncEnabled = true,
}: {
  children: ReactNode
  accountSyncEnabled?: boolean
}) {
  const [activePlaybackKind, setActivePlaybackKind] = useState<PlaybackKind>(null)
  const [activeStationId, setActiveStationId] = useState<string | null>(null)
  const [activeStationTitle, setActiveStationTitle] = useState<string | null>(null)
  const [activeStationArtwork, setActiveStationArtwork] = useState<AtmosphereStationArtworkInput | null>(null)
  const [atmoShaperSnapshot, setAtmoShaperSnapshot] = useState<AtmoShaperRuntimeSnapshot | null>(null)
  const [playbackState, setPlaybackState] = useState<PlaybackState>("stopped")
  const [loadingProgress, setLoadingProgress] = useState<number | null>(null)
  const [loadingStartedAt, setLoadingStartedAt] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const errorRef = useRef<string | null>(null)
  const [runtimeReadiness, setRuntimeReadiness] = useState<RuntimeReadinessState>({
    status: "idle",
    error: null,
  })
  const [storageState, setStorageState] = useState(defaultStorage)
  const [storageHydrated, setStorageHydrated] = useState(false)
  const [storageStatus, setStorageStatus] = useState<MusicVisualizerState["storageStatus"]>("loading")
  const [storageError, setStorageError] = useState<string | null>(null)
  const [accountDefaultBackgroundId, setAccountDefaultBackgroundId] = useState<string | null>(null)
  const [accountStatus, setAccountStatus] = useState<MusicVisualizerState["accountStatus"]>("loading")
  const [accountError, setAccountError] = useState<string | null>(null)
  const [accountSignedIn, setAccountSignedIn] = useState(false)
  const [mediaIntegrationAvailable, setMediaIntegrationAvailable] = useState(false)
  const [resumeAfterInterruptionDefault, setResumeAfterInterruptionDefaultState] = useState(true)
  const [resumeAfterInterruptionForSession, setResumeAfterInterruptionForSession] = useState(true)
  const [interruptionNoticeSessionId, setInterruptionNoticeSessionId] = useState<number | null>(null)
  const playbackRequestIdRef = useRef(0)
  const playbackSessionGenerationRef = useRef(0)
  const stoppedPlayerRetentionTimeoutRef = useRef<number | null>(null)
  const loadingStationIdRef = useRef<string | null>(null)
  const volumeRef = useRef(defaultStorage.volume)
  const runtimeRef = useRef<LoadedAtmosphereRuntime | null>(null)
  const runtimeLoadPromiseRef = useRef<Promise<LoadedAtmosphereRuntime> | null>(null)
  const atmoShaperRuntimeRef = useRef<LoadedAtmoShaperRuntime | null>(null)
  const atmoShaperPendingRuntimeRef = useRef<Promise<LoadedAtmoShaperRuntime> | null>(null)
  const atmoShaperDisposalPromiseRef = useRef<Promise<void>>(Promise.resolve())
  const atmoShaperRuntimeLeaseRef = useRef(0)
  const atmoShaperRecipeRef = useRef<AtmoShaperRecipe | null>(null)
  const atmoShaperRecipeRevisionRef = useRef(0)
  const atmoShaperDesiredTransportRef = useRef<"playing" | "paused">("paused")
  const atmoShaperStartupPromiseRef = useRef<Promise<unknown> | null>(null)
  const storageStateRef = useRef(defaultStorage)
  const accountRequestIdRef = useRef(0)
  const accountAbortControllerRef = useRef<AbortController | null>(null)
  const accountSyncVerifiedRef = useRef(false)
  const accountPreferencesHydratedRef = useRef(false)
  const accountDefaultBackgroundIdRef = useRef<string | null>(null)
  const pendingAccountDefaultBackgroundIdRef = useRef<string | null>(null)
  const failedAccountPayloadRef = useRef<MusicVisualizerAccountPreferences | null>(null)
  const isMountedRef = useRef(true)
  const activePlaybackKindRef = useRef<PlaybackKind>(null)
  const activeStationIdRef = useRef<string | null>(null)
  const activeStationMetadataRef = useRef<AtmosphereStationMetadata | null>(null)
  const activeStationArtworkRef = useRef<AtmosphereStationArtworkInput | null>(null)
  const mediaCarrierRef = useRef<ReturnType<typeof createAtmosphereMediaCarrier> | null>(null)
  const mediaSessionControllerRef = useRef<ReturnType<typeof createAtmosphereMediaSessionController> | null>(null)
  const interruptionMonitorRef = useRef<ReturnType<typeof createAtmosphereInterruptionMonitor> | null>(null)
  const interruptionMonitorUsesRuntimeContextRef = useRef(false)
  const carrierEventBridgeRef = useRef<EventTarget | null>(null)
  const playbackLifecycleRef = useRef(createAtmospherePlaybackLifecycle())
  const resumeAfterInterruptionDefaultRef = useRef(true)
  const playStationRef = useRef<MusicContextType["playStation"]>(async () => undefined)
  const playNextStationRef = useRef<MusicContextType["playNextStation"]>(async () => undefined)
  const playPreviousStationRef = useRef<MusicContextType["playPreviousStation"]>(async () => undefined)
  const pauseCurrentRef = useRef<() => Promise<void>>(async () => undefined)
  const restartCurrentRef = useRef<(origin?: PlaybackStartOptions["origin"]) => Promise<void>>(async () => undefined)
  const stopCurrentRef = useRef<() => Promise<void>>(async () => undefined)
  const interruptionStartedRef = useRef<() => void>(() => undefined)
  const interruptionRecoveredRef = useRef<() => void>(() => undefined)
  const ambiguousPauseRef = useRef<() => void>(() => undefined)

  const commitPlaybackLifecycle = useCallback((event: Parameters<typeof transitionAtmospherePlayback>[1]) => {
    const transition = transitionAtmospherePlayback(playbackLifecycleRef.current, event)
    playbackLifecycleRef.current = transition.state
    setPlaybackState(transition.state.status as PlaybackState)
    setResumeAfterInterruptionForSession(transition.state.resumeAfterInterruption)
    setInterruptionNoticeSessionId(transition.state.noticeSessionId)
    return transition
  }, [])

  /** Idempotently retires the single pending explicit-Stop deadline. */
  const cancelStoppedPlayerRetirement = useCallback(() => {
    if (stoppedPlayerRetentionTimeoutRef.current === null) return
    window.clearTimeout(stoppedPlayerRetentionTimeoutRef.current)
    stoppedPlayerRetentionTimeoutRef.current = null
  }, [])

  /** Clears retained identity only while the exact stopped source still owns it. */
  const retireStoppedPlayer = useCallback((
    sessionGeneration: number,
    stoppedStationId: string | null,
    stoppedPlaybackKind: Exclude<PlaybackKind, null>,
  ) => {
    stoppedPlayerRetentionTimeoutRef.current = null
    if (
      sessionGeneration !== playbackSessionGenerationRef.current
      || playbackLifecycleRef.current.status !== "stopped"
      || activePlaybackKindRef.current !== stoppedPlaybackKind
      || (stoppedPlaybackKind === "station" && activeStationIdRef.current !== stoppedStationId)
    ) return

    activePlaybackKindRef.current = null
    activeStationIdRef.current = null
    activeStationMetadataRef.current = null
    activeStationArtworkRef.current = null
    setActivePlaybackKind(null)
    setActiveStationId(null)
    setActiveStationTitle(null)
    setActiveStationArtwork(null)
    setAtmoShaperSnapshot(null)
  }, [])

  /** Replaces the prior Stop deadline so retention is anchored to the latest intent. */
  const scheduleStoppedPlayerRetirement = useCallback((
    sessionGeneration: number,
    stoppedStationId: string | null,
    stoppedPlaybackKind: PlaybackKind,
  ) => {
    cancelStoppedPlayerRetirement()
    if (!stoppedPlaybackKind) return
    stoppedPlayerRetentionTimeoutRef.current = window.setTimeout(
      () => retireStoppedPlayer(sessionGeneration, stoppedStationId, stoppedPlaybackKind),
      STOPPED_PLAYER_RETENTION_MS,
    )
  }, [cancelStoppedPlayerRetirement, retireStoppedPlayer])

  useEffect(() => () => {
    cancelStoppedPlayerRetirement()
  }, [cancelStoppedPlayerRetirement])

  const publishMediaSession = useCallback((
    station: AtmosphereStationMetadata,
    state: PlaybackState,
  ) => {
    const controller = mediaSessionControllerRef.current
    if (!controller) return
    const canNavigateStations = activePlaybackKindRef.current === "station"
    const mediaPlaybackState = state === "paused" || state === "interrupted"
      ? "paused"
      : state === "failed" || state === "stopped"
        ? "none"
        : "playing"
    controller.publish({
      metadata: station,
      playbackState: mediaPlaybackState,
      handlers: {
        play: () => void restartCurrentRef.current("media-session"),
        pause: () => {
          const monitor = interruptionMonitorRef.current
          if (monitor?.isInterrupted()) return
          if (monitor?.hasCurrentInterruptionSignal()) {
            interruptionStartedRef.current()
            return
          }
          void pauseCurrentRef.current()
        },
        stop: () => void stopCurrentRef.current(),
        previoustrack: canNavigateStations
          ? () => void playPreviousStationRef.current()
          : undefined,
        nexttrack: canNavigateStations
          ? () => void playNextStationRef.current()
          : undefined,
      },
    })
  }, [])

  /** Upgrade the early carrier observer with the generator's existing context once. */
  const ensureInterruptionMonitor = useCallback((runtime: LoadedAtmosphereRuntime) => {
    if (interruptionMonitorUsesRuntimeContextRef.current || !carrierEventBridgeRef.current) return
    const audioSession = (navigator as unknown as {
      audioSession?: EventTarget & { state: unknown, type?: unknown }
    }).audioSession
    let audioContext: (EventTarget & { state: unknown }) | null = null
    try {
      audioContext = runtime.getAtmosphereAudioContext()
    } catch {
      // Tone context access is optional for interruption fallback.
    }
    try {
      interruptionMonitorRef.current?.dispose()
      const monitor = createAtmosphereInterruptionMonitor({
        audioSession,
        audioContext,
        carrier: carrierEventBridgeRef.current,
        documentTarget: document,
        onInterrupted: () => interruptionStartedRef.current(),
        onRecovered: () => interruptionRecoveredRef.current(),
        onAmbiguousPause: () => ambiguousPauseRef.current(),
      })
      interruptionMonitorRef.current = monitor
      monitor.start()
      interruptionMonitorUsesRuntimeContextRef.current = true
    } catch {
      // Interruption APIs are optional and can disappear independently of the
      // audible generator, which must remain usable when observation fails.
    }
  }, [])

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

    if (!runtimeLoadPromiseRef.current) {
      setRuntimeReadiness({ status: "preparing", error: null })
      runtimeLoadPromiseRef.current = loadAtmosphereRuntimeModules().then((modules) => {
        const controller = modules.createAtmosphereRuntimeController({
          adapters: {
            "tone-proof-drone": async ({ station, isCurrent }) => modules.startToneProofDrone({
              ...station.runtime?.defaultOptions,
              isCurrent,
              volume: volumeRef.current,
            }),
            "generative-fm-piece": async ({ station, isCurrent }) => modules.startGenerativeFmPiece({
              isCurrent,
              onLoadProgress: (progress) => reportStationLoadProgress(station.id, progress),
              station,
              volume: volumeRef.current,
            }),
          },
        })
        const runtime = { ...modules, controller }
        runtimeRef.current = runtime
        if (isMountedRef.current) {
          setRuntimeReadiness({ status: "ready", error: null })
        }
        return runtime
      }).catch((caughtError) => {
        if (isMountedRef.current) {
          setRuntimeReadiness({ status: "error", error: "Audio setup failed. Try again." })
        }
        throw caughtError
      })
    }

    return runtimeLoadPromiseRef.current
  }, [reportStationLoadProgress])

  /**
   * Invalidates AtmoShaper callbacks immediately, then serializes cleanup of
   * both an adopted runtime and a runtime still crossing its lazy-load await.
   * This keeps overlapping source replacements from adopting or starting a
   * superseded audio owner.
   */
  const disposeAtmoShaperRuntime = useCallback(() => {
    atmoShaperRuntimeLeaseRef.current += 1
    const runtime = atmoShaperRuntimeRef.current
    const pendingRuntime = atmoShaperPendingRuntimeRef.current
    atmoShaperRuntimeRef.current = null
    atmoShaperPendingRuntimeRef.current = null

    const priorDisposal = atmoShaperDisposalPromiseRef.current
    const nextDisposal = priorDisposal.then(async () => {
      let pending: LoadedAtmoShaperRuntime | null = null
      if (pendingRuntime) {
        try {
          pending = await pendingRuntime
        } catch {
          // A failed lazy runtime has no owned graph to dispose.
        }
      }
      const runtimes = new Set([runtime, pending].filter((value): value is LoadedAtmoShaperRuntime => Boolean(value)))
      await Promise.all([...runtimes].map(async (ownedRuntime) => {
        try {
          await ownedRuntime.dispose()
        } catch {
          // Terminal replacement cleanup must continue for every captured owner.
        }
      }))
    })
    atmoShaperDisposalPromiseRef.current = nextDisposal.catch(() => undefined)
    return nextDisposal
  }, [])

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
    // Local-only routes disable account sync, which must block account-backed writes
    // even when a public provider callback is invoked after the route changes.
    if (!accountSyncEnabled) {
      return
    }

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
  }, [accountSyncEnabled, beginAccountRequest])

  const syncVisualizerAccountPreferences = useCallback(async () => {
    // Local-only routes must not perform either the session read or preferences read.
    if (!accountSyncEnabled) {
      return
    }

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
  }, [accountSyncEnabled, beginAccountRequest])

  // Browser media ownership is provider-scoped so route changes reuse one
  // carrier and one set of notification handlers.
  useEffect(() => {
    const bridge = new EventTarget()
    carrierEventBridgeRef.current = bridge
    mediaCarrierRef.current = createAtmosphereMediaCarrier({
      createAudio: () => new Audio(),
      onEvent: (event) => {
        bridge.dispatchEvent(new CustomEvent(event.type, { detail: { origin: event.origin } }))
      },
    })

    const mediaSession = (navigator as unknown as { mediaSession?: AtmosphereMediaSession }).mediaSession
    const MediaMetadataConstructor = (window as unknown as {
      MediaMetadata?: new (init: {
        title: string
        artist: string
        album: string
        artwork?: Array<{ src: string, sizes: string, type: string }>
      }) => unknown
    }).MediaMetadata
    mediaSessionControllerRef.current = createAtmosphereMediaSessionController({
      mediaSession,
      createMetadata: MediaMetadataConstructor
        ? (init) => new MediaMetadataConstructor(init)
        : null,
    })
    const audioSession = (navigator as unknown as {
      audioSession?: EventTarget & { state: unknown, type?: unknown }
    }).audioSession
    const earlyMonitor = createAtmosphereInterruptionMonitor({
      audioSession,
      audioContext: null,
      carrier: bridge,
      documentTarget: document,
      onInterrupted: () => interruptionStartedRef.current(),
      onRecovered: () => interruptionRecoveredRef.current(),
      onAmbiguousPause: () => ambiguousPauseRef.current(),
    })
    interruptionMonitorRef.current = earlyMonitor
    earlyMonitor.start()

    return () => {
      playbackRequestIdRef.current += 1
      interruptionMonitorRef.current?.dispose()
      interruptionMonitorRef.current = null
      interruptionMonitorUsesRuntimeContextRef.current = false
      mediaSessionControllerRef.current?.dispose()
      mediaSessionControllerRef.current = null
      mediaCarrierRef.current?.dispose()
      mediaCarrierRef.current = null
      carrierEventBridgeRef.current = null
    }
  }, [])

  // The interruption preference is device-local and guarded against browsers
  // that deny storage access.
  useEffect(() => {
    const preference = readAtmosphereInterruptionPreference(() => window.localStorage)
    resumeAfterInterruptionDefaultRef.current = preference.value
    setResumeAfterInterruptionDefaultState(preference.value)
    if (playbackLifecycleRef.current.sessionId === 0) {
      playbackLifecycleRef.current = createAtmospherePlaybackLifecycle(preference.value)
      setResumeAfterInterruptionForSession(preference.value)
    }
  }, [])

  // Keep the provider mounted globally for route-persistent playback, but load
  // the audio catalog/runtime only after a user plays or prewarms a station.
  useEffect(() => () => {
    const runtime = runtimeRef.current
    runtimeRef.current = null
    runtimeLoadPromiseRef.current = null
    void runtime?.controller.stop()
    void disposeAtmoShaperRuntime()
  }, [disposeAtmoShaperRuntime])

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

    if (!accountSyncEnabled) {
      // Aborting transport is not enough: invalidate every continuation that
      // already passed an abort boundary before local-only mode took effect.
      accountRequestIdRef.current += 1
      accountAbortControllerRef.current?.abort()
      accountSyncVerifiedRef.current = false
      accountPreferencesHydratedRef.current = false
      accountDefaultBackgroundIdRef.current = null
      pendingAccountDefaultBackgroundIdRef.current = null
      failedAccountPayloadRef.current = null
      setAccountDefaultBackgroundId(null)
      setAccountStatus("anonymous")
      setAccountError(null)
      setAccountSignedIn(false)
      return
    }

    void syncVisualizerAccountPreferences()
  }, [accountSyncEnabled, storageHydrated, syncVisualizerAccountPreferences])

  // Keep only the current owner's master output in sync with saved volume.
  // An inactive graph must never be woken or adjusted by preference hydration.
  useEffect(() => {
    volumeRef.current = storageState.volume
    if (activePlaybackKindRef.current === "station") {
      runtimeRef.current?.setToneProofDroneVolume(storageState.volume)
      runtimeRef.current?.setGenerativeFmPieceVolume(storageState.volume)
    } else if (activePlaybackKindRef.current === "atmoshaper") {
      atmoShaperRuntimeRef.current?.setMasterVolume(storageState.volume)
    }
  }, [storageState.volume])

  /** Settle notification/interruption availability without owning generator playback. */
  const settleMediaIntegrationAvailability = useCallback(({
    available,
    continueSession,
    origin,
    requestId,
    sessionGeneration,
  }: {
    available: boolean
    continueSession: boolean
    origin: PlaybackStartOptions["origin"]
    requestId: number
    sessionGeneration: number
  }) => {
    if (
      requestId !== playbackRequestIdRef.current
      || sessionGeneration !== playbackSessionGenerationRef.current
    ) return

    const lifecycleStatus = playbackLifecycleRef.current.status
    const canPublishNotice = lifecycleStatus !== "failed" && lifecycleStatus !== "stopped"
    const integrationAvailable = Boolean(
      available
      && mediaSessionControllerRef.current?.isAvailable()
      && interruptionMonitorRef.current?.isAvailable(),
    )
    setMediaIntegrationAvailable(integrationAvailable)
    if (
      integrationAvailable
      && canPublishNotice
      && origin !== "media-session"
      && !continueSession
      && document.visibilityState !== "hidden"
    ) {
      playbackLifecycleRef.current = {
        ...playbackLifecycleRef.current,
        noticeSessionId: playbackLifecycleRef.current.sessionId,
      }
      setInterruptionNoticeSessionId(playbackLifecycleRef.current.sessionId)
    } else if ((!integrationAvailable || !canPublishNotice) && !continueSession) {
      playbackLifecycleRef.current = {
        ...playbackLifecycleRef.current,
        noticeSessionId: null,
      }
      setInterruptionNoticeSessionId(null)
    }
  }, [])

  useEffect(() => {
    errorRef.current = error
  }, [error])

  // A preinstalled loopback-only browser-QA request receives provider-owned
  // snapshots without exposing audio nodes or a deployed production hook.
  useEffect(() => {
    if (!["localhost", "127.0.0.1", "::1"].includes(window.location.hostname)) return
    const bridge = Reflect.get(window, "__massagelabAtmoShaperBrowserQa") as {
      enabled?: unknown
      getDiagnostics?: () => AtmoShaperBrowserQaDiagnostics
    } | undefined
    if (bridge?.enabled !== true) return
    const getDiagnostics = (): AtmoShaperBrowserQaDiagnostics => ({
      activePlaybackKind: activePlaybackKindRef.current,
      activeStationId: activeStationIdRef.current,
      error: errorRef.current,
      playbackState: playbackLifecycleRef.current.status as PlaybackState,
      recipe: atmoShaperRecipeRef.current,
      runtime: atmoShaperRuntimeRef.current?.getSnapshot() ?? null,
    })
    bridge.getDiagnostics = getDiagnostics
    return () => {
      if (bridge.getDiagnostics === getDiagnostics) delete bridge.getDiagnostics
    }
  }, [])

  const playStation = useCallback(async (
    stationId: string,
    options: PlaybackStartOptions = {},
  ) => {
    cancelStoppedPlayerRetirement()
    const requestId = playbackRequestIdRef.current + 1
    playbackRequestIdRef.current = requestId
    const atmoShaperDisposal = disposeAtmoShaperRuntime()
    const continueSession = options.continueSession === true
      && playbackLifecycleRef.current.sessionId > 0
      && playbackLifecycleRef.current.status !== "stopped"
    if (continueSession) {
      const continued = {
        ...playbackLifecycleRef.current,
        status: "loading" as const,
        explicitIntent: "play" as const,
        interruptionObserved: false,
      }
      playbackLifecycleRef.current = continued
      setPlaybackState("loading")
    } else {
      playbackSessionGenerationRef.current += 1
      commitPlaybackLifecycle({
        type: options.origin === "media-session" ? "BEGIN_EXTERNAL_SESSION" : "BEGIN_IN_APP_SESSION",
        savedDefault: resumeAfterInterruptionDefaultRef.current,
        documentVisible: document.visibilityState !== "hidden",
        integrationAvailable: mediaIntegrationAvailable,
      })
    }
    const sessionGeneration = playbackSessionGenerationRef.current
    const lifecycleSessionId = playbackLifecycleRef.current.sessionId
    const retainedMetadata = activeStationIdRef.current === stationId
      ? activeStationMetadataRef.current
      : null
    const resolvedSuppliedArtwork = options.artworkInput
      ? resolveAtmosphereStationArtworkInput(options.artworkInput)
      : null
    const suppliedArtwork = resolvedSuppliedArtwork?.stationId === stationId
      ? resolvedSuppliedArtwork
      : null
    const retainedArtwork = activeStationIdRef.current === stationId
      ? activeStationArtworkRef.current
      : null
    const initialArtwork = suppliedArtwork ?? retainedArtwork
    activePlaybackKindRef.current = "station"
    activeStationIdRef.current = stationId
    activeStationArtworkRef.current = initialArtwork
    setActivePlaybackKind("station")
    setActiveStationId(stationId)
    setActiveStationTitle(initialArtwork?.title ?? retainedMetadata?.title ?? null)
    setActiveStationArtwork(initialArtwork)
    setAtmoShaperSnapshot(null)
    setLoadingProgress(0.02)
    setLoadingStartedAt(Date.now())
    loadingStationIdRef.current = stationId
    setError(null)
    publishMediaSession(
      retainedMetadata ?? {
        id: stationId,
        title: initialArtwork?.title ?? "Atmosphere",
        artist: "MassageLab",
      },
      "loading",
    )

    // Start the carrier before the first await so media ownership is requested
    // in the same user-activation turn as the accepted Play intent.
    const carrierStartPromise = mediaCarrierRef.current?.start()
      ?? Promise.resolve({ available: false })

    let runtimeAndStation: { runtime: LoadedAtmosphereRuntime, station: AtmosphereStation }
    try {
      const runtime = await getRuntime()
      ensureInterruptionMonitor(runtime)
      const station = runtime.getAtmosphereStationById(stationId)
      runtimeAndStation = { runtime, station }
    } catch (caughtError) {
      if (
        requestId !== playbackRequestIdRef.current
        || sessionGeneration !== playbackSessionGenerationRef.current
      ) {
        return
      }

      loadingStationIdRef.current = null
      setLoadingProgress(null)
      setLoadingStartedAt(null)
      commitPlaybackLifecycle({ type: "START_FAILED", sessionId: lifecycleSessionId })
      mediaCarrierRef.current?.stopAndDismiss()
      mediaSessionControllerRef.current?.clear()
      setError(caughtError instanceof Error ? caughtError.message : "Audio runtime could not load.")
      return
    }
    const { runtime, station } = runtimeAndStation
    const stationArtwork = suppliedArtwork ?? resolveAtmosphereStationArtworkInput(station)

    void carrierStartPromise
      .catch(() => ({ available: false }))
      .then(({ available }) => {
        settleMediaIntegrationAvailability({
          available,
          continueSession,
          origin: options.origin,
          requestId,
          sessionGeneration,
        })
      })

    if (
      requestId !== playbackRequestIdRef.current
      || sessionGeneration !== playbackSessionGenerationRef.current
    ) {
      return
    }

    if (!station.enabled) {
      setActiveStationId(station.id)
      setActiveStationTitle(station.title)
      setActiveStationArtwork(stationArtwork)
      activeStationArtworkRef.current = stationArtwork
      activeStationMetadataRef.current = {
        id: station.id,
        title: station.title,
        artist: getStationArtist(station),
      }
      commitPlaybackLifecycle({ type: "START_FAILED", sessionId: lifecycleSessionId })
      setLoadingProgress(null)
      setLoadingStartedAt(null)
      loadingStationIdRef.current = null
      setError(station.disabledReason ?? "This station is not playable yet.")
      mediaCarrierRef.current?.stopAndDismiss()
      mediaSessionControllerRef.current?.clear()
      return
    }

    const stationMetadata = { id: station.id, title: station.title, artist: getStationArtist(station) }
    setActiveStationId(station.id)
    setActiveStationTitle(station.title)
    setActiveStationArtwork(stationArtwork)
    activeStationIdRef.current = station.id
    activeStationArtworkRef.current = stationArtwork
    activeStationMetadataRef.current = stationMetadata
    setPlaybackState("loading")
    setLoadingProgress(0.05)
    setLoadingStartedAt(Date.now())
    loadingStationIdRef.current = station.id
    setError(null)
    publishMediaSession(stationMetadata, "loading")

    try {
      await atmoShaperDisposal
      if (
        requestId !== playbackRequestIdRef.current
        || sessionGeneration !== playbackSessionGenerationRef.current
      ) {
        return
      }
      const runtimeResult = await runtime.controller.start(station)
      await carrierStartPromise.catch(() => ({ available: false }))
      if (
        runtimeResult.status !== "active"
        || requestId !== playbackRequestIdRef.current
        || sessionGeneration !== playbackSessionGenerationRef.current
      ) {
        return
      }

      loadingStationIdRef.current = null
      setLoadingProgress(null)
      setLoadingStartedAt(null)
      commitPlaybackLifecycle({ type: "START_SUCCEEDED", sessionId: lifecycleSessionId })
      publishMediaSession(stationMetadata, "playing")
      setStorageState((current) => ({
        ...current,
        recentStations: [station.id, ...current.recentStations.filter((id) => id !== station.id)].slice(0, 12),
      }))
    } catch (caughtError) {
      if (
        requestId !== playbackRequestIdRef.current
        || sessionGeneration !== playbackSessionGenerationRef.current
      ) {
        return
      }

      loadingStationIdRef.current = null
      setLoadingProgress(null)
      setLoadingStartedAt(null)
      commitPlaybackLifecycle({ type: "START_FAILED", sessionId: lifecycleSessionId })
      mediaCarrierRef.current?.pauseRetained()
      publishMediaSession(stationMetadata, "paused")
      setError(caughtError instanceof Error ? caughtError.message : "Audio could not start.")
    }
  }, [
    cancelStoppedPlayerRetirement,
    commitPlaybackLifecycle,
    disposeAtmoShaperRuntime,
    ensureInterruptionMonitor,
    getRuntime,
    mediaIntegrationAvailable,
    publishMediaSession,
    settleMediaIntegrationAvailability,
  ])

  /**
   * Replaces the ordinary station owner with one lazily composed mixer. The
   * provider owns the cross-source lease; the runtime owns only mix layers.
   */
  const playAtmoShaper = useCallback(async (
    recipe: AtmoShaperRecipe,
    options: Pick<PlaybackStartOptions, "origin"> = {},
  ) => {
    cancelStoppedPlayerRetirement()
    const requestId = playbackRequestIdRef.current + 1
    playbackRequestIdRef.current = requestId
    playbackSessionGenerationRef.current += 1
    const sessionGeneration = playbackSessionGenerationRef.current
    commitPlaybackLifecycle({
      type: options.origin === "media-session" ? "BEGIN_EXTERNAL_SESSION" : "BEGIN_IN_APP_SESSION",
      savedDefault: resumeAfterInterruptionDefaultRef.current,
      documentVisible: document.visibilityState !== "hidden",
      integrationAvailable: mediaIntegrationAvailable,
    })
    const lifecycleSessionId = playbackLifecycleRef.current.sessionId

    // Cross-source replacement waits for the ordinary handle's fade/disposal;
    // ordinary station pause and station-to-station replacement remain on the
    // controller's backward-compatible immediate stop path.
    const ordinaryStationDisposal = runtimeRef.current?.controller.stopAndWait()
      ?? Promise.resolve({ requestId: 0 })
    const priorAtmoShaperDisposal = disposeAtmoShaperRuntime()

    const title = recipe.name || "AtmoShaper"
    const artwork: AtmosphereStationArtworkInput = {
      stationId: `atmoshaper:${recipe.artworkSeed}`,
      title,
      description: "A custom AtmoShaper mix.",
      groupId: "atmoshaper",
    }
    const metadata = { id: artwork.stationId, title, artist: "MassageLab" }
    atmoShaperRecipeRef.current = recipe
    atmoShaperRecipeRevisionRef.current += 1
    atmoShaperDesiredTransportRef.current = "playing"
    activePlaybackKindRef.current = "atmoshaper"
    activeStationIdRef.current = null
    activeStationMetadataRef.current = metadata
    activeStationArtworkRef.current = artwork
    setActivePlaybackKind("atmoshaper")
    setActiveStationId(null)
    setActiveStationTitle(title)
    setActiveStationArtwork(artwork)
    setAtmoShaperSnapshot({ status: "loading", recipe, layers: {}, activeLayers: {} })
    setLoadingProgress(null)
    setLoadingStartedAt(Date.now())
    loadingStationIdRef.current = null
    setError(null)
    publishMediaSession(metadata, "loading")

    // Preserve the current user-activation turn for platform media ownership.
    const carrierStartPromise = mediaCarrierRef.current?.start()
      ?? Promise.resolve({ available: false })

    try {
      await ordinaryStationDisposal
      await priorAtmoShaperDisposal
      if (
        sessionGeneration !== playbackSessionGenerationRef.current
        || activePlaybackKindRef.current !== "atmoshaper"
      ) return

      const runtimeLease = ++atmoShaperRuntimeLeaseRef.current
      const pendingRuntime = import("@/lib/atmoshaper/runtime").then(async ({
        createAtmoShaperRuntime,
      }) => {
        const runtime = await createAtmoShaperRuntime({
          initialMasterVolume: volumeRef.current,
          onSnapshot(snapshot) {
            if (
              runtimeLease !== atmoShaperRuntimeLeaseRef.current
              || activePlaybackKindRef.current !== "atmoshaper"
            ) return
            const nextSnapshot = {
              ...snapshot,
              recipe: atmoShaperRecipeRef.current ?? snapshot.recipe,
            } as AtmoShaperRuntimeSnapshot
            setAtmoShaperSnapshot(nextSnapshot)
            const lifecycle = playbackLifecycleRef.current
            if (lifecycle.status !== "loading" && lifecycle.status !== "interrupted") {
              if (
                nextSnapshot.status === "playing"
                || nextSnapshot.status === "paused"
                || nextSnapshot.status === "failed"
              ) {
                playbackLifecycleRef.current = {
                  ...lifecycle,
                  status: nextSnapshot.status,
                  explicitIntent: nextSnapshot.status === "paused" ? "pause" : "play",
                }
                setPlaybackState(nextSnapshot.status)
              }
            }
            if (nextSnapshot.status === "failed") {
              setError(firstAtmoShaperError(nextSnapshot) ?? "AtmoShaper could not start any layer.")
              mediaCarrierRef.current?.stopAndDismiss()
              const metadata = activeStationMetadataRef.current
              if (metadata) publishMediaSession(metadata, "failed")
            }
          },
        })
        return runtime as LoadedAtmoShaperRuntime
      })
      atmoShaperPendingRuntimeRef.current = pendingRuntime
      const runtime = await pendingRuntime
      if (atmoShaperPendingRuntimeRef.current === pendingRuntime) {
        atmoShaperPendingRuntimeRef.current = null
      }
      if (runtimeLease !== atmoShaperRuntimeLeaseRef.current) return
      atmoShaperRuntimeRef.current = runtime

      const startupPromise = settleSourceRuntimeStartup({
        runtime,
        isCurrent: () => (
          runtimeLease === atmoShaperRuntimeLeaseRef.current
          && sessionGeneration === playbackSessionGenerationRef.current
          && activePlaybackKindRef.current === "atmoshaper"
        ),
        readState: () => ({
          recipe: atmoShaperRecipeRef.current ?? recipe,
          revision: atmoShaperRecipeRevisionRef.current,
          desiredTransport: atmoShaperDesiredTransportRef.current,
        }),
      })
      atmoShaperStartupPromiseRef.current = startupPromise
      const startup = await startupPromise.finally(() => {
        if (atmoShaperStartupPromiseRef.current === startupPromise) {
          atmoShaperStartupPromiseRef.current = null
        }
      })
      await carrierStartPromise.catch(() => ({ available: false }))
      if (
        startup.status !== "current"
        || sessionGeneration !== playbackSessionGenerationRef.current
        || runtimeLease !== atmoShaperRuntimeLeaseRef.current
        || activePlaybackKindRef.current !== "atmoshaper"
      ) return

      const snapshot = runtime.getSnapshot()
      const latestMetadata = activeStationMetadataRef.current ?? metadata
      setLoadingStartedAt(null)
      if (snapshot.status === "playing") {
        commitPlaybackLifecycle({ type: "START_SUCCEEDED", sessionId: lifecycleSessionId })
        setError(null)
        publishMediaSession(latestMetadata, "playing")
      } else if (snapshot.status === "paused") {
        setError(null)
        mediaCarrierRef.current?.pauseRetained()
        publishMediaSession(latestMetadata, "paused")
      } else {
        commitPlaybackLifecycle({ type: "START_FAILED", sessionId: lifecycleSessionId })
        setError(firstAtmoShaperError(snapshot) ?? "AtmoShaper could not start any layer.")
        mediaCarrierRef.current?.stopAndDismiss()
        publishMediaSession(latestMetadata, "failed")
      }
    } catch (caughtError) {
      if (
        sessionGeneration !== playbackSessionGenerationRef.current
        || activePlaybackKindRef.current !== "atmoshaper"
      ) return
      setLoadingStartedAt(null)
      commitPlaybackLifecycle({ type: "START_FAILED", sessionId: lifecycleSessionId })
      mediaCarrierRef.current?.stopAndDismiss()
      mediaSessionControllerRef.current?.clear()
      setError(caughtError instanceof Error ? caughtError.message : "AtmoShaper audio could not start.")
    }

    void carrierStartPromise
      .catch(() => ({ available: false }))
      .then(({ available }) => settleMediaIntegrationAvailability({
        available,
        continueSession: false,
        origin: options.origin,
        requestId,
        sessionGeneration,
      }))
  }, [
    cancelStoppedPlayerRetirement,
    commitPlaybackLifecycle,
    disposeAtmoShaperRuntime,
    mediaIntegrationAvailable,
    publishMediaSession,
    settleMediaIntegrationAvailability,
  ])

  /** Updates the retained recipe and only reconciles adapters for the active mix owner. */
  const updateAtmoShaper = useCallback(async (recipe: AtmoShaperRecipe) => {
    atmoShaperRecipeRef.current = recipe
    atmoShaperRecipeRevisionRef.current += 1
    if (activePlaybackKindRef.current !== "atmoshaper") return

    const title = recipe.name || "AtmoShaper"
    const artwork: AtmosphereStationArtworkInput = {
      stationId: `atmoshaper:${recipe.artworkSeed}`,
      title,
      description: "A custom AtmoShaper mix.",
      groupId: "atmoshaper",
    }
    const metadata = { id: artwork.stationId, title, artist: "MassageLab" }
    activeStationMetadataRef.current = metadata
    activeStationArtworkRef.current = artwork
    setActiveStationTitle(title)
    setActiveStationArtwork(artwork)

    const runtime = atmoShaperRuntimeRef.current
    if (!runtime || atmoShaperStartupPromiseRef.current) {
      const currentSnapshot = runtime?.getSnapshot()
      const pendingStatus = playbackLifecycleRef.current.status === "stopped"
        ? "stopped"
        : atmoShaperDesiredTransportRef.current === "paused" ? "paused" : "loading"
      setAtmoShaperSnapshot({
        status: pendingStatus,
        recipe,
        layers: currentSnapshot?.layers ?? {},
        activeLayers: currentSnapshot?.activeLayers ?? {},
      })
      return
    }
    const runtimeLease = atmoShaperRuntimeLeaseRef.current
    try {
      await runtime.applyRecipe(recipe)
      if (
        runtimeLease !== atmoShaperRuntimeLeaseRef.current
        || activePlaybackKindRef.current !== "atmoshaper"
      ) return
      publishMediaSession(metadata, playbackLifecycleRef.current.status as PlaybackState)
    } catch (caughtError) {
      if (runtimeLease !== atmoShaperRuntimeLeaseRef.current) return
      setError(caughtError instanceof Error ? caughtError.message : "AtmoShaper could not update.")
    }
  }, [publishMediaSession])

  /** Reconciles the current recipe when its requested failed layer is still visible. */
  const retryAtmoShaperLayer = useCallback(async (layerId: string) => {
    const runtime = atmoShaperRuntimeRef.current
    const recipe = atmoShaperRecipeRef.current
    const snapshot = runtime?.getSnapshot()
    if (
      activePlaybackKindRef.current !== "atmoshaper"
      || !runtime
      || !recipe
      || snapshot?.layers[layerId]?.status !== "failed"
    ) return
    if (snapshot.status === "failed") {
      // With no surviving layer there is no active media owner to resume.
      // Re-enter the full start path so carrier, lifecycle, and metadata agree.
      await playAtmoShaper(recipe)
    } else {
      await runtime.applyRecipe(recipe)
    }
  }, [playAtmoShaper])

  const playAdjacentStation = useCallback(async (direction: 1 | -1) => {
    cancelStoppedPlayerRetirement()
    if (activePlaybackKindRef.current !== "station") return
    const navigationRequestId = playbackRequestIdRef.current
    const navigationSessionGeneration = playbackSessionGenerationRef.current
    const runtime = await getRuntime()
    if (
      navigationRequestId !== playbackRequestIdRef.current
      || navigationSessionGeneration !== playbackSessionGenerationRef.current
    ) {
      return
    }
    const playableStationIds = runtime.playableStationIds
    if (playableStationIds.length === 0) {
      return
    }

    const currentStationId = activeStationIdRef.current
    const currentIndex = currentStationId ? playableStationIds.indexOf(currentStationId) : -1
    const fallbackIndex = direction === 1 ? -1 : 0
    const nextIndex = (currentIndex >= 0 ? currentIndex : fallbackIndex) + direction
    const normalizedIndex = (nextIndex + playableStationIds.length) % playableStationIds.length
    const nextStation = runtime.getAtmosphereStationById(playableStationIds[normalizedIndex])
    const artworkInput = resolveAtmosphereStationArtworkInput(nextStation)
    await playStation(nextStation.id, {
      artworkInput: artworkInput ?? undefined,
      continueSession: true,
    })
  }, [cancelStoppedPlayerRetirement, getRuntime, playStation])

  const playNextStation = useCallback(async () => {
    await playAdjacentStation(1)
  }, [playAdjacentStation])

  const playPreviousStation = useCallback(async () => {
    await playAdjacentStation(-1)
  }, [playAdjacentStation])

  /** Reloads the pre-play route after a failed dynamic import clears only with a fresh module graph. */
  const retryRuntimeReadiness = useCallback(() => {
    window.location.reload()
  }, [])

  const prewarmStation = useCallback(async (
    stationId: string,
    options: { includeSamplePayloads?: boolean, signal?: AbortSignal } = {},
  ) => {
    try {
      const runtime = await startAbortableGenerativeFmPrewarm(getRuntime, options.signal)
      options.signal?.throwIfAborted()
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

  const pauseCurrent = useCallback(async () => {
    const requestId = playbackRequestIdRef.current + 1
    playbackRequestIdRef.current = requestId
    commitPlaybackLifecycle({ type: "EXPLICIT_PAUSE" })
    setLoadingProgress(null)
    setLoadingStartedAt(null)
    loadingStationIdRef.current = null
    setError(null)
    mediaCarrierRef.current?.pauseRetained()
    const metadata = activeStationMetadataRef.current
    if (metadata) publishMediaSession(metadata, "paused")

    try {
      if (activePlaybackKindRef.current === "atmoshaper") {
        atmoShaperDesiredTransportRef.current = "paused"
        const runtime = atmoShaperRuntimeRef.current
        await runtime?.pause()
        const recipe = atmoShaperRecipeRef.current
        const snapshot = runtime?.getSnapshot()
        setAtmoShaperSnapshot(recipe
          ? {
              status: "paused",
              recipe,
              layers: snapshot?.layers ?? {},
              activeLayers: snapshot?.activeLayers ?? {},
            }
          : null)
      } else if (activePlaybackKindRef.current === "station") {
        // Ordinary station pause intentionally retains its established
        // dispose-and-restart semantics; only AtmoShaper keeps live handles.
        runtimeRef.current?.controller.stop()
      }
    } catch (caughtError) {
      if (requestId !== playbackRequestIdRef.current) {
        return
      }

      setError(caughtError instanceof Error ? caughtError.message : "Audio could not pause.")
    }
  }, [commitPlaybackLifecycle, publishMediaSession])

  /** Resumes AtmoShaper handles in place, while ordinary stations restart as before. */
  const restartCurrent = useCallback(async (
    origin: PlaybackStartOptions["origin"] = "in-app",
  ) => {
    const kind = activePlaybackKindRef.current
    if (kind === "station") {
      const stationId = activeStationIdRef.current
      if (stationId) await playStation(stationId, { origin })
      return
    }
    if (kind !== "atmoshaper") return

    const recipe = atmoShaperRecipeRef.current
    const runtime = atmoShaperRuntimeRef.current
    if (!recipe) return
    atmoShaperDesiredTransportRef.current = "playing"
    const startupPromise = atmoShaperStartupPromiseRef.current
    const runtimeStatus = runtime?.getSnapshot().status
    if (!runtime || (!startupPromise && runtimeStatus !== "paused" && runtimeStatus !== "loading")) {
      await playAtmoShaper(recipe, { origin })
      return
    }

    cancelStoppedPlayerRetirement()
    const requestId = playbackRequestIdRef.current + 1
    playbackRequestIdRef.current = requestId
    const sessionId = playbackLifecycleRef.current.sessionId
    playbackLifecycleRef.current = {
      ...playbackLifecycleRef.current,
      status: "loading",
      explicitIntent: "play",
      interruptionObserved: false,
    }
    setPlaybackState("loading")
    setError(null)
    const metadata = activeStationMetadataRef.current
    if (metadata) publishMediaSession(metadata, "loading")
    const carrierStartPromise = mediaCarrierRef.current?.start()
      ?? Promise.resolve({ available: false })

    try {
      await runtime.resume()
      await startupPromise
      await carrierStartPromise.catch(() => ({ available: false }))
      if (
        requestId !== playbackRequestIdRef.current
        || activePlaybackKindRef.current !== "atmoshaper"
      ) return
      const snapshot = runtime.getSnapshot()
      if (snapshot.status === "playing") {
        commitPlaybackLifecycle({ type: "START_SUCCEEDED", sessionId })
        if (metadata) publishMediaSession(metadata, "playing")
      } else {
        commitPlaybackLifecycle({ type: "START_FAILED", sessionId })
        mediaCarrierRef.current?.stopAndDismiss()
        if (metadata) publishMediaSession(metadata, "failed")
        setError(firstAtmoShaperError(snapshot) ?? "AtmoShaper could not resume.")
      }
    } catch (caughtError) {
      if (requestId !== playbackRequestIdRef.current) return
      commitPlaybackLifecycle({ type: "START_FAILED", sessionId })
      mediaCarrierRef.current?.stopAndDismiss()
      if (metadata) publishMediaSession(metadata, "failed")
      setError(caughtError instanceof Error ? caughtError.message : "Audio could not resume.")
    }
  }, [
    cancelStoppedPlayerRetirement,
    commitPlaybackLifecycle,
    playAtmoShaper,
    playStation,
    publishMediaSession,
  ])

  const stopCurrent = useCallback(async () => {
    cancelStoppedPlayerRetirement()
    const requestId = playbackRequestIdRef.current + 1
    playbackRequestIdRef.current = requestId
    playbackSessionGenerationRef.current += 1
    const sessionGeneration = playbackSessionGenerationRef.current
    const stoppedPlaybackKind = activePlaybackKindRef.current
    const stoppedStationId = activeStationIdRef.current
    commitPlaybackLifecycle({ type: "EXPLICIT_STOP" })
    setLoadingProgress(null)
    setLoadingStartedAt(null)
    loadingStationIdRef.current = null
    setError(null)
    mediaCarrierRef.current?.stopAndDismiss()
    mediaSessionControllerRef.current?.clear()

    try {
      if (stoppedPlaybackKind === "atmoshaper") {
        atmoShaperDesiredTransportRef.current = "paused"
        const committed = await commitOwnedPlaybackEffect({
          effect: async () => { await disposeAtmoShaperRuntime() },
          isCurrent: () => (
            requestId === playbackRequestIdRef.current
            && sessionGeneration === playbackSessionGenerationRef.current
            && activePlaybackKindRef.current === stoppedPlaybackKind
          ),
          commit: () => {
            setAtmoShaperSnapshot(atmoShaperRecipeRef.current
              ? {
                  status: "stopped",
                  recipe: atmoShaperRecipeRef.current,
                  layers: {},
                  activeLayers: {},
                }
              : null)
          },
        })
        if (!committed) return
      } else if (stoppedPlaybackKind === "station") {
        runtimeRef.current?.controller.stop()
      }
    } catch (caughtError) {
      if (requestId !== playbackRequestIdRef.current) return
      setError(caughtError instanceof Error ? caughtError.message : "Audio could not stop.")
    }
    if (
      requestId !== playbackRequestIdRef.current
      || sessionGeneration !== playbackSessionGenerationRef.current
      || activePlaybackKindRef.current !== stoppedPlaybackKind
    ) return
    scheduleStoppedPlayerRetirement(sessionGeneration, stoppedStationId, stoppedPlaybackKind)
  }, [
    cancelStoppedPlayerRetirement,
    commitPlaybackLifecycle,
    disposeAtmoShaperRuntime,
    scheduleStoppedPlayerRetirement,
  ])

  const handleInterruptionStarted = useCallback(() => {
    const current = playbackLifecycleRef.current
    if (current.status !== "playing" && current.status !== "loading") return
    playbackRequestIdRef.current += 1
    const transition = commitPlaybackLifecycle({ type: "INTERRUPTION_STARTED" })
    if (activePlaybackKindRef.current === "atmoshaper") {
      atmoShaperDesiredTransportRef.current = "paused"
      void atmoShaperRuntimeRef.current?.pause().catch((caughtError: unknown) => {
        setError(caughtError instanceof Error ? caughtError.message : "Audio could not pause.")
      })
    } else try {
      runtimeRef.current?.controller.stop()
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Audio could not pause.")
    }
    mediaCarrierRef.current?.pauseRetained()
    const metadata = activeStationMetadataRef.current
    if (metadata) publishMediaSession(metadata, "paused")
    if (transition.state.status === "paused") {
      setError(null)
    }
  }, [commitPlaybackLifecycle, publishMediaSession])

  const handleInterruptionRecovered = useCallback(() => {
    const sessionGeneration = playbackSessionGenerationRef.current
    const transition = commitPlaybackLifecycle({ type: "INTERRUPTION_ENDED" })
    const playbackKind = activePlaybackKindRef.current
    const stationId = activeStationIdRef.current
    if (
      transition.effects.includes("RESUME_GENERATOR")
      && sessionGeneration === playbackSessionGenerationRef.current
    ) {
      if (playbackKind === "station" && stationId) {
        void playStationRef.current(stationId, {
          origin: "media-session",
          continueSession: true,
        })
      } else if (playbackKind === "atmoshaper") {
        atmoShaperDesiredTransportRef.current = "playing"
        const runtime = atmoShaperRuntimeRef.current
        const recipe = atmoShaperRecipeRef.current
        if (runtime && recipe) {
          const carrierStartPromise = mediaCarrierRef.current?.start()
            ?? Promise.resolve({ available: false })
          const startupPromise = atmoShaperStartupPromiseRef.current
          const resume = startupPromise || runtime.getSnapshot().status === "paused"
            ? runtime.resume()
            : runtime.start(recipe)
          void Promise.all([
            resume,
            startupPromise,
            carrierStartPromise.catch(() => ({ available: false })),
          ]).then(() => {
            if (
              playbackSessionGenerationRef.current !== sessionGeneration
              || activePlaybackKindRef.current !== "atmoshaper"
            ) return
            if (runtime.getSnapshot().status !== "playing") return
            const metadata = activeStationMetadataRef.current
            if (metadata) publishMediaSession(metadata, "playing")
          }).catch((caughtError: unknown) => {
            setError(caughtError instanceof Error ? caughtError.message : "Audio could not resume.")
          })
        }
      }
    }
  }, [commitPlaybackLifecycle, publishMediaSession])

  useEffect(() => {
    playStationRef.current = playStation
    playNextStationRef.current = playNextStation
    playPreviousStationRef.current = playPreviousStation
    pauseCurrentRef.current = pauseCurrent
    restartCurrentRef.current = restartCurrent
    stopCurrentRef.current = stopCurrent
    interruptionStartedRef.current = handleInterruptionStarted
    interruptionRecoveredRef.current = handleInterruptionRecovered
    ambiguousPauseRef.current = () => void pauseCurrentRef.current()
  }, [
    handleInterruptionRecovered,
    handleInterruptionStarted,
    pauseCurrent,
    playNextStation,
    playPreviousStation,
    playStation,
    restartCurrent,
    stopCurrent,
  ])

  const setSessionResumeAfterInterruption = useCallback((value: boolean) => {
    commitPlaybackLifecycle({ type: "SET_SESSION_RESUME", value })
  }, [commitPlaybackLifecycle])

  const setResumeAfterInterruptionDefault = useCallback((value: boolean) => {
    const result = writeAtmosphereInterruptionPreference(() => window.localStorage, value)
    resumeAfterInterruptionDefaultRef.current = result.value
    setResumeAfterInterruptionDefaultState(result.value)
    commitPlaybackLifecycle({ type: "SET_SESSION_RESUME", value: result.value })
  }, [commitPlaybackLifecycle])

  const dismissInterruptionNotice = useCallback((sessionId: number) => {
    commitPlaybackLifecycle({ type: "DISMISS_NOTICE", sessionId })
  }, [commitPlaybackLifecycle])

  const setVolume = useCallback((nextVolume: number) => {
    const clampedVolume = Math.min(1, Math.max(0, nextVolume))
    volumeRef.current = clampedVolume
    if (activePlaybackKindRef.current === "atmoshaper") {
      atmoShaperRuntimeRef.current?.setMasterVolume(clampedVolume)
    } else if (activePlaybackKindRef.current === "station") {
      runtimeRef.current?.setToneProofDroneVolume(clampedVolume)
      runtimeRef.current?.setGenerativeFmPieceVolume(clampedVolume)
    }
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

  const getPlaybackDiagnostics = useCallback(() => (
    runtimeRef.current?.getToneProofDroneDiagnostics() ?? null
  ), [])

  const value = useMemo<MusicContextType>(() => ({
    activePlaybackKind,
    activeStationId,
    activeStationTitle,
    activeStationArtwork,
    canNavigateStations: activePlaybackKind === "station" && activeStationId !== null,
    atmoShaperSnapshot,
    playbackState,
    loadingProgress,
    loadingStartedAt,
    error,
    runtimeReadiness,
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
    playAtmoShaper,
    updateAtmoShaper,
    retryAtmoShaperLayer,
    playNextStation,
    playPreviousStation,
    prewarmStation,
    retryRuntimeReadiness,
    pauseCurrent,
    restartCurrent,
    stopCurrent,
    mediaIntegrationAvailable,
    resumeAfterInterruptionDefault,
    resumeAfterInterruptionForSession,
    interruptionNoticeSessionId,
    setSessionResumeAfterInterruption,
    setResumeAfterInterruptionDefault,
    dismissInterruptionNotice,
    setVolume,
    toggleFavorite,
    setMiniPlayerCollapsed,
    selectVisualizerBackground,
    setVisualizerShowClock,
    setCurrentVisualizerBackgroundAsDefault,
    restoreVisualizerAccountDefault,
    retryVisualizerAccountSync,
    getPlaybackDiagnostics,
  }), [
    accountDefaultBackgroundId,
    accountError,
    accountSignedIn,
    accountStatus,
    activePlaybackKind,
    activeStationId,
    activeStationArtwork,
    activeStationTitle,
    atmoShaperSnapshot,
    dismissInterruptionNotice,
    error,
    interruptionNoticeSessionId,
    loadingProgress,
    loadingStartedAt,
    pauseCurrent,
    playAtmoShaper,
    playNextStation,
    playPreviousStation,
    playStation,
    playbackState,
    prewarmStation,
    retryRuntimeReadiness,
    retryAtmoShaperLayer,
    runtimeReadiness,
    mediaIntegrationAvailable,
    resumeAfterInterruptionDefault,
    resumeAfterInterruptionForSession,
    restoreVisualizerAccountDefault,
    restartCurrent,
    retryVisualizerAccountSync,
    getPlaybackDiagnostics,
    selectVisualizerBackground,
    setMiniPlayerCollapsed,
    setResumeAfterInterruptionDefault,
    setSessionResumeAfterInterruption,
    setCurrentVisualizerBackgroundAsDefault,
    setVisualizerShowClock,
    setVolume,
    stopCurrent,
    storageState,
    storageError,
    storageStatus,
    toggleFavorite,
    updateAtmoShaper,
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

/** Returns one privacy-safe layer failure for the global player status. */
function firstAtmoShaperError(snapshot: AtmoShaperRuntimeSnapshot) {
  return Object.values(snapshot.layers).find(({ error }) => Boolean(error))?.error ?? null
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
    toneGlobal,
  ] = await Promise.all([
    import("@/lib/atmosphere/stations"),
    import("@/lib/atmosphere/runtime-controller"),
    import("@/lib/atmosphere/generative-fm-runtime"),
    import("@/lib/atmosphere/tone-proof-runtime"),
    import("tone/build/esm/core/Global"),
  ])

  return {
    createAtmosphereRuntimeController: runtimeController.createAtmosphereRuntimeController,
    getAtmosphereStationById: stations.getAtmosphereStationById as AtmosphereRuntimeModules["getAtmosphereStationById"],
    playableStationIds: stations.getPlayableAtmosphereStations().map((station: AtmosphereStation) => station.id),
    prewarmGenerativeFmPiece: generativeRuntime.prewarmGenerativeFmPiece,
    setGenerativeFmPieceVolume: generativeRuntime.setGenerativeFmPieceVolume,
    setToneProofDroneVolume: toneProofRuntime.setToneProofDroneVolume,
    getToneProofDroneDiagnostics: toneProofRuntime.getToneProofDroneDiagnostics,
    getAtmosphereAudioContext: () => toneGlobal.getContext().rawContext as EventTarget & { state: unknown },
    startGenerativeFmPiece: generativeRuntime.startGenerativeFmPiece,
    startToneProofDrone: toneProofRuntime.startToneProofDrone,
  }
}

function getStationArtist(station: AtmosphereStation) {
  return station.artist || station.attribution?.artist || "MassageLab"
}
