// @ts-check

/**
 * @template T
 * @param {{
 *   ttlMs: number
 *   load: () => Promise<T>
 *   now?: () => number
 * }} options
 */
export function createAsyncTtlCache({ ttlMs, load, now = Date.now }) {
  let cachedAt = 0
  /** @type {T | undefined} */
  let cachedValue
  /** @type {Promise<T> | null} */
  let inFlight = null

  return {
    async get() {
      const currentTime = now()
      if (cachedAt > 0 && currentTime - cachedAt < ttlMs) {
        return /** @type {T} */ (cachedValue)
      }

      if (inFlight) {
        return inFlight
      }

      inFlight = load()
        .then((value) => {
          cachedValue = value
          cachedAt = now()
          return value
        })
        .finally(() => {
          inFlight = null
        })

      return inFlight
    },
    clear() {
      cachedAt = 0
      cachedValue = undefined
      inFlight = null
    },
  }
}

/**
 * @template T
 * @template {string} K
 * @param {{
 *   ttlMs: number
 *   load: (key: K) => Promise<T>
 *   now?: () => number
 *   maxSize?: number
 * }} options
 */
export function createAsyncKeyedTtlCache({ ttlMs, load, now = Date.now, maxSize = 100 }) {
  /** @type {Map<K, { cachedAt: number, cachedValue?: T, inFlight: Promise<T> | null }>} */
  const entries = new Map()

  function trimOldestEntry() {
    if (entries.size <= maxSize) {
      return
    }

    const oldestKey = entries.keys().next().value
    if (oldestKey !== undefined) {
      entries.delete(oldestKey)
    }
  }

  return {
    /**
     * @param {K} key
     */
    async get(key) {
      const currentTime = now()
      let entry = entries.get(key)

      if (entry && entry.cachedAt > 0 && currentTime - entry.cachedAt < ttlMs) {
        return /** @type {T} */ (entry.cachedValue)
      }

      if (entry?.inFlight) {
        return entry.inFlight
      }

      if (!entry) {
        entry = { cachedAt: 0, cachedValue: undefined, inFlight: null }
        entries.set(key, entry)
        trimOldestEntry()
      }

      entry.inFlight = load(key)
        .then((value) => {
          entry.cachedValue = value
          entry.cachedAt = now()
          return value
        })
        .finally(() => {
          if (entry) {
            entry.inFlight = null
          }
        })

      return entry.inFlight
    },
    /**
     * @param {K} [key]
     */
    clear(key) {
      if (key === undefined) {
        entries.clear()
        return
      }

      entries.delete(key)
    },
  }
}
