import type { AnatomySeedSection } from "./sections.ts"

const OLS_UBERON_SOURCE = "ols-uberon"

type ExternalIdentifierRow = NonNullable<AnatomySeedSection["externalIdentifiers"]>[number]
type CitationRow = NonNullable<AnatomySeedSection["citations"]>[number]

type BoneIdentifierSpec = {
  slug: string
  label: string
  identifier: string
}

const CRANIOFACIAL_PELVIC_BONE_IDENTIFIER_SPECS: BoneIdentifierSpec[] = [
  { slug: "cranial-bones", label: "cranial bone", identifier: "UBERON:0004766" },
  { slug: "facial-bones", label: "facial bone", identifier: "UBERON:0003462" },
  { slug: "parietal-bone", label: "tetrapod parietal bone", identifier: "UBERON:0000210" },
  { slug: "ethmoid-bone", label: "ethmoid bone", identifier: "UBERON:0001679" },
  { slug: "nasal-bone", label: "nasal bone", identifier: "UBERON:0001681" },
  { slug: "lacrimal-bone", label: "lacrimal bone", identifier: "UBERON:0001680" },
  { slug: "palatine-bone", label: "palatine bone", identifier: "UBERON:0001682" },
  { slug: "vomer", label: "vomer", identifier: "UBERON:0002396" },
  { slug: "inferior-nasal-concha", label: "inferior nasal concha", identifier: "UBERON:0005922" },
  { slug: "hip-bone", label: "innominate bone", identifier: "UBERON:0001272" },
  { slug: "ilium", label: "ilium", identifier: "UBERON:0001273" },
  { slug: "ischium", label: "ischium", identifier: "UBERON:0001274" },
  { slug: "pubis", label: "pubis", identifier: "UBERON:0001275" },
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
    citationNote: "OLS UBERON term used as a stable ontology alignment anchor for this craniofacial or pelvic bone record.",
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

export const CRANIOFACIAL_PELVIC_BONE_ONTOLOGY_IDENTIFIERS_SECTION: AnatomySeedSection = {
  externalIdentifiers: CRANIOFACIAL_PELVIC_BONE_IDENTIFIER_SPECS.map(externalIdentifier),
  citations: CRANIOFACIAL_PELVIC_BONE_IDENTIFIER_SPECS.flatMap((spec) => [
    externalIdentifierCitation(spec),
    sourceReferenceCitation(spec),
  ]),
}
