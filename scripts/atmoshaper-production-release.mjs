#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process"
import { createHash } from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"
import { config } from "dotenv"

import {
  ATMOSHAPER_PRODUCTION_RELEASE_PREFIX,
  atmoShaperProductionAudioObjectKey,
  atmoShaperProductionCatalogObjectKey,
  buildAtmoShaperProductionCatalog,
  collectUniqueAtmoShaperProductionPayloads,
  loadApprovedAtmoShaperProductionOwners,
  verifyAtmoShaperProductionPayloads,
} from "../lib/atmoshaper/production-release-builder.js"
import {
  DEFAULT_ATMOSPHERE_R2_CACHE_CONTROL,
  DEFAULT_ATMOSPHERE_R2_METADATA_CACHE_CONTROL,
  endpointForAtmosphereR2Env,
  missingAtmosphereR2UploadEnv,
  publicUrlForR2Object,
  putAtmosphereObjectToR2,
  readAtmospherePublicMediaR2Env,
} from "../lib/atmosphere/r2-sample-hosting.js"
import { WEB_AUDIO_SIDECAR_FORMATS } from "../lib/atmosphere/web-audio-format-pilot.js"

config({ path: ".env.local" })
const gitCommonDirectory = spawnSync("git", ["rev-parse", "--git-common-dir"], { encoding: "utf8" })
  .stdout?.trim()
if (gitCommonDirectory) {
  const commonDirectory = path.resolve(gitCommonDirectory)
  config({ path: path.join(path.dirname(commonDirectory), ".env.local") })
}
config()

const DEFAULT_SOURCE_ROOT = "C:/Users/derri/code/audio/Signature Samples"
const DEFAULT_DERIVED_ROOT = "C:/Users/derri/code/audio/AtmoShaper Signature Derived"
const DEFAULT_PUBLIC_BASE_URL = "https://media.massagelab.app"
const DEFAULT_CATALOG_OUTPUT = "data/atmoshaper/production-audio-catalog.json"
const DEFAULT_FFMPEG_PATH = "C:/Users/derri/AppData/Local/Temp/atmoshaper-ffmpeg-9.0-20260825/ffmpeg-9.0-full_build/bin/ffmpeg.exe"
const DEFAULT_FFPROBE_PATH = "C:/Users/derri/AppData/Local/Temp/atmoshaper-ffmpeg-9.0-20260825/ffmpeg-9.0-full_build/bin/ffprobe.exe"
const EXPECTED_FFMPEG_SHA256 = "05f4251bce9293c2ab492cb17ca7724a0ffd0d06c881ba2ee83b82a89c2fc740"
const EXPECTED_FFPROBE_SHA256 = "51e0780cd881f83749b029ed716cbb841c2eac6289f418050f2f2961b158896b"
const STAGE_MANIFEST_NAME = "release-stage.json"
const SOURCE_CONTENT_TYPES = Object.freeze({
  ".wav": "audio/wav",
  ".mp3": "audio/mpeg",
  ".aif": "audio/aiff",
  ".aiff": "audio/aiff",
})

const args = process.argv.slice(2)
const command = args.shift()

try {
  if (command === "check") await runCheck(parseOptions(args))
  else if (command === "plan") await runPlan(parseOptions(args))
  else if (command === "stage") await runStage(parseOptions(args))
  else if (command === "upload") await runUpload(parseOptions(args))
  else if (command === "verify") await runVerify(parseOptions(args))
  else {
    printUsage()
    process.exitCode = 1
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
}

async function runCheck(options) {
  const base = readAtmospherePublicMediaR2Env()
  const env = { ...base, publicBaseUrl: options.publicBaseUrl ?? base.publicBaseUrl ?? DEFAULT_PUBLIC_BASE_URL }
  const toolchain = await inspectFfmpegToolchain(options)
  const missingForUpload = missingAtmosphereR2UploadEnv(env)
  console.log(JSON.stringify({
    bucket: env.bucket,
    endpoint: env.endpoint ?? (env.accountId ? endpointForAtmosphereR2Env(env) : null),
    publicBaseUrl: env.publicBaseUrl,
    objectPrefix: ATMOSHAPER_PRODUCTION_RELEASE_PREFIX,
    sourceRoot: path.resolve(options.sourceRoot),
    derivedRoot: path.resolve(options.derivedRoot),
    ffmpegPath: options.ffmpegPath,
    ffprobePath: options.ffprobePath,
    ffmpegAvailable: toolchain.ffmpegAvailable,
    ffprobeAvailable: toolchain.ffprobeAvailable,
    approvedToolchain: toolchain.approvedToolchain,
    uploadReady: missingForUpload.length === 0 && toolchain.approvedToolchain,
    missingForUpload,
  }, null, 2))
}

async function runPlan(options) {
  const owners = await loadOwners(options)
  const payloads = collectUniqueAtmoShaperProductionPayloads(owners.concepts)
  console.log(JSON.stringify({
    conceptCount: owners.concepts.length,
    sourceReferenceCount: owners.concepts.reduce((count, concept) => count + concept.sources.length, 0),
    uniquePayloadCount: payloads.length,
    sourcePayloadBytes: payloads.reduce((count, payload) => count + payload.payloadByteSize, 0),
    sourcePayloadGiB: formatGiB(payloads.reduce((count, payload) => count + payload.payloadByteSize, 0)),
    browserFormatCount: WEB_AUDIO_SIDECAR_FORMATS.length,
    plannedAudioObjectCount: payloads.length * (WEB_AUDIO_SIDECAR_FORMATS.length + 1),
    conceptLabels: owners.concepts.map(({ batchId, label }) => ({ batchId, label })),
  }, null, 2))
}

async function runStage(options) {
  if (!options.stagingRoot) throw new Error("--staging-root is required for stage")
  await requireApprovedFfmpegToolchain(options)
  const owners = await loadOwners(options)
  const payloads = await verifyAtmoShaperProductionPayloads(owners.concepts)
  const stagingRoot = path.resolve(options.stagingRoot)
  await fs.mkdir(stagingRoot, { recursive: true })
  console.log(`Verified ${payloads.length} exact reviewed payloads. Encoding browser renditions…`)
  const renditionRows = await mapConcurrent(payloads, options.concurrency, async (payload, index) => {
    const row = await stagePayload({
      payload,
      stagingRoot,
      publicBaseUrl: options.publicBaseUrl,
      ffmpegPath: options.ffmpegPath,
      ffprobePath: options.ffprobePath,
    })
    console.log(`[${index + 1}/${payloads.length}] ${payload.payloadSha256} · ${formatMiB(payload.payloadByteSize)}`)
    return row
  })
  const renditionsByPayloadSha256 = new Map(renditionRows.map(({ payloadSha256, formats }) => (
    [payloadSha256, formats]
  )))
  const catalog = buildAtmoShaperProductionCatalog({
    concepts: owners.concepts,
    publishedBaseUrl: options.publicBaseUrl,
    renditionsByPayloadSha256,
  })
  const catalogObjectKey = atmoShaperProductionCatalogObjectKey(catalog.catalogRevision)
  const catalogBody = `${JSON.stringify(catalog, null, 2)}\n`
  const catalogBytes = Buffer.from(catalogBody)
  const stageManifest = {
    version: 1,
    releaseKind: "atmoshaper-production-r2-stage",
    catalogRevision: catalog.catalogRevision,
    sourceRoot: owners.sourceRoot,
    derivedRoot: owners.derivedRoot,
    publicBaseUrl: options.publicBaseUrl,
    bucket: "massagelab-public-media",
    objectPrefix: ATMOSHAPER_PRODUCTION_RELEASE_PREFIX,
    summary: {
      conceptCount: catalog.summary.conceptCount,
      sourceReferenceCount: catalog.summary.sourceReferenceCount,
      uniquePayloadCount: catalog.summary.uniquePayloadCount,
      audioObjectCount: renditionRows.reduce((count, row) => count + row.uploadObjects.length, 0),
      sourcePayloadBytes: payloads.reduce((count, payload) => count + payload.payloadByteSize, 0),
      stagedPayloadBytes: renditionRows.reduce(
        (count, row) => count + row.uploadObjects.reduce((subtotal, object) => subtotal + object.byteSize, 0),
        0,
      ),
    },
    audioObjects: renditionRows.flatMap(({ uploadObjects }) => uploadObjects),
    catalogObject: {
      kind: "catalog",
      objectKey: catalogObjectKey,
      publicUrl: publicUrlForR2Object(options.publicBaseUrl, catalogObjectKey),
      localPath: path.join(stagingRoot, "catalog.json"),
      contentType: "application/json; charset=utf-8",
      cacheControl: DEFAULT_ATMOSPHERE_R2_METADATA_CACHE_CONTROL,
      sha256: sha256(catalogBytes),
      byteSize: catalogBytes.byteLength,
    },
  }
  await fs.writeFile(stageManifest.catalogObject.localPath, catalogBytes)
  await fs.writeFile(path.join(stagingRoot, STAGE_MANIFEST_NAME), `${JSON.stringify(stageManifest, null, 2)}\n`)
  await fs.writeFile(path.resolve(options.catalogOutput), catalogBody)
  console.log(JSON.stringify({
    catalogRevision: catalog.catalogRevision,
    catalogOutput: path.resolve(options.catalogOutput),
    stageManifest: path.join(stagingRoot, STAGE_MANIFEST_NAME),
    ...stageManifest.summary,
    sourcePayloadGiB: formatGiB(stageManifest.summary.sourcePayloadBytes),
    totalUploadGiB: formatGiB(stageManifest.summary.stagedPayloadBytes + catalogBytes.byteLength),
  }, null, 2))
}

async function runUpload(options) {
  const stage = await loadStage(options)
  const base = readAtmospherePublicMediaR2Env()
  const env = { ...base, publicBaseUrl: options.publicBaseUrl ?? base.publicBaseUrl ?? stage.publicBaseUrl }
  const missing = missingAtmosphereR2UploadEnv(env)
  if (missing.length > 0) throw new Error(`R2 upload is not configured: ${missing.join(", ")}`)
  if (env.bucket !== stage.bucket) throw new Error("R2 stage bucket differs from configured public-media bucket")
  const objects = [...stage.audioObjects]
  console.log(`Uploading or verifying ${objects.length} immutable audio objects…`)
  await mapConcurrent(objects, options.concurrency, async (object, index) => {
    const existing = await inspectPublicObject(object, { requireRange: false })
    if (existing.exists) {
      if (!existing.matches) throw new Error(`Published object conflicts with stage: ${object.objectKey}`)
      console.log(`[${index + 1}/${objects.length}] present ${object.objectKey}`)
      return
    }
    await putAtmosphereObjectToR2(env, {
      objectKey: object.objectKey,
      body: await fs.readFile(object.localPath),
      contentType: object.contentType,
      cacheControl: object.cacheControl,
    })
    console.log(`[${index + 1}/${objects.length}] uploaded ${object.objectKey}`)
  })
  await verifyObjects(objects, options.concurrency)
  const catalogObject = stage.catalogObject
  const existingCatalog = await inspectPublicObject(catalogObject, { requireRange: false, verifyBody: true })
  if (!existingCatalog.exists) {
    await putAtmosphereObjectToR2(env, {
      objectKey: catalogObject.objectKey,
      body: await fs.readFile(catalogObject.localPath),
      contentType: catalogObject.contentType,
      cacheControl: catalogObject.cacheControl,
    })
  } else if (!existingCatalog.matches) {
    throw new Error("Published AtmoShaper catalog conflicts with the staged revision")
  }
  const verifiedCatalog = await inspectPublicObject(catalogObject, { requireRange: false, verifyBody: true })
  if (!verifiedCatalog.matches) throw new Error("Published AtmoShaper catalog did not verify")
  console.log(`Published AtmoShaper catalog ${stage.catalogRevision}.`)
}

async function runVerify(options) {
  const stage = await loadStage(options)
  await verifyObjects(stage.audioObjects, options.concurrency)
  const catalog = await inspectPublicObject(stage.catalogObject, { requireRange: false, verifyBody: true })
  if (!catalog.matches) throw new Error("Published AtmoShaper catalog failed verification")
  console.log(JSON.stringify({
    catalogRevision: stage.catalogRevision,
    verifiedAudioObjects: stage.audioObjects.length,
    verifiedCatalogUrl: stage.catalogObject.publicUrl,
  }, null, 2))
}

async function loadOwners(options) {
  return loadApprovedAtmoShaperProductionOwners({
    sourceRoot: options.sourceRoot,
    derivedRoot: options.derivedRoot,
  })
}

async function stagePayload({ payload, stagingRoot, publicBaseUrl, ffmpegPath, ffprobePath }) {
  const payloadDirectory = path.join(stagingRoot, "audio", payload.payloadSha256)
  await fs.mkdir(payloadDirectory, { recursive: true })
  const durationSeconds = payload.durationSeconds ?? await probeDuration(payload.localPath, ffprobePath)
  const sourceExtension = normalizedSourceExtension(payload.localPath)
  const sourceObjectKey = atmoShaperProductionAudioObjectKey(payload.payloadSha256, `source${sourceExtension}`)
  const sourceFormat = {
    id: "source",
    publicUrl: publicUrlForR2Object(publicBaseUrl, sourceObjectKey),
    contentType: SOURCE_CONTENT_TYPES[sourceExtension],
    sha256: payload.payloadSha256,
    byteSize: payload.payloadByteSize,
    durationSeconds,
    objectKey: sourceObjectKey,
  }
  const sourceUpload = {
    kind: "source",
    objectKey: sourceObjectKey,
    publicUrl: sourceFormat.publicUrl,
    localPath: payload.localPath,
    contentType: sourceFormat.contentType,
    cacheControl: DEFAULT_ATMOSPHERE_R2_CACHE_CONTROL,
    sha256: sourceFormat.sha256,
    byteSize: sourceFormat.byteSize,
  }
  const encoded = []
  for (const format of WEB_AUDIO_SIDECAR_FORMATS) {
    const fileName = format.id === "opus" ? "opus.ogg" : format.id === "aac" ? "aac.m4a" : "mp3.mp3"
    const localPath = path.join(payloadDirectory, fileName)
    const temporaryPath = path.join(payloadDirectory, `.tmp-${fileName}`)
    await fs.rm(temporaryPath, { force: true })
    await runProcess(ffmpegPath, [
      "-hide_banner", "-loglevel", "error", "-y", "-nostdin",
      "-i", payload.localPath,
      "-map", "0:a:0",
      ...format.ffmpegOutputArgs,
      temporaryPath,
    ])
    await fs.rename(temporaryPath, localPath)
    const body = await fs.readFile(localPath)
    const objectKey = atmoShaperProductionAudioObjectKey(payload.payloadSha256, fileName)
    encoded.push({
      format: {
        id: format.id,
        publicUrl: publicUrlForR2Object(publicBaseUrl, objectKey),
        contentType: format.contentType,
        sha256: sha256(body),
        byteSize: body.byteLength,
        durationSeconds,
        objectKey,
      },
      upload: {
        kind: format.id,
        objectKey,
        publicUrl: publicUrlForR2Object(publicBaseUrl, objectKey),
        localPath,
        contentType: format.contentType,
        cacheControl: DEFAULT_ATMOSPHERE_R2_CACHE_CONTROL,
        sha256: sha256(body),
        byteSize: body.byteLength,
      },
    })
  }
  return {
    payloadSha256: payload.payloadSha256,
    formats: [...encoded.map(({ format }) => format), sourceFormat],
    uploadObjects: [...encoded.map(({ upload }) => upload), sourceUpload],
  }
}

async function verifyObjects(objects, concurrency) {
  console.log(`Verifying ${objects.length} public objects, including byte-range CORS…`)
  await mapConcurrent(objects, Math.max(2, concurrency * 2), async (object, index) => {
    const result = await inspectPublicObject(object, { requireRange: true })
    if (!result.matches) throw new Error(`Published object failed verification: ${object.objectKey}`)
    if ((index + 1) % 100 === 0 || index + 1 === objects.length) {
      console.log(`Verified ${index + 1}/${objects.length} objects.`)
    }
  })
}

async function inspectPublicObject(object, { requireRange, verifyBody = false }) {
  const head = await fetch(object.publicUrl, {
    method: "HEAD",
    headers: { Origin: "https://massagelab.app" },
    signal: AbortSignal.timeout(30_000),
  })
  if (head.status === 404) return { exists: false, matches: false }
  if (!head.ok) throw new Error(`Public object check failed: ${object.objectKey} HTTP ${head.status}`)
  const headerLength = head.headers.get("content-length")
  const lengthMatches = headerLength === null
    ? verifyBody
    : Number(headerLength) === object.byteSize
  const typeMatches = normalizeContentType(head.headers.get("content-type")) === normalizeContentType(object.contentType)
  if (!lengthMatches || !typeMatches) return { exists: true, matches: false }
  if (verifyBody) {
    const response = await fetch(object.publicUrl, {
      cache: "no-store",
      headers: { Origin: "https://massagelab.app" },
      signal: AbortSignal.timeout(30_000),
    })
    if (!response.ok) return { exists: true, matches: false }
    const body = Buffer.from(await response.arrayBuffer())
    const cors = response.headers.get("access-control-allow-origin")
    const corsMatches = cors === "*" || cors === "https://massagelab.app"
    return {
      exists: true,
      matches: body.byteLength === object.byteSize && sha256(body) === object.sha256 && corsMatches,
    }
  }
  if (requireRange) {
    const range = await fetch(object.publicUrl, {
      headers: { Origin: "https://massagelab.app", Range: "bytes=0-0" },
      signal: AbortSignal.timeout(30_000),
    })
    const cors = range.headers.get("access-control-allow-origin")
    const rangeMatches = range.status === 206 && range.headers.get("content-range")?.startsWith("bytes 0-0/")
    const corsMatches = cors === "*" || cors === "https://massagelab.app"
    return { exists: true, matches: Boolean(rangeMatches && corsMatches) }
  }
  return { exists: true, matches: true }
}

async function loadStage(options) {
  if (!options.stagingRoot) throw new Error("--staging-root is required")
  const manifestPath = path.join(path.resolve(options.stagingRoot), STAGE_MANIFEST_NAME)
  const stage = JSON.parse(await fs.readFile(manifestPath, "utf8"))
  if (stage.version !== 1 || stage.releaseKind !== "atmoshaper-production-r2-stage") {
    throw new Error("AtmoShaper production stage manifest is invalid")
  }
  return stage
}

async function probeDuration(filePath, ffprobePath) {
  const output = await runProcess(ffprobePath, [
    "-v", "error", "-select_streams", "a:0", "-show_entries", "format=duration", "-of", "json", filePath,
  ], { captureStdout: true })
  const parsed = JSON.parse(output)
  const duration = Number(parsed.format?.duration)
  if (!Number.isFinite(duration) || duration <= 0) throw new Error(`Could not measure duration: ${filePath}`)
  return duration
}

function runProcess(command, processArgs, { captureStdout = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, processArgs, { stdio: ["ignore", captureStdout ? "pipe" : "ignore", "pipe"] })
    const stdout = []
    const stderr = []
    child.stdout?.on("data", (chunk) => stdout.push(chunk))
    child.stderr.on("data", (chunk) => stderr.push(chunk))
    child.on("error", reject)
    child.on("close", (code) => {
      if (code === 0) resolve(Buffer.concat(stdout).toString("utf8"))
      else reject(new Error(`${command} failed (${code}): ${Buffer.concat(stderr).toString("utf8").trim()}`))
    })
  })
}

async function mapConcurrent(values, concurrency, mapper) {
  const output = new Array(values.length)
  let cursor = 0
  async function worker() {
    while (true) {
      const index = cursor
      cursor += 1
      if (index >= values.length) return
      output[index] = await mapper(values[index], index)
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker))
  return output
}

function parseOptions(rawArgs) {
  const options = {
    sourceRoot: DEFAULT_SOURCE_ROOT,
    derivedRoot: DEFAULT_DERIVED_ROOT,
    stagingRoot: undefined,
    catalogOutput: DEFAULT_CATALOG_OUTPUT,
    publicBaseUrl: DEFAULT_PUBLIC_BASE_URL,
    ffmpegPath: DEFAULT_FFMPEG_PATH,
    ffprobePath: DEFAULT_FFPROBE_PATH,
    concurrency: 4,
  }
  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index]
    const [flag, inline] = arg.split("=", 2)
    const value = inline ?? rawArgs[index + 1]
    if (["--source-root", "--derived-root", "--staging-root", "--catalog-output", "--public-base-url", "--ffmpeg-path", "--ffprobe-path", "--concurrency"].includes(flag)) {
      if (!inline) index += 1
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${flag}`)
      if (flag === "--source-root") options.sourceRoot = value
      else if (flag === "--derived-root") options.derivedRoot = value
      else if (flag === "--staging-root") options.stagingRoot = value
      else if (flag === "--catalog-output") options.catalogOutput = value
      else if (flag === "--public-base-url") options.publicBaseUrl = value.replace(/\/+$/, "")
      else if (flag === "--ffmpeg-path") options.ffmpegPath = value
      else if (flag === "--ffprobe-path") options.ffprobePath = value
      else {
        options.concurrency = Number(value)
        if (!Number.isInteger(options.concurrency) || options.concurrency < 1 || options.concurrency > 12) {
          throw new Error("--concurrency must be an integer from 1 through 12")
        }
      }
      continue
    }
    throw new Error(`Unknown AtmoShaper production option: ${arg}`)
  }
  return options
}

async function inspectFfmpegToolchain(options) {
  const ffmpegAvailable = spawnSync(options.ffmpegPath, ["-version"], { encoding: "utf8" }).status === 0
  const ffprobeAvailable = spawnSync(options.ffprobePath, ["-version"], { encoding: "utf8" }).status === 0
  if (!ffmpegAvailable || !ffprobeAvailable) {
    return { ffmpegAvailable, ffprobeAvailable, approvedToolchain: false }
  }
  const [ffmpegBytes, ffprobeBytes] = await Promise.all([
    fs.readFile(options.ffmpegPath),
    fs.readFile(options.ffprobePath),
  ])
  return {
    ffmpegAvailable,
    ffprobeAvailable,
    approvedToolchain:
      sha256(ffmpegBytes) === EXPECTED_FFMPEG_SHA256 &&
      sha256(ffprobeBytes) === EXPECTED_FFPROBE_SHA256,
  }
}

async function requireApprovedFfmpegToolchain(options) {
  const toolchain = await inspectFfmpegToolchain(options)
  if (!toolchain.approvedToolchain) {
    throw new Error("The exact approved FFmpeg 9.0 and FFprobe 9.0 executables are required")
  }
}

function normalizedSourceExtension(filePath) {
  const extension = path.extname(filePath).toLowerCase()
  if (!SOURCE_CONTENT_TYPES[extension]) throw new Error(`Unsupported reviewed source format: ${filePath}`)
  return extension
}

function normalizeContentType(value) {
  return value?.split(";", 1)[0].trim().toLowerCase() ?? ""
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex")
}

function formatMiB(bytes) {
  return `${(bytes / 2 ** 20).toFixed(1)} MiB`
}

function formatGiB(bytes) {
  return `${(bytes / 2 ** 30).toFixed(2)} GiB`
}

function printUsage() {
  console.error("Usage:")
  console.error("  npm run atmoshaper:production:check")
  console.error("  npm run atmoshaper:production:plan")
  console.error("  npm run atmoshaper:production:stage -- --staging-root <external-directory>")
  console.error("  npm run atmoshaper:production:upload -- --staging-root <external-directory>")
  console.error("  npm run atmoshaper:production:verify -- --staging-root <external-directory>")
}
