"use client"

import { useId } from "react"

import { triggerHapticFeedback } from "@/lib/haptics"
import { cn } from "@/lib/utils"
import styles from "./chimer-controls.module.css"

export type StyledRangeValueFormatter = (value: number) => string

export interface StyledRangeControlProps {
  label: string
  value: number
  min: number
  max: number
  onChange: (value: number) => void
  step?: number
  disabled?: boolean
  description?: string
  unit?: string
  displayValue?: string
  valueFormatter?: StyledRangeValueFormatter
  hapticsEnabled?: boolean
  hapticDurationMs?: number
  className?: string
}

function clampValue(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function formatRangeValue(value: number, unit?: string) {
  return unit ? `${value}${unit}` : String(value)
}

/**
 * Control that keeps the visual track fill and label/value layout aligned while
 * remaining a native `<input type="range">` for broad keyboard and assistive
 * support.
 */
export function StyledRangeControl({
  label,
  value,
  min,
  max,
  onChange,
  step = 1,
  disabled,
  description,
  unit,
  displayValue,
  valueFormatter,
  className,
  hapticsEnabled,
  hapticDurationMs,
}: StyledRangeControlProps) {
  const controlId = useId()
  const safeValue = clampValue(value, min, max)
  const rangePercent = ((safeValue - min) / (max - min)) * 100

  const labelText = displayValue ?? (valueFormatter ? valueFormatter(safeValue) : formatRangeValue(safeValue, unit))

  return (
    <section
      className={cn(styles.controlCard, styles.rangeControl, className)}
      style={{
        "--chimer-range-progress": `${rangePercent}%`,
      } as React.CSSProperties}
    >
      <div className={styles.controlRow}>
        <label htmlFor={`range-${controlId}`} className={styles.controlLabel}>
          {label}
        </label>
        <span className={styles.controlValue} aria-live="polite">
          {labelText}
        </span>
      </div>

      <div className={styles.rangeTrackWrap}>
        <input
          id={`range-${controlId}`}
          type="range"
          min={min}
          max={max}
          step={step}
          disabled={disabled}
          value={safeValue}
          aria-valuemin={min}
          aria-valuemax={max}
          aria-valuenow={safeValue}
          aria-label={`${label} slider`}
          className={styles.rangeInput}
          onChange={(event) => {
            const nextValue = Number(event.currentTarget.value)
            if (Number.isFinite(nextValue)) {
              onChange(clampValue(nextValue, min, max))
            }
          }}
          onMouseDown={() => triggerHapticFeedback(disabled ? false : hapticsEnabled, hapticDurationMs)}
          onTouchStart={() => triggerHapticFeedback(disabled ? false : hapticsEnabled, hapticDurationMs)}
        />
      </div>
      {description ? <p className={cn(styles.controlDescription, styles.rangeDescription)}>{description}</p> : null}
    </section>
  )
}
