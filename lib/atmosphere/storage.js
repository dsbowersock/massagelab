// @ts-check

import { normalizeMusicVisualizerDevicePreferences } from "../music-visualizer.js"

export const ATMOSPHERE_STORAGE_KEY = "massagelab-atmosphere-v2"
export const LEGACY_ATMOSPHERE_STORAGE_KEY = "massagelab-atmosphere-v1"
export const ATMOSPHERE_STORAGE_VERSION = 2

/**
 * @typedef {object} AtmosphereStorageState
 * @property {number} version
 * @property {string[]} favorites
 * @property {string[]} recentStations
 * @property {number} volume
 * @property {boolean} miniPlayerCollapsed
 * @property {{ backgroundId: string | null, showClock: boolean }} visualizer
 * @property {{ legacyMusicBackground: true }} migrations
 */

/**
 * @typedef {object} AtmosphereStorageReadyResult
 * @property {"ready"} status
 * @property {AtmosphereStorageState} state
 * @property {boolean} shouldPersist
 */

/**
 * @typedef {object} AtmosphereStorageUnsupportedResult
 * @property {"unsupported-version"} status
 * @property {number} rawVersion
 * @property {string} rawValue
 */

/** @returns {AtmosphereStorageState} */
export function createDefaultAtmosphereStorage() {
  return {
    version: ATMOSPHERE_STORAGE_VERSION,
    favorites: [],
    recentStations: [],
    volume: 0.75,
    miniPlayerCollapsed: false,
    visualizer: normalizeMusicVisualizerDevicePreferences(null),
    migrations: {
      legacyMusicBackground: true,
    },
  }
}

/**
 * Parses supported v2 state or migrates v1 audio and the read-only legacy Music
 * background. Future versions remain opaque so older code cannot overwrite them.
 *
 * @param {string | null | undefined} currentRawValue
 * @param {{ legacyRawValue?: string | null, legacyBackgroundId?: string | null }} [migrationInputs]
 * @returns {AtmosphereStorageReadyResult | AtmosphereStorageUnsupportedResult}
 */
export function parseAtmosphereStorage(
  currentRawValue,
  { legacyRawValue = null, legacyBackgroundId = null } = {},
) {
  const currentValue = parseStoredObject(currentRawValue)

  if (
    currentValue
    && typeof currentValue.version === "number"
    && currentValue.version > ATMOSPHERE_STORAGE_VERSION
  ) {
    return {
      status: "unsupported-version",
      rawVersion: currentValue.version,
      rawValue: /** @type {string} */ (currentRawValue),
    }
  }

  if (currentValue?.version === ATMOSPHERE_STORAGE_VERSION) {
    const hasVisualizer = Object.prototype.hasOwnProperty.call(currentValue, "visualizer")
    const consumedLegacyBackground =
      currentValue.migrations?.legacyMusicBackground === true
    const visualizerSource =
      !hasVisualizer && !consumedLegacyBackground
        ? { backgroundId: legacyBackgroundId, showClock: false }
        : currentValue.visualizer

    return {
      status: "ready",
      state: normalizeAtmosphereStorageState(currentValue, visualizerSource),
      shouldPersist: !hasVisualizer || !consumedLegacyBackground,
    }
  }

  const legacyValue =
    currentValue?.version === 1
      ? currentValue
      : parseLegacyAtmosphereStorage(legacyRawValue)
  const state = normalizeAtmosphereStorageState(legacyValue, {
    backgroundId: legacyBackgroundId,
    showClock: false,
  })

  return {
    status: "ready",
    state,
    shouldPersist: true,
  }
}

/**
 * Serializes the supported v2 allowlist and permanently marks the legacy
 * background as consumed. Unsupported parse results must remain opaque.
 *
 * @param {Partial<AtmosphereStorageState> | AtmosphereStorageUnsupportedResult | null | undefined} value
 * @returns {string}
 */
export function serializeAtmosphereStorage(value) {
  if (value?.status === "unsupported-version") {
    throw new Error("Unsupported Atmosphere storage cannot be serialized")
  }

  return JSON.stringify(normalizeAtmosphereStorageState(value, value?.visualizer))
}

/**
 * @param {unknown} value
 * @param {unknown} visualizer
 * @returns {AtmosphereStorageState}
 */
function normalizeAtmosphereStorageState(value, visualizer) {
  const source = value && typeof value === "object" ? value : {}

  return {
    version: ATMOSPHERE_STORAGE_VERSION,
    favorites: normalizeStringList(source.favorites),
    recentStations: normalizeStringList(source.recentStations).slice(0, 12),
    volume: clampVolume(source.volume),
    miniPlayerCollapsed: source.miniPlayerCollapsed === true,
    visualizer: normalizeMusicVisualizerDevicePreferences(visualizer),
    migrations: {
      legacyMusicBackground: true,
    },
  }
}

/**
 * @param {string | null | undefined} rawValue
 * @returns {Record<string, any> | null}
 */
function parseStoredObject(rawValue) {
  if (typeof rawValue !== "string" || rawValue.length === 0) {
    return null
  }

  try {
    const parsed = JSON.parse(rawValue)
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : null
  } catch {
    return null
  }
}

/**
 * @param {string | null | undefined} rawValue
 * @returns {Record<string, any> | null}
 */
function parseLegacyAtmosphereStorage(rawValue) {
  const parsed = parseStoredObject(rawValue)
  return parsed?.version === 1 ? parsed : null
}

/**
 * @param {unknown} value
 * @returns {string[]}
 */
function normalizeStringList(value) {
  if (!Array.isArray(value)) {
    return []
  }

  /** @type {Set<string>} */
  const seen = new Set()
  /** @type {string[]} */
  const result = []

  for (const item of value) {
    if (typeof item !== "string" || item.length === 0 || seen.has(item)) {
      continue
    }
    seen.add(item)
    result.push(item)
  }

  return result
}

/**
 * @param {unknown} value
 * @returns {number}
 */
function clampVolume(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0.75
  }
  return Math.min(1, Math.max(0, value))
}
