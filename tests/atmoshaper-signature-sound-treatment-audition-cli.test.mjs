import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, it } from "node:test"

async function loadRunner() {
  try {
    return await import("../scripts/atmoshaper-signature-sound-treatment-audition.mjs")
  } catch (error) {
    assert.fail(`Signature treatment-audition runner must load: ${error?.message ?? error}`)
  }
}

function outputPlan(sourceId, variantId, index) {
  return {
    sourceId,
    sourceSha256: String(index + 1).repeat(64).slice(0, 64),
    sourceRelativePath: `sources/${sourceId}.wav`,
    variantId,
    variantLabel: variantId,
    effect: {
      variantId,
      label: variantId,
      delaysMs: [120],
      decays: [0.3],
      inputGain: 0.92,
      outputGain: 0.82,
      safetyAttenuationDb: -1.5,
      tailSeconds: 0.12,
    },
    inputMeasurement: {
      durationSeconds: 1,
      integratedLoudnessLufs: -20,
      truePeakDbtp: -3,
      sampleRateHz: 44100,
      channels: 1,
    },
    expectedDurationSeconds: 1.12,
    outputCodec: "pcm_s24le",
    outputSampleRateHz: 48000,
    outputChannels: 1,
    truePeakCeilingDbtp: -0.1,
    outputRelativePath: `sci-fi-whistles/${sourceId}-${variantId}-v1.wav`,
    outputIdentity: String(index + 5).repeat(64).slice(0, 64),
  }
}

describe("AtmoShaper Signature treatment-audition runner", () => {
  it("exposes only the closed measure and render CLI", async () => {
    const { main } = await loadRunner()
    assert.equal(typeof main, "function")
    await assert.rejects(() => main([]), /measure|render|mode/i)
    await assert.rejects(() => main(["preview"]), /measure|render|mode/i)
  })

  it("measures exact source bytes with the recorded FFmpeg build", async (t) => {
    const { measureSignatureSoundTreatmentAuditionBatch } = await loadRunner()
    assert.equal(typeof measureSignatureSoundTreatmentAuditionBatch, "function")
    const sourceRoot = await mkdtemp(join(tmpdir(), "ml-treatment-source-"))
    t.after(() => rm(sourceRoot, { recursive: true, force: true }))
    await mkdir(join(sourceRoot, "pack"))
    const bytes = Buffer.from("exact-source")
    await writeFile(join(sourceRoot, "pack", "source.wav"), bytes)
    const batch = {
      batchDeclarationSha256: "a".repeat(64),
      sources: [{
        sourceId: "b".repeat(64),
        sha256: createHash("sha256").update(bytes).digest("hex"),
        byteSize: bytes.length,
        relativePath: "pack/source.wav",
      }],
    }
    const calls = []
    const measurements = await measureSignatureSoundTreatmentAuditionBatch({
      batch,
      sourceRoot,
      ffmpegCommand: "ffmpeg",
      ffprobeCommand: "ffprobe",
      runCommand: async (command, argv) => {
        calls.push([command, argv])
        if (argv[0] === "-version") return { stdout: "ffmpeg version 9.0-full_build-www.gyan.dev\n", stderr: "" }
        if (command === "ffprobe") return {
          stdout: JSON.stringify({
            streams: [{ codec_type: "audio", codec_name: "pcm_s16le", sample_rate: "44100", channels: 1 }],
            format: { duration: "1.25" },
          }),
          stderr: "",
        }
        return { stdout: "", stderr: "I: -21.5 LUFS\nPeak: -2.0 dBFS\n" }
      },
    })
    assert.equal(measurements.sources[batch.sources[0].sourceId].durationSeconds, 1.25)
    assert.equal(measurements.sources[batch.sources[0].sourceId].channels, 1)
    assert.equal(measurements.sources[batch.sources[0].sourceId].integratedLoudnessLufs, -21.5)
    assert.equal(calls.length, 3)
  })

  it("defaults measurement to the real process adapter", async () => {
    const { measureSignatureSoundTreatmentAuditionBatch } = await loadRunner()
    let failure
    try {
      await measureSignatureSoundTreatmentAuditionBatch({
        batch: { batchDeclarationSha256: "a".repeat(64), sources: [] },
        sourceRoot: "C:\\source",
        ffmpegCommand: process.execPath,
        ffprobeCommand: process.execPath,
      })
    } catch (error) {
      failure = error
    }
    assert.ok(failure instanceof Error)
    assert.doesNotMatch(failure.message, /runCommand is not a function/)
  })

  it("publishes variant outputs and their manifest only after every artifact verifies", async (t) => {
    const { publishSignatureSoundTreatmentAuditionOutputs } = await loadRunner()
    const outputRoot = await mkdtemp(join(tmpdir(), "ml-treatment-output-"))
    t.after(() => rm(outputRoot, { recursive: true, force: true }))
    const plan = {
      version: 1,
      batchId: "batch-03-sci-fi-whistles-treatment-audition",
      batchDeclarationSha256: "a".repeat(64),
      algorithmVersion: "signature-treatment-audition-v1",
      groupId: "signature-extra:sci-fi-whistles",
      processingIntentIds: ["whistles-time-effect"],
      outputVersion: 1,
      toolVersion: "ffmpeg version 9.0-full_build-www.gyan.dev",
      outputs: [
        outputPlan("b".repeat(64), "short-delay", 0),
        outputPlan("c".repeat(64), "short-delay", 1),
      ],
    }

    const manifest = await publishSignatureSoundTreatmentAuditionOutputs({
      plan,
      sourceRoot: "C:\\source",
      outputRoot,
      ffmpegCommand: "ffmpeg",
      ffprobeCommand: "ffprobe",
      renderOutput: async ({ temporaryPath }) => writeFile(temporaryPath, "rendered"),
      inspectOutput: async ({ planOutput }) => ({
        outputSha256: "d".repeat(64),
        byteSize: 8,
        codecName: "pcm_s24le",
        sampleRateHz: 48000,
        channels: planOutput.outputChannels,
        bitsPerSample: 24,
        durationSeconds: planOutput.expectedDurationSeconds,
        integratedLoudnessLufs: -22,
        truePeakDbtp: -1,
      }),
    })

    assert.equal(manifest.outputs.length, 2)
    assert.ok(manifest.outputs.every(({ variantId }) => variantId === "short-delay"))
    assert.ok(manifest.outputs.every(({ outputMeasurement }) => outputMeasurement.truePeakDbtp === -1))
    await access(join(outputRoot, "batch-manifest.json"))
    for (const output of plan.outputs) await access(join(outputRoot, ...output.outputRelativePath.split("/")))
    assert.deepEqual(JSON.parse(await readFile(join(outputRoot, "batch-manifest.json"), "utf8")), manifest)
  })

  it("rejects duplicate identities before rendering and rolls back failed verification", async (t) => {
    const { publishSignatureSoundTreatmentAuditionOutputs } = await loadRunner()
    const outputRoot = await mkdtemp(join(tmpdir(), "ml-treatment-rollback-"))
    t.after(() => rm(outputRoot, { recursive: true, force: true }))
    const first = outputPlan("b".repeat(64), "short-delay", 0)
    const second = outputPlan("c".repeat(64), "medium-echo", 1)
    second.outputIdentity = first.outputIdentity
    const plan = {
      version: 1,
      batchId: "batch-03-sci-fi-whistles-treatment-audition",
      batchDeclarationSha256: "a".repeat(64),
      algorithmVersion: "signature-treatment-audition-v1",
      groupId: "signature-extra:sci-fi-whistles",
      processingIntentIds: ["whistles-time-effect"],
      outputVersion: 1,
      toolVersion: "ffmpeg version 9.0-full_build-www.gyan.dev",
      outputs: [first, second],
    }
    let renders = 0
    await assert.rejects(() => publishSignatureSoundTreatmentAuditionOutputs({
      plan,
      sourceRoot: "C:\\source",
      outputRoot,
      ffmpegCommand: "ffmpeg",
      ffprobeCommand: "ffprobe",
      renderOutput: async () => { renders += 1 },
      inspectOutput: async () => assert.fail("duplicate identities must fail before inspection"),
    }), /duplicate.*identit/i)
    assert.equal(renders, 0)
  })
})
