// @ts-check

import { createHash, createHmac } from "node:crypto"
import {
  OBSERVABLE_STREAMS_ADAPTATION_ID,
  OBSERVABLE_STREAMS_R2_MANIFEST_OBJECT_KEY,
  OBSERVABLE_STREAMS_R2_OBJECT_PREFIX,
  OBSERVABLE_STREAMS_R2_PUBLIC_MEDIA_BUCKET,
  OBSERVABLE_STREAMS_R2_SAMPLE_INDEX_OBJECT_KEY,
} from "./observable-streams-adaptation.js"

export const DEFAULT_ATMOSPHERE_PUBLIC_MEDIA_BUCKET = OBSERVABLE_STREAMS_R2_PUBLIC_MEDIA_BUCKET
export const DEFAULT_ATMOSPHERE_R2_CACHE_CONTROL = "public, max-age=31536000, immutable"
export const DEFAULT_ATMOSPHERE_R2_METADATA_CACHE_CONTROL = "public, max-age=300, must-revalidate"

const SERVICE = "s3"
const REGION = "auto"
const R2_UPLOAD_RETRIES = 3
const R2_UPLOAD_TIMEOUT_MS = 60_000
const textEncoder = new TextEncoder()

/**
 * Reads the public non-PHI media bucket configuration without exposing secret
 * values. Auth and S3-compatible endpoint configuration can be shared with the
 * anatomy uploader, but the public media bucket and public base URL are explicit
 * so audio samples cannot silently publish to the anatomy bucket.
 *
 * @param {Record<string, string | undefined>} [env]
 */
export function readAtmospherePublicMediaR2Env(env = process.env) {
  return {
    accountId: cleanEnv(env.CLOUDFLARE_ACCOUNT_ID),
    accessKeyId: cleanEnv(env.R2_ACCESS_KEY_ID),
    secretAccessKey: cleanEnv(env.R2_SECRET_ACCESS_KEY),
    bucket: cleanEnv(env.MASSAGELAB_PUBLIC_MEDIA_BUCKET) ?? DEFAULT_ATMOSPHERE_PUBLIC_MEDIA_BUCKET,
    endpoint: cleanEnv(env.MASSAGELAB_PUBLIC_MEDIA_R2_ENDPOINT) ?? cleanEnv(env.MASSAGELAB_R2_ENDPOINT),
    publicBaseUrl: normalizePublicBaseUrl(cleanEnv(env.MASSAGELAB_PUBLIC_MEDIA_PUBLIC_BASE_URL)),
    cacheControl: cleanEnv(env.MASSAGELAB_PUBLIC_MEDIA_CACHE_CONTROL) ?? DEFAULT_ATMOSPHERE_R2_CACHE_CONTROL,
    metadataCacheControl:
      cleanEnv(env.MASSAGELAB_PUBLIC_MEDIA_METADATA_CACHE_CONTROL) ?? DEFAULT_ATMOSPHERE_R2_METADATA_CACHE_CONTROL,
    objectPrefix: normalizeR2ObjectPrefix(
      cleanEnv(env.MASSAGELAB_PUBLIC_MEDIA_OBJECT_PREFIX) ?? OBSERVABLE_STREAMS_R2_OBJECT_PREFIX,
    ),
  }
}

/**
 * @param {ReturnType<typeof readAtmospherePublicMediaR2Env>} env
 */
export function missingAtmosphereR2UploadEnv(env) {
  const endpointOrAccount = env.endpoint ?? env.accountId
  return missingValues([
    ["CLOUDFLARE_ACCOUNT_ID or MASSAGELAB_PUBLIC_MEDIA_R2_ENDPOINT/MASSAGELAB_R2_ENDPOINT", endpointOrAccount],
    ["R2_ACCESS_KEY_ID", env.accessKeyId],
    ["R2_SECRET_ACCESS_KEY", env.secretAccessKey],
    ["MASSAGELAB_PUBLIC_MEDIA_BUCKET", env.bucket],
    ["MASSAGELAB_PUBLIC_MEDIA_PUBLIC_BASE_URL", env.publicBaseUrl],
  ])
}

/**
 * @param {ReturnType<typeof readAtmospherePublicMediaR2Env>} env
 */
export function endpointForAtmosphereR2Env(env) {
  const endpoint = env.endpoint ?? (env.accountId ? `https://${env.accountId}.r2.cloudflarestorage.com` : undefined)
  if (!endpoint) throw new Error("R2 endpoint could not be resolved.")
  return endpoint.replace(/\/+$/, "")
}

/**
 * @param {string | undefined} publicBaseUrl
 * @param {string} objectKey
 */
export function publicUrlForR2Object(publicBaseUrl, objectKey) {
  const normalizedBaseUrl = normalizePublicBaseUrl(publicBaseUrl)
  if (!normalizedBaseUrl) {
    throw new Error("MASSAGELAB_PUBLIC_MEDIA_PUBLIC_BASE_URL is required to build hosted sample URLs.")
  }

  return `${normalizedBaseUrl}/${encodeR2Path(normalizeR2ObjectKey(objectKey))}`
}

/**
 * Converts the deterministic local Observable Streams asset plan into the R2
 * object layout MassageLab will host from the public non-PHI media bucket.
 *
 * @param {{
 *   assetPlan: {
 *     adaptationId?: string,
 *     selectedAssets: Array<{
 *       instrumentName: string,
 *       noteName: string,
 *       dynamicLayer?: string,
 *       sourceRelativePath: string,
 *       outputFileName: string,
 *       sizeBytes?: number | null,
 *     }>,
 *     missingNotes?: Array<Record<string, unknown>>,
 *     excludedSources?: Array<Record<string, unknown>>,
 *   },
 *   renderedSampleObjects?: Array<{
 *     instrumentName: string,
 *     noteName: string,
 *     sourceInstrumentName?: string,
 *     sourceNoteName?: string,
 *     sourceRelativePath?: string,
 *     outputFileName: string,
 *     objectKey: string,
 *     publicUrl: string,
 *     contentType: string,
 *     cacheControl?: string,
 *     body: Uint8Array,
 *     sizeBytes: number,
 *     render?: Record<string, unknown>,
 *   }>,
 *   bucket?: string,
 *   publicBaseUrl: string,
 *   objectPrefix?: string,
 *   cacheControl?: string,
 *   metadataCacheControl?: string,
 * }} params
 */
export function createObservableStreamsR2UploadPlan({
  assetPlan,
  renderedSampleObjects = [],
  bucket = DEFAULT_ATMOSPHERE_PUBLIC_MEDIA_BUCKET,
  publicBaseUrl,
  objectPrefix = OBSERVABLE_STREAMS_R2_OBJECT_PREFIX,
  cacheControl = DEFAULT_ATMOSPHERE_R2_CACHE_CONTROL,
  metadataCacheControl = DEFAULT_ATMOSPHERE_R2_METADATA_CACHE_CONTROL,
}) {
  const normalizedPrefix = normalizeR2ObjectPrefix(objectPrefix)
  const sampleIndexObjectKey = objectKeyForPrefix({
    normalizedPrefix,
    defaultKey: OBSERVABLE_STREAMS_R2_SAMPLE_INDEX_OBJECT_KEY,
    leafName: "sample-index.json",
  })
  const manifestObjectKey = objectKeyForPrefix({
    normalizedPrefix,
    defaultKey: OBSERVABLE_STREAMS_R2_MANIFEST_OBJECT_KEY,
    leafName: "manifest.json",
  })
  const adaptationId = assetPlan.adaptationId ?? OBSERVABLE_STREAMS_ADAPTATION_ID
  const sampleObjects = assetPlan.selectedAssets.map((asset) => {
    const objectKey = `${normalizedPrefix}/samples/${asset.outputFileName}`
    return {
      kind: "sample",
      instrumentName: asset.instrumentName,
      noteName: asset.noteName,
      dynamicLayer: asset.dynamicLayer ?? null,
      sourceRelativePath: asset.sourceRelativePath,
      outputFileName: asset.outputFileName,
      objectKey,
      publicUrl: publicUrlForR2Object(publicBaseUrl, objectKey),
      contentType: "audio/wav",
      cacheControl,
      sizeBytes: asset.sizeBytes ?? null,
    }
  })
  const allSampleObjects = [...sampleObjects, ...renderedSampleObjects]
  const sampleIndex = buildSampleIndex(allSampleObjects)
  const samplePayloadBytes = allSampleObjects.reduce((total, asset) => total + (asset.sizeBytes ?? 0), 0)
  const manifest = {
    adaptationId,
    bucket,
    objectPrefix: normalizedPrefix,
    sampleIndexObjectKey,
    sampleIndexPublicUrl: publicUrlForR2Object(publicBaseUrl, sampleIndexObjectKey),
    sampleObjectCount: allSampleObjects.length,
    samplePayloadBytes,
    selectedAssets: sampleObjects.map((asset) => ({
      instrumentName: asset.instrumentName,
      noteName: asset.noteName,
      dynamicLayer: asset.dynamicLayer,
      sourceRelativePath: asset.sourceRelativePath,
      outputFileName: asset.outputFileName,
      objectKey: asset.objectKey,
      publicUrl: asset.publicUrl,
      sizeBytes: asset.sizeBytes,
    })),
    renderedAssets: renderedSampleObjects.map((asset) => ({
      instrumentName: asset.instrumentName,
      noteName: asset.noteName,
      sourceInstrumentName: asset.sourceInstrumentName ?? null,
      sourceNoteName: asset.sourceNoteName ?? null,
      sourceRelativePath: asset.sourceRelativePath ?? null,
      outputFileName: asset.outputFileName,
      objectKey: asset.objectKey,
      publicUrl: asset.publicUrl,
      sizeBytes: asset.sizeBytes,
      render: asset.render ?? null,
    })),
    missingNotes: assetPlan.missingNotes ?? [],
    excludedSources: assetPlan.excludedSources ?? [],
  }
  const sampleIndexObject = createJsonUploadObject({
    kind: "sample-index",
    objectKey: sampleIndexObjectKey,
    publicUrl: publicUrlForR2Object(publicBaseUrl, sampleIndexObjectKey),
    value: sampleIndex,
    cacheControl: metadataCacheControl,
  })
  const manifestObject = createJsonUploadObject({
    kind: "manifest",
    objectKey: manifestObjectKey,
    publicUrl: publicUrlForR2Object(publicBaseUrl, manifestObjectKey),
    value: manifest,
    cacheControl: metadataCacheControl,
  })

  return {
    adaptationId,
    bucket,
    objectPrefix: normalizedPrefix,
    publicBaseUrl: normalizePublicBaseUrl(publicBaseUrl),
    metadataCacheControl,
    sampleIndexObjectKey,
    sampleIndexPublicUrl: sampleIndexObject.publicUrl,
    manifestObjectKey,
    manifestPublicUrl: manifestObject.publicUrl,
    sampleObjects,
    renderedSampleObjects,
    allSampleObjects,
    sampleIndex,
    manifest,
    metadataObjects: [sampleIndexObject, manifestObject],
    objectCount: allSampleObjects.length + 2,
    samplePayloadBytes,
  }
}

/**
 * @param {ReturnType<typeof readAtmospherePublicMediaR2Env>} env
 * @param {{ objectKey: string, body: string | Uint8Array, contentType: string, cacheControl?: string }} object
 */
export async function putAtmosphereObjectToR2(env, object) {
  if (!env.accessKeyId || !env.secretAccessKey) {
    throw new Error("R2 API keys are required for upload.")
  }

  const endpoint = endpointForAtmosphereR2Env(env)
  const endpointUrl = new URL(endpoint)
  const bytes = toUint8Array(object.body)
  const canonicalUri = `/${encodeURIComponent(env.bucket)}/${encodeR2Path(normalizeR2ObjectKey(object.objectKey))}`
  const objectUrl = `${endpoint}${canonicalUri}`
  const payloadHash = sha256Hex(bytes)
  const amzDate = amzTimestamp()
  const headers = {
    "cache-control": object.cacheControl ?? env.cacheControl,
    "content-type": object.contentType,
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

  const response = await retry(`Upload ${object.objectKey}`, R2_UPLOAD_RETRIES, async () => {
    const uploadResponse = await fetch(objectUrl, {
      method: "PUT",
      headers: {
        Authorization: authorization,
        "Cache-Control": headers["cache-control"],
        "Content-Type": headers["content-type"],
        Host: headers.host,
        "x-amz-content-sha256": headers["x-amz-content-sha256"],
        "x-amz-date": headers["x-amz-date"],
      },
      body: bytes,
      signal: AbortSignal.timeout(R2_UPLOAD_TIMEOUT_MS),
    })

    if (isTransientR2UploadStatus(uploadResponse.status)) {
      const responseText = await uploadResponse.text().catch(() => "")
      throw new Error(
        `Transient R2 upload failure for ${object.objectKey}: HTTP ${uploadResponse.status}${responseText ? ` ${responseText}` : ""}`,
      )
    }

    return uploadResponse
  })

  if (!response.ok) {
    const responseText = await response.text().catch(() => "")
    throw new Error(
      `R2 upload failed for ${object.objectKey}: HTTP ${response.status}${responseText ? ` ${responseText}` : ""}`,
    )
  }
}

/**
 * @param {number} status
 */
export function isTransientR2UploadStatus(status) {
  return status === 429 || status >= 500
}

/**
 * @param {string | undefined} value
 */
function cleanEnv(value) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

/**
 * @param {Array<[name: string, value: string | undefined]>} values
 */
function missingValues(values) {
  return values.filter(([, value]) => !value).map(([name]) => name)
}

/**
 * @param {string | undefined} value
 */
function normalizePublicBaseUrl(value) {
  const cleaned = cleanEnv(value)
  return cleaned?.replace(/\/+$/, "")
}

/**
 * @param {string} value
 */
function normalizeR2ObjectPrefix(value) {
  const normalized = normalizeR2ObjectKey(value)
  if (!normalized) throw new Error("R2 object prefix cannot be empty.")
  return normalized
}

/**
 * @param {string} value
 */
function normalizeR2ObjectKey(value) {
  const normalized = value.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").replace(/\/+/g, "/")
  if (!normalized || normalized.split("/").some((part) => part === "." || part === "..")) {
    throw new Error(`Invalid R2 object key: ${value}`)
  }
  return normalized
}

/**
 * @param {{ normalizedPrefix: string, defaultKey: string, leafName: string }} params
 */
function objectKeyForPrefix({ normalizedPrefix, defaultKey, leafName }) {
  if (normalizedPrefix === OBSERVABLE_STREAMS_R2_OBJECT_PREFIX) return defaultKey
  return `${normalizedPrefix}/${leafName}`
}

/**
 * @param {string} objectKey
 */
function encodeR2Path(objectKey) {
  return objectKey.split("/").map(encodeURIComponent).join("/")
}

/**
 * @param {Array<{ instrumentName: string, noteName: string, publicUrl: string }>} assets
 */
function buildSampleIndex(assets) {
  return assets.reduce((sampleIndex, asset) => {
    sampleIndex[asset.instrumentName] = sampleIndex[asset.instrumentName] ?? {}
    sampleIndex[asset.instrumentName][asset.noteName] = asset.publicUrl
    return sampleIndex
  }, {})
}

/**
 * @param {{ kind: string, objectKey: string, publicUrl: string, value: unknown, cacheControl: string }} params
 */
function createJsonUploadObject({ kind, objectKey, publicUrl, value, cacheControl }) {
  return {
    kind,
    objectKey,
    publicUrl,
    contentType: "application/json; charset=utf-8",
    cacheControl,
    body: `${JSON.stringify(value, null, 2)}\n`,
  }
}

/**
 * @param {string | Uint8Array} value
 */
function toUint8Array(value) {
  if (value instanceof Uint8Array) return value
  return textEncoder.encode(value)
}

/**
 * @param {number} ms
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * @param {unknown} error
 */
function errorMessage(error) {
  return error instanceof Error ? error.message : String(error)
}

/**
 * @template T
 * @param {string} label
 * @param {number} attempts
 * @param {() => Promise<T>} fn
 */
async function retry(label, attempts, fn) {
  let lastError
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

/**
 * @param {string | Uint8Array} value
 */
function sha256Hex(value) {
  return createHash("sha256").update(value).digest("hex")
}

/**
 * @param {string | Uint8Array} key
 * @param {string} value
 */
function hmac(key, value) {
  return createHmac("sha256", key).update(value).digest()
}

/**
 * @param {Date} [date]
 */
function amzTimestamp(date = new Date()) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "")
}

/**
 * @param {Record<string, string>} headers
 */
function canonicalizeHeaders(headers) {
  const keys = Object.keys(headers).map((key) => key.toLowerCase()).sort()
  const canonicalHeaders = keys
    .map((key) => `${key}:${headers[key].trim().replace(/\s+/g, " ")}`)
    .join("\n")

  return {
    canonicalHeaders: `${canonicalHeaders}\n`,
    signedHeaders: keys.join(";"),
  }
}

/**
 * @param {{
 *   accessKeyId: string,
 *   secretAccessKey: string,
 *   method: "PUT",
 *   canonicalUri: string,
 *   headers: Record<string, string>,
 *   payloadHash: string,
 *   amzDate: string,
 * }} params
 */
function authorizationHeader({
  accessKeyId,
  secretAccessKey,
  method,
  canonicalUri,
  headers,
  payloadHash,
  amzDate,
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
