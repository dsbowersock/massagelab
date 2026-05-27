import type { AnatomySeedSection } from "./sections.ts"

const OLS_UBERON_SOURCE = "ols-uberon"

type ExternalIdentifierRow = NonNullable<AnatomySeedSection["externalIdentifiers"]>[number]
type CitationRow = NonNullable<AnatomySeedSection["citations"]>[number]

type BoneIdentifierSpec = {
  slug: string
  label: string
  identifier: string
}

const HAND_FOOT_BONE_IDENTIFIER_SPECS: BoneIdentifierSpec[] = [
  { slug: "scaphoid", label: "radiale", identifier: "UBERON:0001427" },
  { slug: "lunate", label: "intermedium", identifier: "UBERON:0001428" },
  { slug: "triquetrum", label: "ulnare", identifier: "UBERON:0002445" },
  { slug: "pisiform", label: "pisiform", identifier: "UBERON:0001429" },
  { slug: "trapezium", label: "distal carpal bone 1", identifier: "UBERON:0001430" },
  { slug: "trapezoid", label: "distal carpal bone 2", identifier: "UBERON:0001431" },
  { slug: "capitate", label: "distal carpal bone 3", identifier: "UBERON:0001432" },
  { slug: "hamate", label: "distal carpal bone 4", identifier: "UBERON:0001433" },
  { slug: "talus", label: "talus", identifier: "UBERON:0002395" },
  { slug: "navicular", label: "navicular bone of pes", identifier: "UBERON:0001451" },
  { slug: "cuboid", label: "cuboid bone", identifier: "UBERON:0001455" },
  { slug: "medial-cuneiform", label: "distal tarsal bone 1", identifier: "UBERON:0001452" },
  { slug: "intermediate-cuneiform", label: "distal tarsal bone 2", identifier: "UBERON:0001453" },
  { slug: "lateral-cuneiform", label: "distal tarsal bone 3", identifier: "UBERON:0001454" },
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
    citationNote: "OLS UBERON term used as a stable ontology alignment anchor for this named carpal or tarsal bone.",
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

export const HAND_FOOT_BONE_ONTOLOGY_IDENTIFIERS_SECTION: AnatomySeedSection = {
  externalIdentifiers: HAND_FOOT_BONE_IDENTIFIER_SPECS.map(externalIdentifier),
  citations: HAND_FOOT_BONE_IDENTIFIER_SPECS.flatMap((spec) => [
    externalIdentifierCitation(spec),
    sourceReferenceCitation(spec),
  ]),
}
