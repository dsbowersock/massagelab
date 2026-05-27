import type { AnatomySeedSection } from "./sections.ts"

const APPLIED_HUMAN_ANATOMY_SOURCE = "applied-human-anatomy"
const OPENSTAX_HUMAN_BIOLOGY_SOURCE = "openstax-human-biology"
const FIPAT_SOURCE = "fipat-ta2"
const APPLIED_HUMAN_ANATOMY_LOCATOR = "https://open.umn.edu/opentextbooks/textbooks/1266"
const OPENSTAX_HUMAN_BIOLOGY_LOCATOR = "https://open.umn.edu/opentextbooks/textbooks/576"
const FIPAT_LOCATOR = "https://libraries.dal.ca/Fipat/ta2.html"

type CitationRow = NonNullable<AnatomySeedSection["citations"]>[number]
type EntityTermRow = NonNullable<AnatomySeedSection["entityTerms"]>[number]
type ExternalIdentifierRow = NonNullable<AnatomySeedSection["externalIdentifiers"]>[number]
type RelationshipRow = NonNullable<AnatomySeedSection["relationships"]>[number]
type StructureRow = NonNullable<AnatomySeedSection["structures"]>[number]
type NerveRow = NonNullable<AnatomySeedSection["nerves"]>[number]
type BloodSupplyRow = NonNullable<AnatomySeedSection["bloodSupply"]>[number]

type StructureSpec = {
  slug: string
  name: string
  structureType: string
  region: string
  formalTerm: string
  officialLocator: string
  description: string
  commonTerms: string[]
  sourceRef: string
  relationshipType: string
  targetEntityType: RelationshipRow["targetEntityType"]
  targetEntitySlug: string
}

type NerveSpec = {
  slug: string
  name: string
  roots: string[]
  region: string
  formalTerm: string
  officialLocator: string
  description: string
  commonTerms: string[]
  relationshipType: string
  targetRegion: string
}

type VesselSpec = {
  slug: string
  name: string
  kind: BloodSupplyRow["kind"]
  region: string
  formalTerm: string
  officialLocator: string
  description: string
  commonTerms: string[]
  relationshipType: string
  targetEntitySlug: string
}

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

function sourceLocator(sourceRef: string) {
  return sourceRef === OPENSTAX_HUMAN_BIOLOGY_SOURCE
    ? OPENSTAX_HUMAN_BIOLOGY_LOCATOR
    : APPLIED_HUMAN_ANATOMY_LOCATOR
}

function reviewedCitation(
  entityType: CitationRow["entityType"],
  entitySlug: string,
  factType: string,
  factSlug: string,
  sourceRef: string,
  locator: string,
  note: string,
) {
  const slug = `citation-atlas-depth-${slugify(entityType)}-${entitySlug}-${slugify(factType)}-${slugify(factSlug)}`

  return {
    id: slug,
    slug,
    entityType,
    entitySlug,
    factType,
    factSlug,
    sourceRef,
    sourceLocator: locator,
    citationNote: note,
    reviewStatus: "reviewed",
  } satisfies CitationRow
}

function fipatIdentifier(entityType: ExternalIdentifierRow["entityType"], entitySlug: string, formalTerm: string, officialLocator: string) {
  return {
    id: `external-atlas-depth-${slugify(entityType)}-${entitySlug}-fipat`,
    entityType,
    entitySlug,
    provider: "FIPAT",
    identifier: officialLocator,
    iri: `${FIPAT_LOCATOR}#${slugify(officialLocator)}`,
    label: formalTerm,
    sourceRef: FIPAT_SOURCE,
  } satisfies ExternalIdentifierRow
}

function termRows(entityType: EntityTermRow["anatomyEntityType"], entitySlug: string, formalTerm: string, commonTerms: string[], sourceRef: string) {
  return [
    {
      id: `term-atlas-depth-${slugify(entityType)}-${entitySlug}-preferred`,
      anatomyEntityType: entityType,
      anatomyEntitySlug: entitySlug,
      term: formalTerm,
      termType: "formal" as const,
      languageOfOrigin: "Latin/English",
      sourceRef: FIPAT_SOURCE,
    },
    ...commonTerms.map((term) => ({
      id: `term-atlas-depth-${slugify(entityType)}-${entitySlug}-common-${slugify(term)}`,
      anatomyEntityType: entityType,
      anatomyEntitySlug: entitySlug,
      term,
      termType: "common" as const,
      notes: "MassageLab-authored practical search term for atlas browsing, SOAP tags, and body-map education.",
      sourceRef,
    })),
  ] satisfies EntityTermRow[]
}

function coreCitations(entityType: CitationRow["entityType"], entitySlug: string, entityId: string, sourceRef: string, officialLocator: string, identifierId: string, note: string) {
  return [
    reviewedCitation(entityType, entitySlug, "clinical_summary", entityId, sourceRef, sourceLocator(sourceRef), note),
    reviewedCitation(entityType, entitySlug, "official_term", `term-atlas-depth-${slugify(entityType)}-${entitySlug}-preferred`, FIPAT_SOURCE, officialLocator, "FIPAT TA2 official terminology anchor used for the preferred anatomical term."),
    reviewedCitation(entityType, entitySlug, "external_identifier", identifierId, FIPAT_SOURCE, officialLocator, "FIPAT TA2 locator used as a commercial-safe terminology identifier."),
  ] satisfies CitationRow[]
}

const TOOTH_NAMES = [
  [1, "maxillary", "right", "third molar", "upper right wisdom tooth"],
  [2, "maxillary", "right", "second molar", "upper right second molar"],
  [3, "maxillary", "right", "first molar", "upper right first molar"],
  [4, "maxillary", "right", "second premolar", "upper right second premolar"],
  [5, "maxillary", "right", "first premolar", "upper right first premolar"],
  [6, "maxillary", "right", "canine", "upper right canine"],
  [7, "maxillary", "right", "lateral incisor", "upper right lateral incisor"],
  [8, "maxillary", "right", "central incisor", "upper right central incisor"],
  [9, "maxillary", "left", "central incisor", "upper left central incisor"],
  [10, "maxillary", "left", "lateral incisor", "upper left lateral incisor"],
  [11, "maxillary", "left", "canine", "upper left canine"],
  [12, "maxillary", "left", "first premolar", "upper left first premolar"],
  [13, "maxillary", "left", "second premolar", "upper left second premolar"],
  [14, "maxillary", "left", "first molar", "upper left first molar"],
  [15, "maxillary", "left", "second molar", "upper left second molar"],
  [16, "maxillary", "left", "third molar", "upper left wisdom tooth"],
  [17, "mandibular", "left", "third molar", "lower left wisdom tooth"],
  [18, "mandibular", "left", "second molar", "lower left second molar"],
  [19, "mandibular", "left", "first molar", "lower left first molar"],
  [20, "mandibular", "left", "second premolar", "lower left second premolar"],
  [21, "mandibular", "left", "first premolar", "lower left first premolar"],
  [22, "mandibular", "left", "canine", "lower left canine"],
  [23, "mandibular", "left", "lateral incisor", "lower left lateral incisor"],
  [24, "mandibular", "left", "central incisor", "lower left central incisor"],
  [25, "mandibular", "right", "central incisor", "lower right central incisor"],
  [26, "mandibular", "right", "lateral incisor", "lower right lateral incisor"],
  [27, "mandibular", "right", "canine", "lower right canine"],
  [28, "mandibular", "right", "first premolar", "lower right first premolar"],
  [29, "mandibular", "right", "second premolar", "lower right second premolar"],
  [30, "mandibular", "right", "first molar", "lower right first molar"],
  [31, "mandibular", "right", "second molar", "lower right second molar"],
  [32, "mandibular", "right", "third molar", "lower right wisdom tooth"],
] as const

const TOOTH_SPECS: StructureSpec[] = TOOTH_NAMES.map(([number, arch, side, toothType, commonTerm]) => {
  const upperArch = arch === "maxillary"
  const formalTerm = `${arch[0].toUpperCase()}${arch.slice(1)} ${side} ${toothType} tooth`
  const slug = `tooth-${number}-${arch}-${side}-${toothType.replace(/\s+/g, "-")}`

  return {
    slug,
    name: `Tooth ${number}: ${formalTerm}`,
    structureType: "tooth",
    region: "jaw",
    formalTerm,
    officialLocator: `FIPAT TA2: ${formalTerm}`,
    description: `Tooth ${number} is the ${side} ${toothType} in the ${arch} adult dental arch. It gives the atlas a first-class tooth record for jaw education, client-friendly oral anatomy language, and future dental-region body-map references.`,
    commonTerms: [commonTerm, `tooth ${number}`, `${side} ${toothType}`],
    sourceRef: OPENSTAX_HUMAN_BIOLOGY_SOURCE,
    relationshipType: "member_of",
    targetEntityType: "anatomy_structure",
    targetEntitySlug: upperArch ? "upper-teeth" : "lower-teeth",
  }
})

const CUTANEOUS_NERVE_SPECS: NerveSpec[] = [
  { slug: "greater-occipital-nerve", name: "Greater Occipital Nerve", roots: ["C2 dorsal ramus"], region: "head-neck", formalTerm: "Greater occipital nerve", officialLocator: "FIPAT TA2: Nervus occipitalis major", description: "The greater occipital nerve is a cutaneous branch from the C2 dorsal ramus supplying posterior scalp sensation. It is useful for base-of-skull, posterior neck, and headache-adjacent anatomy education without making diagnostic claims.", commonTerms: ["back of head nerve", "posterior scalp nerve"], relationshipType: "supplies_cutaneous_region", targetRegion: "base-of-skull" },
  { slug: "lesser-occipital-nerve", name: "Lesser Occipital Nerve", roots: ["C2"], region: "head-neck", formalTerm: "Lesser occipital nerve", officialLocator: "FIPAT TA2: Nervus occipitalis minor", description: "The lesser occipital nerve is a superficial cervical plexus branch supplying the posterolateral scalp and upper neck region. It helps map client language around the side of the head and upper neck.", commonTerms: ["side back of head nerve"], relationshipType: "supplies_cutaneous_region", targetRegion: "posterior-neck" },
  { slug: "great-auricular-nerve", name: "Great Auricular Nerve", roots: ["C2", "C3"], region: "neck", formalTerm: "Great auricular nerve", officialLocator: "FIPAT TA2: Nervus auricularis magnus", description: "The great auricular nerve is a superficial cervical plexus branch that supplies skin over the parotid, auricle, and angle-of-mandible region. It supports lateral neck, jaw, and ear-region atlas browsing.", commonTerms: ["ear and jaw angle nerve"], relationshipType: "supplies_cutaneous_region", targetRegion: "neck" },
  { slug: "transverse-cervical-nerve", name: "Transverse Cervical Nerve", roots: ["C2", "C3"], region: "neck", formalTerm: "Transverse cervical nerve", officialLocator: "FIPAT TA2: Nervus transversus colli", description: "The transverse cervical nerve is a superficial cervical plexus branch crossing the anterior neck to supply skin in the front of the neck. It improves anterior neck sensory mapping for education and SOAP tags.", commonTerms: ["front neck skin nerve"], relationshipType: "supplies_cutaneous_region", targetRegion: "anterior-neck" },
  { slug: "supraclavicular-nerves", name: "Supraclavicular Nerves", roots: ["C3", "C4"], region: "neck", formalTerm: "Supraclavicular nerves", officialLocator: "FIPAT TA2: Nervi supraclaviculares", description: "The supraclavicular nerves are superficial cervical plexus branches supplying skin over the clavicle, upper chest, and shoulder cap region. They support top-of-shoulder and collarbone-area mapping.", commonTerms: ["collarbone skin nerves", "top of shoulder skin nerves"], relationshipType: "supplies_cutaneous_region", targetRegion: "shoulder-girdle" },
  { slug: "medial-antebrachial-cutaneous-nerve", name: "Medial Antebrachial Cutaneous Nerve", roots: ["C8", "T1"], region: "forearm", formalTerm: "Medial antebrachial cutaneous nerve", officialLocator: "FIPAT TA2: Nervus cutaneus antebrachii medialis", description: "The medial antebrachial cutaneous nerve supplies skin of the medial forearm. It gives the upper-limb atlas a named sensory branch for inner forearm body-map and SOAP tag language.", commonTerms: ["inner forearm skin nerve"], relationshipType: "supplies_cutaneous_region", targetRegion: "forearm" },
  { slug: "lateral-antebrachial-cutaneous-nerve", name: "Lateral Antebrachial Cutaneous Nerve", roots: ["C5", "C6", "C7"], region: "forearm", formalTerm: "Lateral antebrachial cutaneous nerve", officialLocator: "FIPAT TA2: Nervus cutaneus antebrachii lateralis", description: "The lateral antebrachial cutaneous nerve is the terminal sensory continuation of musculocutaneous nerve supplying lateral forearm skin. It supports outer forearm sensory-region anatomy.", commonTerms: ["outer forearm skin nerve"], relationshipType: "supplies_cutaneous_region", targetRegion: "forearm" },
  { slug: "medial-brachial-cutaneous-nerve", name: "Medial Brachial Cutaneous Nerve", roots: ["C8", "T1"], region: "arm", formalTerm: "Medial brachial cutaneous nerve", officialLocator: "FIPAT TA2: Nervus cutaneus brachii medialis", description: "The medial brachial cutaneous nerve supplies skin of the medial arm and axillary-adjacent region. It improves upper arm sensory mapping without confusing sensory branches with motor muscle innervation.", commonTerms: ["inner upper arm skin nerve"], relationshipType: "supplies_cutaneous_region", targetRegion: "arm" },
]

const VESSEL_BRANCH_SPECS: VesselSpec[] = [
  { slug: "left-gastric-artery", name: "Left Gastric Artery", kind: "artery", region: "abdomen", formalTerm: "Left gastric artery", officialLocator: "FIPAT TA2: Arteria gastrica sinistra", description: "The left gastric artery is a branch of the celiac trunk supplying the lesser-curvature region of the stomach and adjacent esophagus. It deepens abdominal vascular mapping for digestive-system education.", commonTerms: ["stomach artery"], relationshipType: "branches_from", targetEntitySlug: "celiac-trunk" },
  { slug: "splenic-artery", name: "Splenic Artery", kind: "artery", region: "abdomen", formalTerm: "Splenic artery", officialLocator: "FIPAT TA2: Arteria splenica", description: "The splenic artery is a tortuous celiac trunk branch supplying the spleen, pancreatic branches, and gastric-adjacent vessels. It supports upper-left abdominal vascular and organ relationship mapping.", commonTerms: ["spleen artery"], relationshipType: "branches_from", targetEntitySlug: "celiac-trunk" },
  { slug: "common-hepatic-artery", name: "Common Hepatic Artery", kind: "artery", region: "abdomen", formalTerm: "Common hepatic artery", officialLocator: "FIPAT TA2: Arteria hepatica communis", description: "The common hepatic artery is a celiac trunk branch that contributes arterial supply to the liver, stomach, duodenum, and pancreas through named branches. It anchors upper-abdominal arterial branching.", commonTerms: ["liver arterial trunk"], relationshipType: "branches_from", targetEntitySlug: "celiac-trunk" },
  { slug: "gastroduodenal-artery", name: "Gastroduodenal Artery", kind: "artery", region: "abdomen", formalTerm: "Gastroduodenal artery", officialLocator: "FIPAT TA2: Arteria gastroduodenalis", description: "The gastroduodenal artery arises from the common hepatic pathway and supplies stomach, duodenum, and pancreatic-adjacent regions through branches. It improves named branch detail for abdominal anatomy.", commonTerms: ["stomach and duodenum artery"], relationshipType: "branches_from", targetEntitySlug: "common-hepatic-artery" },
  { slug: "superior-rectal-artery", name: "Superior Rectal Artery", kind: "artery", region: "pelvis", formalTerm: "Superior rectal artery", officialLocator: "FIPAT TA2: Arteria rectalis superior", description: "The superior rectal artery is the terminal continuation of the inferior mesenteric arterial pathway toward the rectum. It supports pelvis and digestive-tract vascular continuity in the atlas.", commonTerms: ["upper rectal artery"], relationshipType: "branches_from", targetEntitySlug: "inferior-mesenteric-artery" },
  { slug: "middle-rectal-artery", name: "Middle Rectal Artery", kind: "artery", region: "pelvis", formalTerm: "Middle rectal artery", officialLocator: "FIPAT TA2: Arteria rectalis media", description: "The middle rectal artery commonly arises from internal iliac branches and contributes to rectal and pelvic-floor-adjacent blood supply. It gives pelvic anatomy a named macrovascular branch.", commonTerms: ["middle rectum artery"], relationshipType: "branches_from", targetEntitySlug: "internal-iliac-artery" },
  { slug: "inferior-rectal-artery", name: "Inferior Rectal Artery", kind: "artery", region: "pelvis", formalTerm: "Inferior rectal artery", officialLocator: "FIPAT TA2: Arteria rectalis inferior", description: "The inferior rectal artery branches from the internal pudendal pathway and supplies the anal canal and perineal-adjacent region. It supports pelvic floor and perineal vascular atlas detail.", commonTerms: ["lower rectal artery"], relationshipType: "branches_from", targetEntitySlug: "internal-pudendal-artery" },
  { slug: "posterior-auricular-artery", name: "Posterior Auricular Artery", kind: "artery", region: "head", formalTerm: "Posterior auricular artery", officialLocator: "FIPAT TA2: Arteria auricularis posterior", description: "The posterior auricular artery is an external carotid branch supplying regions behind the ear and adjacent scalp. It supports ear, mastoid, and lateral scalp vascular orientation.", commonTerms: ["behind the ear artery"], relationshipType: "branches_from", targetEntitySlug: "external-carotid-artery" },
]

const LYMPH_NODE_SPECS: StructureSpec[] = [
  { slug: "occipital-lymph-nodes", name: "Occipital Lymph Nodes", structureType: "lymph_node_group", region: "head", formalTerm: "Occipital lymph nodes", officialLocator: "FIPAT TA2: Nodi lymphoidei occipitales", description: "Occipital lymph nodes are posterior scalp lymph node groups that drain toward cervical lymph pathways. They provide named lymphatic context for the back of the head and upper neck.", commonTerms: ["back of head lymph nodes"], sourceRef: OPENSTAX_HUMAN_BIOLOGY_SOURCE, relationshipType: "drains_to", targetEntityType: "anatomy_structure", targetEntitySlug: "deep-cervical-lymph-nodes" },
  { slug: "mastoid-lymph-nodes", name: "Mastoid Lymph Nodes", structureType: "lymph_node_group", region: "head", formalTerm: "Mastoid lymph nodes", officialLocator: "FIPAT TA2: Nodi lymphoidei mastoidei", description: "Mastoid lymph nodes lie near the mastoid and posterior auricular region and drain scalp and ear-adjacent tissues toward cervical pathways. They support ear and side-head lymph maps.", commonTerms: ["behind ear lymph nodes"], sourceRef: OPENSTAX_HUMAN_BIOLOGY_SOURCE, relationshipType: "drains_to", targetEntityType: "anatomy_structure", targetEntitySlug: "deep-cervical-lymph-nodes" },
  { slug: "parotid-lymph-nodes", name: "Parotid Lymph Nodes", structureType: "lymph_node_group", region: "face", formalTerm: "Parotid lymph nodes", officialLocator: "FIPAT TA2: Nodi lymphoidei parotidei", description: "Parotid lymph nodes are facial lymph node groups near the parotid gland and lateral face. They help organize drainage from scalp, eyelid, external ear, and lateral face regions.", commonTerms: ["side face lymph nodes"], sourceRef: OPENSTAX_HUMAN_BIOLOGY_SOURCE, relationshipType: "drains_to", targetEntityType: "anatomy_structure", targetEntitySlug: "deep-cervical-lymph-nodes" },
  { slug: "submandibular-lymph-nodes", name: "Submandibular Lymph Nodes", structureType: "lymph_node_group", region: "jaw", formalTerm: "Submandibular lymph nodes", officialLocator: "FIPAT TA2: Nodi lymphoidei submandibulares", description: "Submandibular lymph nodes lie beneath the mandible and receive drainage from much of the face, mouth, and jaw-adjacent structures. They are important for client-friendly jaw and neck lymph education.", commonTerms: ["under jaw lymph nodes"], sourceRef: OPENSTAX_HUMAN_BIOLOGY_SOURCE, relationshipType: "drains_to", targetEntityType: "anatomy_structure", targetEntitySlug: "deep-cervical-lymph-nodes" },
  { slug: "submental-lymph-nodes", name: "Submental Lymph Nodes", structureType: "lymph_node_group", region: "jaw", formalTerm: "Submental lymph nodes", officialLocator: "FIPAT TA2: Nodi lymphoidei submentales", description: "Submental lymph nodes sit below the chin and receive lymph from lower lip, chin, anterior oral floor, and anterior tongue-adjacent regions. They support front-of-jaw lymph mapping.", commonTerms: ["under chin lymph nodes"], sourceRef: OPENSTAX_HUMAN_BIOLOGY_SOURCE, relationshipType: "drains_to", targetEntityType: "anatomy_structure", targetEntitySlug: "submandibular-lymph-nodes" },
  { slug: "pectoral-axillary-lymph-nodes", name: "Pectoral Axillary Lymph Nodes", structureType: "lymph_node_group", region: "shoulder-girdle", formalTerm: "Pectoral axillary lymph nodes", officialLocator: "FIPAT TA2: Nodi lymphoidei pectorales", description: "Pectoral axillary lymph nodes are anterior axillary nodes associated with chest wall and breast-adjacent lymph drainage. They improve shoulder, chest, and axillary lymph pathway detail.", commonTerms: ["front armpit lymph nodes"], sourceRef: OPENSTAX_HUMAN_BIOLOGY_SOURCE, relationshipType: "drains_to", targetEntityType: "anatomy_structure", targetEntitySlug: "central-axillary-lymph-nodes" },
  { slug: "humeral-axillary-lymph-nodes", name: "Humeral Axillary Lymph Nodes", structureType: "lymph_node_group", region: "shoulder-girdle", formalTerm: "Humeral axillary lymph nodes", officialLocator: "FIPAT TA2: Nodi lymphoidei humerales", description: "Humeral axillary lymph nodes are lateral axillary nodes associated with upper-limb lymph drainage. They support arm-to-axilla drainage maps for massage education.", commonTerms: ["lateral armpit lymph nodes"], sourceRef: OPENSTAX_HUMAN_BIOLOGY_SOURCE, relationshipType: "drains_to", targetEntityType: "anatomy_structure", targetEntitySlug: "central-axillary-lymph-nodes" },
  { slug: "central-axillary-lymph-nodes", name: "Central Axillary Lymph Nodes", structureType: "lymph_node_group", region: "shoulder-girdle", formalTerm: "Central axillary lymph nodes", officialLocator: "FIPAT TA2: Nodi lymphoidei centrales", description: "Central axillary lymph nodes receive lymph from other axillary node groups and pass it toward apical axillary pathways. They anchor armpit lymph-drainage organization.", commonTerms: ["central armpit lymph nodes"], sourceRef: OPENSTAX_HUMAN_BIOLOGY_SOURCE, relationshipType: "drains_to", targetEntityType: "anatomy_structure", targetEntitySlug: "apical-axillary-lymph-nodes" },
  { slug: "apical-axillary-lymph-nodes", name: "Apical Axillary Lymph Nodes", structureType: "lymph_node_group", region: "shoulder-girdle", formalTerm: "Apical axillary lymph nodes", officialLocator: "FIPAT TA2: Nodi lymphoidei apicales", description: "Apical axillary lymph nodes sit high in the axilla and drain toward the subclavian lymphatic trunk. They connect upper-limb and chest lymph pathways to central lymphatic return.", commonTerms: ["top armpit lymph nodes"], sourceRef: OPENSTAX_HUMAN_BIOLOGY_SOURCE, relationshipType: "drains_to", targetEntityType: "anatomy_structure", targetEntitySlug: "subclavian-lymphatic-trunk" },
]

const EXISTING_TENDON_STRUCTURE_SPECS: StructureSpec[] = [
  { slug: "patellar-tendon", name: "Patellar Tendon", structureType: "tendon", region: "knee", formalTerm: "Patellar ligament", officialLocator: "FIPAT TA2: Ligamentum patellae", description: "The patellar tendon, also called the patellar ligament, connects the patella to the tibial tuberosity and continues the quadriceps extensor mechanism across the front of the knee.", commonTerms: ["patellar ligament", "front knee tendon"], sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE, relationshipType: "associated_with", targetEntityType: "joint", targetEntitySlug: "knee-joint" },
  { slug: "quadriceps-tendon", name: "Quadriceps Tendon", structureType: "tendon", region: "knee", formalTerm: "Quadriceps tendon", officialLocator: "FIPAT TA2: Tendo musculi quadricipitis femoris", description: "The quadriceps tendon connects the quadriceps femoris muscle group to the patella and continues into the patellar tendon pathway. It is central to knee extension education.", commonTerms: ["front thigh tendon"], sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE, relationshipType: "associated_with", targetEntityType: "joint", targetEntitySlug: "knee-joint" },
  { slug: "common-extensor-tendon", name: "Common Extensor Tendon", structureType: "tendon", region: "elbow", formalTerm: "Common extensor tendon", officialLocator: "FIPAT TA2: Common extensor tendon", description: "The common extensor tendon arises from the lateral epicondyle region and gives shared proximal attachment to several wrist and finger extensor muscles. It supports lateral elbow education.", commonTerms: ["tennis elbow tendon", "lateral elbow tendon"], sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE, relationshipType: "associated_with", targetEntityType: "bone_landmark", targetEntitySlug: "lateral-epicondyle-humerus" },
  { slug: "common-flexor-tendon", name: "Common Flexor Tendon", structureType: "tendon", region: "elbow", formalTerm: "Common flexor tendon", officialLocator: "FIPAT TA2: Common flexor tendon", description: "The common flexor tendon arises from the medial epicondyle region and gives shared proximal attachment to several wrist and finger flexor-pronator muscles. It supports medial elbow education.", commonTerms: ["golfer elbow tendon", "medial elbow tendon"], sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE, relationshipType: "associated_with", targetEntityType: "bone_landmark", targetEntitySlug: "medial-epicondyle-humerus" },
  { slug: "palmar-aponeurosis", name: "Palmar Aponeurosis", structureType: "fascia", region: "hand", formalTerm: "Palmar aponeurosis", officialLocator: "FIPAT TA2: Aponeurosis palmaris", description: "The palmar aponeurosis is a strong fascial sheet in the palm that helps organize palmar skin, fascia, and tendon relationships. It supports hand surface anatomy and client-language mapping.", commonTerms: ["palm fascia", "palmar fascia"], sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE, relationshipType: "associated_with", targetEntityType: "region", targetEntitySlug: "hand" },
]

const NEW_TENDON_STRUCTURE_SPECS: StructureSpec[] = [
  { slug: "plantar-plate", name: "Plantar Plate", structureType: "fibrocartilage", region: "foot", formalTerm: "Plantar plates", officialLocator: "FIPAT TA2: Fibrocartilagines plantares", description: "The plantar plates are fibrocartilaginous supports on the plantar side of metatarsophalangeal joints. They deepen toe-joint support anatomy for foot education.", commonTerms: ["toe joint plantar plate", "ball of foot plate"], sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE, relationshipType: "associated_with", targetEntityType: "joint", targetEntitySlug: "metatarsophalangeal-joints" },
]

const NEW_STRUCTURE_SPECS = [...TOOTH_SPECS, ...LYMPH_NODE_SPECS, ...NEW_TENDON_STRUCTURE_SPECS]
const STRUCTURE_DETAIL_SPECS = [...NEW_STRUCTURE_SPECS, ...EXISTING_TENDON_STRUCTURE_SPECS]

const STRUCTURES = NEW_STRUCTURE_SPECS.map((spec): StructureRow => ({
  id: `structure-${spec.slug}`,
  slug: spec.slug,
  name: spec.name,
  structureType: spec.structureType,
  region: spec.region,
  description: spec.description,
  sourceRef: spec.sourceRef,
}))

const NERVES = CUTANEOUS_NERVE_SPECS.map((spec): NerveRow => ({
  id: `nerve-${spec.slug}`,
  slug: spec.slug,
  name: spec.name,
  nerveRoots: spec.roots,
  region: spec.region,
  description: spec.description,
  sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
}))

const BLOOD_SUPPLY = VESSEL_BRANCH_SPECS.map((spec): BloodSupplyRow => ({
  id: `blood-${spec.slug}`,
  slug: spec.slug,
  name: spec.name,
  kind: spec.kind,
  region: spec.region,
  description: spec.description,
  sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
}))

const STRUCTURE_RELATIONSHIPS = STRUCTURE_DETAIL_SPECS.map((spec): RelationshipRow => ({
  id: `relationship-${spec.slug}-${spec.relationshipType}-${spec.targetEntitySlug}`,
  sourceEntityType: "anatomy_structure",
  sourceEntitySlug: spec.slug,
  relationshipType: spec.relationshipType,
  targetEntityType: spec.targetEntityType,
  targetEntitySlug: spec.targetEntitySlug,
  details: { atlasUse: "atlas depth expansion", region: spec.region },
  sourceRef: spec.sourceRef,
}))

const NERVE_RELATIONSHIPS = CUTANEOUS_NERVE_SPECS.map((spec): RelationshipRow => ({
  id: `relationship-${spec.slug}-${spec.relationshipType}-${spec.targetRegion}`,
  sourceEntityType: "nerve",
  sourceEntitySlug: spec.slug,
  relationshipType: spec.relationshipType,
  targetEntityType: "region",
  targetEntitySlug: spec.targetRegion,
  details: { atlasUse: "cutaneous sensory pathway", nerveRoots: spec.roots },
  sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
}))

const VESSEL_RELATIONSHIPS = VESSEL_BRANCH_SPECS.map((spec): RelationshipRow => ({
  id: `relationship-${spec.slug}-${spec.relationshipType}-${spec.targetEntitySlug}`,
  sourceEntityType: "blood_supply",
  sourceEntitySlug: spec.slug,
  relationshipType: spec.relationshipType,
  targetEntityType: "blood_supply",
  targetEntitySlug: spec.targetEntitySlug,
  details: { atlasUse: "named vessel branch", region: spec.region },
  sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
}))

const ENTITY_TERMS = [
  ...STRUCTURE_DETAIL_SPECS.flatMap((spec) => termRows("anatomy_structure", spec.slug, spec.formalTerm, spec.commonTerms, spec.sourceRef)),
  ...CUTANEOUS_NERVE_SPECS.flatMap((spec) => termRows("nerve", spec.slug, spec.formalTerm, spec.commonTerms, APPLIED_HUMAN_ANATOMY_SOURCE)),
  ...VESSEL_BRANCH_SPECS.flatMap((spec) => termRows("blood_supply", spec.slug, spec.formalTerm, spec.commonTerms, APPLIED_HUMAN_ANATOMY_SOURCE)),
]

const EXTERNAL_IDENTIFIERS = [
  ...STRUCTURE_DETAIL_SPECS.map((spec) => fipatIdentifier("anatomy_structure", spec.slug, spec.formalTerm, spec.officialLocator)),
  ...CUTANEOUS_NERVE_SPECS.map((spec) => fipatIdentifier("nerve", spec.slug, spec.formalTerm, spec.officialLocator)),
  ...VESSEL_BRANCH_SPECS.map((spec) => fipatIdentifier("blood_supply", spec.slug, spec.formalTerm, spec.officialLocator)),
]

const CITATIONS = [
  ...STRUCTURE_DETAIL_SPECS.flatMap((spec) => coreCitations(
    "anatomy_structure",
    spec.slug,
    `structure-${spec.slug}`,
    spec.sourceRef,
    spec.officialLocator,
    `external-atlas-depth-anatomy-structure-${spec.slug}-fipat`,
    spec.sourceRef === OPENSTAX_HUMAN_BIOLOGY_SOURCE
      ? "MassageLab-authored structure summary verified against OpenStax Human Biology oral and lymphatic-system material."
      : "MassageLab-authored structure summary verified against Applied Human Anatomy regional anatomy material.",
  )),
  ...CUTANEOUS_NERVE_SPECS.flatMap((spec) => coreCitations(
    "nerve",
    spec.slug,
    `nerve-${spec.slug}`,
    APPLIED_HUMAN_ANATOMY_SOURCE,
    spec.officialLocator,
    `external-atlas-depth-nerve-${spec.slug}-fipat`,
    "MassageLab-authored cutaneous nerve summary verified against Applied Human Anatomy peripheral nerve and regional sensory anatomy material.",
  )),
  ...VESSEL_BRANCH_SPECS.flatMap((spec) => coreCitations(
    "blood_supply",
    spec.slug,
    `blood-${spec.slug}`,
    APPLIED_HUMAN_ANATOMY_SOURCE,
    spec.officialLocator,
    `external-atlas-depth-blood-supply-${spec.slug}-fipat`,
    "MassageLab-authored vessel branch summary verified against Applied Human Anatomy regional vascular anatomy material.",
  )),
]

export const ATLAS_DEPTH_EXPANSION_SECTION: AnatomySeedSection = {
  structures: STRUCTURES,
  nerves: NERVES,
  bloodSupply: BLOOD_SUPPLY,
  entityTerms: ENTITY_TERMS,
  relationships: [
    ...STRUCTURE_RELATIONSHIPS,
    ...NERVE_RELATIONSHIPS,
    ...VESSEL_RELATIONSHIPS,
  ],
  citations: CITATIONS,
  externalIdentifiers: EXTERNAL_IDENTIFIERS,
}
