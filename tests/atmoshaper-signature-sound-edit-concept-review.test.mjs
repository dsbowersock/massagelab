import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

import {
  planSignatureSoundEditAuditionBatch,
  validateSignatureSoundEditAuditionBatch,
} from "../lib/atmoshaper/signature-sound-edit-audition.js"

async function readJson(relativePath) {
  return JSON.parse(await readFile(new URL(relativePath, import.meta.url), "utf8"))
}

async function loadOwner() {
  try {
    return await import("../lib/atmoshaper/signature-sound-edit-concept-review.js")
  } catch (error) {
    assert.fail(`Edit concept-review owner must load: ${error?.message ?? error}`)
  }
}

async function fixture() {
  const [declaration, constructionReview, discoveryReview] = await Promise.all([
    readJson("../data/atmoshaper/signature-sound-derived-audio-batch-04-boiling-water-edit-audition.json"),
    readJson("../data/atmoshaper/signature-sound-construction-review.json"),
    readJson("../data/atmoshaper/signature-sound-review.json"),
  ])
  const batch = validateSignatureSoundEditAuditionBatch(declaration, {
    constructionReview,
    discoveryReview,
  })
  const source = batch.sources[0]
  const plan = planSignatureSoundEditAuditionBatch(batch, {
    version: 1,
    batchDeclarationSha256: batch.batchDeclarationSha256,
    toolVersion: "ffmpeg version 9.0-full_build-www.gyan.dev",
    sources: {
      [source.sourceId]: {
        durationSeconds: 143.18356,
        integratedLoudnessLufs: -31.2,
        truePeakDbtp: -4.1,
        sampleRateHz: 44100,
        channels: 2,
      },
    },
  })
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
      variantId: output.variantId,
      variantLabel: output.variantLabel,
      outputIdentity: output.outputIdentity,
    })),
  }
  const group = constructionReview.groups.find(({ groupId }) => groupId === plan.groupId)
  assert.ok(group)
  return {
    manifest,
    manifestSha256: createHash("sha256").update(JSON.stringify(manifest)).digest("hex"),
    playbackConfiguration: group.playback,
  }
}

describe("AtmoShaper Signature edit concept review", () => {
  it("creates closed undecided QA bound to the exact batch, outputs, and construction playback", async () => {
    const owner = await loadOwner()
    const context = await fixture()
    const draft = owner.createSignatureSoundEditConceptQaDraft({
      ...context,
      updatedAt: "2026-08-26T02:00:00.000Z",
    })
    const validated = owner.validateSignatureSoundEditConceptQa(draft, context)

    assert.equal(validated.reviewKind, "edit-concept-qa")
    assert.equal(validated.batchId, "batch-04-boiling-water-edit-audition")
    assert.equal(validated.groupId, "moodist:boiling-water")
    assert.equal(validated.dryAuditionedAt, null)
    assert.deepEqual(validated.playbackConfiguration, {
      strategyId: "adaptive-whole-source-sequence",
      previewSettings: { transitionMode: "crossfade", transitionSeconds: 2 },
      minimumSelectionsBeforeRepeat: null,
      constraints: [],
    })
    assert.deepEqual(Object.keys(validated.variants), ["short-seam", "medium-seam", "long-seam"])
    assert.equal(new Set(Object.values(validated.variants).map(({ outputIdentity }) => outputIdentity)).size, 3)
    assert.ok(Object.values(validated.variants).every((variant) => (
      variant.decision === "undecided" && variant.auditionedAt === null &&
      variant.endToStartSeamCrossings.length === 0 && variant.note === ""
    )))

    const unknown = structuredClone(draft)
    unknown.fabricated = true
    assert.throws(() => owner.validateSignatureSoundEditConceptQa(unknown, context), /unknown field/i)
    const drifted = structuredClone(draft)
    drifted.variants["short-seam"].outputIdentity = "f".repeat(64)
    assert.throws(() => owner.validateSignatureSoundEditConceptQa(drifted, context), /identity|drift/i)
    const playbackDrift = structuredClone(draft)
    playbackDrift.playbackConfiguration.previewSettings.transitionSeconds = 4
    assert.throws(() => owner.validateSignatureSoundEditConceptQa(playbackDrift, context), /playback|drift/i)
  })

  it("requires dry, candidate, and two exact seam crossings before Pass", async () => {
    const owner = await loadOwner()
    const context = await fixture()
    const draft = owner.createSignatureSoundEditConceptQaDraft({
      ...context,
      updatedAt: "2026-08-26T02:00:00.000Z",
    })
    const tryPass = (qa, updatedAt) => owner.updateSignatureSoundEditConceptQaVariant(qa, context, {
      variantId: "short-seam",
      decision: "pass",
      updatedAt,
    })

    assert.throws(() => tryPass(draft, "2026-08-26T02:01:00.000Z"), /dry|audition/i)
    const dryHeard = owner.recordSignatureSoundEditConceptQaAudition(draft, context, {
      targetId: "dry",
      auditionedAt: "2026-08-26T02:02:00.000Z",
    })
    assert.throws(() => tryPass(dryHeard, "2026-08-26T02:03:00.000Z"), /candidate|audition/i)
    const candidateHeard = owner.recordSignatureSoundEditConceptQaAudition(dryHeard, context, {
      targetId: "short-seam",
      auditionedAt: "2026-08-26T02:04:00.000Z",
    })
    assert.throws(() => tryPass(candidateHeard, "2026-08-26T02:05:00.000Z"), /two|2|crossing/i)
    const crossedOnce = owner.recordSignatureSoundEditConceptQaSeamCrossing(candidateHeard, context, {
      variantId: "short-seam",
      crossedAt: "2026-08-26T02:06:00.000Z",
    })
    assert.throws(() => tryPass(crossedOnce, "2026-08-26T02:07:00.000Z"), /two|2|crossing/i)
    const crossedTwice = owner.recordSignatureSoundEditConceptQaSeamCrossing(crossedOnce, context, {
      variantId: "short-seam",
      crossedAt: "2026-08-26T02:08:00.000Z",
    })
    const passed = tryPass(crossedTwice, "2026-08-26T02:09:00.000Z")

    assert.equal(passed.variants["short-seam"].decision, "pass")
    assert.deepEqual(passed.variants["short-seam"].endToStartSeamCrossings, [
      "2026-08-26T02:06:00.000Z",
      "2026-08-26T02:08:00.000Z",
    ])
    assert.equal(passed.variants["medium-seam"].decision, "undecided")
    assert.equal(passed.variants["long-seam"].decision, "undecided")
  })

  it("applies the exact reviewer-selected 8-second crossfade without inventing playback telemetry", async () => {
    const owner = await loadOwner()
    const selection = await readJson(
      "../data/atmoshaper/signature-sound-edit-concept-qa-batch-04-boiling-water.json",
    )
    const context = { ...await fixture(), manifestSha256: selection.manifestSha256 }
    const validatedSelection = owner.validateSignatureSoundEditConceptQaSelection(selection, context)
    const draft = owner.createSignatureSoundEditConceptQaDraft({
      ...context,
      updatedAt: "1970-01-01T00:00:00.000Z",
    })
    const applied = owner.applySignatureSoundEditConceptQaSelection(draft, selection, context)

    assert.equal(validatedSelection.selectedVariantId, "long-seam")
    assert.equal(validatedSelection.selectedVariantLabel, "Long 8-second crossfade")
    assert.equal(
      validatedSelection.outputIdentity,
      "d63ea4082951404502d5d48c3fdfc2df6af907ca897c06f95956f52b0b96bf04",
    )
    assert.equal(validatedSelection.decision, "pass")
    assert.deepEqual(applied.directSelection, validatedSelection)
    assert.equal(applied.dryAuditionedAt, null)
    assert.deepEqual(applied.variants["long-seam"], {
      variantId: "long-seam",
      variantLabel: "Long 8-second crossfade",
      outputIdentity: "d63ea4082951404502d5d48c3fdfc2df6af907ca897c06f95956f52b0b96bf04",
      auditionedAt: null,
      endToStartSeamCrossings: [],
      decision: "pass",
      note: "Reviewer directly selected the 8-second crossfade as Pass.",
    })
    assert.ok(["short-seam", "medium-seam"].every((variantId) => (
      applied.variants[variantId].decision === "undecided" &&
      applied.variants[variantId].auditionedAt === null &&
      applied.variants[variantId].endToStartSeamCrossings.length === 0
    )))

    const drifted = structuredClone(selection)
    drifted.outputIdentity = "f".repeat(64)
    assert.throws(
      () => owner.validateSignatureSoundEditConceptQaSelection(drifted, context),
      /identity|drift/i,
    )

    const laterLocalDraft = owner.updateSignatureSoundEditConceptQaVariant(
      owner.createSignatureSoundEditConceptQaDraft({
        ...context,
        updatedAt: "2026-08-26T02:40:00.000Z",
      }),
      context,
      {
        variantId: "short-seam",
        note: "Retain this later local comparison note.",
        updatedAt: "2026-08-26T02:41:00.000Z",
      },
    )
    const merged = owner.applySignatureSoundEditConceptQaSelection(laterLocalDraft, selection, context)
    assert.equal(merged.updatedAt, "2026-08-26T02:41:00.000Z")
    assert.equal(merged.variants["short-seam"].note, "Retain this later local comparison note.")
    assert.equal(merged.variants["long-seam"].decision, "pass")
  })

  it("keeps completed candidates intact during unrelated playback and permits note-backed negatives", async () => {
    const owner = await loadOwner()
    const context = await fixture()
    let qa = owner.createSignatureSoundEditConceptQaDraft({
      ...context,
      updatedAt: "2026-08-26T02:00:00.000Z",
    })
    qa = owner.recordSignatureSoundEditConceptQaAudition(qa, context, {
      targetId: "dry", auditionedAt: "2026-08-26T02:01:00.000Z",
    })
    qa = owner.recordSignatureSoundEditConceptQaAudition(qa, context, {
      targetId: "short-seam", auditionedAt: "2026-08-26T02:02:00.000Z",
    })
    qa = owner.recordSignatureSoundEditConceptQaSeamCrossing(qa, context, {
      variantId: "short-seam", crossedAt: "2026-08-26T02:03:00.000Z",
    })
    qa = owner.recordSignatureSoundEditConceptQaSeamCrossing(qa, context, {
      variantId: "short-seam", crossedAt: "2026-08-26T02:04:00.000Z",
    })
    qa = owner.updateSignatureSoundEditConceptQaVariant(qa, context, {
      variantId: "short-seam", decision: "pass", updatedAt: "2026-08-26T02:05:00.000Z",
    })
    const completed = structuredClone(qa.variants["short-seam"])

    qa = owner.recordSignatureSoundEditConceptQaAudition(qa, context, {
      targetId: "medium-seam", auditionedAt: "2026-08-26T02:06:00.000Z",
    })
    assert.deepEqual(qa.variants["short-seam"], completed)
    qa = owner.updateSignatureSoundEditConceptQaVariant(qa, context, {
      variantId: "medium-seam",
      decision: "change",
      note: "The boundary still pulses.",
      updatedAt: "2026-08-26T02:07:00.000Z",
    })
    qa = owner.updateSignatureSoundEditConceptQaVariant(qa, context, {
      variantId: "long-seam",
      decision: "reject",
      note: "The seam smears too much of the boil.",
      updatedAt: "2026-08-26T02:08:00.000Z",
    })

    assert.deepEqual(qa.variants["short-seam"], completed)
    assert.equal(qa.variants["medium-seam"].decision, "change")
    assert.equal(qa.variants["long-seam"].decision, "reject")
    const emptyNegative = owner.createSignatureSoundEditConceptQaDraft({
      ...context,
      updatedAt: "2026-08-26T02:09:00.000Z",
    })
    assert.throws(() => owner.updateSignatureSoundEditConceptQaVariant(emptyNegative, context, {
      variantId: "long-seam",
      decision: "reject",
      updatedAt: "2026-08-26T02:10:00.000Z",
    }), /note|audition/i)
  })

  it("exports and imports one deterministic closed document", async () => {
    const owner = await loadOwner()
    const context = await fixture()
    const draft = owner.createSignatureSoundEditConceptQaDraft({
      ...context,
      updatedAt: "2026-08-26T02:00:00.000Z",
    })

    const first = owner.exportSignatureSoundEditConceptQa(draft, context)
    const second = owner.exportSignatureSoundEditConceptQa(draft, context)
    assert.equal(second, first)
    assert.ok(first.endsWith("\n"))
    assert.deepEqual(owner.parseSignatureSoundEditConceptQaJson(first, context), draft)

    const unknown = JSON.parse(first)
    unknown.variants["short-seam"].playbackCount = 2
    assert.throws(
      () => owner.parseSignatureSoundEditConceptQaJson(JSON.stringify(unknown), context),
      /unknown field/i,
    )
    assert.throws(() => owner.parseSignatureSoundEditConceptQaJson("{", context), /JSON|parse/i)
  })
})
