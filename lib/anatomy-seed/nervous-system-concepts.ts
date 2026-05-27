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
const LOCATOR = "OpenStax CNX Human Biology nervous-system review source; MassageLab-authored summary."

const CONCEPTS: ConceptSpec[] = [
  { id: "concept-nervous-system", slug: "nervous-system", name: "Nervous System", conceptType: "system_structure", bodySystem: "nervous", description: "The nervous system includes the brain, spinal cord, nerves, sensory receptors, and supporting cells that coordinate signaling and body responses. MassageLab uses this as broad A&P context, not diagnostic neurology.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR },
  { id: "concept-central-nervous-system", slug: "central-nervous-system", name: "Central Nervous System", conceptType: "system_structure", bodySystem: "nervous", description: "The central nervous system includes the brain and spinal cord. It organizes incoming sensory information, motor output, and many regulatory functions.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR, terms: [{ term: "CNS", termType: "abbreviation" }] },
  { id: "concept-peripheral-nervous-system", slug: "peripheral-nervous-system", name: "Peripheral Nervous System", conceptType: "system_structure", bodySystem: "nervous", description: "The peripheral nervous system includes nerves and ganglia outside the brain and spinal cord. It connects central processing with muscles, skin, joints, organs, and sensory receptors.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR, terms: [{ term: "PNS", termType: "abbreviation" }] },
  { id: "concept-brain", slug: "brain", name: "Brain", conceptType: "system_structure", bodySystem: "nervous", description: "The brain is the central nervous-system organ that supports perception, movement planning, autonomic regulation, cognition, and many body-control processes.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR },
  { id: "concept-spinal-cord", slug: "spinal-cord", name: "Spinal Cord", conceptType: "system_structure", bodySystem: "nervous", description: "The spinal cord is the central nervous-system pathway inside the vertebral canal. It carries information between brain and body and participates in reflex activity.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR },
  { id: "concept-neuron", slug: "neuron", name: "Neuron", conceptType: "system_structure", bodySystem: "nervous", description: "A neuron is a nerve cell specialized for receiving, processing, and transmitting information. It anchors education about nerve impulses, synapses, and motor or sensory signaling.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR, terms: [{ term: "nerve cell", termType: "common" }] },
  { id: "concept-glial-cell", slug: "glial-cell", name: "Glial Cell", conceptType: "system_structure", bodySystem: "nervous", description: "A glial cell is a nervous-system support cell involved in maintaining, insulating, nourishing, or protecting neural tissue. It provides context beyond neurons alone.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR, terms: [{ term: "neuroglia", termType: "clinical" }] },
  { id: "concept-cranial-nerve", slug: "cranial-nerve", name: "Cranial Nerve", conceptType: "system_structure", bodySystem: "nervous", description: "A cranial nerve is a peripheral nerve associated with the brain and head region. It supports head, face, jaw, neck, and autonomic anatomy education.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR },
  { id: "concept-spinal-nerve", slug: "spinal-nerve", name: "Spinal Nerve", conceptType: "system_structure", bodySystem: "nervous", description: "A spinal nerve is a mixed peripheral nerve associated with the spinal cord. It helps connect regional musculoskeletal anatomy with motor, sensory, and autonomic pathways.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR },
  { id: "concept-autonomic-nervous-system", slug: "autonomic-nervous-system", name: "Autonomic Nervous System", conceptType: "system_structure", bodySystem: "nervous", description: "The autonomic nervous system is the division of the nervous system that regulates many involuntary body functions. MassageLab keeps this as physiology education, not a treatment-effect claim.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR, terms: [{ term: "ANS", termType: "abbreviation" }] },
  { id: "concept-somatic-nervous-system", slug: "somatic-nervous-system", name: "Somatic Nervous System", conceptType: "system_structure", bodySystem: "nervous", description: "The somatic nervous system connects voluntary skeletal muscle control and body sensation with the central nervous system. It supports movement and palpation education.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR },
  { id: "concept-nerve-impulse", slug: "nerve-impulse", name: "Nerve Impulse", conceptType: "system_function", bodySystem: "nervous", description: "A nerve impulse is an electrical signaling event along a neuron. It provides a simple bridge from nervous-system structure to motor, sensory, and reflex function.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR },
  { id: "concept-action-potential", slug: "action-potential", name: "Action Potential", conceptType: "system_function", bodySystem: "nervous", description: "An action potential is a rapid electrical change that travels along an excitable cell membrane. It is core language for nerve and muscle signaling education.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR },
  { id: "concept-synapse", slug: "synapse", name: "Synapse", conceptType: "system_function", bodySystem: "nervous", description: "A synapse is a communication site between neurons or between a neuron and another target cell. It supports education about neural signaling without clinical interpretation.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR },
  { id: "concept-neurotransmitter", slug: "neurotransmitter", name: "Neurotransmitter", conceptType: "system_function", bodySystem: "nervous", description: "A neurotransmitter is a chemical messenger used in nervous-system signaling. It helps explain synapses, neuromuscular junctions, and autonomic communication at a basic level.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR },
  { id: "concept-reflex-arc", slug: "reflex-arc", name: "Reflex Arc", conceptType: "system_function", bodySystem: "nervous", description: "A reflex arc is a nervous-system pathway that produces a rapid response to a stimulus. It supports education about stretch reflexes, protective responses, and movement control.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR },
  { id: "concept-motor-control", slug: "motor-control", name: "Motor Control", conceptType: "system_function", bodySystem: "nervous", description: "Motor control is nervous-system coordination of posture and movement. It connects muscles, joints, proprioceptors, and the central nervous system for movement education.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR },
  { id: "concept-sensory-processing", slug: "sensory-processing", name: "Sensory Processing", conceptType: "system_function", bodySystem: "nervous", description: "Sensory processing is the nervous system's handling of incoming information from receptors. It supports scope-aware explanations of touch, pressure, temperature, and body awareness.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR },
  { id: "concept-autonomic-regulation", slug: "autonomic-regulation", name: "Autonomic Regulation", conceptType: "system_function", bodySystem: "nervous", description: "Autonomic regulation is nervous-system control of many involuntary functions such as heart rate, digestion, sweating, and blood vessel tone. It is stored for A&P literacy only.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR },
  { id: "concept-sympathetic-division", slug: "sympathetic-division", name: "Sympathetic Division", conceptType: "system_function", bodySystem: "nervous", description: "The sympathetic division is an autonomic nervous-system subdivision associated with mobilizing body responses. MassageLab represents it as physiology education without making treatment claims.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR },
  { id: "concept-parasympathetic-division", slug: "parasympathetic-division", name: "Parasympathetic Division", conceptType: "system_function", bodySystem: "nervous", description: "The parasympathetic division is an autonomic nervous-system subdivision associated with restorative and digestive body functions. It is included as broad physiology context.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR },
  { id: "concept-neural-plasticity", slug: "neural-plasticity", name: "Neural Plasticity", conceptType: "system_function", bodySystem: "nervous", description: "Neural plasticity is the nervous system's capacity to change connections or responses over time. It supports cautious education about learning, adaptation, and movement practice.", sourceRef: PHYSIOLOGY_SOURCE, locator: LOCATOR, terms: [{ term: "neuroplasticity", termType: "alternate" }] },
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
    citationNote: "Reviewed commercial-compatible physiology support for MassageLab-authored nervous-system concept summary. Do not copy source prose directly.",
    reviewStatus: "reviewed",
  }
}

export const NERVOUS_SYSTEM_CONCEPTS_SECTION: AnatomySeedSection = {
  concepts: CONCEPTS.map(conceptSeedRecord),
  entityTerms: CONCEPTS.flatMap(conceptTerms),
  citations: CONCEPTS.map(conceptCitation),
}
