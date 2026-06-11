import type { AnatomyEntityType, AnatomyMediaRole } from "./anatomy-foundation"
import type { AnatomyMediaReviewStatus } from "./domain-types"

export type BodyParts3dViewSlug = "anterior" | "posterior" | "left-lateral" | "right-lateral"
export type BodyParts3dTreeName = "isa" | "partof"

export type BodyParts3dView = {
  slug: BodyParts3dViewSlug
  title: string
  cameraMode: "front" | "back" | "left" | "right"
}

export const ANATOMY_MEDIA_REVIEW_STATUSES: AnatomyMediaReviewStatus[] = ["APPROVED", "NEEDS_REVIEW", "REJECTED"]

export const ANATOMY_MEDIA_REVIEW_REASONS = [
  "bad_match",
  "bad_view",
  "too_broad",
  "too_unclear",
  "duplicate",
  "other",
] as const

export const BODYPARTS3D_SOURCE_SLUG = "bodyparts3d"
export const BODYPARTS3D_LICENSE = "CC BY 4.0"
export const BODYPARTS3D_LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/"
export const BODYPARTS3D_LICENSE_PAGE = "https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html"
export const BODYPARTS3D_ATTRIBUTION = "BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International."
export const BODYPARTS3D_SKELETON_BACKGROUND_ID = "FMA5018"
export const BODYPARTS3D_IMAGE_API_URL = "https://lifesciencedb.jp/bp3d/API/image"

export const BODYPARTS3D_VIEWS: BodyParts3dView[] = [
  { slug: "anterior", title: "Anterior View", cameraMode: "front" },
  { slug: "posterior", title: "Posterior View", cameraMode: "back" },
  { slug: "left-lateral", title: "Left Lateral View", cameraMode: "left" },
  { slug: "right-lateral", title: "Right Lateral View", cameraMode: "right" },
]

const BODY_PARTS_3D_VIEW_BY_SLUG = new Map(BODYPARTS3D_VIEWS.map((view) => [view.slug, view]))

export function bodyParts3dView(value: string | null | undefined): BodyParts3dView {
  return BODY_PARTS_3D_VIEW_BY_SLUG.get(value as BodyParts3dViewSlug) ?? BODYPARTS3D_VIEWS[0]
}

export function normalizeBodyParts3dPartIds(value: string | readonly string[] | null | undefined) {
  const rawValues = Array.isArray(value) ? value : String(value ?? "").split(/[,\s]+/g)

  return [...new Set(rawValues
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean)
    .map((item) => item.startsWith("FMA") ? item : `FMA${item.replace(/^FMA/i, "")}`)
    .filter((item) => /^FMA\d+$/.test(item)))]
}

export function safeBodyParts3dImageUrl(value: string | null | undefined) {
  const trimmed = value?.trim()
  if (!trimmed) return ""

  try {
    const url = new URL(trimmed)
    if (url.protocol !== "https:") return ""
    if (url.hostname !== "lifesciencedb.jp") return ""
    if (url.pathname !== "/bp3d/API/image") return ""
    if (!url.search || url.search.length <= 1) return ""

    return url.toString()
  } catch {
    return ""
  }
}

export function bodyParts3dImageUrl({
  partIds,
  view,
  treeName = "isa",
  size = 700,
}: {
  partIds: readonly string[]
  view: BodyParts3dView | BodyParts3dViewSlug
  treeName?: BodyParts3dTreeName
  size?: number
}) {
  const selectedView = typeof view === "string" ? bodyParts3dView(view) : view
  const normalizedPartIds = normalizeBodyParts3dPartIds(partIds)
  const imageSize = Math.min(Math.max(Math.trunc(size), 300), 1200)
  const config = {
    Common: {
      Version: "4.1",
      TreeName: treeName,
    },
    Window: {
      ImageWidth: imageSize,
      ImageHeight: imageSize,
    },
    Camera: {
      CameraMode: selectedView.cameraMode,
    },
    Part: [
      {
        PartID: BODYPARTS3D_SKELETON_BACKGROUND_ID,
        PartOpacity: 0.15,
        UseForBoundingBoxFlag: false,
      },
      ...normalizedPartIds.map((partId) => ({
        PartID: partId,
        PartColor: "D83A3A",
        PartOpacity: 1,
      })),
    ],
  }

  return `${BODYPARTS3D_IMAGE_API_URL}?${encodeURIComponent(JSON.stringify(config))}`
}

export function anatomyMediaReviewKey({
  assetSlug,
  entityType,
  entitySlug,
  role,
}: {
  assetSlug: string
  entityType: string
  entitySlug: string
  role: string
}) {
  return [
    assetSlug.trim().toLowerCase(),
    entityType.trim().toLowerCase(),
    entitySlug.trim().toLowerCase(),
    role.trim().toLowerCase(),
  ].join("|")
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

export function bodyParts3dAdminAssetSlug({
  entityType,
  entitySlug,
  treeName,
  viewSlug,
  partIds,
}: {
  entityType: AnatomyEntityType | string
  entitySlug: string
  treeName: BodyParts3dTreeName
  viewSlug: BodyParts3dViewSlug
  partIds: readonly string[]
}) {
  const partKey = normalizeBodyParts3dPartIds(partIds).sort().join("-").toLowerCase()

  return slugify(`bodyparts3d-admin-${entityType}-${entitySlug}-${treeName}-${viewSlug}-${partKey}-anatomogram`)
}

export function bodyParts3dAdminStoragePath({
  entityType,
  entitySlug,
  treeName,
  viewSlug,
  assetSlug,
}: {
  entityType: AnatomyEntityType | string
  entitySlug: string
  treeName: BodyParts3dTreeName
  viewSlug: BodyParts3dViewSlug
  assetSlug: string
}) {
  return `anatomy/bodyparts3d/admin/${slugify(entityType)}/${slugify(entitySlug)}/${slugify(treeName)}/${slugify(viewSlug)}/${assetSlug}.png`
}

export function normalizeAnatomyMediaRole(value: string | null | undefined): AnatomyMediaRole {
  const normalized = value?.trim().toLowerCase()
  if (normalized === "primary" || normalized === "region_context" || normalized === "game_prompt" || normalized === "client_education") return normalized

  return "reference"
}
