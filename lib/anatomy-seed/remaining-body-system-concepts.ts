import type { AnatomyCitation, AnatomyConcept, AnatomyEntityTerm } from "../anatomy-foundation.ts"
import type { AnatomySeedSection } from "./sections.ts"

type TermSpec = {
  term: string
  termType: "preferred" | "formal" | "common" | "clinical" | "historical" | "eponym" | "abbreviation" | "alternate"
  sourceRef?: string
  notes?: string
}

type ConceptSpec = AnatomyConcept & {
  locator: string
  terms?: TermSpec[]
}

const PHYSIOLOGY_SOURCE = "openstax-human-biology"
const LOCATOR = "OpenStax CNX Human Biology digestive, endocrine, integumentary, reproductive, sensory, and urinary review source; MassageLab-authored summary."

const CONCEPTS: ConceptSpec[] = [
  { id: "concept-mouth", slug: "mouth", name: "Mouth", conceptType: "system_structure", bodySystem: "digestive", description: "The mouth is the first region of the digestive tract where food intake, chewing, and saliva mixing begin. It is modeled for broad digestive-system literacy and client-friendly education.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR, terms: [{ term: "oral cavity", termType: "clinical" }] },
  { id: "concept-esophagus", slug: "esophagus", name: "Esophagus", conceptType: "system_structure", bodySystem: "digestive", description: "The esophagus is the muscular tube that carries swallowed material from the throat region toward the stomach. It anchors digestive-tract continuity without implying treatment of swallowing problems.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR },
  { id: "concept-stomach", slug: "stomach", name: "Stomach", conceptType: "system_structure", bodySystem: "digestive", description: "The stomach is a digestive organ that stores, churns, and chemically processes food before it enters the small intestine. It is included for abdomen-region A&P orientation.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR },
  { id: "concept-small-intestine", slug: "small-intestine", name: "Small Intestine", conceptType: "system_structure", bodySystem: "digestive", description: "The small intestine is the digestive tract region where much chemical digestion and nutrient absorption occur. It supports basic education about digestion without clinical claims.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR },
  { id: "concept-large-intestine", slug: "large-intestine", name: "Large Intestine", conceptType: "system_structure", bodySystem: "digestive", description: "The large intestine receives remaining digestive material, absorbs water and electrolytes, and forms feces. It is represented for broad digestive and elimination education.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR, terms: [{ term: "colon", termType: "common" }] },
  { id: "concept-liver", slug: "liver", name: "Liver", conceptType: "system_structure", bodySystem: "digestive", description: "The liver is a large abdominal organ with digestive, metabolic, and detoxification-related physiology roles. In this dataset it supports general A&P literacy only.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR },
  { id: "concept-gallbladder", slug: "gallbladder", name: "Gallbladder", conceptType: "system_structure", bodySystem: "digestive", description: "The gallbladder stores and concentrates bile before release into the digestive tract. It is included as an accessory digestive-organ concept for education and exam coverage.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR },
  { id: "concept-pancreas", slug: "pancreas", name: "Pancreas", conceptType: "system_structure", bodySystem: "digestive_endocrine", description: "The pancreas has digestive and endocrine roles, including enzyme secretion and hormone-producing cell groups. MassageLab stores it as a bridge concept between digestive and endocrine physiology.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR },
  { id: "concept-mechanical-digestion", slug: "mechanical-digestion", name: "Mechanical Digestion", conceptType: "system_function", bodySystem: "digestive", description: "Mechanical digestion is the physical breakdown and mixing of food. It provides a simple way to distinguish chewing and churning from chemical digestive processes.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR },
  { id: "concept-chemical-digestion", slug: "chemical-digestion", name: "Chemical Digestion", conceptType: "system_function", bodySystem: "digestive", description: "Chemical digestion uses secretions and enzymes to break food molecules into smaller components. It supports broad physiology education without treatment implications.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR },
  { id: "concept-peristalsis", slug: "peristalsis", name: "Peristalsis", conceptType: "system_function", bodySystem: "digestive", description: "Peristalsis is coordinated wave-like smooth muscle activity that moves material through tubular digestive organs. It is modeled as general digestive physiology.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR },
  { id: "concept-bile", slug: "bile", name: "Bile", conceptType: "system_function", bodySystem: "digestive", description: "Bile is a digestive fluid associated with fat digestion and produced by the liver. The concept connects liver, gallbladder, and small-intestine education.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR },
  { id: "concept-digestive-enzyme", slug: "digestive-enzyme", name: "Digestive Enzyme", conceptType: "system_function", bodySystem: "digestive", description: "A digestive enzyme helps chemically break down food molecules. It gives digestive physiology a reusable concept for education and flashcard prompts.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR },

  { id: "concept-pituitary-gland", slug: "pituitary-gland", name: "Pituitary Gland", conceptType: "system_structure", bodySystem: "endocrine", description: "The pituitary gland is an endocrine gland at the base of the brain that helps regulate other endocrine organs. It is included as a high-level hormone-control concept.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR },
  { id: "concept-thyroid-gland", slug: "thyroid-gland", name: "Thyroid Gland", conceptType: "system_structure", bodySystem: "endocrine", description: "The thyroid gland is an endocrine gland in the anterior neck involved in metabolic regulation through hormones. It supports neck-region and endocrine-system education.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR, terms: [{ term: "thyroid", termType: "common" }] },
  { id: "concept-adrenal-gland", slug: "adrenal-gland", name: "Adrenal Gland", conceptType: "system_structure", bodySystem: "endocrine", description: "The adrenal glands are endocrine organs associated with stress-response and fluid-balance hormones. They are represented for broad A&P literacy and safety context.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR },
  { id: "concept-pancreatic-islet", slug: "pancreatic-islet", name: "Pancreatic Islet", conceptType: "system_structure", bodySystem: "endocrine", description: "Pancreatic islets are hormone-producing cell groups in the pancreas. They anchor blood-glucose regulation as an endocrine concept without clinical management claims.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR, terms: [{ term: "islets of Langerhans", termType: "eponym" }] },
  { id: "concept-target-cell", slug: "target-cell", name: "Target Cell", conceptType: "system_function", bodySystem: "endocrine", description: "A target cell is a cell that responds to a hormone or other signal because it has appropriate receptors. It supports hormone education and feedback-loop explanations.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR },
  { id: "concept-negative-feedback", slug: "negative-feedback", name: "Negative Feedback", conceptType: "system_function", bodySystem: "endocrine", description: "Negative feedback is a regulatory pattern in which a response reduces the original stimulus. It is central to homeostasis and endocrine control education.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR },
  { id: "concept-stress-response", slug: "stress-response", name: "Stress Response", conceptType: "system_function", bodySystem: "endocrine", description: "The stress response includes nervous and endocrine changes that help the body respond to challenge. MassageLab keeps this at general physiology level and avoids treatment claims.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR },
  { id: "concept-blood-glucose-regulation", slug: "blood-glucose-regulation", name: "Blood Glucose Regulation", conceptType: "system_function", bodySystem: "endocrine", description: "Blood glucose regulation is the control of blood sugar through endocrine and metabolic processes. It is included for A&P education and scope-aware safety literacy.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR, terms: [{ term: "blood sugar regulation", termType: "common" }] },

  { id: "concept-hypodermis", slug: "hypodermis", name: "Hypodermis", conceptType: "system_structure", bodySystem: "integumentary", description: "The hypodermis is the subcutaneous tissue layer deep to the dermis. It connects skin anatomy with superficial fascia, insulation, cushioning, and body-map depth language.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR, terms: [{ term: "subcutaneous layer", termType: "clinical" }] },
  { id: "concept-hair-follicle", slug: "hair-follicle", name: "Hair Follicle", conceptType: "system_structure", bodySystem: "integumentary", description: "A hair follicle is a skin-associated structure that produces hair. It is modeled as a basic integumentary structure for completeness and client education.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR },
  { id: "concept-sweat-gland", slug: "sweat-gland", name: "Sweat Gland", conceptType: "system_structure", bodySystem: "integumentary", description: "A sweat gland is an integumentary gland involved in sweat production and temperature regulation. It supports thermoregulation and skin-function education.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR },
  { id: "concept-sebaceous-gland", slug: "sebaceous-gland", name: "Sebaceous Gland", conceptType: "system_structure", bodySystem: "integumentary", description: "A sebaceous gland is a skin-associated gland that releases oily secretion near hair follicles. It gives the integumentary system a basic secretion concept.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR },
  { id: "concept-cutaneous-receptor", slug: "cutaneous-receptor", name: "Cutaneous Receptor", conceptType: "system_structure", bodySystem: "integumentary_sensory", description: "A cutaneous receptor is a sensory receptor associated with the skin. It bridges integumentary and sensory-system education about touch, pressure, temperature, and pain signaling.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR, terms: [{ term: "skin receptor", termType: "common" }] },
  { id: "concept-sweat-production", slug: "sweat-production", name: "Sweat Production", conceptType: "system_function", bodySystem: "integumentary", description: "Sweat production helps with temperature regulation and skin-surface physiology. It is included as general A&P context for bodywork settings.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR },
  { id: "concept-sebaceous-secretion", slug: "sebaceous-secretion", name: "Sebaceous Secretion", conceptType: "system_function", bodySystem: "integumentary", description: "Sebaceous secretion releases oily material that contributes to skin and hair surface condition. It supports basic skin-system education.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR },
  { id: "concept-skin-sensation", slug: "skin-sensation", name: "Skin Sensation", conceptType: "system_function", bodySystem: "integumentary_sensory", description: "Skin sensation includes touch, pressure, temperature, and pain-related sensory input from skin receptors. MassageLab uses this concept for education and safety language.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR },

  { id: "concept-ovary", slug: "ovary", name: "Ovary", conceptType: "system_structure", bodySystem: "reproductive", description: "An ovary is a reproductive organ associated with egg cells and reproductive hormone production. It is included for broad reproductive-system literacy.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR },
  { id: "concept-testis", slug: "testis", name: "Testis", conceptType: "system_structure", bodySystem: "reproductive", description: "A testis is a reproductive organ associated with sperm production and reproductive hormone production. It is represented for general A&P completeness.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR, terms: [{ term: "testicle", termType: "common" }] },
  { id: "concept-uterus", slug: "uterus", name: "Uterus", conceptType: "system_structure", bodySystem: "reproductive", description: "The uterus is a reproductive organ involved in pregnancy support and menstrual physiology. It is included as broad A&P content, not treatment guidance.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR },
  { id: "concept-fallopian-tube", slug: "fallopian-tube", name: "Fallopian Tube", conceptType: "system_structure", bodySystem: "reproductive", description: "A fallopian tube is a reproductive tract structure connecting the ovary region with the uterus. It supports basic reproductive-system anatomy education.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR, terms: [{ term: "uterine tube", termType: "clinical" }] },
  { id: "concept-prostate", slug: "prostate", name: "Prostate", conceptType: "system_structure", bodySystem: "reproductive", description: "The prostate is a reproductive gland associated with seminal fluid. It is represented at high level for A&P completeness and scope-aware education.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR },
  { id: "concept-gametogenesis", slug: "gametogenesis", name: "Gametogenesis", conceptType: "system_function", bodySystem: "reproductive", description: "Gametogenesis is the production of reproductive cells. It supports broad reproductive-system education without going into clinical fertility interpretation.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR },
  { id: "concept-menstrual-cycle", slug: "menstrual-cycle", name: "Menstrual Cycle", conceptType: "system_function", bodySystem: "reproductive", description: "The menstrual cycle is a recurring reproductive and endocrine pattern involving uterine and ovarian physiology. It is included as general education and client-context literacy.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR },
  { id: "concept-pregnancy-support", slug: "pregnancy-support", name: "Pregnancy Support", conceptType: "system_function", bodySystem: "reproductive", description: "Pregnancy support describes broad reproductive-system changes that support development before birth. MassageLab stores it as non-diagnostic A&P context only.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR },
  { id: "concept-lactation", slug: "lactation", name: "Lactation", conceptType: "system_function", bodySystem: "reproductive_endocrine", description: "Lactation is milk production and release involving reproductive and endocrine physiology. It is included for broad A&P coverage and postpartum education context.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR },

  { id: "concept-eye", slug: "eye", name: "Eye", conceptType: "system_structure", bodySystem: "nervous", description: "The eye is the special-sense organ for vision. It is included as a high-level nervous-system structure concept rather than a detailed ophthalmic anatomy model.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR },
  { id: "concept-ear", slug: "ear", name: "Ear", conceptType: "system_structure", bodySystem: "nervous", description: "The ear is the special-sense organ region associated with hearing and vestibular function. It supports broad nervous-system special-senses coverage.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR },
  { id: "concept-olfactory-receptor", slug: "olfactory-receptor", name: "Olfactory Receptor", conceptType: "system_structure", bodySystem: "nervous", description: "An olfactory receptor detects odor-related stimuli. It gives smell a nervous-system structural anchor in the special-senses concept set.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR },
  { id: "concept-taste-receptor", slug: "taste-receptor", name: "Taste Receptor", conceptType: "system_structure", bodySystem: "nervous", description: "A taste receptor detects chemical stimuli associated with taste. It provides a nervous-system structure concept for gustatory education.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR, terms: [{ term: "gustatory receptor", termType: "clinical" }] },
  { id: "concept-vestibular-apparatus", slug: "vestibular-apparatus", name: "Vestibular Apparatus", conceptType: "system_structure", bodySystem: "nervous", description: "The vestibular apparatus is an inner-ear structure group involved in balance and spatial orientation. It supports nervous-system movement and balance education at a high level.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR },
  { id: "concept-vision", slug: "vision", name: "Vision", conceptType: "system_function", bodySystem: "nervous", description: "Vision is the sensory function of detecting and interpreting light-related information. It is represented as a nervous-system special-sense function for exam-aligned A&P breadth.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR },
  { id: "concept-hearing", slug: "hearing", name: "Hearing", conceptType: "system_function", bodySystem: "nervous", description: "Hearing is the sensory function of detecting sound. It is modeled as broad nervous-system A&P content rather than a detailed auditory pathway atlas.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR },
  { id: "concept-smell", slug: "smell", name: "Smell", conceptType: "system_function", bodySystem: "nervous", description: "Smell is the sensory function associated with detecting odor-related chemicals. It is included for nervous-system special-senses completeness.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR, terms: [{ term: "olfaction", termType: "clinical" }] },
  { id: "concept-taste", slug: "taste", name: "Taste", conceptType: "system_function", bodySystem: "nervous", description: "Taste is the sensory function associated with detecting chemicals in food and fluid. It is represented as a nervous-system special-sense function for introductory A&P coverage.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR, terms: [{ term: "gustation", termType: "clinical" }] },
  { id: "concept-nociception", slug: "nociception", name: "Nociception", conceptType: "system_function", bodySystem: "nervous", description: "Nociception is nervous-system detection of potentially harmful stimuli. MassageLab uses the concept carefully for education and SOAP language, not pain diagnosis.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR, terms: [{ term: "pain signaling", termType: "common" }] },

  { id: "concept-ureter", slug: "ureter", name: "Ureter", conceptType: "system_structure", bodySystem: "urinary", description: "A ureter is a tube that carries urine from a kidney to the urinary bladder. It is included for urinary-system pathway completeness.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR },
  { id: "concept-urinary-bladder", slug: "urinary-bladder", name: "Urinary Bladder", conceptType: "system_structure", bodySystem: "urinary", description: "The urinary bladder stores urine before elimination. It gives urinary-system education a familiar structure while remaining outside treatment guidance.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR, terms: [{ term: "bladder", termType: "common" }] },
  { id: "concept-urethra", slug: "urethra", name: "Urethra", conceptType: "system_structure", bodySystem: "urinary", description: "The urethra is the urinary-system passage that carries urine out of the bladder. It is represented as a basic structure for A&P completeness.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR },
  { id: "concept-renal-cortex", slug: "renal-cortex", name: "Renal Cortex", conceptType: "system_structure", bodySystem: "urinary", description: "The renal cortex is an outer region of the kidney that contains many nephron components. It helps deepen kidney anatomy beyond a single organ label.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR },
  { id: "concept-renal-medulla", slug: "renal-medulla", name: "Renal Medulla", conceptType: "system_structure", bodySystem: "urinary", description: "The renal medulla is an inner kidney region involved in urine concentration pathways. It supports introductory renal anatomy and physiology education.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR },
  { id: "concept-filtration", slug: "filtration", name: "Filtration", conceptType: "system_function", bodySystem: "urinary", description: "Filtration is the movement of fluid and small substances from blood into nephron filtrate. It is a core urinary physiology concept for education.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR },
  { id: "concept-reabsorption", slug: "reabsorption", name: "Reabsorption", conceptType: "system_function", bodySystem: "urinary", description: "Reabsorption returns selected water and solutes from filtrate back toward blood. It helps explain kidney contribution to fluid and electrolyte balance.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR },
  { id: "concept-secretion", slug: "secretion", name: "Secretion", conceptType: "system_function", bodySystem: "urinary", description: "Secretion moves selected substances from blood or tissues into kidney tubule filtrate. It is modeled as a broad urinary physiology process.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR },
  { id: "concept-micturition", slug: "micturition", name: "Micturition", conceptType: "system_function", bodySystem: "urinary", description: "Micturition is the process of urination. It is included as general urinary-system function and not as a pelvic-health treatment claim.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR, terms: [{ term: "urination", termType: "common" }] },
  { id: "concept-acid-base-balance", slug: "acid-base-balance", name: "Acid-Base Balance", conceptType: "system_function", bodySystem: "urinary", description: "Acid-base balance is regulation of body fluid pH through respiratory, renal, and chemical-buffer processes. It gives urinary physiology a general homeostasis connection.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR },
]

function termSlug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

function conceptSeedRecord(concept: ConceptSpec): AnatomyConcept {
  return {
    id: concept.id,
    slug: concept.slug,
    name: concept.name,
    conceptType: concept.conceptType,
    bodySystem: concept.bodySystem,
    description: concept.description,
    sourceRef: concept.sourceRef,
  }
}

function conceptTerms(concept: ConceptSpec): AnatomyEntityTerm[] {
  return [
    {
      id: `term-${concept.slug}-preferred`,
      anatomyEntityType: "anatomy_concept",
      anatomyEntitySlug: concept.slug,
      term: concept.name,
      termType: "preferred",
      sourceRef: concept.sourceRef,
    },
    ...(concept.terms ?? []).map((term): AnatomyEntityTerm => ({
      id: `term-${concept.slug}-${term.termType}-${termSlug(term.term)}`,
      anatomyEntityType: "anatomy_concept",
      anatomyEntitySlug: concept.slug,
      term: term.term,
      termType: term.termType,
      notes: term.notes,
      sourceRef: term.sourceRef ?? concept.sourceRef,
    })),
  ]
}

function conceptCitation(concept: ConceptSpec): AnatomyCitation {
  return {
    id: `citation-concept-${concept.slug}-clinical-summary`,
    slug: `citation-concept-${concept.slug}-clinical-summary`,
    entityType: "anatomy_concept",
    entitySlug: concept.slug,
    factType: "clinical_summary",
    factSlug: `concept:${concept.slug}`,
    sourceRef: concept.sourceRef,
    sourceLocator: concept.locator,
    citationNote: "Reviewed commercial-compatible physiology support for MassageLab-authored remaining-body-system concept summary. Do not copy source prose directly.",
    reviewStatus: "reviewed",
  }
}

export const REMAINING_BODY_SYSTEM_CONCEPTS_SECTION: AnatomySeedSection = {
  concepts: CONCEPTS.map(conceptSeedRecord),
  entityTerms: CONCEPTS.flatMap(conceptTerms),
  citations: CONCEPTS.map(conceptCitation),
}
