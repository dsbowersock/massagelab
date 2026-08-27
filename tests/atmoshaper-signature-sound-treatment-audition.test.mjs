import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

async function readJson(relativePath) {
  return JSON.parse(await readFile(new URL(relativePath, import.meta.url), "utf8"))
}

async function loadOwner() {
  try {
    return await import("../lib/atmoshaper/signature-sound-treatment-audition.js")
  } catch (error) {
    assert.fail(`Signature treatment-audition owner must load: ${error?.message ?? error}`)
  }
}

function clone(value) {
  return structuredClone(value)
}

describe("AtmoShaper Signature treatment audition", () => {
  it("validates the exact closed Sci-Fi Whistles variant declaration", async () => {
    const { validateSignatureSoundTreatmentAuditionBatch } = await loadOwner()
    const [declaration, constructionReview, discoveryReview] = await Promise.all([
      readJson("../data/atmoshaper/signature-sound-derived-audio-batch-03-sci-fi-whistles-treatment-audition.json"),
      readJson("../data/atmoshaper/signature-sound-construction-review.json"),
      readJson("../data/atmoshaper/signature-sound-review.json"),
    ])

    const batch = validateSignatureSoundTreatmentAuditionBatch(declaration, {
      constructionReview,
      discoveryReview,
    })

    assert.equal(batch.batchId, "batch-03-sci-fi-whistles-treatment-audition")
    assert.equal(batch.outputVersion, 2)
    assert.equal(batch.groupId, "signature-extra:sci-fi-whistles")
    assert.deepEqual(batch.processingIntentIds, ["whistles-time-effect"])
    assert.equal(batch.sources.length, 18)
    assert.deepEqual(batch.variants.map(({ variantId }) => variantId), [
      "short-delay",
      "medium-echo",
      "wide-dual-echo",
      "wide-dual-echo-x2",
    ])
    assert.deepEqual(batch.variants.map(({ delaysMs }) => delaysMs), [
      [120],
      [180, 360],
      [260, 520],
      [260, 520],
    ])
    const wide = batch.variants.find(({ variantId }) => variantId === "wide-dual-echo")
    const doubledWide = batch.variants.find(({ variantId }) => variantId === "wide-dual-echo-x2")
    assert.deepEqual(doubledWide.delaysMs, wide.delaysMs)
    assert.deepEqual(doubledWide.decays, wide.decays.map((decay) => decay * 2))
    assert.equal(doubledWide.safetyAttenuationDb, -3)
    assert.ok(batch.sources.every(({ sourceId }) => (
      constructionReview.groups
        .find(({ groupId }) => groupId === batch.groupId)
        .includedSourceIds.includes(sourceId)
    )))
    assert.match(batch.batchDeclarationSha256, /^[a-f0-9]{64}$/)
  })

  it("expands every source through every variant with deterministic effect arguments", async () => {
    const owner = await loadOwner()
    assert.equal(typeof owner.planSignatureSoundTreatmentAuditionBatch, "function")
    assert.equal(typeof owner.buildSignatureSoundTreatmentRenderArgv, "function")
    const [declaration, constructionReview, discoveryReview] = await Promise.all([
      readJson("../data/atmoshaper/signature-sound-derived-audio-batch-03-sci-fi-whistles-treatment-audition.json"),
      readJson("../data/atmoshaper/signature-sound-construction-review.json"),
      readJson("../data/atmoshaper/signature-sound-review.json"),
    ])
    const batch = owner.validateSignatureSoundTreatmentAuditionBatch(declaration, {
      constructionReview,
      discoveryReview,
    })
    const measurements = {
      version: 1,
      batchDeclarationSha256: batch.batchDeclarationSha256,
      toolVersion: "ffmpeg version 9.0-full_build-www.gyan.dev",
      sources: Object.fromEntries(batch.sources.map((source, index) => [source.sourceId, {
        durationSeconds: 1 + index / 10,
        integratedLoudnessLufs: -20 - index / 10,
        truePeakDbtp: -3,
        sampleRateHz: 44100,
        channels: 1,
      }])),
    }

    const plan = owner.planSignatureSoundTreatmentAuditionBatch(batch, measurements)
    assert.equal(plan.outputs.length, 72)
    assert.deepEqual(plan.outputs.slice(0, 4).map(({ variantId }) => variantId), [
      "short-delay",
      "medium-echo",
      "wide-dual-echo",
      "wide-dual-echo-x2",
    ])
    assert.equal(new Set(plan.outputs.map(({ outputIdentity }) => outputIdentity)).size, 72)
    assert.equal(new Set(plan.outputs.map(({ outputRelativePath }) => outputRelativePath)).size, 72)
    assert.ok(plan.outputs.every(({ outputRelativePath }) => outputRelativePath.startsWith("sci-fi-whistles/")))
    assert.ok(plan.outputs.every(({ outputRelativePath }) => outputRelativePath.endsWith("-v2.wav")))
    assert.ok(plan.outputs.every(({ outputChannels }) => outputChannels === 1))

    const medium = plan.outputs.find(({ variantId }) => variantId === "medium-echo")
    const argv = owner.buildSignatureSoundTreatmentRenderArgv(medium, {
      ffmpegCommand: "ffmpeg",
      sourceRoot: "C:\\source",
      outputRoot: "C:\\output",
      destinationRelativePath: "sci-fi-whistles\\pending.wav",
    })
    assert.equal(argv[0], "ffmpeg")
    assert.ok(argv.includes("-n"))
    assert.ok(argv.includes("pcm_s24le"))
    assert.doesNotMatch(argv.join(" "), /-ac\s+\d/)
    assert.match(argv.join(" "), /aecho=0\.9:0\.72:180\|360:0\.3\|0\.15/)
    assert.match(argv.join(" "), /volume=-1\.5dB/)
    assert.match(argv.join(" "), /aresample=48000/)
  })

  it("rejects undeclared variants and parameter drift", async () => {
    const { validateSignatureSoundTreatmentAuditionBatch } = await loadOwner()
    const [declaration, constructionReview, discoveryReview] = await Promise.all([
      readJson("../data/atmoshaper/signature-sound-derived-audio-batch-03-sci-fi-whistles-treatment-audition.json"),
      readJson("../data/atmoshaper/signature-sound-construction-review.json"),
      readJson("../data/atmoshaper/signature-sound-review.json"),
    ])
    const context = { constructionReview, discoveryReview }
    const unknownVariant = clone(declaration)
    unknownVariant.variants[0].variantId = "surprise-effect"
    assert.throws(
      () => validateSignatureSoundTreatmentAuditionBatch(unknownVariant, context),
      /variant|undeclared|unsupported/i,
    )
    const unsafeGain = clone(declaration)
    unsafeGain.variants[0].inputGain = 1
    unsafeGain.variants[0].outputGain = 1
    unsafeGain.variants[0].safetyAttenuationDb = 0
    assert.throws(
      () => validateSignatureSoundTreatmentAuditionBatch(unsafeGain, context),
      /gain|peak|safe/i,
    )
    const unknownField = clone(declaration)
    unknownField.variants[0].feedback = 0.5
    assert.throws(
      () => validateSignatureSoundTreatmentAuditionBatch(unknownField, context),
      /unknown field/i,
    )
  })

  it("validates a complete variant-bound manifest and rejects identity drift", async () => {
    const owner = await loadOwner()
    assert.equal(typeof owner.validateSignatureSoundTreatmentAuditionManifest, "function")
    const [declaration, constructionReview, discoveryReview] = await Promise.all([
      readJson("../data/atmoshaper/signature-sound-derived-audio-batch-03-sci-fi-whistles-treatment-audition.json"),
      readJson("../data/atmoshaper/signature-sound-construction-review.json"),
      readJson("../data/atmoshaper/signature-sound-review.json"),
    ])
    const batch = owner.validateSignatureSoundTreatmentAuditionBatch(declaration, { constructionReview, discoveryReview })
    const measurements = {
      version: 1,
      batchDeclarationSha256: batch.batchDeclarationSha256,
      toolVersion: "ffmpeg version 9.0-full_build-www.gyan.dev",
      sources: Object.fromEntries(batch.sources.map((source) => [source.sourceId, {
        durationSeconds: 1,
        integratedLoudnessLufs: -20,
        truePeakDbtp: -3,
        sampleRateHz: 44100,
        channels: 1,
      }])),
    }
    const plan = owner.planSignatureSoundTreatmentAuditionBatch(batch, measurements)
    const manifest = {
      version: 1,
      batchId: plan.batchId,
      batchDeclarationSha256: plan.batchDeclarationSha256,
      algorithmVersion: plan.algorithmVersion,
      groupId: plan.groupId,
      processingIntentIds: plan.processingIntentIds,
      reviewKind: "treatment-audition",
      measurementToolVersion: plan.toolVersion,
      outputs: plan.outputs.map((output) => ({
        sourceId: output.sourceId,
        sourceSha256: output.sourceSha256,
        variantId: output.variantId,
        variantLabel: output.variantLabel,
        effect: output.effect,
        outputRelativePath: output.outputRelativePath,
        outputIdentity: output.outputIdentity,
        ffmpegArgv: owner.buildSignatureSoundTreatmentRenderArgv(output, {
          ffmpegCommand: "ffmpeg",
          sourceRoot: "<source-root>",
          outputRoot: "<output-root>",
        }),
        inputMeasurement: output.inputMeasurement,
        outputMeasurement: {
          outputSha256: "e".repeat(64),
          byteSize: 100,
          codecName: "pcm_s24le",
          sampleRateHz: 48000,
          channels: output.outputChannels,
          bitsPerSample: 24,
          durationSeconds: output.expectedDurationSeconds,
          integratedLoudnessLufs: -22,
          truePeakDbtp: -1,
        },
      })),
    }
    assert.equal(owner.validateSignatureSoundTreatmentAuditionManifest(manifest, batch).outputs.length, 72)
    const drifted = clone(manifest)
    drifted.outputs[0].outputIdentity = "f".repeat(64)
    assert.throws(
      () => owner.validateSignatureSoundTreatmentAuditionManifest(drifted, batch),
      /identity|drift|manifest/i,
    )
  })
})
