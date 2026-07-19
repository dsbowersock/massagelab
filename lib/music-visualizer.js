export const MUSIC_VISUALIZER_APP_SETTINGS_KEY = "musicVisualizer"

export const DEFAULT_MUSIC_VISUALIZER_DEVICE_PREFERENCES = Object.freeze({
  backgroundId: null,
  showClock: false,
})

export const DEFAULT_MUSIC_VISUALIZER_ACCOUNT_PREFERENCES = Object.freeze({
  defaultBackgroundId: null,
  showClock: false,
})

const DEFAULT_MUSIC_VISUALIZER_RETURN_TO = "/music"
const INTERNAL_URL_BASE = "https://massagelab.invalid"

function normalizeBackgroundId(value) {
  if (typeof value !== "string") return null

  const backgroundId = value.trim()
  return backgroundId || null
}

/**
 * Returns the device-scoped visualizer fields that may be persisted locally.
 * Unsupported values and unrelated UI state are replaced by safe defaults.
 */
export function normalizeMusicVisualizerDevicePreferences(value) {
  const preferences = value && typeof value === "object" ? value : {}

  return {
    backgroundId: normalizeBackgroundId(preferences.backgroundId),
    showClock: typeof preferences.showClock === "boolean" ? preferences.showClock : false,
  }
}

/**
 * Returns the account-scoped visualizer fields that may follow a signed-in user.
 * Device-only and unknown fields are intentionally omitted from the result.
 */
export function normalizeMusicVisualizerAccountPreferences(value) {
  const preferences = value && typeof value === "object" ? value : {}

  return {
    defaultBackgroundId: normalizeBackgroundId(preferences.defaultBackgroundId),
    showClock: typeof preferences.showClock === "boolean" ? preferences.showClock : false,
  }
}

/**
 * Selects the first saved background the caller says is currently usable.
 * Saved IDs are treated as inputs only; an unavailable ID is returned for picker messaging.
 */
export function resolveMusicVisualizerBackground({
  deviceBackgroundId,
  accountDefaultBackgroundId,
  canUseBackground,
}) {
  const deviceId = normalizeBackgroundId(deviceBackgroundId)
  const accountId = normalizeBackgroundId(accountDefaultBackgroundId)

  if (deviceId && canUseBackground(deviceId)) {
    return {
      backgroundId: deviceId,
      source: "device",
      unavailableSavedId: null,
    }
  }

  if (accountId && canUseBackground(accountId)) {
    return {
      backgroundId: accountId,
      source: "account",
      unavailableSavedId: null,
    }
  }

  return {
    backgroundId: null,
    source: "none",
    unavailableSavedId: deviceId ?? accountId,
  }
}

/**
 * Reduces a return target to an internal pathname and query string.
 * Recursive Music-to-Clock targets and URL forms that can escape the app are rejected.
 */
export function sanitizeMusicVisualizerReturnTo(value) {
  if (typeof value !== "string") return DEFAULT_MUSIC_VISUALIZER_RETURN_TO

  const candidate = value.trim()
  if (!candidate.startsWith("/") || candidate.startsWith("//") || candidate.includes("\\")) {
    return DEFAULT_MUSIC_VISUALIZER_RETURN_TO
  }

  let parsed
  try {
    parsed = new URL(candidate, INTERNAL_URL_BASE)
  } catch {
    return DEFAULT_MUSIC_VISUALIZER_RETURN_TO
  }

  if (parsed.origin !== INTERNAL_URL_BASE) return DEFAULT_MUSIC_VISUALIZER_RETURN_TO

  const pathnameWithoutTrailingSlash = parsed.pathname.replace(/\/+$/, "") || "/"
  const searchParams = new URLSearchParams(parsed.search)
  if (
    pathnameWithoutTrailingSlash === "/clock"
    && searchParams.getAll("source").includes("music")
  ) {
    return DEFAULT_MUSIC_VISUALIZER_RETURN_TO
  }

  return `${parsed.pathname}${parsed.search}`
}

/**
 * Builds the Clock handoff URL from a safe return target.
 * The background panel is included only for callers that still need a selection.
 */
export function buildMusicVisualizerHref({
  returnTo,
  openBackgroundPanel = false,
}) {
  const searchParams = new URLSearchParams()
  searchParams.set("source", "music")
  searchParams.set("returnTo", sanitizeMusicVisualizerReturnTo(returnTo))

  if (openBackgroundPanel === true) {
    searchParams.set("panel", "background")
  }

  return `/clock?${searchParams.toString()}`
}
