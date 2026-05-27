import type { AnatomySeedSection } from "./sections.ts"

const OLS_UBERON_SOURCE = "ols-uberon"

type ExternalIdentifierRow = NonNullable<AnatomySeedSection["externalIdentifiers"]>[number]
type CitationRow = NonNullable<AnatomySeedSection["citations"]>[number]

type BoneIdentifierSpec = {
  slug: string
  label: string
  identifier: string
}

const METAPODIAL_BONE_IDENTIFIER_SPECS: BoneIdentifierSpec[] = [
  { slug: "first-metacarpal", label: "metacarpal bone of digit 1", identifier: "UBERON:0003645" },
  { slug: "second-metacarpal", label: "metacarpal bone of digit 2", identifier: "UBERON:0003646" },
  { slug: "third-metacarpal", label: "metacarpal bone of digit 3", identifier: "UBERON:0003647" },
  { slug: "fourth-metacarpal", label: "metacarpal bone of digit 4", identifier: "UBERON:0003648" },
  { slug: "fifth-metacarpal", label: "metacarpal bone of digit 5", identifier: "UBERON:0003649" },
  { slug: "first-metatarsal", label: "metatarsal bone of digit 1", identifier: "UBERON:0003650" },
  { slug: "second-metatarsal", label: "metatarsal bone of digit 2", identifier: "UBERON:0003651" },
  { slug: "third-metatarsal", label: "metatarsal bone of digit 3", identifier: "UBERON:0003652" },
  { slug: "fourth-metatarsal", label: "metatarsal bone of digit 4", identifier: "UBERON:0003653" },
  { slug: "fifth-metatarsal", label: "metatarsal bone of digit 5", identifier: "UBERON:0003654" },
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
    citationNote: "OLS UBERON term used as a stable ontology alignment anchor for this individual metacarpal or metatarsal.",
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

export const METAPODIAL_BONE_ONTOLOGY_IDENTIFIERS_SECTION: AnatomySeedSection = {
  externalIdentifiers: METAPODIAL_BONE_IDENTIFIER_SPECS.map(externalIdentifier),
  citations: METAPODIAL_BONE_IDENTIFIER_SPECS.flatMap((spec) => [
    externalIdentifierCitation(spec),
    sourceReferenceCitation(spec),
  ]),
}
