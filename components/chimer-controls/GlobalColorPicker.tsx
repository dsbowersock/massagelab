"use client"

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react"
import { createPortal } from "react-dom"
import { Pipette } from "lucide-react"

import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"
import styles from "./chimer-controls.module.css"

export type GlobalColorFieldName =
  | "primary"
  | "secondary"
  | "accent"
  | "background"
  | "foreground"
  | "ctaStart"
  | "ctaEnd"

export type GlobalColorValues = Record<GlobalColorFieldName, string>

export interface GlobalColorPickerProps {
  value: GlobalColorValues
  onChange: (value: GlobalColorValues) => void
  title?: string
  description?: string
  harmonyControl?: ReactNode
  paletteName?: string
  onPaletteNameChange?: (value: string) => void
  onSave?: (value: GlobalColorValues, paletteName: string) => void
  saveButtonLabel?: string
  className?: string
  disabled?: boolean
}

export interface ColorPickerSwatchProps {
  id?: string
  label: string
  value: string
  fallback?: string
  disabled?: boolean
  onChange: (value: string) => void
  className?: string
  buttonClassName?: string
}

export interface ColorPickerInputProps extends Omit<ColorPickerSwatchProps, "onChange"> {
  onValueChange: (value: string) => void
}

const COLOR_FIELDS = [
  { key: "primary", label: "Primary color" },
  { key: "secondary", label: "Color 2" },
  { key: "accent", label: "Color 3" },
  { key: "ctaStart", label: "Color 4" },
  { key: "ctaEnd", label: "Color 5" },
  { key: "background", label: "Color 6" },
] as const

const DEFAULT_PALETTE_NAME = "Saved palette"
const HEX_COLOR_MATCH = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i
const COLOR_PICKER_POPOVER_MARGIN = 16
const COLOR_PICKER_POPOVER_GAP = 10
const COLOR_PICKER_POPOVER_MAX_WIDTH = 352
const COLOR_PICKER_POPOVER_ESTIMATED_HEIGHT = 390

/** Identifies portaled picker content that remains part of an open Chimer control panel. */
export const CHIMER_CONTROL_PORTAL_SELECTOR = '[data-chimer-control-portal="true"]'

type RgbColor = {
  red: number
  green: number
  blue: number
}

type HsvColor = {
  h: number
  s: number
  v: number
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function normalizeHex(value: string, fallback: string) {
  if (typeof value !== "string") {
    return fallback
  }

  if (!HEX_COLOR_MATCH.test(value.trim())) {
    return fallback
  }

  const cleanValue = value.trim()
  if (cleanValue.length === 4) {
    return `#${cleanValue[1]}${cleanValue[1]}${cleanValue[2]}${cleanValue[2]}${cleanValue[3]}${cleanValue[3]}`.toLowerCase()
  }

  return cleanValue.toLowerCase()
}

function parseHexToRgb(value: string, fallback: string): RgbColor {
  const normalized = normalizeHex(value, fallback)
  return {
    red: Number.parseInt(normalized.slice(1, 3), 16),
    green: Number.parseInt(normalized.slice(3, 5), 16),
    blue: Number.parseInt(normalized.slice(5, 7), 16),
  }
}

function rgbToHex({ red, green, blue }: RgbColor) {
  return `#${[red, green, blue]
    .map((channel) => clampNumber(Math.round(channel), 0, 255).toString(16).padStart(2, "0"))
    .join("")}`
}

function rgbToHsv({ red, green, blue }: RgbColor): HsvColor {
  const r = clampNumber(red, 0, 255) / 255
  const g = clampNumber(green, 0, 255) / 255
  const b = clampNumber(blue, 0, 255) / 255
  const maxChannel = Math.max(r, g, b)
  const minChannel = Math.min(r, g, b)
  const delta = maxChannel - minChannel
  let hue = 0

  if (delta > 0) {
    if (maxChannel === r) {
      hue = 60 * (((g - b) / delta) % 6)
    } else if (maxChannel === g) {
      hue = 60 * ((b - r) / delta + 2)
    } else {
      hue = 60 * ((r - g) / delta + 4)
    }
  }

  return {
    h: (hue + 360) % 360,
    s: maxChannel === 0 ? 0 : delta / maxChannel,
    v: maxChannel,
  }
}

function hsvToRgb({ h, s, v }: HsvColor): RgbColor {
  const normalizedHue = ((h % 360) + 360) % 360
  const chroma = v * s
  const secondary = chroma * (1 - Math.abs(((normalizedHue / 60) % 2) - 1))
  const match = v - chroma
  let red = 0
  let green = 0
  let blue = 0

  if (normalizedHue < 60) {
    red = chroma
    green = secondary
  } else if (normalizedHue < 120) {
    red = secondary
    green = chroma
  } else if (normalizedHue < 180) {
    green = chroma
    blue = secondary
  } else if (normalizedHue < 240) {
    green = secondary
    blue = chroma
  } else if (normalizedHue < 300) {
    red = secondary
    blue = chroma
  } else {
    red = chroma
    blue = secondary
  }

  return {
    red: (red + match) * 255,
    green: (green + match) * 255,
    blue: (blue + match) * 255,
  }
}

function hsvToHex(color: HsvColor) {
  return rgbToHex(hsvToRgb(color))
}

type EyeDropperConstructor = new () => {
  open: () => Promise<{ sRGBHex: string }>
}

function getEyeDropperConstructor() {
  if (typeof window === "undefined") {
    return undefined
  }

  return (window as Window & { EyeDropper?: EyeDropperConstructor }).EyeDropper
}

export function ColorPickerSwatch({
  id,
  label,
  value,
  fallback,
  disabled,
  onChange,
  className,
  buttonClassName,
}: ColorPickerSwatchProps) {
  const fallbackId = useId()
  const fieldId = id ?? fallbackId
  const [isOpen, setIsOpen] = useState(false)
  const [draftHex, setDraftHex] = useState(value)
  const [hasMounted, setHasMounted] = useState(false)
  const [popoverStyle, setPopoverStyle] = useState<CSSProperties | undefined>(undefined)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const popoverRef = useRef<HTMLDivElement | null>(null)
  const colorAreaRef = useRef<HTMLDivElement | null>(null)
  const fallbackColor = fallback ?? value
  const normalizedColor = normalizeHex(value, fallbackColor)
  const hsvColor = useMemo(() => rgbToHsv(parseHexToRgb(normalizedColor, fallbackColor)), [fallbackColor, normalizedColor])
  const hueColor = hsvToHex({ h: hsvColor.h, s: 1, v: 1 })
  const eyeDropperSupported = typeof window !== "undefined" && Boolean(getEyeDropperConstructor())

  const updatePopoverPosition = useCallback(() => {
    if (typeof window === "undefined" || !containerRef.current) {
      return
    }

    const triggerBounds = containerRef.current.getBoundingClientRect()
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const popoverWidth = Math.min(
      COLOR_PICKER_POPOVER_MAX_WIDTH,
      Math.max(0, viewportWidth - COLOR_PICKER_POPOVER_MARGIN * 2),
    )
    const spaceBelow = viewportHeight - triggerBounds.bottom
    const shouldOpenAbove =
      spaceBelow < COLOR_PICKER_POPOVER_ESTIMATED_HEIGHT &&
      triggerBounds.top > spaceBelow

    const unclampedLeft = triggerBounds.left + triggerBounds.width / 2 - popoverWidth / 2
    const left = clampNumber(
      unclampedLeft,
      COLOR_PICKER_POPOVER_MARGIN,
      Math.max(COLOR_PICKER_POPOVER_MARGIN, viewportWidth - popoverWidth - COLOR_PICKER_POPOVER_MARGIN),
    )
    const top = shouldOpenAbove
      ? Math.max(COLOR_PICKER_POPOVER_MARGIN, triggerBounds.top - COLOR_PICKER_POPOVER_ESTIMATED_HEIGHT - COLOR_PICKER_POPOVER_GAP)
      : Math.min(
        Math.max(COLOR_PICKER_POPOVER_MARGIN, triggerBounds.bottom + COLOR_PICKER_POPOVER_GAP),
        Math.max(COLOR_PICKER_POPOVER_MARGIN, viewportHeight - COLOR_PICKER_POPOVER_MARGIN - COLOR_PICKER_POPOVER_ESTIMATED_HEIGHT),
      )

    setPopoverStyle({
      left,
      position: "fixed",
      top,
      transform: "none",
      width: popoverWidth,
    })
  }, [])

  useEffect(() => {
    setHasMounted(true)
  }, [])

  useEffect(() => {
    setDraftHex(normalizedColor)
  }, [normalizedColor])

  useEffect(() => {
    if (!isOpen) {
      return undefined
    }

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (containerRef.current?.contains(target) || popoverRef.current?.contains(target)) {
        return
      }

      setIsOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false)
      }
    }

    updatePopoverPosition()
    document.addEventListener("pointerdown", handlePointerDown)
    document.addEventListener("keydown", handleKeyDown)
    window.addEventListener("resize", updatePopoverPosition)
    window.addEventListener("scroll", updatePopoverPosition, true)

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown)
      document.removeEventListener("keydown", handleKeyDown)
      window.removeEventListener("resize", updatePopoverPosition)
      window.removeEventListener("scroll", updatePopoverPosition, true)
    }
  }, [isOpen, updatePopoverPosition])

  function commitColor(nextColor: string) {
    const normalizedNextColor = normalizeHex(nextColor, normalizedColor)
    setDraftHex(normalizedNextColor)
    onChange(normalizedNextColor)
  }

  function updateColorFromArea(event: ReactPointerEvent<HTMLDivElement>) {
    if (disabled || !colorAreaRef.current) {
      return
    }

    const bounds = colorAreaRef.current.getBoundingClientRect()
    const nextSaturation = clampNumber((event.clientX - bounds.left) / bounds.width, 0, 1)
    const nextValue = clampNumber(1 - (event.clientY - bounds.top) / bounds.height, 0, 1)
    commitColor(hsvToHex({ h: hsvColor.h, s: nextSaturation, v: nextValue }))
  }

  function handleAreaKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    const step = event.shiftKey ? 0.1 : 0.03
    let nextSaturation = hsvColor.s
    let nextValue = hsvColor.v

    if (event.key === "ArrowLeft") {
      nextSaturation -= step
    } else if (event.key === "ArrowRight") {
      nextSaturation += step
    } else if (event.key === "ArrowDown") {
      nextValue -= step
    } else if (event.key === "ArrowUp") {
      nextValue += step
    } else {
      return
    }

    event.preventDefault()
    commitColor(hsvToHex({
      h: hsvColor.h,
      s: clampNumber(nextSaturation, 0, 1),
      v: clampNumber(nextValue, 0, 1),
    }))
  }

  async function handleEyeDropperClick() {
    const EyeDropperClass = getEyeDropperConstructor()
    if (!EyeDropperClass || disabled) {
      return
    }

    try {
      const result = await new EyeDropperClass().open()
      commitColor(result.sRGBHex)
    } catch {
      // Users can cancel the native picker; no UI state needs to change.
    }
  }

  return (
    <div ref={containerRef} className={cn(styles.colorPickerShell, className)}>
      <button
        id={fieldId}
        type="button"
        className={cn(styles.globalColorSwatchButton, buttonClassName)}
        onClick={() => {
          if (!isOpen) {
            updatePopoverPosition()
          }
          setIsOpen((current) => !current)
        }}
        disabled={disabled}
        aria-label={`${label} picker`}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <span
          className={styles.globalColorSwatchFace}
          style={{ backgroundColor: normalizedColor } as CSSProperties}
          aria-hidden="true"
        />
        <span className={styles.globalColorSwatchValue}>{normalizedColor}</span>
      </button>

      {isOpen && hasMounted && typeof document !== "undefined" ? createPortal(
        <div
          ref={popoverRef}
          className={styles.colorPickerPopover}
          style={popoverStyle}
          role="dialog"
          aria-label={`${label} picker`}
          aria-modal="false"
          data-chimer-control-portal="true"
        >
          <div
            ref={colorAreaRef}
            className={styles.colorPickerArea}
            style={{ "--picker-hue-color": hueColor } as CSSProperties}
            role="slider"
            tabIndex={disabled ? -1 : 0}
            aria-label={`${label} saturation and brightness`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(hsvColor.v * 100)}
            aria-valuetext={normalizedColor}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId)
              updateColorFromArea(event)
            }}
            onPointerMove={(event) => {
              if (event.buttons === 1) {
                updateColorFromArea(event)
              }
            }}
            onKeyDown={handleAreaKeyDown}
          >
            <span
              className={styles.colorPickerAreaThumb}
              style={{
                left: `${hsvColor.s * 100}%`,
                top: `${(1 - hsvColor.v) * 100}%`,
              }}
            />
          </div>

          <div className={styles.colorPickerSliderRow}>
            <button
              type="button"
              className={styles.colorPickerEyeDropper}
              onClick={handleEyeDropperClick}
              disabled={disabled || !eyeDropperSupported}
              title={eyeDropperSupported ? "Pick a color from the screen" : "Eye dropper is not supported in this browser"}
              aria-label="Pick a color from the screen"
            >
              <Pipette aria-hidden="true" size={18} strokeWidth={2.4} />
            </button>
            <Slider
              min={0}
              max={360}
              step={1}
              value={[Math.round(hsvColor.h)]}
              onValueChange={([nextHue]) => {
                commitColor(hsvToHex({
                  h: nextHue ?? hsvColor.h,
                  s: hsvColor.s,
                  v: hsvColor.v,
                }))
              }}
              className="ml-slider-hue"
              style={{ "--ml-slider-hue-color": hueColor } as CSSProperties}
              disabled={disabled}
              aria-label={`${label} hue`}
            />
          </div>

          <div className={styles.colorPickerInputRow}>
            <select className={styles.colorPickerFormatSelect} defaultValue="hex" aria-label="Color format">
              <option value="hex">HEX</option>
            </select>
            <input
              id={`${fieldId}-hex`}
              type="text"
              className={styles.colorPickerHexInput}
              value={draftHex}
              onChange={(event) => setDraftHex(event.currentTarget.value)}
              onBlur={() => commitColor(draftHex)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  commitColor(draftHex)
                  event.currentTarget.blur()
                }
              }}
              disabled={disabled}
              spellCheck={false}
              inputMode="text"
              aria-label={`${label} hex value`}
            />
          </div>
        </div>,
        document.body,
      ) : null}
    </div>
  )
}

/** Gives controlled color fields the shared picker without emulating native input events. */
export function ColorPickerInput({
  onValueChange,
  buttonClassName,
  ...props
}: ColorPickerInputProps) {
  return (
    <ColorPickerSwatch
      {...props}
      onChange={onValueChange}
      buttonClassName={cn("ml-color-picker-input", buttonClassName)}
    />
  )
}

function ColorPickerField({
  id,
  label,
  value,
  fallback,
  disabled,
  onChange,
}: {
  id: string
  label: string
  value: string
  fallback: string
  disabled?: boolean
  onChange: (value: string) => void
}) {
  return (
    <div className={styles.globalColorField}>
      <span className={styles.globalColorLabel} id={`${id}-label`}>
        {label}
      </span>
      <ColorPickerSwatch
        id={id}
        label={label}
        value={value}
        fallback={fallback}
        disabled={disabled}
        onChange={onChange}
      />
    </div>
  )
}

/**
 * Shared global palette controls for Chimer and app-wide visual presets.
 */
export function GlobalColorPicker({
  value,
  onChange,
  title = "Global Colors",
  description = "Set your preferred MassageLab colors once. Backgrounds and controls can use these values automatically.",
  harmonyControl,
  paletteName,
  onPaletteNameChange,
  onSave,
  saveButtonLabel = "Save palette",
  className,
  disabled,
}: GlobalColorPickerProps) {
  const componentId = useId()
  const [draftColors, setDraftColors] = useState(value)
  const draftColorsRef = useRef(value)
  const [draftName, setDraftName] = useState(paletteName ?? "")
  const isSaveDisabled = disabled || !onSave

  useEffect(() => {
    draftColorsRef.current = value
    setDraftColors(value)
  }, [value])

  useEffect(() => {
    if (typeof paletteName === "string") {
      setDraftName(paletteName)
    }
  }, [paletteName])

  function commitFieldColor(key: GlobalColorFieldName, colorValue: string) {
    const current = draftColorsRef.current
    const normalizedColor = normalizeHex(colorValue, current[key])
    const nextValues = {
      ...current,
      [key]: normalizedColor,
    }

    draftColorsRef.current = nextValues
    setDraftColors(nextValues)
    onChange(nextValues)
  }

  return (
    <section className={cn(styles.controlCard, styles.globalColorPicker, className)}>
      <div className={styles.globalColorIntro}>
        <p className={styles.globalColorTitle}>{title}</p>
        <p className={styles.globalColorDescription}>{description}</p>
      </div>

      {harmonyControl ? <div className={styles.globalColorHarmony}>{harmonyControl}</div> : null}

      <div className={styles.globalColorGrid}>
        {COLOR_FIELDS.map((field) => (
          <ColorPickerField
            key={field.key}
            id={`${componentId}-${field.key}`}
            label={field.label}
            value={draftColors[field.key]}
            fallback={value[field.key]}
            disabled={disabled}
            onChange={(nextColor) => commitFieldColor(field.key, nextColor)}
          />
        ))}
      </div>

      {onSave ? (
        <div className={styles.globalColorActions}>
          {onPaletteNameChange ? (
            <input
              id={`${componentId}-palette-name`}
              type="text"
              value={draftName}
              onChange={(event) => {
                const nextName = event.currentTarget.value
                setDraftName(nextName)
                onPaletteNameChange(nextName)
              }}
              onBlur={() => setDraftName(draftName.trim() || DEFAULT_PALETTE_NAME)}
              className={styles.globalColorNameInput}
              placeholder="Palette name"
              aria-label="Palette name"
              disabled={disabled}
            />
          ) : null}
          <button
            type="button"
            className={styles.globalColorPreviewButton}
            onClick={() => onSave(draftColors, draftName.trim() || DEFAULT_PALETTE_NAME)}
            disabled={isSaveDisabled}
          >
            {saveButtonLabel}
          </button>
        </div>
      ) : null}
    </section>
  )
}
