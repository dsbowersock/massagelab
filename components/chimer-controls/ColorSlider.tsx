"use client"

import { RangeControl } from "@/components/ui/range-control"
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
  const safeValue = clampColorValue(value, min, max)
  const displayValue = formatColorValue(safeValue, unit, valueFormatter)
  const hueDegrees = max === min ? 0 : ((safeValue - min) / (max - min)) * 360
  const sliderStyle = channel === "hue"
    ? { "--ml-slider-hue-color": `hsl(${hueDegrees} 100% 50%)` }
    : undefined

  return (
    <RangeControl
      label={label}
      value={safeValue}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      description={description}
      displayValue={displayValue}
      aria-label={label}
      className={cn(styles.controlCard, styles.colorSlider, channel === "hue" && "ml-slider-hue", className)}
      style={sliderStyle}
      onValueChange={(nextValue) => {
        if (Number.isFinite(nextValue)) {
          onChange(clampColorValue(nextValue, min, max))
        }
      }}
    />
  )
}
