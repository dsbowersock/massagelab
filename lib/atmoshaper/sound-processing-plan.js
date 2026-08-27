// @ts-check

import { createHash } from "node:crypto"
import { lstat, readFile, realpath, stat } from "node:fs/promises"
import { basename, dirname, isAbsolute, parse, relative, resolve } from "node:path"
import { validateSignatureSoundAudit } from "./signature-sound-scan.js"

const VERSION = 1
const PLANNER_ALGORITHM_VERSION = "cyclic-crossfade-two-pass-v1"
const SHA256_PATTERN = /^[a-f0-9]{64}$/
const KEBAB_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const DECLARATION_FIELDS = new Set([
  "version", "plannerAlgorithmVersion", "profiles", "sourceMeasurements", "assignments", "publishedOutputs",
])
const PUBLICATION_BASELINE_FIELDS = new Set(["version", "revision", "entries"])
const PROFILE_FIELDS = new Set(["id", "trim", "loop", "audio", "encodes"])
const TRIM_FIELDS = new Set(["startSeconds", "targetDurationSeconds"])
const LOOP_FIELDS = new Set(["crossfadeSeconds"])
const AUDIO_FIELDS = new Set([
  "channels", "sampleRateHz", "integratedLoudnessTargetLufs", "truePeakCeilingDbtp",
])
const ENCODE_FIELDS = new Set(["format", "extension", "codec", "bitrateKbps"])
const MEASUREMENT_FIELDS = new Set([
  "candidateId", "sourceSha256", "durationSeconds", "channels", "sampleRateHz", "measurementMethodVersion",
])
const ASSIGNMENT_FIELDS = new Set(["candidateId", "profileId", "sourceSha256", "outputVersion"])
const PUBLISHED_OUTPUT_FIELDS = new Set([
  "candidateId", "profileId", "sourceSha256", "profileSha256", "algorithmVersion", "outputVersion", "objectKeys",
])
const ENCODE_SHAPES = new Map([
  ["webm-opus", { extension: "webm", codec: "libopus" }],
  ["m4a-aac", { extension: "m4a", codec: "aac" }],
  ["mp3", { extension: "mp3", codec: "libmp3lame" }],
])

/**
 * Validates the separate publication-history anchor. This ledger is an
 * accidental-regression and code-review anchor, not an external trust claim.
 * A future authorized publication workflow may advance it only from the
 * verified previously published manifest; this planner never publishes.
 * @param {unknown} rawBaseline
 * @param {unknown} rawDeclaration
 */
export function validateSoundPublicationLedgerBaseline(rawBaseline, rawDeclaration) {
  const declaration = requireRecord(rawDeclaration, "Sound processing declaration for publication baseline")
  if (!Array.isArray(declaration.profiles) || declaration.profiles.length === 0) {
    throw new Error("Publication baseline requires declared processing profiles")
  }
  const profiles = declaration.profiles.map((profile, index) => validateProfile(profile, index))
  const profileIds = new Set()
  for (const profile of profiles) {
    if (profileIds.has(profile.id)) throw new Error(`Duplicate sound processing profile id: ${profile.id}`)
    profileIds.add(profile.id)
  }
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]))
  const profileShaById = new Map(profiles.map((profile) => [
    profile.id,
    fingerprintCanonicalJson({ plannerAlgorithmVersion: PLANNER_ALGORITHM_VERSION, profile }),
  ]))
  return validatePublicationBaselineWithProfiles(rawBaseline, profileById, profileShaById)
}

/**
 * Validates the versioned processing declaration against Task 2's normalized
 * planning metadata. Measurements are evidence only: no media tool is invoked.
 * @param {unknown} rawDeclaration
 * @param {unknown} rawAudit
 * @param {unknown} rawPublicationBaseline
 */
export function validateSoundProcessingDeclaration(rawDeclaration, rawAudit, rawPublicationBaseline) {
  const audit = validateSignatureSoundAudit(rawAudit)
  const declaration = requireRecord(rawDeclaration, "Sound processing declaration")
  assertOnlyFields(declaration, DECLARATION_FIELDS, "declaration")
  if (declaration.version !== VERSION) {
    throw new Error(`Unsupported sound processing declaration version: ${String(declaration.version)}`)
  }
  if (declaration.plannerAlgorithmVersion !== PLANNER_ALGORITHM_VERSION) {
    throw new Error(`Unsupported sound processing planner algorithm: ${String(declaration.plannerAlgorithmVersion)}`)
  }
  if (!Array.isArray(declaration.profiles) || declaration.profiles.length === 0) {
    throw new Error("Sound processing declaration profiles must be a non-empty array")
  }
  if (!Array.isArray(declaration.sourceMeasurements)) {
    throw new Error("Sound processing declaration source measurements must be an array")
  }
  if (!Array.isArray(declaration.assignments)) {
    throw new Error("Sound processing declaration assignments must be an array")
  }
  if (!Array.isArray(declaration.publishedOutputs)) {
    throw new Error("Sound processing declaration published outputs must be an array")
  }

  const profileIds = new Set()
  const profiles = declaration.profiles.map((rawProfile, index) => {
    const profile = validateProfile(rawProfile, index)
    if (profileIds.has(profile.id)) throw new Error(`Duplicate sound processing profile id: ${profile.id}`)
    profileIds.add(profile.id)
    return profile
  }).sort((left, right) => compareText(left.id, right.id))
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]))
  const profileShaById = new Map(profiles.map((profile) => [
    profile.id,
    fingerprintCanonicalJson({ plannerAlgorithmVersion: PLANNER_ALGORITHM_VERSION, profile }),
  ]))
  const publicationBaseline = validatePublicationBaselineWithProfiles(
    rawPublicationBaseline,
    profileById,
    profileShaById,
  )

  const measurementKeys = new Set()
  const sourceMeasurements = declaration.sourceMeasurements.map((rawMeasurement, index) => {
    const measurement = validateSourceMeasurement(rawMeasurement, index)
    const key = `${measurement.candidateId}:${measurement.sourceSha256}`
    if (measurementKeys.has(key)) {
      throw new Error(`Duplicate source measurement for candidate and checksum: ${measurement.candidateId}`)
    }
    measurementKeys.add(key)
    return measurement
  }).sort(compareMeasurements)
  const measurementByKey = new Map(sourceMeasurements.map((measurement) => [
    `${measurement.candidateId}:${measurement.sourceSha256}`,
    measurement,
  ]))

  const eligibleById = new Map(
    audit.machineMetadata.processingPlanEligibleCandidates.map((candidate) => [candidate.id, candidate]),
  )
  const assignedCandidateIds = new Set()
  const assignments = declaration.assignments.map((rawAssignment, index) => {
    const assignment = validateAssignment(rawAssignment, index)
    if (assignedCandidateIds.has(assignment.candidateId)) {
      throw new Error(`Duplicate sound processing assignment candidate id: ${assignment.candidateId}`)
    }
    if (!profileById.has(assignment.profileId)) {
      throw new Error(`Unknown profile for sound processing candidate ${assignment.candidateId}: ${assignment.profileId}`)
    }
    const candidate = eligibleById.get(assignment.candidateId)
    if (candidate === undefined) {
      throw new Error(`Unknown or processing-plan-ineligible candidate: ${assignment.candidateId}`)
    }
    if (candidate.sha256 !== assignment.sourceSha256) {
      throw new Error(`Sound processing assignment ${assignment.candidateId} checksum does not match the fresh audit`)
    }
    const measurement = measurementByKey.get(`${assignment.candidateId}:${assignment.sourceSha256}`)
    if (measurement === undefined) {
      throw new Error(`Sound processing assignment ${assignment.candidateId} requires an exact checksum-bound source measurement`)
    }
    const profile = profileById.get(assignment.profileId)
    if (profile === undefined) throw new Error(`Sound processing profile invariant failed: ${assignment.profileId}`)
    const requiredDuration = profile.trim.startSeconds
      + profile.trim.targetDurationSeconds
      + profile.loop.crossfadeSeconds
    if (measurement.durationSeconds < requiredDuration) {
      throw new Error(`Source measurement duration for ${assignment.candidateId} is shorter than the non-repeated cyclic source window`)
    }
    assignedCandidateIds.add(assignment.candidateId)
    return assignment
  }).sort((left, right) => compareText(left.candidateId, right.candidateId))

  const publishedIdentities = new Set()
  const publishedObjectKeys = new Set()
  const maxPublishedVersionByCandidate = new Map()
  const publishedOutputs = declaration.publishedOutputs.map((rawPublished, index) => {
    const published = validatePublishedOutput(rawPublished, index, profileById, profileShaById)
    const identity = `${published.candidateId}:v${published.outputVersion}`
    if (publishedIdentities.has(identity)) {
      throw new Error(`Duplicate published output history entry: ${identity}`)
    }
    publishedIdentities.add(identity)
    for (const objectKey of published.objectKeys) {
      if (publishedObjectKeys.has(objectKey)) throw new Error(`Duplicate published object key: ${objectKey}`)
      publishedObjectKeys.add(objectKey)
    }
    maxPublishedVersionByCandidate.set(
      published.candidateId,
      Math.max(maxPublishedVersionByCandidate.get(published.candidateId) ?? 0, published.outputVersion),
    )
    return published
  }).sort(comparePublishedOutputs)

  const currentPublishedByIdentity = new Map(publishedOutputs.map((published) => [
    `${published.candidateId}:v${published.outputVersion}`,
    published,
  ]))
  for (const anchored of publicationBaseline.entries) {
    const identity = `${anchored.candidateId}:v${anchored.outputVersion}`
    const current = currentPublishedByIdentity.get(identity)
    if (current === undefined || !sameJson(current, anchored)) {
      throw new Error(`Current published outputs must be an exact superset of publication baseline entry ${identity}`)
    }
    maxPublishedVersionByCandidate.set(
      anchored.candidateId,
      Math.max(maxPublishedVersionByCandidate.get(anchored.candidateId) ?? 0, anchored.outputVersion),
    )
  }

  for (const assignment of assignments) {
    const maximum = maxPublishedVersionByCandidate.get(assignment.candidateId) ?? 0
    if (assignment.outputVersion <= maximum) {
      throw new Error(
        `Sound processing assignment ${assignment.candidateId} output version must be newer than published version ${maximum}`,
      )
    }
  }

  return {
    version: VERSION,
    plannerAlgorithmVersion: PLANNER_ALGORITHM_VERSION,
    profiles,
    sourceMeasurements,
    assignments,
    publishedOutputs,
  }
}

/**
 * Produces a deterministic, inert plan after proving outputRoot is external.
 * It resolves paths only for containment checks and never creates or writes.
 * @param {{ audit: unknown, processingDeclaration: unknown, publicationBaseline: unknown, repoRoot: string, outputRoot: string }} input
 */
export async function createSoundProcessingPlan(input) {
  if (input === null || typeof input !== "object") {
    throw new TypeError("Sound processing planner input must be an object")
  }
  const audit = validateSignatureSoundAudit(input.audit)
  const declaration = validateSoundProcessingDeclaration(
    input.processingDeclaration,
    audit,
    input.publicationBaseline,
  )
  const publicationBaseline = validateSoundPublicationLedgerBaseline(
    input.publicationBaseline,
    input.processingDeclaration,
  )
  await assertExternalOutputRoot(input.repoRoot, input.outputRoot)

  const eligibleById = new Map(
    audit.machineMetadata.processingPlanEligibleCandidates.map((candidate) => [candidate.id, candidate]),
  )
  const profileById = new Map(declaration.profiles.map((profile) => [profile.id, profile]))
  const measurementByKey = new Map(declaration.sourceMeasurements.map((measurement) => [
    `${measurement.candidateId}:${measurement.sourceSha256}`,
    measurement,
  ]))
  const objectKeys = new Set()

  const sources = declaration.assignments.map((assignment) => {
    const candidate = eligibleById.get(assignment.candidateId)
    const profile = profileById.get(assignment.profileId)
    const measurement = measurementByKey.get(`${assignment.candidateId}:${assignment.sourceSha256}`)
    if (candidate === undefined || profile === undefined || measurement === undefined) {
      throw new Error(`Sound processing assignment invariant failed: ${assignment.candidateId}`)
    }
    const profileSha256 = fingerprintCanonicalJson({
      plannerAlgorithmVersion: declaration.plannerAlgorithmVersion,
      profile,
    })
    const inputPlaceholder = `{{signature-root}}/${candidate.discoveryPath}`
    const cyclicMaster = buildCyclicMaster(profile)
    const cyclicFilterGraph = buildCyclicFilterGraph(profile)
    const encodes = profile.encodes.map((encode) => {
      const objectKey = buildObjectKey({
        candidateId: candidate.id,
        sourceSha256: assignment.sourceSha256,
        profileId: profile.id,
        profileSha256,
        algorithmVersion: declaration.plannerAlgorithmVersion,
        outputVersion: assignment.outputVersion,
        extension: encode.extension,
      })
      if (objectKeys.has(objectKey)) throw new Error(`Duplicate sound processing object key: ${objectKey}`)
      objectKeys.add(objectKey)
      return {
        ...encode,
        objectKey,
        argv: buildSecondPassArgv(
          profile,
          encode,
          inputPlaceholder,
          `{{output-root}}/${objectKey}`,
          cyclicFilterGraph,
        ),
      }
    })
    return {
      candidateId: candidate.id,
      concept: {
        id: candidate.conceptId,
        name: candidate.conceptName,
        category: candidate.category,
      },
      source: {
        discoveryPath: candidate.discoveryPath,
        sha256: candidate.sha256,
      },
      sourceMeasurement: structuredClone(measurement),
      outputVersion: assignment.outputVersion,
      profile: structuredClone(profile),
      profileSha256,
      processingVerification: "not-run",
      seamVerificationRequired: true,
      recipe: {
        inputPlaceholder,
        plannedDurationSeconds: profile.trim.targetDurationSeconds,
        cyclicMaster,
        operations: buildOperations(profile, cyclicMaster),
        loudnessAnalysisRequired: true,
        loudnessMode: "two-pass",
        analysis: { argv: buildAnalysisArgv(profile, inputPlaceholder, cyclicFilterGraph) },
        encodes,
      },
    }
  })

  const processingAuditProjection = {
    version: audit.version,
    fingerprints: audit.fingerprints,
    processingPlanEligibleCandidates: audit.machineMetadata.processingPlanEligibleCandidates,
  }
  const processingAuditProjectionSha256 = fingerprintCanonicalJson(processingAuditProjection)
  const processingDeclarationSha256 = fingerprintCanonicalJson(declaration)
  const plannerAlgorithmProfilesSha256 = fingerprintCanonicalJson({
    plannerAlgorithmVersion: declaration.plannerAlgorithmVersion,
    profiles: declaration.profiles,
  })
  const publicationLedgerBaselineSha256 = fingerprintCanonicalJson(publicationBaseline)
  return {
    version: VERSION,
    plannerAlgorithmVersion: declaration.plannerAlgorithmVersion,
    state: sources.length === 0 ? "no-qualified-assignments" : "needs-toolchain",
    processingVerification: "not-run",
    fingerprints: {
      publicationLedgerBaselineRevision: publicationBaseline.revision,
      publicationLedgerBaselineSha256,
      processingAuditProjectionSha256,
      processingDeclarationSha256,
      plannerAlgorithmProfilesSha256,
      planInputsSha256: fingerprintCanonicalJson({
        publicationLedgerBaselineRevision: publicationBaseline.revision,
        publicationLedgerBaselineSha256,
        processingAuditProjectionSha256,
        processingDeclarationSha256,
        plannerAlgorithmProfilesSha256,
      }),
    },
    sources,
  }
}

/** Returns stable pretty JSON without accepting or exposing machine roots. @param {unknown} plan */
export function renderSoundProcessingPlanJson(plan) {
  return `${JSON.stringify(plan, null, 2)}\n`
}

/** @param {unknown} rawProfile @param {number} index */
function validateProfile(rawProfile, index) {
  const raw = requireRecord(rawProfile, `Sound processing profile at index ${index}`)
  assertOnlyFields(raw, PROFILE_FIELDS, "profile")
  const id = requireKebabId(raw.id, "Sound processing profile id")
  const trim = validateTrim(raw.trim, id)
  const loop = validateLoop(raw.loop, id, trim.targetDurationSeconds)
  const audio = validateAudio(raw.audio, id)
  const encodes = validateEncodes(raw.encodes, id)
  return { id, trim, loop, audio, encodes }
}

/** @param {unknown} rawTrim @param {string} profileId */
function validateTrim(rawTrim, profileId) {
  const raw = requireRecord(rawTrim, `Sound processing profile ${profileId} trim`)
  assertOnlyFields(raw, TRIM_FIELDS, "trim")
  const startSeconds = requireBoundedNumber(raw.startSeconds, 0, 3600, `Sound processing profile ${profileId} trim start`)
  const targetDurationSeconds = requireBoundedNumber(
    raw.targetDurationSeconds,
    Number.EPSILON,
    3600,
    `Sound processing profile ${profileId} target duration`,
  )
  return { startSeconds, targetDurationSeconds }
}

/** @param {unknown} rawLoop @param {string} profileId @param {number} targetDuration */
function validateLoop(rawLoop, profileId, targetDuration) {
  const raw = requireRecord(rawLoop, `Sound processing profile ${profileId} loop`)
  assertOnlyFields(raw, LOOP_FIELDS, "loop")
  const crossfadeSeconds = requireBoundedNumber(
    raw.crossfadeSeconds,
    Number.EPSILON,
    30,
    `Sound processing profile ${profileId} crossfade`,
  )
  if (crossfadeSeconds > targetDuration / 2) {
    throw new Error(`Sound processing profile ${profileId} crossfade must not exceed half the target duration`)
  }
  return { crossfadeSeconds }
}

/** @param {unknown} rawAudio @param {string} profileId */
function validateAudio(rawAudio, profileId) {
  const raw = requireRecord(rawAudio, `Sound processing profile ${profileId} audio`)
  assertOnlyFields(raw, AUDIO_FIELDS, "audio")
  if (raw.channels !== 1 && raw.channels !== 2) {
    throw new Error(`Sound processing profile ${profileId} channels must be 1 or 2`)
  }
  if (raw.sampleRateHz !== 44100 && raw.sampleRateHz !== 48000) {
    throw new Error(`Sound processing profile ${profileId} sample rate must be 44100 or 48000 Hz`)
  }
  const integratedLoudnessTargetLufs = requireBoundedNumber(
    raw.integratedLoudnessTargetLufs,
    -30,
    -12,
    `Sound processing profile ${profileId} loudness`,
  )
  const truePeakCeilingDbtp = requireBoundedNumber(
    raw.truePeakCeilingDbtp,
    -3,
    -0.1,
    `Sound processing profile ${profileId} true peak`,
  )
  return {
    channels: raw.channels,
    sampleRateHz: raw.sampleRateHz,
    integratedLoudnessTargetLufs,
    truePeakCeilingDbtp,
  }
}

/** @param {unknown} rawEncodes @param {string} profileId */
function validateEncodes(rawEncodes, profileId) {
  if (!Array.isArray(rawEncodes) || rawEncodes.length !== 2) {
    throw new Error(`Sound processing profile ${profileId} must declare exactly two encodes`)
  }
  const formats = new Set()
  const extensions = new Set()
  const encodes = rawEncodes.map((rawEncode, index) => {
    const raw = requireRecord(rawEncode, `Sound processing profile ${profileId} encode at index ${index}`)
    assertOnlyFields(raw, ENCODE_FIELDS, "encode")
    const expected = typeof raw.format === "string" ? ENCODE_SHAPES.get(raw.format) : undefined
    if (expected === undefined) throw new Error(`Sound processing profile ${profileId} encode format is unsupported`)
    if (raw.extension !== expected.extension || raw.codec !== expected.codec) {
      throw new Error(`Sound processing profile ${profileId} encode format, extension, and codec must match`)
    }
    if (!Number.isSafeInteger(raw.bitrateKbps) || raw.bitrateKbps <= 0 || raw.bitrateKbps > 512) {
      throw new Error(`Sound processing profile ${profileId} encode bitrate must be a positive integer no greater than 512 Kbps`)
    }
    if (formats.has(raw.format)) throw new Error(`Sound processing profile ${profileId} encode formats must be unique`)
    if (extensions.has(raw.extension)) throw new Error(`Sound processing profile ${profileId} encode extensions must be unique`)
    formats.add(raw.format)
    extensions.add(raw.extension)
    return { format: raw.format, extension: raw.extension, codec: raw.codec, bitrateKbps: raw.bitrateKbps }
  })
  if (!formats.has("webm-opus") || !(formats.has("m4a-aac") || formats.has("mp3"))) {
    throw new Error(`Sound processing profile ${profileId} requires WebM/Opus plus one fallback encode`)
  }
  return encodes.sort((left, right) => encodeOrder(left.format) - encodeOrder(right.format))
}

/** @param {unknown} rawMeasurement @param {number} index */
function validateSourceMeasurement(rawMeasurement, index) {
  const raw = requireRecord(rawMeasurement, `Source measurement at index ${index}`)
  assertOnlyFields(raw, MEASUREMENT_FIELDS, "measurement")
  const candidateId = requireKebabId(raw.candidateId, "Source measurement candidate id")
  const sourceSha256 = requireSha256(raw.sourceSha256, `Source measurement ${candidateId} checksum`)
  const durationSeconds = requireBoundedNumber(
    raw.durationSeconds,
    Number.EPSILON,
    86400,
    `Source measurement ${candidateId} duration`,
  )
  if (!Number.isSafeInteger(raw.channels) || raw.channels <= 0 || raw.channels > 32) {
    throw new Error(`Source measurement ${candidateId} channels must be a positive bounded integer`)
  }
  if (!Number.isSafeInteger(raw.sampleRateHz) || raw.sampleRateHz < 8000 || raw.sampleRateHz > 384000) {
    throw new Error(`Source measurement ${candidateId} sample rate must be a positive bounded integer`)
  }
  const measurementMethodVersion = requireKebabId(
    raw.measurementMethodVersion,
    `Source measurement ${candidateId} method version`,
  )
  return {
    candidateId,
    sourceSha256,
    durationSeconds,
    channels: raw.channels,
    sampleRateHz: raw.sampleRateHz,
    measurementMethodVersion,
  }
}

/** @param {unknown} rawAssignment @param {number} index */
function validateAssignment(rawAssignment, index) {
  const raw = requireRecord(rawAssignment, `Sound processing assignment at index ${index}`)
  assertOnlyFields(raw, ASSIGNMENT_FIELDS, "assignment")
  const candidateId = requireKebabId(raw.candidateId, "Sound processing assignment candidate id")
  const profileId = requireKebabId(raw.profileId, `Sound processing assignment ${candidateId} profile id`)
  const sourceSha256 = requireSha256(raw.sourceSha256, `Sound processing assignment ${candidateId} checksum`)
  if (!Number.isSafeInteger(raw.outputVersion) || raw.outputVersion <= 0) {
    throw new Error(`Sound processing assignment ${candidateId} output version must be an immutable positive integer`)
  }
  return { candidateId, profileId, sourceSha256, outputVersion: raw.outputVersion }
}

/** @param {unknown} rawBaseline @param {Map<string, any>} profileById @param {Map<string, string>} profileShaById */
function validatePublicationBaselineWithProfiles(rawBaseline, profileById, profileShaById) {
  const baseline = requireRecord(rawBaseline, "Sound publication baseline")
  assertOnlyFields(baseline, PUBLICATION_BASELINE_FIELDS, "publication baseline")
  if (baseline.version !== VERSION) throw new Error("Unsupported sound publication baseline version")
  if (!Number.isSafeInteger(baseline.revision) || baseline.revision < 0) {
    throw new Error("Sound publication baseline revision must be a nonnegative integer")
  }
  if (!Array.isArray(baseline.entries)) throw new Error("Sound publication baseline entries must be an array")
  const identities = new Set()
  const objectKeys = new Set()
  const entries = baseline.entries.map((entry, index) => {
    const normalized = validatePublishedOutput(entry, index, profileById, profileShaById)
    const identity = `${normalized.candidateId}:v${normalized.outputVersion}`
    if (identities.has(identity)) throw new Error(`Duplicate publication baseline entry: ${identity}`)
    identities.add(identity)
    for (const objectKey of normalized.objectKeys) {
      if (objectKeys.has(objectKey)) throw new Error(`Duplicate publication baseline object key: ${objectKey}`)
      objectKeys.add(objectKey)
    }
    return normalized
  }).sort(comparePublishedOutputs)
  return { version: VERSION, revision: baseline.revision, entries }
}

/**
 * @param {unknown} rawPublished
 * @param {number} index
 * @param {Map<string, any>} profileById
 * @param {Map<string, string>} profileShaById
 */
function validatePublishedOutput(rawPublished, index, profileById, profileShaById) {
  const raw = requireRecord(rawPublished, `Published output at index ${index}`)
  assertOnlyFields(raw, PUBLISHED_OUTPUT_FIELDS, "published output")
  const candidateId = requireKebabId(raw.candidateId, "Published output candidate id")
  const profileId = requireKebabId(raw.profileId, `Published output ${candidateId} profile id`)
  const sourceSha256 = requireSha256(raw.sourceSha256, `Published output ${candidateId} source checksum`)
  const profileSha256 = requireSha256(raw.profileSha256, `Published output ${candidateId} profile checksum`)
  const algorithmVersion = requireKebabId(raw.algorithmVersion, `Published output ${candidateId} algorithm version`)
  if (algorithmVersion !== PLANNER_ALGORITHM_VERSION) {
    throw new Error(`Published output ${candidateId} algorithm version is not supported`)
  }
  if (!Number.isSafeInteger(raw.outputVersion) || raw.outputVersion <= 0) {
    throw new Error(`Published output ${candidateId} output version must be an immutable positive integer`)
  }
  const profile = profileById.get(profileId)
  if (profile === undefined) throw new Error(`Published output ${candidateId} references an unknown profile`)
  if (profileShaById.get(profileId) !== profileSha256) {
    throw new Error(`Published output ${candidateId} profile checksum does not match the declared profile`)
  }
  if (!Array.isArray(raw.objectKeys)) throw new Error(`Published output ${candidateId} object keys must be an array`)
  const expectedObjectKeys = profile.encodes.map((encode) => buildObjectKey({
    candidateId,
    sourceSha256,
    profileId,
    profileSha256,
    algorithmVersion,
    outputVersion: raw.outputVersion,
    extension: encode.extension,
  }))
  const objectKeys = raw.objectKeys.map((key) => requireSafeRelativePath(key, `Published output ${candidateId} object key`))
  if (!sameJson(objectKeys, expectedObjectKeys)) {
    throw new Error(`Published output ${candidateId} object keys do not match immutable output identity`)
  }
  return {
    candidateId,
    profileId,
    sourceSha256,
    profileSha256,
    algorithmVersion,
    outputVersion: raw.outputVersion,
    objectKeys,
  }
}

/** @param {any} profile */
function buildCyclicMaster(profile) {
  const start = profile.trim.startSeconds
  const duration = profile.trim.targetDurationSeconds
  const crossfade = profile.loop.crossfadeSeconds
  return {
    sourceWindow: { startSeconds: start, endSeconds: start + duration + crossfade, durationSeconds: duration + crossfade },
    head: { startSeconds: start, endSeconds: start + crossfade, durationSeconds: crossfade },
    middle: { startSeconds: start + crossfade, endSeconds: start + duration, durationSeconds: duration - crossfade },
    tail: { startSeconds: start + duration, endSeconds: start + duration + crossfade, durationSeconds: crossfade },
    seam: { tailThenHeadCrossfadeSeconds: crossfade, durationSeconds: crossfade },
    concatenation: { parts: ["middle", "seam"], durationSeconds: duration },
  }
}

/** @param {any} profile @param {any} cyclicMaster */
function buildOperations(profile, cyclicMaster) {
  return [
    { type: "cyclic-master", ...structuredClone(cyclicMaster) },
    { type: "channels", value: profile.audio.channels },
    { type: "sample-rate", valueHz: profile.audio.sampleRateHz },
    {
      type: "loudness-two-pass",
      integratedLoudnessTargetLufs: profile.audio.integratedLoudnessTargetLufs,
      truePeakCeilingDbtp: profile.audio.truePeakCeilingDbtp,
      analysisRequired: true,
      processingVerification: "not-run",
    },
  ]
}

/** The cyclic filter moves the seam inside the asset; its endpoints meet at source time X. @param {any} profile */
function buildCyclicFilterGraph(profile) {
  const start = profile.trim.startSeconds
  const duration = profile.trim.targetDurationSeconds
  const crossfade = profile.loop.crossfadeSeconds
  const end = start + duration + crossfade
  return [
    `[0:a]atrim=start=${start}:end=${end},asetpts=PTS-STARTPTS,asplit=3[window-head][window-middle][window-tail]`,
    `[window-head]atrim=start=0:end=${crossfade},asetpts=PTS-STARTPTS[head]`,
    `[window-middle]atrim=start=${crossfade}:end=${duration},asetpts=PTS-STARTPTS[middle]`,
    `[window-tail]atrim=start=${duration}:end=${duration + crossfade},asetpts=PTS-STARTPTS[tail]`,
    `[tail][head]acrossfade=d=${crossfade}:c1=tri:c2=tri[seam]`,
    `[middle][seam]concat=n=2:v=0:a=1,atrim=duration=${duration},asetpts=PTS-STARTPTS[cyclic]`,
  ].join(";")
}

/** @param {any} profile @param {string} input @param {string} cyclicFilterGraph */
function buildAnalysisArgv(profile, input, cyclicFilterGraph) {
  const loudnorm = `loudnorm=I=${profile.audio.integratedLoudnessTargetLufs}:TP=${profile.audio.truePeakCeilingDbtp}:LRA=7:print_format=json`
  return [
    "ffmpeg", "-n", "-nostdin", "-hide_banner", "-loglevel", "info",
    "-i", input,
    "-filter_complex", `${cyclicFilterGraph};[cyclic]${loudnorm}[analysis]`,
    "-map", "[analysis]", "-vn", "-f", "null", "-",
  ]
}

/** @param {any} profile @param {any} encode @param {string} input @param {string} output @param {string} cyclicFilterGraph */
function buildSecondPassArgv(profile, encode, input, output, cyclicFilterGraph) {
  const layout = profile.audio.channels === 1 ? "mono" : "stereo"
  const loudnorm = [
    `loudnorm=I=${profile.audio.integratedLoudnessTargetLufs}`,
    `TP=${profile.audio.truePeakCeilingDbtp}`,
    "LRA=7",
    "measured_I={{loudnorm.measured_I}}",
    "measured_TP={{loudnorm.measured_TP}}",
    "measured_LRA={{loudnorm.measured_LRA}}",
    "measured_thresh={{loudnorm.measured_thresh}}",
    "offset={{loudnorm.offset}}",
    "linear=true",
    "print_format=summary",
  ].join(":")
  const processing = `${cyclicFilterGraph};[cyclic]${loudnorm},aformat=channel_layouts=${layout},aresample=${profile.audio.sampleRateHz}[processed]`
  return [
    "ffmpeg", "-n", "-nostdin", "-hide_banner", "-loglevel", "error",
    "-i", input,
    "-filter_complex", processing,
    "-map", "[processed]", "-vn", "-map_metadata", "-1",
    "-ac", String(profile.audio.channels), "-ar", String(profile.audio.sampleRateHz),
    ...encodeArguments(encode),
    output,
  ]
}

/** @param {any} encode */
function encodeArguments(encode) {
  const base = ["-c:a", encode.codec, "-b:a", `${encode.bitrateKbps}k`]
  if (encode.format === "webm-opus") return [...base, "-vbr", "on", "-application", "audio", "-f", "webm"]
  if (encode.format === "m4a-aac") return [...base, "-movflags", "+faststart", "-f", "mp4"]
  return [...base, "-f", "mp3"]
}

/** @param {{candidateId:string,sourceSha256:string,profileId:string,profileSha256:string,algorithmVersion:string,outputVersion:number,extension:string}} identity */
function buildObjectKey(identity) {
  const objectKey = [
    "atmoshaper", "v1", identity.candidateId, `source-${identity.sourceSha256}`,
    `profile-${identity.profileId}-${identity.profileSha256}`, `algorithm-${identity.algorithmVersion}`,
    `v${identity.outputVersion}`, `${identity.candidateId}.${identity.extension}`,
  ].join("/")
  return requireSafeRelativePath(objectKey, "Sound processing object key")
}

/** Proves lexical and canonical externality through the nearest existing ancestor. */
async function assertExternalOutputRoot(repoRoot, outputRoot) {
  if (typeof repoRoot !== "string" || repoRoot.trim() === "") {
    throw new Error("Sound processing repository or worktree root is required")
  }
  if (typeof outputRoot !== "string" || outputRoot.trim() === "") {
    throw new Error("An explicit sound processing output root is required")
  }
  if (!isAbsolute(outputRoot)) throw new Error("Sound processing output root must be absolute")
  const lexicalOutput = resolve(outputRoot)
  if (pathIdentity(lexicalOutput) === pathIdentity(parse(lexicalOutput).root)) {
    throw new Error("Sound processing output root must not be a filesystem root")
  }
  const repositoryRoots = await resolveRepositoryRoots(repoRoot)
  if (repositoryRoots.some(({ lexical, canonical }) => (
    isSameOrInside(lexical, lexicalOutput) || isSameOrInside(canonical, lexicalOutput)
  ))) {
    throw new Error("Sound processing output root must be outside the repository or worktree")
  }
  const { canonicalPath, existingDestinationIsDirectory } = await resolveThroughNearestExistingAncestor(lexicalOutput)
  if (existingDestinationIsDirectory === false) throw new Error("Sound processing output root must be a directory")
  if (pathIdentity(canonicalPath) === pathIdentity(parse(canonicalPath).root)) {
    throw new Error("Sound processing output root must not resolve to a filesystem root")
  }
  if (repositoryRoots.some(({ canonical }) => isSameOrInside(canonical, canonicalPath))) {
    throw new Error("Sound processing output root must be outside the repository or worktree")
  }
}

/**
 * Resolves both the active worktree and its linked main checkout. Git stores the
 * latter in the worktree gitfile/commondir pair, so output planning must fence
 * both roots even though only the active worktree was supplied by the caller.
 * @param {string} repoRoot
 */
async function resolveRepositoryRoots(repoRoot) {
  const lexical = resolve(repoRoot)
  let canonical
  try {
    canonical = await realpath(lexical)
    if (!(await stat(canonical)).isDirectory()) throw new Error("not a directory")
  } catch {
    throw new Error("The repository or worktree root could not be resolved")
  }

  const roots = [{ lexical, canonical }]
  const gitfilePath = resolve(lexical, ".git")
  let gitfileStat
  try {
    gitfileStat = await lstat(gitfilePath)
  } catch (error) {
    if (error?.code === "ENOENT") return roots
    throw new Error("The repository or worktree Git metadata could not be resolved")
  }
  if (!gitfileStat.isFile()) return roots

  try {
    const gitfile = await readFile(gitfilePath, "utf8")
    const match = /^gitdir:\s*(.+?)\s*$/i.exec(gitfile)
    if (match === null) throw new Error("invalid gitfile")
    const gitDirectory = resolve(dirname(gitfilePath), match[1])
    const commonDirectoryValue = (await readFile(resolve(gitDirectory, "commondir"), "utf8")).trim()
    if (commonDirectoryValue === "") throw new Error("empty commondir")
    const commonGitDirectory = await realpath(resolve(gitDirectory, commonDirectoryValue))
    if (basename(commonGitDirectory).toLowerCase() !== ".git") throw new Error("unexpected common directory")
    const mainLexical = dirname(commonGitDirectory)
    const mainCanonical = await realpath(mainLexical)
    if (!(await stat(mainCanonical)).isDirectory()) throw new Error("main checkout is not a directory")
    if (!roots.some((root) => pathIdentity(root.canonical) === pathIdentity(mainCanonical))) {
      roots.push({ lexical: mainLexical, canonical: mainCanonical })
    }
    return roots
  } catch {
    throw new Error("The linked repository root could not be resolved")
  }
}

/** @param {string} destination */
async function resolveThroughNearestExistingAncestor(destination) {
  let current = destination
  const unresolved = []
  while (true) {
    try {
      await lstat(current)
      const canonicalAncestor = await realpath(current)
      return {
        canonicalPath: resolve(canonicalAncestor, ...unresolved),
        existingDestinationIsDirectory: unresolved.length === 0
          ? (await stat(canonicalAncestor)).isDirectory()
          : undefined,
      }
    } catch (error) {
      if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) {
        throw new Error("Sound processing output root could not be resolved")
      }
      const parent = dirname(current)
      if (parent === current) throw new Error("Sound processing output root could not be resolved")
      unresolved.unshift(basename(current))
      current = parent
    }
  }
}

/** @param {string} root @param {string} destination */
function isSameOrInside(root, destination) {
  const rootRelative = relative(pathIdentity(root), pathIdentity(destination))
  return rootRelative === "" || (!rootRelative.startsWith("..") && !isAbsolute(rootRelative))
}

/** @param {string} path */
function pathIdentity(path) {
  return process.platform === "win32" ? path.toLowerCase() : path
}

/** @param {unknown} value @param {Set<string>} allowed @param {string} label */
function assertOnlyFields(value, allowed, label) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error(`Unknown ${label} field: ${key}`)
  }
}

/** @param {unknown} value @param {string} label */
function requireRecord(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`)
  }
  return /** @type {Record<string, any>} */ (value)
}

/** @param {unknown} value @param {string} label */
function requireKebabId(value, label) {
  if (typeof value !== "string" || !KEBAB_ID_PATTERN.test(value)) {
    throw new Error(`${label} must be a stable kebab-case id`)
  }
  return value
}

/** @param {unknown} value @param {string} label */
function requireSha256(value, label) {
  if (typeof value !== "string" || !SHA256_PATTERN.test(value)) {
    throw new Error(`${label} must be an exact lowercase SHA-256 checksum`)
  }
  return value
}

/** @param {unknown} value @param {number} minimum @param {number} maximum @param {string} label */
function requireBoundedNumber(value, minimum, maximum, label) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${label} must be between ${minimum} and ${maximum}`)
  }
  return value
}

/** @param {unknown} value @param {string} label */
function requireSafeRelativePath(value, label) {
  if (typeof value !== "string" || value.trim() === "" || value !== value.trim() || value.includes("\\")) {
    throw new Error(`${label} must be a safe forward-slash relative path`)
  }
  const segments = value.split("/")
  if (
    value.startsWith("/")
    || /^[A-Za-z][A-Za-z\d+.-]*:/.test(value)
    || segments.some((segment) => segment === "" || segment === "." || segment === "..")
    || /[?#\u0000-\u001f\u007f]/.test(value)
  ) {
    throw new Error(`${label} must be a safe forward-slash relative path`)
  }
  return value
}

/** @param {string} format */
function encodeOrder(format) {
  if (format === "webm-opus") return 0
  if (format === "m4a-aac") return 1
  return 2
}

/** @param {any} left @param {any} right */
function compareMeasurements(left, right) {
  return compareText(left.candidateId, right.candidateId) || compareText(left.sourceSha256, right.sourceSha256)
}

/** @param {any} left @param {any} right */
function comparePublishedOutputs(left, right) {
  return compareText(left.candidateId, right.candidateId) || left.outputVersion - right.outputVersion
}

/** @param {unknown} value */
function fingerprintCanonicalJson(value) {
  return createHash("sha256").update(JSON.stringify(canonicalizeJson(value))).digest("hex")
}

/** @param {any} value @returns {any} */
function canonicalizeJson(value) {
  if (Array.isArray(value)) return value.map(canonicalizeJson)
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort(compareText).map((key) => [key, canonicalizeJson(value[key])]))
  }
  return value
}

/** @param {unknown} left @param {unknown} right */
function sameJson(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

/** @param {string} left @param {string} right */
function compareText(left, right) {
  if (left < right) return -1
  if (left > right) return 1
  return 0
}
