"use client"

import type { BackgroundPropertyControlsProps } from "@/components/chimer-controls/background-property-control-types"
import { BackgroundPropertyGroup } from "@/components/chimer-controls/BackgroundPropertyGroup"
import { StyledRangeControl } from "@/components/chimer-controls/StyledRangeControl"
import { SelectField } from "@/components/ui/select-field"
import {
  distributeStaticGradientStops,
  STATIC_GRADIENT_RADIAL_SHAPES,
  STATIC_GRADIENT_RADIAL_SIZES,
  STATIC_GRADIENT_TYPES,
} from "@/lib/static-gradient-background"
import styles from "./BackgroundPropertyGroup.module.css"

export interface StaticGradientControlOptions {
  type: "linear" | "radial"
  colorCount: number
  angle: number
  centerX: number
  centerY: number
  radialShape: "circle" | "ellipse"
  radialSize: "closest-side" | "farthest-side" | "closest-corner" | "farthest-corner"
  stopPositions: number[]
}

const RADIAL_SIZE_LABELS: Record<StaticGradientControlOptions["radialSize"], string> = {
  "closest-side": "Closest side",
  "farthest-side": "Farthest side",
  "closest-corner": "Closest corner",
  "farthest-corner": "Farthest corner",
}

/** Emits property-only patches so the shared Visual draft owns undo, reset, and persistence. */
export function StaticGradientControls({
  value,
  disabled = false,
  onChange,
}: BackgroundPropertyControlsProps<StaticGradientControlOptions>) {
  const changeStop = (index: number, nextValue: number) => {
    const previousStop = index > 0 ? value.stopPositions[index - 1] : 0
    const nextStop = index < value.colorCount - 1 ? value.stopPositions[index + 1] : 100
    const stopPositions = [...value.stopPositions]
    stopPositions[index] = Math.min(nextStop, Math.max(previousStop, nextValue))
    onChange({ stopPositions })
  }

  return (
    <div className={styles.backgroundPropertyGroups} data-testid="static-gradient-controls">
      <BackgroundPropertyGroup label="Gradient">
        <SelectField
          label="Type"
          value={value.type}
          disabled={disabled}
          density="compact"
          onChange={(event) => onChange({
            type: event.currentTarget.value as StaticGradientControlOptions["type"],
          })}
        >
          {STATIC_GRADIENT_TYPES.map((type) => (
            <option key={type} value={type}>{type === "linear" ? "Linear" : "Radial"}</option>
          ))}
        </SelectField>
        <StyledRangeControl
          label="Colors"
          value={value.colorCount}
          min={2}
          max={7}
          step={1}
          disabled={disabled}
          displayValue={String(value.colorCount)}
          onChange={(nextValue) => {
            const colorCount = Math.round(nextValue)
            onChange({
              colorCount,
              stopPositions: distributeStaticGradientStops(colorCount),
            })
          }}
        />
        {value.type === "linear" ? (
          <StyledRangeControl
            label="Direction"
            value={value.angle}
            min={0}
            max={360}
            step={1}
            disabled={disabled}
            displayValue={`${Math.round(value.angle)}°`}
            description="Rotates the direction of the gradient."
            onChange={(angle) => onChange({ angle })}
          />
        ) : null}
      </BackgroundPropertyGroup>

      {value.type === "radial" ? (
        <BackgroundPropertyGroup label="Radial shape">
          <SelectField
            label="Shape"
            value={value.radialShape}
            disabled={disabled}
            density="compact"
            onChange={(event) => onChange({
              radialShape: event.currentTarget.value as StaticGradientControlOptions["radialShape"],
            })}
          >
            {STATIC_GRADIENT_RADIAL_SHAPES.map((shape) => (
              <option key={shape} value={shape}>{shape === "circle" ? "Circle" : "Ellipse"}</option>
            ))}
          </SelectField>
          <SelectField
            label="Reach"
            value={value.radialSize}
            disabled={disabled}
            density="compact"
            description="Chooses which edge or corner the outer color reaches."
            onChange={(event) => onChange({
              radialSize: event.currentTarget.value as StaticGradientControlOptions["radialSize"],
            })}
          >
            {STATIC_GRADIENT_RADIAL_SIZES.map((size) => (
              <option key={size} value={size}>
                {RADIAL_SIZE_LABELS[size as StaticGradientControlOptions["radialSize"]]}
              </option>
            ))}
          </SelectField>
          <StyledRangeControl label="Center X" value={value.centerX} min={0} max={100} step={1} disabled={disabled} displayValue={`${Math.round(value.centerX)}%`} onChange={(centerX) => onChange({ centerX })} />
          <StyledRangeControl label="Center Y" value={value.centerY} min={0} max={100} step={1} disabled={disabled} displayValue={`${Math.round(value.centerY)}%`} onChange={(centerY) => onChange({ centerY })} />
        </BackgroundPropertyGroup>
      ) : null}

      <BackgroundPropertyGroup label="Color stops">
        {Array.from({ length: value.colorCount }, (_, index) => (
          <StyledRangeControl
            key={index}
            label={`Color ${index + 1} position`}
            value={value.stopPositions[index]}
            min={index > 0 ? value.stopPositions[index - 1] : 0}
            max={index < value.colorCount - 1 ? value.stopPositions[index + 1] : 100}
            step={1}
            disabled={disabled}
            displayValue={`${Math.round(value.stopPositions[index])}%`}
            onChange={(nextValue) => changeStop(index, nextValue)}
          />
        ))}
      </BackgroundPropertyGroup>
    </div>
  )
}
