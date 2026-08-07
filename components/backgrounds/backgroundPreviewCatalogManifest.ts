import catalogJson from "../../public/chimer/background-preview-catalog/index.json" with { type: "json" }

export type BackgroundPreviewCatalogAspect = "landscape" | "square" | "vertical"
export type BackgroundPreviewCatalogQuality = "low" | "standard" | "high"
export type BackgroundPreviewCatalogCodec = "vp9" | "h264"

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

/** Fail closed if checked-in local review metadata drifts from schema v3. */
export function assertCatalogManifest(value: unknown): asserts value is BackgroundPreviewCatalogManifest {
  if (!value || typeof value !== "object") throw new Error("Background preview catalog must be an object.")
  const manifest = value as Record<string, unknown>
  if (manifest.schemaVersion !== 3 || typeof manifest.catalogRevision !== "string" || !Array.isArray(manifest.entries)) {
    throw new Error("Background preview catalog must use schema version 3.")
  }
  const ids = new Set<string>()
  for (const rawEntry of manifest.entries) {
    if (!rawEntry || typeof rawEntry !== "object") throw new Error("Background preview catalog entry must be an object.")
    const entry = rawEntry as Record<string, unknown>
    if (typeof entry.backgroundId !== "string" || !entry.backgroundId.trim() || ids.has(entry.backgroundId)) {
      throw new Error("Background preview catalog IDs must be nonempty and unique.")
    }
    ids.add(entry.backgroundId)
    if (!Array.isArray(entry.renditions) || !entry.posters || typeof entry.posters !== "object") {
      throw new Error(`${entry.backgroundId}: catalog media collections are malformed.`)
    }
    const posters = entry.posters as Record<string, unknown>
    if (!(["landscape", "square", "vertical"] as const).every((aspect) => posters[aspect])) {
      throw new Error(`${entry.backgroundId}: catalog requires three posters.`)
    }
    if (entry.mediaKind === "poster-only" && (entry.renditions.length !== 0 || entry.loopStrategy !== "static")) {
      throw new Error(`${entry.backgroundId}: static catalog entry cannot contain video.`)
    }
    if (entry.mediaKind !== "poster-only" && entry.mediaKind !== "animated") {
      throw new Error(`${entry.backgroundId}: unsupported catalog media kind.`)
    }
  }
}

assertCatalogManifest(catalogJson)
export const backgroundPreviewCatalogManifest: Readonly<BackgroundPreviewCatalogManifest> = Object.freeze(catalogJson)

/** Resolves local review media without changing the production v1 manifest. */
export function resolveCatalogPreviewUrl(url: string): string {
  if (/^(?:https?:)?\/\//.test(url) || url.startsWith("/")) return url
  return `/chimer/background-preview-catalog/${url}`
}
