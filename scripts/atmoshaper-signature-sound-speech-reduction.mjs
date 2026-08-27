import { createHash } from "node:crypto"
import { spawn } from "node:child_process"
import {
  createReadStream,
} from "node:fs"
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises"
import {
  basename,
  dirname,
  isAbsolute,
  join,
  relative,
  resolve,
} from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

import {
  buildSignatureSoundDemucsAdapterArgv,
  buildSignatureSoundSpeechMatchArgv,
  buildSignatureSoundSpeechStemMixArgv,
  calculateSignatureSoundSpeechLoudnessMatch,
  createSignatureSoundSpeechReductionManifest,
  planSignatureSoundSpeechReduction,
  validateSignatureSoundSpeechReductionDeclaration,
  validateSignatureSoundSpeechReductionManifest,
  validateSignatureSoundSpeechReductionReceipt,
} from "../lib/atmoshaper/signature-sound-speech-reduction.js"
import { validateSignatureSoundWholeConceptReviewCatalog } from "../lib/atmoshaper/signature-sound-whole-concept-review.js"
import { applySignatureSoundWholeConceptReviewRevisions } from "../lib/atmoshaper/signature-sound-whole-concept-revision.js"
import { applySignatureSoundWholeConceptReviewAmendments } from "../lib/atmoshaper/signature-sound-whole-concept-amendment.js"
import { prepareSignatureSoundDerivedRoots } from "./atmoshaper-signature-sound-derived-audio.mjs"

const scriptDirectory = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(scriptDirectory, "..")
const MANIFEST_NAME = "speech-reduction-manifest.json"
const MODES = new Set(["plan", "validate", "render"])
const REQUIRED_OPTIONS = new Set([
  "source-root", "output-root", "ripx-python", "ripx-script-lib", "model-repo",
  "model-weight", "model-config", "demucs-adapter", "ffmpeg", "ffprobe",
])
const OPTIONAL_OPTIONS = new Set(["batch-id", "source-id"])

/** Parses a closed CLI; roots and every executable/model location are explicit. */
export function parseSignatureSoundSpeechReductionCliArguments(argv) {
  if (!Array.isArray(argv) || !MODES.has(argv[0])) {
    throw new Error("Speech-reduction mode must be plan, validate, or render")
  }
  const values = new Map()
  for (let index = 1; index < argv.length; index += 2) {
    const flag = argv[index]
    const value = argv[index + 1]
    if (typeof flag !== "string" || !flag.startsWith("--") || typeof value !== "string" || value.length === 0) {
      throw new Error("Speech-reduction options require --name value pairs")
    }
    const name = flag.slice(2)
    if (!REQUIRED_OPTIONS.has(name) && !OPTIONAL_OPTIONS.has(name)) {
      throw new Error(`Unknown speech-reduction option: ${flag}`)
    }
    if (values.has(name)) throw new Error(`Repeated speech-reduction option: ${flag}`)
    values.set(name, value)
  }
  for (const name of REQUIRED_OPTIONS) {
    if (!values.has(name)) throw new Error(`Speech-reduction option --${name} is required`)
  }
  const sourceRoot = requireAbsolute(values.get("source-root"), "Speech source root")
  const outputRoot = requireAbsolute(values.get("output-root"), "Speech output root")
  return {
    mode: argv[0],
    sourceRoot,
    outputRoot,
    ripxPython: requireAbsolute(values.get("ripx-python"), "RipX Python"),
    ripScriptLib: requireAbsolute(values.get("ripx-script-lib"), "RipScriptLib"),
    modelRepo: requireAbsolute(values.get("model-repo"), "HTDemucs model repository"),
    modelWeight: requireAbsolute(values.get("model-weight"), "HTDemucs model weight"),
    modelConfiguration: requireAbsolute(values.get("model-config"), "HTDemucs model configuration"),
    demucsAdapter: requireAbsolute(values.get("demucs-adapter"), "Demucs adapter"),
    ffmpeg: requireAbsolute(values.get("ffmpeg"), "FFmpeg"),
    ffprobe: requireAbsolute(values.get("ffprobe"), "FFprobe"),
    batchId: values.get("batch-id") ?? null,
    sourceId: values.get("source-id") ?? null,
  }
}

/** Verifies the physical source bytes before measurement or separation. */
export async function verifySignatureSoundSpeechSourceFile(planOutput, sourceRoot) {
  const canonicalRoot = await requireStableCanonicalRoot(sourceRoot, "Speech source root")
  const lexicalPath = resolveSafeChild(canonicalRoot, planOutput.inputRelativePath)
  const sourcePath = await requireConfinedExistingPath(canonicalRoot, lexicalPath, "file", "Speech source")
  const sourceStat = await stat(sourcePath)
  if (!sourceStat.isFile() || sourceStat.size !== planOutput.sourceByteSize) {
    throw new Error(`Speech source byte size mismatch: ${planOutput.sourceId}`)
  }
  const sourceSha256 = await hashFile(sourcePath)
  if (sourceSha256 !== planOutput.sourceSha256) {
    throw new Error(`Speech source checksum mismatch: ${planOutput.sourceId}`)
  }
  if (!samePath(await realpath(lexicalPath), sourcePath) || await hashFile(sourcePath) !== sourceSha256) {
    throw new Error(`Speech source changed during verification: ${planOutput.sourceId}`)
  }
  return sourcePath
}

/** Parses the final EBU R128 summary emitted by FFmpeg. */
export function parseSignatureSoundSpeechEbur128(stderr) {
  if (typeof stderr !== "string") throw new Error("Speech EBU R128 output is invalid")
  const summary = stderr.slice(Math.max(stderr.lastIndexOf("Summary:"), 0))
  const loudness = /I:\s*(-?\d+(?:\.\d+)?)\s+LUFS/i.exec(summary)
  const truePeak = /Peak:\s*(-?\d+(?:\.\d+)?)\s+dB(?:FS|TP)/i.exec(summary)
  if (!loudness || !truePeak) throw new Error("Speech EBU R128 summary is incomplete")
  return {
    integratedLoudnessLufs: Number(loudness[1]),
    truePeakDbtp: Number(truePeak[1]),
  }
}

/** Proves the exact headless separator, model weights, and media tool versions. */
export async function verifySignatureSoundSpeechToolchain({
  declaration,
  ripxPython,
  ripScriptLib,
  modelRepo,
  modelWeight,
  modelConfiguration,
  demucsAdapter,
  ffmpeg,
  ffprobe,
  runCommand = runProcess,
}) {
  const [pythonPath, scriptLibPath, modelRepoPath, weightPath, configurationPath, adapterPath, ffmpegPath, ffprobePath] = await Promise.all([
    requireCanonicalFile(ripxPython, "RipX Python"),
    requireCanonicalDirectory(ripScriptLib, "RipScriptLib"),
    requireCanonicalDirectory(modelRepo, "HTDemucs model repository"),
    requireCanonicalFile(modelWeight, "HTDemucs model weight"),
    requireCanonicalFile(modelConfiguration, "HTDemucs model configuration"),
    requireCanonicalFile(demucsAdapter, "Demucs adapter"),
    requireCanonicalFile(ffmpeg, "FFmpeg"),
    requireCanonicalFile(ffprobe, "FFprobe"),
  ])
  if (basename(weightPath) !== declaration.model.weightFileName || !isInside(modelRepoPath, weightPath)) {
    throw new Error("HTDemucs model weight is not the declared file inside the model repository")
  }
  if (basename(configurationPath) !== declaration.model.configurationFileName || !isInside(modelRepoPath, configurationPath)) {
    throw new Error("HTDemucs model configuration is not the declared file inside the model repository")
  }
  const [pythonExecutableSha256, weightSha256, configurationSha256, adapterSha256, ffmpegExecutableSha256, ffprobeExecutableSha256] = await Promise.all([
    hashFile(pythonPath), hashFile(weightPath), hashFile(configurationPath), hashFile(adapterPath),
    hashFile(ffmpegPath), hashFile(ffprobePath),
  ])
  if (pythonExecutableSha256 !== declaration.model.pythonExecutableSha256) throw new Error("RipX Python executable checksum mismatch")
  if (weightSha256 !== declaration.model.weightSha256) throw new Error("HTDemucs model weight checksum mismatch")
  if (configurationSha256 !== declaration.model.configurationSha256) throw new Error("HTDemucs model configuration checksum mismatch")
  if (adapterSha256 !== declaration.model.adapterSha256) throw new Error("Demucs adapter checksum mismatch")
  if (ffmpegExecutableSha256 !== declaration.format.ffmpegExecutableSha256) throw new Error("FFmpeg executable checksum mismatch")
  if (ffprobeExecutableSha256 !== declaration.format.ffprobeExecutableSha256) throw new Error("FFprobe executable checksum mismatch")
  const expectedDemucsPackagePath = await requireConfinedExistingPath(
    scriptLibPath,
    join(scriptLibPath, "demucs"),
    "directory",
    "Demucs package",
  )
  const demucsPackageSha256 = await hashSignatureSoundSpeechPackageTree(expectedDemucsPackagePath)
  if (demucsPackageSha256 !== declaration.model.demucsPackageSha256) throw new Error("Demucs package checksum mismatch")

  const [probeResult, ffmpegResult, ffprobeResult] = await Promise.all([
    runCommand(pythonPath, ["-B", adapterPath, "--rip-script-lib", scriptLibPath, "probe"]),
    runCommand(ffmpegPath, ["-version"]),
    runCommand(ffprobePath, ["-version"]),
  ])
  let probe
  try {
    probe = JSON.parse(probeResult.stdout.trim())
  } catch {
    throw new Error("Demucs adapter probe did not return JSON provenance")
  }
  const ffmpegVersion = firstToolVersion(ffmpegResult.stdout, "ffmpeg")
  const ffprobeVersion = firstToolVersion(ffprobeResult.stdout, "ffprobe")
  const expected = {
    adapterVersion: declaration.model.adapterVersion,
    demucsVersion: declaration.model.demucsVersion,
    backend: declaration.model.backend,
    device: declaration.model.device,
  }
  for (const [field, value] of Object.entries(expected)) {
    if (probe[field] !== value) throw new Error(`Demucs adapter ${field} does not match its declaration`)
  }
  const demucsModulePath = await requireCanonicalFile(probe.demucsModulePath, "Demucs module")
  if (!isInside(scriptLibPath, demucsModulePath)) throw new Error("Demucs module did not load from RipScriptLib")
  const demucsPackagePath = dirname(demucsModulePath)
  if (basename(demucsModulePath).toLowerCase() !== "__init__.py" || !samePath(demucsPackagePath, expectedDemucsPackagePath)) {
    throw new Error("Demucs probe did not identify the package root")
  }
  if (await hashSignatureSoundSpeechPackageTree(demucsPackagePath) !== demucsPackageSha256) {
    throw new Error("Demucs package changed during its provenance probe")
  }
  if (ffmpegVersion !== declaration.format.requiredFfmpegVersion ||
      ffprobeVersion !== declaration.format.requiredFfprobeVersion) {
    throw new Error("Speech-reduction media tools do not match the declared FFmpeg 9.0 build")
  }
  const provenance = {
    adapterVersion: probe.adapterVersion,
    adapterSha256,
    pythonVersion: requireNonempty(probe.pythonVersion, "RipX Python version"),
    pythonExecutableSha256,
    demucsVersion: probe.demucsVersion,
    demucsPackageSha256,
    backend: probe.backend,
    device: probe.device,
    modelName: declaration.model.name,
    modelWeightFileName: declaration.model.weightFileName,
    modelWeightSha256: weightSha256,
    modelConfigurationFileName: declaration.model.configurationFileName,
    modelConfigurationSha256: configurationSha256,
    ffmpegVersion,
    ffprobeVersion,
    ffmpegExecutableSha256,
    ffprobeExecutableSha256,
  }
  return {
    provenance,
    paths: {
      ripxPython: pythonPath,
      ripScriptLib: scriptLibPath,
      modelRepo: modelRepoPath,
      modelWeight: weightPath,
      modelConfiguration: configurationPath,
      demucsAdapter: adapterPath,
      demucsPackage: demucsPackagePath,
      ffmpeg: ffmpegPath,
      ffprobe: ffprobePath,
    },
  }
}

/** Rechecks every canonical executable/model identity immediately before a render task. */
export async function reverifySignatureSoundSpeechToolchain(verifiedToolchain) {
  const verified = requireVerifiedToolchain(verifiedToolchain)
  const { paths, provenance } = verified
  const fileChecks = [
    [paths.ripxPython, provenance.pythonExecutableSha256, "RipX Python executable"],
    [paths.modelWeight, provenance.modelWeightSha256, "HTDemucs model weight"],
    [paths.modelConfiguration, provenance.modelConfigurationSha256, "HTDemucs model configuration"],
    [paths.demucsAdapter, provenance.adapterSha256, "Demucs adapter"],
    [paths.ffmpeg, provenance.ffmpegExecutableSha256, "FFmpeg executable"],
    [paths.ffprobe, provenance.ffprobeExecutableSha256, "FFprobe executable"],
  ]
  for (const [filePath, expectedSha256, label] of fileChecks) {
    const canonical = await requireCanonicalFile(filePath, label)
    if (!samePath(canonical, filePath) || await hashFile(canonical) !== expectedSha256) {
      throw new Error(`${label} changed after validation`)
    }
  }
  const scriptLib = await requireCanonicalDirectory(paths.ripScriptLib, "RipScriptLib")
  const modelRepo = await requireCanonicalDirectory(paths.modelRepo, "HTDemucs model repository")
  if (!samePath(scriptLib, paths.ripScriptLib) || !samePath(modelRepo, paths.modelRepo) ||
      !isInside(scriptLib, paths.demucsPackage) || !isInside(modelRepo, paths.modelWeight) ||
      !isInside(modelRepo, paths.modelConfiguration)) {
    throw new Error("Speech-reduction verified tool roots changed")
  }
  if (await hashSignatureSoundSpeechPackageTree(paths.demucsPackage) !== provenance.demucsPackageSha256) {
    throw new Error("Demucs package changed after validation")
  }
  return verified
}

async function reverifySignatureSoundSpeechMediaTools(verifiedToolchain) {
  const verified = requireVerifiedToolchain(verifiedToolchain)
  for (const [filePath, expectedSha256, label] of [
    [verified.paths.ffmpeg, verified.provenance.ffmpegExecutableSha256, "FFmpeg executable"],
    [verified.paths.ffprobe, verified.provenance.ffprobeExecutableSha256, "FFprobe executable"],
  ]) {
    const canonical = await requireCanonicalFile(filePath, label)
    if (!samePath(canonical, filePath) || await hashFile(canonical) !== expectedSha256) {
      throw new Error(`${label} changed immediately before use`)
    }
  }
}

/** Reads and validates any exact per-source resume bundle already present. */
export async function loadSignatureSoundSpeechResumeReceipt({
  declaration,
  planOutput,
  outputRoot,
}) {
  if (await pathType(outputRoot) === null) return null
  const canonicalRoot = await requireStableCanonicalRoot(outputRoot, "Speech output root")
  const bundlePath = resolveSafeChild(canonicalRoot, planOutput.bundleRelativePath)
  const exists = await pathType(bundlePath)
  if (exists === null) return null
  if (exists !== "directory") throw new Error(`Speech resume bundle is not a directory or is linked: ${planOutput.sourceId}`)
  await requireConfinedExistingPath(canonicalRoot, bundlePath, "directory", "Speech resume bundle")
  const receiptPath = await requireConfinedExistingPath(
    canonicalRoot,
    resolveSafeChild(canonicalRoot, planOutput.receiptRelativePath),
    "file",
    "Speech resume receipt",
  )
  const outputPath = await requireConfinedExistingPath(
    canonicalRoot,
    resolveSafeChild(canonicalRoot, planOutput.outputRelativePath),
    "file",
    "Speech resume audio",
  )
  const receipt = validateSignatureSoundSpeechReductionReceipt(
    JSON.parse(await readFile(receiptPath, "utf8")),
    { declaration, planOutput },
  )
  const outputStat = await stat(outputPath)
  if (outputStat.size !== receipt.outputMeasurement.byteSize ||
      await hashFile(outputPath) !== receipt.outputMeasurement.outputSha256) {
    throw new Error(`Speech resume output checksum mismatch: ${planOutput.sourceId}`)
  }
  return receipt
}

/** Renders one missing source into a directory bundle and atomically publishes that bundle. */
export async function renderSignatureSoundSpeechSource({
  declaration,
  planOutput,
  sourceRoot,
  outputRoot,
  verifiedToolchain,
  runCommand = runProcess,
  inspectAudio = inspectSignatureSoundSpeechAudio,
  reverifyToolchain = reverifySignatureSoundSpeechToolchain,
  reverifyMediaTools = reverifySignatureSoundSpeechMediaTools,
}) {
  const existing = await loadSignatureSoundSpeechResumeReceipt({ declaration, planOutput, outputRoot })
  if (existing) return { state: "resumed", receipt: existing }
  const verified = await reverifyToolchain(verifiedToolchain)
  const toolchain = verified.provenance
  const commands = verified.paths
  const sourcePath = await verifySignatureSoundSpeechSourceFile(planOutput, sourceRoot)
  await mkdir(outputRoot, { recursive: true })
  const canonicalOutputRoot = await requireStableCanonicalRoot(outputRoot, "Speech output root")
  const temporaryBundle = await mkdtemp(join(canonicalOutputRoot, ".speech-partial-"))
  await requireConfinedExistingPath(canonicalOutputRoot, temporaryBundle, "directory", "Speech temporary bundle")
  try {
    const demucsDirectory = join(temporaryBundle, "demucs")
    await mkdir(demucsDirectory)
    const demucsArgv = buildSignatureSoundDemucsAdapterArgv(planOutput, {
      ripxPython: commands.ripxPython,
      adapterPath: commands.demucsAdapter,
      ripScriptLib: commands.ripScriptLib,
      modelRepo: commands.modelRepo,
      outputDirectory: demucsDirectory,
      inputPath: sourcePath,
    })
    await runCommand(demucsArgv[0], demucsArgv.slice(1))
    const stems = await findDemucsStems(demucsDirectory)
    await reverifyMediaTools(verified)
    const inputMeasurement = await inspectAudio({
      filePath: sourcePath,
      ffmpegCommand: commands.ffmpeg,
      ffprobeCommand: commands.ffprobe,
      runCommand,
    })
    const separatedPath = join(temporaryBundle, "separated.wav")
    const mixArgv = buildSignatureSoundSpeechStemMixArgv(planOutput, {
      ffmpegCommand: commands.ffmpeg,
      noVocalsPath: stems.noVocals,
      vocalsPath: stems.vocals,
      outputPath: separatedPath,
      format: declaration.format,
    })
    await runCommand(mixArgv[0], mixArgv.slice(1))
    const separatedMeasurement = await inspectAudio({
      filePath: separatedPath,
      ffmpegCommand: commands.ffmpeg,
      ffprobeCommand: commands.ffprobe,
      runCommand,
    })
    const match = calculateSignatureSoundSpeechLoudnessMatch({
      inputIntegratedLoudnessLufs: inputMeasurement.integratedLoudnessLufs,
      separatedIntegratedLoudnessLufs: separatedMeasurement.integratedLoudnessLufs,
      separatedTruePeakDbtp: separatedMeasurement.truePeakDbtp,
      truePeakCeilingDbtp: declaration.format.truePeakCeilingDbtp,
    })
    const outputPath = join(temporaryBundle, "audio.wav")
    const matchArgv = buildSignatureSoundSpeechMatchArgv(match, {
      ffmpegCommand: commands.ffmpeg,
      inputPath: separatedPath,
      outputPath,
      format: declaration.format,
    })
    await runCommand(matchArgv[0], matchArgv.slice(1))
    await reverifyMediaTools(verified)
    const outputMeasurement = {
      ...await inspectAudio({
        filePath: outputPath,
        ffmpegCommand: commands.ffmpeg,
        ffprobeCommand: commands.ffprobe,
        runCommand,
      }),
      outputSha256: await hashFile(outputPath),
      byteSize: (await stat(outputPath)).size,
    }
    const receipt = validateSignatureSoundSpeechReductionReceipt({
      version: 1,
      algorithmVersion: declaration.algorithmVersion,
      declarationSha256: declaration.declarationSha256,
      outputIdentity: planOutput.outputIdentity,
      batchId: planOutput.batchId,
      groupId: planOutput.groupId,
      sourceId: planOutput.sourceId,
      sourceSha256: planOutput.sourceSha256,
      sourceByteSize: planOutput.sourceByteSize,
      inputRelativePath: planOutput.inputRelativePath,
      mixPolicy: planOutput.mixPolicy,
      vocalsGainDb: planOutput.vocalsGainDb,
      toolchain,
      inputMeasurement,
      separatedMeasurement,
      matchingGainDb: match.matchingGainDb,
      targetIntegratedLoudnessLufs: match.targetIntegratedLoudnessLufs,
      outputRelativePath: planOutput.outputRelativePath,
      outputMeasurement,
    }, { declaration, planOutput })
    await writeFile(join(temporaryBundle, "receipt.json"), `${JSON.stringify(receipt, null, 2)}\n`, { flag: "wx" })
    await rm(demucsDirectory, { recursive: true, force: true })
    await rm(separatedPath, { force: true })
    const finalBundle = resolveSafeChild(canonicalOutputRoot, planOutput.bundleRelativePath)
    if (await pathType(finalBundle) !== null) throw new Error(`Speech output bundle already exists: ${planOutput.sourceId}`)
    await assertNoLinkedOutputAncestors(canonicalOutputRoot, dirname(finalBundle))
    await mkdir(dirname(finalBundle), { recursive: true })
    await requireConfinedExistingPath(canonicalOutputRoot, dirname(finalBundle), "directory", "Speech output parent")
    await requireStableCanonicalRoot(canonicalOutputRoot, "Speech output root")
    await rename(temporaryBundle, finalBundle)
    await requireConfinedExistingPath(canonicalOutputRoot, finalBundle, "directory", "Speech output bundle")
    return { state: "rendered", receipt }
  } catch (error) {
    await rm(temporaryBundle, { recursive: true, force: true })
    throw error
  }
}

/** Uses supplied media tools only for format inspection and EBU R128 measurement. */
export async function inspectSignatureSoundSpeechAudio({
  filePath,
  ffmpegCommand,
  ffprobeCommand,
  runCommand = runProcess,
}) {
  const probeResult = await runCommand(ffprobeCommand, [
    "-v", "error", "-show_entries",
    "format=duration:stream=codec_type,codec_name,sample_rate,channels,bits_per_sample,bits_per_raw_sample",
    "-of", "json", filePath,
  ])
  let probe
  try {
    probe = JSON.parse(probeResult.stdout)
  } catch {
    throw new Error("Speech FFprobe output is invalid")
  }
  const stream = probe.streams?.find(({ codec_type: type }) => type === "audio") ?? probe.streams?.[0]
  if (!stream) throw new Error("Speech FFprobe did not return an audio stream")
  const measureResult = await runCommand(ffmpegCommand, [
    "-nostdin", "-hide_banner", "-loglevel", "info", "-i", filePath,
    "-map", "0:a:0", "-vn", "-af", "ebur128=peak=true", "-f", "null", "-",
  ])
  return {
    durationSeconds: finitePositive(probe.format?.duration, "Speech audio duration"),
    sampleRateHz: positiveInteger(stream.sample_rate, "Speech audio sample rate"),
    channels: positiveInteger(stream.channels, "Speech audio channels"),
    bitsPerSample: nonnegativeInteger(stream.bits_per_raw_sample || stream.bits_per_sample || 0, "Speech audio bit depth"),
    codecName: requireNonempty(stream.codec_name, "Speech audio codec"),
    ...parseSignatureSoundSpeechEbur128(measureResult.stderr),
  }
}

async function loadOwners() {
  const readJson = (relativePath) => readFile(join(repoRoot, relativePath), "utf8").then(JSON.parse)
  const [rawDeclaration, discoveryReview, constructionReview, rawBatches, revisions, amendments] = await Promise.all([
    readJson("data/atmoshaper/signature-sound-speech-reduction-auditions.json"),
    readJson("data/atmoshaper/signature-sound-review.json"),
    readJson("data/atmoshaper/signature-sound-construction-review.json"),
    readJson("data/atmoshaper/signature-sound-whole-concept-review-batches.json"),
    readJson("data/atmoshaper/signature-sound-whole-concept-review-revisions.json"),
    readJson("data/atmoshaper/signature-sound-whole-concept-review-amendments.json"),
  ])
  const base = validateSignatureSoundWholeConceptReviewCatalog(rawBatches, { constructionReview, discoveryReview })
  const revised = applySignatureSoundWholeConceptReviewRevisions(base, revisions)
  const amended = applySignatureSoundWholeConceptReviewAmendments(revised, amendments)
  const declaration = validateSignatureSoundSpeechReductionDeclaration(rawDeclaration, {
    discoveryReview,
    reviewEntries: amended.entries,
  })
  return { declaration, plan: planSignatureSoundSpeechReduction(declaration) }
}

function selectOutputs(plan, options) {
  const selected = plan.outputs.filter((output) => (
    (!options.batchId || output.batchId === options.batchId) &&
    (!options.sourceId || output.sourceId === options.sourceId)
  ))
  if (selected.length === 0) throw new Error("Speech-reduction selection does not match a planned source")
  return selected
}

async function loadAllReceipts({ declaration, plan, outputRoot }) {
  const receipts = []
  const missing = []
  for (const output of plan.outputs) {
    const receipt = await loadSignatureSoundSpeechResumeReceipt({ declaration, planOutput: output, outputRoot })
    if (receipt) receipts.push(receipt)
    else missing.push(output)
  }
  return { receipts, missing }
}

async function validateOrPublishManifest({ declaration, plan, outputRoot, publish }) {
  const manifestPath = join(outputRoot, MANIFEST_NAME)
  const { receipts, missing } = await loadAllReceipts({ declaration, plan, outputRoot })
  const manifestType = await pathType(manifestPath)
  if (missing.length > 0) {
    if (manifestType !== null) throw new Error("Speech-reduction manifest exists before every planned bundle is complete")
    return { state: "partial", complete: receipts.length, missing: missing.length, manifest: null }
  }
  const manifest = createSignatureSoundSpeechReductionManifest(receipts, declaration)
  if (manifestType === "file") {
    const existing = validateSignatureSoundSpeechReductionManifest(JSON.parse(await readFile(manifestPath, "utf8")), declaration)
    if (JSON.stringify(existing) !== JSON.stringify(manifest)) throw new Error("Speech-reduction manifest does not match its resume receipts")
    return { state: "complete", complete: receipts.length, missing: 0, manifest: existing }
  }
  if (manifestType !== null) throw new Error("Speech-reduction manifest path is not a file")
  if (!publish) return { state: "complete-unpublished", complete: receipts.length, missing: 0, manifest }
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" })
  return { state: "complete", complete: receipts.length, missing: 0, manifest }
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseSignatureSoundSpeechReductionCliArguments(argv)
  const { declaration, plan } = await loadOwners()
  const selectedOutputs = selectOutputs(plan, options)
  if (options.mode === "plan") {
    const result = { state: "planned", declarationSha256: declaration.declarationSha256, selected: selectedOutputs.length, plan }
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    return result
  }
  const roots = await prepareSignatureSoundDerivedRoots({
    repoRoot,
    sourceRoot: options.sourceRoot,
    outputRoot: options.outputRoot,
  })
  const verifiedToolchain = await verifySignatureSoundSpeechToolchain({
    declaration,
    ripxPython: options.ripxPython,
    ripScriptLib: options.ripScriptLib,
    modelRepo: options.modelRepo,
    modelWeight: options.modelWeight,
    modelConfiguration: options.modelConfiguration,
    demucsAdapter: options.demucsAdapter,
    ffmpeg: options.ffmpeg,
    ffprobe: options.ffprobe,
  })
  for (const output of plan.outputs) await verifySignatureSoundSpeechSourceFile(output, roots.sourceRoot)
  let canonicalOutput = roots.outputRoot
  if (options.mode === "render") {
    await mkdir(roots.outputRoot, { recursive: true })
    canonicalOutput = await realpath(roots.outputRoot)
    for (const output of selectedOutputs) {
      await renderSignatureSoundSpeechSource({
        declaration,
        planOutput: output,
        sourceRoot: roots.sourceRoot,
        outputRoot: canonicalOutput,
        verifiedToolchain,
      })
    }
  }
  const manifestState = await validateOrPublishManifest({
    declaration,
    plan,
    outputRoot: canonicalOutput,
    publish: options.mode === "render",
  })
  const result = {
    state: options.mode === "render" ? "render-checked" : "validated",
    declarationSha256: declaration.declarationSha256,
    selected: selectedOutputs.length,
    toolchain: verifiedToolchain.provenance,
    manifestState,
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  return result
}

async function findDemucsStems(root) {
  const files = await walkFiles(root)
  const noVocals = files.filter((filePath) => basename(filePath).toLowerCase() === "no_vocals.wav")
  const vocals = files.filter((filePath) => basename(filePath).toLowerCase() === "vocals.wav")
  if (noVocals.length !== 1 || vocals.length !== 1) {
    throw new Error("Demucs did not produce one exact vocals/no_vocals stem pair")
  }
  return { noVocals: noVocals[0], vocals: vocals[0] }
}

async function walkFiles(root) {
  const result = []
  for (const entry of await readdir(root, { withFileTypes: true })) {
    const child = join(root, entry.name)
    if (entry.isDirectory()) result.push(...await walkFiles(child))
    else if (entry.isFile()) result.push(child)
  }
  return result
}

function firstToolVersion(stdout, executable) {
  const escaped = executable.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
  const match = new RegExp(`^(${escaped} version \\S+)`, "m").exec(stdout)
  if (!match) throw new Error(`Speech ${executable} version output is invalid`)
  return match[1]
}

async function requireCanonicalFile(filePath, label) {
  const canonical = await realpath(requireAbsolute(filePath, label))
  if (!(await stat(canonical)).isFile()) throw new Error(`${label} must be a file`)
  return canonical
}

async function requireCanonicalDirectory(directoryPath, label) {
  const canonical = await realpath(requireAbsolute(directoryPath, label))
  if (!(await stat(canonical)).isDirectory()) throw new Error(`${label} must be a directory`)
  return canonical
}

async function requireStableCanonicalRoot(rootPath, label) {
  const lexical = resolve(requireAbsolute(rootPath, label))
  const canonical = await realpath(lexical)
  if (!samePath(lexical, canonical) || !(await stat(canonical)).isDirectory()) {
    throw new Error(`${label} must remain a canonical directory without a link boundary`)
  }
  return canonical
}

async function requireConfinedExistingPath(rootPath, childPath, expectedType, label) {
  const root = await requireStableCanonicalRoot(rootPath, `${label} root`)
  const lexical = resolve(childPath)
  if (!isInside(root, lexical)) throw new Error(`${label} escapes its root`)
  await assertNoLinkedOutputAncestors(root, lexical)
  const childStat = await lstat(lexical)
  if (childStat.isSymbolicLink()) throw new Error(`${label} cannot be a symbolic link or junction`)
  const canonical = await realpath(lexical)
  if (!isInside(root, canonical) || !samePath(lexical, canonical)) {
    throw new Error(`${label} crosses a link or junction boundary`)
  }
  const typeMatches = expectedType === "file" ? childStat.isFile() : childStat.isDirectory()
  if (!typeMatches) throw new Error(`${label} must be a ${expectedType}`)
  return canonical
}

async function assertNoLinkedOutputAncestors(rootPath, targetPath) {
  const root = await requireStableCanonicalRoot(rootPath, "Speech confined root")
  const relation = relative(root, resolve(targetPath))
  if (relation === "" || relation === ".") return
  if (relation.startsWith("..") || isAbsolute(relation)) throw new Error("Speech output path escapes its root")
  let current = root
  for (const segment of relation.split(/[\\/]+/)) {
    current = join(current, segment)
    let currentStat
    try {
      currentStat = await lstat(current)
    } catch (error) {
      if (error?.code === "ENOENT") return
      throw error
    }
    if (currentStat.isSymbolicLink()) throw new Error("Speech output path crosses a symbolic link or junction")
    const canonical = await realpath(current)
    if (!samePath(canonical, current) || !isInside(root, canonical)) {
      throw new Error("Speech output path crosses a reparse boundary")
    }
  }
}

/** Hashes the complete loaded Demucs package using portable paths and file bytes. */
export async function hashSignatureSoundSpeechPackageTree(packageRoot) {
  const root = await requireStableCanonicalRoot(packageRoot, "Demucs package root")
  const files = await walkPackageFiles(root, root)
  files.sort((left, right) => left.relativePath < right.relativePath ? -1 : left.relativePath > right.relativePath ? 1 : 0)
  const hash = createHash("sha256")
  hash.update("demucs-package-tree-v1\0")
  for (const file of files) {
    const pathBytes = Buffer.from(file.relativePath, "utf8")
    const sizes = Buffer.alloc(16)
    sizes.writeBigUInt64BE(BigInt(pathBytes.length), 0)
    sizes.writeBigUInt64BE(BigInt(file.byteSize), 8)
    hash.update(sizes)
    hash.update(pathBytes)
    for await (const chunk of createReadStream(file.absolutePath)) hash.update(chunk)
  }
  return hash.digest("hex")
}

async function walkPackageFiles(root, directory) {
  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === "__pycache__" || entry.name.toLowerCase().endsWith(".pyc")) continue
    const absolutePath = join(directory, entry.name)
    if (entry.isSymbolicLink()) throw new Error("Demucs package cannot contain a symbolic link or junction")
    if (entry.isDirectory()) {
      files.push(...await walkPackageFiles(root, absolutePath))
      continue
    }
    if (!entry.isFile()) throw new Error("Demucs package contains an unsupported filesystem entry")
    const canonical = await realpath(absolutePath)
    if (!samePath(canonical, absolutePath) || !isInside(root, canonical)) {
      throw new Error("Demucs package file crosses a link or junction boundary")
    }
    files.push({
      absolutePath: canonical,
      relativePath: relative(root, canonical).replaceAll("\\", "/"),
      byteSize: (await stat(canonical)).size,
    })
  }
  return files
}

function requireVerifiedToolchain(value) {
  if (!value || typeof value !== "object" || !value.provenance || !value.paths) {
    throw new Error("Verified speech-reduction toolchain is invalid")
  }
  return value
}

function requireAbsolute(value, label) {
  const normalized = requireNonempty(value, label)
  if (!isAbsolute(normalized)) throw new Error(`${label} must be absolute`)
  return resolve(normalized)
}

function requireNonempty(value, label) {
  if (typeof value !== "string" || value.trim() !== value || value.length === 0) throw new Error(`${label} must be a non-empty string`)
  return value
}

function resolveSafeChild(root, portablePath) {
  if (typeof portablePath !== "string" || portablePath.includes("\\") || portablePath.startsWith("/")) {
    throw new Error("Speech-reduction path must be portable and relative")
  }
  const absolute = resolve(root, ...portablePath.split("/"))
  if (!isInside(root, absolute)) throw new Error("Speech-reduction path escapes its root")
  return absolute
}

function isInside(root, child) {
  const relation = relative(resolve(root), resolve(child))
  return relation !== "" && !relation.startsWith("..") && !isAbsolute(relation)
}

function samePath(left, right) {
  return resolve(left).toLowerCase() === resolve(right).toLowerCase()
}

async function pathType(filePath) {
  try {
    const value = await lstat(filePath)
    if (value.isFile()) return "file"
    if (value.isDirectory()) return "directory"
    return "other"
  } catch (error) {
    if (error?.code === "ENOENT") return null
    throw error
  }
}

async function hashFile(filePath) {
  const hash = createHash("sha256")
  for await (const chunk of createReadStream(filePath)) hash.update(chunk)
  return hash.digest("hex")
}

function finitePositive(value, label) {
  const number = Number(value)
  if (!Number.isFinite(number) || number <= 0) throw new Error(`${label} must be positive`)
  return number
}

function positiveInteger(value, label) {
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number <= 0) throw new Error(`${label} must be a positive integer`)
  return number
}

function nonnegativeInteger(value, label) {
  const number = Number(value)
  if (!Number.isSafeInteger(number) || number < 0) throw new Error(`${label} must be a nonnegative integer`)
  return number
}

function runProcess(command, args) {
  return new Promise((resolveResult, reject) => {
    const child = spawn(command, args, { windowsHide: true, stdio: ["ignore", "pipe", "pipe"] })
    const stdout = []
    const stderr = []
    child.stdout.on("data", (chunk) => stdout.push(chunk))
    child.stderr.on("data", (chunk) => stderr.push(chunk))
    child.on("error", reject)
    child.on("close", (code) => {
      const result = { stdout: Buffer.concat(stdout).toString("utf8"), stderr: Buffer.concat(stderr).toString("utf8") }
      if (code === 0) resolveResult(result)
      else reject(new Error(`Speech media command failed with exit code ${code}: ${result.stderr.trim()}`))
    })
  })
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
