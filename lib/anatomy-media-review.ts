import type { AnatomyEntityType, AnatomyMediaRole } from "./anatomy-foundation"
import type { AnatomyMediaReviewStatus } from "./domain-types"

export type BodyParts3dViewSlug = "anterior" | "posterior" | "left-lateral" | "right-lateral" | "superior" | "inferior" | "transverse"
export type BodyParts3dStoredViewSlug = BodyParts3dViewSlug | "custom"
export type BodyParts3dTreeName = "isa" | "partof"
export type BodyParts3dCameraMode = "front" | "back" | "left" | "right" | "top" | "bottom"

export type BodyParts3dView = {
  slug: BodyParts3dViewSlug
  title: string
  cameraMode: BodyParts3dCameraMode
}

export type BodyParts3dSourceDescriptor = {
  sourceUrl: string
  partIds: string[]
  treeName: BodyParts3dTreeName
  imageWidth: number
  imageHeight: number
  cameraMode: BodyParts3dCameraMode | null
  cameraParameters: Record<string, number> | null
  sourceKey: string
}

export type AnatomyMediaCoverageStatus = "APPROVED" | "NEEDS_REVIEW" | "REJECTED" | "MISSING"

export type AnatomyMediaCoverageRow = {
  viewSlug: BodyParts3dStoredViewSlug
  title: string
  status: AnatomyMediaCoverageStatus
}

export const ANATOMY_MEDIA_REVIEW_STATUSES: AnatomyMediaReviewStatus[] = ["APPROVED", "NEEDS_REVIEW", "REJECTED"]

export const ANATOMY_MEDIA_REVIEW_REASONS = [
  "bad_match",
  "bad_view",
  "too_tight",
  "too_broad",
  "too_unclear",
  "duplicate",
  "other",
] as const

export const ANATOMY_MEDIA_VIEW_REQUEST_VIEWS: BodyParts3dStoredViewSlug[] = [
  "anterior",
  "posterior",
  "left-lateral",
  "right-lateral",
  "superior",
  "inferior",
  "transverse",
  "custom",
]

export const ANATOMY_MEDIA_VIEW_REQUEST_REASONS = [
  "missing_view",
  "too_tight",
  "bad_match",
  "bad_view",
  "custom_angle",
  "other",
] as const

export const ANATOMY_MEDIA_VIEW_REQUEST_STATUSES = ["OPEN", "IMPORTED", "DISMISSED"] as const

export const BODYPARTS3D_SOURCE_SLUG = "bodyparts3d"
export const BODYPARTS3D_LICENSE = "CC BY 4.0"
export const BODYPARTS3D_LICENSE_URL = "https://creativecommons.org/licenses/by/4.0/"
export const BODYPARTS3D_LICENSE_PAGE = "https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html"
export const BODYPARTS3D_ATTRIBUTION = "BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International."
export const BODYPARTS3D_SKELETON_BACKGROUND_ID = "FMA5018"
export const BODYPARTS3D_COMPOSER_URL = "https://lifesciencedb.jp/bp3d/"
export const BODYPARTS3D_IMAGE_API_URL = "https://lifesciencedb.jp/bp3d/API/image"

export const BODYPARTS3D_VIEWS: BodyParts3dView[] = [
  { slug: "anterior", title: "Anterior View", cameraMode: "front" },
  { slug: "posterior", title: "Posterior View", cameraMode: "back" },
  { slug: "left-lateral", title: "Left Lateral View", cameraMode: "left" },
  { slug: "right-lateral", title: "Right Lateral View", cameraMode: "right" },
  { slug: "superior", title: "Superior View", cameraMode: "top" },
  { slug: "inferior", title: "Inferior View", cameraMode: "bottom" },
  // BodyParts3D has no native transverse slice preset; top is the closest starting orientation.
  { slug: "transverse", title: "Transverse View", cameraMode: "top" },
]

export const ANATOMY_MEDIA_COVERAGE_VIEWS: AnatomyMediaCoverageRow[] = [
  ...BODYPARTS3D_VIEWS.map((view) => ({
    viewSlug: view.slug,
    title: view.title,
    status: "MISSING" as const,
  })),
  { viewSlug: "custom", title: "Custom View", status: "MISSING" },
]

const BODY_PARTS_3D_VIEW_BY_SLUG = new Map(BODYPARTS3D_VIEWS.map((view) => [view.slug, view]))

export function bodyParts3dView(value: string | null | undefined): BodyParts3dView {
  return BODY_PARTS_3D_VIEW_BY_SLUG.get(value as BodyParts3dViewSlug) ?? BODYPARTS3D_VIEWS[0]
}

export function normalizeAnatomyMediaViewRequestView(value: string | null | undefined): BodyParts3dStoredViewSlug {
  const normalized = value?.trim().toLowerCase()

  return normalized && ANATOMY_MEDIA_VIEW_REQUEST_VIEWS.includes(normalized as BodyParts3dStoredViewSlug)
    ? normalized as BodyParts3dStoredViewSlug
    : "custom"
}

export function normalizeAnatomyMediaViewRequestReason(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase()

  return normalized && ANATOMY_MEDIA_VIEW_REQUEST_REASONS.includes(normalized as typeof ANATOMY_MEDIA_VIEW_REQUEST_REASONS[number])
    ? normalized
    : "other"
}

/**
 * Computes the per-view review status shown in the anatomy admin media panel.
 * Link status wins over asset status because one image can be approved for one item
 * and rejected for another.
 */
export function anatomyMediaCoverageForLinks(rows: Array<{ asset: unknown; link: unknown }>): AnatomyMediaCoverageRow[] {
  const coverage = new Map<BodyParts3dStoredViewSlug, AnatomyMediaCoverageStatus>(
    ANATOMY_MEDIA_COVERAGE_VIEWS.map((row) => [row.viewSlug, row.status]),
  )

  for (const row of rows) {
    const metadata = bodyParts3dRecord(bodyParts3dRecord(row.asset).metadata)
    const viewValue = bodyParts3dString(metadata.bodyparts3dView)
    if (!viewValue) continue

    const view = normalizeAnatomyMediaViewRequestView(viewValue)
    const status = anatomyMediaCoverageStatus(bodyParts3dString(bodyParts3dRecord(row.link).reviewStatus))
    const existing = coverage.get(view) ?? "MISSING"

    if (anatomyMediaCoverageRank(status) < anatomyMediaCoverageRank(existing)) {
      coverage.set(view, status)
    }
  }

  return ANATOMY_MEDIA_COVERAGE_VIEWS.map((row) => ({
    ...row,
    status: coverage.get(row.viewSlug) ?? "MISSING",
  }))
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

export function safeBodyParts3dRenderableImageUrl(value: string | null | undefined) {
  const imageUrl = safeBodyParts3dImageUrl(value)
  if (imageUrl) return imageUrl

  return bodyParts3dImageUrlFromComposerUrl(value)
}

export function bodyParts3dSourceDescriptor(value: string | null | undefined): BodyParts3dSourceDescriptor | null {
  const imageUrl = safeBodyParts3dImageUrl(value)
  if (imageUrl) {
    const imageConfig = bodyParts3dImageConfigFromApiUrl(imageUrl)
    return imageConfig ? bodyParts3dSourceDescriptorFromConfig(imageUrl, imageConfig) : null
  }

  const composerConfig = bodyParts3dImageConfigFromComposerUrl(value)
  if (!composerConfig) return null

  const sourceUrl = bodyParts3dImageUrlFromConfig(composerConfig)
  return bodyParts3dSourceDescriptorFromConfig(sourceUrl, composerConfig)
}

export function bodyParts3dComposerUrl({
  partIds,
  treeName = "isa",
  size = 700,
}: {
  partIds: readonly string[]
  treeName?: BodyParts3dTreeName
  size?: number
}) {
  const normalizedPartIds = normalizeBodyParts3dPartIds(partIds)
  const imageSize = bodyParts3dImageSize(size)
  const mapParams = new URLSearchParams({
    av: "09051901",
    model: "bp3d",
    bv: "4.1",
    tn: treeName,
    iw: String(imageSize),
    ih: String(imageSize),
    bcl: "FFFFFF",
    bga: "100",
  })

  normalizedPartIds.forEach((partId, index) => {
    const suffix = String(index + 1).padStart(3, "0")
    mapParams.set(`oid${suffix}`, partId)
    mapParams.set(`ocl${suffix}`, "D83A3A")
    mapParams.set(`oop${suffix}`, "1")
    mapParams.set(`orp${suffix}`, "surface")
    mapParams.set(`osz${suffix}`, "Z")
  })

  const composerUrl = new URL(BODYPARTS3D_COMPOSER_URL)
  composerUrl.searchParams.set("lng", "en")
  composerUrl.searchParams.set("tp_ap", mapParams.toString())

  return composerUrl.toString()
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
  const imageSize = bodyParts3dImageSize(size)
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

function bodyParts3dImageUrlFromComposerUrl(value: string | null | undefined) {
  const config = bodyParts3dImageConfigFromComposerUrl(value)

  return config ? bodyParts3dImageUrlFromConfig(config) : ""
}

function bodyParts3dImageConfigFromApiUrl(value: string | null | undefined) {
  try {
    const imageUrl = safeBodyParts3dImageUrl(value)
    if (!imageUrl) return null

    const url = new URL(imageUrl)
    const config = JSON.parse(decodeURIComponent(url.search.slice(1)))

    return bodyParts3dRecord(config)
  } catch {
    return null
  }
}

function bodyParts3dImageConfigFromComposerUrl(value: string | null | undefined) {
  const trimmed = value?.trim()
  if (!trimmed) return null

  try {
    const url = new URL(trimmed)
    if (url.protocol !== "https:") return null
    if (url.hostname !== "lifesciencedb.jp") return null
    if (!["/bp3d", "/bp3d/", "/bp3d/index.html", "/bp3d/location.html"].includes(url.pathname)) return null

    const mapConfig = url.searchParams.get("tp_ap")
    if (!mapConfig) return null

    return bodyParts3dImageConfigFromMapParams(new URLSearchParams(mapConfig))
  } catch {
    return null
  }
}

function bodyParts3dImageUrlFromConfig(config: Record<string, unknown>) {
  return `${BODYPARTS3D_IMAGE_API_URL}?${encodeURIComponent(JSON.stringify(config))}`
}

function bodyParts3dImageConfigFromMapParams(mapParams: URLSearchParams) {
  const parts = bodyParts3dPartsFromMapParams(mapParams)
  if (parts.length === 0) return null

  const camera = bodyParts3dCameraFromMapParams(mapParams)
  const config: Record<string, unknown> = {
    Common: {
      Version: mapParams.get("bv") || "4.1",
      TreeName: mapParams.get("tn") === "partof" ? "partof" : "isa",
    },
    Window: {
      ImageWidth: bodyParts3dImageSize(mapParams.get("iw"), 500),
      ImageHeight: bodyParts3dImageSize(mapParams.get("ih"), 500),
    },
    Part: parts,
  }

  if (camera) {
    config.Camera = camera
  }

  return config
}

function bodyParts3dPartsFromMapParams(mapParams: URLSearchParams) {
  const parts: Array<Record<string, unknown>> = []

  for (let index = 1; index <= 999; index += 1) {
    const suffix = String(index).padStart(3, "0")
    const partId = normalizeBodyParts3dPartIds(mapParams.get(`oid${suffix}`) ?? "")[0]
    const partName = mapParams.get(`onm${suffix}`)?.trim()

    if (!partId && !partName) continue

    const part: Record<string, unknown> = partId ? { PartID: partId } : { PartName: partName }
    const color = normalizedBodyParts3dColor(mapParams.get(`ocl${suffix}`))
    const opacity = bodyParts3dNumber(mapParams.get(`oop${suffix}`))
    const representation = mapParams.get(`orp${suffix}`)?.trim()
    const visibility = mapParams.get(`osz${suffix}`)

    if (color) part.PartColor = color
    if (Number.isFinite(opacity)) part.PartOpacity = opacity
    if (representation) part.PartRepresentation = representation
    if (visibility === "Z") part.UseForBoundingBoxFlag = true
    if (visibility === "H") part.PartDeleteFlag = true

    parts.push(part)
  }

  return parts
}

function bodyParts3dCameraFromMapParams(mapParams: URLSearchParams) {
  const cameraEntries = [
    ["cx", "CameraX"],
    ["cy", "CameraY"],
    ["cz", "CameraZ"],
    ["tx", "TargetX"],
    ["ty", "TargetY"],
    ["tz", "TargetZ"],
    ["ux", "CameraUpVectorX"],
    ["uy", "CameraUpVectorY"],
    ["uz", "CameraUpVectorZ"],
  ] as const
  const camera: Record<string, number> = {}

  for (const [mapKey, cameraKey] of cameraEntries) {
    const value = bodyParts3dNumber(mapParams.get(mapKey))
    if (Number.isFinite(value)) {
      camera[cameraKey] = value
    }
  }

  const zoom = bodyParts3dNumber(mapParams.get("zm"))
  if (Number.isFinite(zoom)) {
    camera.Zoom = zoom * 5
  }

  return Object.keys(camera).length > 0 ? camera : null
}

function bodyParts3dSourceDescriptorFromConfig(sourceUrl: string, config: Record<string, unknown>): BodyParts3dSourceDescriptor | null {
  const common = bodyParts3dRecord(config.Common)
  const windowConfig = bodyParts3dRecord(config.Window)
  const camera = bodyParts3dRecord(config.Camera)
  const partRows = Array.isArray(config.Part) ? config.Part.map((part) => bodyParts3dRecord(part)) : []
  const partIds = normalizeBodyParts3dPartIds(partRows.map((part) => bodyParts3dString(part.PartID)))
    .filter((partId) => partId !== BODYPARTS3D_SKELETON_BACKGROUND_ID)
  const treeName = common.TreeName === "partof" ? "partof" : "isa"
  const imageWidth = bodyParts3dImageSize(bodyParts3dString(windowConfig.ImageWidth), 500)
  const imageHeight = bodyParts3dImageSize(bodyParts3dString(windowConfig.ImageHeight), 500)
  const cameraMode = bodyParts3dCameraMode(camera.CameraMode)
  const cameraParameters = bodyParts3dCameraParameters(camera)

  if (partIds.length === 0) return null

  return {
    sourceUrl,
    partIds,
    treeName,
    imageWidth,
    imageHeight,
    cameraMode,
    cameraParameters,
    sourceKey: bodyParts3dSourceKey({ partIds, treeName, imageWidth, imageHeight, cameraMode, cameraParameters }),
  }
}

function bodyParts3dSourceKey({
  partIds,
  treeName,
  imageWidth,
  imageHeight,
  cameraMode,
  cameraParameters,
}: {
  partIds: readonly string[]
  treeName: BodyParts3dTreeName
  imageWidth: number
  imageHeight: number
  cameraMode: BodyParts3dCameraMode | null
  cameraParameters: Record<string, number> | null
}) {
  const payload = JSON.stringify({
    partIds: [...partIds].sort(),
    treeName,
    imageWidth,
    imageHeight,
    cameraMode,
    cameraParameters,
  })
  let hash = 2166136261

  for (let index = 0; index < payload.length; index += 1) {
    hash ^= payload.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return `src-${(hash >>> 0).toString(36)}`
}

function bodyParts3dCameraMode(value: unknown): BodyParts3dCameraMode | null {
  return value === "front" ||
    value === "back" ||
    value === "left" ||
    value === "right" ||
    value === "top" ||
    value === "bottom"
    ? value
    : null
}

function bodyParts3dCameraParameters(camera: Record<string, unknown>) {
  const parameterKeys = [
    "CameraX",
    "CameraY",
    "CameraZ",
    "TargetX",
    "TargetY",
    "TargetZ",
    "CameraUpVectorX",
    "CameraUpVectorY",
    "CameraUpVectorZ",
    "Zoom",
  ]
  const parameters: Record<string, number> = {}

  for (const key of parameterKeys) {
    const value = bodyParts3dNumber(bodyParts3dString(camera[key]))
    if (Number.isFinite(value)) {
      parameters[key] = value
    }
  }

  return Object.keys(parameters).length > 0 ? parameters : null
}

function bodyParts3dImageSize(value: string | number | null | undefined, fallback = 700) {
  const numericValue = Number(value)
  const size = Number.isFinite(numericValue) ? numericValue : fallback

  return Math.min(Math.max(Math.trunc(size), 300), 1200)
}

function bodyParts3dNumber(value: string | null | undefined) {
  if (!value) return Number.NaN

  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : Number.NaN
}

function normalizedBodyParts3dColor(value: string | null | undefined) {
  const color = value?.trim().replace(/^#/, "").toUpperCase()

  return color && /^[0-9A-F]{6}$/.test(color) ? color : ""
}

function bodyParts3dRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function bodyParts3dString(value: unknown) {
  return value === null || value === undefined ? "" : String(value)
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

function anatomyMediaCoverageStatus(value: string): AnatomyMediaCoverageStatus {
  const normalized = value.trim().toUpperCase()

  if (normalized === "APPROVED" || normalized === "NEEDS_REVIEW" || normalized === "REJECTED") {
    return normalized
  }

  return "MISSING"
}

function anatomyMediaCoverageRank(status: AnatomyMediaCoverageStatus) {
  switch (status) {
    case "APPROVED":
      return 0
    case "NEEDS_REVIEW":
      return 1
    case "REJECTED":
      return 2
    case "MISSING":
    default:
      return 3
  }
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
  sourceKey,
}: {
  entityType: AnatomyEntityType | string
  entitySlug: string
  treeName: BodyParts3dTreeName
  viewSlug: BodyParts3dStoredViewSlug | string
  partIds: readonly string[]
  sourceKey?: string
}) {
  const partKey = normalizeBodyParts3dPartIds(partIds).sort().join("-").toLowerCase()
  const sourceKeySuffix = sourceKey ? `-${slugify(sourceKey)}` : ""

  return slugify(`bodyparts3d-admin-${entityType}-${entitySlug}-${treeName}-${viewSlug}-${partKey}${sourceKeySuffix}-anatomogram`)
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
  viewSlug: BodyParts3dStoredViewSlug | string
  assetSlug: string
}) {
  return `anatomy/bodyparts3d/admin/${slugify(entityType)}/${slugify(entitySlug)}/${slugify(treeName)}/${slugify(viewSlug)}/${assetSlug}.png`
}

export function normalizeAnatomyMediaRole(value: string | null | undefined): AnatomyMediaRole {
  const normalized = value?.trim().toLowerCase()
  if (normalized === "primary" || normalized === "region_context" || normalized === "game_prompt" || normalized === "client_education") return normalized

  return "reference"
}
