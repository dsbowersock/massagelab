import type { AnatomySeedSection } from "./sections.ts"

const APPLIED_HUMAN_ANATOMY_SOURCE = "applied-human-anatomy"
const APPLIED_HUMAN_ANATOMY_LOCATOR = "https://open.umn.edu/opentextbooks/textbooks/1266"

type CitationRow = NonNullable<AnatomySeedSection["citations"]>[number]
type RelationshipRow = NonNullable<AnatomySeedSection["relationships"]>[number]

type LigamentRelationshipSpec = {
  ligament: string
  relationshipType: string
  targetEntityType: RelationshipRow["targetEntityType"]
  targetEntitySlug: string
  note: string
}

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

function relationshipId(spec: LigamentRelationshipSpec) {
  return `relationship-${spec.ligament}-${slugify(spec.relationshipType)}-${slugify(spec.targetEntityType)}-${spec.targetEntitySlug}`
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

const LIGAMENT_RELATIONSHIP_SPECS: LigamentRelationshipSpec[] = [
  { ligament: "nuchal-ligament", relationshipType: "stabilizes", targetEntityType: "joint", targetEntitySlug: "cervical-spine", note: "Midline posterior cervical ligament support for cervical spine posture and posterior neck attachments." },
  { ligament: "nuchal-ligament", relationshipType: "attaches_to", targetEntityType: "bone", targetEntitySlug: "occipital-bone", note: "Superior nuchal ligament attachment context at the occipital region." },
  { ligament: "nuchal-ligament", relationshipType: "attaches_to", targetEntityType: "bone", targetEntitySlug: "cervical-vertebrae", note: "Posterior cervical vertebral attachment context for the nuchal ligament." },

  { ligament: "alar-ligament", relationshipType: "stabilizes", targetEntityType: "joint", targetEntitySlug: "atlanto-occipital", note: "Craniovertebral stabilizing relationship between occipital bone and upper cervical axis region." },
  { ligament: "alar-ligament", relationshipType: "limits_rotation_of", targetEntityType: "joint", targetEntitySlug: "atlantoaxial", note: "Upper cervical rotation check ligament relationship." },
  { ligament: "alar-ligament", relationshipType: "attaches_to", targetEntityType: "bone", targetEntitySlug: "occipital-bone", note: "Occipital attachment side of the alar ligament relationship." },
  { ligament: "alar-ligament", relationshipType: "attaches_to", targetEntityType: "bone", targetEntitySlug: "axis", note: "Dens/axis attachment side of the alar ligament relationship." },

  { ligament: "transverse-ligament-of-atlas", relationshipType: "stabilizes", targetEntityType: "joint", targetEntitySlug: "atlantoaxial", note: "Atlantoaxial stabilization relationship for the dens and atlas." },
  { ligament: "transverse-ligament-of-atlas", relationshipType: "holds_against", targetEntityType: "bone", targetEntitySlug: "axis", note: "Relationship describing retention of the dens of the axis against the atlas." },
  { ligament: "transverse-ligament-of-atlas", relationshipType: "attaches_to", targetEntityType: "bone", targetEntitySlug: "atlas", note: "Atlas attachment context for the transverse ligament." },

  { ligament: "acromioclavicular-ligament", relationshipType: "stabilizes", targetEntityType: "joint", targetEntitySlug: "acromioclavicular", note: "Capsular stabilizing relationship for the AC joint." },
  { ligament: "acromioclavicular-ligament", relationshipType: "connects", targetEntityType: "bone", targetEntitySlug: "clavicle", note: "Clavicular side of the AC ligament relationship." },
  { ligament: "acromioclavicular-ligament", relationshipType: "connects", targetEntityType: "bone", targetEntitySlug: "scapula", note: "Acromial/scapular side of the AC ligament relationship." },

  { ligament: "coracoclavicular-ligament", relationshipType: "stabilizes", targetEntityType: "joint", targetEntitySlug: "acromioclavicular", note: "Strong vertical stabilizing relationship for the lateral clavicle and scapula." },
  { ligament: "coracoclavicular-ligament", relationshipType: "connects", targetEntityType: "bone", targetEntitySlug: "clavicle", note: "Clavicular side of conoid/trapezoid coracoclavicular support." },
  { ligament: "coracoclavicular-ligament", relationshipType: "connects", targetEntityType: "bone", targetEntitySlug: "scapula", note: "Coracoid/scapular side of the coracoclavicular ligament relationship." },

  { ligament: "coracoacromial-ligament", relationshipType: "forms_arch_over", targetEntityType: "joint", targetEntitySlug: "glenohumeral", note: "Coracoacromial arch relationship superior to the glenohumeral region." },
  { ligament: "coracoacromial-ligament", relationshipType: "connects", targetEntityType: "bone", targetEntitySlug: "scapula", note: "Scapular coracoid-to-acromion relationship." },
  { ligament: "coracoacromial-ligament", relationshipType: "related_to", targetEntityType: "anatomy_structure", targetEntitySlug: "subacromial-subdeltoid-bursa", note: "Subacromial-region contextual relationship." },

  { ligament: "coracohumeral-ligament", relationshipType: "stabilizes", targetEntityType: "joint", targetEntitySlug: "glenohumeral", note: "Superior/anterior shoulder capsule stabilizing relationship." },
  { ligament: "coracohumeral-ligament", relationshipType: "connects", targetEntityType: "bone", targetEntitySlug: "scapula", note: "Coracoid/scapular origin context." },
  { ligament: "coracohumeral-ligament", relationshipType: "connects", targetEntityType: "bone", targetEntitySlug: "humerus", note: "Proximal humeral attachment context." },

  { ligament: "glenohumeral-ligaments", relationshipType: "stabilizes", targetEntityType: "joint", targetEntitySlug: "glenohumeral", note: "Capsular thickenings stabilizing the shoulder joint across arm positions." },
  { ligament: "glenohumeral-ligaments", relationshipType: "reinforces_capsule_of", targetEntityType: "joint", targetEntitySlug: "glenohumeral", note: "Anterior/inferior shoulder capsule reinforcement relationship." },
  { ligament: "glenohumeral-ligaments", relationshipType: "related_to", targetEntityType: "anatomy_structure", targetEntitySlug: "glenoid-labrum", note: "Joint-capsule and labral region context." },

  { ligament: "sternoclavicular-ligaments", relationshipType: "stabilizes", targetEntityType: "joint", targetEntitySlug: "sternoclavicular", note: "Capsular stabilizing relationship for the SC joint." },
  { ligament: "sternoclavicular-ligaments", relationshipType: "connects", targetEntityType: "bone", targetEntitySlug: "clavicle", note: "Medial clavicle side of the sternoclavicular ligament relationship." },
  { ligament: "sternoclavicular-ligaments", relationshipType: "connects", targetEntityType: "bone", targetEntitySlug: "sternum", note: "Sternal side of the sternoclavicular ligament relationship." },

  { ligament: "costoclavicular-ligament", relationshipType: "stabilizes", targetEntityType: "joint", targetEntitySlug: "sternoclavicular", note: "Inferior clavicle support and elevation-check relationship." },
  { ligament: "costoclavicular-ligament", relationshipType: "connects", targetEntityType: "bone", targetEntitySlug: "clavicle", note: "Inferior clavicular attachment context." },
  { ligament: "costoclavicular-ligament", relationshipType: "connects", targetEntityType: "bone", targetEntitySlug: "first-rib", note: "First rib/costal cartilage attachment context." },

  { ligament: "iliolumbar-ligament", relationshipType: "stabilizes", targetEntityType: "joint", targetEntitySlug: "lumbar-spine", note: "Lumbopelvic stabilization relationship around the lower lumbar spine." },
  { ligament: "iliolumbar-ligament", relationshipType: "connects", targetEntityType: "bone", targetEntitySlug: "l5-vertebra", note: "Lower lumbar transverse process side of the iliolumbar relationship." },
  { ligament: "iliolumbar-ligament", relationshipType: "connects", targetEntityType: "bone", targetEntitySlug: "ilium", note: "Iliac crest/pelvic side of the iliolumbar relationship." },

  { ligament: "sacroiliac-ligaments", relationshipType: "stabilizes", targetEntityType: "joint", targetEntitySlug: "sacroiliac", note: "SI joint stabilizing relationship for load transfer between spine and pelvis." },
  { ligament: "sacroiliac-ligaments", relationshipType: "connects", targetEntityType: "bone", targetEntitySlug: "sacrum", note: "Sacral side of SI ligament support." },
  { ligament: "sacroiliac-ligaments", relationshipType: "connects", targetEntityType: "bone", targetEntitySlug: "ilium", note: "Iliac side of SI ligament support." },

  { ligament: "elbow-ulnar-collateral-ligament", relationshipType: "stabilizes", targetEntityType: "joint", targetEntitySlug: "elbow-joint", note: "Medial elbow support and valgus-resisting relationship." },
  { ligament: "elbow-ulnar-collateral-ligament", relationshipType: "connects", targetEntityType: "bone", targetEntitySlug: "humerus", note: "Humeral side of the ulnar collateral elbow ligament." },
  { ligament: "elbow-ulnar-collateral-ligament", relationshipType: "connects", targetEntityType: "bone", targetEntitySlug: "ulna", note: "Ulnar side of the ulnar collateral elbow ligament." },

  { ligament: "elbow-radial-collateral-ligament", relationshipType: "stabilizes", targetEntityType: "joint", targetEntitySlug: "elbow-joint", note: "Lateral elbow support relationship." },
  { ligament: "elbow-radial-collateral-ligament", relationshipType: "connects", targetEntityType: "bone", targetEntitySlug: "humerus", note: "Humeral side of the radial collateral elbow ligament." },
  { ligament: "elbow-radial-collateral-ligament", relationshipType: "connects", targetEntityType: "bone", targetEntitySlug: "radius", note: "Radial-side elbow support context." },

  { ligament: "annular-ligament-of-radius", relationshipType: "stabilizes", targetEntityType: "joint", targetEntitySlug: "proximal-radioulnar-joint", note: "Proximal radioulnar stabilization relationship during pronation and supination." },
  { ligament: "annular-ligament-of-radius", relationshipType: "surrounds", targetEntityType: "bone", targetEntitySlug: "radius", note: "Ring-like relationship around the radial head." },
  { ligament: "annular-ligament-of-radius", relationshipType: "connects", targetEntityType: "bone", targetEntitySlug: "ulna", note: "Ulnar attachment context at the radial notch region." },

  { ligament: "palmar-radiocarpal-ligament", relationshipType: "stabilizes", targetEntityType: "joint", targetEntitySlug: "wrist-joint", note: "Palm-side wrist stabilizing relationship." },
  { ligament: "palmar-radiocarpal-ligament", relationshipType: "connects", targetEntityType: "bone", targetEntitySlug: "radius", note: "Distal radius side of palmar wrist support." },
  { ligament: "palmar-radiocarpal-ligament", relationshipType: "connects", targetEntityType: "bone", targetEntitySlug: "carpals", note: "Carpal side of palmar wrist support." },

  { ligament: "iliofemoral-ligament", relationshipType: "stabilizes", targetEntityType: "joint", targetEntitySlug: "hip-joint", note: "Anterior hip capsule stabilizing relationship." },
  { ligament: "iliofemoral-ligament", relationshipType: "limits_extension_of", targetEntityType: "joint", targetEntitySlug: "hip-joint", note: "Hip extension check relationship." },
  { ligament: "iliofemoral-ligament", relationshipType: "connects", targetEntityType: "bone", targetEntitySlug: "ilium", note: "Iliac side of the iliofemoral ligament." },
  { ligament: "iliofemoral-ligament", relationshipType: "connects", targetEntityType: "bone", targetEntitySlug: "femur", note: "Femoral side of the iliofemoral ligament." },

  { ligament: "anterior-cruciate-ligament", relationshipType: "stabilizes", targetEntityType: "joint", targetEntitySlug: "knee-joint", note: "Internal knee stabilizing relationship." },
  { ligament: "anterior-cruciate-ligament", relationshipType: "limits_anterior_translation_of", targetEntityType: "bone", targetEntitySlug: "tibia", note: "Anterior tibial translation check relationship." },
  { ligament: "anterior-cruciate-ligament", relationshipType: "connects", targetEntityType: "bone", targetEntitySlug: "femur", note: "Femoral attachment context for ACL mapping." },
  { ligament: "anterior-cruciate-ligament", relationshipType: "connects", targetEntityType: "bone", targetEntitySlug: "tibia", note: "Tibial attachment context for ACL mapping." },

  { ligament: "posterior-cruciate-ligament", relationshipType: "stabilizes", targetEntityType: "joint", targetEntitySlug: "knee-joint", note: "Internal posterior knee stabilizing relationship." },
  { ligament: "posterior-cruciate-ligament", relationshipType: "limits_posterior_translation_of", targetEntityType: "bone", targetEntitySlug: "tibia", note: "Posterior tibial translation check relationship." },
  { ligament: "posterior-cruciate-ligament", relationshipType: "connects", targetEntityType: "bone", targetEntitySlug: "femur", note: "Femoral attachment context for PCL mapping." },
  { ligament: "posterior-cruciate-ligament", relationshipType: "connects", targetEntityType: "bone", targetEntitySlug: "tibia", note: "Tibial attachment context for PCL mapping." },

  { ligament: "medial-collateral-ligament-knee", relationshipType: "stabilizes", targetEntityType: "joint", targetEntitySlug: "knee-joint", note: "Medial knee stabilizing relationship." },
  { ligament: "medial-collateral-ligament-knee", relationshipType: "resists_valgus_stress_at", targetEntityType: "joint", targetEntitySlug: "knee-joint", note: "Valgus stress check relationship." },
  { ligament: "medial-collateral-ligament-knee", relationshipType: "connects", targetEntityType: "bone", targetEntitySlug: "femur", note: "Femoral side of medial collateral support." },
  { ligament: "medial-collateral-ligament-knee", relationshipType: "connects", targetEntityType: "bone", targetEntitySlug: "tibia", note: "Tibial side of medial collateral support." },
  { ligament: "medial-collateral-ligament-knee", relationshipType: "related_to", targetEntityType: "anatomy_structure", targetEntitySlug: "medial-meniscus", note: "Medial meniscus contextual relationship for medial knee anatomy." },

  { ligament: "lateral-collateral-ligament-knee", relationshipType: "stabilizes", targetEntityType: "joint", targetEntitySlug: "knee-joint", note: "Lateral knee stabilizing relationship." },
  { ligament: "lateral-collateral-ligament-knee", relationshipType: "resists_varus_stress_at", targetEntityType: "joint", targetEntitySlug: "knee-joint", note: "Varus stress check relationship." },
  { ligament: "lateral-collateral-ligament-knee", relationshipType: "connects", targetEntityType: "bone", targetEntitySlug: "femur", note: "Femoral side of lateral collateral support." },
  { ligament: "lateral-collateral-ligament-knee", relationshipType: "connects", targetEntityType: "bone", targetEntitySlug: "fibula", note: "Fibular side of lateral collateral support." },

  { ligament: "deltoid-ligament-ankle", relationshipType: "stabilizes", targetEntityType: "joint", targetEntitySlug: "ankle-joint", note: "Medial ankle stabilizing relationship." },
  { ligament: "deltoid-ligament-ankle", relationshipType: "resists_eversion_at", targetEntityType: "joint", targetEntitySlug: "ankle-joint", note: "Medial ankle eversion-check relationship." },
  { ligament: "deltoid-ligament-ankle", relationshipType: "connects", targetEntityType: "bone", targetEntitySlug: "tibia", note: "Medial malleolar/tibial side of deltoid ligament support." },
  { ligament: "deltoid-ligament-ankle", relationshipType: "connects", targetEntityType: "bone", targetEntitySlug: "talus", note: "Talar side of deltoid ligament support." },

  { ligament: "anterior-talofibular-ligament", relationshipType: "stabilizes", targetEntityType: "joint", targetEntitySlug: "ankle-joint", note: "Lateral ankle stabilizing relationship." },
  { ligament: "anterior-talofibular-ligament", relationshipType: "resists_inversion_at", targetEntityType: "joint", targetEntitySlug: "ankle-joint", note: "Lateral ankle inversion-check relationship." },
  { ligament: "anterior-talofibular-ligament", relationshipType: "connects", targetEntityType: "bone", targetEntitySlug: "fibula", note: "Fibular side of ATFL support." },
  { ligament: "anterior-talofibular-ligament", relationshipType: "connects", targetEntityType: "bone", targetEntitySlug: "talus", note: "Talar side of ATFL support." },

  { ligament: "lateral-temporomandibular-ligament", relationshipType: "stabilizes", targetEntityType: "joint", targetEntitySlug: "temporomandibular-joint", note: "Lateral TMJ capsular stabilizing relationship." },
  { ligament: "lateral-temporomandibular-ligament", relationshipType: "connects", targetEntityType: "bone", targetEntitySlug: "temporal-bone", note: "Temporal bone side of lateral TMJ support." },
  { ligament: "lateral-temporomandibular-ligament", relationshipType: "connects", targetEntityType: "bone", targetEntitySlug: "mandible", note: "Mandibular side of lateral TMJ support." },

  { ligament: "sphenomandibular-ligament", relationshipType: "supports", targetEntityType: "joint", targetEntitySlug: "temporomandibular-joint", note: "Accessory TMJ support relationship." },
  { ligament: "sphenomandibular-ligament", relationshipType: "connects", targetEntityType: "bone", targetEntitySlug: "sphenoid-bone", note: "Sphenoid side of the sphenomandibular ligament." },
  { ligament: "sphenomandibular-ligament", relationshipType: "connects", targetEntityType: "bone", targetEntitySlug: "mandible", note: "Mandibular side of the sphenomandibular ligament." },

  { ligament: "stylomandibular-ligament", relationshipType: "supports", targetEntityType: "joint", targetEntitySlug: "temporomandibular-joint", note: "Accessory jaw-region support relationship." },
  { ligament: "stylomandibular-ligament", relationshipType: "connects", targetEntityType: "bone", targetEntitySlug: "temporal-bone", note: "Styloid/temporal bone side of the stylomandibular ligament." },
  { ligament: "stylomandibular-ligament", relationshipType: "connects", targetEntityType: "bone", targetEntitySlug: "mandible", note: "Mandibular angle side of the stylomandibular ligament." },
]

const LIGAMENT_RELATIONSHIPS: RelationshipRow[] = LIGAMENT_RELATIONSHIP_SPECS.map((spec) => ({
  id: relationshipId(spec),
  sourceEntityType: "ligament",
  sourceEntitySlug: spec.ligament,
  relationshipType: spec.relationshipType,
  targetEntityType: spec.targetEntityType,
  targetEntitySlug: spec.targetEntitySlug,
  details: {
    clinicalUse: "non-diagnostic",
    note: spec.note,
  },
  sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
}))

const LIGAMENT_RELATIONSHIP_CITATIONS: CitationRow[] = LIGAMENT_RELATIONSHIPS.flatMap((relationship) => [
  reviewedCitation(
    "ligament",
    relationship.sourceEntitySlug,
    "ligament_relationship",
    relationship.id,
    APPLIED_HUMAN_ANATOMY_SOURCE,
    APPLIED_HUMAN_ANATOMY_LOCATOR,
    "Reviewed commercial-safe seed relationship connecting a named ligament to associated joints, bones, or named structures.",
  ),
  sourceReferenceCitation(
    "ligament",
    relationship.sourceEntitySlug,
    `relationship:${relationship.id}`,
    relationship.sourceRef,
    APPLIED_HUMAN_ANATOMY_LOCATOR,
    "Reviewed source-reference row for a ligament relationship seed fact.",
  ),
])

export const LIGAMENT_RELATIONSHIP_ATLAS_SECTION: AnatomySeedSection = {
  relationships: LIGAMENT_RELATIONSHIPS,
  citations: LIGAMENT_RELATIONSHIP_CITATIONS,
}
