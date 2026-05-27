import type { AnatomySeedSection } from "./sections.ts"

const OLS_UBERON_SOURCE = "ols-uberon"

type ExternalIdentifierRow = NonNullable<AnatomySeedSection["externalIdentifiers"]>[number]
type CitationRow = NonNullable<AnatomySeedSection["citations"]>[number]

type BoneIdentifierSpec = {
  slug: string
  label: string
  identifier: string
}

const AXIAL_BONE_IDENTIFIER_SPECS: BoneIdentifierSpec[] = [
  { slug: "c3-vertebra", label: "mammalian cervical vertebra 3", identifier: "UBERON:0004612" },
  { slug: "c4-vertebra", label: "mammalian cervical vertebra 4", identifier: "UBERON:0004613" },
  { slug: "c5-vertebra", label: "mammalian cervical vertebra 5", identifier: "UBERON:0004614" },
  { slug: "c6-vertebra", label: "mammalian cervical vertebra 6", identifier: "UBERON:0004615" },
  { slug: "c7-vertebra", label: "mammalian cervical vertebra 7", identifier: "UBERON:0004616" },
  { slug: "t1-vertebra", label: "thoracic vertebra 1", identifier: "UBERON:0004626" },
  { slug: "t2-vertebra", label: "thoracic vertebra 2", identifier: "UBERON:0004627" },
  { slug: "t3-vertebra", label: "thoracic vertebra 3", identifier: "UBERON:0004628" },
  { slug: "t4-vertebra", label: "thoracic vertebra 4", identifier: "UBERON:0004629" },
  { slug: "t5-vertebra", label: "thoracic vertebra 5", identifier: "UBERON:0004630" },
  { slug: "t6-vertebra", label: "thoracic vertebra 6", identifier: "UBERON:0004631" },
  { slug: "t7-vertebra", label: "thoracic vertebra 7", identifier: "UBERON:0004632" },
  { slug: "t8-vertebra", label: "thoracic vertebra 8", identifier: "UBERON:0011050" },
  { slug: "t9-vertebra", label: "thoracic vertebra 9", identifier: "UBERON:0004633" },
  { slug: "t10-vertebra", label: "thoracic vertebra 10", identifier: "UBERON:0004634" },
  { slug: "t11-vertebra", label: "thoracic vertebra 11", identifier: "UBERON:0004635" },
  { slug: "t12-vertebra", label: "thoracic vertebra 12", identifier: "UBERON:0004636" },
  { slug: "l1-vertebra", label: "lumbar vertebra 1", identifier: "UBERON:0004617" },
  { slug: "l2-vertebra", label: "lumbar vertebra 2", identifier: "UBERON:0004618" },
  { slug: "l3-vertebra", label: "lumbar vertebra 3", identifier: "UBERON:0004619" },
  { slug: "l4-vertebra", label: "lumbar vertebra 4", identifier: "UBERON:0004620" },
  { slug: "l5-vertebra", label: "lumbar vertebra 5", identifier: "UBERON:0004621" },
  { slug: "first-rib", label: "rib 1", identifier: "UBERON:0004601" },
  { slug: "second-rib", label: "rib 2", identifier: "UBERON:0004602" },
  { slug: "third-rib", label: "rib 3", identifier: "UBERON:0004603" },
  { slug: "fourth-rib", label: "rib 4", identifier: "UBERON:0004604" },
  { slug: "fifth-rib", label: "rib 5", identifier: "UBERON:0004605" },
  { slug: "sixth-rib", label: "rib 6", identifier: "UBERON:0004606" },
  { slug: "seventh-rib", label: "rib 7", identifier: "UBERON:0004607" },
  { slug: "eighth-rib", label: "rib 8", identifier: "UBERON:0010757" },
  { slug: "ninth-rib", label: "rib 9", identifier: "UBERON:0004608" },
  { slug: "tenth-rib", label: "rib 10", identifier: "UBERON:0004609" },
  { slug: "eleventh-rib", label: "rib 11", identifier: "UBERON:0004610" },
  { slug: "twelfth-rib", label: "rib 12", identifier: "UBERON:0004611" },
]

function iriForIdentifier(identifier: string) {
  return `http://purl.obolibrary.org/obo/${identifier.replace(":", "_")}`
}

function olsClassUrl(identifier: string) {
  return `https://www.ebi.ac.uk/ols4/ontologies/uberon/classes/${encodeURIComponent(iriForIdentifier(identifier))}`
}

function safeIdentifier(identifier: string) {
  return identifier.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

function externalIdentifier(spec: BoneIdentifierSpec): ExternalIdentifierRow {
  return {
    id: `external-id-${spec.slug}-uberon`,
    entityType: "bone",
    entitySlug: spec.slug,
    provider: "UBERON",
    identifier: spec.identifier,
    iri: iriForIdentifier(spec.identifier),
    label: spec.label,
    sourceRef: OLS_UBERON_SOURCE,
  }
}

function externalIdentifierCitation(spec: BoneIdentifierSpec): CitationRow {
  return {
    id: `citation-bone-${spec.slug}-external-identifier-${safeIdentifier(spec.identifier)}-reviewed`,
    slug: `citation-bone-${spec.slug}-external-identifier-${safeIdentifier(spec.identifier)}-reviewed`,
    entityType: "bone",
    entitySlug: spec.slug,
    factType: "external_identifier",
    factSlug: `external-id-${spec.slug}-uberon`,
    sourceRef: OLS_UBERON_SOURCE,
    sourceLocator: spec.identifier,
    citationNote: "OLS UBERON term used as a stable ontology alignment anchor for this numbered axial bone.",
    reviewStatus: "reviewed",
  }
}

function sourceReferenceCitation(spec: BoneIdentifierSpec): CitationRow {
  return {
    id: `citation-source-ref-bone-${spec.slug}-external-identifier-${safeIdentifier(spec.identifier)}`,
    slug: `citation-source-ref-bone-${spec.slug}-external-identifier-${safeIdentifier(spec.identifier)}`,
    entityType: "bone",
    entitySlug: spec.slug,
    factType: "seed_source_reference",
    factSlug: `external_identifier:${spec.identifier}`,
    sourceRef: OLS_UBERON_SOURCE,
    sourceLocator: olsClassUrl(spec.identifier),
    citationNote: "Reviewed source-reference row for the OLS UBERON external identifier seed fact.",
    reviewStatus: "reviewed",
  }
}

export const AXIAL_BONE_ONTOLOGY_IDENTIFIERS_SECTION: AnatomySeedSection = {
  externalIdentifiers: AXIAL_BONE_IDENTIFIER_SPECS.map(externalIdentifier),
  citations: AXIAL_BONE_IDENTIFIER_SPECS.flatMap((spec) => [
    externalIdentifierCitation(spec),
    sourceReferenceCitation(spec),
  ]),
}
