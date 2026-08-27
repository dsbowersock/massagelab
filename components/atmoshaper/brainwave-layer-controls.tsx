"use client"

import { RangeControl } from "@/components/ui/range-control"
import { ATMOSHAPER_FREQUENCY_BOUNDS } from "@/lib/atmoshaper/recipe.js"

export type BrainwaveControlValues = {
  carrierHz: number
  rateHz: number
}

export function BrainwaveLayerControls({
  kind,
  onChange,
  values,
}: {
  kind: "binaural" | "isochronic"
  onChange(values: BrainwaveControlValues): void
  values: BrainwaveControlValues
}) {
  const rateLabel = kind === "binaural" ? "Beat frequency difference" : "Pulse rate"

  return (
    <div className="grid gap-3" aria-label={`${kind} advanced controls`}>
      <RangeControl
        label="Carrier pitch"
        min={ATMOSHAPER_FREQUENCY_BOUNDS.carrierHz.min}
        max={ATMOSHAPER_FREQUENCY_BOUNDS.carrierHz.max}
        step={1}
        unit=" Hz"
        value={values.carrierHz}
        onValueChange={(carrierHz) => onChange({ ...values, carrierHz })}
      />
      <RangeControl
        label={rateLabel}
        min={ATMOSHAPER_FREQUENCY_BOUNDS.rateHz.min}
        max={ATMOSHAPER_FREQUENCY_BOUNDS.rateHz.max}
        step={0.5}
        unit=" Hz"
        value={values.rateHz}
        onValueChange={(rateHz) => onChange({ ...values, rateHz })}
      />
    </div>
  )
}
