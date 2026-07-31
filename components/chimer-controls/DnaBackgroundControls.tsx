"use client"

import type { MassageLabDnaOptions } from "@/components/backgrounds/effects/css-backgrounds"
import { StyledRangeControl } from "@/components/chimer-controls/StyledRangeControl"
import styles from "@/app/chimer/running-timer.module.css"

export type DnaBackgroundControlOptions = Pick<
  MassageLabDnaOptions,
  | "strandCount"
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

interface BackgroundPropertyControlsProps<TOptions> {
  value: TOptions
  disabled?: boolean
  onChange: (patch: Partial<TOptions>) => void
}

/** Emits one option-only patch per slider so the shared Visual draft owns history and persistence. */
export function DnaBackgroundControls({
  value,
  disabled = false,
  onChange,
}: BackgroundPropertyControlsProps<DnaBackgroundControlOptions>) {
  return (
    <div className={styles.backgroundPropertyGroups}>
      <fieldset className={styles.backgroundPropertyGroup}>
        <legend>Motion</legend>
        <StyledRangeControl label="Node motion speed" value={value.nodeMotionSpeed} min={0.25} max={3} step={0.05} disabled={disabled} displayValue={`${value.nodeMotionSpeed.toFixed(2)}x`} onChange={(nextValue) => onChange({ nodeMotionSpeed: nextValue })} />
        <StyledRangeControl label="Strand rotation speed" value={value.strandRotationSpeed} min={0.1} max={3} step={0.05} disabled={disabled} displayValue={`${value.strandRotationSpeed.toFixed(2)}x`} onChange={(nextValue) => onChange({ strandRotationSpeed: nextValue })} />
      </fieldset>

      <fieldset className={styles.backgroundPropertyGroup}>
        <legend>Geometry</legend>
        <StyledRangeControl label="Strand count" value={value.strandCount} min={7} max={25} step={1} disabled={disabled} displayValue={String(Math.round(value.strandCount))} onChange={(nextValue) => onChange({ strandCount: nextValue })} />
        <StyledRangeControl label="Strand angle" value={value.strandAngle} min={-180} max={180} step={1} disabled={disabled} displayValue={`${Math.round(value.strandAngle)}°`} onChange={(nextValue) => onChange({ strandAngle: nextValue })} />
        <StyledRangeControl label="Strand spacing" value={value.strandSpacing} min={0} max={2} step={0.05} disabled={disabled} displayValue={`${value.strandSpacing.toFixed(2)}vmin`} onChange={(nextValue) => onChange({ strandSpacing: nextValue })} />
      </fieldset>

      <fieldset className={styles.backgroundPropertyGroup}>
        <legend>Position and scale</legend>
        <StyledRangeControl label="Scale" value={value.scale} min={0.4} max={1.2} step={0.01} disabled={disabled} displayValue={`${Math.round(value.scale * 100)}%`} onChange={(nextValue) => onChange({ scale: nextValue })} />
        <StyledRangeControl label="Position X" value={value.positionX} min={-35} max={35} step={1} disabled={disabled} displayValue={`${Math.round(value.positionX)}%`} onChange={(nextValue) => onChange({ positionX: nextValue })} />
        <StyledRangeControl label="Position Y" value={value.positionY} min={-35} max={35} step={1} disabled={disabled} displayValue={`${Math.round(value.positionY)}%`} onChange={(nextValue) => onChange({ positionY: nextValue })} />
      </fieldset>

      <fieldset className={styles.backgroundPropertyGroup}>
        <legend>Connector</legend>
        <StyledRangeControl label="Connector width" value={value.connectorWidth} min={60} max={100} step={1} disabled={disabled} displayValue={`${Math.round(value.connectorWidth)}%`} onChange={(nextValue) => onChange({ connectorWidth: nextValue })} />
        <StyledRangeControl label="Connector thickness" value={value.connectorThickness} min={10} max={60} step={1} disabled={disabled} displayValue={`${Math.round(value.connectorThickness)}%`} onChange={(nextValue) => onChange({ connectorThickness: nextValue })} />
      </fieldset>

      <fieldset className={styles.backgroundPropertyGroup}>
        <legend>Outline</legend>
        <StyledRangeControl label="Outline thickness" value={value.outlineThickness} min={0} max={1.5} step={0.05} disabled={disabled} displayValue={`${value.outlineThickness.toFixed(2)}px`} onChange={(nextValue) => onChange({ outlineThickness: nextValue })} />
      </fieldset>
    </div>
  )
}
