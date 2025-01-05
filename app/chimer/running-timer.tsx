"use client"

import { X, Maximize2, Minimize2, Play, Pause, Plus, Minus } from 'lucide-react'
import styles from "./running-timer.module.css"

interface RunningTimerProps {
  timeDisplay: { hours: string; minutes: string; seconds: string }
  currentTime: string
  isPaused: boolean
  isFullscreen: boolean
  fontSize: number
  onClose: () => void
  onPause: () => void
  onFullscreen: () => void
  onIncreaseFontSize: () => void
  onDecreaseFontSize: () => void
}

export function RunningTimer({
  timeDisplay,
  currentTime,
  isPaused,
  isFullscreen,
  fontSize,
  onClose,
  onPause,
  onFullscreen,
  onIncreaseFontSize,
  onDecreaseFontSize
}: RunningTimerProps) {
  return (
    <div className={styles.container}>
      <div className={styles.actualTime}>{currentTime}</div>
      
      <div 
        className={styles.clock} 
        data-testid="running-timer-clock"
        style={{ fontSize: `${fontSize}vw` }}
      >
        {timeDisplay.hours !== "00" && (
          <>
            <span className={styles.timeUnit}>
              {timeDisplay.hours}
            </span>
            <span className={styles.colon}>:</span>
          </>
        )}
        <span className={styles.timeUnit}>
          {timeDisplay.minutes}
        </span>
        <span className={styles.colon}>:</span>
        <span className={styles.timeUnit}>
          {timeDisplay.seconds}
        </span>
      </div>

      <button className={`${styles.control} ${styles.closeButton}`} onClick={onClose}>
        <X className="w-5 h-5" />
      </button>

      <div className={styles.fontControls}>
        <button
          className={styles.fontButton}
          onClick={onDecreaseFontSize}
          aria-label="Decrease font size"
        >
          <Minus className="w-5 h-5" />
        </button>
        <button
          className={styles.fontButton}
          onClick={onIncreaseFontSize}
          aria-label="Increase font size"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <button className={`${styles.control} ${styles.pauseButton}`} onClick={onPause}>
        {isPaused ? (
          <Play className="w-5 h-5" />
        ) : (
          <Pause className="w-5 h-5" />
        )}
      </button>

      <button className={`${styles.control} ${styles.fullscreenButton}`} onClick={onFullscreen}>
        {isFullscreen ? (
          <Minimize2 className="w-5 h-5" />
        ) : (
          <Maximize2 className="w-5 h-5" />
        )}
      </button>
    </div>
  )
}

