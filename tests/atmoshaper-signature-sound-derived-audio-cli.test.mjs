import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { describe, it } from "node:test"
import { fileURLToPath } from "node:url"

import {
  parseSignatureSoundEbur128,
  prepareSignatureSoundDerivedRoots,
  publishSignatureSoundDerivedOutputs,
  requireRecordedSignatureSoundFfmpegVersion,
  verifySignatureSoundDerivedSourceFile,
} from "../scripts/atmoshaper-signature-sound-derived-audio.mjs"

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")

function outputPlan(sourceId, identity, relativePath = `campfire/${sourceId}-campfire-normalize-v1.wav`) {
  return {
    sourceId,
    sourceSha256: "a".repeat(64),
    inputRelativePath: `source/${sourceId}.wav`,
    inputMeasurement: {
      durationSeconds: 2,
      integratedLoudnessLufs: -30,
      truePeakDbtp: -5,
    },
    gainDb: 0,
    outputRelativePath: relativePath,
    outputIdentity: identity,
    identityInputs: { identity },
    outputCodec: "pcm_s24le",
    outputSampleRateHz: 48000,
    outputChannels: 2,
  }
}

function renderPlan(outputs) {
  return {
    version: 1,
    batchId: "batch-01-campfire-boiling-water",
    batchDeclarationSha256: "b".repeat(64),
    algorithmVersion: "signature-derived-audio-v1",
    groupId: "moodist:campfire",
    processingIntentIds: ["campfire-normalize"],
    state: "ready-to-render",
    targetIntegratedLoudnessLufs: -30,
    measurementMethod: "ffmpeg-ebur128-v1",
    measurementToolVersion: "ffmpeg version 9.0-full_build-www.gyan.dev",
    outputs,
  }
}

describe("AtmoShaper Signature derived-audio process adapter", () => {
  it("selects an exact closed batch declaration from CLI input", async () => {
    const {
      parseSignatureSoundDerivedAudioCliArguments,
      selectSignatureSoundDerivedAudioBatchEntry,
      validateSignatureSoundDerivedAudioBatchRegistry,
    } = await import("../lib/atmoshaper/signature-sound-derived-audio-batch-registry.js")
    const registry = validateSignatureSoundDerivedAudioBatchRegistry(JSON.parse(await readFile(
      join(repoRoot, "data/atmoshaper/signature-sound-derived-audio-batch-registry.json"),
      "utf8",
    )))
    const options = parseSignatureSoundDerivedAudioCliArguments([
      "measure",
      "--batch-id", "batch-02-air-traffic-control",
      "--source-root", "C:\\audio\\sources",
      "--output-root", "C:\\audio\\derived\\batch-02",
      "--ffmpeg", "ffmpeg",
      "--ffprobe", "ffprobe",
    ])

    assert.equal(options.batchId, "batch-02-air-traffic-control")
    assert.deepEqual(selectSignatureSoundDerivedAudioBatchEntry(registry, options.batchId), {
      batchId: "batch-02-air-traffic-control",
      declarationRelativePath: "data/atmoshaper/signature-sound-derived-audio-batch-02-air-traffic-control.json",
    })
    assert.deepEqual(selectSignatureSoundDerivedAudioBatchEntry(registry, "batch-04-boiling-water-edit-audition"), {
      batchId: "batch-04-boiling-water-edit-audition",
      declarationRelativePath: "data/atmoshaper/signature-sound-derived-audio-batch-04-boiling-water-edit-audition.json",
    })
    assert.deepEqual(selectSignatureSoundDerivedAudioBatchEntry(registry, "batch-05-dryer-trim-audition"), {
      batchId: "batch-05-dryer-trim-audition",
      declarationRelativePath: "data/atmoshaper/signature-sound-derived-audio-batch-05-dryer-trim-audition.json",
    })
    assert.throws(
      () => selectSignatureSoundDerivedAudioBatchEntry(registry, "batch-03-unknown"),
      /unknown|batch/i,
    )
    assert.throws(
      () => parseSignatureSoundDerivedAudioCliArguments(["measure", "--unexpected", "value"]),
      /unknown|option|requires/i,
    )
  })

  it("accepts the recorded build's real copyright banner but rejects another FFmpeg build", () => {
    assert.equal(
      requireRecordedSignatureSoundFfmpegVersion("ffmpeg version 9.0-full_build-www.gyan.dev Copyright (c) 2000-2026 the FFmpeg developers\nconfiguration: ..."),
      "ffmpeg version 9.0-full_build-www.gyan.dev",
    )
    assert.throws(() => requireRecordedSignatureSoundFfmpegVersion("ffmpeg version 8.1"), /recorded FFmpeg 9\.0/i)
  })

  it("parses the final EBU R128 summary and rejects incomplete output", () => {
    const stderr = `
[Parsed_ebur128_0] Summary:
  Integrated loudness:
    I:         -27.4 LUFS
  True peak:
    Peak:       -3.2 dBFS
`
    assert.deepEqual(parseSignatureSoundEbur128(stderr), {
      integratedLoudnessLufs: -27.4,
      truePeakDbtp: -3.2,
    })
    assert.throws(() => parseSignatureSoundEbur128("I: -27.4 LUFS"), /true peak|EBU/i)
  })

  it("checks exact source bytes before any FFmpeg operation", async (context) => {
    const root = await mkdtemp(join(tmpdir(), "atmoshaper-derived-source-"))
    context.after(() => rm(root, { recursive: true, force: true }))
    const bytes = Buffer.from("exact source bytes")
    await writeFile(join(root, "source.wav"), bytes)
    const source = {
      sourceId: "1".repeat(64),
      sha256: createHash("sha256").update(bytes).digest("hex"),
      byteSize: bytes.length,
      relativePath: "source.wav",
    }
    await assert.doesNotReject(verifySignatureSoundDerivedSourceFile(source, root))
    await writeFile(join(root, "source.wav"), Buffer.from("same byte length???"))
    await assert.rejects(verifySignatureSoundDerivedSourceFile(source, root), /byte|checksum|sha/i)
  })

  it("rejects a canonical output under the repository before creating it", async () => {
    await assert.rejects(prepareSignatureSoundDerivedRoots({
      repoRoot,
      sourceRoot: tmpdir(),
      outputRoot: join(repoRoot, "forbidden-derived-output"),
    }), /repository|worktree|outside/i)
  })

  it("publishes verified outputs and a portable manifest only after every render succeeds", async (context) => {
    const outputRoot = await mkdtemp(join(tmpdir(), "atmoshaper-derived-publish-"))
    context.after(() => rm(outputRoot, { recursive: true, force: true }))
    const plan = renderPlan([
      outputPlan("1".repeat(64), "c".repeat(64)),
      outputPlan("2".repeat(64), "d".repeat(64)),
    ])
    const manifest = await publishSignatureSoundDerivedOutputs({
      plan,
      sourceRoot: join(tmpdir(), "portable-source"),
      outputRoot,
      ffmpegCommand: "ffmpeg",
      renderOutput: async ({ temporaryPath }) => writeFile(temporaryPath, Buffer.from("rendered wav")),
      inspectOutput: async ({ planOutput, temporaryPath }) => ({
        outputSha256: createHash("sha256").update(await readFile(temporaryPath)).digest("hex"),
        byteSize: (await readFile(temporaryPath)).length,
        durationSeconds: planOutput.inputMeasurement.durationSeconds,
        sampleRateHz: 48000,
        channels: 2,
        bitsPerSample: 24,
        codecName: "pcm_s24le",
        integratedLoudnessLufs: -30.08,
        truePeakDbtp: -5,
      }),
    })

    assert.equal(manifest.outputs.length, 2)
    assert.ok(manifest.outputs.every(({ ffmpegArgv }) => ffmpegArgv.join(" ").includes("<source-root>")))
    assert.ok(manifest.outputs.every(({ ffmpegArgv }) => !ffmpegArgv.join(" ").includes(tmpdir())))
    assert.deepEqual((await readdir(join(outputRoot, "campfire"))).sort(), [
      `${"1".repeat(64)}-campfire-normalize-v1.wav`,
      `${"2".repeat(64)}-campfire-normalize-v1.wav`,
    ])
    assert.deepEqual(JSON.parse(await readFile(join(outputRoot, "batch-manifest.json"), "utf8")), manifest)
  })

  it("verifies a Dryer trim by its exact duration and peak without imposing normalization", async (context) => {
    const outputRoot = await mkdtemp(join(tmpdir(), "atmoshaper-dryer-publish-"))
    context.after(() => rm(outputRoot, { recursive: true, force: true }))
    const sourceId = "5".repeat(64)
    const output = {
      ...outputPlan(sourceId, "e".repeat(64), `dryer/${sourceId}-dryer-trim-boundaries-v1.wav`),
      recipeKind: "trim-boundary-fades",
      trimStartSeconds: 1.8,
      trimEndSeconds: 17.7,
      fadeInSeconds: 0.15,
      fadeOutSeconds: 0.15,
      truePeakCeilingDbtp: -0.1,
      expectedDurationSeconds: 15.9,
      inputMeasurement: {
        durationSeconds: 20.04,
        integratedLoudnessLufs: -20.4,
        truePeakDbtp: -1.2,
      },
    }
    const plan = {
      ...renderPlan([output]),
      batchId: "batch-05-dryer-trim-audition",
      groupId: "moodist:dryer",
      processingIntentIds: ["dryer-trim-boundaries"],
      targetIntegratedLoudnessLufs: null,
    }
    const manifest = await publishSignatureSoundDerivedOutputs({
      plan,
      sourceRoot: join(tmpdir(), "portable-source"),
      outputRoot,
      ffmpegCommand: "ffmpeg",
      renderOutput: async ({ temporaryPath }) => writeFile(temporaryPath, Buffer.from("dryer wav")),
      inspectOutput: async ({ temporaryPath }) => ({
        outputSha256: createHash("sha256").update(await readFile(temporaryPath)).digest("hex"),
        byteSize: (await readFile(temporaryPath)).length,
        durationSeconds: 15.9,
        sampleRateHz: 48000,
        channels: 2,
        bitsPerSample: 24,
        codecName: "pcm_s24le",
        integratedLoudnessLufs: -19.7,
        truePeakDbtp: -1.1,
      }),
    })

    assert.equal(manifest.targetIntegratedLoudnessLufs, null)
    assert.equal(manifest.outputs[0].outputMeasurement.durationSeconds, 15.9)
    assert.equal(manifest.outputs[0].outputMeasurement.integratedLoudnessLufs, -19.7)
  })

  it("preflights existing destinations and rolls back every task-owned file after a later failure", async (context) => {
    const outputRoot = await mkdtemp(join(tmpdir(), "atmoshaper-derived-rollback-"))
    context.after(() => rm(outputRoot, { recursive: true, force: true }))
    const first = outputPlan("1".repeat(64), "c".repeat(64))
    const second = outputPlan("2".repeat(64), "d".repeat(64))
    const plan = renderPlan([first, second])
    let calls = 0
    await assert.rejects(publishSignatureSoundDerivedOutputs({
      plan,
      sourceRoot: join(tmpdir(), "portable-source"),
      outputRoot,
      ffmpegCommand: "ffmpeg",
      renderOutput: async ({ temporaryPath }) => {
        calls += 1
        if (calls === 2) throw new Error("injected FFmpeg failure")
        await writeFile(temporaryPath, Buffer.from("partial wav"))
      },
      inspectOutput: async () => { throw new Error("inspection should not run") },
    }), /injected FFmpeg failure/)
    await assert.rejects(readdir(outputRoot), /ENOENT|no such file/i)

    const existingDirectory = join(outputRoot, "campfire")
    const { mkdir } = await import("node:fs/promises")
    await mkdir(existingDirectory, { recursive: true })
    await writeFile(join(outputRoot, first.outputRelativePath), Buffer.from("existing"))
    calls = 0
    await assert.rejects(publishSignatureSoundDerivedOutputs({
      plan,
      sourceRoot: join(tmpdir(), "portable-source"),
      outputRoot,
      ffmpegCommand: "ffmpeg",
      renderOutput: async () => { calls += 1 },
      inspectOutput: async () => ({}),
    }), /exists|overwrite/i)
    assert.equal(calls, 0)
  })
})
