import assert from "node:assert/strict"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, it } from "node:test"

import { createSignatureSoundDiscoveryReview } from "../lib/atmoshaper/signature-sound-discovery.js"
import { scanSignatureSoundRoot } from "../lib/atmoshaper/signature-sound-scan.js"

const moodistConcepts = JSON.parse(await readFile(
  new URL("../data/atmoshaper/moodist-concepts.json", import.meta.url),
  "utf8",
))

async function loadListeningReviewModule() {
  try {
    return await import("../lib/atmoshaper/signature-sound-listening-review.js")
  } catch (error) {
    assert.fail(`Signature listening-review owner must load: ${error?.message ?? error}`)
  }
}

async function loadListeningReviewCli() {
  try {
    return await import("../scripts/atmoshaper-signature-sound-listening-review.mjs")
  } catch (error) {
    assert.fail(`Signature listening-review CLI must load: ${error?.message ?? error}`)
  }
}

async function createFixture(t) {
  const rootPath = await mkdtemp(join(tmpdir(), "ml-signature-listening-review-"))
  t.after(() => rm(rootPath, { recursive: true, force: true }))
  const files = [
    ["Snow Pack", "snow-1.wav"],
    ["Snow Pack", "snow-2.wav"],
    ["Forest Pack", "gravel-1.wav"],
    ["Forest Pack", "gravel-2.wav"],
    ["Forest Pack", "leaves-1.wav"],
    ["Horror Pack", "horror-1.wav"],
    ["Excluded Pack", "kick.wav"],
    ["Unknown Pack", "mystery.wav"],
  ]
  for (const [packName, filename] of files) {
    await mkdir(join(rootPath, packName), { recursive: true })
    await writeFile(join(rootPath, packName, filename), `${packName}/${filename}`)
  }
  const scan = await scanSignatureSoundRoot(rootPath)
  const reviews = {
    version: 1,
    reviewedOn: "2026-08-23",
    packs: [
      candidatePack("Snow Pack", ["walk-in-snow"]),
      {
        packName: "Forest Pack",
        defaultReview: excluded("Forest fixture default."),
        fileRules: [
          {
            id: "forest-gravel",
            includesAll: ["gravel"],
            review: candidate(["walk-on-gravel"], [{ id: "walk-on-stone", label: "Walk on Stone" }]),
          },
          {
            id: "forest-leaves",
            includesAll: ["leaves"],
            review: candidate(["walk-on-leaves"]),
          },
        ],
      },
      {
        packName: "Horror Pack",
        defaultReview: candidate([], [{ id: "horror-suspense", label: "Horror Suspense" }]),
        fileRules: [],
      },
      { packName: "Excluded Pack", defaultReview: excluded("Not ambient."), fileRules: [] },
      {
        packName: "Unknown Pack",
        defaultReview: {
          state: "unclassified",
          moodistConceptIds: [],
          signatureExtraConcepts: [],
          confidence: "none",
          reason: "Needs classification.",
        },
        fileRules: [],
      },
    ],
  }
  const discoveryReview = createSignatureSoundDiscoveryReview({
    scan,
    moodistConcepts,
    signatureDeclaration: { version: 1, candidates: [] },
    packReviews: reviews,
  })
  return { discoveryReview }
}

function candidatePack(packName, moodistConceptIds) {
  return { packName, defaultReview: candidate(moodistConceptIds), fileRules: [] }
}

function candidate(moodistConceptIds, signatureExtraConcepts = []) {
  return {
    state: "candidate",
    moodistConceptIds,
    signatureExtraConcepts,
    confidence: "construction",
    reason: "Listening-review fixture candidate.",
  }
}

function excluded(reason) {
  return {
    state: "excluded",
    moodistConceptIds: [],
    signatureExtraConcepts: [],
    confidence: "none",
    reason,
  }
}

function strategyPolicy() {
  return {
    version: 1,
    defaultStrategyId: "adaptive-whole-source-sequence",
    strategies: [
      {
        id: "adaptive-whole-source-sequence",
        label: "Adaptive whole-source sequence",
        sourceUnit: "whole-source",
        ordering: "shuffle-no-immediate-repeat",
        timing: "continuous",
        transitions: ["end-to-end", "crossfade", "overlap"],
        dynamic: true,
      },
      {
        id: "walking-cadence-sequence",
        label: "Walking cadence sequence",
        sourceUnit: "one-shot",
        ordering: "shuffle-no-immediate-repeat",
        timing: "walking-cadence",
        transitions: ["end-to-end", "overlap"],
        dynamic: true,
      },
    ],
    conceptOverrides: [
      override("moodist", "walk-in-snow", "walking-cadence-sequence"),
      override("moodist", "walk-on-gravel", "walking-cadence-sequence"),
      override("signature-extra", "walk-on-stone", "walking-cadence-sequence"),
      override("moodist", "walk-on-leaves", "walking-cadence-sequence"),
    ],
  }
}

function override(conceptKind, conceptId, strategyId) {
  return { conceptKind, conceptId, strategyId, reason: "Fixture strategy assignment." }
}

function exportFor(discoveryReview) {
  const byPath = new Map(discoveryReview.sources.map((source) => [source.relativePath, source]))
  return {
    version: 1,
    reviewFingerprint: discoveryReview.fingerprints.reviewSha256,
    updatedAt: "2026-08-23T19:30:00.000Z",
    decisions: {
      [byPath.get("Snow Pack/snow-1.wav").sourceId]: { decision: "keep", note: "Clean step." },
      [byPath.get("Snow Pack/snow-2.wav").sourceId]: { decision: "maybe", note: "Use in cadence context." },
      [byPath.get("Forest Pack/gravel-1.wav").sourceId]: { decision: "reject", note: "Do not use this recording." },
      [byPath.get("Forest Pack/leaves-1.wav").sourceId]: { decision: "reject", note: "This source is unsuitable." },
      [byPath.get("Horror Pack/horror-1.wav").sourceId]: { note: "Assess with the whole group." },
    },
  }
}

describe("Signature Sounds listening-review curation", () => {
  it("exposes closed strategy, curation, and renderer owners", async () => {
    const owner = await loadListeningReviewModule()
    assert.equal(typeof owner.validateSignatureSoundPlaybackStrategies, "function")
    assert.equal(typeof owner.createSignatureSoundListeningReview, "function")
    assert.equal(typeof owner.validateSignatureSoundListeningReview, "function")
    assert.equal(typeof owner.renderSignatureSoundListeningReviewJson, "function")
  })

  it("preserves explicit decisions and turns only unmarked proposed sources into contextual Maybe", async (t) => {
    const { createSignatureSoundListeningReview } = await loadListeningReviewModule()
    const { discoveryReview } = await createFixture(t)
    const result = createSignatureSoundListeningReview({
      discoveryReview,
      moodistConcepts,
      exportedReview: exportFor(discoveryReview),
      strategyPolicy: strategyPolicy(),
    })

    assert.deepEqual(result.summary, {
      candidateSourceCount: 6,
      explicitKeepCount: 1,
      explicitMaybeCount: 1,
      explicitRejectCount: 2,
      contextualMaybeCount: 2,
      activeSourceCount: 4,
      sourceDecisionCount: 6,
      activeGroupCount: 5,
      zeroIngredientGroupCount: 1,
    })
    assert.equal(result.decisions.length, 6)
    assert.equal(result.decisions.filter(({ origin }) => origin === "contextual-unmarked").length, 2)
    assert.ok(result.decisions.every(({ sourceId }) => (
      discoveryReview.sources.find((source) => source.sourceId === sourceId)?.reviewState === "candidate"
    )))
    assert.ok(!result.decisions.some(({ sourceId }) => (
      discoveryReview.sources.find((source) => source.sourceId === sourceId)?.reviewState !== "candidate"
    )))
  })

  it("keeps an explicitly rejected recording out while its concept group stays active", async (t) => {
    const { createSignatureSoundListeningReview } = await loadListeningReviewModule()
    const { discoveryReview } = await createFixture(t)
    const result = createSignatureSoundListeningReview({
      discoveryReview,
      moodistConcepts,
      exportedReview: exportFor(discoveryReview),
      strategyPolicy: strategyPolicy(),
    })
    const gravel = result.groups.find(({ groupId }) => groupId === "moodist:walk-on-gravel")
    assert.equal(gravel.status, "active")
    assert.deepEqual(gravel.sourceCounts, { total: 2, keep: 0, maybe: 1, reject: 1 })
    assert.equal(gravel.strategyId, "walking-cadence-sequence")

    const leaves = result.groups.find(({ groupId }) => groupId === "moodist:walk-on-leaves")
    assert.equal(leaves.status, "active")
    assert.deepEqual(leaves.sourceCounts, { total: 1, keep: 0, maybe: 0, reject: 1 })
  })

  it("uses concept overrides and a dynamic fallback without any deferred state", async (t) => {
    const { createSignatureSoundListeningReview } = await loadListeningReviewModule()
    const { discoveryReview } = await createFixture(t)
    const result = createSignatureSoundListeningReview({
      discoveryReview,
      moodistConcepts,
      exportedReview: exportFor(discoveryReview),
      strategyPolicy: strategyPolicy(),
    })
    assert.equal(result.policy.playbackMode, "dynamic")
    assert.equal(result.policy.explicitRejectScope, "source-only")
    assert.equal(result.policy.unmarkedCandidateDecision, "maybe")
    assert.equal(result.groups.find(({ groupId }) => groupId === "signature-extra:horror-suspense").strategyId, "adaptive-whole-source-sequence")
    assert.ok(result.strategies.every(({ dynamic }) => dynamic))
    assert.doesNotMatch(JSON.stringify(result), /defer/i)
  })

  it("rejects mismatched fingerprints, unknown sources, non-candidates, and malformed decisions", async (t) => {
    const { createSignatureSoundListeningReview } = await loadListeningReviewModule()
    const { discoveryReview } = await createFixture(t)
    const validExport = exportFor(discoveryReview)
    const excludedSource = discoveryReview.sources.find(({ reviewState }) => reviewState === "excluded")
    const invalidExports = [
      { ...validExport, reviewFingerprint: "f".repeat(64) },
      { ...validExport, unknown: true },
      { ...validExport, decisions: { ...validExport.decisions, ["a".repeat(64)]: { decision: "keep", note: "Unknown." } } },
      { ...validExport, decisions: { ...validExport.decisions, [excludedSource.sourceId]: { decision: "keep", note: "No." } } },
      { ...validExport, decisions: { ...validExport.decisions, [Object.keys(validExport.decisions)[0]]: { decision: "later", note: "No." } } },
    ]
    for (const exportedReview of invalidExports) {
      assert.throws(() => createSignatureSoundListeningReview({
        discoveryReview,
        moodistConcepts,
        exportedReview,
        strategyPolicy: strategyPolicy(),
      }), /fingerprint|unknown|candidate|decision|field|source/i)
    }
  })

  it("rejects non-dynamic strategies, unknown overrides, and closed-schema drift", async (t) => {
    const { createSignatureSoundListeningReview } = await loadListeningReviewModule()
    const { discoveryReview } = await createFixture(t)
    const validPolicy = strategyPolicy()
    const invalidPolicies = [
      { ...validPolicy, unknown: true },
      { ...validPolicy, strategies: validPolicy.strategies.map((strategy, index) => index === 0 ? { ...strategy, dynamic: false } : strategy) },
      { ...validPolicy, conceptOverrides: [...validPolicy.conceptOverrides, override("signature-extra", "absent", "adaptive-whole-source-sequence")] },
      { ...validPolicy, conceptOverrides: [...validPolicy.conceptOverrides, override("moodist", "walk-in-snow", "missing-strategy")] },
    ]
    for (const strategyPolicy of invalidPolicies) {
      assert.throws(() => createSignatureSoundListeningReview({
        discoveryReview,
        moodistConcepts,
        exportedReview: exportFor(discoveryReview),
        strategyPolicy,
      }), /unknown|dynamic|strategy|override|field|concept/i)
    }
  })

  it("is deterministic, copy-safe, fingerprinted, and closed at its consumer boundary", async (t) => {
    const {
      createSignatureSoundListeningReview,
      renderSignatureSoundListeningReviewJson,
      validateSignatureSoundListeningReview,
    } = await loadListeningReviewModule()
    const { discoveryReview } = await createFixture(t)
    const input = {
      discoveryReview,
      moodistConcepts,
      exportedReview: exportFor(discoveryReview),
      strategyPolicy: strategyPolicy(),
    }
    const first = createSignatureSoundListeningReview(input)
    const second = createSignatureSoundListeningReview(input)
    assert.deepEqual(second, first)
    assert.deepEqual(validateSignatureSoundListeningReview(first, input), first)
    assert.equal(renderSignatureSoundListeningReviewJson(first, input), `${JSON.stringify(first, null, 2)}\n`)
    assert.deepEqual(Object.keys(first.fingerprints).sort(), [
      "curationSha256", "discoveryReviewSha256", "exportedReviewSha256", "strategyPolicySha256",
    ])
    const mutated = validateSignatureSoundListeningReview(first, input)
    mutated.decisions[0].note = "changed"
    assert.notEqual(validateSignatureSoundListeningReview(first, input).decisions[0].note, "changed")
    assert.throws(() => validateSignatureSoundListeningReview({ ...first, unknown: true }, input), /unknown|field/i)
  })

  it("commits the confirmed dynamic strategy families and concept assignments", async () => {
    const { validateSignatureSoundPlaybackStrategies } = await loadListeningReviewModule()
    const rawPolicy = JSON.parse(await readFile(
      new URL("../data/atmoshaper/signature-sound-playback-strategies.json", import.meta.url),
      "utf8",
    ))
    const policy = validateSignatureSoundPlaybackStrategies(rawPolicy)
    assert.equal(policy.defaultStrategyId, "adaptive-whole-source-sequence")
    const assignments = new Map(policy.conceptOverrides.map((entry) => [
      `${entry.conceptKind}:${entry.conceptId}`,
      entry.strategyId,
    ]))
    for (const groupId of [
      "moodist:walk-in-snow",
      "moodist:walk-on-gravel",
      "signature-extra:walk-on-stone",
      "signature-extra:moon-footsteps",
    ]) {
      assert.equal(assignments.get(groupId), "walking-cadence-sequence")
    }
    assert.equal(assignments.get("signature-extra:keys-jingling"), "adaptive-one-shot-sequence")
    assert.equal(assignments.get("signature-extra:sci-fi-whistles"), "spaced-event-sequence")
    assert.equal(assignments.get("signature-extra:horror-suspense"), "adaptive-one-shot-sequence")
    assert.equal(assignments.get("moodist:walk-on-leaves"), "walking-cadence-sequence")
    assert.equal(assignments.get("moodist:underwater"), "adaptive-one-shot-sequence")
    assert.equal(assignments.get("signature-extra:underwater-effects"), "adaptive-one-shot-sequence")
    for (const groupId of [
      "moodist:crowd",
      "moodist:waves",
      "signature-extra:stadium-crowd",
      "signature-extra:crowd-walla",
      "signature-extra:beach-ambience",
      "signature-extra:light-waves",
    ]) {
      assert.equal(assignments.get(groupId), "adaptive-whole-source-sequence")
    }
    assert.doesNotMatch(JSON.stringify(policy), /defer/i)
  })

  it("imports an external export only to the fixed atomic repository destination", async (t) => {
    const { runSignatureSoundListeningReviewCli } = await loadListeningReviewCli()
    const { discoveryReview } = await createFixture(t)
    const repoRoot = await mkdtemp(join(tmpdir(), "ml-signature-listening-repo-"))
    const exportRoot = await mkdtemp(join(tmpdir(), "ml-signature-listening-export-"))
    t.after(() => rm(repoRoot, { recursive: true, force: true }))
    t.after(() => rm(exportRoot, { recursive: true, force: true }))
    const exportPath = join(exportRoot, "review.json")
    await writeFile(exportPath, `${JSON.stringify(exportFor(discoveryReview), null, 2)}\n`)
    let stdout = ""
    const exitCode = await runSignatureSoundListeningReviewCli({
      args: [exportPath],
      repoRoot,
      discoveryReview,
      moodistConcepts,
      strategyPolicy: strategyPolicy(),
      stdout: (value) => { stdout += value },
    })
    assert.equal(exitCode, 0)
    const outputPath = join(repoRoot, "data", "atmoshaper", "signature-sound-listening-review.json")
    const first = await readFile(outputPath, "utf8")
    assert.equal(first, stdout)
    assert.doesNotMatch(first, new RegExp(exportRoot.replaceAll("\\", "\\\\"), "i"))
    await runSignatureSoundListeningReviewCli({
      args: [exportPath],
      repoRoot,
      discoveryReview,
      moodistConcepts,
      strategyPolicy: strategyPolicy(),
      stdout: () => {},
    })
    assert.equal(await readFile(outputPath, "utf8"), first)
  })

  it("provides a named repository import command", async () => {
    const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"))
    assert.equal(
      packageJson.scripts["atmoshaper:sounds:curate-review"],
      "node scripts/atmoshaper-signature-sound-listening-review.mjs",
    )
  })

  it("reconciles the committed real curation with every proposed source and active group", async () => {
    const discovery = JSON.parse(await readFile(
      new URL("../data/atmoshaper/signature-sound-review.json", import.meta.url),
      "utf8",
    ))
    const curation = JSON.parse(await readFile(
      new URL("../data/atmoshaper/signature-sound-listening-review.json", import.meta.url),
      "utf8",
    ))
    assert.equal(curation.fingerprints.discoveryReviewSha256, discovery.fingerprints.reviewSha256)
    assert.deepEqual(curation.summary, {
      candidateSourceCount: 926,
      explicitKeepCount: 354,
      explicitMaybeCount: 113,
      explicitRejectCount: 360,
      contextualMaybeCount: 99,
      activeSourceCount: 566,
      sourceDecisionCount: 926,
      activeGroupCount: 93,
      zeroIngredientGroupCount: 7,
    })
    const candidateIds = discovery.sources
      .filter(({ reviewState }) => reviewState === "candidate")
      .map(({ sourceId }) => sourceId)
      .sort()
    assert.deepEqual(curation.decisions.map(({ sourceId }) => sourceId).sort(), candidateIds)
    assert.ok(curation.groups.every((group) => group.status === "active"))
    assert.ok(curation.strategies.every((strategy) => strategy.dynamic === true))
    const gravel = curation.groups.find(({ groupId }) => groupId === "moodist:walk-on-gravel")
    assert.equal(gravel.strategyId, "walking-cadence-sequence")
    assert.deepEqual(gravel.sourceCounts, { total: 246, keep: 0, maybe: 60, reject: 186 })
    const atmosphere19 = discovery.sources.find(({ relativePath }) => relativePath.endsWith("Atmospheres19.wav"))
    const atmosphereDecision = curation.decisions.find(({ sourceId }) => sourceId === atmosphere19.sourceId)
    assert.equal(atmosphereDecision.decision, "maybe")
    assert.equal(atmosphereDecision.origin, "contextual-unmarked")
    assert.match(atmosphereDecision.note, /cicadas/i)
    assert.doesNotMatch(JSON.stringify(curation), /[A-Z]:\\Users\\/i)
    assert.doesNotMatch(JSON.stringify(curation), /defer/i)
  })
})
