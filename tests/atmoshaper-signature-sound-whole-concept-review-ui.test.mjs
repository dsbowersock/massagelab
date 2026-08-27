import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

const page = await readFile(
  new URL("../app/dev/candidates/processing/page.tsx", import.meta.url),
  "utf8",
)
const client = await readFile(
  new URL("../app/dev/candidates/processing/whole-concept-review.tsx", import.meta.url),
  "utf8",
).catch(() => "")
const navigation = await readFile(
  new URL("../app/dev/candidates/processing/processing-review-navigation.tsx", import.meta.url),
  "utf8",
).catch(() => "")
const shell = await readFile(
  new URL("../app/dev/candidates/processing/processing-review-shell.tsx", import.meta.url),
  "utf8",
).catch(() => "")
const retirement = await readFile(
  new URL("../app/dev/candidates/processing/processing-batch-retirement.ts", import.meta.url),
  "utf8",
).catch(() => "")
const timelines = await readFile(
  new URL("../app/dev/candidates/processing/active-voice-timelines.tsx", import.meta.url),
  "utf8",
).catch(() => "")
const policySummary = await readFile(
  new URL("../app/dev/candidates/processing/whole-concept-policy-summary.tsx", import.meta.url),
  "utf8",
).catch(() => "")
const catalogComposer = await readFile(
  new URL("../lib/atmoshaper/dev-signature-review-catalog.js", import.meta.url),
  "utf8",
).catch(() => "")

describe("AtmoShaper whole-concept morning review UI", () => {
  it("dispatches the complete raw review queue through one page branch", () => {
    assert.match(page, /signature-sound-whole-concept-review-batches\.json/)
    assert.match(page, /validateSignatureSoundWholeConceptReviewCatalog/)
    assert.match(page, /kind:\s*"whole-concept"/)
    assert.match(page, /WholeConceptReview/)
    assert.match(page, /wholeConceptCatalog\.entries/)
    assert.match(page, /signature-sound-whole-concept-chat-outcomes\.json/)
    assert.match(page, /signature-sound-whole-concept-review-revisions\.json/)
    assert.match(page, /applySignatureSoundWholeConceptReviewRevisions/)
    assert.match(page, /signature-sound-whole-concept-review-amendments\.json/)
    assert.match(page, /applySignatureSoundWholeConceptReviewAmendments/)
    assert.match(page, /redirect\.targetBatchId/)
    assert.match(page, /composeDevSignatureSoundReviewCatalog/)
    assert.match(catalogComposer, /validateSignatureSoundWholeConceptOutcomeCatalog/)
    assert.match(catalogComposer, /selectUnavailableDevSignatureSoundSpeechReductionBatches/)
    assert.match(catalogComposer, /inactiveReviewBatchIds/)
    assert.match(catalogComposer, /validateSignatureSoundCatalogExpansionReview/)
    assert.ok(
      page.indexOf("applyDevSignatureSoundSpeechReductionReview({") < page.indexOf("composeDevSignatureSoundReviewCatalog({"),
      "chat outcomes must bind to the processed review fingerprint",
    )
    assert.doesNotMatch(page, /batch-06-droplets.*batch-07-electrical-interference.*batch-08-washing-dishes/s)
    assert.ok(page.split(/\r?\n/).length <= 400, "processing page must remain within its recorded 400-line budget")
  })

  it("defaults a completed derived queue to the first concept without a direct Pass", () => {
    assert.match(page, /firstPendingWholeConcept/)
    assert.match(page, /chatOutcome\?\.decision\s*!==\s*"pass"/)
    assert.doesNotMatch(page, /rawBatch === undefined && catalogRoot\s*\?\s*defaultCatalogBatchId/s)
  })

  it("provides whole-concept playback and chat-only navigation without decision controls", () => {
    assert.match(client, /^"use client"/)
    assert.match(client, /createSignatureSoundPreviewPlayer/)
    assert.match(client, /Start concept/)
    assert.match(client, /Stop concept/)
    assert.match(client, /Next transition \/ event/)
    assert.match(client, /Reply in chat with Pass or what should change/)
    assert.match(client, /Previous concept/)
    assert.match(client, /Next concept/)
    assert.match(client, /resolveSignatureSoundWholeConceptAudioUrl/)
    assert.match(client, /signatureSoundConceptHasAuditionableSources/)
    assert.match(client, /hasCompleteProcessedUrls/)
    assert.match(client, /Concept is playing\./)
    assert.match(client, /Current source:/)
    assert.match(client, /WholeConceptPolicySummary/)
    assert.match(client, /runtimePolicy: entry\.runtimePolicy/)
    assert.match(client, /levelMatch=\{entry\.levelMatch\}/)
    assert.match(client, /sourceSelection\?: \{ kind: "single-source-loop" \}/)
    assert.match(client, /entry\.sources\.filter/)
    assert.match(client, /Choose the one recording to loop/)
    assert.match(client, /Individual source auditions/)
    assert.match(client, /processingBlocked/)
    assert.match(client, /Batch \{entry\.batchId\.slice\(6, 8\)\}/)
    assert.match(client, /Review \{batchPosition\} of \{batchCount\}/)
    assert.doesNotMatch(client, /Batch \{batchPosition\} of \{batchCount\}/)
    assert.match(client, /Requested audio treatment is still required/)
    assert.match(client, /current processed treatment; additional processing is still required/i)
    assert.match(client, /whole-concept Pass remains pending/i)
    assert.match(client, /Current stage passed in chat/)
    assert.match(client, /This exact processed stage is recorded as Pass from chat/)
    assert.match(client, /remaining treatments listed above are still pending/i)
    assert.match(policySummary, /Current playback policy/)
    assert.match(policySummary, /Constant gain per recording/)
    assert.match(policySummary, /settings\.transitionMode === "overlap"/)
    assert.match(policySummary, /no fade/i)
    assert.match(policySummary, /Plain overlap with no fade/)
    assert.match(policySummary, /Repeating region/)
    assert.match(policySummary, /entrance and exit crossfades do not collide/)
    assert.match(policySummary, /Strict cap/)
    assert.match(policySummary, /independent logical tracks/)
    assert.match(policySummary, /consecutive plays total/)
    assert.match(policySummary, /fourBeatBars.*four-beat bars at.*beatsPerMinute.*BPM/s)
    assert.match(client, /ActiveVoiceTimelines/)
    assert.match(client, /onVoiceTelemetry/)
    assert.match(client, /seekVoice/)
    assert.match(timelines, /type="range"/)
    assert.match(timelines, /Elapsed/)
    assert.match(timelines, /aria-label=\{`Seek Recording \$\{index \+ 1\}/)
    assert.match(timelines, /aria-valuetext/)
    assert.match(timelines, /recordings overlap right now/i)
    assert.match(timelines, /Active source window/)
    assert.match(timelines, /laneId/)
    assert.doesNotMatch(timelines, /role="status"|aria-live/)
    assert.match(client, /waitingForNextEvent/)
    assert.match(client, /Waiting for the next spaced event/)
    assert.match(client, /!starting && !playing && !hasActiveVoices/)
    assert.match(client, /A replacement failed; existing recordings may still be playing/)
    assert.match(client, /including any active reviewer revision/)
    assert.match(navigation, /including reviewer amendments/)
    const liveStatus = client.match(/<p role="status"[\s\S]*?<\/p>/)?.[0] ?? ""
    assert.doesNotMatch(liveStatus, /previewStatus\.relativePath/)
    assert.doesNotMatch(client, /DecisionButton|localStorage|Export.*QA|Approve|Reject/)
    assert.match(shell, /<WholeConceptReview\s+key=\{loaded\.entry\.reviewFingerprint\}/s)
  })

  it("keeps recovery guidance review-mode neutral and the page below its extraction threshold", () => {
    assert.match(page, /processing-review-shell/)
    assert.match(shell, /The selected review batch is unavailable/)
    assert.doesNotMatch(shell, /The selected derived-audio batch is unavailable/)
    assert.ok(page.split(/\r?\n/).length <= 330, "processing page should retain room for later batches")
  })

  it("keeps the four active processed batches and the complete raw queue in one compact dropdown", () => {
    assert.match(shell, /ProcessingBatchSelector/)
    assert.match(shell, /activeProcessedBatches/)
    assert.match(shell, /RETIRED_PROCESSED_BATCH_IDS/)
    assert.match(page, /redirectRetiredProcessingBatch\(rawBatch\)/)
    assert.match(retirement, /batch-01-campfire-boiling-water/)
    assert.match(retirement, /batch-30-fireplace/)
    assert.match(shell, /wholeConceptCatalog\.entries/)
    assert.match(navigation, /Processed-audio and concept review batches/)
    assert.match(navigation, /\/dev\/candidates\/processing\?batch=/)
    assert.match(navigation, /<select[^>]+name="batch"/)
    assert.match(navigation, /\{batches\.map/)
    assert.doesNotMatch(navigation, /<Link/)
    assert.match(navigation, /Open review/)
    assert.match(navigation, /surviving concepts/)
    assert.match(navigation, /processing-gated concepts remain visible/)
  })
})
