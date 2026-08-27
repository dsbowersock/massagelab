// @ts-check

import { createHash } from "node:crypto"

/**
 * Fingerprints the full construction projection with its self-referential
 * digest reset exactly as the canonical construction creator does.
 * @param {unknown} rawReview
 * @returns {string}
 */
export function createSignatureSoundConstructionReviewFingerprint(rawReview) {
  const review = requireRecord(rawReview, "Signature construction review fingerprint input")
  const fingerprints = requireRecord(
    review.fingerprints,
    "Signature construction review fingerprint input fingerprints",
  )
  return sha256(stableConstructionJson({
    ...review,
    fingerprints: { ...fingerprints, constructionReviewSha256: "" },
  }))
}

/**
 * Fingerprints exactly the discovery-owned review projection while excluding
 * its self-referential review digest.
 * @param {unknown} rawReview
 * @returns {string}
 */
export function createSignatureSoundDiscoveryReviewFingerprint(rawReview) {
  const review = requireRecord(rawReview, "Signature sound discovery fingerprint input")
  const fingerprints = requireRecord(
    review.fingerprints,
    "Signature sound discovery fingerprint input fingerprints",
  )
  return sha256(stableDiscoveryJson({
    version: review.version,
    fingerprints: { ...fingerprints, reviewSha256: undefined },
    summary: review.summary,
    sources: review.sources,
  }))
}

/** @param {any} value @returns {string} */
function stableConstructionJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableConstructionJson).join(",")}]`
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort(compareText).map((key) => `${JSON.stringify(key)}:${stableConstructionJson(value[key])}`).join(",")}}`
  }
  return JSON.stringify(value)
}

/** @param {any} value @returns {string} */
function stableDiscoveryJson(value) {
  return JSON.stringify(sortDiscoveryValue(value))
}

/** @param {any} value @returns {any} */
function sortDiscoveryValue(value) {
  if (Array.isArray(value)) return value.map(sortDiscoveryValue)
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value)
      .filter(([, child]) => child !== undefined)
      .sort(([left], [right]) => left.localeCompare(right, "en"))
      .map(([key, child]) => [key, sortDiscoveryValue(child)]))
  }
  return value
}

/** @param {string} left @param {string} right @returns {number} */
function compareText(left, right) {
  return left.toLowerCase().localeCompare(right.toLowerCase(), "en")
    || left.localeCompare(right, "en")
}

/** @param {string} value @returns {string} */
function sha256(value) {
  return createHash("sha256").update(value).digest("hex")
}

/** @param {unknown} value @param {string} label @returns {Record<string, any>} */
function requireRecord(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`)
  }
  return /** @type {Record<string, any>} */ (value)
}
