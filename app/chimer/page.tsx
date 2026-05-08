"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  CHIMER_STORAGE_KEY,
  DEFAULT_CHIMER_SETTINGS,
  formatCurrentTimeParts,
  formatDurationParts,
  getIntervalMs,
  getTotalTimerMs,
  sanitizeChimerSettings,
} from "@/lib/chimer-timer"
import { fetchWithTimeout } from "@/lib/client-fetch"
import { SetTimer, type ChimerSettings } from "./set-timer"
import { MovingBackground } from "./moving-background"
import { RunningTimer } from "./running-timer"

type TimerStatus = "idle" | "running" | "paused" | "complete" | "clock"
type AccountSyncStatus = "checking" | "local" | "synced" | "conflict"

type CurrentTimeParts = {
  time: string
  meridiem: string
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

function hasSavedPreference(value: unknown) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0)
}

function areChimerSettingsEqual(left: ChimerSettings, right: ChimerSettings) {
  return JSON.stringify(sanitizeChimerSettings(left)) === JSON.stringify(sanitizeChimerSettings(right))
}

export default function ChimerPage() {
  const [settings, setSettings] = useState<ChimerSettings>(DEFAULT_CHIMER_SETTINGS as ChimerSettings)
  const [timerState, setTimerState] = useState<TimerState>(idleTimerState)
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

  const timerInterval = useRef<ReturnType<typeof setInterval> | null>(null)
  const alertTimeout = useRef<number | null>(null)
  const timerStateRef = useRef(timerState)
  const settingsRef = useRef(settings)
  const audioContextRef = useRef<AudioContext | null>(null)

  const totalDurationMs = useMemo(
    () => getTotalTimerMs(settings.hours, settings.minutes),
    [settings.hours, settings.minutes],
  )

  useEffect(() => {
    timerStateRef.current = timerState
  }, [timerState])

  useEffect(() => {
    settingsRef.current = settings
  }, [settings])

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
        const response = await fetchWithTimeout("/api/account/preferences")

        if (!isMounted) {
          return
        }

        if (!response.ok) {
          setCanSync(false)
          setAccountSyncStatus("local")
          return
        }

        const preferences = await response.json()

        if (!isMounted) {
          return
        }

        if (hasSavedPreference(preferences.chimerSettings)) {
          const nextSettings = sanitizeChimerSettings(preferences.chimerSettings) as ChimerSettings
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

        const seedResponse = await fetchWithTimeout("/api/account/preferences", {
          method: "PUT",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ chimerSettings: localSettings }),
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
  }, [clearTimerInterval, triggerAlert])

  const startTicking = useCallback(() => {
    clearTimerInterval()
    timerInterval.current = setInterval(tick, 250)
    window.setTimeout(tick, 0)
  }, [clearTimerInterval, tick])

  const updateSettings = (nextSettings: Partial<ChimerSettings>) => {
    setError(null)
    setSettings((current) => sanitizeChimerSettings({ ...current, ...nextSettings }) as ChimerSettings)
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

    const clockState: TimerState = {
      status: "clock",
      totalMs: 0,
      remainingMs: 0,
      endsAtMs: null,
      intervalMs: null,
      nextAlertAtMs: null,
      msUntilNextAlert: null,
    }

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

  const timeDisplay = formatDurationParts(timerState.remainingMs)
  const isTimerActive = timerState.status !== "idle"

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#050505] p-4 sm:p-6 lg:p-8">
      {settings.movingBackgroundEnabled && !isTimerActive && (
        <MovingBackground
          mainColor={settings.movingBackgroundMainColor}
          orbColor={settings.movingBackgroundOrbColor}
        />
      )}
      <div className="relative z-10 mx-auto max-w-5xl">
        {!isTimerActive ? (
          <SetTimer
            settings={settings}
            totalDurationMs={totalDurationMs}
            error={error}
            syncStatus={accountSyncStatus}
            isResolvingSync={isResolvingSync}
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
            currentTime={currentTime}
            status={timerState.status as "running" | "paused" | "complete" | "clock"}
            isFullscreen={isFullscreen}
            isAlerting={isAlerting}
            fontSize={fontSize}
            movingBackgroundEnabled={settings.movingBackgroundEnabled}
            showCurrentTimeSeconds={settings.showCurrentTimeSeconds}
            timeFormat={settings.timeFormat}
            movingBackgroundMainColor={settings.movingBackgroundMainColor}
            movingBackgroundOrbColor={settings.movingBackgroundOrbColor}
            onClose={endTimer}
            onPause={togglePause}
            onFullscreen={toggleFullscreen}
            onSettingsChange={updateSettings}
            onIncreaseFontSize={() => setFontSize((current) => Math.min(current + 3, 34))}
            onDecreaseFontSize={() => setFontSize((current) => Math.max(current - 3, 12))}
          />
        )}

        <Dialog open={showTimeModal} onOpenChange={setShowTimeModal}>
          <DialogContent className="max-h-[80dvh] overflow-auto bg-[#202020] border-[#444] p-6">
            <DialogHeader>
              <DialogTitle className="text-center text-xl">
                Set {selectedTimeUnit === "hours" ? "Hours" : "Minutes"}
              </DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {Array.from({ length: selectedTimeUnit === "hours" ? 24 : 60 }).map((_, index) => (
                <button
                  key={index}
                  onClick={() => handleTimeSelection(index)}
                  className="rounded-md bg-[#141414] p-3 text-white transition-colors hover:bg-[#ff7043] focus:outline-none focus:ring-2 focus:ring-[#ff7043]"
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
