import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  ANATOMY_FOUNDATION_SEED,
  ANATOMY_SEED_SECTION_NAMES,
  findClientTermMapping,
  findMusclesAttachedToBone,
  findMusclesByInnervation,
  findMusclesForJointMovement,
  findPainMapOverlaps,
  findRangeOfMotion,
  getAtlasBoneCompletenessCoverage,
  getAnatomyFoundationSummary,
  getAnatomyCitationCoverage,
  getAnatomyMilestoneCoverage,
  getGrossAnatomySystemCoverage,
  getWholeBodyAnatomyCoverage,
  searchAnatomyFoundation,
  validateAnatomyFoundation,
} from "../lib/anatomy-foundation.js"

function assertCommercialSafeMusclePack(muscleSlugs, { identifierProviders = ["UBERON", "NCIT", "FMA", "FIPAT"] } = {}) {
  const sourceBySlug = new Map(ANATOMY_FOUNDATION_SEED.sources.map((source) => [source.slug, source]))

  for (const muscleSlug of muscleSlugs) {
    const muscle = ANATOMY_FOUNDATION_SEED.muscles.find((entry) => entry.slug === muscleSlug)
    const citations = ANATOMY_FOUNDATION_SEED.citations.filter((citation) => citation.entityType === "muscle" && citation.entitySlug === muscleSlug && citation.reviewStatus === "reviewed")
    const citationFactTypes = new Set(citations.map((citation) => citation.factType))
    const terms = ANATOMY_FOUNDATION_SEED.entityTerms.filter((term) => term.anatomyEntityType === "muscle" && term.anatomyEntitySlug === muscleSlug)
    const identifiers = ANATOMY_FOUNDATION_SEED.externalIdentifiers.filter((identifier) => identifier.entityType === "muscle" && identifier.entitySlug === muscleSlug)
    const attachments = ANATOMY_FOUNDATION_SEED.muscleAttachments.filter((attachment) => attachment.muscle === muscleSlug)
    const actions = ANATOMY_FOUNDATION_SEED.muscleActions.filter((action) => action.muscle === muscleSlug)
    const innervation = ANATOMY_FOUNDATION_SEED.muscleInnervations.filter((entry) => entry.muscle === muscleSlug)

    assert.equal(sourceBySlug.get(muscle?.sourceRef ?? "")?.usageScope, "open_reuse", `${muscleSlug} must use an open-reuse source`)
    assert.ok((muscle?.description ?? "").length > 80, `${muscleSlug} needs a MassageLab-authored display summary`)
    assert.ok(terms.some((term) => ["preferred", "formal"].includes(term.termType) && term.sourceRef === "fipat-ta2"), `${muscleSlug} needs FIPAT-backed terminology`)
    assert.ok(identifiers.some((identifier) => identifierProviders.includes(identifier.provider)), `${muscleSlug} needs an accepted ontology identifier`)
    assert.ok(attachments.length >= 2, `${muscleSlug} needs origin and insertion facts`)
    assert.ok(attachments.every((attachment) => sourceBySlug.get(attachment.sourceRef)?.usageScope === "open_reuse"), `${muscleSlug} attachments must use open-reuse sources`)
    assert.ok(actions.length >= 1, `${muscleSlug} needs action facts`)
    assert.ok(actions.every((action) => sourceBySlug.get(action.sourceRef)?.usageScope === "open_reuse"), `${muscleSlug} actions must use open-reuse sources`)
    assert.ok(innervation.length >= 1, `${muscleSlug} needs innervation facts`)
    assert.ok(innervation.every((entry) => sourceBySlug.get(entry.sourceRef)?.usageScope === "open_reuse"), `${muscleSlug} innervation must use open-reuse sources`)

    for (const factType of ["clinical_summary", "origin", "insertion", "action", "innervation"]) {
      assert.ok(citationFactTypes.has(factType), `${muscleSlug} needs reviewed ${factType} citation`)
    }

    assert.ok(citations.some((citation) => citation.factType === "official_term" && citation.sourceRef === "fipat-ta2"), `${muscleSlug} needs reviewed official term citation`)
    assert.ok(citations.some((citation) => citation.factType === "external_identifier"), `${muscleSlug} needs reviewed external identifier citation`)
  }
}

function assertCommercialSafeBonePack(boneSlugs, { identifierProviders = ["UBERON", "FMA", "FIPAT"] } = {}) {
  const sourceBySlug = new Map(ANATOMY_FOUNDATION_SEED.sources.map((source) => [source.slug, source]))

  for (const boneSlug of boneSlugs) {
    const bone = ANATOMY_FOUNDATION_SEED.bones.find((entry) => entry.slug === boneSlug)
    const citations = ANATOMY_FOUNDATION_SEED.citations.filter((citation) => citation.entityType === "bone" && citation.entitySlug === boneSlug && citation.reviewStatus === "reviewed")
    const citationFactTypes = new Set(citations.map((citation) => citation.factType))
    const terms = ANATOMY_FOUNDATION_SEED.entityTerms.filter((term) => term.anatomyEntityType === "bone" && term.anatomyEntitySlug === boneSlug)
    const identifiers = ANATOMY_FOUNDATION_SEED.externalIdentifiers.filter((identifier) => identifier.entityType === "bone" && identifier.entitySlug === boneSlug)

    assert.equal(sourceBySlug.get(bone?.sourceRef ?? "")?.usageScope, "open_reuse", `${boneSlug} must use an open-reuse source`)
    assert.ok((bone?.description ?? "").length > 70, `${boneSlug} needs a MassageLab-authored bone summary`)
    assert.ok(terms.some((term) => ["preferred", "formal"].includes(term.termType) && term.sourceRef === "fipat-ta2"), `${boneSlug} needs FIPAT-backed terminology`)
    assert.ok(identifiers.some((identifier) => identifierProviders.includes(identifier.provider)), `${boneSlug} needs an accepted ontology identifier`)

    for (const factType of ["clinical_summary", "official_term", "external_identifier"]) {
      assert.ok(citationFactTypes.has(factType), `${boneSlug} needs reviewed ${factType} citation`)
    }

    assert.ok(citations
      .filter((citation) => citation.factType === "clinical_summary")
      .every((citation) => sourceBySlug.get(citation.sourceRef)?.usageScope === "open_reuse"), `${boneSlug} reviewed reusable facts must cite open-reuse sources`)
  }
}

function assertCommercialSafeLandmarkPack(landmarkSlugs) {
  const sourceBySlug = new Map(ANATOMY_FOUNDATION_SEED.sources.map((source) => [source.slug, source]))

  for (const landmarkSlug of landmarkSlugs) {
    const landmark = ANATOMY_FOUNDATION_SEED.boneLandmarks.find((entry) => entry.slug === landmarkSlug)
    const citations = ANATOMY_FOUNDATION_SEED.citations.filter((citation) => citation.entityType === "bone_landmark" && citation.entitySlug === landmarkSlug && citation.reviewStatus === "reviewed")
    const citationFactTypes = new Set(citations.map((citation) => citation.factType))
    const terms = ANATOMY_FOUNDATION_SEED.entityTerms.filter((term) => term.anatomyEntityType === "bone_landmark" && term.anatomyEntitySlug === landmarkSlug)

    assert.equal(sourceBySlug.get(landmark?.sourceRef ?? "")?.usageScope, "open_reuse", `${landmarkSlug} must use an open-reuse source`)
    assert.ok((landmark?.description ?? "").length > 45, `${landmarkSlug} needs a concise MassageLab-authored landmark summary`)
    assert.ok(terms.some((term) => ["preferred", "formal", "common"].includes(term.termType)), `${landmarkSlug} needs searchable terminology`)

    for (const factType of ["anatomy_landmark", "official_term"]) {
      assert.ok(citationFactTypes.has(factType), `${landmarkSlug} needs reviewed ${factType} citation`)
    }
  }
}

function assertCommercialSafeEntityPack(entityType, items, slugs, { minimumDescriptionLength = 60, identifierProviders = ["UBERON", "FMA", "FIPAT"] } = {}) {
  const sourceBySlug = new Map(ANATOMY_FOUNDATION_SEED.sources.map((source) => [source.slug, source]))

  for (const slug of slugs) {
    const item = items.find((entry) => entry.slug === slug)
    const citations = ANATOMY_FOUNDATION_SEED.citations.filter((citation) => citation.entityType === entityType && citation.entitySlug === slug && citation.reviewStatus === "reviewed")
    const citationFactTypes = new Set(citations.map((citation) => citation.factType))
    const terms = ANATOMY_FOUNDATION_SEED.entityTerms.filter((term) => term.anatomyEntityType === entityType && term.anatomyEntitySlug === slug)
    const identifiers = ANATOMY_FOUNDATION_SEED.externalIdentifiers.filter((identifier) => identifier.entityType === entityType && identifier.entitySlug === slug)

    assert.equal(sourceBySlug.get(item?.sourceRef ?? "")?.usageScope, "open_reuse", `${slug} must use an open-reuse source`)
    assert.ok((item?.description ?? "").length > minimumDescriptionLength, `${slug} needs a MassageLab-authored display summary`)
    assert.ok(terms.some((term) => ["preferred", "formal"].includes(term.termType) && term.sourceRef === "fipat-ta2"), `${slug} needs FIPAT-backed terminology`)
    assert.ok(identifiers.some((identifier) => identifierProviders.includes(identifier.provider)), `${slug} needs an accepted ontology identifier`)

    for (const factType of ["clinical_summary", "official_term", "external_identifier"]) {
      assert.ok(citationFactTypes.has(factType), `${slug} needs reviewed ${factType} citation`)
    }

    assert.ok(citations
      .filter((citation) => citation.factType === "clinical_summary")
      .every((citation) => sourceBySlug.get(citation.sourceRef)?.usageScope === "open_reuse"), `${slug} reviewed display facts must cite open-reuse sources`)
  }
}

function assertCommercialSafeStructurePack(structureSlugs) {
  const sourceBySlug = new Map(ANATOMY_FOUNDATION_SEED.sources.map((source) => [source.slug, source]))

  for (const structureSlug of structureSlugs) {
    const structure = ANATOMY_FOUNDATION_SEED.structures.find((entry) => entry.slug === structureSlug)
    const citations = ANATOMY_FOUNDATION_SEED.citations.filter((citation) => citation.entityType === "anatomy_structure" && citation.entitySlug === structureSlug && citation.reviewStatus === "reviewed")
    const citationFactTypes = new Set(citations.map((citation) => citation.factType))
    const terms = ANATOMY_FOUNDATION_SEED.entityTerms.filter((term) => term.anatomyEntityType === "anatomy_structure" && term.anatomyEntitySlug === structureSlug)

    assert.equal(sourceBySlug.get(structure?.sourceRef ?? "")?.usageScope, "open_reuse", `${structureSlug} must use an open-reuse source`)
    assert.ok((structure?.description ?? "").length > 70, `${structureSlug} needs a MassageLab-authored structure summary`)
    assert.ok(terms.some((term) => ["preferred", "formal"].includes(term.termType) && term.sourceRef === "fipat-ta2"), `${structureSlug} needs FIPAT-backed terminology`)
    assert.ok(terms.some((term) => ["common", "clinical", "alternate"].includes(term.termType)), `${structureSlug} needs searchable practical terminology`)

    for (const factType of ["clinical_summary", "official_term", "seed_source_reference"]) {
      assert.ok(citationFactTypes.has(factType), `${structureSlug} needs reviewed ${factType} citation`)
    }

    assert.ok(citations
      .filter((citation) => citation.factType === "clinical_summary")
      .every((citation) => sourceBySlug.get(citation.sourceRef)?.usageScope === "open_reuse"), `${structureSlug} reviewed display facts must cite open-reuse sources`)
  }
}

function assertCommercialSafeSource(sourceRef, label) {
  const sourceBySlug = new Map(ANATOMY_FOUNDATION_SEED.sources.map((source) => [source.slug, source]))
  const usageScope = sourceBySlug.get(sourceRef)?.usageScope

  assert.ok(["open_reuse", "commercial_licensed"].includes(usageScope), `${label} must use a commercial-safe source`)
}

describe("Anatomy data foundation", () => {
  it("keeps the initial anatomy foundation internally valid", () => {
    assert.deepEqual(validateAnatomyFoundation(), [])

    const summary = getAnatomyFoundationSummary()
    assert.ok(summary.bodyRegions >= 2)
    assert.ok(summary.bodySubregions >= 8)
    assert.ok(summary.muscles >= 24)
    assert.ok(summary.bones >= 10)
    assert.ok(summary.boneLandmarks >= 28)
    assert.ok(summary.joints >= 7)
    assert.ok(summary.jointMovements >= 20)
    assert.ok(summary.ligaments >= 10)
    assert.ok(summary.nerves >= 11)
    assert.ok(summary.actions >= 6)
    assert.ok(summary.rangesOfMotion >= 10)
    assert.ok(summary.bloodSupply >= 8)
    assert.ok(summary.painMapRegions >= 8)
    assert.ok(summary.clientTerms >= 18)
    assert.ok(summary.entityTerms >= 24)
    assert.ok(summary.structures >= 10)
    assert.ok(summary.structures >= 150)
    assert.ok(summary.concepts >= 200)
    assert.ok(summary.citations >= 8)
    assert.ok(summary.externalIdentifiers >= 8)
    assert.ok(summary.mediaAssets >= 3)
    assert.ok(summary.mediaEntityLinks >= 4)
  })

  it("assembles the seed from whole-body section modules", () => {
    assert.deepEqual(ANATOMY_SEED_SECTION_NAMES, [
      "sources",
      "physiology-concepts-core",
      "body-system-concepts",
      "cardiorespiratory-lymphatic-concepts",
      "remaining-body-system-concepts",
      "nervous-system-concepts",
      "movement-tissue-concepts",
      "gross-body-system-structures",
      "whole-body-scaffold",
      "atlas-bone-detail",
      "atlas-gap-closure",
      "atlas-completeness-closure",
      "atlas-depth-expansion",
      "soft-tissue-atlas",
      "fascial-lymphatic-atlas",
      "dermatome-myotome-atlas",
      "ligament-relationship-atlas",
      "individual-bone-landmark-atlas",
      "bone-landmark-citation-maturity",
      "joint-movement-completeness-atlas",
      "range-of-motion-protocol-atlas",
      "axial-bone-ontology-identifiers",
      "hand-foot-bone-ontology-identifiers",
      "metapodial-bone-ontology-identifiers",
      "phalangeal-bone-ontology-identifiers",
      "craniofacial-pelvic-bone-ontology-identifiers",
      "structure-relationship-completeness-atlas",
      "neurovascular-relationship-completeness-atlas",
      "vascular-lymphatic-atlas-closure",
      "media-r2-starter",
      "media-servier-starter",
      "media-servier-body-systems",
      "media-servier-locomotor",
      "media-servier-body-atlas",
      "media-servier-organ-detail",
      "media-coverage-gap-batch",
      "media-bodyparts3d-blood-supply-multiview",
      "media-bodyparts3d-bone-multiview",
      "media-bodyparts3d-muscle-batch-2",
      "media-bodyparts3d-muscle-multiview",
      "spatial-body-map-foundation",
      "neck-shoulder-upper-back",
      "trunk-spine-pelvis",
      "upper-limb",
      "lower-limb",
      "head-face-jaw",
    ])
  })

  it("tracks atlas-grade individual bone coverage instead of relying on grouped placeholders", () => {
    const coverage = getAtlasBoneCompletenessCoverage()
    const sourceBySlug = new Map(ANATOMY_FOUNDATION_SEED.sources.map((source) => [source.slug, source]))

    assert.ok(coverage.requiredIndividualBoneSlugs.length >= 80)
    assert.ok(coverage.presentIndividualBoneCount >= 80)
    assert.deepEqual(coverage.missingIndividualBoneSlugs, [])
    assert.deepEqual(coverage.missingGroupRelationshipKeys, [])

    for (const boneSlug of [
      "c3-vertebra",
      "c7-vertebra",
      "t1-vertebra",
      "t12-vertebra",
      "l5-vertebra",
      "first-rib",
      "twelfth-rib",
      "scaphoid",
      "lunate",
      "pisiform",
      "capitate",
      "talus",
      "navicular",
      "medial-cuneiform",
      "first-metacarpal",
      "fifth-metatarsal",
      "proximal-phalanx-thumb-hand",
      "distal-phalanx-thumb-hand",
      "middle-phalanx-ring-finger",
      "proximal-phalanx-hallux",
      "distal-phalanx-hallux",
      "middle-phalanx-fifth-toe",
    ]) {
      const bone = ANATOMY_FOUNDATION_SEED.bones.find((entry) => entry.slug === boneSlug)
      const terms = ANATOMY_FOUNDATION_SEED.entityTerms.filter((term) => term.anatomyEntityType === "bone" && term.anatomyEntitySlug === boneSlug)
      const citations = ANATOMY_FOUNDATION_SEED.citations.filter((citation) => citation.entityType === "bone" && citation.entitySlug === boneSlug && citation.reviewStatus === "reviewed")
      const citationFactTypes = new Set(citations.map((citation) => citation.factType))

      assert.equal(sourceBySlug.get(bone?.sourceRef ?? "")?.usageScope, "open_reuse", `${boneSlug} must use an open-reuse source`)
      assert.ok((bone?.description ?? "").length > 70, `${boneSlug} needs a MassageLab-authored atlas summary`)
      assert.ok(terms.some((term) => ["preferred", "formal"].includes(term.termType) && term.sourceRef === "fipat-ta2"), `${boneSlug} needs FIPAT-backed terminology`)
      assert.ok(terms.some((term) => ["common", "alternate"].includes(term.termType) && term.sourceRef === "applied-human-anatomy"), `${boneSlug} needs searchable common terminology`)
      assert.ok(citationFactTypes.has("clinical_summary"), `${boneSlug} needs a reviewed clinical summary citation`)
      assert.ok(citationFactTypes.has("official_term"), `${boneSlug} needs a reviewed official term citation`)
    }

    for (const query of ["C7 vertebra", "rib 12", "pisiform", "middle phalanx ring finger"]) {
      assert.ok(searchAnatomyFoundation(query).some((result) => result.entityType === "bone"), `${query} should find an individual bone`)
    }
  })

  it("adds reviewed UBERON identifiers for numbered vertebrae and ribs", () => {
    const sourceBySlug = new Map(ANATOMY_FOUNDATION_SEED.sources.map((source) => [source.slug, source]))
    const expectedIdentifiers = [
      ["c3-vertebra", "UBERON:0004612"],
      ["c4-vertebra", "UBERON:0004613"],
      ["c5-vertebra", "UBERON:0004614"],
      ["c6-vertebra", "UBERON:0004615"],
      ["c7-vertebra", "UBERON:0004616"],
      ["t1-vertebra", "UBERON:0004626"],
      ["t2-vertebra", "UBERON:0004627"],
      ["t3-vertebra", "UBERON:0004628"],
      ["t4-vertebra", "UBERON:0004629"],
      ["t5-vertebra", "UBERON:0004630"],
      ["t6-vertebra", "UBERON:0004631"],
      ["t7-vertebra", "UBERON:0004632"],
      ["t8-vertebra", "UBERON:0011050"],
      ["t9-vertebra", "UBERON:0004633"],
      ["t10-vertebra", "UBERON:0004634"],
      ["t11-vertebra", "UBERON:0004635"],
      ["t12-vertebra", "UBERON:0004636"],
      ["l1-vertebra", "UBERON:0004617"],
      ["l2-vertebra", "UBERON:0004618"],
      ["l3-vertebra", "UBERON:0004619"],
      ["l4-vertebra", "UBERON:0004620"],
      ["l5-vertebra", "UBERON:0004621"],
      ["first-rib", "UBERON:0004601"],
      ["second-rib", "UBERON:0004602"],
      ["third-rib", "UBERON:0004603"],
      ["fourth-rib", "UBERON:0004604"],
      ["fifth-rib", "UBERON:0004605"],
      ["sixth-rib", "UBERON:0004606"],
      ["seventh-rib", "UBERON:0004607"],
      ["eighth-rib", "UBERON:0010757"],
      ["ninth-rib", "UBERON:0004608"],
      ["tenth-rib", "UBERON:0004609"],
      ["eleventh-rib", "UBERON:0004610"],
      ["twelfth-rib", "UBERON:0004611"],
    ]

    assert.equal(sourceBySlug.get("ols-uberon")?.usageScope, "open_reuse")

    for (const [boneSlug, identifierValue] of expectedIdentifiers) {
      const identifier = ANATOMY_FOUNDATION_SEED.externalIdentifiers.find((entry) =>
        entry.entityType === "bone" &&
        entry.entitySlug === boneSlug &&
        entry.provider === "UBERON" &&
        entry.identifier === identifierValue)
      const citations = ANATOMY_FOUNDATION_SEED.citations.filter((citation) =>
        citation.entityType === "bone" &&
        citation.entitySlug === boneSlug &&
        citation.reviewStatus === "reviewed")

      assert.ok(identifier, `${boneSlug} needs the reviewed ${identifierValue} UBERON identifier`)
      assert.ok(citations.some((citation) =>
        citation.factType === "external_identifier" &&
        citation.factSlug === `external-id-${boneSlug}-uberon` &&
        citation.sourceRef === "ols-uberon" &&
        citation.sourceLocator === identifierValue), `${boneSlug} needs a reviewed external identifier citation`)
      assert.ok(citations.some((citation) =>
        citation.factType === "seed_source_reference" &&
        citation.factSlug === `external_identifier:${identifierValue}` &&
        citation.sourceRef === "ols-uberon"), `${boneSlug} needs a reviewed source-reference citation for the identifier`)
    }
  })

  it("adds reviewed UBERON identifiers for named carpal and tarsal bones", () => {
    const expectedIdentifiers = [
      ["scaphoid", "UBERON:0001427"],
      ["lunate", "UBERON:0001428"],
      ["triquetrum", "UBERON:0002445"],
      ["pisiform", "UBERON:0001429"],
      ["trapezium", "UBERON:0001430"],
      ["trapezoid", "UBERON:0001431"],
      ["capitate", "UBERON:0001432"],
      ["hamate", "UBERON:0001433"],
      ["talus", "UBERON:0002395"],
      ["navicular", "UBERON:0001451"],
      ["cuboid", "UBERON:0001455"],
      ["medial-cuneiform", "UBERON:0001452"],
      ["intermediate-cuneiform", "UBERON:0001453"],
      ["lateral-cuneiform", "UBERON:0001454"],
    ]

    for (const [boneSlug, identifierValue] of expectedIdentifiers) {
      const identifier = ANATOMY_FOUNDATION_SEED.externalIdentifiers.find((entry) =>
        entry.entityType === "bone" &&
        entry.entitySlug === boneSlug &&
        entry.provider === "UBERON" &&
        entry.identifier === identifierValue)
      const citations = ANATOMY_FOUNDATION_SEED.citations.filter((citation) =>
        citation.entityType === "bone" &&
        citation.entitySlug === boneSlug &&
        citation.reviewStatus === "reviewed")

      assert.ok(identifier, `${boneSlug} needs the reviewed ${identifierValue} UBERON identifier`)
      assert.ok(citations.some((citation) =>
        citation.factType === "external_identifier" &&
        citation.factSlug === `external-id-${boneSlug}-uberon` &&
        citation.sourceRef === "ols-uberon" &&
        citation.sourceLocator === identifierValue), `${boneSlug} needs a reviewed external identifier citation`)
      assert.ok(citations.some((citation) =>
        citation.factType === "seed_source_reference" &&
        citation.factSlug === `external_identifier:${identifierValue}` &&
        citation.sourceRef === "ols-uberon"), `${boneSlug} needs a reviewed source-reference citation for the identifier`)
    }
  })

  it("adds reviewed UBERON identifiers for individual metacarpals and metatarsals", () => {
    const expectedIdentifiers = [
      ["first-metacarpal", "UBERON:0003645"],
      ["second-metacarpal", "UBERON:0003646"],
      ["third-metacarpal", "UBERON:0003647"],
      ["fourth-metacarpal", "UBERON:0003648"],
      ["fifth-metacarpal", "UBERON:0003649"],
      ["first-metatarsal", "UBERON:0003650"],
      ["second-metatarsal", "UBERON:0003651"],
      ["third-metatarsal", "UBERON:0003652"],
      ["fourth-metatarsal", "UBERON:0003653"],
      ["fifth-metatarsal", "UBERON:0003654"],
    ]

    for (const [boneSlug, identifierValue] of expectedIdentifiers) {
      const identifier = ANATOMY_FOUNDATION_SEED.externalIdentifiers.find((entry) =>
        entry.entityType === "bone" &&
        entry.entitySlug === boneSlug &&
        entry.provider === "UBERON" &&
        entry.identifier === identifierValue)
      const citations = ANATOMY_FOUNDATION_SEED.citations.filter((citation) =>
        citation.entityType === "bone" &&
        citation.entitySlug === boneSlug &&
        citation.reviewStatus === "reviewed")

      assert.ok(identifier, `${boneSlug} needs the reviewed ${identifierValue} UBERON identifier`)
      assert.ok(citations.some((citation) =>
        citation.factType === "external_identifier" &&
        citation.factSlug === `external-id-${boneSlug}-uberon` &&
        citation.sourceRef === "ols-uberon" &&
        citation.sourceLocator === identifierValue), `${boneSlug} needs a reviewed external identifier citation`)
      assert.ok(citations.some((citation) =>
        citation.factType === "seed_source_reference" &&
        citation.factSlug === `external_identifier:${identifierValue}` &&
        citation.sourceRef === "ols-uberon"), `${boneSlug} needs a reviewed source-reference citation for the identifier`)
    }
  })

  it("adds reviewed UBERON identifiers for individual hand and foot phalanges", () => {
    const expectedIdentifiers = [
      ["proximal-phalanx-thumb-hand", "UBERON:0004338"],
      ["distal-phalanx-thumb-hand", "UBERON:0004337"],
      ["proximal-phalanx-index-finger", "UBERON:0004328"],
      ["middle-phalanx-index-finger", "UBERON:0004320"],
      ["distal-phalanx-index-finger", "UBERON:0004311"],
      ["proximal-phalanx-middle-finger", "UBERON:0004329"],
      ["middle-phalanx-middle-finger", "UBERON:0004321"],
      ["distal-phalanx-middle-finger", "UBERON:0004312"],
      ["proximal-phalanx-ring-finger", "UBERON:0004330"],
      ["middle-phalanx-ring-finger", "UBERON:0004322"],
      ["distal-phalanx-ring-finger", "UBERON:0004313"],
      ["proximal-phalanx-little-finger", "UBERON:0004331"],
      ["middle-phalanx-little-finger", "UBERON:0004323"],
      ["distal-phalanx-little-finger", "UBERON:0004314"],
      ["proximal-phalanx-hallux", "UBERON:0004332"],
      ["distal-phalanx-hallux", "UBERON:0004315"],
      ["proximal-phalanx-second-toe", "UBERON:0004333"],
      ["middle-phalanx-second-toe", "UBERON:0004324"],
      ["distal-phalanx-second-toe", "UBERON:0004316"],
      ["proximal-phalanx-third-toe", "UBERON:0004334"],
      ["middle-phalanx-third-toe", "UBERON:0004325"],
      ["distal-phalanx-third-toe", "UBERON:0004317"],
      ["proximal-phalanx-fourth-toe", "UBERON:0004335"],
      ["middle-phalanx-fourth-toe", "UBERON:0004326"],
      ["distal-phalanx-fourth-toe", "UBERON:0004318"],
      ["proximal-phalanx-fifth-toe", "UBERON:0004336"],
      ["middle-phalanx-fifth-toe", "UBERON:0004327"],
      ["distal-phalanx-fifth-toe", "UBERON:0004319"],
    ]

    for (const [boneSlug, identifierValue] of expectedIdentifiers) {
      const identifier = ANATOMY_FOUNDATION_SEED.externalIdentifiers.find((entry) =>
        entry.entityType === "bone" &&
        entry.entitySlug === boneSlug &&
        entry.provider === "UBERON" &&
        entry.identifier === identifierValue)
      const citations = ANATOMY_FOUNDATION_SEED.citations.filter((citation) =>
        citation.entityType === "bone" &&
        citation.entitySlug === boneSlug &&
        citation.reviewStatus === "reviewed")

      assert.ok(identifier, `${boneSlug} needs the reviewed ${identifierValue} UBERON identifier`)
      assert.ok(citations.some((citation) =>
        citation.factType === "external_identifier" &&
        citation.factSlug === `external-id-${boneSlug}-uberon` &&
        citation.sourceRef === "ols-uberon" &&
        citation.sourceLocator === identifierValue), `${boneSlug} needs a reviewed external identifier citation`)
      assert.ok(citations.some((citation) =>
        citation.factType === "seed_source_reference" &&
        citation.factSlug === `external_identifier:${identifierValue}` &&
        citation.sourceRef === "ols-uberon"), `${boneSlug} needs a reviewed source-reference citation for the identifier`)
    }
  })

  it("adds reviewed UBERON identifiers for craniofacial and pelvic bone records", () => {
    const expectedIdentifiers = [
      ["cranial-bones", "UBERON:0004766"],
      ["facial-bones", "UBERON:0003462"],
      ["parietal-bone", "UBERON:0000210"],
      ["ethmoid-bone", "UBERON:0001679"],
      ["nasal-bone", "UBERON:0001681"],
      ["lacrimal-bone", "UBERON:0001680"],
      ["palatine-bone", "UBERON:0001682"],
      ["vomer", "UBERON:0002396"],
      ["inferior-nasal-concha", "UBERON:0005922"],
      ["hip-bone", "UBERON:0001272"],
      ["ilium", "UBERON:0001273"],
      ["ischium", "UBERON:0001274"],
      ["pubis", "UBERON:0001275"],
    ]

    for (const [boneSlug, identifierValue] of expectedIdentifiers) {
      const identifier = ANATOMY_FOUNDATION_SEED.externalIdentifiers.find((entry) =>
        entry.entityType === "bone" &&
        entry.entitySlug === boneSlug &&
        entry.provider === "UBERON" &&
        entry.identifier === identifierValue)
      const citations = ANATOMY_FOUNDATION_SEED.citations.filter((citation) =>
        citation.entityType === "bone" &&
        citation.entitySlug === boneSlug &&
        citation.reviewStatus === "reviewed")

      assert.ok(identifier, `${boneSlug} needs the reviewed ${identifierValue} UBERON identifier`)
      assert.ok(citations.some((citation) =>
        citation.factType === "external_identifier" &&
        citation.factSlug === `external-id-${boneSlug}-uberon` &&
        citation.sourceRef === "ols-uberon" &&
        citation.sourceLocator === identifierValue), `${boneSlug} needs a reviewed external identifier citation`)
      assert.ok(citations.some((citation) =>
        citation.factType === "seed_source_reference" &&
        citation.factSlug === `external_identifier:${identifierValue}` &&
        citation.sourceRef === "ols-uberon"), `${boneSlug} needs a reviewed source-reference citation for the identifier`)
    }
  })

  it("tracks named skull, facial, and pelvic bone coverage for atlas-grade browsing", () => {
    const coverage = getAtlasBoneCompletenessCoverage()
    const sourceBySlug = new Map(ANATOMY_FOUNDATION_SEED.sources.map((source) => [source.slug, source]))

    assert.deepEqual(coverage.missingIndividualBoneSlugs, [])
    assert.deepEqual(coverage.missingGroupRelationshipKeys, [])

    for (const boneSlug of [
      "cranial-bones",
      "facial-bones",
      "parietal-bone",
      "ethmoid-bone",
      "nasal-bone",
      "lacrimal-bone",
      "palatine-bone",
      "vomer",
      "inferior-nasal-concha",
      "hip-bone",
      "ilium",
      "ischium",
      "pubis",
    ]) {
      const bone = ANATOMY_FOUNDATION_SEED.bones.find((entry) => entry.slug === boneSlug)
      const terms = ANATOMY_FOUNDATION_SEED.entityTerms.filter((term) => term.anatomyEntityType === "bone" && term.anatomyEntitySlug === boneSlug)
      const citations = ANATOMY_FOUNDATION_SEED.citations.filter((citation) => citation.entityType === "bone" && citation.entitySlug === boneSlug && citation.reviewStatus === "reviewed")
      const citationFactTypes = new Set(citations.map((citation) => citation.factType))

      assert.equal(sourceBySlug.get(bone?.sourceRef ?? "")?.usageScope, "open_reuse", `${boneSlug} must use an open-reuse source`)
      assert.ok((bone?.description ?? "").length > 70, `${boneSlug} needs a MassageLab-authored atlas summary`)
      assert.ok(terms.some((term) => ["preferred", "formal"].includes(term.termType) && term.sourceRef === "fipat-ta2"), `${boneSlug} needs FIPAT-backed terminology`)
      assert.ok(terms.some((term) => ["common", "alternate"].includes(term.termType) && term.sourceRef === "applied-human-anatomy"), `${boneSlug} needs searchable common terminology`)
      assert.ok(citationFactTypes.has("clinical_summary"), `${boneSlug} needs a reviewed clinical summary citation`)
      assert.ok(citationFactTypes.has("official_term"), `${boneSlug} needs a reviewed official term citation`)
    }

    for (const relationshipKey of [
      "cranial-bones->parietal-bone",
      "cranial-bones->ethmoid-bone",
      "facial-bones->nasal-bone",
      "facial-bones->inferior-nasal-concha",
      "hip-bone->ilium",
      "hip-bone->ischium",
      "hip-bone->pubis",
      "pelvis->hip-bone",
    ]) {
      assert.ok(coverage.requiredGroupRelationshipKeys.includes(relationshipKey), `${relationshipKey} should be a required atlas relationship`)
    }

    for (const query of ["parietal bone", "ethmoid", "inferior nasal concha", "hip bone", "sit bone ischium", "pubic bone"]) {
      assert.ok(searchAnatomyFoundation(query).some((result) => result.entityType === "bone"), `${query} should find a named bone`)
    }
  })

  it("assigns pelvic and craniofacial landmarks to individual bones instead of catch-all groups", () => {
    const sourceBySlug = new Map(ANATOMY_FOUNDATION_SEED.sources.map((source) => [source.slug, source]))
    const expectedLandmarkOwners = new Map([
      ["iliac-crest", "ilium"],
      ["anterior-superior-iliac-spine", "ilium"],
      ["posterior-superior-iliac-spine", "ilium"],
      ["iliac-fossa", "ilium"],
      ["ischial-tuberosity", "ischium"],
      ["ischial-spine", "ischium"],
      ["pubic-crest", "pubis"],
      ["pubic-symphysis", "pubis"],
      ["pubic-body", "pubis"],
      ["inferior-pubic-ramus", "pubis"],
      ["obturator-foramen", "hip-bone"],
      ["parietal-eminence", "parietal-bone"],
      ["superior-temporal-line", "parietal-bone"],
      ["cribriform-plate", "ethmoid-bone"],
      ["perpendicular-plate-ethmoid", "ethmoid-bone"],
      ["nasal-bridge", "nasal-bone"],
      ["lacrimal-fossa", "lacrimal-bone"],
      ["horizontal-plate-palatine", "palatine-bone"],
      ["perpendicular-plate-palatine", "palatine-bone"],
      ["posterior-nasal-septum", "vomer"],
      ["inferior-nasal-concha-body", "inferior-nasal-concha"],
      ["acetabulum", "hip-bone"],
      ["auricular-surface-ilium", "ilium"],
      ["pubic-tubercle", "pubis"],
    ])

    for (const [landmarkSlug, expectedBoneSlug] of expectedLandmarkOwners) {
      const landmark = ANATOMY_FOUNDATION_SEED.boneLandmarks.find((entry) => entry.slug === landmarkSlug)
      const terms = ANATOMY_FOUNDATION_SEED.entityTerms.filter((term) => term.anatomyEntityType === "bone_landmark" && term.anatomyEntitySlug === landmarkSlug)
      const citations = ANATOMY_FOUNDATION_SEED.citations.filter((citation) => citation.entityType === "bone_landmark" && citation.entitySlug === landmarkSlug && citation.reviewStatus === "reviewed")
      const citationFactTypes = new Set(citations.map((citation) => citation.factType))

      assert.equal(landmark?.bone, expectedBoneSlug, `${landmarkSlug} should belong to ${expectedBoneSlug}`)
      assert.equal(sourceBySlug.get(landmark?.sourceRef ?? "")?.usageScope, "open_reuse", `${landmarkSlug} must use an open-reuse source`)
      assert.ok((landmark?.description ?? "").length > 45, `${landmarkSlug} needs a MassageLab-authored landmark summary`)
      assert.ok(terms.some((term) => ["preferred", "formal"].includes(term.termType) && term.sourceRef === "fipat-ta2"), `${landmarkSlug} needs FIPAT-backed terminology`)
      assert.ok(terms.some((term) => ["common", "alternate"].includes(term.termType) && term.sourceRef === "applied-human-anatomy"), `${landmarkSlug} needs searchable common terminology`)
      assert.ok(citationFactTypes.has("anatomy_landmark"), `${landmarkSlug} needs a reviewed landmark citation`)
      assert.ok(citationFactTypes.has("official_term"), `${landmarkSlug} needs a reviewed official term citation`)
    }

    for (const query of ["ASIS", "sit bone", "cribriform plate", "lacrimal fossa", "pubic tubercle"]) {
      assert.ok(searchAnatomyFoundation(query).some((result) => result.entityType === "bone_landmark"), `${query} should find a named landmark`)
    }
  })

  it("gives every bone at least one seed-addressable landmark for atlas browsing", () => {
    const bonesWithoutLandmarks = ANATOMY_FOUNDATION_SEED.bones
      .filter((bone) => !ANATOMY_FOUNDATION_SEED.boneLandmarks.some((landmark) => landmark.bone === bone.slug))
      .map((bone) => bone.slug)

    assert.deepEqual(bonesWithoutLandmarks, [])

    for (const landmarkSlug of [
      "atlas-c3-vertebra-spinous-process",
      "atlas-t12-vertebra-spinous-process",
      "atlas-l5-vertebra-spinous-process",
      "atlas-first-rib-shaft",
      "atlas-scaphoid-body",
      "atlas-talus-body",
      "atlas-fifth-metatarsal-base",
      "atlas-proximal-phalanx-index-finger-base",
      "atlas-distal-phalanx-hallux-base",
      "atlas-patella-anterior-surface",
      "atlas-cranial-bones-reference-region",
    ]) {
      assertCommercialSafeLandmarkPack([landmarkSlug])
    }

    assert.ok(searchAnatomyFoundation("C3 spinous process").some((result) => result.slug === "atlas-c3-vertebra-spinous-process"))
    assert.ok(searchAnatomyFoundation("scaphoid body").some((result) => result.slug === "atlas-scaphoid-body"))
    assert.ok(searchAnatomyFoundation("great toe distal phalanx base").some((result) => result.slug === "atlas-distal-phalanx-hallux-base"))
  })

  it("brings every bone landmark to reviewed citation maturity", () => {
    const landmarksMissingReviewedAnatomyCitation = ANATOMY_FOUNDATION_SEED.boneLandmarks
      .filter((landmark) => !ANATOMY_FOUNDATION_SEED.citations.some((citation) => (
        citation.entityType === "bone_landmark"
        && citation.entitySlug === landmark.slug
        && citation.factType === "anatomy_landmark"
        && citation.reviewStatus === "reviewed"
      )))
      .map((landmark) => landmark.slug)
    const landmarksMissingReviewedOfficialTermCitation = ANATOMY_FOUNDATION_SEED.boneLandmarks
      .filter((landmark) => !ANATOMY_FOUNDATION_SEED.citations.some((citation) => (
        citation.entityType === "bone_landmark"
        && citation.entitySlug === landmark.slug
        && citation.factType === "official_term"
        && citation.reviewStatus === "reviewed"
      )))
      .map((landmark) => landmark.slug)

    assert.deepEqual(landmarksMissingReviewedAnatomyCitation, [])
    assert.deepEqual(landmarksMissingReviewedOfficialTermCitation, [])
  })

  it("covers a whole-body scaffold before section-level deepening", () => {
    const coverage = getWholeBodyAnatomyCoverage()

    assert.deepEqual(coverage.missingRequiredRegionSlugs, [])
    assert.deepEqual(coverage.missingRequiredSubregionSlugs, [])
    assert.deepEqual(coverage.missingRequiredClientTermSlugs, [])
    assert.deepEqual(coverage.missingRequiredStructureSlugs, [])
    assert.ok(coverage.sectionPackSlugs.includes("trunk-spine-pelvis"))
    assert.ok(coverage.sectionPackSlugs.includes("upper-limb"))
    assert.ok(coverage.sectionPackSlugs.includes("lower-limb"))
    assert.ok(coverage.sectionPackSlugs.includes("head-face-jaw"))
  })

  it("adds normalized gross anatomy structures across body systems with reviewed reusable citations", () => {
    const coverage = getGrossAnatomySystemCoverage()
    const sourceBySlug = new Map(ANATOMY_FOUNDATION_SEED.sources.map((source) => [source.slug, source]))
    const structureBySlug = new Map(ANATOMY_FOUNDATION_SEED.structures.map((structure) => [structure.slug, structure]))

    assert.deepEqual(coverage.missingRequiredSystemSlugs, [])
    assert.deepEqual(coverage.missingRequiredStructureSlugs, [])
    assert.ok(coverage.systems.every((system) => system.presentStructureSlugs.length >= system.requiredStructureSlugs.length))

    for (const structureSlug of coverage.requiredStructureSlugs) {
      const structure = structureBySlug.get(structureSlug)
      const citations = ANATOMY_FOUNDATION_SEED.citations.filter((citation) => citation.entityType === "anatomy_structure" && citation.entitySlug === structureSlug)
      const terms = ANATOMY_FOUNDATION_SEED.entityTerms.filter((term) => term.anatomyEntityType === "anatomy_structure" && term.anatomyEntitySlug === structureSlug)
      const systemRelationships = ANATOMY_FOUNDATION_SEED.relationships.filter((relationship) => relationship.targetEntityType === "anatomy_structure" && relationship.targetEntitySlug === structureSlug && relationship.relationshipType === "includes_structure")

      assert.ok(structure, `${structureSlug} should be seeded as a normalized gross anatomy structure`)
      assert.equal(sourceBySlug.get(structure?.sourceRef ?? "")?.usageScope, "open_reuse", `${structureSlug} must use an open-reuse source`)
      assert.ok((structure?.description ?? "").length > 60, `${structureSlug} needs a MassageLab-authored display summary`)
      assert.ok(terms.some((term) => ["preferred", "formal", "common"].includes(term.termType)), `${structureSlug} needs searchable terminology`)
      assert.ok(citations.some((citation) => citation.factType === "clinical_summary" && citation.reviewStatus === "reviewed"), `${structureSlug} needs a reviewed clinical summary citation`)
      assert.ok(systemRelationships.length >= 1, `${structureSlug} needs a system relationship`)
    }

    assert.ok(searchAnatomyFoundation("skin barrier").some((result) => result.slug === "skin"))
    assert.ok(searchAnatomyFoundation("air sacs").some((result) => result.slug === "alveolus"))
    assert.ok(searchAnatomyFoundation("urinary bladder").some((result) => result.slug === "urinary-bladder"))
    assert.ok(searchAnatomyFoundation("pituitary gland").some((result) => result.slug === "pituitary-gland"))
    assert.ok(searchAnatomyFoundation("spinal cord").some((result) => result.slug === "spinal-cord"))
  })

  it("connects every modeled anatomy structure to at least one browseable relationship", () => {
    const structuresWithoutRelationships = ANATOMY_FOUNDATION_SEED.structures
      .filter((structure) => !ANATOMY_FOUNDATION_SEED.relationships.some((relationship) => (
        (relationship.sourceEntityType === "anatomy_structure" && relationship.sourceEntitySlug === structure.slug)
        || (relationship.targetEntityType === "anatomy_structure" && relationship.targetEntitySlug === structure.slug)
      )))
      .map((structure) => structure.slug)

    assert.deepEqual(structuresWithoutRelationships, [])

    for (const relationshipId of [
      "relationship-intervertebral-disc-associated-with-lumbar-spine",
      "relationship-thoracolumbar-fascia-associated-with-lumbar-region",
      "relationship-abdominal-aponeurosis-supports-rectus-abdominis",
      "relationship-triceps-tendon-attaches-to-olecranon",
      "relationship-deep-transverse-metacarpal-ligament-stabilizes-mcp",
      "relationship-olecranon-bursa-overlies-olecranon",
    ]) {
      const relationship = ANATOMY_FOUNDATION_SEED.relationships.find((entry) => entry.id === relationshipId)
      const citation = ANATOMY_FOUNDATION_SEED.citations.find((entry) => (
        entry.entityType === relationship?.sourceEntityType
        && entry.entitySlug === relationship?.sourceEntitySlug
        && entry.factType === "seed_source_reference"
        && entry.factSlug === `relationship:${relationshipId}`
        && entry.reviewStatus === "reviewed"
      ))

      assert.ok(relationship, `${relationshipId} should be present`)
      assert.equal(relationship?.sourceRef, "applied-human-anatomy")
      assert.ok(citation, `${relationshipId} needs a reviewed source-reference citation`)
    }
  })

  it("connects every modeled blood vessel and non-muscle-innervating nerve to browseable relationships", () => {
    const relationshipFor = (entityType, slug) => ANATOMY_FOUNDATION_SEED.relationships.some((relationship) => (
      (relationship.sourceEntityType === entityType && relationship.sourceEntitySlug === slug)
      || (relationship.targetEntityType === entityType && relationship.targetEntitySlug === slug)
    ))

    const bloodVesselsWithoutRelationships = ANATOMY_FOUNDATION_SEED.bloodSupply
      .filter((bloodSupply) => !relationshipFor("blood_supply", bloodSupply.slug))
      .map((bloodSupply) => bloodSupply.slug)
    const nervesWithoutBrowseableRelationships = ANATOMY_FOUNDATION_SEED.nerves
      .filter((nerve) => !ANATOMY_FOUNDATION_SEED.muscleInnervations.some((innervation) => innervation.nerve === nerve.slug))
      .filter((nerve) => !relationshipFor("nerve", nerve.slug))
      .map((nerve) => nerve.slug)

    assert.deepEqual(bloodVesselsWithoutRelationships, [])
    assert.deepEqual(nervesWithoutBrowseableRelationships, [])

    for (const relationshipId of [
      "relationship-external-jugular-vein-drains-neck",
      "relationship-axillary-artery-supplies-shoulder-girdle",
      "relationship-cephalic-vein-drains-upper-limb",
      "relationship-abdominal-aorta-supplies-abdomen",
      "relationship-internal-thoracic-artery-supplies-thorax",
      "relationship-internal-pudendal-vein-drains-pelvis",
      "relationship-basilic-vein-drains-upper-limb",
      "relationship-femoral-artery-supplies-thigh",
      "relationship-femoral-vein-drains-thigh",
      "relationship-anterior-tibial-artery-supplies-leg",
      "relationship-posterior-tibial-artery-supplies-leg",
      "relationship-external-carotid-artery-supplies-head-face-jaw",
      "relationship-maxillary-artery-supplies-jaw",
      "relationship-superficial-temporal-artery-supplies-head",
      "relationship-facial-vein-drains-face",
      "relationship-sacral-plexus-gives-rise-to-sciatic-nerve",
      "relationship-lumbar-plexus-gives-rise-to-ilioinguinal-nerve",
    ]) {
      const relationship = ANATOMY_FOUNDATION_SEED.relationships.find((entry) => entry.id === relationshipId)
      const citation = ANATOMY_FOUNDATION_SEED.citations.find((entry) => (
        entry.entityType === relationship?.sourceEntityType
        && entry.entitySlug === relationship?.sourceEntitySlug
        && entry.factType === "seed_source_reference"
        && entry.factSlug === `relationship:${relationshipId}`
        && entry.reviewStatus === "reviewed"
      ))

      assert.ok(relationship, `${relationshipId} should be present`)
      assert.equal(relationship?.sourceRef, "applied-human-anatomy")
      assert.ok(citation, `${relationshipId} needs a reviewed source-reference citation`)
    }
  })

  it("covers the neck, shoulder, scapular, glenohumeral, and upper-back milestone slice", () => {
    const coverage = getAnatomyMilestoneCoverage()

    assert.deepEqual(coverage.missingRequiredMuscleSlugs, [])
    assert.deepEqual(coverage.missingRequiredJointSlugs, [])
    assert.deepEqual(coverage.missingRequiredNerveSlugs, [])
    assert.deepEqual(coverage.missingRequiredClientTermSlugs, [])
    assert.ok(coverage.musclesWithAttachmentCount >= 24)
    assert.ok(coverage.musclesWithInnervationCount >= 24)
    assert.ok(coverage.musclesWithActionCount >= 18)
    assert.ok(coverage.musclesWithEntityTermCount >= 18)
  })

  it("uses stable slugs and models rich relationships without requiring diagnosis", () => {
    const term = findClientTermMapping("knot by shoulder blade")

    assert.equal(term?.slug, "knot-by-shoulder-blade")
    assert.equal(term?.clinicalUse, "non-diagnostic")
    assert.ok(term?.likelyRegions.includes("scapular-region"))
    assert.ok(term?.likelyStructures.includes("levator-scapulae"))
    assert.ok(term?.likelyStructures.includes("rhomboid-major"))
    assert.equal(term?.therapistPrompt, "Use as a conversation starter, then choose clinically relevant structures from assessment findings.")
  })

  it("keeps citation natural keys unique for idempotent Prisma seeding", () => {
    const seen = new Map()
    const duplicates = []

    for (const citation of ANATOMY_FOUNDATION_SEED.citations) {
      const key = [
        citation.entityType,
        citation.entitySlug,
        citation.factType,
        citation.factSlug ?? "",
        citation.sourceRef,
        citation.sourceLocator ?? "",
      ].join("|")

      if (seen.has(key)) {
        duplicates.push(`${seen.get(key)} / ${citation.slug}`)
        continue
      }

      seen.set(key, citation.slug)
    }

    assert.deepEqual(duplicates, [])
  })

  it("supports muscle action roles including concentric, eccentric, reverse, and isometric actions", () => {
    const upperTrapeziusActions = ANATOMY_FOUNDATION_SEED.muscleActions.filter((action) => action.muscle === "upper-trapezius")
    const roles = new Set(upperTrapeziusActions.map((action) => action.role))
    const contractionTypes = new Set(upperTrapeziusActions.map((action) => action.contractionType))

    assert.ok(roles.has("primary"))
    assert.ok(roles.has("secondary"))
    assert.ok(roles.has("stabilizer"))
    assert.ok(contractionTypes.has("concentric"))
    assert.ok(contractionTypes.has("eccentric"))
    assert.ok(contractionTypes.has("reverse_action"))
  })

  it("connects joints to bones, ligaments, actions, and sourced range-of-motion values", () => {
    const cervicalSpine = ANATOMY_FOUNDATION_SEED.joints.find((joint) => joint.slug === "cervical-spine")
    const cervicalMovements = ANATOMY_FOUNDATION_SEED.jointMovements.filter((movement) => movement.joint === "cervical-spine")
    const cervicalLigaments = ANATOMY_FOUNDATION_SEED.ligaments.filter((ligament) => ligament.joint === "cervical-spine")
    const cervicalRom = ANATOMY_FOUNDATION_SEED.rangesOfMotion.filter((range) => range.joint === "cervical-spine")

    assert.equal(cervicalSpine?.region, "head-neck")
    assert.ok(cervicalLigaments.some((ligament) => ligament.slug === "nuchal-ligament"))
    assert.ok(cervicalMovements.some((movement) => movement.slug === "cervical-rotation"))
    assert.ok(cervicalRom.some((range) => range.movement === "cervical-rotation" && range.typicalMinDegrees === 70 && range.typicalMaxDegrees === 90))
    assert.ok(cervicalRom
      .filter((range) => range.measurementUnit === "degrees")
      .every((range) => range.sourceRef === "cdc-normal-joint-rom"))
    assert.ok(cervicalRom
      .filter((range) => range.measurementUnit === "ordinal_0_5")
      .every((range) => range.sourceRef === "massagelab-authored-rom-tracking"))
  })

  it("gives every modeled joint at least one movement reference", () => {
    const jointsWithoutMovements = ANATOMY_FOUNDATION_SEED.joints
      .filter((joint) => !ANATOMY_FOUNDATION_SEED.jointMovements.some((movement) => movement.joint === joint.slug))
      .map((joint) => joint.slug)

    assert.deepEqual(jointsWithoutMovements, [])

    for (const movementSlug of [
      "acromioclavicular-glide",
      "acromioclavicular-rotation",
      "sacroiliac-nutation",
      "sacroiliac-counternutation",
    ]) {
      const movement = ANATOMY_FOUNDATION_SEED.jointMovements.find((entry) => entry.slug === movementSlug)
      const citations = ANATOMY_FOUNDATION_SEED.citations.filter((citation) => (
        citation.entityType === "joint_movement"
        && citation.entitySlug === movementSlug
        && citation.reviewStatus === "reviewed"
      ))
      const citationFactTypes = new Set(citations.map((citation) => citation.factType))

      assert.equal(movement?.sourceRef, "applied-human-anatomy")
      assert.ok((movement?.description ?? "").length > 40, `${movementSlug} needs a practical movement description`)
      assert.ok(citationFactTypes.has("movement_definition"), `${movementSlug} needs a reviewed movement definition citation`)
      assert.ok(citationFactTypes.has("seed_source_reference"), `${movementSlug} needs a reviewed source-reference citation`)
    }

    assert.ok(searchAnatomyFoundation("AC joint glide").some((result) => result.slug === "acromioclavicular-glide"))
    assert.ok(searchAnatomyFoundation("SI joint nutation").some((result) => result.slug === "sacroiliac-nutation"))
  })

  it("adds unit-aware ROM or tracking protocols for every modeled joint", () => {
    const jointsWithoutRom = ANATOMY_FOUNDATION_SEED.joints
      .filter((joint) => !ANATOMY_FOUNDATION_SEED.rangesOfMotion.some((range) => range.joint === joint.slug))
      .map((joint) => joint.slug)

    assert.deepEqual(jointsWithoutRom, [])

    for (const [jointSlug, movementSlug, unit, minValue, maxValue] of [
      ["atlanto-occipital", "atlanto-occipital-extension", "degrees", 15, 25],
      ["acromioclavicular", "acromioclavicular-rotation", "degrees", 5, 10],
      ["sternoclavicular", "clavicular-depression", "degrees", 5, 15],
      ["scapulothoracic", "scapular-upward-rotation", "degrees", 50, 60],
      ["sacroiliac", "sacroiliac-nutation", "degrees", 1, 4],
      ["thoracic-cage", "thoracic-cage-expansion", "centimeters", 2, 7],
      ["metacarpophalangeal-joints", "finger-abduction", "degrees", 15, 25],
      ["thumb-carpometacarpal-joint", "thumb-abduction", "degrees", 45, 70],
      ["thumb-metacarpophalangeal-joint", "thumb-flexion", "degrees", 40, 60],
      ["interphalangeal-joints-of-hand", "finger-flexion", "degrees", 70, 110],
      ["subtalar-joint", "foot-inversion", "degrees", 30, 35],
      ["metatarsophalangeal-joints", "hallux-extension", "degrees", 50, 70],
      ["temporomandibular-joint", "jaw-depression", "millimeters", 35, 50],
      ["facial-expression-complex", "lip-closure", "ordinal_0_5", 0, 5],
      ["hyoid-functional-complex", "hyoid-elevation", "ordinal_0_5", 0, 5],
      ["tongue-functional-complex", "tongue-protrusion", "ordinal_0_5", 0, 5],
      ["laryngeal-functional-complex", "laryngeal-elevation", "ordinal_0_5", 0, 5],
      ["pelvic-floor-functional-complex", "pelvic-floor-support", "ordinal_0_5", 0, 5],
    ]) {
      const range = findRangeOfMotion(jointSlug, movementSlug)
      const citations = ANATOMY_FOUNDATION_SEED.citations.filter((citation) => (
        citation.entityType === "range_of_motion"
        && citation.entitySlug === range?.slug
        && citation.reviewStatus === "reviewed"
      ))
      const citationFactTypes = new Set(citations.map((citation) => citation.factType))

      assert.equal(range?.measurementUnit, unit)
      assert.equal(range?.typicalMinValue, minValue)
      assert.equal(range?.typicalMaxValue, maxValue)
      assert.ok(citationFactTypes.has("rom_protocol"), `${range?.slug} needs a reviewed ROM protocol citation`)
      assert.ok(citationFactTypes.has("seed_source_reference"), `${range?.slug} needs a reviewed source-reference citation`)
    }
  })

  it("validates source refs, typed relationships, and polymorphic entity references", () => {
    const seed = structuredClone(ANATOMY_FOUNDATION_SEED)
    seed.muscleAttachments[0].sourceRef = "missing-source"
    seed.muscleInnervations[0].muscle = "missing-muscle"
    seed.entityTerms[0].anatomyEntitySlug = "missing-entity"
    seed.relationships[0].targetEntitySlug = "missing-target"
    seed.clientTerms[0].mappedStructureSlug = "missing-structure"
    seed.structures[0].region = "missing-region"
    seed.citations[0].sourceRef = "missing-source"
    seed.externalIdentifiers[0].entitySlug = "missing-entity"
    seed.mediaAssets[0].licenseUrl = ""
    seed.mediaEntityLinks[0].entitySlug = "missing-entity"
    seed.painMapRegions[0].laterality = undefined
    seed.painMapRegions[1].surface = undefined
    seed.movementVisualizations[0].primaryEntitySlug = undefined
    seed.movementVisualizations[0].movement = "cervical-rotation"
    seed.movementVisualizations[0].rangeOfMotion = "cervical-rotation"

    const issues = validateAnatomyFoundation(seed)

    assert.ok(issues.some((issue) => issue.includes("Invalid sourceRef for attachment")))
    assert.ok(issues.some((issue) => issue.includes("Invalid muscle for innervation")))
    assert.ok(issues.some((issue) => issue.includes("Invalid entity term target")))
    assert.ok(issues.some((issue) => issue.includes("Invalid relationship target")))
    assert.ok(issues.some((issue) => issue.includes("Invalid mapped structure for client term")))
    assert.ok(issues.some((issue) => issue.includes("Invalid region for structure")))
    assert.ok(issues.some((issue) => issue.includes("Invalid sourceRef for citation")))
    assert.ok(issues.some((issue) => issue.includes("Invalid external identifier target")))
    assert.ok(issues.some((issue) => issue.includes("Media asset requires license URL")))
    assert.ok(issues.some((issue) => issue.includes("Invalid media entity target")))
    assert.ok(issues.some((issue) => issue.includes("Pain map requires laterality")))
    assert.ok(issues.some((issue) => issue.includes("Pain map requires surface")))
    assert.ok(issues.some((issue) => issue.includes("requires both primary entity type and slug")))
    assert.ok(issues.some((issue) => issue.includes("does not belong to joint")))
    assert.ok(issues.some((issue) => issue.includes("does not match joint")))
  })

  it("keeps open-license reuse explicit across sources, identifiers, citations, and media", () => {
    const openStax = ANATOMY_FOUNDATION_SEED.sources.find((source) => source.slug === "openstax-ap-2e")
    const bodyParts3d = ANATOMY_FOUNDATION_SEED.sources.find((source) => source.slug === "bodyparts3d")
    const scapulaIds = ANATOMY_FOUNDATION_SEED.externalIdentifiers.filter((identifier) => identifier.entitySlug === "scapula")
    const scapulaMedia = ANATOMY_FOUNDATION_SEED.mediaEntityLinks.filter((link) => link.entityType === "bone" && link.entitySlug === "scapula")
    const reviewedCitation = ANATOMY_FOUNDATION_SEED.citations.find((citation) => citation.slug === "citation-scapula-uberon-definition")

    assert.equal(openStax?.license, "CC BY-NC-SA 4.0")
    assert.equal(openStax?.usageScope, "internal_reference")
    assert.equal(bodyParts3d?.usageScope, "open_reuse")
    assert.ok(scapulaIds.some((identifier) => identifier.provider === "UBERON" && identifier.identifier === "UBERON:0006849"))
    assert.ok(scapulaIds.some((identifier) => identifier.provider === "FIPAT" && identifier.sourceRef === "fipat-ta2"))
    assert.ok(scapulaMedia.some((link) => link.assetSlug === "bodyparts3d-scapula-reference"))
    assert.equal(reviewedCitation?.reviewStatus, "reviewed")
  })

  it("tracks reviewed R2 starter media with storage paths, entity links, and citations", () => {
    const expectedAssets = [
      ["bodyparts3d-brain-anatomogram", "brain"],
      ["bodyparts3d-heart-anatomogram", "heart"],
      ["bodyparts3d-eye-anatomogram", "eye"],
    ]

    for (const [assetSlug, entitySlug] of expectedAssets) {
      const asset = ANATOMY_FOUNDATION_SEED.mediaAssets.find((entry) => entry.slug === assetSlug)
      const links = ANATOMY_FOUNDATION_SEED.mediaEntityLinks.filter((link) => link.assetSlug === assetSlug)
      const citations = ANATOMY_FOUNDATION_SEED.citations.filter((citation) => citation.factSlug === assetSlug)
      const citationFactTypes = new Set(citations.map((citation) => citation.factType))

      assert.equal(asset?.mediaType, "image")
      assert.equal(asset?.sourceRef, "bodyparts3d")
      assert.equal(asset?.usageScope, "open_reuse")
      assert.equal(asset?.reviewStatus, "reviewed")
      assert.equal(asset?.license, "CC BY 4.0")
      assert.match(asset?.storagePath ?? "", /^anatomy\/bodyparts3d\/anatomograms\/.+\.png$/)
      assert.equal(asset?.metadata?.r2Upload, true)
      assert.equal(asset?.metadata?.ingestionStatus, "pending_r2_upload")
      assert.ok(links.some((link) => link.entityType === "anatomy_structure" && link.entitySlug === entitySlug && link.role === "primary"))
      assert.ok(links.some((link) => link.entityType === "anatomy_concept" && link.entitySlug === entitySlug && link.role === "client_education"))
      assert.ok(citationFactTypes.has("media_source"))
      assert.ok(citationFactTypes.has("media_license"))
      assert.ok(citations.every((citation) => citation.sourceRef === "bodyparts3d" && citation.reviewStatus === "reviewed"))
    }
  })

  it("tracks reviewed Servier 2D starter media with education links and citations", () => {
    const source = ANATOMY_FOUNDATION_SEED.sources.find((entry) => entry.slug === "servier-medical-art")
    const expectedAssets = [
      ["servier-heart-2d-illustration", "anatomy_structure", "heart"],
      ["servier-brain-2d-illustration", "anatomy_structure", "brain"],
      ["servier-lungs-2d-illustration", "anatomy_structure", "lung"],
      ["servier-lymphatic-circulation-2d-illustration", "anatomy_concept", "lymphatic-system"],
      ["servier-integumentary-system-2d-illustration", "anatomy_structure", "skin"],
      ["servier-eye-structure-2d-illustration", "anatomy_structure", "eye"],
    ]

    assert.equal(source?.license, "CC BY 4.0")
    assert.equal(source?.usageScope, "open_reuse")
    assert.match(source?.attribution ?? "", /Servier Medical Art/)

    for (const [assetSlug, entityType, entitySlug] of expectedAssets) {
      const asset = ANATOMY_FOUNDATION_SEED.mediaAssets.find((entry) => entry.slug === assetSlug)
      const links = ANATOMY_FOUNDATION_SEED.mediaEntityLinks.filter((link) => link.assetSlug === assetSlug)
      const citations = ANATOMY_FOUNDATION_SEED.citations.filter((citation) => citation.factSlug === assetSlug)
      const citationFactTypes = new Set(citations.map((citation) => citation.factType))

      assert.equal(asset?.mediaType, "image")
      assert.equal(asset?.sourceRef, "servier-medical-art")
      assert.equal(asset?.usageScope, "open_reuse")
      assert.equal(asset?.reviewStatus, "reviewed")
      assert.equal(asset?.license, "CC BY 4.0")
      assert.match(asset?.sourceUrl ?? "", /^https:\/\/smart\.servier\.com\/wp-content\/uploads\/.+\.png$/)
      assert.match(asset?.storagePath ?? "", /^anatomy\/servier\/2d\/.+\.png$/)
      assert.equal(asset?.metadata?.r2Upload, true)
      assert.equal(asset?.metadata?.visualStyle, "2d-medical-illustration")
      assert.equal(asset?.metadata?.ingestionStatus, "pending_r2_upload")
      assert.ok(links.some((link) => link.entityType === entityType && link.entitySlug === entitySlug && link.role === "primary"))
      assert.ok(citationFactTypes.has("media_source"))
      assert.ok(citationFactTypes.has("media_license"))
      assert.ok(citations.every((citation) => citation.sourceRef === "servier-medical-art" && citation.reviewStatus === "reviewed"))
    }
  })

  it("tracks reviewed Servier 2D body-system media with education links and citations", () => {
    const expectedAssets = [
      ["servier-muscle-anatomy-2d-illustration", "anatomy_concept", "musculoskeletal-system"],
      ["servier-bone-structure-2d-illustration", "anatomy_concept", "musculoskeletal-system"],
      ["servier-artery-2d-illustration", "anatomy_structure", "artery"],
      ["servier-arterial-wall-2d-illustration", "anatomy_structure", "artery"],
      ["servier-venous-circulation-2d-illustration", "anatomy_structure", "vein"],
      ["servier-lymph-node-2d-illustration", "anatomy_structure", "lymph-node"],
      ["servier-stomach-2d-illustration", "anatomy_structure", "stomach"],
      ["servier-liver-2d-illustration", "anatomy_structure", "liver"],
      ["servier-pancreas-2d-illustration", "anatomy_structure", "pancreas"],
      ["servier-intestine-2d-illustration", "anatomy_structure", "small-intestine"],
      ["servier-kidney-2d-illustration", "anatomy_structure", "kidney"],
      ["servier-neuron-2d-illustration", "anatomy_concept", "neuron"],
      ["servier-spinal-cord-section-2d-illustration", "anatomy_structure", "spinal-cord"],
    ]

    for (const [assetSlug, entityType, entitySlug] of expectedAssets) {
      const asset = ANATOMY_FOUNDATION_SEED.mediaAssets.find((entry) => entry.slug === assetSlug)
      const links = ANATOMY_FOUNDATION_SEED.mediaEntityLinks.filter((link) => link.assetSlug === assetSlug)
      const citations = ANATOMY_FOUNDATION_SEED.citations.filter((citation) => citation.factSlug === assetSlug)
      const citationFactTypes = new Set(citations.map((citation) => citation.factType))

      assert.equal(asset?.mediaType, "image")
      assert.equal(asset?.sourceRef, "servier-medical-art")
      assert.equal(asset?.usageScope, "open_reuse")
      assert.equal(asset?.reviewStatus, "reviewed")
      assert.equal(asset?.license, "CC BY 4.0")
      assert.match(asset?.sourceUrl ?? "", /^https:\/\/smart\.servier\.com\/wp-content\/uploads\/.+\.png$/)
      assert.match(asset?.storagePath ?? "", /^anatomy\/servier\/2d\/.+\.png$/)
      assert.equal(asset?.metadata?.r2Upload, true)
      assert.equal(asset?.metadata?.visualStyle, "2d-medical-illustration")
      assert.equal(asset?.metadata?.ingestionStatus, "pending_r2_upload")
      assert.ok(links.some((link) => link.entityType === entityType && link.entitySlug === entitySlug))
      assert.ok(citationFactTypes.has("media_source"))
      assert.ok(citationFactTypes.has("media_license"))
      assert.ok(citations.every((citation) => citation.sourceRef === "servier-medical-art" && citation.reviewStatus === "reviewed"))
    }
  })

  it("tracks reviewed Servier 2D locomotor media with entity links and citations", () => {
    const expectedAssets = [
      ["servier-vertebral-column-2d-illustration", "region", "trunk-spine-pelvis"],
      ["servier-vertebra-2d-illustration", "bone", "c3-vertebra"],
      ["servier-rib-cage-2d-illustration", "joint", "thoracic-cage"],
      ["servier-skull-2d-illustration", "region", "head-face-jaw"],
      ["servier-tendon-anatomy-2d-illustration", "anatomy_concept", "musculoskeletal-system"],
      ["servier-normal-joint-2d-illustration", "anatomy_structure", "joint-capsule"],
      ["servier-elbow-anterior-2d-illustration", "joint", "elbow-joint"],
      ["servier-elbow-frontal-2d-illustration", "joint", "elbow-joint"],
      ["servier-elbow-lateral-2d-illustration", "joint", "elbow-joint"],
      ["servier-elbow-posterior-2d-illustration", "joint", "elbow-joint"],
      ["servier-knee-frontal-2d-illustration", "joint", "knee-joint"],
      ["servier-knee-parasagittal-2d-illustration", "joint", "knee-joint"],
      ["servier-knee-posterior-2d-illustration", "joint", "knee-joint"],
      ["servier-hand-2d-illustration", "region", "hand"],
      ["servier-foot-2d-illustration", "region", "foot"],
    ]

    for (const [assetSlug, entityType, entitySlug] of expectedAssets) {
      const asset = ANATOMY_FOUNDATION_SEED.mediaAssets.find((entry) => entry.slug === assetSlug)
      const links = ANATOMY_FOUNDATION_SEED.mediaEntityLinks.filter((link) => link.assetSlug === assetSlug)
      const citations = ANATOMY_FOUNDATION_SEED.citations.filter((citation) => citation.factSlug === assetSlug)
      const citationFactTypes = new Set(citations.map((citation) => citation.factType))

      assert.equal(asset?.mediaType, "image")
      assert.equal(asset?.sourceRef, "servier-medical-art")
      assert.equal(asset?.usageScope, "open_reuse")
      assert.equal(asset?.reviewStatus, "reviewed")
      assert.equal(asset?.license, "CC BY 4.0")
      assert.match(asset?.sourceUrl ?? "", /^https:\/\/smart\.servier\.com\/wp-content\/uploads\/.+\.png$/)
      assert.match(asset?.storagePath ?? "", /^anatomy\/servier\/2d\/.+\.png$/)
      assert.equal(asset?.metadata?.r2Upload, true)
      assert.equal(asset?.metadata?.visualStyle, "2d-medical-illustration")
      assert.equal(asset?.metadata?.ingestionStatus, "pending_r2_upload")
      assert.ok(links.some((link) => link.entityType === entityType && link.entitySlug === entitySlug && link.role === "primary"))
      assert.ok(citationFactTypes.has("media_source"))
      assert.ok(citationFactTypes.has("media_license"))
      assert.ok(citations.every((citation) => citation.sourceRef === "servier-medical-art" && citation.reviewStatus === "reviewed"))
    }
  })

  it("tracks reviewed Servier 2D body-atlas media with entity links and citations", () => {
    const expectedAssets = [
      ["servier-aorta-2d-illustration", "anatomy_concept", "cardiovascular-system"],
      ["servier-aorta-anatomical-diagram-2d-illustration", "anatomy_concept", "systemic-circulation"],
      ["servier-abdominal-aorta-2d-illustration", "blood_supply", "abdominal-aorta"],
      ["servier-pulmonary-circulation-2d-illustration", "anatomy_concept", "pulmonary-circulation"],
      ["servier-adult-cardiomyocytes-2d-illustration", "anatomy_structure", "heart"],
      ["servier-brain-arteries-2d-illustration", "anatomy_structure", "brain"],
      ["servier-brain-circulation-2d-illustration", "anatomy_structure", "brain"],
      ["servier-brain-sagittal-2d-illustration", "anatomy_structure", "brain"],
      ["servier-respiratory-conducting-zone-2d-illustration", "anatomy_concept", "respiratory-system"],
      ["servier-lung-lobes-2d-illustration", "anatomy_structure", "lung-lobe"],
      ["servier-lung-lobes-cross-section-2d-illustration", "anatomy_structure", "lung-lobe"],
      ["servier-larynx-front-view-2d-illustration", "anatomy_structure", "larynx"],
      ["servier-larynx-front-cut-2d-illustration", "anatomy_structure", "larynx"],
      ["servier-complete-digestive-apparatus-2d-illustration", "anatomy_concept", "digestive-system"],
      ["servier-adult-teeth-2d-illustration", "anatomy_structure", "tooth"],
      ["servier-colon-2d-illustration", "anatomy_structure", "large-intestine"],
      ["servier-duodenum-2d-illustration", "anatomy_structure", "small-intestine"],
      ["servier-bile-secretion-2d-illustration", "anatomy_concept", "bile"],
      ["servier-urinary-bladder-2d-illustration", "anatomy_structure", "urinary-bladder"],
      ["servier-urinary-tract-2d-illustration", "anatomy_concept", "urinary-system"],
      ["servier-nephron-overview-2d-illustration", "anatomy_structure", "nephron"],
      ["servier-kidney-overview-2d-illustration", "anatomy_structure", "kidney"],
      ["servier-thyroid-gland-2d-illustration", "anatomy_structure", "thyroid-gland"],
      ["servier-adrenal-gland-vessels-2d-illustration", "anatomy_structure", "adrenal-gland"],
      ["servier-adrenal-gland-section-2d-illustration", "anatomy_structure", "adrenal-gland"],
      ["servier-pancreas-overview-2d-illustration", "anatomy_structure", "pancreas"],
      ["servier-breast-sagittal-2d-illustration", "anatomy_structure", "mammary-gland"],
      ["servier-female-genital-apparatus-2d-illustration", "anatomy_concept", "reproductive-system"],
      ["servier-ovary-overview-2d-illustration", "anatomy_structure", "ovary"],
      ["servier-male-genital-apparatus-2d-illustration", "anatomy_concept", "reproductive-system"],
      ["servier-adult-human-body-2d-illustration", "region", "trunk-spine-pelvis"],
      ["servier-arm-bones-2d-illustration", "region", "upper-limb"],
      ["servier-bone-mass-2d-illustration", "anatomy_concept", "musculoskeletal-system"],
      ["servier-mouth-2d-illustration", "anatomy_structure", "oral-cavity"],
      ["servier-right-lung-lobes-2d-illustration", "anatomy_structure", "lung-lobe"],
      ["servier-left-lung-lobes-2d-illustration", "anatomy_structure", "lung-lobe"],
      ["servier-intrapulmonary-airways-2d-illustration", "anatomy_structure", "bronchus"],
      ["servier-intrapulmonary-airways-lungs-2d-illustration", "anatomy_structure", "lung"],
      ["servier-nephron-detail-2d-illustration", "anatomy_structure", "nephron"],
      ["servier-islet-of-langerhans-2d-illustration", "anatomy_structure", "pancreas"],
      ["servier-breast-overview-2d-illustration", "anatomy_structure", "mammary-gland"],
      ["servier-pancreas-coronal-2d-illustration", "anatomy_structure", "pancreas"],
      ["servier-ovary-cycle-2d-illustration", "anatomy_structure", "ovary"],
      ["servier-ovary-structure-2d-illustration", "anatomy_structure", "ovary"],
      ["servier-ovary-view-2d-illustration", "anatomy_structure", "ovary"],
      ["servier-kidney-with-adrenal-gland-2d-illustration", "anatomy_structure", "adrenal-gland"],
      ["servier-adrenal-gland-longitudinal-section-2d-illustration", "anatomy_structure", "adrenal-gland"],
      ["servier-adult-anatomical-diagram-2d-illustration", "region", "trunk-spine-pelvis"],
    ]

    for (const [assetSlug, entityType, entitySlug] of expectedAssets) {
      const asset = ANATOMY_FOUNDATION_SEED.mediaAssets.find((entry) => entry.slug === assetSlug)
      const links = ANATOMY_FOUNDATION_SEED.mediaEntityLinks.filter((link) => link.assetSlug === assetSlug)
      const citations = ANATOMY_FOUNDATION_SEED.citations.filter((citation) => citation.factSlug === assetSlug)
      const citationFactTypes = new Set(citations.map((citation) => citation.factType))

      assert.equal(asset?.mediaType, "image")
      assert.equal(asset?.sourceRef, "servier-medical-art")
      assert.equal(asset?.usageScope, "open_reuse")
      assert.equal(asset?.reviewStatus, "reviewed")
      assert.equal(asset?.license, "CC BY 4.0")
      assert.match(asset?.sourceUrl ?? "", /^https:\/\/smart\.servier\.com\/wp-content\/uploads\/.+\.png$/)
      assert.match(asset?.storagePath ?? "", /^anatomy\/servier\/2d\/.+\.png$/)
      assert.equal(asset?.metadata?.r2Upload, true)
      assert.equal(asset?.metadata?.visualStyle, "2d-medical-illustration")
      assert.equal(asset?.metadata?.ingestionStatus, "pending_r2_upload")
      assert.ok(links.some((link) => link.entityType === entityType && link.entitySlug === entitySlug && link.role === "primary"))
      assert.ok(citationFactTypes.has("media_source"))
      assert.ok(citationFactTypes.has("media_license"))
      assert.ok(citations.every((citation) => citation.sourceRef === "servier-medical-art" && citation.reviewStatus === "reviewed"))
    }
  })

  it("tracks reviewed Servier 2D organ-detail media with entity links and citations", () => {
    const expectedAssets = [
      ["servier-spleen-overview-2d-illustration", "anatomy_structure", "spleen"],
      ["servier-splenic-vein-and-artery-2d-illustration", "anatomy_structure", "spleen"],
      ["servier-thymus-2d-illustration", "anatomy_structure", "thymus"],
      ["servier-esophagus-cutaway-2d-illustration", "anatomy_structure", "esophagus"],
      ["servier-esophagus-overview-2d-illustration", "anatomy_structure", "esophagus"],
      ["servier-gallbladder-duodenum-2d-illustration", "anatomy_structure", "gallbladder"],
      ["servier-liver-and-gallbladder-2d-illustration", "anatomy_structure", "liver"],
      ["servier-liver-lobule-2d-illustration", "anatomy_structure", "liver"],
      ["servier-stomach-overview-2d-illustration", "anatomy_structure", "stomach"],
      ["servier-stomach-lymphatic-system-2d-illustration", "anatomy_structure", "stomach"],
      ["servier-intestine-segmentation-2d-illustration", "anatomy_structure", "small-intestine"],
      ["servier-rectum-2d-illustration", "anatomy_structure", "rectum"],
      ["servier-uterus-frontal-2d-illustration", "anatomy_structure", "uterus"],
      ["servier-uterus-lateral-2d-illustration", "anatomy_structure", "uterus"],
      ["servier-pituitary-gland-overview-2d-illustration", "anatomy_structure", "pituitary-gland"],
      ["servier-pituitary-gland-location-2d-illustration", "anatomy_structure", "pituitary-gland"],
      ["servier-thyroid-posterior-view-2d-illustration", "anatomy_structure", "thyroid-gland"],
      ["servier-skin-section-2d-illustration", "anatomy_structure", "skin"],
      ["servier-cochlea-2d-illustration", "anatomy_structure", "cochlea"],
      ["servier-retina-2d-illustration", "anatomy_structure", "retina"],
      ["servier-spinal-cord-lumbar-section-2d-illustration", "anatomy_structure", "spinal-cord"],
      ["servier-neuron-overview-2d-illustration", "anatomy_concept", "neuron"],
      ["servier-sciatic-nerve-2d-illustration", "nerve", "sciatic-nerve"],
      ["servier-nervous-system-overview-2d-illustration", "anatomy_concept", "nervous-system"],
      ["servier-pancreas-lymphatic-drainage-2d-illustration", "anatomy_structure", "pancreas"],
      ["servier-parotid-gland-2d-illustration", "anatomy_structure", "salivary-gland"],
      ["servier-sublingual-gland-2d-illustration", "anatomy_structure", "salivary-gland"],
      ["servier-submaxillary-gland-2d-illustration", "anatomy_structure", "salivary-gland"],
      ["servier-eye-iris-2d-illustration", "anatomy_structure", "iris"],
      ["servier-eye-cornea-2d-illustration", "anatomy_structure", "cornea"],
      ["servier-eye-lens-2d-illustration", "anatomy_structure", "lens"],
      ["servier-inner-ear-overview-2d-illustration", "anatomy_structure", "ear"],
      ["servier-eardrum-2d-illustration", "anatomy_structure", "tympanic-membrane"],
      ["servier-malleus-2d-illustration", "bone", "malleus"],
      ["servier-incus-2d-illustration", "bone", "incus"],
      ["servier-vestibulocochlear-nerve-2d-illustration", "nerve", "vestibulocochlear-nerve"],
      ["servier-peripheral-nerve-2d-illustration", "anatomy_structure", "peripheral-nerve"],
      ["servier-sympathetic-nervous-system-2d-illustration", "anatomy_concept", "sympathetic-division"],
      ["servier-testis-section-2d-illustration", "anatomy_structure", "testis"],
      ["servier-testis-overview-2d-illustration", "anatomy_structure", "testis"],
      ["servier-trachea-and-bronchi-2d-illustration", "anatomy_structure", "trachea"],
      ["servier-nasal-cavity-2d-illustration", "anatomy_structure", "nasal-cavity"],
    ]

    for (const [assetSlug, entityType, entitySlug] of expectedAssets) {
      const asset = ANATOMY_FOUNDATION_SEED.mediaAssets.find((entry) => entry.slug === assetSlug)
      const links = ANATOMY_FOUNDATION_SEED.mediaEntityLinks.filter((link) => link.assetSlug === assetSlug)
      const citations = ANATOMY_FOUNDATION_SEED.citations.filter((citation) => citation.factSlug === assetSlug)
      const citationFactTypes = new Set(citations.map((citation) => citation.factType))

      assert.equal(asset?.mediaType, "image")
      assert.equal(asset?.sourceRef, "servier-medical-art")
      assert.equal(asset?.usageScope, "open_reuse")
      assert.equal(asset?.reviewStatus, "reviewed")
      assert.equal(asset?.license, "CC BY 4.0")
      assert.match(asset?.sourceUrl ?? "", /^https:\/\/smart\.servier\.com\/wp-content\/uploads\/.+\.png$/)
      assert.match(asset?.storagePath ?? "", /^anatomy\/servier\/2d\/.+\.png$/)
      assert.equal(asset?.metadata?.r2Upload, true)
      assert.equal(asset?.metadata?.visualStyle, "2d-medical-illustration")
      assert.equal(asset?.metadata?.ingestionStatus, "pending_r2_upload")
      assert.ok(links.some((link) => link.entityType === entityType && link.entitySlug === entitySlug && link.role === "primary"))
      assert.ok(citationFactTypes.has("media_source"))
      assert.ok(citationFactTypes.has("media_license"))
      assert.ok(citations.every((citation) => citation.sourceRef === "servier-medical-art" && citation.reviewStatus === "reviewed"))
    }
  })

  it("tracks reviewed anatomy media coverage-gap batch with entity links and citations", () => {
    const bodyParts3dExpectedAssets = [
      ["bodyparts3d-biceps-brachii-anatomogram", "muscle", "biceps-brachii"],
      ["bodyparts3d-triceps-brachii-anatomogram", "muscle", "triceps-brachii"],
      ["bodyparts3d-deltoid-anatomogram", "muscle", "deltoid"],
      ["bodyparts3d-upper-trapezius-anatomogram", "muscle", "upper-trapezius"],
      ["bodyparts3d-middle-trapezius-anatomogram", "muscle", "middle-trapezius"],
      ["bodyparts3d-lower-trapezius-anatomogram", "muscle", "lower-trapezius"],
      ["bodyparts3d-sternocleidomastoid-anatomogram", "muscle", "sternocleidomastoid"],
      ["bodyparts3d-splenius-capitis-anatomogram", "muscle", "splenius-capitis"],
      ["bodyparts3d-splenius-cervicis-anatomogram", "muscle", "splenius-cervicis"],
      ["bodyparts3d-levator-scapulae-anatomogram", "muscle", "levator-scapulae"],
      ["bodyparts3d-rhomboid-major-anatomogram", "muscle", "rhomboid-major"],
      ["bodyparts3d-rhomboid-minor-anatomogram", "muscle", "rhomboid-minor"],
      ["bodyparts3d-supraspinatus-anatomogram", "muscle", "supraspinatus"],
      ["bodyparts3d-infraspinatus-anatomogram", "muscle", "infraspinatus"],
      ["bodyparts3d-subscapularis-anatomogram", "muscle", "subscapularis"],
      ["bodyparts3d-teres-major-anatomogram", "muscle", "teres-major"],
      ["bodyparts3d-teres-minor-anatomogram", "muscle", "teres-minor"],
      ["bodyparts3d-serratus-anterior-anatomogram", "muscle", "serratus-anterior"],
      ["bodyparts3d-pectoralis-minor-anatomogram", "muscle", "pectoralis-minor"],
      ["bodyparts3d-pectoralis-major-clavicular-head-anatomogram", "muscle", "pectoralis-major-clavicular-head"],
      ["bodyparts3d-pectoralis-major-sternocostal-head-anatomogram", "muscle", "pectoralis-major-sternocostal-head"],
      ["bodyparts3d-pectoralis-major-abdominal-head-anatomogram", "muscle", "pectoralis-major-abdominal-head"],
      ["bodyparts3d-brachialis-anatomogram", "muscle", "brachialis"],
      ["bodyparts3d-coracobrachialis-anatomogram", "muscle", "coracobrachialis"],
      ["bodyparts3d-gluteus-maximus-anatomogram", "muscle", "gluteus-maximus"],
      ["bodyparts3d-gluteus-medius-anatomogram", "muscle", "gluteus-medius"],
      ["bodyparts3d-gluteus-minimus-anatomogram", "muscle", "gluteus-minimus"],
      ["bodyparts3d-rectus-femoris-anatomogram", "muscle", "rectus-femoris"],
      ["bodyparts3d-vastus-lateralis-anatomogram", "muscle", "vastus-lateralis"],
      ["bodyparts3d-vastus-medialis-anatomogram", "muscle", "vastus-medialis"],
      ["bodyparts3d-vastus-intermedius-anatomogram", "muscle", "vastus-intermedius"],
      ["bodyparts3d-hamstrings-anatomogram", "muscle", "hamstrings"],
      ["bodyparts3d-semitendinosus-anatomogram", "muscle", "semitendinosus"],
      ["bodyparts3d-semimembranosus-anatomogram", "muscle", "semimembranosus"],
      ["bodyparts3d-biceps-femoris-anatomogram", "muscle", "biceps-femoris"],
      ["bodyparts3d-gastrocnemius-anatomogram", "muscle", "gastrocnemius"],
      ["bodyparts3d-soleus-anatomogram", "muscle", "soleus"],
      ["bodyparts3d-tibialis-anterior-anatomogram", "muscle", "tibialis-anterior"],
      ["bodyparts3d-fibularis-longus-anatomogram", "muscle", "fibularis-longus"],
      ["bodyparts3d-iliacus-anatomogram", "muscle", "iliacus"],
      ["bodyparts3d-psoas-major-anatomogram", "muscle", "psoas-major"],
      ["bodyparts3d-external-oblique-anatomogram", "muscle", "external-oblique"],
    ]
    const servierExpectedAssets = [
      ["servier-eye-muscles-2d-illustration", "joint", "ocular-functional-complex"],
      ["servier-paranasal-sinuses-2d-illustration", "anatomy_structure", "nasal-cavity"],
      ["servier-lymphatic-vessel-2d-illustration", "anatomy_structure", "lymphatic-vessel"],
      ["servier-healthy-bronchus-2d-illustration", "anatomy_structure", "bronchus"],
      ["servier-capillary-cross-section-2d-illustration", "anatomy_structure", "capillary"],
      ["servier-vein-cross-section-2d-illustration", "anatomy_structure", "vein"],
      ["servier-skeleton-cartilage-profile-2d-illustration", "anatomy_structure", "articular-cartilage"],
      ["servier-skeleton-cartilage-front-2d-illustration", "anatomy_structure", "articular-cartilage"],
    ]

    for (const [assetSlug, entityType, entitySlug] of bodyParts3dExpectedAssets) {
      const asset = ANATOMY_FOUNDATION_SEED.mediaAssets.find((entry) => entry.slug === assetSlug)
      const links = ANATOMY_FOUNDATION_SEED.mediaEntityLinks.filter((link) => link.assetSlug === assetSlug)
      const citations = ANATOMY_FOUNDATION_SEED.citations.filter((citation) => citation.factSlug === assetSlug)
      const citationFactTypes = new Set(citations.map((citation) => citation.factType))

      assert.equal(asset?.mediaType, "image")
      assert.equal(asset?.sourceRef, "bodyparts3d")
      assert.equal(asset?.usageScope, "open_reuse")
      assert.equal(asset?.reviewStatus, "reviewed")
      assert.equal(asset?.license, "CC BY 4.0")
      assert.match(asset?.sourceUrl ?? "", /^https:\/\/lifesciencedb\.jp\/bp3d\/API\/image\?%7B/)
      assert.match(asset?.storagePath ?? "", /^anatomy\/bodyparts3d\/anatomograms\/.+\.png$/)
      assert.equal(asset?.metadata?.r2Upload, true)
      assert.equal(asset?.metadata?.sourceKind, "bodyparts3d-anatomography-api-image")
      assert.equal(asset?.metadata?.visualStyle, "3d-anatomogram-render")
      assert.equal(asset?.metadata?.ingestionStatus, "pending_r2_upload")
      assert.ok(Array.isArray(asset?.metadata?.bodyparts3dPartIds))
      assert.ok(links.some((link) => link.entityType === entityType && link.entitySlug === entitySlug && link.role === "primary"))
      assert.ok(citationFactTypes.has("media_source"))
      assert.ok(citationFactTypes.has("media_license"))
      assert.ok(citations.every((citation) => citation.sourceRef === "bodyparts3d" && citation.reviewStatus === "reviewed"))
    }

    for (const [assetSlug, entityType, entitySlug] of servierExpectedAssets) {
      const asset = ANATOMY_FOUNDATION_SEED.mediaAssets.find((entry) => entry.slug === assetSlug)
      const links = ANATOMY_FOUNDATION_SEED.mediaEntityLinks.filter((link) => link.assetSlug === assetSlug)
      const citations = ANATOMY_FOUNDATION_SEED.citations.filter((citation) => citation.factSlug === assetSlug)
      const citationFactTypes = new Set(citations.map((citation) => citation.factType))

      assert.equal(asset?.mediaType, "image")
      assert.equal(asset?.sourceRef, "servier-medical-art")
      assert.equal(asset?.usageScope, "open_reuse")
      assert.equal(asset?.reviewStatus, "reviewed")
      assert.equal(asset?.license, "CC BY 4.0")
      assert.match(asset?.sourceUrl ?? "", /^https:\/\/smart\.servier\.com\/wp-content\/uploads\/.+\.png$/)
      assert.match(asset?.storagePath ?? "", /^anatomy\/servier\/2d\/.+\.png$/)
      assert.equal(asset?.metadata?.r2Upload, true)
      assert.equal(asset?.metadata?.sourceKind, "servier-2d-education-image")
      assert.equal(asset?.metadata?.visualStyle, "2d-medical-illustration")
      assert.equal(asset?.metadata?.ingestionStatus, "pending_r2_upload")
      assert.ok(links.some((link) => link.entityType === entityType && link.entitySlug === entitySlug && link.role === "primary"))
      assert.ok(citationFactTypes.has("media_source"))
      assert.ok(citationFactTypes.has("media_license"))
      assert.ok(citations.every((citation) => citation.sourceRef === "servier-medical-art" && citation.reviewStatus === "reviewed"))
    }
  })

  it("tracks the second BodyParts3D muscle anatomogram batch with entity links and citations", () => {
    const muscleSlugs = [
      "semispinalis-capitis",
      "subclavius",
      "levator-palpebrae-superioris",
      "transverse-arytenoid",
      "oblique-arytenoid",
      "vocalis",
      "stylopharyngeus",
      "salpingopharyngeus",
      "palatopharyngeus",
      "superior-pharyngeal-constrictor",
      "middle-pharyngeal-constrictor",
      "inferior-pharyngeal-constrictor",
      "tensor-veli-palatini",
      "levator-veli-palatini",
      "iliocostalis-cervicis",
      "iliocostalis-thoracis",
      "iliocostalis-lumborum",
      "longissimus-capitis",
      "longissimus-cervicis",
      "longissimus-thoracis",
      "spinalis-thoracis",
      "rectus-capitis-anterior",
      "rectus-capitis-lateralis",
      "semispinalis-cervicis",
      "semispinalis-thoracis",
      "anterior-scalene",
      "middle-scalene",
      "posterior-scalene",
      "rectus-capitis-posterior-major",
      "rectus-capitis-posterior-minor",
      "obliquus-capitis-superior",
      "obliquus-capitis-inferior",
      "diaphragm",
      "coccygeus",
      "serratus-posterior-superior",
      "serratus-posterior-inferior",
      "brachioradialis",
      "anconeus",
      "supinator",
      "flexor-carpi-radialis",
      "extensor-carpi-ulnaris",
      "flexor-digitorum-superficialis",
      "flexor-digitorum-profundus",
      "extensor-digitorum",
      "palmaris-longus",
      "pronator-quadratus",
      "flexor-pollicis-longus",
      "abductor-pollicis-longus",
      "extensor-pollicis-brevis",
      "extensor-pollicis-longus",
    ]

    for (const muscleSlug of muscleSlugs) {
      const assetSlug = `bodyparts3d-${muscleSlug}-anatomogram`
      const asset = ANATOMY_FOUNDATION_SEED.mediaAssets.find((entry) => entry.slug === assetSlug)
      const links = ANATOMY_FOUNDATION_SEED.mediaEntityLinks.filter((link) => link.assetSlug === assetSlug)
      const citations = ANATOMY_FOUNDATION_SEED.citations.filter((citation) => citation.factSlug === assetSlug)
      const citationFactTypes = new Set(citations.map((citation) => citation.factType))

      assert.equal(asset?.mediaType, "image")
      assert.equal(asset?.sourceRef, "bodyparts3d")
      assert.equal(asset?.usageScope, "open_reuse")
      assert.equal(asset?.reviewStatus, "reviewed")
      assert.equal(asset?.license, "CC BY 4.0")
      assert.match(asset?.sourceUrl ?? "", /^https:\/\/lifesciencedb\.jp\/bp3d\/API\/image\?%7B/)
      assert.match(asset?.storagePath ?? "", /^anatomy\/bodyparts3d\/anatomograms\/.+\.png$/)
      assert.equal(asset?.metadata?.r2Upload, true)
      assert.equal(asset?.metadata?.sourceKind, "bodyparts3d-anatomography-api-image")
      assert.equal(asset?.metadata?.visualStyle, "3d-anatomogram-render")
      assert.equal(asset?.metadata?.ingestionStatus, "pending_r2_upload")
      assert.ok(Array.isArray(asset?.metadata?.bodyparts3dPartIds))
      assert.ok(links.some((link) => link.entityType === "muscle" && link.entitySlug === muscleSlug && link.role === "primary"))
      assert.ok(citationFactTypes.has("media_source"))
      assert.ok(citationFactTypes.has("media_license"))
      assert.ok(citations.every((citation) => citation.sourceRef === "bodyparts3d" && citation.reviewStatus === "reviewed"))
    }
  })

  it("tracks BodyParts3D anterior, posterior, and lateral muscle view sets", () => {
    const viewSlugs = ["anterior", "posterior", "left-lateral", "right-lateral"]
    const sampleMuscleSlugs = [
      "biceps-brachii",
      "diaphragm",
      "superior-rectus",
      "pronator-teres",
      "adductor-pollicis",
      "cricothyroid",
      "longus-colli",
      "plantar-interosseous-foot-1",
      "thyrohyoid",
    ]
    const multiviewAssets = ANATOMY_FOUNDATION_SEED.mediaAssets.filter((asset) => (
      asset.sourceRef === "bodyparts3d"
      && /^bodyparts3d-.+-(anterior|posterior|left-lateral|right-lateral)-anatomogram$/.test(asset.slug)
      && /^anatomy\/bodyparts3d\/anatomograms\/muscles\/.+\/(anterior|posterior|left-lateral|right-lateral)\.png$/.test(asset.storagePath ?? "")
    ))
    const multiviewLinks = ANATOMY_FOUNDATION_SEED.mediaEntityLinks.filter((link) => (
      multiviewAssets.some((asset) => asset.slug === link.assetSlug)
      && link.entityType === "muscle"
      && link.role === "primary"
    ))
    const coveredMuscleSlugs = new Set(multiviewLinks.map((link) => link.entitySlug))

    assert.ok(multiviewAssets.length >= 650)
    assert.ok(coveredMuscleSlugs.size >= 160)

    for (const muscleSlug of sampleMuscleSlugs) {
      for (const viewSlug of viewSlugs) {
        const assetSlug = `bodyparts3d-${muscleSlug}-${viewSlug}-anatomogram`
        const asset = ANATOMY_FOUNDATION_SEED.mediaAssets.find((entry) => entry.slug === assetSlug)
        const links = ANATOMY_FOUNDATION_SEED.mediaEntityLinks.filter((link) => link.assetSlug === assetSlug)
        const citations = ANATOMY_FOUNDATION_SEED.citations.filter((citation) => citation.factSlug === assetSlug)
        const citationFactTypes = new Set(citations.map((citation) => citation.factType))

        assert.equal(asset?.mediaType, "image")
        assert.equal(asset?.sourceRef, "bodyparts3d")
        assert.equal(asset?.usageScope, "open_reuse")
        assert.equal(asset?.reviewStatus, "reviewed")
        assert.equal(asset?.license, "CC BY 4.0")
        assert.match(asset?.sourceUrl ?? "", /^https:\/\/lifesciencedb\.jp\/bp3d\/API\/image\?%7B/)
        assert.match(asset?.storagePath ?? "", new RegExp(`^anatomy/bodyparts3d/anatomograms/muscles/${muscleSlug}/${viewSlug}\\.png$`))
        assert.equal(asset?.metadata?.r2Upload, true)
        assert.equal(asset?.metadata?.sourceKind, "bodyparts3d-anatomography-api-image")
        assert.equal(asset?.metadata?.bodyparts3dView, viewSlug)
        assert.equal(asset?.metadata?.visualStyle, "3d-anatomogram-render")
        assert.equal(asset?.metadata?.ingestionStatus, "pending_r2_upload")
        assert.ok(Array.isArray(asset?.metadata?.bodyparts3dPartIds))
        assert.ok(links.some((link) => link.entityType === "muscle" && link.entitySlug === muscleSlug && link.role === "primary"))
        assert.ok(citationFactTypes.has("media_source"))
        assert.ok(citationFactTypes.has("media_license"))
        assert.ok(citations.every((citation) => citation.sourceRef === "bodyparts3d" && citation.reviewStatus === "reviewed"))
      }
    }
  })

  it("tracks BodyParts3D anterior, posterior, and lateral bone view sets", () => {
    const viewSlugs = ["anterior", "posterior", "left-lateral", "right-lateral"]
    const sampleBoneSlugs = [
      "scapula",
      "sternum",
      "cervical-vertebrae",
      "ribs",
      "carpals",
      "proximal-phalanx-hallux",
      "pelvis",
      "facial-bones",
    ]
    const multiviewAssets = ANATOMY_FOUNDATION_SEED.mediaAssets.filter((asset) => (
      asset.sourceRef === "bodyparts3d"
      && /^bodyparts3d-bone-.+-(anterior|posterior|left-lateral|right-lateral)-anatomogram$/.test(asset.slug)
      && /^anatomy\/bodyparts3d\/anatomograms\/bones\/.+\/(anterior|posterior|left-lateral|right-lateral)\.png$/.test(asset.storagePath ?? "")
    ))
    const multiviewLinks = ANATOMY_FOUNDATION_SEED.mediaEntityLinks.filter((link) => (
      multiviewAssets.some((asset) => asset.slug === link.assetSlug)
      && link.entityType === "bone"
      && link.role === "primary"
    ))
    const coveredBoneSlugs = new Set(multiviewLinks.map((link) => link.entitySlug))

    assert.ok(multiviewAssets.length >= 500)
    assert.ok(coveredBoneSlugs.size >= 120)

    for (const boneSlug of sampleBoneSlugs) {
      for (const viewSlug of viewSlugs) {
        const assetSlug = `bodyparts3d-bone-${boneSlug}-${viewSlug}-anatomogram`
        const asset = ANATOMY_FOUNDATION_SEED.mediaAssets.find((entry) => entry.slug === assetSlug)
        const links = ANATOMY_FOUNDATION_SEED.mediaEntityLinks.filter((link) => link.assetSlug === assetSlug)
        const citations = ANATOMY_FOUNDATION_SEED.citations.filter((citation) => citation.factSlug === assetSlug)
        const citationFactTypes = new Set(citations.map((citation) => citation.factType))

        assert.equal(asset?.mediaType, "image")
        assert.equal(asset?.sourceRef, "bodyparts3d")
        assert.equal(asset?.usageScope, "open_reuse")
        assert.equal(asset?.reviewStatus, "reviewed")
        assert.equal(asset?.license, "CC BY 4.0")
        assert.match(asset?.sourceUrl ?? "", /^https:\/\/lifesciencedb\.jp\/bp3d\/API\/image\?%7B/)
        assert.match(asset?.storagePath ?? "", new RegExp(`^anatomy/bodyparts3d/anatomograms/bones/${boneSlug}/${viewSlug}\\.png$`))
        assert.equal(asset?.metadata?.r2Upload, true)
        assert.equal(asset?.metadata?.sourceKind, "bodyparts3d-anatomography-api-image")
        assert.equal(asset?.metadata?.bodyparts3dView, viewSlug)
        assert.equal(asset?.metadata?.visualStyle, "3d-anatomogram-render")
        assert.equal(asset?.metadata?.ingestionStatus, "pending_r2_upload")
        assert.ok(Array.isArray(asset?.metadata?.bodyparts3dPartIds))
        assert.ok(links.some((link) => link.entityType === "bone" && link.entitySlug === boneSlug && link.role === "primary"))
        assert.ok(citationFactTypes.has("media_source"))
        assert.ok(citationFactTypes.has("media_license"))
        assert.ok(citations.every((citation) => citation.sourceRef === "bodyparts3d" && citation.reviewStatus === "reviewed"))
      }
    }
  })

  it("tracks BodyParts3D anterior, posterior, and lateral blood-supply view sets", () => {
    const viewSlugs = ["anterior", "posterior", "left-lateral", "right-lateral"]
    const sampleBloodSupplySlugs = [
      "subclavian-artery",
      "axillary-artery",
      "common-carotid-artery",
      "abdominal-aorta",
      "femoral-artery",
      "great-saphenous-vein",
      "dorsalis-pedis-artery",
      "gastroduodenal-artery",
    ]
    const multiviewAssets = ANATOMY_FOUNDATION_SEED.mediaAssets.filter((asset) => (
      asset.sourceRef === "bodyparts3d"
      && /^bodyparts3d-blood-supply-.+-(anterior|posterior|left-lateral|right-lateral)-anatomogram$/.test(asset.slug)
      && /^anatomy\/bodyparts3d\/anatomograms\/blood-supply\/.+\/(anterior|posterior|left-lateral|right-lateral)\.png$/.test(asset.storagePath ?? "")
    ))
    const multiviewLinks = ANATOMY_FOUNDATION_SEED.mediaEntityLinks.filter((link) => (
      multiviewAssets.some((asset) => asset.slug === link.assetSlug)
      && link.entityType === "blood_supply"
      && link.role === "primary"
    ))
    const coveredBloodSupplySlugs = new Set(multiviewLinks.map((link) => link.entitySlug))

    assert.ok(multiviewAssets.length >= 220)
    assert.ok(coveredBloodSupplySlugs.size >= 55)

    for (const bloodSupplySlug of sampleBloodSupplySlugs) {
      for (const viewSlug of viewSlugs) {
        const assetSlug = `bodyparts3d-blood-supply-${bloodSupplySlug}-${viewSlug}-anatomogram`
        const asset = ANATOMY_FOUNDATION_SEED.mediaAssets.find((entry) => entry.slug === assetSlug)
        const links = ANATOMY_FOUNDATION_SEED.mediaEntityLinks.filter((link) => link.assetSlug === assetSlug)
        const citations = ANATOMY_FOUNDATION_SEED.citations.filter((citation) => citation.factSlug === assetSlug)
        const citationFactTypes = new Set(citations.map((citation) => citation.factType))

        assert.equal(asset?.mediaType, "image")
        assert.equal(asset?.sourceRef, "bodyparts3d")
        assert.equal(asset?.usageScope, "open_reuse")
        assert.equal(asset?.reviewStatus, "reviewed")
        assert.equal(asset?.license, "CC BY 4.0")
        assert.match(asset?.sourceUrl ?? "", /^https:\/\/lifesciencedb\.jp\/bp3d\/API\/image\?%7B/)
        assert.match(asset?.storagePath ?? "", new RegExp(`^anatomy/bodyparts3d/anatomograms/blood-supply/${bloodSupplySlug}/${viewSlug}\\.png$`))
        assert.equal(asset?.metadata?.r2Upload, true)
        assert.equal(asset?.metadata?.sourceKind, "bodyparts3d-anatomography-api-image")
        assert.equal(asset?.metadata?.bodyparts3dView, viewSlug)
        assert.equal(asset?.metadata?.visualStyle, "3d-anatomogram-render")
        assert.equal(asset?.metadata?.ingestionStatus, "pending_r2_upload")
        assert.ok(Array.isArray(asset?.metadata?.bodyparts3dPartIds))
        assert.ok(links.some((link) => link.entityType === "blood_supply" && link.entitySlug === bloodSupplySlug && link.role === "primary"))
        assert.ok(citationFactTypes.has("media_source"))
        assert.ok(citationFactTypes.has("media_license"))
        assert.ok(citations.every((citation) => citation.sourceRef === "bodyparts3d" && citation.reviewStatus === "reviewed"))
      }
    }
  })

  it("fills remaining anatomy media gaps with explicit BodyParts3D fallback context", () => {
    const coverageTargets = [
      ["region", [...ANATOMY_FOUNDATION_SEED.bodyRegions, ...ANATOMY_FOUNDATION_SEED.bodySubregions]],
      ["bone", ANATOMY_FOUNDATION_SEED.bones],
      ["joint", ANATOMY_FOUNDATION_SEED.joints],
      ["muscle", ANATOMY_FOUNDATION_SEED.muscles],
      ["nerve", ANATOMY_FOUNDATION_SEED.nerves],
      ["ligament", ANATOMY_FOUNDATION_SEED.ligaments],
      ["blood_supply", ANATOMY_FOUNDATION_SEED.bloodSupply],
      ["anatomy_structure", ANATOMY_FOUNDATION_SEED.structures],
      ["pain_map_region", ANATOMY_FOUNDATION_SEED.painMapRegions],
    ]
    const fallbackAssets = ANATOMY_FOUNDATION_SEED.mediaAssets.filter((asset) => asset.slug.startsWith("bodyparts3d-fallback-"))

    assert.ok(fallbackAssets.length >= 300)
    assert.ok(fallbackAssets.every((asset) => asset.sourceRef === "bodyparts3d"))
    assert.ok(fallbackAssets.every((asset) => asset.usageScope === "open_reuse" && asset.reviewStatus === "reviewed"))
    assert.ok(fallbackAssets.every((asset) => asset.license === "CC BY 4.0" && asset.licenseUrl === "https://creativecommons.org/licenses/by/4.0/"))
    assert.ok(fallbackAssets.every((asset) => asset.metadata?.sourceKind === "bodyparts3d-anatomography-api-image"))
    assert.ok(fallbackAssets.every((asset) => ["exact", "composite", "broad_context"].includes(asset.metadata?.mappingPrecision)))

    for (const [entityType, rows] of coverageTargets) {
      const missing = rows
        .filter((row) => !ANATOMY_FOUNDATION_SEED.mediaEntityLinks.some((link) => link.entityType === entityType && link.entitySlug === row.slug))
        .map((row) => row.slug)

      assert.deepEqual(missing, [], `${entityType} rows without any media`)
    }

    const expectedFallbackLinks = [
      ["muscle", "latissimus-dorsi", "reference", "broad_context"],
      ["muscle", "deltoid-anterior-fibers", "primary", "exact"],
      ["bone", "stapes", "reference", "broad_context"],
      ["nerve", "optic-nerve", "primary", "exact"],
      ["ligament", "long-plantar-ligament", "primary", "exact"],
      ["pain_map_region", "base-of-skull", "region_context", "broad_context"],
    ]

    for (const [entityType, entitySlug, role, mappingPrecision] of expectedFallbackLinks) {
      const links = ANATOMY_FOUNDATION_SEED.mediaEntityLinks.filter((link) => (
        link.entityType === entityType
        && link.entitySlug === entitySlug
        && link.role === role
        && link.assetSlug.startsWith("bodyparts3d-fallback-")
      ))

      assert.equal(links.length, 4, `${entitySlug} should have four fallback BodyParts3D views`)
      for (const link of links) {
        const asset = ANATOMY_FOUNDATION_SEED.mediaAssets.find((entry) => entry.slug === link.assetSlug)
        const citations = ANATOMY_FOUNDATION_SEED.citations.filter((citation) => citation.factSlug === link.assetSlug)
        const citationFactTypes = new Set(citations.map((citation) => citation.factType))

        assert.equal(asset?.metadata?.mappingPrecision, mappingPrecision)
        assert.match(asset?.storagePath ?? "", /^anatomy\/bodyparts3d\/anatomograms\/fallback\/.+\/(anterior|posterior|left-lateral|right-lateral)\.png$/)
        assert.ok(citationFactTypes.has("media_source"))
        assert.ok(citationFactTypes.has("media_license"))
      }
    }
  })

  it("adds BodyParts3D part-list upgrades and animated GIF coverage", () => {
    const gifAssets = ANATOMY_FOUNDATION_SEED.mediaAssets.filter((asset) => (
      asset.sourceRef === "bodyparts3d"
      && asset.format === "gif"
      && asset.metadata?.sourceKind === "bodyparts3d-anatomography-api-animation"
    ))
    const partListUpgradeAssets = ANATOMY_FOUNDATION_SEED.mediaAssets.filter((asset) => asset.metadata?.partListUpgrade === true)
    const expectedPartListEntities = [
      ["anatomy_structure", "hair"],
      ["anatomy_structure", "ureter"],
      ["anatomy_structure", "urethra"],
      ["anatomy_structure", "cerebellum"],
      ["anatomy_structure", "sclera"],
      ["region", "forearm"],
      ["region", "wrist"],
      ["region", "hip"],
      ["region", "thigh"],
      ["region", "knee"],
      ["region", "leg"],
      ["pain_map_region", "abdomen"],
    ]

    assert.ok(gifAssets.length >= 900)
    assert.ok(gifAssets.every((asset) => asset.usageScope === "open_reuse" && asset.reviewStatus === "reviewed"))
    assert.ok(gifAssets.every((asset) => asset.license === "CC BY 4.0" && asset.licenseUrl === "https://creativecommons.org/licenses/by/4.0/"))
    assert.ok(gifAssets.every((asset) => /^anatomy\/bodyparts3d\/anatomograms\/.+\.gif$/.test(asset.storagePath ?? "")))
    assert.ok(gifAssets.every((asset) => Array.isArray(asset.metadata?.bodyparts3dPartIds)))
    assert.ok(partListUpgradeAssets.length >= 80)

    for (const [entityType, entitySlug] of expectedPartListEntities) {
      const stillLinks = ANATOMY_FOUNDATION_SEED.mediaEntityLinks.filter((link) => (
        link.entityType === entityType
        && link.entitySlug === entitySlug
        && link.assetSlug.startsWith(`bodyparts3d-partlist-${entityType}-${entitySlug}-`)
        && !link.assetSlug.endsWith("-animated-anatomogram")
      ))
      const gifLink = ANATOMY_FOUNDATION_SEED.mediaEntityLinks.find((link) => (
        link.entityType === entityType
        && link.entitySlug === entitySlug
        && link.assetSlug === `bodyparts3d-${entityType}-${entitySlug}-animated-anatomogram`
      ))

      assert.equal(stillLinks.length, 4, `${entityType}:${entitySlug} should have four BodyParts3D part-list still views`)
      assert.ok(gifLink, `${entityType}:${entitySlug} should have generated BodyParts3D animated GIF coverage`)

      for (const link of [...stillLinks, gifLink]) {
        const asset = ANATOMY_FOUNDATION_SEED.mediaAssets.find((entry) => entry.slug === link?.assetSlug)
        const citationFactTypes = new Set(
          ANATOMY_FOUNDATION_SEED.citations
            .filter((citation) => citation.factSlug === link?.assetSlug)
            .map((citation) => citation.factType),
        )

        assert.ok(asset)
        assert.equal(asset.sourceRef, "bodyparts3d")
        assert.ok(citationFactTypes.has("media_source"))
        assert.ok(citationFactTypes.has("media_license"))
      }
    }
  })

  it("tracks BodyParts3D-derived 3D source candidates as review-only media", () => {
    const sourceBySlug = new Map(ANATOMY_FOUNDATION_SEED.sources.map((source) => [source.slug, source]))
    const candidateAssets = [
      "bodyparts3d-stl-github-mirror-source-link",
      "wikimedia-bodyparts3d-stl-category-source-link",
    ].map((slug) => ANATOMY_FOUNDATION_SEED.mediaAssets.find((asset) => asset.slug === slug))

    assert.equal(sourceBySlug.get("bodyparts3d-stl-github-mirror")?.usageScope, "review_only")
    assert.match(sourceBySlug.get("bodyparts3d-stl-github-mirror")?.license ?? "", /CC BY-SA 2\.1 Japan/)
    assert.equal(sourceBySlug.get("wikimedia-bodyparts3d-stl-category")?.usageScope, "review_only")
    assert.match(sourceBySlug.get("wikimedia-bodyparts3d-stl-category")?.notes ?? "", /per-file/i)

    for (const asset of candidateAssets) {
      assert.ok(asset)
      assert.equal(asset.mediaType, "source_link")
      assert.equal(asset.usageScope, "review_only")
      assert.equal(asset.reviewStatus, "needs_review")
      assert.equal(asset.metadata?.candidateFor, "future_3d_asset_pipeline")
      assert.ok(
        ANATOMY_FOUNDATION_SEED.mediaEntityLinks.some((link) => (
          link.assetSlug === asset.slug
          && link.entityType === "region"
          && link.entitySlug === "body-surface"
        )),
      )
    }
  })

  it("prepares 3D body-map spatial mappings and ROM visualization anchors", () => {
    const sourceBySlug = new Map(ANATOMY_FOUNDATION_SEED.sources.map((source) => [source.slug, source]))
    const model = ANATOMY_FOUNDATION_SEED.spatialModels.find((entry) => entry.slug === "massagelab-human-bodymap-v1")
    const modelAsset = ANATOMY_FOUNDATION_SEED.mediaAssets.find((asset) => asset.slug === "bodyparts3d-runtime-human-glb-candidate")
    const bicepsMap = ANATOMY_FOUNDATION_SEED.spatialEntityMaps.find((entry) => entry.entityType === "muscle" && entry.entitySlug === "biceps-brachii")
    const topShoulderMap = ANATOMY_FOUNDATION_SEED.spatialEntityMaps.find((entry) => entry.entityType === "pain_map_region" && entry.entitySlug === "top-of-shoulder")
    const shoulderAbduction = ANATOMY_FOUNDATION_SEED.movementVisualizations.find((entry) => entry.slug === "massagelab-human-bodymap-v1-shoulder-abduction")

    assert.equal(sourceBySlug.get("massagelab-authored-3d-body-map-protocol")?.usageScope, "commercial_licensed")
    assert.ok(model)
    assert.equal(model.mediaAssetSlug, "bodyparts3d-runtime-human-glb-candidate")
    assert.equal(model.coordinateSystem, "right-handed-y-up")
    assert.equal(model.reviewStatus, "needs_review")
    assert.equal(modelAsset?.mediaType, "model_3d")
    assert.equal(modelAsset?.usageScope, "review_only")
    assert.equal(modelAsset?.metadata?.targetRuntimeFormat, "glb")
    assert.equal(bicepsMap?.mappingPrecision, "exact")
    assert.ok(bicepsMap?.bodyparts3dPartIds?.includes("FMA37682"))
    assert.equal(bicepsMap?.palpationTarget, true)
    assert.equal(topShoulderMap?.painSelectionTarget, true)
    assert.equal(topShoulderMap?.surface, "superior")
    assert.equal(shoulderAbduction?.joint, "glenohumeral")
    assert.equal(shoulderAbduction?.movement, "shoulder-abduction")
    assert.equal(shoulderAbduction?.rangeOfMotion, "shoulder-abduction")
    assert.ok(
      ANATOMY_FOUNDATION_SEED.citations.some((citation) => (
        citation.factType === "spatial_model_protocol"
        && citation.factSlug === "massagelab-human-bodymap-v1"
      )),
    )
  })

  it("classifies anatomy sources by commercial-safe reuse policy", () => {
    const sourceBySlug = new Map(ANATOMY_FOUNDATION_SEED.sources.map((source) => [source.slug, source]))

    assert.equal(sourceBySlug.get("fipat-ta2")?.usageScope, "open_reuse")
    assert.match(sourceBySlug.get("fipat-ta2")?.notes ?? "", /individual terms.*public domain/i)
    assert.equal(sourceBySlug.get("nci-thesaurus")?.license, "CC BY 4.0")
    assert.equal(sourceBySlug.get("human-bio-media")?.usageScope, "open_reuse")
    assert.equal(sourceBySlug.get("servier-medical-art")?.license, "CC BY 4.0")
    assert.equal(sourceBySlug.get("servier-medical-art")?.usageScope, "open_reuse")
    assert.equal(sourceBySlug.get("massagelab-authored-3d-body-map-protocol")?.usageScope, "commercial_licensed")
    assert.equal(sourceBySlug.get("bodyparts3d-stl-github-mirror")?.usageScope, "review_only")
    assert.equal(sourceBySlug.get("wikimedia-bodyparts3d-stl-category")?.usageScope, "review_only")
    assert.equal(sourceBySlug.get("ols-uberon")?.license, "CC BY 3.0")
    assert.equal(sourceBySlug.get("openstax-ap-2e")?.usageScope, "internal_reference")
    assert.match(sourceBySlug.get("statpearls-ncbi-bookshelf")?.license ?? "", /NC-ND/)
    assert.equal(sourceBySlug.get("statpearls-ncbi-bookshelf")?.usageScope, "internal_reference")
    assert.equal(sourceBySlug.get("snomed-ct")?.usageScope, "review_only")
    assert.equal(sourceBySlug.get("umls")?.usageScope, "review_only")
  })

  it("matures initial starter region and search terminology metadata into commercial-licensed MassageLab taxonomy", () => {
    const sourceBySlug = new Map(ANATOMY_FOUNDATION_SEED.sources.map((source) => [source.slug, source]))
    const remainingStarterSourceRefs = [
      ...ANATOMY_FOUNDATION_SEED.bodyRegions
        .filter((region) => region.sourceRefs.includes("massagelab-initial-anatomy-foundation"))
        .map((region) => `region:${region.slug}`),
      ...ANATOMY_FOUNDATION_SEED.bodySubregions
        .filter((region) => region.sourceRefs.includes("massagelab-initial-anatomy-foundation"))
        .map((region) => `subregion:${region.slug}`),
      ...ANATOMY_FOUNDATION_SEED.entityTerms
        .filter((term) => term.sourceRef === "massagelab-initial-anatomy-foundation")
        .map((term) => `entity_term:${term.id}`),
    ]
    const reviewedClientTaxonomySourceReferences = ANATOMY_FOUNDATION_SEED.citations
      .filter((citation) => (
        citation.factType === "seed_source_reference"
        && citation.sourceRef === "massagelab-authored-client-language"
        && citation.reviewStatus === "reviewed"
        && /starter/i.test(citation.citationNote ?? "")
      ))

    assert.deepEqual(remainingStarterSourceRefs, [])
    assert.equal(getAnatomyCitationCoverage().starterCitationCount, 0)
    assert.equal(sourceBySlug.get("massagelab-authored-client-language")?.usageScope, "commercial_licensed")
    assert.match(sourceBySlug.get("massagelab-authored-client-language")?.notes ?? "", /search terminology/i)
    assert.ok(reviewedClientTaxonomySourceReferences.length >= 229)
  })

  it("replaces future clinical placeholder source refs for joints, movements, ROM, and remaining terminology", () => {
    const remainingFutureClinicalRefs = [
      ...ANATOMY_FOUNDATION_SEED.joints
        .filter((joint) => joint.sourceRef === "future-clinical-citation-needed")
        .map((joint) => `joint:${joint.slug}`),
      ...ANATOMY_FOUNDATION_SEED.jointMovements
        .filter((movement) => movement.sourceRef === "future-clinical-citation-needed")
        .map((movement) => `joint_movement:${movement.slug}`),
      ...ANATOMY_FOUNDATION_SEED.rangesOfMotion
        .filter((range) => range.sourceRef === "future-clinical-citation-needed")
        .map((range) => `range_of_motion:${range.slug}`),
      ...ANATOMY_FOUNDATION_SEED.entityTerms
        .filter((term) => term.sourceRef === "future-clinical-citation-needed")
        .map((term) => `entity_term:${term.id}`),
    ]
    const obsoleteFuturePlaceholderCitations = ANATOMY_FOUNDATION_SEED.citations
      .filter((citation) => citation.sourceRef === "future-clinical-citation-needed")
      .filter((citation) => citation.reviewStatus === "needs_review")
      .map((citation) => citation.slug)
    const reviewedJointSourceRefs = ANATOMY_FOUNDATION_SEED.citations.filter((citation) => (
      citation.factType === "seed_source_reference"
      && citation.sourceRef === "applied-human-anatomy"
      && citation.reviewStatus === "reviewed"
      && /future clinical placeholder/i.test(citation.citationNote ?? "")
      && ["joint", "joint_movement"].includes(citation.entityType)
    ))
    const reviewedRomSourceRefs = ANATOMY_FOUNDATION_SEED.citations.filter((citation) => (
      citation.factType === "seed_source_reference"
      && citation.sourceRef === "cdc-normal-joint-rom"
      && citation.reviewStatus === "reviewed"
      && /future clinical placeholder/i.test(citation.citationNote ?? "")
      && citation.entityType === "range_of_motion"
    ))

    assert.deepEqual(remainingFutureClinicalRefs, [])
    assert.deepEqual(obsoleteFuturePlaceholderCitations, [])
    assert.ok(reviewedJointSourceRefs.length >= 57)
    assert.ok(reviewedRomSourceRefs.length >= 20)
  })

  it("rejects reviewed display and education citations from restricted sources", () => {
    const seed = structuredClone(ANATOMY_FOUNDATION_SEED)
    seed.citations.push(
      {
        id: "citation-bad-openstax-summary",
        slug: "bad-openstax-summary",
        entityType: "muscle",
        entitySlug: "biceps-brachii",
        factType: "clinical_summary",
        sourceRef: "openstax-ap-2e",
        reviewStatus: "reviewed",
      },
      {
        id: "citation-bad-fipat-summary",
        slug: "bad-fipat-summary",
        entityType: "muscle",
        entitySlug: "biceps-brachii",
        factType: "clinical_summary",
        sourceRef: "fipat-ta2",
        reviewStatus: "reviewed",
      },
    )
    seed.mediaAssets.push({
      id: "media-bad-openstax",
      slug: "bad-openstax-media",
      title: "Bad OpenStax Media",
      mediaType: "image",
      sourceRef: "openstax-ap-2e",
      sourceUrl: "https://openstax.org/books/anatomy-and-physiology-2e/pages/preface",
      license: "CC BY-NC-SA 4.0",
      licenseUrl: "https://creativecommons.org/licenses/by-nc-sa/4.0/",
      attribution: "OpenStax reference-only asset.",
      usageScope: "open_reuse",
      reviewStatus: "reviewed",
    })

    const issues = validateAnatomyFoundation(seed)

    assert.ok(issues.some((issue) => issue.includes("Reviewed clinical_summary citation bad-openstax-summary requires an open reuse or commercial licensed source")))
    assert.ok(issues.some((issue) => issue.includes("Source fipat-ta2 is terminology-only and cannot support reviewed clinical_summary citation bad-fipat-summary")))
    assert.ok(issues.some((issue) => issue.includes("Open media asset media-bad-openstax requires an open reuse or commercial licensed source")))
  })

  it("keeps OLS as ontology metadata while using commercial-safe Biceps Brachii display facts", () => {
    const biceps = ANATOMY_FOUNDATION_SEED.muscles.find((muscle) => muscle.slug === "biceps-brachii")
    const bicepsTerms = ANATOMY_FOUNDATION_SEED.entityTerms
      .filter((term) => term.anatomyEntityType === "muscle" && term.anatomyEntitySlug === "biceps-brachii")
    const bicepsTermLabels = bicepsTerms.map((term) => term.term)
    const bicepsCitations = ANATOMY_FOUNDATION_SEED.citations.filter((citation) => citation.entitySlug === "biceps-brachii")
    const bicepsAttachments = ANATOMY_FOUNDATION_SEED.muscleAttachments.filter((attachment) => attachment.muscle === "biceps-brachii")
    const bicepsActions = ANATOMY_FOUNDATION_SEED.muscleActions.filter((action) => action.muscle === "biceps-brachii")
    const bicepsInnervation = ANATOMY_FOUNDATION_SEED.muscleInnervations.find((innervation) => innervation.muscle === "biceps-brachii")
    const brachialArtery = ANATOMY_FOUNDATION_SEED.bloodSupply.find((bloodSupply) => bloodSupply.slug === "brachial-artery")

    assert.equal(biceps?.sourceRef, "human-bio-media")
    assert.match(biceps?.description ?? "", /superficial anterior arm muscle/)
    assert.match(biceps?.description ?? "", /supinates the forearm/)
    assert.doesNotMatch(biceps?.description ?? "", /forelimb stylopod/)
    assert.ok(bicepsTermLabels.includes("biceps brachii muscle"))
    assert.ok(bicepsTermLabels.includes("biceps cubiti"))
    assert.ok(bicepsTermLabels.includes("musculus biceps brachii"))
    assert.ok(bicepsTerms.some((term) => term.term === "Biceps brachii" && term.termType === "preferred" && term.sourceRef === "fipat-ta2"))
    assert.ok(bicepsTerms.some((term) => term.term === "biceps brachii muscle" && term.sourceRef === "nci-thesaurus"))
    assert.ok(bicepsCitations.some((citation) => citation.factType === "ontology_definition" && citation.reviewStatus === "reviewed"))
    assert.ok(bicepsCitations.some((citation) => citation.factType === "ontology_synonyms" && citation.reviewStatus === "reviewed"))
    assert.ok(bicepsCitations.some((citation) => citation.factType === "official_term" && citation.sourceRef === "fipat-ta2" && citation.reviewStatus === "reviewed"))
    assert.ok(bicepsCitations.some((citation) => citation.factType === "clinical_summary" && citation.sourceRef === "human-bio-media" && citation.reviewStatus === "reviewed"))
    assert.ok(bicepsAttachments.every((attachment) => attachment.sourceRef === "human-bio-media"))
    assert.ok(bicepsActions.every((action) => action.sourceRef === "human-bio-media"))
    assert.equal(bicepsInnervation?.sourceRef, "human-bio-media")
    assert.equal(brachialArtery?.sourceRef, "human-bio-media")
    assert.ok(bicepsCitations.some((citation) => citation.factType === "origin" && citation.sourceRef === "human-bio-media" && citation.reviewStatus === "reviewed"))
    assert.ok(bicepsCitations.some((citation) => citation.factType === "insertion" && citation.sourceRef === "human-bio-media" && citation.reviewStatus === "reviewed"))
    assert.ok(bicepsCitations.some((citation) => citation.factType === "action" && citation.sourceRef === "human-bio-media" && citation.reviewStatus === "reviewed"))
    assert.ok(bicepsCitations.some((citation) => citation.factType === "innervation" && citation.sourceRef === "human-bio-media" && citation.reviewStatus === "reviewed"))
    assert.ok(bicepsCitations.some((citation) => citation.factType === "blood_supply" && citation.sourceRef === "human-bio-media" && citation.reviewStatus === "reviewed"))
  })

  it("replaces legacy BioPortal FMA source refs with commercial-safe terminology anchors", () => {
    assert.equal(ANATOMY_FOUNDATION_SEED.sources.some((source) => source.slug === "bioportal-fma"), false)

    const bioportalIdentifiers = ANATOMY_FOUNDATION_SEED.externalIdentifiers.filter((identifier) => identifier.sourceRef === "bioportal-fma")
    const bioportalCitations = ANATOMY_FOUNDATION_SEED.citations.filter((citation) => citation.sourceRef === "bioportal-fma")
    const coverage = getAnatomyCitationCoverage()

    assert.deepEqual(bioportalIdentifiers, [])
    assert.deepEqual(bioportalCitations, [])
    assert.equal(coverage.needsReviewCitationCount, 29)

    for (const [entityType, entitySlug] of [
      ["bone", "scapula"],
      ["muscle", "rhomboid-major"],
      ["anatomy_structure", "thoracolumbar-fascia"],
      ["ligament", "alar-ligament"],
      ["joint", "temporomandibular-joint"],
    ]) {
      const identifier = ANATOMY_FOUNDATION_SEED.externalIdentifiers.find((entry) =>
        entry.entityType === entityType &&
        entry.entitySlug === entitySlug &&
        entry.provider === "FIPAT" &&
        entry.sourceRef === "fipat-ta2")
      const citation = ANATOMY_FOUNDATION_SEED.citations.find((entry) =>
        entry.entityType === entityType &&
        entry.entitySlug === entitySlug &&
        entry.factType === "external_identifier" &&
        entry.sourceRef === "fipat-ta2" &&
        entry.reviewStatus === "reviewed")

      assert.ok(identifier, `${entityType}:${entitySlug} should have a FIPAT identifier after BioPortal cleanup`)
      assert.ok(citation, `${entityType}:${entitySlug} should have a reviewed FIPAT external identifier citation`)
    }
  })

  it("extends the commercial-safe reviewed pattern across the first upper-limb muscle batch", () => {
    const sourceBySlug = new Map(ANATOMY_FOUNDATION_SEED.sources.map((source) => [source.slug, source]))
    const reviewedUpperLimbMuscles = [
      "biceps-brachii",
      "brachialis",
      "triceps-brachii",
      "brachioradialis",
      "pronator-teres",
      "supinator",
    ]
    const requiredFactTypes = ["clinical_summary", "origin", "insertion", "action", "innervation"]

    assert.equal(sourceBySlug.get("applied-human-anatomy")?.license, "CC BY 4.0")
    assert.equal(sourceBySlug.get("applied-human-anatomy")?.usageScope, "open_reuse")

    for (const muscleSlug of reviewedUpperLimbMuscles) {
      const muscle = ANATOMY_FOUNDATION_SEED.muscles.find((entry) => entry.slug === muscleSlug)
      const source = muscle ? sourceBySlug.get(muscle.sourceRef) : undefined
      const citations = ANATOMY_FOUNDATION_SEED.citations.filter((citation) => citation.entityType === "muscle" && citation.entitySlug === muscleSlug && citation.reviewStatus === "reviewed")
      const citationFactTypes = new Set(citations.map((citation) => citation.factType))
      const terms = ANATOMY_FOUNDATION_SEED.entityTerms.filter((term) => term.anatomyEntityType === "muscle" && term.anatomyEntitySlug === muscleSlug)
      const identifiers = ANATOMY_FOUNDATION_SEED.externalIdentifiers.filter((identifier) => identifier.entityType === "muscle" && identifier.entitySlug === muscleSlug)
      const attachments = ANATOMY_FOUNDATION_SEED.muscleAttachments.filter((attachment) => attachment.muscle === muscleSlug)
      const actions = ANATOMY_FOUNDATION_SEED.muscleActions.filter((action) => action.muscle === muscleSlug)
      const innervation = ANATOMY_FOUNDATION_SEED.muscleInnervations.filter((entry) => entry.muscle === muscleSlug)

      assert.equal(source?.usageScope, "open_reuse", `${muscleSlug} must use an open-reuse reviewed source`)
      assert.ok((muscle?.description ?? "").length > 80, `${muscleSlug} needs a MassageLab-authored display summary`)
      assert.ok(terms.some((term) => ["preferred", "formal"].includes(term.termType) && term.sourceRef === "fipat-ta2"), `${muscleSlug} needs FIPAT-backed terminology`)
      assert.ok(identifiers.some((identifier) => ["UBERON", "NCIT"].includes(identifier.provider)), `${muscleSlug} needs an ontology identifier`)
      assert.ok(attachments.length >= 2, `${muscleSlug} needs origin and insertion facts`)
      assert.ok(attachments.every((attachment) => sourceBySlug.get(attachment.sourceRef)?.usageScope === "open_reuse"), `${muscleSlug} attachments must use open-reuse sources`)
      assert.ok(actions.length >= 1, `${muscleSlug} needs action facts`)
      assert.ok(actions.every((action) => sourceBySlug.get(action.sourceRef)?.usageScope === "open_reuse"), `${muscleSlug} actions must use open-reuse sources`)
      assert.ok(innervation.length >= 1, `${muscleSlug} needs innervation facts`)
      assert.ok(innervation.every((entry) => sourceBySlug.get(entry.sourceRef)?.usageScope === "open_reuse"), `${muscleSlug} innervation must use open-reuse sources`)

      for (const factType of requiredFactTypes) {
        assert.ok(citationFactTypes.has(factType), `${muscleSlug} needs reviewed ${factType} citation`)
      }

      assert.ok(citations.some((citation) => citation.factType === "official_term" && citation.sourceRef === "fipat-ta2"), `${muscleSlug} needs reviewed official term citation`)
      assert.ok(citations.some((citation) => citation.factType === "external_identifier"), `${muscleSlug} needs reviewed external identifier citation`)
      assert.ok(citations
        .filter((citation) => ["clinical_summary", "origin", "insertion", "action", "innervation"].includes(citation.factType))
        .every((citation) => sourceBySlug.get(citation.sourceRef)?.usageScope === "open_reuse"), `${muscleSlug} reviewed reusable facts must cite open-reuse sources`)
    }

    assert.ok(searchAnatomyFoundation("neutral forearm").some((result) => result.slug === "brachioradialis"))
    assert.ok(searchAnatomyFoundation("deep elbow flexor").some((result) => result.slug === "brachialis"))
  })

  it("upgrades legacy shoulder and chest starter muscles to the commercial-safe pattern", () => {
    const legacyShoulderChestMuscles = [
      "serratus-anterior",
      "pectoralis-minor",
      "pectoralis-major-clavicular-head",
      "subclavius",
    ]
    const scapularProtractors = findMusclesForJointMovement("scapular-protraction").map((entry) => entry.muscle.slug)
    const scapularUpwardRotators = findMusclesForJointMovement("scapular-upward-rotation").map((entry) => entry.muscle.slug)
    const shoulderFlexors = findMusclesForJointMovement("shoulder-flexion").map((entry) => entry.muscle.slug)
    const clavicularDepressors = findMusclesForJointMovement("clavicular-depression").map((entry) => entry.muscle.slug)

    assert.ok(scapularProtractors.includes("serratus-anterior"))
    assert.ok(scapularProtractors.includes("pectoralis-minor"))
    assert.ok(scapularUpwardRotators.includes("serratus-anterior"))
    assert.ok(shoulderFlexors.includes("pectoralis-major-clavicular-head"))
    assert.ok(clavicularDepressors.includes("subclavius"))
    assert.ok(findMusclesByInnervation("long-thoracic-nerve").some((entry) => entry.slug === "serratus-anterior"))
    assert.ok(findMusclesByInnervation("medial-pectoral-nerve").some((entry) => entry.slug === "pectoralis-minor"))
    assert.ok(findMusclesByInnervation("lateral-pectoral-nerve").some((entry) => entry.slug === "pectoralis-major-clavicular-head"))
    assert.ok(findMusclesByInnervation("nerve-to-subclavius").some((entry) => entry.slug === "subclavius"))
    assert.ok(ANATOMY_FOUNDATION_SEED.relationships.some((relationship) => relationship.sourceEntitySlug === "serratus-anterior" && relationship.relationshipType === "superficial_to" && relationship.targetEntitySlug === "subscapularis"))
    assert.ok(ANATOMY_FOUNDATION_SEED.relationships.some((relationship) => relationship.sourceEntitySlug === "thoracoacromial-artery" && relationship.relationshipType === "supplies" && relationship.targetEntitySlug === "pectoralis-major-clavicular-head"))

    assertCommercialSafeMusclePack(legacyShoulderChestMuscles, { identifierProviders: ["UBERON", "FMA", "FIPAT"] })

    assert.ok(searchAnatomyFoundation("winging muscle").some((result) => result.slug === "serratus-anterior"))
    assert.ok(searchAnatomyFoundation("pec minor").some((result) => result.slug === "pectoralis-minor"))
    assert.ok(searchAnatomyFoundation("collarbone stabilizer").some((result) => result.slug === "subclavius"))
  })

  it("upgrades remaining legacy starter muscles to the commercial-safe pattern", () => {
    const remainingLegacyMuscles = [
      "upper-trapezius",
      "middle-trapezius",
      "lower-trapezius",
      "levator-scapulae",
      "sternocleidomastoid",
      "scalenes",
      "rhomboid-major",
      "rhomboid-minor",
      "supraspinatus",
      "infraspinatus",
      "deltoid",
      "splenius-capitis",
      "splenius-cervicis",
      "suboccipital-muscles",
      "semispinalis-capitis",
      "erector-spinae-upper-thoracic",
      "subscapularis",
      "teres-minor",
      "teres-major",
      "latissimus-dorsi",
      "hamstrings",
      "adductor-group",
    ]

    assertCommercialSafeMusclePack(remainingLegacyMuscles, { identifierProviders: ["UBERON", "FMA", "FIPAT"] })

    assert.ok(searchAnatomyFoundation("SCM").some((result) => result.slug === "sternocleidomastoid"))
    assert.ok(searchAnatomyFoundation("rotator cuff").some((result) => result.slug === "supraspinatus"))
    assert.ok(searchAnatomyFoundation("posterior thigh").some((result) => result.slug === "hamstrings"))
    assert.ok(searchAnatomyFoundation("inner thigh").some((result) => result.slug === "adductor-group"))
  })

  it("upgrades shoulder girdle and upper thoracic starter bones and landmarks to the commercial-safe pattern", () => {
    const boneSlugs = ["clavicle", "scapula", "humerus", "ribs", "sternum"]
    const landmarkSlugs = [
      "lateral-third-clavicle",
      "medial-clavicle",
      "inferior-clavicle",
      "acromion",
      "spine-of-scapula",
      "medial-border-scapula",
      "lateral-border-scapula",
      "superior-border-scapula",
      "superior-angle-scapula",
      "inferior-angle-scapula",
      "coracoid-process",
      "glenoid-cavity",
      "supraspinous-fossa",
      "infraspinous-fossa",
      "subscapular-fossa",
      "greater-tubercle",
      "lesser-tubercle",
      "intertubercular-sulcus",
      "deltoid-tuberosity",
      "first-rib",
      "upper-ribs",
      "manubrium",
      "sternal-body",
    ]

    assertCommercialSafeBonePack(boneSlugs)
    assertCommercialSafeLandmarkPack(landmarkSlugs)

    assert.ok(searchAnatomyFoundation("collarbone").some((result) => result.slug === "clavicle"))
    assert.ok(searchAnatomyFoundation("shoulder blade").some((result) => result.slug === "scapula"))
    assert.ok(searchAnatomyFoundation("upper arm bone").some((result) => result.slug === "humerus"))
    assert.ok(searchAnatomyFoundation("point of shoulder").some((result) => result.slug === "acromion"))
    assert.ok(searchAnatomyFoundation("shoulder socket").some((result) => result.slug === "glenoid-cavity"))
    assert.ok(findMusclesAttachedToBone("scapula").some((muscle) => muscle.slug === "supraspinatus"))
    assert.ok(findMusclesAttachedToBone("humerus").some((muscle) => muscle.slug === "deltoid"))
  })

  it("upgrades head, neck, and cervicothoracic starter bones and landmarks to the commercial-safe pattern", () => {
    const boneSlugs = [
      "occipital-bone",
      "temporal-bone",
      "atlas",
      "axis",
      "cervical-vertebrae",
      "thoracic-vertebrae",
    ]
    const landmarkSlugs = [
      "external-occipital-protuberance",
      "superior-nuchal-line",
      "inferior-nuchal-line",
      "mastoid-process",
      "posterior-arch-atlas",
      "axis-spinous-process",
      "cervical-transverse-processes",
      "cervical-spinous-processes",
      "cervicothoracic-spinous-processes",
      "upper-thoracic-spinous-processes",
    ]

    assertCommercialSafeBonePack(boneSlugs)
    assertCommercialSafeLandmarkPack(landmarkSlugs)

    assert.ok(searchAnatomyFoundation("base of skull bone").some((result) => result.slug === "occipital-bone"))
    assert.ok(searchAnatomyFoundation("mastoid").some((result) => result.slug === "mastoid-process"))
    assert.ok(searchAnatomyFoundation("C1 vertebra").some((result) => result.slug === "atlas"))
    assert.ok(searchAnatomyFoundation("C2 vertebra").some((result) => result.slug === "axis"))
    assert.ok(searchAnatomyFoundation("neck vertebrae").some((result) => result.slug === "cervical-vertebrae"))
    assert.ok(searchAnatomyFoundation("upper back spinous processes").some((result) => result.slug === "upper-thoracic-spinous-processes"))
    assert.ok(findMusclesAttachedToBone("occipital-bone").some((muscle) => muscle.slug === "upper-trapezius"))
    assert.ok(findMusclesAttachedToBone("cervical-vertebrae").some((muscle) => muscle.slug === "levator-scapulae"))
  })

  it("upgrades trunk, lumbar, pelvic, and thoracic cage starter bones and landmarks to the commercial-safe pattern", () => {
    const boneSlugs = [
      "lumbar-vertebrae",
      "sacrum",
      "pelvis",
    ]
    const landmarkSlugs = [
      "lumbar-spinous-processes",
      "lumbar-transverse-processes",
      "iliac-crest",
      "anterior-superior-iliac-spine",
      "posterior-superior-iliac-spine",
      "pubic-crest",
      "pubic-symphysis",
      "sacral-base",
      "lower-ribs",
      "rib-shafts",
      "costal-margin",
      "xiphoid-process",
      "lumbar-vertebral-bodies",
    ]

    assertCommercialSafeBonePack(boneSlugs)
    assertCommercialSafeLandmarkPack(landmarkSlugs)

    assert.ok(searchAnatomyFoundation("low back vertebrae").some((result) => result.slug === "lumbar-vertebrae"))
    assert.ok(searchAnatomyFoundation("tailbone base").some((result) => result.slug === "sacral-base"))
    assert.ok(searchAnatomyFoundation("hip crest").some((result) => result.slug === "iliac-crest"))
    assert.ok(searchAnatomyFoundation("front hip point").some((result) => result.slug === "anterior-superior-iliac-spine"))
    assert.ok(searchAnatomyFoundation("bottom of breastbone").some((result) => result.slug === "xiphoid-process"))
    assert.ok(findMusclesAttachedToBone("pelvis").some((muscle) => muscle.slug === "gluteus-maximus"))
    assert.ok(findMusclesAttachedToBone("lumbar-vertebrae").some((muscle) => muscle.slug === "quadratus-lumborum"))
  })

  it("upgrades lower-limb and foot starter bones and landmarks to the commercial-safe pattern", () => {
    const boneSlugs = [
      "femur",
      "patella",
      "tibia",
      "fibula",
      "calcaneus",
      "tarsals",
      "metatarsals",
      "foot-phalanges",
    ]
    const landmarkSlugs = [
      "greater-trochanter",
      "lesser-trochanter",
      "linea-aspera",
      "femoral-condyles",
      "adductor-tubercle",
      "ischial-tuberosity",
      "pubic-body",
      "inferior-pubic-ramus",
      "tibial-tuberosity",
      "pes-anserinus",
      "medial-tibial-condyle",
      "medial-malleolus",
      "lateral-malleolus",
      "head-of-fibula",
      "calcaneal-tuberosity",
      "metatarsal-heads",
    ]

    assertCommercialSafeBonePack(boneSlugs)
    assertCommercialSafeLandmarkPack(landmarkSlugs)

    assert.ok(searchAnatomyFoundation("thigh bone").some((result) => result.slug === "femur"))
    assert.ok(searchAnatomyFoundation("kneecap").some((result) => result.slug === "patella"))
    assert.ok(searchAnatomyFoundation("shin bone").some((result) => result.slug === "tibia"))
    assert.ok(searchAnatomyFoundation("outer ankle bone").some((result) => result.slug === "lateral-malleolus"))
    assert.ok(searchAnatomyFoundation("heel bone").some((result) => result.slug === "calcaneus"))
    assert.ok(findMusclesAttachedToBone("femur").some((muscle) => muscle.slug === "vastus-lateralis"))
    assert.ok(findMusclesAttachedToBone("tibia").some((muscle) => muscle.slug === "tibialis-anterior"))
    assert.ok(findMusclesAttachedToBone("calcaneus").some((muscle) => muscle.slug === "gastrocnemius"))
  })

  it("upgrades craniofacial and jaw starter bones and landmarks to the commercial-safe pattern", () => {
    const boneSlugs = [
      "mandible",
      "maxilla",
      "zygomatic-bone",
      "sphenoid-bone",
      "frontal-bone",
    ]
    const landmarkSlugs = [
      "mandibular-condyle",
      "mandibular-neck",
      "coronoid-process-mandible",
      "angle-of-mandible",
      "zygomatic-arch",
      "temporal-fossa",
      "pterygoid-fossa",
      "lateral-pterygoid-plate",
      "maxillary-tuberosity",
      "frontal-belly-region",
    ]

    assertCommercialSafeBonePack(boneSlugs)
    assertCommercialSafeLandmarkPack(landmarkSlugs)

    assert.ok(searchAnatomyFoundation("jaw bone").some((result) => result.slug === "mandible"))
    assert.ok(searchAnatomyFoundation("upper jaw bone").some((result) => result.slug === "maxilla"))
    assert.ok(searchAnatomyFoundation("cheek bone").some((result) => result.slug === "zygomatic-bone"))
    assert.ok(searchAnatomyFoundation("temple fossa").some((result) => result.slug === "temporal-fossa"))
    assert.ok(searchAnatomyFoundation("jaw joint head").some((result) => result.slug === "mandibular-condyle"))
    assert.ok(findMusclesAttachedToBone("mandible").some((muscle) => muscle.slug === "masseter"))
    assert.ok(findMusclesAttachedToBone("zygomatic-bone").some((muscle) => muscle.slug === "zygomaticus-major"))
    assert.ok(findMusclesAttachedToBone("frontal-bone").some((muscle) => muscle.slug === "frontalis"))
  })

  it("adds reviewed core citations to remaining open-reuse bones", () => {
    const boneSlugs = [
      "coccyx",
      "radius",
      "ulna",
      "carpals",
      "metacarpals",
      "hand-phalanges",
      "hyoid-bone",
    ]

    assertCommercialSafeBonePack(boneSlugs)

    assert.ok(searchAnatomyFoundation("tailbone").some((result) => result.slug === "coccyx"))
    assert.ok(searchAnatomyFoundation("thumb side forearm bone").some((result) => result.slug === "radius"))
    assert.ok(searchAnatomyFoundation("little finger side forearm bone").some((result) => result.slug === "ulna"))
    assert.ok(searchAnatomyFoundation("wrist bones").some((result) => result.slug === "carpals"))
    assert.ok(searchAnatomyFoundation("palm bones").some((result) => result.slug === "metacarpals"))
    assert.ok(searchAnatomyFoundation("finger bones").some((result) => result.slug === "hand-phalanges"))
    assert.ok(searchAnatomyFoundation("floating neck bone").some((result) => result.slug === "hyoid-bone"))
    assert.ok(findMusclesAttachedToBone("radius").some((muscle) => muscle.slug === "biceps-brachii"))
    assert.ok(findMusclesAttachedToBone("hyoid-bone").some((muscle) => muscle.slug === "mylohyoid"))
  })

  it("upgrades remaining weak nerve starter rows to the commercial-safe pattern", () => {
    const nerveSlugs = [
      "brachial-plexus",
      "lumbar-plexus",
      "sacral-plexus",
      "musculocutaneous-nerve",
      "radial-nerve",
      "median-nerve",
      "ulnar-nerve",
      "femoral-nerve",
      "tibial-nerve",
      "common-fibular-nerve",
      "superior-gluteal-nerve",
      "inferior-gluteal-nerve",
      "trigeminal-nerve",
      "mandibular-division-trigeminal",
      "maxillary-division-trigeminal",
      "facial-nerve",
    ]

    assertCommercialSafeEntityPack("nerve", ANATOMY_FOUNDATION_SEED.nerves, nerveSlugs)

    assert.ok(searchAnatomyFoundation("upper limb nerve plexus").some((result) => result.slug === "brachial-plexus"))
    assert.ok(searchAnatomyFoundation("CN VII").some((result) => result.slug === "facial-nerve"))
    assert.ok(searchAnatomyFoundation("V3 mandibular nerve").some((result) => result.slug === "mandibular-division-trigeminal"))
    assert.ok(ANATOMY_FOUNDATION_SEED.relationships.some((relationship) => relationship.sourceEntitySlug === "brachial-plexus" && relationship.targetEntitySlug === "median-nerve"))
  })

  it("upgrades remaining weak vessel starter rows to the commercial-safe pattern", () => {
    const vesselSlugs = [
      "external-jugular-vein",
      "axillary-artery",
      "cephalic-vein",
      "abdominal-aorta",
      "internal-iliac-artery",
      "basilic-vein",
      "femoral-artery",
      "femoral-vein",
      "popliteal-artery",
      "anterior-tibial-artery",
      "posterior-tibial-artery",
      "external-carotid-artery",
      "maxillary-artery",
      "superficial-temporal-artery",
      "facial-vein",
    ]

    assertCommercialSafeEntityPack("blood_supply", ANATOMY_FOUNDATION_SEED.bloodSupply, vesselSlugs)

    assert.ok(searchAnatomyFoundation("armpit artery").some((result) => result.slug === "axillary-artery"))
    assert.ok(searchAnatomyFoundation("main abdomen artery").some((result) => result.slug === "abdominal-aorta"))
    assert.ok(searchAnatomyFoundation("behind knee artery").some((result) => result.slug === "popliteal-artery"))
    assert.ok(ANATOMY_FOUNDATION_SEED.relationships.some((relationship) => relationship.sourceEntitySlug === "internal-iliac-artery" && relationship.targetEntitySlug === "hip"))
  })

  it("upgrades remaining weak connective structure starter rows to the commercial-safe pattern", () => {
    const structureSlugs = [
      "intervertebral-disc",
      "thoracolumbar-fascia",
      "abdominal-aponeurosis",
      "temporomandibular-articular-disc",
      "biceps-tendon",
      "triceps-tendon",
      "flexor-retinaculum",
      "iliotibial-band",
      "knee-meniscus",
      "achilles-tendon",
      "plantar-fascia",
    ]

    assertCommercialSafeEntityPack("anatomy_structure", ANATOMY_FOUNDATION_SEED.structures, structureSlugs)

    assert.ok(searchAnatomyFoundation("disc between vertebrae").some((result) => result.slug === "intervertebral-disc"))
    assert.ok(searchAnatomyFoundation("IT band").some((result) => result.slug === "iliotibial-band"))
    assert.ok(searchAnatomyFoundation("heel cord").some((result) => result.slug === "achilles-tendon"))
    assert.ok(searchAnatomyFoundation("carpal tunnel roof").some((result) => result.slug === "flexor-retinaculum"))
  })

  it("upgrades remaining weak ligament starter rows to the commercial-safe pattern", () => {
    const ligamentSlugs = [
      "nuchal-ligament",
      "alar-ligament",
      "transverse-ligament-of-atlas",
      "acromioclavicular-ligament",
      "coracoclavicular-ligament",
      "coracoacromial-ligament",
      "coracohumeral-ligament",
      "glenohumeral-ligaments",
      "sternoclavicular-ligaments",
      "costoclavicular-ligament",
      "iliolumbar-ligament",
      "sacroiliac-ligaments",
      "iliofemoral-ligament",
      "anterior-cruciate-ligament",
      "posterior-cruciate-ligament",
      "medial-collateral-ligament-knee",
      "lateral-collateral-ligament-knee",
      "deltoid-ligament-ankle",
      "anterior-talofibular-ligament",
      "lateral-temporomandibular-ligament",
      "sphenomandibular-ligament",
      "stylomandibular-ligament",
    ]

    assertCommercialSafeEntityPack("ligament", ANATOMY_FOUNDATION_SEED.ligaments, ligamentSlugs)

    assert.ok(searchAnatomyFoundation("ACL").some((result) => result.slug === "anterior-cruciate-ligament"))
    assert.ok(searchAnatomyFoundation("ATFL").some((result) => result.slug === "anterior-talofibular-ligament"))
    assert.ok(searchAnatomyFoundation("neck midline ligament").some((result) => result.slug === "nuchal-ligament"))
    assert.ok(ANATOMY_FOUNDATION_SEED.ligaments.every((ligament) => ligament.joint))
  })

  it("maps every ligament into reviewed joint, bone, or structure relationships", () => {
    const ligamentSlugsWithoutRelationships = ANATOMY_FOUNDATION_SEED.ligaments
      .filter((ligament) => !ANATOMY_FOUNDATION_SEED.relationships.some((relationship) => (
        relationship.sourceEntityType === "ligament"
        && relationship.sourceEntitySlug === ligament.slug
      ) || (
        relationship.targetEntityType === "ligament"
        && relationship.targetEntitySlug === ligament.slug
      )))
      .map((ligament) => ligament.slug)

    assert.deepEqual(ligamentSlugsWithoutRelationships, [])

    const relationshipKeys = new Set(ANATOMY_FOUNDATION_SEED.relationships.map((relationship) => [
      relationship.sourceEntityType,
      relationship.sourceEntitySlug,
      relationship.relationshipType,
      relationship.targetEntityType,
      relationship.targetEntitySlug,
    ].join(":")))

    for (const relationshipKey of [
      "ligament:nuchal-ligament:stabilizes:joint:cervical-spine",
      "ligament:alar-ligament:limits_rotation_of:joint:atlantoaxial",
      "ligament:acromioclavicular-ligament:stabilizes:joint:acromioclavicular",
      "ligament:coracoclavicular-ligament:connects:bone:clavicle",
      "ligament:anterior-cruciate-ligament:stabilizes:joint:knee-joint",
      "ligament:medial-collateral-ligament-knee:connects:bone:tibia",
      "ligament:deltoid-ligament-ankle:stabilizes:joint:ankle-joint",
      "ligament:lateral-temporomandibular-ligament:stabilizes:joint:temporomandibular-joint",
    ]) {
      assert.ok(relationshipKeys.has(relationshipKey), `${relationshipKey} should be present`)
    }

    const relationshipCitationKeys = new Set(ANATOMY_FOUNDATION_SEED.citations
      .filter((citation) => citation.factType === "ligament_relationship" && citation.reviewStatus === "reviewed")
      .map((citation) => `${citation.entityType}:${citation.entitySlug}:${citation.factSlug}`))
    const sourceReferenceCitationKeys = new Set(ANATOMY_FOUNDATION_SEED.citations
      .filter((citation) => citation.factType === "seed_source_reference" && citation.reviewStatus === "reviewed")
      .map((citation) => `${citation.entityType}:${citation.entitySlug}:${citation.factSlug}`))

    for (const relationship of ANATOMY_FOUNDATION_SEED.relationships.filter((entry) => entry.sourceEntityType === "ligament")) {
      assert.ok(
        relationshipCitationKeys.has(`ligament:${relationship.sourceEntitySlug}:${relationship.id}`),
        `${relationship.id} needs a reviewed ligament relationship citation`,
      )
      assert.ok(
        sourceReferenceCitationKeys.has(`ligament:${relationship.sourceEntitySlug}:relationship:${relationship.id}`),
        `${relationship.id} needs a reviewed source-reference citation`,
      )
    }
  })

  it("upgrades pain-map regions to reviewed commercial-safe body-map metadata", () => {
    const painMapRegions = ANATOMY_FOUNDATION_SEED.painMapRegions

    assert.equal(painMapRegions.length, 24)

    for (const painMapRegion of painMapRegions) {
      const citations = ANATOMY_FOUNDATION_SEED.citations.filter((citation) => citation.entityType === "pain_map_region" && citation.entitySlug === painMapRegion.slug && citation.reviewStatus === "reviewed")
      const citationFactTypes = new Set(citations.map((citation) => citation.factType))

      assertCommercialSafeSource(painMapRegion.sourceRef, `pain map ${painMapRegion.slug}`)
      assert.ok((painMapRegion.plainLanguageDescription ?? "").length > 25, `${painMapRegion.slug} needs client-friendly region copy`)
      assert.notEqual(painMapRegion.laterality, "unspecified", `${painMapRegion.slug} needs explicit laterality metadata`)
      assert.notEqual(painMapRegion.surface, "unspecified", `${painMapRegion.slug} needs explicit surface metadata`)
      assert.ok(citationFactTypes.has("body_map_region"), `${painMapRegion.slug} needs reviewed body-map citation`)
      assert.ok(citationFactTypes.has("anatomy_mapping"), `${painMapRegion.slug} needs reviewed anatomy-mapping citation`)
    }

    assert.ok(findPainMapOverlaps("scapular-region").some((region) => region.slug === "between-shoulder-blades"))
    assert.ok(searchAnatomyFoundation("front of knee").some((result) => result.slug === "front-of-knee"))
  })

  it("upgrades client-language mappings to reviewed commercial-safe non-diagnostic metadata", () => {
    const clientTerms = ANATOMY_FOUNDATION_SEED.clientTerms

    assert.equal(clientTerms.length, 108)

    for (const clientTerm of clientTerms) {
      const citations = ANATOMY_FOUNDATION_SEED.citations.filter((citation) => citation.entityType === "client_term" && citation.entitySlug === clientTerm.slug && citation.reviewStatus === "reviewed")
      const citationFactTypes = new Set(citations.map((citation) => citation.factType))

      assertCommercialSafeSource(clientTerm.sourceRef, `client term ${clientTerm.slug}`)
      assert.equal(clientTerm.clinicalUse, "non-diagnostic")
      assert.ok(clientTerm.likelyRegions.length >= 1, `${clientTerm.slug} needs likely region mappings`)
      assert.ok(clientTerm.likelyStructures.length >= 1, `${clientTerm.slug} needs likely structure mappings`)
      assert.ok((clientTerm.therapistPrompt ?? "").length > 30, `${clientTerm.slug} needs therapist prompt context`)
      assert.ok(citationFactTypes.has("client_language"), `${clientTerm.slug} needs reviewed client-language citation`)
      assert.ok(citationFactTypes.has("anatomy_mapping"), `${clientTerm.slug} needs reviewed anatomy-mapping citation`)
    }

    assert.equal(findClientTermMapping("between my shoulder blades")?.mappedRegionSlug, "scapular-region")
    assert.equal(findClientTermMapping("top of shoulder")?.mappedMuscleSlug, "upper-trapezius")
    assert.ok(searchAnatomyFoundation("tight around my eyes").some((result) => result.slug === "tight-around-my-eyes"))
  })

  it("moves remaining weak relationship rows to commercial-safe source records", () => {
    const sourceBySlug = new Map(ANATOMY_FOUNDATION_SEED.sources.map((source) => [source.slug, source]))
    const weakRelationships = ANATOMY_FOUNDATION_SEED.relationships
      .filter((relationship) => !["open_reuse", "commercial_licensed"].includes(sourceBySlug.get(relationship.sourceRef)?.usageScope))
      .map((relationship) => relationship.id)

    assert.deepEqual(weakRelationships, [])
    assert.ok(ANATOMY_FOUNDATION_SEED.relationships.some((relationship) => relationship.id === "relationship-gastrocnemius-superficial-to-soleus" && relationship.sourceRef === "applied-human-anatomy"))
    assert.ok(ANATOMY_FOUNDATION_SEED.relationships.some((relationship) => relationship.id === "relationship-sciatic-may-affect-leg" && relationship.sourceRef === "applied-human-anatomy"))
    assert.ok(ANATOMY_FOUNDATION_SEED.relationships.some((relationship) => relationship.id === "relationship-painmap-between-shoulders-overlaps-scapular" && relationship.sourceRef === "massagelab-authored-client-language"))
  })

  it("adds a commercial-safe forearm and hand movement pack for finger actions", () => {
    const sourceBySlug = new Map(ANATOMY_FOUNDATION_SEED.sources.map((source) => [source.slug, source]))
    const newMuscleSlugs = [
      "flexor-digitorum-superficialis",
      "flexor-digitorum-profundus",
      "extensor-digitorum",
      "palmaris-longus",
      "pronator-quadratus",
    ]
    const fingerFlexors = findMusclesForJointMovement("finger-flexion").map((entry) => entry.muscle.slug)
    const fingerExtensors = findMusclesForJointMovement("finger-extension").map((entry) => entry.muscle.slug)
    const pronators = findMusclesForJointMovement("forearm-pronation").map((entry) => entry.muscle.slug)

    assert.ok(ANATOMY_FOUNDATION_SEED.joints.some((joint) => joint.slug === "interphalangeal-joints-of-hand"))
    assert.ok(ANATOMY_FOUNDATION_SEED.jointMovements.some((movement) => movement.slug === "finger-flexion"))
    assert.ok(ANATOMY_FOUNDATION_SEED.jointMovements.some((movement) => movement.slug === "finger-extension"))
    assert.ok(ANATOMY_FOUNDATION_SEED.structures.some((structure) => structure.slug === "palmar-aponeurosis" && structure.sourceRef === "applied-human-anatomy"))
    assert.ok(ANATOMY_FOUNDATION_SEED.structures.some((structure) => structure.slug === "dorsal-extensor-expansion" && structure.sourceRef === "applied-human-anatomy"))
    assert.ok(fingerFlexors.includes("flexor-digitorum-superficialis"))
    assert.ok(fingerFlexors.includes("flexor-digitorum-profundus"))
    assert.ok(fingerExtensors.includes("extensor-digitorum"))
    assert.ok(pronators.includes("pronator-teres"))
    assert.ok(pronators.includes("pronator-quadratus"))

    for (const muscleSlug of newMuscleSlugs) {
      const muscle = ANATOMY_FOUNDATION_SEED.muscles.find((entry) => entry.slug === muscleSlug)
      const citations = ANATOMY_FOUNDATION_SEED.citations.filter((citation) => citation.entityType === "muscle" && citation.entitySlug === muscleSlug && citation.reviewStatus === "reviewed")
      const terms = ANATOMY_FOUNDATION_SEED.entityTerms.filter((term) => term.anatomyEntityType === "muscle" && term.anatomyEntitySlug === muscleSlug)
      const identifiers = ANATOMY_FOUNDATION_SEED.externalIdentifiers.filter((identifier) => identifier.entityType === "muscle" && identifier.entitySlug === muscleSlug)

      assert.equal(sourceBySlug.get(muscle?.sourceRef ?? "")?.usageScope, "open_reuse", `${muscleSlug} must use an open-reuse source`)
      assert.ok((muscle?.description ?? "").length > 80, `${muscleSlug} needs a MassageLab-authored display summary`)
      assert.ok(terms.some((term) => ["preferred", "formal"].includes(term.termType) && term.sourceRef === "fipat-ta2"), `${muscleSlug} needs FIPAT-backed terminology`)
      assert.ok(identifiers.length >= 1, `${muscleSlug} needs at least one external ontology identifier`)
      assert.ok(citations.some((citation) => citation.factType === "clinical_summary" && citation.sourceRef === "applied-human-anatomy"), `${muscleSlug} needs reviewed clinical summary citation`)
      assert.ok(citations.some((citation) => citation.factType === "action" && citation.sourceRef === "applied-human-anatomy"), `${muscleSlug} needs reviewed action citation`)
      assert.ok(citations.some((citation) => citation.factType === "innervation" && citation.sourceRef === "applied-human-anatomy"), `${muscleSlug} needs reviewed innervation citation`)
    }

    assert.ok(searchAnatomyFoundation("finger flexion").some((result) => result.slug === "flexor-digitorum-superficialis"))
    assert.ok(searchAnatomyFoundation("palmar aponeurosis").some((result) => result.slug === "palmar-aponeurosis"))
  })

  it("adds a commercial-safe wrist flexor and extensor pack", () => {
    const sourceBySlug = new Map(ANATOMY_FOUNDATION_SEED.sources.map((source) => [source.slug, source]))
    const wristMuscleSlugs = [
      "flexor-carpi-radialis",
      "flexor-carpi-ulnaris",
      "extensor-carpi-radialis",
      "extensor-carpi-ulnaris",
    ]
    const requiredFactTypes = ["clinical_summary", "origin", "insertion", "action", "innervation", "official_term", "external_identifier"]
    const wristFlexors = findMusclesForJointMovement("wrist-flexion").map((entry) => entry.muscle.slug)
    const wristExtensors = findMusclesForJointMovement("wrist-extension").map((entry) => entry.muscle.slug)
    const radialDeviators = findMusclesForJointMovement("wrist-radial-deviation").map((entry) => entry.muscle.slug)
    const ulnarDeviators = findMusclesForJointMovement("wrist-ulnar-deviation").map((entry) => entry.muscle.slug)

    assert.ok(wristFlexors.includes("flexor-carpi-radialis"))
    assert.ok(wristFlexors.includes("flexor-carpi-ulnaris"))
    assert.ok(wristExtensors.includes("extensor-carpi-radialis"))
    assert.ok(wristExtensors.includes("extensor-carpi-ulnaris"))
    assert.ok(radialDeviators.includes("flexor-carpi-radialis"))
    assert.ok(radialDeviators.includes("extensor-carpi-radialis"))
    assert.ok(ulnarDeviators.includes("flexor-carpi-ulnaris"))
    assert.ok(ulnarDeviators.includes("extensor-carpi-ulnaris"))
    assert.ok(findMusclesByInnervation("median-nerve").some((entry) => entry.slug === "flexor-carpi-radialis"))
    assert.ok(findMusclesByInnervation("ulnar-nerve").some((entry) => entry.slug === "flexor-carpi-ulnaris"))
    assert.ok(findMusclesByInnervation("radial-nerve").some((entry) => entry.slug === "extensor-carpi-radialis"))
    assert.ok(findMusclesByInnervation("radial-nerve").some((entry) => entry.slug === "extensor-carpi-ulnaris"))
    assert.ok(ANATOMY_FOUNDATION_SEED.structures.some((structure) => structure.slug === "common-flexor-tendon" && structure.sourceRef === "applied-human-anatomy"))
    assert.ok(ANATOMY_FOUNDATION_SEED.structures.some((structure) => structure.slug === "common-extensor-tendon" && structure.sourceRef === "applied-human-anatomy"))

    for (const muscleSlug of wristMuscleSlugs) {
      const muscle = ANATOMY_FOUNDATION_SEED.muscles.find((entry) => entry.slug === muscleSlug)
      const citations = ANATOMY_FOUNDATION_SEED.citations.filter((citation) => citation.entityType === "muscle" && citation.entitySlug === muscleSlug && citation.reviewStatus === "reviewed")
      const citationFactTypes = new Set(citations.map((citation) => citation.factType))
      const terms = ANATOMY_FOUNDATION_SEED.entityTerms.filter((term) => term.anatomyEntityType === "muscle" && term.anatomyEntitySlug === muscleSlug)
      const identifiers = ANATOMY_FOUNDATION_SEED.externalIdentifiers.filter((identifier) => identifier.entityType === "muscle" && identifier.entitySlug === muscleSlug)
      const attachments = ANATOMY_FOUNDATION_SEED.muscleAttachments.filter((attachment) => attachment.muscle === muscleSlug)
      const actions = ANATOMY_FOUNDATION_SEED.muscleActions.filter((action) => action.muscle === muscleSlug)
      const innervation = ANATOMY_FOUNDATION_SEED.muscleInnervations.filter((entry) => entry.muscle === muscleSlug)

      assert.equal(sourceBySlug.get(muscle?.sourceRef ?? "")?.usageScope, "open_reuse", `${muscleSlug} must use an open-reuse source`)
      assert.ok((muscle?.description ?? "").length > 80, `${muscleSlug} needs a MassageLab-authored display summary`)
      assert.ok(terms.some((term) => ["preferred", "formal"].includes(term.termType) && term.sourceRef === "fipat-ta2"), `${muscleSlug} needs FIPAT-backed terminology`)
      assert.ok(identifiers.some((identifier) => ["UBERON", "NCIT", "FMA", "FIPAT"].includes(identifier.provider)), `${muscleSlug} needs an external ontology or terminology identifier`)
      assert.ok(attachments.length >= 2, `${muscleSlug} needs origin and insertion facts`)
      assert.ok(attachments.every((attachment) => sourceBySlug.get(attachment.sourceRef)?.usageScope === "open_reuse"), `${muscleSlug} attachments must use open-reuse sources`)
      assert.ok(actions.length >= 2, `${muscleSlug} needs wrist action facts`)
      assert.ok(actions.every((action) => sourceBySlug.get(action.sourceRef)?.usageScope === "open_reuse"), `${muscleSlug} actions must use open-reuse sources`)
      assert.ok(innervation.length >= 1, `${muscleSlug} needs innervation facts`)
      assert.ok(innervation.every((entry) => sourceBySlug.get(entry.sourceRef)?.usageScope === "open_reuse"), `${muscleSlug} innervation must use open-reuse sources`)

      for (const factType of requiredFactTypes) {
        assert.ok(citationFactTypes.has(factType), `${muscleSlug} needs reviewed ${factType} citation`)
      }
    }

    assert.ok(searchAnatomyFoundation("wrist flexor").some((result) => ["flexor-carpi-radialis", "flexor-carpi-ulnaris"].includes(result.slug)))
    assert.ok(searchAnatomyFoundation("wrist extensor").some((result) => ["extensor-carpi-radialis", "extensor-carpi-ulnaris"].includes(result.slug)))
    assert.ok(searchAnatomyFoundation("radial wrist tendon").some((result) => ["flexor-carpi-radialis", "extensor-carpi-radialis"].includes(result.slug)))
    assert.ok(searchAnatomyFoundation("ulnar wrist tendon").some((result) => ["flexor-carpi-ulnaris", "extensor-carpi-ulnaris"].includes(result.slug)))
    assert.equal(findClientTermMapping("inside wrist tightness")?.mappedMuscleSlug, "flexor-carpi-radialis")
    assert.equal(findClientTermMapping("outside wrist tightness")?.mappedMuscleSlug, "extensor-carpi-ulnaris")
    assert.equal(findClientTermMapping("gripping forearm tightness")?.mappedMuscleSlug, "flexor-carpi-radialis")
  })

  it("adds a commercial-safe upper-limb skeleton, joint, ligament, and ROM reference pack", () => {
    const sourceBySlug = new Map(ANATOMY_FOUNDATION_SEED.sources.map((source) => [source.slug, source]))
    const boneSlugs = ["radius", "ulna", "carpals", "metacarpals", "hand-phalanges"]
    const landmarkSlugs = [
      "medial-epicondyle-humerus",
      "lateral-epicondyle-humerus",
      "olecranon",
      "radial-tuberosity",
      "radius-styloid-process",
      "ulna-styloid-process",
      "carpal-tunnel",
      "metacarpal-bases",
    ]
    const jointSlugs = ["elbow-joint", "proximal-radioulnar-joint", "wrist-joint", "metacarpophalangeal-joints"]
    const movementSlugs = [
      "elbow-flexion",
      "elbow-extension",
      "forearm-pronation",
      "forearm-supination",
      "wrist-flexion",
      "wrist-extension",
      "wrist-radial-deviation",
      "wrist-ulnar-deviation",
    ]
    const romSlugs = [
      "elbow-flexion-rom",
      "elbow-extension-rom",
      "forearm-pronation-rom",
      "forearm-supination-rom",
      "wrist-flexion-rom",
      "wrist-extension-rom",
    ]
    const ligamentSlugs = [
      "elbow-ulnar-collateral-ligament",
      "elbow-radial-collateral-ligament",
      "annular-ligament-of-radius",
      "palmar-radiocarpal-ligament",
    ]

    assert.equal(sourceBySlug.get("cdc-normal-joint-rom")?.usageScope, "open_reuse")
    assert.match(sourceBySlug.get("cdc-normal-joint-rom")?.license ?? "", /public domain/i)

    for (const boneSlug of boneSlugs) {
      const bone = ANATOMY_FOUNDATION_SEED.bones.find((entry) => entry.slug === boneSlug)
      const identifiers = ANATOMY_FOUNDATION_SEED.externalIdentifiers.filter((identifier) => identifier.entityType === "bone" && identifier.entitySlug === boneSlug)
      const citations = ANATOMY_FOUNDATION_SEED.citations.filter((citation) => citation.entityType === "bone" && citation.entitySlug === boneSlug && citation.reviewStatus === "reviewed")

      assert.equal(sourceBySlug.get(bone?.sourceRef ?? "")?.usageScope, "open_reuse", `${boneSlug} must use an open-reuse source`)
      assert.ok((bone?.description ?? "").length > 50, `${boneSlug} needs a MassageLab-authored structure summary`)
      assert.ok(identifiers.some((identifier) => identifier.provider === "UBERON"), `${boneSlug} needs a UBERON identifier`)
      assert.ok(citations.some((citation) => citation.factType === "definition" && citation.sourceRef === "applied-human-anatomy"), `${boneSlug} needs reviewed structure citation`)
      assert.ok(citations.some((citation) => citation.factType === "external_identifier" && citation.sourceRef === "ols-uberon"), `${boneSlug} needs reviewed ontology citation`)
    }

    for (const landmarkSlug of landmarkSlugs) {
      const landmark = ANATOMY_FOUNDATION_SEED.boneLandmarks.find((entry) => entry.slug === landmarkSlug)
      const citations = ANATOMY_FOUNDATION_SEED.citations.filter((citation) => citation.entityType === "bone_landmark" && citation.entitySlug === landmarkSlug && citation.reviewStatus === "reviewed")

      assert.equal(sourceBySlug.get(landmark?.sourceRef ?? "")?.usageScope, "open_reuse", `${landmarkSlug} must use an open-reuse source`)
      assert.ok((landmark?.description ?? "").length > 40, `${landmarkSlug} needs a concise landmark description`)
      assert.ok(citations.some((citation) => citation.factType === "anatomy_landmark" && citation.sourceRef === "applied-human-anatomy"), `${landmarkSlug} needs reviewed landmark citation`)
    }

    for (const jointSlug of jointSlugs) {
      const joint = ANATOMY_FOUNDATION_SEED.joints.find((entry) => entry.slug === jointSlug)
      const citations = ANATOMY_FOUNDATION_SEED.citations.filter((citation) => citation.entityType === "joint" && citation.entitySlug === jointSlug && citation.reviewStatus === "reviewed")

      assert.equal(sourceBySlug.get(joint?.sourceRef ?? "")?.usageScope, "open_reuse", `${jointSlug} must use an open-reuse source`)
      assert.ok((joint?.description ?? "").length > 40, `${jointSlug} needs a joint summary`)
      assert.ok(citations.some((citation) => citation.factType === "joint_structure" && citation.sourceRef === "applied-human-anatomy"), `${jointSlug} needs reviewed joint citation`)
    }

    for (const movementSlug of movementSlugs) {
      const movement = ANATOMY_FOUNDATION_SEED.jointMovements.find((entry) => entry.slug === movementSlug)
      const citations = ANATOMY_FOUNDATION_SEED.citations.filter((citation) => citation.entityType === "joint_movement" && citation.entitySlug === movementSlug && citation.reviewStatus === "reviewed")

      assert.equal(sourceBySlug.get(movement?.sourceRef ?? "")?.usageScope, "open_reuse", `${movementSlug} must use an open-reuse source`)
      assert.ok((movement?.description ?? "").length > 30, `${movementSlug} needs a movement description`)
      assert.ok(citations.some((citation) => citation.factType === "joint_movement" && citation.sourceRef === "applied-human-anatomy"), `${movementSlug} needs reviewed movement citation`)
    }

    for (const romSlug of romSlugs) {
      const rom = ANATOMY_FOUNDATION_SEED.rangesOfMotion.find((entry) => entry.slug === romSlug)
      const citations = ANATOMY_FOUNDATION_SEED.citations.filter((citation) => citation.entityType === "joint_movement" && citation.factSlug === romSlug && citation.reviewStatus === "reviewed")

      assert.equal(rom?.sourceRef, "cdc-normal-joint-rom", `${romSlug} should use the CDC public-domain ROM source`)
      assert.ok(citations.some((citation) => citation.factType === "range_of_motion" && citation.sourceRef === "cdc-normal-joint-rom"), `${romSlug} needs reviewed ROM citation`)
    }

    for (const ligamentSlug of ligamentSlugs) {
      const ligament = ANATOMY_FOUNDATION_SEED.ligaments.find((entry) => entry.slug === ligamentSlug)
      const citations = ANATOMY_FOUNDATION_SEED.citations.filter((citation) => citation.entityType === "ligament" && citation.entitySlug === ligamentSlug && citation.reviewStatus === "reviewed")

      assert.equal(sourceBySlug.get(ligament?.sourceRef ?? "")?.usageScope, "open_reuse", `${ligamentSlug} must use an open-reuse source`)
      assert.ok((ligament?.description ?? "").length > 40, `${ligamentSlug} needs a ligament summary`)
      assert.ok(citations.some((citation) => citation.factType === "ligament_structure" && citation.sourceRef === "applied-human-anatomy"), `${ligamentSlug} needs reviewed ligament citation`)
    }

    assert.ok(searchAnatomyFoundation("radial tuberosity").some((result) => result.slug === "radial-tuberosity"))
    assert.ok(searchAnatomyFoundation("carpal tunnel").some((result) => result.slug === "carpal-tunnel"))
    assert.equal(findRangeOfMotion("wrist-joint", "wrist-flexion")?.typicalMinDegrees, 70)
    assert.equal(findRangeOfMotion("forearm", "forearm-pronation")?.typicalMaxDegrees, undefined)
    assert.equal(findRangeOfMotion("proximal-radioulnar-joint", "forearm-pronation")?.typicalMaxDegrees, 90)
  })

  it("adds a commercial-safe intrinsic hand and thumb mechanics pack", () => {
    const sourceBySlug = new Map(ANATOMY_FOUNDATION_SEED.sources.map((source) => [source.slug, source]))
    const handMuscles = [
      "abductor-pollicis-brevis",
      "flexor-pollicis-brevis",
      "opponens-pollicis",
      "adductor-pollicis",
      "dorsal-interossei-hand",
      "palmar-interossei-hand",
    ]
    const thumbAbductors = findMusclesForJointMovement("thumb-abduction").map((entry) => entry.muscle.slug)
    const thumbFlexors = findMusclesForJointMovement("thumb-flexion").map((entry) => entry.muscle.slug)
    const thumbOpposers = findMusclesForJointMovement("thumb-opposition").map((entry) => entry.muscle.slug)
    const thumbAdductors = findMusclesForJointMovement("thumb-adduction").map((entry) => entry.muscle.slug)
    const fingerAbductors = findMusclesForJointMovement("finger-abduction").map((entry) => entry.muscle.slug)
    const fingerAdductors = findMusclesForJointMovement("finger-adduction").map((entry) => entry.muscle.slug)

    assert.ok(ANATOMY_FOUNDATION_SEED.joints.some((joint) => joint.slug === "thumb-carpometacarpal-joint"))
    assert.ok(ANATOMY_FOUNDATION_SEED.jointMovements.some((movement) => movement.slug === "thumb-opposition"))
    assert.ok(thumbAbductors.includes("abductor-pollicis-brevis"))
    assert.ok(thumbFlexors.includes("flexor-pollicis-brevis"))
    assert.ok(thumbOpposers.includes("opponens-pollicis"))
    assert.ok(thumbAdductors.includes("adductor-pollicis"))
    assert.ok(fingerAbductors.includes("dorsal-interossei-hand"))
    assert.ok(fingerAdductors.includes("palmar-interossei-hand"))

    for (const muscleSlug of handMuscles) {
      const muscle = ANATOMY_FOUNDATION_SEED.muscles.find((entry) => entry.slug === muscleSlug)
      const citations = ANATOMY_FOUNDATION_SEED.citations.filter((citation) => citation.entityType === "muscle" && citation.entitySlug === muscleSlug && citation.reviewStatus === "reviewed")
      const citationFactTypes = new Set(citations.map((citation) => citation.factType))
      const terms = ANATOMY_FOUNDATION_SEED.entityTerms.filter((term) => term.anatomyEntityType === "muscle" && term.anatomyEntitySlug === muscleSlug)
      const identifiers = ANATOMY_FOUNDATION_SEED.externalIdentifiers.filter((identifier) => identifier.entityType === "muscle" && identifier.entitySlug === muscleSlug)
      const attachments = ANATOMY_FOUNDATION_SEED.muscleAttachments.filter((attachment) => attachment.muscle === muscleSlug)
      const actions = ANATOMY_FOUNDATION_SEED.muscleActions.filter((action) => action.muscle === muscleSlug)
      const innervation = ANATOMY_FOUNDATION_SEED.muscleInnervations.filter((entry) => entry.muscle === muscleSlug)

      assert.equal(sourceBySlug.get(muscle?.sourceRef ?? "")?.usageScope, "open_reuse", `${muscleSlug} must use an open-reuse source`)
      assert.ok((muscle?.description ?? "").length > 80, `${muscleSlug} needs a MassageLab-authored display summary`)
      assert.ok(terms.some((term) => ["preferred", "formal"].includes(term.termType) && term.sourceRef === "fipat-ta2"), `${muscleSlug} needs FIPAT-backed terminology`)
      assert.ok(identifiers.some((identifier) => ["UBERON", "NCIT"].includes(identifier.provider)), `${muscleSlug} needs a UBERON or NCIT identifier`)
      assert.ok(attachments.length >= 2, `${muscleSlug} needs origin and insertion facts`)
      assert.ok(attachments.every((attachment) => sourceBySlug.get(attachment.sourceRef)?.usageScope === "open_reuse"), `${muscleSlug} attachments must use open-reuse sources`)
      assert.ok(actions.length >= 1, `${muscleSlug} needs action facts`)
      assert.ok(actions.every((action) => sourceBySlug.get(action.sourceRef)?.usageScope === "open_reuse"), `${muscleSlug} actions must use open-reuse sources`)
      assert.ok(innervation.length >= 1, `${muscleSlug} needs innervation facts`)
      assert.ok(innervation.every((entry) => sourceBySlug.get(entry.sourceRef)?.usageScope === "open_reuse"), `${muscleSlug} innervation must use open-reuse sources`)

      for (const factType of ["clinical_summary", "origin", "insertion", "action", "innervation"]) {
        assert.ok(citationFactTypes.has(factType), `${muscleSlug} needs reviewed ${factType} citation`)
      }

      assert.ok(citations.some((citation) => citation.factType === "official_term" && citation.sourceRef === "fipat-ta2"), `${muscleSlug} needs reviewed official term citation`)
      assert.ok(citations.some((citation) => citation.factType === "external_identifier"), `${muscleSlug} needs reviewed external identifier citation`)
    }

    assert.ok(searchAnatomyFoundation("thenar muscle").some((result) => result.slug === "opponens-pollicis"))
    assert.ok(searchAnatomyFoundation("thumb pad").some((result) => result.slug === "abductor-pollicis-brevis"))
    assert.ok(searchAnatomyFoundation("pinch muscle").some((result) => result.slug === "adductor-pollicis"))
    assert.ok(searchAnatomyFoundation("finger spread").some((result) => result.slug === "dorsal-interossei-hand"))
    assert.equal(findClientTermMapping("thumb pad tightness")?.mappedMuscleSlug, "abductor-pollicis-brevis")
    assert.equal(findClientTermMapping("pinch grip tightness")?.mappedMuscleSlug, "adductor-pollicis")
    assert.equal(findClientTermMapping("finger spreading tightness")?.mappedMuscleSlug, "dorsal-interossei-hand")
  })

  it("adds a commercial-safe abdominal wall and lumbar stabilization pack", () => {
    const sourceBySlug = new Map(ANATOMY_FOUNDATION_SEED.sources.map((source) => [source.slug, source]))
    const trunkMuscles = [
      "lumbar-erector-spinae",
      "lumbar-multifidus",
      "quadratus-lumborum",
      "rectus-abdominis",
      "external-oblique",
      "internal-oblique",
      "transversus-abdominis",
    ]
    const lumbarFlexors = findMusclesForJointMovement("lumbar-flexion").map((entry) => entry.muscle.slug)
    const lumbarExtensors = findMusclesForJointMovement("lumbar-extension").map((entry) => entry.muscle.slug)
    const lumbarRotators = findMusclesForJointMovement("lumbar-rotation").map((entry) => entry.muscle.slug)
    const lumbarLateralFlexors = findMusclesForJointMovement("lumbar-lateral-flexion").map((entry) => entry.muscle.slug)
    const lumbarStabilizers = findMusclesForJointMovement("lumbar-stabilization").map((entry) => entry.muscle.slug)

    assert.ok(lumbarFlexors.includes("rectus-abdominis"))
    assert.ok(lumbarFlexors.includes("external-oblique"))
    assert.ok(lumbarFlexors.includes("internal-oblique"))
    assert.ok(lumbarExtensors.includes("lumbar-erector-spinae"))
    assert.ok(lumbarRotators.includes("external-oblique"))
    assert.ok(lumbarRotators.includes("internal-oblique"))
    assert.ok(lumbarLateralFlexors.includes("quadratus-lumborum"))
    assert.ok(lumbarStabilizers.includes("lumbar-multifidus"))
    assert.ok(lumbarStabilizers.includes("transversus-abdominis"))
    assert.ok(ANATOMY_FOUNDATION_SEED.structures.some((structure) => structure.slug === "linea-alba" && structure.sourceRef === "applied-human-anatomy"))
    assert.ok(ANATOMY_FOUNDATION_SEED.structures.some((structure) => structure.slug === "rectus-sheath" && structure.sourceRef === "applied-human-anatomy"))

    for (const muscleSlug of trunkMuscles) {
      const muscle = ANATOMY_FOUNDATION_SEED.muscles.find((entry) => entry.slug === muscleSlug)
      const citations = ANATOMY_FOUNDATION_SEED.citations.filter((citation) => citation.entityType === "muscle" && citation.entitySlug === muscleSlug && citation.reviewStatus === "reviewed")
      const citationFactTypes = new Set(citations.map((citation) => citation.factType))
      const terms = ANATOMY_FOUNDATION_SEED.entityTerms.filter((term) => term.anatomyEntityType === "muscle" && term.anatomyEntitySlug === muscleSlug)
      const identifiers = ANATOMY_FOUNDATION_SEED.externalIdentifiers.filter((identifier) => identifier.entityType === "muscle" && identifier.entitySlug === muscleSlug)
      const attachments = ANATOMY_FOUNDATION_SEED.muscleAttachments.filter((attachment) => attachment.muscle === muscleSlug)
      const actions = ANATOMY_FOUNDATION_SEED.muscleActions.filter((action) => action.muscle === muscleSlug)
      const innervation = ANATOMY_FOUNDATION_SEED.muscleInnervations.filter((entry) => entry.muscle === muscleSlug)

      assert.equal(sourceBySlug.get(muscle?.sourceRef ?? "")?.usageScope, "open_reuse", `${muscleSlug} must use an open-reuse source`)
      assert.ok((muscle?.description ?? "").length > 80, `${muscleSlug} needs a MassageLab-authored display summary`)
      assert.ok(terms.some((term) => ["preferred", "formal"].includes(term.termType) && term.sourceRef === "fipat-ta2"), `${muscleSlug} needs FIPAT-backed terminology`)
      assert.ok(identifiers.some((identifier) => ["UBERON", "NCIT", "FMA", "FIPAT"].includes(identifier.provider)), `${muscleSlug} needs an ontology or terminology identifier`)
      assert.ok(attachments.length >= 2, `${muscleSlug} needs origin and insertion facts`)
      assert.ok(attachments.every((attachment) => sourceBySlug.get(attachment.sourceRef)?.usageScope === "open_reuse"), `${muscleSlug} attachments must use open-reuse sources`)
      assert.ok(actions.length >= 1, `${muscleSlug} needs action facts`)
      assert.ok(actions.every((action) => sourceBySlug.get(action.sourceRef)?.usageScope === "open_reuse"), `${muscleSlug} actions must use open-reuse sources`)
      assert.ok(innervation.length >= 1, `${muscleSlug} needs innervation facts`)
      assert.ok(innervation.every((entry) => sourceBySlug.get(entry.sourceRef)?.usageScope === "open_reuse"), `${muscleSlug} innervation must use open-reuse sources`)

      for (const factType of ["clinical_summary", "origin", "insertion", "action", "innervation"]) {
        assert.ok(citationFactTypes.has(factType), `${muscleSlug} needs reviewed ${factType} citation`)
      }

      assert.ok(citations.some((citation) => citation.factType === "official_term" && citation.sourceRef === "fipat-ta2"), `${muscleSlug} needs reviewed official term citation`)
      assert.ok(citations.some((citation) => citation.factType === "external_identifier"), `${muscleSlug} needs reviewed external identifier citation`)
    }

    assert.ok(searchAnatomyFoundation("six pack muscle").some((result) => result.slug === "rectus-abdominis"))
    assert.ok(searchAnatomyFoundation("deep core stabilizer").some((result) => result.slug === "transversus-abdominis"))
    assert.ok(searchAnatomyFoundation("low back extensors").some((result) => result.slug === "lumbar-erector-spinae"))
    assert.equal(findClientTermMapping("ab tightness")?.mappedMuscleSlug, "rectus-abdominis")
    assert.equal(findClientTermMapping("deep core")?.mappedMuscleSlug, "transversus-abdominis")
  })

  it("adds a commercial-safe thoracic breathing mechanics pack", () => {
    const sourceBySlug = new Map(ANATOMY_FOUNDATION_SEED.sources.map((source) => [source.slug, source]))
    const breathingMuscles = [
      "diaphragm",
      "external-intercostals",
      "internal-intercostals",
    ]
    const ribElevators = findMusclesForJointMovement("rib-elevation").map((entry) => entry.muscle.slug)
    const ribDepressors = findMusclesForJointMovement("rib-depression").map((entry) => entry.muscle.slug)
    const chestExpanders = findMusclesForJointMovement("thoracic-cage-expansion").map((entry) => entry.muscle.slug)
    const phrenicMuscles = findMusclesByInnervation("phrenic-nerve").map((muscle) => muscle.slug)
    const intercostalMuscles = findMusclesByInnervation("intercostal-nerves").map((muscle) => muscle.slug)

    assert.ok(chestExpanders.includes("diaphragm"))
    assert.ok(chestExpanders.includes("external-intercostals"))
    assert.ok(ribElevators.includes("external-intercostals"))
    assert.ok(ribDepressors.includes("internal-intercostals"))
    assert.ok(phrenicMuscles.includes("diaphragm"))
    assert.ok(intercostalMuscles.includes("external-intercostals"))
    assert.ok(intercostalMuscles.includes("internal-intercostals"))
    assert.ok(ANATOMY_FOUNDATION_SEED.structures.some((structure) => structure.slug === "central-tendon-of-diaphragm" && structure.sourceRef === "applied-human-anatomy"))
    assert.ok(ANATOMY_FOUNDATION_SEED.structures.some((structure) => structure.slug === "intercostal-space" && structure.sourceRef === "applied-human-anatomy"))

    for (const muscleSlug of breathingMuscles) {
      const muscle = ANATOMY_FOUNDATION_SEED.muscles.find((entry) => entry.slug === muscleSlug)
      const citations = ANATOMY_FOUNDATION_SEED.citations.filter((citation) => citation.entityType === "muscle" && citation.entitySlug === muscleSlug && citation.reviewStatus === "reviewed")
      const citationFactTypes = new Set(citations.map((citation) => citation.factType))
      const terms = ANATOMY_FOUNDATION_SEED.entityTerms.filter((term) => term.anatomyEntityType === "muscle" && term.anatomyEntitySlug === muscleSlug)
      const identifiers = ANATOMY_FOUNDATION_SEED.externalIdentifiers.filter((identifier) => identifier.entityType === "muscle" && identifier.entitySlug === muscleSlug)
      const attachments = ANATOMY_FOUNDATION_SEED.muscleAttachments.filter((attachment) => attachment.muscle === muscleSlug)
      const actions = ANATOMY_FOUNDATION_SEED.muscleActions.filter((action) => action.muscle === muscleSlug)
      const innervation = ANATOMY_FOUNDATION_SEED.muscleInnervations.filter((entry) => entry.muscle === muscleSlug)

      assert.equal(sourceBySlug.get(muscle?.sourceRef ?? "")?.usageScope, "open_reuse", `${muscleSlug} must use an open-reuse source`)
      assert.ok((muscle?.description ?? "").length > 80, `${muscleSlug} needs a MassageLab-authored display summary`)
      assert.ok(terms.some((term) => ["preferred", "formal"].includes(term.termType) && term.sourceRef === "fipat-ta2"), `${muscleSlug} needs FIPAT-backed terminology`)
      assert.ok(identifiers.some((identifier) => ["UBERON", "NCIT", "FMA", "FIPAT"].includes(identifier.provider)), `${muscleSlug} needs an ontology or terminology identifier`)
      assert.ok(attachments.length >= 2, `${muscleSlug} needs origin and insertion facts`)
      assert.ok(attachments.every((attachment) => sourceBySlug.get(attachment.sourceRef)?.usageScope === "open_reuse"), `${muscleSlug} attachments must use open-reuse sources`)
      assert.ok(actions.length >= 1, `${muscleSlug} needs action facts`)
      assert.ok(actions.every((action) => sourceBySlug.get(action.sourceRef)?.usageScope === "open_reuse"), `${muscleSlug} actions must use open-reuse sources`)
      assert.ok(innervation.length >= 1, `${muscleSlug} needs innervation facts`)
      assert.ok(innervation.every((entry) => sourceBySlug.get(entry.sourceRef)?.usageScope === "open_reuse"), `${muscleSlug} innervation must use open-reuse sources`)

      for (const factType of ["clinical_summary", "origin", "insertion", "action", "innervation"]) {
        assert.ok(citationFactTypes.has(factType), `${muscleSlug} needs reviewed ${factType} citation`)
      }

      assert.ok(citations.some((citation) => citation.factType === "official_term" && citation.sourceRef === "fipat-ta2"), `${muscleSlug} needs reviewed official term citation`)
      assert.ok(citations.some((citation) => citation.factType === "external_identifier"), `${muscleSlug} needs reviewed external identifier citation`)
    }

    assert.ok(searchAnatomyFoundation("breathing muscle").some((result) => result.slug === "diaphragm"))
    assert.ok(searchAnatomyFoundation("rib cage muscles").some((result) => result.slug === "external-intercostals"))
    assert.ok(searchAnatomyFoundation("intercostal muscles").some((result) => result.slug === "internal-intercostals"))
    assert.equal(findClientTermMapping("rib cage tightness")?.mappedMuscleSlug, "external-intercostals")
    assert.equal(findClientTermMapping("breathing muscle")?.mappedMuscleSlug, "diaphragm")
  })

  it("adds a commercial-safe TMJ and muscles-of-mastication pack", () => {
    const sourceBySlug = new Map(ANATOMY_FOUNDATION_SEED.sources.map((source) => [source.slug, source]))
    const jawMuscles = [
      "masseter",
      "temporalis",
      "medial-pterygoid",
      "lateral-pterygoid",
    ]
    const jawElevators = findMusclesForJointMovement("jaw-elevation").map((entry) => entry.muscle.slug)
    const jawDepressors = findMusclesForJointMovement("jaw-depression").map((entry) => entry.muscle.slug)
    const jawProtractors = findMusclesForJointMovement("jaw-protraction").map((entry) => entry.muscle.slug)
    const jawRetractors = findMusclesForJointMovement("jaw-retraction").map((entry) => entry.muscle.slug)
    const jawSideToSide = findMusclesForJointMovement("jaw-lateral-deviation").map((entry) => entry.muscle.slug)
    const trigeminalMotorMuscles = findMusclesByInnervation("mandibular-division-trigeminal").map((muscle) => muscle.slug)

    assert.ok(jawElevators.includes("masseter"))
    assert.ok(jawElevators.includes("temporalis"))
    assert.ok(jawElevators.includes("medial-pterygoid"))
    assert.ok(jawDepressors.includes("lateral-pterygoid"))
    assert.ok(jawProtractors.includes("lateral-pterygoid"))
    assert.ok(jawRetractors.includes("temporalis"))
    assert.ok(jawSideToSide.includes("medial-pterygoid"))
    assert.ok(jawSideToSide.includes("lateral-pterygoid"))

    for (const muscleSlug of jawMuscles) {
      assert.ok(trigeminalMotorMuscles.includes(muscleSlug), `${muscleSlug} should be queryable through CN V3 innervation`)

      const muscle = ANATOMY_FOUNDATION_SEED.muscles.find((entry) => entry.slug === muscleSlug)
      const citations = ANATOMY_FOUNDATION_SEED.citations.filter((citation) => citation.entityType === "muscle" && citation.entitySlug === muscleSlug && citation.reviewStatus === "reviewed")
      const citationFactTypes = new Set(citations.map((citation) => citation.factType))
      const terms = ANATOMY_FOUNDATION_SEED.entityTerms.filter((term) => term.anatomyEntityType === "muscle" && term.anatomyEntitySlug === muscleSlug)
      const identifiers = ANATOMY_FOUNDATION_SEED.externalIdentifiers.filter((identifier) => identifier.entityType === "muscle" && identifier.entitySlug === muscleSlug)
      const attachments = ANATOMY_FOUNDATION_SEED.muscleAttachments.filter((attachment) => attachment.muscle === muscleSlug)
      const actions = ANATOMY_FOUNDATION_SEED.muscleActions.filter((action) => action.muscle === muscleSlug)
      const innervation = ANATOMY_FOUNDATION_SEED.muscleInnervations.filter((entry) => entry.muscle === muscleSlug)

      assert.equal(sourceBySlug.get(muscle?.sourceRef ?? "")?.usageScope, "open_reuse", `${muscleSlug} must use an open-reuse source`)
      assert.ok((muscle?.description ?? "").length > 80, `${muscleSlug} needs a MassageLab-authored display summary`)
      assert.ok(terms.some((term) => ["preferred", "formal"].includes(term.termType) && term.sourceRef === "fipat-ta2"), `${muscleSlug} needs FIPAT-backed terminology`)
      assert.ok(identifiers.some((identifier) => ["UBERON", "NCIT"].includes(identifier.provider)), `${muscleSlug} needs a UBERON or NCIT identifier`)
      assert.ok(attachments.length >= 2, `${muscleSlug} needs origin and insertion facts`)
      assert.ok(attachments.every((attachment) => sourceBySlug.get(attachment.sourceRef)?.usageScope === "open_reuse"), `${muscleSlug} attachments must use open-reuse sources`)
      assert.ok(actions.length >= 1, `${muscleSlug} needs action facts`)
      assert.ok(actions.every((action) => sourceBySlug.get(action.sourceRef)?.usageScope === "open_reuse"), `${muscleSlug} actions must use open-reuse sources`)
      assert.ok(innervation.length >= 1, `${muscleSlug} needs innervation facts`)
      assert.ok(innervation.every((entry) => sourceBySlug.get(entry.sourceRef)?.usageScope === "open_reuse"), `${muscleSlug} innervation must use open-reuse sources`)

      for (const factType of ["clinical_summary", "origin", "insertion", "action", "innervation"]) {
        assert.ok(citationFactTypes.has(factType), `${muscleSlug} needs reviewed ${factType} citation`)
      }

      assert.ok(citations.some((citation) => citation.factType === "official_term" && citation.sourceRef === "fipat-ta2"), `${muscleSlug} needs reviewed official term citation`)
      assert.ok(citations.some((citation) => citation.factType === "external_identifier"), `${muscleSlug} needs reviewed external identifier citation`)
    }

    assert.ok(searchAnatomyFoundation("chewing muscle").some((result) => result.slug === "masseter"))
    assert.ok(searchAnatomyFoundation("temple chewing muscle").some((result) => result.slug === "temporalis"))
    assert.ok(searchAnatomyFoundation("jaw opening muscle").some((result) => result.slug === "lateral-pterygoid"))
    assert.equal(findClientTermMapping("jaw clenching")?.mappedMuscleSlug, "masseter")
    assert.equal(findClientTermMapping("chewing muscle tightness")?.mappedMuscleSlug, "temporalis")
  })

  it("adds a commercial-safe facial expression muscle pack", () => {
    const sourceBySlug = new Map(ANATOMY_FOUNDATION_SEED.sources.map((source) => [source.slug, source]))
    const expressionMuscles = [
      "frontalis",
      "orbicularis-oculi",
      "orbicularis-oris",
      "buccinator",
    ]
    const browElevators = findMusclesForJointMovement("brow-elevation").map((entry) => entry.muscle.slug)
    const eyelidClosers = findMusclesForJointMovement("eyelid-closure").map((entry) => entry.muscle.slug)
    const lipClosers = findMusclesForJointMovement("lip-closure").map((entry) => entry.muscle.slug)
    const cheekCompressors = findMusclesForJointMovement("cheek-compression").map((entry) => entry.muscle.slug)
    const facialNerveMuscles = findMusclesByInnervation("facial-nerve").map((muscle) => muscle.slug)

    assert.ok(browElevators.includes("frontalis"))
    assert.ok(eyelidClosers.includes("orbicularis-oculi"))
    assert.ok(lipClosers.includes("orbicularis-oris"))
    assert.ok(cheekCompressors.includes("buccinator"))
    assert.ok(ANATOMY_FOUNDATION_SEED.structures.some((structure) => structure.slug === "epicranial-aponeurosis" && structure.sourceRef === "applied-human-anatomy"))
    assert.ok(ANATOMY_FOUNDATION_SEED.structures.some((structure) => structure.slug === "modiolus-of-mouth" && structure.sourceRef === "applied-human-anatomy"))
    assert.ok(ANATOMY_FOUNDATION_SEED.structures.some((structure) => structure.slug === "pterygomandibular-raphe" && structure.sourceRef === "applied-human-anatomy"))

    for (const muscleSlug of expressionMuscles) {
      assert.ok(facialNerveMuscles.includes(muscleSlug), `${muscleSlug} should be queryable through facial nerve innervation`)

      const muscle = ANATOMY_FOUNDATION_SEED.muscles.find((entry) => entry.slug === muscleSlug)
      const citations = ANATOMY_FOUNDATION_SEED.citations.filter((citation) => citation.entityType === "muscle" && citation.entitySlug === muscleSlug && citation.reviewStatus === "reviewed")
      const citationFactTypes = new Set(citations.map((citation) => citation.factType))
      const terms = ANATOMY_FOUNDATION_SEED.entityTerms.filter((term) => term.anatomyEntityType === "muscle" && term.anatomyEntitySlug === muscleSlug)
      const identifiers = ANATOMY_FOUNDATION_SEED.externalIdentifiers.filter((identifier) => identifier.entityType === "muscle" && identifier.entitySlug === muscleSlug)
      const attachments = ANATOMY_FOUNDATION_SEED.muscleAttachments.filter((attachment) => attachment.muscle === muscleSlug)
      const actions = ANATOMY_FOUNDATION_SEED.muscleActions.filter((action) => action.muscle === muscleSlug)
      const innervation = ANATOMY_FOUNDATION_SEED.muscleInnervations.filter((entry) => entry.muscle === muscleSlug)

      assert.equal(sourceBySlug.get(muscle?.sourceRef ?? "")?.usageScope, "open_reuse", `${muscleSlug} must use an open-reuse source`)
      assert.ok((muscle?.description ?? "").length > 80, `${muscleSlug} needs a MassageLab-authored display summary`)
      assert.ok(terms.some((term) => ["preferred", "formal"].includes(term.termType) && term.sourceRef === "fipat-ta2"), `${muscleSlug} needs FIPAT-backed terminology`)
      assert.ok(identifiers.some((identifier) => ["UBERON", "FMA", "FIPAT"].includes(identifier.provider)), `${muscleSlug} needs a UBERON, FMA, or FIPAT identifier`)
      assert.ok(attachments.length >= 2, `${muscleSlug} needs origin and insertion facts`)
      assert.ok(attachments.every((attachment) => sourceBySlug.get(attachment.sourceRef)?.usageScope === "open_reuse"), `${muscleSlug} attachments must use open-reuse sources`)
      assert.ok(actions.length >= 1, `${muscleSlug} needs action facts`)
      assert.ok(actions.every((action) => sourceBySlug.get(action.sourceRef)?.usageScope === "open_reuse"), `${muscleSlug} actions must use open-reuse sources`)
      assert.ok(innervation.length >= 1, `${muscleSlug} needs innervation facts`)
      assert.ok(innervation.every((entry) => sourceBySlug.get(entry.sourceRef)?.usageScope === "open_reuse"), `${muscleSlug} innervation must use open-reuse sources`)

      for (const factType of ["clinical_summary", "origin", "insertion", "action", "innervation"]) {
        assert.ok(citationFactTypes.has(factType), `${muscleSlug} needs reviewed ${factType} citation`)
      }

      assert.ok(citations.some((citation) => citation.factType === "official_term" && citation.sourceRef === "fipat-ta2"), `${muscleSlug} needs reviewed official term citation`)
      assert.ok(citations.some((citation) => citation.factType === "external_identifier"), `${muscleSlug} needs reviewed external identifier citation`)
    }

    assert.ok(searchAnatomyFoundation("forehead muscle").some((result) => result.slug === "frontalis"))
    assert.ok(searchAnatomyFoundation("eye closing muscle").some((result) => result.slug === "orbicularis-oculi"))
    assert.ok(searchAnatomyFoundation("lip pursing muscle").some((result) => result.slug === "orbicularis-oris"))
    assert.ok(searchAnatomyFoundation("cheek compression muscle").some((result) => result.slug === "buccinator"))
    assert.equal(findClientTermMapping("forehead tension")?.mappedMuscleSlug, "frontalis")
    assert.equal(findClientTermMapping("tight around my eyes")?.mappedMuscleSlug, "orbicularis-oculi")
    assert.equal(findClientTermMapping("lip tension")?.mappedMuscleSlug, "orbicularis-oris")
    assert.equal(findClientTermMapping("cheek tension")?.mappedMuscleSlug, "buccinator")
  })

  it("adds a commercial-safe expanded facial expression and platysma muscle pack", () => {
    const expandedExpressionMuscles = [
      "zygomaticus-major",
      "zygomaticus-minor",
      "levator-labii-superioris",
      "depressor-anguli-oris",
      "depressor-labii-inferioris",
      "mentalis",
      "risorius",
      "nasalis",
      "platysma",
    ]
    const smileContributors = findMusclesForJointMovement("mouth-angle-elevation").map((entry) => entry.muscle.slug)
    const lipElevators = findMusclesForJointMovement("upper-lip-elevation").map((entry) => entry.muscle.slug)
    const lipDepressors = findMusclesForJointMovement("lower-lip-depression").map((entry) => entry.muscle.slug)
    const mouthAngleDepressors = findMusclesForJointMovement("mouth-angle-depression").map((entry) => entry.muscle.slug)
    const nasalMovers = findMusclesForJointMovement("nasal-compression").map((entry) => entry.muscle.slug)
    const facialNerveMuscles = findMusclesByInnervation("facial-nerve").map((muscle) => muscle.slug)

    assert.ok(smileContributors.includes("zygomaticus-major"))
    assert.ok(smileContributors.includes("risorius"))
    assert.ok(lipElevators.includes("zygomaticus-minor"))
    assert.ok(lipElevators.includes("levator-labii-superioris"))
    assert.ok(lipDepressors.includes("depressor-labii-inferioris"))
    assert.ok(lipDepressors.includes("mentalis"))
    assert.ok(mouthAngleDepressors.includes("depressor-anguli-oris"))
    assert.ok(mouthAngleDepressors.includes("platysma"))
    assert.ok(nasalMovers.includes("nasalis"))
    assert.ok(ANATOMY_FOUNDATION_SEED.structures.some((structure) => structure.slug === "facial-expression-muscle-group" && structure.sourceRef === "applied-human-anatomy"))

    for (const muscleSlug of expandedExpressionMuscles) {
      assert.ok(facialNerveMuscles.includes(muscleSlug), `${muscleSlug} should be queryable through facial nerve innervation`)
    }

    assertCommercialSafeMusclePack(expandedExpressionMuscles, { identifierProviders: ["UBERON", "FMA", "FIPAT"] })

    assert.ok(searchAnatomyFoundation("smile muscle").some((result) => result.slug === "zygomaticus-major"))
    assert.ok(searchAnatomyFoundation("chin muscle").some((result) => result.slug === "mentalis"))
    assert.ok(searchAnatomyFoundation("nose muscle").some((result) => result.slug === "nasalis"))
    assert.ok(searchAnatomyFoundation("thin neck sheet").some((result) => result.slug === "platysma"))
    assert.equal(findClientTermMapping("smile muscle tension")?.mappedMuscleSlug, "zygomaticus-major")
    assert.equal(findClientTermMapping("chin tension")?.mappedMuscleSlug, "mentalis")
    assert.equal(findClientTermMapping("front neck skin tension")?.mappedMuscleSlug, "platysma")
  })

  it("adds a commercial-safe lower-limb hip, thigh, and posterior leg pack", () => {
    const sourceBySlug = new Map(ANATOMY_FOUNDATION_SEED.sources.map((source) => [source.slug, source]))
    const lowerLimbMuscles = [
      "gluteus-maximus",
      "gluteus-medius",
      "iliopsoas",
      "rectus-femoris",
      "vastus-medialis",
      "vastus-lateralis",
      "gastrocnemius",
      "soleus",
    ]
    const hipExtensors = findMusclesForJointMovement("hip-extension").map((entry) => entry.muscle.slug)
    const hipAbductors = findMusclesForJointMovement("hip-abduction").map((entry) => entry.muscle.slug)
    const kneeExtensors = findMusclesForJointMovement("knee-extension").map((entry) => entry.muscle.slug)
    const plantarflexors = findMusclesForJointMovement("ankle-plantarflexion").map((entry) => entry.muscle.slug)

    assert.ok(hipExtensors.includes("gluteus-maximus"))
    assert.ok(hipAbductors.includes("gluteus-medius"))
    assert.ok(kneeExtensors.includes("rectus-femoris"))
    assert.ok(kneeExtensors.includes("vastus-medialis"))
    assert.ok(kneeExtensors.includes("vastus-lateralis"))
    assert.ok(plantarflexors.includes("gastrocnemius"))
    assert.ok(plantarflexors.includes("soleus"))

    for (const muscleSlug of lowerLimbMuscles) {
      const muscle = ANATOMY_FOUNDATION_SEED.muscles.find((entry) => entry.slug === muscleSlug)
      const citations = ANATOMY_FOUNDATION_SEED.citations.filter((citation) => citation.entityType === "muscle" && citation.entitySlug === muscleSlug && citation.reviewStatus === "reviewed")
      const citationFactTypes = new Set(citations.map((citation) => citation.factType))
      const terms = ANATOMY_FOUNDATION_SEED.entityTerms.filter((term) => term.anatomyEntityType === "muscle" && term.anatomyEntitySlug === muscleSlug)
      const identifiers = ANATOMY_FOUNDATION_SEED.externalIdentifiers.filter((identifier) => identifier.entityType === "muscle" && identifier.entitySlug === muscleSlug)
      const attachments = ANATOMY_FOUNDATION_SEED.muscleAttachments.filter((attachment) => attachment.muscle === muscleSlug)
      const actions = ANATOMY_FOUNDATION_SEED.muscleActions.filter((action) => action.muscle === muscleSlug)
      const innervation = ANATOMY_FOUNDATION_SEED.muscleInnervations.filter((entry) => entry.muscle === muscleSlug)

      assert.equal(sourceBySlug.get(muscle?.sourceRef ?? "")?.usageScope, "open_reuse", `${muscleSlug} must use an open-reuse source`)
      assert.ok((muscle?.description ?? "").length > 80, `${muscleSlug} needs a MassageLab-authored display summary`)
      assert.ok(terms.some((term) => ["preferred", "formal"].includes(term.termType) && term.sourceRef === "fipat-ta2"), `${muscleSlug} needs FIPAT-backed terminology`)
      assert.ok(identifiers.some((identifier) => ["UBERON", "NCIT"].includes(identifier.provider)), `${muscleSlug} needs a UBERON or NCIT identifier`)
      assert.ok(attachments.length >= 2, `${muscleSlug} needs origin and insertion facts`)
      assert.ok(attachments.every((attachment) => sourceBySlug.get(attachment.sourceRef)?.usageScope === "open_reuse"), `${muscleSlug} attachments must use open-reuse sources`)
      assert.ok(actions.length >= 1, `${muscleSlug} needs action facts`)
      assert.ok(actions.every((action) => sourceBySlug.get(action.sourceRef)?.usageScope === "open_reuse"), `${muscleSlug} actions must use open-reuse sources`)
      assert.ok(innervation.length >= 1, `${muscleSlug} needs innervation facts`)
      assert.ok(innervation.every((entry) => sourceBySlug.get(entry.sourceRef)?.usageScope === "open_reuse"), `${muscleSlug} innervation must use open-reuse sources`)

      for (const factType of ["clinical_summary", "origin", "insertion", "action", "innervation"]) {
        assert.ok(citationFactTypes.has(factType), `${muscleSlug} needs reviewed ${factType} citation`)
      }

      assert.ok(citations.some((citation) => citation.factType === "official_term" && citation.sourceRef === "fipat-ta2"), `${muscleSlug} needs reviewed official term citation`)
      assert.ok(citations.some((citation) => citation.factType === "external_identifier"), `${muscleSlug} needs reviewed external identifier citation`)
    }

    assert.ok(searchAnatomyFoundation("lateral hip stabilizer").some((result) => result.slug === "gluteus-medius"))
    assert.ok(searchAnatomyFoundation("calf plantarflexor").some((result) => result.slug === "gastrocnemius"))
  })

  it("adds a commercial-safe hamstring and medial-thigh pack", () => {
    const sourceBySlug = new Map(ANATOMY_FOUNDATION_SEED.sources.map((source) => [source.slug, source]))
    const thighMuscles = [
      "biceps-femoris",
      "semitendinosus",
      "semimembranosus",
      "adductor-longus",
      "adductor-brevis",
      "adductor-magnus",
      "gracilis",
      "sartorius",
      "pectineus",
      "tensor-fasciae-latae",
    ]
    const kneeFlexors = findMusclesForJointMovement("knee-flexion").map((entry) => entry.muscle.slug)
    const hipExtensors = findMusclesForJointMovement("hip-extension").map((entry) => entry.muscle.slug)
    const hipAdductors = findMusclesForJointMovement("hip-adduction").map((entry) => entry.muscle.slug)
    const hipFlexors = findMusclesForJointMovement("hip-flexion").map((entry) => entry.muscle.slug)
    const hipAbductors = findMusclesForJointMovement("hip-abduction").map((entry) => entry.muscle.slug)

    assert.ok(kneeFlexors.includes("biceps-femoris"))
    assert.ok(kneeFlexors.includes("semitendinosus"))
    assert.ok(kneeFlexors.includes("semimembranosus"))
    assert.ok(kneeFlexors.includes("gracilis"))
    assert.ok(kneeFlexors.includes("sartorius"))
    assert.ok(hipExtensors.includes("biceps-femoris"))
    assert.ok(hipExtensors.includes("semitendinosus"))
    assert.ok(hipExtensors.includes("semimembranosus"))
    assert.ok(hipExtensors.includes("adductor-magnus"))
    assert.ok(hipAdductors.includes("adductor-longus"))
    assert.ok(hipAdductors.includes("adductor-brevis"))
    assert.ok(hipAdductors.includes("adductor-magnus"))
    assert.ok(hipAdductors.includes("gracilis"))
    assert.ok(hipFlexors.includes("sartorius"))
    assert.ok(hipFlexors.includes("pectineus"))
    assert.ok(hipAbductors.includes("tensor-fasciae-latae"))

    for (const muscleSlug of thighMuscles) {
      const muscle = ANATOMY_FOUNDATION_SEED.muscles.find((entry) => entry.slug === muscleSlug)
      const citations = ANATOMY_FOUNDATION_SEED.citations.filter((citation) => citation.entityType === "muscle" && citation.entitySlug === muscleSlug && citation.reviewStatus === "reviewed")
      const citationFactTypes = new Set(citations.map((citation) => citation.factType))
      const terms = ANATOMY_FOUNDATION_SEED.entityTerms.filter((term) => term.anatomyEntityType === "muscle" && term.anatomyEntitySlug === muscleSlug)
      const identifiers = ANATOMY_FOUNDATION_SEED.externalIdentifiers.filter((identifier) => identifier.entityType === "muscle" && identifier.entitySlug === muscleSlug)
      const attachments = ANATOMY_FOUNDATION_SEED.muscleAttachments.filter((attachment) => attachment.muscle === muscleSlug)
      const actions = ANATOMY_FOUNDATION_SEED.muscleActions.filter((action) => action.muscle === muscleSlug)
      const innervation = ANATOMY_FOUNDATION_SEED.muscleInnervations.filter((entry) => entry.muscle === muscleSlug)

      assert.equal(sourceBySlug.get(muscle?.sourceRef ?? "")?.usageScope, "open_reuse", `${muscleSlug} must use an open-reuse source`)
      assert.ok((muscle?.description ?? "").length > 80, `${muscleSlug} needs a MassageLab-authored display summary`)
      assert.ok(terms.some((term) => ["preferred", "formal"].includes(term.termType) && term.sourceRef === "fipat-ta2"), `${muscleSlug} needs FIPAT-backed terminology`)
      assert.ok(identifiers.some((identifier) => ["UBERON", "NCIT"].includes(identifier.provider)), `${muscleSlug} needs a UBERON or NCIT identifier`)
      assert.ok(attachments.length >= 2, `${muscleSlug} needs origin and insertion facts`)
      assert.ok(attachments.every((attachment) => sourceBySlug.get(attachment.sourceRef)?.usageScope === "open_reuse"), `${muscleSlug} attachments must use open-reuse sources`)
      assert.ok(actions.length >= 1, `${muscleSlug} needs action facts`)
      assert.ok(actions.every((action) => sourceBySlug.get(action.sourceRef)?.usageScope === "open_reuse"), `${muscleSlug} actions must use open-reuse sources`)
      assert.ok(innervation.length >= 1, `${muscleSlug} needs innervation facts`)
      assert.ok(innervation.every((entry) => sourceBySlug.get(entry.sourceRef)?.usageScope === "open_reuse"), `${muscleSlug} innervation must use open-reuse sources`)

      for (const factType of ["clinical_summary", "origin", "insertion", "action", "innervation"]) {
        assert.ok(citationFactTypes.has(factType), `${muscleSlug} needs reviewed ${factType} citation`)
      }
    }

    assert.ok(searchAnatomyFoundation("tailor muscle").some((result) => result.slug === "sartorius"))
    assert.ok(searchAnatomyFoundation("inner thigh adductor").some((result) => result.slug === "adductor-longus"))
    assert.ok(searchAnatomyFoundation("outer hip IT band muscle").some((result) => result.slug === "tensor-fasciae-latae"))
    assert.equal(findClientTermMapping("hamstring tightness")?.mappedRegionSlug, "thigh")
    assert.equal(findClientTermMapping("inner thigh tightness")?.mappedMuscleSlug, "adductor-longus")
  })

  it("adds a commercial-safe ankle and foot mechanics pack", () => {
    const sourceBySlug = new Map(ANATOMY_FOUNDATION_SEED.sources.map((source) => [source.slug, source]))
    const ankleFootMuscles = [
      "tibialis-anterior",
      "fibularis-longus",
      "tibialis-posterior",
      "fibularis-brevis",
      "extensor-digitorum-longus",
      "flexor-digitorum-longus",
    ]
    const dorsiflexors = findMusclesForJointMovement("ankle-dorsiflexion").map((entry) => entry.muscle.slug)
    const inverters = findMusclesForJointMovement("foot-inversion").map((entry) => entry.muscle.slug)
    const everters = findMusclesForJointMovement("foot-eversion").map((entry) => entry.muscle.slug)
    const toeExtensors = findMusclesForJointMovement("toe-extension").map((entry) => entry.muscle.slug)
    const toeFlexors = findMusclesForJointMovement("toe-flexion").map((entry) => entry.muscle.slug)

    assert.ok(ANATOMY_FOUNDATION_SEED.jointMovements.some((movement) => movement.slug === "toe-extension"))
    assert.ok(ANATOMY_FOUNDATION_SEED.jointMovements.some((movement) => movement.slug === "toe-flexion"))
    assert.ok(dorsiflexors.includes("tibialis-anterior"))
    assert.ok(dorsiflexors.includes("extensor-digitorum-longus"))
    assert.ok(inverters.includes("tibialis-anterior"))
    assert.ok(inverters.includes("tibialis-posterior"))
    assert.ok(everters.includes("fibularis-longus"))
    assert.ok(everters.includes("fibularis-brevis"))
    assert.ok(toeExtensors.includes("extensor-digitorum-longus"))
    assert.ok(toeFlexors.includes("flexor-digitorum-longus"))

    for (const muscleSlug of ankleFootMuscles) {
      const muscle = ANATOMY_FOUNDATION_SEED.muscles.find((entry) => entry.slug === muscleSlug)
      const citations = ANATOMY_FOUNDATION_SEED.citations.filter((citation) => citation.entityType === "muscle" && citation.entitySlug === muscleSlug && citation.reviewStatus === "reviewed")
      const citationFactTypes = new Set(citations.map((citation) => citation.factType))
      const terms = ANATOMY_FOUNDATION_SEED.entityTerms.filter((term) => term.anatomyEntityType === "muscle" && term.anatomyEntitySlug === muscleSlug)
      const identifiers = ANATOMY_FOUNDATION_SEED.externalIdentifiers.filter((identifier) => identifier.entityType === "muscle" && identifier.entitySlug === muscleSlug)
      const attachments = ANATOMY_FOUNDATION_SEED.muscleAttachments.filter((attachment) => attachment.muscle === muscleSlug)
      const actions = ANATOMY_FOUNDATION_SEED.muscleActions.filter((action) => action.muscle === muscleSlug)
      const innervation = ANATOMY_FOUNDATION_SEED.muscleInnervations.filter((entry) => entry.muscle === muscleSlug)

      assert.equal(sourceBySlug.get(muscle?.sourceRef ?? "")?.usageScope, "open_reuse", `${muscleSlug} must use an open-reuse source`)
      assert.ok((muscle?.description ?? "").length > 80, `${muscleSlug} needs a MassageLab-authored display summary`)
      assert.ok(terms.some((term) => ["preferred", "formal"].includes(term.termType) && term.sourceRef === "fipat-ta2"), `${muscleSlug} needs FIPAT-backed terminology`)
      assert.ok(identifiers.some((identifier) => ["UBERON", "NCIT"].includes(identifier.provider)), `${muscleSlug} needs a UBERON or NCIT identifier`)
      assert.ok(attachments.length >= 2, `${muscleSlug} needs origin and insertion facts`)
      assert.ok(attachments.every((attachment) => sourceBySlug.get(attachment.sourceRef)?.usageScope === "open_reuse"), `${muscleSlug} attachments must use open-reuse sources`)
      assert.ok(actions.length >= 1, `${muscleSlug} needs action facts`)
      assert.ok(actions.every((action) => sourceBySlug.get(action.sourceRef)?.usageScope === "open_reuse"), `${muscleSlug} actions must use open-reuse sources`)
      assert.ok(innervation.length >= 1, `${muscleSlug} needs innervation facts`)
      assert.ok(innervation.every((entry) => sourceBySlug.get(entry.sourceRef)?.usageScope === "open_reuse"), `${muscleSlug} innervation must use open-reuse sources`)

      for (const factType of ["clinical_summary", "origin", "insertion", "action", "innervation"]) {
        assert.ok(citationFactTypes.has(factType), `${muscleSlug} needs reviewed ${factType} citation`)
      }
    }

    assert.ok(searchAnatomyFoundation("shin muscle").some((result) => result.slug === "tibialis-anterior"))
    assert.ok(searchAnatomyFoundation("arch support inverter").some((result) => result.slug === "tibialis-posterior"))
  })

  it("adds a commercial-safe deep hip rotator pack", () => {
    const hipRotatorMuscles = [
      "piriformis",
      "obturator-internus",
      "superior-gemellus",
      "inferior-gemellus",
      "quadratus-femoris",
    ]
    const hipExternalRotators = findMusclesForJointMovement("hip-external-rotation").map((entry) => entry.muscle.slug)
    const piriformisInnervation = findMusclesByInnervation("nerve-to-piriformis").map((muscle) => muscle.slug)
    const obturatorInternusInnervation = findMusclesByInnervation("nerve-to-obturator-internus").map((muscle) => muscle.slug)
    const quadratusFemorisInnervation = findMusclesByInnervation("nerve-to-quadratus-femoris").map((muscle) => muscle.slug)

    for (const muscleSlug of hipRotatorMuscles) {
      assert.ok(hipExternalRotators.includes(muscleSlug), `${muscleSlug} should contribute to hip external rotation`)
    }

    assert.ok(piriformisInnervation.includes("piriformis"))
    assert.ok(obturatorInternusInnervation.includes("obturator-internus"))
    assert.ok(obturatorInternusInnervation.includes("superior-gemellus"))
    assert.ok(quadratusFemorisInnervation.includes("inferior-gemellus"))
    assert.ok(quadratusFemorisInnervation.includes("quadratus-femoris"))
    assert.ok(ANATOMY_FOUNDATION_SEED.structures.some((structure) => structure.slug === "deep-gluteal-space" && structure.sourceRef === "applied-human-anatomy"))
    assert.ok(ANATOMY_FOUNDATION_SEED.structures.some((structure) => structure.slug === "triceps-coxae" && structure.sourceRef === "applied-human-anatomy"))

    assertCommercialSafeMusclePack(hipRotatorMuscles, { identifierProviders: ["UBERON", "FMA", "FIPAT"] })

    assert.ok(searchAnatomyFoundation("deep gluteal rotators").some((result) => result.slug === "piriformis"))
    assert.ok(searchAnatomyFoundation("triceps coxae").some((result) => result.slug === "obturator-internus"))
    assert.ok(searchAnatomyFoundation("deep buttock muscle").some((result) => result.slug === "quadratus-femoris"))
    assert.equal(findClientTermMapping("deep buttock tightness")?.mappedMuscleSlug, "piriformis")
    assert.equal(findClientTermMapping("sit bone deep hip tightness")?.mappedMuscleSlug, "quadratus-femoris")
  })

  it("adds a commercial-safe hallux and anterior ankle tendon pack", () => {
    const halluxTendonMuscles = [
      "flexor-hallucis-longus",
      "extensor-hallucis-longus",
      "fibularis-tertius",
    ]
    const halluxFlexors = findMusclesForJointMovement("hallux-flexion").map((entry) => entry.muscle.slug)
    const halluxExtensors = findMusclesForJointMovement("hallux-extension").map((entry) => entry.muscle.slug)
    const dorsiflexors = findMusclesForJointMovement("ankle-dorsiflexion").map((entry) => entry.muscle.slug)
    const everters = findMusclesForJointMovement("foot-eversion").map((entry) => entry.muscle.slug)
    const tibialMuscles = findMusclesByInnervation("tibial-nerve").map((muscle) => muscle.slug)
    const deepFibularMuscles = findMusclesByInnervation("deep-fibular-nerve").map((muscle) => muscle.slug)

    assert.ok(halluxFlexors.includes("flexor-hallucis-longus"))
    assert.ok(halluxExtensors.includes("extensor-hallucis-longus"))
    assert.ok(dorsiflexors.includes("extensor-hallucis-longus"))
    assert.ok(dorsiflexors.includes("fibularis-tertius"))
    assert.ok(everters.includes("fibularis-tertius"))
    assert.ok(tibialMuscles.includes("flexor-hallucis-longus"))
    assert.ok(deepFibularMuscles.includes("extensor-hallucis-longus"))
    assert.ok(deepFibularMuscles.includes("fibularis-tertius"))
    assert.ok(ANATOMY_FOUNDATION_SEED.structures.some((structure) => structure.slug === "flexor-hallucis-longus-tendon" && structure.sourceRef === "applied-human-anatomy"))
    assert.ok(ANATOMY_FOUNDATION_SEED.structures.some((structure) => structure.slug === "extensor-hallucis-longus-tendon" && structure.sourceRef === "applied-human-anatomy"))

    assertCommercialSafeMusclePack(halluxTendonMuscles, { identifierProviders: ["UBERON", "FMA", "FIPAT"] })

    assert.ok(searchAnatomyFoundation("big toe flexor").some((result) => result.slug === "flexor-hallucis-longus"))
    assert.ok(searchAnatomyFoundation("big toe extensor").some((result) => result.slug === "extensor-hallucis-longus"))
    assert.ok(searchAnatomyFoundation("front ankle tendon").some((result) => result.slug === "extensor-hallucis-longus"))
    assert.equal(findClientTermMapping("big toe tendon tightness")?.mappedMuscleSlug, "flexor-hallucis-longus")
    assert.equal(findClientTermMapping("front ankle tightness")?.mappedMuscleSlug, "extensor-hallucis-longus")
  })

  it("adds a commercial-safe intrinsic plantar foot muscle pack", () => {
    const plantarMuscles = [
      "abductor-hallucis",
      "flexor-hallucis-brevis-foot",
      "flexor-digitorum-brevis-foot",
      "dorsal-interossei-foot",
      "plantar-interossei-foot",
    ]
    const halluxAbductors = findMusclesForJointMovement("hallux-abduction").map((entry) => entry.muscle.slug)
    const halluxFlexors = findMusclesForJointMovement("hallux-flexion").map((entry) => entry.muscle.slug)
    const toeFlexors = findMusclesForJointMovement("toe-flexion").map((entry) => entry.muscle.slug)
    const toeAbductors = findMusclesForJointMovement("toe-abduction").map((entry) => entry.muscle.slug)
    const toeAdductors = findMusclesForJointMovement("toe-adduction").map((entry) => entry.muscle.slug)
    const medialPlantarMuscles = findMusclesByInnervation("medial-plantar-nerve").map((muscle) => muscle.slug)
    const lateralPlantarMuscles = findMusclesByInnervation("lateral-plantar-nerve").map((muscle) => muscle.slug)

    assert.ok(halluxAbductors.includes("abductor-hallucis"))
    assert.ok(halluxFlexors.includes("flexor-hallucis-brevis-foot"))
    assert.ok(toeFlexors.includes("flexor-digitorum-brevis-foot"))
    assert.ok(toeAbductors.includes("dorsal-interossei-foot"))
    assert.ok(toeAdductors.includes("plantar-interossei-foot"))
    assert.ok(medialPlantarMuscles.includes("abductor-hallucis"))
    assert.ok(medialPlantarMuscles.includes("flexor-hallucis-brevis-foot"))
    assert.ok(lateralPlantarMuscles.includes("dorsal-interossei-foot"))
    assert.ok(lateralPlantarMuscles.includes("plantar-interossei-foot"))
    assert.ok(ANATOMY_FOUNDATION_SEED.structures.some((structure) => structure.slug === "medial-plantar-compartment" && structure.sourceRef === "applied-human-anatomy"))
    assert.ok(ANATOMY_FOUNDATION_SEED.structures.some((structure) => structure.slug === "central-plantar-compartment" && structure.sourceRef === "applied-human-anatomy"))

    assertCommercialSafeMusclePack(plantarMuscles, { identifierProviders: ["UBERON", "FMA", "FIPAT"] })

    assert.ok(searchAnatomyFoundation("arch muscle").some((result) => result.slug === "abductor-hallucis"))
    assert.ok(searchAnatomyFoundation("short toe flexor").some((result) => result.slug === "flexor-digitorum-brevis-foot"))
    assert.ok(searchAnatomyFoundation("toe spread muscles").some((result) => result.slug === "dorsal-interossei-foot"))
    assert.equal(findClientTermMapping("arch muscle tightness")?.mappedMuscleSlug, "abductor-hallucis")
    assert.equal(findClientTermMapping("ball of foot tightness")?.mappedMuscleSlug, "flexor-digitorum-brevis-foot")
  })

  it("adds a commercial-safe second-layer and lateral plantar foot pack", () => {
    const plantarLayerMuscles = [
      "quadratus-plantae",
      "lumbricals-foot",
      "abductor-digiti-minimi-foot",
      "flexor-digiti-minimi-brevis-foot",
    ]
    const toeFlexors = findMusclesForJointMovement("toe-flexion").map((entry) => entry.muscle.slug)
    const toeAbductors = findMusclesForJointMovement("toe-abduction").map((entry) => entry.muscle.slug)
    const medialPlantarMuscles = findMusclesByInnervation("medial-plantar-nerve").map((muscle) => muscle.slug)
    const lateralPlantarMuscles = findMusclesByInnervation("lateral-plantar-nerve").map((muscle) => muscle.slug)

    assert.ok(toeFlexors.includes("quadratus-plantae"))
    assert.ok(toeFlexors.includes("lumbricals-foot"))
    assert.ok(toeFlexors.includes("flexor-digiti-minimi-brevis-foot"))
    assert.ok(toeAbductors.includes("abductor-digiti-minimi-foot"))
    assert.ok(lateralPlantarMuscles.includes("quadratus-plantae"))
    assert.ok(lateralPlantarMuscles.includes("abductor-digiti-minimi-foot"))
    assert.ok(lateralPlantarMuscles.includes("flexor-digiti-minimi-brevis-foot"))
    assert.ok(lateralPlantarMuscles.includes("lumbricals-foot"))
    assert.ok(medialPlantarMuscles.includes("lumbricals-foot"))
    assert.ok(ANATOMY_FOUNDATION_SEED.structures.some((structure) => structure.slug === "flexor-digitorum-longus-tendons" && structure.sourceRef === "applied-human-anatomy"))
    assert.ok(ANATOMY_FOUNDATION_SEED.structures.some((structure) => structure.slug === "plantar-extensor-expansions" && structure.sourceRef === "applied-human-anatomy"))
    assert.ok(ANATOMY_FOUNDATION_SEED.structures.some((structure) => structure.slug === "lateral-plantar-compartment" && structure.sourceRef === "applied-human-anatomy"))
    assert.ok(ANATOMY_FOUNDATION_SEED.relationships.some((relationship) => relationship.sourceEntitySlug === "quadratus-plantae" && relationship.relationshipType === "acts_on" && relationship.targetEntitySlug === "flexor-digitorum-longus-tendons"))
    assert.ok(ANATOMY_FOUNDATION_SEED.relationships.some((relationship) => relationship.sourceEntitySlug === "lateral-plantar-artery" && relationship.relationshipType === "supplies" && relationship.targetEntitySlug === "abductor-digiti-minimi-foot"))

    assertCommercialSafeMusclePack(plantarLayerMuscles, { identifierProviders: ["FMA", "FIPAT"] })

    assert.ok(searchAnatomyFoundation("toe coordination muscles").some((result) => result.slug === "lumbricals-foot"))
    assert.ok(searchAnatomyFoundation("little toe side muscle").some((result) => result.slug === "abductor-digiti-minimi-foot"))
    assert.equal(findClientTermMapping("toe gripping arch tightness")?.mappedMuscleSlug, "quadratus-plantae")
    assert.equal(findClientTermMapping("little toe side tightness")?.mappedMuscleSlug, "abductor-digiti-minimi-foot")
  })

  it("adds a commercial-safe anterior and lateral hip stabilizer pack", () => {
    const hipStabilizerMuscles = [
      "gluteus-minimus",
      "psoas-major",
      "iliacus",
      "obturator-externus",
    ]
    const hipInternalRotators = findMusclesForJointMovement("hip-internal-rotation").map((entry) => entry.muscle.slug)
    const hipFlexors = findMusclesForJointMovement("hip-flexion").map((entry) => entry.muscle.slug)
    const hipExternalRotators = findMusclesForJointMovement("hip-external-rotation").map((entry) => entry.muscle.slug)
    const superiorGlutealMuscles = findMusclesByInnervation("superior-gluteal-nerve").map((muscle) => muscle.slug)
    const femoralMuscles = findMusclesByInnervation("femoral-nerve").map((muscle) => muscle.slug)
    const obturatorMuscles = findMusclesByInnervation("obturator-nerve").map((muscle) => muscle.slug)

    assert.ok(hipInternalRotators.includes("gluteus-minimus"))
    assert.ok(hipFlexors.includes("psoas-major"))
    assert.ok(hipFlexors.includes("iliacus"))
    assert.ok(hipExternalRotators.includes("obturator-externus"))
    assert.ok(superiorGlutealMuscles.includes("gluteus-minimus"))
    assert.ok(femoralMuscles.includes("iliacus"))
    assert.ok(obturatorMuscles.includes("obturator-externus"))
    assert.ok(ANATOMY_FOUNDATION_SEED.structures.some((structure) => structure.slug === "iliopsoas-tendon" && structure.sourceRef === "applied-human-anatomy"))
    assert.ok(ANATOMY_FOUNDATION_SEED.structures.some((structure) => structure.slug === "anterior-hip-capsule" && structure.sourceRef === "applied-human-anatomy"))

    assertCommercialSafeMusclePack(hipStabilizerMuscles, { identifierProviders: ["UBERON", "FMA", "FIPAT", "NCIT"] })

    assert.ok(searchAnatomyFoundation("deep side hip stabilizer").some((result) => result.slug === "gluteus-minimus"))
    assert.ok(searchAnatomyFoundation("front hip flexor").some((result) => result.slug === "psoas-major"))
    assert.ok(searchAnatomyFoundation("external obturator").some((result) => result.slug === "obturator-externus"))
    assert.equal(findClientTermMapping("deep front hip tightness")?.mappedMuscleSlug, "psoas-major")
    assert.equal(findClientTermMapping("side hip stabilizer tightness")?.mappedMuscleSlug, "gluteus-minimus")
  })

  it("adds a commercial-safe quadriceps tendon and knee extensor apparatus pack", () => {
    const kneeExtensorMuscles = [
      "vastus-intermedius",
      "articularis-genus",
    ]
    const kneeExtensors = findMusclesForJointMovement("knee-extension").map((entry) => entry.muscle.slug)
    const femoralMuscles = findMusclesByInnervation("femoral-nerve").map((muscle) => muscle.slug)

    assert.ok(kneeExtensors.includes("vastus-intermedius"))
    assert.ok(kneeExtensors.includes("articularis-genus"))
    assert.ok(femoralMuscles.includes("vastus-intermedius"))
    assert.ok(femoralMuscles.includes("articularis-genus"))
    assert.ok(ANATOMY_FOUNDATION_SEED.structures.some((structure) => structure.slug === "quadriceps-tendon" && structure.sourceRef === "applied-human-anatomy"))
    assert.ok(ANATOMY_FOUNDATION_SEED.structures.some((structure) => structure.slug === "patellar-tendon" && structure.sourceRef === "applied-human-anatomy"))
    assert.ok(ANATOMY_FOUNDATION_SEED.structures.some((structure) => structure.slug === "suprapatellar-bursa" && structure.sourceRef === "applied-human-anatomy"))

    assertCommercialSafeMusclePack(kneeExtensorMuscles, { identifierProviders: ["UBERON", "FMA", "FIPAT"] })

    assert.ok(searchAnatomyFoundation("deep quad").some((result) => result.slug === "vastus-intermedius"))
    assert.ok(searchAnatomyFoundation("kneecap tendon").some((result) => result.slug === "patellar-tendon"))
    assert.ok(searchAnatomyFoundation("suprapatellar bursa").some((result) => result.slug === "articularis-genus"))
    assert.equal(findClientTermMapping("front thigh tightness")?.mappedMuscleSlug, "vastus-intermedius")
    assert.equal(findClientTermMapping("kneecap tendon tightness")?.mappedStructureSlug, "patellar-tendon")
  })

  it("adds a commercial-safe posterior knee and plantaris mechanics pack", () => {
    const posteriorKneeMuscles = [
      "plantaris",
      "popliteus",
    ]
    const kneeFlexors = findMusclesForJointMovement("knee-flexion").map((entry) => entry.muscle.slug)
    const kneeInternalRotators = findMusclesForJointMovement("knee-internal-rotation").map((entry) => entry.muscle.slug)
    const plantarflexors = findMusclesForJointMovement("ankle-plantarflexion").map((entry) => entry.muscle.slug)
    const tibialMuscles = findMusclesByInnervation("tibial-nerve").map((muscle) => muscle.slug)

    assert.ok(kneeFlexors.includes("plantaris"))
    assert.ok(kneeInternalRotators.includes("popliteus"))
    assert.ok(plantarflexors.includes("plantaris"))
    assert.ok(tibialMuscles.includes("plantaris"))
    assert.ok(tibialMuscles.includes("popliteus"))
    assert.ok(ANATOMY_FOUNDATION_SEED.structures.some((structure) => structure.slug === "plantaris-tendon" && structure.sourceRef === "applied-human-anatomy"))
    assert.ok(ANATOMY_FOUNDATION_SEED.structures.some((structure) => structure.slug === "popliteal-fossa" && structure.sourceRef === "applied-human-anatomy"))
    assert.ok(ANATOMY_FOUNDATION_SEED.bloodSupply.some((bloodSupply) => bloodSupply.slug === "popliteal-vein" && bloodSupply.kind === "vein"))

    assertCommercialSafeMusclePack(posteriorKneeMuscles, { identifierProviders: ["UBERON", "FMA", "FIPAT", "NCIT"] })

    assert.ok(searchAnatomyFoundation("back of knee unlock muscle").some((result) => result.slug === "popliteus"))
    assert.ok(searchAnatomyFoundation("thin calf tendon").some((result) => result.slug === "plantaris"))
    assert.equal(findClientTermMapping("back of knee tightness")?.mappedMuscleSlug, "popliteus")
    assert.equal(findClientTermMapping("calf cord tightness")?.mappedMuscleSlug, "plantaris")
  })

  it("adds a commercial-safe long-thumb tendon and lumbrical hand pack", () => {
    const thumbAndIntrinsicMuscles = [
      "flexor-pollicis-longus",
      "abductor-pollicis-longus",
      "extensor-pollicis-brevis",
      "extensor-pollicis-longus",
      "lumbricals-hand",
    ]
    const thumbFlexors = findMusclesForJointMovement("thumb-flexion").map((entry) => entry.muscle.slug)
    const thumbAbductors = findMusclesForJointMovement("thumb-abduction").map((entry) => entry.muscle.slug)
    const thumbExtensors = findMusclesForJointMovement("thumb-extension").map((entry) => entry.muscle.slug)
    const fingerFlexors = findMusclesForJointMovement("finger-flexion").map((entry) => entry.muscle.slug)
    const fingerExtensors = findMusclesForJointMovement("finger-extension").map((entry) => entry.muscle.slug)

    assert.ok(thumbFlexors.includes("flexor-pollicis-longus"))
    assert.ok(thumbAbductors.includes("abductor-pollicis-longus"))
    assert.ok(thumbExtensors.includes("extensor-pollicis-brevis"))
    assert.ok(thumbExtensors.includes("extensor-pollicis-longus"))
    assert.ok(fingerFlexors.includes("lumbricals-hand"))
    assert.ok(fingerExtensors.includes("lumbricals-hand"))
    assert.ok(findMusclesByInnervation("median-nerve").some((entry) => entry.slug === "flexor-pollicis-longus"))
    assert.ok(findMusclesByInnervation("radial-nerve").some((entry) => entry.slug === "extensor-pollicis-longus"))
    assert.ok(findMusclesByInnervation("deep-branch-ulnar-nerve").some((entry) => entry.slug === "lumbricals-hand"))
    assert.ok(ANATOMY_FOUNDATION_SEED.structures.some((structure) => structure.slug === "anatomic-snuffbox" && structure.sourceRef === "applied-human-anatomy"))
    assert.ok(ANATOMY_FOUNDATION_SEED.structures.some((structure) => structure.slug === "flexor-pollicis-longus-tendon" && structure.sourceRef === "applied-human-anatomy"))

    assertCommercialSafeMusclePack(thumbAndIntrinsicMuscles)

    assert.ok(searchAnatomyFoundation("long thumb extensor").some((result) => result.slug === "extensor-pollicis-longus"))
    assert.ok(searchAnatomyFoundation("anatomic snuffbox").some((result) => result.slug === "anatomic-snuffbox"))
    assert.ok(searchAnatomyFoundation("lumbrical grip").some((result) => result.slug === "lumbricals-hand"))
    assert.equal(findClientTermMapping("thumb tendon tightness")?.mappedMuscleSlug, "extensor-pollicis-longus")
    assert.equal(findClientTermMapping("finger knuckle tightness")?.mappedMuscleSlug, "lumbricals-hand")
  })

  it("adds a commercial-safe anterior neck and hyoid mechanics pack", () => {
    const hyoidMuscles = [
      "digastric",
      "mylohyoid",
      "sternohyoid",
      "omohyoid",
    ]
    const jawDepressors = findMusclesForJointMovement("jaw-depression").map((entry) => entry.muscle.slug)
    const hyoidElevators = findMusclesForJointMovement("hyoid-elevation").map((entry) => entry.muscle.slug)
    const hyoidDepressors = findMusclesForJointMovement("hyoid-depression").map((entry) => entry.muscle.slug)

    assert.ok(ANATOMY_FOUNDATION_SEED.bones.some((bone) => bone.slug === "hyoid-bone" && bone.sourceRef === "applied-human-anatomy"))
    assert.ok(ANATOMY_FOUNDATION_SEED.structures.some((structure) => structure.slug === "suprahyoid-muscle-group" && structure.sourceRef === "applied-human-anatomy"))
    assert.ok(ANATOMY_FOUNDATION_SEED.structures.some((structure) => structure.slug === "infrahyoid-muscle-group" && structure.sourceRef === "applied-human-anatomy"))
    assert.ok(jawDepressors.includes("digastric"))
    assert.ok(jawDepressors.includes("mylohyoid"))
    assert.ok(hyoidElevators.includes("digastric"))
    assert.ok(hyoidElevators.includes("mylohyoid"))
    assert.ok(hyoidDepressors.includes("sternohyoid"))
    assert.ok(hyoidDepressors.includes("omohyoid"))
    assert.ok(findMusclesByInnervation("mylohyoid-nerve").some((entry) => entry.slug === "mylohyoid"))
    assert.ok(findMusclesByInnervation("ansa-cervicalis").some((entry) => entry.slug === "sternohyoid"))
    assert.ok(findMusclesByInnervation("ansa-cervicalis").some((entry) => entry.slug === "omohyoid"))

    assertCommercialSafeMusclePack(hyoidMuscles)

    assert.ok(searchAnatomyFoundation("strap muscle").some((result) => result.slug === "sternohyoid"))
    assert.ok(searchAnatomyFoundation("under jaw muscle").some((result) => result.slug === "digastric"))
    assert.equal(findClientTermMapping("under jaw tightness")?.mappedMuscleSlug, "digastric")
    assert.equal(findClientTermMapping("front strap muscle tightness")?.mappedMuscleSlug, "sternohyoid")
  })

  it("adds a commercial-safe tongue and remaining anterior neck muscle pack", () => {
    const tongueAndStrapMuscles = [
      "genioglossus",
      "hyoglossus",
      "styloglossus",
      "palatoglossus",
      "geniohyoid",
      "stylohyoid",
      "sternothyroid",
      "thyrohyoid",
    ]
    const tongueProtruders = findMusclesForJointMovement("tongue-protrusion").map((entry) => entry.muscle.slug)
    const tongueDepressors = findMusclesForJointMovement("tongue-depression").map((entry) => entry.muscle.slug)
    const tongueRetractors = findMusclesForJointMovement("tongue-retraction").map((entry) => entry.muscle.slug)
    const tongueElevators = findMusclesForJointMovement("tongue-elevation").map((entry) => entry.muscle.slug)
    const hyoidElevators = findMusclesForJointMovement("hyoid-elevation").map((entry) => entry.muscle.slug)
    const laryngealDepressors = findMusclesForJointMovement("laryngeal-depression").map((entry) => entry.muscle.slug)
    const laryngealElevators = findMusclesForJointMovement("laryngeal-elevation").map((entry) => entry.muscle.slug)
    const hypoglossalMuscles = findMusclesByInnervation("hypoglossal-nerve").map((entry) => entry.slug)
    const vagusMuscles = findMusclesByInnervation("vagus-nerve").map((entry) => entry.slug)
    const facialMuscles = findMusclesByInnervation("facial-nerve").map((entry) => entry.slug)
    const ansaMuscles = findMusclesByInnervation("ansa-cervicalis").map((entry) => entry.slug)

    assert.ok(tongueProtruders.includes("genioglossus"))
    assert.ok(tongueDepressors.includes("hyoglossus"))
    assert.ok(tongueRetractors.includes("styloglossus"))
    assert.ok(tongueElevators.includes("palatoglossus"))
    assert.ok(hyoidElevators.includes("geniohyoid"))
    assert.ok(hyoidElevators.includes("stylohyoid"))
    assert.ok(laryngealDepressors.includes("sternothyroid"))
    assert.ok(laryngealElevators.includes("thyrohyoid"))
    assert.ok(hypoglossalMuscles.includes("genioglossus"))
    assert.ok(hypoglossalMuscles.includes("hyoglossus"))
    assert.ok(hypoglossalMuscles.includes("styloglossus"))
    assert.ok(vagusMuscles.includes("palatoglossus"))
    assert.ok(facialMuscles.includes("stylohyoid"))
    assert.ok(ansaMuscles.includes("sternothyroid"))
    assert.ok(ANATOMY_FOUNDATION_SEED.structures.some((structure) => structure.slug === "extrinsic-tongue-muscle-group" && structure.sourceRef === "applied-human-anatomy"))
    assert.ok(ANATOMY_FOUNDATION_SEED.structures.some((structure) => structure.slug === "tongue-body" && structure.sourceRef === "applied-human-anatomy"))
    assert.ok(ANATOMY_FOUNDATION_SEED.structures.some((structure) => structure.slug === "palatoglossal-arch" && structure.sourceRef === "applied-human-anatomy"))
    assert.ok(ANATOMY_FOUNDATION_SEED.structures.some((structure) => structure.slug === "thyroid-cartilage" && structure.sourceRef === "applied-human-anatomy"))
    assert.ok(ANATOMY_FOUNDATION_SEED.relationships.some((relationship) => relationship.sourceEntitySlug === "genioglossus" && relationship.relationshipType === "part_of" && relationship.targetEntitySlug === "extrinsic-tongue-muscle-group"))
    assert.ok(ANATOMY_FOUNDATION_SEED.relationships.some((relationship) => relationship.sourceEntitySlug === "lingual-artery" && relationship.relationshipType === "supplies" && relationship.targetEntitySlug === "genioglossus"))

    assertCommercialSafeMusclePack(tongueAndStrapMuscles, { identifierProviders: ["UBERON"] })

    assert.ok(searchAnatomyFoundation("tongue protruder").some((result) => result.slug === "genioglossus"))
    assert.ok(searchAnatomyFoundation("soft palate tongue muscle").some((result) => result.slug === "palatoglossus"))
    assert.equal(findClientTermMapping("tongue tension")?.mappedMuscleSlug, "genioglossus")
    assert.equal(findClientTermMapping("under chin tightness")?.mappedMuscleSlug, "geniohyoid")
    assert.equal(findClientTermMapping("throat strap tightness")?.mappedMuscleSlug, "sternothyroid")
  })

  it("adds a commercial-safe pelvic floor and perineal support pack", () => {
    const pelvicFloorMuscles = [
      "levator-ani",
      "coccygeus",
      "bulbospongiosus",
      "ischiocavernosus",
    ]
    const pelvicSupport = findMusclesForJointMovement("pelvic-floor-support").map((entry) => entry.muscle.slug)
    const perinealCompressors = findMusclesForJointMovement("perineal-compression").map((entry) => entry.muscle.slug)

    assert.ok(ANATOMY_FOUNDATION_SEED.bones.some((bone) => bone.slug === "coccyx" && bone.sourceRef === "applied-human-anatomy"))
    assert.ok(ANATOMY_FOUNDATION_SEED.structures.some((structure) => structure.slug === "pelvic-diaphragm" && structure.sourceRef === "applied-human-anatomy"))
    assert.ok(ANATOMY_FOUNDATION_SEED.structures.some((structure) => structure.slug === "perineal-body" && structure.sourceRef === "applied-human-anatomy"))
    assert.ok(pelvicSupport.includes("levator-ani"))
    assert.ok(pelvicSupport.includes("coccygeus"))
    assert.ok(perinealCompressors.includes("bulbospongiosus"))
    assert.ok(perinealCompressors.includes("ischiocavernosus"))
    assert.ok(findMusclesByInnervation("pudendal-nerve").some((entry) => entry.slug === "bulbospongiosus"))
    assert.ok(findMusclesByInnervation("nerve-to-levator-ani").some((entry) => entry.slug === "levator-ani"))
    assert.ok(ANATOMY_FOUNDATION_SEED.bloodSupply.some((bloodSupply) => bloodSupply.slug === "internal-pudendal-artery" && bloodSupply.kind === "artery"))

    assertCommercialSafeMusclePack(pelvicFloorMuscles)

    assert.ok(searchAnatomyFoundation("pelvic floor").some((result) => result.slug === "levator-ani"))
    assert.ok(searchAnatomyFoundation("perineal body").some((result) => result.slug === "perineal-body"))
    assert.equal(findClientTermMapping("pelvic floor tightness")?.mappedMuscleSlug, "levator-ani")
    assert.equal(findClientTermMapping("tailbone floor tightness")?.mappedMuscleSlug, "coccygeus")
  })

  it("adds a commercial-safe upper arm accessory and cubital elbow pack", () => {
    const upperArmAccessoryMuscles = [
      "coracobrachialis",
      "anconeus",
    ]
    const shoulderFlexors = findMusclesForJointMovement("shoulder-flexion").map((entry) => entry.muscle.slug)
    const shoulderAdductors = findMusclesForJointMovement("shoulder-adduction").map((entry) => entry.muscle.slug)
    const elbowExtensors = findMusclesForJointMovement("elbow-extension").map((entry) => entry.muscle.slug)

    assert.ok(shoulderFlexors.includes("coracobrachialis"))
    assert.ok(shoulderAdductors.includes("coracobrachialis"))
    assert.ok(elbowExtensors.includes("anconeus"))
    assert.ok(findMusclesByInnervation("musculocutaneous-nerve").some((entry) => entry.slug === "coracobrachialis"))
    assert.ok(findMusclesByInnervation("radial-nerve").some((entry) => entry.slug === "anconeus"))
    assert.ok(ANATOMY_FOUNDATION_SEED.structures.some((structure) => structure.slug === "cubital-fossa" && structure.sourceRef === "applied-human-anatomy"))
    assert.ok(ANATOMY_FOUNDATION_SEED.structures.some((structure) => structure.slug === "olecranon-bursa" && structure.sourceRef === "applied-human-anatomy"))
    assert.ok(ANATOMY_FOUNDATION_SEED.bloodSupply.some((bloodSupply) => bloodSupply.slug === "deep-brachial-artery" && bloodSupply.kind === "artery"))

    assertCommercialSafeMusclePack(upperArmAccessoryMuscles)

    assert.ok(searchAnatomyFoundation("front armpit arm muscle").some((result) => result.slug === "coracobrachialis"))
    assert.ok(searchAnatomyFoundation("small elbow extensor").some((result) => result.slug === "anconeus"))
    assert.ok(searchAnatomyFoundation("inside elbow crease").some((result) => result.slug === "cubital-fossa"))
    assert.equal(findClientTermMapping("inside elbow crease tightness")?.mappedStructureSlug, "cubital-fossa")
    assert.equal(findClientTermMapping("back of elbow tightness")?.mappedMuscleSlug, "anconeus")
  })

  it("adds a commercial-safe bursae, labra, menisci, and tendon sheath atlas pack", () => {
    const softTissueStructures = [
      "subacromial-subdeltoid-bursa",
      "subscapular-bursa",
      "bicipital-tendon-sheath",
      "glenoid-labrum",
      "acetabular-labrum",
      "trochanteric-bursa",
      "iliopsoas-bursa",
      "ischial-bursa",
      "medial-meniscus",
      "lateral-meniscus",
      "prepatellar-bursa",
      "superficial-infrapatellar-bursa",
      "deep-infrapatellar-bursa",
      "pes-anserine-bursa",
      "retrocalcaneal-bursa",
      "common-flexor-synovial-sheath",
      "flexor-pollicis-longus-synovial-sheath",
      "extensor-tendon-sheaths-wrist",
      "fibular-tendon-sheath",
      "tibialis-posterior-tendon-sheath",
    ]

    assertCommercialSafeStructurePack(softTissueStructures)

    assert.ok(ANATOMY_FOUNDATION_SEED.relationships.some((relationship) => relationship.sourceEntitySlug === "glenoid-labrum" && relationship.relationshipType === "deepens" && relationship.targetEntitySlug === "glenohumeral"))
    assert.ok(ANATOMY_FOUNDATION_SEED.relationships.some((relationship) => relationship.sourceEntitySlug === "acetabular-labrum" && relationship.relationshipType === "deepens" && relationship.targetEntitySlug === "hip-joint"))
    assert.ok(ANATOMY_FOUNDATION_SEED.relationships.some((relationship) => relationship.sourceEntitySlug === "bicipital-tendon-sheath" && relationship.relationshipType === "surrounds" && relationship.targetEntitySlug === "biceps-tendon"))
    assert.ok(ANATOMY_FOUNDATION_SEED.relationships.some((relationship) => relationship.sourceEntitySlug === "subacromial-subdeltoid-bursa" && relationship.relationshipType === "reduces_friction_for" && relationship.targetEntitySlug === "supraspinatus"))
    assert.ok(ANATOMY_FOUNDATION_SEED.relationships.some((relationship) => relationship.sourceEntitySlug === "medial-meniscus" && relationship.relationshipType === "part_of" && relationship.targetEntitySlug === "knee-joint"))
    assert.ok(ANATOMY_FOUNDATION_SEED.relationships.some((relationship) => relationship.sourceEntitySlug === "lateral-meniscus" && relationship.relationshipType === "related_to" && relationship.targetEntitySlug === "popliteus"))
    assert.ok(ANATOMY_FOUNDATION_SEED.relationships.some((relationship) => relationship.sourceEntitySlug === "pes-anserine-bursa" && relationship.relationshipType === "associated_with" && relationship.targetEntitySlug === "pes-anserinus"))
    assert.ok(ANATOMY_FOUNDATION_SEED.relationships.some((relationship) => relationship.sourceEntitySlug === "retrocalcaneal-bursa" && relationship.relationshipType === "reduces_friction_for" && relationship.targetEntitySlug === "achilles-tendon"))

    assert.ok(searchAnatomyFoundation("shoulder bursa").some((result) => result.slug === "subacromial-subdeltoid-bursa"))
    assert.ok(searchAnatomyFoundation("biceps tendon sheath").some((result) => result.slug === "bicipital-tendon-sheath"))
    assert.ok(searchAnatomyFoundation("hip socket labrum").some((result) => result.slug === "acetabular-labrum"))
    assert.ok(searchAnatomyFoundation("inner knee bursa").some((result) => result.slug === "pes-anserine-bursa"))
    assert.ok(searchAnatomyFoundation("heel bursa").some((result) => result.slug === "retrocalcaneal-bursa"))

    assert.equal(findClientTermMapping("top shoulder bursa area")?.mappedStructureSlug, "subacromial-subdeltoid-bursa")
    assert.equal(findClientTermMapping("outer hip bursa area")?.mappedStructureSlug, "trochanteric-bursa")
    assert.equal(findClientTermMapping("front kneecap bursa area")?.mappedStructureSlug, "prepatellar-bursa")
    assert.equal(findClientTermMapping("inside knee bursa area")?.mappedStructureSlug, "pes-anserine-bursa")
    assert.equal(findClientTermMapping("heel bursa area")?.mappedStructureSlug, "retrocalcaneal-bursa")
  })

  it("adds a commercial-safe fascial compartment and lymphatic drainage atlas pack", () => {
    const fascialStructures = [
      "brachial-fascia",
      "antebrachial-fascia",
      "clavipectoral-fascia",
      "fascia-lata",
      "crural-fascia",
      "anterior-compartment-arm",
      "posterior-compartment-arm",
      "anterior-compartment-forearm",
      "posterior-compartment-forearm",
      "anterior-thigh-compartment",
      "medial-thigh-compartment",
      "posterior-thigh-compartment",
      "anterior-leg-compartment",
      "lateral-leg-compartment",
      "posterior-leg-compartment",
    ]
    const lymphaticStructures = [
      "thoracic-duct",
      "right-lymphatic-duct",
      "cisterna-chyli",
      "jugular-lymphatic-trunk",
      "subclavian-lymphatic-trunk",
      "bronchomediastinal-lymphatic-trunk",
      "intestinal-lymphatic-trunk",
      "lumbar-lymphatic-trunk",
      "cervical-lymph-nodes",
      "axillary-lymph-nodes",
      "inguinal-lymph-nodes",
      "popliteal-lymph-nodes",
    ]

    assertCommercialSafeStructurePack([...fascialStructures, ...lymphaticStructures])

    assert.ok(ANATOMY_FOUNDATION_SEED.relationships.some((relationship) => relationship.sourceEntitySlug === "anterior-compartment-arm" && relationship.relationshipType === "contains" && relationship.targetEntitySlug === "biceps-brachii"))
    assert.ok(ANATOMY_FOUNDATION_SEED.relationships.some((relationship) => relationship.sourceEntitySlug === "posterior-compartment-arm" && relationship.relationshipType === "contains" && relationship.targetEntitySlug === "triceps-brachii"))
    assert.ok(ANATOMY_FOUNDATION_SEED.relationships.some((relationship) => relationship.sourceEntitySlug === "anterior-thigh-compartment" && relationship.relationshipType === "contains" && relationship.targetEntitySlug === "rectus-femoris"))
    assert.ok(ANATOMY_FOUNDATION_SEED.relationships.some((relationship) => relationship.sourceEntitySlug === "posterior-thigh-compartment" && relationship.relationshipType === "contains" && relationship.targetEntitySlug === "biceps-femoris"))
    assert.ok(ANATOMY_FOUNDATION_SEED.relationships.some((relationship) => relationship.sourceEntitySlug === "anterior-leg-compartment" && relationship.relationshipType === "contains" && relationship.targetEntitySlug === "tibialis-anterior"))
    assert.ok(ANATOMY_FOUNDATION_SEED.relationships.some((relationship) => relationship.sourceEntitySlug === "lateral-leg-compartment" && relationship.relationshipType === "contains" && relationship.targetEntitySlug === "fibularis-longus"))
    assert.ok(ANATOMY_FOUNDATION_SEED.relationships.some((relationship) => relationship.sourceEntitySlug === "posterior-leg-compartment" && relationship.relationshipType === "contains" && relationship.targetEntitySlug === "gastrocnemius"))
    assert.ok(ANATOMY_FOUNDATION_SEED.relationships.some((relationship) => relationship.sourceEntitySlug === "thoracic-duct" && relationship.relationshipType === "drains_to" && relationship.targetEntitySlug === "subclavian-vein"))
    assert.ok(ANATOMY_FOUNDATION_SEED.relationships.some((relationship) => relationship.sourceEntitySlug === "right-lymphatic-duct" && relationship.relationshipType === "drains_to" && relationship.targetEntitySlug === "subclavian-vein"))
    assert.ok(ANATOMY_FOUNDATION_SEED.relationships.some((relationship) => relationship.sourceEntitySlug === "axillary-lymph-nodes" && relationship.relationshipType === "drains_region" && relationship.targetEntitySlug === "upper-limb"))
    assert.ok(ANATOMY_FOUNDATION_SEED.relationships.some((relationship) => relationship.sourceEntitySlug === "inguinal-lymph-nodes" && relationship.relationshipType === "drains_region" && relationship.targetEntitySlug === "lower-limb"))

    assert.ok(searchAnatomyFoundation("clavipectoral fascia").some((result) => result.slug === "clavipectoral-fascia"))
    assert.ok(searchAnatomyFoundation("front shin compartment").some((result) => result.slug === "anterior-leg-compartment"))
    assert.ok(searchAnatomyFoundation("outer leg compartment").some((result) => result.slug === "lateral-leg-compartment"))
    assert.ok(searchAnatomyFoundation("thoracic duct").some((result) => result.slug === "thoracic-duct"))
    assert.ok(searchAnatomyFoundation("armpit lymph nodes").some((result) => result.slug === "axillary-lymph-nodes"))
    assert.ok(searchAnatomyFoundation("groin lymph nodes").some((result) => result.slug === "inguinal-lymph-nodes"))

    assert.equal(findClientTermMapping("armpit lymph area")?.mappedStructureSlug, "axillary-lymph-nodes")
    assert.equal(findClientTermMapping("groin lymph area")?.mappedStructureSlug, "inguinal-lymph-nodes")
    assert.equal(findClientTermMapping("front shin compartment tightness")?.mappedStructureSlug, "anterior-leg-compartment")
    assert.equal(findClientTermMapping("outer leg compartment tightness")?.mappedStructureSlug, "lateral-leg-compartment")
    assert.equal(findClientTermMapping("forearm fascia tightness")?.mappedStructureSlug, "antebrachial-fascia")
  })

  it("adds a commercial-safe dermatome and myotome atlas pack", () => {
    const dermatomeStructures = [
      "c2-dermatome",
      "c3-dermatome",
      "c4-dermatome",
      "c5-dermatome",
      "c6-dermatome",
      "c7-dermatome",
      "c8-dermatome",
      "t1-dermatome",
      "t2-dermatome",
      "t3-dermatome",
      "t4-dermatome",
      "t5-dermatome",
      "t6-dermatome",
      "t7-dermatome",
      "t8-dermatome",
      "t9-dermatome",
      "t10-dermatome",
      "t11-dermatome",
      "t12-dermatome",
      "l1-dermatome",
      "l2-dermatome",
      "l3-dermatome",
      "l4-dermatome",
      "l5-dermatome",
      "s1-dermatome",
      "s2-dermatome",
      "s3-dermatome",
      "s4-dermatome",
      "s5-dermatome",
      "coccygeal-dermatome",
    ]
    const myotomeStructures = [
      "c1-myotome",
      "c2-myotome",
      "c3-myotome",
      "c4-myotome",
      "c5-myotome",
      "c6-myotome",
      "c7-myotome",
      "c8-myotome",
      "t1-myotome",
      "t2-myotome",
      "t3-myotome",
      "t4-myotome",
      "t5-myotome",
      "t6-myotome",
      "t7-myotome",
      "t8-myotome",
      "t9-myotome",
      "t10-myotome",
      "t11-myotome",
      "t12-myotome",
      "l1-myotome",
      "l2-myotome",
      "l3-myotome",
      "l4-myotome",
      "l5-myotome",
      "s1-myotome",
      "s2-myotome",
      "s3-myotome",
      "s4-myotome",
      "s5-myotome",
    ]

    assertCommercialSafeStructurePack([...dermatomeStructures, ...myotomeStructures])

    assert.ok(ANATOMY_FOUNDATION_SEED.relationships.some((relationship) => relationship.sourceEntitySlug === "c6-dermatome" && relationship.relationshipType === "sensory_region" && relationship.targetEntitySlug === "hand"))
    assert.ok(ANATOMY_FOUNDATION_SEED.relationships.some((relationship) => relationship.sourceEntitySlug === "t4-dermatome" && relationship.relationshipType === "sensory_region" && relationship.targetEntitySlug === "thorax"))
    assert.ok(ANATOMY_FOUNDATION_SEED.relationships.some((relationship) => relationship.sourceEntitySlug === "l4-dermatome" && relationship.relationshipType === "sensory_region" && relationship.targetEntitySlug === "leg"))
    assert.ok(ANATOMY_FOUNDATION_SEED.relationships.some((relationship) => relationship.sourceEntitySlug === "s1-dermatome" && relationship.relationshipType === "sensory_region" && relationship.targetEntitySlug === "foot"))
    assert.ok(ANATOMY_FOUNDATION_SEED.relationships.some((relationship) => relationship.sourceEntitySlug === "c5-myotome" && relationship.relationshipType === "motor_reference_muscle" && relationship.targetEntitySlug === "deltoid"))
    assert.ok(ANATOMY_FOUNDATION_SEED.relationships.some((relationship) => relationship.sourceEntitySlug === "c6-myotome" && relationship.relationshipType === "motor_reference_muscle" && relationship.targetEntitySlug === "biceps-brachii"))
    assert.ok(ANATOMY_FOUNDATION_SEED.relationships.some((relationship) => relationship.sourceEntitySlug === "c7-myotome" && relationship.relationshipType === "motor_reference_muscle" && relationship.targetEntitySlug === "triceps-brachii"))
    assert.ok(ANATOMY_FOUNDATION_SEED.relationships.some((relationship) => relationship.sourceEntitySlug === "l4-myotome" && relationship.relationshipType === "motor_reference_muscle" && relationship.targetEntitySlug === "tibialis-anterior"))
    assert.ok(ANATOMY_FOUNDATION_SEED.relationships.some((relationship) => relationship.sourceEntitySlug === "l5-myotome" && relationship.relationshipType === "motor_reference_muscle" && relationship.targetEntitySlug === "extensor-hallucis-longus"))
    assert.ok(ANATOMY_FOUNDATION_SEED.relationships.some((relationship) => relationship.sourceEntitySlug === "s1-myotome" && relationship.relationshipType === "motor_reference_muscle" && relationship.targetEntitySlug === "gastrocnemius"))
    assert.ok(ANATOMY_FOUNDATION_SEED.relationships.some((relationship) => relationship.sourceEntitySlug === "s3-myotome" && relationship.relationshipType === "motor_reference_muscle" && relationship.targetEntitySlug === "levator-ani"))

    assert.ok(searchAnatomyFoundation("C6 dermatome").some((result) => result.slug === "c6-dermatome"))
    assert.ok(searchAnatomyFoundation("thumb dermatome").some((result) => result.slug === "c6-dermatome"))
    assert.ok(searchAnatomyFoundation("L4 myotome").some((result) => result.slug === "l4-myotome"))
    assert.ok(searchAnatomyFoundation("ankle dorsiflexion myotome").some((result) => result.slug === "l4-myotome"))
    assert.ok(searchAnatomyFoundation("pelvic floor myotome").some((result) => result.slug === "s3-myotome"))

    assert.equal(findClientTermMapping("thumb numbness")?.mappedStructureSlug, "c6-dermatome")
    assert.equal(findClientTermMapping("little finger numbness")?.mappedStructureSlug, "c8-dermatome")
    assert.equal(findClientTermMapping("big toe numbness")?.mappedStructureSlug, "l5-dermatome")
    assert.equal(findClientTermMapping("front thigh nerve area")?.mappedStructureSlug, "l2-dermatome")
    assert.equal(findClientTermMapping("outer foot nerve area")?.mappedStructureSlug, "s1-dermatome")
  })

  it("adds a commercial-safe anterior and lateral neck flexor-scalene pack", () => {
    const anteriorNeckMuscles = [
      "longus-colli",
      "longus-capitis",
      "anterior-scalene",
      "middle-scalene",
      "posterior-scalene",
    ]
    const cervicalFlexors = findMusclesForJointMovement("cervical-flexion").map((entry) => entry.muscle.slug)
    const cervicalLateralFlexors = findMusclesForJointMovement("cervical-lateral-flexion").map((entry) => entry.muscle.slug)
    const ribElevators = findMusclesForJointMovement("rib-elevation").map((entry) => entry.muscle.slug)

    assert.ok(cervicalFlexors.includes("longus-colli"))
    assert.ok(cervicalFlexors.includes("longus-capitis"))
    assert.ok(cervicalLateralFlexors.includes("anterior-scalene"))
    assert.ok(cervicalLateralFlexors.includes("middle-scalene"))
    assert.ok(ribElevators.includes("anterior-scalene"))
    assert.ok(ribElevators.includes("posterior-scalene"))
    assert.ok(findMusclesByInnervation("cervical-plexus").some((entry) => entry.slug === "longus-colli"))
    assert.ok(findMusclesByInnervation("cervical-plexus").some((entry) => entry.slug === "longus-capitis"))
    assert.ok(findMusclesByInnervation("cervical-plexus").some((entry) => entry.slug === "middle-scalene"))
    assert.ok(ANATOMY_FOUNDATION_SEED.structures.some((structure) => structure.slug === "prevertebral-muscle-group" && structure.sourceRef === "applied-human-anatomy"))
    assert.ok(ANATOMY_FOUNDATION_SEED.structures.some((structure) => structure.slug === "scalene-triangle" && structure.sourceRef === "applied-human-anatomy"))
    assert.ok(ANATOMY_FOUNDATION_SEED.relationships.some((relationship) => relationship.sourceEntitySlug === "scalene-triangle" && relationship.relationshipType === "contains" && relationship.targetEntitySlug === "brachial-plexus"))
    assert.ok(ANATOMY_FOUNDATION_SEED.bloodSupply.some((bloodSupply) => bloodSupply.slug === "ascending-cervical-artery" && bloodSupply.kind === "artery"))

    assertCommercialSafeMusclePack(anteriorNeckMuscles)

    assert.ok(searchAnatomyFoundation("deep front neck flexor").some((result) => result.slug === "longus-colli"))
    assert.ok(searchAnatomyFoundation("side neck breathing muscle").some((result) => result.slug === "anterior-scalene"))
    assert.ok(searchAnatomyFoundation("scalene triangle").some((result) => result.slug === "scalene-triangle"))
    assert.equal(findClientTermMapping("deep front neck tightness")?.mappedMuscleSlug, "longus-colli")
    assert.equal(findClientTermMapping("side neck breathing muscle tightness")?.mappedMuscleSlug, "anterior-scalene")
  })

  it("adds a commercial-safe suboccipital fine-control pack", () => {
    const suboccipitalMuscles = [
      "rectus-capitis-posterior-major",
      "rectus-capitis-posterior-minor",
      "obliquus-capitis-superior",
      "obliquus-capitis-inferior",
    ]
    const atlantoOccipitalExtensors = findMusclesForJointMovement("atlanto-occipital-extension").map((entry) => entry.muscle.slug)
    const atlantoaxialRotators = findMusclesForJointMovement("atlantoaxial-rotation").map((entry) => entry.muscle.slug)
    const cervicalRotators = findMusclesForJointMovement("cervical-rotation").map((entry) => entry.muscle.slug)

    assert.ok(atlantoOccipitalExtensors.includes("rectus-capitis-posterior-major"))
    assert.ok(atlantoOccipitalExtensors.includes("rectus-capitis-posterior-minor"))
    assert.ok(atlantoOccipitalExtensors.includes("obliquus-capitis-superior"))
    assert.ok(atlantoaxialRotators.includes("obliquus-capitis-inferior"))
    assert.ok(cervicalRotators.includes("rectus-capitis-posterior-major"))
    assert.ok(findMusclesByInnervation("suboccipital-nerve").some((entry) => entry.slug === "obliquus-capitis-inferior"))
    assert.ok(ANATOMY_FOUNDATION_SEED.structures.some((structure) => structure.slug === "suboccipital-triangle" && structure.sourceRef === "applied-human-anatomy"))
    assert.ok(ANATOMY_FOUNDATION_SEED.bloodSupply.some((bloodSupply) => bloodSupply.slug === "occipital-artery" && bloodSupply.kind === "artery"))

    assertCommercialSafeMusclePack(suboccipitalMuscles, { identifierProviders: ["UBERON", "FMA", "FIPAT"] })

    assert.ok(searchAnatomyFoundation("small base of skull muscles").some((result) => result.slug === "rectus-capitis-posterior-major"))
    assert.ok(searchAnatomyFoundation("suboccipital triangle").some((result) => result.slug === "suboccipital-triangle"))
    assert.ok(searchAnatomyFoundation("head rotation at atlas axis").some((result) => result.slug === "obliquus-capitis-inferior"))
    assert.equal(findClientTermMapping("base of skull tiny muscles")?.mappedMuscleSlug, "rectus-capitis-posterior-major")
    assert.equal(findClientTermMapping("under skull rotation tightness")?.mappedMuscleSlug, "obliquus-capitis-inferior")
  })

  it("adds a commercial-safe hypothenar and ulnar palm pack", () => {
    const hypothenarMuscles = [
      "abductor-digiti-minimi-hand",
      "flexor-digiti-minimi-brevis-hand",
      "opponens-digiti-minimi",
      "palmaris-brevis",
    ]
    const fingerAbductors = findMusclesForJointMovement("finger-abduction").map((entry) => entry.muscle.slug)
    const fingerFlexors = findMusclesForJointMovement("finger-flexion").map((entry) => entry.muscle.slug)
    const littleFingerOpponents = findMusclesForJointMovement("little-finger-opposition").map((entry) => entry.muscle.slug)
    const palmarCompressors = findMusclesForJointMovement("palmar-compression").map((entry) => entry.muscle.slug)

    assert.ok(fingerAbductors.includes("abductor-digiti-minimi-hand"))
    assert.ok(fingerFlexors.includes("flexor-digiti-minimi-brevis-hand"))
    assert.ok(littleFingerOpponents.includes("opponens-digiti-minimi"))
    assert.ok(palmarCompressors.includes("palmaris-brevis"))
    assert.ok(findMusclesByInnervation("deep-branch-ulnar-nerve").some((entry) => entry.slug === "opponens-digiti-minimi"))
    assert.ok(findMusclesByInnervation("ulnar-nerve").some((entry) => entry.slug === "palmaris-brevis"))
    assert.ok(ANATOMY_FOUNDATION_SEED.structures.some((structure) => structure.slug === "hypothenar-eminence" && structure.sourceRef === "applied-human-anatomy"))
    assert.ok(ANATOMY_FOUNDATION_SEED.relationships.some((relationship) => relationship.sourceEntitySlug === "hypothenar-eminence" && relationship.relationshipType === "contains" && relationship.targetEntitySlug === "abductor-digiti-minimi-hand"))

    assertCommercialSafeMusclePack(hypothenarMuscles, { identifierProviders: ["UBERON"] })

    assert.ok(searchAnatomyFoundation("little finger pad").some((result) => result.slug === "hypothenar-eminence"))
    assert.ok(searchAnatomyFoundation("ulnar palm muscle").some((result) => result.slug === "abductor-digiti-minimi-hand"))
    assert.equal(findClientTermMapping("little finger pad tightness")?.mappedMuscleSlug, "abductor-digiti-minimi-hand")
    assert.equal(findClientTermMapping("ulnar palm tightness")?.mappedStructureSlug, "hypothenar-eminence")
  })

  it("adds a commercial-safe dorsal foot and hallux extensor pack", () => {
    const dorsalFootMuscles = [
      "extensor-digitorum-brevis-foot",
      "extensor-hallucis-brevis",
      "adductor-hallucis",
    ]
    const toeExtensors = findMusclesForJointMovement("toe-extension").map((entry) => entry.muscle.slug)
    const halluxExtensors = findMusclesForJointMovement("hallux-extension").map((entry) => entry.muscle.slug)
    const halluxAdductors = findMusclesForJointMovement("hallux-adduction").map((entry) => entry.muscle.slug)

    assert.ok(toeExtensors.includes("extensor-digitorum-brevis-foot"))
    assert.ok(halluxExtensors.includes("extensor-hallucis-brevis"))
    assert.ok(halluxAdductors.includes("adductor-hallucis"))
    assert.ok(findMusclesByInnervation("deep-fibular-nerve").some((entry) => entry.slug === "extensor-digitorum-brevis-foot"))
    assert.ok(findMusclesByInnervation("lateral-plantar-nerve").some((entry) => entry.slug === "adductor-hallucis"))
    assert.ok(ANATOMY_FOUNDATION_SEED.structures.some((structure) => structure.slug === "dorsal-foot-extensor-tendons" && structure.sourceRef === "applied-human-anatomy"))
    assert.ok(ANATOMY_FOUNDATION_SEED.relationships.some((relationship) => relationship.sourceEntitySlug === "dorsalis-pedis-artery" && relationship.relationshipType === "supplies" && relationship.targetEntitySlug === "extensor-digitorum-brevis-foot"))

    assertCommercialSafeMusclePack(dorsalFootMuscles, { identifierProviders: ["UBERON", "FMA", "FIPAT", "NCIT"] })

    assert.ok(searchAnatomyFoundation("top of foot extensor").some((result) => result.slug === "extensor-digitorum-brevis-foot"))
    assert.ok(searchAnatomyFoundation("big toe short extensor").some((result) => result.slug === "extensor-hallucis-brevis"))
    assert.ok(searchAnatomyFoundation("ball of foot adductor").some((result) => result.slug === "adductor-hallucis"))
    assert.equal(findClientTermMapping("top of foot tendon tightness")?.mappedStructureSlug, "dorsal-foot-extensor-tendons")
    assert.equal(findClientTermMapping("big toe ball tightness")?.mappedMuscleSlug, "adductor-hallucis")
  })

  it("adds a commercial-safe posterior rib and erector column pack", () => {
    const posteriorBackMuscles = [
      "serratus-posterior-superior",
      "serratus-posterior-inferior",
      "iliocostalis",
      "longissimus",
      "spinalis",
    ]
    const ribElevators = findMusclesForJointMovement("rib-elevation").map((entry) => entry.muscle.slug)
    const ribDepressors = findMusclesForJointMovement("rib-depression").map((entry) => entry.muscle.slug)
    const thoracicExtensors = findMusclesForJointMovement("thoracic-extension").map((entry) => entry.muscle.slug)

    assert.ok(ribElevators.includes("serratus-posterior-superior"))
    assert.ok(ribDepressors.includes("serratus-posterior-inferior"))
    assert.ok(thoracicExtensors.includes("iliocostalis"))
    assert.ok(thoracicExtensors.includes("longissimus"))
    assert.ok(thoracicExtensors.includes("spinalis"))
    assert.ok(findMusclesByInnervation("intercostal-nerves").some((entry) => entry.slug === "serratus-posterior-superior"))
    assert.ok(findMusclesByInnervation("posterior-rami-spinal-nerves").some((entry) => entry.slug === "longissimus"))
    assert.ok(ANATOMY_FOUNDATION_SEED.structures.some((structure) => structure.slug === "erector-spinae-column" && structure.sourceRef === "applied-human-anatomy"))
    assert.ok(ANATOMY_FOUNDATION_SEED.structures.some((structure) => structure.slug === "serratus-posterior-aponeurosis" && structure.sourceRef === "applied-human-anatomy"))

    assertCommercialSafeMusclePack(posteriorBackMuscles, { identifierProviders: ["UBERON", "FMA", "FIPAT"] })

    assert.ok(searchAnatomyFoundation("deep back extensor column").some((result) => result.slug === "erector-spinae-column"))
    assert.ok(searchAnatomyFoundation("posterior rib breathing muscle").some((result) => result.slug === "serratus-posterior-superior"))
    assert.equal(findClientTermMapping("rib back breathing tightness")?.mappedMuscleSlug, "serratus-posterior-superior")
    assert.equal(findClientTermMapping("deep spine extensor tightness")?.mappedMuscleSlug, "longissimus")
  })

  it("adds a commercial-safe physiology concept core for MBLEx kinesiology coverage", () => {
    const sourceBySlug = new Map(ANATOMY_FOUNDATION_SEED.sources.map((source) => [source.slug, source]))
    const conceptBySlug = new Map(ANATOMY_FOUNDATION_SEED.concepts.map((concept) => [concept.slug, concept]))
    const expectedConceptSlugs = [
      "skeletal-muscle-fiber",
      "muscle-fascicle",
      "motor-unit",
      "neuromuscular-junction",
      "sarcomere",
      "concentric-contraction",
      "eccentric-contraction",
      "isometric-contraction",
      "agonist-muscle-role",
      "antagonist-muscle-role",
      "muscle-spindle",
      "golgi-tendon-organ",
      "joint-mechanoreceptor",
      "proprioception",
      "active-range-of-motion",
      "passive-range-of-motion",
      "resisted-range-of-motion",
      "inflammation",
      "tissue-repair",
      "scar-tissue",
    ]

    assert.equal(sourceBySlug.get("openstax-human-biology")?.usageScope, "open_reuse")

    for (const conceptSlug of expectedConceptSlugs) {
      const concept = conceptBySlug.get(conceptSlug)
      const citations = ANATOMY_FOUNDATION_SEED.citations.filter((citation) => citation.entityType === "anatomy_concept" && citation.entitySlug === conceptSlug)

      assert.ok(concept, `${conceptSlug} should be seeded as an anatomy concept`)
      assert.equal(sourceBySlug.get(concept?.sourceRef ?? "")?.usageScope, "open_reuse", `${conceptSlug} must use an open-reuse source`)
      assert.ok(citations.some((citation) => citation.factType === "clinical_summary" && citation.reviewStatus === "reviewed"), `${conceptSlug} needs a reviewed clinical summary citation`)
    }

    assert.ok(ANATOMY_FOUNDATION_SEED.entityTerms.some((term) => term.anatomyEntityType === "anatomy_concept" && term.anatomyEntitySlug === "muscle-spindle" && term.term === "proprioceptor"))
    assert.ok(searchAnatomyFoundation("proprioceptor").some((result) => result.slug === "proprioception" || result.slug === "muscle-spindle"))
    assert.ok(searchAnatomyFoundation("resisted range of motion").some((result) => result.slug === "resisted-range-of-motion"))
  })

  it("adds commercial-safe body-system physiology concepts for remaining MBLEx A&P coverage", () => {
    const sourceBySlug = new Map(ANATOMY_FOUNDATION_SEED.sources.map((source) => [source.slug, source]))
    const conceptBySlug = new Map(ANATOMY_FOUNDATION_SEED.concepts.map((concept) => [concept.slug, concept]))
    const expectedConceptSlugs = [
      "digestive-system",
      "gastrointestinal-tract",
      "accessory-digestive-organs",
      "digestion",
      "nutrient-absorption",
      "bowel-elimination",
      "endocrine-system",
      "endocrine-gland",
      "hormone",
      "endocrine-feedback",
      "homeostasis",
      "integumentary-system",
      "epidermis",
      "dermis",
      "skin-barrier-function",
      "thermoregulation",
      "lymphatic-system",
      "lymph",
      "lymph-node",
      "immune-response",
      "innate-immunity",
      "adaptive-immunity",
      "reproductive-system",
      "gamete",
      "reproductive-hormone-regulation",
      "fertilization",
      "sensory-system",
      "sensory-receptor",
      "somatosensation",
      "special-senses",
      "vestibular-sense",
      "urinary-system",
      "kidney",
      "nephron",
      "urine-formation",
      "fluid-electrolyte-balance",
      "energetic-anatomy",
      "chakra-concept",
      "meridian-concept",
      "biofield-concept",
    ]

    assert.equal(sourceBySlug.get("openstax-human-biology")?.usageScope, "open_reuse")
    assert.equal(sourceBySlug.get("massagelab-authored-energetic-anatomy")?.usageScope, "commercial_licensed")

    for (const conceptSlug of expectedConceptSlugs) {
      const concept = conceptBySlug.get(conceptSlug)
      const citations = ANATOMY_FOUNDATION_SEED.citations.filter((citation) => citation.entityType === "anatomy_concept" && citation.entitySlug === conceptSlug)
      const sourceScope = sourceBySlug.get(concept?.sourceRef ?? "")?.usageScope

      assert.ok(concept, `${conceptSlug} should be seeded as an anatomy concept`)
      assert.ok(sourceScope === "open_reuse" || sourceScope === "commercial_licensed", `${conceptSlug} must use a reusable source`)
      assert.ok(citations.some((citation) => ["clinical_summary", "education_summary"].includes(citation.factType) && citation.reviewStatus === "reviewed"), `${conceptSlug} needs a reviewed reusable summary citation`)
    }

    assert.ok(searchAnatomyFoundation("kidney").some((result) => result.slug === "kidney"))
    assert.ok(searchAnatomyFoundation("immune response").some((result) => result.slug === "immune-response"))
    assert.ok(searchAnatomyFoundation("chakra").some((result) => result.slug === "chakra-concept"))
  })

  it("adds strong cardiorespiratory and lymphatic concept coverage with reviewed reusable citations", () => {
    const conceptBySlug = new Map(ANATOMY_FOUNDATION_SEED.concepts.map((concept) => [concept.slug, concept]))
    const sourceBySlug = new Map(ANATOMY_FOUNDATION_SEED.sources.map((source) => [source.slug, source]))
    const expectedConceptSlugs = [
      "cardiovascular-system",
      "heart",
      "blood-vessel",
      "artery",
      "vein",
      "capillary",
      "systemic-circulation",
      "pulmonary-circulation",
      "cardiac-output",
      "blood-pressure",
      "venous-return",
      "respiratory-system",
      "airway",
      "lung",
      "alveolus",
      "pleura",
      "ventilation",
      "gas-exchange",
      "inspiration",
      "expiration",
      "oxygen-transport",
      "lymphatic-vessel",
      "lymphatic-capillary",
      "lymphatic-duct",
      "spleen",
      "thymus",
      "tonsil",
      "lymph-transport",
      "immune-surveillance",
      "fluid-return",
    ]

    for (const conceptSlug of expectedConceptSlugs) {
      const concept = conceptBySlug.get(conceptSlug)
      const citations = ANATOMY_FOUNDATION_SEED.citations.filter((citation) => citation.entityType === "anatomy_concept" && citation.entitySlug === conceptSlug)

      assert.ok(concept, `${conceptSlug} should be seeded as an anatomy concept`)
      assert.equal(sourceBySlug.get(concept?.sourceRef ?? "")?.usageScope, "open_reuse", `${conceptSlug} must use an open-reuse source`)
      assert.ok(citations.some((citation) => citation.factType === "clinical_summary" && citation.reviewStatus === "reviewed"), `${conceptSlug} needs a reviewed clinical summary citation`)
    }

    assert.ok(searchAnatomyFoundation("blood pressure").some((result) => result.slug === "blood-pressure"))
    assert.ok(searchAnatomyFoundation("gas exchange").some((result) => result.slug === "gas-exchange"))
    assert.ok(searchAnatomyFoundation("lymphatic duct").some((result) => result.slug === "lymphatic-duct"))
  })

  it("adds strong remaining body-system concept coverage with reviewed reusable citations", () => {
    const conceptBySlug = new Map(ANATOMY_FOUNDATION_SEED.concepts.map((concept) => [concept.slug, concept]))
    const sourceBySlug = new Map(ANATOMY_FOUNDATION_SEED.sources.map((source) => [source.slug, source]))
    const expectedConceptSlugs = [
      "mouth",
      "esophagus",
      "stomach",
      "small-intestine",
      "large-intestine",
      "liver",
      "gallbladder",
      "pancreas",
      "mechanical-digestion",
      "chemical-digestion",
      "peristalsis",
      "bile",
      "digestive-enzyme",
      "pituitary-gland",
      "thyroid-gland",
      "adrenal-gland",
      "pancreatic-islet",
      "target-cell",
      "negative-feedback",
      "stress-response",
      "blood-glucose-regulation",
      "hypodermis",
      "hair-follicle",
      "sweat-gland",
      "sebaceous-gland",
      "cutaneous-receptor",
      "sweat-production",
      "sebaceous-secretion",
      "skin-sensation",
      "ovary",
      "testis",
      "uterus",
      "fallopian-tube",
      "prostate",
      "gametogenesis",
      "menstrual-cycle",
      "pregnancy-support",
      "lactation",
      "eye",
      "ear",
      "olfactory-receptor",
      "taste-receptor",
      "vestibular-apparatus",
      "vision",
      "hearing",
      "smell",
      "taste",
      "nociception",
      "ureter",
      "urinary-bladder",
      "urethra",
      "renal-cortex",
      "renal-medulla",
      "filtration",
      "reabsorption",
      "secretion",
      "micturition",
      "acid-base-balance",
    ]

    for (const conceptSlug of expectedConceptSlugs) {
      const concept = conceptBySlug.get(conceptSlug)
      const citations = ANATOMY_FOUNDATION_SEED.citations.filter((citation) => citation.entityType === "anatomy_concept" && citation.entitySlug === conceptSlug)

      assert.ok(concept, `${conceptSlug} should be seeded as an anatomy concept`)
      assert.equal(sourceBySlug.get(concept?.sourceRef ?? "")?.usageScope, "open_reuse", `${conceptSlug} must use an open-reuse source`)
      assert.ok(citations.some((citation) => citation.factType === "clinical_summary" && citation.reviewStatus === "reviewed"), `${conceptSlug} needs a reviewed clinical summary citation`)
    }

    assert.ok(searchAnatomyFoundation("peristalsis").some((result) => result.slug === "peristalsis"))
    assert.ok(searchAnatomyFoundation("thyroid gland").some((result) => result.slug === "thyroid-gland"))
    assert.ok(searchAnatomyFoundation("urinary bladder").some((result) => result.slug === "urinary-bladder"))
  })

  it("adds strong nervous-system concept coverage with reviewed reusable citations", () => {
    const conceptBySlug = new Map(ANATOMY_FOUNDATION_SEED.concepts.map((concept) => [concept.slug, concept]))
    const sourceBySlug = new Map(ANATOMY_FOUNDATION_SEED.sources.map((source) => [source.slug, source]))
    const expectedConceptSlugs = [
      "nervous-system",
      "central-nervous-system",
      "peripheral-nervous-system",
      "brain",
      "spinal-cord",
      "neuron",
      "glial-cell",
      "cranial-nerve",
      "spinal-nerve",
      "autonomic-nervous-system",
      "somatic-nervous-system",
      "nerve-impulse",
      "action-potential",
      "synapse",
      "neurotransmitter",
      "reflex-arc",
      "motor-control",
      "sensory-processing",
      "autonomic-regulation",
      "sympathetic-division",
      "parasympathetic-division",
      "neural-plasticity",
    ]

    for (const conceptSlug of expectedConceptSlugs) {
      const concept = conceptBySlug.get(conceptSlug)
      const citations = ANATOMY_FOUNDATION_SEED.citations.filter((citation) => citation.entityType === "anatomy_concept" && citation.entitySlug === conceptSlug)

      assert.ok(concept, `${conceptSlug} should be seeded as an anatomy concept`)
      assert.equal(sourceBySlug.get(concept?.sourceRef ?? "")?.usageScope, "open_reuse", `${conceptSlug} must use an open-reuse source`)
      assert.ok(citations.some((citation) => citation.factType === "clinical_summary" && citation.reviewStatus === "reviewed"), `${conceptSlug} needs a reviewed clinical summary citation`)
    }

    assert.ok(searchAnatomyFoundation("action potential").some((result) => result.slug === "action-potential"))
    assert.ok(searchAnatomyFoundation("parasympathetic").some((result) => result.slug === "parasympathetic-division"))
    assert.ok(searchAnatomyFoundation("reflex arc").some((result) => result.slug === "reflex-arc"))
  })

  it("adds strong musculoskeletal function and tissue-repair concept coverage with reviewed reusable citations", () => {
    const conceptBySlug = new Map(ANATOMY_FOUNDATION_SEED.concepts.map((concept) => [concept.slug, concept]))
    const sourceBySlug = new Map(ANATOMY_FOUNDATION_SEED.sources.map((source) => [source.slug, source]))
    const expectedConceptSlugs = [
      "joint-movement",
      "muscle-action",
      "force-production",
      "joint-stability",
      "mobility",
      "postural-control",
      "kinetic-chain",
      "open-chain-movement",
      "closed-chain-movement",
      "lever-system",
      "length-tension-relationship",
      "load-transfer",
      "functional-movement",
      "motor-learning",
      "collagen-remodeling",
      "granulation-tissue",
      "edema",
      "fibrosis",
      "acute-injury",
      "subacute-repair",
      "chronic-tissue-change",
      "tissue-irritability",
      "tissue-load-tolerance",
      "protective-muscle-guarding",
      "contraindication-red-flag",
      "scope-aware-referral",
    ]

    for (const conceptSlug of expectedConceptSlugs) {
      const concept = conceptBySlug.get(conceptSlug)
      const citations = ANATOMY_FOUNDATION_SEED.citations.filter((citation) => citation.entityType === "anatomy_concept" && citation.entitySlug === conceptSlug)

      assert.ok(concept, `${conceptSlug} should be seeded as an anatomy concept`)
      assert.equal(sourceBySlug.get(concept?.sourceRef ?? "")?.usageScope, "open_reuse", `${conceptSlug} must use an open-reuse source`)
      assert.ok(citations.some((citation) => citation.factType === "clinical_summary" && citation.reviewStatus === "reviewed"), `${conceptSlug} needs a reviewed clinical summary citation`)
    }

    assert.ok(searchAnatomyFoundation("kinetic chain").some((result) => result.slug === "kinetic-chain"))
    assert.ok(searchAnatomyFoundation("collagen remodeling").some((result) => result.slug === "collagen-remodeling"))
    assert.ok(searchAnatomyFoundation("red flag").some((result) => result.slug === "contraindication-red-flag"))
  })

  it("closes the next atlas muscle gap batch with individual searchable records and reviewed citations", () => {
    const sourceBySlug = new Map(ANATOMY_FOUNDATION_SEED.sources.map((source) => [source.slug, source]))
    const expectedMuscleSlugs = [
      "superior-rectus",
      "inferior-rectus",
      "medial-rectus",
      "lateral-rectus",
      "superior-oblique",
      "inferior-oblique",
      "levator-palpebrae-superioris",
      "cricothyroid",
      "posterior-cricoarytenoid",
      "lateral-cricoarytenoid",
      "transverse-arytenoid",
      "oblique-arytenoid",
      "thyroarytenoid",
      "vocalis",
      "stylopharyngeus",
      "salpingopharyngeus",
      "palatopharyngeus",
      "superior-pharyngeal-constrictor",
      "middle-pharyngeal-constrictor",
      "inferior-pharyngeal-constrictor",
      "tensor-veli-palatini",
      "levator-veli-palatini",
      "uvula-muscle",
      "iliocostalis-cervicis",
      "iliocostalis-thoracis",
      "iliocostalis-lumborum",
      "longissimus-capitis",
      "longissimus-cervicis",
      "longissimus-thoracis",
      "spinalis-capitis",
      "spinalis-cervicis",
      "spinalis-thoracis",
      "rotatores",
      "interspinales",
      "intertransversarii",
      "levator-ani-pubococcygeus",
      "levator-ani-puborectalis",
      "levator-ani-iliococcygeus",
      "dorsal-interosseous-hand-1",
      "dorsal-interosseous-hand-2",
      "dorsal-interosseous-hand-3",
      "dorsal-interosseous-hand-4",
      "palmar-interosseous-hand-1",
      "palmar-interosseous-hand-2",
      "palmar-interosseous-hand-3",
      "lumbrical-hand-1",
      "lumbrical-hand-2",
      "lumbrical-hand-3",
      "lumbrical-hand-4",
      "dorsal-interosseous-foot-1",
      "dorsal-interosseous-foot-2",
      "dorsal-interosseous-foot-3",
      "dorsal-interosseous-foot-4",
      "plantar-interosseous-foot-1",
      "plantar-interosseous-foot-2",
      "plantar-interosseous-foot-3",
      "lumbrical-foot-1",
      "lumbrical-foot-2",
      "lumbrical-foot-3",
      "lumbrical-foot-4",
    ]

    for (const muscleSlug of expectedMuscleSlugs) {
      const muscle = ANATOMY_FOUNDATION_SEED.muscles.find((entry) => entry.slug === muscleSlug)
      const terms = ANATOMY_FOUNDATION_SEED.entityTerms.filter((term) => term.anatomyEntityType === "muscle" && term.anatomyEntitySlug === muscleSlug)
      const attachments = ANATOMY_FOUNDATION_SEED.muscleAttachments.filter((attachment) => attachment.muscle === muscleSlug)
      const actions = ANATOMY_FOUNDATION_SEED.muscleActions.filter((action) => action.muscle === muscleSlug)
      const innervations = ANATOMY_FOUNDATION_SEED.muscleInnervations.filter((innervation) => innervation.muscle === muscleSlug)
      const identifiers = ANATOMY_FOUNDATION_SEED.externalIdentifiers.filter((identifier) => identifier.entityType === "muscle" && identifier.entitySlug === muscleSlug)
      const citations = ANATOMY_FOUNDATION_SEED.citations.filter((citation) => citation.entityType === "muscle" && citation.entitySlug === muscleSlug && citation.reviewStatus === "reviewed")
      const factTypes = new Set(citations.map((citation) => citation.factType))

      assert.ok(muscle, `${muscleSlug} should be seeded`)
      assert.equal(sourceBySlug.get(muscle?.sourceRef ?? "")?.usageScope, "open_reuse", `${muscleSlug} must use an open-reuse source`)
      assert.ok((muscle?.description ?? "").length > 70, `${muscleSlug} needs a MassageLab-authored summary`)
      assert.ok(terms.some((term) => ["preferred", "formal"].includes(term.termType) && term.sourceRef === "fipat-ta2"), `${muscleSlug} needs FIPAT-backed terminology`)
      assert.ok(identifiers.length >= 1, `${muscleSlug} needs an external terminology or ontology identifier`)
      assert.ok(attachments.length >= 2, `${muscleSlug} needs origin and insertion facts`)
      assert.ok(actions.length >= 1, `${muscleSlug} needs action facts`)
      assert.ok(innervations.length >= 1, `${muscleSlug} needs innervation facts`)

      for (const factType of ["clinical_summary", "official_term", "external_identifier", "origin", "insertion", "action", "innervation"]) {
        assert.ok(factTypes.has(factType), `${muscleSlug} needs a reviewed ${factType} citation`)
      }
    }

    assert.ok(searchAnatomyFoundation("extraocular muscle").some((result) => result.slug === "superior-rectus"))
    assert.ok(searchAnatomyFoundation("vocal fold muscle").some((result) => result.slug === "vocalis"))
    assert.ok(searchAnatomyFoundation("first dorsal interosseous").some((result) => result.slug === "dorsal-interosseous-hand-1"))
    assert.ok(searchAnatomyFoundation("third foot lumbrical").some((result) => result.slug === "lumbrical-foot-3"))
  })

  it("closes the next ligament, neurovascular, and sensory-structure atlas gap batch", () => {
    const sourceBySlug = new Map(ANATOMY_FOUNDATION_SEED.sources.map((source) => [source.slug, source]))
    const expectedLigaments = [
      "anterior-longitudinal-ligament",
      "posterior-longitudinal-ligament",
      "ligamentum-flavum",
      "interspinous-ligament",
      "supraspinous-ligament",
      "sacrospinous-ligament",
      "sacrotuberous-ligament",
      "inguinal-ligament",
      "annular-ligament-radius",
      "ulnar-collateral-ligament-elbow",
      "radial-collateral-ligament-elbow",
      "radiocarpal-ligaments",
      "ulnar-collateral-ligament-thumb",
      "transverse-metacarpal-ligaments",
      "pubofemoral-ligament",
      "ischiofemoral-ligament",
      "ligamentum-teres-femoris",
      "fibular-collateral-ligament",
      "tibial-collateral-ligament",
      "patellar-ligament",
      "spring-ligament",
      "long-plantar-ligament",
      "bifurcate-ligament",
    ]
    const expectedNerves = [
      "olfactory-nerve",
      "optic-nerve",
      "oculomotor-nerve",
      "trochlear-nerve",
      "abducens-nerve",
      "vestibulocochlear-nerve",
      "glossopharyngeal-nerve",
      "genitofemoral-nerve",
      "lateral-femoral-cutaneous-nerve",
      "superior-cluneal-nerves",
      "sural-nerve",
      "saphenous-nerve",
      "superficial-fibular-nerve",
    ]
    const expectedVessels = [
      "aortic-arch",
      "thoracic-aorta",
      "common-carotid-artery",
      "internal-carotid-artery",
      "vertebral-artery",
      "palmar-arches",
      "common-iliac-artery",
      "external-iliac-artery",
      "deep-femoral-artery",
      "plantar-arteries",
      "superior-vena-cava",
      "inferior-vena-cava",
      "internal-jugular-vein",
      "brachial-veins",
      "radial-veins",
      "ulnar-veins",
      "great-saphenous-vein",
      "small-saphenous-vein",
      "portal-vein",
    ]
    const expectedStructures = [
      "cornea",
      "lens",
      "sclera",
      "iris",
      "optic-disc",
      "tympanic-membrane",
      "auditory-ossicles",
      "semicircular-canals",
      "cricoid-cartilage",
      "arytenoid-cartilage",
      "vocal-fold",
      "epiglottis",
      "lung-lobe",
    ]

    for (const ligamentSlug of expectedLigaments) {
      const ligament = ANATOMY_FOUNDATION_SEED.ligaments.find((entry) => entry.slug === ligamentSlug)
      const citations = ANATOMY_FOUNDATION_SEED.citations.filter((citation) => citation.entityType === "ligament" && citation.entitySlug === ligamentSlug && citation.reviewStatus === "reviewed")
      const terms = ANATOMY_FOUNDATION_SEED.entityTerms.filter((term) => term.anatomyEntityType === "ligament" && term.anatomyEntitySlug === ligamentSlug)

      assert.ok(ligament, `${ligamentSlug} should be seeded`)
      assert.equal(sourceBySlug.get(ligament?.sourceRef ?? "")?.usageScope, "open_reuse", `${ligamentSlug} must use an open-reuse source`)
      assert.ok(terms.some((term) => ["preferred", "formal", "common"].includes(term.termType)), `${ligamentSlug} needs searchable terminology`)
      assert.ok(citations.some((citation) => citation.factType === "clinical_summary"), `${ligamentSlug} needs a reviewed summary citation`)
    }

    for (const nerveSlug of expectedNerves) {
      const nerve = ANATOMY_FOUNDATION_SEED.nerves.find((entry) => entry.slug === nerveSlug)
      const citations = ANATOMY_FOUNDATION_SEED.citations.filter((citation) => citation.entityType === "nerve" && citation.entitySlug === nerveSlug && citation.reviewStatus === "reviewed")
      const identifiers = ANATOMY_FOUNDATION_SEED.externalIdentifiers.filter((identifier) => identifier.entityType === "nerve" && identifier.entitySlug === nerveSlug)

      assert.ok(nerve, `${nerveSlug} should be seeded`)
      assert.equal(sourceBySlug.get(nerve?.sourceRef ?? "")?.usageScope, "open_reuse", `${nerveSlug} must use an open-reuse source`)
      assert.ok(identifiers.length >= 1, `${nerveSlug} needs an external terminology or ontology identifier`)
      assert.ok(citations.some((citation) => citation.factType === "clinical_summary"), `${nerveSlug} needs a reviewed summary citation`)
    }

    for (const vesselSlug of expectedVessels) {
      const vessel = ANATOMY_FOUNDATION_SEED.bloodSupply.find((entry) => entry.slug === vesselSlug)
      const citations = ANATOMY_FOUNDATION_SEED.citations.filter((citation) => citation.entityType === "blood_supply" && citation.entitySlug === vesselSlug && citation.reviewStatus === "reviewed")
      const identifiers = ANATOMY_FOUNDATION_SEED.externalIdentifiers.filter((identifier) => identifier.entityType === "blood_supply" && identifier.entitySlug === vesselSlug)

      assert.ok(vessel, `${vesselSlug} should be seeded`)
      assert.equal(sourceBySlug.get(vessel?.sourceRef ?? "")?.usageScope, "open_reuse", `${vesselSlug} must use an open-reuse source`)
      assert.ok(identifiers.length >= 1, `${vesselSlug} needs an external terminology or ontology identifier`)
      assert.ok(citations.some((citation) => citation.factType === "clinical_summary"), `${vesselSlug} needs a reviewed summary citation`)
    }

    for (const structureSlug of expectedStructures) {
      const structure = ANATOMY_FOUNDATION_SEED.structures.find((entry) => entry.slug === structureSlug)
      const citations = ANATOMY_FOUNDATION_SEED.citations.filter((citation) => citation.entityType === "anatomy_structure" && citation.entitySlug === structureSlug && citation.reviewStatus === "reviewed")
      const identifiers = ANATOMY_FOUNDATION_SEED.externalIdentifiers.filter((identifier) => identifier.entityType === "anatomy_structure" && identifier.entitySlug === structureSlug)

      assert.ok(structure, `${structureSlug} should be seeded`)
      assert.equal(sourceBySlug.get(structure?.sourceRef ?? "")?.usageScope, "open_reuse", `${structureSlug} must use an open-reuse source`)
      assert.ok(identifiers.length >= 1, `${structureSlug} needs an external terminology or ontology identifier`)
      assert.ok(citations.some((citation) => citation.factType === "clinical_summary"), `${structureSlug} needs a reviewed summary citation`)
    }

    assert.ok(searchAnatomyFoundation("optic nerve").some((result) => result.slug === "optic-nerve"))
    assert.ok(searchAnatomyFoundation("vocal fold").some((result) => result.slug === "vocal-fold"))
    assert.ok(searchAnatomyFoundation("great saphenous vein").some((result) => result.slug === "great-saphenous-vein"))
  })

  it("closes the broader named-muscle atlas gap batch and links aggregate muscle rows to members", () => {
    const sourceBySlug = new Map(ANATOMY_FOUNDATION_SEED.sources.map((source) => [source.slug, source]))
    const expectedMuscleSlugs = [
      "corrugator-supercilii",
      "procerus",
      "levator-labii-superioris-alaeque-nasi",
      "levator-anguli-oris",
      "depressor-septi-nasi",
      "auricularis-anterior",
      "auricularis-superior",
      "auricularis-posterior",
      "superior-longitudinal-tongue",
      "inferior-longitudinal-tongue",
      "transverse-tongue",
      "vertical-tongue",
      "aryepiglotticus",
      "thyroepiglotticus",
      "rectus-capitis-anterior",
      "rectus-capitis-lateralis",
      "semispinalis-cervicis",
      "semispinalis-thoracis",
      "multifidus-cervicis",
      "multifidus-thoracis",
      "levatores-costarum",
      "pectoralis-major-sternocostal-head",
      "pectoralis-major-abdominal-head",
      "deltoid-anterior-fibers",
      "deltoid-middle-fibers",
      "deltoid-posterior-fibers",
      "extensor-carpi-radialis-longus",
      "extensor-carpi-radialis-brevis",
      "extensor-indicis",
      "extensor-digiti-minimi",
      "psoas-minor",
      "adductor-minimus",
      "adductor-hallucis-oblique-head",
      "adductor-hallucis-transverse-head",
    ]

    for (const muscleSlug of expectedMuscleSlugs) {
      const muscle = ANATOMY_FOUNDATION_SEED.muscles.find((entry) => entry.slug === muscleSlug)
      const terms = ANATOMY_FOUNDATION_SEED.entityTerms.filter((term) => term.anatomyEntityType === "muscle" && term.anatomyEntitySlug === muscleSlug)
      const attachments = ANATOMY_FOUNDATION_SEED.muscleAttachments.filter((attachment) => attachment.muscle === muscleSlug)
      const actions = ANATOMY_FOUNDATION_SEED.muscleActions.filter((action) => action.muscle === muscleSlug)
      const innervations = ANATOMY_FOUNDATION_SEED.muscleInnervations.filter((innervation) => innervation.muscle === muscleSlug)
      const identifiers = ANATOMY_FOUNDATION_SEED.externalIdentifiers.filter((identifier) => identifier.entityType === "muscle" && identifier.entitySlug === muscleSlug)
      const citations = ANATOMY_FOUNDATION_SEED.citations.filter((citation) => citation.entityType === "muscle" && citation.entitySlug === muscleSlug && citation.reviewStatus === "reviewed")
      const factTypes = new Set(citations.map((citation) => citation.factType))

      assert.ok(muscle, `${muscleSlug} should be seeded`)
      assert.equal(sourceBySlug.get(muscle?.sourceRef ?? "")?.usageScope, "open_reuse", `${muscleSlug} must use an open-reuse source`)
      assert.ok((muscle?.description ?? "").length > 75, `${muscleSlug} needs a MassageLab-authored display summary`)
      assert.ok(terms.some((term) => ["preferred", "formal"].includes(term.termType) && term.sourceRef === "fipat-ta2"), `${muscleSlug} needs FIPAT-backed terminology`)
      assert.ok(identifiers.length >= 1, `${muscleSlug} needs an external terminology or ontology identifier`)
      assert.ok(attachments.length >= 2, `${muscleSlug} needs origin and insertion facts`)
      assert.ok(actions.length >= 1, `${muscleSlug} needs action facts`)
      assert.ok(innervations.length >= 1, `${muscleSlug} needs innervation facts`)

      for (const factType of ["clinical_summary", "official_term", "external_identifier", "origin", "insertion", "action", "innervation"]) {
        assert.ok(factTypes.has(factType), `${muscleSlug} needs a reviewed ${factType} citation`)
      }
    }

    const relationshipKeys = new Set(ANATOMY_FOUNDATION_SEED.relationships.map((relationship) => [
      relationship.sourceEntityType,
      relationship.sourceEntitySlug,
      relationship.relationshipType,
      relationship.targetEntityType,
      relationship.targetEntitySlug,
    ].join(":")))
    for (const relationshipKey of [
      "muscle:hamstrings:includes_muscle:muscle:biceps-femoris",
      "muscle:adductor-group:includes_muscle:muscle:adductor-longus",
      "muscle:scalenes:includes_muscle:muscle:anterior-scalene",
      "muscle:suboccipital-muscles:includes_muscle:muscle:rectus-capitis-posterior-major",
      "muscle:iliopsoas:includes_muscle:muscle:psoas-major",
      "muscle:dorsal-interossei-hand:includes_muscle:muscle:dorsal-interosseous-hand-1",
      "muscle:lumbricals-foot:includes_muscle:muscle:lumbrical-foot-4",
    ]) {
      assert.ok(relationshipKeys.has(relationshipKey), `${relationshipKey} should link aggregate anatomy to member records`)
    }

    assert.ok(searchAnatomyFoundation("corrugator supercilii").some((result) => result.slug === "corrugator-supercilii"))
    assert.ok(searchAnatomyFoundation("intrinsic tongue muscle").some((result) => result.slug === "superior-longitudinal-tongue"))
    assert.ok(searchAnatomyFoundation("ECRB").some((result) => result.slug === "extensor-carpi-radialis-brevis"))
  })

  it("closes small bone, tooth, and remaining ligament atlas gaps with first-class rows", () => {
    const sourceBySlug = new Map(ANATOMY_FOUNDATION_SEED.sources.map((source) => [source.slug, source]))
    const expectedBones = [
      "malleus",
      "incus",
      "stapes",
      "manubrium",
      "body-of-sternum",
      "xiphoid-process",
      "s1-vertebra",
      "s2-vertebra",
      "s3-vertebra",
      "s4-vertebra",
      "s5-vertebra",
      "coccygeal-vertebrae",
      "hand-sesamoid-bones",
      "foot-sesamoid-bones",
    ]
    const expectedStructures = ["tooth", "upper-teeth", "lower-teeth", "costal-cartilages"]
    const expectedLigaments = [
      "apical-ligament-of-dens",
      "tectorial-membrane",
      "intertransverse-ligaments",
      "facet-joint-capsules",
      "superior-glenohumeral-ligament",
      "middle-glenohumeral-ligament",
      "inferior-glenohumeral-ligament",
      "conoid-ligament",
      "trapezoid-ligament",
      "transverse-humeral-ligament",
      "oblique-popliteal-ligament",
      "arcuate-popliteal-ligament",
      "transverse-ligament-of-knee",
      "posterior-meniscofemoral-ligament",
      "anterior-meniscofemoral-ligament",
      "calcaneofibular-ligament",
      "posterior-talofibular-ligament",
      "anterior-tibiofibular-ligament",
      "posterior-tibiofibular-ligament",
      "interosseous-talocalcaneal-ligament",
      "dorsal-tarsometatarsal-ligaments",
      "plantar-tarsometatarsal-ligaments",
    ]

    for (const boneSlug of expectedBones) {
      const bone = ANATOMY_FOUNDATION_SEED.bones.find((entry) => entry.slug === boneSlug)
      const landmark = ANATOMY_FOUNDATION_SEED.boneLandmarks.find((entry) => entry.bone === boneSlug)
      const citations = ANATOMY_FOUNDATION_SEED.citations.filter((citation) => citation.entityType === "bone" && citation.entitySlug === boneSlug && citation.reviewStatus === "reviewed")
      const factTypes = new Set(citations.map((citation) => citation.factType))
      const identifiers = ANATOMY_FOUNDATION_SEED.externalIdentifiers.filter((identifier) => identifier.entityType === "bone" && identifier.entitySlug === boneSlug)

      assert.ok(bone, `${boneSlug} should be seeded`)
      assert.equal(sourceBySlug.get(bone?.sourceRef ?? "")?.usageScope, "open_reuse", `${boneSlug} must use an open-reuse source`)
      assert.ok((bone?.description ?? "").length > 70, `${boneSlug} needs a MassageLab-authored summary`)
      assert.ok(landmark, `${boneSlug} needs a seed-addressable landmark`)
      assert.ok(identifiers.length >= 1, `${boneSlug} needs an external terminology or ontology identifier`)
      for (const factType of ["clinical_summary", "official_term", "external_identifier"]) {
        assert.ok(factTypes.has(factType), `${boneSlug} needs a reviewed ${factType} citation`)
      }
    }

    for (const structureSlug of expectedStructures) {
      const structure = ANATOMY_FOUNDATION_SEED.structures.find((entry) => entry.slug === structureSlug)
      const citations = ANATOMY_FOUNDATION_SEED.citations.filter((citation) => citation.entityType === "anatomy_structure" && citation.entitySlug === structureSlug && citation.reviewStatus === "reviewed")
      const identifiers = ANATOMY_FOUNDATION_SEED.externalIdentifiers.filter((identifier) => identifier.entityType === "anatomy_structure" && identifier.entitySlug === structureSlug)

      assert.ok(structure, `${structureSlug} should be seeded`)
      assert.equal(sourceBySlug.get(structure?.sourceRef ?? "")?.usageScope, "open_reuse", `${structureSlug} must use an open-reuse source`)
      assert.ok(identifiers.length >= 1, `${structureSlug} needs an external terminology or ontology identifier`)
      assert.ok(citations.some((citation) => citation.factType === "clinical_summary"), `${structureSlug} needs a reviewed summary citation`)
    }

    for (const ligamentSlug of expectedLigaments) {
      const ligament = ANATOMY_FOUNDATION_SEED.ligaments.find((entry) => entry.slug === ligamentSlug)
      const citations = ANATOMY_FOUNDATION_SEED.citations.filter((citation) => citation.entityType === "ligament" && citation.entitySlug === ligamentSlug && citation.reviewStatus === "reviewed")
      const relationship = ANATOMY_FOUNDATION_SEED.relationships.find((entry) => entry.sourceEntityType === "ligament" && entry.sourceEntitySlug === ligamentSlug)
      const identifiers = ANATOMY_FOUNDATION_SEED.externalIdentifiers.filter((identifier) => identifier.entityType === "ligament" && identifier.entitySlug === ligamentSlug)

      assert.ok(ligament, `${ligamentSlug} should be seeded`)
      assert.ok(ligament?.joint, `${ligamentSlug} needs a primary joint context`)
      assert.equal(sourceBySlug.get(ligament?.sourceRef ?? "")?.usageScope, "open_reuse", `${ligamentSlug} must use an open-reuse source`)
      assert.ok(relationship, `${ligamentSlug} needs a browseable relationship`)
      assert.ok(identifiers.length >= 1, `${ligamentSlug} needs an external terminology or ontology identifier`)
      assert.ok(citations.some((citation) => citation.factType === "clinical_summary"), `${ligamentSlug} needs a reviewed summary citation`)
      assert.ok(citations.some((citation) => citation.factType === "ligament_relationship"), `${ligamentSlug} needs a reviewed relationship citation`)
    }

    assert.ok(searchAnatomyFoundation("stapes").some((result) => result.slug === "stapes"))
    assert.ok(searchAnatomyFoundation("costal cartilage").some((result) => result.slug === "costal-cartilages"))
    assert.ok(searchAnatomyFoundation("calcaneofibular ligament").some((result) => result.slug === "calcaneofibular-ligament"))
  })

  it("closes macro vascular and lymphatic pathway atlas gaps", () => {
    const vesselSlugs = [
      "brachiocephalic-trunk",
      "celiac-trunk",
      "superior-mesenteric-artery",
      "inferior-mesenteric-artery",
      "renal-arteries",
      "gonadal-arteries",
      "pulmonary-trunk",
      "pulmonary-arteries",
      "pulmonary-veins",
      "coronary-arteries",
      "cardiac-veins",
      "brachiocephalic-veins",
      "azygos-vein",
      "hemiazygos-vein",
      "hepatic-veins",
      "renal-veins",
      "common-iliac-veins",
      "internal-iliac-vein",
      "external-iliac-vein",
      "axillary-vein",
      "median-cubital-vein",
      "dorsal-venous-network-hand",
      "dorsal-venous-arch-foot",
    ]
    const lymphStructureSlugs = [
      "cisterna-chyli",
      "right-venous-angle",
      "left-venous-angle",
      "superficial-cervical-lymph-nodes",
      "deep-cervical-lymph-nodes",
      "supraclavicular-lymph-nodes",
      "parasternal-lymph-nodes",
      "mediastinal-lymph-nodes",
      "mesenteric-lymph-nodes",
      "lumbar-lymph-nodes",
      "external-iliac-lymph-nodes",
      "internal-iliac-lymph-nodes",
      "sacral-lymph-nodes",
      "superficial-inguinal-lymph-nodes",
      "deep-inguinal-lymph-nodes",
      "cubital-lymph-nodes",
    ]
    const relationshipKeys = new Set(ANATOMY_FOUNDATION_SEED.relationships.map((relationship) => (
      `${relationship.sourceEntityType}:${relationship.sourceEntitySlug}:${relationship.relationshipType}:${relationship.targetEntityType}:${relationship.targetEntitySlug}`
    )))

    assertCommercialSafeEntityPack("blood_supply", ANATOMY_FOUNDATION_SEED.bloodSupply, vesselSlugs, { identifierProviders: ["FIPAT", "UBERON", "NCIT"] })
    assertCommercialSafeStructurePack(lymphStructureSlugs)

    for (const relationshipKey of [
      "blood_supply:aortic-arch:branches_to:blood_supply:brachiocephalic-trunk",
      "blood_supply:abdominal-aorta:branches_to:blood_supply:celiac-trunk",
      "blood_supply:pulmonary-trunk:branches_to:blood_supply:pulmonary-arteries",
      "blood_supply:brachiocephalic-veins:drains_to:blood_supply:superior-vena-cava",
      "blood_supply:azygos-vein:drains_to:blood_supply:superior-vena-cava",
      "blood_supply:common-iliac-veins:drains_to:blood_supply:inferior-vena-cava",
      "anatomy_structure:cisterna-chyli:drains_to:anatomy_structure:thoracic-duct",
      "anatomy_structure:thoracic-duct:drains_to:anatomy_structure:left-venous-angle",
      "anatomy_structure:right-lymphatic-duct:drains_to:anatomy_structure:right-venous-angle",
      "anatomy_structure:superficial-inguinal-lymph-nodes:drains_to:anatomy_structure:deep-inguinal-lymph-nodes",
    ]) {
      assert.ok(relationshipKeys.has(relationshipKey), `${relationshipKey} relationship should be seeded`)
    }

    assert.ok(searchAnatomyFoundation("celiac trunk").some((result) => result.slug === "celiac-trunk"))
    assert.ok(searchAnatomyFoundation("cisterna chyli").some((result) => result.slug === "cisterna-chyli"))
    assert.ok(searchAnatomyFoundation("median cubital vein").some((result) => result.slug === "median-cubital-vein"))
  })

  it("expands atlas depth with individual teeth, cutaneous nerves, vessel branches, lymph nodes, and tendons", () => {
    const toothSlugs = [
      "tooth-1-maxillary-right-third-molar",
      "tooth-8-maxillary-right-central-incisor",
      "tooth-9-maxillary-left-central-incisor",
      "tooth-16-maxillary-left-third-molar",
      "tooth-17-mandibular-left-third-molar",
      "tooth-24-mandibular-left-central-incisor",
      "tooth-25-mandibular-right-central-incisor",
      "tooth-32-mandibular-right-third-molar",
    ]
    const cutaneousNerveSlugs = [
      "greater-occipital-nerve",
      "lesser-occipital-nerve",
      "great-auricular-nerve",
      "transverse-cervical-nerve",
      "supraclavicular-nerves",
      "medial-antebrachial-cutaneous-nerve",
      "lateral-antebrachial-cutaneous-nerve",
      "medial-brachial-cutaneous-nerve",
    ]
    const vesselBranchSlugs = [
      "left-gastric-artery",
      "splenic-artery",
      "common-hepatic-artery",
      "gastroduodenal-artery",
      "superior-rectal-artery",
      "middle-rectal-artery",
      "inferior-rectal-artery",
      "posterior-auricular-artery",
    ]
    const lymphNodeSlugs = [
      "occipital-lymph-nodes",
      "mastoid-lymph-nodes",
      "parotid-lymph-nodes",
      "submandibular-lymph-nodes",
      "submental-lymph-nodes",
      "pectoral-axillary-lymph-nodes",
      "humeral-axillary-lymph-nodes",
      "central-axillary-lymph-nodes",
      "apical-axillary-lymph-nodes",
    ]
    const tendonStructureSlugs = [
      "patellar-tendon",
      "quadriceps-tendon",
      "common-extensor-tendon",
      "common-flexor-tendon",
      "plantar-plate",
      "palmar-aponeurosis",
    ]
    const relationshipKeys = new Set(ANATOMY_FOUNDATION_SEED.relationships.map((relationship) => (
      `${relationship.sourceEntityType}:${relationship.sourceEntitySlug}:${relationship.relationshipType}:${relationship.targetEntityType}:${relationship.targetEntitySlug}`
    )))

    assertCommercialSafeStructurePack(toothSlugs)
    assertCommercialSafeEntityPack("nerve", ANATOMY_FOUNDATION_SEED.nerves, cutaneousNerveSlugs, { identifierProviders: ["FIPAT", "UBERON", "NCIT"] })
    assertCommercialSafeEntityPack("blood_supply", ANATOMY_FOUNDATION_SEED.bloodSupply, vesselBranchSlugs, { identifierProviders: ["FIPAT", "UBERON", "NCIT"] })
    assertCommercialSafeStructurePack(lymphNodeSlugs)
    assertCommercialSafeStructurePack(tendonStructureSlugs)

    for (const relationshipKey of [
      "anatomy_structure:tooth-8-maxillary-right-central-incisor:member_of:anatomy_structure:upper-teeth",
      "anatomy_structure:tooth-24-mandibular-left-central-incisor:member_of:anatomy_structure:lower-teeth",
      "nerve:great-auricular-nerve:supplies_cutaneous_region:region:neck",
      "nerve:lateral-antebrachial-cutaneous-nerve:supplies_cutaneous_region:region:forearm",
      "blood_supply:left-gastric-artery:branches_from:blood_supply:celiac-trunk",
      "blood_supply:superior-rectal-artery:branches_from:blood_supply:inferior-mesenteric-artery",
      "anatomy_structure:submandibular-lymph-nodes:drains_to:anatomy_structure:deep-cervical-lymph-nodes",
      "anatomy_structure:apical-axillary-lymph-nodes:drains_to:anatomy_structure:subclavian-lymphatic-trunk",
      "anatomy_structure:patellar-tendon:associated_with:joint:knee-joint",
      "anatomy_structure:common-extensor-tendon:associated_with:bone_landmark:lateral-epicondyle-humerus",
    ]) {
      assert.ok(relationshipKeys.has(relationshipKey), `${relationshipKey} relationship should be seeded`)
    }

    assert.ok(searchAnatomyFoundation("upper right central incisor").some((result) => result.slug === "tooth-8-maxillary-right-central-incisor"))
    assert.ok(searchAnatomyFoundation("great auricular nerve").some((result) => result.slug === "great-auricular-nerve"))
    assert.ok(searchAnatomyFoundation("submandibular lymph nodes").some((result) => result.slug === "submandibular-lymph-nodes"))
    assert.ok(searchAnatomyFoundation("patellar tendon").some((result) => result.slug === "patellar-tendon"))
  })

  it("closes atlas enrichment gaps for terms, identifiers, ROM tracking, and relationships", () => {
    const termKeys = new Set(ANATOMY_FOUNDATION_SEED.entityTerms.map((term) => `${term.anatomyEntityType}:${term.anatomyEntitySlug}`))
    const identifierKeys = new Set(ANATOMY_FOUNDATION_SEED.externalIdentifiers.map((identifier) => `${identifier.entityType}:${identifier.entitySlug}`))
    const movementRomKeys = new Set(ANATOMY_FOUNDATION_SEED.rangesOfMotion.map((range) => range.movement))
    const relationshipKeys = new Set()

    for (const relationship of ANATOMY_FOUNDATION_SEED.relationships) {
      relationshipKeys.add(`${relationship.sourceEntityType}:${relationship.sourceEntitySlug}`)
      relationshipKeys.add(`${relationship.targetEntityType}:${relationship.targetEntitySlug}`)
    }

    const typedCollections = {
      bone: ANATOMY_FOUNDATION_SEED.bones,
      bone_landmark: ANATOMY_FOUNDATION_SEED.boneLandmarks,
      joint: ANATOMY_FOUNDATION_SEED.joints,
      joint_movement: ANATOMY_FOUNDATION_SEED.jointMovements,
      muscle: ANATOMY_FOUNDATION_SEED.muscles,
      nerve: ANATOMY_FOUNDATION_SEED.nerves,
      ligament: ANATOMY_FOUNDATION_SEED.ligaments,
      blood_supply: ANATOMY_FOUNDATION_SEED.bloodSupply,
      anatomy_structure: ANATOMY_FOUNDATION_SEED.structures,
      pain_map_region: ANATOMY_FOUNDATION_SEED.painMapRegions,
    }
    const termRequiredTypes = ["joint", "joint_movement", "nerve", "ligament", "blood_supply", "anatomy_structure", "pain_map_region"]
    const identifierRequiredTypes = ["bone_landmark", "joint", "joint_movement", "nerve", "ligament", "blood_supply", "anatomy_structure", "pain_map_region"]
    const relationshipRequiredTypes = Object.keys(typedCollections)

    for (const entityType of termRequiredTypes) {
      assert.deepEqual(typedCollections[entityType]
        .filter((entry) => !termKeys.has(`${entityType}:${entry.slug}`))
        .map((entry) => entry.slug), [], `${entityType} records need normalized terminology`)
    }

    for (const entityType of identifierRequiredTypes) {
      assert.deepEqual(typedCollections[entityType]
        .filter((entry) => !identifierKeys.has(`${entityType}:${entry.slug}`))
        .map((entry) => entry.slug), [], `${entityType} records need a stable identifier row`)
    }

    for (const entityType of relationshipRequiredTypes) {
      assert.deepEqual(typedCollections[entityType]
        .filter((entry) => !relationshipKeys.has(`${entityType}:${entry.slug}`))
        .map((entry) => entry.slug), [], `${entityType} records need at least one browseable relationship`)
    }

    assert.deepEqual(ANATOMY_FOUNDATION_SEED.jointMovements
      .filter((movement) => !movementRomKeys.has(movement.slug))
      .map((movement) => movement.slug), [], "every joint movement needs degree ROM or a non-diagnostic tracking protocol")
    assert.ok(ANATOMY_FOUNDATION_SEED.rangesOfMotion.some((range) =>
      range.slug === "rom-tracking-scapular-elevation" &&
      range.measurementUnit === "ordinal_0_5" &&
      range.sourceRef === "massagelab-authored-rom-tracking"))
    assert.ok(searchAnatomyFoundation("top of shoulder body map").some((result) => result.slug === "top-of-shoulder"))
    assert.ok(searchAnatomyFoundation("scapular elevation tracking").some((result) => result.slug === "scapular-elevation"))
  })

  it("creates citation backlog rows for every source-referenced seed record", () => {
    const coverage = getAnatomyCitationCoverage()

    assert.ok(coverage.sourceReferencedFactCount > 700)
    assert.equal(coverage.missingSourceReferenceCitationKeys.length, 0)
    assert.equal(coverage.sourceReferenceCitationCount, coverage.sourceReferencedFactCount)
    assert.ok(coverage.reviewedCitationCount >= 8)
    assert.ok(coverage.reviewedCitationCount > 3000)
    assert.ok(coverage.needsReviewCitationCount > 0)
  })

  it("matures commercial-safe seed source-reference citations while leaving deferred sources in review", () => {
    const sourceBySlug = new Map(ANATOMY_FOUNDATION_SEED.sources.map((source) => [source.slug, source]))
    const deferredNeedsReviewSourceRefs = new Set(["massagelab-authored-energetic-anatomy"])
    const seedSourceReferences = ANATOMY_FOUNDATION_SEED.citations.filter((citation) => citation.factType === "seed_source_reference")
    const commercialSafeNeedsReview = seedSourceReferences.filter((citation) => {
      const sourceScope = sourceBySlug.get(citation.sourceRef)?.usageScope

      return citation.reviewStatus === "needs_review"
        && ["open_reuse", "commercial_licensed"].includes(sourceScope)
        && !deferredNeedsReviewSourceRefs.has(citation.sourceRef)
    })
    const remainingNeedsReview = seedSourceReferences.filter((citation) => citation.reviewStatus === "needs_review")
    const reviewedBacklogWithGeneratedLocator = seedSourceReferences.filter((citation) => {
      return citation.reviewStatus === "reviewed" && citation.sourceLocator?.startsWith("Seed sourceRef:")
    })

    assert.deepEqual(commercialSafeNeedsReview.map((citation) => `${citation.entityType}:${citation.entitySlug}:${citation.sourceRef}`), [])
    assert.ok(remainingNeedsReview.length > 0)
    assert.ok(remainingNeedsReview.every((citation) => {
      const sourceScope = sourceBySlug.get(citation.sourceRef)?.usageScope

      return deferredNeedsReviewSourceRefs.has(citation.sourceRef) || !["open_reuse", "commercial_licensed"].includes(sourceScope)
    }))
    assert.ok(seedSourceReferences.filter((citation) => citation.reviewStatus === "reviewed").length > 5000)
    assert.deepEqual(reviewedBacklogWithGeneratedLocator, [])
    assert.ok(getAnatomyCitationCoverage().needsReviewCitationCount < 150)
  })

  it("answers relationship queries for attachments, innervation, actions, ROM, and client language", () => {
    const scapulaMuscles = findMusclesAttachedToBone("scapula").map((muscle) => muscle.slug)
    const accessoryNerveMuscles = findMusclesByInnervation("accessory-nerve").map((muscle) => muscle.slug)
    const shoulderAbductors = findMusclesForJointMovement("shoulder-abduction").map((entry) => entry.muscle.slug)
    const cervicalRotation = findRangeOfMotion("cervical-spine", "cervical-rotation")
    const shoulderBladeTerm = findClientTermMapping("between my shoulder blades")
    const topOfShoulderTerm = findClientTermMapping("top of shoulder")
    const baseOfSkullTerm = findClientTermMapping("base of skull")

    assert.ok(scapulaMuscles.includes("upper-trapezius"))
    assert.ok(scapulaMuscles.includes("levator-scapulae"))
    assert.ok(accessoryNerveMuscles.includes("upper-trapezius"))
    assert.ok(accessoryNerveMuscles.includes("sternocleidomastoid"))
    assert.ok(shoulderAbductors.includes("supraspinatus"))
    assert.ok(shoulderAbductors.includes("deltoid"))
    assert.equal(cervicalRotation?.typicalMinDegrees, 70)
    assert.equal(cervicalRotation?.typicalMaxDegrees, 90)
    assert.equal(shoulderBladeTerm?.mappedRegionSlug, "scapular-region")
    assert.equal(topOfShoulderTerm?.mappedMuscleSlug, "upper-trapezius")
    assert.equal(baseOfSkullTerm?.mappedRegionSlug, "base-of-skull")
  })

  it("finds pain-map overlaps and terminology across formal, alternate, common, and client-friendly terms", () => {
    const scapularOverlaps = findPainMapOverlaps("scapular-region").map((region) => region.slug)
    const shoulderBladeSearch = searchAnatomyFoundation("shoulder blade").map((result) => `${result.entityType}:${result.slug}`)
    const rotatorCuffSearch = searchAnatomyFoundation("rotator cuff").map((result) => result.slug)
    const commonNameSearch = searchAnatomyFoundation("upper trap").map((result) => result.slug)
    const formalNameSearch = searchAnatomyFoundation("teres minor").map((result) => result.slug)
    const clientLanguageSearch = searchAnatomyFoundation("base of skull").map((result) => `${result.entityType}:${result.slug}`)
    const plantarSearch = searchAnatomyFoundation("plantar fascia").map((result) => `${result.entityType}:${result.slug}`)
    const lowBackSearch = searchAnatomyFoundation("low back").map((result) => `${result.entityType}:${result.slug}`)
    const jawSearch = searchAnatomyFoundation("jaw tension").map((result) => `${result.entityType}:${result.slug}`)

    assert.ok(scapularOverlaps.includes("between-shoulder-blades"))
    assert.ok(scapularOverlaps.includes("medial-scapular-border"))
    assert.ok(shoulderBladeSearch.includes("bone:scapula"))
    assert.ok(shoulderBladeSearch.includes("client_term:shoulder-blade-area"))
    assert.ok(rotatorCuffSearch.includes("supraspinatus"))
    assert.ok(rotatorCuffSearch.includes("subscapularis"))
    assert.ok(commonNameSearch.includes("upper-trapezius"))
    assert.ok(formalNameSearch.includes("teres-minor"))
    assert.ok(clientLanguageSearch.includes("client_term:base-of-skull"))
    assert.ok(plantarSearch.includes("anatomy_structure:plantar-fascia"))
    assert.ok(lowBackSearch.includes("client_term:low-back-tightness"))
    assert.ok(jawSearch.includes("client_term:jaw-tension"))
  })

  it("stores relative muscle depth as explicit muscle-to-muscle relationships", () => {
    const relationships = ANATOMY_FOUNDATION_SEED.relationships.map((relationship) => [
      relationship.sourceEntityType,
      relationship.sourceEntitySlug,
      relationship.relationshipType,
      relationship.targetEntityType,
      relationship.targetEntitySlug,
    ].join(":"))

    assert.ok(relationships.includes("muscle:deltoid:superficial_to:muscle:infraspinatus"))
    assert.ok(relationships.includes("muscle:infraspinatus:deep_to:muscle:deltoid"))
    assert.ok(relationships.includes("muscle:latissimus-dorsi:superficial_to:muscle:teres-major"))
    assert.ok(relationships.includes("muscle:teres-major:deep_to:muscle:latissimus-dorsi"))
    assert.ok(relationships.includes("muscle:upper-trapezius:superficial_to:muscle:levator-scapulae"))
    assert.ok(relationships.includes("muscle:levator-scapulae:deep_to:muscle:upper-trapezius"))
  })
})
