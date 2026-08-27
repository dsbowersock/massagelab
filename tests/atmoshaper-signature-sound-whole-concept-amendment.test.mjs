import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { describe, it } from "node:test"

const amendmentModule = await import(
  "../lib/atmoshaper/signature-sound-whole-concept-amendment.js"
).catch(() => ({}))
const applyAmendments = amendmentModule.applySignatureSoundWholeConceptReviewAmendments

const SHA = {
  construction: "a".repeat(64),
  batchA: "b".repeat(64),
  batchB: "c".repeat(64),
  source1: "1".repeat(64),
  source2: "2".repeat(64),
  source3: "3".repeat(64),
}

function baseCatalog() {
  return {
    version: 1,
    reviewKind: "whole-concept-review-batches",
    constructionReviewSha256: SHA.construction,
    redirects: [],
    entries: [
      {
        batchId: "batch-09-alpha",
        groupId: "example:alpha",
        label: "Alpha",
        reviewFingerprint: SHA.batchA,
        sources: [
          { sourceId: SHA.source1, relativePath: "pack/one.wav" },
          { sourceId: SHA.source2, relativePath: "pack/two.wav" },
        ],
        playbackConfiguration: {
          strategyId: "adaptive-whole-source-sequence",
          previewSettings: { transitionMode: "crossfade", transitionSeconds: 2 },
          constructionPolicy: {
            minimumSelectionsBeforeRepeat: null,
            transitionDurationRange: null,
            cadenceBoundary: null,
            overlapNextEvent: false,
          },
        },
        revision: null,
      },
      {
        batchId: "batch-10-beta",
        groupId: "example:beta",
        label: "Beta",
        reviewFingerprint: SHA.batchB,
        sources: [{ sourceId: SHA.source3, relativePath: "pack/three.wav" }],
        playbackConfiguration: {
          strategyId: "adaptive-whole-source-sequence",
          previewSettings: { transitionMode: "crossfade", transitionSeconds: 4 },
          constructionPolicy: {
            minimumSelectionsBeforeRepeat: null,
            transitionDurationRange: null,
            cadenceBoundary: null,
            overlapNextEvent: false,
          },
        },
        revision: null,
      },
    ],
  }
}

function catalog(entries) {
  return {
    version: 1,
    reviewKind: "whole-concept-review-amendments",
    constructionReviewSha256: SHA.construction,
    entries,
  }
}

function common(overrides = {}) {
  return {
    batchId: "batch-09-alpha",
    baseReviewFingerprint: SHA.batchA,
    state: "ready-to-audition",
    summary: "Reviewer-directed audition policy.",
    ...overrides,
  }
}

describe("AtmoShaper whole-concept reviewer amendments", () => {
  it("renames, replaces the exact pool, changes continuous timing, and binds a new identity", () => {
    assert.equal(typeof applyAmendments, "function")
    const result = applyAmendments(baseCatalog(), catalog([
      common({
        label: "Renamed Alpha",
        sourceIds: [SHA.source1, SHA.source3],
        playbackPolicy: {
          kind: "continuous-sequence",
          transitionMode: "crossfade",
          transitionSeconds: 6,
        },
      }),
    ]))
    const entry = result.entries[0]

    assert.equal(entry.label, "Renamed Alpha")
    assert.deepEqual(entry.sources.map(({ sourceId }) => sourceId), [SHA.source1, SHA.source3])
    assert.deepEqual(entry.playbackConfiguration.previewSettings, {
      transitionMode: "crossfade",
      transitionSeconds: 6,
    })
    assert.equal(entry.runtimePolicy, null)
    assert.notEqual(entry.reviewFingerprint, SHA.batchA)
    assert.equal(entry.amendment.state, "ready-to-audition")
  })

  it("supports the fixed and randomized regional-loop policies needed by Batches 09, 41, and 51", () => {
    const fixed = applyAmendments(baseCatalog(), catalog([
      common({ sourceIds: [SHA.source1], playbackPolicy: {
        kind: "fixed-region-loop",
        firstPassStartSeconds: 0,
        loopStartSeconds: 15,
        loopEndSeconds: 55,
        crossfadeSeconds: 4,
      } }),
    ])).entries[0]
    assert.deepEqual(fixed.runtimePolicy, {
      kind: "fixed-region-loop",
      firstPassStartSeconds: 0,
      loopStartSeconds: 15,
      loopEndSeconds: 55,
      crossfadeSeconds: 4,
    })

    const random = applyAmendments(baseCatalog(), catalog([
      common({ sourceIds: [SHA.source1], playbackPolicy: {
        kind: "random-region-loop",
        regionStartSeconds: 5,
        regionEndSeconds: 190,
        minimumLoopSeconds: 20,
        crossfadeSeconds: 10,
      } }),
    ])).entries[0]
    assert.equal(random.runtimePolicy.minimumLoopSeconds, 20)
    assert.equal(random.runtimePolicy.crossfadeSeconds, 10)
  })

  it("supports pause-separated events, cadence, layered lanes, and exact dual lanes", () => {
    const policies = [
      {
        kind: "pause-separated-sequence",
        minimumGapSeconds: 0,
        maximumGapSeconds: 3,
        fadeInSeconds: 0.5,
        fadeOutSeconds: 0.5,
      },
      { kind: "cadence", eventsPerMinute: 90, jitterPercent: 30 },
      {
        kind: "layered-sequence",
        maximumConcurrentVoices: 4,
        transitionMode: "crossfade",
        transitionSeconds: 10,
        initialStartWindowSeconds: 10,
      },
      {
        kind: "multi-lane-sequence",
        lanes: [
          {
            sourceIds: [SHA.source1],
            boundaryMode: "crossfade",
            transitionSeconds: 3,
          },
          {
            sourceIds: [SHA.source2],
            boundaryMode: "pause",
            minimumGapSeconds: 0,
            maximumGapSeconds: 7,
          },
        ],
      },
    ]

    for (const playbackPolicy of policies) {
      const result = applyAmendments(baseCatalog(), catalog([common({ playbackPolicy })]))
      const entry = result.entries[0]
      if (playbackPolicy.kind === "cadence") {
        assert.equal(entry.playbackConfiguration.strategyId, "walking-cadence-sequence")
        assert.equal(entry.playbackConfiguration.previewSettings.stepsPerMinute, 90)
      } else {
        assert.deepEqual(entry.runtimePolicy, playbackPolicy)
      }
    }
  })

  it("attaches attenuation-only source measurements to the exact amended pool", () => {
    const result = applyAmendments(baseCatalog(), catalog([
      common({
        sourceIds: [SHA.source1, SHA.source3],
        levelMatch: {
          method: "ffmpeg-ebur128-v1",
          toolVersion: "ffmpeg version 9.0-full_build-www.gyan.dev",
          targetPolicy: "quietest-input",
          targetIntegratedLoudnessLufs: -30,
          measurements: [
            { sourceId: SHA.source1, durationSeconds: 10, integratedLoudnessLufs: -20, truePeakDbtp: -3, gainDb: -10 },
            { sourceId: SHA.source3, durationSeconds: 12, integratedLoudnessLufs: -30, truePeakDbtp: -8, gainDb: 0 },
          ],
        },
      }),
    ]))
    assert.deepEqual(result.entries[0].sources.map(({ sourceId, gainDb }) => [sourceId, gainDb]), [
      [SHA.source1, -10],
      [SHA.source3, 0],
    ])
  })

  it("applies median constant gain in either direction while retaining true-peak headroom", () => {
    const result = applyAmendments(baseCatalog(), catalog([
      common({
        sourceIds: [SHA.source1, SHA.source3],
        levelMatch: {
          method: "ffmpeg-ebur128-v1",
          toolVersion: "ffmpeg version measurement-only-test",
          targetPolicy: "median-with-true-peak-headroom",
          targetIntegratedLoudnessLufs: -25,
          measurements: [
            { sourceId: SHA.source1, durationSeconds: 10, integratedLoudnessLufs: -30, truePeakDbtp: -10, gainDb: 5 },
            { sourceId: SHA.source3, durationSeconds: 12, integratedLoudnessLufs: -20, truePeakDbtp: -2, gainDb: -5 },
          ],
        },
      }),
    ]))
    assert.deepEqual(result.entries[0].sources.map(({ sourceId, gainDb }) => [sourceId, gainDb]), [
      [SHA.source1, 5],
      [SHA.source3, -5],
    ])
  })

  it("adds an exact path-hashed discovery source without rewriting the base review", () => {
    const relativePath = "pack/four.wav"
    const sourceId = createHash("sha256").update(relativePath).digest("hex")
    const result = applyAmendments(baseCatalog(), catalog([
      common({
        sourceAdditions: [{ sourceId, relativePath }],
        sourceIds: [SHA.source1, sourceId],
      }),
    ]))
    assert.deepEqual(result.entries[0].sources, [
      { sourceId: SHA.source1, relativePath: "pack/one.wav" },
      { sourceId, relativePath },
    ])
  })

  it("binds a non-destructive per-source review trim to the exact merged pool", () => {
    const result = applyAmendments(baseCatalog(), catalog([
      common({
        sourceTrims: [{
          sourceId: SHA.source1,
          startSeconds: 0,
          endSeconds: 5,
          fadeInSeconds: 0,
          fadeOutSeconds: 0.05,
        }],
      }),
    ]))
    assert.deepEqual(result.entries[0].sources[0], {
      sourceId: SHA.source1,
      relativePath: "pack/one.wav",
      startSeconds: 0,
      endSeconds: 5,
      fadeInSeconds: 0,
      fadeOutSeconds: 0.05,
    })
    assert.deepEqual(result.entries[0].sources[1], {
      sourceId: SHA.source2,
      relativePath: "pack/two.wav",
    })
  })

  it("retires a merged batch into its stable survivor and exposes an exact redirect", () => {
    const result = applyAmendments(baseCatalog(), catalog([
      {
        batchId: "batch-10-beta",
        baseReviewFingerprint: SHA.batchB,
        state: "retired",
        summary: "Merged into Batch 09.",
        redirectToBatchId: "batch-09-alpha",
      },
    ]))
    assert.deepEqual(result.entries.map(({ batchId }) => batchId), ["batch-09-alpha"])
    assert.deepEqual(result.redirects, [{ batchId: "batch-10-beta", targetBatchId: "batch-09-alpha" }])
  })

  it("fails closed on drift, unknown sources, invalid loop geometry, invalid lane pools, and extra fields", () => {
    assert.throws(() => applyAmendments(baseCatalog(), catalog([
      common({ baseReviewFingerprint: "f".repeat(64) }),
    ])), /stale|fingerprint/i)
    assert.throws(() => applyAmendments(baseCatalog(), catalog([
      common({ sourceIds: ["9".repeat(64)] }),
    ])), /source|unknown/i)
    assert.throws(() => applyAmendments(baseCatalog(), catalog([
      common({ sourceAdditions: [{ sourceId: "9".repeat(64), relativePath: "../outside.wav" }] }),
    ])), /path|relative|match/i)
    assert.throws(() => applyAmendments(baseCatalog(), catalog([
      common({ playbackPolicy: {
        kind: "fixed-region-loop",
        firstPassStartSeconds: 0,
        loopStartSeconds: 15,
        loopEndSeconds: 20,
        crossfadeSeconds: 4,
      } }),
    ])), /loop|crossfade|geometry/i)
    assert.throws(() => applyAmendments(baseCatalog(), catalog([
      common({ sourceIds: [SHA.source1], playbackPolicy: {
        kind: "random-region-loop",
        regionStartSeconds: 0,
        regionEndSeconds: 15,
        minimumLoopSeconds: 11,
        crossfadeSeconds: 10,
      } }),
    ])), /loop|crossfade|geometry/i)
    assert.throws(() => applyAmendments(baseCatalog(), catalog([
      common({ playbackPolicy: {
        kind: "multi-lane-sequence",
        lanes: [{
          sourceIds: [SHA.source3],
          boundaryMode: "crossfade",
          transitionSeconds: 3,
        }],
      } }),
    ])), /lane|pool|source/i)
    assert.throws(() => applyAmendments(baseCatalog(), catalog([
      common({ playbackPolicy: {
        kind: "multi-lane-sequence",
        lanes: [{
          sourceIds: [SHA.source1],
          boundaryMode: "crossfade",
          transitionSeconds: 3,
        }],
      } }),
    ])), /lane|pool|source|cover/i)
    assert.throws(() => applyAmendments(baseCatalog(), catalog([
      common({ playbackPolicy: {
        kind: "multi-lane-sequence",
        lanes: [{
          sourceIds: [],
          boundaryMode: "pause",
          minimumGapSeconds: 0,
          maximumGapSeconds: 7,
        }],
      } }),
    ])), /lane|pool|source|empty/i)
    const eightLaneBase = baseCatalog()
    const eightSourceIds = Array.from({ length: 8 }, (_, index) => (index + 4).toString(16).repeat(64))
    eightLaneBase.entries[0].sources = eightSourceIds.map((sourceId, index) => ({
      sourceId,
      relativePath: `pack/${index + 1}.wav`,
    }))
    assert.throws(() => applyAmendments(eightLaneBase, catalog([
      common({
        sourceIds: eightSourceIds,
        playbackPolicy: {
          kind: "multi-lane-sequence",
          lanes: eightSourceIds.map((sourceId) => ({
            sourceIds: [sourceId],
            boundaryMode: "crossfade",
            transitionSeconds: 3,
          })),
        },
      }),
    ])), /lane|crossfade|voice|eight/i)
    assert.throws(() => applyAmendments(baseCatalog(), {
      ...catalog([]),
      extra: true,
    }), /unknown field/i)
  })
})
