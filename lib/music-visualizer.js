export const MUSIC_VISUALIZER_APP_SETTINGS_KEY = "musicVisualizer"

export const DEFAULT_MUSIC_VISUALIZER_DEVICE_PREFERENCES = Object.freeze({
  backgroundId: null,
  showClock: false,
})

export const DEFAULT_MUSIC_VISUALIZER_ACCOUNT_PREFERENCES = Object.freeze({
  defaultBackgroundId: null,
  showClock: false,
})

/**
 * @typedef {{ defaultBackgroundId: string | null, showClock: boolean }} MusicVisualizerAccountPreferences
 * @typedef {{ defaultBackgroundId?: string | null, showClock?: boolean }} MusicVisualizerAccountPreferenceChanges
 */

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

function sameMusicVisualizerAccountPreferences(left, right) {
  return (
    left.defaultBackgroundId === right.defaultBackgroundId
    && left.showClock === right.showClock
  )
}

function projectMusicVisualizerAccountChanges(value) {
  const source = value && typeof value === "object" ? value : {}
  const changes = {}
  if (Object.prototype.hasOwnProperty.call(source, "defaultBackgroundId")) {
    changes.defaultBackgroundId = normalizeMusicVisualizerAccountPreferences(source).defaultBackgroundId
  }
  if (Object.prototype.hasOwnProperty.call(source, "showClock")) {
    changes.showClock = source.showClock === true
  }
  return changes
}

/**
 * Owns the latest account-scoped visualizer intent independently from its PUT.
 * A bootstrap projection can acknowledge that intent only by matching the
 * reconciled payload; older same-owner projections are returned for repersist.
 */
export function createMusicVisualizerAccountIntentTracker() {
  let nextRevision = 0
  let intent = null

  return {
    /**
     * @param {{
     *   ownerKey: string,
     *   changes: MusicVisualizerAccountPreferenceChanges,
     *   basePreferences?: unknown,
     * }} input
     */
    record({ ownerKey, changes, basePreferences }) {
      if (typeof ownerKey !== "string" || ownerKey.length === 0) return null
      const previousIntent = intent?.ownerKey === ownerKey ? intent : null
      const nextChanges = {
        ...(previousIntent?.changes ?? {}),
        ...projectMusicVisualizerAccountChanges(changes),
      }
      const base = basePreferences === undefined
        ? previousIntent?.preferences ?? null
        : normalizeMusicVisualizerAccountPreferences(basePreferences)
      const preferences = base
        ? normalizeMusicVisualizerAccountPreferences({ ...base, ...nextChanges })
        : null
      intent = {
        ownerKey,
        revision: nextRevision + 1,
        changes: nextChanges,
        preferences,
      }
      nextRevision = intent.revision
      return {
        ownerKey,
        revision: intent.revision,
        preferences,
      }
    },
    /** @param {string} ownerKey */
    hasIntent(ownerKey) {
      return intent?.ownerKey === ownerKey
    },
    /**
     * @param {{ ownerKey: string, preferences: unknown }} input
     */
    confirm({ ownerKey, preferences }) {
      const confirmed = normalizeMusicVisualizerAccountPreferences(preferences)
      if (intent?.ownerKey !== ownerKey) return confirmed
      const confirmedChanges = {}
      if (Object.prototype.hasOwnProperty.call(intent.changes, "defaultBackgroundId")) {
        confirmedChanges.defaultBackgroundId = confirmed.defaultBackgroundId
      }
      if (Object.prototype.hasOwnProperty.call(intent.changes, "showClock")) {
        confirmedChanges.showClock = confirmed.showClock
      }
      intent = {
        ...intent,
        changes: confirmedChanges,
        preferences: confirmed,
      }
      return confirmed
    },
    /**
     * @param {{ ownerKey: string, projection: unknown }} input
     */
    reconcile({ ownerKey, projection }) {
      const serverPreferences = normalizeMusicVisualizerAccountPreferences(projection)
      if (intent?.ownerKey !== ownerKey) {
        return { status: "adopt", revision: null, preferences: serverPreferences }
      }

      const revision = intent.revision
      const preferences = normalizeMusicVisualizerAccountPreferences({
        ...serverPreferences,
        ...intent.changes,
      })
      if (sameMusicVisualizerAccountPreferences(serverPreferences, preferences)) {
        intent = null
        return { status: "adopt", revision, preferences }
      }

      intent = { ...intent, preferences }
      return { status: "repersist", revision, preferences }
    },
    clear() {
      intent = null
    },
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
