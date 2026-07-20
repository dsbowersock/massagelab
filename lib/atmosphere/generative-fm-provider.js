// @ts-check

const DEFAULT_MAX_PROVIDER_REQUEST_BATCH_SIZE = 12

/** @type {WeakMap<object, Map<string, unknown>>} */
const audioContextBufferCaches = new WeakMap()
/** @type {Map<string, unknown>} */
const fallbackBufferCache = new Map()

/**
 * Lets one opportunistic prewarm consumer stop waiting without cancelling the
 * shared preparation promise that playback or another consumer can still use.
 *
 * @template T
 * @param {Promise<T>} preparation
 * @param {AbortSignal} [signal]
 * @returns {Promise<T>}
 */
export function waitForAbortableGenerativeFmPrewarm(preparation, signal) {
  if (!signal) {
    return preparation
  }

  signal.throwIfAborted()
  return new Promise((resolve, reject) => {
    let settled = false
    const handleAbort = () => {
      try {
        signal.throwIfAborted()
      } catch (error) {
        if (settled) return
        settled = true
        signal.removeEventListener("abort", handleAbort)
        reject(error)
      }
    }

    signal.addEventListener("abort", handleAbort, { once: true })
    preparation.then(
      (value) => {
        if (settled) return
        settled = true
        signal.removeEventListener("abort", handleAbort)
        resolve(value)
      },
      (error) => {
        if (settled) return
        settled = true
        signal.removeEventListener("abort", handleAbort)
        reject(error)
      },
    )
  })
}

/**
 * Creates the mutable request-stat object that playback telemetry can read
 * after a Generative.fm package has finished its startup sample requests.
 */
export function createGenerativeFmProviderRequestStats() {
  return {
    requestCount: 0,
    requestedUrlCount: 0,
    uniqueUrlCount: 0,
    memoryHitUrlCount: 0,
    batchCount: 0,
    failedRequestCount: 0,
    maxBatchSize: 0,
  }
}

/**
 * Wraps the Generative.fm web provider so large station sample requests do not
 * fetch and decode every URL in one unbounded burst. Returned audio buffers are
 * cached for the current audio context, so stations that share sample URLs can
 * reuse already decoded buffers during the same page session.
 *
 * @param {{
 *   provider: {
 *     has?: (urls: string[]) => Promise<boolean>,
 *     request: (audioContext: any, urls: string[]) => Promise<unknown[]>,
 *     save?: (entries: Array<[string, any]>) => Promise<unknown>,
 *   },
 *   maxBatchSize?: number,
 *   onSampleProgress?: (progress: {
 *     loadedUniqueUrlCount: number,
 *     totalUniqueUrlCount: number,
 *     memoryHitUrlCount: number,
 *   }) => void,
 *   stats?: ReturnType<typeof createGenerativeFmProviderRequestStats>,
 * }} params
 */
export function createBoundedGenerativeFmWebProvider({
  maxBatchSize = DEFAULT_MAX_PROVIDER_REQUEST_BATCH_SIZE,
  onSampleProgress,
  provider,
  stats,
}) {
  if (!provider || typeof provider.request !== "function") {
    throw new Error("A Generative.fm web provider with a request method is required.")
  }

  const requestBatchSize = normalizeBatchSize(maxBatchSize)

  return {
    /** @param {string[]} urls */
    has(urls = []) {
      return typeof provider.has === "function" ? provider.has(urls) : Promise.resolve(true)
    },
    /**
     * @param {any} audioContext
     * @param {string[]} urls
     * @returns {Promise<unknown[]>}
     */
    request: async (audioContext, urls = []) => {
      const requestedUrls = Array.isArray(urls) ? urls : /** @type {string[]} */ ([])
      if (requestedUrls.length === 0) {
        return []
      }

      const bufferCache = getAudioContextBufferCache(audioContext)
      const uniqueUrls = [...new Set(requestedUrls)]
      const buffersByUrl = new Map()
      const uncachedUrls = []
      let memoryHitUrlCount = 0

      for (const url of uniqueUrls) {
        if (bufferCache.has(url)) {
          memoryHitUrlCount += 1
          buffersByUrl.set(url, bufferCache.get(url))
        } else {
          uncachedUrls.push(url)
        }
      }

      updateStats(stats, {
        batchCount: Math.ceil(uncachedUrls.length / requestBatchSize),
        maxBatchSize: Math.min(requestBatchSize, uncachedUrls.length),
        memoryHitUrlCount,
        requestedUrlCount: requestedUrls.length,
        uniqueUrlCount: uniqueUrls.length,
      })
      reportSampleProgress(onSampleProgress, memoryHitUrlCount, uniqueUrls.length, memoryHitUrlCount)

      let loadedUniqueUrlCount = memoryHitUrlCount
      for (const chunk of chunkArray(uncachedUrls, requestBatchSize)) {
        try {
          const audioBuffers = await provider.request(audioContext, chunk)
          assertProviderAudioBuffers(audioBuffers, chunk)
          chunk.forEach((url, index) => {
            const audioBuffer = audioBuffers[index]
            bufferCache.set(url, audioBuffer)
            buffersByUrl.set(url, audioBuffer)
          })
          loadedUniqueUrlCount += chunk.length
          reportSampleProgress(onSampleProgress, loadedUniqueUrlCount, uniqueUrls.length, memoryHitUrlCount)
        } catch (error) {
          if (stats) {
            stats.failedRequestCount += 1
          }
          throw error
        }
      }

      return requestedUrls.map((url) => buffersByUrl.get(url))
    },
    /** @param {Array<[string, any]>} entries */
    save(entries = []) {
      return typeof provider.save === "function"
        ? Promise.resolve(provider.save(entries)).then(() => undefined)
        : Promise.resolve()
    },
  }
}

/**
 * @param {unknown} audioContext
 * @returns {Map<string, unknown>}
 */
function getAudioContextBufferCache(audioContext) {
  if (!audioContext || (typeof audioContext !== "object" && typeof audioContext !== "function")) {
    return fallbackBufferCache
  }

  const cacheKey = /** @type {object} */ (audioContext)
  const existingCache = audioContextBufferCaches.get(cacheKey)
  if (existingCache) {
    return existingCache
  }

  const cache = new Map()
  audioContextBufferCaches.set(cacheKey, cache)
  return cache
}

/**
 * Fails fast when the wrapped provider violates the Generative.fm request
 * contract. The browser provider returns AudioBuffer-like objects, but the
 * wrapper only needs to ensure non-empty object/function values so it remains
 * safe across browser realms and Tone wrapper classes.
 *
 * @param {unknown} audioBuffers
 * @param {string[]} requestedUrls
 * @returns {asserts audioBuffers is unknown[]}
 */
function assertProviderAudioBuffers(audioBuffers, requestedUrls) {
  if (!Array.isArray(audioBuffers)) {
    throw new Error(`Provider returned non-array buffers for ${requestedUrls.length} sample URLs.`)
  }

  if (audioBuffers.length !== requestedUrls.length) {
    throw new Error(`Provider returned ${audioBuffers.length} buffers but expected ${requestedUrls.length}.`)
  }

  audioBuffers.forEach((audioBuffer, index) => {
    if (!isProviderAudioBuffer(audioBuffer)) {
      throw new Error(`Provider returned an invalid buffer at index ${index} for ${requestedUrls[index]}.`)
    }
  })
}

/**
 * @param {unknown} value
 * @returns {boolean}
 */
function isProviderAudioBuffer(value) {
  return value !== null && (typeof value === "object" || typeof value === "function")
}

/**
 * @param {string[]} values
 * @param {number} chunkSize
 * @returns {string[][]}
 */
function chunkArray(values, chunkSize) {
  const chunks = []
  for (let index = 0; index < values.length; index += chunkSize) {
    chunks.push(values.slice(index, index + chunkSize))
  }
  return chunks
}

/**
 * @param {number} value
 */
function normalizeBatchSize(value) {
  const size = Math.floor(Number.isFinite(value) ? value : DEFAULT_MAX_PROVIDER_REQUEST_BATCH_SIZE)
  return Math.max(1, size)
}

/**
 * @param {ReturnType<typeof createGenerativeFmProviderRequestStats> | undefined} stats
 * @param {{
 *   batchCount: number,
 *   maxBatchSize: number,
 *   memoryHitUrlCount: number,
 *   requestedUrlCount: number,
 *   uniqueUrlCount: number,
 * }} update
 */
function updateStats(stats, update) {
  if (!stats) {
    return
  }

  stats.requestCount += 1
  stats.requestedUrlCount += update.requestedUrlCount
  stats.uniqueUrlCount += update.uniqueUrlCount
  stats.memoryHitUrlCount += update.memoryHitUrlCount
  stats.batchCount += update.batchCount
  stats.maxBatchSize = Math.max(stats.maxBatchSize, update.maxBatchSize)
}

/**
 * @param {Parameters<typeof createBoundedGenerativeFmWebProvider>[0]["onSampleProgress"]} onSampleProgress
 * @param {number} loadedUniqueUrlCount
 * @param {number} totalUniqueUrlCount
 * @param {number} memoryHitUrlCount
 */
function reportSampleProgress(onSampleProgress, loadedUniqueUrlCount, totalUniqueUrlCount, memoryHitUrlCount) {
  try {
    onSampleProgress?.({
      loadedUniqueUrlCount,
      totalUniqueUrlCount,
      memoryHitUrlCount,
    })
  } catch {
    // Sample progress is best-effort UI feedback and must not block playback.
  }
}
