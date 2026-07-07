#!/usr/bin/env node

import fs from "node:fs/promises"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { config } from "dotenv"

import {
  endpointForAtmosphereR2Env,
  missingAtmosphereR2UploadEnv,
  publicUrlForR2Object,
  putAtmosphereObjectToR2,
  readAtmospherePublicMediaR2Env,
} from "../../lib/atmosphere/r2-sample-hosting.js"

config({ path: ".env.local" })
config()

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const defaultInputDir = path.join(repoRoot, "public/chimer/background-previews")
const defaultObjectPrefix = "chimer/background-previews"

const command = process.argv[2]
const args = process.argv.slice(3)

try {
  if (command === "check") {
    await runCheck(args)
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

async function runCheck(rawArgs) {
  const options = parseArgs(rawArgs)
  const env = r2EnvForOptions(options)
  const files = await collectPreviewFiles(options.inputDir)
  const missingForUpload = missingAtmosphereR2UploadEnv(env)

  console.log(JSON.stringify({
    bucket: env.bucket,
    endpoint: env.endpoint ?? (env.accountId ? endpointForAtmosphereR2Env(env) : null),
    publicBaseUrlConfigured: Boolean(env.publicBaseUrl),
    objectPrefix: env.objectPrefix,
    inputDir: options.inputDir,
    fileCount: files.length,
    totalBytes: files.reduce((total, file) => total + file.bytes, 0),
    uploadReady: missingForUpload.length === 0 && files.length > 0,
    missingForUpload,
  }, null, 2))
}

async function runUpload(rawArgs) {
  const options = parseArgs(rawArgs)
  const env = r2EnvForOptions(options)
  const files = await collectPreviewFiles(options.inputDir)
  const selectedFiles = options.limit > 0 ? files.slice(0, options.limit) : files
  const missingForUpload = missingAtmosphereR2UploadEnv(env)

  if (!selectedFiles.length) {
    throw new Error(`No Chimer preview media files found in ${options.inputDir}. Run npm run chimer:preview:render first.`)
  }

  if (!env.publicBaseUrl) {
    throw new Error("MASSAGELAB_PUBLIC_MEDIA_PUBLIC_BASE_URL or --public-base-url is required, including for dry runs.")
  }

  const objects = selectedFiles.map((file) => {
    const objectKey = `${env.objectPrefix}/${file.name}`
    return {
      objectKey,
      publicUrl: publicUrlForR2Object(env.publicBaseUrl, objectKey),
      contentType: contentTypeForFile(file.name),
      cacheControl: file.name === "index.json" ? env.metadataCacheControl : env.cacheControl,
      file,
    }
  })

  if (options.dryRun) {
    console.log(JSON.stringify({
      dryRun: true,
      bucket: env.bucket,
      publicBaseUrl: env.publicBaseUrl,
      objectPrefix: env.objectPrefix,
      objectCount: objects.length,
      totalBytes: selectedFiles.reduce((total, file) => total + file.bytes, 0),
      firstObjects: objects.slice(0, 5).map((object) => ({
        objectKey: object.objectKey,
        publicUrl: object.publicUrl,
        bytes: object.file.bytes,
      })),
    }, null, 2))
    return
  }

  if (missingForUpload.length > 0) {
    throw new Error(`Chimer preview upload requires R2 configuration: ${missingForUpload.join(", ")}`)
  }

  for (const [index, object] of objects.entries()) {
    const body = await fs.readFile(object.file.path)
    await putAtmosphereObjectToR2(env, {
      objectKey: object.objectKey,
      body,
      contentType: object.contentType,
      cacheControl: object.cacheControl,
    })
    console.log(`[${index + 1}/${objects.length}] Uploaded ${object.file.name} -> ${object.publicUrl}`)
  }

  console.log(`Uploaded ${objects.length} Chimer preview assets to ${env.bucket}/${env.objectPrefix}.`)
}

function r2EnvForOptions(options) {
  const baseEnv = readAtmospherePublicMediaR2Env()
  return {
    ...baseEnv,
    publicBaseUrl: options.publicBaseUrl ?? baseEnv.publicBaseUrl,
    objectPrefix: options.objectPrefix,
  }
}

function parseArgs(rawArgs) {
  const options = {
    dryRun: false,
    inputDir: defaultInputDir,
    limit: 0,
    objectPrefix: defaultObjectPrefix,
    publicBaseUrl: undefined,
  }

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index]
    const next = rawArgs[index + 1]

    switch (arg) {
      case "--dry-run":
        options.dryRun = true
        break
      case "--input-dir":
        options.inputDir = path.resolve(repoRoot, next ?? "")
        index += 1
        break
      case "--limit":
        options.limit = Number(next)
        index += 1
        break
      case "--object-prefix":
        options.objectPrefix = normalizeObjectPrefix(next ?? defaultObjectPrefix)
        index += 1
        break
      case "--public-base-url":
        options.publicBaseUrl = (next ?? "").replace(/\/+$/, "")
        index += 1
        break
      default:
        if (arg.startsWith("--")) {
          throw new Error(`Unknown option: ${arg}`)
        }
    }
  }

  options.objectPrefix = normalizeObjectPrefix(options.objectPrefix)
  return options
}

async function collectPreviewFiles(inputDir) {
  const entries = await fs.readdir(inputDir, { withFileTypes: true }).catch((error) => {
    if (error && error.code === "ENOENT") {
      return []
    }
    throw error
  })

  const files = []
  for (const entry of entries) {
    if (!entry.isFile()) {
      continue
    }

    if (!entry.name.endsWith(".webm") && entry.name !== "index.json") {
      continue
    }

    const filePath = path.join(inputDir, entry.name)
    const stat = await fs.stat(filePath)
    files.push({
      name: entry.name,
      path: filePath,
      bytes: stat.size,
    })
  }

  return files.sort((left, right) => left.name.localeCompare(right.name))
}

function contentTypeForFile(fileName) {
  if (fileName.endsWith(".webm")) {
    return "video/webm"
  }
  if (fileName.endsWith(".json")) {
    return "application/json; charset=utf-8"
  }
  return "application/octet-stream"
}

function normalizeObjectPrefix(value) {
  return value
    .trim()
    .replace(/^\/+/, "")
    .replace(/\/+$/, "")
}

function printUsage() {
  console.log([
    "Usage:",
    "  npm run chimer:preview:r2:check -- [--input-dir public/chimer/background-previews] [--public-base-url https://media.massagelab.app]",
    "  npm run chimer:preview:r2:upload -- [--dry-run] [--input-dir public/chimer/background-previews] [--object-prefix chimer/background-previews] [--public-base-url https://media.massagelab.app]",
  ].join("\n"))
}
