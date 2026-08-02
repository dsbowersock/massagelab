/** Builds the top-level preview URLs from one complete variant map. */
export function buildGeneratedPreviewManifestItem(entry, variants) {
  const primary = variants.landscape ?? Object.values(variants)[0]

  return {
    id: entry.id,
    label: entry.label,
    provider: entry.provider,
    previewMediaType: "video",
    previewMediaUrl: primary.previewMediaUrl,
    previewVideoUrl: primary.previewMediaUrl,
    previewImageUrl: primary.previewPosterUrl,
    previewSquareVideoUrl: variants.square?.previewMediaUrl,
    previewSquareImageUrl: variants.square?.previewPosterUrl,
    previewVerticalVideoUrl: variants.vertical?.previewMediaUrl,
    previewVerticalImageUrl: variants.vertical?.previewPosterUrl,
    variants,
  }
}

/** Preserves untouched aspect-ratio metadata when a partial render replaces selected variants. */
export function mergeGeneratedPreviewManifestItem(previous, incoming) {
  if (!previous) return incoming

  const variants = {
    ...previous.variants,
    ...incoming.variants,
  }
  return {
    ...previous,
    ...incoming,
    ...buildGeneratedPreviewManifestItem({ ...previous, ...incoming }, variants),
  }
}
