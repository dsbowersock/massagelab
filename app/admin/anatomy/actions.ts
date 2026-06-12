"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import type { AnatomyEntityType, AnatomyMediaReviewStatus, AnatomyMediaRole, AnatomyMediaViewRequestStatus, Prisma } from "@prisma/client"
import { getCurrentSession } from "@/auth"
import { canManageAnatomyContent } from "@/lib/account-permissions"
import { parseAnatomyAdminSourceInput } from "@/lib/anatomy-admin-source-input"
import {
  ANATOMY_MEDIA_REVIEW_REASONS,
  ANATOMY_MEDIA_REVIEW_STATUSES,
  ANATOMY_MEDIA_VIEW_REQUEST_REASONS,
  ANATOMY_MEDIA_VIEW_REQUEST_STATUSES,
  ANATOMY_MEDIA_VIEW_REQUEST_VIEWS,
  BODYPARTS3D_ATTRIBUTION,
  BODYPARTS3D_LICENSE,
  BODYPARTS3D_LICENSE_PAGE,
  BODYPARTS3D_LICENSE_URL,
  BODYPARTS3D_SOURCE_SLUG,
  bodyParts3dAdminAssetSlug,
  bodyParts3dAdminStoragePath,
  bodyParts3dImageUrl,
  bodyParts3dSourceDescriptor,
  bodyParts3dView,
  normalizeAnatomyMediaRole,
  normalizeAnatomyMediaViewRequestReason,
  normalizeAnatomyMediaViewRequestView,
  normalizeBodyParts3dPartIds,
  type BodyParts3dSourceDescriptor,
  type BodyParts3dStoredViewSlug,
  type BodyParts3dTreeName,
  type BodyParts3dView,
} from "@/lib/anatomy-media-review"
import { uploadAnatomyMediaToR2 } from "@/lib/anatomy-media-review-server"
import type { AccountRole, AnatomyDifficulty, AnatomyKind, AnatomyStatus, CorrectionFlagStatus } from "@/lib/domain-types"
import { parseAnatomyEntitySelection } from "@/lib/anatomy-queries"
import { prisma } from "@/lib/prisma"

const VALID_TERM_KINDS = new Set(["SYSTEM", "ORGAN", "TISSUE", "BONE", "MUSCLE", "JOINT", "NERVE", "VESSEL", "LIGAMENT", "TENDON", "CELL", "OTHER"])
const VALID_DIFFICULTIES = new Set(["EASY", "MEDIUM", "HARD"])
const VALID_STATUSES = new Set(["DRAFT", "REVIEW", "PUBLISHED", "ARCHIVED"])
const VALID_FLAG_STATUSES = new Set(["OPEN", "RESOLVED", "REJECTED"])
const VALID_MEDIA_REVIEW_STATUSES = new Set(ANATOMY_MEDIA_REVIEW_STATUSES)
const VALID_MEDIA_REVIEW_REASONS = new Set<string>(ANATOMY_MEDIA_REVIEW_REASONS)
const VALID_MEDIA_VIEW_REQUEST_REASONS = new Set<string>(ANATOMY_MEDIA_VIEW_REQUEST_REASONS)
const VALID_MEDIA_VIEW_REQUEST_STATUSES = new Set<string>(ANATOMY_MEDIA_VIEW_REQUEST_STATUSES)
const VALID_MEDIA_VIEW_REQUEST_VIEWS = new Set<string>(ANATOMY_MEDIA_VIEW_REQUEST_VIEWS)
const VALID_MEDIA_ROLES = new Set(["PRIMARY", "REFERENCE", "REGION_CONTEXT", "GAME_PROMPT", "CLIENT_EDUCATION"])
const VALID_BODYPARTS3D_TREES = new Set(["isa", "partof"])
const VALID_ENTITY_RELATIONSHIP_TYPES = new Set([
  "deep_to",
  "superficial_to",
  "supplies",
  "includes_branch",
  "may_affect_region",
  "overlaps_region",
  "related_to",
])

function formString(formData: FormData, key: string) {
  const value = formData.get(key)
  return typeof value === "string" ? value.trim() : ""
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
}

function csvList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
}

function enumValue<T extends string>(value: string, validValues: Set<string>, fallback: T) {
  const normalized = value.toUpperCase()
  return (validValues.has(normalized) ? normalized : fallback) as T
}

function formNumber(formData: FormData, key: string, fallback: number) {
  const rawValue = formString(formData, key)
  if (!rawValue) return fallback

  const value = Number(rawValue)
  return Number.isFinite(value) ? value : fallback
}

function displayPriorityValue(formData: FormData) {
  return Math.max(0, Math.min(999, Math.trunc(formNumber(formData, "display_priority", 100))))
}

function mediaRoleValue(value: string) {
  const normalized = normalizeAnatomyMediaRole(value).toUpperCase()
  return (VALID_MEDIA_ROLES.has(normalized) ? normalized : "REFERENCE") as AnatomyMediaRole
}

function mediaReviewReasonValue(value: string) {
  const normalized = value.trim().toLowerCase()
  return VALID_MEDIA_REVIEW_REASONS.has(normalized) ? normalized : null
}

function bodyParts3dTreeValue(value: string): BodyParts3dTreeName {
  return VALID_BODYPARTS3D_TREES.has(value) ? value as BodyParts3dTreeName : "isa"
}

function mediaViewRequestViewValue(value: string): BodyParts3dStoredViewSlug {
  const view = normalizeAnatomyMediaViewRequestView(value)

  return VALID_MEDIA_VIEW_REQUEST_VIEWS.has(view) ? view : "custom"
}

function mediaViewRequestReasonValue(value: string) {
  const reason = normalizeAnatomyMediaViewRequestReason(value)

  return VALID_MEDIA_VIEW_REQUEST_REASONS.has(reason) ? reason : "other"
}

function mediaViewRequestStatusValue(value: string): AnatomyMediaViewRequestStatus {
  const normalized = value.trim().toUpperCase()

  return (VALID_MEDIA_VIEW_REQUEST_STATUSES.has(normalized) ? normalized : "OPEN") as AnatomyMediaViewRequestStatus
}

function bodyParts3dStoredViewTitle(viewSlug: BodyParts3dStoredViewSlug) {
  return viewSlug === "custom" ? "Custom View" : bodyParts3dView(viewSlug).title
}

function titleFromSlug(value: string) {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

type BodyParts3dImportSource = {
  sourceUrl: string
  sourceKey?: string
  imageWidth: number
  imageHeight: number
  cameraMode: BodyParts3dSourceDescriptor["cameraMode"]
  cameraParameters: BodyParts3dSourceDescriptor["cameraParameters"]
}

function bodyParts3dImportSource(formData: FormData, partIds: string[], view: BodyParts3dView, treeName: BodyParts3dTreeName): BodyParts3dImportSource {
  const defaultSourceUrl = bodyParts3dImageUrl({ partIds, view, treeName })
  const defaultSource = bodyParts3dSourceDescriptor(defaultSourceUrl)
  const overrideInput = formString(formData, "source_url")
  if (!overrideInput) {
    return {
      sourceUrl: defaultSourceUrl,
      imageWidth: defaultSource?.imageWidth ?? 700,
      imageHeight: defaultSource?.imageHeight ?? 700,
      cameraMode: view.cameraMode,
      cameraParameters: null,
    }
  }

  const override = bodyParts3dSourceDescriptor(overrideInput)
  if (!override) {
    throw new Error("Custom BodyParts3D URL must be a parsable BodyParts3D image or composer URL.")
  }
  if (!sameBodyParts3dPartIds(override.partIds, partIds) || override.treeName !== treeName) {
    throw new Error("Custom BodyParts3D URL parts and tree must match the selected import fields.")
  }
  if (override.cameraMode && override.cameraMode !== view.cameraMode) {
    throw new Error("Custom BodyParts3D URL camera orientation must match the selected preset view.")
  }
  if (!override.cameraMode && !override.cameraParameters) {
    throw new Error("Custom BodyParts3D URL must include camera details. Use the generated image URL or paste an adjusted composer URL.")
  }

  return {
    sourceUrl: override.sourceUrl,
    sourceKey: override.sourceUrl === defaultSourceUrl ? undefined : override.sourceKey,
    imageWidth: override.imageWidth,
    imageHeight: override.imageHeight,
    cameraMode: override.cameraMode,
    cameraParameters: override.cameraParameters,
  }
}

function sameBodyParts3dPartIds(left: readonly string[], right: readonly string[]) {
  const leftKey = normalizeBodyParts3dPartIds(left).sort().join("|")
  const rightKey = normalizeBodyParts3dPartIds(right).sort().join("|")

  return leftKey === rightKey
}

type ImportBodyParts3dMediaForEntityInput = {
  userId: string
  selectedEntity: { entityType: string; entitySlug: string }
  partIds: string[]
  treeName: BodyParts3dTreeName
  viewSlug: BodyParts3dStoredViewSlug
  viewTitle: string
  role: AnatomyMediaRole
  notes: string | null
  displayPriority: number
  importSource: BodyParts3dImportSource
  linkReviewStatus: AnatomyMediaReviewStatus
  sourceKind: string
  extraMetadata?: Prisma.JsonObject
}

/**
 * Uploads one BodyParts3D still and links it to an anatomy item without assuming
 * the link is public-study ready. The asset can be reviewed reusable media while
 * the item-image link remains needs-review for item-specific accuracy.
 */
async function importBodyParts3dMediaForEntity({
  userId,
  selectedEntity,
  partIds,
  treeName,
  viewSlug,
  viewTitle,
  role,
  notes,
  displayPriority,
  importSource,
  linkReviewStatus,
  sourceKind,
  extraMetadata,
}: ImportBodyParts3dMediaForEntityInput) {
  const source = await prisma.anatomySource.findUnique({
    where: { slug: BODYPARTS3D_SOURCE_SLUG },
  })
  if (!source) {
    throw new Error("BodyParts3D source row is required before importing media.")
  }

  const assetSlug = bodyParts3dAdminAssetSlug({
    entityType: selectedEntity.entityType,
    entitySlug: selectedEntity.entitySlug,
    treeName,
    viewSlug,
    partIds,
    sourceKey: importSource.sourceKey,
  })
  const sourceUrl = importSource.sourceUrl
  const storagePath = bodyParts3dAdminStoragePath({
    entityType: selectedEntity.entityType,
    entitySlug: selectedEntity.entitySlug,
    treeName,
    viewSlug,
    assetSlug,
  })
  const upload = await uploadAnatomyMediaToR2({ sourceUrl, storagePath })
  const entityLabel = titleFromSlug(selectedEntity.entitySlug)
  const uploadedAt = new Date()
  const mediaMetadata = {
    sourceKind,
    bodyparts3dPartIds: partIds,
    bodyparts3dTreeName: treeName,
    bodyparts3dView: viewSlug,
    bodyparts3dViewTitle: viewTitle,
    bodyparts3dImageWidth: importSource.imageWidth,
    bodyparts3dImageHeight: importSource.imageHeight,
    bodyparts3dCameraMode: importSource.cameraMode ?? "custom",
    ...(importSource.cameraParameters ? { bodyparts3dCameraParameters: importSource.cameraParameters } : {}),
    ...(importSource.sourceKey ? { bodyparts3dSourceKey: importSource.sourceKey } : {}),
    bodyparts3dSourceUrl: sourceUrl,
    visualStyle: "3d-anatomogram-render",
    anatomogramVersion: "4.1",
    r2Upload: true,
    ingestionStatus: "uploaded_to_r2",
    uploadedById: userId,
    uploadedAt: uploadedAt.toISOString(),
    uploadedBytes: upload.bytes,
    uploadedContentType: upload.contentType,
    ...(extraMetadata ?? {}),
  } satisfies Prisma.JsonObject

  return prisma.$transaction(async (tx) => {
    const asset = await tx.anatomyMediaAsset.upsert({
      where: { slug: assetSlug },
      create: {
        slug: assetSlug,
        title: `BodyParts3D ${entityLabel} ${viewTitle}`,
        mediaType: "IMAGE",
        description: `Curated BodyParts3D ${viewTitle.toLowerCase()} for ${entityLabel}.`,
        sourceId: source.id,
        sourceUrl,
        remoteUrl: upload.remoteUrl ?? null,
        storagePath: upload.storagePath,
        license: BODYPARTS3D_LICENSE,
        licenseUrl: BODYPARTS3D_LICENSE_URL,
        attribution: BODYPARTS3D_ATTRIBUTION,
        usageScope: "OPEN_REUSE",
        reviewStatus: "REVIEWED",
        width: importSource.imageWidth,
        height: importSource.imageHeight,
        format: "png",
        metadata: mediaMetadata,
      },
      update: {
        title: `BodyParts3D ${entityLabel} ${viewTitle}`,
        description: `Curated BodyParts3D ${viewTitle.toLowerCase()} for ${entityLabel}.`,
        sourceId: source.id,
        sourceUrl,
        ...(upload.remoteUrl ? { remoteUrl: upload.remoteUrl } : {}),
        storagePath: upload.storagePath,
        license: BODYPARTS3D_LICENSE,
        licenseUrl: BODYPARTS3D_LICENSE_URL,
        attribution: BODYPARTS3D_ATTRIBUTION,
        usageScope: "OPEN_REUSE",
        reviewStatus: "REVIEWED",
        width: importSource.imageWidth,
        height: importSource.imageHeight,
        format: "png",
        metadata: mediaMetadata,
      },
    })

    const link = await tx.anatomyMediaEntity.upsert({
      where: {
        assetId_entityType_entitySlug_role: {
          assetId: asset.id,
          entityType: selectedEntity.entityType as AnatomyEntityType,
          entitySlug: selectedEntity.entitySlug,
          role,
        },
      },
      create: {
        assetId: asset.id,
        entityType: selectedEntity.entityType as AnatomyEntityType,
        entitySlug: selectedEntity.entitySlug,
        role,
        notes,
        reviewStatus: linkReviewStatus,
        displayPriority,
        ...(linkReviewStatus === "APPROVED" ? { reviewedById: userId, reviewedAt: uploadedAt } : {}),
      },
      update: {
        notes,
        displayPriority,
        ...(linkReviewStatus === "APPROVED" ? {
          reviewStatus: "APPROVED" as AnatomyMediaReviewStatus,
          reviewReason: null,
          reviewedById: userId,
          reviewedAt: uploadedAt,
        } : {}),
      },
    })

    await tx.anatomyCitation.upsert({
      where: { slug: `citation-${assetSlug}-media-source` },
      create: {
        slug: `citation-${assetSlug}-media-source`,
        entityType: selectedEntity.entityType as AnatomyEntityType,
        entitySlug: selectedEntity.entitySlug,
        factType: "media_source",
        factSlug: assetSlug,
        sourceId: source.id,
        sourceLocator: sourceUrl,
        citationNote: "BodyParts3D image imported through anatomy admin media review workflow.",
        reviewStatus: "REVIEWED",
      },
      update: {
        sourceLocator: sourceUrl,
        citationNote: "BodyParts3D image imported through anatomy admin media review workflow.",
        reviewStatus: "REVIEWED",
      },
    })
    await tx.anatomyCitation.upsert({
      where: { slug: `citation-${assetSlug}-media-license` },
      create: {
        slug: `citation-${assetSlug}-media-license`,
        entityType: selectedEntity.entityType as AnatomyEntityType,
        entitySlug: selectedEntity.entitySlug,
        factType: "media_license",
        factSlug: assetSlug,
        sourceId: source.id,
        sourceLocator: BODYPARTS3D_LICENSE_PAGE,
        citationNote: "BodyParts3D image license reviewed as CC BY 4.0 for public study media.",
        reviewStatus: "REVIEWED",
      },
      update: {
        sourceLocator: BODYPARTS3D_LICENSE_PAGE,
        citationNote: "BodyParts3D image license reviewed as CC BY 4.0 for public study media.",
        reviewStatus: "REVIEWED",
      },
    })

    return {
      assetId: asset.id,
      linkId: link.id,
      assetSlug,
    }
  })
}

async function requireEditor() {
  const session = await getCurrentSession()

  if (!session?.user?.id) {
    redirect("/login")
  }

  const roles = await prisma.userRole.findMany({
    where: { userId: session.user.id },
    select: { role: true },
  })
  const roleValues = (roles as Array<{ role: AccountRole }>).map((roleRow) => roleRow.role)

  if (!canManageAnatomyContent(roleValues)) {
    redirect("/account")
  }

  return session.user
}

export async function createAnatomyTermAction(formData: FormData) {
  const user = await requireEditor()
  const preferredName = formString(formData, "preferred_name")
  const slug = slugify(formString(formData, "slug") || preferredName)

  if (!preferredName || !slug) {
    return
  }

  await prisma.anatomyTerm.create({
    data: {
      slug,
      preferredName,
      kind: enumValue<AnatomyKind>(formString(formData, "kind"), VALID_TERM_KINDS, "OTHER"),
      summary: formString(formData, "summary") || null,
      regions: csvList(formString(formData, "regions")),
      bodySystems: csvList(formString(formData, "body_systems")),
      difficulty: enumValue<AnatomyDifficulty>(formString(formData, "difficulty"), VALID_DIFFICULTIES, "MEDIUM"),
      status: enumValue<AnatomyStatus>(formString(formData, "status"), VALID_STATUSES, "DRAFT"),
      createdById: user.id,
      updatedById: user.id,
    },
  })

  revalidatePath("/admin/anatomy")
}

export async function updateAnatomyMediaReviewAction(formData: FormData) {
  const user = await requireEditor()
  const id = formString(formData, "id")

  if (!id) {
    return
  }

  const reviewStatus = enumValue<AnatomyMediaReviewStatus>(
    formString(formData, "review_status"),
    VALID_MEDIA_REVIEW_STATUSES,
    "APPROVED",
  )
  const reviewReason = reviewStatus === "APPROVED" ? null : mediaReviewReasonValue(formString(formData, "review_reason"))

  await prisma.anatomyMediaEntity.update({
    where: { id },
    data: {
      reviewStatus,
      reviewReason,
      reviewNote: formString(formData, "review_note") || null,
      notes: formString(formData, "notes") || null,
      displayPriority: displayPriorityValue(formData),
      reviewedById: user.id,
      reviewedAt: new Date(),
    },
  })

  revalidatePath("/admin/anatomy")
}

export async function linkAnatomyMediaAssetAction(formData: FormData) {
  const user = await requireEditor()
  const selectedEntity = parseAnatomyEntitySelection(formString(formData, "entity_type"), formString(formData, "entity_slug"))
  const assetId = formString(formData, "asset_id")
  const role = mediaRoleValue(formString(formData, "role"))

  if (!selectedEntity || !assetId) {
    return
  }

  await prisma.anatomyMediaEntity.upsert({
    where: {
      assetId_entityType_entitySlug_role: {
        assetId,
        entityType: selectedEntity.entityType as AnatomyEntityType,
        entitySlug: selectedEntity.entitySlug,
        role,
      },
    },
    create: {
      assetId,
      entityType: selectedEntity.entityType as AnatomyEntityType,
      entitySlug: selectedEntity.entitySlug,
      role,
      notes: formString(formData, "notes") || null,
      reviewStatus: "APPROVED",
      displayPriority: displayPriorityValue(formData),
      reviewedById: user.id,
      reviewedAt: new Date(),
    },
    update: {
      notes: formString(formData, "notes") || null,
      reviewStatus: "APPROVED",
      reviewReason: null,
      displayPriority: displayPriorityValue(formData),
      reviewedById: user.id,
      reviewedAt: new Date(),
    },
  })

  revalidatePath("/admin/anatomy")
}

export async function importBodyParts3dMediaAction(formData: FormData) {
  const user = await requireEditor()
  const selectedEntity = parseAnatomyEntitySelection(formString(formData, "entity_type"), formString(formData, "entity_slug"))
  const partIds = normalizeBodyParts3dPartIds(formString(formData, "part_ids"))
  const view = bodyParts3dView(formString(formData, "view"))
  const treeName = bodyParts3dTreeValue(formString(formData, "tree_name"))
  const role = mediaRoleValue(formString(formData, "role"))

  if (!selectedEntity || partIds.length === 0) {
    return
  }

  const importSource = bodyParts3dImportSource(formData, partIds, view, treeName)
  await importBodyParts3dMediaForEntity({
    userId: user.id,
    selectedEntity,
    partIds,
    treeName,
    viewSlug: view.slug,
    viewTitle: view.title,
    role,
    notes: formString(formData, "notes") || null,
    displayPriority: displayPriorityValue(formData),
    importSource,
    linkReviewStatus: "NEEDS_REVIEW",
    sourceKind: "bodyparts3d-admin-curated-image",
    extraMetadata: {
      candidateReason: "manual_admin_import",
    },
  })

  revalidatePath("/admin/anatomy")
}

export async function createAnatomyMediaViewRequestAction(formData: FormData) {
  const user = await requireEditor()
  const selectedEntity = parseAnatomyEntitySelection(formString(formData, "entity_type"), formString(formData, "entity_slug"))
  const requestedView = mediaViewRequestViewValue(formString(formData, "requested_view"))
  const reason = mediaViewRequestReasonValue(formString(formData, "reason"))
  const requestNote = formString(formData, "request_note")
  const sourceUrlInput = formString(formData, "source_url")

  if (!selectedEntity) {
    return
  }

  const sourceDescriptor = sourceUrlInput ? bodyParts3dSourceDescriptor(sourceUrlInput) : null
  if (sourceUrlInput && !sourceDescriptor) {
    throw new Error("View request import URL must be a parsable BodyParts3D image or composer URL.")
  }

  const request = await prisma.anatomyMediaViewRequest.create({
    data: {
      entityType: selectedEntity.entityType as AnatomyEntityType,
      entitySlug: selectedEntity.entitySlug,
      requestedView,
      reason,
      requestNote: requestNote || null,
      sourceUrl: sourceDescriptor?.sourceUrl ?? (sourceUrlInput || null),
      status: "OPEN",
      createdById: user.id,
    },
  })

  if (sourceDescriptor) {
    const viewTitle = bodyParts3dStoredViewTitle(requestedView)
    const importResult = await importBodyParts3dMediaForEntity({
      userId: user.id,
      selectedEntity,
      partIds: sourceDescriptor.partIds,
      treeName: sourceDescriptor.treeName,
      viewSlug: requestedView,
      viewTitle,
      role: mediaRoleValue(formString(formData, "role")),
      notes: requestNote || `Requested ${viewTitle.toLowerCase()} candidate: ${reason}`,
      displayPriority: displayPriorityValue(formData),
      importSource: {
        sourceUrl: sourceDescriptor.sourceUrl,
        sourceKey: sourceDescriptor.sourceKey,
        imageWidth: sourceDescriptor.imageWidth,
        imageHeight: sourceDescriptor.imageHeight,
        cameraMode: sourceDescriptor.cameraMode,
        cameraParameters: sourceDescriptor.cameraParameters,
      },
      linkReviewStatus: "NEEDS_REVIEW",
      sourceKind: "bodyparts3d-admin-requested-image",
      extraMetadata: {
        candidateReason: reason,
        mediaViewRequestId: request.id,
      },
    })

    await prisma.anatomyMediaViewRequest.update({
      where: { id: request.id },
      data: {
        status: "IMPORTED",
        importedAssetId: importResult.assetId,
        importedLinkId: importResult.linkId,
        resolvedById: user.id,
        resolvedAt: new Date(),
      },
    })
  }

  revalidatePath("/admin/anatomy")
}

export async function updateAnatomyMediaViewRequestAction(formData: FormData) {
  const user = await requireEditor()
  const id = formString(formData, "id")
  const status = mediaViewRequestStatusValue(formString(formData, "status"))

  if (!id) {
    return
  }

  await prisma.anatomyMediaViewRequest.update({
    where: { id },
    data: {
      status,
      ...(status === "OPEN" ? { resolvedById: null, resolvedAt: null } : { resolvedById: user.id, resolvedAt: new Date() }),
    },
  })

  revalidatePath("/admin/anatomy")
}

export async function updateAnatomyTermAction(formData: FormData) {
  const user = await requireEditor()
  const id = formString(formData, "id")

  if (!id) {
    return
  }

  await prisma.anatomyTerm.update({
    where: { id },
    data: {
      preferredName: formString(formData, "preferred_name"),
      summary: formString(formData, "summary") || null,
      regions: csvList(formString(formData, "regions")),
      bodySystems: csvList(formString(formData, "body_systems")),
      difficulty: enumValue<AnatomyDifficulty>(formString(formData, "difficulty"), VALID_DIFFICULTIES, "MEDIUM"),
      status: enumValue<AnatomyStatus>(formString(formData, "status"), VALID_STATUSES, "DRAFT"),
      updatedById: user.id,
    },
  })

  revalidatePath("/admin/anatomy")
}

export async function createAnatomyAliasAction(formData: FormData) {
  await requireEditor()
  const termId = formString(formData, "term_id")
  const alias = formString(formData, "alias")

  if (!termId || !alias) {
    return
  }

  await prisma.anatomyAlias.create({
    data: {
      termId,
      alias,
    },
  })

  revalidatePath("/admin/anatomy")
}

export async function createAnatomyRelationshipAction(formData: FormData) {
  await requireEditor()
  const sourceTermId = formString(formData, "source_term_id")
  const targetTermId = formString(formData, "target_term_id")
  const relationshipType = slugify(formString(formData, "relationship_type"))

  if (!sourceTermId || !targetTermId || !relationshipType) {
    return
  }

  await prisma.anatomyRelationship.create({
    data: {
      sourceTermId,
      targetTermId,
      relationshipType,
    },
  })

  revalidatePath("/admin/anatomy")
}

export async function createAnatomyEntityRelationshipAction(formData: FormData) {
  await requireEditor()
  const source = parseAnatomyEntitySelection(formString(formData, "source_entity_type"), formString(formData, "source_entity_slug"))
  const targetInput = formString(formData, "target_entity")
  const [targetInputType, targetInputSlug] = targetInput.split(":", 2)
  const target = parseAnatomyEntitySelection(
    formString(formData, "target_entity_type") || targetInputType,
    formString(formData, "target_entity_slug") || targetInputSlug,
  )
  const relationshipType = formString(formData, "relationship_type").toLowerCase()
  const sourceId = formString(formData, "source_id")

  if (!source || !target || !VALID_ENTITY_RELATIONSHIP_TYPES.has(relationshipType)) {
    return
  }

  await prisma.anatomyRelationship.upsert({
    where: {
      sourceEntityType_sourceEntitySlug_relationshipType_targetEntityType_targetEntitySlug: {
        sourceEntityType: source.entityType,
        sourceEntitySlug: source.entitySlug,
        relationshipType,
        targetEntityType: target.entityType,
        targetEntitySlug: target.entitySlug,
      },
    },
    create: {
      sourceEntityType: source.entityType,
      sourceEntitySlug: source.entitySlug,
      relationshipType,
      targetEntityType: target.entityType,
      targetEntitySlug: target.entitySlug,
      sourceId: sourceId || null,
    },
    update: {
      sourceId: sourceId || null,
    },
  })

  revalidatePath("/admin/anatomy")
}

export async function createAnatomySourceAction(formData: FormData) {
  await requireEditor()
  const sourceInput = parseAnatomyAdminSourceInput(formData)

  if (!sourceInput) {
    return
  }

  await prisma.anatomySource.create({
    data: {
      slug: sourceInput.slug,
      label: sourceInput.label,
      url: sourceInput.url,
      license: sourceInput.license,
      licenseUrl: sourceInput.licenseUrl,
      usageScope: sourceInput.usageScope,
      accessedAt: sourceInput.accessedAt,
      notes: sourceInput.notes,
      attribution: sourceInput.attribution,
    },
  })

  revalidatePath("/admin/anatomy")
}

export async function updateCorrectionFlagAction(formData: FormData) {
  const user = await requireEditor()
  const id = formString(formData, "id")

  if (!id) {
    return
  }

  await prisma.anatomyCorrectionFlag.update({
    where: { id },
    data: {
      status: enumValue<CorrectionFlagStatus>(formString(formData, "status"), VALID_FLAG_STATUSES, "OPEN"),
      resolutionNote: formString(formData, "resolution_note") || null,
      reviewedById: user.id,
      reviewedAt: new Date(),
    },
  })

  revalidatePath("/admin/anatomy")
}
