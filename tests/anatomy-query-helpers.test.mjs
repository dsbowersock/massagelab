import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  ANATOMY_ADMIN_QUICK_QUERIES,
  buildAnatomyEntityHref,
  createAnatomyQueryHelpers,
  normalizeAnatomySearchQuery,
  parseAnatomyEntitySelection,
} from "../lib/anatomy-queries.js"

describe("Anatomy database query helpers", () => {
  it("normalizes admin search input without inventing tokens", () => {
    assert.equal(normalizeAnatomySearchQuery("  Upper   Trap  "), "upper trap")
    assert.equal(normalizeAnatomySearchQuery(""), "")
  })

  it("defines the quick queries the read-only admin panel needs", () => {
    const quickQueryKeys = ANATOMY_ADMIN_QUICK_QUERIES.map((query) => query.key)

    assert.ok(quickQueryKeys.includes("scapula-attachments"))
    assert.ok(quickQueryKeys.includes("accessory-nerve"))
    assert.ok(quickQueryKeys.includes("shoulder-abduction"))
    assert.ok(quickQueryKeys.includes("cervical-rotation-rom"))
    assert.ok(quickQueryKeys.includes("base-of-skull-client-language"))
    assert.ok(quickQueryKeys.includes("missing-citations"))
    assert.ok(quickQueryKeys.includes("has-reviewed-citations"))
    assert.ok(quickQueryKeys.includes("has-open-media"))
    assert.ok(quickQueryKeys.includes("game-ready-prompts"))
  })

  it("builds stable anatomy entity detail links for the admin browser", () => {
    assert.equal(
      buildAnatomyEntityHref({ entityType: "BONE", entitySlug: "scapula", view: "structures" }),
      "/admin/anatomy?view=structures&entityType=BONE&entitySlug=scapula",
    )
    assert.equal(
      buildAnatomyEntityHref({ entityType: "MUSCLE", entitySlug: "deltoid", view: "muscles", q: "deltoid" }),
      "/admin/anatomy?view=muscles&q=deltoid&entityType=MUSCLE&entitySlug=deltoid",
    )
    assert.equal(
      buildAnatomyEntityHref({ entityType: "ANATOMY_STRUCTURE", entitySlug: "plantar-fascia", view: "structures" }),
      "/admin/anatomy?view=structures&entityType=ANATOMY_STRUCTURE&entitySlug=plantar-fascia",
    )
    assert.equal(
      buildAnatomyEntityHref({ entityType: "ANATOMY_CONCEPT", entitySlug: "proprioception", view: "concepts" }),
      "/admin/anatomy?view=concepts&entityType=ANATOMY_CONCEPT&entitySlug=proprioception",
    )
    assert.deepEqual(parseAnatomyEntitySelection("muscle", " Deltoid "), {
      entityType: "MUSCLE",
      entitySlug: "deltoid",
    })
    assert.deepEqual(parseAnatomyEntitySelection("anatomy_structure", " Plantar Fascia "), {
      entityType: "ANATOMY_STRUCTURE",
      entitySlug: "plantar-fascia",
    })
    assert.deepEqual(parseAnatomyEntitySelection("anatomy_concept", " Active Range of Motion "), {
      entityType: "ANATOMY_CONCEPT",
      entitySlug: "active-range-of-motion",
    })
    assert.equal(parseAnatomyEntitySelection("unknown", "scapula"), null)
  })

  it("queries typed attachment, innervation, action, ROM, pain-region, and client-language relationships", async () => {
    const calls = []
    const helpers = createAnatomyQueryHelpers({
      muscle: {
        findMany: async (args) => {
          calls.push(["muscle.findMany", args])
          return [{ slug: "upper-trapezius", name: "Upper Trapezius" }]
        },
      },
      muscleAction: {
        findMany: async (args) => {
          calls.push(["muscleAction.findMany", args])
          return [{ muscle: { slug: "supraspinatus", name: "Supraspinatus" }, role: "PRIMARY" }]
        },
      },
      rangeOfMotion: {
        findFirst: async (args) => {
          calls.push(["rangeOfMotion.findFirst", args])
          return { typicalMinDegrees: 70, typicalMaxDegrees: 90 }
        },
      },
      clientTerm: {
        findMany: async (args) => {
          calls.push(["clientTerm.findMany", args])
          return [{ slug: "base-of-skull", term: "base of skull" }]
        },
      },
      anatomyRelationship: {
        findMany: async (args) => {
          calls.push(["anatomyRelationship.findMany", args])
          return [{ sourceEntitySlug: "between-shoulder-blades" }]
        },
      },
      anatomyCitation: {
        findMany: async (args) => {
          calls.push(["anatomyCitation.findMany", args])
          return [{ slug: "citation-scapula-uberon-definition", entitySlug: "scapula" }]
        },
      },
      anatomyMediaAsset: {
        findMany: async (args) => {
          calls.push(["anatomyMediaAsset.findMany", args])
          return [{ slug: "bodyparts3d-scapula-reference", title: "BodyParts3D Scapula Reference" }]
        },
      },
      externalAnatomyIdentifier: {
        findMany: async (args) => {
          calls.push(["externalAnatomyIdentifier.findMany", args])
          return [{ provider: "UBERON", identifier: "UBERON:0006849" }]
        },
      },
      anatomySpatialEntityMap: {
        findMany: async (args) => {
          calls.push(["anatomySpatialEntityMap.findMany", args])
          return [{ slug: "massagelab-human-bodymap-v1-bone-scapula", entitySlug: "scapula" }]
        },
      },
      anatomyMovementVisualization: {
        findMany: async (args) => {
          calls.push(["anatomyMovementVisualization.findMany", args])
          return [{ slug: "massagelab-human-bodymap-v1-shoulder-abduction" }]
        },
      },
    })

    await helpers.getMusclesAttachedToBone("scapula")
    await helpers.getMusclesByInnervation("accessory-nerve")
    await helpers.getMusclesForMovement("shoulder-abduction")
    await helpers.getRangeOfMotion("cervical-spine", "cervical-rotation")
    await helpers.getClientTermMappings("base of skull")
    await helpers.getPainMapOverlaps("scapular-region")
    await helpers.getEntityCitations("BONE", "scapula")
    await helpers.getEntityMediaAssets("BONE", "scapula", { openLicenseOnly: true })
    await helpers.getEntityExternalIdentifiers("BONE", "scapula")
    await helpers.getEntitySpatialMappings("BONE", "scapula", { modelSlug: "massagelab-human-bodymap-v1", selectableOnly: true })
    await helpers.getBodyMapSpatialTargets({ modelSlug: "massagelab-human-bodymap-v1", painSelectionOnly: true })
    await helpers.getMovementVisualization("glenohumeral", "shoulder-abduction", { modelSlug: "massagelab-human-bodymap-v1" })

    assert.equal(calls[0][1].where.attachments.some.bone.slug, "scapula")
    assert.equal(calls[1][1].where.innervations.some.nerve.slug, "accessory-nerve")
    assert.equal(calls[2][1].where.movement.slug, "shoulder-abduction")
    assert.equal(calls[3][1].where.joint.slug, "cervical-spine")
    assert.equal(calls[3][1].where.movement.slug, "cervical-rotation")
    assert.equal(calls[4][1].where.OR[0].term.contains, "base of skull")
    assert.equal(calls[5][1].where.targetEntitySlug, "scapular-region")
    assert.equal(calls[6][1].where.entityType, "BONE")
    assert.equal(calls[6][1].where.entitySlug, "scapula")
    assert.equal(calls[7][1].where.entityLinks.some.entityType, "BONE")
    assert.equal(calls[7][1].where.usageScope, "OPEN_REUSE")
    assert.equal(calls[8][1].where.entityType, "BONE")
    assert.equal(calls[8][1].where.entitySlug, "scapula")
    const entitySpatialMappingCall = calls.find((call) => call[0] === "anatomySpatialEntityMap.findMany" && call[1].where.entitySlug === "scapula")
    const bodyMapSpatialTargetsCall = calls.find((call) => call[0] === "anatomySpatialEntityMap.findMany" && call[1].where.painSelectionTarget === true)
    const movementVisualizationCall = calls.find((call) => call[0] === "anatomyMovementVisualization.findMany")

    assert.equal(entitySpatialMappingCall?.[1].where.model.slug, "massagelab-human-bodymap-v1")
    assert.equal(entitySpatialMappingCall?.[1].where.selectable, true)
    assert.equal(bodyMapSpatialTargetsCall?.[1].where.model.slug, "massagelab-human-bodymap-v1")
    assert.equal(bodyMapSpatialTargetsCall?.[1].where.selectable, true)
    assert.equal(movementVisualizationCall?.[1].where.model.slug, "massagelab-human-bodymap-v1")
    assert.equal(movementVisualizationCall?.[1].where.joint.slug, "glenohumeral")
    assert.equal(movementVisualizationCall?.[1].where.movement.slug, "shoulder-abduction")
  })

  it("queries entity detail and downstream tool candidate pools", async () => {
    const calls = []
    const helpers = createAnatomyQueryHelpers({
      bone: {
        findMany: async () => [],
        findFirst: async (args) => {
          calls.push(["bone.findFirst", args])
          return { slug: "scapula", name: "Scapula" }
        },
      },
      anatomyRelationship: {
        findMany: async (args) => {
          calls.push(["anatomyRelationship.findMany", args])
          return []
        },
      },
      anatomyCitation: {
        findMany: async (args) => {
          calls.push(["anatomyCitation.findMany", args])
          return []
        },
      },
      anatomyMediaAsset: {
        findMany: async (args) => {
          calls.push(["anatomyMediaAsset.findMany", args])
          return []
        },
      },
      externalAnatomyIdentifier: {
        findMany: async (args) => {
          calls.push(["externalAnatomyIdentifier.findMany", args])
          return []
        },
      },
      muscle: {
        findMany: async (args) => {
          calls.push(["muscle.findMany", args])
          return [{ slug: "deltoid", name: "Deltoid" }]
        },
      },
      clientTerm: {
        findMany: async (args) => {
          calls.push(["clientTerm.findMany", args])
          return [{ slug: "top-of-shoulder", term: "top of shoulder" }]
        },
      },
      painMapRegion: {
        findMany: async (args) => {
          calls.push(["painMapRegion.findMany", args])
          return [{ slug: "upper-trapezius-area", name: "Upper Trapezius Area", laterality: "UNSPECIFIED", surface: "POSTERIOR" }]
        },
      },
      anatomyStructure: {
        findMany: async (args) => {
          calls.push(["anatomyStructure.findMany", args])
          return [{ slug: "plantar-fascia", name: "Plantar Fascia" }]
        },
        findFirst: async (args) => {
          calls.push(["anatomyStructure.findFirst", args])
          return { slug: "plantar-fascia", name: "Plantar Fascia" }
        },
      },
      anatomyConcept: {
        findMany: async (args) => {
          calls.push(["anatomyConcept.findMany", args])
          return [{ slug: "proprioception", name: "Proprioception" }]
        },
        findFirst: async (args) => {
          calls.push(["anatomyConcept.findFirst", args])
          return { slug: "proprioception", name: "Proprioception" }
        },
      },
    })

    await helpers.getAnatomyEntityDetail("BONE", "scapula")
    await helpers.getAnatomyEntityDetail("ANATOMY_STRUCTURE", "plantar-fascia")
    await helpers.getAnatomyEntityDetail("ANATOMY_CONCEPT", "proprioception")
    await helpers.getFlashcardCandidates({ entityTypes: ["MUSCLE"], regionSlug: "shoulder-girdle" })
    await helpers.getFlashcardCandidates({ entityTypes: ["ANATOMY_STRUCTURE"], sectionSlug: "lower-limb" })
    await helpers.getFlashcardCandidates({ entityTypes: ["ANATOMY_CONCEPT"], take: 10 })
    await helpers.getAnatomyGamePromptPool({ sectionSlug: "lower-limb" })
    await helpers.getSoapAnatomyTags({ phrase: "top of shoulder" })
    await helpers.getBodyMapRegionMappings("scapular-region")

    assert.equal(calls[0][0], "bone.findFirst")
    assert.equal(calls[0][1].where.slug, "scapula")
    assert.ok(calls.some((call) => call[0] === "anatomyStructure.findFirst" && call[1].where.slug === "plantar-fascia"))
    assert.ok(calls.some((call) => call[0] === "anatomyConcept.findFirst" && call[1].where.slug === "proprioception"))
    assert.ok(calls.some((call) => call[0] === "anatomyCitation.findMany"))
    assert.ok(calls.some((call) => call[0] === "anatomyMediaAsset.findMany"))
    assert.ok(calls.some((call) => call[0] === "externalAnatomyIdentifier.findMany"))
    assert.ok(calls.some((call) => call[0] === "muscle.findMany" && call[1].where.region.slug === "shoulder-girdle"))
    assert.ok(calls.some((call) => call[0] === "anatomyStructure.findMany" && call[1].where.region.slug === "lower-limb"))
    assert.ok(calls.some((call) => call[0] === "anatomyConcept.findMany"))
    assert.ok(calls.some((call) => call[0] === "muscle.findMany" && call[1].where.region.slug === "lower-limb"))
    assert.ok(calls.some((call) => call[0] === "clientTerm.findMany" && call[1].where.OR[0].term.contains === "top of shoulder"))
    assert.ok(calls.some((call) => call[0] === "painMapRegion.findMany" && call[1].where.region.slug === "scapular-region"))
  })
})
