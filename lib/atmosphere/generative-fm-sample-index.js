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
 * }} params
 * @returns {Promise<GenerativeFmSampleIndex>}
 */
export async function fetchGenerativeFmSampleIndex({
  sampleIndexUrl,
  sampleGroups,
  fetchImpl = globalThis.fetch,
}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("A browser fetch implementation is required to load the hosted sample index.")
  }

  const response = await fetchImpl(sampleIndexUrl, {
    cache: "no-cache",
    headers: {
      Accept: "application/json",
    },
  })
  if (!response.ok) {
    throw new Error(`Hosted sample index request failed: HTTP ${response.status}`)
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
 * @param {unknown} value
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
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isPlainObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

/**
 * @param {unknown} value
 * @returns {value is string}
 */
function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0
}
