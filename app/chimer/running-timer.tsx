"use client"

import { type CSSProperties, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { Lock, Maximize2, Minimize2, Minus, Pause, Play, Plus, Settings, X } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import type { ChimerSettings } from "./set-timer"
import { MovingBackground } from "./moving-background"
import styles from "./running-timer.module.css"

type PrimaryDisplay = "timer" | "currentTime"
type SettingsTab = "timer" | "display" | "background"

type CurrentTimeParts = {
  time: string
  meridiem: string
}

const MIN_FONT_SIZE = 12
const MAX_FONT_SIZE = 70
const FONT_SIZE_STEP = 3
const FONT_FIT_EDGE_INSET_PX = 2
const SWAP_ANIMATION_MS = 360
const SETTINGS_AUTO_CLOSE_MS = 60_000
const DEFAULT_PRIMARY_FONT_COLOR = "#FFFFFF"
const DEFAULT_SECONDARY_FONT_COLOR = "#FF7A1A"
const DEFAULT_CLOCK_MODE_FONT_COLOR = "#FFFFFF"
const CUSTOM_COLOR_SETTING_KEYS = new Set([
  "primaryFontColor",
  "secondaryFontColor",
  "clockModeFontColor",
  "movingBackgroundMainColor",
  "movingBackgroundOrbColor",
])

interface RunningTimerProps {
  timeDisplay: { hours: string; minutes: string; seconds: string }
  activeTimeDisplay: { hours: string; minutes: string; seconds: string }
  currentTime: CurrentTimeParts
  status: "running" | "paused" | "complete" | "clock"
  isFullscreen: boolean
  isAlerting: boolean
  fontSize: number
  movingBackgroundEnabled: boolean
  keepTimerScreenAwake: boolean
  showTimerSeconds: boolean
  showCurrentTimeSeconds: boolean
  timeFormat: ChimerSettings["timeFormat"]
  primaryFontColor: string
  secondaryFontColor: string
  clockModeFontColor: string
  movingBackgroundMainColor: string
  movingBackgroundOrbColor: string
  canUseCustomColors: boolean
  activeIntervalMinutes: number | null
  onClose: () => void
  onPause: () => void
  onFullscreen: () => void
  onSettingsChange: (settings: Partial<ChimerSettings>) => void
  onFontSizeChange: (fontSize: number) => void
  onAdjustActiveRemainingMinutes: (deltaMinutes: number) => void
  onSetActiveRemainingDuration: (hours: number, minutes: number) => void
  onSetActiveIntervalMinutes: (minutes: number) => void
}

export function RunningTimer({
  timeDisplay,
  activeTimeDisplay,
  currentTime,
  status,
  isFullscreen,
  isAlerting,
  fontSize,
  movingBackgroundEnabled,
  keepTimerScreenAwake,
  showTimerSeconds,
  showCurrentTimeSeconds,
  timeFormat,
  primaryFontColor,
  secondaryFontColor,
  clockModeFontColor,
  movingBackgroundMainColor,
  movingBackgroundOrbColor,
  canUseCustomColors,
  activeIntervalMinutes,
  onClose,
  onPause,
  onFullscreen,
  onSettingsChange,
  onFontSizeChange,
  onAdjustActiveRemainingMinutes,
  onSetActiveRemainingDuration,
  onSetActiveIntervalMinutes,
}: RunningTimerProps) {
  const isPaused = status === "paused"
  const isComplete = status === "complete"
  const isClockMode = status === "clock"
  const canEditActiveTimer = status === "running" || status === "paused"
  const [primaryDisplay, setPrimaryDisplay] = useState<PrimaryDisplay>(isClockMode ? "currentTime" : "timer")
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [settingsTab, setSettingsTab] = useState<SettingsTab>(isClockMode ? "display" : "timer")
  const [controlState, setControlState] = useState<"visible" | "faded" | "hidden">("visible")
  const [fitFontSize, setFitFontSize] = useState<number | null>(null)
  const [maxFittedFontSize, setMaxFittedFontSize] = useState<number | null>(null)
  const [swapAnimationTarget, setSwapAnimationTarget] = useState<PrimaryDisplay | null>(null)
  const fadeTimerRef = useRef<number | null>(null)
  const hideTimerRef = useRef<number | null>(null)
  const settingsAutoCloseTimerRef = useRef<number | null>(null)
  const settingsButtonRef = useRef<HTMLButtonElement | null>(null)
  const settingsPanelRef = useRef<HTMLDivElement | null>(null)
  const primaryDisplayRef = useRef<HTMLButtonElement | null>(null)
  const primaryContentRef = useRef<HTMLSpanElement | null>(null)
  const isTimerPrimary = primaryDisplay === "timer"
  const isCurrentTimePrimary = isClockMode || !isTimerPrimary
  const resolvedShowTimerSeconds = showTimerSeconds !== false
  const resolvedPrimaryFontColor = primaryFontColor || DEFAULT_PRIMARY_FONT_COLOR
  const resolvedSecondaryFontColor = secondaryFontColor || DEFAULT_SECONDARY_FONT_COLOR
  const resolvedClockModeFontColor = clockModeFontColor || DEFAULT_CLOCK_MODE_FONT_COLOR
  const resolvedTimerDisplayColor = isTimerPrimary ? resolvedPrimaryFontColor : resolvedSecondaryFontColor
  const resolvedCurrentTimeDisplayColor = isClockMode
    ? resolvedClockModeFontColor
    : isCurrentTimePrimary ? resolvedPrimaryFontColor : resolvedSecondaryFontColor
  const primaryActionLabel = isPaused ? "Resume timer" : "Pause timer"
  const statusText = isComplete ? "Session complete" : isPaused ? "Paused" : "Running"
  const hasTimerSeconds = Boolean(timeDisplay.seconds)
  const timerDisplayFitUnits = hasTimerSeconds
    ? timeDisplay.hours === "00" ? 3.02 : 4.35
    : timeDisplay.hours === "00" ? 1.45 : 3.1
  const currentTimeSegmentCount = currentTime.time ? currentTime.time.split(":").length : 2
  const currentTimeDisplayFitUnits = currentTimeSegmentCount > 2 ? 3.42 : 2.38
  const primaryDisplayFitUnits = isTimerPrimary ? timerDisplayFitUnits : currentTimeDisplayFitUnits
  const currentTimeDisplayShapeKey = currentTime.time.includes(":")
    ? `${currentTimeSegmentCount}:${currentTime.meridiem ? "meridiem" : "plain"}`
    : `${currentTime.time}:${currentTime.meridiem}`
  const primaryDisplayContentKey = isTimerPrimary
    ? `${timeDisplay.hours}:${timeDisplay.minutes}:${timeDisplay.seconds}`
    : currentTimeDisplayShapeKey
  const effectiveMaxFontSize = Math.min(MAX_FONT_SIZE, maxFittedFontSize ?? MAX_FONT_SIZE)
  const effectiveFontSize = Math.min(fontSize, effectiveMaxFontSize)
  const canIncreaseFontSize = effectiveFontSize < effectiveMaxFontSize - 0.05
  const canDecreaseFontSize = effectiveFontSize > MIN_FONT_SIZE + 0.05
  const activeRemainingHours = Number(activeTimeDisplay.hours)
  const activeRemainingMinutes = Number(activeTimeDisplay.minutes)

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

  const clearSettingsAutoCloseTimer = useCallback(() => {
    if (settingsAutoCloseTimerRef.current) {
      window.clearTimeout(settingsAutoCloseTimerRef.current)
      settingsAutoCloseTimerRef.current = null
    }
  }, [])

  const scheduleSettingsAutoClose = useCallback(() => {
    clearSettingsAutoCloseTimer()
    settingsAutoCloseTimerRef.current = window.setTimeout(() => {
      setIsSettingsOpen(false)
    }, SETTINGS_AUTO_CLOSE_MS)
  }, [clearSettingsAutoCloseTimer])

  const scheduleControlHide = useCallback((options: { force?: boolean } = {}) => {
    clearControlTimers()

    if (isSettingsOpen && !options.force) {
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

  const scheduleHideAfterControlAction = useCallback(
    (options: { force?: boolean } = {}) => {
      window.setTimeout(() => scheduleControlHide(options), 0)
    },
    [scheduleControlHide],
  )

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
      scheduleHideAfterControlAction({ force: true })
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isClockMode, isComplete, onPause, scheduleHideAfterControlAction])

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
      setSwapAnimationTarget(null)
    }
  }, [isClockMode])

  useEffect(() => {
    if (!swapAnimationTarget) {
      return
    }

    const timeout = window.setTimeout(() => setSwapAnimationTarget(null), SWAP_ANIMATION_MS)
    return () => window.clearTimeout(timeout)
  }, [swapAnimationTarget])

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

  useEffect(() => {
    if (!isSettingsOpen) {
      clearSettingsAutoCloseTimer()
      return
    }

    scheduleSettingsAutoClose()
    return () => clearSettingsAutoCloseTimer()
  }, [clearSettingsAutoCloseTimer, isSettingsOpen, scheduleSettingsAutoClose])

  useLayoutEffect(() => {
    const primaryElement = primaryDisplayRef.current
    const contentElement = primaryContentRef.current

    if (!primaryElement || !contentElement) {
      return
    }

    let animationFrame = 0

    const fitPrimaryDisplay = () => {
      window.cancelAnimationFrame(animationFrame)
      animationFrame = window.requestAnimationFrame(() => {
        const preferredFontSize = Math.max(1, window.innerWidth * (fontSize / 100))
        const availableRect = primaryElement.getBoundingClientRect()
        const availableWidth = availableRect.width
        const availableHeight = availableRect.height
        const viewportWidth = window.innerWidth
        if (!availableWidth || !availableHeight || !viewportWidth) {
          return
        }

        const targetWidth = Math.max(1, availableWidth - FONT_FIT_EDGE_INSET_PX)
        const targetHeight = Math.max(1, availableHeight - FONT_FIT_EDGE_INSET_PX)
        primaryElement.style.setProperty("--chimer-fit-font-size", `${preferredFontSize}px`)
        const contentRect = contentElement.getBoundingClientRect()
        const contentWidth = isCurrentTimePrimary
          ? contentRect.width
          : Math.max(contentElement.scrollWidth, contentRect.width)
        const contentHeight = isCurrentTimePrimary
          ? contentRect.height
          : Math.max(contentElement.scrollHeight, contentRect.height)

        if (!contentWidth || !contentHeight) {
          return
        }

        const measuredMaxFontSizePx = Math.max(1, preferredFontSize * (targetWidth / contentWidth))
        const measuredMaxHeightFontSizePx = Math.max(1, preferredFontSize * (targetHeight / contentHeight))
        const profiledMaxFontSizePx = primaryDisplayFitUnits
          ? targetWidth / primaryDisplayFitUnits
          : Number.POSITIVE_INFINITY
        const maxFontSizePx = Math.min(measuredMaxFontSizePx, measuredMaxHeightFontSizePx, profiledMaxFontSizePx)
        const nextFontSize = Math.min(preferredFontSize, maxFontSizePx)
        const nextMaxFittedFontSize = Math.min(MAX_FONT_SIZE, (maxFontSizePx / viewportWidth) * 100)
        primaryElement.style.setProperty("--chimer-fit-font-size", `${nextFontSize}px`)
        setMaxFittedFontSize((current) => {
          if (current !== null && Math.abs(current - nextMaxFittedFontSize) < 0.05) {
            return current
          }

          return nextMaxFittedFontSize
        })
        setFitFontSize((current) => {
          if (current !== null && Math.abs(current - nextFontSize) < 0.5) {
            return current
          }

          return nextFontSize
        })
      })
    }

    fitPrimaryDisplay()

    const resizeObserver = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(fitPrimaryDisplay)
      : null

    resizeObserver?.observe(primaryElement)
    window.addEventListener("resize", fitPrimaryDisplay)
    void document.fonts?.ready.then(fitPrimaryDisplay).catch(() => undefined)

    return () => {
      window.cancelAnimationFrame(animationFrame)
      resizeObserver?.disconnect()
      window.removeEventListener("resize", fitPrimaryDisplay)
    }
  }, [
    fontSize,
    isClockMode,
    isCurrentTimePrimary,
    primaryDisplay,
    primaryDisplayContentKey,
    primaryDisplayFitUnits,
    showCurrentTimeSeconds,
  ])

  const handlePrimarySwitch = (nextDisplay: PrimaryDisplay) => {
    if (nextDisplay === primaryDisplay) {
      return
    }

    setSwapAnimationTarget(nextDisplay)
    setPrimaryDisplay(nextDisplay)
    scheduleHideAfterControlAction({ force: true })
  }

  const handleFontSizeChange = (direction: "increase" | "decrease") => {
    const clampedCurrent = Math.min(fontSize, effectiveMaxFontSize)
    const nextFontSize = direction === "increase"
      ? Math.min(effectiveMaxFontSize, clampedCurrent + FONT_SIZE_STEP)
      : Math.max(MIN_FONT_SIZE, clampedCurrent - FONT_SIZE_STEP)

    if (Math.abs(nextFontSize - fontSize) < 0.05) {
      scheduleHideAfterControlAction({ force: true })
      return
    }

    onFontSizeChange(Number(nextFontSize.toFixed(2)))
    scheduleHideAfterControlAction({ force: true })
  }

  const handlePauseControl = () => {
    onPause()
    scheduleHideAfterControlAction({ force: true })
  }

  const handleFullscreenControl = () => {
    onFullscreen()
    scheduleHideAfterControlAction({ force: true })
  }

  const handleSettingsButtonClick = () => {
    if (isSettingsOpen) {
      setIsSettingsOpen(false)
      scheduleHideAfterControlAction({ force: true })
      return
    }

    clearControlTimers()
    setControlState("visible")
    setSettingsTab(isClockMode ? "display" : "timer")
    setIsSettingsOpen(true)
  }

  const handleSettingsChange = (nextSettings: Partial<ChimerSettings>) => {
    if (!canUseCustomColors && Object.keys(nextSettings).some((key) => CUSTOM_COLOR_SETTING_KEYS.has(key))) {
      return
    }

    onSettingsChange(nextSettings)
    scheduleSettingsAutoClose()
    scheduleControlHide()
  }

  const handleSettingsPanelActivity = () => {
    scheduleSettingsAutoClose()
  }

  const handleSettingsTabChange = (nextTab: string) => {
    setSettingsTab(nextTab as SettingsTab)
    scheduleSettingsAutoClose()
  }

  const handleActiveRemainingHoursChange = (value: string) => {
    onSetActiveRemainingDuration(Number(value), activeRemainingMinutes)
    scheduleSettingsAutoClose()
  }

  const handleActiveRemainingMinutesChange = (value: string) => {
    onSetActiveRemainingDuration(activeRemainingHours, Number(value))
    scheduleSettingsAutoClose()
  }

  const handleActiveIntervalChange = (value: string) => {
    onSetActiveIntervalMinutes(Number(value))
    scheduleSettingsAutoClose()
  }

  const handleActiveRemainingStep = (deltaMinutes: number) => {
    onAdjustActiveRemainingMinutes(deltaMinutes)
    scheduleSettingsAutoClose()
  }

  const renderTimerUnitLabel = (label: "h" | "m" | "s") => (
    <span className={styles.timerUnitLabel} aria-hidden="true">{label}</span>
  )

  const renderCurrentTimeMeridiem = (meridiem = currentTime.meridiem) => (
    meridiem ? <span className={styles.currentTimeMeridiem}>{meridiem}</span> : null
  )

  const renderTimerDisplay = () => {
    const hasHours = timeDisplay.hours !== "00"
    const hasSeconds = Boolean(timeDisplay.seconds)

    return (
      <>
        {hasHours && (
          <>
            <span className={styles.timeUnit}>{timeDisplay.hours}</span>
            {renderTimerUnitLabel("h")}
            <span className={styles.colon}>:</span>
          </>
        )}
        <span className={styles.timeUnit}>{timeDisplay.minutes}</span>
        {renderTimerUnitLabel("m")}
        {hasSeconds && (
          <>
            <span className={styles.colon}>:</span>
            <span className={styles.timeUnit}>{timeDisplay.seconds}</span>
            {renderTimerUnitLabel("s")}
          </>
        )}
      </>
    )
  }

  const renderCurrentTimeDisplay = (isPrimary: boolean) => {
    const [hour = "", minute = "", second = ""] = currentTime.time.split(":")

    const renderDigitSlots = (value: string) => (
      value.padStart(2, "0").split("").map((digit, index) => (
        <span key={`${value}-${index}`} className={styles.currentTimeDigit}>{digit}</span>
      ))
    )

    if (!minute) {
      return (
        <span className={isPrimary ? styles.currentTimeStack : styles.currentTimeInline}>
          <span className={styles.currentTimeRow}>
            <span className={styles.currentTimeValue}>{currentTime.time}</span>
            {renderCurrentTimeMeridiem()}
          </span>
        </span>
      )
    }

    const renderTimeRow = (rowHour: string, rowMinute: string, rowSecond: string, meridiem: string) => (
      <span className={styles.currentTimeRow}>
        <span className={`${styles.timeUnit} ${styles.currentTimeUnit}`}>{renderDigitSlots(rowHour)}</span>
        <span className={`${styles.colon} ${styles.clockColon}`}>:</span>
        <span className={`${styles.timeUnit} ${styles.currentTimeUnit}`}>{renderDigitSlots(rowMinute)}</span>
        {rowSecond && (
          <>
            <span className={`${styles.colon} ${styles.clockColon}`}>:</span>
            <span className={`${styles.timeUnit} ${styles.currentTimeUnit}`}>{renderDigitSlots(rowSecond)}</span>
          </>
        )}
        {renderCurrentTimeMeridiem(meridiem)}
      </span>
    )

    return (
      <span className={isPrimary ? styles.currentTimeStack : styles.currentTimeInline}>
        {renderTimeRow(hour, minute, second, currentTime.meridiem)}
      </span>
    )
  }

  const chromeClassName = [
    styles.chrome,
    controlState === "faded" ? styles.chromeFaded : "",
    controlState === "hidden" ? styles.chromeHidden : "",
  ].filter(Boolean).join(" ")
  const containerStyle = {
    "--chimer-timer-color": resolvedTimerDisplayColor,
    "--chimer-clock-color": resolvedCurrentTimeDisplayColor,
  } as CSSProperties
  const primaryDisplayStyle = {
    "--chimer-primary-font-size": `${fontSize}vw`,
    ...(fitFontSize ? { "--chimer-fit-font-size": `${fitFontSize}px` } : {}),
  } as CSSProperties
  const timerSwapClass = swapAnimationTarget
    ? swapAnimationTarget === "timer" ? styles.swapToPrimary : styles.swapToSecondary
    : ""
  const currentTimeSwapClass = swapAnimationTarget
    ? swapAnimationTarget === "currentTime" ? styles.swapToPrimary : styles.swapToSecondary
    : ""

  return (
    <section
      className={`${styles.container} ${isClockMode ? styles.clockMode : ""} ${isAlerting ? styles.alerting : ""}`}
      aria-label={isClockMode ? "Chimer clock" : "Running Chimer timer"}
      style={containerStyle}
    >
      {movingBackgroundEnabled && (
        <MovingBackground
          className={styles.runningBackground}
          mainColor={movingBackgroundMainColor}
          orbColor={movingBackgroundOrbColor}
        />
      )}

      {!isClockMode && (
        <button
          type="button"
          className={`${styles.displayButton} ${isTimerPrimary ? styles.primaryDisplay : styles.secondaryDisplay} ${isTimerPrimary && !hasTimerSeconds ? styles.timerModeCompactTimer : ""} ${styles.timerDisplay} ${timerSwapClass}`}
          onClick={isTimerPrimary ? handlePauseControl : () => handlePrimarySwitch("timer")}
          disabled={isTimerPrimary && isComplete}
          ref={isTimerPrimary ? primaryDisplayRef : undefined}
          style={isTimerPrimary ? primaryDisplayStyle : undefined}
          aria-label={isTimerPrimary ? (isComplete ? "Session complete" : `${primaryActionLabel} from center display`) : "Show timer in center"}
          aria-live={isTimerPrimary ? "polite" : undefined}
          data-testid="running-timer-clock"
        >
          <span ref={isTimerPrimary ? primaryContentRef : undefined} className={styles.displayContent}>
            {renderTimerDisplay()}
          </span>
        </button>
      )}

      <button
        type="button"
        className={`${styles.displayButton} ${isCurrentTimePrimary ? styles.primaryDisplay : styles.secondaryDisplay} ${isCurrentTimePrimary && !isClockMode ? styles.timerModeClockPrimary : ""} ${styles.currentTimeDisplay} ${currentTimeSwapClass}`}
        onClick={isCurrentTimePrimary ? (isClockMode ? revealControls : handlePauseControl) : () => handlePrimarySwitch("currentTime")}
        disabled={isCurrentTimePrimary && isComplete}
        ref={isCurrentTimePrimary ? primaryDisplayRef : undefined}
        data-testid="running-current-time"
        aria-label={isCurrentTimePrimary ? (isClockMode ? "Reveal clock controls" : isComplete ? "Session complete" : `${primaryActionLabel} from center display`) : "Show current time in center"}
        style={isCurrentTimePrimary ? primaryDisplayStyle : undefined}
      >
        <span ref={isCurrentTimePrimary ? primaryContentRef : undefined} className={styles.displayContent}>
          {renderCurrentTimeDisplay(isCurrentTimePrimary)}
        </span>
      </button>

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
          onClick={handleFullscreenControl}
          aria-label="Toggle fullscreen"
          data-chimer-control="true"
        >
          {isFullscreen ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
        </button>

        <button
          ref={settingsButtonRef}
          className={`${styles.control} ${styles.settingsButton}`}
          onClick={handleSettingsButtonClick}
          aria-label={isSettingsOpen ? "Close clock settings" : "Open clock settings"}
          aria-expanded={isSettingsOpen}
          data-chimer-control="true"
        >
          <Settings className="h-5 w-5" />
        </button>

        {isSettingsOpen && (
          <div
            ref={settingsPanelRef}
            className={styles.settingsPanel}
            role="dialog"
            aria-label="Chimer settings"
            data-chimer-control="true"
            data-testid="chimer-settings-panel"
            onPointerDown={handleSettingsPanelActivity}
            onKeyDown={handleSettingsPanelActivity}
            onChange={handleSettingsPanelActivity}
            onInput={handleSettingsPanelActivity}
          >
            <div className={styles.settingsHeaderBar}>
              <div>
                <div className={styles.settingsHeader}>Chimer Settings</div>
                <div className={styles.settingsSubheader}>
                  {isClockMode ? "Clock display and background" : "Active timer controls and preferences"}
                </div>
              </div>
            </div>

            <Tabs value={settingsTab} onValueChange={handleSettingsTabChange} className={styles.settingsTabs}>
              <TabsList className={styles.settingsTabList}>
                {!isClockMode && (
                  <TabsTrigger value="timer" className={styles.settingsTabTrigger}>Timer</TabsTrigger>
                )}
                <TabsTrigger value="display" className={styles.settingsTabTrigger}>Display</TabsTrigger>
                <TabsTrigger value="background" className={styles.settingsTabTrigger}>Colors</TabsTrigger>
              </TabsList>

              {!isClockMode && (
                <TabsContent value="timer" className={styles.settingsTabContent}>
                  <label className={styles.switchRow}>
                    <span>Show timer seconds</span>
                    <input
                      type="checkbox"
                      checked={resolvedShowTimerSeconds}
                      onChange={(event) => handleSettingsChange({ showTimerSeconds: event.target.checked })}
                    />
                  </label>

                  {canEditActiveTimer ? (
                    <>
                      <div className={styles.settingsSection}>
                        <div className={styles.settingsSectionHeader}>
                          <span>Remaining time</span>
                          <span className={styles.settingsPill}>Active only</span>
                        </div>
                        <div className={styles.quickAdjustGrid} aria-label="Adjust remaining time">
                          <button type="button" onClick={() => handleActiveRemainingStep(-5)}>-5m</button>
                          <button type="button" onClick={() => handleActiveRemainingStep(-1)}>-1m</button>
                          <button type="button" onClick={() => handleActiveRemainingStep(1)}>+1m</button>
                          <button type="button" onClick={() => handleActiveRemainingStep(5)}>+5m</button>
                        </div>
                        <div className={styles.exactTimeGrid}>
                          <label className={styles.numberField}>
                            <span>Hours</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={activeRemainingHours}
                              onChange={(event) => handleActiveRemainingHoursChange(event.target.value)}
                              aria-label="Exact remaining hours"
                            />
                          </label>
                          <label className={styles.numberField}>
                            <span>Minutes</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9]*"
                              value={activeRemainingMinutes}
                              onChange={(event) => handleActiveRemainingMinutesChange(event.target.value)}
                              aria-label="Exact remaining minutes"
                            />
                          </label>
                        </div>
                      </div>

                      <div className={styles.settingsSection}>
                        <div className={styles.settingsSectionHeader}>
                          <span>Chime interval</span>
                          <span className={styles.settingsPill}>Active only</span>
                        </div>
                        <label className={styles.numberField}>
                          <span>Minutes between chimes</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={activeIntervalMinutes ?? ""}
                            onChange={(event) => handleActiveIntervalChange(event.target.value)}
                            aria-label="Active chime interval minutes"
                          />
                        </label>
                      </div>
                    </>
                  ) : (
                    <div className={styles.settingsEmptyState}>
                      {isComplete ? "Session complete. Active timer changes are disabled." : "Start or pause a timer to adjust it here."}
                    </div>
                  )}
                </TabsContent>
              )}

              <TabsContent value="display" className={styles.settingsTabContent}>
                <label className={styles.switchRow}>
                  <span>Show clock seconds</span>
                  <input
                    type="checkbox"
                    checked={showCurrentTimeSeconds}
                    onChange={(event) => handleSettingsChange({ showCurrentTimeSeconds: event.target.checked })}
                  />
                </label>

                <div className={styles.formatRow}>
                  <span>Time format</span>
                  <div className={styles.formatToggle} aria-label="Time format">
                    <button
                      type="button"
                      className={`${styles.formatOption} ${timeFormat === "12h" ? styles.formatOptionActive : ""}`}
                      aria-pressed={timeFormat === "12h"}
                      onClick={() => handleSettingsChange({ timeFormat: "12h" })}
                    >
                      12h
                    </button>
                    <button
                      type="button"
                      className={`${styles.formatOption} ${timeFormat === "24h" ? styles.formatOptionActive : ""}`}
                      aria-pressed={timeFormat === "24h"}
                      onClick={() => handleSettingsChange({ timeFormat: "24h" })}
                    >
                      24h
                    </button>
                  </div>
                </div>

                {!isClockMode && (
                  <label className={styles.switchRow}>
                    <span>Keep timer screen awake</span>
                    <input
                      type="checkbox"
                      checked={keepTimerScreenAwake}
                      onChange={(event) => handleSettingsChange({ keepTimerScreenAwake: event.target.checked })}
                    />
                  </label>
                )}

              </TabsContent>

              <TabsContent value="background" className={styles.settingsTabContent}>
                {!canUseCustomColors && (
                  <div className={styles.settingsEmptyState}>
                    <Lock className="inline h-4 w-4" aria-hidden="true" /> Membership unlocks custom Chimer colors.
                  </div>
                )}

                {!isClockMode && (
                  <label className={styles.colorRow}>
                    <span>Primary color</span>
                    <input
                      type="color"
                      value={resolvedPrimaryFontColor}
                      disabled={!canUseCustomColors}
                      onChange={(event) => handleSettingsChange({ primaryFontColor: event.target.value })}
                      aria-label="Primary display color"
                    />
                  </label>
                )}

                <label className={styles.colorRow}>
                  <span>{isClockMode ? "Clock color" : "Secondary color"}</span>
                  <input
                    type="color"
                    value={isClockMode ? resolvedClockModeFontColor : resolvedSecondaryFontColor}
                    disabled={!canUseCustomColors}
                    onChange={(event) => handleSettingsChange(
                      isClockMode
                        ? { clockModeFontColor: event.target.value }
                        : { secondaryFontColor: event.target.value },
                    )}
                    aria-label={isClockMode ? "Clock color" : "Secondary display color"}
                  />
                </label>

                <label className={styles.switchRow}>
                  <span>Moving background</span>
                  <input
                    type="checkbox"
                    checked={movingBackgroundEnabled}
                    onChange={(event) => handleSettingsChange({ movingBackgroundEnabled: event.target.checked })}
                  />
                </label>

                <label className={styles.colorRow}>
                  <span>Main color</span>
                  <input
                    type="color"
                    value={movingBackgroundMainColor}
                    disabled={!canUseCustomColors}
                    onChange={(event) => handleSettingsChange({ movingBackgroundMainColor: event.target.value })}
                    aria-label="Moving background main color"
                  />
                </label>

                <label className={styles.colorRow}>
                  <span>Orb color</span>
                  <input
                    type="color"
                    value={movingBackgroundOrbColor}
                    disabled={!canUseCustomColors}
                    onChange={(event) => handleSettingsChange({ movingBackgroundOrbColor: event.target.value })}
                    aria-label="Moving background orb color"
                  />
                </label>
              </TabsContent>
            </Tabs>
          </div>
        )}

        <div className={styles.bottomControls}>
          <div className={styles.bottomButtonRow}>
            <button className={`${styles.fontButton} ${styles.decreaseFontButton}`} onClick={() => handleFontSizeChange("decrease")} disabled={!canDecreaseFontSize} aria-label="Decrease timer size" data-chimer-control="true">
              <Minus className="h-5 w-5" />
            </button>
            {!isComplete && !isClockMode && (
              <button className={`${styles.control} ${styles.pauseButton}`} onClick={handlePauseControl} aria-label={isPaused ? "Resume timer" : "Pause timer"} data-chimer-control="true">
                {isPaused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}
              </button>
            )}
            <button className={`${styles.fontButton} ${styles.increaseFontButton}`} onClick={() => handleFontSizeChange("increase")} disabled={!canIncreaseFontSize} aria-label="Increase timer size" data-chimer-control="true">
              <Plus className="h-5 w-5" />
            </button>
          </div>
          {!isClockMode && <div className={styles.status}>{statusText}</div>}
        </div>
      </div>
    </section>
  )
}
