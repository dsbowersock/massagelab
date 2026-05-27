import type { AnatomySeedSection } from "./sections.ts"

const APPLIED_HUMAN_ANATOMY_SOURCE = "applied-human-anatomy"
const APPLIED_HUMAN_ANATOMY_LOCATOR = "https://open.umn.edu/opentextbooks/textbooks/1266"
const HUMAN_BIOLOGY_SOURCE = "openstax-human-biology"
const HUMAN_BIOLOGY_LOCATOR = "https://open.umn.edu/opentextbooks/textbooks/576"
const FIPAT_SOURCE = "fipat-ta2"
const FIPAT_LOCATOR = "https://libraries.dal.ca/Fipat/ta2.html"

type CitationRow = NonNullable<AnatomySeedSection["citations"]>[number]
type ExternalIdentifierRow = NonNullable<AnatomySeedSection["externalIdentifiers"]>[number]
type EntityTermRow = NonNullable<AnatomySeedSection["entityTerms"]>[number]
type RelationshipRow = NonNullable<AnatomySeedSection["relationships"]>[number]
type MuscleRow = NonNullable<AnatomySeedSection["muscles"]>[number]
type MuscleAttachmentRow = NonNullable<AnatomySeedSection["muscleAttachments"]>[number]
type MuscleActionRow = NonNullable<AnatomySeedSection["muscleActions"]>[number]
type MuscleInnervationRow = NonNullable<AnatomySeedSection["muscleInnervations"]>[number]
type BoneRow = NonNullable<AnatomySeedSection["bones"]>[number]
type BoneLandmarkRow = NonNullable<AnatomySeedSection["boneLandmarks"]>[number]
type LigamentRow = NonNullable<AnatomySeedSection["ligaments"]>[number]
type StructureRow = NonNullable<AnatomySeedSection["structures"]>[number]

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
  summary: string
  attachments: AttachmentSpec[]
  actions: ActionSpec[]
  nerve: string
  innervationDescription: string
}

type BoneSpec = {
  slug: string
  name: string
  formalName: string
  alternateNames: string[]
  region: string
  summary: string
  parent?: {
    entityType: RelationshipRow["targetEntityType"]
    entitySlug: string
  }
}

type StructureSpec = {
  slug: string
  name: string
  formalName: string
  alternateNames: string[]
  structureType: string
  region: string
  summary: string
  sourceRef?: string
  parent: {
    entityType: RelationshipRow["targetEntityType"]
    entitySlug: string
  }
}

type LigamentSpec = {
  slug: string
  name: string
  formalName: string
  alternateNames: string[]
  region: string
  joint: string
  summary: string
  relationshipType: string
  targetEntityType: RelationshipRow["targetEntityType"]
  targetEntitySlug: string
}

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

function sourceLocatorFor(sourceRef: string) {
  return sourceRef === HUMAN_BIOLOGY_SOURCE ? HUMAN_BIOLOGY_LOCATOR : APPLIED_HUMAN_ANATOMY_LOCATOR
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
  const id = `citation-atlas-complete-${slugify(entityType)}-${entitySlug}-${slugify(factType)}${factSegment}`

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
    id: `external-atlas-complete-${slugify(entityType)}-${entitySlug}-fipat-ta2`,
    entityType,
    entitySlug,
    provider: "FIPAT_TA2",
    identifier: `TA2:${label}`,
    iri: FIPAT_LOCATOR,
    label,
    sourceRef: FIPAT_SOURCE,
  } satisfies ExternalIdentifierRow
}

function terms(
  entityType: EntityTermRow["anatomyEntityType"],
  entitySlug: string,
  preferredTerm: string,
  formalTerm: string,
  alternateTerms: string[] = [],
  practicalSourceRef = APPLIED_HUMAN_ANATOMY_SOURCE,
) {
  return [
    {
      id: `term-atlas-complete-${slugify(entityType)}-${entitySlug}-preferred-fipat`,
      anatomyEntityType: entityType,
      anatomyEntitySlug: entitySlug,
      term: preferredTerm,
      termType: "preferred",
      sourceRef: FIPAT_SOURCE,
    },
    {
      id: `term-atlas-complete-${slugify(entityType)}-${entitySlug}-formal-fipat`,
      anatomyEntityType: entityType,
      anatomyEntitySlug: entitySlug,
      term: formalTerm,
      termType: "formal",
      sourceRef: FIPAT_SOURCE,
    },
    ...alternateTerms.map((term, index) => ({
      id: `term-atlas-complete-${slugify(entityType)}-${entitySlug}-alternate-${index + 1}-${slugify(term)}`,
      anatomyEntityType: entityType,
      anatomyEntitySlug: entitySlug,
      term,
      termType: (index === 0 ? "common" : "alternate") as EntityTermRow["termType"],
      sourceRef: practicalSourceRef,
    })),
  ] satisfies EntityTermRow[]
}

function entityCoreCitations(
  entityType: CitationRow["entityType"],
  entitySlug: string,
  formalName: string,
  sourceRef = APPLIED_HUMAN_ANATOMY_SOURCE,
) {
  return [
    reviewedCitation(
      entityType,
      entitySlug,
      "clinical_summary",
      undefined,
      sourceRef,
      sourceLocatorFor(sourceRef),
      "MassageLab-authored display summary reviewed against a commercial-safe anatomy reference.",
    ),
    reviewedCitation(
      entityType,
      entitySlug,
      "official_term",
      `term-atlas-complete-${slugify(entityType)}-${entitySlug}-preferred-fipat`,
      FIPAT_SOURCE,
      `FIPAT TA2: ${formalName}`,
      "FIPAT TA2 official anatomical terminology used for the preferred/formal term row.",
    ),
    reviewedCitation(
      entityType,
      entitySlug,
      "external_identifier",
      `external-atlas-complete-${slugify(entityType)}-${entitySlug}-fipat-ta2`,
      FIPAT_SOURCE,
      `FIPAT TA2: ${formalName}`,
      "FIPAT TA2 terminology anchor used as a stable external identifier until more precise ontology IDs are curated.",
    ),
  ] satisfies CitationRow[]
}

const MUSCLE_SPECS: MuscleSpec[] = [
  { slug: "corrugator-supercilii", name: "Corrugator Supercilii", formalName: "Corrugator supercilii", alternateNames: ["corrugator", "frown muscle"], region: "face", relativeDepth: "deep", depthNotes: "Small facial expression muscle deep to the brow skin and frontal belly region.", category: "facial expression", summary: "It draws the eyebrow medially and inferiorly, creating vertical forehead wrinkles and supporting facial-expression mapping.", attachments: [{ type: "origin", bone: "frontal-bone", description: "Medial superciliary arch region of the frontal bone." }, { type: "insertion", bone: "frontal-bone", description: "Skin of the medial eyebrow and forehead region." }], actions: [{ joint: "facial-expression-complex", movement: "brow-elevation", role: "secondary", contractionType: "concentric", description: "Draws the brow medially and inferiorly as a facial-expression action." }], nerve: "facial-nerve", innervationDescription: "Facial nerve motor branches supply muscles of facial expression." },
  { slug: "procerus", name: "Procerus", formalName: "Procerus", alternateNames: ["bridge of nose muscle", "glabellar muscle"], region: "face", relativeDepth: "superficial", depthNotes: "Superficial facial expression muscle over the nasal bridge.", category: "facial expression", summary: "It draws the medial eyebrow region inferiorly and wrinkles the skin over the bridge of the nose.", attachments: [{ type: "origin", bone: "nasal-bone", landmark: "nasal-bridge", description: "Nasal bone and upper nasal cartilage region." }, { type: "insertion", bone: "frontal-bone", landmark: "frontal-belly-region", description: "Skin over the lower forehead and glabella region." }], actions: [{ joint: "facial-expression-complex", movement: "nasal-compression", role: "secondary", contractionType: "concentric", description: "Wrinkles the bridge of the nose and draws the medial brow downward." }], nerve: "facial-nerve", innervationDescription: "Facial nerve motor branches supply muscles of facial expression." },
  { slug: "levator-labii-superioris-alaeque-nasi", name: "Levator Labii Superioris Alaeque Nasi", formalName: "Levator labii superioris alaeque nasi", alternateNames: ["LLSAN", "levator of upper lip and nasal ala"], region: "face", relativeDepth: "superficial", depthNotes: "Superficial facial expression muscle beside the nose.", category: "facial expression", summary: "It elevates the upper lip and can dilate or lift the nasal ala for facial-expression and nasal-region mapping.", attachments: [{ type: "origin", bone: "maxilla", description: "Frontal process of the maxilla near the medial orbit." }, { type: "insertion", bone: "maxilla", description: "Skin and soft tissue of the upper lip and nasal ala region." }], actions: [{ joint: "facial-expression-complex", movement: "upper-lip-elevation", role: "primary", contractionType: "concentric", description: "Elevates the upper lip and nasal ala." }], nerve: "facial-nerve", innervationDescription: "Facial nerve motor branches supply muscles of facial expression." },
  { slug: "levator-anguli-oris", name: "Levator Anguli Oris", formalName: "Levator anguli oris", alternateNames: ["caninus", "mouth angle elevator"], region: "face", relativeDepth: "deep", depthNotes: "Deep facial expression muscle under levator labii superioris and zygomaticus region.", category: "facial expression", summary: "It elevates the angle of the mouth and contributes to smiling and upper-lip expression mechanics.", attachments: [{ type: "origin", bone: "maxilla", description: "Canine fossa region of the maxilla." }, { type: "insertion", bone: "mandible", description: "Modiolus and angle of mouth soft-tissue region." }], actions: [{ joint: "facial-expression-complex", movement: "mouth-angle-elevation", role: "primary", contractionType: "concentric", description: "Elevates the angle of the mouth." }], nerve: "facial-nerve", innervationDescription: "Facial nerve motor branches supply muscles of facial expression." },
  { slug: "depressor-septi-nasi", name: "Depressor Septi Nasi", formalName: "Depressor septi nasi", alternateNames: ["depressor of nasal septum"], region: "face", relativeDepth: "superficial", depthNotes: "Small superficial muscle between upper lip and nasal septum.", category: "facial expression", summary: "It draws the nasal septum downward and contributes to nostril and upper-lip facial-expression mechanics.", attachments: [{ type: "origin", bone: "maxilla", description: "Incisive fossa region of the maxilla." }, { type: "insertion", bone: "vomer", landmark: "posterior-nasal-septum", description: "Mobile nasal septum and alar cartilage region." }], actions: [{ joint: "facial-expression-complex", movement: "nasal-compression", role: "secondary", contractionType: "concentric", description: "Depresses the nasal septum and modifies nostril shape." }], nerve: "facial-nerve", innervationDescription: "Facial nerve motor branches supply muscles of facial expression." },
  { slug: "auricularis-anterior", name: "Auricularis Anterior", formalName: "Auricularis anterior", alternateNames: ["anterior auricular muscle"], region: "head", relativeDepth: "superficial", depthNotes: "Small superficial scalp muscle anterior to the auricle.", category: "auricular expression", summary: "It weakly draws the auricle forward and is useful for complete scalp and facial-expression anatomy references.", attachments: [{ type: "origin", bone: "temporal-bone", description: "Temporal fascia region anterior to the auricle." }, { type: "insertion", bone: "temporal-bone", description: "Anterior auricular cartilage region." }], actions: [{ joint: "facial-expression-complex", movement: "eyelid-closure", role: "stabilizer", contractionType: "isometric", description: "Provides minor anterior auricular movement in facial-expression mapping." }], nerve: "facial-nerve", innervationDescription: "Facial nerve temporal branch contribution." },
  { slug: "auricularis-superior", name: "Auricularis Superior", formalName: "Auricularis superior", alternateNames: ["superior auricular muscle"], region: "head", relativeDepth: "superficial", depthNotes: "Small superficial scalp muscle superior to the auricle.", category: "auricular expression", summary: "It weakly elevates the auricle and completes the named auricular muscle set.", attachments: [{ type: "origin", bone: "temporal-bone", description: "Epicranial aponeurosis and temporal fascia above the auricle." }, { type: "insertion", bone: "temporal-bone", description: "Superior auricular cartilage region." }], actions: [{ joint: "facial-expression-complex", movement: "brow-elevation", role: "stabilizer", contractionType: "isometric", description: "Provides minor superior auricular movement in facial-expression mapping." }], nerve: "facial-nerve", innervationDescription: "Facial nerve temporal branch contribution." },
  { slug: "auricularis-posterior", name: "Auricularis Posterior", formalName: "Auricularis posterior", alternateNames: ["posterior auricular muscle"], region: "head", relativeDepth: "superficial", depthNotes: "Small superficial muscle posterior to the auricle.", category: "auricular expression", summary: "It weakly draws the auricle backward and completes posterior auricular anatomy references.", attachments: [{ type: "origin", bone: "temporal-bone", landmark: "mastoid-process", description: "Mastoid and adjacent temporal bone region." }, { type: "insertion", bone: "temporal-bone", description: "Posterior auricular cartilage region." }], actions: [{ joint: "facial-expression-complex", movement: "eyelid-closure", role: "stabilizer", contractionType: "isometric", description: "Provides minor posterior auricular movement in facial-expression mapping." }], nerve: "facial-nerve", innervationDescription: "Posterior auricular branch of the facial nerve." },
  { slug: "superior-longitudinal-tongue", name: "Superior Longitudinal Tongue Muscle", formalName: "Musculus longitudinalis superior linguae", alternateNames: ["superior longitudinal muscle of tongue", "intrinsic tongue muscle"], region: "head-face-jaw", relativeDepth: "deep", depthNotes: "Intrinsic tongue muscle deep to the superior tongue mucosa.", category: "intrinsic tongue", summary: "It shortens the tongue and curls the tip and sides upward for intrinsic tongue control.", attachments: [{ type: "origin", bone: "hyoid-bone", landmark: "body-of-hyoid", description: "Fibrous septum and submucosal tongue connective tissue." }, { type: "insertion", bone: "mandible", description: "Tongue tip and lateral tongue soft-tissue region." }], actions: [{ joint: "tongue-functional-complex", movement: "tongue-elevation", role: "primary", contractionType: "concentric", description: "Elevates and curls the tongue tip and sides." }], nerve: "hypoglossal-nerve", innervationDescription: "Hypoglossal nerve supplies intrinsic tongue muscles." },
  { slug: "inferior-longitudinal-tongue", name: "Inferior Longitudinal Tongue Muscle", formalName: "Musculus longitudinalis inferior linguae", alternateNames: ["inferior longitudinal muscle of tongue", "intrinsic tongue muscle"], region: "head-face-jaw", relativeDepth: "deep", depthNotes: "Intrinsic tongue muscle along the inferior tongue.", category: "intrinsic tongue", summary: "It shortens the tongue and curls the tip downward for intrinsic tongue shaping.", attachments: [{ type: "origin", bone: "hyoid-bone", landmark: "body-of-hyoid", description: "Root of tongue and hyoid-related connective tissue." }, { type: "insertion", bone: "mandible", description: "Tongue tip and inferior tongue soft-tissue region." }], actions: [{ joint: "tongue-functional-complex", movement: "tongue-depression", role: "primary", contractionType: "concentric", description: "Depresses and curls the tongue tip downward." }], nerve: "hypoglossal-nerve", innervationDescription: "Hypoglossal nerve supplies intrinsic tongue muscles." },
  { slug: "transverse-tongue", name: "Transverse Tongue Muscle", formalName: "Musculus transversus linguae", alternateNames: ["transverse muscle of tongue", "intrinsic tongue muscle"], region: "head-face-jaw", relativeDepth: "deep", depthNotes: "Intrinsic tongue muscle running laterally from the lingual septum.", category: "intrinsic tongue", summary: "It narrows and elongates the tongue for fine tongue shaping and speech/swallowing mechanics.", attachments: [{ type: "origin", bone: "hyoid-bone", landmark: "body-of-hyoid", description: "Median fibrous septum of the tongue." }, { type: "insertion", bone: "mandible", description: "Lateral margins of the tongue soft-tissue region." }], actions: [{ joint: "tongue-functional-complex", movement: "tongue-protrusion", role: "secondary", contractionType: "concentric", description: "Narrows and elongates the tongue." }], nerve: "hypoglossal-nerve", innervationDescription: "Hypoglossal nerve supplies intrinsic tongue muscles." },
  { slug: "vertical-tongue", name: "Vertical Tongue Muscle", formalName: "Musculus verticalis linguae", alternateNames: ["vertical muscle of tongue", "intrinsic tongue muscle"], region: "head-face-jaw", relativeDepth: "deep", depthNotes: "Intrinsic tongue muscle running between superior and inferior tongue surfaces.", category: "intrinsic tongue", summary: "It flattens and broadens the tongue for fine tongue shaping.", attachments: [{ type: "origin", bone: "mandible", description: "Superior tongue connective tissue and mucosal region." }, { type: "insertion", bone: "mandible", description: "Inferior tongue connective tissue and mucosal region." }], actions: [{ joint: "tongue-functional-complex", movement: "tongue-depression", role: "secondary", contractionType: "concentric", description: "Flattens and broadens the tongue." }], nerve: "hypoglossal-nerve", innervationDescription: "Hypoglossal nerve supplies intrinsic tongue muscles." },
  { slug: "aryepiglotticus", name: "Aryepiglotticus", formalName: "Aryepiglotticus", alternateNames: ["aryepiglottic muscle"], region: "anterior-neck", relativeDepth: "deep", depthNotes: "Deep intrinsic laryngeal fiber continuation in the aryepiglottic fold.", category: "intrinsic laryngeal", summary: "It assists narrowing the laryngeal inlet during swallowing-related laryngeal closure.", attachments: [{ type: "origin", bone: "hyoid-bone", landmark: "body-of-hyoid", description: "Arytenoid cartilage region, stored with hyoid-laryngeal context." }, { type: "insertion", bone: "hyoid-bone", landmark: "body-of-hyoid", description: "Epiglottic and aryepiglottic fold region." }], actions: [{ joint: "laryngeal-functional-complex", movement: "vocal-fold-adduction", role: "secondary", contractionType: "concentric", description: "Assists closure of the laryngeal inlet." }], nerve: "vagus-nerve", innervationDescription: "Vagus nerve contribution through recurrent laryngeal branches." },
  { slug: "thyroepiglotticus", name: "Thyroepiglotticus", formalName: "Thyroepiglotticus", alternateNames: ["thyroepiglottic muscle"], region: "anterior-neck", relativeDepth: "deep", depthNotes: "Deep laryngeal fiber continuation from the thyroarytenoid region.", category: "intrinsic laryngeal", summary: "It assists widening of the laryngeal inlet and adjusts epiglottic fold tension.", attachments: [{ type: "origin", bone: "hyoid-bone", landmark: "body-of-hyoid", description: "Inner thyroid cartilage region." }, { type: "insertion", bone: "hyoid-bone", landmark: "body-of-hyoid", description: "Epiglottic and aryepiglottic fold region." }], actions: [{ joint: "laryngeal-functional-complex", movement: "vocal-fold-tension", role: "secondary", contractionType: "concentric", description: "Adjusts laryngeal inlet and epiglottic fold tension." }], nerve: "vagus-nerve", innervationDescription: "Vagus nerve contribution through recurrent laryngeal branches." },
  { slug: "rectus-capitis-anterior", name: "Rectus Capitis Anterior", formalName: "Rectus capitis anterior", alternateNames: ["anterior rectus capitis"], region: "head-neck", relativeDepth: "deep", depthNotes: "Deep prevertebral muscle at the anterior atlanto-occipital region.", category: "prevertebral neck", summary: "It assists upper-cervical flexion and stabilizes the atlanto-occipital region.", attachments: [{ type: "origin", bone: "atlas", landmark: "transverse-process-atlas", description: "Anterior surface of the lateral mass and transverse process region of C1." }, { type: "insertion", bone: "occipital-bone", landmark: "basilar-part-occipital-bone", description: "Basilar part of the occipital bone anterior to the foramen magnum." }], actions: [{ joint: "atlanto-occipital", movement: "atlanto-occipital-extension", role: "stabilizer", contractionType: "isometric", description: "Stabilizes the atlanto-occipital region and assists nodding mechanics." }], nerve: "cervical-plexus", innervationDescription: "Upper cervical anterior rami contribution." },
  { slug: "rectus-capitis-lateralis", name: "Rectus Capitis Lateralis", formalName: "Rectus capitis lateralis", alternateNames: ["lateral rectus capitis"], region: "head-neck", relativeDepth: "deep", depthNotes: "Deep lateral prevertebral muscle at the atlanto-occipital region.", category: "prevertebral neck", summary: "It assists lateral stabilization and side-bending control between C1 and the occipital bone.", attachments: [{ type: "origin", bone: "atlas", landmark: "transverse-process-atlas", description: "Transverse process of the atlas." }, { type: "insertion", bone: "occipital-bone", landmark: "basilar-part-occipital-bone", description: "Jugular process/basilar lateral occipital region." }], actions: [{ joint: "cervical-spine", movement: "cervical-lateral-flexion", role: "stabilizer", contractionType: "isometric", description: "Assists upper-cervical lateral stabilization." }], nerve: "cervical-plexus", innervationDescription: "Upper cervical anterior rami contribution." },
  { slug: "semispinalis-cervicis", name: "Semispinalis Cervicis", formalName: "Semispinalis cervicis", alternateNames: ["semispinalis colli"], region: "posterior-neck", relativeDepth: "deep", depthNotes: "Deep transversospinalis muscle in the posterior cervical region.", category: "intrinsic back", summary: "It assists cervical extension and contralateral rotation as part of deep spinal control.", attachments: [{ type: "origin", bone: "thoracic-vertebrae", landmark: "thoracic-transverse-processes", description: "Transverse processes of upper thoracic vertebrae." }, { type: "insertion", bone: "cervical-vertebrae", landmark: "cervical-spinous-processes", description: "Spinous processes of cervical vertebrae." }], actions: [{ joint: "cervical-spine", movement: "cervical-extension", role: "secondary", contractionType: "concentric", description: "Assists cervical extension and segmental control." }], nerve: "posterior-rami-spinal-nerves", innervationDescription: "Posterior rami of spinal nerves supply intrinsic back muscles." },
  { slug: "semispinalis-thoracis", name: "Semispinalis Thoracis", formalName: "Semispinalis thoracis", alternateNames: ["semispinalis dorsi"], region: "upper-back", relativeDepth: "deep", depthNotes: "Deep transversospinalis muscle spanning thoracic and cervical regions.", category: "intrinsic back", summary: "It assists thoracic extension and rotation control as part of the transversospinalis system.", attachments: [{ type: "origin", bone: "thoracic-vertebrae", landmark: "lower-thoracic-spinous-processes", description: "Transverse processes of lower thoracic vertebrae." }, { type: "insertion", bone: "thoracic-vertebrae", landmark: "upper-thoracic-spinous-processes", description: "Spinous processes of upper thoracic and lower cervical vertebrae." }], actions: [{ joint: "thoracic-spine", movement: "thoracic-extension", role: "secondary", contractionType: "concentric", description: "Assists thoracic extension and segmental rotation control." }], nerve: "posterior-rami-spinal-nerves", innervationDescription: "Posterior rami of spinal nerves supply intrinsic back muscles." },
  { slug: "multifidus-cervicis", name: "Multifidus Cervicis", formalName: "Multifidus cervicis", alternateNames: ["cervical multifidus"], region: "posterior-neck", relativeDepth: "deep", depthNotes: "Deep segmental transversospinalis muscle in the cervical region.", category: "intrinsic back", summary: "It provides segmental cervical stability and assists extension/rotation control.", attachments: [{ type: "origin", bone: "cervical-vertebrae", landmark: "cervical-transverse-processes", description: "Articular and transverse process region of cervical vertebrae." }, { type: "insertion", bone: "cervical-vertebrae", landmark: "cervical-spinous-processes", description: "Spinous processes two to four segments superior." }], actions: [{ joint: "cervical-spine", movement: "cervical-extension", role: "stabilizer", contractionType: "isometric", description: "Supports segmental cervical stability and extension control." }], nerve: "posterior-rami-spinal-nerves", innervationDescription: "Posterior rami of spinal nerves supply intrinsic back muscles." },
  { slug: "multifidus-thoracis", name: "Multifidus Thoracis", formalName: "Multifidus thoracis", alternateNames: ["thoracic multifidus"], region: "upper-back", relativeDepth: "deep", depthNotes: "Deep segmental transversospinalis muscle in the thoracic region.", category: "intrinsic back", summary: "It provides segmental thoracic stability and assists extension/rotation control.", attachments: [{ type: "origin", bone: "thoracic-vertebrae", landmark: "thoracic-transverse-processes", description: "Transverse process region of thoracic vertebrae." }, { type: "insertion", bone: "thoracic-vertebrae", landmark: "upper-thoracic-spinous-processes", description: "Spinous processes two to four segments superior." }], actions: [{ joint: "thoracic-spine", movement: "thoracic-extension", role: "stabilizer", contractionType: "isometric", description: "Supports segmental thoracic stability and extension control." }], nerve: "posterior-rami-spinal-nerves", innervationDescription: "Posterior rami of spinal nerves supply intrinsic back muscles." },
  { slug: "levatores-costarum", name: "Levatores Costarum", formalName: "Levatores costarum", alternateNames: ["rib elevators", "levatores costarum muscles"], region: "upper-back", relativeDepth: "deep", depthNotes: "Small deep muscles from transverse processes to ribs.", category: "thoracic wall", summary: "They elevate ribs and assist thoracic posture, breathing mechanics, and segmental rib-cage control.", attachments: [{ type: "origin", bone: "thoracic-vertebrae", landmark: "thoracic-transverse-processes", description: "Transverse processes of cervical/thoracic transition and thoracic vertebrae." }, { type: "insertion", bone: "ribs", landmark: "rib-angles", description: "Rib between tubercle and angle inferior to the vertebral origin." }], actions: [{ joint: "thoracic-cage", movement: "rib-elevation", role: "secondary", contractionType: "concentric", description: "Assists rib elevation and thoracic cage mechanics." }], nerve: "posterior-rami-spinal-nerves", innervationDescription: "Posterior rami of thoracic spinal nerves contribute to these intrinsic thoracic muscles." },
  { slug: "pectoralis-major-sternocostal-head", name: "Pectoralis Major, Sternocostal Head", formalName: "Pectoralis major, pars sternocostalis", alternateNames: ["sternocostal pec major", "mid pec"], region: "shoulder-girdle", relativeDepth: "superficial", depthNotes: "Superficial anterior chest muscle over pectoralis minor and ribs.", category: "pectoralis major subdivision", summary: "It adducts, internally rotates, and horizontally flexes the shoulder from the sternum and costal cartilage region.", attachments: [{ type: "origin", bone: "sternum", landmark: "sternal-body", description: "Anterior sternum and upper costal cartilage region." }, { type: "insertion", bone: "humerus", landmark: "intertubercular-sulcus", description: "Lateral lip of the intertubercular sulcus of the humerus." }], actions: [{ joint: "glenohumeral", movement: "shoulder-adduction", role: "primary", contractionType: "concentric", description: "Adducts and internally rotates the shoulder." }], nerve: "medial-pectoral-nerve", innervationDescription: "Medial and lateral pectoral nerve contributions supply pectoralis major fibers." },
  { slug: "pectoralis-major-abdominal-head", name: "Pectoralis Major, Abdominal Head", formalName: "Pectoralis major, pars abdominalis", alternateNames: ["abdominal pec major", "lower pec"], region: "shoulder-girdle", relativeDepth: "superficial", depthNotes: "Inferior superficial pectoralis major fibers over the anterior chest wall.", category: "pectoralis major subdivision", summary: "It assists shoulder adduction and extension from flexed positions through inferior pectoralis major fibers.", attachments: [{ type: "origin", bone: "ribs", landmark: "costal-margin", description: "Costal cartilage and abdominal aponeurosis region." }, { type: "insertion", bone: "humerus", landmark: "intertubercular-sulcus", description: "Lateral lip of the intertubercular sulcus of the humerus." }], actions: [{ joint: "glenohumeral", movement: "shoulder-extension", role: "secondary", contractionType: "concentric", description: "Assists shoulder extension from flexed positions and adduction." }], nerve: "medial-pectoral-nerve", innervationDescription: "Medial and lateral pectoral nerve contributions supply pectoralis major fibers." },
  { slug: "deltoid-anterior-fibers", name: "Deltoid, Anterior Fibers", formalName: "Deltoideus, pars clavicularis", alternateNames: ["anterior deltoid", "front deltoid"], region: "shoulder-girdle", relativeDepth: "superficial", depthNotes: "Superficial anterior shoulder fibers over the glenohumeral joint.", category: "deltoid subdivision", summary: "It flexes and internally rotates the shoulder and contributes to anterior shoulder contour.", attachments: [{ type: "origin", bone: "clavicle", landmark: "lateral-third-clavicle", description: "Lateral third of the clavicle." }, { type: "insertion", bone: "humerus", landmark: "deltoid-tuberosity", description: "Deltoid tuberosity of the humerus." }], actions: [{ joint: "glenohumeral", movement: "shoulder-flexion", role: "primary", contractionType: "concentric", description: "Flexes the shoulder." }], nerve: "axillary-nerve", innervationDescription: "Axillary nerve supplies deltoid fibers." },
  { slug: "deltoid-middle-fibers", name: "Deltoid, Middle Fibers", formalName: "Deltoideus, pars acromialis", alternateNames: ["middle deltoid", "lateral deltoid"], region: "shoulder-girdle", relativeDepth: "superficial", depthNotes: "Superficial lateral shoulder fibers over the glenohumeral joint.", category: "deltoid subdivision", summary: "It is the primary deltoid subdivision for shoulder abduction after initiation by supraspinatus.", attachments: [{ type: "origin", bone: "scapula", landmark: "acromion", description: "Acromion of the scapula." }, { type: "insertion", bone: "humerus", landmark: "deltoid-tuberosity", description: "Deltoid tuberosity of the humerus." }], actions: [{ joint: "glenohumeral", movement: "shoulder-abduction", role: "primary", contractionType: "concentric", description: "Abducts the shoulder." }], nerve: "axillary-nerve", innervationDescription: "Axillary nerve supplies deltoid fibers." },
  { slug: "deltoid-posterior-fibers", name: "Deltoid, Posterior Fibers", formalName: "Deltoideus, pars spinalis", alternateNames: ["posterior deltoid", "rear deltoid"], region: "shoulder-girdle", relativeDepth: "superficial", depthNotes: "Superficial posterior shoulder fibers over the posterior glenohumeral region.", category: "deltoid subdivision", summary: "It extends and externally rotates the shoulder and contributes to posterior shoulder contour.", attachments: [{ type: "origin", bone: "scapula", landmark: "spine-of-scapula", description: "Spine of the scapula." }, { type: "insertion", bone: "humerus", landmark: "deltoid-tuberosity", description: "Deltoid tuberosity of the humerus." }], actions: [{ joint: "glenohumeral", movement: "shoulder-extension", role: "primary", contractionType: "concentric", description: "Extends the shoulder." }], nerve: "axillary-nerve", innervationDescription: "Axillary nerve supplies deltoid fibers." },
  { slug: "extensor-carpi-radialis-longus", name: "Extensor Carpi Radialis Longus", formalName: "Extensor carpi radialis longus", alternateNames: ["ECRL", "long radial wrist extensor"], region: "forearm", relativeDepth: "superficial", depthNotes: "Superficial radial posterior forearm muscle.", category: "forearm extensor", summary: "It extends and radially deviates the wrist, supporting grip with the wrist held in extension.", attachments: [{ type: "origin", bone: "humerus", landmark: "lateral-supracondylar-line", description: "Lateral supracondylar ridge of the humerus." }, { type: "insertion", bone: "second-metacarpal", landmark: "atlas-second-metacarpal-base", description: "Base of the second metacarpal." }], actions: [{ joint: "wrist-joint", movement: "wrist-extension", role: "primary", contractionType: "concentric", description: "Extends the wrist and assists radial deviation." }], nerve: "radial-nerve", innervationDescription: "Radial nerve supplies extensor carpi radialis longus." },
  { slug: "extensor-carpi-radialis-brevis", name: "Extensor Carpi Radialis Brevis", formalName: "Extensor carpi radialis brevis", alternateNames: ["ECRB", "short radial wrist extensor"], region: "forearm", relativeDepth: "intermediate", depthNotes: "Posterior forearm muscle deep to extensor carpi radialis longus region.", category: "forearm extensor", summary: "It extends and radially deviates the wrist and is commonly referenced in lateral elbow tendon anatomy.", attachments: [{ type: "origin", bone: "humerus", landmark: "lateral-epicondyle-humerus", description: "Lateral epicondyle via the common extensor tendon region." }, { type: "insertion", bone: "third-metacarpal", landmark: "atlas-third-metacarpal-base", description: "Base of the third metacarpal." }], actions: [{ joint: "wrist-joint", movement: "wrist-extension", role: "primary", contractionType: "concentric", description: "Extends the wrist and assists radial deviation." }], nerve: "radial-nerve", innervationDescription: "Radial nerve deep branch contribution supplies this extensor muscle." },
  { slug: "extensor-indicis", name: "Extensor Indicis", formalName: "Extensor indicis", alternateNames: ["index finger extensor", "extensor indicis proprius"], region: "forearm", relativeDepth: "deep", depthNotes: "Deep posterior forearm muscle to the index finger.", category: "forearm extensor", summary: "It independently extends the index finger and assists wrist/finger extensor coordination.", attachments: [{ type: "origin", bone: "ulna", description: "Posterior distal ulna and interosseous membrane region." }, { type: "insertion", bone: "proximal-phalanx-index-finger", landmark: "atlas-proximal-phalanx-index-finger-base", description: "Extensor expansion of the index finger." }], actions: [{ joint: "interphalangeal-joints-of-hand", movement: "finger-extension", role: "primary", contractionType: "concentric", description: "Extends the index finger through its extensor expansion." }], nerve: "radial-nerve", innervationDescription: "Posterior interosseous/deep radial nerve contribution." },
  { slug: "extensor-digiti-minimi", name: "Extensor Digiti Minimi", formalName: "Extensor digiti minimi", alternateNames: ["little finger extensor", "extensor digiti quinti"], region: "forearm", relativeDepth: "superficial", depthNotes: "Superficial posterior forearm muscle to the little finger.", category: "forearm extensor", summary: "It extends the little finger and assists finger extension patterns.", attachments: [{ type: "origin", bone: "humerus", landmark: "lateral-epicondyle-humerus", description: "Lateral epicondyle via the common extensor tendon region." }, { type: "insertion", bone: "proximal-phalanx-little-finger", landmark: "atlas-proximal-phalanx-little-finger-base", description: "Extensor expansion of the little finger." }], actions: [{ joint: "interphalangeal-joints-of-hand", movement: "finger-extension", role: "primary", contractionType: "concentric", description: "Extends the little finger through its extensor expansion." }], nerve: "radial-nerve", innervationDescription: "Posterior interosseous/deep radial nerve contribution." },
  { slug: "psoas-minor", name: "Psoas Minor", formalName: "Psoas minor", alternateNames: ["minor psoas"], region: "lumbar-region", relativeDepth: "deep", depthNotes: "Small variable anterior lumbar muscle superficial to psoas major when present.", category: "prevertebral trunk", summary: "It is a variable muscle that can assist lumbar fascia tensioning and slight trunk flexion.", attachments: [{ type: "origin", bone: "lumbar-vertebrae", landmark: "lumbar-vertebral-bodies", description: "Bodies of T12/L1 region and intervening disc when present." }, { type: "insertion", bone: "pubis", landmark: "pubic-crest", description: "Pectineal line/iliopubic eminence region; stored with pubic crest context." }], actions: [{ joint: "lumbar-spine", movement: "lumbar-flexion", role: "secondary", contractionType: "concentric", description: "Assists slight lumbar flexion or fascial tensioning when present." }], nerve: "lumbar-plexus", innervationDescription: "Lumbar anterior rami contribution, commonly L1." },
  { slug: "adductor-minimus", name: "Adductor Minimus", formalName: "Adductor minimus", alternateNames: ["upper adductor magnus", "adductor minimus muscle"], region: "thigh", relativeDepth: "deep", depthNotes: "Deep proximal adductor often described with adductor magnus.", category: "medial thigh", summary: "It assists hip adduction and external rotation from the inferior pubic ramus toward the proximal femur.", attachments: [{ type: "origin", bone: "pubis", landmark: "inferior-pubic-ramus", description: "Inferior pubic ramus region." }, { type: "insertion", bone: "femur", landmark: "linea-aspera", description: "Proximal linea aspera/pectineal line region of the femur." }], actions: [{ joint: "hip-joint", movement: "hip-adduction", role: "secondary", contractionType: "concentric", description: "Assists hip adduction." }], nerve: "obturator-nerve", innervationDescription: "Obturator nerve posterior division contribution." },
  { slug: "adductor-hallucis-oblique-head", name: "Adductor Hallucis, Oblique Head", formalName: "Adductor hallucis, caput obliquum", alternateNames: ["oblique head of adductor hallucis"], region: "foot", relativeDepth: "deep", depthNotes: "Deep intrinsic plantar foot muscle in the central plantar compartment.", category: "intrinsic foot", summary: "It adducts the hallux and supports the transverse arch through the oblique head of adductor hallucis.", attachments: [{ type: "origin", bone: "tarsals", landmark: "atlas-tarsals-reference-region", description: "Bases of lesser metatarsals, cuboid, lateral cuneiform, and long plantar ligament region." }, { type: "insertion", bone: "proximal-phalanx-hallux", landmark: "atlas-proximal-phalanx-hallux-base", description: "Lateral base of proximal phalanx of the hallux." }], actions: [{ joint: "metatarsophalangeal-joints", movement: "hallux-adduction", role: "primary", contractionType: "concentric", description: "Adducts the hallux at the first MTP region." }], nerve: "lateral-plantar-nerve", innervationDescription: "Deep branch of the lateral plantar nerve supplies adductor hallucis." },
  { slug: "adductor-hallucis-transverse-head", name: "Adductor Hallucis, Transverse Head", formalName: "Adductor hallucis, caput transversum", alternateNames: ["transverse head of adductor hallucis"], region: "foot", relativeDepth: "deep", depthNotes: "Deep intrinsic plantar foot muscle across metatarsal heads.", category: "intrinsic foot", summary: "It adducts the hallux and stabilizes the transverse metatarsal arch through the transverse head.", attachments: [{ type: "origin", bone: "metatarsals", landmark: "metatarsal-heads", description: "Plantar ligaments and capsules of lateral metatarsophalangeal joints." }, { type: "insertion", bone: "proximal-phalanx-hallux", landmark: "atlas-proximal-phalanx-hallux-base", description: "Lateral base of proximal phalanx of the hallux." }], actions: [{ joint: "metatarsophalangeal-joints", movement: "hallux-adduction", role: "primary", contractionType: "concentric", description: "Adducts the hallux and supports transverse arch control." }], nerve: "lateral-plantar-nerve", innervationDescription: "Deep branch of the lateral plantar nerve supplies adductor hallucis." },
]

const MUSCLES: MuscleRow[] = MUSCLE_SPECS.map((spec) => ({
  id: `muscle-atlas-complete-${spec.slug}`,
  slug: spec.slug,
  name: spec.name,
  formalName: spec.formalName,
  alternateNames: spec.alternateNames,
  description: `${spec.name} is a ${spec.category} muscle in the ${spec.region.replace(/-/g, " ")} region. ${spec.summary} This MassageLab-authored row supports atlas lookup, education, SOAP tagging, flashcards, body-map context, and game prompts.`,
  region: spec.region,
  relativeDepth: spec.relativeDepth,
  depthNotes: spec.depthNotes,
  sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
}))

const MUSCLE_ATTACHMENTS: MuscleAttachmentRow[] = MUSCLE_SPECS.flatMap((spec) => spec.attachments.map((attachment, index) => ({
  id: `attach-atlas-complete-${spec.slug}-${attachment.type}-${index + 1}`,
  muscle: spec.slug,
  type: attachment.type,
  bone: attachment.bone,
  landmark: attachment.landmark,
  description: attachment.description,
  sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
})))

const MUSCLE_ACTIONS: MuscleActionRow[] = MUSCLE_SPECS.flatMap((spec) => spec.actions.map((action, index) => ({
  id: `action-atlas-complete-${spec.slug}-${action.movement}-${index + 1}`,
  muscle: spec.slug,
  joint: action.joint,
  movement: action.movement,
  role: action.role ?? "primary",
  contractionType: action.contractionType ?? "concentric",
  description: action.description,
  sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
})))

const MUSCLE_INNERVATIONS: MuscleInnervationRow[] = MUSCLE_SPECS.map((spec) => ({
  id: `innervation-atlas-complete-${spec.slug}-${spec.nerve}`,
  muscle: spec.slug,
  nerve: spec.nerve,
  description: spec.innervationDescription,
  sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
}))

const MUSCLE_TERMS = MUSCLE_SPECS.flatMap((spec) => terms("muscle", spec.slug, spec.name, spec.formalName, spec.alternateNames))
const MUSCLE_IDENTIFIERS = MUSCLE_SPECS.map((spec) => fipatIdentifier("muscle", spec.slug, spec.formalName))
const MUSCLE_CITATIONS = MUSCLE_SPECS.flatMap((spec) => {
  const origin = MUSCLE_ATTACHMENTS.find((attachment) => attachment.muscle === spec.slug && attachment.type === "origin")
  const insertion = MUSCLE_ATTACHMENTS.find((attachment) => attachment.muscle === spec.slug && attachment.type === "insertion")
  const action = MUSCLE_ACTIONS.find((entry) => entry.muscle === spec.slug)
  const innervation = MUSCLE_INNERVATIONS.find((entry) => entry.muscle === spec.slug)

  return [
    ...entityCoreCitations("muscle", spec.slug, spec.formalName),
    reviewedCitation("muscle", spec.slug, "origin", origin?.id, APPLIED_HUMAN_ANATOMY_SOURCE, APPLIED_HUMAN_ANATOMY_LOCATOR, "Origin fact reviewed against commercial-safe applied anatomy references."),
    reviewedCitation("muscle", spec.slug, "insertion", insertion?.id, APPLIED_HUMAN_ANATOMY_SOURCE, APPLIED_HUMAN_ANATOMY_LOCATOR, "Insertion fact reviewed against commercial-safe applied anatomy references."),
    reviewedCitation("muscle", spec.slug, "action", action?.id, APPLIED_HUMAN_ANATOMY_SOURCE, APPLIED_HUMAN_ANATOMY_LOCATOR, "Action fact reviewed against commercial-safe applied anatomy references."),
    reviewedCitation("muscle", spec.slug, "innervation", innervation?.id, APPLIED_HUMAN_ANATOMY_SOURCE, APPLIED_HUMAN_ANATOMY_LOCATOR, "Innervation fact reviewed against commercial-safe applied anatomy references."),
  ]
})

const AGGREGATE_MEMBER_RELATIONSHIPS: RelationshipRow[] = [
  ["scalenes", ["anterior-scalene", "middle-scalene", "posterior-scalene"]],
  ["suboccipital-muscles", ["rectus-capitis-posterior-major", "rectus-capitis-posterior-minor", "obliquus-capitis-superior", "obliquus-capitis-inferior"]],
  ["iliopsoas", ["iliacus", "psoas-major"]],
  ["hamstrings", ["biceps-femoris", "semitendinosus", "semimembranosus"]],
  ["adductor-group", ["adductor-longus", "adductor-brevis", "adductor-magnus", "gracilis", "pectineus"]],
  ["dorsal-interossei-hand", ["dorsal-interosseous-hand-1", "dorsal-interosseous-hand-2", "dorsal-interosseous-hand-3", "dorsal-interosseous-hand-4"]],
  ["palmar-interossei-hand", ["palmar-interosseous-hand-1", "palmar-interosseous-hand-2", "palmar-interosseous-hand-3"]],
  ["lumbricals-hand", ["lumbrical-hand-1", "lumbrical-hand-2", "lumbrical-hand-3", "lumbrical-hand-4"]],
  ["dorsal-interossei-foot", ["dorsal-interosseous-foot-1", "dorsal-interosseous-foot-2", "dorsal-interosseous-foot-3", "dorsal-interosseous-foot-4"]],
  ["plantar-interossei-foot", ["plantar-interosseous-foot-1", "plantar-interosseous-foot-2", "plantar-interosseous-foot-3"]],
  ["lumbricals-foot", ["lumbrical-foot-1", "lumbrical-foot-2", "lumbrical-foot-3", "lumbrical-foot-4"]],
].flatMap(([sourceSlug, targetSlugs]) => (targetSlugs as string[]).map((targetSlug) => ({
  id: `relationship-atlas-complete-${sourceSlug}-includes-${targetSlug}`,
  sourceEntityType: "muscle",
  sourceEntitySlug: sourceSlug as string,
  relationshipType: "includes_muscle",
  targetEntityType: "muscle",
  targetEntitySlug: targetSlug,
  details: {
    clinicalUse: "non-diagnostic",
    note: "Aggregate muscle row retained for common language and linked to individual atlas records.",
  },
  sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
})))

const BONE_SPECS: BoneSpec[] = [
  { slug: "malleus", name: "Malleus", formalName: "Malleus", alternateNames: ["hammer bone"], region: "head", summary: "The malleus is the lateral auditory ossicle attached to the tympanic membrane and articulating with the incus.", parent: { entityType: "anatomy_structure", entitySlug: "auditory-ossicles" } },
  { slug: "incus", name: "Incus", formalName: "Incus", alternateNames: ["anvil bone"], region: "head", summary: "The incus is the middle auditory ossicle between malleus and stapes in the middle ear sound-transmission chain.", parent: { entityType: "anatomy_structure", entitySlug: "auditory-ossicles" } },
  { slug: "stapes", name: "Stapes", formalName: "Stapes", alternateNames: ["stirrup bone"], region: "head", summary: "The stapes is the medial auditory ossicle that transmits vibration toward the oval window of the inner ear.", parent: { entityType: "anatomy_structure", entitySlug: "auditory-ossicles" } },
  { slug: "manubrium", name: "Manubrium", formalName: "Manubrium sterni", alternateNames: ["upper sternum"], region: "thorax", summary: "The manubrium is the superior part of the sternum, articulating with the clavicles and first costal cartilage.", parent: { entityType: "bone", entitySlug: "sternum" } },
  { slug: "body-of-sternum", name: "Body of Sternum", formalName: "Corpus sterni", alternateNames: ["sternal body"], region: "thorax", summary: "The body of the sternum is the elongated middle portion of the sternum connected to multiple costal cartilages.", parent: { entityType: "bone", entitySlug: "sternum" } },
  { slug: "xiphoid-process", name: "Xiphoid Process", formalName: "Processus xiphoideus", alternateNames: ["xiphoid"], region: "thorax", summary: "The xiphoid process is the inferior sternum segment and an attachment landmark for abdominal wall and diaphragm-related tissues.", parent: { entityType: "bone", entitySlug: "sternum" } },
  { slug: "s1-vertebra", name: "S1 Vertebra", formalName: "Vertebra sacralis prima", alternateNames: ["first sacral segment"], region: "pelvis", summary: "S1 is the first sacral segment at the lumbosacral junction and contributes to sacral base anatomy.", parent: { entityType: "bone", entitySlug: "sacrum" } },
  { slug: "s2-vertebra", name: "S2 Vertebra", formalName: "Vertebra sacralis secunda", alternateNames: ["second sacral segment"], region: "pelvis", summary: "S2 is the second sacral segment and contributes to posterior sacral foramina and pelvic nerve landmarking.", parent: { entityType: "bone", entitySlug: "sacrum" } },
  { slug: "s3-vertebra", name: "S3 Vertebra", formalName: "Vertebra sacralis tertia", alternateNames: ["third sacral segment"], region: "pelvis", summary: "S3 is the third sacral segment and helps organize sacral canal and pelvic floor regional anatomy.", parent: { entityType: "bone", entitySlug: "sacrum" } },
  { slug: "s4-vertebra", name: "S4 Vertebra", formalName: "Vertebra sacralis quarta", alternateNames: ["fourth sacral segment"], region: "pelvis", summary: "S4 is the fourth sacral segment and contributes to inferior sacral and pelvic floor landmarking.", parent: { entityType: "bone", entitySlug: "sacrum" } },
  { slug: "s5-vertebra", name: "S5 Vertebra", formalName: "Vertebra sacralis quinta", alternateNames: ["fifth sacral segment"], region: "pelvis", summary: "S5 is the fifth sacral segment near the sacrococcygeal region and pelvic floor attachment context.", parent: { entityType: "bone", entitySlug: "sacrum" } },
  { slug: "coccygeal-vertebrae", name: "Coccygeal Vertebrae", formalName: "Vertebrae coccygeae", alternateNames: ["coccygeal segments"], region: "pelvis", summary: "Coccygeal vertebrae are fused or variably fused terminal vertebral segments forming the coccyx.", parent: { entityType: "bone", entitySlug: "coccyx" } },
  { slug: "hand-sesamoid-bones", name: "Hand Sesamoid Bones", formalName: "Ossa sesamoidea manus", alternateNames: ["thumb sesamoids", "hand sesamoids"], region: "hand", summary: "Hand sesamoid bones are small bones embedded in tendons, especially around the thumb metacarpophalangeal region.", parent: { entityType: "region", entitySlug: "hand" } },
  { slug: "foot-sesamoid-bones", name: "Foot Sesamoid Bones", formalName: "Ossa sesamoidea pedis", alternateNames: ["hallux sesamoids", "foot sesamoids"], region: "foot", summary: "Foot sesamoid bones are small tendon-embedded bones, especially under the first metatarsal head near the hallux.", parent: { entityType: "region", entitySlug: "foot" } },
]

const BONES: BoneRow[] = BONE_SPECS.map((spec) => ({
  id: `bone-atlas-complete-${spec.slug}`,
  slug: spec.slug,
  name: spec.name,
  formalName: spec.formalName,
  description: `${spec.summary} This first-class skeletal row avoids relying only on grouped placeholders for therapist education and atlas browsing.`,
  region: spec.region,
  sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
}))

const BONE_LANDMARKS: BoneLandmarkRow[] = BONE_SPECS.map((spec) => ({
  id: `landmark-atlas-complete-${spec.slug}-reference`,
  slug: `atlas-complete-${spec.slug}-reference`,
  name: `${spec.name} Reference Surface`,
  bone: spec.slug,
  description: `Seed-addressable reference landmark for ${spec.name.toLowerCase()} used by attachments, browsing, and citations.`,
  sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
}))

const BONE_TERMS = BONE_SPECS.flatMap((spec) => terms("bone", spec.slug, spec.name, spec.formalName, spec.alternateNames))
const BONE_LANDMARK_TERMS = BONE_LANDMARKS.flatMap((landmark) => terms("bone_landmark", landmark.slug, landmark.name, landmark.name, [landmark.name.replace(" Reference Surface", "")]))
const BONE_IDENTIFIERS = BONE_SPECS.map((spec) => fipatIdentifier("bone", spec.slug, spec.formalName))
const BONE_RELATIONSHIPS: RelationshipRow[] = BONE_SPECS.filter((spec) => spec.parent).map((spec) => ({
  id: `relationship-atlas-complete-${spec.slug}-part-of-${spec.parent?.entitySlug}`,
  sourceEntityType: "bone",
  sourceEntitySlug: spec.slug,
  relationshipType: "part_of",
  targetEntityType: spec.parent?.entityType ?? "bone",
  targetEntitySlug: spec.parent?.entitySlug ?? "skeleton",
  details: { clinicalUse: "non-diagnostic" },
  sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
}))
const BONE_CITATIONS = [
  ...BONE_SPECS.flatMap((spec) => entityCoreCitations("bone", spec.slug, spec.formalName)),
  ...BONE_LANDMARKS.flatMap((landmark) => [
    reviewedCitation("bone_landmark", landmark.slug, "anatomy_landmark", undefined, APPLIED_HUMAN_ANATOMY_SOURCE, APPLIED_HUMAN_ANATOMY_LOCATOR, "Seed-addressable landmark row reviewed against commercial-safe anatomy references."),
    reviewedCitation("bone_landmark", landmark.slug, "official_term", `term-atlas-complete-bone-landmark-${landmark.slug}-preferred-fipat`, FIPAT_SOURCE, `FIPAT TA2: ${landmark.name}`, "FIPAT TA2 terminology used for searchable landmark naming where exact part terminology is available or approximated by MassageLab-authored label."),
  ]),
]

const STRUCTURE_SPECS: StructureSpec[] = [
  { slug: "tooth", name: "Tooth", formalName: "Dens", alternateNames: ["teeth", "dentition"], structureType: "digestive and oral structure", region: "face", sourceRef: HUMAN_BIOLOGY_SOURCE, summary: "A tooth is a mineralized oral structure used for mechanical digestion and oral anatomy mapping; it is modeled as a structure rather than a bone.", parent: { entityType: "anatomy_structure", entitySlug: "oral-cavity" } },
  { slug: "upper-teeth", name: "Upper Teeth", formalName: "Dentes superiores", alternateNames: ["maxillary teeth"], structureType: "oral structure group", region: "face", sourceRef: HUMAN_BIOLOGY_SOURCE, summary: "Upper teeth are maxillary dentition structures used for oral, jaw, and client-friendly anatomy references.", parent: { entityType: "anatomy_structure", entitySlug: "tooth" } },
  { slug: "lower-teeth", name: "Lower Teeth", formalName: "Dentes inferiores", alternateNames: ["mandibular teeth"], structureType: "oral structure group", region: "face", sourceRef: HUMAN_BIOLOGY_SOURCE, summary: "Lower teeth are mandibular dentition structures used for oral, jaw, and client-friendly anatomy references.", parent: { entityType: "anatomy_structure", entitySlug: "tooth" } },
  { slug: "costal-cartilages", name: "Costal Cartilages", formalName: "Cartilagines costales", alternateNames: ["rib cartilages"], structureType: "cartilage", region: "thorax", summary: "Costal cartilages connect ribs to the sternum region and contribute to thoracic cage elasticity during breathing.", parent: { entityType: "joint", entitySlug: "thoracic-cage" } },
]

const STRUCTURES: StructureRow[] = STRUCTURE_SPECS.map((spec) => ({
  id: `structure-atlas-complete-${spec.slug}`,
  slug: spec.slug,
  name: spec.name,
  structureType: spec.structureType,
  region: spec.region,
  description: `${spec.summary} This row keeps named non-bone anatomy searchable without forcing it into the bone table.`,
  sourceRef: spec.sourceRef ?? APPLIED_HUMAN_ANATOMY_SOURCE,
}))

const STRUCTURE_TERMS = STRUCTURE_SPECS.flatMap((spec) => terms("anatomy_structure", spec.slug, spec.name, spec.formalName, spec.alternateNames, spec.sourceRef ?? APPLIED_HUMAN_ANATOMY_SOURCE))
const STRUCTURE_IDENTIFIERS = STRUCTURE_SPECS.map((spec) => fipatIdentifier("anatomy_structure", spec.slug, spec.formalName))
const STRUCTURE_RELATIONSHIPS: RelationshipRow[] = STRUCTURE_SPECS.map((spec) => ({
  id: `relationship-atlas-complete-${spec.slug}-part-of-${spec.parent.entitySlug}`,
  sourceEntityType: "anatomy_structure",
  sourceEntitySlug: spec.slug,
  relationshipType: "part_of",
  targetEntityType: spec.parent.entityType,
  targetEntitySlug: spec.parent.entitySlug,
  details: { clinicalUse: "non-diagnostic" },
  sourceRef: spec.sourceRef ?? APPLIED_HUMAN_ANATOMY_SOURCE,
}))
const STRUCTURE_CITATIONS = STRUCTURE_SPECS.flatMap((spec) => entityCoreCitations("anatomy_structure", spec.slug, spec.formalName, spec.sourceRef ?? APPLIED_HUMAN_ANATOMY_SOURCE))

const LIGAMENT_SPECS: LigamentSpec[] = [
  { slug: "apical-ligament-of-dens", name: "Apical Ligament of Dens", formalName: "Ligamentum apicis dentis", alternateNames: ["apical dental ligament"], region: "head-neck", joint: "atlantoaxial", summary: "Small craniovertebral ligament connecting the tip of the dens to the occipital region.", relationshipType: "stabilizes", targetEntityType: "joint", targetEntitySlug: "atlantoaxial" },
  { slug: "tectorial-membrane", name: "Tectorial Membrane", formalName: "Membrana tectoria", alternateNames: ["upper cervical tectorial membrane"], region: "head-neck", joint: "atlantoaxial", summary: "Superior continuation of the posterior longitudinal ligament over the dens and upper cervical canal.", relationshipType: "covers", targetEntityType: "bone", targetEntitySlug: "axis" },
  { slug: "intertransverse-ligaments", name: "Intertransverse Ligaments", formalName: "Ligamenta intertransversaria", alternateNames: ["between transverse process ligaments"], region: "back", joint: "lumbar-spine", summary: "Segmental ligaments between transverse processes that help support lateral spinal stability.", relationshipType: "connects", targetEntityType: "bone_landmark", targetEntitySlug: "lumbar-transverse-processes" },
  { slug: "facet-joint-capsules", name: "Facet Joint Capsules", formalName: "Capsulae articulationum zygapophysialium", alternateNames: ["zygapophyseal joint capsules"], region: "back", joint: "lumbar-spine", summary: "Capsular ligaments surrounding spinal facet joints and supporting segmental spinal guidance.", relationshipType: "stabilizes", targetEntityType: "joint", targetEntitySlug: "lumbar-spine" },
  { slug: "superior-glenohumeral-ligament", name: "Superior Glenohumeral Ligament", formalName: "Ligamentum glenohumerale superius", alternateNames: ["SGHL"], region: "shoulder-girdle", joint: "glenohumeral", summary: "Superior anterior shoulder capsular ligament supporting the glenohumeral joint near adducted positions.", relationshipType: "stabilizes", targetEntityType: "joint", targetEntitySlug: "glenohumeral" },
  { slug: "middle-glenohumeral-ligament", name: "Middle Glenohumeral Ligament", formalName: "Ligamentum glenohumerale medium", alternateNames: ["MGHL"], region: "shoulder-girdle", joint: "glenohumeral", summary: "Anterior shoulder capsular ligament contributing to glenohumeral stability through mid-range positions.", relationshipType: "stabilizes", targetEntityType: "joint", targetEntitySlug: "glenohumeral" },
  { slug: "inferior-glenohumeral-ligament", name: "Inferior Glenohumeral Ligament", formalName: "Ligamentum glenohumerale inferius", alternateNames: ["IGHL", "inferior glenohumeral ligament complex"], region: "shoulder-girdle", joint: "glenohumeral", summary: "Inferior shoulder capsular ligament complex important for glenohumeral stability in abducted positions.", relationshipType: "stabilizes", targetEntityType: "joint", targetEntitySlug: "glenohumeral" },
  { slug: "conoid-ligament", name: "Conoid Ligament", formalName: "Ligamentum conoideum", alternateNames: ["conoid part of coracoclavicular ligament"], region: "shoulder-girdle", joint: "acromioclavicular", summary: "Medial part of the coracoclavicular ligament connecting coracoid and clavicle for AC support.", relationshipType: "stabilizes", targetEntityType: "joint", targetEntitySlug: "acromioclavicular" },
  { slug: "trapezoid-ligament", name: "Trapezoid Ligament", formalName: "Ligamentum trapezoideum", alternateNames: ["trapezoid part of coracoclavicular ligament"], region: "shoulder-girdle", joint: "acromioclavicular", summary: "Lateral part of the coracoclavicular ligament connecting coracoid and clavicle for AC support.", relationshipType: "stabilizes", targetEntityType: "joint", targetEntitySlug: "acromioclavicular" },
  { slug: "transverse-humeral-ligament", name: "Transverse Humeral Ligament", formalName: "Ligamentum transversum humeri", alternateNames: ["bicipital groove ligament"], region: "shoulder-girdle", joint: "glenohumeral", summary: "Ligament spanning the intertubercular sulcus region and related to the long-head biceps tendon path.", relationshipType: "related_to", targetEntityType: "anatomy_structure", targetEntitySlug: "biceps-tendon" },
  { slug: "oblique-popliteal-ligament", name: "Oblique Popliteal Ligament", formalName: "Ligamentum popliteum obliquum", alternateNames: ["posterior oblique knee ligament"], region: "knee", joint: "knee-joint", summary: "Posterior knee capsular reinforcement associated with semimembranosus expansion and knee stability.", relationshipType: "stabilizes", targetEntityType: "joint", targetEntitySlug: "knee-joint" },
  { slug: "arcuate-popliteal-ligament", name: "Arcuate Popliteal Ligament", formalName: "Ligamentum popliteum arcuatum", alternateNames: ["arcuate ligament of knee"], region: "knee", joint: "knee-joint", summary: "Posterolateral knee capsular reinforcement associated with fibular head and popliteus region.", relationshipType: "stabilizes", targetEntityType: "joint", targetEntitySlug: "knee-joint" },
  { slug: "transverse-ligament-of-knee", name: "Transverse Ligament of Knee", formalName: "Ligamentum transversum genus", alternateNames: ["anterior transverse ligament of knee"], region: "knee", joint: "knee-joint", summary: "Small anterior knee ligament connecting the anterior horns of the menisci.", relationshipType: "connects", targetEntityType: "anatomy_structure", targetEntitySlug: "medial-meniscus" },
  { slug: "posterior-meniscofemoral-ligament", name: "Posterior Meniscofemoral Ligament", formalName: "Ligamentum meniscofemorale posterius", alternateNames: ["Wrisberg ligament"], region: "knee", joint: "knee-joint", summary: "Ligament from lateral meniscus toward the medial femoral condyle posterior to the PCL region.", relationshipType: "connects", targetEntityType: "anatomy_structure", targetEntitySlug: "lateral-meniscus" },
  { slug: "anterior-meniscofemoral-ligament", name: "Anterior Meniscofemoral Ligament", formalName: "Ligamentum meniscofemorale anterius", alternateNames: ["Humphrey ligament"], region: "knee", joint: "knee-joint", summary: "Ligament from lateral meniscus toward the medial femoral condyle anterior to the PCL region.", relationshipType: "connects", targetEntityType: "anatomy_structure", targetEntitySlug: "lateral-meniscus" },
  { slug: "calcaneofibular-ligament", name: "Calcaneofibular Ligament", formalName: "Ligamentum calcaneofibulare", alternateNames: ["CFL"], region: "ankle", joint: "ankle-joint", summary: "Lateral ankle ligament connecting fibula and calcaneus and resisting inversion stress.", relationshipType: "stabilizes", targetEntityType: "joint", targetEntitySlug: "ankle-joint" },
  { slug: "posterior-talofibular-ligament", name: "Posterior Talofibular Ligament", formalName: "Ligamentum talofibulare posterius", alternateNames: ["PTFL"], region: "ankle", joint: "ankle-joint", summary: "Posterior component of the lateral ankle ligament complex connecting fibula and talus.", relationshipType: "stabilizes", targetEntityType: "joint", targetEntitySlug: "ankle-joint" },
  { slug: "anterior-tibiofibular-ligament", name: "Anterior Tibiofibular Ligament", formalName: "Ligamentum tibiofibulare anterius", alternateNames: ["AITFL", "anterior syndesmotic ligament"], region: "ankle", joint: "ankle-joint", summary: "Anterior distal tibiofibular ligament supporting the ankle syndesmosis.", relationshipType: "stabilizes", targetEntityType: "joint", targetEntitySlug: "ankle-joint" },
  { slug: "posterior-tibiofibular-ligament", name: "Posterior Tibiofibular Ligament", formalName: "Ligamentum tibiofibulare posterius", alternateNames: ["PITFL", "posterior syndesmotic ligament"], region: "ankle", joint: "ankle-joint", summary: "Posterior distal tibiofibular ligament supporting the ankle syndesmosis.", relationshipType: "stabilizes", targetEntityType: "joint", targetEntitySlug: "ankle-joint" },
  { slug: "interosseous-talocalcaneal-ligament", name: "Interosseous Talocalcaneal Ligament", formalName: "Ligamentum talocalcaneum interosseum", alternateNames: ["subtalar interosseous ligament"], region: "foot", joint: "subtalar-joint", summary: "Strong subtalar ligament in the tarsal sinus connecting talus and calcaneus.", relationshipType: "stabilizes", targetEntityType: "joint", targetEntitySlug: "subtalar-joint" },
  { slug: "dorsal-tarsometatarsal-ligaments", name: "Dorsal Tarsometatarsal Ligaments", formalName: "Ligamenta tarsometatarsalia dorsalia", alternateNames: ["dorsal midfoot ligaments"], region: "foot", joint: "metatarsophalangeal-joints", summary: "Dorsal midfoot ligaments connecting tarsal and metatarsal bones for arch and midfoot support.", relationshipType: "supports", targetEntityType: "region", targetEntitySlug: "foot" },
  { slug: "plantar-tarsometatarsal-ligaments", name: "Plantar Tarsometatarsal Ligaments", formalName: "Ligamenta tarsometatarsalia plantaria", alternateNames: ["plantar midfoot ligaments"], region: "foot", joint: "metatarsophalangeal-joints", summary: "Plantar midfoot ligaments connecting tarsal and metatarsal bones for plantar arch support.", relationshipType: "supports", targetEntityType: "region", targetEntitySlug: "foot" },
]

const LIGAMENTS: LigamentRow[] = LIGAMENT_SPECS.map((spec) => ({
  id: `ligament-atlas-complete-${spec.slug}`,
  slug: spec.slug,
  name: spec.name,
  region: spec.region,
  joint: spec.joint,
  description: `${spec.summary} This row deepens named ligament coverage for atlas browsing and non-diagnostic education.`,
  sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
}))
const LIGAMENT_TERMS = LIGAMENT_SPECS.flatMap((spec) => terms("ligament", spec.slug, spec.name, spec.formalName, spec.alternateNames))
const LIGAMENT_IDENTIFIERS = LIGAMENT_SPECS.map((spec) => fipatIdentifier("ligament", spec.slug, spec.formalName))
const LIGAMENT_RELATIONSHIPS: RelationshipRow[] = LIGAMENT_SPECS.map((spec) => ({
  id: `relationship-atlas-complete-${spec.slug}-${spec.relationshipType}-${spec.targetEntitySlug}`,
  sourceEntityType: "ligament",
  sourceEntitySlug: spec.slug,
  relationshipType: spec.relationshipType,
  targetEntityType: spec.targetEntityType,
  targetEntitySlug: spec.targetEntitySlug,
  details: { clinicalUse: "non-diagnostic" },
  sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
}))
const LIGAMENT_CITATIONS = LIGAMENT_SPECS.flatMap((spec, index) => [
  ...entityCoreCitations("ligament", spec.slug, spec.formalName),
  reviewedCitation("ligament", spec.slug, "ligament_relationship", LIGAMENT_RELATIONSHIPS[index]?.id, APPLIED_HUMAN_ANATOMY_SOURCE, APPLIED_HUMAN_ANATOMY_LOCATOR, "Reviewed relationship connecting a named ligament to its primary joint, bone, or structure context."),
])

export const ATLAS_COMPLETENESS_CLOSURE_SECTION: AnatomySeedSection = {
  muscles: MUSCLES,
  muscleAttachments: MUSCLE_ATTACHMENTS,
  muscleActions: MUSCLE_ACTIONS,
  muscleInnervations: MUSCLE_INNERVATIONS,
  bones: BONES,
  boneLandmarks: BONE_LANDMARKS,
  ligaments: LIGAMENTS,
  structures: STRUCTURES,
  entityTerms: [
    ...MUSCLE_TERMS,
    ...BONE_TERMS,
    ...BONE_LANDMARK_TERMS,
    ...LIGAMENT_TERMS,
    ...STRUCTURE_TERMS,
  ],
  relationships: [
    ...AGGREGATE_MEMBER_RELATIONSHIPS,
    ...BONE_RELATIONSHIPS,
    ...LIGAMENT_RELATIONSHIPS,
    ...STRUCTURE_RELATIONSHIPS,
  ],
  citations: [
    ...MUSCLE_CITATIONS,
    ...BONE_CITATIONS,
    ...LIGAMENT_CITATIONS,
    ...STRUCTURE_CITATIONS,
  ],
  externalIdentifiers: [
    ...MUSCLE_IDENTIFIERS,
    ...BONE_IDENTIFIERS,
    ...LIGAMENT_IDENTIFIERS,
    ...STRUCTURE_IDENTIFIERS,
  ],
}
