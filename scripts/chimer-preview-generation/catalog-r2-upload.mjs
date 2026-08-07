#!/usr/bin/env node

import path from "node:path"
import { fileURLToPath } from "node:url"

import { config } from "dotenv"

import {
  CATALOG_R2_MEDIA_CACHE_CONTROL,
  CATALOG_R2_RELEASE_PREFIX,
  loadCatalogR2PublicationPlan,
  readCatalogMediaSnapshot,
} from "./catalog-r2-publication.mjs"
import {
  missingAtmosphereR2UploadEnv,
  putAtmosphereObjectToR2,
  readAtmospherePublicMediaR2Env,
} from "../../lib/atmosphere/r2-sample-hosting.js"

config({ path: ".env.local" })
config()

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const defaultCatalogPath = path.join(repoRoot, "public/chimer/background-preview-catalog/index.json")
const dryRunSummaryPrefix = "MASSAGELAB_CATALOG_R2_DRY_RUN_SUMMARY="

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

/** Runs the full local catalog preflight and reports separate R2 readiness. */
async function runCheck(rawArgs) {
  const options = parseArgs(rawArgs)
  const env = r2EnvForOptions(options)
  const plan = await loadCatalogR2PublicationPlan({ catalogPath: options.catalogPath })
  const missingForUpload = missingAtmosphereR2UploadEnv(env)

  console.log(JSON.stringify({
    catalogPath: plan.catalogPath,
    catalogRevision: plan.catalogRevision,
    objectPrefix: plan.objectPrefix,
    objectCount: plan.objectCount,
    totalBytes: plan.totalBytes,
    immutableCacheControl: CATALOG_R2_MEDIA_CACHE_CONTROL,
    publicBaseUrlConfigured: Boolean(env.publicBaseUrl),
    uploadReady: missingForUpload.length === 0,
    missingForUpload,
  }, null, 2))
}

/**
 * Validates the complete immutable release before checking live credentials or
 * submitting a single PUT. A dry run never reads credentials or mutates R2.
 */
async function runUpload(rawArgs) {
  const options = parseArgs(rawArgs)
  if (options.dryRun && options.confirmLiveUpload) {
    throw new Error("Use either --dry-run or --confirm-live-upload, not both.")
  }
  if (!options.dryRun && !options.confirmLiveUpload) {
    throw new Error("Live catalog upload requires --confirm-live-upload.")
  }

  const env = r2EnvForOptions(options)
  const plan = await loadCatalogR2PublicationPlan({
    catalogPath: options.catalogPath,
    publicBaseUrl: env.publicBaseUrl,
  })
  if (!env.publicBaseUrl) {
    throw new Error("MASSAGELAB_PUBLIC_MEDIA_PUBLIC_BASE_URL or --public-base-url is required for catalog uploads.")
  }

  if (options.dryRun) {
    console.log(`${dryRunSummaryPrefix}${JSON.stringify({
      dryRun: true,
      catalogRevision: plan.catalogRevision,
      bucket: env.bucket,
      publicBaseUrl: env.publicBaseUrl,
      objectPrefix: CATALOG_R2_RELEASE_PREFIX,
      objectCount: plan.objectCount,
      totalBytes: plan.totalBytes,
      cacheControl: CATALOG_R2_MEDIA_CACHE_CONTROL,
      uploaded: false,
    })}`)
    return
  }

  const missingForUpload = missingAtmosphereR2UploadEnv(env)
  if (missingForUpload.length > 0) {
    throw new Error(`Catalog R2 upload requires configuration: ${missingForUpload.join(", ")}`)
  }

  for (const [index, object] of plan.objects.entries()) {
    // The same verified Buffer is hashed and then sent, preventing source-file
    // changes after preflight from publishing unapproved bytes.
    const body = await readCatalogMediaSnapshot(object)
    await putAtmosphereObjectToR2(env, {
      objectKey: object.objectKey,
      body,
      contentType: object.contentType,
      cacheControl: object.cacheControl,
    })
    console.log(`[${index + 1}/${plan.objects.length}] Uploaded ${object.sourceRelativePath} -> ${object.publicUrl}`)
  }

  console.log(`Uploaded ${plan.objectCount} immutable catalog assets to ${env.bucket}/${CATALOG_R2_RELEASE_PREFIX}.`)
}

/** Keeps catalog R2 keys fixed even if shared public-media prefix variables exist. */
function r2EnvForOptions(options) {
  const baseEnv = readAtmospherePublicMediaR2Env()
  return {
    ...baseEnv,
    publicBaseUrl: normalizeCatalogPublicBaseUrl(options.publicBaseUrl ?? baseEnv.publicBaseUrl),
  }
}

/**
 * Limits catalog delivery to a configured HTTPS custom domain. Direct R2
 * development URLs are intentionally excluded from both dry and live modes.
 *
 * @param {string | undefined} value
 */
function normalizeCatalogPublicBaseUrl(value) {
  if (!value) return undefined

  let publicBaseUrl
  try {
    publicBaseUrl = new URL(value)
  } catch {
    throw new Error("Catalog public base URL must be a valid absolute HTTPS URL.")
  }
  if (publicBaseUrl.protocol !== "https:") {
    throw new Error("Catalog public base URL must use https:.")
  }
  const hostname = publicBaseUrl.hostname.toLowerCase().replace(/\.$/, "")
  if (hostname === "r2.dev" || hostname.endsWith(".r2.dev")) {
    throw new Error("Catalog public base URL must not use r2.dev or an r2.dev subdomain.")
  }
  if (publicBaseUrl.username || publicBaseUrl.password || publicBaseUrl.search || publicBaseUrl.hash) {
    throw new Error("Catalog public base URL must not include credentials, a query string, or a fragment.")
  }
  return publicBaseUrl.href.replace(/\/+$/, "")
}

function parseArgs(rawArgs) {
  const options = {
    catalogPath: defaultCatalogPath,
    dryRun: false,
    confirmLiveUpload: false,
    publicBaseUrl: undefined,
  }

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index]
    switch (arg) {
      case "--catalog-path":
        options.catalogPath = path.resolve(repoRoot, requiredValue(rawArgs, index, arg))
        index += 1
        break
      case "--public-base-url":
        options.publicBaseUrl = requiredValue(rawArgs, index, arg)
        index += 1
        break
      case "--dry-run":
        options.dryRun = true
        break
      case "--confirm-live-upload":
        options.confirmLiveUpload = true
        break
      case "--object-prefix":
        throw new Error(`Catalog release prefix is fixed at ${CATALOG_R2_RELEASE_PREFIX}; --object-prefix is not supported.`)
      default:
        if (arg.startsWith("--")) throw new Error(`Unknown option: ${arg}`)
        throw new Error(`Unexpected argument: ${arg}`)
    }
  }

  return options
}

function requiredValue(rawArgs, index, option) {
  const value = rawArgs[index + 1]
  if (!value || value.startsWith("--")) throw new Error(`${option} requires a value.`)
  return value
}

function printUsage() {
  console.log([
    "Usage:",
    "  npm run chimer:preview:catalog:r2:check -- [--catalog-path public/chimer/background-preview-catalog/index.json] [--public-base-url https://media.massagelab.app]",
    "  npm run chimer:preview:catalog:r2:upload -- --dry-run --public-base-url https://media.massagelab.app",
    "  npm run chimer:preview:catalog:r2:upload -- --confirm-live-upload --public-base-url https://media.massagelab.app",
  ].join("\n"))
}
