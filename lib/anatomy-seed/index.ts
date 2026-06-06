import { CARDIORESPIRATORY_LYMPHATIC_CONCEPTS_SECTION } from "./cardiorespiratory-lymphatic-concepts.ts"
import { BODY_SYSTEM_CONCEPTS_SECTION } from "./body-system-concepts.ts"
import { AXIAL_BONE_ONTOLOGY_IDENTIFIERS_SECTION } from "./axial-bone-ontology-identifiers.ts"
import { BONE_LANDMARK_CITATION_MATURITY_SECTION } from "./bone-landmark-citation-maturity.ts"
import { CRANIOFACIAL_PELVIC_BONE_ONTOLOGY_IDENTIFIERS_SECTION } from "./craniofacial-pelvic-bone-ontology-identifiers.ts"
import { DERMATOME_MYOTOME_ATLAS_SECTION } from "./dermatome-myotome-atlas.ts"
import { GROSS_BODY_SYSTEM_STRUCTURES_SECTION } from "./gross-body-system-structures.ts"
import { ATLAS_BONE_DETAIL_SECTION } from "./atlas-bone-detail.ts"
import { ATLAS_COMPLETENESS_CLOSURE_SECTION } from "./atlas-completeness-closure.ts"
import { ATLAS_DEPTH_EXPANSION_SECTION } from "./atlas-depth-expansion.ts"
import { ATLAS_GAP_CLOSURE_SECTION } from "./atlas-gap-closure.ts"
import { FASCIAL_LYMPHATIC_ATLAS_SECTION } from "./fascial-lymphatic-atlas.ts"
import { HAND_FOOT_BONE_ONTOLOGY_IDENTIFIERS_SECTION } from "./hand-foot-bone-ontology-identifiers.ts"
import { HEAD_FACE_JAW_SECTION } from "./head-face-jaw.ts"
import { INDIVIDUAL_BONE_LANDMARK_ATLAS_SECTION } from "./individual-bone-landmark-atlas.ts"
import { JOINT_MOVEMENT_COMPLETENESS_ATLAS_SECTION } from "./joint-movement-completeness-atlas.ts"
import { LEGACY_ANATOMIME_COVERAGE_SECTION } from "./legacy-anatomime-coverage.ts"
import { LOWER_LIMB_SECTION } from "./lower-limb.ts"
import { LIGAMENT_RELATIONSHIP_ATLAS_SECTION } from "./ligament-relationship-atlas.ts"
import { MEDIA_BODYPARTS3D_BLOOD_SUPPLY_MULTIVIEW_SECTION } from "./media-bodyparts3d-blood-supply-multiview.ts"
import { MEDIA_BODYPARTS3D_BONE_MULTIVIEW_SECTION } from "./media-bodyparts3d-bone-multiview.ts"
import { MEDIA_BODYPARTS3D_MUSCLE_BATCH_2_SECTION } from "./media-bodyparts3d-muscle-batch-2.ts"
import { MEDIA_BODYPARTS3D_MUSCLE_MULTIVIEW_SECTION } from "./media-bodyparts3d-muscle-multiview.ts"
import { MEDIA_COVERAGE_GAP_BATCH_SECTION } from "./media-coverage-gap-batch.ts"
import { MEDIA_R2_STARTER_SECTION } from "./media-r2-starter.ts"
import { MEDIA_SERVIER_BODY_ATLAS_SECTION } from "./media-servier-body-atlas.ts"
import { MEDIA_SERVIER_BODY_SYSTEMS_SECTION } from "./media-servier-body-systems.ts"
import { MEDIA_SERVIER_LOCOMOTOR_SECTION } from "./media-servier-locomotor.ts"
import { MEDIA_SERVIER_ORGAN_DETAIL_SECTION } from "./media-servier-organ-detail.ts"
import { MEDIA_SERVIER_STARTER_SECTION } from "./media-servier-starter.ts"
import { METAPODIAL_BONE_ONTOLOGY_IDENTIFIERS_SECTION } from "./metapodial-bone-ontology-identifiers.ts"
import { MOVEMENT_TISSUE_CONCEPTS_SECTION } from "./movement-tissue-concepts.ts"
import { NECK_SHOULDER_UPPER_BACK_SECTION } from "./neck-shoulder-upper-back.ts"
import { NEUROVASCULAR_RELATIONSHIP_COMPLETENESS_ATLAS_SECTION } from "./neurovascular-relationship-completeness-atlas.ts"
import { NERVOUS_SYSTEM_CONCEPTS_SECTION } from "./nervous-system-concepts.ts"
import { PHALANGEAL_BONE_ONTOLOGY_IDENTIFIERS_SECTION } from "./phalangeal-bone-ontology-identifiers.ts"
import { PHYSIOLOGY_CONCEPTS_CORE_SECTION } from "./physiology-concepts-core.ts"
import { RANGE_OF_MOTION_PROTOCOL_ATLAS_SECTION } from "./range-of-motion-protocol-atlas.ts"
import { REMAINING_BODY_SYSTEM_CONCEPTS_SECTION } from "./remaining-body-system-concepts.ts"
import { SOFT_TISSUE_ATLAS_SECTION } from "./soft-tissue-atlas.ts"
import { SOURCES_SEED_SECTION } from "./sources.ts"
import { SPATIAL_BODY_MAP_FOUNDATION_SECTION } from "./spatial-body-map-foundation.ts"
import { STRUCTURE_RELATIONSHIP_COMPLETENESS_ATLAS_SECTION } from "./structure-relationship-completeness-atlas.ts"
import { TRUNK_SPINE_PELVIS_SECTION } from "./trunk-spine-pelvis.ts"
import { UPPER_LIMB_SECTION } from "./upper-limb.ts"
import { VASCULAR_LYMPHATIC_ATLAS_CLOSURE_SECTION } from "./vascular-lymphatic-atlas-closure.ts"
import { WHOLE_BODY_SCAFFOLD_SECTION } from "./whole-body-scaffold.ts"
import { mergeAnatomySeedSections } from "./sections.ts"
import type { AnatomySeedSection } from "./sections.ts"

export { mergeAnatomySeedSections }
export type { AnatomySeedSection }

export const ANATOMY_SEED_SECTION_NAMES = [
  "sources",
  "physiology-concepts-core",
  "body-system-concepts",
  "cardiorespiratory-lymphatic-concepts",
  "remaining-body-system-concepts",
  "nervous-system-concepts",
  "movement-tissue-concepts",
  "gross-body-system-structures",
  "whole-body-scaffold",
  "atlas-bone-detail",
  "atlas-gap-closure",
  "atlas-completeness-closure",
  "atlas-depth-expansion",
  "soft-tissue-atlas",
  "fascial-lymphatic-atlas",
  "dermatome-myotome-atlas",
  "ligament-relationship-atlas",
  "individual-bone-landmark-atlas",
  "bone-landmark-citation-maturity",
  "joint-movement-completeness-atlas",
  "range-of-motion-protocol-atlas",
  "axial-bone-ontology-identifiers",
  "hand-foot-bone-ontology-identifiers",
  "metapodial-bone-ontology-identifiers",
  "phalangeal-bone-ontology-identifiers",
  "craniofacial-pelvic-bone-ontology-identifiers",
  "structure-relationship-completeness-atlas",
  "neurovascular-relationship-completeness-atlas",
  "vascular-lymphatic-atlas-closure",
  "media-r2-starter",
  "media-servier-starter",
  "media-servier-body-systems",
  "media-servier-locomotor",
  "media-servier-body-atlas",
  "media-servier-organ-detail",
  "media-coverage-gap-batch",
  "media-bodyparts3d-blood-supply-multiview",
  "media-bodyparts3d-bone-multiview",
  "media-bodyparts3d-muscle-batch-2",
  "media-bodyparts3d-muscle-multiview",
  "spatial-body-map-foundation",
  "neck-shoulder-upper-back",
  "trunk-spine-pelvis",
  "upper-limb",
  "lower-limb",
  "head-face-jaw",
  "legacy-anatomime-coverage",
] as const

export const ANATOMY_SEED_SECTIONS: AnatomySeedSection[] = [
  SOURCES_SEED_SECTION,
  PHYSIOLOGY_CONCEPTS_CORE_SECTION,
  BODY_SYSTEM_CONCEPTS_SECTION,
  CARDIORESPIRATORY_LYMPHATIC_CONCEPTS_SECTION,
  REMAINING_BODY_SYSTEM_CONCEPTS_SECTION,
  NERVOUS_SYSTEM_CONCEPTS_SECTION,
  MOVEMENT_TISSUE_CONCEPTS_SECTION,
  GROSS_BODY_SYSTEM_STRUCTURES_SECTION,
  WHOLE_BODY_SCAFFOLD_SECTION,
  ATLAS_BONE_DETAIL_SECTION,
  ATLAS_GAP_CLOSURE_SECTION,
  ATLAS_COMPLETENESS_CLOSURE_SECTION,
  ATLAS_DEPTH_EXPANSION_SECTION,
  SOFT_TISSUE_ATLAS_SECTION,
  FASCIAL_LYMPHATIC_ATLAS_SECTION,
  DERMATOME_MYOTOME_ATLAS_SECTION,
  LIGAMENT_RELATIONSHIP_ATLAS_SECTION,
  INDIVIDUAL_BONE_LANDMARK_ATLAS_SECTION,
  BONE_LANDMARK_CITATION_MATURITY_SECTION,
  JOINT_MOVEMENT_COMPLETENESS_ATLAS_SECTION,
  RANGE_OF_MOTION_PROTOCOL_ATLAS_SECTION,
  AXIAL_BONE_ONTOLOGY_IDENTIFIERS_SECTION,
  HAND_FOOT_BONE_ONTOLOGY_IDENTIFIERS_SECTION,
  METAPODIAL_BONE_ONTOLOGY_IDENTIFIERS_SECTION,
  PHALANGEAL_BONE_ONTOLOGY_IDENTIFIERS_SECTION,
  CRANIOFACIAL_PELVIC_BONE_ONTOLOGY_IDENTIFIERS_SECTION,
  STRUCTURE_RELATIONSHIP_COMPLETENESS_ATLAS_SECTION,
  NEUROVASCULAR_RELATIONSHIP_COMPLETENESS_ATLAS_SECTION,
  VASCULAR_LYMPHATIC_ATLAS_CLOSURE_SECTION,
  MEDIA_R2_STARTER_SECTION,
  MEDIA_SERVIER_STARTER_SECTION,
  MEDIA_SERVIER_BODY_SYSTEMS_SECTION,
  MEDIA_SERVIER_LOCOMOTOR_SECTION,
  MEDIA_SERVIER_BODY_ATLAS_SECTION,
  MEDIA_SERVIER_ORGAN_DETAIL_SECTION,
  MEDIA_COVERAGE_GAP_BATCH_SECTION,
  MEDIA_BODYPARTS3D_BLOOD_SUPPLY_MULTIVIEW_SECTION,
  MEDIA_BODYPARTS3D_BONE_MULTIVIEW_SECTION,
  MEDIA_BODYPARTS3D_MUSCLE_BATCH_2_SECTION,
  MEDIA_BODYPARTS3D_MUSCLE_MULTIVIEW_SECTION,
  SPATIAL_BODY_MAP_FOUNDATION_SECTION,
  NECK_SHOULDER_UPPER_BACK_SECTION,
  TRUNK_SPINE_PELVIS_SECTION,
  UPPER_LIMB_SECTION,
  LOWER_LIMB_SECTION,
  HEAD_FACE_JAW_SECTION,
  LEGACY_ANATOMIME_COVERAGE_SECTION,
]
