// @ts-check

import { createHash } from "node:crypto"

/** @typedef {Record<string, any>} JsonRecord */
/** @typedef {JsonRecord & {declarationSha256:string,inputs:JsonRecord[],recipe:JsonRecord,format:JsonRecord,acceptance:JsonRecord}} StadiumDeclaration */

const SHA256 = /^[a-f0-9]{64}$/
const ALGORITHM_VERSION = "signature-stadium-dynamics-v1"
const BATCH_ID = "batch-45-stadium-crowd"
const GROUP_ID = "signature-extra:stadium-crowd"
const DECLARATION_FIELDS = new Set([
  "version", "algorithmVersion", "outputVersion", "batchId", "groupId",
  "baseReviewFingerprint", "upstream", "recipe", "format", "acceptance", "inputs",
])
const UPSTREAM_FIELDS = new Set([
  "manifestRelativePath", "declarationSha256", "manifestSha256",
])
const RECIPE_FIELDS = new Set([
  "kind", "thresholdDbfs", "ratio", "attackMs", "releaseMs", "knee",
  "detection", "stereoLink", "makeupGain", "mix", "targetIntegratedLoudnessLufs",
])
const FORMAT_FIELDS = new Set([
  "sampleRateHz", "bitsPerSample", "channels", "codecName", "truePeakCeilingDbtp",
  "measurementMethod", "requiredFfmpegVersion", "requiredFfprobeVersion",
  "ffmpegExecutableSha256", "ffprobeExecutableSha256",
])
const ACCEPTANCE_FIELDS = new Set([
  "durationToleranceSeconds", "integratedLoudnessToleranceLu",
  "maximumPoolSpreadLu", "truePeakToleranceDb",
])
const INPUT_FIELDS = new Set([
  "sourceId", "upstreamOutputIdentity", "upstreamRelativePath", "upstreamSha256",
  "upstreamByteSize", "durationSeconds",
])
const RECEIPT_FIELDS = new Set([
  "version", "algorithmVersion", "declarationSha256", "outputIdentity", "batchId",
  "groupId", "sourceId", "upstreamOutputIdentity", "upstreamSha256",
  "upstreamByteSize", "upstreamRelativePath", "compressorMeasurement",
  "matchingGainDb", "outputRelativePath", "outputMeasurement",
])
const MEASUREMENT_FIELDS = new Set([
  "integratedLoudnessLufs", "loudnessRangeLu", "loudnessRangeLowLufs",
  "loudnessRangeHighLufs", "truePeakDbtp",
])
const OUTPUT_MEASUREMENT_FIELDS = new Set([
  "durationSeconds", "sampleRateHz", "channels", "bitsPerSample", "codecName",
  ...MEASUREMENT_FIELDS, "outputSha256", "byteSize",
])
const MANIFEST_FIELDS = new Set([
  "version", "manifestKind", "algorithmVersion", "declarationSha256", "batchId", "outputs",
])

/**
 * Validates the immutable Stadium Crowd post-speech declaration. The recipe is
 * deliberately closed so later tuning creates a new algorithm identity rather
 * than silently changing bytes behind an accepted review fingerprint.
 * @param {unknown} rawDeclaration
 */
export function validateSignatureSoundStadiumDynamicsDeclaration(rawDeclaration) {
  const declaration = requireRecord(rawDeclaration, "Stadium dynamics declaration")
  assertOnlyFields(declaration, DECLARATION_FIELDS, "Stadium dynamics declaration")
  if (declaration.version !== 1 || declaration.algorithmVersion !== ALGORITHM_VERSION ||
      declaration.outputVersion !== 1 || declaration.batchId !== BATCH_ID ||
      declaration.groupId !== GROUP_ID) {
    throw new Error("Stadium dynamics declaration identity is invalid")
  }
  const upstream = normalizeUpstream(declaration.upstream)
  const recipe = normalizeRecipe(declaration.recipe)
  const format = normalizeFormat(declaration.format)
  const acceptance = normalizeAcceptance(declaration.acceptance)
  if (!Array.isArray(declaration.inputs) || declaration.inputs.length !== 6) {
    throw new Error("Stadium dynamics declaration needs exactly six inputs")
  }
  const inputs = declaration.inputs.map((input, index) => normalizeInput(input, index))
  assertUnique(inputs.map(({ sourceId }) => sourceId), "Stadium dynamics source")
  assertUnique(inputs.map(({ upstreamOutputIdentity }) => upstreamOutputIdentity), "Stadium dynamics upstream output")
  assertUnique(inputs.map(({ upstreamRelativePath }) => upstreamRelativePath), "Stadium dynamics upstream path")
  const normalized = {
    version: 1,
    algorithmVersion: ALGORITHM_VERSION,
    outputVersion: 1,
    batchId: BATCH_ID,
    groupId: GROUP_ID,
    baseReviewFingerprint: requireSha256(
      declaration.baseReviewFingerprint,
      "Stadium dynamics base review fingerprint",
    ),
    upstream,
    recipe,
    format,
    acceptance,
    inputs,
  }
  return { ...normalized, declarationSha256: sha256(normalized) }
}

/** Produces deterministic output identities and portable output locations. @param {StadiumDeclaration} declaration */
export function planSignatureSoundStadiumDynamics(declaration) {
  const normalized = declaration.declarationSha256
    ? declaration
    : validateSignatureSoundStadiumDynamicsDeclaration(declaration)
  const outputs = /** @type {JsonRecord[]} */ (normalized.inputs.map((input) => {
    const outputRelativePath = `artifacts/stadium-crowd/${input.sourceId}/audio.wav`
    const outputIdentity = sha256({
      reviewKind: "signature-stadium-dynamics-output",
      algorithmVersion: normalized.algorithmVersion,
      declarationSha256: normalized.declarationSha256,
      batchId: normalized.batchId,
      sourceId: input.sourceId,
      upstreamOutputIdentity: input.upstreamOutputIdentity,
      upstreamSha256: input.upstreamSha256,
      recipe: normalized.recipe,
      format: normalized.format,
    })
    return {
      ...input,
      outputIdentity,
      bundleRelativePath: `artifacts/stadium-crowd/${input.sourceId}`,
      outputRelativePath,
    }
  }))
  return {
    version: 1,
    algorithmVersion: normalized.algorithmVersion,
    declarationSha256: normalized.declarationSha256,
    batchId: normalized.batchId,
    groupId: normalized.groupId,
    outputs,
  }
}

/** Returns the one fully explicit FFmpeg compressor filter used in both passes. @param {unknown} rawRecipe */
export function createSignatureSoundStadiumCompressorFilter(rawRecipe) {
  const recipe = normalizeRecipe(rawRecipe)
  const threshold = formatNumber(10 ** (recipe.thresholdDbfs / 20))
  return [
    `acompressor=threshold=${threshold}`,
    `ratio=${formatNumber(recipe.ratio)}`,
    `attack=${formatNumber(recipe.attackMs)}`,
    `release=${formatNumber(recipe.releaseMs)}`,
    `makeup=${formatNumber(recipe.makeupGain)}`,
    `knee=${formatNumber(recipe.knee)}`,
    `link=${recipe.stereoLink}`,
    `detection=${recipe.detection}`,
    `mix=${formatNumber(recipe.mix)}`,
  ].join(":")
}

/**
 * Chooses one static gain, rounded conservatively to a tenth of a decibel, that
 * approaches the pool target without crossing the measured true-peak ceiling.
 * @param {{compressedIntegratedLoudnessLufs:number,compressedTruePeakDbtp:number,targetIntegratedLoudnessLufs:number,truePeakCeilingDbtp:number}} input
 */
export function calculateSignatureSoundStadiumMatchingGain({
  compressedIntegratedLoudnessLufs,
  compressedTruePeakDbtp,
  targetIntegratedLoudnessLufs,
  truePeakCeilingDbtp,
}) {
  const loudnessGain = requireFinite(targetIntegratedLoudnessLufs, "Stadium target loudness") -
    requireFinite(compressedIntegratedLoudnessLufs, "Stadium compressed loudness")
  const peakSafeGain = requireFinite(truePeakCeilingDbtp, "Stadium peak ceiling") -
    requireFinite(compressedTruePeakDbtp, "Stadium compressed true peak")
  return Math.floor((Math.min(loudnessGain, peakSafeGain) + 1e-9) * 10) / 10
}

/** Builds the portable compressor-measurement command used before static gain. @param {{ffmpegCommand:string,inputPath:string,declaration:StadiumDeclaration}} input */
export function buildSignatureSoundStadiumMeasurementArgv({
  ffmpegCommand, inputPath, declaration,
}) {
  const filter = `${createSignatureSoundStadiumCompressorFilter(declaration.recipe)},ebur128=peak=true`
  return [
    requireString(ffmpegCommand, "Stadium FFmpeg command"),
    "-nostdin", "-hide_banner", "-loglevel", "info", "-i",
    requireString(inputPath, "Stadium input path"),
    "-map", "0:a:0", "-vn", "-af", filter, "-f", "null", "-",
  ]
}

/** Builds the final no-overwrite PCM render command. @param {JsonRecord} planOutput @param {{ffmpegCommand:string,inputPath:string,outputPath:string,matchingGainDb:number,declaration:StadiumDeclaration}} input */
export function buildSignatureSoundStadiumRenderArgv(planOutput, {
  ffmpegCommand, inputPath, outputPath, matchingGainDb, declaration,
}) {
  const filter = [
    createSignatureSoundStadiumCompressorFilter(declaration.recipe),
    `volume=${formatNumber(requireFinite(matchingGainDb, "Stadium matching gain"))}dB`,
  ].join(",")
  return [
    requireString(ffmpegCommand, "Stadium FFmpeg command"),
    "-n", "-nostdin", "-hide_banner", "-loglevel", "error", "-i",
    requireString(inputPath, "Stadium input path"),
    "-map", "0:a:0", "-vn", "-af", filter,
    "-ar", String(declaration.format.sampleRateHz),
    "-ac", String(declaration.format.channels),
    "-c:a", declaration.format.codecName,
    requireString(outputPath, "Stadium output path"),
  ]
}

/** Validates one receipt against its exact planned source and acceptance gate. @param {unknown} rawReceipt @param {{declaration:StadiumDeclaration,planOutput:JsonRecord}} input */
export function validateSignatureSoundStadiumDynamicsReceipt(rawReceipt, {
  declaration, planOutput,
}) {
  const receipt = requireRecord(rawReceipt, "Stadium dynamics receipt")
  assertOnlyFields(receipt, RECEIPT_FIELDS, "Stadium dynamics receipt")
  if (receipt.version !== 1 || receipt.algorithmVersion !== declaration.algorithmVersion ||
      receipt.declarationSha256 !== declaration.declarationSha256 ||
      receipt.outputIdentity !== planOutput.outputIdentity ||
      receipt.batchId !== declaration.batchId || receipt.groupId !== declaration.groupId ||
      receipt.sourceId !== planOutput.sourceId ||
      receipt.upstreamOutputIdentity !== planOutput.upstreamOutputIdentity ||
      receipt.upstreamSha256 !== planOutput.upstreamSha256 ||
      receipt.upstreamByteSize !== planOutput.upstreamByteSize ||
      receipt.upstreamRelativePath !== planOutput.upstreamRelativePath ||
      receipt.outputRelativePath !== planOutput.outputRelativePath) {
    throw new Error("Stadium dynamics receipt identity is stale")
  }
  const compressorMeasurement = normalizeMeasurement(
    receipt.compressorMeasurement,
    "Stadium compressor measurement",
  )
  const expectedGain = calculateSignatureSoundStadiumMatchingGain({
    compressedIntegratedLoudnessLufs: compressorMeasurement.integratedLoudnessLufs,
    compressedTruePeakDbtp: compressorMeasurement.truePeakDbtp,
    targetIntegratedLoudnessLufs: declaration.recipe.targetIntegratedLoudnessLufs,
    truePeakCeilingDbtp: declaration.format.truePeakCeilingDbtp,
  })
  const matchingGainDb = requireFinite(receipt.matchingGainDb, "Stadium matching gain")
  if (matchingGainDb !== expectedGain) throw new Error("Stadium dynamics matching gain is stale")
  const outputMeasurement = normalizeOutputMeasurement(
    receipt.outputMeasurement,
    declaration,
    planOutput,
  )
  return {
    version: 1,
    algorithmVersion: declaration.algorithmVersion,
    declarationSha256: declaration.declarationSha256,
    outputIdentity: planOutput.outputIdentity,
    batchId: declaration.batchId,
    groupId: declaration.groupId,
    sourceId: planOutput.sourceId,
    upstreamOutputIdentity: planOutput.upstreamOutputIdentity,
    upstreamSha256: planOutput.upstreamSha256,
    upstreamByteSize: planOutput.upstreamByteSize,
    upstreamRelativePath: planOutput.upstreamRelativePath,
    compressorMeasurement,
    matchingGainDb,
    outputRelativePath: planOutput.outputRelativePath,
    outputMeasurement,
  }
}

/** Creates a closed manifest only after all six exact receipts validate. @param {unknown[]} receipts @param {StadiumDeclaration} declaration */
export function createSignatureSoundStadiumDynamicsManifest(receipts, declaration) {
  if (!Array.isArray(receipts)) throw new Error("Stadium dynamics receipts must be an array")
  const plan = planSignatureSoundStadiumDynamics(declaration)
  const byIdentity = new Map(receipts.map((receipt, index) => {
    const normalized = requireRecord(receipt, `Stadium dynamics receipt ${index}`)
    return [normalized.outputIdentity, normalized]
  }))
  if (byIdentity.size !== plan.outputs.length || receipts.length !== plan.outputs.length) {
    throw new Error("Stadium dynamics manifest needs every exact output once")
  }
  const outputs = plan.outputs.map((planOutput) => {
    const receipt = byIdentity.get(planOutput.outputIdentity)
    if (!receipt) throw new Error(`Stadium dynamics receipt is missing ${planOutput.sourceId}`)
    return validateSignatureSoundStadiumDynamicsReceipt(receipt, { declaration, planOutput })
  })
  return validateSignatureSoundStadiumDynamicsManifest({
    version: 1,
    manifestKind: "signature-stadium-dynamics-manifest",
    algorithmVersion: declaration.algorithmVersion,
    declarationSha256: declaration.declarationSha256,
    batchId: declaration.batchId,
    outputs,
  }, declaration)
}

/** Revalidates a persisted manifest and enforces cross-pool loudness spread. @param {unknown} rawManifest @param {StadiumDeclaration} declaration */
export function validateSignatureSoundStadiumDynamicsManifest(rawManifest, declaration) {
  const manifest = requireRecord(rawManifest, "Stadium dynamics manifest")
  assertOnlyFields(manifest, MANIFEST_FIELDS, "Stadium dynamics manifest")
  if (manifest.version !== 1 || manifest.manifestKind !== "signature-stadium-dynamics-manifest" ||
      manifest.algorithmVersion !== declaration.algorithmVersion ||
      manifest.declarationSha256 !== declaration.declarationSha256 ||
      manifest.batchId !== declaration.batchId || !Array.isArray(manifest.outputs)) {
    throw new Error("Stadium dynamics manifest identity is invalid")
  }
  const plan = planSignatureSoundStadiumDynamics(declaration)
  const byIdentity = new Map(manifest.outputs.map((/** @type {JsonRecord} */ output) => [output?.outputIdentity, output]))
  if (byIdentity.size !== plan.outputs.length || manifest.outputs.length !== plan.outputs.length) {
    throw new Error("Stadium dynamics manifest output pool is incomplete or duplicated")
  }
  const outputs = plan.outputs.map((planOutput) => {
    const output = byIdentity.get(planOutput.outputIdentity)
    if (!output) throw new Error(`Stadium dynamics manifest is missing ${planOutput.sourceId}`)
    return validateSignatureSoundStadiumDynamicsReceipt(output, { declaration, planOutput })
  })
  const loudness = outputs.map(({ outputMeasurement }) => outputMeasurement.integratedLoudnessLufs)
  const spread = Math.max(...loudness) - Math.min(...loudness)
  if (spread > declaration.acceptance.maximumPoolSpreadLu + 1e-9) {
    throw new Error("Stadium dynamics output loudness spread exceeds the pool limit")
  }
  return {
    version: 1,
    manifestKind: "signature-stadium-dynamics-manifest",
    algorithmVersion: declaration.algorithmVersion,
    declarationSha256: declaration.declarationSha256,
    batchId: declaration.batchId,
    outputs,
  }
}

/** @param {unknown} rawUpstream */
function normalizeUpstream(rawUpstream) {
  const upstream = requireRecord(rawUpstream, "Stadium dynamics upstream")
  assertOnlyFields(upstream, UPSTREAM_FIELDS, "Stadium dynamics upstream")
  return {
    manifestRelativePath: requireSafeRelativePath(
      upstream.manifestRelativePath,
      "Stadium dynamics upstream manifest path",
    ),
    declarationSha256: requireSha256(
      upstream.declarationSha256,
      "Stadium dynamics upstream declaration fingerprint",
    ),
    manifestSha256: requireSha256(
      upstream.manifestSha256,
      "Stadium dynamics upstream manifest fingerprint",
    ),
  }
}

/** @param {unknown} rawRecipe */
function normalizeRecipe(rawRecipe) {
  const recipe = requireRecord(rawRecipe, "Stadium dynamics recipe")
  assertOnlyFields(recipe, RECIPE_FIELDS, "Stadium dynamics recipe")
  const normalized = {
    kind: requireString(recipe.kind, "Stadium dynamics recipe kind"),
    thresholdDbfs: requireFinite(recipe.thresholdDbfs, "Stadium dynamics threshold"),
    ratio: requireFinite(recipe.ratio, "Stadium dynamics ratio"),
    attackMs: requireFinite(recipe.attackMs, "Stadium dynamics attack"),
    releaseMs: requireFinite(recipe.releaseMs, "Stadium dynamics release"),
    knee: requireFinite(recipe.knee, "Stadium dynamics knee"),
    detection: requireString(recipe.detection, "Stadium dynamics detection"),
    stereoLink: requireString(recipe.stereoLink, "Stadium dynamics stereo link"),
    makeupGain: requireFinite(recipe.makeupGain, "Stadium dynamics makeup gain"),
    mix: requireFinite(recipe.mix, "Stadium dynamics mix"),
    targetIntegratedLoudnessLufs: requireFinite(
      recipe.targetIntegratedLoudnessLufs,
      "Stadium dynamics loudness target",
    ),
  }
  if (stableJson(normalized) !== stableJson({
    kind: "rms-compression-static-level-match",
    thresholdDbfs: -20,
    ratio: 3,
    attackMs: 20,
    releaseMs: 750,
    knee: 4,
    detection: "rms",
    stereoLink: "average",
    makeupGain: 1,
    mix: 1,
    targetIntegratedLoudnessLufs: -23,
  })) throw new Error("Stadium dynamics recipe does not match the reviewed v1 treatment")
  return normalized
}

/** @param {unknown} rawFormat */
function normalizeFormat(rawFormat) {
  const format = requireRecord(rawFormat, "Stadium dynamics format")
  assertOnlyFields(format, FORMAT_FIELDS, "Stadium dynamics format")
  const normalized = {
    sampleRateHz: requirePositiveInteger(format.sampleRateHz, "Stadium sample rate"),
    bitsPerSample: requirePositiveInteger(format.bitsPerSample, "Stadium bit depth"),
    channels: requirePositiveInteger(format.channels, "Stadium channels"),
    codecName: requireString(format.codecName, "Stadium codec"),
    truePeakCeilingDbtp: requireFinite(format.truePeakCeilingDbtp, "Stadium peak ceiling"),
    measurementMethod: requireString(format.measurementMethod, "Stadium measurement method"),
    requiredFfmpegVersion: requireString(format.requiredFfmpegVersion, "Stadium FFmpeg version"),
    requiredFfprobeVersion: requireString(format.requiredFfprobeVersion, "Stadium FFprobe version"),
    ffmpegExecutableSha256: requireSha256(format.ffmpegExecutableSha256, "Stadium FFmpeg checksum"),
    ffprobeExecutableSha256: requireSha256(format.ffprobeExecutableSha256, "Stadium FFprobe checksum"),
  }
  if (normalized.sampleRateHz !== 48000 || normalized.bitsPerSample !== 24 ||
      normalized.channels !== 2 || normalized.codecName !== "pcm_s24le" ||
      normalized.truePeakCeilingDbtp !== -1 ||
      normalized.measurementMethod !== "ffmpeg-ebur128-v1" ||
      normalized.requiredFfmpegVersion !== "ffmpeg version 9.0-full_build-www.gyan.dev" ||
      normalized.requiredFfprobeVersion !== "ffprobe version 9.0-full_build-www.gyan.dev") {
    throw new Error("Stadium dynamics format is invalid")
  }
  return normalized
}

/** @param {unknown} rawAcceptance */
function normalizeAcceptance(rawAcceptance) {
  const acceptance = requireRecord(rawAcceptance, "Stadium dynamics acceptance")
  assertOnlyFields(acceptance, ACCEPTANCE_FIELDS, "Stadium dynamics acceptance")
  const normalized = {
    durationToleranceSeconds: requireFinite(acceptance.durationToleranceSeconds, "Stadium duration tolerance"),
    integratedLoudnessToleranceLu: requireFinite(acceptance.integratedLoudnessToleranceLu, "Stadium loudness tolerance"),
    maximumPoolSpreadLu: requireFinite(acceptance.maximumPoolSpreadLu, "Stadium pool spread"),
    truePeakToleranceDb: requireFinite(acceptance.truePeakToleranceDb, "Stadium peak tolerance"),
  }
  if (stableJson(normalized) !== stableJson({
    durationToleranceSeconds: 0.02,
    integratedLoudnessToleranceLu: 0.3,
    maximumPoolSpreadLu: 0.3,
    truePeakToleranceDb: 0.1,
  })) throw new Error("Stadium dynamics acceptance thresholds are invalid")
  return normalized
}

/** @param {unknown} rawInput @param {number} index */
function normalizeInput(rawInput, index) {
  const input = requireRecord(rawInput, `Stadium dynamics input ${index}`)
  assertOnlyFields(input, INPUT_FIELDS, `Stadium dynamics input ${index}`)
  return {
    sourceId: requireSha256(input.sourceId, `Stadium dynamics input ${index} source id`),
    upstreamOutputIdentity: requireSha256(
      input.upstreamOutputIdentity,
      `Stadium dynamics input ${index} upstream identity`,
    ),
    upstreamRelativePath: requireSafeRelativePath(
      input.upstreamRelativePath,
      `Stadium dynamics input ${index} path`,
    ),
    upstreamSha256: requireSha256(input.upstreamSha256, `Stadium dynamics input ${index} checksum`),
    upstreamByteSize: requirePositiveInteger(input.upstreamByteSize, `Stadium dynamics input ${index} byte size`),
    durationSeconds: requirePositive(input.durationSeconds, `Stadium dynamics input ${index} duration`),
  }
}

/** @param {unknown} rawMeasurement @param {string} label */
function normalizeMeasurement(rawMeasurement, label) {
  const measurement = requireRecord(rawMeasurement, label)
  assertOnlyFields(measurement, MEASUREMENT_FIELDS, label)
  const normalized = {
    integratedLoudnessLufs: requireFinite(measurement.integratedLoudnessLufs, `${label} loudness`),
    loudnessRangeLu: requireFinite(measurement.loudnessRangeLu, `${label} range`),
    loudnessRangeLowLufs: requireFinite(measurement.loudnessRangeLowLufs, `${label} low`),
    loudnessRangeHighLufs: requireFinite(measurement.loudnessRangeHighLufs, `${label} high`),
    truePeakDbtp: requireFinite(measurement.truePeakDbtp, `${label} peak`),
  }
  if (normalized.loudnessRangeLu < 0 ||
      normalized.loudnessRangeHighLufs < normalized.loudnessRangeLowLufs) {
    throw new Error(`${label} loudness range is invalid`)
  }
  return normalized
}

/** @param {unknown} rawMeasurement @param {StadiumDeclaration} declaration @param {JsonRecord} planOutput */
function normalizeOutputMeasurement(rawMeasurement, declaration, planOutput) {
  const label = "Stadium output measurement"
  const measurement = requireRecord(rawMeasurement, label)
  assertOnlyFields(measurement, OUTPUT_MEASUREMENT_FIELDS, label)
  const normalized = {
    durationSeconds: requirePositive(measurement.durationSeconds, `${label} duration`),
    sampleRateHz: requirePositiveInteger(measurement.sampleRateHz, `${label} sample rate`),
    channels: requirePositiveInteger(measurement.channels, `${label} channels`),
    bitsPerSample: requirePositiveInteger(measurement.bitsPerSample, `${label} bit depth`),
    codecName: requireString(measurement.codecName, `${label} codec`),
    ...normalizeMeasurement(Object.fromEntries(
      [...MEASUREMENT_FIELDS].map((field) => [field, measurement[field]]),
    ), label),
    outputSha256: requireSha256(measurement.outputSha256, `${label} checksum`),
    byteSize: requirePositiveInteger(measurement.byteSize, `${label} byte size`),
  }
  if (Math.abs(normalized.durationSeconds - planOutput.durationSeconds) >
      declaration.acceptance.durationToleranceSeconds ||
      normalized.sampleRateHz !== declaration.format.sampleRateHz ||
      normalized.channels !== declaration.format.channels ||
      normalized.bitsPerSample !== declaration.format.bitsPerSample ||
      normalized.codecName !== declaration.format.codecName) {
    throw new Error("Stadium dynamics output format or duration is invalid")
  }
  if (Math.abs(normalized.integratedLoudnessLufs - declaration.recipe.targetIntegratedLoudnessLufs) >
      declaration.acceptance.integratedLoudnessToleranceLu + 1e-9) {
    throw new Error("Stadium dynamics output loudness misses its target")
  }
  if (normalized.truePeakDbtp > declaration.format.truePeakCeilingDbtp +
      declaration.acceptance.truePeakToleranceDb + 1e-9) {
    throw new Error("Stadium dynamics output exceeds its true-peak ceiling")
  }
  return normalized
}

/** @param {unknown} value @param {string} label @returns {JsonRecord} */
function requireRecord(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`)
  }
  return /** @type {Record<string, any>} */ (value)
}

/** @param {JsonRecord} record @param {Set<string>} allowed @param {string} label */
function assertOnlyFields(record, allowed, label) {
  const unknown = Object.keys(record).find((field) => !allowed.has(field))
  if (unknown) throw new Error(`${label} contains unsupported field ${unknown}`)
}

/** @param {unknown} value @param {string} label */
function requireString(value, label) {
  if (typeof value !== "string" || value.trim() !== value || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`)
  }
  return value
}

/** @param {unknown} value @param {string} label */
function requireSha256(value, label) {
  if (typeof value !== "string" || !SHA256.test(value)) throw new Error(`${label} is invalid`)
  return value
}

/** @param {unknown} value @param {string} label */
function requireSafeRelativePath(value, label) {
  const path = requireString(value, label)
  if (path.includes("\\") || path.startsWith("/") || /^[a-z]:/i.test(path) ||
      path.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new Error(`${label} must remain a portable relative path`)
  }
  return path
}

/** @param {unknown} value @param {string} label */
function requireFinite(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label} must be finite`)
  return value
}

/** @param {unknown} value @param {string} label */
function requirePositive(value, label) {
  const normalized = requireFinite(value, label)
  if (normalized <= 0) throw new Error(`${label} must be positive`)
  return normalized
}

/** @param {unknown} value @param {string} label */
function requirePositiveInteger(value, label) {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value <= 0) throw new Error(`${label} must be a positive integer`)
  return value
}

/** @param {unknown[]} values @param {string} label */
function assertUnique(values, label) {
  if (new Set(values).size !== values.length) throw new Error(`${label} values must be unique`)
}

/** @param {number} value */
function formatNumber(value) {
  return Number(value.toFixed(9)).toString()
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
