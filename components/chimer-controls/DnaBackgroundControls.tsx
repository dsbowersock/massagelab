"use client"

import type { MassageLabDnaOptions } from "@/components/backgrounds/effects/css-backgrounds"
import type { BackgroundPropertyControlsProps } from "@/components/chimer-controls/background-property-control-types"
import { BackgroundPropertyGroup } from "@/components/chimer-controls/BackgroundPropertyGroup"
import { StyledRangeControl } from "@/components/chimer-controls/StyledRangeControl"
import { StyledToggleControl } from "@/components/chimer-controls/StyledToggleControl"
import styles from "@/app/chimer/running-timer.module.css"
import { DNA_OPTION_BOUNDS } from "@/lib/dna-background"

export type DnaBackgroundControlOptions = Pick<
  MassageLabDnaOptions,
  | "strandCount"
  | "showBaseLetters"
  | "nodeMotionSpeed"
  | "strandRotationSpeed"
  | "strandAngle"
  | "scale"
  | "positionX"
  | "positionY"
  | "strandSpacing"
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
        <StyledRangeControl label="Node motion speed" value={value.nodeMotionSpeed} min={DNA_OPTION_BOUNDS.nodeMotionSpeed.minimum} max={DNA_OPTION_BOUNDS.nodeMotionSpeed.maximum} step={0.01} disabled={disabled} displayValue={`${value.nodeMotionSpeed.toFixed(2)}x`} onChange={(nextValue) => onChange({ nodeMotionSpeed: nextValue })} />
        <StyledRangeControl label="Strand rotation speed" value={value.strandRotationSpeed} min={DNA_OPTION_BOUNDS.strandRotationSpeed.minimum} max={DNA_OPTION_BOUNDS.strandRotationSpeed.maximum} step={0.01} disabled={disabled} displayValue={`${value.strandRotationSpeed.toFixed(2)}x`} onChange={(nextValue) => onChange({ strandRotationSpeed: nextValue })} />
      </BackgroundPropertyGroup>

      <BackgroundPropertyGroup label="Geometry">
        <StyledRangeControl label="Strand count" value={value.strandCount} min={DNA_OPTION_BOUNDS.strandCount.minimum} max={DNA_OPTION_BOUNDS.strandCount.maximum} step={1} disabled={disabled} displayValue={String(Math.round(value.strandCount))} onChange={(nextValue) => onChange({ strandCount: nextValue })} />
        <StyledToggleControl label="Show base letters" checked={value.showBaseLetters} valueLabel={value.showBaseLetters ? "On" : "Off"} disabled={disabled} onCheckedChange={(nextValue) => onChange({ showBaseLetters: nextValue })} />
        <StyledRangeControl label="Strand angle" value={value.strandAngle} min={DNA_OPTION_BOUNDS.strandAngle.minimum} max={DNA_OPTION_BOUNDS.strandAngle.maximum} step={1} disabled={disabled} displayValue={`${Math.round(value.strandAngle)}°`} onChange={(nextValue) => onChange({ strandAngle: nextValue })} />
        <StyledRangeControl label="Strand spacing" value={value.strandSpacing} min={DNA_OPTION_BOUNDS.strandSpacing.minimum} max={DNA_OPTION_BOUNDS.strandSpacing.maximum} step={0.05} disabled={disabled} displayValue={`${value.strandSpacing.toFixed(2)}vmin`} onChange={(nextValue) => onChange({ strandSpacing: nextValue })} />
      </BackgroundPropertyGroup>

      <BackgroundPropertyGroup label="Position and scale">
        <StyledRangeControl label="Scale" value={value.scale} min={DNA_OPTION_BOUNDS.scale.minimum} max={DNA_OPTION_BOUNDS.scale.maximum} step={0.01} disabled={disabled} displayValue={`${Math.round(value.scale * 100)}%`} onChange={(nextValue) => onChange({ scale: nextValue })} />
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
