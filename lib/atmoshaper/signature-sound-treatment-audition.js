import { createHash } from "node:crypto"
import { resolve } from "node:path"

const SHA256 = /^[a-f0-9]{64}$/
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const TOP_FIELDS = new Set([
  "version", "algorithmVersion", "batchId", "outputVersion", "groupId",
  "processingIntentIds", "sources", "variants", "outputFormat",
])
const SOURCE_FIELDS = new Set(["sourceId", "sha256", "byteSize", "relativePath"])
const VARIANT_FIELDS = new Set([
  "variantId", "label", "delaysMs", "decays", "inputGain", "outputGain",
  "safetyAttenuationDb", "tailSeconds",
])
const FORMAT_FIELDS = new Set(["codec", "sampleRateHz", "channels", "truePeakCeilingDbtp"])
const MEASUREMENT_FIELDS = new Set(["version", "batchDeclarationSha256", "toolVersion", "sources"])
const SOURCE_MEASUREMENT_FIELDS = new Set([
  "durationSeconds", "integratedLoudnessLufs", "truePeakDbtp", "sampleRateHz", "channels",
])
const VARIANT_IDS = ["short-delay", "medium-echo", "wide-dual-echo", "wide-dual-echo-x2"]
const MANIFEST_FIELDS = new Set([
  "version", "batchId", "batchDeclarationSha256", "algorithmVersion", "groupId",
  "processingIntentIds", "reviewKind", "measurementToolVersion", "outputs",
])
const MANIFEST_OUTPUT_FIELDS = new Set([
  "sourceId", "sourceSha256", "variantId", "variantLabel", "effect", "outputRelativePath",
  "outputIdentity", "ffmpegArgv", "inputMeasurement", "outputMeasurement",
])
const OUTPUT_MEASUREMENT_FIELDS = new Set([
  "outputSha256", "byteSize", "codecName", "sampleRateHz", "channels", "bitsPerSample",
  "durationSeconds", "integratedLoudnessLufs", "truePeakDbtp",
])

/**
 * Validates the closed exploratory treatment declaration against the current
 * construction and discovery authorities without treating variants as approved.
 */
export function validateSignatureSoundTreatmentAuditionBatch(rawBatch, { constructionReview, discoveryReview }) {
  const batch = requireRecord(rawBatch, "Signature treatment-audition batch")
  assertOnlyFields(batch, TOP_FIELDS, "Signature treatment-audition batch")
  if (batch.version !== 1 || batch.algorithmVersion !== "signature-treatment-audition-v1") {
    throw new Error("Signature treatment-audition batch version is invalid")
  }
  const batchId = requirePattern(batch.batchId, ID, "Signature treatment-audition batch id")
  const outputVersion = requirePositiveInteger(batch.outputVersion, "Signature treatment-audition output version")
  const groupId = requireString(batch.groupId, "Signature treatment-audition group id")
  const group = requireConstructionGroup(constructionReview, groupId)
  const processingIntentIds = requireStringArray(batch.processingIntentIds, "Signature treatment-audition processing intents")
  const availableIntents = collectProcessingIntentIds(group)
  if (processingIntentIds.length !== 1 || processingIntentIds[0] !== "whistles-time-effect" ||
      !availableIntents.has(processingIntentIds[0])) {
    throw new Error("Signature treatment-audition processing intent does not match construction authority")
  }

  const discoverySources = new Map(requireArray(discoveryReview?.sources, "Signature discovery sources")
    .map((source) => [source.sourceId, source]))
  const sources = requireArray(batch.sources, "Signature treatment-audition sources")
    .map((source, index) => normalizeSource(source, discoverySources, `Signature treatment-audition source ${index}`))
  const expectedSourceIds = [...group.includedSourceIds].sort()
  if (JSON.stringify(sources.map(({ sourceId }) => sourceId)) !== JSON.stringify(expectedSourceIds)) {
    throw new Error("Signature treatment-audition sources do not exactly match construction authority")
  }

  const variants = requireArray(batch.variants, "Signature treatment-audition variants")
    .map((variant, index) => normalizeVariant(variant, `Signature treatment-audition variant ${index}`))
  if (JSON.stringify(variants.map(({ variantId }) => variantId)) !== JSON.stringify(VARIANT_IDS)) {
    throw new Error("Signature treatment-audition variant matrix is unsupported")
  }
  const outputFormat = normalizeOutputFormat(batch.outputFormat)
  const normalized = {
    version: 1,
    algorithmVersion: batch.algorithmVersion,
    batchId,
    outputVersion,
    groupId,
    processingIntentIds,
    sources,
    variants,
    outputFormat,
  }
  return { ...normalized, batchDeclarationSha256: sha256(JSON.stringify(normalized)) }
}

/** Expands every exact source through every declared review variant. */
export function planSignatureSoundTreatmentAuditionBatch(normalizedBatch, rawMeasurements) {
  const batch = requireNormalizedBatch(normalizedBatch)
  const measurements = normalizeMeasurements(rawMeasurements, batch)
  const outputs = batch.sources.flatMap((source) => batch.variants.map((variant) => {
    const inputMeasurement = measurements.sources[source.sourceId]
    const identityInput = {
      batchDeclarationSha256: batch.batchDeclarationSha256,
      outputVersion: batch.outputVersion,
      sourceId: source.sourceId,
      sourceSha256: source.sha256,
      variant,
      outputFormat: batch.outputFormat,
    }
    return {
      sourceId: source.sourceId,
      sourceSha256: source.sha256,
      sourceRelativePath: source.relativePath,
      variantId: variant.variantId,
      variantLabel: variant.label,
      effect: { ...variant, delaysMs: [...variant.delaysMs], decays: [...variant.decays] },
      inputMeasurement: { ...inputMeasurement },
      expectedDurationSeconds: round(inputMeasurement.durationSeconds + variant.tailSeconds, 6),
      outputCodec: batch.outputFormat.codec,
      outputSampleRateHz: batch.outputFormat.sampleRateHz,
      outputChannels: inputMeasurement.channels,
      truePeakCeilingDbtp: batch.outputFormat.truePeakCeilingDbtp,
      outputRelativePath: `sci-fi-whistles/${source.sourceId}-${variant.variantId}-v${batch.outputVersion}.wav`,
      outputIdentity: sha256(JSON.stringify(identityInput)),
    }
  }))
  return {
    version: 1,
    batchId: batch.batchId,
    batchDeclarationSha256: batch.batchDeclarationSha256,
    algorithmVersion: batch.algorithmVersion,
    groupId: batch.groupId,
    processingIntentIds: [...batch.processingIntentIds],
    outputVersion: batch.outputVersion,
    toolVersion: measurements.toolVersion,
    outputs,
  }
}

/** Builds the no-overwrite FFmpeg command for one variant-bound output. */
export function buildSignatureSoundTreatmentRenderArgv(planOutput, {
  ffmpegCommand,
  sourceRoot,
  outputRoot,
  destinationRelativePath = planOutput?.outputRelativePath,
}) {
  const output = requireRecord(planOutput, "Signature treatment-audition plan output")
  const effect = requireRecord(output.effect, "Signature treatment-audition effect")
  const delays = effect.delaysMs.map(formatNumber).join("|")
  const decays = effect.decays.map(formatNumber).join("|")
  const filter = [
    `aecho=${formatNumber(effect.inputGain)}:${formatNumber(effect.outputGain)}:${delays}:${decays}`,
    `volume=${formatNumber(effect.safetyAttenuationDb)}dB`,
    `aresample=${output.outputSampleRateHz}`,
    "aformat=sample_fmts=s32",
  ].join(",")
  return [
    requireString(ffmpegCommand, "FFmpeg command"),
    "-n", "-nostdin", "-hide_banner", "-loglevel", "error",
    "-i", commandPath(requireString(sourceRoot, "Signature source root"), output.sourceRelativePath),
    "-map", "0:a:0", "-vn", "-af", filter,
    "-c:a", output.outputCodec,
    commandPath(requireString(outputRoot, "Signature treatment output root"), requireString(destinationRelativePath, "Signature treatment destination")),
  ]
}

/** Validates the immutable external manifest against a fresh deterministic plan. */
export function validateSignatureSoundTreatmentAuditionManifest(rawManifest, normalizedBatch) {
  const batch = requireNormalizedBatch(normalizedBatch)
  const manifest = requireRecord(rawManifest, "Signature treatment-audition manifest")
  assertOnlyFields(manifest, MANIFEST_FIELDS, "Signature treatment-audition manifest")
  if (manifest.version !== 1 || manifest.batchId !== batch.batchId ||
      manifest.batchDeclarationSha256 !== batch.batchDeclarationSha256 ||
      manifest.algorithmVersion !== batch.algorithmVersion || manifest.groupId !== batch.groupId ||
      manifest.reviewKind !== "treatment-audition" ||
      JSON.stringify(manifest.processingIntentIds) !== JSON.stringify(batch.processingIntentIds)) {
    throw new Error("Signature treatment-audition manifest identity is stale")
  }
  const measurementToolVersion = requireString(manifest.measurementToolVersion, "Signature treatment-audition manifest tool")
  const rawOutputs = requireArray(manifest.outputs, "Signature treatment-audition manifest outputs")
  const sourceMeasurements = {}
  for (const output of rawOutputs) {
    if (output?.sourceId && sourceMeasurements[output.sourceId] === undefined) {
      sourceMeasurements[output.sourceId] = output.inputMeasurement
    }
  }
  const plan = planSignatureSoundTreatmentAuditionBatch(batch, {
    version: 1,
    batchDeclarationSha256: batch.batchDeclarationSha256,
    toolVersion: measurementToolVersion,
    sources: sourceMeasurements,
  })
  if (rawOutputs.length !== plan.outputs.length) throw new Error("Signature treatment-audition manifest output count drifted")
  const outputs = rawOutputs.map((rawOutput, index) => normalizeManifestOutput(rawOutput, plan.outputs[index], index))
  if (new Set(outputs.map(({ outputIdentity }) => outputIdentity)).size !== outputs.length ||
      new Set(outputs.map(({ outputRelativePath }) => outputRelativePath)).size !== outputs.length) {
    throw new Error("Signature treatment-audition manifest contains duplicate output identity or path")
  }
  return {
    version: 1,
    batchId: batch.batchId,
    batchDeclarationSha256: batch.batchDeclarationSha256,
    algorithmVersion: batch.algorithmVersion,
    groupId: batch.groupId,
    processingIntentIds: [...batch.processingIntentIds],
    reviewKind: "treatment-audition",
    measurementToolVersion,
    outputs,
  }
}

function normalizeManifestOutput(rawOutput, expected, index) {
  const label = `Signature treatment-audition manifest output ${index}`
  const output = requireRecord(rawOutput, label)
  assertOnlyFields(output, MANIFEST_OUTPUT_FIELDS, label)
  for (const field of ["sourceId", "sourceSha256", "variantId", "variantLabel", "outputRelativePath", "outputIdentity"]) {
    if (output[field] !== expected[field]) throw new Error(`${label} ${field} identity drifted`)
  }
  if (JSON.stringify(output.effect) !== JSON.stringify(expected.effect) ||
      JSON.stringify(output.inputMeasurement) !== JSON.stringify(expected.inputMeasurement)) {
    throw new Error(`${label} effect or input measurement drifted`)
  }
  const expectedArgv = buildSignatureSoundTreatmentRenderArgv(expected, {
    ffmpegCommand: "ffmpeg",
    sourceRoot: "<source-root>",
    outputRoot: "<output-root>",
  })
  if (JSON.stringify(output.ffmpegArgv) !== JSON.stringify(expectedArgv)) throw new Error(`${label} FFmpeg arguments drifted`)
  if (!Array.isArray(output.ffmpegArgv)) throw new Error(`${label} FFmpeg arguments are invalid`)
  const measurement = normalizeOutputMeasurement(output.outputMeasurement, expected, label)
  return {
    sourceId: expected.sourceId,
    sourceSha256: expected.sourceSha256,
    variantId: expected.variantId,
    variantLabel: expected.variantLabel,
    effect: { ...expected.effect, delaysMs: [...expected.effect.delaysMs], decays: [...expected.effect.decays] },
    outputRelativePath: expected.outputRelativePath,
    outputIdentity: expected.outputIdentity,
    ffmpegArgv: [...expectedArgv],
    inputMeasurement: { ...expected.inputMeasurement },
    outputMeasurement: measurement,
  }
}

function normalizeOutputMeasurement(rawMeasurement, expected, label) {
  const measurement = requireRecord(rawMeasurement, `${label} measurement`)
  assertOnlyFields(measurement, OUTPUT_MEASUREMENT_FIELDS, `${label} measurement`)
  const normalized = {
    outputSha256: requireSha256(measurement.outputSha256, `${label} output checksum`),
    byteSize: requirePositiveInteger(measurement.byteSize, `${label} output byte size`),
    codecName: requireString(measurement.codecName, `${label} output codec`),
    sampleRateHz: requirePositiveInteger(measurement.sampleRateHz, `${label} output sample rate`),
    channels: requireFiniteIntegerRange(measurement.channels, 1, 8, `${label} output channels`),
    bitsPerSample: requirePositiveInteger(measurement.bitsPerSample, `${label} output bits`),
    durationSeconds: requireFiniteRange(measurement.durationSeconds, 0.001, 3600, `${label} output duration`),
    integratedLoudnessLufs: requireFiniteRange(measurement.integratedLoudnessLufs, -120, 20, `${label} output loudness`),
    truePeakDbtp: requireFiniteRange(measurement.truePeakDbtp, -120, 20, `${label} output peak`),
  }
  if (normalized.codecName !== expected.outputCodec || normalized.sampleRateHz !== expected.outputSampleRateHz ||
      normalized.channels !== expected.outputChannels || normalized.bitsPerSample !== 24 ||
      Math.abs(normalized.durationSeconds - expected.expectedDurationSeconds) > 0.02 ||
      normalized.truePeakDbtp > expected.truePeakCeilingDbtp) {
    throw new Error(`${label} output measurement failed verification`)
  }
  return normalized
}

function normalizeMeasurements(rawMeasurements, batch) {
  const measurements = requireRecord(rawMeasurements, "Signature treatment-audition measurements")
  assertOnlyFields(measurements, MEASUREMENT_FIELDS, "Signature treatment-audition measurements")
  if (measurements.version !== 1 || measurements.batchDeclarationSha256 !== batch.batchDeclarationSha256 ||
      !requireString(measurements.toolVersion, "Signature treatment-audition measurement tool").startsWith("ffmpeg version 9.0")) {
    throw new Error("Signature treatment-audition measurements are stale or use the wrong tool")
  }
  const rawSources = requireRecord(measurements.sources, "Signature treatment-audition source measurements")
  const expectedIds = batch.sources.map(({ sourceId }) => sourceId)
  if (JSON.stringify(Object.keys(rawSources).sort()) !== JSON.stringify(expectedIds)) {
    throw new Error("Signature treatment-audition measurements do not match exact sources")
  }
  const sources = Object.fromEntries(expectedIds.map((sourceId) => {
    const label = `Signature treatment-audition source measurement ${sourceId}`
    const measurement = requireRecord(rawSources[sourceId], label)
    assertOnlyFields(measurement, SOURCE_MEASUREMENT_FIELDS, label)
    return [sourceId, {
      durationSeconds: requireFiniteRange(measurement.durationSeconds, 0.001, 3600, `${label} duration`),
      integratedLoudnessLufs: requireFiniteRange(measurement.integratedLoudnessLufs, -120, 20, `${label} loudness`),
      truePeakDbtp: requireFiniteRange(measurement.truePeakDbtp, -120, 20, `${label} true peak`),
      sampleRateHz: requirePositiveInteger(measurement.sampleRateHz, `${label} sample rate`),
      channels: requireFiniteIntegerRange(measurement.channels, 1, 8, `${label} channels`),
    }]
  }))
  return { version: 1, batchDeclarationSha256: batch.batchDeclarationSha256, toolVersion: measurements.toolVersion, sources }
}

function requireNormalizedBatch(value) {
  const batch = requireRecord(value, "Normalized Signature treatment-audition batch")
  requireSha256(batch.batchDeclarationSha256, "Signature treatment-audition declaration checksum")
  requireArray(batch.sources, "Normalized Signature treatment-audition sources")
  requireArray(batch.variants, "Normalized Signature treatment-audition variants")
  return batch
}

function normalizeSource(rawSource, discoverySources, label) {
  const source = requireRecord(rawSource, label)
  assertOnlyFields(source, SOURCE_FIELDS, label)
  const normalized = {
    sourceId: requireSha256(source.sourceId, `${label} id`),
    sha256: requireSha256(source.sha256, `${label} checksum`),
    byteSize: requirePositiveInteger(source.byteSize, `${label} byte size`),
    relativePath: requireSafeRelativePath(source.relativePath, `${label} path`),
  }
  const discovered = discoverySources.get(normalized.sourceId)
  if (!discovered || discovered.sha256 !== normalized.sha256 ||
      discovered.byteSize !== normalized.byteSize || discovered.relativePath !== normalized.relativePath) {
    throw new Error(`${label} does not match discovery authority`)
  }
  return normalized
}

function normalizeVariant(rawVariant, label) {
  const variant = requireRecord(rawVariant, label)
  assertOnlyFields(variant, VARIANT_FIELDS, label)
  const delaysMs = normalizeNumberArray(variant.delaysMs, 1, 2000, `${label} delays`)
  const decays = normalizeNumberArray(variant.decays, 0.01, 0.99, `${label} decays`)
  if (delaysMs.length !== decays.length || delaysMs.some((delay, index) => index > 0 && delay <= delaysMs[index - 1])) {
    throw new Error(`${label} delays and decays must be paired and increasing`)
  }
  const tailSeconds = requireFiniteRange(variant.tailSeconds, 0.001, 2, `${label} tail`)
  if (Math.abs(tailSeconds - Math.max(...delaysMs) / 1000) > 1e-9) {
    throw new Error(`${label} tail must equal its maximum delay`)
  }
  const inputGain = requireFiniteRange(variant.inputGain, 0.01, 1, `${label} input gain`)
  const outputGain = requireFiniteRange(variant.outputGain, 0.01, 1, `${label} output gain`)
  const safetyAttenuationDb = requireFiniteRange(variant.safetyAttenuationDb, -12, 0, `${label} safety attenuation`)
  const conservativePeakFactor = inputGain * outputGain * (1 + decays.reduce((sum, decay) => sum + decay, 0)) *
    (10 ** (safetyAttenuationDb / 20))
  if (conservativePeakFactor > 1) throw new Error(`${label} gain matrix is not conservatively peak-safe`)
  return {
    variantId: requirePattern(variant.variantId, ID, `${label} id`),
    label: requireString(variant.label, `${label} label`),
    delaysMs,
    decays,
    inputGain,
    outputGain,
    safetyAttenuationDb,
    tailSeconds,
  }
}

function normalizeOutputFormat(rawFormat) {
  const format = requireRecord(rawFormat, "Signature treatment-audition output format")
  assertOnlyFields(format, FORMAT_FIELDS, "Signature treatment-audition output format")
  if (format.codec !== "pcm_s24le" || format.sampleRateHz !== 48000 || format.channels !== "preserve" ||
      format.truePeakCeilingDbtp !== -0.1) {
    throw new Error("Signature treatment-audition output format is unsupported")
  }
  return { codec: format.codec, sampleRateHz: 48000, channels: "preserve", truePeakCeilingDbtp: -0.1 }
}

function requireConstructionGroup(review, groupId) {
  const groups = requireArray(review?.groups, "Signature construction groups")
  const group = groups.find((candidate) => candidate.groupId === groupId)
  if (!group || !Array.isArray(group.includedSourceIds)) throw new Error("Signature treatment-audition group is unknown")
  return group
}

function collectProcessingIntentIds(group) {
  const ids = new Set((group.processingIntents ?? []).map(({ id }) => id))
  for (const intents of Object.values(group.sourceOverrides ?? {})) {
    for (const intent of intents) ids.add(intent.id)
  }
  return ids
}

function requireRecord(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`)
  return value
}

function requireArray(value, label) {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${label} must be a non-empty array`)
  return value
}

function assertOnlyFields(value, allowed, label) {
  const unknown = Object.keys(value).find((field) => !allowed.has(field))
  if (unknown) throw new Error(`${label} contains unknown field ${unknown}`)
}

function requireString(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a non-empty string`)
  return value
}

function requirePattern(value, pattern, label) {
  const normalized = requireString(value, label)
  if (!pattern.test(normalized)) throw new Error(`${label} is invalid`)
  return normalized
}

function requireSha256(value, label) {
  return requirePattern(value, SHA256, label)
}

function requirePositiveInteger(value, label) {
  if (!Number.isInteger(value) || value <= 0) throw new Error(`${label} must be a positive integer`)
  return value
}

function requireFiniteIntegerRange(value, minimum, maximum, label) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) throw new Error(`${label} is outside its allowed range`)
  return value
}

function requireFiniteRange(value, minimum, maximum, label) {
  if (!Number.isFinite(value) || value < minimum || value > maximum) throw new Error(`${label} is outside its allowed range`)
  return value
}

function normalizeNumberArray(value, minimum, maximum, label) {
  const items = requireArray(value, label)
  return items.map((item, index) => requireFiniteRange(item, minimum, maximum, `${label} ${index}`))
}

function requireStringArray(value, label) {
  const items = requireArray(value, label).map((item, index) => requireString(item, `${label} ${index}`))
  if (new Set(items).size !== items.length) throw new Error(`${label} contains duplicates`)
  return items
}

function requireSafeRelativePath(value, label) {
  const relativePath = requireString(value, label)
  if (relativePath.includes("\\") || relativePath.startsWith("/") || /^[a-z]:/i.test(relativePath) ||
      relativePath.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new Error(`${label} must be portable and relative`)
  }
  return relativePath
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex")
}

function round(value, places) {
  const scale = 10 ** places
  return Math.round((value + Number.EPSILON) * scale) / scale
}

function formatNumber(value) {
  return Number(value).toString()
}

function commandPath(root, relativePath) {
  if (/^<[^>]+>$/.test(root)) return `${root}/${relativePath.replaceAll("\\", "/")}`
  return resolve(root, relativePath)
}
