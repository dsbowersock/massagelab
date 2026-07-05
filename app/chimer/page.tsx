"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { usePathname } from "next/navigation"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
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
import { SetTimer, type ChimerSettings } from "./set-timer"
import { RunningTimer } from "./running-timer"

type TimerStatus = "idle" | "running" | "paused" | "complete" | "clock"
type AccountSyncStatus = "checking" | "local" | "synced" | "conflict"

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
  const startsInClockMode = pathname === "/clock" || pathname.startsWith("/clock/")
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
  const [hasLoadedSettings, setHasLoadedSettings] = useState(false)
  const [canSync, setCanSync] = useState(false)
  const [accountSyncStatus, setAccountSyncStatus] = useState<AccountSyncStatus>("checking")
  const [accountSettings, setAccountSettings] = useState<ChimerSettings | null>(null)
  const [isResolvingSync, setIsResolvingSync] = useState(false)
  const [featureKeys, setFeatureKeys] = useState<string[]>([])

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
  const shouldKeepScreenAwake =
    timerState.status === "clock" || (timerState.status !== "idle" && settings.keepTimerScreenAwake)

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
          const nextSettings = sanitizeChimerSettingsForEntitlements(preferences.chimerSettings, nextFeatureKeys) as ChimerSettings
          if (areChimerSettingsEqual(localSettings, nextSettings)) {
            setSettings(nextSettings)
            window.localStorage.setItem(CHIMER_STORAGE_KEY, JSON.stringify(nextSettings))
            setCanSync(true)
            setAccountSyncStatus("synced")
            return
          }

          setAccountSettings(nextSettings)
          setCanSync(false)
          setAccountSyncStatus("conflict")
          return
        }

        const seedSettings = sanitizeChimerSettingsForEntitlements(localSettings, nextFeatureKeys) as ChimerSettings
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
      return
    }

    const request = wakeLock.request("screen")
      .then((sentinel) => {
        if (!shouldKeepWakeLockRef.current || document.visibilityState !== "visible") {
          void sentinel.release().catch(() => undefined)
          return
        }

        sentinel.onrelease = () => {
          if (wakeLockRef.current === sentinel) {
            wakeLockRef.current = null
          }
        }
        wakeLockRef.current = sentinel
      })
      .catch(() => undefined)

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

  const playChime = useCallback(() => {
    const context = audioContextRef.current
    if (!context || context.state !== "running") {
      if (timerStateRef.current.status !== "idle") {
        setError("Audio is not ready yet. Tap Test Alert or restart the timer.")
      }
      return
    }

    const now = context.currentTime
    const gain = context.createGain()
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.14, now + 0.02)
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
    const alertType = settingsRef.current.alertType

    if (alertType === "chime" || alertType === "both") {
      playChime()
    }

    if (alertType === "flash" || alertType === "both") {
      showFlashAlert()
    }
  }, [playChime, showFlashAlert])

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
    setSettings((current) => sanitizeChimerSettingsForEntitlements(
      { ...current, ...nextSettings },
      featureKeysRef.current,
    ) as ChimerSettings)
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
    if ((alertType === "chime" || alertType === "both") && !(await unlockAudio())) {
      setError("Audio could not be started by this browser. Check site sound permissions and try Test Alert again.")
      if (alertType === "both") {
        showFlashAlert()
      }
      return
    }
    triggerAlert()
  }

  const startTimer = async () => {
    const totalMs = getTotalTimerMs(settings.hours, settings.minutes)
    if (totalMs <= 0) {
      setError("Set a duration greater than zero.")
      return
    }

    const alertType = settings.alertType
    if ((alertType === "chime" || alertType === "both") && !(await unlockAudio())) {
      setError("Audio could not be started by this browser. The timer will run, but the chime may not sound.")
    } else {
      setError(null)
    }

    const now = Date.now()
    const intervalMs = getIntervalMs(settings, totalMs)
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
  const canUseCustomColors = featureKeys.includes(FEATURE_KEYS.chimerCustomColors)
  const backgroundCategory = startsInClockMode ? "clock" : "chimer"

  return (
    <div className="relative min-h-full bg-background p-4 sm:p-6 lg:p-8">
      <div className="relative z-10 mx-auto max-w-5xl">
        {!isTimerActive ? (
          <SetTimer
            settings={settings}
            totalDurationMs={totalDurationMs}
            error={error}
            syncStatus={accountSyncStatus}
            isResolvingSync={isResolvingSync}
            featureKeys={featureKeys}
            backgroundCategory={backgroundCategory}
            onTimeClick={openTimeModal}
            onSettingsChange={updateSettings}
            onStartTimer={startTimer}
            onStartClock={startClock}
            onTestAlert={testAlert}
            onUseDeviceSettings={useDeviceSettingsForAccount}
            onUseSavedSettings={useSavedAccountSettings}
          />
        ) : (
          <RunningTimer
            timeDisplay={timeDisplay}
            activeTimeDisplay={activeTimeDisplay}
            currentTime={currentTime}
            status={timerState.status as "running" | "paused" | "complete" | "clock"}
            isFullscreen={isFullscreen}
            isAlerting={isAlerting}
            fontSize={fontSize}
            movingBackgroundEnabled={settings.movingBackgroundEnabled}
            backgroundId={settings.backgroundId}
            keepTimerScreenAwake={settings.keepTimerScreenAwake}
            showTimerSeconds={settings.showTimerSeconds}
            showCurrentTimeSeconds={settings.showCurrentTimeSeconds}
            timeFormat={settings.timeFormat}
            primaryFontColor={settings.primaryFontColor}
            secondaryFontColor={settings.secondaryFontColor}
            clockModeFontColor={settings.clockModeFontColor}
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
            animateUiGradientPrimaryColor={settings.animateUiGradientPrimaryColor}
            animateUiGradientHarmony={settings.animateUiGradientHarmony}
            animateUiGradientOpacity={settings.animateUiGradientOpacity}
            animateUiStarsColor={settings.animateUiStarsColor}
            animateUiStarsSpeed={settings.animateUiStarsSpeed}
            animateUiStarsDensity={settings.animateUiStarsDensity}
            animateUiStarsParallax={settings.animateUiStarsParallax}
            animateUiHoleStrokeColor={settings.animateUiHoleStrokeColor}
            animateUiHoleParticleColor={settings.animateUiHoleParticleColor}
            animateUiHoleLineCount={settings.animateUiHoleLineCount}
            animateUiHoleDiscCount={settings.animateUiHoleDiscCount}
            chamaacLightSpeedWarpSpeed={settings.chamaacLightSpeedWarpSpeed}
            chamaacLightSpeedParticleCount={settings.chamaacLightSpeedParticleCount}
            chamaacLightSpeedLightColor={settings.chamaacLightSpeedLightColor}
            chamaacLightSpeedIntensity={settings.chamaacLightSpeedIntensity}
            chamaacLightSpeedRadius={settings.chamaacLightSpeedRadius}
            chamaacLightSpeedCylinderLength={settings.chamaacLightSpeedCylinderLength}
            chamaacElectricMistColor={settings.chamaacElectricMistColor}
            chamaacElectricMistSpeed={settings.chamaacElectricMistSpeed}
            chamaacElectricMistDetail={settings.chamaacElectricMistDetail}
            chamaacElectricMistDistortion={settings.chamaacElectricMistDistortion}
            chamaacElectricMistBrightness={settings.chamaacElectricMistBrightness}
            chamaacAstralFlowPaletteMode={settings.chamaacAstralFlowPaletteMode}
            chamaacAstralFlowPrimaryColor={settings.chamaacAstralFlowPrimaryColor}
            chamaacAstralFlowHarmony={settings.chamaacAstralFlowHarmony}
            chamaacAstralFlowColorOne={settings.chamaacAstralFlowColorOne}
            chamaacAstralFlowColorTwo={settings.chamaacAstralFlowColorTwo}
            chamaacAstralFlowColorThree={settings.chamaacAstralFlowColorThree}
            chamaacAstralFlowSpeed={settings.chamaacAstralFlowSpeed}
            chamaacAstralFlowFlowMin={settings.chamaacAstralFlowFlowMin}
            chamaacAstralFlowFlowMax={settings.chamaacAstralFlowFlowMax}
            chamaacDeepSpaceNebulaPaletteMode={settings.chamaacDeepSpaceNebulaPaletteMode}
            chamaacDeepSpaceNebulaPrimaryColor={settings.chamaacDeepSpaceNebulaPrimaryColor}
            chamaacDeepSpaceNebulaHarmony={settings.chamaacDeepSpaceNebulaHarmony}
            chamaacDeepSpaceNebulaColorOne={settings.chamaacDeepSpaceNebulaColorOne}
            chamaacDeepSpaceNebulaColorTwo={settings.chamaacDeepSpaceNebulaColorTwo}
            chamaacDeepSpaceNebulaColorThree={settings.chamaacDeepSpaceNebulaColorThree}
            chamaacDeepSpaceNebulaSpeed={settings.chamaacDeepSpaceNebulaSpeed}
            chamaacGridBloomColor={settings.chamaacGridBloomColor}
            chamaacGridBloomSpeed={settings.chamaacGridBloomSpeed}
            chamaacGridBloomGridScale={settings.chamaacGridBloomGridScale}
            chamaacGridBloomRotationSpeed={settings.chamaacGridBloomRotationSpeed}
            chamaacGridBloomFadeFalloff={settings.chamaacGridBloomFadeFalloff}
            chamaacGridBloomDistortionAmount={settings.chamaacGridBloomDistortionAmount}
            chamaacGridBloomFlowSpeedX={settings.chamaacGridBloomFlowSpeedX}
            chamaacGridBloomFlowSpeedY={settings.chamaacGridBloomFlowSpeedY}
            chamaacLiquidChromePaletteMode={settings.chamaacLiquidChromePaletteMode}
            chamaacLiquidChromePrimaryColor={settings.chamaacLiquidChromePrimaryColor}
            chamaacLiquidChromeHarmony={settings.chamaacLiquidChromeHarmony}
            chamaacLiquidChromeColorOne={settings.chamaacLiquidChromeColorOne}
            chamaacLiquidChromeColorTwo={settings.chamaacLiquidChromeColorTwo}
            chamaacLiquidChromeFlowSpeed={settings.chamaacLiquidChromeFlowSpeed}
            chamaacLiquidChromeTimeScale={settings.chamaacLiquidChromeTimeScale}
            chamaacWavesPaletteMode={settings.chamaacWavesPaletteMode}
            chamaacWavesPrimaryColor={settings.chamaacWavesPrimaryColor}
            chamaacWavesHarmony={settings.chamaacWavesHarmony}
            chamaacWavesBackgroundColor={settings.chamaacWavesBackgroundColor}
            chamaacWavesColorOne={settings.chamaacWavesColorOne}
            chamaacWavesColorTwo={settings.chamaacWavesColorTwo}
            chamaacWavesColorThree={settings.chamaacWavesColorThree}
            chamaacWavesSpeedX={settings.chamaacWavesSpeedX}
            chamaacWavesSpeedY={settings.chamaacWavesSpeedY}
            chamaacWavesAmplitude={settings.chamaacWavesAmplitude}
            reactBitsFerrofluidPaletteMode={settings.reactBitsFerrofluidPaletteMode}
            reactBitsFerrofluidPrimaryColor={settings.reactBitsFerrofluidPrimaryColor}
            reactBitsFerrofluidHarmony={settings.reactBitsFerrofluidHarmony}
            reactBitsFerrofluidColorOne={settings.reactBitsFerrofluidColorOne}
            reactBitsFerrofluidColorTwo={settings.reactBitsFerrofluidColorTwo}
            reactBitsFerrofluidColorThree={settings.reactBitsFerrofluidColorThree}
            reactBitsFerrofluidSpeed={settings.reactBitsFerrofluidSpeed}
            reactBitsFerrofluidScale={settings.reactBitsFerrofluidScale}
            reactBitsFerrofluidTurbulence={settings.reactBitsFerrofluidTurbulence}
            reactBitsFerrofluidFluidity={settings.reactBitsFerrofluidFluidity}
            reactBitsFerrofluidRimWidth={settings.reactBitsFerrofluidRimWidth}
            reactBitsFerrofluidSharpness={settings.reactBitsFerrofluidSharpness}
            reactBitsFerrofluidShimmer={settings.reactBitsFerrofluidShimmer}
            reactBitsFerrofluidGlow={settings.reactBitsFerrofluidGlow}
            reactBitsFerrofluidFlowDirection={settings.reactBitsFerrofluidFlowDirection}
            reactBitsFerrofluidOpacity={settings.reactBitsFerrofluidOpacity}
            reactBitsLightfallPaletteMode={settings.reactBitsLightfallPaletteMode}
            reactBitsLightfallPrimaryColor={settings.reactBitsLightfallPrimaryColor}
            reactBitsLightfallHarmony={settings.reactBitsLightfallHarmony}
            reactBitsLightfallColorOne={settings.reactBitsLightfallColorOne}
            reactBitsLightfallColorTwo={settings.reactBitsLightfallColorTwo}
            reactBitsLightfallColorThree={settings.reactBitsLightfallColorThree}
            reactBitsLightfallBackgroundColor={settings.reactBitsLightfallBackgroundColor}
            reactBitsLightfallSpeed={settings.reactBitsLightfallSpeed}
            reactBitsLightfallStreakCount={settings.reactBitsLightfallStreakCount}
            reactBitsLightfallStreakWidth={settings.reactBitsLightfallStreakWidth}
            reactBitsLightfallStreakLength={settings.reactBitsLightfallStreakLength}
            reactBitsLightfallGlow={settings.reactBitsLightfallGlow}
            reactBitsLightfallDensity={settings.reactBitsLightfallDensity}
            reactBitsLightfallTwinkle={settings.reactBitsLightfallTwinkle}
            reactBitsLightfallZoom={settings.reactBitsLightfallZoom}
            reactBitsLightfallBackgroundGlow={settings.reactBitsLightfallBackgroundGlow}
            reactBitsLightfallOpacity={settings.reactBitsLightfallOpacity}
            reactBitsLightfallCursorEnabled={settings.reactBitsLightfallCursorEnabled}
            reactBitsLightfallCursorStrength={settings.reactBitsLightfallCursorStrength}
            reactBitsLightfallCursorRadius={settings.reactBitsLightfallCursorRadius}
            reactBitsLightfallCursorDampening={settings.reactBitsLightfallCursorDampening}
            reactBitsLiquidEtherPaletteMode={settings.reactBitsLiquidEtherPaletteMode}
            reactBitsLiquidEtherPrimaryColor={settings.reactBitsLiquidEtherPrimaryColor}
            reactBitsLiquidEtherHarmony={settings.reactBitsLiquidEtherHarmony}
            reactBitsLiquidEtherColorOne={settings.reactBitsLiquidEtherColorOne}
            reactBitsLiquidEtherColorTwo={settings.reactBitsLiquidEtherColorTwo}
            reactBitsLiquidEtherColorThree={settings.reactBitsLiquidEtherColorThree}
            reactBitsLiquidEtherCursorEnabled={settings.reactBitsLiquidEtherCursorEnabled}
            reactBitsLiquidEtherMouseForce={settings.reactBitsLiquidEtherMouseForce}
            reactBitsLiquidEtherCursorSize={settings.reactBitsLiquidEtherCursorSize}
            reactBitsLiquidEtherIsViscous={settings.reactBitsLiquidEtherIsViscous}
            reactBitsLiquidEtherViscous={settings.reactBitsLiquidEtherViscous}
            reactBitsLiquidEtherIterationsViscous={settings.reactBitsLiquidEtherIterationsViscous}
            reactBitsLiquidEtherIterationsPoisson={settings.reactBitsLiquidEtherIterationsPoisson}
            reactBitsLiquidEtherDt={settings.reactBitsLiquidEtherDt}
            reactBitsLiquidEtherBfecc={settings.reactBitsLiquidEtherBfecc}
            reactBitsLiquidEtherResolution={settings.reactBitsLiquidEtherResolution}
            reactBitsLiquidEtherIsBounce={settings.reactBitsLiquidEtherIsBounce}
            reactBitsLiquidEtherAutoDemo={settings.reactBitsLiquidEtherAutoDemo}
            reactBitsLiquidEtherAutoSpeed={settings.reactBitsLiquidEtherAutoSpeed}
            reactBitsLiquidEtherAutoIntensity={settings.reactBitsLiquidEtherAutoIntensity}
            reactBitsLiquidEtherAutoResumeDelay={settings.reactBitsLiquidEtherAutoResumeDelay}
            reactBitsLiquidEtherAutoRampDuration={settings.reactBitsLiquidEtherAutoRampDuration}
            reactBitsLiquidEtherOpacity={settings.reactBitsLiquidEtherOpacity}
            reactBitsPrismHeight={settings.reactBitsPrismHeight}
            reactBitsPrismBaseWidth={settings.reactBitsPrismBaseWidth}
            reactBitsPrismAnimationType={settings.reactBitsPrismAnimationType}
            reactBitsPrismGlow={settings.reactBitsPrismGlow}
            reactBitsPrismOffsetX={settings.reactBitsPrismOffsetX}
            reactBitsPrismOffsetY={settings.reactBitsPrismOffsetY}
            reactBitsPrismNoise={settings.reactBitsPrismNoise}
            reactBitsPrismTransparent={settings.reactBitsPrismTransparent}
            reactBitsPrismScale={settings.reactBitsPrismScale}
            reactBitsPrismHueShift={settings.reactBitsPrismHueShift}
            reactBitsPrismColorFrequency={settings.reactBitsPrismColorFrequency}
            reactBitsPrismHoverStrength={settings.reactBitsPrismHoverStrength}
            reactBitsPrismInertia={settings.reactBitsPrismInertia}
            reactBitsPrismBloom={settings.reactBitsPrismBloom}
            reactBitsPrismTimeScale={settings.reactBitsPrismTimeScale}
            reactBitsDarkVeilHueShift={settings.reactBitsDarkVeilHueShift}
            reactBitsDarkVeilNoiseIntensity={settings.reactBitsDarkVeilNoiseIntensity}
            reactBitsDarkVeilScanlineIntensity={settings.reactBitsDarkVeilScanlineIntensity}
            reactBitsDarkVeilSpeed={settings.reactBitsDarkVeilSpeed}
            reactBitsDarkVeilScanlineFrequency={settings.reactBitsDarkVeilScanlineFrequency}
            reactBitsDarkVeilWarpAmount={settings.reactBitsDarkVeilWarpAmount}
            reactBitsDarkVeilResolutionScale={settings.reactBitsDarkVeilResolutionScale}
            reactBitsLightPillarPaletteMode={settings.reactBitsLightPillarPaletteMode}
            reactBitsLightPillarPrimaryColor={settings.reactBitsLightPillarPrimaryColor}
            reactBitsLightPillarHarmony={settings.reactBitsLightPillarHarmony}
            reactBitsLightPillarTopColor={settings.reactBitsLightPillarTopColor}
            reactBitsLightPillarBottomColor={settings.reactBitsLightPillarBottomColor}
            reactBitsLightPillarIntensity={settings.reactBitsLightPillarIntensity}
            reactBitsLightPillarRotationSpeed={settings.reactBitsLightPillarRotationSpeed}
            reactBitsLightPillarInteractive={settings.reactBitsLightPillarInteractive}
            reactBitsLightPillarGlowAmount={settings.reactBitsLightPillarGlowAmount}
            reactBitsLightPillarWidth={settings.reactBitsLightPillarWidth}
            reactBitsLightPillarHeight={settings.reactBitsLightPillarHeight}
            reactBitsLightPillarNoiseIntensity={settings.reactBitsLightPillarNoiseIntensity}
            reactBitsLightPillarBlendMode={settings.reactBitsLightPillarBlendMode}
            reactBitsLightPillarRotation={settings.reactBitsLightPillarRotation}
            reactBitsLightPillarQuality={settings.reactBitsLightPillarQuality}
            reactBitsSilkPaletteMode={settings.reactBitsSilkPaletteMode}
            reactBitsSilkPrimaryColor={settings.reactBitsSilkPrimaryColor}
            reactBitsSilkHarmony={settings.reactBitsSilkHarmony}
            reactBitsSilkColor={settings.reactBitsSilkColor}
            reactBitsSilkSpeed={settings.reactBitsSilkSpeed}
            reactBitsSilkScale={settings.reactBitsSilkScale}
            reactBitsSilkNoiseIntensity={settings.reactBitsSilkNoiseIntensity}
            reactBitsSilkRotation={settings.reactBitsSilkRotation}
            reactBitsFloatingLinesPaletteMode={settings.reactBitsFloatingLinesPaletteMode}
            reactBitsFloatingLinesPrimaryColor={settings.reactBitsFloatingLinesPrimaryColor}
            reactBitsFloatingLinesHarmony={settings.reactBitsFloatingLinesHarmony}
            reactBitsFloatingLinesColorOne={settings.reactBitsFloatingLinesColorOne}
            reactBitsFloatingLinesColorTwo={settings.reactBitsFloatingLinesColorTwo}
            reactBitsFloatingLinesColorThree={settings.reactBitsFloatingLinesColorThree}
            reactBitsFloatingLinesEnableTop={settings.reactBitsFloatingLinesEnableTop}
            reactBitsFloatingLinesEnableMiddle={settings.reactBitsFloatingLinesEnableMiddle}
            reactBitsFloatingLinesEnableBottom={settings.reactBitsFloatingLinesEnableBottom}
            reactBitsFloatingLinesTopLineCount={settings.reactBitsFloatingLinesTopLineCount}
            reactBitsFloatingLinesMiddleLineCount={settings.reactBitsFloatingLinesMiddleLineCount}
            reactBitsFloatingLinesBottomLineCount={settings.reactBitsFloatingLinesBottomLineCount}
            reactBitsFloatingLinesTopLineDistance={settings.reactBitsFloatingLinesTopLineDistance}
            reactBitsFloatingLinesMiddleLineDistance={settings.reactBitsFloatingLinesMiddleLineDistance}
            reactBitsFloatingLinesBottomLineDistance={settings.reactBitsFloatingLinesBottomLineDistance}
            reactBitsFloatingLinesTopWaveX={settings.reactBitsFloatingLinesTopWaveX}
            reactBitsFloatingLinesTopWaveY={settings.reactBitsFloatingLinesTopWaveY}
            reactBitsFloatingLinesTopWaveRotate={settings.reactBitsFloatingLinesTopWaveRotate}
            reactBitsFloatingLinesMiddleWaveX={settings.reactBitsFloatingLinesMiddleWaveX}
            reactBitsFloatingLinesMiddleWaveY={settings.reactBitsFloatingLinesMiddleWaveY}
            reactBitsFloatingLinesMiddleWaveRotate={settings.reactBitsFloatingLinesMiddleWaveRotate}
            reactBitsFloatingLinesBottomWaveX={settings.reactBitsFloatingLinesBottomWaveX}
            reactBitsFloatingLinesBottomWaveY={settings.reactBitsFloatingLinesBottomWaveY}
            reactBitsFloatingLinesBottomWaveRotate={settings.reactBitsFloatingLinesBottomWaveRotate}
            reactBitsFloatingLinesAnimationSpeed={settings.reactBitsFloatingLinesAnimationSpeed}
            reactBitsFloatingLinesInteractive={settings.reactBitsFloatingLinesInteractive}
            reactBitsFloatingLinesBendRadius={settings.reactBitsFloatingLinesBendRadius}
            reactBitsFloatingLinesBendStrength={settings.reactBitsFloatingLinesBendStrength}
            reactBitsFloatingLinesMouseDamping={settings.reactBitsFloatingLinesMouseDamping}
            reactBitsFloatingLinesParallax={settings.reactBitsFloatingLinesParallax}
            reactBitsFloatingLinesParallaxStrength={settings.reactBitsFloatingLinesParallaxStrength}
            reactBitsFloatingLinesBlendMode={settings.reactBitsFloatingLinesBlendMode}
            eldoraNovatrixPaletteMode={settings.eldoraNovatrixPaletteMode}
            eldoraNovatrixPrimaryColor={settings.eldoraNovatrixPrimaryColor}
            eldoraNovatrixHarmony={settings.eldoraNovatrixHarmony}
            eldoraNovatrixColor={settings.eldoraNovatrixColor}
            eldoraNovatrixSpeed={settings.eldoraNovatrixSpeed}
            eldoraNovatrixAmplitude={settings.eldoraNovatrixAmplitude}
            eldoraHackerPaletteMode={settings.eldoraHackerPaletteMode}
            eldoraHackerPrimaryColor={settings.eldoraHackerPrimaryColor}
            eldoraHackerHarmony={settings.eldoraHackerHarmony}
            eldoraHackerColor={settings.eldoraHackerColor}
            eldoraHackerSpeed={settings.eldoraHackerSpeed}
            eldoraHackerFontSize={settings.eldoraHackerFontSize}
            eldoraPhotonBeamPaletteMode={settings.eldoraPhotonBeamPaletteMode}
            eldoraPhotonBeamPrimaryColor={settings.eldoraPhotonBeamPrimaryColor}
            eldoraPhotonBeamHarmony={settings.eldoraPhotonBeamHarmony}
            eldoraPhotonBeamColorBg={settings.eldoraPhotonBeamColorBg}
            eldoraPhotonBeamColorLine={settings.eldoraPhotonBeamColorLine}
            eldoraPhotonBeamColorSignal={settings.eldoraPhotonBeamColorSignal}
            eldoraPhotonBeamUseColor2={settings.eldoraPhotonBeamUseColor2}
            eldoraPhotonBeamColorSignal2={settings.eldoraPhotonBeamColorSignal2}
            eldoraPhotonBeamUseColor3={settings.eldoraPhotonBeamUseColor3}
            eldoraPhotonBeamColorSignal3={settings.eldoraPhotonBeamColorSignal3}
            eldoraPhotonBeamLineCount={settings.eldoraPhotonBeamLineCount}
            eldoraPhotonBeamSpreadHeight={settings.eldoraPhotonBeamSpreadHeight}
            eldoraPhotonBeamSpreadDepth={settings.eldoraPhotonBeamSpreadDepth}
            eldoraPhotonBeamCurveLength={settings.eldoraPhotonBeamCurveLength}
            eldoraPhotonBeamStraightLength={settings.eldoraPhotonBeamStraightLength}
            eldoraPhotonBeamCurvePower={settings.eldoraPhotonBeamCurvePower}
            eldoraPhotonBeamWaveSpeed={settings.eldoraPhotonBeamWaveSpeed}
            eldoraPhotonBeamWaveHeight={settings.eldoraPhotonBeamWaveHeight}
            eldoraPhotonBeamLineOpacity={settings.eldoraPhotonBeamLineOpacity}
            eldoraPhotonBeamSignalCount={settings.eldoraPhotonBeamSignalCount}
            eldoraPhotonBeamSpeedGlobal={settings.eldoraPhotonBeamSpeedGlobal}
            eldoraPhotonBeamTrailLength={settings.eldoraPhotonBeamTrailLength}
            eldoraPhotonBeamBloomStrength={settings.eldoraPhotonBeamBloomStrength}
            eldoraPhotonBeamBloomRadius={settings.eldoraPhotonBeamBloomRadius}
            aceternity3DGlobeViewStyle={settings.aceternity3DGlobeViewStyle}
            aceternity3DGlobeBackgroundColor={settings.aceternity3DGlobeBackgroundColor}
            aceternity3DGlobeGlobeColor={settings.aceternity3DGlobeGlobeColor}
            aceternity3DGlobeGraphicMapColor={settings.aceternity3DGlobeGraphicMapColor}
            aceternity3DGlobeGraphicGlowColor={settings.aceternity3DGlobeGraphicGlowColor}
            aceternity3DGlobeGraphicMarkerColor={settings.aceternity3DGlobeGraphicMarkerColor}
            aceternity3DGlobeGraphicMapSamples={settings.aceternity3DGlobeGraphicMapSamples}
            aceternity3DGlobeAutoRotateSpeed={settings.aceternity3DGlobeAutoRotateSpeed}
            aceternity3DGlobeReverseSpin={settings.aceternity3DGlobeReverseSpin}
            aceternity3DGlobeScale={settings.aceternity3DGlobeScale}
            aceternity3DGlobeBumpScale={settings.aceternity3DGlobeBumpScale}
            aceternity3DGlobeAmbientIntensity={settings.aceternity3DGlobeAmbientIntensity}
            aceternity3DGlobePointLightIntensity={settings.aceternity3DGlobePointLightIntensity}
            aceternity3DGlobeLightingMode={settings.aceternity3DGlobeLightingMode}
            aceternity3DGlobeEnablePan={settings.aceternity3DGlobeEnablePan}
            aceternity3DGlobePanX={settings.aceternity3DGlobePanX}
            aceternity3DGlobePanY={settings.aceternity3DGlobePanY}
            aceternity3DGlobeShowTilt={settings.aceternity3DGlobeShowTilt}
            aceternity3DGlobeShowAtmosphere={settings.aceternity3DGlobeShowAtmosphere}
            aceternity3DGlobeAtmosphereColor={settings.aceternity3DGlobeAtmosphereColor}
            aceternity3DGlobeAtmosphereIntensity={settings.aceternity3DGlobeAtmosphereIntensity}
            aceternity3DGlobeAtmosphereBlur={settings.aceternity3DGlobeAtmosphereBlur}
            aceternity3DGlobeShowWireframe={settings.aceternity3DGlobeShowWireframe}
            aceternity3DGlobeWireframeColor={settings.aceternity3DGlobeWireframeColor}
            aceternity3DGlobeMarkerEnabled={settings.aceternity3DGlobeMarkerEnabled}
            aceternity3DGlobeMarkerLat={settings.aceternity3DGlobeMarkerLat}
            aceternity3DGlobeMarkerLng={settings.aceternity3DGlobeMarkerLng}
            aceternity3DGlobeMarkerLabel={settings.aceternity3DGlobeMarkerLabel}
            aceternity3DGlobeMarkerIcon={settings.aceternity3DGlobeMarkerIcon}
            aceternity3DGlobeMarkerSize={settings.aceternity3DGlobeMarkerSize}
            magicRetroGridBackgroundColor={settings.magicRetroGridBackgroundColor}
            magicRetroGridLightLineColor={settings.magicRetroGridLightLineColor}
            magicRetroGridDarkLineColor={settings.magicRetroGridDarkLineColor}
            magicRetroGridAngle={settings.magicRetroGridAngle}
            magicRetroGridCellSize={settings.magicRetroGridCellSize}
            magicRetroGridOpacity={settings.magicRetroGridOpacity}
            magicLightRaysBackgroundColor={settings.magicLightRaysBackgroundColor}
            magicLightRaysColor={settings.magicLightRaysColor}
            magicLightRaysCount={settings.magicLightRaysCount}
            magicLightRaysBlur={settings.magicLightRaysBlur}
            magicLightRaysSpeed={settings.magicLightRaysSpeed}
            magicLightRaysLength={settings.magicLightRaysLength}
            magicLightRaysOpacity={settings.magicLightRaysOpacity}
            chamaacSynthesisPaletteMode={settings.chamaacSynthesisPaletteMode}
            chamaacSynthesisPrimaryColor={settings.chamaacSynthesisPrimaryColor}
            chamaacSynthesisHarmony={settings.chamaacSynthesisHarmony}
            chamaacSynthesisColorOne={settings.chamaacSynthesisColorOne}
            chamaacSynthesisColorTwo={settings.chamaacSynthesisColorTwo}
            chamaacSynthesisColorThree={settings.chamaacSynthesisColorThree}
            chamaacSynthesisSpeed={settings.chamaacSynthesisSpeed}
            chamaacSynthesisComplexity={settings.chamaacSynthesisComplexity}
            chamaacSynthesisScale={settings.chamaacSynthesisScale}
            chamaacSynthesisDistortion={settings.chamaacSynthesisDistortion}
            chamaacSynthesisGlowIntensity={settings.chamaacSynthesisGlowIntensity}
            chamaacSynthesisFlowFrequency={settings.chamaacSynthesisFlowFrequency}
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
            featureKeys={featureKeys}
            activeIntervalMinutes={timerState.intervalMs ? Math.max(1, Math.round(timerState.intervalMs / 60_000)) : null}
            onClose={endTimer}
            onPause={togglePause}
            onFullscreen={toggleFullscreen}
            onSettingsChange={updateSettings}
            onFontSizeChange={setFontSize}
            onAdjustActiveRemainingMinutes={adjustActiveRemainingMinutes}
            onSetActiveRemainingDuration={setActiveRemainingDuration}
            onSetActiveIntervalMinutes={setActiveIntervalMinutes}
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
