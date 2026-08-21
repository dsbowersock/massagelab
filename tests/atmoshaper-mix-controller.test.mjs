import assert from "node:assert/strict"
import test from "node:test"

import { createAtmoShaperMixController } from "../lib/atmoshaper/mix-controller.js"

function createFakeHandle(log, layer) {
  return {
    async fadeIn() { log.push(["fadeIn", layer.id]) },
    async update(nextLayer) { log.push(["update", layer.id, nextLayer.volume]) },
    async pause() { log.push(["pause", layer.id]) },
    async resume() { log.push(["resume", layer.id]) },
    async fadeOutAndDispose() { log.push(["dispose", layer.id]) },
  }
}

function recipe(layers) {
  return {
    version: 1,
    id: "mix",
    name: "Test mix",
    artworkSeed: "mix",
    layers,
  }
}

function layer(id, kind = "noise", volume = 0.5) {
  return { id, kind, sourceId: `${id}-source`, volume, muted: false, settings: {} }
}

test("start prepares and fades in every recipe layer through its adapter", async () => {
  const log = []
  const snapshots = []
  const controller = createAtmoShaperMixController({
    createAdapter(nextLayer) {
      log.push(["create", nextLayer.id])
      return createFakeHandle(log, nextLayer)
    },
    onSnapshot(snapshot) { snapshots.push(snapshot) },
  })

  await controller.start(recipe([layer("rain"), layer("wind", "ambient")]))

  assert.deepEqual(log, [
    ["create", "rain"], ["fadeIn", "rain"],
    ["create", "wind"], ["fadeIn", "wind"],
  ])
  assert.equal(controller.getSnapshot().status, "playing")
  assert.deepEqual(controller.getSnapshot().layers, {
    rain: { status: "playing" },
    wind: { status: "playing" },
  })
  assert.equal(snapshots.at(-1).status, "playing")
})

test("applyRecipe updates retained layers, disposes removed layers, and prepares additions", async () => {
  const log = []
  const controller = createAtmoShaperMixController({
    createAdapter(nextLayer) {
      log.push(["create", nextLayer.id])
      return createFakeHandle(log, nextLayer)
    },
  })
  await controller.start(recipe([layer("rain"), layer("wind", "ambient")]))
  log.length = 0

  await controller.applyRecipe(recipe([layer("rain", "noise", 0.8), layer("birds", "ambient")]))

  assert.deepEqual(log, [
    ["update", "rain", 0.8],
    ["create", "birds"], ["fadeIn", "birds"],
    ["dispose", "wind"],
  ])
  assert.deepEqual(controller.getSnapshot().layers, {
    rain: { status: "playing" },
    birds: { status: "playing" },
  })
})

test("an adapter rejection fails only its layer while healthy layers continue", async () => {
  const log = []
  const controller = createAtmoShaperMixController({
    createAdapter(nextLayer) {
      if (nextLayer.id === "broken") return Promise.reject(new Error("adapter unavailable"))
      return createFakeHandle(log, nextLayer)
    },
  })

  await controller.start(recipe([layer("healthy"), layer("broken", "ambient")]))

  assert.deepEqual(log, [["fadeIn", "healthy"]])
  assert.equal(controller.getSnapshot().status, "playing")
  assert.deepEqual(controller.getSnapshot().layers, {
    healthy: { status: "playing" },
    broken: { status: "failed", error: "adapter unavailable" },
  })
})

test("an exclusive replacement is prepared before its working predecessor fades out", async () => {
  const log = []
  const controller = createAtmoShaperMixController({
    createAdapter(nextLayer) {
      log.push(["create", nextLayer.id])
      return createFakeHandle(log, nextLayer)
    },
  })
  await controller.start(recipe([layer("station-old", "station")]))
  log.length = 0

  await controller.applyRecipe(recipe([layer("station-new", "station")]))

  assert.ok(log.findIndex((entry) => entry[0] === "create" && entry[1] === "station-new")
    < log.findIndex((entry) => entry[0] === "dispose" && entry[1] === "station-old"))
})

test("stop and dispose clean active and late-arriving handles", async () => {
  const log = []
  let resolveLate
  let lateRequested
  const lateAdapter = new Promise((resolve) => { resolveLate = resolve })
  const lateWasRequested = new Promise((resolve) => { lateRequested = resolve })
  const controller = createAtmoShaperMixController({
    createAdapter(nextLayer) {
      if (nextLayer.id === "late") {
        lateRequested()
        return lateAdapter
      }
      return createFakeHandle(log, nextLayer)
    },
  })
  const starting = controller.start(recipe([layer("active"), layer("late", "ambient")]))
  await lateWasRequested

  await controller.stop()
  resolveLate(createFakeHandle(log, layer("late", "ambient")))
  await starting

  assert.deepEqual(log, [["fadeIn", "active"], ["dispose", "active"], ["dispose", "late"]])
  assert.equal(controller.getSnapshot().status, "stopped")

  const disposedLog = []
  const disposedController = createAtmoShaperMixController({
    createAdapter(nextLayer) { return createFakeHandle(disposedLog, nextLayer) },
  })
  await disposedController.start(recipe([layer("dispose-me")]))
  await disposedController.dispose()
  await disposedController.start(recipe([layer("must-not-start")]))

  assert.deepEqual(disposedLog, [["fadeIn", "dispose-me"], ["dispose", "dispose-me"]])
})

test("a stale asynchronous start cannot publish playing after a newer request", async () => {
  const log = []
  const snapshots = []
  let resolveSlow
  const slowAdapter = new Promise((resolve) => { resolveSlow = resolve })
  const controller = createAtmoShaperMixController({
    createAdapter(nextLayer) {
      if (nextLayer.id === "slow") return slowAdapter
      return createFakeHandle(log, nextLayer)
    },
    onSnapshot(snapshot) { snapshots.push(snapshot) },
  })
  const slowStart = controller.start(recipe([layer("slow")]))
  const fastStart = controller.start(recipe([layer("fast")]))
  await fastStart
  const newerPlayingSnapshotCount = snapshots.filter((snapshot) => snapshot.status === "playing").length

  resolveSlow(createFakeHandle(log, layer("slow")))
  await slowStart

  assert.equal(snapshots.filter((snapshot) => snapshot.status === "playing").length, newerPlayingSnapshotCount)
  assert.equal(controller.getSnapshot().status, "playing")
  assert.deepEqual(controller.getSnapshot().layers, { fast: { status: "playing" } })
  assert.ok(log.some((entry) => entry[0] === "dispose" && entry[1] === "slow"))
})

test("stopped recipe edits publish without creating an adapter", async () => {
  const snapshots = []
  const controller = createAtmoShaperMixController({
    createAdapter() { throw new Error("stopped edits must not create audio") },
    onSnapshot(snapshot) { snapshots.push(snapshot) },
  })
  const nextRecipe = recipe([layer("rain")])

  await controller.applyRecipe(nextRecipe)

  assert.equal(controller.getSnapshot().recipe, nextRecipe)
  assert.deepEqual(controller.getSnapshot().layers, {})
  assert.equal(snapshots.at(-1).status, "stopped")
})
