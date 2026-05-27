import type { AnatomyEntityType, AnatomyMediaRole } from "../anatomy-foundation.ts"
import type { AnatomySeedSection } from "./sections.ts"

const BODYPARTS3D_SOURCE = "bodyparts3d"
const BODYPARTS3D_ATTRIBUTION = "BodyParts3D, Database Center for Life Science licensed under CC BY 4.0."
const BODYPARTS3D_LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/"
const BODYPARTS3D_LICENSE_PAGE = "https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html"
const BODYPARTS3D_API_DOCS = "https://lifesciencedb.jp/bp3d/info_en/webapi/index.html"
const BODYPARTS3D_PART_LIST = "https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/isa_parts_list_e.txt"
const BODYPARTS3D_SKELETON_BACKGROUND_ID = "FMA5018"
const MEDIA_TYPE_IMAGE = "image" as const
const OPEN_REUSE = "open_reuse" as const
const REVIEWED = "reviewed" as const

type MediaEntityLinkSeed = {
  entityType: AnatomyEntityType
  entitySlug: string
  role: AnatomyMediaRole
  notes?: string
}

type BodyParts3dMuscleMediaSeed = {
  slug: string
  title: string
  partIds: readonly string[]
  partNames: readonly string[]
  regionNote: string
  entityLinks?: readonly MediaEntityLinkSeed[]
}

function bodyParts3dImageUrl(partIds: readonly string[]): string {
  const config = {
    Common: {
      Version: "4.1",
      TreeName: "isa",
    },
    Window: {
      ImageWidth: 700,
      ImageHeight: 700,
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

const muscleImages: readonly BodyParts3dMuscleMediaSeed[] = [
  { slug: "semispinalis-capitis", title: "Semispinalis Capitis", partIds: ["FMA22830"], partNames: ["semispinalis capitis"], regionNote: "posterior cervical and upper thoracic extensor context" },
  { slug: "subclavius", title: "Subclavius", partIds: ["FMA13410"], partNames: ["subclavius"], regionNote: "clavicular stabilizer and anterior shoulder-girdle context" },
  { slug: "levator-palpebrae-superioris", title: "Levator Palpebrae Superioris", partIds: ["FMA49041"], partNames: ["levator palpebrae superioris"], regionNote: "orbital and eyelid movement context" },
  { slug: "transverse-arytenoid", title: "Transverse Arytenoid", partIds: ["FMA46582"], partNames: ["transverse arytenoid"], regionNote: "intrinsic laryngeal muscle context" },
  { slug: "oblique-arytenoid", title: "Oblique Arytenoid", partIds: ["FMA46583"], partNames: ["oblique arytenoid"], regionNote: "intrinsic laryngeal muscle context" },
  { slug: "vocalis", title: "Vocalis", partIds: ["FMA46591"], partNames: ["vocalis"], regionNote: "intrinsic laryngeal and vocal fold context" },
  { slug: "stylopharyngeus", title: "Stylopharyngeus", partIds: ["FMA46664"], partNames: ["stylopharyngeus"], regionNote: "pharyngeal elevation and swallowing context" },
  { slug: "salpingopharyngeus", title: "Salpingopharyngeus", partIds: ["FMA46665"], partNames: ["salpingopharyngeus"], regionNote: "pharyngeal and soft-palate functional context" },
  { slug: "palatopharyngeus", title: "Palatopharyngeus", partIds: ["FMA46666"], partNames: ["palatopharyngeus"], regionNote: "pharyngeal and soft-palate functional context" },
  { slug: "superior-pharyngeal-constrictor", title: "Superior Pharyngeal Constrictor", partIds: ["FMA46621"], partNames: ["superior pharyngeal constrictor"], regionNote: "pharyngeal wall context" },
  { slug: "middle-pharyngeal-constrictor", title: "Middle Pharyngeal Constrictor", partIds: ["FMA46622"], partNames: ["middle pharyngeal constrictor"], regionNote: "pharyngeal wall context" },
  { slug: "inferior-pharyngeal-constrictor", title: "Inferior Pharyngeal Constrictor", partIds: ["FMA46623"], partNames: ["inferior pharyngeal constrictor"], regionNote: "pharyngeal wall context" },
  { slug: "tensor-veli-palatini", title: "Tensor Veli Palatini", partIds: ["FMA46730"], partNames: ["tensor veli palatini"], regionNote: "soft palate functional context" },
  { slug: "levator-veli-palatini", title: "Levator Veli Palatini", partIds: ["FMA46727"], partNames: ["levator veli palatini"], regionNote: "soft palate functional context" },
  { slug: "iliocostalis-cervicis", title: "Iliocostalis Cervicis", partIds: ["FMA22704"], partNames: ["iliocostalis cervicis"], regionNote: "erector spinae cervical column context" },
  { slug: "iliocostalis-thoracis", title: "Iliocostalis Thoracis", partIds: ["FMA22703"], partNames: ["iliocostalis thoracis"], regionNote: "erector spinae thoracic column context" },
  { slug: "iliocostalis-lumborum", title: "Iliocostalis Lumborum", partIds: ["FMA22702"], partNames: ["iliocostalis lumborum"], regionNote: "erector spinae lumbar column context" },
  { slug: "longissimus-capitis", title: "Longissimus Capitis", partIds: ["FMA22714"], partNames: ["longissimus capitis"], regionNote: "posterior neck and head extension context" },
  { slug: "longissimus-cervicis", title: "Longissimus Cervicis", partIds: ["FMA22711"], partNames: ["longissimus cervicis"], regionNote: "posterior cervical extensor context" },
  { slug: "longissimus-thoracis", title: "Longissimus Thoracis", partIds: ["FMA22709"], partNames: ["longissimus thoracis"], regionNote: "thoracic and lumbar erector spinae context" },
  { slug: "spinalis-thoracis", title: "Spinalis Thoracis", partIds: ["FMA22765"], partNames: ["spinalis thoracis"], regionNote: "thoracic erector spinae context" },
  { slug: "rectus-capitis-anterior", title: "Rectus Capitis Anterior", partIds: ["FMA46312"], partNames: ["rectus capitis anterior"], regionNote: "deep anterior upper cervical context" },
  { slug: "rectus-capitis-lateralis", title: "Rectus Capitis Lateralis", partIds: ["FMA46316"], partNames: ["rectus capitis lateralis"], regionNote: "deep lateral upper cervical context" },
  { slug: "semispinalis-cervicis", title: "Semispinalis Cervicis", partIds: ["FMA22829"], partNames: ["semispinalis cervicis"], regionNote: "posterior cervical extensor context" },
  { slug: "semispinalis-thoracis", title: "Semispinalis Thoracis", partIds: ["FMA22828"], partNames: ["semispinalis thoracis"], regionNote: "thoracic transversospinalis context" },
  { slug: "anterior-scalene", title: "Anterior Scalene", partIds: ["FMA13385"], partNames: ["scalenus anterior"], regionNote: "lateral neck and first-rib breathing mechanics context" },
  { slug: "middle-scalene", title: "Middle Scalene", partIds: ["FMA13386"], partNames: ["scalenus medius"], regionNote: "lateral neck and first-rib breathing mechanics context" },
  { slug: "posterior-scalene", title: "Posterior Scalene", partIds: ["FMA13387"], partNames: ["scalenus posterior"], regionNote: "lateral neck and second-rib breathing mechanics context" },
  { slug: "rectus-capitis-posterior-major", title: "Rectus Capitis Posterior Major", partIds: ["FMA32525"], partNames: ["rectus capitis posterior major"], regionNote: "suboccipital fine-control context" },
  { slug: "rectus-capitis-posterior-minor", title: "Rectus Capitis Posterior Minor", partIds: ["FMA32526"], partNames: ["rectus capitis posterior minor"], regionNote: "suboccipital fine-control context" },
  { slug: "obliquus-capitis-superior", title: "Obliquus Capitis Superior", partIds: ["FMA32527"], partNames: ["obliquus capitis superior"], regionNote: "suboccipital fine-control context" },
  { slug: "obliquus-capitis-inferior", title: "Obliquus Capitis Inferior", partIds: ["FMA32528"], partNames: ["obliquus capitis inferior"], regionNote: "suboccipital fine-control context" },
  { slug: "diaphragm", title: "Diaphragm", partIds: ["FMA13295"], partNames: ["diaphragm"], regionNote: "thoracic breathing mechanics context" },
  { slug: "coccygeus", title: "Coccygeus", partIds: ["FMA19088"], partNames: ["coccygeus"], regionNote: "pelvic floor support context" },
  { slug: "serratus-posterior-superior", title: "Serratus Posterior Superior", partIds: ["FMA13401"], partNames: ["serratus posterior superior"], regionNote: "upper thoracic rib movement context" },
  { slug: "serratus-posterior-inferior", title: "Serratus Posterior Inferior", partIds: ["FMA13402"], partNames: ["serratus posterior inferior"], regionNote: "lower thoracic rib movement context" },
  { slug: "brachioradialis", title: "Brachioradialis", partIds: ["FMA38485"], partNames: ["brachioradialis"], regionNote: "forearm and elbow flexion context" },
  { slug: "anconeus", title: "Anconeus", partIds: ["FMA37704"], partNames: ["anconeus"], regionNote: "posterior elbow stabilizer context" },
  { slug: "supinator", title: "Supinator", partIds: ["FMA38512"], partNames: ["supinator"], regionNote: "proximal forearm rotation context" },
  { slug: "flexor-carpi-radialis", title: "Flexor Carpi Radialis", partIds: ["FMA38459"], partNames: ["flexor carpi radialis"], regionNote: "anterior forearm and wrist flexion context" },
  { slug: "extensor-carpi-ulnaris", title: "Extensor Carpi Ulnaris", partIds: ["FMA38506"], partNames: ["extensor carpi ulnaris"], regionNote: "posterior forearm and wrist extension context" },
  { slug: "flexor-digitorum-superficialis", title: "Flexor Digitorum Superficialis", partIds: ["FMA38469"], partNames: ["flexor digitorum superficialis"], regionNote: "finger flexor and anterior forearm context" },
  { slug: "flexor-digitorum-profundus", title: "Flexor Digitorum Profundus", partIds: ["FMA38478"], partNames: ["flexor digitorum profundus"], regionNote: "deep finger flexor and anterior forearm context" },
  { slug: "extensor-digitorum", title: "Extensor Digitorum", partIds: ["FMA38500"], partNames: ["extensor digitorum"], regionNote: "finger extensor and posterior forearm context" },
  { slug: "palmaris-longus", title: "Palmaris Longus", partIds: ["FMA38462"], partNames: ["palmaris longus"], regionNote: "anterior forearm and palmar aponeurosis context" },
  { slug: "pronator-quadratus", title: "Pronator Quadratus", partIds: ["FMA38453"], partNames: ["pronator quadratus"], regionNote: "deep distal forearm pronation context" },
  { slug: "flexor-pollicis-longus", title: "Flexor Pollicis Longus", partIds: ["FMA38481"], partNames: ["flexor pollicis longus"], regionNote: "thumb flexor and anterior forearm context" },
  { slug: "abductor-pollicis-longus", title: "Abductor Pollicis Longus", partIds: ["FMA38515"], partNames: ["abductor pollicis longus"], regionNote: "thumb abductor and posterior forearm context" },
  { slug: "extensor-pollicis-brevis", title: "Extensor Pollicis Brevis", partIds: ["FMA38518"], partNames: ["extensor pollicis brevis"], regionNote: "thumb extensor and posterior forearm context" },
  { slug: "extensor-pollicis-longus", title: "Extensor Pollicis Longus", partIds: ["FMA38521"], partNames: ["extensor pollicis longus"], regionNote: "thumb extensor and posterior forearm context" },
] as const

function entityLinksForMuscle(asset: BodyParts3dMuscleMediaSeed): readonly MediaEntityLinkSeed[] {
  return asset.entityLinks ?? [
    {
      entityType: "muscle",
      entitySlug: asset.slug,
      role: "primary",
      notes: `Primary BodyParts3D anatomogram render for ${asset.title}; ${asset.regionNote}.`,
    },
  ]
}

function assetSlug(asset: BodyParts3dMuscleMediaSeed) {
  return `bodyparts3d-${asset.slug}-anatomogram`
}

export const MEDIA_BODYPARTS3D_MUSCLE_BATCH_2_SECTION = {
  mediaAssets: muscleImages.map((asset) => ({
    id: `media-${assetSlug(asset)}`,
    slug: assetSlug(asset),
    title: `BodyParts3D ${asset.title} Anatomogram`,
    mediaType: MEDIA_TYPE_IMAGE,
    description: `Reviewed BodyParts3D 3D anatomogram render showing ${asset.title.toLowerCase()} with low-opacity skeleton context for ${asset.regionNote}.`,
    sourceRef: BODYPARTS3D_SOURCE,
    sourceUrl: bodyParts3dImageUrl(asset.partIds),
    storagePath: `anatomy/bodyparts3d/anatomograms/${asset.slug}.png`,
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
      bodyparts3dPartIds: asset.partIds,
      bodyparts3dPartNames: asset.partNames,
      backgroundPartId: BODYPARTS3D_SKELETON_BACKGROUND_ID,
      backgroundPartOpacity: 0.15,
      visualStyle: "3d-anatomogram-render",
      anatomogramVersion: "4.1",
      licenseVerifiedAt: "2026-05-26",
      licensePage: BODYPARTS3D_LICENSE_PAGE,
      ingestionStatus: "pending_r2_upload",
    },
  })),
  mediaEntityLinks: muscleImages.flatMap((asset) => entityLinksForMuscle(asset).map((link) => ({
    id: `media-link-${assetSlug(asset)}-${link.entityType}-${link.entitySlug}-${link.role}`,
    assetSlug: assetSlug(asset),
    entityType: link.entityType,
    entitySlug: link.entitySlug,
    role: link.role,
    notes: link.notes,
  }))),
  citations: muscleImages.flatMap((asset) => [
    {
      id: `citation-${assetSlug(asset)}-media-source`,
      slug: `citation-${assetSlug(asset)}-media-source`,
      entityType: "muscle" as const,
      entitySlug: asset.slug,
      factType: "media_source",
      factSlug: assetSlug(asset),
      sourceRef: BODYPARTS3D_SOURCE,
      sourceLocator: bodyParts3dImageUrl(asset.partIds),
      citationNote: `BodyParts3D/Anatomography API image generated from reviewed FMA part IDs for ${asset.title}; selected for R2 ingestion with stored license, attribution, source URL, and upload path.`,
      reviewStatus: REVIEWED,
    },
    {
      id: `citation-${assetSlug(asset)}-media-license`,
      slug: `citation-${assetSlug(asset)}-media-license`,
      entityType: "muscle" as const,
      entitySlug: asset.slug,
      factType: "media_license",
      factSlug: assetSlug(asset),
      sourceRef: BODYPARTS3D_SOURCE,
      sourceLocator: BODYPARTS3D_LICENSE_PAGE,
      citationNote: "BodyParts3D official license page lists Creative Commons Attribution 4.0 International and required attribution wording.",
      reviewStatus: REVIEWED,
    },
  ]),
} satisfies AnatomySeedSection

export const MEDIA_BODYPARTS3D_MUSCLE_BATCH_2_SLUGS = muscleImages.map((asset) => assetSlug(asset))
export const MEDIA_BODYPARTS3D_MUSCLE_BATCH_2_ENTITY_SLUGS = muscleImages.map((asset) => asset.slug)
export const MEDIA_BODYPARTS3D_MUSCLE_BATCH_2_COUNT = muscleImages.length
