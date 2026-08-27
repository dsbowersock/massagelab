import assert from "node:assert/strict"
import { describe, it } from "node:test"

async function loadGroupReviewModule() {
  try {
    return await import("../lib/atmoshaper/signature-sound-group-review.js")
  } catch (error) {
    assert.fail(`Signature group-review owner must load: ${error?.message ?? error}`)
  }
}

function fixtureCuration() {
  return {
    fingerprints: { curationSha256: "a".repeat(64) },
    strategies: [
      { id: "adaptive-whole-source-sequence" },
      { id: "walking-cadence-sequence" },
      { id: "spaced-event-sequence" },
    ],
    groups: [
      {
        groupId: "moodist:waves",
        strategyId: "adaptive-whole-source-sequence",
      },
      {
        groupId: "signature-extra:keys-jingling",
        strategyId: "adaptive-whole-source-sequence",
      },
    ],
  }
}

function fixtureReview() {
  return {
    version: 2,
    reviewFingerprint: "a".repeat(64),
    updatedAt: "2026-08-23T15:00:00.000Z",
    groups: {
      "signature-extra:keys-jingling": {
        decision: "change",
        strategyId: "spaced-event-sequence",
        previewSettings: { minimumGapSeconds: 2, maximumGapSeconds: 6 },
        sourcePool: "keep-and-maybe",
        note: "Leave breathing room between clusters.",
      },
      "moodist:waves": {
        decision: "approve",
        strategyId: "adaptive-whole-source-sequence",
        previewSettings: { transitionMode: "crossfade", transitionSeconds: 2 },
        sourcePool: "keep-only",
        auditionedAt: "2026-08-23T14:59:00.000Z",
        auditionKey: "adaptive-whole-source-sequence|keep-only|{\"transitionMode\":\"crossfade\",\"transitionSeconds\":2}",
        note: "",
      },
    },
  }
}

describe("AtmoShaper Signature group review", () => {
  it("normalizes a sparse fingerprint-bound group review without mutating its inputs", async () => {
    const { validateSignatureSoundGroupReview } = await loadGroupReviewModule()
    const curation = fixtureCuration()
    const rawReview = fixtureReview()
    const normalized = validateSignatureSoundGroupReview(rawReview, curation)

    assert.deepEqual(Object.keys(normalized.groups), ["moodist:waves", "signature-extra:keys-jingling"])
    assert.deepEqual(normalized.groups["moodist:waves"], {
      decision: "approve",
      strategyId: "adaptive-whole-source-sequence",
      previewSettings: { transitionMode: "crossfade", transitionSeconds: 2 },
      sourcePool: "keep-only",
      auditionedAt: "2026-08-23T14:59:00.000Z",
      auditionKey: "adaptive-whole-source-sequence|keep-only|{\"transitionMode\":\"crossfade\",\"transitionSeconds\":2}",
      note: "",
    })
    normalized.groups["moodist:waves"].note = "mutated copy"
    assert.equal(rawReview.groups["moodist:waves"].note, "")
    assert.equal(curation.groups[0].strategyId, "adaptive-whole-source-sequence")
  })

  it("renders deterministic review JSON independent of input group order", async () => {
    const { renderSignatureSoundGroupReviewJson } = await loadGroupReviewModule()
    const curation = fixtureCuration()
    const first = fixtureReview()
    const second = {
      ...first,
      groups: {
        "moodist:waves": first.groups["moodist:waves"],
        "signature-extra:keys-jingling": first.groups["signature-extra:keys-jingling"],
      },
    }
    assert.equal(
      renderSignatureSoundGroupReviewJson(first, curation),
      renderSignatureSoundGroupReviewJson(second, curation),
    )
    assert.match(renderSignatureSoundGroupReviewJson(first, curation), /"reviewFingerprint": "a{64}"/)
  })

  it("fails closed on stale fingerprints, unknown identities, strategies, decisions, and fields", async () => {
    const { validateSignatureSoundGroupReview } = await loadGroupReviewModule()
    const curation = fixtureCuration()
    const mutations = [
      [review => { review.reviewFingerprint = "b".repeat(64) }, /fingerprint/i],
      [review => { review.groups["moodist:rain"] = review.groups["moodist:waves"] }, /unknown.*group/i],
      [review => { review.groups["moodist:waves"].strategyId = "unknown-sequence" }, /unknown.*strategy/i],
      [review => { review.groups["moodist:waves"].decision = "maybe" }, /decision|supported/i],
      [review => { delete review.groups["moodist:waves"].auditionedAt }, /audition/i],
      [review => { review.groups["moodist:waves"].auditionKey = "stale" }, /audition|configuration/i],
      [review => { review.groups["moodist:waves"].sourcePool = "rejected-too" }, /source pool|supported/i],
      [review => { review.groups["moodist:waves"].previewSettings.transitionSeconds = 99 }, /seconds|range/i],
      [review => { review.groups["signature-extra:keys-jingling"].previewSettings = { transitionMode: "crossfade", transitionSeconds: 2 } }, /gap|unknown field|settings/i],
      [review => { review.groups["moodist:waves"].extra = true }, /unknown field/i],
      [review => { review.extra = true }, /unknown field/i],
      [review => { review.updatedAt = "yesterday" }, /timestamp|time/i],
    ]
    for (const [mutate, expected] of mutations) {
      const review = fixtureReview()
      mutate(review)
      assert.throws(() => validateSignatureSoundGroupReview(review, curation), expected)
    }
  })

  it("requires the current auditioned configuration before approval but permits unauditioned change feedback", async () => {
    const { validateSignatureSoundGroupReview } = await loadGroupReviewModule()
    const curation = fixtureCuration()
    const review = fixtureReview()
    delete review.groups["moodist:waves"].auditionedAt
    delete review.groups["moodist:waves"].auditionKey
    assert.throws(() => validateSignatureSoundGroupReview(review, curation), /approve|audition/i)

    review.groups["moodist:waves"].decision = "change"
    assert.doesNotThrow(() => validateSignatureSoundGroupReview(review, curation))
  })
})
