import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, it } from "node:test"
import { planSignatureSoundEditAuditionBatch } from "../lib/atmoshaper/signature-sound-edit-audition.js"

async function loadRunner() {
  try {
    return await import("../scripts/atmoshaper-signature-sound-edit-audition.mjs")
  } catch (error) {
    assert.fail(`Signature edit-audition runner must load: ${error?.message ?? error}`)
  }
}

function plannedBatch() {
  const sourceId = "b".repeat(64)
  const batch = {
    batchId: "batch-04-boiling-water-edit-audition",
    batchDeclarationSha256: "a".repeat(64),
    algorithmVersion: "signature-edit-audition-v2",
    groupId: "moodist:boiling-water",
    processingIntentIds: ["boiling-repair-loop", "boiling-trim-clicks"],
    outputVersion: 2,
    sources: [{
      sourceId,
      sha256: "c".repeat(64),
      relativePath: "sources/boiling-water.wav",
    }],
    variants: [
      ["short-seam", 2],
      ["medium-seam", 4],
      ["long-seam", 8],
    ].map(([variantId, cyclicCrossfadeSeconds]) => ({
      variantId,
      label: variantId,
      firstPassStartSeconds: 0,
      loopStartSeconds: 15,
      loopEndSeconds: 90,
      cyclicCrossfadeSeconds,
      crossfadeCurve: "qsin",
    })),
    outputFormat: {
      codec: "pcm_s24le",
      sampleRateHz: 48000,
      channels: "preserve",
      truePeakCeilingDbtp: -0.1,
    },
  }
  return planSignatureSoundEditAuditionBatch(batch, {
    version: 1,
    batchDeclarationSha256: "a".repeat(64),
    toolVersion: "ffmpeg version 9.0-full_build-www.gyan.dev",
    sources: {
      [sourceId]: {
        durationSeconds: 143.18356,
        integratedLoudnessLufs: -31.2,
        truePeakDbtp: -4.1,
        sampleRateHz: 44100,
        channels: 2,
      },
    },
  })
}

describe("AtmoShaper Signature edit-audition runner", () => {
  it("exposes only the closed measure and render CLI", async () => {
    const { main } = await loadRunner()
    assert.equal(typeof main, "function")
    await assert.rejects(() => main([]), /measure|render|mode/i)
    await assert.rejects(() => main(["preview"]), /measure|render|mode/i)
  })

  it("measures exact source bytes with the recorded FFmpeg build", async (t) => {
    const { measureSignatureSoundEditAuditionBatch } = await loadRunner()
    assert.equal(typeof measureSignatureSoundEditAuditionBatch, "function")
    const sourceRoot = await mkdtemp(join(tmpdir(), "ml-edit-source-"))
    t.after(() => rm(sourceRoot, { recursive: true, force: true }))
    await mkdir(join(sourceRoot, "pack"))
    const bytes = Buffer.from("exact-boiling-source")
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
    const measurements = await measureSignatureSoundEditAuditionBatch({
      batch,
      sourceRoot,
      ffmpegCommand: "ffmpeg",
      ffprobeCommand: "ffprobe",
      runCommand: async (command, argv) => {
        calls.push([command, argv])
        if (argv[0] === "-version") return { stdout: "ffmpeg version 9.0-full_build-www.gyan.dev\n", stderr: "" }
        if (command === "ffprobe") return {
          stdout: JSON.stringify({
            streams: [{ codec_type: "audio", codec_name: "pcm_s16le", sample_rate: "44100", channels: 2 }],
            format: { duration: "143.18356" },
          }),
          stderr: "",
        }
        return { stdout: "", stderr: "I: -31.2 LUFS\nPeak: -4.1 dBFS\n" }
      },
    })
    assert.deepEqual(measurements.sources[batch.sources[0].sourceId], {
      durationSeconds: 143.18356,
      integratedLoudnessLufs: -31.2,
      truePeakDbtp: -4.1,
      sampleRateHz: 44100,
      channels: 2,
    })
    assert.equal(calls.length, 3)
  })

  it("publishes all seam variants and the manifest only after every artifact verifies", async (t) => {
    const { publishSignatureSoundEditAuditionOutputs } = await loadRunner()
    const outputRoot = await mkdtemp(join(tmpdir(), "ml-edit-output-"))
    t.after(() => rm(outputRoot, { recursive: true, force: true }))
    const batchPlan = plannedBatch()
    const manifest = await publishSignatureSoundEditAuditionOutputs({
      plan: batchPlan,
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
        channels: 2,
        bitsPerSample: 24,
        durationSeconds: planOutput.expectedDurationSeconds,
        integratedLoudnessLufs: -31,
        truePeakDbtp: -1,
      }),
    })

    assert.equal(manifest.reviewKind, "edit-audition")
    assert.deepEqual(manifest.outputs.map(({ variantId }) => variantId), ["short-seam", "medium-seam", "long-seam"])
    assert.ok(manifest.outputs.every(({ reviewMode }) => reviewMode === "intro-then-cyclic-loop"))
    assert.deepEqual(manifest.outputs.map(({ edit }) => edit.loopStartSeconds), [15, 15, 15])
    await access(join(outputRoot, "batch-manifest.json"))
    for (const output of batchPlan.outputs) await access(join(outputRoot, ...output.outputRelativePath.split("/")))
    assert.deepEqual(JSON.parse(await readFile(join(outputRoot, "batch-manifest.json"), "utf8")), manifest)
  })

  it("rejects duplicate identities before rendering and rolls back failed verification", async (t) => {
    const { publishSignatureSoundEditAuditionOutputs } = await loadRunner()
    const duplicateRoot = await mkdtemp(join(tmpdir(), "ml-edit-duplicate-"))
    const rollbackRoot = await mkdtemp(join(tmpdir(), "ml-edit-rollback-"))
    t.after(() => Promise.all([
      rm(duplicateRoot, { recursive: true, force: true }),
      rm(rollbackRoot, { recursive: true, force: true }),
    ]))
    const basePlan = plannedBatch()
    const first = structuredClone(basePlan.outputs[0])
    const duplicate = structuredClone(basePlan.outputs[1])
    duplicate.outputIdentity = first.outputIdentity
    let renders = 0
    await assert.rejects(() => publishSignatureSoundEditAuditionOutputs({
      plan: { ...basePlan, outputs: [first, duplicate] },
      sourceRoot: "C:\\source",
      outputRoot: duplicateRoot,
      ffmpegCommand: "ffmpeg",
      ffprobeCommand: "ffprobe",
      renderOutput: async () => { renders += 1 },
      inspectOutput: async () => assert.fail("duplicates must fail before inspection"),
    }), /duplicate.*identit/i)
    assert.equal(renders, 0)

    const rollbackPlan = plannedBatch()
    rollbackPlan.outputs = rollbackPlan.outputs.slice(0, 2)
    await assert.rejects(() => publishSignatureSoundEditAuditionOutputs({
      plan: rollbackPlan,
      sourceRoot: "C:\\source",
      outputRoot: rollbackRoot,
      ffmpegCommand: "ffmpeg",
      ffprobeCommand: "ffprobe",
      renderOutput: async ({ temporaryPath }) => writeFile(temporaryPath, "rendered"),
      inspectOutput: async ({ planOutput }) => ({
        outputSha256: "d".repeat(64),
        byteSize: 8,
        codecName: "pcm_s24le",
        sampleRateHz: 48000,
        channels: 2,
        bitsPerSample: 24,
        durationSeconds: planOutput.expectedDurationSeconds,
        integratedLoudnessLufs: -31,
        truePeakDbtp: planOutput.variantId === "medium-seam" ? 0 : -1,
      }),
    }), /true peak/i)
    await assert.rejects(() => access(join(rollbackRoot, "batch-manifest.json")), /ENOENT/)
    for (const output of rollbackPlan.outputs) {
      await assert.rejects(() => access(join(rollbackRoot, ...output.outputRelativePath.split("/"))), /ENOENT/)
    }
  })
})
