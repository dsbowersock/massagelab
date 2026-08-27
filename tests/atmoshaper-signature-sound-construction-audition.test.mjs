import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { describe, it } from "node:test"
import { fileURLToPath } from "node:url"

import {
  createSignatureSoundConstructionAudition,
} from "../lib/atmoshaper/signature-sound-construction-audition.js"

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")

async function readJson(relativePath) {
  return JSON.parse(await readFile(join(repoRoot, relativePath), "utf8"))
}

async function loadInputs() {
  const [
    moodistConcepts,
    discoveryReview,
    exportedListeningReview,
    listeningReview,
    strategyPolicy,
    workspace,
    interpretations,
    constructionReview,
  ] = await Promise.all([
    readJson("data/atmoshaper/moodist-concepts.json"),
    readJson("data/atmoshaper/signature-sound-review.json"),
    readJson("tests/fixtures/atmoshaper/signature-listening-review-v1-a22a9d19d8.json"),
    readJson("data/atmoshaper/signature-sound-listening-review.json"),
    readJson("data/atmoshaper/signature-sound-playback-strategies.json"),
    readJson("tests/fixtures/atmoshaper/signature-complete-review-v3-a22a9d19d8.json"),
    readJson("data/atmoshaper/signature-sound-construction-interpretations.json"),
    readJson("data/atmoshaper/signature-sound-construction-review.json"),
  ])
  return {
    constructionReview,
    authority: {
      moodistConcepts,
      discoveryReview,
      exportedListeningReview,
      listeningReview,
      strategyPolicy,
      workspace,
      interpretations,
    },
  }
}

function byGroup(audition, groupId) {
  const group = audition.groups.find((candidate) => candidate.groupId === groupId)
  assert.ok(group, `expected construction audition group ${groupId}`)
  return group
}

describe("AtmoShaper Signature construction audition projection", () => {
  it("projects the exact playback-construction queue from canonical intent", async () => {
    const { constructionReview, authority } = await loadInputs()

    const audition = createSignatureSoundConstructionAudition(constructionReview, authority)

    assert.equal(audition.version, 1)
    assert.equal(audition.algorithmVersion, "signature-construction-audition-v1")
    assert.equal(
      audition.constructionReviewSha256,
      constructionReview.fingerprints.constructionReviewSha256,
    )
    assert.deepEqual(audition.groups.map(({ groupId }) => groupId), [
      "moodist:dryer",
      "moodist:walk-on-gravel",
      "moodist:walk-on-leaves",
      "signature-extra:air-traffic-control",
      "signature-extra:horror-suspense",
      "signature-extra:moon-footsteps",
      "signature-extra:sci-fi-whistles",
      "signature-extra:underwater-effects",
      "signature-extra:walk-on-stone",
    ])
  })

  it("carries exact gap, history, transition, cadence, and overlap policies", async () => {
    const { constructionReview, authority } = await loadInputs()
    const audition = createSignatureSoundConstructionAudition(constructionReview, authority)

    const airTraffic = byGroup(audition, "signature-extra:air-traffic-control")
    assert.deepEqual(airTraffic.previewSettings, { minimumGapSeconds: 1, maximumGapSeconds: 7 })
    assert.equal(airTraffic.policy.minimumSelectionsBeforeRepeat, 4)
    assert.equal(airTraffic.status, "processing-pending")
    assert.deepEqual(airTraffic.allowedQaScopes, ["playback-only"])
    assert.deepEqual(airTraffic.processingIntentIds, ["air-traffic-normalize"])

    const horror = byGroup(audition, "signature-extra:horror-suspense")
    assert.deepEqual(horror.previewSettings, { minimumGapSeconds: 0, maximumGapSeconds: 16 })
    assert.equal(horror.status, "ready")
    assert.deepEqual(horror.allowedQaScopes, ["playback-only", "complete-construction"])

    const whistles = byGroup(audition, "signature-extra:sci-fi-whistles")
    assert.deepEqual(whistles.previewSettings, { minimumGapSeconds: 0, maximumGapSeconds: 8 })
    assert.deepEqual(whistles.processingIntentIds, ["whistles-time-effect"])

    const dryer = byGroup(audition, "moodist:dryer")
    assert.deepEqual(dryer.policy.transitionDurationRange, {
      minimumSeconds: 3.75,
      maximumSeconds: 10,
    })
    assert.deepEqual(dryer.processingIntentIds, ["dryer-trim-boundaries"])

    const gravel = byGroup(audition, "moodist:walk-on-gravel")
    assert.deepEqual(gravel.policy.boundaryModeCandidates, ["crossfade", "overlap"])
    assert.deepEqual(gravel.previewSettings, { stepsPerMinute: 92, jitterPercent: 3 })

    const leaves = byGroup(audition, "moodist:walk-on-leaves")
    assert.equal(leaves.policy.minimumSelectionsBeforeRepeat, 3)

    const moon = byGroup(audition, "signature-extra:moon-footsteps")
    assert.equal(moon.policy.overlapNextEvent, true)
    assert.deepEqual(moon.previewSettings, { stepsPerMinute: 44, jitterPercent: 1 })

    const puddles = byGroup(audition, "signature-extra:underwater-effects")
    assert.deepEqual(puddles.previewSettings, { stepsPerMinute: 105, jitterPercent: 8 })
    assert.equal(puddles.status, "ready")
  })

  it("keeps missing construction instructions blocked instead of inferring a change", async () => {
    const { constructionReview, authority } = await loadInputs()
    const audition = createSignatureSoundConstructionAudition(constructionReview, authority)

    const stone = byGroup(audition, "signature-extra:walk-on-stone")
    assert.equal(stone.status, "blocked")
    assert.deepEqual(stone.blockers, ["missing-construction-instruction"])
    assert.deepEqual(stone.allowedQaScopes, [])
    assert.deepEqual(stone.noteDispositionIds, [])
  })

  it("fails closed on stale authority and returns copy-safe deterministic output", async () => {
    const { constructionReview, authority } = await loadInputs()
    const reviewBefore = structuredClone(constructionReview)
    const authorityBefore = structuredClone(authority)

    const first = createSignatureSoundConstructionAudition(constructionReview, authority)
    assert.deepEqual(constructionReview, reviewBefore)
    assert.deepEqual(authority, authorityBefore)

    first.groups[0].previewSettings = { fabricated: true }
    assert.deepEqual(createSignatureSoundConstructionAudition(constructionReview, authority), {
      ...createSignatureSoundConstructionAudition(constructionReview, authority),
    })
    assert.equal(byGroup(createSignatureSoundConstructionAudition(constructionReview, authority), "moodist:dryer").previewSettings.fabricated, undefined)

    const stale = structuredClone(constructionReview)
    stale.groups.find(({ groupId }) => groupId === "signature-extra:horror-suspense")
      .playback.previewSettings.maximumGapSeconds = 15
    assert.throws(() => createSignatureSoundConstructionAudition(stale, authority), /authority|construction review/i)
  })

  it("keeps the browser-facing generated projection exact", async () => {
    const { constructionReview, authority } = await loadInputs()
    const committed = await readJson("data/atmoshaper/signature-sound-construction-audition.json")
    assert.deepEqual(committed, createSignatureSoundConstructionAudition(constructionReview, authority))
  })
})
