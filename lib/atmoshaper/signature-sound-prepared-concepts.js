// @ts-check

import { validateMoodistConcepts } from "./sound-catalog.js"

const TERMINAL_PROCESSED_STATES = new Set([
  "audible-qa-passed",
  "audible-qa-complete-dry-selected",
])
const SHA256_PATTERN = /^[a-f0-9]{64}$/
const BATCH_ID_PATTERN = /^batch-\d{2}-[a-z0-9-]+$/

/** @typedef {"processed-audio" | "reviewed-dynamic-setup"} PreparedHandoffKind */
/** @typedef {{ id: string, label: string, category: string, sourceStrategy: string }} MoodistConceptSummary */
/** @typedef {{ active: boolean, usableSourceCount: number }} ConstructionMoodistState */
/** @typedef {{
 *   groupId: string,
 *   moodistConceptId: string | null,
 *   label: string,
 *   origin: "moodist" | "signature-only",
 *   handoffKind: PreparedHandoffKind,
 *   batchId: string,
 *   sourceCount: number,
 *   reviewFingerprint: string,
 *   reviewHref: string,
 * }} PreparedConcept */

/**
 * Projects the exact reviewed concepts that can move into AtmoShaper and the
 * canonical Moodist concepts that still need a usable recording. Callers own
 * validation of the composed review catalog; this boundary rechecks the
 * completion evidence it consumes and refuses duplicate concept identities.
 *
 * @param {{
 *   moodistConcepts: unknown,
 *   constructionGroups: unknown,
 *   reviewEntries: unknown,
 *   processedEntries: unknown,
 * }} input
 */
export function buildAtmoShaperPreparedConceptCatalog(input) {
  const moodistConcepts = validateMoodistConcepts(input.moodistConcepts)
  const moodistById = new Map(moodistConcepts.map((concept) => [concept.id, concept]))
  const constructionGroups = requireArray(input.constructionGroups, "construction groups")
  const reviewEntries = requireArray(input.reviewEntries, "whole-concept review entries")
  const processedEntries = requireArray(input.processedEntries, "processed concept entries")
  /** @type {Map<string, ConstructionMoodistState>} */
  const constructionMoodistGroups = new Map()

  for (const [index, rawGroup] of constructionGroups.entries()) {
    const group = requireRecord(rawGroup, `construction group at index ${index}`)
    const groupId = requireString(group.groupId, `construction group at index ${index} id`)
    if (!groupId.startsWith("moodist:")) continue
    const moodistConceptId = groupId.slice("moodist:".length)
    if (!moodistById.has(moodistConceptId)) {
      throw new Error(`Construction group references unknown Moodist concept ${moodistConceptId}`)
    }
    if (constructionMoodistGroups.has(moodistConceptId)) {
      throw new Error(`Duplicate Moodist construction group ${moodistConceptId}`)
    }
    const includedSourceIds = requireArray(
      group.includedSourceIds,
      `construction group ${groupId} included sources`,
    )
    constructionMoodistGroups.set(moodistConceptId, {
      active: group.status === "active",
      usableSourceCount: includedSourceIds.length,
    })
  }

  /** @type {PreparedConcept[]} */
  const preparedConcepts = []
  /** @type {Set<string>} */
  const preparedGroupIds = new Set()

  for (const [index, rawEntry] of reviewEntries.entries()) {
    const entry = requireRecord(rawEntry, `whole-concept review entry at index ${index}`)
    const outcome = entry.chatOutcome
    if (outcome === null || outcome === undefined) continue
    const outcomeRecord = requireRecord(outcome, `whole-concept review outcome at index ${index}`)
    if (outcomeRecord.decision !== "pass") continue

    const batchId = requireBatchId(entry.batchId, `whole-concept review entry at index ${index}`)
    const groupId = requireString(entry.groupId, `whole-concept review entry ${batchId} group id`)
    const label = requireString(entry.label, `whole-concept review entry ${batchId} label`)
    const sources = requireArray(entry.sources, `whole-concept review entry ${batchId} sources`)
    if (sources.length === 0) {
      throw new Error(`Passed whole-concept review entry ${batchId} must contain a source`)
    }
    const reviewFingerprint = requireSha256(
      entry.reviewFingerprint,
      `whole-concept review entry ${batchId} fingerprint`,
    )
    addPreparedConcept({
      preparedConcepts,
      preparedGroupIds,
      moodistById,
      batchId,
      groupId,
      label,
      sourceCount: sources.length,
      reviewFingerprint,
      handoffKind: "reviewed-dynamic-setup",
    })
  }

  for (const [index, rawEntry] of processedEntries.entries()) {
    const entry = requireRecord(rawEntry, `processed concept entry at index ${index}`)
    const batchId = requireBatchId(entry.batchId, `processed concept entry at index ${index}`)
    const reviewState = requireString(entry.reviewState, `processed concept entry ${batchId} review state`)
    if (!TERMINAL_PROCESSED_STATES.has(reviewState)) {
      throw new Error(`Processed concept entry ${batchId} must have a terminal review state`)
    }
    const sourceCount = requirePositiveInteger(
      entry.sourceCount,
      `processed concept entry ${batchId} source count`,
    )
    addPreparedConcept({
      preparedConcepts,
      preparedGroupIds,
      moodistById,
      batchId,
      groupId: requireString(entry.groupId, `processed concept entry ${batchId} group id`),
      label: requireString(entry.label, `processed concept entry ${batchId} label`),
      sourceCount,
      reviewFingerprint: requireSha256(
        entry.reviewFingerprint,
        `processed concept entry ${batchId} fingerprint`,
      ),
      handoffKind: "processed-audio",
    })
  }

  preparedConcepts.sort((left, right) => left.label.localeCompare(right.label))
  const recordingNeeds = moodistConcepts
    .filter((concept) => {
      if (concept.sourceStrategy === "native-generated") return false
      const group = constructionMoodistGroups.get(concept.id)
      return group === undefined || !group.active || group.usableSourceCount === 0
    })
    .map((concept) => ({
      id: concept.id,
      label: concept.label,
      category: concept.category,
      reason: constructionMoodistGroups.has(concept.id)
        ? "no-usable-recording"
        : "no-candidate-recording",
    }))
  const nativeGeneratedConcepts = moodistConcepts
    .filter(({ sourceStrategy }) => sourceStrategy === "native-generated")
    .map(({ id, label, category }) => ({ id, label, category }))

  return {
    preparedConcepts,
    recordingNeeds,
    nativeGeneratedConcepts,
    summary: {
      preparedCount: preparedConcepts.length,
      processedAudioCount: preparedConcepts.filter(({ handoffKind }) => handoffKind === "processed-audio").length,
      dynamicSetupCount: preparedConcepts.filter(({ handoffKind }) => handoffKind === "reviewed-dynamic-setup").length,
      recordingNeedCount: recordingNeeds.length,
      nativeGeneratedCount: nativeGeneratedConcepts.length,
    },
  }
}

/**
 * @param {{
 *   preparedConcepts: PreparedConcept[],
 *   preparedGroupIds: Set<string>,
 *   moodistById: Map<string, MoodistConceptSummary>,
 *   batchId: string,
 *   groupId: string,
 *   label: string,
 *   sourceCount: number,
 *   reviewFingerprint: string,
 *   handoffKind: PreparedHandoffKind,
 * }} input
 */
function addPreparedConcept({
  preparedConcepts,
  preparedGroupIds,
  moodistById,
  batchId,
  groupId,
  label,
  sourceCount,
  reviewFingerprint,
  handoffKind,
}) {
  if (preparedGroupIds.has(groupId)) {
    throw new Error(`Duplicate prepared concept group ${groupId}`)
  }
  const moodistConceptId = groupId.startsWith("moodist:")
    ? groupId.slice("moodist:".length)
    : null
  if (moodistConceptId !== null && !moodistById.has(moodistConceptId)) {
    throw new Error(`Prepared concept references unknown Moodist concept ${moodistConceptId}`)
  }
  preparedGroupIds.add(groupId)
  preparedConcepts.push({
    groupId,
    moodistConceptId,
    label,
    origin: moodistConceptId === null ? "signature-only" : "moodist",
    handoffKind,
    batchId,
    sourceCount,
    reviewFingerprint,
    reviewHref: `/dev/candidates/processing?batch=${encodeURIComponent(batchId)}`,
  })
}

/** @param {unknown} value @param {string} label @returns {unknown[]} */
function requireArray(value, label) {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array`)
  return value
}

/** @param {unknown} value @param {string} label @returns {Record<string, unknown>} */
function requireRecord(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`)
  }
  return /** @type {Record<string, unknown>} */ (value)
}

/** @param {unknown} value @param {string} label @returns {string} */
function requireString(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`${label} must be a non-empty string`)
  }
  return value
}

/** @param {unknown} value @param {string} label @returns {string} */
function requireBatchId(value, label) {
  const batchId = requireString(value, `${label} batch id`)
  if (!BATCH_ID_PATTERN.test(batchId)) throw new Error(`${label} batch id is invalid`)
  return batchId
}

/** @param {unknown} value @param {string} label @returns {string} */
function requireSha256(value, label) {
  const sha256 = requireString(value, label)
  if (!SHA256_PATTERN.test(sha256)) throw new Error(`${label} must be a SHA-256 digest`)
  return sha256
}

/** @param {unknown} value @param {string} label @returns {number} */
function requirePositiveInteger(value, label) {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new TypeError(`${label} must be a positive integer`)
  }
  return value
}
