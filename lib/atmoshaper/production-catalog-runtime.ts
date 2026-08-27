import productionCatalogJson from "@/data/atmoshaper/production-audio-catalog.json"

import { validateAtmoShaperProductionCatalog } from "./production-catalog.js"

export const ATMOSHAPER_PRODUCTION_CATALOG = validateAtmoShaperProductionCatalog(
  productionCatalogJson,
)

export type AtmoShaperProductionConcept = (typeof ATMOSHAPER_PRODUCTION_CATALOG.concepts)[number]
export type AtmoShaperProductionSource = AtmoShaperProductionConcept["sources"][number]

const conceptById = new Map(
  ATMOSHAPER_PRODUCTION_CATALOG.concepts.map((concept) => [concept.id, concept]),
)

/** Resolves only an exact concept from the committed checksum-bound release. */
export function getAtmoShaperProductionConcept(conceptId: string) {
  const concept = conceptById.get(conceptId)
  if (!concept) throw new Error(`Unknown AtmoShaper ambient concept: ${conceptId}`)
  return concept
}
