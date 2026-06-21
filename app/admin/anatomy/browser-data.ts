import { anatomyQueries, type AnatomyEntitySelection, type AnatomyQuickQueryKey } from "@/lib/anatomy-queries"
import { prisma } from "@/lib/prisma"
import {
  entityKey,
  type AnatomyBrowserData,
  type AnatomyBrowserDataLoadKey,
  type AnatomyBrowserView,
  type AnatomyEntityNameIndex,
  type AnatomyFoundationCount,
  type AnatomyQuickResult,
} from "./browser-types"

const ANATOMY_DETAIL_LOOKUP_TAKE = 2000
const ANATOMY_ENTITY_NAME_LOOKUP_TAKE = 500
const anatomySourceSnippetSelect = {
  slug: true,
  label: true,
  usageScope: true,
} as const
const anatomyMediaEntitySnippetSelect = {
  id: true,
  entityType: true,
  entitySlug: true,
  role: true,
  notes: true,
  reviewStatus: true,
  reviewReason: true,
  reviewNote: true,
  displayPriority: true,
} as const
const anatomyMediaAssetSnippetSelect = {
  id: true,
  slug: true,
  title: true,
  mediaType: true,
  sourceUrl: true,
  remoteUrl: true,
  thumbnailUrl: true,
  license: true,
  usageScope: true,
  reviewStatus: true,
  metadata: true,
  source: {
    select: anatomySourceSnippetSelect,
  },
  entityLinks: {
    select: anatomyMediaEntitySnippetSelect,
  },
} as const

export async function getAnatomyFoundationCounts(): Promise<AnatomyFoundationCount[]> {
  const [
    regions,
    terms,
    aliases,
    relationships,
    flags,
    sources,
    muscles,
    bones,
    joints,
    ligaments,
    nerves,
    bloodSupply,
    painRegions,
    clientTerms,
    citations,
    externalIdentifiers,
    mediaAssets,
    mediaViewRequests,
    spatialModels,
    spatialEntityMaps,
    movementVisualizations,
  ] = await Promise.all([
    prisma.anatomyRegion.count(),
    prisma.anatomyTerm.count(),
    prisma.anatomyAlias.count(),
    prisma.anatomyRelationship.count({ where: { sourceEntityType: { not: null } } }),
    prisma.anatomyCorrectionFlag.count({ where: { status: "OPEN" } }),
    prisma.anatomySource.count(),
    prisma.muscle.count(),
    prisma.bone.count(),
    prisma.joint.count(),
    prisma.ligament.count(),
    prisma.nerve.count(),
    prisma.bloodSupply.count(),
    prisma.painMapRegion.count(),
    prisma.clientTerm.count(),
    prisma.anatomyCitation.count(),
    prisma.externalAnatomyIdentifier.count(),
    prisma.anatomyMediaAsset.count(),
    prisma.anatomyMediaViewRequest.count({ where: { status: "OPEN" } }),
    prisma.anatomySpatialModel.count(),
    prisma.anatomySpatialEntityMap.count(),
    prisma.anatomyMovementVisualization.count(),
  ])

  return [
    { label: "Regions", value: regions },
    { label: "Legacy terms", value: terms },
    { label: "Aliases", value: aliases },
    { label: "Relationships", value: relationships },
    { label: "Open flags", value: flags },
    { label: "Sources", value: sources },
    { label: "Muscles", value: muscles },
    { label: "Bones", value: bones },
    { label: "Joints", value: joints },
    { label: "Ligaments", value: ligaments },
    { label: "Nerves", value: nerves },
    { label: "Blood supply", value: bloodSupply },
    { label: "Pain regions", value: painRegions },
    { label: "Client terms", value: clientTerms },
    { label: "Citations", value: citations },
    { label: "External IDs", value: externalIdentifiers },
    { label: "Media assets", value: mediaAssets },
    { label: "Media requests", value: mediaViewRequests },
    { label: "Spatial models", value: spatialModels },
    { label: "Spatial maps", value: spatialEntityMaps },
    { label: "Movement visuals", value: movementVisualizations },
  ]
}

/**
 * Selects the minimum browser datasets needed for the active anatomy admin tab.
 * Detail panels get their selected-entity evidence from `getAnatomyEntityDetail`,
 * so broad citation/media/spatial scans stay out of ordinary list views.
 */
export function anatomyBrowserDataNeeds(selectedView: AnatomyBrowserView, selectedEntity: AnatomyEntitySelection | null) {
  const needs = new Set<AnatomyBrowserDataLoadKey>()
  const add = (...keys: AnatomyBrowserDataLoadKey[]) => {
    for (const key of keys) needs.add(key)
  }

  if (selectedEntity) {
    add("sources", "entityTerms", "relationships", "mediaAssets")
  }

  switch (selectedView) {
    case "muscles":
      add("muscles", "entityTerms", "relationships")
      break
    case "structures":
      add("structures", "bones", "relationships")
      break
    case "concepts":
      add("concepts", "entityTerms")
      break
    case "joints":
      add("joints")
      break
    case "rom":
      add("rangesOfMotion")
      break
    case "ligaments":
      add("ligaments")
      break
    case "nerves":
      add("nerves", "relationships")
      break
    case "vessels":
      add("bloodSupply", "relationships")
      break
    case "terms":
      add("entityTerms", "clientTerms")
      break
    case "pain":
      add("painRegions", "relationships")
      break
    case "sources":
      add("sources")
      break
    case "queries":
    case "maintenance":
      break
    default:
      add("concepts", "structures", "muscles", "bones", "joints", "ligaments", "nerves", "bloodSupply", "entityTerms", "systemRelationships")
      break
  }

  return needs
}

function needsFullEntityNameIndex(selectedView: AnatomyBrowserView, selectedEntity: AnatomyEntitySelection | null) {
  return Boolean(selectedEntity) || ["muscles", "structures", "nerves", "vessels", "terms", "pain"].includes(selectedView)
}

function emptyAnatomyRows() {
  return Promise.resolve([] as Record<string, unknown>[])
}

async function getAnatomyEntityNameIndex(): Promise<AnatomyEntityNameIndex> {
  const [
    regions,
    muscles,
    structures,
    concepts,
    bones,
    boneLandmarks,
    joints,
    jointMovements,
    rangesOfMotion,
    nerves,
    ligaments,
    bloodSupply,
    painRegions,
    clientTerms,
  ] = await Promise.all([
    prisma.anatomyRegion.findMany({ select: { slug: true, name: true }, orderBy: { name: "asc" }, take: ANATOMY_ENTITY_NAME_LOOKUP_TAKE }),
    prisma.muscle.findMany({ select: { slug: true, name: true }, orderBy: { name: "asc" }, take: ANATOMY_ENTITY_NAME_LOOKUP_TAKE }),
    prisma.anatomyStructure.findMany({ select: { slug: true, name: true }, orderBy: { name: "asc" }, take: ANATOMY_ENTITY_NAME_LOOKUP_TAKE }),
    prisma.anatomyConcept.findMany({ select: { slug: true, name: true }, orderBy: { name: "asc" }, take: ANATOMY_ENTITY_NAME_LOOKUP_TAKE }),
    prisma.bone.findMany({ select: { slug: true, name: true }, orderBy: { name: "asc" }, take: ANATOMY_ENTITY_NAME_LOOKUP_TAKE }),
    prisma.boneLandmark.findMany({ select: { slug: true, name: true }, orderBy: { name: "asc" }, take: ANATOMY_ENTITY_NAME_LOOKUP_TAKE }),
    prisma.joint.findMany({ select: { slug: true, name: true }, orderBy: { name: "asc" }, take: ANATOMY_ENTITY_NAME_LOOKUP_TAKE }),
    prisma.jointMovement.findMany({ select: { slug: true, movementName: true }, orderBy: { movementName: "asc" }, take: ANATOMY_ENTITY_NAME_LOOKUP_TAKE }),
    prisma.rangeOfMotion.findMany({ select: { slug: true }, orderBy: { slug: "asc" }, take: ANATOMY_ENTITY_NAME_LOOKUP_TAKE }),
    prisma.nerve.findMany({ select: { slug: true, name: true }, orderBy: { name: "asc" }, take: ANATOMY_ENTITY_NAME_LOOKUP_TAKE }),
    prisma.ligament.findMany({ select: { slug: true, name: true }, orderBy: { name: "asc" }, take: ANATOMY_ENTITY_NAME_LOOKUP_TAKE }),
    prisma.bloodSupply.findMany({ select: { slug: true, name: true }, orderBy: { name: "asc" }, take: ANATOMY_ENTITY_NAME_LOOKUP_TAKE }),
    prisma.painMapRegion.findMany({ select: { slug: true, name: true }, orderBy: { name: "asc" }, take: ANATOMY_ENTITY_NAME_LOOKUP_TAKE }),
    prisma.clientTerm.findMany({ select: { slug: true, term: true }, orderBy: { term: "asc" }, take: ANATOMY_ENTITY_NAME_LOOKUP_TAKE }),
  ])

  const entityNames: Record<string, string> = {}
  const addEntityName = (entityType: string, slug: string, label: string) => {
    if (slug && label) entityNames[entityKey(entityType, slug)] = label
  }

  for (const region of regions) addEntityName("REGION", region.slug, region.name)
  for (const muscle of muscles) addEntityName("MUSCLE", muscle.slug, muscle.name)
  for (const structure of structures) addEntityName("ANATOMY_STRUCTURE", structure.slug, structure.name)
  for (const concept of concepts) addEntityName("ANATOMY_CONCEPT", concept.slug, concept.name)
  for (const bone of bones) addEntityName("BONE", bone.slug, bone.name)
  for (const landmark of boneLandmarks) addEntityName("BONE_LANDMARK", landmark.slug, landmark.name)
  for (const joint of joints) addEntityName("JOINT", joint.slug, joint.name)
  for (const movement of jointMovements) addEntityName("JOINT_MOVEMENT", movement.slug, movement.movementName)
  for (const rom of rangesOfMotion) addEntityName("RANGE_OF_MOTION", rom.slug, rom.slug)
  for (const nerve of nerves) addEntityName("NERVE", nerve.slug, nerve.name)
  for (const ligament of ligaments) addEntityName("LIGAMENT", ligament.slug, ligament.name)
  for (const vessel of bloodSupply) addEntityName("BLOOD_SUPPLY", vessel.slug, vessel.name)
  for (const painRegion of painRegions) addEntityName("PAIN_MAP_REGION", painRegion.slug, painRegion.name)
  for (const clientTerm of clientTerms) addEntityName("CLIENT_TERM", clientTerm.slug, clientTerm.term)

  return {
    entityNames,
    entityOptions: entityOptionsFromNames(entityNames),
  }
}

function entityOptionsFromNames(entityNames: Record<string, string>) {
  return Object.entries(entityNames)
    .map(([key, label]) => {
      const [entityType, entitySlug] = key.split(":", 2)

      return { entityType, entitySlug, label }
    })
    .sort((left, right) => left.label.localeCompare(right.label))
}

export async function getAnatomyBrowserData(selectedView: AnatomyBrowserView, selectedEntity: AnatomyEntitySelection | null): Promise<AnatomyBrowserData> {
  const needs = anatomyBrowserDataNeeds(selectedView, selectedEntity)
  const shouldLoad = (key: AnatomyBrowserDataLoadKey) => needs.has(key)
  const [
    nameIndex,
    regions,
    muscles,
    structures,
    concepts,
    bones,
    boneLandmarks,
    joints,
    jointMovements,
    rangesOfMotion,
    nerves,
    ligaments,
    bloodSupply,
    painRegions,
    clientTerms,
    entityTerms,
    sources,
    relationships,
    systemRelationships,
    citations,
    externalIdentifiers,
    mediaAssets,
    mediaViewRequests,
    spatialModels,
    spatialEntityMaps,
    movementVisualizations,
  ] = await Promise.all([
    needsFullEntityNameIndex(selectedView, selectedEntity) ? getAnatomyEntityNameIndex() : Promise.resolve({ entityNames: {}, entityOptions: [] }),
    shouldLoad("regions") ? prisma.anatomyRegion.findMany({
      include: {
        parentRegion: true,
        source: true,
      },
      orderBy: { name: "asc" },
      take: 120,
    }) : emptyAnatomyRows(),
    shouldLoad("muscles") ? prisma.muscle.findMany({
      include: {
        region: true,
        source: true,
        attachments: {
          include: { bone: true, landmark: true },
          orderBy: { type: "asc" },
        },
        innervations: {
          include: { nerve: true },
          orderBy: { slug: "asc" },
        },
        actions: {
          include: { joint: true, movement: true },
          orderBy: { slug: "asc" },
        },
      },
      orderBy: { name: "asc" },
      take: 80,
    }) : emptyAnatomyRows(),
    shouldLoad("structures") ? prisma.anatomyStructure.findMany({
      include: {
        region: true,
        source: true,
      },
      orderBy: { name: "asc" },
      take: 120,
    }) : emptyAnatomyRows(),
    shouldLoad("concepts") ? prisma.anatomyConcept.findMany({
      include: {
        source: true,
      },
      orderBy: { name: "asc" },
      take: 240,
    }) : emptyAnatomyRows(),
    shouldLoad("bones") ? prisma.bone.findMany({
      include: {
        region: true,
        source: true,
        landmarks: { orderBy: { name: "asc" } },
        attachments: {
          include: { muscle: true, landmark: true },
          orderBy: { type: "asc" },
        },
      },
      orderBy: { name: "asc" },
      take: 80,
    }) : emptyAnatomyRows(),
    shouldLoad("boneLandmarks") ? prisma.boneLandmark.findMany({
      include: {
        bone: true,
        source: true,
      },
      orderBy: { name: "asc" },
      take: 160,
    }) : emptyAnatomyRows(),
    shouldLoad("joints") ? prisma.joint.findMany({
      include: {
        region: true,
        source: true,
        movements: { orderBy: { movementName: "asc" } },
        rangesOfMotion: {
          include: { movement: true, source: true },
          orderBy: { slug: "asc" },
        },
        ligaments: { orderBy: { name: "asc" } },
      },
      orderBy: { name: "asc" },
      take: 80,
    }) : emptyAnatomyRows(),
    shouldLoad("jointMovements") ? prisma.jointMovement.findMany({
      include: {
        joint: true,
        source: true,
      },
      orderBy: { movementName: "asc" },
      take: 160,
    }) : emptyAnatomyRows(),
    shouldLoad("rangesOfMotion") ? prisma.rangeOfMotion.findMany({
      include: {
        joint: true,
        movement: true,
        source: true,
      },
      orderBy: { slug: "asc" },
      take: 160,
    }) : emptyAnatomyRows(),
    shouldLoad("nerves") ? prisma.nerve.findMany({
      include: {
        region: true,
        source: true,
        innervations: {
          include: { muscle: true },
          orderBy: { slug: "asc" },
        },
      },
      orderBy: { name: "asc" },
      take: 80,
    }) : emptyAnatomyRows(),
    shouldLoad("ligaments") ? prisma.ligament.findMany({
      include: {
        region: true,
        joint: true,
        source: true,
      },
      orderBy: { name: "asc" },
      take: 160,
    }) : emptyAnatomyRows(),
    shouldLoad("bloodSupply") ? prisma.bloodSupply.findMany({
      include: {
        region: true,
        source: true,
      },
      orderBy: { name: "asc" },
      take: 80,
    }) : emptyAnatomyRows(),
    shouldLoad("painRegions") ? prisma.painMapRegion.findMany({
      include: {
        region: true,
        source: true,
      },
      orderBy: { name: "asc" },
      take: 80,
    }) : emptyAnatomyRows(),
    shouldLoad("clientTerms") ? prisma.clientTerm.findMany({
      include: {
        mappedRegion: true,
        mappedMuscle: true,
        mappedJoint: true,
        mappedStructure: true,
        source: true,
      },
      orderBy: { term: "asc" },
      take: 80,
    }) : emptyAnatomyRows(),
    shouldLoad("entityTerms") ? prisma.anatomyEntityTerm.findMany({
      include: { source: true },
      orderBy: [{ anatomyEntityType: "asc" }, { anatomyEntitySlug: "asc" }, { termType: "asc" }],
      take: 120,
    }) : emptyAnatomyRows(),
    shouldLoad("sources") ? prisma.anatomySource.findMany({
      orderBy: { label: "asc" },
      take: 80,
    }) : emptyAnatomyRows(),
    shouldLoad("relationships") ? prisma.anatomyRelationship.findMany({
      include: { source: true },
      where: {
        sourceEntityType: { not: null },
        relationshipType: {
          notIn: ["belongs_to_system", "belongs_to_tissue_type", "includes_structure", "subsystem_of"],
        },
      },
      orderBy: [{ sourceEntityType: "asc" }, { sourceEntitySlug: "asc" }, { relationshipType: "asc" }],
      take: ANATOMY_DETAIL_LOOKUP_TAKE,
    }) : emptyAnatomyRows(),
    shouldLoad("systemRelationships") ? prisma.anatomyRelationship.findMany({
      include: { source: true },
      where: {
        OR: [
          { relationshipType: "belongs_to_system" },
          { relationshipType: "belongs_to_tissue_type" },
          {
            sourceEntityType: "ANATOMY_CONCEPT",
            relationshipType: "includes_structure",
          },
        ],
      },
      orderBy: [{ targetEntityType: "asc" }, { targetEntitySlug: "asc" }, { sourceEntitySlug: "asc" }],
      take: 5000,
    }) : emptyAnatomyRows(),
    shouldLoad("citations") ? prisma.anatomyCitation.findMany({
      include: { source: true },
      orderBy: [{ entityType: "asc" }, { entitySlug: "asc" }, { factType: "asc" }],
      take: ANATOMY_DETAIL_LOOKUP_TAKE,
    }) : emptyAnatomyRows(),
    shouldLoad("externalIdentifiers") ? prisma.externalAnatomyIdentifier.findMany({
      include: { source: true },
      orderBy: [{ entityType: "asc" }, { entitySlug: "asc" }, { provider: "asc" }],
      take: ANATOMY_DETAIL_LOOKUP_TAKE,
    }) : emptyAnatomyRows(),
    shouldLoad("mediaAssets") ? prisma.anatomyMediaAsset.findMany({
      select: anatomyMediaAssetSnippetSelect,
      orderBy: [{ usageScope: "asc" }, { title: "asc" }],
      take: 500,
    }) : emptyAnatomyRows(),
    shouldLoad("mediaViewRequests") ? prisma.anatomyMediaViewRequest.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 500,
    }) : emptyAnatomyRows(),
    shouldLoad("spatialModels") ? prisma.anatomySpatialModel.findMany({
      include: { source: true, mediaAsset: true },
      orderBy: [{ reviewStatus: "asc" }, { name: "asc" }],
      take: 80,
    }) : emptyAnatomyRows(),
    shouldLoad("spatialEntityMaps") ? prisma.anatomySpatialEntityMap.findMany({
      include: { model: true, source: true },
      orderBy: [{ reviewStatus: "asc" }, { entityType: "asc" }, { entitySlug: "asc" }],
      take: 160,
    }) : emptyAnatomyRows(),
    shouldLoad("movementVisualizations") ? prisma.anatomyMovementVisualization.findMany({
      include: {
        model: true,
        joint: true,
        movement: true,
        rangeOfMotion: true,
        source: true,
      },
      orderBy: [{ reviewStatus: "asc" }, { slug: "asc" }],
      take: 80,
    }) : emptyAnatomyRows(),
  ])

  const entityNames: Record<string, string> = { ...nameIndex.entityNames }
  const addEntityName = (entityType: string, slug: string, label: string) => {
    if (slug && label) entityNames[entityKey(entityType, slug)] = label
  }

  for (const region of regions) addEntityName("REGION", recordText(region, "slug"), recordText(region, "name"))
  for (const muscle of muscles) addEntityName("MUSCLE", recordText(muscle, "slug"), recordText(muscle, "name"))
  for (const structure of structures) addEntityName("ANATOMY_STRUCTURE", recordText(structure, "slug"), recordText(structure, "name"))
  for (const concept of concepts) addEntityName("ANATOMY_CONCEPT", recordText(concept, "slug"), recordText(concept, "name"))
  for (const bone of bones) {
    addEntityName("BONE", recordText(bone, "slug"), recordText(bone, "name"))
    for (const landmark of recordArray(bone, "landmarks")) addEntityName("BONE_LANDMARK", recordText(landmark, "slug"), recordText(landmark, "name"))
  }
  for (const landmark of boneLandmarks) addEntityName("BONE_LANDMARK", recordText(landmark, "slug"), recordText(landmark, "name"))
  for (const joint of joints) {
    addEntityName("JOINT", recordText(joint, "slug"), recordText(joint, "name"))
    for (const movement of recordArray(joint, "movements")) addEntityName("JOINT_MOVEMENT", recordText(movement, "slug"), recordText(movement, "movementName"))
    for (const ligament of recordArray(joint, "ligaments")) addEntityName("LIGAMENT", recordText(ligament, "slug"), recordText(ligament, "name"))
  }
  for (const movement of jointMovements) addEntityName("JOINT_MOVEMENT", recordText(movement, "slug"), recordText(movement, "movementName"))
  for (const rom of rangesOfMotion) addEntityName("RANGE_OF_MOTION", recordText(rom, "slug"), recordText(rom, "slug"))
  for (const ligament of ligaments) addEntityName("LIGAMENT", recordText(ligament, "slug"), recordText(ligament, "name"))
  for (const nerve of nerves) addEntityName("NERVE", recordText(nerve, "slug"), recordText(nerve, "name"))
  for (const vessel of bloodSupply) addEntityName("BLOOD_SUPPLY", recordText(vessel, "slug"), recordText(vessel, "name"))
  for (const painRegion of painRegions) addEntityName("PAIN_MAP_REGION", recordText(painRegion, "slug"), recordText(painRegion, "name"))
  for (const clientTerm of clientTerms) addEntityName("CLIENT_TERM", recordText(clientTerm, "slug"), recordText(clientTerm, "term"))
  const entityOptions = entityOptionsFromNames(entityNames)

  return {
    regions: regions as Record<string, unknown>[],
    muscles: muscles as Record<string, unknown>[],
    structures: structures as Record<string, unknown>[],
    concepts: concepts as Record<string, unknown>[],
    bones: bones as Record<string, unknown>[],
    boneLandmarks: boneLandmarks as Record<string, unknown>[],
    joints: joints as Record<string, unknown>[],
    jointMovements: jointMovements as Record<string, unknown>[],
    rangesOfMotion: rangesOfMotion as Record<string, unknown>[],
    nerves: nerves as Record<string, unknown>[],
    ligaments: ligaments as Record<string, unknown>[],
    bloodSupply: bloodSupply as Record<string, unknown>[],
    painRegions: painRegions as Record<string, unknown>[],
    clientTerms: clientTerms as Record<string, unknown>[],
    entityTerms: entityTerms as Record<string, unknown>[],
    sources: sources as Record<string, unknown>[],
    relationships: relationships as Record<string, unknown>[],
    systemRelationships: systemRelationships as Record<string, unknown>[],
    citations: citations as Record<string, unknown>[],
    externalIdentifiers: externalIdentifiers as Record<string, unknown>[],
    mediaAssets: mediaAssets as Record<string, unknown>[],
    mediaViewRequests: mediaViewRequests as Record<string, unknown>[],
    spatialModels: spatialModels as Record<string, unknown>[],
    spatialEntityMaps: spatialEntityMaps as Record<string, unknown>[],
    movementVisualizations: movementVisualizations as Record<string, unknown>[],
    entityNames,
    entityOptions,
  }
}

export function getAnatomyBrowserDataForView({
  view,
  selectedEntity,
}: {
  view: AnatomyBrowserView
  selectedEntity: AnatomyEntitySelection | null
}) {
  return getAnatomyBrowserData(view, selectedEntity)
}

export async function getAnatomyQuickResult(key: AnatomyQuickQueryKey | undefined): Promise<AnatomyQuickResult | null> {
  switch (key) {
    case "scapula-attachments": {
      const rows = await anatomyQueries.getMusclesAttachedToBone("scapula")

      return {
        title: "Muscles attached to the scapula",
        description: "Uses typed MuscleAttachment rows joined through Bone and BoneLandmark records.",
        rows: rows.map((row) => ({
          title: recordText(row, "name"),
          subtitle: recordText(row, "formalName"),
          meta: relationText(row, "region", "name"),
          detail: attachmentSummary(row),
        })),
      }
    }
    case "accessory-nerve": {
      const rows = await anatomyQueries.getMusclesByInnervation("accessory-nerve")

      return {
        title: "Accessory nerve innervation",
        description: "Uses typed MuscleInnervation rows joined through Nerve records.",
        rows: rows.map((row) => ({
          title: recordText(row, "name"),
          subtitle: recordText(row, "formalName"),
          meta: relationText(row, "region", "name"),
          detail: innervationSummary(row),
        })),
      }
    }
    case "shoulder-abduction": {
      const rows = await anatomyQueries.getMusclesForMovement("shoulder-abduction")

      return {
        title: "Shoulder abduction contributors",
        description: "Uses typed MuscleAction rows so role and contraction type remain queryable.",
        rows: rows.map((row) => ({
          title: relationText(row, "muscle", "name"),
          subtitle: `${recordText(row, "role")} / ${recordText(row, "contractionType")}`,
          meta: `${relationText(row, "joint", "name")} - ${relationText(row, "movement", "movementName")}`,
          detail: recordText(row, "description"),
        })),
      }
    }
    case "cervical-rotation-rom": {
      const row = await anatomyQueries.getRangeOfMotion("cervical-spine", "cervical-rotation")

      return {
        title: "Typical cervical rotation ROM",
        description: "Uses a typed RangeOfMotion row joined through Joint and JointMovement.",
        rows: row ? [{
          title: `${relationText(row, "joint", "name")} - ${relationText(row, "movement", "movementName")}`,
          subtitle: romLine(row),
          meta: relationText(row, "source", "label"),
          detail: `${recordText(row, "measurementPosition")} ${recordText(row, "notes")}`.trim(),
        }] : [],
      }
    }
    case "scapular-pain-overlaps": {
      const rows = await anatomyQueries.getPainMapOverlaps("scapular-region")

      return {
        title: "Pain-map regions overlapping the scapular region",
        description: "Uses generic AnatomyRelationship rows for cross-entity overlap relationships.",
        rows: rows.map((row) => ({
          title: recordText(row, "sourceEntitySlug"),
          subtitle: `${recordText(row, "sourceEntityType")} -> ${recordText(row, "targetEntityType")}`,
          meta: relationText(row, "source", "label"),
          detail: recordText(row, "relationshipType"),
        })),
      }
    }
    case "between-shoulder-blades":
    case "top-of-shoulder":
    case "base-of-skull-client-language": {
      const searchTerm = key === "base-of-skull-client-language" ? "base of skull" : key.replaceAll("-", " ")
      const rows = await anatomyQueries.getClientTermMappings(searchTerm)

      return {
        title: `Client language: ${searchTerm}`,
        description: "Uses ClientTerm rows mapped to normalized regions, muscles, and joints.",
        rows: rows.map((row) => ({
          title: recordText(row, "term"),
          subtitle: recordText(row, "confidence"),
          meta: [
            relationText(row, "mappedRegion", "name"),
            relationText(row, "mappedMuscle", "name"),
            relationText(row, "mappedJoint", "name"),
            relationText(row, "mappedStructure", "name"),
          ].filter(Boolean).join(" / "),
          detail: recordText(row, "plainLanguageDescription"),
        })),
      }
    }
    case "has-reviewed-citations": {
      const rows = await prisma.anatomyCitation.findMany({
        where: { reviewStatus: "REVIEWED" },
        include: { source: true },
        orderBy: [{ entityType: "asc" }, { entitySlug: "asc" }, { factType: "asc" }],
        take: 40,
      })

      return {
        title: "Reviewed citation records",
        description: "Shows facts with explicit reviewed citation records.",
        rows: rows.map((row) => ({
          title: `${row.entityType} / ${row.entitySlug}`,
          subtitle: row.factType,
          meta: row.source.label,
          detail: [row.sourceLocator, row.citationNote].filter(Boolean).join(" - "),
        })),
      }
    }
    case "missing-citations": {
      const rows = await prisma.anatomyCitation.findMany({
        where: { reviewStatus: { not: "REVIEWED" } },
        include: { source: true },
        orderBy: [{ reviewStatus: "asc" }, { entityType: "asc" }, { entitySlug: "asc" }],
        take: 40,
      })

      return {
        title: "Citation records needing review",
        description: "Shows citation candidates that are not locked as reviewed yet.",
        rows: rows.map((row) => ({
          title: `${row.entityType} / ${row.entitySlug}`,
          subtitle: row.factType,
          meta: formatLabel(row.reviewStatus),
          detail: [row.source.label, row.sourceLocator].filter(Boolean).join(" - "),
        })),
      }
    }
    case "has-open-media": {
      const rows = await prisma.anatomyMediaAsset.findMany({
        where: { usageScope: "OPEN_REUSE", reviewStatus: "REVIEWED" },
        select: anatomyMediaAssetSnippetSelect,
        orderBy: { title: "asc" },
        take: 40,
      })

      return {
        title: "Reviewed open-license media",
        description: "Shows media/model candidates safe for open-license reuse.",
        rows: rows.map((row) => ({
          title: row.title,
          subtitle: `${row.mediaType} / ${row.license}`,
          meta: row.source.label,
          detail: row.entityLinks.map((link) => `${link.entityType}:${link.entitySlug}`).join("; "),
        })),
      }
    }
    case "spatial-review-queue": {
      const [maps, visualizations] = await Promise.all([
        prisma.anatomySpatialEntityMap.findMany({
          where: { reviewStatus: { not: "REVIEWED" } },
          include: { model: true, source: true },
          orderBy: [{ entityType: "asc" }, { entitySlug: "asc" }],
          take: 40,
        }),
        prisma.anatomyMovementVisualization.findMany({
          where: { reviewStatus: { not: "REVIEWED" } },
          include: {
            model: true,
            joint: true,
            movement: true,
            source: true,
          },
          orderBy: { slug: "asc" },
          take: 40,
        }),
      ])

      return {
        title: "3D and spatial review queue",
        description: "Shows body-map mappings and ROM visualization anchors that stay review-only until runtime mesh, node, and rig details are confirmed.",
        rows: [
          ...maps.map((row) => ({
            title: `${row.entityType} / ${row.entitySlug}`,
            subtitle: `${row.model.name} / ${formatLabel(row.mappingPrecision)}`,
            meta: formatLabel(row.reviewStatus),
            detail: [row.source.label, row.notes].filter(Boolean).join(" - "),
          })),
          ...visualizations.map((row) => ({
            title: `${row.joint.name} / ${row.movement.movementName}`,
            subtitle: row.model.name,
            meta: formatLabel(row.reviewStatus),
            detail: [row.source.label, row.notes].filter(Boolean).join(" - "),
          })),
        ],
      }
    }
    case "game-ready-prompts": {
      const rows = await anatomyQueries.getAnatomyGamePromptPool({ regionSlug: "shoulder-girdle", take: 40 })

      return {
        title: "Game-ready anatomy prompt pool",
        description: "Shows structures with attachments, actions, and innervation ready for anatomy games.",
        rows: rows.map((row) => ({
          title: recordText(row, "name"),
          subtitle: relationText(row, "region", "name"),
          meta: `Actions ${recordArray(row, "actions").length} / Attachments ${recordArray(row, "attachments").length}`,
          detail: actionLines(recordArray(row, "actions")).join("; "),
        })),
      }
    }
    default:
      return null
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? value as Record<string, unknown> : {}
}

function recordText(row: unknown, key: string) {
  const value = asRecord(row)[key]

  if (value === null || value === undefined) {
    return ""
  }

  return String(value)
}

function relationText(row: unknown, relationKey: string, valueKey: string) {
  return recordText(asRecord(row)[relationKey], valueKey)
}

function recordArray(row: unknown, key: string) {
  const value = asRecord(row)[key]

  return Array.isArray(value) ? value : []
}

function formatLabel(value: string | null | undefined) {
  return value ? value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : ""
}

function actionLines(actions: unknown[]) {
  return actions.map((action) => {
    const movement = relationText(action, "movement", "movementName")
    const role = formatLabel(recordText(action, "role"))

    return [movement, role].filter(Boolean).join(" / ")
  })
}

function romUnitLabel(unit: string) {
  switch (unit) {
    case "centimeters":
      return "cm"
    case "millimeters":
      return "mm"
    case "degrees":
      return "deg"
    default:
      return formatLabel(unit)
  }
}

function romLine(rom: unknown) {
  const movement = relationText(rom, "movement", "movementName")
  const min = recordText(rom, "typicalMinValue") || recordText(rom, "typicalMinDegrees")
  const max = recordText(rom, "typicalMaxValue") || recordText(rom, "typicalMaxDegrees")
  const unit = recordText(rom, "measurementUnit") || "degrees"

  return [movement, min && max ? `${min}-${max} ${romUnitLabel(unit)}` : ""].filter(Boolean).join(": ")
}

function attachmentSummary(row: unknown) {
  return recordArray(row, "attachments")
    .map((attachment) => {
      const type = recordText(attachment, "type")
      const bone = relationText(attachment, "bone", "name")
      const landmark = relationText(attachment, "landmark", "name")

      return [type, bone, landmark].filter(Boolean).join(": ")
    })
    .filter(Boolean)
    .join("; ")
}

function innervationSummary(row: unknown) {
  return recordArray(row, "innervations")
    .map((innervation) => {
      const nerve = relationText(innervation, "nerve", "name")
      const description = recordText(innervation, "description")

      return [nerve, description].filter(Boolean).join(": ")
    })
    .filter(Boolean)
    .join("; ")
}
