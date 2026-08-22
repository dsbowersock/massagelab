import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  atmoShaperPreviewMatchesCandidate,
  beginSoundLibraryPendingCommit,
  createAtmoShaperLayerSelectionRequest,
  createSoundLibraryCandidateLayer,
  getAtmoShaperSourceConfigurationKey,
  resolveSoundLibraryCommit,
  resolveSoundLibraryPreviewAnnouncement,
  resolveSoundLibraryPromotionSettlement,
  settleSoundLibraryPendingCommit,
  soundLibraryCommitIsPending,
} from "../components/atmoshaper/sound-library-model.js"

function recipe(layers = []) {
  return {
    version: 1,
    id: "library-test",
    name: "Library test",
    artworkSeed: "library-test",
    layers,
  }
}

function candidate(overrides = {}) {
  return createSoundLibraryCandidateLayer({
    kind: "noise",
    sourceId: "noise:pink",
    volume: 0.55,
    muted: false,
    settings: { color: "pink" },
    ...overrides,
  })
}

function pendingTransaction(overrides = {}) {
  const layer = candidate()
  const priorRecipe = recipe()
  return {
    generation: 1,
    sourceKey: getAtmoShaperSourceConfigurationKey(layer),
    sourceName: "Pink noise",
    priorRecipe,
    optimisticRecipe: recipe([layer]),
    ...overrides,
  }
}

function deferred() {
  let resolve
  const promise = new Promise((settle) => {
    resolve = settle
  })
  return { promise, resolve }
}

describe("AtmoShaper Sound Library decisions", () => {
  it("keeps consecutive focus requests for the same layer distinct", () => {
    const first = createAtmoShaperLayerSelectionRequest(null, "pink-noise")
    const second = createAtmoShaperLayerSelectionRequest(first, "pink-noise")

    assert.deepEqual(first, { layerId: "pink-noise", requestKey: 1 })
    assert.deepEqual(second, { layerId: "pink-noise", requestKey: 2 })
    assert.notDeepEqual(first, second)
  })

  it("creates a stable candidate identity from source configuration", () => {
    const first = candidate({ settings: { color: "pink", shape: { b: 2, a: 1 } } })
    const second = candidate({
      volume: 0.9,
      muted: true,
      settings: { shape: { a: 1, b: 2 }, color: "pink" },
    })

    assert.equal(first.id, second.id)
    assert.equal(
      getAtmoShaperSourceConfigurationKey(first),
      getAtmoShaperSourceConfigurationKey(second),
    )
    assert.notStrictEqual(first.settings, second.settings)
  })

  it("keeps preview volume outside card matching", () => {
    const layer = candidate()
    const preview = {
      layer: { ...layer, volume: 0.2 },
      status: "playing",
    }

    assert.equal(atmoShaperPreviewMatchesCandidate(preview, layer), true)
    assert.equal(
      atmoShaperPreviewMatchesCandidate(preview, candidate({ settings: { color: "brown" } })),
      false,
    )
  })

  it("commits the live preview layer with the same adoptable id", () => {
    const layer = candidate()
    const preview = { layer: { ...layer, volume: 0.35 }, status: "playing" }
    const resolution = resolveSoundLibraryCommit(recipe(), preview.layer)

    assert.equal(resolution.type, "commit")
    assert.strictEqual(resolution.layer, preview.layer)
    assert.equal(resolution.layer.id, layer.id)
  })

  it("selects an exact existing source without duplicating volume or mute variants", () => {
    const layer = candidate()
    const existing = { ...layer, id: "committed-pink", volume: 0.87, muted: true }

    assert.deepEqual(resolveSoundLibraryCommit(recipe([existing]), layer), {
      type: "select-existing",
      layerId: "committed-pink",
    })
  })

  it("commits differing brainwave settings for domain-owned exclusive replacement", () => {
    const alpha = candidate({
      kind: "binaural",
      sourceId: "binaural:alpha",
      volume: 0.5,
      settings: { carrierHz: 220, beatHz: 10 },
    })
    const adjusted = candidate({
      kind: "binaural",
      sourceId: "binaural:alpha",
      volume: 0.5,
      settings: { carrierHz: 220, beatHz: 12 },
    })

    assert.notEqual(alpha.id, adjusted.id)
    assert.deepEqual(resolveSoundLibraryCommit(recipe([alpha]), adjusted), {
      type: "commit",
      layer: adjusted,
    })
  })

  it("keeps station and generated-noise identities source-specific", () => {
    const pink = candidate()
    const brown = candidate({ sourceId: "noise:brown", settings: { color: "brown" } })
    const station = candidate({
      kind: "station",
      sourceId: "little-bells",
      volume: 0.75,
      settings: {},
    })

    assert.notEqual(pink.id, brown.id)
    assert.notEqual(pink.id, station.id)
    assert.notEqual(
      getAtmoShaperSourceConfigurationKey(brown),
      getAtmoShaperSourceConfigurationKey(station),
    )
  })

  it("guards a rapid duplicate Add before it can stop its in-flight preview", async () => {
    const layer = candidate()
    const sourceKey = getAtmoShaperSourceConfigurationKey(layer)
    const providerSettlement = deferred()
    let currentRecipe = recipe()
    let pendingTransactions = []
    let promotionCalls = 0
    let stopPreviewCalls = 0

    async function add() {
      if (soundLibraryCommitIsPending(pendingTransactions, sourceKey)) return "ignored"
      const resolution = resolveSoundLibraryCommit(currentRecipe, layer)
      if (resolution.type === "select-existing") {
        stopPreviewCalls += 1
        return "selected"
      }

      const transaction = pendingTransaction({
        generation: promotionCalls + 1,
        priorRecipe: currentRecipe,
        optimisticRecipe: recipe([...currentRecipe.layers, layer]),
      })
      const started = beginSoundLibraryPendingCommit(pendingTransactions, transaction)
      assert.equal(started.status, "started")
      pendingTransactions = started.pendingTransactions
      currentRecipe = transaction.optimisticRecipe
      promotionCalls += 1
      const settlement = await providerSettlement.promise
      currentRecipe = resolveSoundLibraryPromotionSettlement(
        currentRecipe,
        transaction,
        settlement,
      ).recipe
      pendingTransactions = settleSoundLibraryPendingCommit(
        pendingTransactions,
        transaction.generation,
      ).pendingTransactions
      return settlement.status
    }

    const firstAdd = add()
    assert.equal(await add(), "ignored")
    assert.equal(promotionCalls, 1)
    assert.equal(stopPreviewCalls, 0)
    providerSettlement.resolve({ status: "promoted" })
    assert.equal(await firstAdd, "promoted")
    assert.deepEqual(currentRecipe.layers, [layer])
  })

  it("keeps promoted recipes and conditionally rolls back failed or superseded ones", () => {
    const transaction = pendingTransaction()

    assert.deepEqual(
      resolveSoundLibraryPromotionSettlement(
        transaction.optimisticRecipe,
        transaction,
        { status: "promoted" },
      ),
      {
        type: "keep",
        recipe: transaction.optimisticRecipe,
        announcement: "Pink noise added.",
        syncRevisionDelta: 0,
      },
    )
    assert.deepEqual(
      resolveSoundLibraryPromotionSettlement(
        transaction.optimisticRecipe,
        transaction,
        { status: "failed", error: "Audio start failed." },
      ),
      {
        type: "rollback",
        recipe: transaction.priorRecipe,
        announcement: "Pink noise preview could not be added: Audio start failed.",
        syncRevisionDelta: 1,
      },
    )
    assert.deepEqual(
      resolveSoundLibraryPromotionSettlement(
        transaction.optimisticRecipe,
        transaction,
        { status: "superseded" },
      ),
      {
        type: "rollback",
        recipe: transaction.priorRecipe,
        announcement: null,
        syncRevisionDelta: 0,
      },
    )
  })

  it("retains intervening recipe edits with a recoverable failed-settlement announcement", () => {
    const transaction = pendingTransaction()
    const editedRecipe = {
      ...transaction.optimisticRecipe,
      name: "Edited while adding",
    }
    const resolution = resolveSoundLibraryPromotionSettlement(
      editedRecipe,
      transaction,
      { status: "failed", error: "Transfer failed." },
    )

    assert.equal(resolution.type, "retain")
    assert.strictEqual(resolution.recipe, editedRecipe)
    assert.equal(resolution.syncRevisionDelta, 1)
    assert.match(resolution.announcement, /other mix edits were kept and are being applied normally/)
    assert.doesNotMatch(resolution.announcement, /Play|Retry/)
  })

  it("forces one reconciliation for a retained failed settlement without another edit", () => {
    const transaction = pendingTransaction()
    const editedRecipe = {
      ...transaction.optimisticRecipe,
      name: "Keep this edit",
    }
    const previousOwnerState = { recipe: editedRecipe, syncRevision: 8 }
    const resolution = resolveSoundLibraryPromotionSettlement(
      previousOwnerState.recipe,
      transaction,
      { status: "failed", error: "Transfer failed." },
    )
    const nextOwnerState = {
      recipe: resolution.recipe,
      syncRevision: previousOwnerState.syncRevision + resolution.syncRevisionDelta,
    }
    let reconciliationRequests = 0
    const reconcileWhenDependenciesChange = (previous, next) => {
      if (
        previous.recipe !== next.recipe
        || previous.syncRevision !== next.syncRevision
      ) reconciliationRequests += 1
    }

    reconcileWhenDependenciesChange(previousOwnerState, nextOwnerState)
    reconcileWhenDependenciesChange(nextOwnerState, nextOwnerState)

    assert.strictEqual(nextOwnerState.recipe, editedRecipe)
    assert.equal(nextOwnerState.syncRevision, 9)
    assert.equal(reconciliationRequests, 1)
  })

  it("does not force reconciliation when a newer owner supersedes an edited transaction", () => {
    const transaction = pendingTransaction()
    const newerOwnerRecipe = {
      ...transaction.optimisticRecipe,
      name: "Newer owner intent",
    }
    const resolution = resolveSoundLibraryPromotionSettlement(
      newerOwnerRecipe,
      transaction,
      { status: "superseded" },
    )

    assert.equal(resolution.type, "retain")
    assert.strictEqual(resolution.recipe, newerOwnerRecipe)
    assert.equal(resolution.syncRevisionDelta, 0)
    assert.match(resolution.announcement, /current mix edits were kept/)
  })

  it("settles only the exact generation and never clears a newer pending source", () => {
    const older = pendingTransaction({ generation: 4 })
    const newer = pendingTransaction({
      generation: 5,
      sourceKey: getAtmoShaperSourceConfigurationKey(candidate({
        sourceId: "noise:brown",
        settings: { color: "brown" },
      })),
    })
    const pendingTransactions = [older, newer]

    const firstStart = beginSoundLibraryPendingCommit([], older)
    assert.equal(firstStart.status, "started")
    const duplicateStart = beginSoundLibraryPendingCommit(
      firstStart.pendingTransactions,
      pendingTransaction({ generation: 6 }),
    )
    assert.equal(duplicateStart.status, "ignored")
    assert.strictEqual(duplicateStart.pendingTransactions, firstStart.pendingTransactions)

    const stale = settleSoundLibraryPendingCommit(pendingTransactions, 3)
    assert.equal(stale.owned, false)
    assert.strictEqual(stale.pendingTransactions, pendingTransactions)

    const settledOlder = settleSoundLibraryPendingCommit(pendingTransactions, 4)
    assert.equal(settledOlder.owned, true)
    assert.deepEqual(settledOlder.pendingTransactions, [newer])
    assert.equal(soundLibraryCommitIsPending(settledOlder.pendingTransactions, newer.sourceKey), true)

    const newerSameSource = pendingTransaction({ generation: 7 })
    const staleSameSourceSettlement = settleSoundLibraryPendingCommit([newerSameSource], 4)
    assert.equal(staleSameSourceSettlement.owned, false)
    assert.deepEqual(staleSameSourceSettlement.pendingTransactions, [newerSameSource])
  })

  it("deduplicates preview status announcements and ignores preview volume changes", () => {
    const layer = candidate()
    const loading = resolveSoundLibraryPreviewAnnouncement(
      null,
      { layer, status: "loading" },
      "Pink noise",
    )
    assert.equal(loading.message, "Pink noise preview loading.")

    const volumeOnly = resolveSoundLibraryPreviewAnnouncement(
      loading.state,
      { layer: { ...layer, volume: 0.1 }, status: "loading" },
      "Pink noise",
    )
    assert.equal(volumeOnly.message, null)

    const playing = resolveSoundLibraryPreviewAnnouncement(
      volumeOnly.state,
      { layer, status: "playing" },
      "Pink noise",
    )
    assert.equal(playing.message, "Pink noise preview playing.")
    const paused = resolveSoundLibraryPreviewAnnouncement(
      playing.state,
      { layer, status: "paused" },
      "Pink noise",
    )
    assert.equal(paused.message, "Pink noise preview paused.")
    const failed = resolveSoundLibraryPreviewAnnouncement(
      paused.state,
      { layer, status: "failed", error: "Audio unavailable." },
      "Pink noise",
    )
    assert.equal(failed.message, "Pink noise preview failed: Audio unavailable.")
    assert.equal(
      resolveSoundLibraryPreviewAnnouncement(failed.state, null, null).message,
      "Pink noise preview stopped.",
    )
  })
})
