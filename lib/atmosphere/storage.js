// @ts-check

export const ATMOSPHERE_STORAGE_KEY = "massagelab-atmosphere-v1"
export const ATMOSPHERE_STORAGE_VERSION = 1

export function createDefaultAtmosphereStorage() {
  return {
    version: ATMOSPHERE_STORAGE_VERSION,
    favorites: [],
    recentStations: [],
    volume: 0.75,
    miniPlayerCollapsed: false,
  }
}

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

export function serializeAtmosphereStorage(value) {
  return JSON.stringify({
    version: ATMOSPHERE_STORAGE_VERSION,
    favorites: normalizeStringList(value?.favorites),
    recentStations: normalizeStringList(value?.recentStations).slice(0, 12),
    volume: clampVolume(value?.volume),
    miniPlayerCollapsed: value?.miniPlayerCollapsed === true,
  })
}

function normalizeStringList(value) {
  if (!Array.isArray(value)) {
    return []
  }

  const seen = new Set()
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

function clampVolume(value) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return 0.75
  }
  return Math.min(1, Math.max(0, value))
}
