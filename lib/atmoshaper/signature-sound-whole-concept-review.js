// @ts-check

import { createHash } from "node:crypto"

import {
  createSignatureSoundConstructionReviewFingerprint,
  createSignatureSoundDiscoveryReviewFingerprint,
} from "./signature-sound-review-fingerprints.js"
import {
  validateSignatureSoundConstructionPlaybackPolicy,
  validateSignatureSoundPreviewSettings,
} from "./signature-sound-preview.js"

const SHA256 = /^[a-f0-9]{64}$/
const BATCH_ID = /^batch-[0-9]{2}-[a-z0-9]+(?:-[a-z0-9]+)*$/
const CATALOG_FIELDS = new Set(["version", "reviewKind", "constructionReviewSha256", "entries"])
const ENTRY_FIELDS = new Set(["batchId", "groupId"])
const PLAYBACK_FIELDS = new Set([
  "strategyId", "previewSettings", "minimumSelectionsBeforeRepeat", "constraints",
])
const TRANSITION_RANGE_FIELDS = new Set(["type", "minimumSeconds", "maximumSeconds"])
const OVERLAP_FIELDS = new Set(["type"])

/** @typedef {{batchId: string, groupId: string}} WholeConceptReviewIdentity */
/** @typedef {{sourceId: string, relativePath: string}} WholeConceptReviewSource */
/**
 * @typedef {object} WholeConceptReviewContext
 * @property {string} constructionReviewSha256
 * @property {string} discoveryReviewSha256
 * @property {Record<string, any>} constructionReview
 * @property {Record<string, any>} discoveryReview
 * @property {Map<string, Record<string, any>>} groupById
 * @property {Map<string, WholeConceptReviewSource>} sourceById
 */

/**
 * Validates the closed morning queue and projects each entry from the exact
 * construction and discovery owners. The catalog stores identities only, so
 * source paths and playback details cannot silently diverge from those owners.
 * @param {unknown} rawCatalog
 * @param {unknown} rawContext
 */
export function validateSignatureSoundWholeConceptReviewCatalog(rawCatalog, rawContext) {
  const catalog = requireRecord(rawCatalog, "Whole-concept review catalog")
  assertOnlyFields(catalog, CATALOG_FIELDS, "Whole-concept review catalog")
  if (catalog.version !== 1 || catalog.reviewKind !== "whole-concept-review-batches") {
    throw new Error("Whole-concept review catalog identity is invalid")
  }
  const constructionReviewSha256 = requireSha256(
    catalog.constructionReviewSha256,
    "Whole-concept review construction fingerprint",
  )
  if (!Array.isArray(catalog.entries) || catalog.entries.length === 0) {
    throw new Error("Whole-concept review catalog entries must be a non-empty array")
  }

  const context = normalizeContext(rawContext)
  if (constructionReviewSha256 !== context.constructionReviewSha256) {
    throw new Error("Whole-concept review catalog construction fingerprint is stale")
  }

  const identities = catalog.entries.map((rawEntry, index) => normalizeEntry(rawEntry, index))
  assertUniqueIdentities(identities)
  const entries = identities.map((identity) => projectEntry(identity, context))
  verifyOwnerFingerprints(context)

  return copy({
    version: 1,
    reviewKind: "whole-concept-review-batches",
    constructionReviewSha256,
    entries,
  })
}

/** @param {unknown} rawContext @returns {WholeConceptReviewContext} */
function normalizeContext(rawContext) {
  const context = requireRecord(rawContext, "Whole-concept review context")
  const constructionReview = requireRecord(
    context.constructionReview,
    "Whole-concept construction review",
  )
  const discoveryReview = requireRecord(
    context.discoveryReview,
    "Whole-concept discovery review",
  )
  const constructionFingerprints = requireRecord(
    constructionReview.fingerprints,
    "Whole-concept construction fingerprints",
  )
  const discoveryFingerprints = requireRecord(
    discoveryReview.fingerprints,
    "Whole-concept discovery fingerprints",
  )
  const constructionReviewSha256 = requireSha256(
    constructionFingerprints.constructionReviewSha256,
    "Whole-concept construction review fingerprint",
  )
  const constructionDiscoverySha256 = requireSha256(
    constructionFingerprints.discoveryReviewSha256,
    "Whole-concept construction discovery fingerprint",
  )
  const discoveryReviewSha256 = requireSha256(
    discoveryFingerprints.reviewSha256,
    "Whole-concept discovery review fingerprint",
  )
  if (constructionDiscoverySha256 !== discoveryReviewSha256) {
    throw new Error("Whole-concept discovery fingerprint is stale")
  }
  if (!Array.isArray(constructionReview.groups) || !Array.isArray(discoveryReview.sources)) {
    throw new Error("Whole-concept review owners must expose groups and sources")
  }

  return {
    constructionReviewSha256,
    discoveryReviewSha256,
    constructionReview,
    discoveryReview,
    groupById: indexGroups(constructionReview.groups),
    sourceById: indexSources(discoveryReview.sources),
  }
}

/** @param {unknown} rawEntry @param {number} index */
function normalizeEntry(rawEntry, index) {
  const label = `Whole-concept review catalog entry ${index}`
  const entry = requireRecord(rawEntry, label)
  assertOnlyFields(entry, ENTRY_FIELDS, label)
  return {
    batchId: requirePattern(entry.batchId, BATCH_ID, `${label} batch id`),
    groupId: requireTrimmedString(entry.groupId, `${label} group id`),
  }
}

/**
 * @param {WholeConceptReviewIdentity} identity
 * @param {WholeConceptReviewContext} context
 */
function projectEntry(identity, context) {
  const rawGroup = context.groupById.get(identity.groupId)
  if (!rawGroup) throw new Error(`Whole-concept review group is unknown: ${identity.groupId}`)
  const group = requireEligibleGroup(rawGroup, identity.groupId)
  const includedSourceIds = /** @type {unknown[]} */ (group.includedSourceIds)
  const sources = includedSourceIds.map((sourceId, index) => {
    const normalizedSourceId = requireSha256(
      sourceId,
      `Whole-concept review ${identity.groupId} source ${index}`,
    )
    const source = context.sourceById.get(normalizedSourceId)
    if (!source) {
      throw new Error(`Whole-concept review ${identity.groupId} source is unknown: ${normalizedSourceId}`)
    }
    return { sourceId: normalizedSourceId, relativePath: source.relativePath }
  })
  if (new Set(sources.map(({ sourceId }) => sourceId)).size !== sources.length) {
    throw new Error(`Whole-concept review ${identity.groupId} contains a duplicate source`)
  }

  const playbackConfiguration = projectPlaybackConfiguration(group.playback, identity.groupId)
  const entryWithoutFingerprint = {
    batchId: identity.batchId,
    groupId: identity.groupId,
    label: requireTrimmedString(group.label, `Whole-concept review ${identity.groupId} label`),
    sources,
    playbackConfiguration,
  }
  const reviewFingerprint = sha256(stableJson({
    reviewKind: "whole-concept-review-entry",
    constructionReviewSha256: context.constructionReviewSha256,
    ...entryWithoutFingerprint,
  }))
  return { ...entryWithoutFingerprint, reviewFingerprint }
}

/** @param {Record<string, any>} group @param {string} groupId */
function requireEligibleGroup(group, groupId) {
  if (group.status !== "active") {
    throw new Error(`Whole-concept review ${groupId} is not an active eligible group`)
  }
  if (group.reviewState !== "accepted") {
    throw new Error(`Whole-concept review ${groupId} must be accepted to be eligible`)
  }
  if (!Array.isArray(group.includedSourceIds) || group.includedSourceIds.length === 0) {
    throw new Error(`Whole-concept review ${groupId} needs a non-empty eligible source pool`)
  }
  if (containsAnyIntent(group.processingIntents, `${groupId} group processing intents`) ||
      sourceOverridesContainAnyIntent(group.sourceOverrides, groupId)) {
    throw new Error(`Whole-concept review ${groupId} has pending processing and is not eligible`)
  }
  return group
}

/** @param {unknown} rawPlayback @param {string} groupId */
function projectPlaybackConfiguration(rawPlayback, groupId) {
  const playback = requireRecord(rawPlayback, `Whole-concept review ${groupId} playback`)
  assertOnlyFields(playback, PLAYBACK_FIELDS, `Whole-concept review ${groupId} playback`)
  const strategyId = requireTrimmedString(
    playback.strategyId,
    `Whole-concept review ${groupId} strategy`,
  )
  const previewSettings = validateSignatureSoundPreviewSettings(strategyId, playback.previewSettings)
  if (!Array.isArray(playback.constraints)) {
    throw new Error(`Whole-concept review ${groupId} playback constraints must be an array`)
  }
  const constraints = playback.constraints.map((rawConstraint, index) => {
    const label = `Whole-concept review ${groupId} playback constraint ${index}`
    const constraint = requireRecord(rawConstraint, label)
    if (constraint.type === "transition-duration-range") {
      assertOnlyFields(constraint, TRANSITION_RANGE_FIELDS, label)
      return constraint
    }
    if (constraint.type === "overlap-next-event") {
      assertOnlyFields(constraint, OVERLAP_FIELDS, label)
      return constraint
    }
    throw new Error(`${label} is unsupported`)
  })
  const transitionRanges = constraints.filter(({ type }) => type === "transition-duration-range")
  if (transitionRanges.length > 1) {
    throw new Error(`Whole-concept review ${groupId} has duplicate transition-duration constraints`)
  }
  const overlaps = constraints.filter(({ type }) => type === "overlap-next-event")
  if (overlaps.length > 1) {
    throw new Error(`Whole-concept review ${groupId} has duplicate overlap-next-event constraints`)
  }
  const constructionPolicy = validateSignatureSoundConstructionPlaybackPolicy(
    strategyId,
    previewSettings,
    {
      minimumSelectionsBeforeRepeat: playback.minimumSelectionsBeforeRepeat,
      transitionDurationRange: transitionRanges[0]
        ? {
            minimumSeconds: transitionRanges[0].minimumSeconds,
            maximumSeconds: transitionRanges[0].maximumSeconds,
          }
        : null,
      cadenceBoundary: null,
      overlapNextEvent: overlaps.length === 1,
    },
  )
  return { strategyId, previewSettings, constructionPolicy }
}

/**
 * Recomputes both canonical owner hashes after entry-level validation. Deferring
 * this check preserves a precise unknown-source error while still rejecting
 * any otherwise well-formed label, path, playback, summary, or source drift.
 * @param {WholeConceptReviewContext} context
 */
function verifyOwnerFingerprints(context) {
  if (createSignatureSoundConstructionReviewFingerprint(context.constructionReview) !==
      context.constructionReviewSha256) {
    throw new Error("Whole-concept construction owner content fingerprint is stale")
  }

  if (createSignatureSoundDiscoveryReviewFingerprint(context.discoveryReview) !==
      context.discoveryReviewSha256) {
    throw new Error("Whole-concept discovery owner content fingerprint is stale")
  }
}

/** @param {unknown} rawIntents @param {string} label */
function containsAnyIntent(rawIntents, label) {
  if (!Array.isArray(rawIntents)) throw new Error(`${label} must be an array`)
  return rawIntents.length > 0
}

/** @param {unknown} rawOverrides @param {string} groupId */
function sourceOverridesContainAnyIntent(rawOverrides, groupId) {
  const overrides = requireRecord(rawOverrides, `Whole-concept review ${groupId} source overrides`)
  return Object.entries(overrides).some(([sourceId, intents]) => {
    requireSha256(sourceId, `Whole-concept review ${groupId} source override id`)
    return containsAnyIntent(intents, `Whole-concept review ${groupId} source override ${sourceId}`)
  })
}

/** @param {unknown[]} rawGroups */
function indexGroups(rawGroups) {
  /** @type {Map<string, Record<string, any>>} */
  const groups = new Map()
  rawGroups.forEach((rawGroup, index) => {
    const group = requireRecord(rawGroup, `Whole-concept construction group ${index}`)
    const groupId = requireTrimmedString(group.groupId, `Whole-concept construction group ${index} id`)
    if (groups.has(groupId)) throw new Error(`Whole-concept construction contains duplicate group ${groupId}`)
    groups.set(groupId, group)
  })
  return groups
}

/** @param {unknown[]} rawSources */
function indexSources(rawSources) {
  /** @type {Map<string, {sourceId: string, relativePath: string}>} */
  const sources = new Map()
  rawSources.forEach((rawSource, index) => {
    const source = requireRecord(rawSource, `Whole-concept discovery source ${index}`)
    const sourceId = requireSha256(source.sourceId, `Whole-concept discovery source ${index} id`)
    const relativePath = requireSafeRelativePath(
      source.relativePath,
      `Whole-concept discovery source ${sourceId} path`,
    )
    if (sourceId !== sha256(relativePath)) {
      throw new Error(`Whole-concept discovery source id does not match path SHA-256: ${relativePath}`)
    }
    if (sources.has(sourceId)) throw new Error(`Whole-concept discovery contains duplicate source ${sourceId}`)
    sources.set(sourceId, {
      sourceId,
      relativePath,
    })
  })
  return sources
}

/** @param {{batchId: string, groupId: string}[]} entries */
function assertUniqueIdentities(entries) {
  const batchIds = new Set()
  const groupIds = new Set()
  for (const entry of entries) {
    if (batchIds.has(entry.batchId)) throw new Error(`Whole-concept review duplicate batch ${entry.batchId}`)
    if (groupIds.has(entry.groupId)) throw new Error(`Whole-concept review duplicate group ${entry.groupId}`)
    batchIds.add(entry.batchId)
    groupIds.add(entry.groupId)
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
function requireSafeRelativePath(value, label) {
  const path = requireTrimmedString(value, label)
  if (path.includes("\\") || path.startsWith("/") || /^[a-z]:/i.test(path) ||
      path.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new Error(`${label} must be a safe relative path`)
  }
  return path
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

/** @param {Record<string, any>} record @param {Set<string>} allowed @param {string} label */
function assertOnlyFields(record, allowed, label) {
  const unknown = Object.keys(record).find((field) => !allowed.has(field))
  if (unknown) throw new Error(`${label} contains unknown field ${unknown}`)
}

/**
 * Produces stable JSON so reviewer fingerprints ignore object key insertion order.
 * @param {any} value
 * @returns {string}
 */
function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort(compareText).map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`
  }
  return JSON.stringify(value)
}

/** @param {string} left @param {string} right @returns {number} */
function compareText(left, right) {
  return left.toLowerCase().localeCompare(right.toLowerCase(), "en")
    || left.localeCompare(right, "en")
}

/** @param {string} value */
function sha256(value) {
  return createHash("sha256").update(value).digest("hex")
}

/** @template T @param {T} value @returns {T} */
function copy(value) {
  return JSON.parse(JSON.stringify(value))
}
