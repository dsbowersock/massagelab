import { spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { createReadStream } from "node:fs"
import {
  lstat, mkdir, readFile, realpath, rename, rm, rmdir, stat, writeFile,
} from "node:fs/promises"
import { basename, dirname, isAbsolute, join, parse, relative, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

import {
  assertSignatureSoundDerivedOutputRoot,
  buildSignatureSoundDerivedRenderArgv,
  planSignatureSoundDerivedAudioBatch,
  validateSignatureSoundDerivedAudioBatch,
  validateSignatureSoundDerivedMeasurements,
} from "../lib/atmoshaper/signature-sound-derived-audio.js"
import {
  parseSignatureSoundDerivedAudioCliArguments,
  selectSignatureSoundDerivedAudioBatchEntry,
  validateSignatureSoundDerivedAudioBatchRegistry,
} from "../lib/atmoshaper/signature-sound-derived-audio-batch-registry.js"

const scriptPath = fileURLToPath(import.meta.url)
const repoRoot = resolve(dirname(scriptPath), "..")
const SHA256 = /^[a-f0-9]{64}$/
const RECORDED_FFMPEG_VERSION = "ffmpeg version 9.0-full_build-www.gyan.dev"
export function requireRecordedSignatureSoundFfmpegVersion(banner) {
  const firstLine = String(banner).split(/\r?\n/, 1)[0].trim()
  if (!firstLine.startsWith(`${RECORDED_FFMPEG_VERSION} `) && firstLine !== RECORDED_FFMPEG_VERSION) {
    throw new Error("Signature derived-audio rendering requires the recorded FFmpeg 9.0 build")
  }
  return RECORDED_FFMPEG_VERSION
}
/** Extracts the final integrated-loudness and true-peak values from FFmpeg EBU R128 output. */
export function parseSignatureSoundEbur128(stderr) {
  const loudnessMatches = [...String(stderr).matchAll(/\bI:\s*(-?\d+(?:\.\d+)?)\s+LUFS\b/g)]
  const peakMatches = [...String(stderr).matchAll(/\bPeak:\s*(-?\d+(?:\.\d+)?)\s+dBFS\b/g)]
  if (loudnessMatches.length === 0 || peakMatches.length === 0) {
    throw new Error("FFmpeg EBU R128 output is missing integrated loudness or true peak")
  }
  return {
    integratedLoudnessLufs: Number(loudnessMatches.at(-1)[1]),
    truePeakDbtp: Number(peakMatches.at(-1)[1]),
  }
}
/** Verifies the exact source size and checksum before invoking a media tool. */
export async function verifySignatureSoundDerivedSourceFile(source, sourceRoot) {
  const absolutePath = resolveSafeChild(sourceRoot, source.relativePath)
  const sourceStat = await stat(absolutePath)
  if (!sourceStat.isFile()) throw new Error(`Signature derived-audio source ${source.sourceId} is not a file`)
  if (sourceStat.size !== source.byteSize) throw new Error(`Signature derived-audio source ${source.sourceId} byte size mismatch`)
  const checksum = await hashFile(absolutePath)
  if (checksum !== source.sha256) throw new Error(`Signature derived-audio source ${source.sourceId} checksum mismatch`)
  return absolutePath
}
/** Canonicalizes the nearest existing output ancestor and fences source/repository/filesystem roots. */
export async function prepareSignatureSoundDerivedRoots({ repoRoot: repositoryRoot, sourceRoot, outputRoot }) {
  if (!isAbsolute(sourceRoot) || !isAbsolute(outputRoot)) throw new Error("Signature derived-audio roots must be absolute")
  const canonicalSource = await realpath(sourceRoot)
  if (!(await stat(canonicalSource)).isDirectory()) throw new Error("Signature derived-audio source root must be a directory")
  const repositoryRoots = await resolveRepositoryRoots(repositoryRoot)
  const canonicalOutput = await resolveThroughNearestExistingAncestor(outputRoot)
  assertSignatureSoundDerivedOutputRoot({
    outputRoot: canonicalOutput,
    sourceRoot: canonicalSource,
    repositoryRoots,
    filesystemRoots: [parse(canonicalOutput).root],
  })
  return { sourceRoot: canonicalSource, outputRoot: canonicalOutput, repositoryRoots }
}
/** Measures every exact source with FFprobe plus EBU R128 and returns portable evidence. */
export async function measureSignatureSoundDerivedConcept({
  batch, groupId, sourceRoot, ffmpegCommand, ffprobeCommand, runCommand = runProcess,
}) {
  const concept = batch.concepts.find((entry) => entry.groupId === groupId)
  if (!concept) throw new Error(`Signature derived-audio batch does not contain ${groupId}`)
  const versionResult = await runCommand(ffmpegCommand, ["-version"])
  const toolVersion = requireRecordedSignatureSoundFfmpegVersion(versionResult.stdout)
  const sources = {}
  for (const source of concept.sources) {
    const absolutePath = await verifySignatureSoundDerivedSourceFile(source, sourceRoot)
    const probe = await probeAudio(ffprobeCommand, absolutePath, runCommand)
    const measured = await runCommand(ffmpegCommand, [
      "-nostdin", "-hide_banner", "-loglevel", "info", "-i", absolutePath,
      "-map", "0:a:0", "-vn", "-af", "ebur128=peak=true", "-f", "null", "-",
    ])
    sources[source.sourceId] = {
      sourceSha256: source.sha256,
      durationSeconds: probe.durationSeconds,
      sampleRateHz: probe.sampleRateHz,
      channels: probe.channels,
      bitsPerSample: probe.bitsPerSample,
      ...parseSignatureSoundEbur128(measured.stderr),
    }
  }
  return validateSignatureSoundDerivedMeasurements({
    version: 1,
    measurementMethod: "ffmpeg-ebur128-v1",
    toolVersion,
    sources,
  }, batch, groupId)
}
/** Renders all temporary files, verifies all of them, then atomically publishes outputs and manifest. */
export async function publishSignatureSoundDerivedOutputs({
  plan,
  sourceRoot,
  outputRoot,
  ffmpegCommand,
  ffprobeCommand,
  runCommand = runProcess,
  renderOutput = defaultRenderOutput,
  inspectOutput = defaultInspectOutput,
}) {
  const manifestPath = join(outputRoot, "batch-manifest.json")
  const manifestTemporaryPath = join(outputRoot, `.partial-manifest-${plan.batchDeclarationSha256}.json`)
  const records = plan.outputs.map((planOutput) => {
    const finalPath = resolveSafeChild(outputRoot, planOutput.outputRelativePath)
    const temporaryRelativePath = `${dirnamePortable(planOutput.outputRelativePath)}/.partial-${planOutput.outputIdentity}.wav`
    const temporaryPath = resolveSafeChild(outputRoot, temporaryRelativePath)
    return { planOutput, finalPath, temporaryPath, temporaryRelativePath }
  })
  await assertMissing(manifestPath)
  await assertMissing(manifestTemporaryPath)
  for (const record of records) {
    await assertMissing(record.finalPath)
    await assertMissing(record.temporaryPath)
  }
  const createdDirectories = [...new Set(records.map(({ finalPath }) => dirname(finalPath)))]
  const createdFiles = []
  try {
    await mkdir(outputRoot, { recursive: true })
    for (const directory of createdDirectories) await mkdir(directory, { recursive: true })
    for (const record of records) {
      await renderOutput({
        planOutput: record.planOutput,
        temporaryPath: record.temporaryPath,
        argv: buildSignatureSoundDerivedRenderArgv({
          ...record.planOutput,
          outputRelativePath: record.temporaryRelativePath,
        }, { ffmpegCommand, sourceRoot, outputRoot }),
        runCommand,
      })
      createdFiles.push(record.temporaryPath)
    }
    const inspected = []
    for (const record of records) {
      const output = await inspectOutput({
        planOutput: record.planOutput,
        temporaryPath: record.temporaryPath,
        ffmpegCommand,
        ffprobeCommand,
        runCommand,
        targetIntegratedLoudnessLufs: plan.targetIntegratedLoudnessLufs,
      })
      validateRenderedOutput(record.planOutput, output, plan.targetIntegratedLoudnessLufs)
      inspected.push(output)
    }
    for (const record of records) {
      await rename(record.temporaryPath, record.finalPath)
      createdFiles.splice(createdFiles.indexOf(record.temporaryPath), 1)
      createdFiles.push(record.finalPath)
    }
    const manifest = {
      version: 1,
      batchId: plan.batchId,
      batchDeclarationSha256: plan.batchDeclarationSha256,
      algorithmVersion: plan.algorithmVersion,
      groupId: plan.groupId,
      processingIntentIds: plan.processingIntentIds,
      targetIntegratedLoudnessLufs: plan.targetIntegratedLoudnessLufs,
      measurementMethod: plan.measurementMethod,
      measurementToolVersion: plan.measurementToolVersion,
      outputs: records.map(({ planOutput }, index) => ({
        sourceId: planOutput.sourceId,
        sourceSha256: planOutput.sourceSha256,
        outputRelativePath: planOutput.outputRelativePath,
        outputIdentity: planOutput.outputIdentity,
        gainDb: planOutput.gainDb,
        ffmpegArgv: buildSignatureSoundDerivedRenderArgv(planOutput, {
          ffmpegCommand: "ffmpeg",
          sourceRoot: "<source-root>",
          outputRoot: "<output-root>",
        }),
        inputMeasurement: planOutput.inputMeasurement,
        outputMeasurement: inspected[index],
      })),
    }
    await writeFile(manifestTemporaryPath, `${JSON.stringify(manifest, null, 2)}\n`, { flag: "wx" })
    createdFiles.push(manifestTemporaryPath)
    await rename(manifestTemporaryPath, manifestPath)
    createdFiles.splice(createdFiles.indexOf(manifestTemporaryPath), 1)
    createdFiles.push(manifestPath)
    return manifest
  } catch (error) {
    for (const filePath of createdFiles.reverse()) await rm(filePath, { force: true })
    for (const directory of createdDirectories.reverse()) await rmdir(directory).catch(() => {})
    await rmdir(outputRoot).catch(() => {})
    throw error
  }
}
async function defaultRenderOutput({ argv, runCommand }) {
  await runCommand(argv[0], argv.slice(1))
}
async function defaultInspectOutput({ temporaryPath, ffmpegCommand, ffprobeCommand, runCommand }) {
  const probe = await probeAudio(ffprobeCommand, temporaryPath, runCommand)
  const measured = await runCommand(ffmpegCommand, [
    "-nostdin", "-hide_banner", "-loglevel", "info", "-i", temporaryPath,
    "-map", "0:a:0", "-vn", "-af", "ebur128=peak=true", "-f", "null", "-",
  ])
  return {
    outputSha256: await hashFile(temporaryPath),
    byteSize: (await stat(temporaryPath)).size,
    ...probe,
    ...parseSignatureSoundEbur128(measured.stderr),
  }
}
function validateRenderedOutput(planOutput, output, targetLoudness) {
  if (!SHA256.test(output.outputSha256) || !Number.isSafeInteger(output.byteSize) || output.byteSize <= 0) {
    throw new Error("Signature derived-audio output identity is incomplete")
  }
  if (output.codecName !== planOutput.outputCodec || output.sampleRateHz !== planOutput.outputSampleRateHz ||
      output.channels !== planOutput.outputChannels || output.bitsPerSample !== 24) {
    throw new Error(`Signature derived-audio output ${planOutput.outputRelativePath} format verification failed`)
  }
  if (planOutput.recipeKind === "trim-boundary-fades") {
    if (Math.abs(output.durationSeconds - planOutput.expectedDurationSeconds) > 0.02) {
      throw new Error(`Signature derived-audio output ${planOutput.outputRelativePath} duration verification failed`)
    }
    if (output.truePeakDbtp > planOutput.truePeakCeilingDbtp) {
      throw new Error(`Signature derived-audio output ${planOutput.outputRelativePath} true peak verification failed`)
    }
  } else {
    if (Math.abs(output.durationSeconds - planOutput.inputMeasurement.durationSeconds) > 1 / planOutput.outputSampleRateHz) {
      throw new Error(`Signature derived-audio output ${planOutput.outputRelativePath} duration verification failed`)
    }
    if (Math.abs(output.integratedLoudnessLufs - targetLoudness) > 0.2) {
      throw new Error(`Signature derived-audio output ${planOutput.outputRelativePath} loudness verification failed`)
    }
  }
}

async function probeAudio(ffprobeCommand, absolutePath, runCommand) {
  const result = await runCommand(ffprobeCommand, [
    "-v", "error", "-show_entries",
    "format=duration:stream=codec_type,codec_name,sample_rate,channels,bits_per_sample",
    "-of", "json", absolutePath,
  ])
  const parsed = JSON.parse(result.stdout)
  const stream = parsed.streams?.find(({ codec_type: type }) => type === "audio") ?? parsed.streams?.[0]
  if (!stream) throw new Error("FFprobe did not return an audio stream")
  return {
    durationSeconds: Number(parsed.format?.duration),
    sampleRateHz: Number(stream.sample_rate),
    channels: Number(stream.channels),
    bitsPerSample: Number(stream.bits_per_sample),
    codecName: stream.codec_name,
  }
}

async function resolveRepositoryRoots(repositoryRoot) {
  const lexical = resolve(repositoryRoot)
  const canonical = await realpath(lexical)
  const roots = [canonical]
  const gitPath = join(lexical, ".git")
  try {
    const gitStat = await lstat(gitPath)
    if (!gitStat.isFile()) return roots
    const match = /^gitdir:\s*(.+?)\s*$/i.exec(await readFile(gitPath, "utf8"))
    if (!match) throw new Error("Invalid worktree gitfile")
    const gitDirectory = resolve(dirname(gitPath), match[1])
    const commonDirectory = (await readFile(join(gitDirectory, "commondir"), "utf8")).trim()
    const commonGitDirectory = await realpath(resolve(gitDirectory, commonDirectory))
    roots.push(await realpath(dirname(commonGitDirectory)))
  } catch (error) {
    if (error?.code !== "ENOENT") throw error
  }
  return [...new Set(roots)]
}

async function resolveThroughNearestExistingAncestor(targetPath) {
  const lexical = resolve(targetPath)
  let current = lexical
  const suffix = []
  while (true) {
    try {
      const canonicalAncestor = await realpath(current)
      const canonical = resolve(canonicalAncestor, ...suffix)
      const existing = current === lexical
      if (existing && !(await stat(canonical)).isDirectory()) throw new Error("Signature derived-audio output root must be a directory")
      return canonical
    } catch (error) {
      if (error?.code !== "ENOENT") throw error
      const parent = dirname(current)
      if (parent === current) throw new Error("Signature derived-audio output root could not be resolved")
      suffix.unshift(basename(current))
      current = parent
    }
  }
}

function resolveSafeChild(root, portablePath) {
  if (typeof portablePath !== "string" || portablePath.includes("\\") || portablePath.startsWith("/")) {
    throw new Error("Signature derived-audio path must be a portable relative path")
  }
  const absolute = resolve(root, ...portablePath.split("/"))
  const relation = relative(resolve(root), absolute)
  if (relation === "" || relation.startsWith("..") || isAbsolute(relation)) throw new Error("Signature derived-audio path escapes its root")
  return absolute
}

function dirnamePortable(portablePath) {
  const index = portablePath.lastIndexOf("/")
  if (index <= 0) throw new Error("Signature derived-audio output path needs a directory")
  return portablePath.slice(0, index)
}

async function assertMissing(filePath) {
  try {
    await lstat(filePath)
    throw new Error(`Signature derived-audio destination already exists; overwrite is forbidden: ${basename(filePath)}`)
  } catch (error) {
    if (error?.code !== "ENOENT") throw error
  }
}

async function hashFile(filePath) {
  const digest = createHash("sha256")
  for await (const chunk of createReadStream(filePath)) digest.update(chunk)
  return digest.digest("hex")
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
      else reject(new Error(`Media command failed with exit code ${code}: ${result.stderr.trim()}`))
    })
  })
}

export async function main(argv = process.argv.slice(2)) {
  const options = parseSignatureSoundDerivedAudioCliArguments(argv)
  const registry = validateSignatureSoundDerivedAudioBatchRegistry(JSON.parse(await readFile(
    join(repoRoot, "data/atmoshaper/signature-sound-derived-audio-batch-registry.json"),
    "utf8",
  )))
  const batchEntry = selectSignatureSoundDerivedAudioBatchEntry(registry, options.batchId)
  const [rawBatch, constructionReview, discoveryReview] = await Promise.all([
    readFile(join(repoRoot, ...batchEntry.declarationRelativePath.split("/")), "utf8").then(JSON.parse),
    readFile(join(repoRoot, "data/atmoshaper/signature-sound-construction-review.json"), "utf8").then(JSON.parse),
    readFile(join(repoRoot, "data/atmoshaper/signature-sound-review.json"), "utf8").then(JSON.parse),
  ])
  const batch = validateSignatureSoundDerivedAudioBatch(rawBatch, { constructionReview, discoveryReview })
  if (batch.batchId !== batchEntry.batchId) throw new Error("Signature derived-audio registry batch id does not match its declaration")
  const readyConcepts = batch.concepts.filter(({ state }) => state === "ready")
  if (readyConcepts.length !== 1) throw new Error("Signature derived-audio batch must contain exactly one ready concept")
  const groupId = readyConcepts[0].groupId
  const roots = await prepareSignatureSoundDerivedRoots({
    repoRoot,
    sourceRoot: options.sourceRoot,
    outputRoot: options.outputRoot,
  })
  const measurements = await measureSignatureSoundDerivedConcept({
    batch,
    groupId,
    sourceRoot: roots.sourceRoot,
    ffmpegCommand: options.ffmpeg,
    ffprobeCommand: options.ffprobe,
  })
  const plan = planSignatureSoundDerivedAudioBatch(batch, measurements, { groupId })
  if (options.mode === "measure") {
    process.stdout.write(`${JSON.stringify({ measurements, plan }, null, 2)}\n`)
    return { state: "measured", measurements, plan }
  }
  await mkdir(roots.outputRoot, { recursive: true })
  const canonicalOutput = await realpath(roots.outputRoot)
  assertSignatureSoundDerivedOutputRoot({
    outputRoot: canonicalOutput,
    sourceRoot: roots.sourceRoot,
    repositoryRoots: roots.repositoryRoots,
    filesystemRoots: [parse(canonicalOutput).root],
  })
  const manifest = await publishSignatureSoundDerivedOutputs({
    plan,
    sourceRoot: roots.sourceRoot,
    outputRoot: canonicalOutput,
    ffmpegCommand: options.ffmpeg,
    ffprobeCommand: options.ffprobe,
  })
  process.stdout.write(`${JSON.stringify({ state: "rendered", outputs: manifest.outputs.length }, null, 2)}\n`)
  return { state: "rendered", manifest }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
