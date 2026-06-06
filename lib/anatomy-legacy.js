// @ts-check

// Archived reference data only. Runtime anatomy cards, Anatomime prompts, and
// education tools use the sourced foundation through lib/anatomy-study.ts.

/**
 * @typedef {"bone" | "muscle"} AnatomyKind
 * @typedef {"easy" | "medium" | "hard"} AnatomyDifficulty
 * @typedef {{ type: string, targetId: string }} AnatomyRelationship
 * @typedef {{
 *   id: string
 *   name: string
 *   kind: AnatomyKind
 *   regions: string[]
 *   difficulty: AnatomyDifficulty
 *   aliases: string[]
 *   definition?: string
 *   relationships?: AnatomyRelationship[]
 *   sourceRefs: string[]
 * }} AnatomyTerm
 * @typedef {{
 *   id: string
 *   label: string
 *   url?: string
 *   license?: string
 *   attribution: string
 * }} AnatomySource
 */

export const ANATOMY_KINDS = /** @type {const} */ (["bone", "muscle"])
export const ANATOMY_DIFFICULTIES = /** @type {const} */ (["easy", "medium", "hard"])

export const REGION_ORDER = /** @type {const} */ ([
  "head",
  "upper-extremity",
  "spine",
  "thorax",
  "abdomen",
  "pelvis",
  "lower-extremity",
])

export const REGION_LABELS = Object.freeze({
  head: "Head",
  "upper-extremity": "Upper Extremity",
  spine: "Spine",
  thorax: "Thorax",
  abdomen: "Abdomen",
  pelvis: "Pelvis",
  "lower-extremity": "Lower Extremity",
})

/** @type {Record<string, string[]>} */
export const musclesByArea = Object.freeze({
  head: [
    "anterior scalene", "aryepiglottic", "arytenoid, oblique", "arytenoid, transverse",
    "auricular", "buccinator", "chondroglossus", "ciliary", "constrictor, inferior pharyngeal",
    "constrictor, middle pharyngeal", "constrictor, superior pharyngeal", "corrugator",
    "cricoarytenoid, lateral", "cricoarytenoid, posterior", "cricopharyngeus", "cricothyroid",
    "depressor anguli oris", "depressor labii inferioris", "depressor septi", "digastric",
    "dilator pupillae", "epicranius", "frontalis", "genioglossus", "geniohyoid", "hyoglossus",
    "inferior oblique", "inferior pharyngeal constrictor", "inferior rectus", "lateral cricoarytenoid",
    "lateral pterygoid", "lateral rectus", "levator anguli oris", "levator labii superioris",
    "levator labii superioris alaque nasi", "levator palpebrae superioris", "levator scapulae",
    "levator veli palatini", "linguae, longitudinalis", "linguae, transversus", "linguae, verticalis",
    "longus capitis", "longus colli", "masseter", "medial pterygoid", "medial rectus", "mentalis",
    "middle pharyngeal constrictor", "middle scalene", "musculus uvulae", "mylohyoid", "nasalis",
    "nasalis pars alaris", "nasalis pars transversa", "oblique arytenoid", "oblique, inferior",
    "oblique, superior", "occipitalis", "occipitofrontalis", "omohyoid", "orbicularis oculi",
    "orbicularis oris", "palatoglossus", "palatopharyngeus", "platysma", "posterior cricoarytenoid",
    "posterior scalene", "procerus", "pterygoid, lateral", "pterygoid, medial", "pupillae, dilator",
    "pupillae, sphincter", "rectus capitis anterior", "rectus capitis lateralis", "rectus, inferior",
    "rectus, lateral", "rectus, medial", "rectus, superior", "risorius", "salpingopharyngeus",
    "scalene, anterior", "scalene, middle", "scalene, posterior", "sphenomeniscus", "sphincter pupillae",
    "splenius", "stapedius", "sternocleidomastoid", "sternohyoid", "sternothyroid", "styloglossus",
    "stylohyoid", "stylopharyngeus", "superior oblique", "superior pharyngeal constrictor",
    "superior rectus", "temporalis", "tensor tympani", "tensor veli palatini", "thyroarytenoid",
    "thyroepiglottic", "thyrohyoid", "trachealis", "transverse arytenoid", "vocalis",
    "zygomaticus major", "zygomaticus minor",
  ],
  "upper-extremity": [
    "abductor digiti minimi (hand)", "abductor pollicis brevis", "abductor pollicis longus",
    "adductor pollicis", "anconeus", "biceps brachii", "brachialis", "brachioradialis",
    "coracobrachialis", "deltoid", "dorsal interosseous (hand)", "extensor carpi radialis brevis",
    "extensor carpi radialis longus", "extensor carpi ulnaris", "extensor digiti minimi",
    "extensor digitorum", "extensor indicis", "extensor pollicis brevis", "extensor pollicis longus",
    "flexor carpi radialis", "flexor carpi ulnaris", "flexor digiti minimi brevis (hand)",
    "flexor digitorum profundus", "flexor digitorum superficialis", "flexor pollicis brevis",
    "flexor pollicis longus", "infraspinatus", "interosseous, dorsal (hand)",
    "interosseous, palmar", "latissimus dorsi", "levator scapulae", "lumbrical (hand)",
    "opponens digiti minimi", "opponens pollicis", "palmar interosseous", "palmaris brevis",
    "palmaris longus", "pectoralis major", "pectoralis minor", "pronator quadratus",
    "pronator teres", "rhomboideus major", "rhomboideus minor", "serratus anterior",
    "serratus posterior inferior", "serratus posterior superior", "subclavius",
    "subscapularis", "supinator", "supraspinatus", "teres major", "teres minor",
    "trapezius", "triceps brachii",
  ],
  spine: [
    "erector spinae", "iliocostalis", "interspinales", "intertransversarii", "longissimus",
    "multifidus", "obliquus capitis inferior", "obliquus capitis superior",
    "rectus capitis posterior major", "rectus capitis posterior minor", "rotatores",
    "semispinalis", "spinalis", "splenius", "splenius capitis", "splenius cervicis",
  ],
  thorax: [
    "diaphragm", "external intercostal", "innermost intercostal", "internal intercostal",
    "levatores costarum", "subcostalis", "transversus thoracis",
  ],
  abdomen: [
    "cremaster", "dartos", "external abdominal oblique", "interfoveolar",
    "internal abdominal oblique", "oblique, external abdominal", "oblique, internal abdominal",
    "psoas major", "psoas minor", "pyramidalis", "quadratus lumborum", "rectus abdominis",
    "transversus abdominis",
  ],
  pelvis: [
    "anal sphincter, external", "anal sphincter, internal", "bulbospongiosus, in female",
    "bulbospongiosus, in male", "coccygeus", "deep transverse perineus", "detruser of bladder",
    "iliococcygeus", "ischiocavernosus", "levator ani", "levator prostatae", "pubococcygeus",
    "puborectalis", "pubovaginalis", "sphincter ani externus", "sphincter ani internus",
    "sphincter urethrae, in female", "sphincter urethrae, in male", "superficial transverse perineus",
    "transverse perineus, deep", "transverse perineus, superficial",
  ],
  "lower-extremity": [
    "abductor digiti minimi (foot)", "abductor hallucis", "adductor brevis", "adductor hallucis",
    "adductor longus", "adductor magnus", "adductor minimus", "articularis genu", "biceps femoris",
    "dorsal interosseous (foot)", "extensor digitorum brevis", "extensor digitorum longus",
    "extensor hallucis brevis", "extensor hallucis longus", "fibularis (peroneus) brevis",
    "fibularis (peroneus) longus", "fibularis (peroneus) tertius", "flexor digiti minimi brevis (foot)",
    "flexor digitorum brevis", "flexor digitorum longus", "flexor hallucis brevis",
    "flexor hallucis longus", "gastrocnemius", "gemellus, inferior", "gemellus, superior",
    "gluteus maximus", "gluteus medius", "gluteus minimus", "gracilis", "iliacus", "iliopsoas",
    "inferior gemellus", "interosseous, dorsal (foot)", "interosseous, plantar", "lumbricals (foot)",
    "obturator externus", "obturator internus", "pectineus", "piriformis", "plantar interosseous",
    "plantaris", "popliteus", "psoas major", "psoas minor", "quadratus femoris",
    "quadratus plantae", "quadriceps femoris", "rectus femoris", "sartorius", "semimembranosus",
    "semitendinosus", "soleus", "superior gemellus", "tensor fasciae latae", "tibialis anterior",
    "tibialis posterior", "vastus intermedius", "vastus lateralis", "vastus medialis",
  ],
})

/** @type {Record<string, AnatomySource>} */
export const ANATOMY_SOURCES = Object.freeze({
  "massagelab-muscle-seed": {
    id: "massagelab-muscle-seed",
    label: "MassageLab original muscle seed list",
    attribution: "Original MassageLab classroom muscle list.",
  },
  "openstax-ap-2e": {
    id: "openstax-ap-2e",
    label: "OpenStax Anatomy and Physiology 2e",
    url: "https://openstax.org/books/anatomy-and-physiology-2e/pages/preface",
    license: "CC BY 4.0",
    attribution: "Anatomy and Physiology 2e by OpenStax, Rice University.",
  },
})

const EASY_MUSCLES = new Set([
  "biceps brachii",
  "deltoid",
  "diaphragm",
  "external abdominal oblique",
  "external intercostal",
  "gastrocnemius",
  "gluteus maximus",
  "gluteus medius",
  "latissimus dorsi",
  "masseter",
  "pectoralis major",
  "quadriceps femoris",
  "rectus abdominis",
  "rectus femoris",
  "sternocleidomastoid",
  "temporalis",
  "trapezius",
  "triceps brachii",
])

const MEDIUM_MUSCLES = new Set([
  "adductor longus",
  "biceps femoris",
  "brachialis",
  "brachioradialis",
  "flexor carpi radialis",
  "flexor carpi ulnaris",
  "gracilis",
  "iliacus",
  "iliopsoas",
  "infraspinatus",
  "internal abdominal oblique",
  "internal intercostal",
  "levator scapulae",
  "multifidus",
  "orbicularis oculi",
  "orbicularis oris",
  "piriformis",
  "psoas major",
  "quadratus lumborum",
  "sartorius",
  "semimembranosus",
  "semitendinosus",
  "serratus anterior",
  "soleus",
  "subscapularis",
  "supraspinatus",
  "teres major",
  "teres minor",
  "tibialis anterior",
  "vastus lateralis",
  "vastus medialis",
])

const DIFFICULTY_RANK = Object.freeze({
  easy: 1,
  medium: 2,
  hard: 3,
})

/** @type {Array<Omit<AnatomyTerm, "id"> & { id?: string }>} */
const boneSeed = [
  { name: "skull", kind: "bone", regions: ["head"], difficulty: "easy", aliases: ["cranium"], definition: "The bony framework of the head that protects the brain and supports the face.", sourceRefs: ["openstax-ap-2e"] },
  { name: "cranium", kind: "bone", regions: ["head"], difficulty: "easy", aliases: ["cranial bones"], definition: "The portion of the skull that surrounds and protects the brain.", sourceRefs: ["openstax-ap-2e"] },
  { name: "mandible", kind: "bone", regions: ["head"], difficulty: "easy", aliases: ["lower jaw"], definition: "The movable lower jaw bone.", sourceRefs: ["openstax-ap-2e"] },
  { name: "maxilla", kind: "bone", regions: ["head"], difficulty: "easy", aliases: ["upper jaw"], definition: "A paired facial bone that forms the upper jaw and part of the hard palate.", sourceRefs: ["openstax-ap-2e"] },
  { name: "zygomatic bone", kind: "bone", regions: ["head"], difficulty: "medium", aliases: ["cheekbone"], definition: "A facial bone that forms the prominence of the cheek.", sourceRefs: ["openstax-ap-2e"] },
  { name: "frontal bone", kind: "bone", regions: ["head"], difficulty: "medium", aliases: [], definition: "A cranial bone forming the forehead and superior part of the eye sockets.", sourceRefs: ["openstax-ap-2e"] },
  { name: "parietal bone", kind: "bone", regions: ["head"], difficulty: "medium", aliases: [], definition: "One of the paired cranial bones forming the superior lateral skull.", sourceRefs: ["openstax-ap-2e"] },
  { name: "temporal bone", kind: "bone", regions: ["head"], difficulty: "medium", aliases: [], definition: "A paired cranial bone on the lateral skull near the ear.", sourceRefs: ["openstax-ap-2e"] },
  { name: "occipital bone", kind: "bone", regions: ["head"], difficulty: "medium", aliases: [], definition: "The posterior cranial bone forming the back and base of the skull.", sourceRefs: ["openstax-ap-2e"] },
  { name: "sphenoid bone", kind: "bone", regions: ["head"], difficulty: "hard", aliases: [], definition: "A complex cranial bone that spans the skull base.", sourceRefs: ["openstax-ap-2e"] },
  { name: "ethmoid bone", kind: "bone", regions: ["head"], difficulty: "hard", aliases: [], definition: "A cranial bone contributing to the nasal cavity and medial orbit.", sourceRefs: ["openstax-ap-2e"] },
  { name: "nasal bone", kind: "bone", regions: ["head"], difficulty: "medium", aliases: [], definition: "A paired facial bone forming the bridge of the nose.", sourceRefs: ["openstax-ap-2e"] },

  { name: "clavicle", kind: "bone", regions: ["upper-extremity", "thorax"], difficulty: "easy", aliases: ["collarbone"], definition: "A slender bone connecting the sternum to the scapula.", sourceRefs: ["openstax-ap-2e"] },
  { name: "scapula", kind: "bone", regions: ["upper-extremity", "thorax"], difficulty: "easy", aliases: ["shoulder blade"], definition: "A flat triangular bone forming part of the shoulder girdle.", sourceRefs: ["openstax-ap-2e"] },
  { name: "humerus", kind: "bone", regions: ["upper-extremity"], difficulty: "easy", aliases: ["arm bone"], definition: "The bone of the upper arm.", sourceRefs: ["openstax-ap-2e"] },
  { name: "radius", kind: "bone", regions: ["upper-extremity"], difficulty: "easy", aliases: [], definition: "The lateral forearm bone when in anatomical position.", sourceRefs: ["openstax-ap-2e"] },
  { name: "ulna", kind: "bone", regions: ["upper-extremity"], difficulty: "easy", aliases: [], definition: "The medial forearm bone when in anatomical position.", sourceRefs: ["openstax-ap-2e"] },
  { name: "carpals", kind: "bone", regions: ["upper-extremity"], difficulty: "medium", aliases: ["wrist bones"], definition: "The group of small bones forming the wrist.", sourceRefs: ["openstax-ap-2e"] },
  { name: "metacarpals", kind: "bone", regions: ["upper-extremity"], difficulty: "medium", aliases: ["hand bones"], definition: "The bones of the palm between the carpals and phalanges.", sourceRefs: ["openstax-ap-2e"] },
  { name: "phalanges (hand)", kind: "bone", regions: ["upper-extremity"], difficulty: "medium", aliases: ["finger bones"], definition: "The finger bones of the hand.", sourceRefs: ["openstax-ap-2e"] },
  { name: "scaphoid", kind: "bone", regions: ["upper-extremity"], difficulty: "hard", aliases: [], definition: "A carpal bone on the thumb side of the wrist.", sourceRefs: ["openstax-ap-2e"] },
  { name: "lunate", kind: "bone", regions: ["upper-extremity"], difficulty: "hard", aliases: [], definition: "A crescent-shaped carpal bone in the proximal wrist row.", sourceRefs: ["openstax-ap-2e"] },

  { name: "vertebral column", kind: "bone", regions: ["spine"], difficulty: "easy", aliases: ["spine", "backbone"], definition: "The series of vertebrae forming the central support of the skeleton.", sourceRefs: ["openstax-ap-2e"] },
  { name: "cervical vertebrae", kind: "bone", regions: ["spine", "head"], difficulty: "easy", aliases: ["neck vertebrae"], definition: "The vertebrae of the neck region.", sourceRefs: ["openstax-ap-2e"] },
  { name: "thoracic vertebrae", kind: "bone", regions: ["spine", "thorax"], difficulty: "easy", aliases: [], definition: "The vertebrae of the upper and mid back that articulate with ribs.", sourceRefs: ["openstax-ap-2e"] },
  { name: "lumbar vertebrae", kind: "bone", regions: ["spine", "abdomen"], difficulty: "easy", aliases: [], definition: "The large vertebrae of the lower back.", sourceRefs: ["openstax-ap-2e"] },
  { name: "sacrum", kind: "bone", regions: ["spine", "pelvis", "abdomen"], difficulty: "easy", aliases: [], definition: "A triangular bone at the base of the spine formed from fused sacral vertebrae.", sourceRefs: ["openstax-ap-2e"] },
  { name: "coccyx", kind: "bone", regions: ["spine", "pelvis"], difficulty: "medium", aliases: ["tailbone"], definition: "The small terminal bone at the inferior end of the vertebral column.", sourceRefs: ["openstax-ap-2e"] },
  { name: "atlas", kind: "bone", regions: ["spine", "head"], difficulty: "hard", aliases: ["C1"], definition: "The first cervical vertebra supporting the skull.", sourceRefs: ["openstax-ap-2e"] },
  { name: "axis", kind: "bone", regions: ["spine", "head"], difficulty: "hard", aliases: ["C2"], definition: "The second cervical vertebra that allows head rotation.", sourceRefs: ["openstax-ap-2e"] },
  { name: "spinous process", kind: "bone", regions: ["spine"], difficulty: "medium", aliases: [], definition: "A posterior projection from a vertebra.", sourceRefs: ["openstax-ap-2e"] },

  { name: "sternum", kind: "bone", regions: ["thorax"], difficulty: "easy", aliases: ["breastbone"], definition: "The flat midline bone of the anterior thoracic cage.", sourceRefs: ["openstax-ap-2e"] },
  { name: "ribs", kind: "bone", regions: ["thorax", "abdomen"], difficulty: "easy", aliases: [], definition: "Curved bones forming the thoracic cage.", sourceRefs: ["openstax-ap-2e"] },
  { name: "manubrium", kind: "bone", regions: ["thorax"], difficulty: "medium", aliases: [], definition: "The superior portion of the sternum.", sourceRefs: ["openstax-ap-2e"] },
  { name: "body of sternum", kind: "bone", regions: ["thorax"], difficulty: "medium", aliases: ["gladiolus"], definition: "The long central portion of the sternum.", sourceRefs: ["openstax-ap-2e"] },
  { name: "xiphoid process", kind: "bone", regions: ["thorax", "abdomen"], difficulty: "medium", aliases: [], definition: "The inferior tip of the sternum.", sourceRefs: ["openstax-ap-2e"] },
  { name: "true ribs", kind: "bone", regions: ["thorax"], difficulty: "medium", aliases: [], definition: "Ribs that attach directly to the sternum through costal cartilage.", sourceRefs: ["openstax-ap-2e"] },
  { name: "false ribs", kind: "bone", regions: ["thorax", "abdomen"], difficulty: "medium", aliases: [], definition: "Ribs that do not attach directly to the sternum.", sourceRefs: ["openstax-ap-2e"] },
  { name: "floating ribs", kind: "bone", regions: ["thorax", "abdomen"], difficulty: "hard", aliases: [], definition: "Inferior ribs with no anterior attachment to the sternum.", sourceRefs: ["openstax-ap-2e"] },
  { name: "eleventh rib", kind: "bone", regions: ["thorax", "abdomen"], difficulty: "hard", aliases: ["11th rib"], definition: "One of the floating ribs of the thoracic cage.", sourceRefs: ["openstax-ap-2e"] },
  { name: "twelfth rib", kind: "bone", regions: ["thorax", "abdomen"], difficulty: "hard", aliases: ["12th rib"], definition: "The lowest floating rib of the thoracic cage.", sourceRefs: ["openstax-ap-2e"] },

  { name: "pelvis", kind: "bone", regions: ["pelvis", "abdomen"], difficulty: "easy", aliases: ["bony pelvis"], definition: "The ring-like bony structure formed by the hip bones, sacrum, and coccyx.", sourceRefs: ["openstax-ap-2e"] },
  { name: "hip bone", kind: "bone", regions: ["pelvis", "abdomen"], difficulty: "easy", aliases: ["coxal bone", "os coxae"], definition: "A pelvic bone formed by the ilium, ischium, and pubis.", sourceRefs: ["openstax-ap-2e"] },
  { name: "ilium", kind: "bone", regions: ["pelvis", "abdomen"], difficulty: "medium", aliases: [], definition: "The large superior portion of the hip bone.", sourceRefs: ["openstax-ap-2e"] },
  { name: "ischium", kind: "bone", regions: ["pelvis"], difficulty: "medium", aliases: [], definition: "The posteroinferior portion of the hip bone.", sourceRefs: ["openstax-ap-2e"] },
  { name: "pubis", kind: "bone", regions: ["pelvis"], difficulty: "medium", aliases: ["pubic bone"], definition: "The anterior portion of the hip bone.", sourceRefs: ["openstax-ap-2e"] },
  { name: "acetabulum", kind: "bone", regions: ["pelvis", "lower-extremity"], difficulty: "hard", aliases: ["hip socket"], definition: "The socket of the hip bone that receives the head of the femur.", sourceRefs: ["openstax-ap-2e"] },
  { name: "iliac crest", kind: "bone", regions: ["pelvis", "abdomen"], difficulty: "medium", aliases: [], definition: "The superior border of the ilium.", sourceRefs: ["openstax-ap-2e"] },

  { name: "femur", kind: "bone", regions: ["lower-extremity", "pelvis"], difficulty: "easy", aliases: ["thigh bone"], definition: "The bone of the thigh.", sourceRefs: ["openstax-ap-2e"] },
  { name: "patella", kind: "bone", regions: ["lower-extremity"], difficulty: "easy", aliases: ["kneecap"], definition: "A sesamoid bone at the front of the knee.", sourceRefs: ["openstax-ap-2e"] },
  { name: "tibia", kind: "bone", regions: ["lower-extremity"], difficulty: "easy", aliases: ["shin bone"], definition: "The larger medial bone of the leg.", sourceRefs: ["openstax-ap-2e"] },
  { name: "fibula", kind: "bone", regions: ["lower-extremity"], difficulty: "easy", aliases: [], definition: "The slender lateral bone of the leg.", sourceRefs: ["openstax-ap-2e"] },
  { name: "tarsals", kind: "bone", regions: ["lower-extremity"], difficulty: "medium", aliases: ["ankle bones"], definition: "The group of bones forming the ankle and proximal foot.", sourceRefs: ["openstax-ap-2e"] },
  { name: "metatarsals", kind: "bone", regions: ["lower-extremity"], difficulty: "medium", aliases: ["foot bones"], definition: "The long bones of the foot between the tarsals and phalanges.", sourceRefs: ["openstax-ap-2e"] },
  { name: "phalanges (foot)", kind: "bone", regions: ["lower-extremity"], difficulty: "medium", aliases: ["toe bones"], definition: "The toe bones of the foot.", sourceRefs: ["openstax-ap-2e"] },
  { name: "calcaneus", kind: "bone", regions: ["lower-extremity"], difficulty: "medium", aliases: ["heel bone"], definition: "The largest tarsal bone, forming the heel.", sourceRefs: ["openstax-ap-2e"] },
  { name: "talus", kind: "bone", regions: ["lower-extremity"], difficulty: "hard", aliases: [], definition: "A tarsal bone that articulates with the tibia and fibula at the ankle.", sourceRefs: ["openstax-ap-2e"] },
  { name: "navicular", kind: "bone", regions: ["lower-extremity"], difficulty: "hard", aliases: [], definition: "A medial tarsal bone of the foot.", sourceRefs: ["openstax-ap-2e"] },
  { name: "cuboid", kind: "bone", regions: ["lower-extremity"], difficulty: "hard", aliases: [], definition: "A lateral tarsal bone of the foot.", sourceRefs: ["openstax-ap-2e"] },
  { name: "cuneiforms", kind: "bone", regions: ["lower-extremity"], difficulty: "hard", aliases: ["cuneiform bones"], definition: "Three tarsal bones located between the navicular and metatarsals.", sourceRefs: ["openstax-ap-2e"] },
]

/**
 * @param {string} value
 */
function normalizeIdPart(value) {
  return value
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
}

/**
 * @param {AnatomyKind} kind
 * @param {string} name
 */
function anatomyId(kind, name) {
  return `${kind}-${normalizeIdPart(name)}`
}

/**
 * @param {string} name
 * @returns {AnatomyDifficulty}
 */
function muscleDifficulty(name) {
  const normalized = name.toLowerCase()
  if (EASY_MUSCLES.has(normalized)) return "easy"
  if (MEDIUM_MUSCLES.has(normalized)) return "medium"
  return "hard"
}

/**
 * @param {string} name
 */
function aliasesFromName(name) {
  const aliasMatches = [...name.matchAll(/\(([^)]+)\)/g)]
  return aliasMatches.map((match) => match[1]).filter(Boolean)
}

/**
 * @returns {AnatomyTerm[]}
 */
function buildMuscleTerms() {
  /** @type {Map<string, AnatomyTerm>} */
  const byName = new Map()

  Object.entries(musclesByArea).forEach(([region, names]) => {
    names.forEach((name) => {
      const key = name.toLowerCase()
      const existing = byName.get(key)
      if (existing) {
        if (!existing.regions.includes(region)) {
          existing.regions.push(region)
        }
        return
      }

      byName.set(key, {
        id: anatomyId("muscle", name),
        name,
        kind: "muscle",
        regions: [region],
        difficulty: muscleDifficulty(name),
        aliases: aliasesFromName(name),
        sourceRefs: ["massagelab-muscle-seed"],
      })
    })
  })

  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name))
}

/**
 * @returns {AnatomyTerm[]}
 */
function buildBoneTerms() {
  return boneSeed.map((term) => ({
    ...term,
    id: term.id ?? anatomyId("bone", term.name),
    aliases: term.aliases ?? [],
  }))
}

/** @type {AnatomyTerm[]} */
export const anatomyTerms = [...buildMuscleTerms(), ...buildBoneTerms()].sort((a, b) => {
  if (a.kind !== b.kind) return a.kind.localeCompare(b.kind)
  return a.name.localeCompare(b.name)
})

/**
 * @param {unknown} value
 * @returns {value is AnatomyKind}
 */
function isAnatomyKind(value) {
  return typeof value === "string" && ANATOMY_KINDS.includes(/** @type {AnatomyKind} */ (value))
}

/**
 * @param {unknown} value
 * @returns {value is AnatomyDifficulty}
 */
function isAnatomyDifficulty(value) {
  return typeof value === "string" && ANATOMY_DIFFICULTIES.includes(/** @type {AnatomyDifficulty} */ (value))
}

/**
 * @param {unknown} value
 */
function isRegion(value) {
  return typeof value === "string" && REGION_ORDER.includes(/** @type {typeof REGION_ORDER[number]} */ (value))
}

/**
 * @param {unknown[] | undefined} values
 * @param {(value: unknown) => boolean} predicate
 * @param {string[]} fallback
 */
function normalizeFilter(values, predicate, fallback) {
  if (!Array.isArray(values)) return fallback
  return values.filter(predicate).map(String)
}

/**
 * @param {{
 *   kinds?: AnatomyKind[]
 *   regions?: string[]
 *   difficulty?: AnatomyDifficulty
 * }} [options]
 */
export function getAnatomyTerms(options = {}) {
  const kinds = normalizeFilter(options.kinds, isAnatomyKind, [...ANATOMY_KINDS])
  const regions = normalizeFilter(options.regions, isRegion, [...REGION_ORDER])
  const difficulty = isAnatomyDifficulty(options.difficulty) ? options.difficulty : "hard"
  const maxDifficulty = DIFFICULTY_RANK[difficulty]

  if (kinds.length === 0 || regions.length === 0) return []

  return anatomyTerms.filter((term) => (
    kinds.includes(term.kind) &&
    DIFFICULTY_RANK[term.difficulty] <= maxDifficulty &&
    term.regions.some((region) => regions.includes(region))
  ))
}

/**
 * @param {{
 *   kinds?: AnatomyKind[]
 *   regions?: string[]
 *   difficulty?: AnatomyDifficulty
 *   count?: number
 *   rng?: () => number
 * }} [options]
 */
export function createAnatomimeDeck(options = {}) {
  const count = Number.isFinite(options.count) ? Math.max(0, Math.floor(/** @type {number} */ (options.count))) : 4
  const rng = typeof options.rng === "function" ? options.rng : Math.random
  const terms = getAnatomyTerms(options)

  return [...terms]
    .sort(() => rng() - 0.5)
    .slice(0, count)
}

export function getAnatomyRegions() {
  return REGION_ORDER.map((id) => {
    const terms = anatomyTerms.filter((term) => term.regions.includes(id))
    return {
      id,
      label: REGION_LABELS[id],
      termCount: terms.length,
      kinds: [...new Set(terms.map((term) => term.kind))].sort(),
    }
  })
}

export function getAnatomySources() {
  return Object.values(ANATOMY_SOURCES)
}

/**
 * @param {AnatomyTerm[]} [terms]
 */
export function validateAnatomyContent(terms = anatomyTerms) {
  /** @type {string[]} */
  const issues = []
  const ids = new Set()
  const duplicateIds = new Set()

  terms.forEach((term) => {
    if (!term.id || typeof term.id !== "string") {
      issues.push(`Missing id for term "${term.name ?? "unknown"}"`)
      return
    }
    if (ids.has(term.id)) {
      duplicateIds.add(term.id)
    }
    ids.add(term.id)
  })

  duplicateIds.forEach((id) => issues.push(`Duplicate anatomy term id: ${id}`))

  terms.forEach((term) => {
    if (!term.name || !term.name.trim()) {
      issues.push(`Empty anatomy term name for id: ${term.id}`)
    }
    if (!isAnatomyKind(term.kind)) {
      issues.push(`Invalid anatomy kind for id: ${term.id}`)
    }
    if (!isAnatomyDifficulty(term.difficulty)) {
      issues.push(`Invalid anatomy difficulty for id: ${term.id}`)
    }
    if (!Array.isArray(term.regions) || term.regions.length === 0 || term.regions.some((region) => !isRegion(region))) {
      issues.push(`Invalid anatomy regions for id: ${term.id}`)
    }
    if (!Array.isArray(term.sourceRefs) || term.sourceRefs.some((sourceRef) => !ANATOMY_SOURCES[sourceRef])) {
      issues.push(`Invalid anatomy source reference for id: ${term.id}`)
    }
    if (term.relationships?.some((relationship) => !ids.has(relationship.targetId))) {
      issues.push(`Invalid anatomy relationship target for id: ${term.id}`)
    }
  })

  return issues
}
