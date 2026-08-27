// @ts-check

const SHA256 = /^[a-f0-9]{64}$/
const DECISIONS = new Set(["pass", "change", "reject"])
const OUTCOME_FIELDS = new Set([
  "version", "reviewKind", "batchId", "reviewFingerprint", "decision", "note", "reviewedAt",
])
const CATALOG_FIELDS = new Set(["version", "reviewKind", "entries"])

/**
 * @typedef {object} WholeConceptOutcome
 * @property {1} version
 * @property {"whole-concept-chat-outcome"} reviewKind
 * @property {string} batchId
 * @property {string} reviewFingerprint
 * @property {string} decision
 * @property {string} note
 * @property {string} reviewedAt
 */

/**
 * Validates one chat-recorded decision against the exact projected review
 * entry. The schema intentionally has no playback timestamp fields because a
 * chat response is reviewer authority, not fabricated browser telemetry.
 * @param {unknown} rawOutcome
 * @param {unknown} rawContext
 * @returns {WholeConceptOutcome}
 */
export function validateSignatureSoundWholeConceptOutcome(rawOutcome, rawContext) {
  const context = requireRecord(rawContext, "Whole-concept outcome context")
  const reviewEntry = requireRecord(context.reviewEntry, "Whole-concept outcome review entry")
  const expectedBatchId = requireTrimmedString(
    reviewEntry.batchId,
    "Whole-concept outcome review batch id",
  )
  const expectedFingerprint = requireSha256(
    reviewEntry.reviewFingerprint,
    "Whole-concept outcome review fingerprint",
  )

  const outcome = validateOutcomeShape(rawOutcome)
  if (outcome.batchId !== expectedBatchId || outcome.reviewFingerprint !== expectedFingerprint) {
    throw new Error("Whole-concept outcome batch or review fingerprint is stale")
  }

  return {
    ...outcome,
    batchId: expectedBatchId,
    reviewFingerprint: expectedFingerprint,
  }
}

/**
 * Validates the restart-safe set of direct chat outcomes against the current
 * per-concept review identities. Browser heard telemetry is intentionally not
 * part of this record because the reviewer supplied these decisions in chat.
 * @param {unknown} rawCatalog
 * @param {unknown} rawContext
 */
export function validateSignatureSoundWholeConceptOutcomeCatalog(rawCatalog, rawContext) {
  const context = requireRecord(rawContext, "Whole-concept outcome catalog context")
  if (!Array.isArray(context.reviewEntries)) {
    throw new Error("Whole-concept outcome catalog review entries must be an array")
  }
  const reviewByBatch = new Map(context.reviewEntries.map((rawEntry, index) => {
    const entry = requireRecord(rawEntry, `Whole-concept outcome review entry ${index}`)
    return [requireTrimmedString(entry.batchId, `Whole-concept outcome review entry ${index} batch id`), entry]
  }))
  if (reviewByBatch.size !== context.reviewEntries.length) {
    throw new Error("Whole-concept outcome review entries contain a duplicate batch")
  }
  const inactiveReviewBatchIds = validateInactiveReviewBatchIds(
    context.inactiveReviewBatchIds,
    reviewByBatch,
  )

  const catalog = requireRecord(rawCatalog, "Whole-concept outcome catalog")
  assertOnlyFields(catalog, CATALOG_FIELDS, "Whole-concept outcome catalog")
  if (catalog.version !== 1 || catalog.reviewKind !== "whole-concept-chat-outcome-catalog") {
    throw new Error("Whole-concept outcome catalog identity is invalid")
  }
  if (!Array.isArray(catalog.entries)) {
    throw new Error("Whole-concept outcome catalog entries must be an array")
  }
  const seen = new Set()
  const entries = catalog.entries.flatMap((rawOutcome) => {
    const outcomeRecord = requireRecord(rawOutcome, "Whole-concept outcome catalog entry")
    const batchId = requireTrimmedString(outcomeRecord.batchId, "Whole-concept outcome catalog batch id")
    if (seen.has(batchId)) throw new Error(`Whole-concept outcome catalog contains duplicate batch ${batchId}`)
    seen.add(batchId)
    const reviewEntry = reviewByBatch.get(batchId)
    if (!reviewEntry) throw new Error(`Whole-concept outcome catalog batch is unknown: ${batchId}`)
    if (inactiveReviewBatchIds.has(batchId)) {
      validateOutcomeShape(outcomeRecord)
      return []
    }
    return [validateSignatureSoundWholeConceptOutcome(outcomeRecord, { reviewEntry })]
  })
  return {
    version: 1,
    reviewKind: "whole-concept-chat-outcome-catalog",
    entries,
  }
}

/**
 * Validates a persisted chat outcome without attaching it to a currently
 * unavailable audition. This keeps malformed decisions fail-closed while an
 * optional processed-audio bundle is offline.
 * @param {unknown} rawOutcome
 * @returns {WholeConceptOutcome}
 */
function validateOutcomeShape(rawOutcome) {
  const outcome = requireRecord(rawOutcome, "Whole-concept outcome")
  assertOnlyFields(outcome, OUTCOME_FIELDS, "Whole-concept outcome")
  if (outcome.version !== 1 || outcome.reviewKind !== "whole-concept-chat-outcome") {
    throw new Error("Whole-concept outcome identity is invalid")
  }
  const decision = requireTrimmedString(outcome.decision, "Whole-concept outcome decision")
  if (!DECISIONS.has(decision)) throw new Error("Whole-concept outcome decision is invalid")
  return {
    version: 1,
    reviewKind: "whole-concept-chat-outcome",
    batchId: requireTrimmedString(outcome.batchId, "Whole-concept outcome batch id"),
    reviewFingerprint: requireSha256(outcome.reviewFingerprint, "Whole-concept outcome review fingerprint"),
    decision,
    note: requireTrimmedString(outcome.note, "Whole-concept outcome note"),
    reviewedAt: requireTimestamp(outcome.reviewedAt, "Whole-concept outcome reviewedAt"),
  }
}

/** @param {unknown} value @param {Map<string,Record<string,any>>} reviewByBatch */
function validateInactiveReviewBatchIds(value, reviewByBatch) {
  if (value === undefined) return new Set()
  if (!Array.isArray(value)) throw new Error("Inactive whole-concept outcome batches must be an array")
  const batchIds = value.map((batchId, index) => (
    requireTrimmedString(batchId, `Inactive whole-concept outcome batch ${index}`)
  ))
  if (new Set(batchIds).size !== batchIds.length) {
    throw new Error("Inactive whole-concept outcome batches contain a duplicate")
  }
  for (const batchId of batchIds) {
    if (!reviewByBatch.has(batchId)) {
      throw new Error(`Inactive whole-concept outcome batch is unknown: ${batchId}`)
    }
  }
  return new Set(batchIds)
}

/** @param {unknown} value @param {string} label */
function requireRecord(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`)
  return /** @type {Record<string, any>} */ (value)
}

/** @param {unknown} value @param {string} label */
function requireTrimmedString(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string`)
  return value
}

/** @param {unknown} value @param {string} label */
function requireSha256(value, label) {
  if (typeof value !== "string" || !SHA256.test(value)) throw new Error(`${label} is invalid`)
  return value
}

/** @param {unknown} value @param {string} label */
function requireTimestamp(value, label) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value)) ||
      new Date(value).toISOString() !== value) {
    throw new Error(`${label} must be a canonical ISO timestamp`)
  }
  return value
}

/** @param {Record<string, any>} record @param {Set<string>} allowed @param {string} label */
function assertOnlyFields(record, allowed, label) {
  const unknown = Object.keys(record).find((field) => !allowed.has(field))
  if (unknown) throw new Error(`${label} contains unknown field ${unknown}`)
}
