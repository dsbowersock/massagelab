import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { describe, it } from "node:test"
import { fileURLToPath } from "node:url"

import {
  assertSignatureSoundDerivedOutputRoot,
  buildSignatureSoundDerivedRenderArgv,
  planSignatureSoundDerivedAudioBatch,
  validateSignatureSoundDerivedAudioBatch,
  validateSignatureSoundDerivedManifest,
  validateSignatureSoundDerivedMeasurements,
} from "../lib/atmoshaper/signature-sound-derived-audio.js"

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")

async function readJson(relativePath) {
  return JSON.parse(await readFile(join(repoRoot, relativePath), "utf8"))
}

async function loadContext() {
  const [batch, constructionReview, discoveryReview] = await Promise.all([
    readJson("data/atmoshaper/signature-sound-derived-audio-batches.json"),
    readJson("data/atmoshaper/signature-sound-construction-review.json"),
    readJson("data/atmoshaper/signature-sound-review.json"),
  ])
  return { batch, constructionReview, discoveryReview }
}

function campfireMeasurements(batch) {
  const loudness = new Map([
    ["1b729e655032b74bbb2abe98314dedbad38f581e9f8affc3bc4d586efad179b4", -22.5],
    ["76c84c498de97afbcd9c16c3e6a1a98ea45be3e1f4bfe6c941f6b8e63abfc62b", -30.25],
    ["a491785403c37b68d4843a959a86063dd1e09cf602604c76870d7aa2f532bbec", -25],
    ["dc203f5a87481e5e24a616181b86c905b3c2d6ce81300065576d450e0798f1b9", -28],
  ])
  const campfire = batch.concepts.find(({ groupId }) => groupId === "moodist:campfire")
  return {
    version: 1,
    measurementMethod: "ffmpeg-ebur128-v1",
    toolVersion: "ffmpeg version 9.0-full_build-www.gyan.dev",
    sources: Object.fromEntries(campfire.sources.map((source, index) => [source.sourceId, {
      sourceSha256: source.sha256,
      durationSeconds: [24.96, 369.5, 8.67799, 47.554467][index],
      sampleRateHz: [48000, 44100, 96000, 44100][index],
      channels: 2,
      bitsPerSample: [16, 16, 24, 16][index],
      integratedLoudnessLufs: loudness.get(source.sourceId),
      truePeakDbtp: -3.25,
    }])),
  }
}

function manifestFromPlan(plan) {
  return {
    version: 1,
    batchId: plan.batchId,
    batchDeclarationSha256: plan.batchDeclarationSha256,
    algorithmVersion: plan.algorithmVersion,
    groupId: plan.groupId,
    processingIntentIds: [...plan.processingIntentIds],
    targetIntegratedLoudnessLufs: plan.targetIntegratedLoudnessLufs,
    measurementMethod: plan.measurementMethod,
    measurementToolVersion: plan.measurementToolVersion,
    outputs: plan.outputs.map((output, index) => ({
      sourceId: output.sourceId,
      sourceSha256: output.sourceSha256,
      outputRelativePath: output.outputRelativePath,
      outputIdentity: output.outputIdentity,
      gainDb: output.gainDb,
      ffmpegArgv: buildSignatureSoundDerivedRenderArgv(output, {
        ffmpegCommand: "ffmpeg",
        sourceRoot: "<source-root>",
        outputRoot: "<output-root>",
      }),
      inputMeasurement: output.inputMeasurement,
      outputMeasurement: {
        outputSha256: String(index + 1).repeat(64),
        byteSize: 1000 + index,
        durationSeconds: output.expectedDurationSeconds ?? output.inputMeasurement.durationSeconds,
        sampleRateHz: 48000,
        channels: 2,
        bitsPerSample: 24,
        codecName: "pcm_s24le",
        integratedLoudnessLufs: plan.targetIntegratedLoudnessLufs ?? output.inputMeasurement.integratedLoudnessLufs,
        truePeakDbtp: -5,
      },
    })),
  }
}

describe("AtmoShaper Signature derived-audio planning", () => {
  it("validates the exact portable Batch 01 declaration against construction intent and source bytes", async () => {
    const { batch, constructionReview, discoveryReview } = await loadContext()
    const normalized = validateSignatureSoundDerivedAudioBatch(batch, { constructionReview, discoveryReview })

    assert.equal(normalized.batchId, "batch-01-campfire-boiling-water")
    assert.match(normalized.batchDeclarationSha256, /^[a-f0-9]{64}$/)
    assert.deepEqual(normalized.concepts.map(({ groupId, state }) => [groupId, state]), [
      ["moodist:campfire", "ready"],
      ["moodist:boiling-water", "parameter-gated"],
    ])
    assert.equal(normalized.concepts[0].sources.length, 4)
    assert.equal(normalized.concepts[1].sources.length, 1)
    assert.equal(normalized.concepts[1].recipe.trimStartSeconds, null)
    assert.equal(normalized.concepts[1].recipe.trimEndSeconds, null)
  })

  it("validates Batch 02 and plans Air Traffic outputs beneath its own concept directory", async () => {
    const [{ constructionReview, discoveryReview }, batch] = await Promise.all([
      loadContext(),
      readJson("data/atmoshaper/signature-sound-derived-audio-batch-02-air-traffic-control.json"),
    ])
    const normalized = validateSignatureSoundDerivedAudioBatch(batch, { constructionReview, discoveryReview })
    const concept = normalized.concepts[0]
    const measurements = {
      version: 1,
      measurementMethod: "ffmpeg-ebur128-v1",
      toolVersion: "ffmpeg version 9.0-full_build-www.gyan.dev",
      sources: Object.fromEntries(concept.sources.map((source, index) => [source.sourceId, {
        sourceSha256: source.sha256,
        durationSeconds: 1 + index / 10,
        sampleRateHz: 44100,
        channels: 2,
        bitsPerSample: 16,
        integratedLoudnessLufs: -29 - index,
        truePeakDbtp: -1,
      }])),
    }
    const plan = planSignatureSoundDerivedAudioBatch(normalized, measurements, {
      groupId: "signature-extra:air-traffic-control",
    })

    assert.equal(normalized.batchId, "batch-02-air-traffic-control")
    assert.equal(concept.sources.length, 12)
    assert.equal(concept.recipe.outputChannels, 1, "Air Traffic must preserve its exact mono channel semantics")
    assert.equal(plan.targetIntegratedLoudnessLufs, -40)
    assert.equal(plan.outputs.filter(({ gainDb }) => gainDb === 0).length, 1)
    assert.ok(plan.outputs.every(({ outputRelativePath }) => (
      /^air-traffic-control\/[a-f0-9]{64}-air-traffic-normalize-v1\.wav$/.test(outputRelativePath)
    )))
    const argv = buildSignatureSoundDerivedRenderArgv(plan.outputs[0], {
      ffmpegCommand: "ffmpeg",
      sourceRoot: "C:\\audio\\Signature Samples",
      outputRoot: "C:\\audio\\AtmoShaper Derived\\batch-02",
    })
    assert.ok(argv.some((argument) => argument.includes("channel_layouts=mono")))
    assert.deepEqual(argv.slice(argv.indexOf("-ac"), argv.indexOf("-ac") + 2), ["-ac", "1"])
  })

  it("plans the exact Dryer boundary trim and fades without normalizing or guessing", async () => {
    const [{ constructionReview, discoveryReview }, batch] = await Promise.all([
      loadContext(),
      readJson("data/atmoshaper/signature-sound-derived-audio-batch-05-dryer-trim-audition.json"),
    ])
    const normalized = validateSignatureSoundDerivedAudioBatch(batch, { constructionReview, discoveryReview })
    const source = normalized.concepts[0].sources[0]
    const measurements = {
      version: 1,
      measurementMethod: "ffmpeg-ebur128-v1",
      toolVersion: "ffmpeg version 9.0-full_build-www.gyan.dev",
      sources: {
        [source.sourceId]: {
          sourceSha256: source.sha256,
          durationSeconds: 20.04,
          sampleRateHz: 44100,
          channels: 2,
          bitsPerSample: 0,
          integratedLoudnessLufs: -20.4,
          truePeakDbtp: -1.2,
        },
      },
    }
    const plan = planSignatureSoundDerivedAudioBatch(normalized, measurements, {
      groupId: "moodist:dryer",
    })
    const output = plan.outputs[0]

    assert.equal(normalized.batchId, "batch-05-dryer-trim-audition")
    assert.deepEqual(normalized.concepts[0].recipe, {
      kind: "trim-boundary-fades",
      trimStartSeconds: 1.8,
      trimEndSeconds: 17.7,
      fadeInSeconds: 0.15,
      fadeOutSeconds: 0.15,
      truePeakCeilingDbtp: -0.1,
      outputCodec: "pcm_s24le",
      outputSampleRateHz: 48000,
      outputChannels: 2,
    })
    assert.equal(plan.targetIntegratedLoudnessLufs, null)
    assert.equal(output.gainDb, 0)
    assert.equal(output.expectedDurationSeconds, 15.9)
    assert.equal(output.outputRelativePath, `dryer/${source.sourceId}-dryer-trim-boundaries-v1.wav`)
    const argv = buildSignatureSoundDerivedRenderArgv(output, {
      ffmpegCommand: "ffmpeg",
      sourceRoot: "C:\\audio\\Signature Samples",
      outputRoot: "C:\\audio\\AtmoShaper Derived\\batch-05",
    })
    assert.ok(argv.includes("-n"))
    assert.ok(argv.some((argument) => argument.includes("atrim=start=1.8:end=17.7")))
    assert.ok(argv.some((argument) => argument.includes("afade=t=in:st=0:d=0.15")))
    assert.ok(argv.some((argument) => argument.includes("afade=t=out:st=15.75:d=0.15")))
    assert.deepEqual(validateSignatureSoundDerivedManifest(manifestFromPlan(plan), normalized), manifestFromPlan(plan))
  })

  it("fails closed on schema, intent, source, and immutable output identity drift", async () => {
    const { batch, constructionReview, discoveryReview } = await loadContext()
    const mutations = [
      (draft) => { draft.fabricated = true },
      (draft) => { draft.algorithmVersion = "signature-derived-audio-v0" },
      (draft) => { draft.outputVersion = 0 },
      (draft) => { draft.concepts[0].processingIntentIds = ["boiling-trim-clicks"] },
      (draft) => { draft.concepts[0].sources[0].sha256 = "0".repeat(64) },
      (draft) => { draft.concepts[0].sources[0].byteSize += 1 },
      (draft) => { draft.concepts[0].sources[0].relativePath = "../escape.wav" },
      (draft) => { draft.concepts[0].sources.push(structuredClone(draft.concepts[0].sources[0])) },
      (draft) => { draft.concepts[1].state = "ready" },
    ]
    for (const mutate of mutations) {
      const draft = structuredClone(batch)
      mutate(draft)
      assert.throws(
        () => validateSignatureSoundDerivedAudioBatch(draft, { constructionReview, discoveryReview }),
        /unknown|algorithm|version|intent|source|checksum|sha|byte|path|duplicate|parameter|state/i,
      )
    }
  })

  it("keeps output outside source, repository, worktree, and filesystem roots after canonicalization", () => {
    const common = {
      sourceRoot: "C:\\audio\\Signature Samples",
      repositoryRoots: ["C:\\repo", "C:\\repo\\.worktrees\\catalog"],
      filesystemRoots: ["C:\\"],
    }
    assert.equal(assertSignatureSoundDerivedOutputRoot({
      ...common,
      outputRoot: "C:\\audio\\AtmoShaper Derived\\batch-01",
    }), "C:\\audio\\AtmoShaper Derived\\batch-01")
    for (const outputRoot of [
      "C:\\",
      "C:\\repo\\outputs",
      "C:\\repo\\.worktrees\\catalog\\outputs",
      "C:\\audio\\Signature Samples\\outputs",
      "C:\\audio",
    ]) {
      assert.throws(() => assertSignatureSoundDerivedOutputRoot({ ...common, outputRoot }), /outside|root|source|repository|worktree/i)
    }
  })

  it("plans transparent attenuation to the quietest Campfire input with deterministic no-overwrite argv", async () => {
    const { batch, constructionReview, discoveryReview } = await loadContext()
    const normalized = validateSignatureSoundDerivedAudioBatch(batch, { constructionReview, discoveryReview })
    const measurements = validateSignatureSoundDerivedMeasurements(
      campfireMeasurements(normalized),
      normalized,
      "moodist:campfire",
    )
    const plan = planSignatureSoundDerivedAudioBatch(normalized, measurements, {
      groupId: "moodist:campfire",
    })

    assert.equal(plan.state, "ready-to-render")
    assert.equal(plan.targetIntegratedLoudnessLufs, -30.25)
    assert.deepEqual(plan.outputs.map(({ gainDb }) => gainDb), [-7.75, 0, -5.25, -2.25])
    assert.equal(new Set(plan.outputs.map(({ outputIdentity }) => outputIdentity)).size, 4)
    assert.ok(plan.outputs.every(({ outputRelativePath }) => /^campfire\/[a-f0-9]{64}-campfire-normalize-v1\.wav$/.test(outputRelativePath)))

    const argv = buildSignatureSoundDerivedRenderArgv(plan.outputs[0], {
      ffmpegCommand: "ffmpeg",
      sourceRoot: "C:\\audio\\Signature Samples",
      outputRoot: "C:\\audio\\AtmoShaper Derived\\batch-01",
    })
    assert.equal(argv[0], "ffmpeg")
    assert.ok(argv.includes("-n"))
    assert.ok(argv.some((argument) => argument.includes("volume=-7.75dB")))
    assert.ok(argv.includes("pcm_s24le"))
    assert.ok(argv.at(-1).endsWith(".wav"))
  })

  it("rejects missing/mismatched measurements and refuses to plan parameter-gated Boiling Water", async () => {
    const { batch, constructionReview, discoveryReview } = await loadContext()
    const normalized = validateSignatureSoundDerivedAudioBatch(batch, { constructionReview, discoveryReview })
    const measurements = campfireMeasurements(normalized)
    delete measurements.sources[Object.keys(measurements.sources)[0]]
    assert.throws(
      () => validateSignatureSoundDerivedMeasurements(measurements, normalized, "moodist:campfire"),
      /measurement|source/i,
    )

    assert.throws(
      () => planSignatureSoundDerivedAudioBatch(normalized, { sources: {} }, { groupId: "moodist:boiling-water" }),
      /parameter|trim|gated/i,
    )
  })

  it("validates a rendered manifest against a fresh plan and fails closed on artifact drift", async () => {
    const { batch, constructionReview, discoveryReview } = await loadContext()
    const normalized = validateSignatureSoundDerivedAudioBatch(batch, { constructionReview, discoveryReview })
    const measurements = validateSignatureSoundDerivedMeasurements(campfireMeasurements(normalized), normalized, "moodist:campfire")
    const plan = planSignatureSoundDerivedAudioBatch(normalized, measurements, { groupId: "moodist:campfire" })
    const manifest = manifestFromPlan(plan)
    assert.deepEqual(validateSignatureSoundDerivedManifest(manifest, normalized), manifest)

    for (const mutate of [
      (draft) => { draft.fabricated = true },
      (draft) => { draft.outputs[0].gainDb += 1 },
      (draft) => { draft.outputs[0].outputIdentity = "f".repeat(64) },
      (draft) => { draft.outputs[0].outputMeasurement.outputSha256 = "0" },
      (draft) => { draft.outputs[0].outputMeasurement.sampleRateHz = 44100 },
      (draft) => { draft.outputs[0].ffmpegArgv[0] = "other-tool" },
    ]) {
      const draft = structuredClone(manifest)
      mutate(draft)
      assert.throws(() => validateSignatureSoundDerivedManifest(draft, normalized), /unknown|gain|identity|checksum|sha|format|sample|argv|recipe|output/i)
    }
  })
})
