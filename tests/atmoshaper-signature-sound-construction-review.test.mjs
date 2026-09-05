import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { describe, it } from "node:test"
import { fileURLToPath } from "node:url"

import { validateSignatureSoundDiscoveryReview } from "../lib/atmoshaper/signature-sound-discovery.js"
import {
  renderSignatureSoundListeningReviewJson,
  validateSignatureSoundListeningReview,
} from "../lib/atmoshaper/signature-sound-listening-review.js"
import {
  createSignatureSoundReviewProjection,
  validateSignatureSoundReviewWorkspace,
} from "../lib/atmoshaper/signature-sound-review-workspace.js"
import {
  createSignatureSoundConstructionReviewFingerprint,
  createSignatureSoundConstructionReview,
  renderSignatureSoundConstructionReviewJson,
  renderSignatureSoundConstructionReviewMarkdown,
  validateSignatureSoundConstructionInterpretations,
  validateSignatureSoundConstructionReview,
} from "../lib/atmoshaper/signature-sound-construction-review.js"

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const fixtureRoot = join(repoRoot, "tests", "fixtures", "atmoshaper")
const V1_FIXTURE_SHA256 = "0da9ad1dd4b184b059624af11963adbd2d85d4ad6c197b83691af6d58cd70dc0"
const V3_FIXTURE_SHA256 = "d370788a6ef9af7f147c0dcafda18285b759fbca24249b82224b2c16ba844486"

async function readJson(relativePath) {
  return JSON.parse(await readFile(join(repoRoot, relativePath), "utf8"))
}

/**
 * Compare text authorities as their LF-owned Git blobs while tolerating Git's
 * CRLF checkout conversion on existing Windows worktrees. Other bytes remain
 * covered by the pinned hashes and exact renderer comparison.
 *
 * @param {string} contents UTF-8 text read from a Git checkout.
 * @returns {string} The text with CRLF sequences canonicalized to LF.
 */
function normalizeGitTextCheckout(contents) {
  return contents.replaceAll("\r\n", "\n")
}

/**
 * Read a JSON evidence fixture as UTF-8, canonicalize CRLF checkout conversion,
 * verify the SHA-256 of the canonical LF text, and return its parsed value.
 *
 * @param {string} name Fixture filename beneath the evidence-fixture root.
 * @param {string} expectedSha256 SHA-256 expected for the canonical LF text.
 * @returns {Promise<unknown>} The parsed fixture JSON.
 */
async function readEvidenceFixture(name, expectedSha256) {
  const contents = await readFile(join(fixtureRoot, name))
  const canonicalContents = normalizeGitTextCheckout(contents.toString("utf8"))
  assert.equal(createHash("sha256").update(canonicalContents).digest("hex"), expectedSha256)
  return JSON.parse(canonicalContents)
}

async function loadAuthorityBundle() {
  const [
    moodistConcepts,
    discoveryReview,
    strategyPolicy,
    listeningReview,
    exportedListeningReview,
    workspace,
  ] = await Promise.all([
    readJson("data/atmoshaper/moodist-concepts.json"),
    readJson("data/atmoshaper/signature-sound-review.json"),
    readJson("data/atmoshaper/signature-sound-playback-strategies.json"),
    readJson("data/atmoshaper/signature-sound-listening-review.json"),
    readEvidenceFixture("signature-listening-review-v1-a22a9d19d8.json", V1_FIXTURE_SHA256),
    readEvidenceFixture("signature-complete-review-v3-a22a9d19d8.json", V3_FIXTURE_SHA256),
  ])
  return {
    moodistConcepts,
    discoveryReview,
    strategyPolicy,
    listeningReview,
    exportedListeningReview,
    workspace,
  }
}

function nonemptyNoteEntries(record) {
  return Object.entries(record)
    .filter(([, entry]) => typeof entry.note === "string" && entry.note.trim() !== "")
    .map(([sourceId, entry]) => [sourceId, entry.note])
    .sort(([left], [right]) => left.localeCompare(right, "en"))
}

function compareText(left, right) {
  return left.toLowerCase().localeCompare(right.toLowerCase(), "en") || left.localeCompare(right, "en")
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort(compareText).map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`
  }
  return JSON.stringify(value)
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex")
}

function dispositionId(note) {
  return `note-${sha256(stableJson({
    scope: note.scope,
    groupId: note.groupId,
    sourceId: note.sourceId,
    originalNote: note.originalNote,
  }))}`
}

async function loadValidatedAuthorityBundle() {
  const authority = await loadAuthorityBundle()
  authority.discoveryReview = validateSignatureSoundDiscoveryReview(
    authority.discoveryReview,
    authority.moodistConcepts,
  )
  authority.listeningReview = validateSignatureSoundListeningReview(authority.listeningReview, {
    discoveryReview: authority.discoveryReview,
    moodistConcepts: authority.moodistConcepts,
    exportedReview: authority.exportedListeningReview,
    strategyPolicy: authority.strategyPolicy,
  })
  return authority
}

async function createFixtureAuthority() {
  const authority = await loadValidatedAuthorityBundle()
  const baselines = {
    discoveryReview: authority.discoveryReview,
    curatedReview: authority.listeningReview,
  }
  const workspace = validateSignatureSoundReviewWorkspace(authority.workspace, baselines)
  const projection = createSignatureSoundReviewProjection(workspace, baselines)
  const resolutions = []
  const dispositions = []

  for (const group of projection.groups) {
    const notes = []
    if (group.note.trim() !== "") {
      notes.push({
        scope: "group",
        groupId: group.groupId,
        sourceId: null,
        originalNote: group.note,
        decision: group.decision,
      })
    }
    for (const ingredient of group.ingredients) {
      if (ingredient.note.trim() === "") continue
      notes.push({
        scope: "ingredient",
        groupId: group.groupId,
        sourceId: ingredient.sourceId,
        originalNote: ingredient.note,
        decision: ingredient.decision,
      })
    }
    for (const note of notes) {
      const id = dispositionId(note)
      const resolutionId = `resolution-${id.slice(5)}`
      if (note.decision === "remove") {
        resolutions.push({
          id: resolutionId,
          type: "no-assignment",
          groupId: note.groupId,
          sourceId: note.sourceId,
          reason: "source-removed-from-concept",
        })
        dispositions.push({
          id,
          scope: note.scope,
          groupId: note.groupId,
          sourceId: note.sourceId,
          originalNote: note.originalNote,
          classification: "removed-source-observation",
          resolutionIds: [resolutionId],
          state: "structured",
        })
      } else {
        resolutions.push({
          id: resolutionId,
          type: "processing-intent",
          groupId: note.groupId,
          sourceId: note.sourceId,
          intentKind: "normalize-relative-level",
          desiredOutcome: "Fixture audible outcome.",
          state: "required",
          choiceSetId: null,
          qa: "audible-qa-required",
        })
        dispositions.push({
          id,
          scope: note.scope,
          groupId: note.groupId,
          sourceId: note.sourceId,
          originalNote: note.originalNote,
          classification: "audio-processing",
          resolutionIds: [resolutionId],
          state: "structured",
        })
      }
    }
  }

  authority.interpretations = {
    version: 1,
    fingerprints: {
      discoveryReviewSha256: authority.discoveryReview.fingerprints.reviewSha256,
      curationSha256: authority.listeningReview.fingerprints.curationSha256,
      workspaceSha256: sha256(stableJson(workspace)),
    },
    resolutions,
    dispositions,
  }
  return { authority, projection }
}

function findDisposition(interpretations, groupId, sourceId = null) {
  const disposition = interpretations.dispositions.find((entry) => (
    entry.groupId === groupId && entry.sourceId === sourceId
  ))
  assert.ok(disposition, `Expected disposition for ${groupId}:${sourceId ?? "group"}`)
  return disposition
}

function replaceDispositionResolutions(interpretations, groupId, sourceId, replacements) {
  const disposition = findDisposition(interpretations, groupId, sourceId)
  const replacedIds = new Set(disposition.resolutionIds)
  interpretations.resolutions = interpretations.resolutions.filter(({ id }) => !replacedIds.has(id))
  interpretations.resolutions.push(...replacements)
  disposition.resolutionIds = replacements.map(({ id }) => id)
}

describe("AtmoShaper Signature construction-review authority", () => {
  it("locks both human exports and validates the exact committed authority chain", async () => {
    const authority = await loadAuthorityBundle()
    const normalizedDiscovery = validateSignatureSoundDiscoveryReview(
      authority.discoveryReview,
      authority.moodistConcepts,
    )
    const normalizedListening = validateSignatureSoundListeningReview(authority.listeningReview, {
      discoveryReview: normalizedDiscovery,
      moodistConcepts: authority.moodistConcepts,
      exportedReview: authority.exportedListeningReview,
      strategyPolicy: authority.strategyPolicy,
    })
    const listeningBytes = normalizeGitTextCheckout(
      await readFile(
        join(repoRoot, "data", "atmoshaper", "signature-sound-listening-review.json"),
        "utf8",
      ),
    )
    assert.equal(renderSignatureSoundListeningReviewJson(normalizedListening, {
      discoveryReview: normalizedDiscovery,
      moodistConcepts: authority.moodistConcepts,
      exportedReview: authority.exportedListeningReview,
      strategyPolicy: authority.strategyPolicy,
    }), listeningBytes)

    const baselines = { discoveryReview: normalizedDiscovery, curatedReview: normalizedListening }
    const normalizedWorkspace = validateSignatureSoundReviewWorkspace(authority.workspace, baselines)
    const projection = createSignatureSoundReviewProjection(normalizedWorkspace, baselines)
    const groupNoteCount = projection.groups.filter(({ note }) => note.trim() !== "").length
    const ingredientNoteCount = projection.groups.reduce((count, group) => (
      count + group.ingredients.filter(({ note }) => note.trim() !== "").length
    ), 0)

    assert.equal(normalizedWorkspace.version, 3)
    assert.equal(projection.recordings.length, 3693)
    assert.equal(projection.groups.length, 93)
    assert.equal(groupNoteCount, 27)
    assert.equal(ingredientNoteCount, 11)
    assert.equal(groupNoteCount + ingredientNoteCount, 38)
    assert.deepEqual(
      nonemptyNoteEntries(normalizedWorkspace.recordings),
      nonemptyNoteEntries(authority.exportedListeningReview.decisions),
    )
    assert.equal(nonemptyNoteEntries(normalizedWorkspace.recordings).length, 57)
  })

  it("rejects stale listening and workspace fingerprints at their existing owners", async () => {
    const authority = await loadAuthorityBundle()
    const staleListeningExport = structuredClone(authority.exportedListeningReview)
    staleListeningExport.reviewFingerprint = "0".repeat(64)
    assert.throws(() => validateSignatureSoundListeningReview(authority.listeningReview, {
      discoveryReview: authority.discoveryReview,
      moodistConcepts: authority.moodistConcepts,
      exportedReview: staleListeningExport,
      strategyPolicy: authority.strategyPolicy,
    }), /does not match the discovery manifest/)

    const staleWorkspace = structuredClone(authority.workspace)
    staleWorkspace.fingerprints.curationSha256 = "0".repeat(64)
    assert.throws(() => validateSignatureSoundReviewWorkspace(staleWorkspace, {
      discoveryReview: authority.discoveryReview,
      curatedReview: authority.listeningReview,
    }), /curation fingerprint does not match/)
  })

  it("requires the bounded construction-review owner before interpretation can begin", async () => {
    for (const owner of [
      validateSignatureSoundConstructionInterpretations,
      createSignatureSoundConstructionReview,
      validateSignatureSoundConstructionReview,
      renderSignatureSoundConstructionReviewJson,
      renderSignatureSoundConstructionReviewMarkdown,
    ]) {
      assert.equal(typeof owner, "function")
    }
  })

  it("derives deterministic closed construction intent without mutating any authority input", async () => {
    const { authority } = await createFixtureAuthority()
    const before = structuredClone(authority)
    const review = createSignatureSoundConstructionReview(authority)

    assert.equal(review.version, 1)
    assert.equal(review.summary.projectedRecordingCount, 3693)
    assert.equal(review.summary.groupCount, 93)
    assert.equal(review.summary.noteDispositionCount, 38)
    assert.equal(review.noteDispositions.length, 38)
    assert.equal(review.groups.length, 93)
    assert.deepEqual(authority, before)
    assert.deepEqual(validateSignatureSoundConstructionReview(review, authority), review)

    const reversedAuthority = structuredClone(authority)
    reversedAuthority.interpretations.resolutions.reverse()
    reversedAuthority.interpretations.dispositions.reverse()
    assert.equal(
      renderSignatureSoundConstructionReviewJson(review, authority),
      renderSignatureSoundConstructionReviewJson(review, reversedAuthority),
    )
    assert.match(renderSignatureSoundConstructionReviewMarkdown(review, authority), /38 note dispositions/)
  })

  it("merges source processing by intent family and never assigns processing to a removed ingredient", async () => {
    const { authority } = await createFixtureAuthority()
    const interpretations = authority.interpretations
    const birdsGroup = findDisposition(interpretations, "moodist:birds")
    const birdsSource = findDisposition(
      interpretations,
      "moodist:birds",
      "93af53fdf1740d4eac97d255d7183938408b14ff4d053316ae7818e53509e22f",
    )
    const busyGroup = findDisposition(interpretations, "moodist:busy-street")
    const busyRemove = findDisposition(
      interpretations,
      "moodist:busy-street",
      "64538e1493a9eb2141af43b9c4637eff6e3382e244e7cde6b3cde2199e21815c",
    )
    const resolutionById = new Map(interpretations.resolutions.map((entry) => [entry.id, entry]))
    resolutionById.get(birdsGroup.resolutionIds[0]).intentKind = "remove-human-voice"
    resolutionById.get(birdsSource.resolutionIds[0]).intentKind = "trim-segment"
    resolutionById.get(busyGroup.resolutionIds[0]).intentKind = "obscure-speech-intelligibility"
    resolutionById.get(busyRemove.resolutionIds[0]).intentKind = "remove-human-voice"

    const review = createSignatureSoundConstructionReview(authority)
    const birds = review.groups.find(({ groupId }) => groupId === "moodist:birds")
    const busyStreet = review.groups.find(({ groupId }) => groupId === "moodist:busy-street")
    assert.deepEqual(
      birds.sourceOverrides["93af53fdf1740d4eac97d255d7183938408b14ff4d053316ae7818e53509e22f"]
        .map(({ intentKind }) => intentKind),
      ["remove-human-voice", "trim-segment"],
    )
    assert.deepEqual(
      busyStreet.sourceOverrides["64538e1493a9eb2141af43b9c4637eff6e3382e244e7cde6b3cde2199e21815c"]
        .map(({ intentKind }) => intentKind),
      ["remove-human-voice"],
    )
    assert.equal(
      busyStreet.sourceOverrides["cf936ab0acc2f2af3be2b9458c6c740b150c9a185e43290aa1a25889a64e46c5"],
      undefined,
    )
  })

  it("derives playback constraints and explicit review-state precedence", async () => {
    const { authority } = await createFixtureAuthority()
    const interpretations = authority.interpretations
    replaceDispositionResolutions(interpretations, "signature-extra:air-traffic-control", null, [
      {
        id: "air-traffic-playback",
        type: "playback-override",
        groupId: "signature-extra:air-traffic-control",
        sourceId: null,
        strategyId: "spaced-event-sequence",
        previewSettings: { minimumGapSeconds: 1, maximumGapSeconds: 7 },
      },
      {
        id: "air-traffic-repeat",
        type: "nonrepeat-window",
        groupId: "signature-extra:air-traffic-control",
        sourceId: null,
        interveningSelections: 4,
      },
      {
        id: "air-traffic-normalize",
        type: "processing-intent",
        groupId: "signature-extra:air-traffic-control",
        sourceId: null,
        intentKind: "normalize-relative-level",
        desiredOutcome: "Align the selected radio recordings without removing speech.",
        state: "required",
        choiceSetId: null,
        qa: "audible-qa-required",
      },
    ])
    findDisposition(interpretations, "signature-extra:air-traffic-control").classification = "audio-and-playback"

    replaceDispositionResolutions(interpretations, "moodist:ceiling-fan", null, [{
      id: "ceiling-fan-rename",
      type: "rename-concept",
      groupId: "moodist:ceiling-fan",
      sourceId: null,
      replacementLabel: null,
      state: "needs-user-decision",
    }])
    const ceilingDisposition = findDisposition(interpretations, "moodist:ceiling-fan")
    ceilingDisposition.classification = "concept-metadata"
    ceilingDisposition.state = "needs-user-decision"

    replaceDispositionResolutions(interpretations, "signature-extra:underwater-effects", null, [
      {
        id: "walking-puddles-rename",
        type: "rename-concept",
        groupId: "signature-extra:underwater-effects",
        sourceId: null,
        replacementLabel: "Walking in Puddles",
        state: "required",
      },
      {
        id: "walking-puddles-reaudition",
        type: "audition-requirement",
        groupId: "signature-extra:underwater-effects",
        sourceId: null,
        outcome: "needs-rebuild-audition",
        reason: "The approved construction interpretation requires a rebuilt audible pass.",
      },
    ])
    findDisposition(interpretations, "signature-extra:underwater-effects").classification = "concept-metadata"

    const review = createSignatureSoundConstructionReview(authority)
    const airTraffic = review.groups.find(({ groupId }) => groupId === "signature-extra:air-traffic-control")
    const ceilingFan = review.groups.find(({ groupId }) => groupId === "moodist:ceiling-fan")
    const walkingPuddles = review.groups.find(({ groupId }) => groupId === "signature-extra:underwater-effects")
    assert.equal(airTraffic.playback.strategyId, "spaced-event-sequence")
    assert.deepEqual(airTraffic.playback.previewSettings, { minimumGapSeconds: 1, maximumGapSeconds: 7 })
    assert.equal(airTraffic.playback.minimumSelectionsBeforeRepeat, 4)
    assert.equal(airTraffic.reviewState, "needs-rebuild-audition")
    assert.equal(ceilingFan.reviewState, "unresolved")
    assert.equal(walkingPuddles.label, "Walking in Puddles")
    assert.equal(walkingPuddles.reviewState, "needs-rebuild-audition")
  })

  it("fails closed on incomplete, fabricated, stale, unknown, or drifted construction data", async () => {
    const { authority } = await createFixtureAuthority()
    const missingDisposition = structuredClone(authority.interpretations)
    missingDisposition.dispositions.pop()
    assert.throws(() => validateSignatureSoundConstructionInterpretations(missingDisposition, authority), /coverage/)

    const duplicateDisposition = structuredClone(authority.interpretations)
    duplicateDisposition.dispositions.push(structuredClone(duplicateDisposition.dispositions[0]))
    assert.throws(() => validateSignatureSoundConstructionInterpretations(duplicateDisposition, authority), /duplicate/i)

    const changedNote = structuredClone(authority.interpretations)
    changedNote.dispositions[0].originalNote += " changed"
    assert.throws(() => validateSignatureSoundConstructionInterpretations(changedNote, authority), /note|coverage/i)

    const unknownField = structuredClone(authority.interpretations)
    unknownField.extra = true
    assert.throws(() => validateSignatureSoundConstructionInterpretations(unknownField, authority), /unknown field/i)

    const staleFingerprint = structuredClone(authority.interpretations)
    staleFingerprint.fingerprints.workspaceSha256 = "0".repeat(64)
    assert.throws(() => validateSignatureSoundConstructionInterpretations(staleFingerprint, authority), /workspace fingerprint/i)

    const removedProcessing = structuredClone(authority.interpretations)
    const removed = findDisposition(
      removedProcessing,
      "moodist:busy-street",
      "cf936ab0acc2f2af3be2b9458c6c740b150c9a185e43290aa1a25889a64e46c5",
    )
    const removedResolution = removedProcessing.resolutions.find(({ id }) => id === removed.resolutionIds[0])
    Object.assign(removedResolution, {
      type: "processing-intent",
      intentKind: "remove-human-voice",
      desiredOutcome: "Remove people.",
      state: "required",
      choiceSetId: null,
      qa: "audible-qa-required",
    })
    delete removedResolution.reason
    assert.throws(() => validateSignatureSoundConstructionInterpretations(removedProcessing, authority), /removed/i)

    const removedBorrowingGroupIntent = structuredClone(authority.interpretations)
    const borrowedRemoved = findDisposition(
      removedBorrowingGroupIntent,
      "moodist:busy-street",
      "cf936ab0acc2f2af3be2b9458c6c740b150c9a185e43290aa1a25889a64e46c5",
    )
    const retiredNoAssignmentIds = new Set(borrowedRemoved.resolutionIds)
    removedBorrowingGroupIntent.resolutions = removedBorrowingGroupIntent.resolutions.filter(({ id }) => (
      !retiredNoAssignmentIds.has(id)
    ))
    borrowedRemoved.resolutionIds = [...findDisposition(
      removedBorrowingGroupIntent,
      "moodist:busy-street",
    ).resolutionIds]
    borrowedRemoved.classification = "audio-processing"
    assert.throws(() => validateSignatureSoundConstructionInterpretations(
      removedBorrowingGroupIntent,
      authority,
    ), /removed.*no-assignment/i)

    const inaudibleQa = structuredClone(authority.interpretations)
    inaudibleQa.resolutions.find(({ type }) => type === "processing-intent").qa = "not-applicable"
    assert.throws(() => validateSignatureSoundConstructionInterpretations(inaudibleQa, authority), /audible.*QA/i)

    const conflictingSpeech = structuredClone(authority.interpretations)
    const busySpeech = conflictingSpeech.resolutions.find(({ sourceId }) => (
      sourceId === "64538e1493a9eb2141af43b9c4637eff6e3382e244e7cde6b3cde2199e21815c"
    ))
    busySpeech.intentKind = "remove-human-voice"
    const conflict = { ...busySpeech, id: "conflicting-source-speech", intentKind: "obscure-speech-intelligibility" }
    conflictingSpeech.resolutions.push(conflict)
    findDisposition(conflictingSpeech, "moodist:busy-street", busySpeech.sourceId).resolutionIds.push(conflict.id)
    assert.throws(() => validateSignatureSoundConstructionInterpretations(conflictingSpeech, authority), /speech treatment/i)

    const review = createSignatureSoundConstructionReview(authority)
    const drifted = structuredClone(review)
    drifted.summary.noteDispositionCount -= 1
    assert.throws(() => validateSignatureSoundConstructionReview(drifted, authority), /does not match/i)
  })

  it("closes every resolution identity, concept binding, strategy, setting, and note reference", async () => {
    const { authority } = await createFixtureAuthority()
    const mutate = (callback) => {
      const interpretations = structuredClone(authority.interpretations)
      callback(interpretations)
      return interpretations
    }

    assert.throws(() => validateSignatureSoundConstructionInterpretations(mutate((value) => {
      value.resolutions[0].type = "fabricated-treatment"
    }), authority), /unknown construction resolution type/i)
    assert.throws(() => validateSignatureSoundConstructionInterpretations(mutate((value) => {
      value.dispositions[0].resolutionIds = ["missing-resolution"]
    }), authority), /unknown construction resolution/i)
    assert.throws(() => validateSignatureSoundConstructionInterpretations(mutate((value) => {
      value.dispositions[0].resolutionIds.push(value.dispositions[0].resolutionIds[0])
    }), authority), /duplicate/i)
    assert.throws(() => validateSignatureSoundConstructionInterpretations(mutate((value) => {
      value.resolutions[0].groupId = "moodist:not-real"
    }), authority), /unknown construction resolution group/i)
    assert.throws(() => validateSignatureSoundConstructionInterpretations(mutate((value) => {
      const resolution = value.resolutions.find(({ type, sourceId }) => type === "processing-intent" && sourceId)
      resolution.sourceId = "0".repeat(64)
    }), authority), /outside concept/i)
    assert.throws(() => validateSignatureSoundConstructionInterpretations(mutate((value) => {
      value.resolutions[0].intentKind = "invented-filter"
    }), authority), /kind is not supported/i)
    assert.throws(() => validateSignatureSoundConstructionInterpretations(mutate((value) => {
      value.dispositions[0].classification = "playback"
    }), authority), /classification/i)
    assert.throws(() => validateSignatureSoundConstructionInterpretations(mutate((value) => {
      value.dispositions[0].state = "needs-user-decision"
    }), authority), /disposition state/i)

    replaceDispositionResolutions(authority.interpretations, "signature-extra:air-traffic-control", null, [{
      id: "invalid-playback",
      type: "playback-override",
      groupId: "signature-extra:air-traffic-control",
      sourceId: null,
      strategyId: "not-a-strategy",
      previewSettings: {},
    }])
    assert.throws(() => validateSignatureSoundConstructionInterpretations(authority.interpretations, authority), /unknown construction playback strategy/i)
    authority.interpretations.resolutions.find(({ id }) => id === "invalid-playback").strategyId = "spaced-event-sequence"
    assert.throws(() => validateSignatureSoundConstructionInterpretations(authority.interpretations, authority), /preview|gap|setting/i)
  })

  it("supports shared note resolutions while rejecting output ordering and fingerprint drift", async () => {
    const { authority } = await createFixtureAuthority()
    const interpretations = authority.interpretations
    const boilingGroup = findDisposition(interpretations, "moodist:boiling-water")
    const boilingIngredient = interpretations.dispositions.find((entry) => (
      entry.groupId === "moodist:boiling-water" && entry.sourceId !== null
    ))
    assert.ok(boilingIngredient)
    const retiredResolutionIds = new Set(boilingIngredient.resolutionIds)
    interpretations.resolutions = interpretations.resolutions.filter(({ id }) => !retiredResolutionIds.has(id))
    boilingIngredient.resolutionIds = [...boilingGroup.resolutionIds]
    const normalized = validateSignatureSoundConstructionInterpretations(interpretations, authority)
    assert.deepEqual(
      findDisposition(normalized, "moodist:boiling-water", boilingIngredient.sourceId).resolutionIds,
      boilingGroup.resolutionIds,
    )

    for (const field of ["discoveryReviewSha256", "curationSha256"]) {
      const stale = structuredClone(interpretations)
      stale.fingerprints[field] = "0".repeat(64)
      assert.throws(() => validateSignatureSoundConstructionInterpretations(stale, authority), /fingerprint does not match/i)
    }

    const review = createSignatureSoundConstructionReview(authority)
    const reordered = structuredClone(review)
    reordered.groups.reverse()
    assert.throws(() => validateSignatureSoundConstructionReview(reordered, authority), /does not match/i)
    const alteredHash = structuredClone(review)
    alteredHash.fingerprints.constructionReviewSha256 = "0".repeat(64)
    assert.throws(() => validateSignatureSoundConstructionReview(alteredHash, authority), /does not match/i)
  })

  it("commits the exact 38-note interpretation owner and its deterministic generated review", async () => {
    const authority = await loadValidatedAuthorityBundle()
    authority.interpretations = await readJson("data/atmoshaper/signature-sound-construction-interpretations.json")
    const committedReview = await readJson("data/atmoshaper/signature-sound-construction-review.json")
    const interpretations = validateSignatureSoundConstructionInterpretations(authority.interpretations, authority)
    const review = validateSignatureSoundConstructionReview(committedReview, authority)

    assert.deepEqual(interpretations, authority.interpretations)
    assert.deepEqual(review.summary, {
      projectedRecordingCount: 3693,
      groupCount: 93,
      noteDispositionCount: 38,
      structuredNoteCount: 36,
      deferredNoteCount: 0,
      needsDecisionNoteCount: 2,
    })
    assert.deepEqual(review.fingerprints, {
      discoveryReviewSha256: "a22a9d19d8ae8353c32c7f8f7ca2be3e7de3b55cceb0e4d8df4f69b552e512bf",
      curationSha256: "dc3c8fe2b14dc7d2e29b8ed813e93f89f2ecd47c4a235a1c32dd5ed2beed8bee",
      workspaceSha256: "23b102e69850f6cd9d282f6520ff12d8f2ea42a4961a03b033bfa688f9fc8b5a",
      interpretationSha256: "e2d7d02024ad3a67325c8c87e36d923d6aa8f8aa8a8f0e4b4f9fbe8f169bdfdc",
      constructionReviewSha256: "a3e782b6c1c2d808bd7e8214cb655163f1bdfbc473318ae0ac9c916ccb84954d",
    })
    assert.equal(
      createSignatureSoundConstructionReviewFingerprint(review),
      review.fingerprints.constructionReviewSha256,
    )
    const resolutionById = new Map(review.resolutions.map((resolution) => [resolution.id, resolution]))
    const groupById = new Map(review.groups.map((group) => [group.groupId, group]))
    assert.deepEqual(groupById.get("signature-extra:air-traffic-control").playback, {
      strategyId: "spaced-event-sequence",
      previewSettings: { minimumGapSeconds: 1, maximumGapSeconds: 7 },
      minimumSelectionsBeforeRepeat: 4,
      constraints: [{ type: "nonrepeat-window", interveningSelections: 4 }],
    })
    assert.equal(groupById.get("moodist:walk-on-leaves").playback.minimumSelectionsBeforeRepeat, 3)
    assert.equal(groupById.get("signature-extra:underwater-effects").label, "Walking in Puddles")
    assert.equal(groupById.get("signature-extra:underwater-effects").reviewState, "needs-rebuild-audition")
    assert.equal(resolutionById.get("horror-spaced-playback").previewSettings.maximumGapSeconds, 16)
    assert.equal(resolutionById.get("whistles-spaced-playback").previewSettings.maximumGapSeconds, 8)
    assert.equal(resolutionById.get("whistles-time-effect").intentKind, "add-time-effect")
    assert.equal(resolutionById.get("busy-street-remove-source-64538e").intentKind, "remove-human-voice")
    assert.equal(resolutionById.get("busy-street-remove-source-f7e2c2").intentKind, "remove-human-voice")
    assert.equal(resolutionById.get("air-traffic-normalize").intentKind, "normalize-relative-level")
    assert.ok(!review.resolutions.some((resolution) => (
      resolution.groupId === "signature-extra:air-traffic-control"
      && resolution.intentKind === "remove-human-voice"
    )))
    assert.equal(review.resolutions.filter(({ type }) => type === "no-assignment").length, 2)
    const dispositionByGroup = new Map(review.noteDispositions.map((disposition) => [
      `${disposition.groupId}:${disposition.sourceId ?? "group"}`,
      disposition,
    ]))
    assert.equal(dispositionByGroup.get("moodist:wind-chimes:group").classification, "audio-processing")
    assert.equal(dispositionByGroup.get("moodist:road:group").state, "needs-user-decision")
    assert.equal(dispositionByGroup.get("moodist:walk-on-gravel:group").classification, "playback")
    assert.equal(renderSignatureSoundConstructionReviewJson(review, authority), `${JSON.stringify(review, null, 2)}\n`)
  })
})
