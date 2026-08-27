// @ts-check

import { createHash } from "node:crypto"

import { createSignatureSoundDiscoveryReviewFingerprint } from "./signature-sound-review-fingerprints.js"
import {
  validateMoodistConcepts,
  validateSignatureSoundCandidates,
} from "./sound-catalog.js"
import { validateSignatureSoundScan } from "./signature-sound-scan.js"

const PACK_REVIEW_FIELDS = new Set(["version", "reviewedOn", "packs"])
const PACK_FIELDS = new Set(["packName", "defaultReview", "fileRules"])
const FILE_RULE_FIELDS = new Set(["id", "includesAll", "review"])
const REVIEW_FIELDS = new Set([
  "state", "moodistConceptIds", "signatureExtraConcepts", "confidence", "reason",
])
const EXTRA_FIELDS = new Set(["id", "label"])
const DISCOVERY_FIELDS = new Set(["version", "fingerprints", "summary", "sources"])
const FINGERPRINT_FIELDS = new Set([
  "scanSha256", "moodistSha256", "signatureDeclarationSha256", "packReviewsSha256", "reviewSha256",
])
const SUMMARY_FIELDS = new Set([
  "reviewedPackCount", "audioCount", "candidateSourceCount", "excludedSourceCount",
  "unclassifiedSourceCount", "moodistConceptCountWithProposals", "signatureExtraConceptCount",
  "declaredSourceCount",
])
const SOURCE_FIELDS = new Set([
  "sourceId", "relativePath", "packName", "byteSize", "extension", "sha256", "reviewState",
  "moodistConcepts", "signatureExtraConcepts", "confidence", "reason", "declaredCandidateIds",
])
const MOODIST_REF_FIELDS = new Set(["id", "label", "category"])
const REVIEW_STATES = new Set(["candidate", "excluded", "unclassified"])
const CONFIDENCE_STATES = new Set(["direct", "semantic", "construction", "none"])
const KEBAB_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const SHA256_PATTERN = /^[a-f0-9]{64}$/

export { createSignatureSoundDiscoveryReviewFingerprint } from "./signature-sound-review-fingerprints.js"

/**
 * Validates the human-owned, pack-complete classification rules used to turn
 * the raw Signature inventory into an exhaustive review manifest.
 * @param {unknown} rawReviews
 * @param {unknown} rawMoodistConcepts
 */
export function validateSignatureSoundPackReviews(rawReviews, rawMoodistConcepts) {
  const moodistConcepts = validateMoodistConcepts(rawMoodistConcepts)
  const moodistById = new Map(moodistConcepts.map((concept) => [concept.id, concept]))
  const reviews = requireRecord(rawReviews, "Signature sound pack reviews")
  assertOnlyFields(reviews, PACK_REVIEW_FIELDS, "Signature sound pack reviews")
  if (reviews.version !== 1) throw new Error("Unsupported Signature sound pack review version")
  const reviewedOn = requireString(reviews.reviewedOn, "Signature sound pack review date")
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reviewedOn)) {
    throw new Error("Signature sound pack review date must use YYYY-MM-DD")
  }
  if (!Array.isArray(reviews.packs)) throw new Error("Signature sound pack reviews must be an array")

  const seenPacks = new Set()
  const packs = reviews.packs.map((rawPack, packIndex) => {
    const pack = requireRecord(rawPack, `Signature sound pack review at index ${packIndex}`)
    assertOnlyFields(pack, PACK_FIELDS, `Signature sound pack review at index ${packIndex}`)
    const packName = requireSafePackName(pack.packName, `Signature sound pack at index ${packIndex}`)
    const foldedPack = packName.toLowerCase()
    if (seenPacks.has(foldedPack)) throw new Error(`Duplicate Signature sound pack review: ${packName}`)
    seenPacks.add(foldedPack)
    if (!Array.isArray(pack.fileRules)) throw new Error(`Signature sound pack ${packName} file rules must be an array`)
    const ruleIds = new Set()
    const fileRules = pack.fileRules.map((rawRule, ruleIndex) => {
      const rule = requireRecord(rawRule, `Signature sound pack ${packName} file rule at index ${ruleIndex}`)
      assertOnlyFields(rule, FILE_RULE_FIELDS, `Signature sound pack ${packName} file rule at index ${ruleIndex}`)
      const id = requireKebabId(rule.id, `Signature sound pack ${packName} file rule id`)
      if (ruleIds.has(id)) throw new Error(`Duplicate Signature sound pack ${packName} file rule id: ${id}`)
      ruleIds.add(id)
      if (!Array.isArray(rule.includesAll) || rule.includesAll.length === 0) {
        throw new Error(`Signature sound file rule ${id} includesAll must be a non-empty array`)
      }
      const includesAll = rule.includesAll.map((rawPart, partIndex) => {
        const part = requireString(rawPart, `Signature sound file rule ${id} includesAll at index ${partIndex}`)
        if (part !== part.trim() || part.includes("\\") || part.includes("\0")) {
          throw new Error(`Signature sound file rule ${id} includesAll contains an unsafe path fragment`)
        }
        return part
      })
      if (new Set(includesAll.map((part) => part.toLowerCase())).size !== includesAll.length) {
        throw new Error(`Signature sound file rule ${id} includesAll contains a duplicate fragment`)
      }
      return { id, includesAll, review: normalizeReview(rule.review, moodistById, `file rule ${id}`) }
    })
    return {
      packName,
      defaultReview: normalizeReview(pack.defaultReview, moodistById, `pack ${packName} default`),
      fileRules,
    }
  })
  return { version: 1, reviewedOn, packs }
}

/**
 * Creates a deterministic source-by-source review manifest. Every scanned
 * source is assigned exactly one review state and retains checksum identity.
 * @param {{ scan: unknown, moodistConcepts: unknown, signatureDeclaration: unknown, packReviews: unknown }} input
 */
export function createSignatureSoundDiscoveryReview(input) {
  const scan = validateSignatureSoundScan(input.scan)
  const moodistConcepts = validateMoodistConcepts(input.moodistConcepts)
  const declarationCandidates = validateSignatureSoundCandidates(input.signatureDeclaration, moodistConcepts)
  const packReviews = validateSignatureSoundPackReviews(input.packReviews, moodistConcepts)
  const actualPackNames = [...new Set(scan.audioFiles.map(({ relativePath }) => relativePath.split("/")[0]))]
    .sort(compareText)
  const reviewedPackNames = packReviews.packs.map(({ packName }) => packName).sort(compareText)
  if (reviewedPackNames.length !== scan.directoryPackCount) {
    throw new Error("Signature sound pack review count does not match the scanned top-level pack count")
  }
  if (actualPackNames.some((name) => !reviewedPackNames.includes(name))) {
    const missing = actualPackNames.filter((name) => !reviewedPackNames.includes(name))
    throw new Error(`Signature sound pack review coverage mismatch; missing=${missing.join(",")}`)
  }

  const moodistById = new Map(moodistConcepts.map((concept) => [concept.id, concept]))
  const packByName = new Map(packReviews.packs.map((pack) => [pack.packName, pack]))
  const declarationsByPath = new Map()
  for (const candidate of declarationCandidates) {
    const list = declarationsByPath.get(candidate.discoveryPath) ?? []
    list.push(candidate.id)
    declarationsByPath.set(candidate.discoveryPath, list)
  }

  const sources = scan.audioFiles.map((file) => {
    const packName = file.relativePath.split("/")[0]
    const pack = packByName.get(packName)
    if (pack === undefined) throw new Error(`Missing Signature sound pack review: ${packName}`)
    const foldedPath = file.relativePath.toLowerCase()
    const matchingRules = pack.fileRules.filter((rule) => (
      rule.includesAll.every((part) => foldedPath.includes(part.toLowerCase()))
    ))
    if (matchingRules.length > 1) {
      throw new Error(`Signature sound source matches multiple file review rules: ${file.relativePath}`)
    }
    const review = matchingRules[0]?.review ?? pack.defaultReview
    return {
      sourceId: sha256(file.relativePath),
      relativePath: file.relativePath,
      packName,
      byteSize: file.byteSize,
      extension: file.extension,
      sha256: file.sha256,
      reviewState: review.state,
      moodistConcepts: review.moodistConceptIds.map((id) => {
        const concept = moodistById.get(id)
        if (concept === undefined) throw new Error(`Unknown canonical Moodist concept: ${id}`)
        return { id: concept.id, label: concept.label, category: concept.category }
      }),
      signatureExtraConcepts: review.signatureExtraConcepts.map((extra) => ({ ...extra })),
      confidence: review.confidence,
      reason: review.reason,
      declaredCandidateIds: [...(declarationsByPath.get(file.relativePath) ?? [])].sort(compareText),
    }
  })

  const fingerprints = {
    scanSha256: sha256(stableJson(scan)),
    moodistSha256: sha256(stableJson(moodistConcepts)),
    signatureDeclarationSha256: sha256(stableJson({ version: 1, candidates: declarationCandidates })),
    packReviewsSha256: sha256(stableJson(packReviews)),
    reviewSha256: "",
  }
  const summary = deriveSummary(sources, packReviews.packs.length)
  fingerprints.reviewSha256 = createSignatureSoundDiscoveryReviewFingerprint({
    version: 1,
    fingerprints,
    summary,
    sources,
  })
  return validateSignatureSoundDiscoveryReview({ version: 1, fingerprints, summary, sources }, moodistConcepts)
}

/**
 * Revalidates the generated manifest at its consumer boundary and returns a
 * copy-safe normalized value only when its partition and fingerprint agree.
 * @param {unknown} rawReview
 * @param {unknown} rawMoodistConcepts
 */
export function validateSignatureSoundDiscoveryReview(rawReview, rawMoodistConcepts) {
  const moodistConcepts = validateMoodistConcepts(rawMoodistConcepts)
  const moodistById = new Map(moodistConcepts.map((concept) => [concept.id, concept]))
  const review = requireRecord(rawReview, "Signature sound discovery review")
  assertOnlyFields(review, DISCOVERY_FIELDS, "Signature sound discovery review")
  if (review.version !== 1) throw new Error("Unsupported Signature sound discovery review version")

  const rawFingerprints = requireRecord(review.fingerprints, "Signature sound discovery fingerprints")
  assertOnlyFields(rawFingerprints, FINGERPRINT_FIELDS, "Signature sound discovery fingerprints")
  const fingerprints = Object.fromEntries([...FINGERPRINT_FIELDS].map((field) => [
    field, requireSha256(rawFingerprints[field], `Signature sound discovery ${field}`),
  ]))
  const rawSummary = requireRecord(review.summary, "Signature sound discovery summary")
  assertOnlyFields(rawSummary, SUMMARY_FIELDS, "Signature sound discovery summary")
  const summary = Object.fromEntries([...SUMMARY_FIELDS].map((field) => [
    field, requireCount(rawSummary[field], `Signature sound discovery summary ${field}`),
  ]))
  if (!Array.isArray(review.sources)) throw new Error("Signature sound discovery sources must be an array")
  const ids = new Set()
  const paths = new Set()
  const sources = review.sources.map((rawSource, index) => {
    const source = requireRecord(rawSource, `Signature sound discovery source at index ${index}`)
    assertOnlyFields(source, SOURCE_FIELDS, `Signature sound discovery source at index ${index}`)
    const relativePath = requireRelativePath(source.relativePath, `Signature sound discovery source at index ${index}`)
    const packName = requireSafePackName(source.packName, `Signature sound discovery source pack at index ${index}`)
    if (relativePath.split("/")[0] !== packName) throw new Error(`Signature sound discovery pack mismatch: ${relativePath}`)
    const sourceId = requireSha256(source.sourceId, `Signature sound discovery source id at index ${index}`)
    if (sourceId !== sha256(relativePath)) throw new Error(`Signature sound discovery source id mismatch: ${relativePath}`)
    if (ids.has(sourceId)) throw new Error(`Duplicate Signature sound discovery source id: ${sourceId}`)
    if (paths.has(relativePath.toLowerCase())) throw new Error(`Duplicate Signature sound discovery source path: ${relativePath}`)
    ids.add(sourceId)
    paths.add(relativePath.toLowerCase())
    const reviewState = requireEnum(source.reviewState, REVIEW_STATES, `Signature sound discovery state: ${relativePath}`)
    const confidence = requireEnum(source.confidence, CONFIDENCE_STATES, `Signature sound discovery confidence: ${relativePath}`)
    if (!Array.isArray(source.moodistConcepts) || !Array.isArray(source.signatureExtraConcepts)) {
      throw new Error(`Signature sound discovery concepts must be arrays: ${relativePath}`)
    }
    const moodistConceptRefs = source.moodistConcepts.map((rawConcept, conceptIndex) => {
      const concept = requireRecord(rawConcept, `Signature sound discovery Moodist concept at index ${conceptIndex}`)
      assertOnlyFields(concept, MOODIST_REF_FIELDS, "Signature sound discovery Moodist concept")
      const canonical = moodistById.get(requireKebabId(concept.id, "Signature sound discovery Moodist concept id"))
      if (canonical === undefined || concept.label !== canonical.label || concept.category !== canonical.category) {
        throw new Error(`Signature sound discovery canonical concept mismatch: ${String(concept.id)}`)
      }
      return { id: canonical.id, label: canonical.label, category: canonical.category }
    })
    if (new Set(moodistConceptRefs.map(({ id }) => id)).size !== moodistConceptRefs.length) {
      throw new Error(`Duplicate Signature sound discovery Moodist concept: ${relativePath}`)
    }
    const signatureExtraConcepts = source.signatureExtraConcepts.map((extra, extraIndex) => (
      normalizeExtra(extra, `Signature sound discovery extra at index ${extraIndex}`)
    ))
    if (new Set(signatureExtraConcepts.map(({ id }) => id)).size !== signatureExtraConcepts.length) {
      throw new Error(`Duplicate Signature sound discovery extra concept: ${relativePath}`)
    }
    assertReviewCombination({
      state: reviewState,
      moodistConceptIds: moodistConceptRefs.map(({ id }) => id),
      signatureExtraConcepts,
      confidence,
      reason: requireString(source.reason, `Signature sound discovery reason: ${relativePath}`),
    }, relativePath)
    if (!Number.isSafeInteger(source.byteSize) || source.byteSize < 0) {
      throw new Error(`Signature sound discovery byte size invariant failed: ${relativePath}`)
    }
    const extension = requireString(source.extension, `Signature sound discovery extension: ${relativePath}`)
    if (!/^\.(?:aac|aif|aiff|flac|m4a|mp3|ogg|wav)$/.test(extension)) {
      throw new Error(`Signature sound discovery extension invariant failed: ${relativePath}`)
    }
    if (!relativePath.toLowerCase().endsWith(extension)) {
      throw new Error(`Signature sound discovery extension/path mismatch: ${relativePath}`)
    }
    if (!Array.isArray(source.declaredCandidateIds)) {
      throw new Error(`Signature sound discovery declared candidate ids must be an array: ${relativePath}`)
    }
    const declaredCandidateIds = source.declaredCandidateIds.map((id) => requireKebabId(id, "declared candidate id"))
    if (new Set(declaredCandidateIds).size !== declaredCandidateIds.length) {
      throw new Error(`Duplicate Signature sound discovery declared candidate id: ${relativePath}`)
    }
    return {
      sourceId,
      relativePath,
      packName,
      byteSize: source.byteSize,
      extension,
      sha256: requireSha256(source.sha256, `Signature sound discovery checksum: ${relativePath}`),
      reviewState,
      moodistConcepts: moodistConceptRefs,
      signatureExtraConcepts,
      confidence,
      reason: source.reason,
      declaredCandidateIds,
    }
  })
  const sortedSources = [...sources].sort((left, right) => compareText(left.relativePath, right.relativePath))
  if (stableJson(sources) !== stableJson(sortedSources)) throw new Error("Signature sound discovery source ordering invariant failed")
  const expectedSummary = deriveSummary(sources, summary.reviewedPackCount)
  if (stableJson(summary) !== stableJson(expectedSummary)) throw new Error("Signature sound discovery summary count invariant failed")
  const normalized = { version: 1, fingerprints, summary, sources }
  if (fingerprints.reviewSha256 !== createSignatureSoundDiscoveryReviewFingerprint(normalized)) {
    throw new Error("Signature sound discovery review fingerprint invariant failed")
  }
  return normalized
}

/** @param {unknown} rawReview */
export function renderSignatureSoundDiscoveryJson(rawReview) {
  return `${JSON.stringify(rawReview, null, 2)}\n`
}

function normalizeReview(rawReview, moodistById, label) {
  const review = requireRecord(rawReview, `Signature sound review ${label}`)
  assertOnlyFields(review, REVIEW_FIELDS, `Signature sound review ${label}`)
  const state = requireEnum(review.state, REVIEW_STATES, `Signature sound review ${label} state`)
  const confidence = requireEnum(review.confidence, CONFIDENCE_STATES, `Signature sound review ${label} confidence`)
  if (!Array.isArray(review.moodistConceptIds) || !Array.isArray(review.signatureExtraConcepts)) {
    throw new Error(`Signature sound review ${label} concept fields must be arrays`)
  }
  const moodistConceptIds = review.moodistConceptIds.map((id) => {
    const normalizedId = requireKebabId(id, `Signature sound review ${label} Moodist concept id`)
    if (!moodistById.has(normalizedId)) throw new Error(`Unknown canonical Moodist concept: ${normalizedId}`)
    return normalizedId
  })
  if (new Set(moodistConceptIds).size !== moodistConceptIds.length) {
    throw new Error(`Signature sound review ${label} contains a duplicate Moodist concept`)
  }
  const signatureExtraConcepts = review.signatureExtraConcepts.map((extra, index) => (
    normalizeExtra(extra, `Signature sound review ${label} extra at index ${index}`)
  ))
  if (new Set(signatureExtraConcepts.map(({ id }) => id)).size !== signatureExtraConcepts.length) {
    throw new Error(`Signature sound review ${label} contains a duplicate extra concept`)
  }
  const normalized = {
    state,
    moodistConceptIds,
    signatureExtraConcepts,
    confidence,
    reason: requireString(review.reason, `Signature sound review ${label} reason`),
  }
  assertReviewCombination(normalized, label)
  return normalized
}

function normalizeExtra(rawExtra, label) {
  const extra = requireRecord(rawExtra, label)
  assertOnlyFields(extra, EXTRA_FIELDS, label)
  return {
    id: requireKebabId(extra.id, `${label} id`),
    label: requireString(extra.label, `${label} label`),
  }
}

function assertReviewCombination(review, label) {
  const conceptCount = review.moodistConceptIds.length + review.signatureExtraConcepts.length
  if (review.state === "candidate") {
    if (conceptCount === 0) throw new Error(`Signature sound candidate review ${label} requires a proposed concept`)
    if (review.confidence === "none") throw new Error(`Signature sound candidate review ${label} requires confidence`)
  } else {
    if (conceptCount !== 0) throw new Error(`Signature sound ${review.state} review ${label} cannot propose a concept`)
    if (review.confidence !== "none") throw new Error(`Signature sound ${review.state} review ${label} must use none confidence`)
  }
}

function deriveSummary(sources, reviewedPackCount) {
  const moodistIds = new Set()
  const extraIds = new Set()
  let candidateSourceCount = 0
  let excludedSourceCount = 0
  let unclassifiedSourceCount = 0
  let declaredSourceCount = 0
  for (const source of sources) {
    if (source.reviewState === "candidate") candidateSourceCount += 1
    else if (source.reviewState === "excluded") excludedSourceCount += 1
    else unclassifiedSourceCount += 1
    for (const concept of source.moodistConcepts) moodistIds.add(concept.id)
    for (const extra of source.signatureExtraConcepts) extraIds.add(extra.id)
    if (source.declaredCandidateIds.length > 0) declaredSourceCount += 1
  }
  return {
    reviewedPackCount,
    audioCount: sources.length,
    candidateSourceCount,
    excludedSourceCount,
    unclassifiedSourceCount,
    moodistConceptCountWithProposals: moodistIds.size,
    signatureExtraConceptCount: extraIds.size,
    declaredSourceCount,
  }
}

function stableJson(value) {
  return JSON.stringify(sortValue(value))
}

function sortValue(value) {
  if (Array.isArray(value)) return value.map(sortValue)
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value)
      .filter(([, child]) => child !== undefined)
      .sort(([left], [right]) => left.localeCompare(right, "en"))
      .map(([key, child]) => [key, sortValue(child)]))
  }
  return value
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex")
}

function requireRecord(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new TypeError(`${label} must be an object`)
  return /** @type {Record<string, any>} */ (value)
}

function assertOnlyFields(record, allowed, label) {
  const unknown = Object.keys(record).filter((field) => !allowed.has(field))
  if (unknown.length > 0) throw new Error(`${label} contains unknown field: ${unknown.join(", ")}`)
  const missing = [...allowed].filter((field) => !Object.hasOwn(record, field))
  if (missing.length > 0) throw new Error(`${label} is missing field: ${missing.join(", ")}`)
}

function requireString(value, label) {
  if (typeof value !== "string" || value.length === 0 || value !== value.trim()) throw new Error(`${label} must be a non-blank trimmed string`)
  return value
}

function requireSafePackName(value, label) {
  const name = requireString(value, label)
  if (name.includes("/") || name.includes("\\") || name === "." || name === "..") throw new Error(`${label} must be a top-level pack name`)
  return name
}

function requireKebabId(value, label) {
  const id = requireString(value, label)
  if (!KEBAB_ID_PATTERN.test(id)) throw new Error(`${label} must be a canonical kebab-case id`)
  return id
}

function requireRelativePath(value, label) {
  const path = requireString(value, label)
  if (path.includes("\\") || path.startsWith("/") || /^[a-z]:/i.test(path) || path.split("/").some((part) => part === "" || part === "." || part === "..")) {
    throw new Error(`${label} must be a safe relative path`)
  }
  return path
}

function requireSha256(value, label) {
  if (typeof value !== "string" || !SHA256_PATTERN.test(value)) throw new Error(`${label} must be a SHA-256 digest`)
  return value
}

function requireCount(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a non-negative integer count`)
  return value
}

function requireEnum(value, allowed, label) {
  if (typeof value !== "string" || !allowed.has(value)) throw new Error(`${label} is invalid`)
  return value
}

function compareText(left, right) {
  const foldedLeft = left.toLowerCase()
  const foldedRight = right.toLowerCase()
  if (foldedLeft < foldedRight) return -1
  if (foldedLeft > foldedRight) return 1
  if (left < right) return -1
  if (left > right) return 1
  return 0
}
