// @ts-check

/**
 * @typedef {Record<string, string | string[] | Record<string, string>>} GenerativeFmSampleIndex
 * @typedef {string | string[]} GenerativeFmSampleGroup
 */

/**
 * Fetches and validates a Generative.fm-style sample index before a browser
 * runtime starts downloading sample payloads. Each sample group may list a
 * rendered instrument first and a source fallback second, matching the package
 * manifest convention used by `@generative-music/piece-observable-streams`.
 *
 * @param {{
 *   sampleIndexUrl: string,
 *   sampleGroups: GenerativeFmSampleGroup[],
 *   fetchImpl?: typeof fetch,
 *   cacheMode?: RequestCache,
 * }} params
 * @returns {Promise<GenerativeFmSampleIndex>}
 */
export async function fetchGenerativeFmSampleIndex({
  sampleIndexUrl,
  sampleGroups,
  fetchImpl = globalThis.fetch,
  cacheMode = "default",
}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("A browser fetch implementation is required to load the hosted sample index.")
  }

  const response = await fetchImpl(sampleIndexUrl, {
    cache: cacheMode,
    headers: {
      Accept: "application/json",
    },
  })
  if (!response.ok) {
    throw new Error(`Hosted sample index request failed: HTTP ${response.status} for ${sampleIndexUrl}`)
  }

  return assertGenerativeFmSampleIndex(await response.json(), sampleGroups)
}

/**
 * @param {unknown} value
 * @param {GenerativeFmSampleGroup[]} sampleGroups
 * @returns {GenerativeFmSampleIndex}
 */
export function assertGenerativeFmSampleIndex(value, sampleGroups) {
  if (!isPlainObject(value)) {
    throw new Error("Hosted sample index must be a JSON object.")
  }

  const normalizedGroups = normalizeSampleGroups(sampleGroups)
  const missingGroups = normalizedGroups.filter((group) => !group.some((name) => hasUsableSampleCollection(value[name])))
  if (missingGroups.length > 0) {
    throw new Error(
      `Hosted sample index is missing required instruments: ${missingGroups
        .map((group) => group.join(" or "))
        .join(", ")}`,
    )
  }

  return /** @type {GenerativeFmSampleIndex} */ (value)
}

/**
 * @param {GenerativeFmSampleGroup[]} sampleGroups
 * @returns {string[][]}
 */
export function normalizeSampleGroups(sampleGroups) {
  return sampleGroups.map((group) => {
    const names = Array.isArray(group) ? group : [group]
    return names.map((name) => name.trim()).filter(Boolean)
  }).filter((group) => group.length > 0)
}

/**
 * Checks whether a sample collection can be used by the Generative.fm web
 * library: either a non-empty array of URL strings or a plain note-to-URL
 * object whose values are non-empty strings.
 *
 * @param {unknown} value
 * @returns {boolean}
 */
function hasUsableSampleCollection(value) {
  if (Array.isArray(value)) {
    return value.length > 0 && value.every(isNonEmptyString)
  }

  if (isPlainObject(value)) {
    const urls = Object.values(value)
    return urls.length > 0 && urls.every(isNonEmptyString)
  }

  return false
}

/**
 * Checks whether a value is a JSON-style object, excluding null and arrays.
 *
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/**
 * Checks whether a value is a string with non-whitespace content.
 *
 * @param {unknown} value
 * @returns {value is string}
 */
function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0
}
