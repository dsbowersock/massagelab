import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

async function readJson(relativePath) {
  return JSON.parse(await readFile(new URL(relativePath, import.meta.url), "utf8"))
}

async function loadOwner() {
  try {
    return await import("../lib/atmoshaper/signature-sound-edit-audition.js")
  } catch (error) {
    assert.fail(`Edit-audition owner must load: ${error?.message ?? error}`)
  }
}

async function fixture() {
  const [declaration, constructionReview, discoveryReview] = await Promise.all([
    readJson("../data/atmoshaper/signature-sound-derived-audio-batch-04-boiling-water-edit-audition.json"),
    readJson("../data/atmoshaper/signature-sound-construction-review.json"),
    readJson("../data/atmoshaper/signature-sound-review.json"),
  ])
  return { declaration, constructionReview, discoveryReview }
}

describe("AtmoShaper Signature edit audition", () => {
  it("validates the exact Boiling Water source, intents, and closed intro-loop matrix", async () => {
    const owner = await loadOwner()
    assert.equal(typeof owner.validateSignatureSoundEditAuditionBatch, "function")
    const input = await fixture()
    const batch = owner.validateSignatureSoundEditAuditionBatch(input.declaration, input)

    assert.equal(batch.batchId, "batch-04-boiling-water-edit-audition")
    assert.equal(batch.algorithmVersion, "signature-edit-audition-v2")
    assert.equal(batch.outputVersion, 2)
    assert.equal(batch.groupId, "moodist:boiling-water")
    assert.deepEqual(batch.processingIntentIds, ["boiling-repair-loop", "boiling-trim-clicks"])
    assert.deepEqual(batch.sources.map(({ sourceId }) => sourceId), [
      "d4d3d8e79de008a42450e8835383fd2255a801cd29a15f10386fe6cbdab1349c",
    ])
    assert.deepEqual(batch.variants.map(({ variantId, cyclicCrossfadeSeconds }) => ({
      variantId,
      cyclicCrossfadeSeconds,
    })), [
      { variantId: "short-seam", cyclicCrossfadeSeconds: 2 },
      { variantId: "medium-seam", cyclicCrossfadeSeconds: 4 },
      { variantId: "long-seam", cyclicCrossfadeSeconds: 8 },
    ])
    assert.ok(batch.variants.every(({ firstPassStartSeconds, loopStartSeconds, loopEndSeconds }) => (
      firstPassStartSeconds === 0 && loopStartSeconds === 15 && loopEndSeconds === 90
    )))
    assert.match(batch.batchDeclarationSha256, /^[a-f0-9]{64}$/)

    const drifted = structuredClone(input.declaration)
    drifted.variants[0].invented = true
    assert.throws(() => owner.validateSignatureSoundEditAuditionBatch(drifted, input), /unknown field/i)
    const wrongIntent = structuredClone(input.declaration)
    wrongIntent.processingIntentIds = ["boiling-repair-loop"]
    assert.throws(() => owner.validateSignatureSoundEditAuditionBatch(wrongIntent, input), /intent|construction/i)
  })

  it("plans deterministic whole-concept outputs with a one-time opening and portable loop seam", async () => {
    const owner = await loadOwner()
    const input = await fixture()
    const batch = owner.validateSignatureSoundEditAuditionBatch(input.declaration, input)
    const measurements = {
      version: 1,
      batchDeclarationSha256: batch.batchDeclarationSha256,
      toolVersion: "ffmpeg version 9.0-full_build-www.gyan.dev",
      sources: {
        [batch.sources[0].sourceId]: {
          durationSeconds: 143.18356,
          integratedLoudnessLufs: -31.2,
          truePeakDbtp: -4.1,
          sampleRateHz: 44100,
          channels: 2,
        },
      },
    }
    const firstPlan = owner.planSignatureSoundEditAuditionBatch(batch, measurements)
    const secondPlan = owner.planSignatureSoundEditAuditionBatch(batch, measurements)

    assert.deepEqual(secondPlan, firstPlan)
    assert.equal(firstPlan.outputs.length, 3)
    assert.deepEqual(firstPlan.outputs.map(({ firstLoopOffsetSeconds }) => firstLoopOffsetSeconds), [88, 86, 82])
    assert.deepEqual(firstPlan.outputs.map(({ loopRegionDurationSeconds }) => loopRegionDurationSeconds), [73, 71, 67])
    assert.deepEqual(firstPlan.outputs.map(({ expectedDurationSeconds }) => expectedDurationSeconds), [161, 157, 149])
    assert.equal(new Set(firstPlan.outputs.map(({ outputIdentity }) => outputIdentity)).size, 3)
    assert.equal(new Set(firstPlan.outputs.map(({ outputRelativePath }) => outputRelativePath)).size, 3)
    assert.ok(firstPlan.outputs.every(({ reviewMode }) => reviewMode === "intro-then-cyclic-loop"))

    const argv = owner.buildSignatureSoundEditRenderArgv(firstPlan.outputs[1], {
      ffmpegCommand: "ffmpeg",
      sourceRoot: "<source-root>",
      outputRoot: "<output-root>",
    })
    assert.equal(argv[0], "ffmpeg")
    assert.ok(argv.includes("-filter_complex"))
    const filter = argv[argv.indexOf("-filter_complex") + 1]
    assert.match(filter, /atrim=start=0:end=86/)
    assert.match(filter, /atrim=start=86:end=90/)
    assert.match(filter, /atrim=start=15:end=19/)
    assert.match(filter, /acrossfade=d=4/)
    assert.match(filter, /concat=n=3:v=0:a=1/)
    assert.equal(
      argv[argv.indexOf("-i") + 1],
      "<source-root>/RandomRecordings+Vol.2/RandomRecordings Vol.2/Kettle Boiling.wav",
    )
    assert.equal(
      argv.at(-1),
      `<output-root>/boiling-water/${batch.sources[0].sourceId}-medium-seam-v2.wav`,
    )
    assert.ok(argv.includes("-n"))
  })

  it("validates a manifest as the exact closed plan instead of trusting artifact metadata", async () => {
    const owner = await loadOwner()
    assert.equal(typeof owner.validateSignatureSoundEditAuditionManifest, "function")
    const input = await fixture()
    const batch = owner.validateSignatureSoundEditAuditionBatch(input.declaration, input)
    const measurements = {
      version: 1,
      batchDeclarationSha256: batch.batchDeclarationSha256,
      toolVersion: "ffmpeg version 9.0-full_build-www.gyan.dev",
      sources: {
        [batch.sources[0].sourceId]: {
          durationSeconds: 143.18356,
          integratedLoudnessLufs: -31.2,
          truePeakDbtp: -4.1,
          sampleRateHz: 44100,
          channels: 2,
        },
      },
    }
    const plan = owner.planSignatureSoundEditAuditionBatch(batch, measurements)
    const manifest = {
      version: 1,
      batchId: plan.batchId,
      batchDeclarationSha256: plan.batchDeclarationSha256,
      algorithmVersion: plan.algorithmVersion,
      groupId: plan.groupId,
      processingIntentIds: plan.processingIntentIds,
      reviewKind: "edit-audition",
      measurementToolVersion: plan.toolVersion,
      outputs: plan.outputs.map((output) => ({
        sourceId: output.sourceId,
        sourceSha256: output.sourceSha256,
        variantId: output.variantId,
        variantLabel: output.variantLabel,
        edit: output.edit,
        reviewMode: output.reviewMode,
        outputRelativePath: output.outputRelativePath,
        outputIdentity: output.outputIdentity,
        ffmpegArgv: owner.buildSignatureSoundEditRenderArgv(output, {
          ffmpegCommand: "ffmpeg",
          sourceRoot: "<source-root>",
          outputRoot: "<output-root>",
        }),
        inputMeasurement: output.inputMeasurement,
        outputMeasurement: {
          outputSha256: "d".repeat(64),
          byteSize: 1024,
          codecName: "pcm_s24le",
          sampleRateHz: 48000,
          channels: 2,
          bitsPerSample: 24,
          durationSeconds: output.expectedDurationSeconds,
          integratedLoudnessLufs: -31,
          truePeakDbtp: -1,
        },
      })),
    }
    assert.deepEqual(owner.validateSignatureSoundEditAuditionManifest(manifest, batch), manifest)
    const drifted = structuredClone(manifest)
    drifted.outputs[0].edit.loopStartSeconds = 5
    assert.throws(() => owner.validateSignatureSoundEditAuditionManifest(drifted, batch), /edit|plan|match/i)
  })
})
