import type { AnatomySeedSection } from "./sections.ts"

const APPLIED_HUMAN_ANATOMY_SOURCE = "applied-human-anatomy"
const FIPAT_SOURCE = "fipat-ta2"
const CLIENT_LANGUAGE_SOURCE = "massagelab-authored-client-language"
const APPLIED_HUMAN_ANATOMY_LOCATOR = "https://open.umn.edu/opentextbooks/textbooks/1266"
const FIPAT_LOCATOR = "https://libraries.dal.ca/Fipat/ta2.html"
const CLIENT_LANGUAGE_LOCATOR = "MassageLab-authored body-map and client-language mapping policy, 2026-05-24"

type CitationRow = NonNullable<AnatomySeedSection["citations"]>[number]
type StructureRow = NonNullable<AnatomySeedSection["structures"]>[number]
type EntityTermRow = NonNullable<AnatomySeedSection["entityTerms"]>[number]
type RelationshipRow = NonNullable<AnatomySeedSection["relationships"]>[number]
type ClientTermRow = NonNullable<AnatomySeedSection["clientTerms"]>[number]

type DermatomeSpec = {
  level: string
  slug: string
  name: string
  region: string
  sensoryArea: string
  targetRegion: string
  commonTerms: string[]
}

type MyotomeSpec = {
  level: string
  slug: string
  name: string
  region: string
  motorAction: string
  targetRegion: string
  referenceMuscles: string[]
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

function reviewedCitation(
  entityType: CitationRow["entityType"],
  entitySlug: string,
  factType: string,
  factSlug: string,
  sourceRef: string,
  sourceLocator: string,
  citationNote: string,
) {
  const slug = `citation-${slugify(entityType)}-${entitySlug}-${slugify(factType)}-${slugify(factSlug)}`

  return {
    id: slug,
    slug,
    entityType,
    entitySlug,
    factType,
    factSlug,
    sourceRef,
    sourceLocator,
    citationNote,
    reviewStatus: "reviewed",
  } satisfies CitationRow
}

function reviewedClientTermCitation(
  clientTermSlug: string,
  factType: string,
  sourceLocator: string,
  citationNote: string,
) {
  const slug = `citation-client-term-${clientTermSlug}-${slugify(factType)}`

  return {
    id: slug,
    slug,
    entityType: "client_term",
    entitySlug: clientTermSlug,
    factType,
    factSlug: `client-term-${clientTermSlug}`,
    sourceRef: CLIENT_LANGUAGE_SOURCE,
    sourceLocator,
    citationNote,
    reviewStatus: "reviewed",
  } satisfies CitationRow
}

const DERMATOME_SPECS: DermatomeSpec[] = [
  { level: "C2", slug: "c2-dermatome", name: "C2 Dermatome", region: "head-neck", sensoryArea: "posterior scalp and upper neck region", targetRegion: "head", commonTerms: ["C2 skin map", "back of head dermatome"] },
  { level: "C3", slug: "c3-dermatome", name: "C3 Dermatome", region: "neck", sensoryArea: "side and back of neck region", targetRegion: "neck", commonTerms: ["C3 skin map", "side neck dermatome"] },
  { level: "C4", slug: "c4-dermatome", name: "C4 Dermatome", region: "neck", sensoryArea: "lower neck and top shoulder region", targetRegion: "shoulder-girdle", commonTerms: ["C4 skin map", "top shoulder dermatome"] },
  { level: "C5", slug: "c5-dermatome", name: "C5 Dermatome", region: "upper-limb", sensoryArea: "lateral upper arm and shoulder region", targetRegion: "arm", commonTerms: ["C5 skin map", "outer upper arm dermatome"] },
  { level: "C6", slug: "c6-dermatome", name: "C6 Dermatome", region: "upper-limb", sensoryArea: "radial forearm, thumb, and lateral hand region", targetRegion: "hand", commonTerms: ["C6 skin map", "thumb dermatome", "radial hand dermatome"] },
  { level: "C7", slug: "c7-dermatome", name: "C7 Dermatome", region: "upper-limb", sensoryArea: "central hand and middle finger region", targetRegion: "hand", commonTerms: ["C7 skin map", "middle finger dermatome"] },
  { level: "C8", slug: "c8-dermatome", name: "C8 Dermatome", region: "upper-limb", sensoryArea: "ulnar hand, ring finger, and little finger region", targetRegion: "hand", commonTerms: ["C8 skin map", "little finger dermatome", "ulnar hand dermatome"] },
  { level: "T1", slug: "t1-dermatome", name: "T1 Dermatome", region: "upper-limb", sensoryArea: "medial forearm and lower medial arm region", targetRegion: "forearm", commonTerms: ["T1 skin map", "inner forearm dermatome"] },
  { level: "T2", slug: "t2-dermatome", name: "T2 Dermatome", region: "thorax", sensoryArea: "upper medial arm, axilla, and upper chest region", targetRegion: "thorax", commonTerms: ["T2 skin map", "armpit dermatome"] },
  { level: "T3", slug: "t3-dermatome", name: "T3 Dermatome", region: "thorax", sensoryArea: "upper chest and upper thoracic trunk region", targetRegion: "thorax", commonTerms: ["T3 skin map", "upper chest dermatome"] },
  { level: "T4", slug: "t4-dermatome", name: "T4 Dermatome", region: "thorax", sensoryArea: "mid chest region often taught near the nipple-line reference area", targetRegion: "thorax", commonTerms: ["T4 skin map", "nipple line dermatome"] },
  { level: "T5", slug: "t5-dermatome", name: "T5 Dermatome", region: "thorax", sensoryArea: "lower chest and thoracic trunk region", targetRegion: "thorax", commonTerms: ["T5 skin map", "lower chest dermatome"] },
  { level: "T6", slug: "t6-dermatome", name: "T6 Dermatome", region: "thorax", sensoryArea: "xiphoid and lower thoracic trunk reference region", targetRegion: "thorax", commonTerms: ["T6 skin map", "xiphoid dermatome"] },
  { level: "T7", slug: "t7-dermatome", name: "T7 Dermatome", region: "abdomen", sensoryArea: "upper abdominal wall region below the lower chest", targetRegion: "abdomen", commonTerms: ["T7 skin map", "upper abdomen dermatome"] },
  { level: "T8", slug: "t8-dermatome", name: "T8 Dermatome", region: "abdomen", sensoryArea: "upper-to-mid abdominal wall reference region", targetRegion: "abdomen", commonTerms: ["T8 skin map", "mid abdomen dermatome"] },
  { level: "T9", slug: "t9-dermatome", name: "T9 Dermatome", region: "abdomen", sensoryArea: "mid abdominal wall reference region above the umbilical level", targetRegion: "abdomen", commonTerms: ["T9 skin map", "middle abdomen dermatome"] },
  { level: "T10", slug: "t10-dermatome", name: "T10 Dermatome", region: "abdomen", sensoryArea: "umbilical abdominal wall reference region", targetRegion: "abdomen", commonTerms: ["T10 skin map", "belly button dermatome", "umbilical dermatome"] },
  { level: "T11", slug: "t11-dermatome", name: "T11 Dermatome", region: "abdomen", sensoryArea: "lower abdominal wall reference region", targetRegion: "abdomen", commonTerms: ["T11 skin map", "lower abdomen dermatome"] },
  { level: "T12", slug: "t12-dermatome", name: "T12 Dermatome", region: "abdomen", sensoryArea: "low abdominal and upper groin reference region", targetRegion: "abdomen", commonTerms: ["T12 skin map", "low abdomen dermatome"] },
  { level: "L1", slug: "l1-dermatome", name: "L1 Dermatome", region: "pelvis", sensoryArea: "inguinal crease and upper groin reference region", targetRegion: "hip", commonTerms: ["L1 skin map", "groin dermatome"] },
  { level: "L2", slug: "l2-dermatome", name: "L2 Dermatome", region: "lower-limb", sensoryArea: "anterior upper thigh reference region", targetRegion: "thigh", commonTerms: ["L2 skin map", "front thigh dermatome"] },
  { level: "L3", slug: "l3-dermatome", name: "L3 Dermatome", region: "lower-limb", sensoryArea: "anterior thigh and medial knee reference region", targetRegion: "knee", commonTerms: ["L3 skin map", "inner knee dermatome"] },
  { level: "L4", slug: "l4-dermatome", name: "L4 Dermatome", region: "lower-limb", sensoryArea: "medial leg and medial ankle reference region", targetRegion: "leg", commonTerms: ["L4 skin map", "inner shin dermatome", "medial ankle dermatome"] },
  { level: "L5", slug: "l5-dermatome", name: "L5 Dermatome", region: "lower-limb", sensoryArea: "lateral leg, dorsum of foot, and great toe reference region", targetRegion: "foot", commonTerms: ["L5 skin map", "big toe dermatome", "top of foot dermatome"] },
  { level: "S1", slug: "s1-dermatome", name: "S1 Dermatome", region: "lower-limb", sensoryArea: "posterior calf, lateral foot, and small-toe-side reference region", targetRegion: "foot", commonTerms: ["S1 skin map", "outer foot dermatome", "lateral foot dermatome"] },
  { level: "S2", slug: "s2-dermatome", name: "S2 Dermatome", region: "lower-limb", sensoryArea: "posterior thigh and upper posterior leg reference region", targetRegion: "thigh", commonTerms: ["S2 skin map", "back thigh dermatome"] },
  { level: "S3", slug: "s3-dermatome", name: "S3 Dermatome", region: "pelvis", sensoryArea: "buttock, medial pelvis, and perineal transition reference region", targetRegion: "pelvis", commonTerms: ["S3 skin map", "saddle area dermatome"] },
  { level: "S4", slug: "s4-dermatome", name: "S4 Dermatome", region: "pelvis", sensoryArea: "perianal and central perineal reference region", targetRegion: "pelvis", commonTerms: ["S4 skin map", "perianal dermatome"] },
  { level: "S5", slug: "s5-dermatome", name: "S5 Dermatome", region: "pelvis", sensoryArea: "central perianal reference region near the lowest sacral segment", targetRegion: "pelvis", commonTerms: ["S5 skin map", "lowest sacral dermatome"] },
  { level: "Co", slug: "coccygeal-dermatome", name: "Coccygeal Dermatome", region: "pelvis", sensoryArea: "small skin region around the coccyx and lowest perianal area", targetRegion: "pelvis", commonTerms: ["coccygeal skin map", "tailbone dermatome"] },
]

const MYOTOME_SPECS: MyotomeSpec[] = [
  { level: "C1", slug: "c1-myotome", name: "C1 Myotome", region: "neck", motorAction: "neck flexion reference control", targetRegion: "neck", referenceMuscles: ["longus-colli"], commonTerms: ["C1 motor level", "neck flexion myotome"] },
  { level: "C2", slug: "c2-myotome", name: "C2 Myotome", region: "neck", motorAction: "neck flexion and extension reference control", targetRegion: "neck", referenceMuscles: ["sternocleidomastoid"], commonTerms: ["C2 motor level", "neck movement myotome"] },
  { level: "C3", slug: "c3-myotome", name: "C3 Myotome", region: "neck", motorAction: "neck side-bending reference control", targetRegion: "neck", referenceMuscles: ["middle-scalene"], commonTerms: ["C3 motor level", "side neck myotome"] },
  { level: "C4", slug: "c4-myotome", name: "C4 Myotome", region: "shoulder-girdle", motorAction: "shoulder elevation reference control", targetRegion: "shoulder-girdle", referenceMuscles: ["levator-scapulae"], commonTerms: ["C4 motor level", "shoulder shrug myotome"] },
  { level: "C5", slug: "c5-myotome", name: "C5 Myotome", region: "upper-limb", motorAction: "shoulder abduction and elbow flexion reference control", targetRegion: "arm", referenceMuscles: ["deltoid", "biceps-brachii"], commonTerms: ["C5 motor level", "shoulder abduction myotome"] },
  { level: "C6", slug: "c6-myotome", name: "C6 Myotome", region: "upper-limb", motorAction: "elbow flexion and wrist extension reference control", targetRegion: "forearm", referenceMuscles: ["biceps-brachii", "extensor-carpi-radialis"], commonTerms: ["C6 motor level", "wrist extension myotome"] },
  { level: "C7", slug: "c7-myotome", name: "C7 Myotome", region: "upper-limb", motorAction: "elbow extension and wrist flexion reference control", targetRegion: "arm", referenceMuscles: ["triceps-brachii", "flexor-carpi-radialis"], commonTerms: ["C7 motor level", "elbow extension myotome"] },
  { level: "C8", slug: "c8-myotome", name: "C8 Myotome", region: "upper-limb", motorAction: "finger flexion reference control", targetRegion: "hand", referenceMuscles: ["flexor-digitorum-profundus"], commonTerms: ["C8 motor level", "finger flexion myotome"] },
  { level: "T1", slug: "t1-myotome", name: "T1 Myotome", region: "upper-limb", motorAction: "finger abduction and adduction reference control", targetRegion: "hand", referenceMuscles: ["dorsal-interossei-hand"], commonTerms: ["T1 motor level", "finger abduction myotome"] },
  { level: "T2", slug: "t2-myotome", name: "T2 Myotome", region: "thorax", motorAction: "upper thoracic trunk and intercostal reference control", targetRegion: "thorax", referenceMuscles: ["external-intercostals"], commonTerms: ["T2 motor level", "upper trunk myotome"] },
  { level: "T3", slug: "t3-myotome", name: "T3 Myotome", region: "thorax", motorAction: "upper thoracic intercostal reference control", targetRegion: "thorax", referenceMuscles: ["external-intercostals"], commonTerms: ["T3 motor level", "upper intercostal myotome"] },
  { level: "T4", slug: "t4-myotome", name: "T4 Myotome", region: "thorax", motorAction: "mid thoracic intercostal reference control", targetRegion: "thorax", referenceMuscles: ["internal-intercostals"], commonTerms: ["T4 motor level", "mid chest myotome"] },
  { level: "T5", slug: "t5-myotome", name: "T5 Myotome", region: "thorax", motorAction: "mid thoracic trunk wall reference control", targetRegion: "thorax", referenceMuscles: ["internal-intercostals"], commonTerms: ["T5 motor level", "thoracic wall myotome"] },
  { level: "T6", slug: "t6-myotome", name: "T6 Myotome", region: "thorax", motorAction: "lower thoracic trunk wall reference control", targetRegion: "thorax", referenceMuscles: ["internal-intercostals"], commonTerms: ["T6 motor level", "lower chest myotome"] },
  { level: "T7", slug: "t7-myotome", name: "T7 Myotome", region: "abdomen", motorAction: "upper abdominal wall reference control", targetRegion: "abdomen", referenceMuscles: ["rectus-abdominis"], commonTerms: ["T7 motor level", "upper abdominal myotome"] },
  { level: "T8", slug: "t8-myotome", name: "T8 Myotome", region: "abdomen", motorAction: "upper-to-mid abdominal wall reference control", targetRegion: "abdomen", referenceMuscles: ["rectus-abdominis"], commonTerms: ["T8 motor level", "abdominal wall myotome"] },
  { level: "T9", slug: "t9-myotome", name: "T9 Myotome", region: "abdomen", motorAction: "mid abdominal wall reference control", targetRegion: "abdomen", referenceMuscles: ["external-oblique"], commonTerms: ["T9 motor level", "oblique myotome"] },
  { level: "T10", slug: "t10-myotome", name: "T10 Myotome", region: "abdomen", motorAction: "umbilical abdominal wall reference control", targetRegion: "abdomen", referenceMuscles: ["internal-oblique"], commonTerms: ["T10 motor level", "belly button myotome"] },
  { level: "T11", slug: "t11-myotome", name: "T11 Myotome", region: "abdomen", motorAction: "lower abdominal wall reference control", targetRegion: "abdomen", referenceMuscles: ["transversus-abdominis"], commonTerms: ["T11 motor level", "lower abdominal myotome"] },
  { level: "T12", slug: "t12-myotome", name: "T12 Myotome", region: "abdomen", motorAction: "low abdominal wall reference control", targetRegion: "abdomen", referenceMuscles: ["transversus-abdominis"], commonTerms: ["T12 motor level", "low abdomen myotome"] },
  { level: "L1", slug: "l1-myotome", name: "L1 Myotome", region: "pelvis", motorAction: "hip flexion and lower abdominal transition reference control", targetRegion: "hip", referenceMuscles: ["iliopsoas"], commonTerms: ["L1 motor level", "groin flexion myotome"] },
  { level: "L2", slug: "l2-myotome", name: "L2 Myotome", region: "lower-limb", motorAction: "hip flexion reference control", targetRegion: "hip", referenceMuscles: ["iliopsoas", "psoas-major"], commonTerms: ["L2 motor level", "hip flexion myotome"] },
  { level: "L3", slug: "l3-myotome", name: "L3 Myotome", region: "lower-limb", motorAction: "knee extension reference control", targetRegion: "knee", referenceMuscles: ["rectus-femoris"], commonTerms: ["L3 motor level", "knee extension myotome"] },
  { level: "L4", slug: "l4-myotome", name: "L4 Myotome", region: "lower-limb", motorAction: "ankle dorsiflexion reference control", targetRegion: "ankle", referenceMuscles: ["tibialis-anterior"], commonTerms: ["L4 motor level", "ankle dorsiflexion myotome"] },
  { level: "L5", slug: "l5-myotome", name: "L5 Myotome", region: "lower-limb", motorAction: "great toe extension and hip abduction reference control", targetRegion: "foot", referenceMuscles: ["extensor-hallucis-longus", "gluteus-medius"], commonTerms: ["L5 motor level", "big toe extension myotome"] },
  { level: "S1", slug: "s1-myotome", name: "S1 Myotome", region: "lower-limb", motorAction: "ankle plantarflexion reference control", targetRegion: "ankle", referenceMuscles: ["gastrocnemius", "soleus"], commonTerms: ["S1 motor level", "ankle plantarflexion myotome"] },
  { level: "S2", slug: "s2-myotome", name: "S2 Myotome", region: "lower-limb", motorAction: "knee flexion reference control", targetRegion: "knee", referenceMuscles: ["biceps-femoris", "semitendinosus"], commonTerms: ["S2 motor level", "knee flexion myotome"] },
  { level: "S3", slug: "s3-myotome", name: "S3 Myotome", region: "pelvis", motorAction: "pelvic floor reference control", targetRegion: "pelvis", referenceMuscles: ["levator-ani"], commonTerms: ["S3 motor level", "pelvic floor myotome"] },
  { level: "S4", slug: "s4-myotome", name: "S4 Myotome", region: "pelvis", motorAction: "pelvic floor and coccygeal support reference control", targetRegion: "pelvis", referenceMuscles: ["coccygeus"], commonTerms: ["S4 motor level", "sacral pelvic floor myotome"] },
  { level: "S5", slug: "s5-myotome", name: "S5 Myotome", region: "pelvis", motorAction: "lowest sacral pelvic support reference control", targetRegion: "pelvis", referenceMuscles: ["coccygeus"], commonTerms: ["S5 motor level", "lowest sacral myotome"] },
]

function dermatomeDescription(spec: DermatomeSpec) {
  return `${spec.name} is a segmental sensory reference map for the ${spec.sensoryArea}. MassageLab stores it as a non-diagnostic education and body-map structure so therapists can connect client language with spinal segment patterns while still referring out when symptoms suggest medical evaluation.`
}

function myotomeDescription(spec: MyotomeSpec) {
  return `${spec.name} is a segmental motor reference map associated with ${spec.motorAction}. MassageLab stores it as a non-diagnostic education and SOAP-tag structure that links spinal level language to representative muscles without implying a diagnosis or neurological exam result.`
}

const DERMATOME_STRUCTURES: StructureRow[] = DERMATOME_SPECS.map((spec) => ({
  id: `structure-${spec.slug}`,
  slug: spec.slug,
  name: spec.name,
  structureType: "dermatome",
  region: spec.region,
  description: dermatomeDescription(spec),
  sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
}))

const MYOTOME_STRUCTURES: StructureRow[] = MYOTOME_SPECS.map((spec) => ({
  id: `structure-${spec.slug}`,
  slug: spec.slug,
  name: spec.name,
  structureType: "myotome",
  region: spec.region,
  description: myotomeDescription(spec),
  sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
}))

const DERMATOME_MYOTOME_STRUCTURES = [...DERMATOME_STRUCTURES, ...MYOTOME_STRUCTURES]

const DERMATOME_MYOTOME_ENTITY_TERMS: EntityTermRow[] = [
  ...DERMATOME_SPECS.flatMap((spec) => [
    {
      id: `term-structure-${spec.slug}-preferred-fipat`,
      anatomyEntityType: "anatomy_structure" as const,
      anatomyEntitySlug: spec.slug,
      term: spec.name,
      termType: "preferred" as const,
      sourceRef: FIPAT_SOURCE,
    },
    ...spec.commonTerms.map((term, index) => ({
      id: `term-structure-${spec.slug}-common-${index + 1}`,
      anatomyEntityType: "anatomy_structure" as const,
      anatomyEntitySlug: spec.slug,
      term,
      termType: "common" as const,
      sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
    })),
  ]),
  ...MYOTOME_SPECS.flatMap((spec) => [
    {
      id: `term-structure-${spec.slug}-preferred-fipat`,
      anatomyEntityType: "anatomy_structure" as const,
      anatomyEntitySlug: spec.slug,
      term: spec.name,
      termType: "preferred" as const,
      sourceRef: FIPAT_SOURCE,
    },
    ...spec.commonTerms.map((term, index) => ({
      id: `term-structure-${spec.slug}-common-${index + 1}`,
      anatomyEntityType: "anatomy_structure" as const,
      anatomyEntitySlug: spec.slug,
      term,
      termType: "common" as const,
      sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
    })),
  ]),
]

const DERMATOME_RELATIONSHIPS: RelationshipRow[] = DERMATOME_SPECS.map((spec) => ({
  id: `relationship-${spec.slug}-sensory-region-${spec.targetRegion}`,
  sourceEntityType: "anatomy_structure",
  sourceEntitySlug: spec.slug,
  relationshipType: "sensory_region",
  targetEntityType: "region",
  targetEntitySlug: spec.targetRegion,
  details: {
    spinalLevel: spec.level,
    sensoryArea: spec.sensoryArea,
    clinicalUse: "non-diagnostic reference map",
  },
  sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
}))

const MYOTOME_RELATIONSHIPS: RelationshipRow[] = MYOTOME_SPECS.flatMap((spec) => [
  {
    id: `relationship-${spec.slug}-motor-region-${spec.targetRegion}`,
    sourceEntityType: "anatomy_structure" as const,
    sourceEntitySlug: spec.slug,
    relationshipType: "motor_region",
    targetEntityType: "region" as const,
    targetEntitySlug: spec.targetRegion,
    details: {
      spinalLevel: spec.level,
      motorAction: spec.motorAction,
      clinicalUse: "non-diagnostic reference map",
    },
    sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
  },
  ...spec.referenceMuscles.map((muscleSlug) => ({
    id: `relationship-${spec.slug}-motor-reference-muscle-${muscleSlug}`,
    sourceEntityType: "anatomy_structure" as const,
    sourceEntitySlug: spec.slug,
    relationshipType: "motor_reference_muscle",
    targetEntityType: "muscle" as const,
    targetEntitySlug: muscleSlug,
    details: {
      spinalLevel: spec.level,
      motorAction: spec.motorAction,
      clinicalUse: "representative education mapping",
    },
    sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
  })),
])

const DERMATOME_MYOTOME_RELATIONSHIPS = [...DERMATOME_RELATIONSHIPS, ...MYOTOME_RELATIONSHIPS]

const DERMATOME_MYOTOME_CLIENT_TERMS: ClientTermRow[] = [
  {
    id: "client-term-thumb-numbness",
    slug: "thumb-numbness",
    term: "thumb numbness",
    plainLanguageDescription: "Client phrase for altered sensation around the thumb-side hand region, mapped broadly to the C6 dermatome reference pattern.",
    mappedRegionSlug: "hand",
    mappedStructureSlug: "c6-dermatome",
    confidence: "broad",
    clinicalUse: "non-diagnostic",
    likelyRegions: ["hand", "forearm", "upper-limb"],
    likelyStructures: ["c6-dermatome", "median-nerve", "radial-nerve"],
    therapistPrompt: "Clarify onset, distribution, weakness, neck symptoms, and referral indicators before treating as local soft-tissue tightness.",
    sourceRef: CLIENT_LANGUAGE_SOURCE,
  },
  {
    id: "client-term-little-finger-numbness",
    slug: "little-finger-numbness",
    term: "little finger numbness",
    plainLanguageDescription: "Client phrase for altered sensation around the little-finger side of the hand, mapped broadly to the C8 dermatome reference pattern.",
    mappedRegionSlug: "hand",
    mappedStructureSlug: "c8-dermatome",
    confidence: "broad",
    clinicalUse: "non-diagnostic",
    likelyRegions: ["hand", "forearm", "upper-limb"],
    likelyStructures: ["c8-dermatome", "ulnar-nerve", "brachial-plexus"],
    therapistPrompt: "Clarify whether the sensation follows the ulnar hand, forearm, elbow, shoulder, or neck before choosing education or referral language.",
    sourceRef: CLIENT_LANGUAGE_SOURCE,
  },
  {
    id: "client-term-big-toe-numbness",
    slug: "big-toe-numbness",
    term: "big toe numbness",
    plainLanguageDescription: "Client phrase for altered sensation around the great toe and top-of-foot region, mapped broadly to the L5 dermatome reference pattern.",
    mappedRegionSlug: "foot",
    mappedStructureSlug: "l5-dermatome",
    confidence: "broad",
    clinicalUse: "non-diagnostic",
    likelyRegions: ["foot", "ankle", "leg"],
    likelyStructures: ["l5-dermatome", "deep-fibular-nerve", "sciatic-nerve"],
    therapistPrompt: "Clarify whether symptoms include weakness, radiating leg symptoms, back symptoms, diabetes history, or urgent referral signs.",
    sourceRef: CLIENT_LANGUAGE_SOURCE,
  },
  {
    id: "client-term-front-thigh-nerve-area",
    slug: "front-thigh-nerve-area",
    term: "front thigh nerve area",
    plainLanguageDescription: "Client phrase for altered or unusual sensation in the anterior thigh region, mapped broadly to the L2 dermatome reference pattern.",
    mappedRegionSlug: "thigh",
    mappedStructureSlug: "l2-dermatome",
    confidence: "broad",
    clinicalUse: "non-diagnostic",
    likelyRegions: ["thigh", "hip", "pelvis"],
    likelyStructures: ["l2-dermatome", "femoral-nerve", "lumbar-plexus"],
    therapistPrompt: "Clarify exact thigh location, back or hip symptoms, weakness, and medical referral indicators before local tissue framing.",
    sourceRef: CLIENT_LANGUAGE_SOURCE,
  },
  {
    id: "client-term-outer-foot-nerve-area",
    slug: "outer-foot-nerve-area",
    term: "outer foot nerve area",
    plainLanguageDescription: "Client phrase for altered sensation along the lateral foot, mapped broadly to the S1 dermatome reference pattern.",
    mappedRegionSlug: "foot",
    mappedStructureSlug: "s1-dermatome",
    confidence: "broad",
    clinicalUse: "non-diagnostic",
    likelyRegions: ["foot", "ankle", "leg"],
    likelyStructures: ["s1-dermatome", "tibial-nerve", "sciatic-nerve"],
    therapistPrompt: "Clarify whether symptoms follow the lateral foot, calf, posterior leg, or back and screen for referral indicators.",
    sourceRef: CLIENT_LANGUAGE_SOURCE,
  },
]

const STRUCTURE_REVIEWED_CITATIONS: CitationRow[] = [
  ...DERMATOME_SPECS.map((spec) => ({
    spec,
    factType: "clinical_summary",
    factSlug: `structure-${spec.slug}`,
    note: "MassageLab-authored dermatome reference summary verified against Applied Human Anatomy spinal nerve and segmental sensory material.",
  })),
  ...MYOTOME_SPECS.map((spec) => ({
    spec,
    factType: "clinical_summary",
    factSlug: `structure-${spec.slug}`,
    note: "MassageLab-authored myotome reference summary verified against Applied Human Anatomy spinal nerve and segmental motor material.",
  })),
].flatMap(({ spec, factType, factSlug, note }) => [
  reviewedCitation(
    "anatomy_structure",
    spec.slug,
    "official_term",
    `term-structure-${spec.slug}-preferred-fipat`,
    FIPAT_SOURCE,
    spec.slug.endsWith("dermatome") ? "FIPAT TA2: Dermatome terminology" : "FIPAT TA2: Myotome terminology",
    "FIPAT terminology source used for the anatomical segment-map term row; MassageLab applies the specific spinal level label in authored educational data.",
  ),
  reviewedCitation(
    "anatomy_structure",
    spec.slug,
    factType,
    factSlug,
    APPLIED_HUMAN_ANATOMY_SOURCE,
    APPLIED_HUMAN_ANATOMY_LOCATOR,
    note,
  ),
  sourceReferenceCitation(
    "anatomy_structure",
    spec.slug,
    `anatomy_structure:${spec.slug}`,
    APPLIED_HUMAN_ANATOMY_SOURCE,
    APPLIED_HUMAN_ANATOMY_LOCATOR,
    "Reviewed exact seed source reference for this dermatome or myotome structure row.",
  ),
])

const TERM_SOURCE_REFERENCE_CITATIONS: CitationRow[] = DERMATOME_MYOTOME_ENTITY_TERMS.map((term) => sourceReferenceCitation(
  term.anatomyEntityType,
  term.anatomyEntitySlug,
  `entity_term:${term.id}`,
  term.sourceRef,
  term.sourceRef === FIPAT_SOURCE ? FIPAT_LOCATOR : APPLIED_HUMAN_ANATOMY_LOCATOR,
  "Reviewed exact seed source reference for this dermatome or myotome terminology row.",
))

const RELATIONSHIP_CITATIONS: CitationRow[] = DERMATOME_MYOTOME_RELATIONSHIPS.flatMap((relationship) => [
  reviewedCitation(
    relationship.sourceEntityType,
    relationship.sourceEntitySlug,
    relationship.relationshipType === "sensory_region" ? "dermatome_mapping" : "myotome_mapping",
    relationship.id,
    relationship.sourceRef,
    APPLIED_HUMAN_ANATOMY_LOCATOR,
    relationship.relationshipType === "sensory_region"
      ? "Dermatome sensory-region relationship verified against Applied Human Anatomy spinal nerve and segmental sensory material."
      : "Myotome motor-reference relationship verified against Applied Human Anatomy spinal nerve and segmental motor material.",
  ),
  sourceReferenceCitation(
    relationship.sourceEntityType,
    relationship.sourceEntitySlug,
    `relationship:${relationship.id}`,
    relationship.sourceRef,
    APPLIED_HUMAN_ANATOMY_LOCATOR,
    "Reviewed exact seed source reference for this dermatome or myotome relationship row.",
  ),
])

const CLIENT_TERM_SOURCE_REFERENCE_CITATIONS: CitationRow[] = DERMATOME_MYOTOME_CLIENT_TERMS.map((clientTerm) => sourceReferenceCitation(
  "client_term",
  clientTerm.slug,
  `client_term:${clientTerm.slug}`,
  clientTerm.sourceRef,
  CLIENT_LANGUAGE_LOCATOR,
  "Reviewed exact seed source reference for this MassageLab-authored neurologic client-language row.",
))

const CLIENT_TERM_REVIEWED_CITATIONS: CitationRow[] = DERMATOME_MYOTOME_CLIENT_TERMS.flatMap((clientTerm) => [
  reviewedClientTermCitation(
    clientTerm.slug,
    "client_language",
    CLIENT_LANGUAGE_LOCATOR,
    "MassageLab-authored non-diagnostic client phrase reviewed for neurologic body-map language.",
  ),
  reviewedClientTermCitation(
    clientTerm.slug,
    "anatomy_mapping",
    CLIENT_LANGUAGE_LOCATOR,
    "MassageLab-authored client phrase mapped broadly to normalized dermatome reference structures and likely regional context.",
  ),
])

export const DERMATOME_MYOTOME_ATLAS_SECTION: AnatomySeedSection = {
  structures: DERMATOME_MYOTOME_STRUCTURES,
  clientTerms: DERMATOME_MYOTOME_CLIENT_TERMS,
  entityTerms: DERMATOME_MYOTOME_ENTITY_TERMS,
  relationships: DERMATOME_MYOTOME_RELATIONSHIPS,
  citations: [
    ...STRUCTURE_REVIEWED_CITATIONS,
    ...TERM_SOURCE_REFERENCE_CITATIONS,
    ...RELATIONSHIP_CITATIONS,
    ...CLIENT_TERM_SOURCE_REFERENCE_CITATIONS,
    ...CLIENT_TERM_REVIEWED_CITATIONS,
  ],
}
