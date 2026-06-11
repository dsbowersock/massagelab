import {
  ANATOMY_SEED_SECTION_NAMES,
  ANATOMY_SEED_SECTIONS,
  mergeAnatomySeedSections,
} from "./anatomy-seed/index.ts"

export type AnatomyEntityType =
  | "region"
  | "blood_supply"
  | "anatomy_structure"
  | "anatomy_concept"
  | "bone"
  | "bone_landmark"
  | "joint"
  | "joint_movement"
  | "range_of_motion"
  | "muscle"
  | "muscle_attachment"
  | "muscle_action"
  | "nerve"
  | "muscle_innervation"
  | "ligament"
  | "pain_map_region"
  | "client_term"

const ANATOMY_ENTITY_TYPES = [
  "region",
  "blood_supply",
  "anatomy_structure",
  "anatomy_concept",
  "bone",
  "bone_landmark",
  "joint",
  "joint_movement",
  "range_of_motion",
  "muscle",
  "muscle_attachment",
  "muscle_action",
  "nerve",
  "muscle_innervation",
  "ligament",
  "pain_map_region",
  "client_term",
] as const satisfies readonly AnatomyEntityType[]
const ANATOMY_ENTITY_TYPE_SET = new Set<string>(ANATOMY_ENTITY_TYPES)

export type MuscleRelativeDepth = "superficial" | "intermediate" | "deep" | "variable"
export type MuscleAttachmentType = "origin" | "insertion"
export type MuscleActionRole = "primary" | "secondary" | "stabilizer"
export type MuscleContractionType = "concentric" | "eccentric" | "isometric" | "reverse_action"
export type BloodSupplyKind = "artery" | "vein"
export type ClientTermConfidence = "direct" | "likely" | "broad"
export type PainMapLaterality = "left" | "right" | "bilateral" | "midline" | "variable" | "unspecified"
export type PainMapSurface = "anterior" | "posterior" | "lateral" | "medial" | "superior" | "inferior" | "deep" | "variable" | "unspecified"
export type AnatomySourceUsageScope = "open_reuse" | "internal_reference" | "commercial_licensed" | "review_only"
export type AnatomyFactReviewStatus = "starter" | "needs_review" | "reviewed"
export type AnatomyMediaType = "image" | "diagram" | "model_3d" | "embed" | "source_link"
export type AnatomyMediaRole = "primary" | "reference" | "region_context" | "game_prompt" | "client_education"
export type AnatomyMediaReviewStatus = "approved" | "needs_review" | "rejected"
export type AnatomySpatialMappingPrecision = "exact" | "composite" | "broad_context" | "region_context" | "landmark" | "needs_review"
export type AnatomyTermType =
  | "preferred"
  | "formal"
  | "common"
  | "clinical"
  | "historical"
  | "eponym"
  | "abbreviation"
  | "alternate"

export type FoundationSource = {
  id: string
  slug: string
  name: string
  url?: string
  license?: string
  licenseUrl?: string
  usageScope?: AnatomySourceUsageScope
  accessedAt?: string
  notes?: string
  attribution: string
  sourceRef: string
}

export type BodyRegion = {
  id: string
  slug: string
  name: string
  description?: string
  sourceRefs: string[]
}

export type BodySubregion = BodyRegion & {
  region: string
}

export type Bone = {
  id: string
  slug: string
  name: string
  formalName?: string
  description?: string
  region: string
  sourceRef: string
  sourceRefs?: string[]
}

export type BoneLandmark = {
  id: string
  slug: string
  name: string
  bone: string
  description?: string
  sourceRef: string
}

export type Joint = {
  id: string
  slug: string
  name: string
  jointType: string
  region: string
  description?: string
  sourceRef: string
}

export type JointMovement = {
  id: string
  slug: string
  joint: string
  movementName: string
  plane?: string
  axis?: string
  description?: string
  sourceRef: string
}

export type RangeOfMotion = {
  id: string
  slug: string
  joint: string
  movement: string
  typicalMinDegrees?: number
  typicalMaxDegrees?: number
  typicalMinValue?: number
  typicalMaxValue?: number
  measurementUnit?: string
  measurementPosition: string
  notes?: string
  sourceRef: string
}

export type Muscle = {
  id: string
  slug: string
  name: string
  formalName: string
  alternateNames: string[]
  etymology?: string
  languageOfOrigin?: string
  description?: string
  region: string
  relativeDepth: MuscleRelativeDepth
  depthNotes?: string
  sourceRef: string
}

export type MuscleAttachment = {
  id: string
  muscle: string
  type: MuscleAttachmentType
  bone: string
  landmark?: string
  description: string
  sourceRef: string
}

export type MuscleAction = {
  id: string
  muscle: string
  joint: string
  movement: string
  role: MuscleActionRole
  contractionType: MuscleContractionType
  description: string
  sourceRef: string
}

export type Nerve = {
  id: string
  slug: string
  name: string
  nerveRoots: string[]
  region: string
  description?: string
  sourceRef: string
}

export type MuscleInnervation = {
  id: string
  muscle: string
  nerve: string
  description?: string
  sourceRef: string
}

export type Ligament = {
  id: string
  slug: string
  name: string
  region: string
  joint?: string
  description?: string
  sourceRef: string
}

export type BloodSupply = {
  id: string
  slug: string
  name: string
  kind: BloodSupplyKind
  region: string
  description?: string
  sourceRef: string
}

export type AnatomyStructure = {
  id: string
  slug: string
  name: string
  structureType: string
  region: string
  description?: string
  sourceRef: string
}

export type AnatomyConcept = {
  id: string
  slug: string
  name: string
  conceptType: string
  bodySystem?: string
  description?: string
  sourceRef: string
}

export type PainMapRegion = {
  id: string
  slug: string
  name: string
  region: string
  laterality?: PainMapLaterality
  surface?: PainMapSurface
  plainLanguageDescription?: string
  sourceRef: string
}

export type ClientTermMapping = {
  id: string
  slug: string
  term: string
  label?: string
  plainLanguageDescription: string
  mappedRegionSlug?: string
  mappedMuscleSlug?: string
  mappedJointSlug?: string
  mappedStructureSlug?: string
  confidence: ClientTermConfidence
  notes?: string
  clinicalUse: "non-diagnostic"
  likelyRegions: string[]
  likelyStructures: string[]
  therapistPrompt: string
  sourceRef: string
}

export type AnatomyEntityTerm = {
  id: string
  anatomyEntityType: AnatomyEntityType
  anatomyEntitySlug: string
  term: string
  termType: AnatomyTermType
  languageOfOrigin?: string
  notes?: string
  sourceRef: string
}

export type AnatomyRelationship = {
  id: string
  sourceEntityType: AnatomyEntityType
  sourceEntitySlug: string
  relationshipType: string
  targetEntityType: AnatomyEntityType
  targetEntitySlug: string
  details?: Record<string, unknown>
  sourceRef: string
}

export type AnatomyCitation = {
  id: string
  slug: string
  entityType: AnatomyEntityType
  entitySlug: string
  factType: string
  factSlug?: string
  sourceRef: string
  sourceLocator?: string
  citationNote?: string
  reviewStatus: AnatomyFactReviewStatus
}

export type ExternalAnatomyIdentifier = {
  id: string
  entityType: AnatomyEntityType
  entitySlug: string
  provider: string
  identifier: string
  iri?: string
  label?: string
  sourceRef: string
}

export type AnatomyMediaAsset = {
  id: string
  slug: string
  title: string
  mediaType: AnatomyMediaType
  description?: string
  sourceRef: string
  sourceUrl: string
  remoteUrl?: string
  storagePath?: string
  thumbnailUrl?: string
  license: string
  licenseUrl: string
  attribution: string
  author?: string
  usageScope: AnatomySourceUsageScope
  reviewStatus: AnatomyFactReviewStatus
  width?: number
  height?: number
  format?: string
  metadata?: Record<string, unknown>
}

export type AnatomyMediaEntityLink = {
  id: string
  assetSlug: string
  entityType: AnatomyEntityType
  entitySlug: string
  role: AnatomyMediaRole
  notes?: string
  reviewStatus?: AnatomyMediaReviewStatus
  reviewReason?: string
  reviewNote?: string
  displayPriority?: number
}

export type AnatomySpatialModel = {
  id: string
  slug: string
  name: string
  description?: string
  mediaAssetSlug?: string
  sourceRef: string
  coordinateSystem: string
  unit: string
  forwardAxis: string
  upAxis: string
  scaleToMeters: number
  defaultCamera?: Record<string, unknown>
  interactionNotes?: string
  usageScope: AnatomySourceUsageScope
  reviewStatus: AnatomyFactReviewStatus
  metadata?: Record<string, unknown>
}

export type AnatomySpatialEntityMap = {
  id: string
  slug: string
  modelSlug: string
  entityType: AnatomyEntityType
  entitySlug: string
  label?: string
  mappingPrecision: AnatomySpatialMappingPrecision
  meshName?: string
  nodeName?: string
  materialName?: string
  bodyparts3dPartIds?: string[]
  laterality?: PainMapLaterality
  surface?: PainMapSurface
  selectable?: boolean
  palpationTarget?: boolean
  painSelectionTarget?: boolean
  notes?: string
  metadata?: Record<string, unknown>
  sourceRef: string
  reviewStatus: AnatomyFactReviewStatus
}

export type AnatomyMovementVisualization = {
  id: string
  slug: string
  modelSlug: string
  joint: string
  movement: string
  rangeOfMotion?: string
  primaryEntityType?: AnatomyEntityType
  primaryEntitySlug?: string
  motionAxis?: Record<string, unknown>
  plane?: string
  neutralPose?: Record<string, unknown>
  startDegrees?: number
  endDegrees?: number
  notes?: string
  metadata?: Record<string, unknown>
  sourceRef: string
  reviewStatus: AnatomyFactReviewStatus
}

export type AnatomyFoundationSeed = {
  sources: FoundationSource[]
  bodyRegions: BodyRegion[]
  bodySubregions: BodySubregion[]
  bones: Bone[]
  boneLandmarks: BoneLandmark[]
  joints: Joint[]
  jointMovements: JointMovement[]
  rangesOfMotion: RangeOfMotion[]
  muscles: Muscle[]
  muscleAttachments: MuscleAttachment[]
  muscleActions: MuscleAction[]
  nerves: Nerve[]
  muscleInnervations: MuscleInnervation[]
  ligaments: Ligament[]
  bloodSupply: BloodSupply[]
  structures: AnatomyStructure[]
  concepts: AnatomyConcept[]
  painMapRegions: PainMapRegion[]
  clientTerms: ClientTermMapping[]
  entityTerms: AnatomyEntityTerm[]
  relationships: AnatomyRelationship[]
  citations: AnatomyCitation[]
  externalIdentifiers: ExternalAnatomyIdentifier[]
  mediaAssets: AnatomyMediaAsset[]
  mediaEntityLinks: AnatomyMediaEntityLink[]
  spatialModels: AnatomySpatialModel[]
  spatialEntityMaps: AnatomySpatialEntityMap[]
  movementVisualizations: AnatomyMovementVisualization[]
}

export type AnatomyFoundationSearchResult = {
  entityType: AnatomyEntityType
  slug: string
  label: string
  matchedTerm?: string
  termType?: AnatomyTermType
}

export type AnatomyMilestoneCoverage = {
  missingRequiredMuscleSlugs: string[]
  missingRequiredJointSlugs: string[]
  missingRequiredNerveSlugs: string[]
  missingRequiredClientTermSlugs: string[]
  musclesWithAttachmentCount: number
  musclesWithInnervationCount: number
  musclesWithActionCount: number
  musclesWithEntityTermCount: number
}

export type WholeBodyAnatomyCoverage = {
  missingRequiredRegionSlugs: string[]
  missingRequiredBodyRegionSlugs: string[]
  missingRequiredSubregionSlugs: string[]
  missingRequiredClientTermSlugs: string[]
  missingRequiredStructureSlugs: string[]
  sectionPackSlugs: string[]
}

export type GrossAnatomySystemCoverage = {
  requiredStructureSlugs: string[]
  missingRequiredSystemSlugs: string[]
  missingRequiredStructureSlugs: string[]
  systems: Array<{
    systemSlug: string
    systemConceptSlug: string
    requiredStructureSlugs: string[]
    presentStructureSlugs: string[]
    missingStructureSlugs: string[]
  }>
}

export type AtlasBoneCompletenessCoverage = {
  requiredIndividualBoneSlugs: string[]
  missingIndividualBoneSlugs: string[]
  presentIndividualBoneCount: number
  requiredGroupRelationshipKeys: string[]
  missingGroupRelationshipKeys: string[]
  groupRelationshipCount: number
}

export type AnatomyCitationCoverage = {
  sourceReferencedFactCount: number
  sourceReferenceCitationCount: number
  missingSourceReferenceCitationKeys: string[]
  reviewedCitationCount: number
  needsReviewCitationCount: number
  starterCitationCount: number
}

type SourceReferenceCitationTarget = {
  entityType: AnatomyEntityType
  entitySlug: string
  sourceRef: string
  factSlug: string
}

const STARTER_SOURCE = "massagelab-initial-anatomy-foundation"
const REVIEW_SOURCE = "future-clinical-citation-needed"
const CLIENT_LANGUAGE_SOURCE = "massagelab-authored-client-language"
const CLIENT_LANGUAGE_SOURCE_LOCATOR = "MassageLab-authored body-map and client-language mapping policy, 2026-05-23"
const CDC_ROM_SOURCE = "cdc-normal-joint-rom"
const CDC_ROM_LOCATOR = "https://stacks.cdc.gov/view/cdc/153156"
const ROM_TRACKING_SOURCE = "massagelab-authored-rom-tracking"
const ROM_TRACKING_LOCATOR = "MassageLab-authored non-diagnostic ROM tracking protocol metadata, 2026-05-24"
const FIPAT_SOURCE = "fipat-ta2"
const FIPAT_LOCATOR = "https://libraries.dal.ca/Fipat/ta2.html"
const COMMERCIAL_SAFE_SOURCE_SCOPES: AnatomySourceUsageScope[] = ["open_reuse", "commercial_licensed"]
const DEFERRED_SEED_SOURCE_REFERENCE_REFS = new Set([
  "massagelab-authored-energetic-anatomy",
])
const TERMINOLOGY_ONLY_SOURCE_REFS = new Set(["fipat-ta2"])
const COMMERCIAL_SAFE_REVIEWED_FACT_TYPES = new Set([
  "clinical_summary",
  "display_summary",
  "education_summary",
  "public_education",
  "client_education",
  "game_prompt",
  "flashcard_prompt",
  "media_source",
])

const BASE_SHOULDER_CHEST_REVIEWED_MUSCLE_CITATION_SPECS = [
  {
    slug: "serratus-anterior",
    termFact: "term-serratus-anterior-formal",
    identifierFact: "external-id-serratus-anterior-fma",
    identifierSourceRef: "bioportal-fma",
    identifierLocator: "FMA:300762",
    originFact: "attachment-serratus-origin-ribs",
    insertionFact: "attachment-serratus-insertion-scapula",
    actionFact: "action-serratus-protraction",
    innervationFact: "innervation-serratus-long-thoracic",
    bloodSupplyFact: "relationship-blood-lateral-thoracic-supplies-serratus",
    officialLocator: "FIPAT TA2: Serratus anterior",
  },
  {
    slug: "pectoralis-minor",
    termFact: "term-pectoralis-minor-formal",
    identifierFact: "external-id-pectoralis-minor-uberon",
    identifierSourceRef: "ols-uberon",
    identifierLocator: "UBERON:0001100",
    originFact: "attachment-pectoralis-minor-origin",
    insertionFact: "attachment-pectoralis-minor-insertion",
    actionFact: "action-pectoralis-minor-protraction",
    innervationFact: "innervation-pectoralis-minor-medial-pectoral",
    bloodSupplyFact: "relationship-blood-lateral-thoracic-supplies-pectoralis-minor",
    officialLocator: "FIPAT TA2: Pectoralis minor",
  },
  {
    slug: "pectoralis-major-clavicular-head",
    termFact: "term-pectoralis-major-clavicular-formal",
    identifierFact: "external-id-pectoralis-major-clavicular-uberon",
    identifierSourceRef: "ols-uberon",
    identifierLocator: "UBERON:0002381",
    originFact: "attachment-pectoralis-major-clavicular-origin",
    insertionFact: "attachment-pectoralis-major-clavicular-insertion",
    actionFact: "action-pectoralis-major-clavicular-flexion",
    innervationFact: "innervation-pectoralis-major-clavicular-lateral-pectoral",
    bloodSupplyFact: "relationship-blood-thoracoacromial-supplies-pectoralis-major-clavicular",
    officialLocator: "FIPAT TA2: Pars clavicularis musculi pectoralis majoris",
  },
  {
    slug: "subclavius",
    termFact: "term-subclavius-formal",
    identifierFact: "external-id-subclavius-uberon",
    identifierSourceRef: "ols-uberon",
    identifierLocator: "UBERON:0008779",
    originFact: "attachment-subclavius-origin",
    insertionFact: "attachment-subclavius-insertion",
    actionFact: "action-subclavius-clavicular-depression",
    innervationFact: "innervation-subclavius-nerve-to-subclavius",
    bloodSupplyFact: "relationship-blood-subclavian-supplies-subclavius",
    officialLocator: "FIPAT TA2: Subclavius",
  },
] as const

const BASE_SHOULDER_CHEST_REVIEWED_MUSCLE_CITATIONS: AnatomyCitation[] = BASE_SHOULDER_CHEST_REVIEWED_MUSCLE_CITATION_SPECS.flatMap((spec) => [
  {
    id: `citation-${spec.slug}-fipat-term`,
    slug: `citation-${spec.slug}-fipat-term`,
    entityType: "muscle",
    entitySlug: spec.slug,
    factType: "official_term",
    factSlug: spec.termFact,
    sourceRef: "fipat-ta2",
    sourceLocator: spec.officialLocator,
    citationNote: "FIPAT TA2 official anatomical terminology used for formal term row.",
    reviewStatus: "reviewed",
  },
  {
    id: `citation-${spec.slug}-external-identifier`,
    slug: `citation-${spec.slug}-external-identifier`,
    entityType: "muscle",
    entitySlug: spec.slug,
    factType: "external_identifier",
    factSlug: spec.identifierFact,
    sourceRef: spec.identifierSourceRef,
    sourceLocator: spec.identifierLocator,
    citationNote: "External vocabulary identifier used as a stable ontology alignment anchor.",
    reviewStatus: "reviewed",
  },
  {
    id: `citation-${spec.slug}-clinical-summary`,
    slug: `citation-${spec.slug}-clinical-summary`,
    entityType: "muscle",
    entitySlug: spec.slug,
    factType: "clinical_summary",
    sourceRef: "applied-human-anatomy",
    sourceLocator: "https://open.umn.edu/opentextbooks/textbooks/1266",
    citationNote: "MassageLab-authored summary verified against Applied Human Anatomy shoulder girdle and pectoral-region material.",
    reviewStatus: "reviewed",
  },
  {
    id: `citation-${spec.slug}-origin`,
    slug: `citation-${spec.slug}-origin`,
    entityType: "muscle",
    entitySlug: spec.slug,
    factType: "origin",
    factSlug: spec.originFact,
    sourceRef: "applied-human-anatomy",
    sourceLocator: "https://open.umn.edu/opentextbooks/textbooks/1266",
    citationNote: "Origin fact verified against Applied Human Anatomy shoulder girdle and pectoral-region material.",
    reviewStatus: "reviewed",
  },
  {
    id: `citation-${spec.slug}-insertion`,
    slug: `citation-${spec.slug}-insertion`,
    entityType: "muscle",
    entitySlug: spec.slug,
    factType: "insertion",
    factSlug: spec.insertionFact,
    sourceRef: "applied-human-anatomy",
    sourceLocator: "https://open.umn.edu/opentextbooks/textbooks/1266",
    citationNote: "Insertion fact verified against Applied Human Anatomy shoulder girdle and pectoral-region material.",
    reviewStatus: "reviewed",
  },
  {
    id: `citation-${spec.slug}-action`,
    slug: `citation-${spec.slug}-action`,
    entityType: "muscle",
    entitySlug: spec.slug,
    factType: "action",
    factSlug: spec.actionFact,
    sourceRef: "applied-human-anatomy",
    sourceLocator: "https://open.umn.edu/opentextbooks/textbooks/1266",
    citationNote: "Action fact verified against Applied Human Anatomy shoulder girdle and pectoral-region material.",
    reviewStatus: "reviewed",
  },
  {
    id: `citation-${spec.slug}-innervation`,
    slug: `citation-${spec.slug}-innervation`,
    entityType: "muscle",
    entitySlug: spec.slug,
    factType: "innervation",
    factSlug: spec.innervationFact,
    sourceRef: "applied-human-anatomy",
    sourceLocator: "https://open.umn.edu/opentextbooks/textbooks/1266",
    citationNote: "Innervation fact verified against Applied Human Anatomy shoulder girdle and pectoral-region material.",
    reviewStatus: "reviewed",
  },
  {
    id: `citation-${spec.slug}-blood-supply`,
    slug: `citation-${spec.slug}-blood-supply`,
    entityType: "muscle",
    entitySlug: spec.slug,
    factType: "blood_supply",
    factSlug: spec.bloodSupplyFact,
    sourceRef: "applied-human-anatomy",
    sourceLocator: "https://open.umn.edu/opentextbooks/textbooks/1266",
    citationNote: "Regional blood-supply relationship verified against Applied Human Anatomy shoulder girdle and pectoral-region material.",
    reviewStatus: "reviewed",
  },
])

const APPLIED_HUMAN_ANATOMY_LOCATOR = "https://open.umn.edu/opentextbooks/textbooks/1266"

type ReviewedLegacyMuscleUpgrade = {
  slug: string
  formalTerm: string
  officialLocator: string
  description: string
  alternateNames?: string[]
  depthNotes?: string
  identifier: {
    provider: "UBERON" | "FMA"
    identifier: string
    iri: string
    label: string
    sourceRef: "ols-uberon" | "bioportal-fma"
  }
}

type ReviewedEntityIdentifier = {
  provider: "UBERON" | "FMA"
  identifier: string
  iri: string
  label: string
  sourceRef: "ols-uberon" | "bioportal-fma"
}

type ReviewedBoneUpgrade = {
  slug: string
  formalTerm: string
  officialLocator: string
  description: string
  commonTerms?: string[]
  identifier: ReviewedEntityIdentifier
}

type ReviewedBoneLandmarkUpgrade = {
  slug: string
  formalTerm: string
  officialLocator: string
  description: string
  commonTerms?: string[]
  identifier?: ReviewedEntityIdentifier
}

type ReviewedSupportEntityUpgrade = {
  entityType: "nerve" | "blood_supply" | "anatomy_structure" | "ligament"
  slug: string
  formalTerm: string
  officialLocator: string
  description: string
  commonTerms?: string[]
  clinicalTerms?: string[]
  abbreviationTerms?: string[]
  identifier: ReviewedEntityIdentifier
}

const REMAINING_LEGACY_REVIEWED_MUSCLE_UPGRADES: ReviewedLegacyMuscleUpgrade[] = [
  {
    slug: "upper-trapezius",
    formalTerm: "Trapezius, superior fibers",
    officialLocator: "FIPAT TA2: Trapezius",
    description: "Upper trapezius is the superior fiber region of trapezius running from the occipital and nuchal region toward the lateral clavicle and acromion. It elevates the scapula, contributes to upward rotation, and can assist cervical extension when the shoulder girdle is fixed.",
    alternateNames: ["upper trap", "superior trapezius"],
    depthNotes: "Superficial to levator scapulae and deeper posterolateral neck structures in the top-of-shoulder region.",
    identifier: { provider: "UBERON", identifier: "UBERON:0002380", iri: "http://purl.obolibrary.org/obo/UBERON_0002380", label: "trapezius muscle", sourceRef: "ols-uberon" },
  },
  {
    slug: "middle-trapezius",
    formalTerm: "Trapezius, middle fibers",
    officialLocator: "FIPAT TA2: Trapezius",
    description: "Middle trapezius is the transverse fiber region of trapezius spanning from the lower cervical and upper thoracic midline to the acromion and scapular spine. It primarily retracts the scapula and helps control scapular position during reaching and posture.",
    alternateNames: ["middle trap", "transverse trapezius"],
    depthNotes: "Superficial to rhomboids across the medial scapular and upper-back region.",
    identifier: { provider: "UBERON", identifier: "UBERON:0002380", iri: "http://purl.obolibrary.org/obo/UBERON_0002380", label: "trapezius muscle", sourceRef: "ols-uberon" },
  },
  {
    slug: "lower-trapezius",
    formalTerm: "Trapezius, inferior fibers",
    officialLocator: "FIPAT TA2: Trapezius",
    description: "Lower trapezius is the inferior fiber region of trapezius running from thoracic spinous processes toward the medial scapular spine. It assists scapular depression and upward rotation, especially as part of coordinated overhead arm elevation.",
    alternateNames: ["lower trap", "inferior trapezius"],
    depthNotes: "Superficial posterior shoulder-girdle muscle over deeper thoracic paraspinal and scapular stabilizer layers.",
    identifier: { provider: "UBERON", identifier: "UBERON:0002380", iri: "http://purl.obolibrary.org/obo/UBERON_0002380", label: "trapezius muscle", sourceRef: "ols-uberon" },
  },
  {
    slug: "levator-scapulae",
    formalTerm: "Levator scapulae",
    officialLocator: "FIPAT TA2: Levator scapulae",
    description: "Levator scapulae runs from upper cervical transverse processes to the superior angle and upper medial border of the scapula. It elevates the scapula and can assist cervical side bending when the shoulder blade is fixed.",
    alternateNames: ["levator scap", "levator scapula muscle"],
    depthNotes: "Deep to upper trapezius in the upper shoulder and lateral posterior neck region.",
    identifier: { provider: "UBERON", identifier: "UBERON:0005461", iri: "http://purl.obolibrary.org/obo/UBERON_0005461", label: "levator scapulae muscle", sourceRef: "ols-uberon" },
  },
  {
    slug: "sternocleidomastoid",
    formalTerm: "Sternocleidomastoideus",
    officialLocator: "FIPAT TA2: Sternocleidomastoideus",
    description: "Sternocleidomastoid is a superficial anterolateral neck muscle with sternal and clavicular heads that insert on the mastoid region. It assists cervical flexion bilaterally and contributes to head rotation and side bending unilaterally.",
    alternateNames: ["SCM", "sternomastoid"],
    depthNotes: "Superficial to deeper anterior and lateral neck muscles including the scalenes.",
    identifier: { provider: "UBERON", identifier: "UBERON:0001128", iri: "http://purl.obolibrary.org/obo/UBERON_0001128", label: "sternocleidomastoid", sourceRef: "ols-uberon" },
  },
  {
    slug: "scalenes",
    formalTerm: "Scalene muscle group",
    officialLocator: "FIPAT TA2: Musculi scaleni",
    description: "The scalenes are a lateral cervical muscle group running from cervical transverse processes to the first and second ribs. They assist cervical lateral flexion and can elevate the upper ribs as accessory breathing muscles.",
    alternateNames: ["scalene muscles", "anterior scalene", "middle scalene", "posterior scalene"],
    depthNotes: "Deep to sternocleidomastoid and superficial to deeper prevertebral neck structures.",
    identifier: { provider: "UBERON", identifier: "UBERON:0008611", iri: "http://purl.obolibrary.org/obo/UBERON_0008611", label: "scalene muscle", sourceRef: "ols-uberon" },
  },
  {
    slug: "rhomboid-major",
    formalTerm: "Rhomboideus major",
    officialLocator: "FIPAT TA2: Rhomboideus major",
    description: "Rhomboid major runs from upper thoracic spinous-process regions to the medial border of the scapula. It retracts the scapula, assists downward rotation, and helps hold the scapula against the thoracic wall.",
    alternateNames: ["major rhomboid"],
    depthNotes: "Deep to trapezius and superficial to the rib cage in the medial scapular region.",
    identifier: { provider: "FMA", identifier: "FMA:13379", iri: "http://purl.org/sig/ont/fma/fma13379", label: "Rhomboid major", sourceRef: "bioportal-fma" },
  },
  {
    slug: "rhomboid-minor",
    formalTerm: "Rhomboideus minor",
    officialLocator: "FIPAT TA2: Rhomboideus minor",
    description: "Rhomboid minor runs from the lower cervical and upper thoracic midline region to the medial scapular border near the root of the scapular spine. It retracts and stabilizes the scapula with rhomboid major.",
    alternateNames: ["minor rhomboid"],
    depthNotes: "Deep to trapezius and superior to rhomboid major near the medial scapular border.",
    identifier: { provider: "FMA", identifier: "FMA:13380", iri: "http://purl.org/sig/ont/fma/fma13380", label: "Rhomboid minor", sourceRef: "bioportal-fma" },
  },
  {
    slug: "supraspinatus",
    formalTerm: "Supraspinatus",
    officialLocator: "FIPAT TA2: Supraspinatus",
    description: "Supraspinatus is a rotator cuff muscle occupying the supraspinous fossa and attaching to the greater tubercle of the humerus. It initiates and assists shoulder abduction while contributing to glenohumeral stability.",
    alternateNames: ["supraspinatus muscle", "rotator cuff"],
    depthNotes: "Deep to trapezius and deltoid coverage at the superior posterior shoulder.",
    identifier: { provider: "UBERON", identifier: "UBERON:0002383", iri: "http://purl.obolibrary.org/obo/UBERON_0002383", label: "supraspinatus muscle", sourceRef: "ols-uberon" },
  },
  {
    slug: "infraspinatus",
    formalTerm: "Infraspinatus",
    officialLocator: "FIPAT TA2: Infraspinatus",
    description: "Infraspinatus is a posterior rotator cuff muscle arising from the infraspinous fossa and attaching to the greater tubercle. It externally rotates the shoulder and helps stabilize the humeral head during arm motion.",
    alternateNames: ["infraspinatus muscle", "rotator cuff"],
    depthNotes: "Deep to posterior deltoid and superficial to the scapula in the posterior shoulder region.",
    identifier: { provider: "UBERON", identifier: "UBERON:0001477", iri: "http://purl.obolibrary.org/obo/UBERON_0001477", label: "infraspinatus muscle", sourceRef: "ols-uberon" },
  },
  {
    slug: "deltoid",
    formalTerm: "Deltoideus",
    officialLocator: "FIPAT TA2: Deltoideus",
    description: "Deltoid is a superficial shoulder muscle with clavicular, acromial, and spinal fiber regions converging on the deltoid tuberosity. It is a primary shoulder abductor and assists flexion, extension, and rotation depending on fiber region.",
    alternateNames: ["deltoideus", "shoulder cap muscle"],
    depthNotes: "Superficial to the rotator cuff, including supraspinatus, infraspinatus, and teres minor.",
    identifier: { provider: "UBERON", identifier: "UBERON:0001476", iri: "http://purl.obolibrary.org/obo/UBERON_0001476", label: "deltoid", sourceRef: "ols-uberon" },
  },
  {
    slug: "splenius-capitis",
    formalTerm: "Splenius capitis",
    officialLocator: "FIPAT TA2: Splenius capitis",
    description: "Splenius capitis is a posterior neck muscle running from the nuchal ligament and upper thoracic region toward the mastoid and lateral occipital region. It assists head and neck extension and ipsilateral rotation.",
    alternateNames: ["splenius capitis muscle"],
    depthNotes: "Intermediate posterior neck layer, deep to trapezius and sternocleidomastoid but superficial to semispinalis capitis.",
    identifier: { provider: "UBERON", identifier: "UBERON:0000711", iri: "http://purl.obolibrary.org/obo/UBERON_0000711", label: "splenius capitis", sourceRef: "ols-uberon" },
  },
  {
    slug: "splenius-cervicis",
    formalTerm: "Splenius cervicis",
    officialLocator: "FIPAT TA2: Splenius cervicis",
    description: "Splenius cervicis is a posterior neck muscle running from upper thoracic spinous-process regions to upper cervical transverse processes. It assists cervical extension, ipsilateral rotation, and side bending.",
    alternateNames: ["splenius cervicis muscle"],
    depthNotes: "Intermediate posterior neck layer deep to trapezius and superficial to transversospinalis muscles.",
    identifier: { provider: "UBERON", identifier: "UBERON:0008544", iri: "http://purl.obolibrary.org/obo/UBERON_0008544", label: "splenius cervicis", sourceRef: "ols-uberon" },
  },
  {
    slug: "suboccipital-muscles",
    formalTerm: "Suboccipital muscle group",
    officialLocator: "FIPAT TA2: Suboccipital muscles",
    description: "The suboccipital muscles are a small deep posterior upper-cervical group connecting the atlas, axis, and occipital bone. They fine-tune head extension and upper-cervical rotation and are important for base-of-skull anatomy education.",
    alternateNames: ["suboccipitals", "posterior suboccipital muscles"],
    depthNotes: "Deep to semispinalis capitis and splenius capitis at the base of the skull.",
    identifier: { provider: "FMA", identifier: "FMA:32582", iri: "http://purl.org/sig/ont/fma/fma32582", label: "Posterior suboccipital muscle", sourceRef: "bioportal-fma" },
  },
  {
    slug: "semispinalis-capitis",
    formalTerm: "Semispinalis capitis",
    officialLocator: "FIPAT TA2: Semispinalis capitis",
    description: "Semispinalis capitis is a deep posterior cervical and upper thoracic muscle running toward the occipital bone. It extends the head and neck and contributes to postural control of the posterior cervical region.",
    alternateNames: ["semispinalis capitis muscle"],
    depthNotes: "Deep to splenius capitis and superficial to the suboccipital muscle group in the posterior neck.",
    identifier: { provider: "UBERON", identifier: "UBERON:0001409", iri: "http://purl.obolibrary.org/obo/UBERON_0001409", label: "semispinalis capitis", sourceRef: "ols-uberon" },
  },
  {
    slug: "erector-spinae-upper-thoracic",
    formalTerm: "Erector spinae, upper thoracic fibers",
    officialLocator: "FIPAT TA2: Erector spinae",
    description: "Upper thoracic erector spinae represents the regional thoracic portion of the erector spinae muscle group. It supports thoracic extension, postural control, and rib-spine mechanics in the upper-back anatomy slice.",
    alternateNames: ["upper thoracic paraspinals", "thoracic erector spinae"],
    depthNotes: "Deep posterior trunk layer under trapezius and rhomboid coverage in the upper back.",
    identifier: { provider: "UBERON", identifier: "UBERON:0002462", iri: "http://purl.obolibrary.org/obo/UBERON_0002462", label: "erector spinae muscle group", sourceRef: "ols-uberon" },
  },
  {
    slug: "subscapularis",
    formalTerm: "Subscapularis",
    officialLocator: "FIPAT TA2: Subscapularis",
    description: "Subscapularis is an anterior rotator cuff muscle arising from the subscapular fossa and attaching to the lesser tubercle. It internally rotates the shoulder and helps stabilize the humeral head from the anterior side.",
    alternateNames: ["subscapularis muscle", "rotator cuff"],
    depthNotes: "Deep to the scapula's anterior surface, serratus anterior, and anterior shoulder-girdle soft tissue layers.",
    identifier: { provider: "UBERON", identifier: "UBERON:0001129", iri: "http://purl.obolibrary.org/obo/UBERON_0001129", label: "subscapularis muscle", sourceRef: "ols-uberon" },
  },
  {
    slug: "teres-minor",
    formalTerm: "Teres minor",
    officialLocator: "FIPAT TA2: Teres minor",
    description: "Teres minor is a posterior rotator cuff muscle running from the lateral border of the scapula to the greater tubercle of the humerus. It externally rotates the shoulder, assists adduction, and supports posterior glenohumeral stability.",
    alternateNames: ["teres minor muscle", "rotator cuff"],
    depthNotes: "Deep to posterior deltoid and superior to teres major at the posterior shoulder.",
    identifier: { provider: "UBERON", identifier: "UBERON:0010496", iri: "http://purl.obolibrary.org/obo/UBERON_0010496", label: "teres minor muscle", sourceRef: "ols-uberon" },
  },
  {
    slug: "teres-major",
    formalTerm: "Teres major",
    officialLocator: "FIPAT TA2: Teres major",
    description: "Teres major runs from the inferior lateral scapular region to the proximal humerus near the intertubercular sulcus. It assists shoulder extension, adduction, and internal rotation and is closely related to latissimus dorsi mechanics.",
    alternateNames: ["teres major muscle"],
    depthNotes: "Deep to latissimus dorsi at their overlapping posterior axillary border relationship.",
    identifier: { provider: "UBERON", identifier: "UBERON:0001478", iri: "http://purl.obolibrary.org/obo/UBERON_0001478", label: "teres major muscle", sourceRef: "ols-uberon" },
  },
  {
    slug: "latissimus-dorsi",
    formalTerm: "Latissimus dorsi",
    officialLocator: "FIPAT TA2: Latissimus dorsi",
    description: "Latissimus dorsi is a broad superficial back muscle running from the thoracolumbar and lower thoracic region toward the proximal humerus. It extends, adducts, and internally rotates the shoulder and helps connect trunk and arm mechanics.",
    alternateNames: ["lat", "lats", "latissimus dorsi muscle"],
    depthNotes: "Superficial to teres major near the posterior axillary fold and broad upper-back surface.",
    identifier: { provider: "UBERON", identifier: "UBERON:0001112", iri: "http://purl.obolibrary.org/obo/UBERON_0001112", label: "latissimus dorsi muscle", sourceRef: "ols-uberon" },
  },
  {
    slug: "hamstrings",
    formalTerm: "Hamstring muscle group",
    officialLocator: "FIPAT TA2: Posterior thigh muscles",
    description: "The hamstrings are a posterior thigh muscle group represented here for body-map and SOAP-tag coverage. They commonly flex the knee, assist hip extension, and relate to the ischial tuberosity, tibia, and fibula depending on the component muscle.",
    alternateNames: ["posterior thigh", "hamstring muscles"],
    depthNotes: "Superficial-to-intermediate posterior thigh group deep to posterior thigh fascia.",
    identifier: { provider: "FMA", identifier: "FMA:81022", iri: "http://purl.org/sig/ont/fma/fma81022", label: "Set of hamstring muscles", sourceRef: "bioportal-fma" },
  },
  {
    slug: "adductor-group",
    formalTerm: "Hip adductor group",
    officialLocator: "FIPAT TA2: Medial thigh muscles",
    description: "The adductor group represents the medial thigh muscles used for first-pass body-map, SOAP-tag, and movement coverage. The group adducts the hip and includes muscles attaching from pubic or ischiopubic regions toward the femur.",
    alternateNames: ["inner thigh", "hip adductors", "adductor muscles"],
    depthNotes: "Medial thigh group with superficial, intermediate, and deep components, represented as variable depth in this starter row.",
    identifier: { provider: "UBERON", identifier: "UBERON:0011145", iri: "http://purl.obolibrary.org/obo/UBERON_0011145", label: "adductor muscle", sourceRef: "ols-uberon" },
  },
]

const SHOULDER_GIRDLE_REVIEWED_BONE_UPGRADES: ReviewedBoneUpgrade[] = [
  {
    slug: "clavicle",
    formalTerm: "Clavicle",
    officialLocator: "FIPAT TA2: Clavicula",
    description: "The clavicle is the collarbone connecting the sternum and scapula across the anterior shoulder girdle. It supports the shoulder away from the trunk, gives attachment to shoulder and neck muscles, and participates in sternoclavicular and acromioclavicular movement.",
    commonTerms: ["collarbone"],
    identifier: { provider: "UBERON", identifier: "UBERON:0001105", iri: "http://purl.obolibrary.org/obo/UBERON_0001105", label: "clavicle bone", sourceRef: "ols-uberon" },
  },
  {
    slug: "scapula",
    formalTerm: "Scapula",
    officialLocator: "FIPAT TA2: Scapula",
    description: "The scapula is the shoulder blade, a broad triangular bone on the posterior thorax. It provides the glenoid socket for the humerus and many attachment sites for rotator cuff, scapular stabilizer, shoulder, and arm muscles.",
    commonTerms: ["shoulder blade"],
    identifier: { provider: "UBERON", identifier: "UBERON:0006849", iri: "http://purl.obolibrary.org/obo/UBERON_0006849", label: "scapula", sourceRef: "ols-uberon" },
  },
  {
    slug: "humerus",
    formalTerm: "Humerus",
    officialLocator: "FIPAT TA2: Humerus",
    description: "The humerus is the upper arm bone linking the shoulder and elbow. Its proximal landmarks receive rotator cuff and shoulder muscle attachments, while its shaft and distal end support arm, forearm, and elbow mechanics.",
    commonTerms: ["upper arm bone"],
    identifier: { provider: "UBERON", identifier: "UBERON:0000976", iri: "http://purl.obolibrary.org/obo/UBERON_0000976", label: "humerus", sourceRef: "ols-uberon" },
  },
  {
    slug: "ribs",
    formalTerm: "Costae",
    officialLocator: "FIPAT TA2: Costae",
    description: "The ribs form the curved bony framework of the thoracic cage. In the upper trunk they provide attachment and movement context for the scalenes, serratus anterior, intercostals, pectoral muscles, and breathing-related mechanics.",
    commonTerms: ["rib cage", "ribs"],
    identifier: { provider: "UBERON", identifier: "UBERON:0002228", iri: "http://purl.obolibrary.org/obo/UBERON_0002228", label: "rib", sourceRef: "ols-uberon" },
  },
  {
    slug: "sternum",
    formalTerm: "Sternum",
    officialLocator: "FIPAT TA2: Sternum",
    description: "The sternum is the midline anterior chest bone that anchors the clavicles and upper ribs. It is important for sternoclavicular mechanics, anterior shoulder-girdle attachments, and thoracic body-map language.",
    commonTerms: ["breastbone"],
    identifier: { provider: "UBERON", identifier: "UBERON:0000975", iri: "http://purl.obolibrary.org/obo/UBERON_0000975", label: "sternum", sourceRef: "ols-uberon" },
  },
]

const SHOULDER_GIRDLE_REVIEWED_LANDMARK_UPGRADES: ReviewedBoneLandmarkUpgrade[] = [
  {
    slug: "lateral-third-clavicle",
    formalTerm: "Lateral third of clavicle",
    officialLocator: "FIPAT TA2: Clavicula, extremitas acromialis",
    description: "The lateral third of the clavicle is the outer clavicular region near the acromion, used for trapezius and deltoid attachments and acromioclavicular orientation.",
    commonTerms: ["outer collarbone"],
    identifier: { provider: "FMA", identifier: "FMA:322088", iri: "http://purl.org/sig/ont/fma/fma322088", label: "Lateral third of clavicle", sourceRef: "bioportal-fma" },
  },
  {
    slug: "medial-clavicle",
    formalTerm: "Sternal end of clavicle",
    officialLocator: "FIPAT TA2: Clavicula, extremitas sternalis",
    description: "The medial clavicle is the sternal end of the clavicle, forming the sternoclavicular region and providing anterior shoulder-girdle orientation for pectoral and neck attachments.",
    commonTerms: ["inner collarbone"],
    identifier: { provider: "UBERON", identifier: "UBERON:0006805", iri: "http://purl.obolibrary.org/obo/UBERON_0006805", label: "sternal end of clavicle", sourceRef: "ols-uberon" },
  },
  {
    slug: "inferior-clavicle",
    formalTerm: "Inferior surface of clavicle",
    officialLocator: "FIPAT TA2: Clavicula",
    description: "The inferior clavicle is the lower surface of the clavicle, used in this dataset for subclavius attachment and costoclavicular shoulder-girdle relationships.",
    commonTerms: ["underside of collarbone"],
    identifier: { provider: "FMA", identifier: "FMA:23308", iri: "http://purl.org/sig/ont/fma/fma23308", label: "Inferior surface of clavicle", sourceRef: "bioportal-fma" },
  },
  {
    slug: "acromion",
    formalTerm: "Acromion",
    officialLocator: "FIPAT TA2: Acromion",
    description: "The acromion is the lateral projection of the scapular spine at the top of the shoulder, forming the acromioclavicular region and serving as a key deltoid and trapezius attachment landmark.",
    commonTerms: ["point of shoulder"],
    identifier: { provider: "UBERON", identifier: "UBERON:0002497", iri: "http://purl.obolibrary.org/obo/UBERON_0002497", label: "acromion", sourceRef: "ols-uberon" },
  },
  {
    slug: "spine-of-scapula",
    formalTerm: "Spine of scapula",
    officialLocator: "FIPAT TA2: Spina scapulae",
    description: "The spine of the scapula is the prominent posterior ridge dividing supraspinous and infraspinous regions and providing attachment for trapezius and deltoid fibers.",
    commonTerms: ["shoulder blade ridge"],
    identifier: { provider: "UBERON", identifier: "UBERON:0004651", iri: "http://purl.obolibrary.org/obo/UBERON_0004651", label: "scapula spine", sourceRef: "ols-uberon" },
  },
  {
    slug: "medial-border-scapula",
    formalTerm: "Medial border of scapula",
    officialLocator: "FIPAT TA2: Margo medialis scapulae",
    description: "The medial border of the scapula lies closest to the spine and is a key attachment region for rhomboids, serratus anterior, and levator scapulae relationships.",
    commonTerms: ["inside edge of shoulder blade"],
    identifier: { provider: "UBERON", identifier: "UBERON:0007174", iri: "http://purl.obolibrary.org/obo/UBERON_0007174", label: "medial border of scapula", sourceRef: "ols-uberon" },
  },
  {
    slug: "lateral-border-scapula",
    formalTerm: "Lateral border of scapula",
    officialLocator: "FIPAT TA2: Margo lateralis scapulae",
    description: "The lateral border of the scapula is the outer axillary border leading toward the glenoid region and serving as an attachment area for teres minor and teres major.",
    commonTerms: ["outer edge of shoulder blade"],
    identifier: { provider: "UBERON", identifier: "UBERON:0007173", iri: "http://purl.obolibrary.org/obo/UBERON_0007173", label: "lateral border of scapula", sourceRef: "ols-uberon" },
  },
  {
    slug: "superior-border-scapula",
    formalTerm: "Superior border of scapula",
    officialLocator: "FIPAT TA2: Margo superior scapulae",
    description: "The superior border of the scapula is the upper scapular edge near the superior angle and coracoid process, relevant to levator scapulae and suprascapular-region anatomy.",
    commonTerms: ["top edge of shoulder blade"],
    identifier: { provider: "FMA", identifier: "FMA:296241", iri: "http://purl.org/sig/ont/fma/fma296241", label: "Superior border of body of scapula", sourceRef: "bioportal-fma" },
  },
  {
    slug: "superior-angle-scapula",
    formalTerm: "Superior angle of scapula",
    officialLocator: "FIPAT TA2: Angulus superior scapulae",
    description: "The superior angle of the scapula is the upper medial corner of the shoulder blade, commonly used for levator scapulae insertion and top-of-shoulder region mapping.",
    commonTerms: ["top inner corner of shoulder blade"],
    identifier: { provider: "UBERON", identifier: "UBERON:0007176", iri: "http://purl.obolibrary.org/obo/UBERON_0007176", label: "superior angle of scapula", sourceRef: "ols-uberon" },
  },
  {
    slug: "inferior-angle-scapula",
    formalTerm: "Inferior angle of scapula",
    officialLocator: "FIPAT TA2: Angulus inferior scapulae",
    description: "The inferior angle of the scapula is the lower tip of the shoulder blade, a useful landmark for latissimus dorsi, teres major, serratus anterior, and scapular rotation mapping.",
    commonTerms: ["bottom tip of shoulder blade"],
    identifier: { provider: "UBERON", identifier: "UBERON:0007175", iri: "http://purl.obolibrary.org/obo/UBERON_0007175", label: "inferior angle of scapula", sourceRef: "ols-uberon" },
  },
  {
    slug: "coracoid-process",
    formalTerm: "Coracoid process of scapula",
    officialLocator: "FIPAT TA2: Processus coracoideus",
    description: "The coracoid process is an anterior scapular projection that anchors pectoralis minor, short head biceps, coracobrachialis, and several shoulder ligaments.",
    commonTerms: ["front hook of shoulder blade"],
    identifier: { provider: "UBERON", identifier: "UBERON:0006633", iri: "http://purl.obolibrary.org/obo/UBERON_0006633", label: "coracoid process of scapula", sourceRef: "ols-uberon" },
  },
  {
    slug: "glenoid-cavity",
    formalTerm: "Glenoid cavity",
    officialLocator: "FIPAT TA2: Cavitas glenoidalis",
    description: "The glenoid cavity is the shallow scapular socket for the humeral head, central to glenohumeral joint motion, shoulder stability, and client language about the shoulder socket.",
    commonTerms: ["shoulder socket", "glenoid fossa"],
    identifier: { provider: "UBERON", identifier: "UBERON:0006657", iri: "http://purl.obolibrary.org/obo/UBERON_0006657", label: "glenoid fossa", sourceRef: "ols-uberon" },
  },
  {
    slug: "supraspinous-fossa",
    formalTerm: "Supraspinous fossa",
    officialLocator: "FIPAT TA2: Fossa supraspinata",
    description: "The supraspinous fossa is the posterior scapular depression above the scapular spine, serving as the origin region for supraspinatus.",
    commonTerms: ["top back hollow of shoulder blade"],
    identifier: { provider: "UBERON", identifier: "UBERON:1200261", iri: "http://purl.obolibrary.org/obo/UBERON_1200261", label: "supraspinous fossa of scapula", sourceRef: "ols-uberon" },
  },
  {
    slug: "infraspinous-fossa",
    formalTerm: "Infraspinous fossa",
    officialLocator: "FIPAT TA2: Fossa infraspinata",
    description: "The infraspinous fossa is the broad posterior scapular depression below the scapular spine and is the major origin region for infraspinatus.",
    commonTerms: ["lower back hollow of shoulder blade"],
    identifier: { provider: "UBERON", identifier: "UBERON:1200112", iri: "http://purl.obolibrary.org/obo/UBERON_1200112", label: "infraspinous fossa of scapula", sourceRef: "ols-uberon" },
  },
  {
    slug: "subscapular-fossa",
    formalTerm: "Subscapular fossa",
    officialLocator: "FIPAT TA2: Fossa subscapularis",
    description: "The subscapular fossa is the anterior costal surface depression of the scapula and the origin region for subscapularis.",
    commonTerms: ["front hollow of shoulder blade"],
    identifier: { provider: "UBERON", identifier: "UBERON:4200038", iri: "http://purl.obolibrary.org/obo/UBERON_4200038", label: "subscapular fossa", sourceRef: "ols-uberon" },
  },
  {
    slug: "greater-tubercle",
    formalTerm: "Greater tubercle of humerus",
    officialLocator: "FIPAT TA2: Tuberculum majus humeri",
    description: "The greater tubercle is the lateral proximal humeral prominence receiving supraspinatus, infraspinatus, and teres minor insertions.",
    commonTerms: ["greater tuberosity"],
    identifier: { provider: "FMA", identifier: "FMA:23390", iri: "http://purl.org/sig/ont/fma/fma23390", label: "Greater tubercle of humerus", sourceRef: "bioportal-fma" },
  },
  {
    slug: "lesser-tubercle",
    formalTerm: "Lesser tubercle of humerus",
    officialLocator: "FIPAT TA2: Tuberculum minus humeri",
    description: "The lesser tubercle is the anterior proximal humeral prominence that receives the subscapularis insertion and helps define the intertubercular sulcus.",
    commonTerms: ["lesser tuberosity"],
    identifier: { provider: "UBERON", identifier: "UBERON:0011188", iri: "http://purl.obolibrary.org/obo/UBERON_0011188", label: "lesser tubercle of humerus", sourceRef: "ols-uberon" },
  },
  {
    slug: "intertubercular-sulcus",
    formalTerm: "Intertubercular sulcus of humerus",
    officialLocator: "FIPAT TA2: Sulcus intertubercularis",
    description: "The intertubercular sulcus is the proximal humeral groove between the tubercles, guiding the long head biceps tendon region and receiving nearby shoulder muscle insertions.",
    commonTerms: ["bicipital groove"],
    identifier: { provider: "FMA", identifier: "FMA:23396", iri: "http://purl.org/sig/ont/fma/fma23396", label: "Intertubercular sulcus of humerus", sourceRef: "bioportal-fma" },
  },
  {
    slug: "deltoid-tuberosity",
    formalTerm: "Deltoid tuberosity of humerus",
    officialLocator: "FIPAT TA2: Tuberositas deltoidea",
    description: "The deltoid tuberosity is a roughened lateral humeral shaft landmark where deltoid inserts and transfers shoulder muscle force to the arm.",
    commonTerms: ["deltoid attachment on upper arm"],
    identifier: { provider: "FMA", identifier: "FMA:23418", iri: "http://purl.org/sig/ont/fma/fma23418", label: "Deltoid tuberosity of humerus", sourceRef: "bioportal-fma" },
  },
  {
    slug: "first-rib",
    formalTerm: "First rib",
    officialLocator: "FIPAT TA2: Costa prima",
    description: "The first rib is the uppermost rib, important for scalene and subclavius attachments and thoracic outlet region orientation.",
    commonTerms: ["top rib"],
    identifier: { provider: "FMA", identifier: "FMA:7597", iri: "http://purl.org/sig/ont/fma/fma7597", label: "First rib", sourceRef: "bioportal-fma" },
  },
  {
    slug: "upper-ribs",
    formalTerm: "Upper ribs",
    officialLocator: "FIPAT TA2: Costae",
    description: "Upper ribs are represented as a regional group for muscles attaching to the upper thoracic cage, including serratus anterior, pectoralis minor, scalenes, and intercostals.",
    commonTerms: ["upper rib cage"],
  },
  {
    slug: "manubrium",
    formalTerm: "Manubrium of sternum",
    officialLocator: "FIPAT TA2: Manubrium sterni",
    description: "The manubrium is the superior sternum segment articulating with the clavicles and first ribs and serving as a key anterior neck and shoulder-girdle landmark.",
    commonTerms: ["top of breastbone"],
    identifier: { provider: "UBERON", identifier: "UBERON:0002205", iri: "http://purl.obolibrary.org/obo/UBERON_0002205", label: "manubrium of sternum", sourceRef: "ols-uberon" },
  },
  {
    slug: "sternal-body",
    formalTerm: "Body of sternum",
    officialLocator: "FIPAT TA2: Corpus sterni",
    description: "The sternal body is the elongated middle portion of the sternum, relevant for anterior chest orientation and rib attachment context.",
    commonTerms: ["middle of breastbone"],
    identifier: { provider: "UBERON", identifier: "UBERON:0006820", iri: "http://purl.obolibrary.org/obo/UBERON_0006820", label: "body of sternum", sourceRef: "ols-uberon" },
  },
]

const HEAD_NECK_SPINE_REVIEWED_BONE_UPGRADES: ReviewedBoneUpgrade[] = [
  {
    slug: "occipital-bone",
    formalTerm: "Occipital bone",
    officialLocator: "FIPAT TA2: Os occipitale",
    description: "The occipital bone forms the posterior and inferior part of the skull and contributes to the base-of-skull region. It provides nuchal-line landmarks for posterior neck and upper shoulder-girdle muscle attachments.",
    commonTerms: ["base of skull bone", "back of skull"],
    identifier: { provider: "FMA", identifier: "FMA:52735", iri: "http://purl.org/sig/ont/fma/fma52735", label: "Occipital bone", sourceRef: "bioportal-fma" },
  },
  {
    slug: "temporal-bone",
    formalTerm: "Temporal bone",
    officialLocator: "FIPAT TA2: Os temporale",
    description: "The temporal bone forms part of the side and base of the skull and includes the mastoid process region. It is important for sternocleidomastoid, splenius capitis, and head-neck landmark mapping.",
    commonTerms: ["side skull bone"],
    identifier: { provider: "FMA", identifier: "FMA:52737", iri: "http://purl.org/sig/ont/fma/fma52737", label: "Temporal bone", sourceRef: "bioportal-fma" },
  },
  {
    slug: "atlas",
    formalTerm: "Atlas",
    officialLocator: "FIPAT TA2: Atlas",
    description: "The atlas is the first cervical vertebra, supporting the skull at the atlanto-occipital region. It is central to upper cervical rotation, nodding mechanics, and suboccipital muscle relationships.",
    commonTerms: ["C1 vertebra", "first cervical vertebra"],
    identifier: { provider: "FMA", identifier: "FMA:12519", iri: "http://purl.org/sig/ont/fma/fma12519", label: "Atlas", sourceRef: "bioportal-fma" },
  },
  {
    slug: "axis",
    formalTerm: "Axis",
    officialLocator: "FIPAT TA2: Axis",
    description: "The axis is the second cervical vertebra and forms the pivot relationship for much of upper-cervical rotation. It provides attachment context for suboccipital and posterior neck muscle control.",
    commonTerms: ["C2 vertebra", "second cervical vertebra"],
    identifier: { provider: "FMA", identifier: "FMA:12520", iri: "http://purl.org/sig/ont/fma/fma12520", label: "Axis", sourceRef: "bioportal-fma" },
  },
  {
    slug: "cervical-vertebrae",
    formalTerm: "Cervical vertebrae",
    officialLocator: "FIPAT TA2: Vertebrae cervicales",
    description: "The cervical vertebrae are the neck vertebrae supporting the head and providing attachment sites for deep and superficial neck muscles. They frame cervical flexion, extension, rotation, and lateral flexion.",
    commonTerms: ["neck vertebrae", "cervical spine bones"],
    identifier: { provider: "UBERON", identifier: "UBERON:0002413", iri: "http://purl.obolibrary.org/obo/UBERON_0002413", label: "cervical vertebra", sourceRef: "ols-uberon" },
  },
  {
    slug: "thoracic-vertebrae",
    formalTerm: "Thoracic vertebrae",
    officialLocator: "FIPAT TA2: Vertebrae thoracicae",
    description: "The thoracic vertebrae form the upper and mid back portion of the vertebral column. In this dataset they anchor upper-back muscle attachments, rib mechanics, posture, and thoracic movement mapping.",
    commonTerms: ["upper back vertebrae", "thoracic spine bones"],
    identifier: { provider: "UBERON", identifier: "UBERON:0002347", iri: "http://purl.obolibrary.org/obo/UBERON_0002347", label: "thoracic vertebra", sourceRef: "ols-uberon" },
  },
]

const HEAD_NECK_SPINE_REVIEWED_LANDMARK_UPGRADES: ReviewedBoneLandmarkUpgrade[] = [
  {
    slug: "external-occipital-protuberance",
    formalTerm: "External occipital protuberance",
    officialLocator: "FIPAT TA2: Protuberantia occipitalis externa",
    description: "The external occipital protuberance is the midline bump on the posterior occipital bone and helps orient nuchal ligament and upper trapezius attachment regions.",
    commonTerms: ["bump at back of skull"],
    identifier: { provider: "UBERON", identifier: "UBERON:0013469", iri: "http://purl.obolibrary.org/obo/UBERON_0013469", label: "external occipital protuberance", sourceRef: "ols-uberon" },
  },
  {
    slug: "superior-nuchal-line",
    formalTerm: "Superior nuchal line",
    officialLocator: "FIPAT TA2: Linea nuchalis superior",
    description: "The superior nuchal line is a curved posterior occipital landmark used for upper trapezius and other posterior head-neck muscle attachment references.",
    commonTerms: ["upper nuchal line"],
    identifier: { provider: "UBERON", identifier: "UBERON:0014803", iri: "http://purl.obolibrary.org/obo/UBERON_0014803", label: "superior nuchal line attachment site", sourceRef: "ols-uberon" },
  },
  {
    slug: "inferior-nuchal-line",
    formalTerm: "Inferior nuchal line",
    officialLocator: "FIPAT TA2: Linea nuchalis inferior",
    description: "The inferior nuchal line is a lower posterior occipital landmark used for deep suboccipital and posterior neck attachment orientation.",
    commonTerms: ["lower nuchal line"],
    identifier: { provider: "UBERON", identifier: "UBERON:0014805", iri: "http://purl.obolibrary.org/obo/UBERON_0014805", label: "inferior nuchal line attachment site", sourceRef: "ols-uberon" },
  },
  {
    slug: "mastoid-process",
    formalTerm: "Mastoid process",
    officialLocator: "FIPAT TA2: Processus mastoideus",
    description: "The mastoid process is the palpable projection of the temporal bone behind the ear and is a major insertion landmark for sternocleidomastoid and splenius capitis.",
    commonTerms: ["bone behind ear"],
    identifier: { provider: "UBERON", identifier: "UBERON:0011220", iri: "http://purl.obolibrary.org/obo/UBERON_0011220", label: "mastoid process of temporal bone", sourceRef: "ols-uberon" },
  },
  {
    slug: "posterior-arch-atlas",
    formalTerm: "Posterior arch of atlas",
    officialLocator: "FIPAT TA2: Arcus posterior atlantis",
    description: "The posterior arch of the atlas is the back portion of C1 and provides upper-cervical landmark context for suboccipital muscle and atlanto-occipital mechanics.",
    commonTerms: ["back arch of C1"],
    identifier: { provider: "UBERON", identifier: "UBERON:0008437", iri: "http://purl.obolibrary.org/obo/UBERON_0008437", label: "posterior arch of atlas", sourceRef: "ols-uberon" },
  },
  {
    slug: "axis-spinous-process",
    formalTerm: "Spinous process of axis",
    officialLocator: "FIPAT TA2: Processus spinosus axis",
    description: "The axis spinous process is the posterior projection of C2, used for suboccipital and deeper posterior neck muscle attachment orientation.",
    commonTerms: ["C2 spinous process"],
    identifier: { provider: "FMA", identifier: "FMA:24059", iri: "http://purl.org/sig/ont/fma/fma24059", label: "Spinous process of axis", sourceRef: "bioportal-fma" },
  },
  {
    slug: "cervical-transverse-processes",
    formalTerm: "Transverse processes of cervical vertebrae",
    officialLocator: "FIPAT TA2: Processus transversi vertebrarum cervicalium",
    description: "The cervical transverse processes are lateral projections of the neck vertebrae and key attachment regions for scalenes, levator scapulae, and deep neck muscles.",
    commonTerms: ["side processes of neck vertebrae"],
    identifier: { provider: "UBERON", identifier: "UBERON:0018143", iri: "http://purl.obolibrary.org/obo/UBERON_0018143", label: "transverse process of cervical vertebra", sourceRef: "ols-uberon" },
  },
  {
    slug: "cervical-spinous-processes",
    formalTerm: "Spinous processes of cervical vertebrae",
    officialLocator: "FIPAT TA2: Processus spinosi vertebrarum cervicalium",
    description: "The cervical spinous processes are posterior neck vertebral projections used for nuchal ligament, trapezius, splenius, and other posterior neck attachment mapping.",
    commonTerms: ["back processes of neck vertebrae"],
    identifier: { provider: "FMA", identifier: "FMA:13458", iri: "http://purl.org/sig/ont/fma/fma13458", label: "Spinous process of cervical vertebra", sourceRef: "bioportal-fma" },
  },
  {
    slug: "cervicothoracic-spinous-processes",
    formalTerm: "Cervicothoracic spinous processes",
    officialLocator: "FIPAT TA2: Processus spinosi vertebrarum cervicalium et thoracicarum",
    description: "The cervicothoracic spinous processes represent the lower cervical and upper thoracic midline projections used for trapezius, rhomboid, splenius, and upper-back mapping.",
    commonTerms: ["base of neck spinous processes"],
  },
  {
    slug: "upper-thoracic-spinous-processes",
    formalTerm: "Spinous processes of upper thoracic vertebrae",
    officialLocator: "FIPAT TA2: Processus spinosi vertebrarum thoracicarum",
    description: "The upper thoracic spinous processes are posterior upper-back vertebral projections used for trapezius, rhomboid, splenius, erector spinae, and thoracic posture mapping.",
    commonTerms: ["upper back spinous processes"],
    identifier: { provider: "FMA", identifier: "FMA:9149", iri: "http://purl.org/sig/ont/fma/fma9149", label: "Spinous process of thoracic vertebra", sourceRef: "bioportal-fma" },
  },
]

const TRUNK_PELVIS_REVIEWED_BONE_UPGRADES: ReviewedBoneUpgrade[] = [
  {
    slug: "lumbar-vertebrae",
    formalTerm: "Lumbar vertebrae",
    officialLocator: "FIPAT TA2: Vertebrae lumbales",
    description: "The lumbar vertebrae are the low back vertebrae forming the mobile lower portion of the vertebral column. They provide attachment and leverage for lumbar extensors, abdominal wall muscles, quadratus lumborum, and trunk movement mapping.",
    commonTerms: ["low back vertebrae", "lumbar spine bones"],
    identifier: { provider: "FMA", identifier: "FMA:72065", iri: "http://purl.org/sig/ont/fma/fma72065", label: "Set of lumbar vertebrae", sourceRef: "bioportal-fma" },
  },
  {
    slug: "sacrum",
    formalTerm: "Sacrum",
    officialLocator: "FIPAT TA2: Os sacrum",
    description: "The sacrum is the fused triangular bone at the base of the spine between the pelvic bones. It links spinal and pelvic mechanics and provides attachment context for gluteal, pelvic floor, and posterior trunk structures.",
    commonTerms: ["base of spine", "sacral bone"],
    identifier: { provider: "FMA", identifier: "FMA:16202", iri: "http://purl.org/sig/ont/fma/fma16202", label: "Sacrum", sourceRef: "bioportal-fma" },
  },
  {
    slug: "pelvis",
    formalTerm: "Pelvis",
    officialLocator: "FIPAT TA2: Pelvis",
    description: "The pelvis is the bony ring connecting the spine to the lower limbs. It provides major attachment regions for abdominal, hip, thigh, pelvic floor, and low-back structures used in body maps and SOAP tags.",
    commonTerms: ["hip bones", "pelvic bones"],
    identifier: { provider: "FMA", identifier: "FMA:9578", iri: "http://purl.org/sig/ont/fma/fma9578", label: "Pelvis", sourceRef: "bioportal-fma" },
  },
]

const TRUNK_PELVIS_REVIEWED_LANDMARK_UPGRADES: ReviewedBoneLandmarkUpgrade[] = [
  {
    slug: "lumbar-spinous-processes",
    formalTerm: "Spinous processes of lumbar vertebrae",
    officialLocator: "FIPAT TA2: Processus spinosi vertebrarum lumbalium",
    description: "Lumbar spinous processes are posterior low-back midline projections used for erector spinae, multifidus, thoracolumbar fascia, and lumbar palpation orientation.",
    commonTerms: ["low back spinous processes"],
  },
  {
    slug: "lumbar-transverse-processes",
    formalTerm: "Transverse processes of lumbar vertebrae",
    officialLocator: "FIPAT TA2: Processus transversi vertebrarum lumbalium",
    description: "Lumbar transverse processes are lateral projections of the lumbar vertebrae and are important attachment references for quadratus lumborum, psoas, and deep trunk mechanics.",
    commonTerms: ["side processes of low back vertebrae"],
  },
  {
    slug: "iliac-crest",
    formalTerm: "Iliac crest",
    officialLocator: "FIPAT TA2: Crista iliaca",
    description: "The iliac crest is the superior rim of the ilium and a major attachment landmark for abdominal wall, latissimus dorsi, quadratus lumborum, and gluteal fascia relationships.",
    commonTerms: ["hip crest", "top of hip bone"],
  },
  {
    slug: "anterior-superior-iliac-spine",
    formalTerm: "Anterior superior iliac spine",
    officialLocator: "FIPAT TA2: Spina iliaca anterior superior",
    description: "The anterior superior iliac spine is the front point of the iliac crest, used for sartorius, tensor fasciae latae, inguinal ligament, and anterior hip mapping.",
    commonTerms: ["ASIS", "front hip point"],
  },
  {
    slug: "posterior-superior-iliac-spine",
    formalTerm: "Posterior superior iliac spine",
    officialLocator: "FIPAT TA2: Spina iliaca posterior superior",
    description: "The posterior superior iliac spine is the back point of the iliac crest and helps orient sacral, gluteal, low-back, and pelvic body-map regions.",
    commonTerms: ["PSIS", "back hip point"],
  },
  {
    slug: "pubic-crest",
    formalTerm: "Pubic crest",
    officialLocator: "FIPAT TA2: Crista pubica",
    description: "The pubic crest is the superior border of the pubic bone and provides anterior pelvic orientation for abdominal and adductor-region attachments.",
    commonTerms: ["top of pubic bone"],
  },
  {
    slug: "pubic-symphysis",
    formalTerm: "Pubic symphysis",
    officialLocator: "FIPAT TA2: Symphysis pubica",
    description: "The pubic symphysis is the midline fibrocartilaginous joint between the pubic bones and an important anterior pelvic landmark for core and adductor mapping.",
    commonTerms: ["front pelvic joint"],
  },
  {
    slug: "sacral-base",
    formalTerm: "Base of sacrum",
    officialLocator: "FIPAT TA2: Basis ossis sacri",
    description: "The sacral base is the superior portion of the sacrum at the lumbosacral junction and helps orient low-back, sacral, and pelvic mechanics.",
    commonTerms: ["tailbone base", "base of sacrum"],
  },
  {
    slug: "lower-ribs",
    formalTerm: "Lower ribs",
    officialLocator: "FIPAT TA2: Costae",
    description: "Lower ribs are represented as a regional rib group for trunk and abdominal attachments, including diaphragm, obliques, quadratus lumborum, and lower thoracic mechanics.",
    commonTerms: ["lower rib cage"],
  },
  {
    slug: "rib-shafts",
    formalTerm: "Shafts of ribs",
    officialLocator: "FIPAT TA2: Corpus costae",
    description: "Rib shafts are the curved body portions of ribs and provide attachment context for intercostals, serratus posterior, abdominal muscles, and thoracic cage movement.",
    commonTerms: ["rib bodies"],
  },
  {
    slug: "costal-margin",
    formalTerm: "Costal margin",
    officialLocator: "FIPAT TA2: Arcus costalis",
    description: "The costal margin is the lower border of the rib cage formed by costal cartilages and is used for diaphragm, abdominal wall, and upper abdominal body-map orientation.",
    commonTerms: ["lower rib edge"],
  },
  {
    slug: "xiphoid-process",
    formalTerm: "Xiphoid process",
    officialLocator: "FIPAT TA2: Processus xiphoideus",
    description: "The xiphoid process is the inferior projection of the sternum and an anterior trunk landmark for diaphragm, rectus abdominis, and central chest orientation.",
    commonTerms: ["bottom of breastbone"],
  },
  {
    slug: "lumbar-vertebral-bodies",
    formalTerm: "Bodies of lumbar vertebrae",
    officialLocator: "FIPAT TA2: Corpora vertebrarum lumbalium",
    description: "Lumbar vertebral bodies are the anterior weight-bearing portions of the lumbar vertebrae and provide deep anchor context for psoas and spinal loading mechanics.",
    commonTerms: ["front bodies of low back vertebrae"],
  },
]

const LOWER_LIMB_REVIEWED_BONE_UPGRADES: ReviewedBoneUpgrade[] = [
  {
    slug: "femur",
    formalTerm: "Femur",
    officialLocator: "FIPAT TA2: Femur",
    description: "The femur is the thigh bone connecting the hip and knee. It provides major attachment regions for hip muscles, quadriceps, hamstrings, adductors, and knee-related movement tracking.",
    commonTerms: ["thigh bone"],
    identifier: { provider: "FMA", identifier: "FMA:9611", iri: "http://purl.org/sig/ont/fma/fma9611", label: "Femur", sourceRef: "bioportal-fma" },
  },
  {
    slug: "patella",
    formalTerm: "Patella",
    officialLocator: "FIPAT TA2: Patella",
    description: "The patella is the kneecap embedded in the knee extensor apparatus. It improves quadriceps leverage and provides a clear anterior knee landmark for education and body maps.",
    commonTerms: ["kneecap"],
    identifier: { provider: "UBERON", identifier: "UBERON:0002446", iri: "http://purl.obolibrary.org/obo/UBERON_0002446", label: "patella", sourceRef: "ols-uberon" },
  },
  {
    slug: "tibia",
    formalTerm: "Tibia",
    officialLocator: "FIPAT TA2: Tibia",
    description: "The tibia is the larger medial leg bone, commonly called the shin bone. It forms major knee and ankle relationships and receives attachments from quadriceps, pes anserinus, and leg muscles.",
    commonTerms: ["shin bone"],
    identifier: { provider: "FMA", identifier: "FMA:24476", iri: "http://purl.org/sig/ont/fma/fma24476", label: "Tibia", sourceRef: "bioportal-fma" },
  },
  {
    slug: "fibula",
    formalTerm: "Fibula",
    officialLocator: "FIPAT TA2: Fibula",
    description: "The fibula is the slender lateral leg bone contributing to the lateral ankle and lower-leg muscle attachments. It is important for ankle stability, peroneal muscle mapping, and lateral leg anatomy.",
    commonTerms: ["outer lower leg bone"],
    identifier: { provider: "FMA", identifier: "FMA:24479", iri: "http://purl.org/sig/ont/fma/fma24479", label: "Fibula", sourceRef: "bioportal-fma" },
  },
  {
    slug: "calcaneus",
    formalTerm: "Calcaneus",
    officialLocator: "FIPAT TA2: Calcaneus",
    description: "The calcaneus is the heel bone and the posterior tarsal anchor for the calcaneal tendon and plantar foot structures. It is central to ankle, foot, and calf mechanics.",
    commonTerms: ["heel bone"],
    identifier: { provider: "UBERON", identifier: "UBERON:0001450", iri: "http://purl.obolibrary.org/obo/UBERON_0001450", label: "calcaneus", sourceRef: "ols-uberon" },
  },
  {
    slug: "tarsals",
    formalTerm: "Tarsal bones",
    officialLocator: "FIPAT TA2: Ossa tarsi",
    description: "The tarsal bones form the rearfoot and midfoot skeleton, supporting ankle-foot movement, arch mechanics, and attachment context for intrinsic and extrinsic foot muscles.",
    commonTerms: ["ankle bones", "rearfoot bones"],
    identifier: { provider: "UBERON", identifier: "UBERON:0001447", iri: "http://purl.obolibrary.org/obo/UBERON_0001447", label: "tarsal bone", sourceRef: "ols-uberon" },
  },
  {
    slug: "metatarsals",
    formalTerm: "Metatarsal bones",
    officialLocator: "FIPAT TA2: Ossa metatarsi",
    description: "The metatarsals are the long bones of the forefoot connecting tarsals to toe phalanges. They support toe movement, gait mechanics, and plantar foot muscle attachments.",
    commonTerms: ["forefoot bones"],
    identifier: { provider: "UBERON", identifier: "UBERON:0001448", iri: "http://purl.obolibrary.org/obo/UBERON_0001448", label: "metatarsal bone", sourceRef: "ols-uberon" },
  },
  {
    slug: "foot-phalanges",
    formalTerm: "Phalanges of foot",
    officialLocator: "FIPAT TA2: Ossa digitorum pedis",
    description: "The foot phalanges are the toe bones used for toe flexion, extension, spreading, and push-off mechanics. They anchor intrinsic and extrinsic toe muscle relationships.",
    commonTerms: ["toe bones"],
    identifier: { provider: "FMA", identifier: "FMA:78512", iri: "http://purl.org/sig/ont/fma/fma78512", label: "Set of phalanges of foot", sourceRef: "bioportal-fma" },
  },
]

const LOWER_LIMB_REVIEWED_LANDMARK_UPGRADES: ReviewedBoneLandmarkUpgrade[] = [
  {
    slug: "greater-trochanter",
    formalTerm: "Greater trochanter",
    officialLocator: "FIPAT TA2: Trochanter major",
    description: "The greater trochanter is the large lateral proximal femur landmark for gluteal and deep hip muscle attachments and lateral hip body-map orientation.",
    commonTerms: ["side hip bone bump"],
  },
  {
    slug: "lesser-trochanter",
    formalTerm: "Lesser trochanter",
    officialLocator: "FIPAT TA2: Trochanter minor",
    description: "The lesser trochanter is the smaller posteromedial proximal femur landmark and serves as the insertion point for iliopsoas.",
    commonTerms: ["deep inner hip femur bump"],
  },
  {
    slug: "linea-aspera",
    formalTerm: "Linea aspera",
    officialLocator: "FIPAT TA2: Linea aspera",
    description: "The linea aspera is a posterior femoral ridge providing broad attachment context for adductors, hamstrings, vasti, and gluteus maximus relationships.",
    commonTerms: ["back ridge of thigh bone"],
  },
  {
    slug: "femoral-condyles",
    formalTerm: "Femoral condyles",
    officialLocator: "FIPAT TA2: Condyli femoris",
    description: "The femoral condyles are the distal rounded femur surfaces forming the upper side of the knee joint and anchoring posterior calf and ligament relationships.",
    commonTerms: ["rounded knee end of thigh bone"],
  },
  {
    slug: "adductor-tubercle",
    formalTerm: "Adductor tubercle",
    officialLocator: "FIPAT TA2: Tuberculum adductorium",
    description: "The adductor tubercle is a distal medial femur landmark used for adductor magnus insertion and medial knee orientation.",
    commonTerms: ["inner knee adductor point"],
  },
  {
    slug: "ischial-tuberosity",
    formalTerm: "Ischial tuberosity",
    officialLocator: "FIPAT TA2: Tuber ischiadicum",
    description: "The ischial tuberosity is the sitting bone of the pelvis and a major origin region for hamstrings and posterior thigh mapping.",
    commonTerms: ["sit bone", "sitting bone"],
  },
  {
    slug: "pubic-body",
    formalTerm: "Body of pubis",
    officialLocator: "FIPAT TA2: Corpus ossis pubis",
    description: "The pubic body is the anterior pubic bone region used for adductor, abdominal, and pelvic floor attachment orientation.",
    commonTerms: ["front pubic bone"],
  },
  {
    slug: "inferior-pubic-ramus",
    formalTerm: "Inferior pubic ramus",
    officialLocator: "FIPAT TA2: Ramus inferior ossis pubis",
    description: "The inferior pubic ramus is an inferior pubic bone branch and a useful anchor for medial thigh and pelvic floor attachment relationships.",
    commonTerms: ["lower pubic branch"],
  },
  {
    slug: "tibial-tuberosity",
    formalTerm: "Tibial tuberosity",
    officialLocator: "FIPAT TA2: Tuberositas tibiae",
    description: "The tibial tuberosity is the anterior proximal tibial prominence receiving the patellar ligament and transmitting quadriceps force to the leg.",
    commonTerms: ["front shin bump"],
  },
  {
    slug: "pes-anserinus",
    formalTerm: "Pes anserinus",
    officialLocator: "FIPAT TA2: Pes anserinus",
    description: "Pes anserinus is the medial proximal tibial tendon insertion region for sartorius, gracilis, and semitendinosus, important for medial knee mapping.",
    commonTerms: ["goose foot tendon area"],
  },
  {
    slug: "medial-tibial-condyle",
    formalTerm: "Medial condyle of tibia",
    officialLocator: "FIPAT TA2: Condylus medialis tibiae",
    description: "The medial tibial condyle is the inner proximal tibial joint surface and landmark region for medial knee attachments and joint orientation.",
    commonTerms: ["inner top of shin bone"],
  },
  {
    slug: "medial-malleolus",
    formalTerm: "Medial malleolus",
    officialLocator: "FIPAT TA2: Malleolus medialis",
    description: "The medial malleolus is the inner ankle prominence of the tibia and a key landmark for ankle joint, tendon, and medial foot mapping.",
    commonTerms: ["inner ankle bone"],
  },
  {
    slug: "lateral-malleolus",
    formalTerm: "Lateral malleolus",
    officialLocator: "FIPAT TA2: Malleolus lateralis",
    description: "The lateral malleolus is the outer ankle prominence of the fibula and a key landmark for ankle stability, peroneal tendons, and lateral ankle mapping.",
    commonTerms: ["outer ankle bone"],
  },
  {
    slug: "head-of-fibula",
    formalTerm: "Head of fibula",
    officialLocator: "FIPAT TA2: Caput fibulae",
    description: "The head of the fibula is the proximal lateral fibular landmark near the knee and is important for biceps femoris insertion and common fibular nerve orientation.",
    commonTerms: ["outside knee fibula head"],
  },
  {
    slug: "calcaneal-tuberosity",
    formalTerm: "Calcaneal tuberosity",
    officialLocator: "FIPAT TA2: Tuber calcanei",
    description: "The calcaneal tuberosity is the posterior heel-bone landmark receiving the calcaneal tendon and anchoring plantar heel structures.",
    commonTerms: ["back of heel bone"],
  },
  {
    slug: "metatarsal-heads",
    formalTerm: "Heads of metatarsal bones",
    officialLocator: "FIPAT TA2: Capita ossium metatarsi",
    description: "The metatarsal heads are the distal rounded forefoot landmarks forming the ball of the foot and anchoring toe movement relationships.",
    commonTerms: ["ball of foot bones"],
  },
]

const CRANIOFACIAL_REVIEWED_BONE_UPGRADES: ReviewedBoneUpgrade[] = [
  {
    slug: "mandible",
    formalTerm: "Mandible",
    officialLocator: "FIPAT TA2: Mandibula",
    description: "The mandible is the lower jaw bone forming the mobile bony base of the temporomandibular joint. It receives masticatory muscle attachments and supports jaw, face, and client-language mapping.",
    commonTerms: ["jaw bone", "lower jaw bone"],
    identifier: { provider: "FMA", identifier: "FMA:52748", iri: "http://purl.org/sig/ont/fma/fma52748", label: "Mandible", sourceRef: "bioportal-fma" },
  },
  {
    slug: "maxilla",
    formalTerm: "Maxilla",
    officialLocator: "FIPAT TA2: Maxilla",
    description: "The maxilla is the upper jaw bone and a central facial skeleton structure. It supports facial expression landmarks, dental-region orientation, and upper jaw body-map language.",
    commonTerms: ["upper jaw bone"],
    identifier: { provider: "FMA", identifier: "FMA:9711", iri: "http://purl.org/sig/ont/fma/fma9711", label: "Maxilla", sourceRef: "bioportal-fma" },
  },
  {
    slug: "zygomatic-bone",
    formalTerm: "Zygomatic bone",
    officialLocator: "FIPAT TA2: Os zygomaticum",
    description: "The zygomatic bone is the cheek bone forming the lateral cheek prominence and part of the zygomatic arch. It anchors facial expression and masseter-region anatomy.",
    commonTerms: ["cheek bone"],
    identifier: { provider: "FMA", identifier: "FMA:52747", iri: "http://purl.org/sig/ont/fma/fma52747", label: "Zygomatic bone", sourceRef: "bioportal-fma" },
  },
  {
    slug: "sphenoid-bone",
    formalTerm: "Sphenoid bone",
    officialLocator: "FIPAT TA2: Os sphenoidale",
    description: "The sphenoid bone is a central skull-base bone contributing to the orbit, cranial base, and pterygoid process regions used for jaw and deep facial muscle mapping.",
    commonTerms: ["central skull base bone"],
    identifier: { provider: "FMA", identifier: "FMA:52736", iri: "http://purl.org/sig/ont/fma/fma52736", label: "Sphenoid bone", sourceRef: "bioportal-fma" },
  },
  {
    slug: "frontal-bone",
    formalTerm: "Frontal bone",
    officialLocator: "FIPAT TA2: Os frontale",
    description: "The frontal bone forms the forehead and superior anterior skull. It is used for forehead, brow, frontalis, and upper face body-map orientation.",
    commonTerms: ["forehead bone"],
    identifier: { provider: "FMA", identifier: "FMA:52734", iri: "http://purl.org/sig/ont/fma/fma52734", label: "Frontal bone", sourceRef: "bioportal-fma" },
  },
]

const CRANIOFACIAL_REVIEWED_LANDMARK_UPGRADES: ReviewedBoneLandmarkUpgrade[] = [
  {
    slug: "mandibular-condyle",
    formalTerm: "Head of mandible",
    officialLocator: "FIPAT TA2: Caput mandibulae",
    description: "The mandibular condyle is the rounded head of the mandible that articulates with the temporal bone at the temporomandibular joint.",
    commonTerms: ["jaw joint head"],
  },
  {
    slug: "mandibular-neck",
    formalTerm: "Neck of mandible",
    officialLocator: "FIPAT TA2: Collum mandibulae",
    description: "The mandibular neck is the narrowed region below the mandibular condyle and helps orient TMJ, lateral pterygoid, and jaw movement anatomy.",
    commonTerms: ["neck of jaw joint"],
  },
  {
    slug: "coronoid-process-mandible",
    formalTerm: "Coronoid process of mandible",
    officialLocator: "FIPAT TA2: Processus coronoideus mandibulae",
    description: "The coronoid process of the mandible is the anterior ramus projection and a major insertion landmark for temporalis.",
    commonTerms: ["front jaw ramus process"],
  },
  {
    slug: "angle-of-mandible",
    formalTerm: "Angle of mandible",
    officialLocator: "FIPAT TA2: Angulus mandibulae",
    description: "The angle of the mandible is the posteroinferior corner of the lower jaw and a clear landmark for masseter and medial pterygoid relationships.",
    commonTerms: ["jaw angle"],
  },
  {
    slug: "zygomatic-arch",
    formalTerm: "Zygomatic arch",
    officialLocator: "FIPAT TA2: Arcus zygomaticus",
    description: "The zygomatic arch is the cheek arch formed by temporal and zygomatic bone contributions, serving as a key origin region for masseter.",
    commonTerms: ["cheek arch"],
  },
  {
    slug: "temporal-fossa",
    formalTerm: "Temporal fossa",
    officialLocator: "FIPAT TA2: Fossa temporalis",
    description: "The temporal fossa is the shallow skull region on the side of the head that houses the temporalis muscle.",
    commonTerms: ["temple fossa", "temple hollow"],
  },
  {
    slug: "pterygoid-fossa",
    formalTerm: "Pterygoid fossa",
    officialLocator: "FIPAT TA2: Fossa pterygoidea",
    description: "The pterygoid fossa is a sphenoid-region depression used for medial pterygoid orientation in jaw mechanics.",
    commonTerms: ["deep jaw fossa"],
  },
  {
    slug: "lateral-pterygoid-plate",
    formalTerm: "Lateral pterygoid plate",
    officialLocator: "FIPAT TA2: Lamina lateralis processus pterygoidei",
    description: "The lateral pterygoid plate is a sphenoid process landmark used for lateral pterygoid and medial pterygoid attachment orientation.",
    commonTerms: ["deep jaw plate"],
  },
  {
    slug: "maxillary-tuberosity",
    formalTerm: "Maxillary tuberosity",
    officialLocator: "FIPAT TA2: Tuber maxillae",
    description: "The maxillary tuberosity is the posterior rounded region of the maxilla and helps orient deep jaw and upper dental-region anatomy.",
    commonTerms: ["back of upper jaw"],
  },
  {
    slug: "frontal-belly-region",
    formalTerm: "Frontal belly region",
    officialLocator: "FIPAT TA2: Venter frontalis musculi occipitofrontalis",
    description: "The frontal belly region represents the forehead anchor area for frontalis and brow movement mapping in this first-pass skeleton dataset.",
    commonTerms: ["forehead muscle area"],
  },
]

const REMAINING_CORE_REVIEWED_BONE_UPGRADES: ReviewedBoneUpgrade[] = [
  {
    slug: "coccyx",
    formalTerm: "Coccyx",
    officialLocator: "FIPAT TA2: Os coccygis",
    description: "The coccyx is the terminal tailbone region of the vertebral column at the base of the spine. It provides attachment context for pelvic floor, posterior pelvic, and sacrococcygeal soft-tissue relationships.",
    commonTerms: ["tailbone"],
    identifier: { provider: "UBERON", identifier: "UBERON:0001350", iri: "http://purl.obolibrary.org/obo/UBERON_0001350", label: "coccyx", sourceRef: "ols-uberon" },
  },
  {
    slug: "radius",
    formalTerm: "Radius",
    officialLocator: "FIPAT TA2: Radius",
    description: "The radius is the lateral forearm bone on the thumb side. It participates in elbow, forearm rotation, and wrist mechanics and receives attachments from biceps brachii, pronators, supinator, and thumb-side forearm muscles.",
    commonTerms: ["thumb side forearm bone"],
    identifier: { provider: "UBERON", identifier: "UBERON:0001423", iri: "http://purl.obolibrary.org/obo/UBERON_0001423", label: "radius bone", sourceRef: "ols-uberon" },
  },
  {
    slug: "ulna",
    formalTerm: "Ulna",
    officialLocator: "FIPAT TA2: Ulna",
    description: "The ulna is the medial forearm bone on the little-finger side. It forms the primary hinge surface of the elbow and provides attachment context for triceps, brachialis, forearm flexors, and extensors.",
    commonTerms: ["little finger side forearm bone"],
    identifier: { provider: "FMA", identifier: "FMA:23466", iri: "http://purl.org/sig/ont/fma/fma23466", label: "Ulna", sourceRef: "bioportal-fma" },
  },
  {
    slug: "carpals",
    formalTerm: "Carpal bones",
    officialLocator: "FIPAT TA2: Ossa carpi",
    description: "The carpal bones form the clustered wrist skeleton between the forearm and metacarpals. They support wrist motion, carpal tunnel anatomy, and intrinsic hand muscle attachments.",
    commonTerms: ["wrist bones"],
    identifier: { provider: "UBERON", identifier: "UBERON:0001435", iri: "http://purl.obolibrary.org/obo/UBERON_0001435", label: "carpal bone", sourceRef: "ols-uberon" },
  },
  {
    slug: "metacarpals",
    formalTerm: "Metacarpal bones",
    officialLocator: "FIPAT TA2: Ossa metacarpi",
    description: "The metacarpals are the long palm bones connecting the wrist to the finger and thumb phalanges. They are important for grip, pinch, finger spread, and intrinsic hand muscle mapping.",
    commonTerms: ["palm bones"],
    identifier: { provider: "UBERON", identifier: "UBERON:0002374", iri: "http://purl.obolibrary.org/obo/UBERON_0002374", label: "metacarpal bone", sourceRef: "ols-uberon" },
  },
  {
    slug: "hand-phalanges",
    formalTerm: "Phalanges of hand",
    officialLocator: "FIPAT TA2: Ossa digitorum manus",
    description: "The hand phalanges are the finger and thumb bones distal to the metacarpals. They support grasp, pinch, opposition, finger flexion, extension, abduction, and adduction.",
    commonTerms: ["finger bones", "thumb bones"],
    identifier: { provider: "FMA", identifier: "FMA:71337", iri: "http://purl.org/sig/ont/fma/fma71337", label: "Set of phalanges of hand", sourceRef: "bioportal-fma" },
  },
  {
    slug: "hyoid-bone",
    formalTerm: "Hyoid bone",
    officialLocator: "FIPAT TA2: Os hyoideum",
    description: "The hyoid bone is a small suspended bone in the anterior neck. It anchors suprahyoid, infrahyoid, tongue, jaw, swallowing, and neck-region mechanics without directly articulating with another bone.",
    commonTerms: ["floating neck bone"],
    identifier: { provider: "UBERON", identifier: "UBERON:0001685", iri: "http://purl.obolibrary.org/obo/UBERON_0001685", label: "hyoid bone", sourceRef: "ols-uberon" },
  },
]

const REVIEWED_NERVE_UPGRADES: ReviewedSupportEntityUpgrade[] = [
  {
    entityType: "nerve",
    slug: "brachial-plexus",
    formalTerm: "Brachial plexus",
    officialLocator: "FIPAT TA2: Plexus brachialis",
    description: "The brachial plexus is a network of anterior rami from C5 through T1 that passes from the neck into the axilla. It organizes the major motor and sensory nerve supply for the shoulder girdle, arm, forearm, and hand.",
    commonTerms: ["upper limb nerve plexus", "arm nerve network"],
    identifier: { provider: "UBERON", identifier: "UBERON:0001814", iri: "http://purl.obolibrary.org/obo/UBERON_0001814", label: "brachial nerve plexus", sourceRef: "ols-uberon" },
  },
  {
    entityType: "nerve",
    slug: "lumbar-plexus",
    formalTerm: "Lumbar plexus",
    officialLocator: "FIPAT TA2: Plexus lumbalis",
    description: "The lumbar plexus is formed primarily from L1 through L4 anterior rami within the posterior abdominal wall. It contributes nerves for the anterior and medial thigh, hip flexor region, and lower abdominal wall.",
    commonTerms: ["low back nerve plexus"],
    identifier: { provider: "UBERON", identifier: "UBERON:0034987", iri: "http://purl.obolibrary.org/obo/UBERON_0034987", label: "lumbar nerve plexus", sourceRef: "ols-uberon" },
  },
  {
    entityType: "nerve",
    slug: "sacral-plexus",
    formalTerm: "Sacral plexus",
    officialLocator: "FIPAT TA2: Plexus sacralis",
    description: "The sacral plexus is formed from lumbosacral and sacral anterior rami in the posterior pelvis. It gives rise to major nerves for the gluteal region, posterior thigh, most of the leg and foot, and pelvic floor region.",
    commonTerms: ["pelvic nerve plexus"],
    identifier: { provider: "UBERON", identifier: "UBERON:0034986", iri: "http://purl.obolibrary.org/obo/UBERON_0034986", label: "sacral nerve plexus", sourceRef: "ols-uberon" },
  },
  {
    entityType: "nerve",
    slug: "musculocutaneous-nerve",
    formalTerm: "Musculocutaneous nerve",
    officialLocator: "FIPAT TA2: Nervus musculocutaneus",
    description: "The musculocutaneous nerve is a terminal branch of the brachial plexus that supplies the anterior arm compartment and continues as a sensory nerve to the lateral forearm. It is important for elbow flexion mapping through biceps brachii, brachialis, and coracobrachialis.",
    commonTerms: ["front arm nerve"],
    identifier: { provider: "UBERON", identifier: "UBERON:0003724", iri: "http://purl.obolibrary.org/obo/UBERON_0003724", label: "musculocutaneous nerve", sourceRef: "ols-uberon" },
  },
  {
    entityType: "nerve",
    slug: "radial-nerve",
    formalTerm: "Radial nerve",
    officialLocator: "FIPAT TA2: Nervus radialis",
    description: "The radial nerve is a terminal branch of the brachial plexus that supplies much of the posterior arm and forearm extensor system. It supports elbow extension, wrist and finger extension, and sensory mapping over the posterior arm and dorsal hand region.",
    commonTerms: ["back arm nerve"],
    identifier: { provider: "UBERON", identifier: "UBERON:0001492", iri: "http://purl.obolibrary.org/obo/UBERON_0001492", label: "radial nerve", sourceRef: "ols-uberon" },
  },
  {
    entityType: "nerve",
    slug: "median-nerve",
    formalTerm: "Median nerve",
    officialLocator: "FIPAT TA2: Nervus medianus",
    description: "The median nerve is a terminal brachial plexus branch that travels through the anterior arm, forearm, and carpal tunnel. It supplies many forearm flexors and thenar muscles and is central to wrist, thumb, and client-language carpal tunnel mapping.",
    commonTerms: ["middle arm nerve", "carpal tunnel nerve"],
    identifier: { provider: "UBERON", identifier: "UBERON:0001148", iri: "http://purl.obolibrary.org/obo/UBERON_0001148", label: "median nerve", sourceRef: "ols-uberon" },
  },
  {
    entityType: "nerve",
    slug: "ulnar-nerve",
    formalTerm: "Ulnar nerve",
    officialLocator: "FIPAT TA2: Nervus ulnaris",
    description: "The ulnar nerve is a terminal brachial plexus branch that passes behind the medial elbow and into the ulnar side of the forearm and hand. It supplies flexor carpi ulnaris, part of flexor digitorum profundus, and many intrinsic hand muscles.",
    commonTerms: ["funny bone nerve", "little finger nerve"],
    identifier: { provider: "UBERON", identifier: "UBERON:0001494", iri: "http://purl.obolibrary.org/obo/UBERON_0001494", label: "ulnar nerve", sourceRef: "ols-uberon" },
  },
  {
    entityType: "nerve",
    slug: "femoral-nerve",
    formalTerm: "Femoral nerve",
    officialLocator: "FIPAT TA2: Nervus femoralis",
    description: "The femoral nerve arises from the lumbar plexus and travels into the anterior thigh. It supplies major hip flexor and knee extensor muscles and provides sensory branches for the anterior thigh and medial leg region.",
    commonTerms: ["front thigh nerve"],
    identifier: { provider: "UBERON", identifier: "UBERON:0001267", iri: "http://purl.obolibrary.org/obo/UBERON_0001267", label: "femoral nerve", sourceRef: "ols-uberon" },
  },
  {
    entityType: "nerve",
    slug: "tibial-nerve",
    formalTerm: "Tibial nerve",
    officialLocator: "FIPAT TA2: Nervus tibialis",
    description: "The tibial nerve is the larger terminal division of the sciatic nerve and passes through the posterior leg into the sole of the foot. It supplies plantarflexors, deep posterior leg muscles, and plantar foot muscles.",
    commonTerms: ["back leg nerve", "sole of foot nerve"],
    identifier: { provider: "UBERON", identifier: "UBERON:0001323", iri: "http://purl.obolibrary.org/obo/UBERON_0001323", label: "tibial nerve", sourceRef: "ols-uberon" },
  },
  {
    entityType: "nerve",
    slug: "common-fibular-nerve",
    formalTerm: "Common fibular nerve",
    officialLocator: "FIPAT TA2: Nervus fibularis communis",
    description: "The common fibular nerve is a terminal division of the sciatic nerve that wraps near the fibular head before dividing into superficial and deep branches. It is central to lateral leg, anterior leg, dorsiflexion, eversion, and top-of-foot mapping.",
    commonTerms: ["common peroneal nerve", "outer knee nerve"],
    identifier: { provider: "UBERON", identifier: "UBERON:0001324", iri: "http://purl.obolibrary.org/obo/UBERON_0001324", label: "common fibular nerve", sourceRef: "ols-uberon" },
  },
  {
    entityType: "nerve",
    slug: "superior-gluteal-nerve",
    formalTerm: "Superior gluteal nerve",
    officialLocator: "FIPAT TA2: Nervus gluteus superior",
    description: "The superior gluteal nerve arises from the sacral plexus and supplies gluteus medius, gluteus minimus, and tensor fasciae latae. It is important for hip abduction, pelvic control, and side-hip stabilizer education.",
    commonTerms: ["side hip stabilizer nerve"],
    identifier: { provider: "FMA", identifier: "FMA:16510", iri: "http://purl.org/sig/ont/fma/fma16510", label: "Superior gluteal nerve", sourceRef: "bioportal-fma" },
  },
  {
    entityType: "nerve",
    slug: "inferior-gluteal-nerve",
    formalTerm: "Inferior gluteal nerve",
    officialLocator: "FIPAT TA2: Nervus gluteus inferior",
    description: "The inferior gluteal nerve arises from the sacral plexus and supplies gluteus maximus. It supports hip extension and posterior hip power mapping for stairs, rising, and glute-region education.",
    commonTerms: ["glute max nerve"],
    identifier: { provider: "FMA", identifier: "FMA:16511", iri: "http://purl.org/sig/ont/fma/fma16511", label: "Inferior gluteal nerve", sourceRef: "bioportal-fma" },
  },
  {
    entityType: "nerve",
    slug: "trigeminal-nerve",
    formalTerm: "Trigeminal nerve",
    officialLocator: "FIPAT TA2: Nervus trigeminus",
    description: "The trigeminal nerve is cranial nerve V and the major sensory nerve of the face, with motor fibers to muscles of mastication through its mandibular division. It anchors jaw, temple, and face-region neuroanatomy in this dataset.",
    commonTerms: ["fifth cranial nerve"],
    abbreviationTerms: ["CN V"],
    identifier: { provider: "UBERON", identifier: "UBERON:0001645", iri: "http://purl.obolibrary.org/obo/UBERON_0001645", label: "trigeminal nerve", sourceRef: "ols-uberon" },
  },
  {
    entityType: "nerve",
    slug: "mandibular-division-trigeminal",
    formalTerm: "Mandibular nerve",
    officialLocator: "FIPAT TA2: Nervus mandibularis",
    description: "The mandibular division of the trigeminal nerve, often called V3, carries sensory information from the lower face and motor fibers to the muscles of mastication. It is the key trigeminal branch for jaw-clenching and chewing-muscle mapping.",
    commonTerms: ["V3 mandibular nerve", "mandibular division"],
    abbreviationTerms: ["CN V3", "V3"],
    identifier: { provider: "UBERON", identifier: "UBERON:0000375", iri: "http://purl.obolibrary.org/obo/UBERON_0000375", label: "mandibular nerve", sourceRef: "ols-uberon" },
  },
  {
    entityType: "nerve",
    slug: "maxillary-division-trigeminal",
    formalTerm: "Maxillary nerve",
    officialLocator: "FIPAT TA2: Nervus maxillaris",
    description: "The maxillary division of the trigeminal nerve, often called V2, is a sensory branch serving the midface, upper jaw, cheek, and related facial regions. It supports face and upper-jaw anatomy mapping without implying diagnosis.",
    commonTerms: ["V2 maxillary nerve", "maxillary division"],
    abbreviationTerms: ["CN V2", "V2"],
    identifier: { provider: "UBERON", identifier: "UBERON:0000377", iri: "http://purl.obolibrary.org/obo/UBERON_0000377", label: "maxillary nerve", sourceRef: "ols-uberon" },
  },
  {
    entityType: "nerve",
    slug: "facial-nerve",
    formalTerm: "Facial nerve",
    officialLocator: "FIPAT TA2: Nervus facialis",
    description: "The facial nerve is cranial nerve VII and supplies the muscles of facial expression. It is relevant for forehead, eyelid, cheek, mouth-corner, platysma, and client-friendly facial movement education.",
    commonTerms: ["seventh cranial nerve"],
    abbreviationTerms: ["CN VII"],
    identifier: { provider: "UBERON", identifier: "UBERON:0001647", iri: "http://purl.obolibrary.org/obo/UBERON_0001647", label: "facial nerve", sourceRef: "ols-uberon" },
  },
]

const REVIEWED_BLOOD_SUPPLY_UPGRADES: ReviewedSupportEntityUpgrade[] = [
  { entityType: "blood_supply", slug: "external-jugular-vein", formalTerm: "External jugular vein", officialLocator: "FIPAT TA2: Vena jugularis externa", description: "The external jugular vein is a superficial neck vein that drains portions of the scalp and face toward the subclavian venous system. It is useful for regional neck anatomy orientation and superficial vessel mapping.", commonTerms: ["superficial neck vein"], identifier: { provider: "UBERON", identifier: "UBERON:0001101", iri: "http://purl.obolibrary.org/obo/UBERON_0001101", label: "external jugular vein", sourceRef: "ols-uberon" } },
  { entityType: "blood_supply", slug: "axillary-artery", formalTerm: "Axillary artery", officialLocator: "FIPAT TA2: Arteria axillaris", description: "The axillary artery is the continuation of the subclavian artery through the axilla. Its branches supply the shoulder girdle, chest wall, and proximal upper limb, making it a key vessel for shoulder and arm maps.", commonTerms: ["armpit artery"], identifier: { provider: "UBERON", identifier: "UBERON:0001394", iri: "http://purl.obolibrary.org/obo/UBERON_0001394", label: "axillary artery", sourceRef: "ols-uberon" } },
  { entityType: "blood_supply", slug: "cephalic-vein", formalTerm: "Cephalic vein", officialLocator: "FIPAT TA2: Vena cephalica", description: "The cephalic vein is a superficial vein on the lateral upper limb that ascends toward the deltopectoral groove and drains into the axillary venous system. It is useful for shoulder and upper-limb surface anatomy context.", commonTerms: ["outer arm vein"], identifier: { provider: "UBERON", identifier: "UBERON:0001106", iri: "http://purl.obolibrary.org/obo/UBERON_0001106", label: "cephalic vein", sourceRef: "ols-uberon" } },
  { entityType: "blood_supply", slug: "abdominal-aorta", formalTerm: "Abdominal aorta", officialLocator: "FIPAT TA2: Aorta abdominalis", description: "The abdominal aorta is the major arterial trunk of the abdomen below the diaphragm. It gives branches to the abdominal wall, viscera, pelvis, and lower limb through iliac continuations.", commonTerms: ["main abdomen artery"], identifier: { provider: "UBERON", identifier: "UBERON:0001516", iri: "http://purl.obolibrary.org/obo/UBERON_0001516", label: "abdominal aorta", sourceRef: "ols-uberon" } },
  { entityType: "blood_supply", slug: "internal-iliac-artery", formalTerm: "Internal iliac artery", officialLocator: "FIPAT TA2: Arteria iliaca interna", description: "The internal iliac artery is a pelvic arterial trunk supplying pelvic walls, gluteal regions, and perineal structures through multiple branches. It supports hip, pelvis, and pelvic-floor vascular relationship mapping.", commonTerms: ["pelvic artery"], identifier: { provider: "UBERON", identifier: "UBERON:0001309", iri: "http://purl.obolibrary.org/obo/UBERON_0001309", label: "internal iliac artery", sourceRef: "ols-uberon" } },
  { entityType: "blood_supply", slug: "basilic-vein", formalTerm: "Basilic vein", officialLocator: "FIPAT TA2: Vena basilica", description: "The basilic vein is a superficial vein on the medial side of the upper limb that joins deeper venous drainage near the arm. It is useful for medial forearm and arm surface anatomy context.", commonTerms: ["inner arm vein"], identifier: { provider: "UBERON", identifier: "UBERON:0001411", iri: "http://purl.obolibrary.org/obo/UBERON_0001411", label: "basilic vein", sourceRef: "ols-uberon" } },
  { entityType: "blood_supply", slug: "femoral-artery", formalTerm: "Femoral artery", officialLocator: "FIPAT TA2: Arteria femoralis", description: "The femoral artery is the main arterial continuation into the anterior thigh after the external iliac artery passes beneath the inguinal ligament. It supplies the thigh and continues toward the knee and leg.", commonTerms: ["main thigh artery"], identifier: { provider: "UBERON", identifier: "UBERON:0002060", iri: "http://purl.obolibrary.org/obo/UBERON_0002060", label: "femoral artery", sourceRef: "ols-uberon" } },
  { entityType: "blood_supply", slug: "femoral-vein", formalTerm: "Femoral vein", officialLocator: "FIPAT TA2: Vena femoralis", description: "The femoral vein is the major deep vein of the thigh and accompanies the femoral artery through the femoral triangle and adductor canal region. It supports lower-limb venous drainage mapping.", commonTerms: ["main thigh vein"], identifier: { provider: "UBERON", identifier: "UBERON:0001361", iri: "http://purl.obolibrary.org/obo/UBERON_0001361", label: "femoral vein", sourceRef: "ols-uberon" } },
  { entityType: "blood_supply", slug: "popliteal-artery", formalTerm: "Popliteal artery", officialLocator: "FIPAT TA2: Arteria poplitea", description: "The popliteal artery passes behind the knee after the femoral artery exits the adductor hiatus. It supplies the knee region and divides into anterior and posterior tibial arterial pathways for the leg.", commonTerms: ["behind knee artery"], identifier: { provider: "UBERON", identifier: "UBERON:0002250", iri: "http://purl.obolibrary.org/obo/UBERON_0002250", label: "popliteal artery", sourceRef: "ols-uberon" } },
  { entityType: "blood_supply", slug: "anterior-tibial-artery", formalTerm: "Anterior tibial artery", officialLocator: "FIPAT TA2: Arteria tibialis anterior", description: "The anterior tibial artery supplies the anterior compartment of the leg and continues toward the dorsum of the foot. It supports shin, ankle, and top-of-foot vascular mapping.", commonTerms: ["front shin artery"], identifier: { provider: "UBERON", identifier: "UBERON:0001537", iri: "http://purl.obolibrary.org/obo/UBERON_0001537", label: "anterior tibial artery", sourceRef: "ols-uberon" } },
  { entityType: "blood_supply", slug: "posterior-tibial-artery", formalTerm: "Posterior tibial artery", officialLocator: "FIPAT TA2: Arteria tibialis posterior", description: "The posterior tibial artery supplies the posterior leg and continues behind the medial ankle toward plantar foot branches. It is important for calf, ankle, arch, and sole-of-foot vascular context.", commonTerms: ["back shin artery"], identifier: { provider: "UBERON", identifier: "UBERON:0001538", iri: "http://purl.obolibrary.org/obo/UBERON_0001538", label: "posterior tibial artery", sourceRef: "ols-uberon" } },
  { entityType: "blood_supply", slug: "external-carotid-artery", formalTerm: "External carotid artery", officialLocator: "FIPAT TA2: Arteria carotis externa", description: "The external carotid artery is a major neck artery that supplies many superficial and deep structures of the face, scalp, jaw, and neck through named branches. It anchors head and face vascular relationships.", commonTerms: ["face and scalp artery"], identifier: { provider: "UBERON", identifier: "UBERON:0001070", iri: "http://purl.obolibrary.org/obo/UBERON_0001070", label: "external carotid artery", sourceRef: "ols-uberon" } },
  { entityType: "blood_supply", slug: "maxillary-artery", formalTerm: "Maxillary artery", officialLocator: "FIPAT TA2: Arteria maxillaris", description: "The maxillary artery is a terminal branch of the external carotid artery that supplies deep face, jaw, nasal, and masticatory regions. It is useful for TMJ and chewing-muscle vascular context.", commonTerms: ["deep jaw artery"], identifier: { provider: "UBERON", identifier: "UBERON:0001616", iri: "http://purl.obolibrary.org/obo/UBERON_0001616", label: "maxillary artery", sourceRef: "ols-uberon" } },
  { entityType: "blood_supply", slug: "superficial-temporal-artery", formalTerm: "Superficial temporal artery", officialLocator: "FIPAT TA2: Arteria temporalis superficialis", description: "The superficial temporal artery is a terminal branch of the external carotid artery that ascends in the temple and scalp region. It supports temple, scalp, and lateral face surface anatomy mapping.", commonTerms: ["temple artery"], identifier: { provider: "UBERON", identifier: "UBERON:0001614", iri: "http://purl.obolibrary.org/obo/UBERON_0001614", label: "superficial temporal artery", sourceRef: "ols-uberon" } },
  { entityType: "blood_supply", slug: "facial-vein", formalTerm: "Facial vein", officialLocator: "FIPAT TA2: Vena facialis", description: "The facial vein drains superficial regions of the face and connects facial surface anatomy with deeper venous drainage pathways. It is useful for face-region orientation and cautious non-diagnostic education.", commonTerms: ["face vein"], identifier: { provider: "UBERON", identifier: "UBERON:0001653", iri: "http://purl.obolibrary.org/obo/UBERON_0001653", label: "facial vein", sourceRef: "ols-uberon" } },
]

const REVIEWED_STRUCTURE_UPGRADES: ReviewedSupportEntityUpgrade[] = [
  { entityType: "anatomy_structure", slug: "intervertebral-disc", formalTerm: "Intervertebral disc", officialLocator: "FIPAT TA2: Discus intervertebralis", description: "An intervertebral disc is a fibrocartilaginous structure between adjacent vertebral bodies. It helps transmit load, preserve spacing, and allow controlled motion across the spine.", commonTerms: ["disc between vertebrae", "spinal disc"], identifier: { provider: "UBERON", identifier: "UBERON:0001066", iri: "http://purl.obolibrary.org/obo/UBERON_0001066", label: "intervertebral disk", sourceRef: "ols-uberon" } },
  { entityType: "anatomy_structure", slug: "thoracolumbar-fascia", formalTerm: "Thoracolumbar fascia", officialLocator: "FIPAT TA2: Fascia thoracolumbalis", description: "The thoracolumbar fascia is a dense fascial sheet of the posterior trunk that links lumbar spine, pelvis, ribs, abdominal wall, latissimus dorsi, and deep back muscles.", commonTerms: ["low back fascia"], identifier: { provider: "FMA", identifier: "FMA:25072", iri: "http://purl.org/sig/ont/fma/fma25072", label: "Thoracolumbar fascia", sourceRef: "bioportal-fma" } },
  { entityType: "anatomy_structure", slug: "abdominal-aponeurosis", formalTerm: "Abdominal aponeurosis", officialLocator: "FIPAT TA2: Aponeuroses musculorum abdominis", description: "The abdominal aponeuroses are broad tendinous sheets from abdominal wall muscles that contribute to the rectus sheath and linea alba. They help organize trunk-wall force transfer and core-region anatomy.", commonTerms: ["abdominal tendon sheet"], identifier: { provider: "FMA", identifier: "FMA:19941", iri: "http://purl.org/sig/ont/fma/fma19941", label: "Aponeurosis of external oblique", sourceRef: "bioportal-fma" } },
  { entityType: "anatomy_structure", slug: "temporomandibular-articular-disc", formalTerm: "Articular disc of temporomandibular joint", officialLocator: "FIPAT TA2: Discus articularis articulationis temporomandibularis", description: "The temporomandibular articular disc is a fibrocartilaginous disc between the mandibular condyle and temporal bone. It helps organize jaw opening, closing, translation, and joint-surface mechanics.", commonTerms: ["TMJ disc", "jaw joint disc"], identifier: { provider: "UBERON", identifier: "UBERON:0011319", iri: "http://purl.obolibrary.org/obo/UBERON_0011319", label: "disk of temporomandibular joint", sourceRef: "ols-uberon" } },
  { entityType: "anatomy_structure", slug: "biceps-tendon", formalTerm: "Tendon of biceps brachii", officialLocator: "FIPAT TA2: Tendo musculi bicipitis brachii", description: "The biceps tendon system includes proximal and distal tendinous attachments of biceps brachii. In this dataset it anchors shoulder, elbow flexion, forearm supination, and proximal radius attachment relationships.", commonTerms: ["biceps tendon"], identifier: { provider: "UBERON", identifier: "UBERON:0008188", iri: "http://purl.obolibrary.org/obo/UBERON_0008188", label: "tendon of biceps brachii", sourceRef: "ols-uberon" } },
  { entityType: "anatomy_structure", slug: "triceps-tendon", formalTerm: "Tendon of triceps brachii", officialLocator: "FIPAT TA2: Tendo musculi tricipitis brachii", description: "The triceps tendon is the distal tendon of triceps brachii attaching toward the olecranon region. It supports elbow extension mechanics and posterior elbow education.", commonTerms: ["triceps tendon", "back of elbow tendon"], identifier: { provider: "UBERON", identifier: "UBERON:0008192", iri: "http://purl.obolibrary.org/obo/UBERON_0008192", label: "tendon of triceps brachii", sourceRef: "ols-uberon" } },
  { entityType: "anatomy_structure", slug: "flexor-retinaculum", formalTerm: "Flexor retinaculum of wrist", officialLocator: "FIPAT TA2: Retinaculum musculorum flexorum manus", description: "The flexor retinaculum is a strong transverse band at the anterior wrist forming the roof of the carpal tunnel. It retains flexor tendons and the median nerve pathway at the wrist.", commonTerms: ["carpal tunnel roof", "wrist retinaculum"], identifier: { provider: "FMA", identifier: "FMA:39988", iri: "http://purl.org/sig/ont/fma/fma39988", label: "Flexor retinaculum of wrist", sourceRef: "bioportal-fma" } },
  { entityType: "anatomy_structure", slug: "iliotibial-band", formalTerm: "Iliotibial tract", officialLocator: "FIPAT TA2: Tractus iliotibialis", description: "The iliotibial tract is a thick lateral thigh fascial band receiving contributions from tensor fasciae latae and gluteus maximus. It links the pelvis, lateral thigh, and lateral knee region.", commonTerms: ["IT band", "iliotibial band"], identifier: { provider: "FMA", identifier: "FMA:51048", iri: "http://purl.org/sig/ont/fma/fma51048", label: "Iliotibial tract", sourceRef: "bioportal-fma" } },
  { entityType: "anatomy_structure", slug: "knee-meniscus", formalTerm: "Menisci of knee joint", officialLocator: "FIPAT TA2: Menisci articulationis genus", description: "The knee menisci are fibrocartilaginous structures between femoral and tibial articular surfaces. They help distribute load, deepen joint congruence, and orient knee joint education.", commonTerms: ["knee cartilage", "knee meniscus"], identifier: { provider: "UBERON", identifier: "UBERON:0000387", iri: "http://purl.obolibrary.org/obo/UBERON_0000387", label: "meniscus", sourceRef: "ols-uberon" } },
  { entityType: "anatomy_structure", slug: "achilles-tendon", formalTerm: "Calcaneal tendon", officialLocator: "FIPAT TA2: Tendo calcaneus", description: "The calcaneal tendon, commonly called the Achilles tendon, attaches the gastrocnemius and soleus complex to the calcaneus. It is central to plantarflexion, calf, and heel-cord education.", commonTerms: ["Achilles tendon", "heel cord"], identifier: { provider: "UBERON", identifier: "UBERON:0003701", iri: "http://purl.obolibrary.org/obo/UBERON_0003701", label: "calcaneal tendon", sourceRef: "ols-uberon" } },
  { entityType: "anatomy_structure", slug: "plantar-fascia", formalTerm: "Plantar fascia", officialLocator: "FIPAT TA2: Aponeurosis plantaris", description: "The plantar fascia is a strong fibrous sheet on the sole of the foot extending from the calcaneal region toward the toes. It supports the longitudinal arch and foot-load transfer education.", commonTerms: ["foot arch fascia", "sole fascia"], identifier: { provider: "FMA", identifier: "FMA:58794", iri: "http://purl.org/sig/ont/fma/fma58794", label: "Plantar fascia of foot", sourceRef: "bioportal-fma" } },
]

const REVIEWED_LIGAMENT_UPGRADES: ReviewedSupportEntityUpgrade[] = [
  { entityType: "ligament", slug: "nuchal-ligament", formalTerm: "Nuchal ligament", officialLocator: "FIPAT TA2: Ligamentum nuchae", description: "The nuchal ligament is a midline posterior cervical ligament extending from the occipital region to cervical spinous processes. It provides a septum and attachment context for posterior neck muscles.", commonTerms: ["neck midline ligament"], identifier: { provider: "UBERON", identifier: "UBERON:0000351", iri: "http://purl.obolibrary.org/obo/UBERON_0000351", label: "nuchal ligament", sourceRef: "ols-uberon" } },
  { entityType: "ligament", slug: "alar-ligament", formalTerm: "Alar ligament", officialLocator: "FIPAT TA2: Ligamentum alare", description: "The alar ligaments connect the dens region of the axis to the occipital bone and help limit upper cervical rotation and side-bending. They are key craniovertebral stabilizing structures.", identifier: { provider: "FMA", identifier: "FMA:24919", iri: "http://purl.org/sig/ont/fma/fma24919", label: "Alar ligament", sourceRef: "bioportal-fma" } },
  { entityType: "ligament", slug: "transverse-ligament-of-atlas", formalTerm: "Transverse ligament of atlas", officialLocator: "FIPAT TA2: Ligamentum transversum atlantis", description: "The transverse ligament of the atlas holds the dens of the axis against the anterior arch of the atlas. It is a major stabilizing ligament of the atlantoaxial and upper cervical region.", identifier: { provider: "FMA", identifier: "FMA:24961", iri: "http://purl.org/sig/ont/fma/fma24961", label: "Transverse ligament of atlas", sourceRef: "bioportal-fma" } },
  { entityType: "ligament", slug: "acromioclavicular-ligament", formalTerm: "Acromioclavicular ligament", officialLocator: "FIPAT TA2: Ligamentum acromioclaviculare", description: "The acromioclavicular ligament reinforces the acromioclavicular joint capsule and helps stabilize the lateral clavicle to the acromion. It is important for shoulder-girdle load transfer.", commonTerms: ["AC ligament"], identifier: { provider: "FMA", identifier: "FMA:322812", iri: "http://purl.org/sig/ont/fma/fma322812", label: "Ligament of acromioclavicular joint", sourceRef: "bioportal-fma" } },
  { entityType: "ligament", slug: "coracoclavicular-ligament", formalTerm: "Coracoclavicular ligament", officialLocator: "FIPAT TA2: Ligamentum coracoclaviculare", description: "The coracoclavicular ligament complex links the coracoid process to the clavicle and provides strong vertical stability to the acromioclavicular region. It includes conoid and trapezoid components.", identifier: { provider: "UBERON", identifier: "UBERON:0034736", iri: "http://purl.obolibrary.org/obo/UBERON_0034736", label: "coracoclavicular ligament", sourceRef: "ols-uberon" } },
  { entityType: "ligament", slug: "coracoacromial-ligament", formalTerm: "Coracoacromial ligament", officialLocator: "FIPAT TA2: Ligamentum coracoacromiale", description: "The coracoacromial ligament spans from the coracoid process to the acromion and contributes to the coracoacromial arch above the glenohumeral joint. It helps frame subacromial-region anatomy.", identifier: { provider: "FMA", identifier: "FMA:25943", iri: "http://purl.org/sig/ont/fma/fma25943", label: "Coraco-acromial ligament", sourceRef: "bioportal-fma" } },
  { entityType: "ligament", slug: "coracohumeral-ligament", formalTerm: "Coracohumeral ligament", officialLocator: "FIPAT TA2: Ligamentum coracohumerale", description: "The coracohumeral ligament runs from the coracoid process toward the proximal humerus and reinforces the superior glenohumeral capsule. It supports shoulder stability and rotator cuff interval mapping.", identifier: { provider: "FMA", identifier: "FMA:34951", iri: "http://purl.org/sig/ont/fma/fma34951", label: "Coracohumeral ligament", sourceRef: "bioportal-fma" } },
  { entityType: "ligament", slug: "glenohumeral-ligaments", formalTerm: "Glenohumeral ligaments", officialLocator: "FIPAT TA2: Ligamenta glenohumeralia", description: "The glenohumeral ligaments are capsular thickenings that support the shoulder joint across different arm positions. They help organize anterior and inferior shoulder stability education.", commonTerms: ["shoulder capsule ligaments"], identifier: { provider: "FMA", identifier: "FMA:71398", iri: "http://purl.org/sig/ont/fma/fma71398", label: "Set of glenohumeral ligaments", sourceRef: "bioportal-fma" } },
  { entityType: "ligament", slug: "sternoclavicular-ligaments", formalTerm: "Sternoclavicular ligaments", officialLocator: "FIPAT TA2: Ligamenta sternoclavicularia", description: "The sternoclavicular ligaments reinforce the sternoclavicular joint between the medial clavicle and sternum. They help stabilize the only bony articulation connecting the upper limb to the axial skeleton.", commonTerms: ["SC joint ligaments"], identifier: { provider: "UBERON", identifier: "UBERON:0011875", iri: "http://purl.obolibrary.org/obo/UBERON_0011875", label: "ligament of sternoclavicular joint", sourceRef: "ols-uberon" } },
  { entityType: "ligament", slug: "costoclavicular-ligament", formalTerm: "Costoclavicular ligament", officialLocator: "FIPAT TA2: Ligamentum costoclaviculare", description: "The costoclavicular ligament connects the first rib region to the inferior clavicle and helps check clavicular elevation. It is important for sternoclavicular and thoracic outlet region mapping.", identifier: { provider: "FMA", identifier: "FMA:26014", iri: "http://purl.org/sig/ont/fma/fma26014", label: "Costoclavicular ligament", sourceRef: "bioportal-fma" } },
  { entityType: "ligament", slug: "iliolumbar-ligament", formalTerm: "Iliolumbar ligament", officialLocator: "FIPAT TA2: Ligamentum iliolumbale", description: "The iliolumbar ligament links the lower lumbar transverse process region to the iliac crest and helps stabilize the lumbopelvic junction. It anchors low-back and pelvis relationship mapping.", identifier: { provider: "FMA", identifier: "FMA:21493", iri: "http://purl.org/sig/ont/fma/fma21493", label: "Iliolumbar ligament", sourceRef: "bioportal-fma" } },
  { entityType: "ligament", slug: "sacroiliac-ligaments", formalTerm: "Sacroiliac ligaments", officialLocator: "FIPAT TA2: Ligamenta sacroiliaca", description: "The sacroiliac ligaments reinforce the sacroiliac joint between sacrum and ilium. They provide strong posterior, anterior, and interosseous support for load transfer between trunk and pelvis.", commonTerms: ["SI joint ligaments"], identifier: { provider: "FMA", identifier: "FMA:64020", iri: "http://purl.org/sig/ont/fma/fma64020", label: "Ligament of sacroiliac joint", sourceRef: "bioportal-fma" } },
  { entityType: "ligament", slug: "iliofemoral-ligament", formalTerm: "Iliofemoral ligament", officialLocator: "FIPAT TA2: Ligamentum iliofemorale", description: "The iliofemoral ligament is a strong anterior hip ligament running from the ilium toward the femur. It resists excessive hip extension and supports anterior hip capsule education.", commonTerms: ["Y ligament of hip"], identifier: { provider: "FMA", identifier: "FMA:42993", iri: "http://purl.org/sig/ont/fma/fma42993", label: "Iliofemoral ligament", sourceRef: "bioportal-fma" } },
  { entityType: "ligament", slug: "anterior-cruciate-ligament", formalTerm: "Anterior cruciate ligament", officialLocator: "FIPAT TA2: Ligamentum cruciatum anterius", description: "The anterior cruciate ligament crosses inside the knee joint from tibia to femur and helps limit anterior tibial translation and rotational loading. It is a core structure for knee stability education.", commonTerms: ["ACL"], identifier: { provider: "UBERON", identifier: "UBERON:0003671", iri: "http://purl.obolibrary.org/obo/UBERON_0003671", label: "anterior cruciate ligament of knee joint", sourceRef: "ols-uberon" } },
  { entityType: "ligament", slug: "posterior-cruciate-ligament", formalTerm: "Posterior cruciate ligament", officialLocator: "FIPAT TA2: Ligamentum cruciatum posterius", description: "The posterior cruciate ligament crosses inside the knee joint and helps limit posterior tibial translation. It is a key internal knee stabilizer for flexed-knee and posterior knee relationship mapping.", commonTerms: ["PCL"], identifier: { provider: "UBERON", identifier: "UBERON:0003680", iri: "http://purl.obolibrary.org/obo/UBERON_0003680", label: "posterior cruciate ligament of knee joint", sourceRef: "ols-uberon" } },
  { entityType: "ligament", slug: "medial-collateral-ligament-knee", formalTerm: "Medial collateral ligament of knee", officialLocator: "FIPAT TA2: Ligamentum collaterale tibiale", description: "The medial collateral ligament supports the inner side of the knee and resists valgus stress. It is closely related to medial knee, tibial, femoral, and meniscal region education.", commonTerms: ["MCL", "tibial collateral ligament"], identifier: { provider: "FMA", identifier: "FMA:305650", iri: "http://purl.org/sig/ont/fma/fma305650", label: "Medial collateral ligament", sourceRef: "bioportal-fma" } },
  { entityType: "ligament", slug: "lateral-collateral-ligament-knee", formalTerm: "Lateral collateral ligament of knee", officialLocator: "FIPAT TA2: Ligamentum collaterale fibulare", description: "The lateral collateral ligament supports the outer side of the knee and resists varus stress. It links femur and fibula context for lateral knee and fibular-head education.", commonTerms: ["LCL", "fibular collateral ligament"], identifier: { provider: "FMA", identifier: "FMA:305654", iri: "http://purl.org/sig/ont/fma/fma305654", label: "Lateral collateral ligament", sourceRef: "bioportal-fma" } },
  { entityType: "ligament", slug: "deltoid-ligament-ankle", formalTerm: "Deltoid ligament of ankle", officialLocator: "FIPAT TA2: Ligamentum mediale articulationis talocruralis", description: "The deltoid ligament is the strong medial ligament complex of the ankle. It supports the medial ankle and helps resist excessive eversion and talar displacement.", commonTerms: ["medial ankle ligament"], identifier: { provider: "UBERON", identifier: "UBERON:0011972", iri: "http://purl.obolibrary.org/obo/UBERON_0011972", label: "medial ligament of ankle joint", sourceRef: "ols-uberon" } },
  { entityType: "ligament", slug: "anterior-talofibular-ligament", formalTerm: "Anterior talofibular ligament", officialLocator: "FIPAT TA2: Ligamentum talofibulare anterius", description: "The anterior talofibular ligament is a lateral ankle ligament running between the fibula and talus. It is commonly mapped in lateral ankle stability and inversion-sprain education.", commonTerms: ["ATFL", "front outer ankle ligament"], identifier: { provider: "UBERON", identifier: "UBERON:0013725", iri: "http://purl.obolibrary.org/obo/UBERON_0013725", label: "anterior talofibular ligament", sourceRef: "ols-uberon" } },
  { entityType: "ligament", slug: "lateral-temporomandibular-ligament", formalTerm: "Lateral ligament of temporomandibular joint", officialLocator: "FIPAT TA2: Ligamentum laterale articulationis temporomandibularis", description: "The lateral temporomandibular ligament reinforces the lateral side of the temporomandibular joint capsule. It helps guide jaw-joint education and limits excessive posterior or inferior displacement.", commonTerms: ["lateral TMJ ligament"], identifier: { provider: "FMA", identifier: "FMA:57071", iri: "http://purl.org/sig/ont/fma/fma57071", label: "Lateral ligament of temporomandibular joint", sourceRef: "bioportal-fma" } },
  { entityType: "ligament", slug: "sphenomandibular-ligament", formalTerm: "Sphenomandibular ligament", officialLocator: "FIPAT TA2: Ligamentum sphenomandibulare", description: "The sphenomandibular ligament extends from the sphenoid region to the mandible and acts as an accessory ligament of the temporomandibular region. It helps orient deep jaw support anatomy.", identifier: { provider: "FMA", identifier: "FMA:57077", iri: "http://purl.org/sig/ont/fma/fma57077", label: "Sphenomandibular ligament", sourceRef: "bioportal-fma" } },
  { entityType: "ligament", slug: "stylomandibular-ligament", formalTerm: "Stylomandibular ligament", officialLocator: "FIPAT TA2: Ligamentum stylomandibulare", description: "The stylomandibular ligament extends from the styloid region toward the angle of the mandible and is an accessory support of the jaw region. It helps orient posterior jaw and neck-adjacent anatomy.", identifier: { provider: "FMA", identifier: "FMA:57083", iri: "http://purl.org/sig/ont/fma/fma57083", label: "Stylomandibular ligament", sourceRef: "bioportal-fma" } },
]

const REQUIRED_MILESTONE_MUSCLES = [
  "upper-trapezius",
  "middle-trapezius",
  "lower-trapezius",
  "levator-scapulae",
  "sternocleidomastoid",
  "scalenes",
  "splenius-capitis",
  "splenius-cervicis",
  "suboccipital-muscles",
  "semispinalis-capitis",
  "erector-spinae-upper-thoracic",
  "rhomboid-major",
  "rhomboid-minor",
  "serratus-anterior",
  "pectoralis-minor",
  "supraspinatus",
  "infraspinatus",
  "subscapularis",
  "teres-minor",
  "teres-major",
  "deltoid",
  "latissimus-dorsi",
  "pectoralis-major-clavicular-head",
  "subclavius",
]

const REQUIRED_MILESTONE_JOINTS = [
  "cervical-spine",
  "atlanto-occipital",
  "atlantoaxial",
  "thoracic-spine",
  "acromioclavicular",
  "sternoclavicular",
  "glenohumeral",
  "scapulothoracic",
]

const REQUIRED_MILESTONE_NERVES = [
  "accessory-nerve",
  "cervical-plexus",
  "brachial-plexus",
  "dorsal-scapular-nerve",
  "long-thoracic-nerve",
  "suprascapular-nerve",
  "axillary-nerve",
  "suboccipital-nerve",
  "posterior-rami-spinal-nerves",
  "upper-lower-subscapular-nerves",
  "thoracodorsal-nerve",
  "medial-pectoral-nerve",
  "lateral-pectoral-nerve",
  "nerve-to-subclavius",
]

const REQUIRED_MILESTONE_CLIENT_TERMS = [
  "between-shoulder-blades",
  "top-of-shoulder",
  "base-of-skull",
  "rotator-cuff-area",
  "front-of-shoulder",
  "back-of-shoulder",
  "neck-stiffness",
  "under-shoulder-blade",
]

const REQUIRED_WHOLE_BODY_REGIONS = [
  "trunk-spine-pelvis",
  "upper-limb",
  "lower-limb",
  "head-face-jaw",
]

const REQUIRED_WHOLE_BODY_SUBREGIONS = [
  "head",
  "face",
  "jaw",
  "neck",
  "thorax",
  "abdomen",
  "pelvis",
  "back",
  "lumbar-region",
  "arm",
  "elbow",
  "forearm",
  "wrist",
  "hand",
  "hip",
  "thigh",
  "knee",
  "leg",
  "ankle",
  "foot",
]

const REQUIRED_WHOLE_BODY_CLIENT_TERMS = [
  "low-back-tightness",
  "hip-tightness",
  "knee-pain",
  "calf-tightness",
  "foot-arch-pain",
  "forearm-tightness",
  "wrist-tightness",
  "jaw-tension",
]

const REQUIRED_WHOLE_BODY_STRUCTURES = [
  "intervertebral-disc",
  "thoracolumbar-fascia",
  "temporomandibular-articular-disc",
  "biceps-tendon",
  "iliotibial-band",
  "knee-meniscus",
  "patellar-tendon",
  "achilles-tendon",
  "plantar-fascia",
]

const REQUIRED_ATLAS_BONE_GROUP_TARGETS = [
  { groupSlug: "cervical-vertebrae", targets: ["atlas", "axis", "c3-vertebra", "c4-vertebra", "c5-vertebra", "c6-vertebra", "c7-vertebra"] },
  { groupSlug: "thoracic-vertebrae", targets: Array.from({ length: 12 }, (_, index) => `t${index + 1}-vertebra`) },
  { groupSlug: "lumbar-vertebrae", targets: Array.from({ length: 5 }, (_, index) => `l${index + 1}-vertebra`) },
  { groupSlug: "ribs", targets: ["first-rib", "second-rib", "third-rib", "fourth-rib", "fifth-rib", "sixth-rib", "seventh-rib", "eighth-rib", "ninth-rib", "tenth-rib", "eleventh-rib", "twelfth-rib"] },
  { groupSlug: "carpals", targets: ["scaphoid", "lunate", "triquetrum", "pisiform", "trapezium", "trapezoid", "capitate", "hamate"] },
  { groupSlug: "tarsals", targets: ["calcaneus", "talus", "navicular", "cuboid", "medial-cuneiform", "intermediate-cuneiform", "lateral-cuneiform"] },
  { groupSlug: "metacarpals", targets: ["first-metacarpal", "second-metacarpal", "third-metacarpal", "fourth-metacarpal", "fifth-metacarpal"] },
  { groupSlug: "metatarsals", targets: ["first-metatarsal", "second-metatarsal", "third-metatarsal", "fourth-metatarsal", "fifth-metatarsal"] },
  {
    groupSlug: "hand-phalanges",
    targets: [
      "proximal-phalanx-thumb-hand",
      "distal-phalanx-thumb-hand",
      "proximal-phalanx-index-finger",
      "middle-phalanx-index-finger",
      "distal-phalanx-index-finger",
      "proximal-phalanx-middle-finger",
      "middle-phalanx-middle-finger",
      "distal-phalanx-middle-finger",
      "proximal-phalanx-ring-finger",
      "middle-phalanx-ring-finger",
      "distal-phalanx-ring-finger",
      "proximal-phalanx-little-finger",
      "middle-phalanx-little-finger",
      "distal-phalanx-little-finger",
    ],
  },
  {
    groupSlug: "foot-phalanges",
    targets: [
      "proximal-phalanx-hallux",
      "distal-phalanx-hallux",
      "proximal-phalanx-second-toe",
      "middle-phalanx-second-toe",
      "distal-phalanx-second-toe",
      "proximal-phalanx-third-toe",
      "middle-phalanx-third-toe",
      "distal-phalanx-third-toe",
      "proximal-phalanx-fourth-toe",
      "middle-phalanx-fourth-toe",
      "distal-phalanx-fourth-toe",
      "proximal-phalanx-fifth-toe",
      "middle-phalanx-fifth-toe",
      "distal-phalanx-fifth-toe",
    ],
  },
  { groupSlug: "cranial-bones", targets: ["frontal-bone", "parietal-bone", "occipital-bone", "temporal-bone", "sphenoid-bone", "ethmoid-bone"] },
  { groupSlug: "facial-bones", targets: ["mandible", "maxilla", "zygomatic-bone", "nasal-bone", "lacrimal-bone", "palatine-bone", "vomer", "inferior-nasal-concha"] },
  { groupSlug: "hip-bone", targets: ["ilium", "ischium", "pubis"] },
  { groupSlug: "pelvis", targets: ["hip-bone", "sacrum", "coccyx"] },
]

const REQUIRED_ATLAS_INDIVIDUAL_BONES = [...new Set(REQUIRED_ATLAS_BONE_GROUP_TARGETS.flatMap((group) => group.targets))]

const REQUIRED_GROSS_ANATOMY_SYSTEM_STRUCTURES = [
  {
    systemSlug: "integumentary",
    systemConceptSlug: "integumentary-system",
    structureSlugs: ["skin", "epidermis", "dermis", "hypodermis", "hair", "hair-follicle", "nail", "sweat-gland", "sebaceous-gland"],
  },
  {
    systemSlug: "cardiovascular",
    systemConceptSlug: "cardiovascular-system",
    structureSlugs: ["heart", "pericardium", "myocardium", "endocardium", "heart-valve", "blood-vessel", "artery", "vein", "capillary"],
  },
  {
    systemSlug: "respiratory",
    systemConceptSlug: "respiratory-system",
    structureSlugs: ["nasal-cavity", "pharynx", "larynx", "trachea", "bronchus", "lung", "alveolus", "pleura"],
  },
  {
    systemSlug: "digestive",
    systemConceptSlug: "digestive-system",
    structureSlugs: ["oral-cavity", "salivary-gland", "esophagus", "stomach", "small-intestine", "large-intestine", "liver", "gallbladder", "pancreas", "rectum", "anus"],
  },
  {
    systemSlug: "endocrine",
    systemConceptSlug: "endocrine-system",
    structureSlugs: ["endocrine-gland", "pituitary-gland", "thyroid-gland", "parathyroid-gland", "adrenal-gland", "pancreatic-islet"],
  },
  {
    systemSlug: "lymphatic-immune",
    systemConceptSlug: "lymphatic-system",
    structureSlugs: ["lymphatic-vessel", "lymphatic-capillary", "lymphatic-duct", "lymph-node", "spleen", "thymus", "tonsil", "bone-marrow"],
  },
  {
    systemSlug: "urinary",
    systemConceptSlug: "urinary-system",
    structureSlugs: ["kidney", "renal-cortex", "renal-medulla", "nephron", "ureter", "urinary-bladder", "urethra"],
  },
  {
    systemSlug: "reproduction",
    systemConceptSlug: "reproductive-system",
    structureSlugs: ["ovary", "uterine-tube", "uterus", "vagina", "testis", "epididymis", "vas-deferens", "prostate-gland", "penis", "mammary-gland"],
  },
  {
    systemSlug: "nervous",
    systemConceptSlug: "nervous-system",
    structureSlugs: ["brain", "cerebrum", "cerebellum", "brainstem", "spinal-cord", "peripheral-nerve", "ganglion"],
  },
  {
    systemSlug: "sensory",
    systemConceptSlug: "sensory-system",
    structureSlugs: ["eye", "retina", "ear", "cochlea", "vestibular-apparatus"],
  },
  {
    systemSlug: "musculoskeletal",
    systemConceptSlug: "musculoskeletal-system",
    structureSlugs: ["superficial-fascia", "deep-fascia", "joint-capsule", "synovial-membrane", "articular-cartilage", "bursa"],
  },
] as const

export { ANATOMY_SEED_SECTION_NAMES }

export const NECK_SHOULDER_UPPER_BACK_SEED: AnatomyFoundationSeed = {
  sources: [
    {
      id: "source-massagelab-initial-anatomy-foundation",
      slug: STARTER_SOURCE,
      name: "MassageLab initial anatomy foundation",
      usageScope: "review_only",
      attribution: "Internal MassageLab starter model for schema and review workflow development.",
      sourceRef: "Internal starter model for review before citation lock-in.",
    },
    {
      id: "source-future-clinical-citation-needed",
      slug: REVIEW_SOURCE,
      name: "Future clinical citation needed",
      usageScope: "review_only",
      attribution: "Placeholder requiring review against anatomy and ROM references before clinical or public education release.",
      sourceRef: "Placeholder requiring review against anatomy and ROM references before clinical release.",
    },
    {
      id: "source-fipat-ta2",
      slug: "fipat-ta2",
      name: "FIPAT Terminologia Anatomica, Second Edition",
      url: "https://libraries.dal.ca/Fipat/ta2.html",
      license: "Individual terms public domain; publication CC BY-ND 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-nd/4.0/",
      usageScope: "open_reuse",
      accessedAt: "2026-05-22T00:00:00.000Z",
      notes: "Use for official anatomical terms, formal names, and terminology citations. The individual terms are public domain; do not adapt publication prose.",
      attribution: "FIPAT. Terminologia Anatomica. 2nd ed. FIPAT.library.dal.ca, 2019.",
      sourceRef: "Official anatomical terminology source; individual terms are public domain.",
    },
    {
      id: "source-nci-thesaurus",
      slug: "nci-thesaurus",
      name: "NCI Thesaurus",
      url: "https://bioportal.bioontology.org/ontologies/NCIT?p=summary",
      license: "CC BY 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
      usageScope: "open_reuse",
      accessedAt: "2026-05-22T00:00:00.000Z",
      notes: "Commercial-compatible controlled vocabulary source; the NCI Thesaurus name is trademarked.",
      attribution: "NCI Thesaurus, National Cancer Institute.",
      sourceRef: "Clinical vocabulary, definitions, and external identifier alignment source.",
    },
    {
      id: "source-human-bio-media",
      slug: "human-bio-media",
      name: "Human Bio Media",
      url: "https://www.humanbiomedia.org/biceps-brachii-lesson/",
      license: "CC BY 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
      usageScope: "open_reuse",
      accessedAt: "2026-05-22T00:00:00.000Z",
      notes: "Commercial-compatible anatomy education source. Store MassageLab-authored summaries and structured facts, not copied prose.",
      attribution: "Human Bio Media materials licensed under CC BY 4.0.",
      sourceRef: "Open anatomy education source for reviewed structured anatomy facts.",
    },
    {
      id: "source-applied-human-anatomy",
      slug: "applied-human-anatomy",
      name: "Applied Human Anatomy",
      url: "https://open.umn.edu/opentextbooks/textbooks/1266",
      license: "CC BY 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
      usageScope: "open_reuse",
      accessedAt: "2026-05-22T00:00:00.000Z",
      notes: "Commercial-compatible anatomy education source. Store MassageLab-authored summaries and structured facts, not copied prose.",
      attribution: "Michael F. Nolan and John P. McNamara, Applied Human Anatomy, Virginia Tech Publishing, CC BY 4.0.",
      sourceRef: "Open anatomy education source for reviewed structured anatomy facts.",
    },
    {
      id: "source-openstax-ap-2e",
      slug: "openstax-ap-2e",
      name: "OpenStax Anatomy and Physiology 2e",
      url: "https://openstax.org/books/anatomy-and-physiology-2e/pages/preface",
      license: "CC BY-NC-SA 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
      usageScope: "internal_reference",
      accessedAt: "2026-05-22T00:00:00.000Z",
      notes: "Reference-only starter source for this product unless NC-SA terms are explicitly accepted for the target use.",
      attribution: "Anatomy and Physiology 2e by OpenStax, Rice University.",
      sourceRef: "OpenStax A&P 2e is NC-SA and must not be treated as open commercial reuse.",
    },
    {
      id: "source-statpearls-ncbi-bookshelf",
      slug: "statpearls-ncbi-bookshelf",
      name: "StatPearls via NCBI Bookshelf",
      url: "https://www.ncbi.nlm.nih.gov/books/",
      license: "CC BY-NC-ND 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-nc-nd/4.0/",
      usageScope: "internal_reference",
      accessedAt: "2026-05-22T00:00:00.000Z",
      notes: "Useful for human review, but NC-ND terms mean it must not support reusable product wording or reviewed display citations.",
      attribution: "StatPearls Publishing via NCBI Bookshelf.",
      sourceRef: "Reference-only clinical anatomy source unless licensing changes.",
    },
    {
      id: "source-snomed-ct",
      slug: "snomed-ct",
      name: "SNOMED CT",
      url: "https://www.nlm.nih.gov/healthit/snomedct/snomed_licensing.html",
      license: "License-gated",
      usageScope: "review_only",
      accessedAt: "2026-05-22T00:00:00.000Z",
      notes: "Potential clinical coding source after explicit UMLS/SNOMED licensing workflow.",
      attribution: "SNOMED CT licensing and distribution terms apply.",
      sourceRef: "Deferred clinical terminology source; not available for reviewed product content yet.",
    },
    {
      id: "source-umls",
      slug: "umls",
      name: "Unified Medical Language System",
      url: "https://www.nlm.nih.gov/research/umls/index.html",
      license: "License-gated",
      usageScope: "review_only",
      accessedAt: "2026-05-22T00:00:00.000Z",
      notes: "Potential terminology integration source after explicit UMLS license workflow.",
      attribution: "UMLS licensing terms apply.",
      sourceRef: "Deferred terminology source; not available for reviewed product content yet.",
    },
    {
      id: "source-ols-uberon",
      slug: "ols-uberon",
      name: "OLS UBERON anatomy ontology",
      url: "https://www.ebi.ac.uk/ols4/ontologies/uberon",
      license: "CC BY 3.0",
      licenseUrl: "https://creativecommons.org/licenses/by/3.0/",
      usageScope: "open_reuse",
      accessedAt: "2026-05-22T00:00:00.000Z",
      attribution: "UBERON anatomy ontology accessed through EMBL-EBI OLS.",
      sourceRef: "Ontology identifiers, hierarchy, and public anatomy labels used for source alignment.",
    },
    {
      id: "source-bioportal-fma",
      slug: "bioportal-fma",
      name: "BioPortal Foundational Model of Anatomy",
      url: "https://bioportal.bioontology.org/ontologies/FMA",
      license: "Ontology license varies by source; review before reuse.",
      usageScope: "review_only",
      accessedAt: "2026-05-22T00:00:00.000Z",
      attribution: "FMA identifiers accessed through NCBO BioPortal.",
      sourceRef: "Identifier alignment source; not treated as media/content license.",
    },
    {
      id: "source-bodyparts3d",
      slug: "bodyparts3d",
      name: "BodyParts3D/Anatomography",
      url: "https://dbarchive.biosciencedbc.jp/en/bodyparts3d/",
      license: "CC BY 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
      usageScope: "open_reuse",
      accessedAt: "2026-05-22T00:00:00.000Z",
      attribution: "BodyParts3D, Database Center for Life Science licensed under CC BY 4.0.",
      sourceRef: "Open-license anatomy media/model candidate source.",
    },
    {
      id: "source-wikimedia-commons",
      slug: "wikimedia-commons",
      name: "Wikimedia Commons",
      url: "https://commons.wikimedia.org/wiki/Commons:Commons_API",
      license: "Per-file license",
      usageScope: "review_only",
      accessedAt: "2026-05-22T00:00:00.000Z",
      attribution: "Wikimedia Commons assets require per-file author, license, and source attribution.",
      sourceRef: "Per-file media metadata candidate source; only explicit open-license assets may be marked open_reuse.",
    },
    {
      id: "source-nih-3d",
      slug: "nih-3d",
      name: "NIH 3D",
      url: "https://3d.nih.gov/",
      license: "Per-model license",
      usageScope: "review_only",
      accessedAt: "2026-05-22T00:00:00.000Z",
      attribution: "NIH 3D assets require per-model license review.",
      sourceRef: "Candidate 3D asset source with per-model licensing.",
    },
  ],
  bodyRegions: [
    {
      id: "region-neck-shoulder-upper-back",
      slug: "neck-shoulder-upper-back",
      name: "Neck, Shoulder, and Upper Back",
      description: "Initial focused region for MassageLab anatomy data foundation work.",
      sourceRefs: [STARTER_SOURCE],
    },
    { id: "region-head-neck", slug: "head-neck", name: "Head and Neck", sourceRefs: [STARTER_SOURCE] },
    { id: "region-shoulder-girdle", slug: "shoulder-girdle", name: "Shoulder Girdle", sourceRefs: [STARTER_SOURCE] },
    { id: "region-upper-back", slug: "upper-back", name: "Upper Back", sourceRefs: [STARTER_SOURCE] },
  ],
  bodySubregions: [
    { id: "subregion-base-of-skull", slug: "base-of-skull", name: "Base of Skull", region: "head-neck", sourceRefs: [STARTER_SOURCE] },
    { id: "subregion-posterior-neck", slug: "posterior-neck", name: "Posterior Neck", region: "head-neck", sourceRefs: [STARTER_SOURCE] },
    { id: "subregion-lateral-neck", slug: "lateral-neck", name: "Lateral Neck", region: "head-neck", sourceRefs: [STARTER_SOURCE] },
    { id: "subregion-anterior-neck", slug: "anterior-neck", name: "Anterior Neck", region: "head-neck", sourceRefs: [STARTER_SOURCE] },
    { id: "subregion-upper-trapezius-area", slug: "upper-trapezius-area", name: "Upper Trapezius Area", region: "shoulder-girdle", sourceRefs: [STARTER_SOURCE] },
    { id: "subregion-scapular-region", slug: "scapular-region", name: "Scapular Region", region: "upper-back", sourceRefs: [STARTER_SOURCE] },
    { id: "subregion-glenohumeral-region", slug: "glenohumeral-region", name: "Glenohumeral Region", region: "shoulder-girdle", sourceRefs: [STARTER_SOURCE] },
    { id: "subregion-rotator-cuff-region", slug: "rotator-cuff-region", name: "Rotator Cuff Region", region: "shoulder-girdle", sourceRefs: [STARTER_SOURCE] },
    { id: "subregion-thoracic-spine-region", slug: "thoracic-spine-region", name: "Thoracic Spine Region", region: "upper-back", sourceRefs: [STARTER_SOURCE] },
  ],
  bones: [
    { id: "bone-occipital-bone", slug: "occipital-bone", name: "Occipital Bone", region: "head-neck", sourceRef: REVIEW_SOURCE },
    { id: "bone-temporal-bone", slug: "temporal-bone", name: "Temporal Bone", region: "head-neck", sourceRef: REVIEW_SOURCE },
    { id: "bone-atlas", slug: "atlas", name: "Atlas (C1)", formalName: "Atlas vertebra", region: "head-neck", sourceRef: REVIEW_SOURCE },
    { id: "bone-axis", slug: "axis", name: "Axis (C2)", formalName: "Axis vertebra", region: "head-neck", sourceRef: REVIEW_SOURCE },
    { id: "bone-cervical-vertebrae", slug: "cervical-vertebrae", name: "Cervical Vertebrae", region: "head-neck", sourceRef: REVIEW_SOURCE },
    { id: "bone-thoracic-vertebrae", slug: "thoracic-vertebrae", name: "Thoracic Vertebrae", region: "upper-back", sourceRef: REVIEW_SOURCE },
    { id: "bone-clavicle", slug: "clavicle", name: "Clavicle", region: "shoulder-girdle", sourceRef: REVIEW_SOURCE },
    { id: "bone-scapula", slug: "scapula", name: "Scapula", region: "shoulder-girdle", sourceRef: REVIEW_SOURCE },
    { id: "bone-humerus", slug: "humerus", name: "Humerus", region: "shoulder-girdle", sourceRef: REVIEW_SOURCE },
    { id: "bone-ribs", slug: "ribs", name: "Ribs", region: "upper-back", sourceRef: REVIEW_SOURCE },
    { id: "bone-sternum", slug: "sternum", name: "Sternum", region: "shoulder-girdle", sourceRef: REVIEW_SOURCE },
  ],
  boneLandmarks: [
    { id: "landmark-external-occipital-protuberance", slug: "external-occipital-protuberance", name: "External Occipital Protuberance", bone: "occipital-bone", sourceRef: REVIEW_SOURCE },
    { id: "landmark-superior-nuchal-line", slug: "superior-nuchal-line", name: "Superior Nuchal Line", bone: "occipital-bone", description: "Posterior occipital landmark used by upper trapezius attachments.", sourceRef: REVIEW_SOURCE },
    { id: "landmark-inferior-nuchal-line", slug: "inferior-nuchal-line", name: "Inferior Nuchal Line", bone: "occipital-bone", sourceRef: REVIEW_SOURCE },
    { id: "landmark-mastoid-process", slug: "mastoid-process", name: "Mastoid Process", bone: "temporal-bone", description: "Temporal bone landmark for sternocleidomastoid insertion.", sourceRef: REVIEW_SOURCE },
    { id: "landmark-posterior-arch-atlas", slug: "posterior-arch-atlas", name: "Posterior Arch of Atlas", bone: "atlas", sourceRef: REVIEW_SOURCE },
    { id: "landmark-axis-spinous-process", slug: "axis-spinous-process", name: "Axis Spinous Process", bone: "axis", sourceRef: REVIEW_SOURCE },
    { id: "landmark-cervical-transverse-processes", slug: "cervical-transverse-processes", name: "Cervical Transverse Processes", bone: "cervical-vertebrae", sourceRef: REVIEW_SOURCE },
    { id: "landmark-cervical-spinous-processes", slug: "cervical-spinous-processes", name: "Cervical Spinous Processes", bone: "cervical-vertebrae", sourceRef: REVIEW_SOURCE },
    { id: "landmark-cervicothoracic-spinous-processes", slug: "cervicothoracic-spinous-processes", name: "Cervicothoracic Spinous Processes", bone: "thoracic-vertebrae", sourceRef: REVIEW_SOURCE },
    { id: "landmark-upper-thoracic-spinous-processes", slug: "upper-thoracic-spinous-processes", name: "Upper Thoracic Spinous Processes", bone: "thoracic-vertebrae", sourceRef: REVIEW_SOURCE },
    { id: "landmark-lateral-third-clavicle", slug: "lateral-third-clavicle", name: "Lateral Third of Clavicle", bone: "clavicle", sourceRef: REVIEW_SOURCE },
    { id: "landmark-medial-clavicle", slug: "medial-clavicle", name: "Medial Clavicle", bone: "clavicle", sourceRef: REVIEW_SOURCE },
    { id: "landmark-inferior-clavicle", slug: "inferior-clavicle", name: "Inferior Clavicle", bone: "clavicle", sourceRef: REVIEW_SOURCE },
    { id: "landmark-acromion", slug: "acromion", name: "Acromion", bone: "scapula", sourceRef: REVIEW_SOURCE },
    { id: "landmark-spine-of-scapula", slug: "spine-of-scapula", name: "Spine of Scapula", bone: "scapula", sourceRef: REVIEW_SOURCE },
    { id: "landmark-medial-border-scapula", slug: "medial-border-scapula", name: "Medial Border of Scapula", bone: "scapula", sourceRef: REVIEW_SOURCE },
    { id: "landmark-lateral-border-scapula", slug: "lateral-border-scapula", name: "Lateral Border of Scapula", bone: "scapula", sourceRef: REVIEW_SOURCE },
    { id: "landmark-superior-border-scapula", slug: "superior-border-scapula", name: "Superior Border of Scapula", bone: "scapula", sourceRef: REVIEW_SOURCE },
    { id: "landmark-superior-angle-scapula", slug: "superior-angle-scapula", name: "Superior Angle of Scapula", bone: "scapula", sourceRef: REVIEW_SOURCE },
    { id: "landmark-inferior-angle-scapula", slug: "inferior-angle-scapula", name: "Inferior Angle of Scapula", bone: "scapula", sourceRef: REVIEW_SOURCE },
    { id: "landmark-coracoid-process", slug: "coracoid-process", name: "Coracoid Process", bone: "scapula", sourceRef: REVIEW_SOURCE },
    { id: "landmark-glenoid-cavity", slug: "glenoid-cavity", name: "Glenoid Cavity", bone: "scapula", sourceRef: REVIEW_SOURCE },
    { id: "landmark-supraspinous-fossa", slug: "supraspinous-fossa", name: "Supraspinous Fossa", bone: "scapula", sourceRef: REVIEW_SOURCE },
    { id: "landmark-infraspinous-fossa", slug: "infraspinous-fossa", name: "Infraspinous Fossa", bone: "scapula", sourceRef: REVIEW_SOURCE },
    { id: "landmark-subscapular-fossa", slug: "subscapular-fossa", name: "Subscapular Fossa", bone: "scapula", sourceRef: REVIEW_SOURCE },
    { id: "landmark-greater-tubercle", slug: "greater-tubercle", name: "Greater Tubercle", bone: "humerus", sourceRef: REVIEW_SOURCE },
    { id: "landmark-lesser-tubercle", slug: "lesser-tubercle", name: "Lesser Tubercle", bone: "humerus", sourceRef: REVIEW_SOURCE },
    { id: "landmark-intertubercular-sulcus", slug: "intertubercular-sulcus", name: "Intertubercular Sulcus", bone: "humerus", sourceRef: REVIEW_SOURCE },
    { id: "landmark-deltoid-tuberosity", slug: "deltoid-tuberosity", name: "Deltoid Tuberosity", bone: "humerus", sourceRef: REVIEW_SOURCE },
    { id: "landmark-first-rib", slug: "first-rib", name: "First Rib", bone: "ribs", sourceRef: REVIEW_SOURCE },
    { id: "landmark-upper-ribs", slug: "upper-ribs", name: "Upper Ribs", bone: "ribs", sourceRef: REVIEW_SOURCE },
    { id: "landmark-manubrium", slug: "manubrium", name: "Manubrium", bone: "sternum", sourceRef: REVIEW_SOURCE },
    { id: "landmark-sternal-body", slug: "sternal-body", name: "Sternal Body", bone: "sternum", sourceRef: REVIEW_SOURCE },
  ],
  joints: [
    { id: "joint-cervical-spine", slug: "cervical-spine", name: "Cervical Spine", jointType: "regional intervertebral joint complex", region: "head-neck", sourceRef: REVIEW_SOURCE },
    { id: "joint-atlanto-occipital", slug: "atlanto-occipital", name: "Atlanto-Occipital Joint", jointType: "synovial condyloid", region: "head-neck", sourceRef: REVIEW_SOURCE },
    { id: "joint-atlantoaxial", slug: "atlantoaxial", name: "Atlantoaxial Joint", jointType: "synovial pivot", region: "head-neck", sourceRef: REVIEW_SOURCE },
    { id: "joint-thoracic-spine", slug: "thoracic-spine", name: "Thoracic Spine", jointType: "regional intervertebral joint complex", region: "upper-back", sourceRef: REVIEW_SOURCE },
    { id: "joint-acromioclavicular", slug: "acromioclavicular", name: "Acromioclavicular Joint", jointType: "synovial plane", region: "shoulder-girdle", sourceRef: REVIEW_SOURCE },
    { id: "joint-sternoclavicular", slug: "sternoclavicular", name: "Sternoclavicular Joint", jointType: "synovial saddle", region: "shoulder-girdle", sourceRef: REVIEW_SOURCE },
    { id: "joint-glenohumeral", slug: "glenohumeral", name: "Glenohumeral Joint", jointType: "synovial ball-and-socket", region: "shoulder-girdle", sourceRef: REVIEW_SOURCE },
    { id: "joint-scapulothoracic", slug: "scapulothoracic", name: "Scapulothoracic Articulation", jointType: "functional articulation", region: "upper-back", sourceRef: REVIEW_SOURCE },
  ],
  jointMovements: [
    { id: "movement-cervical-flexion", slug: "cervical-flexion", joint: "cervical-spine", movementName: "Cervical Flexion", plane: "sagittal", axis: "frontal", sourceRef: REVIEW_SOURCE },
    { id: "movement-cervical-extension", slug: "cervical-extension", joint: "cervical-spine", movementName: "Cervical Extension", plane: "sagittal", axis: "frontal", sourceRef: REVIEW_SOURCE },
    { id: "movement-cervical-rotation", slug: "cervical-rotation", joint: "cervical-spine", movementName: "Cervical Rotation", plane: "transverse", axis: "vertical", sourceRef: REVIEW_SOURCE },
    { id: "movement-cervical-lateral-flexion", slug: "cervical-lateral-flexion", joint: "cervical-spine", movementName: "Cervical Lateral Flexion", plane: "frontal", axis: "sagittal", sourceRef: REVIEW_SOURCE },
    { id: "movement-atlanto-occipital-extension", slug: "atlanto-occipital-extension", joint: "atlanto-occipital", movementName: "Atlanto-Occipital Extension", plane: "sagittal", axis: "frontal", sourceRef: REVIEW_SOURCE },
    { id: "movement-atlantoaxial-rotation", slug: "atlantoaxial-rotation", joint: "atlantoaxial", movementName: "Atlantoaxial Rotation", plane: "transverse", axis: "vertical", sourceRef: REVIEW_SOURCE },
    { id: "movement-thoracic-extension", slug: "thoracic-extension", joint: "thoracic-spine", movementName: "Thoracic Extension", plane: "sagittal", axis: "frontal", sourceRef: REVIEW_SOURCE },
    { id: "movement-thoracic-rotation", slug: "thoracic-rotation", joint: "thoracic-spine", movementName: "Thoracic Rotation", plane: "transverse", axis: "vertical", sourceRef: REVIEW_SOURCE },
    { id: "movement-shoulder-abduction", slug: "shoulder-abduction", joint: "glenohumeral", movementName: "Shoulder Abduction", plane: "frontal", axis: "sagittal", sourceRef: REVIEW_SOURCE },
    { id: "movement-shoulder-flexion", slug: "shoulder-flexion", joint: "glenohumeral", movementName: "Shoulder Flexion", plane: "sagittal", axis: "frontal", sourceRef: REVIEW_SOURCE },
    { id: "movement-shoulder-extension", slug: "shoulder-extension", joint: "glenohumeral", movementName: "Shoulder Extension", plane: "sagittal", axis: "frontal", sourceRef: REVIEW_SOURCE },
    { id: "movement-shoulder-adduction", slug: "shoulder-adduction", joint: "glenohumeral", movementName: "Shoulder Adduction", plane: "frontal", axis: "sagittal", sourceRef: REVIEW_SOURCE },
    { id: "movement-shoulder-external-rotation", slug: "shoulder-external-rotation", joint: "glenohumeral", movementName: "Shoulder External Rotation", plane: "transverse", axis: "longitudinal humeral", sourceRef: REVIEW_SOURCE },
    { id: "movement-shoulder-internal-rotation", slug: "shoulder-internal-rotation", joint: "glenohumeral", movementName: "Shoulder Internal Rotation", plane: "transverse", axis: "longitudinal humeral", sourceRef: REVIEW_SOURCE },
    { id: "movement-scapular-elevation", slug: "scapular-elevation", joint: "scapulothoracic", movementName: "Scapular Elevation", plane: "frontal", axis: "anteroposterior", sourceRef: REVIEW_SOURCE },
    { id: "movement-scapular-depression", slug: "scapular-depression", joint: "scapulothoracic", movementName: "Scapular Depression", plane: "frontal", axis: "anteroposterior", sourceRef: REVIEW_SOURCE },
    { id: "movement-scapular-retraction", slug: "scapular-retraction", joint: "scapulothoracic", movementName: "Scapular Retraction", plane: "transverse", axis: "vertical", sourceRef: REVIEW_SOURCE },
    { id: "movement-scapular-protraction", slug: "scapular-protraction", joint: "scapulothoracic", movementName: "Scapular Protraction", plane: "transverse", axis: "vertical", sourceRef: REVIEW_SOURCE },
    { id: "movement-scapular-upward-rotation", slug: "scapular-upward-rotation", joint: "scapulothoracic", movementName: "Scapular Upward Rotation", plane: "frontal", axis: "anteroposterior", sourceRef: REVIEW_SOURCE },
    { id: "movement-scapular-downward-rotation", slug: "scapular-downward-rotation", joint: "scapulothoracic", movementName: "Scapular Downward Rotation", plane: "frontal", axis: "anteroposterior", sourceRef: REVIEW_SOURCE },
    { id: "movement-clavicular-depression", slug: "clavicular-depression", joint: "sternoclavicular", movementName: "Clavicular Depression", plane: "frontal", axis: "anteroposterior", sourceRef: REVIEW_SOURCE },
    { id: "movement-rib-elevation", slug: "rib-elevation", joint: "cervical-spine", movementName: "Rib Elevation", sourceRef: REVIEW_SOURCE },
  ],
  rangesOfMotion: [
    { id: "rom-cervical-flexion", slug: "cervical-flexion", joint: "cervical-spine", movement: "cervical-flexion", typicalMinDegrees: 40, typicalMaxDegrees: 50, measurementPosition: "Seated active cervical flexion.", notes: "Typical value only; not diagnostic.", sourceRef: REVIEW_SOURCE },
    { id: "rom-cervical-extension", slug: "cervical-extension", joint: "cervical-spine", movement: "cervical-extension", typicalMinDegrees: 40, typicalMaxDegrees: 50, measurementPosition: "Seated active cervical extension.", notes: "Typical value only; not diagnostic.", sourceRef: REVIEW_SOURCE },
    { id: "rom-cervical-rotation", slug: "cervical-rotation", joint: "cervical-spine", movement: "cervical-rotation", typicalMinDegrees: 70, typicalMaxDegrees: 90, measurementPosition: "Seated active rotation per side.", notes: "Typical value only; not diagnostic.", sourceRef: REVIEW_SOURCE },
    { id: "rom-cervical-lateral-flexion", slug: "cervical-lateral-flexion", joint: "cervical-spine", movement: "cervical-lateral-flexion", typicalMinDegrees: 35, typicalMaxDegrees: 45, measurementPosition: "Seated active lateral flexion per side.", notes: "Typical value only; not diagnostic.", sourceRef: REVIEW_SOURCE },
    { id: "rom-atlantoaxial-rotation", slug: "atlantoaxial-rotation", joint: "atlantoaxial", movement: "atlantoaxial-rotation", typicalMinDegrees: 35, typicalMaxDegrees: 45, measurementPosition: "Supine or seated upper cervical rotation estimate per side.", notes: "Typical value only; not diagnostic.", sourceRef: REVIEW_SOURCE },
    { id: "rom-thoracic-rotation", slug: "thoracic-rotation", joint: "thoracic-spine", movement: "thoracic-rotation", typicalMinDegrees: 30, typicalMaxDegrees: 45, measurementPosition: "Seated thoracic rotation estimate per side.", notes: "Typical value only; not diagnostic.", sourceRef: REVIEW_SOURCE },
    { id: "rom-shoulder-abduction", slug: "shoulder-abduction", joint: "glenohumeral", movement: "shoulder-abduction", typicalMinDegrees: 170, typicalMaxDegrees: 180, measurementPosition: "Standing or seated active abduction with scapular contribution.", notes: "Distinguish GH-only measurement later.", sourceRef: REVIEW_SOURCE },
    { id: "rom-shoulder-flexion", slug: "shoulder-flexion", joint: "glenohumeral", movement: "shoulder-flexion", typicalMinDegrees: 170, typicalMaxDegrees: 180, measurementPosition: "Standing or seated active shoulder flexion.", notes: "Typical value only; not diagnostic.", sourceRef: REVIEW_SOURCE },
    { id: "rom-shoulder-extension", slug: "shoulder-extension", joint: "glenohumeral", movement: "shoulder-extension", typicalMinDegrees: 45, typicalMaxDegrees: 60, measurementPosition: "Standing or prone active shoulder extension.", notes: "Typical value only; not diagnostic.", sourceRef: REVIEW_SOURCE },
    { id: "rom-shoulder-external-rotation", slug: "shoulder-external-rotation", joint: "glenohumeral", movement: "shoulder-external-rotation", typicalMinDegrees: 80, typicalMaxDegrees: 100, measurementPosition: "Shoulder external rotation; document arm position in future citations.", notes: "Typical value only; not diagnostic.", sourceRef: REVIEW_SOURCE },
    { id: "rom-shoulder-internal-rotation", slug: "shoulder-internal-rotation", joint: "glenohumeral", movement: "shoulder-internal-rotation", typicalMinDegrees: 60, typicalMaxDegrees: 80, measurementPosition: "Shoulder internal rotation; document arm position in future citations.", notes: "Typical value only; not diagnostic.", sourceRef: REVIEW_SOURCE },
  ],
  muscles: [
    { id: "muscle-upper-trapezius", slug: "upper-trapezius", name: "Upper Trapezius", formalName: "Trapezius, superior fibers", alternateNames: ["upper trap", "superior trapezius"], languageOfOrigin: "Greek", description: "Superior fibers of trapezius associated with scapular elevation and upward rotation.", region: "neck-shoulder-upper-back", relativeDepth: "superficial", sourceRef: REVIEW_SOURCE },
    { id: "muscle-levator-scapulae", slug: "levator-scapulae", name: "Levator Scapulae", formalName: "Levator scapulae", alternateNames: ["levator scap"], languageOfOrigin: "Latin", region: "neck-shoulder-upper-back", relativeDepth: "intermediate", sourceRef: REVIEW_SOURCE },
    { id: "muscle-sternocleidomastoid", slug: "sternocleidomastoid", name: "Sternocleidomastoid", formalName: "Sternocleidomastoideus", alternateNames: ["SCM"], languageOfOrigin: "Greek/Latin", region: "head-neck", relativeDepth: "superficial", sourceRef: REVIEW_SOURCE },
    { id: "muscle-scalenes", slug: "scalenes", name: "Scalenes", formalName: "Scalene muscle group", alternateNames: ["scalene muscles"], region: "head-neck", relativeDepth: "deep", depthNotes: "Grouped anterior, middle, and posterior scalene muscles for starter seed.", sourceRef: REVIEW_SOURCE },
    { id: "muscle-rhomboid-major", slug: "rhomboid-major", name: "Rhomboid Major", formalName: "Rhomboideus major", alternateNames: ["major rhomboid"], region: "upper-back", relativeDepth: "intermediate", sourceRef: REVIEW_SOURCE },
    { id: "muscle-serratus-anterior", slug: "serratus-anterior", name: "Serratus Anterior", formalName: "Serratus anterior", alternateNames: ["boxer's muscle", "winging muscle", "saw-tooth muscle"], description: "Serratus anterior is a broad lateral chest-wall muscle that runs from the upper ribs to the anterior medial border of the scapula. It protracts the scapula, assists upward rotation, and helps hold the scapula against the thoracic wall.", region: "shoulder-girdle", relativeDepth: "intermediate", depthNotes: "Deep to the scapula and superficial to the rib cage; functionally deep to trapezius and rhomboid coverage on the posterior shoulder blade.", sourceRef: "applied-human-anatomy" },
    { id: "muscle-supraspinatus", slug: "supraspinatus", name: "Supraspinatus", formalName: "Supraspinatus", alternateNames: [], region: "shoulder-girdle", relativeDepth: "deep", sourceRef: REVIEW_SOURCE },
    { id: "muscle-infraspinatus", slug: "infraspinatus", name: "Infraspinatus", formalName: "Infraspinatus", alternateNames: [], region: "shoulder-girdle", relativeDepth: "deep", sourceRef: REVIEW_SOURCE },
    { id: "muscle-deltoid", slug: "deltoid", name: "Deltoid", formalName: "Deltoideus", alternateNames: [], languageOfOrigin: "Greek", region: "shoulder-girdle", relativeDepth: "superficial", sourceRef: REVIEW_SOURCE },
    { id: "muscle-middle-trapezius", slug: "middle-trapezius", name: "Middle Trapezius", formalName: "Trapezius, middle fibers", alternateNames: ["middle trap"], languageOfOrigin: "Greek", region: "upper-back", relativeDepth: "superficial", sourceRef: REVIEW_SOURCE },
    { id: "muscle-lower-trapezius", slug: "lower-trapezius", name: "Lower Trapezius", formalName: "Trapezius, inferior fibers", alternateNames: ["lower trap"], languageOfOrigin: "Greek", region: "upper-back", relativeDepth: "superficial", sourceRef: REVIEW_SOURCE },
    { id: "muscle-rhomboid-minor", slug: "rhomboid-minor", name: "Rhomboid Minor", formalName: "Rhomboideus minor", alternateNames: ["minor rhomboid"], region: "upper-back", relativeDepth: "intermediate", sourceRef: REVIEW_SOURCE },
    { id: "muscle-splenius-capitis", slug: "splenius-capitis", name: "Splenius Capitis", formalName: "Splenius capitis", alternateNames: [], languageOfOrigin: "Latin", region: "head-neck", relativeDepth: "intermediate", sourceRef: REVIEW_SOURCE },
    { id: "muscle-splenius-cervicis", slug: "splenius-cervicis", name: "Splenius Cervicis", formalName: "Splenius cervicis", alternateNames: [], languageOfOrigin: "Latin", region: "head-neck", relativeDepth: "intermediate", sourceRef: REVIEW_SOURCE },
    { id: "muscle-suboccipital-muscles", slug: "suboccipital-muscles", name: "Suboccipital Muscles", formalName: "Suboccipital muscle group", alternateNames: ["suboccipitals"], region: "base-of-skull", relativeDepth: "deep", depthNotes: "Grouped rectus capitis posterior major/minor and obliquus capitis superior/inferior for first milestone.", sourceRef: REVIEW_SOURCE },
    { id: "muscle-semispinalis-capitis", slug: "semispinalis-capitis", name: "Semispinalis Capitis", formalName: "Semispinalis capitis", alternateNames: [], region: "head-neck", relativeDepth: "deep", sourceRef: REVIEW_SOURCE },
    { id: "muscle-erector-spinae-upper-thoracic", slug: "erector-spinae-upper-thoracic", name: "Upper Thoracic Erector Spinae", formalName: "Erector spinae, upper thoracic fibers", alternateNames: ["upper thoracic paraspinals"], region: "upper-back", relativeDepth: "deep", sourceRef: REVIEW_SOURCE },
    { id: "muscle-pectoralis-minor", slug: "pectoralis-minor", name: "Pectoralis Minor", formalName: "Pectoralis minor", alternateNames: ["pec minor", "deep pectoral muscle"], description: "Pectoralis minor is a deep anterior shoulder-girdle muscle running from the upper ribs to the coracoid process of the scapula. It assists scapular protraction, depression, and anterior tilt mechanics.", region: "shoulder-girdle", relativeDepth: "intermediate", depthNotes: "Deep to pectoralis major on the anterior chest wall and superficial to the rib cage.", sourceRef: "applied-human-anatomy" },
    { id: "muscle-subscapularis", slug: "subscapularis", name: "Subscapularis", formalName: "Subscapularis", alternateNames: [], region: "rotator-cuff-region", relativeDepth: "deep", sourceRef: REVIEW_SOURCE },
    { id: "muscle-teres-minor", slug: "teres-minor", name: "Teres Minor", formalName: "Teres minor", alternateNames: [], region: "rotator-cuff-region", relativeDepth: "deep", sourceRef: REVIEW_SOURCE },
    { id: "muscle-teres-major", slug: "teres-major", name: "Teres Major", formalName: "Teres major", alternateNames: [], region: "shoulder-girdle", relativeDepth: "deep", sourceRef: REVIEW_SOURCE },
    { id: "muscle-latissimus-dorsi", slug: "latissimus-dorsi", name: "Latissimus Dorsi", formalName: "Latissimus dorsi", alternateNames: ["lat"], languageOfOrigin: "Latin", region: "upper-back", relativeDepth: "superficial", sourceRef: REVIEW_SOURCE },
    { id: "muscle-pectoralis-major-clavicular-head", slug: "pectoralis-major-clavicular-head", name: "Pectoralis Major, Clavicular Head", formalName: "Pectoralis major, pars clavicularis", alternateNames: ["clavicular pec major", "upper pec", "clavicular head of pectoralis major"], description: "The clavicular head of pectoralis major is the upper superficial portion of pectoralis major running from the medial clavicle toward the proximal humerus. It assists shoulder flexion, horizontal adduction, and adduction.", region: "shoulder-girdle", relativeDepth: "superficial", depthNotes: "Superficial anterior chest and shoulder muscle over pectoralis minor and deeper shoulder-girdle structures.", sourceRef: "applied-human-anatomy" },
    { id: "muscle-subclavius", slug: "subclavius", name: "Subclavius", formalName: "Subclavius", alternateNames: ["collarbone stabilizer", "subclavius muscle"], description: "Subclavius is a small deep shoulder-girdle muscle running from the first rib and costal cartilage region to the inferior clavicle. It helps stabilize and depress the clavicle at the sternoclavicular region.", region: "shoulder-girdle", relativeDepth: "deep", depthNotes: "Deep to the clavicle and pectoral fascia in the anterior shoulder-girdle region.", sourceRef: "applied-human-anatomy" },
  ],
  muscleAttachments: [
    { id: "attachment-upper-trapezius-origin-nuchal-line", muscle: "upper-trapezius", type: "origin", bone: "occipital-bone", landmark: "superior-nuchal-line", description: "Origin from occipital region including superior nuchal line.", sourceRef: REVIEW_SOURCE },
    { id: "attachment-upper-trapezius-insertion-clavicle", muscle: "upper-trapezius", type: "insertion", bone: "clavicle", landmark: "lateral-third-clavicle", description: "Insertion on lateral clavicle.", sourceRef: REVIEW_SOURCE },
    { id: "attachment-upper-trapezius-insertion-scapula", muscle: "upper-trapezius", type: "insertion", bone: "scapula", landmark: "acromion", description: "Insertion on acromion and spine of scapula region.", sourceRef: REVIEW_SOURCE },
    { id: "attachment-levator-origin-cervical-transverse", muscle: "levator-scapulae", type: "origin", bone: "cervical-vertebrae", landmark: "cervical-transverse-processes", description: "Origin from upper cervical transverse processes.", sourceRef: REVIEW_SOURCE },
    { id: "attachment-levator-insertion-scapula", muscle: "levator-scapulae", type: "insertion", bone: "scapula", landmark: "superior-angle-scapula", description: "Insertion near superior angle and medial border of scapula.", sourceRef: REVIEW_SOURCE },
    { id: "attachment-scm-origin-sternum", muscle: "sternocleidomastoid", type: "origin", bone: "sternum", landmark: "manubrium", description: "Sternal head origin.", sourceRef: REVIEW_SOURCE },
    { id: "attachment-scm-origin-clavicle", muscle: "sternocleidomastoid", type: "origin", bone: "clavicle", landmark: "medial-clavicle", description: "Clavicular head origin.", sourceRef: REVIEW_SOURCE },
    { id: "attachment-scm-insertion-mastoid", muscle: "sternocleidomastoid", type: "insertion", bone: "temporal-bone", landmark: "mastoid-process", description: "Insertion on mastoid process.", sourceRef: REVIEW_SOURCE },
    { id: "attachment-scalenes-origin-cervical", muscle: "scalenes", type: "origin", bone: "cervical-vertebrae", landmark: "cervical-transverse-processes", description: "Origin from cervical transverse processes.", sourceRef: REVIEW_SOURCE },
    { id: "attachment-scalenes-insertion-first-rib", muscle: "scalenes", type: "insertion", bone: "ribs", landmark: "first-rib", description: "Starter seed insertion on first rib.", sourceRef: REVIEW_SOURCE },
    { id: "attachment-rhomboid-major-origin", muscle: "rhomboid-major", type: "origin", bone: "thoracic-vertebrae", landmark: "cervicothoracic-spinous-processes", description: "Origin from lower cervical and upper thoracic spinous processes.", sourceRef: REVIEW_SOURCE },
    { id: "attachment-rhomboid-major-insertion", muscle: "rhomboid-major", type: "insertion", bone: "scapula", landmark: "medial-border-scapula", description: "Insertion on medial border of scapula.", sourceRef: REVIEW_SOURCE },
    { id: "attachment-serratus-origin-ribs", muscle: "serratus-anterior", type: "origin", bone: "ribs", landmark: "upper-ribs", description: "Lateral surfaces of the upper ribs, commonly described across ribs one through eight or nine.", sourceRef: "applied-human-anatomy" },
    { id: "attachment-serratus-insertion-scapula", muscle: "serratus-anterior", type: "insertion", bone: "scapula", landmark: "medial-border-scapula", description: "Anterior surface of the medial border of the scapula, with strong inferior-angle contribution.", sourceRef: "applied-human-anatomy" },
    { id: "attachment-supraspinatus-origin", muscle: "supraspinatus", type: "origin", bone: "scapula", landmark: "supraspinous-fossa", description: "Origin in supraspinous fossa.", sourceRef: REVIEW_SOURCE },
    { id: "attachment-supraspinatus-insertion", muscle: "supraspinatus", type: "insertion", bone: "humerus", landmark: "greater-tubercle", description: "Insertion on greater tubercle.", sourceRef: REVIEW_SOURCE },
    { id: "attachment-infraspinatus-origin", muscle: "infraspinatus", type: "origin", bone: "scapula", landmark: "infraspinous-fossa", description: "Origin in infraspinous fossa.", sourceRef: REVIEW_SOURCE },
    { id: "attachment-infraspinatus-insertion", muscle: "infraspinatus", type: "insertion", bone: "humerus", landmark: "greater-tubercle", description: "Insertion on greater tubercle.", sourceRef: REVIEW_SOURCE },
    { id: "attachment-deltoid-origin-clavicle", muscle: "deltoid", type: "origin", bone: "clavicle", landmark: "lateral-third-clavicle", description: "Anterior origin from lateral clavicle.", sourceRef: REVIEW_SOURCE },
    { id: "attachment-deltoid-origin-scapula", muscle: "deltoid", type: "origin", bone: "scapula", landmark: "acromion", description: "Middle/posterior origins from acromion and spine of scapula.", sourceRef: REVIEW_SOURCE },
    { id: "attachment-deltoid-insertion-humerus", muscle: "deltoid", type: "insertion", bone: "humerus", landmark: "deltoid-tuberosity", description: "Insertion on deltoid tuberosity.", sourceRef: REVIEW_SOURCE },
    { id: "attachment-middle-trapezius-origin", muscle: "middle-trapezius", type: "origin", bone: "thoracic-vertebrae", landmark: "cervicothoracic-spinous-processes", description: "Origin from lower cervical and upper thoracic spinous processes.", sourceRef: REVIEW_SOURCE },
    { id: "attachment-middle-trapezius-insertion", muscle: "middle-trapezius", type: "insertion", bone: "scapula", landmark: "spine-of-scapula", description: "Insertion along acromion and spine of scapula.", sourceRef: REVIEW_SOURCE },
    { id: "attachment-lower-trapezius-origin", muscle: "lower-trapezius", type: "origin", bone: "thoracic-vertebrae", landmark: "upper-thoracic-spinous-processes", description: "Origin from thoracic spinous processes in the upper back starter slice.", sourceRef: REVIEW_SOURCE },
    { id: "attachment-lower-trapezius-insertion", muscle: "lower-trapezius", type: "insertion", bone: "scapula", landmark: "spine-of-scapula", description: "Insertion near medial spine of scapula.", sourceRef: REVIEW_SOURCE },
    { id: "attachment-rhomboid-minor-origin", muscle: "rhomboid-minor", type: "origin", bone: "thoracic-vertebrae", landmark: "cervicothoracic-spinous-processes", description: "Origin around lower cervical and upper thoracic spinous processes.", sourceRef: REVIEW_SOURCE },
    { id: "attachment-rhomboid-minor-insertion", muscle: "rhomboid-minor", type: "insertion", bone: "scapula", landmark: "medial-border-scapula", description: "Insertion on medial border near root of scapular spine.", sourceRef: REVIEW_SOURCE },
    { id: "attachment-splenius-capitis-origin", muscle: "splenius-capitis", type: "origin", bone: "thoracic-vertebrae", landmark: "cervicothoracic-spinous-processes", description: "Origin from nuchal ligament and upper thoracic spinous process region.", sourceRef: REVIEW_SOURCE },
    { id: "attachment-splenius-capitis-insertion", muscle: "splenius-capitis", type: "insertion", bone: "occipital-bone", landmark: "superior-nuchal-line", description: "Insertion on lateral superior nuchal line and mastoid region.", sourceRef: REVIEW_SOURCE },
    { id: "attachment-splenius-cervicis-origin", muscle: "splenius-cervicis", type: "origin", bone: "thoracic-vertebrae", landmark: "upper-thoracic-spinous-processes", description: "Origin from upper thoracic spinous process region.", sourceRef: REVIEW_SOURCE },
    { id: "attachment-splenius-cervicis-insertion", muscle: "splenius-cervicis", type: "insertion", bone: "cervical-vertebrae", landmark: "cervical-transverse-processes", description: "Insertion on upper cervical transverse processes.", sourceRef: REVIEW_SOURCE },
    { id: "attachment-suboccipitals-origin", muscle: "suboccipital-muscles", type: "origin", bone: "axis", landmark: "axis-spinous-process", description: "Grouped suboccipital origins around atlas and axis.", sourceRef: REVIEW_SOURCE },
    { id: "attachment-suboccipitals-insertion", muscle: "suboccipital-muscles", type: "insertion", bone: "occipital-bone", landmark: "inferior-nuchal-line", description: "Grouped insertion near the inferior nuchal line and suboccipital region.", sourceRef: REVIEW_SOURCE },
    { id: "attachment-semispinalis-capitis-origin", muscle: "semispinalis-capitis", type: "origin", bone: "cervical-vertebrae", landmark: "cervical-transverse-processes", description: "Origin from cervical and upper thoracic transverse process region.", sourceRef: REVIEW_SOURCE },
    { id: "attachment-semispinalis-capitis-insertion", muscle: "semispinalis-capitis", type: "insertion", bone: "occipital-bone", landmark: "superior-nuchal-line", description: "Insertion between superior and inferior nuchal line region.", sourceRef: REVIEW_SOURCE },
    { id: "attachment-erector-spinae-upper-thoracic-origin", muscle: "erector-spinae-upper-thoracic", type: "origin", bone: "thoracic-vertebrae", landmark: "upper-thoracic-spinous-processes", description: "Grouped origin in thoracic vertebral region.", sourceRef: REVIEW_SOURCE },
    { id: "attachment-erector-spinae-upper-thoracic-insertion", muscle: "erector-spinae-upper-thoracic", type: "insertion", bone: "ribs", landmark: "upper-ribs", description: "Grouped insertion on upper ribs and transverse process region.", sourceRef: REVIEW_SOURCE },
    { id: "attachment-pectoralis-minor-origin", muscle: "pectoralis-minor", type: "origin", bone: "ribs", landmark: "upper-ribs", description: "Anterior surfaces of upper ribs, commonly ribs three through five near their costal cartilages.", sourceRef: "applied-human-anatomy" },
    { id: "attachment-pectoralis-minor-insertion", muscle: "pectoralis-minor", type: "insertion", bone: "scapula", landmark: "coracoid-process", description: "Medial and superior aspect of the coracoid process of the scapula.", sourceRef: "applied-human-anatomy" },
    { id: "attachment-subscapularis-origin", muscle: "subscapularis", type: "origin", bone: "scapula", landmark: "subscapular-fossa", description: "Origin from subscapular fossa.", sourceRef: REVIEW_SOURCE },
    { id: "attachment-subscapularis-insertion", muscle: "subscapularis", type: "insertion", bone: "humerus", landmark: "lesser-tubercle", description: "Insertion on lesser tubercle.", sourceRef: REVIEW_SOURCE },
    { id: "attachment-teres-minor-origin", muscle: "teres-minor", type: "origin", bone: "scapula", landmark: "lateral-border-scapula", description: "Origin from lateral border of scapula.", sourceRef: REVIEW_SOURCE },
    { id: "attachment-teres-minor-insertion", muscle: "teres-minor", type: "insertion", bone: "humerus", landmark: "greater-tubercle", description: "Insertion on greater tubercle.", sourceRef: REVIEW_SOURCE },
    { id: "attachment-teres-major-origin", muscle: "teres-major", type: "origin", bone: "scapula", landmark: "inferior-angle-scapula", description: "Origin from inferior angle and lateral border of scapula.", sourceRef: REVIEW_SOURCE },
    { id: "attachment-teres-major-insertion", muscle: "teres-major", type: "insertion", bone: "humerus", landmark: "intertubercular-sulcus", description: "Insertion near medial lip of intertubercular sulcus.", sourceRef: REVIEW_SOURCE },
    { id: "attachment-latissimus-dorsi-origin", muscle: "latissimus-dorsi", type: "origin", bone: "thoracic-vertebrae", landmark: "upper-thoracic-spinous-processes", description: "Starter slice origin includes thoracolumbar and lower thoracic components represented by thoracic spine region.", sourceRef: REVIEW_SOURCE },
    { id: "attachment-latissimus-dorsi-insertion", muscle: "latissimus-dorsi", type: "insertion", bone: "humerus", landmark: "intertubercular-sulcus", description: "Insertion near floor of intertubercular sulcus.", sourceRef: REVIEW_SOURCE },
    { id: "attachment-pectoralis-major-clavicular-origin", muscle: "pectoralis-major-clavicular-head", type: "origin", bone: "clavicle", landmark: "medial-clavicle", description: "Medial clavicle and adjacent anterior clavicular region for the clavicular head.", sourceRef: "applied-human-anatomy" },
    { id: "attachment-pectoralis-major-clavicular-insertion", muscle: "pectoralis-major-clavicular-head", type: "insertion", bone: "humerus", landmark: "intertubercular-sulcus", description: "Lateral lip of the intertubercular sulcus region of the proximal humerus.", sourceRef: "applied-human-anatomy" },
    { id: "attachment-subclavius-origin", muscle: "subclavius", type: "origin", bone: "ribs", landmark: "first-rib", description: "First rib and adjacent costal cartilage region.", sourceRef: "applied-human-anatomy" },
    { id: "attachment-subclavius-insertion", muscle: "subclavius", type: "insertion", bone: "clavicle", landmark: "inferior-clavicle", description: "Inferior surface of the middle third of the clavicle.", sourceRef: "applied-human-anatomy" },
  ],
  muscleActions: [
    { id: "action-upper-trapezius-scapular-elevation", muscle: "upper-trapezius", joint: "scapulothoracic", movement: "scapular-elevation", role: "primary", contractionType: "concentric", description: "Elevates the scapula.", sourceRef: REVIEW_SOURCE },
    { id: "action-upper-trapezius-upward-rotation", muscle: "upper-trapezius", joint: "scapulothoracic", movement: "scapular-upward-rotation", role: "primary", contractionType: "concentric", description: "Contributes to upward scapular rotation.", sourceRef: REVIEW_SOURCE },
    { id: "action-upper-trapezius-scapular-depression-control", muscle: "upper-trapezius", joint: "scapulothoracic", movement: "scapular-depression", role: "stabilizer", contractionType: "eccentric", description: "Controls descent from elevation.", sourceRef: REVIEW_SOURCE },
    { id: "action-upper-trapezius-cervical-extension", muscle: "upper-trapezius", joint: "cervical-spine", movement: "cervical-extension", role: "secondary", contractionType: "reverse_action", description: "With scapular fixation, can assist cervical extension.", sourceRef: REVIEW_SOURCE },
    { id: "action-levator-scapulae-elevation", muscle: "levator-scapulae", joint: "scapulothoracic", movement: "scapular-elevation", role: "primary", contractionType: "concentric", description: "Elevates the scapula.", sourceRef: REVIEW_SOURCE },
    { id: "action-levator-scapulae-cervical-lateral-flexion", muscle: "levator-scapulae", joint: "cervical-spine", movement: "cervical-lateral-flexion", role: "secondary", contractionType: "concentric", description: "Can assist cervical lateral flexion.", sourceRef: REVIEW_SOURCE },
    { id: "action-scm-cervical-flexion", muscle: "sternocleidomastoid", joint: "cervical-spine", movement: "cervical-flexion", role: "primary", contractionType: "concentric", description: "Bilateral action assists cervical flexion.", sourceRef: REVIEW_SOURCE },
    { id: "action-scm-cervical-rotation", muscle: "sternocleidomastoid", joint: "cervical-spine", movement: "cervical-rotation", role: "primary", contractionType: "concentric", description: "Unilateral action contributes to cervical rotation.", sourceRef: REVIEW_SOURCE },
    { id: "action-scalenes-cervical-lateral-flexion", muscle: "scalenes", joint: "cervical-spine", movement: "cervical-lateral-flexion", role: "primary", contractionType: "concentric", description: "Assist lateral flexion of the cervical spine.", sourceRef: REVIEW_SOURCE },
    { id: "action-scalenes-rib-elevation", muscle: "scalenes", joint: "cervical-spine", movement: "rib-elevation", role: "secondary", contractionType: "concentric", description: "Can elevate upper ribs during breathing mechanics.", sourceRef: REVIEW_SOURCE },
    { id: "action-rhomboid-major-retraction", muscle: "rhomboid-major", joint: "scapulothoracic", movement: "scapular-retraction", role: "primary", contractionType: "concentric", description: "Retracts the scapula.", sourceRef: REVIEW_SOURCE },
    { id: "action-rhomboid-major-protraction-control", muscle: "rhomboid-major", joint: "scapulothoracic", movement: "scapular-protraction", role: "stabilizer", contractionType: "eccentric", description: "Controls scapular protraction.", sourceRef: REVIEW_SOURCE },
    { id: "action-serratus-protraction", muscle: "serratus-anterior", joint: "scapulothoracic", movement: "scapular-protraction", role: "primary", contractionType: "concentric", description: "Protracts the scapula and helps hold it against the thoracic wall.", sourceRef: "applied-human-anatomy" },
    { id: "action-serratus-upward-rotation", muscle: "serratus-anterior", joint: "scapulothoracic", movement: "scapular-upward-rotation", role: "primary", contractionType: "concentric", description: "Contributes strongly to upward scapular rotation during arm elevation.", sourceRef: "applied-human-anatomy" },
    { id: "action-supraspinatus-abduction", muscle: "supraspinatus", joint: "glenohumeral", movement: "shoulder-abduction", role: "primary", contractionType: "concentric", description: "Initiates/contributes to shoulder abduction.", sourceRef: REVIEW_SOURCE },
    { id: "action-infraspinatus-external-rotation", muscle: "infraspinatus", joint: "glenohumeral", movement: "shoulder-external-rotation", role: "primary", contractionType: "concentric", description: "Externally rotates the shoulder.", sourceRef: REVIEW_SOURCE },
    { id: "action-deltoid-abduction", muscle: "deltoid", joint: "glenohumeral", movement: "shoulder-abduction", role: "primary", contractionType: "concentric", description: "Abducts the shoulder.", sourceRef: REVIEW_SOURCE },
    { id: "action-deltoid-flexion", muscle: "deltoid", joint: "glenohumeral", movement: "shoulder-flexion", role: "secondary", contractionType: "concentric", description: "Anterior fibers assist shoulder flexion.", sourceRef: REVIEW_SOURCE },
    { id: "action-middle-trapezius-retraction", muscle: "middle-trapezius", joint: "scapulothoracic", movement: "scapular-retraction", role: "primary", contractionType: "concentric", description: "Retracts the scapula.", sourceRef: REVIEW_SOURCE },
    { id: "action-middle-trapezius-protraction-control", muscle: "middle-trapezius", joint: "scapulothoracic", movement: "scapular-protraction", role: "stabilizer", contractionType: "eccentric", description: "Controls scapular protraction.", sourceRef: REVIEW_SOURCE },
    { id: "action-lower-trapezius-upward-rotation", muscle: "lower-trapezius", joint: "scapulothoracic", movement: "scapular-upward-rotation", role: "primary", contractionType: "concentric", description: "Contributes to upward scapular rotation.", sourceRef: REVIEW_SOURCE },
    { id: "action-lower-trapezius-depression", muscle: "lower-trapezius", joint: "scapulothoracic", movement: "scapular-depression", role: "primary", contractionType: "concentric", description: "Depresses the scapula.", sourceRef: REVIEW_SOURCE },
    { id: "action-rhomboid-minor-retraction", muscle: "rhomboid-minor", joint: "scapulothoracic", movement: "scapular-retraction", role: "primary", contractionType: "concentric", description: "Retracts the scapula.", sourceRef: REVIEW_SOURCE },
    { id: "action-rhomboid-minor-downward-rotation", muscle: "rhomboid-minor", joint: "scapulothoracic", movement: "scapular-downward-rotation", role: "secondary", contractionType: "concentric", description: "Assists scapular downward rotation.", sourceRef: REVIEW_SOURCE },
    { id: "action-splenius-capitis-extension", muscle: "splenius-capitis", joint: "cervical-spine", movement: "cervical-extension", role: "secondary", contractionType: "concentric", description: "Assists cervical extension.", sourceRef: REVIEW_SOURCE },
    { id: "action-splenius-capitis-rotation", muscle: "splenius-capitis", joint: "cervical-spine", movement: "cervical-rotation", role: "secondary", contractionType: "concentric", description: "Assists ipsilateral cervical rotation.", sourceRef: REVIEW_SOURCE },
    { id: "action-splenius-cervicis-extension", muscle: "splenius-cervicis", joint: "cervical-spine", movement: "cervical-extension", role: "secondary", contractionType: "concentric", description: "Assists cervical extension.", sourceRef: REVIEW_SOURCE },
    { id: "action-splenius-cervicis-rotation", muscle: "splenius-cervicis", joint: "cervical-spine", movement: "cervical-rotation", role: "secondary", contractionType: "concentric", description: "Assists ipsilateral cervical rotation.", sourceRef: REVIEW_SOURCE },
    { id: "action-suboccipitals-ao-extension", muscle: "suboccipital-muscles", joint: "atlanto-occipital", movement: "atlanto-occipital-extension", role: "primary", contractionType: "concentric", description: "Contributes to upper cervical extension.", sourceRef: REVIEW_SOURCE },
    { id: "action-suboccipitals-aa-rotation", muscle: "suboccipital-muscles", joint: "atlantoaxial", movement: "atlantoaxial-rotation", role: "secondary", contractionType: "concentric", description: "Contributes to upper cervical rotation.", sourceRef: REVIEW_SOURCE },
    { id: "action-semispinalis-capitis-extension", muscle: "semispinalis-capitis", joint: "cervical-spine", movement: "cervical-extension", role: "secondary", contractionType: "concentric", description: "Extends the head and neck.", sourceRef: REVIEW_SOURCE },
    { id: "action-erector-spinae-upper-thoracic-extension", muscle: "erector-spinae-upper-thoracic", joint: "thoracic-spine", movement: "thoracic-extension", role: "primary", contractionType: "concentric", description: "Extends the upper thoracic spine.", sourceRef: REVIEW_SOURCE },
    { id: "action-erector-spinae-upper-thoracic-rotation-control", muscle: "erector-spinae-upper-thoracic", joint: "thoracic-spine", movement: "thoracic-rotation", role: "stabilizer", contractionType: "isometric", description: "Contributes to thoracic postural control.", sourceRef: REVIEW_SOURCE },
    { id: "action-pectoralis-minor-protraction", muscle: "pectoralis-minor", joint: "scapulothoracic", movement: "scapular-protraction", role: "secondary", contractionType: "concentric", description: "Assists scapular protraction and anterior tilt patterning through the coracoid process.", sourceRef: "applied-human-anatomy" },
    { id: "action-pectoralis-minor-depression", muscle: "pectoralis-minor", joint: "scapulothoracic", movement: "scapular-depression", role: "secondary", contractionType: "concentric", description: "Assists scapular depression and downward pull of the coracoid region.", sourceRef: "applied-human-anatomy" },
    { id: "action-subscapularis-internal-rotation", muscle: "subscapularis", joint: "glenohumeral", movement: "shoulder-internal-rotation", role: "primary", contractionType: "concentric", description: "Internally rotates the shoulder.", sourceRef: REVIEW_SOURCE },
    { id: "action-subscapularis-stabilization", muscle: "subscapularis", joint: "glenohumeral", movement: "shoulder-external-rotation", role: "stabilizer", contractionType: "eccentric", description: "Controls external rotation and supports glenohumeral stability.", sourceRef: REVIEW_SOURCE },
    { id: "action-teres-minor-external-rotation", muscle: "teres-minor", joint: "glenohumeral", movement: "shoulder-external-rotation", role: "primary", contractionType: "concentric", description: "Externally rotates the shoulder.", sourceRef: REVIEW_SOURCE },
    { id: "action-teres-minor-adduction", muscle: "teres-minor", joint: "glenohumeral", movement: "shoulder-adduction", role: "secondary", contractionType: "concentric", description: "Assists shoulder adduction.", sourceRef: REVIEW_SOURCE },
    { id: "action-teres-major-extension", muscle: "teres-major", joint: "glenohumeral", movement: "shoulder-extension", role: "secondary", contractionType: "concentric", description: "Assists shoulder extension.", sourceRef: REVIEW_SOURCE },
    { id: "action-teres-major-internal-rotation", muscle: "teres-major", joint: "glenohumeral", movement: "shoulder-internal-rotation", role: "secondary", contractionType: "concentric", description: "Assists shoulder internal rotation.", sourceRef: REVIEW_SOURCE },
    { id: "action-latissimus-dorsi-extension", muscle: "latissimus-dorsi", joint: "glenohumeral", movement: "shoulder-extension", role: "primary", contractionType: "concentric", description: "Extends the shoulder.", sourceRef: REVIEW_SOURCE },
    { id: "action-latissimus-dorsi-adduction", muscle: "latissimus-dorsi", joint: "glenohumeral", movement: "shoulder-adduction", role: "primary", contractionType: "concentric", description: "Adducts the shoulder.", sourceRef: REVIEW_SOURCE },
    { id: "action-latissimus-dorsi-internal-rotation", muscle: "latissimus-dorsi", joint: "glenohumeral", movement: "shoulder-internal-rotation", role: "secondary", contractionType: "concentric", description: "Assists shoulder internal rotation.", sourceRef: REVIEW_SOURCE },
    { id: "action-pectoralis-major-clavicular-flexion", muscle: "pectoralis-major-clavicular-head", joint: "glenohumeral", movement: "shoulder-flexion", role: "primary", contractionType: "concentric", description: "Clavicular fibers assist shoulder flexion from extension and neutral positions.", sourceRef: "applied-human-anatomy" },
    { id: "action-pectoralis-major-clavicular-adduction", muscle: "pectoralis-major-clavicular-head", joint: "glenohumeral", movement: "shoulder-adduction", role: "secondary", contractionType: "concentric", description: "Assists shoulder adduction and horizontal adduction with the rest of pectoralis major.", sourceRef: "applied-human-anatomy" },
    { id: "action-subclavius-clavicular-depression", muscle: "subclavius", joint: "sternoclavicular", movement: "clavicular-depression", role: "stabilizer", contractionType: "isometric", description: "Stabilizes and can depress the clavicle at the sternoclavicular region.", sourceRef: "applied-human-anatomy" },
  ],
  nerves: [
    { id: "nerve-accessory-nerve", slug: "accessory-nerve", name: "Accessory Nerve (CN XI)", nerveRoots: ["CN XI"], region: "head-neck", sourceRef: REVIEW_SOURCE },
    { id: "nerve-cervical-plexus", slug: "cervical-plexus", name: "Cervical Plexus", nerveRoots: ["C1", "C2", "C3", "C4"], region: "head-neck", sourceRef: REVIEW_SOURCE },
    { id: "nerve-brachial-plexus", slug: "brachial-plexus", name: "Brachial Plexus", nerveRoots: ["C5", "C6", "C7", "C8", "T1"], region: "shoulder-girdle", sourceRef: REVIEW_SOURCE },
    { id: "nerve-dorsal-scapular-nerve", slug: "dorsal-scapular-nerve", name: "Dorsal Scapular Nerve", nerveRoots: ["C5"], region: "upper-back", sourceRef: REVIEW_SOURCE },
    { id: "nerve-long-thoracic-nerve", slug: "long-thoracic-nerve", name: "Long Thoracic Nerve", nerveRoots: ["C5", "C6", "C7"], region: "shoulder-girdle", description: "Brachial plexus branch supplying serratus anterior.", sourceRef: "applied-human-anatomy" },
    { id: "nerve-suprascapular-nerve", slug: "suprascapular-nerve", name: "Suprascapular Nerve", nerveRoots: ["C5", "C6"], region: "shoulder-girdle", sourceRef: REVIEW_SOURCE },
    { id: "nerve-axillary-nerve", slug: "axillary-nerve", name: "Axillary Nerve", nerveRoots: ["C5", "C6"], region: "shoulder-girdle", sourceRef: REVIEW_SOURCE },
    { id: "nerve-suboccipital-nerve", slug: "suboccipital-nerve", name: "Suboccipital Nerve", nerveRoots: ["C1"], region: "head-neck", sourceRef: REVIEW_SOURCE },
    { id: "nerve-posterior-rami-spinal-nerves", slug: "posterior-rami-spinal-nerves", name: "Posterior Rami of Spinal Nerves", nerveRoots: ["cervical posterior rami", "thoracic posterior rami"], region: "neck-shoulder-upper-back", sourceRef: REVIEW_SOURCE },
    { id: "nerve-upper-lower-subscapular-nerves", slug: "upper-lower-subscapular-nerves", name: "Upper and Lower Subscapular Nerves", nerveRoots: ["C5", "C6"], region: "shoulder-girdle", sourceRef: REVIEW_SOURCE },
    { id: "nerve-thoracodorsal-nerve", slug: "thoracodorsal-nerve", name: "Thoracodorsal Nerve", nerveRoots: ["C6", "C7", "C8"], region: "shoulder-girdle", sourceRef: REVIEW_SOURCE },
    { id: "nerve-medial-pectoral-nerve", slug: "medial-pectoral-nerve", name: "Medial Pectoral Nerve", nerveRoots: ["C8", "T1"], region: "shoulder-girdle", description: "Brachial plexus branch supplying pectoralis minor and contributing to pectoral-region innervation.", sourceRef: "applied-human-anatomy" },
    { id: "nerve-lateral-pectoral-nerve", slug: "lateral-pectoral-nerve", name: "Lateral Pectoral Nerve", nerveRoots: ["C5", "C6", "C7"], region: "shoulder-girdle", description: "Brachial plexus branch supplying pectoralis major, including clavicular fibers.", sourceRef: "applied-human-anatomy" },
    { id: "nerve-nerve-to-subclavius", slug: "nerve-to-subclavius", name: "Nerve to Subclavius", nerveRoots: ["C5", "C6"], region: "shoulder-girdle", description: "Brachial plexus branch supplying subclavius.", sourceRef: "applied-human-anatomy" },
  ],
  muscleInnervations: [
    { id: "innervation-upper-trapezius-accessory", muscle: "upper-trapezius", nerve: "accessory-nerve", description: "Motor innervation via spinal accessory nerve.", sourceRef: REVIEW_SOURCE },
    { id: "innervation-upper-trapezius-cervical", muscle: "upper-trapezius", nerve: "cervical-plexus", description: "Cervical contributions included for starter model.", sourceRef: REVIEW_SOURCE },
    { id: "innervation-levator-dorsal-scapular", muscle: "levator-scapulae", nerve: "dorsal-scapular-nerve", sourceRef: REVIEW_SOURCE },
    { id: "innervation-levator-cervical", muscle: "levator-scapulae", nerve: "cervical-plexus", sourceRef: REVIEW_SOURCE },
    { id: "innervation-scm-accessory", muscle: "sternocleidomastoid", nerve: "accessory-nerve", sourceRef: REVIEW_SOURCE },
    { id: "innervation-scm-cervical", muscle: "sternocleidomastoid", nerve: "cervical-plexus", sourceRef: REVIEW_SOURCE },
    { id: "innervation-scalenes-cervical", muscle: "scalenes", nerve: "cervical-plexus", sourceRef: REVIEW_SOURCE },
    { id: "innervation-rhomboid-dorsal-scapular", muscle: "rhomboid-major", nerve: "dorsal-scapular-nerve", sourceRef: REVIEW_SOURCE },
    { id: "innervation-serratus-long-thoracic", muscle: "serratus-anterior", nerve: "long-thoracic-nerve", description: "Long thoracic nerve, commonly described with C5-C7 roots.", sourceRef: "applied-human-anatomy" },
    { id: "innervation-supraspinatus-suprascapular", muscle: "supraspinatus", nerve: "suprascapular-nerve", sourceRef: REVIEW_SOURCE },
    { id: "innervation-infraspinatus-suprascapular", muscle: "infraspinatus", nerve: "suprascapular-nerve", sourceRef: REVIEW_SOURCE },
    { id: "innervation-deltoid-axillary", muscle: "deltoid", nerve: "axillary-nerve", sourceRef: REVIEW_SOURCE },
    { id: "innervation-middle-trapezius-accessory", muscle: "middle-trapezius", nerve: "accessory-nerve", sourceRef: REVIEW_SOURCE },
    { id: "innervation-lower-trapezius-accessory", muscle: "lower-trapezius", nerve: "accessory-nerve", sourceRef: REVIEW_SOURCE },
    { id: "innervation-rhomboid-minor-dorsal-scapular", muscle: "rhomboid-minor", nerve: "dorsal-scapular-nerve", sourceRef: REVIEW_SOURCE },
    { id: "innervation-splenius-capitis-posterior-rami", muscle: "splenius-capitis", nerve: "posterior-rami-spinal-nerves", sourceRef: REVIEW_SOURCE },
    { id: "innervation-splenius-cervicis-posterior-rami", muscle: "splenius-cervicis", nerve: "posterior-rami-spinal-nerves", sourceRef: REVIEW_SOURCE },
    { id: "innervation-suboccipitals-suboccipital", muscle: "suboccipital-muscles", nerve: "suboccipital-nerve", sourceRef: REVIEW_SOURCE },
    { id: "innervation-semispinalis-capitis-posterior-rami", muscle: "semispinalis-capitis", nerve: "posterior-rami-spinal-nerves", sourceRef: REVIEW_SOURCE },
    { id: "innervation-erector-spinae-upper-thoracic-posterior-rami", muscle: "erector-spinae-upper-thoracic", nerve: "posterior-rami-spinal-nerves", sourceRef: REVIEW_SOURCE },
    { id: "innervation-pectoralis-minor-medial-pectoral", muscle: "pectoralis-minor", nerve: "medial-pectoral-nerve", description: "Medial pectoral nerve contribution to pectoralis minor.", sourceRef: "applied-human-anatomy" },
    { id: "innervation-subscapularis-subscapular", muscle: "subscapularis", nerve: "upper-lower-subscapular-nerves", sourceRef: REVIEW_SOURCE },
    { id: "innervation-teres-minor-axillary", muscle: "teres-minor", nerve: "axillary-nerve", sourceRef: REVIEW_SOURCE },
    { id: "innervation-teres-major-subscapular", muscle: "teres-major", nerve: "upper-lower-subscapular-nerves", sourceRef: REVIEW_SOURCE },
    { id: "innervation-latissimus-dorsi-thoracodorsal", muscle: "latissimus-dorsi", nerve: "thoracodorsal-nerve", sourceRef: REVIEW_SOURCE },
    { id: "innervation-pectoralis-major-clavicular-lateral-pectoral", muscle: "pectoralis-major-clavicular-head", nerve: "lateral-pectoral-nerve", description: "Lateral pectoral nerve contribution to clavicular fibers of pectoralis major.", sourceRef: "applied-human-anatomy" },
    { id: "innervation-subclavius-nerve-to-subclavius", muscle: "subclavius", nerve: "nerve-to-subclavius", description: "Nerve to subclavius, commonly described with C5-C6 roots.", sourceRef: "applied-human-anatomy" },
  ],
  ligaments: [
    { id: "ligament-nuchal-ligament", slug: "nuchal-ligament", name: "Nuchal Ligament", region: "head-neck", joint: "cervical-spine", sourceRef: REVIEW_SOURCE },
    { id: "ligament-alar-ligament", slug: "alar-ligament", name: "Alar Ligament", region: "head-neck", joint: "atlanto-occipital", sourceRef: REVIEW_SOURCE },
    { id: "ligament-transverse-ligament-of-atlas", slug: "transverse-ligament-of-atlas", name: "Transverse Ligament of Atlas", region: "head-neck", joint: "cervical-spine", sourceRef: REVIEW_SOURCE },
    { id: "ligament-acromioclavicular-ligament", slug: "acromioclavicular-ligament", name: "Acromioclavicular Ligament", region: "shoulder-girdle", joint: "acromioclavicular", sourceRef: REVIEW_SOURCE },
    { id: "ligament-coracoclavicular-ligament", slug: "coracoclavicular-ligament", name: "Coracoclavicular Ligament", region: "shoulder-girdle", joint: "acromioclavicular", sourceRef: REVIEW_SOURCE },
    { id: "ligament-coracoacromial-ligament", slug: "coracoacromial-ligament", name: "Coracoacromial Ligament", region: "shoulder-girdle", joint: "glenohumeral", sourceRef: REVIEW_SOURCE },
    { id: "ligament-coracohumeral-ligament", slug: "coracohumeral-ligament", name: "Coracohumeral Ligament", region: "shoulder-girdle", joint: "glenohumeral", sourceRef: REVIEW_SOURCE },
    { id: "ligament-glenohumeral-ligaments", slug: "glenohumeral-ligaments", name: "Glenohumeral Ligaments", region: "shoulder-girdle", joint: "glenohumeral", sourceRef: REVIEW_SOURCE },
    { id: "ligament-sternoclavicular-ligaments", slug: "sternoclavicular-ligaments", name: "Sternoclavicular Ligaments", region: "shoulder-girdle", joint: "sternoclavicular", sourceRef: REVIEW_SOURCE },
    { id: "ligament-costoclavicular-ligament", slug: "costoclavicular-ligament", name: "Costoclavicular Ligament", region: "shoulder-girdle", joint: "sternoclavicular", sourceRef: REVIEW_SOURCE },
  ],
  bloodSupply: [
    { id: "blood-transverse-cervical-artery", slug: "transverse-cervical-artery", name: "Transverse Cervical Artery", kind: "artery", region: "neck-shoulder-upper-back", sourceRef: REVIEW_SOURCE },
    { id: "blood-dorsal-scapular-artery", slug: "dorsal-scapular-artery", name: "Dorsal Scapular Artery", kind: "artery", region: "upper-back", sourceRef: REVIEW_SOURCE },
    { id: "blood-suprascapular-artery", slug: "suprascapular-artery", name: "Suprascapular Artery", kind: "artery", region: "shoulder-girdle", sourceRef: REVIEW_SOURCE },
    { id: "blood-posterior-circumflex-humeral-artery", slug: "posterior-circumflex-humeral-artery", name: "Posterior Circumflex Humeral Artery", kind: "artery", region: "shoulder-girdle", sourceRef: REVIEW_SOURCE },
    { id: "blood-external-jugular-vein", slug: "external-jugular-vein", name: "External Jugular Vein", kind: "vein", region: "head-neck", sourceRef: REVIEW_SOURCE },
    { id: "blood-subclavian-artery", slug: "subclavian-artery", name: "Subclavian Artery", kind: "artery", region: "neck-shoulder-upper-back", description: "Major artery of the neck and shoulder-girdle region that gives rise to branches supplying the upper limb and shoulder girdle.", sourceRef: "applied-human-anatomy" },
    { id: "blood-axillary-artery", slug: "axillary-artery", name: "Axillary Artery", kind: "artery", region: "shoulder-girdle", sourceRef: REVIEW_SOURCE },
    { id: "blood-circumflex-scapular-artery", slug: "circumflex-scapular-artery", name: "Circumflex Scapular Artery", kind: "artery", region: "shoulder-girdle", sourceRef: REVIEW_SOURCE },
    { id: "blood-thoracodorsal-artery", slug: "thoracodorsal-artery", name: "Thoracodorsal Artery", kind: "artery", region: "upper-back", sourceRef: REVIEW_SOURCE },
    { id: "blood-lateral-thoracic-artery", slug: "lateral-thoracic-artery", name: "Lateral Thoracic Artery", kind: "artery", region: "shoulder-girdle", description: "Axillary artery branch contributing to lateral thoracic wall, pectoral, and serratus anterior region supply.", sourceRef: "applied-human-anatomy" },
    { id: "blood-thoracoacromial-artery", slug: "thoracoacromial-artery", name: "Thoracoacromial Artery", kind: "artery", region: "shoulder-girdle", description: "Axillary artery branch with pectoral and clavicular-region branches supplying the anterior shoulder and pectoral region.", sourceRef: "applied-human-anatomy" },
    { id: "blood-cephalic-vein", slug: "cephalic-vein", name: "Cephalic Vein", kind: "vein", region: "shoulder-girdle", sourceRef: REVIEW_SOURCE },
  ],
  structures: [],
  concepts: [],
  painMapRegions: [
    { id: "painmap-base-of-skull", slug: "base-of-skull", name: "Base of Skull", region: "base-of-skull", plainLanguageDescription: "Back of the head where the skull meets the neck.", sourceRef: STARTER_SOURCE },
    { id: "painmap-posterior-neck", slug: "posterior-neck", name: "Posterior Neck", region: "posterior-neck", sourceRef: STARTER_SOURCE },
    { id: "painmap-top-of-shoulder", slug: "top-of-shoulder", name: "Top of Shoulder", region: "upper-trapezius-area", sourceRef: STARTER_SOURCE },
    { id: "painmap-medial-scapular-border", slug: "medial-scapular-border", name: "Medial Scapular Border", region: "scapular-region", sourceRef: STARTER_SOURCE },
    { id: "painmap-between-shoulder-blades", slug: "between-shoulder-blades", name: "Between Shoulder Blades", region: "scapular-region", sourceRef: STARTER_SOURCE },
    { id: "painmap-lateral-shoulder", slug: "lateral-shoulder", name: "Lateral Shoulder", region: "glenohumeral-region", sourceRef: STARTER_SOURCE },
    { id: "painmap-posterior-shoulder", slug: "posterior-shoulder", name: "Posterior Shoulder", region: "rotator-cuff-region", plainLanguageDescription: "Back of shoulder near posterior rotator cuff and teres region.", sourceRef: STARTER_SOURCE },
    { id: "painmap-anterior-shoulder", slug: "anterior-shoulder", name: "Anterior Shoulder", region: "glenohumeral-region", plainLanguageDescription: "Front of shoulder and upper chest-shoulder border.", sourceRef: STARTER_SOURCE },
    { id: "painmap-lateral-neck", slug: "lateral-neck", name: "Lateral Neck", region: "lateral-neck", sourceRef: STARTER_SOURCE },
    { id: "painmap-upper-thoracic-spine", slug: "upper-thoracic-spine", name: "Upper Thoracic Spine", region: "thoracic-spine-region", sourceRef: STARTER_SOURCE },
  ],
  clientTerms: [
    { id: "client-term-neck-tightness", slug: "neck-tightness", term: "neck tightness", plainLanguageDescription: "Client language for a tight or restricted neck feeling.", mappedRegionSlug: "posterior-neck", mappedJointSlug: "cervical-spine", confidence: "broad", notes: "Non-diagnostic language mapping.", clinicalUse: "non-diagnostic", likelyRegions: ["posterior-neck", "lateral-neck"], likelyStructures: ["cervical-spine", "levator-scapulae", "upper-trapezius"], therapistPrompt: "Use as a conversation starter, then choose clinically relevant structures from assessment findings.", sourceRef: STARTER_SOURCE },
    { id: "client-term-between-shoulder-blades", slug: "between-shoulder-blades", term: "between my shoulder blades", label: "between my shoulder blades", plainLanguageDescription: "Client language for the medial scapular or interscapular region.", mappedRegionSlug: "scapular-region", confidence: "likely", clinicalUse: "non-diagnostic", likelyRegions: ["scapular-region"], likelyStructures: ["rhomboid-major", "levator-scapulae", "upper-trapezius"], therapistPrompt: "Use as a conversation starter, then choose clinically relevant structures from assessment findings.", sourceRef: STARTER_SOURCE },
    { id: "client-term-top-of-shoulder", slug: "top-of-shoulder", term: "top of shoulder", plainLanguageDescription: "Client language often pointing to the upper trapezius area.", mappedRegionSlug: "upper-trapezius-area", mappedMuscleSlug: "upper-trapezius", confidence: "likely", clinicalUse: "non-diagnostic", likelyRegions: ["upper-trapezius-area"], likelyStructures: ["upper-trapezius", "levator-scapulae"], therapistPrompt: "Use as a conversation starter, then choose clinically relevant structures from assessment findings.", sourceRef: STARTER_SOURCE },
    { id: "client-term-base-of-skull", slug: "base-of-skull", term: "base of skull", plainLanguageDescription: "Client language for the occipital/suboccipital border area.", mappedRegionSlug: "base-of-skull", confidence: "likely", clinicalUse: "non-diagnostic", likelyRegions: ["base-of-skull"], likelyStructures: ["occipital-bone", "atlanto-occipital", "upper-trapezius"], therapistPrompt: "Use as a conversation starter, then choose clinically relevant structures from assessment findings.", sourceRef: STARTER_SOURCE },
    { id: "client-term-shoulder-blade-area", slug: "shoulder-blade-area", term: "shoulder blade area", plainLanguageDescription: "Client language for scapular region.", mappedRegionSlug: "scapular-region", confidence: "broad", clinicalUse: "non-diagnostic", likelyRegions: ["scapular-region"], likelyStructures: ["scapula", "rhomboid-major", "serratus-anterior"], therapistPrompt: "Use as a conversation starter, then choose clinically relevant structures from assessment findings.", sourceRef: STARTER_SOURCE },
    { id: "client-term-knot-by-shoulder-blade", slug: "knot-by-shoulder-blade", term: "knot by shoulder blade", plainLanguageDescription: "Client language for a localized sensation near the scapula.", mappedRegionSlug: "scapular-region", confidence: "broad", clinicalUse: "non-diagnostic", likelyRegions: ["scapular-region"], likelyStructures: ["levator-scapulae", "rhomboid-major", "upper-trapezius", "dorsal-scapular-nerve"], therapistPrompt: "Use as a conversation starter, then choose clinically relevant structures from assessment findings.", sourceRef: STARTER_SOURCE },
    { id: "client-term-tight-traps", slug: "tight-traps", term: "tight traps", plainLanguageDescription: "Client language often pointing to upper trapezius area.", mappedRegionSlug: "upper-trapezius-area", mappedMuscleSlug: "upper-trapezius", confidence: "likely", clinicalUse: "non-diagnostic", likelyRegions: ["upper-trapezius-area"], likelyStructures: ["upper-trapezius", "accessory-nerve"], therapistPrompt: "Use as a conversation starter, then choose clinically relevant structures from assessment findings.", sourceRef: STARTER_SOURCE },
    { id: "client-term-pain-when-turning-head", slug: "pain-when-turning-head", term: "pain when turning head", plainLanguageDescription: "Client language connected to cervical rotation movement.", mappedRegionSlug: "posterior-neck", mappedJointSlug: "cervical-spine", confidence: "broad", clinicalUse: "non-diagnostic", likelyRegions: ["posterior-neck", "lateral-neck"], likelyStructures: ["cervical-spine", "sternocleidomastoid", "scalenes", "levator-scapulae"], therapistPrompt: "Use as a conversation starter, then choose clinically relevant structures from assessment findings.", sourceRef: STARTER_SOURCE },
    { id: "client-term-limited-shoulder-mobility", slug: "limited-shoulder-mobility", term: "limited shoulder mobility", plainLanguageDescription: "Client language for restricted shoulder movement.", mappedRegionSlug: "glenohumeral-region", mappedJointSlug: "glenohumeral", confidence: "broad", clinicalUse: "non-diagnostic", likelyRegions: ["glenohumeral-region", "scapular-region"], likelyStructures: ["glenohumeral", "scapulothoracic", "supraspinatus", "infraspinatus", "deltoid"], therapistPrompt: "Use as a conversation starter, then choose clinically relevant structures from assessment findings.", sourceRef: STARTER_SOURCE },
    { id: "client-term-neck-tension", slug: "neck-tension", term: "neck tension", plainLanguageDescription: "Client language for tension around posterior or lateral neck.", mappedRegionSlug: "posterior-neck", confidence: "broad", clinicalUse: "non-diagnostic", likelyRegions: ["posterior-neck", "upper-trapezius-area"], likelyStructures: ["upper-trapezius", "levator-scapulae", "nuchal-ligament"], therapistPrompt: "Use as a conversation starter, then choose clinically relevant structures from assessment findings.", sourceRef: STARTER_SOURCE },
    { id: "client-term-shoulder-blade-pain", slug: "shoulder-blade-pain", term: "shoulder blade pain", plainLanguageDescription: "Client language for pain in or around the scapular area.", mappedRegionSlug: "scapular-region", confidence: "broad", clinicalUse: "non-diagnostic", likelyRegions: ["scapular-region"], likelyStructures: ["scapula", "rhomboid-major", "serratus-anterior", "scapulothoracic"], therapistPrompt: "Use as a conversation starter, then choose clinically relevant structures from assessment findings.", sourceRef: STARTER_SOURCE },
    { id: "client-term-knot-in-shoulder", slug: "knot-in-shoulder", term: "knot in shoulder", plainLanguageDescription: "Client language for local shoulder-area discomfort.", mappedRegionSlug: "upper-trapezius-area", confidence: "broad", clinicalUse: "non-diagnostic", likelyRegions: ["upper-trapezius-area", "glenohumeral-region"], likelyStructures: ["upper-trapezius", "deltoid", "glenohumeral"], therapistPrompt: "Use as a conversation starter, then choose clinically relevant structures from assessment findings.", sourceRef: STARTER_SOURCE },
    { id: "client-term-rotator-cuff-area", slug: "rotator-cuff-area", term: "rotator cuff area", plainLanguageDescription: "Client language for the shoulder muscles that help stabilize and rotate the arm.", mappedRegionSlug: "rotator-cuff-region", confidence: "broad", clinicalUse: "non-diagnostic", likelyRegions: ["rotator-cuff-region", "glenohumeral-region"], likelyStructures: ["supraspinatus", "infraspinatus", "subscapularis", "teres-minor"], therapistPrompt: "Use as a conversation starter, then choose clinically relevant structures from assessment findings.", sourceRef: STARTER_SOURCE },
    { id: "client-term-front-of-shoulder", slug: "front-of-shoulder", term: "front of shoulder", plainLanguageDescription: "Client language for anterior shoulder or pectoral shoulder border.", mappedRegionSlug: "glenohumeral-region", mappedJointSlug: "glenohumeral", confidence: "broad", clinicalUse: "non-diagnostic", likelyRegions: ["glenohumeral-region"], likelyStructures: ["pectoralis-minor", "pectoralis-major-clavicular-head", "subscapularis", "glenohumeral"], therapistPrompt: "Use as a conversation starter, then choose clinically relevant structures from assessment findings.", sourceRef: STARTER_SOURCE },
    { id: "client-term-back-of-shoulder", slug: "back-of-shoulder", term: "back of shoulder", plainLanguageDescription: "Client language for posterior shoulder and rotator cuff area.", mappedRegionSlug: "rotator-cuff-region", confidence: "broad", clinicalUse: "non-diagnostic", likelyRegions: ["rotator-cuff-region", "scapular-region"], likelyStructures: ["infraspinatus", "teres-minor", "teres-major", "posterior-circumflex-humeral-artery"], therapistPrompt: "Use as a conversation starter, then choose clinically relevant structures from assessment findings.", sourceRef: STARTER_SOURCE },
    { id: "client-term-shoulder-feels-stuck", slug: "shoulder-feels-stuck", term: "shoulder feels stuck", plainLanguageDescription: "Client language for restricted shoulder movement.", mappedRegionSlug: "glenohumeral-region", mappedJointSlug: "glenohumeral", confidence: "broad", clinicalUse: "non-diagnostic", likelyRegions: ["glenohumeral-region", "scapular-region"], likelyStructures: ["glenohumeral", "scapulothoracic", "rotator-cuff-region"], therapistPrompt: "Use as a conversation starter, then choose clinically relevant structures from assessment findings.", sourceRef: STARTER_SOURCE },
    { id: "client-term-neck-stiffness", slug: "neck-stiffness", term: "neck stiffness", plainLanguageDescription: "Client language for reduced ease moving the neck.", mappedRegionSlug: "posterior-neck", mappedJointSlug: "cervical-spine", confidence: "broad", clinicalUse: "non-diagnostic", likelyRegions: ["posterior-neck", "lateral-neck", "base-of-skull"], likelyStructures: ["cervical-spine", "splenius-capitis", "semispinalis-capitis", "suboccipital-muscles"], therapistPrompt: "Use as a conversation starter, then choose clinically relevant structures from assessment findings.", sourceRef: STARTER_SOURCE },
    { id: "client-term-under-shoulder-blade", slug: "under-shoulder-blade", term: "under my shoulder blade", plainLanguageDescription: "Client language for sensations deep to or along the scapula.", mappedRegionSlug: "scapular-region", confidence: "broad", clinicalUse: "non-diagnostic", likelyRegions: ["scapular-region"], likelyStructures: ["subscapularis", "serratus-anterior", "scapula"], therapistPrompt: "Use as a conversation starter, then choose clinically relevant structures from assessment findings.", sourceRef: STARTER_SOURCE },
    { id: "client-term-collarbone-area", slug: "collarbone-area", term: "collarbone area", plainLanguageDescription: "Client language for the clavicle and sternoclavicular/acromioclavicular region.", mappedRegionSlug: "shoulder-girdle", confidence: "broad", clinicalUse: "non-diagnostic", likelyRegions: ["shoulder-girdle", "upper-trapezius-area"], likelyStructures: ["clavicle", "sternoclavicular", "acromioclavicular", "subclavius"], therapistPrompt: "Use as a conversation starter, then choose clinically relevant structures from assessment findings.", sourceRef: STARTER_SOURCE },
    { id: "client-term-pinching-in-shoulder", slug: "pinching-in-shoulder", term: "pinching in shoulder", plainLanguageDescription: "Client language for a pinch-like shoulder sensation.", mappedRegionSlug: "glenohumeral-region", mappedJointSlug: "glenohumeral", confidence: "broad", clinicalUse: "non-diagnostic", likelyRegions: ["glenohumeral-region", "rotator-cuff-region"], likelyStructures: ["glenohumeral", "supraspinatus", "coracoacromial-ligament"], therapistPrompt: "Use as a conversation starter, then choose clinically relevant structures from assessment findings.", sourceRef: STARTER_SOURCE },
  ],
  entityTerms: [
    { id: "term-upper-trapezius-preferred", anatomyEntityType: "muscle", anatomyEntitySlug: "upper-trapezius", term: "Upper Trapezius", termType: "preferred", sourceRef: REVIEW_SOURCE },
    { id: "term-upper-trapezius-formal", anatomyEntityType: "muscle", anatomyEntitySlug: "upper-trapezius", term: "Trapezius, superior fibers", termType: "formal", languageOfOrigin: "Greek", sourceRef: REVIEW_SOURCE },
    { id: "term-upper-trap-common", anatomyEntityType: "muscle", anatomyEntitySlug: "upper-trapezius", term: "upper trap", termType: "common", sourceRef: STARTER_SOURCE },
    { id: "term-scm-abbreviation", anatomyEntityType: "muscle", anatomyEntitySlug: "sternocleidomastoid", term: "SCM", termType: "abbreviation", sourceRef: REVIEW_SOURCE },
    { id: "term-scapula-common", anatomyEntityType: "bone", anatomyEntitySlug: "scapula", term: "shoulder blade", termType: "common", sourceRef: STARTER_SOURCE },
    { id: "term-clavicle-common", anatomyEntityType: "bone", anatomyEntitySlug: "clavicle", term: "collarbone", termType: "common", sourceRef: STARTER_SOURCE },
    { id: "term-accessory-nerve-abbreviation", anatomyEntityType: "nerve", anatomyEntitySlug: "accessory-nerve", term: "CN XI", termType: "abbreviation", sourceRef: REVIEW_SOURCE },
    { id: "term-levator-scapulae-common", anatomyEntityType: "muscle", anatomyEntitySlug: "levator-scapulae", term: "levator scap", termType: "common", sourceRef: STARTER_SOURCE },
    { id: "term-middle-trapezius-common", anatomyEntityType: "muscle", anatomyEntitySlug: "middle-trapezius", term: "middle trap", termType: "common", sourceRef: STARTER_SOURCE },
    { id: "term-lower-trapezius-common", anatomyEntityType: "muscle", anatomyEntitySlug: "lower-trapezius", term: "lower trap", termType: "common", sourceRef: STARTER_SOURCE },
    { id: "term-rhomboid-major-formal", anatomyEntityType: "muscle", anatomyEntitySlug: "rhomboid-major", term: "Rhomboideus major", termType: "formal", sourceRef: REVIEW_SOURCE },
    { id: "term-rhomboid-minor-formal", anatomyEntityType: "muscle", anatomyEntitySlug: "rhomboid-minor", term: "Rhomboideus minor", termType: "formal", sourceRef: REVIEW_SOURCE },
    { id: "term-splenius-capitis-formal", anatomyEntityType: "muscle", anatomyEntitySlug: "splenius-capitis", term: "Splenius capitis", termType: "formal", languageOfOrigin: "Latin", sourceRef: REVIEW_SOURCE },
    { id: "term-suboccipitals-common", anatomyEntityType: "muscle", anatomyEntitySlug: "suboccipital-muscles", term: "suboccipitals", termType: "common", sourceRef: STARTER_SOURCE },
    { id: "term-cervical-paraspinals-clinical", anatomyEntityType: "region", anatomyEntitySlug: "posterior-neck", term: "cervical paraspinals", termType: "clinical", sourceRef: STARTER_SOURCE },
    { id: "term-rotator-cuff-supraspinatus", anatomyEntityType: "muscle", anatomyEntitySlug: "supraspinatus", term: "rotator cuff", termType: "common", sourceRef: STARTER_SOURCE },
    { id: "term-rotator-cuff-infraspinatus", anatomyEntityType: "muscle", anatomyEntitySlug: "infraspinatus", term: "rotator cuff", termType: "common", sourceRef: STARTER_SOURCE },
    { id: "term-rotator-cuff-subscapularis", anatomyEntityType: "muscle", anatomyEntitySlug: "subscapularis", term: "rotator cuff", termType: "common", sourceRef: STARTER_SOURCE },
    { id: "term-rotator-cuff-teres-minor", anatomyEntityType: "muscle", anatomyEntitySlug: "teres-minor", term: "rotator cuff", termType: "common", sourceRef: STARTER_SOURCE },
    { id: "term-teres-minor-formal", anatomyEntityType: "muscle", anatomyEntitySlug: "teres-minor", term: "Teres minor", termType: "formal", sourceRef: REVIEW_SOURCE },
    { id: "term-teres-major-formal", anatomyEntityType: "muscle", anatomyEntitySlug: "teres-major", term: "Teres major", termType: "formal", sourceRef: REVIEW_SOURCE },
    { id: "term-deltoid-formal", anatomyEntityType: "muscle", anatomyEntitySlug: "deltoid", term: "Deltoideus", termType: "formal", languageOfOrigin: "Greek", sourceRef: REVIEW_SOURCE },
    { id: "term-serratus-anterior-formal", anatomyEntityType: "muscle", anatomyEntitySlug: "serratus-anterior", term: "Serratus anterior", termType: "formal", sourceRef: "fipat-ta2" },
    { id: "term-serratus-anterior-common-winging", anatomyEntityType: "muscle", anatomyEntitySlug: "serratus-anterior", term: "winging muscle", termType: "common", sourceRef: STARTER_SOURCE },
    { id: "term-latissimus-dorsi-common", anatomyEntityType: "muscle", anatomyEntitySlug: "latissimus-dorsi", term: "lat", termType: "common", sourceRef: STARTER_SOURCE },
    { id: "term-pectoralis-minor-formal", anatomyEntityType: "muscle", anatomyEntitySlug: "pectoralis-minor", term: "Pectoralis minor", termType: "formal", sourceRef: "fipat-ta2" },
    { id: "term-pectoralis-minor-common", anatomyEntityType: "muscle", anatomyEntitySlug: "pectoralis-minor", term: "pec minor", termType: "common", sourceRef: STARTER_SOURCE },
    { id: "term-pectoralis-major-clavicular-formal", anatomyEntityType: "muscle", anatomyEntitySlug: "pectoralis-major-clavicular-head", term: "Pars clavicularis musculi pectoralis majoris", termType: "formal", sourceRef: "fipat-ta2" },
    { id: "term-pectoralis-major-clavicular-common", anatomyEntityType: "muscle", anatomyEntitySlug: "pectoralis-major-clavicular-head", term: "clavicular pec major", termType: "common", sourceRef: STARTER_SOURCE },
    { id: "term-subclavius-formal", anatomyEntityType: "muscle", anatomyEntitySlug: "subclavius", term: "Subclavius", termType: "formal", sourceRef: "fipat-ta2" },
    { id: "term-subclavius-common-collarbone-stabilizer", anatomyEntityType: "muscle", anatomyEntitySlug: "subclavius", term: "collarbone stabilizer", termType: "common", sourceRef: STARTER_SOURCE },
    { id: "term-glenohumeral-common", anatomyEntityType: "joint", anatomyEntitySlug: "glenohumeral", term: "shoulder joint", termType: "common", sourceRef: STARTER_SOURCE },
    { id: "term-acromioclavicular-abbreviation", anatomyEntityType: "joint", anatomyEntitySlug: "acromioclavicular", term: "AC joint", termType: "abbreviation", sourceRef: STARTER_SOURCE },
    { id: "term-sternoclavicular-abbreviation", anatomyEntityType: "joint", anatomyEntitySlug: "sternoclavicular", term: "SC joint", termType: "abbreviation", sourceRef: STARTER_SOURCE },
    { id: "term-brachial-plexus-clinical", anatomyEntityType: "nerve", anatomyEntitySlug: "brachial-plexus", term: "brachial plexus", termType: "clinical", sourceRef: REVIEW_SOURCE },
  ],
  relationships: [
    { id: "relationship-blood-transverse-cervical-supplies-upper-trapezius", sourceEntityType: "blood_supply", sourceEntitySlug: "transverse-cervical-artery", relationshipType: "supplies", targetEntityType: "muscle", targetEntitySlug: "upper-trapezius", sourceRef: REVIEW_SOURCE },
    { id: "relationship-blood-dorsal-scapular-supplies-rhomboid", sourceEntityType: "blood_supply", sourceEntitySlug: "dorsal-scapular-artery", relationshipType: "supplies", targetEntityType: "muscle", targetEntitySlug: "rhomboid-major", sourceRef: REVIEW_SOURCE },
    { id: "relationship-blood-suprascapular-supplies-supraspinatus", sourceEntityType: "blood_supply", sourceEntitySlug: "suprascapular-artery", relationshipType: "supplies", targetEntityType: "muscle", targetEntitySlug: "supraspinatus", sourceRef: REVIEW_SOURCE },
    { id: "relationship-blood-suprascapular-supplies-infraspinatus", sourceEntityType: "blood_supply", sourceEntitySlug: "suprascapular-artery", relationshipType: "supplies", targetEntityType: "muscle", targetEntitySlug: "infraspinatus", sourceRef: REVIEW_SOURCE },
    { id: "relationship-blood-posterior-circumflex-supplies-deltoid", sourceEntityType: "blood_supply", sourceEntitySlug: "posterior-circumflex-humeral-artery", relationshipType: "supplies", targetEntityType: "muscle", targetEntitySlug: "deltoid", sourceRef: REVIEW_SOURCE },
    { id: "relationship-blood-transverse-cervical-supplies-trapezius-middle", sourceEntityType: "blood_supply", sourceEntitySlug: "transverse-cervical-artery", relationshipType: "supplies", targetEntityType: "muscle", targetEntitySlug: "middle-trapezius", sourceRef: REVIEW_SOURCE },
    { id: "relationship-blood-transverse-cervical-supplies-trapezius-lower", sourceEntityType: "blood_supply", sourceEntitySlug: "transverse-cervical-artery", relationshipType: "supplies", targetEntityType: "muscle", targetEntitySlug: "lower-trapezius", sourceRef: REVIEW_SOURCE },
    { id: "relationship-blood-dorsal-scapular-supplies-rhomboid-minor", sourceEntityType: "blood_supply", sourceEntitySlug: "dorsal-scapular-artery", relationshipType: "supplies", targetEntityType: "muscle", targetEntitySlug: "rhomboid-minor", sourceRef: REVIEW_SOURCE },
    { id: "relationship-blood-circumflex-scapular-supplies-teres-major", sourceEntityType: "blood_supply", sourceEntitySlug: "circumflex-scapular-artery", relationshipType: "supplies", targetEntityType: "muscle", targetEntitySlug: "teres-major", sourceRef: REVIEW_SOURCE },
    { id: "relationship-blood-posterior-circumflex-supplies-teres-minor", sourceEntityType: "blood_supply", sourceEntitySlug: "posterior-circumflex-humeral-artery", relationshipType: "supplies", targetEntityType: "muscle", targetEntitySlug: "teres-minor", sourceRef: REVIEW_SOURCE },
    { id: "relationship-blood-thoracodorsal-supplies-latissimus", sourceEntityType: "blood_supply", sourceEntitySlug: "thoracodorsal-artery", relationshipType: "supplies", targetEntityType: "muscle", targetEntitySlug: "latissimus-dorsi", sourceRef: REVIEW_SOURCE },
    { id: "relationship-blood-lateral-thoracic-supplies-serratus", sourceEntityType: "blood_supply", sourceEntitySlug: "lateral-thoracic-artery", relationshipType: "supplies", targetEntityType: "muscle", targetEntitySlug: "serratus-anterior", sourceRef: "applied-human-anatomy" },
    { id: "relationship-blood-lateral-thoracic-supplies-pectoralis-minor", sourceEntityType: "blood_supply", sourceEntitySlug: "lateral-thoracic-artery", relationshipType: "supplies", targetEntityType: "muscle", targetEntitySlug: "pectoralis-minor", sourceRef: "applied-human-anatomy" },
    { id: "relationship-blood-thoracoacromial-supplies-pectoralis-major-clavicular", sourceEntityType: "blood_supply", sourceEntitySlug: "thoracoacromial-artery", relationshipType: "supplies", targetEntityType: "muscle", targetEntitySlug: "pectoralis-major-clavicular-head", sourceRef: "applied-human-anatomy" },
    { id: "relationship-blood-subclavian-supplies-subclavius", sourceEntityType: "blood_supply", sourceEntitySlug: "subclavian-artery", relationshipType: "supplies", targetEntityType: "muscle", targetEntitySlug: "subclavius", sourceRef: "applied-human-anatomy" },
    { id: "relationship-depth-serratus-superficial-to-subscapularis", sourceEntityType: "muscle", sourceEntitySlug: "serratus-anterior", relationshipType: "superficial_to", targetEntityType: "muscle", targetEntitySlug: "subscapularis", sourceRef: "applied-human-anatomy" },
    { id: "relationship-depth-subscapularis-deep-to-serratus", sourceEntityType: "muscle", sourceEntitySlug: "subscapularis", relationshipType: "deep_to", targetEntityType: "muscle", targetEntitySlug: "serratus-anterior", sourceRef: "applied-human-anatomy" },
    { id: "relationship-depth-pectoralis-major-superficial-to-pectoralis-minor", sourceEntityType: "muscle", sourceEntitySlug: "pectoralis-major-clavicular-head", relationshipType: "superficial_to", targetEntityType: "muscle", targetEntitySlug: "pectoralis-minor", sourceRef: "applied-human-anatomy" },
    { id: "relationship-depth-pectoralis-minor-deep-to-pectoralis-major", sourceEntityType: "muscle", sourceEntitySlug: "pectoralis-minor", relationshipType: "deep_to", targetEntityType: "muscle", targetEntitySlug: "pectoralis-major-clavicular-head", sourceRef: "applied-human-anatomy" },
    { id: "relationship-depth-deltoid-superficial-to-infraspinatus", sourceEntityType: "muscle", sourceEntitySlug: "deltoid", relationshipType: "superficial_to", targetEntityType: "muscle", targetEntitySlug: "infraspinatus", sourceRef: REVIEW_SOURCE },
    { id: "relationship-depth-infraspinatus-deep-to-deltoid", sourceEntityType: "muscle", sourceEntitySlug: "infraspinatus", relationshipType: "deep_to", targetEntityType: "muscle", targetEntitySlug: "deltoid", sourceRef: REVIEW_SOURCE },
    { id: "relationship-depth-latissimus-superficial-to-teres-major", sourceEntityType: "muscle", sourceEntitySlug: "latissimus-dorsi", relationshipType: "superficial_to", targetEntityType: "muscle", targetEntitySlug: "teres-major", sourceRef: REVIEW_SOURCE },
    { id: "relationship-depth-teres-major-deep-to-latissimus", sourceEntityType: "muscle", sourceEntitySlug: "teres-major", relationshipType: "deep_to", targetEntityType: "muscle", targetEntitySlug: "latissimus-dorsi", sourceRef: REVIEW_SOURCE },
    { id: "relationship-depth-upper-trapezius-superficial-to-levator", sourceEntityType: "muscle", sourceEntitySlug: "upper-trapezius", relationshipType: "superficial_to", targetEntityType: "muscle", targetEntitySlug: "levator-scapulae", sourceRef: REVIEW_SOURCE },
    { id: "relationship-depth-levator-deep-to-upper-trapezius", sourceEntityType: "muscle", sourceEntitySlug: "levator-scapulae", relationshipType: "deep_to", targetEntityType: "muscle", targetEntitySlug: "upper-trapezius", sourceRef: REVIEW_SOURCE },
    { id: "relationship-brachial-plexus-includes-axillary", sourceEntityType: "nerve", sourceEntitySlug: "brachial-plexus", relationshipType: "includes_branch", targetEntityType: "nerve", targetEntitySlug: "axillary-nerve", sourceRef: REVIEW_SOURCE },
    { id: "relationship-brachial-plexus-includes-suprascapular", sourceEntityType: "nerve", sourceEntitySlug: "brachial-plexus", relationshipType: "includes_branch", targetEntityType: "nerve", targetEntitySlug: "suprascapular-nerve", sourceRef: REVIEW_SOURCE },
    { id: "relationship-brachial-plexus-includes-long-thoracic", sourceEntityType: "nerve", sourceEntitySlug: "brachial-plexus", relationshipType: "includes_branch", targetEntityType: "nerve", targetEntitySlug: "long-thoracic-nerve", sourceRef: REVIEW_SOURCE },
    { id: "relationship-brachial-plexus-includes-thoracodorsal", sourceEntityType: "nerve", sourceEntitySlug: "brachial-plexus", relationshipType: "includes_branch", targetEntityType: "nerve", targetEntitySlug: "thoracodorsal-nerve", sourceRef: REVIEW_SOURCE },
    { id: "relationship-brachial-plexus-includes-subscapular", sourceEntityType: "nerve", sourceEntitySlug: "brachial-plexus", relationshipType: "includes_branch", targetEntityType: "nerve", targetEntitySlug: "upper-lower-subscapular-nerves", sourceRef: REVIEW_SOURCE },
    { id: "relationship-brachial-plexus-affects-lateral-shoulder", sourceEntityType: "nerve", sourceEntitySlug: "brachial-plexus", relationshipType: "may_affect_region", targetEntityType: "pain_map_region", targetEntitySlug: "lateral-shoulder", sourceRef: STARTER_SOURCE },
    { id: "relationship-brachial-plexus-affects-posterior-shoulder", sourceEntityType: "nerve", sourceEntitySlug: "brachial-plexus", relationshipType: "may_affect_region", targetEntityType: "pain_map_region", targetEntitySlug: "posterior-shoulder", sourceRef: STARTER_SOURCE },
    { id: "relationship-brachial-plexus-affects-anterior-shoulder", sourceEntityType: "nerve", sourceEntitySlug: "brachial-plexus", relationshipType: "may_affect_region", targetEntityType: "pain_map_region", targetEntitySlug: "anterior-shoulder", sourceRef: STARTER_SOURCE },
    { id: "relationship-painmap-between-shoulders-overlaps-scapular", sourceEntityType: "pain_map_region", sourceEntitySlug: "between-shoulder-blades", relationshipType: "overlaps_region", targetEntityType: "region", targetEntitySlug: "scapular-region", sourceRef: STARTER_SOURCE },
    { id: "relationship-painmap-top-shoulder-overlaps-upper-trap", sourceEntityType: "pain_map_region", sourceEntitySlug: "top-of-shoulder", relationshipType: "overlaps_region", targetEntityType: "region", targetEntitySlug: "upper-trapezius-area", sourceRef: STARTER_SOURCE },
    { id: "relationship-painmap-medial-border-overlaps-scapular", sourceEntityType: "pain_map_region", sourceEntitySlug: "medial-scapular-border", relationshipType: "overlaps_region", targetEntityType: "region", targetEntitySlug: "scapular-region", sourceRef: STARTER_SOURCE },
    { id: "relationship-painmap-posterior-shoulder-overlaps-rotator-cuff", sourceEntityType: "pain_map_region", sourceEntitySlug: "posterior-shoulder", relationshipType: "overlaps_region", targetEntityType: "region", targetEntitySlug: "rotator-cuff-region", sourceRef: STARTER_SOURCE },
    { id: "relationship-painmap-lateral-neck-overlaps-lateral-neck", sourceEntityType: "pain_map_region", sourceEntitySlug: "lateral-neck", relationshipType: "overlaps_region", targetEntityType: "region", targetEntitySlug: "lateral-neck", sourceRef: STARTER_SOURCE },
    { id: "relationship-painmap-upper-thoracic-overlaps-thoracic-spine", sourceEntityType: "pain_map_region", sourceEntitySlug: "upper-thoracic-spine", relationshipType: "overlaps_region", targetEntityType: "region", targetEntitySlug: "thoracic-spine-region", sourceRef: STARTER_SOURCE },
  ],
  citations: [
    { id: "citation-scapula-uberon-definition", slug: "citation-scapula-uberon-definition", entityType: "bone", entitySlug: "scapula", factType: "definition", sourceRef: "ols-uberon", sourceLocator: "UBERON:0006849", citationNote: "UBERON scapula term used for ontology alignment and broad anatomical definition.", reviewStatus: "reviewed" },
    { id: "citation-scapula-fma-identifier", slug: "citation-scapula-fma-identifier", entityType: "bone", entitySlug: "scapula", factType: "external_identifier", sourceRef: "bioportal-fma", sourceLocator: "FMA:13394", citationNote: "BioPortal FMA scapula identifier used for external cross-reference.", reviewStatus: "reviewed" },
    { id: "citation-clavicle-uberon-definition", slug: "citation-clavicle-uberon-definition", entityType: "bone", entitySlug: "clavicle", factType: "definition", sourceRef: "ols-uberon", sourceLocator: "UBERON:0001105", citationNote: "UBERON clavicle bone term used for ontology alignment.", reviewStatus: "reviewed" },
    { id: "citation-humerus-uberon-definition", slug: "citation-humerus-uberon-definition", entityType: "bone", entitySlug: "humerus", factType: "definition", sourceRef: "ols-uberon", sourceLocator: "UBERON:0000976", citationNote: "UBERON humerus term used for ontology alignment.", reviewStatus: "reviewed" },
    { id: "citation-acromion-uberon-definition", slug: "citation-acromion-uberon-definition", entityType: "bone_landmark", entitySlug: "acromion", factType: "definition", sourceRef: "ols-uberon", sourceLocator: "UBERON:0002497", citationNote: "UBERON acromion term used for scapular landmark alignment.", reviewStatus: "reviewed" },
    { id: "citation-spine-scapula-uberon-definition", slug: "citation-spine-scapula-uberon-definition", entityType: "bone_landmark", entitySlug: "spine-of-scapula", factType: "definition", sourceRef: "ols-uberon", sourceLocator: "UBERON:0004651", citationNote: "UBERON scapula spine term used for scapular landmark alignment.", reviewStatus: "reviewed" },
    { id: "citation-glenoid-cavity-uberon-definition", slug: "citation-glenoid-cavity-uberon-definition", entityType: "bone_landmark", entitySlug: "glenoid-cavity", factType: "definition", sourceRef: "ols-uberon", sourceLocator: "UBERON:0006657", citationNote: "UBERON glenoid fossa term used for glenoid landmark alignment.", reviewStatus: "reviewed" },
    { id: "citation-bodyparts3d-scapula-media", slug: "citation-bodyparts3d-scapula-media", entityType: "bone", entitySlug: "scapula", factType: "media_source", factSlug: "bodyparts3d-scapula-reference", sourceRef: "bodyparts3d", sourceLocator: "BodyParts3D download/API documentation", citationNote: "Open-license BodyParts3D source record for future scapula media/model import.", reviewStatus: "reviewed" },
    { id: "citation-wikimedia-gray-scapula-candidate-media-source", slug: "citation-wikimedia-gray-scapula-candidate-media-source", entityType: "bone", entitySlug: "scapula", factType: "media_source", factSlug: "wikimedia-gray-scapula-candidate", sourceRef: "wikimedia-commons", sourceLocator: "https://commons.wikimedia.org/wiki/Category:Scapula", citationNote: "Review-only Wikimedia category candidate. Exact file, license, author, and attribution must be selected before public use.", reviewStatus: "needs_review" },
    ...BASE_SHOULDER_CHEST_REVIEWED_MUSCLE_CITATIONS,
  ],
  externalIdentifiers: [
    { id: "external-id-scapula-uberon", entityType: "bone", entitySlug: "scapula", provider: "UBERON", identifier: "UBERON:0006849", iri: "http://purl.obolibrary.org/obo/UBERON_0006849", label: "scapula", sourceRef: "ols-uberon" },
    { id: "external-id-scapula-fma", entityType: "bone", entitySlug: "scapula", provider: "FMA", identifier: "FMA:13394", iri: "http://purl.org/sig/ont/fma/fma13394", label: "Scapula", sourceRef: "bioportal-fma" },
    { id: "external-id-clavicle-uberon", entityType: "bone", entitySlug: "clavicle", provider: "UBERON", identifier: "UBERON:0001105", iri: "http://purl.obolibrary.org/obo/UBERON_0001105", label: "clavicle bone", sourceRef: "ols-uberon" },
    { id: "external-id-clavicle-fma", entityType: "bone", entitySlug: "clavicle", provider: "FMA", identifier: "FMA:13321", iri: "http://purl.org/sig/ont/fma/fma13321", label: "Clavicle", sourceRef: "bioportal-fma" },
    { id: "external-id-humerus-uberon", entityType: "bone", entitySlug: "humerus", provider: "UBERON", identifier: "UBERON:0000976", iri: "http://purl.obolibrary.org/obo/UBERON_0000976", label: "humerus", sourceRef: "ols-uberon" },
    { id: "external-id-humerus-fma", entityType: "bone", entitySlug: "humerus", provider: "FMA", identifier: "FMA:13303", iri: "http://purl.org/sig/ont/fma/fma13303", label: "Humerus", sourceRef: "bioportal-fma" },
    { id: "external-id-acromion-uberon", entityType: "bone_landmark", entitySlug: "acromion", provider: "UBERON", identifier: "UBERON:0002497", iri: "http://purl.obolibrary.org/obo/UBERON_0002497", label: "acromion", sourceRef: "ols-uberon" },
    { id: "external-id-acromion-fma", entityType: "bone_landmark", entitySlug: "acromion", provider: "FMA", identifier: "FMA:23260", iri: "http://purl.org/sig/ont/fma/fma23260", label: "Acromion", sourceRef: "bioportal-fma" },
    { id: "external-id-spine-scapula-uberon", entityType: "bone_landmark", entitySlug: "spine-of-scapula", provider: "UBERON", identifier: "UBERON:0004651", iri: "http://purl.obolibrary.org/obo/UBERON_0004651", label: "scapula spine", sourceRef: "ols-uberon" },
    { id: "external-id-glenoid-cavity-uberon", entityType: "bone_landmark", entitySlug: "glenoid-cavity", provider: "UBERON", identifier: "UBERON:0006657", iri: "http://purl.obolibrary.org/obo/UBERON_0006657", label: "glenoid fossa", sourceRef: "ols-uberon" },
    { id: "external-id-serratus-anterior-fma", entityType: "muscle", entitySlug: "serratus-anterior", provider: "FMA", identifier: "FMA:300762", iri: "http://purl.org/sig/ont/fma/fma300762", label: "Muscle body of serratus anterior", sourceRef: "bioportal-fma" },
    { id: "external-id-pectoralis-minor-uberon", entityType: "muscle", entitySlug: "pectoralis-minor", provider: "UBERON", identifier: "UBERON:0001100", iri: "http://purl.obolibrary.org/obo/UBERON_0001100", label: "pectoralis minor", sourceRef: "ols-uberon" },
    { id: "external-id-pectoralis-major-clavicular-uberon", entityType: "muscle", entitySlug: "pectoralis-major-clavicular-head", provider: "UBERON", identifier: "UBERON:0002381", iri: "http://purl.obolibrary.org/obo/UBERON_0002381", label: "pectoralis major", sourceRef: "ols-uberon" },
    { id: "external-id-subclavius-uberon", entityType: "muscle", entitySlug: "subclavius", provider: "UBERON", identifier: "UBERON:0008779", iri: "http://purl.obolibrary.org/obo/UBERON_0008779", label: "subclavius", sourceRef: "ols-uberon" },
  ],
  mediaAssets: [
    {
      id: "media-bodyparts3d-scapula-reference",
      slug: "bodyparts3d-scapula-reference",
      title: "BodyParts3D Scapula Reference",
      mediaType: "source_link",
      description: "Open-license source link for future scapula 3D model or rendered media import.",
      sourceRef: "bodyparts3d",
      sourceUrl: "https://dbarchive.biosciencedbc.jp/en/bodyparts3d/",
      remoteUrl: "https://dbarchive.biosciencedbc.jp/en/bodyparts3d/",
      license: "CC BY 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
      attribution: "BodyParts3D, Database Center for Life Science licensed under CC BY 4.0.",
      author: "Database Center for Life Science",
      usageScope: "open_reuse",
      reviewStatus: "reviewed" as AnatomyFactReviewStatus,
      format: "source_link",
      metadata: { importStatus: "candidate", assetFamily: "3d_model_or_render" },
    },
    {
      id: "media-bodyparts3d-shoulder-girdle-reference",
      slug: "bodyparts3d-shoulder-girdle-reference",
      title: "BodyParts3D Shoulder Girdle Reference",
      mediaType: "source_link",
      description: "Open-license source link for future shoulder girdle media/model import.",
      sourceRef: "bodyparts3d",
      sourceUrl: "https://dbarchive.biosciencedbc.jp/en/bodyparts3d/",
      remoteUrl: "https://dbarchive.biosciencedbc.jp/en/bodyparts3d/",
      license: "CC BY 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
      attribution: "BodyParts3D, Database Center for Life Science licensed under CC BY 4.0.",
      author: "Database Center for Life Science",
      usageScope: "open_reuse",
      reviewStatus: "reviewed" as AnatomyFactReviewStatus,
      format: "source_link",
      metadata: { importStatus: "candidate", assetFamily: "3d_model_or_render" },
    },
    {
      id: "media-wikimedia-gray-scapula-candidate",
      slug: "wikimedia-gray-scapula-candidate",
      title: "Wikimedia Commons Scapula Diagram Candidate",
      mediaType: "source_link",
      description: "Per-file Wikimedia Commons candidate link; must remain review-only until exact file license metadata is stored.",
      sourceRef: "wikimedia-commons",
      sourceUrl: "https://commons.wikimedia.org/wiki/Category:Scapula",
      remoteUrl: "https://commons.wikimedia.org/wiki/Category:Scapula",
      license: "Per-file license",
      licenseUrl: "https://commons.wikimedia.org/wiki/Commons:Licensing",
      attribution: "Wikimedia Commons per-file author and license required before public use.",
      usageScope: "review_only",
      reviewStatus: "needs_review",
      format: "source_link",
      metadata: { importStatus: "candidate", requiresPerFileLicense: true },
    },
  ],
  mediaEntityLinks: [
    { id: "media-link-bodyparts3d-scapula-bone", assetSlug: "bodyparts3d-scapula-reference", entityType: "bone", entitySlug: "scapula", role: "primary" },
    { id: "media-link-bodyparts3d-scapula-acromion", assetSlug: "bodyparts3d-scapula-reference", entityType: "bone_landmark", entitySlug: "acromion", role: "reference" },
    { id: "media-link-bodyparts3d-scapula-glenoid", assetSlug: "bodyparts3d-scapula-reference", entityType: "bone_landmark", entitySlug: "glenoid-cavity", role: "reference" },
    { id: "media-link-wikimedia-gray-scapula-candidate-bone", assetSlug: "wikimedia-gray-scapula-candidate", entityType: "bone", entitySlug: "scapula", role: "reference", notes: "Review-only candidate link; per-file Wikimedia license and attribution are not locked." },
    { id: "media-link-bodyparts3d-shoulder-region", assetSlug: "bodyparts3d-shoulder-girdle-reference", entityType: "region", entitySlug: "shoulder-girdle", role: "region_context" },
    { id: "media-link-bodyparts3d-glenohumeral-game", assetSlug: "bodyparts3d-shoulder-girdle-reference", entityType: "joint", entitySlug: "glenohumeral", role: "game_prompt" },
  ],
  spatialModels: [],
  spatialEntityMaps: [],
  movementVisualizations: [],
}

function uniqueStrings(values: string[]) {
  const seen = new Set<string>()
  return values.filter((value) => {
    const key = normalizeText(value)
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

function citationNaturalKey(citation: AnatomyCitation) {
  return [
    citation.entityType,
    citation.entitySlug,
    citation.factType,
    citation.factSlug ?? "",
    citation.sourceRef,
    citation.sourceLocator ?? "",
  ].join("|")
}

function citationAlreadyExists(citations: AnatomyCitation[], citation: AnatomyCitation) {
  const naturalKey = citationNaturalKey(citation)

  return citations.some((existingCitation) =>
    existingCitation.id === citation.id
    || existingCitation.slug === citation.slug
    || citationNaturalKey(existingCitation) === naturalKey)
}

function addCitation(citations: AnatomyCitation[], citation: AnatomyCitation) {
  if (!citationAlreadyExists(citations, citation)) {
    citations.push(citation)
  }
}

function reviewedLegacyCitation(
  muscleSlug: string,
  factType: string,
  factSlug: string | undefined,
  sourceRef: string,
  sourceLocator: string,
  citationNote: string,
): AnatomyCitation {
  const factSegment = factSlug ? `-${normalizeText(factSlug)}` : ""
  const id = `citation-${muscleSlug}-${normalizeText(factType)}${factSegment}-reviewed`

  return {
    id,
    slug: id,
    entityType: "muscle",
    entitySlug: muscleSlug,
    factType,
    factSlug,
    sourceRef,
    sourceLocator,
    citationNote,
    reviewStatus: "reviewed",
  }
}

function reviewedEntityCitation(
  entityType: AnatomyEntityType,
  entitySlug: string,
  factType: string,
  factSlug: string | undefined,
  sourceRef: string,
  sourceLocator: string,
  citationNote: string,
): AnatomyCitation {
  const factSegment = factSlug ? `-${normalizeText(factSlug)}` : ""
  const id = `citation-${normalizeText(entityType)}-${entitySlug}-${normalizeText(factType)}${factSegment}-reviewed`

  return {
    id,
    slug: id,
    entityType,
    entitySlug,
    factType,
    factSlug,
    sourceRef,
    sourceLocator,
    citationNote,
    reviewStatus: "reviewed",
  }
}

function withRemainingLegacyMuscleCleanup(seed: AnatomyFoundationSeed): AnatomyFoundationSeed {
  const upgrades = new Map(REMAINING_LEGACY_REVIEWED_MUSCLE_UPGRADES.map((upgrade) => [upgrade.slug, upgrade]))
  const upgradedSlugs = new Set(upgrades.keys())

  const muscles = seed.muscles.map((muscle) => {
    const upgrade = upgrades.get(muscle.slug)
    if (!upgrade) {
      return muscle
    }

    return {
      ...muscle,
      alternateNames: uniqueStrings([...muscle.alternateNames, ...(upgrade.alternateNames ?? [])]),
      description: upgrade.description,
      depthNotes: upgrade.depthNotes ?? muscle.depthNotes,
      sourceRef: "applied-human-anatomy",
    }
  })

  const muscleAttachments = seed.muscleAttachments.map((attachment) => (
    upgradedSlugs.has(attachment.muscle)
      ? { ...attachment, sourceRef: "applied-human-anatomy" }
      : attachment
  ))

  const muscleActions = seed.muscleActions.map((action) => (
    upgradedSlugs.has(action.muscle)
      ? { ...action, sourceRef: "applied-human-anatomy" }
      : action
  ))

  const muscleInnervations = seed.muscleInnervations.map((innervation) => (
    upgradedSlugs.has(innervation.muscle)
      ? { ...innervation, sourceRef: "applied-human-anatomy" }
      : innervation
  ))

  const relatedNerveSlugs = new Set(muscleInnervations
    .filter((innervation) => upgradedSlugs.has(innervation.muscle))
    .map((innervation) => innervation.nerve))
  const nerves = seed.nerves.map((nerve) => (
    relatedNerveSlugs.has(nerve.slug) && nerve.sourceRef === REVIEW_SOURCE
      ? { ...nerve, sourceRef: "applied-human-anatomy" }
      : nerve
  ))

  const relationships = seed.relationships.map((relationship) => {
    const touchesUpgradedMuscle = (relationship.sourceEntityType === "muscle" && upgradedSlugs.has(relationship.sourceEntitySlug))
      || (relationship.targetEntityType === "muscle" && upgradedSlugs.has(relationship.targetEntitySlug))

    return touchesUpgradedMuscle && relationship.sourceRef === REVIEW_SOURCE
      ? { ...relationship, sourceRef: "applied-human-anatomy" }
      : relationship
  })

  const relatedBloodSupplySlugs = new Set(relationships
    .filter((relationship) => relationship.sourceEntityType === "blood_supply"
      && relationship.targetEntityType === "muscle"
      && upgradedSlugs.has(relationship.targetEntitySlug)
      && relationship.relationshipType === "supplies")
    .map((relationship) => relationship.sourceEntitySlug))
  const bloodSupply = seed.bloodSupply.map((bloodSupplyEntry) => (
    relatedBloodSupplySlugs.has(bloodSupplyEntry.slug) && bloodSupplyEntry.sourceRef === REVIEW_SOURCE
      ? { ...bloodSupplyEntry, sourceRef: "applied-human-anatomy" }
      : bloodSupplyEntry
  ))

  let entityTerms = seed.entityTerms.map((term) => {
    const upgrade = term.anatomyEntityType === "muscle" ? upgrades.get(term.anatomyEntitySlug) : undefined
    if (!upgrade || term.termType !== "formal" || normalizeText(term.term) !== normalizeText(upgrade.formalTerm)) {
      return term
    }

    return { ...term, sourceRef: "fipat-ta2" }
  })

  const termKeys = new Set(entityTerms.map((term) => [
    term.anatomyEntityType,
    term.anatomyEntitySlug,
    normalizeText(term.term),
    term.termType,
  ].join(":")))

  for (const upgrade of REMAINING_LEGACY_REVIEWED_MUSCLE_UPGRADES) {
    const key = ["muscle", upgrade.slug, normalizeText(upgrade.formalTerm), "formal"].join(":")
    if (!termKeys.has(key)) {
      entityTerms = [
        ...entityTerms,
        {
          id: `term-${upgrade.slug}-formal-reviewed`,
          anatomyEntityType: "muscle",
          anatomyEntitySlug: upgrade.slug,
          term: upgrade.formalTerm,
          termType: "formal",
          sourceRef: "fipat-ta2",
        },
      ]
      termKeys.add(key)
    }

    for (const alternateName of upgrade.alternateNames ?? []) {
      const alternateKey = ["muscle", upgrade.slug, normalizeText(alternateName), "alternate"].join(":")
      if (!termKeys.has(alternateKey)) {
        entityTerms = [
          ...entityTerms,
          {
            id: `term-${upgrade.slug}-${normalizeText(alternateName)}-alternate`,
            anatomyEntityType: "muscle",
            anatomyEntitySlug: upgrade.slug,
            term: alternateName,
            termType: "alternate",
            sourceRef: "applied-human-anatomy",
          },
        ]
        termKeys.add(alternateKey)
      }
    }
  }

  const identifierKeys = new Set(seed.externalIdentifiers.map((identifier) => [
    identifier.entityType,
    identifier.entitySlug,
    identifier.provider,
    identifier.identifier,
  ].join(":")))
  const externalIdentifiers = [...seed.externalIdentifiers]

  for (const upgrade of REMAINING_LEGACY_REVIEWED_MUSCLE_UPGRADES) {
    const key = ["muscle", upgrade.slug, upgrade.identifier.provider, upgrade.identifier.identifier].join(":")
    if (identifierKeys.has(key)) {
      continue
    }

    externalIdentifiers.push({
      id: `external-id-${upgrade.slug}-${upgrade.identifier.provider.toLowerCase()}`,
      entityType: "muscle",
      entitySlug: upgrade.slug,
      provider: upgrade.identifier.provider,
      identifier: upgrade.identifier.identifier,
      iri: upgrade.identifier.iri,
      label: upgrade.identifier.label,
      sourceRef: upgrade.identifier.sourceRef,
    })
    identifierKeys.add(key)
  }

  const citations = [...seed.citations]

  for (const upgrade of REMAINING_LEGACY_REVIEWED_MUSCLE_UPGRADES) {
    const term = entityTerms.find((entry) => entry.anatomyEntityType === "muscle"
      && entry.anatomyEntitySlug === upgrade.slug
      && entry.termType === "formal"
      && normalizeText(entry.term) === normalizeText(upgrade.formalTerm))
    const identifier = externalIdentifiers.find((entry) => entry.entityType === "muscle"
      && entry.entitySlug === upgrade.slug
      && entry.provider === upgrade.identifier.provider
      && entry.identifier === upgrade.identifier.identifier)

    addCitation(citations, reviewedLegacyCitation(
      upgrade.slug,
      "official_term",
      term?.id,
      "fipat-ta2",
      upgrade.officialLocator,
      "FIPAT TA2 official anatomical terminology used for the formal term row.",
    ))
    addCitation(citations, reviewedLegacyCitation(
      upgrade.slug,
      "external_identifier",
      identifier?.id,
      upgrade.identifier.sourceRef,
      upgrade.identifier.identifier,
      "External vocabulary identifier used as a stable ontology alignment anchor.",
    ))
    addCitation(citations, reviewedLegacyCitation(
      upgrade.slug,
      "clinical_summary",
      undefined,
      "applied-human-anatomy",
      APPLIED_HUMAN_ANATOMY_LOCATOR,
      "MassageLab-authored summary verified against Applied Human Anatomy regional musculoskeletal material.",
    ))

    for (const attachment of muscleAttachments.filter((entry) => entry.muscle === upgrade.slug)) {
      addCitation(citations, reviewedLegacyCitation(
        upgrade.slug,
        attachment.type,
        attachment.id,
        "applied-human-anatomy",
        APPLIED_HUMAN_ANATOMY_LOCATOR,
        `${attachment.type === "origin" ? "Origin" : "Insertion"} fact verified against Applied Human Anatomy regional musculoskeletal material.`,
      ))
    }

    for (const action of muscleActions.filter((entry) => entry.muscle === upgrade.slug)) {
      addCitation(citations, reviewedLegacyCitation(
        upgrade.slug,
        "action",
        action.id,
        "applied-human-anatomy",
        APPLIED_HUMAN_ANATOMY_LOCATOR,
        "Action fact verified against Applied Human Anatomy regional musculoskeletal material.",
      ))
    }

    for (const innervation of muscleInnervations.filter((entry) => entry.muscle === upgrade.slug)) {
      addCitation(citations, reviewedLegacyCitation(
        upgrade.slug,
        "innervation",
        innervation.id,
        "applied-human-anatomy",
        APPLIED_HUMAN_ANATOMY_LOCATOR,
        "Innervation fact verified against Applied Human Anatomy regional peripheral nerve material.",
      ))
    }

    for (const relationship of relationships.filter((entry) => (
      (entry.sourceEntityType === "muscle" && entry.sourceEntitySlug === upgrade.slug)
      || (entry.targetEntityType === "muscle" && entry.targetEntitySlug === upgrade.slug)
    ))) {
      const factType = relationship.relationshipType === "supplies" ? "blood_supply" : "relative_depth"
      addCitation(citations, reviewedLegacyCitation(
        upgrade.slug,
        factType,
        relationship.id,
        "applied-human-anatomy",
        APPLIED_HUMAN_ANATOMY_LOCATOR,
        `${factType === "blood_supply" ? "Regional blood-supply" : "Relative depth"} relationship verified against Applied Human Anatomy regional musculoskeletal material.`,
      ))
    }
  }

  return {
    ...seed,
    muscles,
    muscleAttachments,
    muscleActions,
    nerves,
    muscleInnervations,
    bloodSupply,
    entityTerms,
    relationships,
    citations,
    externalIdentifiers,
  }
}

function withReviewedSkeletonCleanup(seed: AnatomyFoundationSeed): AnatomyFoundationSeed {
  const preciseLandmarkBoneBySlug = new Map([
    ["iliac-crest", "ilium"],
    ["anterior-superior-iliac-spine", "ilium"],
    ["posterior-superior-iliac-spine", "ilium"],
    ["iliac-fossa", "ilium"],
    ["ischial-tuberosity", "ischium"],
    ["ischial-spine", "ischium"],
    ["pubic-crest", "pubis"],
    ["pubic-symphysis", "pubis"],
    ["pubic-body", "pubis"],
    ["inferior-pubic-ramus", "pubis"],
    ["obturator-foramen", "hip-bone"],
  ])
  const reviewedBoneUpgrades = [
    ...SHOULDER_GIRDLE_REVIEWED_BONE_UPGRADES,
    ...HEAD_NECK_SPINE_REVIEWED_BONE_UPGRADES,
    ...TRUNK_PELVIS_REVIEWED_BONE_UPGRADES,
    ...LOWER_LIMB_REVIEWED_BONE_UPGRADES,
    ...CRANIOFACIAL_REVIEWED_BONE_UPGRADES,
    ...REMAINING_CORE_REVIEWED_BONE_UPGRADES,
  ]
  const reviewedLandmarkUpgrades = [
    ...SHOULDER_GIRDLE_REVIEWED_LANDMARK_UPGRADES,
    ...HEAD_NECK_SPINE_REVIEWED_LANDMARK_UPGRADES,
    ...TRUNK_PELVIS_REVIEWED_LANDMARK_UPGRADES,
    ...LOWER_LIMB_REVIEWED_LANDMARK_UPGRADES,
    ...CRANIOFACIAL_REVIEWED_LANDMARK_UPGRADES,
  ]
  const boneUpgrades = new Map(reviewedBoneUpgrades.map((upgrade) => [upgrade.slug, upgrade]))
  const landmarkUpgrades = new Map(reviewedLandmarkUpgrades.map((upgrade) => [upgrade.slug, upgrade]))

  const bones = seed.bones.map((bone) => {
    const upgrade = boneUpgrades.get(bone.slug)
    if (!upgrade) {
      return bone
    }

    return {
      ...bone,
      formalName: upgrade.formalTerm,
      description: upgrade.description,
      sourceRef: "applied-human-anatomy",
    }
  })

  const boneLandmarks = seed.boneLandmarks.map((landmark) => {
    const upgrade = landmarkUpgrades.get(landmark.slug)
    const bone = preciseLandmarkBoneBySlug.get(landmark.slug) ?? landmark.bone
    if (!upgrade) {
      return {
        ...landmark,
        bone,
      }
    }

    return {
      ...landmark,
      name: landmark.name,
      bone,
      description: upgrade.description,
      sourceRef: "applied-human-anatomy",
    }
  })

  let entityTerms = seed.entityTerms.map((term) => {
    const boneUpgrade = term.anatomyEntityType === "bone" ? boneUpgrades.get(term.anatomyEntitySlug) : undefined
    const landmarkUpgrade = term.anatomyEntityType === "bone_landmark" ? landmarkUpgrades.get(term.anatomyEntitySlug) : undefined
    const upgrade = boneUpgrade ?? landmarkUpgrade

    if (!upgrade) {
      return term
    }

    if (["preferred", "formal"].includes(term.termType) && normalizeText(term.term) === normalizeText(upgrade.formalTerm)) {
      return { ...term, sourceRef: "fipat-ta2" }
    }

    if (["common", "alternate"].includes(term.termType)) {
      return { ...term, sourceRef: "applied-human-anatomy" }
    }

    return term
  })

  const termKeys = new Set(entityTerms.map((term) => [
    term.anatomyEntityType,
    term.anatomyEntitySlug,
    normalizeText(term.term),
    term.termType,
  ].join(":")))

  const addTerm = (
    anatomyEntityType: AnatomyEntityType,
    anatomyEntitySlug: string,
    term: string,
    termType: AnatomyTermType,
    sourceRef: string,
  ) => {
    const key = [anatomyEntityType, anatomyEntitySlug, normalizeText(term), termType].join(":")
    if (termKeys.has(key)) {
      return
    }

    entityTerms = [
      ...entityTerms,
      {
        id: `term-${anatomyEntitySlug}-${normalizeText(term)}-${termType}`,
        anatomyEntityType,
        anatomyEntitySlug,
        term,
        termType,
        sourceRef,
      },
    ]
    termKeys.add(key)
  }

  for (const upgrade of reviewedBoneUpgrades) {
    addTerm("bone", upgrade.slug, upgrade.formalTerm, "preferred", "fipat-ta2")
    for (const commonTerm of upgrade.commonTerms ?? []) {
      addTerm("bone", upgrade.slug, commonTerm, "common", "applied-human-anatomy")
    }
  }

  for (const upgrade of reviewedLandmarkUpgrades) {
    addTerm("bone_landmark", upgrade.slug, upgrade.formalTerm, "preferred", "fipat-ta2")
    for (const commonTerm of upgrade.commonTerms ?? []) {
      addTerm("bone_landmark", upgrade.slug, commonTerm, "common", "applied-human-anatomy")
    }
  }

  const identifierKeys = new Set(seed.externalIdentifiers.map((identifier) => [
    identifier.entityType,
    identifier.entitySlug,
    identifier.provider,
    identifier.identifier,
  ].join(":")))
  const externalIdentifiers = [...seed.externalIdentifiers]

  const addIdentifier = (
    entityType: AnatomyEntityType,
    entitySlug: string,
    identifier: ReviewedEntityIdentifier | undefined,
  ) => {
    if (!identifier) {
      return
    }

    const key = [entityType, entitySlug, identifier.provider, identifier.identifier].join(":")
    if (identifierKeys.has(key)) {
      return
    }

    externalIdentifiers.push({
      id: `external-id-${entitySlug}-${identifier.provider.toLowerCase()}`,
      entityType,
      entitySlug,
      provider: identifier.provider,
      identifier: identifier.identifier,
      iri: identifier.iri,
      label: identifier.label,
      sourceRef: identifier.sourceRef,
    })
    identifierKeys.add(key)
  }

  for (const upgrade of reviewedBoneUpgrades) {
    addIdentifier("bone", upgrade.slug, upgrade.identifier)
  }

  for (const upgrade of reviewedLandmarkUpgrades) {
    addIdentifier("bone_landmark", upgrade.slug, upgrade.identifier)
  }

  const citations = [...seed.citations]

  for (const upgrade of reviewedBoneUpgrades) {
    const term = entityTerms.find((entry) => entry.anatomyEntityType === "bone"
      && entry.anatomyEntitySlug === upgrade.slug
      && ["preferred", "formal"].includes(entry.termType)
      && normalizeText(entry.term) === normalizeText(upgrade.formalTerm))
    const identifier = externalIdentifiers.find((entry) => entry.entityType === "bone"
      && entry.entitySlug === upgrade.slug
      && entry.provider === upgrade.identifier.provider
      && entry.identifier === upgrade.identifier.identifier)

    addCitation(citations, reviewedEntityCitation(
      "bone",
      upgrade.slug,
      "official_term",
      term?.id,
      "fipat-ta2",
      upgrade.officialLocator,
      "FIPAT TA2 official anatomical terminology used for the bone term row.",
    ))
    addCitation(citations, reviewedEntityCitation(
      "bone",
      upgrade.slug,
      "external_identifier",
      identifier?.id,
      upgrade.identifier.sourceRef,
      upgrade.identifier.identifier,
      "External vocabulary identifier used as a stable ontology alignment anchor.",
    ))
    addCitation(citations, reviewedEntityCitation(
      "bone",
      upgrade.slug,
      "clinical_summary",
      undefined,
      "applied-human-anatomy",
      APPLIED_HUMAN_ANATOMY_LOCATOR,
      "MassageLab-authored bone summary verified against Applied Human Anatomy skeletal material.",
    ))
  }

  for (const upgrade of reviewedLandmarkUpgrades) {
    const term = entityTerms.find((entry) => entry.anatomyEntityType === "bone_landmark"
      && entry.anatomyEntitySlug === upgrade.slug
      && ["preferred", "formal"].includes(entry.termType)
      && normalizeText(entry.term) === normalizeText(upgrade.formalTerm))
    const identifier = upgrade.identifier
      ? externalIdentifiers.find((entry) => entry.entityType === "bone_landmark"
        && entry.entitySlug === upgrade.slug
        && entry.provider === upgrade.identifier?.provider
        && entry.identifier === upgrade.identifier?.identifier)
      : undefined

    addCitation(citations, reviewedEntityCitation(
      "bone_landmark",
      upgrade.slug,
      "official_term",
      term?.id,
      "fipat-ta2",
      upgrade.officialLocator,
      "FIPAT TA2 official anatomical terminology used for the landmark term row.",
    ))
    addCitation(citations, reviewedEntityCitation(
      "bone_landmark",
      upgrade.slug,
      "anatomy_landmark",
      undefined,
      "applied-human-anatomy",
      APPLIED_HUMAN_ANATOMY_LOCATOR,
      "MassageLab-authored landmark summary verified against Applied Human Anatomy skeletal material.",
    ))

    if (upgrade.identifier) {
      addCitation(citations, reviewedEntityCitation(
        "bone_landmark",
        upgrade.slug,
        "external_identifier",
        identifier?.id,
        upgrade.identifier.sourceRef,
        upgrade.identifier.identifier,
        "External vocabulary identifier used as a stable landmark alignment anchor.",
      ))
    }
  }

  return {
    ...seed,
    bones,
    boneLandmarks,
    entityTerms,
    citations,
    externalIdentifiers,
  }
}

function withReviewedSupportSystemCleanup(seed: AnatomyFoundationSeed): AnatomyFoundationSeed {
  const reviewedSupportUpgrades = [
    ...REVIEWED_NERVE_UPGRADES,
    ...REVIEWED_BLOOD_SUPPLY_UPGRADES,
    ...REVIEWED_STRUCTURE_UPGRADES,
    ...REVIEWED_LIGAMENT_UPGRADES,
  ]
  const upgradesByKey = new Map(reviewedSupportUpgrades.map((upgrade) => [`${upgrade.entityType}:${upgrade.slug}`, upgrade]))

  const upgradeEntity = <T extends { slug: string; description?: string; sourceRef: string }>(
    entityType: ReviewedSupportEntityUpgrade["entityType"],
    entity: T,
  ): T => {
    const upgrade = upgradesByKey.get(`${entityType}:${entity.slug}`)

    if (!upgrade) {
      return entity
    }

    return {
      ...entity,
      description: upgrade.description,
      sourceRef: "applied-human-anatomy",
    }
  }

  const nerves = seed.nerves.map((nerve) => upgradeEntity("nerve", nerve))
  const bloodSupply = seed.bloodSupply.map((entry) => upgradeEntity("blood_supply", entry))
  const structures = seed.structures.map((structure) => upgradeEntity("anatomy_structure", structure))
  const ligaments = seed.ligaments.map((ligament) => upgradeEntity("ligament", ligament))
  const upgradedEntityKeys = new Set(reviewedSupportUpgrades.map((upgrade) => `${upgrade.entityType}:${upgrade.slug}`))
  const relationships = seed.relationships.map((relationship) => {
    const touchesReviewedEntity = upgradedEntityKeys.has(`${relationship.sourceEntityType}:${relationship.sourceEntitySlug}`)
      || upgradedEntityKeys.has(`${relationship.targetEntityType}:${relationship.targetEntitySlug}`)

    if (!touchesReviewedEntity || ![REVIEW_SOURCE, STARTER_SOURCE].includes(relationship.sourceRef)) {
      return relationship
    }

    return { ...relationship, sourceRef: "applied-human-anatomy" }
  })

  let entityTerms = [...seed.entityTerms]
  const termKeys = new Set(entityTerms.map((term) => [
    term.anatomyEntityType,
    term.anatomyEntitySlug,
    normalizeText(term.term),
    term.termType,
  ].join(":")))

  const addTerm = (
    anatomyEntityType: AnatomyEntityType,
    anatomyEntitySlug: string,
    term: string,
    termType: AnatomyTermType,
    sourceRef: string,
  ) => {
    const key = [anatomyEntityType, anatomyEntitySlug, normalizeText(term), termType].join(":")
    if (termKeys.has(key)) {
      return
    }

    entityTerms = [
      ...entityTerms,
      {
        id: `term-${normalizeText(anatomyEntityType)}-${anatomyEntitySlug}-${normalizeText(term)}-${termType}`,
        anatomyEntityType,
        anatomyEntitySlug,
        term,
        termType,
        sourceRef,
      },
    ]
    termKeys.add(key)
  }

  const identifierKeys = new Set(seed.externalIdentifiers.map((identifier) => [
    identifier.entityType,
    identifier.entitySlug,
    identifier.provider,
    identifier.identifier,
  ].join(":")))
  const externalIdentifiers = [...seed.externalIdentifiers]

  const addIdentifier = (entityType: AnatomyEntityType, entitySlug: string, identifier: ReviewedEntityIdentifier) => {
    const key = [entityType, entitySlug, identifier.provider, identifier.identifier].join(":")
    if (identifierKeys.has(key)) {
      return
    }

    externalIdentifiers.push({
      id: `external-id-${entitySlug}-${identifier.provider.toLowerCase()}`,
      entityType,
      entitySlug,
      provider: identifier.provider,
      identifier: identifier.identifier,
      iri: identifier.iri,
      label: identifier.label,
      sourceRef: identifier.sourceRef,
    })
    identifierKeys.add(key)
  }

  for (const upgrade of reviewedSupportUpgrades) {
    addTerm(upgrade.entityType, upgrade.slug, upgrade.formalTerm, "preferred", "fipat-ta2")

    for (const commonTerm of upgrade.commonTerms ?? []) {
      addTerm(upgrade.entityType, upgrade.slug, commonTerm, "common", "applied-human-anatomy")
    }

    for (const clinicalTerm of upgrade.clinicalTerms ?? []) {
      addTerm(upgrade.entityType, upgrade.slug, clinicalTerm, "clinical", "applied-human-anatomy")
    }

    for (const abbreviationTerm of upgrade.abbreviationTerms ?? []) {
      addTerm(upgrade.entityType, upgrade.slug, abbreviationTerm, "abbreviation", "applied-human-anatomy")
    }

    addIdentifier(upgrade.entityType, upgrade.slug, upgrade.identifier)
  }

  const citations = [...seed.citations]

  for (const upgrade of reviewedSupportUpgrades) {
    const term = entityTerms.find((entry) => entry.anatomyEntityType === upgrade.entityType
      && entry.anatomyEntitySlug === upgrade.slug
      && ["preferred", "formal"].includes(entry.termType)
      && normalizeText(entry.term) === normalizeText(upgrade.formalTerm))
    const identifier = externalIdentifiers.find((entry) => entry.entityType === upgrade.entityType
      && entry.entitySlug === upgrade.slug
      && entry.provider === upgrade.identifier.provider
      && entry.identifier === upgrade.identifier.identifier)

    addCitation(citations, reviewedEntityCitation(
      upgrade.entityType,
      upgrade.slug,
      "official_term",
      term?.id,
      "fipat-ta2",
      upgrade.officialLocator,
      "FIPAT TA2 official anatomical terminology used for the entity term row.",
    ))
    addCitation(citations, reviewedEntityCitation(
      upgrade.entityType,
      upgrade.slug,
      "external_identifier",
      identifier?.id,
      upgrade.identifier.sourceRef,
      upgrade.identifier.identifier,
      "External vocabulary identifier used as a stable ontology alignment anchor.",
    ))
    addCitation(citations, reviewedEntityCitation(
      upgrade.entityType,
      upgrade.slug,
      "clinical_summary",
      undefined,
      "applied-human-anatomy",
      APPLIED_HUMAN_ANATOMY_LOCATOR,
      "MassageLab-authored entity summary verified against Applied Human Anatomy regional material.",
    ))
  }

  return {
    ...seed,
    nerves,
    bloodSupply,
    structures,
    ligaments,
    relationships,
    entityTerms,
    citations,
    externalIdentifiers,
  }
}

function reviewedPainMapLaterality(painMapRegion: PainMapRegion): PainMapLaterality {
  if (painMapRegion.laterality && painMapRegion.laterality !== "unspecified") {
    return painMapRegion.laterality
  }

  if (["base-of-skull", "posterior-neck", "between-shoulder-blades", "upper-thoracic-spine", "low-back", "abdomen", "forehead-area"].includes(painMapRegion.slug)) {
    return "midline"
  }

  return "variable"
}

function reviewedPainMapSurface(painMapRegion: PainMapRegion): PainMapSurface {
  if (painMapRegion.surface && painMapRegion.surface !== "unspecified") {
    return painMapRegion.surface
  }

  if (["top-of-shoulder"].includes(painMapRegion.slug)) {
    return "superior"
  }

  if (["lateral-shoulder", "lateral-neck", "temple-area", "jaw-angle-area"].includes(painMapRegion.slug)) {
    return "lateral"
  }

  if (["anterior-shoulder", "abdomen", "front-thigh", "front-of-knee", "forehead-area"].includes(painMapRegion.slug)) {
    return "anterior"
  }

  if (["foot-arch"].includes(painMapRegion.slug)) {
    return "inferior"
  }

  if (["elbow-area", "forearm-area", "wrist-hand", "hip-area", "jaw-area"].includes(painMapRegion.slug)) {
    return "variable"
  }

  return "posterior"
}

function reviewedPainMapDescription(painMapRegion: PainMapRegion): string {
  if ((painMapRegion.plainLanguageDescription ?? "").length > 25) {
    return painMapRegion.plainLanguageDescription as string
  }

  const regionLabel = painMapRegion.region.replaceAll("-", " ")

  return `Client-friendly body-map region for the ${painMapRegion.name.toLowerCase()} around the ${regionLabel} area; use only as a non-diagnostic location cue.`
}

function withReviewedClientLanguageCleanup(seed: AnatomyFoundationSeed): AnatomyFoundationSeed {
  const painMapRegions = seed.painMapRegions.map((painMapRegion) => ({
    ...painMapRegion,
    laterality: reviewedPainMapLaterality(painMapRegion),
    surface: reviewedPainMapSurface(painMapRegion),
    plainLanguageDescription: reviewedPainMapDescription(painMapRegion),
    sourceRef: CLIENT_LANGUAGE_SOURCE,
  }))
  const clientTerms = seed.clientTerms.map((clientTerm) => ({
    ...clientTerm,
    sourceRef: CLIENT_LANGUAGE_SOURCE,
  }))
  const relationships = seed.relationships.map((relationship) => {
    if (relationship.sourceRef === STARTER_SOURCE) {
      return { ...relationship, sourceRef: CLIENT_LANGUAGE_SOURCE }
    }

    if (relationship.sourceRef === REVIEW_SOURCE) {
      return { ...relationship, sourceRef: "applied-human-anatomy" }
    }

    return relationship
  })
  const citations = [...seed.citations]

  for (const painMapRegion of painMapRegions) {
    addCitation(citations, reviewedEntityCitation(
      "pain_map_region",
      painMapRegion.slug,
      "body_map_region",
      painMapRegion.id,
      CLIENT_LANGUAGE_SOURCE,
      CLIENT_LANGUAGE_SOURCE_LOCATOR,
      "MassageLab-authored body-map label, laterality, surface, and client-friendly display copy.",
    ))
    addCitation(citations, reviewedEntityCitation(
      "pain_map_region",
      painMapRegion.slug,
      "anatomy_mapping",
      `${painMapRegion.id}:region:${painMapRegion.region}`,
      "applied-human-anatomy",
      APPLIED_HUMAN_ANATOMY_LOCATOR,
      "Pain-map region anatomy mapping reviewed against open anatomy structure and regional terminology.",
    ))
  }

  for (const clientTerm of clientTerms) {
    addCitation(citations, reviewedEntityCitation(
      "client_term",
      clientTerm.slug,
      "client_language",
      clientTerm.id,
      CLIENT_LANGUAGE_SOURCE,
      CLIENT_LANGUAGE_SOURCE_LOCATOR,
      "MassageLab-authored non-diagnostic client phrase and therapist prompt metadata.",
    ))
    addCitation(citations, reviewedEntityCitation(
      "client_term",
      clientTerm.slug,
      "anatomy_mapping",
      `${clientTerm.id}:mapping`,
      "applied-human-anatomy",
      APPLIED_HUMAN_ANATOMY_LOCATOR,
      "Client phrase anatomy mapping reviewed against open anatomy structure and regional terminology.",
    ))
  }

  return {
    ...seed,
    painMapRegions,
    clientTerms,
    relationships,
    citations,
  }
}

function withReviewedStarterTaxonomySourceCleanup(seed: AnatomyFoundationSeed): AnatomyFoundationSeed {
  const reviewedTargets: SourceReferenceCitationTarget[] = []

  const reviewedStarterCitation = (target: SourceReferenceCitationTarget): AnatomyCitation => {
    const slug = citationSlugForTarget(target)

    return {
      id: slug,
      slug,
      entityType: target.entityType,
      entitySlug: target.entitySlug,
      factType: "seed_source_reference",
      factSlug: target.factSlug,
      sourceRef: target.sourceRef,
      sourceLocator: CLIENT_LANGUAGE_SOURCE_LOCATOR,
      citationNote: "Reviewed migration of starter region and search terminology metadata to the MassageLab-authored commercial taxonomy source.",
      reviewStatus: "reviewed",
    }
  }

  const replaceStarterSourceRefs = (entitySlug: string, factPrefix: "region" | "subregion", sourceRefs: string[]) => {
    const mappedSourceRefs = sourceRefs.map((sourceRef) => {
      if (sourceRef !== STARTER_SOURCE) return sourceRef

      reviewedTargets.push({
        entityType: "region",
        entitySlug,
        sourceRef: CLIENT_LANGUAGE_SOURCE,
        factSlug: `${factPrefix}:${entitySlug}:${CLIENT_LANGUAGE_SOURCE}`,
      })

      return CLIENT_LANGUAGE_SOURCE
    })

    return [...new Set(mappedSourceRefs)]
  }

  const bodyRegions = seed.bodyRegions.map((region) => ({
    ...region,
    sourceRefs: replaceStarterSourceRefs(region.slug, "region", region.sourceRefs),
  }))
  const bodySubregions = seed.bodySubregions.map((region) => ({
    ...region,
    sourceRefs: replaceStarterSourceRefs(region.slug, "subregion", region.sourceRefs),
  }))
  const entityTerms = seed.entityTerms.map((term) => {
    if (term.sourceRef !== STARTER_SOURCE) return term

    reviewedTargets.push({
      entityType: term.anatomyEntityType,
      entitySlug: term.anatomyEntitySlug,
      sourceRef: CLIENT_LANGUAGE_SOURCE,
      factSlug: `entity_term:${term.id}`,
    })

    return {
      ...term,
      sourceRef: CLIENT_LANGUAGE_SOURCE,
    }
  })

  const existingSourceReferenceKeys = new Set(seed.citations.map(citationSourceReferenceKey).filter((key): key is string => Boolean(key)))
  const citations = [
    ...seed.citations,
    ...reviewedTargets
      .filter((target) => !existingSourceReferenceKeys.has(sourceReferenceCitationKey(target)))
      .map(reviewedStarterCitation),
  ]

  return {
    ...seed,
    bodyRegions,
    bodySubregions,
    entityTerms,
    citations,
  }
}

function withReviewedFutureClinicalPlaceholderCleanup(seed: AnatomyFoundationSeed): AnatomyFoundationSeed {
  const reviewedTargets: SourceReferenceCitationTarget[] = []

  const sourceLocatorFor = (sourceRef: string) => {
    if (sourceRef === CDC_ROM_SOURCE) return CDC_ROM_LOCATOR
    if (sourceRef === CLIENT_LANGUAGE_SOURCE) return CLIENT_LANGUAGE_SOURCE_LOCATOR

    return APPLIED_HUMAN_ANATOMY_LOCATOR
  }
  const reviewedPlaceholderCitation = (target: SourceReferenceCitationTarget): AnatomyCitation => {
    const slug = citationSlugForTarget(target)

    return {
      id: slug,
      slug,
      entityType: target.entityType,
      entitySlug: target.entitySlug,
      factType: "seed_source_reference",
      factSlug: target.factSlug,
      sourceRef: target.sourceRef,
      sourceLocator: sourceLocatorFor(target.sourceRef),
      citationNote: "Reviewed migration of a future clinical placeholder seed reference to a concrete commercial-safe source.",
      reviewStatus: "reviewed",
    }
  }
  const replacePlaceholderSourceRef = (
    sourceRef: string,
    target: Omit<SourceReferenceCitationTarget, "sourceRef">,
    replacementSourceRef: string,
  ) => {
    if (sourceRef !== REVIEW_SOURCE) return sourceRef

    reviewedTargets.push({
      ...target,
      sourceRef: replacementSourceRef,
    })

    return replacementSourceRef
  }

  const joints = seed.joints.map((joint) => ({
    ...joint,
    sourceRef: replacePlaceholderSourceRef(joint.sourceRef, {
      entityType: "joint",
      entitySlug: joint.slug,
      factSlug: `joint:${joint.slug}`,
    }, "applied-human-anatomy"),
  }))
  const jointMovements = seed.jointMovements.map((movement) => ({
    ...movement,
    sourceRef: replacePlaceholderSourceRef(movement.sourceRef, {
      entityType: "joint_movement",
      entitySlug: movement.slug,
      factSlug: `joint_movement:${movement.slug}`,
    }, "applied-human-anatomy"),
  }))
  const rangesOfMotion = seed.rangesOfMotion.map((range) => ({
    ...range,
    sourceRef: replacePlaceholderSourceRef(range.sourceRef, {
      entityType: "range_of_motion",
      entitySlug: range.slug,
      factSlug: `range_of_motion:${range.slug}`,
    }, CDC_ROM_SOURCE),
  }))
  const entityTerms = seed.entityTerms.map((term) => ({
    ...term,
    sourceRef: replacePlaceholderSourceRef(term.sourceRef, {
      entityType: term.anatomyEntityType,
      entitySlug: term.anatomyEntitySlug,
      factSlug: `entity_term:${term.id}`,
    }, CLIENT_LANGUAGE_SOURCE),
  }))
  const existingSourceReferenceKeys = new Set(seed.citations.map(citationSourceReferenceKey).filter((key): key is string => Boolean(key)))
  const citations = [
    ...seed.citations.filter((citation) => !(
      citation.sourceRef === REVIEW_SOURCE
      && citation.reviewStatus === "needs_review"
      && ["section_pack", "section_scaffold"].includes(citation.factType)
    )),
    ...reviewedTargets
      .filter((target) => !existingSourceReferenceKeys.has(sourceReferenceCitationKey(target)))
      .map(reviewedPlaceholderCitation),
  ]

  return {
    ...seed,
    joints,
    jointMovements,
    rangesOfMotion,
    entityTerms,
    citations,
  }
}

function fipatLocatorForLegacyIdentifier(identifier: ExternalAnatomyIdentifier) {
  return `FIPAT TA2: ${identifier.label ?? identifier.entitySlug.replace(/-/g, " ")}`
}

function withCommercialSafeExternalIdentifierSourceCleanup(seed: AnatomyFoundationSeed): AnatomyFoundationSeed {
  const sources = seed.sources.filter((source) => source.slug !== "bioportal-fma")
  const legacyBioportalIdentifierById = new Map(
    seed.externalIdentifiers
      .filter((identifier) => identifier.sourceRef === "bioportal-fma")
      .map((identifier) => [identifier.id, identifier]),
  )

  const externalIdentifiers = seed.externalIdentifiers.map((identifier) => {
    if (identifier.sourceRef !== "bioportal-fma") {
      return identifier
    }

    const fipatLocator = fipatLocatorForLegacyIdentifier(identifier)

    return {
      ...identifier,
      provider: "FIPAT",
      identifier: fipatLocator,
      iri: `${FIPAT_LOCATOR}#${normalizeText(fipatLocator)}`,
      sourceRef: FIPAT_SOURCE,
    }
  })

  const citations = seed.citations.map((citation) => {
    if (citation.sourceRef !== "bioportal-fma") {
      return citation
    }

    const legacyIdentifier = citation.factSlug ? legacyBioportalIdentifierById.get(citation.factSlug) : undefined
    const fipatLocator = legacyIdentifier
      ? fipatLocatorForLegacyIdentifier(legacyIdentifier)
      : `FIPAT TA2: ${citation.entitySlug.replace(/-/g, " ")}`

    return {
      ...citation,
      sourceRef: FIPAT_SOURCE,
      sourceLocator: fipatLocator,
      citationNote: "Legacy BioPortal FMA external identifier source replaced with a FIPAT TA2 terminology anchor under the commercial-safe source policy.",
      reviewStatus: "reviewed" as AnatomyFactReviewStatus,
    }
  })

  return {
    ...seed,
    sources,
    externalIdentifiers,
    citations,
  }
}

function entityDisplayName(seed: AnatomyFoundationSeed, entityType: AnatomyEntityType, entitySlug: string) {
  switch (entityType) {
    case "bone":
      return seed.bones.find((entry) => entry.slug === entitySlug)?.name
    case "bone_landmark":
      return seed.boneLandmarks.find((entry) => entry.slug === entitySlug)?.name
    case "joint":
      return seed.joints.find((entry) => entry.slug === entitySlug)?.name
    case "joint_movement":
      return seed.jointMovements.find((entry) => entry.slug === entitySlug)?.movementName
    case "muscle":
      return seed.muscles.find((entry) => entry.slug === entitySlug)?.name
    case "nerve":
      return seed.nerves.find((entry) => entry.slug === entitySlug)?.name
    case "ligament":
      return seed.ligaments.find((entry) => entry.slug === entitySlug)?.name
    case "blood_supply":
      return seed.bloodSupply.find((entry) => entry.slug === entitySlug)?.name
    case "anatomy_structure":
      return seed.structures.find((entry) => entry.slug === entitySlug)?.name
    case "anatomy_concept":
      return seed.concepts.find((entry) => entry.slug === entitySlug)?.name
    case "pain_map_region":
      return seed.painMapRegions.find((entry) => entry.slug === entitySlug)?.name
    case "client_term":
      return seed.clientTerms.find((entry) => entry.slug === entitySlug)?.label
        ?? seed.clientTerms.find((entry) => entry.slug === entitySlug)?.term
    case "region":
      return seed.bodyRegions.find((entry) => entry.slug === entitySlug)?.name
        ?? seed.bodySubregions.find((entry) => entry.slug === entitySlug)?.name
    default:
      return undefined
  }
}

function titleFromSlug(slug: string) {
  const lowercaseWords = new Set(["a", "an", "and", "at", "by", "for", "from", "in", "of", "on", "or", "the", "to", "with"])

  return slug
    .split("-")
    .filter(Boolean)
    .map((word, index) => {
      if (index > 0 && lowercaseWords.has(word)) return word
      if (/^[a-z]\d+$/i.test(word)) return word.toUpperCase()

      return `${word[0]?.toUpperCase() ?? ""}${word.slice(1)}`
    })
    .join(" ")
}

function entityTermNaturalKey(term: Pick<AnatomyEntityTerm, "anatomyEntityType" | "anatomyEntitySlug" | "term" | "termType">) {
  return [
    term.anatomyEntityType,
    term.anatomyEntitySlug,
    term.term,
    term.termType,
  ].join("|").toLowerCase()
}

function externalIdentifierNaturalKey(identifier: Pick<ExternalAnatomyIdentifier, "entityType" | "entitySlug" | "provider" | "identifier">) {
  return [
    identifier.entityType,
    identifier.entitySlug,
    identifier.provider,
    identifier.identifier,
  ].join("|").toLowerCase()
}

function relationshipNaturalKey(relationship: Pick<AnatomyRelationship, "sourceEntityType" | "sourceEntitySlug" | "relationshipType" | "targetEntityType" | "targetEntitySlug">) {
  return [
    relationship.sourceEntityType,
    relationship.sourceEntitySlug,
    relationship.relationshipType,
    relationship.targetEntityType,
    relationship.targetEntitySlug,
  ].join("|").toLowerCase()
}

function enrichmentTermSource(entityType: AnatomyEntityType) {
  if (entityType === "pain_map_region") return CLIENT_LANGUAGE_SOURCE
  if (entityType === "joint_movement") return ROM_TRACKING_SOURCE

  return FIPAT_SOURCE
}

function enrichmentTermType(entityType: AnatomyEntityType): AnatomyTermType {
  if (entityType === "pain_map_region" || entityType === "joint_movement") return "preferred"

  return "formal"
}

function enrichmentIdentifierSource(entityType: AnatomyEntityType) {
  if (entityType === "pain_map_region") return CLIENT_LANGUAGE_SOURCE
  if (entityType === "joint_movement") return ROM_TRACKING_SOURCE

  return FIPAT_SOURCE
}

function enrichmentIdentifierProvider(entityType: AnatomyEntityType) {
  if (entityType === "pain_map_region") return "MASSAGELAB_BODY_MAP"
  if (entityType === "joint_movement") return "MASSAGELAB_ROM_TRACKING"

  return "FIPAT"
}

function enrichmentIdentifierValue(entityType: AnatomyEntityType, entitySlug: string, displayName: string) {
  if (entityType === "pain_map_region") return `body-map-region:${entitySlug}`
  if (entityType === "joint_movement") return `movement-tracking:${entitySlug}`

  return `FIPAT TA2: ${displayName}`
}

function enrichmentIdentifierIri(entityType: AnatomyEntityType, identifier: string) {
  if (entityType === "pain_map_region" || entityType === "joint_movement") {
    return undefined
  }

  return `${FIPAT_LOCATOR}#${normalizeText(identifier)}`
}

function addEnrichmentTerm(
  entityTerms: AnatomyEntityTerm[],
  termNaturalKeys: Set<string>,
  entityType: AnatomyEntityType,
  entitySlug: string,
  term: string,
  termType: AnatomyTermType,
  sourceRef: string,
  notes?: string,
) {
  const row: AnatomyEntityTerm = {
    id: `term-enrichment-${normalizeText(entityType)}-${entitySlug}-${normalizeText(termType)}-${normalizeText(term)}`,
    anatomyEntityType: entityType,
    anatomyEntitySlug: entitySlug,
    term,
    termType,
    notes,
    sourceRef,
  }
  const key = entityTermNaturalKey(row)

  if (!termNaturalKeys.has(key)) {
    entityTerms.push(row)
    termNaturalKeys.add(key)
  }
}

function addEnrichmentIdentifier(
  externalIdentifiers: ExternalAnatomyIdentifier[],
  identifierNaturalKeys: Set<string>,
  entityType: AnatomyEntityType,
  entitySlug: string,
  displayName: string,
) {
  const provider = enrichmentIdentifierProvider(entityType)
  const identifier = enrichmentIdentifierValue(entityType, entitySlug, displayName)
  const row: ExternalAnatomyIdentifier = {
    id: `external-enrichment-${normalizeText(entityType)}-${entitySlug}-${normalizeText(provider)}`,
    entityType,
    entitySlug,
    provider,
    identifier,
    iri: enrichmentIdentifierIri(entityType, identifier),
    label: displayName,
    sourceRef: enrichmentIdentifierSource(entityType),
  }
  const key = externalIdentifierNaturalKey(row)

  if (!identifierNaturalKeys.has(key)) {
    externalIdentifiers.push(row)
    identifierNaturalKeys.add(key)
  }
}

function addEnrichmentRelationship(
  relationships: AnatomyRelationship[],
  relationshipNaturalKeys: Set<string>,
  sourceEntityType: AnatomyEntityType,
  sourceEntitySlug: string,
  relationshipType: string,
  targetEntityType: AnatomyEntityType,
  targetEntitySlug: string,
  sourceRef: string,
  details?: Record<string, unknown>,
) {
  const row: AnatomyRelationship = {
    id: `relationship-enrichment-${normalizeText(sourceEntityType)}-${sourceEntitySlug}-${normalizeText(relationshipType)}-${normalizeText(targetEntityType)}-${targetEntitySlug}`,
    sourceEntityType,
    sourceEntitySlug,
    relationshipType,
    targetEntityType,
    targetEntitySlug,
    details,
    sourceRef,
  }
  const key = relationshipNaturalKey(row)

  if (!relationshipNaturalKeys.has(key)) {
    relationships.push(row)
    relationshipNaturalKeys.add(key)
  }
}

function withAtlasEnrichmentGapClosure(seed: AnatomyFoundationSeed): AnatomyFoundationSeed {
  const entityTerms = [...seed.entityTerms]
  const externalIdentifiers = [...seed.externalIdentifiers]
  const relationships = [...seed.relationships]
  const rangesOfMotion = [...seed.rangesOfMotion]
  const entityTermKeys = new Set(entityTerms.map((term) => `${term.anatomyEntityType}:${term.anatomyEntitySlug}`))
  const termNaturalKeys = new Set(entityTerms.map(entityTermNaturalKey))
  const identifierKeys = new Set(externalIdentifiers.map((identifier) => `${identifier.entityType}:${identifier.entitySlug}`))
  const identifierNaturalKeys = new Set(externalIdentifiers.map(externalIdentifierNaturalKey))
  const relationshipEntityKeys = new Set<string>()
  const relationshipNaturalKeys = new Set(relationships.map(relationshipNaturalKey))
  const rangeMovementSlugs = new Set(rangesOfMotion.map((range) => range.movement))

  for (const relationship of relationships) {
    relationshipEntityKeys.add(`${relationship.sourceEntityType}:${relationship.sourceEntitySlug}`)
    relationshipEntityKeys.add(`${relationship.targetEntityType}:${relationship.targetEntitySlug}`)
  }

  const entityRows: Array<{ entityType: AnatomyEntityType; slug: string; sourceRef?: string }> = [
    ...seed.bones.map((entry) => ({ entityType: "bone" as const, slug: entry.slug, sourceRef: entry.sourceRef })),
    ...seed.boneLandmarks.map((entry) => ({ entityType: "bone_landmark" as const, slug: entry.slug, sourceRef: entry.sourceRef })),
    ...seed.joints.map((entry) => ({ entityType: "joint" as const, slug: entry.slug, sourceRef: entry.sourceRef })),
    ...seed.jointMovements.map((entry) => ({ entityType: "joint_movement" as const, slug: entry.slug, sourceRef: entry.sourceRef })),
    ...seed.muscles.map((entry) => ({ entityType: "muscle" as const, slug: entry.slug, sourceRef: entry.sourceRef })),
    ...seed.nerves.map((entry) => ({ entityType: "nerve" as const, slug: entry.slug, sourceRef: entry.sourceRef })),
    ...seed.ligaments.map((entry) => ({ entityType: "ligament" as const, slug: entry.slug, sourceRef: entry.sourceRef })),
    ...seed.bloodSupply.map((entry) => ({ entityType: "blood_supply" as const, slug: entry.slug, sourceRef: entry.sourceRef })),
    ...seed.structures.map((entry) => ({ entityType: "anatomy_structure" as const, slug: entry.slug, sourceRef: entry.sourceRef })),
    ...seed.painMapRegions.map((entry) => ({ entityType: "pain_map_region" as const, slug: entry.slug, sourceRef: entry.sourceRef })),
  ]
  const termRequiredEntityTypes = new Set<AnatomyEntityType>([
    "joint",
    "joint_movement",
    "nerve",
    "ligament",
    "blood_supply",
    "anatomy_structure",
    "pain_map_region",
  ])
  const identifierRequiredEntityTypes = new Set<AnatomyEntityType>([
    "bone_landmark",
    "joint",
    "joint_movement",
    "nerve",
    "ligament",
    "blood_supply",
    "anatomy_structure",
    "pain_map_region",
  ])

  for (const { entityType, slug } of entityRows) {
    const key = `${entityType}:${slug}`
    const displayName = entityDisplayName(seed, entityType, slug) ?? titleFromSlug(slug)

    if (termRequiredEntityTypes.has(entityType) && !entityTermKeys.has(key)) {
      const sourceRef = enrichmentTermSource(entityType)
      addEnrichmentTerm(
        entityTerms,
        termNaturalKeys,
        entityType,
        slug,
        displayName,
        enrichmentTermType(entityType),
        sourceRef,
        "Generated terminology closure row for normalized anatomy search, admin browsing, SOAP tags, flashcards, and game prompts.",
      )
      addEnrichmentTerm(
        entityTerms,
        termNaturalKeys,
        entityType,
        slug,
        titleFromSlug(slug),
        "common",
        entityType === "pain_map_region" ? CLIENT_LANGUAGE_SOURCE : sourceRef,
        "Generated plain-language search alias from the stable slug.",
      )

      if (entityType === "joint_movement") {
        addEnrichmentTerm(
          entityTerms,
          termNaturalKeys,
          entityType,
          slug,
          `${displayName} tracking`,
          "common",
          ROM_TRACKING_SOURCE,
          "Generated ROM-tracking search alias for movement tracking tools.",
        )
      }

      if (entityType === "pain_map_region") {
        addEnrichmentTerm(
          entityTerms,
          termNaturalKeys,
          entityType,
          slug,
          `${displayName} body map`,
          "common",
          CLIENT_LANGUAGE_SOURCE,
          "Generated body-map search alias for client-friendly pain-region browsing.",
        )
      }
    }

    if (identifierRequiredEntityTypes.has(entityType) && !identifierKeys.has(key)) {
      addEnrichmentIdentifier(externalIdentifiers, identifierNaturalKeys, entityType, slug, displayName)
    }
  }

  for (const movement of seed.jointMovements) {
    if (!rangeMovementSlugs.has(movement.slug)) {
      const displayName = movement.movementName || titleFromSlug(movement.slug)

      rangesOfMotion.push({
        id: `rom-tracking-${movement.slug}`,
        slug: `rom-tracking-${movement.slug}`,
        joint: movement.joint,
        movement: movement.slug,
        typicalMinValue: 0,
        typicalMaxValue: 5,
        measurementUnit: "ordinal_0_5",
        measurementPosition: `Non-diagnostic MassageLab tracking scale for ${displayName}; record quality, ease, or observed range consistently for comparison over time.`,
        notes: "Generated tracking protocol for movements without a commercial-safe published degree reference in the seed. This is for education and longitudinal tracking, not diagnosis.",
        sourceRef: ROM_TRACKING_SOURCE,
      })
      rangeMovementSlugs.add(movement.slug)
    }
  }

  for (const bone of seed.bones) {
    if (!relationshipEntityKeys.has(`bone:${bone.slug}`)) {
      addEnrichmentRelationship(relationships, relationshipNaturalKeys, "bone", bone.slug, "located_in_region", "region", bone.region, bone.sourceRef)
    }
  }
  for (const landmark of seed.boneLandmarks) {
    if (!relationshipEntityKeys.has(`bone_landmark:${landmark.slug}`)) {
      addEnrichmentRelationship(relationships, relationshipNaturalKeys, "bone_landmark", landmark.slug, "landmark_of", "bone", landmark.bone, landmark.sourceRef)
    }
  }
  for (const joint of seed.joints) {
    if (!relationshipEntityKeys.has(`joint:${joint.slug}`)) {
      addEnrichmentRelationship(relationships, relationshipNaturalKeys, "joint", joint.slug, "located_in_region", "region", joint.region, joint.sourceRef)
    }
  }
  for (const movement of seed.jointMovements) {
    if (!relationshipEntityKeys.has(`joint_movement:${movement.slug}`)) {
      addEnrichmentRelationship(relationships, relationshipNaturalKeys, "joint_movement", movement.slug, "movement_of", "joint", movement.joint, movement.sourceRef)
    }
  }
  for (const muscle of seed.muscles) {
    if (!relationshipEntityKeys.has(`muscle:${muscle.slug}`)) {
      addEnrichmentRelationship(relationships, relationshipNaturalKeys, "muscle", muscle.slug, "located_in_region", "region", muscle.region, muscle.sourceRef)
    }
  }
  for (const nerve of seed.nerves) {
    if (!relationshipEntityKeys.has(`nerve:${nerve.slug}`)) {
      addEnrichmentRelationship(relationships, relationshipNaturalKeys, "nerve", nerve.slug, "located_in_region", "region", nerve.region, nerve.sourceRef)
    }
  }
  for (const ligament of seed.ligaments) {
    if (!relationshipEntityKeys.has(`ligament:${ligament.slug}`)) {
      if (ligament.joint) {
        addEnrichmentRelationship(relationships, relationshipNaturalKeys, "ligament", ligament.slug, "stabilizes", "joint", ligament.joint, ligament.sourceRef)
      } else {
        addEnrichmentRelationship(relationships, relationshipNaturalKeys, "ligament", ligament.slug, "located_in_region", "region", ligament.region, ligament.sourceRef)
      }
    }
  }
  for (const vessel of seed.bloodSupply) {
    if (!relationshipEntityKeys.has(`blood_supply:${vessel.slug}`)) {
      addEnrichmentRelationship(relationships, relationshipNaturalKeys, "blood_supply", vessel.slug, "located_in_region", "region", vessel.region, vessel.sourceRef)
    }
  }
  for (const structure of seed.structures) {
    if (!relationshipEntityKeys.has(`anatomy_structure:${structure.slug}`)) {
      addEnrichmentRelationship(relationships, relationshipNaturalKeys, "anatomy_structure", structure.slug, "located_in_region", "region", structure.region, structure.sourceRef)
    }
  }
  for (const painMapRegion of seed.painMapRegions) {
    if (!relationshipEntityKeys.has(`pain_map_region:${painMapRegion.slug}`)) {
      addEnrichmentRelationship(relationships, relationshipNaturalKeys, "pain_map_region", painMapRegion.slug, "maps_to_region", "region", painMapRegion.region, CLIENT_LANGUAGE_SOURCE, {
        laterality: painMapRegion.laterality ?? "unspecified",
        surface: painMapRegion.surface ?? "unspecified",
      })
    }
  }

  return {
    ...seed,
    entityTerms,
    externalIdentifiers,
    relationships,
    rangesOfMotion,
  }
}

type BodyParts3dTreeName = "isa" | "partof"
type BodyParts3dFallbackView = {
  slug: "anterior" | "posterior" | "left-lateral" | "right-lateral"
  title: string
  cameraMode: "front" | "back" | "left" | "right"
  description: string
}
type BodyParts3dFallbackProfile = {
  slug: string
  title: string
  description: string
  partIds: readonly string[]
  partNames: readonly string[]
  treeName: BodyParts3dTreeName
  role: AnatomyMediaRole
  mappingPrecision: "exact" | "composite" | "broad_context"
  note: string
}
type BodyParts3dPartListUpgrade = BodyParts3dFallbackProfile & {
  entityType: AnatomyEntityType
  entitySlug: string
}
type BodyParts3dEntityAnimationCandidate = {
  entityType: AnatomyEntityType
  entitySlug: string
  role: AnatomyMediaRole
  label: string
  sourceAssetSlug: string
  sourceAssetTitle: string
  sourceUrl: string
  partIds: string[]
  partNames: string[]
  treeName: BodyParts3dTreeName
  mappingPrecision: "exact" | "composite" | "broad_context" | "mapped"
  score: number
}
type BodyParts3dFallbackTarget = {
  entityType: AnatomyEntityType
  entitySlug: string
  label: string
  region?: string
}

const BODYPARTS3D_FALLBACK_SOURCE = "bodyparts3d"
const BODYPARTS3D_FALLBACK_ATTRIBUTION = "BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International."
const BODYPARTS3D_FALLBACK_LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/"
const BODYPARTS3D_FALLBACK_LICENSE_PAGE = "https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html"
const BODYPARTS3D_FALLBACK_API_DOCS = "https://lifesciencedb.jp/bp3d/info_en/webapi/index.html"
const BODYPARTS3D_FALLBACK_ANIMATION_DOCS = "https://lifesciencedb.jp/bp3d/info/webapi/method/animation.html"
const BODYPARTS3D_FALLBACK_ISA_PART_LIST = "https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/isa_parts_list_e.txt"
const BODYPARTS3D_FALLBACK_PARTOF_PART_LIST = "https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/partof_parts_list_e.txt"
const BODYPARTS3D_FALLBACK_SKELETON_BACKGROUND_ID = "FMA5018"
const BODYPARTS3D_FALLBACK_VIEWS: readonly BodyParts3dFallbackView[] = [
  { slug: "anterior", title: "Anterior View", cameraMode: "front", description: "from the anterior camera view" },
  { slug: "posterior", title: "Posterior View", cameraMode: "back", description: "from the posterior camera view" },
  { slug: "left-lateral", title: "Left Lateral View", cameraMode: "left", description: "from the left lateral camera view" },
  { slug: "right-lateral", title: "Right Lateral View", cameraMode: "right", description: "from the right lateral camera view" },
] as const

const BODY_PARTS_3D_FALLBACK_PROFILES = {
  muscleOrgan: profile("muscle-organ", "Muscle Organ", "BodyParts3D generic muscle-organ context for named muscles that do not expose a more specific reviewed part in the current BodyParts3D part lists.", ["FMA5022"], ["muscle organ"], "isa", "reference", "broad_context", "Generic muscle-organ fallback."),
  erectorSpinaeComposite: profile("erector-spinae-composite", "Erector Spinae Composite", "BodyParts3D composite render using iliocostalis, longissimus, and spinalis parts as erector-spinae context.", ["FMA77177", "FMA77178", "FMA77179"], ["iliocostalis", "longissimus", "spinalis"], "isa", "reference", "composite", "Composite fallback for erector-spinae rows."),
  extrinsicShoulderMuscle: profile("extrinsic-shoulder-muscle", "Extrinsic Shoulder Muscle", "BodyParts3D extrinsic-shoulder-muscle context for shoulder and upper-back muscles without exact BodyParts3D parts.", ["FMA32516"], ["extrinsic muscle of shoulder"], "isa", "reference", "broad_context", "Broad shoulder-girdle fallback."),
  intrinsicLaryngealMuscle: profile("intrinsic-laryngeal-muscle", "Intrinsic Laryngeal Muscle", "BodyParts3D intrinsic-laryngeal-muscle context for individual laryngeal muscles without exact BodyParts3D parts.", ["FMA55226"], ["intrinsic muscle of larynx"], "isa", "reference", "broad_context", "Broad intrinsic laryngeal fallback."),
  spinalis: profile("spinalis", "Spinalis", "BodyParts3D spinalis context for spinalis subdivisions without separate reviewed BodyParts3D parts.", ["FMA77179"], ["spinalis"], "isa", "reference", "broad_context", "Spinalis aggregate fallback."),
  semispinalis: profile("semispinalis", "Semispinalis", "BodyParts3D semispinalis context used as transversospinalis-region fallback where a separate multifidus part is not exposed.", ["FMA22823"], ["semispinalis"], "isa", "reference", "broad_context", "Broad transversospinalis fallback."),
  dorsalInterosseiHand: profile("dorsal-interossei-hand", "Dorsal Interossei of Hand", "BodyParts3D set-of-dorsal-interossei context for individual hand dorsal interossei.", ["FMA71319"], ["set of dorsal interossei of hand"], "isa", "reference", "broad_context", "Group hand-muscle fallback."),
  palmarInterosseiHand: profile("palmar-interossei-hand", "Palmar Interossei of Hand", "BodyParts3D set-of-palmar-interossei context for individual hand palmar interossei.", ["FMA71320"], ["set of palmar interossei of hand"], "isa", "reference", "broad_context", "Group hand-muscle fallback."),
  lumbricalsHand: profile("lumbricals-hand", "Lumbricals of Hand", "BodyParts3D set-of-lumbricals context for individual hand lumbricals.", ["FMA71318"], ["set of lumbricals of hand"], "isa", "reference", "broad_context", "Group hand-muscle fallback."),
  interosseousFoot: profile("interosseous-foot", "Interosseous Muscles of Foot", "BodyParts3D interosseous-foot context for dorsal foot interossei rows without separate dorsal BodyParts3D parts.", ["FMA37456"], ["interosseous of foot"], "isa", "reference", "broad_context", "Group foot-muscle fallback."),
  lumbricalFoot: profile("lumbrical-foot", "Lumbrical of Foot", "BodyParts3D lumbrical-foot context for the grouped foot lumbricals row.", ["FMA37453"], ["lumbrical of foot"], "isa", "reference", "broad_context", "Group foot-muscle fallback."),
  muscleOfFace: profile("muscle-of-face", "Muscle of Face", "BodyParts3D muscle-of-face context for facial expression muscles without exact BodyParts3D parts.", ["FMA46751"], ["muscle of face"], "isa", "reference", "broad_context", "Broad facial-expression fallback."),
  muscleOfHead: profile("muscle-of-head", "Muscle of Head", "BodyParts3D muscle-of-head context for mastication and auricular muscles without exact BodyParts3D parts.", ["FMA9616"], ["muscle of head"], "isa", "reference", "broad_context", "Broad head-muscle fallback."),
  tongueMuscle: profile("tongue-muscle", "Muscle of Tongue", "BodyParts3D muscle-of-tongue context for intrinsic and extrinsic tongue muscles without exact BodyParts3D parts.", ["FMA46689"], ["muscle of tongue"], "isa", "reference", "broad_context", "Broad tongue-muscle fallback."),
  deltoidAnterior: profile("deltoid-anterior-fibers", "Deltoid Anterior Fibers", "BodyParts3D clavicular part of deltoid used for the anterior deltoid fiber row.", ["FMA34677"], ["clavicular part of deltoid"], "isa", "primary", "exact", "Exact BodyParts3D deltoid part fallback."),
  deltoidMiddle: profile("deltoid-middle-fibers", "Deltoid Middle Fibers", "BodyParts3D acromial part of deltoid used for the middle deltoid fiber row.", ["FMA34678"], ["acromial part of deltoid"], "isa", "primary", "exact", "Exact BodyParts3D deltoid part fallback."),
  deltoidPosterior: profile("deltoid-posterior-fibers", "Deltoid Posterior Fibers", "BodyParts3D spinal part of deltoid used for the posterior deltoid fiber row.", ["FMA34679"], ["spinal part of deltoid"], "isa", "primary", "exact", "Exact BodyParts3D deltoid part fallback."),
  abdominalWallMuscle: profile("anterior-abdominal-wall-muscle", "Muscle of Anterior Abdominal Wall", "BodyParts3D anterior-abdominal-wall muscle context for abdominal wall muscles without exact BodyParts3D parts.", ["FMA20278"], ["muscle of anterior abdominal wall"], "isa", "reference", "broad_context", "Broad abdominal-wall fallback."),
  abdomenMuscle: profile("muscle-of-abdomen", "Muscle of Abdomen", "BodyParts3D muscle-of-abdomen context for posterior abdominal wall muscle rows without exact BodyParts3D parts.", ["FMA9620"], ["muscle of abdomen"], "isa", "reference", "broad_context", "Broad abdomen-muscle fallback."),
  iliopsoasComposite: profile("iliopsoas-composite", "Iliopsoas Composite", "BodyParts3D composite render using iliacus and psoas major as iliopsoas context.", ["FMA22310", "FMA18060"], ["iliacus", "psoas major"], "isa", "reference", "composite", "Composite iliopsoas-region fallback."),
  perinealMuscle: profile("perineal-muscle", "Perineal Muscle", "BodyParts3D perineal-muscle context for named superficial perineal muscles without exact BodyParts3D parts.", ["FMA9623"], ["perineal muscle"], "isa", "reference", "broad_context", "Broad perineal-muscle fallback."),
  handMuscle: profile("muscle-of-hand", "Muscle of Hand", "BodyParts3D muscle-of-hand context for hand muscles without exact BodyParts3D parts.", ["FMA37372"], ["muscle of hand"], "isa", "reference", "broad_context", "Broad hand-muscle fallback."),
  medialThighMuscle: profile("medial-thigh-muscle", "Muscle of Medial Compartment of Thigh", "BodyParts3D medial-thigh-compartment muscle context for the grouped adductor row.", ["FMA22439"], ["muscle of medial compartment of thigh"], "isa", "reference", "broad_context", "Broad adductor-compartment fallback."),
  anteriorThighMuscle: profile("anterior-thigh-muscle", "Muscle of Anterior Compartment of Thigh", "BodyParts3D anterior-thigh-compartment muscle context for the articularis genus row.", ["FMA22424"], ["muscle of anterior compartment of thigh"], "isa", "reference", "broad_context", "Broad anterior-thigh fallback."),
  intrinsicFootDorsum: profile("intrinsic-foot-dorsum-muscle", "Intrinsic Muscle of Dorsum of Foot", "BodyParts3D intrinsic-dorsum-of-foot muscle context for extensor digitorum brevis of foot.", ["FMA65045"], ["intrinsic muscle of dorsum of foot"], "isa", "reference", "broad_context", "Broad dorsal-foot fallback."),
  hipBone: profile("hip-bone", "Hip Bone", "BodyParts3D hip-bone context for ilium, ischium, and pubis rows where separate parts are not exposed.", ["FMA16585"], ["hip bone"], "isa", "reference", "broad_context", "Broad hip-bone fallback."),
  sacrum: profile("sacrum", "Sacrum", "BodyParts3D sacrum context for sacral-segment rows where individual sacral vertebrae are not exposed.", ["FMA16202"], ["sacrum"], "isa", "reference", "broad_context", "Broad sacral fallback."),
  pelvicSkeleton: profile("pelvic-skeleton", "Pelvic Skeleton", "BodyParts3D pelvic-skeleton context for coccygeal and pelvic rows without exact parts.", ["FMA72062"], ["pelvic skeleton"], "partof", "reference", "broad_context", "Broad pelvic-skeleton fallback."),
  sesamoidBone: profile("sesamoid-bone", "Sesamoid Bone", "BodyParts3D sesamoid-bone context for hand sesamoid rows.", ["FMA32672"], ["sesamoid bone"], "isa", "reference", "broad_context", "Generic sesamoid fallback."),
  footSesamoidBone: profile("foot-sesamoid-bone", "Sesamoid Bone of Foot", "BodyParts3D foot sesamoid context for foot sesamoid rows.", ["FMA45096"], ["sesamoid bone of foot"], "isa", "reference", "broad_context", "Foot sesamoid fallback."),
  externalEar: profile("external-ear", "External Ear", "BodyParts3D external-ear context for the stapes row; BodyParts3D does not expose a stapes part in the checked part lists.", ["FMA52781"], ["external ear"], "partof", "reference", "broad_context", "Broad ear fallback."),
  skeletalLigament: profile("skeletal-ligament", "Skeletal Ligament", "BodyParts3D skeletal-ligament context for named ligaments without exact BodyParts3D parts.", ["FMA25624"], ["skeletal ligament"], "isa", "reference", "broad_context", "Generic skeletal-ligament fallback."),
  tarsalLigament: profile("tarsal-ligament", "Tarsal Ligament", "BodyParts3D tarsal-ligament context for foot and ankle ligament rows without exact BodyParts3D parts.", ["FMA44197"], ["tarsal ligament"], "isa", "reference", "broad_context", "Broad tarsal-ligament fallback."),
  plantarTarsalLigament: profile("plantar-tarsal-ligament", "Plantar Tarsal Ligament", "BodyParts3D plantar-tarsal-ligament context for plantar foot ligament rows without exact BodyParts3D parts.", ["FMA44245"], ["plantar tarsal ligament"], "isa", "reference", "broad_context", "Broad plantar-ligament fallback."),
  longPlantarLigament: profile("long-plantar-ligament", "Long Plantar Ligament", "BodyParts3D long plantar ligament render.", ["FMA44248"], ["long plantar ligament"], "isa", "primary", "exact", "Exact BodyParts3D ligament fallback."),
  nerve: profile("nerve", "Nerve", "BodyParts3D generic nerve context for named nerves without exact BodyParts3D parts.", ["FMA65132"], ["nerve"], "isa", "reference", "broad_context", "Generic nerve fallback."),
  cranialNerve: profile("cranial-nerve", "Cranial Nerve", "BodyParts3D cranial-nerve context for cranial nerve rows without exact BodyParts3D parts.", ["FMA5865"], ["cranial nerve"], "isa", "reference", "broad_context", "Broad cranial-nerve fallback."),
  trigeminalBranch: profile("branch-of-trigeminal-nerve", "Branch of Trigeminal Nerve", "BodyParts3D trigeminal-branch context for trigeminal division rows.", ["FMA52607"], ["branch of trigeminal nerve"], "isa", "reference", "broad_context", "Broad trigeminal-branch fallback."),
  opticNerve: profile("optic-nerve", "Optic Nerve", "BodyParts3D optic nerve render.", ["FMA50863"], ["optic nerve"], "isa", "primary", "exact", "Exact BodyParts3D nerve fallback."),
  trochlearNerve: profile("trochlear-nerve", "Trochlear Nerve", "BodyParts3D trochlear nerve render.", ["FMA50865"], ["trochlear nerve"], "isa", "primary", "exact", "Exact BodyParts3D nerve fallback."),
  vascularTree: profile("vascular-tree", "Vascular Tree", "BodyParts3D vascular-tree context for named vessels without exact BodyParts3D parts.", ["FMA3710"], ["vascular tree"], "isa", "reference", "broad_context", "Broad vascular fallback."),
  anatomicalStructure: profile("anatomical-structure", "Anatomical Structure", "BodyParts3D anatomical-structure context for miscellaneous structures without exact BodyParts3D parts.", ["FMA67135"], ["anatomical structure"], "isa", "reference", "broad_context", "Generic structure fallback."),
  humanBody: profile("human-body", "Human Body", "BodyParts3D human-body context for broad regions and pain-map rows without exact BodyParts3D parts.", ["FMA20394"], ["human body"], "partof", "region_context", "broad_context", "Generic body-region fallback."),
  skeletalSystem: profile("skeletal-system", "Skeletal System", "BodyParts3D skeletal-system context for joints, discs, bursae, labra, and other musculoskeletal rows without exact BodyParts3D parts.", ["FMA23881"], ["skeletal system"], "partof", "reference", "broad_context", "Generic skeletal-system fallback."),
  skin: profile("skin", "Skin", "BodyParts3D skin context for skin, dermatome, and cutaneous rows.", ["FMA7163"], ["skin"], "isa", "reference", "broad_context", "Broad skin fallback."),
  skinAppendage: profile("skin-appendage", "Skin Appendage", "BodyParts3D skin-appendage context for hair, nail, and gland rows.", ["FMA71012"], ["skin appendage"], "isa", "reference", "broad_context", "Broad skin-appendage fallback."),
  heart: profile("heart", "Heart", "BodyParts3D heart context for cardiac rows.", ["FMA7088"], ["heart"], "partof", "reference", "broad_context", "Broad cardiac fallback."),
  kidney: profile("kidney", "Kidney", "BodyParts3D kidney context for renal rows.", ["FMA7203"], ["kidney"], "isa", "reference", "broad_context", "Broad renal fallback."),
  brain: profile("brain", "Brain", "BodyParts3D brain context for nervous-system structures.", ["FMA50801"], ["brain"], "partof", "reference", "broad_context", "Broad brain fallback."),
  deepFascialSystem: profile("deep-fascial-system", "Deep Fascial System", "BodyParts3D deep-fascial-system context for fascia, compartment, aponeurosis, and retinaculum rows.", ["FMA79063"], ["deep fascial system"], "partof", "reference", "broad_context", "Broad fascial fallback."),
  tendon: profile("tendon", "Tendon", "BodyParts3D tendon context for tendon and tendon-sheath rows.", ["FMA9721"], ["tendon"], "isa", "reference", "broad_context", "Broad tendon fallback."),
  tooth: profile("tooth", "Tooth", "BodyParts3D tooth context for tooth rows.", ["FMA12516"], ["tooth"], "isa", "reference", "broad_context", "Broad tooth fallback."),
  cricoidCartilage: profile("cricoid-cartilage", "Cricoid Cartilage", "BodyParts3D cricoid cartilage render.", ["FMA9615"], ["cricoid cartilage"], "isa", "primary", "exact", "Exact BodyParts3D cartilage fallback."),
  arytenoidCartilage: profile("arytenoid-cartilage", "Arytenoid Cartilage", "BodyParts3D arytenoid cartilage render.", ["FMA55109"], ["arytenoid cartilage"], "isa", "primary", "exact", "Exact BodyParts3D cartilage fallback."),
  epiglottis: profile("epiglottis", "Epiglottis", "BodyParts3D epiglottis render.", ["FMA55130"], ["epiglottis"], "isa", "primary", "exact", "Exact BodyParts3D structure fallback."),
  neck: profile("neck", "Neck", "BodyParts3D neck context.", ["FMA7155"], ["neck"], "partof", "region_context", "broad_context", "Broad neck-region fallback."),
  shoulder: profile("shoulder", "Shoulder", "BodyParts3D shoulder context.", ["FMA33642"], ["right shoulder"], "partof", "region_context", "broad_context", "Broad shoulder-region fallback."),
  thoraxBack: profile("back-of-thorax", "Back of Thorax", "BodyParts3D back-of-thorax context.", ["FMA24217"], ["back of thorax"], "partof", "region_context", "broad_context", "Broad thoracic-back fallback."),
  abdomen: profile("abdomen", "Abdomen", "BodyParts3D abdomen context.", ["FMA9577"], ["abdomen"], "partof", "region_context", "broad_context", "Broad abdomen-region fallback."),
  hip: profile("hip", "Hip", "BodyParts3D hip context.", ["FMA24965"], ["right hip"], "partof", "region_context", "broad_context", "Broad hip-region fallback."),
  thigh: profile("thigh", "Thigh", "BodyParts3D thigh context.", ["FMA24968"], ["right thigh"], "partof", "region_context", "broad_context", "Broad thigh-region fallback."),
  knee: profile("knee", "Knee", "BodyParts3D knee context.", ["FMA24977"], ["right knee"], "partof", "region_context", "broad_context", "Broad knee-region fallback."),
  leg: profile("leg", "Leg", "BodyParts3D leg context.", ["FMA24980"], ["right leg"], "partof", "region_context", "broad_context", "Broad leg-region fallback."),
  forearm: profile("forearm", "Forearm", "BodyParts3D forearm context.", ["FMA11345"], ["right forearm"], "partof", "region_context", "broad_context", "Broad forearm-region fallback."),
  wrist: profile("wrist", "Wrist", "BodyParts3D wrist context.", ["FMA24940"], ["right wrist"], "partof", "region_context", "broad_context", "Broad wrist-region fallback."),
  face: profile("face", "Face", "BodyParts3D face context.", ["FMA24728"], ["face"], "partof", "region_context", "broad_context", "Broad face-region fallback."),
  head: profile("head", "Head", "BodyParts3D head context.", ["FMA7154"], ["head"], "partof", "region_context", "broad_context", "Broad head-region fallback."),
}

function profile(
  slug: string,
  title: string,
  description: string,
  partIds: readonly string[],
  partNames: readonly string[],
  treeName: BodyParts3dTreeName,
  role: AnatomyMediaRole,
  mappingPrecision: BodyParts3dFallbackProfile["mappingPrecision"],
  note: string,
): BodyParts3dFallbackProfile {
  return { slug, title, description, partIds, partNames, treeName, role, mappingPrecision, note }
}

function bodyParts3dFallbackImageUrl(profile: BodyParts3dFallbackProfile, view: BodyParts3dFallbackView): string {
  return `https://lifesciencedb.jp/bp3d/API/image?${encodeURIComponent(JSON.stringify(bodyParts3dRenderConfig(profile, view)))}`
}

function bodyParts3dFallbackAnimationUrl(profile: BodyParts3dFallbackProfile): string {
  return `https://lifesciencedb.jp/bp3d/API/animation?${encodeURIComponent(JSON.stringify(bodyParts3dRenderConfig(profile)))}`
}

function bodyParts3dRenderConfig(profile: BodyParts3dFallbackProfile, view?: BodyParts3dFallbackView) {
  const config = {
    Common: {
      Version: "4.1",
      TreeName: profile.treeName,
    },
    Window: {
      ImageWidth: 700,
      ImageHeight: 700,
    },
    Part: [
      {
        PartID: BODYPARTS3D_FALLBACK_SKELETON_BACKGROUND_ID,
        PartOpacity: 0.15,
        UseForBoundingBoxFlag: false,
      },
      ...profile.partIds.map((partId) => ({
        PartID: partId,
        PartColor: "D83A3A",
        PartOpacity: 1,
      })),
    ],
  }

  return view ? { ...config, Camera: { CameraMode: view.cameraMode } } : config
}

function bodyParts3dPartListUpgrade(
  entityType: AnatomyEntityType,
  entitySlug: string,
  slug: string,
  title: string,
  description: string,
  partIds: readonly string[],
  partNames: readonly string[],
  treeName: BodyParts3dTreeName,
  role: AnatomyMediaRole,
  mappingPrecision: BodyParts3dFallbackProfile["mappingPrecision"],
  note: string,
): BodyParts3dPartListUpgrade {
  return { ...profile(slug, title, description, partIds, partNames, treeName, role, mappingPrecision, note), entityType, entitySlug }
}

const BODY_PARTS_3D_PART_LIST_UPGRADES: readonly BodyParts3dPartListUpgrade[] = [
  bodyParts3dPartListUpgrade("anatomy_structure", "hair", "hair", "Hair", "BodyParts3D part-list exact render for hair.", ["FMA53667"], ["hair"], "isa", "primary", "exact", "Exact BodyParts3D part-list match for hair."),
  bodyParts3dPartListUpgrade("anatomy_structure", "ureter", "ureter", "Ureter", "BodyParts3D part-list exact render for ureter.", ["FMA9704"], ["ureter"], "isa", "primary", "exact", "Exact BodyParts3D part-list match for ureter."),
  bodyParts3dPartListUpgrade("anatomy_structure", "urethra", "urethra", "Urethra", "BodyParts3D part-list exact render for urethra.", ["FMA19667"], ["urethra"], "isa", "primary", "exact", "Exact BodyParts3D part-list match for urethra."),
  bodyParts3dPartListUpgrade("anatomy_structure", "epididymis", "epididymis", "Epididymis", "BodyParts3D part-list exact render for epididymis.", ["FMA18255"], ["epididymis"], "isa", "primary", "exact", "Exact BodyParts3D part-list match for epididymis."),
  bodyParts3dPartListUpgrade("anatomy_structure", "cerebellum", "cerebellum", "Cerebellum", "BodyParts3D part-list exact render for cerebellum.", ["FMA67944"], ["cerebellum"], "isa", "primary", "exact", "Exact BodyParts3D part-list match for cerebellum."),
  bodyParts3dPartListUpgrade("anatomy_structure", "ganglion", "ganglion", "Ganglion", "BodyParts3D part-list render for generic ganglion.", ["FMA5884"], ["ganglion"], "isa", "primary", "exact", "Exact BodyParts3D part-list match for the generic ganglion row."),
  bodyParts3dPartListUpgrade("anatomy_structure", "sclera", "sclera", "Sclera", "BodyParts3D part-list exact render for sclera.", ["FMA58269"], ["sclera"], "isa", "primary", "exact", "Exact BodyParts3D part-list match for sclera."),
  bodyParts3dPartListUpgrade("anatomy_structure", "linea-alba", "linea-alba", "Linea Alba", "BodyParts3D part-list exact render for linea alba.", ["FMA11336"], ["linea alba"], "isa", "primary", "exact", "Exact BodyParts3D part-list match for linea alba."),
  bodyParts3dPartListUpgrade("anatomy_structure", "pterygomandibular-raphe", "pterygomandibular-raphe", "Pterygomandibular Raphe", "BodyParts3D part-list exact render for pterygomandibular raphe.", ["FMA55618"], ["pterygomandibular raphe"], "isa", "primary", "exact", "Exact BodyParts3D part-list match for pterygomandibular raphe."),
  bodyParts3dPartListUpgrade("region", "forearm", "forearm-region-composite", "Forearm Region", "BodyParts3D part-list composite render using right and left forearm region parts.", ["FMA11345", "FMA11346"], ["right forearm", "left forearm"], "partof", "region_context", "composite", "Composite BodyParts3D part-list match using side-specific forearm parts."),
  bodyParts3dPartListUpgrade("region", "wrist", "wrist-region-composite", "Wrist Region", "BodyParts3D part-list composite render using right and left wrist region parts.", ["FMA24940", "FMA24941"], ["right wrist", "left wrist"], "partof", "region_context", "composite", "Composite BodyParts3D part-list match using side-specific wrist parts."),
  bodyParts3dPartListUpgrade("region", "hip", "hip-region-composite", "Hip Region", "BodyParts3D part-list composite render using right and left hip region parts.", ["FMA24965", "FMA24966"], ["right hip", "left hip"], "partof", "region_context", "composite", "Composite BodyParts3D part-list match using side-specific hip parts."),
  bodyParts3dPartListUpgrade("region", "thigh", "thigh-region-composite", "Thigh Region", "BodyParts3D part-list composite render using right and left thigh region parts.", ["FMA24968", "FMA24969"], ["right thigh", "left thigh"], "partof", "region_context", "composite", "Composite BodyParts3D part-list match using side-specific thigh parts."),
  bodyParts3dPartListUpgrade("region", "knee", "knee-region-composite", "Knee Region", "BodyParts3D part-list composite render using right and left knee region parts.", ["FMA24977", "FMA24978"], ["right knee", "left knee"], "partof", "region_context", "composite", "Composite BodyParts3D part-list match using side-specific knee parts."),
  bodyParts3dPartListUpgrade("region", "leg", "leg-region-composite", "Leg Region", "BodyParts3D part-list composite render using right and left leg region parts.", ["FMA24980", "FMA24981"], ["right leg", "left leg"], "partof", "region_context", "composite", "Composite BodyParts3D part-list match using side-specific leg parts."),
  bodyParts3dPartListUpgrade("pain_map_region", "abdomen", "abdomen-pain-region", "Abdomen Pain Map Region", "BodyParts3D part-list render for abdomen body-map context.", ["FMA9577"], ["abdomen"], "partof", "region_context", "exact", "Exact BodyParts3D part-list match for abdomen."),
]

function bodyParts3dFallbackTargets(seed: AnatomyFoundationSeed): BodyParts3dFallbackTarget[] {
  return [
    ...seed.bodyRegions.map((entity) => ({ entityType: "region" as const, entitySlug: entity.slug, label: entity.name })),
    ...seed.bodySubregions.map((entity) => ({ entityType: "region" as const, entitySlug: entity.slug, label: entity.name, region: entity.region })),
    ...seed.bones.map((entity) => ({ entityType: "bone" as const, entitySlug: entity.slug, label: entity.name, region: entity.region })),
    ...seed.joints.map((entity) => ({ entityType: "joint" as const, entitySlug: entity.slug, label: entity.name, region: entity.region })),
    ...seed.muscles.map((entity) => ({ entityType: "muscle" as const, entitySlug: entity.slug, label: entity.name, region: entity.region })),
    ...seed.nerves.map((entity) => ({ entityType: "nerve" as const, entitySlug: entity.slug, label: entity.name, region: entity.region })),
    ...seed.ligaments.map((entity) => ({ entityType: "ligament" as const, entitySlug: entity.slug, label: entity.name, region: entity.region })),
    ...seed.bloodSupply.map((entity) => ({ entityType: "blood_supply" as const, entitySlug: entity.slug, label: entity.name, region: entity.region })),
    ...seed.structures.map((entity) => ({ entityType: "anatomy_structure" as const, entitySlug: entity.slug, label: entity.name, region: entity.region })),
    ...seed.painMapRegions.map((entity) => ({ entityType: "pain_map_region" as const, entitySlug: entity.slug, label: entity.name, region: entity.region })),
  ]
}

function bodyParts3dFallbackProfileFor(target: BodyParts3dFallbackTarget): BodyParts3dFallbackProfile {
  switch (target.entityType) {
    case "muscle":
      return bodyParts3dMuscleFallbackProfile(target)
    case "bone":
      return bodyParts3dBoneFallbackProfile(target)
    case "ligament":
      return bodyParts3dLigamentFallbackProfile(target)
    case "nerve":
      return bodyParts3dNerveFallbackProfile(target)
    case "blood_supply":
      return bodyParts3dBloodSupplyFallbackProfile(target)
    case "joint":
      return bodyParts3dRegionFallbackProfile(target)
    case "anatomy_structure":
      return bodyParts3dStructureFallbackProfile(target)
    case "pain_map_region":
    case "region":
      return bodyParts3dRegionFallbackProfile(target)
    default:
      return BODY_PARTS_3D_FALLBACK_PROFILES.anatomicalStructure
  }
}

function bodyParts3dMuscleFallbackProfile(target: BodyParts3dFallbackTarget): BodyParts3dFallbackProfile {
  const slug = target.entitySlug
  if (["erector-spinae-upper-thoracic", "lumbar-erector-spinae"].includes(slug)) return BODY_PARTS_3D_FALLBACK_PROFILES.erectorSpinaeComposite
  if (slug === "latissimus-dorsi") return BODY_PARTS_3D_FALLBACK_PROFILES.extrinsicShoulderMuscle
  if (["posterior-cricoarytenoid", "lateral-cricoarytenoid", "thyroarytenoid", "thyroepiglotticus"].includes(slug)) return BODY_PARTS_3D_FALLBACK_PROFILES.intrinsicLaryngealMuscle
  if (["spinalis-capitis", "spinalis-cervicis"].includes(slug)) return BODY_PARTS_3D_FALLBACK_PROFILES.spinalis
  if (["multifidus-cervicis", "multifidus-thoracis", "lumbar-multifidus"].includes(slug)) return BODY_PARTS_3D_FALLBACK_PROFILES.semispinalis
  if (slug.startsWith("dorsal-interosseous-hand-")) return BODY_PARTS_3D_FALLBACK_PROFILES.dorsalInterosseiHand
  if (slug.startsWith("palmar-interosseous-hand-")) return BODY_PARTS_3D_FALLBACK_PROFILES.palmarInterosseiHand
  if (slug.startsWith("lumbrical-hand-")) return BODY_PARTS_3D_FALLBACK_PROFILES.lumbricalsHand
  if (slug.startsWith("dorsal-interosseous-foot-") || slug === "dorsal-interossei-foot") return BODY_PARTS_3D_FALLBACK_PROFILES.interosseousFoot
  if (slug === "lumbricals-foot") return BODY_PARTS_3D_FALLBACK_PROFILES.lumbricalFoot
  if (slug === "deltoid-anterior-fibers") return BODY_PARTS_3D_FALLBACK_PROFILES.deltoidAnterior
  if (slug === "deltoid-middle-fibers") return BODY_PARTS_3D_FALLBACK_PROFILES.deltoidMiddle
  if (slug === "deltoid-posterior-fibers") return BODY_PARTS_3D_FALLBACK_PROFILES.deltoidPosterior
  if (["rectus-abdominis", "internal-oblique", "transversus-abdominis"].includes(slug)) return BODY_PARTS_3D_FALLBACK_PROFILES.abdominalWallMuscle
  if (slug === "quadratus-lumborum") return BODY_PARTS_3D_FALLBACK_PROFILES.abdomenMuscle
  if (["iliopsoas", "psoas-minor"].includes(slug)) return BODY_PARTS_3D_FALLBACK_PROFILES.iliopsoasComposite
  if (["bulbospongiosus", "ischiocavernosus"].includes(slug)) return BODY_PARTS_3D_FALLBACK_PROFILES.perinealMuscle
  if (slug === "palmaris-brevis") return BODY_PARTS_3D_FALLBACK_PROFILES.handMuscle
  if (slug === "adductor-group") return BODY_PARTS_3D_FALLBACK_PROFILES.medialThighMuscle
  if (slug === "articularis-genus") return BODY_PARTS_3D_FALLBACK_PROFILES.anteriorThighMuscle
  if (slug === "extensor-digitorum-brevis-foot") return BODY_PARTS_3D_FALLBACK_PROFILES.intrinsicFootDorsum
  if (["superior-longitudinal-tongue", "inferior-longitudinal-tongue", "transverse-tongue", "vertical-tongue", "styloglossus", "palatoglossus"].includes(slug)) return BODY_PARTS_3D_FALLBACK_PROFILES.tongueMuscle
  if (["masseter", "temporalis", "medial-pterygoid", "lateral-pterygoid", "auricularis-anterior", "auricularis-superior", "auricularis-posterior"].includes(slug)) return BODY_PARTS_3D_FALLBACK_PROFILES.muscleOfHead
  if (target.region === "face" || target.region === "head-face-jaw") return BODY_PARTS_3D_FALLBACK_PROFILES.muscleOfFace

  return BODY_PARTS_3D_FALLBACK_PROFILES.muscleOrgan
}

function bodyParts3dBoneFallbackProfile(target: BodyParts3dFallbackTarget): BodyParts3dFallbackProfile {
  const slug = target.entitySlug
  if (["ilium", "ischium", "pubis"].includes(slug)) return BODY_PARTS_3D_FALLBACK_PROFILES.hipBone
  if (["s1-vertebra", "s2-vertebra", "s3-vertebra", "s4-vertebra", "s5-vertebra"].includes(slug)) return BODY_PARTS_3D_FALLBACK_PROFILES.sacrum
  if (["coccygeal-vertebrae", "coccyx"].includes(slug)) return BODY_PARTS_3D_FALLBACK_PROFILES.pelvicSkeleton
  if (slug === "hand-sesamoid-bones") return BODY_PARTS_3D_FALLBACK_PROFILES.sesamoidBone
  if (slug === "foot-sesamoid-bones") return BODY_PARTS_3D_FALLBACK_PROFILES.footSesamoidBone
  if (slug === "stapes") return BODY_PARTS_3D_FALLBACK_PROFILES.externalEar

  return BODY_PARTS_3D_FALLBACK_PROFILES.skeletalSystem
}

function bodyParts3dLigamentFallbackProfile(target: BodyParts3dFallbackTarget): BodyParts3dFallbackProfile {
  const slug = target.entitySlug
  if (slug === "long-plantar-ligament") return BODY_PARTS_3D_FALLBACK_PROFILES.longPlantarLigament
  if (/tars|plantar|talofibular|calcaneofibular|deltoid-ligament-ankle|spring|bifurcate|tibiofibular/.test(slug)) return BODY_PARTS_3D_FALLBACK_PROFILES.tarsalLigament
  if (/plantar|spring/.test(slug)) return BODY_PARTS_3D_FALLBACK_PROFILES.plantarTarsalLigament

  return BODY_PARTS_3D_FALLBACK_PROFILES.skeletalLigament
}

function bodyParts3dNerveFallbackProfile(target: BodyParts3dFallbackTarget): BodyParts3dFallbackProfile {
  const slug = target.entitySlug
  if (slug === "optic-nerve") return BODY_PARTS_3D_FALLBACK_PROFILES.opticNerve
  if (slug === "trochlear-nerve") return BODY_PARTS_3D_FALLBACK_PROFILES.trochlearNerve
  if (["trigeminal-nerve", "mandibular-division-trigeminal", "maxillary-division-trigeminal"].includes(slug)) return BODY_PARTS_3D_FALLBACK_PROFILES.trigeminalBranch
  if (/olfactory|oculomotor|abducens|glossopharyngeal|facial-nerve|hypoglossal|vagus|accessory/.test(slug)) return BODY_PARTS_3D_FALLBACK_PROFILES.cranialNerve

  return BODY_PARTS_3D_FALLBACK_PROFILES.nerve
}

function bodyParts3dBloodSupplyFallbackProfile(target: BodyParts3dFallbackTarget): BodyParts3dFallbackProfile {
  const exactProfiles: Record<string, BodyParts3dFallbackProfile> = {
    "brachiocephalic-trunk": profile("brachiocephalic-trunk", "Brachiocephalic Trunk", "BodyParts3D brachiocephalic artery render used for the brachiocephalic trunk row.", ["FMA3932"], ["brachiocephalic artery"], "isa", "primary", "exact", "BodyParts3D uses brachiocephalic artery terminology."),
    "brachiocephalic-veins": profile("brachiocephalic-veins", "Brachiocephalic Veins", "BodyParts3D brachiocephalic vein render.", ["FMA4723"], ["brachiocephalic vein"], "isa", "primary", "exact", "Exact BodyParts3D vessel fallback."),
    "brachial-veins": profile("brachial-veins", "Brachial Veins", "BodyParts3D brachial vein render.", ["FMA22934"], ["brachial vein"], "isa", "primary", "exact", "Exact BodyParts3D vessel fallback."),
    "radial-veins": profile("radial-veins", "Radial Veins", "BodyParts3D radial vein render.", ["FMA22947"], ["radial vein"], "isa", "primary", "exact", "Exact BodyParts3D vessel fallback."),
    "ulnar-veins": profile("ulnar-veins", "Ulnar Veins", "BodyParts3D ulnar vein render.", ["FMA22950"], ["ulnar vein"], "isa", "primary", "exact", "Exact BodyParts3D vessel fallback."),
    "deep-femoral-artery": profile("deep-femoral-artery", "Deep Femoral Artery", "BodyParts3D right and left deep femoral artery composite render.", ["FMA20796", "FMA20797"], ["right deep femoral artery", "left deep femoral artery"], "partof", "primary", "composite", "BodyParts3D exposes side-specific deep femoral artery parts."),
    "deep-palmar-arch": profile("deep-palmar-arch", "Deep Palmar Arch", "BodyParts3D right and left deep palmar arch composite render.", ["FMA22839", "FMA22840"], ["right deep palmar arch", "left deep palmar arch"], "isa", "primary", "composite", "BodyParts3D exposes side-specific deep palmar arch parts."),
    "plantar-arteries": profile("plantar-arteries", "Plantar Arteries", "BodyParts3D medial and lateral plantar artery composite render.", ["FMA43925", "FMA43926"], ["medial plantar artery", "lateral plantar artery"], "isa", "reference", "composite", "Composite plantar artery fallback."),
    "renal-arteries": profile("renal-arteries", "Renal Arteries", "BodyParts3D renal artery render.", ["FMA14751"], ["renal artery"], "isa", "primary", "exact", "Exact BodyParts3D vessel fallback."),
    "renal-veins": profile("renal-veins", "Renal Veins", "BodyParts3D renal vein render.", ["FMA14334"], ["renal vein"], "isa", "primary", "exact", "Exact BodyParts3D vessel fallback."),
    "hepatic-veins": profile("hepatic-veins", "Hepatic Veins", "BodyParts3D hepatic vein render.", ["FMA14337"], ["hepatic vein"], "isa", "primary", "exact", "Exact BodyParts3D vessel fallback."),
    "common-iliac-veins": profile("common-iliac-veins", "Common Iliac Veins", "BodyParts3D common iliac vein render.", ["FMA14333"], ["common iliac vein"], "isa", "primary", "exact", "Exact BodyParts3D vessel fallback."),
    "inferior-phrenic-arteries": profile("inferior-phrenic-arteries", "Inferior Phrenic Arteries", "BodyParts3D inferior phrenic artery render.", ["FMA14734"], ["inferior phrenic artery"], "isa", "primary", "exact", "Exact BodyParts3D vessel fallback."),
    "coronary-arteries": profile("coronary-arteries", "Coronary Arteries", "BodyParts3D coronary artery render.", ["FMA49893"], ["coronary artery"], "isa", "primary", "exact", "Exact BodyParts3D vessel fallback."),
    "cardiac-veins": profile("cardiac-veins", "Cardiac Veins", "BodyParts3D cardiac vein render.", ["FMA12846"], ["cardiac vein"], "isa", "primary", "exact", "Exact BodyParts3D vessel fallback."),
    "lateral-circumflex-femoral-artery": profile("lateral-circumflex-femoral-artery", "Lateral Circumflex Femoral Artery", "BodyParts3D lateral circumflex femoral artery render.", ["FMA20798"], ["lateral circumflex femoral artery"], "isa", "primary", "exact", "Exact BodyParts3D vessel fallback."),
    "occipital-artery": profile("occipital-artery", "Occipital Artery", "BodyParts3D occipital artery context using lateral and medial occipital arteries.", ["FMA50633", "FMA50638"], ["lateral occipital artery", "medial occipital artery"], "isa", "reference", "composite", "Composite occipital artery fallback."),
    "posterior-interosseous-artery": profile("posterior-interosseous-artery", "Posterior Interosseous Artery", "BodyParts3D common and anterior interosseous artery context where posterior interosseous is not exposed.", ["FMA22806", "FMA22810"], ["common interosseous artery", "anterior interosseous artery"], "isa", "reference", "broad_context", "Broad interosseous artery fallback."),
  }

  return exactProfiles[target.entitySlug] ?? BODY_PARTS_3D_FALLBACK_PROFILES.vascularTree
}

function bodyParts3dStructureFallbackProfile(target: BodyParts3dFallbackTarget): BodyParts3dFallbackProfile {
  const slug = target.entitySlug
  if (/hair|nail|sweat|sebaceous|follicle/.test(slug)) return BODY_PARTS_3D_FALLBACK_PROFILES.skinAppendage
  if (/skin|dermatome/.test(slug)) return BODY_PARTS_3D_FALLBACK_PROFILES.skin
  if (/heart|cardiac|myocardium|endocardium|pericardium|valve/.test(slug)) return BODY_PARTS_3D_FALLBACK_PROFILES.heart
  if (/renal|kidney|ureter|urethra/.test(slug)) return BODY_PARTS_3D_FALLBACK_PROFILES.kidney
  if (/brain|cerebr|cerebell|ganglion|semicircular|optic-disc/.test(slug)) return BODY_PARTS_3D_FALLBACK_PROFILES.brain
  if (/fascia|fascial|compartment|retinaculum|aponeurosis|sheath|expansion|snuffbox|fossa|triangle|space/.test(slug)) return BODY_PARTS_3D_FALLBACK_PROFILES.deepFascialSystem
  if (/tendon|plantaris|achilles/.test(slug)) return BODY_PARTS_3D_FALLBACK_PROFILES.tendon
  if (/tooth|molar|premolar|canine|incisor/.test(slug)) return BODY_PARTS_3D_FALLBACK_PROFILES.tooth
  if (slug === "cricoid-cartilage") return BODY_PARTS_3D_FALLBACK_PROFILES.cricoidCartilage
  if (slug === "arytenoid-cartilage") return BODY_PARTS_3D_FALLBACK_PROFILES.arytenoidCartilage
  if (slug === "epiglottis") return BODY_PARTS_3D_FALLBACK_PROFILES.epiglottis
  if (/lymph|duct|node|trunk|venous-angle/.test(slug)) return BODY_PARTS_3D_FALLBACK_PROFILES.vascularTree
  if (/myotome|muscle-group|diaphragm|thenar|hypothenar|triceps-coxae|prevertebral|tongue/.test(slug)) return BODY_PARTS_3D_FALLBACK_PROFILES.muscleOrgan
  if (/bursa|meniscus|labrum|synovial|disc|plate|capsule|cartilage/.test(slug)) return BODY_PARTS_3D_FALLBACK_PROFILES.skeletalSystem

  return BODY_PARTS_3D_FALLBACK_PROFILES.anatomicalStructure
}

function bodyParts3dRegionFallbackProfile(target: BodyParts3dFallbackTarget): BodyParts3dFallbackProfile {
  const slug = target.entitySlug
  if (/neck|base-of-skull/.test(slug)) return BODY_PARTS_3D_FALLBACK_PROFILES.neck
  if (/shoulder|scapular|rotator|trapezius|glenohumeral|acromioclavicular|sternoclavicular|scapulothoracic/.test(slug)) return BODY_PARTS_3D_FALLBACK_PROFILES.shoulder
  if (/thoracic|between-shoulder|upper-back|back/.test(slug)) return BODY_PARTS_3D_FALLBACK_PROFILES.thoraxBack
  if (/lumbar|low-back|abdomen|abdominal/.test(slug)) return BODY_PARTS_3D_FALLBACK_PROFILES.abdomen
  if (/hip|sacroiliac|pelvic/.test(slug)) return BODY_PARTS_3D_FALLBACK_PROFILES.hip
  if (/thigh/.test(slug)) return BODY_PARTS_3D_FALLBACK_PROFILES.thigh
  if (/knee/.test(slug)) return BODY_PARTS_3D_FALLBACK_PROFILES.knee
  if (/calf|leg|ankle|foot|subtalar|metatarsophalangeal/.test(slug)) return BODY_PARTS_3D_FALLBACK_PROFILES.leg
  if (/forearm|elbow|radioulnar/.test(slug)) return BODY_PARTS_3D_FALLBACK_PROFILES.forearm
  if (/wrist|hand|metacarpophalangeal|interphalangeal|thumb/.test(slug)) return BODY_PARTS_3D_FALLBACK_PROFILES.wrist
  if (/jaw|face|mouth|hyoid|tongue|laryngeal|pharyngeal|palate/.test(slug)) return BODY_PARTS_3D_FALLBACK_PROFILES.face
  if (/temple|forehead|head/.test(slug)) return BODY_PARTS_3D_FALLBACK_PROFILES.head

  return BODY_PARTS_3D_FALLBACK_PROFILES.humanBody
}

function bodyParts3dFallbackAssetSlug(profile: BodyParts3dFallbackProfile, view: BodyParts3dFallbackView): string {
  return `bodyparts3d-fallback-${profile.slug}-${view.slug}-anatomogram`
}

function withBodyParts3dFallbackMediaCoverage(seed: AnatomyFoundationSeed): AnatomyFoundationSeed {
  const mediaAssets = [...seed.mediaAssets]
  const mediaEntityLinks = [...seed.mediaEntityLinks]
  const citations = [...seed.citations]
  const mediaAssetSlugs = new Set(mediaAssets.map((asset) => asset.slug))
  const mediaCitationSlugs = new Set(citations.map((citation) => citation.slug))
  const linkNaturalKeys = new Set(mediaEntityLinks.map((link) => [link.assetSlug, link.entityType, link.entitySlug, link.role].join("|")))
  const entityMediaKeys = new Set(mediaEntityLinks.map((link) => [link.entityType, link.entitySlug].join("|")))
  const firstCitationTargetByAsset = new Map<string, BodyParts3dFallbackTarget>()

  for (const target of bodyParts3dFallbackTargets(seed)) {
    if (entityMediaKeys.has([target.entityType, target.entitySlug].join("|"))) continue

    const profile = bodyParts3dFallbackProfileFor(target)
    for (const view of BODYPARTS3D_FALLBACK_VIEWS) {
      const assetSlug = bodyParts3dFallbackAssetSlug(profile, view)
      const sourceUrl = bodyParts3dFallbackImageUrl(profile, view)

      if (!mediaAssetSlugs.has(assetSlug)) {
        mediaAssets.push({
          id: `media-${assetSlug}`,
          slug: assetSlug,
          title: `BodyParts3D ${profile.title} ${view.title} Fallback Anatomogram`,
          mediaType: "image",
          description: `${profile.description} This is a ${profile.mappingPrecision.replace("_", " ")} fallback render ${view.description}, not a replacement for a reviewed custom illustration when one becomes available.`,
          sourceRef: BODYPARTS3D_FALLBACK_SOURCE,
          sourceUrl,
          storagePath: `anatomy/bodyparts3d/anatomograms/fallback/${profile.slug}/${view.slug}.png`,
          license: "CC BY 4.0",
          licenseUrl: BODYPARTS3D_FALLBACK_LICENSE_URL,
          attribution: BODYPARTS3D_FALLBACK_ATTRIBUTION,
          author: "Database Center for Life Science",
          usageScope: "open_reuse",
          reviewStatus: "reviewed",
          format: "png",
          metadata: {
            r2Upload: true,
            sourceKind: "bodyparts3d-anatomography-api-image",
            sourcePage: BODYPARTS3D_FALLBACK_API_DOCS,
            isaPartList: BODYPARTS3D_FALLBACK_ISA_PART_LIST,
            partOfPartList: BODYPARTS3D_FALLBACK_PARTOF_PART_LIST,
            bodyparts3dPartIds: profile.partIds,
            bodyparts3dPartNames: profile.partNames,
            bodyparts3dTreeName: profile.treeName,
            bodyparts3dCameraMode: view.cameraMode,
            bodyparts3dView: view.slug,
            bodyparts3dViewTitle: view.title,
            mappingPrecision: profile.mappingPrecision,
            fallbackProfile: profile.slug,
            backgroundPartId: BODYPARTS3D_FALLBACK_SKELETON_BACKGROUND_ID,
            backgroundPartOpacity: 0.15,
            visualStyle: "3d-anatomogram-render",
            anatomogramVersion: "4.1",
            licenseVerifiedAt: "2026-05-26",
            licensePage: BODYPARTS3D_FALLBACK_LICENSE_PAGE,
            ingestionStatus: "pending_r2_upload",
          },
        })
        mediaAssetSlugs.add(assetSlug)
        firstCitationTargetByAsset.set(assetSlug, target)
      }

      const naturalKey = [assetSlug, target.entityType, target.entitySlug, profile.role].join("|")
      if (!linkNaturalKeys.has(naturalKey)) {
        mediaEntityLinks.push({
          id: `media-link-${assetSlug}-${target.entityType}-${target.entitySlug}-${profile.role}`,
          assetSlug,
          entityType: target.entityType,
          entitySlug: target.entitySlug,
          role: profile.role,
          notes: `${profile.note} Added because ${target.label} did not yet have dedicated media; mapping precision is ${profile.mappingPrecision}.`,
        })
        linkNaturalKeys.add(naturalKey)
      }
    }
  }

  for (const asset of mediaAssets.filter((entry) => entry.slug.startsWith("bodyparts3d-fallback-"))) {
    const target = firstCitationTargetByAsset.get(asset.slug)
    if (!target) continue

    const sourceSlug = `citation-${asset.slug}-media-source`
    if (!mediaCitationSlugs.has(sourceSlug)) {
      citations.push({
        id: sourceSlug,
        slug: sourceSlug,
        entityType: target.entityType,
        entitySlug: target.entitySlug,
        factType: "media_source",
        factSlug: asset.slug,
        sourceRef: BODYPARTS3D_FALLBACK_SOURCE,
        sourceLocator: asset.sourceUrl,
        citationNote: `BodyParts3D/Anatomography API fallback image generated from reviewed part IDs for ${asset.title}; mapping precision is stored in asset metadata and link notes.`,
        reviewStatus: "reviewed",
      })
      mediaCitationSlugs.add(sourceSlug)
    }

    const licenseSlug = `citation-${asset.slug}-media-license`
    if (!mediaCitationSlugs.has(licenseSlug)) {
      citations.push({
        id: licenseSlug,
        slug: licenseSlug,
        entityType: target.entityType,
        entitySlug: target.entitySlug,
        factType: "media_license",
        factSlug: asset.slug,
        sourceRef: BODYPARTS3D_FALLBACK_SOURCE,
        sourceLocator: BODYPARTS3D_FALLBACK_LICENSE_PAGE,
        citationNote: "BodyParts3D official license page lists Creative Commons Attribution 4.0 International and required attribution wording.",
        reviewStatus: "reviewed",
      })
      mediaCitationSlugs.add(licenseSlug)
    }
  }

  return {
    ...seed,
    citations,
    mediaAssets,
    mediaEntityLinks,
  }
}

function bodyParts3dPartListUpgradeAssetSlug(upgrade: BodyParts3dPartListUpgrade, view: BodyParts3dFallbackView): string {
  return `bodyparts3d-partlist-${upgrade.entityType}-${upgrade.entitySlug}-${view.slug}-anatomogram`
}

function bodyParts3dPartListUpgradeAnimationSlug(upgrade: BodyParts3dPartListUpgrade): string {
  return `bodyparts3d-partlist-${upgrade.entityType}-${upgrade.entitySlug}-animated-anatomogram`
}

function addBodyParts3dMediaCitations(
  citations: AnatomyCitation[],
  mediaCitationSlugs: Set<string>,
  target: { entityType: AnatomyEntityType; entitySlug: string },
  asset: AnatomyMediaAsset,
  sourceNote: string,
) {
  const sourceSlug = `citation-${asset.slug}-media-source`
  if (!mediaCitationSlugs.has(sourceSlug)) {
    citations.push({
      id: sourceSlug,
      slug: sourceSlug,
      entityType: target.entityType,
      entitySlug: target.entitySlug,
      factType: "media_source",
      factSlug: asset.slug,
      sourceRef: BODYPARTS3D_FALLBACK_SOURCE,
      sourceLocator: asset.sourceUrl,
      citationNote: sourceNote,
      reviewStatus: "reviewed",
    })
    mediaCitationSlugs.add(sourceSlug)
  }

  const licenseSlug = `citation-${asset.slug}-media-license`
  if (!mediaCitationSlugs.has(licenseSlug)) {
    citations.push({
      id: licenseSlug,
      slug: licenseSlug,
      entityType: target.entityType,
      entitySlug: target.entitySlug,
      factType: "media_license",
      factSlug: asset.slug,
      sourceRef: BODYPARTS3D_FALLBACK_SOURCE,
      sourceLocator: BODYPARTS3D_FALLBACK_LICENSE_PAGE,
      citationNote: "BodyParts3D official license page lists Creative Commons Attribution 4.0 International and required attribution wording.",
      reviewStatus: "reviewed",
    })
    mediaCitationSlugs.add(licenseSlug)
  }
}

function withBodyParts3dPartListUpgradeMediaCoverage(seed: AnatomyFoundationSeed): AnatomyFoundationSeed {
  const mediaAssets = [...seed.mediaAssets]
  const mediaEntityLinks = [...seed.mediaEntityLinks]
  const citations = [...seed.citations]
  const mediaAssetSlugs = new Set(mediaAssets.map((asset) => asset.slug))
  const mediaCitationSlugs = new Set(citations.map((citation) => citation.slug))
  const linkNaturalKeys = new Set(mediaEntityLinks.map((link) => [link.assetSlug, link.entityType, link.entitySlug, link.role].join("|")))

  for (const upgrade of BODY_PARTS_3D_PART_LIST_UPGRADES) {
    for (const view of BODYPARTS3D_FALLBACK_VIEWS) {
      const assetSlug = bodyParts3dPartListUpgradeAssetSlug(upgrade, view)
      const asset: AnatomyMediaAsset = {
        id: `media-${assetSlug}`,
        slug: assetSlug,
        title: `BodyParts3D ${upgrade.title} ${view.title} Anatomogram`,
        mediaType: "image",
        description: `${upgrade.description} This reviewed ${upgrade.mappingPrecision.replace("_", " ")} render uses BodyParts3D part-list IDs ${view.description}.`,
        sourceRef: BODYPARTS3D_FALLBACK_SOURCE,
        sourceUrl: bodyParts3dFallbackImageUrl(upgrade, view),
        storagePath: `anatomy/bodyparts3d/anatomograms/part-list-upgrades/${upgrade.entityType}/${upgrade.entitySlug}/${view.slug}.png`,
        license: "CC BY 4.0",
        licenseUrl: BODYPARTS3D_FALLBACK_LICENSE_URL,
        attribution: BODYPARTS3D_FALLBACK_ATTRIBUTION,
        author: "Database Center for Life Science",
        usageScope: "open_reuse",
        reviewStatus: "reviewed",
        format: "png",
        metadata: {
          r2Upload: true,
          sourceKind: "bodyparts3d-anatomography-api-image",
          sourcePage: BODYPARTS3D_FALLBACK_API_DOCS,
          isaPartList: BODYPARTS3D_FALLBACK_ISA_PART_LIST,
          partOfPartList: BODYPARTS3D_FALLBACK_PARTOF_PART_LIST,
          bodyparts3dPartIds: upgrade.partIds,
          bodyparts3dPartNames: upgrade.partNames,
          bodyparts3dTreeName: upgrade.treeName,
          bodyparts3dCameraMode: view.cameraMode,
          bodyparts3dView: view.slug,
          bodyparts3dViewTitle: view.title,
          mappingPrecision: upgrade.mappingPrecision,
          partListUpgrade: true,
          backgroundPartId: BODYPARTS3D_FALLBACK_SKELETON_BACKGROUND_ID,
          backgroundPartOpacity: 0.15,
          visualStyle: "3d-anatomogram-render",
          anatomogramVersion: "4.1",
          licenseVerifiedAt: "2026-05-26",
          licensePage: BODYPARTS3D_FALLBACK_LICENSE_PAGE,
          ingestionStatus: "pending_r2_upload",
        },
      }

      if (!mediaAssetSlugs.has(assetSlug)) {
        mediaAssets.push(asset)
        mediaAssetSlugs.add(assetSlug)
      }

      const linkNaturalKey = [assetSlug, upgrade.entityType, upgrade.entitySlug, upgrade.role].join("|")
      if (!linkNaturalKeys.has(linkNaturalKey)) {
        mediaEntityLinks.push({
          id: `media-link-${assetSlug}-${upgrade.entityType}-${upgrade.entitySlug}-${upgrade.role}`,
          assetSlug,
          entityType: upgrade.entityType,
          entitySlug: upgrade.entitySlug,
          role: upgrade.role,
          notes: `${upgrade.note} Added from BodyParts3D part-list files to replace or supplement a broader fallback render.`,
        })
        linkNaturalKeys.add(linkNaturalKey)
      }

      addBodyParts3dMediaCitations(citations, mediaCitationSlugs, upgrade, asset, `BodyParts3D/Anatomography API still image generated from reviewed BodyParts3D part-list IDs for ${upgrade.title}; mapping precision is ${upgrade.mappingPrecision}.`)
    }

    const animationSlug = bodyParts3dPartListUpgradeAnimationSlug(upgrade)
    const animationAsset: AnatomyMediaAsset = {
      id: `media-${animationSlug}`,
      slug: animationSlug,
      title: `BodyParts3D ${upgrade.title} Animated Anatomogram`,
      mediaType: "image",
      description: `${upgrade.description} Animated BodyParts3D GIF generated from the same reviewed part-list IDs for rotational reference.`,
      sourceRef: BODYPARTS3D_FALLBACK_SOURCE,
      sourceUrl: bodyParts3dFallbackAnimationUrl(upgrade),
      storagePath: `anatomy/bodyparts3d/anatomograms/part-list-upgrades/${upgrade.entityType}/${upgrade.entitySlug}/animated.gif`,
      license: "CC BY 4.0",
      licenseUrl: BODYPARTS3D_FALLBACK_LICENSE_URL,
      attribution: BODYPARTS3D_FALLBACK_ATTRIBUTION,
      author: "Database Center for Life Science",
      usageScope: "open_reuse",
      reviewStatus: "reviewed",
      format: "gif",
      metadata: {
        r2Upload: true,
        sourceKind: "bodyparts3d-anatomography-api-animation",
        sourcePage: BODYPARTS3D_FALLBACK_ANIMATION_DOCS,
        isaPartList: BODYPARTS3D_FALLBACK_ISA_PART_LIST,
        partOfPartList: BODYPARTS3D_FALLBACK_PARTOF_PART_LIST,
        bodyparts3dPartIds: upgrade.partIds,
        bodyparts3dPartNames: upgrade.partNames,
        bodyparts3dTreeName: upgrade.treeName,
        mappingPrecision: upgrade.mappingPrecision,
        partListUpgrade: true,
        backgroundPartId: BODYPARTS3D_FALLBACK_SKELETON_BACKGROUND_ID,
        backgroundPartOpacity: 0.15,
        visualStyle: "3d-anatomogram-animation",
        anatomogramVersion: "4.1",
        licenseVerifiedAt: "2026-05-26",
        licensePage: BODYPARTS3D_FALLBACK_LICENSE_PAGE,
        ingestionStatus: "pending_r2_upload",
      },
    }

    if (!mediaAssetSlugs.has(animationSlug)) {
      mediaAssets.push(animationAsset)
      mediaAssetSlugs.add(animationSlug)
    }

    const linkNaturalKey = [animationSlug, upgrade.entityType, upgrade.entitySlug, upgrade.role].join("|")
    if (!linkNaturalKeys.has(linkNaturalKey)) {
      mediaEntityLinks.push({
        id: `media-link-${animationSlug}-${upgrade.entityType}-${upgrade.entitySlug}-${upgrade.role}`,
        assetSlug: animationSlug,
        entityType: upgrade.entityType,
        entitySlug: upgrade.entitySlug,
        role: upgrade.role,
        notes: `${upgrade.note} Animated BodyParts3D render generated from the reviewed part-list mapping.`,
      })
      linkNaturalKeys.add(linkNaturalKey)
    }

    addBodyParts3dMediaCitations(citations, mediaCitationSlugs, upgrade, animationAsset, `BodyParts3D/Anatomography API animated GIF generated from reviewed BodyParts3D part-list IDs for ${upgrade.title}; mapping precision is ${upgrade.mappingPrecision}.`)
  }

  return {
    ...seed,
    citations,
    mediaAssets,
    mediaEntityLinks,
  }
}

function bodyParts3dAnimationLabelForEntity(seed: AnatomyFoundationSeed, entityType: AnatomyEntityType, entitySlug: string): string {
  const collections: Partial<Record<AnatomyEntityType, Array<{ slug: string; name?: string; term?: string; movementName?: string }>>> = {
    region: [...seed.bodyRegions, ...seed.bodySubregions],
    blood_supply: seed.bloodSupply,
    anatomy_structure: seed.structures,
    anatomy_concept: seed.concepts,
    bone: seed.bones,
    bone_landmark: seed.boneLandmarks,
    joint: seed.joints,
    joint_movement: seed.jointMovements,
    nerve: seed.nerves,
    ligament: seed.ligaments,
    pain_map_region: seed.painMapRegions,
    client_term: seed.clientTerms,
    muscle: seed.muscles,
  }
  const entity = collections[entityType]?.find((entry) => entry.slug === entitySlug)

  return entity?.name ?? entity?.term ?? entity?.movementName ?? entitySlug
}

function bodyParts3dAnimationCandidateScore(asset: AnatomyMediaAsset, link: AnatomyMediaEntityLink): number {
  const precision = String(asset.metadata?.mappingPrecision ?? (asset.metadata?.bodyparts3dPartIds ? "mapped" : "broad_context"))
  const precisionScore = precision === "exact" ? 400 : precision === "composite" ? 300 : precision === "mapped" ? 200 : 100
  const roleScore = link.role === "primary" ? 40 : link.role === "region_context" ? 20 : link.role === "game_prompt" ? 10 : 0
  const sourceScore = String(asset.metadata?.sourceKind ?? "").includes("fallback") ? 0 : 5

  return precisionScore + roleScore + sourceScore
}

function withBodyParts3dAnimatedMediaCoverage(seed: AnatomyFoundationSeed): AnatomyFoundationSeed {
  const mediaAssets = [...seed.mediaAssets]
  const mediaEntityLinks = [...seed.mediaEntityLinks]
  const citations = [...seed.citations]
  const mediaAssetSlugs = new Set(mediaAssets.map((asset) => asset.slug))
  const mediaCitationSlugs = new Set(citations.map((citation) => citation.slug))
  const linkNaturalKeys = new Set(mediaEntityLinks.map((link) => [link.assetSlug, link.entityType, link.entitySlug, link.role].join("|")))
  const assetBySlug = new Map(mediaAssets.map((asset) => [asset.slug, asset]))
  const bestCandidateByEntity = new Map<string, BodyParts3dEntityAnimationCandidate>()

  for (const link of mediaEntityLinks) {
    const asset = assetBySlug.get(link.assetSlug)
    if (asset?.sourceRef !== BODYPARTS3D_FALLBACK_SOURCE) continue
    if (asset.format === "gif") continue

    const partIds = asset.metadata?.bodyparts3dPartIds
    if (!Array.isArray(partIds) || partIds.length === 0) continue

    const partNames = asset.metadata?.bodyparts3dPartNames
    const mappingPrecision = String(asset.metadata?.mappingPrecision ?? "mapped") as BodyParts3dEntityAnimationCandidate["mappingPrecision"]
    const treeName = String(asset.metadata?.bodyparts3dTreeName ?? "isa") === "partof" ? "partof" : "isa"
    const candidate: BodyParts3dEntityAnimationCandidate = {
      entityType: link.entityType,
      entitySlug: link.entitySlug,
      role: link.role,
      label: bodyParts3dAnimationLabelForEntity(seed, link.entityType, link.entitySlug),
      sourceAssetSlug: asset.slug,
      sourceAssetTitle: asset.title,
      sourceUrl: asset.sourceUrl,
      partIds: partIds.map(String),
      partNames: Array.isArray(partNames) ? partNames.map(String) : [],
      treeName,
      mappingPrecision: ["exact", "composite", "broad_context", "mapped"].includes(mappingPrecision) ? mappingPrecision : "mapped",
      score: bodyParts3dAnimationCandidateScore(asset, link),
    }
    const entityKey = [link.entityType, link.entitySlug].join("|")
    const existing = bestCandidateByEntity.get(entityKey)
    if (!existing || candidate.score > existing.score) bestCandidateByEntity.set(entityKey, candidate)
  }

  for (const candidate of bestCandidateByEntity.values()) {
    const profileForAnimation = profile(
      `${candidate.entityType}-${candidate.entitySlug}`,
      candidate.label,
      `BodyParts3D animated reference for ${candidate.label}.`,
      candidate.partIds,
      candidate.partNames,
      candidate.treeName,
      candidate.role,
      candidate.mappingPrecision === "mapped" ? "exact" : candidate.mappingPrecision,
      `Generated from ${candidate.sourceAssetSlug}.`,
    )
    const assetSlug = `bodyparts3d-${candidate.entityType}-${candidate.entitySlug}-animated-anatomogram`
    const asset: AnatomyMediaAsset = {
      id: `media-${assetSlug}`,
      slug: assetSlug,
      title: `BodyParts3D ${candidate.label} Animated Anatomogram`,
      mediaType: "image",
      description: `Animated BodyParts3D GIF generated from reviewed part IDs for ${candidate.label}. Source still asset: ${candidate.sourceAssetTitle}.`,
      sourceRef: BODYPARTS3D_FALLBACK_SOURCE,
      sourceUrl: bodyParts3dFallbackAnimationUrl(profileForAnimation),
      storagePath: `anatomy/bodyparts3d/anatomograms/animated/${candidate.entityType}/${candidate.entitySlug}.gif`,
      license: "CC BY 4.0",
      licenseUrl: BODYPARTS3D_FALLBACK_LICENSE_URL,
      attribution: BODYPARTS3D_FALLBACK_ATTRIBUTION,
      author: "Database Center for Life Science",
      usageScope: "open_reuse",
      reviewStatus: "reviewed",
      format: "gif",
      metadata: {
        r2Upload: true,
        sourceKind: "bodyparts3d-anatomography-api-animation",
        sourcePage: BODYPARTS3D_FALLBACK_ANIMATION_DOCS,
        sourceAssetSlug: candidate.sourceAssetSlug,
        sourceAssetUrl: candidate.sourceUrl,
        isaPartList: BODYPARTS3D_FALLBACK_ISA_PART_LIST,
        partOfPartList: BODYPARTS3D_FALLBACK_PARTOF_PART_LIST,
        bodyparts3dPartIds: candidate.partIds,
        bodyparts3dPartNames: candidate.partNames,
        bodyparts3dTreeName: candidate.treeName,
        mappingPrecision: candidate.mappingPrecision,
        backgroundPartId: BODYPARTS3D_FALLBACK_SKELETON_BACKGROUND_ID,
        backgroundPartOpacity: 0.15,
        visualStyle: "3d-anatomogram-animation",
        anatomogramVersion: "4.1",
        licenseVerifiedAt: "2026-05-26",
        licensePage: BODYPARTS3D_FALLBACK_LICENSE_PAGE,
        ingestionStatus: "pending_r2_upload",
      },
    }

    if (!mediaAssetSlugs.has(assetSlug)) {
      mediaAssets.push(asset)
      mediaAssetSlugs.add(assetSlug)
    }

    const linkNaturalKey = [assetSlug, candidate.entityType, candidate.entitySlug, candidate.role].join("|")
    if (!linkNaturalKeys.has(linkNaturalKey)) {
      mediaEntityLinks.push({
        id: `media-link-${assetSlug}-${candidate.entityType}-${candidate.entitySlug}-${candidate.role}`,
        assetSlug,
        entityType: candidate.entityType,
        entitySlug: candidate.entitySlug,
        role: candidate.role,
        notes: `Animated BodyParts3D GIF generated from best available reviewed BodyParts3D still mapping (${candidate.mappingPrecision}) for this entity.`,
      })
      linkNaturalKeys.add(linkNaturalKey)
    }

    addBodyParts3dMediaCitations(citations, mediaCitationSlugs, candidate, asset, `BodyParts3D/Anatomography API animated GIF generated from the best available reviewed BodyParts3D still mapping for ${candidate.label}; source still asset ${candidate.sourceAssetSlug}.`)
  }

  return {
    ...seed,
    citations,
    mediaAssets,
    mediaEntityLinks,
  }
}

function withBodyParts3d3dCandidateSourceLinks(seed: AnatomyFoundationSeed): AnatomyFoundationSeed {
  const mediaAssets = [...seed.mediaAssets]
  const mediaEntityLinks = [...seed.mediaEntityLinks]
  const citations = [...seed.citations]
  const mediaAssetSlugs = new Set(mediaAssets.map((asset) => asset.slug))
  const mediaCitationSlugs = new Set(citations.map((citation) => citation.slug))
  const linkNaturalKeys = new Set(mediaEntityLinks.map((link) => [link.assetSlug, link.entityType, link.entitySlug, link.role].join("|")))
  const candidates: AnatomyMediaAsset[] = [
    {
      id: "media-bodyparts3d-stl-github-mirror-source-link",
      slug: "bodyparts3d-stl-github-mirror-source-link",
      title: "BodyParts3D STL GitHub Mirror 3D Candidate",
      mediaType: "source_link",
      description: "Review-only source link for future BodyParts3D-derived STL/3D model ingestion. The geometry license is CC BY-SA 2.1 Japan and requires product/license review before use.",
      sourceRef: "bodyparts3d-stl-github-mirror",
      sourceUrl: "https://github.com/Kevin-Mattheus-Moerman/BodyParts3D",
      remoteUrl: "https://github.com/Kevin-Mattheus-Moerman/BodyParts3D",
      license: "CC BY-SA 2.1 Japan for derived geometry; MIT for repository code",
      licenseUrl: "https://github.com/Kevin-Mattheus-Moerman/BodyParts3D/blob/main/LICENSE_content",
      attribution: "BodyParts3D, (c) The Database Center for Life Science licensed under CC Attribution-Share Alike 2.1 Japan; Kevin Mattheus Moerman GitHub mirror.",
      author: "Kevin Mattheus Moerman; Database Center for Life Science",
      usageScope: "review_only",
      reviewStatus: "needs_review",
      format: "source_link",
      metadata: {
        sourceKind: "bodyparts3d-derived-stl-source-link",
        candidateFor: "future_3d_asset_pipeline",
        shareAlikeReviewRequired: true,
        ingestionStatus: "review_only_not_uploaded",
      },
    },
    {
      id: "media-wikimedia-bodyparts3d-stl-category-source-link",
      slug: "wikimedia-bodyparts3d-stl-category-source-link",
      title: "Wikimedia Commons BodyParts3D STL Category 3D Candidate",
      mediaType: "source_link",
      description: "Review-only source link for future per-file Wikimedia Commons STL ingestion. Each file needs license, source, author, attribution, and ShareAlike review before use.",
      sourceRef: "wikimedia-bodyparts3d-stl-category",
      sourceUrl: "https://commons.wikimedia.org/wiki/Category:STL_files_from_BodyParts3D",
      remoteUrl: "https://commons.wikimedia.org/wiki/Category:STL_files_from_BodyParts3D",
      license: "Per-file Wikimedia Commons license review required",
      licenseUrl: "https://commons.wikimedia.org/wiki/Commons:Licensing",
      attribution: "Wikimedia Commons contributors; per-file attribution required before use.",
      author: "Wikimedia Commons contributors",
      usageScope: "review_only",
      reviewStatus: "needs_review",
      format: "source_link",
      metadata: {
        sourceKind: "wikimedia-bodyparts3d-stl-category-source-link",
        candidateFor: "future_3d_asset_pipeline",
        perFileReviewRequired: true,
        ingestionStatus: "review_only_not_uploaded",
      },
    },
  ]

  for (const asset of candidates) {
    if (!mediaAssetSlugs.has(asset.slug)) {
      mediaAssets.push(asset)
      mediaAssetSlugs.add(asset.slug)
    }

    const linkNaturalKey = [asset.slug, "region", "body-surface", "reference"].join("|")
    if (!linkNaturalKeys.has(linkNaturalKey)) {
      mediaEntityLinks.push({
        id: `media-link-${asset.slug}-region-body-surface-reference`,
        assetSlug: asset.slug,
        entityType: "region",
        entitySlug: "body-surface",
        role: "reference",
        notes: "Review-only 3D source candidate linked at the body-surface level until individual 3D assets are vetted.",
      })
      linkNaturalKeys.add(linkNaturalKey)
    }

    const citationSlug = `citation-${asset.slug}-media-source`
    if (!mediaCitationSlugs.has(citationSlug)) {
      citations.push({
        id: citationSlug,
        slug: citationSlug,
        entityType: "region",
        entitySlug: "body-surface",
        factType: "media_source",
        factSlug: asset.slug,
        sourceRef: asset.sourceRef,
        sourceLocator: asset.sourceUrl,
        citationNote: "Review-only 3D source candidate. Do not use as open reusable product media until per-source/per-file licensing is approved.",
        reviewStatus: "needs_review",
      })
      mediaCitationSlugs.add(citationSlug)
    }
  }

  return {
    ...seed,
    citations,
    mediaAssets,
    mediaEntityLinks,
  }
}

export const ANATOMY_FOUNDATION_SEED: AnatomyFoundationSeed = withSourceReferenceCitationBacklog(
  withBodyParts3d3dCandidateSourceLinks(
    withBodyParts3dAnimatedMediaCoverage(
      withBodyParts3dPartListUpgradeMediaCoverage(
        withBodyParts3dFallbackMediaCoverage(
          withAtlasEnrichmentGapClosure(
            withCommercialSafeExternalIdentifierSourceCleanup(
              withReviewedFutureClinicalPlaceholderCleanup(
                withReviewedStarterTaxonomySourceCleanup(
                  withReviewedClientLanguageCleanup(
                    withReviewedSupportSystemCleanup(
                      withReviewedSkeletonCleanup(
                        withRemainingLegacyMuscleCleanup(
                          mergeAnatomySeedSections(
                            NECK_SHOULDER_UPPER_BACK_SEED,
                            ...ANATOMY_SEED_SECTIONS,
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  ),
)

const COLLECTION_NAMES = [
  "sources",
  "bodyRegions",
  "bodySubregions",
  "bones",
  "boneLandmarks",
  "joints",
  "jointMovements",
  "rangesOfMotion",
  "muscles",
  "muscleAttachments",
  "muscleActions",
  "nerves",
  "muscleInnervations",
  "ligaments",
  "bloodSupply",
  "structures",
  "concepts",
  "painMapRegions",
  "clientTerms",
  "entityTerms",
  "relationships",
  "citations",
  "externalIdentifiers",
  "mediaAssets",
  "mediaEntityLinks",
  "spatialModels",
  "spatialEntityMaps",
  "movementVisualizations",
] as const

function slugsFor<T extends { slug: string }>(items: T[]) {
  return new Set(items.map((item) => item.slug))
}

function idsFor<T extends { id: string }>(items: T[]) {
  return new Set(items.map((item) => item.id))
}

function normalizeText(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

function textMatches(value: string | undefined, normalizedQuery: string) {
  return Boolean(value && normalizeText(value).includes(normalizedQuery))
}

function isAnatomyEntityType(value: unknown): value is AnatomyEntityType {
  return typeof value === "string" && ANATOMY_ENTITY_TYPE_SET.has(value)
}

function entitySlugSet(seed: AnatomyFoundationSeed, entityType: AnatomyEntityType) {
  switch (entityType) {
    case "region":
      return new Set([...seed.bodyRegions.map((item) => item.slug), ...seed.bodySubregions.map((item) => item.slug)])
    case "blood_supply":
      return slugsFor(seed.bloodSupply)
    case "anatomy_structure":
      return slugsFor(seed.structures)
    case "anatomy_concept":
      return slugsFor(seed.concepts)
    case "bone":
      return slugsFor(seed.bones)
    case "bone_landmark":
      return slugsFor(seed.boneLandmarks)
    case "joint":
      return slugsFor(seed.joints)
    case "joint_movement":
      return slugsFor(seed.jointMovements)
    case "range_of_motion":
      return slugsFor(seed.rangesOfMotion)
    case "muscle":
      return slugsFor(seed.muscles)
    case "muscle_attachment":
      return idsFor(seed.muscleAttachments)
    case "muscle_action":
      return idsFor(seed.muscleActions)
    case "nerve":
      return slugsFor(seed.nerves)
    case "muscle_innervation":
      return idsFor(seed.muscleInnervations)
    case "ligament":
      return slugsFor(seed.ligaments)
    case "pain_map_region":
      return slugsFor(seed.painMapRegions)
    case "client_term":
      return slugsFor(seed.clientTerms)
  }
  return new Set<string>()
}

function entityExists(seed: AnatomyFoundationSeed, entityType: AnatomyEntityType, slug: string) {
  return entitySlugSet(seed, entityType).has(slug)
}

function sourceReferenceCitationKey(target: SourceReferenceCitationTarget) {
  return `${target.entityType}:${target.entitySlug}:${target.factSlug}:${target.sourceRef}`
}

function citationSourceReferenceKey(citation: AnatomyCitation) {
  if (citation.factType !== "seed_source_reference" || !citation.factSlug) {
    return null
  }

  return `${citation.entityType}:${citation.entitySlug}:${citation.factSlug}:${citation.sourceRef}`
}

function citationSlugForTarget(target: SourceReferenceCitationTarget) {
  return normalizeText(`citation source ref ${target.entityType} ${target.entitySlug} ${target.factSlug} ${target.sourceRef}`)
}

function sourceReferenceCitationTargets(seed: AnatomyFoundationSeed): SourceReferenceCitationTarget[] {
  const targets: SourceReferenceCitationTarget[] = []
  const add = (target: SourceReferenceCitationTarget) => targets.push(target)
  const addSourceRefList = (entityType: AnatomyEntityType, entitySlug: string, factPrefix: string, sourceRefs: string[]) => {
    sourceRefs.forEach((sourceRef) => add({
      entityType,
      entitySlug,
      sourceRef,
      factSlug: `${factPrefix}:${entitySlug}:${sourceRef}`,
    }))
  }
  const addSourceRef = (entityType: AnatomyEntityType, entitySlug: string, factPrefix: string, sourceRef: string) => add({
    entityType,
    entitySlug,
    sourceRef,
    factSlug: `${factPrefix}:${entitySlug}`,
  })

  seed.bodyRegions.forEach((region) => addSourceRefList("region", region.slug, "region", region.sourceRefs))
  seed.bodySubregions.forEach((region) => addSourceRefList("region", region.slug, "subregion", region.sourceRefs))
  seed.bones.forEach((bone) => addSourceRef("bone", bone.slug, "bone", bone.sourceRef))
  seed.boneLandmarks.forEach((landmark) => addSourceRef("bone_landmark", landmark.slug, "bone_landmark", landmark.sourceRef))
  seed.joints.forEach((joint) => addSourceRef("joint", joint.slug, "joint", joint.sourceRef))
  seed.jointMovements.forEach((movement) => addSourceRef("joint_movement", movement.slug, "joint_movement", movement.sourceRef))
  seed.rangesOfMotion.forEach((range) => addSourceRef("range_of_motion", range.slug, "range_of_motion", range.sourceRef))
  seed.muscles.forEach((muscle) => addSourceRef("muscle", muscle.slug, "muscle", muscle.sourceRef))
  seed.muscleAttachments.forEach((attachment) => addSourceRef("muscle_attachment", attachment.id, "muscle_attachment", attachment.sourceRef))
  seed.muscleActions.forEach((action) => addSourceRef("muscle_action", action.id, "muscle_action", action.sourceRef))
  seed.nerves.forEach((nerve) => addSourceRef("nerve", nerve.slug, "nerve", nerve.sourceRef))
  seed.muscleInnervations.forEach((innervation) => addSourceRef("muscle_innervation", innervation.id, "muscle_innervation", innervation.sourceRef))
  seed.ligaments.forEach((ligament) => addSourceRef("ligament", ligament.slug, "ligament", ligament.sourceRef))
  seed.bloodSupply.forEach((bloodSupply) => addSourceRef("blood_supply", bloodSupply.slug, "blood_supply", bloodSupply.sourceRef))
  seed.structures.forEach((structure) => addSourceRef("anatomy_structure", structure.slug, "anatomy_structure", structure.sourceRef))
  seed.concepts.forEach((concept) => addSourceRef("anatomy_concept", concept.slug, "anatomy_concept", concept.sourceRef))
  seed.painMapRegions.forEach((painMapRegion) => addSourceRef("pain_map_region", painMapRegion.slug, "pain_map_region", painMapRegion.sourceRef))
  seed.clientTerms.forEach((clientTerm) => addSourceRef("client_term", clientTerm.slug, "client_term", clientTerm.sourceRef))
  seed.entityTerms.forEach((term) => add({
    entityType: term.anatomyEntityType,
    entitySlug: term.anatomyEntitySlug,
    sourceRef: term.sourceRef,
    factSlug: `entity_term:${term.id}`,
  }))
  seed.relationships.forEach((relationship) => add({
    entityType: relationship.sourceEntityType,
    entitySlug: relationship.sourceEntitySlug,
    sourceRef: relationship.sourceRef,
    factSlug: `relationship:${relationship.id}`,
  }))
  seed.externalIdentifiers.forEach((identifier) => add({
    entityType: identifier.entityType,
    entitySlug: identifier.entitySlug,
    sourceRef: identifier.sourceRef,
    factSlug: identifier.identifier.toLowerCase().startsWith(`${identifier.provider.toLowerCase()}:`)
      ? `external_identifier:${identifier.identifier}`
      : `external_identifier:${identifier.provider}:${identifier.identifier}`,
  }))

  return targets
}

function seedSourceReferenceReviewStatus(target: SourceReferenceCitationTarget, source?: FoundationSource): AnatomyFactReviewStatus {
  if (target.sourceRef === STARTER_SOURCE) return "starter"
  if (DEFERRED_SEED_SOURCE_REFERENCE_REFS.has(target.sourceRef)) return "needs_review"

  const usageScope = source?.usageScope ?? "review_only"

  return COMMERCIAL_SAFE_SOURCE_SCOPES.includes(usageScope) ? "reviewed" : "needs_review"
}

function seedSourceReferenceLocator(target: SourceReferenceCitationTarget, source?: FoundationSource) {
  if (target.sourceRef === CLIENT_LANGUAGE_SOURCE) return CLIENT_LANGUAGE_SOURCE_LOCATOR
  if (target.sourceRef === CDC_ROM_SOURCE) return CDC_ROM_LOCATOR
  if (target.sourceRef === ROM_TRACKING_SOURCE) return ROM_TRACKING_LOCATOR
  if (source?.url) return source.url
  if (source?.sourceRef) return source.sourceRef

  return `Seed sourceRef: ${target.sourceRef}`
}

function seedSourceReferenceCitationNote(reviewStatus: AnatomyFactReviewStatus, source?: FoundationSource) {
  if (reviewStatus === "reviewed") {
    return "Reviewed seed source-reference row; the seed record points to a commercial-safe source record for this structured anatomy datum."
  }

  if (source?.usageScope === "review_only" || source?.usageScope === "internal_reference") {
    return "Generated citation backlog row from the TypeScript seed sourceRef; source remains review-only or internal-reference for this product use."
  }

  return "Generated citation backlog row from the TypeScript seed sourceRef; verify exact locator before marking reviewed."
}

function withSourceReferenceCitationBacklog(seed: AnatomyFoundationSeed): AnatomyFoundationSeed {
  const existingKeys = new Set(seed.citations.map(citationSourceReferenceKey).filter((key): key is string => Boolean(key)))
  const sourceBySlug = new Map(seed.sources.map((source) => [source.slug, source]))
  const generatedCitations = sourceReferenceCitationTargets(seed)
    .filter((target) => !existingKeys.has(sourceReferenceCitationKey(target)))
    .map((target): AnatomyCitation => {
      const slug = citationSlugForTarget(target)
      const source = sourceBySlug.get(target.sourceRef)
      const reviewStatus = seedSourceReferenceReviewStatus(target, source)

      return {
        id: slug,
        slug,
        entityType: target.entityType,
        entitySlug: target.entitySlug,
        factType: "seed_source_reference",
        factSlug: target.factSlug,
        sourceRef: target.sourceRef,
        sourceLocator: seedSourceReferenceLocator(target, source),
        citationNote: seedSourceReferenceCitationNote(reviewStatus, source),
        reviewStatus,
      }
    })

  return {
    ...seed,
    citations: [...seed.citations, ...generatedCitations],
  }
}

export function validateAnatomyFoundation(seed: AnatomyFoundationSeed = ANATOMY_FOUNDATION_SEED) {
  const issues: string[] = []
  const allIds = new Set<string>()
  const duplicateIds = new Set<string>()

  COLLECTION_NAMES.forEach((collectionName) => {
    const collection = seed[collectionName] as Array<{ id: string; slug?: string }>
    const collectionSlugs = new Set<string>()
    const duplicateSlugs = new Set<string>()

    collection.forEach((item) => {
      if (!item.id) issues.push(`Missing id in ${collectionName}`)
      if (allIds.has(item.id)) duplicateIds.add(item.id)
      allIds.add(item.id)

      if ("slug" in item && item.slug) {
        if (collectionSlugs.has(item.slug)) duplicateSlugs.add(item.slug)
        collectionSlugs.add(item.slug)
      }
    })

    duplicateSlugs.forEach((slug) => issues.push(`Duplicate anatomy foundation slug in ${collectionName}: ${slug}`))
  })

  duplicateIds.forEach((id) => issues.push(`Duplicate anatomy foundation id: ${id}`))

  const sourceSlugs = slugsFor(seed.sources)
  const sourceBySlug = new Map(seed.sources.map((source) => [source.slug, source]))
  const regionSlugs = entitySlugSet(seed, "region")
  const boneSlugs = slugsFor(seed.bones)
  const boneLandmarkSlugs = slugsFor(seed.boneLandmarks)
  const jointSlugs = slugsFor(seed.joints)
  const movementSlugs = slugsFor(seed.jointMovements)
  const muscleSlugs = slugsFor(seed.muscles)
  const nerveSlugs = slugsFor(seed.nerves)
  const structureSlugs = slugsFor(seed.structures)
  const mediaAssetSlugs = slugsFor(seed.mediaAssets)
  const spatialModelSlugs = slugsFor(seed.spatialModels)
  const rangeOfMotionSlugs = slugsFor(seed.rangesOfMotion)
  const movementBySlug = new Map(seed.jointMovements.map((movement) => [movement.slug, movement]))
  const rangeOfMotionBySlug = new Map(seed.rangesOfMotion.map((range) => [range.slug, range]))

  const validSource = (sourceRef: string, label: string) => {
    if (!sourceSlugs.has(sourceRef)) issues.push(`Invalid sourceRef for ${label}: ${sourceRef}`)
  }
  const validSourceList = (sourceRefs: string[], label: string) => {
    sourceRefs.forEach((sourceRef) => validSource(sourceRef, label))
  }
  const validateReviewedCommercialSafeCitation = (citation: AnatomyCitation) => {
    if (citation.reviewStatus !== "reviewed" || !COMMERCIAL_SAFE_REVIEWED_FACT_TYPES.has(citation.factType)) {
      return
    }

    const source = sourceBySlug.get(citation.sourceRef)

    if (!source) {
      return
    }

    const usageScope = source.usageScope ?? "review_only"

    if (!COMMERCIAL_SAFE_SOURCE_SCOPES.includes(usageScope)) {
      issues.push(`Reviewed ${citation.factType} citation ${citation.slug} requires an open reuse or commercial licensed source`)
    }

    if (TERMINOLOGY_ONLY_SOURCE_REFS.has(citation.sourceRef)) {
      issues.push(`Source ${citation.sourceRef} is terminology-only and cannot support reviewed ${citation.factType} citation ${citation.slug}`)
    }
  }

  seed.bodyRegions.forEach((region) => validSourceList(region.sourceRefs, `region ${region.id}`))
  seed.bodySubregions.forEach((subregion) => {
    if (!regionSlugs.has(subregion.region)) issues.push(`Invalid parent region for ${subregion.id}`)
    validSourceList(subregion.sourceRefs, `subregion ${subregion.id}`)
  })
  seed.bones.forEach((bone) => {
    if (!regionSlugs.has(bone.region)) issues.push(`Invalid region for bone ${bone.id}`)
    validSource(bone.sourceRef, `bone ${bone.id}`)
  })
  seed.boneLandmarks.forEach((landmark) => {
    if (!boneSlugs.has(landmark.bone)) issues.push(`Invalid bone for landmark ${landmark.id}`)
    validSource(landmark.sourceRef, `landmark ${landmark.id}`)
  })
  seed.joints.forEach((joint) => {
    if (!regionSlugs.has(joint.region)) issues.push(`Invalid region for joint ${joint.id}`)
    validSource(joint.sourceRef, `joint ${joint.id}`)
  })
  seed.jointMovements.forEach((movement) => {
    if (!jointSlugs.has(movement.joint)) issues.push(`Invalid joint for movement ${movement.id}`)
    validSource(movement.sourceRef, `movement ${movement.id}`)
  })
  seed.rangesOfMotion.forEach((range) => {
    if (!jointSlugs.has(range.joint)) issues.push(`Invalid joint for ROM ${range.id}`)
    if (!movementSlugs.has(range.movement)) issues.push(`Invalid movement for ROM ${range.id}`)
    const measurementUnit = range.measurementUnit ?? "degrees"
    const minValue = range.typicalMinValue ?? range.typicalMinDegrees
    const maxValue = range.typicalMaxValue ?? range.typicalMaxDegrees

    if (measurementUnit === "degrees" && (range.typicalMinDegrees === undefined || range.typicalMaxDegrees === undefined)) {
      issues.push(`Degree ROM requires degree values for ROM ${range.id}`)
    }
    if (minValue === undefined || maxValue === undefined || minValue < 0 || maxValue < minValue) {
      issues.push(`Invalid measurement range for ROM ${range.id}`)
    }
    validSource(range.sourceRef, `ROM ${range.id}`)
  })
  seed.muscles.forEach((muscle) => {
    if (!regionSlugs.has(muscle.region)) issues.push(`Invalid region for muscle ${muscle.id}`)
    validSource(muscle.sourceRef, `muscle ${muscle.id}`)
  })
  seed.muscleAttachments.forEach((attachment) => {
    if (!muscleSlugs.has(attachment.muscle)) issues.push(`Invalid muscle for attachment ${attachment.id}`)
    if (!boneSlugs.has(attachment.bone)) issues.push(`Invalid bone for attachment ${attachment.id}`)
    if (attachment.landmark && !boneLandmarkSlugs.has(attachment.landmark)) issues.push(`Invalid landmark for attachment ${attachment.id}`)
    validSource(attachment.sourceRef, `attachment ${attachment.id}`)
  })
  seed.muscleActions.forEach((action) => {
    if (!muscleSlugs.has(action.muscle)) issues.push(`Invalid muscle for action ${action.id}`)
    if (!jointSlugs.has(action.joint)) issues.push(`Invalid joint for action ${action.id}`)
    if (!movementSlugs.has(action.movement)) issues.push(`Invalid movement for action ${action.id}`)
    validSource(action.sourceRef, `action ${action.id}`)
  })
  seed.nerves.forEach((nerve) => {
    if (!regionSlugs.has(nerve.region)) issues.push(`Invalid region for nerve ${nerve.id}`)
    validSource(nerve.sourceRef, `nerve ${nerve.id}`)
  })
  seed.muscleInnervations.forEach((innervation) => {
    if (!muscleSlugs.has(innervation.muscle)) issues.push(`Invalid muscle for innervation ${innervation.id}`)
    if (!nerveSlugs.has(innervation.nerve)) issues.push(`Invalid nerve for innervation ${innervation.id}`)
    validSource(innervation.sourceRef, `innervation ${innervation.id}`)
  })
  seed.ligaments.forEach((ligament) => {
    if (!regionSlugs.has(ligament.region)) issues.push(`Invalid region for ligament ${ligament.id}`)
    if (ligament.joint && !jointSlugs.has(ligament.joint)) issues.push(`Invalid joint for ligament ${ligament.id}`)
    validSource(ligament.sourceRef, `ligament ${ligament.id}`)
  })
  seed.bloodSupply.forEach((bloodSupply) => {
    if (!regionSlugs.has(bloodSupply.region)) issues.push(`Invalid region for blood supply ${bloodSupply.id}`)
    validSource(bloodSupply.sourceRef, `blood supply ${bloodSupply.id}`)
  })
  seed.structures.forEach((structure) => {
    if (!regionSlugs.has(structure.region)) issues.push(`Invalid region for structure ${structure.id}`)
    validSource(structure.sourceRef, `structure ${structure.id}`)
  })
  seed.concepts.forEach((concept) => {
    validSource(concept.sourceRef, `concept ${concept.id}`)
    if (!concept.conceptType) issues.push(`Missing concept type for ${concept.id}`)
  })
  seed.painMapRegions.forEach((painMapRegion) => {
    if (!regionSlugs.has(painMapRegion.region)) issues.push(`Invalid region for pain map ${painMapRegion.id}`)
    if (!painMapRegion.laterality) issues.push(`Pain map requires laterality for ${painMapRegion.id}`)
    if (!painMapRegion.surface) issues.push(`Pain map requires surface for ${painMapRegion.id}`)
    validSource(painMapRegion.sourceRef, `pain map ${painMapRegion.id}`)
  })
  seed.clientTerms.forEach((clientTerm) => {
    if (clientTerm.mappedRegionSlug && !regionSlugs.has(clientTerm.mappedRegionSlug)) issues.push(`Invalid mapped region for client term ${clientTerm.id}`)
    if (clientTerm.mappedMuscleSlug && !muscleSlugs.has(clientTerm.mappedMuscleSlug)) issues.push(`Invalid mapped muscle for client term ${clientTerm.id}`)
    if (clientTerm.mappedJointSlug && !jointSlugs.has(clientTerm.mappedJointSlug)) issues.push(`Invalid mapped joint for client term ${clientTerm.id}`)
    if (clientTerm.mappedStructureSlug && !structureSlugs.has(clientTerm.mappedStructureSlug)) issues.push(`Invalid mapped structure for client term ${clientTerm.id}`)
    if (clientTerm.clinicalUse !== "non-diagnostic") issues.push(`Client term must be non-diagnostic for ${clientTerm.id}`)
    validSource(clientTerm.sourceRef, `client term ${clientTerm.id}`)
  })
  const entityTermNaturalKeys = new Map<string, string>()

  seed.entityTerms.forEach((term) => {
    if (!entityExists(seed, term.anatomyEntityType, term.anatomyEntitySlug)) issues.push(`Invalid entity term target for ${term.id}`)
    validSource(term.sourceRef, `entity term ${term.id}`)

    const naturalKey = [
      term.anatomyEntityType,
      term.anatomyEntitySlug,
      term.term,
      term.termType,
    ].join("|").toLowerCase()
    const existingTermId = entityTermNaturalKeys.get(naturalKey)

    if (existingTermId) {
      issues.push(`Duplicate entity term natural key for ${existingTermId} and ${term.id}`)
    } else {
      entityTermNaturalKeys.set(naturalKey, term.id)
    }
  })
  seed.relationships.forEach((relationship) => {
    if (!entityExists(seed, relationship.sourceEntityType, relationship.sourceEntitySlug)) issues.push(`Invalid relationship source for ${relationship.id}`)
    if (!entityExists(seed, relationship.targetEntityType, relationship.targetEntitySlug)) issues.push(`Invalid relationship target for ${relationship.id}`)
    validSource(relationship.sourceRef, `relationship ${relationship.id}`)
  })
  const citationNaturalKeys = new Map<string, string>()

  seed.citations.forEach((citation) => {
    if (!entityExists(seed, citation.entityType, citation.entitySlug)) issues.push(`Invalid citation target for ${citation.id}`)
    validSource(citation.sourceRef, `citation ${citation.id}`)
    if (!citation.factType) issues.push(`Missing fact type for citation ${citation.id}`)
    if (!citation.reviewStatus) issues.push(`Missing review status for citation ${citation.id}`)
    const naturalKey = citationNaturalKey(citation)
    const existingCitationSlug = citationNaturalKeys.get(naturalKey)

    if (existingCitationSlug) {
      issues.push(`Duplicate citation natural key for ${existingCitationSlug} and ${citation.slug}`)
    } else {
      citationNaturalKeys.set(naturalKey, citation.slug)
    }

    validateReviewedCommercialSafeCitation(citation)
  })
  const externalIdentifierNaturalKeys = new Map<string, string>()

  seed.externalIdentifiers.forEach((identifier) => {
    if (!entityExists(seed, identifier.entityType, identifier.entitySlug)) issues.push(`Invalid external identifier target for ${identifier.id}`)
    validSource(identifier.sourceRef, `external identifier ${identifier.id}`)
    if (!identifier.provider) issues.push(`Missing provider for external identifier ${identifier.id}`)
    if (!identifier.identifier) issues.push(`Missing identifier for external identifier ${identifier.id}`)

    const naturalKey = [
      identifier.entityType,
      identifier.entitySlug,
      identifier.provider,
      identifier.identifier,
    ].join("|").toLowerCase()
    const existingIdentifierId = externalIdentifierNaturalKeys.get(naturalKey)

    if (existingIdentifierId) {
      issues.push(`Duplicate external identifier natural key for ${existingIdentifierId} and ${identifier.id}`)
    } else {
      externalIdentifierNaturalKeys.set(naturalKey, identifier.id)
    }
  })
  seed.mediaAssets.forEach((asset) => {
    validSource(asset.sourceRef, `media asset ${asset.id}`)
    if (!asset.sourceUrl) issues.push(`Media asset requires source URL for ${asset.id}`)
    if (!asset.license) issues.push(`Media asset requires license for ${asset.id}`)
    if (!asset.licenseUrl) issues.push(`Media asset requires license URL for ${asset.id}`)
    if (!asset.attribution) issues.push(`Media asset requires attribution for ${asset.id}`)
    if (asset.usageScope === "open_reuse" && asset.reviewStatus !== "reviewed") issues.push(`Open media asset must be reviewed for ${asset.id}`)
    if (asset.usageScope === "open_reuse") {
      const source = sourceBySlug.get(asset.sourceRef)
      const usageScope = source?.usageScope ?? "review_only"

      if (source && !COMMERCIAL_SAFE_SOURCE_SCOPES.includes(usageScope)) {
        issues.push(`Open media asset ${asset.id} requires an open reuse or commercial licensed source`)
      }
    }
  })
  seed.mediaEntityLinks.forEach((link) => {
    if (!mediaAssetSlugs.has(link.assetSlug)) issues.push(`Invalid media asset for media entity link ${link.id}`)
    if (!entityExists(seed, link.entityType, link.entitySlug)) issues.push(`Invalid media entity target for ${link.id}`)
  })
  seed.spatialModels.forEach((model) => {
    validSource(model.sourceRef, `spatial model ${model.id}`)
    if (model.mediaAssetSlug && !mediaAssetSlugs.has(model.mediaAssetSlug)) issues.push(`Invalid media asset for spatial model ${model.id}`)
    if (!model.coordinateSystem) issues.push(`Spatial model requires coordinate system for ${model.id}`)
    if (!model.unit) issues.push(`Spatial model requires unit for ${model.id}`)
    if (model.scaleToMeters <= 0) issues.push(`Spatial model requires positive scale for ${model.id}`)
  })
  seed.spatialEntityMaps.forEach((map) => {
    if (!spatialModelSlugs.has(map.modelSlug)) issues.push(`Invalid spatial model for spatial entity map ${map.id}`)
    if (!entityExists(seed, map.entityType, map.entitySlug)) issues.push(`Invalid spatial entity target for ${map.id}`)
    validSource(map.sourceRef, `spatial entity map ${map.id}`)
    if (!map.mappingPrecision) issues.push(`Spatial entity map requires mapping precision for ${map.id}`)
  })
  seed.movementVisualizations.forEach((visualization) => {
    const movement = movementBySlug.get(visualization.movement)
    const rangeOfMotion = visualization.rangeOfMotion ? rangeOfMotionBySlug.get(visualization.rangeOfMotion) : undefined
    const hasPrimaryEntityType = Boolean(visualization.primaryEntityType)
    const hasPrimaryEntitySlug = Boolean(visualization.primaryEntitySlug)

    if (!spatialModelSlugs.has(visualization.modelSlug)) issues.push(`Invalid spatial model for movement visualization ${visualization.id}`)
    if (!jointSlugs.has(visualization.joint)) issues.push(`Invalid joint for movement visualization ${visualization.id}`)
    if (!movementSlugs.has(visualization.movement)) issues.push(`Invalid movement for movement visualization ${visualization.id}`)
    if (visualization.rangeOfMotion && !rangeOfMotionSlugs.has(visualization.rangeOfMotion)) issues.push(`Invalid ROM for movement visualization ${visualization.id}`)
    if (movement && movement.joint !== visualization.joint) {
      issues.push(`Movement ${visualization.movement} does not belong to joint ${visualization.joint} for movement visualization ${visualization.id}`)
    }
    if (rangeOfMotion && (rangeOfMotion.joint !== visualization.joint || rangeOfMotion.movement !== visualization.movement)) {
      issues.push(`ROM ${visualization.rangeOfMotion} does not match joint ${visualization.joint} and movement ${visualization.movement} for movement visualization ${visualization.id}`)
    }
    if (hasPrimaryEntityType !== hasPrimaryEntitySlug) {
      issues.push(`Movement visualization ${visualization.id} requires both primary entity type and slug`)
    } else if (visualization.primaryEntityType && visualization.primaryEntitySlug) {
      if (!isAnatomyEntityType(visualization.primaryEntityType)) {
        issues.push(`Invalid primary entity type for movement visualization ${visualization.id}`)
      } else if (!entityExists(seed, visualization.primaryEntityType, visualization.primaryEntitySlug)) {
        issues.push(`Invalid primary entity for movement visualization ${visualization.id}`)
      }
    }
    validSource(visualization.sourceRef, `movement visualization ${visualization.id}`)
  })

  return issues
}

export function getAnatomyFoundationSummary(seed: AnatomyFoundationSeed = ANATOMY_FOUNDATION_SEED) {
  const summary = Object.fromEntries(COLLECTION_NAMES.map((collectionName) => [
    collectionName,
    seed[collectionName].length,
  ]))

  return {
    ...summary,
    actions: seed.jointMovements.length,
  }
}

export function getAnatomyCitationCoverage(seed: AnatomyFoundationSeed = ANATOMY_FOUNDATION_SEED): AnatomyCitationCoverage {
  const targets = sourceReferenceCitationTargets(seed)
  const citationKeys = new Set(seed.citations.map(citationSourceReferenceKey).filter((key): key is string => Boolean(key)))
  const missingSourceReferenceCitationKeys = targets
    .map(sourceReferenceCitationKey)
    .filter((key) => !citationKeys.has(key))

  return {
    sourceReferencedFactCount: targets.length,
    sourceReferenceCitationCount: seed.citations.filter((citation) => citation.factType === "seed_source_reference").length,
    missingSourceReferenceCitationKeys,
    reviewedCitationCount: seed.citations.filter((citation) => citation.reviewStatus === "reviewed").length,
    needsReviewCitationCount: seed.citations.filter((citation) => citation.reviewStatus === "needs_review").length,
    starterCitationCount: seed.citations.filter((citation) => citation.reviewStatus === "starter").length,
  }
}

export function findClientTermMapping(label: string, seed: AnatomyFoundationSeed = ANATOMY_FOUNDATION_SEED) {
  const normalized = normalizeText(label)

  return seed.clientTerms.find((term) => normalizeText(term.term) === normalized || term.slug === normalized || normalizeText(term.label ?? "") === normalized)
}

export function findMusclesAttachedToBone(boneSlug: string, seed: AnatomyFoundationSeed = ANATOMY_FOUNDATION_SEED) {
  const attachedMuscleSlugs = new Set(
    seed.muscleAttachments
      .filter((attachment) => attachment.bone === boneSlug)
      .map((attachment) => attachment.muscle),
  )

  return seed.muscles.filter((muscle) => attachedMuscleSlugs.has(muscle.slug))
}

export function findMusclesByInnervation(nerveSlug: string, seed: AnatomyFoundationSeed = ANATOMY_FOUNDATION_SEED) {
  const innervatedMuscleSlugs = new Set(
    seed.muscleInnervations
      .filter((innervation) => innervation.nerve === nerveSlug)
      .map((innervation) => innervation.muscle),
  )

  return seed.muscles.filter((muscle) => innervatedMuscleSlugs.has(muscle.slug))
}

export function findMusclesForJointMovement(movementSlug: string, seed: AnatomyFoundationSeed = ANATOMY_FOUNDATION_SEED) {
  return seed.muscleActions
    .filter((action) => action.movement === movementSlug)
    .map((action) => ({
      action,
      muscle: seed.muscles.find((muscle) => muscle.slug === action.muscle),
      joint: seed.joints.find((joint) => joint.slug === action.joint),
      movement: seed.jointMovements.find((movement) => movement.slug === action.movement),
    }))
    .filter((entry): entry is {
      action: MuscleAction
      muscle: Muscle
      joint: Joint
      movement: JointMovement
    } => Boolean(entry.muscle && entry.joint && entry.movement))
}

export function findRangeOfMotion(jointSlug: string, movementSlug: string, seed: AnatomyFoundationSeed = ANATOMY_FOUNDATION_SEED) {
  return seed.rangesOfMotion.find((range) => range.joint === jointSlug && range.movement === movementSlug)
}

export function findPainMapOverlaps(regionSlug: string, seed: AnatomyFoundationSeed = ANATOMY_FOUNDATION_SEED) {
  const directPainMapSlugs = new Set(
    seed.painMapRegions
      .filter((painMapRegion) => painMapRegion.region === regionSlug)
      .map((painMapRegion) => painMapRegion.slug),
  )
  const relatedPainMapSlugs = new Set(
    seed.relationships
      .filter((relationship) => (
        relationship.sourceEntityType === "pain_map_region" &&
        relationship.relationshipType === "overlaps_region" &&
        relationship.targetEntityType === "region" &&
        relationship.targetEntitySlug === regionSlug
      ))
      .map((relationship) => relationship.sourceEntitySlug),
  )

  return seed.painMapRegions.filter((painMapRegion) => directPainMapSlugs.has(painMapRegion.slug) || relatedPainMapSlugs.has(painMapRegion.slug))
}

export function searchAnatomyFoundation(query: string, seed: AnatomyFoundationSeed = ANATOMY_FOUNDATION_SEED) {
  const normalizedQuery = normalizeText(query)
  const results = new Map<string, AnatomyFoundationSearchResult>()

  if (!normalizedQuery) {
    return []
  }

  const addResult = (result: AnatomyFoundationSearchResult) => {
    const key = `${result.entityType}:${result.slug}`
    const existing = results.get(key)

    if (!existing || !existing.matchedTerm) {
      results.set(key, result)
    }
  }

  seed.bodyRegions.forEach((region) => {
    if (textMatches(region.slug, normalizedQuery) || textMatches(region.name, normalizedQuery) || textMatches(region.description, normalizedQuery)) {
      addResult({ entityType: "region", slug: region.slug, label: region.name })
    }
  })
  seed.bodySubregions.forEach((region) => {
    if (textMatches(region.slug, normalizedQuery) || textMatches(region.name, normalizedQuery) || textMatches(region.description, normalizedQuery)) {
      addResult({ entityType: "region", slug: region.slug, label: region.name })
    }
  })
  seed.bones.forEach((bone) => {
    if (textMatches(bone.slug, normalizedQuery) || textMatches(bone.name, normalizedQuery) || textMatches(bone.formalName, normalizedQuery) || textMatches(bone.description, normalizedQuery)) {
      addResult({ entityType: "bone", slug: bone.slug, label: bone.name })
    }
  })
  seed.boneLandmarks.forEach((landmark) => {
    if (textMatches(landmark.slug, normalizedQuery) || textMatches(landmark.name, normalizedQuery) || textMatches(landmark.description, normalizedQuery)) {
      addResult({ entityType: "bone_landmark", slug: landmark.slug, label: landmark.name })
    }
  })
  seed.joints.forEach((joint) => {
    if (textMatches(joint.slug, normalizedQuery) || textMatches(joint.name, normalizedQuery) || textMatches(joint.jointType, normalizedQuery) || textMatches(joint.description, normalizedQuery)) {
      addResult({ entityType: "joint", slug: joint.slug, label: joint.name })
    }
  })
  seed.jointMovements.forEach((movement) => {
    if (textMatches(movement.slug, normalizedQuery) || textMatches(movement.movementName, normalizedQuery) || textMatches(movement.description, normalizedQuery)) {
      addResult({ entityType: "joint_movement", slug: movement.slug, label: movement.movementName })
    }
  })
  seed.muscles.forEach((muscle) => {
    const directMatch = (
      textMatches(muscle.slug, normalizedQuery) ||
      textMatches(muscle.name, normalizedQuery) ||
      textMatches(muscle.formalName, normalizedQuery) ||
      textMatches(muscle.description, normalizedQuery) ||
      muscle.alternateNames.some((name) => textMatches(name, normalizedQuery))
    )

    if (directMatch) {
      addResult({ entityType: "muscle", slug: muscle.slug, label: muscle.name })
    }
  })
  seed.nerves.forEach((nerve) => {
    if (textMatches(nerve.slug, normalizedQuery) || textMatches(nerve.name, normalizedQuery) || textMatches(nerve.description, normalizedQuery) || nerve.nerveRoots.some((root) => textMatches(root, normalizedQuery))) {
      addResult({ entityType: "nerve", slug: nerve.slug, label: nerve.name })
    }
  })
  seed.ligaments.forEach((ligament) => {
    if (textMatches(ligament.slug, normalizedQuery) || textMatches(ligament.name, normalizedQuery) || textMatches(ligament.description, normalizedQuery)) {
      addResult({ entityType: "ligament", slug: ligament.slug, label: ligament.name })
    }
  })
  seed.bloodSupply.forEach((bloodSupply) => {
    if (textMatches(bloodSupply.slug, normalizedQuery) || textMatches(bloodSupply.name, normalizedQuery) || textMatches(bloodSupply.description, normalizedQuery)) {
      addResult({ entityType: "blood_supply", slug: bloodSupply.slug, label: bloodSupply.name })
    }
  })
  seed.structures.forEach((structure) => {
    if (textMatches(structure.slug, normalizedQuery) || textMatches(structure.name, normalizedQuery) || textMatches(structure.structureType, normalizedQuery) || textMatches(structure.description, normalizedQuery)) {
      addResult({ entityType: "anatomy_structure", slug: structure.slug, label: structure.name })
    }
  })
  seed.concepts.forEach((concept) => {
    if (textMatches(concept.slug, normalizedQuery) || textMatches(concept.name, normalizedQuery) || textMatches(concept.conceptType, normalizedQuery) || textMatches(concept.bodySystem, normalizedQuery) || textMatches(concept.description, normalizedQuery)) {
      addResult({ entityType: "anatomy_concept", slug: concept.slug, label: concept.name })
    }
  })
  seed.painMapRegions.forEach((painMapRegion) => {
    if (textMatches(painMapRegion.slug, normalizedQuery) || textMatches(painMapRegion.name, normalizedQuery) || textMatches(painMapRegion.plainLanguageDescription, normalizedQuery)) {
      addResult({ entityType: "pain_map_region", slug: painMapRegion.slug, label: painMapRegion.name })
    }
  })
  seed.clientTerms.forEach((clientTerm) => {
    if (textMatches(clientTerm.slug, normalizedQuery) || textMatches(clientTerm.term, normalizedQuery) || textMatches(clientTerm.label, normalizedQuery) || textMatches(clientTerm.plainLanguageDescription, normalizedQuery)) {
      addResult({ entityType: "client_term", slug: clientTerm.slug, label: clientTerm.term })
    }
  })
  seed.entityTerms.forEach((term) => {
    if (textMatches(term.term, normalizedQuery)) {
      const label = entityLabel(seed, term.anatomyEntityType, term.anatomyEntitySlug) ?? term.term
      addResult({
        entityType: term.anatomyEntityType,
        slug: term.anatomyEntitySlug,
        label,
        matchedTerm: term.term,
        termType: term.termType,
      })
    }
  })

  return [...results.values()]
}

export function getAnatomyMilestoneCoverage(seed: AnatomyFoundationSeed = ANATOMY_FOUNDATION_SEED): AnatomyMilestoneCoverage {
  const muscleSlugs = slugsFor(seed.muscles)
  const jointSlugs = slugsFor(seed.joints)
  const nerveSlugs = slugsFor(seed.nerves)
  const clientTermSlugs = slugsFor(seed.clientTerms)
  const musclesWithAttachments = new Set(seed.muscleAttachments.map((attachment) => attachment.muscle))
  const musclesWithInnervation = new Set(seed.muscleInnervations.map((innervation) => innervation.muscle))
  const musclesWithAction = new Set(seed.muscleActions.map((action) => action.muscle))
  const musclesWithEntityTerms = new Set(seed.entityTerms.filter((term) => term.anatomyEntityType === "muscle").map((term) => term.anatomyEntitySlug))

  return {
    missingRequiredMuscleSlugs: REQUIRED_MILESTONE_MUSCLES.filter((slug) => !muscleSlugs.has(slug)),
    missingRequiredJointSlugs: REQUIRED_MILESTONE_JOINTS.filter((slug) => !jointSlugs.has(slug)),
    missingRequiredNerveSlugs: REQUIRED_MILESTONE_NERVES.filter((slug) => !nerveSlugs.has(slug)),
    missingRequiredClientTermSlugs: REQUIRED_MILESTONE_CLIENT_TERMS.filter((slug) => !clientTermSlugs.has(slug)),
    musclesWithAttachmentCount: seed.muscles.filter((muscle) => musclesWithAttachments.has(muscle.slug)).length,
    musclesWithInnervationCount: seed.muscles.filter((muscle) => musclesWithInnervation.has(muscle.slug)).length,
    musclesWithActionCount: seed.muscles.filter((muscle) => musclesWithAction.has(muscle.slug)).length,
    musclesWithEntityTermCount: seed.muscles.filter((muscle) => musclesWithEntityTerms.has(muscle.slug)).length,
  }
}

export function getWholeBodyAnatomyCoverage(seed: AnatomyFoundationSeed = ANATOMY_FOUNDATION_SEED): WholeBodyAnatomyCoverage {
  const bodyRegionSlugs = slugsFor(seed.bodyRegions)
  const subregionSlugs = slugsFor(seed.bodySubregions)
  const clientTermSlugs = slugsFor(seed.clientTerms)
  const structureSlugs = slugsFor(seed.structures)

  return {
    missingRequiredRegionSlugs: REQUIRED_WHOLE_BODY_REGIONS.filter((slug) => !bodyRegionSlugs.has(slug)),
    missingRequiredBodyRegionSlugs: REQUIRED_WHOLE_BODY_REGIONS.filter((slug) => !bodyRegionSlugs.has(slug)),
    missingRequiredSubregionSlugs: REQUIRED_WHOLE_BODY_SUBREGIONS.filter((slug) => !subregionSlugs.has(slug)),
    missingRequiredClientTermSlugs: REQUIRED_WHOLE_BODY_CLIENT_TERMS.filter((slug) => !clientTermSlugs.has(slug)),
    missingRequiredStructureSlugs: REQUIRED_WHOLE_BODY_STRUCTURES.filter((slug) => !structureSlugs.has(slug)),
    sectionPackSlugs: REQUIRED_WHOLE_BODY_REGIONS.filter((slug) => bodyRegionSlugs.has(slug)),
  }
}

export function getAtlasBoneCompletenessCoverage(seed: AnatomyFoundationSeed = ANATOMY_FOUNDATION_SEED): AtlasBoneCompletenessCoverage {
  const boneSlugs = slugsFor(seed.bones)
  const requiredGroupRelationshipKeys = REQUIRED_ATLAS_BONE_GROUP_TARGETS.flatMap((group) => (
    group.targets.map((targetSlug) => `${group.groupSlug}->${targetSlug}`)
  ))
  const relationshipKeys = new Set(seed.relationships
    .filter((relationship) => relationship.sourceEntityType === "bone"
      && relationship.relationshipType === "includes_bone"
      && relationship.targetEntityType === "bone")
    .map((relationship) => `${relationship.sourceEntitySlug}->${relationship.targetEntitySlug}`))

  return {
    requiredIndividualBoneSlugs: REQUIRED_ATLAS_INDIVIDUAL_BONES,
    missingIndividualBoneSlugs: REQUIRED_ATLAS_INDIVIDUAL_BONES.filter((slug) => !boneSlugs.has(slug)),
    presentIndividualBoneCount: REQUIRED_ATLAS_INDIVIDUAL_BONES.filter((slug) => boneSlugs.has(slug)).length,
    requiredGroupRelationshipKeys,
    missingGroupRelationshipKeys: requiredGroupRelationshipKeys.filter((key) => !relationshipKeys.has(key)),
    groupRelationshipCount: requiredGroupRelationshipKeys.filter((key) => relationshipKeys.has(key)).length,
  }
}

export function getGrossAnatomySystemCoverage(seed: AnatomyFoundationSeed = ANATOMY_FOUNDATION_SEED): GrossAnatomySystemCoverage {
  const structureSlugs = slugsFor(seed.structures)
  const conceptSlugs = slugsFor(seed.concepts)
  const systems = REQUIRED_GROSS_ANATOMY_SYSTEM_STRUCTURES.map((system) => {
    const requiredStructureSlugs = [...system.structureSlugs]
    const presentStructureSlugs = requiredStructureSlugs.filter((slug) => structureSlugs.has(slug))

    return {
      systemSlug: system.systemSlug,
      systemConceptSlug: system.systemConceptSlug,
      requiredStructureSlugs,
      presentStructureSlugs,
      missingStructureSlugs: requiredStructureSlugs.filter((slug) => !structureSlugs.has(slug)),
    }
  })

  return {
    requiredStructureSlugs: systems.flatMap((system) => system.requiredStructureSlugs),
    missingRequiredSystemSlugs: systems
      .filter((system) => !conceptSlugs.has(system.systemConceptSlug))
      .map((system) => system.systemSlug),
    missingRequiredStructureSlugs: systems.flatMap((system) => system.missingStructureSlugs),
    systems,
  }
}

function entityLabel(seed: AnatomyFoundationSeed, entityType: AnatomyEntityType, slug: string) {
  switch (entityType) {
    case "region":
      return [...seed.bodyRegions, ...seed.bodySubregions].find((region) => region.slug === slug)?.name
    case "blood_supply":
      return seed.bloodSupply.find((bloodSupply) => bloodSupply.slug === slug)?.name
    case "anatomy_structure":
      return seed.structures.find((structure) => structure.slug === slug)?.name
    case "anatomy_concept":
      return seed.concepts.find((concept) => concept.slug === slug)?.name
    case "bone":
      return seed.bones.find((bone) => bone.slug === slug)?.name
    case "bone_landmark":
      return seed.boneLandmarks.find((landmark) => landmark.slug === slug)?.name
    case "joint":
      return seed.joints.find((joint) => joint.slug === slug)?.name
    case "joint_movement":
      return seed.jointMovements.find((movement) => movement.slug === slug)?.movementName
    case "range_of_motion":
      return seed.rangesOfMotion.find((range) => range.slug === slug)?.slug
    case "muscle":
      return seed.muscles.find((muscle) => muscle.slug === slug)?.name
    case "muscle_attachment":
      return seed.muscleAttachments.find((attachment) => attachment.id === slug)?.description
    case "muscle_action":
      return seed.muscleActions.find((action) => action.id === slug)?.description
    case "nerve":
      return seed.nerves.find((nerve) => nerve.slug === slug)?.name
    case "muscle_innervation":
      return seed.muscleInnervations.find((innervation) => innervation.id === slug)?.description
    case "ligament":
      return seed.ligaments.find((ligament) => ligament.slug === slug)?.name
    case "pain_map_region":
      return seed.painMapRegions.find((painMapRegion) => painMapRegion.slug === slug)?.name
    case "client_term":
      return seed.clientTerms.find((clientTerm) => clientTerm.slug === slug)?.term
  }
}
