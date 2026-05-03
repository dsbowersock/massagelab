"use client"

import { useEffect, useState } from "react"
import { X, Maximize2, Minimize2, Play, Pause, Plus, Minus, Settings } from "lucide-react"
import type { ChimerSettings } from "./set-timer"
import { MovingBackground } from "./moving-background"
import styles from "./running-timer.module.css"

type PrimaryDisplay = "timer" | "currentTime"

interface RunningTimerProps {
  timeDisplay: { hours: string; minutes: string; seconds: string }
  currentTime: string
  status: "running" | "paused" | "complete"
  isFullscreen: boolean
  isAlerting: boolean
  fontSize: number
  movingBackgroundEnabled: boolean
  showCurrentTimeSeconds: boolean
  showCurrentTimeAmPm: boolean
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
  showCurrentTimeAmPm,
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
  const [primaryDisplay, setPrimaryDisplay] = useState<PrimaryDisplay>("timer")
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const isTimerPrimary = primaryDisplay === "timer"
  const primaryActionLabel = isPaused ? "Resume timer" : "Pause timer"

  useEffect(() => {
    if (isComplete) {
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
  }, [isComplete, onPause])

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

  return (
    <section className={`${styles.container} ${isAlerting ? styles.alerting : ""}`} aria-label="Running Chimer timer">
      {movingBackgroundEnabled && (
        <MovingBackground
          className={styles.runningBackground}
          mainColor={movingBackgroundMainColor}
          orbColor={movingBackgroundOrbColor}
        />
      )}

      {isTimerPrimary ? (
        <button
          type="button"
          className={`${styles.displayButton} ${styles.secondaryDisplay} ${styles.currentTimeDisplay}`}
          onClick={() => setPrimaryDisplay("currentTime")}
          aria-label="Show current time in center"
          data-testid="running-current-time"
        >
          {currentTime}
        </button>
      ) : (
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
      )}

      <div className={styles.status}>{isComplete ? "Session complete" : isPaused ? "Paused" : "Running"}</div>

      {isTimerPrimary ? (
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
          onClick={onPause}
          disabled={isComplete}
          data-testid="running-current-time"
          aria-label={isComplete ? "Session complete" : `${primaryActionLabel} from center display`}
        >
          {currentTime}
        </button>
      )}

      <button
        className={`${styles.control} ${styles.closeButton}`}
        onClick={onClose}
        aria-label="End timer"
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
        className={`${styles.control} ${styles.settingsButton}`}
        onClick={() => setIsSettingsOpen((current) => !current)}
        aria-label="Open timer settings"
        aria-expanded={isSettingsOpen}
        data-chimer-control="true"
      >
        <Settings className="h-5 w-5" />
      </button>

      {isSettingsOpen && (
        <div className={styles.settingsPanel} role="dialog" aria-label="Timer settings" data-chimer-control="true">
          <div className={styles.settingsHeader}>Clock Settings</div>

          <label className={styles.switchRow}>
            <span>Show seconds</span>
            <input
              type="checkbox"
              checked={showCurrentTimeSeconds}
              onChange={(event) => onSettingsChange({ showCurrentTimeSeconds: event.target.checked })}
            />
          </label>

          <label className={styles.switchRow}>
            <span>Show AM/PM</span>
            <input
              type="checkbox"
              checked={showCurrentTimeAmPm}
              onChange={(event) => onSettingsChange({ showCurrentTimeAmPm: event.target.checked })}
            />
          </label>

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
        {!isComplete && (
          <button className={`${styles.control} ${styles.pauseButton}`} onClick={onPause} aria-label={isPaused ? "Resume timer" : "Pause timer"} data-chimer-control="true">
            {isPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
          </button>
        )}
        <button className={styles.fontButton} onClick={onIncreaseFontSize} aria-label="Increase timer size" data-chimer-control="true">
          <Plus className="h-5 w-5" />
        </button>
      </div>
    </section>
  )
}
