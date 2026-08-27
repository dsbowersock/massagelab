// @ts-check

import { createHash } from "node:crypto"

const SHA256 = /^[a-f0-9]{64}$/
const BATCH_ID = /^batch-[0-9]{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/
const EXPECTED_BATCH_IDS = [
  "batch-21-traffic",
  "batch-35-london-ambience",
  "batch-45-stadium-crowd",
]
const ANCHOR_FIELDS = new Set([
  "version", "anchorKind", "manifestRelativePath", "declarationSha256", "manifestSha256",
])

/** @typedef {Record<string, any>} JsonRecord */

/**
 * Validates the small committed pointer to an immutable external speech manifest.
 * The pointer is portable because it contains no machine-specific root.
 * @param {unknown} rawAnchor
 */
export function validateSignatureSoundSpeechReductionReviewAnchor(rawAnchor) {
  const anchor = requireRecord(rawAnchor, "Speech-reduction review anchor")
  assertOnlyFields(anchor, ANCHOR_FIELDS, "Speech-reduction review anchor")
  if (anchor.version !== 1 || anchor.anchorKind !== "signature-speech-reduction-review") {
    throw new Error("Speech-reduction review anchor identity is invalid")
  }
  return {
    version: 1,
    anchorKind: anchor.anchorKind,
    manifestRelativePath: requireSafeRelativePath(
      anchor.manifestRelativePath,
      "Speech-reduction review manifest path",
    ),
    declarationSha256: requireSha256(
      anchor.declarationSha256,
      "Speech-reduction review declaration checksum",
    ),
    manifestSha256: requireSha256(
      anchor.manifestSha256,
      "Speech-reduction review manifest checksum",
    ),
  }
}

/**
 * Binds a complete, already validated speech manifest onto only its owning
 * concept entries. The base review fingerprints are inputs, never mutations,
 * so producer resume identities remain stable after review integration.
 * @param {{reviewEntries:unknown, declaration:unknown, manifest:unknown, anchor:unknown}} input
 */
export function bindSignatureSoundSpeechReductionReview({
  reviewEntries,
  declaration,
  manifest,
  anchor,
}) {
  if (!Array.isArray(reviewEntries)) throw new Error("Speech-reduction review entries must be an array")
  const normalizedAnchor = validateSignatureSoundSpeechReductionReviewAnchor(anchor)
  const normalizedDeclaration = requireRecord(declaration, "Speech-reduction review declaration")
  const declarationSha256 = requireSha256(
    normalizedDeclaration.declarationSha256,
    "Speech-reduction review declaration identity",
  )
  if (normalizedAnchor.declarationSha256 !== declarationSha256) {
    throw new Error("Speech-reduction review declaration fingerprint drifted from its anchor")
  }
  const normalizedManifest = requireRecord(manifest, "Speech-reduction review manifest")
  if (normalizedManifest.declarationSha256 !== declarationSha256 || !Array.isArray(normalizedManifest.outputs)) {
    throw new Error("Speech-reduction review manifest does not match its declaration")
  }

  const entries = reviewEntries.map((entry, index) => normalizeReviewEntry(entry, index))
  const entryByBatch = uniqueIndex(entries, ({ batchId }) => batchId, "speech review batch")
  const conceptByBatch = uniqueIndex(
    requireArray(normalizedDeclaration.concepts, "Speech-reduction review declaration concepts")
      .map((concept, index) => normalizeDeclarationConcept(concept, index)),
    ({ batchId }) => batchId,
    "speech declaration batch",
  )
  const outputs = normalizedManifest.outputs.map((output, index) => normalizeManifestOutput(output, index))
  const outputByIdentity = uniqueIndex(outputs, ({ outputIdentity }) => outputIdentity, "speech output identity")
  const expectedOutputCount = [...conceptByBatch.values()]
    .reduce((sum, { sourceIds }) => sum + sourceIds.length, 0)
  if (outputByIdentity.size !== expectedOutputCount) {
    throw new Error(`Speech-reduction review manifest must contain exactly ${expectedOutputCount} outputs`)
  }

  /** @type {Map<string, Map<string, Record<string, any>>>} */
  const outputByBatchAndSource = new Map()
  for (const batchId of EXPECTED_BATCH_IDS) {
    const entry = entryByBatch.get(batchId)
    const concept = conceptByBatch.get(batchId)
    if (!entry || !concept) throw new Error(`Speech-reduction review is missing ${batchId}`)
    const expectedCount = concept.sourceIds.length
    requireOriginalProcessingRequest(entry, batchId)
    if (entry.reviewFingerprint !== concept.reviewFingerprint) {
      throw new Error(`Speech-reduction review fingerprint drifted for ${batchId}`)
    }
    const entrySourceIds = /** @type {JsonRecord[]} */ (entry.sources).map(({ sourceId }) => sourceId)
    if (entrySourceIds.length !== expectedCount || concept.sourceIds.length !== expectedCount ||
        !sameOrderedValues(entrySourceIds, concept.sourceIds)) {
      throw new Error(`Speech-reduction review ${batchId} does not have its exact ${expectedCount}-source pool`)
    }
    const ownedOutputs = outputs.filter((output) => output.batchId === batchId)
    if (ownedOutputs.length !== expectedCount) {
      throw new Error(`Speech-reduction review ${batchId} does not have exactly ${expectedCount} outputs`)
    }
    const bySource = uniqueIndex(ownedOutputs, ({ sourceId }) => sourceId, `${batchId} speech source`)
    if (!sameUnorderedValues([...bySource.keys()], entrySourceIds)) {
      throw new Error(`Speech-reduction review ${batchId} output pool does not match its source pool`)
    }
    outputByBatchAndSource.set(batchId, bySource)
  }
  for (const output of outputs) {
    if (!EXPECTED_BATCH_IDS.includes(output.batchId)) throw new Error("Speech-reduction review manifest has an unknown batch")
  }

  return reviewEntries.map((rawEntry, index) => {
    const entry = entries[index]
    const bySource = outputByBatchAndSource.get(entry.batchId)
    if (!bySource) return structuredClone(rawEntry)
    const sources = /** @type {JsonRecord[]} */ (entry.sources).map((source) => {
      const output = bySource.get(source.sourceId)
      if (!output) throw new Error(`Speech-reduction review output is missing ${source.sourceId}`)
      return {
        ...source,
        audioUrl: `/api/dev/atmoshaper-candidates/speech-reduction/${encodeURIComponent(entry.batchId)}/${encodeURIComponent(output.outputIdentity)}`,
      }
    })
    if (sources.some(({ audioUrl }) => typeof audioUrl !== "string")) {
      throw new Error(`Speech-reduction review ${entry.batchId} did not bind every processed URL`)
    }
    const reviewFingerprint = createSignatureSoundSpeechReductionReviewFingerprint({
      reviewKind: "whole-concept-speech-reduction-review-entry",
      baseReviewFingerprint: entry.reviewFingerprint,
      declarationSha256,
      manifestSha256: normalizedAnchor.manifestSha256,
      batchId: entry.batchId,
    })
    const remainingRequirements = /** @type {JsonRecord[]} */ (entry.processingRequirements).filter(({ kind }) => (
      kind !== "remove-discernible-speech" && kind !== "duck-voices"
    ))
    const readyToAudition = remainingRequirements.length === 0
    return {
      ...structuredClone(rawEntry),
      sources,
      reviewFingerprint,
      reviewState: readyToAudition ? "ready-to-audition" : "processing-required",
      processingRequirements: remainingRequirements,
      amendment: rawEntry.amendment
        ? {
            ...structuredClone(rawEntry.amendment),
            state: readyToAudition ? "ready-to-audition" : "processing-required",
            summary: readyToAudition
              ? `${rawEntry.amendment.summary} The checksum-bound speech-reduced audition is ready.`
              : `${rawEntry.amendment.summary} Speech reduction is complete, but the remaining whole-concept processing is still required.`,
          }
        : null,
    }
  })
}

/** Creates the exact processed-review identity without requiring audio bytes. */
/** @param {{reviewKind:string,baseReviewFingerprint:string,declarationSha256:string,manifestSha256:string,batchId:string}} input */
export function createSignatureSoundSpeechReductionReviewFingerprint(input) {
  return sha256({
    reviewKind: input.reviewKind,
    baseReviewFingerprint: requireSha256(input.baseReviewFingerprint, "Speech review base fingerprint"),
    declarationSha256: requireSha256(input.declarationSha256, "Speech review declaration fingerprint"),
    manifestSha256: requireSha256(input.manifestSha256, "Speech review manifest fingerprint"),
    batchId: requirePattern(input.batchId, BATCH_ID, "Speech review fingerprint batch"),
  })
}

/** True only for a concept whose original amendment requires processed speech audio. */
/** @param {unknown} rawEntry @param {number} index @returns {JsonRecord} */
function normalizeReviewEntry(rawEntry, index) {
  const entry = requireRecord(rawEntry, `Speech-reduction review entry ${index}`)
  const sources = requireArray(entry.sources, `Speech-reduction review entry ${index} sources`).map((source, sourceIndex) => {
    const normalized = requireRecord(source, `Speech-reduction review source ${sourceIndex}`)
    return { ...normalized, sourceId: requireSha256(normalized.sourceId, `Speech-reduction review source ${sourceIndex} id`) }
  })
  return {
    ...entry,
    batchId: requirePattern(entry.batchId, BATCH_ID, `Speech-reduction review entry ${index} batch id`),
    reviewFingerprint: requireSha256(entry.reviewFingerprint, `Speech-reduction review entry ${index} fingerprint`),
    sources,
  }
}

/** @param {unknown} rawConcept @param {number} index @returns {JsonRecord} */
function normalizeDeclarationConcept(rawConcept, index) {
  const concept = requireRecord(rawConcept, `Speech-reduction declaration concept ${index}`)
  return {
    batchId: requirePattern(concept.batchId, BATCH_ID, `Speech-reduction declaration concept ${index} batch id`),
    reviewFingerprint: requireSha256(concept.reviewFingerprint, `Speech-reduction declaration concept ${index} fingerprint`),
    sourceIds: requireArray(concept.sources, `Speech-reduction declaration concept ${index} sources`)
      .map((source, sourceIndex) => requireSha256(
        requireRecord(source, `Speech-reduction declaration source ${sourceIndex}`).sourceId,
        `Speech-reduction declaration source ${sourceIndex} id`,
      )),
  }
}

/** @param {unknown} rawOutput @param {number} index @returns {JsonRecord} */
function normalizeManifestOutput(rawOutput, index) {
  const output = requireRecord(rawOutput, `Speech-reduction manifest output ${index}`)
  return {
    batchId: requirePattern(output.batchId, BATCH_ID, `Speech-reduction manifest output ${index} batch id`),
    sourceId: requireSha256(output.sourceId, `Speech-reduction manifest output ${index} source id`),
    outputIdentity: requireSha256(output.outputIdentity, `Speech-reduction manifest output ${index} identity`),
    outputRelativePath: requireSafeRelativePath(output.outputRelativePath, `Speech-reduction manifest output ${index} path`),
    outputMeasurement: requireRecord(output.outputMeasurement, `Speech-reduction manifest output ${index} measurement`),
  }
}

/** @param {JsonRecord} entry @param {string} batchId */
function requireOriginalProcessingRequest(entry, batchId) {
  if (entry.reviewState !== "processing-required" || !Array.isArray(entry.processingRequirements) ||
      !entry.processingRequirements.some((/** @type {unknown} */ requirement) => (
    requirement && typeof requirement === "object" &&
    (/** @type {JsonRecord} */ (requirement).kind === "remove-discernible-speech" ||
      /** @type {JsonRecord} */ (requirement).kind === "duck-voices")
  ))) {
    throw new Error(`Speech-reduction review ${batchId} is not the original processing request`)
  }
}

/** @param {string[]} left @param {string[]} right */
function sameOrderedValues(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

/** @param {string[]} left @param {string[]} right */
function sameUnorderedValues(left, right) {
  return left.length === right.length && new Set(left).size === left.length &&
    left.every((value) => right.includes(value))
}

/** @param {unknown} value */
function sha256(value) {
  return createHash("sha256").update(stableJson(value)).digest("hex")
}

/** @param {unknown} value @returns {string} */
function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  if (value && typeof value === "object") {
    const record = /** @type {Record<string, unknown>} */ (value)
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`
  }
  return JSON.stringify(value)
}

/** @template T @param {T[]} values @param {(value:T)=>string} keyOf @param {string} label @returns {Map<string,T>} */
function uniqueIndex(values, keyOf, label) {
  const index = new Map()
  for (const value of values) {
    const key = keyOf(value)
    if (index.has(key)) throw new Error(`Duplicate ${label}: ${key}`)
    index.set(key, value)
  }
  return index
}

/** @param {unknown} value @param {string} label */
function requireSafeRelativePath(value, label) {
  if (typeof value !== "string" || value.trim() !== value || value.length === 0 || value.includes("\\") ||
      value.startsWith("/") || /^[a-z]:/i.test(value) || value.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new Error(`${label} must remain relative`)
  }
  return value
}

/** @param {unknown} value @param {string} label */
function requireSha256(value, label) {
  if (typeof value !== "string" || !SHA256.test(value)) throw new Error(`${label} is invalid`)
  return value
}

/** @param {unknown} value @param {RegExp} pattern @param {string} label */
function requirePattern(value, pattern, label) {
  if (typeof value !== "string" || !pattern.test(value)) throw new Error(`${label} is invalid`)
  return value
}

/** @param {unknown} value @param {string} label @returns {unknown[]} */
function requireArray(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`)
  return value
}

/** @param {unknown} value @param {string} label @returns {JsonRecord} */
function requireRecord(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`)
  return /** @type {Record<string, any>} */ (value)
}

/** @param {JsonRecord} value @param {Set<string>} allowed @param {string} label */
function assertOnlyFields(value, allowed, label) {
  for (const field of Object.keys(value)) if (!allowed.has(field)) throw new Error(`${label} contains unsupported field ${field}`)
}
