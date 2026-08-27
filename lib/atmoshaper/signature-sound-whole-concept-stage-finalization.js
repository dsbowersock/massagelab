// @ts-check

import { createHash } from "node:crypto"

const SHA256 = /^[a-f0-9]{64}$/
const CATALOG_FIELDS = new Set(["version", "reviewKind", "entries"])
const ENTRY_FIELDS = new Set(["batchId", "baseReviewFingerprint", "summary"])

/**
 * Closes a processed intermediate as the current finished concept only after
 * its exact processed audition has been bound. This preserves the immutable
 * producer identity while preventing a rejected later experiment from staying
 * visible as required future work.
 * @param {unknown} rawCatalog
 * @param {unknown} rawFinalizations
 */
export function applySignatureSoundWholeConceptStageFinalizations(rawCatalog, rawFinalizations) {
  const catalog = requireRecord(rawCatalog, "Stage-finalization base catalog")
  if (!Array.isArray(catalog.entries)) throw new Error("Stage-finalization base entries must be an array")
  const finalizations = requireRecord(rawFinalizations, "Stage-finalization catalog")
  assertOnlyFields(finalizations, CATALOG_FIELDS, "Stage-finalization catalog")
  if (finalizations.version !== 1 || finalizations.reviewKind !== "whole-concept-stage-finalizations" ||
      !Array.isArray(finalizations.entries)) {
    throw new Error("Stage-finalization catalog identity is invalid")
  }
  const byBatch = new Map()
  finalizations.entries.forEach((rawEntry, index) => {
    const label = `Stage finalization ${index}`
    const entry = requireRecord(rawEntry, label)
    assertOnlyFields(entry, ENTRY_FIELDS, label)
    const batchId = requireString(entry.batchId, `${label} batch id`)
    if (byBatch.has(batchId)) throw new Error(`Stage finalization duplicates ${batchId}`)
    byBatch.set(batchId, {
      batchId,
      baseReviewFingerprint: requireSha256(entry.baseReviewFingerprint, `${label} base fingerprint`),
      summary: requireString(entry.summary, `${label} summary`),
    })
  })
  const knownBatches = new Set(catalog.entries.map((entry, index) => (
    requireString(requireRecord(entry, `Stage-finalization base entry ${index}`).batchId, `Stage-finalization base entry ${index} batch id`)
  )))
  for (const batchId of byBatch.keys()) {
    if (!knownBatches.has(batchId)) throw new Error(`Stage finalization references unknown batch ${batchId}`)
  }
  return {
    ...structuredClone(catalog),
    entries: catalog.entries.map((rawEntry, index) => {
      const entry = requireRecord(rawEntry, `Stage-finalization base entry ${index}`)
      const finalization = byBatch.get(entry.batchId)
      if (!finalization) return structuredClone(entry)
      const completeProcessedAudition = Array.isArray(entry.sources) && entry.sources.length > 0 && entry.sources.every((source) => (
        typeof source?.audioUrl === "string" && source.audioUrl.startsWith("/api/dev/atmoshaper-candidates/speech-reduction/")
      ))
      if (!completeProcessedAudition) {
        // Keep the raw processing-gated entry available when its immutable
        // external bundle is not configured; its saved Pass remains inactive.
        return structuredClone(entry)
      }
      if (entry.reviewFingerprint !== finalization.baseReviewFingerprint) {
        throw new Error(`Stage finalization fingerprint is stale for ${entry.batchId}`)
      }
      const amendment = requireRecord(entry.amendment, `Stage finalization ${entry.batchId} amendment`)
      const finalized = /** @type {Record<string, any>} */ ({
        ...structuredClone(entry),
        reviewState: "ready-to-audition",
        processingRequirements: [],
        amendment: {
          ...structuredClone(amendment),
          state: "ready-to-audition",
          summary: finalization.summary,
        },
      })
      finalized.reviewFingerprint = sha256(stableJson({
        reviewKind: "whole-concept-stage-finalization-entry",
        baseReviewFingerprint: finalization.baseReviewFingerprint,
        batchId: finalized.batchId,
        groupId: finalized.groupId,
        sources: finalized.sources,
        playbackConfiguration: finalized.playbackConfiguration,
        runtimePolicy: finalized.runtimePolicy,
        reviewState: finalized.reviewState,
        processingRequirements: finalized.processingRequirements,
        summary: finalization.summary,
      }))
      return finalized
    }),
  }
}

/** @param {unknown} value @param {string} label */
function requireRecord(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`)
  return /** @type {Record<string, any>} */ (value)
}

/** @param {unknown} value @param {string} label */
function requireString(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string`)
  return value
}

/** @param {unknown} value @param {string} label */
function requireSha256(value, label) {
  if (typeof value !== "string" || !SHA256.test(value)) throw new Error(`${label} is invalid`)
  return value
}

/** @param {Record<string, any>} record @param {Set<string>} allowed @param {string} label */
function assertOnlyFields(record, allowed, label) {
  const unknown = Object.keys(record).find((field) => !allowed.has(field))
  if (unknown) throw new Error(`${label} contains unknown field ${unknown}`)
}

/** @param {any} value @returns {string} */
function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`
  }
  return JSON.stringify(value)
}

/** @param {string} value */
function sha256(value) {
  return createHash("sha256").update(value).digest("hex")
}
