import {
  normalizeBackgroundPaletteState,
  resolveBackgroundRoleColors,
  resolveEffectiveBackgroundPaletteMode,
} from "../../lib/background-palette.js"
import {
  backgroundPaletteRegistry,
} from "./backgroundPaletteRegistry.ts"
import type { CSSProperties } from "react"
import type {
  BackgroundEffectProps,
} from "./effects/css-backgrounds"

export interface ResolveBackgroundEffectPropsInput {
  selectedId: string
  effectProps: BackgroundEffectProps
  palette: unknown
  mapping?: Readonly<Record<string, unknown>>
  canCustomize: boolean
}

export interface ResolveBackgroundFallbackStyleInput {
  selectedId: string
  fallbackStyle?: CSSProperties
  palette: unknown
  mapping?: Readonly<Record<string, unknown>>
  canCustomize: boolean
}

/**
 * Resolves the selected renderer's staged palette props without consulting
 * React, persistence, ownership, or plan names. Unsupported and unknown
 * backgrounds preserve the caller's exact props object and receive no tint.
 */
export function resolveBackgroundEffectProps({
  selectedId,
  effectProps,
  palette,
  mapping,
  canCustomize,
}: ResolveBackgroundEffectPropsInput): BackgroundEffectProps {
  const adapter = backgroundPaletteRegistry[selectedId]
  if (!adapter || adapter.status === "unsupported") {
    return effectProps
  }

  const normalizedPalette = normalizeBackgroundPaletteState(palette)
  // Persisted Harmony falls back to Source when this renderer exposes no Harmony contract.
  const adapterPalette = normalizedPalette.mode === "harmony" && adapter.supportsHarmony === false
    ? { ...normalizedPalette, mode: "source" }
    : normalizedPalette
  const mode = resolveEffectiveBackgroundPaletteMode({
    savedMode: adapterPalette.mode,
    canCustomize,
  })
  const resolvedRoleColors = resolveBackgroundRoleColors({
    palette: adapterPalette,
    adapter,
    mapping,
    canCustomize,
  })
  // Source colors are renderer metadata rather than persisted swatches. Keep
  // non-hex CSS source values such as DNA/Twisted HSL anchors exact without
  // changing Track 4A's canonical normalization of its existing hex sources.
  const roleColors = mode === "source"
    ? Object.fromEntries(adapter.roles.map((role) => [
      role.id,
      role.sourceColorFormat === "hex"
        ? resolvedRoleColors[role.id]
        : role.sourceColor,
    ]))
    : resolvedRoleColors
  return adapter.applyRoleColors(effectProps, roleColors, mode)
}

/**
 * Gives loading, error, and reduced-motion fallbacks the same resolved role
 * colors as the selected renderer. Source and access-denied modes preserve the
 * authored fallback exactly.
 */
export function resolveBackgroundFallbackStyle({
  selectedId,
  fallbackStyle,
  palette,
  mapping,
  canCustomize,
}: ResolveBackgroundFallbackStyleInput): CSSProperties | undefined {
  const adapter = backgroundPaletteRegistry[selectedId]
  if (!adapter || adapter.status === "unsupported") {
    return fallbackStyle
  }

  const normalizedPalette = normalizeBackgroundPaletteState(palette)
  // Fallback underlays mirror the renderer by treating unsupported persisted Harmony as Source.
  const adapterPalette = normalizedPalette.mode === "harmony" && adapter.supportsHarmony === false
    ? { ...normalizedPalette, mode: "source" }
    : normalizedPalette
  const mode = resolveEffectiveBackgroundPaletteMode({
    savedMode: adapterPalette.mode,
    canCustomize,
  })
  if (mode === "source") {
    return fallbackStyle
  }

  const roleColors = resolveBackgroundRoleColors({
    palette: adapterPalette,
    adapter,
    mapping,
    canCustomize,
  })
  const colors = adapter.roles
    .map((role) => roleColors[role.id])
    .filter((color): color is string => Boolean(color))
  if (colors.length === 0) {
    return fallbackStyle
  }
  const gradientColors = colors.length === 1 ? [colors[0], colors[0]] : colors
  const lastIndex = gradientColors.length - 1
  const stops = gradientColors
    .map((color, index) => `${color} ${Math.round((index / lastIndex) * 100)}%`)
    .join(", ")

  return {
    ...fallbackStyle,
    background: `linear-gradient(135deg, ${stops})`,
  }
}
