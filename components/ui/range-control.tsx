"use client"

import * as React from "react"

import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"

export type RangeControlValueFormatter = (value: number) => string

export interface RangeControlProps
  extends Omit<React.ComponentPropsWithoutRef<typeof Slider>, "value" | "defaultValue" | "onValueChange"> {
  label: string
  value?: number
  defaultValue?: number
  onValueChange?: (value: number) => void
  description?: string
  displayValue?: string
  valueFormatter?: RangeControlValueFormatter
  unit?: string
}

function clampValue(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function formatRangeValue(value: number, unit?: string, formatter?: RangeControlValueFormatter) {
  if (formatter) {
    return formatter(value)
  }

  return unit ? `${value}${unit}` : String(value)
}

/**
 * Shared labeled/value slider for settings that need their current value visible
 * in the control. The underlying Radix slider remains the interaction surface;
 * CSS clips the visual track into the split-half treatment.
 */
export function RangeControl({
  label,
  value,
  defaultValue,
  onValueChange,
  min = 0,
  max = 100,
  step = 1,
  description,
  displayValue,
  valueFormatter,
  unit,
  disabled,
  className,
  ...props
}: RangeControlProps) {
  const labelId = React.useId()
  const descriptionId = description ? `${labelId}-description` : undefined
  const isControlled = typeof value === "number"
  const [uncontrolledValue, setUncontrolledValue] = React.useState(() => clampValue(defaultValue ?? min, min, max))
  const safeValue = clampValue(isControlled ? value : uncontrolledValue, min, max)
  const labelText = displayValue ?? formatRangeValue(safeValue, unit, valueFormatter)

  return (
    <section className={cn("ml-range-control", className)}>
      <div className="ml-range-control-shell">
        <Slider
          aria-labelledby={labelId}
          aria-describedby={descriptionId}
          min={min}
          max={max}
          step={step}
          value={[safeValue]}
          disabled={disabled}
          onValueChange={([nextValue]) => {
            const resolvedValue = clampValue(nextValue ?? min, min, max)
            if (!isControlled) {
              setUncontrolledValue(resolvedValue)
            }
            onValueChange?.(resolvedValue)
          }}
          className="ml-range-control-slider"
          {...props}
        />
        <div className="ml-range-control-copy">
          <span id={labelId} className="ml-range-control-label">
            {label}
          </span>
          <span className="ml-range-control-value">{labelText}</span>
        </div>
      </div>
      {description ? (
        <p id={descriptionId} className="ml-range-control-description">
          {description}
        </p>
      ) : null}
    </section>
  )
}
