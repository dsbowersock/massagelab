import { revalidatePath } from "next/cache"
import { NextResponse } from "next/server"
import type { AnatomyEntityType, AnatomyMediaRole } from "@prisma/client"
import { getCurrentSession } from "@/auth"
import { loadAnatomyReviewerActor } from "@/lib/admin/access"
import { ANATOMY_MEDIA_REVIEW_REASONS, normalizeAnatomyMediaRole } from "@/lib/anatomy-media-review"
import { buildAnatomyEntityHref, parseAnatomyEntitySelection } from "@/lib/anatomy-queries"
import { prisma } from "@/lib/prisma"

const VALID_REVIEW_REASONS = new Set<string>(ANATOMY_MEDIA_REVIEW_REASONS)

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : ""
}

function mediaRole(value: string) {
  return normalizeAnatomyMediaRole(value).toUpperCase() as AnatomyMediaRole
}

function reviewReason(value: string) {
  const normalized = value.trim().toLowerCase()
  return VALID_REVIEW_REASONS.has(normalized) ? normalized : "other"
}

async function loadMediaFlagReviewer() {
  const session = await getCurrentSession()
  return loadAnatomyReviewerActor({
    prismaClient: prisma,
    sessionUserId: session?.user?.id ?? null,
  })
}

export async function POST(request: Request) {
  const actor = await loadMediaFlagReviewer()
  if (!actor) {
    return NextResponse.json({ error: "Anatomy media review requires verified review access." }, { status: 403 })
  }

  const payload = await request.json().catch(() => null)
  const record = payload && typeof payload === "object" && !Array.isArray(payload)
    ? payload as Record<string, unknown>
    : {}
  const selectedEntity = parseAnatomyEntitySelection(text(record.entityType), text(record.entitySlug))
  const mediaSlug = text(record.mediaSlug) || text(record.mediaId)

  if (!selectedEntity || !mediaSlug) {
    return NextResponse.json({ error: "Entity and media slug are required." }, { status: 400 })
  }

  const asset = await prisma.anatomyMediaAsset.findUnique({
    where: { slug: mediaSlug },
    select: { id: true },
  })
  if (!asset) {
    return NextResponse.json({ error: "Media asset was not found." }, { status: 404 })
  }

  const role = mediaRole(text(record.role))

  await prisma.anatomyMediaEntity.upsert({
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
      reviewStatus: "REJECTED",
      reviewReason: reviewReason(text(record.reason)),
      reviewNote: text(record.note) || null,
      displayPriority: 999,
      reviewedById: actor.id,
      reviewedAt: new Date(),
    },
    update: {
      reviewStatus: "REJECTED",
      reviewReason: reviewReason(text(record.reason)),
      reviewNote: text(record.note) || null,
      displayPriority: 999,
      reviewedById: actor.id,
      reviewedAt: new Date(),
    },
  })

  revalidatePath("/admin/anatomy")

  return NextResponse.json({
    ok: true,
    adminHref: buildAnatomyEntityHref({
      entityType: selectedEntity.entityType,
      entitySlug: selectedEntity.entitySlug,
    }),
  })
}
