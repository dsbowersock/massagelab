/** Builds the top-level preview URLs from one complete variant map. */
export function buildGeneratedPreviewManifestItem(entry, variants) {
  const primary = variants?.landscape ?? Object.values(variants ?? {})[0]
  if (!primary) {
    throw new Error(`Preview manifest item "${entry.id}" requires at least one variant.`)
  }

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

/** Copies only defined fields so partial renders cannot erase preserved metadata. */
function withDefinedValues(item) {
  return Object.fromEntries(Object.entries(item).filter(([, value]) => value !== undefined))
}

/** Preserves untouched aspect-ratio metadata when a partial render replaces selected variants. */
export function mergeGeneratedPreviewManifestItem(previous, incoming) {
  if (!previous) return incoming

  const variants = {
    ...previous.variants,
    ...incoming.variants,
  }
  const entry = { ...previous, ...withDefinedValues(incoming) }
  return {
    ...entry,
    ...buildGeneratedPreviewManifestItem(entry, variants),
  }
}
