import type { AnatomySeedSection } from "./sections.ts"

const APPLIED_HUMAN_ANATOMY_SOURCE = "applied-human-anatomy"
const APPLIED_HUMAN_ANATOMY_LOCATOR = "https://open.umn.edu/opentextbooks/textbooks/1266"
const HUMAN_BIOLOGY_SOURCE = "openstax-human-biology"
const HUMAN_BIOLOGY_LOCATOR = "https://open.umn.edu/opentextbooks/textbooks/576"
const FIPAT_SOURCE = "fipat-ta2"
const FIPAT_LOCATOR = "https://libraries.dal.ca/Fipat/ta2.html"
const ROM_TRACKING_SOURCE = "massagelab-authored-rom-tracking"
const ROM_TRACKING_LOCATOR = "MassageLab-authored ROM tracking protocol metadata, 2026-05-24"

type CitationRow = NonNullable<AnatomySeedSection["citations"]>[number]
type ExternalIdentifierRow = NonNullable<AnatomySeedSection["externalIdentifiers"]>[number]
type MuscleRow = NonNullable<AnatomySeedSection["muscles"]>[number]
type MuscleAttachmentRow = NonNullable<AnatomySeedSection["muscleAttachments"]>[number]
type MuscleActionRow = NonNullable<AnatomySeedSection["muscleActions"]>[number]
type MuscleInnervationRow = NonNullable<AnatomySeedSection["muscleInnervations"]>[number]
type EntityTermRow = NonNullable<AnatomySeedSection["entityTerms"]>[number]
type RelationshipRow = NonNullable<AnatomySeedSection["relationships"]>[number]
type LigamentRow = NonNullable<AnatomySeedSection["ligaments"]>[number]
type NerveRow = NonNullable<AnatomySeedSection["nerves"]>[number]
type BloodSupplyRow = NonNullable<AnatomySeedSection["bloodSupply"]>[number]
type StructureRow = NonNullable<AnatomySeedSection["structures"]>[number]
type JointRow = NonNullable<AnatomySeedSection["joints"]>[number]
type JointMovementRow = NonNullable<AnatomySeedSection["jointMovements"]>[number]
type RangeOfMotionRow = NonNullable<AnatomySeedSection["rangesOfMotion"]>[number]

type AttachmentSpec = {
  type: MuscleAttachmentRow["type"]
  bone: string
  landmark?: string
  description: string
}

type ActionSpec = {
  joint: string
  movement: string
  role?: MuscleActionRow["role"]
  contractionType?: MuscleActionRow["contractionType"]
  description: string
}

type MuscleSpec = {
  slug: string
  name: string
  formalName: string
  alternateNames: string[]
  region: string
  relativeDepth: MuscleRow["relativeDepth"]
  depthNotes: string
  category: string
  functionalSummary: string
  attachments: AttachmentSpec[]
  actions: ActionSpec[]
  nerve: string
  innervationDescription: string
  structureTargets?: string[]
}

type SimpleEntitySpec = {
  slug: string
  name: string
  formalName?: string
  alternateNames?: string[]
  description: string
  region: string
  sourceRef?: string
}

type LigamentSpec = SimpleEntitySpec & {
  joint: string
  relationshipType: string
  targetEntityType: RelationshipRow["targetEntityType"]
  targetEntitySlug: string
}

type NerveSpec = SimpleEntitySpec & {
  nerveRoots: string[]
  relationshipType: string
  targetEntityType: RelationshipRow["targetEntityType"]
  targetEntitySlug: string
}

type BloodSupplySpec = SimpleEntitySpec & {
  kind: BloodSupplyRow["kind"]
  relationshipType: string
  targetEntityType: RelationshipRow["targetEntityType"]
  targetEntitySlug: string
}

type StructureSpec = SimpleEntitySpec & {
  structureType: string
  relationshipType: string
  targetEntityType: RelationshipRow["targetEntityType"]
  targetEntitySlug: string
}

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

function sourceLocatorFor(sourceRef: string) {
  if (sourceRef === HUMAN_BIOLOGY_SOURCE) return HUMAN_BIOLOGY_LOCATOR
  if (sourceRef === ROM_TRACKING_SOURCE) return ROM_TRACKING_LOCATOR
  return APPLIED_HUMAN_ANATOMY_LOCATOR
}

function reviewedCitation(
  entityType: CitationRow["entityType"],
  entitySlug: string,
  factType: string,
  factSlug: string | undefined,
  sourceRef: string,
  sourceLocator: string,
  citationNote: string,
) {
  const factSegment = factSlug ? `-${slugify(factSlug)}` : ""
  const id = `citation-${slugify(entityType)}-${entitySlug}-${slugify(factType)}${factSegment}`

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
  } satisfies CitationRow
}

function fipatIdentifier(entityType: ExternalIdentifierRow["entityType"], entitySlug: string, label: string) {
  return {
    id: `external-${slugify(entityType)}-${entitySlug}-fipat-ta2`,
    entityType,
    entitySlug,
    provider: "FIPAT_TA2",
    identifier: `TA2:${label}`,
    iri: FIPAT_LOCATOR,
    label,
    sourceRef: FIPAT_SOURCE,
  } satisfies ExternalIdentifierRow
}

function entityTerms(
  entityType: EntityTermRow["anatomyEntityType"],
  entitySlug: string,
  preferredTerm: string,
  formalTerm: string,
  alternateTerms: string[] = [],
  practicalSourceRef = APPLIED_HUMAN_ANATOMY_SOURCE,
) {
  return [
    {
      id: `term-${entitySlug}-preferred-fipat`,
      anatomyEntityType: entityType,
      anatomyEntitySlug: entitySlug,
      term: preferredTerm,
      termType: "preferred",
      sourceRef: FIPAT_SOURCE,
    },
    {
      id: `term-${entitySlug}-formal-fipat`,
      anatomyEntityType: entityType,
      anatomyEntitySlug: entitySlug,
      term: formalTerm,
      termType: "formal",
      sourceRef: FIPAT_SOURCE,
    },
    ...alternateTerms.map((term, index) => ({
      id: `term-${entitySlug}-alternate-${index + 1}-${slugify(term)}`,
      anatomyEntityType: entityType,
      anatomyEntitySlug: entitySlug,
      term,
      termType: (index === 0 ? "common" : "alternate") as EntityTermRow["termType"],
      sourceRef: practicalSourceRef,
    })),
  ] satisfies EntityTermRow[]
}

function rowCitations(
  entityType: CitationRow["entityType"],
  entitySlug: string,
  formalTerm: string,
  sourceRef: string,
) {
  return [
    reviewedCitation(
      entityType,
      entitySlug,
      "clinical_summary",
      undefined,
      sourceRef,
      sourceLocatorFor(sourceRef),
      "MassageLab-authored display summary reviewed against a commercial-safe anatomy reference for non-diagnostic education and internal tooling.",
    ),
    reviewedCitation(
      entityType,
      entitySlug,
      "official_term",
      `term-${entitySlug}-preferred-fipat`,
      FIPAT_SOURCE,
      `FIPAT TA2: ${formalTerm}`,
      "FIPAT TA2 official anatomical terminology used for the preferred/formal term row.",
    ),
    reviewedCitation(
      entityType,
      entitySlug,
      "external_identifier",
      `external-${slugify(entityType)}-${entitySlug}-fipat-ta2`,
      FIPAT_SOURCE,
      `FIPAT TA2: ${formalTerm}`,
      "FIPAT TA2 terminology anchor used as a stable external identifier until more precise ontology IDs are curated.",
    ),
  ] satisfies CitationRow[]
}

const FUNCTIONAL_JOINTS: JointRow[] = [
  {
    id: "joint-ocular-functional-complex",
    slug: "ocular-functional-complex",
    name: "Ocular Functional Complex",
    jointType: "functional",
    region: "head-face-jaw",
    description: "Functional model for tracking extraocular and eyelid movements without treating the eye as a synovial joint.",
    sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
  },
  {
    id: "joint-pharyngeal-functional-complex",
    slug: "pharyngeal-functional-complex",
    name: "Pharyngeal Functional Complex",
    jointType: "functional",
    region: "head-face-jaw",
    description: "Functional model for pharyngeal elevation and constriction patterns used in anatomy education.",
    sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
  },
  {
    id: "joint-soft-palate-functional-complex",
    slug: "soft-palate-functional-complex",
    name: "Soft Palate Functional Complex",
    jointType: "functional",
    region: "head-face-jaw",
    description: "Functional model for palatal tension and elevation actions without implying a conventional joint surface.",
    sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
  },
]

const FUNCTIONAL_MOVEMENTS: JointMovementRow[] = [
  { id: "movement-eye-elevation", slug: "eye-elevation", joint: "ocular-functional-complex", movementName: "Eye Elevation", plane: "functional", axis: "ocular", description: "Superior movement of the globe used for extraocular muscle action mapping.", sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE },
  { id: "movement-eye-depression", slug: "eye-depression", joint: "ocular-functional-complex", movementName: "Eye Depression", plane: "functional", axis: "ocular", description: "Inferior movement of the globe used for extraocular muscle action mapping.", sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE },
  { id: "movement-eye-adduction", slug: "eye-adduction", joint: "ocular-functional-complex", movementName: "Eye Adduction", plane: "functional", axis: "ocular", description: "Medial movement of the globe toward the nose.", sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE },
  { id: "movement-eye-abduction", slug: "eye-abduction", joint: "ocular-functional-complex", movementName: "Eye Abduction", plane: "functional", axis: "ocular", description: "Lateral movement of the globe away from the nose.", sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE },
  { id: "movement-eye-intorsion", slug: "eye-intorsion", joint: "ocular-functional-complex", movementName: "Eye Intorsion", plane: "functional", axis: "ocular", description: "Rotational movement that turns the superior pole of the globe medially.", sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE },
  { id: "movement-eye-extorsion", slug: "eye-extorsion", joint: "ocular-functional-complex", movementName: "Eye Extorsion", plane: "functional", axis: "ocular", description: "Rotational movement that turns the superior pole of the globe laterally.", sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE },
  { id: "movement-eyelid-elevation", slug: "eyelid-elevation", joint: "ocular-functional-complex", movementName: "Eyelid Elevation", plane: "functional", axis: "eyelid", description: "Lifting of the upper eyelid by the levator palpebrae superioris.", sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE },
  { id: "movement-vocal-fold-abduction", slug: "vocal-fold-abduction", joint: "laryngeal-functional-complex", movementName: "Vocal Fold Abduction", plane: "functional", axis: "laryngeal", description: "Opening movement of the vocal folds at the laryngeal functional complex.", sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE },
  { id: "movement-vocal-fold-adduction", slug: "vocal-fold-adduction", joint: "laryngeal-functional-complex", movementName: "Vocal Fold Adduction", plane: "functional", axis: "laryngeal", description: "Closing movement of the vocal folds at the laryngeal functional complex.", sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE },
  { id: "movement-vocal-fold-tension", slug: "vocal-fold-tension", joint: "laryngeal-functional-complex", movementName: "Vocal Fold Tension", plane: "functional", axis: "laryngeal", description: "Functional tensioning of the vocal fold mechanism during phonation control.", sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE },
  { id: "movement-pharyngeal-constriction", slug: "pharyngeal-constriction", joint: "pharyngeal-functional-complex", movementName: "Pharyngeal Constriction", plane: "functional", axis: "pharyngeal", description: "Sequential narrowing of the pharyngeal wall used during swallowing.", sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE },
  { id: "movement-pharyngeal-elevation", slug: "pharyngeal-elevation", joint: "pharyngeal-functional-complex", movementName: "Pharyngeal Elevation", plane: "functional", axis: "pharyngeal", description: "Superior movement of pharyngeal and laryngeal tissues during swallowing mechanics.", sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE },
  { id: "movement-soft-palate-elevation", slug: "soft-palate-elevation", joint: "soft-palate-functional-complex", movementName: "Soft Palate Elevation", plane: "functional", axis: "palatal", description: "Elevation of the soft palate to separate the nasopharynx during speech and swallowing.", sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE },
  { id: "movement-soft-palate-tension", slug: "soft-palate-tension", joint: "soft-palate-functional-complex", movementName: "Soft Palate Tension", plane: "functional", axis: "palatal", description: "Tensioning action of the soft palate and palatine aponeurosis.", sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE },
]

const FUNCTIONAL_RANGES: RangeOfMotionRow[] = [
  {
    id: "rom-ocular-functional-observation",
    slug: "ocular-functional-observation",
    joint: "ocular-functional-complex",
    movement: "eye-elevation",
    typicalMinValue: 0,
    typicalMaxValue: 5,
    measurementUnit: "ordinal_0_5",
    measurementPosition: "Non-diagnostic observation of symmetrical extraocular movement quality.",
    notes: "Ordinal tracking only; not a diagnostic ocular motility test.",
    sourceRef: ROM_TRACKING_SOURCE,
  },
  {
    id: "rom-pharyngeal-functional-observation",
    slug: "pharyngeal-functional-observation",
    joint: "pharyngeal-functional-complex",
    movement: "pharyngeal-constriction",
    typicalMinValue: 0,
    typicalMaxValue: 5,
    measurementUnit: "ordinal_0_5",
    measurementPosition: "Educational observation or self-report context only.",
    notes: "Functional anatomy tracking label, not a diagnostic swallowing assessment.",
    sourceRef: ROM_TRACKING_SOURCE,
  },
  {
    id: "rom-soft-palate-functional-observation",
    slug: "soft-palate-functional-observation",
    joint: "soft-palate-functional-complex",
    movement: "soft-palate-elevation",
    typicalMinValue: 0,
    typicalMaxValue: 5,
    measurementUnit: "ordinal_0_5",
    measurementPosition: "Educational observation or client-friendly anatomy context only.",
    notes: "Functional anatomy tracking label, not a diagnostic speech or swallowing assessment.",
    sourceRef: ROM_TRACKING_SOURCE,
  },
]

const ROM_CITATIONS = FUNCTIONAL_RANGES.map((range) => reviewedCitation(
  "range_of_motion",
  range.slug,
  "rom_protocol",
  undefined,
  ROM_TRACKING_SOURCE,
  ROM_TRACKING_LOCATOR,
  "MassageLab-authored non-diagnostic ordinal tracking protocol for functional anatomy education.",
))

const MUSCLE_SPECS: MuscleSpec[] = [
  {
    slug: "superior-rectus",
    name: "Superior Rectus",
    formalName: "Rectus superior",
    alternateNames: ["superior rectus muscle", "extraocular muscle"],
    region: "head-face-jaw",
    relativeDepth: "deep",
    depthNotes: "Deep orbital muscle within the extraocular muscle group.",
    category: "extraocular",
    functionalSummary: "It elevates the eye and also contributes to adduction and intorsion depending on gaze position.",
    attachments: [
      { type: "origin", bone: "sphenoid-bone", landmark: "atlas-cranial-bones-reference-region", description: "Common tendinous ring region at the orbital apex of the sphenoid." },
      { type: "insertion", bone: "sphenoid-bone", landmark: "atlas-cranial-bones-reference-region", description: "Superior anterior sclera of the eyeball; stored with orbital bone context until soft-tissue attachments are fully normalized." },
    ],
    actions: [{ joint: "ocular-functional-complex", movement: "eye-elevation", role: "primary", contractionType: "concentric", description: "Elevates the eye in the ocular functional complex." }],
    nerve: "oculomotor-nerve",
    innervationDescription: "Oculomotor nerve motor supply to superior rectus.",
    structureTargets: ["sclera"],
  },
  {
    slug: "inferior-rectus",
    name: "Inferior Rectus",
    formalName: "Rectus inferior",
    alternateNames: ["inferior rectus muscle", "extraocular muscle"],
    region: "head-face-jaw",
    relativeDepth: "deep",
    depthNotes: "Deep orbital muscle within the extraocular muscle group.",
    category: "extraocular",
    functionalSummary: "It depresses the eye and also contributes to adduction and extorsion depending on gaze position.",
    attachments: [
      { type: "origin", bone: "sphenoid-bone", landmark: "atlas-cranial-bones-reference-region", description: "Common tendinous ring region at the orbital apex of the sphenoid." },
      { type: "insertion", bone: "sphenoid-bone", landmark: "atlas-cranial-bones-reference-region", description: "Inferior anterior sclera of the eyeball; stored with orbital bone context until soft-tissue attachments are fully normalized." },
    ],
    actions: [{ joint: "ocular-functional-complex", movement: "eye-depression", role: "primary", contractionType: "concentric", description: "Depresses the eye in the ocular functional complex." }],
    nerve: "oculomotor-nerve",
    innervationDescription: "Oculomotor nerve motor supply to inferior rectus.",
    structureTargets: ["sclera"],
  },
  {
    slug: "medial-rectus",
    name: "Medial Rectus",
    formalName: "Rectus medialis",
    alternateNames: ["medial rectus muscle", "extraocular muscle"],
    region: "head-face-jaw",
    relativeDepth: "deep",
    depthNotes: "Deep orbital muscle within the extraocular muscle group.",
    category: "extraocular",
    functionalSummary: "It adducts the eye toward the nose and is a key medial gaze muscle.",
    attachments: [
      { type: "origin", bone: "sphenoid-bone", landmark: "atlas-cranial-bones-reference-region", description: "Common tendinous ring region at the orbital apex of the sphenoid." },
      { type: "insertion", bone: "sphenoid-bone", landmark: "atlas-cranial-bones-reference-region", description: "Medial anterior sclera of the eyeball; stored with orbital bone context until soft-tissue attachments are fully normalized." },
    ],
    actions: [{ joint: "ocular-functional-complex", movement: "eye-adduction", role: "primary", contractionType: "concentric", description: "Adducts the eye toward midline." }],
    nerve: "oculomotor-nerve",
    innervationDescription: "Oculomotor nerve motor supply to medial rectus.",
    structureTargets: ["sclera"],
  },
  {
    slug: "lateral-rectus",
    name: "Lateral Rectus",
    formalName: "Rectus lateralis",
    alternateNames: ["lateral rectus muscle", "extraocular muscle"],
    region: "head-face-jaw",
    relativeDepth: "deep",
    depthNotes: "Deep orbital muscle within the extraocular muscle group.",
    category: "extraocular",
    functionalSummary: "It abducts the eye away from the nose and is the primary lateral gaze muscle.",
    attachments: [
      { type: "origin", bone: "sphenoid-bone", landmark: "atlas-cranial-bones-reference-region", description: "Common tendinous ring region at the orbital apex of the sphenoid." },
      { type: "insertion", bone: "sphenoid-bone", landmark: "atlas-cranial-bones-reference-region", description: "Lateral anterior sclera of the eyeball; stored with orbital bone context until soft-tissue attachments are fully normalized." },
    ],
    actions: [{ joint: "ocular-functional-complex", movement: "eye-abduction", role: "primary", contractionType: "concentric", description: "Abducts the eye away from midline." }],
    nerve: "abducens-nerve",
    innervationDescription: "Abducens nerve motor supply to lateral rectus.",
    structureTargets: ["sclera"],
  },
  {
    slug: "superior-oblique",
    name: "Superior Oblique",
    formalName: "Obliquus superior",
    alternateNames: ["superior oblique muscle", "extraocular muscle"],
    region: "head-face-jaw",
    relativeDepth: "deep",
    depthNotes: "Deep orbital muscle that courses through the trochlear pulley region.",
    category: "extraocular",
    functionalSummary: "It intorts the eye and assists depression and abduction depending on gaze position.",
    attachments: [
      { type: "origin", bone: "sphenoid-bone", landmark: "atlas-cranial-bones-reference-region", description: "Body of the sphenoid and orbital apex region." },
      { type: "insertion", bone: "sphenoid-bone", landmark: "atlas-cranial-bones-reference-region", description: "Posterolateral sclera of the eyeball after passing through the trochlear region." },
    ],
    actions: [{ joint: "ocular-functional-complex", movement: "eye-intorsion", role: "primary", contractionType: "concentric", description: "Intorts the eye and assists selected gaze positions." }],
    nerve: "trochlear-nerve",
    innervationDescription: "Trochlear nerve motor supply to superior oblique.",
    structureTargets: ["sclera"],
  },
  {
    slug: "inferior-oblique",
    name: "Inferior Oblique",
    formalName: "Obliquus inferior",
    alternateNames: ["inferior oblique muscle", "extraocular muscle"],
    region: "head-face-jaw",
    relativeDepth: "deep",
    depthNotes: "Deep orbital muscle running from the anterior orbital floor toward the posterolateral globe.",
    category: "extraocular",
    functionalSummary: "It extorts the eye and assists elevation and abduction depending on gaze position.",
    attachments: [
      { type: "origin", bone: "maxilla", landmark: "atlas-facial-bones-reference-region", description: "Anterior medial orbital floor region of the maxilla." },
      { type: "insertion", bone: "sphenoid-bone", landmark: "atlas-cranial-bones-reference-region", description: "Posterolateral sclera of the eyeball." },
    ],
    actions: [{ joint: "ocular-functional-complex", movement: "eye-extorsion", role: "primary", contractionType: "concentric", description: "Extorts the eye and assists selected gaze positions." }],
    nerve: "oculomotor-nerve",
    innervationDescription: "Oculomotor nerve motor supply to inferior oblique.",
    structureTargets: ["sclera"],
  },
  {
    slug: "levator-palpebrae-superioris",
    name: "Levator Palpebrae Superioris",
    formalName: "Levator palpebrae superioris",
    alternateNames: ["upper eyelid elevator", "levator palpebrae"],
    region: "head-face-jaw",
    relativeDepth: "deep",
    depthNotes: "Deep superior orbital muscle superficial to the superior rectus in the orbital roof region.",
    category: "orbital eyelid",
    functionalSummary: "It elevates the upper eyelid and supports open-eye posture during visual tasks.",
    attachments: [
      { type: "origin", bone: "sphenoid-bone", landmark: "atlas-cranial-bones-reference-region", description: "Lesser wing/orbital apex region of the sphenoid." },
      { type: "insertion", bone: "frontal-bone", landmark: "frontal-belly-region", description: "Upper eyelid tarsal plate and skin region, stored with frontal/orbital context." },
    ],
    actions: [{ joint: "ocular-functional-complex", movement: "eyelid-elevation", role: "primary", contractionType: "concentric", description: "Elevates the upper eyelid." }],
    nerve: "oculomotor-nerve",
    innervationDescription: "Oculomotor nerve motor supply to levator palpebrae superioris.",
  },
  {
    slug: "cricothyroid",
    name: "Cricothyroid",
    formalName: "Cricothyroideus",
    alternateNames: ["cricothyroid muscle", "vocal fold tensor"],
    region: "anterior-neck",
    relativeDepth: "deep",
    depthNotes: "Deep intrinsic laryngeal muscle on the anterior larynx.",
    category: "intrinsic laryngeal",
    functionalSummary: "It tilts the thyroid cartilage relative to the cricoid cartilage to tense the vocal folds.",
    attachments: [
      { type: "origin", bone: "hyoid-bone", landmark: "body-of-hyoid", description: "Anterior cricoid cartilage region, stored with hyoid-laryngeal context." },
      { type: "insertion", bone: "hyoid-bone", landmark: "body-of-hyoid", description: "Inferior thyroid cartilage region, stored with hyoid-laryngeal context." },
    ],
    actions: [{ joint: "laryngeal-functional-complex", movement: "vocal-fold-tension", role: "primary", contractionType: "concentric", description: "Tenses the vocal folds through cricothyroid motion." }],
    nerve: "vagus-nerve",
    innervationDescription: "Vagus nerve contribution through the external laryngeal branch.",
    structureTargets: ["cricoid-cartilage", "thyroid-cartilage", "vocal-fold"],
  },
  {
    slug: "posterior-cricoarytenoid",
    name: "Posterior Cricoarytenoid",
    formalName: "Cricoarytenoideus posterior",
    alternateNames: ["posterior cricoarytenoid muscle", "vocal fold abductor"],
    region: "anterior-neck",
    relativeDepth: "deep",
    depthNotes: "Deep intrinsic laryngeal muscle on the posterior cricoid region.",
    category: "intrinsic laryngeal",
    functionalSummary: "It abducts the vocal folds and is the primary opener of the rima glottidis.",
    attachments: [
      { type: "origin", bone: "hyoid-bone", landmark: "body-of-hyoid", description: "Posterior surface of cricoid cartilage, stored with hyoid-laryngeal context." },
      { type: "insertion", bone: "hyoid-bone", landmark: "body-of-hyoid", description: "Muscular process of arytenoid cartilage, stored with hyoid-laryngeal context." },
    ],
    actions: [{ joint: "laryngeal-functional-complex", movement: "vocal-fold-abduction", role: "primary", contractionType: "concentric", description: "Abducts the vocal folds." }],
    nerve: "vagus-nerve",
    innervationDescription: "Vagus nerve contribution through recurrent laryngeal branches.",
    structureTargets: ["cricoid-cartilage", "arytenoid-cartilage", "vocal-fold"],
  },
  {
    slug: "lateral-cricoarytenoid",
    name: "Lateral Cricoarytenoid",
    formalName: "Cricoarytenoideus lateralis",
    alternateNames: ["lateral cricoarytenoid muscle", "vocal fold adductor"],
    region: "anterior-neck",
    relativeDepth: "deep",
    depthNotes: "Deep intrinsic laryngeal muscle between cricoid and arytenoid cartilage regions.",
    category: "intrinsic laryngeal",
    functionalSummary: "It adducts the vocal folds by rotating the arytenoid cartilages medially.",
    attachments: [
      { type: "origin", bone: "hyoid-bone", landmark: "body-of-hyoid", description: "Superior border of cricoid cartilage arch, stored with hyoid-laryngeal context." },
      { type: "insertion", bone: "hyoid-bone", landmark: "body-of-hyoid", description: "Muscular process of arytenoid cartilage, stored with hyoid-laryngeal context." },
    ],
    actions: [{ joint: "laryngeal-functional-complex", movement: "vocal-fold-adduction", role: "primary", contractionType: "concentric", description: "Adducts the vocal folds." }],
    nerve: "vagus-nerve",
    innervationDescription: "Vagus nerve contribution through recurrent laryngeal branches.",
    structureTargets: ["cricoid-cartilage", "arytenoid-cartilage", "vocal-fold"],
  },
  {
    slug: "transverse-arytenoid",
    name: "Transverse Arytenoid",
    formalName: "Arytenoideus transversus",
    alternateNames: ["transverse arytenoid muscle", "interarytenoid muscle"],
    region: "anterior-neck",
    relativeDepth: "deep",
    depthNotes: "Deep intrinsic laryngeal muscle spanning between arytenoid cartilages.",
    category: "intrinsic laryngeal",
    functionalSummary: "It draws the arytenoid cartilages together to assist vocal fold adduction.",
    attachments: [
      { type: "origin", bone: "hyoid-bone", landmark: "body-of-hyoid", description: "Posterior surface of one arytenoid cartilage, stored with hyoid-laryngeal context." },
      { type: "insertion", bone: "hyoid-bone", landmark: "body-of-hyoid", description: "Posterior surface of the opposite arytenoid cartilage, stored with hyoid-laryngeal context." },
    ],
    actions: [{ joint: "laryngeal-functional-complex", movement: "vocal-fold-adduction", role: "secondary", contractionType: "concentric", description: "Approximates the arytenoid cartilages during vocal fold closure." }],
    nerve: "vagus-nerve",
    innervationDescription: "Vagus nerve contribution through recurrent laryngeal branches.",
    structureTargets: ["arytenoid-cartilage", "vocal-fold"],
  },
  {
    slug: "oblique-arytenoid",
    name: "Oblique Arytenoid",
    formalName: "Arytenoideus obliquus",
    alternateNames: ["oblique arytenoid muscle", "aryepiglottic continuation"],
    region: "anterior-neck",
    relativeDepth: "deep",
    depthNotes: "Deep intrinsic laryngeal muscle running obliquely between arytenoid cartilages.",
    category: "intrinsic laryngeal",
    functionalSummary: "It assists arytenoid approximation and contributes to laryngeal inlet closure mechanics.",
    attachments: [
      { type: "origin", bone: "hyoid-bone", landmark: "body-of-hyoid", description: "Muscular process of one arytenoid cartilage, stored with hyoid-laryngeal context." },
      { type: "insertion", bone: "hyoid-bone", landmark: "body-of-hyoid", description: "Apex of the opposite arytenoid cartilage and aryepiglottic fold region." },
    ],
    actions: [{ joint: "laryngeal-functional-complex", movement: "vocal-fold-adduction", role: "secondary", contractionType: "concentric", description: "Assists closure of the laryngeal inlet and vocal fold approximation." }],
    nerve: "vagus-nerve",
    innervationDescription: "Vagus nerve contribution through recurrent laryngeal branches.",
    structureTargets: ["arytenoid-cartilage", "epiglottis", "vocal-fold"],
  },
  {
    slug: "thyroarytenoid",
    name: "Thyroarytenoid",
    formalName: "Thyroarytenoideus",
    alternateNames: ["thyroarytenoid muscle", "vocal fold relaxer"],
    region: "anterior-neck",
    relativeDepth: "deep",
    depthNotes: "Deep intrinsic laryngeal muscle forming part of the vocal fold complex.",
    category: "intrinsic laryngeal",
    functionalSummary: "It adjusts vocal fold tension and can assist adduction during phonation control.",
    attachments: [
      { type: "origin", bone: "hyoid-bone", landmark: "body-of-hyoid", description: "Inner thyroid cartilage angle region, stored with hyoid-laryngeal context." },
      { type: "insertion", bone: "hyoid-bone", landmark: "body-of-hyoid", description: "Anterolateral arytenoid cartilage and vocal fold region." },
    ],
    actions: [{ joint: "laryngeal-functional-complex", movement: "vocal-fold-tension", role: "secondary", contractionType: "concentric", description: "Adjusts vocal fold tension and contributes to phonation control." }],
    nerve: "vagus-nerve",
    innervationDescription: "Vagus nerve contribution through recurrent laryngeal branches.",
    structureTargets: ["thyroid-cartilage", "arytenoid-cartilage", "vocal-fold"],
  },
  {
    slug: "vocalis",
    name: "Vocalis",
    formalName: "Vocalis",
    alternateNames: ["vocalis muscle", "vocal fold muscle", "medial thyroarytenoid"],
    region: "anterior-neck",
    relativeDepth: "deep",
    depthNotes: "Deep intrinsic laryngeal muscle embedded in the vocal fold region.",
    category: "intrinsic laryngeal",
    functionalSummary: "It fine-tunes vocal fold tension as part of voice and laryngeal functional anatomy.",
    attachments: [
      { type: "origin", bone: "hyoid-bone", landmark: "body-of-hyoid", description: "Vocal process of arytenoid cartilage and adjacent vocal ligament region." },
      { type: "insertion", bone: "hyoid-bone", landmark: "body-of-hyoid", description: "Vocal ligament and thyroid cartilage region, stored with hyoid-laryngeal context." },
    ],
    actions: [{ joint: "laryngeal-functional-complex", movement: "vocal-fold-tension", role: "primary", contractionType: "concentric", description: "Fine-tunes tension in the vocal fold muscle complex." }],
    nerve: "vagus-nerve",
    innervationDescription: "Vagus nerve contribution through recurrent laryngeal branches.",
    structureTargets: ["vocal-fold", "arytenoid-cartilage", "thyroid-cartilage"],
  },
  {
    slug: "stylopharyngeus",
    name: "Stylopharyngeus",
    formalName: "Stylopharyngeus",
    alternateNames: ["stylopharyngeus muscle", "pharyngeal elevator"],
    region: "head-face-jaw",
    relativeDepth: "deep",
    depthNotes: "Deep pharyngeal muscle descending from the temporal styloid process.",
    category: "pharyngeal",
    functionalSummary: "It elevates the pharynx and larynx during swallowing mechanics.",
    attachments: [
      { type: "origin", bone: "temporal-bone", landmark: "styloid-process-temporal", description: "Medial aspect of the styloid process of the temporal bone." },
      { type: "insertion", bone: "hyoid-bone", landmark: "greater-horn-hyoid", description: "Pharyngeal wall and thyroid cartilage region with hyoid-laryngeal context." },
    ],
    actions: [{ joint: "pharyngeal-functional-complex", movement: "pharyngeal-elevation", role: "primary", contractionType: "concentric", description: "Elevates the pharynx during swallowing." }],
    nerve: "glossopharyngeal-nerve",
    innervationDescription: "Glossopharyngeal nerve motor supply to stylopharyngeus.",
    structureTargets: ["pharynx"],
  },
  {
    slug: "salpingopharyngeus",
    name: "Salpingopharyngeus",
    formalName: "Salpingopharyngeus",
    alternateNames: ["salpingopharyngeus muscle", "pharyngeal elevator"],
    region: "head-face-jaw",
    relativeDepth: "deep",
    depthNotes: "Deep pharyngeal muscle descending from the auditory tube cartilage region.",
    category: "pharyngeal",
    functionalSummary: "It elevates the pharyngeal wall and helps open the auditory tube during swallowing.",
    attachments: [
      { type: "origin", bone: "temporal-bone", landmark: "styloid-process-temporal", description: "Auditory tube cartilage region near the temporal bone." },
      { type: "insertion", bone: "hyoid-bone", landmark: "greater-horn-hyoid", description: "Blends into the pharyngeal wall and palatopharyngeus region." },
    ],
    actions: [{ joint: "pharyngeal-functional-complex", movement: "pharyngeal-elevation", role: "secondary", contractionType: "concentric", description: "Assists pharyngeal elevation and auditory tube opening." }],
    nerve: "vagus-nerve",
    innervationDescription: "Vagus nerve pharyngeal plexus contribution.",
    structureTargets: ["pharynx", "tympanic-membrane"],
  },
  {
    slug: "palatopharyngeus",
    name: "Palatopharyngeus",
    formalName: "Palatopharyngeus",
    alternateNames: ["palatopharyngeus muscle", "soft palate to pharynx muscle"],
    region: "head-face-jaw",
    relativeDepth: "deep",
    depthNotes: "Deep soft-palate and pharyngeal muscle in the palatopharyngeal arch.",
    category: "pharyngeal",
    functionalSummary: "It elevates the pharynx and helps narrow the pharyngeal isthmus.",
    attachments: [
      { type: "origin", bone: "palatine-bone", landmark: "horizontal-plate-palatine", description: "Palatine aponeurosis and hard palate region." },
      { type: "insertion", bone: "hyoid-bone", landmark: "greater-horn-hyoid", description: "Pharyngeal wall and thyroid cartilage region." },
    ],
    actions: [{ joint: "pharyngeal-functional-complex", movement: "pharyngeal-elevation", role: "secondary", contractionType: "concentric", description: "Assists pharyngeal elevation and palatal-pharyngeal narrowing." }],
    nerve: "vagus-nerve",
    innervationDescription: "Vagus nerve pharyngeal plexus contribution.",
    structureTargets: ["pharynx", "palatine-aponeurosis"],
  },
  {
    slug: "superior-pharyngeal-constrictor",
    name: "Superior Pharyngeal Constrictor",
    formalName: "Constrictor pharyngis superior",
    alternateNames: ["superior constrictor", "upper pharyngeal constrictor"],
    region: "head-face-jaw",
    relativeDepth: "deep",
    depthNotes: "Deep posterior pharyngeal wall muscle.",
    category: "pharyngeal constrictor",
    functionalSummary: "It narrows the upper pharyngeal wall as part of swallowing mechanics.",
    attachments: [
      { type: "origin", bone: "sphenoid-bone", landmark: "pterygoid-fossa", description: "Pterygoid hamulus, pterygomandibular raphe, and adjacent mandible region." },
      { type: "insertion", bone: "occipital-bone", landmark: "basilar-part-occipital-bone", description: "Median pharyngeal raphe and pharyngeal tubercle region." },
    ],
    actions: [{ joint: "pharyngeal-functional-complex", movement: "pharyngeal-constriction", role: "primary", contractionType: "concentric", description: "Constricts the upper pharyngeal wall." }],
    nerve: "vagus-nerve",
    innervationDescription: "Vagus nerve pharyngeal plexus contribution.",
    structureTargets: ["pharynx", "pterygomandibular-raphe"],
  },
  {
    slug: "middle-pharyngeal-constrictor",
    name: "Middle Pharyngeal Constrictor",
    formalName: "Constrictor pharyngis medius",
    alternateNames: ["middle constrictor", "middle pharyngeal constrictor muscle"],
    region: "head-face-jaw",
    relativeDepth: "deep",
    depthNotes: "Deep posterior pharyngeal wall muscle arising from hyoid-related structures.",
    category: "pharyngeal constrictor",
    functionalSummary: "It narrows the middle pharyngeal wall during swallowing mechanics.",
    attachments: [
      { type: "origin", bone: "hyoid-bone", landmark: "greater-horn-hyoid", description: "Greater and lesser horn region of the hyoid bone." },
      { type: "insertion", bone: "occipital-bone", landmark: "basilar-part-occipital-bone", description: "Median pharyngeal raphe region." },
    ],
    actions: [{ joint: "pharyngeal-functional-complex", movement: "pharyngeal-constriction", role: "primary", contractionType: "concentric", description: "Constricts the middle pharyngeal wall." }],
    nerve: "vagus-nerve",
    innervationDescription: "Vagus nerve pharyngeal plexus contribution.",
    structureTargets: ["pharynx"],
  },
  {
    slug: "inferior-pharyngeal-constrictor",
    name: "Inferior Pharyngeal Constrictor",
    formalName: "Constrictor pharyngis inferior",
    alternateNames: ["inferior constrictor", "lower pharyngeal constrictor"],
    region: "head-face-jaw",
    relativeDepth: "deep",
    depthNotes: "Deep lower pharyngeal wall muscle associated with thyroid and cricoid cartilage regions.",
    category: "pharyngeal constrictor",
    functionalSummary: "It narrows the lower pharyngeal wall and contributes to the pharyngoesophageal transition.",
    attachments: [
      { type: "origin", bone: "hyoid-bone", landmark: "body-of-hyoid", description: "Thyroid and cricoid cartilage regions, stored with hyoid-laryngeal context." },
      { type: "insertion", bone: "occipital-bone", landmark: "basilar-part-occipital-bone", description: "Median pharyngeal raphe region." },
    ],
    actions: [{ joint: "pharyngeal-functional-complex", movement: "pharyngeal-constriction", role: "primary", contractionType: "concentric", description: "Constricts the lower pharyngeal wall." }],
    nerve: "vagus-nerve",
    innervationDescription: "Vagus nerve pharyngeal plexus contribution, with recurrent laryngeal contribution to the lower portion.",
    structureTargets: ["pharynx", "cricoid-cartilage", "thyroid-cartilage"],
  },
  {
    slug: "tensor-veli-palatini",
    name: "Tensor Veli Palatini",
    formalName: "Tensor veli palatini",
    alternateNames: ["tensor veli palatini muscle", "soft palate tensor"],
    region: "head-face-jaw",
    relativeDepth: "deep",
    depthNotes: "Deep soft-palate muscle associated with the sphenoid and auditory tube region.",
    category: "soft palate",
    functionalSummary: "It tenses the soft palate and helps open the auditory tube.",
    attachments: [
      { type: "origin", bone: "sphenoid-bone", landmark: "lateral-pterygoid-plate", description: "Scaphoid fossa, sphenoid spine, and auditory tube cartilage region." },
      { type: "insertion", bone: "palatine-bone", landmark: "horizontal-plate-palatine", description: "Palatine aponeurosis after turning around the pterygoid hamulus." },
    ],
    actions: [{ joint: "soft-palate-functional-complex", movement: "soft-palate-tension", role: "primary", contractionType: "concentric", description: "Tenses the soft palate and palatine aponeurosis." }],
    nerve: "mandibular-division-trigeminal",
    innervationDescription: "Mandibular division of trigeminal nerve via the nerve to medial pterygoid region.",
    structureTargets: ["palatine-aponeurosis"],
  },
  {
    slug: "levator-veli-palatini",
    name: "Levator Veli Palatini",
    formalName: "Levator veli palatini",
    alternateNames: ["levator veli palatini muscle", "soft palate elevator"],
    region: "head-face-jaw",
    relativeDepth: "deep",
    depthNotes: "Deep soft-palate muscle descending from the temporal bone and auditory tube region.",
    category: "soft palate",
    functionalSummary: "It elevates the soft palate during swallowing and speech-related palatal closure.",
    attachments: [
      { type: "origin", bone: "temporal-bone", landmark: "atlas-cranial-bones-reference-region", description: "Petrous temporal bone and auditory tube cartilage region." },
      { type: "insertion", bone: "palatine-bone", landmark: "horizontal-plate-palatine", description: "Soft palate and palatine aponeurosis region." },
    ],
    actions: [{ joint: "soft-palate-functional-complex", movement: "soft-palate-elevation", role: "primary", contractionType: "concentric", description: "Elevates the soft palate." }],
    nerve: "vagus-nerve",
    innervationDescription: "Vagus nerve pharyngeal plexus contribution.",
    structureTargets: ["palatine-aponeurosis"],
  },
  {
    slug: "uvula-muscle",
    name: "Uvula Muscle",
    formalName: "Musculus uvulae",
    alternateNames: ["muscle of uvula", "musculus uvulae"],
    region: "head-face-jaw",
    relativeDepth: "deep",
    depthNotes: "Small deep soft-palate muscle near the midline uvular region.",
    category: "soft palate",
    functionalSummary: "It shortens and elevates the uvular portion of the soft palate.",
    attachments: [
      { type: "origin", bone: "palatine-bone", landmark: "posterior-nasal-septum", description: "Posterior nasal spine and palatine aponeurosis region." },
      { type: "insertion", bone: "palatine-bone", landmark: "horizontal-plate-palatine", description: "Mucosa and connective tissue of the uvula region." },
    ],
    actions: [{ joint: "soft-palate-functional-complex", movement: "soft-palate-elevation", role: "secondary", contractionType: "concentric", description: "Shortens and elevates the uvular part of the soft palate." }],
    nerve: "vagus-nerve",
    innervationDescription: "Vagus nerve pharyngeal plexus contribution.",
    structureTargets: ["palatine-aponeurosis"],
  },
  {
    slug: "iliocostalis-cervicis",
    name: "Iliocostalis Cervicis",
    formalName: "Iliocostalis cervicis",
    alternateNames: ["cervical iliocostalis", "erector spinae cervical subdivision"],
    region: "neck",
    relativeDepth: "deep",
    depthNotes: "Deep longitudinal extensor in the erector spinae column.",
    category: "intrinsic back",
    functionalSummary: "It extends and laterally flexes the cervical spine as part of the erector spinae system.",
    attachments: [
      { type: "origin", bone: "ribs", landmark: "rib-angles", description: "Angles of upper ribs in the upper thoracic region." },
      { type: "insertion", bone: "cervical-vertebrae", landmark: "cervical-transverse-processes", description: "Transverse processes of middle cervical vertebrae." },
    ],
    actions: [{ joint: "cervical-spine", movement: "cervical-extension", role: "secondary", contractionType: "concentric", description: "Assists cervical extension and lateral flexion." }],
    nerve: "posterior-rami-spinal-nerves",
    innervationDescription: "Posterior rami of spinal nerves supply intrinsic back subdivisions.",
    structureTargets: ["erector-spinae-column"],
  },
  {
    slug: "iliocostalis-thoracis",
    name: "Iliocostalis Thoracis",
    formalName: "Iliocostalis thoracis",
    alternateNames: ["thoracic iliocostalis", "erector spinae thoracic subdivision"],
    region: "upper-back",
    relativeDepth: "deep",
    depthNotes: "Deep longitudinal extensor in the thoracic erector spinae column.",
    category: "intrinsic back",
    functionalSummary: "It extends and laterally flexes the thoracic spine and helps control rib-cage posture.",
    attachments: [
      { type: "origin", bone: "ribs", landmark: "lower-ribs", description: "Angles of lower ribs and thoracolumbar erector spinae region." },
      { type: "insertion", bone: "ribs", landmark: "rib-angles", description: "Angles of upper ribs." },
    ],
    actions: [{ joint: "thoracic-spine", movement: "thoracic-extension", role: "secondary", contractionType: "concentric", description: "Assists thoracic extension and lateral flexion." }],
    nerve: "posterior-rami-spinal-nerves",
    innervationDescription: "Posterior rami of spinal nerves supply intrinsic back subdivisions.",
    structureTargets: ["erector-spinae-column"],
  },
  {
    slug: "iliocostalis-lumborum",
    name: "Iliocostalis Lumborum",
    formalName: "Iliocostalis lumborum",
    alternateNames: ["lumbar iliocostalis", "erector spinae lumbar subdivision"],
    region: "lumbar-region",
    relativeDepth: "deep",
    depthNotes: "Deep longitudinal extensor in the lumbar erector spinae column.",
    category: "intrinsic back",
    functionalSummary: "It extends and laterally flexes the lumbar spine and links pelvis, lumbar fascia, and lower ribs.",
    attachments: [
      { type: "origin", bone: "pelvis", landmark: "iliac-crest", description: "Iliac crest, sacrum, and thoracolumbar fascia region." },
      { type: "insertion", bone: "ribs", landmark: "lower-ribs", description: "Angles of lower ribs and upper lumbar transverse process region." },
    ],
    actions: [{ joint: "lumbar-spine", movement: "lumbar-extension", role: "secondary", contractionType: "concentric", description: "Assists lumbar extension and lateral flexion." }],
    nerve: "posterior-rami-spinal-nerves",
    innervationDescription: "Posterior rami of spinal nerves supply intrinsic back subdivisions.",
    structureTargets: ["erector-spinae-column", "thoracolumbar-fascia"],
  },
  {
    slug: "longissimus-capitis",
    name: "Longissimus Capitis",
    formalName: "Longissimus capitis",
    alternateNames: ["longissimus capitis muscle", "head longissimus"],
    region: "posterior-neck",
    relativeDepth: "deep",
    depthNotes: "Deep intrinsic back muscle running toward the mastoid region.",
    category: "intrinsic back",
    functionalSummary: "It extends, rotates, and laterally flexes the head and upper cervical region.",
    attachments: [
      { type: "origin", bone: "cervical-vertebrae", landmark: "cervical-transverse-processes", description: "Transverse processes of lower cervical and upper thoracic vertebrae." },
      { type: "insertion", bone: "temporal-bone", landmark: "mastoid-process", description: "Mastoid process region of the temporal bone." },
    ],
    actions: [{ joint: "cervical-spine", movement: "cervical-extension", role: "secondary", contractionType: "concentric", description: "Assists head and cervical extension." }],
    nerve: "posterior-rami-spinal-nerves",
    innervationDescription: "Posterior rami of spinal nerves supply intrinsic back subdivisions.",
    structureTargets: ["erector-spinae-column"],
  },
  {
    slug: "longissimus-cervicis",
    name: "Longissimus Cervicis",
    formalName: "Longissimus cervicis",
    alternateNames: ["longissimus cervicis muscle", "cervical longissimus"],
    region: "neck",
    relativeDepth: "deep",
    depthNotes: "Deep intrinsic back muscle in the cervical erector spinae column.",
    category: "intrinsic back",
    functionalSummary: "It assists cervical extension and lateral flexion.",
    attachments: [
      { type: "origin", bone: "thoracic-vertebrae", landmark: "thoracic-transverse-processes", description: "Upper thoracic transverse process region." },
      { type: "insertion", bone: "cervical-vertebrae", landmark: "cervical-transverse-processes", description: "Cervical transverse process region." },
    ],
    actions: [{ joint: "cervical-spine", movement: "cervical-extension", role: "secondary", contractionType: "concentric", description: "Assists cervical extension and lateral flexion." }],
    nerve: "posterior-rami-spinal-nerves",
    innervationDescription: "Posterior rami of spinal nerves supply intrinsic back subdivisions.",
    structureTargets: ["erector-spinae-column"],
  },
  {
    slug: "longissimus-thoracis",
    name: "Longissimus Thoracis",
    formalName: "Longissimus thoracis",
    alternateNames: ["longissimus thoracis muscle", "thoracic longissimus"],
    region: "upper-back",
    relativeDepth: "deep",
    depthNotes: "Deep intrinsic back muscle forming the central erector spinae column.",
    category: "intrinsic back",
    functionalSummary: "It extends and laterally flexes the thoracic and lumbar spine.",
    attachments: [
      { type: "origin", bone: "pelvis", landmark: "iliac-crest", description: "Sacrum, iliac crest, and lumbar spinous process region." },
      { type: "insertion", bone: "thoracic-vertebrae", landmark: "thoracic-transverse-processes", description: "Thoracic transverse processes and adjacent ribs." },
    ],
    actions: [{ joint: "thoracic-spine", movement: "thoracic-extension", role: "primary", contractionType: "concentric", description: "Extends the thoracic spine." }],
    nerve: "posterior-rami-spinal-nerves",
    innervationDescription: "Posterior rami of spinal nerves supply intrinsic back subdivisions.",
    structureTargets: ["erector-spinae-column", "thoracolumbar-fascia"],
  },
  {
    slug: "spinalis-capitis",
    name: "Spinalis Capitis",
    formalName: "Spinalis capitis",
    alternateNames: ["spinalis capitis muscle", "head spinalis"],
    region: "posterior-neck",
    relativeDepth: "deep",
    depthNotes: "Deep medial intrinsic back muscle with variable distinction from semispinalis capitis.",
    category: "intrinsic back",
    functionalSummary: "It assists extension of the head and upper cervical region.",
    attachments: [
      { type: "origin", bone: "cervical-vertebrae", landmark: "cervical-spinous-processes", description: "Lower cervical and upper thoracic spinous process region." },
      { type: "insertion", bone: "occipital-bone", landmark: "inferior-nuchal-line", description: "Occipital bone between nuchal line regions." },
    ],
    actions: [{ joint: "cervical-spine", movement: "cervical-extension", role: "secondary", contractionType: "concentric", description: "Assists head and cervical extension." }],
    nerve: "posterior-rami-spinal-nerves",
    innervationDescription: "Posterior rami of spinal nerves supply intrinsic back subdivisions.",
    structureTargets: ["erector-spinae-column"],
  },
  {
    slug: "spinalis-cervicis",
    name: "Spinalis Cervicis",
    formalName: "Spinalis cervicis",
    alternateNames: ["spinalis cervicis muscle", "cervical spinalis"],
    region: "posterior-neck",
    relativeDepth: "deep",
    depthNotes: "Deep medial intrinsic back muscle between cervical spinous processes.",
    category: "intrinsic back",
    functionalSummary: "It assists cervical extension and postural control through short medial fibers.",
    attachments: [
      { type: "origin", bone: "cervical-vertebrae", landmark: "cervical-spinous-processes", description: "Lower cervical and upper thoracic spinous process region." },
      { type: "insertion", bone: "cervical-vertebrae", landmark: "cervical-spinous-processes", description: "Upper cervical spinous process region." },
    ],
    actions: [{ joint: "cervical-spine", movement: "cervical-extension", role: "stabilizer", contractionType: "isometric", description: "Assists segmental cervical extension control." }],
    nerve: "posterior-rami-spinal-nerves",
    innervationDescription: "Posterior rami of spinal nerves supply intrinsic back subdivisions.",
    structureTargets: ["erector-spinae-column"],
  },
  {
    slug: "spinalis-thoracis",
    name: "Spinalis Thoracis",
    formalName: "Spinalis thoracis",
    alternateNames: ["spinalis thoracis muscle", "thoracic spinalis"],
    region: "upper-back",
    relativeDepth: "deep",
    depthNotes: "Deep medial thoracic intrinsic back muscle.",
    category: "intrinsic back",
    functionalSummary: "It assists thoracic extension and segmental postural control.",
    attachments: [
      { type: "origin", bone: "thoracic-vertebrae", landmark: "lower-thoracic-spinous-processes", description: "Lower thoracic and upper lumbar spinous process region." },
      { type: "insertion", bone: "thoracic-vertebrae", landmark: "upper-thoracic-spinous-processes", description: "Upper thoracic spinous process region." },
    ],
    actions: [{ joint: "thoracic-spine", movement: "thoracic-extension", role: "stabilizer", contractionType: "isometric", description: "Assists segmental thoracic extension control." }],
    nerve: "posterior-rami-spinal-nerves",
    innervationDescription: "Posterior rami of spinal nerves supply intrinsic back subdivisions.",
    structureTargets: ["erector-spinae-column"],
  },
  {
    slug: "rotatores",
    name: "Rotatores",
    formalName: "Rotatores",
    alternateNames: ["rotatores muscles", "deep transversospinalis rotators"],
    region: "back",
    relativeDepth: "deep",
    depthNotes: "Small deep transversospinalis muscles spanning adjacent vertebrae.",
    category: "intrinsic back",
    functionalSummary: "They assist proprioceptive segmental control and small rotation/extension actions of the spine.",
    attachments: [
      { type: "origin", bone: "thoracic-vertebrae", landmark: "thoracic-transverse-processes", description: "Transverse processes, especially prominent in the thoracic region." },
      { type: "insertion", bone: "thoracic-vertebrae", landmark: "upper-thoracic-spinous-processes", description: "Lamina and spinous process region of vertebrae above." },
    ],
    actions: [{ joint: "thoracic-spine", movement: "thoracic-rotation", role: "stabilizer", contractionType: "isometric", description: "Supports segmental rotation control and proprioception." }],
    nerve: "posterior-rami-spinal-nerves",
    innervationDescription: "Posterior rami of spinal nerves supply intrinsic back subdivisions.",
    structureTargets: ["erector-spinae-column"],
  },
  {
    slug: "interspinales",
    name: "Interspinales",
    formalName: "Interspinales",
    alternateNames: ["interspinales muscles", "segmental spinal extensors"],
    region: "back",
    relativeDepth: "deep",
    depthNotes: "Short deep muscles between adjacent spinous processes.",
    category: "intrinsic back",
    functionalSummary: "They assist segmental extension and postural control between adjacent vertebrae.",
    attachments: [
      { type: "origin", bone: "cervical-vertebrae", landmark: "cervical-spinous-processes", description: "Spinous process region of one vertebra." },
      { type: "insertion", bone: "cervical-vertebrae", landmark: "cervical-spinous-processes", description: "Spinous process region of adjacent vertebra." },
    ],
    actions: [{ joint: "cervical-spine", movement: "cervical-extension", role: "stabilizer", contractionType: "isometric", description: "Supports segmental extension control." }],
    nerve: "posterior-rami-spinal-nerves",
    innervationDescription: "Posterior rami of spinal nerves supply intrinsic back subdivisions.",
    structureTargets: ["erector-spinae-column"],
  },
  {
    slug: "intertransversarii",
    name: "Intertransversarii",
    formalName: "Intertransversarii",
    alternateNames: ["intertransversarii muscles", "segmental lateral flexors"],
    region: "back",
    relativeDepth: "deep",
    depthNotes: "Short deep muscles between adjacent transverse processes.",
    category: "intrinsic back",
    functionalSummary: "They assist small lateral flexion and segmental postural control between adjacent vertebrae.",
    attachments: [
      { type: "origin", bone: "cervical-vertebrae", landmark: "cervical-transverse-processes", description: "Transverse process region of one vertebra." },
      { type: "insertion", bone: "cervical-vertebrae", landmark: "cervical-transverse-processes", description: "Transverse process region of adjacent vertebra." },
    ],
    actions: [{ joint: "cervical-spine", movement: "cervical-lateral-flexion", role: "stabilizer", contractionType: "isometric", description: "Supports segmental lateral flexion control." }],
    nerve: "posterior-rami-spinal-nerves",
    innervationDescription: "Posterior rami of spinal nerves supply intrinsic back subdivisions.",
    structureTargets: ["erector-spinae-column"],
  },
  {
    slug: "levator-ani-pubococcygeus",
    name: "Levator Ani, Pubococcygeus",
    formalName: "Pubococcygeus",
    alternateNames: ["pubococcygeus muscle", "PC muscle"],
    region: "pelvis",
    relativeDepth: "deep",
    depthNotes: "Deep pelvic floor subdivision of levator ani.",
    category: "pelvic floor",
    functionalSummary: "It supports pelvic viscera and contributes to pelvic floor closure and postural pressure management.",
    attachments: [
      { type: "origin", bone: "pubis", landmark: "pubic-body", description: "Posterior pubic body and adjacent obturator fascia region." },
      { type: "insertion", bone: "coccyx", landmark: "coccygeal-apex", description: "Anococcygeal body, coccyx, and pelvic floor raphe region." },
    ],
    actions: [{ joint: "pelvic-floor-functional-complex", movement: "pelvic-floor-support", role: "primary", contractionType: "isometric", description: "Supports pelvic floor closure and lift." }],
    nerve: "nerve-to-levator-ani",
    innervationDescription: "Nerve to levator ani with pudendal-region contributions.",
    structureTargets: ["pelvic-diaphragm"],
  },
  {
    slug: "levator-ani-puborectalis",
    name: "Levator Ani, Puborectalis",
    formalName: "Puborectalis",
    alternateNames: ["puborectalis muscle", "anorectal sling"],
    region: "pelvis",
    relativeDepth: "deep",
    depthNotes: "Deep pelvic floor subdivision forming a sling around the anorectal junction.",
    category: "pelvic floor",
    functionalSummary: "It forms a sling around the anorectal junction and contributes to continence-related pelvic floor support.",
    attachments: [
      { type: "origin", bone: "pubis", landmark: "pubic-body", description: "Posterior pubic body near the pubic symphysis." },
      { type: "insertion", bone: "pubis", landmark: "pubic-body", description: "Loops around the anorectal junction and returns toward the contralateral pubic region." },
    ],
    actions: [{ joint: "pelvic-floor-functional-complex", movement: "pelvic-floor-support", role: "primary", contractionType: "isometric", description: "Supports the anorectal angle and pelvic floor closure." }],
    nerve: "nerve-to-levator-ani",
    innervationDescription: "Nerve to levator ani with pudendal-region contributions.",
    structureTargets: ["pelvic-diaphragm", "anus"],
  },
  {
    slug: "levator-ani-iliococcygeus",
    name: "Levator Ani, Iliococcygeus",
    formalName: "Iliococcygeus",
    alternateNames: ["iliococcygeus muscle", "lateral levator ani"],
    region: "pelvis",
    relativeDepth: "deep",
    depthNotes: "Deep lateral pelvic floor subdivision of levator ani.",
    category: "pelvic floor",
    functionalSummary: "It provides broad pelvic floor support from the tendinous arch region toward the coccyx.",
    attachments: [
      { type: "origin", bone: "ischium", landmark: "ischial-spine", description: "Ischial spine and tendinous arch of pelvic fascia region." },
      { type: "insertion", bone: "coccyx", landmark: "coccygeal-apex", description: "Coccyx and anococcygeal body region." },
    ],
    actions: [{ joint: "pelvic-floor-functional-complex", movement: "pelvic-floor-support", role: "primary", contractionType: "isometric", description: "Supports pelvic viscera and pelvic floor posture." }],
    nerve: "nerve-to-levator-ani",
    innervationDescription: "Nerve to levator ani with pudendal-region contributions.",
    structureTargets: ["pelvic-diaphragm"],
  },
]

const HAND_INTEROSSEI = [
  ["dorsal-interosseous-hand-1", "First Dorsal Interosseous", "Interosseus dorsalis primus manus", "first dorsal interosseous", "finger-abduction"],
  ["dorsal-interosseous-hand-2", "Second Dorsal Interosseous", "Interosseus dorsalis secundus manus", "second dorsal interosseous", "finger-abduction"],
  ["dorsal-interosseous-hand-3", "Third Dorsal Interosseous", "Interosseus dorsalis tertius manus", "third dorsal interosseous", "finger-abduction"],
  ["dorsal-interosseous-hand-4", "Fourth Dorsal Interosseous", "Interosseus dorsalis quartus manus", "fourth dorsal interosseous", "finger-abduction"],
  ["palmar-interosseous-hand-1", "First Palmar Interosseous", "Interosseus palmaris primus manus", "first palmar interosseous", "finger-adduction"],
  ["palmar-interosseous-hand-2", "Second Palmar Interosseous", "Interosseus palmaris secundus manus", "second palmar interosseous", "finger-adduction"],
  ["palmar-interosseous-hand-3", "Third Palmar Interosseous", "Interosseus palmaris tertius manus", "third palmar interosseous", "finger-adduction"],
] as const

const HAND_LUMBRICALS = [
  ["lumbrical-hand-1", "First Hand Lumbrical", "Lumbricalis primus manus", "first hand lumbrical", "median-nerve"],
  ["lumbrical-hand-2", "Second Hand Lumbrical", "Lumbricalis secundus manus", "second hand lumbrical", "median-nerve"],
  ["lumbrical-hand-3", "Third Hand Lumbrical", "Lumbricalis tertius manus", "third hand lumbrical", "deep-branch-ulnar-nerve"],
  ["lumbrical-hand-4", "Fourth Hand Lumbrical", "Lumbricalis quartus manus", "fourth hand lumbrical", "deep-branch-ulnar-nerve"],
] as const

const FOOT_INTEROSSEI = [
  ["dorsal-interosseous-foot-1", "First Dorsal Interosseous of Foot", "Interosseus dorsalis primus pedis", "first dorsal foot interosseous", "toe-abduction"],
  ["dorsal-interosseous-foot-2", "Second Dorsal Interosseous of Foot", "Interosseus dorsalis secundus pedis", "second dorsal foot interosseous", "toe-abduction"],
  ["dorsal-interosseous-foot-3", "Third Dorsal Interosseous of Foot", "Interosseus dorsalis tertius pedis", "third dorsal foot interosseous", "toe-abduction"],
  ["dorsal-interosseous-foot-4", "Fourth Dorsal Interosseous of Foot", "Interosseus dorsalis quartus pedis", "fourth dorsal foot interosseous", "toe-abduction"],
  ["plantar-interosseous-foot-1", "First Plantar Interosseous", "Interosseus plantaris primus", "first plantar interosseous", "toe-adduction"],
  ["plantar-interosseous-foot-2", "Second Plantar Interosseous", "Interosseus plantaris secundus", "second plantar interosseous", "toe-adduction"],
  ["plantar-interosseous-foot-3", "Third Plantar Interosseous", "Interosseus plantaris tertius", "third plantar interosseous", "toe-adduction"],
] as const

const FOOT_LUMBRICALS = [
  ["lumbrical-foot-1", "First Foot Lumbrical", "Lumbricalis primus pedis", "first foot lumbrical", "medial-plantar-nerve"],
  ["lumbrical-foot-2", "Second Foot Lumbrical", "Lumbricalis secundus pedis", "second foot lumbrical", "lateral-plantar-nerve"],
  ["lumbrical-foot-3", "Third Foot Lumbrical", "Lumbricalis tertius pedis", "third foot lumbrical", "lateral-plantar-nerve"],
  ["lumbrical-foot-4", "Fourth Foot Lumbrical", "Lumbricalis quartus pedis", "fourth foot lumbrical", "lateral-plantar-nerve"],
] as const

const INTRINSIC_MUSCLE_SPECS: MuscleSpec[] = [
  ...HAND_INTEROSSEI.map(([slug, name, formalName, ordinalTerm, movement]) => ({
    slug,
    name,
    formalName,
    alternateNames: [ordinalTerm, "hand interosseous muscle", movement === "finger-abduction" ? "dorsal interosseous muscle" : "palmar interosseous muscle"],
    region: "hand",
    relativeDepth: "deep",
    depthNotes: "Deep intrinsic hand muscle between metacarpals.",
    category: "intrinsic hand",
    functionalSummary: movement === "finger-abduction"
      ? "It abducts a finger at the metacarpophalangeal joints and assists intrinsic hand control."
      : "It adducts a finger toward the hand axis and assists intrinsic hand control.",
    attachments: [
      { type: "origin", bone: "metacarpals", landmark: "metacarpal-bases", description: "Adjacent metacarpal shafts and bases in the deep palm." },
      { type: "insertion", bone: "hand-phalanges", landmark: "atlas-proximal-phalanx-index-finger-base", description: "Proximal phalanx base and dorsal extensor expansion of the associated finger." },
    ],
    actions: [{ joint: "metacarpophalangeal-joints", movement, role: "primary", contractionType: "concentric", description: `${name} contributes to ${movement.replace(/-/g, " ")} at the metacarpophalangeal joints.` }],
    nerve: "deep-branch-ulnar-nerve",
    innervationDescription: "Deep branch of the ulnar nerve supplies most palmar and dorsal interossei.",
    structureTargets: ["dorsal-extensor-expansion"],
  } satisfies MuscleSpec)),
  ...HAND_LUMBRICALS.map(([slug, name, formalName, ordinalTerm, nerve]) => ({
    slug,
    name,
    formalName,
    alternateNames: [ordinalTerm, "hand lumbrical", "lumbrical muscle of hand"],
    region: "hand",
    relativeDepth: "deep",
    depthNotes: "Deep intrinsic hand muscle associated with flexor tendons and extensor expansions.",
    category: "intrinsic hand",
    functionalSummary: "It flexes the metacarpophalangeal joint while assisting extension of the interphalangeal joints through the extensor expansion.",
    attachments: [
      { type: "origin", bone: "hand-phalanges", landmark: "atlas-proximal-phalanx-index-finger-base", description: "Flexor digitorum profundus tendon slip for the associated digit." },
      { type: "insertion", bone: "hand-phalanges", landmark: "atlas-proximal-phalanx-index-finger-base", description: "Radial side of the dorsal extensor expansion for the associated digit." },
    ],
    actions: [{ joint: "metacarpophalangeal-joints", movement: "finger-flexion", role: "secondary", contractionType: "concentric", description: `${name} assists MCP flexion while coordinating IP extension through the extensor expansion.` }],
    nerve,
    innervationDescription: nerve === "median-nerve" ? "Median nerve contribution to the lateral hand lumbricals." : "Deep branch of the ulnar nerve contribution to the medial hand lumbricals.",
    structureTargets: ["dorsal-extensor-expansion"],
  } satisfies MuscleSpec)),
  ...FOOT_INTEROSSEI.map(([slug, name, formalName, ordinalTerm, movement]) => ({
    slug,
    name,
    formalName,
    alternateNames: [ordinalTerm, "foot interosseous muscle", movement === "toe-abduction" ? "dorsal foot interosseous" : "plantar interosseous"],
    region: "foot",
    relativeDepth: "deep",
    depthNotes: "Deep intrinsic foot muscle between metatarsals.",
    category: "intrinsic foot",
    functionalSummary: movement === "toe-abduction"
      ? "It abducts toes around the second-toe axis and supports metatarsophalangeal control."
      : "It adducts toes toward the second-toe axis and supports metatarsophalangeal control.",
    attachments: [
      { type: "origin", bone: "metatarsals", landmark: "metatarsal-heads", description: "Adjacent metatarsal shafts in the deep plantar foot." },
      { type: "insertion", bone: "foot-phalanges", landmark: "lesser-toe-phalanges", description: "Proximal phalanx base and extensor expansion of the associated toe." },
    ],
    actions: [{ joint: "metatarsophalangeal-joints", movement, role: "primary", contractionType: "concentric", description: `${name} contributes to ${movement.replace(/-/g, " ")} at the metatarsophalangeal joints.` }],
    nerve: "lateral-plantar-nerve",
    innervationDescription: "Lateral plantar nerve supplies most dorsal and plantar interossei of the foot.",
    structureTargets: ["plantar-extensor-expansions"],
  } satisfies MuscleSpec)),
  ...FOOT_LUMBRICALS.map(([slug, name, formalName, ordinalTerm, nerve]) => ({
    slug,
    name,
    formalName,
    alternateNames: [ordinalTerm, "foot lumbrical", "lumbrical muscle of foot"],
    region: "foot",
    relativeDepth: "deep",
    depthNotes: "Deep intrinsic foot muscle associated with flexor tendons and toe extensor expansions.",
    category: "intrinsic foot",
    functionalSummary: "It assists metatarsophalangeal flexion and interphalangeal extension of the lesser toes.",
    attachments: [
      { type: "origin", bone: "foot-phalanges", landmark: "lesser-toe-phalanges", description: "Flexor digitorum longus tendon slip for the associated toe." },
      { type: "insertion", bone: "foot-phalanges", landmark: "lesser-toe-phalanges", description: "Medial side of the toe extensor expansion and proximal phalanx region." },
    ],
    actions: [{ joint: "metatarsophalangeal-joints", movement: "toe-flexion", role: "secondary", contractionType: "concentric", description: `${name} assists MTP flexion while coordinating IP extension through the extensor expansion.` }],
    nerve,
    innervationDescription: nerve === "medial-plantar-nerve" ? "Medial plantar nerve contribution to the first foot lumbrical." : "Lateral plantar nerve contribution to the lateral foot lumbricals.",
    structureTargets: ["plantar-extensor-expansions"],
  } satisfies MuscleSpec)),
]

const ALL_MUSCLE_SPECS = [...MUSCLE_SPECS, ...INTRINSIC_MUSCLE_SPECS]

const MUSCLES: MuscleRow[] = ALL_MUSCLE_SPECS.map((spec) => ({
  id: `muscle-${spec.slug}`,
  slug: spec.slug,
  name: spec.name,
  formalName: spec.formalName,
  alternateNames: spec.alternateNames,
  description: `${spec.name} is a ${spec.category} muscle in the ${spec.region.replace(/-/g, " ")} region. ${spec.functionalSummary} This MassageLab-authored row is structured for searchable anatomy, education, SOAP tagging, flashcards, game prompts, and related-structure browsing.`,
  region: spec.region,
  relativeDepth: spec.relativeDepth,
  depthNotes: spec.depthNotes,
  sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
}))

const MUSCLE_ATTACHMENTS: MuscleAttachmentRow[] = ALL_MUSCLE_SPECS.flatMap((spec) => spec.attachments.map((attachment, index) => ({
  id: `attach-${spec.slug}-${attachment.type}-${index + 1}`,
  muscle: spec.slug,
  type: attachment.type,
  bone: attachment.bone,
  landmark: attachment.landmark,
  description: attachment.description,
  sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
})))

const MUSCLE_ACTIONS: MuscleActionRow[] = ALL_MUSCLE_SPECS.flatMap((spec) => spec.actions.map((action, index) => ({
  id: `action-${spec.slug}-${action.movement}-${index + 1}`,
  muscle: spec.slug,
  joint: action.joint,
  movement: action.movement,
  role: action.role ?? "primary",
  contractionType: action.contractionType ?? "concentric",
  description: action.description,
  sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
})))

const MUSCLE_INNERVATIONS: MuscleInnervationRow[] = ALL_MUSCLE_SPECS.map((spec) => ({
  id: `innervation-${spec.slug}-${spec.nerve}`,
  muscle: spec.slug,
  nerve: spec.nerve,
  description: spec.innervationDescription,
  sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
}))

const MUSCLE_TERMS = ALL_MUSCLE_SPECS.flatMap((spec) => entityTerms("muscle", spec.slug, spec.name, spec.formalName, spec.alternateNames))
const MUSCLE_IDENTIFIERS = ALL_MUSCLE_SPECS.map((spec) => fipatIdentifier("muscle", spec.slug, spec.formalName))
const MUSCLE_RELATIONSHIPS: RelationshipRow[] = ALL_MUSCLE_SPECS.flatMap((spec) => (spec.structureTargets ?? []).map((targetSlug) => ({
  id: `relationship-${spec.slug}-associated-with-${targetSlug}`,
  sourceEntityType: "muscle",
  sourceEntitySlug: spec.slug,
  relationshipType: "associated_with",
  targetEntityType: "anatomy_structure",
  targetEntitySlug: targetSlug,
  details: {
    clinicalUse: "non-diagnostic",
    note: "Soft-tissue or functional attachment context for related-structure browsing.",
  },
  sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
})))

const MUSCLE_CITATIONS: CitationRow[] = ALL_MUSCLE_SPECS.flatMap((spec) => {
  const origin = MUSCLE_ATTACHMENTS.find((attachment) => attachment.muscle === spec.slug && attachment.type === "origin")
  const insertion = MUSCLE_ATTACHMENTS.find((attachment) => attachment.muscle === spec.slug && attachment.type === "insertion")
  const action = MUSCLE_ACTIONS.find((entry) => entry.muscle === spec.slug)
  const innervation = MUSCLE_INNERVATIONS.find((entry) => entry.muscle === spec.slug)

  return [
    ...rowCitations("muscle", spec.slug, spec.formalName, APPLIED_HUMAN_ANATOMY_SOURCE),
    reviewedCitation("muscle", spec.slug, "origin", origin?.id, APPLIED_HUMAN_ANATOMY_SOURCE, APPLIED_HUMAN_ANATOMY_LOCATOR, "Origin fact reviewed against commercial-safe applied anatomy references."),
    reviewedCitation("muscle", spec.slug, "insertion", insertion?.id, APPLIED_HUMAN_ANATOMY_SOURCE, APPLIED_HUMAN_ANATOMY_LOCATOR, "Insertion fact reviewed against commercial-safe applied anatomy references."),
    reviewedCitation("muscle", spec.slug, "action", action?.id, APPLIED_HUMAN_ANATOMY_SOURCE, APPLIED_HUMAN_ANATOMY_LOCATOR, "Action fact reviewed against commercial-safe applied anatomy references."),
    reviewedCitation("muscle", spec.slug, "innervation", innervation?.id, APPLIED_HUMAN_ANATOMY_SOURCE, APPLIED_HUMAN_ANATOMY_LOCATOR, "Innervation fact reviewed against commercial-safe applied anatomy references."),
  ]
})

const LIGAMENT_SPECS: LigamentSpec[] = [
  { slug: "anterior-longitudinal-ligament", name: "Anterior Longitudinal Ligament", formalName: "Ligamentum longitudinale anterius", alternateNames: ["ALL", "anterior spinal ligament"], region: "back", joint: "lumbar-spine", description: "Broad ligament along the anterior vertebral bodies and intervertebral discs that helps limit excessive spinal extension.", relationshipType: "limits_extension_of", targetEntityType: "joint", targetEntitySlug: "lumbar-spine" },
  { slug: "posterior-longitudinal-ligament", name: "Posterior Longitudinal Ligament", formalName: "Ligamentum longitudinale posterius", alternateNames: ["PLL", "posterior spinal ligament"], region: "back", joint: "lumbar-spine", description: "Ligament along the posterior vertebral bodies inside the vertebral canal that helps limit excessive spinal flexion.", relationshipType: "limits_flexion_of", targetEntityType: "joint", targetEntitySlug: "lumbar-spine" },
  { slug: "ligamentum-flavum", name: "Ligamentum Flavum", formalName: "Ligamenta flava", alternateNames: ["yellow ligament", "flaval ligament"], region: "back", joint: "lumbar-spine", description: "Elastic paired ligaments connecting adjacent laminae and helping preserve spinal canal posture during movement.", relationshipType: "connects", targetEntityType: "bone", targetEntitySlug: "lumbar-vertebrae" },
  { slug: "interspinous-ligament", name: "Interspinous Ligament", formalName: "Ligamenta interspinalia", alternateNames: ["interspinous ligaments", "between spinous processes"], region: "back", joint: "lumbar-spine", description: "Ligaments spanning adjacent spinous processes and contributing to posterior spinal restraint during flexion.", relationshipType: "connects", targetEntityType: "bone_landmark", targetEntitySlug: "lumbar-spinous-processes" },
  { slug: "supraspinous-ligament", name: "Supraspinous Ligament", formalName: "Ligamentum supraspinale", alternateNames: ["supraspinal ligament", "posterior midline spinal ligament"], region: "back", joint: "thoracic-spine", description: "Posterior midline ligament linking spinous process tips and continuing superiorly with the nuchal ligament region.", relationshipType: "connects", targetEntityType: "bone_landmark", targetEntitySlug: "upper-thoracic-spinous-processes" },
  { slug: "sacrospinous-ligament", name: "Sacrospinous Ligament", formalName: "Ligamentum sacrospinale", alternateNames: ["sacrospinous ligament"], region: "pelvis", joint: "sacroiliac", description: "Pelvic ligament from sacrum/coccyx to ischial spine that helps form the sciatic foramina boundaries.", relationshipType: "connects", targetEntityType: "bone_landmark", targetEntitySlug: "ischial-spine" },
  { slug: "sacrotuberous-ligament", name: "Sacrotuberous Ligament", formalName: "Ligamentum sacrotuberale", alternateNames: ["sacrotuberous ligament"], region: "pelvis", joint: "sacroiliac", description: "Strong posterior pelvic ligament connecting sacrum and coccyx to the ischial tuberosity region.", relationshipType: "connects", targetEntityType: "bone_landmark", targetEntitySlug: "ischial-tuberosity" },
  { slug: "inguinal-ligament", name: "Inguinal Ligament", formalName: "Ligamentum inguinale", alternateNames: ["Poupart ligament", "groin ligament"], region: "pelvis", joint: "hip-joint", description: "Folded inferior edge of the external oblique aponeurosis spanning ASIS to pubic tubercle in the anterior groin.", relationshipType: "connects", targetEntityType: "bone_landmark", targetEntitySlug: "pubic-tubercle" },
  { slug: "annular-ligament-radius", name: "Annular Ligament of Radius", formalName: "Ligamentum anulare radii", alternateNames: ["annular ligament", "radial head ring ligament"], region: "elbow", joint: "proximal-radioulnar-joint", description: "Ring-like ligament retaining the radial head against the ulna during pronation and supination.", relationshipType: "surrounds", targetEntityType: "bone", targetEntitySlug: "radius" },
  { slug: "ulnar-collateral-ligament-elbow", name: "Ulnar Collateral Ligament of Elbow", formalName: "Ligamentum collaterale ulnare articulationis cubiti", alternateNames: ["elbow UCL", "medial collateral ligament of elbow"], region: "elbow", joint: "elbow-joint", description: "Medial elbow ligament complex connecting humerus and ulna and resisting valgus stress.", relationshipType: "stabilizes", targetEntityType: "joint", targetEntitySlug: "elbow-joint" },
  { slug: "radial-collateral-ligament-elbow", name: "Radial Collateral Ligament of Elbow", formalName: "Ligamentum collaterale radiale articulationis cubiti", alternateNames: ["elbow RCL", "lateral collateral ligament of elbow"], region: "elbow", joint: "elbow-joint", description: "Lateral elbow ligament complex supporting the humeroradial and proximal radioulnar region.", relationshipType: "stabilizes", targetEntityType: "joint", targetEntitySlug: "elbow-joint" },
  { slug: "radiocarpal-ligaments", name: "Radiocarpal Ligaments", formalName: "Ligamenta radiocarpalia", alternateNames: ["wrist radiocarpal ligaments", "palmar and dorsal radiocarpal ligaments"], region: "wrist", joint: "wrist-joint", description: "Ligament groups connecting the distal radius to carpal bones and supporting wrist joint stability.", relationshipType: "stabilizes", targetEntityType: "joint", targetEntitySlug: "wrist-joint" },
  { slug: "ulnar-collateral-ligament-thumb", name: "Ulnar Collateral Ligament of Thumb", formalName: "Ligamentum collaterale ulnare pollicis", alternateNames: ["thumb UCL", "skier's thumb ligament"], region: "hand", joint: "thumb-metacarpophalangeal-joint", description: "Medial stabilizer of the thumb metacarpophalangeal joint, important for pinch stability.", relationshipType: "stabilizes", targetEntityType: "joint", targetEntitySlug: "thumb-metacarpophalangeal-joint" },
  { slug: "transverse-metacarpal-ligaments", name: "Transverse Metacarpal Ligaments", formalName: "Ligamenta metacarpalia transversa profunda", alternateNames: ["deep transverse metacarpal ligaments"], region: "hand", joint: "metacarpophalangeal-joints", description: "Ligaments linking metacarpal heads and helping maintain spacing across the MCP joints.", relationshipType: "stabilizes", targetEntityType: "joint", targetEntitySlug: "metacarpophalangeal-joints" },
  { slug: "pubofemoral-ligament", name: "Pubofemoral Ligament", formalName: "Ligamentum pubofemorale", alternateNames: ["pubofemoral ligament"], region: "hip", joint: "hip-joint", description: "Anterior-inferior hip capsule ligament from pubic region to femur that helps check abduction and extension.", relationshipType: "stabilizes", targetEntityType: "joint", targetEntitySlug: "hip-joint" },
  { slug: "ischiofemoral-ligament", name: "Ischiofemoral Ligament", formalName: "Ligamentum ischiofemorale", alternateNames: ["ischiofemoral ligament"], region: "hip", joint: "hip-joint", description: "Posterior hip capsule ligament from ischial acetabular region toward the femur, supporting hip stability.", relationshipType: "stabilizes", targetEntityType: "joint", targetEntitySlug: "hip-joint" },
  { slug: "ligamentum-teres-femoris", name: "Ligamentum Teres Femoris", formalName: "Ligamentum capitis femoris", alternateNames: ["ligament of head of femur", "round ligament of femur"], region: "hip", joint: "hip-joint", description: "Intra-articular hip ligament connecting the acetabular region to the femoral head fovea.", relationshipType: "connects", targetEntityType: "bone", targetEntitySlug: "femur" },
  { slug: "fibular-collateral-ligament", name: "Fibular Collateral Ligament", formalName: "Ligamentum collaterale fibulare", alternateNames: ["FCL", "lateral collateral ligament of knee"], region: "knee", joint: "knee-joint", description: "Lateral knee ligament connecting femur and fibula and resisting varus stress.", relationshipType: "stabilizes", targetEntityType: "joint", targetEntitySlug: "knee-joint" },
  { slug: "tibial-collateral-ligament", name: "Tibial Collateral Ligament", formalName: "Ligamentum collaterale tibiale", alternateNames: ["TCL", "medial collateral ligament of knee"], region: "knee", joint: "knee-joint", description: "Medial knee ligament connecting femur and tibia and resisting valgus stress.", relationshipType: "stabilizes", targetEntityType: "joint", targetEntitySlug: "knee-joint" },
  { slug: "patellar-ligament", name: "Patellar Ligament", formalName: "Ligamentum patellae", alternateNames: ["patellar tendon", "kneecap ligament"], region: "knee", joint: "knee-joint", description: "Continuation of the quadriceps tendon from patella to tibial tuberosity in the anterior knee.", relationshipType: "connects", targetEntityType: "bone_landmark", targetEntitySlug: "tibial-tuberosity" },
  { slug: "spring-ligament", name: "Spring Ligament", formalName: "Ligamentum calcaneonaviculare plantare", alternateNames: ["plantar calcaneonavicular ligament"], region: "foot", joint: "subtalar-joint", description: "Plantar ligament supporting the head of the talus and medial longitudinal arch of the foot.", relationshipType: "supports", targetEntityType: "bone", targetEntitySlug: "talus" },
  { slug: "long-plantar-ligament", name: "Long Plantar Ligament", formalName: "Ligamentum plantare longum", alternateNames: ["long plantar ligament"], region: "foot", joint: "subtalar-joint", description: "Strong plantar foot ligament supporting the lateral longitudinal arch and calcaneocuboid region.", relationshipType: "supports", targetEntityType: "bone", targetEntitySlug: "calcaneus" },
  { slug: "bifurcate-ligament", name: "Bifurcate Ligament", formalName: "Ligamentum bifurcatum", alternateNames: ["Y ligament of foot", "bifurcate foot ligament"], region: "foot", joint: "subtalar-joint", description: "Dorsal tarsal ligament with calcaneonavicular and calcaneocuboid parts supporting midfoot stability.", relationshipType: "connects", targetEntityType: "bone", targetEntitySlug: "calcaneus" },
]

const LIGAMENTS: LigamentRow[] = LIGAMENT_SPECS.map((spec) => ({
  id: `ligament-${spec.slug}`,
  slug: spec.slug,
  name: spec.name,
  region: spec.region,
  joint: spec.joint,
  description: spec.description,
  sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
}))

const LIGAMENT_TERMS = LIGAMENT_SPECS.flatMap((spec) => entityTerms("ligament", spec.slug, spec.name, spec.formalName ?? spec.name, spec.alternateNames ?? []))
const LIGAMENT_IDENTIFIERS = LIGAMENT_SPECS.map((spec) => fipatIdentifier("ligament", spec.slug, spec.formalName ?? spec.name))
const LIGAMENT_RELATIONSHIPS: RelationshipRow[] = LIGAMENT_SPECS.map((spec) => ({
  id: `relationship-${spec.slug}-${spec.relationshipType}-${spec.targetEntitySlug}`,
  sourceEntityType: "ligament",
  sourceEntitySlug: spec.slug,
  relationshipType: spec.relationshipType,
  targetEntityType: spec.targetEntityType,
  targetEntitySlug: spec.targetEntitySlug,
  details: {
    clinicalUse: "non-diagnostic",
    note: "Commercial-safe reviewed ligament mapping for browseable anatomy relationships.",
  },
  sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
}))

const LIGAMENT_CITATIONS = LIGAMENT_SPECS.flatMap((spec, index) => [
  ...rowCitations("ligament", spec.slug, spec.formalName ?? spec.name, APPLIED_HUMAN_ANATOMY_SOURCE),
  reviewedCitation(
    "ligament",
    spec.slug,
    "ligament_relationship",
    LIGAMENT_RELATIONSHIPS[index]?.id,
    APPLIED_HUMAN_ANATOMY_SOURCE,
    APPLIED_HUMAN_ANATOMY_LOCATOR,
    "Reviewed relationship connecting a named ligament to its primary joint, bone, or structural context.",
  ),
])

const NERVE_SPECS: NerveSpec[] = [
  { slug: "olfactory-nerve", name: "Olfactory Nerve", formalName: "Nervus olfactorius", alternateNames: ["CN I", "smell nerve"], nerveRoots: ["CN I"], region: "head", sourceRef: HUMAN_BIOLOGY_SOURCE, description: "Special sensory cranial nerve carrying smell information from the nasal cavity to the brain.", relationshipType: "sensory_distribution", targetEntityType: "anatomy_structure", targetEntitySlug: "nasal-cavity" },
  { slug: "optic-nerve", name: "Optic Nerve", formalName: "Nervus opticus", alternateNames: ["CN II", "vision nerve"], nerveRoots: ["CN II"], region: "head", sourceRef: HUMAN_BIOLOGY_SOURCE, description: "Special sensory cranial nerve transmitting visual information from the retina toward the brain.", relationshipType: "transmits_visual_input_from", targetEntityType: "anatomy_structure", targetEntitySlug: "retina" },
  { slug: "oculomotor-nerve", name: "Oculomotor Nerve", formalName: "Nervus oculomotorius", alternateNames: ["CN III", "third cranial nerve"], nerveRoots: ["CN III"], region: "head", sourceRef: HUMAN_BIOLOGY_SOURCE, description: "Motor cranial nerve supplying several extraocular muscles and parasympathetic eye-related functions.", relationshipType: "innervates", targetEntityType: "muscle", targetEntitySlug: "superior-rectus" },
  { slug: "trochlear-nerve", name: "Trochlear Nerve", formalName: "Nervus trochlearis", alternateNames: ["CN IV", "fourth cranial nerve"], nerveRoots: ["CN IV"], region: "head", sourceRef: HUMAN_BIOLOGY_SOURCE, description: "Motor cranial nerve supplying the superior oblique muscle of the eye.", relationshipType: "innervates", targetEntityType: "muscle", targetEntitySlug: "superior-oblique" },
  { slug: "abducens-nerve", name: "Abducens Nerve", formalName: "Nervus abducens", alternateNames: ["CN VI", "sixth cranial nerve"], nerveRoots: ["CN VI"], region: "head", sourceRef: HUMAN_BIOLOGY_SOURCE, description: "Motor cranial nerve supplying the lateral rectus muscle for eye abduction.", relationshipType: "innervates", targetEntityType: "muscle", targetEntitySlug: "lateral-rectus" },
  { slug: "vestibulocochlear-nerve", name: "Vestibulocochlear Nerve", formalName: "Nervus vestibulocochlearis", alternateNames: ["CN VIII", "hearing and balance nerve"], nerveRoots: ["CN VIII"], region: "head", sourceRef: HUMAN_BIOLOGY_SOURCE, description: "Special sensory cranial nerve carrying hearing and vestibular balance information.", relationshipType: "sensory_distribution", targetEntityType: "anatomy_structure", targetEntitySlug: "cochlea" },
  { slug: "glossopharyngeal-nerve", name: "Glossopharyngeal Nerve", formalName: "Nervus glossopharyngeus", alternateNames: ["CN IX", "ninth cranial nerve"], nerveRoots: ["CN IX"], region: "head-face-jaw", sourceRef: HUMAN_BIOLOGY_SOURCE, description: "Mixed cranial nerve with pharyngeal, taste, visceral, and stylopharyngeus motor contributions.", relationshipType: "innervates", targetEntityType: "muscle", targetEntitySlug: "stylopharyngeus" },
  { slug: "genitofemoral-nerve", name: "Genitofemoral Nerve", formalName: "Nervus genitofemoralis", alternateNames: ["L1-L2 genitofemoral nerve"], nerveRoots: ["L1", "L2"], region: "pelvis", description: "Lumbar plexus nerve with genital and femoral branches supplying anterior groin and upper thigh regions.", relationshipType: "sensory_distribution", targetEntityType: "region", targetEntitySlug: "pelvis" },
  { slug: "lateral-femoral-cutaneous-nerve", name: "Lateral Femoral Cutaneous Nerve", formalName: "Nervus cutaneus femoris lateralis", alternateNames: ["lateral cutaneous nerve of thigh"], nerveRoots: ["L2", "L3"], region: "thigh", description: "Lumbar plexus sensory nerve supplying the anterolateral thigh skin region.", relationshipType: "sensory_distribution", targetEntityType: "region", targetEntitySlug: "thigh" },
  { slug: "superior-cluneal-nerves", name: "Superior Cluneal Nerves", formalName: "Nervi clunium superiores", alternateNames: ["superior cluneal nerve branches"], nerveRoots: ["T11", "T12", "L1", "L2", "L3"], region: "lumbar-region", description: "Cutaneous branches from posterior rami that supply the superior buttock and posterior iliac crest region.", relationshipType: "sensory_distribution", targetEntityType: "region", targetEntitySlug: "lumbar-region" },
  { slug: "sural-nerve", name: "Sural Nerve", formalName: "Nervus suralis", alternateNames: ["posterolateral leg sensory nerve"], nerveRoots: ["S1", "S2"], region: "leg", description: "Sensory nerve supplying the posterolateral leg and lateral foot region.", relationshipType: "sensory_distribution", targetEntityType: "region", targetEntitySlug: "leg" },
  { slug: "saphenous-nerve", name: "Saphenous Nerve", formalName: "Nervus saphenus", alternateNames: ["medial leg sensory nerve"], nerveRoots: ["L3", "L4"], region: "leg", description: "Terminal sensory branch of the femoral nerve supplying the medial leg and foot region.", relationshipType: "sensory_distribution", targetEntityType: "region", targetEntitySlug: "leg" },
  { slug: "superficial-fibular-nerve", name: "Superficial Fibular Nerve", formalName: "Nervus fibularis superficialis", alternateNames: ["superficial peroneal nerve"], nerveRoots: ["L4", "L5", "S1"], region: "leg", description: "Common fibular nerve branch supplying lateral leg muscles and cutaneous sensation over the dorsum of the foot.", relationshipType: "gives_cutaneous_branches_to", targetEntityType: "region", targetEntitySlug: "foot" },
]

const NERVES: NerveRow[] = NERVE_SPECS.map((spec) => ({
  id: `nerve-${spec.slug}`,
  slug: spec.slug,
  name: spec.name,
  nerveRoots: spec.nerveRoots,
  region: spec.region,
  description: spec.description,
  sourceRef: spec.sourceRef ?? APPLIED_HUMAN_ANATOMY_SOURCE,
}))

const NERVE_TERMS = NERVE_SPECS.flatMap((spec) => entityTerms("nerve", spec.slug, spec.name, spec.formalName ?? spec.name, spec.alternateNames ?? [], spec.sourceRef ?? APPLIED_HUMAN_ANATOMY_SOURCE))
const NERVE_IDENTIFIERS = NERVE_SPECS.map((spec) => fipatIdentifier("nerve", spec.slug, spec.formalName ?? spec.name))
const NERVE_RELATIONSHIPS: RelationshipRow[] = NERVE_SPECS.map((spec) => ({
  id: `relationship-${spec.slug}-${spec.relationshipType}-${spec.targetEntitySlug}`,
  sourceEntityType: "nerve",
  sourceEntitySlug: spec.slug,
  relationshipType: spec.relationshipType,
  targetEntityType: spec.targetEntityType,
  targetEntitySlug: spec.targetEntitySlug,
  details: { clinicalUse: "non-diagnostic" },
  sourceRef: spec.sourceRef ?? APPLIED_HUMAN_ANATOMY_SOURCE,
}))
const NERVE_CITATIONS = NERVE_SPECS.flatMap((spec) => rowCitations("nerve", spec.slug, spec.formalName ?? spec.name, spec.sourceRef ?? APPLIED_HUMAN_ANATOMY_SOURCE))

const BLOOD_SUPPLY_SPECS: BloodSupplySpec[] = [
  { slug: "aortic-arch", name: "Aortic Arch", formalName: "Arcus aortae", alternateNames: ["arch of aorta"], kind: "artery", region: "thorax", description: "Curved aortic segment giving rise to major branches for the head, neck, and upper limbs.", relationshipType: "supplies_region", targetEntityType: "region", targetEntitySlug: "head-neck" },
  { slug: "thoracic-aorta", name: "Thoracic Aorta", formalName: "Aorta thoracica", alternateNames: ["descending thoracic aorta"], kind: "artery", region: "thorax", description: "Descending thoracic portion of the aorta supplying thoracic wall and visceral branches.", relationshipType: "supplies_region", targetEntityType: "region", targetEntitySlug: "thorax" },
  { slug: "common-carotid-artery", name: "Common Carotid Artery", formalName: "Arteria carotis communis", alternateNames: ["common carotid"], kind: "artery", region: "neck", description: "Major neck artery dividing into internal and external carotid branches for head and neck supply.", relationshipType: "supplies_region", targetEntityType: "region", targetEntitySlug: "head-neck" },
  { slug: "internal-carotid-artery", name: "Internal Carotid Artery", formalName: "Arteria carotis interna", alternateNames: ["internal carotid"], kind: "artery", region: "head", description: "Major artery entering the cranial cavity to contribute to brain and orbital-region blood supply.", relationshipType: "supplies_region", targetEntityType: "region", targetEntitySlug: "head" },
  { slug: "vertebral-artery", name: "Vertebral Artery", formalName: "Arteria vertebralis", alternateNames: ["vertebral artery"], kind: "artery", region: "neck", description: "Subclavian branch traveling through cervical transverse foramina to supply posterior cranial circulation.", relationshipType: "supplies_region", targetEntityType: "region", targetEntitySlug: "posterior-neck" },
  { slug: "palmar-arches", name: "Palmar Arches", formalName: "Arcus palmares", alternateNames: ["superficial and deep palmar arches"], kind: "artery", region: "hand", description: "Arterial arch networks in the palm that distribute blood to the hand and digits.", relationshipType: "supplies_region", targetEntityType: "region", targetEntitySlug: "hand" },
  { slug: "common-iliac-artery", name: "Common Iliac Artery", formalName: "Arteria iliaca communis", alternateNames: ["common iliac"], kind: "artery", region: "pelvis", description: "Terminal abdominal aorta branch dividing to supply pelvic and lower-limb pathways.", relationshipType: "supplies_region", targetEntityType: "region", targetEntitySlug: "pelvis" },
  { slug: "external-iliac-artery", name: "External Iliac Artery", formalName: "Arteria iliaca externa", alternateNames: ["external iliac"], kind: "artery", region: "pelvis", description: "Common iliac branch that continues toward the lower limb as the femoral arterial pathway.", relationshipType: "supplies_region", targetEntityType: "region", targetEntitySlug: "lower-limb" },
  { slug: "deep-femoral-artery", name: "Deep Femoral Artery", formalName: "Arteria profunda femoris", alternateNames: ["profunda femoris artery"], kind: "artery", region: "thigh", description: "Major deep thigh branch supplying femoral compartments and perforating branches.", relationshipType: "supplies_region", targetEntityType: "region", targetEntitySlug: "thigh" },
  { slug: "plantar-arteries", name: "Plantar Arteries", formalName: "Arteriae plantares", alternateNames: ["medial and lateral plantar arteries"], kind: "artery", region: "foot", description: "Posterior tibial artery branches supplying the plantar foot and digital circulation.", relationshipType: "supplies_region", targetEntityType: "region", targetEntitySlug: "foot" },
  { slug: "superior-vena-cava", name: "Superior Vena Cava", formalName: "Vena cava superior", alternateNames: ["SVC"], kind: "vein", region: "thorax", description: "Large systemic vein returning blood from head, neck, upper limbs, and thorax to the right atrium.", relationshipType: "drains_region", targetEntityType: "region", targetEntitySlug: "head-neck" },
  { slug: "inferior-vena-cava", name: "Inferior Vena Cava", formalName: "Vena cava inferior", alternateNames: ["IVC"], kind: "vein", region: "abdomen", description: "Large systemic vein returning blood from abdomen, pelvis, and lower limbs to the right atrium.", relationshipType: "drains_region", targetEntityType: "region", targetEntitySlug: "lower-limb" },
  { slug: "internal-jugular-vein", name: "Internal Jugular Vein", formalName: "Vena jugularis interna", alternateNames: ["internal jugular"], kind: "vein", region: "neck", description: "Major deep vein draining the brain, face, and neck into the brachiocephalic venous pathway.", relationshipType: "drains_region", targetEntityType: "region", targetEntitySlug: "head-neck" },
  { slug: "brachial-veins", name: "Brachial Veins", formalName: "Venae brachiales", alternateNames: ["deep brachial veins"], kind: "vein", region: "arm", description: "Paired deep veins accompanying the brachial artery and draining the arm.", relationshipType: "drains_region", targetEntityType: "region", targetEntitySlug: "arm" },
  { slug: "radial-veins", name: "Radial Veins", formalName: "Venae radiales", alternateNames: ["deep radial veins"], kind: "vein", region: "forearm", description: "Deep forearm veins accompanying the radial artery and draining radial-side forearm structures.", relationshipType: "drains_region", targetEntityType: "region", targetEntitySlug: "forearm" },
  { slug: "ulnar-veins", name: "Ulnar Veins", formalName: "Venae ulnares", alternateNames: ["deep ulnar veins"], kind: "vein", region: "forearm", description: "Deep forearm veins accompanying the ulnar artery and draining ulnar-side forearm structures.", relationshipType: "drains_region", targetEntityType: "region", targetEntitySlug: "forearm" },
  { slug: "great-saphenous-vein", name: "Great Saphenous Vein", formalName: "Vena saphena magna", alternateNames: ["long saphenous vein", "great saphenous"], kind: "vein", region: "lower-limb", description: "Long superficial vein ascending along the medial lower limb toward the femoral vein.", relationshipType: "drains_region", targetEntityType: "region", targetEntitySlug: "lower-limb" },
  { slug: "small-saphenous-vein", name: "Small Saphenous Vein", formalName: "Vena saphena parva", alternateNames: ["short saphenous vein", "small saphenous"], kind: "vein", region: "leg", description: "Superficial posterior leg vein typically draining toward the popliteal vein.", relationshipType: "drains_region", targetEntityType: "region", targetEntitySlug: "leg" },
  { slug: "portal-vein", name: "Portal Vein", formalName: "Vena portae hepatis", alternateNames: ["hepatic portal vein"], kind: "vein", region: "abdomen", description: "Portal venous vessel carrying nutrient-rich blood from digestive organs toward the liver.", relationshipType: "drains_to", targetEntityType: "anatomy_structure", targetEntitySlug: "liver" },
]

const BLOOD_SUPPLY: BloodSupplyRow[] = BLOOD_SUPPLY_SPECS.map((spec) => ({
  id: `blood-${spec.slug}`,
  slug: spec.slug,
  name: spec.name,
  kind: spec.kind,
  region: spec.region,
  description: spec.description,
  sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
}))
const BLOOD_SUPPLY_TERMS = BLOOD_SUPPLY_SPECS.flatMap((spec) => entityTerms("blood_supply", spec.slug, spec.name, spec.formalName ?? spec.name, spec.alternateNames ?? []))
const BLOOD_SUPPLY_IDENTIFIERS = BLOOD_SUPPLY_SPECS.map((spec) => fipatIdentifier("blood_supply", spec.slug, spec.formalName ?? spec.name))
const BLOOD_SUPPLY_RELATIONSHIPS: RelationshipRow[] = BLOOD_SUPPLY_SPECS.map((spec) => ({
  id: `relationship-${spec.slug}-${spec.relationshipType}-${spec.targetEntitySlug}`,
  sourceEntityType: "blood_supply",
  sourceEntitySlug: spec.slug,
  relationshipType: spec.relationshipType,
  targetEntityType: spec.targetEntityType,
  targetEntitySlug: spec.targetEntitySlug,
  sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
}))
const BLOOD_SUPPLY_CITATIONS = BLOOD_SUPPLY_SPECS.flatMap((spec) => rowCitations("blood_supply", spec.slug, spec.formalName ?? spec.name, APPLIED_HUMAN_ANATOMY_SOURCE))

const STRUCTURE_SPECS: StructureSpec[] = [
  { slug: "cornea", name: "Cornea", formalName: "Cornea", alternateNames: ["clear front of the eye"], structureType: "sensory organ structure", region: "head", sourceRef: HUMAN_BIOLOGY_SOURCE, description: "Transparent anterior eye structure that helps focus incoming light and protects the front of the eye.", relationshipType: "part_of", targetEntityType: "anatomy_structure", targetEntitySlug: "eye" },
  { slug: "lens", name: "Lens", formalName: "Lens crystallina", alternateNames: ["crystalline lens"], structureType: "sensory organ structure", region: "head", sourceRef: HUMAN_BIOLOGY_SOURCE, description: "Transparent eye structure that changes shape to help focus light on the retina.", relationshipType: "part_of", targetEntityType: "anatomy_structure", targetEntitySlug: "eye" },
  { slug: "sclera", name: "Sclera", formalName: "Sclera", alternateNames: ["white of the eye"], structureType: "sensory organ structure", region: "head", sourceRef: HUMAN_BIOLOGY_SOURCE, description: "Dense outer connective tissue coat of the eye that provides attachment context for extraocular muscles.", relationshipType: "part_of", targetEntityType: "anatomy_structure", targetEntitySlug: "eye" },
  { slug: "iris", name: "Iris", formalName: "Iris", alternateNames: ["colored part of the eye"], structureType: "sensory organ structure", region: "head", sourceRef: HUMAN_BIOLOGY_SOURCE, description: "Pigmented eye structure that adjusts pupil diameter and helps regulate light entering the eye.", relationshipType: "part_of", targetEntityType: "anatomy_structure", targetEntitySlug: "eye" },
  { slug: "optic-disc", name: "Optic Disc", formalName: "Discus nervi optici", alternateNames: ["optic nerve head", "blind spot"], structureType: "sensory organ structure", region: "head", sourceRef: HUMAN_BIOLOGY_SOURCE, description: "Retinal region where optic nerve fibers leave the eye and where photoreceptors are absent.", relationshipType: "part_of", targetEntityType: "anatomy_structure", targetEntitySlug: "retina" },
  { slug: "tympanic-membrane", name: "Tympanic Membrane", formalName: "Membrana tympanica", alternateNames: ["eardrum"], structureType: "sensory organ structure", region: "head", sourceRef: HUMAN_BIOLOGY_SOURCE, description: "Thin membrane separating external and middle ear that vibrates with sound waves.", relationshipType: "part_of", targetEntityType: "anatomy_structure", targetEntitySlug: "ear" },
  { slug: "auditory-ossicles", name: "Auditory Ossicles", formalName: "Ossicula auditus", alternateNames: ["malleus incus stapes", "middle ear bones"], structureType: "sensory organ structure", region: "head", sourceRef: HUMAN_BIOLOGY_SOURCE, description: "Three small middle-ear bones that transmit vibrations from the tympanic membrane to the inner ear.", relationshipType: "part_of", targetEntityType: "anatomy_structure", targetEntitySlug: "ear" },
  { slug: "semicircular-canals", name: "Semicircular Canals", formalName: "Canales semicirculares", alternateNames: ["balance canals"], structureType: "sensory organ structure", region: "head", sourceRef: HUMAN_BIOLOGY_SOURCE, description: "Inner-ear vestibular structures that detect angular head movement for balance information.", relationshipType: "part_of", targetEntityType: "anatomy_structure", targetEntitySlug: "vestibular-apparatus" },
  { slug: "cricoid-cartilage", name: "Cricoid Cartilage", formalName: "Cartilago cricoidea", alternateNames: ["cricoid ring"], structureType: "laryngeal cartilage", region: "anterior-neck", description: "Ring-shaped laryngeal cartilage inferior to the thyroid cartilage and associated with intrinsic laryngeal muscles.", relationshipType: "part_of", targetEntityType: "anatomy_structure", targetEntitySlug: "larynx" },
  { slug: "arytenoid-cartilage", name: "Arytenoid Cartilage", formalName: "Cartilago arytenoidea", alternateNames: ["arytenoid"], structureType: "laryngeal cartilage", region: "anterior-neck", description: "Paired laryngeal cartilages that anchor and move the vocal folds during phonation and breathing.", relationshipType: "part_of", targetEntityType: "anatomy_structure", targetEntitySlug: "larynx" },
  { slug: "vocal-fold", name: "Vocal Fold", formalName: "Plica vocalis", alternateNames: ["vocal cord", "vocal fold"], structureType: "laryngeal fold", region: "anterior-neck", description: "Laryngeal fold containing ligament and muscle components that vibrates during voice production.", relationshipType: "part_of", targetEntityType: "anatomy_structure", targetEntitySlug: "larynx" },
  { slug: "epiglottis", name: "Epiglottis", formalName: "Epiglottis", alternateNames: ["epiglottic cartilage"], structureType: "laryngeal cartilage", region: "anterior-neck", description: "Leaf-shaped elastic cartilage associated with protection of the laryngeal inlet during swallowing.", relationshipType: "part_of", targetEntityType: "anatomy_structure", targetEntitySlug: "larynx" },
  { slug: "lung-lobe", name: "Lung Lobe", formalName: "Lobus pulmonis", alternateNames: ["pulmonary lobe"], structureType: "respiratory structure", region: "thorax", description: "Named division of a lung separated by fissures and used for regional respiratory anatomy mapping.", relationshipType: "part_of", targetEntityType: "anatomy_structure", targetEntitySlug: "lung" },
]

const STRUCTURES: StructureRow[] = STRUCTURE_SPECS.map((spec) => ({
  id: `structure-${spec.slug}`,
  slug: spec.slug,
  name: spec.name,
  structureType: spec.structureType,
  region: spec.region,
  description: spec.description,
  sourceRef: spec.sourceRef ?? APPLIED_HUMAN_ANATOMY_SOURCE,
}))
const STRUCTURE_TERMS = STRUCTURE_SPECS.flatMap((spec) => entityTerms("anatomy_structure", spec.slug, spec.name, spec.formalName ?? spec.name, spec.alternateNames ?? [], spec.sourceRef ?? APPLIED_HUMAN_ANATOMY_SOURCE))
const STRUCTURE_IDENTIFIERS = STRUCTURE_SPECS.map((spec) => fipatIdentifier("anatomy_structure", spec.slug, spec.formalName ?? spec.name))
const STRUCTURE_RELATIONSHIPS: RelationshipRow[] = STRUCTURE_SPECS.map((spec) => ({
  id: `relationship-${spec.slug}-${spec.relationshipType}-${spec.targetEntitySlug}`,
  sourceEntityType: "anatomy_structure",
  sourceEntitySlug: spec.slug,
  relationshipType: spec.relationshipType,
  targetEntityType: spec.targetEntityType,
  targetEntitySlug: spec.targetEntitySlug,
  sourceRef: spec.sourceRef ?? APPLIED_HUMAN_ANATOMY_SOURCE,
}))
const STRUCTURE_CITATIONS = STRUCTURE_SPECS.flatMap((spec) => rowCitations("anatomy_structure", spec.slug, spec.formalName ?? spec.name, spec.sourceRef ?? APPLIED_HUMAN_ANATOMY_SOURCE))

export const ATLAS_GAP_CLOSURE_SECTION: AnatomySeedSection = {
  joints: FUNCTIONAL_JOINTS,
  jointMovements: FUNCTIONAL_MOVEMENTS,
  rangesOfMotion: FUNCTIONAL_RANGES,
  muscles: MUSCLES,
  muscleAttachments: MUSCLE_ATTACHMENTS,
  muscleActions: MUSCLE_ACTIONS,
  muscleInnervations: MUSCLE_INNERVATIONS,
  nerves: NERVES,
  ligaments: LIGAMENTS,
  bloodSupply: BLOOD_SUPPLY,
  structures: STRUCTURES,
  entityTerms: [
    ...MUSCLE_TERMS,
    ...LIGAMENT_TERMS,
    ...NERVE_TERMS,
    ...BLOOD_SUPPLY_TERMS,
    ...STRUCTURE_TERMS,
  ],
  relationships: [
    ...MUSCLE_RELATIONSHIPS,
    ...LIGAMENT_RELATIONSHIPS,
    ...NERVE_RELATIONSHIPS,
    ...BLOOD_SUPPLY_RELATIONSHIPS,
    ...STRUCTURE_RELATIONSHIPS,
  ],
  citations: [
    ...ROM_CITATIONS,
    ...MUSCLE_CITATIONS,
    ...LIGAMENT_CITATIONS,
    ...NERVE_CITATIONS,
    ...BLOOD_SUPPLY_CITATIONS,
    ...STRUCTURE_CITATIONS,
  ],
  externalIdentifiers: [
    ...MUSCLE_IDENTIFIERS,
    ...LIGAMENT_IDENTIFIERS,
    ...NERVE_IDENTIFIERS,
    ...BLOOD_SUPPLY_IDENTIFIERS,
    ...STRUCTURE_IDENTIFIERS,
  ],
}
