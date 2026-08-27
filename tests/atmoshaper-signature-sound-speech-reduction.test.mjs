import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { describe, it } from "node:test"
import { fileURLToPath } from "node:url"

import {
  buildSignatureSoundDemucsAdapterArgv,
  buildSignatureSoundSpeechMatchArgv,
  buildSignatureSoundSpeechStemMixArgv,
  calculateSignatureSoundSpeechLoudnessMatch,
  planSignatureSoundSpeechReduction,
  validateSignatureSoundSpeechReductionDeclaration,
  validateSignatureSoundSpeechReductionReceipt,
} from "../lib/atmoshaper/signature-sound-speech-reduction.js"
import { validateSignatureSoundWholeConceptReviewCatalog } from "../lib/atmoshaper/signature-sound-whole-concept-review.js"
import { applySignatureSoundWholeConceptReviewRevisions } from "../lib/atmoshaper/signature-sound-whole-concept-revision.js"
import { applySignatureSoundWholeConceptReviewAmendments } from "../lib/atmoshaper/signature-sound-whole-concept-amendment.js"
import {
  parseSignatureSoundSpeechEbur128,
  parseSignatureSoundSpeechReductionCliArguments,
  loadSignatureSoundSpeechResumeReceipt,
  renderSignatureSoundSpeechSource,
  verifySignatureSoundSpeechSourceFile,
} from "../scripts/atmoshaper-signature-sound-speech-reduction.mjs"

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")

async function loadClosedDeclaration() {
  const readJson = (relativePath) => readFile(join(repoRoot, relativePath), "utf8").then(JSON.parse)
  const [raw, discoveryReview, constructionReview, batches, revisions, amendments] = await Promise.all([
    readJson("data/atmoshaper/signature-sound-speech-reduction-auditions.json"),
    readJson("data/atmoshaper/signature-sound-review.json"),
    readJson("data/atmoshaper/signature-sound-construction-review.json"),
    readJson("data/atmoshaper/signature-sound-whole-concept-review-batches.json"),
    readJson("data/atmoshaper/signature-sound-whole-concept-review-revisions.json"),
    readJson("data/atmoshaper/signature-sound-whole-concept-review-amendments.json"),
  ])
  const base = validateSignatureSoundWholeConceptReviewCatalog(batches, { constructionReview, discoveryReview })
  const revised = applySignatureSoundWholeConceptReviewRevisions(base, revisions)
  const amended = applySignatureSoundWholeConceptReviewAmendments(revised, amendments)
  return {
    raw,
    discoveryReview,
    reviewEntries: amended.entries,
    declaration: validateSignatureSoundSpeechReductionDeclaration(raw, {
      discoveryReview,
      reviewEntries: amended.entries,
    }),
  }
}

function toolchain(declaration) {
  return {
    adapterVersion: declaration.model.adapterVersion,
    adapterSha256: declaration.model.adapterSha256,
    pythonVersion: "3.10.11",
    pythonExecutableSha256: declaration.model.pythonExecutableSha256,
    demucsVersion: declaration.model.demucsVersion,
    demucsPackageSha256: declaration.model.demucsPackageSha256,
    backend: declaration.model.backend,
    device: declaration.model.device,
    modelName: declaration.model.name,
    modelWeightFileName: declaration.model.weightFileName,
    modelWeightSha256: declaration.model.weightSha256,
    modelConfigurationFileName: declaration.model.configurationFileName,
    modelConfigurationSha256: declaration.model.configurationSha256,
    ffmpegVersion: declaration.format.requiredFfmpegVersion,
    ffprobeVersion: declaration.format.requiredFfprobeVersion,
    ffmpegExecutableSha256: declaration.format.ffmpegExecutableSha256,
    ffprobeExecutableSha256: declaration.format.ffprobeExecutableSha256,
  }
}

function measurement({ loudness, peak, duration = 2, sampleRate = 48000, channels = 2, bits = 24, codec = "pcm_s24le" }) {
  return {
    durationSeconds: duration,
    sampleRateHz: sampleRate,
    channels,
    bitsPerSample: bits,
    codecName: codec,
    integratedLoudnessLufs: loudness,
    truePeakDbtp: peak,
  }
}

describe("AtmoShaper Signature speech-reduction audition owner", () => {
  it("binds Traffic, London, and Stadium to all 27 exact discovery/review assignments", async () => {
    const { declaration } = await loadClosedDeclaration()
    const plan = planSignatureSoundSpeechReduction(declaration)
    assert.equal(plan.outputs.length, 27)
    assert.deepEqual(declaration.concepts.map(({ batchId, sources }) => [batchId, sources.length]), [
      ["batch-21-traffic", 9],
      ["batch-35-london-ambience", 12],
      ["batch-45-stadium-crowd", 6],
    ])
    const trafficSourceIds = new Set(declaration.concepts[0].sources.map(({ sourceId }) => sourceId))
    assert.deepEqual([
      "f7e2c20668d276a4a125b189c7d44e845f20271e812f96c38405193d23a13e7d",
      "cf936ab0acc2f2af3be2b9458c6c740b150c9a185e43290aa1a25889a64e46c5",
      "92ba95d7acfcf002d181399712ce0e29f8d48372064c7425c0be05d70f3cea4a",
    ].filter((sourceId) => trafficSourceIds.has(sourceId)), [])
    assert.deepEqual(declaration.concepts.map(({ mixPolicy, vocalsGainDb }) => [mixPolicy, vocalsGainDb]), [
      ["no-vocals-only", null],
      ["reduced-vocals-mix", -20],
      ["reduced-vocals-mix", -12],
    ])
    assert.ok(plan.outputs.every(({ sourceSha256, sourceByteSize }) => /^[a-f0-9]{64}$/.test(sourceSha256) && sourceByteSize > 0))
    assert.equal(new Set(plan.outputs.map(({ outputIdentity }) => outputIdentity)).size, 27)
  })

  it("rejects source-pool and source-identity drift before a plan can exist", async () => {
    const { raw, discoveryReview, reviewEntries } = await loadClosedDeclaration()
    const sourceDrift = structuredClone(raw)
    sourceDrift.concepts[0].sourceIds.reverse()
    assert.throws(
      () => validateSignatureSoundSpeechReductionDeclaration(sourceDrift, { discoveryReview, reviewEntries }),
      /exact review pool|sources/i,
    )
    const checksumDrift = structuredClone(discoveryReview)
    const selectedId = raw.concepts[0].sourceIds[0]
    checksumDrift.sources.find(({ sourceId }) => sourceId === selectedId).sha256 = "f".repeat(64)
    assert.throws(
      () => validateSignatureSoundSpeechReductionDeclaration(raw, { discoveryReview: checksumDrift, reviewEntries }),
      /fingerprint.*stale/i,
    )
    const modelConfigurationDrift = structuredClone(raw)
    modelConfigurationDrift.model.configurationSha256 = "0".repeat(64)
    assert.throws(
      () => validateSignatureSoundSpeechReductionDeclaration(modelConfigurationDrift, { discoveryReview, reviewEntries }),
      /configurationSha256|configuration checksum|model/i,
    )
    const demucsPackageDrift = structuredClone(raw)
    demucsPackageDrift.model.demucsPackageSha256 = "1".repeat(64)
    assert.throws(
      () => validateSignatureSoundSpeechReductionDeclaration(demucsPackageDrift, { discoveryReview, reviewEntries }),
      /demucsPackageSha256|package checksum|model/i,
    )
  })

  it("caps loudness matching at true-peak headroom instead of applying a limiter", () => {
    assert.deepEqual(calculateSignatureSoundSpeechLoudnessMatch({
      inputIntegratedLoudnessLufs: -20,
      separatedIntegratedLoudnessLufs: -30,
      separatedTruePeakDbtp: -5,
      truePeakCeilingDbtp: -1,
    }), {
      desiredGainDb: 10,
      peakSafeGainDb: 4,
      matchingGainDb: 4,
      targetIntegratedLoudnessLufs: -26,
      peakLimited: true,
    })
    assert.equal(calculateSignatureSoundSpeechLoudnessMatch({
      inputIntegratedLoudnessLufs: -28,
      separatedIntegratedLoudnessLufs: -25,
      separatedTruePeakDbtp: -4,
      truePeakCeilingDbtp: -1,
    }).matchingGainDb, -3)
  })

  it("builds CPU-only Demucs and concept-specific canonical FFmpeg recipes", async () => {
    const { declaration } = await loadClosedDeclaration()
    const plan = planSignatureSoundSpeechReduction(declaration)
    const traffic = plan.outputs.find(({ batchId }) => batchId === "batch-21-traffic")
    const london = plan.outputs.find(({ batchId }) => batchId === "batch-35-london-ambience")
    const stadium = plan.outputs.find(({ batchId }) => batchId === "batch-45-stadium-crowd")
    const demucs = buildSignatureSoundDemucsAdapterArgv(traffic, {
      ripxPython: "C:\\RipX\\python.exe",
      adapterPath: "C:\\repo\\adapter.py",
      ripScriptLib: "C:\\RipX\\RipScriptLib",
      modelRepo: "C:\\RipX\\models",
      outputDirectory: "C:\\out\\demucs",
      inputPath: "C:\\source\\traffic.wav",
    })
    assert.ok(demucs.includes("separate"))
    assert.ok(demucs.includes("-B"))
    assert.ok(demucs.includes("C:\\RipX\\python.exe"))
    const trafficMix = buildSignatureSoundSpeechStemMixArgv(traffic, {
      ffmpegCommand: "ffmpeg", noVocalsPath: "no.wav", vocalsPath: "voice.wav", outputPath: "mix.wav", format: declaration.format,
    })
    const londonMix = buildSignatureSoundSpeechStemMixArgv(london, {
      ffmpegCommand: "ffmpeg", noVocalsPath: "no.wav", vocalsPath: "voice.wav", outputPath: "mix.wav", format: declaration.format,
    })
    const stadiumMix = buildSignatureSoundSpeechStemMixArgv(stadium, {
      ffmpegCommand: "ffmpeg", noVocalsPath: "no.wav", vocalsPath: "voice.wav", outputPath: "mix.wav", format: declaration.format,
    })
    assert.equal(trafficMix.filter((part) => part === "-i").length, 1)
    assert.match(londonMix.join(" "), /volume=-20dB/)
    assert.match(stadiumMix.join(" "), /volume=-12dB/)
    const match = buildSignatureSoundSpeechMatchArgv({ matchingGainDb: 4 }, {
      ffmpegCommand: "ffmpeg", inputPath: "mix.wav", outputPath: "audio.wav", format: declaration.format,
    })
    assert.ok(match.includes("pcm_s24le"))
    assert.match(match.join(" "), /volume=4dB/)
    assert.ok([trafficMix, londonMix, stadiumMix, match].every((argv) => argv.includes("-n")))
  })

  it("parses a closed explicit CLI and the final EBU R128 summary", () => {
    const root = resolve(tmpdir(), "speech-root")
    const options = parseSignatureSoundSpeechReductionCliArguments([
      "plan",
      "--source-root", root,
      "--output-root", resolve(tmpdir(), "speech-output"),
      "--ripx-python", resolve(tmpdir(), "python.exe"),
      "--ripx-script-lib", resolve(tmpdir(), "RipScriptLib"),
      "--model-repo", resolve(tmpdir(), "models"),
      "--model-weight", resolve(tmpdir(), "models", "955717e8-8726e21a.th"),
      "--model-config", resolve(tmpdir(), "models", "htdemucs.yaml"),
      "--demucs-adapter", resolve(tmpdir(), "adapter.py"),
      "--ffmpeg", resolve(tmpdir(), "ffmpeg.exe"),
      "--ffprobe", resolve(tmpdir(), "ffprobe.exe"),
      "--batch-id", "batch-21-traffic",
    ])
    assert.equal(options.mode, "plan")
    assert.equal(options.sourceRoot, root)
    assert.equal(options.batchId, "batch-21-traffic")
    assert.throws(() => parseSignatureSoundSpeechReductionCliArguments(["render"]), /required/i)
    assert.deepEqual(parseSignatureSoundSpeechEbur128(`
Summary:
  Integrated loudness:
    I:         -27.4 LUFS
  True peak:
    Peak:       -3.2 dBFS
`), { integratedLoudnessLufs: -27.4, truePeakDbtp: -3.2 })
  })

  it("verifies source bytes and closes a receipt over model and loudness provenance", async (context) => {
    const { declaration } = await loadClosedDeclaration()
    const root = await mkdtemp(join(tmpdir(), "atmoshaper-speech-source-"))
    context.after(() => rm(root, { recursive: true, force: true }))
    const bytes = Buffer.from("exact speech source")
    await mkdir(join(root, "source"))
    await writeFile(join(root, "source", "input.wav"), bytes)
    const output = {
      ...planSignatureSoundSpeechReduction(declaration).outputs[0],
      sourceSha256: createHash("sha256").update(bytes).digest("hex"),
      sourceByteSize: bytes.length,
      inputRelativePath: "source/input.wav",
    }
    await assert.doesNotReject(verifySignatureSoundSpeechSourceFile(output, root))
    await writeFile(join(root, "source", "input.wav"), Buffer.from("changed"))
    await assert.rejects(verifySignatureSoundSpeechSourceFile(output, root), /byte size|checksum/i)

    const outside = await mkdtemp(join(tmpdir(), "atmoshaper-speech-outside-"))
    context.after(() => rm(outside, { recursive: true, force: true }))
    await writeFile(join(outside, "linked.wav"), bytes)
    await symlink(outside, join(root, "linked"), "junction")
    await assert.rejects(verifySignatureSoundSpeechSourceFile({
      ...output,
      inputRelativePath: "linked/linked.wav",
    }, root), /link|junction|escapes|boundary/i)

    const planned = planSignatureSoundSpeechReduction(declaration).outputs[0]
    const inputMeasurement = measurement({ loudness: -20, peak: -2, bits: 16, codec: "pcm_s16le" })
    const separatedMeasurement = measurement({ loudness: -30, peak: -5 })
    const receipt = validateSignatureSoundSpeechReductionReceipt({
      version: 1,
      algorithmVersion: declaration.algorithmVersion,
      declarationSha256: declaration.declarationSha256,
      outputIdentity: planned.outputIdentity,
      batchId: planned.batchId,
      groupId: planned.groupId,
      sourceId: planned.sourceId,
      sourceSha256: planned.sourceSha256,
      sourceByteSize: planned.sourceByteSize,
      inputRelativePath: planned.inputRelativePath,
      mixPolicy: planned.mixPolicy,
      vocalsGainDb: planned.vocalsGainDb,
      toolchain: toolchain(declaration),
      inputMeasurement,
      separatedMeasurement,
      matchingGainDb: 4,
      targetIntegratedLoudnessLufs: -26,
      outputRelativePath: planned.outputRelativePath,
      outputMeasurement: {
        ...measurement({ loudness: -26, peak: -1 }),
        outputSha256: "a".repeat(64),
        byteSize: 100,
      },
    }, { declaration, planOutput: planned })
    assert.equal(receipt.matchingGainDb, 4)
    const drift = structuredClone(receipt)
    drift.toolchain.modelWeightSha256 = "b".repeat(64)
    assert.throws(
      () => validateSignatureSoundSpeechReductionReceipt(drift, { declaration, planOutput: planned }),
      /modelWeightSha256|toolchain/i,
    )
    const configurationDrift = structuredClone(receipt)
    configurationDrift.toolchain.modelConfigurationSha256 = "c".repeat(64)
    assert.throws(
      () => validateSignatureSoundSpeechReductionReceipt(configurationDrift, { declaration, planOutput: planned }),
      /modelConfigurationSha256|toolchain/i,
    )
    const executableDrift = structuredClone(receipt)
    executableDrift.toolchain.ffmpegExecutableSha256 = "d".repeat(64)
    assert.throws(
      () => validateSignatureSoundSpeechReductionReceipt(executableDrift, { declaration, planOutput: planned }),
      /ffmpegExecutableSha256|toolchain/i,
    )
    const durationDrift = structuredClone(receipt)
    durationDrift.inputMeasurement.durationSeconds = 3
    assert.throws(
      () => validateSignatureSoundSpeechReductionReceipt(durationDrift, { declaration, planOutput: planned }),
      /duration.*source|treatment duration/i,
    )
  })

  it("atomically publishes one bundle and resumes without rerunning separation", async (context) => {
    const { declaration } = await loadClosedDeclaration()
    const sourceRoot = await mkdtemp(join(tmpdir(), "atmoshaper-speech-render-source-"))
    const outputRoot = await mkdtemp(join(tmpdir(), "atmoshaper-speech-render-output-"))
    context.after(() => Promise.all([
      rm(sourceRoot, { recursive: true, force: true }),
      rm(outputRoot, { recursive: true, force: true }),
    ]))
    const bytes = Buffer.from("render input")
    await mkdir(join(sourceRoot, "source"))
    await writeFile(join(sourceRoot, "source", "input.wav"), bytes)
    const original = planSignatureSoundSpeechReduction(declaration).outputs[0]
    const planOutput = {
      ...original,
      sourceSha256: createHash("sha256").update(bytes).digest("hex"),
      sourceByteSize: bytes.length,
      inputRelativePath: "source/input.wav",
      bundleRelativePath: `artifacts/test/${original.sourceId}`,
      outputRelativePath: `artifacts/test/${original.sourceId}/audio.wav`,
      receiptRelativePath: `artifacts/test/${original.sourceId}/receipt.json`,
    }
    let commandCount = 0
    const executedCommands = []
    const runCommand = async (command, argv) => {
      commandCount += 1
      executedCommands.push(command)
      if (command.endsWith("python.exe")) {
        const demucsRoot = argv[argv.indexOf("--output-dir") + 1]
        const stemRoot = join(demucsRoot, "htdemucs", "input")
        await mkdir(stemRoot, { recursive: true })
        await writeFile(join(stemRoot, "no_vocals.wav"), Buffer.from("no vocals"))
        await writeFile(join(stemRoot, "vocals.wav"), Buffer.from("vocals"))
      } else {
        await writeFile(argv.at(-1), Buffer.from(argv.includes("separated.wav") ? "separated" : "final output"))
      }
      return { stdout: "", stderr: "" }
    }
    const inspectAudio = async ({ filePath }) => {
      if (filePath.endsWith("input.wav")) return measurement({ loudness: -20, peak: -2, bits: 16, codec: "pcm_s16le" })
      if (filePath.endsWith("separated.wav")) return measurement({ loudness: -30, peak: -5 })
      return measurement({ loudness: -26, peak: -1 })
    }
    const args = {
      declaration,
      planOutput,
      sourceRoot,
      outputRoot,
      verifiedToolchain: {
        provenance: toolchain(declaration),
        paths: {
        ripxPython: "C:\\RipX\\python.exe",
        ripScriptLib: "C:\\RipX\\RipScriptLib",
        modelRepo: "C:\\RipX\\models",
        modelWeight: "C:\\RipX\\models\\955717e8-8726e21a.th",
        modelConfiguration: "C:\\RipX\\models\\htdemucs.yaml",
        demucsAdapter: "C:\\repo\\adapter.py",
        demucsPackage: "C:\\RipX\\RipScriptLib\\demucs",
        ffmpeg: "C:\\ffmpeg\\ffmpeg.exe",
        ffprobe: "C:\\ffmpeg\\ffprobe.exe",
        },
      },
      runCommand,
      inspectAudio,
      reverifyToolchain: async (verified) => verified,
      reverifyMediaTools: async () => {},
    }
    const linkedBundle = {
      ...planOutput,
      bundleRelativePath: `artifacts/linked/${original.sourceId}`,
      outputRelativePath: `artifacts/linked/${original.sourceId}/audio.wav`,
      receiptRelativePath: `artifacts/linked/${original.sourceId}/receipt.json`,
    }
    const outsideBundle = await mkdtemp(join(tmpdir(), "atmoshaper-speech-output-link-"))
    context.after(() => rm(outsideBundle, { recursive: true, force: true }))
    await mkdir(join(outputRoot, "artifacts", "linked"), { recursive: true })
    await symlink(outsideBundle, join(outputRoot, linkedBundle.bundleRelativePath), "junction")
    await assert.rejects(loadSignatureSoundSpeechResumeReceipt({
      declaration,
      planOutput: linkedBundle,
      outputRoot,
    }), /link|junction|boundary|reparse/i)
    const first = await renderSignatureSoundSpeechSource(args)
    assert.equal(first.state, "rendered")
    assert.equal(executedCommands[0], args.verifiedToolchain.paths.ripxPython)
    assert.ok(executedCommands.slice(1).every((command) => command === args.verifiedToolchain.paths.ffmpeg))
    const countAfterRender = commandCount
    const resumed = await renderSignatureSoundSpeechSource(args)
    assert.equal(resumed.state, "resumed")
    assert.equal(commandCount, countAfterRender)
    assert.equal(JSON.parse(await readFile(join(outputRoot, planOutput.receiptRelativePath), "utf8")).outputIdentity, planOutput.outputIdentity)
  })
})
