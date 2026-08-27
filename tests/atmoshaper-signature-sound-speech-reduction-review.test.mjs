import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { describe, it } from "node:test"
import { fileURLToPath } from "node:url"

import {
  loadDevSignatureSoundSpeechReductionManifest,
  resolveDevSignatureSoundSpeechReductionAudio,
} from "../lib/atmoshaper/dev-speech-reduction-audio.js"
import { parseDevCandidateByteRange } from "../lib/atmoshaper/dev-candidate-audio.js"
import {
  applyDevSignatureSoundSpeechReductionReview,
  createRetainedSignatureSoundSpeechReductionReviewEntries,
  selectUnavailableDevSignatureSoundSpeechReductionBatches,
} from "../lib/atmoshaper/dev-speech-reduction-review.js"
import {
  createSignatureSoundSpeechReductionManifest,
  planSignatureSoundSpeechReduction,
  validateSignatureSoundSpeechReductionDeclaration,
} from "../lib/atmoshaper/signature-sound-speech-reduction.js"
import {
  bindSignatureSoundSpeechReductionReview,
  createSignatureSoundSpeechReductionReviewFingerprint,
  validateSignatureSoundSpeechReductionReviewAnchor,
} from "../lib/atmoshaper/signature-sound-speech-reduction-review.js"
import {
  resolveSignatureSoundWholeConceptAudioUrl,
  signatureSoundConceptRequiresSpeechReduction,
} from "../lib/atmoshaper/signature-sound-review-audio-url.js"
import { applySignatureSoundWholeConceptReviewAmendments } from "../lib/atmoshaper/signature-sound-whole-concept-amendment.js"
import { validateSignatureSoundWholeConceptReviewCatalog } from "../lib/atmoshaper/signature-sound-whole-concept-review.js"
import { applySignatureSoundWholeConceptReviewRevisions } from "../lib/atmoshaper/signature-sound-whole-concept-revision.js"

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")

async function closedOwners() {
  const json = (path) => readFile(join(repoRoot, path), "utf8").then(JSON.parse)
  const [rawDeclaration, discoveryReview, constructionReview, batches, revisions, amendments] = await Promise.all([
    json("data/atmoshaper/signature-sound-speech-reduction-auditions.json"),
    json("data/atmoshaper/signature-sound-review.json"),
    json("data/atmoshaper/signature-sound-construction-review.json"),
    json("data/atmoshaper/signature-sound-whole-concept-review-batches.json"),
    json("data/atmoshaper/signature-sound-whole-concept-review-revisions.json"),
    json("data/atmoshaper/signature-sound-whole-concept-review-amendments.json"),
  ])
  const base = validateSignatureSoundWholeConceptReviewCatalog(batches, { constructionReview, discoveryReview })
  const revised = applySignatureSoundWholeConceptReviewRevisions(base, revisions)
  const amended = applySignatureSoundWholeConceptReviewAmendments(revised, amendments)
  const declaration = validateSignatureSoundSpeechReductionDeclaration(rawDeclaration, {
    discoveryReview,
    reviewEntries: amended.entries,
  })
  return { declaration, discoveryReview, reviewEntries: amended.entries }
}

function exactToolchain(declaration) {
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

function audioMeasurement({ outputSha256, byteSize, bitsPerSample = 24, codecName = "pcm_s24le" } = {}) {
  return {
    durationSeconds: 2,
    sampleRateHz: 48000,
    channels: 2,
    bitsPerSample,
    codecName,
    integratedLoudnessLufs: -20,
    truePeakDbtp: -2,
    ...(outputSha256 ? { outputSha256, byteSize } : {}),
  }
}

async function completeFixture(root) {
  const { declaration, reviewEntries } = await closedOwners()
  const plan = planSignatureSoundSpeechReduction(declaration)
  const receipts = []
  for (const [index, output] of plan.outputs.entries()) {
    const bytes = Buffer.from(`exact processed speech output ${index}`)
    const outputPath = join(root, ...output.outputRelativePath.split("/"))
    await mkdir(dirname(outputPath), { recursive: true })
    await writeFile(outputPath, bytes)
    receipts.push({
      version: 1,
      algorithmVersion: declaration.algorithmVersion,
      declarationSha256: declaration.declarationSha256,
      outputIdentity: output.outputIdentity,
      batchId: output.batchId,
      groupId: output.groupId,
      sourceId: output.sourceId,
      sourceSha256: output.sourceSha256,
      sourceByteSize: output.sourceByteSize,
      inputRelativePath: output.inputRelativePath,
      mixPolicy: output.mixPolicy,
      vocalsGainDb: output.vocalsGainDb,
      toolchain: exactToolchain(declaration),
      inputMeasurement: audioMeasurement({ bitsPerSample: 16, codecName: "pcm_s16le" }),
      separatedMeasurement: audioMeasurement(),
      matchingGainDb: 0,
      targetIntegratedLoudnessLufs: -20,
      outputRelativePath: output.outputRelativePath,
      outputMeasurement: audioMeasurement({
        outputSha256: createHash("sha256").update(bytes).digest("hex"),
        byteSize: bytes.length,
      }),
    })
  }
  const manifest = createSignatureSoundSpeechReductionManifest(receipts, declaration)
  const manifestBytes = Buffer.from(`${JSON.stringify(manifest, null, 2)}\n`)
  await writeFile(join(root, "speech-reduction-manifest.json"), manifestBytes)
  const anchor = {
    version: 1,
    anchorKind: "signature-speech-reduction-review",
    manifestRelativePath: "speech-reduction-manifest.json",
    declarationSha256: declaration.declarationSha256,
    manifestSha256: createHash("sha256").update(manifestBytes).digest("hex"),
  }
  return { declaration, reviewEntries, manifest, anchor, plan }
}

describe("AtmoShaper speech-reduction review binding", () => {
  it("leaves the live catalog processing-gated when no exact anchor exists", async () => {
    const catalog = { entries: [] }
    const result = await applyDevSignatureSoundSpeechReductionReview({
      catalog,
      rawDeclaration: {},
      discoveryReview: {},
      anchorPath: join(tmpdir(), `missing-speech-anchor-${Date.now()}.json`),
      outputRoot: undefined,
      nodeEnv: "development",
    })
    assert.equal(result, catalog)
  })

  it("authenticates the retained 30-output v1 declaration without returning its superseded Traffic pool", async () => {
    const { discoveryReview, reviewEntries } = await closedOwners()
    const retainedRawDeclaration = JSON.parse(await readFile(join(
      repoRoot,
      "data/atmoshaper/signature-sound-speech-reduction-auditions-v1.json",
    ), "utf8"))
    const retainedEntries = createRetainedSignatureSoundSpeechReductionReviewEntries({
      reviewEntries,
      retainedRawDeclaration,
      discoveryReview,
    })
    const declaration = validateSignatureSoundSpeechReductionDeclaration(retainedRawDeclaration, {
      discoveryReview,
      reviewEntries: retainedEntries,
      sourceCountOverrides: { "batch-21-traffic": 12 },
    })
    assert.equal(declaration.declarationSha256, "d87f5ede54226278b846bdb69894f293cb76b57da636ccde6540326c6dfd2ad7")
    assert.equal(planSignatureSoundSpeechReduction(declaration).outputs.length, 30)
    assert.equal(reviewEntries.find(({ batchId }) => batchId === "batch-21-traffic").sources.length, 9)
  })

  it("binds the exact 9/12/6 pools and derives new review fingerprints without mutating producer inputs", async (context) => {
    const root = await mkdtemp(join(tmpdir(), "atmoshaper-speech-review-binding-"))
    context.after(() => rm(root, { recursive: true, force: true }))
    const fixture = await completeFixture(root)
    const declarationBefore = structuredClone(fixture.declaration)
    const entriesBefore = structuredClone(fixture.reviewEntries)
    const bound = bindSignatureSoundSpeechReductionReview(fixture)
    assert.deepEqual(fixture.declaration, declarationBefore)
    assert.deepEqual(fixture.reviewEntries, entriesBefore)
    assert.deepEqual(bound.filter(({ batchId }) => ["batch-21-traffic", "batch-35-london-ambience", "batch-45-stadium-crowd"].includes(batchId))
      .map(({ batchId, sources }) => [batchId, sources.length]), [
      ["batch-21-traffic", 9],
      ["batch-35-london-ambience", 12],
      ["batch-45-stadium-crowd", 6],
    ])
    const trafficBefore = fixture.reviewEntries.find(({ batchId }) => batchId === "batch-21-traffic")
    const trafficAfter = bound.find(({ batchId }) => batchId === "batch-21-traffic")
    assert.notEqual(trafficAfter.reviewFingerprint, trafficBefore.reviewFingerprint)
    assert.equal(trafficAfter.reviewState, "ready-to-audition")
    assert.deepEqual(trafficAfter.processingRequirements, [])
    assert.ok(trafficAfter.sources.every(({ audioUrl }) => audioUrl.includes("/batch-21-traffic/")))
    const otherManifestIdentity = bindSignatureSoundSpeechReductionReview({
      ...fixture,
      anchor: { ...fixture.anchor, manifestSha256: "f".repeat(64) },
    }).find(({ batchId }) => batchId === "batch-21-traffic")
    assert.notEqual(otherManifestIdentity.reviewFingerprint, trafficAfter.reviewFingerprint)
    const stadiumAfter = bound.find(({ batchId }) => batchId === "batch-45-stadium-crowd")
    assert.equal(stadiumAfter.reviewState, "processing-required")
    assert.deepEqual(stadiumAfter.processingRequirements.map(({ kind }) => kind), [
      "dynamic-range-control",
      "level-match",
    ])
    assert.match(stadiumAfter.amendment.summary, /Speech reduction is complete.*remaining whole-concept processing/i)
    const ordinaryBefore = fixture.reviewEntries.find(({ batchId }) => batchId === "batch-30-fireplace")
    const ordinaryAfter = bound.find(({ batchId }) => batchId === "batch-30-fireplace")
    assert.deepEqual(ordinaryAfter, ordinaryBefore)

    const trafficOnly = {
      entries: fixture.reviewEntries.map((entry) => (
        entry.batchId === "batch-21-traffic" ? trafficAfter : entry
      )),
    }
    assert.deepEqual(
      selectUnavailableDevSignatureSoundSpeechReductionBatches(trafficOnly),
      ["batch-35-london-ambience", "batch-45-stadium-crowd"],
      "an unavailable retained bundle must not make valid v2 Traffic inactive",
    )
    assert.deepEqual(selectUnavailableDevSignatureSoundSpeechReductionBatches({ entries: bound }), [])

    const committedAnchor = JSON.parse(await readFile(join(
      repoRoot,
      "data/atmoshaper/signature-sound-speech-reduction-review-anchor.json",
    ), "utf8"))
    const committedTrafficAnchor = JSON.parse(await readFile(join(
      repoRoot,
      "data/atmoshaper/signature-sound-speech-reduction-traffic-review-anchor.json",
    ), "utf8"))
    const committedOutcomes = JSON.parse(await readFile(join(
      repoRoot,
      "data/atmoshaper/signature-sound-whole-concept-chat-outcomes.json",
    ), "utf8"))
    const londonOutcome = committedOutcomes.entries.find(({ batchId }) => batchId === "batch-35-london-ambience")
    const londonBase = fixture.reviewEntries.find(({ batchId }) => batchId === "batch-35-london-ambience")
    const committedLondonFingerprint = createSignatureSoundSpeechReductionReviewFingerprint({
      reviewKind: "whole-concept-speech-reduction-review-entry",
      baseReviewFingerprint: londonBase.reviewFingerprint,
      declarationSha256: committedAnchor.declarationSha256,
      manifestSha256: committedAnchor.manifestSha256,
      batchId: londonBase.batchId,
    })
    assert.equal(londonOutcome.decision, "pass")
    assert.equal(londonOutcome.reviewFingerprint, committedLondonFingerprint)
    const trafficOutcome = committedOutcomes.entries.find(({ batchId }) => batchId === "batch-21-traffic")
    const committedTrafficFingerprint = createSignatureSoundSpeechReductionReviewFingerprint({
      reviewKind: "whole-concept-speech-reduction-review-entry",
      baseReviewFingerprint: trafficBefore.reviewFingerprint,
      declarationSha256: committedTrafficAnchor.declarationSha256,
      manifestSha256: committedTrafficAnchor.manifestSha256,
      batchId: trafficBefore.batchId,
    })
    assert.equal(trafficOutcome.decision, "pass")
    assert.equal(trafficOutcome.reviewFingerprint, committedTrafficFingerprint)
    const stadiumOutcome = committedOutcomes.entries.find(({ batchId }) => batchId === "batch-45-stadium-crowd")
    const stadiumBase = fixture.reviewEntries.find(({ batchId }) => batchId === "batch-45-stadium-crowd")
    const committedStadiumFingerprint = createSignatureSoundSpeechReductionReviewFingerprint({
      reviewKind: "whole-concept-speech-reduction-review-entry",
      baseReviewFingerprint: stadiumBase.reviewFingerprint,
      declarationSha256: committedAnchor.declarationSha256,
      manifestSha256: committedAnchor.manifestSha256,
      batchId: stadiumBase.batchId,
    })
    assert.equal(stadiumOutcome.decision, "pass")
    assert.equal(committedStadiumFingerprint, "581844bfabfe92024656ea7686c8aff4e729bc0bd575da5316634571e4254ea1")
    assert.equal(stadiumOutcome.reviewFingerprint, "9db93767ce5667a5831a6b803520712b657634eee88268769088886aac17bf35")
    assert.match(stadiumOutcome.note, /preferred.*speech-reduced.*inactive/i)
  })

  it("fails closed on fingerprint, pool, output, and anchor drift", async (context) => {
    const root = await mkdtemp(join(tmpdir(), "atmoshaper-speech-review-drift-"))
    context.after(() => rm(root, { recursive: true, force: true }))
    const fixture = await completeFixture(root)
    const fingerprint = structuredClone(fixture)
    fingerprint.reviewEntries.find(({ batchId }) => batchId === "batch-21-traffic").reviewFingerprint = "f".repeat(64)
    assert.throws(() => bindSignatureSoundSpeechReductionReview(fingerprint), /fingerprint drifted/i)
    const missing = structuredClone(fixture)
    missing.manifest.outputs.pop()
    assert.throws(() => bindSignatureSoundSpeechReductionReview(missing), /exactly 27/i)
    const duplicate = structuredClone(fixture)
    duplicate.manifest.outputs[1] = structuredClone(duplicate.manifest.outputs[0])
    assert.throws(() => bindSignatureSoundSpeechReductionReview(duplicate), /duplicate.*output identity/i)
    const wrongPool = structuredClone(fixture)
    wrongPool.manifest.outputs[0].sourceId = "e".repeat(64)
    assert.throws(() => bindSignatureSoundSpeechReductionReview(wrongPool), /pool does not match/i)
    const wrongDeclaration = structuredClone(fixture.anchor)
    wrongDeclaration.declarationSha256 = "d".repeat(64)
    assert.throws(() => bindSignatureSoundSpeechReductionReview({ ...fixture, anchor: wrongDeclaration }), /fingerprint drifted/i)
    assert.throws(() => validateSignatureSoundSpeechReductionReviewAnchor({
      ...fixture.anchor,
      manifestRelativePath: "../manifest.json",
    }), /relative/i)
  })

  it("never falls back to raw audio for processed concepts and keeps ordinary concepts raw", () => {
    const sourceId = "a".repeat(64)
    const traffic = { sourceId, audioUrl: `/api/dev/atmoshaper-candidates/speech-reduction/batch-21-traffic/${"b".repeat(64)}` }
    const london = { sourceId, audioUrl: `/api/dev/atmoshaper-candidates/speech-reduction/batch-35-london-ambience/${"c".repeat(64)}` }
    assert.notEqual(
      resolveSignatureSoundWholeConceptAudioUrl(traffic, { requiresSpeechReduction: true }),
      resolveSignatureSoundWholeConceptAudioUrl(london, { requiresSpeechReduction: true }),
    )
    assert.throws(
      () => resolveSignatureSoundWholeConceptAudioUrl({ sourceId }, { requiresSpeechReduction: true }),
      /missing.*processed URL/i,
    )
    assert.equal(
      resolveSignatureSoundWholeConceptAudioUrl({ sourceId }, { requiresSpeechReduction: false }),
      `/api/dev/atmoshaper-candidates/audio/${sourceId}`,
    )
    assert.throws(
      () => resolveSignatureSoundWholeConceptAudioUrl(traffic, { requiresSpeechReduction: false }),
      /raw concept.*processed URL/i,
    )
    assert.equal(signatureSoundConceptRequiresSpeechReduction({ processingRequirements: [{ kind: "remove-discernible-speech" }] }), true)
    assert.equal(signatureSoundConceptRequiresSpeechReduction({ processingRequirements: [{ kind: "level-match" }] }), false)
  })
})

describe("AtmoShaper development speech-reduction serving", () => {
  it("loads the checksum-anchored complete manifest and resolves only batch-owned exact bytes", async (context) => {
    const root = await mkdtemp(join(tmpdir(), "atmoshaper-speech-dev-serving-"))
    context.after(() => rm(root, { recursive: true, force: true }))
    const fixture = await completeFixture(root)
    const snapshot = await loadDevSignatureSoundSpeechReductionManifest({
      outputRoot: root,
      anchor: fixture.anchor,
      declaration: fixture.declaration,
      nodeEnv: "development",
    })
    const output = fixture.plan.outputs[0]
    const audio = await resolveDevSignatureSoundSpeechReductionAudio({
      batchId: output.batchId,
      outputIdentity: output.outputIdentity,
      manifest: snapshot.manifest,
      outputRoot: root,
      nodeEnv: "development",
    })
    assert.match(audio.bytes.toString(), /exact processed speech output 0/)
    await assert.rejects(resolveDevSignatureSoundSpeechReductionAudio({
      batchId: "batch-35-london-ambience",
      outputIdentity: output.outputIdentity,
      manifest: snapshot.manifest,
      outputRoot: root,
      nodeEnv: "development",
    }), /another batch/i)
    await assert.rejects(resolveDevSignatureSoundSpeechReductionAudio({
      batchId: output.batchId,
      outputIdentity: "f".repeat(64),
      manifest: snapshot.manifest,
      outputRoot: root,
      nodeEnv: "development",
    }), /unknown/i)
    await assert.rejects(resolveDevSignatureSoundSpeechReductionAudio({
      batchId: output.batchId,
      outputIdentity: output.outputIdentity,
      manifest: snapshot.manifest,
      outputRoot: root,
      nodeEnv: "production",
    }), /production/i)
  })

  it("rejects manifest hash, output size/hash, duplicate identity, and escaping paths", async (context) => {
    const root = await mkdtemp(join(tmpdir(), "atmoshaper-speech-dev-reject-"))
    context.after(() => rm(root, { recursive: true, force: true }))
    const fixture = await completeFixture(root)
    await assert.rejects(loadDevSignatureSoundSpeechReductionManifest({
      outputRoot: root,
      anchor: { ...fixture.anchor, manifestSha256: "f".repeat(64) },
      declaration: fixture.declaration,
      nodeEnv: "development",
    }), /changed from its anchor/i)
    const output = fixture.manifest.outputs[0]
    const sizeDrift = structuredClone(fixture.manifest)
    sizeDrift.outputs[0].outputMeasurement.byteSize += 1
    await assert.rejects(resolveDevSignatureSoundSpeechReductionAudio({
      batchId: output.batchId, outputIdentity: output.outputIdentity, manifest: sizeDrift, outputRoot: root, nodeEnv: "development",
    }), /size changed/i)
    const hashDrift = structuredClone(fixture.manifest)
    hashDrift.outputs[0].outputMeasurement.outputSha256 = "e".repeat(64)
    await assert.rejects(resolveDevSignatureSoundSpeechReductionAudio({
      batchId: output.batchId, outputIdentity: output.outputIdentity, manifest: hashDrift, outputRoot: root, nodeEnv: "development",
    }), /content changed/i)
    const duplicate = structuredClone(fixture.manifest)
    duplicate.outputs[1].outputIdentity = output.outputIdentity
    await assert.rejects(resolveDevSignatureSoundSpeechReductionAudio({
      batchId: output.batchId, outputIdentity: output.outputIdentity, manifest: duplicate, outputRoot: root, nodeEnv: "development",
    }), /duplicate/i)
    const escape = structuredClone(fixture.manifest)
    escape.outputs[0].outputRelativePath = "../outside.wav"
    await assert.rejects(resolveDevSignatureSoundSpeechReductionAudio({
      batchId: output.batchId, outputIdentity: output.outputIdentity, manifest: escape, outputRoot: root, nodeEnv: "development",
    }), /relative/i)
  })

  it("keeps representative route Range 206/416 handling explicit", async () => {
    const route = await readFile(join(repoRoot, "app/api/dev/atmoshaper-candidates/speech-reduction/[batchId]/[outputIdentity]/route.ts"), "utf8")
    assert.match(route, /parseDevCandidateByteRange/)
    assert.match(route, /status: 416/)
    assert.match(route, /byteRange\.status/)
    assert.match(route, /Content-Range/)
    assert.match(route, /ATMOSHAPER_SIGNATURE_SPEECH_REDUCTION_ROOT/)
    assert.deepEqual(parseDevCandidateByteRange("bytes=2-5", 10), { start: 2, end: 5, status: 206 })
    assert.throws(() => parseDevCandidateByteRange("bytes=10-", 10), /range/i)
  })
})
