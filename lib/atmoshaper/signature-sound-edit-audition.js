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
  "variantId", "label", "firstPassStartSeconds", "loopStartSeconds", "loopEndSeconds",
  "cyclicCrossfadeSeconds", "crossfadeCurve",
])
const FORMAT_FIELDS = new Set(["codec", "sampleRateHz", "channels", "truePeakCeilingDbtp"])
const MEASUREMENT_FIELDS = new Set(["version", "batchDeclarationSha256", "toolVersion", "sources"])
const SOURCE_MEASUREMENT_FIELDS = new Set([
  "durationSeconds", "integratedLoudnessLufs", "truePeakDbtp", "sampleRateHz", "channels",
])
const MANIFEST_FIELDS = new Set([
  "version", "batchId", "batchDeclarationSha256", "algorithmVersion", "groupId",
  "processingIntentIds", "reviewKind", "measurementToolVersion", "outputs",
])
const MANIFEST_OUTPUT_FIELDS = new Set([
  "sourceId", "sourceSha256", "variantId", "variantLabel", "edit", "reviewMode",
  "outputRelativePath", "outputIdentity", "ffmpegArgv", "inputMeasurement", "outputMeasurement",
])
const OUTPUT_MEASUREMENT_FIELDS = new Set([
  "outputSha256", "byteSize", "codecName", "sampleRateHz", "channels", "bitsPerSample",
  "durationSeconds", "integratedLoudnessLufs", "truePeakDbtp",
])

/**
 * Validates one immutable edit-audition declaration against the construction
 * intent and exact discovery-source identities without treating it as approved.
 */
export function validateSignatureSoundEditAuditionBatch(rawBatch, { constructionReview, discoveryReview }) {
  const batch = requireRecord(rawBatch, "Signature edit-audition batch")
  assertOnlyFields(batch, TOP_FIELDS, "Signature edit-audition batch")
  if (batch.version !== 1 || batch.algorithmVersion !== "signature-edit-audition-v2") {
    throw new Error("Signature edit-audition batch version is invalid")
  }
  const batchId = requirePattern(batch.batchId, ID, "Signature edit-audition batch id")
  const outputVersion = requirePositiveInteger(batch.outputVersion, "Signature edit-audition output version")
  const groupId = requireString(batch.groupId, "Signature edit-audition group id")
  const group = requireConstructionGroup(constructionReview, groupId)
  const processingIntentIds = requireStringArray(batch.processingIntentIds, "Signature edit-audition processing intents")
  const availableIntents = collectProcessingIntentIds(group)
  if (processingIntentIds.length === 0 || processingIntentIds.some((intentId) => !availableIntents.has(intentId))) {
    throw new Error("Signature edit-audition processing intent does not match construction authority")
  }
  const expectedIntentIds = [...availableIntents].sort()
  if (JSON.stringify(processingIntentIds) !== JSON.stringify(expectedIntentIds)) {
    throw new Error("Signature edit-audition processing intents are incomplete")
  }

  const discoverySources = new Map(requireArray(discoveryReview?.sources, "Signature discovery sources")
    .map((source) => [source.sourceId, source]))
  const sources = requireArray(batch.sources, "Signature edit-audition sources")
    .map((source, index) => normalizeSource(source, discoverySources, `Signature edit-audition source ${index}`))
  const expectedSourceIds = [...group.includedSourceIds].sort()
  if (JSON.stringify(sources.map(({ sourceId }) => sourceId)) !== JSON.stringify(expectedSourceIds)) {
    throw new Error("Signature edit-audition sources do not exactly match construction authority")
  }

  const variants = requireArray(batch.variants, "Signature edit-audition variants")
    .map((variant, index) => normalizeVariant(variant, `Signature edit-audition variant ${index}`))
  if (variants.length === 0 || new Set(variants.map(({ variantId }) => variantId)).size !== variants.length) {
    throw new Error("Signature edit-audition variants must be unique and non-empty")
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

/** Expands each exact source into a one-time opening followed by a loopable region. */
export function planSignatureSoundEditAuditionBatch(normalizedBatch, rawMeasurements) {
  const batch = requireNormalizedBatch(normalizedBatch)
  const measurements = normalizeMeasurements(rawMeasurements, batch)
  const conceptSlug = batch.groupId.split(":").at(-1)
  const outputs = batch.sources.flatMap((source) => batch.variants.map((variant) => {
    const inputMeasurement = measurements.sources[source.sourceId]
    if (variant.loopEndSeconds > inputMeasurement.durationSeconds + 0.001) {
      throw new Error("Signature edit-audition loop exceeds the measured source duration")
    }
    const firstLoopOffsetSeconds = round(
      variant.loopEndSeconds - variant.cyclicCrossfadeSeconds - variant.firstPassStartSeconds,
      6,
    )
    const loopRegionDurationSeconds = round(
      variant.loopEndSeconds - variant.loopStartSeconds - variant.cyclicCrossfadeSeconds,
      6,
    )
    const expectedDurationSeconds = round(firstLoopOffsetSeconds + loopRegionDurationSeconds, 6)
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
      edit: { ...variant },
      reviewMode: "intro-then-cyclic-loop",
      inputMeasurement: { ...inputMeasurement },
      firstLoopOffsetSeconds,
      loopRegionDurationSeconds,
      expectedDurationSeconds,
      outputCodec: batch.outputFormat.codec,
      outputSampleRateHz: batch.outputFormat.sampleRateHz,
      outputChannels: inputMeasurement.channels,
      truePeakCeilingDbtp: batch.outputFormat.truePeakCeilingDbtp,
      outputRelativePath: `${conceptSlug}/${source.sourceId}-${variant.variantId}-v${batch.outputVersion}.wav`,
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

/** Builds one complete opening plus a baked loop region for sample-accurate regional playback. */
export function buildSignatureSoundEditRenderArgv(planOutput, {
  ffmpegCommand,
  sourceRoot,
  outputRoot,
  destinationRelativePath = planOutput?.outputRelativePath,
}) {
  const output = requireRecord(planOutput, "Signature edit-audition plan output")
  const edit = requireRecord(output.edit, "Signature edit-audition edit")
  const firstPassStart = formatNumber(edit.firstPassStartSeconds)
  const loopStart = formatNumber(edit.loopStartSeconds)
  const loopEnd = formatNumber(edit.loopEndSeconds)
  const seamSeconds = formatNumber(edit.cyclicCrossfadeSeconds)
  const loopHeadEnd = formatNumber(edit.loopStartSeconds + edit.cyclicCrossfadeSeconds)
  const middleEnd = formatNumber(edit.loopEndSeconds - edit.cyclicCrossfadeSeconds)
  const filter = [
    `[0:a]asplit=4[intro][head][tail][middle]`,
    `[intro]atrim=start=${firstPassStart}:end=${middleEnd},asetpts=PTS-STARTPTS[introcut]`,
    `[tail]atrim=start=${middleEnd}:end=${loopEnd},asetpts=PTS-STARTPTS[tailcut]`,
    `[head]atrim=start=${loopStart}:end=${loopHeadEnd},asetpts=PTS-STARTPTS[headcut]`,
    `[tailcut][headcut]acrossfade=d=${seamSeconds}:c1=${edit.crossfadeCurve}:c2=${edit.crossfadeCurve}[seam]`,
    `[middle]atrim=start=${loopHeadEnd}:end=${middleEnd},asetpts=PTS-STARTPTS[middlecut]`,
    `[introcut][seam][middlecut]concat=n=3:v=0:a=1,aresample=${output.outputSampleRateHz},aformat=sample_fmts=s32[out]`,
  ].join(";")
  return [
    requireString(ffmpegCommand, "FFmpeg command"),
    "-n", "-nostdin", "-hide_banner", "-loglevel", "error",
    "-i", commandPath(requireString(sourceRoot, "Signature source root"), output.sourceRelativePath),
    "-filter_complex", filter, "-map", "[out]", "-vn",
    "-c:a", output.outputCodec,
    commandPath(requireString(outputRoot, "Signature edit output root"), requireString(destinationRelativePath, "Signature edit destination")),
  ]
}

/** Reconstructs the edit plan and rejects any manifest recipe or artifact drift. */
export function validateSignatureSoundEditAuditionManifest(rawManifest, normalizedBatch) {
  const batch = requireNormalizedBatch(normalizedBatch)
  const manifest = requireRecord(rawManifest, "Signature edit-audition manifest")
  assertOnlyFields(manifest, MANIFEST_FIELDS, "Signature edit-audition manifest")
  if (manifest.version !== 1 || manifest.batchId !== batch.batchId ||
      manifest.batchDeclarationSha256 !== batch.batchDeclarationSha256 ||
      manifest.algorithmVersion !== batch.algorithmVersion || manifest.groupId !== batch.groupId ||
      manifest.reviewKind !== "edit-audition") {
    throw new Error("Signature edit-audition manifest identity does not match its batch")
  }
  if (JSON.stringify(manifest.processingIntentIds) !== JSON.stringify(batch.processingIntentIds)) {
    throw new Error("Signature edit-audition manifest processing intents do not match")
  }
  const rawOutputs = requireArray(manifest.outputs, "Signature edit-audition manifest outputs")
  if (rawOutputs.length !== batch.sources.length * batch.variants.length) {
    throw new Error("Signature edit-audition manifest outputs do not match its closed matrix")
  }
  const rawInputMeasurements = {}
  for (const output of rawOutputs) {
    const value = requireRecord(output, "Signature edit-audition manifest output")
    const sourceId = requireSha256(value.sourceId, "Signature edit-audition manifest source id")
    if (rawInputMeasurements[sourceId] !== undefined &&
        JSON.stringify(rawInputMeasurements[sourceId]) !== JSON.stringify(value.inputMeasurement)) {
      throw new Error("Signature edit-audition manifest input measurements disagree")
    }
    rawInputMeasurements[sourceId] = value.inputMeasurement
  }
  const plan = planSignatureSoundEditAuditionBatch(batch, {
    version: 1,
    batchDeclarationSha256: batch.batchDeclarationSha256,
    toolVersion: manifest.measurementToolVersion,
    sources: rawInputMeasurements,
  })
  const outputs = rawOutputs.map((rawOutput, index) => normalizeManifestOutput(rawOutput, plan.outputs[index], index))
  return {
    version: 1,
    batchId: batch.batchId,
    batchDeclarationSha256: batch.batchDeclarationSha256,
    algorithmVersion: batch.algorithmVersion,
    groupId: batch.groupId,
    processingIntentIds: [...batch.processingIntentIds],
    reviewKind: "edit-audition",
    measurementToolVersion: requireString(manifest.measurementToolVersion, "Signature edit-audition manifest tool"),
    outputs,
  }
}

function normalizeManifestOutput(rawOutput, expected, index) {
  const label = `Signature edit-audition manifest output ${index}`
  const output = requireRecord(rawOutput, label)
  assertOnlyFields(output, MANIFEST_OUTPUT_FIELDS, label)
  for (const field of [
    "sourceId", "sourceSha256", "variantId", "variantLabel", "reviewMode",
    "outputRelativePath", "outputIdentity",
  ]) {
    if (output[field] !== expected[field]) throw new Error(`${label} ${field} does not match its plan`)
  }
  if (JSON.stringify(output.edit) !== JSON.stringify(expected.edit) ||
      JSON.stringify(output.inputMeasurement) !== JSON.stringify(expected.inputMeasurement)) {
    throw new Error(`${label} edit or input measurement does not match its plan`)
  }
  const expectedArgv = buildSignatureSoundEditRenderArgv(expected, {
    ffmpegCommand: "ffmpeg", sourceRoot: "<source-root>", outputRoot: "<output-root>",
  })
  if (JSON.stringify(output.ffmpegArgv) !== JSON.stringify(expectedArgv)) {
    throw new Error(`${label} argv does not match its plan`)
  }
  const measurement = normalizeOutputMeasurement(output.outputMeasurement, expected, label)
  return {
    sourceId: expected.sourceId,
    sourceSha256: expected.sourceSha256,
    variantId: expected.variantId,
    variantLabel: expected.variantLabel,
    edit: { ...expected.edit },
    reviewMode: expected.reviewMode,
    outputRelativePath: expected.outputRelativePath,
    outputIdentity: expected.outputIdentity,
    ffmpegArgv: expectedArgv,
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
    channels: requirePositiveInteger(measurement.channels, `${label} output channels`),
    bitsPerSample: requirePositiveInteger(measurement.bitsPerSample, `${label} output bit depth`),
    durationSeconds: requireFiniteRange(measurement.durationSeconds, 0.001, 3600, `${label} output duration`),
    integratedLoudnessLufs: requireFiniteRange(measurement.integratedLoudnessLufs, -120, 10, `${label} output loudness`),
    truePeakDbtp: requireFiniteRange(measurement.truePeakDbtp, -120, 10, `${label} output true peak`),
  }
  if (normalized.codecName !== expected.outputCodec || normalized.sampleRateHz !== expected.outputSampleRateHz ||
      normalized.channels !== expected.outputChannels || normalized.bitsPerSample !== 24 ||
      Math.abs(normalized.durationSeconds - expected.expectedDurationSeconds) > 0.02 ||
      normalized.truePeakDbtp > expected.truePeakCeilingDbtp) {
    throw new Error(`${label} format, duration, or true peak verification failed`)
  }
  return normalized
}

function normalizeSource(rawSource, discoverySources, label) {
  const source = requireRecord(rawSource, label)
  assertOnlyFields(source, SOURCE_FIELDS, label)
  const sourceId = requireSha256(source.sourceId, `${label} id`)
  const discovered = discoverySources.get(sourceId)
  if (!discovered || discovered.sha256 !== source.sha256 || discovered.byteSize !== source.byteSize ||
      discovered.relativePath !== source.relativePath) {
    throw new Error(`${label} identity drifted from discovery authority`)
  }
  return {
    sourceId,
    sha256: requireSha256(source.sha256, `${label} checksum`),
    byteSize: requirePositiveInteger(source.byteSize, `${label} byte size`),
    relativePath: requireSafeRelativePath(source.relativePath, `${label} path`),
  }
}

function normalizeVariant(rawVariant, label) {
  const variant = requireRecord(rawVariant, label)
  assertOnlyFields(variant, VARIANT_FIELDS, label)
  const firstPassStartSeconds = requireFiniteRange(variant.firstPassStartSeconds, 0, 3600, `${label} first-pass start`)
  const loopStartSeconds = requireFiniteRange(variant.loopStartSeconds, 0, 3600, `${label} loop start`)
  const loopEndSeconds = requireFiniteRange(variant.loopEndSeconds, 0.001, 3600, `${label} loop end`)
  const cyclicCrossfadeSeconds = requireFiniteRange(variant.cyclicCrossfadeSeconds, 0.01, 60, `${label} cyclic crossfade`)
  if (firstPassStartSeconds !== 0 || loopStartSeconds <= firstPassStartSeconds ||
      loopEndSeconds <= loopStartSeconds || cyclicCrossfadeSeconds * 2 >= loopEndSeconds - loopStartSeconds) {
    throw new Error(`${label} opening, loop, and cyclic crossfade are incompatible`)
  }
  if (variant.crossfadeCurve !== "qsin") throw new Error(`${label} crossfade curve is unsupported`)
  return {
    variantId: requirePattern(variant.variantId, ID, `${label} id`),
    label: requireString(variant.label, `${label} label`),
    firstPassStartSeconds,
    loopStartSeconds,
    loopEndSeconds,
    cyclicCrossfadeSeconds,
    crossfadeCurve: "qsin",
  }
}

function normalizeOutputFormat(rawFormat) {
  const format = requireRecord(rawFormat, "Signature edit-audition output format")
  assertOnlyFields(format, FORMAT_FIELDS, "Signature edit-audition output format")
  if (format.codec !== "pcm_s24le" || format.sampleRateHz !== 48000 || format.channels !== "preserve" ||
      format.truePeakCeilingDbtp !== -0.1) {
    throw new Error("Signature edit-audition output format is unsupported")
  }
  return { codec: "pcm_s24le", sampleRateHz: 48000, channels: "preserve", truePeakCeilingDbtp: -0.1 }
}

function normalizeMeasurements(rawMeasurements, batch) {
  const measurements = requireRecord(rawMeasurements, "Signature edit-audition measurements")
  assertOnlyFields(measurements, MEASUREMENT_FIELDS, "Signature edit-audition measurements")
  if (measurements.version !== 1 || measurements.batchDeclarationSha256 !== batch.batchDeclarationSha256) {
    throw new Error("Signature edit-audition measurements are stale")
  }
  const rawSources = requireRecord(measurements.sources, "Signature edit-audition source measurements")
  const sources = {}
  for (const source of batch.sources) {
    const label = `Signature edit-audition measurement ${source.sourceId}`
    const measurement = requireRecord(rawSources[source.sourceId], label)
    assertOnlyFields(measurement, SOURCE_MEASUREMENT_FIELDS, label)
    sources[source.sourceId] = {
      durationSeconds: requireFiniteRange(measurement.durationSeconds, 0.001, 3600, `${label} duration`),
      integratedLoudnessLufs: requireFiniteRange(measurement.integratedLoudnessLufs, -120, 10, `${label} loudness`),
      truePeakDbtp: requireFiniteRange(measurement.truePeakDbtp, -120, 10, `${label} true peak`),
      sampleRateHz: requirePositiveInteger(measurement.sampleRateHz, `${label} sample rate`),
      channels: requirePositiveInteger(measurement.channels, `${label} channels`),
    }
  }
  if (Object.keys(rawSources).length !== batch.sources.length) throw new Error("Signature edit-audition measurement sources drifted")
  return { toolVersion: requireString(measurements.toolVersion, "Signature edit-audition measurement tool"), sources }
}

function requireNormalizedBatch(batch) {
  if (!batch || typeof batch !== "object" || !SHA256.test(batch.batchDeclarationSha256)) {
    throw new Error("Signature edit-audition normalized batch is invalid")
  }
  return batch
}

function requireConstructionGroup(review, groupId) {
  const group = requireArray(review?.groups, "Signature construction groups").find((candidate) => candidate.groupId === groupId)
  if (!group) throw new Error("Signature edit-audition construction group is missing")
  return group
}

function collectProcessingIntentIds(group) {
  return new Set([
    ...(group.processingIntents ?? []),
    ...Object.values(group.sourceOverrides ?? {}).flat(),
  ].filter((intent) => intent?.type === "processing-intent" && intent.state === "required").map(({ id }) => id))
}

function commandPath(root, portablePath) {
  const relativePath = requireSafeRelativePath(portablePath, "Signature edit command path")
  if (/^<[^<>]+>$/.test(root)) return `${root}/${relativePath}`
  return resolve(root, ...relativePath.split("/"))
}

function requireSafeRelativePath(value, label) {
  if (typeof value !== "string" || value.includes("\\") || value.startsWith("/") ||
      value.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new Error(`${label} must be a portable relative path`)
  }
  return value
}

function requireRecord(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`)
  return value
}

function requireArray(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array`)
  return value
}

function requireStringArray(value, label) {
  const values = requireArray(value, label).map((entry, index) => requireString(entry, `${label} ${index}`))
  if (new Set(values).size !== values.length) throw new Error(`${label} must be unique`)
  return values
}

function requireString(value, label) {
  if (typeof value !== "string" || value.length === 0) throw new Error(`${label} must be a string`)
  return value
}

function requirePattern(value, pattern, label) {
  const text = requireString(value, label)
  if (!pattern.test(text)) throw new Error(`${label} is invalid`)
  return text
}

function requireSha256(value, label) {
  return requirePattern(value, SHA256, label)
}

function requirePositiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${label} must be a positive integer`)
  return value
}

function requireFiniteRange(value, minimum, maximum, label) {
  if (!Number.isFinite(value) || value < minimum || value > maximum) throw new Error(`${label} is out of range`)
  return value
}

function assertOnlyFields(value, allowed, label) {
  const unknown = Object.keys(value).filter((field) => !allowed.has(field))
  if (unknown.length > 0) throw new Error(`${label} has unknown field ${unknown[0]}`)
}

function formatNumber(value) {
  return Number(value.toFixed(6)).toString()
}

function round(value, digits) {
  return Number(value.toFixed(digits))
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex")
}
