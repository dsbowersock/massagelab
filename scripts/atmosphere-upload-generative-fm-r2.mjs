#!/usr/bin/env node

import fs from "node:fs/promises"
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

  console.log(JSON.stringify({
    bucket: env.bucket,
    endpoint: env.endpoint ?? (env.accountId ? endpointForAtmosphereR2Env(env) : null),
    publicBaseUrlConfigured: Boolean(env.publicBaseUrl),
    objectPrefixBase: DEFAULT_GENERATIVE_FM_OBJECT_PREFIX_BASE,
    cacheControl: env.cacheControl,
    metadataCacheControl: env.metadataCacheControl,
    uploadReady: missingForUpload.length === 0,
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

  const resolvedAudioRoot = path.resolve(options.audioRoot)
  const files = await collectFiles(resolvedAudioRoot)
  const mappingChartPath = findObservableStreamsVscoPianoMappingChartPath(files)
  if (!mappingChartPath) {
    throw new Error("Could not find VSCO upright piano MappingChart.txt in the supplied audio root.")
  }

  const mappingChartText = await fs.readFile(path.join(resolvedAudioRoot, mappingChartPath), "utf8")
  const licenseTextByPath = await readLicenseEvidenceTextByPath(resolvedAudioRoot, files)
  const uploadPlans = await createGenerativeFmFirstBatchR2UploadPlans({
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

  printPlans(uploadPlans)

  if (options.dryRun) {
    console.log("Dry run only. No R2 objects were uploaded.")
    return
  }

  const missingForUpload = missingAtmosphereR2UploadEnv(env)
  if (missingForUpload.length > 0) {
    throw new Error(`Cannot upload hosted atmosphere samples. Missing required environment variables: ${missingForUpload.join(", ")}`)
  }

  for (const uploadPlan of uploadPlans) {
    for (const asset of uploadPlan.sampleObjects) {
      const body = await fs.readFile(path.join(resolvedAudioRoot, asset.sourceRelativePath))
      await putAtmosphereObjectToR2(env, {
        objectKey: asset.objectKey,
        body,
        contentType: asset.contentType,
        cacheControl: asset.cacheControl,
      })
      console.log(`Uploaded ${asset.objectKey} (${body.byteLength} bytes).`)
    }

    for (const asset of uploadPlan.renderedSampleObjects) {
      await putAtmosphereObjectToR2(env, {
        objectKey: asset.objectKey,
        body: asset.body,
        contentType: asset.contentType,
        cacheControl: asset.cacheControl,
      })
      console.log(`Uploaded ${asset.objectKey} (${asset.body.byteLength} bytes).`)
    }

    for (const object of uploadPlan.metadataObjects) {
      await putAtmosphereObjectToR2(env, object)
      console.log(`Uploaded ${object.objectKey} (${object.body.length} bytes).`)
    }
  }
}

/**
 * @param {string[]} uploadArgs
 */
function parseUploadArgs(uploadArgs) {
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
      index += 1
      options.publicBaseUrl = uploadArgs[index]
      continue
    }

    if (arg.startsWith("--public-base-url=")) {
      options.publicBaseUrl = arg.slice("--public-base-url=".length)
      continue
    }

    if (arg === "--object-prefix-base") {
      index += 1
      options.objectPrefixBase = uploadArgs[index]
      continue
    }

    if (arg.startsWith("--object-prefix-base=")) {
      options.objectPrefixBase = arg.slice("--object-prefix-base=".length)
      continue
    }

    if (arg === "--piece") {
      index += 1
      const pieceId = uploadArgs[index]
      if (!pieceId) throw new Error("--piece requires a Generative.fm piece id.")
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

    if (!options.audioRoot || options.audioRoot === process.env.MASSAGELAB_AUDIO_SAMPLE_ROOT) {
      options.audioRoot = arg
      continue
    }

    throw new Error(`Unexpected positional argument: ${arg}`)
  }

  return options
}

/**
 * @param {Awaited<ReturnType<typeof createGenerativeFmFirstBatchR2UploadPlans>>} uploadPlans
 */
function printPlans(uploadPlans) {
  const totalObjects = uploadPlans.reduce((total, plan) => total + plan.objectCount, 0)
  const totalPayload = uploadPlans.reduce((total, plan) => total + plan.samplePayloadBytes, 0)

  console.log(`Generative.fm R2 upload plan: ${uploadPlans.length} pieces, ${totalObjects} objects`)
  console.log(`Approximate WAV payload: ${formatBytes(totalPayload)}`)

  for (const plan of uploadPlans) {
    console.log("")
    console.log(`${plan.title} (${plan.pieceId})`)
    console.log(`- Bucket: ${plan.bucket}`)
    console.log(`- Object prefix: ${plan.objectPrefix}`)
    console.log(`- Source samples: ${plan.sampleObjects.length}`)
    console.log(`- Rendered samples: ${plan.renderedSampleObjects.length}`)
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
  console.error("  npm run atmosphere:samples:generative:r2:check")
  console.error("  npm run atmosphere:samples:generative:r2:upload -- <audio-sample-root> [--dry-run] [--piece <piece-id>] [--public-base-url <url>] [--object-prefix-base <prefix>]")
}
