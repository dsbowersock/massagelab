import type { AnatomySeedSection } from "./sections.ts"

const APPLIED_HUMAN_ANATOMY_SOURCE = "applied-human-anatomy"
const FIPAT_SOURCE = "fipat-ta2"
const CLIENT_LANGUAGE_SOURCE = "massagelab-authored-client-language"
const APPLIED_HUMAN_ANATOMY_LOCATOR = "https://open.umn.edu/opentextbooks/textbooks/1266"
const FIPAT_LOCATOR = "https://libraries.dal.ca/Fipat/ta2.html"
const CLIENT_LANGUAGE_LOCATOR = "MassageLab-authored body-map and client-language mapping policy, 2026-05-23"

type CitationRow = NonNullable<AnatomySeedSection["citations"]>[number]
type StructureRow = NonNullable<AnatomySeedSection["structures"]>[number]
type EntityTermRow = NonNullable<AnatomySeedSection["entityTerms"]>[number]
type RelationshipRow = NonNullable<AnatomySeedSection["relationships"]>[number]
type ClientTermRow = NonNullable<AnatomySeedSection["clientTerms"]>[number]

type SoftTissueStructureSpec = {
  slug: string
  name: string
  structureType: string
  region: string
  formalTerm: string
  officialLocator: string
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

function reviewedStructureCitation(
  structureSlug: string,
  factType: string,
  factSlug: string,
  sourceRef: string,
  sourceLocator: string,
  citationNote: string,
) {
  const slug = `citation-structure-${structureSlug}-${slugify(factType)}-${slugify(factSlug)}`

  return {
    id: slug,
    slug,
    entityType: "anatomy_structure",
    entitySlug: structureSlug,
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

const SOFT_TISSUE_STRUCTURE_SPECS: SoftTissueStructureSpec[] = [
  {
    slug: "subacromial-subdeltoid-bursa",
    name: "Subacromial-Subdeltoid Bursa",
    structureType: "bursa",
    region: "glenohumeral-region",
    formalTerm: "Subacromial and subdeltoid bursae",
    officialLocator: "FIPAT TA2: Bursa subacromialis; bursa subdeltoidea",
    description: "The subacromial-subdeltoid bursal region lies between the coracoacromial arch, deltoid region, and superior rotator cuff tendon area. It is mapped as a non-diagnostic shoulder friction-reducing structure for education and body-map context.",
    commonTerms: ["shoulder bursa", "top shoulder bursa", "subacromial bursa"],
  },
  {
    slug: "subscapular-bursa",
    name: "Subscapular Bursa",
    structureType: "bursa",
    region: "glenohumeral-region",
    formalTerm: "Subscapular bursa",
    officialLocator: "FIPAT TA2: Bursa subtendinea musculi subscapularis",
    description: "The subscapular bursa is an anterior shoulder bursal structure related to the subscapularis tendon and glenohumeral capsule. It supports front-shoulder mapping without implying a diagnosis.",
    commonTerms: ["front shoulder bursa", "subscapularis bursa"],
  },
  {
    slug: "bicipital-tendon-sheath",
    name: "Bicipital Tendon Sheath",
    structureType: "tendon_sheath",
    region: "glenohumeral-region",
    formalTerm: "Synovial sheath of tendon of long head of biceps brachii",
    officialLocator: "FIPAT TA2: Vagina synovialis tendinis capitis longi musculi bicipitis brachii",
    description: "The bicipital tendon sheath surrounds the long-head biceps tendon as it courses through the intertubercular sulcus region. It helps connect shoulder, arm, and anterior groove anatomy in the database.",
    commonTerms: ["biceps tendon sheath", "bicipital groove sheath"],
  },
  {
    slug: "glenoid-labrum",
    name: "Glenoid Labrum",
    structureType: "fibrocartilaginous_labrum",
    region: "glenohumeral-region",
    formalTerm: "Glenoid labrum",
    officialLocator: "FIPAT TA2: Labrum glenoidale",
    description: "The glenoid labrum is a fibrocartilaginous rim around the glenoid cavity that deepens the shoulder socket and anchors capsule-related structures. It is useful for shoulder education, game prompts, and anatomy search.",
    commonTerms: ["shoulder labrum", "shoulder socket rim"],
  },
  {
    slug: "acetabular-labrum",
    name: "Acetabular Labrum",
    structureType: "fibrocartilaginous_labrum",
    region: "hip",
    formalTerm: "Acetabular labrum",
    officialLocator: "FIPAT TA2: Labrum acetabulare",
    description: "The acetabular labrum is a fibrocartilaginous rim around the acetabulum that deepens the hip socket and helps organize hip-joint capsule education and body-map references.",
    commonTerms: ["hip labrum", "hip socket labrum"],
  },
  {
    slug: "trochanteric-bursa",
    name: "Trochanteric Bursa",
    structureType: "bursa",
    region: "hip",
    formalTerm: "Trochanteric bursa",
    officialLocator: "FIPAT TA2: Bursa trochanterica",
    description: "The trochanteric bursal region is located over the greater trochanter and relates to lateral hip soft-tissue gliding near gluteal tendons and the iliotibial tract region. It is a location and anatomy term, not a diagnosis.",
    commonTerms: ["outer hip bursa", "greater trochanter bursa", "side hip bursa"],
  },
  {
    slug: "iliopsoas-bursa",
    name: "Iliopsoas Bursa",
    structureType: "bursa",
    region: "hip",
    formalTerm: "Iliopsoas bursa",
    officialLocator: "FIPAT TA2: Bursa iliopectinea",
    description: "The iliopsoas bursa sits near the anterior hip capsule and iliopsoas tendon region. It supports client-language mapping for deep front hip anatomy while remaining non-diagnostic.",
    commonTerms: ["front hip bursa", "iliopsoas tendon bursa"],
  },
  {
    slug: "ischial-bursa",
    name: "Ischial Bursa",
    structureType: "bursa",
    region: "hip",
    formalTerm: "Ischial bursa",
    officialLocator: "FIPAT TA2: Bursa ischiadica",
    description: "The ischial bursa is mapped near the ischial tuberosity and proximal hamstring region. It supports sit-bone education and body-map language without making pathology claims.",
    commonTerms: ["sit bone bursa", "ischial tuberosity bursa"],
  },
  {
    slug: "medial-meniscus",
    name: "Medial Meniscus",
    structureType: "fibrocartilage",
    region: "knee",
    formalTerm: "Medial meniscus",
    officialLocator: "FIPAT TA2: Meniscus medialis",
    description: "The medial meniscus is the inner fibrocartilaginous wedge of the knee joint between the medial femoral and tibial condyle regions. It refines the older grouped knee-meniscus scaffold into an individual structure.",
    commonTerms: ["inner knee meniscus", "inside knee cartilage"],
  },
  {
    slug: "lateral-meniscus",
    name: "Lateral Meniscus",
    structureType: "fibrocartilage",
    region: "knee",
    formalTerm: "Lateral meniscus",
    officialLocator: "FIPAT TA2: Meniscus lateralis",
    description: "The lateral meniscus is the outer fibrocartilaginous wedge of the knee joint between the lateral femoral and tibial condyle regions. It is represented separately for precise knee education and relationships.",
    commonTerms: ["outer knee meniscus", "outside knee cartilage"],
  },
  {
    slug: "prepatellar-bursa",
    name: "Prepatellar Bursa",
    structureType: "bursa",
    region: "knee",
    formalTerm: "Prepatellar bursa",
    officialLocator: "FIPAT TA2: Bursa prepatellaris",
    description: "The prepatellar bursa is a superficial anterior knee bursal structure over the patella. It supports front-kneecap location mapping and therapist education without diagnosing swelling or irritation.",
    commonTerms: ["front kneecap bursa", "kneecap bursa"],
  },
  {
    slug: "superficial-infrapatellar-bursa",
    name: "Superficial Infrapatellar Bursa",
    structureType: "bursa",
    region: "knee",
    formalTerm: "Superficial infrapatellar bursa",
    officialLocator: "FIPAT TA2: Bursa infrapatellaris subcutanea",
    description: "The superficial infrapatellar bursa is an anterior knee bursal structure near the skin and patellar tendon region below the patella. It helps distinguish surface-level kneecap tendon area mapping.",
    commonTerms: ["surface below kneecap bursa", "superficial kneecap tendon bursa"],
  },
  {
    slug: "deep-infrapatellar-bursa",
    name: "Deep Infrapatellar Bursa",
    structureType: "bursa",
    region: "knee",
    formalTerm: "Deep infrapatellar bursa",
    officialLocator: "FIPAT TA2: Bursa infrapatellaris profunda",
    description: "The deep infrapatellar bursa lies deeper to the patellar tendon region near the tibial tuberosity and anterior knee joint. It supports layered anterior knee anatomy for body maps and education.",
    commonTerms: ["deep kneecap tendon bursa", "deep infrapatellar bursa"],
  },
  {
    slug: "pes-anserine-bursa",
    name: "Pes Anserine Bursa",
    structureType: "bursa",
    region: "knee",
    formalTerm: "Anserine bursa",
    officialLocator: "FIPAT TA2: Bursa anserina",
    description: "The pes anserine bursa is mapped at the medial proximal tibia near the sartorius, gracilis, and semitendinosus tendon region. It supports inner-knee location language and attachment relationships.",
    commonTerms: ["inner knee bursa", "pes bursa", "goose foot bursa"],
  },
  {
    slug: "retrocalcaneal-bursa",
    name: "Retrocalcaneal Bursa",
    structureType: "bursa",
    region: "ankle",
    formalTerm: "Bursa of calcaneal tendon",
    officialLocator: "FIPAT TA2: Bursa tendinis calcanei",
    description: "The retrocalcaneal bursa sits between the calcaneal tendon region and posterior calcaneus. It supports heel and Achilles-area anatomy mapping without implying a clinical diagnosis.",
    commonTerms: ["heel bursa", "Achilles bursa", "back of heel bursa"],
  },
  {
    slug: "common-flexor-synovial-sheath",
    name: "Common Flexor Synovial Sheath",
    structureType: "tendon_sheath",
    region: "wrist",
    formalTerm: "Common synovial sheath of flexor tendons",
    officialLocator: "FIPAT TA2: Vagina synovialis communis musculorum flexorum",
    description: "The common flexor synovial sheath is the ulnar-side synovial sheath system for finger flexor tendons through the carpal tunnel region. It adds tendon-sheath detail for wrist and hand education.",
    commonTerms: ["ulnar bursa", "finger flexor tendon sheath", "carpal tunnel tendon sheath"],
  },
  {
    slug: "flexor-pollicis-longus-synovial-sheath",
    name: "Flexor Pollicis Longus Synovial Sheath",
    structureType: "tendon_sheath",
    region: "wrist",
    formalTerm: "Synovial sheath of flexor pollicis longus tendon",
    officialLocator: "FIPAT TA2: Vagina tendinis musculi flexoris pollicis longi",
    description: "The flexor pollicis longus synovial sheath is the thumb-side sheath for the long thumb flexor tendon as it passes through the wrist and palm. It supports precise thumb and carpal tunnel region mapping.",
    commonTerms: ["radial bursa", "thumb flexor tendon sheath"],
  },
  {
    slug: "extensor-tendon-sheaths-wrist",
    name: "Extensor Tendon Sheaths of Wrist",
    structureType: "tendon_sheath_group",
    region: "wrist",
    formalTerm: "Synovial sheaths of extensor tendons of wrist",
    officialLocator: "FIPAT TA2: Vaginae tendinum musculorum extensorum manus",
    description: "The extensor tendon sheaths of the wrist group the dorsal synovial sheaths associated with tendons passing under the extensor retinaculum. They support top-of-wrist tendon mapping.",
    commonTerms: ["back of wrist tendon sheaths", "dorsal wrist tendon sheaths"],
  },
  {
    slug: "fibular-tendon-sheath",
    name: "Fibular Tendon Sheath",
    structureType: "tendon_sheath",
    region: "ankle",
    formalTerm: "Synovial sheath of fibular tendons",
    officialLocator: "FIPAT TA2: Vagina tendinum musculorum fibularium",
    description: "The fibular tendon sheath is a lateral ankle tendon-sheath region for fibularis longus and brevis tendons as they pass behind the lateral malleolus. It supports outer-ankle anatomy mapping.",
    commonTerms: ["peroneal tendon sheath", "outer ankle tendon sheath"],
  },
  {
    slug: "tibialis-posterior-tendon-sheath",
    name: "Tibialis Posterior Tendon Sheath",
    structureType: "tendon_sheath",
    region: "ankle",
    formalTerm: "Synovial sheath of tibialis posterior tendon",
    officialLocator: "FIPAT TA2: Vagina tendinis musculi tibialis posterioris",
    description: "The tibialis posterior tendon sheath is a medial ankle tendon-sheath region for the tibialis posterior tendon as it curves behind the medial malleolus toward the arch. It supports medial-ankle and arch mapping.",
    commonTerms: ["inner ankle tendon sheath", "posterior tibial tendon sheath"],
  },
]

const SOFT_TISSUE_STRUCTURES: StructureRow[] = SOFT_TISSUE_STRUCTURE_SPECS.map((spec) => ({
  id: `structure-${spec.slug}`,
  slug: spec.slug,
  name: spec.name,
  structureType: spec.structureType,
  region: spec.region,
  description: spec.description,
  sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
}))

const SOFT_TISSUE_ENTITY_TERMS: EntityTermRow[] = SOFT_TISSUE_STRUCTURE_SPECS.flatMap((spec) => [
  {
    id: `term-structure-${spec.slug}-preferred-fipat`,
    anatomyEntityType: "anatomy_structure",
    anatomyEntitySlug: spec.slug,
    term: spec.formalTerm,
    termType: "preferred",
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
])

const SOFT_TISSUE_RELATIONSHIPS: RelationshipRow[] = [
  { id: "relationship-subacromial-bursa-reduces-friction-for-supraspinatus", sourceEntityType: "anatomy_structure", sourceEntitySlug: "subacromial-subdeltoid-bursa", relationshipType: "reduces_friction_for", targetEntityType: "muscle", targetEntitySlug: "supraspinatus", sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE },
  { id: "relationship-subacromial-bursa-related-to-deltoid", sourceEntityType: "anatomy_structure", sourceEntitySlug: "subacromial-subdeltoid-bursa", relationshipType: "related_to", targetEntityType: "muscle", targetEntitySlug: "deltoid", sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE },
  { id: "relationship-subscapular-bursa-reduces-friction-for-subscapularis", sourceEntityType: "anatomy_structure", sourceEntitySlug: "subscapular-bursa", relationshipType: "reduces_friction_for", targetEntityType: "muscle", targetEntitySlug: "subscapularis", sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE },
  { id: "relationship-subscapular-bursa-related-to-glenohumeral", sourceEntityType: "anatomy_structure", sourceEntitySlug: "subscapular-bursa", relationshipType: "related_to", targetEntityType: "joint", targetEntitySlug: "glenohumeral", sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE },
  { id: "relationship-bicipital-tendon-sheath-surrounds-biceps-tendon", sourceEntityType: "anatomy_structure", sourceEntitySlug: "bicipital-tendon-sheath", relationshipType: "surrounds", targetEntityType: "anatomy_structure", targetEntitySlug: "biceps-tendon", sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE },
  { id: "relationship-glenoid-labrum-deepens-glenohumeral", sourceEntityType: "anatomy_structure", sourceEntitySlug: "glenoid-labrum", relationshipType: "deepens", targetEntityType: "joint", targetEntitySlug: "glenohumeral", sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE },
  { id: "relationship-acetabular-labrum-deepens-hip", sourceEntityType: "anatomy_structure", sourceEntitySlug: "acetabular-labrum", relationshipType: "deepens", targetEntityType: "joint", targetEntitySlug: "hip-joint", sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE },
  { id: "relationship-trochanteric-bursa-overlies-greater-trochanter", sourceEntityType: "anatomy_structure", sourceEntitySlug: "trochanteric-bursa", relationshipType: "overlies", targetEntityType: "bone_landmark", targetEntitySlug: "greater-trochanter", sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE },
  { id: "relationship-trochanteric-bursa-related-to-gluteus-medius", sourceEntityType: "anatomy_structure", sourceEntitySlug: "trochanteric-bursa", relationshipType: "related_to", targetEntityType: "muscle", targetEntitySlug: "gluteus-medius", sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE },
  { id: "relationship-iliopsoas-bursa-related-to-iliopsoas-tendon", sourceEntityType: "anatomy_structure", sourceEntitySlug: "iliopsoas-bursa", relationshipType: "related_to", targetEntityType: "anatomy_structure", targetEntitySlug: "iliopsoas-tendon", sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE },
  { id: "relationship-iliopsoas-bursa-related-to-anterior-hip-capsule", sourceEntityType: "anatomy_structure", sourceEntitySlug: "iliopsoas-bursa", relationshipType: "related_to", targetEntityType: "anatomy_structure", targetEntitySlug: "anterior-hip-capsule", sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE },
  { id: "relationship-ischial-bursa-overlies-ischial-tuberosity", sourceEntityType: "anatomy_structure", sourceEntitySlug: "ischial-bursa", relationshipType: "overlies", targetEntityType: "bone_landmark", targetEntitySlug: "ischial-tuberosity", sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE },
  { id: "relationship-medial-meniscus-part-of-knee-joint", sourceEntityType: "anatomy_structure", sourceEntitySlug: "medial-meniscus", relationshipType: "part_of", targetEntityType: "joint", targetEntitySlug: "knee-joint", sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE },
  { id: "relationship-lateral-meniscus-part-of-knee-joint", sourceEntityType: "anatomy_structure", sourceEntitySlug: "lateral-meniscus", relationshipType: "part_of", targetEntityType: "joint", targetEntitySlug: "knee-joint", sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE },
  { id: "relationship-medial-meniscus-part-of-knee-meniscus-group", sourceEntityType: "anatomy_structure", sourceEntitySlug: "medial-meniscus", relationshipType: "part_of", targetEntityType: "anatomy_structure", targetEntitySlug: "knee-meniscus", sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE },
  { id: "relationship-lateral-meniscus-part-of-knee-meniscus-group", sourceEntityType: "anatomy_structure", sourceEntitySlug: "lateral-meniscus", relationshipType: "part_of", targetEntityType: "anatomy_structure", targetEntitySlug: "knee-meniscus", sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE },
  { id: "relationship-lateral-meniscus-related-to-popliteus", sourceEntityType: "anatomy_structure", sourceEntitySlug: "lateral-meniscus", relationshipType: "related_to", targetEntityType: "muscle", targetEntitySlug: "popliteus", sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE },
  { id: "relationship-prepatellar-bursa-overlies-patella", sourceEntityType: "anatomy_structure", sourceEntitySlug: "prepatellar-bursa", relationshipType: "overlies", targetEntityType: "bone", targetEntitySlug: "patella", sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE },
  { id: "relationship-superficial-infrapatellar-bursa-related-to-patellar-tendon", sourceEntityType: "anatomy_structure", sourceEntitySlug: "superficial-infrapatellar-bursa", relationshipType: "related_to", targetEntityType: "anatomy_structure", targetEntitySlug: "patellar-tendon", sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE },
  { id: "relationship-deep-infrapatellar-bursa-reduces-friction-for-patellar-tendon", sourceEntityType: "anatomy_structure", sourceEntitySlug: "deep-infrapatellar-bursa", relationshipType: "reduces_friction_for", targetEntityType: "anatomy_structure", targetEntitySlug: "patellar-tendon", sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE },
  { id: "relationship-pes-anserine-bursa-associated-with-pes-anserinus", sourceEntityType: "anatomy_structure", sourceEntitySlug: "pes-anserine-bursa", relationshipType: "associated_with", targetEntityType: "bone_landmark", targetEntitySlug: "pes-anserinus", sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE },
  { id: "relationship-retrocalcaneal-bursa-reduces-friction-for-achilles", sourceEntityType: "anatomy_structure", sourceEntitySlug: "retrocalcaneal-bursa", relationshipType: "reduces_friction_for", targetEntityType: "anatomy_structure", targetEntitySlug: "achilles-tendon", sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE },
  { id: "relationship-common-flexor-sheath-passes-under-flexor-retinaculum", sourceEntityType: "anatomy_structure", sourceEntitySlug: "common-flexor-synovial-sheath", relationshipType: "passes_under", targetEntityType: "anatomy_structure", targetEntitySlug: "flexor-retinaculum", sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE },
  { id: "relationship-fpl-synovial-sheath-surrounds-fpl-tendon", sourceEntityType: "anatomy_structure", sourceEntitySlug: "flexor-pollicis-longus-synovial-sheath", relationshipType: "surrounds", targetEntityType: "anatomy_structure", targetEntitySlug: "flexor-pollicis-longus-tendon", sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE },
  { id: "relationship-extensor-sheaths-pass-under-extensor-retinaculum", sourceEntityType: "anatomy_structure", sourceEntitySlug: "extensor-tendon-sheaths-wrist", relationshipType: "passes_under", targetEntityType: "anatomy_structure", targetEntitySlug: "extensor-retinaculum", sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE },
  { id: "relationship-fibular-tendon-sheath-surrounds-fibularis-longus", sourceEntityType: "anatomy_structure", sourceEntitySlug: "fibular-tendon-sheath", relationshipType: "surrounds", targetEntityType: "muscle", targetEntitySlug: "fibularis-longus", sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE },
  { id: "relationship-tibialis-posterior-sheath-surrounds-tibialis-posterior", sourceEntityType: "anatomy_structure", sourceEntitySlug: "tibialis-posterior-tendon-sheath", relationshipType: "surrounds", targetEntityType: "muscle", targetEntitySlug: "tibialis-posterior", sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE },
]

const SOFT_TISSUE_CLIENT_TERMS: ClientTermRow[] = [
  {
    id: "client-term-top-shoulder-bursa-area",
    slug: "top-shoulder-bursa-area",
    term: "top shoulder bursa area",
    plainLanguageDescription: "Client phrase for the superior shoulder region near the subacromial and deltoid bursal area.",
    mappedRegionSlug: "glenohumeral-region",
    mappedStructureSlug: "subacromial-subdeltoid-bursa",
    confidence: "broad",
    clinicalUse: "non-diagnostic",
    likelyRegions: ["glenohumeral-region", "rotator-cuff-region"],
    likelyStructures: ["subacromial-subdeltoid-bursa", "supraspinatus", "deltoid"],
    therapistPrompt: "Clarify whether the client means top of shoulder, outside shoulder, neck-shoulder transition, or movement-related pinching.",
    sourceRef: CLIENT_LANGUAGE_SOURCE,
  },
  {
    id: "client-term-outer-hip-bursa-area",
    slug: "outer-hip-bursa-area",
    term: "outer hip bursa area",
    plainLanguageDescription: "Client phrase for the lateral hip over the greater trochanter and nearby gluteal tendon region.",
    mappedRegionSlug: "hip",
    mappedStructureSlug: "trochanteric-bursa",
    confidence: "broad",
    clinicalUse: "non-diagnostic",
    likelyRegions: ["hip", "thigh"],
    likelyStructures: ["trochanteric-bursa", "gluteus-medius", "iliotibial-band"],
    therapistPrompt: "Clarify exact side-hip location, pressure sensitivity, gait or lying-side triggers, and whether referral is appropriate.",
    sourceRef: CLIENT_LANGUAGE_SOURCE,
  },
  {
    id: "client-term-front-kneecap-bursa-area",
    slug: "front-kneecap-bursa-area",
    term: "front kneecap bursa area",
    plainLanguageDescription: "Client phrase for the superficial front of the kneecap region.",
    mappedRegionSlug: "knee",
    mappedStructureSlug: "prepatellar-bursa",
    confidence: "broad",
    clinicalUse: "non-diagnostic",
    likelyRegions: ["knee"],
    likelyStructures: ["prepatellar-bursa", "patella", "quadriceps-tendon"],
    therapistPrompt: "Clarify whether the client points to the kneecap surface, above the kneecap, below the kneecap, or the joint line.",
    sourceRef: CLIENT_LANGUAGE_SOURCE,
  },
  {
    id: "client-term-inside-knee-bursa-area",
    slug: "inside-knee-bursa-area",
    term: "inside knee bursa area",
    plainLanguageDescription: "Client phrase for the medial proximal tibia and inner-knee tendon region near pes anserinus.",
    mappedRegionSlug: "knee",
    mappedStructureSlug: "pes-anserine-bursa",
    confidence: "broad",
    clinicalUse: "non-diagnostic",
    likelyRegions: ["knee", "thigh", "leg"],
    likelyStructures: ["pes-anserine-bursa", "pes-anserinus", "sartorius", "gracilis", "semitendinosus"],
    therapistPrompt: "Clarify whether the client means the medial joint line, below-knee tendon area, adductor region, or lower hamstring line.",
    sourceRef: CLIENT_LANGUAGE_SOURCE,
  },
  {
    id: "client-term-heel-bursa-area",
    slug: "heel-bursa-area",
    term: "heel bursa area",
    plainLanguageDescription: "Client phrase for the posterior heel region near the calcaneal tendon and calcaneus.",
    mappedRegionSlug: "ankle",
    mappedStructureSlug: "retrocalcaneal-bursa",
    confidence: "broad",
    clinicalUse: "non-diagnostic",
    likelyRegions: ["ankle", "foot", "leg"],
    likelyStructures: ["retrocalcaneal-bursa", "achilles-tendon", "calcaneal-tuberosity"],
    therapistPrompt: "Clarify whether the client points to the tendon, the back of the heel, the underside of the heel, or shoe-pressure area.",
    sourceRef: CLIENT_LANGUAGE_SOURCE,
  },
]

const STRUCTURE_REVIEWED_CITATIONS: CitationRow[] = SOFT_TISSUE_STRUCTURE_SPECS.flatMap((spec) => [
  reviewedStructureCitation(
    spec.slug,
    "official_term",
    `term-structure-${spec.slug}-preferred-fipat`,
    FIPAT_SOURCE,
    spec.officialLocator,
    "FIPAT TA2 official anatomical terminology used for the named soft-tissue structure term row.",
  ),
  reviewedStructureCitation(
    spec.slug,
    "clinical_summary",
    `structure-${spec.slug}`,
    APPLIED_HUMAN_ANATOMY_SOURCE,
    APPLIED_HUMAN_ANATOMY_LOCATOR,
    "MassageLab-authored soft-tissue structure summary verified against Applied Human Anatomy connective tissue, joint, and regional anatomy material.",
  ),
  sourceReferenceCitation(
    "anatomy_structure",
    spec.slug,
    `anatomy_structure:${spec.slug}`,
    APPLIED_HUMAN_ANATOMY_SOURCE,
    APPLIED_HUMAN_ANATOMY_LOCATOR,
    "Reviewed exact seed source reference for this named soft-tissue structure row.",
  ),
])

const TERM_SOURCE_REFERENCE_CITATIONS: CitationRow[] = SOFT_TISSUE_ENTITY_TERMS.map((term) => sourceReferenceCitation(
  term.anatomyEntityType,
  term.anatomyEntitySlug,
  `entity_term:${term.id}`,
  term.sourceRef,
  term.sourceRef === FIPAT_SOURCE ? FIPAT_LOCATOR : APPLIED_HUMAN_ANATOMY_LOCATOR,
  "Reviewed exact seed source reference for this named soft-tissue terminology row.",
))

const RELATIONSHIP_CITATIONS: CitationRow[] = SOFT_TISSUE_RELATIONSHIPS.flatMap((relationship) => [
  {
    id: `citation-${relationship.id}-reviewed`,
    slug: `citation-${relationship.id}-reviewed`,
    entityType: relationship.sourceEntityType,
    entitySlug: relationship.sourceEntitySlug,
    factType: "structure_relationship",
    factSlug: relationship.id,
    sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
    sourceLocator: APPLIED_HUMAN_ANATOMY_LOCATOR,
    citationNote: "Soft-tissue anatomical relationship verified against Applied Human Anatomy regional joint and connective-tissue material.",
    reviewStatus: "reviewed",
  },
  sourceReferenceCitation(
    relationship.sourceEntityType,
    relationship.sourceEntitySlug,
    `relationship:${relationship.id}`,
    relationship.sourceRef,
    APPLIED_HUMAN_ANATOMY_LOCATOR,
    "Reviewed exact seed source reference for this soft-tissue structure relationship row.",
  ),
])

const CLIENT_TERM_SOURCE_REFERENCE_CITATIONS: CitationRow[] = SOFT_TISSUE_CLIENT_TERMS.map((clientTerm) => sourceReferenceCitation(
  "client_term",
  clientTerm.slug,
  `client_term:${clientTerm.slug}`,
  clientTerm.sourceRef,
  CLIENT_LANGUAGE_LOCATOR,
  "Reviewed exact seed source reference for this MassageLab-authored soft-tissue client-language row.",
))

const CLIENT_TERM_REVIEWED_CITATIONS: CitationRow[] = SOFT_TISSUE_CLIENT_TERMS.flatMap((clientTerm) => [
  reviewedClientTermCitation(
    clientTerm.slug,
    "client_language",
    CLIENT_LANGUAGE_LOCATOR,
    "MassageLab-authored non-diagnostic client phrase reviewed for soft-tissue body-map language.",
  ),
  reviewedClientTermCitation(
    clientTerm.slug,
    "anatomy_mapping",
    CLIENT_LANGUAGE_LOCATOR,
    "MassageLab-authored client phrase mapped to normalized soft-tissue anatomy structures and likely regional context.",
  ),
])

export const SOFT_TISSUE_ATLAS_SECTION: AnatomySeedSection = {
  structures: SOFT_TISSUE_STRUCTURES,
  clientTerms: SOFT_TISSUE_CLIENT_TERMS,
  entityTerms: SOFT_TISSUE_ENTITY_TERMS,
  relationships: SOFT_TISSUE_RELATIONSHIPS,
  citations: [
    ...STRUCTURE_REVIEWED_CITATIONS,
    ...TERM_SOURCE_REFERENCE_CITATIONS,
    ...RELATIONSHIP_CITATIONS,
    ...CLIENT_TERM_SOURCE_REFERENCE_CITATIONS,
    ...CLIENT_TERM_REVIEWED_CITATIONS,
  ],
}
