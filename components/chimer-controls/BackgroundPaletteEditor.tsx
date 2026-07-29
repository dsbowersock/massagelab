"use client"

import { useId, useMemo } from "react"

import {
  type BackgroundPaletteAdapter,
  type BackgroundPaletteRole,
} from "@/components/backgrounds/backgroundPaletteRegistry"
import { ColorPickerSwatch } from "@/components/chimer-controls/GlobalColorPicker"
import {
  CHIMER_HARMONY_OPTIONS,
  HarmonyToggleGroup,
  type ChimerHarmonyValue,
} from "@/components/chimer-controls/HarmonyToggleGroup"
import { SegmentedToggleGroup } from "@/components/ui/segmented-toggle-group"
import { cn } from "@/lib/utils"
import {
  BACKGROUND_PALETTE_SWATCH_COUNT,
  generateBackgroundHarmonySwatches,
  normalizeBackgroundColorMapping,
  normalizeBackgroundPaletteState,
} from "../../lib/background-palette.js"
import styles from "./chimer-controls.module.css"

export type BackgroundPaletteMode = "source" | "custom" | "harmony"

export interface BackgroundPaletteEditorValue {
  mode: BackgroundPaletteMode
  primaryColor: string
  harmony: string
  swatches: readonly string[]
}

export type BackgroundColorMapping = Readonly<Record<string, number>>

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

const PALETTE_MODE_OPTIONS = [
  { value: "source", label: "Source" },
  { value: "custom", label: "Custom" },
  { value: "harmony", label: "Harmony" },
] as const

const HARMONY_OPTIONS = CHIMER_HARMONY_OPTIONS.filter((option) => option.value !== "custom")

function rolesBySwatch(
  roles: readonly BackgroundPaletteRole[],
  mapping: BackgroundColorMapping,
) {
  return Array.from({ length: BACKGROUND_PALETTE_SWATCH_COUNT }, (_, index) => (
    roles.filter((role) => mapping[role.id] === index)
  ))
}

function swatchUsageLabel(roles: readonly BackgroundPaletteRole[]) {
  if (roles.length === 0) {
    return "Not used by this background"
  }
  if (roles.length === 1) {
    return roles[0]?.label ?? "Not used by this background"
  }
  return roles.map((role) => role.label).join(" + ")
}

/**
 * Source colors belong to the adapter, not the saved global palette. Fill only
 * role-bearing positions with adapter colors so entering Source never rewrites
 * dormant Custom or Harmony values.
 */
function sourceContextSwatches(
  savedSwatches: readonly string[],
  groupedRoles: readonly (readonly BackgroundPaletteRole[])[],
) {
  return Array.from({ length: BACKGROUND_PALETTE_SWATCH_COUNT }, (_, index) => (
    groupedRoles[index]?.[0]?.sourceColor ?? savedSwatches[index] ?? "#000000"
  ))
}

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
  const normalizedPalette = useMemo(
    () => normalizeBackgroundPaletteState(palette) as BackgroundPaletteEditorValue,
    [palette],
  )
  const roles = useMemo(
    () => adapter.status === "supported" ? adapter.roles : [],
    [adapter],
  )
  const normalizedMapping = useMemo(
    () => normalizeBackgroundColorMapping(mapping, adapter) as BackgroundColorMapping,
    [adapter, mapping],
  )
  const sourceMapping = useMemo(
    () => normalizeBackgroundColorMapping({}, adapter) as BackgroundColorMapping,
    [adapter],
  )
  const effectiveMode: BackgroundPaletteMode = canCustomize && adapter.status === "supported"
    ? normalizedPalette.mode
    : "source"
  const isSource = effectiveMode === "source"
  const isHarmony = effectiveMode === "harmony"
  const activeMapping = isSource ? sourceMapping : normalizedMapping
  const groupedRoles = useMemo(
    () => rolesBySwatch(roles, activeMapping),
    [activeMapping, roles],
  )
  const displaySwatches = useMemo(() => {
    if (isSource) {
      return sourceContextSwatches(normalizedPalette.swatches, groupedRoles)
    }
    if (isHarmony) {
      return generateBackgroundHarmonySwatches(
        normalizedPalette.primaryColor,
        normalizedPalette.harmony,
      ) as readonly string[]
    }
    return normalizedPalette.swatches
  }, [groupedRoles, isHarmony, isSource, normalizedPalette])
  const modeOptions = useMemo(() => PALETTE_MODE_OPTIONS.map((option) => ({
    ...option,
    disabled: option.value !== "source" && (!canCustomize || adapter.status === "unsupported"),
  })), [adapter.status, canCustomize])
  const unavailableReason = adapter.status === "unsupported"
    ? adapter.unsupportedReason
    : null
  const displayedHarmony = normalizedPalette.harmony === "triadic"
    ? "triad"
    : normalizedPalette.harmony === "tetradic"
      ? "square"
      : normalizedPalette.harmony

  function changeMode(nextMode: string) {
    if (
      !["source", "custom", "harmony"].includes(nextMode)
      || disabled
      || (nextMode !== "source" && (!canCustomize || adapter.status === "unsupported"))
    ) {
      return
    }
    onPaletteChange({
      ...normalizedPalette,
      mode: nextMode as BackgroundPaletteMode,
    })
  }

  function changeSwatch(index: number, color: string) {
    if (
      disabled
      || adapter.status === "unsupported"
      || isSource
      || (isHarmony && index > 0)
      || !canCustomize
    ) {
      return
    }
    const swatches = [...normalizedPalette.swatches]
    swatches[index] = color
    onPaletteChange({
      ...normalizedPalette,
      primaryColor: index === 0 ? color : normalizedPalette.primaryColor,
      swatches,
    })
  }

  return (
    <section
      className={cn(styles.controlCard, styles.backgroundPaletteEditor, className)}
      aria-labelledby={`${componentId}-title`}
    >
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

      {unavailableReason ? (
        <p className={styles.paletteAccessMessage} role="status" aria-live="polite">
          Colors are unavailable for {backgroundName}. {unavailableReason}
        </p>
      ) : !canCustomize ? (
        <p className={styles.paletteAccessMessage} role="status" aria-live="polite">
          Source colors remain available. Custom and Harmony require color access for {backgroundName};
          your saved colors stay unchanged.
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
          onChange={(harmony) => onPaletteChange({
            ...normalizedPalette,
            harmony,
          })}
          disabled={disabled}
          embedded
        />
      ) : null}

      <div className={styles.backgroundPaletteGrid} aria-label="Seven shared color swatches">
        {Array.from({ length: BACKGROUND_PALETTE_SWATCH_COUNT }, (_, index) => {
          const usageLabel = swatchUsageLabel(groupedRoles[index] ?? [])
          const primaryLabel = index === 0 ? "Primary" : null
          const swatchLabel = [
            `Swatch ${index + 1}`,
            primaryLabel,
            usageLabel,
          ].filter(Boolean).join(", ")

          return (
            <div
              key={index}
              className={cn(
                styles.backgroundPaletteSwatch,
                (groupedRoles[index]?.length ?? 0) === 0 && styles.backgroundPaletteSwatchUnused,
              )}
            >
              <div className={styles.backgroundPaletteSwatchLabel}>
                <span>Swatch {index + 1}</span>
                {primaryLabel ? <strong>{primaryLabel}</strong> : null}
                <span>{usageLabel}</span>
              </div>
              <ColorPickerSwatch
                id={`${componentId}-swatch-${index + 1}`}
                label={swatchLabel}
                value={displaySwatches[index] ?? normalizedPalette.swatches[index] ?? "#000000"}
                fallback={normalizedPalette.swatches[index] ?? "#000000"}
                readOnly={isSource || (isHarmony && index > 0)}
                disabled={disabled || !canCustomize}
                onChange={(color) => changeSwatch(index, color)}
              />
            </div>
          )
        })}
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
                  onChange={(event) => onMappingChange({
                    ...normalizedMapping,
                    [role.id]: Number.parseInt(event.currentTarget.value, 10),
                  })}
                >
                  {displaySwatches.map((color, index) => (
                    <option key={index} value={index}>
                      Swatch {index + 1} — {color}
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
