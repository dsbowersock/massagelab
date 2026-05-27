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

type BodyParts3dBloodSupplyMapping = {
  slug: string
  title: string
  partIds: readonly string[]
  partNames: readonly string[]
  treeName: TreeName
  mappingNote: string
}

type ExactBloodSupplyTuple = readonly [
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

const BLOOD_SUPPLY_MAPPINGS = [
  ["transverse-cervical-artery", "Transverse Cervical Artery", "FMA10664", "transverse cervical artery"],
  ["dorsal-scapular-artery", "Dorsal Scapular Artery", "FMA79658", "dorsal scapular artery"],
  ["suprascapular-artery", "Suprascapular Artery", "FMA10663", "suprascapular artery"],
  ["posterior-circumflex-humeral-artery", "Posterior Circumflex Humeral Artery", "FMA22684", "posterior circumflex humeral artery"],
  ["subclavian-artery", "Subclavian Artery", "FMA3951", "subclavian artery"],
  ["axillary-artery", "Axillary Artery", "FMA22654", "axillary artery"],
  ["circumflex-scapular-artery", "Circumflex Scapular Artery", "FMA23179", "circumflex scapular artery"],
  ["thoracodorsal-artery", "Thoracodorsal Artery", "FMA66320", "thoracodorsal artery"],
  ["lateral-thoracic-artery", "Lateral Thoracic Artery", "FMA22674", "lateral thoracic artery"],
  ["cephalic-vein", "Cephalic Vein", "FMA13324", "cephalic vein"],
  ["common-carotid-artery", "Common Carotid Artery", "FMA3939", "common carotid artery"],
  ["internal-carotid-artery", "Internal Carotid Artery", "FMA3947", "internal carotid artery"],
  ["vertebral-artery", "Vertebral Artery", "FMA3956", "vertebral artery"],
  ["common-iliac-artery", "Common Iliac Artery", "FMA14764", "common iliac artery"],
  ["external-iliac-artery", "External Iliac Artery", "FMA18805", "external iliac artery"],
  ["superior-vena-cava", "Superior Vena Cava", "FMA4720", "superior vena cava"],
  ["inferior-vena-cava", "Inferior Vena Cava", "FMA10951", "inferior vena cava"],
  ["internal-jugular-vein", "Internal Jugular Vein", "FMA4724", "internal jugular vein"],
  ["great-saphenous-vein", "Great Saphenous Vein", "FMA21376", "great saphenous vein"],
  ["small-saphenous-vein", "Small Saphenous Vein", "FMA44333", "small saphenous vein"],
  ["portal-vein", "Portal Vein", "FMA66645", "portal vein"],
  ["left-gastric-artery", "Left Gastric Artery", "FMA14768", "left gastric artery"],
  ["splenic-artery", "Splenic Artery", "FMA14773", "splenic artery"],
  ["common-hepatic-artery", "Common Hepatic Artery", "FMA14771", "common hepatic artery"],
  ["superior-rectal-artery", "Superior Rectal Artery", "FMA14832", "superior rectal artery"],
  ["subclavian-vein", "Subclavian Vein", "FMA4725", "subclavian vein"],
  ["celiac-trunk", "Celiac Trunk", "FMA14812", "celiac trunk"],
  ["superior-mesenteric-artery", "Superior Mesenteric Artery", "FMA14749", "superior mesenteric artery"],
  ["inferior-mesenteric-artery", "Inferior Mesenteric Artery", "FMA14750", "inferior mesenteric artery"],
  ["pulmonary-trunk", "Pulmonary Trunk", "FMA8612", "pulmonary trunk"],
  ["azygos-vein", "Azygos Vein", "FMA4838", "azygos vein"],
  ["hemiazygos-vein", "Hemiazygos Vein", "FMA4944", "hemiazygos vein"],
  ["internal-iliac-vein", "Internal Iliac Vein", "FMA18884", "internal iliac vein"],
  ["external-iliac-vein", "External Iliac Vein", "FMA18883", "external iliac vein"],
  ["axillary-vein", "Axillary Vein", "FMA13329", "axillary vein"],
  ["median-cubital-vein", "Median Cubital Vein", "FMA22963", "median cubital vein"],
  ["dorsal-venous-network-hand", "Dorsal Venous Network of Hand", "FMA67977", "dorsal venous network of hand"],
  ["dorsal-venous-arch-foot", "Dorsal Venous Arch of Foot", "FMA44356", "dorsal venous arch of foot"],
  ["abdominal-aorta", "Abdominal Aorta", "FMA3789", "abdominal aorta"],
  ["internal-iliac-artery", "Internal Iliac Artery", "FMA18808", "internal iliac artery"],
  ["posterior-intercostal-arteries", "Posterior Intercostal Arteries", "FMA63822", "posterior intercostal arteries"],
  ["internal-thoracic-artery", "Internal Thoracic Artery", "FMA3960", "internal thoracic artery"],
  ["internal-pudendal-vein", "Internal Pudendal Vein", "FMA18917", "internal pudendal vein"],
  ["brachial-artery", "Brachial Artery", "FMA22689", "brachial artery"],
  ["deep-brachial-artery", "Deep Brachial Artery", "FMA22695", "deep brachial artery"],
  ["radial-artery", "Radial Artery", "FMA22730", "radial artery"],
  ["ulnar-artery", "Ulnar Artery", "FMA22796", "ulnar artery"],
  ["basilic-vein", "Basilic Vein", "FMA22908", "basilic vein"],
  ["femoral-artery", "Femoral Artery", "FMA70248", "femoral artery"],
  ["femoral-vein", "Femoral Vein", "FMA21185", "femoral vein"],
  ["popliteal-artery", "Popliteal Artery", "FMA77155", "popliteal artery"],
  ["popliteal-vein", "Popliteal Vein", "FMA44327", "popliteal vein"],
  ["anterior-tibial-artery", "Anterior Tibial Artery", "FMA43894", "anterior tibial artery"],
  ["posterior-tibial-artery", "Posterior Tibial Artery", "FMA43895", "posterior tibial artery"],
  ["lateral-circumflex-femoral-artery", "Lateral Circumflex Femoral Artery", "FMA20798", "lateral circumflex femoral artery"],
  ["dorsalis-pedis-artery", "Dorsalis Pedis Artery", "FMA43915", "dorsalis pedis artery"],
  ["medial-plantar-artery", "Medial Plantar Artery", "FMA43925", "medial plantar artery"],
  ["lateral-plantar-artery", "Lateral Plantar Artery", "FMA43926", "lateral plantar artery"],
  ["gastroduodenal-artery", "Gastroduodenal Artery", "FMA14775", "gastroduodenal artery", "Exact BodyParts3D part-of tree match.", "partof"],
] as const satisfies readonly ExactBloodSupplyTuple[]

function exactBloodSupplyMapping([slug, title, partId, partName, note, treeName]: ExactBloodSupplyTuple): BodyParts3dBloodSupplyMapping {
  return {
    slug,
    title,
    partIds: [partId],
    partNames: [partName],
    treeName: treeName ?? "isa",
    mappingNote: note ?? "Exact BodyParts3D part-list match.",
  }
}

function uniqueMappings(mappings: readonly BodyParts3dBloodSupplyMapping[]) {
  const bySlug = new Map<string, BodyParts3dBloodSupplyMapping>()
  for (const mapping of mappings) {
    if (!bySlug.has(mapping.slug)) bySlug.set(mapping.slug, mapping)
  }
  return [...bySlug.values()].sort((a, b) => a.slug.localeCompare(b.slug))
}

export const MEDIA_BODYPARTS3D_BLOOD_SUPPLY_MULTIVIEW_MAPPINGS = uniqueMappings(
  BLOOD_SUPPLY_MAPPINGS.map(exactBloodSupplyMapping),
)

function bodyParts3dImageUrl(mapping: BodyParts3dBloodSupplyMapping, view: MultiView): string {
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

  return `http://lifesciencedb.jp/bp3d/API/image?${encodeURIComponent(JSON.stringify(config))}`
}

function assetSlug(mapping: BodyParts3dBloodSupplyMapping, view: MultiView) {
  return `bodyparts3d-blood-supply-${mapping.slug}-${view.slug}-anatomogram`
}

function entityLinkForMapping(mapping: BodyParts3dBloodSupplyMapping, view: MultiView): MediaEntityLinkSeed {
  return {
    entityType: "blood_supply",
    entitySlug: mapping.slug,
    role: "primary",
    notes: `Primary BodyParts3D ${view.title.toLowerCase()} anatomogram render for ${mapping.title}. ${mapping.mappingNote}`,
  }
}

const multiviewAssets = MEDIA_BODYPARTS3D_BLOOD_SUPPLY_MULTIVIEW_MAPPINGS.flatMap((mapping) => (
  MULTI_VIEWS.map((view) => ({
    mapping,
    view,
    slug: assetSlug(mapping, view),
  }))
))

export const MEDIA_BODYPARTS3D_BLOOD_SUPPLY_MULTIVIEW_SECTION = {
  mediaAssets: multiviewAssets.map(({ mapping, view, slug }) => ({
    id: `media-${slug}`,
    slug,
    title: `BodyParts3D ${mapping.title} ${view.title} Anatomogram`,
    mediaType: MEDIA_TYPE_IMAGE,
    description: `Reviewed BodyParts3D 3D anatomogram render showing ${mapping.title.toLowerCase()} ${view.description} with low-opacity skeleton context.`,
    sourceRef: BODYPARTS3D_SOURCE,
    sourceUrl: bodyParts3dImageUrl(mapping, view),
    storagePath: `anatomy/bodyparts3d/anatomograms/blood-supply/${mapping.slug}/${view.slug}.png`,
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
      entityType: "blood_supply" as const,
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
      entityType: "blood_supply" as const,
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

export const MEDIA_BODYPARTS3D_BLOOD_SUPPLY_MULTIVIEW_ENTITY_SLUGS = MEDIA_BODYPARTS3D_BLOOD_SUPPLY_MULTIVIEW_MAPPINGS.map((mapping) => mapping.slug)
export const MEDIA_BODYPARTS3D_BLOOD_SUPPLY_MULTIVIEW_SLUGS = multiviewAssets.map((asset) => asset.slug)
export const MEDIA_BODYPARTS3D_BLOOD_SUPPLY_MULTIVIEW_COUNT = multiviewAssets.length
export const MEDIA_BODYPARTS3D_BLOOD_SUPPLY_MULTIVIEW_VIEWS = MULTI_VIEWS.map((view) => view.slug)
