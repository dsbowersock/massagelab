#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { config } from "dotenv"
import {
  DEFAULT_GENERATIVE_FM_OBJECT_PREFIX_BASE,
  createGenerativeFmFirstBatchR2UploadPlans,
} from "../lib/atmosphere/generative-fm-first-batch-samples.js"
import { findObservableStreamsVscoPianoMappingChartPath } from "../lib/atmosphere/sample-intake.js"
import {
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
    objectPrefixBase: DEFAULT_GENERATIVE_FM_OBJECT_PREFIX_BASE,
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

  if (!options.dryRun) {
    const missingForUpload = missingAtmosphereR2UploadEnv(env)
    if (missingForUpload.length > 0) {
      throw new Error(`Cannot upload hosted atmosphere samples. Missing required environment variables: ${missingForUpload.join(", ")}`)
    }
  }

  const resolvedAudioRoot = path.resolve(options.audioRoot)
  const files = await collectFiles(resolvedAudioRoot)
  const mappingChartPath = findObservableStreamsVscoPianoMappingChartPath(files)
  if (!mappingChartPath) {
    throw new Error("Could not find VSCO upright piano MappingChart.txt in the supplied audio root.")
  }

  const mappingChartText = await fs.readFile(path.join(resolvedAudioRoot, mappingChartPath), "utf8")
  const licenseTextByPath = await readLicenseEvidenceTextByPath(resolvedAudioRoot, files)
  const wavUploadPlans = await createGenerativeFmFirstBatchR2UploadPlans({
    rootPath: resolvedAudioRoot,
    files,
    licenseTextByPath,
    vscoPianoMappingChartText: mappingChartText,
    bucket: env.bucket,
    publicBaseUrl: env.publicBaseUrl,
    objectPrefixBase: options.objectPrefixBase,
    cacheControl: env.cacheControl,
    metadataCacheControl: env.metadataCacheControl,
    pieceIds: options.pieceIds,
  })
  const webAudioPlans = []

  for (const wavUploadPlan of wavUploadPlans) {
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

    webAudioPlans.push({
      ...webAudioPlan,
      pieceId: wavUploadPlan.pieceId,
      title: wavUploadPlan.title,
    })
  }

  printPlans(webAudioPlans)

  if (options.dryRun) {
    console.log("Dry run only. No R2 objects were uploaded.")
    return
  }

  for (const webAudioPlan of webAudioPlans) {
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
}

/**
 * Creates encoded Opus descriptors for every WAV payload in an existing hosted
 * Generative.fm piece plan. Source objects are read from disk; rendered objects
 * reuse the in-memory WAV buffers already generated by the piece planner.
 *
 * @param {{
 *   wavUploadPlan: Awaited<ReturnType<typeof createGenerativeFmFirstBatchR2UploadPlans>>[number],
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
  let positionalAudioRootSeen = false

  /**
   * @param {string} flag
   * @param {number} currentIndex
   */
  const requireOptionValue = (flag, currentIndex) => {
    const value = uploadArgs[currentIndex + 1]
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${flag}`)
    }
    return value
  }

  const options = {
    audioRoot: process.env.MASSAGELAB_AUDIO_SAMPLE_ROOT,
    dryRun: false,
    publicBaseUrl: undefined,
    objectPrefixBase: DEFAULT_GENERATIVE_FM_OBJECT_PREFIX_BASE,
    pieceIds: [],
  }

  for (let index = 0; index < uploadArgs.length; index += 1) {
    const arg = uploadArgs[index]

    if (arg === "--dry-run") {
      options.dryRun = true
      continue
    }

    if (arg === "--public-base-url") {
      options.publicBaseUrl = requireOptionValue("--public-base-url", index)
      index += 1
      continue
    }

    if (arg.startsWith("--public-base-url=")) {
      options.publicBaseUrl = arg.slice("--public-base-url=".length)
      continue
    }

    if (arg === "--object-prefix-base") {
      options.objectPrefixBase = requireOptionValue("--object-prefix-base", index)
      index += 1
      continue
    }

    if (arg.startsWith("--object-prefix-base=")) {
      options.objectPrefixBase = arg.slice("--object-prefix-base=".length)
      continue
    }

    if (arg === "--piece") {
      const pieceId = requireOptionValue("--piece", index)
      index += 1
      options.pieceIds.push(pieceId)
      continue
    }

    if (arg.startsWith("--piece=")) {
      options.pieceIds.push(arg.slice("--piece=".length))
      continue
    }

    if (arg.startsWith("--")) {
      throw new Error(`Unknown option: ${arg}`)
    }

    if (!positionalAudioRootSeen) {
      options.audioRoot = arg
      positionalAudioRootSeen = true
      continue
    }

    throw new Error(`Unexpected positional argument: ${arg}`)
  }

  return options
}

/**
 * @param {Array<ReturnType<typeof createWebAudioFormatPlan> & { pieceId: string, title: string }>} webAudioPlans
 */
function printPlans(webAudioPlans) {
  const totalObjects = webAudioPlans.reduce((total, plan) => total + plan.objectCount, 0)
  const sourcePayload = webAudioPlans.reduce((total, plan) => total + plan.sourcePayloadBytes, 0)
  const encodedPayload = webAudioPlans.reduce((total, plan) => total + plan.encodedPayloadBytes, 0)
  const compressionRatio = sourcePayload > 0 ? Number((encodedPayload / sourcePayload).toFixed(4)) : null

  console.log(`Generative.fm ${OPUS_WEB_AUDIO_FORMAT.id} R2 upload plan: ${webAudioPlans.length} pieces, ${totalObjects} objects`)
  console.log(`WAV source payload: ${formatBytes(sourcePayload)}`)
  console.log(`Encoded payload: ${formatBytes(encodedPayload)}`)
  console.log(`Compression ratio: ${compressionRatio}`)

  for (const plan of webAudioPlans) {
    console.log("")
    console.log(`${plan.title} (${plan.pieceId})`)
    console.log(`- Object prefix: ${plan.objectPrefix}`)
    console.log(`- Encoded samples: ${plan.variantSampleObjects.length}`)
    console.log(`- WAV source payload: ${formatBytes(plan.sourcePayloadBytes)}`)
    console.log(`- Encoded payload: ${formatBytes(plan.encodedPayloadBytes)}`)
    console.log(`- Compression ratio: ${plan.manifest.compressionRatio}`)
    console.log(`- Sample index: ${plan.sampleIndexPublicUrl}`)
    console.log(`- Manifest: ${plan.manifestPublicUrl}`)
  }
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
      relativePath: normalizePortablePath(path.relative(rootPath, absolutePath)),
      sizeBytes: stats.size,
    })
  }
}

/**
 * @param {string} rootPath
 * @param {Array<{ relativePath: string }>} files
 */
async function readLicenseEvidenceTextByPath(rootPath, files) {
  const licenseTextByPath = {}
  const evidenceFiles = files.filter((file) => {
    const normalized = file.relativePath.toLowerCase()
    const fileName = path.basename(normalized)
    return normalized.endsWith("/license") ||
      normalized.endsWith("/readme.md") ||
      (fileName.startsWith("license") && fileName.endsWith(".txt")) ||
      (fileName.startsWith("readme") && fileName.endsWith(".txt"))
  })

  for (const file of evidenceFiles) {
    try {
      licenseTextByPath[file.relativePath] = await fs.readFile(path.join(rootPath, file.relativePath), "utf8")
    } catch {
      // Coverage status reports absent or unreadable evidence.
    }
  }

  return licenseTextByPath
}

/**
 * @param {string} filePath
 */
function normalizePortablePath(filePath) {
  return filePath.replace(/\\/g, "/")
}

function printUsage() {
  console.error("Usage:")
  console.error("  npm run atmosphere:samples:generative:web-audio:r2:check")
  console.error("  npm run atmosphere:samples:generative:web-audio:r2:upload -- <audio-sample-root> [--dry-run] [--piece <piece-id>] [--public-base-url <url>] [--object-prefix-base <prefix>]")
}
