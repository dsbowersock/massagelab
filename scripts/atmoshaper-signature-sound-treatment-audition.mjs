#!/usr/bin/env node

import { spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { createReadStream } from "node:fs"
import { mkdir, readFile, rename, rm, rmdir, stat, writeFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import {
  buildSignatureSoundTreatmentRenderArgv,
  planSignatureSoundTreatmentAuditionBatch,
  validateSignatureSoundTreatmentAuditionBatch,
} from "../lib/atmoshaper/signature-sound-treatment-audition.js"
import {
  parseSignatureSoundDerivedAudioCliArguments,
  selectSignatureSoundDerivedAudioBatchEntry,
  validateSignatureSoundDerivedAudioBatchRegistry,
} from "../lib/atmoshaper/signature-sound-derived-audio-batch-registry.js"
import {
  parseSignatureSoundEbur128,
  prepareSignatureSoundDerivedRoots,
  requireRecordedSignatureSoundFfmpegVersion,
  verifySignatureSoundDerivedSourceFile,
} from "./atmoshaper-signature-sound-derived-audio.mjs"

const SHA256 = /^[a-f0-9]{64}$/
const scriptPath = fileURLToPath(import.meta.url)
const repoRoot = resolve(dirname(scriptPath), "..")
const BATCH_ID = "batch-03-sci-fi-whistles-treatment-audition"

/** Measures exact source bytes without creating the external output directory. */
export async function measureSignatureSoundTreatmentAuditionBatch({
  batch,
  sourceRoot,
  ffmpegCommand,
  ffprobeCommand,
  runCommand = runProcess,
}) {
  const version = await runCommand(ffmpegCommand, ["-version"])
  const toolVersion = requireRecordedSignatureSoundFfmpegVersion(version.stdout)
  const sources = {}
  for (const source of batch.sources) {
    const absolutePath = await verifySignatureSoundDerivedSourceFile(source, sourceRoot)
    const probe = await probeAudio(ffprobeCommand, absolutePath, runCommand)
    const measured = await runCommand(ffmpegCommand, [
      "-nostdin", "-hide_banner", "-loglevel", "info", "-i", absolutePath,
      "-map", "0:a:0", "-vn", "-af", "ebur128=peak=true", "-f", "null", "-",
    ])
    sources[source.sourceId] = {
      durationSeconds: probe.durationSeconds,
      integratedLoudnessLufs: parseSignatureSoundEbur128(measured.stderr).integratedLoudnessLufs,
      truePeakDbtp: parseSignatureSoundEbur128(measured.stderr).truePeakDbtp,
      sampleRateHz: probe.sampleRateHz,
      channels: probe.channels,
    }
  }
  return { version: 1, batchDeclarationSha256: batch.batchDeclarationSha256, toolVersion, sources }
}

/**
 * Renders every treatment to a task-owned temporary path, verifies the entire
 * matrix, and only then publishes immutable outputs plus the manifest.
 */
export async function publishSignatureSoundTreatmentAuditionOutputs({
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
    return {
      planOutput,
      finalPath,
      temporaryRelativePath,
      temporaryPath: resolveSafeChild(outputRoot, temporaryRelativePath),
    }
  })
  if (new Set(records.map(({ planOutput }) => planOutput.outputIdentity)).size !== records.length) {
    throw new Error("Signature treatment-audition outputs contain duplicate identities")
  }
  if (new Set(records.map(({ finalPath }) => finalPath)).size !== records.length) {
    throw new Error("Signature treatment-audition outputs contain duplicate paths")
  }
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
        argv: buildSignatureSoundTreatmentRenderArgv(record.planOutput, {
          ffmpegCommand,
          sourceRoot,
          outputRoot,
          destinationRelativePath: record.temporaryRelativePath,
        }),
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
      })
      validateRenderedTreatment(record.planOutput, output)
      inspected.push(output)
    }
    for (const record of records) {
      await rename(record.temporaryPath, record.finalPath)
      replaceCreatedPath(createdFiles, record.temporaryPath, record.finalPath)
    }

    const manifest = {
      version: 1,
      batchId: plan.batchId,
      batchDeclarationSha256: plan.batchDeclarationSha256,
      algorithmVersion: plan.algorithmVersion,
      groupId: plan.groupId,
      processingIntentIds: [...plan.processingIntentIds],
      reviewKind: "treatment-audition",
      measurementToolVersion: plan.toolVersion,
      outputs: records.map(({ planOutput }, index) => ({
        sourceId: planOutput.sourceId,
        sourceSha256: planOutput.sourceSha256,
        variantId: planOutput.variantId,
        variantLabel: planOutput.variantLabel,
        effect: planOutput.effect,
        outputRelativePath: planOutput.outputRelativePath,
        outputIdentity: planOutput.outputIdentity,
        ffmpegArgv: buildSignatureSoundTreatmentRenderArgv(planOutput, {
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
    replaceCreatedPath(createdFiles, manifestTemporaryPath, manifestPath)
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

function validateRenderedTreatment(planOutput, output) {
  if (!SHA256.test(output.outputSha256) || !Number.isSafeInteger(output.byteSize) || output.byteSize <= 0) {
    throw new Error("Signature treatment-audition output identity is incomplete")
  }
  if (output.codecName !== planOutput.outputCodec || output.sampleRateHz !== planOutput.outputSampleRateHz ||
      output.channels !== planOutput.outputChannels || output.bitsPerSample !== 24) {
    throw new Error(`Signature treatment-audition output ${planOutput.outputRelativePath} format verification failed`)
  }
  if (Math.abs(output.durationSeconds - planOutput.expectedDurationSeconds) > 0.02) {
    throw new Error(`Signature treatment-audition output ${planOutput.outputRelativePath} duration verification failed`)
  }
  if (output.truePeakDbtp > planOutput.truePeakCeilingDbtp) {
    throw new Error(`Signature treatment-audition output ${planOutput.outputRelativePath} true peak verification failed`)
  }
}

async function probeAudio(ffprobeCommand, absolutePath, runCommand) {
  const result = await runCommand(ffprobeCommand, [
    "-v", "error", "-show_entries", "format=duration:stream=codec_type,codec_name,sample_rate,channels,bits_per_sample",
    "-of", "json", absolutePath,
  ])
  const parsed = JSON.parse(result.stdout)
  const stream = parsed.streams?.find(({ codec_type }) => codec_type === "audio") ?? parsed.streams?.[0]
  const durationSeconds = Number(parsed.format?.duration)
  const sampleRateHz = Number(stream?.sample_rate)
  const channels = Number(stream?.channels)
  if (!stream || !Number.isFinite(durationSeconds) || durationSeconds <= 0 ||
      !Number.isInteger(sampleRateHz) || sampleRateHz <= 0 || !Number.isInteger(channels) || channels <= 0) {
    throw new Error("FFprobe did not return a valid treatment-audition audio stream")
  }
  return {
    durationSeconds,
    sampleRateHz,
    channels,
    bitsPerSample: Number(stream.bits_per_sample),
    codecName: stream.codec_name,
  }
}

async function assertMissing(path) {
  try {
    await import("node:fs/promises").then(({ access }) => access(path))
  } catch (error) {
    if (error?.code === "ENOENT") return
    throw error
  }
  throw new Error(`Signature treatment-audition destination already exists: ${path}`)
}

function resolveSafeChild(root, portablePath) {
  if (typeof portablePath !== "string" || portablePath.includes("\\") || portablePath.startsWith("/") ||
      portablePath.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new Error("Signature treatment-audition output path must be portable and relative")
  }
  const resolved = resolve(root, ...portablePath.split("/"))
  const prefix = `${resolve(root)}${process.platform === "win32" ? "\\" : "/"}`.toLowerCase()
  if (!resolved.toLowerCase().startsWith(prefix)) throw new Error("Signature treatment-audition output escapes its root")
  return resolved
}

function dirnamePortable(portablePath) {
  return portablePath.split("/").slice(0, -1).join("/")
}

function replaceCreatedPath(createdFiles, oldPath, newPath) {
  const index = createdFiles.indexOf(oldPath)
  if (index >= 0) createdFiles.splice(index, 1, newPath)
  else createdFiles.push(newPath)
}

function hashFile(filePath) {
  return new Promise((resolveHash, reject) => {
    const hash = createHash("sha256")
    const stream = createReadStream(filePath)
    stream.on("data", (chunk) => hash.update(chunk))
    stream.on("error", reject)
    stream.on("end", () => resolveHash(hash.digest("hex")))
  })
}

function runProcess(command, args) {
  return new Promise((resolveResult, reject) => {
    const child = spawn(command, args, { windowsHide: true })
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

/** Runs the closed Batch 03 measurement or no-overwrite render command. */
export async function main(argv = process.argv.slice(2)) {
  const options = parseSignatureSoundDerivedAudioCliArguments(argv)
  const registry = validateSignatureSoundDerivedAudioBatchRegistry(JSON.parse(await readFile(
    join(repoRoot, "data/atmoshaper/signature-sound-derived-audio-batch-registry.json"),
    "utf8",
  )))
  const entry = selectSignatureSoundDerivedAudioBatchEntry(registry, options.batchId ?? BATCH_ID)
  if (entry.batchId !== BATCH_ID) throw new Error(`Signature treatment-audition runner only supports ${BATCH_ID}`)
  const [declaration, constructionReview, discoveryReview] = await Promise.all([
    readFile(join(repoRoot, ...entry.declarationRelativePath.split("/")), "utf8").then(JSON.parse),
    readFile(join(repoRoot, "data/atmoshaper/signature-sound-construction-review.json"), "utf8").then(JSON.parse),
    readFile(join(repoRoot, "data/atmoshaper/signature-sound-review.json"), "utf8").then(JSON.parse),
  ])
  const batch = validateSignatureSoundTreatmentAuditionBatch(declaration, { constructionReview, discoveryReview })
  const roots = await prepareSignatureSoundDerivedRoots({
    repoRoot,
    sourceRoot: options.sourceRoot,
    outputRoot: options.outputRoot,
  })
  const measurements = await measureSignatureSoundTreatmentAuditionBatch({
    batch,
    sourceRoot: roots.sourceRoot,
    ffmpegCommand: options.ffmpeg,
    ffprobeCommand: options.ffprobe,
  })
  const plan = planSignatureSoundTreatmentAuditionBatch(batch, measurements)
  if (options.mode === "measure") {
    process.stdout.write(`${JSON.stringify({ measurements, plan }, null, 2)}\n`)
    return { state: "measured", measurements, plan }
  }
  const manifest = await publishSignatureSoundTreatmentAuditionOutputs({
    plan,
    sourceRoot: roots.sourceRoot,
    outputRoot: roots.outputRoot,
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
