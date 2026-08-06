"use client"

import {
  ColorSlider,
  type HuePreviewStop,
} from "@/components/chimer-controls/ColorSlider"
import { StyledRangeControl } from "@/components/chimer-controls/StyledRangeControl"

// Dark Veil rotates its CPPN output through a clipped YIQ transform, so its
// visible hue runs counter to a normal HSL wheel and becomes nonlinear around
// green. These unwrapped hues are calibrated from the live renderer; keeping
// them unwrapped makes the shared slider interpolate in the same direction.
const DARK_VEIL_HUE_PREVIEW_STOPS: readonly HuePreviewStop[] = [
  { value: -180, hue: 87 },
  { value: -144, hue: 29 },
  { value: -108, hue: -16 },
  { value: -71, hue: -50 },
  { value: -31, hue: -82 },
  { value: 18, hue: -122 },
  { value: 74, hue: -227 },
  { value: 122, hue: -239 },
  { value: 166, hue: -256 },
  { value: 180, hue: -273 },
]

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
      huePreviewStops={DARK_VEIL_HUE_PREVIEW_STOPS}
      description="Rotates Dark Veil's rendered colors; the slider is calibrated to its dominant resulting hue."
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
