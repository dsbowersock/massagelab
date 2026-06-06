import type { AnatomyEntityType, AnatomyTermType, MuscleRelativeDepth } from "../anatomy-foundation.ts"
import type { AnatomySeedSection } from "./sections.ts"

const FIPAT_SOURCE = "fipat-ta2"
const APPLIED_HUMAN_ANATOMY_SOURCE = "applied-human-anatomy"
const CLIENT_LANGUAGE_SOURCE = "massagelab-authored-client-language"
const APPLIED_HUMAN_ANATOMY_LOCATOR = "https://open.umn.edu/opentextbooks/textbooks/1266"
const FIPAT_LOCATOR = "https://libraries.dal.ca/Fipat/ta2.html"

type EntityTermRows = NonNullable<AnatomySeedSection["entityTerms"]>
type CitationRows = NonNullable<AnatomySeedSection["citations"]>
type RelationshipRows = NonNullable<AnatomySeedSection["relationships"]>
type MuscleRows = NonNullable<AnatomySeedSection["muscles"]>
type StructureRows = NonNullable<AnatomySeedSection["structures"]>

type NewMuscleSpec = {
  slug: string
  name: string
  formalName: string
  alternateNames: string[]
  description: string
  region: string
  relativeDepth: MuscleRelativeDepth
  depthNotes?: string
  commonTerms?: string[]
  legacyTerms?: Array<{ term: string; termType?: AnatomyTermType; notes?: string }>
}

type NewStructureSpec = {
  slug: string
  name: string
  formalTerm: string
  structureType: string
  region: string
  description: string
  commonTerms?: string[]
  legacyTerms?: Array<{ term: string; termType?: AnatomyTermType; notes?: string }>
}

type LegacyEntityTermSpec = {
  entityType: AnatomyEntityType
  entitySlug: string
  term: string
  termType?: AnatomyTermType
  sourceRef?: string
  notes?: string
}

type GroupRelationshipSpec = {
  sourceEntityType: AnatomyEntityType
  sourceEntitySlug: string
  targetEntityType: AnatomyEntityType
  targetEntitySlugs: readonly string[]
  relationshipType: string
}

const NEW_MUSCLE_SPECS: readonly NewMuscleSpec[] = [
  {
    slug: "external-anal-sphincter",
    name: "External Anal Sphincter",
    formalName: "Musculus sphincter ani externus",
    alternateNames: ["sphincter ani externus", "external anal sphincter"],
    description: "External anal sphincter is voluntary skeletal muscle encircling the anal canal. It supports continence and is grouped with pelvic floor and perineal anatomy for non-diagnostic education.",
    region: "pelvis",
    relativeDepth: "deep",
    depthNotes: "Deep pelvic outlet muscle surrounding the anal canal.",
    legacyTerms: [
      { term: "anal sphincter, external" },
      { term: "sphincter ani externus" },
    ],
  },
  {
    slug: "internal-anal-sphincter",
    name: "Internal Anal Sphincter",
    formalName: "Musculus sphincter ani internus",
    alternateNames: ["sphincter ani internus", "internal anal sphincter"],
    description: "Internal anal sphincter is smooth circular muscle at the anal canal. It is represented separately from the external anal sphincter so public study cards do not collapse voluntary and involuntary sphincter anatomy.",
    region: "pelvis",
    relativeDepth: "deep",
    depthNotes: "Deep smooth muscle layer of the anorectal outlet.",
    legacyTerms: [
      { term: "anal sphincter, internal" },
      { term: "sphincter ani internus" },
    ],
  },
  {
    slug: "ciliary-muscle",
    name: "Ciliary Muscle",
    formalName: "Musculus ciliaris",
    alternateNames: ["ciliary"],
    description: "Ciliary muscle is an intrinsic eye muscle associated with the ciliary body. It changes lens shape during accommodation and belongs in head and eye anatomy rather than massage treatment targeting.",
    region: "head",
    relativeDepth: "deep",
    depthNotes: "Deep intrinsic eye muscle.",
    legacyTerms: [{ term: "ciliary" }],
  },
  {
    slug: "dilator-pupillae",
    name: "Dilator Pupillae",
    formalName: "Musculus dilatator pupillae",
    alternateNames: ["pupillary dilator", "dilator pupillae muscle"],
    description: "Dilator pupillae is a radial smooth muscle of the iris. It widens the pupil and is kept as head and eye education content with source-backed terminology.",
    region: "head",
    relativeDepth: "deep",
    depthNotes: "Intrinsic iris smooth muscle.",
    legacyTerms: [
      { term: "dilator pupillae" },
      { term: "pupillae, dilator" },
    ],
  },
  {
    slug: "sphincter-pupillae",
    name: "Sphincter Pupillae",
    formalName: "Musculus sphincter pupillae",
    alternateNames: ["pupillary sphincter", "constrictor pupillae"],
    description: "Sphincter pupillae is a circular smooth muscle of the iris. It constricts the pupil and is modeled distinctly from the dilator pupillae for accurate study labeling.",
    region: "head",
    relativeDepth: "deep",
    depthNotes: "Intrinsic iris smooth muscle.",
    legacyTerms: [
      { term: "pupillae, sphincter" },
      { term: "sphincter pupillae" },
    ],
  },
  {
    slug: "cremaster",
    name: "Cremaster",
    formalName: "Musculus cremaster",
    alternateNames: ["cremaster muscle"],
    description: "Cremaster is a skeletal muscle layer associated with the spermatic cord and scrotal coverings. It belongs to pelvis and lower abdominal wall education and is not a public treatment target.",
    region: "pelvis",
    relativeDepth: "variable",
    depthNotes: "Genitourinary-associated muscle layer near the inguinal and scrotal region.",
    legacyTerms: [{ term: "cremaster" }],
  },
  {
    slug: "dartos",
    name: "Dartos",
    formalName: "Musculus dartos",
    alternateNames: ["dartos muscle", "tunica dartos"],
    description: "Dartos is a smooth muscle layer in superficial scrotal tissue. It is represented as a pelvis-region anatomy term so the legacy label is preserved without merging it into skeletal pelvic floor muscles.",
    region: "pelvis",
    relativeDepth: "superficial",
    depthNotes: "Superficial smooth muscle layer of external genital skin.",
    legacyTerms: [{ term: "dartos" }],
  },
  {
    slug: "detrusor-muscle-of-bladder",
    name: "Detrusor Muscle of Bladder",
    formalName: "Musculus detrusor vesicae",
    alternateNames: ["detrusor muscle", "bladder detrusor"],
    description: "The detrusor muscle is smooth muscle in the wall of the urinary bladder. It is preserved as sourced pelvis anatomy and separates the old misspelled label from the reviewed product term.",
    region: "pelvis",
    relativeDepth: "deep",
    depthNotes: "Smooth muscle of the bladder wall.",
    legacyTerms: [
      { term: "detrusor of bladder" },
      { term: "detruser of bladder", notes: "Legacy Anatomime spelling preserved as an alternate search term; reviewed display name uses detrusor." },
    ],
  },
  {
    slug: "deep-transverse-perineal",
    name: "Deep Transverse Perineal",
    formalName: "Musculus transversus perinei profundus",
    alternateNames: ["deep transverse perineus", "transverse perineus deep"],
    description: "Deep transverse perineal muscle is a deep perineal muscle associated with the urogenital diaphragm region. It is grouped with pelvic floor education and distinct from the superficial transverse perineal muscle.",
    region: "pelvis",
    relativeDepth: "deep",
    depthNotes: "Deep perineal muscle layer.",
    legacyTerms: [
      { term: "deep transverse perineus" },
      { term: "transverse perineus, deep" },
    ],
  },
  {
    slug: "superficial-transverse-perineal",
    name: "Superficial Transverse Perineal",
    formalName: "Musculus transversus perinei superficialis",
    alternateNames: ["superficial transverse perineus", "transverse perineus superficial"],
    description: "Superficial transverse perineal muscle is a superficial perineal muscle associated with the perineal body. It is modeled separately from the deep transverse perineal muscle for accurate card labels.",
    region: "pelvis",
    relativeDepth: "superficial",
    depthNotes: "Superficial perineal muscle layer.",
    legacyTerms: [
      { term: "superficial transverse perineus" },
      { term: "transverse perineus, superficial" },
    ],
  },
  {
    slug: "external-urethral-sphincter",
    name: "External Urethral Sphincter",
    formalName: "Musculus sphincter urethrae externus",
    alternateNames: ["sphincter urethrae", "urethral sphincter"],
    description: "External urethral sphincter is voluntary sphincter musculature around the urethra. Sex-specific legacy labels map to this reviewed entity instead of creating duplicate male and female public card answers.",
    region: "pelvis",
    relativeDepth: "deep",
    depthNotes: "Deep urogenital sphincter muscle.",
    legacyTerms: [
      { term: "sphincter urethrae, in female", notes: "Legacy sex-specific label mapped to the reviewed external urethral sphincter entity." },
      { term: "sphincter urethrae, in male", notes: "Legacy sex-specific label mapped to the reviewed external urethral sphincter entity." },
    ],
  },
  {
    slug: "chondroglossus",
    name: "Chondroglossus",
    formalName: "Musculus chondroglossus",
    alternateNames: ["chondroglossus muscle"],
    description: "Chondroglossus is a small tongue muscle slip associated with the hyoid and intrinsic/extrinsic tongue anatomy. It remains in head and jaw education as a sourced legacy term.",
    region: "jaw",
    relativeDepth: "deep",
    depthNotes: "Deep tongue-region muscle slip.",
    legacyTerms: [{ term: "chondroglossus" }],
  },
  {
    slug: "cricopharyngeus",
    name: "Cricopharyngeus",
    formalName: "Musculus cricopharyngeus",
    alternateNames: ["cricopharyngeal part of inferior constrictor"],
    description: "Cricopharyngeus is the cricopharyngeal part of the inferior pharyngeal constrictor and contributes to the upper esophageal sphincter region. It is represented as a deep anterior-neck study term.",
    region: "anterior-neck",
    relativeDepth: "deep",
    depthNotes: "Deep pharyngeal muscle region near the upper esophageal sphincter.",
    legacyTerms: [{ term: "cricopharyngeus" }],
  },
  {
    slug: "occipitofrontalis",
    name: "Occipitofrontalis",
    formalName: "Musculus occipitofrontalis",
    alternateNames: ["epicranius", "epicranial muscle"],
    description: "Occipitofrontalis is a scalp and forehead muscle complex with frontal and occipital bellies connected through the epicranial aponeurosis. It is the accurate group entity for the old epicranius label.",
    region: "head",
    relativeDepth: "superficial",
    depthNotes: "Superficial scalp and forehead muscle complex.",
    legacyTerms: [
      { term: "occipitofrontalis" },
      { term: "epicranius", termType: "historical", notes: "Legacy label preserved as a historical/common name for occipitofrontalis." },
    ],
  },
  {
    slug: "occipitalis",
    name: "Occipitalis",
    formalName: "Venter occipitalis musculi occipitofrontalis",
    alternateNames: ["occipital belly", "occipital belly of occipitofrontalis"],
    description: "Occipitalis is the posterior belly region of occipitofrontalis over the posterior scalp. It is kept as a sourced legacy study entity and linked to the broader occipitofrontalis complex.",
    region: "head",
    relativeDepth: "superficial",
    depthNotes: "Superficial posterior scalp muscle belly.",
    legacyTerms: [{ term: "occipitalis" }],
  },
  {
    slug: "longitudinal-tongue-muscles",
    name: "Longitudinal Tongue Muscles",
    formalName: "Musculi longitudinales linguae",
    alternateNames: ["linguae longitudinalis", "longitudinal intrinsic tongue muscles"],
    description: "The longitudinal tongue muscles are intrinsic tongue fibers running lengthwise through the tongue. The grouped legacy label maps to this group, while superior and inferior longitudinal tongue muscles remain individually searchable.",
    region: "jaw",
    relativeDepth: "deep",
    depthNotes: "Intrinsic tongue muscle group.",
    legacyTerms: [{ term: "linguae, longitudinalis" }],
  },
  {
    slug: "pectoralis-major",
    name: "Pectoralis Major",
    formalName: "Musculus pectoralis major",
    alternateNames: ["pec major", "pectoralis major muscle"],
    description: "Pectoralis major is the broad superficial anterior chest muscle represented in MassageLab by clavicular, sternocostal, and abdominal head records. This group card gives the old whole-muscle label a sourced target.",
    region: "shoulder-girdle",
    relativeDepth: "superficial",
    depthNotes: "Superficial anterior chest and shoulder-girdle muscle.",
    legacyTerms: [{ term: "pectoralis major" }],
  },
  {
    slug: "quadriceps-femoris",
    name: "Quadriceps Femoris",
    formalName: "Musculus quadriceps femoris",
    alternateNames: ["quadriceps", "quad muscles"],
    description: "Quadriceps femoris is the anterior thigh muscle group formed by rectus femoris and the vasti. It extends the knee through the quadriceps tendon, patella, and patellar tendon pathway.",
    region: "thigh",
    relativeDepth: "superficial",
    depthNotes: "Superficial anterior thigh muscle group with deep vastus intermedius contribution.",
    legacyTerms: [{ term: "quadriceps femoris" }],
  },
  {
    slug: "trapezius",
    name: "Trapezius",
    formalName: "Musculus trapezius",
    alternateNames: ["traps", "trapezius muscle"],
    description: "Trapezius is the broad superficial posterior neck, shoulder, and upper-back muscle represented by upper, middle, and lower fiber-region records. This group card preserves the old whole-muscle term.",
    region: "upper-back",
    relativeDepth: "superficial",
    depthNotes: "Superficial posterior neck, shoulder girdle, and upper-back muscle.",
    legacyTerms: [{ term: "trapezius" }],
  },
  {
    slug: "semispinalis",
    name: "Semispinalis",
    formalName: "Musculus semispinalis",
    alternateNames: ["semispinalis muscle group"],
    description: "Semispinalis is a transversospinalis muscle group represented by semispinalis capitis, cervicis, and thoracis records. It supports spinal extension, rotation control, and posterior neck education.",
    region: "back",
    relativeDepth: "deep",
    depthNotes: "Deep posterior spinal muscle group.",
    legacyTerms: [{ term: "semispinalis" }],
  },
  {
    slug: "erector-spinae",
    name: "Erector Spinae",
    formalName: "Musculus erector spinae",
    alternateNames: ["erector spinae muscle group", "spinal erectors"],
    description: "Erector spinae is the posterior spinal extensor muscle group represented in the foundation by regional erector spinae records. This group entity prevents the old broad label from matching spine landmarks instead of muscle coverage.",
    region: "back",
    relativeDepth: "intermediate",
    depthNotes: "Intermediate posterior spinal muscle group superficial to transversospinalis layers.",
    legacyTerms: [{ term: "erector spinae" }],
  },
  {
    slug: "multifidus",
    name: "Multifidus",
    formalName: "Musculus multifidus",
    alternateNames: ["multifidus muscle group"],
    description: "Multifidus is a deep segmental spinal muscle group represented by cervical, thoracic, and lumbar multifidus records. This group entity maps the old broad label to muscle coverage rather than adjacent spinous-process landmarks.",
    region: "back",
    relativeDepth: "deep",
    depthNotes: "Deep transversospinalis muscle group spanning vertebral segments.",
    legacyTerms: [{ term: "multifidus" }],
  },
  {
    slug: "splenius",
    name: "Splenius",
    formalName: "Musculus splenius",
    alternateNames: ["splenius muscle group"],
    description: "Splenius is a posterior neck muscle group represented by splenius capitis and splenius cervicis records. It assists neck extension, ipsilateral rotation, and posterior cervical orientation.",
    region: "posterior-neck",
    relativeDepth: "intermediate",
    depthNotes: "Intermediate posterior neck muscle group deep to trapezius.",
    legacyTerms: [{ term: "splenius" }],
  },
  {
    slug: "auricular-muscles",
    name: "Auricular Muscles",
    formalName: "Musculi auriculares",
    alternateNames: ["auricular", "ear muscles"],
    description: "The auricular muscles are small facial-expression muscles around the external ear. This group maps the old singular auricular label to the anterior, superior, and posterior auricularis records.",
    region: "face",
    relativeDepth: "superficial",
    depthNotes: "Superficial facial-expression muscle group around the external ear.",
    legacyTerms: [{ term: "auricular" }],
  },
  {
    slug: "innermost-intercostals",
    name: "Innermost Intercostals",
    formalName: "Musculi intercostales intimi",
    alternateNames: ["innermost intercostal"],
    description: "Innermost intercostals are the deepest intercostal muscle layer along the rib cage. They are represented separately from external and internal intercostals for accurate thorax study cards.",
    region: "thorax",
    relativeDepth: "deep",
    depthNotes: "Deepest intercostal muscle layer of the thoracic wall.",
    legacyTerms: [{ term: "innermost intercostal" }],
  },
  {
    slug: "subcostales",
    name: "Subcostales",
    formalName: "Musculi subcostales",
    alternateNames: ["subcostalis", "subcostal muscles"],
    description: "Subcostales are small muscles on the internal posterior thoracic wall spanning more than one rib. They belong with thorax and rib-cage education rather than broad abdominal wall labels.",
    region: "thorax",
    relativeDepth: "deep",
    depthNotes: "Deep posterior thoracic wall muscles.",
    legacyTerms: [{ term: "subcostalis" }],
  },
  {
    slug: "transversus-thoracis",
    name: "Transversus Thoracis",
    formalName: "Musculus transversus thoracis",
    alternateNames: ["transverse thoracic muscle"],
    description: "Transversus thoracis lies on the internal anterior thoracic wall from sternum toward costal cartilages. It is grouped with rib-cage and thoracic wall education.",
    region: "thorax",
    relativeDepth: "deep",
    depthNotes: "Deep internal anterior thoracic wall muscle.",
    legacyTerms: [{ term: "transversus thoracis" }],
  },
  {
    slug: "pyramidalis",
    name: "Pyramidalis",
    formalName: "Musculus pyramidalis",
    alternateNames: ["pyramidalis muscle"],
    description: "Pyramidalis is a small anterior abdominal wall muscle near the pubic region and linea alba. It is preserved as sourced abdomen anatomy even though it is variable and often absent.",
    region: "abdomen",
    relativeDepth: "superficial",
    depthNotes: "Small superficial lower abdominal wall muscle when present.",
    legacyTerms: [{ term: "pyramidalis" }],
  },
  {
    slug: "stapedius",
    name: "Stapedius",
    formalName: "Musculus stapedius",
    alternateNames: ["stapedius muscle"],
    description: "Stapedius is a small middle-ear muscle attached to the stapes. It dampens stapes movement and is kept as sourced head anatomy, not a treatment-oriented muscle target.",
    region: "head",
    relativeDepth: "deep",
    depthNotes: "Small middle-ear muscle.",
    legacyTerms: [{ term: "stapedius" }],
  },
  {
    slug: "tensor-tympani",
    name: "Tensor Tympani",
    formalName: "Musculus tensor tympani",
    alternateNames: ["tensor tympani muscle"],
    description: "Tensor tympani is a small middle-ear muscle associated with the auditory tube and malleus. It is preserved as sourced head anatomy for completeness of the old study set.",
    region: "head",
    relativeDepth: "deep",
    depthNotes: "Small middle-ear muscle.",
    legacyTerms: [{ term: "tensor tympani" }],
  },
  {
    slug: "trachealis",
    name: "Trachealis",
    formalName: "Musculus trachealis",
    alternateNames: ["trachealis muscle"],
    description: "Trachealis is smooth muscle spanning the posterior tracheal wall. It belongs to anterior-neck and respiratory anatomy education and is separated from skeletal neck muscle targets.",
    region: "anterior-neck",
    relativeDepth: "deep",
    depthNotes: "Smooth muscle of the posterior tracheal wall.",
    legacyTerms: [{ term: "trachealis" }],
  },
]

const NEW_STRUCTURE_SPECS: readonly NewStructureSpec[] = [
  {
    slug: "cuneiform-bones",
    name: "Cuneiform Bones",
    formalTerm: "Ossa cuneiformia",
    structureType: "bone group",
    region: "foot",
    description: "The cuneiform bones are the medial, intermediate, and lateral wedge-shaped tarsal bones of the midfoot. The old grouped label now points to this sourced group while each cuneiform bone remains individually searchable.",
    commonTerms: ["cuneiforms"],
  },
  {
    slug: "true-ribs",
    name: "True Ribs",
    formalTerm: "Costae verae",
    structureType: "rib group",
    region: "thorax",
    description: "True ribs are the first seven rib pairs, each connecting to the sternum through its own costal cartilage. The group is represented as a thoracic rib category rather than a single bone.",
    commonTerms: ["true ribs"],
  },
  {
    slug: "false-ribs",
    name: "False Ribs",
    formalTerm: "Costae spuriae",
    structureType: "rib group",
    region: "thorax",
    description: "False ribs are lower rib pairs whose anterior connection to the sternum is indirect or absent. This grouped entity keeps the old label accurate while individual ribs remain separate foundation bones.",
    commonTerms: ["false ribs"],
  },
  {
    slug: "floating-ribs",
    name: "Floating Ribs",
    formalTerm: "Costae fluctuantes",
    structureType: "rib group",
    region: "thorax",
    description: "Floating ribs are the eleventh and twelfth rib pairs, which do not attach anteriorly to the sternum. They are represented as a group over reviewed individual rib records.",
    commonTerms: ["floating ribs"],
  },
  {
    slug: "skull",
    name: "Skull",
    formalTerm: "Cranium",
    structureType: "bony complex",
    region: "head",
    description: "The skull is the bony complex of the head, including cranial and facial bones. This public study entity maps the old broad skull card to sourced craniofacial bone coverage.",
    commonTerms: ["skull"],
  },
  {
    slug: "spinous-process",
    name: "Spinous Process",
    formalTerm: "Processus spinosus",
    structureType: "bone landmark class",
    region: "back",
    description: "A spinous process is a posterior midline projection of a vertebra. The generic old label is modeled as a landmark class that points toward reviewed cervical, thoracic, and lumbar spinous process records.",
    commonTerms: ["spinous process"],
  },
  {
    slug: "vertebral-column",
    name: "Vertebral Column",
    formalTerm: "Columna vertebralis",
    structureType: "bony column",
    region: "back",
    description: "The vertebral column is the axial skeletal column formed by cervical, thoracic, lumbar, sacral, and coccygeal regions. This group card anchors the old broad spine label to sourced vertebral records.",
    commonTerms: ["vertebral column", "spine"],
  },
  {
    slug: "interfoveolar-ligament",
    name: "Interfoveolar Ligament",
    formalTerm: "Ligamentum interfoveolare",
    structureType: "ligament",
    region: "abdomen",
    description: "The interfoveolar ligament is a fibrous thickening near the deep inguinal ring. The old data listed it as a muscle; the sourced foundation preserves it as a ligament/structure instead.",
    legacyTerms: [{ term: "interfoveolar", notes: "Legacy Anatomime row was typed as muscle; reviewed carry-forward is a ligament/structure." }],
  },
]

const EXISTING_ENTITY_TERM_SPECS: readonly LegacyEntityTermSpec[] = [
  { entityType: "muscle", entitySlug: "abductor-digiti-minimi-foot", term: "abductor digiti minimi (foot)" },
  { entityType: "muscle", entitySlug: "abductor-digiti-minimi-hand", term: "abductor digiti minimi (hand)" },
  { entityType: "muscle", entitySlug: "articularis-genus", term: "articularis genu" },
  { entityType: "muscle", entitySlug: "aryepiglotticus", term: "aryepiglottic" },
  { entityType: "muscle", entitySlug: "oblique-arytenoid", term: "arytenoid, oblique" },
  { entityType: "muscle", entitySlug: "transverse-arytenoid", term: "arytenoid, transverse" },
  { entityType: "muscle", entitySlug: "bulbospongiosus", term: "bulbospongiosus, in female", notes: "Legacy sex-specific label mapped to the reviewed bulbospongiosus entity." },
  { entityType: "muscle", entitySlug: "bulbospongiosus", term: "bulbospongiosus, in male", notes: "Legacy sex-specific label mapped to the reviewed bulbospongiosus entity." },
  { entityType: "muscle", entitySlug: "inferior-pharyngeal-constrictor", term: "constrictor, inferior pharyngeal" },
  { entityType: "muscle", entitySlug: "middle-pharyngeal-constrictor", term: "constrictor, middle pharyngeal" },
  { entityType: "muscle", entitySlug: "superior-pharyngeal-constrictor", term: "constrictor, superior pharyngeal" },
  { entityType: "muscle", entitySlug: "lateral-cricoarytenoid", term: "cricoarytenoid, lateral" },
  { entityType: "muscle", entitySlug: "posterior-cricoarytenoid", term: "cricoarytenoid, posterior" },
  { entityType: "muscle", entitySlug: "depressor-septi-nasi", term: "depressor septi" },
  { entityType: "muscle", entitySlug: "dorsal-interossei-foot", term: "dorsal interosseous (foot)" },
  { entityType: "muscle", entitySlug: "dorsal-interossei-hand", term: "dorsal interosseous (hand)" },
  { entityType: "muscle", entitySlug: "external-intercostals", term: "external intercostal" },
  { entityType: "muscle", entitySlug: "flexor-digiti-minimi-brevis-foot", term: "flexor digiti minimi brevis (foot)" },
  { entityType: "muscle", entitySlug: "flexor-digiti-minimi-brevis-hand", term: "flexor digiti minimi brevis (hand)" },
  { entityType: "muscle", entitySlug: "internal-intercostals", term: "internal intercostal" },
  { entityType: "muscle", entitySlug: "dorsal-interossei-foot", term: "interosseous, dorsal (foot)" },
  { entityType: "muscle", entitySlug: "dorsal-interossei-hand", term: "interosseous, dorsal (hand)" },
  { entityType: "muscle", entitySlug: "palmar-interossei-hand", term: "interosseous, palmar" },
  { entityType: "muscle", entitySlug: "plantar-interossei-foot", term: "interosseous, plantar" },
  { entityType: "muscle", entitySlug: "levator-labii-superioris-alaeque-nasi", term: "levator labii superioris alaque nasi" },
  { entityType: "muscle", entitySlug: "levator-ani", term: "levator prostatae", notes: "Legacy sex-specific pelvic floor subdivision mapped to levator ani for public study coverage." },
  { entityType: "muscle", entitySlug: "transverse-tongue", term: "linguae, transversus" },
  { entityType: "muscle", entitySlug: "vertical-tongue", term: "linguae, verticalis" },
  { entityType: "muscle", entitySlug: "lumbricals-hand", term: "lumbrical (hand)" },
  { entityType: "muscle", entitySlug: "nasalis", term: "nasalis pars alaris" },
  { entityType: "muscle", entitySlug: "nasalis", term: "nasalis pars transversa" },
  { entityType: "muscle", entitySlug: "external-oblique", term: "oblique, external abdominal" },
  { entityType: "muscle", entitySlug: "inferior-oblique", term: "oblique, inferior" },
  { entityType: "muscle", entitySlug: "internal-oblique", term: "oblique, internal abdominal" },
  { entityType: "muscle", entitySlug: "superior-oblique", term: "oblique, superior" },
  { entityType: "muscle", entitySlug: "palmar-interossei-hand", term: "palmar interosseous" },
  { entityType: "muscle", entitySlug: "lateral-pterygoid", term: "pterygoid, lateral" },
  { entityType: "muscle", entitySlug: "medial-pterygoid", term: "pterygoid, medial" },
  { entityType: "muscle", entitySlug: "levator-ani", term: "pubovaginalis", notes: "Legacy pelvic floor subdivision mapped to levator ani rather than a separate public card." },
  { entityType: "muscle", entitySlug: "lateral-rectus", term: "rectus, lateral" },
  { entityType: "muscle", entitySlug: "medial-rectus", term: "rectus, medial" },
  { entityType: "muscle", entitySlug: "anterior-scalene", term: "scalene, anterior" },
  { entityType: "muscle", entitySlug: "middle-scalene", term: "scalene, middle" },
  { entityType: "muscle", entitySlug: "posterior-scalene", term: "scalene, posterior" },
  { entityType: "muscle", entitySlug: "lateral-pterygoid", term: "sphenomeniscus", termType: "historical", notes: "Legacy term preserved as a historical synonym commonly tied to the superior belly of lateral pterygoid; no separate muscle entity created." },
  { entityType: "muscle", entitySlug: "thyroepiglotticus", term: "thyroepiglottic" },
]

const GROUP_RELATIONSHIP_SPECS: readonly GroupRelationshipSpec[] = [
  { sourceEntityType: "anatomy_structure", sourceEntitySlug: "cuneiform-bones", relationshipType: "includes_bone", targetEntityType: "bone", targetEntitySlugs: ["medial-cuneiform", "intermediate-cuneiform", "lateral-cuneiform"] },
  { sourceEntityType: "anatomy_structure", sourceEntitySlug: "true-ribs", relationshipType: "includes_bone", targetEntityType: "bone", targetEntitySlugs: ["first-rib", "second-rib", "third-rib", "fourth-rib", "fifth-rib", "sixth-rib", "seventh-rib"] },
  { sourceEntityType: "anatomy_structure", sourceEntitySlug: "false-ribs", relationshipType: "includes_bone", targetEntityType: "bone", targetEntitySlugs: ["eighth-rib", "ninth-rib", "tenth-rib", "eleventh-rib", "twelfth-rib"] },
  { sourceEntityType: "anatomy_structure", sourceEntitySlug: "floating-ribs", relationshipType: "includes_bone", targetEntityType: "bone", targetEntitySlugs: ["eleventh-rib", "twelfth-rib"] },
  { sourceEntityType: "anatomy_structure", sourceEntitySlug: "skull", relationshipType: "includes_bone", targetEntityType: "bone", targetEntitySlugs: ["cranial-bones", "facial-bones"] },
  { sourceEntityType: "anatomy_structure", sourceEntitySlug: "vertebral-column", relationshipType: "includes_bone", targetEntityType: "bone", targetEntitySlugs: ["cervical-vertebrae", "thoracic-vertebrae", "lumbar-vertebrae", "sacrum", "coccyx"] },
  { sourceEntityType: "muscle", sourceEntitySlug: "trapezius", relationshipType: "includes_muscle", targetEntityType: "muscle", targetEntitySlugs: ["upper-trapezius", "middle-trapezius", "lower-trapezius"] },
  { sourceEntityType: "muscle", sourceEntitySlug: "pectoralis-major", relationshipType: "includes_muscle", targetEntityType: "muscle", targetEntitySlugs: ["pectoralis-major-clavicular-head", "pectoralis-major-sternocostal-head", "pectoralis-major-abdominal-head"] },
  { sourceEntityType: "muscle", sourceEntitySlug: "quadriceps-femoris", relationshipType: "includes_muscle", targetEntityType: "muscle", targetEntitySlugs: ["rectus-femoris", "vastus-medialis", "vastus-lateralis", "vastus-intermedius"] },
  { sourceEntityType: "muscle", sourceEntitySlug: "semispinalis", relationshipType: "includes_muscle", targetEntityType: "muscle", targetEntitySlugs: ["semispinalis-capitis", "semispinalis-cervicis", "semispinalis-thoracis"] },
  { sourceEntityType: "muscle", sourceEntitySlug: "erector-spinae", relationshipType: "includes_muscle", targetEntityType: "muscle", targetEntitySlugs: ["lumbar-erector-spinae", "erector-spinae-upper-thoracic"] },
  { sourceEntityType: "muscle", sourceEntitySlug: "multifidus", relationshipType: "includes_muscle", targetEntityType: "muscle", targetEntitySlugs: ["multifidus-cervicis", "multifidus-thoracis", "lumbar-multifidus"] },
  { sourceEntityType: "muscle", sourceEntitySlug: "splenius", relationshipType: "includes_muscle", targetEntityType: "muscle", targetEntitySlugs: ["splenius-capitis", "splenius-cervicis"] },
  { sourceEntityType: "muscle", sourceEntitySlug: "auricular-muscles", relationshipType: "includes_muscle", targetEntityType: "muscle", targetEntitySlugs: ["auricularis-anterior", "auricularis-superior", "auricularis-posterior"] },
  { sourceEntityType: "muscle", sourceEntitySlug: "longitudinal-tongue-muscles", relationshipType: "includes_muscle", targetEntityType: "muscle", targetEntitySlugs: ["superior-longitudinal-tongue", "inferior-longitudinal-tongue"] },
  { sourceEntityType: "muscle", sourceEntitySlug: "occipitofrontalis", relationshipType: "includes_muscle", targetEntityType: "muscle", targetEntitySlugs: ["frontalis", "occipitalis"] },
]

function termIdPrefix(entityType: AnatomyEntityType) {
  return entityType.replace(/_/g, "-")
}

function termKey(term: string) {
  return term.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

function termRow(
  entityType: AnatomyEntityType,
  entitySlug: string,
  term: string,
  termType: AnatomyTermType,
  sourceRef: string,
  notes?: string,
): EntityTermRows[number] {
  return {
    id: `term-legacy-anatomime-${termIdPrefix(entityType)}-${entitySlug}-${termKey(term)}-${termType}`,
    anatomyEntityType: entityType,
    anatomyEntitySlug: entitySlug,
    term,
    termType,
    notes,
    sourceRef,
  }
}

function explicitCitation(
  entityType: AnatomyEntityType,
  entitySlug: string,
  factType: string,
  factSlug: string | undefined,
  sourceRef: string,
  sourceLocator: string,
  citationNote: string,
): CitationRows[number] {
  return {
    id: `citation-legacy-anatomime-${termIdPrefix(entityType)}-${entitySlug}-${termKey(factType)}${factSlug ? `-${termKey(factSlug)}` : ""}`,
    slug: `citation-legacy-anatomime-${termIdPrefix(entityType)}-${entitySlug}-${termKey(factType)}${factSlug ? `-${termKey(factSlug)}` : ""}`,
    entityType,
    entitySlug,
    factType,
    factSlug,
    sourceRef,
    sourceLocator,
    citationNote,
    reviewStatus: "reviewed",
  }
}

function muscleRows(specs: readonly NewMuscleSpec[]): MuscleRows {
  return specs.map((spec) => ({
    id: `muscle-${spec.slug}`,
    slug: spec.slug,
    name: spec.name,
    formalName: spec.formalName,
    alternateNames: spec.alternateNames,
    description: spec.description,
    region: spec.region,
    relativeDepth: spec.relativeDepth,
    depthNotes: spec.depthNotes,
    sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
  }))
}

function structureRows(specs: readonly NewStructureSpec[]): StructureRows {
  return specs.map((spec) => ({
    id: `structure-${spec.slug}`,
    slug: spec.slug,
    name: spec.name,
    structureType: spec.structureType,
    region: spec.region,
    description: spec.description,
    sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
  }))
}

function newMuscleTermRows(specs: readonly NewMuscleSpec[]): EntityTermRows {
  return specs.flatMap((spec) => [
    termRow("muscle", spec.slug, spec.formalName, "preferred", FIPAT_SOURCE),
    ...(spec.commonTerms ?? []).map((term) => termRow("muscle", spec.slug, term, "common", APPLIED_HUMAN_ANATOMY_SOURCE)),
    ...spec.alternateNames.map((term) => termRow("muscle", spec.slug, term, "alternate", APPLIED_HUMAN_ANATOMY_SOURCE)),
    ...(spec.legacyTerms ?? []).map((term) => termRow("muscle", spec.slug, term.term, term.termType ?? "alternate", CLIENT_LANGUAGE_SOURCE, term.notes)),
  ])
}

function newStructureTermRows(specs: readonly NewStructureSpec[]): EntityTermRows {
  return specs.flatMap((spec) => [
    termRow("anatomy_structure", spec.slug, spec.formalTerm, "preferred", FIPAT_SOURCE),
    ...(spec.commonTerms ?? []).map((term) => termRow("anatomy_structure", spec.slug, term, "common", APPLIED_HUMAN_ANATOMY_SOURCE)),
    ...(spec.legacyTerms ?? []).map((term) => termRow("anatomy_structure", spec.slug, term.term, term.termType ?? "alternate", CLIENT_LANGUAGE_SOURCE, term.notes)),
  ])
}

function existingEntityTermRows(specs: readonly LegacyEntityTermSpec[]): EntityTermRows {
  return specs.map((spec) => termRow(
    spec.entityType,
    spec.entitySlug,
    spec.term,
    spec.termType ?? "alternate",
    spec.sourceRef ?? CLIENT_LANGUAGE_SOURCE,
    spec.notes,
  ))
}

function citationRowsForNewMuscles(specs: readonly NewMuscleSpec[]): CitationRows {
  return specs.flatMap((spec) => [
    explicitCitation(
      "muscle",
      spec.slug,
      "official_term",
      `term-legacy-anatomime-muscle-${spec.slug}-${termKey(spec.formalName)}-preferred`,
      FIPAT_SOURCE,
      `${FIPAT_LOCATOR}#${termKey(spec.formalName)}`,
      "FIPAT TA2 terminology reviewed for the legacy Anatomime coverage entity term.",
    ),
    explicitCitation(
      "muscle",
      spec.slug,
      "clinical_summary",
      "legacy-anatomime-public-study-summary",
      APPLIED_HUMAN_ANATOMY_SOURCE,
      APPLIED_HUMAN_ANATOMY_LOCATOR,
      "MassageLab-authored public study summary reviewed against open-reuse applied anatomy material.",
    ),
  ])
}

function citationRowsForNewStructures(specs: readonly NewStructureSpec[]): CitationRows {
  return specs.flatMap((spec) => [
    explicitCitation(
      "anatomy_structure",
      spec.slug,
      "official_term",
      `term-legacy-anatomime-anatomy-structure-${spec.slug}-${termKey(spec.formalTerm)}-preferred`,
      FIPAT_SOURCE,
      `${FIPAT_LOCATOR}#${termKey(spec.formalTerm)}`,
      "FIPAT TA2 terminology reviewed for the legacy Anatomime coverage structure term.",
    ),
    explicitCitation(
      "anatomy_structure",
      spec.slug,
      "clinical_summary",
      "legacy-anatomime-public-study-summary",
      APPLIED_HUMAN_ANATOMY_SOURCE,
      APPLIED_HUMAN_ANATOMY_LOCATOR,
      "MassageLab-authored public study summary reviewed against open-reuse applied anatomy material.",
    ),
  ])
}

function groupRelationshipRows(specs: readonly GroupRelationshipSpec[]): RelationshipRows {
  return specs.flatMap((spec) => spec.targetEntitySlugs.map((targetSlug) => ({
    id: `relationship-legacy-anatomime-${termIdPrefix(spec.sourceEntityType)}-${spec.sourceEntitySlug}-${spec.relationshipType}-${termIdPrefix(spec.targetEntityType)}-${targetSlug}`,
    sourceEntityType: spec.sourceEntityType,
    sourceEntitySlug: spec.sourceEntitySlug,
    relationshipType: spec.relationshipType,
    targetEntityType: spec.targetEntityType,
    targetEntitySlug: targetSlug,
    details: { coverageReason: "legacy-anatomime-group-label" },
    sourceRef: APPLIED_HUMAN_ANATOMY_SOURCE,
  })))
}

function uniqueTermRows(rows: EntityTermRows): EntityTermRows {
  const seen = new Set<string>()

  return rows.filter((row) => {
    const key = [
      row.anatomyEntityType,
      row.anatomyEntitySlug,
      termKey(row.term),
      row.termType,
    ].join("|").toLowerCase()

    if (seen.has(key)) return false
    seen.add(key)

    return true
  })
}

export const LEGACY_ANATOMIME_COVERAGE_SECTION: AnatomySeedSection = {
  muscles: muscleRows(NEW_MUSCLE_SPECS),
  structures: structureRows(NEW_STRUCTURE_SPECS),
  entityTerms: uniqueTermRows([
    ...newMuscleTermRows(NEW_MUSCLE_SPECS),
    ...newStructureTermRows(NEW_STRUCTURE_SPECS),
    ...existingEntityTermRows(EXISTING_ENTITY_TERM_SPECS),
  ]),
  relationships: groupRelationshipRows(GROUP_RELATIONSHIP_SPECS),
  citations: [
    ...citationRowsForNewMuscles(NEW_MUSCLE_SPECS),
    ...citationRowsForNewStructures(NEW_STRUCTURE_SPECS),
  ],
}
