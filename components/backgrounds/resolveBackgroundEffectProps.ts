import { resolveBackgroundRoleColors } from "../../lib/background-palette.js"
import {
  backgroundPaletteRegistry,
} from "./backgroundPaletteRegistry.ts"
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

  const roleColors = resolveBackgroundRoleColors({
    palette,
    adapter,
    mapping,
    canCustomize,
  })
  return adapter.applyRoleColors(effectProps, roleColors)
}
