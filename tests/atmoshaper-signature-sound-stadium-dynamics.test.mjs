import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, it } from "node:test"

const stadiumDynamics = await import("../lib/atmoshaper/signature-sound-stadium-dynamics.js").catch(() => ({}))
const cli = await import("../scripts/atmoshaper-signature-sound-stadium-dynamics.mjs").catch(() => ({}))
const declaration = JSON.parse(await readFile(new URL(
  "../data/atmoshaper/signature-sound-stadium-dynamics-audition.json",
  import.meta.url,
), "utf8"))

describe("AtmoShaper Stadium Crowd dynamics and leveling", () => {
  it("closes the six exact accepted speech-stage inputs and plans deterministic outputs", () => {
    assert.equal(typeof stadiumDynamics.validateSignatureSoundStadiumDynamicsDeclaration, "function")
    assert.equal(typeof stadiumDynamics.planSignatureSoundStadiumDynamics, "function")
    const normalized = stadiumDynamics.validateSignatureSoundStadiumDynamicsDeclaration(declaration)
    const plan = stadiumDynamics.planSignatureSoundStadiumDynamics(normalized)
    assert.match(normalized.declarationSha256, /^[a-f0-9]{64}$/)
    assert.equal(plan.outputs.length, 6)
    assert.equal(new Set(plan.outputs.map(({ sourceId }) => sourceId)).size, 6)
    assert.ok(plan.outputs.every(({ outputIdentity }) => /^[a-f0-9]{64}$/.test(outputIdentity)))
    assert.ok(plan.outputs.every(({ outputRelativePath, sourceId }) => (
      outputRelativePath === `artifacts/stadium-crowd/${sourceId}/audio.wav`
    )))
  })

  it("uses one gentle compressor followed by one ceiling-safe static gain", () => {
    const normalized = stadiumDynamics.validateSignatureSoundStadiumDynamicsDeclaration(declaration)
    assert.equal(
      stadiumDynamics.createSignatureSoundStadiumCompressorFilter(normalized.recipe),
      "acompressor=threshold=0.1:ratio=3:attack=20:release=750:makeup=1:knee=4:link=average:detection=rms:mix=1",
    )
    assert.equal(stadiumDynamics.calculateSignatureSoundStadiumMatchingGain({
      compressedIntegratedLoudnessLufs: -19.5,
      compressedTruePeakDbtp: -5.2,
      targetIntegratedLoudnessLufs: -23,
      truePeakCeilingDbtp: -1,
    }), -3.5)
    assert.equal(stadiumDynamics.calculateSignatureSoundStadiumMatchingGain({
      compressedIntegratedLoudnessLufs: -26.9,
      compressedTruePeakDbtp: -4.7,
      targetIntegratedLoudnessLufs: -23,
      truePeakCeilingDbtp: -1,
    }), 3.7)
  })

  it("builds portable no-overwrite FFmpeg rendering arguments", () => {
    const normalized = stadiumDynamics.validateSignatureSoundStadiumDynamicsDeclaration(declaration)
    const output = stadiumDynamics.planSignatureSoundStadiumDynamics(normalized).outputs[0]
    const argv = stadiumDynamics.buildSignatureSoundStadiumRenderArgv(output, {
      ffmpegCommand: "ffmpeg",
      inputPath: "<input.wav>",
      outputPath: "<output.wav>",
      matchingGainDb: -3.5,
      declaration: normalized,
    })
    assert.deepEqual(argv.slice(0, 7), ["ffmpeg", "-n", "-nostdin", "-hide_banner", "-loglevel", "error", "-i"])
    assert.ok(argv.includes("acompressor=threshold=0.1:ratio=3:attack=20:release=750:makeup=1:knee=4:link=average:detection=rms:mix=1,volume=-3.5dB"))
    assert.deepEqual(argv.slice(-7), ["-ar", "48000", "-ac", "2", "-c:a", "pcm_s24le", "<output.wav>"])
  })

  it("accepts only a complete level-matched manifest for the exact plan", () => {
    const normalized = stadiumDynamics.validateSignatureSoundStadiumDynamicsDeclaration(declaration)
    const plan = stadiumDynamics.planSignatureSoundStadiumDynamics(normalized)
    const receipts = plan.outputs.map((output, index) => ({
      version: 1,
      algorithmVersion: normalized.algorithmVersion,
      declarationSha256: normalized.declarationSha256,
      outputIdentity: output.outputIdentity,
      batchId: normalized.batchId,
      groupId: normalized.groupId,
      sourceId: output.sourceId,
      upstreamOutputIdentity: output.upstreamOutputIdentity,
      upstreamSha256: output.upstreamSha256,
      upstreamByteSize: output.upstreamByteSize,
      upstreamRelativePath: output.upstreamRelativePath,
      compressorMeasurement: {
        integratedLoudnessLufs: -20 - index,
        loudnessRangeLu: 6,
        loudnessRangeLowLufs: -27,
        loudnessRangeHighLufs: -21,
        truePeakDbtp: -5,
      },
      matchingGainDb: -3 + index,
      outputRelativePath: output.outputRelativePath,
      outputMeasurement: {
        durationSeconds: output.durationSeconds,
        sampleRateHz: 48000,
        channels: 2,
        bitsPerSample: 24,
        codecName: "pcm_s24le",
        integratedLoudnessLufs: index === 5 ? -23.2 : -23,
        loudnessRangeLu: 6,
        loudnessRangeLowLufs: -27,
        loudnessRangeHighLufs: -21,
        truePeakDbtp: -1 - index,
        outputSha256: String(index + 1).repeat(64),
        byteSize: 1000 + index,
      },
    }))
    const manifest = stadiumDynamics.createSignatureSoundStadiumDynamicsManifest(receipts, normalized)
    assert.equal(stadiumDynamics.validateSignatureSoundStadiumDynamicsManifest(manifest, normalized).outputs.length, 6)
    const tooWide = structuredClone(manifest)
    tooWide.outputs[5].outputMeasurement.integratedLoudnessLufs = -23.4
    assert.throws(
      () => stadiumDynamics.validateSignatureSoundStadiumDynamicsManifest(tooWide, normalized),
      /spread|loudness/i,
    )
  })

  it("parses only the closed CLI and the complete EBU R128 summary", () => {
    assert.deepEqual(cli.parseSignatureSoundStadiumDynamicsCliArguments(["--mode", "plan"]), { mode: "plan" })
    assert.deepEqual(cli.parseSignatureSoundStadiumDynamicsCliArguments([
      "--mode", "render",
      "--input-root", "C:\\input",
      "--output-root", "C:\\output",
      "--ffmpeg", "C:\\tools\\ffmpeg.exe",
      "--ffprobe", "C:\\tools\\ffprobe.exe",
    ]), {
      mode: "render",
      inputRoot: "C:\\input",
      outputRoot: "C:\\output",
      ffmpeg: "C:\\tools\\ffmpeg.exe",
      ffprobe: "C:\\tools\\ffprobe.exe",
    })
    assert.throws(
      () => cli.parseSignatureSoundStadiumDynamicsCliArguments(["--mode", "render", "--output-root", "C:\\output"]),
      /input root|required/i,
    )
    assert.deepEqual(cli.parseSignatureSoundStadiumEbur128(`
      Integrated loudness: I: -23.0 LUFS
      Loudness range: LRA: 6.5 LU
      LRA low: -27.4 LUFS
      LRA high: -20.9 LUFS
      True peak: Peak: -3.2 dBFS
    `), {
      integratedLoudnessLufs: -23,
      loudnessRangeLu: 6.5,
      loudnessRangeLowLufs: -27.4,
      loudnessRangeHighLufs: -20.9,
      truePeakDbtp: -3.2,
    })
  })

  it("publishes one exact bundle atomically and resumes only from matching bytes", async (context) => {
    const root = await mkdtemp(join(tmpdir(), "atmoshaper-stadium-render-"))
    context.after(() => rm(root, { recursive: true, force: true }))
    const inputRoot = join(root, "input")
    const outputRoot = join(root, "output")
    await mkdir(inputRoot)
    await mkdir(outputRoot)
    const payload = Buffer.from("exact upstream audio fixture")
    const payloadSha256 = createHash("sha256").update(payload).digest("hex")
    const raw = structuredClone(declaration)
    raw.inputs = raw.inputs.map((input) => ({
      ...input,
      upstreamSha256: payloadSha256,
      upstreamByteSize: payload.length,
      durationSeconds: 1,
    }))
    const normalized = stadiumDynamics.validateSignatureSoundStadiumDynamicsDeclaration(raw)
    const planOutput = stadiumDynamics.planSignatureSoundStadiumDynamics(normalized).outputs[0]
    const inputPath = join(inputRoot, ...planOutput.upstreamRelativePath.split("/"))
    await mkdir(join(inputPath, ".."), { recursive: true })
    await writeFile(inputPath, payload)
    let commands = 0
    const runCommand = async (_command, args) => {
      commands += 1
      if (args.includes("null")) {
        return {
          stdout: "",
          stderr: "I: -20.0 LUFS LRA: 6.0 LU LRA low: -27.0 LUFS LRA high: -21.0 LUFS Peak: -5.0 dBFS",
        }
      }
      await writeFile(args.at(-1), Buffer.from("rendered output"))
      return { stdout: "", stderr: "" }
    }
    const inspectAudio = async () => ({
      durationSeconds: 1,
      sampleRateHz: 48000,
      channels: 2,
      bitsPerSample: 24,
      codecName: "pcm_s24le",
      integratedLoudnessLufs: -23,
      loudnessRangeLu: 6,
      loudnessRangeLowLufs: -27,
      loudnessRangeHighLufs: -21,
      truePeakDbtp: -4,
    })
    const first = await cli.renderSignatureSoundStadiumOutput({
      declaration: normalized,
      planOutput,
      inputRoot,
      outputRoot,
      mediaTools: { ffmpeg: "C:\\tools\\ffmpeg.exe", ffprobe: "C:\\tools\\ffprobe.exe" },
      runCommand,
      inspectAudio,
      reverifyTools: async () => ({}),
    })
    assert.equal(first.state, "rendered")
    assert.equal(commands, 2)
    const second = await cli.renderSignatureSoundStadiumOutput({
      declaration: normalized,
      planOutput,
      inputRoot,
      outputRoot,
      mediaTools: { ffmpeg: "C:\\tools\\ffmpeg.exe", ffprobe: "C:\\tools\\ffprobe.exe" },
      runCommand,
      inspectAudio,
      reverifyTools: async () => ({}),
    })
    assert.equal(second.state, "resumed")
    assert.equal(commands, 2)
  })
})
