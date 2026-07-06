"use client"

import {
  combineTileGridFadeParts,
  formatTileGridFadeDuration,
  splitTileGridFadeSeconds,
  TILE_GRID_FADE_SECONDS_MAX,
} from "@/lib/tile-grid-background"

type TileGridFadeTimeControlProps = {
  fadeSeconds: number
  onFadeSecondsChange: (fadeSeconds: number) => void
  rowClassName: string
  pickerClassName: string
  fieldClassName: string
}

/**
 * Edits a bounded tile-grid fade duration as clock-like parts while preserving
 * the last valid total when one partial field would exceed the fade limit.
 */
export function TileGridFadeTimeControl({
  fadeSeconds,
  onFadeSecondsChange,
  rowClassName,
  pickerClassName,
  fieldClassName,
}: TileGridFadeTimeControlProps) {
  const parts = splitTileGridFadeSeconds(fadeSeconds)

  const updatePart = (part: "hours" | "minutes" | "seconds", value: string) => {
    if (value.trim() === "") {
      return
    }

    onFadeSecondsChange(combineTileGridFadeParts({
      ...parts,
      [part]: Number(value),
    }, fadeSeconds))
  }

  return (
    <div className={rowClassName}>
      <span>Fade time ({formatTileGridFadeDuration(fadeSeconds)})</span>
      <div className={pickerClassName} role="group" aria-label="Tile grid fade time">
        <label className={fieldClassName}>
          <span>H</span>
          <input
            type="number"
            min="0"
            max="23"
            step="1"
            value={parts.hours}
            onChange={(event) => updatePart("hours", event.target.value)}
            aria-label="Tile grid fade hours"
          />
        </label>
        <label className={fieldClassName}>
          <span>M</span>
          <input
            type="number"
            min="0"
            max="59"
            step="1"
            value={parts.minutes}
            onChange={(event) => updatePart("minutes", event.target.value)}
            aria-label="Tile grid fade minutes"
          />
        </label>
        <label className={fieldClassName}>
          <span>S</span>
          <input
            type="number"
            min="0"
            max="59.9"
            step="0.1"
            value={parts.seconds}
            onChange={(event) => updatePart("seconds", event.target.value)}
            aria-label={`Tile grid fade seconds, maximum total fade ${formatTileGridFadeDuration(TILE_GRID_FADE_SECONDS_MAX)}`}
          />
        </label>
      </div>
    </div>
  )
}
