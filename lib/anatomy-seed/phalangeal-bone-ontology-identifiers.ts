import type { AnatomySeedSection } from "./sections.ts"

const OLS_UBERON_SOURCE = "ols-uberon"

type ExternalIdentifierRow = NonNullable<AnatomySeedSection["externalIdentifiers"]>[number]
type CitationRow = NonNullable<AnatomySeedSection["citations"]>[number]

type BoneIdentifierSpec = {
  slug: string
  label: string
  identifier: string
}

const PHALANGEAL_BONE_IDENTIFIER_SPECS: BoneIdentifierSpec[] = [
  { slug: "proximal-phalanx-thumb-hand", label: "proximal phalanx of manual digit 1", identifier: "UBERON:0004338" },
  { slug: "distal-phalanx-thumb-hand", label: "distal phalanx of manual digit 1", identifier: "UBERON:0004337" },
  { slug: "proximal-phalanx-index-finger", label: "proximal phalanx of manual digit 2", identifier: "UBERON:0004328" },
  { slug: "middle-phalanx-index-finger", label: "middle phalanx of manual digit 2", identifier: "UBERON:0004320" },
  { slug: "distal-phalanx-index-finger", label: "distal phalanx of manual digit 2", identifier: "UBERON:0004311" },
  { slug: "proximal-phalanx-middle-finger", label: "proximal phalanx of manual digit 3", identifier: "UBERON:0004329" },
  { slug: "middle-phalanx-middle-finger", label: "middle phalanx of manual digit 3", identifier: "UBERON:0004321" },
  { slug: "distal-phalanx-middle-finger", label: "distal phalanx of manual digit 3", identifier: "UBERON:0004312" },
  { slug: "proximal-phalanx-ring-finger", label: "proximal phalanx of manual digit 4", identifier: "UBERON:0004330" },
  { slug: "middle-phalanx-ring-finger", label: "middle phalanx of manual digit 4", identifier: "UBERON:0004322" },
  { slug: "distal-phalanx-ring-finger", label: "distal phalanx of manual digit 4", identifier: "UBERON:0004313" },
  { slug: "proximal-phalanx-little-finger", label: "proximal phalanx of manual digit 5", identifier: "UBERON:0004331" },
  { slug: "middle-phalanx-little-finger", label: "middle phalanx of manual digit 5", identifier: "UBERON:0004323" },
  { slug: "distal-phalanx-little-finger", label: "distal phalanx of manual digit 5", identifier: "UBERON:0004314" },
  { slug: "proximal-phalanx-hallux", label: "proximal phalanx of pedal digit 1", identifier: "UBERON:0004332" },
  { slug: "distal-phalanx-hallux", label: "distal phalanx of pedal digit 1", identifier: "UBERON:0004315" },
  { slug: "proximal-phalanx-second-toe", label: "proximal phalanx of pedal digit 2", identifier: "UBERON:0004333" },
  { slug: "middle-phalanx-second-toe", label: "middle phalanx of pedal digit 2", identifier: "UBERON:0004324" },
  { slug: "distal-phalanx-second-toe", label: "distal phalanx of pedal digit 2", identifier: "UBERON:0004316" },
  { slug: "proximal-phalanx-third-toe", label: "proximal phalanx of pedal digit 3", identifier: "UBERON:0004334" },
  { slug: "middle-phalanx-third-toe", label: "middle phalanx of pedal digit 3", identifier: "UBERON:0004325" },
  { slug: "distal-phalanx-third-toe", label: "distal phalanx of pedal digit 3", identifier: "UBERON:0004317" },
  { slug: "proximal-phalanx-fourth-toe", label: "proximal phalanx of pedal digit 4", identifier: "UBERON:0004335" },
  { slug: "middle-phalanx-fourth-toe", label: "middle phalanx of pedal digit 4", identifier: "UBERON:0004326" },
  { slug: "distal-phalanx-fourth-toe", label: "distal phalanx of pedal digit 4", identifier: "UBERON:0004318" },
  { slug: "proximal-phalanx-fifth-toe", label: "proximal phalanx of pedal digit 5", identifier: "UBERON:0004336" },
  { slug: "middle-phalanx-fifth-toe", label: "middle phalanx of pedal digit 5", identifier: "UBERON:0004327" },
  { slug: "distal-phalanx-fifth-toe", label: "distal phalanx of pedal digit 5", identifier: "UBERON:0004319" },
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
    citationNote: "OLS UBERON term used as a stable ontology alignment anchor for this individual hand or foot phalanx.",
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

export const PHALANGEAL_BONE_ONTOLOGY_IDENTIFIERS_SECTION: AnatomySeedSection = {
  externalIdentifiers: PHALANGEAL_BONE_IDENTIFIER_SPECS.map(externalIdentifier),
  citations: PHALANGEAL_BONE_IDENTIFIER_SPECS.flatMap((spec) => [
    externalIdentifierCitation(spec),
    sourceReferenceCitation(spec),
  ]),
}
