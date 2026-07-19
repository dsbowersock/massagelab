/** @typedef {{getItem: (key: string) => string | null, setItem: (key: string, value: string) => void}} VisualHintStorage */

export const VISUAL_PANEL_OPENED_STORAGE_KEY = "massagelab.chimer.visual-panel-opened.v1"

const getDeviceStorage = () => {
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}

/** Reads only the non-sensitive, device-local Visual-panel visit flag. */
export function readVisualPanelOpened(storage = getDeviceStorage()) {
  try {
    return storage?.getItem(VISUAL_PANEL_OPENED_STORAGE_KEY) === "1"
  } catch {
    return false
  }
}

/** Records a Visual-panel visit without allowing denied storage to block UI. */
export function writeVisualPanelOpened(storage = getDeviceStorage()) {
  try {
    storage?.setItem(VISUAL_PANEL_OPENED_STORAGE_KEY, "1")
    return Boolean(storage)
  } catch {
    return false
  }
}
