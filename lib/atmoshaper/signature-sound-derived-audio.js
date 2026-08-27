import { createHash } from "node:crypto"
import { posix, win32 } from "node:path"

const SHA256 = /^[a-f0-9]{64}$/
const BATCH_FIELDS = new Set(["version", "algorithmVersion", "batchId", "outputVersion", "concepts"])
const CONCEPT_FIELDS = new Set(["groupId", "processingIntentIds", "state", "sources", "recipe"])
const SOURCE_FIELDS = new Set(["sourceId", "sha256", "byteSize", "relativePath"])
const RELATIVE_RECIPE_FIELDS = new Set([
  "kind", "targetPolicy", "outputCodec", "outputSampleRateHz", "outputChannels",
])
const LOOP_RECIPE_FIELDS = new Set([
  "kind", "trimStartSeconds", "trimEndSeconds", "loopSeamStartSeconds", "loopSeamEndSeconds",
  "outputCodec", "outputSampleRateHz", "outputChannels",
])
const TRIM_RECIPE_FIELDS = new Set([
  "kind", "trimStartSeconds", "trimEndSeconds", "fadeInSeconds", "fadeOutSeconds",
  "truePeakCeilingDbtp", "outputCodec", "outputSampleRateHz", "outputChannels",
])
const MEASUREMENT_FIELDS = new Set(["version", "measurementMethod", "toolVersion", "sources"])
const SOURCE_MEASUREMENT_FIELDS = new Set([
  "sourceSha256", "durationSeconds", "sampleRateHz", "channels", "bitsPerSample",
  "integratedLoudnessLufs", "truePeakDbtp",
])
const MANIFEST_FIELDS = new Set([
  "version", "batchId", "batchDeclarationSha256", "algorithmVersion", "groupId",
  "processingIntentIds", "targetIntegratedLoudnessLufs", "measurementMethod",
  "measurementToolVersion", "outputs",
])
const MANIFEST_OUTPUT_FIELDS = new Set([
  "sourceId", "sourceSha256", "outputRelativePath", "outputIdentity", "gainDb",
  "ffmpegArgv", "inputMeasurement", "outputMeasurement",
])
const OUTPUT_MEASUREMENT_FIELDS = new Set([
  "outputSha256", "byteSize", "durationSeconds", "sampleRateHz", "channels",
  "bitsPerSample", "codecName", "integratedLoudnessLufs", "truePeakDbtp",
])

/** Validates a portable batch declaration against the exact construction and discovery owners. */
export function validateSignatureSoundDerivedAudioBatch(rawBatch, { constructionReview, discoveryReview }) {
  const batch = requireRecord(rawBatch, "Signature derived-audio batch")
  assertOnlyFields(batch, BATCH_FIELDS, "Signature derived-audio batch")
  if (batch.version !== 1) throw new Error("Unsupported Signature derived-audio batch version")
  if (batch.algorithmVersion !== "signature-derived-audio-v1") {
    throw new Error("Unsupported Signature derived-audio algorithm version")
  }
  const batchId = requirePattern(batch.batchId, /^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Signature derived-audio batch id")
  const outputVersion = requirePositiveInteger(batch.outputVersion, "Signature derived-audio output version")
  if (!Array.isArray(batch.concepts) || batch.concepts.length === 0) {
    throw new Error("Signature derived-audio batch concepts must be a non-empty array")
  }
  const constructionGroups = new Map(constructionReview.groups.map((group) => [group.groupId, group]))
  const discoverySources = new Map(discoveryReview.sources.map((source) => [source.sourceId, source]))
  const concepts = batch.concepts.map((concept, index) => normalizeConcept(
    concept,
    constructionGroups,
    discoverySources,
    `Signature derived-audio concept at index ${index}`,
  ))
  if (new Set(concepts.map(({ groupId }) => groupId)).size !== concepts.length) {
    throw new Error("Signature derived-audio batch contains a duplicate concept")
  }
  const normalized = { version: 1, algorithmVersion: batch.algorithmVersion, batchId, outputVersion, concepts }
  return { ...normalized, batchDeclarationSha256: sha256(normalized) }
}

/** Validates exact source measurements for one ready concept. */
export function validateSignatureSoundDerivedMeasurements(rawMeasurements, normalizedBatch, groupId) {
  const batch = requireNormalizedBatch(normalizedBatch)
  const concept = requireConcept(batch, groupId)
  const measurements = requireRecord(rawMeasurements, "Signature derived-audio measurements")
  assertOnlyFields(measurements, MEASUREMENT_FIELDS, "Signature derived-audio measurements")
  if (measurements.version !== 1) throw new Error("Unsupported Signature derived-audio measurement version")
  const measurementMethod = requirePattern(
    measurements.measurementMethod,
    /^ffmpeg-ebur128-v\d+$/,
    "Signature derived-audio measurement method",
  )
  const toolVersion = requireString(measurements.toolVersion, "Signature derived-audio measurement tool")
  const rawSources = requireRecord(measurements.sources, "Signature derived-audio measurement sources")
  const expectedIds = concept.sources.map(({ sourceId }) => sourceId)
  if (!sameArray(Object.keys(rawSources), expectedIds)) {
    throw new Error(`Signature derived-audio measurements for ${groupId} do not match its exact sources`)
  }
  const sources = Object.fromEntries(concept.sources.map((source) => {
    const raw = requireRecord(rawSources[source.sourceId], `Signature derived-audio measurement ${source.sourceId}`)
    assertOnlyFields(raw, SOURCE_MEASUREMENT_FIELDS, `Signature derived-audio measurement ${source.sourceId}`)
    const sourceSha256 = requireSha256(raw.sourceSha256, `Signature derived-audio measurement checksum ${source.sourceId}`)
    if (sourceSha256 !== source.sha256) throw new Error(`Signature derived-audio measurement checksum mismatch for ${source.sourceId}`)
    return [source.sourceId, {
      sourceSha256,
      durationSeconds: requirePositiveNumber(raw.durationSeconds, `Signature derived-audio duration ${source.sourceId}`),
      sampleRateHz: requirePositiveInteger(raw.sampleRateHz, `Signature derived-audio sample rate ${source.sourceId}`),
      channels: requirePositiveInteger(raw.channels, `Signature derived-audio channels ${source.sourceId}`),
      bitsPerSample: requireNonnegativeInteger(raw.bitsPerSample, `Signature derived-audio bit depth ${source.sourceId}`),
      integratedLoudnessLufs: requireFiniteRange(raw.integratedLoudnessLufs, -70, 0, `Signature derived-audio loudness ${source.sourceId}`),
      truePeakDbtp: requireFiniteRange(raw.truePeakDbtp, -100, 20, `Signature derived-audio true peak ${source.sourceId}`),
    }]
  }))
  return { version: 1, measurementMethod, toolVersion, sources }
}

/** Plans the immutable outputs for a ready concept without touching the filesystem. */
export function planSignatureSoundDerivedAudioBatch(normalizedBatch, normalizedMeasurements, { groupId }) {
  const batch = requireNormalizedBatch(normalizedBatch)
  const concept = requireConcept(batch, groupId)
  if (concept.state !== "ready") {
    throw new Error(`Signature derived-audio concept ${groupId} is parameter-gated; trim and seam values are required`)
  }
  const measurements = validateSignatureSoundDerivedMeasurements(normalizedMeasurements, batch, groupId)
  const outputDirectory = requirePattern(
    groupId.split(":").at(-1),
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    `Signature derived-audio output directory for ${groupId}`,
  )
  const intentId = concept.processingIntentIds[0]
  if (concept.recipe.kind === "trim-boundary-fades") {
    const expectedDurationSeconds = round(
      concept.recipe.trimEndSeconds - concept.recipe.trimStartSeconds,
      6,
    )
    const outputs = concept.sources.map((source) => {
      const measurement = measurements.sources[source.sourceId]
      if (concept.recipe.trimEndSeconds > measurement.durationSeconds) {
        throw new Error(`Signature derived-audio trim for ${source.sourceId} exceeds the measured source`)
      }
      const identityInputs = {
        batchDeclarationSha256: batch.batchDeclarationSha256,
        algorithmVersion: batch.algorithmVersion,
        groupId,
        processingIntentId: intentId,
        sourceSha256: source.sha256,
        outputVersion: batch.outputVersion,
        recipeKind: concept.recipe.kind,
        trimStartSeconds: concept.recipe.trimStartSeconds,
        trimEndSeconds: concept.recipe.trimEndSeconds,
        fadeInSeconds: concept.recipe.fadeInSeconds,
        fadeOutSeconds: concept.recipe.fadeOutSeconds,
        truePeakCeilingDbtp: concept.recipe.truePeakCeilingDbtp,
        outputCodec: concept.recipe.outputCodec,
        outputSampleRateHz: concept.recipe.outputSampleRateHz,
        outputChannels: concept.recipe.outputChannels,
      }
      return {
        sourceId: source.sourceId,
        sourceSha256: source.sha256,
        inputRelativePath: source.relativePath,
        inputMeasurement: measurement,
        recipeKind: concept.recipe.kind,
        trimStartSeconds: concept.recipe.trimStartSeconds,
        trimEndSeconds: concept.recipe.trimEndSeconds,
        fadeInSeconds: concept.recipe.fadeInSeconds,
        fadeOutSeconds: concept.recipe.fadeOutSeconds,
        truePeakCeilingDbtp: concept.recipe.truePeakCeilingDbtp,
        expectedDurationSeconds,
        gainDb: 0,
        outputRelativePath: `${outputDirectory}/${source.sourceId}-${intentId}-v${batch.outputVersion}.wav`,
        outputIdentity: sha256(identityInputs),
        identityInputs,
        outputCodec: concept.recipe.outputCodec,
        outputSampleRateHz: concept.recipe.outputSampleRateHz,
        outputChannels: concept.recipe.outputChannels,
      }
    })
    return buildPlan({
      batch,
      groupId,
      concept,
      measurements,
      targetIntegratedLoudnessLufs: null,
      outputs,
    })
  }
  if (concept.recipe.kind !== "relative-loudness-normalization") {
    throw new Error(`Signature derived-audio recipe for ${groupId} is not implemented`)
  }
  const targetIntegratedLoudnessLufs = round(Math.min(
    ...concept.sources.map(({ sourceId }) => measurements.sources[sourceId].integratedLoudnessLufs),
  ), 2)
  const outputs = concept.sources.map((source) => {
    const measurement = measurements.sources[source.sourceId]
    const gainDb = round(targetIntegratedLoudnessLufs - measurement.integratedLoudnessLufs, 2)
    if (gainDb > 0) throw new Error("Signature derived-audio quietest-input policy cannot amplify a source")
    const identityInputs = {
      batchDeclarationSha256: batch.batchDeclarationSha256,
      algorithmVersion: batch.algorithmVersion,
      groupId,
      processingIntentId: intentId,
      sourceSha256: source.sha256,
      outputVersion: batch.outputVersion,
      outputCodec: concept.recipe.outputCodec,
      outputSampleRateHz: concept.recipe.outputSampleRateHz,
      outputChannels: concept.recipe.outputChannels,
      gainDb,
    }
    return {
      sourceId: source.sourceId,
      sourceSha256: source.sha256,
      inputRelativePath: source.relativePath,
      inputMeasurement: measurement,
      recipeKind: concept.recipe.kind,
      gainDb,
      outputRelativePath: `${outputDirectory}/${source.sourceId}-${intentId}-v${batch.outputVersion}.wav`,
      outputIdentity: sha256(identityInputs),
      identityInputs,
      outputCodec: concept.recipe.outputCodec,
      outputSampleRateHz: concept.recipe.outputSampleRateHz,
      outputChannels: concept.recipe.outputChannels,
    }
  })
  return buildPlan({ batch, groupId, concept, measurements, targetIntegratedLoudnessLufs, outputs })
}

function buildPlan({ batch, groupId, concept, measurements, targetIntegratedLoudnessLufs, outputs }) {
  return {
    version: 1,
    batchId: batch.batchId,
    batchDeclarationSha256: batch.batchDeclarationSha256,
    algorithmVersion: batch.algorithmVersion,
    groupId,
    processingIntentIds: [...concept.processingIntentIds],
    state: "ready-to-render",
    targetIntegratedLoudnessLufs,
    measurementMethod: measurements.measurementMethod,
    measurementToolVersion: measurements.toolVersion,
    outputs,
  }
}

/** Builds a no-overwrite FFmpeg command for one planned lossless output. */
export function buildSignatureSoundDerivedRenderArgv(planOutput, { ffmpegCommand, sourceRoot, outputRoot }) {
  const pathApi = pathApiFor(outputRoot)
  const inputPath = pathApi.join(sourceRoot, ...planOutput.inputRelativePath.split("/"))
  const outputPath = pathApi.join(outputRoot, ...planOutput.outputRelativePath.split("/"))
  const channelLayout = planOutput.outputChannels === 1 ? "mono" : "stereo"
  const filter = planOutput.recipeKind === "trim-boundary-fades"
    ? [
        `atrim=start=${planOutput.trimStartSeconds}:end=${planOutput.trimEndSeconds}`,
        "asetpts=PTS-STARTPTS",
        `afade=t=in:st=0:d=${planOutput.fadeInSeconds}`,
        `afade=t=out:st=${round(planOutput.expectedDurationSeconds - planOutput.fadeOutSeconds, 6)}:d=${planOutput.fadeOutSeconds}`,
        `aresample=${planOutput.outputSampleRateHz}`,
        `aformat=sample_fmts=s32:channel_layouts=${channelLayout}`,
      ].join(",")
    : `volume=${Object.is(planOutput.gainDb, -0) ? 0 : planOutput.gainDb}dB,aresample=${planOutput.outputSampleRateHz},aformat=sample_fmts=s32:channel_layouts=${channelLayout}`
  return [
    requireString(ffmpegCommand, "FFmpeg command"), "-n", "-nostdin", "-hide_banner", "-loglevel", "error",
    "-i", inputPath, "-map", "0:a:0", "-vn", "-af", filter,
    "-ac", String(planOutput.outputChannels), "-ar", String(planOutput.outputSampleRateHz),
    "-c:a", planOutput.outputCodec, outputPath,
  ]
}

/** Rejects roots that are broad, protected, nested, or non-absolute after caller canonicalization. */
export function assertSignatureSoundDerivedOutputRoot({ outputRoot, sourceRoot, repositoryRoots, filesystemRoots }) {
  const pathApi = pathApiFor(outputRoot)
  if (!pathApi.isAbsolute(outputRoot)) throw new Error("Signature derived-audio output root must be absolute")
  const output = pathApi.resolve(outputRoot)
  const source = pathApi.resolve(sourceRoot)
  for (const filesystemRoot of filesystemRoots) {
    if (samePath(output, pathApi.resolve(filesystemRoot), pathApi)) {
      throw new Error("Signature derived-audio output root cannot be a filesystem root")
    }
  }
  if (pathsOverlap(output, source, pathApi)) {
    throw new Error("Signature derived-audio output root must remain outside the source root")
  }
  for (const repositoryRoot of repositoryRoots) {
    if (pathsOverlap(output, pathApi.resolve(repositoryRoot), pathApi)) {
      throw new Error("Signature derived-audio output root must remain outside every repository or worktree")
    }
  }
  return output
}

/** Reconstructs the plan from manifest input measurements and rejects any rendered-artifact drift. */
export function validateSignatureSoundDerivedManifest(rawManifest, normalizedBatch) {
  const batch = requireNormalizedBatch(normalizedBatch)
  const manifest = requireRecord(rawManifest, "Signature derived-audio manifest")
  assertOnlyFields(manifest, MANIFEST_FIELDS, "Signature derived-audio manifest")
  if (manifest.version !== 1 || manifest.batchId !== batch.batchId ||
      manifest.batchDeclarationSha256 !== batch.batchDeclarationSha256 ||
      manifest.algorithmVersion !== batch.algorithmVersion) {
    throw new Error("Signature derived-audio manifest identity does not match its batch")
  }
  const groupId = requireString(manifest.groupId, "Signature derived-audio manifest group")
  const concept = requireConcept(batch, groupId)
  if (!sameArray(manifest.processingIntentIds, concept.processingIntentIds)) {
    throw new Error("Signature derived-audio manifest processing intents do not match")
  }
  if (!Array.isArray(manifest.outputs) || manifest.outputs.length !== concept.sources.length) {
    throw new Error("Signature derived-audio manifest outputs do not match exact sources")
  }
  const inputMeasurements = {
    version: 1,
    measurementMethod: manifest.measurementMethod,
    toolVersion: manifest.measurementToolVersion,
    sources: Object.fromEntries(manifest.outputs.map((output) => [output.sourceId, output.inputMeasurement])),
  }
  const measurements = validateSignatureSoundDerivedMeasurements(inputMeasurements, batch, groupId)
  const plan = planSignatureSoundDerivedAudioBatch(batch, measurements, { groupId })
  if (manifest.targetIntegratedLoudnessLufs !== plan.targetIntegratedLoudnessLufs) {
    throw new Error("Signature derived-audio manifest loudness target does not match its recipe")
  }
  const outputs = manifest.outputs.map((rawOutput, index) => {
    const output = requireRecord(rawOutput, `Signature derived-audio manifest output ${index}`)
    assertOnlyFields(output, MANIFEST_OUTPUT_FIELDS, `Signature derived-audio manifest output ${index}`)
    const expected = plan.outputs[index]
    for (const field of ["sourceId", "sourceSha256", "outputRelativePath", "outputIdentity", "gainDb"]) {
      if (output[field] !== expected[field]) throw new Error(`Signature derived-audio manifest output ${index} ${field} does not match its plan`)
    }
    const expectedArgv = buildSignatureSoundDerivedRenderArgv(expected, {
      ffmpegCommand: "ffmpeg", sourceRoot: "<source-root>", outputRoot: "<output-root>",
    })
    if (JSON.stringify(output.ffmpegArgv) !== JSON.stringify(expectedArgv)) {
      throw new Error(`Signature derived-audio manifest output ${index} argv does not match its recipe`)
    }
    if (JSON.stringify(output.inputMeasurement) !== JSON.stringify(expected.inputMeasurement)) {
      throw new Error(`Signature derived-audio manifest output ${index} input measurement changed`)
    }
    return { ...expectedManifestOutput(output, expected, plan.targetIntegratedLoudnessLufs), inputMeasurement: expected.inputMeasurement }
  })
  return {
    version: 1,
    batchId: batch.batchId,
    batchDeclarationSha256: batch.batchDeclarationSha256,
    algorithmVersion: batch.algorithmVersion,
    groupId,
    processingIntentIds: [...concept.processingIntentIds],
    targetIntegratedLoudnessLufs: plan.targetIntegratedLoudnessLufs,
    measurementMethod: measurements.measurementMethod,
    measurementToolVersion: measurements.toolVersion,
    outputs,
  }
}

function expectedManifestOutput(output, expected, targetLoudness) {
  const measurement = requireRecord(output.outputMeasurement, `Signature derived-audio output measurement ${expected.sourceId}`)
  assertOnlyFields(measurement, OUTPUT_MEASUREMENT_FIELDS, `Signature derived-audio output measurement ${expected.sourceId}`)
  const normalizedMeasurement = {
    outputSha256: requireSha256(measurement.outputSha256, `Signature derived-audio output checksum ${expected.sourceId}`),
    byteSize: requirePositiveInteger(measurement.byteSize, `Signature derived-audio output byte size ${expected.sourceId}`),
    durationSeconds: requirePositiveNumber(measurement.durationSeconds, `Signature derived-audio output duration ${expected.sourceId}`),
    sampleRateHz: requirePositiveInteger(measurement.sampleRateHz, `Signature derived-audio output sample rate ${expected.sourceId}`),
    channels: requirePositiveInteger(measurement.channels, `Signature derived-audio output channels ${expected.sourceId}`),
    bitsPerSample: requirePositiveInteger(measurement.bitsPerSample, `Signature derived-audio output bit depth ${expected.sourceId}`),
    codecName: requireString(measurement.codecName, `Signature derived-audio output codec ${expected.sourceId}`),
    integratedLoudnessLufs: requireFiniteRange(measurement.integratedLoudnessLufs, -70, 0, `Signature derived-audio output loudness ${expected.sourceId}`),
    truePeakDbtp: requireFiniteRange(measurement.truePeakDbtp, -100, 20, `Signature derived-audio output peak ${expected.sourceId}`),
  }
  const formatInvalid = normalizedMeasurement.sampleRateHz !== expected.outputSampleRateHz ||
      normalizedMeasurement.channels !== expected.outputChannels || normalizedMeasurement.bitsPerSample !== 24 ||
      normalizedMeasurement.codecName !== expected.outputCodec
  const recipeInvalid = expected.recipeKind === "trim-boundary-fades"
    ? Math.abs(normalizedMeasurement.durationSeconds - expected.expectedDurationSeconds) > 0.02 ||
      normalizedMeasurement.truePeakDbtp > expected.truePeakCeilingDbtp
    : Math.abs(normalizedMeasurement.integratedLoudnessLufs - targetLoudness) > 0.2
  if (formatInvalid || recipeInvalid) {
    throw new Error(`Signature derived-audio output ${expected.sourceId} format or loudness verification failed`)
  }
  return {
    sourceId: expected.sourceId,
    sourceSha256: expected.sourceSha256,
    outputRelativePath: expected.outputRelativePath,
    outputIdentity: expected.outputIdentity,
    gainDb: expected.gainDb,
    ffmpegArgv: output.ffmpegArgv.map((argument) => requireString(argument, "Signature derived-audio FFmpeg argv")),
    outputMeasurement: normalizedMeasurement,
  }
}

function normalizeConcept(rawConcept, constructionGroups, discoverySources, label) {
  const concept = requireRecord(rawConcept, label)
  assertOnlyFields(concept, CONCEPT_FIELDS, label)
  const groupId = requireString(concept.groupId, `${label} group`)
  const constructionGroup = constructionGroups.get(groupId)
  if (!constructionGroup) throw new Error(`${label} references an unknown construction group`)
  const processingIntentIds = normalizeStringArray(concept.processingIntentIds, `${label} processing intents`)
  const expectedIntentIds = collectConstructionIntentIds(constructionGroup)
  if (!sameArray(processingIntentIds, expectedIntentIds)) throw new Error(`${label} processing intents do not match construction intent`)
  if (!Array.isArray(concept.sources) || concept.sources.length === 0) throw new Error(`${label} sources must be non-empty`)
  const sources = concept.sources.map((source, index) => normalizeSource(source, discoverySources, `${label} source ${index}`))
  const sourceIds = sources.map(({ sourceId }) => sourceId)
  if (new Set(sourceIds).size !== sourceIds.length) throw new Error(`${label} contains a duplicate source`)
  if (!sameArray(sourceIds, constructionGroup.includedSourceIds)) throw new Error(`${label} sources do not match construction sources`)
  const state = requireEnum(concept.state, new Set(["ready", "parameter-gated"]), `${label} state`)
  const recipe = normalizeRecipe(concept.recipe, state, label)
  return { groupId, processingIntentIds, state, sources, recipe }
}

function collectConstructionIntentIds(group) {
  const ids = []
  for (const intent of group.processingIntents ?? []) ids.push(intent.id)
  for (const sourceId of group.includedSourceIds ?? []) {
    for (const intent of group.sourceOverrides?.[sourceId] ?? []) {
      if (intent.type === "processing-intent" && intent.state === "required") ids.push(intent.id)
    }
  }
  return [...new Set(ids)]
}

function normalizeSource(rawSource, discoverySources, label) {
  const source = requireRecord(rawSource, label)
  assertOnlyFields(source, SOURCE_FIELDS, label)
  const sourceId = requireSha256(source.sourceId, `${label} id`)
  const sha256Value = requireSha256(source.sha256, `${label} checksum`)
  const byteSize = requirePositiveInteger(source.byteSize, `${label} byte size`)
  const relativePath = requireSafeRelativePath(source.relativePath, `${label} path`)
  const discovered = discoverySources.get(sourceId)
  if (!discovered) throw new Error(`${label} is not in the discovery source inventory`)
  if (discovered.sha256 !== sha256Value) throw new Error(`${label} checksum does not match discovery`)
  if (discovered.byteSize !== byteSize) throw new Error(`${label} byte size does not match discovery`)
  if (discovered.relativePath !== relativePath) throw new Error(`${label} path does not match discovery`)
  return { sourceId, sha256: sha256Value, byteSize, relativePath }
}

function normalizeRecipe(rawRecipe, state, label) {
  const recipe = requireRecord(rawRecipe, `${label} recipe`)
  if (recipe.kind === "relative-loudness-normalization") {
    assertOnlyFields(recipe, RELATIVE_RECIPE_FIELDS, `${label} recipe`)
    if (state !== "ready") throw new Error(`${label} normalization recipe must be ready`)
    if (recipe.targetPolicy !== "quietest-input") throw new Error(`${label} target policy is unsupported`)
    return { kind: recipe.kind, targetPolicy: recipe.targetPolicy, ...normalizeOutputFormat(recipe, label) }
  }
  if (recipe.kind === "trim-and-repair-loop") {
    assertOnlyFields(recipe, LOOP_RECIPE_FIELDS, `${label} recipe`)
    const parameters = {
      trimStartSeconds: normalizeNullablePositiveNumber(recipe.trimStartSeconds, `${label} trim start`),
      trimEndSeconds: normalizeNullablePositiveNumber(recipe.trimEndSeconds, `${label} trim end`),
      loopSeamStartSeconds: normalizeNullablePositiveNumber(recipe.loopSeamStartSeconds, `${label} seam start`),
      loopSeamEndSeconds: normalizeNullablePositiveNumber(recipe.loopSeamEndSeconds, `${label} seam end`),
    }
    const complete = Object.values(parameters).every((value) => value !== null)
    if ((state === "ready") !== complete) throw new Error(`${label} state does not match its required trim and seam parameters`)
    return { kind: recipe.kind, ...parameters, ...normalizeOutputFormat(recipe, label) }
  }
  if (recipe.kind === "trim-boundary-fades") {
    assertOnlyFields(recipe, TRIM_RECIPE_FIELDS, `${label} recipe`)
    if (state !== "ready") throw new Error(`${label} boundary-trim recipe must be ready`)
    const trimStartSeconds = requireFiniteRange(recipe.trimStartSeconds, 0, 3600, `${label} trim start`)
    const trimEndSeconds = requireFiniteRange(recipe.trimEndSeconds, 0.001, 3600, `${label} trim end`)
    const fadeInSeconds = requireFiniteRange(recipe.fadeInSeconds, 0.001, 30, `${label} fade in`)
    const fadeOutSeconds = requireFiniteRange(recipe.fadeOutSeconds, 0.001, 30, `${label} fade out`)
    if (trimEndSeconds <= trimStartSeconds || fadeInSeconds + fadeOutSeconds >= trimEndSeconds - trimStartSeconds) {
      throw new Error(`${label} trim and boundary fades are incompatible`)
    }
    return {
      kind: recipe.kind,
      trimStartSeconds,
      trimEndSeconds,
      fadeInSeconds,
      fadeOutSeconds,
      truePeakCeilingDbtp: requireFiniteRange(
        recipe.truePeakCeilingDbtp,
        -20,
        0,
        `${label} true-peak ceiling`,
      ),
      ...normalizeOutputFormat(recipe, label),
    }
  }
  throw new Error(`${label} recipe kind is unsupported`)
}

function normalizeOutputFormat(recipe, label) {
  if (recipe.outputCodec !== "pcm_s24le") throw new Error(`${label} output codec is unsupported`)
  if (recipe.outputSampleRateHz !== 48000) throw new Error(`${label} output sample rate is unsupported`)
  if (!new Set([1, 2]).has(recipe.outputChannels)) throw new Error(`${label} output channels are unsupported`)
  return { outputCodec: recipe.outputCodec, outputSampleRateHz: 48000, outputChannels: recipe.outputChannels }
}

function requireNormalizedBatch(batch) {
  const value = requireRecord(batch, "Normalized Signature derived-audio batch")
  requireSha256(value.batchDeclarationSha256, "Signature derived-audio batch declaration fingerprint")
  if (!Array.isArray(value.concepts)) throw new Error("Normalized Signature derived-audio batch concepts are missing")
  return value
}

function requireConcept(batch, groupId) {
  const concept = batch.concepts.find((entry) => entry.groupId === groupId)
  if (!concept) throw new Error(`Signature derived-audio batch does not contain ${groupId}`)
  return concept
}

function pathApiFor(value) {
  return /^[A-Za-z]:[\\/]/.test(value) || value.startsWith("\\\\") ? win32 : posix
}

function pathsOverlap(left, right, pathApi) {
  return containsPath(left, right, pathApi) || containsPath(right, left, pathApi)
}

function containsPath(parent, child, pathApi) {
  const relative = pathApi.relative(parent, child)
  return relative === "" || (!relative.startsWith("..") && !pathApi.isAbsolute(relative))
}

function samePath(left, right, pathApi) {
  const normalize = (value) => pathApi === win32 ? value.toLowerCase() : value
  return normalize(pathApi.resolve(left)) === normalize(pathApi.resolve(right))
}

function requireRecord(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`)
  return value
}

function assertOnlyFields(value, fields, label) {
  for (const field of Object.keys(value)) if (!fields.has(field)) throw new Error(`${label} has unknown field ${field}`)
}

function requireString(value, label) {
  if (typeof value !== "string" || value.trim() !== value || value.length === 0) throw new Error(`${label} must be a non-empty trimmed string`)
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
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(`${label} must be a positive integer`)
  return value
}

function requireNonnegativeInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} must be a nonnegative integer`)
  return value
}

function requirePositiveNumber(value, label) {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} must be a positive finite number`)
  return value
}

function requireFiniteRange(value, minimum, maximum, label) {
  if (!Number.isFinite(value) || value < minimum || value > maximum) throw new Error(`${label} is outside its supported range`)
  return value
}

function normalizeNullablePositiveNumber(value, label) {
  return value === null ? null : requirePositiveNumber(value, label)
}

function requireEnum(value, allowed, label) {
  if (!allowed.has(value)) throw new Error(`${label} is unsupported`)
  return value
}

function normalizeStringArray(value, label) {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${label} must be a non-empty array`)
  const normalized = value.map((entry, index) => requireString(entry, `${label} at index ${index}`))
  if (new Set(normalized).size !== normalized.length) throw new Error(`${label} contains a duplicate`)
  return normalized
}

function requireSafeRelativePath(value, label) {
  const normalized = requireString(value, label)
  if (normalized.includes("\\") || normalized.startsWith("/") || normalized.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new Error(`${label} must be a safe portable relative path`)
  }
  return normalized
}

function sameArray(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index])
}

function round(value, places) {
  const factor = 10 ** places
  return Math.round((value + Number.EPSILON) * factor) / factor
}

function sha256(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex")
}
