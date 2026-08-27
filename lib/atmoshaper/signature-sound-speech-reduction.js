// @ts-check

import { createHash } from "node:crypto"

import { createSignatureSoundDiscoveryReviewFingerprint } from "./signature-sound-review-fingerprints.js"

/** @typedef {Record<string, any>} JsonRecord */

const SHA256 = /^[a-f0-9]{64}$/
const DECLARATION_FIELDS = new Set([
  "version", "algorithmVersion", "outputVersion", "discoveryReviewSha256",
  "model", "format", "concepts",
])
const MODEL_FIELDS = new Set([
  "name", "demucsVersion", "backend", "device", "twoStems", "weightFileName",
  "weightSha256", "configurationFileName", "configurationSha256", "adapterVersion", "adapterSha256",
  "pythonExecutableSha256", "demucsPackageSha256",
])
const FORMAT_FIELDS = new Set([
  "sampleRateHz", "bitsPerSample", "channels", "codecName", "truePeakCeilingDbtp",
  "measurementMethod", "requiredFfmpegVersion", "requiredFfprobeVersion",
  "ffmpegExecutableSha256", "ffprobeExecutableSha256",
])
const CONCEPT_FIELDS = new Set([
  "batchId", "groupId", "reviewFingerprint", "outputSlug", "mixPolicy",
  "vocalsGainDb", "sourceIds",
])
const RECEIPT_FIELDS = new Set([
  "version", "algorithmVersion", "declarationSha256", "outputIdentity", "batchId",
  "groupId", "sourceId", "sourceSha256", "sourceByteSize", "inputRelativePath",
  "mixPolicy", "vocalsGainDb", "toolchain", "inputMeasurement",
  "separatedMeasurement", "matchingGainDb", "targetIntegratedLoudnessLufs",
  "outputRelativePath", "outputMeasurement",
])
const TOOLCHAIN_FIELDS = new Set([
  "adapterVersion", "adapterSha256", "pythonVersion", "pythonExecutableSha256", "demucsVersion", "demucsPackageSha256",
  "backend", "device", "modelName", "modelWeightFileName", "modelWeightSha256",
  "modelConfigurationFileName", "modelConfigurationSha256", "ffmpegVersion", "ffprobeVersion",
  "ffmpegExecutableSha256", "ffprobeExecutableSha256",
])
const MEASUREMENT_FIELDS = new Set([
  "durationSeconds", "sampleRateHz", "channels", "bitsPerSample", "codecName",
  "integratedLoudnessLufs", "truePeakDbtp",
])
const OUTPUT_MEASUREMENT_FIELDS = new Set([...MEASUREMENT_FIELDS, "outputSha256", "byteSize"])
const MANIFEST_FIELDS = new Set([
  "version", "algorithmVersion", "declarationSha256", "outputVersion", "model", "format", "outputs",
])

/** @type {Map<string, JsonRecord>} */
const FIXED_CONCEPTS = new Map([
  ["batch-21-traffic", {
    groupId: "moodist:traffic",
    outputSlug: "traffic",
    mixPolicy: "no-vocals-only",
    vocalsGainDb: null,
    sourceCount: 9,
  }],
  ["batch-35-london-ambience", {
    groupId: "signature-extra:london-ambience",
    outputSlug: "london-ambience",
    mixPolicy: "reduced-vocals-mix",
    vocalsGainDb: -20,
    sourceCount: 12,
  }],
  ["batch-45-stadium-crowd", {
    groupId: "signature-extra:stadium-crowd",
    outputSlug: "stadium-crowd",
    mixPolicy: "reduced-vocals-mix",
    vocalsGainDb: -12,
    sourceCount: 6,
  }],
])

/**
 * Closes the three speech-reduction concepts over their exact review entries
 * and discovery-owned file identities. The returned sources always include
 * the discovery checksum and byte size needed for physical preflight.
 * @param {unknown} rawDeclaration
 * @param {{discoveryReview: unknown, reviewEntries: unknown[], sourceCountOverrides?:Record<string,number>}} context
 * @returns {JsonRecord}
 */
export function validateSignatureSoundSpeechReductionDeclaration(rawDeclaration, {
  discoveryReview,
  reviewEntries,
  sourceCountOverrides = {},
}) {
  const declaration = requireRecord(rawDeclaration, "Speech-reduction declaration")
  assertOnlyFields(declaration, DECLARATION_FIELDS, "Speech-reduction declaration")
  if (declaration.version !== 1 || declaration.algorithmVersion !== "signature-speech-reduction-v1") {
    throw new Error("Speech-reduction declaration identity is invalid")
  }
  const outputVersion = requirePositiveInteger(declaration.outputVersion, "Speech-reduction output version")
  const expectedDiscoverySha256 = requireSha256(
    declaration.discoveryReviewSha256,
    "Speech-reduction discovery fingerprint",
  )
  const discovery = requireRecord(discoveryReview, "Speech-reduction discovery review")
  const discoveryFingerprint = requireSha256(
    requireRecord(discovery.fingerprints, "Speech-reduction discovery fingerprints").reviewSha256,
    "Speech-reduction discovery owner fingerprint",
  )
  if (expectedDiscoverySha256 !== discoveryFingerprint ||
      createSignatureSoundDiscoveryReviewFingerprint(discovery) !== discoveryFingerprint) {
    throw new Error("Speech-reduction discovery fingerprint is stale")
  }
  if (!Array.isArray(discovery.sources)) throw new Error("Speech-reduction discovery sources are invalid")
  if (!Array.isArray(reviewEntries)) throw new Error("Speech-reduction review entries are invalid")

  const fixedConcepts = applySourceCountOverrides(sourceCountOverrides)
  const model = normalizeModel(declaration.model)
  const format = normalizeFormat(declaration.format)
  if (!Array.isArray(declaration.concepts) || declaration.concepts.length !== FIXED_CONCEPTS.size) {
    throw new Error("Speech-reduction declaration must contain the three fixed concepts")
  }
  const sourceById = uniqueIndex(discovery.sources.map(indexDiscoverySource), ({ sourceId }) => sourceId, "discovery source")
  const reviewByBatch = uniqueIndex(reviewEntries.map(normalizeReviewEntry), ({ batchId }) => batchId, "review batch")
  const concepts = declaration.concepts.map((rawConcept, index) => normalizeConcept(
    rawConcept,
    index,
    reviewByBatch,
    sourceById,
    fixedConcepts,
  ))
  const conceptByBatch = uniqueIndex(concepts, ({ batchId }) => batchId, "speech concept")
  for (const batchId of fixedConcepts.keys()) {
    if (!conceptByBatch.has(batchId)) throw new Error(`Speech-reduction declaration is missing ${batchId}`)
  }
  const allSources = concepts.flatMap(({ sources }) => sources)
  const expectedAssignments = [...fixedConcepts.values()].reduce((sum, { sourceCount }) => sum + sourceCount, 0)
  if (allSources.length !== expectedAssignments) {
    throw new Error(`Speech-reduction declaration must bind exactly ${expectedAssignments} assignments`)
  }

  const normalized = {
    version: 1,
    algorithmVersion: declaration.algorithmVersion,
    outputVersion,
    discoveryReviewSha256: discoveryFingerprint,
    model,
    format,
    concepts,
  }
  return { ...normalized, declarationSha256: sha256(normalized) }
}

/** Creates deterministic bundle identities without touching source or output roots. */
/** @param {JsonRecord} normalizedDeclaration @returns {JsonRecord} */
export function planSignatureSoundSpeechReduction(normalizedDeclaration) {
  const declaration = requireNormalizedDeclaration(normalizedDeclaration)
  const concepts = /** @type {JsonRecord[]} */ (declaration.concepts)
  return {
    version: 1,
    algorithmVersion: declaration.algorithmVersion,
    declarationSha256: declaration.declarationSha256,
    outputVersion: declaration.outputVersion,
    model: copy(declaration.model),
    format: copy(declaration.format),
    outputs: concepts.flatMap((concept) => /** @type {JsonRecord[]} */ (concept.sources).map((source) => {
      const identityInputs = {
        declarationSha256: declaration.declarationSha256,
        outputVersion: declaration.outputVersion,
        batchId: concept.batchId,
        groupId: concept.groupId,
        sourceId: source.sourceId,
        sourceSha256: source.sha256,
        sourceByteSize: source.byteSize,
        mixPolicy: concept.mixPolicy,
        vocalsGainDb: concept.vocalsGainDb,
        model: declaration.model,
        format: declaration.format,
      }
      const bundleRelativePath = `artifacts/${concept.outputSlug}/${source.sourceId}`
      return {
        batchId: concept.batchId,
        groupId: concept.groupId,
        sourceId: source.sourceId,
        sourceSha256: source.sha256,
        sourceByteSize: source.byteSize,
        inputRelativePath: source.relativePath,
        mixPolicy: concept.mixPolicy,
        vocalsGainDb: concept.vocalsGainDb,
        outputIdentity: sha256(identityInputs),
        identityInputs,
        bundleRelativePath,
        outputRelativePath: `${bundleRelativePath}/audio.wav`,
        receiptRelativePath: `${bundleRelativePath}/receipt.json`,
      }
    })),
  }
}

/**
 * Matches the separated treatment to the source's integrated loudness while
 * capping positive gain at the declared true-peak ceiling.
 * @param {{inputIntegratedLoudnessLufs: number, separatedIntegratedLoudnessLufs: number, separatedTruePeakDbtp: number, truePeakCeilingDbtp: number}} measurements
 * @returns {{desiredGainDb: number, peakSafeGainDb: number, matchingGainDb: number, targetIntegratedLoudnessLufs: number, peakLimited: boolean}}
 */
export function calculateSignatureSoundSpeechLoudnessMatch({
  inputIntegratedLoudnessLufs,
  separatedIntegratedLoudnessLufs,
  separatedTruePeakDbtp,
  truePeakCeilingDbtp,
}) {
  const inputLufs = requireRange(inputIntegratedLoudnessLufs, -70, 0, "Speech input loudness")
  const separatedLufs = requireRange(separatedIntegratedLoudnessLufs, -70, 0, "Speech treatment loudness")
  const separatedPeak = requireRange(separatedTruePeakDbtp, -100, 20, "Speech treatment true peak")
  const ceiling = requireRange(truePeakCeilingDbtp, -20, 0, "Speech true-peak ceiling")
  const desiredGainDb = inputLufs - separatedLufs
  const peakSafeGainDb = ceiling - separatedPeak
  const matchingGainDb = round(Math.min(desiredGainDb, peakSafeGainDb), 3)
  return {
    desiredGainDb: round(desiredGainDb, 3),
    peakSafeGainDb: round(peakSafeGainDb, 3),
    matchingGainDb,
    targetIntegratedLoudnessLufs: round(separatedLufs + matchingGainDb, 3),
    peakLimited: peakSafeGainDb < desiredGainDb,
  }
}

/**
 * Builds the fixed CPU two-stem invocation through the checksum-bound adapter.
 * @param {JsonRecord} planOutput
 * @param {{ripxPython: string, adapterPath: string, ripScriptLib: string, modelRepo: string, outputDirectory: string, inputPath: string}} paths
 * @returns {string[]}
 */
export function buildSignatureSoundDemucsAdapterArgv(planOutput, {
  ripxPython,
  adapterPath,
  ripScriptLib,
  modelRepo,
  outputDirectory,
  inputPath,
}) {
  requirePlanOutput(planOutput)
  return [
    requireString(ripxPython, "RipX Python path"),
    "-B",
    requireString(adapterPath, "Demucs adapter path"),
    "--rip-script-lib", requireString(ripScriptLib, "RipScriptLib path"),
    "separate",
    "--model-repo", requireString(modelRepo, "HTDemucs model repository"),
    "--output-dir", requireString(outputDirectory, "Demucs output directory"),
    "--input", requireString(inputPath, "Demucs input path"),
  ]
}

/**
 * Builds the declared stem mix and canonical 48 kHz/24-bit intermediate.
 * @param {JsonRecord} planOutput
 * @param {{ffmpegCommand: string, noVocalsPath: string, vocalsPath: string, outputPath: string, format: unknown}} options
 * @returns {string[]}
 */
export function buildSignatureSoundSpeechStemMixArgv(planOutput, {
  ffmpegCommand,
  noVocalsPath,
  vocalsPath,
  outputPath,
  format,
}) {
  const output = requirePlanOutput(planOutput)
  const normalizedFormat = normalizeFormat(format)
  const argv = [
    requireString(ffmpegCommand, "FFmpeg command"), "-n", "-nostdin", "-hide_banner", "-loglevel", "error",
    "-i", requireString(noVocalsPath, "No-vocals stem path"),
  ]
  let filter
  if (output.mixPolicy === "no-vocals-only") {
    filter = `[0:a]aresample=${normalizedFormat.sampleRateHz},aformat=sample_fmts=s32:channel_layouts=stereo[mix]`
  } else {
    argv.push("-i", requireString(vocalsPath, "Vocals stem path"))
    filter = [
      "[0:a]volume=0dB[bed]",
      `[1:a]volume=${output.vocalsGainDb}dB[voice]`,
      `[bed][voice]amix=inputs=2:duration=longest:dropout_transition=0:normalize=0,aresample=${normalizedFormat.sampleRateHz},aformat=sample_fmts=s32:channel_layouts=stereo[mix]`,
    ].join(";")
  }
  return [
    ...argv,
    "-filter_complex", filter, "-map", "[mix]", "-vn",
    "-ac", String(normalizedFormat.channels), "-ar", String(normalizedFormat.sampleRateHz),
    "-c:a", normalizedFormat.codecName, requireString(outputPath, "Speech mix output path"),
  ]
}

/**
 * Builds the final constant-gain loudness match; no spectral or dynamics treatment is introduced.
 * @param {{matchingGainDb: number}} match
 * @param {{ffmpegCommand: string, inputPath: string, outputPath: string, format: unknown}} options
 * @returns {string[]}
 */
export function buildSignatureSoundSpeechMatchArgv({ matchingGainDb }, {
  ffmpegCommand,
  inputPath,
  outputPath,
  format,
}) {
  const gainDb = requireRange(matchingGainDb, -100, 100, "Speech matching gain")
  const normalizedFormat = normalizeFormat(format)
  return [
    requireString(ffmpegCommand, "FFmpeg command"), "-n", "-nostdin", "-hide_banner", "-loglevel", "error",
    "-i", requireString(inputPath, "Speech match input path"), "-map", "0:a:0", "-vn",
    "-af", `volume=${Object.is(gainDb, -0) ? 0 : gainDb}dB,aresample=${normalizedFormat.sampleRateHz},aformat=sample_fmts=s32:channel_layouts=stereo`,
    "-ac", String(normalizedFormat.channels), "-ar", String(normalizedFormat.sampleRateHz),
    "-c:a", normalizedFormat.codecName, requireString(outputPath, "Speech match output path"),
  ]
}

/**
 * Validates a resumable bundle receipt against both its plan and output measurements.
 * @param {unknown} rawReceipt
 * @param {{declaration: JsonRecord, planOutput: JsonRecord}} context
 * @returns {JsonRecord}
 */
export function validateSignatureSoundSpeechReductionReceipt(rawReceipt, {
  declaration,
  planOutput,
}) {
  const normalizedDeclaration = requireNormalizedDeclaration(declaration)
  const expected = requirePlanOutput(planOutput)
  const receipt = requireRecord(rawReceipt, "Speech-reduction receipt")
  assertOnlyFields(receipt, RECEIPT_FIELDS, "Speech-reduction receipt")
  const exactFields = {
    version: 1,
    algorithmVersion: normalizedDeclaration.algorithmVersion,
    declarationSha256: normalizedDeclaration.declarationSha256,
    outputIdentity: expected.outputIdentity,
    batchId: expected.batchId,
    groupId: expected.groupId,
    sourceId: expected.sourceId,
    sourceSha256: expected.sourceSha256,
    sourceByteSize: expected.sourceByteSize,
    inputRelativePath: expected.inputRelativePath,
    mixPolicy: expected.mixPolicy,
    vocalsGainDb: expected.vocalsGainDb,
    outputRelativePath: expected.outputRelativePath,
  }
  for (const [field, value] of Object.entries(exactFields)) {
    if (receipt[field] !== value) throw new Error(`Speech-reduction receipt ${field} does not match its plan`)
  }
  const toolchain = normalizeToolchain(receipt.toolchain, normalizedDeclaration)
  const inputMeasurement = normalizeMeasurement(receipt.inputMeasurement, "Speech input measurement")
  const separatedMeasurement = normalizeMeasurement(receipt.separatedMeasurement, "Speech separated measurement")
  const matchingGainDb = requireRange(receipt.matchingGainDb, -100, 100, "Speech matching gain")
  const match = calculateSignatureSoundSpeechLoudnessMatch({
    inputIntegratedLoudnessLufs: inputMeasurement.integratedLoudnessLufs,
    separatedIntegratedLoudnessLufs: separatedMeasurement.integratedLoudnessLufs,
    separatedTruePeakDbtp: separatedMeasurement.truePeakDbtp,
    truePeakCeilingDbtp: normalizedDeclaration.format.truePeakCeilingDbtp,
  })
  if (matchingGainDb !== match.matchingGainDb || receipt.targetIntegratedLoudnessLufs !== match.targetIntegratedLoudnessLufs) {
    throw new Error("Speech-reduction receipt loudness match does not match its measurements")
  }
  const outputMeasurement = normalizeOutputMeasurement(receipt.outputMeasurement)
  const format = normalizedDeclaration.format
  if (outputMeasurement.sampleRateHz !== format.sampleRateHz ||
      outputMeasurement.channels !== format.channels ||
      outputMeasurement.bitsPerSample !== format.bitsPerSample ||
      outputMeasurement.codecName !== format.codecName) {
    throw new Error("Speech-reduction receipt output format is invalid")
  }
  if (outputMeasurement.truePeakDbtp > format.truePeakCeilingDbtp + 0.1) {
    throw new Error("Speech-reduction receipt output exceeds its true-peak ceiling")
  }
  if (Math.abs(outputMeasurement.integratedLoudnessLufs - match.targetIntegratedLoudnessLufs) > 0.3) {
    throw new Error("Speech-reduction receipt output loudness does not match its target")
  }
  if (Math.abs(outputMeasurement.durationSeconds - separatedMeasurement.durationSeconds) > 0.1) {
    throw new Error("Speech-reduction receipt output duration changed unexpectedly")
  }
  if (Math.abs(separatedMeasurement.durationSeconds - inputMeasurement.durationSeconds) > 0.1 ||
      Math.abs(outputMeasurement.durationSeconds - inputMeasurement.durationSeconds) > 0.1) {
    throw new Error("Speech-reduction receipt treatment duration does not match its source")
  }
  return copy({ ...exactFields, toolchain, inputMeasurement, separatedMeasurement, matchingGainDb, targetIntegratedLoudnessLufs: match.targetIntegratedLoudnessLufs, outputMeasurement })
}

/** Creates the only complete-catalog publication identity from all 27 receipts. */
/** @param {unknown[]} receipts @param {JsonRecord} declaration @returns {JsonRecord} */
export function createSignatureSoundSpeechReductionManifest(receipts, declaration) {
  const normalizedDeclaration = requireNormalizedDeclaration(declaration)
  const plan = planSignatureSoundSpeechReduction(normalizedDeclaration)
  const plannedOutputs = /** @type {JsonRecord[]} */ (plan.outputs)
  if (!Array.isArray(receipts) || receipts.length !== plannedOutputs.length) {
    throw new Error("Speech-reduction manifest requires every planned receipt")
  }
  const byIdentity = uniqueIndex(receipts.map((receipt) => requireRecord(receipt, "Speech-reduction manifest receipt")), ({ outputIdentity }) => outputIdentity, "receipt output")
  const outputs = plannedOutputs.map((output) => {
    const receipt = byIdentity.get(output.outputIdentity)
    if (!receipt) throw new Error(`Speech-reduction manifest is missing ${output.sourceId}`)
    return validateSignatureSoundSpeechReductionReceipt(receipt, { declaration: normalizedDeclaration, planOutput: output })
  })
  return {
    version: 1,
    algorithmVersion: normalizedDeclaration.algorithmVersion,
    declarationSha256: normalizedDeclaration.declarationSha256,
    outputVersion: normalizedDeclaration.outputVersion,
    model: copy(normalizedDeclaration.model),
    format: copy(normalizedDeclaration.format),
    outputs,
  }
}

/** Rejects manifest drift by reconstructing the complete receipt set. */
/** @param {unknown} rawManifest @param {JsonRecord} declaration @returns {JsonRecord} */
export function validateSignatureSoundSpeechReductionManifest(rawManifest, declaration) {
  const manifest = requireRecord(rawManifest, "Speech-reduction manifest")
  assertOnlyFields(manifest, MANIFEST_FIELDS, "Speech-reduction manifest")
  const normalizedDeclaration = requireNormalizedDeclaration(declaration)
  if (manifest.version !== 1 || manifest.algorithmVersion !== normalizedDeclaration.algorithmVersion ||
      manifest.declarationSha256 !== normalizedDeclaration.declarationSha256 ||
      manifest.outputVersion !== normalizedDeclaration.outputVersion ||
      stableJson(manifest.model) !== stableJson(normalizedDeclaration.model) ||
      stableJson(manifest.format) !== stableJson(normalizedDeclaration.format)) {
    throw new Error("Speech-reduction manifest identity does not match its declaration")
  }
  return createSignatureSoundSpeechReductionManifest(manifest.outputs, normalizedDeclaration)
}

/** @param {unknown} rawModel @returns {JsonRecord} */
function normalizeModel(rawModel) {
  const model = requireRecord(rawModel, "Speech-reduction model")
  assertOnlyFields(model, MODEL_FIELDS, "Speech-reduction model")
  const normalized = /** @type {JsonRecord} */ ({
    name: requireString(model.name, "Speech-reduction model name"),
    demucsVersion: requireString(model.demucsVersion, "Speech-reduction Demucs version"),
    backend: requireString(model.backend, "Speech-reduction backend"),
    device: requireString(model.device, "Speech-reduction device"),
    twoStems: requireString(model.twoStems, "Speech-reduction stem mode"),
    weightFileName: requirePortableFileName(model.weightFileName, "Speech-reduction weight file"),
    weightSha256: requireSha256(model.weightSha256, "Speech-reduction weight checksum"),
    configurationFileName: requirePortableFileName(model.configurationFileName, "Speech-reduction model configuration file"),
    configurationSha256: requireSha256(model.configurationSha256, "Speech-reduction model configuration checksum"),
    adapterVersion: requireString(model.adapterVersion, "Speech-reduction adapter version"),
    adapterSha256: requireSha256(model.adapterSha256, "Speech-reduction adapter checksum"),
    pythonExecutableSha256: requireSha256(model.pythonExecutableSha256, "Speech-reduction Python executable checksum"),
    demucsPackageSha256: requireSha256(model.demucsPackageSha256, "Speech-reduction Demucs package checksum"),
  })
  const expected = /** @type {JsonRecord} */ ({
    name: "htdemucs",
    demucsVersion: "4.0.0",
    backend: "ripx-cpu",
    device: "cpu",
    twoStems: "vocals",
    weightFileName: "955717e8-8726e21a.th",
    weightSha256: "8726e21a993978c7ba086d3872e7608d7d5bfca646ca4aca459ffda844faa8b4",
    configurationFileName: "htdemucs.yaml",
    configurationSha256: "239c445d0b14454d541ad8bd9bb271c9e536d267e8a4625208744cbb2e7bb66c",
    adapterVersion: "atmoshaper-ripx-demucs-v1",
    adapterSha256: "fdb2a6a073f73a2644ebded765f18483eb2f7c672878d1714bb206484f45fbe5",
    pythonExecutableSha256: "6dec84f172d412942bf5492e7a965f13b15c7843e6485cb831c14b786aaf616a",
    demucsPackageSha256: "9ef77c767ccf41bc4890d6489cb9c88152408a79aa76c733c455179d8f74d880",
  })
  for (const [field, value] of Object.entries(expected)) {
    if (normalized[field] !== value) throw new Error(`Speech-reduction model ${field} is unsupported`)
  }
  return normalized
}

/** @param {unknown} rawFormat @returns {JsonRecord} */
function normalizeFormat(rawFormat) {
  const format = requireRecord(rawFormat, "Speech-reduction format")
  assertOnlyFields(format, FORMAT_FIELDS, "Speech-reduction format")
  const normalized = {
    sampleRateHz: requirePositiveInteger(format.sampleRateHz, "Speech-reduction sample rate"),
    bitsPerSample: requirePositiveInteger(format.bitsPerSample, "Speech-reduction bit depth"),
    channels: requirePositiveInteger(format.channels, "Speech-reduction channels"),
    codecName: requireString(format.codecName, "Speech-reduction codec"),
    truePeakCeilingDbtp: requireRange(format.truePeakCeilingDbtp, -20, 0, "Speech-reduction true-peak ceiling"),
    measurementMethod: requireString(format.measurementMethod, "Speech-reduction measurement method"),
    requiredFfmpegVersion: requireString(format.requiredFfmpegVersion, "Speech-reduction FFmpeg version"),
    requiredFfprobeVersion: requireString(format.requiredFfprobeVersion, "Speech-reduction FFprobe version"),
    ffmpegExecutableSha256: requireSha256(format.ffmpegExecutableSha256, "Speech-reduction FFmpeg executable checksum"),
    ffprobeExecutableSha256: requireSha256(format.ffprobeExecutableSha256, "Speech-reduction FFprobe executable checksum"),
  }
  if (normalized.sampleRateHz !== 48000 || normalized.bitsPerSample !== 24 ||
      normalized.channels !== 2 || normalized.codecName !== "pcm_s24le" ||
      normalized.measurementMethod !== "ffmpeg-ebur128-v1" ||
      normalized.requiredFfmpegVersion !== "ffmpeg version 9.0-full_build-www.gyan.dev" ||
      normalized.requiredFfprobeVersion !== "ffprobe version 9.0-full_build-www.gyan.dev" ||
      normalized.ffmpegExecutableSha256 !== "05f4251bce9293c2ab492cb17ca7724a0ffd0d06c881ba2ee83b82a89c2fc740" ||
      normalized.ffprobeExecutableSha256 !== "51e0780cd881f83749b029ed716cbb841c2eac6289f418050f2f2961b158896b") {
    throw new Error("Speech-reduction canonical output format is unsupported")
  }
  return normalized
}

/**
 * @param {unknown} rawConcept
 * @param {number} index
 * @param {Map<string, JsonRecord>} reviewByBatch
 * @param {Map<string, JsonRecord>} sourceById
 * @param {Map<string, JsonRecord>} fixedConcepts
 * @returns {JsonRecord}
 */
function normalizeConcept(rawConcept, index, reviewByBatch, sourceById, fixedConcepts) {
  const label = `Speech-reduction concept ${index}`
  const concept = requireRecord(rawConcept, label)
  assertOnlyFields(concept, CONCEPT_FIELDS, label)
  const batchId = requireString(concept.batchId, `${label} batch`)
  const fixed = fixedConcepts.get(batchId)
  if (!fixed) throw new Error(`${label} batch is unsupported`)
  const exactFields = ["groupId", "outputSlug", "mixPolicy", "vocalsGainDb"]
  for (const field of exactFields) {
    if (concept[field] !== fixed[field]) throw new Error(`${label} ${field} is unsupported`)
  }
  const review = reviewByBatch.get(batchId)
  if (!review || review.groupId !== fixed.groupId) throw new Error(`${label} review entry is missing`)
  const reviewFingerprint = requireSha256(concept.reviewFingerprint, `${label} review fingerprint`)
  if (reviewFingerprint !== review.reviewFingerprint) throw new Error(`${label} review fingerprint is stale`)
  if (!Array.isArray(concept.sourceIds) || concept.sourceIds.length !== fixed.sourceCount) {
    throw new Error(`${label} source count is invalid`)
  }
  const sourceIds = concept.sourceIds.map((sourceId) => requireSha256(sourceId, `${label} source`))
  if (stableJson(sourceIds) !== stableJson(review.sourceIds)) throw new Error(`${label} sources do not match the exact review pool`)
  const sources = sourceIds.map((sourceId) => {
    const rawSource = sourceById.get(sourceId)
    if (!rawSource) throw new Error(`${label} source is absent from discovery: ${sourceId}`)
    return normalizeDiscoverySource(rawSource)
  })
  return { batchId, groupId: fixed.groupId, reviewFingerprint, outputSlug: fixed.outputSlug, mixPolicy: fixed.mixPolicy, vocalsGainDb: fixed.vocalsGainDb, sources }
}

/**
 * Retained immutable bundles may predate a source-pool reduction. Overrides
 * change only expected cardinality; every exact source and declaration hash is
 * still validated through the normal discovery/review chain.
 * @param {Record<string,number>} rawOverrides
 */
function applySourceCountOverrides(rawOverrides) {
  const overrides = requireRecord(rawOverrides, "Speech-reduction source-count overrides")
  const fixedConcepts = new Map([...FIXED_CONCEPTS].map(([batchId, fixed]) => [batchId, { ...fixed }]))
  for (const [batchId, rawCount] of Object.entries(overrides)) {
    const fixed = fixedConcepts.get(batchId)
    if (!fixed) throw new Error(`Speech-reduction source-count override batch is unsupported: ${batchId}`)
    fixedConcepts.set(batchId, {
      ...fixed,
      sourceCount: requirePositiveInteger(rawCount, `Speech-reduction ${batchId} source-count override`),
    })
  }
  return fixedConcepts
}

/** @param {unknown} rawSource @returns {JsonRecord} */
function normalizeDiscoverySource(rawSource) {
  const source = requireRecord(rawSource, "Speech-reduction discovery source")
  return {
    sourceId: requireSha256(source.sourceId, "Speech-reduction discovery source id"),
    sha256: requireSha256(source.sha256, "Speech-reduction discovery source checksum"),
    byteSize: requirePositiveInteger(source.byteSize, "Speech-reduction discovery source byte size"),
    relativePath: requireSafeRelativePath(source.relativePath, "Speech-reduction discovery source path"),
  }
}

/** @param {unknown} rawSource @returns {JsonRecord} */
function indexDiscoverySource(rawSource) {
  const source = requireRecord(rawSource, "Speech-reduction discovery source")
  return { ...source, sourceId: requireSha256(source.sourceId, "Speech-reduction discovery source id") }
}

/** @param {unknown} rawEntry @returns {JsonRecord} */
function normalizeReviewEntry(rawEntry) {
  const entry = requireRecord(rawEntry, "Speech-reduction review entry")
  if (!Array.isArray(entry.sources)) throw new Error("Speech-reduction review sources are invalid")
  return {
    batchId: requireString(entry.batchId, "Speech-reduction review batch"),
    groupId: requireString(entry.groupId, "Speech-reduction review group"),
    reviewFingerprint: requireSha256(entry.reviewFingerprint, "Speech-reduction review fingerprint"),
    sourceIds: entry.sources.map((source) => requireSha256(requireRecord(source, "Speech-reduction review source").sourceId, "Speech-reduction review source id")),
  }
}

/** @param {unknown} rawToolchain @param {JsonRecord} declaration @returns {JsonRecord} */
function normalizeToolchain(rawToolchain, declaration) {
  const toolchain = requireRecord(rawToolchain, "Speech-reduction toolchain")
  assertOnlyFields(toolchain, TOOLCHAIN_FIELDS, "Speech-reduction toolchain")
  const normalized = /** @type {JsonRecord} */ ({
    adapterVersion: requireString(toolchain.adapterVersion, "Speech adapter version"),
    adapterSha256: requireSha256(toolchain.adapterSha256, "Speech adapter checksum"),
    pythonVersion: requireString(toolchain.pythonVersion, "Speech Python version"),
    pythonExecutableSha256: requireSha256(toolchain.pythonExecutableSha256, "Speech Python executable checksum"),
    demucsVersion: requireString(toolchain.demucsVersion, "Speech Demucs version"),
    demucsPackageSha256: requireSha256(toolchain.demucsPackageSha256, "Speech Demucs package checksum"),
    backend: requireString(toolchain.backend, "Speech backend"),
    device: requireString(toolchain.device, "Speech device"),
    modelName: requireString(toolchain.modelName, "Speech model name"),
    modelWeightFileName: requireString(toolchain.modelWeightFileName, "Speech model weight file"),
    modelWeightSha256: requireSha256(toolchain.modelWeightSha256, "Speech model weight checksum"),
    modelConfigurationFileName: requireString(toolchain.modelConfigurationFileName, "Speech model configuration file"),
    modelConfigurationSha256: requireSha256(toolchain.modelConfigurationSha256, "Speech model configuration checksum"),
    ffmpegVersion: requireString(toolchain.ffmpegVersion, "Speech FFmpeg version"),
    ffprobeVersion: requireString(toolchain.ffprobeVersion, "Speech FFprobe version"),
    ffmpegExecutableSha256: requireSha256(toolchain.ffmpegExecutableSha256, "Speech FFmpeg executable checksum"),
    ffprobeExecutableSha256: requireSha256(toolchain.ffprobeExecutableSha256, "Speech FFprobe executable checksum"),
  })
  const model = declaration.model
  const format = declaration.format
  const expected = /** @type {JsonRecord} */ ({
    adapterVersion: model.adapterVersion,
    adapterSha256: model.adapterSha256,
    pythonExecutableSha256: model.pythonExecutableSha256,
    demucsVersion: model.demucsVersion,
    demucsPackageSha256: model.demucsPackageSha256,
    backend: model.backend,
    device: model.device,
    modelName: model.name,
    modelWeightFileName: model.weightFileName,
    modelWeightSha256: model.weightSha256,
    modelConfigurationFileName: model.configurationFileName,
    modelConfigurationSha256: model.configurationSha256,
    ffmpegVersion: format.requiredFfmpegVersion,
    ffprobeVersion: format.requiredFfprobeVersion,
    ffmpegExecutableSha256: format.ffmpegExecutableSha256,
    ffprobeExecutableSha256: format.ffprobeExecutableSha256,
  })
  for (const [field, value] of Object.entries(expected)) {
    if (normalized[field] !== value) throw new Error(`Speech-reduction toolchain ${field} does not match its declaration`)
  }
  return normalized
}

/** @param {unknown} rawMeasurement @param {string} label @returns {JsonRecord} */
function normalizeMeasurement(rawMeasurement, label) {
  const measurement = requireRecord(rawMeasurement, label)
  assertOnlyFields(measurement, MEASUREMENT_FIELDS, label)
  return {
    durationSeconds: requirePositiveNumber(measurement.durationSeconds, `${label} duration`),
    sampleRateHz: requirePositiveInteger(measurement.sampleRateHz, `${label} sample rate`),
    channels: requirePositiveInteger(measurement.channels, `${label} channels`),
    bitsPerSample: requireNonnegativeInteger(measurement.bitsPerSample, `${label} bit depth`),
    codecName: requireString(measurement.codecName, `${label} codec`),
    integratedLoudnessLufs: requireRange(measurement.integratedLoudnessLufs, -70, 0, `${label} loudness`),
    truePeakDbtp: requireRange(measurement.truePeakDbtp, -100, 20, `${label} true peak`),
  }
}

/** @param {unknown} rawMeasurement @returns {JsonRecord} */
function normalizeOutputMeasurement(rawMeasurement) {
  const measurement = requireRecord(rawMeasurement, "Speech output measurement")
  assertOnlyFields(measurement, OUTPUT_MEASUREMENT_FIELDS, "Speech output measurement")
  return {
    ...normalizeMeasurement(Object.fromEntries(Object.entries(measurement).filter(([field]) => MEASUREMENT_FIELDS.has(field))), "Speech output measurement"),
    outputSha256: requireSha256(measurement.outputSha256, "Speech output checksum"),
    byteSize: requirePositiveInteger(measurement.byteSize, "Speech output byte size"),
  }
}

/** @param {unknown} rawDeclaration @returns {JsonRecord} */
function requireNormalizedDeclaration(rawDeclaration) {
  const declaration = requireRecord(rawDeclaration, "Normalized speech-reduction declaration")
  requireSha256(declaration.declarationSha256, "Normalized speech-reduction declaration fingerprint")
  if (declaration.algorithmVersion !== "signature-speech-reduction-v1" || !Array.isArray(declaration.concepts)) {
    throw new Error("Normalized speech-reduction declaration is invalid")
  }
  return declaration
}

/** @param {unknown} rawOutput @returns {JsonRecord} */
function requirePlanOutput(rawOutput) {
  const output = requireRecord(rawOutput, "Speech-reduction plan output")
  requireSha256(output.outputIdentity, "Speech-reduction output identity")
  if (output.mixPolicy !== "no-vocals-only" && output.mixPolicy !== "reduced-vocals-mix") {
    throw new Error("Speech-reduction output mix policy is invalid")
  }
  if (output.mixPolicy === "no-vocals-only" && output.vocalsGainDb !== null) {
    throw new Error("Speech-reduction no-vocals output cannot mix a vocal stem")
  }
  return output
}

/** @param {unknown} value @param {string} label @returns {JsonRecord} */
function requireRecord(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`)
  return /** @type {Record<string, any>} */ (value)
}

/** @param {JsonRecord} record @param {Set<string>} fields @param {string} label @returns {void} */
function assertOnlyFields(record, fields, label) {
  for (const field of Object.keys(record)) if (!fields.has(field)) throw new Error(`${label} contains unknown field ${field}`)
}

/** @param {unknown} value @param {string} label @returns {string} */
function requireString(value, label) {
  if (typeof value !== "string" || value.trim() !== value || value.length === 0) throw new Error(`${label} must be a non-empty string`)
  return value
}

/** @param {unknown} value @param {string} label @returns {string} */
function requireSha256(value, label) {
  const normalized = requireString(value, label).toLowerCase()
  if (!SHA256.test(normalized)) throw new Error(`${label} must be a SHA-256 checksum`)
  return normalized
}

/** @param {unknown} value @param {string} label @returns {number} */
function requirePositiveInteger(value, label) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) throw new Error(`${label} must be a positive integer`)
  return value
}

/** @param {unknown} value @param {string} label @returns {number} */
function requireNonnegativeInteger(value, label) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a nonnegative integer`)
  return value
}

/** @param {unknown} value @param {string} label @returns {number} */
function requirePositiveNumber(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) throw new Error(`${label} must be positive`)
  return value
}

/** @param {unknown} value @param {number} minimum @param {number} maximum @param {string} label @returns {number} */
function requireRange(value, minimum, maximum, label) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${label} must be between ${minimum} and ${maximum}`)
  }
  return value
}

/** @param {unknown} value @param {string} label @returns {string} */
function requirePortableFileName(value, label) {
  const normalized = requireString(value, label)
  if (normalized.includes("/") || normalized.includes("\\") || normalized === "." || normalized === "..") {
    throw new Error(`${label} must be a portable file name`)
  }
  return normalized
}

/** @param {unknown} value @param {string} label @returns {string} */
function requireSafeRelativePath(value, label) {
  const path = requireString(value, label)
  if (path.includes("\\") || path.startsWith("/") || path.split("/").some((part) => part === "" || part === "." || part === "..")) {
    throw new Error(`${label} must be a safe portable relative path`)
  }
  return path
}

/**
 * @template T
 * @param {T[]} values
 * @param {(value: T) => string} key
 * @param {string} label
 * @returns {Map<string, T>}
 */
function uniqueIndex(values, key, label) {
  const index = new Map()
  for (const value of values) {
    const identity = key(value)
    if (index.has(identity)) throw new Error(`Speech-reduction ${label} is duplicated: ${identity}`)
    index.set(identity, value)
  }
  return index
}

/** @param {number} value @param {number} digits @returns {number} */
function round(value, digits) {
  return Number(value.toFixed(digits))
}

/** @param {unknown} value @returns {string} */
function sha256(value) {
  return createHash("sha256").update(stableJson(value)).digest("hex")
}

/** @param {unknown} value @returns {string} */
function stableJson(value) {
  return JSON.stringify(sort(value))
}

/** @param {any} value @returns {any} */
function sort(value) {
  if (Array.isArray(value)) return value.map(sort)
  if (!value || typeof value !== "object") return value
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sort(value[key])]))
}

/** @template T @param {T} value @returns {T} */
function copy(value) {
  return JSON.parse(JSON.stringify(value))
}
