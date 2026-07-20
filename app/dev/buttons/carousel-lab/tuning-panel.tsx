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

interface TuningField {
  key: string
  label: string
  min: number
  max: number
  step: number
  unit: string
  description: string
}

const sharedFields: readonly TuningField[] = [
  { key: "cardWidth", label: "Card width", min: 160, max: 320, step: 4, unit: "px", description: "Sets each card's visual width." },
  { key: "gap", label: "Gap", min: 0, max: 64, step: 2, unit: "px", description: "Sets the linear space between neighboring card positions." },
  { key: "visibleRadius", label: "Nearby radius", min: 1, max: 4, step: 1, unit: "", description: "Keeps this many cards mounted on each side of the centered card." },
]

const existingBackgroundFields: readonly TuningField[] = [
  { key: "spread", label: "Angular spread", min: 15, max: 50, step: 1, unit: "deg", description: "Sets the angle between cards on the production-style radial arc." },
  { key: "radius", label: "Radius", min: 160, max: 420, step: 5, unit: "px", description: "Sets the size of the radial arc around the centered card." },
  { key: "scaleFalloff", label: "Scale falloff", min: 0.04, max: 0.24, step: 0.01, unit: "", description: "Shrinks each card by this amount for every step away from center." },
]

const coverFlowFields: readonly TuningField[] = [
  { key: "rotation", label: "Side rotation", min: 0, max: 55, step: 1, unit: "deg", description: "Rotates side cards around their inner edge, matching the reference Cover Flow." },
  { key: "centerScale", label: "Center scale", min: 1, max: 1.35, step: 0.01, unit: "x", description: "Enlarges the card as it reaches the center snap." },
  { key: "edgeScale", label: "Edge scale", min: 0.6, max: 1, step: 0.01, unit: "x", description: "Sets the scale of cards as they approach the outer fade." },
  { key: "perspective", label: "Perspective", min: 320, max: 1600, step: 20, unit: "px", description: "Changes how strongly depth is projected; lower values exaggerate the 3D effect." },
  { key: "reflectionOpacity", label: "Reflection opacity", min: 0, max: 1, step: 0.05, unit: "", description: "Sets the brightness of the artwork reflection below each card." },
  { key: "reflectionGap", label: "Reflection gap", min: 0, max: 24, step: 1, unit: "px", description: "Sets the space between artwork and its reflected copy." },
]

const threeDFields: readonly TuningField[] = [
  { key: "perspective", label: "Perspective", min: 50, max: 1500, step: 10, unit: "px", description: "Changes how strongly depth is projected; lower values exaggerate the 3D effect." },
  { key: "ringItems", label: "Ring slots", min: 10, max: 50, step: 1, unit: "", description: "Sets how many card positions complete one full cylinder; the reference uses 16." },
  { key: "depth", label: "Ring depth", min: 0.5, max: 1.5, step: 0.05, unit: "x", description: "Scales the source-derived cylinder radius while preserving its shared ring geometry." },
  { key: "nearMask", label: "Near mask width", min: 0, max: 5, step: 0.1, unit: "x", description: "Keeps this many card widths fully visible around the center." },
  { key: "farMask", label: "Far mask width", min: 0, max: 5, step: 0.1, unit: "x", description: "Controls where the edge fade begins and becomes fully transparent." },
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
        {fields.map(({ key: field, label, min, max: descriptorMax, step, unit, description }) => {
          const max = field === "cardWidth"
            ? surface === "backgrounds" ? 280 : 320
            : descriptorMax
          const numericValue = Number(value[field])
          const inputValue = Number.isFinite(numericValue) ? numericValue : min
          const inputId = `carousel-tuning-${field}`
          const descriptionId = `${inputId}-description`

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
                aria-describedby={descriptionId}
                onChange={(event) => onChange({
                  ...value,
                  [field]: Number(event.currentTarget.value),
                })}
                className="w-full accent-primary"
              />
              <p id={descriptionId} className="text-xs leading-5 text-muted-foreground">
                {description}
              </p>
            </div>
          )
        })}
      </div>

      <div className="grid gap-3 border-t border-border pt-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <label htmlFor="carousel-tuning-loop" className="text-sm font-medium">Loop</label>
            <p id="carousel-tuning-loop-description" className="mt-1 text-xs text-muted-foreground">
              Wraps navigation when there are enough cards for a stable loop.
            </p>
          </div>
          <Switch
            id="carousel-tuning-loop"
            data-testid="carousel-tuning-loop"
            checked={value.loop === true}
            onCheckedChange={(checked) => onChange({ ...value, loop: checked })}
            aria-label="Loop"
            aria-describedby="carousel-tuning-loop-description"
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
          <div>
            <label htmlFor="carousel-tuning-motion" className="text-sm font-medium">Motion</label>
            <p id="carousel-tuning-motion-description" className="mt-1 text-xs text-muted-foreground">
              Animates navigation and presentation geometry; it does not autoplay.
            </p>
          </div>
          <Switch
            id="carousel-tuning-motion"
            data-testid="carousel-tuning-motion"
            checked={value.motion !== false}
            onCheckedChange={(checked) => onChange({ ...value, motion: checked })}
            aria-label="Motion"
            aria-describedby="carousel-tuning-motion-description"
          />
        </div>
        <p className="text-xs text-muted-foreground">
          {reducedMotion ? "Reduced-motion rail" : "Carousel motion active"}
        </p>

        {presentation === "cover-flow" ? (
          <div className="flex items-center justify-between gap-4">
            <div>
              <label htmlFor="carousel-tuning-reflection" className="text-sm font-medium">Reflection</label>
              <p id="carousel-tuning-reflection-description" className="mt-1 text-xs text-muted-foreground">
                Reflects artwork only, keeping live text and actions readable.
              </p>
            </div>
            <Switch
              id="carousel-tuning-reflection"
              data-testid="carousel-tuning-reflection"
              checked={value.reflection === true}
              onCheckedChange={(checked) => onChange({ ...value, reflection: checked })}
              aria-label="Reflection"
              aria-describedby="carousel-tuning-reflection-description"
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
