"use client"

import { RangeControl } from "@/components/ui/range-control"
import { triggerHapticFeedback } from "@/lib/haptics"

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
 * Chimer-facing compatibility wrapper around the shared labeled slider. It
 * preserves Chimer's number-value API and optional haptic start feedback while
 * letting the sitewide RangeControl own the visual treatment.
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
  const safeValue = clampValue(value, min, max)
  const labelText = displayValue ?? (valueFormatter ? valueFormatter(safeValue) : formatRangeValue(safeValue, unit))

  return (
    <RangeControl
      label={label}
      value={safeValue}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      description={description}
      displayValue={labelText}
      className={className}
      onPointerDownCapture={() => triggerHapticFeedback(disabled ? false : hapticsEnabled, hapticDurationMs)}
      onValueChange={onChange}
    />
  )
}
