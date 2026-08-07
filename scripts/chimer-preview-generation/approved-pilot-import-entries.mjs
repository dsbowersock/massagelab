import { FULL_CATALOG_BATCHES } from "./preview-recipes.mjs"

/**
 * Prepares only the frozen, visually reviewed pilot entries for publication.
 * Callers must verify that exact pilot set before invoking this helper; widening
 * the import requires a per-entry approval gate.
 */
export function prepareApprovedPilotCatalogEntries(entries) {
  return entries.map((entry) => {
    const batch = FULL_CATALOG_BATCHES.find(({ ids }) => ids.includes(entry.backgroundId))
    if (!batch) throw new Error(`${entry.backgroundId}: approved pilot entry has no catalog batch.`)
    return {
      ...entry,
      mediaKind: "animated",
      reviewStatus: "approved",
      batchSlug: batch.slug,
    }
  })
}
