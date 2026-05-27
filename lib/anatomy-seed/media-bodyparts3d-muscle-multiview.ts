import type { AnatomyEntityType, AnatomyMediaAsset, AnatomyMediaRole } from "../anatomy-foundation.ts"
import type { AnatomySeedSection } from "./sections.ts"
import { MEDIA_BODYPARTS3D_MUSCLE_BATCH_2_SECTION } from "./media-bodyparts3d-muscle-batch-2.ts"
import { MEDIA_COVERAGE_GAP_BATCH_SECTION } from "./media-coverage-gap-batch.ts"

const BODYPARTS3D_SOURCE = "bodyparts3d"
const BODYPARTS3D_ATTRIBUTION = "BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International."
const BODYPARTS3D_LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/"
const BODYPARTS3D_LICENSE_PAGE = "https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html"
const BODYPARTS3D_API_DOCS = "https://lifesciencedb.jp/bp3d/info_en/webapi/index.html"
const BODYPARTS3D_PART_LIST = "https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/isa_parts_list_e.txt"
const BODYPARTS3D_SKELETON_BACKGROUND_ID = "FMA5018"
const MEDIA_TYPE_IMAGE = "image" as const
const OPEN_REUSE = "open_reuse" as const
const REVIEWED = "reviewed" as const

type CameraMode = "front" | "back" | "left" | "right"

type MultiView = {
  slug: "anterior" | "posterior" | "left-lateral" | "right-lateral"
  title: string
  cameraMode: CameraMode
  description: string
}

type MediaEntityLinkSeed = {
  entityType: AnatomyEntityType
  entitySlug: string
  role: AnatomyMediaRole
  notes?: string
}

type BodyParts3dMuscleMapping = {
  slug: string
  title: string
  partIds: readonly string[]
  partNames: readonly string[]
  mappingNote: string
}

const MULTI_VIEWS: readonly MultiView[] = [
  { slug: "anterior", title: "Anterior View", cameraMode: "front", description: "from the anterior camera view" },
  { slug: "posterior", title: "Posterior View", cameraMode: "back", description: "from the posterior camera view" },
  { slug: "left-lateral", title: "Left Lateral View", cameraMode: "left", description: "from the left lateral camera view" },
  { slug: "right-lateral", title: "Right Lateral View", cameraMode: "right", description: "from the right lateral camera view" },
] as const

const additionalExactPartListMappings: readonly BodyParts3dMuscleMapping[] = [
  { slug: "scalenes", title: "Scalenes", partIds: ["FMA64829"], partNames: ["scalene muscle"], mappingNote: "Aggregate scalenes row mapped to BodyParts3D scalene muscle." },
  { slug: "suboccipital-muscles", title: "Suboccipital Muscles", partIds: ["FMA32582"], partNames: ["posterior suboccipital muscle"], mappingNote: "Aggregate suboccipital row mapped to BodyParts3D posterior suboccipital muscle." },
  { slug: "superior-rectus", title: "Superior Rectus", partIds: ["FMA49035"], partNames: ["superior rectus"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "inferior-rectus", title: "Inferior Rectus", partIds: ["FMA49036"], partNames: ["inferior rectus"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "medial-rectus", title: "Medial Rectus", partIds: ["FMA49037"], partNames: ["medial rectus"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "lateral-rectus", title: "Lateral Rectus", partIds: ["FMA49038"], partNames: ["lateral rectus"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "superior-oblique", title: "Superior Oblique", partIds: ["FMA49039"], partNames: ["superior oblique"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "inferior-oblique", title: "Inferior Oblique", partIds: ["FMA49040"], partNames: ["inferior oblique"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "levator-ani-pubococcygeus", title: "Levator Ani, Pubococcygeus", partIds: ["FMA19090"], partNames: ["pubococcygeus"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "levator-ani-puborectalis", title: "Levator Ani, Puborectalis", partIds: ["FMA19091"], partNames: ["puborectalis"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "levator-ani-iliococcygeus", title: "Levator Ani, Iliococcygeus", partIds: ["FMA19092"], partNames: ["iliococcygeus"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "lumbrical-foot-1", title: "First Foot Lumbrical", partIds: ["FMA37479"], partNames: ["first lumbrical of foot"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "lumbrical-foot-2", title: "Second Foot Lumbrical", partIds: ["FMA37480"], partNames: ["second lumbrical of foot"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "lumbrical-foot-3", title: "Third Foot Lumbrical", partIds: ["FMA37481"], partNames: ["third lumbrical of foot"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "lumbrical-foot-4", title: "Fourth Foot Lumbrical", partIds: ["FMA37482"], partNames: ["fourth lumbrical of foot"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "aryepiglotticus", title: "Aryepiglotticus", partIds: ["FMA46602"], partNames: ["aryepiglotticus"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "extensor-carpi-radialis-longus", title: "Extensor Carpi Radialis Longus", partIds: ["FMA38494"], partNames: ["extensor carpi radialis longus"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "extensor-carpi-radialis-brevis", title: "Extensor Carpi Radialis Brevis", partIds: ["FMA38497"], partNames: ["extensor carpi radialis brevis"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "extensor-indicis", title: "Extensor Indicis", partIds: ["FMA38524"], partNames: ["extensor indicis"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "extensor-digiti-minimi", title: "Extensor Digiti Minimi", partIds: ["FMA38503"], partNames: ["extensor digiti minimi"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "adductor-minimus", title: "Adductor Minimus", partIds: ["FMA43885"], partNames: ["adductor minimus"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "adductor-hallucis", title: "Adductor Hallucis", partIds: ["FMA46014", "FMA46015"], partNames: ["oblique head of adductor hallucis", "transverse head of adductor hallucis"], mappingNote: "Aggregate adductor hallucis row mapped to its named BodyParts3D heads." },
  { slug: "adductor-hallucis-oblique-head", title: "Adductor Hallucis, Oblique Head", partIds: ["FMA46014"], partNames: ["oblique head of adductor hallucis"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "adductor-hallucis-transverse-head", title: "Adductor Hallucis, Transverse Head", partIds: ["FMA46015"], partNames: ["transverse head of adductor hallucis"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "longus-capitis", title: "Longus Capitis", partIds: ["FMA46308"], partNames: ["longus capitis"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "longus-colli", title: "Longus Colli", partIds: ["FMA46280", "FMA46281", "FMA46282"], partNames: ["superior oblique part of longus colli", "inferior oblique part of longus colli", "vertical intermediate part of longus colli"], mappingNote: "Aggregate longus colli row mapped to its named BodyParts3D parts." },
  { slug: "iliocostalis", title: "Iliocostalis", partIds: ["FMA77177"], partNames: ["iliocostalis"], mappingNote: "Aggregate iliocostalis row mapped to BodyParts3D iliocostalis." },
  { slug: "longissimus", title: "Longissimus", partIds: ["FMA77178"], partNames: ["longissimus"], mappingNote: "Aggregate longissimus row mapped to BodyParts3D longissimus." },
  { slug: "spinalis", title: "Spinalis", partIds: ["FMA77179"], partNames: ["spinalis"], mappingNote: "Aggregate spinalis row mapped to BodyParts3D spinalis." },
  { slug: "rotatores", title: "Rotatores", partIds: ["FMA23081"], partNames: ["rotator muscle"], mappingNote: "Aggregate rotatores row mapped to BodyParts3D rotator muscle." },
  { slug: "interspinales", title: "Interspinales", partIds: ["FMA71307", "FMA71309"], partNames: ["set of interspinales lumborum", "set of interspinales cervicis"], mappingNote: "Aggregate interspinales row mapped to BodyParts3D cervical and lumbar interspinales sets." },
  { slug: "intertransversarii", title: "Intertransversarii", partIds: ["FMA71442", "FMA71443"], partNames: ["set of anterior cervical intertransversarii", "set of posterior cervical intertransversarii"], mappingNote: "Aggregate intertransversarii row mapped to BodyParts3D cervical intertransversarii sets." },
  { slug: "levatores-costarum", title: "Levatores Costarum", partIds: ["FMA71313", "FMA71314"], partNames: ["set of levatores costarum longi", "set of levatores costarum breves"], mappingNote: "Aggregate levatores costarum row mapped to BodyParts3D longi and breves sets." },
  { slug: "external-intercostals", title: "External Intercostals", partIds: ["FMA9756"], partNames: ["external intercostal muscle"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "internal-intercostals", title: "Internal Intercostals", partIds: ["FMA9757"], partNames: ["internal intercostal muscle"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "extensor-carpi-radialis", title: "Extensor Carpi Radialis", partIds: ["FMA38494", "FMA38497"], partNames: ["extensor carpi radialis longus", "extensor carpi radialis brevis"], mappingNote: "Aggregate extensor carpi radialis row mapped to its longus and brevis BodyParts3D parts." },
  { slug: "abductor-pollicis-brevis", title: "Abductor Pollicis Brevis", partIds: ["FMA37373"], partNames: ["abductor pollicis brevis"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "flexor-pollicis-brevis", title: "Flexor Pollicis Brevis", partIds: ["FMA37378"], partNames: ["flexor pollicis brevis"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "opponens-pollicis", title: "Opponens Pollicis", partIds: ["FMA37379"], partNames: ["opponens pollicis"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "abductor-digiti-minimi-hand", title: "Abductor Digiti Minimi of Hand", partIds: ["FMA37382"], partNames: ["abductor digiti minimi of hand"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "flexor-digiti-minimi-brevis-hand", title: "Flexor Digiti Minimi Brevis of Hand", partIds: ["FMA37383"], partNames: ["flexor digiti minimi brevis of hand"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "opponens-digiti-minimi", title: "Opponens Digiti Minimi", partIds: ["FMA37384"], partNames: ["opponens digiti minimi of hand"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "adductor-pollicis", title: "Adductor Pollicis", partIds: ["FMA46119", "FMA46120"], partNames: ["oblique head of adductor pollicis", "transverse head of adductor pollicis"], mappingNote: "Aggregate adductor pollicis row mapped to its named BodyParts3D heads." },
  { slug: "adductor-longus", title: "Adductor Longus", partIds: ["FMA22441"], partNames: ["adductor longus"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "adductor-brevis", title: "Adductor Brevis", partIds: ["FMA22442"], partNames: ["adductor brevis"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "adductor-magnus", title: "Adductor Magnus", partIds: ["FMA22443"], partNames: ["adductor magnus"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "gracilis", title: "Gracilis", partIds: ["FMA43882"], partNames: ["gracilis"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "sartorius", title: "Sartorius", partIds: ["FMA22353"], partNames: ["sartorius"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "pectineus", title: "Pectineus", partIds: ["FMA22440"], partNames: ["pectineus"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "tensor-fasciae-latae", title: "Tensor Fasciae Latae", partIds: ["FMA22423"], partNames: ["tensor fasciae latae"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "tibialis-posterior", title: "Tibialis Posterior", partIds: ["FMA51099"], partNames: ["tibialis posterior"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "fibularis-brevis", title: "Fibularis Brevis", partIds: ["FMA22540"], partNames: ["fibularis brevis"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "extensor-digitorum-longus", title: "Extensor Digitorum Longus", partIds: ["FMA22534"], partNames: ["extensor digitorum longus"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "flexor-digitorum-longus", title: "Flexor Digitorum Longus", partIds: ["FMA51071"], partNames: ["flexor digitorum longus"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "piriformis", title: "Piriformis", partIds: ["FMA19082"], partNames: ["piriformis"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "obturator-internus", title: "Obturator Internus", partIds: ["FMA22298"], partNames: ["obturator internus"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "superior-gemellus", title: "Superior Gemellus", partIds: ["FMA22318"], partNames: ["gemellus superior"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "inferior-gemellus", title: "Inferior Gemellus", partIds: ["FMA22320"], partNames: ["gemellus inferior"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "quadratus-femoris", title: "Quadratus Femoris", partIds: ["FMA22321"], partNames: ["quadratus femoris"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "flexor-hallucis-longus", title: "Flexor Hallucis Longus", partIds: ["FMA22593"], partNames: ["flexor hallucis longus"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "extensor-hallucis-longus", title: "Extensor Hallucis Longus", partIds: ["FMA22533"], partNames: ["extensor hallucis longus"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "fibularis-tertius", title: "Fibularis Tertius", partIds: ["FMA22538"], partNames: ["fibularis tertius"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "abductor-hallucis", title: "Abductor Hallucis", partIds: ["FMA37448"], partNames: ["abductor hallucis"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "flexor-digitorum-brevis-foot", title: "Flexor Digitorum Brevis", partIds: ["FMA37450"], partNames: ["flexor digitorum brevis"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "quadratus-plantae", title: "Quadratus Plantae", partIds: ["FMA37452"], partNames: ["flexor accessorius"], mappingNote: "Exact BodyParts3D part-list match for quadratus plantae alternate term flexor accessorius." },
  { slug: "abductor-digiti-minimi-foot", title: "Abductor Digiti Minimi of Foot", partIds: ["FMA37451"], partNames: ["abductor digiti minimi of foot"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "flexor-digiti-minimi-brevis-foot", title: "Flexor Digiti Minimi Brevis of Foot", partIds: ["FMA37455"], partNames: ["flexor digiti minimi brevis of foot"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "flexor-hallucis-brevis-foot", title: "Flexor Hallucis Brevis", partIds: ["FMA45969", "FMA45970"], partNames: ["medial head of flexor hallucis brevis", "lateral head of flexor hallucis brevis"], mappingNote: "Aggregate flexor hallucis brevis row mapped to its named BodyParts3D heads." },
  { slug: "plantar-interossei-foot", title: "Plantar Interossei of Foot", partIds: ["FMA37458"], partNames: ["plantar interosseous of foot"], mappingNote: "Aggregate plantar interossei row mapped to BodyParts3D plantar interosseous of foot." },
  { slug: "plantar-interosseous-foot-1", title: "First Plantar Interosseous", partIds: ["FMA37738"], partNames: ["first plantar interosseous of foot"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "plantar-interosseous-foot-2", title: "Second Plantar Interosseous", partIds: ["FMA37739"], partNames: ["second plantar interosseous of foot"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "plantar-interosseous-foot-3", title: "Third Plantar Interosseous", partIds: ["FMA37740"], partNames: ["third plantar interosseous of foot"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "obturator-externus", title: "Obturator Externus", partIds: ["FMA22299"], partNames: ["obturator externus"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "plantaris", title: "Plantaris", partIds: ["FMA22543"], partNames: ["plantaris"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "popliteus", title: "Popliteus", partIds: ["FMA22590"], partNames: ["popliteus"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "extensor-hallucis-brevis", title: "Extensor Hallucis Brevis", partIds: ["FMA51141"], partNames: ["extensor hallucis brevis"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "pronator-teres", title: "Pronator Teres", partIds: ["FMA38558", "FMA38559"], partNames: ["humeral head of pronator teres", "ulnar head of pronator teres"], mappingNote: "Aggregate pronator teres row mapped to its named BodyParts3D heads." },
  { slug: "flexor-carpi-ulnaris", title: "Flexor Carpi Ulnaris", partIds: ["FMA38615", "FMA38616"], partNames: ["humeral head of flexor carpi ulnaris", "ulnar head of flexor carpi ulnaris"], mappingNote: "Aggregate flexor carpi ulnaris row mapped to its named BodyParts3D heads." },
  { slug: "dorsal-interossei-hand", title: "Dorsal Interossei of Hand", partIds: ["FMA71319"], partNames: ["set of dorsal interossei of hand"], mappingNote: "Aggregate dorsal interossei hand row mapped to BodyParts3D set of dorsal interossei of hand." },
  { slug: "palmar-interossei-hand", title: "Palmar Interossei of Hand", partIds: ["FMA71320"], partNames: ["set of palmar interossei of hand"], mappingNote: "Aggregate palmar interossei hand row mapped to BodyParts3D set of palmar interossei of hand." },
  { slug: "lumbricals-hand", title: "Lumbricals of Hand", partIds: ["FMA71318"], partNames: ["set of lumbricals of hand"], mappingNote: "Aggregate lumbricals hand row mapped to BodyParts3D set of lumbricals of hand." },
  { slug: "levator-ani", title: "Levator Ani", partIds: ["FMA19090", "FMA19091", "FMA19092"], partNames: ["pubococcygeus", "puborectalis", "iliococcygeus"], mappingNote: "Aggregate levator ani row mapped to its named BodyParts3D component muscles." },
  { slug: "platysma", title: "Platysma", partIds: ["FMA45738"], partNames: ["platysma"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "cricothyroid", title: "Cricothyroid", partIds: ["FMA46609", "FMA46610"], partNames: ["straight part of cricothyroid", "oblique part of cricothyroid"], mappingNote: "Aggregate cricothyroid row mapped to its named BodyParts3D parts." },
  { slug: "uvula-muscle", title: "Uvula Muscle", partIds: ["FMA46733"], partNames: ["uvular muscle"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "digastric", title: "Digastric", partIds: ["FMA46291"], partNames: ["digastric"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "mylohyoid", title: "Mylohyoid", partIds: ["FMA46320"], partNames: ["mylohyoid"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "sternohyoid", title: "Sternohyoid", partIds: ["FMA13341"], partNames: ["sternohyoid"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "omohyoid", title: "Omohyoid", partIds: ["FMA13342"], partNames: ["omohyoid"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "genioglossus", title: "Genioglossus", partIds: ["FMA46690"], partNames: ["genioglossus"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "hyoglossus", title: "Hyoglossus", partIds: ["FMA46691"], partNames: ["hyoglossus"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "geniohyoid", title: "Geniohyoid", partIds: ["FMA46325"], partNames: ["geniohyoid"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "stylohyoid", title: "Stylohyoid", partIds: ["FMA9625"], partNames: ["stylohyoid"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "sternothyroid", title: "Sternothyroid", partIds: ["FMA13343"], partNames: ["sternothyroid"], mappingNote: "Exact BodyParts3D part-list match." },
  { slug: "thyrohyoid", title: "Thyrohyoid", partIds: ["FMA13344"], partNames: ["thyrohyoid"], mappingNote: "Exact BodyParts3D part-list match." },
] as const

function titleFromBodyParts3dAsset(asset: AnatomyMediaAsset) {
  return asset.title
    .replace(/^BodyParts3D\s+/, "")
    .replace(/\s+Anatomogram$/, "")
}

function mappingsFromSection(section: AnatomySeedSection): BodyParts3dMuscleMapping[] {
  const mediaBySlug = new Map((section.mediaAssets ?? []).map((asset) => [asset.slug, asset]))

  return (section.mediaEntityLinks ?? []).flatMap((link) => {
    if (link.entityType !== "muscle" || link.role !== "primary") return []
    const asset = mediaBySlug.get(link.assetSlug)
    const partIds = asset?.metadata?.bodyparts3dPartIds
    const partNames = asset?.metadata?.bodyparts3dPartNames
    if (asset?.sourceRef !== BODYPARTS3D_SOURCE || !Array.isArray(partIds) || !Array.isArray(partNames)) return []

    return [{
      slug: link.entitySlug,
      title: titleFromBodyParts3dAsset(asset),
      partIds: partIds.map(String),
      partNames: partNames.map(String),
      mappingNote: link.notes ?? "Existing reviewed BodyParts3D muscle mapping.",
    }]
  })
}

function uniqueMappings(mappings: readonly BodyParts3dMuscleMapping[]) {
  const bySlug = new Map<string, BodyParts3dMuscleMapping>()
  for (const mapping of mappings) {
    if (!bySlug.has(mapping.slug)) bySlug.set(mapping.slug, mapping)
  }
  return [...bySlug.values()].sort((a, b) => a.slug.localeCompare(b.slug))
}

export const MEDIA_BODYPARTS3D_MUSCLE_MULTIVIEW_MAPPINGS = uniqueMappings([
  ...mappingsFromSection(MEDIA_COVERAGE_GAP_BATCH_SECTION),
  ...mappingsFromSection(MEDIA_BODYPARTS3D_MUSCLE_BATCH_2_SECTION),
  ...additionalExactPartListMappings,
])

function bodyParts3dImageUrl(partIds: readonly string[], view: MultiView): string {
  const config = {
    Common: {
      Version: "4.1",
      TreeName: "isa",
    },
    Window: {
      ImageWidth: 700,
      ImageHeight: 700,
    },
    Camera: {
      CameraMode: view.cameraMode,
    },
    Part: [
      {
        PartID: BODYPARTS3D_SKELETON_BACKGROUND_ID,
        PartOpacity: 0.15,
        UseForBoundingBoxFlag: false,
      },
      ...partIds.map((partId) => ({
        PartID: partId,
        PartColor: "D83A3A",
        PartOpacity: 1,
      })),
    ],
  }

  return `http://lifesciencedb.jp/bp3d/API/image?${encodeURIComponent(JSON.stringify(config))}`
}

function assetSlug(mapping: BodyParts3dMuscleMapping, view: MultiView) {
  return `bodyparts3d-${mapping.slug}-${view.slug}-anatomogram`
}

function entityLinkForMapping(mapping: BodyParts3dMuscleMapping, view: MultiView): MediaEntityLinkSeed {
  return {
    entityType: "muscle",
    entitySlug: mapping.slug,
    role: "primary",
    notes: `Primary BodyParts3D ${view.title.toLowerCase()} anatomogram render for ${mapping.title}. ${mapping.mappingNote}`,
  }
}

const multiviewAssets = MEDIA_BODYPARTS3D_MUSCLE_MULTIVIEW_MAPPINGS.flatMap((mapping) => (
  MULTI_VIEWS.map((view) => ({
    mapping,
    view,
    slug: assetSlug(mapping, view),
  }))
))

export const MEDIA_BODYPARTS3D_MUSCLE_MULTIVIEW_SECTION = {
  mediaAssets: multiviewAssets.map(({ mapping, view, slug }) => ({
    id: `media-${slug}`,
    slug,
    title: `BodyParts3D ${mapping.title} ${view.title} Anatomogram`,
    mediaType: MEDIA_TYPE_IMAGE,
    description: `Reviewed BodyParts3D 3D anatomogram render showing ${mapping.title.toLowerCase()} ${view.description} with low-opacity skeleton context.`,
    sourceRef: BODYPARTS3D_SOURCE,
    sourceUrl: bodyParts3dImageUrl(mapping.partIds, view),
    storagePath: `anatomy/bodyparts3d/anatomograms/muscles/${mapping.slug}/${view.slug}.png`,
    license: "CC BY 4.0",
    licenseUrl: BODYPARTS3D_LICENSE_URL,
    attribution: BODYPARTS3D_ATTRIBUTION,
    author: "Database Center for Life Science",
    usageScope: OPEN_REUSE,
    reviewStatus: REVIEWED,
    format: "png",
    metadata: {
      r2Upload: true,
      sourceKind: "bodyparts3d-anatomography-api-image",
      sourcePage: BODYPARTS3D_API_DOCS,
      partList: BODYPARTS3D_PART_LIST,
      bodyparts3dPartIds: mapping.partIds,
      bodyparts3dPartNames: mapping.partNames,
      bodyparts3dCameraMode: view.cameraMode,
      bodyparts3dView: view.slug,
      bodyparts3dViewTitle: view.title,
      backgroundPartId: BODYPARTS3D_SKELETON_BACKGROUND_ID,
      backgroundPartOpacity: 0.15,
      visualStyle: "3d-anatomogram-render",
      anatomogramVersion: "4.1",
      licenseVerifiedAt: "2026-05-26",
      licensePage: BODYPARTS3D_LICENSE_PAGE,
      ingestionStatus: "pending_r2_upload",
    },
  })),
  mediaEntityLinks: multiviewAssets.map(({ mapping, view, slug }) => {
    const link = entityLinkForMapping(mapping, view)
    return {
      id: `media-link-${slug}-${link.entityType}-${link.entitySlug}-${link.role}`,
      assetSlug: slug,
      entityType: link.entityType,
      entitySlug: link.entitySlug,
      role: link.role,
      notes: link.notes,
    }
  }),
  citations: multiviewAssets.flatMap(({ mapping, view, slug }) => [
    {
      id: `citation-${slug}-media-source`,
      slug: `citation-${slug}-media-source`,
      entityType: "muscle" as const,
      entitySlug: mapping.slug,
      factType: "media_source",
      factSlug: slug,
      sourceRef: BODYPARTS3D_SOURCE,
      sourceLocator: bodyParts3dImageUrl(mapping.partIds, view),
      citationNote: `BodyParts3D/Anatomography API ${view.title.toLowerCase()} image generated from reviewed FMA part IDs for ${mapping.title}; selected for R2 ingestion with stored license, attribution, source URL, camera mode, and upload path.`,
      reviewStatus: REVIEWED,
    },
    {
      id: `citation-${slug}-media-license`,
      slug: `citation-${slug}-media-license`,
      entityType: "muscle" as const,
      entitySlug: mapping.slug,
      factType: "media_license",
      factSlug: slug,
      sourceRef: BODYPARTS3D_SOURCE,
      sourceLocator: BODYPARTS3D_LICENSE_PAGE,
      citationNote: "BodyParts3D official license page lists Creative Commons Attribution 4.0 International and required attribution wording.",
      reviewStatus: REVIEWED,
    },
  ]),
} satisfies AnatomySeedSection

export const MEDIA_BODYPARTS3D_MUSCLE_MULTIVIEW_ENTITY_SLUGS = MEDIA_BODYPARTS3D_MUSCLE_MULTIVIEW_MAPPINGS.map((mapping) => mapping.slug)
export const MEDIA_BODYPARTS3D_MUSCLE_MULTIVIEW_SLUGS = multiviewAssets.map((asset) => asset.slug)
export const MEDIA_BODYPARTS3D_MUSCLE_MULTIVIEW_COUNT = multiviewAssets.length
export const MEDIA_BODYPARTS3D_MUSCLE_MULTIVIEW_VIEWS = MULTI_VIEWS.map((view) => view.slug)
