"use client"

import { useId } from "react"

import { cn } from "@/lib/utils"
import styles from "./chimer-controls.module.css"

export type ColorChannel = "hue" | "saturation" | "brightness" | "lightness" | "alpha" | "opacity" | "red" | "green" | "blue"

type ColorSliderValueFormatter = (value: number) => string

export interface ColorSliderProps {
  label: string
  channel: ColorChannel
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  unit?: string
  description?: string
  className?: string
  valueFormatter?: ColorSliderValueFormatter
}

function clampColorValue(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function formatColorValue(value: number, unit?: string, valueFormatter?: ColorSliderValueFormatter) {
  if (valueFormatter) {
    return valueFormatter(value)
  }

  return unit ? `${value}${unit}` : String(value)
}

/**
 * Single-channel color slider used by hue/sat/lightness/alpha-like controls.
 */
export function ColorSlider({
  label,
  channel,
  value,
  onChange,
  min = 0,
  max = 1,
  step = 0.01,
  disabled,
  unit,
  description,
  className,
  valueFormatter,
}: ColorSliderProps) {
  const sliderId = useId()
  const inputId = `color-slider-${channel}-${sliderId}`
  const descriptionId = description ? `${inputId}-description` : undefined
  const safeValue = clampColorValue(value, min, max)
  const percent = max === min ? 0 : ((safeValue - min) / (max - min)) * 100
  const displayValue = formatColorValue(safeValue, unit, valueFormatter)

  return (
    <section className={cn(styles.controlCard, styles.colorSlider, className)}>
      <div className={styles.controlRow}>
        <label htmlFor={inputId} className={styles.controlLabel}>
          {label}
        </label>
        <span className={styles.controlValue}>{displayValue}</span>
      </div>
      {description ? <p id={descriptionId} className={styles.controlDescription}>{description}</p> : null}
      <input
        id={inputId}
        type="range"
        min={min}
        max={max}
        step={step}
        value={safeValue}
        disabled={disabled}
        aria-label={label}
        aria-describedby={descriptionId}
        className={styles.rangeInput}
        style={{
          "--chimer-range-progress": `${percent}%`,
        } as React.CSSProperties}
        onChange={(event) => {
          const nextValue = Number(event.currentTarget.value)
          if (Number.isFinite(nextValue)) {
            onChange(clampColorValue(nextValue, min, max))
          }
        }}
      />
    </section>
  )
}
