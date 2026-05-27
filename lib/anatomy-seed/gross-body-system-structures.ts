import type { AnatomyCitation, AnatomyConcept, AnatomyEntityTerm, AnatomyRelationship, AnatomyStructure } from "../anatomy-foundation.ts"
import type { AnatomySeedSection } from "./sections.ts"

type TermSpec = {
  term: string
  termType: "preferred" | "formal" | "common" | "clinical" | "historical" | "eponym" | "abbreviation" | "alternate"
  sourceRef?: string
  notes?: string
}

type StructureSpec = AnatomyStructure & {
  systemSlug: string
  systemConceptSlug: string
  terms?: TermSpec[]
}

const SOURCE = "openstax-human-biology"
const LOCATOR = "OpenStax CNX Human Biology gross anatomy body-system review source; MassageLab-authored summary."

const MUSCULOSKELETAL_SYSTEM_CONCEPT: AnatomyConcept = {
  id: "concept-musculoskeletal-system",
  slug: "musculoskeletal-system",
  name: "Musculoskeletal System",
  conceptType: "system_structure",
  bodySystem: "musculoskeletal",
  description: "The musculoskeletal system includes bones, muscles, joints, cartilage, tendons, ligaments, fascia, and related connective tissues that support posture and movement.",
  sourceRef: SOURCE,
}

const STRUCTURES: StructureSpec[] = [
  { id: "structure-skin", slug: "skin", name: "Skin", structureType: "organ", region: "body-surface", systemSlug: "integumentary", systemConceptSlug: "integumentary-system", description: "Skin is the outer body covering and a sensory, barrier, immune, and temperature-regulation organ. It is represented as gross anatomy for body maps, education, and SOAP terminology.", sourceRef: SOURCE, terms: [{ term: "skin barrier", termType: "common" }, { term: "cutaneous organ", termType: "clinical" }] },
  { id: "structure-epidermis-gross", slug: "epidermis", name: "Epidermis", structureType: "skin_layer", region: "body-surface", systemSlug: "integumentary", systemConceptSlug: "integumentary-system", description: "The epidermis is the superficial layer of skin that contributes to barrier protection and surface renewal. It anchors client-friendly skin-layer education without diagnosing skin conditions.", sourceRef: SOURCE, terms: [{ term: "outer skin layer", termType: "common" }] },
  { id: "structure-dermis-gross", slug: "dermis", name: "Dermis", structureType: "skin_layer", region: "body-surface", systemSlug: "integumentary", systemConceptSlug: "integumentary-system", description: "The dermis is the deeper skin layer containing connective tissue, blood vessels, nerves, glands, follicles, and sensory structures. It supports massage-relevant skin and touch education.", sourceRef: SOURCE, terms: [{ term: "true skin", termType: "alternate" }] },
  { id: "structure-hypodermis-gross", slug: "hypodermis", name: "Hypodermis", structureType: "subcutaneous_layer", region: "body-surface", systemSlug: "integumentary", systemConceptSlug: "integumentary-system", description: "The hypodermis is the subcutaneous layer beneath the dermis that contains fat and connective tissue. It provides a safe gross-anatomy anchor for superficial-to-deep body-wall education.", sourceRef: SOURCE, terms: [{ term: "subcutaneous tissue", termType: "clinical" }, { term: "under the skin layer", termType: "common" }] },
  { id: "structure-hair", slug: "hair", name: "Hair", structureType: "skin_appendage", region: "body-surface", systemSlug: "integumentary", systemConceptSlug: "integumentary-system", description: "Hair is an integumentary appendage associated with follicles in the skin. It is included for basic body-system completeness and skin-structure terminology.", sourceRef: SOURCE, terms: [{ term: "body hair", termType: "common" }] },
  { id: "structure-hair-follicle-gross", slug: "hair-follicle", name: "Hair Follicle", structureType: "skin_appendage", region: "body-surface", systemSlug: "integumentary", systemConceptSlug: "integumentary-system", description: "A hair follicle is a skin structure that produces and supports hair. It helps connect skin, glands, sensory receptors, and superficial anatomy terminology.", sourceRef: SOURCE, terms: [{ term: "follicle", termType: "common" }] },
  { id: "structure-nail", slug: "nail", name: "Nail", structureType: "skin_appendage", region: "body-surface", systemSlug: "integumentary", systemConceptSlug: "integumentary-system", description: "A nail is a hard integumentary appendage on fingers and toes. It is represented for body-system completeness and hand or foot client-language mapping.", sourceRef: SOURCE, terms: [{ term: "fingernail", termType: "common" }, { term: "toenail", termType: "common" }] },
  { id: "structure-sweat-gland-gross", slug: "sweat-gland", name: "Sweat Gland", structureType: "skin_gland", region: "body-surface", systemSlug: "integumentary", systemConceptSlug: "integumentary-system", description: "A sweat gland is a skin gland involved in sweat production and temperature regulation. It supports integumentary physiology vocabulary without implying pathology.", sourceRef: SOURCE, terms: [{ term: "sudoriferous gland", termType: "formal" }] },
  { id: "structure-sebaceous-gland-gross", slug: "sebaceous-gland", name: "Sebaceous Gland", structureType: "skin_gland", region: "body-surface", systemSlug: "integumentary", systemConceptSlug: "integumentary-system", description: "A sebaceous gland is a skin gland that produces oily secretion associated with hair follicles. It is included for integumentary anatomy and skin-care terminology.", sourceRef: SOURCE, terms: [{ term: "oil gland", termType: "common" }] },

  { id: "structure-heart", slug: "heart", name: "Heart", structureType: "organ", region: "thorax", systemSlug: "cardiovascular", systemConceptSlug: "cardiovascular-system", description: "The heart is the muscular thoracic organ that pumps blood through pulmonary and systemic circulation. It anchors cardiovascular gross anatomy and physiology education.", sourceRef: SOURCE, terms: [{ term: "cardiac organ", termType: "clinical" }] },
  { id: "structure-pericardium", slug: "pericardium", name: "Pericardium", structureType: "serous_membrane", region: "thorax", systemSlug: "cardiovascular", systemConceptSlug: "cardiovascular-system", description: "The pericardium is the membrane sac surrounding the heart. It is represented as gross anatomy for thoracic region education and cardiovascular structure relationships.", sourceRef: SOURCE, terms: [{ term: "heart sac", termType: "common" }] },
  { id: "structure-myocardium", slug: "myocardium", name: "Myocardium", structureType: "cardiac_muscle_layer", region: "thorax", systemSlug: "cardiovascular", systemConceptSlug: "cardiovascular-system", description: "The myocardium is the heart muscle layer that creates pumping force. It connects cardiovascular anatomy with muscle physiology without being modeled as a skeletal muscle.", sourceRef: SOURCE, terms: [{ term: "heart muscle", termType: "common" }] },
  { id: "structure-endocardium", slug: "endocardium", name: "Endocardium", structureType: "cardiac_membrane", region: "thorax", systemSlug: "cardiovascular", systemConceptSlug: "cardiovascular-system", description: "The endocardium is the inner lining of the heart chambers and valves. It supports cardiovascular structure terminology at a broad educational level.", sourceRef: SOURCE, terms: [{ term: "inner heart lining", termType: "common" }] },
  { id: "structure-heart-valve", slug: "heart-valve", name: "Heart Valve", structureType: "cardiac_valve", region: "thorax", systemSlug: "cardiovascular", systemConceptSlug: "cardiovascular-system", description: "A heart valve is a cardiac structure that helps maintain one-way blood flow through the heart. It is included for cardiovascular gross anatomy and circulation education.", sourceRef: SOURCE, terms: [{ term: "cardiac valve", termType: "clinical" }] },
  { id: "structure-blood-vessel", slug: "blood-vessel", name: "Blood Vessel", structureType: "vessel", region: "trunk-spine-pelvis", systemSlug: "cardiovascular", systemConceptSlug: "cardiovascular-system", description: "A blood vessel is a tube-like cardiovascular structure that carries blood. This generic record complements named arteries and veins used for regional supply relationships.", sourceRef: SOURCE, terms: [{ term: "vessel", termType: "common" }] },
  { id: "structure-artery", slug: "artery", name: "Artery", structureType: "vessel", region: "trunk-spine-pelvis", systemSlug: "cardiovascular", systemConceptSlug: "cardiovascular-system", description: "An artery is a blood vessel that carries blood away from the heart. It provides a generic gross-anatomy anchor for named arterial supply records.", sourceRef: SOURCE, terms: [{ term: "arterial vessel", termType: "clinical" }] },
  { id: "structure-vein", slug: "vein", name: "Vein", structureType: "vessel", region: "trunk-spine-pelvis", systemSlug: "cardiovascular", systemConceptSlug: "cardiovascular-system", description: "A vein is a blood vessel that returns blood toward the heart. It provides a generic gross-anatomy anchor for named venous drainage records.", sourceRef: SOURCE, terms: [{ term: "venous vessel", termType: "clinical" }] },
  { id: "structure-capillary", slug: "capillary", name: "Capillary", structureType: "microvessel", region: "trunk-spine-pelvis", systemSlug: "cardiovascular", systemConceptSlug: "cardiovascular-system", description: "A capillary is a small blood vessel where exchange occurs between blood and tissues. It supports cardiovascular and tissue physiology education.", sourceRef: SOURCE, terms: [{ term: "small blood vessel", termType: "common" }] },

  { id: "structure-nasal-cavity", slug: "nasal-cavity", name: "Nasal Cavity", structureType: "airway", region: "head", systemSlug: "respiratory", systemConceptSlug: "respiratory-system", description: "The nasal cavity is an upper-airway region that warms, filters, and conducts air. It supports respiratory gross anatomy without implying treatment effects.", sourceRef: SOURCE, terms: [{ term: "nose airway", termType: "common" }] },
  { id: "structure-pharynx", slug: "pharynx", name: "Pharynx", structureType: "airway_digestive_region", region: "neck", systemSlug: "respiratory", systemConceptSlug: "respiratory-system", description: "The pharynx is a shared throat passage for respiratory and digestive pathways. It is included as cross-system gross anatomy for head, neck, breathing, and swallowing education.", sourceRef: SOURCE, terms: [{ term: "throat", termType: "common" }] },
  { id: "structure-larynx", slug: "larynx", name: "Larynx", structureType: "airway", region: "neck", systemSlug: "respiratory", systemConceptSlug: "respiratory-system", description: "The larynx is an airway structure in the neck associated with voice production and airway protection. It anchors respiratory and anterior neck anatomy terminology.", sourceRef: SOURCE, terms: [{ term: "voice box", termType: "common" }] },
  { id: "structure-trachea", slug: "trachea", name: "Trachea", structureType: "airway", region: "neck", systemSlug: "respiratory", systemConceptSlug: "respiratory-system", description: "The trachea is the airway tube connecting the larynx with the bronchi. It provides a gross anatomy anchor for breathing-pathway education.", sourceRef: SOURCE, terms: [{ term: "windpipe", termType: "common" }] },
  { id: "structure-bronchus", slug: "bronchus", name: "Bronchus", structureType: "airway", region: "thorax", systemSlug: "respiratory", systemConceptSlug: "respiratory-system", description: "A bronchus is a branching airway that conducts air from the trachea toward lung tissue. It supports respiratory tree terminology.", sourceRef: SOURCE, terms: [{ term: "bronchial airway", termType: "clinical" }, { term: "air tube", termType: "common" }] },
  { id: "structure-lung", slug: "lung", name: "Lung", structureType: "organ", region: "thorax", systemSlug: "respiratory", systemConceptSlug: "respiratory-system", description: "A lung is a thoracic respiratory organ where ventilation and gas exchange are organized. It anchors respiratory gross anatomy and chest-region education.", sourceRef: SOURCE, terms: [{ term: "lungs", termType: "common" }] },
  { id: "structure-alveolus", slug: "alveolus", name: "Alveolus", structureType: "respiratory_air_sac", region: "thorax", systemSlug: "respiratory", systemConceptSlug: "respiratory-system", description: "An alveolus is a small respiratory air sac where gas exchange occurs. It provides the searchable bridge from client-friendly air sacs to respiratory physiology.", sourceRef: SOURCE, terms: [{ term: "air sac", termType: "common" }, { term: "air sacs", termType: "common" }] },
  { id: "structure-pleura", slug: "pleura", name: "Pleura", structureType: "serous_membrane", region: "thorax", systemSlug: "respiratory", systemConceptSlug: "respiratory-system", description: "The pleura is the membrane associated with the lungs and thoracic cavity. It supports respiratory gross anatomy and chest-wall education.", sourceRef: SOURCE, terms: [{ term: "lung membrane", termType: "common" }] },

  { id: "structure-oral-cavity", slug: "oral-cavity", name: "Oral Cavity", structureType: "digestive_region", region: "jaw", systemSlug: "digestive", systemConceptSlug: "digestive-system", description: "The oral cavity is the mouth space where food intake and early digestion begin. It connects digestive anatomy with jaw, tongue, facial, and client-language structures.", sourceRef: SOURCE, terms: [{ term: "mouth", termType: "common" }] },
  { id: "structure-salivary-gland", slug: "salivary-gland", name: "Salivary Gland", structureType: "digestive_gland", region: "face", systemSlug: "digestive", systemConceptSlug: "digestive-system", description: "A salivary gland produces saliva for the oral phase of digestion. It is included for digestive gross anatomy and face or jaw region education.", sourceRef: SOURCE, terms: [{ term: "saliva gland", termType: "common" }] },
  { id: "structure-esophagus", slug: "esophagus", name: "Esophagus", structureType: "digestive_tract", region: "thorax", systemSlug: "digestive", systemConceptSlug: "digestive-system", description: "The esophagus is the digestive tube that carries swallowed material from the pharynx toward the stomach. It anchors upper digestive tract anatomy.", sourceRef: SOURCE, terms: [{ term: "food tube", termType: "common" }] },
  { id: "structure-stomach", slug: "stomach", name: "Stomach", structureType: "organ", region: "abdomen", systemSlug: "digestive", systemConceptSlug: "digestive-system", description: "The stomach is an abdominal digestive organ involved in food storage and mechanical and chemical digestion. It is represented for A&P completeness and client-friendly education.", sourceRef: SOURCE, terms: [{ term: "stomach organ", termType: "common" }] },
  { id: "structure-small-intestine", slug: "small-intestine", name: "Small Intestine", structureType: "digestive_tract", region: "abdomen", systemSlug: "digestive", systemConceptSlug: "digestive-system", description: "The small intestine is a digestive tract region where much digestion and nutrient absorption occur. It supports abdominal anatomy and physiology coverage.", sourceRef: SOURCE, terms: [{ term: "small bowel", termType: "common" }] },
  { id: "structure-large-intestine", slug: "large-intestine", name: "Large Intestine", structureType: "digestive_tract", region: "abdomen", systemSlug: "digestive", systemConceptSlug: "digestive-system", description: "The large intestine is a digestive tract region involved in water absorption and fecal formation. It supports abdominal gross anatomy and bowel terminology.", sourceRef: SOURCE, terms: [{ term: "colon", termType: "common" }, { term: "large bowel", termType: "common" }] },
  { id: "structure-liver", slug: "liver", name: "Liver", structureType: "organ", region: "abdomen", systemSlug: "digestive", systemConceptSlug: "digestive-system", description: "The liver is an abdominal organ with digestive, metabolic, and blood-processing roles. It is included as gross anatomy for body-system literacy.", sourceRef: SOURCE, terms: [{ term: "hepatic organ", termType: "clinical" }] },
  { id: "structure-gallbladder", slug: "gallbladder", name: "Gallbladder", structureType: "organ", region: "abdomen", systemSlug: "digestive", systemConceptSlug: "digestive-system", description: "The gallbladder is a small abdominal organ associated with bile storage and release. It supports digestive accessory organ anatomy.", sourceRef: SOURCE, terms: [{ term: "bile storage organ", termType: "common" }] },
  { id: "structure-pancreas", slug: "pancreas", name: "Pancreas", structureType: "organ", region: "abdomen", systemSlug: "digestive", systemConceptSlug: "digestive-system", description: "The pancreas is an abdominal organ with digestive enzyme and endocrine hormone roles. It is represented as cross-system gross anatomy.", sourceRef: SOURCE, terms: [{ term: "pancreatic organ", termType: "clinical" }] },
  { id: "structure-rectum", slug: "rectum", name: "Rectum", structureType: "digestive_tract", region: "pelvis", systemSlug: "digestive", systemConceptSlug: "digestive-system", description: "The rectum is the terminal pelvic region of the large intestine before the anal canal. It supports digestive gross anatomy and elimination terminology.", sourceRef: SOURCE, terms: [{ term: "terminal bowel", termType: "common" }] },
  { id: "structure-anus", slug: "anus", name: "Anus", structureType: "digestive_opening", region: "pelvis", systemSlug: "digestive", systemConceptSlug: "digestive-system", description: "The anus is the terminal digestive opening involved in bowel elimination. It is included for complete digestive tract anatomy using non-diagnostic education language.", sourceRef: SOURCE, terms: [{ term: "anal opening", termType: "common" }] },

  { id: "structure-endocrine-gland", slug: "endocrine-gland", name: "Endocrine Gland", structureType: "gland", region: "trunk-spine-pelvis", systemSlug: "endocrine", systemConceptSlug: "endocrine-system", description: "An endocrine gland releases hormones into body fluids rather than through ducts. This generic record anchors endocrine structure terminology across named glands.", sourceRef: SOURCE, terms: [{ term: "hormone gland", termType: "common" }] },
  { id: "structure-pituitary-gland", slug: "pituitary-gland", name: "Pituitary Gland", structureType: "endocrine_gland", region: "head", systemSlug: "endocrine", systemConceptSlug: "endocrine-system", description: "The pituitary gland is an endocrine gland at the base of the brain that helps regulate other endocrine organs. It supports endocrine A&P vocabulary.", sourceRef: SOURCE, terms: [{ term: "hypophysis", termType: "formal" }] },
  { id: "structure-thyroid-gland", slug: "thyroid-gland", name: "Thyroid Gland", structureType: "endocrine_gland", region: "neck", systemSlug: "endocrine", systemConceptSlug: "endocrine-system", description: "The thyroid gland is an endocrine gland in the anterior neck associated with metabolic regulation. It supports neck anatomy and endocrine-system education.", sourceRef: SOURCE, terms: [{ term: "thyroid", termType: "common" }] },
  { id: "structure-parathyroid-gland", slug: "parathyroid-gland", name: "Parathyroid Gland", structureType: "endocrine_gland", region: "neck", systemSlug: "endocrine", systemConceptSlug: "endocrine-system", description: "A parathyroid gland is a small endocrine gland associated with the thyroid region and calcium regulation. It is included for gross endocrine anatomy coverage.", sourceRef: SOURCE, terms: [{ term: "parathyroid", termType: "common" }] },
  { id: "structure-adrenal-gland", slug: "adrenal-gland", name: "Adrenal Gland", structureType: "endocrine_gland", region: "abdomen", systemSlug: "endocrine", systemConceptSlug: "endocrine-system", description: "An adrenal gland is an endocrine gland superior to a kidney that contributes to stress-response and fluid-balance hormones. It supports endocrine anatomy education.", sourceRef: SOURCE, terms: [{ term: "suprarenal gland", termType: "formal" }] },
  { id: "structure-pancreatic-islet", slug: "pancreatic-islet", name: "Pancreatic Islet", structureType: "endocrine_tissue", region: "abdomen", systemSlug: "endocrine", systemConceptSlug: "endocrine-system", description: "A pancreatic islet is endocrine tissue within the pancreas involved in blood-glucose hormone regulation. It links digestive and endocrine gross anatomy.", sourceRef: SOURCE, terms: [{ term: "islet of Langerhans", termType: "eponym" }] },

  { id: "structure-lymphatic-vessel", slug: "lymphatic-vessel", name: "Lymphatic Vessel", structureType: "lymphatic_vessel", region: "trunk-spine-pelvis", systemSlug: "lymphatic-immune", systemConceptSlug: "lymphatic-system", description: "A lymphatic vessel carries lymph through the lymphatic system. It anchors lymph transport anatomy and helps distinguish lymph vessels from blood vessels.", sourceRef: SOURCE, terms: [{ term: "lymph vessel", termType: "common" }] },
  { id: "structure-lymphatic-capillary", slug: "lymphatic-capillary", name: "Lymphatic Capillary", structureType: "lymphatic_vessel", region: "trunk-spine-pelvis", systemSlug: "lymphatic-immune", systemConceptSlug: "lymphatic-system", description: "A lymphatic capillary is a small lymph vessel that receives fluid from tissue spaces. It supports edema, fluid return, and lymphatic anatomy education.", sourceRef: SOURCE, terms: [{ term: "initial lymphatic", termType: "clinical" }] },
  { id: "structure-lymphatic-duct", slug: "lymphatic-duct", name: "Lymphatic Duct", structureType: "lymphatic_vessel", region: "thorax", systemSlug: "lymphatic-immune", systemConceptSlug: "lymphatic-system", description: "A lymphatic duct is a large lymphatic channel that returns lymph toward venous circulation. It supports lymphatic drainage anatomy at a broad level.", sourceRef: SOURCE, terms: [{ term: "lymph duct", termType: "common" }] },
  { id: "structure-lymph-node", slug: "lymph-node", name: "Lymph Node", structureType: "lymphoid_organ", region: "trunk-spine-pelvis", systemSlug: "lymphatic-immune", systemConceptSlug: "lymphatic-system", description: "A lymph node is a lymphoid organ that filters lymph and participates in immune response. It provides a gross anatomy anchor for immune-system terminology.", sourceRef: SOURCE, terms: [{ term: "lymph gland", termType: "common" }] },
  { id: "structure-spleen", slug: "spleen", name: "Spleen", structureType: "lymphoid_organ", region: "abdomen", systemSlug: "lymphatic-immune", systemConceptSlug: "lymphatic-system", description: "The spleen is a lymphoid organ in the abdomen associated with blood filtering and immune activity. It supports lymphatic and immune anatomy coverage.", sourceRef: SOURCE, terms: [{ term: "splenic organ", termType: "clinical" }] },
  { id: "structure-thymus", slug: "thymus", name: "Thymus", structureType: "lymphoid_organ", region: "thorax", systemSlug: "lymphatic-immune", systemConceptSlug: "lymphatic-system", description: "The thymus is a lymphoid organ in the upper thorax that is important for immune-cell development. It is included for immune-system gross anatomy.", sourceRef: SOURCE, terms: [{ term: "thymic organ", termType: "clinical" }] },
  { id: "structure-tonsil", slug: "tonsil", name: "Tonsil", structureType: "lymphoid_tissue", region: "head", systemSlug: "lymphatic-immune", systemConceptSlug: "lymphatic-system", description: "A tonsil is lymphoid tissue near the pharyngeal region involved in immune surveillance. It supports head, neck, lymphatic, and immune anatomy terms.", sourceRef: SOURCE, terms: [{ term: "tonsillar tissue", termType: "clinical" }] },
  { id: "structure-bone-marrow", slug: "bone-marrow", name: "Bone Marrow", structureType: "hematopoietic_tissue", region: "trunk-spine-pelvis", systemSlug: "lymphatic-immune", systemConceptSlug: "lymphatic-system", description: "Bone marrow is tissue inside bones involved in blood-cell formation. It is included as gross anatomy connecting skeletal, cardiovascular, and immune education.", sourceRef: SOURCE, terms: [{ term: "marrow", termType: "common" }] },

  { id: "structure-kidney", slug: "kidney", name: "Kidney", structureType: "organ", region: "abdomen", systemSlug: "urinary", systemConceptSlug: "urinary-system", description: "A kidney is an abdominal urinary organ that filters blood and contributes to fluid, electrolyte, and acid-base balance. It anchors urinary gross anatomy.", sourceRef: SOURCE, terms: [{ term: "renal organ", termType: "clinical" }] },
  { id: "structure-renal-cortex", slug: "renal-cortex", name: "Renal Cortex", structureType: "organ_region", region: "abdomen", systemSlug: "urinary", systemConceptSlug: "urinary-system", description: "The renal cortex is the outer region of the kidney containing many nephron components. It supports urinary organ-region terminology.", sourceRef: SOURCE, terms: [{ term: "kidney cortex", termType: "common" }] },
  { id: "structure-renal-medulla", slug: "renal-medulla", name: "Renal Medulla", structureType: "organ_region", region: "abdomen", systemSlug: "urinary", systemConceptSlug: "urinary-system", description: "The renal medulla is the inner region of the kidney associated with urine concentration pathways. It supports kidney anatomy education.", sourceRef: SOURCE, terms: [{ term: "kidney medulla", termType: "common" }] },
  { id: "structure-nephron", slug: "nephron", name: "Nephron", structureType: "microscopic_functional_unit", region: "abdomen", systemSlug: "urinary", systemConceptSlug: "urinary-system", description: "A nephron is the kidney functional unit involved in filtration, reabsorption, secretion, and urine formation. It bridges urinary gross and microscopic anatomy.", sourceRef: SOURCE, terms: [{ term: "kidney filtering unit", termType: "common" }] },
  { id: "structure-ureter", slug: "ureter", name: "Ureter", structureType: "urinary_tract", region: "abdomen", systemSlug: "urinary", systemConceptSlug: "urinary-system", description: "A ureter is a urinary tube that carries urine from a kidney toward the urinary bladder. It supports urinary tract gross anatomy.", sourceRef: SOURCE, terms: [{ term: "kidney-to-bladder tube", termType: "common" }] },
  { id: "structure-urinary-bladder", slug: "urinary-bladder", name: "Urinary Bladder", structureType: "organ", region: "pelvis", systemSlug: "urinary", systemConceptSlug: "urinary-system", description: "The urinary bladder is a pelvic organ that stores urine before elimination. It anchors urinary-system anatomy and client-friendly bladder terminology.", sourceRef: SOURCE, terms: [{ term: "bladder", termType: "common" }] },
  { id: "structure-urethra", slug: "urethra", name: "Urethra", structureType: "urinary_tract", region: "pelvis", systemSlug: "urinary", systemConceptSlug: "urinary-system", description: "The urethra is the urinary tract tube that carries urine from the bladder to the exterior. It supports urinary gross anatomy and pelvic anatomy coverage.", sourceRef: SOURCE, terms: [{ term: "urine passage", termType: "common" }] },

  { id: "structure-ovary", slug: "ovary", name: "Ovary", structureType: "reproductive_organ", region: "pelvis", systemSlug: "reproduction", systemConceptSlug: "reproductive-system", description: "An ovary is a reproductive organ that produces oocytes and hormones. It is represented for broad reproductive-system anatomy and physiology literacy.", sourceRef: SOURCE, terms: [{ term: "female gonad", termType: "clinical" }] },
  { id: "structure-uterine-tube", slug: "uterine-tube", name: "Uterine Tube", structureType: "reproductive_tract", region: "pelvis", systemSlug: "reproduction", systemConceptSlug: "reproductive-system", description: "A uterine tube is a reproductive tract structure between the ovary region and uterus. It supports reproductive gross anatomy terminology.", sourceRef: SOURCE, terms: [{ term: "fallopian tube", termType: "eponym" }] },
  { id: "structure-uterus", slug: "uterus", name: "Uterus", structureType: "reproductive_organ", region: "pelvis", systemSlug: "reproduction", systemConceptSlug: "reproductive-system", description: "The uterus is a pelvic reproductive organ involved in pregnancy and menstrual physiology. It is included as gross anatomy, not as diagnostic content.", sourceRef: SOURCE, terms: [{ term: "womb", termType: "common" }] },
  { id: "structure-vagina", slug: "vagina", name: "Vagina", structureType: "reproductive_tract", region: "pelvis", systemSlug: "reproduction", systemConceptSlug: "reproductive-system", description: "The vagina is a reproductive tract structure in the pelvis. It is included for complete reproductive anatomy coverage using neutral educational language.", sourceRef: SOURCE, terms: [{ term: "vaginal canal", termType: "common" }] },
  { id: "structure-testis", slug: "testis", name: "Testis", structureType: "reproductive_organ", region: "pelvis", systemSlug: "reproduction", systemConceptSlug: "reproductive-system", description: "A testis is a reproductive organ that produces sperm cells and hormones. It supports reproductive-system anatomy and physiology literacy.", sourceRef: SOURCE, terms: [{ term: "testicle", termType: "common" }, { term: "male gonad", termType: "clinical" }] },
  { id: "structure-epididymis", slug: "epididymis", name: "Epididymis", structureType: "reproductive_tract", region: "pelvis", systemSlug: "reproduction", systemConceptSlug: "reproductive-system", description: "The epididymis is a reproductive tract structure associated with the testis where sperm mature and are stored. It supports pelvic gross anatomy terminology.", sourceRef: SOURCE, terms: [{ term: "sperm maturation duct", termType: "common" }] },
  { id: "structure-vas-deferens", slug: "vas-deferens", name: "Vas Deferens", structureType: "reproductive_tract", region: "pelvis", systemSlug: "reproduction", systemConceptSlug: "reproductive-system", description: "The vas deferens is a reproductive duct that transports sperm from the epididymis toward the ejaculatory pathway. It is included for male reproductive anatomy.", sourceRef: SOURCE, terms: [{ term: "ductus deferens", termType: "formal" }] },
  { id: "structure-prostate-gland", slug: "prostate-gland", name: "Prostate Gland", structureType: "reproductive_gland", region: "pelvis", systemSlug: "reproduction", systemConceptSlug: "reproductive-system", description: "The prostate gland is a pelvic reproductive gland that contributes fluid to semen. It supports reproductive anatomy coverage while staying outside diagnostic use.", sourceRef: SOURCE, terms: [{ term: "prostate", termType: "common" }] },
  { id: "structure-penis", slug: "penis", name: "Penis", structureType: "reproductive_organ", region: "pelvis", systemSlug: "reproduction", systemConceptSlug: "reproductive-system", description: "The penis is an external reproductive organ with urinary and reproductive roles. It is included for gross anatomy completeness and neutral educational terminology.", sourceRef: SOURCE, terms: [{ term: "external male reproductive organ", termType: "common" }] },
  { id: "structure-mammary-gland", slug: "mammary-gland", name: "Mammary Gland", structureType: "gland", region: "thorax", systemSlug: "reproduction", systemConceptSlug: "reproductive-system", description: "A mammary gland is a glandular breast structure involved in lactation. It is included for reproductive and integumentary anatomy context.", sourceRef: SOURCE, terms: [{ term: "breast gland", termType: "common" }] },

  { id: "structure-brain", slug: "brain", name: "Brain", structureType: "organ", region: "head", systemSlug: "nervous", systemConceptSlug: "nervous-system", description: "The brain is the central nervous-system organ within the skull that supports perception, movement, autonomic regulation, cognition, and behavior.", sourceRef: SOURCE, terms: [{ term: "encephalon", termType: "formal" }] },
  { id: "structure-cerebrum", slug: "cerebrum", name: "Cerebrum", structureType: "brain_region", region: "head", systemSlug: "nervous", systemConceptSlug: "nervous-system", description: "The cerebrum is the largest brain region and supports conscious perception, movement planning, language, memory, and many higher nervous-system functions.", sourceRef: SOURCE, terms: [{ term: "cerebral hemispheres", termType: "clinical" }] },
  { id: "structure-cerebellum", slug: "cerebellum", name: "Cerebellum", structureType: "brain_region", region: "head", systemSlug: "nervous", systemConceptSlug: "nervous-system", description: "The cerebellum is a brain region involved in coordination, balance, motor learning, and movement refinement. It supports nervous-system movement education.", sourceRef: SOURCE, terms: [{ term: "little brain", termType: "common" }] },
  { id: "structure-brainstem", slug: "brainstem", name: "Brainstem", structureType: "brain_region", region: "head", systemSlug: "nervous", systemConceptSlug: "nervous-system", description: "The brainstem connects the brain with the spinal cord and supports many vital regulatory and pathway functions. It anchors central nervous-system gross anatomy.", sourceRef: SOURCE, terms: [{ term: "brain stem", termType: "alternate" }] },
  { id: "structure-spinal-cord", slug: "spinal-cord", name: "Spinal Cord", structureType: "central_nervous_tissue", region: "trunk-spine-pelvis", systemSlug: "nervous", systemConceptSlug: "nervous-system", description: "The spinal cord is central nervous tissue within the vertebral canal that carries information between the brain and body and participates in reflex activity.", sourceRef: SOURCE, terms: [{ term: "cord", termType: "common" }] },
  { id: "structure-peripheral-nerve", slug: "peripheral-nerve", name: "Peripheral Nerve", structureType: "nerve", region: "trunk-spine-pelvis", systemSlug: "nervous", systemConceptSlug: "nervous-system", description: "A peripheral nerve is a nerve outside the brain and spinal cord that connects central processing with body tissues. It complements named nerve records.", sourceRef: SOURCE, terms: [{ term: "body nerve", termType: "common" }] },
  { id: "structure-ganglion", slug: "ganglion", name: "Ganglion", structureType: "nerve_cell_cluster", region: "trunk-spine-pelvis", systemSlug: "nervous", systemConceptSlug: "nervous-system", description: "A ganglion is a cluster of nerve cell bodies outside the central nervous system. It supports peripheral and autonomic nervous-system terminology.", sourceRef: SOURCE, terms: [{ term: "nerve cell cluster", termType: "common" }] },

  { id: "structure-eye", slug: "eye", name: "Eye", structureType: "sensory_organ", region: "face", systemSlug: "sensory", systemConceptSlug: "sensory-system", description: "The eye is a sensory organ for vision. It is included for special-senses anatomy and client-friendly head and face education.", sourceRef: SOURCE, terms: [{ term: "visual organ", termType: "clinical" }] },
  { id: "structure-retina", slug: "retina", name: "Retina", structureType: "sensory_tissue", region: "face", systemSlug: "sensory", systemConceptSlug: "sensory-system", description: "The retina is sensory tissue at the back of the eye that receives light information. It supports visual-system anatomy terminology.", sourceRef: SOURCE, terms: [{ term: "light-sensitive layer", termType: "common" }] },
  { id: "structure-ear", slug: "ear", name: "Ear", structureType: "sensory_organ", region: "head", systemSlug: "sensory", systemConceptSlug: "sensory-system", description: "The ear is a sensory organ associated with hearing and balance. It supports special-senses anatomy and head-region education.", sourceRef: SOURCE, terms: [{ term: "hearing organ", termType: "common" }] },
  { id: "structure-cochlea", slug: "cochlea", name: "Cochlea", structureType: "sensory_tissue", region: "head", systemSlug: "sensory", systemConceptSlug: "sensory-system", description: "The cochlea is an inner-ear structure involved in hearing. It anchors auditory anatomy without implying clinical testing or diagnosis.", sourceRef: SOURCE, terms: [{ term: "hearing spiral", termType: "common" }] },
  { id: "structure-vestibular-apparatus", slug: "vestibular-apparatus", name: "Vestibular Apparatus", structureType: "sensory_tissue", region: "head", systemSlug: "sensory", systemConceptSlug: "sensory-system", description: "The vestibular apparatus is an inner-ear sensory region associated with balance and head-motion information. It supports balance and proprioception-adjacent education.", sourceRef: SOURCE, terms: [{ term: "balance organ", termType: "common" }] },

  { id: "structure-superficial-fascia", slug: "superficial-fascia", name: "Superficial Fascia", structureType: "fascia", region: "body-surface", systemSlug: "musculoskeletal", systemConceptSlug: "musculoskeletal-system", description: "Superficial fascia is connective tissue beneath the skin that helps organize superficial vessels, nerves, fat, and soft tissue mobility. It supports massage-relevant gross anatomy.", sourceRef: SOURCE, terms: [{ term: "subcutaneous fascia", termType: "clinical" }] },
  { id: "structure-deep-fascia", slug: "deep-fascia", name: "Deep Fascia", structureType: "fascia", region: "trunk-spine-pelvis", systemSlug: "musculoskeletal", systemConceptSlug: "musculoskeletal-system", description: "Deep fascia is connective tissue that invests muscles, forms compartments, and transmits force. It supports anatomy education about fascia without overstating treatment claims.", sourceRef: SOURCE, terms: [{ term: "investing fascia", termType: "clinical" }] },
  { id: "structure-joint-capsule", slug: "joint-capsule", name: "Joint Capsule", structureType: "joint_capsule", region: "trunk-spine-pelvis", systemSlug: "musculoskeletal", systemConceptSlug: "musculoskeletal-system", description: "A joint capsule is connective tissue surrounding a synovial joint. It helps organize joint stability, synovial membrane, ligament, and range-of-motion education.", sourceRef: SOURCE, terms: [{ term: "articular capsule", termType: "formal" }] },
  { id: "structure-synovial-membrane", slug: "synovial-membrane", name: "Synovial Membrane", structureType: "joint_membrane", region: "trunk-spine-pelvis", systemSlug: "musculoskeletal", systemConceptSlug: "musculoskeletal-system", description: "The synovial membrane lines parts of a synovial joint capsule and is associated with synovial fluid production. It supports joint structure and movement education.", sourceRef: SOURCE, terms: [{ term: "synovium", termType: "clinical" }] },
  { id: "structure-articular-cartilage", slug: "articular-cartilage", name: "Articular Cartilage", structureType: "cartilage", region: "trunk-spine-pelvis", systemSlug: "musculoskeletal", systemConceptSlug: "musculoskeletal-system", description: "Articular cartilage covers bone surfaces within many joints and helps reduce friction during movement. It supports joint structure, ROM, and education prompts.", sourceRef: SOURCE, terms: [{ term: "joint cartilage", termType: "common" }] },
  { id: "structure-bursa", slug: "bursa", name: "Bursa", structureType: "bursa", region: "trunk-spine-pelvis", systemSlug: "musculoskeletal", systemConceptSlug: "musculoskeletal-system", description: "A bursa is a small fluid-associated sac that can reduce friction between moving tissues. It is included as a gross anatomy structure, not as a diagnosis.", sourceRef: SOURCE, terms: [{ term: "friction-reducing sac", termType: "common" }] },
]

function termSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

function conceptTerm(concept: AnatomyConcept): AnatomyEntityTerm {
  return {
    id: `term-concept-${concept.slug}-preferred`,
    anatomyEntityType: "anatomy_concept",
    anatomyEntitySlug: concept.slug,
    term: concept.name,
    termType: "preferred",
    sourceRef: concept.sourceRef,
  }
}

function conceptCitation(concept: AnatomyConcept): AnatomyCitation {
  return {
    id: `citation-concept-${concept.slug}-clinical-summary`,
    slug: `citation-concept-${concept.slug}-clinical-summary`,
    entityType: "anatomy_concept",
    entitySlug: concept.slug,
    factType: "clinical_summary",
    factSlug: `concept:${concept.slug}`,
    sourceRef: concept.sourceRef,
    sourceLocator: LOCATOR,
    citationNote: "Reviewed commercial-compatible support for MassageLab-authored musculoskeletal-system summary. Do not copy source prose directly.",
    reviewStatus: "reviewed",
  }
}

function structureTerms(structure: StructureSpec): AnatomyEntityTerm[] {
  return [
    {
      id: `term-structure-${structure.slug}-preferred`,
      anatomyEntityType: "anatomy_structure",
      anatomyEntitySlug: structure.slug,
      term: structure.name,
      termType: "preferred",
      sourceRef: structure.sourceRef,
    },
    ...(structure.terms ?? []).map((term): AnatomyEntityTerm => ({
      id: `term-structure-${structure.slug}-${term.termType}-${termSlug(term.term)}`,
      anatomyEntityType: "anatomy_structure",
      anatomyEntitySlug: structure.slug,
      term: term.term,
      termType: term.termType,
      notes: term.notes,
      sourceRef: term.sourceRef ?? structure.sourceRef,
    })),
  ]
}

function structureCitation(structure: StructureSpec): AnatomyCitation {
  return {
    id: `citation-structure-${structure.slug}-clinical-summary`,
    slug: `citation-structure-${structure.slug}-clinical-summary`,
    entityType: "anatomy_structure",
    entitySlug: structure.slug,
    factType: "clinical_summary",
    factSlug: `structure:${structure.slug}`,
    sourceRef: structure.sourceRef,
    sourceLocator: LOCATOR,
    citationNote: "Reviewed commercial-compatible support for MassageLab-authored gross anatomy structure summary. Do not copy source prose directly.",
    reviewStatus: "reviewed",
  }
}

function systemRelationship(structure: StructureSpec): AnatomyRelationship {
  return {
    id: `relationship-${structure.systemSlug}-includes-${structure.slug}`,
    sourceEntityType: "anatomy_concept",
    sourceEntitySlug: structure.systemConceptSlug,
    relationshipType: "includes_structure",
    targetEntityType: "anatomy_structure",
    targetEntitySlug: structure.slug,
    details: { systemSlug: structure.systemSlug },
    sourceRef: structure.sourceRef,
  }
}

function structureSeedRecord(structure: StructureSpec): AnatomyStructure {
  return {
    id: structure.id,
    slug: structure.slug,
    name: structure.name,
    structureType: structure.structureType,
    region: structure.region,
    description: structure.description,
    sourceRef: structure.sourceRef,
  }
}

export const GROSS_BODY_SYSTEM_STRUCTURES_SECTION: AnatomySeedSection = {
  bodySubregions: [
    {
      id: "subregion-body-surface",
      slug: "body-surface",
      name: "Body Surface",
      region: "trunk-spine-pelvis",
      description: "Cross-regional body-surface scaffold for integumentary and superficial fascia education.",
      sourceRefs: [SOURCE],
    },
  ],
  concepts: [MUSCULOSKELETAL_SYSTEM_CONCEPT],
  structures: STRUCTURES.map(structureSeedRecord),
  entityTerms: [
    conceptTerm(MUSCULOSKELETAL_SYSTEM_CONCEPT),
    ...STRUCTURES.flatMap(structureTerms),
  ],
  relationships: STRUCTURES.map(systemRelationship),
  citations: [
    conceptCitation(MUSCULOSKELETAL_SYSTEM_CONCEPT),
    ...STRUCTURES.map(structureCitation),
  ],
}
