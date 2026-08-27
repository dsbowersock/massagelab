// @ts-check

import { createHash } from "node:crypto"
import { createReadStream } from "node:fs"
import { readdir, stat } from "node:fs/promises"
import { basename, extname, isAbsolute, relative, resolve } from "node:path"
import {
  classifySignatureSoundCandidateSemantics,
  deriveSignatureSoundProcessingPlanCandidates,
  deriveSignatureSoundCatalog,
  getCanonicalMoodistConceptProjection,
  isSignatureSoundProcessingPlanEligible,
  validateMoodistConcepts,
  validateSignatureSoundCandidates,
} from "./sound-catalog.js"

const AUDIO_EXTENSIONS = new Set([
  ".aac", ".aif", ".aiff", ".flac", ".m4a", ".mp3", ".ogg", ".wav",
])
const SIGNATURE_SITEWIDE_CC0_URL = "https://signaturesounds.org/about-"
const CATEGORY_ORDER = ["animals", "nature", "noise", "places", "rain", "things", "transport", "urban"]
const AUDIT_FIELDS = new Set(["version", "fingerprints", "scan", "machineMetadata", "outcomes"])
const FINGERPRINT_FIELDS = new Set([
  "scanAudioInventorySha256", "moodistInventorySha256", "signatureDeclarationSha256",
])
const SCAN_FIELDS = new Set([
  "directoryPackCount", "audioCount", "totalBytes", "extensionCounts", "duplicateGroups", "audioFiles",
])
const AUDIO_FILE_FIELDS = new Set(["relativePath", "byteSize", "extension", "sha256"])
const DUPLICATE_GROUP_FIELDS = new Set(["sha256", "relativePaths"])
const MACHINE_METADATA_FIELDS = new Set(["processingPlanEligibleCandidates"])
const OUTCOME_FIELDS = new Set([
  "qualifiedMoodistMatches", "needsAuditionOrProcessing", "recordingOrSourceGaps", "signatureOnlyConceptCandidates",
])
const ENRICHED_CANDIDATE_FIELDS = new Set([
  "id", "conceptId", "conceptName", "category", "discoveryPath", "evidenceTier", "evidenceRef",
  "byteSize", "sha256", "technicalState", "listeningState", "processingState", "rejectionState", "rejectionReason",
])
const GAP_FIELDS = new Set(["id", "label", "category", "upstreamAssetRef"])
const EVIDENCE_TIERS = new Set(["explicit-pack-cc0", "signature-sitewide-cc0", "needs-origin-review"])
const REVIEW_STATES = new Set(["pending", "pass", "fail"])
const PROCESSING_STATES = new Set(["pending", "verified", "failed"])
const REJECTION_STATES = new Set(["active", "rejected"])
const KEBAB_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const SHA256_PATTERN = /^[a-f0-9]{64}$/
const CANONICAL_MOODIST_CONCEPTS = getCanonicalMoodistConceptProjection()
const CANONICAL_MOODIST_BY_ID = new Map(CANONICAL_MOODIST_CONCEPTS.map((concept) => [concept.id, concept]))
const CANONICAL_MOODIST_LABELS = new Set(CANONICAL_MOODIST_CONCEPTS.map(({ label }) => label.toLowerCase()))
const CANONICAL_SIGNATURE_REQUIRED_IDS = new Set(CANONICAL_MOODIST_CONCEPTS
  .filter(({ sourceStrategy }) => sourceStrategy === "signature-required")
  .map(({ id }) => id))

/** @typedef {{ relativePath: string, byteSize: number, extension: string, sha256: string }} ScannedAudioFile */
/** @typedef {{ sha256: string, relativePaths: string[] }} DuplicateGroup */
/** @typedef {{ directoryPackCount: number, audioCount: number, totalBytes: number, extensionCounts: Record<string, number>, duplicateGroups: DuplicateGroup[], audioFiles: ScannedAudioFile[] }} SignatureSoundScan */

/**
 * Scans a Signature Sounds root without exposing its machine-specific location.
 * Files are hashed sequentially so even large packs have bounded memory use.
 * @param {string} rootPath
 * @returns {Promise<SignatureSoundScan>}
 */
export async function scanSignatureSoundRoot(rootPath) {
  const absoluteRoot = await requireDirectoryRoot(rootPath)
  /** @type {ScannedAudioFile[]} */
  const audioFiles = []
  let directoryPackCount = 0

  /** @param {string} directory @param {string[]} segments @param {boolean} isRoot */
  async function visit(directory, segments, isRoot) {
    let entries
    try {
      entries = await readdir(directory, { withFileTypes: true })
    } catch {
      const label = segments.length === 0 ? "scan root" : segments.join("/")
      throw new Error(`Could not read Signature sound ${label}`)
    }
    entries.sort((left, right) => compareText(left.name, right.name))

    for (const entry of entries) {
      if (entry.name.toLowerCase() === "__macosx") continue
      const nextSegments = [...segments, entry.name]
      const relativePath = nextSegments.join("/")
      const absolutePath = resolve(directory, entry.name)
      if (entry.isDirectory()) {
        if (isRoot) directoryPackCount += 1
        await visit(absolutePath, nextSegments, false)
        continue
      }
      if (!entry.isFile() || entry.name.startsWith("._")) continue

      const extension = extname(entry.name).toLowerCase()
      if (!AUDIO_EXTENSIONS.has(extension)) continue
      let fileStats
      let sha256
      try {
        fileStats = await stat(absolutePath)
        sha256 = await hashFile(absolutePath)
      } catch {
        throw new Error(`Could not inspect Signature sound audio: ${relativePath}`)
      }
      audioFiles.push({
        relativePath,
        byteSize: fileStats.size,
        extension,
        sha256,
      })
    }
  }

  await visit(absoluteRoot, [], true)
  audioFiles.sort((left, right) => compareRelativePaths(left.relativePath, right.relativePath))
  const aggregates = deriveScanAggregates(audioFiles)
  return {
    directoryPackCount,
    ...aggregates,
    audioFiles,
  }
}

/**
 * Runs a fresh scan and resolves the declaration against the exact bytes found.
 * @param {{ rootPath: string, moodistConcepts: unknown, signatureDeclaration: unknown }} input
 */
export async function createSignatureSoundAudit(input) {
  const absoluteRoot = await requireDirectoryRoot(input.rootPath)
  const scan = await scanSignatureSoundRoot(absoluteRoot)
  return buildSignatureSoundAudit({
    scan,
    evidenceRoot: absoluteRoot,
    moodistConcepts: input.moodistConcepts,
    signatureDeclaration: input.signatureDeclaration,
  })
}

/**
 * Validates scan invariants, evidence, checksums, and Task 1 outcome gates.
 * This separate pure-ish assembly boundary lets synthetic collision fixtures
 * cover cases that a case-insensitive development filesystem cannot create.
 * @param {{ scan: unknown, evidenceRoot: string, moodistConcepts: unknown, signatureDeclaration: unknown }} input
 */
export async function buildSignatureSoundAudit(input) {
  const scan = validateSignatureSoundScan(input.scan)
  const absoluteRoot = await requireDirectoryRoot(input.evidenceRoot)
  const moodistConcepts = validateMoodistConcepts(input.moodistConcepts)
  const candidates = validateSignatureSoundCandidates(input.signatureDeclaration, moodistConcepts)
  const outcomes = deriveSignatureSoundCatalog(moodistConcepts, input.signatureDeclaration)
  const processingPlanCandidates = deriveSignatureSoundProcessingPlanCandidates(
    moodistConcepts,
    input.signatureDeclaration,
  )
  const moodistById = new Map(moodistConcepts.map((concept) => [concept.id, concept]))
  const scannedByPath = new Map()

  for (const audioFile of scan.audioFiles) {
    const key = audioFile.relativePath.toLowerCase()
    const matches = scannedByPath.get(key) ?? []
    matches.push(audioFile)
    scannedByPath.set(key, matches)
  }

  const enrichedById = new Map()
  for (const candidate of candidates) {
    const discoveryPath = normalizeSafeRelativePath(candidate.discoveryPath, `candidate ${candidate.id} discovery path`)
    const matches = scannedByPath.get(discoveryPath.toLowerCase()) ?? []
    if (matches.length === 0) {
      throw new Error(`Signature candidate ${candidate.id} declared audio path was not found`)
    }
    if (matches.length !== 1) {
      throw new Error(`Signature candidate ${candidate.id} has a case-insensitive audio path collision`)
    }
    const audioFile = matches[0]
    await verifyAudioIntegrity(absoluteRoot, audioFile, candidate.id)
    const evidenceRef = await validateEvidence(absoluteRoot, candidate)
    const moodistConcept = candidate.moodistConceptId === undefined
      ? undefined
      : moodistById.get(candidate.moodistConceptId)
    enrichedById.set(candidate.id, {
      id: candidate.id,
      conceptId: candidate.moodistConceptId ?? candidate.proposedExtraConceptId,
      conceptName: moodistConcept?.label ?? candidate.proposedExtraConceptName,
      category: moodistConcept?.category ?? null,
      discoveryPath: audioFile.relativePath,
      evidenceTier: candidate.evidenceTier,
      evidenceRef,
      byteSize: audioFile.byteSize,
      sha256: audioFile.sha256,
      technicalState: candidate.technicalState,
      listeningState: candidate.listeningState,
      processingState: candidate.processingState,
      rejectionState: candidate.rejectionState,
      rejectionReason: candidate.rejectionReason,
    })
  }

  const enrich = (candidate) => {
    const enriched = enrichedById.get(candidate.id)
    if (enriched === undefined) throw new Error(`Signature candidate ${candidate.id} outcome invariant failed`)
    return enriched
  }
  const sortCandidates = (items) => [...items].sort((left, right) => (
    compareText(left.conceptName, right.conceptName)
      || compareRelativePaths(left.discoveryPath, right.discoveryPath)
      || compareText(left.id, right.id)
  ))

  return validateSignatureSoundAudit({
    version: 1,
    fingerprints: {
      scanAudioInventorySha256: fingerprintCanonicalJson(scan.audioFiles),
      moodistInventorySha256: fingerprintCanonicalJson(moodistConcepts),
      signatureDeclarationSha256: fingerprintCanonicalJson({ version: 1, candidates }),
    },
    scan,
    machineMetadata: {
      processingPlanEligibleCandidates: sortCandidates(processingPlanCandidates.map(enrich)),
    },
    outcomes: {
      qualifiedMoodistMatches: sortCandidates(outcomes.qualifiedMoodistMatches.map(enrich)),
      needsAuditionOrProcessing: sortCandidates(outcomes.needsAuditionOrProcessing.map(enrich)),
      recordingOrSourceGaps: outcomes.recordingOrSourceGaps.map((concept) => ({
        id: concept.id,
        label: concept.label,
        category: concept.category,
        upstreamAssetRef: concept.upstreamAssetRef,
      })),
      signatureOnlyConceptCandidates: sortCandidates(outcomes.signatureExtraConcepts.map(enrich)),
    },
  })
}

/** @param {unknown} rawScan @returns {SignatureSoundScan} */
export function validateSignatureSoundScan(rawScan) {
  const scan = requireRecord(rawScan, "Signature sound scan")
  assertOnlyFields(scan, SCAN_FIELDS, "Signature sound scan")
  if (!Number.isInteger(scan.directoryPackCount) || scan.directoryPackCount < 0) {
    throw new Error("Signature sound directory pack count invariant failed")
  }
  if (!Array.isArray(scan.audioFiles)) {
    throw new Error("Signature sound audio file inventory invariant failed")
  }

  /** @type {ScannedAudioFile[]} */
  const audioFiles = scan.audioFiles.map((rawFile, index) => {
    const file = requireRecord(rawFile, `Signature sound audio at index ${index}`)
    assertOnlyFields(file, AUDIO_FILE_FIELDS, `Signature sound audio at index ${index}`)
    const relativePath = normalizeSafeRelativePath(file.relativePath, `audio at index ${index}`)
    if (relativePath !== file.relativePath) {
      throw new Error(`Signature sound audio path normalization invariant failed: ${relativePath}`)
    }
    if (relativePath.split("/").some((segment) => segment.toLowerCase() === "__macosx")) {
      throw new Error(`Signature sound exclusion invariant failed: ${relativePath}`)
    }
    if (basename(relativePath).startsWith("._")) {
      throw new Error(`Signature sound resource-fork exclusion invariant failed: ${relativePath}`)
    }
    const extension = extname(relativePath).toLowerCase()
    if (!AUDIO_EXTENSIONS.has(extension) || file.extension !== extension) {
      throw new Error(`Signature sound extension invariant failed: ${relativePath}`)
    }
    if (!Number.isSafeInteger(file.byteSize) || file.byteSize < 0) {
      throw new Error(`Signature sound byte-size invariant failed: ${relativePath}`)
    }
    if (typeof file.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(file.sha256)) {
      throw new Error(`Signature sound checksum invariant failed: ${relativePath}`)
    }
    return {
      relativePath,
      byteSize: file.byteSize,
      extension,
      sha256: file.sha256,
    }
  })

  const sortedAudioFiles = [...audioFiles].sort((left, right) => (
    compareRelativePaths(left.relativePath, right.relativePath)
  ))
  if (!sameJson(audioFiles, sortedAudioFiles)) {
    throw new Error("Signature sound audio ordering invariant failed")
  }
  const exactPaths = new Set()
  const foldedPaths = new Map()
  for (const file of audioFiles) {
    if (exactPaths.has(file.relativePath)) {
      throw new Error(`Duplicate Signature sound audio path: ${file.relativePath}`)
    }
    exactPaths.add(file.relativePath)
    const foldedPath = file.relativePath.toLowerCase()
    if (foldedPaths.has(foldedPath)) {
      throw new Error(`Signature sound case-insensitive audio path collision: ${file.relativePath}`)
    }
    foldedPaths.set(foldedPath, file.relativePath)
  }

  const expected = deriveScanAggregates(audioFiles)
  if (!Array.isArray(scan.duplicateGroups)) {
    throw new Error("Signature sound duplicate group invariant failed")
  }
  for (const [index, rawGroup] of scan.duplicateGroups.entries()) {
    const group = requireRecord(rawGroup, `Signature sound duplicate group at index ${index}`)
    assertOnlyFields(group, DUPLICATE_GROUP_FIELDS, `Signature sound duplicate group at index ${index}`)
    if (typeof group.sha256 !== "string" || !SHA256_PATTERN.test(group.sha256)) {
      throw new Error("Signature sound duplicate group checksum invariant failed")
    }
    if (!Array.isArray(group.relativePaths)) {
      throw new Error("Signature sound duplicate group path invariant failed")
    }
    for (const path of group.relativePaths) normalizeSafeRelativePath(path, "duplicate group path")
  }
  requireRecord(scan.extensionCounts, "Signature sound extension counts")
  if (scan.audioCount !== expected.audioCount) {
    throw new Error("Signature sound audio count invariant failed")
  }
  if (scan.totalBytes !== expected.totalBytes) {
    throw new Error("Signature sound total byte invariant failed")
  }
  if (!sameJson(scan.extensionCounts, expected.extensionCounts)) {
    throw new Error("Signature sound extension count invariant failed")
  }
  if (!sameJson(scan.duplicateGroups, expected.duplicateGroups)) {
    throw new Error("Signature sound duplicate group invariant failed")
  }

  return {
    directoryPackCount: scan.directoryPackCount,
    ...expected,
    audioFiles,
  }
}

/**
 * Validates the complete Task 2 audit as one closed, normalized owner. The
 * machine planning list must be an exact projection of compatible user-facing
 * outcomes under Task 1's canonical eligibility rule.
 * @param {unknown} rawAudit
 */
export function validateSignatureSoundAudit(rawAudit) {
  const audit = requireRecord(rawAudit, "Signature sound audit")
  assertOnlyFields(audit, AUDIT_FIELDS, "Signature sound audit")
  if (audit.version !== 1) throw new Error("Unsupported Signature sound audit version")

  const rawFingerprints = requireRecord(audit.fingerprints, "Signature sound audit fingerprints")
  assertOnlyFields(rawFingerprints, FINGERPRINT_FIELDS, "Signature sound audit fingerprints")
  const fingerprints = {
    scanAudioInventorySha256: requireSha256(rawFingerprints.scanAudioInventorySha256, "scan inventory fingerprint"),
    moodistInventorySha256: requireSha256(rawFingerprints.moodistInventorySha256, "Moodist inventory fingerprint"),
    signatureDeclarationSha256: requireSha256(rawFingerprints.signatureDeclarationSha256, "Signature declaration fingerprint"),
  }
  const scan = validateSignatureSoundScan(audit.scan)
  if (fingerprints.scanAudioInventorySha256 !== fingerprintCanonicalJson(scan.audioFiles)) {
    throw new Error("Signature sound audit scan fingerprint invariant failed")
  }
  const sourceByPath = new Map(scan.audioFiles.map((file) => [file.relativePath, file]))

  const rawMachineMetadata = requireRecord(audit.machineMetadata, "Signature sound audit machine metadata")
  assertOnlyFields(rawMachineMetadata, MACHINE_METADATA_FIELDS, "Signature sound audit machine metadata")
  if (!Array.isArray(rawMachineMetadata.processingPlanEligibleCandidates)) {
    throw new Error("Signature sound audit processing planning metadata must be an array")
  }
  const planningCandidates = normalizeCandidateList(
    rawMachineMetadata.processingPlanEligibleCandidates,
    "processing planning candidate",
    sourceByPath,
  )

  const rawOutcomes = requireRecord(audit.outcomes, "Signature sound audit outcomes")
  assertOnlyFields(rawOutcomes, OUTCOME_FIELDS, "Signature sound audit outcomes")
  for (const field of OUTCOME_FIELDS) {
    if (!Array.isArray(rawOutcomes[field])) {
      throw new Error(`Signature sound audit outcome ${field} must be an array`)
    }
  }
  const qualifiedMoodistMatches = normalizeCandidateList(
    rawOutcomes.qualifiedMoodistMatches,
    "qualified outcome candidate",
    sourceByPath,
  )
  const needsAuditionOrProcessing = normalizeCandidateList(
    rawOutcomes.needsAuditionOrProcessing,
    "pending outcome candidate",
    sourceByPath,
  )
  const signatureOnlyConceptCandidates = normalizeCandidateList(
    rawOutcomes.signatureOnlyConceptCandidates,
    "Signature-only outcome candidate",
    sourceByPath,
  )
  const recordingOrSourceGaps = rawOutcomes.recordingOrSourceGaps.map((rawGap, index) => (
    validateSourceGap(rawGap, index)
  ))

  const outcomeCandidateIds = new Set()
  for (const candidate of qualifiedMoodistMatches) {
    assertUniqueCandidateId(outcomeCandidateIds, candidate.id)
    assertCanonicalMappedCandidate(candidate, "qualified outcome")
    const classification = classifyEnrichedCandidate(candidate)
    if (classification !== "qualified-moodist") {
      throw new Error(`Signature sound qualified outcome candidate ${candidate.id} has ${classification} classification invariant`)
    }
  }
  for (const candidate of needsAuditionOrProcessing) {
    assertUniqueCandidateId(outcomeCandidateIds, candidate.id)
    assertCanonicalMappedCandidate(candidate, "pending outcome")
    const classification = classifyEnrichedCandidate(candidate)
    if (classification !== "pending-moodist") {
      throw new Error(`Signature sound pending outcome candidate ${candidate.id} has ${classification} classification invariant`)
    }
  }
  for (const candidate of signatureOnlyConceptCandidates) {
    assertUniqueCandidateId(outcomeCandidateIds, candidate.id)
    assertSignatureOnlyCandidateIdentity(candidate)
    const classification = classifyEnrichedCandidate(candidate)
    if (classification !== "signature-extra") {
      throw new Error(`Signature sound extra outcome candidate ${candidate.id} has ${classification} classification invariant`)
    }
  }

  const representedConceptIds = new Set([
    ...qualifiedMoodistMatches,
    ...needsAuditionOrProcessing,
  ].map(({ conceptId }) => conceptId))
  const gapIds = new Set()
  for (const gap of recordingOrSourceGaps) {
    if (gapIds.has(gap.id)) throw new Error(`Duplicate Signature sound source gap id: ${gap.id}`)
    assertCanonicalSourceGap(gap)
    if (representedConceptIds.has(gap.id)) {
      throw new Error(`Signature sound source gap ${gap.id} conflicts with a represented outcome`)
    }
    gapIds.add(gap.id)
  }
  for (const conceptId of CANONICAL_SIGNATURE_REQUIRED_IDS) {
    const hasCandidateOutcome = representedConceptIds.has(conceptId)
    const hasSourceGap = gapIds.has(conceptId)
    if (hasCandidateOutcome === hasSourceGap) {
      throw new Error(`Signature sound canonical source coverage must represent concept ${conceptId} exactly once`)
    }
  }

  const expectedPlanning = sortEnrichedCandidates(
    [...qualifiedMoodistMatches, ...needsAuditionOrProcessing].filter(isEnrichedProcessingEligible),
  )
  const planningIds = new Set()
  for (const candidate of planningCandidates) {
    assertUniqueCandidateId(planningIds, candidate.id)
    assertCanonicalMappedCandidate(candidate, "processing planning metadata")
    classifyEnrichedCandidate(candidate)
  }
  if (!sameJson(planningCandidates, expectedPlanning)) {
    throw new Error("Signature sound processing planning metadata invariant failed")
  }

  return {
    version: 1,
    fingerprints,
    scan,
    machineMetadata: { processingPlanEligibleCandidates: planningCandidates },
    outcomes: {
      qualifiedMoodistMatches,
      needsAuditionOrProcessing,
      recordingOrSourceGaps,
      signatureOnlyConceptCandidates,
    },
  }
}

/** @param {unknown[]} rawCandidates @param {string} label @param {Map<string, ScannedAudioFile>} sourceByPath */
function normalizeCandidateList(rawCandidates, label, sourceByPath) {
  return sortEnrichedCandidates(rawCandidates.map((rawCandidate, index) => {
    const candidate = requireRecord(rawCandidate, `${label} at index ${index}`)
    assertOnlyFields(candidate, ENRICHED_CANDIDATE_FIELDS, `${label} at index ${index}`)
    const id = requireKebabId(candidate.id, `${label} id`)
    const conceptId = requireKebabId(candidate.conceptId, `${label} concept id`)
    const conceptName = requireSafeText(candidate.conceptName, `${label} concept name`)
    const category = candidate.category === null
      ? null
      : requireKebabId(candidate.category, `${label} category`)
    const discoveryPath = normalizeSafeRelativePath(candidate.discoveryPath, `${label} discovery path`)
    if (discoveryPath !== candidate.discoveryPath) throw new Error(`${label} discovery path normalization invariant failed`)
    if (!EVIDENCE_TIERS.has(candidate.evidenceTier)) throw new Error(`${label} evidence tier invariant failed`)
    const evidenceRef = requireNonBlankText(candidate.evidenceRef, `${label} evidence ref`)
    if (!Number.isSafeInteger(candidate.byteSize) || candidate.byteSize < 0) {
      throw new Error(`${label} byte size invariant failed`)
    }
    const sha256 = requireSha256(candidate.sha256, `${label} checksum`)
    if (!REVIEW_STATES.has(candidate.technicalState) || !REVIEW_STATES.has(candidate.listeningState)) {
      throw new Error(`${label} review state invariant failed`)
    }
    if (!PROCESSING_STATES.has(candidate.processingState)) throw new Error(`${label} processing state invariant failed`)
    if (!REJECTION_STATES.has(candidate.rejectionState)) throw new Error(`${label} rejection state invariant failed`)
    const rejectionReason = candidate.rejectionReason === null
      ? null
      : requireSafeText(candidate.rejectionReason, `${label} rejection reason`)
    if ((candidate.rejectionState === "active") !== (rejectionReason === null)) {
      throw new Error(`${label} rejection reason invariant failed`)
    }
    const source = sourceByPath.get(discoveryPath)
    if (source === undefined || source.byteSize !== candidate.byteSize || source.sha256 !== sha256) {
      throw new Error(`${label} source checksum or byte-size invariant failed`)
    }
    return {
      id,
      conceptId,
      conceptName,
      category,
      discoveryPath,
      evidenceTier: candidate.evidenceTier,
      evidenceRef,
      byteSize: candidate.byteSize,
      sha256,
      technicalState: candidate.technicalState,
      listeningState: candidate.listeningState,
      processingState: candidate.processingState,
      rejectionState: candidate.rejectionState,
      rejectionReason,
    }
  }))
}

/** @param {unknown} rawGap @param {number} index */
function validateSourceGap(rawGap, index) {
  const gap = requireRecord(rawGap, `Signature sound source gap at index ${index}`)
  assertOnlyFields(gap, GAP_FIELDS, `Signature sound source gap at index ${index}`)
  return {
    id: requireKebabId(gap.id, "Signature sound source gap id"),
    label: requireSafeText(gap.label, "Signature sound source gap label"),
    category: requireKebabId(gap.category, "Signature sound source gap category"),
    upstreamAssetRef: requireSafeText(gap.upstreamAssetRef, "Signature sound source gap asset ref"),
  }
}

/** @param {any} candidate */
function isEnrichedProcessingEligible(candidate) {
  const canonical = CANONICAL_MOODIST_BY_ID.get(candidate.conceptId)
  if (
    canonical === undefined
    || canonical.sourceStrategy !== "signature-required"
    || canonical.label !== candidate.conceptName
    || canonical.category !== candidate.category
  ) return false
  return isSignatureSoundProcessingPlanEligible({
    moodistConceptId: candidate.conceptId,
    evidenceTier: candidate.evidenceTier,
    technicalState: candidate.technicalState,
    listeningState: candidate.listeningState,
    processingState: candidate.processingState,
    rejectionState: candidate.rejectionState,
  })
}

/** @param {any} candidate */
function classifyEnrichedCandidate(candidate) {
  return classifySignatureSoundCandidateSemantics({
    id: candidate.id,
    moodistConceptId: candidate.category === null ? undefined : candidate.conceptId,
    discoveryPath: candidate.discoveryPath,
    evidenceTier: candidate.evidenceTier,
    evidenceRef: candidate.evidenceRef,
    technicalState: candidate.technicalState,
    listeningState: candidate.listeningState,
    processingState: candidate.processingState,
    rejectionState: candidate.rejectionState,
    rejectionReason: candidate.rejectionReason,
  })
}

/** @param {any} candidate @param {string} label */
function assertCanonicalMappedCandidate(candidate, label) {
  const canonical = CANONICAL_MOODIST_BY_ID.get(candidate.conceptId)
  if (
    canonical === undefined
    || canonical.sourceStrategy !== "signature-required"
    || canonical.label !== candidate.conceptName
    || canonical.category !== candidate.category
  ) {
    throw new Error(`Signature sound ${label} candidate ${candidate.id} does not match canonical Moodist identity`)
  }
}

/** @param {any} candidate */
function assertSignatureOnlyCandidateIdentity(candidate) {
  if (
    candidate.category !== null
    || CANONICAL_MOODIST_BY_ID.has(candidate.conceptId)
    || CANONICAL_MOODIST_LABELS.has(candidate.conceptName.toLowerCase())
  ) {
    throw new Error(`Signature sound extra outcome candidate ${candidate.id} conflicts with canonical Moodist identity`)
  }
}

/** @param {any} gap */
function assertCanonicalSourceGap(gap) {
  const canonical = CANONICAL_MOODIST_BY_ID.get(gap.id)
  if (
    canonical === undefined
    || canonical.sourceStrategy !== "signature-required"
    || canonical.label !== gap.label
    || canonical.category !== gap.category
    || canonical.upstreamAssetRef !== gap.upstreamAssetRef
  ) {
    throw new Error(`Signature sound source gap ${gap.id} does not match canonical Moodist identity`)
  }
}

/** @param {any[]} candidates */
function sortEnrichedCandidates(candidates) {
  return [...candidates].sort((left, right) => (
    compareText(left.conceptName, right.conceptName)
      || compareRelativePaths(left.discoveryPath, right.discoveryPath)
      || compareText(left.id, right.id)
  ))
}

/** @param {Set<string>} ids @param {string} id */
function assertUniqueCandidateId(ids, id) {
  if (ids.has(id)) throw new Error(`Duplicate Signature sound audit candidate id: ${id}`)
  ids.add(id)
}

/** Returns stable pretty JSON suitable for stdout or an explicit report file. @param {unknown} audit */
export function renderSignatureSoundAuditJson(audit) {
  return `${JSON.stringify(audit, null, 2)}\n`
}

/**
 * Renders the four catalog decisions without turning filename similarity into
 * approval. The machine-specific scan root is intentionally never accepted.
 * @param {any} audit
 */
export function renderSignatureSoundAuditMarkdown(audit) {
  const lines = [
    "# AtmoShaper Signature Sound Catalog Audit",
    "",
    "This report was produced from a local read-only scan. The machine-specific source root is intentionally omitted.",
    "",
    `- Directory packs: ${audit.scan.directoryPackCount}`,
    `- Audio files: ${audit.scan.audioCount}`,
    `- Total audio bytes: ${audit.scan.totalBytes}`,
    `- Duplicate checksum groups: ${audit.scan.duplicateGroups.length}`,
    `- Scan audio inventory SHA-256: \`${audit.fingerprints.scanAudioInventorySha256}\``,
    `- Moodist inventory SHA-256: \`${audit.fingerprints.moodistInventorySha256}\``,
    `- Signature declaration SHA-256: \`${audit.fingerprints.signatureDeclarationSha256}\``,
    `- Evidence policy: Signature Sounds states that its library is CC0 at ${SIGNATURE_SITEWIDE_CC0_URL}; this project accepts that author statement as site-wide evidence for this downloaded library.`,
    "- License caveat: evidence tiers record provenance evidence, not final legal or publishing approval.",
    "- Gate separation: accepted license evidence does not satisfy the separate technical, listening, or processing gates.",
    "- Moodist source boundary: no Moodist binaries were read, copied, or included; only the canonical concept inventory was used.",
    "- Human listening requirement: every active candidate remains unqualified until technical, listening, and processing gates all pass.",
    "",
    "### Extension counts",
    "",
  ]
  const extensionEntries = Object.entries(audit.scan.extensionCounts)
  if (extensionEntries.length === 0) lines.push("- No allowed audio files found.")
  else for (const [extension, count] of extensionEntries) lines.push(`- \`${extension}\`: ${count}`)

  lines.push("", "### Duplicate checksum groups", "")
  if (audit.scan.duplicateGroups.length === 0) lines.push("- None.")
  else for (const group of audit.scan.duplicateGroups) {
    lines.push(`- \`${group.sha256}\`: ${group.relativePaths.map((path) => `\`${escapeMarkdown(path)}\``).join(", ")}`)
  }

  appendCandidateSection(lines, "Qualified Moodist matches", audit.outcomes.qualifiedMoodistMatches, "No candidates qualified.")
  appendCandidateSection(lines, "Needs audition or processing", audit.outcomes.needsAuditionOrProcessing, "No pending Moodist candidates.")
  appendGapSection(lines, audit.outcomes.recordingOrSourceGaps)
  appendCandidateSection(lines, "Signature-only concept candidates", audit.outcomes.signatureOnlyConceptCandidates, "No Signature-only candidates.")
  return `${lines.join("\n")}\n`
}

/** @param {string[]} lines @param {string} heading @param {any[]} candidates @param {string} emptyMessage */
function appendCandidateSection(lines, heading, candidates, emptyMessage) {
  lines.push("", `## ${heading}`, "")
  if (candidates.length === 0) {
    lines.push(emptyMessage)
    return
  }
  lines.push(
    "| Candidate ID | Concept | Discovery path | Evidence tier | Evidence ref | Bytes | SHA-256 | Gates (technical / listening / processing / rejection) | Rejection reason |",
    "| --- | --- | --- | --- | --- | ---: | --- | --- | --- |",
  )
  for (const candidate of candidates) {
    const gates = [
      candidate.technicalState,
      candidate.listeningState,
      candidate.processingState,
      candidate.rejectionState,
    ].join(" / ")
    lines.push(`| \`${escapeMarkdown(candidate.id)}\` | ${escapeMarkdown(candidate.conceptName)} (\`${escapeMarkdown(candidate.conceptId)}\`) | \`${escapeMarkdown(candidate.discoveryPath)}\` | ${escapeMarkdown(candidate.evidenceTier)} | ${escapeMarkdown(candidate.evidenceRef)} | ${candidate.byteSize} | \`${candidate.sha256}\` | ${gates} | ${escapeMarkdown(candidate.rejectionReason ?? "—")} |`)
  }
}

/** @param {string[]} lines @param {any[]} gaps */
function appendGapSection(lines, gaps) {
  lines.push("", "## Recording or source gaps", "")
  if (gaps.length === 0) {
    lines.push("No recording or source gaps.")
    return
  }
  const byCategory = new Map(CATEGORY_ORDER.map((category) => [category, []]))
  for (const gap of gaps) byCategory.get(gap.category)?.push(gap)
  for (const category of CATEGORY_ORDER) {
    const categoryGaps = byCategory.get(category) ?? []
    if (categoryGaps.length === 0) continue
    lines.push(`### ${category}`, "")
    for (const gap of categoryGaps) lines.push(`- ${escapeMarkdown(gap.label)} (\`${gap.id}\`)`)
    lines.push("")
  }
  if (lines.at(-1) === "") lines.pop()
}

/** @param {string} absoluteRoot @param {ScannedAudioFile} audioFile @param {string} candidateId */
async function verifyAudioIntegrity(absoluteRoot, audioFile, candidateId) {
  const absolutePath = resolveWithinRoot(absoluteRoot, audioFile.relativePath, `candidate ${candidateId}`)
  let currentStats
  let currentHash
  try {
    currentStats = await stat(absolutePath)
    currentHash = await hashFile(absolutePath)
  } catch {
    throw new Error(`Signature candidate ${candidateId} audio could not be verified`)
  }
  if (!currentStats.isFile() || currentStats.size !== audioFile.byteSize || currentHash !== audioFile.sha256) {
    throw new Error(`Signature candidate ${candidateId} checksum or byte-size invariant failed`)
  }
}

/** @param {string} absoluteRoot @param {any} candidate */
async function validateEvidence(absoluteRoot, candidate) {
  if (candidate.evidenceTier === "signature-sitewide-cc0") {
    if (candidate.evidenceRef !== SIGNATURE_SITEWIDE_CC0_URL) {
      throw new Error(`Signature candidate ${candidate.id} must use the exact Signature Sounds sitewide CC0 URL`)
    }
    return candidate.evidenceRef
  }
  if (candidate.evidenceTier === "needs-origin-review") return candidate.evidenceRef.trim()

  const evidenceRef = normalizeSafeRelativePath(candidate.evidenceRef, `candidate ${candidate.id} evidence ref`)
  if (AUDIO_EXTENSIONS.has(extname(evidenceRef).toLowerCase())) {
    throw new Error(`Signature candidate ${candidate.id} evidence must be a non-audio file`)
  }
  const evidencePath = resolveWithinRoot(absoluteRoot, evidenceRef, `candidate ${candidate.id} evidence`)
  try {
    const evidenceStats = await stat(evidencePath)
    if (!evidenceStats.isFile()) throw new Error("not a file")
  } catch {
    throw new Error(`Signature candidate ${candidate.id} evidence file was not found`)
  }
  return evidenceRef
}

/** @param {ScannedAudioFile[]} audioFiles */
function deriveScanAggregates(audioFiles) {
  const totalBytes = audioFiles.reduce((total, file) => total + file.byteSize, 0)
  const extensionCountMap = new Map()
  const checksumPaths = new Map()
  for (const file of audioFiles) {
    extensionCountMap.set(file.extension, (extensionCountMap.get(file.extension) ?? 0) + 1)
    const paths = checksumPaths.get(file.sha256) ?? []
    paths.push(file.relativePath)
    checksumPaths.set(file.sha256, paths)
  }
  const extensionCounts = Object.fromEntries([...extensionCountMap.entries()].sort(([left], [right]) => compareText(left, right)))
  const duplicateGroups = [...checksumPaths.entries()]
    .filter(([, paths]) => paths.length > 1)
    .map(([sha256, paths]) => ({
      sha256,
      relativePaths: [...paths].sort(compareRelativePaths),
    }))
    .sort((left, right) => compareText(left.sha256, right.sha256))
  return {
    audioCount: audioFiles.length,
    totalBytes,
    extensionCounts,
    duplicateGroups,
  }
}

/** Hashes a canonical JSON form with object keys sorted and array order retained. @param {unknown} value */
function fingerprintCanonicalJson(value) {
  return createHash("sha256").update(JSON.stringify(canonicalizeJson(value))).digest("hex")
}

/** @param {any} value @returns {any} */
function canonicalizeJson(value) {
  if (Array.isArray(value)) return value.map(canonicalizeJson)
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value).sort(compareText).map((key) => [key, canonicalizeJson(value[key])]),
    )
  }
  return value
}

/** @param {string} rootPath */
async function requireDirectoryRoot(rootPath) {
  if (typeof rootPath !== "string" || rootPath.trim() === "") {
    throw new TypeError("Signature sound scan root must be a non-blank path")
  }
  const absoluteRoot = resolve(rootPath)
  let rootStats
  try {
    rootStats = await stat(absoluteRoot)
  } catch (error) {
    if (error?.code === "ENOENT") throw new Error("Signature sound scan root does not exist")
    throw new Error("Signature sound scan root could not be inspected")
  }
  if (!rootStats.isDirectory()) throw new Error("Signature sound scan root must be a directory")
  return absoluteRoot
}

/** @param {string} absoluteRoot @param {string} relativePath @param {string} label */
function resolveWithinRoot(absoluteRoot, relativePath, label) {
  const normalized = normalizeSafeRelativePath(relativePath, label)
  const destination = resolve(absoluteRoot, ...normalized.split("/"))
  const rootRelative = relative(absoluteRoot, destination)
  if (rootRelative === "" || rootRelative.startsWith("..") || isAbsolute(rootRelative)) {
    throw new Error(`Signature sound ${label} must stay inside the scan root`)
  }
  return destination
}

/** @param {unknown} value @param {string} label */
function normalizeSafeRelativePath(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new TypeError(`Signature sound ${label} must be a non-blank relative path`)
  }
  const normalized = value.replaceAll("\\", "/")
  const segments = normalized.split("/")
  if (
    normalized.startsWith("/")
    || /^[A-Za-z][A-Za-z\d+.-]*:/.test(normalized)
    || normalized.trim() !== normalized
    || /[\u0000-\u001f\u007f]/.test(normalized)
    || segments.some((segment) => segment === "" || segment === "." || segment === "..")
  ) {
    throw new Error(`Signature sound ${label} must be a safe root-relative path`)
  }
  return normalized
}

/** Streams a lowercase SHA-256 digest without buffering the complete audio file. @param {string} absolutePath */
async function hashFile(absolutePath) {
  const hash = createHash("sha256")
  await new Promise((resolvePromise, rejectPromise) => {
    const stream = createReadStream(absolutePath)
    stream.on("data", (chunk) => hash.update(chunk))
    stream.once("error", rejectPromise)
    stream.once("end", resolvePromise)
  })
  return hash.digest("hex")
}

/** @param {string} left @param {string} right */
function compareRelativePaths(left, right) {
  return compareText(left, right)
}

/** Stable code-point ordering with a case-insensitive primary key. @param {string} left @param {string} right */
function compareText(left, right) {
  const foldedLeft = left.toLowerCase()
  const foldedRight = right.toLowerCase()
  if (foldedLeft < foldedRight) return -1
  if (foldedLeft > foldedRight) return 1
  if (left < right) return -1
  if (left > right) return 1
  return 0
}

/** @param {unknown} value @param {string} label */
function requireRecord(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`)
  }
  return /** @type {Record<string, any>} */ (value)
}

/** @param {Record<string, any>} value @param {Set<string>} allowed @param {string} label */
function assertOnlyFields(value, allowed, label) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error(`Unknown ${label} field: ${key}`)
  }
}

/** @param {unknown} value @param {string} label */
function requireSha256(value, label) {
  if (typeof value !== "string" || !SHA256_PATTERN.test(value)) {
    throw new Error(`Signature sound ${label} must be an exact lowercase SHA-256 checksum`)
  }
  return value
}

/** @param {unknown} value @param {string} label */
function requireKebabId(value, label) {
  if (typeof value !== "string" || !KEBAB_ID_PATTERN.test(value)) {
    throw new Error(`Signature sound ${label} must be a safe control-free stable kebab-case id`)
  }
  return value
}

/** @param {unknown} value @param {string} label */
function requireSafeText(value, label) {
  if (
    typeof value !== "string"
    || value.trim() === ""
    || value.trim() !== value
    || /[\u0000-\u001f\u007f]/.test(value)
  ) {
    throw new Error(`Signature sound ${label} must be a safe non-blank string without control characters`)
  }
  return value
}

/** @param {unknown} value @param {string} label */
function requireNonBlankText(value, label) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`Signature sound ${label} must be a non-blank string`)
  }
  return value
}

/** @param {unknown} left @param {unknown} right */
function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

/** @param {unknown} value */
function escapeMarkdown(value) {
  return String(value).replaceAll("|", "\\|").replaceAll("\r", " ").replaceAll("\n", " ")
}
