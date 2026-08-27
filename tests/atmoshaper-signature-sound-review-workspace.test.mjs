import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

const SOURCE_IDS = ["1", "2", "3"].map((digit) => digit.repeat(64))
const DISCOVERY_FINGERPRINT = "a".repeat(64)
const CURATION_FINGERPRINT = "b".repeat(64)

async function loadWorkspaceModule() {
  try {
    return await import("../lib/atmoshaper/signature-sound-review-workspace.js")
  } catch (error) {
    assert.fail(`Signature review-workspace owner must load: ${error?.message ?? error}`)
  }
}

function fixtureBaselines() {
  return {
    discoveryReview: {
      fingerprints: { reviewSha256: DISCOVERY_FINGERPRINT },
      sources: [
        {
          sourceId: SOURCE_IDS[0],
          relativePath: "City/street-a.wav",
          reviewState: "candidate",
          moodistConcepts: [
            { id: "busy-street", label: "Busy Street", category: "urban" },
            { id: "traffic", label: "Traffic", category: "urban" },
          ],
          signatureExtraConcepts: [],
        },
        {
          sourceId: SOURCE_IDS[1],
          relativePath: "City/street-b.wav",
          reviewState: "candidate",
          moodistConcepts: [{ id: "busy-street", label: "Busy Street", category: "urban" }],
          signatureExtraConcepts: [],
        },
        {
          sourceId: SOURCE_IDS[2],
          relativePath: "Keys/key.wav",
          reviewState: "candidate",
          moodistConcepts: [],
          signatureExtraConcepts: [{ id: "keys-jingling", label: "Keys Jingling" }],
        },
      ],
    },
    curatedReview: {
      fingerprints: { curationSha256: CURATION_FINGERPRINT },
      strategies: [
        { id: "adaptive-whole-source-sequence" },
        { id: "adaptive-one-shot-sequence" },
        { id: "walking-cadence-sequence" },
        { id: "spaced-event-sequence" },
      ],
      decisions: [
        { sourceId: SOURCE_IDS[0], decision: "keep", note: "Useful city bed." },
        { sourceId: SOURCE_IDS[1], decision: "maybe", note: "Check the horn." },
        { sourceId: SOURCE_IDS[2], decision: "reject", note: "Too sharp globally." },
      ],
      groups: [
        {
          groupId: "moodist:busy-street",
          conceptKind: "moodist",
          conceptId: "busy-street",
          label: "Busy Street",
          category: "urban",
          status: "active",
          strategyId: "adaptive-whole-source-sequence",
          sourceCounts: { total: 2, keep: 1, maybe: 1, reject: 0 },
        },
        {
          groupId: "moodist:traffic",
          conceptKind: "moodist",
          conceptId: "traffic",
          label: "Traffic",
          category: "urban",
          status: "active",
          strategyId: "adaptive-whole-source-sequence",
          sourceCounts: { total: 1, keep: 1, maybe: 0, reject: 0 },
        },
        {
          groupId: "signature-extra:keys-jingling",
          conceptKind: "signature-extra",
          conceptId: "keys-jingling",
          label: "Keys Jingling",
          category: null,
          status: "active",
          strategyId: "adaptive-one-shot-sequence",
          sourceCounts: { total: 1, keep: 0, maybe: 0, reject: 1 },
        },
      ],
    },
  }
}

function fixtureLegacyRecordingReview() {
  return {
    version: 1,
    reviewFingerprint: DISCOVERY_FINGERPRINT,
    updatedAt: "2026-08-23T14:00:00.000Z",
    decisions: {
      [SOURCE_IDS[0]]: { decision: "maybe", note: "Prefer this for Traffic." },
    },
  }
}

function fixtureLegacyGroupReview() {
  return {
    version: 2,
    reviewFingerprint: CURATION_FINGERPRINT,
    updatedAt: "2026-08-23T15:00:00.000Z",
    groups: {
      "moodist:busy-street": {
        decision: "approve",
        strategyId: "adaptive-whole-source-sequence",
        previewSettings: { transitionMode: "crossfade", transitionSeconds: 2 },
        sourcePool: "keep-only",
        auditionedAt: "2026-08-23T14:59:00.000Z",
        auditionKey: "adaptive-whole-source-sequence|keep-only|{\"transitionMode\":\"crossfade\",\"transitionSeconds\":2}",
        note: "Use a patient transition.",
      },
    },
  }
}

describe("AtmoShaper Signature review workspace", () => {
  it("migrates both legacy drafts without mutating them and rebinds safe approval to exact included sources", async () => {
    const {
      createSignatureSoundReviewProjection,
      migrateSignatureSoundReviewWorkspace,
    } = await loadWorkspaceModule()
    const baselines = fixtureBaselines()
    const legacyRecordingReview = fixtureLegacyRecordingReview()
    const legacyGroupReview = fixtureLegacyGroupReview()
    const workspace = migrateSignatureSoundReviewWorkspace({
      ...baselines,
      legacyRecordingReview,
      legacyGroupReview,
      updatedAt: "2026-08-24T12:00:00.000Z",
    })

    assert.equal(workspace.version, 3)
    assert.deepEqual(workspace.recordings[SOURCE_IDS[0]], {
      decision: "maybe",
      note: "Prefer this for Traffic.",
      concepts: {},
    })
    assert.deepEqual(workspace.recordings[SOURCE_IDS[1]].concepts["moodist:busy-street"], {
      decision: "remove",
      note: "",
    })
    assert.equal(workspace.groups["moodist:busy-street"].decision, "approve")
    assert.match(workspace.groups["moodist:busy-street"].auditionKey, /^v3\|/)

    const projection = createSignatureSoundReviewProjection(workspace, baselines)
    const busyStreet = projection.groups.find(({ groupId }) => groupId === "moodist:busy-street")
    const traffic = projection.groups.find(({ groupId }) => groupId === "moodist:traffic")
    assert.deepEqual(busyStreet.includedSourceIds, [SOURCE_IDS[0]])
    assert.deepEqual(traffic.includedSourceIds, [SOURCE_IDS[0]])
    assert.equal(busyStreet.ingredients.find(({ sourceId }) => sourceId === SOURCE_IDS[1]).decision, "remove")
    assert.deepEqual(legacyRecordingReview, fixtureLegacyRecordingReview())
    assert.deepEqual(legacyGroupReview, fixtureLegacyGroupReview())
  })

  it("keeps one recording independent across concepts and retains removed custom assignments for restoration", async () => {
    const {
      createSignatureSoundReviewProjection,
      migrateSignatureSoundReviewWorkspace,
      validateSignatureSoundReviewWorkspace,
    } = await loadWorkspaceModule()
    const baselines = fixtureBaselines()
    const workspace = migrateSignatureSoundReviewWorkspace({
      ...baselines,
      updatedAt: "2026-08-24T12:00:00.000Z",
    })
    workspace.customConcepts["custom:commuter-rush"] = { label: "Commuter Rush" }
    workspace.recordings[SOURCE_IDS[0]] = {
      note: "",
      concepts: {
        "moodist:busy-street": { decision: "remove", note: "Too calm here." },
        "moodist:traffic": { decision: "include", note: "Good distant traffic." },
        "custom:commuter-rush": { decision: "remove", note: "Keep visible for comparison." },
      },
    }
    workspace.groups["custom:commuter-rush"] = {
      strategyId: "adaptive-whole-source-sequence",
      previewSettings: { transitionMode: "crossfade", transitionSeconds: 2 },
      note: "",
    }

    const normalized = validateSignatureSoundReviewWorkspace(workspace, baselines)
    const projection = createSignatureSoundReviewProjection(normalized, baselines)
    const busyStreet = projection.groups.find(({ groupId }) => groupId === "moodist:busy-street")
    const traffic = projection.groups.find(({ groupId }) => groupId === "moodist:traffic")
    const custom = projection.groups.find(({ groupId }) => groupId === "custom:commuter-rush")
    assert.equal(busyStreet.ingredients[0].decision, "remove")
    assert.equal(traffic.ingredients[0].decision, "include")
    assert.equal(custom.ingredients[0].decision, "remove")
    assert.equal(custom.ingredients[0].note, "Keep visible for comparison.")
  })

  it("renders deterministically and fails closed on stale fingerprints, unknown identities, collisions, and fields", async () => {
    const {
      migrateSignatureSoundReviewWorkspace,
      renderSignatureSoundReviewWorkspaceJson,
      validateSignatureSoundReviewWorkspace,
    } = await loadWorkspaceModule()
    const baselines = fixtureBaselines()
    const workspace = migrateSignatureSoundReviewWorkspace({
      ...baselines,
      updatedAt: "2026-08-24T12:00:00.000Z",
    })
    assert.equal(
      renderSignatureSoundReviewWorkspaceJson(workspace, baselines),
      renderSignatureSoundReviewWorkspaceJson(structuredClone(workspace), baselines),
    )

    const mutations = [
      [value => { value.fingerprints.discoveryReviewSha256 = "f".repeat(64) }, /fingerprint|discovery/i],
      [value => { value.recordings["f".repeat(64)] = { note: "", concepts: {} } }, /unknown.*source/i],
      [value => { value.customConcepts["custom:city"] = { label: "City" }; value.customConcepts["custom:city-2"] = { label: "city" } }, /label|duplicate|collision/i],
      [value => { value.recordings[SOURCE_IDS[0]] = { note: "", concepts: { "moodist:unknown": { decision: "include", note: "" } } } }, /unknown.*concept|group/i],
      [value => { value.extra = true }, /unknown field/i],
    ]
    for (const [mutate, expected] of mutations) {
      const value = structuredClone(workspace)
      mutate(value)
      assert.throws(() => validateSignatureSoundReviewWorkspace(value, baselines), expected)
    }
  })

  it("projects the complete real inventory and curated groups without changing their baseline counts", async () => {
    const {
      createSignatureSoundReviewProjection,
      migrateSignatureSoundReviewWorkspace,
    } = await loadWorkspaceModule()
    const discoveryReview = JSON.parse(await readFile(
      new URL("../data/atmoshaper/signature-sound-review.json", import.meta.url),
      "utf8",
    ))
    const curatedReview = JSON.parse(await readFile(
      new URL("../data/atmoshaper/signature-sound-listening-review.json", import.meta.url),
      "utf8",
    ))
    const baselines = { discoveryReview, curatedReview }
    const workspace = migrateSignatureSoundReviewWorkspace({
      ...baselines,
      updatedAt: "2026-08-24T12:00:00.000Z",
    })
    const projection = createSignatureSoundReviewProjection(workspace, baselines)

    assert.equal(projection.recordings.length, 3693)
    assert.equal(projection.groups.length, 93)
    const busyStreet = projection.groups.find(({ groupId }) => groupId === "moodist:busy-street")
    assert.equal(busyStreet.sourceCounts.total, 21)
    assert.equal(busyStreet.sourceCounts.include, 17)
    assert.equal(busyStreet.sourceCounts.remove, 4)
  })

  it("preserves each valid legacy draft independently and owns the fingerprinted v3 storage identity", async () => {
    const {
      createSignatureSoundReviewWorkspaceStorageKey,
      migrateSignatureSoundReviewWorkspaceSafely,
    } = await loadWorkspaceModule()
    const baselines = fixtureBaselines()
    const result = migrateSignatureSoundReviewWorkspaceSafely({
      ...baselines,
      legacyRecordingReview: fixtureLegacyRecordingReview(),
      legacyGroupReview: { ...fixtureLegacyGroupReview(), version: 99 },
      updatedAt: "2026-08-24T12:00:00.000Z",
    })

    assert.deepEqual(result.warnings, ["legacy-group-review"])
    assert.equal(result.workspace.recordings[SOURCE_IDS[0]].note, "Prefer this for Traffic.")
    assert.deepEqual(result.workspace.groups, {})
    assert.equal(
      createSignatureSoundReviewWorkspaceStorageKey(baselines),
      `atmoshaper-signature-review-workspace-v3:${DISCOVERY_FINGERPRINT}:${CURATION_FINGERPRINT}`,
    )
  })

  it("updates recording observations and concept membership without leaking removal across concepts", async () => {
    const {
      createSignatureSoundReviewProjection,
      migrateSignatureSoundReviewWorkspace,
      updateSignatureSoundConceptAssignment,
      updateSignatureSoundRecording,
    } = await loadWorkspaceModule()
    const baselines = fixtureBaselines()
    let workspace = migrateSignatureSoundReviewWorkspace({
      ...baselines,
      legacyGroupReview: fixtureLegacyGroupReview(),
      updatedAt: "2026-08-24T12:00:00.000Z",
    })
    workspace = updateSignatureSoundRecording(workspace, baselines, {
      sourceId: SOURCE_IDS[0],
      decision: "keep",
      note: "Strong recording overall.",
      updatedAt: "2026-08-24T12:01:00.000Z",
    })
    workspace = updateSignatureSoundRecording(workspace, baselines, {
      sourceId: SOURCE_IDS[0],
      note: "Strong recording overall, with one distant horn.",
      updatedAt: "2026-08-24T12:01:30.000Z",
    })
    workspace = updateSignatureSoundConceptAssignment(workspace, baselines, {
      sourceId: SOURCE_IDS[0],
      groupId: "moodist:busy-street",
      decision: "remove",
      note: "Not busy enough.",
      updatedAt: "2026-08-24T12:02:00.000Z",
    })

    const projection = createSignatureSoundReviewProjection(workspace, baselines)
    const busyStreet = projection.groups.find(({ groupId }) => groupId === "moodist:busy-street")
    const traffic = projection.groups.find(({ groupId }) => groupId === "moodist:traffic")
    assert.equal(busyStreet.ingredients.find(({ sourceId }) => sourceId === SOURCE_IDS[0]).decision, "remove")
    assert.equal(traffic.ingredients.find(({ sourceId }) => sourceId === SOURCE_IDS[0]).decision, "include")
    assert.equal(
      projection.recordings.find(({ sourceId }) => sourceId === SOURCE_IDS[0]).overallNote,
      "Strong recording overall, with one distant horn.",
    )
    assert.equal(projection.recordings.find(({ sourceId }) => sourceId === SOURCE_IDS[0]).overallDecision, "keep")
    assert.equal(workspace.groups["moodist:busy-street"].decision, undefined)
    assert.equal(workspace.groups["moodist:busy-street"].auditionKey, undefined)
  })

  it("creates a collision-safe custom concept and immediately assigns the current recording", async () => {
    const {
      addSignatureSoundCustomConcept,
      createSignatureSoundReviewProjection,
      migrateSignatureSoundReviewWorkspace,
    } = await loadWorkspaceModule()
    const baselines = fixtureBaselines()
    const starting = migrateSignatureSoundReviewWorkspace({
      ...baselines,
      updatedAt: "2026-08-24T12:00:00.000Z",
    })
    const first = addSignatureSoundCustomConcept(starting, baselines, {
      sourceId: SOURCE_IDS[2],
      label: "Commuter Rush",
      updatedAt: "2026-08-24T12:01:00.000Z",
    })
    const second = addSignatureSoundCustomConcept(first.workspace, baselines, {
      sourceId: SOURCE_IDS[0],
      label: "Commuter-Rush",
      updatedAt: "2026-08-24T12:02:00.000Z",
    })

    assert.equal(first.groupId, "custom:commuter-rush")
    assert.equal(second.groupId, "custom:commuter-rush-2")
    const projection = createSignatureSoundReviewProjection(second.workspace, baselines)
    const custom = projection.groups.find(({ groupId }) => groupId === first.groupId)
    assert.deepEqual(custom.includedSourceIds, [SOURCE_IDS[2]])
    assert.throws(() => addSignatureSoundCustomConcept(first.workspace, baselines, {
      sourceId: SOURCE_IDS[0],
      label: "commuter rush",
      updatedAt: "2026-08-24T12:03:00.000Z",
    }), /duplicate|label|concept/i)
  })

  it("preserves audition evidence for notes but clears it when the exact heard setup changes", async () => {
    const {
      createSignatureSoundReviewProjection,
      migrateSignatureSoundReviewWorkspace,
      updateSignatureSoundGroup,
    } = await loadWorkspaceModule()
    const baselines = fixtureBaselines()
    let workspace = migrateSignatureSoundReviewWorkspace({
      ...baselines,
      legacyGroupReview: fixtureLegacyGroupReview(),
      updatedAt: "2026-08-24T12:00:00.000Z",
    })
    const before = createSignatureSoundReviewProjection(workspace, baselines)
      .groups.find(({ groupId }) => groupId === "moodist:busy-street")
    assert.equal(before.decision, "approve")
    assert.ok(before.auditionKey)

    workspace = updateSignatureSoundGroup(workspace, baselines, {
      groupId: "moodist:busy-street",
      note: "Favor the less horn-heavy recordings.",
      updatedAt: "2026-08-24T12:01:00.000Z",
    })
    assert.equal(workspace.groups["moodist:busy-street"].decision, "approve")
    assert.equal(workspace.groups["moodist:busy-street"].auditionKey, before.auditionKey)

    workspace = updateSignatureSoundGroup(workspace, baselines, {
      groupId: "moodist:busy-street",
      previewSettings: { transitionMode: "overlap", transitionSeconds: 1.5 },
      updatedAt: "2026-08-24T12:02:00.000Z",
    })
    assert.equal(workspace.groups["moodist:busy-street"].decision, undefined)
    assert.equal(workspace.groups["moodist:busy-street"].auditionedAt, undefined)
    assert.equal(workspace.groups["moodist:busy-street"].auditionKey, undefined)
  })
})
