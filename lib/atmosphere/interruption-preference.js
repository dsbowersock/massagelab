// @ts-check

export const ATMOSPHERE_INTERRUPTION_PREFERENCE_KEY =
  "massagelab-atmosphere-interruption-v1"
export const DEFAULT_RESUME_AFTER_INTERRUPTION = true

/** @typedef {() => StorageLike} StorageProvider */
/** @typedef {{ getItem: (key: string) => string | null, setItem: (key: string, value: string) => void }} StorageLike */
/** @typedef {{ value: boolean, available: boolean }} PreferenceResult */

/**
 * Read the device-local preference without allowing browser storage policy to
 * interrupt playback initialization.
 * @param {StorageProvider} storageProvider
 * @returns {PreferenceResult}
 */
export function readAtmosphereInterruptionPreference(storageProvider) {
  try {
    const raw = storageProvider().getItem(ATMOSPHERE_INTERRUPTION_PREFERENCE_KEY)
    if (raw === null) return { value: DEFAULT_RESUME_AFTER_INTERRUPTION, available: true }
    const parsed = JSON.parse(raw)
    if (parsed?.version !== 1 || typeof parsed.resumeAfterInterruption !== "boolean") {
      return { value: DEFAULT_RESUME_AFTER_INTERRUPTION, available: true }
    }
    return { value: parsed.resumeAfterInterruption, available: true }
  } catch {
    return { value: DEFAULT_RESUME_AFTER_INTERRUPTION, available: false }
  }
}

/**
 * Persist the preference when storage is available, otherwise retain the
 * requested in-memory value for the browser lifetime.
 * @param {StorageProvider} storageProvider
 * @param {boolean} value
 * @returns {PreferenceResult}
 */
export function writeAtmosphereInterruptionPreference(storageProvider, value) {
  const preference = value === true
  try {
    storageProvider().setItem(
      ATMOSPHERE_INTERRUPTION_PREFERENCE_KEY,
      JSON.stringify({ version: 1, resumeAfterInterruption: preference }),
    )
    return { value: preference, available: true }
  } catch {
    return { value: preference, available: false }
  }
}
