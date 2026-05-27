import type { AnatomySeedSection } from "./sections.ts"

const APPLIED_HUMAN_ANATOMY_SOURCE = "applied-human-anatomy"
const FIPAT_SOURCE = "fipat-ta2"
const APPLIED_HUMAN_ANATOMY_LOCATOR = "https://open.umn.edu/opentextbooks/textbooks/1266"
const FIPAT_LOCATOR = "https://libraries.dal.ca/Fipat/ta2.html"

type CitationRow = NonNullable<AnatomySeedSection["citations"]>[number]
type EntityTermRow = NonNullable<AnatomySeedSection["entityTerms"]>[number]

type LandmarkCitationSpec = {
  slug: string
  name: string
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

function reviewedLandmarkCitation(
  landmarkSlug: string,
  factType: string,
  factSlug: string,
  sourceRef: string,
  sourceLocator: string,
  citationNote: string,
) {
  const slug = `citation-bone-landmark-${landmarkSlug}-${slugify(factType)}-${slugify(factSlug)}`

  return {
    id: slug,
    slug,
    entityType: "bone_landmark",
    entitySlug: landmarkSlug,
    factType,
    factSlug,
    sourceRef,
    sourceLocator,
    citationNote,
    reviewStatus: "reviewed",
  } satisfies CitationRow
}

const LANDMARK_CITATION_MATURITY_SPECS: LandmarkCitationSpec[] = [
  { slug: "anterior-tubercle-atlas", name: "Anterior Tubercle of Atlas" },
  { slug: "transverse-process-atlas", name: "Transverse Process of Atlas" },
  { slug: "posterior-tubercle-atlas", name: "Posterior Tubercle of Atlas" },
  { slug: "basilar-part-occipital-bone", name: "Basilar Part of Occipital Bone" },
  { slug: "cervical-vertebral-bodies", name: "Cervical Vertebral Bodies" },
  { slug: "anterior-cervical-transverse-processes", name: "Anterior Cervical Transverse Processes" },
  { slug: "scalene-tubercle-first-rib", name: "Scalene Tubercle of First Rib" },
  { slug: "second-rib", name: "Second Rib" },
  { slug: "coccygeal-apex", name: "Coccygeal Apex" },
  { slug: "lower-thoracic-spinous-processes", name: "Lower Thoracic Spinous Processes" },
  { slug: "thoracic-transverse-processes", name: "Thoracic Transverse Processes" },
  { slug: "rib-angles", name: "Rib Angles" },
  { slug: "medial-epicondyle-humerus", name: "Medial Epicondyle of Humerus" },
  { slug: "lateral-epicondyle-humerus", name: "Lateral Epicondyle of Humerus" },
  { slug: "olecranon", name: "Olecranon" },
  { slug: "radial-tuberosity", name: "Radial Tuberosity" },
  { slug: "radius-styloid-process", name: "Styloid Process of Radius" },
  { slug: "ulna-styloid-process", name: "Styloid Process of Ulna" },
  { slug: "carpal-tunnel", name: "Carpal Tunnel" },
  { slug: "metacarpal-bases", name: "Metacarpal Bases" },
  { slug: "pisiform", name: "Pisiform" },
  { slug: "hook-of-hamate", name: "Hook of Hamate" },
  { slug: "fifth-metacarpal", name: "Fifth Metacarpal" },
  { slug: "fifth-proximal-phalanx", name: "Fifth Proximal Phalanx" },
  { slug: "trochanteric-fossa", name: "Trochanteric Fossa" },
  { slug: "intertrochanteric-crest", name: "Intertrochanteric Crest" },
  { slug: "lateral-supracondylar-line", name: "Lateral Supracondylar Line" },
  { slug: "popliteal-surface", name: "Popliteal Surface" },
  { slug: "medial-calcaneal-process", name: "Medial Calcaneal Process" },
  { slug: "base-fifth-metatarsal", name: "Base of Fifth Metatarsal" },
  { slug: "hallux-phalanges", name: "Hallux Phalanges" },
  { slug: "dorsal-calcaneus", name: "Dorsal Calcaneus" },
  { slug: "lesser-toe-phalanges", name: "Lesser Toe Phalanges" },
  { slug: "first-metatarsal-head", name: "First Metatarsal Head" },
  { slug: "digastric-fossa-mandible", name: "Digastric Fossa of Mandible" },
  { slug: "mylohyoid-line", name: "Mylohyoid Line" },
  { slug: "body-of-hyoid", name: "Body of Hyoid" },
  { slug: "superior-mental-spine", name: "Superior Mental Spine" },
  { slug: "inferior-mental-spine", name: "Inferior Mental Spine" },
  { slug: "styloid-process-temporal", name: "Styloid Process of Temporal Bone" },
  { slug: "greater-horn-hyoid", name: "Greater Horn of Hyoid" },
]

const BONE_LANDMARK_MATURITY_TERMS: EntityTermRow[] = LANDMARK_CITATION_MATURITY_SPECS.map((spec) => ({
  id: `term-bone-landmark-${spec.slug}-maturity-preferred`,
  anatomyEntityType: "bone_landmark",
  anatomyEntitySlug: spec.slug,
  term: spec.name,
  termType: "preferred",
  sourceRef: FIPAT_SOURCE,
}))

const BONE_LANDMARK_MATURITY_CITATIONS: CitationRow[] = LANDMARK_CITATION_MATURITY_SPECS.flatMap((spec) => {
  const termId = `term-bone-landmark-${spec.slug}-maturity-preferred`

  return [
    reviewedLandmarkCitation(
      spec.slug,
      "anatomy_landmark",
      `maturity-landmark-${spec.slug}`,
      APPLIED_HUMAN_ANATOMY_SOURCE,
      APPLIED_HUMAN_ANATOMY_LOCATOR,
      "Reviewed commercial-safe maturity citation for an existing bone landmark seed fact.",
    ),
    reviewedLandmarkCitation(
      spec.slug,
      "official_term",
      termId,
      FIPAT_SOURCE,
      FIPAT_LOCATOR,
      "Reviewed terminology maturity citation for an existing bone landmark label.",
    ),
    sourceReferenceCitation(
      "bone_landmark",
      spec.slug,
      `bone_landmark:${spec.slug}`,
      APPLIED_HUMAN_ANATOMY_SOURCE,
      APPLIED_HUMAN_ANATOMY_LOCATOR,
      "Reviewed source-reference row for an existing bone landmark seed record.",
    ),
    sourceReferenceCitation(
      "bone_landmark",
      spec.slug,
      `entity_term:${termId}`,
      FIPAT_SOURCE,
      FIPAT_LOCATOR,
      "Reviewed source-reference row for an existing bone landmark terminology seed record.",
    ),
  ]
})

export const BONE_LANDMARK_CITATION_MATURITY_SECTION: AnatomySeedSection = {
  entityTerms: BONE_LANDMARK_MATURITY_TERMS,
  citations: BONE_LANDMARK_MATURITY_CITATIONS,
}
