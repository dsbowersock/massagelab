"use client"

import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"

interface TuningPanelProps {
  surface: "backgrounds" | "stations"
  presentation: "existing" | "cover-flow" | "three-d"
  value: Record<string, number | boolean>
  effectiveLoop: boolean
  reducedMotion: boolean
  onChange: (next: Record<string, number | boolean>) => void
  onReset: () => void
}

const sharedFields = [
  ["cardWidth", "Card width", 160, 320, 4, "px"],
  ["gap", "Gap", 0, 64, 2, "px"],
  ["visibleRadius", "Nearby radius", 1, 4, 1, ""],
] as const

const existingBackgroundFields = [
  ["spread", "Angular spread", 15, 50, 1, "deg"],
  ["radius", "Radius", 160, 420, 5, "px"],
  ["scaleFalloff", "Scale falloff", 0.04, 0.15, 0.01, ""],
] as const

const coverFlowFields = [
  ["rotation", "Side rotation", 0, 55, 1, "deg"],
  ["centerScale", "Center scale", 1, 1.35, 0.01, "x"],
  ["edgeScale", "Edge scale", 0.6, 1, 0.01, "x"],
  ["perspective", "Perspective", 400, 1600, 20, "px"],
  ["reflectionOpacity", "Reflection opacity", 0, 0.65, 0.05, ""],
  ["reflectionGap", "Reflection gap", 0, 24, 1, "px"],
] as const

const threeDFields = [
  ["perspective", "Perspective", 240, 1200, 20, "px"],
  ["arcAngle", "Arc angle", 12, 50, 1, "deg"],
  ["depth", "Depth", 80, 520, 10, "px"],
  ["centerScale", "Center scale", 1, 1.3, 0.01, "x"],
  ["edgeScale", "Edge scale", 0.55, 1, 0.01, "x"],
  ["nearMask", "Near mask falloff", 0.25, 1.5, 0.05, ""],
  ["farMask", "Far mask falloff", 1, 3, 0.05, ""],
] as const

type TuningField = readonly [
  key: string,
  label: string,
  min: number,
  max: number,
  step: number,
  unit: string,
]

function formatTuningValue(value: number, step: number, unit: string) {
  const precision = step >= 1 ? 0 : step >= 0.1 ? 1 : 2
  return `${value.toFixed(precision)}${unit}`
}

/** Edits only the active surface/presentation record owned by CarouselLab. */
export function TuningPanel({
  surface,
  presentation,
  value,
  effectiveLoop,
  reducedMotion,
  onChange,
  onReset,
}: TuningPanelProps) {
  const adapterFields: readonly TuningField[] = presentation === "cover-flow"
    ? coverFlowFields
    : presentation === "three-d"
      ? threeDFields
      : surface === "backgrounds"
        ? existingBackgroundFields
        : []
  const fields: readonly TuningField[] = [...sharedFields, ...adapterFields]

  return (
    <aside
      className="grid content-start gap-5 rounded-xl border border-border bg-card p-4"
      aria-label="Carousel tuning controls"
    >
      <div>
        <h2 className="text-base font-semibold">Tuning</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Saved on this device for the active comparison pair.
        </p>
      </div>

      <div className="grid gap-4">
        {fields.map(([field, label, min, descriptorMax, step, unit]) => {
          const max = field === "cardWidth"
            ? surface === "backgrounds" ? 280 : 320
            : descriptorMax
          const numericValue = Number(value[field])
          const inputValue = Number.isFinite(numericValue) ? numericValue : min
          const inputId = `carousel-tuning-${field}`

          return (
            <div key={field} className="grid gap-1.5">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <label htmlFor={inputId} className="font-medium">{label}</label>
                <output htmlFor={inputId} className="tabular-nums text-muted-foreground">
                  {formatTuningValue(inputValue, step, unit)}
                </output>
              </div>
              <input
                id={inputId}
                data-testid={inputId}
                type="range"
                min={min}
                max={max}
                step={step}
                value={inputValue}
                onChange={(event) => onChange({
                  ...value,
                  [field]: Number(event.currentTarget.value),
                })}
                className="w-full accent-primary"
              />
            </div>
          )
        })}
      </div>

      <div className="grid gap-3 border-t border-border pt-4">
        <div className="flex items-center justify-between gap-4">
          <label htmlFor="carousel-tuning-loop" className="text-sm font-medium">
            Loop
          </label>
          <Switch
            id="carousel-tuning-loop"
            data-testid="carousel-tuning-loop"
            checked={value.loop === true}
            onCheckedChange={(checked) => onChange({ ...value, loop: checked })}
            aria-label="Loop"
          />
        </div>
        {value.loop === true && !effectiveLoop ? (
          <p className="text-xs text-muted-foreground">Loop unavailable for this item count</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            {effectiveLoop ? "Loop active" : "Loop off"}
          </p>
        )}

        <div className="flex items-center justify-between gap-4">
          <label htmlFor="carousel-tuning-motion" className="text-sm font-medium">
            Motion
          </label>
          <Switch
            id="carousel-tuning-motion"
            data-testid="carousel-tuning-motion"
            checked={value.motion !== false}
            onCheckedChange={(checked) => onChange({ ...value, motion: checked })}
            aria-label="Motion"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {reducedMotion ? "Reduced-motion rail" : "Carousel motion active"}
        </p>

        {presentation === "cover-flow" ? (
          <div className="flex items-center justify-between gap-4">
            <label htmlFor="carousel-tuning-reflection" className="text-sm font-medium">
              Reflection
            </label>
            <Switch
              id="carousel-tuning-reflection"
              data-testid="carousel-tuning-reflection"
              checked={value.reflection === true}
              onCheckedChange={(checked) => onChange({ ...value, reflection: checked })}
              aria-label="Reflection"
            />
          </div>
        ) : null}
      </div>

      <Button type="button" variant="outline" onClick={onReset}>
        Reset current pair
      </Button>
    </aside>
  )
}
