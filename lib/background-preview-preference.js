// @ts-check

export const BACKGROUND_PREVIEW_PREFERENCE_STORAGE_KEY =
  "massagelab-background-preview-autoplay-v1"

/**
 * Reads device intent without treating blocked storage as a reason to disable
 * the first-use autoplay default.
 * @param {Pick<Storage, "getItem">} storage
 */
export function readBackgroundPreviewPreference(storage) {
  try {
    return storage.getItem(BACKGROUND_PREVIEW_PREFERENCE_STORAGE_KEY) !== "false"
  } catch {
    return true
  }
}

/**
 * Persists device intent while allowing the current React session to continue
 * when browser privacy settings reject storage.
 * @param {Pick<Storage, "setItem">} storage
 * @param {boolean} enabled
 */
export function writeBackgroundPreviewPreference(storage, enabled) {
  try {
    storage.setItem(BACKGROUND_PREVIEW_PREFERENCE_STORAGE_KEY, enabled ? "true" : "false")
    return true
  } catch {
    return false
  }
}
