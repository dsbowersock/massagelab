export const CATALOG_PREVIEW_ASPECTS = Object.freeze(["landscape", "square", "vertical"])
export const CATALOG_PREVIEW_QUALITIES = Object.freeze(["low", "standard", "high"])
export const CATALOG_PREVIEW_CODECS = Object.freeze(["vp9", "h264"])

/** Immutable cardinality contract for the approved local publication release. */
export const APPROVED_CATALOG_RELEASE_CONTRACT = Object.freeze({
  catalogRevision: "catalog-approved-1",
  entryCount: 84,
  animatedCount: 82,
  posterOnlyCount: 2,
  renditionCount: 1_476,
  posterCount: 252,
})

/** Fails at module load if independently maintained release totals disagree. */
export function assertPublishedCatalogCountArithmetic(contract = APPROVED_CATALOG_RELEASE_CONTRACT) {
  for (const [label, value] of Object.entries(contract)) {
    if (label === "catalogRevision") continue
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error(`Published catalog ${label} must be a non-negative safe integer.`)
    }
  }
  if (contract.entryCount !== contract.animatedCount + contract.posterOnlyCount) {
    throw new Error("Published catalog entry count must equal animated plus poster-only entries.")
  }
  const renditionsPerAnimatedEntry = CATALOG_PREVIEW_ASPECTS.length
    * CATALOG_PREVIEW_QUALITIES.length
    * CATALOG_PREVIEW_CODECS.length
  if (contract.renditionCount !== contract.animatedCount * renditionsPerAnimatedEntry) {
    throw new Error("Published catalog rendition count must equal animated entries times the full rendition matrix.")
  }
  if (contract.posterCount !== contract.entryCount * CATALOG_PREVIEW_ASPECTS.length) {
    throw new Error("Published catalog poster count must equal entries times required poster aspects.")
  }
}

assertPublishedCatalogCountArithmetic()
