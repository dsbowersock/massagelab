// @ts-check

export const ATMOSPHERE_STORAGE_KEY = "massagelab-atmosphere-v1"
export const ATMOSPHERE_STORAGE_VERSION = 1

/**
 * @typedef {object} AtmosphereStorageState
 * @property {number} version
 * @property {string[]} favorites
 * @property {string[]} recentStations
 * @property {number} volume
 * @property {boolean} miniPlayerCollapsed
 */

/** @returns {AtmosphereStorageState} */
export function createDefaultAtmosphereStorage() {
  return {
    version: ATMOSPHERE_STORAGE_VERSION,
    favorites: [],
    recentStations: [],
    volume: 0.75,
    miniPlayerCollapsed: false,
  }
}

/**
 * @param {string | null | undefined} rawValue
 * @returns {AtmosphereStorageState}
 */
export function parseAtmosphereStorage(rawValue) {
  if (typeof rawValue !== "string" || rawValue.length === 0) {
    return createDefaultAtmosphereStorage()
  }

  try {
    const parsed = JSON.parse(rawValue)
    if (!parsed || parsed.version !== ATMOSPHERE_STORAGE_VERSION) {
      return createDefaultAtmosphereStorage()
    }

    return {
      version: ATMOSPHERE_STORAGE_VERSION,
      favorites: normalizeStringList(parsed.favorites),
      recentStations: normalizeStringList(parsed.recentStations).slice(0, 12),
      volume: clampVolume(parsed.volume),
      miniPlayerCollapsed: parsed.miniPlayerCollapsed === true,
    }
  } catch {
    return createDefaultAtmosphereStorage()
  }
}

/**
 * @param {Partial<AtmosphereStorageState> | null | undefined} value
 * @returns {string}
 */
export function serializeAtmosphereStorage(value) {
  return JSON.stringify({
    version: ATMOSPHERE_STORAGE_VERSION,
    favorites: normalizeStringList(value?.favorites),
    recentStations: normalizeStringList(value?.recentStations).slice(0, 12),
    volume: clampVolume(value?.volume),
    miniPlayerCollapsed: value?.miniPlayerCollapsed === true,
  })
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
