"use client"

import { useId } from "react"

import { wrapChimerPressHandler, type HapticPressOptions } from "@/components/chimer-controls/haptics"
import { cn } from "@/lib/utils"
import styles from "./chimer-controls.module.css"

type NumberFieldValueFormatter = (value: number) => string

export interface NumberFieldProps {
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  description?: string
  unit?: string
  showSteppers?: boolean
  className?: string
  hapticsEnabled?: boolean
  hapticDurationMs?: HapticPressOptions["hapticDurationMs"]
  valueFormatter?: NumberFieldValueFormatter
}

function clampNumber(value: number, min: number, max: number) {
  const safeNumber = Number.isFinite(value) ? value : min
  return Math.min(max, Math.max(min, safeNumber))
}

function formatFieldValue(value: number, unit?: string, valueFormatter?: NumberFieldValueFormatter) {
  return valueFormatter ? valueFormatter(value) : `${value}${unit ? ` ${unit}` : ""}`
}

function toNumberInputValue(value: string): number {
  if (value.trim() === "") return 0

  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    return 0
  }

  return parsed
}

/**
 * Number field with compact stepper controls for Chimer background and clock options.
 */
export function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max = Number.POSITIVE_INFINITY,
  step = 1,
  disabled,
  description,
  unit,
  showSteppers = true,
  className,
  hapticsEnabled,
  hapticDurationMs,
  valueFormatter,
}: NumberFieldProps) {
  const inputId = useId()
  const safeValue = clampNumber(value, min, max)
  const minSafe = Number.isFinite(min) ? min : 0
  const maxSafe = Number.isFinite(max) ? max : 100
  const displayValue = formatFieldValue(safeValue, unit, valueFormatter)

  function changeValue(nextRaw: string) {
    const nextValue = clampNumber(toNumberInputValue(nextRaw), minSafe, maxSafe)
    onChange(nextValue)
  }

  function increment(amount: number) {
    changeValue((safeValue + amount).toString())
  }

  return (
    <section className={cn(styles.controlCard, styles.numberFieldRow, className)}>
      <div className={styles.controlRow}>
        <label htmlFor={`chimer-number-${inputId}`} className={styles.controlLabel}>
          {label}
        </label>
        <span className={styles.controlValue}>{displayValue}</span>
      </div>

      {description ? <p className={styles.controlDescription}>{description}</p> : null}
      <div className={styles.numberFieldInputs}>
        <input
          id={`chimer-number-${inputId}`}
          className={styles.numberInput}
          type="number"
          value={Number.isFinite(safeValue) ? safeValue : ""}
          min={minSafe}
          max={maxSafe}
          step={step}
          inputMode="decimal"
          disabled={disabled}
          onChange={(event) => changeValue(event.currentTarget.value)}
          aria-label={label}
        />
        {showSteppers ? (
          <div className={styles.numberStepper}>
            <button
              type="button"
              className={styles.numberStepButton}
              disabled={disabled}
              onClick={wrapChimerPressHandler(() => {
                increment(step)
              }, {
                disabled,
                hapticsEnabled,
                hapticDurationMs,
              })}
              aria-label={`Increase ${label}`}
            >
              +
            </button>
            <button
              type="button"
              className={styles.numberStepButton}
              disabled={disabled}
              onClick={wrapChimerPressHandler(() => {
                increment(-step)
              }, {
                disabled,
                hapticsEnabled,
                hapticDurationMs,
              })}
              aria-label={`Decrease ${label}`}
            >
              −
            </button>
          </div>
        ) : null}
      </div>
    </section>
  )
}
