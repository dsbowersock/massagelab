import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { dirname, join, resolve } from "node:path"
import { describe, it } from "node:test"
import { fileURLToPath } from "node:url"

import { createSignatureSoundConstructionAudition } from "../lib/atmoshaper/signature-sound-construction-audition.js"
import {
  createSignatureSoundConstructionAuditionConfiguration,
  createSignatureSoundConstructionAuditionKey,
  createSignatureSoundConstructionQa,
  createSignatureSoundConstructionQaStorageKey,
  clearSignatureSoundConstructionQaAudition,
  recordSignatureSoundConstructionQaAudition,
  renderSignatureSoundConstructionQaJson,
  updateSignatureSoundConstructionQaDecision,
  updateSignatureSoundConstructionQaNote,
  validateSignatureSoundConstructionQa,
} from "../lib/atmoshaper/signature-sound-construction-qa.js"
import * as constructionQaStorageOwner from "../lib/atmoshaper/signature-sound-construction-qa-storage.js"

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const firstTime = "2026-08-25T12:00:00.000Z"
const secondTime = "2026-08-25T12:05:00.000Z"

async function readJson(relativePath) {
  return JSON.parse(await readFile(join(repoRoot, relativePath), "utf8"))
}

async function loadAudition() {
  const [
    moodistConcepts,
    discoveryReview,
    exportedListeningReview,
    listeningReview,
    strategyPolicy,
    workspace,
    interpretations,
    constructionReview,
  ] = await Promise.all([
    readJson("data/atmoshaper/moodist-concepts.json"),
    readJson("data/atmoshaper/signature-sound-review.json"),
    readJson("tests/fixtures/atmoshaper/signature-listening-review-v1-a22a9d19d8.json"),
    readJson("data/atmoshaper/signature-sound-listening-review.json"),
    readJson("data/atmoshaper/signature-sound-playback-strategies.json"),
    readJson("tests/fixtures/atmoshaper/signature-complete-review-v3-a22a9d19d8.json"),
    readJson("data/atmoshaper/signature-sound-construction-interpretations.json"),
    readJson("data/atmoshaper/signature-sound-construction-review.json"),
  ])
  return createSignatureSoundConstructionAudition(constructionReview, {
    moodistConcepts,
    discoveryReview,
    exportedListeningReview,
    listeningReview,
    strategyPolicy,
    workspace,
    interpretations,
  })
}

function byGroup(audition, groupId) {
  const group = audition.groups.find((candidate) => candidate.groupId === groupId)
  assert.ok(group, `expected construction audition group ${groupId}`)
  return group
}

describe("AtmoShaper Signature construction QA", () => {
  it("creates fresh exportable QA when initial browser storage is unavailable", async () => {
    assert.equal(
      typeof constructionQaStorageOwner.loadSignatureSoundConstructionQa,
      "function",
      "construction QA must distinguish unavailable storage from invalid saved data",
    )
    const audition = await loadAudition()
    const loaded = constructionQaStorageOwner.loadSignatureSoundConstructionQa(() => {
      throw new DOMException("Storage access denied", "SecurityError")
    }, "construction-qa", audition, firstTime)

    assert.equal(loaded.persistenceAvailable, false)
    assert.deepEqual(loaded.qa, createSignatureSoundConstructionQa(audition, firstTime))
    assert.doesNotThrow(() => renderSignatureSoundConstructionQaJson(loaded.qa, audition))
  })

  it("leaves invalid saved QA unavailable for recovery instead of replacing it", async () => {
    assert.equal(typeof constructionQaStorageOwner.loadSignatureSoundConstructionQa, "function")
    const audition = await loadAudition()
    let writes = 0
    const storage = {
      getItem() { return "{invalid construction QA" },
      setItem() { writes += 1 },
    }

    assert.throws(() => constructionQaStorageOwner.loadSignatureSoundConstructionQa(
      () => storage,
      "construction-qa",
      audition,
      firstTime,
    ), /json|unexpected|property|position/i)
    assert.equal(writes, 0)
  })

  it("preserves exportable in-memory QA when persistence fails and reports later recovery", async () => {
    assert.equal(
      typeof constructionQaStorageOwner.persistSignatureSoundConstructionQa,
      "function",
      "construction QA must own fail-safe browser persistence",
    )
    const audition = await loadAudition()
    const qa = createSignatureSoundConstructionQa(audition, firstTime)
    const expectedJson = renderSignatureSoundConstructionQaJson(qa, audition)
    let rejectWrite = true
    let storedJson = null
    const storage = {
      setItem(_key, json) {
        if (rejectWrite) throw new DOMException("Storage quota exceeded", "QuotaExceededError")
        storedJson = json
      },
    }

    assert.equal(
      constructionQaStorageOwner.persistSignatureSoundConstructionQa(() => storage, "construction-qa", qa, audition),
      false,
    )
    assert.equal(renderSignatureSoundConstructionQaJson(qa, audition), expectedJson)
    assert.equal(storedJson, null)

    rejectWrite = false
    assert.equal(
      constructionQaStorageOwner.persistSignatureSoundConstructionQa(() => storage, "construction-qa", qa, audition),
      true,
    )
    assert.equal(storedJson, expectedJson)
    assert.equal(
      constructionQaStorageOwner.persistSignatureSoundConstructionQa(() => {
        throw new DOMException("Storage access denied", "SecurityError")
      }, "construction-qa", qa, audition),
      false,
    )
  })

  it("imports exact QA JSON and rejects malformed or stale input without mutating current work", async () => {
    assert.equal(
      typeof constructionQaStorageOwner.parseSignatureSoundConstructionQaJson,
      "function",
      "construction QA must support closed recovery from its exported JSON",
    )
    const audition = await loadAudition()
    const current = createSignatureSoundConstructionQa(audition, firstTime)
    const dryer = byGroup(audition, "moodist:dryer")
    const configuration = createSignatureSoundConstructionAuditionConfiguration(dryer)
    const returned = recordSignatureSoundConstructionQaAudition(current, audition, {
      groupId: dryer.groupId,
      configuration,
      auditionedAt: secondTime,
    })
    const currentBefore = structuredClone(current)
    const imported = constructionQaStorageOwner.parseSignatureSoundConstructionQaJson(
      renderSignatureSoundConstructionQaJson(returned, audition),
      audition,
    )

    assert.deepEqual(imported, returned)
    assert.notEqual(imported, returned)
    assert.deepEqual(current, currentBefore)
    assert.throws(
      () => constructionQaStorageOwner.parseSignatureSoundConstructionQaJson("{invalid", audition),
      /json|unexpected|property|position/i,
    )
    const stale = structuredClone(returned)
    stale.constructionReviewSha256 = "f".repeat(64)
    assert.throws(
      () => constructionQaStorageOwner.parseSignatureSoundConstructionQaJson(JSON.stringify(stale), audition),
      /fingerprint|match/i,
    )
    assert.deepEqual(current, currentBefore)
  })

  it("creates a separate fingerprinted sparse record and deterministic storage identity", async () => {
    const audition = await loadAudition()
    const qa = createSignatureSoundConstructionQa(audition, firstTime)

    assert.deepEqual(qa, {
      version: 1,
      constructionReviewSha256: audition.constructionReviewSha256,
      algorithmVersion: audition.algorithmVersion,
      updatedAt: firstTime,
      groups: {},
    })
    assert.equal(
      createSignatureSoundConstructionQaStorageKey(audition),
      `atmoshaper-signature-construction-qa-v1:${audition.constructionReviewSha256}:${audition.algorithmVersion}`,
    )
    assert.deepEqual(validateSignatureSoundConstructionQa(qa, audition), qa)
  })

  it("preserves rebuild decisions and exact accepted constructions", async () => {
    const audition = await loadAudition()
    const decisions = await readJson("data/atmoshaper/signature-sound-construction-qa-decisions.json")
    const normalized = validateSignatureSoundConstructionQa(decisions, audition)

    assert.deepEqual(Object.keys(normalized.groups), [
      "moodist:dryer",
      "moodist:walk-on-gravel",
      "moodist:walk-on-leaves",
      "signature-extra:air-traffic-control",
      "signature-extra:horror-suspense",
      "signature-extra:moon-footsteps",
      "signature-extra:sci-fi-whistles",
      "signature-extra:underwater-effects",
    ])
    assert.equal(normalized.groups["moodist:walk-on-gravel"].decision, "needs-rework")
    assert.equal(normalized.groups["moodist:walk-on-leaves"].decision, "needs-rework")
    assert.equal("auditionKey" in normalized.groups["moodist:walk-on-gravel"], false)
    assert.equal("scope" in normalized.groups["moodist:walk-on-leaves"], false)

    for (const [groupId, scope] of [
      ["moodist:dryer", "playback-only"],
      ["signature-extra:air-traffic-control", "playback-only"],
      ["signature-extra:horror-suspense", "complete-construction"],
      ["signature-extra:moon-footsteps", "complete-construction"],
      ["signature-extra:sci-fi-whistles", "playback-only"],
      ["signature-extra:underwater-effects", "complete-construction"],
    ]) {
      const group = byGroup(audition, groupId)
      const decision = normalized.groups[groupId]
      const configuration = createSignatureSoundConstructionAuditionConfiguration(group)

      assert.equal(decision.decision, "pass")
      assert.equal(decision.scope, scope)
      assert.equal(decision.auditionKey, createSignatureSoundConstructionAuditionKey(
        audition,
        groupId,
        configuration,
      ))
      assert.deepEqual(decision.configuration, configuration)
      assert.match(decision.auditionedAt, /^2026-08-25T/)
    }

  })

  it("binds a decision to the exact sources, scheduler policy, settings, and heard time", async () => {
    const audition = await loadAudition()
    const horror = byGroup(audition, "signature-extra:horror-suspense")
    const configuration = createSignatureSoundConstructionAuditionConfiguration(horror)
    let qa = createSignatureSoundConstructionQa(audition, firstTime)
    qa = updateSignatureSoundConstructionQaNote(qa, audition, {
      groupId: horror.groupId,
      note: "The variable gaps feel natural.",
      updatedAt: firstTime,
    })
    qa = recordSignatureSoundConstructionQaAudition(qa, audition, {
      groupId: horror.groupId,
      configuration,
      auditionedAt: firstTime,
    })
    qa = updateSignatureSoundConstructionQaDecision(qa, audition, {
      groupId: horror.groupId,
      decision: "pass",
      scope: "complete-construction",
      updatedAt: secondTime,
    })

    assert.deepEqual(qa.groups[horror.groupId], {
      note: "The variable gaps feel natural.",
      auditionedAt: firstTime,
      auditionKey: createSignatureSoundConstructionAuditionKey(audition, horror.groupId, configuration),
      configuration,
      decision: "pass",
      scope: "complete-construction",
    })
    assert.equal(qa.updatedAt, secondTime)
    assert.equal(renderSignatureSoundConstructionQaJson(qa, audition), `${JSON.stringify(qa, null, 2)}\n`)
  })

  it("records note-backed rebuild and rejection decisions without fabricating heard evidence", async () => {
    const audition = await loadAudition()
    const gravel = byGroup(audition, "moodist:walk-on-gravel")
    const leaves = byGroup(audition, "moodist:walk-on-leaves")
    let qa = createSignatureSoundConstructionQa(audition, firstTime)
    qa = updateSignatureSoundConstructionQaNote(qa, audition, {
      groupId: gravel.groupId,
      note: "Some recordings sound reversed and need ingredient review.",
      updatedAt: firstTime,
    })
    qa = updateSignatureSoundConstructionQaDecision(qa, audition, {
      groupId: gravel.groupId,
      decision: "needs-rework",
      updatedAt: secondTime,
    })
    qa = updateSignatureSoundConstructionQaNote(qa, audition, {
      groupId: leaves.groupId,
      note: "Some included recordings do not sound like footsteps.",
      updatedAt: secondTime,
    })
    qa = updateSignatureSoundConstructionQaDecision(qa, audition, {
      groupId: leaves.groupId,
      decision: "reject",
      updatedAt: "2026-08-25T12:05:00.000Z",
    })

    assert.deepEqual(qa.groups[gravel.groupId], {
      note: "Some recordings sound reversed and need ingredient review.",
      decision: "needs-rework",
    })
    assert.deepEqual(qa.groups[leaves.groupId], {
      note: "Some included recordings do not sound like footsteps.",
      decision: "reject",
    })
  })

  it("keeps unauditioned approval and unexplained negative decisions fail-closed", async () => {
    const audition = await loadAudition()
    const gravel = byGroup(audition, "moodist:walk-on-gravel")
    let qa = createSignatureSoundConstructionQa(audition, firstTime)

    assert.throws(() => updateSignatureSoundConstructionQaDecision(qa, audition, {
      groupId: gravel.groupId,
      decision: "pass",
      scope: "complete-construction",
      updatedAt: secondTime,
    }), /requires an audition/i)
    assert.throws(() => updateSignatureSoundConstructionQaDecision(qa, audition, {
      groupId: gravel.groupId,
      decision: "needs-rework",
      updatedAt: secondTime,
    }), /requires a note/i)

    qa = updateSignatureSoundConstructionQaNote(qa, audition, {
      groupId: gravel.groupId,
      note: "Needs ingredient review.",
      updatedAt: firstTime,
    })
    assert.throws(() => updateSignatureSoundConstructionQaDecision(qa, audition, {
      groupId: gravel.groupId,
      decision: "needs-rework",
      scope: "complete-construction",
      updatedAt: secondTime,
    }), /scope.*audition|audition.*scope/i)
  })

  it("supports the Gravel boundary A/B configuration while rejecting unsupported policy drift", async () => {
    const audition = await loadAudition()
    const gravel = byGroup(audition, "moodist:walk-on-gravel")
    const crossfade = createSignatureSoundConstructionAuditionConfiguration(gravel, {
      mode: "crossfade",
      crossfadeSeconds: 0.12,
    })
    const overlap = createSignatureSoundConstructionAuditionConfiguration(gravel, {
      mode: "overlap",
      crossfadeSeconds: 0,
    })

    assert.notEqual(
      createSignatureSoundConstructionAuditionKey(audition, gravel.groupId, crossfade),
      createSignatureSoundConstructionAuditionKey(audition, gravel.groupId, overlap),
    )
    assert.throws(
      () => createSignatureSoundConstructionAuditionConfiguration(gravel, { mode: "end-to-end", crossfadeSeconds: 0 }),
      /boundary|mode/i,
    )
    assert.throws(
      () => createSignatureSoundConstructionAuditionConfiguration(gravel, { mode: "crossfade", crossfadeSeconds: 3 }),
      /crossfade/i,
    )
    assert.throws(
      () => createSignatureSoundConstructionAuditionConfiguration(byGroup(audition, "moodist:walk-on-leaves"), {
        mode: "overlap",
        crossfadeSeconds: 0,
      }),
      /boundary/i,
    )
  })

  it("keeps processing-pending QA playback-only and blocked groups undecidable", async () => {
    const audition = await loadAudition()
    const airTraffic = byGroup(audition, "signature-extra:air-traffic-control")
    const stone = byGroup(audition, "signature-extra:walk-on-stone")
    let qa = createSignatureSoundConstructionQa(audition, firstTime)
    qa = recordSignatureSoundConstructionQaAudition(qa, audition, {
      groupId: airTraffic.groupId,
      configuration: createSignatureSoundConstructionAuditionConfiguration(airTraffic),
      auditionedAt: firstTime,
    })

    assert.throws(() => updateSignatureSoundConstructionQaDecision(qa, audition, {
      groupId: airTraffic.groupId,
      decision: "pass",
      scope: "complete-construction",
      updatedAt: secondTime,
    }), /playback-only|processing/i)
    assert.doesNotThrow(() => updateSignatureSoundConstructionQaDecision(qa, audition, {
      groupId: airTraffic.groupId,
      decision: "needs-rework",
      scope: "playback-only",
      updatedAt: secondTime,
    }))
    assert.throws(() => recordSignatureSoundConstructionQaAudition(qa, audition, {
      groupId: stone.groupId,
      configuration: createSignatureSoundConstructionAuditionConfiguration(stone),
      auditionedAt: firstTime,
    }), /blocked/i)
  })

  it("invalidates only the changed group's heard configuration while preserving its note", async () => {
    const audition = await loadAudition()
    const gravel = byGroup(audition, "moodist:walk-on-gravel")
    const horror = byGroup(audition, "signature-extra:horror-suspense")
    let qa = createSignatureSoundConstructionQa(audition, firstTime)
    for (const group of [gravel, horror]) {
      qa = updateSignatureSoundConstructionQaNote(qa, audition, {
        groupId: group.groupId,
        note: `${group.label} note`,
        updatedAt: firstTime,
      })
      qa = recordSignatureSoundConstructionQaAudition(qa, audition, {
        groupId: group.groupId,
        configuration: createSignatureSoundConstructionAuditionConfiguration(
          group,
          group.groupId === gravel.groupId ? { mode: "crossfade", crossfadeSeconds: 0.12 } : undefined,
        ),
        auditionedAt: firstTime,
      })
      qa = updateSignatureSoundConstructionQaDecision(qa, audition, {
        groupId: group.groupId,
        decision: "pass",
        scope: group.allowedQaScopes.at(-1),
        updatedAt: secondTime,
      })
    }

    const cleared = clearSignatureSoundConstructionQaAudition(qa, audition, {
      groupId: gravel.groupId,
      updatedAt: "2026-08-25T12:10:00.000Z",
    })
    assert.deepEqual(cleared.groups[gravel.groupId], { note: "Walk on Gravel note" })
    assert.deepEqual(cleared.groups[horror.groupId], qa.groups[horror.groupId])
    assert.equal(cleared.updatedAt, "2026-08-25T12:10:00.000Z")
  })

  it("fails closed on stale identities, unknown fields, groups, algorithms, and incomplete decisions", async () => {
    const audition = await loadAudition()
    const leaves = byGroup(audition, "moodist:walk-on-leaves")
    const configuration = createSignatureSoundConstructionAuditionConfiguration(leaves)
    let qa = createSignatureSoundConstructionQa(audition, firstTime)
    qa = recordSignatureSoundConstructionQaAudition(qa, audition, {
      groupId: leaves.groupId,
      configuration,
      auditionedAt: firstTime,
    })

    const mutations = [
      (draft) => { draft.fabricated = true },
      (draft) => { draft.algorithmVersion = "signature-construction-audition-v0" },
      (draft) => { draft.constructionReviewSha256 = "0".repeat(64) },
      (draft) => { draft.groups["fabricated:group"] = { note: "" } },
      (draft) => { draft.groups[leaves.groupId].auditionKey = "stale" },
      (draft) => { draft.groups[leaves.groupId].configuration.includedSourceIds.pop() },
      (draft) => { draft.groups[leaves.groupId].configuration.previewSettings.stepsPerMinute = 180 },
      (draft) => { draft.groups[leaves.groupId].decision = "pass" },
    ]
    for (const mutate of mutations) {
      const draft = structuredClone(qa)
      mutate(draft)
      assert.throws(() => validateSignatureSoundConstructionQa(draft, audition), /unknown|algorithm|fingerprint|group|audition|source|settings|scope|decision|configuration/i)
    }

    const before = structuredClone(qa)
    const normalized = validateSignatureSoundConstructionQa(qa, audition)
    normalized.groups[leaves.groupId].note = "changed"
    assert.deepEqual(qa, before)
    assert.notDeepEqual(normalized, validateSignatureSoundConstructionQa(qa, audition))
  })
})
