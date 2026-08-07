import catalogJson from "../../public/chimer/background-preview-catalog/index.json" with { type: "json" }
import {
  CATALOG_PREVIEW_ASPECTS,
  CATALOG_PREVIEW_CODECS,
  CATALOG_PREVIEW_QUALITIES,
} from "../../scripts/chimer-preview-generation/preview-release-contract.mjs"

export { resolveCatalogPreviewUrl } from "./backgroundPreviewCatalogUrl.ts"

export type BackgroundPreviewCatalogAspect = (typeof CATALOG_PREVIEW_ASPECTS)[number]
export type BackgroundPreviewCatalogQuality = (typeof CATALOG_PREVIEW_QUALITIES)[number]
export type BackgroundPreviewCatalogCodec = (typeof CATALOG_PREVIEW_CODECS)[number]

export type BackgroundPreviewCatalogRendition = {
  aspect: BackgroundPreviewCatalogAspect
  quality: BackgroundPreviewCatalogQuality
  codec: BackgroundPreviewCatalogCodec
  url: string
  mimeType: string
  width: number
  height: number
  durationMs: number
  fps: number
  bytes: number
  sha256: string
}

export type BackgroundPreviewCatalogPoster = {
  url: string
  width: number
  height: number
  bytes: number
  sha256: string
}

type BackgroundPreviewCatalogEntryBase = {
  backgroundId: string
  recipeRevision: string
  reviewStatus: "candidate" | "approved"
  batchSlug: string
  posters: Record<BackgroundPreviewCatalogAspect, BackgroundPreviewCatalogPoster>
}

export type BackgroundPreviewCatalogEntry = BackgroundPreviewCatalogEntryBase & ({
  mediaKind: "animated"
  loopStrategy: "natural" | "crossfade"
  loopBoundaryMs: number
  renditions: readonly BackgroundPreviewCatalogRendition[]
} | {
  mediaKind: "poster-only"
  loopStrategy: "static"
  loopBoundaryMs: 0
  renditions: readonly []
})

export type BackgroundPreviewCatalogManifest = {
  schemaVersion: 3
  catalogRevision: string
  entries: readonly BackgroundPreviewCatalogEntry[]
}

/** Makes accidental tuple widening a compile-time error in this TS consumer. */
function requireLiteralTuple<const Values extends readonly string[]>(
  values: string extends Values[number] ? never : Values,
): Values {
  return values
}

const catalogAspects = requireLiteralTuple(CATALOG_PREVIEW_ASPECTS)
const catalogQualities = requireLiteralTuple(CATALOG_PREVIEW_QUALITIES)
const catalogCodecs = requireLiteralTuple(CATALOG_PREVIEW_CODECS)
const expectedRenditionIdentities = catalogAspects.flatMap((aspect) =>
  catalogQualities.flatMap((quality) =>
    catalogCodecs.map((codec) => `${aspect}/${quality}/${codec}`)))
const renditionDescriptorKeys = [
  "aspect", "quality", "codec", "url", "mimeType", "width", "height",
  "durationMs", "fps", "bytes", "sha256",
] as const
const posterDescriptorKeys = ["url", "width", "height", "bytes", "sha256"] as const

function requireRecord(value: unknown, label: string): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`)
  }
}

function requireExactKeys(value: Record<string, unknown>, keys: readonly string[], label: string): void {
  const actualKeys = Object.keys(value)
  if (actualKeys.length !== keys.length || !keys.every((key) => Object.hasOwn(value, key))) {
    throw new Error(`${label} must contain exactly ${keys.join(", ")}.`)
  }
}

function requireNonemptyString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a nonempty string.`)
  return value
}

function requireEnum<T extends string>(value: unknown, supported: readonly T[], label: string): T {
  if (typeof value !== "string" || !supported.some((candidate) => candidate === value)) {
    throw new Error(`${label} is unsupported.`)
  }
  return value as T
}

function requirePositiveInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) <= 0) {
    throw new Error(`${label} must be a positive safe integer.`)
  }
  return value as number
}

function requireSha256(value: unknown, label: string): void {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/i.test(value)) {
    throw new Error(`${label} must be a SHA-256 hex digest.`)
  }
}

function requirePosterDescriptor(value: unknown, label: string): void {
  requireRecord(value, label)
  requireExactKeys(value, posterDescriptorKeys, label)
  requireNonemptyString(value.url, `${label} URL`)
  requirePositiveInteger(value.width, `${label} width`)
  requirePositiveInteger(value.height, `${label} height`)
  requirePositiveInteger(value.bytes, `${label} bytes`)
  requireSha256(value.sha256, `${label} sha256`)
}

function requireRenditionDescriptor(value: unknown, label: string): string {
  requireRecord(value, label)
  requireExactKeys(value, renditionDescriptorKeys, label)
  const aspect = requireEnum(value.aspect, catalogAspects, `${label} aspect`)
  const quality = requireEnum(value.quality, catalogQualities, `${label} quality`)
  const codec = requireEnum(value.codec, catalogCodecs, `${label} codec`)
  requireNonemptyString(value.url, `${label} URL`)
  const mimeType = requireNonemptyString(value.mimeType, `${label} MIME type`)
  const mimeMatchesCodec = codec === "vp9"
    ? mimeType === "video/webm; codecs=vp9"
    : /^video\/mp4; codecs=avc1\.[a-f0-9]{6}$/i.test(mimeType)
  if (!mimeMatchesCodec) throw new Error(`${label} MIME type is unsupported for ${codec}.`)
  requirePositiveInteger(value.width, `${label} width`)
  requirePositiveInteger(value.height, `${label} height`)
  requirePositiveInteger(value.durationMs, `${label} durationMs`)
  requirePositiveInteger(value.fps, `${label} fps`)
  requirePositiveInteger(value.bytes, `${label} bytes`)
  requireSha256(value.sha256, `${label} sha256`)
  return `${aspect}/${quality}/${codec}`
}

/** Fail closed if checked-in local review metadata drifts from schema v3. */
export function assertCatalogManifest(value: unknown): asserts value is BackgroundPreviewCatalogManifest {
  requireRecord(value, "Background preview catalog")
  const manifest = value
  if (manifest.schemaVersion !== 3) throw new Error("Background preview catalog must use schema version 3.")
  requireNonemptyString(manifest.catalogRevision, "Background preview catalog revision")
  if (!Array.isArray(manifest.entries)) throw new Error("Background preview catalog entries must be an array.")
  const ids = new Set<string>()
  for (const [entryIndex, rawEntry] of manifest.entries.entries()) {
    requireRecord(rawEntry, `Background preview catalog entry ${entryIndex}`)
    const entry = rawEntry
    if (typeof entry.backgroundId !== "string" || !entry.backgroundId.trim() || ids.has(entry.backgroundId)) {
      throw new Error("Background preview catalog IDs must be nonempty and unique.")
    }
    ids.add(entry.backgroundId)
    const label = entry.backgroundId
    requireNonemptyString(entry.recipeRevision, `${label} recipeRevision`)
    requireEnum(entry.reviewStatus, ["candidate", "approved"], `${label} reviewStatus`)
    requireNonemptyString(entry.batchSlug, `${label} batchSlug`)
    const mediaKind = requireEnum(entry.mediaKind, ["animated", "poster-only"], `${label} mediaKind`)
    if (!Array.isArray(entry.renditions)) throw new Error(`${label} renditions must be an array.`)

    if (mediaKind === "animated") {
      requireEnum(entry.loopStrategy, ["natural", "crossfade"], `${label} loopStrategy`)
      requirePositiveInteger(entry.loopBoundaryMs, `${label} loopBoundaryMs`)
      if (entry.renditions.length === 0) throw new Error(`${label}: animated catalog entry requires video renditions.`)
    } else {
      if (entry.loopStrategy !== "static" || entry.loopBoundaryMs !== 0 || entry.renditions.length !== 0) {
        throw new Error(`${label}: poster-only catalog entry requires static looping, a zero boundary, and no video renditions.`)
      }
    }
    const seenRenditionIdentities = new Set<string>()
    entry.renditions.forEach((rendition, renditionIndex) => {
      const identity = requireRenditionDescriptor(rendition, `${label} rendition ${renditionIndex}`)
      if (seenRenditionIdentities.has(identity)) {
        throw new Error(`${label}: duplicate rendition identity ${identity}.`)
      }
      seenRenditionIdentities.add(identity)
    })
    if (mediaKind === "animated") {
      const missingIdentities = expectedRenditionIdentities.filter(
        (identity) => !seenRenditionIdentities.has(identity),
      )
      if (missingIdentities.length || seenRenditionIdentities.size !== expectedRenditionIdentities.length) {
        throw new Error(
          `${label}: animated catalog entry requires the complete ${expectedRenditionIdentities.length}-rendition identity matrix; missing ${missingIdentities.join(", ") || "none"}.`,
        )
      }
    }

    requireRecord(entry.posters, `${label} posters`)
    requireExactKeys(entry.posters, catalogAspects, `${label} posters`)
    for (const aspect of catalogAspects) {
      requirePosterDescriptor(entry.posters[aspect], `${label} ${aspect} poster`)
    }
  }
}

assertCatalogManifest(catalogJson)
export const backgroundPreviewCatalogManifest: Readonly<BackgroundPreviewCatalogManifest> = Object.freeze(catalogJson)
