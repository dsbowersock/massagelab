#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { config } from "dotenv"
import {
  createObservableStreamsVscoAssetPlan,
  findObservableStreamsVscoPianoMappingChartPath,
} from "../lib/atmosphere/sample-intake.js"
import { createObservableStreamsRenderedSampleObjects } from "../lib/atmosphere/prerendered-samples.js"
import {
  createObservableStreamsR2UploadPlan,
  endpointForAtmosphereR2Env,
  missingAtmosphereR2UploadEnv,
  putAtmosphereObjectToR2,
  readAtmospherePublicMediaR2Env,
} from "../lib/atmosphere/r2-sample-hosting.js"
import {
  OPUS_WEB_AUDIO_FORMAT,
  createWebAudioFormatPlan,
  createWebAudioVariantSampleObject,
} from "../lib/atmosphere/web-audio-format-pilot.js"

config({ path: ".env.local" })
config()

const args = process.argv.slice(2)
const command = args.shift()

try {
  if (command === "check") {
    runCheck()
  } else if (command === "upload") {
    await runUpload(args)
  } else {
    printUsage()
    process.exitCode = 1
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}

function runCheck() {
  const env = readAtmospherePublicMediaR2Env()
  const missingForUpload = missingAtmosphereR2UploadEnv(env)
  const ffmpeg = spawnSync("ffmpeg", ["-version"], { encoding: "utf8" })

  console.log(JSON.stringify({
    bucket: env.bucket,
    endpoint: env.endpoint ?? (env.accountId ? endpointForAtmosphereR2Env(env) : null),
    publicBaseUrlConfigured: Boolean(env.publicBaseUrl),
    objectPrefix: env.objectPrefix,
    format: OPUS_WEB_AUDIO_FORMAT.id,
    ffmpegAvailable: ffmpeg.status === 0,
    uploadReady: missingForUpload.length === 0 && ffmpeg.status === 0,
    missingForUpload,
  }, null, 2))
}

/**
 * @param {string[]} uploadArgs
 */
async function runUpload(uploadArgs) {
  const options = parseUploadArgs(uploadArgs)
  const baseEnv = readAtmospherePublicMediaR2Env()
  const env = {
    ...baseEnv,
    publicBaseUrl: options.publicBaseUrl ?? baseEnv.publicBaseUrl,
    objectPrefix: options.objectPrefix ?? baseEnv.objectPrefix,
  }

  if (!options.audioRoot) {
    printUsage()
    throw new Error("Missing audio sample root.")
  }

  if (!env.publicBaseUrl) {
    throw new Error(
      "MASSAGELAB_PUBLIC_MEDIA_PUBLIC_BASE_URL or --public-base-url is required, including for dry runs.",
    )
  }

  const resolvedAudioRoot = path.resolve(options.audioRoot)
  const files = await collectFiles(resolvedAudioRoot)
  const mappingChartPath = findObservableStreamsVscoPianoMappingChartPath(files)
  if (!mappingChartPath) {
    throw new Error("Could not find VSCO upright piano MappingChart.txt in the supplied audio root.")
  }

  const mappingChartText = await fs.readFile(path.join(resolvedAudioRoot, mappingChartPath), "utf8")
  const assetPlan = createObservableStreamsVscoAssetPlan({
    rootPath: resolvedAudioRoot,
    files,
    vscoPianoMappingChartText: mappingChartText,
  })
  if (assetPlan.missingNotes.length > 0) {
    const missing = assetPlan.missingNotes
      .map((note) => `- ${note.instrumentName} ${note.noteName} dynamic ${note.dynamicLayer}`)
      .join("\n")
    throw new Error(`Missing curated Observable Streams source notes:\n${missing}`)
  }

  const renderedSampleObjects = await createObservableStreamsRenderedSampleObjects({
    assetPlan,
    audioRoot: resolvedAudioRoot,
    publicBaseUrl: env.publicBaseUrl,
    objectPrefix: env.objectPrefix,
    cacheControl: env.cacheControl,
  })
  const wavUploadPlan = createObservableStreamsR2UploadPlan({
    assetPlan,
    renderedSampleObjects,
    bucket: env.bucket,
    publicBaseUrl: env.publicBaseUrl,
    objectPrefix: env.objectPrefix,
    cacheControl: env.cacheControl,
    metadataCacheControl: env.metadataCacheControl,
  })
  const variantSampleObjects = await createOpusVariantSampleObjects({
    wavUploadPlan,
    resolvedAudioRoot,
    publicBaseUrl: env.publicBaseUrl,
  })
  const webAudioPlan = createWebAudioFormatPlan({
    objectPrefix: wavUploadPlan.objectPrefix,
    publicBaseUrl: env.publicBaseUrl,
    sourceSampleIndexObjectKey: wavUploadPlan.sampleIndexObjectKey,
    sourceManifestObjectKey: wavUploadPlan.manifestObjectKey,
    sourcePayloadBytes: wavUploadPlan.samplePayloadBytes,
    variantSampleObjects,
    metadataCacheControl: env.metadataCacheControl,
  })

  printPlan(webAudioPlan)

  if (options.dryRun) {
    console.log("Dry run only. No R2 objects were uploaded.")
    return
  }

  const missingForUpload = missingAtmosphereR2UploadEnv(env)
  if (missingForUpload.length > 0) {
    throw new Error(`Cannot upload hosted atmosphere samples. Missing required environment variables: ${missingForUpload.join(", ")}`)
  }

  for (const asset of webAudioPlan.variantSampleObjects) {
    await putAtmosphereObjectToR2(env, {
      objectKey: asset.objectKey,
      body: asset.body,
      contentType: asset.contentType,
      cacheControl: env.cacheControl,
    })
    console.log(`Uploaded ${asset.objectKey} (${asset.body.byteLength} bytes).`)
  }

  for (const object of webAudioPlan.metadataObjects) {
    await putAtmosphereObjectToR2(env, object)
    console.log(`Uploaded ${object.objectKey} (${object.body.length} bytes).`)
  }
}

/**
 * @param {{
 *   wavUploadPlan: ReturnType<typeof createObservableStreamsR2UploadPlan>,
 *   resolvedAudioRoot: string,
 *   publicBaseUrl: string,
 * }} params
 */
async function createOpusVariantSampleObjects({ wavUploadPlan, resolvedAudioRoot, publicBaseUrl }) {
  const variantSampleObjects = []

  for (const sourceObject of wavUploadPlan.sampleObjects) {
    const wavBody = await fs.readFile(path.join(resolvedAudioRoot, sourceObject.sourceRelativePath))
    const encodedBody = await encodeWavToOpus(wavBody)
    variantSampleObjects.push(createWebAudioVariantSampleObject({
      sourceObject,
      objectPrefix: wavUploadPlan.objectPrefix,
      publicBaseUrl,
      encodedBody,
    }))
  }

  for (const sourceObject of wavUploadPlan.renderedSampleObjects) {
    const encodedBody = await encodeWavToOpus(sourceObject.body)
    variantSampleObjects.push(createWebAudioVariantSampleObject({
      sourceObject,
      objectPrefix: wavUploadPlan.objectPrefix,
      publicBaseUrl,
      encodedBody,
    }))
  }

  return variantSampleObjects
}

/**
 * @param {string | Uint8Array} wavBody
 */
async function encodeWavToOpus(wavBody) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "massagelab-opus-"))
  const inputPath = path.join(tempDir, "input.wav")
  const outputPath = path.join(tempDir, "output.ogg")

  try {
    await fs.writeFile(inputPath, wavBody)
    await runFfmpeg([
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-i",
      inputPath,
      ...OPUS_WEB_AUDIO_FORMAT.ffmpegOutputArgs,
      outputPath,
    ])
    return await fs.readFile(outputPath)
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true })
  }
}

/**
 * @param {string[]} ffmpegArgs
 */
function runFfmpeg(ffmpegArgs) {
  return new Promise((resolve, reject) => {
    const child = spawn("ffmpeg", ffmpegArgs, { stdio: ["ignore", "ignore", "pipe"] })
    const stderr = []

    child.stderr.on("data", (chunk) => {
      stderr.push(chunk)
    })
    child.on("error", reject)
    child.on("close", (code) => {
      if (code === 0) {
        resolve()
        return
      }

      reject(new Error(`ffmpeg failed with exit code ${code}: ${Buffer.concat(stderr).toString("utf8").trim()}`))
    })
  })
}

/**
 * @param {string[]} uploadArgs
 */
function parseUploadArgs(uploadArgs) {
  const options = {
    audioRoot: process.env.MASSAGELAB_AUDIO_SAMPLE_ROOT,
    dryRun: false,
    publicBaseUrl: undefined,
    objectPrefix: undefined,
  }

  for (let index = 0; index < uploadArgs.length; index += 1) {
    const arg = uploadArgs[index]

    if (arg === "--dry-run") {
      options.dryRun = true
      continue
    }

    if (arg === "--public-base-url") {
      index += 1
      options.publicBaseUrl = uploadArgs[index]
      continue
    }

    if (arg.startsWith("--public-base-url=")) {
      options.publicBaseUrl = arg.slice("--public-base-url=".length)
      continue
    }

    if (arg === "--object-prefix") {
      index += 1
      options.objectPrefix = uploadArgs[index]
      continue
    }

    if (arg.startsWith("--object-prefix=")) {
      options.objectPrefix = arg.slice("--object-prefix=".length)
      continue
    }

    if (arg.startsWith("--")) {
      throw new Error(`Unknown option: ${arg}`)
    }

    if (!options.audioRoot || options.audioRoot === process.env.MASSAGELAB_AUDIO_SAMPLE_ROOT) {
      options.audioRoot = arg
      continue
    }

    throw new Error(`Unexpected positional argument: ${arg}`)
  }

  return options
}

/**
 * @param {ReturnType<typeof createWebAudioFormatPlan>} webAudioPlan
 */
function printPlan(webAudioPlan) {
  console.log(`Observable Streams ${webAudioPlan.format.id} R2 upload plan: ${webAudioPlan.objectCount} objects`)
  console.log(`Object prefix: ${webAudioPlan.objectPrefix}`)
  console.log(`WAV source payload: ${formatBytes(webAudioPlan.sourcePayloadBytes)}`)
  console.log(`Encoded payload: ${formatBytes(webAudioPlan.encodedPayloadBytes)}`)
  console.log(`Compression ratio: ${webAudioPlan.manifest.compressionRatio}`)
  console.log(`Sample index: ${webAudioPlan.sampleIndexPublicUrl}`)
  console.log(`Manifest: ${webAudioPlan.manifestPublicUrl}`)
}

/**
 * @param {number} bytes
 */
function formatBytes(bytes) {
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

/**
 * @param {string} rootPath
 * @returns {Promise<Array<{ relativePath: string, sizeBytes: number }>>}
 */
async function collectFiles(rootPath) {
  const files = []
  await walkDirectory(rootPath, rootPath, files)
  return files
}

/**
 * @param {string} rootPath
 * @param {string} currentPath
 * @param {Array<{ relativePath: string, sizeBytes: number }>} files
 */
async function walkDirectory(rootPath, currentPath, files) {
  const directoryEntries = await fs.readdir(currentPath, { withFileTypes: true })

  for (const entry of directoryEntries) {
    const absolutePath = path.join(currentPath, entry.name)

    if (entry.isDirectory()) {
      await walkDirectory(rootPath, absolutePath, files)
      continue
    }

    if (!entry.isFile()) {
      continue
    }

    const stats = await fs.stat(absolutePath)
    files.push({
      relativePath: path.relative(rootPath, absolutePath).replace(/\\/g, "/"),
      sizeBytes: stats.size,
    })
  }
}

function printUsage() {
  console.error("Usage:")
  console.error("  npm run atmosphere:samples:web-audio:r2:check")
  console.error("  npm run atmosphere:samples:web-audio:r2:upload -- <audio-sample-root> [--dry-run] [--public-base-url <url>] [--object-prefix <prefix>]")
}
