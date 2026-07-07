export type HapticPattern = number | number[]
const APP_SETTINGS_STORAGE_KEY = "massage-lab-settings"

/**
 * Reads the persisted site-wide haptic preference when browser storage is available.
 *
 * @returns null when storage is unavailable, unset, malformed, or unreadable.
 */
function readSavedHapticsEnabled(): boolean | null {
  if (typeof window === "undefined") {
    return null
  }

  try {
    const rawSettings = window.localStorage.getItem(APP_SETTINGS_STORAGE_KEY)
    if (!rawSettings) {
      return null
    }

    const settings = JSON.parse(rawSettings)
    if (!settings || typeof settings !== "object" || typeof settings.hapticFeedbackEnabled !== "boolean") {
      return null
    }

    return settings.hapticFeedbackEnabled
  } catch {
    return null
  }
}

export function shouldPlayHaptics(explicitEnabled?: boolean): boolean {
  if (typeof explicitEnabled === "boolean") {
    return explicitEnabled
  }

  return readSavedHapticsEnabled() ?? true
}

/**
 * Fires a short vibration pulse when supported and enabled.
 *
 * @param enabled user preference for haptic feedback
 * @param durationMilliseconds vibration length, typically 10-20ms
 */
export function triggerHapticFeedback(enabled: boolean | undefined, durationMilliseconds: HapticPattern = 15): void {
  if (!shouldPlayHaptics(enabled)) {
    return
  }

  if (typeof navigator === "undefined") {
    return
  }

  const navigatorWithVibrate = navigator as Navigator & {
    vibrate?: (pattern: HapticPattern) => boolean
  }

  if (typeof navigatorWithVibrate.vibrate !== "function") {
    return
  }

  try {
    navigatorWithVibrate.vibrate(durationMilliseconds)
  } catch {
    // Intentionally silent: unsupported environments and blocked haptics can throw.
  }
}
