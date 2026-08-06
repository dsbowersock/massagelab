"use client"

import { ColorSlider } from "@/components/chimer-controls/ColorSlider"

export interface VortexParticleHueControlProps {
  value: number
  onChange: (value: number) => void
  disabled?: boolean
}

/** Controls the starting hue while preserving Vortex's authored continuous 100-degree range. */
export function VortexParticleHueControl({
  value,
  onChange,
  disabled,
}: VortexParticleHueControlProps) {
  return (
    <ColorSlider
      label="Particle hue"
      channel="hue"
      value={value}
      min={0}
      max={360}
      step={1}
      unit="°"
      description="Sets the starting hue for Vortex's continuous 100° particle range."
      disabled={disabled}
      onChange={onChange}
    />
  )
}
