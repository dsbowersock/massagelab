import assert from "node:assert/strict"
import { describe, it } from "node:test"

import committedFinalizations from "../data/atmoshaper/signature-sound-whole-concept-stage-finalizations.json" with { type: "json" }
import committedOutcomes from "../data/atmoshaper/signature-sound-whole-concept-chat-outcomes.json" with { type: "json" }
import { applySignatureSoundWholeConceptStageFinalizations } from "../lib/atmoshaper/signature-sound-whole-concept-stage-finalization.js"

function processedEntry(reviewFingerprint = "a".repeat(64)) {
  return {
    batchId: "batch-45-stadium-crowd",
    groupId: "signature-extra:stadium-crowd",
    label: "Stadium Crowd",
    reviewFingerprint,
    sources: [{
      sourceId: "b".repeat(64),
      relativePath: "Stadium/source.wav",
      audioUrl: `/api/dev/atmoshaper-candidates/speech-reduction/batch-45-stadium-crowd/${"c".repeat(64)}`,
    }],
    playbackConfiguration: {
      strategyId: "adaptive-whole-source-sequence",
      previewSettings: { transitionMode: "crossfade", transitionSeconds: 15 },
      constructionPolicy: {},
    },
    runtimePolicy: null,
    reviewState: "processing-required",
    processingRequirements: [
      { kind: "dynamic-range-control", detail: "Later experiment" },
      { kind: "level-match", detail: "Later experiment" },
    ],
    amendment: { state: "processing-required", summary: "Later experiment is pending." },
  }
}

describe("AtmoShaper preferred-stage finalization", () => {
  it("closes the exact processed Stadium stage without changing its audio or playback", () => {
    const baseFingerprint = "a".repeat(64)
    const base = processedEntry(baseFingerprint)
    const finalizations = {
      version: 1,
      reviewKind: "whole-concept-stage-finalizations",
      entries: [{
        batchId: base.batchId,
        baseReviewFingerprint: baseFingerprint,
        summary: "Reviewer accepted the restored stage as final.",
      }],
    }
    const result = applySignatureSoundWholeConceptStageFinalizations({ entries: [base] }, finalizations).entries[0]
    assert.equal(result.reviewState, "ready-to-audition")
    assert.deepEqual(result.processingRequirements, [])
    assert.deepEqual(result.sources, base.sources)
    assert.deepEqual(result.playbackConfiguration, base.playbackConfiguration)
    assert.match(result.amendment.summary, /accepted.*final/i)
    assert.notEqual(result.reviewFingerprint, baseFingerprint)
  })

  it("leaves the processing gate intact when the external processed bundle is unavailable", () => {
    const raw = processedEntry(committedFinalizations.entries[0].baseReviewFingerprint)
    delete raw.sources[0].audioUrl
    const result = applySignatureSoundWholeConceptStageFinalizations(
      { entries: [raw] },
      committedFinalizations,
    ).entries[0]
    assert.deepEqual(result, raw)
  })

  it("binds the committed final Pass to the finalized identity and rejects processed drift", () => {
    const outcome = committedOutcomes.entries.find(({ batchId }) => batchId === "batch-45-stadium-crowd")
    assert.equal(outcome.reviewFingerprint, "9db93767ce5667a5831a6b803520712b657634eee88268769088886aac17bf35")
    assert.equal(committedFinalizations.entries[0].baseReviewFingerprint, "581844bfabfe92024656ea7686c8aff4e729bc0bd575da5316634571e4254ea1")

    const drifted = processedEntry("d".repeat(64))
    assert.throws(() => applySignatureSoundWholeConceptStageFinalizations(
      { entries: [drifted] },
      committedFinalizations,
    ), /stale|fingerprint/i)
  })
})
