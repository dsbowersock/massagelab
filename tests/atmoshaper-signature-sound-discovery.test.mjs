import assert from "node:assert/strict"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { describe, it } from "node:test"

import { scanSignatureSoundRoot } from "../lib/atmoshaper/signature-sound-scan.js"

const moodistConcepts = JSON.parse(await readFile(
  new URL("../data/atmoshaper/moodist-concepts.json", import.meta.url),
  "utf8",
))

async function loadDiscoveryModule() {
  try {
    return await import("../lib/atmoshaper/signature-sound-discovery.js")
  } catch (error) {
    assert.fail(`Signature sound discovery owner must load: ${error?.message ?? error}`)
  }
}

async function loadDiscoveryCli() {
  try {
    return await import("../scripts/atmoshaper-signature-sound-discovery.mjs")
  } catch (error) {
    assert.fail(`Signature sound discovery CLI must load: ${error?.message ?? error}`)
  }
}

async function createFixture(t) {
  const rootPath = await mkdtemp(join(tmpdir(), "ml-signature-discovery-"))
  t.after(() => rm(rootPath, { recursive: true, force: true }))
  const files = [
    ["Snow Pack", "snow-step.wav", "snow-step"],
    ["Snow Pack", "snow-trail.wav", "snow-trail"],
    ["Mixed Pack", "train interior.wav", "train-interior"],
    ["Mixed Pack", "drum.wav", "drum"],
    ["Extra Pack", "cave.wav", "cave"],
    ["Excluded Pack", "kick.wav", "kick"],
  ]
  for (const [packName, filename, contents] of files) {
    await mkdir(join(rootPath, packName), { recursive: true })
    await writeFile(join(rootPath, packName, filename), contents)
  }
  return { rootPath, scan: await scanSignatureSoundRoot(rootPath) }
}

function review({
  state,
  moodistConceptIds = [],
  signatureExtraConcepts = [],
  confidence = "none",
  reason,
}) {
  return { state, moodistConceptIds, signatureExtraConcepts, confidence, reason }
}

function packReviews() {
  return {
    version: 1,
    reviewedOn: "2026-08-23",
    packs: [
      {
        packName: "Snow Pack",
        defaultReview: review({
          state: "candidate",
          moodistConceptIds: ["walk-in-snow"],
          confidence: "direct",
          reason: "Dedicated snow footsteps pack.",
        }),
        fileRules: [],
      },
      {
        packName: "Mixed Pack",
        defaultReview: review({ state: "unclassified", reason: "Mixed material needs individual review." }),
        fileRules: [
          {
            id: "mixed-train-interior",
            includesAll: ["train interior"],
            review: review({
              state: "candidate",
              moodistConceptIds: ["inside-a-train"],
              confidence: "direct",
              reason: "Filename explicitly identifies a train interior.",
            }),
          },
        ],
      },
      {
        packName: "Extra Pack",
        defaultReview: review({
          state: "candidate",
          signatureExtraConcepts: [{ id: "cave-room-tone", label: "Cave Room Tone" }],
          confidence: "semantic",
          reason: "Useful Signature-only ambience.",
        }),
        fileRules: [],
      },
      {
        packName: "Excluded Pack",
        defaultReview: review({ state: "excluded", reason: "Musical kick one-shot, not ambient source material." }),
        fileRules: [],
      },
    ],
  }
}

function signatureDeclaration() {
  return {
    version: 1,
    candidates: [{
      id: "snow-declared-candidate",
      moodistConceptId: "walk-in-snow",
      discoveryPath: "Snow Pack/snow-step.wav",
      evidenceTier: "signature-sitewide-cc0",
      evidenceRef: "https://signaturesounds.org/about-",
      technicalState: "pending",
      listeningState: "pending",
      processingState: "pending",
      rejectionState: "active",
      rejectionReason: null,
    }],
  }
}

describe("Signature Sounds exhaustive discovery", () => {
  it("exposes the closed review validator, exhaustive discovery builder, and JSON renderer", async () => {
    const discovery = await loadDiscoveryModule()
    assert.equal(typeof discovery.validateSignatureSoundPackReviews, "function")
    assert.equal(typeof discovery.createSignatureSoundDiscoveryReview, "function")
    assert.equal(typeof discovery.validateSignatureSoundDiscoveryReview, "function")
    assert.equal(typeof discovery.renderSignatureSoundDiscoveryJson, "function")
  })

  it("partitions every scanned source exactly once and preserves proposed mappings", async (t) => {
    const { createSignatureSoundDiscoveryReview } = await loadDiscoveryModule()
    const { scan } = await createFixture(t)
    const result = createSignatureSoundDiscoveryReview({
      scan,
      moodistConcepts,
      signatureDeclaration: signatureDeclaration(),
      packReviews: packReviews(),
    })

    assert.equal(result.summary.reviewedPackCount, 4)
    assert.equal(result.summary.audioCount, 6)
    assert.equal(result.summary.candidateSourceCount, 4)
    assert.equal(result.summary.excludedSourceCount, 1)
    assert.equal(result.summary.unclassifiedSourceCount, 1)
    assert.equal(result.sources.length, 6)
    assert.equal(new Set(result.sources.map(({ sourceId }) => sourceId)).size, 6)
    assert.equal(new Set(result.sources.map(({ relativePath }) => relativePath)).size, 6)

    const snow = result.sources.find(({ relativePath }) => relativePath === "Snow Pack/snow-step.wav")
    assert.deepEqual(snow.moodistConcepts.map(({ id }) => id), ["walk-in-snow"])
    assert.deepEqual(snow.declaredCandidateIds, ["snow-declared-candidate"])
    assert.equal(snow.reviewState, "candidate")

    const train = result.sources.find(({ relativePath }) => relativePath.endsWith("train interior.wav"))
    assert.deepEqual(train.moodistConcepts.map(({ id }) => id), ["inside-a-train"])
    assert.equal(train.confidence, "direct")

    const cave = result.sources.find(({ relativePath }) => relativePath.endsWith("cave.wav"))
    assert.deepEqual(cave.signatureExtraConcepts, [{ id: "cave-room-tone", label: "Cave Room Tone" }])
  })

  it("requires one and only one explicit review for every top-level pack", async (t) => {
    const { createSignatureSoundDiscoveryReview } = await loadDiscoveryModule()
    const { scan } = await createFixture(t)
    const valid = packReviews()
    for (const invalid of [
      { ...valid, packs: valid.packs.slice(1) },
      { ...valid, packs: [...valid.packs, valid.packs[0]] },
      { ...valid, packs: [...valid.packs, { ...valid.packs[0], packName: "Absent Pack" }] },
    ]) {
      assert.throws(() => createSignatureSoundDiscoveryReview({
        scan,
        moodistConcepts,
        signatureDeclaration: signatureDeclaration(),
        packReviews: invalid,
      }), /pack|review|missing|duplicate|absent|extra/i)
    }
  })

  it("retains explicit reviews for source-empty top-level packs", async (t) => {
    const { createSignatureSoundDiscoveryReview } = await loadDiscoveryModule()
    const fixture = await createFixture(t)
    await mkdir(join(fixture.rootPath, "Empty Pack"))
    const scan = await scanSignatureSoundRoot(fixture.rootPath)
    const reviews = packReviews()
    reviews.packs.push({
      packName: "Empty Pack",
      defaultReview: review({ state: "excluded", reason: "Pack contains no reviewable audio files." }),
      fileRules: [],
    })
    const result = createSignatureSoundDiscoveryReview({
      scan,
      moodistConcepts,
      signatureDeclaration: signatureDeclaration(),
      packReviews: reviews,
    })
    assert.equal(result.summary.reviewedPackCount, 5)
    assert.equal(result.summary.audioCount, 6)
  })

  it("uses the scanner's punctuation-stable source ordering", async (t) => {
    const { createSignatureSoundDiscoveryReview } = await loadDiscoveryModule()
    const rootPath = await mkdtemp(join(tmpdir(), "ml-signature-order-"))
    t.after(() => rm(rootPath, { recursive: true, force: true }))
    await mkdir(join(rootPath, "Pack"))
    await writeFile(join(rootPath, "Pack", "Card Playing F2-15_4.wav"), "one")
    await writeFile(join(rootPath, "Pack", "Card Playing F2-1_7.wav"), "two")
    const scan = await scanSignatureSoundRoot(rootPath)
    const result = createSignatureSoundDiscoveryReview({
      scan,
      moodistConcepts,
      signatureDeclaration: { version: 1, candidates: [] },
      packReviews: {
        version: 1,
        reviewedOn: "2026-08-23",
        packs: [{
          packName: "Pack",
          defaultReview: review({ state: "excluded", reason: "Ordering fixture." }),
          fileRules: [],
        }],
      },
    })
    assert.deepEqual(result.sources.map(({ relativePath }) => relativePath), scan.audioFiles.map(({ relativePath }) => relativePath))
  })

  it("rejects unknown fields, invalid review combinations, and noncanonical concepts", async () => {
    const { validateSignatureSoundPackReviews } = await loadDiscoveryModule()
    const valid = packReviews()
    const invalidDeclarations = [
      { ...valid, unknown: true },
      { ...valid, packs: [{ ...valid.packs[0], unknown: true }, ...valid.packs.slice(1)] },
      { ...valid, packs: [{ ...valid.packs[0], defaultReview: { ...valid.packs[0].defaultReview, moodistConceptIds: ["not-canonical"] } }, ...valid.packs.slice(1)] },
      { ...valid, packs: [{ ...valid.packs[0], defaultReview: { ...valid.packs[0].defaultReview, state: "excluded" } }, ...valid.packs.slice(1)] },
      { ...valid, packs: [{ ...valid.packs[0], fileRules: [{ ...valid.packs[0].fileRules[0], id: "bad id" }] }, ...valid.packs.slice(1)] },
    ]
    for (const invalid of invalidDeclarations) {
      assert.throws(() => validateSignatureSoundPackReviews(invalid, moodistConcepts), /unknown|canonical|candidate|excluded|id|field|concept/i)
    }
  })

  it("is deterministic, fingerprints every input, and validates its own closed output", async (t) => {
    const {
      createSignatureSoundDiscoveryReviewFingerprint,
      createSignatureSoundDiscoveryReview,
      renderSignatureSoundDiscoveryJson,
      validateSignatureSoundDiscoveryReview,
    } = await loadDiscoveryModule()
    const { scan } = await createFixture(t)
    const input = {
      scan,
      moodistConcepts,
      signatureDeclaration: signatureDeclaration(),
      packReviews: packReviews(),
    }
    const first = createSignatureSoundDiscoveryReview(input)
    const second = createSignatureSoundDiscoveryReview(input)
    assert.deepEqual(second, first)
    assert.equal(
      createSignatureSoundDiscoveryReviewFingerprint(first),
      first.fingerprints.reviewSha256,
    )
    assert.deepEqual(validateSignatureSoundDiscoveryReview(first, moodistConcepts), first)
    assert.equal(renderSignatureSoundDiscoveryJson(first), `${JSON.stringify(first, null, 2)}\n`)
    assert.deepEqual(Object.keys(first.fingerprints).sort(), [
      "moodistSha256", "packReviewsSha256", "reviewSha256", "scanSha256", "signatureDeclarationSha256",
    ])

    const changed = createSignatureSoundDiscoveryReview({
      ...input,
      packReviews: {
        ...input.packReviews,
        packs: input.packReviews.packs.map((pack, index) => index === 0
          ? { ...pack, defaultReview: { ...pack.defaultReview, reason: `${pack.defaultReview.reason} Rechecked.` } }
          : pack),
      },
    })
    assert.notEqual(changed.fingerprints.packReviewsSha256, first.fingerprints.packReviewsSha256)
    assert.notEqual(changed.fingerprints.reviewSha256, first.fingerprints.reviewSha256)
  })

  it("never serializes a source root or accepts output drift", async (t) => {
    const {
      createSignatureSoundDiscoveryReview,
      renderSignatureSoundDiscoveryJson,
      validateSignatureSoundDiscoveryReview,
    } = await loadDiscoveryModule()
    const { rootPath, scan } = await createFixture(t)
    const result = createSignatureSoundDiscoveryReview({
      scan,
      moodistConcepts,
      signatureDeclaration: signatureDeclaration(),
      packReviews: packReviews(),
    })
    assert.doesNotMatch(renderSignatureSoundDiscoveryJson(result), new RegExp(rootPath.replaceAll("\\", "\\\\"), "i"))
    assert.throws(() => validateSignatureSoundDiscoveryReview({ ...result, unknown: true }, moodistConcepts), /unknown|field/i)
    assert.throws(() => validateSignatureSoundDiscoveryReview({
      ...result,
      summary: { ...result.summary, audioCount: result.summary.audioCount + 1 },
    }, moodistConcepts), /count|summary|audio/i)
  })

  it("commits an explicit 100-pack pass including snow and stone-footstep proposals", async () => {
    const { validateSignatureSoundPackReviews } = await loadDiscoveryModule()
    const committed = JSON.parse(await readFile(
      new URL("../data/atmoshaper/signature-sound-pack-reviews.json", import.meta.url),
      "utf8",
    ))
    const validated = validateSignatureSoundPackReviews(committed, moodistConcepts)
    assert.equal(validated.packs.length, 100)
    const snow = validated.packs.find(({ packName }) => packName === "Footsteps+In+SnowFX+Signaturesounds.org")
    assert.deepEqual(snow.defaultReview.moodistConceptIds, ["walk-in-snow"])
    const forest = validated.packs.find(({ packName }) => packName === "Forest+Kit")
    const stone = forest.fileRules.find(({ id }) => id === "forest-walking-stoney-pathway")
    assert.deepEqual(stone.review.moodistConceptIds, ["walk-on-gravel"])
    assert.equal(forest.defaultReview.state, "excluded")
    assert.ok(validated.packs.every((pack) => pack.defaultReview.reason.length > 0))
  })

  it("generates the confined manifest only after exact filesystem pack coverage", async (t) => {
    const { runSignatureSoundDiscoveryCli } = await loadDiscoveryCli()
    const fixture = await createFixture(t)
    const repoRoot = await mkdtemp(join(tmpdir(), "ml-signature-discovery-repo-"))
    t.after(() => rm(repoRoot, { recursive: true, force: true }))
    let stdout = ""
    const exitCode = await runSignatureSoundDiscoveryCli({
      args: [fixture.rootPath],
      repoRoot,
      moodistConcepts,
      signatureDeclaration: signatureDeclaration(),
      packReviews: packReviews(),
      stdout: (value) => { stdout += value },
    })
    assert.equal(exitCode, 0)
    const outputPath = join(repoRoot, "data", "atmoshaper", "signature-sound-review.json")
    const output = await readFile(outputPath, "utf8")
    assert.equal(output, stdout)
    assert.doesNotMatch(output, new RegExp(fixture.rootPath.replaceAll("\\", "\\\\"), "i"))

    await mkdir(join(fixture.rootPath, "Empty Pack"))
    const mismatched = packReviews()
    mismatched.packs.push({
      packName: "Invented Empty Pack",
      defaultReview: review({ state: "excluded", reason: "No audio." }),
      fileRules: [],
    })
    await assert.rejects(() => runSignatureSoundDiscoveryCli({
      args: [fixture.rootPath],
      repoRoot,
      moodistConcepts,
      signatureDeclaration: signatureDeclaration(),
      packReviews: mismatched,
      stdout: () => {},
    }), /pack|coverage|filesystem|missing|extra/i)
  })
})
