import { createHash } from "node:crypto"
import fs from "node:fs/promises"
import path from "node:path"

import { publicUrlForR2Object } from "../../lib/atmosphere/r2-sample-hosting.js"

export const CATALOG_R2_RELEASE_REVISION = "catalog-approved-1"
export const CATALOG_R2_RELEASE_PREFIX = "chimer/background-preview-catalog/catalog-approved-1"
export const CATALOG_R2_MEDIA_CACHE_CONTROL = "public, max-age=31536000, immutable"
export const CATALOG_R2_RELEASE_OBJECT_COUNT = 1_728
export const CATALOG_R2_RELEASE_TOTAL_BYTES = 862_078_635

const CONTENT_TYPES = Object.freeze({
  ".webm": "video/webm",
  ".mp4": "video/mp4",
  ".webp": "image/webp",
})
const POSTER_ASPECTS = Object.freeze(["landscape", "square", "vertical"])

/**
 * Builds the publish allowlist exclusively from schema-v3 rendition and poster
 * metadata. It intentionally never walks the catalog directory, so renderer
 * checkpoints, FFprobe output, and validation diagnostics cannot be uploaded.
 *
 * @param {unknown} catalog
 */
export function buildCatalogMediaAllowlist(catalog) {
  if (!catalog || typeof catalog !== "object" || Array.isArray(catalog)) {
    throw new Error("Catalog publication requires a schema-v3 catalog object.")
  }
  if (catalog.schemaVersion !== 3) {
    throw new Error(`Catalog publication requires schemaVersion 3, received ${String(catalog.schemaVersion)}.`)
  }
  if (catalog.catalogRevision !== CATALOG_R2_RELEASE_REVISION) {
    throw new Error(`Catalog publication requires ${CATALOG_R2_RELEASE_REVISION}, received ${String(catalog.catalogRevision)}.`)
  }
  if (!Array.isArray(catalog.entries) || catalog.entries.length === 0) {
    throw new Error("Catalog publication requires at least one catalog entry.")
  }

  const seenPaths = new Set()
  const media = []
  for (const [entryIndex, entry] of catalog.entries.entries()) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      throw new Error(`Catalog entry ${entryIndex} must be an object.`)
    }
    const entryLabel = entry.backgroundId ?? `entry ${entryIndex}`
    if (entry.reviewStatus !== "approved") {
      throw new Error(`${entryLabel}: catalog entry is not approved for publication.`)
    }
    if (!Array.isArray(entry.renditions)) {
      throw new Error(`${entryLabel}: catalog entry must include a renditions array.`)
    }
    if (!entry.posters || typeof entry.posters !== "object" || Array.isArray(entry.posters)) {
      throw new Error(`${entryLabel}: catalog entry must include poster metadata.`)
    }
    const posterAspects = Object.keys(entry.posters)
    if (posterAspects.length !== POSTER_ASPECTS.length
      || !POSTER_ASPECTS.every((aspect) => Object.hasOwn(entry.posters, aspect))) {
      throw new Error(`${entryLabel}: catalog entry requires exactly landscape, square, and vertical posters.`)
    }

    for (const [renditionIndex, rendition] of entry.renditions.entries()) {
      media.push(createCatalogMediaReference({
        descriptor: rendition,
        label: `${entryLabel} rendition ${renditionIndex}`,
        seenPaths,
      }))
    }
    for (const aspect of POSTER_ASPECTS) {
      const poster = entry.posters[aspect]
      media.push(createCatalogMediaReference({
        descriptor: poster,
        label: `${entryLabel} ${aspect} poster`,
        seenPaths,
      }))
    }
  }

  return media.sort((left, right) => left.sourceRelativePath.localeCompare(right.sourceRelativePath))
}

/**
 * Reads and hashes every catalog-referenced local file before an upload can
 * begin. The returned source paths are resolved from the catalog directory and
 * remain constrained below it even if future callers provide untrusted input.
 *
 * @param {{ catalogDir: string, media: readonly CatalogMediaReference[] }} params
 * @returns {Promise<CatalogMediaReferenceWithPath[]>}
 */
export async function validateCatalogMediaFiles({ catalogDir, media }) {
  const resolvedCatalogDir = path.resolve(catalogDir)
  const validatedMedia = []
  for (const reference of media) {
    const sourcePath = resolveCatalogMediaPath(resolvedCatalogDir, reference.sourceRelativePath)
    const stat = await fs.stat(sourcePath).catch((error) => {
      if (error && error.code === "ENOENT") return null
      throw error
    })
    if (!stat || !stat.isFile()) {
      throw new Error(`${reference.sourceRelativePath}: missing local media file.`)
    }
    if (stat.size !== reference.bytes) {
      throw new Error(`${reference.sourceRelativePath}: byte mismatch (catalog ${reference.bytes}, local ${stat.size}).`)
    }
    const validatedReference = { ...reference, sourcePath }
    await readCatalogMediaSnapshot(validatedReference)
    validatedMedia.push(validatedReference)
  }
  return validatedMedia
}

/**
 * Reads a catalog media file into an in-memory byte snapshot and verifies that
 * exact snapshot against the approved manifest. Live upload callers must send
 * the returned bytes rather than rereading the source path after preflight.
 *
 * @param {CatalogMediaReferenceWithPath} reference
 * @returns {Promise<Buffer>}
 */
export async function readCatalogMediaSnapshot(reference) {
  const body = await fs.readFile(reference.sourcePath).catch((error) => {
    if (error && error.code === "ENOENT") {
      throw new Error(`${reference.sourceRelativePath}: missing local media file.`)
    }
    throw error
  })
  if (body.length !== reference.bytes) {
    throw new Error(`${reference.sourceRelativePath}: byte mismatch (catalog ${reference.bytes}, local ${body.length}).`)
  }
  const actualSha256 = createHash("sha256").update(body).digest("hex")
  if (actualSha256 !== reference.sha256) {
    throw new Error(`${reference.sourceRelativePath}: SHA-256 mismatch.`)
  }
  return body
}

/**
 * Maps a validated catalog allowlist to immutable R2 objects below the one
 * approved release prefix. There is deliberately no object-prefix argument.
 *
 * @param {{ media: readonly CatalogMediaReference[], publicBaseUrl?: string }} params
 */
export function createCatalogR2Objects({ media, publicBaseUrl }) {
  return media.map((reference) => {
    const objectKey = `${CATALOG_R2_RELEASE_PREFIX}/${reference.sourceRelativePath}`
    return {
      ...reference,
      objectKey,
      publicUrl: publicBaseUrl ? publicUrlForR2Object(publicBaseUrl, objectKey) : null,
      contentType: reference.contentType,
      cacheControl: CATALOG_R2_MEDIA_CACHE_CONTROL,
    }
  })
}

/**
 * Loads the approved local catalog, validates the immutable release contract,
 * then verifies every referenced local file. Callers receive no directory-wide
 * file list, preventing incidental diagnostic or generation artifacts from
 * entering an upload plan.
 *
 * @param {{ catalogPath: string, publicBaseUrl?: string }} params
 */
export async function loadCatalogR2PublicationPlan({ catalogPath, publicBaseUrl }) {
  const resolvedCatalogPath = path.resolve(catalogPath)
  const catalogDir = path.dirname(resolvedCatalogPath)
  const catalog = await readCatalog(resolvedCatalogPath)
  const media = buildCatalogMediaAllowlist(catalog)
  const totalBytes = media.reduce((total, reference) => total + reference.bytes, 0)

  if (media.length !== CATALOG_R2_RELEASE_OBJECT_COUNT) {
    throw new Error(
      `${CATALOG_R2_RELEASE_REVISION} must reference exactly ${CATALOG_R2_RELEASE_OBJECT_COUNT} objects; found ${media.length}.`,
    )
  }
  if (totalBytes !== CATALOG_R2_RELEASE_TOTAL_BYTES) {
    throw new Error(
      `${CATALOG_R2_RELEASE_REVISION} must total exactly ${CATALOG_R2_RELEASE_TOTAL_BYTES} bytes; found ${totalBytes}.`,
    )
  }

  const validatedMedia = await validateCatalogMediaFiles({ catalogDir, media })
  const objects = createCatalogR2Objects({ media: validatedMedia, publicBaseUrl })
  return {
    catalogPath: resolvedCatalogPath,
    catalogDir,
    catalogRevision: catalog.catalogRevision,
    objectPrefix: CATALOG_R2_RELEASE_PREFIX,
    objects,
    objectCount: objects.length,
    totalBytes,
  }
}

/**
 * @param {{ descriptor: unknown, label: string, seenPaths: Set<string> }} params
 * @returns {CatalogMediaReference}
 */
function createCatalogMediaReference({ descriptor, label, seenPaths }) {
  if (!descriptor || typeof descriptor !== "object" || Array.isArray(descriptor)) {
    throw new Error(`${label}: media metadata must be an object.`)
  }
  const sourceRelativePath = normalizeCatalogRelativePath(descriptor.url, label)
  if (seenPaths.has(sourceRelativePath)) {
    throw new Error(`${label}: duplicate media path ${sourceRelativePath}.`)
  }
  seenPaths.add(sourceRelativePath)

  const extension = path.posix.extname(sourceRelativePath)
  const contentType = CONTENT_TYPES[extension]
  if (!contentType) {
    throw new Error(`${label}: unsupported extension ${extension || "(none)"}.`)
  }
  if (!Number.isSafeInteger(descriptor.bytes) || descriptor.bytes <= 0) {
    throw new Error(`${label}: media bytes must be a positive safe integer.`)
  }
  if (typeof descriptor.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(descriptor.sha256)) {
    throw new Error(`${label}: media SHA-256 must be a lowercase 64-character hex digest.`)
  }

  return {
    sourceRelativePath,
    bytes: descriptor.bytes,
    sha256: descriptor.sha256,
    contentType,
  }
}

/**
 * Enforces the portable, canonical relative paths used as both local catalog
 * references and immutable R2 object-key suffixes.
 *
 * @param {unknown} value
 * @param {string} label
 */
function normalizeCatalogRelativePath(value, label) {
  if (typeof value !== "string" || !value) {
    throw new Error(`${label}: media URL must be a non-empty relative POSIX path.`)
  }
  if (value.includes("\\")) {
    throw new Error(`${label}: media URL must not contain backslashes.`)
  }
  if (/^(?:[a-z][a-z0-9+.-]*:|\/\/|\/)/i.test(value)) {
    throw new Error(`${label}: media URL must be a relative POSIX path.`)
  }
  if (value.includes("?") || value.includes("#")) {
    throw new Error(`${label}: media URL must not include a query string or fragment.`)
  }

  const parts = value.split("/")
  if (parts.some((part) => part === "." || part === "..")) {
    throw new Error(`${label}: media URL must not contain traversal segments.`)
  }
  if (parts.some((part) => !part)) {
    throw new Error(`${label}: media URL must be a canonical relative POSIX path.`)
  }
  for (const part of parts) {
    let decodedPart
    try {
      decodedPart = decodeURIComponent(part)
    } catch {
      throw new Error(`${label}: media URL contains invalid percent encoding.`)
    }
    if (decodedPart === "." || decodedPart === ".." || decodedPart.includes("/") || decodedPart.includes("\\")) {
      throw new Error(`${label}: media URL must not contain traversal segments.`)
    }
  }
  return value
}

/**
 * @param {string} catalogDir
 * @param {string} sourceRelativePath
 */
function resolveCatalogMediaPath(catalogDir, sourceRelativePath) {
  const sourcePath = path.resolve(catalogDir, ...sourceRelativePath.split("/"))
  const relativeToCatalog = path.relative(catalogDir, sourcePath)
  if (!relativeToCatalog
    || relativeToCatalog === ".."
    || relativeToCatalog.startsWith(`..${path.sep}`)
    || path.isAbsolute(relativeToCatalog)) {
    throw new Error(`${sourceRelativePath}: local media path escapes the catalog directory.`)
  }
  return sourcePath
}

/**
 * @param {string} catalogPath
 */
async function readCatalog(catalogPath) {
  let source
  try {
    source = await fs.readFile(catalogPath, "utf8")
  } catch (error) {
    if (error && error.code === "ENOENT") {
      throw new Error(`Catalog manifest is missing: ${catalogPath}`)
    }
    throw error
  }
  try {
    return JSON.parse(source)
  } catch (error) {
    throw new Error(`Catalog manifest is not valid JSON: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * @typedef {{ sourceRelativePath: string, bytes: number, sha256: string, contentType: string }} CatalogMediaReference
 */

/**
 * @typedef {CatalogMediaReference & { sourcePath: string }} CatalogMediaReferenceWithPath
 */
