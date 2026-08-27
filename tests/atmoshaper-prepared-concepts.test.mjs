import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { readFile } from "node:fs/promises"

import moodistConcepts from "../data/atmoshaper/moodist-concepts.json" with { type: "json" }
import constructionReview from "../data/atmoshaper/signature-sound-construction-review.json" with { type: "json" }
import { buildAtmoShaperPreparedConceptCatalog } from "../lib/atmoshaper/signature-sound-prepared-concepts.js"

const SHA_A = "a".repeat(64)
const SHA_B = "b".repeat(64)

function buildCatalog(overrides = {}) {
  return buildAtmoShaperPreparedConceptCatalog({
    moodistConcepts,
    constructionGroups: constructionReview.groups,
    reviewEntries: [
      {
        batchId: "batch-06-droplets",
        groupId: "moodist:droplets",
        label: "Droplets",
        sources: [{ sourceId: SHA_A }],
        reviewFingerprint: SHA_A,
        chatOutcome: { decision: "pass" },
      },
      {
        batchId: "batch-47-source-hold",
        groupId: "signature-extra:source-hold",
        label: "Source Hold",
        sources: [],
        reviewFingerprint: SHA_B,
        chatOutcome: null,
      },
    ],
    processedEntries: [
      {
        batchId: "batch-01-campfire-boiling-water",
        groupId: "moodist:campfire",
        label: "Campfire",
        sourceCount: 4,
        reviewState: "audible-qa-passed",
        reviewFingerprint: SHA_B,
      },
    ],
    ...overrides,
  })
}

describe("AtmoShaper prepared concept catalog", () => {
  it("separates exact completed concepts from Moodist concepts that need recordings", () => {
    const catalog = buildCatalog()

    assert.deepEqual(
      catalog.preparedConcepts.map(({ label, handoffKind }) => [label, handoffKind]),
      [
        ["Campfire", "processed-audio"],
        ["Droplets", "reviewed-dynamic-setup"],
      ],
    )
    assert.equal(catalog.recordingNeeds.length, 51)
    assert.equal(catalog.nativeGeneratedConcepts.length, 3)
    assert.deepEqual(
      catalog.nativeGeneratedConcepts.map(({ id }) => id),
      ["white-noise", "pink-noise", "brown-noise"],
    )
    assert.equal(
      catalog.recordingNeeds.filter(({ reason }) => reason === "no-candidate-recording").length,
      47,
    )
    assert.deepEqual(
      catalog.recordingNeeds
        .filter(({ reason }) => reason === "no-usable-recording")
        .map(({ id }) => id)
        .sort(),
      ["subway-station", "underwater", "wind", "wind-in-trees"],
    )
  })

  it("fails closed on stale completion evidence or duplicate prepared concepts", () => {
    assert.throws(() => buildCatalog({
      processedEntries: [{
        batchId: "batch-01-campfire-boiling-water",
        groupId: "moodist:campfire",
        label: "Campfire",
        sourceCount: 4,
        reviewState: "pending",
        reviewFingerprint: SHA_B,
      }],
    }), /terminal/i)

    assert.throws(() => buildCatalog({
      processedEntries: [{
        batchId: "batch-01-campfire-boiling-water",
        groupId: "moodist:droplets",
        label: "Droplets",
        sourceCount: 1,
        reviewState: "audible-qa-passed",
        reviewFingerprint: SHA_B,
      }],
    }), /duplicate/i)
  })

  it("adds the prepared handoff beside processed audio without page decision controls", async () => {
    const layout = await readFile(new URL("../app/dev/candidates/layout.tsx", import.meta.url), "utf8")
    const hub = await readFile(new URL("../app/dev/candidates/page.tsx", import.meta.url), "utf8")
    const page = await readFile(new URL("../app/dev/candidates/prepared/page.tsx", import.meta.url), "utf8")
    const player = await readFile(new URL("../app/dev/candidates/prepared/prepared-concept-audition.tsx", import.meta.url), "utf8")
    const processedLoader = await readFile(new URL("../app/dev/candidates/prepared/load-processed-playback.ts", import.meta.url), "utf8")
    const processingShell = await readFile(new URL("../app/dev/candidates/processing/processing-review-shell.tsx", import.meta.url), "utf8")

    assert.match(layout, /href="\/dev\/candidates\/processing"[\s\S]*href="\/dev\/candidates\/prepared"/)
    assert.match(hub, /title="Prepared concepts"/)
    assert.match(page, /Prepared AtmoShaper concepts/)
    assert.match(page, /Moodist recordings still needed/)
    assert.match(page, /Generated noise does not need recording/)
    assert.match(page, /PreparedConceptAudition/)
    assert.match(page, /Listen \/ review/)
    assert.match(player, /createSignatureSoundPreviewPlayer/)
    assert.match(player, /prebaked-intro-loop/)
    assert.match(player, /Current concept design/)
    assert.match(player, /Rendered playback timeline/)
    assert.match(player, /WholeConceptPolicySummary/)
    assert.match(player, /Selected recording timeline/)
    assert.match(player, /role="progressbar"/)
    assert.match(processedLoader, /artifactLoopStartSeconds/)
    assert.match(processedLoader, /sourceLoopStartSeconds/)
    assert.match(processedLoader, /crossfadeSeconds/)
    assert.doesNotMatch(page, /batch01Declaration/)
    assert.doesNotMatch(processedLoader, /batch01Declaration/)
    assert.match(processedLoader, /committedBatch03Selection/)
    assert.match(processedLoader, /committedBatch04Selection/)
    assert.match(processedLoader, /selectedTarget !== "dry"/)
    assert.match(processedLoader, /Original Dry source selected/)
    assert.match(processedLoader, /inputMeasurement\.durationSeconds/)
    assert.match(processedLoader, /derived\/\$\{encodeURIComponent\(batchId\)\}\/\$\{encodeURIComponent\(outputIdentity\)\}/)
    assert.match(processingShell, /final whole-concept audition/)
    assert.doesNotMatch(page, /Pass setup|Needs rebuild|Reject concept/)
  })
})
