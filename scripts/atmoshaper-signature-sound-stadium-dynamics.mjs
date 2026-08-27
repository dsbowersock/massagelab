import { spawn } from "node:child_process"
import { createHash } from "node:crypto"
import { createReadStream } from "node:fs"
import {
  lstat, mkdir, mkdtemp, readFile, realpath, rename, rm, stat, writeFile,
} from "node:fs/promises"
import { dirname, isAbsolute, join, relative, resolve } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"

import {
  buildSignatureSoundStadiumMeasurementArgv,
  buildSignatureSoundStadiumRenderArgv,
  calculateSignatureSoundStadiumMatchingGain,
  createSignatureSoundStadiumDynamicsManifest,
  planSignatureSoundStadiumDynamics,
  validateSignatureSoundStadiumDynamicsDeclaration,
  validateSignatureSoundStadiumDynamicsManifest,
  validateSignatureSoundStadiumDynamicsReceipt,
} from "../lib/atmoshaper/signature-sound-stadium-dynamics.js"
import { prepareSignatureSoundDerivedRoots } from "./atmoshaper-signature-sound-derived-audio.mjs"

const scriptPath = fileURLToPath(import.meta.url)
const repoRoot = resolve(dirname(scriptPath), "..")
const MANIFEST_NAME = "stadium-dynamics-manifest.json"
const RECEIPT_NAME = "receipt.json"
const MODES = new Set(["plan", "render", "validate"])
const CLI_KEYS = new Set(["mode", "input-root", "output-root", "ffmpeg", "ffprobe"])

/** Parses the closed producer CLI without accepting undeclared destinations. */
export function parseSignatureSoundStadiumDynamicsCliArguments(argv) {
  const values = new Map()
  for (let index = 0; index < argv.length; index += 2) {
    const option = argv[index]
    const value = argv[index + 1]
    if (typeof option !== "string" || !option.startsWith("--") || value === undefined) {
      throw new Error("Stadium dynamics arguments must be --key value pairs")
    }
    const key = option.slice(2)
    if (!CLI_KEYS.has(key) || values.has(key)) throw new Error(`Unsupported or duplicate Stadium option: ${option}`)
    values.set(key, value)
  }
  const mode = values.get("mode") ?? "plan"
  if (!MODES.has(mode)) throw new Error("Stadium dynamics mode must be plan, render, or validate")
  if (mode === "plan") return { mode }
  return {
    mode,
    inputRoot: requireAbsolute(values.get("input-root"), "Stadium input root"),
    outputRoot: requireAbsolute(values.get("output-root"), "Stadium output root"),
    ffmpeg: requireAbsolute(values.get("ffmpeg"), "Stadium FFmpeg"),
    ffprobe: requireAbsolute(values.get("ffprobe"), "Stadium FFprobe"),
  }
}

/** Parses the final EBU R128 summary, including the within-file loudness range. */
export function parseSignatureSoundStadiumEbur128(stderr) {
  const text = String(stderr)
  const last = (pattern, label) => {
    const matches = [...text.matchAll(pattern)]
    if (matches.length === 0) throw new Error(`Stadium EBU R128 output is missing ${label}`)
    return Number(matches.at(-1)[1])
  }
  return {
    integratedLoudnessLufs: last(/\bI:\s*(-?\d+(?:\.\d+)?)\s+LUFS\b/g, "integrated loudness"),
    loudnessRangeLu: last(/\bLRA:\s*(-?\d+(?:\.\d+)?)\s+LU\b/g, "loudness range"),
    loudnessRangeLowLufs: last(/\bLRA low:\s*(-?\d+(?:\.\d+)?)\s+LUFS\b/g, "loudness-range low"),
    loudnessRangeHighLufs: last(/\bLRA high:\s*(-?\d+(?:\.\d+)?)\s+LUFS\b/g, "loudness-range high"),
    truePeakDbtp: last(/\bPeak:\s*(-?\d+(?:\.\d+)?)\s+dBFS\b/g, "true peak"),
  }
}

/** Authenticates the exact retained FFmpeg/FFprobe pair used by prior audio work. */
export async function verifySignatureSoundStadiumMediaTools({
  declaration, ffmpeg, ffprobe, runCommand = runProcess,
}) {
  const ffmpegPath = await requireCanonicalFile(ffmpeg, "Stadium FFmpeg")
  const ffprobePath = await requireCanonicalFile(ffprobe, "Stadium FFprobe")
  const [ffmpegHash, ffprobeHash, ffmpegVersion, ffprobeVersion] = await Promise.all([
    hashFile(ffmpegPath),
    hashFile(ffprobePath),
    runCommand(ffmpegPath, ["-version"]),
    runCommand(ffprobePath, ["-version"]),
  ])
  if (ffmpegHash !== declaration.format.ffmpegExecutableSha256 ||
      ffprobeHash !== declaration.format.ffprobeExecutableSha256 ||
      firstVersion(ffmpegVersion.stdout, "ffmpeg") !== declaration.format.requiredFfmpegVersion ||
      firstVersion(ffprobeVersion.stdout, "ffprobe") !== declaration.format.requiredFfprobeVersion) {
    throw new Error("Stadium dynamics media toolchain does not match its declaration")
  }
  return { ffmpeg: ffmpegPath, ffprobe: ffprobePath, ffmpegHash, ffprobeHash }
}

/** Verifies the upstream manifest snapshot and every exact declared Stadium input. */
export async function verifySignatureSoundStadiumUpstream({
  declaration, plan, inputRoot,
}) {
  const manifestPath = resolveSafeChild(inputRoot, declaration.upstream.manifestRelativePath)
  if ((await hashFile(manifestPath)) !== declaration.upstream.manifestSha256) {
    throw new Error("Stadium dynamics upstream manifest checksum mismatch")
  }
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"))
  if (manifest.declarationSha256 !== declaration.upstream.declarationSha256 ||
      !Array.isArray(manifest.outputs)) {
    throw new Error("Stadium dynamics upstream manifest identity is invalid")
  }
  const bySource = new Map(manifest.outputs
    .filter(({ batchId }) => batchId === declaration.batchId)
    .map((output) => [output.sourceId, output]))
  if (bySource.size !== plan.outputs.length) throw new Error("Stadium dynamics upstream pool is incomplete")
  for (const output of plan.outputs) {
    const upstream = bySource.get(output.sourceId)
    if (!upstream || upstream.outputIdentity !== output.upstreamOutputIdentity ||
        upstream.outputRelativePath !== output.upstreamRelativePath ||
        upstream.outputMeasurement?.outputSha256 !== output.upstreamSha256 ||
        upstream.outputMeasurement?.byteSize !== output.upstreamByteSize) {
      throw new Error(`Stadium dynamics upstream identity drifted for ${output.sourceId}`)
    }
    await verifySignatureSoundStadiumInput(output, inputRoot)
  }
  return manifest
}

/** Checks physical upstream bytes before every media invocation. */
export async function verifySignatureSoundStadiumInput(planOutput, inputRoot) {
  const inputPath = resolveSafeChild(inputRoot, planOutput.upstreamRelativePath)
  const inputStat = await stat(inputPath)
  if (!inputStat.isFile() || inputStat.size !== planOutput.upstreamByteSize ||
      await hashFile(inputPath) !== planOutput.upstreamSha256) {
    throw new Error(`Stadium dynamics input bytes drifted for ${planOutput.sourceId}`)
  }
  return inputPath
}

/** Measures format, integrated loudness, loudness range, and true peak. */
export async function inspectSignatureSoundStadiumAudio({
  filePath, ffmpegCommand, ffprobeCommand, runCommand = runProcess,
}) {
  const probeResult = await runCommand(ffprobeCommand, [
    "-v", "error", "-show_entries",
    "format=duration:stream=codec_type,codec_name,sample_rate,channels,bits_per_sample,bits_per_raw_sample",
    "-of", "json", filePath,
  ])
  const probe = JSON.parse(probeResult.stdout)
  const stream = probe.streams?.find(({ codec_type }) => codec_type === "audio") ?? probe.streams?.[0]
  if (!stream) throw new Error("Stadium FFprobe did not return an audio stream")
  const measured = await runCommand(ffmpegCommand, [
    "-nostdin", "-hide_banner", "-loglevel", "info", "-i", filePath,
    "-map", "0:a:0", "-vn", "-af", "ebur128=peak=true", "-f", "null", "-",
  ])
  return {
    durationSeconds: positiveNumber(probe.format?.duration, "Stadium duration"),
    sampleRateHz: positiveInteger(stream.sample_rate, "Stadium sample rate"),
    channels: positiveInteger(stream.channels, "Stadium channels"),
    bitsPerSample: positiveInteger(stream.bits_per_raw_sample || stream.bits_per_sample, "Stadium bit depth"),
    codecName: requireString(stream.codec_name, "Stadium codec"),
    ...parseSignatureSoundStadiumEbur128(measured.stderr),
  }
}

/** Loads a complete existing output only when receipt and physical bytes agree. */
export async function loadSignatureSoundStadiumResumeReceipt({
  declaration, planOutput, outputRoot,
}) {
  const bundle = resolveSafeChild(outputRoot, planOutput.bundleRelativePath)
  const type = await pathType(bundle)
  if (type === null) return null
  if (type !== "directory") throw new Error(`Stadium output bundle is invalid: ${planOutput.sourceId}`)
  const receiptPath = join(bundle, RECEIPT_NAME)
  const audioPath = join(bundle, "audio.wav")
  const receipt = validateSignatureSoundStadiumDynamicsReceipt(
    JSON.parse(await readFile(receiptPath, "utf8")),
    { declaration, planOutput },
  )
  const audioStat = await stat(audioPath)
  if (!audioStat.isFile() || audioStat.size !== receipt.outputMeasurement.byteSize ||
      await hashFile(audioPath) !== receipt.outputMeasurement.outputSha256) {
    throw new Error(`Stadium resume bytes drifted for ${planOutput.sourceId}`)
  }
  return receipt
}

/** Renders one exact no-overwrite bundle and publishes it by directory rename. */
export async function renderSignatureSoundStadiumOutput({
  declaration,
  planOutput,
  inputRoot,
  outputRoot,
  mediaTools,
  runCommand = runProcess,
  inspectAudio = inspectSignatureSoundStadiumAudio,
  reverifyTools = verifySignatureSoundStadiumMediaTools,
}) {
  const existing = await loadSignatureSoundStadiumResumeReceipt({ declaration, planOutput, outputRoot })
  if (existing) return { state: "resumed", receipt: existing }
  const inputPath = await verifySignatureSoundStadiumInput(planOutput, inputRoot)
  await reverifyTools({
    declaration,
    ffmpeg: mediaTools.ffmpeg,
    ffprobe: mediaTools.ffprobe,
    runCommand,
  })
  const partial = await mkdtemp(join(outputRoot, ".stadium-partial-"))
  try {
    const measurementArgv = buildSignatureSoundStadiumMeasurementArgv({
      ffmpegCommand: mediaTools.ffmpeg,
      inputPath,
      declaration,
    })
    const compressorResult = await runCommand(measurementArgv[0], measurementArgv.slice(1))
    const compressorMeasurement = parseSignatureSoundStadiumEbur128(compressorResult.stderr)
    const matchingGainDb = calculateSignatureSoundStadiumMatchingGain({
      compressedIntegratedLoudnessLufs: compressorMeasurement.integratedLoudnessLufs,
      compressedTruePeakDbtp: compressorMeasurement.truePeakDbtp,
      targetIntegratedLoudnessLufs: declaration.recipe.targetIntegratedLoudnessLufs,
      truePeakCeilingDbtp: declaration.format.truePeakCeilingDbtp,
    })
    const audioPath = join(partial, "audio.wav")
    const renderArgv = buildSignatureSoundStadiumRenderArgv(planOutput, {
      ffmpegCommand: mediaTools.ffmpeg,
      inputPath,
      outputPath: audioPath,
      matchingGainDb,
      declaration,
    })
    await runCommand(renderArgv[0], renderArgv.slice(1))
    const outputMeasurement = {
      ...await inspectAudio({
        filePath: audioPath,
        ffmpegCommand: mediaTools.ffmpeg,
        ffprobeCommand: mediaTools.ffprobe,
        runCommand,
      }),
      outputSha256: await hashFile(audioPath),
      byteSize: (await stat(audioPath)).size,
    }
    const receipt = validateSignatureSoundStadiumDynamicsReceipt({
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
    }, { declaration, planOutput })
    await writeFile(join(partial, RECEIPT_NAME), `${JSON.stringify(receipt, null, 2)}\n`, { flag: "wx" })
    const finalBundle = resolveSafeChild(outputRoot, planOutput.bundleRelativePath)
    if (await pathType(finalBundle) !== null) throw new Error(`Stadium output already exists: ${planOutput.sourceId}`)
    await mkdir(dirname(finalBundle), { recursive: true })
    await rename(partial, finalBundle)
    return { state: "rendered", receipt }
  } catch (error) {
    await rm(partial, { recursive: true, force: true })
    throw error
  }
}

async function loadAllReceipts({ declaration, plan, outputRoot }) {
  const receipts = []
  for (const output of plan.outputs) {
    const receipt = await loadSignatureSoundStadiumResumeReceipt({ declaration, planOutput: output, outputRoot })
    if (!receipt) throw new Error(`Stadium dynamics output is missing ${output.sourceId}`)
    receipts.push(receipt)
  }
  return receipts
}

async function validateOrPublishManifest({ declaration, plan, outputRoot, publish }) {
  const manifestPath = join(outputRoot, MANIFEST_NAME)
  const receipts = await loadAllReceipts({ declaration, plan, outputRoot })
  const expected = createSignatureSoundStadiumDynamicsManifest(receipts, declaration)
  const manifestType = await pathType(manifestPath)
  if (manifestType === "file") {
    const existing = validateSignatureSoundStadiumDynamicsManifest(
      JSON.parse(await readFile(manifestPath, "utf8")),
      declaration,
    )
    if (JSON.stringify(existing) !== JSON.stringify(expected)) {
      throw new Error("Stadium dynamics manifest does not match its receipts")
    }
    return existing
  }
  if (manifestType !== null) throw new Error("Stadium dynamics manifest path is invalid")
  if (!publish) throw new Error("Stadium dynamics manifest is missing")
  await writeFile(manifestPath, `${JSON.stringify(expected, null, 2)}\n`, { flag: "wx" })
  return expected
}

/** Runs plan, no-overwrite render, or read-only validation. */
export async function main(argv = process.argv.slice(2)) {
  const options = parseSignatureSoundStadiumDynamicsCliArguments(argv)
  const declaration = validateSignatureSoundStadiumDynamicsDeclaration(JSON.parse(await readFile(
    join(repoRoot, "data/atmoshaper/signature-sound-stadium-dynamics-audition.json"),
    "utf8",
  )))
  const plan = planSignatureSoundStadiumDynamics(declaration)
  if (options.mode === "plan") {
    const result = { state: "planned", declarationSha256: declaration.declarationSha256, plan }
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    return result
  }
  const roots = await prepareSignatureSoundDerivedRoots({
    repoRoot,
    sourceRoot: options.inputRoot,
    outputRoot: options.outputRoot,
  })
  await verifySignatureSoundStadiumUpstream({
    declaration,
    plan,
    inputRoot: roots.sourceRoot,
  })
  const mediaTools = await verifySignatureSoundStadiumMediaTools({
    declaration,
    ffmpeg: options.ffmpeg,
    ffprobe: options.ffprobe,
  })
  let outputRoot = roots.outputRoot
  if (options.mode === "render") {
    await mkdir(outputRoot, { recursive: true })
    outputRoot = await realpath(outputRoot)
    for (const planOutput of plan.outputs) {
      await renderSignatureSoundStadiumOutput({
        declaration,
        planOutput,
        inputRoot: roots.sourceRoot,
        outputRoot,
        mediaTools,
      })
    }
  } else {
    outputRoot = await realpath(outputRoot)
  }
  const manifest = await validateOrPublishManifest({
    declaration,
    plan,
    outputRoot,
    publish: options.mode === "render",
  })
  const result = {
    state: options.mode === "render" ? "rendered-and-validated" : "validated",
    declarationSha256: declaration.declarationSha256,
    outputs: manifest.outputs.length,
  }
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  return result
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
      const result = {
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      }
      if (code === 0) resolveResult(result)
      else reject(new Error(`Stadium media command failed with exit code ${code}: ${result.stderr.trim()}`))
    })
  })
}

function firstVersion(stdout, executable) {
  const match = new RegExp(`^(${executable} version \\S+)`, "m").exec(String(stdout))
  if (!match) throw new Error(`Stadium ${executable} version output is invalid`)
  return match[1]
}

async function requireCanonicalFile(filePath, label) {
  const canonical = await realpath(requireAbsolute(filePath, label))
  if (!(await stat(canonical)).isFile()) throw new Error(`${label} must be a file`)
  return canonical
}

function resolveSafeChild(root, portablePath) {
  if (typeof portablePath !== "string" || portablePath.includes("\\") || portablePath.startsWith("/") ||
      portablePath.split("/").some((part) => !part || part === "." || part === "..")) {
    throw new Error("Stadium dynamics path must remain portable and relative")
  }
  const absolute = resolve(root, ...portablePath.split("/"))
  const relation = relative(resolve(root), absolute)
  if (!relation || relation.startsWith("..") || isAbsolute(relation)) {
    throw new Error("Stadium dynamics path escapes its root")
  }
  return absolute
}

async function pathType(filePath) {
  try {
    const value = await lstat(filePath)
    if (value.isSymbolicLink()) throw new Error("Stadium dynamics linked paths are forbidden")
    if (value.isFile()) return "file"
    if (value.isDirectory()) return "directory"
    return "other"
  } catch (error) {
    if (error?.code === "ENOENT") return null
    throw error
  }
}

async function hashFile(filePath) {
  const digest = createHash("sha256")
  for await (const chunk of createReadStream(filePath)) digest.update(chunk)
  return digest.digest("hex")
}

function requireAbsolute(value, label) {
  const normalized = requireString(value, label)
  if (!isAbsolute(normalized)) throw new Error(`${label} must be absolute`)
  return normalized
}

function requireString(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required`)
  return value
}

function positiveNumber(value, label) {
  const normalized = Number(value)
  if (!Number.isFinite(normalized) || normalized <= 0) throw new Error(`${label} must be positive`)
  return normalized
}

function positiveInteger(value, label) {
  const normalized = Number(value)
  if (!Number.isSafeInteger(normalized) || normalized <= 0) throw new Error(`${label} must be a positive integer`)
  return normalized
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`)
    process.exitCode = 1
  })
}
