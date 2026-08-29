const DEFAULT_MAX_JSON_BYTES = 4096

type TrustedJsonResult =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; code: "UNTRUSTED_REQUEST" | "INVALID_REQUEST" }

/**
 * Parses a small account-security JSON object only after exact browser
 * same-origin evidence is established from caller-owned configuration.
 * Request headers never expand the trusted origin and no metadata-free path
 * is accepted for these state-changing browser operations.
 */
export async function parseTrustedAccountSecurityJson<T extends Record<string, unknown>>(input: {
  request: Request
  expectedSiteUrl: string
  allowedKeys: readonly string[]
  maxBytes?: number
}): Promise<TrustedJsonResult> {
  const expectedOrigin = configuredWebOrigin(input.expectedSiteUrl)
  const requestOrigin = requestUrlOrigin(input.request)
  const suppliedOrigin = input.request.headers.get("origin")

  if (
    !expectedOrigin
    || requestOrigin !== expectedOrigin
    || suppliedOrigin !== expectedOrigin
    || input.request.headers.get("sec-fetch-site") !== "same-origin"
  ) {
    return { ok: false, code: "UNTRUSTED_REQUEST" }
  }

  const mediaType = (input.request.headers.get("content-type") ?? "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase()
  if (mediaType !== "application/json") {
    return { ok: false, code: "INVALID_REQUEST" }
  }

  const maxBytes = input.maxBytes ?? DEFAULT_MAX_JSON_BYTES
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1 || maxBytes > DEFAULT_MAX_JSON_BYTES) {
    return { ok: false, code: "INVALID_REQUEST" }
  }

  const allowedKeys = new Set(input.allowedKeys)
  if (
    allowedKeys.size !== input.allowedKeys.length
    || input.allowedKeys.some((key) => typeof key !== "string" || key.length === 0)
  ) {
    return { ok: false, code: "INVALID_REQUEST" }
  }

  const serialized = await readBoundedUtf8(input.request, maxBytes)
  if (serialized === null) return { ok: false, code: "INVALID_REQUEST" }

  let body: unknown
  try {
    body = JSON.parse(serialized)
  } catch {
    return { ok: false, code: "INVALID_REQUEST" }
  }

  if (!isJsonObject(body)) return { ok: false, code: "INVALID_REQUEST" }
  const keys = Object.keys(body)
  if (
    keys.length !== allowedKeys.size
    || keys.some((key) => !allowedKeys.has(key))
    || input.allowedKeys.some((key) => !Object.hasOwn(body, key))
  ) {
    return { ok: false, code: "INVALID_REQUEST" }
  }

  return { ok: true, body: body as T }
}

/** Returns the shared private-cache policy for every account-security JSON response. */
export function noStoreJsonHeaders(): Record<string, string> {
  return {
    "Cache-Control": "private, no-store",
    Pragma: "no-cache",
  }
}

function configuredWebOrigin(value: string): string {
  try {
    const configuredUrl = new URL(value)
    return configuredUrl.protocol === "http:" || configuredUrl.protocol === "https:"
      ? configuredUrl.origin
      : ""
  } catch {
    return ""
  }
}

function requestUrlOrigin(request: Request): string {
  try {
    return new URL(request.url).origin
  } catch {
    return ""
  }
}

async function readBoundedUtf8(request: Request, maxBytes: number): Promise<string | null> {
  const reader = request.body?.getReader()
  if (!reader) return ""

  const chunks: Uint8Array[] = []
  let totalBytes = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      totalBytes += value.byteLength
      if (totalBytes > maxBytes) {
        await reader.cancel().catch(() => undefined)
        return null
      }
      chunks.push(value)
    }
  } catch {
    return null
  } finally {
    reader.releaseLock()
  }

  const bytes = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes)
  } catch {
    return null
  }
}

function isJsonObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}
