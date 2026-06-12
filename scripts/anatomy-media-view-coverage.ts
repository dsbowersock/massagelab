import { PrismaClient, type AnatomyEntityType, type AnatomyMediaRole, type Prisma } from "@prisma/client"
import { PrismaNeon } from "@prisma/adapter-neon"
import { neonConfig } from "@neondatabase/serverless"
import { config } from "dotenv"
import ws from "ws"
import {
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
  normalizeBodyParts3dPartIds,
  type BodyParts3dTreeName,
  type BodyParts3dViewSlug,
} from "../lib/anatomy-media-review.ts"
import { uploadAnatomyMediaToR2 } from "../lib/anatomy-media-review-server.ts"

config({ path: ".env.local" })
config()

neonConfig.webSocketConstructor = ws

type Command = "status" | "import"

type EligibleBodyParts3dItem = {
  entityType: AnatomyEntityType
  entitySlug: string
  partIds: string[]
  treeName: BodyParts3dTreeName
}

const COVERAGE_VIEWS: BodyParts3dViewSlug[] = ["superior", "inferior"]
const CANDIDATE_ROLE: AnatomyMediaRole = "REFERENCE"

function databaseUrl() {
  const value = process.env.DATABASE_URL?.trim()
  if (!value) throw new Error("DATABASE_URL is required for anatomy media view coverage.")

  return value
}

const prisma = new PrismaClient({
  adapter: new PrismaNeon({ connectionString: databaseUrl() }),
})

function commandFromArg(value: string | undefined): Command {
  return value === "import" ? "import" : "status"
}

function uploadLimit() {
  const raw = Number.parseInt(process.env.ANATOMY_MEDIA_VIEW_COVERAGE_LIMIT ?? "", 10)

  return Number.isFinite(raw) && raw > 0 ? raw : null
}

function metadataRecord(value: Prisma.JsonValue | null): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}
}

function bodyParts3dTreeFromMetadata(metadata: Record<string, unknown>): BodyParts3dTreeName {
  return metadata.bodyparts3dTreeName === "partof" ? "partof" : "isa"
}

/**
 * Finds items that already have trustworthy BodyParts3D part identifiers by
 * reading reviewed/admin BodyParts3D image metadata instead of guessing from names.
 */
async function eligibleItems(): Promise<EligibleBodyParts3dItem[]> {
  const assets = await prisma.anatomyMediaAsset.findMany({
    where: {
      mediaType: "IMAGE",
      source: { slug: BODYPARTS3D_SOURCE_SLUG },
    },
    include: { entityLinks: true },
    orderBy: { slug: "asc" },
    take: 20_000,
  })
  const byEntity = new Map<string, EligibleBodyParts3dItem>()

  for (const asset of assets) {
    const metadata = metadataRecord(asset.metadata)
    const partIds = normalizeBodyParts3dPartIds(metadata.bodyparts3dPartIds as string[] | undefined)
    if (partIds.length === 0) continue

    for (const link of asset.entityLinks) {
      const key = `${link.entityType}:${link.entitySlug}`
      if (byEntity.has(key)) continue

      byEntity.set(key, {
        entityType: link.entityType,
        entitySlug: link.entitySlug,
        partIds,
        treeName: bodyParts3dTreeFromMetadata(metadata),
      })
    }
  }

  return [...byEntity.values()].sort((left, right) => `${left.entityType}:${left.entitySlug}`.localeCompare(`${right.entityType}:${right.entitySlug}`))
}

async function existingCoverageLink(item: EligibleBodyParts3dItem, viewSlug: BodyParts3dViewSlug) {
  return prisma.anatomyMediaAsset.findFirst({
    where: {
      source: { slug: BODYPARTS3D_SOURCE_SLUG },
      metadata: {
        path: ["bodyparts3dView"],
        equals: viewSlug,
      },
      entityLinks: {
        some: {
          entityType: item.entityType,
          entitySlug: item.entitySlug,
          role: CANDIDATE_ROLE,
        },
      },
    },
    select: { id: true },
  })
}

/**
 * Imports one generated BodyParts3D coverage candidate. The R2 upload happens
 * before the DB transaction, then the transaction upserts the asset, item link,
 * and citations; retries are idempotent but failed DB writes can leave an
 * orphaned R2 object for later cleanup.
 */
async function importCoverageCandidate(item: EligibleBodyParts3dItem, viewSlug: BodyParts3dViewSlug) {
  const view = bodyParts3dView(viewSlug)
  const sourceUrl = bodyParts3dImageUrl({ partIds: item.partIds, treeName: item.treeName, view })
  const descriptor = bodyParts3dSourceDescriptor(sourceUrl)
  if (!descriptor) throw new Error(`Unable to build BodyParts3D descriptor for ${item.entityType}:${item.entitySlug}:${viewSlug}.`)

  const source = await prisma.anatomySource.findUnique({ where: { slug: BODYPARTS3D_SOURCE_SLUG } })
  if (!source) throw new Error("BodyParts3D source row is required before importing coverage media.")

  const assetSlug = bodyParts3dAdminAssetSlug({
    entityType: item.entityType,
    entitySlug: item.entitySlug,
    treeName: item.treeName,
    viewSlug,
    partIds: item.partIds,
  })
  const storagePath = bodyParts3dAdminStoragePath({
    entityType: item.entityType,
    entitySlug: item.entitySlug,
    treeName: item.treeName,
    viewSlug,
    assetSlug,
  })
  const upload = await uploadAnatomyMediaToR2({ sourceUrl, storagePath })
  const entityLabel = item.entitySlug.split("-").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ")
  const uploadedAt = new Date()
  const metadata = {
    sourceKind: "bodyparts3d-coverage-candidate-image",
    candidateReason: `missing_${viewSlug}`,
    bodyparts3dPartIds: item.partIds,
    bodyparts3dTreeName: item.treeName,
    bodyparts3dView: viewSlug,
    bodyparts3dViewTitle: view.title,
    bodyparts3dImageWidth: descriptor.imageWidth,
    bodyparts3dImageHeight: descriptor.imageHeight,
    bodyparts3dCameraMode: descriptor.cameraMode ?? "custom",
    bodyparts3dSourceUrl: sourceUrl,
    visualStyle: "3d-anatomogram-render",
    anatomogramVersion: "4.1",
    r2Upload: true,
    ingestionStatus: "uploaded_to_r2",
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
        description: `Generated BodyParts3D ${view.title.toLowerCase()} candidate for ${entityLabel}.`,
        sourceId: source.id,
        sourceUrl,
        remoteUrl: upload.remoteUrl ?? null,
        storagePath: upload.storagePath,
        license: BODYPARTS3D_LICENSE,
        licenseUrl: BODYPARTS3D_LICENSE_URL,
        attribution: BODYPARTS3D_ATTRIBUTION,
        usageScope: "OPEN_REUSE",
        reviewStatus: "REVIEWED",
        width: descriptor.imageWidth,
        height: descriptor.imageHeight,
        format: "png",
        metadata,
      },
      update: {
        sourceUrl,
        ...(upload.remoteUrl ? { remoteUrl: upload.remoteUrl } : {}),
        storagePath: upload.storagePath,
        width: descriptor.imageWidth,
        height: descriptor.imageHeight,
        metadata,
      },
    })

    await tx.anatomyMediaEntity.upsert({
      where: {
        assetId_entityType_entitySlug_role: {
          assetId: asset.id,
          entityType: item.entityType,
          entitySlug: item.entitySlug,
          role: CANDIDATE_ROLE,
        },
      },
      create: {
        assetId: asset.id,
        entityType: item.entityType,
        entitySlug: item.entitySlug,
        role: CANDIDATE_ROLE,
        notes: `Generated ${view.title.toLowerCase()} coverage candidate; approve only after visual review.`,
        reviewStatus: "NEEDS_REVIEW",
        displayPriority: 100,
      },
      update: {
        notes: `Generated ${view.title.toLowerCase()} coverage candidate; approve only after visual review.`,
      },
    })

    await tx.anatomyCitation.upsert({
      where: { slug: `citation-${assetSlug}-media-source` },
      create: {
        slug: `citation-${assetSlug}-media-source`,
        entityType: item.entityType,
        entitySlug: item.entitySlug,
        factType: "media_source",
        factSlug: assetSlug,
        sourceId: source.id,
        sourceLocator: sourceUrl,
        citationNote: "BodyParts3D coverage candidate generated for anatomy media review.",
        reviewStatus: "REVIEWED",
      },
      update: {
        sourceLocator: sourceUrl,
        citationNote: "BodyParts3D coverage candidate generated for anatomy media review.",
        reviewStatus: "REVIEWED",
      },
    })
    await tx.anatomyCitation.upsert({
      where: { slug: `citation-${assetSlug}-media-license` },
      create: {
        slug: `citation-${assetSlug}-media-license`,
        entityType: item.entityType,
        entitySlug: item.entitySlug,
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
}

async function main() {
  const command = commandFromArg(process.argv[2])
  const limit = uploadLimit()
  const items = await eligibleItems()
  const missing: Array<{ item: EligibleBodyParts3dItem; viewSlug: BodyParts3dViewSlug }> = []

  for (const item of items) {
    for (const viewSlug of COVERAGE_VIEWS) {
      if (!await existingCoverageLink(item, viewSlug)) {
        missing.push({ item, viewSlug })
      }
    }
  }

  console.log(`${items.length} BodyParts3D-linked items checked; ${missing.length} superior/inferior candidate links missing.`)

  if (command === "status") {
    console.log(JSON.stringify({
      checkedItems: items.length,
      missingCount: missing.length,
      sample: missing.slice(0, 20).map(({ item, viewSlug }) => ({
        entityType: item.entityType,
        entitySlug: item.entitySlug,
        viewSlug,
        partIds: item.partIds,
        treeName: item.treeName,
      })),
    }, null, 2))
    return
  }

  const importRows = limit ? missing.slice(0, limit) : missing
  for (const [index, row] of importRows.entries()) {
    console.log(`[${index + 1}/${importRows.length}] Importing ${row.item.entityType}:${row.item.entitySlug}:${row.viewSlug}`)
    await importCoverageCandidate(row.item, row.viewSlug)
  }
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
