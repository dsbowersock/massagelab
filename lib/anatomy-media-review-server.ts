import { createHash, createHmac } from "node:crypto"

type R2Env = {
  accountId?: string
  accessKeyId?: string
  secretAccessKey?: string
  bucket: string
  endpoint?: string
  publicBaseUrl?: string
  cacheControl: string
}

export type UploadedAnatomyMedia = {
  remoteUrl?: string
  storagePath: string
  bytes: number
  contentType: string
}

const DEFAULT_BUCKET = "massagelab-anatomy-media"
const DEFAULT_CACHE_CONTROL = "public, max-age=31536000, immutable"
const SERVICE = "s3"
const REGION = "auto"
const SOURCE_FETCH_TIMEOUT_MS = 120_000
const R2_UPLOAD_TIMEOUT_MS = 60_000

function cleanEnv(value: string | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}

function readR2Env(): R2Env {
  return {
    accountId: cleanEnv(process.env.CLOUDFLARE_ACCOUNT_ID),
    accessKeyId: cleanEnv(process.env.R2_ACCESS_KEY_ID),
    secretAccessKey: cleanEnv(process.env.R2_SECRET_ACCESS_KEY),
    bucket: cleanEnv(process.env.MASSAGELAB_R2_BUCKET) ?? DEFAULT_BUCKET,
    endpoint: cleanEnv(process.env.MASSAGELAB_R2_ENDPOINT),
    publicBaseUrl: cleanEnv(process.env.MASSAGELAB_R2_PUBLIC_BASE_URL)?.replace(/\/+$/, ""),
    cacheControl: cleanEnv(process.env.MASSAGELAB_R2_CACHE_CONTROL) ?? DEFAULT_CACHE_CONTROL,
  }
}

function requireUploadEnv(env: R2Env) {
  const missing = [
    ["CLOUDFLARE_ACCOUNT_ID or MASSAGELAB_R2_ENDPOINT", env.endpoint ?? env.accountId],
    ["R2_ACCESS_KEY_ID", env.accessKeyId],
    ["R2_SECRET_ACCESS_KEY", env.secretAccessKey],
    ["MASSAGELAB_R2_BUCKET", env.bucket],
  ].filter(([, value]) => !value).map(([name]) => name)

  if (missing.length > 0) {
    throw new Error(`BodyParts3D import requires R2 upload configuration: ${missing.join(", ")}`)
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

function publicUrlForPath(env: R2Env, storagePath: string) {
  if (!env.publicBaseUrl) return undefined
  return `${env.publicBaseUrl}/${encodeStoragePath(storagePath)}`
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

export async function uploadAnatomyMediaToR2({
  sourceUrl,
  storagePath,
}: {
  sourceUrl: string
  storagePath: string
}): Promise<UploadedAnatomyMedia> {
  const env = readR2Env()
  requireUploadEnv(env)

  const sourceResponse = await fetch(sourceUrl, { signal: AbortSignal.timeout(SOURCE_FETCH_TIMEOUT_MS) })
  if (!sourceResponse.ok) {
    throw new Error(`Failed to fetch BodyParts3D image: HTTP ${sourceResponse.status}`)
  }

  const bytes = new Uint8Array(await sourceResponse.arrayBuffer())
  const contentType = sourceResponse.headers.get("content-type")?.split(";")[0]?.trim() || "image/png"
  const endpoint = endpointForEnv(env)
  const endpointUrl = new URL(endpoint)
  const canonicalUri = `/${encodeURIComponent(env.bucket)}/${encodeStoragePath(storagePath)}`
  const objectUrl = `${endpoint}${canonicalUri}`
  const payloadHash = sha256Hex(bytes)
  const amzDate = amzTimestamp()
  const headers = {
    "cache-control": env.cacheControl,
    "content-type": contentType,
    host: endpointUrl.host,
    "x-amz-content-sha256": payloadHash,
    "x-amz-date": amzDate,
  }

  if (!env.accessKeyId || !env.secretAccessKey) throw new Error("R2 API keys are required for upload.")

  const response = await fetch(objectUrl, {
    method: "PUT",
    headers: {
      Authorization: authorizationHeader({
        accessKeyId: env.accessKeyId,
        secretAccessKey: env.secretAccessKey,
        method: "PUT",
        canonicalUri,
        headers,
        payloadHash,
        amzDate,
      }),
      "Cache-Control": headers["cache-control"],
      "Content-Type": headers["content-type"],
      Host: headers.host,
      "x-amz-content-sha256": headers["x-amz-content-sha256"],
      "x-amz-date": headers["x-amz-date"],
    },
    body: bytes,
    signal: AbortSignal.timeout(R2_UPLOAD_TIMEOUT_MS),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => "")
    throw new Error(`R2 upload failed: HTTP ${response.status}${body ? ` ${body}` : ""}`)
  }

  return {
    remoteUrl: publicUrlForPath(env, storagePath),
    storagePath,
    bytes: bytes.byteLength,
    contentType,
  }
}
