import type { AnatomySeedSection } from "./sections.ts"

const CDC_ROM_SOURCE = "cdc-normal-joint-rom"
const ROM_TRACKING_SOURCE = "massagelab-authored-rom-tracking"
const CDC_ROM_LOCATOR = "https://stacks.cdc.gov/view/cdc/153156"
const ROM_TRACKING_LOCATOR = "MassageLab-authored non-diagnostic ROM and movement-tracking protocol metadata, 2026-05-24"

type CitationRow = NonNullable<AnatomySeedSection["citations"]>[number]
type RangeOfMotionRow = NonNullable<AnatomySeedSection["rangesOfMotion"]>[number]

type RomProtocolSpec = {
  slug: string
  joint: string
  movement: string
  typicalMinValue: number
  typicalMaxValue: number
  measurementUnit: string
  measurementPosition: string
  notes: string
  sourceRef: string
  sourceLocator: string
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

function reviewedRomCitation(spec: RomProtocolSpec) {
  const slug = `citation-range-of-motion-${spec.slug}-rom-protocol`

  return {
    id: slug,
    slug,
    entityType: "range_of_motion",
    entitySlug: spec.slug,
    factType: "rom_protocol",
    factSlug: `rom-${spec.slug}`,
    sourceRef: spec.sourceRef,
    sourceLocator: spec.sourceLocator,
    citationNote: spec.measurementUnit === "degrees"
      ? "Reviewed non-diagnostic typical ROM protocol value for education and tracking; not a diagnostic threshold."
      : "Reviewed unit-aware non-diagnostic tracking protocol; value unit is intentionally not degrees.",
    reviewStatus: "reviewed",
  } satisfies CitationRow
}

const ROM_PROTOCOL_SPECS: RomProtocolSpec[] = [
  {
    slug: "atlanto-occipital-extension-rom",
    joint: "atlanto-occipital",
    movement: "atlanto-occipital-extension",
    typicalMinValue: 15,
    typicalMaxValue: 25,
    measurementUnit: "degrees",
    measurementPosition: "Upper cervical extension estimate focused at the atlanto-occipital region; document testing position and symptom response separately.",
    notes: "Typical education value only; use cervical spine total ROM for routine client-facing tracking.",
    sourceRef: ROM_TRACKING_SOURCE,
    sourceLocator: ROM_TRACKING_LOCATOR,
  },
  {
    slug: "acromioclavicular-rotation-rom",
    joint: "acromioclavicular",
    movement: "acromioclavicular-rotation",
    typicalMinValue: 5,
    typicalMaxValue: 10,
    measurementUnit: "degrees",
    measurementPosition: "Small accessory rotation estimate accompanying shoulder-girdle elevation; not a routine goniometric client measure.",
    notes: "Accessory joint tracking reference only; not diagnostic.",
    sourceRef: ROM_TRACKING_SOURCE,
    sourceLocator: ROM_TRACKING_LOCATOR,
  },
  {
    slug: "sternoclavicular-depression-rom",
    joint: "sternoclavicular",
    movement: "clavicular-depression",
    typicalMinValue: 5,
    typicalMaxValue: 15,
    measurementUnit: "degrees",
    measurementPosition: "Clavicular depression estimate at the sternoclavicular joint with shoulder girdle moving inferiorly.",
    notes: "Accessory shoulder-girdle tracking reference only; not diagnostic.",
    sourceRef: ROM_TRACKING_SOURCE,
    sourceLocator: ROM_TRACKING_LOCATOR,
  },
  {
    slug: "scapular-upward-rotation-rom",
    joint: "scapulothoracic",
    movement: "scapular-upward-rotation",
    typicalMinValue: 50,
    typicalMaxValue: 60,
    measurementUnit: "degrees",
    measurementPosition: "Scapular upward rotation estimate during arm elevation; distinguish scapulothoracic contribution from glenohumeral motion.",
    notes: "Functional scapular tracking reference only; not diagnostic.",
    sourceRef: ROM_TRACKING_SOURCE,
    sourceLocator: ROM_TRACKING_LOCATOR,
  },
  {
    slug: "sacroiliac-nutation-rom",
    joint: "sacroiliac",
    movement: "sacroiliac-nutation",
    typicalMinValue: 1,
    typicalMaxValue: 4,
    measurementUnit: "degrees",
    measurementPosition: "Small sacroiliac nutation estimate used for lumbopelvic education, not routine clinical goniometry.",
    notes: "Accessory joint tracking reference only; not diagnostic.",
    sourceRef: ROM_TRACKING_SOURCE,
    sourceLocator: ROM_TRACKING_LOCATOR,
  },
  {
    slug: "thoracic-cage-expansion-rom",
    joint: "thoracic-cage",
    movement: "thoracic-cage-expansion",
    typicalMinValue: 2,
    typicalMaxValue: 7,
    measurementUnit: "centimeters",
    measurementPosition: "Circumferential chest expansion tracking at a documented rib level during comfortable inhalation and exhalation.",
    notes: "Centimeter-based tracking protocol for breathing mechanics education; not a pulmonary diagnostic test.",
    sourceRef: ROM_TRACKING_SOURCE,
    sourceLocator: ROM_TRACKING_LOCATOR,
  },
  {
    slug: "pelvic-floor-support-tracking",
    joint: "pelvic-floor-functional-complex",
    movement: "pelvic-floor-support",
    typicalMinValue: 0,
    typicalMaxValue: 5,
    measurementUnit: "ordinal_0_5",
    measurementPosition: "Non-diagnostic observation scale for therapist education notes; avoid internal pelvic floor assessment unless properly licensed and trained.",
    notes: "Ordinal metadata for education and referral-aware documentation, not diagnostic ROM.",
    sourceRef: ROM_TRACKING_SOURCE,
    sourceLocator: ROM_TRACKING_LOCATOR,
  },
  {
    slug: "finger-abduction-rom",
    joint: "metacarpophalangeal-joints",
    movement: "finger-abduction",
    typicalMinValue: 15,
    typicalMaxValue: 25,
    measurementUnit: "degrees",
    measurementPosition: "Finger abduction at MCP joints with hand supported and fingers moving away from the hand midline.",
    notes: "Typical value for education and tracking; not diagnostic.",
    sourceRef: CDC_ROM_SOURCE,
    sourceLocator: CDC_ROM_LOCATOR,
  },
  {
    slug: "thumb-abduction-rom",
    joint: "thumb-carpometacarpal-joint",
    movement: "thumb-abduction",
    typicalMinValue: 45,
    typicalMaxValue: 70,
    measurementUnit: "degrees",
    measurementPosition: "Thumb abduction from the palm with hand supported; document palmar versus radial abduction if clinically relevant.",
    notes: "Typical value for education and tracking; not diagnostic.",
    sourceRef: CDC_ROM_SOURCE,
    sourceLocator: CDC_ROM_LOCATOR,
  },
  {
    slug: "thumb-flexion-rom",
    joint: "thumb-metacarpophalangeal-joint",
    movement: "thumb-flexion",
    typicalMinValue: 40,
    typicalMaxValue: 60,
    measurementUnit: "degrees",
    measurementPosition: "Thumb MCP flexion with the first metacarpal stabilized as appropriate.",
    notes: "Typical value for education and tracking; not diagnostic.",
    sourceRef: CDC_ROM_SOURCE,
    sourceLocator: CDC_ROM_LOCATOR,
  },
  {
    slug: "finger-flexion-rom",
    joint: "interphalangeal-joints-of-hand",
    movement: "finger-flexion",
    typicalMinValue: 70,
    typicalMaxValue: 110,
    measurementUnit: "degrees",
    measurementPosition: "Finger interphalangeal flexion tracking; document whether PIP, DIP, or a functional composite is being measured.",
    notes: "Composite typical value for education and tracking; not diagnostic.",
    sourceRef: CDC_ROM_SOURCE,
    sourceLocator: CDC_ROM_LOCATOR,
  },
  {
    slug: "foot-inversion-rom",
    joint: "subtalar-joint",
    movement: "foot-inversion",
    typicalMinValue: 30,
    typicalMaxValue: 35,
    measurementUnit: "degrees",
    measurementPosition: "Foot inversion tracking with subtalar contribution emphasized and ankle position documented.",
    notes: "Typical value for education and tracking; not diagnostic.",
    sourceRef: CDC_ROM_SOURCE,
    sourceLocator: CDC_ROM_LOCATOR,
  },
  {
    slug: "hallux-extension-rom",
    joint: "metatarsophalangeal-joints",
    movement: "hallux-extension",
    typicalMinValue: 50,
    typicalMaxValue: 70,
    measurementUnit: "degrees",
    measurementPosition: "Great toe extension at the first metatarsophalangeal joint.",
    notes: "Typical value for education and tracking; not diagnostic.",
    sourceRef: CDC_ROM_SOURCE,
    sourceLocator: CDC_ROM_LOCATOR,
  },
  {
    slug: "tarsometatarsal-glide-tracking",
    joint: "tarsometatarsal-joints",
    movement: "tarsometatarsal-glide",
    typicalMinValue: 0,
    typicalMaxValue: 5,
    measurementUnit: "ordinal_0_5",
    measurementPosition: "Non-diagnostic observation scale for midfoot adaptability during education, gait discussion, or therapist note context.",
    notes: "Ordinal tracking metadata for tarsometatarsal glide; do not treat as diagnostic joint-play grading.",
    sourceRef: ROM_TRACKING_SOURCE,
    sourceLocator: ROM_TRACKING_LOCATOR,
  },
  {
    slug: "jaw-depression-opening-rom",
    joint: "temporomandibular-joint",
    movement: "jaw-depression",
    typicalMinValue: 35,
    typicalMaxValue: 50,
    measurementUnit: "millimeters",
    measurementPosition: "Comfortable active mouth opening measured between upper and lower incisors or documented equivalent landmarks.",
    notes: "Millimeter-based jaw opening reference for education and referral-aware tracking; not diagnostic.",
    sourceRef: ROM_TRACKING_SOURCE,
    sourceLocator: ROM_TRACKING_LOCATOR,
  },
  {
    slug: "lip-closure-functional-tracking",
    joint: "facial-expression-complex",
    movement: "lip-closure",
    typicalMinValue: 0,
    typicalMaxValue: 5,
    measurementUnit: "ordinal_0_5",
    measurementPosition: "Non-diagnostic visible facial expression observation scale for education and documentation context.",
    notes: "Ordinal tracking metadata; do not treat as neurological grading.",
    sourceRef: ROM_TRACKING_SOURCE,
    sourceLocator: ROM_TRACKING_LOCATOR,
  },
  {
    slug: "hyoid-elevation-functional-tracking",
    joint: "hyoid-functional-complex",
    movement: "hyoid-elevation",
    typicalMinValue: 0,
    typicalMaxValue: 5,
    measurementUnit: "ordinal_0_5",
    measurementPosition: "Non-diagnostic external observation scale for hyoid-region movement education and referral-aware notes.",
    notes: "Ordinal tracking metadata; swallowing or voice concerns require appropriate referral.",
    sourceRef: ROM_TRACKING_SOURCE,
    sourceLocator: ROM_TRACKING_LOCATOR,
  },
  {
    slug: "tongue-protrusion-functional-tracking",
    joint: "tongue-functional-complex",
    movement: "tongue-protrusion",
    typicalMinValue: 0,
    typicalMaxValue: 5,
    measurementUnit: "ordinal_0_5",
    measurementPosition: "Non-diagnostic education scale for visible tongue protrusion context; avoid clinical claims.",
    notes: "Ordinal tracking metadata; speech, swallowing, or neurological concerns require appropriate referral.",
    sourceRef: ROM_TRACKING_SOURCE,
    sourceLocator: ROM_TRACKING_LOCATOR,
  },
  {
    slug: "laryngeal-elevation-functional-tracking",
    joint: "laryngeal-functional-complex",
    movement: "laryngeal-elevation",
    typicalMinValue: 0,
    typicalMaxValue: 5,
    measurementUnit: "ordinal_0_5",
    measurementPosition: "Non-diagnostic education scale for external laryngeal elevation context during neck anatomy learning.",
    notes: "Ordinal tracking metadata; voice or swallowing symptoms require appropriate referral.",
    sourceRef: ROM_TRACKING_SOURCE,
    sourceLocator: ROM_TRACKING_LOCATOR,
  },
]

const RANGE_OF_MOTION_PROTOCOLS: RangeOfMotionRow[] = ROM_PROTOCOL_SPECS.map((spec) => ({
  id: `rom-${spec.slug}`,
  slug: spec.slug,
  joint: spec.joint,
  movement: spec.movement,
  typicalMinDegrees: spec.measurementUnit === "degrees" ? spec.typicalMinValue : undefined,
  typicalMaxDegrees: spec.measurementUnit === "degrees" ? spec.typicalMaxValue : undefined,
  typicalMinValue: spec.typicalMinValue,
  typicalMaxValue: spec.typicalMaxValue,
  measurementUnit: spec.measurementUnit,
  measurementPosition: spec.measurementPosition,
  notes: spec.notes,
  sourceRef: spec.sourceRef,
}))

const RANGE_OF_MOTION_PROTOCOL_CITATIONS: CitationRow[] = ROM_PROTOCOL_SPECS.flatMap((spec) => [
  reviewedRomCitation(spec),
  sourceReferenceCitation(
    "range_of_motion",
    spec.slug,
    `range_of_motion:${spec.slug}`,
    spec.sourceRef,
    spec.sourceLocator,
    "Reviewed source-reference row for a unit-aware range-of-motion or movement-tracking protocol.",
  ),
])

export const RANGE_OF_MOTION_PROTOCOL_ATLAS_SECTION: AnatomySeedSection = {
  rangesOfMotion: RANGE_OF_MOTION_PROTOCOLS,
  citations: RANGE_OF_MOTION_PROTOCOL_CITATIONS,
}
