import type {
  BackgroundPaletteAdapter,
  BackgroundPaletteRole,
} from "../backgrounds/backgroundPaletteRegistry"
import {
  BACKGROUND_COLOR_PRESET_LIMIT,
  BACKGROUND_PALETTE_SWATCH_COUNT,
  BACKGROUND_VISUAL_PRESET_LIMIT,
  generateBackgroundHarmonySwatches,
  normalizeBackgroundColorMapping,
  normalizeBackgroundPaletteState,
} from "../../lib/background-palette.js"

export type BackgroundPaletteMode = "source" | "custom" | "harmony"
export type BackgroundColorMapping = Readonly<Record<string, number>>
export type BackgroundPresetKind = "color" | "visual"
export type BackgroundPresetSaveOperation = "save" | "update"

export interface BackgroundPaletteEditorValue {
  mode: BackgroundPaletteMode
  primaryColor: string
  harmony: string
  swatches: readonly string[]
}

export interface BackgroundColorPresetValue {
  id: string
  name: string
  timestamp?: number
  palette: {
    mode: "custom" | "harmony"
    primaryColor: string
    harmony: string
    swatches: readonly string[]
  }
}

export interface BackgroundVisualPresetValue {
  id: string
  name: string
  timestamp?: number
  properties: Readonly<Record<string, unknown>>
  mapping: BackgroundColorMapping
}

export type BackgroundPresetDraftAction =
  | { type: "save-color-preset" | "update-color-preset"; preset: BackgroundColorPresetValue }
  | { type: "apply-color-preset" | "delete-color-preset"; id: string }
  | { type: "rename-color-preset"; id: string; name: string }
  | { type: "save-visual-preset" | "update-visual-preset"; preset: BackgroundVisualPresetValue }
  | { type: "apply-visual-preset" | "delete-visual-preset" | "set-default-visual-preset"; id: string }
  | { type: "rename-visual-preset"; id: string; name: string }

export interface BackgroundPaletteSwatchViewModel {
  index: number
  number: number
  color: string
  primaryLabel: "Primary" | null
  usageLabel: string
  accessibleLabel: string
  readOnly: boolean
  unused: boolean
  roles: readonly BackgroundPaletteRole[]
}

export interface BackgroundPaletteEditorViewModel {
  palette: BackgroundPaletteEditorValue
  effectiveMode: BackgroundPaletteMode
  isSource: boolean
  isHarmony: boolean
  roles: readonly BackgroundPaletteRole[]
  normalizedMapping: BackgroundColorMapping
  activeMapping: BackgroundColorMapping
  swatches: readonly BackgroundPaletteSwatchViewModel[]
  modeOptions: readonly {
    value: BackgroundPaletteMode
    label: string
    disabled: boolean
  }[]
  unavailableReason: string | null
  displayedHarmony: string
}

const PRESET_NAME_LIMIT = 80
const PALETTE_MODE_OPTIONS = [
  { value: "source", label: "Source" },
  { value: "custom", label: "Custom" },
  { value: "harmony", label: "Harmony" },
] as const

function clone<T>(value: T): T {
  return structuredClone(value)
}

function boundedPresetName(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, PRESET_NAME_LIMIT)
}

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
 * Builds every dynamic palette label and editability decision without touching
 * React state, browser storage, account sync, or renderer instances.
 */
export function buildBackgroundPaletteEditorViewModel({
  palette,
  adapter,
  mapping,
  canCustomize,
}: {
  palette: BackgroundPaletteEditorValue
  adapter: BackgroundPaletteAdapter
  mapping?: BackgroundColorMapping
  canCustomize: boolean
}): BackgroundPaletteEditorViewModel {
  const normalizedPalette = normalizeBackgroundPaletteState(palette) as BackgroundPaletteEditorValue
  const roles = adapter.status === "supported" ? adapter.roles : []
  const normalizedMapping = normalizeBackgroundColorMapping(
    mapping,
    adapter,
  ) as BackgroundColorMapping
  const sourceMapping = normalizeBackgroundColorMapping(
    {},
    adapter,
  ) as BackgroundColorMapping
  const effectiveMode: BackgroundPaletteMode = canCustomize && adapter.status === "supported"
    ? normalizedPalette.mode
    : "source"
  const isSource = effectiveMode === "source"
  const isHarmony = effectiveMode === "harmony"
  const activeMapping = isSource ? sourceMapping : normalizedMapping
  const groupedRoles = rolesBySwatch(roles, activeMapping)
  const displayColors = isSource
    ? Array.from({ length: BACKGROUND_PALETTE_SWATCH_COUNT }, (_, index) => (
      groupedRoles[index]?.[0]?.sourceColor
        ?? normalizedPalette.swatches[index]
        ?? "#000000"
    ))
    : isHarmony
      ? generateBackgroundHarmonySwatches(
        normalizedPalette.primaryColor,
        normalizedPalette.harmony,
      )
      : normalizedPalette.swatches
  const swatches = Array.from(
    { length: BACKGROUND_PALETTE_SWATCH_COUNT },
    (_, index): BackgroundPaletteSwatchViewModel => {
      const swatchRoles = groupedRoles[index] ?? []
      const usageLabel = swatchUsageLabel(swatchRoles)
      const primaryLabel = index === 0 ? "Primary" : null
      return {
        index,
        number: index + 1,
        color: displayColors[index] ?? normalizedPalette.swatches[index] ?? "#000000",
        primaryLabel,
        usageLabel,
        accessibleLabel: [
          `Swatch ${index + 1}`,
          primaryLabel,
          usageLabel,
        ].filter(Boolean).join(", "),
        readOnly: isSource || (isHarmony && index > 0),
        unused: swatchRoles.length === 0,
        roles: swatchRoles,
      }
    },
  )

  return {
    palette: normalizedPalette,
    effectiveMode,
    isSource,
    isHarmony,
    roles,
    normalizedMapping,
    activeMapping,
    swatches,
    modeOptions: PALETTE_MODE_OPTIONS.map((option) => ({
      ...option,
      disabled: option.value !== "source"
        && (!canCustomize || adapter.status === "unsupported"),
    })),
    unavailableReason: adapter.status === "unsupported"
      ? adapter.unsupportedReason
      : null,
    displayedHarmony: normalizedPalette.harmony === "triadic"
      ? "triad"
      : normalizedPalette.harmony === "tetradic"
        ? "square"
        : normalizedPalette.harmony,
  }
}

/** Returns the next mode payload that a controlled editor callback should emit. */
export function buildBackgroundPaletteModeChange(
  input: {
    palette: BackgroundPaletteEditorValue
    adapter: BackgroundPaletteAdapter
    canCustomize: boolean
    disabled?: boolean
  },
  nextMode: string,
): BackgroundPaletteEditorValue | null {
  const normalized = normalizeBackgroundPaletteState(input.palette) as BackgroundPaletteEditorValue
  if (
    input.disabled
    || !["source", "custom", "harmony"].includes(nextMode)
    || (
      nextMode !== "source"
      && (!input.canCustomize || input.adapter.status === "unsupported")
    )
  ) {
    return null
  }
  return {
    ...normalized,
    mode: nextMode as BackgroundPaletteMode,
  }
}

/** Returns the next indexed swatch payload without mutating the supplied palette. */
export function buildBackgroundPaletteSwatchChange(
  input: {
    palette: BackgroundPaletteEditorValue
    adapter: BackgroundPaletteAdapter
    canCustomize: boolean
    disabled?: boolean
  },
  index: number,
  color: string,
): BackgroundPaletteEditorValue | null {
  const normalized = normalizeBackgroundPaletteState(input.palette) as BackgroundPaletteEditorValue
  const isSource = normalized.mode === "source"
  const isHarmony = normalized.mode === "harmony"
  if (
    input.disabled
    || input.adapter.status === "unsupported"
    || !input.canCustomize
    || isSource
    || (isHarmony && index > 0)
    || !Number.isInteger(index)
    || index < 0
    || index >= BACKGROUND_PALETTE_SWATCH_COUNT
  ) {
    return null
  }
  const swatches = [...normalized.swatches]
  swatches[index] = color
  return {
    ...normalized,
    primaryColor: index === 0 ? color : normalized.primaryColor,
    swatches,
  }
}

/** Returns one Harmony selection through the same access and adapter guard as other palette edits. */
export function buildBackgroundPaletteHarmonyChange(
  input: {
    palette: BackgroundPaletteEditorValue
    adapter: BackgroundPaletteAdapter
    canCustomize: boolean
    disabled?: boolean
  },
  harmony: string,
): BackgroundPaletteEditorValue | null {
  const normalized = normalizeBackgroundPaletteState(input.palette) as BackgroundPaletteEditorValue
  if (
    input.disabled
    || input.adapter.status === "unsupported"
    || !input.canCustomize
    || normalized.mode !== "harmony"
    || !harmony
  ) {
    return null
  }
  return {
    ...normalized,
    harmony,
  }
}

/** Returns one background-specific role remap without touching shared colors. */
export function buildBackgroundPaletteMappingChange(
  mapping: BackgroundColorMapping,
  roleId: string,
  swatchIndex: number,
): BackgroundColorMapping | null {
  if (
    !roleId
    || !Number.isInteger(swatchIndex)
    || swatchIndex < 0
    || swatchIndex >= BACKGROUND_PALETTE_SWATCH_COUNT
  ) {
    return null
  }
  return {
    ...mapping,
    [roleId]: swatchIndex,
  }
}

/** Color presets intentionally carry only a cross-background palette. */
export function buildColorPresetDraftAction({
  operation,
  id,
  name,
  timestamp,
  palette,
}: {
  operation: BackgroundPresetSaveOperation
  id: string
  name: string
  timestamp?: number
  palette: BackgroundColorPresetValue["palette"]
}): BackgroundPresetDraftAction {
  return {
    type: operation === "update" ? "update-color-preset" : "save-color-preset",
    preset: {
      id,
      name: boundedPresetName(name),
      timestamp,
      palette: clone(palette),
    },
  }
}

/** Visual presets retain both non-color properties and the active role mapping. */
export function buildVisualPresetDraftAction({
  operation,
  id,
  name,
  timestamp,
  properties,
  mapping,
}: {
  operation: BackgroundPresetSaveOperation
  id: string
  name: string
  timestamp?: number
  properties: Readonly<Record<string, unknown>>
  mapping: BackgroundColorMapping
}): BackgroundPresetDraftAction {
  return {
    type: operation === "update" ? "update-visual-preset" : "save-visual-preset",
    preset: {
      id,
      name: boundedPresetName(name),
      timestamp,
      properties: clone(properties),
      mapping: clone(mapping),
    },
  }
}

export function buildPresetApplyDraftAction(
  kind: BackgroundPresetKind,
  id: string,
): BackgroundPresetDraftAction {
  return {
    type: kind === "visual" ? "apply-visual-preset" : "apply-color-preset",
    id,
  }
}

export function buildPresetRenameDraftAction(
  kind: BackgroundPresetKind,
  id: string,
  name: string,
): BackgroundPresetDraftAction {
  return {
    type: kind === "visual" ? "rename-visual-preset" : "rename-color-preset",
    id,
    name: boundedPresetName(name),
  }
}

export function buildPresetDeleteDraftAction(
  kind: BackgroundPresetKind,
  id: string,
): BackgroundPresetDraftAction {
  return {
    type: kind === "visual" ? "delete-visual-preset" : "delete-color-preset",
    id,
  }
}

export function buildVisualPresetDefaultDraftAction(
  id: string,
): BackgroundPresetDraftAction {
  return {
    type: "set-default-visual-preset",
    id,
  }
}

export function getBackgroundPresetLimit(kind: BackgroundPresetKind) {
  return kind === "visual"
    ? BACKGROUND_VISUAL_PRESET_LIMIT
    : BACKGROUND_COLOR_PRESET_LIMIT
}
