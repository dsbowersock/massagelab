import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

async function readJson(relativePath) {
  return JSON.parse(await readFile(new URL(relativePath, import.meta.url), "utf8"))
}

async function loadOwner() {
  try {
    return await import("../lib/atmoshaper/signature-sound-treatment-concept-review.js")
  } catch (error) {
    assert.fail(`Treatment concept-review owner must load: ${error?.message ?? error}`)
  }
}

const EXPECTED_WIDE_DUAL_ECHO_X2_OUTPUT_IDENTITIES = [
  "c9813b4e8a83a2b0994b9060d057c369a6f5ec3faac0b31983428db55b714f02",
  "f3e5d4bed0fea3a522c644232378ddae2639bbca022d57069529f038ba3e51bb",
  "fdb3fdbd320f9b63c4d3dbc49db1ac8441be22014231f67d67cba81c46e6ca21",
  "0321306f907d51bd686b1c38a8c9eecb57c95b04d2453606d45e2b3c4bf24ba8",
  "5191dffda4933f4b8d5173457acc798b411874ed6d67694b8f3a54b90005c886",
  "1eb2d4cef6a640d2c684ea1833d74d5ff772f3dcfea1e84f30459dc79147f833",
  "a2c4dddd180aeb9f33df20a4ea64918c3eade43c1fa3f1de8bc1e541b5db4038",
  "f3e75e46e38b3244c5aa58f8d698d87b301b9e69fdc466f9dae6401fe8d5aca7",
  "757fdae186778d4b6447b96c831def2ae9a072bce304b912afa6b558b47d1e72",
  "9dbca6fed2b47fca16f60fe032c6b77f191bc279649a45fef87baecfdc372264",
  "ac84e45780096d201dae4c2f5bb571a44bbd3fc71551f2379625b6770ef882d0",
  "93e8bb14115d33aa61904de01be5054749361483e3b64389a4e139ff9e4cbfb3",
  "33d00f0e2b329a060e1ff6d053b09a23c33729ec1133cf4ef5752600772b6854",
  "9d2ef458a2c3e997af527f022f9c13f20b2c016a251fe7d5a83636d56315e1f6",
  "fd75438a441bff8d88719e83ab0dc2c58f0622f26e85312c8e12151b14c608c3",
  "3419fdbcf645b0db8e8d5ce391a4695117a71a41be49173ced48f26d11711d66",
  "c5e6396cbe64127ac09e75647191dabc9e18f3a1d0c7b5175c99f6e2e228ad75",
  "3913e9a157cb8b44b4368c18630da80cabeec9bb5546e4f5941550490bf0bbca",
]

async function fixture({ wideDualEchoX2OutputIdentities } = {}) {
  const [declaration, anchors] = await Promise.all([
    readJson("../data/atmoshaper/signature-sound-derived-audio-batch-03-sci-fi-whistles-treatment-audition.json"),
    readJson("../data/atmoshaper/signature-sound-derived-audio-manifests.json"),
  ])
  const anchor = anchors.entries.find(({ batchId }) => batchId === declaration.batchId)
  assert.ok(anchor)
  const outputs = declaration.sources.flatMap((source, sourceIndex) => declaration.variants.map((variant) => ({
    sourceId: source.sourceId,
    outputIdentity: variant.variantId === "wide-dual-echo-x2" && wideDualEchoX2OutputIdentities
      ? wideDualEchoX2OutputIdentities[sourceIndex]
      : createHash("sha256").update(`${source.sourceId}:${variant.variantId}`).digest("hex"),
    variantId: variant.variantId,
    variantLabel: variant.label,
  })))
  return {
    manifest: {
      version: 1,
      reviewKind: "treatment-audition",
      batchId: declaration.batchId,
      batchDeclarationSha256: anchor.batchDeclarationSha256,
      groupId: declaration.groupId,
      outputs,
    },
    manifestSha256: anchor.manifestSha256,
    playbackConfiguration: {
      strategyId: "spaced-event-sequence",
      previewSettings: { minimumGapSeconds: 0, maximumGapSeconds: 8 },
    },
  }
}

describe("AtmoShaper Signature treatment concept review", () => {
  it("builds one exact 18-source concept for dry audio and for each treatment", async () => {
    const owner = await loadOwner()
    assert.equal(typeof owner.buildSignatureSoundTreatmentConceptSources, "function")
    const { manifest } = await fixture()
    const sourcePaths = Object.fromEntries(
      [...new Set(manifest.outputs.map(({ sourceId }) => sourceId))]
        .map((sourceId, index) => [sourceId, `Sci-Fi Whistles/Whistle ${index + 1}.wav`]),
    )

    const dry = owner.buildSignatureSoundTreatmentConceptSources(manifest, { variantId: "dry", sourcePaths })
    const short = owner.buildSignatureSoundTreatmentConceptSources(manifest, { variantId: "short-delay", sourcePaths })
    const doubledWide = owner.buildSignatureSoundTreatmentConceptSources(manifest, { variantId: "wide-dual-echo-x2", sourcePaths })

    assert.equal(dry.length, 18)
    assert.equal(short.length, 18)
    assert.equal(doubledWide.length, 18)
    assert.deepEqual(short.map(({ sourceId }) => sourceId), dry.map(({ sourceId }) => sourceId))
    assert.ok(dry.every(({ sourceId, audioUrl }) => audioUrl === `/api/dev/atmoshaper-candidates/audio/${sourceId}`))
    assert.ok(short.every(({ audioUrl }) => new RegExp(
      `^/api/dev/atmoshaper-candidates/derived/${manifest.batchId}/[a-f0-9]{64}$`,
    ).test(audioUrl)))
    assert.ok(dry.every(({ relativePath }) => relativePath.startsWith("Sci-Fi Whistles/")))
    assert.throws(
      () => owner.buildSignatureSoundTreatmentConceptSources(manifest, { variantId: "invented", sourcePaths }),
      /variant|unknown|manifest/i,
    )
  })

  it("creates exact concept-level QA instead of fabricating per-recording decisions", async () => {
    const owner = await loadOwner()
    const context = await fixture()
    const draft = owner.createSignatureSoundTreatmentConceptQaDraft({
      ...context,
      updatedAt: "2026-08-25T22:00:00.000Z",
    })
    const validated = owner.validateSignatureSoundTreatmentConceptQa(draft, context)

    assert.equal(validated.reviewKind, "treatment-concept-qa")
    assert.equal(validated.dryAuditionedAt, null)
    assert.deepEqual(Object.keys(validated.variants), [
      "short-delay",
      "medium-echo",
      "wide-dual-echo",
      "wide-dual-echo-x2",
    ])
    assert.ok(Object.values(validated.variants).every(({ outputIdentities }) => outputIdentities.length === 18))
    assert.ok(Object.values(validated.variants).every(({ decision, auditionedAt, note }) => (
      decision === null && auditionedAt === null && note === ""
    )))
    assert.equal("outputs" in validated, false)

    const drifted = structuredClone(draft)
    drifted.variants["short-delay"].outputIdentities[0] = "f".repeat(64)
    assert.throws(() => owner.validateSignatureSoundTreatmentConceptQa(drifted, context), /identity|drift|variant/i)
    const unknown = structuredClone(draft)
    unknown.variants["short-delay"].perRecordingDecision = "pass"
    assert.throws(() => owner.validateSignatureSoundTreatmentConceptQa(unknown, context), /unknown field/i)
  })

  it("requires explicit dry and treatment confirmation for Pass while retaining note-backed negatives", async () => {
    const owner = await loadOwner()
    const context = await fixture()
    const draft = owner.createSignatureSoundTreatmentConceptQaDraft({
      ...context,
      updatedAt: "2026-08-25T22:00:00.000Z",
    })
    assert.throws(() => owner.updateSignatureSoundTreatmentConceptQaVariant(draft, context, {
      variantId: "short-delay",
      decision: "pass",
      updatedAt: "2026-08-25T22:01:00.000Z",
    }), /dry|heard|audition/i)

    const dryHeard = owner.recordSignatureSoundTreatmentConceptQaAudition(draft, context, {
      targetId: "dry",
      auditionedAt: "2026-08-25T22:02:00.000Z",
    })
    const shortHeard = owner.recordSignatureSoundTreatmentConceptQaAudition(dryHeard, context, {
      targetId: "short-delay",
      auditionedAt: "2026-08-25T22:03:00.000Z",
    })
    const passed = owner.updateSignatureSoundTreatmentConceptQaVariant(shortHeard, context, {
      variantId: "short-delay",
      decision: "pass",
      updatedAt: "2026-08-25T22:04:00.000Z",
    })
    assert.equal(passed.variants["short-delay"].decision, "pass")

    const rejected = owner.updateSignatureSoundTreatmentConceptQaVariant(passed, context, {
      variantId: "medium-echo",
      note: "The repeats obscure the whistle rhythm.",
      decision: "reject",
      updatedAt: "2026-08-25T22:05:00.000Z",
    })
    assert.equal(rejected.variants["medium-echo"].decision, "reject")
    assert.throws(
      () => owner.validateSignatureSoundTreatmentConceptQa(rejected, { ...context, requireComplete: true }),
      /complete|decision/i,
    )
  })

  it("applies the exact committed Wide dual echo x2 Pass without deciding the alternatives", async () => {
    const owner = await loadOwner()
    assert.equal(typeof owner.validateSignatureSoundTreatmentConceptQaSelection, "function")
    assert.equal(typeof owner.applySignatureSoundTreatmentConceptQaSelection, "function")
    const selection = await readJson("../data/atmoshaper/signature-sound-treatment-concept-qa-batch-03-sci-fi-whistles.json")
    const context = await fixture({
      wideDualEchoX2OutputIdentities: EXPECTED_WIDE_DUAL_ECHO_X2_OUTPUT_IDENTITIES,
    })
    const draft = owner.createSignatureSoundTreatmentConceptQaDraft({
      ...context,
      updatedAt: "1970-01-01T00:00:00.000Z",
    })

    const validatedSelection = owner.validateSignatureSoundTreatmentConceptQaSelection(selection, context)
    assert.equal(validatedSelection.selectedVariantId, "wide-dual-echo-x2")
    assert.equal(validatedSelection.selectedVariantLabel, "Wide dual echo ×2")
    assert.equal(validatedSelection.decision, "pass")
    assert.deepEqual(validatedSelection.outputIdentities, EXPECTED_WIDE_DUAL_ECHO_X2_OUTPUT_IDENTITIES)

    const applied = owner.applySignatureSoundTreatmentConceptQaSelection(draft, selection, context)
    assert.equal(applied.dryAuditionedAt, "2026-08-26T00:57:47.157Z")
    assert.equal(applied.updatedAt, "2026-08-26T00:57:47.157Z")
    assert.deepEqual(applied.variants["wide-dual-echo-x2"], {
      variantId: "wide-dual-echo-x2",
      variantLabel: "Wide dual echo ×2",
      outputIdentities: EXPECTED_WIDE_DUAL_ECHO_X2_OUTPUT_IDENTITIES,
      auditionedAt: "2026-08-26T00:57:47.157Z",
      decision: "pass",
      note: "Reviewer directly selected Wide dual echo ×2 as Pass.",
    })
    assert.ok(["short-delay", "medium-echo", "wide-dual-echo"].every((variantId) => {
      const variant = applied.variants[variantId]
      return variant.auditionedAt === null && variant.decision === null && variant.note === ""
    }))

    const drifted = structuredClone(selection)
    drifted.outputIdentities[0] = "f".repeat(64)
    assert.throws(
      () => owner.validateSignatureSoundTreatmentConceptQaSelection(drifted, context),
      /identity|drift|variant/i,
    )
  })
})
