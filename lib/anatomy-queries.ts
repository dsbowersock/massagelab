import { prisma as defaultPrisma } from "./prisma.ts"

export type AnatomySearchEntityType =
  | "REGION"
  | "BLOOD_SUPPLY"
  | "ANATOMY_STRUCTURE"
  | "ANATOMY_CONCEPT"
  | "BONE"
  | "BONE_LANDMARK"
  | "JOINT"
  | "JOINT_MOVEMENT"
  | "MUSCLE"
  | "NERVE"
  | "LIGAMENT"
  | "PAIN_MAP_REGION"
  | "CLIENT_TERM"

export type AnatomySearchResult = {
  entityType: AnatomySearchEntityType
  slug: string
  label: string
  detail?: string | null
  matchedTerm?: string
  termType?: string
  sourceLabel?: string | null
}

export type AnatomyQuickQueryKey =
  | "scapula-attachments"
  | "accessory-nerve"
  | "shoulder-abduction"
  | "cervical-rotation-rom"
  | "scapular-pain-overlaps"
  | "between-shoulder-blades"
  | "top-of-shoulder"
  | "base-of-skull-client-language"
  | "has-reviewed-citations"
  | "missing-citations"
  | "has-open-media"
  | "spatial-review-queue"
  | "game-ready-prompts"

export type AnatomyAdminQuickQuery = {
  key: AnatomyQuickQueryKey
  label: string
  description: string
}

export const ANATOMY_ENTITY_TYPES = [
  "REGION",
  "BLOOD_SUPPLY",
  "ANATOMY_STRUCTURE",
  "ANATOMY_CONCEPT",
  "BONE",
  "BONE_LANDMARK",
  "JOINT",
  "JOINT_MOVEMENT",
  "RANGE_OF_MOTION",
  "MUSCLE",
  "MUSCLE_ATTACHMENT",
  "MUSCLE_ACTION",
  "NERVE",
  "MUSCLE_INNERVATION",
  "LIGAMENT",
  "PAIN_MAP_REGION",
  "CLIENT_TERM",
] as const

export type AnatomyEntityTypeValue = typeof ANATOMY_ENTITY_TYPES[number]

export type AnatomyEntitySelection = {
  entityType: AnatomyEntityTypeValue
  entitySlug: string
}

type QueryDelegate = {
  findMany: (args: Record<string, unknown>) => Promise<unknown[]>
  findFirst?: (args: Record<string, unknown>) => Promise<unknown | null>
}

type AnatomyQueryClient = {
  anatomyCitation?: QueryDelegate
  anatomyConcept?: QueryDelegate
  anatomyEntityTerm?: QueryDelegate
  anatomyMediaAsset?: QueryDelegate
  anatomyMediaViewRequest?: QueryDelegate
  anatomyRegion?: QueryDelegate
  anatomyStructure?: QueryDelegate
  anatomyRelationship?: QueryDelegate
  anatomyMovementVisualization?: QueryDelegate
  anatomySpatialEntityMap?: QueryDelegate
  anatomySpatialModel?: QueryDelegate
  bloodSupply?: QueryDelegate
  bone?: QueryDelegate
  boneLandmark?: QueryDelegate
  clientTerm?: QueryDelegate
  joint?: QueryDelegate
  jointMovement?: QueryDelegate
  ligament?: QueryDelegate
  muscle?: QueryDelegate
  muscleAction?: QueryDelegate
  nerve?: QueryDelegate
  painMapRegion?: QueryDelegate
  rangeOfMotion?: QueryDelegate
  externalAnatomyIdentifier?: QueryDelegate
}

export const ANATOMY_ADMIN_QUICK_QUERIES: AnatomyAdminQuickQuery[] = [
  {
    key: "scapula-attachments",
    label: "Scapula attachments",
    description: "Muscles with origins or insertions on the scapula.",
  },
  {
    key: "accessory-nerve",
    label: "Accessory nerve",
    description: "Muscles innervated by the accessory nerve.",
  },
  {
    key: "shoulder-abduction",
    label: "Shoulder abduction",
    description: "Muscle actions contributing to shoulder abduction.",
  },
  {
    key: "cervical-rotation-rom",
    label: "Cervical rotation ROM",
    description: "Typical cervical rotation range-of-motion entry.",
  },
  {
    key: "scapular-pain-overlaps",
    label: "Scapular pain overlaps",
    description: "Pain-map regions overlapping the scapular region.",
  },
  {
    key: "between-shoulder-blades",
    label: "Between shoulder blades",
    description: "Client-language mapping for interscapular language.",
  },
  {
    key: "top-of-shoulder",
    label: "Top of shoulder",
    description: "Client-language mapping for upper shoulder language.",
  },
  {
    key: "base-of-skull-client-language",
    label: "Base of skull",
    description: "Client-language mapping for occipital/suboccipital language.",
  },
  {
    key: "has-reviewed-citations",
    label: "Reviewed citations",
    description: "Entities and facts with reviewed citation records.",
  },
  {
    key: "missing-citations",
    label: "Missing citations",
    description: "Starter or review-only facts that still need citation lock-in.",
  },
  {
    key: "has-open-media",
    label: "Open-license media",
    description: "Entities with reviewed open-license media or model candidates.",
  },
  {
    key: "spatial-review-queue",
    label: "3D review queue",
    description: "Spatial maps and ROM visualizations still pending runtime/model review.",
  },
  {
    key: "game-ready-prompts",
    label: "Game-ready prompts",
    description: "Muscles and structures with enough terms and relationships for game prompts.",
  },
]

export function normalizeAnatomySearchQuery(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase()
}

export function parseAnatomyEntitySelection(entityType: string | undefined | null, entitySlug: string | undefined | null): AnatomyEntitySelection | null {
  const normalizedType = entityType?.trim().toUpperCase()
  const normalizedSlug = entitySlug?.trim().toLowerCase().replace(/\s+/g, "-")

  if (!normalizedType || !normalizedSlug || !ANATOMY_ENTITY_TYPES.includes(normalizedType as AnatomyEntityTypeValue)) {
    return null
  }

  return {
    entityType: normalizedType as AnatomyEntityTypeValue,
    entitySlug: normalizedSlug,
  }
}

export function buildAnatomyEntityHref({
  entityType,
  entitySlug,
  view,
  q,
  quick,
}: AnatomyEntitySelection & {
  view?: string
  q?: string
  quick?: string
}) {
  const params = new URLSearchParams()

  if (view) params.set("view", view)
  if (q) params.set("q", q)
  if (quick) params.set("quick", quick)
  params.set("entityType", entityType)
  params.set("entitySlug", entitySlug)

  return `/admin/anatomy?${params.toString()}`
}

function contains(value: string) {
  return { contains: value, mode: "insensitive" }
}

function textValue(value: unknown) {
  return typeof value === "string" ? value : null
}

function rowSourceLabel(row: Record<string, unknown>) {
  const source = row.source

  if (!source || typeof source !== "object") {
    return null
  }

  return textValue((source as Record<string, unknown>).label)
}

function mapNamedRow(entityType: AnatomySearchEntityType, row: unknown): AnatomySearchResult | null {
  if (!row || typeof row !== "object") {
    return null
  }

  const record = row as Record<string, unknown>
  const slug = textValue(record.slug)
  const label = textValue(record.name) ?? textValue(record.term) ?? textValue(record.movementName)

  if (!slug || !label) {
    return null
  }

  return {
    entityType,
    slug,
    label,
    detail: textValue(record.description) ?? textValue(record.plainLanguageDescription) ?? textValue(record.jointType),
    sourceLabel: rowSourceLabel(record),
  }
}

function mapEntityTerm(row: unknown): AnatomySearchResult | null {
  if (!row || typeof row !== "object") {
    return null
  }

  const record = row as Record<string, unknown>
  const entityType = textValue(record.anatomyEntityType) as AnatomySearchEntityType | null
  const slug = textValue(record.anatomyEntitySlug)
  const term = textValue(record.term)

  if (!entityType || !slug || !term) {
    return null
  }

  return {
    entityType,
    slug,
    label: term,
    matchedTerm: term,
    termType: textValue(record.termType) ?? undefined,
    sourceLabel: rowSourceLabel(record),
  }
}

function uniqueSearchResults(results: AnatomySearchResult[]) {
  const byKey = new Map<string, AnatomySearchResult>()

  for (const result of results) {
    const key = `${result.entityType}:${result.slug}`
    const existing = byKey.get(key)

    if (!existing || (!existing.matchedTerm && result.matchedTerm)) {
      byKey.set(key, result)
    }
  }

  return [...byKey.values()]
}

function requireDelegate<T extends keyof AnatomyQueryClient>(client: AnatomyQueryClient, key: T): NonNullable<AnatomyQueryClient[T]> {
  const delegate = client[key]

  if (!delegate) {
    throw new Error(`Anatomy query helper requires prisma.${String(key)}.`)
  }

  return delegate
}

function optionalFindMany<T extends keyof AnatomyQueryClient>(client: AnatomyQueryClient, key: T, args: Record<string, unknown>) {
  const delegate = client[key]

  return delegate?.findMany(args) ?? Promise.resolve([])
}

const ENTITY_DELEGATE_BY_TYPE: Partial<Record<AnatomyEntityTypeValue, keyof AnatomyQueryClient>> = {
  REGION: "anatomyRegion",
  BLOOD_SUPPLY: "bloodSupply",
  ANATOMY_STRUCTURE: "anatomyStructure",
  ANATOMY_CONCEPT: "anatomyConcept",
  BONE: "bone",
  BONE_LANDMARK: "boneLandmark",
  JOINT: "joint",
  JOINT_MOVEMENT: "jointMovement",
  RANGE_OF_MOTION: "rangeOfMotion",
  MUSCLE: "muscle",
  NERVE: "nerve",
  LIGAMENT: "ligament",
  PAIN_MAP_REGION: "painMapRegion",
  CLIENT_TERM: "clientTerm",
}

type CandidateOptions = {
  entityTypes?: AnatomyEntityTypeValue[]
  regionSlug?: string
  sectionSlug?: string
  take?: number
}

export function createAnatomyQueryHelpers(client: AnatomyQueryClient = defaultPrisma as unknown as AnatomyQueryClient) {
  return {
    getMusclesAttachedToBone(boneSlug: string) {
      return requireDelegate(client, "muscle").findMany({
        where: {
          attachments: {
            some: {
              bone: { slug: boneSlug },
            },
          },
        },
        include: {
          region: true,
          source: true,
          attachments: { include: { bone: true, landmark: true } },
          innervations: { include: { nerve: true } },
          actions: { include: { joint: true, movement: true } },
        },
        orderBy: { name: "asc" },
      })
    },

    getMusclesByInnervation(nerveSlug: string) {
      return requireDelegate(client, "muscle").findMany({
        where: {
          innervations: {
            some: {
              nerve: { slug: nerveSlug },
            },
          },
        },
        include: {
          region: true,
          source: true,
          innervations: { include: { nerve: true } },
          attachments: { include: { bone: true, landmark: true } },
          actions: { include: { joint: true, movement: true } },
        },
        orderBy: { name: "asc" },
      })
    },

    getMusclesForMovement(movementSlug: string) {
      return requireDelegate(client, "muscleAction").findMany({
        where: {
          movement: { slug: movementSlug },
        },
        include: {
          muscle: { include: { region: true } },
          joint: true,
          movement: true,
          source: true,
        },
        orderBy: [{ role: "asc" }, { muscle: { name: "asc" } }],
      })
    },

    getRangeOfMotion(jointSlug: string, movementSlug: string) {
      const delegate = requireDelegate(client, "rangeOfMotion")

      if (!delegate.findFirst) {
        throw new Error("Anatomy ROM helper requires prisma.rangeOfMotion.findFirst.")
      }

      return delegate.findFirst({
        where: {
          joint: { slug: jointSlug },
          movement: { slug: movementSlug },
        },
        include: {
          joint: true,
          movement: true,
          source: true,
        },
      })
    },

    getClientTermMappings(query: string) {
      const normalizedQuery = normalizeAnatomySearchQuery(query)

      return requireDelegate(client, "clientTerm").findMany({
        where: {
          OR: [
            { term: contains(normalizedQuery) },
            { slug: contains(normalizedQuery.replaceAll(" ", "-")) },
            { plainLanguageDescription: contains(normalizedQuery) },
            { notes: contains(normalizedQuery) },
          ],
        },
        include: {
          mappedRegion: true,
          mappedMuscle: true,
          mappedJoint: true,
          mappedStructure: true,
          source: true,
        },
        orderBy: { term: "asc" },
        take: 20,
      })
    },

    getPainMapOverlaps(regionSlug: string) {
      return requireDelegate(client, "anatomyRelationship").findMany({
        where: {
          sourceEntityType: "PAIN_MAP_REGION",
          relationshipType: "overlaps_region",
          targetEntityType: "REGION",
          targetEntitySlug: regionSlug,
        },
        include: {
          source: true,
        },
        orderBy: { sourceEntitySlug: "asc" },
      })
    },

    getEntityCitations(entityType: AnatomyEntityTypeValue, entitySlug: string) {
      return requireDelegate(client, "anatomyCitation").findMany({
        where: {
          entityType,
          entitySlug,
        },
        include: {
          source: true,
        },
        orderBy: [{ reviewStatus: "asc" }, { slug: "asc" }],
      })
    },

    getEntityExternalIdentifiers(entityType: AnatomyEntityTypeValue, entitySlug: string) {
      return requireDelegate(client, "externalAnatomyIdentifier").findMany({
        where: {
          entityType,
          entitySlug,
        },
        include: {
          source: true,
        },
        orderBy: [{ provider: "asc" }, { identifier: "asc" }],
      })
    },

    getEntityMediaAssets(entityType: AnatomyEntityTypeValue, entitySlug: string, options: { openLicenseOnly?: boolean } = {}) {
      return requireDelegate(client, "anatomyMediaAsset").findMany({
        where: {
          entityLinks: {
            some: {
              entityType,
              entitySlug,
            },
          },
          ...(options.openLicenseOnly ? { usageScope: "OPEN_REUSE", reviewStatus: "REVIEWED" } : {}),
        },
        include: {
          source: true,
          entityLinks: {
            where: { entityType, entitySlug },
          },
        },
        orderBy: [{ reviewStatus: "asc" }, { title: "asc" }],
      })
    },

    getEntitySpatialMappings(entityType: AnatomyEntityTypeValue, entitySlug: string, options: { modelSlug?: string; selectableOnly?: boolean } = {}) {
      return requireDelegate(client, "anatomySpatialEntityMap").findMany({
        where: {
          entityType,
          entitySlug,
          ...(options.selectableOnly ? { selectable: true } : {}),
          ...(options.modelSlug ? { model: { slug: options.modelSlug } } : {}),
        },
        include: {
          model: true,
          source: true,
        },
        orderBy: [{ mappingPrecision: "asc" }, { slug: "asc" }],
      })
    },

    getBodyMapSpatialTargets(options: { modelSlug?: string; painSelectionOnly?: boolean } = {}) {
      return requireDelegate(client, "anatomySpatialEntityMap").findMany({
        where: {
          selectable: true,
          ...(options.painSelectionOnly ? { painSelectionTarget: true } : {}),
          ...(options.modelSlug ? { model: { slug: options.modelSlug } } : {}),
        },
        include: {
          model: true,
          source: true,
        },
        orderBy: [{ entityType: "asc" }, { entitySlug: "asc" }],
      })
    },

    getMovementVisualization(jointSlug: string, movementSlug: string, options: { modelSlug?: string } = {}) {
      return requireDelegate(client, "anatomyMovementVisualization").findMany({
        where: {
          joint: { slug: jointSlug },
          movement: { slug: movementSlug },
          ...(options.modelSlug ? { model: { slug: options.modelSlug } } : {}),
        },
        include: {
          model: true,
          joint: true,
          movement: true,
          rangeOfMotion: true,
          source: true,
        },
        orderBy: [{ reviewStatus: "asc" }, { slug: "asc" }],
      })
    },

    async getAnatomyEntityDetail(entityType: AnatomyEntityTypeValue, entitySlug: string) {
      const delegateKey = ENTITY_DELEGATE_BY_TYPE[entityType]

      if (!delegateKey) {
        throw new Error(`Anatomy entity detail does not support ${entityType}.`)
      }

      const delegate = requireDelegate(client, delegateKey)

      if (!delegate.findFirst) {
        throw new Error(`Anatomy entity detail requires prisma.${delegateKey}.findFirst.`)
      }

      const movementVisualizationWhere = {
        OR: [
          { primaryEntityType: entityType, primaryEntitySlug: entitySlug },
          ...(entityType === "JOINT" ? [{ joint: { slug: entitySlug } }] : []),
          ...(entityType === "JOINT_MOVEMENT" ? [{ movement: { slug: entitySlug } }] : []),
        ],
      }
      const [entity, outgoingRelationships, incomingRelationships, citations, mediaAssets, mediaViewRequests, externalIdentifiers, spatialMappings, movementVisualizations] = await Promise.all([
        delegate.findFirst({ where: { slug: entitySlug } }),
        requireDelegate(client, "anatomyRelationship").findMany({
          where: { sourceEntityType: entityType, sourceEntitySlug: entitySlug },
          include: { source: true },
          orderBy: { relationshipType: "asc" },
        }),
        requireDelegate(client, "anatomyRelationship").findMany({
          where: { targetEntityType: entityType, targetEntitySlug: entitySlug },
          include: { source: true },
          orderBy: { relationshipType: "asc" },
        }),
        requireDelegate(client, "anatomyCitation").findMany({
          where: { entityType, entitySlug },
          include: { source: true },
          orderBy: [{ reviewStatus: "asc" }, { slug: "asc" }],
        }),
        requireDelegate(client, "anatomyMediaAsset").findMany({
          where: { entityLinks: { some: { entityType, entitySlug } } },
          include: {
            source: true,
            entityLinks: {
              where: { entityType, entitySlug },
            },
          },
          orderBy: [{ reviewStatus: "asc" }, { title: "asc" }],
        }),
        optionalFindMany(client, "anatomyMediaViewRequest", {
          where: { entityType, entitySlug },
          orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        }),
        requireDelegate(client, "externalAnatomyIdentifier").findMany({
          where: { entityType, entitySlug },
          include: { source: true },
          orderBy: [{ provider: "asc" }, { identifier: "asc" }],
        }),
        optionalFindMany(client, "anatomySpatialEntityMap", {
          where: { entityType, entitySlug },
          include: { model: true, source: true },
          orderBy: [{ mappingPrecision: "asc" }, { slug: "asc" }],
        }),
        movementVisualizationWhere.OR.length > 0
          ? optionalFindMany(client, "anatomyMovementVisualization", {
            where: movementVisualizationWhere,
            include: {
              model: true,
              joint: true,
              movement: true,
              rangeOfMotion: true,
              source: true,
            },
            orderBy: [{ reviewStatus: "asc" }, { slug: "asc" }],
          })
          : Promise.resolve([]),
      ])

      return {
        entityType,
        entitySlug,
        entity,
        relationships: {
          outgoing: outgoingRelationships,
          incoming: incomingRelationships,
        },
        citations,
        mediaAssets,
        mediaViewRequests,
        externalIdentifiers,
        spatialMappings,
        movementVisualizations,
      }
    },

    async getFlashcardCandidates(options: CandidateOptions = {}) {
      const entityTypes = options.entityTypes ?? ["MUSCLE"]
      const take = options.take ?? 50
      const regionSlug = options.regionSlug ?? options.sectionSlug
      const results: unknown[] = []

      if (entityTypes.includes("MUSCLE")) {
        results.push(...await requireDelegate(client, "muscle").findMany({
          where: {
            ...(regionSlug ? { region: { slug: regionSlug } } : {}),
          },
          include: {
            region: true,
            actions: { include: { joint: true, movement: true } },
            attachments: { include: { bone: true, landmark: true } },
            innervations: { include: { nerve: true } },
            source: true,
          },
          orderBy: { name: "asc" },
          take,
        }))
      }

      if (entityTypes.includes("ANATOMY_STRUCTURE")) {
        results.push(...await requireDelegate(client, "anatomyStructure").findMany({
          where: {
            ...(regionSlug ? { region: { slug: regionSlug } } : {}),
          },
          include: {
            region: true,
            source: true,
          },
          orderBy: { name: "asc" },
          take,
        }))
      }

      if (entityTypes.includes("ANATOMY_CONCEPT")) {
        results.push(...await requireDelegate(client, "anatomyConcept").findMany({
          include: {
            source: true,
          },
          orderBy: { name: "asc" },
          take,
        }))
      }

      return results
    },

    getAnatomyGamePromptPool(options: CandidateOptions = {}) {
      const regionSlug = options.regionSlug ?? options.sectionSlug

      return requireDelegate(client, "muscle").findMany({
        where: {
          ...(regionSlug ? { region: { slug: regionSlug } } : {}),
          actions: { some: {} },
          attachments: { some: {} },
          innervations: { some: {} },
        },
        include: {
          region: true,
          actions: { include: { joint: true, movement: true } },
          attachments: { include: { bone: true, landmark: true } },
          innervations: { include: { nerve: true } },
          source: true,
        },
        orderBy: { name: "asc" },
        take: options.take ?? 50,
      })
    },

    getSoapAnatomyTags(options: { phrase?: string; bodyRegionSlug?: string } = {}) {
      const phrase = normalizeAnatomySearchQuery(options.phrase ?? "")

      return requireDelegate(client, "clientTerm").findMany({
        where: {
          OR: [
            ...(phrase ? [
              { term: contains(phrase) },
              { slug: contains(phrase.replaceAll(" ", "-")) },
              { plainLanguageDescription: contains(phrase) },
              { notes: contains(phrase) },
            ] : []),
            ...(options.bodyRegionSlug ? [{ mappedRegion: { slug: options.bodyRegionSlug } }] : []),
          ],
        },
        include: {
          mappedRegion: true,
          mappedMuscle: true,
          mappedJoint: true,
          mappedStructure: true,
          source: true,
        },
        orderBy: { confidence: "asc" },
        take: 20,
      })
    },

    getBodyMapRegionMappings(regionSlug: string) {
      return requireDelegate(client, "painMapRegion").findMany({
        where: {
          region: { slug: regionSlug },
        },
        include: {
          region: true,
          source: true,
        },
        orderBy: { name: "asc" },
      })
    },

    async searchAnatomyEntities(query: string, take = 12) {
      const normalizedQuery = normalizeAnatomySearchQuery(query)

      if (!normalizedQuery) {
        return []
      }

      const slugQuery = normalizedQuery.replaceAll(" ", "-")
      const sourceInclude = { source: true }
      const [
        regions,
        bones,
        landmarks,
        joints,
        movements,
        muscles,
        nerves,
        ligaments,
        bloodSupply,
        painMapRegions,
        clientTerms,
        structures,
        concepts,
        entityTerms,
      ] = await Promise.all([
        requireDelegate(client, "anatomyRegion").findMany({
          where: { OR: [{ slug: contains(slugQuery) }, { name: contains(normalizedQuery) }, { description: contains(normalizedQuery) }] },
          include: sourceInclude,
          take,
        }),
        requireDelegate(client, "bone").findMany({
          where: { OR: [{ slug: contains(slugQuery) }, { name: contains(normalizedQuery) }, { formalName: contains(normalizedQuery) }, { description: contains(normalizedQuery) }] },
          include: sourceInclude,
          take,
        }),
        requireDelegate(client, "boneLandmark").findMany({
          where: { OR: [{ slug: contains(slugQuery) }, { name: contains(normalizedQuery) }, { description: contains(normalizedQuery) }] },
          include: sourceInclude,
          take,
        }),
        requireDelegate(client, "joint").findMany({
          where: { OR: [{ slug: contains(slugQuery) }, { name: contains(normalizedQuery) }, { jointType: contains(normalizedQuery) }, { description: contains(normalizedQuery) }] },
          include: sourceInclude,
          take,
        }),
        requireDelegate(client, "jointMovement").findMany({
          where: { OR: [{ slug: contains(slugQuery) }, { movementName: contains(normalizedQuery) }, { description: contains(normalizedQuery) }] },
          include: sourceInclude,
          take,
        }),
        requireDelegate(client, "muscle").findMany({
          where: {
            OR: [
              { slug: contains(slugQuery) },
              { name: contains(normalizedQuery) },
              { formalName: contains(normalizedQuery) },
              { alternateNames: { has: normalizedQuery } },
              { description: contains(normalizedQuery) },
            ],
          },
          include: sourceInclude,
          take,
        }),
        requireDelegate(client, "nerve").findMany({
          where: { OR: [{ slug: contains(slugQuery) }, { name: contains(normalizedQuery) }, { nerveRoots: { has: normalizedQuery.toUpperCase() } }, { description: contains(normalizedQuery) }] },
          include: sourceInclude,
          take,
        }),
        requireDelegate(client, "ligament").findMany({
          where: { OR: [{ slug: contains(slugQuery) }, { name: contains(normalizedQuery) }, { description: contains(normalizedQuery) }] },
          include: sourceInclude,
          take,
        }),
        requireDelegate(client, "bloodSupply").findMany({
          where: { OR: [{ slug: contains(slugQuery) }, { name: contains(normalizedQuery) }, { description: contains(normalizedQuery) }] },
          include: sourceInclude,
          take,
        }),
        requireDelegate(client, "painMapRegion").findMany({
          where: { OR: [{ slug: contains(slugQuery) }, { name: contains(normalizedQuery) }, { plainLanguageDescription: contains(normalizedQuery) }] },
          include: sourceInclude,
          take,
        }),
        requireDelegate(client, "clientTerm").findMany({
          where: { OR: [{ slug: contains(slugQuery) }, { term: contains(normalizedQuery) }, { plainLanguageDescription: contains(normalizedQuery) }, { notes: contains(normalizedQuery) }] },
          include: sourceInclude,
          take,
        }),
        requireDelegate(client, "anatomyStructure").findMany({
          where: { OR: [{ slug: contains(slugQuery) }, { name: contains(normalizedQuery) }, { structureType: contains(normalizedQuery) }, { description: contains(normalizedQuery) }] },
          include: sourceInclude,
          take,
        }),
        requireDelegate(client, "anatomyConcept").findMany({
          where: { OR: [{ slug: contains(slugQuery) }, { name: contains(normalizedQuery) }, { conceptType: contains(normalizedQuery) }, { bodySystem: contains(normalizedQuery) }, { description: contains(normalizedQuery) }] },
          include: sourceInclude,
          take,
        }),
        requireDelegate(client, "anatomyEntityTerm").findMany({
          where: { term: contains(normalizedQuery) },
          include: sourceInclude,
          take,
        }),
      ])

      return uniqueSearchResults([
        ...regions.map((row) => mapNamedRow("REGION", row)),
        ...bones.map((row) => mapNamedRow("BONE", row)),
        ...landmarks.map((row) => mapNamedRow("BONE_LANDMARK", row)),
        ...joints.map((row) => mapNamedRow("JOINT", row)),
        ...movements.map((row) => mapNamedRow("JOINT_MOVEMENT", row)),
        ...muscles.map((row) => mapNamedRow("MUSCLE", row)),
        ...nerves.map((row) => mapNamedRow("NERVE", row)),
        ...ligaments.map((row) => mapNamedRow("LIGAMENT", row)),
        ...bloodSupply.map((row) => mapNamedRow("BLOOD_SUPPLY", row)),
        ...painMapRegions.map((row) => mapNamedRow("PAIN_MAP_REGION", row)),
        ...clientTerms.map((row) => mapNamedRow("CLIENT_TERM", row)),
        ...structures.map((row) => mapNamedRow("ANATOMY_STRUCTURE", row)),
        ...concepts.map((row) => mapNamedRow("ANATOMY_CONCEPT", row)),
        ...entityTerms.map(mapEntityTerm),
      ].filter((result): result is AnatomySearchResult => Boolean(result))).slice(0, take)
    },
  }
}

export const anatomyQueries = createAnatomyQueryHelpers()
