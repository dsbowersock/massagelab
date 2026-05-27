import { createHash, createHmac } from "node:crypto"
import { PrismaClient, type Prisma } from "@prisma/client"
import { neonConfig } from "@neondatabase/serverless"
import { PrismaNeon } from "@prisma/adapter-neon"
import { config } from "dotenv"
import sharp from "sharp"
import ws from "ws"
import {
  ANATOMY_FOUNDATION_SEED,
  type AnatomyMediaAsset as SeedMediaAsset,
} from "../lib/anatomy-foundation.ts"

config({ path: ".env.local" })
config()

type Command = "check" | "setup-bucket" | "status" | "upload"

type R2Env = {
  accountId?: string
  apiToken?: string
  accessKeyId?: string
  secretAccessKey?: string
  bucket: string
  endpoint?: string
  publicBaseUrl?: string
  cacheControl: string
}

type FetchedMedia = {
  bytes: Uint8Array
  contentType: string
  ingestionMethod?: string
  fallbackFrameSlugs?: string[]
}

const DEFAULT_BUCKET = "massagelab-anatomy-media"
const DEFAULT_CACHE_CONTROL = "public, max-age=31536000, immutable"
const SERVICE = "s3"
const REGION = "auto"
const SOURCE_FETCH_RETRIES = 3
const R2_UPLOAD_RETRIES = 3
const DEFAULT_UPLOAD_CONCURRENCY = 4
const SOURCE_FETCH_TIMEOUT_MS = 120_000
const R2_UPLOAD_TIMEOUT_MS = 60_000
const BODY_PARTS_3D_FRAME_VIEWS = ["anterior", "left-lateral", "posterior", "right-lateral", "anterior"] as const

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

async function retry<T>(label: string, attempts: number, fn: () => Promise<T>) {
  let lastError: unknown
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (attempt === attempts) break

      const delayMs = 750 * attempt * attempt
      console.warn(`${label} failed on attempt ${attempt}/${attempts}; retrying in ${delayMs}ms. ${errorMessage(error)}`)
      await sleep(delayMs)
    }
  }

  throw lastError
}

function cleanEnv(value: string | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function uploadConcurrency() {
  const raw = Number.parseInt(cleanEnv(process.env.ANATOMY_MEDIA_UPLOAD_CONCURRENCY) ?? "", 10)
  if (!Number.isFinite(raw)) return DEFAULT_UPLOAD_CONCURRENCY
  return Math.min(Math.max(raw, 1), 8)
}

function uploadLimit() {
  const raw = Number.parseInt(cleanEnv(process.env.ANATOMY_MEDIA_UPLOAD_LIMIT) ?? "", 10)
  if (!Number.isFinite(raw) || raw < 1) return null
  return raw
}

function skipRemoteBodyParts3dAnimation() {
  return cleanEnv(process.env.ANATOMY_MEDIA_SKIP_REMOTE_ANIMATION) === "1"
}

function readR2Env(): R2Env {
  return {
    accountId: cleanEnv(process.env.CLOUDFLARE_ACCOUNT_ID),
    apiToken: cleanEnv(process.env.CLOUDFLARE_API_TOKEN),
    accessKeyId: cleanEnv(process.env.R2_ACCESS_KEY_ID),
    secretAccessKey: cleanEnv(process.env.R2_SECRET_ACCESS_KEY),
    bucket: cleanEnv(process.env.MASSAGELAB_R2_BUCKET) ?? DEFAULT_BUCKET,
    endpoint: cleanEnv(process.env.MASSAGELAB_R2_ENDPOINT),
    publicBaseUrl: cleanEnv(process.env.MASSAGELAB_R2_PUBLIC_BASE_URL)?.replace(/\/+$/, ""),
    cacheControl: cleanEnv(process.env.MASSAGELAB_R2_CACHE_CONTROL) ?? DEFAULT_CACHE_CONTROL,
  }
}

function uploadableSeedAssets() {
  return ANATOMY_FOUNDATION_SEED.mediaAssets.filter((asset) => asset.storagePath && asset.metadata?.r2Upload === true)
}

function missingValues(values: Array<[name: string, value: string | undefined]>) {
  return values.filter(([, value]) => !value).map(([name]) => name)
}

function missingSetupEnv(env: R2Env) {
  return missingValues([
    ["CLOUDFLARE_ACCOUNT_ID", env.accountId],
    ["CLOUDFLARE_API_TOKEN", env.apiToken],
    ["MASSAGELAB_R2_BUCKET", env.bucket],
  ])
}

function missingUploadEnv(env: R2Env) {
  const endpointOrAccount = env.endpoint ?? env.accountId
  return missingValues([
    ["CLOUDFLARE_ACCOUNT_ID or MASSAGELAB_R2_ENDPOINT", endpointOrAccount],
    ["R2_ACCESS_KEY_ID", env.accessKeyId],
    ["R2_SECRET_ACCESS_KEY", env.secretAccessKey],
    ["MASSAGELAB_R2_BUCKET", env.bucket],
  ])
}

function requireEnv(missing: string[], command: Command) {
  if (missing.length > 0) {
    throw new Error(`Cannot run anatomy:media:${command}. Missing required environment variables: ${missing.join(", ")}`)
  }
}

function endpointForEnv(env: R2Env) {
  const endpoint = env.endpoint ?? (env.accountId ? `https://${env.accountId}.r2.cloudflarestorage.com` : undefined)
  if (!endpoint) throw new Error("R2 endpoint could not be resolved.")
  return endpoint.replace(/\/+$/, "")
}

function encodeStoragePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/")
}

function publicUrlForAsset(env: R2Env, asset: SeedMediaAsset) {
  if (!env.publicBaseUrl || !asset.storagePath) return asset.remoteUrl ?? null
  return `${env.publicBaseUrl}/${encodeStoragePath(asset.storagePath)}`
}

function mediaAssetBySlug() {
  return new Map(ANATOMY_FOUNDATION_SEED.mediaAssets.map((asset) => [asset.slug, asset]))
}

function contentTypeForAsset(asset: SeedMediaAsset) {
  if (asset.format === "png") return "image/png"
  if (asset.format === "gif") return "image/gif"
  if (asset.format === "jpg" || asset.format === "jpeg") return "image/jpeg"
  if (asset.format === "svg") return "image/svg+xml"
  if (asset.format === "glb") return "model/gltf-binary"
  if (asset.format === "gltf") return "model/gltf+json"
  if (asset.format === "stl") return "model/stl"
  return "application/octet-stream"
}

function sha256Hex(value: string | Uint8Array) {
  return createHash("sha256").update(value).digest("hex")
}

function hmac(key: string | Uint8Array, value: string) {
  return createHmac("sha256", key).update(value).digest()
}

function amzTimestamp(date = new Date()) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "")
}

function canonicalizeHeaders(headers: Record<string, string>) {
  const keys = Object.keys(headers).map((key) => key.toLowerCase()).sort()
  const canonicalHeaders = keys
    .map((key) => `${key}:${headers[key].trim().replace(/\s+/g, " ")}`)
    .join("\n")

  return {
    canonicalHeaders: `${canonicalHeaders}\n`,
    signedHeaders: keys.join(";"),
  }
}

function authorizationHeader({
  accessKeyId,
  secretAccessKey,
  method,
  canonicalUri,
  headers,
  payloadHash,
  amzDate,
}: {
  accessKeyId: string
  secretAccessKey: string
  method: "PUT"
  canonicalUri: string
  headers: Record<string, string>
  payloadHash: string
  amzDate: string
}) {
  const dateStamp = amzDate.slice(0, 8)
  const credentialScope = `${dateStamp}/${REGION}/${SERVICE}/aws4_request`
  const { canonicalHeaders, signedHeaders } = canonicalizeHeaders(headers)
  const canonicalRequest = [
    method,
    canonicalUri,
    "",
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join("\n")
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n")
  const dateKey = hmac(`AWS4${secretAccessKey}`, dateStamp)
  const dateRegionKey = hmac(dateKey, REGION)
  const dateRegionServiceKey = hmac(dateRegionKey, SERVICE)
  const signingKey = hmac(dateRegionServiceKey, "aws4_request")
  const signature = createHmac("sha256", signingKey).update(stringToSign).digest("hex")

  return `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`
}

async function fetchSourceMedia(asset: SeedMediaAsset): Promise<FetchedMedia> {
  const response = await retry(`Fetch ${asset.slug}`, SOURCE_FETCH_RETRIES, () =>
    fetch(asset.sourceUrl, { signal: AbortSignal.timeout(SOURCE_FETCH_TIMEOUT_MS) }))
  if (!response.ok) {
    throw new Error(`Failed to fetch ${asset.slug} from ${asset.sourceUrl}: HTTP ${response.status}`)
  }

  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim() || contentTypeForAsset(asset)
  return {
    bytes: new Uint8Array(await response.arrayBuffer()),
    contentType,
    ingestionMethod: "source_url",
  }
}

function bodyParts3dFallbackFrameSlugs(asset: SeedMediaAsset) {
  const sourceAssetSlug = typeof asset.metadata?.sourceAssetSlug === "string" ? asset.metadata.sourceAssetSlug : null
  const match = sourceAssetSlug?.match(/^(.*)-(anterior|posterior|left-lateral|right-lateral)-anatomogram$/)
  if (!match) return null

  const prefix = match[1]
  return BODY_PARTS_3D_FRAME_VIEWS.map((view) => `${prefix}-${view}-anatomogram`)
}

async function fetchUploadedFrame(env: R2Env, asset: SeedMediaAsset) {
  const url = publicUrlForAsset(env, asset)
  if (!url) throw new Error(`No public URL is available for fallback frame ${asset.slug}.`)

  const response = await retry(`Fetch fallback frame ${asset.slug}`, SOURCE_FETCH_RETRIES, () =>
    fetch(url, { signal: AbortSignal.timeout(SOURCE_FETCH_TIMEOUT_MS) }))
  if (!response.ok) throw new Error(`Failed to fetch fallback frame ${asset.slug} from ${url}: HTTP ${response.status}`)

  return Buffer.from(await response.arrayBuffer())
}

async function fetchBodyParts3dFallbackGif(env: R2Env, asset: SeedMediaAsset): Promise<FetchedMedia> {
  if (asset.sourceRef !== "bodyparts3d" || asset.format !== "gif") {
    throw new Error(`No local fallback GIF strategy is available for ${asset.slug}.`)
  }

  const frameSlugs = bodyParts3dFallbackFrameSlugs(asset)
  if (!frameSlugs) throw new Error(`No BodyParts3D still-frame source slug is available for ${asset.slug}.`)

  const bySlug = mediaAssetBySlug()
  const frameAssets = frameSlugs.map((slug) => bySlug.get(slug))
  const missingFrameSlug = frameSlugs.find((slug, index) => !frameAssets[index])
  if (missingFrameSlug) throw new Error(`Missing BodyParts3D fallback frame ${missingFrameSlug} for ${asset.slug}.`)

  const frames = await Promise.all(frameAssets.map((frameAsset) => fetchUploadedFrame(env, frameAsset as SeedMediaAsset)))
  const gif = await sharp(frames, { join: { animated: true } })
    .gif({ effort: 5, dither: 0.75 })
    .toBuffer()

  return {
    bytes: new Uint8Array(gif),
    contentType: "image/gif",
    ingestionMethod: "local_bodyparts3d_still_frame_fallback",
    fallbackFrameSlugs: frameSlugs,
  }
}

async function fetchMediaWithFallback(env: R2Env, asset: SeedMediaAsset): Promise<FetchedMedia> {
  if (skipRemoteBodyParts3dAnimation() && asset.sourceRef === "bodyparts3d" && asset.format === "gif") {
    return fetchBodyParts3dFallbackGif(env, asset)
  }

  try {
    return await fetchSourceMedia(asset)
  } catch (sourceError) {
    if (asset.sourceRef !== "bodyparts3d" || asset.format !== "gif") throw sourceError

    console.warn(`Remote BodyParts3D animation failed for ${asset.slug}; trying local still-frame GIF fallback. ${errorMessage(sourceError)}`)
    return fetchBodyParts3dFallbackGif(env, asset)
  }
}

async function putObjectToR2(env: R2Env, asset: SeedMediaAsset, media: FetchedMedia) {
  if (!asset.storagePath) throw new Error(`Media asset ${asset.slug} does not have a storagePath.`)
  if (!env.accessKeyId || !env.secretAccessKey) throw new Error("R2 API keys are required for upload.")

  const endpoint = endpointForEnv(env)
  const endpointUrl = new URL(endpoint)
  const canonicalUri = `/${encodeURIComponent(env.bucket)}/${encodeStoragePath(asset.storagePath)}`
  const objectUrl = `${endpoint}${canonicalUri}`
  const payloadHash = sha256Hex(media.bytes)
  const amzDate = amzTimestamp()
  const headers = {
    "cache-control": env.cacheControl,
    "content-type": media.contentType,
    host: endpointUrl.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  }

  const authorization = authorizationHeader({
    accessKeyId: env.accessKeyId,
    secretAccessKey: env.secretAccessKey,
    method: "PUT",
    canonicalUri,
    headers,
    payloadHash,
    amzDate,
  })

  const response = await retry(`Upload ${asset.slug}`, R2_UPLOAD_RETRIES, () =>
    fetch(objectUrl, {
      method: "PUT",
      headers: {
        Authorization: authorization,
        "Cache-Control": headers["cache-control"],
        "Content-Type": headers["content-type"],
        Host: headers.host,
        "x-amz-content-sha256": headers["x-amz-content-sha256"],
        "x-amz-date": headers["x-amz-date"],
      },
      body: media.bytes,
      signal: AbortSignal.timeout(R2_UPLOAD_TIMEOUT_MS),
    }))

  if (!response.ok) {
    const responseText = await response.text().catch(() => "")
    throw new Error(`R2 upload failed for ${asset.slug}: HTTP ${response.status}${responseText ? ` ${responseText}` : ""}`)
  }
}

function databaseConnectionString() {
  return process.env.DIRECT_URL ?? process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL
}

function createPrismaClient() {
  const connectionString = databaseConnectionString()
  if (!connectionString) {
    throw new Error("DIRECT_URL, DATABASE_URL_UNPOOLED, or DATABASE_URL is required to update anatomy media rows after upload.")
  }

  neonConfig.webSocketConstructor = ws
  const adapter = new PrismaNeon({ connectionString })
  return new PrismaClient({ adapter, log: ["error"] })
}

function uploadMetadata(asset: SeedMediaAsset, env: R2Env, media: FetchedMedia) {
  return {
    ...(asset.metadata ?? {}),
    ingestionStatus: "uploaded_to_r2",
    ingestionMethod: media.ingestionMethod,
    fallbackFrameSlugs: media.fallbackFrameSlugs,
    r2Bucket: env.bucket,
    r2StoragePath: asset.storagePath,
    r2PublicBaseUrlConfigured: Boolean(env.publicBaseUrl),
    uploadedAt: new Date().toISOString(),
    uploadedBytes: media.bytes.byteLength,
    uploadedContentType: media.contentType,
  } satisfies Prisma.InputJsonObject
}

function metadataRecord(value: Prisma.JsonValue | null | undefined) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>
  return {}
}

type ExistingMediaRow = {
  slug: string
  remoteUrl: string | null
  storagePath: string | null
  metadata: Prisma.JsonValue | null
}

function isUploadedToR2(env: R2Env, asset: SeedMediaAsset, existing: ExistingMediaRow | undefined) {
  if (!existing || existing.storagePath !== (asset.storagePath ?? null)) return false

  const metadata = metadataRecord(existing.metadata)
  return (
    metadata.ingestionStatus === "uploaded_to_r2"
    && metadata.r2StoragePath === asset.storagePath
    && existing.remoteUrl === publicUrlForAsset(env, asset)
  )
}

async function existingMediaRowsBySlug(prisma: PrismaClient, assets: SeedMediaAsset[]) {
  const rows = await prisma.anatomyMediaAsset.findMany({
    where: { slug: { in: assets.map((asset) => asset.slug) } },
    select: { slug: true, remoteUrl: true, storagePath: true, metadata: true },
  })

  return new Map(rows.map((row) => [row.slug, row]))
}

async function updateDatabaseMediaRow(prisma: PrismaClient, env: R2Env, asset: SeedMediaAsset, media: FetchedMedia) {
  const existing = await prisma.anatomyMediaAsset.findUnique({
    where: { slug: asset.slug },
    select: { id: true },
  })

  if (!existing) {
    console.log(`Skipped database update for ${asset.slug}; run npm run anatomy:seed first.`)
    return
  }

  await prisma.anatomyMediaAsset.update({
    where: { slug: asset.slug },
    data: {
      storagePath: asset.storagePath ?? null,
      remoteUrl: publicUrlForAsset(env, asset),
      format: asset.format ?? null,
      metadata: uploadMetadata(asset, env, media),
    },
  })
}

async function runCheck() {
  const env = readR2Env()
  const assets = uploadableSeedAssets()
  const missingForSetup = missingSetupEnv(env)
  const missingForUpload = missingUploadEnv(env)

  console.log(JSON.stringify({
    bucket: env.bucket,
    endpoint: env.endpoint ?? (env.accountId ? `https://${env.accountId}.r2.cloudflarestorage.com` : null),
    publicBaseUrlConfigured: Boolean(env.publicBaseUrl),
    setupReady: missingForSetup.length === 0,
    uploadReady: missingForUpload.length === 0,
    missingForSetup,
    missingForUpload,
    uploadableMediaAssets: assets.map((asset) => ({
      slug: asset.slug,
      sourceUrl: asset.sourceUrl,
      storagePath: asset.storagePath,
      reviewStatus: asset.reviewStatus,
      license: asset.license,
    })),
  }, null, 2))
}

async function runStatus() {
  const env = readR2Env()
  requireEnv(missingUploadEnv(env), "upload")
  const assets = uploadableSeedAssets()
  const prisma = createPrismaClient()

  try {
    const existingRows = await existingMediaRowsBySlug(prisma, assets)
    const pendingAssets = assets.filter((asset) => !isUploadedToR2(env, asset, existingRows.get(asset.slug)))
    const uploadedCount = assets.length - pendingAssets.length
    const byFormat = new Map<string, number>()
    const bySource = new Map<string, number>()

    for (const asset of pendingAssets) {
      byFormat.set(asset.format ?? "unknown", (byFormat.get(asset.format ?? "unknown") ?? 0) + 1)
      bySource.set(asset.sourceRef, (bySource.get(asset.sourceRef) ?? 0) + 1)
    }

    console.log(JSON.stringify({
      bucket: env.bucket,
      publicBaseUrlConfigured: Boolean(env.publicBaseUrl),
      uploadableAssetCount: assets.length,
      uploadedCount,
      pendingCount: pendingAssets.length,
      pendingByFormat: Object.fromEntries([...byFormat.entries()].sort()),
      pendingBySource: Object.fromEntries([...bySource.entries()].sort()),
      samplePendingSlugs: pendingAssets.slice(0, 20).map((asset) => asset.slug),
    }, null, 2))
  } finally {
    await prisma.$disconnect()
  }
}

async function runSetupBucket() {
  const env = readR2Env()
  requireEnv(missingSetupEnv(env), "setup-bucket")
  if (!env.accountId || !env.apiToken) throw new Error("Cloudflare account ID and API token are required.")

  const response = await fetch(`https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(env.accountId)}/r2/buckets`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.apiToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ name: env.bucket }),
  })
  const responseText = await response.text()
  const responseBody = responseText ? JSON.parse(responseText) as { success?: boolean; errors?: Array<{ message?: string }> } : null

  if (!response.ok || responseBody?.success === false) {
    const message = responseBody?.errors?.map((error) => error.message).filter(Boolean).join("; ") || responseText
    throw new Error(`Cloudflare R2 bucket setup failed: HTTP ${response.status}${message ? ` ${message}` : ""}`)
  }

  console.log(`R2 bucket ready: ${env.bucket}`)
}

async function runUpload() {
  const env = readR2Env()
  requireEnv(missingUploadEnv(env), "upload")
  const assets = uploadableSeedAssets()
  const prisma = createPrismaClient()

  try {
    let uploadedCount = 0
    const existingRows = await existingMediaRowsBySlug(prisma, assets)
    const allPendingAssets = assets.filter((asset) => !isUploadedToR2(env, asset, existingRows.get(asset.slug)))
    const limit = uploadLimit()
    const pendingAssets = limit ? allPendingAssets.slice(0, limit) : allPendingAssets
    const skippedCount = assets.length - allPendingAssets.length
    const deferredCount = allPendingAssets.length - pendingAssets.length
    const failures: string[] = []
    const concurrency = Math.min(uploadConcurrency(), pendingAssets.length || 1)
    let nextIndex = 0
    let processedCount = 0

    console.log(`Upload queue: ${pendingAssets.length} pending in this run, ${deferredCount} deferred by batch limit, ${skippedCount} already uploaded, concurrency ${concurrency}.`)

    async function uploadAsset(asset: SeedMediaAsset) {
      try {
        const media = await fetchMediaWithFallback(env, asset)
        await putObjectToR2(env, asset, media)
        await updateDatabaseMediaRow(prisma, env, asset, media)
        uploadedCount += 1
        console.log(`Uploaded ${asset.slug} -> ${asset.storagePath} (${media.bytes.byteLength} bytes).`)
      } catch (error) {
        failures.push(`${asset.slug}: ${errorMessage(error)}`)
        console.warn(`Failed ${asset.slug}; continuing with remaining assets. ${errorMessage(error)}`)
      } finally {
        processedCount += 1
        if (processedCount === pendingAssets.length || processedCount % 25 === 0) {
          console.log(`Progress: ${processedCount}/${pendingAssets.length} pending assets processed.`)
        }
      }
    }

    const workers = Array.from({ length: concurrency }, async () => {
      while (nextIndex < pendingAssets.length) {
        const asset = pendingAssets[nextIndex]
        nextIndex += 1
        await uploadAsset(asset)
      }
    })

    await Promise.all(workers)

    console.log(`Done. Uploaded ${uploadedCount} anatomy media assets to R2 bucket ${env.bucket}. Skipped ${skippedCount} already-uploaded assets. Failed ${failures.length} assets.`)
    if (failures.length > 0) {
      throw new Error(`Anatomy media upload finished with failures:\n${failures.join("\n")}`)
    }
  } finally {
    await prisma.$disconnect()
  }
}

async function main() {
  const command = process.argv[2] as Command | undefined

  if (command === "check") {
    await runCheck()
    return
  }

  if (command === "setup-bucket") {
    await runSetupBucket()
    return
  }

  if (command === "status") {
    await runStatus()
    return
  }

  if (command === "upload") {
    await runUpload()
    return
  }

  throw new Error("Usage: npm run anatomy:media:check | npm run anatomy:media:setup-bucket | npm run anatomy:media:status | npm run anatomy:media:upload")
}

main().catch((error: unknown) => {
  console.error(errorMessage(error))
  process.exitCode = 1
})
