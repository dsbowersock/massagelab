"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { Maximize2, Minimize2, Minus, Pause, Play, Plus, Settings, X } from "lucide-react"
import type { ChimerSettings } from "./set-timer"
import { MovingBackground } from "./moving-background"
import styles from "./running-timer.module.css"

type PrimaryDisplay = "timer" | "currentTime"

type CurrentTimeParts = {
  time: string
  meridiem: string
}

interface RunningTimerProps {
  timeDisplay: { hours: string; minutes: string; seconds: string }
  currentTime: CurrentTimeParts
  status: "running" | "paused" | "complete" | "clock"
  isFullscreen: boolean
  isAlerting: boolean
  fontSize: number
  movingBackgroundEnabled: boolean
  showCurrentTimeSeconds: boolean
  timeFormat: ChimerSettings["timeFormat"]
  movingBackgroundMainColor: string
  movingBackgroundOrbColor: string
  onClose: () => void
  onPause: () => void
  onFullscreen: () => void
  onSettingsChange: (settings: Partial<ChimerSettings>) => void
  onIncreaseFontSize: () => void
  onDecreaseFontSize: () => void
}

export function RunningTimer({
  timeDisplay,
  currentTime,
  status,
  isFullscreen,
  isAlerting,
  fontSize,
  movingBackgroundEnabled,
  showCurrentTimeSeconds,
  timeFormat,
  movingBackgroundMainColor,
  movingBackgroundOrbColor,
  onClose,
  onPause,
  onFullscreen,
  onSettingsChange,
  onIncreaseFontSize,
  onDecreaseFontSize,
}: RunningTimerProps) {
  const isPaused = status === "paused"
  const isComplete = status === "complete"
  const isClockMode = status === "clock"
  const [primaryDisplay, setPrimaryDisplay] = useState<PrimaryDisplay>(isClockMode ? "currentTime" : "timer")
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [controlState, setControlState] = useState<"visible" | "faded" | "hidden">("visible")
  const fadeTimerRef = useRef<number | null>(null)
  const hideTimerRef = useRef<number | null>(null)
  const settingsButtonRef = useRef<HTMLButtonElement | null>(null)
  const settingsPanelRef = useRef<HTMLDivElement | null>(null)
  const isTimerPrimary = primaryDisplay === "timer"
  const primaryActionLabel = isPaused ? "Resume timer" : "Pause timer"

  const clearControlTimers = useCallback(() => {
    if (fadeTimerRef.current) {
      window.clearTimeout(fadeTimerRef.current)
      fadeTimerRef.current = null
    }

    if (hideTimerRef.current) {
      window.clearTimeout(hideTimerRef.current)
      hideTimerRef.current = null
    }
  }, [])

  const scheduleControlHide = useCallback(() => {
    clearControlTimers()

    if (isSettingsOpen) {
      setControlState("visible")
      return
    }

    fadeTimerRef.current = window.setTimeout(() => setControlState("faded"), 3000)
    hideTimerRef.current = window.setTimeout(() => setControlState("hidden"), 6000)
  }, [clearControlTimers, isSettingsOpen])

  const revealControls = useCallback(() => {
    setControlState("visible")
    scheduleControlHide()
  }, [scheduleControlHide])

  useEffect(() => {
    if (isComplete || isClockMode) {
      return
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space" || event.repeat) {
        return
      }

      const target = event.target as HTMLElement | null
      if (target?.closest("input, textarea, select, [contenteditable='true'], [data-chimer-control='true']")) {
        return
      }

      event.preventDefault()
      onPause()
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isClockMode, isComplete, onPause])

  useEffect(() => {
    revealControls()
    const options: AddEventListenerOptions = { passive: true }
    const handleInteraction = () => revealControls()

    window.addEventListener("pointermove", handleInteraction, options)
    window.addEventListener("pointerdown", handleInteraction, options)
    window.addEventListener("touchstart", handleInteraction, options)
    window.addEventListener("keydown", handleInteraction)
    window.addEventListener("focusin", handleInteraction)

    return () => {
      clearControlTimers()
      window.removeEventListener("pointermove", handleInteraction)
      window.removeEventListener("pointerdown", handleInteraction)
      window.removeEventListener("touchstart", handleInteraction)
      window.removeEventListener("keydown", handleInteraction)
      window.removeEventListener("focusin", handleInteraction)
    }
  }, [clearControlTimers, revealControls])

  useEffect(() => {
    if (isClockMode) {
      setPrimaryDisplay("currentTime")
    }
  }, [isClockMode])

  useEffect(() => {
    if (!isSettingsOpen) {
      return
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (!target) {
        return
      }

      if (settingsPanelRef.current?.contains(target) || settingsButtonRef.current?.contains(target)) {
        return
      }

      setIsSettingsOpen(false)
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsSettingsOpen(false)
      }
    }

    document.addEventListener("pointerdown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [isSettingsOpen])

  useEffect(() => {
    if (isSettingsOpen) {
      clearControlTimers()
      setControlState("visible")
      return
    }

    scheduleControlHide()
  }, [clearControlTimers, isSettingsOpen, scheduleControlHide])

  const renderTimerDisplay = () => (
    <>
      {timeDisplay.hours !== "00" && (
        <>
          <span className={styles.timeUnit}>{timeDisplay.hours}</span>
          <span className={styles.colon}>:</span>
        </>
      )}
      <span className={styles.timeUnit}>{timeDisplay.minutes}</span>
      <span className={styles.colon}>:</span>
      <span className={styles.timeUnit}>{timeDisplay.seconds}</span>
    </>
  )

  const renderCurrentTimeDisplay = (isPrimary: boolean) => (
    <span className={isPrimary ? styles.currentTimeStack : styles.currentTimeInline}>
      <span className={styles.currentTimeValue}>{currentTime.time}</span>
      {currentTime.meridiem && (
        <span className={isPrimary ? styles.currentTimeMeridiem : styles.currentTimeInlineMeridiem}>
          {currentTime.meridiem}
        </span>
      )}
    </span>
  )

  const chromeClassName = [
    styles.chrome,
    controlState === "faded" ? styles.chromeFaded : "",
    controlState === "hidden" ? styles.chromeHidden : "",
  ].filter(Boolean).join(" ")

  return (
    <section className={`${styles.container} ${isAlerting ? styles.alerting : ""}`} aria-label={isClockMode ? "Chimer clock" : "Running Chimer timer"}>
      {movingBackgroundEnabled && (
        <MovingBackground
          className={styles.runningBackground}
          mainColor={movingBackgroundMainColor}
          orbColor={movingBackgroundOrbColor}
        />
      )}

      {!isClockMode && isTimerPrimary ? (
        <button
          type="button"
          className={`${styles.displayButton} ${styles.secondaryDisplay} ${styles.currentTimeDisplay}`}
          onClick={() => setPrimaryDisplay("currentTime")}
          aria-label="Show current time in center"
          data-testid="running-current-time"
        >
          {renderCurrentTimeDisplay(false)}
        </button>
      ) : !isClockMode ? (
        <button
          type="button"
          className={`${styles.displayButton} ${styles.secondaryDisplay} ${styles.timerDisplay}`}
          onClick={() => setPrimaryDisplay("timer")}
          aria-label="Show timer in center"
          aria-live="polite"
          data-testid="running-timer-clock"
        >
          {renderTimerDisplay()}
        </button>
      ) : null}

      {!isClockMode && (
        <div className={styles.status}>{isComplete ? "Session complete" : isPaused ? "Paused" : "Running"}</div>
      )}

      {isTimerPrimary && !isClockMode ? (
        <button
          type="button"
          className={`${styles.displayButton} ${styles.primaryDisplay} ${styles.timerDisplay}`}
          onClick={onPause}
          disabled={isComplete}
          data-testid="running-timer-clock"
          style={{ fontSize: `${fontSize}vw` }}
          aria-label={isComplete ? "Session complete" : `${primaryActionLabel} from center display`}
          aria-live="polite"
        >
          {renderTimerDisplay()}
        </button>
      ) : (
        <button
          type="button"
          className={`${styles.displayButton} ${styles.primaryDisplay} ${styles.currentTimeDisplay}`}
          onClick={isClockMode ? revealControls : onPause}
          disabled={isComplete}
          data-testid="running-current-time"
          aria-label={isClockMode ? "Reveal clock controls" : isComplete ? "Session complete" : `${primaryActionLabel} from center display`}
          style={{ fontSize: `${fontSize}vw` }}
        >
          {renderCurrentTimeDisplay(true)}
        </button>
      )}

      <div className={chromeClassName}>
        <button
          className={`${styles.control} ${styles.closeButton}`}
          onClick={onClose}
          aria-label={isClockMode ? "Close clock" : "End timer"}
          data-chimer-control="true"
        >
          <X className="h-5 w-5" />
        </button>

        <button
          className={`${styles.control} ${styles.fullscreenButton}`}
          onClick={onFullscreen}
          aria-label="Toggle fullscreen"
          data-chimer-control="true"
        >
          {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
        </button>

        <button
          ref={settingsButtonRef}
          className={`${styles.control} ${styles.settingsButton}`}
          onClick={() => setIsSettingsOpen(true)}
          aria-label="Open timer settings"
          aria-expanded={isSettingsOpen}
          data-chimer-control="true"
        >
          <Settings className="h-5 w-5" />
        </button>

        {isSettingsOpen && (
          <div ref={settingsPanelRef} className={styles.settingsPanel} role="dialog" aria-label="Timer settings" data-chimer-control="true">
            <div className={styles.settingsHeader}>Clock Settings</div>

            <label className={styles.switchRow}>
              <span>Show seconds</span>
              <input
                type="checkbox"
                checked={showCurrentTimeSeconds}
                onChange={(event) => onSettingsChange({ showCurrentTimeSeconds: event.target.checked })}
              />
            </label>

            <div className={styles.formatRow}>
              <span>Time format</span>
              <div className={styles.formatToggle} aria-label="Time format">
                <button
                  type="button"
                  className={`${styles.formatOption} ${timeFormat === "12h" ? styles.formatOptionActive : ""}`}
                  aria-pressed={timeFormat === "12h"}
                  onClick={() => onSettingsChange({ timeFormat: "12h" })}
                >
                  12h
                </button>
                <button
                  type="button"
                  className={`${styles.formatOption} ${timeFormat === "24h" ? styles.formatOptionActive : ""}`}
                  aria-pressed={timeFormat === "24h"}
                  onClick={() => onSettingsChange({ timeFormat: "24h" })}
                >
                  24h
                </button>
              </div>
            </div>

            <label className={styles.switchRow}>
              <span>Moving background</span>
              <input
                type="checkbox"
                checked={movingBackgroundEnabled}
                onChange={(event) => onSettingsChange({ movingBackgroundEnabled: event.target.checked })}
              />
            </label>

            <label className={styles.colorRow}>
              <span>Main color</span>
              <input
                type="color"
                value={movingBackgroundMainColor}
                onChange={(event) => onSettingsChange({ movingBackgroundMainColor: event.target.value })}
                aria-label="Moving background main color"
              />
            </label>

            <label className={styles.colorRow}>
              <span>Orb color</span>
              <input
                type="color"
                value={movingBackgroundOrbColor}
                onChange={(event) => onSettingsChange({ movingBackgroundOrbColor: event.target.value })}
                aria-label="Moving background orb color"
              />
            </label>
          </div>
        )}

        <div className={styles.bottomControls}>
          <button className={styles.fontButton} onClick={onDecreaseFontSize} aria-label="Decrease timer size" data-chimer-control="true">
            <Minus className="h-5 w-5" />
          </button>
          {!isComplete && !isClockMode && (
            <button className={`${styles.control} ${styles.pauseButton}`} onClick={onPause} aria-label={isPaused ? "Resume timer" : "Pause timer"} data-chimer-control="true">
              {isPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
            </button>
          )}
          <button className={styles.fontButton} onClick={onIncreaseFontSize} aria-label="Increase timer size" data-chimer-control="true">
            <Plus className="h-5 w-5" />
          </button>
        </div>
      </div>
    </section>
  )
}
