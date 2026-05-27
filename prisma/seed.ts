import { PrismaClient } from "@prisma/client"
import type {
  AnatomyDifficulty,
  AnatomyEntityTermType,
  AnatomyEntityType,
  AnatomyFactReviewStatus,
  AnatomyKind,
  AnatomyMediaRole,
  AnatomyMediaType,
  AnatomyRelativeDepth,
  AnatomySourceUsageScope,
  BloodSupplyKind,
  ClientTermConfidence,
  MuscleActionRole,
  MuscleAttachmentType,
  MuscleContractionType,
  PainMapLaterality,
  PainMapSurface,
  Prisma,
} from "@prisma/client"
import { neonConfig } from "@neondatabase/serverless"
import { PrismaNeon } from "@prisma/adapter-neon"
import ws from "ws"
import { config } from "dotenv"
import { anatomyTerms, getAnatomySources } from "../lib/anatomy.js"
import {
  ANATOMY_FOUNDATION_SEED,
  validateAnatomyFoundation,
  type AnatomyFoundationSeed,
} from "../lib/anatomy-foundation.ts"

config({ path: ".env.local" })
config()

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL

if (!connectionString) {
  throw new Error("DIRECT_URL, DATABASE_URL_UNPOOLED, or DATABASE_URL is required to seed the Neon database.")
}

neonConfig.webSocketConstructor = ws

const adapter = new PrismaNeon({ connectionString })
const prisma = new PrismaClient({ adapter, log: ["error"] })
const OBSOLETE_FOUNDATION_SOURCE_SLUGS = [
  "bioportal-fma",
  "future-clinical-citation-needed",
  "massagelab-initial-anatomy-foundation",
]

function toEnum<T extends string>(value: string | undefined, fallback = "OTHER") {
  return String(value || fallback).replace(/-/g, "_").toUpperCase() as T
}

function bodySystemsForTerm(term: { kind: string }) {
  if (term.kind === "bone") return ["skeletal"]
  if (term.kind === "muscle") return ["muscular"]
  return []
}

function sourceLabel(source: { label?: string; name?: string }) {
  return source.label ?? source.name ?? "Untitled anatomy source"
}

function normalizePublicBaseUrl(value: string | undefined) {
  return value?.trim().replace(/\/+$/, "") || undefined
}

function encodeStoragePath(path: string) {
  return path.split("/").map(encodeURIComponent).join("/")
}

function seededMediaRemoteUrl(
  asset: { remoteUrl?: string; storagePath?: string },
  existing?: { remoteUrl: string | null; storagePath: string | null } | null,
) {
  const publicBaseUrl = normalizePublicBaseUrl(process.env.MASSAGELAB_R2_PUBLIC_BASE_URL)
  if (publicBaseUrl && asset.storagePath) return `${publicBaseUrl}/${encodeStoragePath(asset.storagePath)}`
  if (asset.remoteUrl !== undefined) return asset.remoteUrl
  if (existing?.storagePath === asset.storagePath && existing?.remoteUrl) return existing.remoteUrl
  return asset.remoteUrl ?? null
}

function jsonRecord(value: Prisma.JsonValue | null | undefined) {
  if (value && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>
  return {}
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue)
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, stableValue(entry)]),
    )
  }
  return value ?? null
}

function stableJson(value: unknown) {
  return JSON.stringify(stableValue(value))
}

function recordMatches(existing: unknown, expected: Record<string, unknown>) {
  if (!existing) return false
  const existingRecord = existing as Record<string, unknown>

  return Object.entries(expected).every(([key, value]) => stableJson(existingRecord[key] ?? null) === stableJson(value ?? null))
}

function seededMediaMetadata(
  asset: { storagePath?: string; metadata?: Record<string, unknown> },
  existing?: { metadata: Prisma.JsonValue | null; storagePath: string | null } | null,
) {
  const metadata = { ...(asset.metadata ?? {}) }
  const existingMetadata = jsonRecord(existing?.metadata)

  if (existing?.storagePath === (asset.storagePath ?? null) && existingMetadata.ingestionStatus === "uploaded_to_r2") {
    for (const key of [
      "ingestionStatus",
      "r2Bucket",
      "r2StoragePath",
      "r2PublicBaseUrlConfigured",
      "uploadedAt",
      "uploadedBytes",
      "uploadedContentType",
      "ingestionMethod",
      "fallbackFrameSlugs",
    ]) {
      if (existingMetadata[key] !== undefined) metadata[key] = existingMetadata[key]
    }
  }

  return metadata as Prisma.InputJsonValue
}

async function seedSource(source: {
  id: string
  label?: string
  name?: string
  url?: string
  license?: string
  attribution: string
}) {
  return prisma.anatomySource.upsert({
    where: { slug: source.id },
    create: {
      slug: source.id,
      label: sourceLabel(source),
      url: source.url ?? null,
      license: source.license ?? null,
      licenseUrl: null,
      usageScope: "REVIEW_ONLY",
      accessedAt: null,
      notes: null,
      attribution: source.attribution,
    },
    update: {
      label: sourceLabel(source),
      url: source.url ?? null,
      license: source.license ?? null,
      licenseUrl: null,
      usageScope: "REVIEW_ONLY",
      accessedAt: null,
      notes: null,
      attribution: source.attribution,
    },
  })
}

async function seedFoundationSources(seed: AnatomyFoundationSeed) {
  const sourceBySlug = new Map<string, { id: string }>()

  for (const source of seed.sources) {
    const row = await prisma.anatomySource.upsert({
      where: { slug: source.slug },
      create: {
        id: source.id,
        slug: source.slug,
        label: source.name,
        url: source.url ?? null,
        license: source.license ?? null,
        licenseUrl: source.licenseUrl ?? null,
        usageScope: enumValue<AnatomySourceUsageScope>(source.usageScope ?? "review_only"),
        accessedAt: source.accessedAt ? new Date(source.accessedAt) : null,
        notes: source.notes ?? null,
        attribution: source.attribution,
      },
      update: {
        label: source.name,
        url: source.url ?? null,
        license: source.license ?? null,
        licenseUrl: source.licenseUrl ?? null,
        usageScope: enumValue<AnatomySourceUsageScope>(source.usageScope ?? "review_only"),
        accessedAt: source.accessedAt ? new Date(source.accessedAt) : null,
        notes: source.notes ?? null,
        attribution: source.attribution,
      },
    })

    sourceBySlug.set(source.slug, row)
  }

  return sourceBySlug
}

function requireMapValue<T>(map: Map<string, T>, key: string, label: string) {
  const value = map.get(key)

  if (!value) {
    throw new Error(`Missing ${label}: ${key}`)
  }

  return value
}

function enumValue<T extends string>(value: string) {
  return value.replace(/-/g, "_").toUpperCase() as T
}

function chunked<T>(values: readonly T[], size = 1000) {
  const chunks: T[][] = []
  for (let index = 0; index < values.length; index += size) {
    chunks.push(values.slice(index, index + size) as T[])
  }
  return chunks
}

function seedConcurrency() {
  const parsed = Number.parseInt(process.env.ANATOMY_SEED_CONCURRENCY ?? "16", 10)
  if (!Number.isFinite(parsed) || parsed < 1) return 1
  return Math.min(parsed, 32)
}

function seedTimingMarker(scope: string) {
  let previous = Date.now()

  return (label: string) => {
    if (process.env.ANATOMY_SEED_TIMINGS !== "1") return

    const current = Date.now()
    console.log(`[seed:${scope}] ${label}: ${((current - previous) / 1000).toFixed(2)}s`)
    previous = current
  }
}

async function mapWithConcurrency<T>(
  values: readonly T[],
  worker: (value: T, index: number) => Promise<void>,
  concurrency = seedConcurrency(),
) {
  let nextIndex = 0
  const workerCount = Math.min(concurrency, values.length)

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < values.length) {
        const currentIndex = nextIndex
        nextIndex += 1
        await worker(values[currentIndex], currentIndex)
      }
    }),
  )
}

async function existingCitationsBySlug(slugs: readonly string[]) {
  const bySlug = new Map<string, {
    slug: string
    entityType: AnatomyEntityType
    entitySlug: string
    factType: string
    factSlug: string | null
    sourceId: string
    sourceLocator: string | null
    citationNote: string | null
    reviewStatus: AnatomyFactReviewStatus
  }>()

  for (const slugChunk of chunked([...new Set(slugs)])) {
    const rows = await prisma.anatomyCitation.findMany({
      where: { slug: { in: slugChunk } },
      select: {
        slug: true,
        entityType: true,
        entitySlug: true,
        factType: true,
        factSlug: true,
        sourceId: true,
        sourceLocator: true,
        citationNote: true,
        reviewStatus: true,
      },
    })

    for (const row of rows) bySlug.set(row.slug, row)
  }

  return bySlug
}

async function existingRowsBySlug<T extends { slug: string }>(
  delegate: {
    findMany: (args: {
      where: { slug: { in: string[] } }
      select: Record<string, boolean>
    }) => Promise<T[]>
  },
  slugs: readonly string[],
  select: Record<string, boolean>,
) {
  const bySlug = new Map<string, T>()

  for (const slugChunk of chunked([...new Set(slugs)])) {
    const rows = await delegate.findMany({
      where: { slug: { in: slugChunk } },
      select,
    })

    for (const row of rows) bySlug.set(row.slug, row)
  }

  return bySlug
}

async function existingEntityTermsBySlug(slugs: readonly string[]) {
  const bySlug = new Map<string, {
    slug: string
    anatomyEntityType: AnatomyEntityType
    anatomyEntitySlug: string
    term: string
    termType: AnatomyEntityTermType
    languageOfOrigin: string | null
    notes: string | null
    sourceId: string
  }>()

  for (const slugChunk of chunked([...new Set(slugs)])) {
    const rows = await prisma.anatomyEntityTerm.findMany({
      where: { slug: { in: slugChunk } },
      select: {
        slug: true,
        anatomyEntityType: true,
        anatomyEntitySlug: true,
        term: true,
        termType: true,
        languageOfOrigin: true,
        notes: true,
        sourceId: true,
      },
    })

    for (const row of rows) bySlug.set(row.slug, row)
  }

  return bySlug
}

function relationshipKey(input: {
  sourceEntityType: AnatomyEntityType
  sourceEntitySlug: string
  relationshipType: string
  targetEntityType: AnatomyEntityType
  targetEntitySlug: string
}) {
  return [
    input.sourceEntityType,
    input.sourceEntitySlug,
    input.relationshipType,
    input.targetEntityType,
    input.targetEntitySlug,
  ].join("\u0000")
}

async function existingRelationshipsByKey(seed: AnatomyFoundationSeed) {
  const byKey = new Map<string, {
    sourceEntityType: AnatomyEntityType | null
    sourceEntitySlug: string | null
    relationshipType: string
    targetEntityType: AnatomyEntityType | null
    targetEntitySlug: string | null
    details: Prisma.JsonValue | null
    sourceId: string | null
  }>()

  const whereValues = seed.relationships.map((relationship) => ({
    sourceEntityType: enumValue<AnatomyEntityType>(relationship.sourceEntityType),
    sourceEntitySlug: relationship.sourceEntitySlug,
    relationshipType: relationship.relationshipType,
    targetEntityType: enumValue<AnatomyEntityType>(relationship.targetEntityType),
    targetEntitySlug: relationship.targetEntitySlug,
  }))

  for (const whereChunk of chunked(whereValues, 250)) {
    const rows = await prisma.anatomyRelationship.findMany({
      where: { OR: whereChunk },
      select: {
        sourceEntityType: true,
        sourceEntitySlug: true,
        relationshipType: true,
        targetEntityType: true,
        targetEntitySlug: true,
        details: true,
        sourceId: true,
      },
    })

    for (const row of rows) {
      if (row.sourceEntityType && row.sourceEntitySlug && row.targetEntityType && row.targetEntitySlug) {
        byKey.set(relationshipKey({
          sourceEntityType: row.sourceEntityType,
          sourceEntitySlug: row.sourceEntitySlug,
          relationshipType: row.relationshipType,
          targetEntityType: row.targetEntityType,
          targetEntitySlug: row.targetEntitySlug,
        }), row)
      }
    }
  }

  return byKey
}

async function existingExternalIdentifiersById(ids: readonly string[]) {
  const byId = new Map<string, {
    id: string
    entityType: AnatomyEntityType
    entitySlug: string
    provider: string
    identifier: string
    iri: string | null
    label: string | null
    sourceId: string
  }>()

  for (const idChunk of chunked([...new Set(ids)])) {
    const rows = await prisma.externalAnatomyIdentifier.findMany({
      where: { id: { in: idChunk } },
      select: {
        id: true,
        entityType: true,
        entitySlug: true,
        provider: true,
        identifier: true,
        iri: true,
        label: true,
        sourceId: true,
      },
    })

    for (const row of rows) byId.set(row.id, row)
  }

  return byId
}

async function existingMediaAssetsBySlug(slugs: readonly string[]) {
  const bySlug = new Map<string, {
    id: string
    slug: string
    title: string
    mediaType: AnatomyMediaType
    description: string | null
    sourceId: string
    sourceUrl: string
    remoteUrl: string | null
    storagePath: string | null
    thumbnailUrl: string | null
    license: string
    licenseUrl: string
    attribution: string
    author: string | null
    usageScope: AnatomySourceUsageScope
    reviewStatus: AnatomyFactReviewStatus
    width: number | null
    height: number | null
    format: string | null
    metadata: Prisma.JsonValue | null
  }>()

  for (const slugChunk of chunked([...new Set(slugs)])) {
    const rows = await prisma.anatomyMediaAsset.findMany({
      where: { slug: { in: slugChunk } },
      select: {
        id: true,
        slug: true,
        title: true,
        mediaType: true,
        description: true,
        sourceId: true,
        sourceUrl: true,
        remoteUrl: true,
        storagePath: true,
        thumbnailUrl: true,
        license: true,
        licenseUrl: true,
        attribution: true,
        author: true,
        usageScope: true,
        reviewStatus: true,
        width: true,
        height: true,
        format: true,
        metadata: true,
      },
    })

    for (const row of rows) bySlug.set(row.slug, row)
  }

  return bySlug
}

function mediaLinkKey(input: {
  assetId: string
  entityType: AnatomyEntityType
  entitySlug: string
  role: AnatomyMediaRole
}) {
  return [input.assetId, input.entityType, input.entitySlug, input.role].join("\u0000")
}

async function existingMediaLinksByKey(assetIds: readonly string[]) {
  const byKey = new Map<string, {
    assetId: string
    entityType: AnatomyEntityType
    entitySlug: string
    role: AnatomyMediaRole
    notes: string | null
  }>()

  for (const assetIdChunk of chunked([...new Set(assetIds)])) {
    const rows = await prisma.anatomyMediaEntity.findMany({
      where: { assetId: { in: assetIdChunk } },
      select: {
        assetId: true,
        entityType: true,
        entitySlug: true,
        role: true,
        notes: true,
      },
    })

    for (const row of rows) byKey.set(mediaLinkKey(row), row)
  }

  return byKey
}

function termSourceRefKey(input: { termId: string; sourceId: string }) {
  return [input.termId, input.sourceId].join("\u0000")
}

async function existingAnatomyAliasKeys(termIds: readonly string[]) {
  const keys = new Set<string>()

  for (const termIdChunk of chunked([...new Set(termIds)])) {
    const rows = await prisma.anatomyAlias.findMany({
      where: { termId: { in: termIdChunk } },
      select: {
        termId: true,
        alias: true,
      },
    })

    for (const row of rows) keys.add([row.termId, row.alias].join("\u0000"))
  }

  return keys
}

async function existingAnatomySourceRefKeys(termIds: readonly string[]) {
  const keys = new Set<string>()

  for (const termIdChunk of chunked([...new Set(termIds)])) {
    const rows = await prisma.anatomySourceRef.findMany({
      where: { termId: { in: termIdChunk } },
      select: {
        termId: true,
        sourceId: true,
      },
    })

    for (const row of rows) keys.add(termSourceRefKey(row))
  }

  return keys
}

async function seedAnatomyFoundation(seed: AnatomyFoundationSeed) {
  const mark = seedTimingMarker("foundation")
  const issues = validateAnatomyFoundation(seed)
  mark("validate")

  if (issues.length > 0) {
    throw new Error(`Anatomy foundation seed is invalid:\n${issues.join("\n")}`)
  }

  const sourceBySlug = await seedFoundationSources(seed)
  mark("sources")
  const regionBySlug = new Map<string, { id: string }>()
  const boneBySlug = new Map<string, { id: string }>()
  const landmarkBySlug = new Map<string, { id: string }>()
  const jointBySlug = new Map<string, { id: string }>()
  const movementBySlug = new Map<string, { id: string }>()
  const muscleBySlug = new Map<string, { id: string }>()
  const nerveBySlug = new Map<string, { id: string }>()
  const structureBySlug = new Map<string, { id: string }>()
  const existingRegionBySlug = await existingRowsBySlug<{
    id: string
    slug: string
    name: string
    description: string | null
    parentRegionId: string | null
    sourceId: string
  }>(prisma.anatomyRegion as any, [
    ...seed.bodyRegions.map((region) => region.slug),
    ...seed.bodySubregions.map((region) => region.slug),
  ], {
    id: true,
    slug: true,
    name: true,
    description: true,
    parentRegionId: true,
    sourceId: true,
  })

  await mapWithConcurrency(seed.bodyRegions, async (region) => {
    const source = requireMapValue(sourceBySlug, region.sourceRefs[0], "region source")
    const description = region.description ?? null
    const existingRegion = existingRegionBySlug.get(region.slug)

    if (existingRegion && recordMatches(existingRegion, {
      name: region.name,
      description,
      parentRegionId: null,
      sourceId: source.id,
    })) {
      regionBySlug.set(region.slug, { id: existingRegion.id })
      return
    }

    const row = await prisma.anatomyRegion.upsert({
      where: { slug: region.slug },
      create: {
        id: region.id,
        slug: region.slug,
        name: region.name,
        description,
        sourceId: source.id,
      },
      update: {
        name: region.name,
        description,
        parentRegionId: null,
        sourceId: source.id,
      },
    })

    regionBySlug.set(region.slug, row)
  })

  await mapWithConcurrency(seed.bodySubregions, async (subregion) => {
    const source = requireMapValue(sourceBySlug, subregion.sourceRefs[0], "subregion source")
    const parentRegion = requireMapValue(regionBySlug, subregion.region, "parent region")
    const description = subregion.description ?? null
    const existingRegion = existingRegionBySlug.get(subregion.slug)

    if (existingRegion && recordMatches(existingRegion, {
      name: subregion.name,
      description,
      parentRegionId: parentRegion.id,
      sourceId: source.id,
    })) {
      regionBySlug.set(subregion.slug, { id: existingRegion.id })
      return
    }

    const row = await prisma.anatomyRegion.upsert({
      where: { slug: subregion.slug },
      create: {
        id: subregion.id,
        slug: subregion.slug,
        name: subregion.name,
        description,
        parentRegionId: parentRegion.id,
        sourceId: source.id,
      },
      update: {
        name: subregion.name,
        description,
        parentRegionId: parentRegion.id,
        sourceId: source.id,
      },
    })

    regionBySlug.set(subregion.slug, row)
  })
  mark("regions")

  const existingBoneBySlug = await existingRowsBySlug<{
    id: string
    slug: string
    name: string
    formalName: string | null
    description: string | null
    regionId: string
    sourceId: string
  }>(prisma.bone as any, seed.bones.map((bone) => bone.slug), {
    id: true,
    slug: true,
    name: true,
    formalName: true,
    description: true,
    regionId: true,
    sourceId: true,
  })

  await mapWithConcurrency(seed.bones, async (bone) => {
    const source = requireMapValue(sourceBySlug, bone.sourceRef, "bone source")
    const region = requireMapValue(regionBySlug, bone.region, "bone region")
    const formalName = bone.formalName ?? null
    const description = bone.description ?? null
    const existingBone = existingBoneBySlug.get(bone.slug)

    if (existingBone && recordMatches(existingBone, {
      name: bone.name,
      formalName,
      description,
      regionId: region.id,
      sourceId: source.id,
    })) {
      boneBySlug.set(bone.slug, { id: existingBone.id })
      return
    }

    const row = await prisma.bone.upsert({
      where: { slug: bone.slug },
      create: {
        id: bone.id,
        slug: bone.slug,
        name: bone.name,
        formalName,
        description,
        regionId: region.id,
        sourceId: source.id,
      },
      update: {
        name: bone.name,
        formalName,
        description,
        regionId: region.id,
        sourceId: source.id,
      },
    })

    boneBySlug.set(bone.slug, row)
  })

  const existingLandmarkBySlug = await existingRowsBySlug<{
    id: string
    slug: string
    name: string
    boneId: string
    description: string | null
    sourceId: string
  }>(prisma.boneLandmark as any, seed.boneLandmarks.map((landmark) => landmark.slug), {
    id: true,
    slug: true,
    name: true,
    boneId: true,
    description: true,
    sourceId: true,
  })

  await mapWithConcurrency(seed.boneLandmarks, async (landmark) => {
    const source = requireMapValue(sourceBySlug, landmark.sourceRef, "landmark source")
    const bone = requireMapValue(boneBySlug, landmark.bone, "landmark bone")
    const description = landmark.description ?? null
    const existingLandmark = existingLandmarkBySlug.get(landmark.slug)

    if (existingLandmark && recordMatches(existingLandmark, {
      name: landmark.name,
      boneId: bone.id,
      description,
      sourceId: source.id,
    })) {
      landmarkBySlug.set(landmark.slug, { id: existingLandmark.id })
      return
    }

    const row = await prisma.boneLandmark.upsert({
      where: { slug: landmark.slug },
      create: {
        id: landmark.id,
        slug: landmark.slug,
        name: landmark.name,
        boneId: bone.id,
        description,
        sourceId: source.id,
      },
      update: {
        name: landmark.name,
        boneId: bone.id,
        description,
        sourceId: source.id,
      },
    })

    landmarkBySlug.set(landmark.slug, row)
  })

  const existingJointBySlug = await existingRowsBySlug<{
    id: string
    slug: string
    name: string
    jointType: string
    regionId: string
    description: string | null
    sourceId: string
  }>(prisma.joint as any, seed.joints.map((joint) => joint.slug), {
    id: true,
    slug: true,
    name: true,
    jointType: true,
    regionId: true,
    description: true,
    sourceId: true,
  })

  await mapWithConcurrency(seed.joints, async (joint) => {
    const source = requireMapValue(sourceBySlug, joint.sourceRef, "joint source")
    const region = requireMapValue(regionBySlug, joint.region, "joint region")
    const description = joint.description ?? null
    const existingJoint = existingJointBySlug.get(joint.slug)

    if (existingJoint && recordMatches(existingJoint, {
      name: joint.name,
      jointType: joint.jointType,
      regionId: region.id,
      description,
      sourceId: source.id,
    })) {
      jointBySlug.set(joint.slug, { id: existingJoint.id })
      return
    }

    const row = await prisma.joint.upsert({
      where: { slug: joint.slug },
      create: {
        id: joint.id,
        slug: joint.slug,
        name: joint.name,
        jointType: joint.jointType,
        regionId: region.id,
        description,
        sourceId: source.id,
      },
      update: {
        name: joint.name,
        jointType: joint.jointType,
        regionId: region.id,
        description,
        sourceId: source.id,
      },
    })

    jointBySlug.set(joint.slug, row)
  })

  const existingMovementBySlug = await existingRowsBySlug<{
    id: string
    slug: string
    jointId: string
    movementName: string
    plane: string | null
    axis: string | null
    description: string | null
    sourceId: string
  }>(prisma.jointMovement as any, seed.jointMovements.map((movement) => movement.slug), {
    id: true,
    slug: true,
    jointId: true,
    movementName: true,
    plane: true,
    axis: true,
    description: true,
    sourceId: true,
  })

  await mapWithConcurrency(seed.jointMovements, async (movement) => {
    const source = requireMapValue(sourceBySlug, movement.sourceRef, "movement source")
    const joint = requireMapValue(jointBySlug, movement.joint, "movement joint")
    const plane = movement.plane ?? null
    const axis = movement.axis ?? null
    const description = movement.description ?? null
    const existingMovement = existingMovementBySlug.get(movement.slug)

    if (existingMovement && recordMatches(existingMovement, {
      jointId: joint.id,
      movementName: movement.movementName,
      plane,
      axis,
      description,
      sourceId: source.id,
    })) {
      movementBySlug.set(movement.slug, { id: existingMovement.id })
      return
    }

    const row = await prisma.jointMovement.upsert({
      where: { slug: movement.slug },
      create: {
        id: movement.id,
        slug: movement.slug,
        jointId: joint.id,
        movementName: movement.movementName,
        plane,
        axis,
        description,
        sourceId: source.id,
      },
      update: {
        jointId: joint.id,
        movementName: movement.movementName,
        plane,
        axis,
        description,
        sourceId: source.id,
      },
    })

    movementBySlug.set(movement.slug, row)
  })

  const existingRangeBySlug = await existingRowsBySlug<{
    id: string
    slug: string
    jointId: string
    movementId: string
    typicalMinDegrees: number | null
    typicalMaxDegrees: number | null
    typicalMinValue: number | null
    typicalMaxValue: number | null
    measurementUnit: string
    measurementPosition: string
    notes: string | null
    sourceId: string
  }>(prisma.rangeOfMotion as any, seed.rangesOfMotion.map((range) => range.slug), {
    id: true,
    slug: true,
    jointId: true,
    movementId: true,
    typicalMinDegrees: true,
    typicalMaxDegrees: true,
    typicalMinValue: true,
    typicalMaxValue: true,
    measurementUnit: true,
    measurementPosition: true,
    notes: true,
    sourceId: true,
  })

  await mapWithConcurrency(seed.rangesOfMotion, async (range) => {
    const source = requireMapValue(sourceBySlug, range.sourceRef, "ROM source")
    const joint = requireMapValue(jointBySlug, range.joint, "ROM joint")
    const movement = requireMapValue(movementBySlug, range.movement, "ROM movement")
    const typicalMinDegrees = range.typicalMinDegrees ?? null
    const typicalMaxDegrees = range.typicalMaxDegrees ?? null
    const typicalMinValue = range.typicalMinValue ?? range.typicalMinDegrees ?? null
    const typicalMaxValue = range.typicalMaxValue ?? range.typicalMaxDegrees ?? null
    const measurementUnit = range.measurementUnit ?? "degrees"
    const notes = range.notes ?? null
    const existingRange = existingRangeBySlug.get(range.slug)

    if (existingRange && recordMatches(existingRange, {
      jointId: joint.id,
      movementId: movement.id,
      typicalMinDegrees,
      typicalMaxDegrees,
      typicalMinValue,
      typicalMaxValue,
      measurementUnit,
      measurementPosition: range.measurementPosition,
      notes,
      sourceId: source.id,
    })) {
      return
    }

    await prisma.rangeOfMotion.upsert({
      where: { slug: range.slug },
      create: {
        id: range.id,
        slug: range.slug,
        jointId: joint.id,
        movementId: movement.id,
        typicalMinDegrees,
        typicalMaxDegrees,
        typicalMinValue,
        typicalMaxValue,
        measurementUnit,
        measurementPosition: range.measurementPosition,
        notes,
        sourceId: source.id,
      },
      update: {
        jointId: joint.id,
        movementId: movement.id,
        typicalMinDegrees,
        typicalMaxDegrees,
        typicalMinValue,
        typicalMaxValue,
        measurementUnit,
        measurementPosition: range.measurementPosition,
        notes,
        sourceId: source.id,
      },
    })
  })
  mark("skeleton-joints-rom")

  const existingMuscleBySlug = await existingRowsBySlug<{
    id: string
    slug: string
    name: string
    formalName: string
    alternateNames: string[]
    etymology: string | null
    languageOfOrigin: string | null
    description: string | null
    regionId: string
    relativeDepth: AnatomyRelativeDepth
    depthNotes: string | null
    sourceId: string
  }>(prisma.muscle as any, seed.muscles.map((muscle) => muscle.slug), {
    id: true,
    slug: true,
    name: true,
    formalName: true,
    alternateNames: true,
    etymology: true,
    languageOfOrigin: true,
    description: true,
    regionId: true,
    relativeDepth: true,
    depthNotes: true,
    sourceId: true,
  })

  await mapWithConcurrency(seed.muscles, async (muscle) => {
    const source = requireMapValue(sourceBySlug, muscle.sourceRef, "muscle source")
    const region = requireMapValue(regionBySlug, muscle.region, "muscle region")
    const etymology = muscle.etymology ?? null
    const languageOfOrigin = muscle.languageOfOrigin ?? null
    const description = muscle.description ?? null
    const relativeDepth = enumValue<AnatomyRelativeDepth>(muscle.relativeDepth)
    const depthNotes = muscle.depthNotes ?? null
    const existingMuscle = existingMuscleBySlug.get(muscle.slug)

    if (existingMuscle && recordMatches(existingMuscle, {
      name: muscle.name,
      formalName: muscle.formalName,
      alternateNames: muscle.alternateNames,
      etymology,
      languageOfOrigin,
      description,
      regionId: region.id,
      relativeDepth,
      depthNotes,
      sourceId: source.id,
    })) {
      muscleBySlug.set(muscle.slug, { id: existingMuscle.id })
      return
    }

    const row = await prisma.muscle.upsert({
      where: { slug: muscle.slug },
      create: {
        id: muscle.id,
        slug: muscle.slug,
        name: muscle.name,
        formalName: muscle.formalName,
        alternateNames: muscle.alternateNames,
        etymology,
        languageOfOrigin,
        description,
        regionId: region.id,
        relativeDepth,
        depthNotes,
        sourceId: source.id,
      },
      update: {
        name: muscle.name,
        formalName: muscle.formalName,
        alternateNames: muscle.alternateNames,
        etymology,
        languageOfOrigin,
        description,
        regionId: region.id,
        relativeDepth,
        depthNotes,
        sourceId: source.id,
      },
    })

    muscleBySlug.set(muscle.slug, row)
  })

  const existingAttachmentBySlug = await existingRowsBySlug<{
    id: string
    slug: string
    muscleId: string
    type: MuscleAttachmentType
    boneId: string
    landmarkId: string | null
    description: string
    sourceId: string
  }>(prisma.muscleAttachment as any, seed.muscleAttachments.map((attachment) => attachment.id), {
    id: true,
    slug: true,
    muscleId: true,
    type: true,
    boneId: true,
    landmarkId: true,
    description: true,
    sourceId: true,
  })

  await mapWithConcurrency(seed.muscleAttachments, async (attachment) => {
    const source = requireMapValue(sourceBySlug, attachment.sourceRef, "attachment source")
    const muscle = requireMapValue(muscleBySlug, attachment.muscle, "attachment muscle")
    const bone = requireMapValue(boneBySlug, attachment.bone, "attachment bone")
    const landmark = attachment.landmark ? requireMapValue(landmarkBySlug, attachment.landmark, "attachment landmark") : null
    const type = enumValue<MuscleAttachmentType>(attachment.type)
    const landmarkId = landmark?.id ?? null
    const existingAttachment = existingAttachmentBySlug.get(attachment.id)

    if (existingAttachment && recordMatches(existingAttachment, {
      muscleId: muscle.id,
      type,
      boneId: bone.id,
      landmarkId,
      description: attachment.description,
      sourceId: source.id,
    })) {
      return
    }

    await prisma.muscleAttachment.upsert({
      where: { slug: attachment.id },
      create: {
        id: attachment.id,
        slug: attachment.id,
        muscleId: muscle.id,
        type,
        boneId: bone.id,
        landmarkId,
        description: attachment.description,
        sourceId: source.id,
      },
      update: {
        muscleId: muscle.id,
        type,
        boneId: bone.id,
        landmarkId,
        description: attachment.description,
        sourceId: source.id,
      },
    })
  })

  const existingActionBySlug = await existingRowsBySlug<{
    id: string
    slug: string
    muscleId: string
    jointId: string
    movementId: string
    role: MuscleActionRole
    contractionType: MuscleContractionType
    description: string
    sourceId: string
  }>(prisma.muscleAction as any, seed.muscleActions.map((action) => action.id), {
    id: true,
    slug: true,
    muscleId: true,
    jointId: true,
    movementId: true,
    role: true,
    contractionType: true,
    description: true,
    sourceId: true,
  })

  await mapWithConcurrency(seed.muscleActions, async (action) => {
    const source = requireMapValue(sourceBySlug, action.sourceRef, "action source")
    const muscle = requireMapValue(muscleBySlug, action.muscle, "action muscle")
    const joint = requireMapValue(jointBySlug, action.joint, "action joint")
    const movement = requireMapValue(movementBySlug, action.movement, "action movement")
    const role = enumValue<MuscleActionRole>(action.role)
    const contractionType = enumValue<MuscleContractionType>(action.contractionType)
    const existingAction = existingActionBySlug.get(action.id)

    if (existingAction && recordMatches(existingAction, {
      muscleId: muscle.id,
      jointId: joint.id,
      movementId: movement.id,
      role,
      contractionType,
      description: action.description,
      sourceId: source.id,
    })) {
      return
    }

    await prisma.muscleAction.upsert({
      where: { slug: action.id },
      create: {
        id: action.id,
        slug: action.id,
        muscleId: muscle.id,
        jointId: joint.id,
        movementId: movement.id,
        role,
        contractionType,
        description: action.description,
        sourceId: source.id,
      },
      update: {
        muscleId: muscle.id,
        jointId: joint.id,
        movementId: movement.id,
        role,
        contractionType,
        description: action.description,
        sourceId: source.id,
      },
    })
  })

  const existingNerveBySlug = await existingRowsBySlug<{
    id: string
    slug: string
    name: string
    nerveRoots: string[]
    regionId: string
    description: string | null
    sourceId: string
  }>(prisma.nerve as any, seed.nerves.map((nerve) => nerve.slug), {
    id: true,
    slug: true,
    name: true,
    nerveRoots: true,
    regionId: true,
    description: true,
    sourceId: true,
  })

  await mapWithConcurrency(seed.nerves, async (nerve) => {
    const source = requireMapValue(sourceBySlug, nerve.sourceRef, "nerve source")
    const region = requireMapValue(regionBySlug, nerve.region, "nerve region")
    const description = nerve.description ?? null
    const existingNerve = existingNerveBySlug.get(nerve.slug)

    if (existingNerve && recordMatches(existingNerve, {
      name: nerve.name,
      nerveRoots: nerve.nerveRoots,
      regionId: region.id,
      description,
      sourceId: source.id,
    })) {
      nerveBySlug.set(nerve.slug, { id: existingNerve.id })
      return
    }

    const row = await prisma.nerve.upsert({
      where: { slug: nerve.slug },
      create: {
        id: nerve.id,
        slug: nerve.slug,
        name: nerve.name,
        nerveRoots: nerve.nerveRoots,
        regionId: region.id,
        description,
        sourceId: source.id,
      },
      update: {
        name: nerve.name,
        nerveRoots: nerve.nerveRoots,
        regionId: region.id,
        description,
        sourceId: source.id,
      },
    })

    nerveBySlug.set(nerve.slug, row)
  })

  const existingInnervationBySlug = await existingRowsBySlug<{
    id: string
    slug: string
    muscleId: string
    nerveId: string
    description: string | null
    sourceId: string
  }>(prisma.muscleInnervation as any, seed.muscleInnervations.map((innervation) => innervation.id), {
    id: true,
    slug: true,
    muscleId: true,
    nerveId: true,
    description: true,
    sourceId: true,
  })

  await mapWithConcurrency(seed.muscleInnervations, async (innervation) => {
    const source = requireMapValue(sourceBySlug, innervation.sourceRef, "innervation source")
    const muscle = requireMapValue(muscleBySlug, innervation.muscle, "innervation muscle")
    const nerve = requireMapValue(nerveBySlug, innervation.nerve, "innervation nerve")
    const description = innervation.description ?? null
    const existingInnervation = existingInnervationBySlug.get(innervation.id)

    if (existingInnervation && recordMatches(existingInnervation, {
      muscleId: muscle.id,
      nerveId: nerve.id,
      description,
      sourceId: source.id,
    })) {
      return
    }

    await prisma.muscleInnervation.upsert({
      where: { slug: innervation.id },
      create: {
        id: innervation.id,
        slug: innervation.id,
        muscleId: muscle.id,
        nerveId: nerve.id,
        description,
        sourceId: source.id,
      },
      update: {
        muscleId: muscle.id,
        nerveId: nerve.id,
        description,
        sourceId: source.id,
      },
    })
  })
  mark("muscles-nerves")

  const existingLigamentBySlug = await existingRowsBySlug<{
    id: string
    slug: string
    name: string
    regionId: string
    jointId: string | null
    description: string | null
    sourceId: string
  }>(prisma.ligament as any, seed.ligaments.map((ligament) => ligament.slug), {
    id: true,
    slug: true,
    name: true,
    regionId: true,
    jointId: true,
    description: true,
    sourceId: true,
  })

  await mapWithConcurrency(seed.ligaments, async (ligament) => {
    const source = requireMapValue(sourceBySlug, ligament.sourceRef, "ligament source")
    const region = requireMapValue(regionBySlug, ligament.region, "ligament region")
    const joint = ligament.joint ? requireMapValue(jointBySlug, ligament.joint, "ligament joint") : null
    const jointId = joint?.id ?? null
    const description = ligament.description ?? null
    const existingLigament = existingLigamentBySlug.get(ligament.slug)

    if (existingLigament && recordMatches(existingLigament, {
      name: ligament.name,
      regionId: region.id,
      jointId,
      description,
      sourceId: source.id,
    })) {
      return
    }

    await prisma.ligament.upsert({
      where: { slug: ligament.slug },
      create: {
        id: ligament.id,
        slug: ligament.slug,
        name: ligament.name,
        regionId: region.id,
        jointId,
        description,
        sourceId: source.id,
      },
      update: {
        name: ligament.name,
        regionId: region.id,
        jointId,
        description,
        sourceId: source.id,
      },
    })
  })

  const existingBloodSupplyBySlug = await existingRowsBySlug<{
    id: string
    slug: string
    name: string
    kind: BloodSupplyKind
    regionId: string
    description: string | null
    sourceId: string
  }>(prisma.bloodSupply as any, seed.bloodSupply.map((bloodSupply) => bloodSupply.slug), {
    id: true,
    slug: true,
    name: true,
    kind: true,
    regionId: true,
    description: true,
    sourceId: true,
  })

  await mapWithConcurrency(seed.bloodSupply, async (bloodSupply) => {
    const source = requireMapValue(sourceBySlug, bloodSupply.sourceRef, "blood supply source")
    const region = requireMapValue(regionBySlug, bloodSupply.region, "blood supply region")
    const kind = enumValue<BloodSupplyKind>(bloodSupply.kind)
    const description = bloodSupply.description ?? null
    const existingBloodSupply = existingBloodSupplyBySlug.get(bloodSupply.slug)

    if (existingBloodSupply && recordMatches(existingBloodSupply, {
      name: bloodSupply.name,
      kind,
      regionId: region.id,
      description,
      sourceId: source.id,
    })) {
      return
    }

    await prisma.bloodSupply.upsert({
      where: { slug: bloodSupply.slug },
      create: {
        id: bloodSupply.id,
        slug: bloodSupply.slug,
        name: bloodSupply.name,
        kind,
        regionId: region.id,
        description,
        sourceId: source.id,
      },
      update: {
        name: bloodSupply.name,
        kind,
        regionId: region.id,
        description,
        sourceId: source.id,
      },
    })
  })

  const existingStructureBySlug = await existingRowsBySlug<{
    id: string
    slug: string
    name: string
    structureType: string
    regionId: string
    description: string | null
    sourceId: string
  }>(prisma.anatomyStructure as any, seed.structures.map((structure) => structure.slug), {
    id: true,
    slug: true,
    name: true,
    structureType: true,
    regionId: true,
    description: true,
    sourceId: true,
  })

  await mapWithConcurrency(seed.structures, async (structure) => {
    const source = requireMapValue(sourceBySlug, structure.sourceRef, "structure source")
    const region = requireMapValue(regionBySlug, structure.region, "structure region")
    const description = structure.description ?? null
    const existingStructure = existingStructureBySlug.get(structure.slug)

    if (existingStructure && recordMatches(existingStructure, {
      name: structure.name,
      structureType: structure.structureType,
      regionId: region.id,
      description,
      sourceId: source.id,
    })) {
      structureBySlug.set(structure.slug, { id: existingStructure.id })
      return
    }

    const row = await prisma.anatomyStructure.upsert({
      where: { slug: structure.slug },
      create: {
        id: structure.id,
        slug: structure.slug,
        name: structure.name,
        structureType: structure.structureType,
        regionId: region.id,
        description,
        sourceId: source.id,
      },
      update: {
        name: structure.name,
        structureType: structure.structureType,
        regionId: region.id,
        description,
        sourceId: source.id,
      },
    })
    structureBySlug.set(structure.slug, row)

  })

  const existingConceptBySlug = await existingRowsBySlug<{
    id: string
    slug: string
    name: string
    conceptType: string
    bodySystem: string | null
    description: string | null
    sourceId: string
  }>(prisma.anatomyConcept as any, seed.concepts.map((concept) => concept.slug), {
    id: true,
    slug: true,
    name: true,
    conceptType: true,
    bodySystem: true,
    description: true,
    sourceId: true,
  })

  await mapWithConcurrency(seed.concepts, async (concept) => {
    const source = requireMapValue(sourceBySlug, concept.sourceRef, "concept source")
    const bodySystem = concept.bodySystem ?? null
    const description = concept.description ?? null
    const existingConcept = existingConceptBySlug.get(concept.slug)

    if (existingConcept && recordMatches(existingConcept, {
      name: concept.name,
      conceptType: concept.conceptType,
      bodySystem,
      description,
      sourceId: source.id,
    })) {
      return
    }

    await prisma.anatomyConcept.upsert({
      where: { slug: concept.slug },
      create: {
        id: concept.id,
        slug: concept.slug,
        name: concept.name,
        conceptType: concept.conceptType,
        bodySystem,
        description,
        sourceId: source.id,
      },
      update: {
        name: concept.name,
        conceptType: concept.conceptType,
        bodySystem,
        description,
        sourceId: source.id,
      },
    })
  })
  mark("ligaments-vessels-structures-concepts")

  const existingPainMapRegionBySlug = await existingRowsBySlug<{
    id: string
    slug: string
    name: string
    regionId: string
    laterality: PainMapLaterality
    surface: PainMapSurface
    plainLanguageDescription: string | null
    sourceId: string
  }>(prisma.painMapRegion as any, seed.painMapRegions.map((painMapRegion) => painMapRegion.slug), {
    id: true,
    slug: true,
    name: true,
    regionId: true,
    laterality: true,
    surface: true,
    plainLanguageDescription: true,
    sourceId: true,
  })

  await mapWithConcurrency(seed.painMapRegions, async (painMapRegion) => {
    const source = requireMapValue(sourceBySlug, painMapRegion.sourceRef, "pain map source")
    const region = requireMapValue(regionBySlug, painMapRegion.region, "pain map region")
    const laterality = enumValue<PainMapLaterality>(painMapRegion.laterality ?? "unspecified")
    const surface = enumValue<PainMapSurface>(painMapRegion.surface ?? "unspecified")
    const plainLanguageDescription = painMapRegion.plainLanguageDescription ?? null
    const existingPainMapRegion = existingPainMapRegionBySlug.get(painMapRegion.slug)

    if (existingPainMapRegion && recordMatches(existingPainMapRegion, {
      name: painMapRegion.name,
      regionId: region.id,
      laterality,
      surface,
      plainLanguageDescription,
      sourceId: source.id,
    })) {
      return
    }

    await prisma.painMapRegion.upsert({
      where: { slug: painMapRegion.slug },
      create: {
        id: painMapRegion.id,
        slug: painMapRegion.slug,
        name: painMapRegion.name,
        regionId: region.id,
        laterality,
        surface,
        plainLanguageDescription,
        sourceId: source.id,
      },
      update: {
        name: painMapRegion.name,
        regionId: region.id,
        laterality,
        surface,
        plainLanguageDescription,
        sourceId: source.id,
      },
    })
  })

  const existingClientTermBySlug = await existingRowsBySlug<{
    id: string
    slug: string
    term: string
    plainLanguageDescription: string
    mappedRegionId: string | null
    mappedMuscleId: string | null
    mappedJointId: string | null
    mappedStructureId: string | null
    confidence: ClientTermConfidence
    notes: string | null
    sourceId: string
  }>(prisma.clientTerm as any, seed.clientTerms.map((clientTerm) => clientTerm.slug), {
    id: true,
    slug: true,
    term: true,
    plainLanguageDescription: true,
    mappedRegionId: true,
    mappedMuscleId: true,
    mappedJointId: true,
    mappedStructureId: true,
    confidence: true,
    notes: true,
    sourceId: true,
  })

  await mapWithConcurrency(seed.clientTerms, async (clientTerm) => {
    const source = requireMapValue(sourceBySlug, clientTerm.sourceRef, "client term source")
    const mappedRegion = clientTerm.mappedRegionSlug ? requireMapValue(regionBySlug, clientTerm.mappedRegionSlug, "client term mapped region") : null
    const mappedMuscle = clientTerm.mappedMuscleSlug ? requireMapValue(muscleBySlug, clientTerm.mappedMuscleSlug, "client term mapped muscle") : null
    const mappedJoint = clientTerm.mappedJointSlug ? requireMapValue(jointBySlug, clientTerm.mappedJointSlug, "client term mapped joint") : null
    const mappedStructure = clientTerm.mappedStructureSlug ? requireMapValue(structureBySlug, clientTerm.mappedStructureSlug, "client term mapped structure") : null
    const notes = [clientTerm.notes, clientTerm.therapistPrompt].filter(Boolean).join(" ")
    const mappedRegionId = mappedRegion?.id ?? null
    const mappedMuscleId = mappedMuscle?.id ?? null
    const mappedJointId = mappedJoint?.id ?? null
    const mappedStructureId = mappedStructure?.id ?? null
    const confidence = enumValue<ClientTermConfidence>(clientTerm.confidence)
    const storedNotes = notes || null
    const existingClientTerm = existingClientTermBySlug.get(clientTerm.slug)

    if (existingClientTerm && recordMatches(existingClientTerm, {
      term: clientTerm.term,
      plainLanguageDescription: clientTerm.plainLanguageDescription,
      mappedRegionId,
      mappedMuscleId,
      mappedJointId,
      mappedStructureId,
      confidence,
      notes: storedNotes,
      sourceId: source.id,
    })) {
      return
    }

    await prisma.clientTerm.upsert({
      where: { slug: clientTerm.slug },
      create: {
        id: clientTerm.id,
        slug: clientTerm.slug,
        term: clientTerm.term,
        plainLanguageDescription: clientTerm.plainLanguageDescription,
        mappedRegionId,
        mappedMuscleId,
        mappedJointId,
        mappedStructureId,
        confidence,
        notes: storedNotes,
        sourceId: source.id,
      },
      update: {
        term: clientTerm.term,
        plainLanguageDescription: clientTerm.plainLanguageDescription,
        mappedRegionId,
        mappedMuscleId,
        mappedJointId,
        mappedStructureId,
        confidence,
        notes: storedNotes,
        sourceId: source.id,
      },
    })
  })
  mark("pain-client-terms")

  const existingEntityTermBySlug = await existingEntityTermsBySlug(seed.entityTerms.map((entityTerm) => entityTerm.id))

  await mapWithConcurrency(seed.entityTerms, async (entityTerm) => {
    const source = requireMapValue(sourceBySlug, entityTerm.sourceRef, "entity term source")
    const anatomyEntityType = enumValue<AnatomyEntityType>(entityTerm.anatomyEntityType)
    const termType = enumValue<AnatomyEntityTermType>(entityTerm.termType)
    const languageOfOrigin = entityTerm.languageOfOrigin ?? null
    const notes = entityTerm.notes ?? null
    const existingTerm = existingEntityTermBySlug.get(entityTerm.id)

    if (
      existingTerm
      && existingTerm.anatomyEntityType === anatomyEntityType
      && existingTerm.anatomyEntitySlug === entityTerm.anatomyEntitySlug
      && existingTerm.term === entityTerm.term
      && existingTerm.termType === termType
      && existingTerm.languageOfOrigin === languageOfOrigin
      && existingTerm.notes === notes
      && existingTerm.sourceId === source.id
    ) {
      return
    }

    await prisma.anatomyEntityTerm.upsert({
      where: { slug: entityTerm.id },
      create: {
        id: entityTerm.id,
        slug: entityTerm.id,
        anatomyEntityType,
        anatomyEntitySlug: entityTerm.anatomyEntitySlug,
        term: entityTerm.term,
        termType,
        languageOfOrigin,
        notes,
        sourceId: source.id,
      },
      update: {
        anatomyEntityType,
        anatomyEntitySlug: entityTerm.anatomyEntitySlug,
        term: entityTerm.term,
        termType,
        languageOfOrigin,
        notes,
        sourceId: source.id,
      },
    })
  })

  const existingRelationshipByKey = await existingRelationshipsByKey(seed)

  await mapWithConcurrency(seed.relationships, async (relationship) => {
    const source = requireMapValue(sourceBySlug, relationship.sourceRef, "relationship source")
    const sourceEntityType = enumValue<AnatomyEntityType>(relationship.sourceEntityType)
    const targetEntityType = enumValue<AnatomyEntityType>(relationship.targetEntityType)
    const details = (relationship.details ?? {}) as Prisma.InputJsonValue
    const existingRelationship = existingRelationshipByKey.get(relationshipKey({
      sourceEntityType,
      sourceEntitySlug: relationship.sourceEntitySlug,
      relationshipType: relationship.relationshipType,
      targetEntityType,
      targetEntitySlug: relationship.targetEntitySlug,
    }))

    if (
      existingRelationship
      && existingRelationship.sourceId === source.id
      && stableJson(existingRelationship.details ?? {}) === stableJson(details)
    ) {
      return
    }

    await prisma.anatomyRelationship.upsert({
      where: {
        sourceEntityType_sourceEntitySlug_relationshipType_targetEntityType_targetEntitySlug: {
          sourceEntityType,
          sourceEntitySlug: relationship.sourceEntitySlug,
          relationshipType: relationship.relationshipType,
          targetEntityType,
          targetEntitySlug: relationship.targetEntitySlug,
        },
      },
      create: {
        id: relationship.id,
        sourceEntityType,
        sourceEntitySlug: relationship.sourceEntitySlug,
        relationshipType: relationship.relationshipType,
        targetEntityType,
        targetEntitySlug: relationship.targetEntitySlug,
        details,
        sourceId: source.id,
      },
      update: {
        details,
        sourceId: source.id,
      },
    })
  })
  mark("entity-terms-relationships")

  const existingCitationBySlug = await existingCitationsBySlug(seed.citations.map((citation) => citation.slug))

  await mapWithConcurrency(seed.citations, async (citation) => {
    const source = requireMapValue(sourceBySlug, citation.sourceRef, "citation source")
    const entityType = enumValue<AnatomyEntityType>(citation.entityType)
    const reviewStatus = enumValue<AnatomyFactReviewStatus>(citation.reviewStatus)
    const factSlug = citation.factSlug ?? null
    const sourceLocator = citation.sourceLocator ?? null
    const citationNote = citation.citationNote ?? null
    const existingCitation = existingCitationBySlug.get(citation.slug)

    if (
      existingCitation
      && existingCitation.entityType === entityType
      && existingCitation.entitySlug === citation.entitySlug
      && existingCitation.factType === citation.factType
      && existingCitation.factSlug === factSlug
      && existingCitation.sourceId === source.id
      && existingCitation.sourceLocator === sourceLocator
      && existingCitation.citationNote === citationNote
      && existingCitation.reviewStatus === reviewStatus
    ) {
      return
    }

    await prisma.anatomyCitation.upsert({
      where: { slug: citation.slug },
      create: {
        id: citation.id,
        slug: citation.slug,
        entityType,
        entitySlug: citation.entitySlug,
        factType: citation.factType,
        factSlug,
        sourceId: source.id,
        sourceLocator,
        citationNote,
        reviewStatus,
      },
      update: {
        entityType,
        entitySlug: citation.entitySlug,
        factType: citation.factType,
        factSlug,
        sourceId: source.id,
        sourceLocator,
        citationNote,
        reviewStatus,
      },
    })
  })
  mark("citations")

  const existingExternalIdentifierById = await existingExternalIdentifiersById(seed.externalIdentifiers.map((identifier) => identifier.id))

  await mapWithConcurrency(seed.externalIdentifiers, async (identifier) => {
    const source = requireMapValue(sourceBySlug, identifier.sourceRef, "external identifier source")
    const entityType = enumValue<AnatomyEntityType>(identifier.entityType)
    const iri = identifier.iri ?? null
    const label = identifier.label ?? null
    const existingIdentifier = existingExternalIdentifierById.get(identifier.id)

    if (
      existingIdentifier
      && existingIdentifier.entityType === entityType
      && existingIdentifier.entitySlug === identifier.entitySlug
      && existingIdentifier.provider === identifier.provider
      && existingIdentifier.identifier === identifier.identifier
      && existingIdentifier.iri === iri
      && existingIdentifier.label === label
      && existingIdentifier.sourceId === source.id
    ) {
      return
    }

    await prisma.externalAnatomyIdentifier.upsert({
      where: { id: identifier.id },
      create: {
        id: identifier.id,
        entityType,
        entitySlug: identifier.entitySlug,
        provider: identifier.provider,
        identifier: identifier.identifier,
        iri,
        label,
        sourceId: source.id,
      },
      update: {
        entityType,
        entitySlug: identifier.entitySlug,
        provider: identifier.provider,
        identifier: identifier.identifier,
        iri,
        label,
        sourceId: source.id,
      },
    })
  })
  mark("external-identifiers")

  const mediaAssetBySlug = new Map<string, { id: string }>()
  const existingMediaAssetBySlug = await existingMediaAssetsBySlug(seed.mediaAssets.map((asset) => asset.slug))

  await mapWithConcurrency(seed.mediaAssets, async (asset) => {
    const source = requireMapValue(sourceBySlug, asset.sourceRef, "media asset source")
    const existingAsset = existingMediaAssetBySlug.get(asset.slug)
    const remoteUrl = seededMediaRemoteUrl(asset, existingAsset)
    const metadata = seededMediaMetadata(asset, existingAsset)
    const mediaType = enumValue<AnatomyMediaType>(asset.mediaType)
    const description = asset.description ?? null
    const storagePath = asset.storagePath ?? null
    const thumbnailUrl = asset.thumbnailUrl ?? null
    const author = asset.author ?? null
    const usageScope = enumValue<AnatomySourceUsageScope>(asset.usageScope)
    const reviewStatus = enumValue<AnatomyFactReviewStatus>(asset.reviewStatus)
    const width = asset.width ?? null
    const height = asset.height ?? null
    const format = asset.format ?? null

    if (
      existingAsset
      && existingAsset.title === asset.title
      && existingAsset.mediaType === mediaType
      && existingAsset.description === description
      && existingAsset.sourceId === source.id
      && existingAsset.sourceUrl === asset.sourceUrl
      && existingAsset.remoteUrl === remoteUrl
      && existingAsset.storagePath === storagePath
      && existingAsset.thumbnailUrl === thumbnailUrl
      && existingAsset.license === asset.license
      && existingAsset.licenseUrl === asset.licenseUrl
      && existingAsset.attribution === asset.attribution
      && existingAsset.author === author
      && existingAsset.usageScope === usageScope
      && existingAsset.reviewStatus === reviewStatus
      && existingAsset.width === width
      && existingAsset.height === height
      && existingAsset.format === format
      && stableJson(existingAsset.metadata ?? {}) === stableJson(metadata)
    ) {
      mediaAssetBySlug.set(asset.slug, { id: existingAsset.id })
      return
    }

    const row = await prisma.anatomyMediaAsset.upsert({
      where: { slug: asset.slug },
      create: {
        id: asset.id,
        slug: asset.slug,
        title: asset.title,
        mediaType,
        description,
        sourceId: source.id,
        sourceUrl: asset.sourceUrl,
        remoteUrl,
        storagePath,
        thumbnailUrl,
        license: asset.license,
        licenseUrl: asset.licenseUrl,
        attribution: asset.attribution,
        author,
        usageScope,
        reviewStatus,
        width,
        height,
        format,
        metadata,
      },
      update: {
        title: asset.title,
        mediaType,
        description,
        sourceId: source.id,
        sourceUrl: asset.sourceUrl,
        remoteUrl,
        storagePath,
        thumbnailUrl,
        license: asset.license,
        licenseUrl: asset.licenseUrl,
        attribution: asset.attribution,
        author,
        usageScope,
        reviewStatus,
        width,
        height,
        format,
        metadata,
      },
    })

    mediaAssetBySlug.set(asset.slug, row)
  })
  mark("media-assets")

  const existingMediaLinkByKey = await existingMediaLinksByKey([...mediaAssetBySlug.values()].map((asset) => asset.id))

  await mapWithConcurrency(seed.mediaEntityLinks, async (link) => {
    const asset = requireMapValue(mediaAssetBySlug, link.assetSlug, "media entity asset")
    const entityType = enumValue<AnatomyEntityType>(link.entityType)
    const role = enumValue<AnatomyMediaRole>(link.role)
    const notes = link.notes ?? null
    const existingLink = existingMediaLinkByKey.get(mediaLinkKey({
      assetId: asset.id,
      entityType,
      entitySlug: link.entitySlug,
      role,
    }))

    if (existingLink && existingLink.notes === notes) {
      return
    }

    await prisma.anatomyMediaEntity.upsert({
      where: {
        assetId_entityType_entitySlug_role: {
          assetId: asset.id,
          entityType,
          entitySlug: link.entitySlug,
          role,
        },
      },
      create: {
        id: link.id,
        assetId: asset.id,
        entityType,
        entitySlug: link.entitySlug,
        role,
        notes,
      },
      update: {
        notes,
      },
    })
  })
  mark("media-links")
}

async function cleanupObsoleteFoundationSources(seed: AnatomyFoundationSeed) {
  const currentGeneratedCitationSlugs = seed.citations
    .filter((citation) => citation.slug.startsWith("citation-source-ref-"))
    .map((citation) => citation.slug)

  await prisma.anatomyCitation.deleteMany({
    where: {
      slug: {
        startsWith: "citation-source-ref-",
        notIn: currentGeneratedCitationSlugs,
      },
    },
  })

  await prisma.anatomyCitation.deleteMany({
    where: {
      source: {
        slug: { in: OBSOLETE_FOUNDATION_SOURCE_SLUGS },
      },
    },
  })

  await prisma.anatomyRelationship.deleteMany({
    where: {
      source: {
        slug: { in: OBSOLETE_FOUNDATION_SOURCE_SLUGS },
      },
    },
  })

  await prisma.muscleAttachment.deleteMany({
    where: {
      source: {
        slug: { in: OBSOLETE_FOUNDATION_SOURCE_SLUGS },
      },
    },
  })

  await prisma.muscleInnervation.deleteMany({
    where: {
      source: {
        slug: { in: OBSOLETE_FOUNDATION_SOURCE_SLUGS },
      },
    },
  })

  await prisma.externalAnatomyIdentifier.deleteMany({
    where: {
      source: {
        slug: { in: OBSOLETE_FOUNDATION_SOURCE_SLUGS },
      },
    },
  })

  await prisma.anatomySource.deleteMany({
    where: {
      slug: { in: OBSOLETE_FOUNDATION_SOURCE_SLUGS },
      refs: { none: {} },
      anatomyRegions: { none: {} },
      bloodSupply: { none: {} },
      bones: { none: {} },
      boneLandmarks: { none: {} },
      joints: { none: {} },
      jointMovements: { none: {} },
      rangesOfMotion: { none: {} },
      muscles: { none: {} },
      muscleAttachments: { none: {} },
      muscleActions: { none: {} },
      nerves: { none: {} },
      muscleInnervations: { none: {} },
      ligaments: { none: {} },
      structures: { none: {} },
      concepts: { none: {} },
      painMapRegions: { none: {} },
      clientTerms: { none: {} },
      entityTerms: { none: {} },
      relationships: { none: {} },
      citations: { none: {} },
      externalIdentifiers: { none: {} },
      mediaAssets: { none: {} },
    },
  })
}

async function seedGenericAnatomyTerms() {
  const sourceSlugs = getAnatomySources().map((source) => source.id)
  for (const source of getAnatomySources()) {
    await seedSource(source)
  }

  const sourceRows = await prisma.anatomySource.findMany({
    where: { slug: { in: sourceSlugs } },
    select: { id: true, slug: true },
  })
  const sourceBySlug = new Map(sourceRows.map((source) => [source.slug, source]))
  const existingTermBySlug = await existingRowsBySlug<{
    id: string
    slug: string
    kind: AnatomyKind
    preferredName: string
    summary: string | null
    regions: string[]
    bodySystems: string[]
    difficulty: AnatomyDifficulty
    status: string
  }>(prisma.anatomyTerm as any, anatomyTerms.map((term) => term.id), {
    id: true,
    slug: true,
    kind: true,
    preferredName: true,
    summary: true,
    regions: true,
    bodySystems: true,
    difficulty: true,
    status: true,
  })
  const anatomyTermBySlug = new Map<string, { id: string }>()

  await mapWithConcurrency(anatomyTerms, async (term) => {
    const kind = toEnum<AnatomyKind>(term.kind)
    const summary = term.definition ?? null
    const bodySystems = bodySystemsForTerm(term)
    const difficulty = toEnum<AnatomyDifficulty>(term.difficulty, "MEDIUM")
    const existingTerm = existingTermBySlug.get(term.id)

    if (existingTerm && recordMatches(existingTerm, {
      kind,
      preferredName: term.name,
      summary,
      regions: term.regions,
      bodySystems,
      difficulty,
      status: "PUBLISHED",
    })) {
      anatomyTermBySlug.set(term.id, { id: existingTerm.id })
      return
    }

    const anatomyTerm = await prisma.anatomyTerm.upsert({
      where: { slug: term.id },
      create: {
        slug: term.id,
        kind,
        preferredName: term.name,
        summary,
        regions: term.regions,
        bodySystems,
        difficulty,
        status: "PUBLISHED",
      },
      update: {
        kind,
        preferredName: term.name,
        summary,
        regions: term.regions,
        bodySystems,
        difficulty,
        status: "PUBLISHED",
      },
    })

    anatomyTermBySlug.set(term.id, anatomyTerm)
  })

  const aliasRows = anatomyTerms.flatMap((term) => {
    const anatomyTerm = requireMapValue(anatomyTermBySlug, term.id, "generic anatomy term")
    return (term.aliases ?? []).map((alias) => ({
      termId: anatomyTerm.id,
      alias,
    }))
  })
  const sourceRefRows = anatomyTerms.flatMap((term) => {
    const anatomyTerm = requireMapValue(anatomyTermBySlug, term.id, "generic anatomy term")

    return (term.sourceRefs ?? [])
      .map((sourceRef) => {
        const source = sourceBySlug.get(sourceRef)
        if (!source) return null

        return {
          termId: anatomyTerm.id,
          sourceId: source.id,
        }
      })
      .filter((row): row is { termId: string; sourceId: string } => Boolean(row))
  })
  const existingAliasKeys = await existingAnatomyAliasKeys([...anatomyTermBySlug.values()].map((term) => term.id))
  const existingSourceRefKeys = await existingAnatomySourceRefKeys([...anatomyTermBySlug.values()].map((term) => term.id))

  await mapWithConcurrency(aliasRows, async (row) => {
    if (existingAliasKeys.has([row.termId, row.alias].join("\u0000"))) return

    await prisma.anatomyAlias.upsert({
      where: {
        termId_alias: {
          termId: row.termId,
          alias: row.alias,
        },
      },
      create: row,
      update: {},
    })
  })

  await mapWithConcurrency(sourceRefRows, async (row) => {
    if (existingSourceRefKeys.has(termSourceRefKey(row))) return

    await prisma.anatomySourceRef.upsert({
      where: {
        termId_sourceId: row,
      },
      create: row,
      update: {},
    })
  })
}

async function main() {
  const mark = seedTimingMarker("main")
  await seedGenericAnatomyTerms()
  mark("generic-anatomy-terms")
  await seedAnatomyFoundation(ANATOMY_FOUNDATION_SEED)
  mark("anatomy-foundation")
  await cleanupObsoleteFoundationSources(ANATOMY_FOUNDATION_SEED)
  mark("cleanup")
}

main()
  .finally(async () => {
    await prisma.$disconnect()
  })
