// @ts-check

import { createHash } from "node:crypto"

import { createSignatureSoundDiscoveryReviewFingerprint } from "./signature-sound-review-fingerprints.js"
import {
  validateSignatureSoundConstructionPlaybackPolicy,
  validateSignatureSoundPreviewSettings,
} from "./signature-sound-preview.js"

const SHA256 = /^[a-f0-9]{64}$/
const BATCH_ID = /^batch-[0-9]{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/
const CATALOG_FIELDS = new Set(["version", "reviewKind", "discoveryReviewSha256", "entries"])
const ENTRY_FIELDS = new Set([
  "batchId", "groupId", "label", "summary", "sourceSets", "playback",
  "runtimePolicy", "sourceSelection", "showSourceAuditions", "levelMatch",
])
const SOURCE_SET_FIELDS = new Set([
  "id", "label", "pathPrefix", "fileNameIncludes", "excludeFileNames", "expectedSourceCount",
])
const PLAYBACK_FIELDS = new Set([
  "strategyId", "previewSettings", "minimumSelectionsBeforeRepeat",
  "transitionDurationRange", "overlapNextEvent", "preserveFullLengthOverlaps",
])
const RANGE_FIELDS = new Set(["minimumSeconds", "maximumSeconds"])
const SOURCE_SELECTION_FIELDS = new Set(["kind"])
const LEVEL_FIELDS = new Set([
  "method", "toolVersion", "targetPolicy", "targetIntegratedLoudnessLufs", "measurements",
])
const LEVEL_MEASUREMENT_FIELDS = new Set([
  "sourceId", "durationSeconds", "integratedLoudnessLufs", "truePeakDbtp", "gainDb",
])
const LAYERED_FIELDS = new Set([
  "kind", "maximumConcurrentVoices", "transitionMode", "transitionSeconds",
  "initialStartWindowSeconds",
])
const MULTI_LANE_FIELDS = new Set(["kind", "lanes"])
const REPEAT_SOURCE_FIELDS = new Set([
  "kind", "minimumConsecutivePlays", "maximumConsecutivePlays", "beatsPerMinute", "crossfadeBeats",
  "shortSourceIds", "shortCrossfadeBeats",
])
const LANE_FIELDS = new Set([
  "laneId", "sourceSetId", "boundaryMode", "transitionSeconds",
])

/**
 * Projects user-directed catalog-expansion candidates from the checksum-bound
 * discovery owner. Selectors remain human-readable while expected counts and
 * the owner fingerprint prevent a folder change from silently altering review.
 * @param {unknown} rawCatalog
 * @param {{discoveryReview: unknown}} rawContext
 */
export function validateSignatureSoundCatalogExpansionReview(rawCatalog, rawContext) {
  const catalog = requireRecord(rawCatalog, "Catalog expansion review")
  assertOnlyFields(catalog, CATALOG_FIELDS, "Catalog expansion review")
  if (catalog.version !== 1 || catalog.reviewKind !== "signature-catalog-expansion-review") {
    throw new Error("Catalog expansion review identity is invalid")
  }
  const discoveryReviewSha256 = requireSha256(
    catalog.discoveryReviewSha256,
    "Catalog expansion discovery fingerprint",
  )
  const context = requireRecord(rawContext, "Catalog expansion context")
  const discoveryReview = requireRecord(context.discoveryReview, "Catalog expansion discovery review")
  const discoveryFingerprints = requireRecord(
    discoveryReview.fingerprints,
    "Catalog expansion discovery fingerprints",
  )
  if (discoveryReviewSha256 !== requireSha256(
    discoveryFingerprints.reviewSha256,
    "Catalog expansion discovery owner fingerprint",
  )) {
    throw new Error("Catalog expansion discovery fingerprint is stale")
  }
  if (!Array.isArray(discoveryReview.sources)) {
    throw new Error("Catalog expansion discovery sources must be an array")
  }
  if (!Array.isArray(catalog.entries) || catalog.entries.length === 0) {
    throw new Error("Catalog expansion review needs at least one entry")
  }

  const sourceById = indexDiscoverySources(discoveryReview.sources)
  const entries = catalog.entries.map((entry, index) => projectEntry(
    entry,
    index,
    discoveryReviewSha256,
    [...sourceById.values()],
  ))
  assertUnique(entries, "batchId", "batch")
  assertUnique(entries, "groupId", "group")

  if (createSignatureSoundDiscoveryReviewFingerprint(discoveryReview) !== discoveryReviewSha256) {
    throw new Error("Catalog expansion discovery owner content fingerprint is stale")
  }

  return copy({
    version: 1,
    reviewKind: "signature-catalog-expansion-review",
    discoveryReviewSha256,
    entries,
  })
}

/** @param {unknown} rawEntry @param {number} index @param {string} ownerSha256 @param {Array<{sourceId: string, relativePath: string}>} allSources */
function projectEntry(rawEntry, index, ownerSha256, allSources) {
  const label = `Catalog expansion entry ${index}`
  const entry = requireRecord(rawEntry, label)
  assertOnlyFields(entry, ENTRY_FIELDS, label)
  const batchId = requirePattern(entry.batchId, BATCH_ID, `${label} batch id`)
  const groupId = requireTrimmedString(entry.groupId, `${label} group id`)
  const conceptLabel = requireTrimmedString(entry.label, `${label} label`)
  const summary = requireTrimmedString(entry.summary, `${label} summary`)
  if (!Array.isArray(entry.sourceSets) || entry.sourceSets.length === 0) {
    throw new Error(`${label} source sets must be a non-empty array`)
  }
  const sourceSets = entry.sourceSets.map((sourceSet, sourceSetIndex) => (
    projectSourceSet(sourceSet, `${label} source set ${sourceSetIndex}`, allSources)
  ))
  assertUnique(sourceSets, "id", `${label} source-set`)
  const sources = sourceSets.flatMap(({ sources: selectedSources }) => selectedSources)
  if (new Set(sources.map(({ sourceId }) => sourceId)).size !== sources.length) {
    throw new Error(`${label} source selectors overlap`)
  }
  const playbackConfiguration = projectPlayback(entry.playback, `${label} playback`)
  const runtimePolicy = projectRuntimePolicy(
    entry.runtimePolicy,
    sourceSets,
    playbackConfiguration,
    `${label} runtime policy`,
  )
  const sourceSelection = projectSourceSelection(entry.sourceSelection, `${label} source selection`)
  const showSourceAuditions = requireBoolean(entry.showSourceAuditions, `${label} source-audition flag`)
  const levelMatch = projectLevelMatch(entry.levelMatch ?? null, sources, `${label} level match`)
  const gainBySource = new Map(levelMatch?.measurements.map(({ sourceId, gainDb }) => [sourceId, gainDb]) ?? [])
  const projectedSources = sources.map(({ sourceId, relativePath, sourceSetId, sourceSetLabel }) => ({
    sourceId,
    relativePath,
    sourceSetId,
    sourceSetLabel,
    ...(gainBySource.has(sourceId) ? { gainDb: gainBySource.get(sourceId) } : {}),
  }))
  const fingerprintOwner = {
    reviewKind: "signature-catalog-expansion-entry",
    discoveryReviewSha256: ownerSha256,
    batchId,
    groupId,
    label: conceptLabel,
    summary,
    sources: projectedSources,
    playbackConfiguration,
    runtimePolicy,
    sourceSelection,
    showSourceAuditions,
    levelMatch,
  }
  return {
    batchId,
    groupId,
    label: conceptLabel,
    reviewFingerprint: sha256(stableJson(fingerprintOwner)),
    sources: projectedSources,
    playbackConfiguration,
    runtimePolicy,
    sourceSelection,
    showSourceAuditions,
    levelMatch,
    reviewState: "ready-to-audition",
    processingRequirements: [],
    amendment: {
      state: "ready-to-audition",
      summary,
    },
    revision: null,
    chatOutcome: null,
  }
}

/** @param {unknown} rawSourceSet @param {string} label @param {Array<{sourceId: string, relativePath: string}>} allSources */
function projectSourceSet(rawSourceSet, label, allSources) {
  const sourceSet = requireRecord(rawSourceSet, label)
  assertOnlyFields(sourceSet, SOURCE_SET_FIELDS, label)
  const id = requireIdentifier(sourceSet.id, `${label} id`)
  const sourceSetLabel = requireTrimmedString(sourceSet.label, `${label} label`)
  const pathPrefix = requireSafeRelativePrefix(sourceSet.pathPrefix, `${label} path prefix`)
  const fileNameIncludes = sourceSet.fileNameIncludes === undefined
    ? null
    : requireTrimmedString(sourceSet.fileNameIncludes, `${label} filename filter`)
  const excludeFileNames = sourceSet.excludeFileNames === undefined
    ? []
    : projectExcludedFileNames(sourceSet.excludeFileNames, `${label} exclusions`)
  const expectedSourceCount = requireInteger(sourceSet.expectedSourceCount, 1, 500, `${label} expected count`)
  const normalizedNeedle = fileNameIncludes?.toLowerCase() ?? null
  const candidates = allSources
    .filter(({ relativePath }) => relativePath.startsWith(pathPrefix))
    .filter(({ relativePath }) => normalizedNeedle === null || (
      relativePath.split("/").at(-1)?.toLowerCase().includes(normalizedNeedle)
    ))
  const candidateFileNames = new Set(candidates.map(({ relativePath }) => (
    relativePath.slice(relativePath.lastIndexOf("/") + 1)
  )))
  for (const excludedFileName of excludeFileNames) {
    if (!candidateFileNames.has(excludedFileName)) {
      throw new Error(`${label} exclude filename is unknown: ${excludedFileName}`)
    }
  }
  const excluded = new Set(excludeFileNames)
  const sources = candidates
    .filter(({ relativePath }) => !excluded.has(relativePath.slice(relativePath.lastIndexOf("/") + 1)))
    .sort((left, right) => compareText(left.relativePath, right.relativePath))
    .map(({ sourceId, relativePath }) => ({ sourceId, relativePath, sourceSetId: id, sourceSetLabel }))
  if (sources.length !== expectedSourceCount) {
    throw new Error(`${label} expected ${expectedSourceCount} sources but selected ${sources.length}`)
  }
  return { id, label: sourceSetLabel, pathPrefix, fileNameIncludes, excludeFileNames, expectedSourceCount, sources }
}

/** Closes exact basename exclusions so reviewer removals cannot drift to a different source. @param {unknown} rawNames @param {string} label */
function projectExcludedFileNames(rawNames, label) {
  if (!Array.isArray(rawNames) || rawNames.length === 0) {
    throw new Error(`${label} must be a non-empty array`)
  }
  const names = rawNames.map((name, index) => requireTrimmedString(name, `${label} ${index}`))
  if (new Set(names).size !== names.length) throw new Error(`${label} exclude list contains a duplicate filename`)
  return names
}

/** @param {unknown} rawPlayback @param {string} label */
function projectPlayback(rawPlayback, label) {
  const playback = requireRecord(rawPlayback, label)
  assertOnlyFields(playback, PLAYBACK_FIELDS, label)
  const strategyId = requireTrimmedString(playback.strategyId, `${label} strategy`)
  const previewSettings = validateSignatureSoundPreviewSettings(strategyId, playback.previewSettings)
  const transitionDurationRange = playback.transitionDurationRange === undefined
    ? null
    : projectTransitionRange(playback.transitionDurationRange, `${label} transition range`)
  const constructionPolicy = validateSignatureSoundConstructionPlaybackPolicy(
    strategyId,
    previewSettings,
    {
      minimumSelectionsBeforeRepeat: playback.minimumSelectionsBeforeRepeat ?? null,
      transitionDurationRange,
      cadenceBoundary: null,
      overlapNextEvent: playback.overlapNextEvent ?? false,
      ...(playback.preserveFullLengthOverlaps === undefined
        ? {}
        : { preserveFullLengthOverlaps: playback.preserveFullLengthOverlaps }),
    },
  )
  return { strategyId, previewSettings, constructionPolicy }
}

/** @param {unknown} rawRange @param {string} label */
function projectTransitionRange(rawRange, label) {
  const range = requireRecord(rawRange, label)
  assertOnlyFields(range, RANGE_FIELDS, label)
  const minimumSeconds = requireNumber(range.minimumSeconds, 0, 60, `${label} minimum`)
  const maximumSeconds = requireNumber(range.maximumSeconds, minimumSeconds, 60, `${label} maximum`)
  return { minimumSeconds, maximumSeconds }
}

/** @param {unknown} rawPolicy @param {Array<{id: string, sources: Array<{sourceId: string}>}>} sourceSets @param {{strategyId:string, previewSettings:Record<string,any>}} playback @param {string} label */
function projectRuntimePolicy(rawPolicy, sourceSets, playback, label) {
  if (rawPolicy === null) return null
  const policy = requireRecord(rawPolicy, label)
  if (policy.kind === "layered-sequence") {
    assertOnlyFields(policy, LAYERED_FIELDS, label)
    const transitionMode = requireExactString(policy.transitionMode, "crossfade", `${label} transition mode`)
    return {
      kind: "layered-sequence",
      maximumConcurrentVoices: requireInteger(policy.maximumConcurrentVoices, 1, 4, `${label} voice cap`),
      transitionMode,
      transitionSeconds: requireNumber(policy.transitionSeconds, 0.05, 60, `${label} transition`),
      initialStartWindowSeconds: requireNumber(policy.initialStartWindowSeconds, 0, 60, `${label} startup window`),
    }
  }
  if (policy.kind === "multi-lane-sequence") {
    assertOnlyFields(policy, MULTI_LANE_FIELDS, label)
    if (!Array.isArray(policy.lanes) || policy.lanes.length < 1 || policy.lanes.length > 4) {
      throw new Error(`${label} needs one to four lanes`)
    }
    const sourceSetById = new Map(sourceSets.map((sourceSet) => [sourceSet.id, sourceSet]))
    const usedSourceSets = new Set()
    const lanes = policy.lanes.map((rawLane, index) => {
      const laneLabel = `${label} lane ${index}`
      const lane = requireRecord(rawLane, laneLabel)
      assertOnlyFields(lane, LANE_FIELDS, laneLabel)
      const laneId = requireIdentifier(lane.laneId, `${laneLabel} id`)
      const sourceSetId = requireIdentifier(lane.sourceSetId, `${laneLabel} source-set id`)
      const sourceSet = sourceSetById.get(sourceSetId)
      if (!sourceSet) throw new Error(`${laneLabel} references unknown source set ${sourceSetId}`)
      if (usedSourceSets.has(sourceSetId)) throw new Error(`${laneLabel} repeats source set ${sourceSetId}`)
      usedSourceSets.add(sourceSetId)
      return {
        laneId,
        sourceIds: sourceSet.sources.map(({ sourceId }) => sourceId),
        boundaryMode: requireExactString(lane.boundaryMode, "crossfade", `${laneLabel} boundary mode`),
        transitionSeconds: requireNumber(lane.transitionSeconds, 0.05, 60, `${laneLabel} transition`),
      }
    })
    assertUnique(lanes, "laneId", `${label} lane`)
    if (usedSourceSets.size !== sourceSets.length) {
      throw new Error(`${label} lanes must cover every source set`)
    }
    return { kind: "multi-lane-sequence", lanes }
  }
  if (policy.kind === "repeat-source-sequence") {
    assertOnlyFields(policy, REPEAT_SOURCE_FIELDS, label)
    const minimumConsecutivePlays = requireInteger(
      policy.minimumConsecutivePlays,
      1,
      100,
      `${label} minimum consecutive plays`,
    )
    const maximumConsecutivePlays = requireInteger(
      policy.maximumConsecutivePlays,
      minimumConsecutivePlays,
      100,
      `${label} maximum consecutive plays`,
    )
    const beatsPerMinute = requireNumber(policy.beatsPerMinute, 1, 400, `${label} beats per minute`)
    const crossfadeBeats = requireNumber(policy.crossfadeBeats, 0.25, 64, `${label} crossfade beats`)
    if (!Array.isArray(policy.shortSourceIds)) {
      throw new Error(`${label} short source ids must be an array`)
    }
    const shortSourceIds = policy.shortSourceIds.map((sourceId, index) => (
      requireSha256(sourceId, `${label} short source ${index}`)
    ))
    if (new Set(shortSourceIds).size !== shortSourceIds.length) {
      throw new Error(`${label} short source ids contain a duplicate`)
    }
    const selectedSourceIds = new Set(sourceSets.flatMap(({ sources }) => (
      sources.map(({ sourceId }) => sourceId)
    )))
    for (const sourceId of shortSourceIds) {
      if (!selectedSourceIds.has(sourceId)) {
        throw new Error(`${label} short source id is not in the selected pool: ${sourceId}`)
      }
    }
    const shortCrossfadeBeats = requireNumber(
      policy.shortCrossfadeBeats,
      0.25,
      crossfadeBeats,
      `${label} short crossfade beats`,
    )
    if (shortSourceIds.length > 0 && shortCrossfadeBeats >= crossfadeBeats) {
      throw new Error(`${label} short crossfade must be shorter than the default crossfade`)
    }
    const expectedCrossfadeSeconds = crossfadeBeats * 60 / beatsPerMinute
    if (playback.strategyId !== "adaptive-whole-source-sequence" ||
        playback.previewSettings.transitionMode !== "crossfade" ||
        Math.abs(playback.previewSettings.transitionSeconds - expectedCrossfadeSeconds) > 1e-9) {
      throw new Error(`${label} crossfade does not match its beat timing`)
    }
    return {
      kind: "repeat-source-sequence",
      minimumConsecutivePlays,
      maximumConsecutivePlays,
      beatsPerMinute,
      crossfadeBeats,
      shortSourceIds,
      shortCrossfadeBeats,
    }
  }
  throw new Error(`${label} kind is unsupported`)
}

/** @param {unknown} rawSelection @param {string} label */
function projectSourceSelection(rawSelection, label) {
  if (rawSelection === null) return null
  const selection = requireRecord(rawSelection, label)
  assertOnlyFields(selection, SOURCE_SELECTION_FIELDS, label)
  return { kind: requireExactString(selection.kind, "single-source-loop", `${label} kind`) }
}

/**
 * Closes one transparent, constant-gain pool treatment. The loudness target is
 * the measured median unless true-peak headroom requires a quieter target.
 * @param {unknown} rawLevelMatch
 * @param {Array<{sourceId:string}>} sources
 * @param {string} label
 */
function projectLevelMatch(rawLevelMatch, sources, label) {
  if (rawLevelMatch === null) return null
  const levelMatch = requireRecord(rawLevelMatch, label)
  assertOnlyFields(levelMatch, LEVEL_FIELDS, label)
  if (levelMatch.method !== "ffmpeg-ebur128-v1" ||
      !requireTrimmedString(levelMatch.toolVersion, `${label} tool version`).startsWith("ffmpeg version ") ||
      levelMatch.targetPolicy !== "median-with-true-peak-headroom") {
    throw new Error(`${label} identity is invalid`)
  }
  const target = requireNumber(levelMatch.targetIntegratedLoudnessLufs, -120, 20, `${label} target`)
  if (!Array.isArray(levelMatch.measurements) || levelMatch.measurements.length !== sources.length) {
    throw new Error(`${label} measurements must cover every exact source`)
  }
  const sourceIds = new Set(sources.map(({ sourceId }) => sourceId))
  const measurements = levelMatch.measurements.map((rawMeasurement, index) => {
    const measurementLabel = `${label} measurement ${index}`
    const measurement = requireRecord(rawMeasurement, measurementLabel)
    assertOnlyFields(measurement, LEVEL_MEASUREMENT_FIELDS, measurementLabel)
    const sourceId = requireSha256(measurement.sourceId, `${measurementLabel} source id`)
    if (!sourceIds.has(sourceId)) throw new Error(`${measurementLabel} is outside the exact source pool`)
    const integratedLoudnessLufs = requireNumber(
      measurement.integratedLoudnessLufs,
      -120,
      20,
      `${measurementLabel} integrated loudness`,
    )
    const truePeakDbtp = requireNumber(measurement.truePeakDbtp, -120, 20, `${measurementLabel} true peak`)
    const gainDb = requireNumber(measurement.gainDb, -100, 24, `${measurementLabel} gain`)
    if (gainDb !== round(target - integratedLoudnessLufs, 1) || truePeakDbtp + gainDb > -1 + 1e-9) {
      throw new Error(`${measurementLabel} gain or true-peak headroom is invalid`)
    }
    return {
      sourceId,
      durationSeconds: requireNumber(measurement.durationSeconds, 0.001, 86400, `${measurementLabel} duration`),
      integratedLoudnessLufs,
      truePeakDbtp,
      gainDb,
    }
  })
  if (new Set(measurements.map(({ sourceId }) => sourceId)).size !== sourceIds.size) {
    throw new Error(`${label} measurements repeat or omit a source`)
  }
  const orderedLoudness = measurements
    .map(({ integratedLoudnessLufs }) => integratedLoudnessLufs)
    .sort((left, right) => left - right)
  const middle = Math.floor(orderedLoudness.length / 2)
  const median = orderedLoudness.length % 2 === 0
    ? (orderedLoudness[middle - 1] + orderedLoudness[middle]) / 2
    : orderedLoudness[middle]
  const truePeakSafeCeiling = Math.min(...measurements.map(({ integratedLoudnessLufs, truePeakDbtp }) => (
    integratedLoudnessLufs - 1 - truePeakDbtp
  )))
  if (target !== Math.floor(Math.min(median, truePeakSafeCeiling) * 10) / 10) {
    throw new Error(`${label} target does not match median level with true-peak headroom`)
  }
  return {
    method: levelMatch.method,
    toolVersion: levelMatch.toolVersion,
    targetPolicy: levelMatch.targetPolicy,
    targetIntegratedLoudnessLufs: target,
    measurements,
  }
}

/** @param {unknown[]} rawSources */
function indexDiscoverySources(rawSources) {
  const sources = new Map()
  rawSources.forEach((rawSource, index) => {
    const source = requireRecord(rawSource, `Catalog expansion discovery source ${index}`)
    const sourceId = requireSha256(source.sourceId, `Catalog expansion discovery source ${index} id`)
    const relativePath = requireSafeRelativePath(
      source.relativePath,
      `Catalog expansion discovery source ${index} path`,
    )
    if (sourceId !== sha256(relativePath)) {
      throw new Error(`Catalog expansion source id does not match its path: ${relativePath}`)
    }
    if (sources.has(sourceId)) throw new Error(`Catalog expansion discovery repeats source ${sourceId}`)
    sources.set(sourceId, { sourceId, relativePath })
  })
  return sources
}

/** @param {Array<Record<string, any>>} values @param {string} field @param {string} label */
function assertUnique(values, field, label) {
  const seen = new Set()
  for (const value of values) {
    if (seen.has(value[field])) throw new Error(`${label} ${value[field]} is duplicated`)
    seen.add(value[field])
  }
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
function requireIdentifier(value, label) {
  const id = requireTrimmedString(value, label)
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)) throw new Error(`${label} is invalid`)
  return id
}

/** @param {unknown} value @param {string} label */
function requireSafeRelativePath(value, label) {
  const path = requireTrimmedString(value, label)
  if (path.includes("\\") || path.startsWith("/") || /^[a-z]:/i.test(path) ||
      path.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new Error(`${label} must be a safe relative path`)
  }
  return path
}

/** @param {unknown} value @param {string} label */
function requireSafeRelativePrefix(value, label) {
  const prefix = requireTrimmedString(value, label)
  if (!prefix.endsWith("/")) throw new Error(`${label} must end with a slash`)
  requireSafeRelativePath(prefix.slice(0, -1), label)
  return prefix
}

/** @param {unknown} value @param {RegExp} pattern @param {string} label */
function requirePattern(value, pattern, label) {
  if (typeof value !== "string" || !pattern.test(value)) throw new Error(`${label} is invalid`)
  return value
}

/** @param {unknown} value @param {string} label */
function requireSha256(value, label) {
  if (typeof value !== "string" || !SHA256.test(value)) throw new Error(`${label} is invalid`)
  return value
}

/** @param {unknown} value @param {number} minimum @param {number} maximum @param {string} label */
function requireNumber(value, minimum, maximum, label) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${label} must be between ${minimum} and ${maximum}`)
  }
  return value
}

/** @param {unknown} value @param {number} minimum @param {number} maximum @param {string} label */
function requireInteger(value, minimum, maximum, label) {
  const number = requireNumber(value, minimum, maximum, label)
  if (!Number.isInteger(number)) throw new Error(`${label} must be an integer`)
  return number
}

/** @param {unknown} value @param {string} label */
function requireBoolean(value, label) {
  if (typeof value !== "boolean") throw new Error(`${label} must be a boolean`)
  return value
}

/** @param {unknown} value @param {string} expected @param {string} label */
function requireExactString(value, expected, label) {
  if (value !== expected) throw new Error(`${label} must be ${expected}`)
  return value
}

/** @param {Record<string, any>} record @param {Set<string>} allowed @param {string} label */
function assertOnlyFields(record, allowed, label) {
  const unknown = Object.keys(record).find((field) => !allowed.has(field))
  if (unknown) throw new Error(`${label} contains unknown field ${unknown}`)
}

/** @param {string} left @param {string} right */
function compareText(left, right) {
  return left.toLowerCase().localeCompare(right.toLowerCase(), "en") || left.localeCompare(right, "en")
}

/** @param {any} value @returns {string} */
function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort(compareText).map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`
  }
  return JSON.stringify(value)
}

/** @param {number} value @param {number} digits */
function round(value, digits) {
  return Number(value.toFixed(digits))
}

/** @param {string} value */
function sha256(value) {
  return createHash("sha256").update(value).digest("hex")
}

/** @template T @param {T} value @returns {T} */
function copy(value) {
  return JSON.parse(JSON.stringify(value))
}
