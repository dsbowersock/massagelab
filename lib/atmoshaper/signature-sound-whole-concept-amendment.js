// @ts-check

import { createHash } from "node:crypto"

import {
  validateSignatureSoundConstructionPlaybackPolicy,
  validateSignatureSoundPreviewSettings,
} from "./signature-sound-preview.js"

/**
 * Runtime validation closes every field before it is consumed; this loose
 * record type only lets the validator progressively narrow unknown JSON.
 * @typedef {Record<string, any>} JsonRecord
 */

const SHA256 = /^[a-f0-9]{64}$/
const MAX_ACTIVE_PREVIEW_VOICES = 8
const CATALOG_FIELDS = new Set(["version", "reviewKind", "constructionReviewSha256", "entries"])
const ACTIVE_FIELDS = new Set([
  "batchId", "baseReviewFingerprint", "state", "summary", "label", "sourceIds",
  "sourceAdditions", "playbackPolicy", "levelMatch", "sourceTrims", "processingRequirements", "priorDecision",
])
const RETIRED_FIELDS = new Set([
  "batchId", "baseReviewFingerprint", "state", "summary", "redirectToBatchId",
])
const LEVEL_FIELDS = new Set([
  "method", "toolVersion", "targetPolicy", "targetIntegratedLoudnessLufs", "measurements",
])
const MEASUREMENT_FIELDS = new Set([
  "sourceId", "durationSeconds", "integratedLoudnessLufs", "truePeakDbtp", "gainDb",
])
const SOURCE_TRIM_FIELDS = new Set([
  "sourceId", "startSeconds", "endSeconds", "fadeInSeconds", "fadeOutSeconds",
])
const SOURCE_ADDITION_FIELDS = new Set(["sourceId", "relativePath"])
const PROCESSING_FIELDS = new Set(["kind", "sourceIds", "detail"])
const PRIOR_DECISION_FIELDS = new Set(["decision", "scope", "note"])
const ACTIVE_STATES = new Set(["ready-to-audition", "processing-required", "insufficient-sources"])
const PROCESSING_KINDS = new Set([
  "remove-siren-or-exclude", "remove-discernible-speech", "duck-voices",
  "level-match", "dynamic-range-control", "trim-review-required",
])

/**
 * Applies the reviewer handoff above immutable construction and morning-review
 * evidence. Every active change binds to the exact incoming audition identity;
 * source additions may only reuse a source already present in that base catalog.
 * @param {unknown} rawCatalog
 * @param {unknown} rawAmendments
 */
export function applySignatureSoundWholeConceptReviewAmendments(rawCatalog, rawAmendments) {
  const catalog = requireRecord(rawCatalog, "Whole-concept amendment base catalog")
  if (catalog.version !== 1 || catalog.reviewKind !== "whole-concept-review-batches" ||
      !Array.isArray(catalog.entries)) {
    throw new Error("Whole-concept amendment base catalog is invalid")
  }
  const constructionReviewSha256 = requireSha256(
    catalog.constructionReviewSha256,
    "Whole-concept amendment construction fingerprint",
  )
  const baseEntries = /** @type {unknown[]} */ (catalog.entries)
    .map((rawEntry, index) => normalizeBaseEntry(rawEntry, index))
  const baseByBatch = uniqueIndex(baseEntries, ({ batchId }) => batchId, "base batch")
  const sourceById = indexSources(baseEntries)

  const amendments = requireRecord(rawAmendments, "Whole-concept review amendments")
  assertOnlyFields(amendments, CATALOG_FIELDS, "Whole-concept review amendments")
  if (amendments.version !== 1 || amendments.reviewKind !== "whole-concept-review-amendments") {
    throw new Error("Whole-concept review amendments identity is invalid")
  }
  if (amendments.constructionReviewSha256 !== constructionReviewSha256) {
    throw new Error("Whole-concept review amendments construction fingerprint is stale")
  }
  if (!Array.isArray(amendments.entries)) {
    throw new Error("Whole-concept review amendment entries must be an array")
  }

  const extendedSourceById = indexDeclaredSourceAdditions(amendments.entries, sourceById)
  const normalized = /** @type {unknown[]} */ (amendments.entries).map((rawEntry, index) => (
    normalizeAmendment(rawEntry, index, baseByBatch, extendedSourceById)
  ))
  const amendmentByBatch = uniqueIndex(normalized, ({ batchId }) => batchId, "amendment batch")
  const retired = new Map()
  for (const amendment of normalized) {
    if (amendment.state !== "retired") continue
    if (!baseByBatch.has(amendment.redirectToBatchId) || amendment.redirectToBatchId === amendment.batchId) {
      throw new Error(`Whole-concept retired batch ${amendment.batchId} has an invalid redirect`)
    }
    retired.set(amendment.batchId, amendment.redirectToBatchId)
  }
  for (const [batchId, targetBatchId] of retired) {
    if (retired.has(targetBatchId)) {
      throw new Error(`Whole-concept retired batch ${batchId} cannot redirect to another retired batch`)
    }
  }

  const entries = baseEntries
    .filter(({ batchId }) => !retired.has(batchId))
    .map((entry) => {
      const amendment = amendmentByBatch.get(entry.batchId)
      if (!amendment) {
        return copy({
          ...entry,
          runtimePolicy: entry.runtimePolicy ?? null,
          reviewState: entry.reviewState ?? "ready-to-audition",
          processingRequirements: entry.processingRequirements ?? [],
          amendment: null,
        })
      }
      return applyActiveAmendment(entry, amendment, extendedSourceById, constructionReviewSha256)
    })
  const inheritedRedirects = Array.isArray(catalog.redirects) ? catalog.redirects : []
  const redirects = [
    ...inheritedRedirects,
    ...[...retired].map(([batchId, targetBatchId]) => ({ batchId, targetBatchId })),
  ]
  uniqueIndex(redirects, ({ batchId }) => batchId, "redirect batch")

  return copy({
    version: 1,
    reviewKind: "whole-concept-review-batches",
    constructionReviewSha256,
    redirects,
    entries,
  })
}

/**
 * Lets a reviewer add an exact discovery-owned recording that was not selected
 * into the immutable construction group. Path hashing and root-confined serving
 * keep this catalog extension closed without rewriting earlier review evidence.
 * @param {unknown[]} rawEntries
 * @param {Map<string, JsonRecord>} baseSourceById
 */
function indexDeclaredSourceAdditions(rawEntries, baseSourceById) {
  const sourceById = new Map(baseSourceById)
  rawEntries.forEach((rawEntry, entryIndex) => {
    const entry = requireRecord(rawEntry, `Whole-concept review amendment ${entryIndex}`)
    if (entry.sourceAdditions === undefined) return
    if (!Array.isArray(entry.sourceAdditions)) {
      throw new Error(`Whole-concept review amendment ${entryIndex} source additions must be an array`)
    }
    entry.sourceAdditions.forEach((rawSource, sourceIndex) => {
      const label = `Whole-concept review amendment ${entryIndex} source addition ${sourceIndex}`
      const source = requireRecord(rawSource, label)
      assertOnlyFields(source, SOURCE_ADDITION_FIELDS, label)
      const sourceId = requireSha256(source.sourceId, `${label} id`)
      const relativePath = requireSafeRelativePath(source.relativePath, `${label} path`)
      if (sourceId !== sha256(relativePath)) throw new Error(`${label} id does not match its path`)
      const existing = sourceById.get(sourceId)
      if (existing && existing.relativePath !== relativePath) throw new Error(`${label} conflicts with an existing source`)
      sourceById.set(sourceId, { sourceId, relativePath })
    })
  })
  return sourceById
}

/** @param {unknown} rawEntry @param {number} index @returns {JsonRecord} */
function normalizeBaseEntry(rawEntry, index) {
  const entry = requireRecord(rawEntry, `Whole-concept amendment base entry ${index}`)
  if (!Array.isArray(entry.sources)) throw new Error(`Whole-concept amendment base entry ${index} sources are invalid`)
  return copy({
    ...entry,
    batchId: requireString(entry.batchId, `Whole-concept amendment base entry ${index} batch id`),
    reviewFingerprint: requireSha256(
      entry.reviewFingerprint,
      `Whole-concept amendment base entry ${index} review fingerprint`,
    ),
    sources: /** @type {unknown[]} */ (entry.sources).map((source, sourceIndex) => {
      const normalized = requireRecord(source, `Whole-concept amendment base source ${sourceIndex}`)
      return {
        ...normalized,
        sourceId: requireSha256(normalized.sourceId, `Whole-concept amendment base source ${sourceIndex} id`),
        relativePath: requireString(normalized.relativePath, `Whole-concept amendment base source ${sourceIndex} path`),
      }
    }),
  })
}

/** @param {JsonRecord[]} entries @returns {Map<string, JsonRecord>} */
function indexSources(entries) {
  const sourceById = new Map()
  for (const entry of entries) {
    for (const source of entry.sources) {
      const existing = sourceById.get(source.sourceId)
      if (existing && existing.relativePath !== source.relativePath) {
        throw new Error(`Whole-concept source identity ${source.sourceId} has conflicting paths`)
      }
      sourceById.set(source.sourceId, { sourceId: source.sourceId, relativePath: source.relativePath })
    }
  }
  return sourceById
}

/**
 * @param {unknown} rawAmendment
 * @param {number} index
 * @param {Map<string, JsonRecord>} baseByBatch
 * @param {Map<string, JsonRecord>} sourceById
 * @returns {JsonRecord}
 */
function normalizeAmendment(rawAmendment, index, baseByBatch, sourceById) {
  const label = `Whole-concept review amendment ${index}`
  const amendment = requireRecord(rawAmendment, label)
  const state = requireString(amendment.state, `${label} state`)
  assertOnlyFields(amendment, state === "retired" ? RETIRED_FIELDS : ACTIVE_FIELDS, label)
  const batchId = requireString(amendment.batchId, `${label} batch id`)
  const base = baseByBatch.get(batchId)
  if (!base) throw new Error(`${label} batch is unknown: ${batchId}`)
  const baseReviewFingerprint = requireSha256(amendment.baseReviewFingerprint, `${label} base fingerprint`)
  if (base.reviewFingerprint !== baseReviewFingerprint) throw new Error(`${label} base review fingerprint is stale`)
  const common = {
    batchId,
    baseReviewFingerprint,
    state,
    summary: requireString(amendment.summary, `${label} summary`),
  }
  if (state === "retired") {
    return {
      ...common,
      redirectToBatchId: requireString(amendment.redirectToBatchId, `${label} redirect`),
    }
  }
  if (!ACTIVE_STATES.has(state)) throw new Error(`${label} state is unsupported`)
  const sourceIds = amendment.sourceIds === undefined
    ? /** @type {JsonRecord[]} */ (base.sources).map(({ sourceId }) => sourceId)
    : normalizeSourceIds(amendment.sourceIds, sourceById, `${label} source pool`)
  if (sourceIds.length === 0) throw new Error(`${label} source pool cannot be empty`)
  const playbackPolicy = amendment.playbackPolicy === undefined
    ? null
    : normalizePlaybackPolicy(amendment.playbackPolicy, sourceIds, label)
  const levelMatch = amendment.levelMatch === undefined
    ? null
    : normalizeLevelMatch(amendment.levelMatch, sourceIds, label)
  const sourceTrims = amendment.sourceTrims === undefined
    ? []
    : normalizeSourceTrims(amendment.sourceTrims, sourceIds, label)
  const processingRequirements = amendment.processingRequirements === undefined
    ? []
    : normalizeProcessingRequirements(amendment.processingRequirements, sourceIds, label)
  if (state === "processing-required" && processingRequirements.length === 0) {
    throw new Error(`${label} processing-required state needs an explicit requirement`)
  }
  const priorDecision = amendment.priorDecision === undefined
    ? null
    : normalizePriorDecision(amendment.priorDecision, label)
  return {
    ...common,
    label: amendment.label === undefined ? null : requireString(amendment.label, `${label} label`),
    sourceIds,
    playbackPolicy,
    levelMatch,
    sourceTrims,
    processingRequirements,
    priorDecision,
  }
}

/** @param {unknown} rawTrims @param {string[]} sourceIds @param {string} label @returns {JsonRecord[]} */
function normalizeSourceTrims(rawTrims, sourceIds, label) {
  if (!Array.isArray(rawTrims)) throw new Error(`${label} source trims must be an array`)
  const pool = new Set(sourceIds)
  const trims = rawTrims.map((rawTrim, index) => {
    const trimLabel = `${label} source trim ${index}`
    const trim = requireRecord(rawTrim, trimLabel)
    assertOnlyFields(trim, SOURCE_TRIM_FIELDS, trimLabel)
    const sourceId = requireSha256(trim.sourceId, `${trimLabel} source id`)
    if (!pool.has(sourceId)) throw new Error(`${trimLabel} source is outside the amended pool`)
    const startSeconds = requireRange(trim.startSeconds, 0, 86400, `${trimLabel} start`)
    const endSeconds = requireRange(trim.endSeconds, 0.001, 86400, `${trimLabel} end`)
    const fadeInSeconds = requireRange(trim.fadeInSeconds, 0, 10, `${trimLabel} fade in`)
    const fadeOutSeconds = requireRange(trim.fadeOutSeconds, 0, 10, `${trimLabel} fade out`)
    if (endSeconds <= startSeconds || fadeInSeconds + fadeOutSeconds > endSeconds - startSeconds) {
      throw new Error(`${trimLabel} geometry is invalid`)
    }
    return { sourceId, startSeconds, endSeconds, fadeInSeconds, fadeOutSeconds }
  })
  uniqueIndex(trims, ({ sourceId }) => sourceId, "source trim")
  return trims
}

/** @param {unknown} rawSourceIds @param {Map<string, any>} sourceById @param {string} label @returns {string[]} */
function normalizeSourceIds(rawSourceIds, sourceById, label) {
  if (!Array.isArray(rawSourceIds)) throw new Error(`${label} must be an array`)
  const sourceIds = rawSourceIds.map((sourceId, index) => requireSha256(sourceId, `${label} ${index}`))
  if (new Set(sourceIds).size !== sourceIds.length) throw new Error(`${label} contains a duplicate source`)
  for (const sourceId of sourceIds) {
    if (!sourceById.has(sourceId)) throw new Error(`${label} contains unknown source ${sourceId}`)
  }
  return sourceIds
}

/** @param {unknown} rawPolicy @param {string[]} sourceIds @param {string} label @returns {JsonRecord} */
function normalizePlaybackPolicy(rawPolicy, sourceIds, label) {
  const policy = requireRecord(rawPolicy, `${label} playback policy`)
  const kind = requireString(policy.kind, `${label} playback policy kind`)
  if (kind === "continuous-sequence") {
    assertOnlyFields(policy, new Set(["kind", "transitionMode", "transitionSeconds"]), `${label} playback policy`)
    const transitionMode = requireEnum(policy.transitionMode, new Set(["end-to-end", "crossfade", "overlap"]), `${label} transition mode`)
    const transitionSeconds = requireRange(policy.transitionSeconds, transitionMode === "end-to-end" ? 0 : 0.01, 60, `${label} transition seconds`)
    if (transitionMode === "end-to-end" && transitionSeconds !== 0) throw new Error(`${label} end-to-end transition must use zero seconds`)
    return { kind, transitionMode, transitionSeconds }
  }
  if (kind === "fixed-region-loop") {
    assertOnlyFields(policy, new Set(["kind", "firstPassStartSeconds", "loopStartSeconds", "loopEndSeconds", "crossfadeSeconds"]), `${label} playback policy`)
    const normalized = {
      kind,
      firstPassStartSeconds: requireRange(policy.firstPassStartSeconds, 0, 3600, `${label} first-pass start`),
      loopStartSeconds: requireRange(policy.loopStartSeconds, 0, 3600, `${label} loop start`),
      loopEndSeconds: requireRange(policy.loopEndSeconds, 0.001, 3600, `${label} loop end`),
      crossfadeSeconds: requireRange(policy.crossfadeSeconds, 0.01, 60, `${label} loop crossfade`),
    }
    if (sourceIds.length !== 1 || normalized.firstPassStartSeconds !== 0 ||
        normalized.loopStartSeconds <= normalized.firstPassStartSeconds ||
        normalized.loopEndSeconds <= normalized.loopStartSeconds ||
        normalized.crossfadeSeconds * 2 > normalized.loopEndSeconds - normalized.loopStartSeconds) {
      throw new Error(`${label} fixed loop geometry is invalid`)
    }
    return normalized
  }
  if (kind === "random-region-loop") {
    assertOnlyFields(policy, new Set(["kind", "regionStartSeconds", "regionEndSeconds", "minimumLoopSeconds", "crossfadeSeconds"]), `${label} playback policy`)
    const normalized = {
      kind,
      regionStartSeconds: requireRange(policy.regionStartSeconds, 0, 3600, `${label} region start`),
      regionEndSeconds: requireRange(policy.regionEndSeconds, 0.001, 3600, `${label} region end`),
      minimumLoopSeconds: requireRange(policy.minimumLoopSeconds, 0.01, 3600, `${label} minimum loop`),
      crossfadeSeconds: requireRange(policy.crossfadeSeconds, 0.01, 60, `${label} loop crossfade`),
    }
    const regionSeconds = normalized.regionEndSeconds - normalized.regionStartSeconds
    const effectiveMinimumLoopSeconds = Math.max(
      normalized.minimumLoopSeconds,
      normalized.crossfadeSeconds * 2,
    )
    if (sourceIds.length !== 1 || normalized.regionEndSeconds <= normalized.regionStartSeconds ||
        effectiveMinimumLoopSeconds > regionSeconds ||
        normalized.crossfadeSeconds >= normalized.minimumLoopSeconds) {
      throw new Error(`${label} random loop geometry is invalid`)
    }
    return normalized
  }
  if (kind === "pause-separated-sequence") {
    assertOnlyFields(policy, new Set(["kind", "minimumGapSeconds", "maximumGapSeconds", "fadeInSeconds", "fadeOutSeconds"]), `${label} playback policy`)
    const normalized = {
      kind,
      minimumGapSeconds: requireRange(policy.minimumGapSeconds, 0, 60, `${label} minimum gap`),
      maximumGapSeconds: requireRange(policy.maximumGapSeconds, 0, 60, `${label} maximum gap`),
      fadeInSeconds: requireRange(policy.fadeInSeconds, 0, 10, `${label} fade in`),
      fadeOutSeconds: requireRange(policy.fadeOutSeconds, 0, 10, `${label} fade out`),
    }
    if (normalized.maximumGapSeconds < normalized.minimumGapSeconds) throw new Error(`${label} pause range is invalid`)
    return normalized
  }
  if (kind === "cadence") {
    assertOnlyFields(policy, new Set(["kind", "eventsPerMinute", "jitterPercent"]), `${label} playback policy`)
    return {
      kind,
      eventsPerMinute: requireRange(policy.eventsPerMinute, 1, 300, `${label} events per minute`),
      jitterPercent: requireRange(policy.jitterPercent, 0, 100, `${label} cadence jitter`),
    }
  }
  if (kind === "layered-sequence") {
    assertOnlyFields(policy, new Set(["kind", "maximumConcurrentVoices", "transitionMode", "transitionSeconds", "initialStartWindowSeconds"]), `${label} playback policy`)
    const transitionMode = requireEnum(policy.transitionMode, new Set(["crossfade", "overlap"]), `${label} layered transition mode`)
    return {
      kind,
      maximumConcurrentVoices: requireInteger(policy.maximumConcurrentVoices, 2, 8, `${label} maximum voices`),
      transitionMode,
      transitionSeconds: requireRange(policy.transitionSeconds, transitionMode === "crossfade" ? 0.01 : 0, 60, `${label} layered transition seconds`),
      initialStartWindowSeconds: requireRange(policy.initialStartWindowSeconds, 0, 60, `${label} initial start window`),
    }
  }
  if (kind === "multi-lane-sequence") {
    assertOnlyFields(policy, new Set(["kind", "lanes"]), `${label} playback policy`)
    if (!Array.isArray(policy.lanes) || policy.lanes.length < 1 || policy.lanes.length > 8) {
      throw new Error(`${label} multi-lane policy needs one to eight lanes`)
    }
    const pool = new Set(sourceIds)
    const used = new Set()
    const lanes = /** @type {unknown[]} */ (policy.lanes).map((rawLane, laneIndex) => {
      const laneLabel = `${label} lane ${laneIndex}`
      const lane = requireRecord(rawLane, laneLabel)
      const boundaryMode = requireEnum(lane.boundaryMode, new Set(["crossfade", "pause"]), `${laneLabel} boundary mode`)
      assertOnlyFields(lane, boundaryMode === "crossfade"
        ? new Set(["sourceIds", "boundaryMode", "transitionSeconds"])
        : new Set(["sourceIds", "boundaryMode", "minimumGapSeconds", "maximumGapSeconds"]), laneLabel)
      const laneSourceIds = normalizeSourceIds(lane.sourceIds, new Map(sourceIds.map((sourceId) => [sourceId, true])), `${laneLabel} source pool`)
      if (laneSourceIds.length === 0) throw new Error(`${laneLabel} source pool cannot be empty`)
      if (laneSourceIds.some((sourceId) => !pool.has(sourceId))) throw new Error(`${laneLabel} source is outside the amended pool`)
      if (laneSourceIds.some((sourceId) => used.has(sourceId))) throw new Error(`${laneLabel} source is assigned to multiple lanes`)
      laneSourceIds.forEach((sourceId) => used.add(sourceId))
      if (boundaryMode === "crossfade") {
        return {
          sourceIds: laneSourceIds,
          boundaryMode,
          transitionSeconds: requireRange(lane.transitionSeconds, 0.01, 60, `${laneLabel} transition seconds`),
        }
      }
      const minimumGapSeconds = requireRange(lane.minimumGapSeconds, 0, 60, `${laneLabel} minimum gap`)
      const maximumGapSeconds = requireRange(lane.maximumGapSeconds, 0, 60, `${laneLabel} maximum gap`)
      if (maximumGapSeconds < minimumGapSeconds) throw new Error(`${laneLabel} pause range is invalid`)
      return { sourceIds: laneSourceIds, boundaryMode, minimumGapSeconds, maximumGapSeconds }
    })
    if (used.size !== pool.size) throw new Error(`${label} lanes must cover the exact amended source pool`)
    if (lanes.length >= MAX_ACTIVE_PREVIEW_VOICES && lanes.some(({ boundaryMode }) => boundaryMode === "crossfade")) {
      throw new Error(`${label} multi-lane crossfade needs one preview voice reserved for its transition`)
    }
    return { kind, lanes }
  }
  throw new Error(`${label} playback policy kind is unsupported`)
}

/** @param {unknown} rawLevelMatch @param {string[]} sourceIds @param {string} label @returns {JsonRecord} */
function normalizeLevelMatch(rawLevelMatch, sourceIds, label) {
  const levelMatch = requireRecord(rawLevelMatch, `${label} level match`)
  assertOnlyFields(levelMatch, LEVEL_FIELDS, `${label} level match`)
  if (levelMatch.method !== "ffmpeg-ebur128-v1" ||
      !requireString(levelMatch.toolVersion, `${label} level tool version`).startsWith("ffmpeg version ") ||
      !new Set(["quietest-input", "median-with-true-peak-headroom"]).has(levelMatch.targetPolicy)) {
    throw new Error(`${label} level-match identity is invalid`)
  }
  const target = requireNumber(levelMatch.targetIntegratedLoudnessLufs, `${label} level target`)
  if (!Array.isArray(levelMatch.measurements) || levelMatch.measurements.length !== sourceIds.length) {
    throw new Error(`${label} level measurements must cover every exact source`)
  }
  const bySource = new Map(/** @type {unknown[]} */ (levelMatch.measurements).map((rawMeasurement, index) => {
    const measurementLabel = `${label} level measurement ${index}`
    const measurement = requireRecord(rawMeasurement, measurementLabel)
    assertOnlyFields(measurement, MEASUREMENT_FIELDS, measurementLabel)
    const sourceId = requireSha256(measurement.sourceId, `${measurementLabel} source id`)
    const integratedLoudnessLufs = requireNumber(measurement.integratedLoudnessLufs, `${measurementLabel} integrated loudness`)
    const gainDb = requireNumber(measurement.gainDb, `${measurementLabel} gain`)
    if (gainDb < -100 || gainDb > 24 || gainDb !== round(target - integratedLoudnessLufs, 1)) {
      throw new Error(`${measurementLabel} gain does not match the level target`)
    }
    return [sourceId, {
      sourceId,
      durationSeconds: requireRange(measurement.durationSeconds, 0.001, 86400, `${measurementLabel} duration`),
      integratedLoudnessLufs,
      truePeakDbtp: requireNumber(measurement.truePeakDbtp, `${measurementLabel} true peak`),
      gainDb,
    }]
  }))
  if (bySource.size !== sourceIds.length || sourceIds.some((sourceId) => !bySource.has(sourceId))) {
    throw new Error(`${label} level measurements do not match the exact source pool`)
  }
  if (levelMatch.targetPolicy === "quietest-input") {
    if (levelMatch.toolVersion !== "ffmpeg version 9.0-full_build-www.gyan.dev" ||
        target !== Math.min(...[...bySource.values()].map(({ integratedLoudnessLufs }) => integratedLoudnessLufs)) ||
        [...bySource.values()].some(({ gainDb }) => gainDb > 0)) {
      throw new Error(`${label} quietest-input target is invalid`)
    }
  } else {
    const ordered = [...bySource.values()].map(({ integratedLoudnessLufs }) => integratedLoudnessLufs).sort((left, right) => left - right)
    const middle = Math.floor(ordered.length / 2)
    const median = ordered.length % 2 === 0 ? (ordered[middle - 1] + ordered[middle]) / 2 : ordered[middle]
    const truePeakSafeCeiling = Math.min(...[...bySource.values()].map(({ integratedLoudnessLufs, truePeakDbtp }) => (
      integratedLoudnessLufs - 1 - truePeakDbtp
    )))
    const expectedTarget = Math.floor(Math.min(median, truePeakSafeCeiling) * 10) / 10
    if (target !== expectedTarget || [...bySource.values()].some(({ truePeakDbtp, gainDb }) => truePeakDbtp + gainDb > -1 + 1e-9)) {
      throw new Error(`${label} median level target must preserve one dB of true-peak headroom`)
    }
  }
  return {
    method: levelMatch.method,
    toolVersion: levelMatch.toolVersion,
    targetPolicy: levelMatch.targetPolicy,
    targetIntegratedLoudnessLufs: target,
    measurements: sourceIds.map((sourceId) => bySource.get(sourceId)),
  }
}

/** @param {unknown} rawRequirements @param {string[]} sourceIds @param {string} label @returns {JsonRecord[]} */
function normalizeProcessingRequirements(rawRequirements, sourceIds, label) {
  if (!Array.isArray(rawRequirements)) throw new Error(`${label} processing requirements must be an array`)
  return rawRequirements.map((rawRequirement, index) => {
    const requirementLabel = `${label} processing requirement ${index}`
    const requirement = requireRecord(rawRequirement, requirementLabel)
    assertOnlyFields(requirement, PROCESSING_FIELDS, requirementLabel)
    const kind = requireEnum(requirement.kind, PROCESSING_KINDS, `${requirementLabel} kind`)
    const requirementSourceIds = requirement.sourceIds === undefined
      ? sourceIds
      : normalizeSourceIds(requirement.sourceIds, new Map(sourceIds.map((sourceId) => [sourceId, true])), `${requirementLabel} sources`)
    if (requirementSourceIds.some((sourceId) => !sourceIds.includes(sourceId))) {
      throw new Error(`${requirementLabel} source is outside the amended pool`)
    }
    return {
      kind,
      sourceIds: requirementSourceIds,
      detail: requireString(requirement.detail, `${requirementLabel} detail`),
    }
  })
}

/** @param {unknown} rawPriorDecision @param {string} label @returns {JsonRecord} */
function normalizePriorDecision(rawPriorDecision, label) {
  const priorDecision = requireRecord(rawPriorDecision, `${label} prior decision`)
  assertOnlyFields(priorDecision, PRIOR_DECISION_FIELDS, `${label} prior decision`)
  if (priorDecision.decision !== "pass" || priorDecision.scope !== "pre-amendment") {
    throw new Error(`${label} prior decision identity is invalid`)
  }
  return { decision: "pass", scope: "pre-amendment", note: requireString(priorDecision.note, `${label} prior decision note`) }
}

/**
 * @param {JsonRecord} entry
 * @param {JsonRecord} amendment
 * @param {Map<string, JsonRecord>} sourceById
 * @param {string} constructionReviewSha256
 * @returns {JsonRecord}
 */
function applyActiveAmendment(entry, amendment, sourceById, constructionReviewSha256) {
  const sources = /** @type {string[]} */ (amendment.sourceIds)
    .map((sourceId) => ({ ...sourceById.get(sourceId) }))
  if (amendment.levelMatch) {
    const gainBySource = new Map(
      /** @type {JsonRecord[]} */ (amendment.levelMatch.measurements)
        .map(({ sourceId, gainDb }) => [sourceId, gainDb]),
    )
    for (const source of sources) source.gainDb = gainBySource.get(source.sourceId)
  }
  const trimBySource = new Map(
    /** @type {JsonRecord[]} */ (amendment.sourceTrims).map((trim) => [trim.sourceId, trim]),
  )
  for (const source of sources) {
    const trim = trimBySource.get(source.sourceId)
    if (trim) Object.assign(source, trim)
  }
  let playbackConfiguration = copy(entry.playbackConfiguration)
  let runtimePolicy = null
  if (amendment.playbackPolicy?.kind === "continuous-sequence") {
    const previewSettings = validateSignatureSoundPreviewSettings(playbackConfiguration.strategyId, {
      transitionMode: amendment.playbackPolicy.transitionMode,
      transitionSeconds: amendment.playbackPolicy.transitionSeconds,
    })
    playbackConfiguration = {
      strategyId: playbackConfiguration.strategyId,
      previewSettings,
      constructionPolicy: validateSignatureSoundConstructionPlaybackPolicy(
        playbackConfiguration.strategyId,
        previewSettings,
        {
          ...playbackConfiguration.constructionPolicy,
          transitionDurationRange: null,
          cadenceBoundary: null,
          preserveFullLengthOverlaps: false,
        },
      ),
    }
  } else if (amendment.playbackPolicy?.kind === "cadence") {
    const strategyId = "walking-cadence-sequence"
    const previewSettings = validateSignatureSoundPreviewSettings(strategyId, {
      stepsPerMinute: amendment.playbackPolicy.eventsPerMinute,
      jitterPercent: amendment.playbackPolicy.jitterPercent,
    })
    playbackConfiguration = {
      strategyId,
      previewSettings,
      constructionPolicy: validateSignatureSoundConstructionPlaybackPolicy(strategyId, previewSettings, {
        minimumSelectionsBeforeRepeat: playbackConfiguration.constructionPolicy.minimumSelectionsBeforeRepeat,
        transitionDurationRange: null,
        cadenceBoundary: null,
        overlapNextEvent: playbackConfiguration.constructionPolicy.overlapNextEvent,
      }),
    }
  } else if (amendment.playbackPolicy) {
    runtimePolicy = amendment.playbackPolicy
  }
  const appliedAmendment = copy(amendment)
  const amended = /** @type {JsonRecord} */ ({
    ...entry,
    label: amendment.label ?? entry.label,
    sources,
    playbackConfiguration,
    runtimePolicy,
    reviewState: amendment.state,
    processingRequirements: amendment.processingRequirements,
    amendment: appliedAmendment,
  })
  amended.reviewFingerprint = sha256(stableJson({
    reviewKind: "whole-concept-review-amendment-entry",
    constructionReviewSha256,
    baseReviewFingerprint: amendment.baseReviewFingerprint,
    batchId: amended.batchId,
    groupId: amended.groupId,
    label: amended.label,
    sources: amended.sources,
    playbackConfiguration: amended.playbackConfiguration,
    runtimePolicy: amended.runtimePolicy,
    reviewState: amended.reviewState,
    processingRequirements: amended.processingRequirements,
    amendment: amended.amendment,
  }))
  return copy(amended)
}

/** @template T, K @param {T[]} values @param {(value: T) => K} getKey @param {string} label @returns {Map<K, T>} */
function uniqueIndex(values, getKey, label) {
  const result = new Map()
  for (const value of values) {
    const key = getKey(value)
    if (result.has(key)) throw new Error(`Whole-concept ${label} is duplicated: ${key}`)
    result.set(key, value)
  }
  return result
}

/** @param {unknown} value @param {string} label @returns {JsonRecord} */
function requireRecord(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`)
  return value
}

/** @param {unknown} value @param {string} label @returns {string} */
function requireString(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string`)
  return value
}

/** @param {unknown} value @param {string} label @returns {string} */
function requireSafeRelativePath(value, label) {
  const path = requireString(value, label)
  if (path !== path.trim() || path.includes("\\") || path.startsWith("/") || /^[a-z]:/i.test(path) ||
      path.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new Error(`${label} must be a safe relative path`)
  }
  return path
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

/** @param {unknown} value @param {number} minimum @param {number} maximum @param {string} label @returns {number} */
function requireRange(value, minimum, maximum, label) {
  const number = requireNumber(value, label)
  if (number < minimum || number > maximum) throw new Error(`${label} must be between ${minimum} and ${maximum}`)
  return number
}

/** @param {unknown} value @param {number} minimum @param {number} maximum @param {string} label @returns {number} */
function requireInteger(value, minimum, maximum, label) {
  const number = requireRange(value, minimum, maximum, label)
  if (!Number.isInteger(number)) throw new Error(`${label} must be an integer`)
  return number
}

/** @param {unknown} value @param {Set<string>} allowed @param {string} label @returns {string} */
function requireEnum(value, allowed, label) {
  if (typeof value !== "string" || !allowed.has(value)) throw new Error(`${label} is unsupported`)
  return value
}

/** @param {JsonRecord} record @param {Set<string>} allowed @param {string} label */
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
