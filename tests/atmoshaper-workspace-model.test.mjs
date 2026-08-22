import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { createAtmoShaperMixController } from "../lib/atmoshaper/mix-controller.js"

const model = await import("../components/atmoshaper/workspace-model.js").catch(() => ({}))

function requireModelFunction(name) {
  assert.equal(typeof model[name], "function", `workspace model must export ${name}`)
  return model[name]
}

function recipe(id, layers = []) {
  return { version: 1, id, name: "Test mix", artworkSeed: id, layers }
}

function layer(id, kind = "noise", overrides = {}) {
  return {
    id,
    kind,
    sourceId: `${id}-source`,
    volume: 0.5,
    muted: false,
    settings: {},
    ...overrides,
  }
}

function fakeHandle(log, initialLayer) {
  return {
    async fadeIn() { log.push(["fadeIn", initialLayer.id]) },
    async update(nextLayer) { log.push(["update", initialLayer.id, nextLayer.volume, nextLayer.muted]) },
    async pause() {},
    async resume() {},
    async fadeOutAndDispose() { log.push(["dispose", initialLayer.id]) },
  }
}

describe("AtmoShaper workspace ownership model", () => {
  it("adopts a retained provider recipe on remount without allocating a replacement id", () => {
    const initialize = requireModelFunction("initializeAtmoShaperWorkspaceRecipe")
    const retainedRecipe = recipe("retained", [layer("rain")])
    let idAllocations = 0

    const initialized = initialize({
      activePlaybackKind: "atmoshaper",
      retainedRecipe,
      createId() {
        idAllocations += 1
        return "new-id"
      },
    })

    assert.equal(initialized, retainedRecipe)
    assert.equal(idAllocations, 0)
  })

  it("keeps foreign active recipes silent until explicit Play transfers ownership", () => {
    const shouldSync = requireModelFunction("shouldSyncAtmoShaperWorkspaceRecipe")

    assert.equal(shouldSync({
      activePlaybackKind: "atmoshaper",
      localRecipeId: "local",
      providerRecipeId: "foreign",
    }), false)
    assert.equal(shouldSync({
      activePlaybackKind: "atmoshaper",
      localRecipeId: "local",
      providerRecipeId: "local",
    }), true)
    assert.equal(shouldSync({
      activePlaybackKind: "station",
      localRecipeId: "local",
      providerRecipeId: null,
    }), true)
  })

  it("pauses only the provider-owned recipe and otherwise starts the local recipe", () => {
    const transportAction = requireModelFunction("atmoShaperWorkspaceTransportAction")

    assert.equal(transportAction({
      activePlaybackKind: "atmoshaper",
      localRecipeId: "local",
      playbackState: "playing",
      providerRecipeId: "local",
    }), "pause")
    assert.equal(transportAction({
      activePlaybackKind: "atmoshaper",
      localRecipeId: "local",
      playbackState: "playing",
      providerRecipeId: "foreign",
    }), "play")
    assert.equal(transportAction({
      activePlaybackKind: "atmoshaper",
      localRecipeId: "local",
      playbackState: "paused",
      providerRecipeId: "local",
    }), "restart")
  })

  it("stops only the exact provider-owned AtmoShaper recipe", () => {
    const canStop = requireModelFunction("canStopAtmoShaperWorkspaceRecipe")

    assert.equal(canStop({
      activePlaybackKind: "station",
      localRecipeId: "local",
      playbackState: "playing",
      providerRecipeId: null,
    }), false)
    assert.equal(canStop({
      activePlaybackKind: "atmoshaper",
      localRecipeId: "local",
      playbackState: "playing",
      providerRecipeId: "foreign",
    }), false)
    assert.equal(canStop({
      activePlaybackKind: "atmoshaper",
      localRecipeId: "local",
      playbackState: "playing",
      providerRecipeId: "local",
    }), true)
    assert.equal(canStop({
      activePlaybackKind: "atmoshaper",
      localRecipeId: "local",
      playbackState: "stopped",
      providerRecipeId: "local",
    }), false)
  })

  it("projects and restores a retained audible predecessor after replacement failure", async () => {
    const projectRetained = requireModelFunction("projectRetainedAtmoShaperLayersForWorkspace")
    const restoreRetained = requireModelFunction("restoreRetainedAtmoShaperLayer")
    const log = []
    const oldStation = layer("station-old", "station")
    const failedStation = layer("station-new", "station")
    const controller = createAtmoShaperMixController({
      createAdapter(nextLayer) {
        if (nextLayer.id === failedStation.id) throw new Error("station unavailable")
        return fakeHandle(log, nextLayer)
      },
    })
    await controller.start(recipe("mix", [oldStation]))
    log.length = 0
    await controller.applyRecipe(recipe("mix", [failedStation]))

    const failedSnapshot = controller.getSnapshot()
    const retained = projectRetained({
      activePlaybackKind: "atmoshaper",
      activeLayers: failedSnapshot.activeLayers,
      localRecipe: failedSnapshot.recipe,
      providerRecipeId: failedSnapshot.recipe.id,
    })
    assert.deepEqual(retained, [oldStation])

    const restoredRecipe = restoreRetained(failedSnapshot.recipe, retained[0], {
      muted: true,
      volume: 0.2,
    })
    await controller.applyRecipe(restoredRecipe)

    assert.deepEqual(restoredRecipe.layers, [{ ...oldStation, muted: true, volume: 0.2 }])
    assert.deepEqual(log, [["update", oldStation.id, 0.2, true]])
    assert.deepEqual(controller.getSnapshot().activeLayers, {
      [oldStation.id]: { ...oldStation, muted: true, volume: 0.2 },
    })
  })

  it("removes the retained audible predecessor through a canonical exclusive-kind recipe", async () => {
    const projectRetained = requireModelFunction("projectRetainedAtmoShaperLayersForWorkspace")
    const removeRetained = requireModelFunction("removeRetainedAtmoShaperLayer")
    const log = []
    const oldStation = layer("station-old", "station")
    const failedStation = layer("station-new", "station")
    const controller = createAtmoShaperMixController({
      createAdapter(nextLayer) {
        if (nextLayer.id === failedStation.id) throw new Error("station unavailable")
        return fakeHandle(log, nextLayer)
      },
    })
    await controller.start(recipe("mix", [oldStation]))
    log.length = 0
    await controller.applyRecipe(recipe("mix", [failedStation]))
    const failedSnapshot = controller.getSnapshot()
    const [retained] = projectRetained({
      activePlaybackKind: "atmoshaper",
      activeLayers: failedSnapshot.activeLayers,
      localRecipe: failedSnapshot.recipe,
      providerRecipeId: failedSnapshot.recipe.id,
    })

    const removalRecipe = removeRetained(failedSnapshot.recipe, retained)
    await controller.applyRecipe(removalRecipe)

    assert.deepEqual(removalRecipe.layers, [])
    assert.deepEqual(log, [["dispose", oldStation.id]])
    assert.deepEqual(controller.getSnapshot().activeLayers, {})
  })

  it("chooses next row, then previous row, then the Current Mix heading after removal", () => {
    const focusTarget = requireModelFunction("focusTargetAfterAtmoShaperLayerRemoval")

    assert.equal(focusTarget(["rain", "wind", "birds"], "wind"), "birds")
    assert.equal(focusTarget(["rain", "wind"], "wind"), "rain")
    assert.equal(focusTarget(["rain"], "rain"), null)
    assert.equal(
      focusTarget(
        ["noise", "failed-station", "retained-station"],
        "retained-station",
        ["failed-station"],
      ),
      "noise",
    )
  })

  it("excludes either half of a failed exclusive replacement pair from the removal focus target", () => {
    const focusAfterVisibleRemoval = requireModelFunction(
      "focusTargetAfterAtmoShaperVisibleRowRemoval",
    )
    const noise = layer("noise")
    const failedStation = layer("failed-station", "station")
    const retainedStation = layer("retained-station", "station")
    const rows = [
      { key: noise.id, layer: noise, retained: false },
      { key: failedStation.id, layer: failedStation, retained: false },
      { key: retainedStation.id, layer: retainedStation, retained: true },
    ]

    assert.equal(focusAfterVisibleRemoval(rows, failedStation.id), noise.id)
    assert.equal(focusAfterVisibleRemoval(rows, retainedStation.id), noise.id)
  })

  it("does not project retained rows from a foreign provider owner", () => {
    const projectRetained = requireModelFunction("projectRetainedAtmoShaperLayersForWorkspace")
    const retainedStation = layer("retained-station", "station")

    assert.deepEqual(projectRetained({
      activePlaybackKind: "atmoshaper",
      activeLayers: { [retainedStation.id]: retainedStation },
      localRecipe: recipe("local", [layer("local-noise")]),
      providerRecipeId: "foreign",
    }), [])
  })

  it("compares a stale post-restore provider snapshot with the current local recipe", () => {
    const projectRetained = requireModelFunction("projectRetainedAtmoShaperLayersForWorkspace")
    const restoredStation = layer("retained-station", "station")

    assert.deepEqual(projectRetained({
      activePlaybackKind: "atmoshaper",
      activeLayers: { [restoredStation.id]: restoredStation },
      localRecipe: recipe("mix", [restoredStation]),
      providerRecipeId: "mix",
    }), [])
  })

  it("shows Retry only for an actual failed layer state, not an overall failed missing state", () => {
    const resolveState = requireModelFunction("resolveAtmoShaperVisibleLayerState")

    assert.deepEqual(resolveState({
      activePlaybackKind: "atmoshaper",
      layerState: undefined,
      localRecipeId: "mix",
      providerError: null,
      providerRecipeId: "mix",
      snapshotStatus: "loading",
    }), { status: "loading" })
    assert.deepEqual(resolveState({
      activePlaybackKind: "atmoshaper",
      layerState: undefined,
      localRecipeId: "mix",
      providerError: "Audio policy denied this layer.",
      providerRecipeId: "mix",
      snapshotStatus: "failed",
    }), { status: "ready" })
    assert.deepEqual(resolveState({
      activePlaybackKind: "atmoshaper",
      layerState: { status: "failed", error: "Brown noise failed." },
      localRecipeId: "mix",
      providerError: "AtmoShaper could not start any layer.",
      providerRecipeId: "mix",
      snapshotStatus: "failed",
    }), { status: "failed", error: "Brown noise failed." })
    assert.deepEqual(resolveState({
      activePlaybackKind: "station",
      layerState: undefined,
      localRecipeId: "mix",
      providerError: "Foreign error",
      providerRecipeId: null,
      snapshotStatus: "failed",
    }), { status: "ready" })
  })
})
