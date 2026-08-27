import {
  createSignatureSoundPreviewAuditionKey,
  validateSignatureSoundPreviewSettings,
} from "./signature-sound-preview.js"

const REVIEW_FIELDS = new Set(["version", "reviewFingerprint", "updatedAt", "groups"])
const ENTRY_FIELDS = new Set([
  "decision", "strategyId", "previewSettings", "sourcePool", "auditionedAt", "auditionKey", "note",
])
const DECISIONS = new Set(["approve", "change"])
const SOURCE_POOLS = new Set(["keep-only", "keep-and-maybe"])
const SHA256_PATTERN = /^[a-f0-9]{64}$/

/**
 * Validates and normalizes the browser-exported strategy review against the
 * exact curation identities it was created from. The review is intentionally
 * sparse so unfinished groups remain distinguishable from approved groups.
 *
 * @param {unknown} rawReview
 * @param {unknown} rawCuration
 */
export function validateSignatureSoundGroupReview(rawReview, rawCuration) {
  const curation = requireRecord(rawCuration, "Signature sound curation")
  const fingerprints = requireRecord(curation.fingerprints, "Signature sound curation fingerprints")
  const curationFingerprint = requireSha256(
    fingerprints.curationSha256,
    "Signature sound curation fingerprint",
  )
  if (!Array.isArray(curation.strategies)) throw new Error("Signature sound curation strategies must be an array")
  if (!Array.isArray(curation.groups)) throw new Error("Signature sound curation groups must be an array")

  const strategyIds = new Set()
  for (const [index, rawStrategy] of curation.strategies.entries()) {
    const strategy = requireRecord(rawStrategy, `Signature sound curation strategy at index ${index}`)
    const strategyId = requireTrimmedString(strategy.id, `Signature sound curation strategy at index ${index} id`)
    if (strategyIds.has(strategyId)) throw new Error(`Duplicate Signature sound curation strategy: ${strategyId}`)
    strategyIds.add(strategyId)
  }
  const groupIds = new Set()
  for (const [index, rawGroup] of curation.groups.entries()) {
    const group = requireRecord(rawGroup, `Signature sound curation group at index ${index}`)
    const groupId = requireTrimmedString(group.groupId, `Signature sound curation group at index ${index} id`)
    if (groupIds.has(groupId)) throw new Error(`Duplicate Signature sound curation group: ${groupId}`)
    groupIds.add(groupId)
  }

  const review = requireRecord(rawReview, "Signature sound group review")
  assertOnlyFields(review, REVIEW_FIELDS, "Signature sound group review")
  if (review.version !== 2) throw new Error("Unsupported Signature sound group review version")
  const reviewFingerprint = requireSha256(review.reviewFingerprint, "Signature sound group review fingerprint")
  if (reviewFingerprint !== curationFingerprint) {
    throw new Error("Signature sound group review fingerprint does not match the curation")
  }
  const updatedAt = requireIsoTimestamp(review.updatedAt, "Signature sound group review update time")
  const rawGroups = requireRecord(review.groups, "Signature sound group review groups")
  const groups = {}
  for (const groupId of Object.keys(rawGroups).sort(compareText)) {
    if (!groupIds.has(groupId)) throw new Error(`Unknown Signature sound group: ${groupId}`)
    const rawEntry = requireRecord(rawGroups[groupId], `Signature sound group review ${groupId}`)
    assertOnlyFields(rawEntry, ENTRY_FIELDS, `Signature sound group review ${groupId}`)
    const strategyId = requireTrimmedString(
      rawEntry.strategyId,
      `Signature sound group review ${groupId} strategy`,
    )
    if (!strategyIds.has(strategyId)) throw new Error(`Unknown Signature sound group strategy: ${strategyId}`)
    const previewSettings = validateSignatureSoundPreviewSettings(strategyId, rawEntry.previewSettings)
    const sourcePool = requireEnum(
      rawEntry.sourcePool,
      SOURCE_POOLS,
      `Signature sound group review ${groupId} source pool`,
    )
    const entry = {
      strategyId,
      previewSettings,
      sourcePool,
      note: requireString(rawEntry.note, `Signature sound group review ${groupId} note`),
    }
    const hasAuditionedAt = hasOwn(rawEntry, "auditionedAt")
    const hasAuditionKey = hasOwn(rawEntry, "auditionKey")
    if (hasAuditionedAt !== hasAuditionKey) {
      throw new Error(`Signature sound group review ${groupId} audition evidence is incomplete`)
    }
    if (hasAuditionedAt) {
      entry.auditionedAt = requireIsoTimestamp(
        rawEntry.auditionedAt,
        `Signature sound group review ${groupId} audition time`,
      )
      entry.auditionKey = requireTrimmedString(
        rawEntry.auditionKey,
        `Signature sound group review ${groupId} audition configuration`,
      )
      const expectedAuditionKey = createSignatureSoundPreviewAuditionKey({
        strategyId,
        sourcePool,
        previewSettings,
      })
      if (entry.auditionKey !== expectedAuditionKey) {
        throw new Error(`Signature sound group review ${groupId} audition configuration is stale`)
      }
    }
    if (hasOwn(rawEntry, "decision")) {
      entry.decision = requireEnum(
        rawEntry.decision,
        DECISIONS,
        `Signature sound group review ${groupId} decision`,
      )
      if (entry.decision === "approve" && !hasAuditionedAt) {
        throw new Error(`Signature sound group review ${groupId} approval requires an audition`)
      }
    }
    groups[groupId] = entry
  }
  return copy({ version: 2, reviewFingerprint, updatedAt, groups })
}

/** @param {unknown} rawReview @param {unknown} rawCuration */
export function renderSignatureSoundGroupReviewJson(rawReview, rawCuration) {
  return `${JSON.stringify(validateSignatureSoundGroupReview(rawReview, rawCuration), null, 2)}\n`
}

function requireRecord(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`)
  }
  return value
}

function assertOnlyFields(value, allowed, label) {
  for (const field of Object.keys(value)) {
    if (!allowed.has(field)) throw new Error(`${label} contains unknown field: ${field}`)
  }
}

function requireString(value, label) {
  if (typeof value !== "string") throw new Error(`${label} must be a string`)
  return value
}

function requireTrimmedString(value, label) {
  const string = requireString(value, label)
  if (string === "" || string !== string.trim()) throw new Error(`${label} must be a non-blank trimmed string`)
  return string
}

function requireSha256(value, label) {
  if (typeof value !== "string" || !SHA256_PATTERN.test(value)) throw new Error(`${label} must be a SHA-256 value`)
  return value
}

function requireIsoTimestamp(value, label) {
  const timestamp = requireTrimmedString(value, label)
  if (Number.isNaN(Date.parse(timestamp)) || new Date(timestamp).toISOString() !== timestamp) {
    throw new Error(`${label} must be a canonical ISO timestamp`)
  }
  return timestamp
}

function requireEnum(value, allowed, label) {
  if (typeof value !== "string" || !allowed.has(value)) throw new Error(`${label} is not supported`)
  return value
}

function hasOwn(value, field) {
  return Object.prototype.hasOwnProperty.call(value, field)
}

function compareText(left, right) {
  const folded = left.toLowerCase().localeCompare(right.toLowerCase(), "en")
  return folded || left.localeCompare(right, "en")
}

function copy(value) {
  return JSON.parse(JSON.stringify(value))
}
