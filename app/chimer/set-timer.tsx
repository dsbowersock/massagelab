"use client"

import { PageHeading } from "@/components/ui/page-heading"
import styles from "./set-timer.module.css"

interface SetTimerProps {
  timeDisplay: { hours: string; minutes: string; seconds: string }
  intervalType: string
  customInterval: number
  areasToMassage: number
  alertType: string
  onTimeClick: (unit: 'hours' | 'minutes') => void
  onIntervalTypeChange: (value: string) => void
  onCustomIntervalChange: (value: number) => void
  onAreasChange: (value: number) => void
  onAlertTypeChange: (value: string) => void
  onStartTimer: () => void
}

export function SetTimer({
  timeDisplay,
  intervalType,
  customInterval,
  areasToMassage,
  alertType,
  onTimeClick,
  onIntervalTypeChange,
  onCustomIntervalChange,
  onAreasChange,
  onAlertTypeChange,
  onStartTimer
}: SetTimerProps) {
  return (
    <>
      <PageHeading>
        Tap Clock to Set Time ⏰ ⌚
      </PageHeading>

      <div className={styles.clock}>
        <span className={styles.timeUnit} onClick={() => onTimeClick('hours')}>
          {timeDisplay.hours}
        </span>
        <span className={styles.colon}>:</span>
        <span className={styles.timeUnit} onClick={() => onTimeClick('minutes')}>
          {timeDisplay.minutes}
        </span>
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="interval-type">Interval Type:</label>
        <select
          id="interval-type"
          value={intervalType}
          onChange={(e) => onIntervalTypeChange(e.target.value)}
        >
          <option value="preset">Preset Intervals</option>
          <option value="custom">Custom Interval</option>
          <option value="areas">Areas to Massage</option>
        </select>
      </div>

      {intervalType === 'preset' && (
        <div className={styles.formGroup}>
          <label htmlFor="interval">Interval (minutes):</label>
          <select
            id="interval"
            value={customInterval}
            onChange={(e) => onCustomIntervalChange(Number(e.target.value))}
          >
            <option value="1">1</option>
            <option value="5">5</option>
            <option value="10">10</option>
            <option value="15">15</option>
            <option value="30">30</option>
          </select>
        </div>
      )}

      {intervalType === 'custom' && (
        <div className={styles.formGroup}>
          <label htmlFor="custom-interval-input">Custom Interval (minutes):</label>
          <input
            type="number"
            id="custom-interval-input"
            min="1"
            value={customInterval}
            onChange={(e) => onCustomIntervalChange(Number(e.target.value))}
          />
        </div>
      )}

      {intervalType === 'areas' && (
        <div className={styles.formGroup}>
          <label htmlFor="areas-input">Areas to Massage:</label>
          <input
            type="number"
            id="areas-input"
            min="1"
            value={areasToMassage}
            onChange={(e) => onAreasChange(Number(e.target.value))}
          />
        </div>
      )}

      <div className={styles.formGroup}>
        <label htmlFor="alert-type">Alert Type:</label>
        <select
          id="alert-type"
          value={alertType}
          onChange={(e) => onAlertTypeChange(e.target.value)}
        >
          <option value="chime">Chime</option>
          <option value="flash">Screen Flash</option>
        </select>
      </div>

      <button className={styles.button} onClick={onStartTimer}>
        Start Timer
      </button>
    </>
  )
}

