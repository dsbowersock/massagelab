import {
  backgroundPaletteRegistry,
  backgroundPreferenceNormalizationOptions,
} from "../components/backgrounds/backgroundPaletteRegistry.ts"
import {
  backgroundRegistry,
  userCanUseBackground,
  type BackgroundAccessSnapshot,
} from "../components/backgrounds/backgroundRegistry.ts"
import { sanitizeChimerSettingsForEntitlements } from "./chimer-timer.js"
import { objectRecord } from "./onboarding-preferences.js"

/**
 * Sanitizes the canonical Chimer snapshot while retaining renderer tuning for
 * every permanently owned background. Clock and Music share the flat renderer
 * settings even when their selected visual is not the canonical Chimer
 * background.
 */
export function sanitizeAccessibleChimerSettings(
  input: unknown,
  access: BackgroundAccessSnapshot,
) {
  const candidateSettings = objectRecord(input)
  const options = {
    canUseAccountColorControls: true,
    backgroundPreferenceOptions: backgroundPreferenceNormalizationOptions,
  }
  const canonicalSettings = sanitizeChimerSettingsForEntitlements(
    candidateSettings,
    access,
    options,
  )
  const accessibleRendererSettings: Record<string, unknown> = {}

  for (const backgroundId of access.ownedBackgroundIds) {
    const background = backgroundRegistry.find((entry) => entry.id === backgroundId)
    if (!background || !userCanUseBackground(background, access)) {
      continue
    }
    const visualPropertyKeys = backgroundPaletteRegistry[background.id]?.visualPropertyKeys
    if (!visualPropertyKeys?.length) {
      continue
    }
    const scopedSettings = sanitizeChimerSettingsForEntitlements(
      {
        ...candidateSettings,
        backgroundId: background.id,
      },
      access,
      options,
    )
    for (const propertyKey of visualPropertyKeys) {
      accessibleRendererSettings[propertyKey] = scopedSettings[propertyKey]
    }
  }

  return {
    ...canonicalSettings,
    ...accessibleRendererSettings,
  }
}
