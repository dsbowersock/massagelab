import type { AnatomyCitation, AnatomyConcept, AnatomyEntityTerm, AnatomyRelationship } from "../anatomy-foundation.ts"
import type { AnatomySeedSection } from "./sections.ts"

type TissueTypeSlug = "epithelial-tissue" | "connective-tissue" | "muscle-tissue" | "nervous-tissue"

type TermSpec = {
  term: string
  termType: "preferred" | "formal" | "common" | "clinical" | "historical" | "eponym" | "abbreviation" | "alternate"
}

type ConceptSpec = AnatomyConcept & {
  tissueTypeSlugs: TissueTypeSlug[]
  terms?: TermSpec[]
}

const SOURCE = "openstax-anatomy-physiology"
const LOCATOR = "OpenStax Anatomy and Physiology 4.1 tissue-type and tissue-membrane review source; MassageLab-authored summary."

const CONCEPTS: ConceptSpec[] = [
  {
    id: "concept-epithelium",
    slug: "epithelium",
    name: "Epithelium",
    conceptType: "tissue_subtype",
    description: "Epithelium is sheet-like tissue that covers body surfaces, lines cavities and passageways, and forms many glands. It gives epithelial tissue a reusable textbook-level anchor.",
    sourceRef: SOURCE,
    tissueTypeSlugs: ["epithelial-tissue"],
    terms: [{ term: "epithelial tissue layer", termType: "common" }],
  },
  {
    id: "concept-simple-squamous-epithelium",
    slug: "simple-squamous-epithelium",
    name: "Simple Squamous Epithelium",
    conceptType: "tissue_subtype",
    description: "Simple squamous epithelium is a thin epithelial subtype suited to exchange, filtration, and low-friction lining contexts in introductory A&P.",
    sourceRef: SOURCE,
    tissueTypeSlugs: ["epithelial-tissue"],
  },
  {
    id: "concept-simple-cuboidal-epithelium",
    slug: "simple-cuboidal-epithelium",
    name: "Simple Cuboidal Epithelium",
    conceptType: "tissue_subtype",
    description: "Simple cuboidal epithelium is an epithelial subtype often used to describe small glandular and tubular lining contexts in broad anatomy education.",
    sourceRef: SOURCE,
    tissueTypeSlugs: ["epithelial-tissue"],
  },
  {
    id: "concept-simple-columnar-epithelium",
    slug: "simple-columnar-epithelium",
    name: "Simple Columnar Epithelium",
    conceptType: "tissue_subtype",
    description: "Simple columnar epithelium is an epithelial subtype associated with absorption, secretion, and lining of many hollow-organ surfaces.",
    sourceRef: SOURCE,
    tissueTypeSlugs: ["epithelial-tissue"],
  },
  {
    id: "concept-stratified-squamous-epithelium",
    slug: "stratified-squamous-epithelium",
    name: "Stratified Squamous Epithelium",
    conceptType: "tissue_subtype",
    description: "Stratified squamous epithelium is a layered epithelial subtype that supports protection in body-surface and passageway contexts.",
    sourceRef: SOURCE,
    tissueTypeSlugs: ["epithelial-tissue"],
  },
  {
    id: "concept-glandular-epithelium",
    slug: "glandular-epithelium",
    name: "Glandular Epithelium",
    conceptType: "tissue_subtype",
    description: "Glandular epithelium describes epithelial cells organized for secretion. It connects glands, skin, digestive organs, and endocrine education without duplicating every gland type.",
    sourceRef: SOURCE,
    tissueTypeSlugs: ["epithelial-tissue"],
  },
  {
    id: "concept-epithelial-membrane",
    slug: "epithelial-membrane",
    name: "Epithelial Membrane",
    conceptType: "tissue_membrane",
    description: "An epithelial membrane combines epithelium with supporting connective tissue. It is a parent concept for mucous, serous, and cutaneous membranes.",
    sourceRef: SOURCE,
    tissueTypeSlugs: ["epithelial-tissue", "connective-tissue"],
  },
  {
    id: "concept-mucous-membrane",
    slug: "mucous-membrane",
    name: "Mucous Membrane",
    conceptType: "tissue_membrane",
    description: "A mucous membrane lines body passageways that open to the exterior, including digestive, respiratory, urinary, and reproductive tracts.",
    sourceRef: SOURCE,
    tissueTypeSlugs: ["epithelial-tissue", "connective-tissue"],
    terms: [{ term: "mucosa", termType: "clinical" }],
  },
  {
    id: "concept-serous-membrane",
    slug: "serous-membrane",
    name: "Serous Membrane",
    conceptType: "tissue_membrane",
    description: "A serous membrane lines closed body cavities and covers organs within them, using mesothelium supported by connective tissue.",
    sourceRef: SOURCE,
    tissueTypeSlugs: ["epithelial-tissue", "connective-tissue"],
  },
  {
    id: "concept-cutaneous-membrane",
    slug: "cutaneous-membrane",
    name: "Cutaneous Membrane",
    conceptType: "tissue_membrane",
    bodySystem: "integumentary",
    description: "The cutaneous membrane is the skin as a tissue membrane, combining epithelial epidermis with underlying connective tissue support.",
    sourceRef: SOURCE,
    tissueTypeSlugs: ["epithelial-tissue", "connective-tissue"],
    terms: [{ term: "skin membrane", termType: "common" }],
  },
  {
    id: "concept-connective-tissue-membrane",
    slug: "connective-tissue-membrane",
    name: "Connective Tissue Membrane",
    conceptType: "tissue_membrane",
    description: "A connective tissue membrane is formed from connective tissue rather than an epithelial lining. Synovial membranes are the key introductory example.",
    sourceRef: SOURCE,
    tissueTypeSlugs: ["connective-tissue"],
  },
  {
    id: "concept-synovial-membrane",
    slug: "synovial-membrane",
    name: "Synovial Membrane",
    conceptType: "tissue_membrane",
    bodySystem: "skeletal",
    description: "A synovial membrane lines freely movable joint cavities and produces fluid associated with low-friction movement.",
    sourceRef: SOURCE,
    tissueTypeSlugs: ["connective-tissue"],
    terms: [{ term: "synovium", termType: "clinical" }],
  },
  {
    id: "concept-loose-connective-tissue",
    slug: "loose-connective-tissue",
    name: "Loose Connective Tissue",
    conceptType: "tissue_subtype",
    description: "Loose connective tissue supports and binds structures with a more open matrix organization. It helps explain superficial fascia and lamina propria contexts.",
    sourceRef: SOURCE,
    tissueTypeSlugs: ["connective-tissue"],
  },
  {
    id: "concept-dense-connective-tissue",
    slug: "dense-connective-tissue",
    name: "Dense Connective Tissue",
    conceptType: "tissue_subtype",
    description: "Dense connective tissue contains more concentrated fibers and is a useful parent concept for tendons, ligaments, capsules, and fascial sheets.",
    sourceRef: SOURCE,
    tissueTypeSlugs: ["connective-tissue"],
  },
  {
    id: "concept-adipose-tissue",
    slug: "adipose-tissue",
    name: "Adipose Tissue",
    conceptType: "tissue_subtype",
    description: "Adipose tissue is connective tissue specialized for energy storage, insulation, and padding. It supports hypodermis and superficial anatomy education.",
    sourceRef: SOURCE,
    tissueTypeSlugs: ["connective-tissue"],
    terms: [{ term: "fat tissue", termType: "common" }],
  },
  {
    id: "concept-cartilage",
    slug: "cartilage",
    name: "Cartilage",
    conceptType: "tissue_subtype",
    bodySystem: "skeletal",
    description: "Cartilage is supportive connective tissue found in joints and other structural regions. It anchors skeletal-system and tissue-type learning.",
    sourceRef: SOURCE,
    tissueTypeSlugs: ["connective-tissue"],
  },
  {
    id: "concept-bone-tissue",
    slug: "bone-tissue",
    name: "Bone Tissue",
    conceptType: "tissue_subtype",
    bodySystem: "skeletal",
    description: "Bone tissue is mineralized connective tissue that supports, protects, stores minerals, and provides leverage for movement.",
    sourceRef: SOURCE,
    tissueTypeSlugs: ["connective-tissue"],
    terms: [{ term: "osseous tissue", termType: "clinical" }],
  },
  {
    id: "concept-blood",
    slug: "blood",
    name: "Blood",
    conceptType: "tissue_subtype",
    bodySystem: "cardiovascular",
    description: "Blood is a fluid connective tissue transported through the cardiovascular system. It supports circulation, transport, and tissue-type classification.",
    sourceRef: SOURCE,
    tissueTypeSlugs: ["connective-tissue"],
  },
  {
    id: "concept-extracellular-matrix",
    slug: "extracellular-matrix",
    name: "Extracellular Matrix",
    conceptType: "tissue_structure",
    description: "The extracellular matrix is non-cellular material around cells, especially important in connective tissue organization, support, and load transfer.",
    sourceRef: SOURCE,
    tissueTypeSlugs: ["connective-tissue"],
    terms: [{ term: "ECM", termType: "abbreviation" }],
  },
  {
    id: "concept-collagen-fiber",
    slug: "collagen-fiber",
    name: "Collagen Fiber",
    conceptType: "tissue_structure",
    description: "Collagen fibers are connective-tissue fibers that contribute tensile strength in fascia, tendons, ligaments, skin, capsules, and many organ supports.",
    sourceRef: SOURCE,
    tissueTypeSlugs: ["connective-tissue"],
  },
  {
    id: "concept-skeletal-muscle-tissue",
    slug: "skeletal-muscle-tissue",
    name: "Skeletal Muscle Tissue",
    conceptType: "tissue_subtype",
    bodySystem: "muscular",
    description: "Skeletal muscle tissue is voluntary striated muscle tissue associated with movement, posture, and force production.",
    sourceRef: SOURCE,
    tissueTypeSlugs: ["muscle-tissue"],
  },
  {
    id: "concept-cardiac-muscle-tissue",
    slug: "cardiac-muscle-tissue",
    name: "Cardiac Muscle Tissue",
    conceptType: "tissue_subtype",
    bodySystem: "cardiovascular",
    description: "Cardiac muscle tissue is striated involuntary muscle tissue in the heart wall. It connects tissue classification with cardiovascular anatomy.",
    sourceRef: SOURCE,
    tissueTypeSlugs: ["muscle-tissue"],
  },
  {
    id: "concept-smooth-muscle-tissue",
    slug: "smooth-muscle-tissue",
    name: "Smooth Muscle Tissue",
    conceptType: "tissue_subtype",
    description: "Smooth muscle tissue is involuntary muscle tissue in many hollow organs and vessels. It supports digestive, respiratory, urinary, reproductive, and vascular physiology context.",
    sourceRef: SOURCE,
    tissueTypeSlugs: ["muscle-tissue"],
  },
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
      sourceRef: concept.sourceRef,
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
    sourceLocator: LOCATOR,
    citationNote: "Reviewed commercial-compatible support for MassageLab-authored tissue taxonomy summary. Do not copy source prose directly.",
    reviewStatus: "reviewed",
  }
}

function tissueTypeRelationships(concept: ConceptSpec): AnatomyRelationship[] {
  return concept.tissueTypeSlugs.map((tissueTypeSlug) => ({
    id: `relationship-tissue-taxonomy-${concept.slug}-belongs-to-${tissueTypeSlug}`,
    sourceEntityType: "anatomy_concept",
    sourceEntitySlug: concept.slug,
    relationshipType: "belongs_to_tissue_type",
    targetEntityType: "anatomy_concept",
    targetEntitySlug: tissueTypeSlug,
    details: { source: "tissue-taxonomy-seed" },
    sourceRef: concept.sourceRef,
  }))
}

export const TISSUE_TAXONOMY_CONCEPTS_SECTION: AnatomySeedSection = {
  concepts: CONCEPTS.map(conceptSeedRecord),
  entityTerms: CONCEPTS.flatMap(conceptTerms),
  relationships: CONCEPTS.flatMap(tissueTypeRelationships),
  citations: CONCEPTS.map(conceptCitation),
}
