import type { AnatomySeedSection } from "./sections.ts"

const APPLIED_HUMAN_ANATOMY_SOURCE = "applied-human-anatomy"
const FIPAT_SOURCE = "fipat-ta2"
const APPLIED_HUMAN_ANATOMY_LOCATOR = "https://open.umn.edu/opentextbooks/textbooks/1266"
const FIPAT_LOCATOR = "https://libraries.dal.ca/Fipat/ta2.html"

type BoneLandmarkRow = NonNullable<AnatomySeedSection["boneLandmarks"]>[number]
type CitationRow = NonNullable<AnatomySeedSection["citations"]>[number]
type EntityTermRow = NonNullable<AnatomySeedSection["entityTerms"]>[number]

type LandmarkSpec = {
  boneSlug: string
  boneName: string
  landmarkSlug: string
  landmarkName: string
  commonTerm: string
  description: string
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

const CERVICAL_VERTEBRAE = [
  ["c3-vertebra", "C3 Vertebra"],
  ["c4-vertebra", "C4 Vertebra"],
  ["c5-vertebra", "C5 Vertebra"],
  ["c6-vertebra", "C6 Vertebra"],
  ["c7-vertebra", "C7 Vertebra"],
] as const

const THORACIC_VERTEBRAE = [
  ["t1-vertebra", "T1 Vertebra"],
  ["t2-vertebra", "T2 Vertebra"],
  ["t3-vertebra", "T3 Vertebra"],
  ["t4-vertebra", "T4 Vertebra"],
  ["t5-vertebra", "T5 Vertebra"],
  ["t6-vertebra", "T6 Vertebra"],
  ["t7-vertebra", "T7 Vertebra"],
  ["t8-vertebra", "T8 Vertebra"],
  ["t9-vertebra", "T9 Vertebra"],
  ["t10-vertebra", "T10 Vertebra"],
  ["t11-vertebra", "T11 Vertebra"],
  ["t12-vertebra", "T12 Vertebra"],
] as const

const LUMBAR_VERTEBRAE = [
  ["l1-vertebra", "L1 Vertebra"],
  ["l2-vertebra", "L2 Vertebra"],
  ["l3-vertebra", "L3 Vertebra"],
  ["l4-vertebra", "L4 Vertebra"],
  ["l5-vertebra", "L5 Vertebra"],
] as const

const RIBS = [
  ["first-rib", "First Rib"],
  ["second-rib", "Second Rib"],
  ["third-rib", "Third Rib"],
  ["fourth-rib", "Fourth Rib"],
  ["fifth-rib", "Fifth Rib"],
  ["sixth-rib", "Sixth Rib"],
  ["seventh-rib", "Seventh Rib"],
  ["eighth-rib", "Eighth Rib"],
  ["ninth-rib", "Ninth Rib"],
  ["tenth-rib", "Tenth Rib"],
  ["eleventh-rib", "Eleventh Rib"],
  ["twelfth-rib", "Twelfth Rib"],
] as const

const CARPALS = [
  ["scaphoid", "Scaphoid"],
  ["lunate", "Lunate"],
  ["triquetrum", "Triquetrum"],
  ["pisiform", "Pisiform"],
  ["trapezium", "Trapezium"],
  ["trapezoid", "Trapezoid"],
  ["capitate", "Capitate"],
  ["hamate", "Hamate"],
] as const

const TARSALS = [
  ["talus", "Talus"],
  ["navicular", "Navicular"],
  ["cuboid", "Cuboid"],
  ["medial-cuneiform", "Medial Cuneiform"],
  ["intermediate-cuneiform", "Intermediate Cuneiform"],
  ["lateral-cuneiform", "Lateral Cuneiform"],
] as const

const METACARPALS = [
  ["first-metacarpal", "First Metacarpal"],
  ["second-metacarpal", "Second Metacarpal"],
  ["third-metacarpal", "Third Metacarpal"],
  ["fourth-metacarpal", "Fourth Metacarpal"],
  ["fifth-metacarpal", "Fifth Metacarpal"],
] as const

const METATARSALS = [
  ["first-metatarsal", "First Metatarsal"],
  ["second-metatarsal", "Second Metatarsal"],
  ["third-metatarsal", "Third Metatarsal"],
  ["fourth-metatarsal", "Fourth Metatarsal"],
  ["fifth-metatarsal", "Fifth Metatarsal"],
] as const

const HAND_PHALANGES = [
  ["proximal-phalanx-thumb-hand", "Proximal Phalanx of Thumb"],
  ["distal-phalanx-thumb-hand", "Distal Phalanx of Thumb"],
  ["proximal-phalanx-index-finger", "Proximal Phalanx of Index Finger"],
  ["middle-phalanx-index-finger", "Middle Phalanx of Index Finger"],
  ["distal-phalanx-index-finger", "Distal Phalanx of Index Finger"],
  ["proximal-phalanx-middle-finger", "Proximal Phalanx of Middle Finger"],
  ["middle-phalanx-middle-finger", "Middle Phalanx of Middle Finger"],
  ["distal-phalanx-middle-finger", "Distal Phalanx of Middle Finger"],
  ["proximal-phalanx-ring-finger", "Proximal Phalanx of Ring Finger"],
  ["middle-phalanx-ring-finger", "Middle Phalanx of Ring Finger"],
  ["distal-phalanx-ring-finger", "Distal Phalanx of Ring Finger"],
  ["proximal-phalanx-little-finger", "Proximal Phalanx of Little Finger"],
  ["middle-phalanx-little-finger", "Middle Phalanx of Little Finger"],
  ["distal-phalanx-little-finger", "Distal Phalanx of Little Finger"],
] as const

const FOOT_PHALANGES = [
  ["proximal-phalanx-hallux", "Proximal Phalanx of Great Toe"],
  ["distal-phalanx-hallux", "Distal Phalanx of Great Toe"],
  ["proximal-phalanx-second-toe", "Proximal Phalanx of Second Toe"],
  ["middle-phalanx-second-toe", "Middle Phalanx of Second Toe"],
  ["distal-phalanx-second-toe", "Distal Phalanx of Second Toe"],
  ["proximal-phalanx-third-toe", "Proximal Phalanx of Third Toe"],
  ["middle-phalanx-third-toe", "Middle Phalanx of Third Toe"],
  ["distal-phalanx-third-toe", "Distal Phalanx of Third Toe"],
  ["proximal-phalanx-fourth-toe", "Proximal Phalanx of Fourth Toe"],
  ["middle-phalanx-fourth-toe", "Middle Phalanx of Fourth Toe"],
  ["distal-phalanx-fourth-toe", "Distal Phalanx of Fourth Toe"],
  ["proximal-phalanx-fifth-toe", "Proximal Phalanx of Fifth Toe"],
  ["middle-phalanx-fifth-toe", "Middle Phalanx of Fifth Toe"],
  ["distal-phalanx-fifth-toe", "Distal Phalanx of Fifth Toe"],
] as const

function vertebralLandmark([boneSlug, boneName]: readonly [string, string]): LandmarkSpec {
  return {
    boneSlug,
    boneName,
    landmarkSlug: `atlas-${boneSlug}-spinous-process`,
    landmarkName: `${boneName} Spinous Process`,
    commonTerm: `${boneName.replace(" Vertebra", "")} spinous process`,
    description: `${boneName} spinous process is the posterior midline landmark used to distinguish this vertebral level in palpation, movement education, and spine-region anatomy search.`,
  }
}

function ribLandmark([boneSlug, boneName]: readonly [string, string]): LandmarkSpec {
  return {
    boneSlug,
    boneName,
    landmarkSlug: `atlas-${boneSlug}-shaft`,
    landmarkName: `${boneName} Shaft`,
    commonTerm: `${boneName} shaft`,
    description: `${boneName} shaft is the elongated curved portion of the rib used for individual rib mapping, intercostal-space orientation, and thoracic cage education.`,
  }
}

function compactBoneLandmark([boneSlug, boneName]: readonly [string, string]): LandmarkSpec {
  return {
    boneSlug,
    boneName,
    landmarkSlug: `atlas-${boneSlug}-body`,
    landmarkName: `${boneName} Body`,
    commonTerm: `${boneName} body`,
    description: `${boneName} body is a seed-addressable reference surface for this small bone so wrist or foot maps can link symptoms, attachments, and neighboring joint relationships to the individual bone.`,
  }
}

function baseCommonTerm(boneName: string) {
  const phalanxMatch = /^(Proximal|Middle|Distal) Phalanx of (.+)$/.exec(boneName)

  if (phalanxMatch) {
    return `${phalanxMatch[2]} ${phalanxMatch[1]} Phalanx Base`
  }

  return `${boneName} Base`
}

function longBoneBaseLandmark([boneSlug, boneName]: readonly [string, string]): LandmarkSpec {
  return {
    boneSlug,
    boneName,
    landmarkSlug: `atlas-${boneSlug}-base`,
    landmarkName: `${boneName} Base`,
    commonTerm: baseCommonTerm(boneName),
    description: `${boneName} base is the proximal reference landmark for this individual bone and supports hand or foot mapping, joint orientation, and attachment context.`,
  }
}

const GROUP_LANDMARKS: LandmarkSpec[] = [
  {
    boneSlug: "cranial-bones",
    boneName: "Cranial Bones",
    landmarkSlug: "atlas-cranial-bones-reference-region",
    landmarkName: "Cranial Bones Reference Region",
    commonTerm: "skull bone group reference",
    description: "The cranial bones reference region groups the skull vault and cranial base for atlas browsing while individual cranial bones remain separately searchable.",
  },
  {
    boneSlug: "facial-bones",
    boneName: "Facial Bones",
    landmarkSlug: "atlas-facial-bones-reference-region",
    landmarkName: "Facial Bones Reference Region",
    commonTerm: "face bone group reference",
    description: "The facial bones reference region groups the facial skeleton for atlas browsing while maxilla, zygomatic, nasal, lacrimal, palatine, vomer, and conchal bones remain individual records.",
  },
  {
    boneSlug: "pelvis",
    boneName: "Pelvis",
    landmarkSlug: "atlas-pelvis-pelvic-ring-reference",
    landmarkName: "Pelvic Ring Reference",
    commonTerm: "pelvis ring reference",
    description: "The pelvic ring reference landmark anchors grouped pelvis education while ilium, ischium, pubis, sacrum, coccyx, and hip-bone landmarks remain individually searchable.",
  },
  {
    boneSlug: "patella",
    boneName: "Patella",
    landmarkSlug: "atlas-patella-anterior-surface",
    landmarkName: "Patella Anterior Surface",
    commonTerm: "kneecap front surface",
    description: "The patella anterior surface is the palpable front of the kneecap and helps connect quadriceps tendon, patellar tendon, and anterior knee body-map language.",
  },
  {
    boneSlug: "tarsals",
    boneName: "Tarsal Bones",
    landmarkSlug: "atlas-tarsals-reference-region",
    landmarkName: "Tarsal Bones Reference Region",
    commonTerm: "ankle and foot bone group reference",
    description: "The tarsal bones reference region groups the hindfoot and midfoot skeleton for atlas browsing while talus, navicular, cuboid, and cuneiform bones remain individual records.",
  },
]

const INDIVIDUAL_BONE_LANDMARK_SPECS: LandmarkSpec[] = [
  ...CERVICAL_VERTEBRAE.map(vertebralLandmark),
  ...THORACIC_VERTEBRAE.map(vertebralLandmark),
  ...LUMBAR_VERTEBRAE.map(vertebralLandmark),
  ...RIBS.map(ribLandmark),
  ...CARPALS.map(compactBoneLandmark),
  ...TARSALS.map(compactBoneLandmark),
  ...METACARPALS.map(longBoneBaseLandmark),
  ...METATARSALS.map(longBoneBaseLandmark),
  ...HAND_PHALANGES.map(longBoneBaseLandmark),
  ...FOOT_PHALANGES.map(longBoneBaseLandmark),
  ...GROUP_LANDMARKS,
]

const INDIVIDUAL_BONE_LANDMARKS: BoneLandmarkRow[] = INDIVIDUAL_BONE_LANDMARK_SPECS.map((spec) => ({
  id: `landmark-${spec.landmarkSlug}`,
  slug: spec.landmarkSlug,
  name: spec.landmarkName,
  bone: spec.boneSlug,
  description: spec.description,
  sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
}))

const INDIVIDUAL_BONE_LANDMARK_TERMS: EntityTermRow[] = INDIVIDUAL_BONE_LANDMARK_SPECS.flatMap((spec) => [
  {
    id: `term-bone-landmark-${spec.landmarkSlug}-preferred`,
    anatomyEntityType: "bone_landmark",
    anatomyEntitySlug: spec.landmarkSlug,
    term: spec.landmarkName,
    termType: "preferred",
    sourceRef: FIPAT_SOURCE,
  },
  {
    id: `term-bone-landmark-${spec.landmarkSlug}-common`,
    anatomyEntityType: "bone_landmark",
    anatomyEntitySlug: spec.landmarkSlug,
    term: spec.commonTerm,
    termType: "common",
    sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
  },
])

const INDIVIDUAL_BONE_LANDMARK_CITATIONS: CitationRow[] = INDIVIDUAL_BONE_LANDMARK_SPECS.flatMap((spec) => {
  const termId = `term-bone-landmark-${spec.landmarkSlug}-preferred`
  const commonTermId = `term-bone-landmark-${spec.landmarkSlug}-common`

  return [
    reviewedLandmarkCitation(
      spec.landmarkSlug,
      "anatomy_landmark",
      `bone-landmark-${spec.landmarkSlug}`,
      APPLIED_HUMAN_ANATOMY_SOURCE,
      APPLIED_HUMAN_ANATOMY_LOCATOR,
      "MassageLab-authored landmark summary reviewed against the commercial-safe applied human anatomy source record.",
    ),
    reviewedLandmarkCitation(
      spec.landmarkSlug,
      "official_term",
      termId,
      FIPAT_SOURCE,
      FIPAT_LOCATOR,
      "Terminology alignment citation for the seed-addressable bone landmark label.",
    ),
    sourceReferenceCitation(
      "bone_landmark",
      spec.landmarkSlug,
      `bone_landmark:${spec.landmarkSlug}`,
      APPLIED_HUMAN_ANATOMY_SOURCE,
      APPLIED_HUMAN_ANATOMY_LOCATOR,
      "Reviewed source-reference row for an individual bone landmark seed record.",
    ),
    sourceReferenceCitation(
      "bone_landmark",
      spec.landmarkSlug,
      `entity_term:${termId}`,
      FIPAT_SOURCE,
      FIPAT_LOCATOR,
      "Reviewed source-reference row for an individual bone landmark terminology seed record.",
    ),
    sourceReferenceCitation(
      "bone_landmark",
      spec.landmarkSlug,
      `entity_term:${commonTermId}`,
      APPLIED_HUMAN_ANATOMY_SOURCE,
      APPLIED_HUMAN_ANATOMY_LOCATOR,
      "Reviewed source-reference row for an individual bone landmark common terminology seed record.",
    ),
  ]
})

export const INDIVIDUAL_BONE_LANDMARK_ATLAS_SECTION: AnatomySeedSection = {
  boneLandmarks: INDIVIDUAL_BONE_LANDMARKS,
  entityTerms: INDIVIDUAL_BONE_LANDMARK_TERMS,
  citations: INDIVIDUAL_BONE_LANDMARK_CITATIONS,
}
