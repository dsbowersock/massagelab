import { readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { FULL_CATALOG_BACKGROUND_IDS } from "./preview-recipes.mjs"
import {
  APPROVED_CATALOG_RELEASE_CONTRACT,
  CATALOG_PREVIEW_ASPECTS,
  CATALOG_PREVIEW_CODECS,
  CATALOG_PREVIEW_QUALITIES,
} from "./preview-release-contract.mjs"

export const PUBLISHED_RUNTIME_SCHEMA_VERSION = 1
export const PUBLISHED_CATALOG_REVISION = APPROVED_CATALOG_RELEASE_CONTRACT.catalogRevision
export const PUBLISHED_CATALOG_ENTRY_COUNT = APPROVED_CATALOG_RELEASE_CONTRACT.entryCount
export const PUBLISHED_CATALOG_ANIMATED_COUNT = APPROVED_CATALOG_RELEASE_CONTRACT.animatedCount
export const PUBLISHED_CATALOG_POSTER_ONLY_COUNT = APPROVED_CATALOG_RELEASE_CONTRACT.posterOnlyCount
export const PUBLISHED_CATALOG_RENDITION_COUNT = APPROVED_CATALOG_RELEASE_CONTRACT.renditionCount
export const PUBLISHED_CATALOG_POSTER_COUNT = APPROVED_CATALOG_RELEASE_CONTRACT.posterCount

const ASPECTS = CATALOG_PREVIEW_ASPECTS
const QUALITIES = CATALOG_PREVIEW_QUALITIES
const CODECS = CATALOG_PREVIEW_CODECS
const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
const approvedCatalogPath = path.join(repoRoot, "public/chimer/background-preview-catalog/index.json")
const publishedManifestPath = path.join(repoRoot, "data/background-preview-published-manifest.json")
const publishedModulePath = path.join(
  repoRoot,
  "components/backgrounds/backgroundPreviewPublishedManifest.ts",
)

/**
 * Derives the browser-safe lookup exclusively from the visually approved
 * schema-v3 catalog. Exact IDs and counts are release gates so a partial or
 * newly candidate catalog cannot silently become selectable runtime media.
 *
 * @param {unknown} catalog
 */
export function buildPublishedRuntimeManifest(catalog) {
  if (!catalog || typeof catalog !== "object" || Array.isArray(catalog)) {
    throw new Error("Published runtime generation requires a schema-v3 catalog object.")
  }
  if (catalog.schemaVersion !== 3) {
    throw new Error(`Published runtime generation requires schemaVersion 3, received ${String(catalog.schemaVersion)}.`)
  }
  if (catalog.catalogRevision !== PUBLISHED_CATALOG_REVISION) {
    throw new Error(
      `Published runtime generation requires ${PUBLISHED_CATALOG_REVISION}, received ${String(catalog.catalogRevision)}.`,
    )
  }
  if (!Array.isArray(catalog.entries) || catalog.entries.length !== PUBLISHED_CATALOG_ENTRY_COUNT) {
    throw new Error(
      `${PUBLISHED_CATALOG_REVISION} must contain exactly ${PUBLISHED_CATALOG_ENTRY_COUNT} entries.`,
    )
  }
  if (catalog.entries.some((entry) => entry?.reviewStatus !== "approved")) {
    throw new Error("Published runtime generation requires every entry to be approved.")
  }

  const animatedCount = catalog.entries.filter((entry) => entry?.mediaKind === "animated").length
  const posterOnlyCount = catalog.entries.filter((entry) => entry?.mediaKind === "poster-only").length
  const renditionCount = catalog.entries.reduce(
    (total, entry) => total + (Array.isArray(entry?.renditions) ? entry.renditions.length : 0),
    0,
  )
  const posterCount = catalog.entries.reduce(
    (total, entry) => total + (isRecord(entry?.posters) ? Object.keys(entry.posters).length : 0),
    0,
  )
  if (animatedCount !== PUBLISHED_CATALOG_ANIMATED_COUNT) {
    throw new Error(`${PUBLISHED_CATALOG_REVISION} must contain exactly ${PUBLISHED_CATALOG_ANIMATED_COUNT} animated entries.`)
  }
  if (posterOnlyCount !== PUBLISHED_CATALOG_POSTER_ONLY_COUNT) {
    throw new Error(`${PUBLISHED_CATALOG_REVISION} must contain exactly ${PUBLISHED_CATALOG_POSTER_ONLY_COUNT} poster-only entries.`)
  }
  if (renditionCount !== PUBLISHED_CATALOG_RENDITION_COUNT) {
    throw new Error(`${PUBLISHED_CATALOG_REVISION} must contain exactly ${PUBLISHED_CATALOG_RENDITION_COUNT.toLocaleString("en-US")} renditions.`)
  }
  if (posterCount !== PUBLISHED_CATALOG_POSTER_COUNT) {
    throw new Error(`${PUBLISHED_CATALOG_REVISION} must contain exactly ${PUBLISHED_CATALOG_POSTER_COUNT} posters.`)
  }

  const entriesById = new Map()
  for (const entry of catalog.entries) {
    if (!isRecord(entry) || typeof entry.backgroundId !== "string") {
      throw new Error("Every published catalog entry must have a stable backgroundId.")
    }
    if (entriesById.has(entry.backgroundId)) {
      throw new Error(`${entry.backgroundId}: duplicate published catalog entry.`)
    }
    entriesById.set(entry.backgroundId, entry)
  }

  const expectedIds = new Set(FULL_CATALOG_BACKGROUND_IDS)
  if (expectedIds.size !== PUBLISHED_CATALOG_ENTRY_COUNT) {
    throw new Error(`The full-catalog stable-ID contract must contain exactly ${PUBLISHED_CATALOG_ENTRY_COUNT} unique IDs.`)
  }
  for (const backgroundId of entriesById.keys()) {
    if (!expectedIds.has(backgroundId)) {
      throw new Error(`${backgroundId}: unknown published catalog background.`)
    }
  }
  for (const backgroundId of expectedIds) {
    if (!entriesById.has(backgroundId)) {
      throw new Error(`${backgroundId}: missing published catalog background.`)
    }
  }

  const entries = Object.fromEntries(FULL_CATALOG_BACKGROUND_IDS.map((backgroundId) => {
    const entry = entriesById.get(backgroundId)
    return [backgroundId, compactPublishedEntry(entry)]
  }))

  return {
    schemaVersion: PUBLISHED_RUNTIME_SCHEMA_VERSION,
    catalogRevision: PUBLISHED_CATALOG_REVISION,
    entries,
  }
}

/** @param {ReturnType<typeof buildPublishedRuntimeManifest>} manifest */
export function serializePublishedRuntimeManifest(manifest) {
  return `${JSON.stringify(manifest, null, 2)}\n`
}

/** Renders one generated string-literal union from its validation source. */
function renderStringUnion(values) {
  return values.map((value) => JSON.stringify(value)).join(" | ")
}

/** Renders the typed client-facing wrapper without duplicating the 84-entry lookup. */
export function renderPublishedRuntimeManifestModule() {
  return `/* Generated by scripts/chimer-preview-generation/published-runtime-manifest.mjs. */

import manifest from "../../data/background-preview-published-manifest.json" with { type: "json" }

export type BackgroundPreviewPublishedAspect = ${renderStringUnion(ASPECTS)}
export type BackgroundPreviewPublishedQuality = ${renderStringUnion(QUALITIES)}
export type BackgroundPreviewPublishedCodec = ${renderStringUnion(CODECS)}

export type BackgroundPreviewPublishedRendition = {
  readonly aspect: BackgroundPreviewPublishedAspect
  readonly quality: BackgroundPreviewPublishedQuality
  readonly codec: BackgroundPreviewPublishedCodec
  readonly url: string
  readonly mimeType: string
}

export type BackgroundPreviewPublishedEntry = {
  readonly backgroundId: string
  readonly mediaKind: "animated" | "poster-only"
  readonly loopBoundaryMs: number
  readonly posters: Readonly<Record<BackgroundPreviewPublishedAspect, string>>
  readonly renditions: readonly BackgroundPreviewPublishedRendition[]
}

export type BackgroundPreviewPublishedManifest = {
  readonly schemaVersion: ${PUBLISHED_RUNTIME_SCHEMA_VERSION}
  readonly catalogRevision: "${PUBLISHED_CATALOG_REVISION}"
  readonly entries: Readonly<Record<string, BackgroundPreviewPublishedEntry>>
}

/** Fails at module initialization if the generated JSON identity drifts. */
export function assertBackgroundPreviewPublishedManifestIdentity(value: unknown): void {
  if (typeof value !== "object" || value === null) {
    throw new Error(
      "Background preview published manifest must use schemaVersion ${PUBLISHED_RUNTIME_SCHEMA_VERSION} and catalogRevision ${PUBLISHED_CATALOG_REVISION}.",
    )
  }
  const candidate = value as { schemaVersion?: unknown; catalogRevision?: unknown }
  if (candidate.schemaVersion !== ${PUBLISHED_RUNTIME_SCHEMA_VERSION}
    || candidate.catalogRevision !== "${PUBLISHED_CATALOG_REVISION}") {
    throw new Error(
      "Background preview published manifest must use schemaVersion ${PUBLISHED_RUNTIME_SCHEMA_VERSION} and catalogRevision ${PUBLISHED_CATALOG_REVISION}.",
    )
  }
}

assertBackgroundPreviewPublishedManifestIdentity(manifest)

export const backgroundPreviewPublishedManifest = manifest as unknown as BackgroundPreviewPublishedManifest
`
}

/** @param {unknown} value */
function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

/** @param {Record<string, any>} entry */
function compactPublishedEntry(entry) {
  const isAnimated = entry.mediaKind === "animated"
  if (!isAnimated && entry.mediaKind !== "poster-only") {
    throw new Error(`${entry.backgroundId}: unsupported mediaKind ${String(entry.mediaKind)}.`)
  }
  if (!Number.isSafeInteger(entry.loopBoundaryMs) || (isAnimated ? entry.loopBoundaryMs <= 0 : entry.loopBoundaryMs !== 0)) {
    throw new Error(`${entry.backgroundId}: invalid loop boundary for ${entry.mediaKind} media.`)
  }
  if (!isRecord(entry.posters) || Object.keys(entry.posters).length !== ASPECTS.length) {
    throw new Error(`${entry.backgroundId}: published runtime requires exactly three posters.`)
  }

  const posters = Object.fromEntries(ASPECTS.map((aspect) => {
    const poster = entry.posters[aspect]
    if (!isRecord(poster)) throw new Error(`${entry.backgroundId}: missing ${aspect} poster.`)
    return [aspect, assertRelativeMediaPath(poster.url, `${entry.backgroundId} ${aspect} poster`)]
  }))

  if (!Array.isArray(entry.renditions)) {
    throw new Error(`${entry.backgroundId}: renditions must be an array.`)
  }
  const expectedRenditionCount = isAnimated ? ASPECTS.length * QUALITIES.length * CODECS.length : 0
  if (entry.renditions.length !== expectedRenditionCount) {
    throw new Error(`${entry.backgroundId}: expected exactly ${expectedRenditionCount} runtime renditions.`)
  }

  const seenRenditions = new Set()
  const renditions = entry.renditions.map((rendition) => {
    if (!isRecord(rendition)
      || !ASPECTS.includes(rendition.aspect)
      || !QUALITIES.includes(rendition.quality)
      || !CODECS.includes(rendition.codec)) {
      throw new Error(`${entry.backgroundId}: invalid runtime rendition identity.`)
    }
    const identity = `${rendition.aspect}/${rendition.quality}/${rendition.codec}`
    if (seenRenditions.has(identity)) {
      throw new Error(`${entry.backgroundId}: duplicate ${identity} runtime rendition.`)
    }
    seenRenditions.add(identity)
    if (typeof rendition.mimeType !== "string" || !rendition.mimeType.startsWith("video/")) {
      throw new Error(`${entry.backgroundId}: ${identity} must include a video MIME type.`)
    }
    return {
      aspect: rendition.aspect,
      quality: rendition.quality,
      codec: rendition.codec,
      url: assertRelativeMediaPath(rendition.url, `${entry.backgroundId} ${identity}`),
      mimeType: rendition.mimeType,
    }
  })

  return {
    backgroundId: entry.backgroundId,
    mediaKind: entry.mediaKind,
    loopBoundaryMs: entry.loopBoundaryMs,
    posters,
    renditions,
  }
}

/** Prevents a source catalog path from escaping the configured runtime base. */
function assertRelativeMediaPath(value, label) {
  if (typeof value !== "string" || !value || value.includes("\\")
    || /^(?:[a-z][a-z0-9+.-]*:|\/\/|\/)/i.test(value)
    || value.includes("?") || value.includes("#")) {
    throw new Error(`${label}: runtime media URL must be a relative POSIX path.`)
  }
  const parts = value.split("/")
  if (parts.some((part) => !part || part === "." || part === "..")) {
    throw new Error(`${label}: runtime media URL must be a canonical relative POSIX path.`)
  }
  for (const part of parts) {
    let decodedPart
    try {
      decodedPart = decodeURIComponent(part)
    } catch {
      throw new Error(`${label}: runtime media URL contains invalid percent encoding.`)
    }
    if (decodedPart === "." || decodedPart === ".." || decodedPart.includes("/") || decodedPart.includes("\\")) {
      throw new Error(`${label}: runtime media URL must not contain traversal segments.`)
    }
  }
  return value
}

function generatePublishedRuntimeManifest() {
  const approvedCatalog = JSON.parse(readFileSync(approvedCatalogPath, "utf8"))
  const manifest = buildPublishedRuntimeManifest(approvedCatalog)
  writeFileSync(publishedManifestPath, serializePublishedRuntimeManifest(manifest), "utf8")
  writeFileSync(publishedModulePath, renderPublishedRuntimeManifestModule(), "utf8")
  process.stdout.write(
    `Generated ${Object.keys(manifest.entries).length} approved runtime entries from ${manifest.catalogRevision}.\n`,
  )
}

const directInvocation = process.argv[1]
  && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (directInvocation) generatePublishedRuntimeManifest()
