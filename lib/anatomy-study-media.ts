import { prisma } from "./prisma"
import type { AnatomyMediaAsset, AnatomyMediaEntityLink } from "./anatomy-foundation"

export type AnatomyStudyMediaUrlOptions = {
  mediaUrlBySlug: Map<string, string>
  mediaAssets: AnatomyMediaAsset[]
  mediaEntityLinks: AnatomyMediaEntityLink[]
}

const emptyMediaOptions: AnatomyStudyMediaUrlOptions = {
  mediaUrlBySlug: new Map(),
  mediaAssets: [],
  mediaEntityLinks: [],
}

function lowerEnum<T extends string>(value: string) {
  return value.toLowerCase() as T
}

function metadataRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

export async function loadAnatomyStudyMediaUrlOptions(): Promise<AnatomyStudyMediaUrlOptions> {
  try {
    const rows = await prisma.anatomyMediaAsset.findMany({
      include: {
        source: true,
        entityLinks: true,
      },
    })

    return {
      mediaUrlBySlug: new Map(
        rows
          .filter((row) => Boolean(row.remoteUrl))
          .map((row) => [row.slug, row.remoteUrl as string]),
      ),
      mediaAssets: rows.map((row): AnatomyMediaAsset => ({
        id: row.id,
        slug: row.slug,
        title: row.title,
        mediaType: lowerEnum<AnatomyMediaAsset["mediaType"]>(row.mediaType),
        ...(row.description ? { description: row.description } : {}),
        sourceRef: row.source.slug,
        sourceUrl: row.sourceUrl,
        ...(row.remoteUrl ? { remoteUrl: row.remoteUrl } : {}),
        ...(row.storagePath ? { storagePath: row.storagePath } : {}),
        ...(row.thumbnailUrl ? { thumbnailUrl: row.thumbnailUrl } : {}),
        license: row.license,
        licenseUrl: row.licenseUrl,
        attribution: row.attribution,
        ...(row.author ? { author: row.author } : {}),
        usageScope: lowerEnum<AnatomyMediaAsset["usageScope"]>(row.usageScope),
        reviewStatus: lowerEnum<AnatomyMediaAsset["reviewStatus"]>(row.reviewStatus),
        ...(typeof row.width === "number" ? { width: row.width } : {}),
        ...(typeof row.height === "number" ? { height: row.height } : {}),
        ...(row.format ? { format: row.format } : {}),
        ...(metadataRecord(row.metadata) ? { metadata: metadataRecord(row.metadata) } : {}),
      })),
      mediaEntityLinks: rows.flatMap((row) => row.entityLinks.map((link): AnatomyMediaEntityLink => ({
        id: link.id,
        assetSlug: row.slug,
        entityType: lowerEnum<AnatomyMediaEntityLink["entityType"]>(link.entityType),
        entitySlug: link.entitySlug,
        role: lowerEnum<AnatomyMediaEntityLink["role"]>(link.role),
        ...(link.notes ? { notes: link.notes } : {}),
        reviewStatus: lowerEnum<NonNullable<AnatomyMediaEntityLink["reviewStatus"]>>(link.reviewStatus),
        ...(link.reviewReason ? { reviewReason: link.reviewReason } : {}),
        ...(link.reviewNote ? { reviewNote: link.reviewNote } : {}),
        displayPriority: link.displayPriority,
      }))),
    }
  } catch {
    return emptyMediaOptions
  }
}
