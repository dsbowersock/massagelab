import type { AnatomySeedSection } from "./sections.ts"

const APPLIED_HUMAN_ANATOMY_SOURCE = "applied-human-anatomy"
const APPLIED_HUMAN_ANATOMY_LOCATOR = "https://open.umn.edu/opentextbooks/textbooks/1266"

type RelationshipRow = NonNullable<AnatomySeedSection["relationships"]>[number]
type CitationRow = NonNullable<AnatomySeedSection["citations"]>[number]

const STRUCTURE_RELATIONSHIPS: RelationshipRow[] = [
  {
    id: "relationship-intervertebral-disc-associated-with-lumbar-spine",
    sourceEntityType: "anatomy_structure",
    sourceEntitySlug: "intervertebral-disc",
    relationshipType: "associated_with",
    targetEntityType: "joint",
    targetEntitySlug: "lumbar-spine",
    sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
  },
  {
    id: "relationship-thoracolumbar-fascia-associated-with-lumbar-region",
    sourceEntityType: "anatomy_structure",
    sourceEntitySlug: "thoracolumbar-fascia",
    relationshipType: "associated_with",
    targetEntityType: "region",
    targetEntitySlug: "lumbar-region",
    sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
  },
  {
    id: "relationship-abdominal-aponeurosis-supports-rectus-abdominis",
    sourceEntityType: "anatomy_structure",
    sourceEntitySlug: "abdominal-aponeurosis",
    relationshipType: "supports",
    targetEntityType: "muscle",
    targetEntitySlug: "rectus-abdominis",
    sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
  },
  {
    id: "relationship-triceps-tendon-attaches-to-olecranon",
    sourceEntityType: "anatomy_structure",
    sourceEntitySlug: "triceps-tendon",
    relationshipType: "attaches_to",
    targetEntityType: "bone_landmark",
    targetEntitySlug: "olecranon",
    sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
  },
  {
    id: "relationship-deep-transverse-metacarpal-ligament-stabilizes-mcp",
    sourceEntityType: "anatomy_structure",
    sourceEntitySlug: "deep-transverse-metacarpal-ligament",
    relationshipType: "stabilizes",
    targetEntityType: "joint",
    targetEntitySlug: "metacarpophalangeal-joints",
    sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
  },
  {
    id: "relationship-olecranon-bursa-overlies-olecranon",
    sourceEntityType: "anatomy_structure",
    sourceEntitySlug: "olecranon-bursa",
    relationshipType: "overlies",
    targetEntityType: "bone_landmark",
    targetEntitySlug: "olecranon",
    sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
  },
]

function sourceReferenceCitation(relationship: RelationshipRow): CitationRow {
  return {
    id: `citation-source-ref-${relationship.id}`,
    slug: `citation-source-ref-${relationship.id}`,
    entityType: relationship.sourceEntityType,
    entitySlug: relationship.sourceEntitySlug,
    factType: "seed_source_reference",
    factSlug: `relationship:${relationship.id}`,
    sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
    sourceLocator: APPLIED_HUMAN_ANATOMY_LOCATOR,
    citationNote: "Reviewed source-reference row for a structure relationship seed fact.",
    reviewStatus: "reviewed",
  }
}

export const STRUCTURE_RELATIONSHIP_COMPLETENESS_ATLAS_SECTION: AnatomySeedSection = {
  relationships: STRUCTURE_RELATIONSHIPS,
  citations: STRUCTURE_RELATIONSHIPS.map(sourceReferenceCitation),
}
