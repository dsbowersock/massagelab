"use client"

import type { CSSProperties } from "react"

import { RangeControl } from "@/components/ui/range-control"
import { clampValue, formatRangeValue } from "@/components/ui/range-utils"
import { cn } from "@/lib/utils"
import styles from "./chimer-controls.module.css"

export type ColorChannel = "hue" | "saturation" | "brightness" | "lightness" | "alpha" | "opacity" | "red" | "green" | "blue"

type ColorSliderValueFormatter = (value: number) => string

export interface HuePreviewStop {
  /** Slider value represented by this calibrated preview color. */
  value: number
  /** May be unwrapped (for example, -256) so interpolation follows the intended direction. */
  hue: number
  saturation?: number
  lightness?: number
}

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
  /** Overrides the standard hue wheel with renderer-calibrated colors in ascending value order. */
  huePreviewStops?: readonly HuePreviewStop[]
}

const HUE_RAMP_STOPS = [0, 60, 120, 180, 240, 300, 360] as const

function normalizeHue(value: number) {
  return ((value % 360) + 360) % 360
}

function formatHuePreviewColor(stop: HuePreviewStop) {
  return `hsl(${normalizeHue(stop.hue)} ${stop.saturation ?? 100}% ${stop.lightness ?? 50}%)`
}

/** Interpolates unwrapped hues so a renderer-specific preview can run counter to the standard wheel. */
function interpolateHuePreview(value: number, stops: readonly HuePreviewStop[]) {
  const first = stops[0]
  const last = stops[stops.length - 1]

  if (!first || !last) {
    return null
  }
  if (value <= first.value) {
    return first
  }
  if (value >= last.value) {
    return last
  }

  for (let index = 1; index < stops.length; index += 1) {
    const end = stops[index]
    const start = stops[index - 1]

    if (!start || !end || value > end.value) {
      continue
    }

    const span = end.value - start.value
    const progress = span <= 0 ? 0 : (value - start.value) / span

    return {
      value,
      hue: start.hue + (end.hue - start.hue) * progress,
      saturation: (start.saturation ?? 100)
        + ((end.saturation ?? 100) - (start.saturation ?? 100)) * progress,
      lightness: (start.lightness ?? 50)
        + ((end.lightness ?? 50) - (start.lightness ?? 50)) * progress,
    }
  }

  return last
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
  huePreviewStops,
}: ColorSliderProps) {
  const safeValue = clampValue(value, min, max)
  const displayValue = formatRangeValue(safeValue, unit, valueFormatter)
  const normalizedHueDegrees = max === min ? 0 : ((safeValue - min) / (max - min)) * 360
  const standardHuePreviewStops = HUE_RAMP_STOPS.map((degrees, index) => ({
    value: min + ((max - min) * degrees) / 360,
    hue: degrees + huePreviewOffset,
    lightness: index === 2 ? 45 : index === 3 ? 48 : index === 4 ? 58 : index === 5 ? 52 : 50,
  }))
  const effectiveHuePreviewStops = huePreviewStops?.length ? huePreviewStops : standardHuePreviewStops
  const currentHuePreview = interpolateHuePreview(safeValue, effectiveHuePreviewStops)
  const hueTrack = `linear-gradient(90deg, ${effectiveHuePreviewStops.map((stop) => {
    const position = max === min ? 0 : ((stop.value - min) / (max - min)) * 100
    return `${formatHuePreviewColor(stop)} ${clampValue(position, 0, 100)}%`
  }).join(", ")})`
  const sliderStyle = channel === "hue"
    ? {
      "--ml-slider-hue-color": currentHuePreview
        ? formatHuePreviewColor(currentHuePreview)
        : `hsl(${normalizeHue(normalizedHueDegrees + huePreviewOffset)} 100% 50%)`,
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
