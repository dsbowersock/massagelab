import type { AnatomySeedSection } from "./sections.ts"

const APPLIED_HUMAN_ANATOMY_SOURCE = "applied-human-anatomy"
const OPENSTAX_HUMAN_BIOLOGY_SOURCE = "openstax-human-biology"
const FIPAT_SOURCE = "fipat-ta2"
const CLIENT_LANGUAGE_SOURCE = "massagelab-authored-client-language"
const APPLIED_HUMAN_ANATOMY_LOCATOR = "https://open.umn.edu/opentextbooks/textbooks/1266"
const OPENSTAX_HUMAN_BIOLOGY_LOCATOR = "https://open.umn.edu/opentextbooks/textbooks/576"
const FIPAT_LOCATOR = "https://libraries.dal.ca/Fipat/ta2.html"
const CLIENT_LANGUAGE_LOCATOR = "MassageLab-authored body-map and client-language mapping policy, 2026-05-24"

type CitationRow = NonNullable<AnatomySeedSection["citations"]>[number]
type StructureRow = NonNullable<AnatomySeedSection["structures"]>[number]
type BloodSupplyRow = NonNullable<AnatomySeedSection["bloodSupply"]>[number]
type EntityTermRow = NonNullable<AnatomySeedSection["entityTerms"]>[number]
type RelationshipRow = NonNullable<AnatomySeedSection["relationships"]>[number]
type ClientTermRow = NonNullable<AnatomySeedSection["clientTerms"]>[number]

type AtlasStructureSpec = {
  slug: string
  name: string
  structureType: string
  region: string
  formalTerm: string
  officialLocator: string
  description: string
  commonTerms: string[]
  sourceRef: string
  sourceLocator: string
  citationNote: string
}

type AtlasBloodSupplySpec = {
  slug: string
  name: string
  kind: BloodSupplyRow["kind"]
  region: string
  formalTerm: string
  officialLocator: string
  description: string
  commonTerms: string[]
  sourceRef: string
  sourceLocator: string
  citationNote: string
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

const FASCIAL_STRUCTURE_SPECS: AtlasStructureSpec[] = [
  {
    slug: "brachial-fascia",
    name: "Brachial Fascia",
    structureType: "fascia",
    region: "arm",
    formalTerm: "Brachial fascia",
    officialLocator: "FIPAT TA2: Fascia brachii",
    description: "Brachial fascia is the deep fascial sleeve of the arm. It invests the anterior and posterior arm compartments, blends with intermuscular septa, and provides an important landmark for massage, movement, and body-map education.",
    commonTerms: ["arm fascia", "upper arm fascia"],
    sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
    sourceLocator: APPLIED_HUMAN_ANATOMY_LOCATOR,
    citationNote: "MassageLab-authored fascial summary verified against Applied Human Anatomy upper-limb fascial compartment material.",
  },
  {
    slug: "antebrachial-fascia",
    name: "Antebrachial Fascia",
    structureType: "fascia",
    region: "forearm",
    formalTerm: "Antebrachial fascia",
    officialLocator: "FIPAT TA2: Fascia antebrachii",
    description: "Antebrachial fascia is the deep fascial sleeve of the forearm. It encloses flexor and extensor muscle groups, continues toward the wrist retinacula, and supports client-language mapping for forearm tightness.",
    commonTerms: ["forearm fascia", "lower arm fascia"],
    sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
    sourceLocator: APPLIED_HUMAN_ANATOMY_LOCATOR,
    citationNote: "MassageLab-authored forearm fascia summary verified against Applied Human Anatomy upper-limb regional anatomy material.",
  },
  {
    slug: "clavipectoral-fascia",
    name: "Clavipectoral Fascia",
    structureType: "fascia",
    region: "shoulder-girdle",
    formalTerm: "Clavipectoral fascia",
    officialLocator: "FIPAT TA2: Fascia clavipectoralis",
    description: "Clavipectoral fascia is a deep anterior shoulder-girdle fascial layer related to subclavius, pectoralis minor, the clavicle, and the axillary passage. It helps connect chest, shoulder, and armpit anatomy for education.",
    commonTerms: ["deep front shoulder fascia", "front armpit fascia"],
    sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
    sourceLocator: APPLIED_HUMAN_ANATOMY_LOCATOR,
    citationNote: "MassageLab-authored clavipectoral fascia summary verified against Applied Human Anatomy pectoral and axillary region material.",
  },
  {
    slug: "fascia-lata",
    name: "Fascia Lata",
    structureType: "fascia",
    region: "thigh",
    formalTerm: "Fascia lata",
    officialLocator: "FIPAT TA2: Fascia lata",
    description: "Fascia lata is the deep fascial envelope of the thigh. It surrounds the thigh compartments, contributes to the iliotibial tract, and gives therapists a stable reference for lateral hip and thigh mapping.",
    commonTerms: ["thigh fascia", "deep thigh fascia"],
    sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
    sourceLocator: APPLIED_HUMAN_ANATOMY_LOCATOR,
    citationNote: "MassageLab-authored thigh fascia summary verified against Applied Human Anatomy lower-limb fascial anatomy material.",
  },
  {
    slug: "crural-fascia",
    name: "Crural Fascia",
    structureType: "fascia",
    region: "leg",
    formalTerm: "Crural fascia",
    officialLocator: "FIPAT TA2: Fascia cruris",
    description: "Crural fascia is the deep fascial envelope of the leg below the knee. It helps define anterior, lateral, and posterior leg compartments and supports body-map language around shin, calf, and outer-leg tightness.",
    commonTerms: ["leg fascia", "lower leg fascia", "shin and calf fascia"],
    sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
    sourceLocator: APPLIED_HUMAN_ANATOMY_LOCATOR,
    citationNote: "MassageLab-authored crural fascia summary verified against Applied Human Anatomy leg compartment material.",
  },
  {
    slug: "anterior-compartment-arm",
    name: "Anterior Compartment of Arm",
    structureType: "fascial_compartment",
    region: "arm",
    formalTerm: "Anterior compartment of arm",
    officialLocator: "FIPAT TA2: Anterior compartment of arm",
    description: "The anterior compartment of the arm contains the primary elbow flexor region, including biceps brachii and brachialis, with coracobrachialis proximally. It is useful for organizing arm muscle actions and SOAP tags.",
    commonTerms: ["front arm compartment", "anterior upper arm compartment"],
    sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
    sourceLocator: APPLIED_HUMAN_ANATOMY_LOCATOR,
    citationNote: "MassageLab-authored arm compartment summary verified against Applied Human Anatomy upper-limb compartment material.",
  },
  {
    slug: "posterior-compartment-arm",
    name: "Posterior Compartment of Arm",
    structureType: "fascial_compartment",
    region: "arm",
    formalTerm: "Posterior compartment of arm",
    officialLocator: "FIPAT TA2: Posterior compartment of arm",
    description: "The posterior compartment of the arm contains triceps brachii and related elbow-extension anatomy. It anchors back-of-arm body-map tags, flashcards, and movement prompts involving elbow extension.",
    commonTerms: ["back arm compartment", "posterior upper arm compartment"],
    sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
    sourceLocator: APPLIED_HUMAN_ANATOMY_LOCATOR,
    citationNote: "MassageLab-authored posterior arm compartment summary verified against Applied Human Anatomy upper-limb compartment material.",
  },
  {
    slug: "anterior-compartment-forearm",
    name: "Anterior Compartment of Forearm",
    structureType: "fascial_compartment",
    region: "forearm",
    formalTerm: "Anterior compartment of forearm",
    officialLocator: "FIPAT TA2: Anterior compartment of forearm",
    description: "The anterior compartment of the forearm contains flexor and pronator muscle layers that act on the wrist, fingers, thumb, and forearm. It supports forearm flexor mass education and SOAP tagging.",
    commonTerms: ["front forearm compartment", "forearm flexor compartment"],
    sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
    sourceLocator: APPLIED_HUMAN_ANATOMY_LOCATOR,
    citationNote: "MassageLab-authored forearm flexor compartment summary verified against Applied Human Anatomy upper-limb compartment material.",
  },
  {
    slug: "posterior-compartment-forearm",
    name: "Posterior Compartment of Forearm",
    structureType: "fascial_compartment",
    region: "forearm",
    formalTerm: "Posterior compartment of forearm",
    officialLocator: "FIPAT TA2: Posterior compartment of forearm",
    description: "The posterior compartment of the forearm contains extensor and supinator muscle groups that act on the wrist, fingers, thumb, and forearm. It supports top-of-forearm and wrist extensor education.",
    commonTerms: ["back forearm compartment", "forearm extensor compartment"],
    sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
    sourceLocator: APPLIED_HUMAN_ANATOMY_LOCATOR,
    citationNote: "MassageLab-authored forearm extensor compartment summary verified against Applied Human Anatomy upper-limb compartment material.",
  },
  {
    slug: "anterior-thigh-compartment",
    name: "Anterior Thigh Compartment",
    structureType: "fascial_compartment",
    region: "thigh",
    formalTerm: "Anterior compartment of thigh",
    officialLocator: "FIPAT TA2: Anterior compartment of thigh",
    description: "The anterior thigh compartment contains the quadriceps region and hip-flexor-adjacent anterior thigh muscles. It organizes knee extension, front thigh client language, and game prompts around the quadriceps.",
    commonTerms: ["front thigh compartment", "quadriceps compartment"],
    sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
    sourceLocator: APPLIED_HUMAN_ANATOMY_LOCATOR,
    citationNote: "MassageLab-authored anterior thigh compartment summary verified against Applied Human Anatomy lower-limb compartment material.",
  },
  {
    slug: "medial-thigh-compartment",
    name: "Medial Thigh Compartment",
    structureType: "fascial_compartment",
    region: "thigh",
    formalTerm: "Medial compartment of thigh",
    officialLocator: "FIPAT TA2: Medial compartment of thigh",
    description: "The medial thigh compartment contains the adductor region and related inner-thigh muscles. It supports adduction anatomy, inner-thigh client phrases, and regional SOAP tags without collapsing named muscles into one group.",
    commonTerms: ["inner thigh compartment", "adductor compartment"],
    sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
    sourceLocator: APPLIED_HUMAN_ANATOMY_LOCATOR,
    citationNote: "MassageLab-authored medial thigh compartment summary verified against Applied Human Anatomy lower-limb compartment material.",
  },
  {
    slug: "posterior-thigh-compartment",
    name: "Posterior Thigh Compartment",
    structureType: "fascial_compartment",
    region: "thigh",
    formalTerm: "Posterior compartment of thigh",
    officialLocator: "FIPAT TA2: Posterior compartment of thigh",
    description: "The posterior thigh compartment contains the hamstring muscle region, including biceps femoris, semitendinosus, and semimembranosus. It anchors posterior thigh education and body-map phrasing.",
    commonTerms: ["back thigh compartment", "hamstring compartment"],
    sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
    sourceLocator: APPLIED_HUMAN_ANATOMY_LOCATOR,
    citationNote: "MassageLab-authored posterior thigh compartment summary verified against Applied Human Anatomy lower-limb compartment material.",
  },
  {
    slug: "anterior-leg-compartment",
    name: "Anterior Leg Compartment",
    structureType: "fascial_compartment",
    region: "leg",
    formalTerm: "Anterior compartment of leg",
    officialLocator: "FIPAT TA2: Anterior compartment of leg",
    description: "The anterior leg compartment contains dorsiflexor and toe extensor muscles including tibialis anterior. It supports front-shin body maps, ankle movement flashcards, and lower-leg SOAP tags.",
    commonTerms: ["front shin compartment", "shin compartment", "dorsiflexor compartment"],
    sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
    sourceLocator: APPLIED_HUMAN_ANATOMY_LOCATOR,
    citationNote: "MassageLab-authored anterior leg compartment summary verified against Applied Human Anatomy lower-limb compartment material.",
  },
  {
    slug: "lateral-leg-compartment",
    name: "Lateral Leg Compartment",
    structureType: "fascial_compartment",
    region: "leg",
    formalTerm: "Lateral compartment of leg",
    officialLocator: "FIPAT TA2: Lateral compartment of leg",
    description: "The lateral leg compartment contains fibularis longus and brevis and supports eversion-related lower-leg education. It gives client-friendly mapping for outer leg tightness near the fibular muscle region.",
    commonTerms: ["outer leg compartment", "peroneal compartment", "fibular compartment"],
    sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
    sourceLocator: APPLIED_HUMAN_ANATOMY_LOCATOR,
    citationNote: "MassageLab-authored lateral leg compartment summary verified against Applied Human Anatomy lower-limb compartment material.",
  },
  {
    slug: "posterior-leg-compartment",
    name: "Posterior Leg Compartment",
    structureType: "fascial_compartment",
    region: "leg",
    formalTerm: "Posterior compartment of leg",
    officialLocator: "FIPAT TA2: Posterior compartment of leg",
    description: "The posterior leg compartment contains superficial and deep calf muscle regions, including gastrocnemius and soleus. It supports calf body-map language, plantar-flexion prompts, and lower-leg SOAP tags.",
    commonTerms: ["calf compartment", "back leg compartment", "posterior calf compartment"],
    sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
    sourceLocator: APPLIED_HUMAN_ANATOMY_LOCATOR,
    citationNote: "MassageLab-authored posterior leg compartment summary verified against Applied Human Anatomy lower-limb compartment material.",
  },
]

const LYMPHATIC_STRUCTURE_SPECS: AtlasStructureSpec[] = [
  {
    slug: "thoracic-duct",
    name: "Thoracic Duct",
    structureType: "lymphatic_duct",
    region: "thorax",
    formalTerm: "Thoracic duct",
    officialLocator: "FIPAT TA2: Ductus thoracicus",
    description: "The thoracic duct is the main lymphatic duct returning lymph from most of the body toward the venous angle near the left subclavian venous system. It anchors lymph drainage education for trunk and limb maps.",
    commonTerms: ["main lymph duct", "left lymphatic duct"],
    sourceRef: OPENSTAX_HUMAN_BIOLOGY_SOURCE,
    sourceLocator: OPENSTAX_HUMAN_BIOLOGY_LOCATOR,
    citationNote: "MassageLab-authored lymphatic duct summary verified against OpenStax Human Biology lymphatic system material.",
  },
  {
    slug: "right-lymphatic-duct",
    name: "Right Lymphatic Duct",
    structureType: "lymphatic_duct",
    region: "thorax",
    formalTerm: "Right lymphatic duct",
    officialLocator: "FIPAT TA2: Ductus lymphaticus dexter",
    description: "The right lymphatic duct returns lymph from the right upper quadrant region toward the venous angle near the right subclavian venous system. It supports side-specific drainage maps and therapist education.",
    commonTerms: ["right lymph duct", "right upper body lymph duct"],
    sourceRef: OPENSTAX_HUMAN_BIOLOGY_SOURCE,
    sourceLocator: OPENSTAX_HUMAN_BIOLOGY_LOCATOR,
    citationNote: "MassageLab-authored right lymphatic duct summary verified against OpenStax Human Biology lymphatic system material.",
  },
  {
    slug: "cisterna-chyli",
    name: "Cisterna Chyli",
    structureType: "lymphatic_sac",
    region: "abdomen",
    formalTerm: "Cisterna chyli",
    officialLocator: "FIPAT TA2: Cisterna chyli",
    description: "The cisterna chyli is an abdominal lymphatic collecting region at the origin of the thoracic duct. It helps organize lower-limb, pelvic, abdominal, and intestinal lymphatic drainage pathways.",
    commonTerms: ["abdominal lymph cistern", "lymph collecting sac"],
    sourceRef: OPENSTAX_HUMAN_BIOLOGY_SOURCE,
    sourceLocator: OPENSTAX_HUMAN_BIOLOGY_LOCATOR,
    citationNote: "MassageLab-authored cisterna chyli summary verified against OpenStax Human Biology lymphatic system material.",
  },
  {
    slug: "jugular-lymphatic-trunk",
    name: "Jugular Lymphatic Trunk",
    structureType: "lymphatic_trunk",
    region: "neck",
    formalTerm: "Jugular lymphatic trunk",
    officialLocator: "FIPAT TA2: Truncus jugularis",
    description: "The jugular lymphatic trunk drains lymph from head and neck lymphatic pathways toward terminal lymphatic ducts. It supports cervical, face, scalp, and jaw region drainage mapping for education.",
    commonTerms: ["neck lymph trunk", "head and neck lymph trunk"],
    sourceRef: OPENSTAX_HUMAN_BIOLOGY_SOURCE,
    sourceLocator: OPENSTAX_HUMAN_BIOLOGY_LOCATOR,
    citationNote: "MassageLab-authored jugular lymphatic trunk summary verified against OpenStax Human Biology lymphatic system material.",
  },
  {
    slug: "subclavian-lymphatic-trunk",
    name: "Subclavian Lymphatic Trunk",
    structureType: "lymphatic_trunk",
    region: "shoulder-girdle",
    formalTerm: "Subclavian lymphatic trunk",
    officialLocator: "FIPAT TA2: Truncus subclavius",
    description: "The subclavian lymphatic trunk drains upper-limb lymphatic pathways toward the terminal lymphatic ducts. It gives the database a named bridge between arm lymph nodes and central venous return.",
    commonTerms: ["upper limb lymph trunk", "arm lymph trunk"],
    sourceRef: OPENSTAX_HUMAN_BIOLOGY_SOURCE,
    sourceLocator: OPENSTAX_HUMAN_BIOLOGY_LOCATOR,
    citationNote: "MassageLab-authored subclavian lymphatic trunk summary verified against OpenStax Human Biology lymphatic system material.",
  },
  {
    slug: "bronchomediastinal-lymphatic-trunk",
    name: "Bronchomediastinal Lymphatic Trunk",
    structureType: "lymphatic_trunk",
    region: "thorax",
    formalTerm: "Bronchomediastinal lymphatic trunk",
    officialLocator: "FIPAT TA2: Truncus bronchomediastinalis",
    description: "The bronchomediastinal lymphatic trunk drains thoracic wall and mediastinal lymphatic pathways toward the terminal lymphatic ducts. It supports thorax and respiratory-system anatomy relationships.",
    commonTerms: ["chest lymph trunk", "thoracic lymph trunk"],
    sourceRef: OPENSTAX_HUMAN_BIOLOGY_SOURCE,
    sourceLocator: OPENSTAX_HUMAN_BIOLOGY_LOCATOR,
    citationNote: "MassageLab-authored bronchomediastinal lymphatic trunk summary verified against OpenStax Human Biology lymphatic system material.",
  },
  {
    slug: "intestinal-lymphatic-trunk",
    name: "Intestinal Lymphatic Trunk",
    structureType: "lymphatic_trunk",
    region: "abdomen",
    formalTerm: "Intestinal lymphatic trunk",
    officialLocator: "FIPAT TA2: Truncus intestinalis",
    description: "The intestinal lymphatic trunk drains digestive-organ lymphatic pathways toward the cisterna chyli and thoracic duct. It supports abdominal lymphatic education without entering microscopic lacteal detail.",
    commonTerms: ["gut lymph trunk", "intestinal lymph trunk"],
    sourceRef: OPENSTAX_HUMAN_BIOLOGY_SOURCE,
    sourceLocator: OPENSTAX_HUMAN_BIOLOGY_LOCATOR,
    citationNote: "MassageLab-authored intestinal lymphatic trunk summary verified against OpenStax Human Biology lymphatic system material.",
  },
  {
    slug: "lumbar-lymphatic-trunk",
    name: "Lumbar Lymphatic Trunk",
    structureType: "lymphatic_trunk",
    region: "abdomen",
    formalTerm: "Lumbar lymphatic trunk",
    officialLocator: "FIPAT TA2: Truncus lumbalis",
    description: "The lumbar lymphatic trunks drain lower-limb, pelvic, and posterior abdominal wall pathways toward the cisterna chyli. They help connect lower-body lymph regions to central drainage pathways.",
    commonTerms: ["lower body lymph trunk", "pelvic and leg lymph trunk"],
    sourceRef: OPENSTAX_HUMAN_BIOLOGY_SOURCE,
    sourceLocator: OPENSTAX_HUMAN_BIOLOGY_LOCATOR,
    citationNote: "MassageLab-authored lumbar lymphatic trunk summary verified against OpenStax Human Biology lymphatic system material.",
  },
  {
    slug: "cervical-lymph-nodes",
    name: "Cervical Lymph Nodes",
    structureType: "lymph_node_group",
    region: "neck",
    formalTerm: "Cervical lymph nodes",
    officialLocator: "FIPAT TA2: Nodi lymphoidei cervicales",
    description: "Cervical lymph nodes are grouped lymph nodes of the neck that receive drainage from head, neck, and nearby superficial tissues. They are included for anatomy education and lymphatic body-map context.",
    commonTerms: ["neck lymph nodes", "side neck lymph nodes"],
    sourceRef: OPENSTAX_HUMAN_BIOLOGY_SOURCE,
    sourceLocator: OPENSTAX_HUMAN_BIOLOGY_LOCATOR,
    citationNote: "MassageLab-authored cervical lymph node group summary verified against OpenStax Human Biology lymphatic system material.",
  },
  {
    slug: "axillary-lymph-nodes",
    name: "Axillary Lymph Nodes",
    structureType: "lymph_node_group",
    region: "shoulder-girdle",
    formalTerm: "Axillary lymph nodes",
    officialLocator: "FIPAT TA2: Nodi lymphoidei axillares",
    description: "Axillary lymph nodes are grouped lymph nodes of the armpit region that receive drainage from the upper limb, shoulder, and adjacent chest wall. They support armpit and upper-limb drainage maps.",
    commonTerms: ["armpit lymph nodes", "underarm lymph nodes"],
    sourceRef: OPENSTAX_HUMAN_BIOLOGY_SOURCE,
    sourceLocator: OPENSTAX_HUMAN_BIOLOGY_LOCATOR,
    citationNote: "MassageLab-authored axillary lymph node group summary verified against OpenStax Human Biology lymphatic system material.",
  },
  {
    slug: "inguinal-lymph-nodes",
    name: "Inguinal Lymph Nodes",
    structureType: "lymph_node_group",
    region: "hip",
    formalTerm: "Inguinal lymph nodes",
    officialLocator: "FIPAT TA2: Nodi lymphoidei inguinales",
    description: "Inguinal lymph nodes are grouped lymph nodes of the groin region that receive drainage from lower-limb and superficial lower-trunk pathways. They support groin and lower-limb lymph maps.",
    commonTerms: ["groin lymph nodes", "inguinal nodes"],
    sourceRef: OPENSTAX_HUMAN_BIOLOGY_SOURCE,
    sourceLocator: OPENSTAX_HUMAN_BIOLOGY_LOCATOR,
    citationNote: "MassageLab-authored inguinal lymph node group summary verified against OpenStax Human Biology lymphatic system material.",
  },
  {
    slug: "popliteal-lymph-nodes",
    name: "Popliteal Lymph Nodes",
    structureType: "lymph_node_group",
    region: "knee",
    formalTerm: "Popliteal lymph nodes",
    officialLocator: "FIPAT TA2: Nodi lymphoidei poplitei",
    description: "Popliteal lymph nodes are grouped lymph nodes behind the knee that receive drainage from parts of the leg and foot before pathways continue toward inguinal nodes. They support posterior knee lymph maps.",
    commonTerms: ["behind knee lymph nodes", "back of knee lymph nodes"],
    sourceRef: OPENSTAX_HUMAN_BIOLOGY_SOURCE,
    sourceLocator: OPENSTAX_HUMAN_BIOLOGY_LOCATOR,
    citationNote: "MassageLab-authored popliteal lymph node group summary verified against OpenStax Human Biology lymphatic system material.",
  },
]

const BLOOD_SUPPLY_SPECS: AtlasBloodSupplySpec[] = [
  {
    slug: "subclavian-vein",
    name: "Subclavian Vein",
    kind: "vein",
    region: "shoulder-girdle",
    formalTerm: "Subclavian vein",
    officialLocator: "FIPAT TA2: Vena subclavia",
    description: "The subclavian vein is a major deep vein beneath the clavicle that receives upper-limb venous return and forms a terminal drainage region for lymphatic ducts near the venous angle.",
    commonTerms: ["under collarbone vein", "subclavian venous return"],
    sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
    sourceLocator: APPLIED_HUMAN_ANATOMY_LOCATOR,
    citationNote: "MassageLab-authored subclavian vein summary verified against Applied Human Anatomy regional neck and upper-limb vessel material.",
  },
]

const STRUCTURE_SPECS = [...FASCIAL_STRUCTURE_SPECS, ...LYMPHATIC_STRUCTURE_SPECS]

const FASCIAL_LYMPHATIC_STRUCTURES: StructureRow[] = STRUCTURE_SPECS.map((spec) => ({
  id: `structure-${spec.slug}`,
  slug: spec.slug,
  name: spec.name,
  structureType: spec.structureType,
  region: spec.region,
  description: spec.description,
  sourceRef: spec.sourceRef,
}))

const FASCIAL_LYMPHATIC_BLOOD_SUPPLY: BloodSupplyRow[] = BLOOD_SUPPLY_SPECS.map((spec) => ({
  id: `blood-${spec.slug}`,
  slug: spec.slug,
  name: spec.name,
  kind: spec.kind,
  region: spec.region,
  description: spec.description,
  sourceRef: spec.sourceRef,
}))

const FASCIAL_LYMPHATIC_ENTITY_TERMS: EntityTermRow[] = [
  ...STRUCTURE_SPECS.flatMap((spec) => [
    {
      id: `term-structure-${spec.slug}-preferred-fipat`,
      anatomyEntityType: "anatomy_structure" as const,
      anatomyEntitySlug: spec.slug,
      term: spec.formalTerm,
      termType: "preferred" as const,
      sourceRef: FIPAT_SOURCE,
    },
    ...spec.commonTerms.map((term, index) => ({
      id: `term-structure-${spec.slug}-common-${index + 1}`,
      anatomyEntityType: "anatomy_structure" as const,
      anatomyEntitySlug: spec.slug,
      term,
      termType: "common" as const,
      sourceRef: spec.sourceRef,
    })),
  ]),
  ...BLOOD_SUPPLY_SPECS.flatMap((spec) => [
    {
      id: `term-blood-supply-${spec.slug}-preferred-fipat`,
      anatomyEntityType: "blood_supply" as const,
      anatomyEntitySlug: spec.slug,
      term: spec.formalTerm,
      termType: "preferred" as const,
      sourceRef: FIPAT_SOURCE,
    },
    ...spec.commonTerms.map((term, index) => ({
      id: `term-blood-supply-${spec.slug}-common-${index + 1}`,
      anatomyEntityType: "blood_supply" as const,
      anatomyEntitySlug: spec.slug,
      term,
      termType: "common" as const,
      sourceRef: spec.sourceRef,
    })),
  ]),
]

const FASCIAL_LYMPHATIC_RELATIONSHIPS: RelationshipRow[] = [
  { id: "relationship-brachial-fascia-invests-anterior-arm-compartment", sourceEntityType: "anatomy_structure", sourceEntitySlug: "brachial-fascia", relationshipType: "invests", targetEntityType: "anatomy_structure", targetEntitySlug: "anterior-compartment-arm", sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE },
  { id: "relationship-brachial-fascia-invests-posterior-arm-compartment", sourceEntityType: "anatomy_structure", sourceEntitySlug: "brachial-fascia", relationshipType: "invests", targetEntityType: "anatomy_structure", targetEntitySlug: "posterior-compartment-arm", sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE },
  { id: "relationship-antebrachial-fascia-invests-anterior-forearm", sourceEntityType: "anatomy_structure", sourceEntitySlug: "antebrachial-fascia", relationshipType: "invests", targetEntityType: "anatomy_structure", targetEntitySlug: "anterior-compartment-forearm", sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE },
  { id: "relationship-antebrachial-fascia-invests-posterior-forearm", sourceEntityType: "anatomy_structure", sourceEntitySlug: "antebrachial-fascia", relationshipType: "invests", targetEntityType: "anatomy_structure", targetEntitySlug: "posterior-compartment-forearm", sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE },
  { id: "relationship-clavipectoral-fascia-related-to-pectoralis-minor", sourceEntityType: "anatomy_structure", sourceEntitySlug: "clavipectoral-fascia", relationshipType: "related_to", targetEntityType: "muscle", targetEntitySlug: "pectoralis-minor", sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE },
  { id: "relationship-clavipectoral-fascia-related-to-subclavius", sourceEntityType: "anatomy_structure", sourceEntitySlug: "clavipectoral-fascia", relationshipType: "related_to", targetEntityType: "muscle", targetEntitySlug: "subclavius", sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE },
  { id: "relationship-fascia-lata-invests-anterior-thigh-compartment", sourceEntityType: "anatomy_structure", sourceEntitySlug: "fascia-lata", relationshipType: "invests", targetEntityType: "anatomy_structure", targetEntitySlug: "anterior-thigh-compartment", sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE },
  { id: "relationship-fascia-lata-invests-medial-thigh-compartment", sourceEntityType: "anatomy_structure", sourceEntitySlug: "fascia-lata", relationshipType: "invests", targetEntityType: "anatomy_structure", targetEntitySlug: "medial-thigh-compartment", sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE },
  { id: "relationship-fascia-lata-invests-posterior-thigh-compartment", sourceEntityType: "anatomy_structure", sourceEntitySlug: "fascia-lata", relationshipType: "invests", targetEntityType: "anatomy_structure", targetEntitySlug: "posterior-thigh-compartment", sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE },
  { id: "relationship-crural-fascia-invests-anterior-leg-compartment", sourceEntityType: "anatomy_structure", sourceEntitySlug: "crural-fascia", relationshipType: "invests", targetEntityType: "anatomy_structure", targetEntitySlug: "anterior-leg-compartment", sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE },
  { id: "relationship-crural-fascia-invests-lateral-leg-compartment", sourceEntityType: "anatomy_structure", sourceEntitySlug: "crural-fascia", relationshipType: "invests", targetEntityType: "anatomy_structure", targetEntitySlug: "lateral-leg-compartment", sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE },
  { id: "relationship-crural-fascia-invests-posterior-leg-compartment", sourceEntityType: "anatomy_structure", sourceEntitySlug: "crural-fascia", relationshipType: "invests", targetEntityType: "anatomy_structure", targetEntitySlug: "posterior-leg-compartment", sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE },
  { id: "relationship-anterior-arm-compartment-contains-biceps-brachii", sourceEntityType: "anatomy_structure", sourceEntitySlug: "anterior-compartment-arm", relationshipType: "contains", targetEntityType: "muscle", targetEntitySlug: "biceps-brachii", sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE },
  { id: "relationship-anterior-arm-compartment-contains-brachialis", sourceEntityType: "anatomy_structure", sourceEntitySlug: "anterior-compartment-arm", relationshipType: "contains", targetEntityType: "muscle", targetEntitySlug: "brachialis", sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE },
  { id: "relationship-posterior-arm-compartment-contains-triceps-brachii", sourceEntityType: "anatomy_structure", sourceEntitySlug: "posterior-compartment-arm", relationshipType: "contains", targetEntityType: "muscle", targetEntitySlug: "triceps-brachii", sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE },
  { id: "relationship-anterior-forearm-compartment-contains-pronator-teres", sourceEntityType: "anatomy_structure", sourceEntitySlug: "anterior-compartment-forearm", relationshipType: "contains", targetEntityType: "muscle", targetEntitySlug: "pronator-teres", sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE },
  { id: "relationship-posterior-forearm-compartment-contains-supinator", sourceEntityType: "anatomy_structure", sourceEntitySlug: "posterior-compartment-forearm", relationshipType: "contains", targetEntityType: "muscle", targetEntitySlug: "supinator", sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE },
  { id: "relationship-anterior-thigh-compartment-contains-rectus-femoris", sourceEntityType: "anatomy_structure", sourceEntitySlug: "anterior-thigh-compartment", relationshipType: "contains", targetEntityType: "muscle", targetEntitySlug: "rectus-femoris", sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE },
  { id: "relationship-medial-thigh-compartment-contains-adductor-longus", sourceEntityType: "anatomy_structure", sourceEntitySlug: "medial-thigh-compartment", relationshipType: "contains", targetEntityType: "muscle", targetEntitySlug: "adductor-longus", sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE },
  { id: "relationship-posterior-thigh-compartment-contains-biceps-femoris", sourceEntityType: "anatomy_structure", sourceEntitySlug: "posterior-thigh-compartment", relationshipType: "contains", targetEntityType: "muscle", targetEntitySlug: "biceps-femoris", sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE },
  { id: "relationship-anterior-leg-compartment-contains-tibialis-anterior", sourceEntityType: "anatomy_structure", sourceEntitySlug: "anterior-leg-compartment", relationshipType: "contains", targetEntityType: "muscle", targetEntitySlug: "tibialis-anterior", sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE },
  { id: "relationship-lateral-leg-compartment-contains-fibularis-longus", sourceEntityType: "anatomy_structure", sourceEntitySlug: "lateral-leg-compartment", relationshipType: "contains", targetEntityType: "muscle", targetEntitySlug: "fibularis-longus", sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE },
  { id: "relationship-posterior-leg-compartment-contains-gastrocnemius", sourceEntityType: "anatomy_structure", sourceEntitySlug: "posterior-leg-compartment", relationshipType: "contains", targetEntityType: "muscle", targetEntitySlug: "gastrocnemius", sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE },
  { id: "relationship-cisterna-chyli-drains-to-thoracic-duct", sourceEntityType: "anatomy_structure", sourceEntitySlug: "cisterna-chyli", relationshipType: "drains_to", targetEntityType: "anatomy_structure", targetEntitySlug: "thoracic-duct", sourceRef: OPENSTAX_HUMAN_BIOLOGY_SOURCE },
  { id: "relationship-lumbar-lymphatic-trunk-drains-to-cisterna-chyli", sourceEntityType: "anatomy_structure", sourceEntitySlug: "lumbar-lymphatic-trunk", relationshipType: "drains_to", targetEntityType: "anatomy_structure", targetEntitySlug: "cisterna-chyli", sourceRef: OPENSTAX_HUMAN_BIOLOGY_SOURCE },
  { id: "relationship-intestinal-lymphatic-trunk-drains-to-cisterna-chyli", sourceEntityType: "anatomy_structure", sourceEntitySlug: "intestinal-lymphatic-trunk", relationshipType: "drains_to", targetEntityType: "anatomy_structure", targetEntitySlug: "cisterna-chyli", sourceRef: OPENSTAX_HUMAN_BIOLOGY_SOURCE },
  { id: "relationship-thoracic-duct-drains-to-subclavian-vein", sourceEntityType: "anatomy_structure", sourceEntitySlug: "thoracic-duct", relationshipType: "drains_to", targetEntityType: "blood_supply", targetEntitySlug: "subclavian-vein", sourceRef: OPENSTAX_HUMAN_BIOLOGY_SOURCE },
  { id: "relationship-right-lymphatic-duct-drains-to-subclavian-vein", sourceEntityType: "anatomy_structure", sourceEntitySlug: "right-lymphatic-duct", relationshipType: "drains_to", targetEntityType: "blood_supply", targetEntitySlug: "subclavian-vein", sourceRef: OPENSTAX_HUMAN_BIOLOGY_SOURCE },
  { id: "relationship-jugular-lymphatic-trunk-drains-head-neck", sourceEntityType: "anatomy_structure", sourceEntitySlug: "jugular-lymphatic-trunk", relationshipType: "drains_region", targetEntityType: "region", targetEntitySlug: "head-neck", sourceRef: OPENSTAX_HUMAN_BIOLOGY_SOURCE },
  { id: "relationship-subclavian-lymphatic-trunk-drains-upper-limb", sourceEntityType: "anatomy_structure", sourceEntitySlug: "subclavian-lymphatic-trunk", relationshipType: "drains_region", targetEntityType: "region", targetEntitySlug: "upper-limb", sourceRef: OPENSTAX_HUMAN_BIOLOGY_SOURCE },
  { id: "relationship-bronchomediastinal-lymphatic-trunk-drains-thorax", sourceEntityType: "anatomy_structure", sourceEntitySlug: "bronchomediastinal-lymphatic-trunk", relationshipType: "drains_region", targetEntityType: "region", targetEntitySlug: "thorax", sourceRef: OPENSTAX_HUMAN_BIOLOGY_SOURCE },
  { id: "relationship-cervical-lymph-nodes-drain-neck", sourceEntityType: "anatomy_structure", sourceEntitySlug: "cervical-lymph-nodes", relationshipType: "drains_region", targetEntityType: "region", targetEntitySlug: "neck", sourceRef: OPENSTAX_HUMAN_BIOLOGY_SOURCE },
  { id: "relationship-axillary-lymph-nodes-drain-upper-limb", sourceEntityType: "anatomy_structure", sourceEntitySlug: "axillary-lymph-nodes", relationshipType: "drains_region", targetEntityType: "region", targetEntitySlug: "upper-limb", sourceRef: OPENSTAX_HUMAN_BIOLOGY_SOURCE },
  { id: "relationship-inguinal-lymph-nodes-drain-lower-limb", sourceEntityType: "anatomy_structure", sourceEntitySlug: "inguinal-lymph-nodes", relationshipType: "drains_region", targetEntityType: "region", targetEntitySlug: "lower-limb", sourceRef: OPENSTAX_HUMAN_BIOLOGY_SOURCE },
  { id: "relationship-popliteal-lymph-nodes-drain-leg-foot", sourceEntityType: "anatomy_structure", sourceEntitySlug: "popliteal-lymph-nodes", relationshipType: "drains_region", targetEntityType: "region", targetEntitySlug: "leg", sourceRef: OPENSTAX_HUMAN_BIOLOGY_SOURCE },
  { id: "relationship-popliteal-lymph-nodes-drain-to-inguinal-nodes", sourceEntityType: "anatomy_structure", sourceEntitySlug: "popliteal-lymph-nodes", relationshipType: "drains_to", targetEntityType: "anatomy_structure", targetEntitySlug: "inguinal-lymph-nodes", sourceRef: OPENSTAX_HUMAN_BIOLOGY_SOURCE },
]

const FASCIAL_LYMPHATIC_CLIENT_TERMS: ClientTermRow[] = [
  {
    id: "client-term-armpit-lymph-area",
    slug: "armpit-lymph-area",
    term: "armpit lymph area",
    plainLanguageDescription: "Client phrase for the axillary lymph-node region in the armpit and upper-limb drainage area.",
    mappedRegionSlug: "shoulder-girdle",
    mappedStructureSlug: "axillary-lymph-nodes",
    confidence: "broad",
    clinicalUse: "non-diagnostic",
    likelyRegions: ["shoulder-girdle", "upper-limb", "thorax"],
    likelyStructures: ["axillary-lymph-nodes", "subclavian-lymphatic-trunk", "clavipectoral-fascia"],
    therapistPrompt: "Clarify whether the client means armpit tissue, chest wall, upper arm, or a medical concern that needs referral.",
    sourceRef: CLIENT_LANGUAGE_SOURCE,
  },
  {
    id: "client-term-groin-lymph-area",
    slug: "groin-lymph-area",
    term: "groin lymph area",
    plainLanguageDescription: "Client phrase for the inguinal lymph-node region in the front hip and groin drainage area.",
    mappedRegionSlug: "hip",
    mappedStructureSlug: "inguinal-lymph-nodes",
    confidence: "broad",
    clinicalUse: "non-diagnostic",
    likelyRegions: ["hip", "pelvis", "lower-limb"],
    likelyStructures: ["inguinal-lymph-nodes", "lumbar-lymphatic-trunk", "fascia-lata"],
    therapistPrompt: "Clarify whether the client means groin crease, front hip, lower abdomen, inner thigh, or a medical concern that needs referral.",
    sourceRef: CLIENT_LANGUAGE_SOURCE,
  },
  {
    id: "client-term-front-shin-compartment-tightness",
    slug: "front-shin-compartment-tightness",
    term: "front shin compartment tightness",
    plainLanguageDescription: "Client phrase for anterior lower-leg tightness near tibialis anterior and the anterior leg compartment.",
    mappedRegionSlug: "leg",
    mappedStructureSlug: "anterior-leg-compartment",
    confidence: "likely",
    clinicalUse: "non-diagnostic",
    likelyRegions: ["leg", "ankle", "foot"],
    likelyStructures: ["anterior-leg-compartment", "tibialis-anterior", "crural-fascia"],
    therapistPrompt: "Clarify whether symptoms are exercise-related, neurological, vascular, or pressure-related before treating as simple muscle tightness.",
    sourceRef: CLIENT_LANGUAGE_SOURCE,
  },
  {
    id: "client-term-outer-leg-compartment-tightness",
    slug: "outer-leg-compartment-tightness",
    term: "outer leg compartment tightness",
    plainLanguageDescription: "Client phrase for lateral lower-leg tightness near the fibular muscle compartment.",
    mappedRegionSlug: "leg",
    mappedStructureSlug: "lateral-leg-compartment",
    confidence: "likely",
    clinicalUse: "non-diagnostic",
    likelyRegions: ["leg", "ankle", "foot"],
    likelyStructures: ["lateral-leg-compartment", "fibularis-longus", "fibularis-brevis", "crural-fascia"],
    therapistPrompt: "Clarify whether the client points to outer calf, fibular shaft, ankle tendons, or radiating symptoms.",
    sourceRef: CLIENT_LANGUAGE_SOURCE,
  },
  {
    id: "client-term-forearm-fascia-tightness",
    slug: "forearm-fascia-tightness",
    term: "forearm fascia tightness",
    plainLanguageDescription: "Client phrase for broad forearm fascial or muscle-group tightness rather than one named tendon or muscle.",
    mappedRegionSlug: "forearm",
    mappedStructureSlug: "antebrachial-fascia",
    confidence: "broad",
    clinicalUse: "non-diagnostic",
    likelyRegions: ["forearm", "wrist", "hand"],
    likelyStructures: ["antebrachial-fascia", "anterior-compartment-forearm", "posterior-compartment-forearm"],
    therapistPrompt: "Clarify whether the client means flexor side, extensor side, wrist retinacula, grip fatigue, or nerve-like symptoms.",
    sourceRef: CLIENT_LANGUAGE_SOURCE,
  },
]

const STRUCTURE_REVIEWED_CITATIONS: CitationRow[] = STRUCTURE_SPECS.flatMap((spec) => [
  reviewedCitation(
    "anatomy_structure",
    spec.slug,
    "official_term",
    `term-structure-${spec.slug}-preferred-fipat`,
    FIPAT_SOURCE,
    spec.officialLocator,
    "FIPAT TA2 official anatomical terminology used for the named fascial or lymphatic structure term row.",
  ),
  reviewedCitation(
    "anatomy_structure",
    spec.slug,
    "clinical_summary",
    `structure-${spec.slug}`,
    spec.sourceRef,
    spec.sourceLocator,
    spec.citationNote,
  ),
  sourceReferenceCitation(
    "anatomy_structure",
    spec.slug,
    `anatomy_structure:${spec.slug}`,
    spec.sourceRef,
    spec.sourceLocator,
    "Reviewed exact seed source reference for this named fascial or lymphatic structure row.",
  ),
])

const BLOOD_SUPPLY_REVIEWED_CITATIONS: CitationRow[] = BLOOD_SUPPLY_SPECS.flatMap((spec) => [
  reviewedCitation(
    "blood_supply",
    spec.slug,
    "official_term",
    `term-blood-supply-${spec.slug}-preferred-fipat`,
    FIPAT_SOURCE,
    spec.officialLocator,
    "FIPAT TA2 official anatomical terminology used for the named blood-vessel term row.",
  ),
  reviewedCitation(
    "blood_supply",
    spec.slug,
    "clinical_summary",
    `blood-${spec.slug}`,
    spec.sourceRef,
    spec.sourceLocator,
    spec.citationNote,
  ),
  sourceReferenceCitation(
    "blood_supply",
    spec.slug,
    `blood_supply:${spec.slug}`,
    spec.sourceRef,
    spec.sourceLocator,
    "Reviewed exact seed source reference for this named blood-supply row.",
  ),
])

const TERM_SOURCE_REFERENCE_CITATIONS: CitationRow[] = FASCIAL_LYMPHATIC_ENTITY_TERMS.map((term) => {
  const spec = STRUCTURE_SPECS.find((entry) => entry.slug === term.anatomyEntitySlug)
    ?? BLOOD_SUPPLY_SPECS.find((entry) => entry.slug === term.anatomyEntitySlug)
  const sourceLocator = term.sourceRef === FIPAT_SOURCE ? FIPAT_LOCATOR : (spec?.sourceLocator ?? APPLIED_HUMAN_ANATOMY_LOCATOR)

  return sourceReferenceCitation(
    term.anatomyEntityType,
    term.anatomyEntitySlug,
    `entity_term:${term.id}`,
    term.sourceRef,
    sourceLocator,
    "Reviewed exact seed source reference for this fascial, lymphatic, or blood-vessel terminology row.",
  )
})

const RELATIONSHIP_CITATIONS: CitationRow[] = FASCIAL_LYMPHATIC_RELATIONSHIPS.flatMap((relationship) => {
  const sourceLocator = relationship.sourceRef === OPENSTAX_HUMAN_BIOLOGY_SOURCE
    ? OPENSTAX_HUMAN_BIOLOGY_LOCATOR
    : APPLIED_HUMAN_ANATOMY_LOCATOR

  return [
    reviewedCitation(
      relationship.sourceEntityType,
      relationship.sourceEntitySlug,
      relationship.relationshipType.startsWith("drains") ? "lymphatic_drainage_relationship" : "structure_relationship",
      relationship.id,
      relationship.sourceRef,
      sourceLocator,
      relationship.relationshipType.startsWith("drains")
        ? "Lymphatic drainage relationship verified against OpenStax Human Biology lymphatic system material and mapped in MassageLab-authored terms."
        : "Fascial compartment relationship verified against Applied Human Anatomy regional anatomy material and mapped in MassageLab-authored terms.",
    ),
    sourceReferenceCitation(
      relationship.sourceEntityType,
      relationship.sourceEntitySlug,
      `relationship:${relationship.id}`,
      relationship.sourceRef,
      sourceLocator,
      "Reviewed exact seed source reference for this fascial compartment or lymphatic drainage relationship row.",
    ),
  ]
})

const CLIENT_TERM_SOURCE_REFERENCE_CITATIONS: CitationRow[] = FASCIAL_LYMPHATIC_CLIENT_TERMS.map((clientTerm) => sourceReferenceCitation(
  "client_term",
  clientTerm.slug,
  `client_term:${clientTerm.slug}`,
  clientTerm.sourceRef,
  CLIENT_LANGUAGE_LOCATOR,
  "Reviewed exact seed source reference for this MassageLab-authored fascia or lymphatic client-language row.",
))

const CLIENT_TERM_REVIEWED_CITATIONS: CitationRow[] = FASCIAL_LYMPHATIC_CLIENT_TERMS.flatMap((clientTerm) => [
  reviewedClientTermCitation(
    clientTerm.slug,
    "client_language",
    CLIENT_LANGUAGE_LOCATOR,
    "MassageLab-authored non-diagnostic client phrase reviewed for fascial compartment or lymphatic body-map language.",
  ),
  reviewedClientTermCitation(
    clientTerm.slug,
    "anatomy_mapping",
    CLIENT_LANGUAGE_LOCATOR,
    "MassageLab-authored client phrase mapped to normalized fascial compartment or lymphatic structure context.",
  ),
])

export const FASCIAL_LYMPHATIC_ATLAS_SECTION: AnatomySeedSection = {
  structures: FASCIAL_LYMPHATIC_STRUCTURES,
  bloodSupply: FASCIAL_LYMPHATIC_BLOOD_SUPPLY,
  clientTerms: FASCIAL_LYMPHATIC_CLIENT_TERMS,
  entityTerms: FASCIAL_LYMPHATIC_ENTITY_TERMS,
  relationships: FASCIAL_LYMPHATIC_RELATIONSHIPS,
  citations: [
    ...STRUCTURE_REVIEWED_CITATIONS,
    ...BLOOD_SUPPLY_REVIEWED_CITATIONS,
    ...TERM_SOURCE_REFERENCE_CITATIONS,
    ...RELATIONSHIP_CITATIONS,
    ...CLIENT_TERM_SOURCE_REFERENCE_CITATIONS,
    ...CLIENT_TERM_REVIEWED_CITATIONS,
  ],
}
