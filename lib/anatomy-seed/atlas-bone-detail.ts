import type { AnatomySeedSection } from "./sections.ts"

const APPLIED_HUMAN_ANATOMY_SOURCE = "applied-human-anatomy"
const FIPAT_SOURCE = "fipat-ta2"
const APPLIED_HUMAN_ANATOMY_LOCATOR = "https://open.umn.edu/opentextbooks/textbooks/1266"

type AtlasBoneSpec = {
  slug: string
  name: string
  formalName: string
  officialLocator: string
  region: string
  description: string
  commonTerms: string[]
}

type ExistingBoneTermSpec = {
  entitySlug: string
  terms: string[]
  officialLocator: string
}

type ExistingLandmarkTermSpec = {
  entitySlug: string
  formalName: string
  officialLocator: string
  commonTerms: string[]
}

type AtlasLandmarkSpec = {
  slug: string
  name: string
  formalName: string
  officialLocator: string
  bone: string
  description: string
  commonTerms: string[]
}

const ROMAN_NUMERALS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII"] as const
const ORDINALS = ["first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth", "eleventh", "twelfth"] as const

function titleCase(value: string) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

function sourceReferenceCitation(
  entityType: NonNullable<AnatomySeedSection["citations"]>[number]["entityType"],
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
  } satisfies NonNullable<AnatomySeedSection["citations"]>[number]
}

function reviewedCitation(
  entitySlug: string,
  factType: string,
  factSlug: string | undefined,
  sourceRef: string,
  sourceLocator: string,
  citationNote: string,
) {
  const factSegment = factSlug ? `-${slugify(factSlug)}` : ""
  const slug = `citation-bone-${entitySlug}-${slugify(factType)}${factSegment}-reviewed`

  return {
    id: slug,
    slug,
    entityType: "bone",
    entitySlug,
    factType,
    factSlug,
    sourceRef,
    sourceLocator,
    citationNote,
    reviewStatus: "reviewed",
  } satisfies NonNullable<AnatomySeedSection["citations"]>[number]
}

function reviewedLandmarkCitation(
  entitySlug: string,
  factType: string,
  factSlug: string | undefined,
  sourceRef: string,
  sourceLocator: string,
  citationNote: string,
) {
  const factSegment = factSlug ? `-${slugify(factSlug)}` : ""
  const slug = `citation-bone-landmark-${entitySlug}-${slugify(factType)}${factSegment}-reviewed`

  return {
    id: slug,
    slug,
    entityType: "bone_landmark",
    entitySlug,
    factType,
    factSlug,
    sourceRef,
    sourceLocator,
    citationNote,
    reviewStatus: "reviewed",
  } satisfies NonNullable<AnatomySeedSection["citations"]>[number]
}

function cervicalVertebra(level: number): AtlasBoneSpec {
  const ordinal = ORDINALS[level - 1]
  const roman = ROMAN_NUMERALS[level - 1]

  return {
    slug: `c${level}-vertebra`,
    name: `C${level} Vertebra`,
    formalName: `${titleCase(ordinal)} cervical vertebra`,
    officialLocator: `FIPAT TA2: Vertebra cervicalis ${roman}`,
    region: "head-neck",
    description: `The C${level} vertebra is the ${ordinal} cervical vertebra in the neck. It contributes to the mobile cervical column, includes transverse-process anatomy used by neck muscles, and helps organize numbered cervical-level references for assessment, education, and body-map tagging.`,
    commonTerms: [`C${level}`, `C${level} vertebra`, `${ordinal} cervical vertebra`, `neck vertebra ${level}`],
  }
}

function thoracicVertebra(level: number): AtlasBoneSpec {
  const ordinal = ORDINALS[level - 1]
  const roman = ROMAN_NUMERALS[level - 1]
  const transitionNote = level === 1
    ? "It is an upper thoracic transition vertebra near the cervicothoracic junction."
    : level >= 11
      ? "It is part of the lower thoracic transition region where rib articulation and lumbar-transition anatomy become more clinically relevant."
      : "It is a typical rib-bearing thoracic vertebra with posterior thorax and rib-cage relationships."

  return {
    slug: `t${level}-vertebra`,
    name: `T${level} Vertebra`,
    formalName: `${titleCase(ordinal)} thoracic vertebra`,
    officialLocator: `FIPAT TA2: Vertebra thoracica ${roman}`,
    region: "upper-back",
    description: `The T${level} vertebra is the ${ordinal} thoracic vertebra in the upper or mid back. ${transitionNote} It supports numbered spinal-level references for thoracic mobility, rib mechanics, erector-column attachments, and client education.`,
    commonTerms: [`T${level}`, `T${level} vertebra`, `${ordinal} thoracic vertebra`, `upper back vertebra ${level}`],
  }
}

function lumbarVertebra(level: number): AtlasBoneSpec {
  const ordinal = ORDINALS[level - 1]
  const roman = ROMAN_NUMERALS[level - 1]
  const transitionNote = level === 5
    ? "It is the lumbosacral transition vertebra and is especially important for low-back and pelvis relationship mapping."
    : "It is a weight-bearing lumbar vertebra with large body and posterior element relationships for low-back anatomy."

  return {
    slug: `l${level}-vertebra`,
    name: `L${level} Vertebra`,
    formalName: `${titleCase(ordinal)} lumbar vertebra`,
    officialLocator: `FIPAT TA2: Vertebra lumbalis ${roman}`,
    region: "lumbar-region",
    description: `The L${level} vertebra is the ${ordinal} lumbar vertebra in the low back. ${transitionNote} It supports numbered lumbar-level references for trunk movement, posture, massage education, and body-map tagging.`,
    commonTerms: [`L${level}`, `L${level} vertebra`, `${ordinal} lumbar vertebra`, `low back vertebra ${level}`],
  }
}

function rib(level: number): AtlasBoneSpec {
  const ordinal = ORDINALS[level - 1]
  const ribClass = level <= 7 ? "true rib" : level <= 10 ? "false rib" : "floating rib"
  const variationNote = level === 1
    ? "The first rib is short, broad, and closely related to the clavicle, scalene muscles, and thoracic outlet region."
    : level === 2
      ? "The second rib is an upper thoracic rib and a useful landmark for anterior chest-wall orientation."
      : level >= 11
        ? `The ${ordinal} rib is a floating rib and does not attach anteriorly through costal cartilage to the sternum.`
        : `The ${ordinal} rib contributes to the rib cage and costal-cartilage framework of the thorax.`

  return {
    slug: `${ordinal}-rib`,
    name: `${titleCase(ordinal)} Rib`,
    formalName: `${titleCase(ordinal)} rib`,
    officialLocator: `FIPAT TA2: Costa ${romanForRib(level)}`,
    region: "thorax",
    description: `The ${ordinal} rib is rib ${level} and is classified as a ${ribClass}. ${variationNote} It supports numbered rib references for breathing mechanics, intercostal anatomy, thoracic mobility, and body-map education.`,
    commonTerms: [`rib ${level}`, `${ordinal} rib`, `${ribClass}`, level === 1 ? "top rib" : `${ordinal} thoracic rib`],
  }
}

function romanForRib(level: number) {
  return ROMAN_NUMERALS[level - 1]
}

const CARPAL_BONES: AtlasBoneSpec[] = [
  {
    slug: "scaphoid",
    name: "Scaphoid",
    formalName: "Scaphoid bone",
    officialLocator: "FIPAT TA2: Os scaphoideum",
    region: "wrist",
    description: "The scaphoid is a radial-side proximal carpal bone bridging the proximal and distal carpal rows. It is important for wrist mechanics, thumb-side wrist landmarks, and hand anatomy education.",
    commonTerms: ["scaphoid bone", "thumb side wrist bone", "radial wrist bone"],
  },
  {
    slug: "lunate",
    name: "Lunate",
    formalName: "Lunate bone",
    officialLocator: "FIPAT TA2: Os lunatum",
    region: "wrist",
    description: "The lunate is a central proximal carpal bone that articulates with the radius and neighboring carpals. It helps organize wrist flexion-extension mechanics and central wrist body-map language.",
    commonTerms: ["lunate bone", "central wrist bone"],
  },
  {
    slug: "triquetrum",
    name: "Triquetrum",
    formalName: "Triquetral bone",
    officialLocator: "FIPAT TA2: Os triquetrum",
    region: "wrist",
    description: "The triquetrum is an ulnar-side proximal carpal bone deep to the pisiform region. It is part of the ulnar wrist complex and helps orient little-finger-side wrist anatomy.",
    commonTerms: ["triquetral bone", "ulnar wrist bone", "little finger side wrist bone"],
  },
  {
    slug: "pisiform",
    name: "Pisiform",
    formalName: "Pisiform bone",
    officialLocator: "FIPAT TA2: Os pisiforme",
    region: "wrist",
    description: "The pisiform is a small pea-shaped carpal bone on the palmar ulnar wrist. It is embedded in the flexor carpi ulnaris tendon region and anchors hypothenar and ulnar palm mapping.",
    commonTerms: ["pisiform bone", "pea shaped wrist bone", "ulnar palm wrist bone"],
  },
  {
    slug: "trapezium",
    name: "Trapezium",
    formalName: "Trapezium bone",
    officialLocator: "FIPAT TA2: Os trapezium",
    region: "wrist",
    description: "The trapezium is a distal radial carpal bone at the base of the thumb. It forms the thumb carpometacarpal joint and is central to opposition, pinch, and thumb-base education.",
    commonTerms: ["trapezium bone", "thumb base wrist bone"],
  },
  {
    slug: "trapezoid",
    name: "Trapezoid",
    formalName: "Trapezoid bone",
    officialLocator: "FIPAT TA2: Os trapezoideum",
    region: "wrist",
    description: "The trapezoid is a distal carpal bone between the trapezium and capitate. It supports the index-finger metacarpal base and helps organize central radial wrist anatomy.",
    commonTerms: ["trapezoid bone", "index finger side wrist bone"],
  },
  {
    slug: "capitate",
    name: "Capitate",
    formalName: "Capitate bone",
    officialLocator: "FIPAT TA2: Os capitatum",
    region: "wrist",
    description: "The capitate is the largest carpal bone and sits centrally in the distal carpal row. It serves as a central wrist keystone for metacarpal, grip, and wrist-motion education.",
    commonTerms: ["capitate bone", "central carpal bone", "largest wrist bone"],
  },
  {
    slug: "hamate",
    name: "Hamate",
    formalName: "Hamate bone",
    officialLocator: "FIPAT TA2: Os hamatum",
    region: "wrist",
    description: "The hamate is an ulnar distal carpal bone with a palmar hook. It is important for hypothenar muscle origins, ulnar nerve and artery passage, and little-finger-side palm anatomy.",
    commonTerms: ["hamate bone", "hooked wrist bone", "little finger side carpal bone"],
  },
]

const TARSAL_BONES: AtlasBoneSpec[] = [
  {
    slug: "talus",
    name: "Talus",
    formalName: "Talus",
    officialLocator: "FIPAT TA2: Talus",
    region: "foot",
    description: "The talus is the superior tarsal bone that receives body weight from the tibia and fibula at the ankle. It links ankle motion to subtalar and foot mechanics.",
    commonTerms: ["ankle bone", "talar bone"],
  },
  {
    slug: "navicular",
    name: "Navicular",
    formalName: "Navicular bone",
    officialLocator: "FIPAT TA2: Os naviculare",
    region: "foot",
    description: "The navicular is a medial midfoot tarsal bone between the talus and cuneiforms. It is important for medial arch mechanics and tibialis posterior tendon relationships.",
    commonTerms: ["navicular bone", "inner arch bone", "medial midfoot bone"],
  },
  {
    slug: "cuboid",
    name: "Cuboid",
    formalName: "Cuboid bone",
    officialLocator: "FIPAT TA2: Os cuboideum",
    region: "foot",
    description: "The cuboid is a lateral midfoot tarsal bone between the calcaneus and lateral metatarsals. It supports lateral arch mechanics and fibularis longus tendon routing.",
    commonTerms: ["cuboid bone", "outer midfoot bone", "lateral arch bone"],
  },
  {
    slug: "medial-cuneiform",
    name: "Medial Cuneiform",
    formalName: "Medial cuneiform bone",
    officialLocator: "FIPAT TA2: Os cuneiforme mediale",
    region: "foot",
    description: "The medial cuneiform is the inner cuneiform bone of the midfoot and articulates with the first metatarsal. It is central to medial arch and great-toe ray mechanics.",
    commonTerms: ["first cuneiform", "inner cuneiform", "medial wedge bone"],
  },
  {
    slug: "intermediate-cuneiform",
    name: "Intermediate Cuneiform",
    formalName: "Intermediate cuneiform bone",
    officialLocator: "FIPAT TA2: Os cuneiforme intermedium",
    region: "foot",
    description: "The intermediate cuneiform is the central cuneiform bone of the midfoot. It supports the second metatarsal base and helps organize central arch and forefoot alignment.",
    commonTerms: ["second cuneiform", "middle cuneiform", "central cuneiform"],
  },
  {
    slug: "lateral-cuneiform",
    name: "Lateral Cuneiform",
    formalName: "Lateral cuneiform bone",
    officialLocator: "FIPAT TA2: Os cuneiforme laterale",
    region: "foot",
    description: "The lateral cuneiform is the outer cuneiform bone of the midfoot and articulates with the third metatarsal region. It helps organize central-to-lateral forefoot mechanics.",
    commonTerms: ["third cuneiform", "outer cuneiform", "lateral wedge bone"],
  },
]

function numberedLongBone(group: "metacarpal" | "metatarsal", level: number): AtlasBoneSpec {
  const ordinal = ORDINALS[level - 1]
  const region = group === "metacarpal" ? "hand" : "foot"
  const displayGroup = group === "metacarpal" ? "Metacarpal" : "Metatarsal"
  const digitLabel = group === "metacarpal"
    ? ["thumb", "index finger", "middle finger", "ring finger", "little finger"][level - 1]
    : ["great toe", "second toe", "third toe", "fourth toe", "fifth toe"][level - 1]

  return {
    slug: `${ordinal}-${group}`,
    name: `${titleCase(ordinal)} ${displayGroup}`,
    formalName: `${titleCase(ordinal)} ${group}`,
    officialLocator: `FIPAT TA2: Os ${group === "metacarpal" ? "metacarpi" : "metatarsi"} ${ROMAN_NUMERALS[level - 1]}`,
    region,
    description: `The ${ordinal} ${group} is the long ${region === "hand" ? "palm" : "forefoot"} bone associated with the ${digitLabel}. It supports numbered ${region} references, tendon attachment mapping, joint relationships, and client education for ${digitLabel} mechanics.`,
    commonTerms: [`${group} ${level}`, `${ordinal} ${group}`, `${digitLabel} ${group}`, `${region === "hand" ? "palm" : "forefoot"} bone ${level}`],
  }
}

function phalanxSpec(region: "hand" | "foot", digitSlug: string, digitLabel: string, segment: "proximal" | "middle" | "distal"): AtlasBoneSpec {
  const hasNoMiddle = digitSlug === "thumb-hand" || digitSlug === "hallux"
  const displayDigit = titleCase(digitSlug.replace("-hand", "").replace("hallux", "great-toe"))
  const simpleDigit = digitLabel.toLowerCase()
  const slug = `${segment}-phalanx-${digitSlug}`
  const regionLabel = region === "hand" ? "finger or thumb" : "toe"
  const jointContext = segment === "proximal"
    ? "metacarpophalangeal or metatarsophalangeal"
    : segment === "middle"
      ? "interphalangeal"
      : "distal interphalangeal or terminal phalangeal"

  return {
    slug,
    name: `${titleCase(segment)} Phalanx of ${displayDigit}`,
    formalName: `${titleCase(segment)} phalanx of ${digitLabel}`,
    officialLocator: `FIPAT TA2: ${titleCase(segment)} phalanx, ${region === "hand" ? "hand" : "foot"} digits`,
    region,
    description: `The ${segment} phalanx of the ${simpleDigit} is an individual ${regionLabel} bone used for precise digital anatomy. It supports ${jointContext} joint mapping, tendon insertion references, massage education, and client-friendly language for ${simpleDigit} movement.`,
    commonTerms: [
      `${segment} phalanx ${simpleDigit}`,
      `${simpleDigit} ${segment} bone`,
      `${segment} ${regionLabel} bone`,
      hasNoMiddle ? `${simpleDigit} phalanx` : `${segment} phalanx of ${simpleDigit}`,
    ],
  }
}

const VERTEBRAE: AtlasBoneSpec[] = [
  ...[3, 4, 5, 6, 7].map(cervicalVertebra),
  ...Array.from({ length: 12 }, (_, index) => thoracicVertebra(index + 1)),
  ...[1, 2, 3, 4, 5].map(lumbarVertebra),
]

const RIBS = Array.from({ length: 12 }, (_, index) => rib(index + 1))
const METACARPALS = [1, 2, 3, 4, 5].map((level) => numberedLongBone("metacarpal", level))
const METATARSALS = [1, 2, 3, 4, 5].map((level) => numberedLongBone("metatarsal", level))

const HAND_DIGITS = [
  { slug: "thumb-hand", label: "thumb", segments: ["proximal", "distal"] },
  { slug: "index-finger", label: "index finger", segments: ["proximal", "middle", "distal"] },
  { slug: "middle-finger", label: "middle finger", segments: ["proximal", "middle", "distal"] },
  { slug: "ring-finger", label: "ring finger", segments: ["proximal", "middle", "distal"] },
  { slug: "little-finger", label: "little finger", segments: ["proximal", "middle", "distal"] },
] as const

const FOOT_DIGITS = [
  { slug: "hallux", label: "great toe", segments: ["proximal", "distal"] },
  { slug: "second-toe", label: "second toe", segments: ["proximal", "middle", "distal"] },
  { slug: "third-toe", label: "third toe", segments: ["proximal", "middle", "distal"] },
  { slug: "fourth-toe", label: "fourth toe", segments: ["proximal", "middle", "distal"] },
  { slug: "fifth-toe", label: "fifth toe", segments: ["proximal", "middle", "distal"] },
] as const

const HAND_PHALANGES = HAND_DIGITS.flatMap((digit) => digit.segments.map((segment) => phalanxSpec("hand", digit.slug, digit.label, segment)))
const FOOT_PHALANGES = FOOT_DIGITS.flatMap((digit) => digit.segments.map((segment) => phalanxSpec("foot", digit.slug, digit.label, segment)))

const SKULL_FACE_PELVIS_BONES: AtlasBoneSpec[] = [
  {
    slug: "cranial-bones",
    name: "Cranial Bones",
    formalName: "Cranial bones",
    officialLocator: "FIPAT TA2: Ossa cranii",
    region: "head",
    description: "The cranial bones are the grouped bones forming the braincase and cranial base. This collection anchor connects individual skull bones for atlas browsing, head and neck education, and terminology search.",
    commonTerms: ["skull bones", "braincase bones", "neurocranium"],
  },
  {
    slug: "facial-bones",
    name: "Facial Bones",
    formalName: "Facial bones",
    officialLocator: "FIPAT TA2: Ossa faciei",
    region: "face",
    description: "The facial bones are the grouped bones forming the face, orbit, nasal region, palate, and jaws. This collection anchor connects individual facial bones for atlas browsing and client-friendly facial anatomy.",
    commonTerms: ["face bones", "viscerocranium", "facial skeleton"],
  },
  {
    slug: "parietal-bone",
    name: "Parietal Bone",
    formalName: "Parietal bone",
    officialLocator: "FIPAT TA2: Os parietale",
    region: "head",
    description: "The parietal bone is a paired cranial vault bone forming much of the superior and lateral skull. It helps orient scalp, cranial suture, temporalis fascia, and head body-map education.",
    commonTerms: ["side top skull bone", "upper side skull bone", "parietal skull bone"],
  },
  {
    slug: "ethmoid-bone",
    name: "Ethmoid Bone",
    formalName: "Ethmoid bone",
    officialLocator: "FIPAT TA2: Os ethmoidale",
    region: "head",
    description: "The ethmoid bone is a delicate skull-base and nasal-cavity bone contributing to the orbit and upper nasal septum. It anchors deep face, nasal, and anterior cranial base anatomy terms.",
    commonTerms: ["ethmoid skull bone", "upper nasal bone", "deep nasal skull bone"],
  },
  {
    slug: "nasal-bone",
    name: "Nasal Bone",
    formalName: "Nasal bone",
    officialLocator: "FIPAT TA2: Os nasale",
    region: "face",
    description: "The nasal bone is a paired facial bone forming the bridge of the nose. It supports nasal-region body mapping, facial expression relationships, and client-friendly nose anatomy language.",
    commonTerms: ["bridge of nose bone", "nose bone", "nasal bridge bone"],
  },
  {
    slug: "lacrimal-bone",
    name: "Lacrimal Bone",
    formalName: "Lacrimal bone",
    officialLocator: "FIPAT TA2: Os lacrimale",
    region: "face",
    description: "The lacrimal bone is a small medial orbital bone associated with the tear drainage region. It supports orbit, eye-adjacent facial anatomy, and medial eye landmark education.",
    commonTerms: ["tear bone", "inner eye socket bone", "medial orbital bone"],
  },
  {
    slug: "palatine-bone",
    name: "Palatine Bone",
    formalName: "Palatine bone",
    officialLocator: "FIPAT TA2: Os palatinum",
    region: "face",
    description: "The palatine bone is a paired facial bone contributing to the hard palate, nasal cavity, and orbit. It is important for palate, jaw, nasal, and deep face anatomy relationships.",
    commonTerms: ["palate bone", "hard palate bone", "posterior palate bone"],
  },
  {
    slug: "vomer",
    name: "Vomer",
    formalName: "Vomer",
    officialLocator: "FIPAT TA2: Vomer",
    region: "face",
    description: "The vomer is an unpaired facial bone forming the posteroinferior nasal septum. It supports nasal septum, palate, and deep face anatomy terminology for atlas browsing.",
    commonTerms: ["nasal septum bone", "septum bone", "vomer bone"],
  },
  {
    slug: "inferior-nasal-concha",
    name: "Inferior Nasal Concha",
    formalName: "Inferior nasal concha",
    officialLocator: "FIPAT TA2: Concha nasalis inferior",
    region: "face",
    description: "The inferior nasal concha is a paired curved bone on the lateral wall of the nasal cavity. It supports nasal airflow anatomy, nasal cavity education, and facial skeletal terminology.",
    commonTerms: ["inferior turbinate bone", "lower nasal concha", "lower nasal shelf bone"],
  },
  {
    slug: "hip-bone",
    name: "Hip Bone",
    formalName: "Hip bone",
    officialLocator: "FIPAT TA2: Os coxae",
    region: "pelvis",
    description: "The hip bone is the adult fused pelvic bone formed from the ilium, ischium, and pubis. It connects the trunk to the lower limb through the acetabulum and provides major pelvic attachment regions.",
    commonTerms: ["coxal bone", "innominate bone", "pelvic side bone"],
  },
  {
    slug: "ilium",
    name: "Ilium",
    formalName: "Ilium",
    officialLocator: "FIPAT TA2: Os ilium",
    region: "pelvis",
    description: "The ilium is the broad superior part of the hip bone. It includes the iliac crest and iliac spines and provides important attachment regions for abdominal wall, gluteal, and low-back structures.",
    commonTerms: ["upper hip bone", "iliac bone", "hip crest bone"],
  },
  {
    slug: "ischium",
    name: "Ischium",
    formalName: "Ischium",
    officialLocator: "FIPAT TA2: Os ischii",
    region: "pelvis",
    description: "The ischium is the posteroinferior part of the hip bone. It includes the ischial tuberosity or sit bone region and anchors hamstring, pelvic floor, and deep hip relationships.",
    commonTerms: ["sit bone ischium", "sitting bone", "lower back pelvic bone"],
  },
  {
    slug: "pubis",
    name: "Pubis",
    formalName: "Pubis",
    officialLocator: "FIPAT TA2: Os pubis",
    region: "pelvis",
    description: "The pubis is the anteroinferior part of the hip bone. It forms the pubic symphysis region and provides attachment context for abdominal wall, adductor, and pelvic floor anatomy.",
    commonTerms: ["pubic bone", "front pelvic bone", "anterior pelvis bone"],
  },
]

const SKULL_FACE_PELVIS_LANDMARKS: AtlasLandmarkSpec[] = [
  {
    slug: "parietal-eminence",
    name: "Parietal Eminence",
    formalName: "Parietal eminence",
    officialLocator: "FIPAT TA2: Tuber parietale",
    bone: "parietal-bone",
    description: "The parietal eminence is the prominent convex area on the lateral parietal bone. It helps orient scalp, cranial vault, and side-of-head anatomy for atlas browsing and body mapping.",
    commonTerms: ["parietal tuber", "side skull prominence", "upper side head bump"],
  },
  {
    slug: "superior-temporal-line",
    name: "Superior Temporal Line",
    formalName: "Superior temporal line",
    officialLocator: "FIPAT TA2: Linea temporalis superior",
    bone: "parietal-bone",
    description: "The superior temporal line is a curved ridge on the lateral skull used for temporalis fascia attachment and temporal region orientation. It spans frontal and parietal territory in atlas context.",
    commonTerms: ["upper temporal line", "temple line", "temporalis fascia line"],
  },
  {
    slug: "cribriform-plate",
    name: "Cribriform Plate",
    formalName: "Cribriform plate of ethmoid",
    officialLocator: "FIPAT TA2: Lamina cribrosa ossis ethmoidalis",
    bone: "ethmoid-bone",
    description: "The cribriform plate is the horizontal ethmoid region in the anterior cranial base with small openings for olfactory nerve filaments. It supports nose, smell, and skull-base education.",
    commonTerms: ["smell nerve plate", "olfactory plate", "ethmoid roof plate"],
  },
  {
    slug: "perpendicular-plate-ethmoid",
    name: "Perpendicular Plate of Ethmoid",
    formalName: "Perpendicular plate of ethmoid",
    officialLocator: "FIPAT TA2: Lamina perpendicularis ossis ethmoidalis",
    bone: "ethmoid-bone",
    description: "The perpendicular plate of the ethmoid descends from the ethmoid bone and contributes to the superior nasal septum. It anchors deep nasal septum and facial skeleton terminology.",
    commonTerms: ["upper nasal septum plate", "ethmoid septum plate", "deep septum bone"],
  },
  {
    slug: "nasal-bridge",
    name: "Nasal Bridge",
    formalName: "Bridge of nose",
    officialLocator: "FIPAT TA2: Os nasale",
    bone: "nasal-bone",
    description: "The nasal bridge is the palpable bony bridge formed mainly by the nasal bones. It is a useful client-friendly landmark for nose, face, and upper nasal body-map language.",
    commonTerms: ["bridge of nose", "nose bridge", "bony nose bridge"],
  },
  {
    slug: "lacrimal-fossa",
    name: "Lacrimal Fossa",
    formalName: "Fossa for lacrimal sac",
    officialLocator: "FIPAT TA2: Fossa sacci lacrimalis",
    bone: "lacrimal-bone",
    description: "The lacrimal fossa is the medial orbital depression associated with the lacrimal sac region. It supports inner-eye, tear drainage, and medial orbit anatomy terminology.",
    commonTerms: ["tear sac fossa", "inner eye tear groove", "medial eye socket fossa"],
  },
  {
    slug: "horizontal-plate-palatine",
    name: "Horizontal Plate of Palatine",
    formalName: "Horizontal plate of palatine bone",
    officialLocator: "FIPAT TA2: Lamina horizontalis ossis palatini",
    bone: "palatine-bone",
    description: "The horizontal plate of the palatine bone forms the posterior hard palate. It anchors palate, oral cavity, nasal floor, and deep face anatomy relationships.",
    commonTerms: ["back hard palate plate", "posterior palate bone", "palatine horizontal plate"],
  },
  {
    slug: "perpendicular-plate-palatine",
    name: "Perpendicular Plate of Palatine",
    formalName: "Perpendicular plate of palatine bone",
    officialLocator: "FIPAT TA2: Lamina perpendicularis ossis palatini",
    bone: "palatine-bone",
    description: "The perpendicular plate of the palatine bone contributes to the lateral nasal wall and deep facial skeleton. It supports nasal cavity, palate, and maxillary region mapping.",
    commonTerms: ["palatine vertical plate", "lateral nasal wall palatine bone", "deep palate side plate"],
  },
  {
    slug: "posterior-nasal-septum",
    name: "Posterior Nasal Septum",
    formalName: "Posteroinferior nasal septum",
    officialLocator: "FIPAT TA2: Vomer",
    bone: "vomer",
    description: "The posterior nasal septum is the vomer-supported part of the nasal partition. It helps organize deep nasal cavity, palate, and face anatomy in atlas browsing.",
    commonTerms: ["back nasal septum", "vomer septum", "posterior septum bone"],
  },
  {
    slug: "inferior-nasal-concha-body",
    name: "Body of Inferior Nasal Concha",
    formalName: "Inferior nasal concha body",
    officialLocator: "FIPAT TA2: Concha nasalis inferior",
    bone: "inferior-nasal-concha",
    description: "The body of the inferior nasal concha is the curved lower turbinate bone projecting into the nasal cavity. It supports nasal airflow and lateral nasal wall education.",
    commonTerms: ["lower turbinate body", "inferior turbinate", "lower nasal shelf"],
  },
  {
    slug: "acetabulum",
    name: "Acetabulum",
    formalName: "Acetabulum",
    officialLocator: "FIPAT TA2: Acetabulum",
    bone: "hip-bone",
    description: "The acetabulum is the socket of the hip bone receiving the head of the femur. It is central to hip joint anatomy, gluteal relationships, and lower-limb movement education.",
    commonTerms: ["hip socket", "pelvic socket", "acetabular socket"],
  },
  {
    slug: "auricular-surface-ilium",
    name: "Auricular Surface of Ilium",
    formalName: "Auricular surface of ilium",
    officialLocator: "FIPAT TA2: Facies auricularis ossis ilii",
    bone: "ilium",
    description: "The auricular surface of the ilium is the sacroiliac joint surface on the medial ilium. It anchors sacroiliac mechanics, pelvis relationships, and low-back education.",
    commonTerms: ["SI joint surface of ilium", "sacral ear-shaped surface", "ilium auricular surface"],
  },
  {
    slug: "pubic-tubercle",
    name: "Pubic Tubercle",
    formalName: "Pubic tubercle",
    officialLocator: "FIPAT TA2: Tuberculum pubicum",
    bone: "pubis",
    description: "The pubic tubercle is a palpable projection on the pubis near the medial end of the inguinal ligament. It helps orient anterior pelvis, abdominal wall, and groin-region anatomy.",
    commonTerms: ["front pubic bump", "inguinal ligament pubic point", "pubic landmark"],
  },
]

const NEW_ATLAS_BONE_SPECS = [
  ...VERTEBRAE,
  ...RIBS,
  ...CARPAL_BONES,
  ...TARSAL_BONES,
  ...METACARPALS,
  ...METATARSALS,
  ...HAND_PHALANGES,
  ...FOOT_PHALANGES,
  ...SKULL_FACE_PELVIS_BONES,
] satisfies AtlasBoneSpec[]

const ATLAS_LANDMARKS = SKULL_FACE_PELVIS_LANDMARKS.map((spec) => ({
  id: `landmark-${spec.slug}`,
  slug: spec.slug,
  name: spec.name,
  bone: spec.bone,
  description: spec.description,
  sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
})) satisfies NonNullable<AnatomySeedSection["boneLandmarks"]>

const EXISTING_BONE_TERM_SPECS: ExistingBoneTermSpec[] = [
  { entitySlug: "atlas", terms: ["C1", "C1 vertebra", "first cervical vertebra"], officialLocator: "FIPAT TA2: Atlas; Vertebra cervicalis I" },
  { entitySlug: "axis", terms: ["C2", "C2 vertebra", "second cervical vertebra"], officialLocator: "FIPAT TA2: Axis; Vertebra cervicalis II" },
  { entitySlug: "calcaneus", terms: ["calcaneal bone", "heel tarsal bone"], officialLocator: "FIPAT TA2: Calcaneus" },
]

const EXISTING_LANDMARK_TERM_SPECS: ExistingLandmarkTermSpec[] = [
  {
    entitySlug: "iliac-fossa",
    formalName: "Iliac fossa",
    officialLocator: "FIPAT TA2: Fossa iliaca",
    commonTerms: ["inside hip bowl", "inner ilium fossa", "iliacus origin surface"],
  },
  {
    entitySlug: "ischial-spine",
    formalName: "Ischial spine",
    officialLocator: "FIPAT TA2: Spina ischiadica",
    commonTerms: ["ischial point", "deep pelvic spine", "posterior pelvic spine"],
  },
  {
    entitySlug: "obturator-foramen",
    formalName: "Obturator foramen",
    officialLocator: "FIPAT TA2: Foramen obturatum",
    commonTerms: ["large pelvic opening", "obturator opening", "hip bone opening"],
  },
]

const GROUP_TARGETS = [
  { groupSlug: "cervical-vertebrae", targets: ["atlas", "axis", ...[3, 4, 5, 6, 7].map((level) => `c${level}-vertebra`)] },
  { groupSlug: "thoracic-vertebrae", targets: Array.from({ length: 12 }, (_, index) => `t${index + 1}-vertebra`) },
  { groupSlug: "lumbar-vertebrae", targets: [1, 2, 3, 4, 5].map((level) => `l${level}-vertebra`) },
  { groupSlug: "ribs", targets: RIBS.map((entry) => entry.slug) },
  { groupSlug: "carpals", targets: CARPAL_BONES.map((entry) => entry.slug) },
  { groupSlug: "tarsals", targets: ["calcaneus", ...TARSAL_BONES.map((entry) => entry.slug)] },
  { groupSlug: "metacarpals", targets: METACARPALS.map((entry) => entry.slug) },
  { groupSlug: "metatarsals", targets: METATARSALS.map((entry) => entry.slug) },
  { groupSlug: "hand-phalanges", targets: HAND_PHALANGES.map((entry) => entry.slug) },
  { groupSlug: "foot-phalanges", targets: FOOT_PHALANGES.map((entry) => entry.slug) },
  { groupSlug: "cranial-bones", targets: ["frontal-bone", "parietal-bone", "occipital-bone", "temporal-bone", "sphenoid-bone", "ethmoid-bone"] },
  { groupSlug: "facial-bones", targets: ["mandible", "maxilla", "zygomatic-bone", "nasal-bone", "lacrimal-bone", "palatine-bone", "vomer", "inferior-nasal-concha"] },
  { groupSlug: "hip-bone", targets: ["ilium", "ischium", "pubis"] },
  { groupSlug: "pelvis", targets: ["hip-bone", "sacrum", "coccyx"] },
] as const

const ATLAS_BONES = NEW_ATLAS_BONE_SPECS.map((spec) => ({
  id: `bone-${spec.slug}`,
  slug: spec.slug,
  name: spec.name,
  formalName: spec.formalName,
  description: spec.description,
  region: spec.region,
  sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
})) satisfies NonNullable<AnatomySeedSection["bones"]>

const NEW_BONE_TERMS = NEW_ATLAS_BONE_SPECS.flatMap((spec) => [
  {
    id: `term-bone-${spec.slug}-preferred-fipat`,
    anatomyEntityType: "bone" as const,
    anatomyEntitySlug: spec.slug,
    term: spec.formalName,
    termType: "preferred" as const,
    sourceRef: FIPAT_SOURCE,
  },
  ...spec.commonTerms.map((term) => ({
    id: `term-bone-${spec.slug}-${slugify(term)}-common`,
    anatomyEntityType: "bone" as const,
    anatomyEntitySlug: spec.slug,
    term,
    termType: "common" as const,
    sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
  })),
]) satisfies NonNullable<AnatomySeedSection["entityTerms"]>

const NEW_LANDMARK_TERMS = SKULL_FACE_PELVIS_LANDMARKS.flatMap((spec) => [
  {
    id: `term-bone-landmark-${spec.slug}-preferred-fipat`,
    anatomyEntityType: "bone_landmark" as const,
    anatomyEntitySlug: spec.slug,
    term: spec.formalName,
    termType: "preferred" as const,
    sourceRef: FIPAT_SOURCE,
  },
  ...spec.commonTerms.map((term) => ({
    id: `term-bone-landmark-${spec.slug}-${slugify(term)}-common`,
    anatomyEntityType: "bone_landmark" as const,
    anatomyEntitySlug: spec.slug,
    term,
    termType: "common" as const,
    sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
  })),
]) satisfies NonNullable<AnatomySeedSection["entityTerms"]>

const EXISTING_BONE_TERMS = EXISTING_BONE_TERM_SPECS.flatMap((spec) => spec.terms.map((term) => ({
  id: `term-bone-${spec.entitySlug}-${slugify(term)}-alternate`,
  anatomyEntityType: "bone" as const,
  anatomyEntitySlug: spec.entitySlug,
  term,
  termType: "alternate" as const,
  sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
}))) satisfies NonNullable<AnatomySeedSection["entityTerms"]>

const EXISTING_LANDMARK_TERMS = EXISTING_LANDMARK_TERM_SPECS.flatMap((spec) => [
  {
    id: `term-existing-bone-landmark-${spec.entitySlug}-preferred-fipat`,
    anatomyEntityType: "bone_landmark" as const,
    anatomyEntitySlug: spec.entitySlug,
    term: spec.formalName,
    termType: "preferred" as const,
    sourceRef: FIPAT_SOURCE,
  },
  ...spec.commonTerms.map((term) => ({
    id: `term-existing-bone-landmark-${spec.entitySlug}-${slugify(term)}-common`,
    anatomyEntityType: "bone_landmark" as const,
    anatomyEntitySlug: spec.entitySlug,
    term,
    termType: "common" as const,
    sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
  })),
]) satisfies NonNullable<AnatomySeedSection["entityTerms"]>

const GROUP_RELATIONSHIPS = GROUP_TARGETS.flatMap((group) => group.targets.map((targetSlug) => ({
  id: `relationship-${group.groupSlug}-includes-${targetSlug}`,
  sourceEntityType: "bone",
  sourceEntitySlug: group.groupSlug,
  relationshipType: "includes_bone",
  targetEntityType: "bone",
  targetEntitySlug: targetSlug,
  details: { atlasCoverage: true },
  sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
}))) satisfies NonNullable<AnatomySeedSection["relationships"]>

const BONE_REVIEWED_CITATIONS = NEW_ATLAS_BONE_SPECS.flatMap((spec) => [
  reviewedCitation(
    spec.slug,
    "official_term",
    `term-bone-${spec.slug}-preferred-fipat`,
    FIPAT_SOURCE,
    spec.officialLocator,
    "FIPAT TA2 official anatomical terminology used for the individual atlas bone term row.",
  ),
  reviewedCitation(
    spec.slug,
    "clinical_summary",
    `bone-${spec.slug}`,
    APPLIED_HUMAN_ANATOMY_SOURCE,
    APPLIED_HUMAN_ANATOMY_LOCATOR,
    "MassageLab-authored individual bone summary verified against Applied Human Anatomy skeletal organization and regional anatomy material.",
  ),
  sourceReferenceCitation(
    "bone",
    spec.slug,
    `bone:${spec.slug}`,
    APPLIED_HUMAN_ANATOMY_SOURCE,
    APPLIED_HUMAN_ANATOMY_LOCATOR,
    "Reviewed exact seed source reference for this individual atlas bone row.",
  ),
]) satisfies NonNullable<AnatomySeedSection["citations"]>

const TERM_SOURCE_REFERENCE_CITATIONS = [...NEW_BONE_TERMS, ...EXISTING_BONE_TERMS].map((term) => sourceReferenceCitation(
  term.anatomyEntityType,
  term.anatomyEntitySlug,
  `entity_term:${term.id}`,
  term.sourceRef,
  term.sourceRef === FIPAT_SOURCE ? "https://libraries.dal.ca/Fipat/ta2.html" : APPLIED_HUMAN_ANATOMY_LOCATOR,
  "Reviewed exact seed source reference for this atlas bone terminology row.",
)) satisfies NonNullable<AnatomySeedSection["citations"]>

const LANDMARK_REVIEWED_CITATIONS = SKULL_FACE_PELVIS_LANDMARKS.flatMap((spec) => [
  reviewedLandmarkCitation(
    spec.slug,
    "official_term",
    `term-bone-landmark-${spec.slug}-preferred-fipat`,
    FIPAT_SOURCE,
    spec.officialLocator,
    "FIPAT TA2 official anatomical terminology used for the individual atlas landmark term row.",
  ),
  reviewedLandmarkCitation(
    spec.slug,
    "anatomy_landmark",
    `landmark-${spec.slug}`,
    APPLIED_HUMAN_ANATOMY_SOURCE,
    APPLIED_HUMAN_ANATOMY_LOCATOR,
    "MassageLab-authored landmark summary verified against Applied Human Anatomy skeletal organization and regional anatomy material.",
  ),
  sourceReferenceCitation(
    "bone_landmark",
    spec.slug,
    `bone_landmark:${spec.slug}`,
    APPLIED_HUMAN_ANATOMY_SOURCE,
    APPLIED_HUMAN_ANATOMY_LOCATOR,
    "Reviewed exact seed source reference for this individual atlas landmark row.",
  ),
]) satisfies NonNullable<AnatomySeedSection["citations"]>

const LANDMARK_TERM_SOURCE_REFERENCE_CITATIONS = NEW_LANDMARK_TERMS.map((term) => sourceReferenceCitation(
  term.anatomyEntityType,
  term.anatomyEntitySlug,
  `entity_term:${term.id}`,
  term.sourceRef,
  term.sourceRef === FIPAT_SOURCE ? "https://libraries.dal.ca/Fipat/ta2.html" : APPLIED_HUMAN_ANATOMY_LOCATOR,
  "Reviewed exact seed source reference for this atlas landmark terminology row.",
)) satisfies NonNullable<AnatomySeedSection["citations"]>

const EXISTING_LANDMARK_REVIEWED_CITATIONS = EXISTING_LANDMARK_TERM_SPECS.flatMap((spec) => [
  reviewedLandmarkCitation(
    spec.entitySlug,
    "official_term",
    `term-existing-bone-landmark-${spec.entitySlug}-preferred-fipat`,
    FIPAT_SOURCE,
    spec.officialLocator,
    "FIPAT TA2 official anatomical terminology used for the reviewed existing landmark term row.",
  ),
  reviewedLandmarkCitation(
    spec.entitySlug,
    "anatomy_landmark",
    undefined,
    APPLIED_HUMAN_ANATOMY_SOURCE,
    APPLIED_HUMAN_ANATOMY_LOCATOR,
    "Existing pelvic landmark summary and individual bone ownership verified against Applied Human Anatomy skeletal organization and regional anatomy material.",
  ),
]) satisfies NonNullable<AnatomySeedSection["citations"]>

const EXISTING_LANDMARK_TERM_SOURCE_REFERENCE_CITATIONS = EXISTING_LANDMARK_TERMS.map((term) => sourceReferenceCitation(
  term.anatomyEntityType,
  term.anatomyEntitySlug,
  `entity_term:${term.id}`,
  term.sourceRef,
  term.sourceRef === FIPAT_SOURCE ? "https://libraries.dal.ca/Fipat/ta2.html" : APPLIED_HUMAN_ANATOMY_LOCATOR,
  "Reviewed exact seed source reference for this existing atlas landmark terminology row.",
)) satisfies NonNullable<AnatomySeedSection["citations"]>

const RELATIONSHIP_CITATIONS = GROUP_RELATIONSHIPS.flatMap((relationship) => [
  {
    id: `citation-${relationship.id}-group-membership-reviewed`,
    slug: `citation-${relationship.id}-group-membership-reviewed`,
    entityType: relationship.sourceEntityType,
    entitySlug: relationship.sourceEntitySlug,
    factType: "group_membership",
    factSlug: relationship.id,
    sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
    sourceLocator: APPLIED_HUMAN_ANATOMY_LOCATOR,
    citationNote: "Individual atlas bone membership in grouped skeletal collection verified against Applied Human Anatomy skeletal organization.",
    reviewStatus: "reviewed",
  },
  sourceReferenceCitation(
    relationship.sourceEntityType,
    relationship.sourceEntitySlug,
    `relationship:${relationship.id}`,
    relationship.sourceRef,
    APPLIED_HUMAN_ANATOMY_LOCATOR,
    "Reviewed exact seed source reference for this individual-to-group atlas bone relationship.",
  ),
]) satisfies NonNullable<AnatomySeedSection["citations"]>

const EXISTING_BONE_TERM_CITATIONS = EXISTING_BONE_TERM_SPECS.flatMap((spec) => spec.terms.map((term) => reviewedCitation(
  spec.entitySlug,
  "alternate_term",
  `term-bone-${spec.entitySlug}-${slugify(term)}-alternate`,
  APPLIED_HUMAN_ANATOMY_SOURCE,
  APPLIED_HUMAN_ANATOMY_LOCATOR,
  `MassageLab-authored searchable numbered bone term reviewed against Applied Human Anatomy skeletal organization and ${spec.officialLocator}.`,
))) satisfies NonNullable<AnatomySeedSection["citations"]>

export const ATLAS_BONE_DETAIL_SECTION: AnatomySeedSection = {
  bones: ATLAS_BONES,
  boneLandmarks: ATLAS_LANDMARKS,
  entityTerms: [
    ...NEW_BONE_TERMS,
    ...NEW_LANDMARK_TERMS,
    ...EXISTING_BONE_TERMS,
    ...EXISTING_LANDMARK_TERMS,
  ],
  relationships: GROUP_RELATIONSHIPS,
  citations: [
    ...BONE_REVIEWED_CITATIONS,
    ...TERM_SOURCE_REFERENCE_CITATIONS,
    ...LANDMARK_REVIEWED_CITATIONS,
    ...LANDMARK_TERM_SOURCE_REFERENCE_CITATIONS,
    ...EXISTING_LANDMARK_REVIEWED_CITATIONS,
    ...EXISTING_LANDMARK_TERM_SOURCE_REFERENCE_CITATIONS,
    ...RELATIONSHIP_CITATIONS,
    ...EXISTING_BONE_TERM_CITATIONS,
  ],
}
