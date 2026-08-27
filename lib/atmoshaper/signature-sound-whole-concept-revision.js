// @ts-check

import { createHash } from "node:crypto"

import {
  validateSignatureSoundConstructionPlaybackPolicy,
  validateSignatureSoundPreviewSettings,
} from "./signature-sound-preview.js"

/** @typedef {Record<string, any>} JsonRecord */
/** @typedef {{ sourceId: string, relativePath: string, gainDb?: number }} ReviewSource */
/**
 * @typedef {object} ReviewEntry
 * @property {string} batchId
 * @property {string} groupId
 * @property {string} label
 * @property {string} reviewFingerprint
 * @property {ReviewSource[]} sources
 * @property {JsonRecord} playbackConfiguration
 * @property {JsonRecord | null} [revision]
 */
/**
 * @typedef {object} ReviewCatalog
 * @property {1} version
 * @property {"whole-concept-review-batches"} reviewKind
 * @property {string} constructionReviewSha256
 * @property {ReviewEntry[]} entries
 */
/**
 * @typedef {object} LevelMeasurement
 * @property {string} sourceId
 * @property {number} durationSeconds
 * @property {number} integratedLoudnessLufs
 * @property {number} truePeakDbtp
 * @property {number} gainDb
 */

const SHA256 = /^[a-f0-9]{64}$/
const CATALOG_FIELDS = new Set([
  "version", "reviewKind", "constructionReviewSha256", "entries",
])
const COMMON_FIELDS = new Set([
  "batchId", "baseReviewFingerprint", "kind", "state", "summary",
])
const LEVEL_FIELDS = new Set([
  ...COMMON_FIELDS, "measurementMethod", "toolVersion", "targetPolicy",
  "targetIntegratedLoudnessLufs", "measurements",
])
const OVERLAP_FIELDS = new Set([
  ...COMMON_FIELDS, "minimumOverlapSeconds", "maximumOverlapSeconds",
  "preserveFullLengthOverlaps",
])
const MEASUREMENT_FIELDS = new Set([
  "sourceId", "durationSeconds", "integratedLoudnessLufs", "truePeakDbtp", "gainDb",
])

/**
 * Applies reviewer-directed audition revisions above immutable construction
 * evidence. Ready revisions receive a new exact fingerprint; a pending timing
 * request keeps the base audition identity until its loop points are known.
 * @param {unknown} rawCatalog
 * @param {unknown} rawRevisions
 * @returns {ReviewCatalog}
 */
export function applySignatureSoundWholeConceptReviewRevisions(rawCatalog, rawRevisions) {
  const catalog = requireRecord(rawCatalog, "Whole-concept review catalog")
  if (catalog.version !== 1 || catalog.reviewKind !== "whole-concept-review-batches" ||
      !Array.isArray(catalog.entries)) {
    throw new Error("Whole-concept revision base catalog is invalid")
  }
  const constructionReviewSha256 = requireSha256(
    catalog.constructionReviewSha256,
    "Whole-concept revision construction fingerprint",
  )
  const catalogEntries = /** @type {unknown[]} */ (catalog.entries)
  const entryByBatch = new Map(catalogEntries.map((rawEntry, index) => {
    const entry = /** @type {ReviewEntry} */ (requireRecord(rawEntry, `Whole-concept revision base entry ${index}`))
    return [requireString(entry.batchId, `Whole-concept revision base entry ${index} batch id`), entry]
  }))
  if (entryByBatch.size !== catalogEntries.length) {
    throw new Error("Whole-concept revision base catalog contains a duplicate batch")
  }

  const revisions = requireRecord(rawRevisions, "Whole-concept review revisions")
  assertOnlyFields(revisions, CATALOG_FIELDS, "Whole-concept review revisions")
  if (revisions.version !== 1 || revisions.reviewKind !== "whole-concept-review-revisions") {
    throw new Error("Whole-concept review revisions identity is invalid")
  }
  if (revisions.constructionReviewSha256 !== constructionReviewSha256) {
    throw new Error("Whole-concept review revisions construction fingerprint is stale")
  }
  if (!Array.isArray(revisions.entries)) {
    throw new Error("Whole-concept review revision entries must be an array")
  }

  const revisionEntries = /** @type {unknown[]} */ (revisions.entries)
  /** @type {Map<string, JsonRecord>} */
  const revisionByBatch = new Map()
  for (const [index, rawRevision] of revisionEntries.entries()) {
    const revision = normalizeRevision(rawRevision, index, entryByBatch)
    if (revisionByBatch.has(revision.batchId)) {
      throw new Error(`Whole-concept review revisions contain duplicate batch ${revision.batchId}`)
    }
    revisionByBatch.set(revision.batchId, revision)
  }

  const entries = catalogEntries.map((rawEntry) => {
    const entry = copy(/** @type {ReviewEntry} */ (rawEntry))
    const revision = revisionByBatch.get(entry.batchId)
    if (!revision) return { ...entry, revision: null }
    return applyRevision(entry, revision, constructionReviewSha256)
  })
  return copy({
    version: 1,
    reviewKind: "whole-concept-review-batches",
    constructionReviewSha256,
    entries,
  })
}

/**
 * @param {unknown} rawRevision
 * @param {number} index
 * @param {Map<string, ReviewEntry>} entryByBatch
 * @returns {JsonRecord}
 */
function normalizeRevision(rawRevision, index, entryByBatch) {
  const label = `Whole-concept review revision ${index}`
  const revision = requireRecord(rawRevision, label)
  const kind = requireString(revision.kind, `${label} kind`)
  const allowed = kind === "source-level-match"
    ? LEVEL_FIELDS
    : kind === "full-length-random-overlap"
      ? OVERLAP_FIELDS
      : COMMON_FIELDS
  assertOnlyFields(revision, allowed, label)
  const batchId = requireString(revision.batchId, `${label} batch id`)
  const baseEntry = entryByBatch.get(batchId)
  if (!baseEntry) throw new Error(`${label} batch is unknown: ${batchId}`)
  const baseReviewFingerprint = requireSha256(
    revision.baseReviewFingerprint,
    `${label} base review fingerprint`,
  )
  if (baseEntry.reviewFingerprint !== baseReviewFingerprint) {
    throw new Error(`${label} base review fingerprint is stale`)
  }
  const common = {
    batchId,
    baseReviewFingerprint,
    kind,
    state: requireString(revision.state, `${label} state`),
    summary: requireString(revision.summary, `${label} summary`),
  }
  if (kind === "opening-then-loop") {
    if (common.state !== "needs-timing") throw new Error(`${label} must need timing`)
    return common
  }
  if (kind === "source-level-match") return normalizeLevelRevision(revision, common, baseEntry, label)
  if (kind === "full-length-random-overlap") return normalizeOverlapRevision(revision, common, label)
  throw new Error(`${label} kind is unsupported`)
}

/**
 * @param {JsonRecord} revision
 * @param {JsonRecord} common
 * @param {ReviewEntry} baseEntry
 * @param {string} label
 * @returns {JsonRecord}
 */
function normalizeLevelRevision(revision, common, baseEntry, label) {
  if (common.state !== "ready-to-audition" || revision.measurementMethod !== "ffmpeg-ebur128-v1" ||
      revision.toolVersion !== "ffmpeg version 9.0-full_build-www.gyan.dev" ||
      revision.targetPolicy !== "quietest-input") {
    throw new Error(`${label} level-match identity is invalid`)
  }
  const target = requireNumber(
    revision.targetIntegratedLoudnessLufs,
    `${label} target integrated loudness`,
  )
  if (!Array.isArray(revision.measurements) || revision.measurements.length !== baseEntry.sources.length) {
    throw new Error(`${label} measurements must cover every exact source`)
  }
  const measurements = /** @type {unknown[]} */ (revision.measurements)
  const measurementBySource = new Map(measurements.map((rawMeasurement, measurementIndex) => {
    const measurementLabel = `${label} measurement ${measurementIndex}`
    const measurement = requireRecord(rawMeasurement, measurementLabel)
    assertOnlyFields(measurement, MEASUREMENT_FIELDS, measurementLabel)
    const sourceId = requireSha256(measurement.sourceId, `${measurementLabel} source id`)
    const integratedLoudnessLufs = requireNumber(
      measurement.integratedLoudnessLufs,
      `${measurementLabel} integrated loudness`,
    )
    const gainDb = requireNumber(measurement.gainDb, `${measurementLabel} gain`)
    if (gainDb > 0 || gainDb !== round(target - integratedLoudnessLufs, 1)) {
      throw new Error(`${measurementLabel} gain does not match attenuation-only target`)
    }
    return /** @type {[string, LevelMeasurement]} */ ([sourceId, {
      sourceId,
      durationSeconds: requirePositive(measurement.durationSeconds, `${measurementLabel} duration`),
      integratedLoudnessLufs,
      truePeakDbtp: requireNumber(measurement.truePeakDbtp, `${measurementLabel} true peak`),
      gainDb,
    }])
  }))
  const sourceIds = baseEntry.sources.map(({ sourceId }) => sourceId)
  if (measurementBySource.size !== sourceIds.length || sourceIds.some((sourceId) => !measurementBySource.has(sourceId))) {
    throw new Error(`${label} measurements do not match the exact source pool`)
  }
  if (target !== Math.min(...measurementBySource.values().map(({ integratedLoudnessLufs }) => integratedLoudnessLufs))) {
    throw new Error(`${label} quietest-input target is invalid`)
  }
  return {
    ...common,
    measurementMethod: revision.measurementMethod,
    toolVersion: revision.toolVersion,
    targetPolicy: revision.targetPolicy,
    targetIntegratedLoudnessLufs: target,
    measurements: sourceIds.map((sourceId) => measurementBySource.get(sourceId)),
  }
}

/**
 * @param {JsonRecord} revision
 * @param {JsonRecord} common
 * @param {string} label
 * @returns {JsonRecord}
 */
function normalizeOverlapRevision(revision, common, label) {
  if (common.state !== "ready-to-audition" || revision.minimumOverlapSeconds !== 2 ||
      revision.maximumOverlapSeconds !== 6 || revision.preserveFullLengthOverlaps !== true) {
    throw new Error(`${label} full-length overlap policy is invalid`)
  }
  return {
    ...common,
    minimumOverlapSeconds: 2,
    maximumOverlapSeconds: 6,
    preserveFullLengthOverlaps: true,
  }
}

/**
 * @param {ReviewEntry} entry
 * @param {JsonRecord} revision
 * @param {string} constructionReviewSha256
 * @returns {ReviewEntry}
 */
function applyRevision(entry, revision, constructionReviewSha256) {
  if (revision.kind === "opening-then-loop") return { ...entry, revision }
  let sources = entry.sources
  let playbackConfiguration = entry.playbackConfiguration
  if (revision.kind === "source-level-match") {
    const levelMeasurements = /** @type {LevelMeasurement[]} */ (revision.measurements)
    const gains = new Map(levelMeasurements.map(({ sourceId, gainDb }) => [sourceId, gainDb]))
    sources = entry.sources.map((source) => ({ ...source, gainDb: gains.get(source.sourceId) }))
  } else {
    const previewSettings = validateSignatureSoundPreviewSettings(entry.playbackConfiguration.strategyId, {
      transitionMode: "overlap",
      transitionSeconds: revision.minimumOverlapSeconds,
    })
    playbackConfiguration = {
      strategyId: entry.playbackConfiguration.strategyId,
      previewSettings,
      constructionPolicy: validateSignatureSoundConstructionPlaybackPolicy(
        entry.playbackConfiguration.strategyId,
        previewSettings,
        {
          minimumSelectionsBeforeRepeat: entry.playbackConfiguration.constructionPolicy.minimumSelectionsBeforeRepeat,
          transitionDurationRange: {
            minimumSeconds: revision.minimumOverlapSeconds,
            maximumSeconds: revision.maximumOverlapSeconds,
          },
          cadenceBoundary: null,
          overlapNextEvent: false,
          preserveFullLengthOverlaps: true,
        },
      ),
    }
  }
  const reviewFingerprint = sha256(stableJson({
    reviewKind: "whole-concept-review-revision-entry",
    constructionReviewSha256,
    baseReviewFingerprint: revision.baseReviewFingerprint,
    batchId: entry.batchId,
    groupId: entry.groupId,
    sources,
    playbackConfiguration,
    revision,
  }))
  return { ...entry, sources, playbackConfiguration, reviewFingerprint, revision }
}

/** @param {unknown} value @param {string} label @returns {JsonRecord} */
function requireRecord(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`)
  return /** @type {JsonRecord} */ (value)
}

/** @param {unknown} value @param {string} label @returns {string} */
function requireString(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string`)
  return value
}

/** @param {unknown} value @param {string} label @returns {string} */
function requireSha256(value, label) {
  if (typeof value !== "string" || !SHA256.test(value)) throw new Error(`${label} is invalid`)
  return value
}

/** @param {unknown} value @param {string} label @returns {number} */
function requireNumber(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label} must be finite`)
  return value
}

/** @param {unknown} value @param {string} label @returns {number} */
function requirePositive(value, label) {
  const number = requireNumber(value, label)
  if (number <= 0) throw new Error(`${label} must be positive`)
  return number
}

/** @param {JsonRecord} record @param {Set<string>} allowed @param {string} label */
function assertOnlyFields(record, allowed, label) {
  const unknown = Object.keys(record).find((field) => !allowed.has(field))
  if (unknown) throw new Error(`${label} contains unknown field ${unknown}`)
}

/** @param {unknown} value @returns {string} */
function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  if (value !== null && typeof value === "object") {
    const record = /** @type {JsonRecord} */ (value)
    return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`).join(",")}}`
  }
  return JSON.stringify(value)
}

/** @param {string} value @returns {string} */
function sha256(value) {
  return createHash("sha256").update(value).digest("hex")
}

/** @param {number} value @param {number} digits @returns {number} */
function round(value, digits) {
  return Number(value.toFixed(digits))
}

/** @template T @param {T} value @returns {T} */
function copy(value) {
  return JSON.parse(JSON.stringify(value))
}
