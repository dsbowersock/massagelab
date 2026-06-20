import { prisma } from "./prisma"
import type { AnatomyMediaAsset, AnatomyMediaEntityLink } from "./anatomy-foundation"
import type { Prisma } from "@prisma/client"

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
const PUBLIC_FLASHCARD_IMAGE_SOURCE_SLUGS = ["bodyparts3d"]
const STUDY_MEDIA_CACHE_TTL_MS = 60_000

let studyMediaOptionsCache: { expiresAt: number; value: AnatomyStudyMediaUrlOptions } | null = null
let pendingStudyMediaOptions: Promise<AnatomyStudyMediaUrlOptions> | null = null

const studyMediaAssetSelect = {
  id: true,
  slug: true,
  title: true,
  mediaType: true,
  sourceUrl: true,
  remoteUrl: true,
  thumbnailUrl: true,
  license: true,
  licenseUrl: true,
  attribution: true,
  usageScope: true,
  reviewStatus: true,
  source: {
    select: { slug: true },
  },
  entityLinks: {
    select: {
      id: true,
      entityType: true,
      entitySlug: true,
      role: true,
      reviewStatus: true,
      displayPriority: true,
    },
  },
} satisfies Prisma.AnatomyMediaAssetSelect

function lowerEnum<T extends string>(value: string) {
  return value.toLowerCase() as T
}

function lowerEnumIfPresent<T extends string>(value: string | null | undefined) {
  return typeof value === "string" && value.trim() ? lowerEnum<T>(value) : undefined
}

function cloneMediaOptions(value: AnatomyStudyMediaUrlOptions): AnatomyStudyMediaUrlOptions {
  return {
    mediaUrlBySlug: new Map(value.mediaUrlBySlug),
    mediaAssets: value.mediaAssets.map((asset) => ({
      ...asset,
      ...(asset.metadata ? { metadata: { ...asset.metadata } } : {}),
    })),
    mediaEntityLinks: value.mediaEntityLinks.map((link) => ({ ...link })),
  }
}

async function readAnatomyStudyMediaUrlOptions(): Promise<AnatomyStudyMediaUrlOptions> {
  const rows = await prisma.anatomyMediaAsset.findMany({
    where: {
      mediaType: { in: ["IMAGE", "DIAGRAM"] },
      usageScope: "OPEN_REUSE",
      reviewStatus: "REVIEWED",
      source: { slug: { in: PUBLIC_FLASHCARD_IMAGE_SOURCE_SLUGS } },
      OR: [
        { remoteUrl: { not: null } },
        { thumbnailUrl: { not: null } },
      ],
    },
    select: studyMediaAssetSelect,
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
      sourceRef: row.source.slug,
      sourceUrl: row.sourceUrl,
      ...(row.remoteUrl ? { remoteUrl: row.remoteUrl } : {}),
      ...(row.thumbnailUrl ? { thumbnailUrl: row.thumbnailUrl } : {}),
      license: row.license,
      licenseUrl: row.licenseUrl,
      attribution: row.attribution,
      usageScope: lowerEnum<AnatomyMediaAsset["usageScope"]>(row.usageScope),
      reviewStatus: lowerEnum<AnatomyMediaAsset["reviewStatus"]>(row.reviewStatus),
    })),
    mediaEntityLinks: rows.flatMap((row) => row.entityLinks.map((link): AnatomyMediaEntityLink => {
      const reviewStatus = lowerEnumIfPresent<NonNullable<AnatomyMediaEntityLink["reviewStatus"]>>(link.reviewStatus)

      return {
        id: link.id,
        assetSlug: row.slug,
        entityType: lowerEnum<AnatomyMediaEntityLink["entityType"]>(link.entityType),
        entitySlug: link.entitySlug,
        role: lowerEnum<AnatomyMediaEntityLink["role"]>(link.role),
        ...(reviewStatus ? { reviewStatus } : {}),
        displayPriority: link.displayPriority,
      }
    })),
  }
}

/**
 * Loads DB-backed public flashcard image metadata with a short process-local cache.
 *
 * Flashcard APIs call this helper repeatedly during deck/session/progress flows;
 * keeping the query projected and cached avoids repeated Neon transfer of the
 * full anatomy media catalog while preserving reviewed BodyParts3D prompt media.
 */
export async function loadAnatomyStudyMediaUrlOptions(): Promise<AnatomyStudyMediaUrlOptions> {
  try {
    const now = Date.now()
    if (studyMediaOptionsCache && studyMediaOptionsCache.expiresAt > now) {
      return cloneMediaOptions(studyMediaOptionsCache.value)
    }

    pendingStudyMediaOptions ??= readAnatomyStudyMediaUrlOptions()
    const value = await pendingStudyMediaOptions
    studyMediaOptionsCache = {
      expiresAt: Date.now() + STUDY_MEDIA_CACHE_TTL_MS,
      value,
    }
    return cloneMediaOptions(value)
  } catch {
    return cloneMediaOptions(emptyMediaOptions)
  } finally {
    pendingStudyMediaOptions = null
  }
}
