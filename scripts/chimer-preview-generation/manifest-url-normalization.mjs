export const LOCAL_CHIMER_PREVIEW_MEDIA_BASE_URL = "/chimer/background-previews"

const TOP_LEVEL_PREVIEW_URL_FIELDS = [
  "previewMediaUrl",
  "previewVideoUrl",
  "previewImageUrl",
  "previewSquareVideoUrl",
  "previewSquareImageUrl",
  "previewVerticalVideoUrl",
  "previewVerticalImageUrl",
]

/**
 * Converts a resolved preview URL back to the flat local asset path committed
 * in generated manifests. Registry reads may resolve the same filename through
 * a hosted or custom base URL, but that environment must not enter artifacts.
 */
export function normalizeGeneratedPreviewUrl(url) {
  if (typeof url !== "string" || url.length === 0) return url

  const pathWithoutQuery = url.split(/[?#]/, 1)[0].replaceAll("\\", "/")
  const assetName = pathWithoutQuery.split("/").filter(Boolean).at(-1)
  return assetName ? `${LOCAL_CHIMER_PREVIEW_MEDIA_BASE_URL}/${assetName}` : url
}

/** Normalizes every URL-bearing field copied from a resolved registry entry. */
export function normalizeGeneratedPreviewManifestItem(item) {
  const normalized = { ...item }
  for (const field of TOP_LEVEL_PREVIEW_URL_FIELDS) {
    if (field in normalized) normalized[field] = normalizeGeneratedPreviewUrl(normalized[field])
  }

  normalized.variants = Object.fromEntries(
    Object.entries(item.variants ?? {}).map(([key, variant]) => [
      key,
      {
        ...variant,
        previewMediaUrl: normalizeGeneratedPreviewUrl(variant.previewMediaUrl),
        ...(variant.previewPosterUrl
          ? { previewPosterUrl: normalizeGeneratedPreviewUrl(variant.previewPosterUrl) }
          : {}),
      },
    ]),
  )
  return normalized
}
