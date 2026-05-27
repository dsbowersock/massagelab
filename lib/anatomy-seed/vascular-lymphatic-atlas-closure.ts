import type { AnatomySeedSection } from "./sections.ts"

const APPLIED_HUMAN_ANATOMY_SOURCE = "applied-human-anatomy"
const OPENSTAX_HUMAN_BIOLOGY_SOURCE = "openstax-human-biology"
const FIPAT_SOURCE = "fipat-ta2"
const APPLIED_HUMAN_ANATOMY_LOCATOR = "https://open.umn.edu/opentextbooks/textbooks/1266"
const OPENSTAX_HUMAN_BIOLOGY_LOCATOR = "https://open.umn.edu/opentextbooks/textbooks/576"
const FIPAT_LOCATOR = "https://libraries.dal.ca/Fipat/ta2.html"

type BloodSupplyRow = NonNullable<AnatomySeedSection["bloodSupply"]>[number]
type StructureRow = NonNullable<AnatomySeedSection["structures"]>[number]
type EntityTermRow = NonNullable<AnatomySeedSection["entityTerms"]>[number]
type RelationshipRow = NonNullable<AnatomySeedSection["relationships"]>[number]
type CitationRow = NonNullable<AnatomySeedSection["citations"]>[number]
type ExternalIdentifierRow = NonNullable<AnatomySeedSection["externalIdentifiers"]>[number]

type VascularSpec = {
  slug: string
  name: string
  kind: BloodSupplyRow["kind"]
  region: string
  formalTerm: string
  officialLocator: string
  description: string
  commonTerms: string[]
  relationType: string
  relationTargetType: RelationshipRow["targetEntityType"]
  relationTargetSlug: string
}

type LymphSpec = {
  slug: string
  name: string
  structureType: string
  region: string
  formalTerm: string
  officialLocator: string
  description: string
  commonTerms: string[]
  relationType: string
  relationTargetType: RelationshipRow["targetEntityType"]
  relationTargetSlug: string
}

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

function sourceForStructure(structureType: string) {
  return structureType.includes("lymph") || structureType.includes("venous")
    ? OPENSTAX_HUMAN_BIOLOGY_SOURCE
    : APPLIED_HUMAN_ANATOMY_SOURCE
}

function locatorForSource(sourceRef: string) {
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
  sourceLocator: string,
  citationNote: string,
) {
  const slug = `citation-vascular-lymphatic-${slugify(entityType)}-${entitySlug}-${slugify(factType)}-${slugify(factSlug)}`

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

function fipatIdentifier(entityType: ExternalIdentifierRow["entityType"], entitySlug: string, label: string, locator: string) {
  const idSlug = `external-vascular-lymphatic-${slugify(entityType)}-${entitySlug}-fipat`

  return {
    id: idSlug,
    entityType,
    entitySlug,
    provider: "FIPAT",
    identifier: locator,
    iri: `${FIPAT_LOCATOR}#${slugify(locator)}`,
    label,
    sourceRef: FIPAT_SOURCE,
  } satisfies ExternalIdentifierRow
}

function entityTerms(
  entityType: EntityTermRow["anatomyEntityType"],
  entitySlug: string,
  formalTerm: string,
  commonTerms: string[],
  sourceRef: string,
) {
  return [
    {
      id: `term-vascular-lymphatic-${slugify(entityType)}-${entitySlug}-preferred`,
      anatomyEntityType: entityType,
      anatomyEntitySlug: entitySlug,
      term: formalTerm,
      termType: "preferred" as const,
      languageOfOrigin: "Latin/English",
      sourceRef: FIPAT_SOURCE,
    },
    ...commonTerms.map((term) => ({
      id: `term-vascular-lymphatic-${slugify(entityType)}-${entitySlug}-common-${slugify(term)}`,
      anatomyEntityType: entityType,
      anatomyEntitySlug: entitySlug,
      term,
      termType: "common" as const,
      notes: "MassageLab-authored practical search term for browsing, SOAP tags, and body-map education.",
      sourceRef,
    })),
  ] satisfies EntityTermRow[]
}

function entityCoreCitations(
  entityType: CitationRow["entityType"],
  entitySlug: string,
  entityId: string,
  sourceRef: string,
  officialLocator: string,
  identifierId: string,
  citationNote: string,
) {
  return [
    reviewedCitation(entityType, entitySlug, "clinical_summary", entityId, sourceRef, locatorForSource(sourceRef), citationNote),
    reviewedCitation(entityType, entitySlug, "official_term", `term-vascular-lymphatic-${slugify(entityType)}-${entitySlug}-preferred`, FIPAT_SOURCE, officialLocator, "FIPAT TA2 official terminology anchor used for the preferred anatomical term."),
    reviewedCitation(entityType, entitySlug, "external_identifier", identifierId, FIPAT_SOURCE, officialLocator, "FIPAT TA2 locator used as a commercial-safe terminology identifier."),
  ] satisfies CitationRow[]
}

const VASCULAR_SPECS: VascularSpec[] = [
  { slug: "brachiocephalic-trunk", name: "Brachiocephalic Trunk", kind: "artery", region: "thorax", formalTerm: "Brachiocephalic trunk", officialLocator: "FIPAT TA2: Truncus brachiocephalicus", description: "The brachiocephalic trunk is the first large branch of the aortic arch and gives rise to the right common carotid and right subclavian arterial pathways. It anchors right head, neck, and upper-limb arterial mapping.", commonTerms: ["brachiocephalic artery", "right head and arm arterial trunk"], relationType: "branches_to", relationTargetType: "blood_supply", relationTargetSlug: "subclavian-artery" },
  { slug: "celiac-trunk", name: "Celiac Trunk", kind: "artery", region: "abdomen", formalTerm: "Celiac trunk", officialLocator: "FIPAT TA2: Truncus coeliacus", description: "The celiac trunk is an anterior branch of the abdominal aorta supplying upper abdominal organs through gastric, splenic, and hepatic branch pathways. It supports abdominal vascular and organ-relationship education.", commonTerms: ["celiac artery", "upper abdominal arterial trunk"], relationType: "branches_from", relationTargetType: "blood_supply", relationTargetSlug: "abdominal-aorta" },
  { slug: "superior-mesenteric-artery", name: "Superior Mesenteric Artery", kind: "artery", region: "abdomen", formalTerm: "Superior mesenteric artery", officialLocator: "FIPAT TA2: Arteria mesenterica superior", description: "The superior mesenteric artery is a major abdominal aortic branch supplying much of the small intestine and proximal large intestine. It gives the digestive-system atlas a clear midgut vascular landmark.", commonTerms: ["SMA", "midgut artery"], relationType: "branches_from", relationTargetType: "blood_supply", relationTargetSlug: "abdominal-aorta" },
  { slug: "inferior-mesenteric-artery", name: "Inferior Mesenteric Artery", kind: "artery", region: "abdomen", formalTerm: "Inferior mesenteric artery", officialLocator: "FIPAT TA2: Arteria mesenterica inferior", description: "The inferior mesenteric artery arises from the abdominal aorta and supplies distal large-intestine regions. It supports colon, pelvis-adjacent, and abdominal vascular reference paths.", commonTerms: ["IMA", "hindgut artery"], relationType: "branches_from", relationTargetType: "blood_supply", relationTargetSlug: "abdominal-aorta" },
  { slug: "renal-arteries", name: "Renal Arteries", kind: "artery", region: "abdomen", formalTerm: "Renal arteries", officialLocator: "FIPAT TA2: Arteriae renales", description: "The renal arteries are paired branches of the abdominal aorta that supply the kidneys. They provide a named macrovascular reference for urinary-system anatomy and abdominal body-map context.", commonTerms: ["kidney arteries"], relationType: "branches_from", relationTargetType: "blood_supply", relationTargetSlug: "abdominal-aorta" },
  { slug: "gonadal-arteries", name: "Gonadal Arteries", kind: "artery", region: "abdomen", formalTerm: "Testicular or ovarian arteries", officialLocator: "FIPAT TA2: Arteriae testiculares / ovaricae", description: "The gonadal arteries are paired abdominal aortic branches supplying the testes or ovaries. They are useful for whole-body vascular completeness while staying separate from diagnostic reproductive content.", commonTerms: ["testicular arteries", "ovarian arteries"], relationType: "branches_from", relationTargetType: "blood_supply", relationTargetSlug: "abdominal-aorta" },
  { slug: "pulmonary-trunk", name: "Pulmonary Trunk", kind: "artery", region: "thorax", formalTerm: "Pulmonary trunk", officialLocator: "FIPAT TA2: Truncus pulmonalis", description: "The pulmonary trunk carries blood from the right ventricle toward the pulmonary arteries. It is essential for heart-lung circulation education and for distinguishing pulmonary from systemic arterial pathways.", commonTerms: ["main pulmonary artery"], relationType: "branches_to", relationTargetType: "blood_supply", relationTargetSlug: "pulmonary-arteries" },
  { slug: "pulmonary-arteries", name: "Pulmonary Arteries", kind: "artery", region: "thorax", formalTerm: "Pulmonary arteries", officialLocator: "FIPAT TA2: Arteriae pulmonales", description: "The pulmonary arteries branch from the pulmonary trunk to carry blood toward the lungs for gas exchange. They support cardiopulmonary physiology education and lung circulation mapping.", commonTerms: ["lung arteries"], relationType: "branches_from", relationTargetType: "blood_supply", relationTargetSlug: "pulmonary-trunk" },
  { slug: "pulmonary-veins", name: "Pulmonary Veins", kind: "vein", region: "thorax", formalTerm: "Pulmonary veins", officialLocator: "FIPAT TA2: Venae pulmonales", description: "The pulmonary veins return oxygenated blood from the lungs to the left atrium. They are major thoracic veins needed for complete cardiopulmonary circulation and physiology prompts.", commonTerms: ["lung veins"], relationType: "drains_from", relationTargetType: "anatomy_structure", relationTargetSlug: "lung" },
  { slug: "coronary-arteries", name: "Coronary Arteries", kind: "artery", region: "thorax", formalTerm: "Coronary arteries", officialLocator: "FIPAT TA2: Arteriae coronariae", description: "The coronary arteries arise from the ascending aorta and supply the myocardium. They provide a macrovascular anchor for heart anatomy, physiology, and client-friendly cardiovascular education.", commonTerms: ["heart arteries"], relationType: "supplies", relationTargetType: "anatomy_structure", relationTargetSlug: "heart" },
  { slug: "cardiac-veins", name: "Cardiac Veins", kind: "vein", region: "thorax", formalTerm: "Cardiac veins", officialLocator: "FIPAT TA2: Venae cardiacae", description: "The cardiac veins drain the myocardium toward the coronary sinus and right atrium. They provide venous complement to the coronary arteries for heart circulation mapping.", commonTerms: ["heart veins"], relationType: "drains", relationTargetType: "anatomy_structure", relationTargetSlug: "heart" },
  { slug: "brachiocephalic-veins", name: "Brachiocephalic Veins", kind: "vein", region: "thorax", formalTerm: "Brachiocephalic veins", officialLocator: "FIPAT TA2: Venae brachiocephalicae", description: "The brachiocephalic veins are paired large veins formed by jugular and subclavian venous drainage. They unite to form the superior vena cava and anchor head, neck, and upper-limb venous return.", commonTerms: ["innominate veins"], relationType: "drains_to", relationTargetType: "blood_supply", relationTargetSlug: "superior-vena-cava" },
  { slug: "azygos-vein", name: "Azygos Vein", kind: "vein", region: "thorax", formalTerm: "Azygos vein", officialLocator: "FIPAT TA2: Vena azygos", description: "The azygos vein drains much of the posterior thoracic wall and communicates with abdominal venous pathways before emptying into the superior vena cava. It supports back and thoracic drainage education.", commonTerms: ["posterior thorax vein"], relationType: "drains_to", relationTargetType: "blood_supply", relationTargetSlug: "superior-vena-cava" },
  { slug: "hemiazygos-vein", name: "Hemiazygos Vein", kind: "vein", region: "thorax", formalTerm: "Hemiazygos vein", officialLocator: "FIPAT TA2: Vena hemiazygos", description: "The hemiazygos vein drains part of the left posterior thoracic wall and typically communicates with the azygos pathway. It improves left posterior thorax venous mapping.", commonTerms: ["left posterior thorax vein"], relationType: "drains_to", relationTargetType: "blood_supply", relationTargetSlug: "azygos-vein" },
  { slug: "hepatic-veins", name: "Hepatic Veins", kind: "vein", region: "abdomen", formalTerm: "Hepatic veins", officialLocator: "FIPAT TA2: Venae hepaticae", description: "The hepatic veins drain the liver into the inferior vena cava. They complete a major abdominal venous pathway for liver, portal circulation, and trunk physiology education.", commonTerms: ["liver veins"], relationType: "drains_to", relationTargetType: "blood_supply", relationTargetSlug: "inferior-vena-cava" },
  { slug: "renal-veins", name: "Renal Veins", kind: "vein", region: "abdomen", formalTerm: "Renal veins", officialLocator: "FIPAT TA2: Venae renales", description: "The renal veins drain the kidneys into the inferior vena cava. They provide the venous counterpart to renal arteries for urinary-system and abdominal vascular mapping.", commonTerms: ["kidney veins"], relationType: "drains_to", relationTargetType: "blood_supply", relationTargetSlug: "inferior-vena-cava" },
  { slug: "common-iliac-veins", name: "Common Iliac Veins", kind: "vein", region: "pelvis", formalTerm: "Common iliac veins", officialLocator: "FIPAT TA2: Venae iliacae communes", description: "The common iliac veins receive internal and external iliac drainage and unite to form the inferior vena cava. They anchor pelvic and lower-limb venous return pathways.", commonTerms: ["main pelvic veins"], relationType: "drains_to", relationTargetType: "blood_supply", relationTargetSlug: "inferior-vena-cava" },
  { slug: "internal-iliac-vein", name: "Internal Iliac Vein", kind: "vein", region: "pelvis", formalTerm: "Internal iliac vein", officialLocator: "FIPAT TA2: Vena iliaca interna", description: "The internal iliac vein drains pelvic walls, gluteal regions, and pelvic organs toward the common iliac vein. It supports pelvis, hip, and pelvic-floor drainage reference.", commonTerms: ["pelvic vein"], relationType: "drains_to", relationTargetType: "blood_supply", relationTargetSlug: "common-iliac-veins" },
  { slug: "external-iliac-vein", name: "External Iliac Vein", kind: "vein", region: "pelvis", formalTerm: "External iliac vein", officialLocator: "FIPAT TA2: Vena iliaca externa", description: "The external iliac vein continues from the femoral vein and drains lower-limb venous return toward the common iliac vein. It is a key transition vessel from thigh to pelvis.", commonTerms: ["lower limb pelvic vein"], relationType: "drains_to", relationTargetType: "blood_supply", relationTargetSlug: "common-iliac-veins" },
  { slug: "axillary-vein", name: "Axillary Vein", kind: "vein", region: "shoulder-girdle", formalTerm: "Axillary vein", officialLocator: "FIPAT TA2: Vena axillaris", description: "The axillary vein drains the upper limb and axillary region and continues toward the subclavian vein. It provides a major venous anchor for shoulder, arm, and armpit anatomy.", commonTerms: ["armpit vein"], relationType: "drains_to", relationTargetType: "blood_supply", relationTargetSlug: "subclavian-vein" },
  { slug: "median-cubital-vein", name: "Median Cubital Vein", kind: "vein", region: "elbow", formalTerm: "Median cubital vein", officialLocator: "FIPAT TA2: Vena mediana cubiti", description: "The median cubital vein is a superficial vein in the anterior elbow region connecting cephalic and basilic venous pathways. It is a key surface anatomy landmark for the cubital fossa.", commonTerms: ["front elbow vein"], relationType: "connects_to", relationTargetType: "blood_supply", relationTargetSlug: "cephalic-vein" },
  { slug: "dorsal-venous-network-hand", name: "Dorsal Venous Network of Hand", kind: "vein", region: "hand", formalTerm: "Dorsal venous network of hand", officialLocator: "FIPAT TA2: Rete venosum dorsale manus", description: "The dorsal venous network of the hand drains superficial veins across the back of the hand toward forearm venous pathways. It supports hand surface anatomy and body-map reference.", commonTerms: ["back of hand veins"], relationType: "drains_to", relationTargetType: "blood_supply", relationTargetSlug: "cephalic-vein" },
  { slug: "dorsal-venous-arch-foot", name: "Dorsal Venous Arch of Foot", kind: "vein", region: "foot", formalTerm: "Dorsal venous arch of foot", officialLocator: "FIPAT TA2: Arcus venosus dorsalis pedis", description: "The dorsal venous arch of the foot drains superficial veins across the dorsum of the foot toward saphenous venous pathways. It supports foot and ankle surface anatomy mapping.", commonTerms: ["top of foot veins"], relationType: "drains_to", relationTargetType: "blood_supply", relationTargetSlug: "great-saphenous-vein" },
]

const LYMPH_SPECS: LymphSpec[] = [
  { slug: "right-venous-angle", name: "Right Venous Angle", structureType: "venous_junction", region: "neck", formalTerm: "Right venous angle", officialLocator: "FIPAT TA2: Angulus venosus dexter", description: "The right venous angle is the junction region of the right internal jugular and right subclavian veins where the right lymphatic duct drains. It helps explain upper-right quadrant lymph return.", commonTerms: ["right lymph drainage junction"], relationType: "receives_lymph_from", relationTargetType: "anatomy_structure", relationTargetSlug: "right-lymphatic-duct" },
  { slug: "left-venous-angle", name: "Left Venous Angle", structureType: "venous_junction", region: "neck", formalTerm: "Left venous angle", officialLocator: "FIPAT TA2: Angulus venosus sinister", description: "The left venous angle is the junction region of the left internal jugular and left subclavian veins where the thoracic duct drains. It anchors the main lymphatic return pathway.", commonTerms: ["left lymph drainage junction"], relationType: "receives_lymph_from", relationTargetType: "anatomy_structure", relationTargetSlug: "thoracic-duct" },
  { slug: "superficial-cervical-lymph-nodes", name: "Superficial Cervical Lymph Nodes", structureType: "lymph_node_group", region: "neck", formalTerm: "Superficial cervical lymph nodes", officialLocator: "FIPAT TA2: Nodi lymphoidei cervicales superficiales", description: "Superficial cervical lymph nodes are lymph node groups in the superficial neck region related to drainage from scalp, face, and neck tissues. They support client-friendly neck lymph education.", commonTerms: ["surface neck lymph nodes"], relationType: "drains_to", relationTargetType: "anatomy_structure", relationTargetSlug: "deep-cervical-lymph-nodes" },
  { slug: "deep-cervical-lymph-nodes", name: "Deep Cervical Lymph Nodes", structureType: "lymph_node_group", region: "neck", formalTerm: "Deep cervical lymph nodes", officialLocator: "FIPAT TA2: Nodi lymphoidei cervicales profundi", description: "Deep cervical lymph nodes form major neck drainage chains along deep cervical vessels and contribute to jugular lymphatic trunk pathways. They are central to head and neck lymph mapping.", commonTerms: ["deep neck lymph nodes"], relationType: "drains_to", relationTargetType: "anatomy_structure", relationTargetSlug: "jugular-lymphatic-trunk" },
  { slug: "supraclavicular-lymph-nodes", name: "Supraclavicular Lymph Nodes", structureType: "lymph_node_group", region: "neck", formalTerm: "Supraclavicular lymph nodes", officialLocator: "FIPAT TA2: Nodi lymphoidei supraclaviculares", description: "Supraclavicular lymph nodes sit above the clavicle near the lower neck and receive drainage from adjacent cervical and thoracic pathways. They provide a named surface landmark for body-map education.", commonTerms: ["above collarbone lymph nodes"], relationType: "associated_with", relationTargetType: "bone", relationTargetSlug: "clavicle" },
  { slug: "parasternal-lymph-nodes", name: "Parasternal Lymph Nodes", structureType: "lymph_node_group", region: "thorax", formalTerm: "Parasternal lymph nodes", officialLocator: "FIPAT TA2: Nodi lymphoidei parasternales", description: "Parasternal lymph nodes lie along the internal thoracic vessels near the sternum and receive drainage from anterior thoracic wall and breast-adjacent regions. They support chest-wall lymph education.", commonTerms: ["sternal lymph nodes"], relationType: "associated_with", relationTargetType: "bone", relationTargetSlug: "sternum" },
  { slug: "mediastinal-lymph-nodes", name: "Mediastinal Lymph Nodes", structureType: "lymph_node_group", region: "thorax", formalTerm: "Mediastinal lymph nodes", officialLocator: "FIPAT TA2: Nodi lymphoidei mediastinales", description: "Mediastinal lymph nodes are lymph node groups within the central thorax associated with heart, lung, tracheal, and esophageal drainage pathways. They improve thoracic lymph-map completeness.", commonTerms: ["central chest lymph nodes"], relationType: "associated_with", relationTargetType: "anatomy_structure", relationTargetSlug: "heart" },
  { slug: "mesenteric-lymph-nodes", name: "Mesenteric Lymph Nodes", structureType: "lymph_node_group", region: "abdomen", formalTerm: "Mesenteric lymph nodes", officialLocator: "FIPAT TA2: Nodi lymphoidei mesenterici", description: "Mesenteric lymph nodes sit in the mesenteries and receive lymph from intestinal regions before drainage toward intestinal and lumbar lymphatic pathways. They support digestive lymph anatomy.", commonTerms: ["intestinal lymph nodes"], relationType: "drains_to", relationTargetType: "anatomy_structure", relationTargetSlug: "intestinal-lymphatic-trunk" },
  { slug: "lumbar-lymph-nodes", name: "Lumbar Lymph Nodes", structureType: "lymph_node_group", region: "lumbar-region", formalTerm: "Lumbar lymph nodes", officialLocator: "FIPAT TA2: Nodi lymphoidei lumbales", description: "Lumbar lymph nodes lie along the posterior abdominal wall and receive lymph from lower limbs, pelvis, kidneys, and abdominal wall pathways. They connect regional drainage to lumbar trunks.", commonTerms: ["low back abdominal lymph nodes"], relationType: "drains_to", relationTargetType: "anatomy_structure", relationTargetSlug: "lumbar-lymphatic-trunk" },
  { slug: "external-iliac-lymph-nodes", name: "External Iliac Lymph Nodes", structureType: "lymph_node_group", region: "pelvis", formalTerm: "External iliac lymph nodes", officialLocator: "FIPAT TA2: Nodi lymphoidei iliaci externi", description: "External iliac lymph nodes follow the external iliac vessels and receive drainage from lower limb, anterior abdominal wall, and pelvic-adjacent pathways. They support pelvis-to-leg lymph routing.", commonTerms: ["outer iliac lymph nodes"], relationType: "associated_with", relationTargetType: "blood_supply", relationTargetSlug: "external-iliac-vein" },
  { slug: "internal-iliac-lymph-nodes", name: "Internal Iliac Lymph Nodes", structureType: "lymph_node_group", region: "pelvis", formalTerm: "Internal iliac lymph nodes", officialLocator: "FIPAT TA2: Nodi lymphoidei iliaci interni", description: "Internal iliac lymph nodes follow internal iliac vessels and receive lymph from pelvic walls, gluteal regions, and pelvic organs. They improve pelvic lymph drainage detail for education.", commonTerms: ["inner iliac lymph nodes"], relationType: "associated_with", relationTargetType: "blood_supply", relationTargetSlug: "internal-iliac-vein" },
  { slug: "sacral-lymph-nodes", name: "Sacral Lymph Nodes", structureType: "lymph_node_group", region: "pelvis", formalTerm: "Sacral lymph nodes", officialLocator: "FIPAT TA2: Nodi lymphoidei sacrales", description: "Sacral lymph nodes are pelvic lymph node groups near the sacrum and posterior pelvic wall. They support lumbopelvic, sacral, and posterior pelvis lymphatic mapping.", commonTerms: ["sacrum lymph nodes"], relationType: "associated_with", relationTargetType: "bone", relationTargetSlug: "sacrum" },
  { slug: "superficial-inguinal-lymph-nodes", name: "Superficial Inguinal Lymph Nodes", structureType: "lymph_node_group", region: "hip", formalTerm: "Superficial inguinal lymph nodes", officialLocator: "FIPAT TA2: Nodi lymphoidei inguinales superficiales", description: "Superficial inguinal lymph nodes lie in the groin and receive superficial drainage from lower limb, lower abdominal wall, and external genital surface regions. They are important for lower-limb lymph education.", commonTerms: ["groin lymph nodes"], relationType: "drains_to", relationTargetType: "anatomy_structure", relationTargetSlug: "deep-inguinal-lymph-nodes" },
  { slug: "deep-inguinal-lymph-nodes", name: "Deep Inguinal Lymph Nodes", structureType: "lymph_node_group", region: "hip", formalTerm: "Deep inguinal lymph nodes", officialLocator: "FIPAT TA2: Nodi lymphoidei inguinales profundi", description: "Deep inguinal lymph nodes lie deeper in the groin near the femoral vessels and pass drainage toward external iliac lymph nodes. They connect lower-limb lymph pathways to the pelvis.", commonTerms: ["deep groin lymph nodes"], relationType: "drains_to", relationTargetType: "anatomy_structure", relationTargetSlug: "external-iliac-lymph-nodes" },
  { slug: "cubital-lymph-nodes", name: "Cubital Lymph Nodes", structureType: "lymph_node_group", region: "elbow", formalTerm: "Cubital lymph nodes", officialLocator: "FIPAT TA2: Nodi lymphoidei cubitales", description: "Cubital lymph nodes are small lymph node groups near the elbow that may receive superficial drainage from the forearm and hand before axillary pathways. They support upper-limb lymph-map detail.", commonTerms: ["elbow lymph nodes"], relationType: "drains_to", relationTargetType: "anatomy_structure", relationTargetSlug: "axillary-lymph-nodes" },
]

const VASCULAR_ROWS = VASCULAR_SPECS.map((spec): BloodSupplyRow => ({
  id: `blood-${spec.slug}`,
  slug: spec.slug,
  name: spec.name,
  kind: spec.kind,
  region: spec.region,
  description: spec.description,
  sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
}))

const LYMPH_ROWS = LYMPH_SPECS.map((spec): StructureRow => ({
  id: `structure-${spec.slug}`,
  slug: spec.slug,
  name: spec.name,
  structureType: spec.structureType,
  region: spec.region,
  description: spec.description,
  sourceRef: sourceForStructure(spec.structureType),
}))

const VASCULAR_TERMS = VASCULAR_SPECS.flatMap((spec) => entityTerms("blood_supply", spec.slug, spec.formalTerm, spec.commonTerms, APPLIED_HUMAN_ANATOMY_SOURCE))
const LYMPH_TERMS = LYMPH_SPECS.flatMap((spec) => entityTerms("anatomy_structure", spec.slug, spec.formalTerm, spec.commonTerms, sourceForStructure(spec.structureType)))

const VASCULAR_IDENTIFIERS = VASCULAR_SPECS.map((spec) => fipatIdentifier("blood_supply", spec.slug, spec.formalTerm, spec.officialLocator))
const LYMPH_IDENTIFIERS = LYMPH_SPECS.map((spec) => fipatIdentifier("anatomy_structure", spec.slug, spec.formalTerm, spec.officialLocator))

const VASCULAR_RELATIONSHIPS = VASCULAR_SPECS.flatMap((spec): RelationshipRow[] => {
  const branchRelationship = {
    id: `relationship-${spec.slug}-${spec.relationType}-${spec.relationTargetSlug}`,
    sourceEntityType: "blood_supply",
    sourceEntitySlug: spec.slug,
    relationshipType: spec.relationType,
    targetEntityType: spec.relationTargetType,
    targetEntitySlug: spec.relationTargetSlug,
    details: { atlasUse: "macro vascular pathway", region: spec.region },
    sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
  } satisfies RelationshipRow

  const regionalRelationship = {
    id: `relationship-${spec.slug}-associated-with-${spec.region}`,
    sourceEntityType: "blood_supply",
    sourceEntitySlug: spec.slug,
    relationshipType: spec.kind === "artery" ? "supplies_region" : "drains_region",
    targetEntityType: "region",
    targetEntitySlug: spec.region,
    details: { atlasUse: "regional vascular browse anchor" },
    sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
  } satisfies RelationshipRow

  return [branchRelationship, regionalRelationship]
})

const LYMPH_RELATIONSHIPS = LYMPH_SPECS.map((spec): RelationshipRow => ({
  id: `relationship-${spec.slug}-${spec.relationType}-${spec.relationTargetSlug}`,
  sourceEntityType: "anatomy_structure",
  sourceEntitySlug: spec.slug,
  relationshipType: spec.relationType,
  targetEntityType: spec.relationTargetType,
  targetEntitySlug: spec.relationTargetSlug,
  details: { atlasUse: "lymphatic drainage pathway", region: spec.region },
  sourceRef: sourceForStructure(spec.structureType),
}))

const BRANCH_RELATIONSHIP_CLOSURES: RelationshipRow[] = [
  {
    id: "relationship-aortic-arch-branches-to-brachiocephalic-trunk",
    sourceEntityType: "blood_supply",
    sourceEntitySlug: "aortic-arch",
    relationshipType: "branches_to",
    targetEntityType: "blood_supply",
    targetEntitySlug: "brachiocephalic-trunk",
    details: { atlasUse: "aortic arch branch pathway" },
    sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
  },
  {
    id: "relationship-abdominal-aorta-branches-to-celiac-trunk",
    sourceEntityType: "blood_supply",
    sourceEntitySlug: "abdominal-aorta",
    relationshipType: "branches_to",
    targetEntityType: "blood_supply",
    targetEntitySlug: "celiac-trunk",
    details: { atlasUse: "abdominal aorta branch pathway" },
    sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
  },
  {
    id: "relationship-thoracic-duct-drains-to-left-venous-angle",
    sourceEntityType: "anatomy_structure",
    sourceEntitySlug: "thoracic-duct",
    relationshipType: "drains_to",
    targetEntityType: "anatomy_structure",
    targetEntitySlug: "left-venous-angle",
    details: { atlasUse: "lymphatic return to venous system" },
    sourceRef: OPENSTAX_HUMAN_BIOLOGY_SOURCE,
  },
  {
    id: "relationship-right-lymphatic-duct-drains-to-right-venous-angle",
    sourceEntityType: "anatomy_structure",
    sourceEntitySlug: "right-lymphatic-duct",
    relationshipType: "drains_to",
    targetEntityType: "anatomy_structure",
    targetEntitySlug: "right-venous-angle",
    details: { atlasUse: "right upper quadrant lymphatic return" },
    sourceRef: OPENSTAX_HUMAN_BIOLOGY_SOURCE,
  },
]

const VASCULAR_CITATIONS = VASCULAR_SPECS.flatMap((spec) => {
  const identifierId = `external-vascular-lymphatic-blood-supply-${spec.slug}-fipat`

  return entityCoreCitations(
    "blood_supply",
    spec.slug,
    `blood-${spec.slug}`,
    APPLIED_HUMAN_ANATOMY_SOURCE,
    spec.officialLocator,
    identifierId,
    "MassageLab-authored macrovascular summary verified against Applied Human Anatomy regional vessel material.",
  )
})

const LYMPH_CITATIONS = LYMPH_SPECS.flatMap((spec) => {
  const sourceRef = sourceForStructure(spec.structureType)
  const identifierId = `external-vascular-lymphatic-anatomy-structure-${spec.slug}-fipat`

  return entityCoreCitations(
    "anatomy_structure",
    spec.slug,
    `structure-${spec.slug}`,
    sourceRef,
    spec.officialLocator,
    identifierId,
    sourceRef === OPENSTAX_HUMAN_BIOLOGY_SOURCE
      ? "MassageLab-authored lymphatic pathway summary verified against OpenStax Human Biology lymphatic-system material."
      : "MassageLab-authored anatomical structure summary verified against Applied Human Anatomy regional anatomy material.",
  )
})

export const VASCULAR_LYMPHATIC_ATLAS_CLOSURE_SECTION: AnatomySeedSection = {
  bloodSupply: VASCULAR_ROWS,
  structures: LYMPH_ROWS,
  entityTerms: [
    ...VASCULAR_TERMS,
    ...LYMPH_TERMS,
  ],
  relationships: [
    ...VASCULAR_RELATIONSHIPS,
    ...LYMPH_RELATIONSHIPS,
    ...BRANCH_RELATIONSHIP_CLOSURES,
  ],
  citations: [
    ...VASCULAR_CITATIONS,
    ...LYMPH_CITATIONS,
  ],
  externalIdentifiers: [
    ...VASCULAR_IDENTIFIERS,
    ...LYMPH_IDENTIFIERS,
  ],
}
