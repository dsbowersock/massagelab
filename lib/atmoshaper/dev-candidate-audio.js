// @ts-check

import { createHash } from "node:crypto"
import { readFile, realpath, stat } from "node:fs/promises"
import { isAbsolute, relative, resolve } from "node:path"

const SOURCE_ID_PATTERN = /^[a-f0-9]{64}$/
const MIME_TYPES = new Map([
  [".aac", "audio/aac"],
  [".aif", "audio/aiff"],
  [".aiff", "audio/aiff"],
  [".flac", "audio/flac"],
  [".m4a", "audio/mp4"],
  [".mp3", "audio/mpeg"],
  [".ogg", "audio/ogg"],
  [".wav", "audio/wav"],
])

/**
 * Resolves one manifest-listed recording against the server-owned source root.
 * Canonical containment, byte size, and scanned checksum are rechecked per request.
 * The returned bytes are the same in-memory snapshot that passed the checksum,
 * so callers never need to reopen a mutable filesystem path.
 * @param {{ sourceId: unknown, manifest: unknown, sourceRoot: unknown, nodeEnv: string | undefined }} input
 */
export async function resolveDevCandidateAudioSource(input) {
  if (input.nodeEnv === "production") throw new Error("Development candidate audio is disabled in production")
  if (typeof input.sourceId !== "string" || !SOURCE_ID_PATTERN.test(input.sourceId)) {
    throw new Error("Unknown development candidate source id")
  }
  if (typeof input.sourceRoot !== "string" || input.sourceRoot.trim() === "") {
    throw new Error("The server-owned Signature Sounds root is not configured")
  }
  const manifest = requireRecord(input.manifest, "Development candidate manifest")
  if (!Array.isArray(manifest.sources)) throw new Error("Development candidate manifest sources must be an array")
  const matches = manifest.sources.filter((candidate) => (
    candidate !== null && typeof candidate === "object" && candidate.sourceId === input.sourceId
  ))
  if (matches.length !== 1) throw new Error("Unknown or duplicate development candidate source in manifest")
  const source = requireRecord(matches[0], "Development candidate source")
  const relativePath = requireSafeRelativePath(source.relativePath)
  const extension = typeof source.extension === "string" ? source.extension.toLowerCase() : ""
  const mimeType = MIME_TYPES.get(extension)
  if (mimeType === undefined || !relativePath.toLowerCase().endsWith(extension)) {
    throw new Error("Development candidate source extension is invalid")
  }
  if (!Number.isSafeInteger(source.byteSize) || source.byteSize < 0) {
    throw new Error("Development candidate source inventory size is invalid")
  }
  const sourceSha256 = requireSha256(source.sha256, "Development candidate source inventory checksum")

  let canonicalRoot
  let canonicalSource
  try {
    canonicalRoot = await realpath(resolve(input.sourceRoot))
    canonicalSource = await realpath(resolve(canonicalRoot, ...relativePath.split("/")))
  } catch {
    throw new Error("Development candidate source path could not be resolved")
  }
  assertInside(canonicalRoot, canonicalSource)
  const sourceStat = await stat(canonicalSource)
  if (!sourceStat.isFile()) throw new Error("Development candidate source must be a file")
  if (sourceStat.size !== source.byteSize) {
    throw new Error("Development candidate source size changed from the scanned inventory")
  }
  const bytes = await readSourceBytes(canonicalSource)
  if (bytes.byteLength !== source.byteSize) {
    throw new Error("Development candidate source size changed from the scanned inventory")
  }
  if (createHash("sha256").update(bytes).digest("hex") !== sourceSha256) {
    throw new Error("Development candidate source content changed from the scanned inventory")
  }
  return { bytes, byteSize: source.byteSize, mimeType }
}

/** Reads one exact source snapshot for checksum verification and response delivery. @param {string} sourcePath */
async function readSourceBytes(sourcePath) {
  try {
    return await readFile(sourcePath)
  } catch {
    throw new Error("Development candidate source content could not be verified")
  }
}

/**
 * Parses one RFC 9110-style byte range. Multiple ranges are rejected because
 * this local endpoint deliberately serves only one bounded stream at a time.
 * @param {string | null | undefined} rangeHeader
 * @param {number} byteSize
 */
export function parseDevCandidateByteRange(rangeHeader, byteSize) {
  if (!Number.isSafeInteger(byteSize) || byteSize <= 0) throw new RangeError("Audio byte size must be positive")
  if (rangeHeader === undefined || rangeHeader === null) return { start: 0, end: byteSize - 1, status: 200 }
  if (typeof rangeHeader !== "string" || rangeHeader.includes(",")) throw new RangeError("Only one audio byte range is supported")
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader)
  if (match === null || (match[1] === "" && match[2] === "")) throw new RangeError("Invalid audio byte range")
  let start
  let end
  if (match[1] === "") {
    const suffixLength = Number(match[2])
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) throw new RangeError("Invalid audio suffix range")
    start = Math.max(0, byteSize - suffixLength)
    end = byteSize - 1
  } else {
    start = Number(match[1])
    end = match[2] === "" ? byteSize - 1 : Number(match[2])
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start) {
      throw new RangeError("Invalid audio byte range bounds")
    }
    if (start >= byteSize) throw new RangeError("Audio byte range is unsatisfiable")
    end = Math.min(end, byteSize - 1)
  }
  return { start, end, status: 206 }
}

/** @param {unknown} value */
function requireSafeRelativePath(value) {
  if (typeof value !== "string" || value.trim() === "" || value !== value.trim()) {
    throw new Error("Development candidate source requires a relative path")
  }
  const parts = value.split("/")
  if (value.includes("\\") || value.startsWith("/") || /^[a-z]:/i.test(value) || parts.some((part) => part === "" || part === "." || part === "..")) {
    throw new Error("Development candidate source path must remain relative")
  }
  return value
}

/** @param {string} rootPath @param {string} sourcePath */
function assertInside(rootPath, sourcePath) {
  const rootRelative = relative(rootPath, sourcePath)
  if (rootRelative === "" || rootRelative.startsWith("..") || isAbsolute(rootRelative)) {
    throw new Error("Development candidate source path resolves outside its configured root")
  }
}

/** @param {unknown} value @param {string} label */
function requireSha256(value, label) {
  if (typeof value !== "string" || !SOURCE_ID_PATTERN.test(value)) {
    throw new Error(`${label} is invalid`)
  }
  return value
}

/** @param {unknown} value @param {string} label */
function requireRecord(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`)
  return /** @type {Record<string, any>} */ (value)
}
