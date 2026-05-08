"use client"

import { Clock, Play } from "lucide-react"
import { PageHeading } from "@/components/ui/page-heading"
import styles from "./set-timer.module.css"

export interface ChimerSettings {
  hours: number
  minutes: number
  intervalType: "preset" | "custom" | "areas"
  customInterval: number
  areasToMassage: number
  alertType: "chime" | "flash" | "both" | "silent"
  movingBackgroundEnabled: boolean
  showCurrentTimeSeconds: boolean
  timeFormat: "12h" | "24h"
  movingBackgroundMainColor: string
  movingBackgroundOrbColor: string
}

type AccountSyncStatus = "checking" | "local" | "synced" | "conflict"

interface SetTimerProps {
  settings: ChimerSettings
  totalDurationMs: number
  error: string | null
  syncStatus: AccountSyncStatus
  isResolvingSync: boolean
  onTimeClick: (unit: "hours" | "minutes") => void
  onSettingsChange: (settings: Partial<ChimerSettings>) => void
  onStartTimer: () => void
  onStartClock: () => void
  onTestAlert: () => void
  onUseDeviceSettings: () => void
  onUseSavedSettings: () => void
}

export function SetTimer({
  settings,
  totalDurationMs,
  error,
  syncStatus,
  isResolvingSync,
  onTimeClick,
  onSettingsChange,
  onStartTimer,
  onStartClock,
  onTestAlert,
  onUseDeviceSettings,
  onUseSavedSettings,
}: SetTimerProps) {
  const isTimerSet = totalDurationMs > 0
  const syncMessage = {
    checking: "Checking account sync. Changes stay on this device until sync is available.",
    local: "Settings stay on this device. Sign in or create an account to sync Chimer settings across devices.",
    synced: "You're signed in. Chimer settings sync across devices.",
    conflict: "You're signed in. Choose whether this device or your saved favorites should control Chimer settings.",
  }[syncStatus]

  return (
    <section className={styles.container} aria-labelledby="chimer-heading">
      <div className={styles.header}>
        <PageHeading>Chimer</PageHeading>
        <p className={styles.subtitle}>Session timer for treatment pacing.</p>
      </div>

      <div className={styles.syncNotice}>
        <p>{syncMessage}</p>
        {syncStatus === "conflict" && (
          <div className={styles.syncActions}>
            <button type="button" className={styles.syncButton} onClick={onUseDeviceSettings} disabled={isResolvingSync}>
              Keep this device settings
            </button>
            <button type="button" className={styles.syncButton} onClick={onUseSavedSettings} disabled={isResolvingSync}>
              Use saved favorites
            </button>
          </div>
        )}
      </div>

      <button
        type="button"
        className={styles.clock}
        onClick={() => onTimeClick("minutes")}
        aria-label="Set session length"
      >
        <span className={`${styles.timerStatusBadge} ${isTimerSet ? styles.timerSet : styles.timerUnset}`}>
          {isTimerSet ? "Set" : "Unset"}
        </span>
        <span className={styles.timeUnit} onClick={(event) => {
          event.stopPropagation()
          onTimeClick("hours")
        }}>
          {settings.hours.toString().padStart(2, "0")}
        </span>
        <span className={styles.colon}>:</span>
        <span className={styles.timeUnit} onClick={(event) => {
          event.stopPropagation()
          onTimeClick("minutes")
        }}>
          {settings.minutes.toString().padStart(2, "0")}
        </span>
      </button>

      <button type="button" className={styles.clockModeButton} onClick={onStartClock}>
        <Clock className="h-5 w-5" />
        Clock Mode
      </button>

      <div className={styles.grid}>
        <label className={styles.formGroup} htmlFor="interval-type">
          <span>Alert Frequency</span>
          <select
            id="interval-type"
            value={settings.intervalType}
            onChange={(event) => onSettingsChange({ intervalType: event.target.value as ChimerSettings["intervalType"] })}
          >
            <option value="preset">Preset interval</option>
            <option value="custom">Custom interval</option>
            <option value="areas">Divide by body areas</option>
          </select>
        </label>

        {(settings.intervalType === "preset" || settings.intervalType === "custom") && (
          <label className={styles.formGroup} htmlFor="custom-interval-input">
            <span>{settings.intervalType === "preset" ? "Preset minutes" : "Custom minutes"}</span>
            {settings.intervalType === "preset" ? (
              <select
                id="custom-interval-input"
                value={settings.customInterval}
                onChange={(event) => onSettingsChange({ customInterval: Number(event.target.value) })}
              >
                <option value="1">1 minute</option>
                <option value="5">5 minutes</option>
                <option value="10">10 minutes</option>
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
              </select>
            ) : (
              <input
                type="number"
                id="custom-interval-input"
                min="1"
                max="240"
                value={settings.customInterval}
                onChange={(event) => onSettingsChange({ customInterval: Number(event.target.value) })}
              />
            )}
          </label>
        )}

        {settings.intervalType === "areas" && (
          <label className={styles.formGroup} htmlFor="areas-input">
            <span>Body areas</span>
            <input
              type="number"
              id="areas-input"
              min="1"
              max="24"
              value={settings.areasToMassage}
              onChange={(event) => onSettingsChange({ areasToMassage: Number(event.target.value) })}
            />
          </label>
        )}

        <label className={styles.formGroup} htmlFor="alert-type">
          <span>Alert type</span>
          <select
            id="alert-type"
            value={settings.alertType}
            onChange={(event) => onSettingsChange({ alertType: event.target.value as ChimerSettings["alertType"] })}
          >
            <option value="chime">Chime</option>
            <option value="flash">Screen flash</option>
            <option value="both">Chime and flash</option>
            <option value="silent">Silent</option>
          </select>
        </label>
      </div>

      {error && <p className={styles.error}>{error}</p>}

      <div className={styles.actions}>
        <button type="button" className={styles.secondaryButton} onClick={onTestAlert}>
          Test Alert
        </button>
        <button
          type="button"
          className={styles.button}
          onClick={onStartTimer}
          disabled={totalDurationMs <= 0}
        >
          <Play className="h-5 w-5" />
          Start Timer
        </button>
      </div>
    </section>
  )
}
