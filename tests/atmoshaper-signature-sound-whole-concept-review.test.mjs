import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

const reviewModule = await import("../lib/atmoshaper/signature-sound-whole-concept-review.js").catch(() => ({}))
const outcomeModule = await import("../lib/atmoshaper/signature-sound-whole-concept-outcome.js").catch(() => ({}))
const revisionModule = await import("../lib/atmoshaper/signature-sound-whole-concept-revision.js").catch(() => ({}))
const amendmentModule = await import("../lib/atmoshaper/signature-sound-whole-concept-amendment.js").catch(() => ({}))
const expansionModule = await import("../lib/atmoshaper/signature-sound-catalog-expansion-review.js").catch(() => ({}))
const validateCatalog = reviewModule.validateSignatureSoundWholeConceptReviewCatalog
const validateOutcome = outcomeModule.validateSignatureSoundWholeConceptOutcome
const validateOutcomeCatalog = outcomeModule.validateSignatureSoundWholeConceptOutcomeCatalog
const applyRevisions = revisionModule.applySignatureSoundWholeConceptReviewRevisions
const applyAmendments = amendmentModule.applySignatureSoundWholeConceptReviewAmendments
const validateExpansion = expansionModule.validateSignatureSoundCatalogExpansionReview
const fingerprintModule = await import(
  "../lib/atmoshaper/signature-sound-review-fingerprints.js"
).catch(() => ({}))
const catalogText = await readFile(
  new URL("../data/atmoshaper/signature-sound-whole-concept-review-batches.json", import.meta.url),
  "utf8",
).catch(() => null)
const outcomeCatalogText = await readFile(
  new URL("../data/atmoshaper/signature-sound-whole-concept-chat-outcomes.json", import.meta.url),
  "utf8",
).catch(() => null)
const revisionsText = await readFile(
  new URL("../data/atmoshaper/signature-sound-whole-concept-review-revisions.json", import.meta.url),
  "utf8",
).catch(() => null)
const amendmentsText = await readFile(
  new URL("../data/atmoshaper/signature-sound-whole-concept-review-amendments.json", import.meta.url),
  "utf8",
).catch(() => null)
const expansionText = await readFile(
  new URL("../data/atmoshaper/signature-sound-catalog-expansion-review.json", import.meta.url),
  "utf8",
).catch(() => null)
const constructionReview = JSON.parse(await readFile(
  new URL("../data/atmoshaper/signature-sound-construction-review.json", import.meta.url),
  "utf8",
))
const discoveryReview = JSON.parse(await readFile(
  new URL("../data/atmoshaper/signature-sound-review.json", import.meta.url),
  "utf8",
))

const EXPECTED_BATCHES = [
  ["batch-06-droplets", "moodist:droplets", 1],
  ["batch-07-electrical-interference", "signature-extra:electrical-interference", 1],
  ["batch-08-washing-dishes", "signature-extra:washing-dishes", 1],
  ["batch-09-washing-machine", "moodist:washing-machine", 1],
  ["batch-10-cave-room-tone", "signature-extra:cave-room-tone", 5],
  ["batch-11-room-tone", "signature-extra:room-tone", 6],
  ["batch-12-light-waves", "signature-extra:light-waves", 7],
  ["batch-13-dark-ambient-pad", "signature-extra:dark-ambient-pad", 8],
  ["batch-14-walk-in-snow", "moodist:walk-in-snow", 8],
  ["batch-15-experimental-atmosphere", "signature-extra:experimental-atmosphere", 10],
  ["batch-16-fireworks", "moodist:fireworks", 8],
  ["batch-17-heavy-rain", "moodist:heavy-rain", 12],
  ["batch-18-highway", "moodist:highway", 9],
  ["batch-19-inside-a-train", "moodist:inside-a-train", 5],
  ["batch-20-supermarket", "moodist:supermarket", 4],
  ["batch-21-traffic", "moodist:traffic", 12],
  ["batch-22-tuning-radio", "moodist:tuning-radio", 1],
  ["batch-23-waves", "moodist:waves", 14],
  ["batch-24-beach-ambience", "signature-extra:beach-ambience", 14],
  ["batch-25-bus-station-announcements", "signature-extra:bus-station-announcements", 5],
  ["batch-26-choir-ambience", "signature-extra:choir-ambience", 7],
  ["batch-27-church-bells", "signature-extra:church-bells", 4],
  ["batch-28-countryside-ambience", "signature-extra:countryside-ambience", 20],
  ["batch-29-distant-fireworks", "signature-extra:distant-fireworks", 8],
  ["batch-30-fireplace", "signature-extra:fireplace", 3],
  ["batch-31-forest-atmosphere", "signature-extra:forest-atmosphere", 23],
  ["batch-32-grocery-store", "signature-extra:grocery-store", 4],
  ["batch-33-inside-a-bus", "signature-extra:inside-a-bus", 1],
  ["batch-34-keys-jingling", "signature-extra:keys-jingling", 50],
  ["batch-35-london-ambience", "signature-extra:london-ambience", 12],
  ["batch-36-lunar-wind", "signature-extra:lunar-wind", 11],
  ["batch-37-orthodox-choir", "signature-extra:orthodox-choir", 18],
  ["batch-38-passing-trains", "signature-extra:passing-trains", 7],
  ["batch-39-radio-static", "signature-extra:radio-static", 1],
  ["batch-40-roadside", "signature-extra:roadside", 9],
  ["batch-41-school-playground", "signature-extra:school-playground", 1],
  ["batch-42-space-tension-bed", "signature-extra:space-tension-bed", 16],
  ["batch-43-spaceship-interior", "signature-extra:spaceship-interior", 22],
  ["batch-44-spiritual-acoustics", "signature-extra:spiritual-acoustics", 11],
  ["batch-45-stadium-crowd", "signature-extra:stadium-crowd", 6],
  ["batch-46-subway-interior", "signature-extra:subway-interior", 4],
  ["batch-47-train-station", "signature-extra:train-station", 1],
  ["batch-48-train-station-announcements", "signature-extra:train-station-announcements", 2],
  ["batch-49-transit-announcements", "signature-extra:transit-announcements", 4],
  ["batch-50-vintage-radio-broadcast", "signature-extra:vintage-radio-broadcast", 12],
  ["batch-51-waterfront-cafe", "signature-extra:waterfront-cafe", 1],
]
const EXPECTED_REVIEW_FINGERPRINTS = {
  "batch-06-droplets": "77bae92dff11ae06920beef32cdb075526aeed09e03b701198267653d2c52a7b",
  "batch-07-electrical-interference": "adf0b4f180e1de4019a115766c7198ae1c11ec9703c3d827100301db54ec480c",
  "batch-08-washing-dishes": "8dfa79918fb76f3a77ae823ed878274c11d19bb8174510bfd6d00a1e66040eea",
  "batch-09-washing-machine": "cf4dbc5873470f9ef2b7c50caa36e0f4c21a4734744487892fc8c495173d625b",
  "batch-10-cave-room-tone": "38bfa7ff5b308a1cf73358dc87fa7683ce10e98b276cf5e289c78fb791b79117",
  "batch-11-room-tone": "9f02c8d9bc83f1854db8f56b233d659aaed7c91b8843fa6353c94cab39d7927e",
  "batch-12-light-waves": "7676fd83746a9b7a2f6625c8b790ff94f3c762e8ed9ab3798f6cc4b51362298e",
  "batch-13-dark-ambient-pad": "68e715c3558fef2e0fd3e709a0516b4ca6268f2c24b922ee63d7a19f98e2debe",
  "batch-14-walk-in-snow": "b720fac66405729b31d43904fc2887a6131d40a89a8a374c1b0a069637602600",
  "batch-15-experimental-atmosphere": "22e64e37fce67a70a1feb643262f64ac37d4f4e47b0d10d4e9f614355061ceda",
}

function loadCatalog() {
  assert.ok(catalogText, "expected the committed whole-concept batch catalog")
  assert.equal(typeof validateCatalog, "function")
  return validateCatalog(JSON.parse(catalogText), { constructionReview, discoveryReview })
}

function loadAmendedCatalog() {
  assert.ok(revisionsText, "expected the committed whole-concept revisions")
  assert.ok(amendmentsText, "expected the committed reviewer amendments")
  assert.equal(typeof applyAmendments, "function")
  return applyAmendments(
    applyRevisions(loadCatalog(), JSON.parse(revisionsText)),
    JSON.parse(amendmentsText),
  )
}

function expectedProjection(groupId) {
  const group = constructionReview.groups.find((candidate) => candidate.groupId === groupId)
  assert.ok(group, `expected canonical construction group ${groupId}`)
  const sourceById = new Map(discoveryReview.sources.map((source) => [source.sourceId, source]))
  const transitionRange = group.playback.constraints.find(({ type }) => type === "transition-duration-range")
  return {
    label: group.label,
    sources: group.includedSourceIds.map((sourceId) => {
      const source = sourceById.get(sourceId)
      assert.ok(source, `expected canonical discovery source ${sourceId}`)
      return { sourceId, relativePath: source.relativePath }
    }),
    playbackConfiguration: {
      strategyId: group.playback.strategyId,
      previewSettings: structuredClone(group.playback.previewSettings),
      constructionPolicy: {
        minimumSelectionsBeforeRepeat: group.playback.minimumSelectionsBeforeRepeat,
        transitionDurationRange: transitionRange
          ? {
              minimumSeconds: transitionRange.minimumSeconds,
              maximumSeconds: transitionRange.maximumSeconds,
            }
          : null,
        cadenceBoundary: null,
        overlapNextEvent: group.playback.constraints.some(({ type }) => type === "overlap-next-event"),
      },
    },
  }
}

describe("AtmoShaper whole-concept review catalog", () => {
  it("uses the lightweight shared fingerprint owner without importing the legacy review graphs", async () => {
    const source = await readFile(
      new URL("../lib/atmoshaper/signature-sound-whole-concept-review.js", import.meta.url),
      "utf8",
    )

    assert.equal(typeof fingerprintModule.createSignatureSoundConstructionReviewFingerprint, "function")
    assert.equal(typeof fingerprintModule.createSignatureSoundDiscoveryReviewFingerprint, "function")
    assert.match(source, /from "\.\/signature-sound-review-fingerprints\.js"/)
    assert.doesNotMatch(source, /from "\.\/signature-sound-(?:construction-review|discovery)\.js"/)
  })

  it("projects every accepted source-backed raw concept in one exact review order", () => {
    const catalog = loadCatalog()

    assert.equal(catalog.entries.length, 46)
    assert.deepEqual(
      catalog.entries.map(({ batchId, groupId, sources }) => [batchId, groupId, sources.length]),
      EXPECTED_BATCHES,
    )
    assert.equal(catalog.entries.reduce((total, entry) => total + entry.sources.length, 0), 390)
    assert.equal(new Set(catalog.entries.flatMap((entry) => entry.sources.map(({ sourceId }) => sourceId))).size, 342)
    for (const entry of catalog.entries) {
      const expected = expectedProjection(entry.groupId)
      assert.match(entry.reviewFingerprint, /^[a-f0-9]{64}$/)
      assert.equal(entry.label, expected.label)
      assert.deepEqual(entry.sources, expected.sources)
      assert.deepEqual(entry.playbackConfiguration, expected.playbackConfiguration)
    }
    assert.deepEqual(
      loadCatalog().entries.map(({ reviewFingerprint }) => reviewFingerprint),
      catalog.entries.map(({ reviewFingerprint }) => reviewFingerprint),
      "review fingerprints must be deterministic for the same canonical owners",
    )
    const currentFingerprints = Object.fromEntries(
      catalog.entries.map(({ batchId, reviewFingerprint }) => [batchId, reviewFingerprint]),
    )
    for (const [batchId, expectedFingerprint] of Object.entries(EXPECTED_REVIEW_FINGERPRINTS)) {
      assert.equal(currentFingerprints[batchId], expectedFingerprint, `${batchId} must retain its reviewer identity`)
    }
  })

  it("retains each construction-owned strategy and exact preview settings", () => {
    const catalog = loadCatalog()
    const snow = catalog.entries.find(({ batchId }) => batchId === "batch-14-walk-in-snow")
    const lightWaves = catalog.entries.find(({ batchId }) => batchId === "batch-12-light-waves")

    assert.equal(snow.playbackConfiguration.strategyId, "walking-cadence-sequence")
    assert.deepEqual(snow.playbackConfiguration.previewSettings, { stepsPerMinute: 62, jitterPercent: 30 })
    assert.equal(lightWaves.playbackConfiguration.strategyId, "adaptive-whole-source-sequence")
    assert.deepEqual(lightWaves.playbackConfiguration.previewSettings, {
      transitionMode: "crossfade",
      transitionSeconds: 2.5,
    })
  })

  it("fails closed on stale, duplicate, ineligible, unknown, or expanded catalog input", () => {
    assert.ok(catalogText, "expected the committed whole-concept batch catalog")
    assert.equal(typeof validateCatalog, "function")
    const catalog = JSON.parse(catalogText)
    const context = { constructionReview, discoveryReview }

    assert.throws(() => validateCatalog({ ...catalog, constructionReviewSha256: "f".repeat(64) }, context), /stale|fingerprint/i)
    assert.throws(() => validateCatalog({ ...catalog, entries: [catalog.entries[0], catalog.entries[0]] }, context), /duplicate/i)
    assert.throws(() => validateCatalog({
      ...catalog,
      entries: [{ batchId: "batch-06-birds", groupId: "moodist:birds" }],
    }, context), /processing|eligible/i)
    assert.throws(() => validateCatalog({
      ...catalog,
      entries: [{ batchId: "batch-06-ceiling-fan", groupId: "moodist:ceiling-fan" }],
    }, context), /accepted|eligible/i)
    assert.throws(() => validateCatalog({ ...catalog, extra: true }, context), /unknown field/i)
    assert.throws(() => validateCatalog({
      ...catalog,
      entries: [{ ...catalog.entries[0], extra: true }],
    }, context), /unknown field/i)

    const changedReview = structuredClone(constructionReview)
    changedReview.groups.find(({ groupId }) => groupId === "moodist:droplets").includedSourceIds = ["f".repeat(64)]
    assert.throws(() => validateCatalog(catalog, {
      ...context,
      constructionReview: changedReview,
    }), /source|unknown/i)
  })

  it("keeps the owner reusable for any declared eligible raw-only subset", () => {
    const catalog = JSON.parse(catalogText)
    const projected = validateCatalog({ ...catalog, entries: [catalog.entries[0]] }, {
      constructionReview,
      discoveryReview,
    })
    assert.deepEqual(projected.entries.map(({ batchId, groupId }) => [batchId, groupId]), [
      ["batch-06-droplets", "moodist:droplets"],
    ])
  })

  it("rejects inactive, empty, or source-processing groups before raw review", () => {
    const catalog = JSON.parse(catalogText)
    const single = { ...catalog, entries: [catalog.entries[0]] }
    const inactive = structuredClone(constructionReview)
    inactive.groups.find(({ groupId }) => groupId === "moodist:droplets").status = "inactive"
    assert.throws(() => validateCatalog(single, {
      constructionReview: inactive,
      discoveryReview,
    }), /active|eligible/i)

    const empty = structuredClone(constructionReview)
    empty.groups.find(({ groupId }) => groupId === "moodist:droplets").includedSourceIds = []
    assert.throws(() => validateCatalog(single, {
      constructionReview: empty,
      discoveryReview,
    }), /empty|source|eligible/i)

    const sourceProcessing = structuredClone(constructionReview)
    const droplets = sourceProcessing.groups.find(({ groupId }) => groupId === "moodist:droplets")
    droplets.sourceOverrides[droplets.includedSourceIds[0]] = [{ type: "processing-intent" }]
    assert.throws(() => validateCatalog(single, {
      constructionReview: sourceProcessing,
      discoveryReview,
    }), /processing|eligible/i)

    for (const intent of [{}, { type: "future-processing-intent" }]) {
      const groupProcessing = structuredClone(constructionReview)
      groupProcessing.groups.find(({ groupId }) => groupId === "moodist:droplets")
        .processingIntents.push(intent)
      assert.throws(() => validateCatalog(single, {
        constructionReview: groupProcessing,
        discoveryReview,
      }), /processing|intent|eligible/i)

      const futureSourceProcessing = structuredClone(constructionReview)
      const group = futureSourceProcessing.groups.find(({ groupId }) => groupId === "moodist:droplets")
      group.sourceOverrides[group.includedSourceIds[0]] = [intent]
      assert.throws(() => validateCatalog(single, {
        constructionReview: futureSourceProcessing,
        discoveryReview,
      }), /processing|intent|eligible/i)
    }
  })

  it("rejects unsafe discovery paths and path-derived source identity drift", () => {
    const catalog = JSON.parse(catalogText)
    const single = { ...catalog, entries: [catalog.entries[0]] }
    const sourceId = constructionReview.groups
      .find(({ groupId }) => groupId === "moodist:droplets").includedSourceIds[0]
    for (const relativePath of [
      "C:\\unsafe.wav",
      "/unsafe.wav",
      "safe/../unsafe.wav",
      "safe\\unsafe.wav",
    ]) {
      const changedDiscovery = structuredClone(discoveryReview)
      changedDiscovery.sources.find((source) => source.sourceId === sourceId).relativePath = relativePath
      assert.throws(() => validateCatalog(single, {
        constructionReview,
        discoveryReview: changedDiscovery,
      }), /path|relative|safe/i)
    }

    const identityMismatch = structuredClone(discoveryReview)
    identityMismatch.sources.find((source) => source.sourceId === sourceId).relativePath = "safe/changed.wav"
    assert.throws(() => validateCatalog(single, {
      constructionReview,
      discoveryReview: identityMismatch,
    }), /identity|source id|sha-?256/i)
  })

  it("self-verifies construction and discovery content instead of trusting claimed hashes", () => {
    const catalog = JSON.parse(catalogText)
    const changedLabel = structuredClone(constructionReview)
    changedLabel.groups.find(({ groupId }) => groupId === "moodist:droplets").label = "Changed label"
    assert.throws(() => validateCatalog(catalog, {
      constructionReview: changedLabel,
      discoveryReview,
    }), /stale|fingerprint/i)

    const changedPath = structuredClone(discoveryReview)
    const queuedSourceIds = new Set(JSON.parse(catalogText).entries.flatMap(({ groupId }) => (
      constructionReview.groups.find((group) => group.groupId === groupId).includedSourceIds
    )))
    const changedSource = changedPath.sources.find(({ sourceId }) => !queuedSourceIds.has(sourceId))
    changedSource.relativePath = "safe/changed-owner-path.wav"
    changedSource.sourceId = createHash("sha256").update(changedSource.relativePath).digest("hex")
    assert.throws(() => validateCatalog(catalog, {
      constructionReview,
      discoveryReview: changedPath,
    }), /stale|fingerprint/i)
  })

  it("rejects playback constraints that the raw projection cannot carry", () => {
    const catalog = JSON.parse(catalogText)
    const single = { ...catalog, entries: [catalog.entries[0]] }
    for (const constraint of [
      { type: "boundary-mode-audition", modes: ["crossfade", "overlap"] },
      { type: "future-unsupported-policy" },
    ]) {
      const changedReview = structuredClone(constructionReview)
      changedReview.groups.find(({ groupId }) => groupId === "moodist:droplets")
        .playback.constraints.push(constraint)
      assert.throws(() => validateCatalog(single, {
        constructionReview: changedReview,
        discoveryReview,
      }), /constraint|unsupported/i)
    }
  })

  it("validates restart-safe chat outcomes without inventing heard timestamps", () => {
    const entry = loadCatalog().entries[0]
    assert.equal(typeof validateOutcome, "function")
    const outcome = {
      version: 1,
      reviewKind: "whole-concept-chat-outcome",
      batchId: entry.batchId,
      reviewFingerprint: entry.reviewFingerprint,
      decision: "pass",
      note: "Reviewer directly passed the complete Droplets concept in chat.",
      reviewedAt: "2026-08-26T12:00:00.000Z",
    }

    assert.deepEqual(validateOutcome(outcome, { reviewEntry: entry }), outcome)
    assert.throws(() => validateOutcome({ ...outcome, reviewFingerprint: "f".repeat(64) }, { reviewEntry: entry }), /stale|fingerprint/i)
    assert.throws(() => validateOutcome({ ...outcome, decision: "maybe" }, { reviewEntry: entry }), /decision/i)
    assert.throws(() => validateOutcome({ ...outcome, note: "" }, { reviewEntry: entry }), /note/i)
    assert.throws(() => validateOutcome({ ...outcome, heardAt: outcome.reviewedAt }, { reviewEntry: entry }), /unknown field/i)
    for (const reviewedAt of [
      "2026-08-26",
      "1787745600000",
      "2026-08-26T08:00:00-04:00",
    ]) {
      assert.throws(() => validateOutcome({ ...outcome, reviewedAt }, { reviewEntry: entry }), /reviewedAt|timestamp|date/i)
    }
  })

  it("preserves all direct and conditional chat Pass decisions against the amended auditions", () => {
    const catalog = loadAmendedCatalog()
    const expansion = validateExpansion(JSON.parse(expansionText), { discoveryReview })
    const reviewEntries = [...catalog.entries, ...expansion.entries]
    assert.equal(typeof validateOutcomeCatalog, "function")
    assert.ok(outcomeCatalogText, "expected the committed whole-concept chat outcomes")
    const rawOutcomes = JSON.parse(outcomeCatalogText)
    assert.equal(rawOutcomes.entries.length, 47)
    assert.equal(
      rawOutcomes.entries.some(({ batchId }) => batchId === "batch-56-ambient-loops-77bpm"),
      true,
      "the reviewer approved the exact revised Batch 56 repeat and boundary policy",
    )
    assert.equal(
      rawOutcomes.entries.some(({ batchId }) => batchId === "batch-61-white-noise-selection"),
      true,
      "the reviewer approved the exact single-source White Noise loop policy",
    )
    const processedOutcomeBatchIds = new Set([
      "batch-21-traffic",
      "batch-35-london-ambience",
      "batch-45-stadium-crowd",
    ])
    const processedOutcomes = rawOutcomes.entries.filter(({ batchId }) => processedOutcomeBatchIds.has(batchId))
    assert.equal(processedOutcomes.length, 3, "processed chat outcomes are validated with their exact review owners")
    assert.throws(() => validateOutcomeCatalog(rawOutcomes, {
      reviewEntries,
    }), /stale|fingerprint/i)
    const degradedOutcomes = validateOutcomeCatalog(rawOutcomes, {
      reviewEntries,
      inactiveReviewBatchIds: [...processedOutcomeBatchIds],
    })
    assert.equal(
      degradedOutcomes.entries.some(({ batchId }) => processedOutcomeBatchIds.has(batchId)),
      false,
      "exact saved Passes must remain unattached while their processed auditions are unavailable",
    )
    const malformedInactive = structuredClone(rawOutcomes)
    malformedInactive.entries.find(({ batchId }) => batchId === "batch-35-london-ambience").reviewFingerprint = "invalid"
    assert.throws(() => validateOutcomeCatalog(malformedInactive, {
      reviewEntries,
      inactiveReviewBatchIds: ["batch-35-london-ambience"],
    }), /fingerprint/i)
    const outcomes = validateOutcomeCatalog({
      ...rawOutcomes,
      entries: rawOutcomes.entries.filter(({ batchId }) => !processedOutcomeBatchIds.has(batchId)),
    }, { reviewEntries })

    assert.deepEqual(outcomes.entries.map(({ batchId, decision }) => [batchId, decision]), [
      ["batch-06-droplets", "pass"],
      ["batch-07-electrical-interference", "pass"],
      ["batch-08-washing-dishes", "pass"],
      ["batch-10-cave-room-tone", "pass"],
      ["batch-12-light-waves", "pass"],
      ["batch-13-dark-ambient-pad", "pass"],
      ["batch-14-walk-in-snow", "pass"],
      ["batch-11-room-tone", "pass"],
      ["batch-15-experimental-atmosphere", "pass"],
      ["batch-16-fireworks", "pass"],
      ["batch-18-highway", "pass"],
      ["batch-19-inside-a-train", "pass"],
      ["batch-20-supermarket", "pass"],
      ["batch-22-tuning-radio", "pass"],
      ["batch-24-beach-ambience", "pass"],
      ["batch-28-countryside-ambience", "pass"],
      ["batch-29-distant-fireworks", "pass"],
      ["batch-31-forest-atmosphere", "pass"],
      ["batch-33-inside-a-bus", "pass"],
      ["batch-38-passing-trains", "pass"],
      ["batch-44-spiritual-acoustics", "pass"],
      ["batch-09-washing-machine", "pass"],
      ["batch-30-fireplace", "pass"],
      ["batch-34-keys-jingling", "pass"],
      ["batch-36-lunar-wind", "pass"],
      ["batch-42-space-tension-bed", "pass"],
      ["batch-50-vintage-radio-broadcast", "pass"],
      ["batch-51-waterfront-cafe", "pass"],
      ["batch-23-waves", "pass"],
      ["batch-25-bus-station-announcements", "pass"],
      ["batch-26-choir-ambience", "pass"],
      ["batch-37-orthodox-choir", "pass"],
      ["batch-41-school-playground", "pass"],
      ["batch-43-spaceship-interior", "pass"],
      ["batch-46-subway-interior", "pass"],
      ["batch-17-heavy-rain", "pass"],
      ["batch-27-church-bells", "pass"],
      ["batch-49-transit-announcements", "pass"],
      ["batch-55-bagpipes-outside", "pass"],
      ["batch-57-open-fields", "pass"],
      ["batch-52-grinding-pepper-candidate", "pass"],
      ["batch-60-crowd-walla-assignment", "pass"],
      ["batch-56-ambient-loops-77bpm", "pass"],
      ["batch-61-white-noise-selection", "pass"],
    ])
    assert.equal(JSON.stringify(outcomes).includes("heardAt"), false)
    assert.throws(() => validateOutcomeCatalog({
      ...rawOutcomes,
      entries: [rawOutcomes.entries[0], rawOutcomes.entries[0]],
    }, { reviewEntries }), /duplicate/i)
    assert.throws(() => validateOutcomeCatalog({ ...rawOutcomes, extra: true }, {
      reviewEntries,
    }), /unknown field/i)
    assert.throws(() => validateOutcomeCatalog(rawOutcomes, {
      reviewEntries: catalog.entries,
      inactiveReviewBatchIds: ["batch-99-unknown"],
    }), /inactive.*unknown/i)
  })

  it("applies only the three reviewer-directed revisions and binds ready auditions to new identities", () => {
    const catalog = loadCatalog()
    assert.equal(typeof applyRevisions, "function")
    assert.ok(revisionsText, "expected the committed whole-concept review revisions")
    const rawRevisions = JSON.parse(revisionsText)
    const revised = applyRevisions(catalog, rawRevisions)
    const washingMachine = revised.entries.find(({ batchId }) => batchId === "batch-09-washing-machine")
    const roomTone = revised.entries.find(({ batchId }) => batchId === "batch-11-room-tone")
    const experimental = revised.entries.find(({ batchId }) => batchId === "batch-15-experimental-atmosphere")

    assert.equal(washingMachine.revision.state, "needs-timing")
    assert.equal(washingMachine.revision.kind, "opening-then-loop")
    assert.match(washingMachine.revision.summary, /opening|loop|timing/i)
    assert.equal(washingMachine.reviewFingerprint, EXPECTED_REVIEW_FINGERPRINTS["batch-09-washing-machine"])

    assert.equal(roomTone.revision.state, "ready-to-audition")
    assert.equal(roomTone.revision.kind, "source-level-match")
    assert.equal(roomTone.revision.targetIntegratedLoudnessLufs, -60.8)
    assert.deepEqual(
      Object.fromEntries(roomTone.sources.map(({ sourceId, gainDb }) => [sourceId, gainDb])),
      {
        "1be27634a5136979ed5e43b9219050b1a07fa7bdb62b03d9d0c28ef86f74b5ff": -6.1,
        "5787d563421fdb6aaa587504dd3827b14d9ad04549463718e0aa43d86703461d": -19.2,
        "64bc8e2bfc96adaccfb6c95206735ea2760a3dc23cd3e91f44ea1c4fdabeaaf8": -6.4,
        "87b48c0929819df48790c722d8b212540d596dc5ca849a1301ae21ba7a232986": -21.3,
        "a4d5af905e63752ce468cdf5471a750d582a69045eecfc71e62c8ccc9f1ad6e5": 0,
        "a724486fba5e2b33a9620688c170781c8d6f3348dc276d6fbfe95fb1f13cb7e1": -11.7,
      },
    )
    assert.notEqual(roomTone.reviewFingerprint, EXPECTED_REVIEW_FINGERPRINTS["batch-11-room-tone"])

    assert.equal(experimental.revision.state, "ready-to-audition")
    assert.equal(experimental.revision.kind, "full-length-random-overlap")
    assert.deepEqual(experimental.playbackConfiguration.previewSettings, {
      transitionMode: "overlap",
      transitionSeconds: 2,
    })
    assert.deepEqual(experimental.playbackConfiguration.constructionPolicy.transitionDurationRange, {
      minimumSeconds: 2,
      maximumSeconds: 6,
    })
    assert.equal(experimental.playbackConfiguration.constructionPolicy.preserveFullLengthOverlaps, true)
    assert.notEqual(experimental.reviewFingerprint, EXPECTED_REVIEW_FINGERPRINTS["batch-15-experimental-atmosphere"])

    const stale = structuredClone(rawRevisions)
    stale.entries[0].baseReviewFingerprint = "f".repeat(64)
    assert.throws(() => applyRevisions(catalog, stale), /stale|fingerprint/i)
    assert.throws(() => applyRevisions(catalog, { ...rawRevisions, extra: true }), /unknown field/i)
  })

  it("applies the exact Batch 09–51 handoff without renumbering surviving concepts", () => {
    const amended = loadAmendedCatalog()
    assert.equal(amended.entries.length, 42)
    assert.deepEqual(amended.redirects, [
      { batchId: "batch-32-grocery-store", targetBatchId: "batch-20-supermarket" },
      { batchId: "batch-39-radio-static", targetBatchId: "batch-22-tuning-radio" },
      { batchId: "batch-40-roadside", targetBatchId: "batch-21-traffic" },
      { batchId: "batch-48-train-station-announcements", targetBatchId: "batch-49-transit-announcements" },
    ])
    const byBatch = new Map(amended.entries.map((entry) => [entry.batchId, entry]))
    assert.equal(byBatch.get("batch-18-highway").label, "Cars Passing")
    assert.equal(byBatch.get("batch-22-tuning-radio").label, "Radio Static")
    assert.equal(byBatch.get("batch-26-choir-ambience").label, "Children’s Choir Ambience")
    assert.equal(byBatch.get("batch-17-heavy-rain").sources.length, 1)
    assert.equal(byBatch.get("batch-17-heavy-rain").sources[0].gainDb, undefined)
    assert.deepEqual(byBatch.get("batch-17-heavy-rain").runtimePolicy, {
      kind: "random-region-loop",
      regionStartSeconds: 0,
      regionEndSeconds: 143.413,
      minimumLoopSeconds: 20,
      crossfadeSeconds: 10,
    })
    assert.equal(byBatch.get("batch-25-bus-station-announcements").sources.length, 4)
    assert.deepEqual(byBatch.get("batch-25-bus-station-announcements").runtimePolicy, {
      kind: "pause-separated-sequence",
      minimumGapSeconds: 0,
      maximumGapSeconds: 3,
      fadeInSeconds: 1,
      fadeOutSeconds: 5,
    })
    assert.equal(byBatch.get("batch-26-choir-ambience").sources.length, 5)
    assert.equal(byBatch.get("batch-27-church-bells").playbackConfiguration.previewSettings.transitionSeconds, 15)
    assert.equal(byBatch.get("batch-37-orthodox-choir").sources.length, 14)
    assert.equal(byBatch.get("batch-37-orthodox-choir").runtimePolicy.maximumConcurrentVoices, 2)
    assert.equal(byBatch.get("batch-37-orthodox-choir").runtimePolicy.transitionSeconds, 4)
    assert.equal(byBatch.get("batch-43-spaceship-interior").sources.length, 9)
    assert.deepEqual(byBatch.get("batch-43-spaceship-interior").playbackConfiguration.previewSettings, {
      transitionMode: "crossfade",
      transitionSeconds: 3,
    })
    assert.equal(byBatch.get("batch-49-transit-announcements").sources.length, 4)
    assert.deepEqual(
      byBatch.get("batch-49-transit-announcements").sources.find(
        ({ sourceId }) => sourceId === "9a05350733c10deebb6b2a71e6245b8bde191fcca0a327ef72b515a20b547ac7",
      ),
      {
        sourceId: "9a05350733c10deebb6b2a71e6245b8bde191fcca0a327ef72b515a20b547ac7",
        relativePath: "London+Underground+Rcordings/London Underground Rcordings/The next station is - Announcement. 2.wav",
        startSeconds: 0,
        endSeconds: 6,
        fadeInSeconds: 0,
        fadeOutSeconds: 0,
      },
    )
    assert.equal(byBatch.get("batch-21-traffic").reviewState, "processing-required")
    assert.equal(byBatch.get("batch-35-london-ambience").reviewState, "processing-required")
    assert.equal(byBatch.get("batch-45-stadium-crowd").reviewState, "processing-required")
    assert.equal(byBatch.get("batch-47-train-station").reviewState, "insufficient-sources")
    assert.deepEqual(byBatch.get("batch-09-washing-machine").runtimePolicy, {
      kind: "fixed-region-loop",
      firstPassStartSeconds: 0,
      loopStartSeconds: 15,
      loopEndSeconds: 55,
      crossfadeSeconds: 4,
    })
    assert.equal(byBatch.get("batch-34-keys-jingling").playbackConfiguration.previewSettings.stepsPerMinute, 90)
    assert.equal(byBatch.get("batch-41-school-playground").runtimePolicy.crossfadeSeconds, 3)
    assert.equal(byBatch.get("batch-45-stadium-crowd").playbackConfiguration.previewSettings.transitionSeconds, 15)
    assert.ok(byBatch.get("batch-45-stadium-crowd").processingRequirements.some(({ kind }) => kind === "remove-discernible-speech"))
    assert.equal(byBatch.get("batch-46-subway-interior").playbackConfiguration.previewSettings.transitionSeconds, 20)
  })
})
