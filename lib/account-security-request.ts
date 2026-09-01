const DEFAULT_MAX_JSON_BYTES = 4096

type TrustedJsonResult =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; code: "UNTRUSTED_REQUEST" | "INVALID_REQUEST" }

type BoundedJsonResult =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; code: "INVALID_REQUEST" }

type ExactKeyContract =
  | { allowedKeys: readonly string[]; allowedKeySets?: never }
  | { allowedKeys?: never; allowedKeySets: readonly (readonly string[])[] }

/**
 * Parses a small account-security JSON object only after exact browser
 * same-origin evidence is established from caller-owned configuration.
 * Request headers never expand the trusted origin and no metadata-free path
 * is accepted for these state-changing browser operations.
 */
export async function parseTrustedAccountSecurityJson(input: {
  request: Request
  expectedSiteUrl: string
  maxBytes?: number
} & ExactKeyContract): Promise<TrustedJsonResult> {
  if (!hasTrustedAccountSecurityProvenance(input.request, input.expectedSiteUrl)) {
    return { ok: false, code: "UNTRUSTED_REQUEST" }
  }

  const parsed = await parseBoundedAccountSecurityJson({
    request: input.request,
    maxBytes: input.maxBytes,
  })
  if (!parsed.ok) return parsed

  return validateTrustedAccountSecurityJson({
    request: input.request,
    expectedSiteUrl: input.expectedSiteUrl,
    body: parsed.body,
    ...exactKeyContract(input),
  })
}

/** Reads one small JSON object without applying purpose-specific provenance. */
export async function parseBoundedAccountSecurityJson(input: {
  request: Request
  maxBytes?: number
}): Promise<BoundedJsonResult> {
  const mediaType = (input.request.headers.get("content-type") ?? "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase()
  if (mediaType !== "application/json") {
    return { ok: false, code: "INVALID_REQUEST" }
  }

  const requestedMaxBytes = input.maxBytes ?? DEFAULT_MAX_JSON_BYTES
  if (!Number.isSafeInteger(requestedMaxBytes) || requestedMaxBytes < 1) {
    return { ok: false, code: "INVALID_REQUEST" }
  }
  const maxBytes = Math.min(requestedMaxBytes, DEFAULT_MAX_JSON_BYTES)

  const serialized = await readBoundedUtf8(input.request, maxBytes)
  if (serialized === null) return { ok: false, code: "INVALID_REQUEST" }

  let body: unknown
  try {
    body = JSON.parse(serialized)
  } catch {
    return { ok: false, code: "INVALID_REQUEST" }
  }

  return isJsonObject(body)
    ? { ok: true, body }
    : { ok: false, code: "INVALID_REQUEST" }
}

/** Validates trusted browser provenance and one of the caller's exact body shapes. */
export function validateTrustedAccountSecurityJson(input: {
  request: Request
  expectedSiteUrl: string
  body: Record<string, unknown>
} & ExactKeyContract): TrustedJsonResult {
  if (!hasTrustedAccountSecurityProvenance(input.request, input.expectedSiteUrl)) {
    return { ok: false, code: "UNTRUSTED_REQUEST" }
  }

  const allowedKeySets = exactKeySets(input)
  if (!allowedKeySets) {
    return { ok: false, code: "INVALID_REQUEST" }
  }

  const keys = Object.keys(input.body)
  if (!allowedKeySets.some((allowedKeys) => (
    keys.length === allowedKeys.size
    && keys.every((key) => allowedKeys.has(key))
  ))) {
    return { ok: false, code: "INVALID_REQUEST" }
  }

  return { ok: true, body: input.body }
}

function hasTrustedAccountSecurityProvenance(request: Request, expectedSiteUrl: string) {
  const expectedOrigin = configuredWebOrigin(expectedSiteUrl)
  const requestOrigin = requestUrlOrigin(request)
  const suppliedOrigin = request.headers.get("origin")

  return Boolean(
    expectedOrigin
    && requestOrigin === expectedOrigin
    && suppliedOrigin === expectedOrigin
    && request.headers.get("sec-fetch-site") === "same-origin"
  )
}

function exactKeySets(input: ExactKeyContract): Array<Set<string>> | null {
  const keySets = "allowedKeys" in input && input.allowedKeys !== undefined
    ? [input.allowedKeys]
    : input.allowedKeySets
  if (
    !Array.isArray(keySets)
    || keySets.length === 0
    || keySets.some((keys) => (
      !Array.isArray(keys)
      || keys.length === 0
      || new Set(keys).size !== keys.length
      || keys.some((key) => typeof key !== "string" || key.length === 0)
    ))
  ) {
    return null
  }
  return keySets.map((keys) => new Set(keys))
}

function exactKeyContract(input: ExactKeyContract): ExactKeyContract {
  return "allowedKeys" in input && input.allowedKeys !== undefined
    ? { allowedKeys: input.allowedKeys }
    : { allowedKeySets: input.allowedKeySets }
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
