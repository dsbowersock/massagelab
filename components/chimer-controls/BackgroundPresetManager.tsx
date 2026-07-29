"use client"

import { useId, useState } from "react"
import { MoreHorizontal } from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import {
  BACKGROUND_COLOR_PRESET_LIMIT,
  BACKGROUND_VISUAL_PRESET_LIMIT,
} from "../../lib/background-palette.js"
import styles from "./chimer-controls.module.css"

const PRESET_NAME_LIMIT = 80
const SHARED_COLOR_PROPERTY_KEYS = new Set([
  "palette",
  "swatches",
  "primaryColor",
  "harmony",
  "mode",
  "colors",
])

export interface BackgroundPresetBase {
  id: string
  name: string
  timestamp?: number
}

export interface BackgroundColorPreset extends BackgroundPresetBase {
  palette: {
    mode: "custom" | "harmony"
    primaryColor: string
    harmony: string
    swatches: readonly string[]
  }
  mappingsByBackground?: Readonly<Record<string, Readonly<Record<string, number>>>>
}

export interface BackgroundVisualPreset extends BackgroundPresetBase {
  properties: Readonly<Record<string, unknown>>
  mapping?: Readonly<Record<string, number>>
}

export type BackgroundPresetDraftAction =
  | { type: "save-color-preset" | "update-color-preset"; preset: BackgroundColorPreset }
  | { type: "apply-color-preset" | "delete-color-preset"; id: string; backgroundId?: string }
  | { type: "rename-color-preset"; id: string; name: string }
  | { type: "save-visual-preset" | "update-visual-preset"; preset: BackgroundVisualPreset }
  | { type: "apply-visual-preset" | "delete-visual-preset" | "set-default-visual-preset"; id: string }
  | { type: "rename-visual-preset"; id: string; name: string }

export interface BackgroundColorPresetManagerProps {
  presets: readonly BackgroundColorPreset[]
  currentPalette: BackgroundColorPreset["palette"]
  currentMapping?: Readonly<Record<string, number>>
  backgroundId?: string
  onDraftAction: (action: BackgroundPresetDraftAction) => void
  disabled?: boolean
  className?: string
  idFactory?: () => string
  now?: () => number
}

export interface BackgroundVisualPresetManagerProps {
  presets: readonly BackgroundVisualPreset[]
  currentProperties: Readonly<Record<string, unknown>>
  currentMapping: Readonly<Record<string, number>>
  backgroundName: string
  defaultPresetId?: string | null
  roleLabels?: Readonly<Record<string, string>>
  onDraftAction: (action: BackgroundPresetDraftAction) => void
  disabled?: boolean
  className?: string
  idFactory?: () => string
  now?: () => number
}

type BackgroundPresetManagerProps =
  | ({ kind: "color" } & BackgroundColorPresetManagerProps)
  | ({ kind: "visual" } & BackgroundVisualPresetManagerProps)

function boundedName(value: string) {
  return value.trim().replace(/\s+/g, " ").slice(0, PRESET_NAME_LIMIT)
}

function presetDisplayName(value: string) {
  return boundedName(value) || "Untitled preset"
}

function defaultIdFactory() {
  return globalThis.crypto?.randomUUID?.()
    ?? `preset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

function isSharedColorProperty(key: string) {
  return SHARED_COLOR_PROPERTY_KEYS.has(key)
    || /^(?:primary|secondary|accent|foreground|background|cta.*)?color/i.test(key)
}

function summaryValue(value: unknown) {
  if (typeof value === "boolean") {
    return value ? "On" : "Off"
  }
  if (typeof value === "number" || typeof value === "string") {
    return String(value)
  }
  if (Array.isArray(value)) {
    return `${value.length} values`
  }
  return "Configured"
}

function visualPresetSummary(
  preset: BackgroundVisualPreset,
  roleLabels: Readonly<Record<string, string>>,
) {
  const properties = Object.entries(preset.properties)
    .filter(([key]) => !isSharedColorProperty(key))
  const mapping = Object.entries(preset.mapping ?? {})

  return (
    <div className={styles.presetSummary}>
      <p>Shared colors are not included.</p>
      {properties.length > 0 ? (
        <dl>
          {properties.map(([key, value]) => (
            <div key={key}>
              <dt>{key}</dt>
              <dd>{summaryValue(value)}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <p>No saved non-color property changes.</p>
      )}
      <p className={styles.presetMappingTitle}>Active color mapping</p>
      {mapping.length > 0 ? (
        <ul>
          {mapping.map(([roleId, swatchIndex]) => (
            <li key={roleId}>
              {roleLabels[roleId] ?? roleId}: Swatch {Number(swatchIndex) + 1}
            </li>
          ))}
        </ul>
      ) : (
        <p>Uses the curated mapping.</p>
      )}
    </div>
  )
}

/**
 * Shared presentation for the two intentionally separate preset collections.
 * It emits reducer-compatible draft actions only; storage and account sync are
 * deliberately absent from this component.
 */
export function BackgroundPresetManager(props: BackgroundPresetManagerProps) {
  const componentId = useId()
  const {
    kind,
    presets,
    onDraftAction,
    disabled = false,
    className,
    idFactory = defaultIdFactory,
    now = Date.now,
  } = props
  const [newName, setNewName] = useState("")
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState("")
  const [deleteTarget, setDeleteTarget] = useState<BackgroundPresetBase | null>(null)
  const [status, setStatus] = useState("")
  const isVisual = kind === "visual"
  const limit = isVisual ? BACKGROUND_VISUAL_PRESET_LIMIT : BACKGROUND_COLOR_PRESET_LIMIT
  const atLimit = presets.length >= limit
  const collectionLabel = isVisual ? "Visual presets" : "Color presets"
  const itemLabel = isVisual ? "visual preset" : "color preset"
  const backgroundLabel = isVisual ? ` for ${props.backgroundName}` : ""
  const defaultMarker = isVisual ? props.defaultPresetId : null

  function announce(message: string) {
    setStatus(message)
  }

  function buildPreset(id: string, name: string): BackgroundColorPreset | BackgroundVisualPreset {
    const timestamp = now()
    if (kind === "color") {
      return {
        id,
        name,
        timestamp,
        palette: structuredClone(props.currentPalette),
        mappingsByBackground: props.backgroundId && props.currentMapping
          ? { [props.backgroundId]: structuredClone(props.currentMapping) }
          : {},
      }
    }
    return {
      id,
      name,
      timestamp,
      properties: structuredClone(props.currentProperties),
      mapping: structuredClone(props.currentMapping),
    }
  }

  function saveAsNew() {
    const name = boundedName(newName)
    if (!name) {
      announce(`Enter a name before saving a ${itemLabel}.`)
      return
    }
    if (atLimit || disabled) {
      announce(`${collectionLabel} limit reached. Delete one before saving another.`)
      return
    }
    const preset = buildPreset(idFactory(), name)
    onDraftAction({
      type: kind === "visual" ? "save-visual-preset" : "save-color-preset",
      preset,
    } as BackgroundPresetDraftAction)
    setNewName("")
    announce(`${name} added to the draft ${collectionLabel.toLowerCase()}.`)
  }

  function applyPreset(preset: BackgroundPresetBase) {
    const name = presetDisplayName(preset.name)
    onDraftAction({
      type: kind === "visual" ? "apply-visual-preset" : "apply-color-preset",
      id: preset.id,
      ...(kind === "color" && props.backgroundId ? { backgroundId: props.backgroundId } : {}),
    } as BackgroundPresetDraftAction)
    announce(`${name} applied to the draft.`)
  }

  function updatePreset(preset: BackgroundPresetBase) {
    const name = presetDisplayName(preset.name)
    onDraftAction({
      type: kind === "visual" ? "update-visual-preset" : "update-color-preset",
      preset: buildPreset(preset.id, name),
    } as BackgroundPresetDraftAction)
    announce(`${name} updated in the draft.`)
  }

  function beginRename(preset: BackgroundPresetBase) {
    const name = presetDisplayName(preset.name)
    setRenamingId(preset.id)
    setRenameValue(name)
    announce(`Renaming ${name}.`)
  }

  function commitRename(preset: BackgroundPresetBase) {
    const name = boundedName(renameValue)
    if (!name) {
      announce(`${collectionLabel} names cannot be empty.`)
      return
    }
    onDraftAction({
      type: kind === "visual" ? "rename-visual-preset" : "rename-color-preset",
      id: preset.id,
      name,
    })
    setRenamingId(null)
    setRenameValue("")
    announce(`${presetDisplayName(preset.name)} renamed to ${name} in the draft.`)
  }

  function deletePreset() {
    if (!deleteTarget) {
      return
    }
    onDraftAction({
      type: kind === "visual" ? "delete-visual-preset" : "delete-color-preset",
      id: deleteTarget.id,
    })
    announce(`${presetDisplayName(deleteTarget.name)} deleted from the draft.`)
    setDeleteTarget(null)
  }

  return (
    <section
      className={cn(styles.controlCard, styles.backgroundPresetManager, className)}
      aria-labelledby={`${componentId}-title`}
    >
      <div className={styles.presetHeader}>
        <div>
          <p id={`${componentId}-title`} className={styles.globalColorTitle}>
            {collectionLabel}
          </p>
          <p className={styles.controlDescription}>
            {isVisual
              ? `Save up to ${limit} property and mapping presets${backgroundLabel}.`
              : `Save up to ${limit} reusable Custom or Harmony palettes. Color presets have no default.`}
          </p>
        </div>
        <span className={styles.presetCount}>{presets.length} of {limit}</span>
      </div>

      <div className={styles.presetCreateRow}>
        <label htmlFor={`${componentId}-new-name`} className={styles.srOnly}>
          New {itemLabel} name
        </label>
        <input
          id={`${componentId}-new-name`}
          type="text"
          value={newName}
          maxLength={PRESET_NAME_LIMIT}
          onChange={(event) => setNewName(event.currentTarget.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              saveAsNew()
            }
          }}
          className={styles.globalColorNameInput}
          placeholder={`New ${itemLabel} name`}
          disabled={disabled || atLimit}
        />
        <Button type="button" size="compact" onClick={saveAsNew} disabled={disabled || atLimit}>
          Save as new
        </Button>
      </div>

      <p
        className={cn(styles.presetStatus, atLimit && styles.presetLimitStatus)}
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {atLimit
          ? `${collectionLabel} limit reached (${limit} of ${limit}). Delete one before saving another.`
          : `${limit - presets.length} ${itemLabel}${limit - presets.length === 1 ? "" : "s"} available.`}
        {status ? ` ${status}` : ""}
      </p>

      {presets.length > 0 ? (
        <ul className={styles.presetList}>
          {presets.map((preset) => {
            const isDefault = kind === "visual" && defaultMarker === preset.id
            const boundedPresetName = presetDisplayName(preset.name)
            return (
              <li key={preset.id} className={styles.presetItem}>
                <div className={styles.presetItemHeader}>
                  {renamingId === preset.id ? (
                    <div className={styles.presetRenameRow}>
                      <label htmlFor={`${componentId}-rename-${preset.id}`} className={styles.srOnly}>
                        Rename {boundedPresetName}
                      </label>
                      <input
                        id={`${componentId}-rename-${preset.id}`}
                        type="text"
                        value={renameValue}
                        maxLength={PRESET_NAME_LIMIT}
                        onChange={(event) => setRenameValue(event.currentTarget.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault()
                            commitRename(preset)
                          } else if (event.key === "Escape") {
                            setRenamingId(null)
                            setRenameValue("")
                          }
                        }}
                        className={styles.globalColorNameInput}
                        autoFocus
                      />
                      <Button type="button" size="compact" onClick={() => commitRename(preset)}>
                        Rename
                      </Button>
                      <Button
                        type="button"
                        size="compact"
                        variant="ghost"
                        onClick={() => {
                          setRenamingId(null)
                          setRenameValue("")
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <>
                      <div className={styles.presetName}>
                        <span>{boundedPresetName}</span>
                        {isDefault ? <span className={styles.presetDefaultMarker}>Default</span> : null}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            aria-label={`Actions for ${itemLabel} ${boundedPresetName}`}
                            disabled={disabled}
                          >
                            <MoreHorizontal aria-hidden="true" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>{boundedPresetName}</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onSelect={() => applyPreset(preset)}>
                            Apply
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => updatePreset(preset)}>
                            Update
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => beginRename(preset)}>
                            Rename
                          </DropdownMenuItem>
                          {kind === "visual" ? (
                            <DropdownMenuItem
                              disabled={isDefault}
                              onSelect={() => {
                                onDraftAction({ type: "set-default-visual-preset", id: preset.id })
                                announce(`${boundedPresetName} set as the draft default for ${props.backgroundName}.`)
                              }}
                            >
                              Set as default
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className={styles.presetDeleteItem}
                            onSelect={() => setDeleteTarget(preset)}
                          >
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </>
                  )}
                </div>

                {kind === "visual"
                  ? visualPresetSummary(preset as BackgroundVisualPreset, props.roleLabels ?? {})
                  : (() => {
                    const colorPreset = preset as BackgroundColorPreset
                    return (
                    <div className={styles.presetColorSummary}>
                      <span>{colorPreset.palette.mode === "harmony" ? "Harmony" : "Custom"}</span>
                      <span>{colorPreset.palette.swatches.length} swatches</span>
                    </div>
                    )
                  })()}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className={styles.presetEmpty}>No saved {itemLabel}s yet.</p>
      )}

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deleteTarget ? presetDisplayName(deleteTarget.name) : itemLabel}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This removes the preset from the current draft. Canceling the full Visual editor will
              restore the opening preset collection.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep preset</AlertDialogCancel>
            <AlertDialogAction onClick={deletePreset}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}

export function BackgroundColorPresetManager(props: BackgroundColorPresetManagerProps) {
  return <BackgroundPresetManager kind="color" {...props} />
}

export function BackgroundVisualPresetManager(props: BackgroundVisualPresetManagerProps) {
  return <BackgroundPresetManager kind="visual" {...props} />
}
