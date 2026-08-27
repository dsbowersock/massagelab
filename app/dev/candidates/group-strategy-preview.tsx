"use client"

import { Button } from "@/components/ui/button"
import styles from "./group-strategy-preview.module.css"

export type ContinuousPreviewSettings = {
  transitionMode: "end-to-end" | "crossfade" | "overlap"
  transitionSeconds: number
}
export type CadencePreviewSettings = { stepsPerMinute: number; jitterPercent: number }
export type SpacedPreviewSettings = { minimumGapSeconds: number; maximumGapSeconds: number }
export type PreviewSettings = ContinuousPreviewSettings | CadencePreviewSettings | SpacedPreviewSettings
export type PreviewSource = { sourceId: string; relativePath: string }
export type PreviewStatus = {
  state: "idle" | "playing" | "error"
  groupId?: string
  sourceId?: string
  relativePath?: string
  message?: string
}

/** Strategy-specific audition controls; the parent owns the sole audio player and review evidence. */
export function GroupStrategyPreview({
  groupLabel,
  strategyId,
  previewSettings,
  sources,
  isActive,
  status,
  onSettingsChange,
  onStart,
  onStop,
  onAdvance,
}: {
  groupLabel: string
  strategyId: string
  previewSettings: PreviewSettings
  sources: readonly PreviewSource[]
  isActive: boolean
  status: PreviewStatus
  onSettingsChange: (settings: PreviewSettings) => void
  onStart: () => void
  onStop: () => void
  onAdvance: () => void
}) {
  const continuous = strategyId === "adaptive-whole-source-sequence" || strategyId === "adaptive-one-shot-sequence"
  const advanceLabel = continuous ? "Next transition" : "Next event"

  return (
    <section className={styles.preview} aria-label={`Audible strategy preview for ${groupLabel}`}>
      <div className={styles.heading}>
        <div>
          <strong>Audible strategy preview</strong>
          <p>One group plays at a time. Adjusting any control stops playback and requires a fresh listen.</p>
        </div>
      </div>

      <div className={styles.settings}>
        {continuous && "transitionMode" in previewSettings ? (
          <>
            <label>
              <span>Boundary treatment</span>
              <select
                value={previewSettings.transitionMode}
                onChange={(event) => {
                  const transitionMode = event.target.value as ContinuousPreviewSettings["transitionMode"]
                  onSettingsChange({
                    transitionMode,
                    transitionSeconds: transitionMode === "end-to-end"
                      ? 0
                      : previewSettings.transitionSeconds || 2,
                  })
                }}
              >
                <option value="end-to-end">End to end</option>
                <option value="crossfade">Crossfade</option>
                <option value="overlap">Overlap</option>
              </select>
            </label>
            <RangeSetting
              label="Transition seconds"
              value={previewSettings.transitionSeconds}
              minimum={0.25}
              maximum={10}
              step={0.25}
              disabled={previewSettings.transitionMode === "end-to-end"}
              onChange={(transitionSeconds) => onSettingsChange({ ...previewSettings, transitionSeconds })}
            />
          </>
        ) : null}

        {strategyId === "walking-cadence-sequence" && "stepsPerMinute" in previewSettings ? (
          <>
            <RangeSetting
              label="Steps per minute"
              value={previewSettings.stepsPerMinute}
              minimum={40}
              maximum={180}
              step={1}
              onChange={(stepsPerMinute) => onSettingsChange({ ...previewSettings, stepsPerMinute })}
            />
            <RangeSetting
              label="Cadence variation"
              value={previewSettings.jitterPercent}
              suffix="%"
              minimum={0}
              maximum={30}
              step={1}
              onChange={(jitterPercent) => onSettingsChange({ ...previewSettings, jitterPercent })}
            />
          </>
        ) : null}

        {strategyId === "spaced-event-sequence" && "minimumGapSeconds" in previewSettings ? (
          <>
            <RangeSetting
              label="Minimum gap"
              value={previewSettings.minimumGapSeconds}
              suffix="s"
              minimum={0}
              maximum={30}
              step={0.5}
              onChange={(minimumGapSeconds) => onSettingsChange({
                minimumGapSeconds,
                maximumGapSeconds: Math.max(minimumGapSeconds, previewSettings.maximumGapSeconds),
              })}
            />
            <RangeSetting
              label="Maximum gap"
              value={previewSettings.maximumGapSeconds}
              suffix="s"
              minimum={0}
              maximum={60}
              step={0.5}
              onChange={(maximumGapSeconds) => onSettingsChange({
                minimumGapSeconds: Math.min(previewSettings.minimumGapSeconds, maximumGapSeconds),
                maximumGapSeconds,
              })}
            />
          </>
        ) : null}
      </div>

      <div className={styles.transport}>
        <Button type="button" onClick={onStart} disabled={sources.length === 0 || isActive}>
          Start preview
        </Button>
        <Button type="button" variant="outline" onClick={onStop} disabled={!isActive}>Stop preview</Button>
        <Button type="button" variant="outline" onClick={onAdvance} disabled={!isActive}>{advanceLabel}</Button>
        <span>{sources.length} included ingredient{sources.length === 1 ? "" : "s"}</span>
      </div>

      {sources.length === 0 ? (
        <p className={styles.warning}>This concept has no included recordings to preview. The concept stays active.</p>
      ) : null}
      {status.state === "playing" && status.relativePath ? (
        <p className={styles.status} aria-live="polite">Playing: {fileName(status.relativePath)}</p>
      ) : null}
      {status.state === "error" ? (
        <p className={styles.error} role="alert">Preview failed: {status.message ?? "The recording could not be played."}</p>
      ) : null}
    </section>
  )
}

function RangeSetting({
  label,
  value,
  suffix = "",
  minimum,
  maximum,
  step,
  disabled = false,
  onChange,
}: {
  label: string
  value: number
  suffix?: string
  minimum: number
  maximum: number
  step: number
  disabled?: boolean
  onChange: (value: number) => void
}) {
  return (
    <label className={styles.range}>
      <span>{label} <strong>{value}{suffix}</strong></span>
      <input
        type="range"
        value={value}
        min={minimum}
        max={maximum}
        step={step}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  )
}

function fileName(relativePath: string) {
  return relativePath.split(/[\\/]/).at(-1) ?? relativePath
}
