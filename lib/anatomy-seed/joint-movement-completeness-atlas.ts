import type { AnatomySeedSection } from "./sections.ts"

const APPLIED_HUMAN_ANATOMY_SOURCE = "applied-human-anatomy"
const APPLIED_HUMAN_ANATOMY_LOCATOR = "https://open.umn.edu/opentextbooks/textbooks/1266"

type CitationRow = NonNullable<AnatomySeedSection["citations"]>[number]
type EntityTermRow = NonNullable<AnatomySeedSection["entityTerms"]>[number]
type JointMovementRow = NonNullable<AnatomySeedSection["jointMovements"]>[number]

type JointMovementSpec = {
  slug: string
  joint: string
  movementName: string
  plane: string
  axis: string
  description: string
  commonTerms: string[]
}

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

function sourceReferenceCitation(
  entityType: CitationRow["entityType"],
  entitySlug: string,
  factSlug: string,
  sourceRef: string,
  sourceLocator: string,
  citationNote: string,
) {
  const slug = slugify(`citation source ref ${entityType} ${entitySlug} ${factSlug} ${sourceRef}`)

  return {
    id: slug,
    slug,
    entityType,
    entitySlug,
    factType: "seed_source_reference",
    factSlug,
    sourceRef,
    sourceLocator,
    citationNote,
    reviewStatus: "reviewed",
  } satisfies CitationRow
}

function reviewedMovementCitation(
  movementSlug: string,
  factType: string,
  factSlug: string,
  sourceLocator: string,
  citationNote: string,
) {
  const slug = `citation-joint-movement-${movementSlug}-${slugify(factType)}-${slugify(factSlug)}`

  return {
    id: slug,
    slug,
    entityType: "joint_movement",
    entitySlug: movementSlug,
    factType,
    factSlug,
    sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
    sourceLocator,
    citationNote,
    reviewStatus: "reviewed",
  } satisfies CitationRow
}

const JOINT_MOVEMENT_COMPLETENESS_SPECS: JointMovementSpec[] = [
  {
    slug: "acromioclavicular-glide",
    joint: "acromioclavicular",
    movementName: "Acromioclavicular Glide",
    plane: "variable",
    axis: "variable",
    description: "Acromioclavicular glide describes small plane-joint translation between the acromion and clavicle during scapular and shoulder-girdle motion.",
    commonTerms: ["AC joint glide", "collarbone shoulder glide"],
  },
  {
    slug: "acromioclavicular-rotation",
    joint: "acromioclavicular",
    movementName: "Acromioclavicular Rotation",
    plane: "variable",
    axis: "longitudinal",
    description: "Acromioclavicular rotation describes small clavicle-scapula adjustment that accompanies scapular upward rotation and arm elevation.",
    commonTerms: ["AC joint rotation", "shoulder blade collarbone rotation"],
  },
  {
    slug: "sacroiliac-nutation",
    joint: "sacroiliac",
    movementName: "Sacroiliac Nutation",
    plane: "sagittal",
    axis: "transverse",
    description: "Sacroiliac nutation describes the small sacral nodding motion used as an educational reference for lumbopelvic load transfer.",
    commonTerms: ["SI joint nutation", "sacrum nodding forward"],
  },
  {
    slug: "sacroiliac-counternutation",
    joint: "sacroiliac",
    movementName: "Sacroiliac Counternutation",
    plane: "sagittal",
    axis: "transverse",
    description: "Sacroiliac counternutation describes the small reverse sacral nodding motion used for non-diagnostic pelvis and low-back mechanics education.",
    commonTerms: ["SI joint counternutation", "sacrum nodding backward"],
  },
  {
    slug: "tarsometatarsal-glide",
    joint: "tarsometatarsal-joints",
    movementName: "Tarsometatarsal Glide",
    plane: "variable",
    axis: "variable",
    description: "Tarsometatarsal glide describes small midfoot plane-joint motion between the distal tarsals and metatarsal bases during arch loading and foot adaptation.",
    commonTerms: ["TMT joint glide", "midfoot glide"],
  },
]

const JOINT_MOVEMENT_COMPLETENESS_ROWS: JointMovementRow[] = JOINT_MOVEMENT_COMPLETENESS_SPECS.map((spec) => ({
  id: `movement-${spec.slug}`,
  slug: spec.slug,
  joint: spec.joint,
  movementName: spec.movementName,
  plane: spec.plane,
  axis: spec.axis,
  description: spec.description,
  sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
}))

const JOINT_MOVEMENT_COMPLETENESS_TERMS: EntityTermRow[] = JOINT_MOVEMENT_COMPLETENESS_SPECS.flatMap((spec) => spec.commonTerms.map((term, index) => ({
  id: `term-joint-movement-${spec.slug}-common-${index + 1}`,
  anatomyEntityType: "joint_movement",
  anatomyEntitySlug: spec.slug,
  term,
  termType: index === 0 ? "common" : "alternate",
  sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
})))

const JOINT_MOVEMENT_COMPLETENESS_CITATIONS: CitationRow[] = [
  ...JOINT_MOVEMENT_COMPLETENESS_SPECS.flatMap((spec) => [
    reviewedMovementCitation(
      spec.slug,
      "movement_definition",
      `joint-movement-${spec.slug}`,
      APPLIED_HUMAN_ANATOMY_LOCATOR,
      "Reviewed commercial-safe movement definition for a joint that previously lacked an explicit movement row.",
    ),
    sourceReferenceCitation(
      "joint_movement",
      spec.slug,
      `joint_movement:${spec.slug}`,
      APPLIED_HUMAN_ANATOMY_SOURCE,
      APPLIED_HUMAN_ANATOMY_LOCATOR,
      "Reviewed source-reference row for a joint movement seed record.",
    ),
  ]),
  ...JOINT_MOVEMENT_COMPLETENESS_TERMS.map((term) => sourceReferenceCitation(
    "joint_movement",
    term.anatomyEntitySlug,
    `entity_term:${term.id}`,
    term.sourceRef,
    APPLIED_HUMAN_ANATOMY_LOCATOR,
    "Reviewed source-reference row for joint movement common terminology.",
  )),
]

export const JOINT_MOVEMENT_COMPLETENESS_ATLAS_SECTION: AnatomySeedSection = {
  jointMovements: JOINT_MOVEMENT_COMPLETENESS_ROWS,
  entityTerms: JOINT_MOVEMENT_COMPLETENESS_TERMS,
  citations: JOINT_MOVEMENT_COMPLETENESS_CITATIONS,
}
