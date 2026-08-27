import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

const dryerReviewModule = await import("../lib/atmoshaper/signature-sound-dryer-concept-review.js").catch(() => ({}))
const validateSelection = dryerReviewModule.validateSignatureSoundDryerConceptSelection
const selectionText = await readFile(
  new URL("../data/atmoshaper/signature-sound-dryer-concept-selection.json", import.meta.url),
  "utf8",
).catch(() => null)

const SOURCE_ID = "a2cdc5b801058999b253de905dcdc45e612c5e944ef6e4202a0d815b91bf8d4f"
const OUTPUT_IDENTITY = "a510f71e32036d3b99f8b6e3e1137fa01df6e2643dd22c501e66eb23c500c2ac"
const MANIFEST_SHA256 = "2612f3cf58c2be61ad3f609fc5e6237af34143c1185a983f5a892a58a11d9d9d"
const manifest = {
  version: 1,
  batchId: "batch-05-dryer-trim-audition",
  batchDeclarationSha256: "15ae5817239e3b43da3a520bae261fdf03756401d05220b06885996b18cfe2b9",
  groupId: "moodist:dryer",
  outputs: [{ sourceId: SOURCE_ID, outputIdentity: OUTPUT_IDENTITY }],
}
const playbackConfiguration = {
  strategyId: "adaptive-whole-source-sequence",
  previewSettings: { transitionMode: "crossfade", transitionSeconds: 3.75 },
  constructionPolicy: {
    minimumSelectionsBeforeRepeat: null,
    transitionDurationRange: { minimumSeconds: 3.75, maximumSeconds: 10 },
    cadenceBoundary: null,
    overlapNextEvent: false,
  },
}

describe("AtmoShaper Dryer direct concept selection", () => {
  it("validates the committed dry choice against the exact comparison and playback setup", () => {
    assert.equal(typeof validateSelection, "function")
    assert.ok(selectionText, "expected a committed Dryer concept selection")
    const selection = validateSelection(JSON.parse(selectionText), {
      manifest,
      manifestSha256: MANIFEST_SHA256,
      playbackConfiguration,
    })
    assert.equal(selection.selectedTarget, "dry")
    assert.equal(selection.selectedLabel, "Dry concept")
    assert.equal(selection.sourceId, SOURCE_ID)
    assert.equal(selection.comparisonOutputIdentity, OUTPUT_IDENTITY)
    assert.equal(selection.decision, "pass")
  })

  it("rejects stale identities, changed playback, and an invented trimmed decision", () => {
    assert.equal(typeof validateSelection, "function")
    assert.ok(selectionText, "expected a committed Dryer concept selection")
    const selection = JSON.parse(selectionText)
    const context = { manifest, manifestSha256: MANIFEST_SHA256, playbackConfiguration }
    assert.throws(() => validateSelection({ ...selection, manifestSha256: "f".repeat(64) }, context), /stale/i)
    assert.throws(() => validateSelection({ ...selection, comparisonOutputIdentity: "f".repeat(64) }, context), /identity|drift/i)
    assert.throws(() => validateSelection(selection, {
      ...context,
      playbackConfiguration: {
        ...playbackConfiguration,
        constructionPolicy: {
          ...playbackConfiguration.constructionPolicy,
          transitionDurationRange: { minimumSeconds: 4, maximumSeconds: 10 },
        },
      },
    }), /playback|configuration/i)
    assert.throws(() => validateSelection({ ...selection, selectedTarget: "trimmed" }, context), /label|target|identity/i)
  })
})
