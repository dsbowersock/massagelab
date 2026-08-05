"use client"

import type { MassageLabDnaOptions } from "@/components/backgrounds/effects/css-backgrounds"
import type { BackgroundPropertyControlsProps } from "@/components/chimer-controls/background-property-control-types"
import { BackgroundPropertyGroup } from "@/components/chimer-controls/BackgroundPropertyGroup"
import { StyledRangeControl } from "@/components/chimer-controls/StyledRangeControl"
import { StyledToggleControl } from "@/components/chimer-controls/StyledToggleControl"
import { SelectField } from "@/components/ui/select-field"
import {
  DNA_OPTION_BOUNDS,
  DNA_SCALE_PERCENT_BOUNDS,
  DNA_SPEED_MULTIPLIER_BOUNDS,
  DNA_STRAND_ROTATION_DIRECTIONS,
  getDnaNodeMotionDisplaySpeed,
  getDnaNodeMotionSourceSpeed,
  getDnaScaleDisplayPercent,
  getDnaScaleFromDisplayPercent,
  getDnaStrandRotationDisplaySpeed,
  getDnaStrandRotationSourceSpeed,
} from "@/lib/dna-background"
import styles from "./BackgroundPropertyGroup.module.css"

export type DnaBackgroundControlOptions = Pick<
  MassageLabDnaOptions,
  | "strandCount"
  | "showBaseLetters"
  | "nodeMotionSpeed"
  | "strandRotationEnabled"
  | "strandRotationSpeed"
  | "strandRotationDirection"
  | "strandAngle"
  | "scale"
  | "positionX"
  | "positionY"
  | "strandSpacing"
  | "nodeSize"
  | "connectorWidth"
  | "connectorThickness"
  | "outlineThickness"
>

/** Emits one option-only patch per slider so the shared Visual draft owns history and persistence. */
export function DnaBackgroundControls({
  value,
  disabled = false,
  onChange,
}: BackgroundPropertyControlsProps<DnaBackgroundControlOptions>) {
  return (
    <div className={styles.backgroundPropertyGroups}>
      <BackgroundPropertyGroup label="Motion">
        <StyledRangeControl
          label="Node motion speed"
          value={getDnaNodeMotionDisplaySpeed(value.nodeMotionSpeed)}
          min={DNA_SPEED_MULTIPLIER_BOUNDS.minimum}
          max={DNA_SPEED_MULTIPLIER_BOUNDS.maximum}
          step={DNA_SPEED_MULTIPLIER_BOUNDS.step}
          disabled={disabled}
          displayValue={`${getDnaNodeMotionDisplaySpeed(value.nodeMotionSpeed).toFixed(1)}x`}
          onChange={(nextValue) => onChange({ nodeMotionSpeed: getDnaNodeMotionSourceSpeed(nextValue) })}
        />
        <StyledToggleControl
          label="Strand rotation"
          checked={value.strandRotationEnabled}
          valueLabel={value.strandRotationEnabled ? "On" : "Off"}
          disabled={disabled}
          onCheckedChange={(nextValue) => onChange({ strandRotationEnabled: nextValue })}
        />
        <StyledRangeControl
          label="Strand rotation speed"
          value={getDnaStrandRotationDisplaySpeed(value.strandRotationSpeed)}
          min={DNA_SPEED_MULTIPLIER_BOUNDS.minimum}
          max={DNA_SPEED_MULTIPLIER_BOUNDS.maximum}
          step={DNA_SPEED_MULTIPLIER_BOUNDS.step}
          disabled={disabled || !value.strandRotationEnabled}
          displayValue={`${getDnaStrandRotationDisplaySpeed(value.strandRotationSpeed).toFixed(1)}x`}
          onChange={(nextValue) => onChange({ strandRotationSpeed: getDnaStrandRotationSourceSpeed(nextValue) })}
        />
        <SelectField
          label="Strand rotation direction"
          value={value.strandRotationDirection}
          disabled={disabled || !value.strandRotationEnabled}
          density="compact"
          onChange={(event) => onChange({
            strandRotationDirection: event.currentTarget.value as DnaBackgroundControlOptions["strandRotationDirection"],
          })}
        >
          {DNA_STRAND_ROTATION_DIRECTIONS.map((direction) => (
            <option value={direction} key={direction}>
              {direction === "clockwise" ? "Clockwise" : "Counterclockwise"}
            </option>
          ))}
        </SelectField>
      </BackgroundPropertyGroup>

      <BackgroundPropertyGroup label="Geometry">
        <StyledRangeControl label="Strand count" value={value.strandCount} min={DNA_OPTION_BOUNDS.strandCount.minimum} max={DNA_OPTION_BOUNDS.strandCount.maximum} step={1} disabled={disabled} displayValue={String(Math.round(value.strandCount))} onChange={(nextValue) => onChange({ strandCount: nextValue })} />
        <StyledToggleControl label="Show base letters" checked={value.showBaseLetters} valueLabel={value.showBaseLetters ? "On" : "Off"} disabled={disabled} onCheckedChange={(nextValue) => onChange({ showBaseLetters: nextValue })} />
        <StyledRangeControl label="Strand angle" value={value.strandAngle} min={DNA_OPTION_BOUNDS.strandAngle.minimum} max={DNA_OPTION_BOUNDS.strandAngle.maximum} step={1} disabled={disabled} displayValue={`${Math.round(value.strandAngle)}°`} onChange={(nextValue) => onChange({ strandAngle: nextValue })} />
        <StyledRangeControl label="Node size" value={value.nodeSize} min={DNA_OPTION_BOUNDS.nodeSize.minimum} max={DNA_OPTION_BOUNDS.nodeSize.maximum} step={1} disabled={disabled} displayValue={`${Math.round(value.nodeSize)}%`} onChange={(nextValue) => onChange({ nodeSize: nextValue })} />
        <StyledRangeControl label="Strand spacing" value={value.strandSpacing} min={DNA_OPTION_BOUNDS.strandSpacing.minimum} max={DNA_OPTION_BOUNDS.strandSpacing.maximum} step={0.05} disabled={disabled} displayValue={`${value.strandSpacing.toFixed(2)}vmin`} description="Changes the distance between strands without resizing the nodes." onChange={(nextValue) => onChange({ strandSpacing: nextValue })} />
      </BackgroundPropertyGroup>

      <BackgroundPropertyGroup label="Position and scale">
        <StyledRangeControl
          label="Scale"
          value={getDnaScaleDisplayPercent(value.scale)}
          min={DNA_SCALE_PERCENT_BOUNDS.minimum}
          max={DNA_SCALE_PERCENT_BOUNDS.maximum}
          step={DNA_SCALE_PERCENT_BOUNDS.step}
          disabled={disabled}
          displayValue={`${Math.round(getDnaScaleDisplayPercent(value.scale))}%`}
          description="100% is the authored default size."
          onChange={(nextValue) => onChange({ scale: getDnaScaleFromDisplayPercent(nextValue) })}
        />
        <StyledRangeControl label="Position X" value={value.positionX} min={DNA_OPTION_BOUNDS.positionX.minimum} max={DNA_OPTION_BOUNDS.positionX.maximum} step={1} disabled={disabled} displayValue={`${Math.round(value.positionX)}%`} onChange={(nextValue) => onChange({ positionX: nextValue })} />
        <StyledRangeControl label="Position Y" value={value.positionY} min={DNA_OPTION_BOUNDS.positionY.minimum} max={DNA_OPTION_BOUNDS.positionY.maximum} step={1} disabled={disabled} displayValue={`${Math.round(value.positionY)}%`} onChange={(nextValue) => onChange({ positionY: nextValue })} />
      </BackgroundPropertyGroup>

      <BackgroundPropertyGroup label="Connector">
        <StyledRangeControl label="Connector width" value={value.connectorWidth} min={DNA_OPTION_BOUNDS.connectorWidth.minimum} max={DNA_OPTION_BOUNDS.connectorWidth.maximum} step={1} disabled={disabled} displayValue={`${Math.round(value.connectorWidth)}%`} onChange={(nextValue) => onChange({ connectorWidth: nextValue })} />
        <StyledRangeControl label="Connector thickness" value={value.connectorThickness} min={DNA_OPTION_BOUNDS.connectorThickness.minimum} max={DNA_OPTION_BOUNDS.connectorThickness.maximum} step={1} disabled={disabled} displayValue={`${Math.round(value.connectorThickness)}%`} onChange={(nextValue) => onChange({ connectorThickness: nextValue })} />
      </BackgroundPropertyGroup>

      <BackgroundPropertyGroup label="Outline">
        <StyledRangeControl label="Outline thickness" value={value.outlineThickness} min={DNA_OPTION_BOUNDS.outlineThickness.minimum} max={DNA_OPTION_BOUNDS.outlineThickness.maximum} step={0.05} disabled={disabled} displayValue={`${value.outlineThickness.toFixed(2)}vmin`} onChange={(nextValue) => onChange({ outlineThickness: nextValue })} />
      </BackgroundPropertyGroup>
    </div>
  )
}
