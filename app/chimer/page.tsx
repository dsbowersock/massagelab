"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { MovingBackground } from "@/components/moving-background"
import { useSettings } from "@/components/providers/settings-provider"
import { useMusic } from "@/components/providers/music-provider"
import { canUseBackgroundId } from "@/components/backgrounds/backgroundRegistry"
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
} from "@/lib/chimer-timer"
import { canSyncAccountPreferencesFromSession } from "@/lib/account-preferences"
import { fetchWithTimeout } from "@/lib/client-fetch"
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
const SOUND_ALERT_TYPES = new Set<ChimerSettings["alertType"]>(["chime", "both", "chime-haptic", "all"])
const FLASH_ALERT_TYPES = new Set<ChimerSettings["alertType"]>(["flash", "both", "flash-haptic", "all"])
const HAPTIC_ALERT_TYPES = new Set<ChimerSettings["alertType"]>(["haptic", "chime-haptic", "flash-haptic", "all"])

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
  return JSON.stringify(sanitizeChimerSettings(left)) === JSON.stringify(sanitizeChimerSettings(right))
}

export default function ChimerPage() {
  const pathname = usePathname() ?? ""
  const router = useRouter()
  const searchParams = useSearchParams()
  const { settings: appSettings } = useSettings()
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
  const [wakeLockMessage, setWakeLockMessage] = useState<string | null>(null)
  const canUseCustomColors = featureKeys.includes(FEATURE_KEYS.chimerCustomColors)
  const hasAccountPreferenceAccess = accountSyncStatus === "synced" || accountSyncStatus === "conflict"
  const canUseAccountColorControls = canUseCustomColors || hasAccountPreferenceAccess

  const timerInterval = useRef<ReturnType<typeof setInterval> | null>(null)
  const alertTimeout = useRef<number | null>(null)
  const timerStateRef = useRef(timerState)
  const settingsRef = useRef(settings)
  const featureKeysRef = useRef(featureKeys)
  const audioContextRef = useRef<AudioContext | null>(null)
  const wakeLockRef = useRef<ChimerWakeLockSentinel | null>(null)
  const wakeLockRequestRef = useRef<Promise<void> | null>(null)
  const shouldKeepWakeLockRef = useRef(false)

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
    featureKeysRef.current = featureKeys
  }, [featureKeys])

  useEffect(() => {
    let isMounted = true

    const loadLocalSettings = () => {
      let nextSettings = DEFAULT_CHIMER_SETTINGS as ChimerSettings
      const savedSettings = window.localStorage.getItem(CHIMER_STORAGE_KEY)

      if (savedSettings) {
        try {
          nextSettings = sanitizeChimerSettings(JSON.parse(savedSettings)) as ChimerSettings
        } catch {
          window.localStorage.removeItem(CHIMER_STORAGE_KEY)
        }
      }

      setSettings(nextSettings)
      window.localStorage.setItem(CHIMER_STORAGE_KEY, JSON.stringify(nextSettings))
      setHasLoadedSettings(true)
      return nextSettings
    }

    async function syncAccountSettings(localSettings: ChimerSettings) {
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
          const localFreeSettings = sanitizeChimerSettingsForEntitlements(localSettings, []) as ChimerSettings
          setSettings(localFreeSettings)
          window.localStorage.setItem(CHIMER_STORAGE_KEY, JSON.stringify(localFreeSettings))
          setFeatureKeys([])
          setCanSync(false)
          setAccountSyncStatus("local")
          return
        }

        const response = await fetchWithTimeout("/api/account/preferences")

        if (!isMounted) {
          return
        }

        if (!response.ok) {
          const localFreeSettings = sanitizeChimerSettingsForEntitlements(localSettings, []) as ChimerSettings
          setSettings(localFreeSettings)
          window.localStorage.setItem(CHIMER_STORAGE_KEY, JSON.stringify(localFreeSettings))
          setCanSync(false)
          setAccountSyncStatus("local")
          return
        }

        const preferences = await response.json()
        const nextFeatureKeys = Array.isArray(preferences.features)
          ? preferences.features.filter((feature: unknown) => typeof feature === "string")
          : []
        setFeatureKeys(nextFeatureKeys)

        if (!isMounted) {
          return
        }

        if (hasSavedPreference(preferences.chimerSettings)) {
          const nextSettings = sanitizeChimerSettingsForEntitlements(
            preferences.chimerSettings,
            nextFeatureKeys,
            { canUseAccountColorControls: true },
          ) as ChimerSettings
          if (areChimerSettingsEqual(localSettings, nextSettings)) {
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

        const seedSettings = sanitizeChimerSettingsForEntitlements(
          localSettings,
          nextFeatureKeys,
          { canUseAccountColorControls: true },
        ) as ChimerSettings
        const seedResponse = await fetchWithTimeout("/api/account/preferences", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ chimerSettings: seedSettings }),
        })

        if (!isMounted) {
          return
        }

        setCanSync(seedResponse.ok)
        setAccountSyncStatus(seedResponse.ok ? "synced" : "local")
      } catch {
        if (!isMounted) {
          return
        }
        const localFreeSettings = sanitizeChimerSettingsForEntitlements(localSettings, []) as ChimerSettings
        setSettings(localFreeSettings)
        window.localStorage.setItem(CHIMER_STORAGE_KEY, JSON.stringify(localFreeSettings))
        setCanSync(false)
        setAccountSyncStatus("local")
      }
    }

    const localSettings = loadLocalSettings()
    void syncAccountSettings(localSettings)

    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (hasLoadedSettings) {
      window.localStorage.setItem(CHIMER_STORAGE_KEY, JSON.stringify(settings))

      if (canSync && accountSyncStatus === "synced") {
        void fetchWithTimeout("/api/account/preferences", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ chimerSettings: settings }),
        }).catch(() => undefined)
      }
    }
  }, [accountSyncStatus, canSync, hasLoadedSettings, settings])

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

  const updateSettings = (nextSettings: Partial<ChimerSettings>) => {
    setError(null)
    const nextSanitizedSettings = sanitizeChimerSettingsForEntitlements(
      { ...settingsRef.current, ...nextSettings },
      featureKeysRef.current,
      { canUseAccountColorControls },
    ) as ChimerSettings

    setSettings(nextSanitizedSettings)

    if (accountSyncStatus === "conflict" && accountSettings) {
      // Local divergence during a conflict suppresses the redundant sync notice.
      setHasEditedLocalConflictSettings(!areChimerSettingsEqual(nextSanitizedSettings, accountSettings))
    }
  }

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

    try {
      const response = await fetchWithTimeout("/api/account/preferences", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chimerSettings: settingsRef.current }),
      })

      if (!response.ok) {
        setError("Could not sync this device's Chimer settings. Try again after signing in.")
        return
      }

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
      canUseBackground: (id: string) => isBackgroundId(id) && canUseBackgroundId(id, featureKeys, "music"),
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
        onBackgroundChange: (backgroundId) => updateSettings({
          movingBackgroundEnabled: true,
          backgroundId: backgroundId as ChimerSettings["backgroundId"],
        }),
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
            featureKeys={featureKeys}
            backgroundCategory={backgroundCategory}
            initialStep={requestedInitialPanel === "background" ? CHIMER_BACKGROUND_SETUP_STEP_INDEX : 0}
            onTimeClick={openTimeModal}
            onSettingsChange={updateSettings}
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
            movingBackgroundMainColor={settings.movingBackgroundMainColor}
            movingBackgroundOrbColor={settings.movingBackgroundOrbColor}
            sparklesMaxSize={settings.sparklesMaxSize}
            sparklesMinSize={settings.sparklesMinSize}
            sparklesParticleColor={settings.sparklesParticleColor}
            sparklesParticleDensity={settings.sparklesParticleDensity}
            sparklesSpeed={settings.sparklesSpeed}
            gradientAnimationBackgroundStartColor={settings.gradientAnimationBackgroundStartColor}
            gradientAnimationBackgroundEndColor={settings.gradientAnimationBackgroundEndColor}
            gradientAnimationFirstColor={settings.gradientAnimationFirstColor}
            gradientAnimationSecondColor={settings.gradientAnimationSecondColor}
            gradientAnimationThirdColor={settings.gradientAnimationThirdColor}
            gradientAnimationFourthColor={settings.gradientAnimationFourthColor}
            gradientAnimationFifthColor={settings.gradientAnimationFifthColor}
            gradientAnimationSpeed={settings.gradientAnimationSpeed}
            gradientAnimationSize={settings.gradientAnimationSize}
            massageLabGradientPrimaryColor={settings.massageLabGradientPrimaryColor}
            massageLabGradientHarmony={settings.massageLabGradientHarmony}
            massageLabGradientOpacity={settings.massageLabGradientOpacity}
            massageLabStarsColor={settings.massageLabStarsColor}
            massageLabStarsSpeed={settings.massageLabStarsSpeed}
            massageLabStarsDensity={settings.massageLabStarsDensity}
            massageLabStarsParallax={settings.massageLabStarsParallax}
            massageLabHoleStrokeColor={settings.massageLabHoleStrokeColor}
            massageLabHoleParticleColor={settings.massageLabHoleParticleColor}
            massageLabHoleLineCount={settings.massageLabHoleLineCount}
            massageLabHoleDiscCount={settings.massageLabHoleDiscCount}
            massageLabLightSpeedWarpSpeed={settings.massageLabLightSpeedWarpSpeed}
            massageLabLightSpeedParticleCount={settings.massageLabLightSpeedParticleCount}
            massageLabLightSpeedLightColor={settings.massageLabLightSpeedLightColor}
            massageLabLightSpeedIntensity={settings.massageLabLightSpeedIntensity}
            massageLabLightSpeedRadius={settings.massageLabLightSpeedRadius}
            massageLabLightSpeedCylinderLength={settings.massageLabLightSpeedCylinderLength}
            massageLabElectricMistColor={settings.massageLabElectricMistColor}
            massageLabElectricMistSpeed={settings.massageLabElectricMistSpeed}
            massageLabElectricMistDetail={settings.massageLabElectricMistDetail}
            massageLabElectricMistDistortion={settings.massageLabElectricMistDistortion}
            massageLabElectricMistBrightness={settings.massageLabElectricMistBrightness}
            massageLabAstralFlowPaletteMode={settings.massageLabAstralFlowPaletteMode}
            massageLabAstralFlowPrimaryColor={settings.massageLabAstralFlowPrimaryColor}
            massageLabAstralFlowHarmony={settings.massageLabAstralFlowHarmony}
            massageLabAstralFlowColorOne={settings.massageLabAstralFlowColorOne}
            massageLabAstralFlowColorTwo={settings.massageLabAstralFlowColorTwo}
            massageLabAstralFlowColorThree={settings.massageLabAstralFlowColorThree}
            massageLabAstralFlowSpeed={settings.massageLabAstralFlowSpeed}
            massageLabAstralFlowFlowMin={settings.massageLabAstralFlowFlowMin}
            massageLabAstralFlowFlowMax={settings.massageLabAstralFlowFlowMax}
            massageLabDeepSpaceNebulaPaletteMode={settings.massageLabDeepSpaceNebulaPaletteMode}
            massageLabDeepSpaceNebulaPrimaryColor={settings.massageLabDeepSpaceNebulaPrimaryColor}
            massageLabDeepSpaceNebulaHarmony={settings.massageLabDeepSpaceNebulaHarmony}
            massageLabDeepSpaceNebulaColorOne={settings.massageLabDeepSpaceNebulaColorOne}
            massageLabDeepSpaceNebulaColorTwo={settings.massageLabDeepSpaceNebulaColorTwo}
            massageLabDeepSpaceNebulaColorThree={settings.massageLabDeepSpaceNebulaColorThree}
            massageLabDeepSpaceNebulaSpeed={settings.massageLabDeepSpaceNebulaSpeed}
            massageLabGridBloomColor={settings.massageLabGridBloomColor}
            massageLabGridBloomSpeed={settings.massageLabGridBloomSpeed}
            massageLabGridBloomGridScale={settings.massageLabGridBloomGridScale}
            massageLabGridBloomRotationSpeed={settings.massageLabGridBloomRotationSpeed}
            massageLabGridBloomFadeFalloff={settings.massageLabGridBloomFadeFalloff}
            massageLabGridBloomDistortionAmount={settings.massageLabGridBloomDistortionAmount}
            massageLabGridBloomFlowSpeedX={settings.massageLabGridBloomFlowSpeedX}
            massageLabGridBloomFlowSpeedY={settings.massageLabGridBloomFlowSpeedY}
            massageLabChromeFlowPaletteMode={settings.massageLabChromeFlowPaletteMode}
            massageLabChromeFlowPrimaryColor={settings.massageLabChromeFlowPrimaryColor}
            massageLabChromeFlowHarmony={settings.massageLabChromeFlowHarmony}
            massageLabChromeFlowColorOne={settings.massageLabChromeFlowColorOne}
            massageLabChromeFlowColorTwo={settings.massageLabChromeFlowColorTwo}
            massageLabChromeFlowFlowSpeed={settings.massageLabChromeFlowFlowSpeed}
            massageLabChromeFlowTimeScale={settings.massageLabChromeFlowTimeScale}
            massageLabWaveCurrentPaletteMode={settings.massageLabWaveCurrentPaletteMode}
            massageLabWaveCurrentPrimaryColor={settings.massageLabWaveCurrentPrimaryColor}
            massageLabWaveCurrentHarmony={settings.massageLabWaveCurrentHarmony}
            massageLabWaveCurrentBackgroundColor={settings.massageLabWaveCurrentBackgroundColor}
            massageLabWaveCurrentColorOne={settings.massageLabWaveCurrentColorOne}
            massageLabWaveCurrentColorTwo={settings.massageLabWaveCurrentColorTwo}
            massageLabWaveCurrentColorThree={settings.massageLabWaveCurrentColorThree}
            massageLabWaveCurrentSpeedX={settings.massageLabWaveCurrentSpeedX}
            massageLabWaveCurrentSpeedY={settings.massageLabWaveCurrentSpeedY}
            massageLabWaveCurrentAmplitude={settings.massageLabWaveCurrentAmplitude}
            massageLabFerrofluidPaletteMode={settings.massageLabFerrofluidPaletteMode}
            massageLabFerrofluidPrimaryColor={settings.massageLabFerrofluidPrimaryColor}
            massageLabFerrofluidHarmony={settings.massageLabFerrofluidHarmony}
            massageLabFerrofluidColorOne={settings.massageLabFerrofluidColorOne}
            massageLabFerrofluidColorTwo={settings.massageLabFerrofluidColorTwo}
            massageLabFerrofluidColorThree={settings.massageLabFerrofluidColorThree}
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
            massageLabLightfallPaletteMode={settings.massageLabLightfallPaletteMode}
            massageLabLightfallPrimaryColor={settings.massageLabLightfallPrimaryColor}
            massageLabLightfallHarmony={settings.massageLabLightfallHarmony}
            massageLabLightfallColorOne={settings.massageLabLightfallColorOne}
            massageLabLightfallColorTwo={settings.massageLabLightfallColorTwo}
            massageLabLightfallColorThree={settings.massageLabLightfallColorThree}
            massageLabLightfallBackgroundColor={settings.massageLabLightfallBackgroundColor}
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
            massageLabLiquidEtherPaletteMode={settings.massageLabLiquidEtherPaletteMode}
            massageLabLiquidEtherPrimaryColor={settings.massageLabLiquidEtherPrimaryColor}
            massageLabLiquidEtherHarmony={settings.massageLabLiquidEtherHarmony}
            massageLabLiquidEtherColorOne={settings.massageLabLiquidEtherColorOne}
            massageLabLiquidEtherColorTwo={settings.massageLabLiquidEtherColorTwo}
            massageLabLiquidEtherColorThree={settings.massageLabLiquidEtherColorThree}
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
            massageLabLightPillarPaletteMode={settings.massageLabLightPillarPaletteMode}
            massageLabLightPillarPrimaryColor={settings.massageLabLightPillarPrimaryColor}
            massageLabLightPillarHarmony={settings.massageLabLightPillarHarmony}
            massageLabLightPillarTopColor={settings.massageLabLightPillarTopColor}
            massageLabLightPillarBottomColor={settings.massageLabLightPillarBottomColor}
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
            massageLabSilkPaletteMode={settings.massageLabSilkPaletteMode}
            massageLabSilkPrimaryColor={settings.massageLabSilkPrimaryColor}
            massageLabSilkHarmony={settings.massageLabSilkHarmony}
            massageLabSilkColor={settings.massageLabSilkColor}
            massageLabSilkSpeed={settings.massageLabSilkSpeed}
            massageLabSilkScale={settings.massageLabSilkScale}
            massageLabSilkNoiseIntensity={settings.massageLabSilkNoiseIntensity}
            massageLabSilkRotation={settings.massageLabSilkRotation}
            massageLabFloatingLinesPaletteMode={settings.massageLabFloatingLinesPaletteMode}
            massageLabFloatingLinesPrimaryColor={settings.massageLabFloatingLinesPrimaryColor}
            massageLabFloatingLinesHarmony={settings.massageLabFloatingLinesHarmony}
            massageLabFloatingLinesColorOne={settings.massageLabFloatingLinesColorOne}
            massageLabFloatingLinesColorTwo={settings.massageLabFloatingLinesColorTwo}
            massageLabFloatingLinesColorThree={settings.massageLabFloatingLinesColorThree}
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
            massageLabSideRaysPaletteMode={settings.massageLabSideRaysPaletteMode}
            massageLabSideRaysPrimaryColor={settings.massageLabSideRaysPrimaryColor}
            massageLabSideRaysHarmony={settings.massageLabSideRaysHarmony}
            massageLabSideRaysColorOne={settings.massageLabSideRaysColorOne}
            massageLabSideRaysColorTwo={settings.massageLabSideRaysColorTwo}
            massageLabSideRaysSpeed={settings.massageLabSideRaysSpeed}
            massageLabSideRaysIntensity={settings.massageLabSideRaysIntensity}
            massageLabSideRaysSpread={settings.massageLabSideRaysSpread}
            massageLabSideRaysOrigin={settings.massageLabSideRaysOrigin}
            massageLabSideRaysTilt={settings.massageLabSideRaysTilt}
            massageLabSideRaysSaturation={settings.massageLabSideRaysSaturation}
            massageLabSideRaysBlend={settings.massageLabSideRaysBlend}
            massageLabSideRaysFalloff={settings.massageLabSideRaysFalloff}
            massageLabSideRaysOpacity={settings.massageLabSideRaysOpacity}
            massageLabLightRaysPaletteMode={settings.massageLabLightRaysPaletteMode}
            massageLabLightRaysPrimaryColor={settings.massageLabLightRaysPrimaryColor}
            massageLabLightRaysHarmony={settings.massageLabLightRaysHarmony}
            massageLabLightRaysColor={settings.massageLabLightRaysColor}
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
            massageLabPixelBlastPaletteMode={settings.massageLabPixelBlastPaletteMode}
            massageLabPixelBlastPrimaryColor={settings.massageLabPixelBlastPrimaryColor}
            massageLabPixelBlastHarmony={settings.massageLabPixelBlastHarmony}
            massageLabPixelBlastColor={settings.massageLabPixelBlastColor}
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
            massageLabColorBendsPaletteMode={settings.massageLabColorBendsPaletteMode}
            massageLabColorBendsPrimaryColor={settings.massageLabColorBendsPrimaryColor}
            massageLabColorBendsHarmony={settings.massageLabColorBendsHarmony}
            massageLabColorBendsColorOne={settings.massageLabColorBendsColorOne}
            massageLabColorBendsColorTwo={settings.massageLabColorBendsColorTwo}
            massageLabColorBendsColorThree={settings.massageLabColorBendsColorThree}
            massageLabColorBendsColorFour={settings.massageLabColorBendsColorFour}
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
            massageLabEvilEyePaletteMode={settings.massageLabEvilEyePaletteMode}
            massageLabEvilEyePrimaryColor={settings.massageLabEvilEyePrimaryColor}
            massageLabEvilEyeHarmony={settings.massageLabEvilEyeHarmony}
            massageLabEvilEyeColor={settings.massageLabEvilEyeColor}
            massageLabEvilEyeBackgroundColor={settings.massageLabEvilEyeBackgroundColor}
            massageLabEvilEyeIntensity={settings.massageLabEvilEyeIntensity}
            massageLabEvilEyePupilSize={settings.massageLabEvilEyePupilSize}
            massageLabEvilEyeIrisWidth={settings.massageLabEvilEyeIrisWidth}
            massageLabEvilEyeGlowIntensity={settings.massageLabEvilEyeGlowIntensity}
            massageLabEvilEyeScale={settings.massageLabEvilEyeScale}
            massageLabEvilEyeNoiseScale={settings.massageLabEvilEyeNoiseScale}
            massageLabEvilEyePupilFollow={settings.massageLabEvilEyePupilFollow}
            massageLabEvilEyeFlameSpeed={settings.massageLabEvilEyeFlameSpeed}
            massageLabEvilEyeInteractive={settings.massageLabEvilEyeInteractive}
            massageLabLineWavesPaletteMode={settings.massageLabLineWavesPaletteMode}
            massageLabLineWavesPrimaryColor={settings.massageLabLineWavesPrimaryColor}
            massageLabLineWavesHarmony={settings.massageLabLineWavesHarmony}
            massageLabLineWavesColorOne={settings.massageLabLineWavesColorOne}
            massageLabLineWavesColorTwo={settings.massageLabLineWavesColorTwo}
            massageLabLineWavesColorThree={settings.massageLabLineWavesColorThree}
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
            massageLabRadarPaletteMode={settings.massageLabRadarPaletteMode}
            massageLabRadarPrimaryColor={settings.massageLabRadarPrimaryColor}
            massageLabRadarHarmony={settings.massageLabRadarHarmony}
            massageLabRadarColor={settings.massageLabRadarColor}
            massageLabRadarBackgroundColor={settings.massageLabRadarBackgroundColor}
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
            massageLabSoftAuroraPaletteMode={settings.massageLabSoftAuroraPaletteMode}
            massageLabSoftAuroraPrimaryColor={settings.massageLabSoftAuroraPrimaryColor}
            massageLabSoftAuroraHarmony={settings.massageLabSoftAuroraHarmony}
            massageLabSoftAuroraColorOne={settings.massageLabSoftAuroraColorOne}
            massageLabSoftAuroraColorTwo={settings.massageLabSoftAuroraColorTwo}
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
            massageLabPlasmaPaletteMode={settings.massageLabPlasmaPaletteMode}
            massageLabPlasmaPrimaryColor={settings.massageLabPlasmaPrimaryColor}
            massageLabPlasmaHarmony={settings.massageLabPlasmaHarmony}
            massageLabPlasmaColor={settings.massageLabPlasmaColor}
            massageLabPlasmaSpeed={settings.massageLabPlasmaSpeed}
            massageLabPlasmaDirection={settings.massageLabPlasmaDirection}
            massageLabPlasmaScale={settings.massageLabPlasmaScale}
            massageLabPlasmaOpacity={settings.massageLabPlasmaOpacity}
            massageLabPlasmaMouseInteractive={settings.massageLabPlasmaMouseInteractive}
            massageLabPlasmaWavePaletteMode={settings.massageLabPlasmaWavePaletteMode}
            massageLabPlasmaWavePrimaryColor={settings.massageLabPlasmaWavePrimaryColor}
            massageLabPlasmaWaveHarmony={settings.massageLabPlasmaWaveHarmony}
            massageLabPlasmaWaveColorOne={settings.massageLabPlasmaWaveColorOne}
            massageLabPlasmaWaveColorTwo={settings.massageLabPlasmaWaveColorTwo}
            massageLabPlasmaWaveXOffset={settings.massageLabPlasmaWaveXOffset}
            massageLabPlasmaWaveYOffset={settings.massageLabPlasmaWaveYOffset}
            massageLabPlasmaWaveRotationDeg={settings.massageLabPlasmaWaveRotationDeg}
            massageLabPlasmaWaveFocalLength={settings.massageLabPlasmaWaveFocalLength}
            massageLabPlasmaWaveSpeedOne={settings.massageLabPlasmaWaveSpeedOne}
            massageLabPlasmaWaveSpeedTwo={settings.massageLabPlasmaWaveSpeedTwo}
            massageLabPlasmaWaveDirectionTwo={settings.massageLabPlasmaWaveDirectionTwo}
            massageLabPlasmaWaveBendOne={settings.massageLabPlasmaWaveBendOne}
            massageLabPlasmaWaveBendTwo={settings.massageLabPlasmaWaveBendTwo}
            massageLabParticlesPaletteMode={settings.massageLabParticlesPaletteMode}
            massageLabParticlesPrimaryColor={settings.massageLabParticlesPrimaryColor}
            massageLabParticlesHarmony={settings.massageLabParticlesHarmony}
            massageLabParticlesColorOne={settings.massageLabParticlesColorOne}
            massageLabParticlesColorTwo={settings.massageLabParticlesColorTwo}
            massageLabParticlesColorThree={settings.massageLabParticlesColorThree}
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
            massageLabGradientBlindsPaletteMode={settings.massageLabGradientBlindsPaletteMode}
            massageLabGradientBlindsPrimaryColor={settings.massageLabGradientBlindsPrimaryColor}
            massageLabGradientBlindsHarmony={settings.massageLabGradientBlindsHarmony}
            massageLabGradientBlindsColorOne={settings.massageLabGradientBlindsColorOne}
            massageLabGradientBlindsColorTwo={settings.massageLabGradientBlindsColorTwo}
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
            massageLabGrainientPaletteMode={settings.massageLabGrainientPaletteMode}
            massageLabGrainientPrimaryColor={settings.massageLabGrainientPrimaryColor}
            massageLabGrainientHarmony={settings.massageLabGrainientHarmony}
            massageLabGrainientColorOne={settings.massageLabGrainientColorOne}
            massageLabGrainientColorTwo={settings.massageLabGrainientColorTwo}
            massageLabGrainientColorThree={settings.massageLabGrainientColorThree}
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
            massageLabGridScanPaletteMode={settings.massageLabGridScanPaletteMode}
            massageLabGridScanPrimaryColor={settings.massageLabGridScanPrimaryColor}
            massageLabGridScanHarmony={settings.massageLabGridScanHarmony}
            massageLabGridScanLinesColor={settings.massageLabGridScanLinesColor}
            massageLabGridScanScanColor={settings.massageLabGridScanScanColor}
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
            massageLabBeamsPaletteMode={settings.massageLabBeamsPaletteMode}
            massageLabBeamsPrimaryColor={settings.massageLabBeamsPrimaryColor}
            massageLabBeamsHarmony={settings.massageLabBeamsHarmony}
            massageLabBeamsLightColor={settings.massageLabBeamsLightColor}
            massageLabBeamsBeamWidth={settings.massageLabBeamsBeamWidth}
            massageLabBeamsBeamHeight={settings.massageLabBeamsBeamHeight}
            massageLabBeamsBeamNumber={settings.massageLabBeamsBeamNumber}
            massageLabBeamsSpeed={settings.massageLabBeamsSpeed}
            massageLabBeamsNoiseIntensity={settings.massageLabBeamsNoiseIntensity}
            massageLabBeamsScale={settings.massageLabBeamsScale}
            massageLabBeamsRotation={settings.massageLabBeamsRotation}
            massageLabPixelSnowPaletteMode={settings.massageLabPixelSnowPaletteMode}
            massageLabPixelSnowPrimaryColor={settings.massageLabPixelSnowPrimaryColor}
            massageLabPixelSnowHarmony={settings.massageLabPixelSnowHarmony}
            massageLabPixelSnowColor={settings.massageLabPixelSnowColor}
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
            massageLabLightningPaletteMode={settings.massageLabLightningPaletteMode}
            massageLabLightningPrimaryColor={settings.massageLabLightningPrimaryColor}
            massageLabLightningHarmony={settings.massageLabLightningHarmony}
            massageLabLightningColor={settings.massageLabLightningColor}
            massageLabLightningHue={settings.massageLabLightningHue}
            massageLabLightningXOffset={settings.massageLabLightningXOffset}
            massageLabLightningSpeed={settings.massageLabLightningSpeed}
            massageLabLightningIntensity={settings.massageLabLightningIntensity}
            massageLabLightningSize={settings.massageLabLightningSize}
            massageLabPrismaticBurstPaletteMode={settings.massageLabPrismaticBurstPaletteMode}
            massageLabPrismaticBurstPrimaryColor={settings.massageLabPrismaticBurstPrimaryColor}
            massageLabPrismaticBurstHarmony={settings.massageLabPrismaticBurstHarmony}
            massageLabPrismaticBurstColorOne={settings.massageLabPrismaticBurstColorOne}
            massageLabPrismaticBurstColorTwo={settings.massageLabPrismaticBurstColorTwo}
            massageLabPrismaticBurstColorThree={settings.massageLabPrismaticBurstColorThree}
            massageLabPrismaticBurstColorFour={settings.massageLabPrismaticBurstColorFour}
            massageLabPrismaticBurstIntensity={settings.massageLabPrismaticBurstIntensity}
            massageLabPrismaticBurstSpeed={settings.massageLabPrismaticBurstSpeed}
            massageLabPrismaticBurstAnimationType={settings.massageLabPrismaticBurstAnimationType}
            massageLabPrismaticBurstDistort={settings.massageLabPrismaticBurstDistort}
            massageLabPrismaticBurstOffsetX={settings.massageLabPrismaticBurstOffsetX}
            massageLabPrismaticBurstOffsetY={settings.massageLabPrismaticBurstOffsetY}
            massageLabPrismaticBurstHoverDampness={settings.massageLabPrismaticBurstHoverDampness}
            massageLabPrismaticBurstRayCount={settings.massageLabPrismaticBurstRayCount}
            massageLabPrismaticBurstMixBlendMode={settings.massageLabPrismaticBurstMixBlendMode}
            massageLabGalaxyPaletteMode={settings.massageLabGalaxyPaletteMode}
            massageLabGalaxyPrimaryColor={settings.massageLabGalaxyPrimaryColor}
            massageLabGalaxyHarmony={settings.massageLabGalaxyHarmony}
            massageLabGalaxyColor={settings.massageLabGalaxyColor}
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
            massageLabDitherPaletteMode={settings.massageLabDitherPaletteMode}
            massageLabDitherPrimaryColor={settings.massageLabDitherPrimaryColor}
            massageLabDitherHarmony={settings.massageLabDitherHarmony}
            massageLabDitherColor={settings.massageLabDitherColor}
            massageLabDitherWaveSpeed={settings.massageLabDitherWaveSpeed}
            massageLabDitherWaveFrequency={settings.massageLabDitherWaveFrequency}
            massageLabDitherWaveAmplitude={settings.massageLabDitherWaveAmplitude}
            massageLabDitherColorNum={settings.massageLabDitherColorNum}
            massageLabDitherPixelSize={settings.massageLabDitherPixelSize}
            massageLabDitherMouseInteraction={settings.massageLabDitherMouseInteraction}
            massageLabDitherMouseRadius={settings.massageLabDitherMouseRadius}
            massageLabFaultyTerminalPaletteMode={settings.massageLabFaultyTerminalPaletteMode}
            massageLabFaultyTerminalPrimaryColor={settings.massageLabFaultyTerminalPrimaryColor}
            massageLabFaultyTerminalHarmony={settings.massageLabFaultyTerminalHarmony}
            massageLabFaultyTerminalTint={settings.massageLabFaultyTerminalTint}
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
            massageLabRippleGridPaletteMode={settings.massageLabRippleGridPaletteMode}
            massageLabRippleGridPrimaryColor={settings.massageLabRippleGridPrimaryColor}
            massageLabRippleGridHarmony={settings.massageLabRippleGridHarmony}
            massageLabRippleGridColor={settings.massageLabRippleGridColor}
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
            massageLabDotFieldPaletteMode={settings.massageLabDotFieldPaletteMode}
            massageLabDotFieldPrimaryColor={settings.massageLabDotFieldPrimaryColor}
            massageLabDotFieldHarmony={settings.massageLabDotFieldHarmony}
            massageLabDotFieldGradientFromColor={settings.massageLabDotFieldGradientFromColor}
            massageLabDotFieldGradientFromAlpha={settings.massageLabDotFieldGradientFromAlpha}
            massageLabDotFieldGradientToColor={settings.massageLabDotFieldGradientToColor}
            massageLabDotFieldGradientToAlpha={settings.massageLabDotFieldGradientToAlpha}
            massageLabDotFieldGlowColor={settings.massageLabDotFieldGlowColor}
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
            massageLabDotGridPaletteMode={settings.massageLabDotGridPaletteMode}
            massageLabDotGridPrimaryColor={settings.massageLabDotGridPrimaryColor}
            massageLabDotGridHarmony={settings.massageLabDotGridHarmony}
            massageLabDotGridBaseColor={settings.massageLabDotGridBaseColor}
            massageLabDotGridActiveColor={settings.massageLabDotGridActiveColor}
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
            massageLabThreadsPaletteMode={settings.massageLabThreadsPaletteMode}
            massageLabThreadsPrimaryColor={settings.massageLabThreadsPrimaryColor}
            massageLabThreadsHarmony={settings.massageLabThreadsHarmony}
            massageLabThreadsColor={settings.massageLabThreadsColor}
            massageLabThreadsAmplitude={settings.massageLabThreadsAmplitude}
            massageLabThreadsDistance={settings.massageLabThreadsDistance}
            massageLabThreadsEnableMouseInteraction={settings.massageLabThreadsEnableMouseInteraction}
            massageLabIridescencePaletteMode={settings.massageLabIridescencePaletteMode}
            massageLabIridescencePrimaryColor={settings.massageLabIridescencePrimaryColor}
            massageLabIridescenceHarmony={settings.massageLabIridescenceHarmony}
            massageLabIridescenceColor={settings.massageLabIridescenceColor}
            massageLabIridescenceSpeed={settings.massageLabIridescenceSpeed}
            massageLabIridescenceAmplitude={settings.massageLabIridescenceAmplitude}
            massageLabIridescenceMouseReact={settings.massageLabIridescenceMouseReact}
            massageLabWavesPaletteMode={settings.massageLabWavesPaletteMode}
            massageLabWavesPrimaryColor={settings.massageLabWavesPrimaryColor}
            massageLabWavesHarmony={settings.massageLabWavesHarmony}
            massageLabWavesLineColor={settings.massageLabWavesLineColor}
            massageLabWavesBackgroundColor={settings.massageLabWavesBackgroundColor}
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
            massageLabGridDistortionPaletteMode={settings.massageLabGridDistortionPaletteMode}
            massageLabGridDistortionPrimaryColor={settings.massageLabGridDistortionPrimaryColor}
            massageLabGridDistortionHarmony={settings.massageLabGridDistortionHarmony}
            massageLabGridDistortionColorOne={settings.massageLabGridDistortionColorOne}
            massageLabGridDistortionColorTwo={settings.massageLabGridDistortionColorTwo}
            massageLabGridDistortionColorThree={settings.massageLabGridDistortionColorThree}
            massageLabGridDistortionGrid={settings.massageLabGridDistortionGrid}
            massageLabGridDistortionMouse={settings.massageLabGridDistortionMouse}
            massageLabGridDistortionStrength={settings.massageLabGridDistortionStrength}
            massageLabGridDistortionRelaxation={settings.massageLabGridDistortionRelaxation}
            massageLabGridDistortionCursorInteraction={settings.massageLabGridDistortionCursorInteraction}
            massageLabOrbPaletteMode={settings.massageLabOrbPaletteMode}
            massageLabOrbPrimaryColor={settings.massageLabOrbPrimaryColor}
            massageLabOrbHarmony={settings.massageLabOrbHarmony}
            massageLabOrbColor={settings.massageLabOrbColor}
            massageLabOrbHue={settings.massageLabOrbHue}
            massageLabOrbHoverIntensity={settings.massageLabOrbHoverIntensity}
            massageLabOrbRotateOnHover={settings.massageLabOrbRotateOnHover}
            massageLabOrbForceHoverState={settings.massageLabOrbForceHoverState}
            massageLabOrbBackgroundColor={settings.massageLabOrbBackgroundColor}
            massageLabOrbCursorInteraction={settings.massageLabOrbCursorInteraction}
            massageLabLetterGlitchPaletteMode={settings.massageLabLetterGlitchPaletteMode}
            massageLabLetterGlitchPrimaryColor={settings.massageLabLetterGlitchPrimaryColor}
            massageLabLetterGlitchHarmony={settings.massageLabLetterGlitchHarmony}
            massageLabLetterGlitchColorOne={settings.massageLabLetterGlitchColorOne}
            massageLabLetterGlitchColorTwo={settings.massageLabLetterGlitchColorTwo}
            massageLabLetterGlitchColorThree={settings.massageLabLetterGlitchColorThree}
            massageLabLetterGlitchGlitchSpeed={settings.massageLabLetterGlitchGlitchSpeed}
            massageLabLetterGlitchCenterVignette={settings.massageLabLetterGlitchCenterVignette}
            massageLabLetterGlitchOuterVignette={settings.massageLabLetterGlitchOuterVignette}
            massageLabLetterGlitchSmooth={settings.massageLabLetterGlitchSmooth}
            massageLabLetterGlitchCharacters={settings.massageLabLetterGlitchCharacters}
            massageLabGridMotionPaletteMode={settings.massageLabGridMotionPaletteMode}
            massageLabGridMotionPrimaryColor={settings.massageLabGridMotionPrimaryColor}
            massageLabGridMotionHarmony={settings.massageLabGridMotionHarmony}
            massageLabGridMotionGradientColor={settings.massageLabGridMotionGradientColor}
            massageLabGridMotionTileColor={settings.massageLabGridMotionTileColor}
            massageLabGridMotionTextColor={settings.massageLabGridMotionTextColor}
            massageLabGridMotionMaxMoveAmount={settings.massageLabGridMotionMaxMoveAmount}
            massageLabGridMotionBaseDuration={settings.massageLabGridMotionBaseDuration}
            massageLabGridMotionCursorInteraction={settings.massageLabGridMotionCursorInteraction}
            massageLabShapeGridPaletteMode={settings.massageLabShapeGridPaletteMode}
            massageLabShapeGridPrimaryColor={settings.massageLabShapeGridPrimaryColor}
            massageLabShapeGridHarmony={settings.massageLabShapeGridHarmony}
            massageLabShapeGridBorderColor={settings.massageLabShapeGridBorderColor}
            massageLabShapeGridHoverFillColor={settings.massageLabShapeGridHoverFillColor}
            massageLabShapeGridDirection={settings.massageLabShapeGridDirection}
            massageLabShapeGridSpeed={settings.massageLabShapeGridSpeed}
            massageLabShapeGridSquareSize={settings.massageLabShapeGridSquareSize}
            massageLabShapeGridShape={settings.massageLabShapeGridShape}
            massageLabShapeGridHoverTrailAmount={settings.massageLabShapeGridHoverTrailAmount}
            massageLabShapeGridCursorInteraction={settings.massageLabShapeGridCursorInteraction}
            massageLabLiquidChromePaletteMode={settings.massageLabLiquidChromePaletteMode}
            massageLabLiquidChromePrimaryColor={settings.massageLabLiquidChromePrimaryColor}
            massageLabLiquidChromeHarmony={settings.massageLabLiquidChromeHarmony}
            massageLabLiquidChromeBaseColor={settings.massageLabLiquidChromeBaseColor}
            massageLabLiquidChromeSpeed={settings.massageLabLiquidChromeSpeed}
            massageLabLiquidChromeAmplitude={settings.massageLabLiquidChromeAmplitude}
            massageLabLiquidChromeFrequencyX={settings.massageLabLiquidChromeFrequencyX}
            massageLabLiquidChromeFrequencyY={settings.massageLabLiquidChromeFrequencyY}
            massageLabLiquidChromeInteractive={settings.massageLabLiquidChromeInteractive}
            massageLabBalatroPaletteMode={settings.massageLabBalatroPaletteMode}
            massageLabBalatroPrimaryColor={settings.massageLabBalatroPrimaryColor}
            massageLabBalatroHarmony={settings.massageLabBalatroHarmony}
            massageLabBalatroColorOne={settings.massageLabBalatroColorOne}
            massageLabBalatroColorTwo={settings.massageLabBalatroColorTwo}
            massageLabBalatroColorThree={settings.massageLabBalatroColorThree}
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
            massageLabNovatrixPaletteMode={settings.massageLabNovatrixPaletteMode}
            massageLabNovatrixPrimaryColor={settings.massageLabNovatrixPrimaryColor}
            massageLabNovatrixHarmony={settings.massageLabNovatrixHarmony}
            massageLabNovatrixColor={settings.massageLabNovatrixColor}
            massageLabNovatrixSpeed={settings.massageLabNovatrixSpeed}
            massageLabNovatrixAmplitude={settings.massageLabNovatrixAmplitude}
            massageLabMatrixRainPaletteMode={settings.massageLabMatrixRainPaletteMode}
            massageLabMatrixRainPrimaryColor={settings.massageLabMatrixRainPrimaryColor}
            massageLabMatrixRainHarmony={settings.massageLabMatrixRainHarmony}
            massageLabMatrixRainColor={settings.massageLabMatrixRainColor}
            massageLabMatrixRainSpeed={settings.massageLabMatrixRainSpeed}
            massageLabMatrixRainFontSize={settings.massageLabMatrixRainFontSize}
            massageLabPhotonBeamPaletteMode={settings.massageLabPhotonBeamPaletteMode}
            massageLabPhotonBeamPrimaryColor={settings.massageLabPhotonBeamPrimaryColor}
            massageLabPhotonBeamHarmony={settings.massageLabPhotonBeamHarmony}
            massageLabPhotonBeamColorBg={settings.massageLabPhotonBeamColorBg}
            massageLabPhotonBeamColorLine={settings.massageLabPhotonBeamColorLine}
            massageLabPhotonBeamColorSignal={settings.massageLabPhotonBeamColorSignal}
            massageLabPhotonBeamUseColor2={settings.massageLabPhotonBeamUseColor2}
            massageLabPhotonBeamColorSignal2={settings.massageLabPhotonBeamColorSignal2}
            massageLabPhotonBeamUseColor3={settings.massageLabPhotonBeamUseColor3}
            massageLabPhotonBeamColorSignal3={settings.massageLabPhotonBeamColorSignal3}
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
            massageLab3DGlobeBackgroundColor={settings.massageLab3DGlobeBackgroundColor}
            massageLab3DGlobeGlobeColor={settings.massageLab3DGlobeGlobeColor}
            massageLab3DGlobeGraphicMapColor={settings.massageLab3DGlobeGraphicMapColor}
            massageLab3DGlobeGraphicGlowColor={settings.massageLab3DGlobeGraphicGlowColor}
            massageLab3DGlobeGraphicMarkerColor={settings.massageLab3DGlobeGraphicMarkerColor}
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
            massageLab3DGlobeAtmosphereColor={settings.massageLab3DGlobeAtmosphereColor}
            massageLab3DGlobeAtmosphereIntensity={settings.massageLab3DGlobeAtmosphereIntensity}
            massageLab3DGlobeAtmosphereBlur={settings.massageLab3DGlobeAtmosphereBlur}
            massageLab3DGlobeShowWireframe={settings.massageLab3DGlobeShowWireframe}
            massageLab3DGlobeWireframeColor={settings.massageLab3DGlobeWireframeColor}
            massageLab3DGlobeMarkerEnabled={settings.massageLab3DGlobeMarkerEnabled}
            massageLab3DGlobeMarkerLat={settings.massageLab3DGlobeMarkerLat}
            massageLab3DGlobeMarkerLng={settings.massageLab3DGlobeMarkerLng}
            massageLab3DGlobeMarkerLabel={settings.massageLab3DGlobeMarkerLabel}
            massageLab3DGlobeMarkerIcon={settings.massageLab3DGlobeMarkerIcon}
            massageLab3DGlobeMarkerSize={settings.massageLab3DGlobeMarkerSize}
            massageLabRetroGridBackgroundColor={settings.massageLabRetroGridBackgroundColor}
            massageLabRetroGridLightLineColor={settings.massageLabRetroGridLightLineColor}
            massageLabRetroGridDarkLineColor={settings.massageLabRetroGridDarkLineColor}
            massageLabRetroGridAngle={settings.massageLabRetroGridAngle}
            massageLabRetroGridCellSize={settings.massageLabRetroGridCellSize}
            massageLabRetroGridOpacity={settings.massageLabRetroGridOpacity}
            massageLabAerialRaysBackgroundColor={settings.massageLabAerialRaysBackgroundColor}
            massageLabAerialRaysColor={settings.massageLabAerialRaysColor}
            massageLabAerialRaysCount={settings.massageLabAerialRaysCount}
            massageLabAerialRaysBlur={settings.massageLabAerialRaysBlur}
            massageLabAerialRaysSpeed={settings.massageLabAerialRaysSpeed}
            massageLabAerialRaysLength={settings.massageLabAerialRaysLength}
            massageLabAerialRaysOpacity={settings.massageLabAerialRaysOpacity}
            massageLabSynthesisPaletteMode={settings.massageLabSynthesisPaletteMode}
            massageLabSynthesisPrimaryColor={settings.massageLabSynthesisPrimaryColor}
            massageLabSynthesisHarmony={settings.massageLabSynthesisHarmony}
            massageLabSynthesisColorOne={settings.massageLabSynthesisColorOne}
            massageLabSynthesisColorTwo={settings.massageLabSynthesisColorTwo}
            massageLabSynthesisColorThree={settings.massageLabSynthesisColorThree}
            massageLabSynthesisSpeed={settings.massageLabSynthesisSpeed}
            massageLabSynthesisComplexity={settings.massageLabSynthesisComplexity}
            massageLabSynthesisScale={settings.massageLabSynthesisScale}
            massageLabSynthesisDistortion={settings.massageLabSynthesisDistortion}
            massageLabSynthesisGlowIntensity={settings.massageLabSynthesisGlowIntensity}
            massageLabSynthesisFlowFrequency={settings.massageLabSynthesisFlowFrequency}
            backgroundLinesDuration={settings.backgroundLinesDuration}
            shootingStarsStarColor={settings.shootingStarsStarColor}
            shootingStarsTrailColor={settings.shootingStarsTrailColor}
            shootingStarsShootingStarColor={settings.shootingStarsShootingStarColor}
            shootingStarsDensity={settings.shootingStarsDensity}
            shootingStarsTwinkle={settings.shootingStarsTwinkle}
            shootingStarsTwinkleSpeed={settings.shootingStarsTwinkleSpeed}
            shootingStarsShootingSpeed={settings.shootingStarsShootingSpeed}
            shootingStarsFrequency={settings.shootingStarsFrequency}
            canvasRevealDotsBackgroundColor={settings.canvasRevealDotsBackgroundColor}
            canvasRevealDotsDotColor={settings.canvasRevealDotsDotColor}
            canvasRevealDotsAccentColor={settings.canvasRevealDotsAccentColor}
            canvasRevealDotsDotSize={settings.canvasRevealDotsDotSize}
            canvasRevealDotsDotSpacing={settings.canvasRevealDotsDotSpacing}
            canvasRevealDotsOpacity={settings.canvasRevealDotsOpacity}
            canvasRevealDotsAnimationSpeed={settings.canvasRevealDotsAnimationSpeed}
            canvasRevealDotsShowGradient={settings.canvasRevealDotsShowGradient}
            spotlightColor={settings.spotlightColor}
            spotlightOpacity={settings.spotlightOpacity}
            spotlightWidth={settings.spotlightWidth}
            spotlightHeight={settings.spotlightHeight}
            spotlightSmallWidth={settings.spotlightSmallWidth}
            spotlightTranslateY={settings.spotlightTranslateY}
            spotlightDuration={settings.spotlightDuration}
            spotlightXOffset={settings.spotlightXOffset}
            lampBackgroundColor={settings.lampBackgroundColor}
            lampColor={settings.lampColor}
            lampGlowOpacity={settings.lampGlowOpacity}
            lampBeamWidth={settings.lampBeamWidth}
            lampGlowWidth={settings.lampGlowWidth}
            lampVerticalOffset={settings.lampVerticalOffset}
            lampPulseSpeed={settings.lampPulseSpeed}
            vortexBackgroundColor={settings.vortexBackgroundColor}
            vortexBaseHue={settings.vortexBaseHue}
            vortexParticleCount={settings.vortexParticleCount}
            vortexRangeY={settings.vortexRangeY}
            vortexBaseSpeed={settings.vortexBaseSpeed}
            vortexRangeSpeed={settings.vortexRangeSpeed}
            vortexBaseRadius={settings.vortexBaseRadius}
            vortexRangeRadius={settings.vortexRangeRadius}
            wavyBackgroundFill={settings.wavyBackgroundFill}
            wavyColorOne={settings.wavyColorOne}
            wavyColorTwo={settings.wavyColorTwo}
            wavyColorThree={settings.wavyColorThree}
            wavyColorFour={settings.wavyColorFour}
            wavyColorFive={settings.wavyColorFive}
            wavyWaveWidth={settings.wavyWaveWidth}
            wavyBlur={settings.wavyBlur}
            wavySpeed={settings.wavySpeed}
            wavyWaveOpacity={settings.wavyWaveOpacity}
            auroraBarsBackgroundColor={settings.auroraBarsBackgroundColor}
            auroraBarsPaletteMode={settings.auroraBarsPaletteMode}
            auroraBarsPrimaryColor={settings.auroraBarsPrimaryColor}
            auroraBarsColorOne={settings.auroraBarsColorOne}
            auroraBarsColorTwo={settings.auroraBarsColorTwo}
            auroraBarsColorThree={settings.auroraBarsColorThree}
            auroraBarsColorFour={settings.auroraBarsColorFour}
            auroraBarsColorFive={settings.auroraBarsColorFive}
            auroraBarsBarCount={settings.auroraBarsBarCount}
            auroraBarsSpeed={settings.auroraBarsSpeed}
            auroraBarsBlur={settings.auroraBarsBlur}
            auroraBarsGap={settings.auroraBarsGap}
            auroraBarsMaxHeightRatio={settings.auroraBarsMaxHeightRatio}
            auroraBarsMinHeightRatio={settings.auroraBarsMinHeightRatio}
            pixelLiquidBackgroundColor={settings.pixelLiquidBackgroundColor}
            pixelLiquidBaseColor={settings.pixelLiquidBaseColor}
            pixelLiquidAccentColor={settings.pixelLiquidAccentColor}
            pixelLiquidHighlightColor={settings.pixelLiquidHighlightColor}
            pixelLiquidPixelSize={settings.pixelLiquidPixelSize}
            pixelLiquidDetail={settings.pixelLiquidDetail}
            pixelLiquidMotionSpeed={settings.pixelLiquidMotionSpeed}
            tileGridPaletteMode={settings.tileGridPaletteMode}
            tileGridPrimaryColor={settings.tileGridPrimaryColor}
            tileGridColorOne={settings.tileGridColorOne}
            tileGridColorTwo={settings.tileGridColorTwo}
            tileGridColorThree={settings.tileGridColorThree}
            tileGridColorFour={settings.tileGridColorFour}
            tileGridColorFive={settings.tileGridColorFive}
            tileGridTileSize={settings.tileGridTileSize}
            tileGridJointSize={settings.tileGridJointSize}
            tileGridChangeFrequency={settings.tileGridChangeFrequency}
            tileGridActivePercent={settings.tileGridActivePercent}
            tileGridOpacity={settings.tileGridOpacity}
            hexGridPrimaryColor={settings.hexGridPrimaryColor}
            hexGridHarmony={settings.hexGridHarmony}
            hexGridHexSize={settings.hexGridHexSize}
            hexGridJointSize={settings.hexGridJointSize}
            hexGridChangeFrequency={settings.hexGridChangeFrequency}
            hexGridActivePercent={settings.hexGridActivePercent}
            hexGridOpacity={settings.hexGridOpacity}
            canUseCustomColors={canUseCustomColors}
            canUseAccountColorControls={canUseAccountColorControls}
            featureKeys={featureKeys}
            activeIntervalMinutes={timerState.intervalMs ? Math.max(1, Math.round(timerState.intervalMs / 60_000)) : null}
            onPause={togglePause}
            onFullscreen={toggleFullscreen}
            onSettingsChange={updateSettings}
            onFontSizeChange={setFontSize}
            onAdjustActiveRemainingMinutes={adjustActiveRemainingMinutes}
            onSetActiveRemainingDuration={setActiveRemainingDuration}
            onSetActiveIntervalMinutes={setActiveIntervalMinutes}
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
