"use client"

import type { MassageLabTwistedCubesOptions } from "@/components/backgrounds/effects/css-backgrounds"
import { StyledRangeControl } from "@/components/chimer-controls/StyledRangeControl"
import styles from "@/app/chimer/running-timer.module.css"

export type TwistedCubesBackgroundControlOptions = Pick<
  MassageLabTwistedCubesOptions,
  | "layerCount"
  | "rotationSpeed"
  | "layerStagger"
  | "viewAngleX"
  | "viewAngleY"
  | "scale"
  | "positionX"
  | "positionY"
  | "layerDepthSpacing"
  | "opacityFalloff"
  | "outlineThickness"
>

interface BackgroundPropertyControlsProps<TOptions> {
  value: TOptions
  disabled?: boolean
  onChange: (patch: Partial<TOptions>) => void
}

/** Keeps derived colors, alpha, and persistence outside this option-only control surface. */
export function TwistedCubesBackgroundControls({
  value,
  disabled = false,
  onChange,
}: BackgroundPropertyControlsProps<TwistedCubesBackgroundControlOptions>) {
  return (
    <div className={styles.backgroundPropertyGroups}>
      <fieldset className={styles.backgroundPropertyGroup}>
        <legend>Motion</legend>
        <StyledRangeControl label="Rotation speed" value={value.rotationSpeed} min={0.01} max={3} step={0.01} disabled={disabled} displayValue={`${value.rotationSpeed.toFixed(2)}x`} onChange={(nextValue) => onChange({ rotationSpeed: nextValue })} />
        <StyledRangeControl label="Layer stagger" value={value.layerStagger} min={0} max={0.3} step={0.01} disabled={disabled} displayValue={`${value.layerStagger.toFixed(2)}s`} onChange={(nextValue) => onChange({ layerStagger: nextValue })} />
      </fieldset>

      <fieldset className={styles.backgroundPropertyGroup}>
        <legend>View angles</legend>
        <StyledRangeControl label="View angle X" value={value.viewAngleX} min={-80} max={80} step={1} disabled={disabled} displayValue={`${Math.round(value.viewAngleX)}°`} onChange={(nextValue) => onChange({ viewAngleX: nextValue })} />
        <StyledRangeControl label="View angle Y" value={value.viewAngleY} min={-80} max={80} step={1} disabled={disabled} displayValue={`${Math.round(value.viewAngleY)}°`} onChange={(nextValue) => onChange({ viewAngleY: nextValue })} />
      </fieldset>

      <fieldset className={styles.backgroundPropertyGroup}>
        <legend>Geometry and depth</legend>
        <StyledRangeControl label="Layer count" value={value.layerCount} min={6} max={30} step={1} disabled={disabled} displayValue={String(Math.round(value.layerCount))} onChange={(nextValue) => onChange({ layerCount: nextValue })} />
        <StyledRangeControl label="Layer depth" value={value.layerDepthSpacing} min={10} max={70} step={1} disabled={disabled} displayValue={`${Math.round(value.layerDepthSpacing)}vmin`} onChange={(nextValue) => onChange({ layerDepthSpacing: nextValue })} />
      </fieldset>

      <fieldset className={styles.backgroundPropertyGroup}>
        <legend>Position and scale</legend>
        <StyledRangeControl label="Scale" value={value.scale} min={0.4} max={1.2} step={0.01} disabled={disabled} displayValue={`${Math.round(value.scale * 100)}%`} onChange={(nextValue) => onChange({ scale: nextValue })} />
        <StyledRangeControl label="Position X" value={value.positionX} min={-35} max={35} step={1} disabled={disabled} displayValue={`${Math.round(value.positionX)}%`} onChange={(nextValue) => onChange({ positionX: nextValue })} />
        <StyledRangeControl label="Position Y" value={value.positionY} min={-35} max={35} step={1} disabled={disabled} displayValue={`${Math.round(value.positionY)}%`} onChange={(nextValue) => onChange({ positionY: nextValue })} />
      </fieldset>

      <fieldset className={styles.backgroundPropertyGroup}>
        <legend>Fade</legend>
        <StyledRangeControl label="Fade falloff" value={value.opacityFalloff} min={0} max={0.95} step={0.01} disabled={disabled} displayValue={`${Math.round(value.opacityFalloff * 100)}%`} onChange={(nextValue) => onChange({ opacityFalloff: nextValue })} />
      </fieldset>

      <fieldset className={styles.backgroundPropertyGroup}>
        <legend>Outline</legend>
        <StyledRangeControl label="Relative outline thickness" value={value.outlineThickness} min={0.0025} max={0.02} step={0.0005} disabled={disabled} displayValue={`${(value.outlineThickness * 100).toFixed(2)}%`} onChange={(nextValue) => onChange({ outlineThickness: nextValue })} />
      </fieldset>
    </div>
  )
}
