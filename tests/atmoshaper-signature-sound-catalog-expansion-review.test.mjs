import assert from "node:assert/strict"
import { describe, it } from "node:test"

import expansionReview from "../data/atmoshaper/signature-sound-catalog-expansion-review.json" with { type: "json" }
import discoveryReview from "../data/atmoshaper/signature-sound-review.json" with { type: "json" }
import { validateSignatureSoundCatalogExpansionReview } from "../lib/atmoshaper/signature-sound-catalog-expansion-review.js"

const EXPECTED_COUNTS = {
  "batch-52-grinding-pepper-candidate": 18,
  "batch-55-bagpipes-outside": 4,
  "batch-56-ambient-loops-77bpm": 22,
  "batch-57-open-fields": 11,
  "batch-60-crowd-walla-assignment": 13,
  "batch-61-white-noise-selection": 11,
}

describe("AtmoShaper Signature catalog expansion review", () => {
  function loadCatalog() {
    return validateSignatureSoundCatalogExpansionReview(expansionReview, { discoveryReview })
  }

  it("projects only the six surviving expansion batches without renumbering them", () => {
    const catalog = loadCatalog()
    assert.equal(catalog.entries.length, 6)
    assert.deepEqual(
      Object.fromEntries(catalog.entries.map((entry) => [entry.batchId, entry.sources.length])),
      EXPECTED_COUNTS,
    )
    assert.ok(catalog.entries.every((entry) => /^[a-f0-9]{64}$/.test(entry.reviewFingerprint)))
    assert.ok(catalog.entries.every((entry) => entry.sources.every(({ sourceId, relativePath }) => (
      sourceId.length === 64 && !relativePath.includes("\\")
    ))))
  })

  it("applies the reviewer-directed cadence, source-review, leveling, and seamless-loop policies", () => {
    const byBatch = new Map(loadCatalog().entries.map((entry) => [entry.batchId, entry]))
    assert.equal(byBatch.get("batch-52-grinding-pepper-candidate").playbackConfiguration.previewSettings.stepsPerMinute, 100)
    assert.equal(byBatch.get("batch-56-ambient-loops-77bpm").showSourceAuditions, true)

    const crowd = byBatch.get("batch-60-crowd-walla-assignment")
    assert.equal(crowd.sources.length, 13)
    assert.ok(crowd.sources.every(({ gainDb }) => Number.isFinite(gainDb)))
    assert.equal(crowd.levelMatch.targetPolicy, "median-with-true-peak-headroom")
    assert.ok(crowd.levelMatch.measurements.every(({ integratedLoudnessLufs, gainDb }) => (
      Number((integratedLoudnessLufs + gainDb).toFixed(1)) === crowd.levelMatch.targetIntegratedLoudnessLufs
    )))

    const whiteNoise = byBatch.get("batch-61-white-noise-selection")
    assert.deepEqual(whiteNoise.playbackConfiguration.previewSettings, {
      transitionMode: "overlap",
      transitionSeconds: 0.25,
    })
    assert.equal(whiteNoise.playbackConfiguration.constructionPolicy.preserveFullLengthOverlaps, true)
  })

  it("builds one repeating 77 BPM pool after the exact reviewer removals", () => {
    const entry = loadCatalog().entries.find(({ batchId }) => batchId === "batch-56-ambient-loops-77bpm")
    assert.deepEqual(entry.runtimePolicy, {
      kind: "repeat-source-sequence",
      minimumConsecutivePlays: 3,
      maximumConsecutivePlays: 6,
      beatsPerMinute: 77,
      crossfadeBeats: 16,
      shortSourceIds: [
        "91ba202ebe785a74fec30f5264e720a43b6136a8e62673402e0dd552e1e6938e",
        "831ff8d3b4e005e5d09a484fba83b238a1f27406a42d8fa5e265cd0dfa18a74d",
        "08e8b48075051f141144b0143aec6bb1c0ac4ef23f9e071d2d41f570dc4c7c73",
      ],
      shortCrossfadeBeats: 8,
    })
    assert.equal(entry.playbackConfiguration.previewSettings.transitionMode, "crossfade")
    assert.equal(entry.playbackConfiguration.previewSettings.transitionSeconds, 960 / 77)
    const excludedFileNames = [
      "Amient Pad Loop 01 77BPM.wav",
      "Amient Pad Loop 01-3 77BPM.wav",
      "Amient Pad Loop 01-4 77BPM.wav",
      "Amient Pad Loop 02 77BPM.wav",
      "Amient Pad Loop 02-2 77BPM.wav",
      "Amient String Loop 01 77BPM.wav",
      "Amient String Loop 02 77BPM.wav",
      "Amient String Loop 02-1 77BPM.wav",
      "Amient Piano Loop 04-3 77BPM.wav",
      "Amient Piano Loop 02 77BPM.wav",
      "Amient Mals Loop 04 77BPM.wav",
      "Amient Mals Loop 04-1 77BPM.wav",
    ]
    assert.deepEqual(
      Object.fromEntries(["pads", "strings", "piano", "mallets"].map((sourceSetId) => [
        sourceSetId,
        entry.sources.filter((source) => source.sourceSetId === sourceSetId).length,
      ])),
      { pads: 10, strings: 1, piano: 10, mallets: 1 },
    )
    assert.ok(entry.sources.every(({ relativePath }) => (
      !excludedFileNames.includes(relativePath.split("/").at(-1))
    )))
    assert.ok(entry.sources
      .filter(({ sourceSetId }) => sourceSetId !== "strings")
      .every(({ relativePath }) => relativePath.includes("77BPM")))
    assert.deepEqual(
      entry.sources
        .filter(({ sourceId }) => entry.runtimePolicy.shortSourceIds.includes(sourceId))
        .map(({ relativePath }) => relativePath.split("/").at(-1))
        .sort(),
      [
        "Amient Piano Loop 04 77BPM.wav",
        "Amient Piano Loop 06 77BPM.wav",
        "Amient String Loop 03 77BPM.wav",
      ],
    )
  })

  it("makes White Noise a one-source-at-a-time loop choice", () => {
    const entry = loadCatalog().entries.find(({ batchId }) => batchId === "batch-61-white-noise-selection")
    assert.deepEqual(entry.sourceSelection, { kind: "single-source-loop" })
    assert.equal(entry.playbackConfiguration.previewSettings.transitionSeconds, 0.25)
    assert.equal(entry.showSourceAuditions, true)
  })

  it("fails closed on stale owners, count drift, overlapping selectors, and expanded fields", () => {
    assert.throws(() => validateSignatureSoundCatalogExpansionReview({
      ...expansionReview,
      discoveryReviewSha256: "f".repeat(64),
    }, { discoveryReview }), /stale|fingerprint/i)

    const wrongCount = structuredClone(expansionReview)
    wrongCount.entries[0].sourceSets[0].expectedSourceCount = 17
    assert.throws(() => validateSignatureSoundCatalogExpansionReview(wrongCount, { discoveryReview }), /expected 17.*selected 18/i)

    const overlap = structuredClone(expansionReview)
    overlap.entries[0].sourceSets.push({ ...overlap.entries[0].sourceSets[0], id: "pepper-events-copy" })
    assert.throws(() => validateSignatureSoundCatalogExpansionReview(overlap, { discoveryReview }), /overlap/i)

    const unknownExclusion = structuredClone(expansionReview)
    unknownExclusion.entries.find(({ batchId }) => batchId === "batch-56-ambient-loops-77bpm")
      .sourceSets[0].excludeFileNames.push("not-in-the-discovery-owner.wav")
    assert.throws(() => validateSignatureSoundCatalogExpansionReview(unknownExclusion, { discoveryReview }), /exclude.*unknown/i)

    const duplicateExclusion = structuredClone(expansionReview)
    const firstExcludedFileName = duplicateExclusion.entries
      .find(({ batchId }) => batchId === "batch-56-ambient-loops-77bpm")
      .sourceSets[0].excludeFileNames[0]
    duplicateExclusion.entries.find(({ batchId }) => batchId === "batch-56-ambient-loops-77bpm")
      .sourceSets[0].excludeFileNames.push(firstExcludedFileName)
    assert.throws(() => validateSignatureSoundCatalogExpansionReview(duplicateExclusion, { discoveryReview }), /exclude.*duplicate/i)

    const offBeatCrossfade = structuredClone(expansionReview)
    offBeatCrossfade.entries.find(({ batchId }) => batchId === "batch-56-ambient-loops-77bpm")
      .runtimePolicy.crossfadeBeats = 12
    assert.throws(() => validateSignatureSoundCatalogExpansionReview(offBeatCrossfade, { discoveryReview }), /crossfade.*match/i)

    const unknownShortSource = structuredClone(expansionReview)
    unknownShortSource.entries.find(({ batchId }) => batchId === "batch-56-ambient-loops-77bpm")
      .runtimePolicy.shortSourceIds[0] = "f".repeat(64)
    assert.throws(() => validateSignatureSoundCatalogExpansionReview(unknownShortSource, { discoveryReview }), /short source.*not in.*pool/i)

    const duplicateShortSource = structuredClone(expansionReview)
    const repeatPolicy = duplicateShortSource.entries
      .find(({ batchId }) => batchId === "batch-56-ambient-loops-77bpm").runtimePolicy
    repeatPolicy.shortSourceIds[1] = repeatPolicy.shortSourceIds[0]
    assert.throws(() => validateSignatureSoundCatalogExpansionReview(duplicateShortSource, { discoveryReview }), /short source.*duplicate/i)

    const staleLevelGain = structuredClone(expansionReview)
    staleLevelGain.entries.find(({ batchId }) => batchId === "batch-60-crowd-walla-assignment")
      .levelMatch.measurements[0].gainDb = -6.1
    assert.throws(() => validateSignatureSoundCatalogExpansionReview(staleLevelGain, { discoveryReview }), /gain|headroom/i)

    assert.throws(() => validateSignatureSoundCatalogExpansionReview({
      ...expansionReview,
      extra: true,
    }, { discoveryReview }), /unknown field/i)
  })
})
