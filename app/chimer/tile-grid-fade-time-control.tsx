"use client"

import {
  formatTileGridFadeDuration,
  getTileGridFadeSecondsFromSlider,
  getTileGridFadeSliderValue,
  TILE_GRID_FADE_SLIDER_MAX,
  TILE_GRID_FADE_SLIDER_MIN,
  TILE_GRID_FADE_SLIDER_STEP,
} from "@/lib/tile-grid-background"
import { StyledRangeControl } from "@/components/chimer-controls/StyledRangeControl"

type TileGridFadeTimeControlProps = {
  fadeSeconds: number
  onFadeSecondsChange: (fadeSeconds: number) => void
}

/**
 * Presents the shared tile/hex fade duration as one usable nonlinear slider
 * while retaining seconds as the renderer and persistence boundary.
 */
export function TileGridFadeTimeControl({
  fadeSeconds,
  onFadeSecondsChange,
}: TileGridFadeTimeControlProps) {
  return (
    <StyledRangeControl
      label="Fade time"
      value={getTileGridFadeSliderValue(fadeSeconds)}
      min={TILE_GRID_FADE_SLIDER_MIN}
      max={TILE_GRID_FADE_SLIDER_MAX}
      step={TILE_GRID_FADE_SLIDER_STEP}
      displayValue={formatTileGridFadeDuration(fadeSeconds)}
      onChange={(value) => onFadeSecondsChange(getTileGridFadeSecondsFromSlider(value))}
    />
  )
}
