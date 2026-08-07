import type {
  BackgroundPreviewPublishedAspect,
  BackgroundPreviewPublishedCodec,
  BackgroundPreviewPublishedEntry,
  BackgroundPreviewPublishedQuality,
  BackgroundPreviewPublishedRendition,
} from "../components/backgrounds/backgroundPreviewPublishedManifest"

export const publishedPreviewCatalogBaseUrl: string | null

export function resolvePublishedPreviewCatalogBaseUrl(options?: {
  configuredBaseUrl?: string | null
  nodeEnv?: string
}): string | null

export function qualityForPreviewConnection(connection?: {
  effectiveType?: string
  saveData?: boolean
} | null): BackgroundPreviewPublishedQuality

export function chooseSupportedPreviewCodec(options?: {
  renditions?: readonly BackgroundPreviewPublishedRendition[]
  aspect?: BackgroundPreviewPublishedAspect
  quality?: BackgroundPreviewPublishedQuality
  canPlayType?: (mimeType: string) => CanPlayTypeResult
}): BackgroundPreviewPublishedCodec | null

export function getVerticalPublishedPreviewPosterUrl(
  entry?: BackgroundPreviewPublishedEntry | null,
  catalogBaseUrl?: string | null,
): string | null

export function selectPublishedPreviewRendition(options?: {
  entry?: BackgroundPreviewPublishedEntry | null
  aspect?: BackgroundPreviewPublishedAspect
  quality?: BackgroundPreviewPublishedQuality
  codec?: BackgroundPreviewPublishedCodec
  catalogBaseUrl?: string | null
}): BackgroundPreviewPublishedRendition | null

export function resolvePendingPreviewRendition(options?: {
  entry?: BackgroundPreviewPublishedEntry | null
  currentRendition?: BackgroundPreviewPublishedRendition | null
  pendingQuality?: BackgroundPreviewPublishedQuality | null
  catalogBaseUrl?: string | null
}): BackgroundPreviewPublishedRendition | null
