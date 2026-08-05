"use client"

import type { CSSProperties } from "react"

import { RangeControl } from "@/components/ui/range-control"
import { clampValue, formatRangeValue } from "@/components/ui/range-utils"
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
  /** Rotates the visual hue ramp without changing the control's stored value. */
  huePreviewOffset?: number
}

const HUE_RAMP_STOPS = [0, 60, 120, 180, 240, 300, 360] as const

function normalizeHue(value: number) {
  return ((value % 360) + 360) % 360
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
  huePreviewOffset = 0,
}: ColorSliderProps) {
  const safeValue = clampValue(value, min, max)
  const displayValue = formatRangeValue(safeValue, unit, valueFormatter)
  const normalizedHueDegrees = max === min ? 0 : ((safeValue - min) / (max - min)) * 360
  const hueDegrees = normalizeHue(normalizedHueDegrees + huePreviewOffset)
  const hueTrack = `linear-gradient(90deg, ${HUE_RAMP_STOPS.map((degrees, index) => (
    `hsl(${normalizeHue(degrees + huePreviewOffset)} 100% ${index === 2 ? 45 : index === 3 ? 48 : index === 4 ? 58 : index === 5 ? 52 : 50}%) ${(degrees / 360) * 100}%`
  )).join(", ")})`
  const sliderStyle = channel === "hue"
    ? {
      "--ml-slider-hue-color": `hsl(${hueDegrees} 100% 50%)`,
      "--ml-slider-hue-track": hueTrack,
    } as CSSProperties
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
      className={cn(styles.controlCard, styles.colorSlider, channel === "hue" && "ml-slider-hue", className)}
      style={sliderStyle}
      onValueChange={(nextValue) => {
        if (Number.isFinite(nextValue)) {
          onChange(clampValue(nextValue, min, max))
        }
      }}
    />
  )
}
