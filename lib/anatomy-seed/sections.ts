import type { AnatomyFoundationSeed, PainMapRegion } from "../anatomy-foundation.ts"

export type AnatomySeedSection = Partial<{
  [Key in keyof AnatomyFoundationSeed]: AnatomyFoundationSeed[Key]
}>

const COLLECTION_KEYS = [
  "sources",
  "bodyRegions",
  "bodySubregions",
  "bones",
  "boneLandmarks",
  "joints",
  "jointMovements",
  "rangesOfMotion",
  "muscles",
  "muscleAttachments",
  "muscleActions",
  "nerves",
  "muscleInnervations",
  "ligaments",
  "bloodSupply",
  "structures",
  "concepts",
  "painMapRegions",
  "clientTerms",
  "entityTerms",
  "relationships",
  "citations",
  "externalIdentifiers",
  "mediaAssets",
  "mediaEntityLinks",
] as const

function painMapDefaults(region: PainMapRegion): PainMapRegion {
  return {
    ...region,
    laterality: region.laterality ?? "unspecified",
    surface: region.surface ?? "unspecified",
  }
}

export function mergeAnatomySeedSections(base: AnatomyFoundationSeed, ...sections: AnatomySeedSection[]): AnatomyFoundationSeed {
  const merged = Object.fromEntries(
    COLLECTION_KEYS.map((key) => [
      key,
      [
        ...(base[key] as unknown[]),
        ...sections.flatMap((section) => (section[key] ?? []) as unknown[]),
      ],
    ]),
  ) as unknown as AnatomyFoundationSeed

  return {
    ...merged,
    painMapRegions: merged.painMapRegions.map(painMapDefaults),
  }
}
