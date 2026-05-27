import type { AnatomyEntityType, AnatomyMediaRole } from "../anatomy-foundation.ts"
import type { AnatomySeedSection } from "./sections.ts"

const BODYPARTS3D_SOURCE = "bodyparts3d"
const BODYPARTS3D_ATTRIBUTION = "BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International."
const BODYPARTS3D_LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/"
const BODYPARTS3D_LICENSE_PAGE = "https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html"
const BODYPARTS3D_API_DOCS = "https://lifesciencedb.jp/bp3d/info_en/webapi/index.html"
const BODYPARTS3D_ISA_PART_LIST = "https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/isa_parts_list_e.txt"
const BODYPARTS3D_PARTOF_PART_LIST = "https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/partof_parts_list_e.txt"
const BODYPARTS3D_SKELETON_BACKGROUND_ID = "FMA5018"
const MEDIA_TYPE_IMAGE = "image" as const
const OPEN_REUSE = "open_reuse" as const
const REVIEWED = "reviewed" as const

type CameraMode = "front" | "back" | "left" | "right"
type TreeName = "isa" | "partof"

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

type BodyParts3dBoneMapping = {
  slug: string
  title: string
  partIds: readonly string[]
  partNames: readonly string[]
  treeName: TreeName
  mappingNote: string
}

type ExactBoneTuple = readonly [
  slug: string,
  title: string,
  partId: string,
  partName: string,
  note?: string,
  treeName?: TreeName,
]

const MULTI_VIEWS: readonly MultiView[] = [
  { slug: "anterior", title: "Anterior View", cameraMode: "front", description: "from the anterior camera view" },
  { slug: "posterior", title: "Posterior View", cameraMode: "back", description: "from the posterior camera view" },
  { slug: "left-lateral", title: "Left Lateral View", cameraMode: "left", description: "from the left lateral camera view" },
  { slug: "right-lateral", title: "Right Lateral View", cameraMode: "right", description: "from the right lateral camera view" },
] as const

const CRANIOFACIAL_BONES = [
  ["occipital-bone", "Occipital Bone", "FMA52735", "occipital bone"],
  ["temporal-bone", "Temporal Bone", "FMA52737", "temporal bone"],
  ["parietal-bone", "Parietal Bone", "FMA9613", "parietal bone"],
  ["ethmoid-bone", "Ethmoid Bone", "FMA52740", "ethmoid", "Modeled ethmoid bone row mapped to BodyParts3D ethmoid."],
  ["nasal-bone", "Nasal Bone", "FMA52745", "nasal bone"],
  ["lacrimal-bone", "Lacrimal Bone", "FMA52741", "lacrimal bone"],
  ["palatine-bone", "Palatine Bone", "FMA52746", "palatine bone"],
  ["vomer", "Vomer", "FMA9710", "vomer"],
  ["inferior-nasal-concha", "Inferior Nasal Concha", "FMA54736", "inferior nasal concha"],
  ["mandible", "Mandible", "FMA52748", "mandible"],
  ["maxilla", "Maxilla", "FMA9711", "maxilla"],
  ["zygomatic-bone", "Zygomatic Bone", "FMA52747", "zygomatic bone"],
  ["sphenoid-bone", "Sphenoid Bone", "FMA52736", "sphenoid bone"],
  ["frontal-bone", "Frontal Bone", "FMA52734", "frontal bone"],
  ["hyoid-bone", "Hyoid Bone", "FMA52749", "hyoid bone"],
] as const satisfies readonly ExactBoneTuple[]

const CERVICAL_VERTEBRAE = [
  ["atlas", "Atlas (C1)", "FMA12519", "atlas"],
  ["axis", "Axis (C2)", "FMA12520", "axis"],
  ["c3-vertebra", "C3 Vertebra", "FMA12521", "third cervical vertebra"],
  ["c4-vertebra", "C4 Vertebra", "FMA12522", "fourth cervical vertebra"],
  ["c5-vertebra", "C5 Vertebra", "FMA12523", "fifth cervical vertebra"],
  ["c6-vertebra", "C6 Vertebra", "FMA12524", "sixth cervical vertebra"],
  ["c7-vertebra", "C7 Vertebra", "FMA12525", "seventh cervical vertebra"],
] as const satisfies readonly ExactBoneTuple[]

const THORACIC_VERTEBRAE = [
  ["t1-vertebra", "T1 Vertebra", "FMA9165", "first thoracic vertebra"],
  ["t2-vertebra", "T2 Vertebra", "FMA9187", "second thoracic vertebra"],
  ["t3-vertebra", "T3 Vertebra", "FMA9209", "third thoracic vertebra"],
  ["t4-vertebra", "T4 Vertebra", "FMA9248", "fourth thoracic vertebra"],
  ["t5-vertebra", "T5 Vertebra", "FMA9922", "fifth thoracic vertebra"],
  ["t6-vertebra", "T6 Vertebra", "FMA9945", "sixth thoracic vertebra"],
  ["t7-vertebra", "T7 Vertebra", "FMA9968", "seventh thoracic vertebra"],
  ["t8-vertebra", "T8 Vertebra", "FMA9991", "eighth thoracic vertebra"],
  ["t9-vertebra", "T9 Vertebra", "FMA10014", "ninth thoracic vertebra"],
  ["t10-vertebra", "T10 Vertebra", "FMA10037", "tenth thoracic vertebra"],
  ["t11-vertebra", "T11 Vertebra", "FMA10059", "eleventh thoracic vertebra"],
  ["t12-vertebra", "T12 Vertebra", "FMA10081", "twelfth thoracic vertebra"],
] as const satisfies readonly ExactBoneTuple[]

const LUMBAR_VERTEBRAE = [
  ["l1-vertebra", "L1 Vertebra", "FMA13072", "first lumbar vertebra"],
  ["l2-vertebra", "L2 Vertebra", "FMA13073", "second lumbar vertebra"],
  ["l3-vertebra", "L3 Vertebra", "FMA13074", "third lumbar vertebra"],
  ["l4-vertebra", "L4 Vertebra", "FMA13075", "fourth lumbar vertebra"],
  ["l5-vertebra", "L5 Vertebra", "FMA13076", "fifth lumbar vertebra"],
] as const satisfies readonly ExactBoneTuple[]

const RIBS = [
  ["first-rib", "First Rib", "FMA7597", "first rib"],
  ["second-rib", "Second Rib", "FMA7620", "second rib"],
  ["third-rib", "Third Rib", "FMA7638", "third rib"],
  ["fourth-rib", "Fourth Rib", "FMA7749", "fourth rib"],
  ["fifth-rib", "Fifth Rib", "FMA7776", "fifth rib"],
  ["sixth-rib", "Sixth Rib", "FMA8147", "sixth rib"],
  ["seventh-rib", "Seventh Rib", "FMA7830", "seventh rib"],
  ["eighth-rib", "Eighth Rib", "FMA8120", "eighth rib"],
  ["ninth-rib", "Ninth Rib", "FMA8337", "ninth rib"],
  ["tenth-rib", "Tenth Rib", "FMA8418", "tenth rib"],
  ["eleventh-rib", "Eleventh Rib", "FMA8499", "eleventh rib"],
  ["twelfth-rib", "Twelfth Rib", "FMA8515", "twelfth rib"],
] as const satisfies readonly ExactBoneTuple[]

const STERNUM_BONES = [
  ["sternum", "Sternum", "FMA7485", "sternum", "BodyParts3D part-of tree contains the full sternum part.", "partof"],
  ["manubrium", "Manubrium", "FMA7486", "manubrium"],
  ["body-of-sternum", "Body of Sternum", "FMA7487", "body of sternum"],
  ["xiphoid-process", "Xiphoid Process", "FMA7488", "xiphoid process"],
] as const satisfies readonly ExactBoneTuple[]

const SHOULDER_ARM_BONES = [
  ["clavicle", "Clavicle", "FMA13321", "clavicle"],
  ["scapula", "Scapula", "FMA13394", "scapula"],
  ["humerus", "Humerus", "FMA13303", "humerus"],
  ["radius", "Radius", "FMA23463", "radius"],
  ["ulna", "Ulna", "FMA23466", "ulna"],
] as const satisfies readonly ExactBoneTuple[]

const CARPAL_BONES = [
  ["scaphoid", "Scaphoid", "FMA23709", "scaphoid"],
  ["lunate", "Lunate", "FMA23712", "lunate"],
  ["triquetrum", "Triquetrum", "FMA23715", "triquetral", "Modeled triquetrum row mapped to BodyParts3D triquetral."],
  ["pisiform", "Pisiform", "FMA23718", "pisiform"],
  ["trapezium", "Trapezium", "FMA23721", "trapezium"],
  ["trapezoid", "Trapezoid", "FMA23724", "trapezoid"],
  ["capitate", "Capitate", "FMA23727", "capitate"],
  ["hamate", "Hamate", "FMA23730", "hamate"],
] as const satisfies readonly ExactBoneTuple[]

const METACARPALS = [
  ["first-metacarpal", "First Metacarpal", "FMA23899", "first metacarpal bone"],
  ["second-metacarpal", "Second Metacarpal", "FMA23900", "second metacarpal bone"],
  ["third-metacarpal", "Third Metacarpal", "FMA23901", "third metacarpal bone"],
  ["fourth-metacarpal", "Fourth Metacarpal", "FMA23902", "fourth metacarpal bone"],
  ["fifth-metacarpal", "Fifth Metacarpal", "FMA23903", "fifth metacarpal bone"],
] as const satisfies readonly ExactBoneTuple[]

const HAND_PHALANGES = [
  ["proximal-phalanx-thumb-hand", "Proximal Phalanx of Thumb", "FMA23918", "proximal phalanx of thumb"],
  ["distal-phalanx-thumb-hand", "Distal Phalanx of Thumb", "FMA23945", "distal phalanx of thumb"],
  ["proximal-phalanx-index-finger", "Proximal Phalanx of Index Finger", "FMA23919", "proximal phalanx of index finger"],
  ["middle-phalanx-index-finger", "Middle Phalanx of Index Finger", "FMA23933", "middle phalanx of index finger"],
  ["distal-phalanx-index-finger", "Distal Phalanx of Index Finger", "FMA23946", "distal phalanx of index finger"],
  ["proximal-phalanx-middle-finger", "Proximal Phalanx of Middle Finger", "FMA23920", "proximal phalanx of middle finger"],
  ["middle-phalanx-middle-finger", "Middle Phalanx of Middle Finger", "FMA23934", "middle phalanx of middle finger"],
  ["distal-phalanx-middle-finger", "Distal Phalanx of Middle Finger", "FMA23947", "distal phalanx of middle finger"],
  ["proximal-phalanx-ring-finger", "Proximal Phalanx of Ring Finger", "FMA23921", "proximal phalanx of ring finger"],
  ["middle-phalanx-ring-finger", "Middle Phalanx of Ring Finger", "FMA23935", "middle phalanx of ring finger"],
  ["distal-phalanx-ring-finger", "Distal Phalanx of Ring Finger", "FMA23948", "distal phalanx of ring finger"],
  ["proximal-phalanx-little-finger", "Proximal Phalanx of Little Finger", "FMA23922", "proximal phalanx of little finger"],
  ["middle-phalanx-little-finger", "Middle Phalanx of Little Finger", "FMA23936", "middle phalanx of little finger"],
  ["distal-phalanx-little-finger", "Distal Phalanx of Little Finger", "FMA23949", "distal phalanx of little finger"],
] as const satisfies readonly ExactBoneTuple[]

const PELVIS_LEG_BONES = [
  ["hip-bone", "Hip Bone", "FMA16585", "hip bone"],
  ["pelvis", "Pelvis", "FMA9578", "pelvis", "BodyParts3D part-of tree contains the full pelvis part.", "partof"],
  ["sacrum", "Sacrum", "FMA16202", "sacrum"],
  ["femur", "Femur", "FMA9611", "femur"],
  ["patella", "Patella", "FMA24485", "patella"],
  ["tibia", "Tibia", "FMA24476", "tibia"],
  ["fibula", "Fibula", "FMA24479", "fibula"],
] as const satisfies readonly ExactBoneTuple[]

const TARSAL_BONES = [
  ["talus", "Talus", "FMA9708", "talus"],
  ["calcaneus", "Calcaneus", "FMA24496", "calcaneus"],
  ["navicular", "Navicular", "FMA24499", "navicular bone of foot", "Modeled navicular row mapped to BodyParts3D navicular bone of foot."],
  ["cuboid", "Cuboid", "FMA24527", "cuboid bone"],
  ["medial-cuneiform", "Medial Cuneiform", "FMA24518", "medial cuneiform bone"],
  ["intermediate-cuneiform", "Intermediate Cuneiform", "FMA24519", "intermediate cuneiform bone"],
  ["lateral-cuneiform", "Lateral Cuneiform", "FMA24520", "lateral cuneiform bone"],
] as const satisfies readonly ExactBoneTuple[]

const METATARSALS = [
  ["first-metatarsal", "First Metatarsal", "FMA24502", "first metatarsal bone"],
  ["second-metatarsal", "Second Metatarsal", "FMA24503", "second metatarsal bone"],
  ["third-metatarsal", "Third Metatarsal", "FMA24504", "third metatarsal bone"],
  ["fourth-metatarsal", "Fourth Metatarsal", "FMA24505", "fourth metatarsal bone"],
  ["fifth-metatarsal", "Fifth Metatarsal", "FMA24506", "fifth metatarsal bone"],
] as const satisfies readonly ExactBoneTuple[]

const FOOT_PHALANGES = [
  ["proximal-phalanx-hallux", "Proximal Phalanx of Great Toe", "FMA43252", "proximal phalanx of big toe", "Modeled great toe row mapped to BodyParts3D big toe terminology."],
  ["distal-phalanx-hallux", "Distal Phalanx of Great Toe", "FMA32627", "distal phalanx of big toe", "Modeled great toe row mapped to BodyParts3D big toe terminology."],
  ["proximal-phalanx-second-toe", "Proximal Phalanx of Second Toe", "FMA32618", "proximal phalanx of second toe"],
  ["middle-phalanx-second-toe", "Middle Phalanx of Second Toe", "FMA32623", "middle phalanx of second toe"],
  ["distal-phalanx-second-toe", "Distal Phalanx of Second Toe", "FMA32628", "distal phalanx of second toe"],
  ["proximal-phalanx-third-toe", "Proximal Phalanx of Third Toe", "FMA32619", "proximal phalanx of third toe"],
  ["middle-phalanx-third-toe", "Middle Phalanx of Third Toe", "FMA32624", "middle phalanx of third toe"],
  ["distal-phalanx-third-toe", "Distal Phalanx of Third Toe", "FMA32629", "distal phalanx of third toe"],
  ["proximal-phalanx-fourth-toe", "Proximal Phalanx of Fourth Toe", "FMA32620", "proximal phalanx of fourth toe"],
  ["middle-phalanx-fourth-toe", "Middle Phalanx of Fourth Toe", "FMA32625", "middle phalanx of fourth toe"],
  ["distal-phalanx-fourth-toe", "Distal Phalanx of Fourth Toe", "FMA32630", "distal phalanx of fourth toe"],
  ["proximal-phalanx-fifth-toe", "Proximal Phalanx of Fifth Toe", "FMA32621", "proximal phalanx of little toe", "Modeled fifth toe row mapped to BodyParts3D little toe terminology."],
  ["middle-phalanx-fifth-toe", "Middle Phalanx of Fifth Toe", "FMA230984", "middle phalanx of little toe", "Modeled fifth toe row mapped to BodyParts3D little toe terminology."],
  ["distal-phalanx-fifth-toe", "Distal Phalanx of Fifth Toe", "FMA32631", "distal phalanx of little toe", "Modeled fifth toe row mapped to BodyParts3D little toe terminology."],
] as const satisfies readonly ExactBoneTuple[]

function exactBoneMapping([slug, title, partId, partName, note, treeName]: ExactBoneTuple): BodyParts3dBoneMapping {
  return {
    slug,
    title,
    partIds: [partId],
    partNames: [partName],
    treeName: treeName ?? "isa",
    mappingNote: note ?? "Exact BodyParts3D part-list match.",
  }
}

function compositeBoneMapping(
  slug: string,
  title: string,
  parts: readonly ExactBoneTuple[],
  mappingNote: string,
): BodyParts3dBoneMapping {
  return {
    slug,
    title,
    partIds: parts.map(([, , partId]) => partId),
    partNames: parts.map(([, , , partName]) => partName),
    treeName: "isa",
    mappingNote,
  }
}

function uniqueMappings(mappings: readonly BodyParts3dBoneMapping[]) {
  const bySlug = new Map<string, BodyParts3dBoneMapping>()
  for (const mapping of mappings) {
    if (!bySlug.has(mapping.slug)) bySlug.set(mapping.slug, mapping)
  }
  return [...bySlug.values()].sort((a, b) => a.slug.localeCompare(b.slug))
}

export const MEDIA_BODYPARTS3D_BONE_MULTIVIEW_MAPPINGS = uniqueMappings([
  ...CRANIOFACIAL_BONES.map(exactBoneMapping),
  compositeBoneMapping("cranial-bones", "Cranial Bones", [
    CRANIOFACIAL_BONES[0],
    CRANIOFACIAL_BONES[1],
    CRANIOFACIAL_BONES[2],
    CRANIOFACIAL_BONES[3],
    CRANIOFACIAL_BONES[12],
    CRANIOFACIAL_BONES[13],
  ], "Composite cranial bones overview assembled from reviewed BodyParts3D cranial bone parts modeled in the dataset."),
  compositeBoneMapping("facial-bones", "Facial Bones", [
    CRANIOFACIAL_BONES[4],
    CRANIOFACIAL_BONES[5],
    CRANIOFACIAL_BONES[6],
    CRANIOFACIAL_BONES[7],
    CRANIOFACIAL_BONES[8],
    CRANIOFACIAL_BONES[9],
    CRANIOFACIAL_BONES[10],
    CRANIOFACIAL_BONES[11],
  ], "Composite facial bones overview assembled from reviewed BodyParts3D facial bone parts modeled in the dataset."),
  ...CERVICAL_VERTEBRAE.map(exactBoneMapping),
  compositeBoneMapping("cervical-vertebrae", "Cervical Vertebrae", CERVICAL_VERTEBRAE, "Composite cervical vertebrae overview assembled from C1 through C7 BodyParts3D parts."),
  ...THORACIC_VERTEBRAE.map(exactBoneMapping),
  compositeBoneMapping("thoracic-vertebrae", "Thoracic Vertebrae", THORACIC_VERTEBRAE, "Composite thoracic vertebrae overview assembled from T1 through T12 BodyParts3D parts."),
  ...LUMBAR_VERTEBRAE.map(exactBoneMapping),
  compositeBoneMapping("lumbar-vertebrae", "Lumbar Vertebrae", LUMBAR_VERTEBRAE, "Composite lumbar vertebrae overview assembled from L1 through L5 BodyParts3D parts."),
  ...RIBS.map(exactBoneMapping),
  compositeBoneMapping("ribs", "Ribs", RIBS, "Composite ribs overview assembled from first through twelfth rib BodyParts3D parts."),
  ...STERNUM_BONES.map(exactBoneMapping),
  ...SHOULDER_ARM_BONES.map(exactBoneMapping),
  ...CARPAL_BONES.map(exactBoneMapping),
  compositeBoneMapping("carpals", "Carpal Bones", CARPAL_BONES, "Composite carpal bones overview assembled from the eight named carpal BodyParts3D parts."),
  ...METACARPALS.map(exactBoneMapping),
  compositeBoneMapping("metacarpals", "Metacarpals", METACARPALS, "Composite metacarpals overview assembled from first through fifth metacarpal BodyParts3D parts."),
  ...HAND_PHALANGES.map(exactBoneMapping),
  compositeBoneMapping("hand-phalanges", "Hand Phalanges", HAND_PHALANGES, "Composite hand phalanges overview assembled from reviewed thumb and finger phalanx BodyParts3D parts."),
  ...PELVIS_LEG_BONES.map(exactBoneMapping),
  ...TARSAL_BONES.map(exactBoneMapping),
  compositeBoneMapping("tarsals", "Tarsal Bones", TARSAL_BONES, "Composite tarsal bones overview assembled from reviewed BodyParts3D tarsal parts modeled in the dataset."),
  ...METATARSALS.map(exactBoneMapping),
  compositeBoneMapping("metatarsals", "Metatarsals", METATARSALS, "Composite metatarsals overview assembled from first through fifth metatarsal BodyParts3D parts."),
  ...FOOT_PHALANGES.map(exactBoneMapping),
  compositeBoneMapping("foot-phalanges", "Foot Phalanges", FOOT_PHALANGES, "Composite foot phalanges overview assembled from reviewed toe phalanx BodyParts3D parts."),
])

function bodyParts3dImageUrl(mapping: BodyParts3dBoneMapping, view: MultiView): string {
  const config = {
    Common: {
      Version: "4.1",
      TreeName: mapping.treeName,
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
      ...mapping.partIds.map((partId) => ({
        PartID: partId,
        PartColor: "D83A3A",
        PartOpacity: 1,
      })),
    ],
  }

  return `https://lifesciencedb.jp/bp3d/API/image?${encodeURIComponent(JSON.stringify(config))}`
}

function assetSlug(mapping: BodyParts3dBoneMapping, view: MultiView) {
  return `bodyparts3d-bone-${mapping.slug}-${view.slug}-anatomogram`
}

function entityLinkForMapping(mapping: BodyParts3dBoneMapping, view: MultiView): MediaEntityLinkSeed {
  return {
    entityType: "bone",
    entitySlug: mapping.slug,
    role: "primary",
    notes: `Primary BodyParts3D ${view.title.toLowerCase()} anatomogram render for ${mapping.title}. ${mapping.mappingNote}`,
  }
}

const multiviewAssets = MEDIA_BODYPARTS3D_BONE_MULTIVIEW_MAPPINGS.flatMap((mapping) => (
  MULTI_VIEWS.map((view) => ({
    mapping,
    view,
    slug: assetSlug(mapping, view),
  }))
))

export const MEDIA_BODYPARTS3D_BONE_MULTIVIEW_SECTION = {
  mediaAssets: multiviewAssets.map(({ mapping, view, slug }) => ({
    id: `media-${slug}`,
    slug,
    title: `BodyParts3D ${mapping.title} ${view.title} Anatomogram`,
    mediaType: MEDIA_TYPE_IMAGE,
    description: `Reviewed BodyParts3D 3D anatomogram render showing ${mapping.title.toLowerCase()} ${view.description} with low-opacity skeleton context.`,
    sourceRef: BODYPARTS3D_SOURCE,
    sourceUrl: bodyParts3dImageUrl(mapping, view),
    storagePath: `anatomy/bodyparts3d/anatomograms/bones/${mapping.slug}/${view.slug}.png`,
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
      isaPartList: BODYPARTS3D_ISA_PART_LIST,
      partOfPartList: BODYPARTS3D_PARTOF_PART_LIST,
      bodyparts3dPartIds: mapping.partIds,
      bodyparts3dPartNames: mapping.partNames,
      bodyparts3dTreeName: mapping.treeName,
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
      entityType: "bone" as const,
      entitySlug: mapping.slug,
      factType: "media_source",
      factSlug: slug,
      sourceRef: BODYPARTS3D_SOURCE,
      sourceLocator: bodyParts3dImageUrl(mapping, view),
      citationNote: `BodyParts3D/Anatomography API ${view.title.toLowerCase()} image generated from reviewed FMA part IDs for ${mapping.title}; selected for R2 ingestion with stored license, attribution, source URL, camera mode, tree name, and upload path.`,
      reviewStatus: REVIEWED,
    },
    {
      id: `citation-${slug}-media-license`,
      slug: `citation-${slug}-media-license`,
      entityType: "bone" as const,
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

export const MEDIA_BODYPARTS3D_BONE_MULTIVIEW_ENTITY_SLUGS = MEDIA_BODYPARTS3D_BONE_MULTIVIEW_MAPPINGS.map((mapping) => mapping.slug)
export const MEDIA_BODYPARTS3D_BONE_MULTIVIEW_SLUGS = multiviewAssets.map((asset) => asset.slug)
export const MEDIA_BODYPARTS3D_BONE_MULTIVIEW_COUNT = multiviewAssets.length
export const MEDIA_BODYPARTS3D_BONE_MULTIVIEW_VIEWS = MULTI_VIEWS.map((view) => view.slug)
