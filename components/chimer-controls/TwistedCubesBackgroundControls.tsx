"use client"

import type { MassageLabTwistedCubesOptions } from "@/components/backgrounds/effects/css-backgrounds"
import type { BackgroundPropertyControlsProps } from "@/components/chimer-controls/background-property-control-types"
import { BackgroundPropertyGroup } from "@/components/chimer-controls/BackgroundPropertyGroup"
import { StyledRangeControl } from "@/components/chimer-controls/StyledRangeControl"
import styles from "@/app/chimer/running-timer.module.css"
import { TWISTED_CUBES_OPTION_BOUNDS } from "@/lib/twisted-cubes-background"

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

/** Keeps derived colors, alpha, and persistence outside this option-only control surface. */
export function TwistedCubesBackgroundControls({
  value,
  disabled = false,
  onChange,
}: BackgroundPropertyControlsProps<TwistedCubesBackgroundControlOptions>) {
  return (
    <div className={styles.backgroundPropertyGroups}>
      <BackgroundPropertyGroup label="Motion">
        <StyledRangeControl label="Rotation speed" value={value.rotationSpeed} min={TWISTED_CUBES_OPTION_BOUNDS.rotationSpeed.minimum} max={TWISTED_CUBES_OPTION_BOUNDS.rotationSpeed.maximum} step={0.01} disabled={disabled} displayValue={`${value.rotationSpeed.toFixed(2)}x`} onChange={(nextValue) => onChange({ rotationSpeed: nextValue })} />
        <StyledRangeControl label="Layer stagger" value={value.layerStagger} min={TWISTED_CUBES_OPTION_BOUNDS.layerStagger.minimum} max={TWISTED_CUBES_OPTION_BOUNDS.layerStagger.maximum} step={0.01} disabled={disabled} displayValue={`${value.layerStagger.toFixed(2)}s`} onChange={(nextValue) => onChange({ layerStagger: nextValue })} />
      </BackgroundPropertyGroup>

      <BackgroundPropertyGroup label="View angles">
        <StyledRangeControl label="View angle X" value={value.viewAngleX} min={TWISTED_CUBES_OPTION_BOUNDS.viewAngleX.minimum} max={TWISTED_CUBES_OPTION_BOUNDS.viewAngleX.maximum} step={1} disabled={disabled} displayValue={`${Math.round(value.viewAngleX)}°`} onChange={(nextValue) => onChange({ viewAngleX: nextValue })} />
        <StyledRangeControl label="View angle Y" value={value.viewAngleY} min={TWISTED_CUBES_OPTION_BOUNDS.viewAngleY.minimum} max={TWISTED_CUBES_OPTION_BOUNDS.viewAngleY.maximum} step={1} disabled={disabled} displayValue={`${Math.round(value.viewAngleY)}°`} onChange={(nextValue) => onChange({ viewAngleY: nextValue })} />
      </BackgroundPropertyGroup>

      <BackgroundPropertyGroup label="Geometry and depth">
        <StyledRangeControl label="Layer count" value={value.layerCount} min={TWISTED_CUBES_OPTION_BOUNDS.layerCount.minimum} max={TWISTED_CUBES_OPTION_BOUNDS.layerCount.maximum} step={1} disabled={disabled} displayValue={String(Math.round(value.layerCount))} onChange={(nextValue) => onChange({ layerCount: nextValue })} />
        <StyledRangeControl label="Layer depth" value={value.layerDepthSpacing} min={TWISTED_CUBES_OPTION_BOUNDS.layerDepthSpacing.minimum} max={TWISTED_CUBES_OPTION_BOUNDS.layerDepthSpacing.maximum} step={1} disabled={disabled} displayValue={`${Math.round(value.layerDepthSpacing)}vmin`} onChange={(nextValue) => onChange({ layerDepthSpacing: nextValue })} />
      </BackgroundPropertyGroup>

      <BackgroundPropertyGroup label="Position and scale">
        <StyledRangeControl label="Scale" value={value.scale} min={TWISTED_CUBES_OPTION_BOUNDS.scale.minimum} max={TWISTED_CUBES_OPTION_BOUNDS.scale.maximum} step={0.01} disabled={disabled} displayValue={`${Math.round(value.scale * 100)}%`} onChange={(nextValue) => onChange({ scale: nextValue })} />
        <StyledRangeControl label="Position X" value={value.positionX} min={TWISTED_CUBES_OPTION_BOUNDS.positionX.minimum} max={TWISTED_CUBES_OPTION_BOUNDS.positionX.maximum} step={1} disabled={disabled} displayValue={`${Math.round(value.positionX)}%`} onChange={(nextValue) => onChange({ positionX: nextValue })} />
        <StyledRangeControl label="Position Y" value={value.positionY} min={TWISTED_CUBES_OPTION_BOUNDS.positionY.minimum} max={TWISTED_CUBES_OPTION_BOUNDS.positionY.maximum} step={1} disabled={disabled} displayValue={`${Math.round(value.positionY)}%`} onChange={(nextValue) => onChange({ positionY: nextValue })} />
      </BackgroundPropertyGroup>

      <BackgroundPropertyGroup label="Fade">
        <StyledRangeControl label="Fade falloff" value={value.opacityFalloff} min={TWISTED_CUBES_OPTION_BOUNDS.opacityFalloff.minimum} max={TWISTED_CUBES_OPTION_BOUNDS.opacityFalloff.maximum} step={0.01} disabled={disabled} displayValue={`${Math.round(value.opacityFalloff * 100)}%`} onChange={(nextValue) => onChange({ opacityFalloff: nextValue })} />
      </BackgroundPropertyGroup>

      <BackgroundPropertyGroup label="Outline">
        <StyledRangeControl label="Relative outline thickness" value={value.outlineThickness} min={TWISTED_CUBES_OPTION_BOUNDS.outlineThickness.minimum} max={TWISTED_CUBES_OPTION_BOUNDS.outlineThickness.maximum} step={0.0005} disabled={disabled} displayValue={`${(value.outlineThickness * 100).toFixed(2)}%`} onChange={(nextValue) => onChange({ outlineThickness: nextValue })} />
      </BackgroundPropertyGroup>
    </div>
  )
}
