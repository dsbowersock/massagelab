"use client"

import { ColorSlider } from "@/components/chimer-controls/ColorSlider"
import { StyledRangeControl } from "@/components/chimer-controls/StyledRangeControl"

// The source shader's dominant saturated region is warm orange. A signed hue
// shift therefore needs a rotated ramp so 0° previews the authored color.
const DARK_VEIL_HUE_PREVIEW_OFFSET = 220

export interface DarkVeilControlProps {
  value: number
  onChange: (value: number) => void
  disabled?: boolean
  hapticsEnabled?: boolean
}

/** Uses the shared color-channel treatment while preserving Dark Veil's signed hue-shift range. */
export function DarkVeilHueShiftControl({ value, onChange, disabled }: DarkVeilControlProps) {
  return (
    <ColorSlider
      label="Hue shift"
      channel="hue"
      value={value}
      min={-180}
      max={180}
      step={1}
      unit="°"
      huePreviewOffset={DARK_VEIL_HUE_PREVIEW_OFFSET}
      description="Rotates Dark Veil's rendered colors; the slider previews its dominant resulting hue."
      disabled={disabled}
      onChange={onChange}
    />
  )
}

/** Presents the stored 0.25-1 render scale as a user-facing 25%-100% quality control. */
export function DarkVeilResolutionScaleControl({
  value,
  onChange,
  disabled,
  hapticsEnabled,
}: DarkVeilControlProps) {
  const displayPercent = value * 100

  return (
    <StyledRangeControl
      label="Resolution scale"
      value={displayPercent}
      min={25}
      max={100}
      step={5}
      unit="%"
      description="Lower values reduce GPU work and intentionally render with larger pixels."
      disabled={disabled}
      hapticsEnabled={hapticsEnabled}
      onChange={(nextPercent) => onChange(nextPercent / 100)}
    />
  )
}
