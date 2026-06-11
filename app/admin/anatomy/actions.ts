"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import type { AnatomyEntityType, AnatomyMediaReviewStatus, AnatomyMediaRole, Prisma } from "@prisma/client"
import { getCurrentSession } from "@/auth"
import { canManageAnatomyContent } from "@/lib/account-permissions"
import { parseAnatomyAdminSourceInput } from "@/lib/anatomy-admin-source-input"
import {
  ANATOMY_MEDIA_REVIEW_REASONS,
  ANATOMY_MEDIA_REVIEW_STATUSES,
  BODYPARTS3D_ATTRIBUTION,
  BODYPARTS3D_LICENSE,
  BODYPARTS3D_LICENSE_PAGE,
  BODYPARTS3D_LICENSE_URL,
  BODYPARTS3D_SOURCE_SLUG,
  bodyParts3dAdminAssetSlug,
  bodyParts3dAdminStoragePath,
  bodyParts3dImageUrl,
  bodyParts3dView,
  normalizeAnatomyMediaRole,
  normalizeBodyParts3dPartIds,
  safeBodyParts3dImageUrl,
  type BodyParts3dTreeName,
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

function titleFromSlug(value: string) {
  return value
    .split("-")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
}

function bodyParts3dSourceUrl(formData: FormData, partIds: string[], viewSlug: string, treeName: BodyParts3dTreeName) {
  const overrideUrl = safeBodyParts3dImageUrl(formString(formData, "source_url"))
  if (overrideUrl) return overrideUrl

  return bodyParts3dImageUrl({
    partIds,
    view: bodyParts3dView(viewSlug),
    treeName,
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
    viewSlug: view.slug,
    partIds,
  })
  const sourceUrl = bodyParts3dSourceUrl(formData, partIds, view.slug, treeName)
  const storagePath = bodyParts3dAdminStoragePath({
    entityType: selectedEntity.entityType,
    entitySlug: selectedEntity.entitySlug,
    treeName,
    viewSlug: view.slug,
    assetSlug,
  })
  const upload = await uploadAnatomyMediaToR2({ sourceUrl, storagePath })
  const entityLabel = titleFromSlug(selectedEntity.entitySlug)
  const uploadedAt = new Date()
  const mediaMetadata = {
    sourceKind: "bodyparts3d-admin-curated-image",
    bodyparts3dPartIds: partIds,
    bodyparts3dTreeName: treeName,
    bodyparts3dView: view.slug,
    bodyparts3dViewTitle: view.title,
    bodyparts3dCameraMode: view.cameraMode,
    visualStyle: "3d-anatomogram-render",
    anatomogramVersion: "4.1",
    r2Upload: true,
    ingestionStatus: "uploaded_to_r2",
    uploadedById: user.id,
    uploadedAt: uploadedAt.toISOString(),
    uploadedBytes: upload.bytes,
    uploadedContentType: upload.contentType,
  } satisfies Prisma.JsonObject

  await prisma.$transaction(async (tx) => {
    const asset = await tx.anatomyMediaAsset.upsert({
      where: { slug: assetSlug },
      create: {
        slug: assetSlug,
        title: `BodyParts3D ${entityLabel} ${view.title}`,
        mediaType: "IMAGE",
        description: `Curated BodyParts3D ${view.title.toLowerCase()} for ${entityLabel}.`,
        sourceId: source.id,
        sourceUrl,
        remoteUrl: upload.remoteUrl ?? null,
        storagePath: upload.storagePath,
        license: BODYPARTS3D_LICENSE,
        licenseUrl: BODYPARTS3D_LICENSE_URL,
        attribution: BODYPARTS3D_ATTRIBUTION,
        usageScope: "OPEN_REUSE",
        reviewStatus: "REVIEWED",
        width: 700,
        height: 700,
        format: "png",
        metadata: mediaMetadata,
      },
      update: {
        title: `BodyParts3D ${entityLabel} ${view.title}`,
        description: `Curated BodyParts3D ${view.title.toLowerCase()} for ${entityLabel}.`,
        sourceId: source.id,
        sourceUrl,
        ...(upload.remoteUrl ? { remoteUrl: upload.remoteUrl } : {}),
        storagePath: upload.storagePath,
        license: BODYPARTS3D_LICENSE,
        licenseUrl: BODYPARTS3D_LICENSE_URL,
        attribution: BODYPARTS3D_ATTRIBUTION,
        usageScope: "OPEN_REUSE",
        reviewStatus: "REVIEWED",
        width: 700,
        height: 700,
        format: "png",
        metadata: mediaMetadata,
      },
    })

    await tx.anatomyMediaEntity.upsert({
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
        notes: formString(formData, "notes") || null,
        reviewStatus: "APPROVED",
        displayPriority: displayPriorityValue(formData),
        reviewedById: user.id,
        reviewedAt: uploadedAt,
      },
      update: {
        notes: formString(formData, "notes") || null,
        reviewStatus: "APPROVED",
        reviewReason: null,
        displayPriority: displayPriorityValue(formData),
        reviewedById: user.id,
        reviewedAt: uploadedAt,
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
