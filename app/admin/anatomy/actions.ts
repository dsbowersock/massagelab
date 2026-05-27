"use server"

import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"
import { getCurrentSession } from "@/auth"
import { canManageAnatomyContent } from "@/lib/account-permissions"
import { parseAnatomyAdminSourceInput } from "@/lib/anatomy-admin-source-input"
import type { AccountRole, AnatomyDifficulty, AnatomyKind, AnatomyStatus, CorrectionFlagStatus } from "@/lib/domain-types"
import { parseAnatomyEntitySelection } from "@/lib/anatomy-queries"
import { prisma } from "@/lib/prisma"

const VALID_TERM_KINDS = new Set(["SYSTEM", "ORGAN", "TISSUE", "BONE", "MUSCLE", "JOINT", "NERVE", "VESSEL", "LIGAMENT", "TENDON", "CELL", "OTHER"])
const VALID_DIFFICULTIES = new Set(["EASY", "MEDIUM", "HARD"])
const VALID_STATUSES = new Set(["DRAFT", "REVIEW", "PUBLISHED", "ARCHIVED"])
const VALID_FLAG_STATUSES = new Set(["OPEN", "RESOLVED", "REJECTED"])
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
