"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { MovingBackground } from "@/components/moving-background"
import { useSettings } from "@/components/providers/settings-provider"
import { useMusic } from "@/components/providers/music-provider"
import {
  backgroundPaletteRegistry,
  backgroundPreferenceNormalizationOptions,
} from "@/components/backgrounds/backgroundPaletteRegistry"
import { useBackgroundCommerce } from "@/components/backgrounds/BackgroundCommerceProvider"
import {
  canUseBackgroundId,
  mergeBackgroundAccessOwnership,
  resolveAuthoritativeBackgroundOwnership,
  type BackgroundAccessSnapshot,
} from "@/components/backgrounds/backgroundRegistry"
import {
  clampActiveTimerMs,
  CHIMER_STORAGE_KEY,
  DEFAULT_CHIMER_SETTINGS,
  formatCurrentTimeParts,
  formatDurationParts,
  getActiveTimerAlertSchedule,
  getIntervalMs,
  getTotalTimerMs,
  normalizeInteger,
  sanitizeChimerSettings,
  sanitizeChimerSettingsForEntitlements,
  sanitizeChimerSettingsPatchForEntitlements,
  sanitizeChimerVisualCommitForEntitlements,
} from "@/lib/chimer-timer"
import {
  areChimerPreferenceSnapshotsEqual,
  canSyncAccountPreferencesFromSession,
  createChimerPreferenceSyncRouter,
  createSerializedChimerPreferenceWriter,
  createChimerPreferenceSyncRequest,
  createChimerPreferenceSyncRetry,
  doesChimerPreferenceWriteResponseMatch,
  resolveChimerPreferenceSeedResult,
  resolveChimerPreferenceSyncRequest,
} from "@/lib/account-preferences"
import { resolveBackgroundVisualCommitScope } from "@/lib/background-visual-draft"
import {
  LEGACY_CHIMER_GLOBAL_COLOR_STORAGE_KEY,
  LEGACY_CHIMER_GLOBAL_PALETTE_STORAGE_KEY,
  prepareChimerBackgroundPreferenceMigration,
} from "@/lib/background-palette"
import { fetchWithTimeout } from "@/lib/client-fetch"
import { sanitizeAccessibleChimerSettings } from "@/lib/chimer-accessible-settings"
import { FEATURE_KEYS } from "@/lib/membership"
import { triggerHapticFeedback } from "@/lib/haptics"
import { isBackgroundId } from "@/lib/background-options"
import {
  resolveMusicVisualizerBackground,
  sanitizeMusicVisualizerReturnTo,
} from "@/lib/music-visualizer"
import {
  resolveImmersiveDisplayContext,
  shouldRequestImmersiveWakeLock,
} from "@/lib/immersive-display"
import {
  CHIMER_BACKGROUND_SETUP_STEP_INDEX,
  SetTimer,
  type ChimerSettings,
  type ChimerSetupStartOptions,
} from "./set-timer"
import { RunningTimer, type ImmersiveDisplayMode } from "./running-timer"

type TimerStatus = "idle" | "running" | "paused" | "complete" | "clock"
type AccountSyncStatus = "checking" | "local" | "synced" | "conflict"
type BackgroundPreferenceSyncState = {
  status: "local" | "pending" | "stale" | "synced"
  requestBody: string | null
  requestId: number
}
const SOUND_ALERT_TYPES = new Set<ChimerSettings["alertType"]>(["chime", "both", "chime-haptic", "all"])
const FLASH_ALERT_TYPES = new Set<ChimerSettings["alertType"]>(["flash", "both", "flash-haptic", "all"])
const HAPTIC_ALERT_TYPES = new Set<ChimerSettings["alertType"]>(["haptic", "chime-haptic", "flash-haptic", "all"])
const EMPTY_BACKGROUND_ACCESS: BackgroundAccessSnapshot = {
  featureKeys: [],
  ownedBackgroundIds: [],
}

type CurrentTimeParts = {
  time: string
  meridiem: string
}

type ChimerWakeLockSentinel = EventTarget & {
  released?: boolean
  onrelease: ((this: ChimerWakeLockSentinel, event: Event) => unknown) | null
  release: () => Promise<void>
}

type WakeLockCapableNavigator = Navigator & {
  wakeLock?: {
    request: (type: "screen") => Promise<ChimerWakeLockSentinel>
  }
}

interface TimerState {
  status: TimerStatus
  totalMs: number
  remainingMs: number
  endsAtMs: number | null
  intervalMs: number | null
  nextAlertAtMs: number | null
  msUntilNextAlert: number | null
}

const idleTimerState: TimerState = {
  status: "idle",
  totalMs: 0,
  remainingMs: 0,
  endsAtMs: null,
  intervalMs: null,
  nextAlertAtMs: null,
  msUntilNextAlert: null,
}

function createClockTimerState(): TimerState {
  return {
    status: "clock",
    totalMs: 0,
    remainingMs: 0,
    endsAtMs: null,
    intervalMs: null,
    nextAlertAtMs: null,
    msUntilNextAlert: null,
  }
}

function hasSavedPreference(value: unknown) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0)
}

function areChimerSettingsEqual(left: ChimerSettings, right: ChimerSettings) {
  return areChimerPreferenceSnapshotsEqual(left, right, {
    backgroundPreferenceOptions: backgroundPreferenceNormalizationOptions,
  })
}

export default function ChimerPage() {
  const pathname = usePathname() ?? ""
  const router = useRouter()
  const searchParams = useSearchParams()
  const { settings: appSettings } = useSettings()
  const {
    state: backgroundCommerceState,
    reconcileOwnedBackgroundIds: reconcileBackgroundCommerceOwnership,
  } = useBackgroundCommerce()
  const {
    visualizer,
    selectVisualizerBackground,
    setVisualizerShowClock,
    setCurrentVisualizerBackgroundAsDefault,
    restoreVisualizerAccountDefault,
    retryVisualizerAccountSync,
  } = useMusic()
  const immersiveContext = resolveImmersiveDisplayContext({
    pathname,
    source: searchParams.get("source"),
  })
  const startsInClockMode = immersiveContext !== "chimer"
  const returnToParam = searchParams.get("returnTo")
  const safeReturnTo = useMemo(
    () => sanitizeMusicVisualizerReturnTo(returnToParam),
    [returnToParam],
  )
  // Checkout return recovery uses panel=background to reopen the originating
  // Background picker instead of the normal immersive or setup default.
  const requestedInitialPanel = (
    searchParams.get("panel") === "background" ? "background" : null
  )
  const [settings, setSettings] = useState<ChimerSettings>(DEFAULT_CHIMER_SETTINGS as ChimerSettings)
  const [timerState, setTimerState] = useState<TimerState>(() => (
    startsInClockMode ? createClockTimerState() : idleTimerState
  ))
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [currentTime, setCurrentTime] = useState<CurrentTimeParts>({ time: "", meridiem: "" })
  const [showTimeModal, setShowTimeModal] = useState(false)
  const [selectedTimeUnit, setSelectedTimeUnit] = useState<"hours" | "minutes">("minutes")
  const [fontSize, setFontSize] = useState(20)
  const [error, setError] = useState<string | null>(null)
  const [isAlerting, setIsAlerting] = useState(false)
  const [runWithoutAnimatedBackground, setRunWithoutAnimatedBackground] = useState(false)
  const [hasLoadedSettings, setHasLoadedSettings] = useState(false)
  const [canSync, setCanSync] = useState(false)
  const [accountSyncStatus, setAccountSyncStatus] = useState<AccountSyncStatus>("checking")
  const [accountSettings, setAccountSettings] = useState<ChimerSettings | null>(null)
  const [hasEditedLocalConflictSettings, setHasEditedLocalConflictSettings] = useState(false)
  const [isResolvingSync, setIsResolvingSync] = useState(false)
  const [featureKeys, setFeatureKeys] = useState<string[]>([])
  const [permanentlyOwnedBackgroundIds, setPermanentlyOwnedBackgroundIds] = useState<string[]>([])
  const [transientOwnedBackgroundIds, setTransientOwnedBackgroundIds] = useState<string[]>([])
  const [backgroundPreferenceSync, setBackgroundPreferenceSync] = useState<BackgroundPreferenceSyncState>({
    status: "local",
    requestBody: null,
    requestId: 0,
  })
  const [visualDraftPropertyOverrides, setVisualDraftPropertyOverrides] =
    useState<Partial<ChimerSettings> | null>(null)
  const [wakeLockMessage, setWakeLockMessage] = useState<string | null>(null)
  const commerceOwnedBackgroundIds = backgroundCommerceState.snapshot?.ownedBackgroundIds
  const backgroundAccess = useMemo<BackgroundAccessSnapshot>(
    () => mergeBackgroundAccessOwnership({
      featureKeys,
      // The account-preference response bridges initial hydration. Once the
      // commerce provider has a snapshot, it is authoritative for revocation
      // as well as acquisition and must replace the older ownership list.
      ownedBackgroundIds: resolveAuthoritativeBackgroundOwnership(
        permanentlyOwnedBackgroundIds,
        commerceOwnedBackgroundIds,
      ),
    }, transientOwnedBackgroundIds),
    [
      commerceOwnedBackgroundIds,
      featureKeys,
      permanentlyOwnedBackgroundIds,
      transientOwnedBackgroundIds,
    ],
  )
  const canUseCustomColors = featureKeys.includes(FEATURE_KEYS.chimerCustomColors)
  const hasAccountPreferenceAccess = accountSyncStatus === "synced" || accountSyncStatus === "conflict"
  const canUseAccountColorControls = canUseCustomColors || hasAccountPreferenceAccess

  const timerInterval = useRef<ReturnType<typeof setInterval> | null>(null)
  const alertTimeout = useRef<number | null>(null)
  const timerStateRef = useRef(timerState)
  const settingsRef = useRef(settings)
  const backgroundAccessRef = useRef(backgroundAccess)
  const audioContextRef = useRef<AudioContext | null>(null)
  const wakeLockRef = useRef<ChimerWakeLockSentinel | null>(null)
  const wakeLockRequestRef = useRef<Promise<void> | null>(null)
  const shouldKeepWakeLockRef = useRef(false)
  const skipNextAutomaticAccountSyncBodyRef = useRef<string | null>(null)
  const backgroundPreferenceRequestIdRef = useRef(0)
  const [accountPreferenceWriter] = useState(() =>
    createSerializedChimerPreferenceWriter({
      send: async (request) => {
        const response = await fetchWithTimeout("/api/account/preferences", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: request.requestBody,
        })
        if (!response.ok) {
          return false
        }
        const responseBody = await response.json().catch(() => null)
        const reconciledWrite = resolveChimerPreferenceSeedResult(responseBody, {
          backgroundPreferenceOptions: backgroundPreferenceNormalizationOptions,
        })
        if (!reconciledWrite) {
          return false
        }
        // Every successful PUT re-checks membership and ownership. Adopt that
        // access before resolving the write so an ordinary preference save
        // cannot leave a revoked background usable until another refresh.
        setFeatureKeys(reconciledWrite.featureKeys)
        setPermanentlyOwnedBackgroundIds(reconciledWrite.ownedBackgroundIds)
        void reconcileBackgroundCommerceOwnership(reconciledWrite.ownedBackgroundIds)
        return doesChimerPreferenceWriteResponseMatch(
          request.requestBody,
          responseBody,
          { backgroundPreferenceOptions: backgroundPreferenceNormalizationOptions },
        )
      },
      onComplete: (request, succeeded) => {
        setBackgroundPreferenceSync((currentRequest) => (
          resolveChimerPreferenceSyncRequest(
            currentRequest,
            request,
            succeeded,
          ) as BackgroundPreferenceSyncState
        ))
      },
    }),
  )
  const [accountPreferenceSyncRouter] = useState(() =>
    createChimerPreferenceSyncRouter(accountPreferenceWriter),
  )

  const totalDurationMs = useMemo(
    () => getTotalTimerMs(settings.hours, settings.minutes),
    [settings.hours, settings.minutes],
  )
  const shouldKeepScreenAwake = shouldRequestImmersiveWakeLock({
    context: immersiveContext,
    timerStatus: timerState.status,
    keepScreenAwake: settings.keepTimerScreenAwake,
  })

  useEffect(() => {
    timerStateRef.current = timerState
  }, [timerState])

  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

  useEffect(() => {
    backgroundAccessRef.current = backgroundAccess
  }, [backgroundAccess])

  useEffect(() => {
    // A successful commerce snapshot supersedes the in-session ownership proof
    // carried by an acquisition response, including later refund/revocation.
    setTransientOwnedBackgroundIds([])
  }, [commerceOwnedBackgroundIds])

  useEffect(() => {
    let isMounted = true

    const loadLocalSettings = () => {
      const prepared = prepareChimerBackgroundPreferenceMigration({
        rawChimerSettings: window.localStorage.getItem(CHIMER_STORAGE_KEY),
        rawLegacyGlobalColors: window.localStorage.getItem(LEGACY_CHIMER_GLOBAL_COLOR_STORAGE_KEY),
        rawLegacySavedPalettes: window.localStorage.getItem(LEGACY_CHIMER_GLOBAL_PALETTE_STORAGE_KEY),
        sanitizeSettings: (value) => sanitizeChimerSettings(value, {
          backgroundPreferenceOptions: backgroundPreferenceNormalizationOptions,
        }),
      })
      const nextSettings = prepared.settings as ChimerSettings
      // Account hydration continues asynchronously, so its later entitlement
      // decision must read the same local snapshot the setup UI is editing.
      settingsRef.current = nextSettings
      setSettings(nextSettings)
      try {
        window.localStorage.setItem(CHIMER_STORAGE_KEY, JSON.stringify(nextSettings))
        // Legacy keys are deleted only after the nested v1 record commits.
        for (const legacyKey of prepared.legacyKeysToRemove) {
          window.localStorage.removeItem(legacyKey)
        }
      } catch {
        // Keep the legacy records intact so a later successful load can retry.
      }
      setHasLoadedSettings(true)
      return nextSettings
    }

    async function syncAccountSettings() {
      try {
        const sessionResponse = await fetchWithTimeout("/api/auth/session")

        if (!isMounted) {
          return
        }

        const session = sessionResponse.ok ? await sessionResponse.json().catch(() => null) : null

        if (!isMounted) {
          return
        }

        if (!canSyncAccountPreferencesFromSession(session)) {
          const localFreeSettings = sanitizeChimerSettingsForEntitlements(settingsRef.current, EMPTY_BACKGROUND_ACCESS, {
            backgroundPreferenceOptions: backgroundPreferenceNormalizationOptions,
          }) as ChimerSettings
          settingsRef.current = localFreeSettings
          setSettings(localFreeSettings)
          window.localStorage.setItem(CHIMER_STORAGE_KEY, JSON.stringify(localFreeSettings))
          setFeatureKeys([])
          setPermanentlyOwnedBackgroundIds([])
          setCanSync(false)
          setAccountSyncStatus("local")
          return
        }

        const response = await fetchWithTimeout("/api/account/preferences")

        if (!isMounted) {
          return
        }

        if (!response.ok) {
          setFeatureKeys([])
          setPermanentlyOwnedBackgroundIds([])
          setCanSync(false)
          setAccountSyncStatus("local")
          return
        }

        const preferences = await response.json()
        if (preferences.accessAuthoritative !== true) {
          // Access lookup failures are non-authoritative. Keep the last local
          // snapshot intact while empty access keeps rendering fail-closed.
          setFeatureKeys([])
          setPermanentlyOwnedBackgroundIds([])
          setCanSync(false)
          setAccountSyncStatus("local")
          return
        }
        const nextFeatureKeys = Array.isArray(preferences.features)
          ? preferences.features.filter((feature: unknown) => typeof feature === "string")
          : []
        const nextOwnedBackgroundIds = Array.isArray(preferences.ownedBackgroundIds)
          ? [...new Set(preferences.ownedBackgroundIds.filter(
              (backgroundId: unknown): backgroundId is string => typeof backgroundId === "string",
            ) as string[])]
          : []
        setFeatureKeys(nextFeatureKeys)
        setPermanentlyOwnedBackgroundIds(nextOwnedBackgroundIds)

        if (!isMounted) {
          return
        }

        if (hasSavedPreference(preferences.chimerSettings)) {
          const nextSettings = sanitizeAccessibleChimerSettings(
            preferences.chimerSettings,
            {
              featureKeys: nextFeatureKeys,
              ownedBackgroundIds: nextOwnedBackgroundIds,
            },
          ) as ChimerSettings
          if (areChimerSettingsEqual(settingsRef.current, nextSettings)) {
            settingsRef.current = nextSettings
            setSettings(nextSettings)
            window.localStorage.setItem(CHIMER_STORAGE_KEY, JSON.stringify(nextSettings))
            setCanSync(true)
            setHasEditedLocalConflictSettings(false)
            setAccountSyncStatus("synced")
            return
          }

          setAccountSettings(nextSettings)
          setHasEditedLocalConflictSettings(false)
          setCanSync(false)
          setAccountSyncStatus("conflict")
          return
        }

        const seedSettings = sanitizeAccessibleChimerSettings(
          settingsRef.current,
          {
            featureKeys: nextFeatureKeys,
            ownedBackgroundIds: nextOwnedBackgroundIds,
          },
        ) as ChimerSettings
        // Apply the authoritative GET access boundary before the seed write.
        // This also gives edits made while the request is in flight a safe base.
        settingsRef.current = seedSettings
        setSettings(seedSettings)
        window.localStorage.setItem(CHIMER_STORAGE_KEY, JSON.stringify(seedSettings))
        const seedResponse = await fetchWithTimeout("/api/account/preferences", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ chimerSettings: seedSettings }),
        })
        const seedResponseBody = seedResponse.ok
          ? await seedResponse.json().catch(() => null)
          : null
        const reconciledSeed = seedResponse.ok
          ? resolveChimerPreferenceSeedResult(seedResponseBody, {
              backgroundPreferenceOptions: backgroundPreferenceNormalizationOptions,
            }) as {
              settings: ChimerSettings
              featureKeys: string[]
              ownedBackgroundIds: string[]
            } | null
          : null

        if (!isMounted) {
          return
        }

        if (!reconciledSeed) {
          setCanSync(false)
          setAccountSyncStatus("local")
          return
        }

        const reconciledSeedSettings = reconciledSeed.settings
        setFeatureKeys(reconciledSeed.featureKeys)
        setPermanentlyOwnedBackgroundIds(reconciledSeed.ownedBackgroundIds)
        void reconcileBackgroundCommerceOwnership(reconciledSeed.ownedBackgroundIds)
        const settingsChangedWhileSeeding = !areChimerSettingsEqual(
          settingsRef.current,
          seedSettings,
        )
        const serverChangedSeed = !areChimerSettingsEqual(
          reconciledSeedSettings,
          seedSettings,
        )
        if (settingsChangedWhileSeeding && serverChangedSeed) {
          setAccountSettings(reconciledSeedSettings)
          setHasEditedLocalConflictSettings(true)
          setCanSync(false)
          setAccountSyncStatus("conflict")
          return
        }
        if (settingsChangedWhileSeeding) {
          // Access may have changed while the seed PUT was in flight. Preserve
          // newer edits only after applying the access boundary returned by
          // that PUT, then let the serialized writer send any safe remainder.
          const accessibleInFlightSettings = sanitizeAccessibleChimerSettings(
            settingsRef.current,
            {
              featureKeys: reconciledSeed.featureKeys,
              ownedBackgroundIds: reconciledSeed.ownedBackgroundIds,
            },
          ) as ChimerSettings
          settingsRef.current = accessibleInFlightSettings
          setSettings(accessibleInFlightSettings)
          window.localStorage.setItem(
            CHIMER_STORAGE_KEY,
            JSON.stringify(accessibleInFlightSettings),
          )
          if (areChimerSettingsEqual(accessibleInFlightSettings, reconciledSeedSettings)) {
            skipNextAutomaticAccountSyncBodyRef.current = createChimerPreferenceSyncRequest(
              accessibleInFlightSettings,
              { backgroundPreferenceOptions: backgroundPreferenceNormalizationOptions },
            ).requestBody
          }
          setCanSync(true)
          setAccountSyncStatus("synced")
          return
        }

        // The PUT re-checks access after the preceding GET. Adopt its returned
        // snapshot before enabling sync so revoked tuning cannot be requeued.
        settingsRef.current = reconciledSeedSettings
        setSettings(reconciledSeedSettings)
        window.localStorage.setItem(CHIMER_STORAGE_KEY, JSON.stringify(reconciledSeedSettings))
        skipNextAutomaticAccountSyncBodyRef.current = createChimerPreferenceSyncRequest(
          reconciledSeedSettings,
          { backgroundPreferenceOptions: backgroundPreferenceNormalizationOptions },
        ).requestBody
        setCanSync(true)
        setAccountSyncStatus("synced")
      } catch {
        if (!isMounted) {
          return
        }
        setFeatureKeys([])
        setPermanentlyOwnedBackgroundIds([])
        setCanSync(false)
        setAccountSyncStatus("local")
      }
    }

    loadLocalSettings()
    void syncAccountSettings()

    return () => {
      isMounted = false
    }
  }, [reconcileBackgroundCommerceOwnership])

  useEffect(() => {
    if (hasLoadedSettings) {
      window.localStorage.setItem(CHIMER_STORAGE_KEY, JSON.stringify(settings))

      if (canSync && accountSyncStatus === "synced") {
        const requestId = backgroundPreferenceRequestIdRef.current + 1
        const request = createChimerPreferenceSyncRequest(settings, {
          backgroundPreferenceOptions: backgroundPreferenceNormalizationOptions,
          requestId,
        }) as BackgroundPreferenceSyncState
        if (skipNextAutomaticAccountSyncBodyRef.current === request.requestBody) {
          skipNextAutomaticAccountSyncBodyRef.current = null
          return
        }
        backgroundPreferenceRequestIdRef.current = requestId
        setBackgroundPreferenceSync(request)
        accountPreferenceSyncRouter.automatic(request)
      }
    }
  }, [
    accountPreferenceSyncRouter,
    accountSyncStatus,
    canSync,
    hasLoadedSettings,
    settings,
  ])

  useEffect(() => {
    const updateTime = () => {
      setCurrentTime(formatCurrentTimeParts(new Date(), settingsRef.current))
    }

    updateTime()
    const interval = setInterval(updateTime, 1000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(Boolean(document.fullscreenElement))
    document.addEventListener("fullscreenchange", syncFullscreen)
    return () => document.removeEventListener("fullscreenchange", syncFullscreen)
  }, [])

  useEffect(() => {
    document.body.classList.toggle("chimer-running", timerState.status !== "idle")
    return () => document.body.classList.remove("chimer-running")
  }, [timerState.status])

  useEffect(() => {
    document.body.classList.toggle("chimer-alerting", isAlerting)
    return () => document.body.classList.remove("chimer-alerting")
  }, [isAlerting])

  const releaseWakeLock = useCallback(() => {
    const sentinel = wakeLockRef.current
    wakeLockRef.current = null

    if (sentinel && !sentinel.released) {
      void sentinel.release().catch(() => undefined)
    }
  }, [])

  const requestWakeLock = useCallback(() => {
    if (wakeLockRef.current || wakeLockRequestRef.current || document.visibilityState !== "visible") {
      return
    }

    const wakeLock = (navigator as WakeLockCapableNavigator).wakeLock
    if (!wakeLock?.request) {
      setWakeLockMessage("Screen wake lock is not supported by this browser.")
      return
    }

    const request = wakeLock.request("screen")
      .then((sentinel) => {
        if (!shouldKeepWakeLockRef.current || document.visibilityState !== "visible") {
          void sentinel.release().catch(() => undefined)
          return
        }

        setWakeLockMessage(null)
        sentinel.onrelease = () => {
          if (wakeLockRef.current === sentinel) {
            wakeLockRef.current = null
          }
        }
        wakeLockRef.current = sentinel
      })
      .catch(() => {
        setWakeLockMessage("Screen wake lock was denied. The display will continue normally.")
      })

    wakeLockRequestRef.current = request
    void request.finally(() => {
      if (wakeLockRequestRef.current === request) {
        wakeLockRequestRef.current = null
      }
    })
  }, [])

  useEffect(() => {
    shouldKeepWakeLockRef.current = shouldKeepScreenAwake

    if (shouldKeepScreenAwake) {
      requestWakeLock()
    } else {
      releaseWakeLock()
    }
  }, [releaseWakeLock, requestWakeLock, shouldKeepScreenAwake])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && shouldKeepWakeLockRef.current) {
        requestWakeLock()
        return
      }

      if (document.visibilityState !== "visible") {
        releaseWakeLock()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
      releaseWakeLock()
    }
  }, [releaseWakeLock, requestWakeLock])

  const clearTimerInterval = useCallback(() => {
    if (timerInterval.current) {
      clearInterval(timerInterval.current)
      timerInterval.current = null
    }
  }, [])

  const showFlashAlert = useCallback(() => {
    if (alertTimeout.current) {
      clearTimeout(alertTimeout.current)
    }

    setIsAlerting(true)
    alertTimeout.current = window.setTimeout(() => {
      setIsAlerting(false)
      alertTimeout.current = null
    }, 350)
  }, [])

  const getAudioContext = useCallback(() => {
    if (audioContextRef.current) {
      return audioContextRef.current
    }

    const AudioContextCtor =
      window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

    if (!AudioContextCtor) {
      return null
    }

    audioContextRef.current = new AudioContextCtor()
    return audioContextRef.current
  }, [])

  const unlockAudio = useCallback(async () => {
    const context = getAudioContext()
    if (!context) {
      return false
    }

    let timeoutId: number | undefined

    try {
      if (context.state !== "running") {
        await Promise.race([
          context.resume(),
          new Promise<void>((_, reject) => {
            timeoutId = window.setTimeout(() => reject(new Error("Audio unlock timed out")), 800)
          }),
        ])
      }
      return context.state === "running"
    } catch {
      return false
    } finally {
      if (timeoutId) {
        window.clearTimeout(timeoutId)
      }
    }
  }, [getAudioContext])

  const playChime = useCallback((volume: number = DEFAULT_CHIMER_SETTINGS.alertVolume) => {
    const context = audioContextRef.current
    if (!context || context.state !== "running") {
      if (timerStateRef.current.status !== "idle") {
        setError("Audio is not ready yet. Tap Test Alert or restart the timer.")
      }
      return
    }

    const now = context.currentTime
    const gain = context.createGain()
    const peakGain = Math.max(0.0001, Math.min(0.18, 0.2 * volume))
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(peakGain, now + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.9)
    gain.connect(context.destination)

    const firstTone = context.createOscillator()
    firstTone.type = "sine"
    firstTone.frequency.setValueAtTime(784, now)
    firstTone.connect(gain)
    firstTone.start(now)
    firstTone.stop(now + 0.32)

    const secondTone = context.createOscillator()
    secondTone.type = "sine"
    secondTone.frequency.setValueAtTime(1046.5, now + 0.28)
    secondTone.connect(gain)
    secondTone.start(now + 0.28)
    secondTone.stop(now + 0.9)
  }, [])

  const triggerAlert = useCallback(() => {
    const currentSettings = settingsRef.current
    const alertType = currentSettings.alertType

    if (SOUND_ALERT_TYPES.has(alertType)) {
      playChime(currentSettings.alertVolume)
    }

    if (FLASH_ALERT_TYPES.has(alertType)) {
      showFlashAlert()
    }

    if (HAPTIC_ALERT_TYPES.has(alertType)) {
      triggerHapticFeedback(appSettings.hapticFeedbackEnabled, currentSettings.hapticIntensityMs)
    }
  }, [appSettings.hapticFeedbackEnabled, playChime, showFlashAlert])

  const completeActiveTimer = useCallback((state: TimerState) => {
    clearTimerInterval()
    const completedState: TimerState = {
      ...state,
      status: "complete",
      remainingMs: 0,
      endsAtMs: null,
      nextAlertAtMs: null,
      msUntilNextAlert: null,
    }

    timerStateRef.current = completedState
    setTimerState(completedState)
    setRunWithoutAnimatedBackground(false)
    triggerAlert()
  }, [clearTimerInterval, triggerAlert])

  const tick = useCallback(() => {
    const state = timerStateRef.current
    if (state.status !== "running" || !state.endsAtMs) {
      return
    }

    const now = Date.now()
    const remainingMs = Math.max(0, state.endsAtMs - now)
    let nextAlertAtMs = state.nextAlertAtMs
    let shouldAlert = false

    if (state.intervalMs && nextAlertAtMs && remainingMs > 0 && now >= nextAlertAtMs) {
      shouldAlert = true
      while (nextAlertAtMs && now >= nextAlertAtMs) {
        nextAlertAtMs += state.intervalMs
      }
      if (nextAlertAtMs >= state.endsAtMs) {
        nextAlertAtMs = null
      }
    }

    if (remainingMs <= 0) {
      completeActiveTimer(state)
      return
    }

    const nextState = {
      ...state,
      remainingMs,
      nextAlertAtMs,
    }
    timerStateRef.current = nextState
    setTimerState(nextState)

    if (shouldAlert) {
      triggerAlert()
    }
  }, [completeActiveTimer, triggerAlert])

  const startTicking = useCallback(() => {
    clearTimerInterval()
    timerInterval.current = setInterval(tick, 250)
    window.setTimeout(tick, 0)
  }, [clearTimerInterval, tick])

  const updateSettings = (
    nextSettings: Partial<ChimerSettings>,
    accessOverride?: BackgroundAccessSnapshot,
  ) => {
    setError(null)
    if (nextSettings.movingBackgroundEnabled === true) {
      // An explicit picker activation also ends the current session's
      // temporary "run without animation" suppression.
      setRunWithoutAnimatedBackground(false)
    }
    if (accessOverride) {
      // This override is only short-lived proof of a newly completed
      // acquisition. Authoritative refresh and revocation still own lasting
      // access, so it must not become a general entitlement bypass.
      setTransientOwnedBackgroundIds((current) => [
        ...new Set([...current, ...accessOverride.ownedBackgroundIds]),
      ])
    }
    const nextSanitizedSettings = sanitizeChimerSettingsPatchForEntitlements(
      settingsRef.current,
      nextSettings,
      accessOverride ?? backgroundAccessRef.current,
      {
        canUseAccountColorControls,
        backgroundPreferenceOptions: backgroundPreferenceNormalizationOptions,
      },
    ) as ChimerSettings

    // Keep edits ahead of an in-flight account response; otherwise that
    // response could restore the pre-edit duration captured during mount.
    settingsRef.current = nextSanitizedSettings
    setSettings(nextSanitizedSettings)

    if (accountSyncStatus === "conflict" && accountSettings) {
      // Local divergence during a conflict suppresses the redundant sync notice.
      setHasEditedLocalConflictSettings(!areChimerSettingsEqual(nextSanitizedSettings, accountSettings))
    }
  }

  /**
   * Commits one complete sanitized Visual snapshot locally before starting
   * account sync. Setup callers may still supply only the nested preference.
   */
  const applyBackgroundVisualPreferences = (
    input: ChimerSettings["backgroundVisualPreferences"] | {
      visualBackgroundId: string
      sourceVisualBackgroundId?: string
      backgroundId?: string
      backgroundVisualPreferences: ChimerSettings["backgroundVisualPreferences"]
      properties: Partial<ChimerSettings>
      accessOverride?: BackgroundAccessSnapshot
      activateBackground?: boolean
    },
  ) => {
    const backgroundVisualPreferences = "backgroundVisualPreferences" in input
      ? input.backgroundVisualPreferences
      : input
    const visualBackgroundId = "visualBackgroundId" in input
      ? input.visualBackgroundId
      : settingsRef.current.backgroundId
    const scope = resolveBackgroundVisualCommitScope({
      canonicalBackgroundId: settingsRef.current.backgroundId,
      visualBackgroundId,
      sourceVisualBackgroundId: "sourceVisualBackgroundId" in input
        ? input.sourceVisualBackgroundId
        : visualBackgroundId,
      committedBackgroundId: "backgroundId" in input
        ? input.backgroundId
        : null,
    })
    const visualPropertyKeysByBackground = Object.fromEntries(
      scope.visualBackgroundIds.map((backgroundId) => [
        backgroundId,
        backgroundPaletteRegistry[backgroundId]?.visualPropertyKeys ?? [],
      ]),
    )
    const allowedPropertyKeys = new Set(
      Object.values(visualPropertyKeysByBackground).flat(),
    )
    const visualProperties = "properties" in input
      ? Object.fromEntries(
        Object.entries(input.properties).filter(([key]) => allowedPropertyKeys.has(key)),
      )
      : {}
    // Selection activation belongs to the same atomic commit, but is a
    // canonical setting rather than a renderer-owned Visual property.
    const activateBackground =
      "activateBackground" in input && input.activateBackground === true
    const properties = {
      ...visualProperties,
      ...(activateBackground
        ? { movingBackgroundEnabled: true }
        : {}),
    }
    if (activateBackground) {
      // Apply and background selection share the same session-level activation
      // semantics as a direct settings change.
      setRunWithoutAnimatedBackground(false)
    }
    const accessOverride = "accessOverride" in input ? input.accessOverride : undefined
    if (accessOverride) {
      // Retain the redemption proof through a failed commerce refresh. The
      // authoritative snapshot effect above still clears this bridge.
      setTransientOwnedBackgroundIds((current) => [
        ...new Set([...current, ...accessOverride.ownedBackgroundIds]),
      ])
    }
    const nextSettings = sanitizeChimerVisualCommitForEntitlements({
      currentSettings: settingsRef.current,
      candidateProperties: properties,
      canonicalBackgroundId: scope.canonicalBackgroundId,
      visualBackgroundIds: scope.visualBackgroundIds,
      visualPropertyKeysByBackground,
      backgroundVisualPreferences,
    }, accessOverride ?? backgroundAccessRef.current, {
      canUseAccountColorControls,
      backgroundPreferenceOptions: backgroundPreferenceNormalizationOptions,
    }) as ChimerSettings
    const requestId = backgroundPreferenceRequestIdRef.current + 1
    backgroundPreferenceRequestIdRef.current = requestId
    const request = createChimerPreferenceSyncRequest(nextSettings, {
      backgroundPreferenceOptions: backgroundPreferenceNormalizationOptions,
      requestId,
    }) as BackgroundPreferenceSyncState & { sanitizedSettings: ChimerSettings }
    const committedSettings = request.sanitizedSettings

    // Account hydration can finish before React commits this state update.
    // Keep every async reader on the exact locally applied snapshot immediately.
    settingsRef.current = committedSettings
    setSettings(committedSettings)
    setVisualDraftPropertyOverrides(null)
    window.localStorage.setItem(CHIMER_STORAGE_KEY, JSON.stringify(committedSettings))

    if (!canSync || accountSyncStatus !== "synced") {
      setBackgroundPreferenceSync({ status: "local", requestBody: null, requestId })
      return
    }

    skipNextAutomaticAccountSyncBodyRef.current = request.requestBody
    setBackgroundPreferenceSync(request)
    accountPreferenceSyncRouter.visualApply(request)
  }

  /** Retries the exact last locally applied payload after a stale cloud write. */
  const retryBackgroundVisualPreferenceSync = useCallback(() => {
    if (backgroundPreferenceSync.status !== "stale" || !backgroundPreferenceSync.requestBody) {
      return
    }
    const requestId = backgroundPreferenceRequestIdRef.current + 1
    backgroundPreferenceRequestIdRef.current = requestId
    const pending = createChimerPreferenceSyncRetry(
      backgroundPreferenceSync,
      requestId,
    ) as BackgroundPreferenceSyncState
    setBackgroundPreferenceSync(pending)
    accountPreferenceSyncRouter.visualRetry(pending)
  }, [accountPreferenceSyncRouter, backgroundPreferenceSync])

  const openTimeModal = (unit: "hours" | "minutes") => {
    setSelectedTimeUnit(unit)
    setShowTimeModal(true)
  }

  const handleTimeSelection = (value: number) => {
    updateSettings({ [selectedTimeUnit]: value })
    setShowTimeModal(false)
  }

  const testAlert = async () => {
    setError(null)
    const alertType = settingsRef.current.alertType
    if (SOUND_ALERT_TYPES.has(alertType) && !(await unlockAudio())) {
      setError("Audio could not be started by this browser. Check site sound permissions and try Test Alert again.")
      if (FLASH_ALERT_TYPES.has(alertType)) {
        showFlashAlert()
      }
      if (HAPTIC_ALERT_TYPES.has(alertType)) {
        triggerHapticFeedback(appSettings.hapticFeedbackEnabled, settingsRef.current.hapticIntensityMs)
      }
      return
    }
    triggerAlert()
  }

  const startTimer = async (options: ChimerSetupStartOptions = {}) => {
    const totalMs = getTotalTimerMs(settings.hours, settings.minutes)
    if (totalMs <= 0) {
      setError("Set a duration greater than zero.")
      return
    }
    setRunWithoutAnimatedBackground(Boolean(options.startWithoutAnimatedBackground))
    setError(null)

    const alertType = settings.alertType
    if (SOUND_ALERT_TYPES.has(alertType) && !(await unlockAudio())) {
      setError("Audio could not be started by this browser. The timer will run, but the chime may not sound.")
    } else {
      setError(null)
    }

    const now = Date.now()
    const intervalMs = options.skipIntervalCues ? null : getIntervalMs(settings, totalMs)
    const nextAlertAtMs = intervalMs && intervalMs < totalMs ? now + intervalMs : null
    const nextState: TimerState = {
      status: "running",
      totalMs,
      remainingMs: totalMs,
      endsAtMs: now + totalMs,
      intervalMs,
      nextAlertAtMs,
      msUntilNextAlert: null,
    }

    timerStateRef.current = nextState
    setTimerState(nextState)
    startTicking()
  }

  const startClock = () => {
    clearTimerInterval()
    setError(null)
    setIsAlerting(false)
    setRunWithoutAnimatedBackground(false)

    const clockState = createClockTimerState()

    timerStateRef.current = clockState
    setTimerState(clockState)
  }

  const useDeviceSettingsForAccount = async () => {
    setIsResolvingSync(true)
    setError(null)
    const submittedSettings = settingsRef.current

    try {
      const response = await fetchWithTimeout("/api/account/preferences", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chimerSettings: submittedSettings }),
      })
      const responseBody = response.ok
        ? await response.json().catch(() => null)
        : null
      const reconciledWrite = response.ok
        ? resolveChimerPreferenceSeedResult(responseBody, {
            backgroundPreferenceOptions: backgroundPreferenceNormalizationOptions,
          }) as {
            settings: ChimerSettings
            featureKeys: string[]
            ownedBackgroundIds: string[]
          } | null
        : null

      if (!reconciledWrite) {
        setError("Could not sync this device's Chimer settings. Try again after signing in.")
        return
      }

      setFeatureKeys(reconciledWrite.featureKeys)
      setPermanentlyOwnedBackgroundIds(reconciledWrite.ownedBackgroundIds)
      void reconcileBackgroundCommerceOwnership(reconciledWrite.ownedBackgroundIds)
      const settingsChangedWhileResolving = !areChimerSettingsEqual(
        settingsRef.current,
        submittedSettings,
      )
      const accessibleCurrentSettings = settingsChangedWhileResolving
        ? sanitizeAccessibleChimerSettings(settingsRef.current, {
            featureKeys: reconciledWrite.featureKeys,
            ownedBackgroundIds: reconciledWrite.ownedBackgroundIds,
          }) as ChimerSettings
        : reconciledWrite.settings

      settingsRef.current = accessibleCurrentSettings
      setSettings(accessibleCurrentSettings)
      window.localStorage.setItem(
        CHIMER_STORAGE_KEY,
        JSON.stringify(accessibleCurrentSettings),
      )
      if (
        settingsChangedWhileResolving
        && !areChimerSettingsEqual(accessibleCurrentSettings, reconciledWrite.settings)
      ) {
        setAccountSettings(reconciledWrite.settings)
        setHasEditedLocalConflictSettings(true)
        setCanSync(false)
        setAccountSyncStatus("conflict")
        return
      }

      skipNextAutomaticAccountSyncBodyRef.current = createChimerPreferenceSyncRequest(
        reconciledWrite.settings,
        { backgroundPreferenceOptions: backgroundPreferenceNormalizationOptions },
      ).requestBody
      setAccountSettings(null)
      setCanSync(true)
      setHasEditedLocalConflictSettings(false)
      setAccountSyncStatus("synced")
    } catch {
      setError("Could not sync this device's Chimer settings. Try again after signing in.")
    } finally {
      setIsResolvingSync(false)
    }
  }

  const useSavedAccountSettings = () => {
    if (!accountSettings) {
      return
    }

    setError(null)
    setSettings(accountSettings)
    window.localStorage.setItem(CHIMER_STORAGE_KEY, JSON.stringify(accountSettings))
    setAccountSettings(null)
    setCanSync(true)
    setHasEditedLocalConflictSettings(false)
    setAccountSyncStatus("synced")
  }

  const endTimer = () => {
    clearTimerInterval()
    if (alertTimeout.current) {
      clearTimeout(alertTimeout.current)
      alertTimeout.current = null
    }
    setError(null)
    setIsAlerting(false)
    setRunWithoutAnimatedBackground(false)
    timerStateRef.current = idleTimerState
    setTimerState(idleTimerState)
    setIsFullscreen(false)

    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => undefined)
    }
  }

  const togglePause = useCallback(() => {
    const state = timerStateRef.current

    if (state.status === "running" && state.endsAtMs) {
      const now = Date.now()
      const pausedState: TimerState = {
        ...state,
        status: "paused",
        remainingMs: Math.max(0, state.endsAtMs - now),
        endsAtMs: null,
        msUntilNextAlert: state.nextAlertAtMs ? Math.max(0, state.nextAlertAtMs - now) : null,
      }
      clearTimerInterval()
      timerStateRef.current = pausedState
      setTimerState(pausedState)
      return
    }

    if (state.status === "paused") {
      const now = Date.now()
      const resumedState: TimerState = {
        ...state,
        status: "running",
        endsAtMs: now + state.remainingMs,
        nextAlertAtMs: state.msUntilNextAlert ? now + state.msUntilNextAlert : null,
        msUntilNextAlert: null,
      }
      timerStateRef.current = resumedState
      setTimerState(resumedState)
      startTicking()
    }
  }, [clearTimerInterval, startTicking])

  const getCurrentActiveRemainingMs = (state: TimerState, now: number) => (
    state.status === "running" && state.endsAtMs ? Math.max(0, state.endsAtMs - now) : state.remainingMs
  )

  const applyActiveRemainingMs = useCallback((nextRemainingMs: number, now = Date.now()) => {
    const state = timerStateRef.current
    if (state.status !== "running" && state.status !== "paused") {
      return
    }

    const remainingMs = clampActiveTimerMs(nextRemainingMs)
    if (remainingMs <= 0) {
      completeActiveTimer(state)
      return
    }

    const endsAtMs = state.status === "running" ? now + remainingMs : null
    const fallbackSchedule = getActiveTimerAlertSchedule({
      status: state.status,
      now,
      remainingMs,
      intervalMs: state.intervalMs,
    })
    const nextAlertAtMs = state.status === "running" && state.nextAlertAtMs && state.nextAlertAtMs > now && state.nextAlertAtMs < endsAtMs!
      ? state.nextAlertAtMs
      : fallbackSchedule.nextAlertAtMs
    const msUntilNextAlert = state.status === "paused" && state.msUntilNextAlert && state.msUntilNextAlert < remainingMs
      ? state.msUntilNextAlert
      : fallbackSchedule.msUntilNextAlert
    const nextState: TimerState = {
      ...state,
      totalMs: Math.max(state.totalMs, remainingMs),
      remainingMs,
      endsAtMs,
      nextAlertAtMs,
      msUntilNextAlert,
    }

    timerStateRef.current = nextState
    setTimerState(nextState)
  }, [completeActiveTimer])

  const adjustActiveRemainingMinutes = useCallback((deltaMinutes: number) => {
    const state = timerStateRef.current
    if (state.status !== "running" && state.status !== "paused") {
      return
    }

    const now = Date.now()
    const currentRemainingMs = getCurrentActiveRemainingMs(state, now)
    applyActiveRemainingMs(currentRemainingMs + deltaMinutes * 60 * 1000, now)
  }, [applyActiveRemainingMs])

  const setActiveRemainingDuration = useCallback((hours: number, minutes: number) => {
    applyActiveRemainingMs(getTotalTimerMs(hours, minutes))
  }, [applyActiveRemainingMs])

  const setActiveIntervalMinutes = useCallback((minutes: number) => {
    const state = timerStateRef.current
    if (state.status !== "running" && state.status !== "paused") {
      return
    }

    const now = Date.now()
    const remainingMs = clampActiveTimerMs(getCurrentActiveRemainingMs(state, now))
    const intervalMinutes = normalizeInteger(
      minutes,
      state.intervalMs ? Math.max(1, Math.round(state.intervalMs / 60_000)) : settingsRef.current.customInterval,
      1,
      240,
    )
    const intervalMs = intervalMinutes * 60 * 1000
    const schedule = getActiveTimerAlertSchedule({
      status: state.status,
      now,
      remainingMs,
      intervalMs,
    })
    const nextState: TimerState = {
      ...state,
      remainingMs,
      endsAtMs: state.status === "running" ? now + remainingMs : null,
      intervalMs,
      nextAlertAtMs: schedule.nextAlertAtMs,
      msUntilNextAlert: schedule.msUntilNextAlert,
    }

    timerStateRef.current = nextState
    setTimerState(nextState)
  }, [])

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => setError("Fullscreen is not available in this browser."))
    } else {
      document.exitFullscreen().catch(() => undefined)
    }
  }

  useEffect(() => {
    return () => {
      clearTimerInterval()
      if (alertTimeout.current) {
        clearTimeout(alertTimeout.current)
      }
      audioContextRef.current?.close().catch(() => undefined)
    }
  }, [clearTimerInterval])

  const activeTimeDisplay = formatDurationParts(timerState.remainingMs)
  const timeDisplay = formatDurationParts(timerState.remainingMs, { showTimerSeconds: settings.showTimerSeconds })
  const isTimerActive = timerState.status !== "idle"
  const backgroundCategory = startsInClockMode ? "clock" : "chimer"
  const musicSelectionHydrated =
    visualizer.storageStatus !== "loading"
    && visualizer.accountStatus !== "loading"
    && accountSyncStatus !== "checking"
  const resolvedMusicBackground = musicSelectionHydrated
    ? resolveMusicVisualizerBackground({
      deviceBackgroundId: visualizer.backgroundId,
      accountDefaultBackgroundId: visualizer.accountDefaultBackgroundId,
      canUseBackground: (id: string) => isBackgroundId(id) && canUseBackgroundId(id, backgroundAccess, "music"),
    })
    : { backgroundId: null, source: "none", unavailableSavedId: null }
  const selectedMusicBackgroundId = resolvedMusicBackground.backgroundId
  const unavailableBackgroundMessage = musicSelectionHydrated && resolvedMusicBackground.unavailableSavedId
    ? "Your saved Music background is not available with the current access. Choose an available Music background."
    : null
  const initialMusicPanel = requestedInitialPanel
    ?? (musicSelectionHydrated && selectedMusicBackgroundId === null ? "background" : null)
  const immersiveMode: ImmersiveDisplayMode = immersiveContext === "musicVisualizer"
    ? {
      context: "musicVisualizer",
      backgroundCategory: "music",
      selectedBackgroundId: selectedMusicBackgroundId,
      showClock: visualizer.showClock,
      canToggleClock: true,
      initialPanel: initialMusicPanel,
      unavailableBackgroundMessage,
      storageStatus: visualizer.storageStatus,
      storageError: visualizer.storageError,
      wakeLockMessage,
      onShowClockChange: setVisualizerShowClock,
      onBackgroundChange: selectVisualizerBackground,
      onClose: () => router.replace(safeReturnTo),
      musicDefaultActions: {
        signedIn: visualizer.signedIn,
        currentIsDefault: Boolean(
          selectedMusicBackgroundId
          && selectedMusicBackgroundId === visualizer.accountDefaultBackgroundId,
        ),
        accountStatus: visualizer.accountStatus,
        accountError: visualizer.accountError,
        onSetDefault: setCurrentVisualizerBackgroundAsDefault,
        onRestoreDefault: restoreVisualizerAccountDefault,
        onRetry: retryVisualizerAccountSync,
      },
    }
    : immersiveContext === "clock"
      ? {
        context: "clock",
        backgroundCategory: "clock",
        selectedBackgroundId: settings.backgroundId,
        showClock: settings.showClockDisplay,
        canToggleClock: true,
        initialPanel: requestedInitialPanel,
        unavailableBackgroundMessage: null,
        storageStatus: "available",
        storageError: null,
        wakeLockMessage,
        onShowClockChange: (showClock) => updateSettings({ showClockDisplay: showClock }),
        onBackgroundChange: (backgroundId, accessOverride) => updateSettings({
          movingBackgroundEnabled: true,
          backgroundId: backgroundId as ChimerSettings["backgroundId"],
        }, accessOverride),
        onClose: endTimer,
      }
      : {
        context: "chimer",
        backgroundCategory: "chimer",
        selectedBackgroundId: settings.backgroundId,
        showClock: true,
        canToggleClock: false,
        initialPanel: requestedInitialPanel,
        unavailableBackgroundMessage: null,
        storageStatus: "available",
        storageError: null,
        wakeLockMessage,
        onBackgroundChange: (backgroundId) => updateSettings({
          movingBackgroundEnabled: true,
          backgroundId: backgroundId as ChimerSettings["backgroundId"],
        }),
        onClose: endTimer,
      }
  return (
    <div className="relative min-h-full px-4 py-[7px]">
      {!isTimerActive && (
        <>
          <MovingBackground
            className="pointer-events-none fixed inset-0 z-0 h-[100dvh] w-screen"
            testId="chimer-setup-moving-background"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 z-[1] bg-background/80"
          />
        </>
      )}
      <div className="relative z-10 mx-auto max-w-5xl">
        {!isTimerActive ? (
          <SetTimer
            settings={settings}
            totalDurationMs={totalDurationMs}
            error={error}
            syncStatus={accountSyncStatus}
            suppressSyncNotice={hasEditedLocalConflictSettings}
            isResolvingSync={isResolvingSync}
            backgroundAccess={backgroundAccess}
            backgroundCategory={backgroundCategory}
            initialStep={requestedInitialPanel === "background" ? CHIMER_BACKGROUND_SETUP_STEP_INDEX : 0}
            onTimeClick={openTimeModal}
            onSettingsChange={updateSettings}
            onBackgroundVisualCommit={applyBackgroundVisualPreferences}
            onStartTimer={startTimer}
            onStartClock={startClock}
            hapticsEnabled={appSettings.hapticFeedbackEnabled}
            onTestAlert={testAlert}
            onUseDeviceSettings={useDeviceSettingsForAccount}
            onUseSavedSettings={useSavedAccountSettings}
          />
        ) : (
          <RunningTimer
            mode={immersiveMode}
            timeDisplay={timeDisplay}
            activeTimeDisplay={activeTimeDisplay}
            currentTime={currentTime}
            status={timerState.status as "running" | "paused" | "complete" | "clock"}
            isFullscreen={isFullscreen}
            isAlerting={isAlerting}
            fontSize={fontSize}
            movingBackgroundEnabled={runWithoutAnimatedBackground ? false : settings.movingBackgroundEnabled}
            keepTimerScreenAwake={settings.keepTimerScreenAwake}
            clockRotationEnabled={settings.clockRotationEnabled}
            clockRotationRange={settings.clockRotationRange}
            clockRotationDuration={settings.clockRotationDuration}
            clockForwardGlowEnabled={settings.clockForwardGlowEnabled}
            clockForwardGlowStrength={settings.clockForwardGlowStrength}
            clockForwardGlowLength={settings.clockForwardGlowLength}
            clockForwardGlowBlur={settings.clockForwardGlowBlur}
            showTimerSeconds={settings.showTimerSeconds}
            showCurrentTimeSeconds={settings.showCurrentTimeSeconds}
            timeFormat={settings.timeFormat}
            primaryFontColor={settings.primaryFontColor}
            secondaryFontColor={settings.secondaryFontColor}
            clockModeFontColor={settings.clockModeFontColor}
            clockFontFamily={settings.clockFontFamily}
            clockStrokeEnabled={settings.clockStrokeEnabled}
            clockStrokeColor={settings.clockStrokeColor}
            clockStrokeWidth={settings.clockStrokeWidth}
            clockShadowEnabled={settings.clockShadowEnabled}
            clockShadowColor={settings.clockShadowColor}
            clockShadowStrength={settings.clockShadowStrength}
            clockShadowDirection={settings.clockShadowDirection}
            clockShadowDistance={settings.clockShadowDistance}
            clockShadowFeather={settings.clockShadowFeather}
            clockGlowEnabled={settings.clockGlowEnabled}
            clockGlowColor={settings.clockGlowColor}
            clockGlowStrength={settings.clockGlowStrength}
            sparklesMaxSize={settings.sparklesMaxSize}
            sparklesMinSize={settings.sparklesMinSize}
            sparklesParticleDensity={settings.sparklesParticleDensity}
            sparklesSpeed={settings.sparklesSpeed}
            gradientAnimationSpeed={settings.gradientAnimationSpeed}
            gradientAnimationSize={settings.gradientAnimationSize}
            massageLabGradientOpacity={settings.massageLabGradientOpacity}
            massageLabStarsSpeed={settings.massageLabStarsSpeed}
            massageLabStarsDensity={settings.massageLabStarsDensity}
            massageLabStarsParallax={settings.massageLabStarsParallax}
            massageLabHoleLineCount={settings.massageLabHoleLineCount}
            massageLabHoleDiscCount={settings.massageLabHoleDiscCount}
            massageLabLightSpeedWarpSpeed={settings.massageLabLightSpeedWarpSpeed}
            massageLabLightSpeedParticleCount={settings.massageLabLightSpeedParticleCount}
            massageLabLightSpeedIntensity={settings.massageLabLightSpeedIntensity}
            massageLabLightSpeedRadius={settings.massageLabLightSpeedRadius}
            massageLabLightSpeedCylinderLength={settings.massageLabLightSpeedCylinderLength}
            massageLabElectricMistSpeed={settings.massageLabElectricMistSpeed}
            massageLabElectricMistDetail={settings.massageLabElectricMistDetail}
            massageLabElectricMistDistortion={settings.massageLabElectricMistDistortion}
            massageLabElectricMistBrightness={settings.massageLabElectricMistBrightness}
            massageLabAstralFlowSpeed={settings.massageLabAstralFlowSpeed}
            massageLabAstralFlowFlowMin={settings.massageLabAstralFlowFlowMin}
            massageLabAstralFlowFlowMax={settings.massageLabAstralFlowFlowMax}
            massageLabDeepSpaceNebulaSpeed={settings.massageLabDeepSpaceNebulaSpeed}
            massageLabGridBloomSpeed={settings.massageLabGridBloomSpeed}
            massageLabGridBloomGridScale={settings.massageLabGridBloomGridScale}
            massageLabGridBloomRotationSpeed={settings.massageLabGridBloomRotationSpeed}
            massageLabGridBloomFadeFalloff={settings.massageLabGridBloomFadeFalloff}
            massageLabGridBloomDistortionAmount={settings.massageLabGridBloomDistortionAmount}
            massageLabGridBloomFlowSpeedX={settings.massageLabGridBloomFlowSpeedX}
            massageLabGridBloomFlowSpeedY={settings.massageLabGridBloomFlowSpeedY}
            massageLabChromeFlowFlowSpeed={settings.massageLabChromeFlowFlowSpeed}
            massageLabChromeFlowTimeScale={settings.massageLabChromeFlowTimeScale}
            massageLabWaveCurrentSpeedX={settings.massageLabWaveCurrentSpeedX}
            massageLabWaveCurrentSpeedY={settings.massageLabWaveCurrentSpeedY}
            massageLabWaveCurrentAmplitude={settings.massageLabWaveCurrentAmplitude}
            massageLabFerrofluidSpeed={settings.massageLabFerrofluidSpeed}
            massageLabFerrofluidScale={settings.massageLabFerrofluidScale}
            massageLabFerrofluidTurbulence={settings.massageLabFerrofluidTurbulence}
            massageLabFerrofluidFluidity={settings.massageLabFerrofluidFluidity}
            massageLabFerrofluidRimWidth={settings.massageLabFerrofluidRimWidth}
            massageLabFerrofluidSharpness={settings.massageLabFerrofluidSharpness}
            massageLabFerrofluidShimmer={settings.massageLabFerrofluidShimmer}
            massageLabFerrofluidGlow={settings.massageLabFerrofluidGlow}
            massageLabFerrofluidFlowDirection={settings.massageLabFerrofluidFlowDirection}
            massageLabFerrofluidOpacity={settings.massageLabFerrofluidOpacity}
            massageLabLightfallSpeed={settings.massageLabLightfallSpeed}
            massageLabLightfallStreakCount={settings.massageLabLightfallStreakCount}
            massageLabLightfallStreakWidth={settings.massageLabLightfallStreakWidth}
            massageLabLightfallStreakLength={settings.massageLabLightfallStreakLength}
            massageLabLightfallGlow={settings.massageLabLightfallGlow}
            massageLabLightfallDensity={settings.massageLabLightfallDensity}
            massageLabLightfallTwinkle={settings.massageLabLightfallTwinkle}
            massageLabLightfallZoom={settings.massageLabLightfallZoom}
            massageLabLightfallBackgroundGlow={settings.massageLabLightfallBackgroundGlow}
            massageLabLightfallOpacity={settings.massageLabLightfallOpacity}
            massageLabLightfallCursorEnabled={settings.massageLabLightfallCursorEnabled}
            massageLabLightfallCursorStrength={settings.massageLabLightfallCursorStrength}
            massageLabLightfallCursorRadius={settings.massageLabLightfallCursorRadius}
            massageLabLightfallCursorDampening={settings.massageLabLightfallCursorDampening}
            massageLabLiquidEtherCursorEnabled={settings.massageLabLiquidEtherCursorEnabled}
            massageLabLiquidEtherMouseForce={settings.massageLabLiquidEtherMouseForce}
            massageLabLiquidEtherCursorSize={settings.massageLabLiquidEtherCursorSize}
            massageLabLiquidEtherIsViscous={settings.massageLabLiquidEtherIsViscous}
            massageLabLiquidEtherViscous={settings.massageLabLiquidEtherViscous}
            massageLabLiquidEtherIterationsViscous={settings.massageLabLiquidEtherIterationsViscous}
            massageLabLiquidEtherIterationsPoisson={settings.massageLabLiquidEtherIterationsPoisson}
            massageLabLiquidEtherDt={settings.massageLabLiquidEtherDt}
            massageLabLiquidEtherBfecc={settings.massageLabLiquidEtherBfecc}
            massageLabLiquidEtherResolution={settings.massageLabLiquidEtherResolution}
            massageLabLiquidEtherIsBounce={settings.massageLabLiquidEtherIsBounce}
            massageLabLiquidEtherAutoDemo={settings.massageLabLiquidEtherAutoDemo}
            massageLabLiquidEtherAutoSpeed={settings.massageLabLiquidEtherAutoSpeed}
            massageLabLiquidEtherAutoIntensity={settings.massageLabLiquidEtherAutoIntensity}
            massageLabLiquidEtherAutoResumeDelay={settings.massageLabLiquidEtherAutoResumeDelay}
            massageLabLiquidEtherAutoRampDuration={settings.massageLabLiquidEtherAutoRampDuration}
            massageLabLiquidEtherOpacity={settings.massageLabLiquidEtherOpacity}
            massageLabPrismHeight={settings.massageLabPrismHeight}
            massageLabPrismBaseWidth={settings.massageLabPrismBaseWidth}
            massageLabPrismAnimationType={settings.massageLabPrismAnimationType}
            massageLabPrismGlow={settings.massageLabPrismGlow}
            massageLabPrismOffsetX={settings.massageLabPrismOffsetX}
            massageLabPrismOffsetY={settings.massageLabPrismOffsetY}
            massageLabPrismNoise={settings.massageLabPrismNoise}
            massageLabPrismTransparent={settings.massageLabPrismTransparent}
            massageLabPrismScale={settings.massageLabPrismScale}
            massageLabPrismHueShift={settings.massageLabPrismHueShift}
            massageLabPrismColorFrequency={settings.massageLabPrismColorFrequency}
            massageLabPrismHoverStrength={settings.massageLabPrismHoverStrength}
            massageLabPrismInertia={settings.massageLabPrismInertia}
            massageLabPrismBloom={settings.massageLabPrismBloom}
            massageLabPrismTimeScale={settings.massageLabPrismTimeScale}
            massageLabDarkVeilHueShift={settings.massageLabDarkVeilHueShift}
            massageLabDarkVeilNoiseIntensity={settings.massageLabDarkVeilNoiseIntensity}
            massageLabDarkVeilScanlineIntensity={settings.massageLabDarkVeilScanlineIntensity}
            massageLabDarkVeilSpeed={settings.massageLabDarkVeilSpeed}
            massageLabDarkVeilScanlineFrequency={settings.massageLabDarkVeilScanlineFrequency}
            massageLabDarkVeilWarpAmount={settings.massageLabDarkVeilWarpAmount}
            massageLabDarkVeilResolutionScale={settings.massageLabDarkVeilResolutionScale}
            massageLabLightPillarIntensity={settings.massageLabLightPillarIntensity}
            massageLabLightPillarRotationSpeed={settings.massageLabLightPillarRotationSpeed}
            massageLabLightPillarInteractive={settings.massageLabLightPillarInteractive}
            massageLabLightPillarGlowAmount={settings.massageLabLightPillarGlowAmount}
            massageLabLightPillarWidth={settings.massageLabLightPillarWidth}
            massageLabLightPillarHeight={settings.massageLabLightPillarHeight}
            massageLabLightPillarNoiseIntensity={settings.massageLabLightPillarNoiseIntensity}
            massageLabLightPillarBlendMode={settings.massageLabLightPillarBlendMode}
            massageLabLightPillarRotation={settings.massageLabLightPillarRotation}
            massageLabLightPillarQuality={settings.massageLabLightPillarQuality}
            massageLabSilkSpeed={settings.massageLabSilkSpeed}
            massageLabSilkScale={settings.massageLabSilkScale}
            massageLabSilkNoiseIntensity={settings.massageLabSilkNoiseIntensity}
            massageLabSilkRotation={settings.massageLabSilkRotation}
            massageLabFloatingLinesEnableTop={settings.massageLabFloatingLinesEnableTop}
            massageLabFloatingLinesEnableMiddle={settings.massageLabFloatingLinesEnableMiddle}
            massageLabFloatingLinesEnableBottom={settings.massageLabFloatingLinesEnableBottom}
            massageLabFloatingLinesTopLineCount={settings.massageLabFloatingLinesTopLineCount}
            massageLabFloatingLinesMiddleLineCount={settings.massageLabFloatingLinesMiddleLineCount}
            massageLabFloatingLinesBottomLineCount={settings.massageLabFloatingLinesBottomLineCount}
            massageLabFloatingLinesTopLineDistance={settings.massageLabFloatingLinesTopLineDistance}
            massageLabFloatingLinesMiddleLineDistance={settings.massageLabFloatingLinesMiddleLineDistance}
            massageLabFloatingLinesBottomLineDistance={settings.massageLabFloatingLinesBottomLineDistance}
            massageLabFloatingLinesTopWaveX={settings.massageLabFloatingLinesTopWaveX}
            massageLabFloatingLinesTopWaveY={settings.massageLabFloatingLinesTopWaveY}
            massageLabFloatingLinesTopWaveRotate={settings.massageLabFloatingLinesTopWaveRotate}
            massageLabFloatingLinesMiddleWaveX={settings.massageLabFloatingLinesMiddleWaveX}
            massageLabFloatingLinesMiddleWaveY={settings.massageLabFloatingLinesMiddleWaveY}
            massageLabFloatingLinesMiddleWaveRotate={settings.massageLabFloatingLinesMiddleWaveRotate}
            massageLabFloatingLinesBottomWaveX={settings.massageLabFloatingLinesBottomWaveX}
            massageLabFloatingLinesBottomWaveY={settings.massageLabFloatingLinesBottomWaveY}
            massageLabFloatingLinesBottomWaveRotate={settings.massageLabFloatingLinesBottomWaveRotate}
            massageLabFloatingLinesAnimationSpeed={settings.massageLabFloatingLinesAnimationSpeed}
            massageLabFloatingLinesInteractive={settings.massageLabFloatingLinesInteractive}
            massageLabFloatingLinesBendRadius={settings.massageLabFloatingLinesBendRadius}
            massageLabFloatingLinesBendStrength={settings.massageLabFloatingLinesBendStrength}
            massageLabFloatingLinesMouseDamping={settings.massageLabFloatingLinesMouseDamping}
            massageLabFloatingLinesParallax={settings.massageLabFloatingLinesParallax}
            massageLabFloatingLinesParallaxStrength={settings.massageLabFloatingLinesParallaxStrength}
            massageLabFloatingLinesBlendMode={settings.massageLabFloatingLinesBlendMode}
            massageLabSideRaysSpeed={settings.massageLabSideRaysSpeed}
            massageLabSideRaysIntensity={settings.massageLabSideRaysIntensity}
            massageLabSideRaysSpread={settings.massageLabSideRaysSpread}
            massageLabSideRaysOrigin={settings.massageLabSideRaysOrigin}
            massageLabSideRaysTilt={settings.massageLabSideRaysTilt}
            massageLabSideRaysSaturation={settings.massageLabSideRaysSaturation}
            massageLabSideRaysBlend={settings.massageLabSideRaysBlend}
            massageLabSideRaysFalloff={settings.massageLabSideRaysFalloff}
            massageLabSideRaysOpacity={settings.massageLabSideRaysOpacity}
            massageLabLightRaysOrigin={settings.massageLabLightRaysOrigin}
            massageLabLightRaysSpeed={settings.massageLabLightRaysSpeed}
            massageLabLightRaysSpread={settings.massageLabLightRaysSpread}
            massageLabLightRaysLength={settings.massageLabLightRaysLength}
            massageLabLightRaysPulsating={settings.massageLabLightRaysPulsating}
            massageLabLightRaysFadeDistance={settings.massageLabLightRaysFadeDistance}
            massageLabLightRaysSaturation={settings.massageLabLightRaysSaturation}
            massageLabLightRaysFollowMouse={settings.massageLabLightRaysFollowMouse}
            massageLabLightRaysMouseInfluence={settings.massageLabLightRaysMouseInfluence}
            massageLabLightRaysNoiseAmount={settings.massageLabLightRaysNoiseAmount}
            massageLabLightRaysDistortion={settings.massageLabLightRaysDistortion}
            massageLabPixelBlastVariant={settings.massageLabPixelBlastVariant}
            massageLabPixelBlastPixelSize={settings.massageLabPixelBlastPixelSize}
            massageLabPixelBlastAntialias={settings.massageLabPixelBlastAntialias}
            massageLabPixelBlastPatternScale={settings.massageLabPixelBlastPatternScale}
            massageLabPixelBlastPatternDensity={settings.massageLabPixelBlastPatternDensity}
            massageLabPixelBlastLiquid={settings.massageLabPixelBlastLiquid}
            massageLabPixelBlastLiquidStrength={settings.massageLabPixelBlastLiquidStrength}
            massageLabPixelBlastLiquidRadius={settings.massageLabPixelBlastLiquidRadius}
            massageLabPixelBlastPixelSizeJitter={settings.massageLabPixelBlastPixelSizeJitter}
            massageLabPixelBlastEnableRipples={settings.massageLabPixelBlastEnableRipples}
            massageLabPixelBlastRippleIntensityScale={settings.massageLabPixelBlastRippleIntensityScale}
            massageLabPixelBlastRippleThickness={settings.massageLabPixelBlastRippleThickness}
            massageLabPixelBlastRippleSpeed={settings.massageLabPixelBlastRippleSpeed}
            massageLabPixelBlastLiquidWobbleSpeed={settings.massageLabPixelBlastLiquidWobbleSpeed}
            massageLabPixelBlastAutoPauseOffscreen={settings.massageLabPixelBlastAutoPauseOffscreen}
            massageLabPixelBlastSpeed={settings.massageLabPixelBlastSpeed}
            massageLabPixelBlastTransparent={settings.massageLabPixelBlastTransparent}
            massageLabPixelBlastEdgeFade={settings.massageLabPixelBlastEdgeFade}
            massageLabPixelBlastNoiseAmount={settings.massageLabPixelBlastNoiseAmount}
            massageLabColorBendsRotation={settings.massageLabColorBendsRotation}
            massageLabColorBendsSpeed={settings.massageLabColorBendsSpeed}
            massageLabColorBendsTransparent={settings.massageLabColorBendsTransparent}
            massageLabColorBendsAutoRotate={settings.massageLabColorBendsAutoRotate}
            massageLabColorBendsScale={settings.massageLabColorBendsScale}
            massageLabColorBendsFrequency={settings.massageLabColorBendsFrequency}
            massageLabColorBendsWarpStrength={settings.massageLabColorBendsWarpStrength}
            massageLabColorBendsInteractive={settings.massageLabColorBendsInteractive}
            massageLabColorBendsMouseInfluence={settings.massageLabColorBendsMouseInfluence}
            massageLabColorBendsParallax={settings.massageLabColorBendsParallax}
            massageLabColorBendsNoise={settings.massageLabColorBendsNoise}
            massageLabColorBendsIterations={settings.massageLabColorBendsIterations}
            massageLabColorBendsIntensity={settings.massageLabColorBendsIntensity}
            massageLabColorBendsBandWidth={settings.massageLabColorBendsBandWidth}
            massageLabEvilEyeIntensity={settings.massageLabEvilEyeIntensity}
            massageLabEvilEyePupilSize={settings.massageLabEvilEyePupilSize}
            massageLabEvilEyeIrisWidth={settings.massageLabEvilEyeIrisWidth}
            massageLabEvilEyeGlowIntensity={settings.massageLabEvilEyeGlowIntensity}
            massageLabEvilEyeScale={settings.massageLabEvilEyeScale}
            massageLabEvilEyeNoiseScale={settings.massageLabEvilEyeNoiseScale}
            massageLabEvilEyePupilFollow={settings.massageLabEvilEyePupilFollow}
            massageLabEvilEyeFlameSpeed={settings.massageLabEvilEyeFlameSpeed}
            massageLabEvilEyeInteractive={settings.massageLabEvilEyeInteractive}
            massageLabLineWavesSpeed={settings.massageLabLineWavesSpeed}
            massageLabLineWavesInnerLineCount={settings.massageLabLineWavesInnerLineCount}
            massageLabLineWavesOuterLineCount={settings.massageLabLineWavesOuterLineCount}
            massageLabLineWavesWarpIntensity={settings.massageLabLineWavesWarpIntensity}
            massageLabLineWavesRotation={settings.massageLabLineWavesRotation}
            massageLabLineWavesEdgeFadeWidth={settings.massageLabLineWavesEdgeFadeWidth}
            massageLabLineWavesColorCycleSpeed={settings.massageLabLineWavesColorCycleSpeed}
            massageLabLineWavesBrightness={settings.massageLabLineWavesBrightness}
            massageLabLineWavesEnableMouseInteraction={settings.massageLabLineWavesEnableMouseInteraction}
            massageLabLineWavesMouseInfluence={settings.massageLabLineWavesMouseInfluence}
            massageLabRadarSpeed={settings.massageLabRadarSpeed}
            massageLabRadarScale={settings.massageLabRadarScale}
            massageLabRadarRingCount={settings.massageLabRadarRingCount}
            massageLabRadarSpokeCount={settings.massageLabRadarSpokeCount}
            massageLabRadarRingThickness={settings.massageLabRadarRingThickness}
            massageLabRadarSpokeThickness={settings.massageLabRadarSpokeThickness}
            massageLabRadarSweepSpeed={settings.massageLabRadarSweepSpeed}
            massageLabRadarSweepWidth={settings.massageLabRadarSweepWidth}
            massageLabRadarSweepLobes={settings.massageLabRadarSweepLobes}
            massageLabRadarFalloff={settings.massageLabRadarFalloff}
            massageLabRadarBrightness={settings.massageLabRadarBrightness}
            massageLabRadarEnableMouseInteraction={settings.massageLabRadarEnableMouseInteraction}
            massageLabRadarMouseInfluence={settings.massageLabRadarMouseInfluence}
            massageLabSoftAuroraSpeed={settings.massageLabSoftAuroraSpeed}
            massageLabSoftAuroraScale={settings.massageLabSoftAuroraScale}
            massageLabSoftAuroraBrightness={settings.massageLabSoftAuroraBrightness}
            massageLabSoftAuroraNoiseFrequency={settings.massageLabSoftAuroraNoiseFrequency}
            massageLabSoftAuroraNoiseAmplitude={settings.massageLabSoftAuroraNoiseAmplitude}
            massageLabSoftAuroraBandHeight={settings.massageLabSoftAuroraBandHeight}
            massageLabSoftAuroraBandSpread={settings.massageLabSoftAuroraBandSpread}
            massageLabSoftAuroraOctaveDecay={settings.massageLabSoftAuroraOctaveDecay}
            massageLabSoftAuroraLayerOffset={settings.massageLabSoftAuroraLayerOffset}
            massageLabSoftAuroraColorSpeed={settings.massageLabSoftAuroraColorSpeed}
            massageLabSoftAuroraEnableMouseInteraction={settings.massageLabSoftAuroraEnableMouseInteraction}
            massageLabSoftAuroraMouseInfluence={settings.massageLabSoftAuroraMouseInfluence}
            massageLabPlasmaSpeed={settings.massageLabPlasmaSpeed}
            massageLabPlasmaDirection={settings.massageLabPlasmaDirection}
            massageLabPlasmaScale={settings.massageLabPlasmaScale}
            massageLabPlasmaOpacity={settings.massageLabPlasmaOpacity}
            massageLabPlasmaMouseInteractive={settings.massageLabPlasmaMouseInteractive}
            massageLabPlasmaWaveXOffset={settings.massageLabPlasmaWaveXOffset}
            massageLabPlasmaWaveYOffset={settings.massageLabPlasmaWaveYOffset}
            massageLabPlasmaWaveRotationDeg={settings.massageLabPlasmaWaveRotationDeg}
            massageLabPlasmaWaveFocalLength={settings.massageLabPlasmaWaveFocalLength}
            massageLabPlasmaWaveSpeedOne={settings.massageLabPlasmaWaveSpeedOne}
            massageLabPlasmaWaveSpeedTwo={settings.massageLabPlasmaWaveSpeedTwo}
            massageLabPlasmaWaveDirectionTwo={settings.massageLabPlasmaWaveDirectionTwo}
            massageLabPlasmaWaveBendOne={settings.massageLabPlasmaWaveBendOne}
            massageLabPlasmaWaveBendTwo={settings.massageLabPlasmaWaveBendTwo}
            massageLabParticlesCount={settings.massageLabParticlesCount}
            massageLabParticlesSpread={settings.massageLabParticlesSpread}
            massageLabParticlesSpeed={settings.massageLabParticlesSpeed}
            massageLabParticlesMoveOnHover={settings.massageLabParticlesMoveOnHover}
            massageLabParticlesHoverFactor={settings.massageLabParticlesHoverFactor}
            massageLabParticlesAlpha={settings.massageLabParticlesAlpha}
            massageLabParticlesBaseSize={settings.massageLabParticlesBaseSize}
            massageLabParticlesSizeRandomness={settings.massageLabParticlesSizeRandomness}
            massageLabParticlesCameraDistance={settings.massageLabParticlesCameraDistance}
            massageLabParticlesDisableRotation={settings.massageLabParticlesDisableRotation}
            massageLabParticlesPixelRatio={settings.massageLabParticlesPixelRatio}
            massageLabGradientBlindsAngle={settings.massageLabGradientBlindsAngle}
            massageLabGradientBlindsNoise={settings.massageLabGradientBlindsNoise}
            massageLabGradientBlindsBlindCount={settings.massageLabGradientBlindsBlindCount}
            massageLabGradientBlindsBlindMinWidth={settings.massageLabGradientBlindsBlindMinWidth}
            massageLabGradientBlindsMouseDampening={settings.massageLabGradientBlindsMouseDampening}
            massageLabGradientBlindsMirror={settings.massageLabGradientBlindsMirror}
            massageLabGradientBlindsSpotlightRadius={settings.massageLabGradientBlindsSpotlightRadius}
            massageLabGradientBlindsSpotlightSoftness={settings.massageLabGradientBlindsSpotlightSoftness}
            massageLabGradientBlindsSpotlightOpacity={settings.massageLabGradientBlindsSpotlightOpacity}
            massageLabGradientBlindsDistort={settings.massageLabGradientBlindsDistort}
            massageLabGradientBlindsShineDirection={settings.massageLabGradientBlindsShineDirection}
            massageLabGradientBlindsBlendMode={settings.massageLabGradientBlindsBlendMode}
            massageLabGradientBlindsDpr={settings.massageLabGradientBlindsDpr}
            massageLabGradientBlindsEnableMouseInteraction={settings.massageLabGradientBlindsEnableMouseInteraction}
            massageLabGrainientTimeSpeed={settings.massageLabGrainientTimeSpeed}
            massageLabGrainientColorBalance={settings.massageLabGrainientColorBalance}
            massageLabGrainientWarpStrength={settings.massageLabGrainientWarpStrength}
            massageLabGrainientWarpFrequency={settings.massageLabGrainientWarpFrequency}
            massageLabGrainientWarpSpeed={settings.massageLabGrainientWarpSpeed}
            massageLabGrainientWarpAmplitude={settings.massageLabGrainientWarpAmplitude}
            massageLabGrainientBlendAngle={settings.massageLabGrainientBlendAngle}
            massageLabGrainientBlendSoftness={settings.massageLabGrainientBlendSoftness}
            massageLabGrainientRotationAmount={settings.massageLabGrainientRotationAmount}
            massageLabGrainientNoiseScale={settings.massageLabGrainientNoiseScale}
            massageLabGrainientGrainAmount={settings.massageLabGrainientGrainAmount}
            massageLabGrainientGrainScale={settings.massageLabGrainientGrainScale}
            massageLabGrainientGrainAnimated={settings.massageLabGrainientGrainAnimated}
            massageLabGrainientContrast={settings.massageLabGrainientContrast}
            massageLabGrainientGamma={settings.massageLabGrainientGamma}
            massageLabGrainientSaturation={settings.massageLabGrainientSaturation}
            massageLabGrainientCenterX={settings.massageLabGrainientCenterX}
            massageLabGrainientCenterY={settings.massageLabGrainientCenterY}
            massageLabGrainientZoom={settings.massageLabGrainientZoom}
            massageLabGridScanSensitivity={settings.massageLabGridScanSensitivity}
            massageLabGridScanLineThickness={settings.massageLabGridScanLineThickness}
            massageLabGridScanScanOpacity={settings.massageLabGridScanScanOpacity}
            massageLabGridScanGridScale={settings.massageLabGridScanGridScale}
            massageLabGridScanLineStyle={settings.massageLabGridScanLineStyle}
            massageLabGridScanLineJitter={settings.massageLabGridScanLineJitter}
            massageLabGridScanDirection={settings.massageLabGridScanDirection}
            massageLabGridScanNoiseIntensity={settings.massageLabGridScanNoiseIntensity}
            massageLabGridScanBloomOpacity={settings.massageLabGridScanBloomOpacity}
            massageLabGridScanScanGlow={settings.massageLabGridScanScanGlow}
            massageLabGridScanScanSoftness={settings.massageLabGridScanScanSoftness}
            massageLabGridScanPhaseTaper={settings.massageLabGridScanPhaseTaper}
            massageLabGridScanScanDuration={settings.massageLabGridScanScanDuration}
            massageLabGridScanScanDelay={settings.massageLabGridScanScanDelay}
            massageLabGridScanEnablePointerInteraction={settings.massageLabGridScanEnablePointerInteraction}
            massageLabGridScanScanOnClick={settings.massageLabGridScanScanOnClick}
            massageLabBeamsBeamWidth={settings.massageLabBeamsBeamWidth}
            massageLabBeamsBeamHeight={settings.massageLabBeamsBeamHeight}
            massageLabBeamsBeamNumber={settings.massageLabBeamsBeamNumber}
            massageLabBeamsSpeed={settings.massageLabBeamsSpeed}
            massageLabBeamsNoiseIntensity={settings.massageLabBeamsNoiseIntensity}
            massageLabBeamsScale={settings.massageLabBeamsScale}
            massageLabBeamsRotation={settings.massageLabBeamsRotation}
            massageLabPixelSnowFlakeSize={settings.massageLabPixelSnowFlakeSize}
            massageLabPixelSnowMinFlakeSize={settings.massageLabPixelSnowMinFlakeSize}
            massageLabPixelSnowPixelResolution={settings.massageLabPixelSnowPixelResolution}
            massageLabPixelSnowSpeed={settings.massageLabPixelSnowSpeed}
            massageLabPixelSnowDepthFade={settings.massageLabPixelSnowDepthFade}
            massageLabPixelSnowFarPlane={settings.massageLabPixelSnowFarPlane}
            massageLabPixelSnowBrightness={settings.massageLabPixelSnowBrightness}
            massageLabPixelSnowGamma={settings.massageLabPixelSnowGamma}
            massageLabPixelSnowDensity={settings.massageLabPixelSnowDensity}
            massageLabPixelSnowVariant={settings.massageLabPixelSnowVariant}
            massageLabPixelSnowDirection={settings.massageLabPixelSnowDirection}
            massageLabLightningXOffset={settings.massageLabLightningXOffset}
            massageLabLightningSpeed={settings.massageLabLightningSpeed}
            massageLabLightningIntensity={settings.massageLabLightningIntensity}
            massageLabLightningSize={settings.massageLabLightningSize}
            massageLabPrismaticBurstIntensity={settings.massageLabPrismaticBurstIntensity}
            massageLabPrismaticBurstSpeed={settings.massageLabPrismaticBurstSpeed}
            massageLabPrismaticBurstAnimationType={settings.massageLabPrismaticBurstAnimationType}
            massageLabPrismaticBurstDistort={settings.massageLabPrismaticBurstDistort}
            massageLabPrismaticBurstOffsetX={settings.massageLabPrismaticBurstOffsetX}
            massageLabPrismaticBurstOffsetY={settings.massageLabPrismaticBurstOffsetY}
            massageLabPrismaticBurstHoverDampness={settings.massageLabPrismaticBurstHoverDampness}
            massageLabPrismaticBurstRayCount={settings.massageLabPrismaticBurstRayCount}
            massageLabPrismaticBurstMixBlendMode={settings.massageLabPrismaticBurstMixBlendMode}
            massageLabGalaxyHueShift={settings.massageLabGalaxyHueShift}
            massageLabGalaxyFocalX={settings.massageLabGalaxyFocalX}
            massageLabGalaxyFocalY={settings.massageLabGalaxyFocalY}
            massageLabGalaxyRotationDeg={settings.massageLabGalaxyRotationDeg}
            massageLabGalaxyStarSpeed={settings.massageLabGalaxyStarSpeed}
            massageLabGalaxyDensity={settings.massageLabGalaxyDensity}
            massageLabGalaxySpeed={settings.massageLabGalaxySpeed}
            massageLabGalaxyMouseInteraction={settings.massageLabGalaxyMouseInteraction}
            massageLabGalaxyGlowIntensity={settings.massageLabGalaxyGlowIntensity}
            massageLabGalaxySaturation={settings.massageLabGalaxySaturation}
            massageLabGalaxyMouseRepulsion={settings.massageLabGalaxyMouseRepulsion}
            massageLabGalaxyRepulsionStrength={settings.massageLabGalaxyRepulsionStrength}
            massageLabGalaxyTwinkleIntensity={settings.massageLabGalaxyTwinkleIntensity}
            massageLabGalaxyRotationSpeed={settings.massageLabGalaxyRotationSpeed}
            massageLabGalaxyAutoCenterRepulsion={settings.massageLabGalaxyAutoCenterRepulsion}
            massageLabGalaxyTransparent={settings.massageLabGalaxyTransparent}
            massageLabDitherWaveSpeed={settings.massageLabDitherWaveSpeed}
            massageLabDitherWaveFrequency={settings.massageLabDitherWaveFrequency}
            massageLabDitherWaveAmplitude={settings.massageLabDitherWaveAmplitude}
            massageLabDitherColorNum={settings.massageLabDitherColorNum}
            massageLabDitherPixelSize={settings.massageLabDitherPixelSize}
            massageLabDitherMouseInteraction={settings.massageLabDitherMouseInteraction}
            massageLabDitherMouseRadius={settings.massageLabDitherMouseRadius}
            massageLabFaultyTerminalScale={settings.massageLabFaultyTerminalScale}
            massageLabFaultyTerminalGridMulX={settings.massageLabFaultyTerminalGridMulX}
            massageLabFaultyTerminalGridMulY={settings.massageLabFaultyTerminalGridMulY}
            massageLabFaultyTerminalDigitSize={settings.massageLabFaultyTerminalDigitSize}
            massageLabFaultyTerminalTimeScale={settings.massageLabFaultyTerminalTimeScale}
            massageLabFaultyTerminalScanlineIntensity={settings.massageLabFaultyTerminalScanlineIntensity}
            massageLabFaultyTerminalGlitchAmount={settings.massageLabFaultyTerminalGlitchAmount}
            massageLabFaultyTerminalFlickerAmount={settings.massageLabFaultyTerminalFlickerAmount}
            massageLabFaultyTerminalNoiseAmp={settings.massageLabFaultyTerminalNoiseAmp}
            massageLabFaultyTerminalChromaticAberration={settings.massageLabFaultyTerminalChromaticAberration}
            massageLabFaultyTerminalDither={settings.massageLabFaultyTerminalDither}
            massageLabFaultyTerminalCurvature={settings.massageLabFaultyTerminalCurvature}
            massageLabFaultyTerminalMouseReact={settings.massageLabFaultyTerminalMouseReact}
            massageLabFaultyTerminalMouseStrength={settings.massageLabFaultyTerminalMouseStrength}
            massageLabFaultyTerminalPageLoadAnimation={settings.massageLabFaultyTerminalPageLoadAnimation}
            massageLabFaultyTerminalBrightness={settings.massageLabFaultyTerminalBrightness}
            massageLabRippleGridRippleIntensity={settings.massageLabRippleGridRippleIntensity}
            massageLabRippleGridGridSize={settings.massageLabRippleGridGridSize}
            massageLabRippleGridGridThickness={settings.massageLabRippleGridGridThickness}
            massageLabRippleGridFadeDistance={settings.massageLabRippleGridFadeDistance}
            massageLabRippleGridVignetteStrength={settings.massageLabRippleGridVignetteStrength}
            massageLabRippleGridGlowIntensity={settings.massageLabRippleGridGlowIntensity}
            massageLabRippleGridOpacity={settings.massageLabRippleGridOpacity}
            massageLabRippleGridGridRotation={settings.massageLabRippleGridGridRotation}
            massageLabRippleGridMouseInteraction={settings.massageLabRippleGridMouseInteraction}
            massageLabRippleGridMouseInteractionRadius={settings.massageLabRippleGridMouseInteractionRadius}
            massageLabDotFieldDotRadius={settings.massageLabDotFieldDotRadius}
            massageLabDotFieldDotSpacing={settings.massageLabDotFieldDotSpacing}
            massageLabDotFieldCursorRadius={settings.massageLabDotFieldCursorRadius}
            massageLabDotFieldCursorForce={settings.massageLabDotFieldCursorForce}
            massageLabDotFieldBulgeOnly={settings.massageLabDotFieldBulgeOnly}
            massageLabDotFieldBulgeStrength={settings.massageLabDotFieldBulgeStrength}
            massageLabDotFieldGlowRadius={settings.massageLabDotFieldGlowRadius}
            massageLabDotFieldSparkle={settings.massageLabDotFieldSparkle}
            massageLabDotFieldWaveAmplitude={settings.massageLabDotFieldWaveAmplitude}
            massageLabDotFieldCursorInteraction={settings.massageLabDotFieldCursorInteraction}
            massageLabDotGridDotSize={settings.massageLabDotGridDotSize}
            massageLabDotGridGap={settings.massageLabDotGridGap}
            massageLabDotGridProximity={settings.massageLabDotGridProximity}
            massageLabDotGridSpeedTrigger={settings.massageLabDotGridSpeedTrigger}
            massageLabDotGridShockRadius={settings.massageLabDotGridShockRadius}
            massageLabDotGridShockStrength={settings.massageLabDotGridShockStrength}
            massageLabDotGridMaxSpeed={settings.massageLabDotGridMaxSpeed}
            massageLabDotGridResistance={settings.massageLabDotGridResistance}
            massageLabDotGridReturnDuration={settings.massageLabDotGridReturnDuration}
            massageLabDotGridCursorInteraction={settings.massageLabDotGridCursorInteraction}
            massageLabDotGridClickShock={settings.massageLabDotGridClickShock}
            massageLabThreadsAmplitude={settings.massageLabThreadsAmplitude}
            massageLabThreadsDistance={settings.massageLabThreadsDistance}
            massageLabThreadsEnableMouseInteraction={settings.massageLabThreadsEnableMouseInteraction}
            massageLabIridescenceSpeed={settings.massageLabIridescenceSpeed}
            massageLabIridescenceAmplitude={settings.massageLabIridescenceAmplitude}
            massageLabIridescenceMouseReact={settings.massageLabIridescenceMouseReact}
            massageLabWavesTransparentBackground={settings.massageLabWavesTransparentBackground}
            massageLabWavesSpeedX={settings.massageLabWavesSpeedX}
            massageLabWavesSpeedY={settings.massageLabWavesSpeedY}
            massageLabWavesAmplitudeX={settings.massageLabWavesAmplitudeX}
            massageLabWavesAmplitudeY={settings.massageLabWavesAmplitudeY}
            massageLabWavesGapX={settings.massageLabWavesGapX}
            massageLabWavesGapY={settings.massageLabWavesGapY}
            massageLabWavesFriction={settings.massageLabWavesFriction}
            massageLabWavesTension={settings.massageLabWavesTension}
            massageLabWavesMaxCursorMove={settings.massageLabWavesMaxCursorMove}
            massageLabWavesCursorInteraction={settings.massageLabWavesCursorInteraction}
            massageLabGridDistortionGrid={settings.massageLabGridDistortionGrid}
            massageLabGridDistortionMouse={settings.massageLabGridDistortionMouse}
            massageLabGridDistortionStrength={settings.massageLabGridDistortionStrength}
            massageLabGridDistortionRelaxation={settings.massageLabGridDistortionRelaxation}
            massageLabGridDistortionCursorInteraction={settings.massageLabGridDistortionCursorInteraction}
            massageLabOrbHoverIntensity={settings.massageLabOrbHoverIntensity}
            massageLabOrbRotateOnHover={settings.massageLabOrbRotateOnHover}
            massageLabOrbForceHoverState={settings.massageLabOrbForceHoverState}
            massageLabOrbCursorInteraction={settings.massageLabOrbCursorInteraction}
            massageLabLetterGlitchGlitchSpeed={settings.massageLabLetterGlitchGlitchSpeed}
            massageLabLetterGlitchCenterVignette={settings.massageLabLetterGlitchCenterVignette}
            massageLabLetterGlitchOuterVignette={settings.massageLabLetterGlitchOuterVignette}
            massageLabLetterGlitchSmooth={settings.massageLabLetterGlitchSmooth}
            massageLabLetterGlitchCharacters={settings.massageLabLetterGlitchCharacters}
            massageLabGridMotionMaxMoveAmount={settings.massageLabGridMotionMaxMoveAmount}
            massageLabGridMotionBaseDuration={settings.massageLabGridMotionBaseDuration}
            massageLabGridMotionCursorInteraction={settings.massageLabGridMotionCursorInteraction}
            massageLabShapeGridDirection={settings.massageLabShapeGridDirection}
            massageLabShapeGridSpeed={settings.massageLabShapeGridSpeed}
            massageLabShapeGridSquareSize={settings.massageLabShapeGridSquareSize}
            massageLabShapeGridShape={settings.massageLabShapeGridShape}
            massageLabShapeGridHoverTrailAmount={settings.massageLabShapeGridHoverTrailAmount}
            massageLabShapeGridCursorInteraction={settings.massageLabShapeGridCursorInteraction}
            massageLabLiquidChromeSpeed={settings.massageLabLiquidChromeSpeed}
            massageLabLiquidChromeAmplitude={settings.massageLabLiquidChromeAmplitude}
            massageLabLiquidChromeFrequencyX={settings.massageLabLiquidChromeFrequencyX}
            massageLabLiquidChromeFrequencyY={settings.massageLabLiquidChromeFrequencyY}
            massageLabLiquidChromeInteractive={settings.massageLabLiquidChromeInteractive}
            massageLabBalatroSpinRotation={settings.massageLabBalatroSpinRotation}
            massageLabBalatroSpinSpeed={settings.massageLabBalatroSpinSpeed}
            massageLabBalatroOffsetX={settings.massageLabBalatroOffsetX}
            massageLabBalatroOffsetY={settings.massageLabBalatroOffsetY}
            massageLabBalatroContrast={settings.massageLabBalatroContrast}
            massageLabBalatroLighting={settings.massageLabBalatroLighting}
            massageLabBalatroSpinAmount={settings.massageLabBalatroSpinAmount}
            massageLabBalatroPixelFilter={settings.massageLabBalatroPixelFilter}
            massageLabBalatroSpinEase={settings.massageLabBalatroSpinEase}
            massageLabBalatroIsRotate={settings.massageLabBalatroIsRotate}
            massageLabBalatroMouseInteraction={settings.massageLabBalatroMouseInteraction}
            massageLabNovatrixSpeed={settings.massageLabNovatrixSpeed}
            massageLabNovatrixAmplitude={settings.massageLabNovatrixAmplitude}
            massageLabMatrixRainSpeed={settings.massageLabMatrixRainSpeed}
            massageLabMatrixRainFontSize={settings.massageLabMatrixRainFontSize}
            massageLabPhotonBeamLineCount={settings.massageLabPhotonBeamLineCount}
            massageLabPhotonBeamSpreadHeight={settings.massageLabPhotonBeamSpreadHeight}
            massageLabPhotonBeamSpreadDepth={settings.massageLabPhotonBeamSpreadDepth}
            massageLabPhotonBeamCurveLength={settings.massageLabPhotonBeamCurveLength}
            massageLabPhotonBeamStraightLength={settings.massageLabPhotonBeamStraightLength}
            massageLabPhotonBeamCurvePower={settings.massageLabPhotonBeamCurvePower}
            massageLabPhotonBeamWaveSpeed={settings.massageLabPhotonBeamWaveSpeed}
            massageLabPhotonBeamWaveHeight={settings.massageLabPhotonBeamWaveHeight}
            massageLabPhotonBeamLineOpacity={settings.massageLabPhotonBeamLineOpacity}
            massageLabPhotonBeamSignalCount={settings.massageLabPhotonBeamSignalCount}
            massageLabPhotonBeamSpeedGlobal={settings.massageLabPhotonBeamSpeedGlobal}
            massageLabPhotonBeamTrailLength={settings.massageLabPhotonBeamTrailLength}
            massageLabPhotonBeamBloomStrength={settings.massageLabPhotonBeamBloomStrength}
            massageLabPhotonBeamBloomRadius={settings.massageLabPhotonBeamBloomRadius}
            massageLab3DGlobeViewStyle={settings.massageLab3DGlobeViewStyle}
            massageLab3DGlobeGraphicMapSamples={settings.massageLab3DGlobeGraphicMapSamples}
            massageLab3DGlobeAutoRotateSpeed={settings.massageLab3DGlobeAutoRotateSpeed}
            massageLab3DGlobeReverseSpin={settings.massageLab3DGlobeReverseSpin}
            massageLab3DGlobeScale={settings.massageLab3DGlobeScale}
            massageLab3DGlobeBumpScale={settings.massageLab3DGlobeBumpScale}
            massageLab3DGlobeAmbientIntensity={settings.massageLab3DGlobeAmbientIntensity}
            massageLab3DGlobePointLightIntensity={settings.massageLab3DGlobePointLightIntensity}
            massageLab3DGlobeLightingMode={settings.massageLab3DGlobeLightingMode}
            massageLab3DGlobeEnablePan={settings.massageLab3DGlobeEnablePan}
            massageLab3DGlobePanX={settings.massageLab3DGlobePanX}
            massageLab3DGlobePanY={settings.massageLab3DGlobePanY}
            massageLab3DGlobeShowTilt={settings.massageLab3DGlobeShowTilt}
            massageLab3DGlobeShowAtmosphere={settings.massageLab3DGlobeShowAtmosphere}
            massageLab3DGlobeAtmosphereIntensity={settings.massageLab3DGlobeAtmosphereIntensity}
            massageLab3DGlobeAtmosphereBlur={settings.massageLab3DGlobeAtmosphereBlur}
            massageLab3DGlobeShowWireframe={settings.massageLab3DGlobeShowWireframe}
            massageLab3DGlobeMarkerEnabled={settings.massageLab3DGlobeMarkerEnabled}
            massageLab3DGlobeMarkerLat={settings.massageLab3DGlobeMarkerLat}
            massageLab3DGlobeMarkerLng={settings.massageLab3DGlobeMarkerLng}
            massageLab3DGlobeMarkerLabel={settings.massageLab3DGlobeMarkerLabel}
            massageLab3DGlobeMarkerIcon={settings.massageLab3DGlobeMarkerIcon}
            massageLab3DGlobeMarkerSize={settings.massageLab3DGlobeMarkerSize}
            massageLabRetroGridAngle={settings.massageLabRetroGridAngle}
            massageLabRetroGridCellSize={settings.massageLabRetroGridCellSize}
            massageLabRetroGridOpacity={settings.massageLabRetroGridOpacity}
            massageLabAerialRaysCount={settings.massageLabAerialRaysCount}
            massageLabAerialRaysBlur={settings.massageLabAerialRaysBlur}
            massageLabAerialRaysSpeed={settings.massageLabAerialRaysSpeed}
            massageLabAerialRaysLength={settings.massageLabAerialRaysLength}
            massageLabAerialRaysOpacity={settings.massageLabAerialRaysOpacity}
            massageLabSynthesisSpeed={settings.massageLabSynthesisSpeed}
            massageLabSynthesisComplexity={settings.massageLabSynthesisComplexity}
            massageLabSynthesisScale={settings.massageLabSynthesisScale}
            massageLabSynthesisDistortion={settings.massageLabSynthesisDistortion}
            massageLabSynthesisGlowIntensity={settings.massageLabSynthesisGlowIntensity}
            massageLabSynthesisFlowFrequency={settings.massageLabSynthesisFlowFrequency}
            backgroundLinesDuration={settings.backgroundLinesDuration}
            shootingStarsDensity={settings.shootingStarsDensity}
            shootingStarsTwinkle={settings.shootingStarsTwinkle}
            shootingStarsTwinkleSpeed={settings.shootingStarsTwinkleSpeed}
            shootingStarsShootingSpeed={settings.shootingStarsShootingSpeed}
            shootingStarsFrequency={settings.shootingStarsFrequency}
            canvasRevealDotsDotSize={settings.canvasRevealDotsDotSize}
            canvasRevealDotsDotSpacing={settings.canvasRevealDotsDotSpacing}
            canvasRevealDotsOpacity={settings.canvasRevealDotsOpacity}
            canvasRevealDotsAnimationSpeed={settings.canvasRevealDotsAnimationSpeed}
            canvasRevealDotsShowGradient={settings.canvasRevealDotsShowGradient}
            spotlightOpacity={settings.spotlightOpacity}
            spotlightWidth={settings.spotlightWidth}
            spotlightHeight={settings.spotlightHeight}
            spotlightSmallWidth={settings.spotlightSmallWidth}
            spotlightTranslateY={settings.spotlightTranslateY}
            spotlightDuration={settings.spotlightDuration}
            spotlightXOffset={settings.spotlightXOffset}
            lampGlowOpacity={settings.lampGlowOpacity}
            lampBeamWidth={settings.lampBeamWidth}
            lampGlowWidth={settings.lampGlowWidth}
            lampVerticalOffset={settings.lampVerticalOffset}
            lampPulseSpeed={settings.lampPulseSpeed}
            vortexParticleCount={settings.vortexParticleCount}
            vortexRangeY={settings.vortexRangeY}
            vortexBaseSpeed={settings.vortexBaseSpeed}
            vortexRangeSpeed={settings.vortexRangeSpeed}
            vortexBaseRadius={settings.vortexBaseRadius}
            vortexRangeRadius={settings.vortexRangeRadius}
            wavyWaveWidth={settings.wavyWaveWidth}
            wavyBlur={settings.wavyBlur}
            wavySpeed={settings.wavySpeed}
            wavyWaveOpacity={settings.wavyWaveOpacity}
            auroraBarsBarCount={settings.auroraBarsBarCount}
            auroraBarsSpeed={settings.auroraBarsSpeed}
            auroraBarsBlur={settings.auroraBarsBlur}
            auroraBarsGap={settings.auroraBarsGap}
            auroraBarsMaxHeightRatio={settings.auroraBarsMaxHeightRatio}
            auroraBarsMinHeightRatio={settings.auroraBarsMinHeightRatio}
            pixelLiquidPixelSize={settings.pixelLiquidPixelSize}
            pixelLiquidDetail={settings.pixelLiquidDetail}
            pixelLiquidMotionSpeed={settings.pixelLiquidMotionSpeed}
            tileGridTileSize={settings.tileGridTileSize}
            tileGridJointSize={settings.tileGridJointSize}
            tileGridChangeFrequency={settings.tileGridChangeFrequency}
            tileGridActivePercent={settings.tileGridActivePercent}
            tileGridOpacity={settings.tileGridOpacity}
            hexGridHexSize={settings.hexGridHexSize}
            hexGridJointSize={settings.hexGridJointSize}
            hexGridChangeFrequency={settings.hexGridChangeFrequency}
            hexGridActivePercent={settings.hexGridActivePercent}
            hexGridOpacity={settings.hexGridOpacity}
            {...(visualDraftPropertyOverrides ?? {})}
            canUseCustomColors={canUseCustomColors}
            canUseAccountColorControls={canUseAccountColorControls}
            committedSettings={settings}
            backgroundVisualPreferences={settings.backgroundVisualPreferences}
            backgroundPreferenceSyncStatus={backgroundPreferenceSync.status}
            backgroundAccess={backgroundAccess}
            activeIntervalMinutes={timerState.intervalMs ? Math.max(1, Math.round(timerState.intervalMs / 60_000)) : null}
            onPause={togglePause}
            onFullscreen={toggleFullscreen}
            onSettingsChange={updateSettings}
            onFontSizeChange={setFontSize}
            onAdjustActiveRemainingMinutes={adjustActiveRemainingMinutes}
            onSetActiveRemainingDuration={setActiveRemainingDuration}
            onSetActiveIntervalMinutes={setActiveIntervalMinutes}
            onVisualDraftPreviewChange={setVisualDraftPropertyOverrides}
            onApplyBackgroundVisualPreferences={applyBackgroundVisualPreferences}
            onRetryBackgroundVisualPreferences={retryBackgroundVisualPreferenceSync}
            hapticsEnabled={appSettings.hapticFeedbackEnabled}
          />
        )}

        <Dialog open={showTimeModal} onOpenChange={setShowTimeModal}>
          <DialogContent className="max-h-[80dvh] overflow-auto border-border bg-card p-6">
            <DialogHeader>
              <DialogTitle className="text-center text-xl">
                Set {selectedTimeUnit === "hours" ? "Hours" : "Minutes"}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Choose a {selectedTimeUnit === "hours" ? "hour" : "minute"} value for the Chimer timer.
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {Array.from({ length: selectedTimeUnit === "hours" ? 24 : 60 }).map((_, index) => (
                <button
                  key={index}
                  onClick={() => handleTimeSelection(index)}
                  className="rounded-md bg-muted p-3 text-foreground transition-colors hover:bg-primary hover:text-primary-foreground focus:outline-none focus:ring-2 focus:ring-brand-orange"
                >
                  {index.toString().padStart(2, "0")}
                </button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
        {isAlerting && (
          <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-x-0 top-0 bottom-[-4rem] z-[20000] bg-white"
          />
        )}
      </div>
    </div>
  )
}
