import { ANATOMY_FOUNDATION_SEED } from "./anatomy-foundation.ts"
import type { AnatomyFoundationSeed } from "./anatomy-foundation.ts"

export const MBLEX_CONTENT_OUTLINE_SOURCE = {
  slug: "mblex-content-outline",
  url: "https://fsmtb.org/wp-content/uploads/2025/12/MBLEx-Content-Outline.pdf",
} as const

export type MblexCoverageDomainSlug = "anatomy-physiology" | "kinesiology"
export type MblexCoverageStatus = "strong_foundation" | "partial" | "missing"

export type MblexCoverageDomain = {
  slug: MblexCoverageDomainSlug
  label: string
  examWeightPercent: number
  sourceSlug: string
}

export type MblexCoverageRequirement = {
  slug: string
  domainSlug: MblexCoverageDomainSlug
  label: string
  status: MblexCoverageStatus
  evidence: string[]
  gaps: string[]
  recommendedBatchSlugs: string[]
}

export type MblexCoverageBatch = {
  slug: string
  label: string
  priority: number
  requirementSlugs: string[]
}

export type MblexCoverageAudit = {
  sourceSlug: string
  domains: MblexCoverageDomain[]
  requirements: MblexCoverageRequirement[]
  nextBatches: MblexCoverageBatch[]
  summary: {
    strongFoundation: number
    partial: number
    missing: number
    missingRequirementSlugs: string[]
  }
}

type SeedCounts = {
  muscles: number
  bones: number
  joints: number
  jointMovements: number
  rangesOfMotion: number
  muscleAttachments: number
  muscleActions: number
  nerves: number
  muscleInnervations: number
  ligaments: number
  bloodSupply: number
  structures: number
  concepts: number
  conceptSlugs: Set<string>
  painMapRegions: number
  clientTerms: number
}

type MblexRequirementSpec = {
  slug: string
  domainSlug: MblexCoverageDomainSlug
  label: string
  status: (counts: SeedCounts) => MblexCoverageStatus
  evidence: (counts: SeedCounts) => string[]
  gaps: string[]
  recommendedBatchSlugs: string[]
}

const DOMAINS: MblexCoverageDomain[] = [
  {
    slug: "anatomy-physiology",
    label: "Anatomy & Physiology",
    examWeightPercent: 11,
    sourceSlug: MBLEX_CONTENT_OUTLINE_SOURCE.slug,
  },
  {
    slug: "kinesiology",
    label: "Kinesiology",
    examWeightPercent: 12,
    sourceSlug: MBLEX_CONTENT_OUTLINE_SOURCE.slug,
  },
]

const BODY_SYSTEM_CONCEPT_REQUIREMENTS = {
  digestive: {
    structure: ["digestive-system", "gastrointestinal-tract", "accessory-digestive-organs"],
    function: ["digestion", "nutrient-absorption", "bowel-elimination"],
  },
  endocrine: {
    structure: ["endocrine-system", "endocrine-gland"],
    function: ["hormone", "endocrine-feedback", "homeostasis"],
  },
  integumentary: {
    structure: ["integumentary-system", "epidermis", "dermis"],
    function: ["skin-barrier-function", "thermoregulation"],
  },
  "lymphatic-immune": {
    structure: ["lymphatic-system", "lymph", "lymph-node"],
    function: ["immune-response", "innate-immunity", "adaptive-immunity"],
  },
  reproduction: {
    structure: ["reproductive-system", "gamete"],
    function: ["reproductive-hormone-regulation", "fertilization"],
  },
  sensory: {
    structure: ["sensory-system", "sensory-receptor", "special-senses"],
    function: ["somatosensation", "vestibular-sense"],
  },
  urinary: {
    structure: ["urinary-system", "kidney", "nephron"],
    function: ["urine-formation", "fluid-electrolyte-balance"],
  },
} as const

type BodySystemConceptKey = keyof typeof BODY_SYSTEM_CONCEPT_REQUIREMENTS

const CARDIORESPIRATORY_LYMPHATIC_STRONG_CONCEPTS = {
  cardiovascular: {
    structure: ["cardiovascular-system", "heart", "blood-vessel", "artery", "vein", "capillary"],
    function: ["systemic-circulation", "pulmonary-circulation", "cardiac-output", "blood-pressure", "venous-return"],
  },
  respiratory: {
    structure: ["respiratory-system", "airway", "lung", "alveolus", "pleura"],
    function: ["ventilation", "gas-exchange", "inspiration", "expiration", "oxygen-transport"],
  },
  "lymphatic-immune": {
    structure: ["lymphatic-system", "lymph", "lymph-node", "lymphatic-vessel", "lymphatic-capillary", "lymphatic-duct", "spleen", "thymus", "tonsil"],
    function: ["immune-response", "innate-immunity", "adaptive-immunity", "lymph-transport", "immune-surveillance", "fluid-return"],
  },
} as const

type CardiorespiratoryLymphaticConceptKey = keyof typeof CARDIORESPIRATORY_LYMPHATIC_STRONG_CONCEPTS

const REMAINING_BODY_SYSTEM_STRONG_CONCEPTS = {
  digestive: {
    structure: ["digestive-system", "gastrointestinal-tract", "accessory-digestive-organs", "mouth", "esophagus", "stomach", "small-intestine", "large-intestine", "liver", "gallbladder", "pancreas"],
    function: ["digestion", "nutrient-absorption", "bowel-elimination", "mechanical-digestion", "chemical-digestion", "peristalsis", "bile", "digestive-enzyme"],
  },
  endocrine: {
    structure: ["endocrine-system", "endocrine-gland", "pituitary-gland", "thyroid-gland", "adrenal-gland", "pancreatic-islet"],
    function: ["hormone", "endocrine-feedback", "homeostasis", "target-cell", "negative-feedback", "stress-response", "blood-glucose-regulation"],
  },
  integumentary: {
    structure: ["integumentary-system", "epidermis", "dermis", "hypodermis", "hair-follicle", "sweat-gland", "sebaceous-gland", "cutaneous-receptor"],
    function: ["skin-barrier-function", "thermoregulation", "sweat-production", "sebaceous-secretion", "skin-sensation"],
  },
  reproduction: {
    structure: ["reproductive-system", "gamete", "ovary", "testis", "uterus", "fallopian-tube", "prostate"],
    function: ["reproductive-hormone-regulation", "fertilization", "gametogenesis", "menstrual-cycle", "pregnancy-support", "lactation"],
  },
  sensory: {
    structure: ["sensory-system", "sensory-receptor", "special-senses", "eye", "ear", "olfactory-receptor", "taste-receptor", "vestibular-apparatus"],
    function: ["somatosensation", "vestibular-sense", "vision", "hearing", "smell", "taste", "nociception"],
  },
  urinary: {
    structure: ["urinary-system", "kidney", "nephron", "ureter", "urinary-bladder", "urethra", "renal-cortex", "renal-medulla"],
    function: ["urine-formation", "fluid-electrolyte-balance", "filtration", "reabsorption", "secretion", "micturition", "acid-base-balance"],
  },
} as const

type RemainingBodySystemConceptKey = keyof typeof REMAINING_BODY_SYSTEM_STRONG_CONCEPTS

const NERVOUS_SYSTEM_STRONG_CONCEPTS = {
  structure: [
    "nervous-system",
    "central-nervous-system",
    "peripheral-nervous-system",
    "brain",
    "spinal-cord",
    "neuron",
    "glial-cell",
    "cranial-nerve",
    "spinal-nerve",
    "autonomic-nervous-system",
    "somatic-nervous-system",
  ],
  function: [
    "nerve-impulse",
    "action-potential",
    "synapse",
    "neurotransmitter",
    "reflex-arc",
    "motor-control",
    "sensory-processing",
    "autonomic-regulation",
    "sympathetic-division",
    "parasympathetic-division",
    "neural-plasticity",
  ],
} as const

const MUSCULOSKELETAL_FUNCTION_STRONG_CONCEPTS = [
  "joint-movement",
  "muscle-action",
  "force-production",
  "joint-stability",
  "mobility",
  "postural-control",
  "kinetic-chain",
  "open-chain-movement",
  "closed-chain-movement",
  "lever-system",
  "length-tension-relationship",
  "load-transfer",
  "functional-movement",
  "motor-learning",
] as const

const TISSUE_REPAIR_STRONG_CONCEPTS = [
  "inflammation",
  "hemostasis",
  "proliferative-repair-phase",
  "remodeling-repair-phase",
  "tissue-repair",
  "scar-tissue",
  "collagen-remodeling",
  "granulation-tissue",
  "edema",
  "fibrosis",
  "acute-injury",
  "subacute-repair",
  "chronic-tissue-change",
  "tissue-irritability",
  "tissue-load-tolerance",
  "protective-muscle-guarding",
  "contraindication-red-flag",
  "scope-aware-referral",
] as const

const SYSTEMS = [
  { slug: "cardiovascular", label: "Cardiovascular", structureStatus: cardiovascularStructureStatus, functionStatus: cardiovascularFunctionStatus, batch: "cardiorespiratory-lymphatic-systems" },
  { slug: "digestive", label: "Digestive", structureStatus: bodySystemStructureStatus("digestive"), functionStatus: bodySystemFunctionStatus("digestive"), batch: "remaining-ap-body-systems" },
  { slug: "endocrine", label: "Endocrine", structureStatus: bodySystemStructureStatus("endocrine"), functionStatus: bodySystemFunctionStatus("endocrine"), batch: "remaining-ap-body-systems" },
  { slug: "integumentary", label: "Integumentary", structureStatus: bodySystemStructureStatus("integumentary"), functionStatus: bodySystemFunctionStatus("integumentary"), batch: "remaining-ap-body-systems" },
  { slug: "lymphatic-immune", label: "Lymphatic & Immune", structureStatus: cardiorespiratoryLymphaticStructureStatus("lymphatic-immune"), functionStatus: cardiorespiratoryLymphaticFunctionStatus("lymphatic-immune"), batch: "cardiorespiratory-lymphatic-systems" },
  { slug: "musculoskeletal", label: "Musculoskeletal", structureStatus: musculoskeletalStructureStatus, functionStatus: musculoskeletalFunctionStatus, batch: "physiology-concepts-core" },
  { slug: "nervous", label: "Nervous", structureStatus: nervousStructureStatus, functionStatus: nervousFunctionStatus, batch: "physiology-concepts-core" },
  { slug: "reproduction", label: "Reproduction", structureStatus: bodySystemStructureStatus("reproduction"), functionStatus: bodySystemFunctionStatus("reproduction"), batch: "remaining-ap-body-systems" },
  { slug: "respiratory", label: "Respiratory", structureStatus: cardiorespiratoryLymphaticStructureStatus("respiratory"), functionStatus: cardiorespiratoryLymphaticFunctionStatus("respiratory"), batch: "cardiorespiratory-lymphatic-systems" },
  { slug: "sensory", label: "Sensory", structureStatus: bodySystemStructureStatus("sensory"), functionStatus: bodySystemFunctionStatus("sensory"), batch: "remaining-ap-body-systems" },
  { slug: "urinary", label: "Urinary", structureStatus: bodySystemStructureStatus("urinary"), functionStatus: bodySystemFunctionStatus("urinary"), batch: "remaining-ap-body-systems" },
] as const

const SYSTEM_REQUIREMENTS: MblexRequirementSpec[] = SYSTEMS.flatMap((system) => [
  {
    slug: `ap-system-structure-${system.slug}`,
    domainSlug: "anatomy-physiology",
    label: `${system.label} system structure`,
    status: system.structureStatus,
    evidence: systemStructureEvidence(system.slug),
    gaps: [`Add named ${system.label.toLowerCase()} structures, terminology, citations, and MassageLab-authored summaries where clinically relevant.`],
    recommendedBatchSlugs: [system.batch],
  },
  {
    slug: `ap-system-function-${system.slug}`,
    domainSlug: "anatomy-physiology",
    label: `${system.label} system function`,
    status: system.functionStatus,
    evidence: systemFunctionEvidence(system.slug),
    gaps: [`Add commercial-safe physiology concepts for ${system.label.toLowerCase()} function without reusing restricted source wording.`],
    recommendedBatchSlugs: [system.batch],
  },
])

const REQUIREMENTS: MblexRequirementSpec[] = [
  ...SYSTEM_REQUIREMENTS,
  {
    slug: "ap-tissue-injury-repair",
    domainSlug: "anatomy-physiology",
    label: "Tissue injury and repair",
    status: tissueRepairStatus,
    evidence: (counts) => [`Current seed has ${counts.concepts} physiology concepts, including reviewed tissue injury, repair, load-tolerance, and referral-safety concepts.`],
    gaps: ["Deepen tissue injury and repair with contraindication-aware tissue state language, more phases, and section-specific examples."],
    recommendedBatchSlugs: ["physiology-concepts-core"],
  },
  {
    slug: "ap-energetic-anatomy",
    domainSlug: "anatomy-physiology",
    label: "Concepts of energetic anatomy",
    status: energeticAnatomyStatus,
    evidence: (counts) => [`Current seed has ${counts.concepts} concept records, including non-diagnostic energetic-anatomy taxonomy when present.`],
    gaps: ["Deepen tradition-specific energetic anatomy only after source and scope review; keep it separate from biomedical anatomy facts."],
    recommendedBatchSlugs: ["remaining-ap-body-systems"],
  },
  {
    slug: "kin-skeletal-muscle-components",
    domainSlug: "kinesiology",
    label: "Skeletal muscle components and characteristics",
    status: partialIfMusclesExist,
    evidence: (counts) => [`Current seed has ${counts.muscles} muscles and ${counts.structures} related structures.`],
    gaps: ["Add muscle fiber, fascicle, tendon, aponeurosis, motor unit, neuromuscular junction, and fiber-type concept records."],
    recommendedBatchSlugs: ["physiology-concepts-core"],
  },
  {
    slug: "kin-skeletal-muscle-contractions",
    domainSlug: "kinesiology",
    label: "Concepts of skeletal muscle contractions",
    status: contractionStatus,
    evidence: (counts) => [`Current seed has ${counts.muscleActions} muscle actions with contraction-type fields available.`],
    gaps: ["Add concept records for concentric, eccentric, isometric, agonist, antagonist, synergist, stabilizer, and length-tension language."],
    recommendedBatchSlugs: ["physiology-concepts-core"],
  },
  {
    slug: "kin-proprioceptors",
    domainSlug: "kinesiology",
    label: "Proprioceptors",
    status: proprioceptorStatus,
    evidence: (counts) => [`Current seed has ${counts.concepts} physiology concepts, including proprioceptor concepts when present.`],
    gaps: ["Connect proprioceptor concepts to body maps, SOAP tags, and movement-education prompts."],
    recommendedBatchSlugs: ["physiology-concepts-core"],
  },
  {
    slug: "kin-muscle-locations-attachments-actions",
    domainSlug: "kinesiology",
    label: "Skeletal muscle locations, attachments, and actions",
    status: muscleLocationAttachmentActionStatus,
    evidence: (counts) => [
      `${counts.muscles} muscles`,
      `${counts.muscleAttachments} muscle attachments`,
      `${counts.muscleActions} muscle actions`,
      `${counts.muscleInnervations} muscle innervations`,
    ],
    gaps: ["Continue citation review and region-by-region completeness checks for smaller muscles, variants, and clinical terminology."],
    recommendedBatchSlugs: ["physiology-concepts-core"],
  },
  {
    slug: "kin-joint-structure-function",
    domainSlug: "kinesiology",
    label: "Joint structure and function",
    status: jointStructureFunctionStatus,
    evidence: (counts) => [`${counts.joints} joints`, `${counts.jointMovements} joint movements`, `${counts.ligaments} ligaments`],
    gaps: ["Add joint capsule, cartilage, bursa, disc, meniscus, stability, and end-feel concepts where not already modeled."],
    recommendedBatchSlugs: ["physiology-concepts-core"],
  },
  {
    slug: "kin-range-of-motion-active-passive-resisted",
    domainSlug: "kinesiology",
    label: "Range of motion: active, passive, and resisted",
    status: rangeOfMotionStatus,
    evidence: (counts) => [`${counts.rangesOfMotion} typical ROM records are present.`],
    gaps: ["Model active, passive, and resisted ROM assessment concepts separately from typical degree values."],
    recommendedBatchSlugs: ["physiology-concepts-core"],
  },
]

const NEXT_BATCHES: MblexCoverageBatch[] = [
  {
    slug: "physiology-concepts-core",
    label: "Physiology and kinesiology concept core",
    priority: 1,
    requirementSlugs: [
      "kin-skeletal-muscle-components",
      "kin-skeletal-muscle-contractions",
      "kin-proprioceptors",
      "kin-range-of-motion-active-passive-resisted",
      "ap-tissue-injury-repair",
      "ap-system-function-musculoskeletal",
      "ap-system-function-nervous",
    ],
  },
  {
    slug: "cardiorespiratory-lymphatic-systems",
    label: "Cardiovascular, respiratory, and lymphatic systems",
    priority: 2,
    requirementSlugs: [
      "ap-system-structure-cardiovascular",
      "ap-system-function-cardiovascular",
      "ap-system-structure-respiratory",
      "ap-system-function-respiratory",
      "ap-system-structure-lymphatic-immune",
      "ap-system-function-lymphatic-immune",
    ],
  },
  {
    slug: "remaining-ap-body-systems",
    label: "Remaining A&P body systems",
    priority: 3,
    requirementSlugs: [
      "ap-system-structure-digestive",
      "ap-system-function-digestive",
      "ap-system-structure-endocrine",
      "ap-system-function-endocrine",
      "ap-system-structure-integumentary",
      "ap-system-function-integumentary",
      "ap-system-structure-reproduction",
      "ap-system-function-reproduction",
      "ap-system-structure-sensory",
      "ap-system-function-sensory",
      "ap-system-structure-urinary",
      "ap-system-function-urinary",
      "ap-energetic-anatomy",
    ],
  },
]

export function getMblexCoverageAudit(seed: AnatomyFoundationSeed = ANATOMY_FOUNDATION_SEED): MblexCoverageAudit {
  const counts = getSeedCounts(seed)
  const requirements = REQUIREMENTS.map((requirement) => ({
    slug: requirement.slug,
    domainSlug: requirement.domainSlug,
    label: requirement.label,
    status: requirement.status(counts),
    evidence: requirement.evidence(counts),
    gaps: requirement.gaps,
    recommendedBatchSlugs: requirement.recommendedBatchSlugs,
  }))
  const summary = {
    strongFoundation: requirements.filter((requirement) => requirement.status === "strong_foundation").length,
    partial: requirements.filter((requirement) => requirement.status === "partial").length,
    missing: requirements.filter((requirement) => requirement.status === "missing").length,
    missingRequirementSlugs: requirements
      .filter((requirement) => requirement.status === "missing")
      .map((requirement) => requirement.slug),
  }

  return {
    sourceSlug: MBLEX_CONTENT_OUTLINE_SOURCE.slug,
    domains: DOMAINS,
    requirements,
    nextBatches: NEXT_BATCHES,
    summary,
  }
}

function getSeedCounts(seed: AnatomyFoundationSeed): SeedCounts {
  return {
    muscles: seed.muscles.length,
    bones: seed.bones.length,
    joints: seed.joints.length,
    jointMovements: seed.jointMovements.length,
    rangesOfMotion: seed.rangesOfMotion.length,
    muscleAttachments: seed.muscleAttachments.length,
    muscleActions: seed.muscleActions.length,
    nerves: seed.nerves.length,
    muscleInnervations: seed.muscleInnervations.length,
    ligaments: seed.ligaments.length,
    bloodSupply: seed.bloodSupply.length,
    structures: seed.structures.length,
    concepts: seed.concepts.length,
    conceptSlugs: new Set(seed.concepts.map((concept) => concept.slug)),
    painMapRegions: seed.painMapRegions.length,
    clientTerms: seed.clientTerms.length,
  }
}

function bodySystemStructureStatus(systemSlug: BodySystemConceptKey) {
  return (counts: SeedCounts): MblexCoverageStatus => {
    if (isRemainingBodySystem(systemSlug) && hasConcepts(counts, [...REMAINING_BODY_SYSTEM_STRONG_CONCEPTS[systemSlug].structure])) {
      return "strong_foundation"
    }

    return hasConcepts(counts, [...BODY_SYSTEM_CONCEPT_REQUIREMENTS[systemSlug].structure]) ? "partial" : "missing"
  }
}

function bodySystemFunctionStatus(systemSlug: BodySystemConceptKey) {
  return (counts: SeedCounts): MblexCoverageStatus => {
    if (isRemainingBodySystem(systemSlug) && hasConcepts(counts, [...REMAINING_BODY_SYSTEM_STRONG_CONCEPTS[systemSlug].function])) {
      return "strong_foundation"
    }

    return hasConcepts(counts, [...BODY_SYSTEM_CONCEPT_REQUIREMENTS[systemSlug].function]) ? "partial" : "missing"
  }
}

function isRemainingBodySystem(systemSlug: BodySystemConceptKey): systemSlug is RemainingBodySystemConceptKey {
  return systemSlug in REMAINING_BODY_SYSTEM_STRONG_CONCEPTS
}

function cardiorespiratoryLymphaticStructureStatus(systemSlug: CardiorespiratoryLymphaticConceptKey) {
  return (counts: SeedCounts): MblexCoverageStatus => {
    if (hasConcepts(counts, [...CARDIORESPIRATORY_LYMPHATIC_STRONG_CONCEPTS[systemSlug].structure])) {
      return "strong_foundation"
    }

    if (systemSlug === "lymphatic-immune") {
      return bodySystemStructureStatus("lymphatic-immune")(counts)
    }

    if (systemSlug === "respiratory") {
      return respiratoryStructureStatus(counts)
    }

    return cardiovascularStructureStatus(counts)
  }
}

function cardiorespiratoryLymphaticFunctionStatus(systemSlug: CardiorespiratoryLymphaticConceptKey) {
  return (counts: SeedCounts): MblexCoverageStatus => {
    if (hasConcepts(counts, [...CARDIORESPIRATORY_LYMPHATIC_STRONG_CONCEPTS[systemSlug].function])) {
      return "strong_foundation"
    }

    if (systemSlug === "lymphatic-immune") {
      return bodySystemFunctionStatus("lymphatic-immune")(counts)
    }

    if (systemSlug === "respiratory") {
      return respiratoryFunctionStatus(counts)
    }

    return cardiovascularFunctionStatus(counts)
  }
}

function partialIfMusclesExist(counts: SeedCounts): MblexCoverageStatus {
  return hasConcepts(counts, ["skeletal-muscle-fiber", "muscle-fascicle", "motor-unit", "neuromuscular-junction", "sarcomere"])
    ? "strong_foundation"
    : counts.muscles > 0 ? "partial" : "missing"
}

function cardiovascularStructureStatus(counts: SeedCounts): MblexCoverageStatus {
  return hasConcepts(counts, [...CARDIORESPIRATORY_LYMPHATIC_STRONG_CONCEPTS.cardiovascular.structure]) && counts.bloodSupply >= 25
    ? "strong_foundation"
    : counts.bloodSupply >= 25 ? "partial" : "missing"
}

function cardiovascularFunctionStatus(counts: SeedCounts): MblexCoverageStatus {
  return hasConcepts(counts, [...CARDIORESPIRATORY_LYMPHATIC_STRONG_CONCEPTS.cardiovascular.function])
    ? "strong_foundation"
    : counts.bloodSupply > 0 ? "partial" : "missing"
}

function musculoskeletalStructureStatus(counts: SeedCounts): MblexCoverageStatus {
  return counts.muscles >= 100 && counts.bones >= 30 && counts.joints >= 20 && counts.structures >= 50
    ? "strong_foundation"
    : "partial"
}

function musculoskeletalFunctionStatus(counts: SeedCounts): MblexCoverageStatus {
  if (
    counts.muscleActions >= 100 &&
    counts.jointMovements >= 50 &&
    hasConcepts(counts, [...MUSCULOSKELETAL_FUNCTION_STRONG_CONCEPTS])
  ) {
    return "strong_foundation"
  }

  return counts.muscleActions >= 100 && counts.jointMovements >= 50 ? "partial" : "missing"
}

function nervousStructureStatus(counts: SeedCounts): MblexCoverageStatus {
  return hasConcepts(counts, [...NERVOUS_SYSTEM_STRONG_CONCEPTS.structure]) && counts.nerves >= 25
    ? "strong_foundation"
    : counts.nerves >= 25 ? "partial" : "missing"
}

function nervousFunctionStatus(counts: SeedCounts): MblexCoverageStatus {
  return hasConcepts(counts, [...NERVOUS_SYSTEM_STRONG_CONCEPTS.function]) && counts.muscleInnervations >= 100
    ? "strong_foundation"
    : counts.muscleInnervations >= 100 ? "partial" : "missing"
}

function respiratoryStructureStatus(counts: SeedCounts): MblexCoverageStatus {
  return counts.structures >= 50 && counts.muscles >= 100 ? "partial" : "missing"
}

function respiratoryFunctionStatus(counts: SeedCounts): MblexCoverageStatus {
  return counts.muscleActions > 0 ? "partial" : "missing"
}

function contractionStatus(counts: SeedCounts): MblexCoverageStatus {
  return hasConcepts(counts, ["concentric-contraction", "eccentric-contraction", "isometric-contraction", "agonist-muscle-role", "antagonist-muscle-role"])
    ? "strong_foundation"
    : counts.muscleActions > 0 ? "partial" : "missing"
}

function muscleLocationAttachmentActionStatus(counts: SeedCounts): MblexCoverageStatus {
  return counts.muscles >= 100 && counts.muscleAttachments >= 200 && counts.muscleActions >= 150
    ? "strong_foundation"
    : "partial"
}

function jointStructureFunctionStatus(counts: SeedCounts): MblexCoverageStatus {
  return counts.joints >= 20 && counts.jointMovements >= 50 && counts.ligaments >= 20
    ? "strong_foundation"
    : "partial"
}

function rangeOfMotionStatus(counts: SeedCounts): MblexCoverageStatus {
  return hasConcepts(counts, ["active-range-of-motion", "passive-range-of-motion", "resisted-range-of-motion"])
    ? "strong_foundation"
    : counts.rangesOfMotion > 0 ? "partial" : "missing"
}

function proprioceptorStatus(counts: SeedCounts): MblexCoverageStatus {
  return hasConcepts(counts, ["muscle-spindle", "golgi-tendon-organ", "joint-mechanoreceptor", "proprioception"])
    ? "strong_foundation"
    : "missing"
}

function tissueRepairStatus(counts: SeedCounts): MblexCoverageStatus {
  if (hasConcepts(counts, [...TISSUE_REPAIR_STRONG_CONCEPTS])) {
    return "strong_foundation"
  }

  return hasConcepts(counts, ["inflammation", "tissue-repair", "scar-tissue"]) ? "partial" : "missing"
}

function energeticAnatomyStatus(counts: SeedCounts): MblexCoverageStatus {
  return hasConcepts(counts, ["energetic-anatomy", "chakra-concept", "meridian-concept", "biofield-concept"]) ? "partial" : "missing"
}

function hasConcepts(counts: SeedCounts, slugs: string[]) {
  return slugs.every((slug) => counts.conceptSlugs.has(slug))
}

function systemStructureEvidence(systemSlug: string) {
  return (counts: SeedCounts) => {
    if (systemSlug === "musculoskeletal") {
      return [`${counts.muscles} muscles`, `${counts.bones} bones`, `${counts.joints} joints`, `${counts.structures} named structures`]
    }
    if (systemSlug === "cardiovascular") {
      return [`${counts.bloodSupply} arteries and veins are present, mostly as regional supply/drainage relationships.`]
    }
    if (systemSlug === "nervous") {
      return [`${counts.nerves} nerves and ${counts.muscleInnervations} muscle innervations are present.`]
    }
    if (systemSlug === "respiratory") {
      return ["Respiratory gross structures, airway/lung anatomy, and breathing-related musculoskeletal structures are present."]
    }
    if (systemSlug in BODY_SYSTEM_CONCEPT_REQUIREMENTS) {
      return [`Reviewed ${systemSlug.replace("-", "/")} structure concepts and normalized gross anatomy structure records are present.`]
    }

    return ["No dedicated normalized records for this body system are present yet."]
  }
}

function systemFunctionEvidence(systemSlug: string) {
  return (counts: SeedCounts) => {
    if (systemSlug === "musculoskeletal") {
      return [`${counts.muscleActions} muscle actions and ${counts.jointMovements} joint movements are present.`]
    }
    if (systemSlug === "cardiovascular") {
      return [`Reviewed circulation physiology concepts are present alongside ${counts.bloodSupply} vessel records for supply/drainage context.`]
    }
    if (systemSlug === "nervous") {
      return [`Reviewed neurophysiology concepts are present alongside ${counts.muscleInnervations} innervation records for motor relationship lookup.`]
    }
    if (systemSlug === "respiratory") {
      return ["Reviewed respiratory physiology concepts are present alongside airway/lung structures and breathing-mechanics anatomy."]
    }
    if (systemSlug in BODY_SYSTEM_CONCEPT_REQUIREMENTS) {
      return [`Reviewed ${systemSlug.replace("-", "/")} function concepts are present for MBLEx-aligned A&P coverage.`]
    }

    return ["No dedicated function/concept records for this body system are present yet."]
  }
}
