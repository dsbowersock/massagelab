"use client"

import { useId, useMemo } from "react"

import { type BackgroundPaletteAdapter } from "@/components/backgrounds/backgroundPaletteRegistry"
import { ColorPickerSwatch } from "@/components/chimer-controls/GlobalColorPicker"
import {
  CHIMER_HARMONY_OPTIONS,
  HarmonyToggleGroup,
  type ChimerHarmonyValue,
} from "@/components/chimer-controls/HarmonyToggleGroup"
import { SegmentedToggleGroup } from "@/components/ui/segmented-toggle-group"
import { cn } from "@/lib/utils"
import {
  buildBackgroundPaletteEditorViewModel,
  buildBackgroundPaletteHarmonyChange,
  buildBackgroundHarmonyPreviews,
  buildBackgroundPaletteMappingChange,
  buildBackgroundPaletteModeChange,
  buildBackgroundPaletteSwatchChange,
  type BackgroundColorMapping,
  type BackgroundPaletteEditorValue,
} from "./background-palette-controls"
import styles from "./chimer-controls.module.css"

export type {
  BackgroundColorMapping,
  BackgroundPaletteEditorValue,
  BackgroundPaletteMode,
} from "./background-palette-controls"

export interface BackgroundPaletteEditorProps {
  palette: BackgroundPaletteEditorValue
  adapter: BackgroundPaletteAdapter
  mapping?: BackgroundColorMapping
  canCustomize: boolean
  onPaletteChange: (palette: BackgroundPaletteEditorValue) => void
  onMappingChange: (mapping: BackgroundColorMapping) => void
  backgroundName?: string
  className?: string
  disabled?: boolean
}

const HARMONY_OPTIONS = CHIMER_HARMONY_OPTIONS.filter((option) => option.value !== "custom")

/**
 * Presents the shared seven-swatch palette and the selected adapter's mapping.
 * All callbacks are draft-only value transitions; persistence stays with the
 * future Visual editor integration boundary.
 */
export function BackgroundPaletteEditor({
  palette,
  adapter,
  mapping,
  canCustomize,
  onPaletteChange,
  onMappingChange,
  backgroundName = "selected background",
  className,
  disabled = false,
}: BackgroundPaletteEditorProps) {
  const componentId = useId()
  const viewModel = useMemo(
    () => buildBackgroundPaletteEditorViewModel({
      palette,
      adapter,
      mapping,
      canCustomize,
    }),
    [adapter, canCustomize, mapping, palette],
  )
  const {
    palette: normalizedPalette,
    effectiveMode,
    isSource,
    isHarmony,
    roles,
    normalizedMapping,
    activeMapping,
    swatches,
    modeOptions,
    unavailableReason,
    displayedHarmony,
  } = viewModel
  const harmonyPreviews = useMemo(
    () => buildBackgroundHarmonyPreviews(
      normalizedPalette.primaryColor,
      HARMONY_OPTIONS.map((option) => option.value),
    ),
    [normalizedPalette.primaryColor],
  )

  function changeMode(nextMode: string) {
    const nextPalette = buildBackgroundPaletteModeChange(
      { palette: normalizedPalette, adapter, canCustomize, disabled },
      nextMode,
    )
    if (nextPalette) {
      onPaletteChange(nextPalette)
    }
  }

  function changeSwatch(index: number, color: string) {
    const nextPalette = buildBackgroundPaletteSwatchChange(
      { palette: normalizedPalette, adapter, canCustomize, disabled },
      index,
      color,
    )
    if (nextPalette) {
      onPaletteChange(nextPalette)
    }
  }

  function changeHarmony(harmony: string) {
    const nextPalette = buildBackgroundPaletteHarmonyChange(
      { palette: normalizedPalette, adapter, canCustomize, disabled },
      harmony,
    )
    if (nextPalette) {
      onPaletteChange(nextPalette)
    }
  }

  return (
    <section
      className={cn(styles.controlCard, styles.backgroundPaletteEditor, className)}
      aria-labelledby={`${componentId}-title`}
    >
      <div className={styles.backgroundPaletteHeader}>
        <div className={styles.globalColorIntro}>
          <p id={`${componentId}-title`} className={styles.globalColorTitle}>
            Shared Colors
          </p>
          <p className={styles.globalColorDescription}>
            Seven saved colors can be reused by every compatible background.
          </p>
        </div>

        <div className={styles.paletteModeControl}>
          <p className={styles.controlLabel}>Color source</p>
          <SegmentedToggleGroup
            label="Color source"
            value={effectiveMode}
            options={modeOptions}
            onValueChange={changeMode}
            disabled={disabled}
            fit
          />
        </div>
      </div>

      {unavailableReason ? (
        <p className={styles.paletteAccessMessage} role="status" aria-live="polite">
          Colors are unavailable for {backgroundName}. {unavailableReason}
        </p>
      ) : !canCustomize ? (
        <p className={styles.paletteAccessMessage} role="status" aria-live="polite">
          Unlock {backgroundName} with a credit, purchase, or membership to customize its colors and
          properties; your saved settings stay unchanged.
        </p>
      ) : isSource ? (
        <p className={styles.paletteAccessMessage}>
          Source shows the original {backgroundName} colors as read-only context. Your saved Custom
          and Harmony values stay unchanged.
        </p>
      ) : null}

      {isHarmony && canCustomize && adapter.status === "supported" ? (
        <HarmonyToggleGroup
          label="Harmony choice"
          value={displayedHarmony as ChimerHarmonyValue}
          options={HARMONY_OPTIONS}
          previewColors={harmonyPreviews}
          onChange={changeHarmony}
          disabled={disabled}
          embedded
        />
      ) : null}

      <div className={styles.backgroundPaletteGrid} aria-label="Seven shared color swatches">
        {swatches.map((swatch) => (
          <div
            key={swatch.index}
            className={cn(
              styles.backgroundPaletteSwatch,
              swatch.unused && styles.backgroundPaletteSwatchUnused,
            )}
          >
            <div className={styles.backgroundPaletteSwatchLabel}>
              <span>Swatch {swatch.number}</span>
              {swatch.primaryLabel ? <strong>{swatch.primaryLabel}</strong> : null}
              <span>{swatch.usageLabel}</span>
            </div>
            <ColorPickerSwatch
              id={`${componentId}-swatch-${swatch.number}`}
              label={swatch.accessibleLabel}
              value={swatch.color}
              fallback={normalizedPalette.swatches[swatch.index] ?? "#000000"}
              readOnly={swatch.readOnly}
              disabled={disabled || !canCustomize}
              onChange={(color) => changeSwatch(swatch.index, color)}
            />
          </div>
        ))}
      </div>

      {roles.length > 0 ? (
        <fieldset className={styles.backgroundPaletteMapping}>
          <legend>Color mapping</legend>
          <p className={styles.controlDescription}>
            Assign each {backgroundName} role to one shared swatch. Source keeps its original role colors.
          </p>
          <div className={styles.backgroundPaletteMappingGrid}>
            {roles.map((role) => (
              <label key={role.id} className={styles.backgroundPaletteMappingField}>
                <span>{role.label}</span>
                <select
                  value={activeMapping[role.id] ?? role.defaultSwatch}
                  aria-label={`${role.label} color mapping`}
                  disabled={disabled || isSource || !canCustomize}
                  onChange={(event) => {
                    const nextMapping = buildBackgroundPaletteMappingChange(
                      normalizedMapping,
                      role.id,
                      Number.parseInt(event.currentTarget.value, 10),
                    )
                    if (nextMapping) {
                      onMappingChange(nextMapping)
                    }
                  }}
                >
                  {swatches.map((swatch) => (
                    <option key={swatch.index} value={swatch.index}>
                      Swatch {swatch.number} — {swatch.color}
                    </option>
                  ))}
                </select>
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
    </section>
  )
}
