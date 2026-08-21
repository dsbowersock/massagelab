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

test("a failed exclusive replacement retains its healthy predecessor at runtime", async () => {
  const log = []
  const controller = createAtmoShaperMixController({
    createAdapter(nextLayer) {
      if (nextLayer.id === "station-new") return Promise.reject(new Error("station unavailable"))
      return createFakeHandle(log, nextLayer)
    },
  })
  await controller.start(recipe([layer("station-old", "station")]))
  log.length = 0

  await controller.applyRecipe(recipe([layer("station-new", "station")]))

  assert.deepEqual(log, [])
  assert.equal(controller.getSnapshot().status, "playing")
  assert.deepEqual(controller.getSnapshot().layers, {
    "station-old": { status: "playing" },
    "station-new": { status: "failed", error: "station unavailable" },
  })
  assert.deepEqual(controller.getSnapshot().activeLayers, {
    "station-old": layer("station-old", "station"),
  })
})

test("a stale activation disposes only its private handle after a newer request", async () => {
  const log = []
  let releaseStaleFade
  let staleFadeStarted
  const staleFade = new Promise((resolve) => { releaseStaleFade = resolve })
  const staleFadeHasStarted = new Promise((resolve) => { staleFadeStarted = resolve })
  let adapterCount = 0
  const controller = createAtmoShaperMixController({
    createAdapter(nextLayer) {
      adapterCount += 1
      const handleName = adapterCount === 1 ? "stale-handle" : "newer-handle"
      return {
        async fadeIn() {
          log.push(["fadeIn", handleName])
          if (handleName === "stale-handle") {
            staleFadeStarted()
            await staleFade
          }
        },
        async update() { log.push(["update", handleName]) },
        async pause() { log.push(["pause", handleName]) },
        async resume() { log.push(["resume", handleName]) },
        async fadeOutAndDispose() { log.push(["dispose", handleName]) },
      }
    },
  })
  const staleStart = controller.start(recipe([layer("rain")]))
  await staleFadeHasStarted

  await controller.start(recipe([layer("rain")]))
  releaseStaleFade()
  await staleStart

  assert.deepEqual(log, [
    ["fadeIn", "stale-handle"],
    ["fadeIn", "newer-handle"],
    ["dispose", "stale-handle"],
  ])
  assert.deepEqual(controller.getSnapshot().layers, { rain: { status: "playing" } })
})

test("a newer start invalidates the ownership predicate of a deferred adapter", async () => {
  const ownership = []
  let releaseFirst
  let firstEntered
  const firstReady = new Promise((resolve) => { releaseFirst = resolve })
  const firstWasEntered = new Promise((resolve) => { firstEntered = resolve })
  const controller = createAtmoShaperMixController({
    async createAdapter(nextLayer, isCurrent) {
      if (nextLayer.id === "first") {
        firstEntered()
        await firstReady
      }
      ownership.push([nextLayer.id, typeof isCurrent === "function" ? isCurrent() : "missing"])
      return createFakeHandle([], nextLayer)
    },
  })

  const firstStart = controller.start(recipe([layer("first", "station")]))
  await firstWasEntered
  await controller.start(recipe([layer("second", "station")]))
  releaseFirst()
  await firstStart

  assert.deepEqual(ownership, [["second", true], ["first", false]])
})

test("stop invalidates the ownership predicate of a deferred adapter", async () => {
  const ownership = []
  let releaseAdapter
  let adapterEntered
  const adapterReady = new Promise((resolve) => { releaseAdapter = resolve })
  const adapterWasEntered = new Promise((resolve) => { adapterEntered = resolve })
  const controller = createAtmoShaperMixController({
    async createAdapter(nextLayer, isCurrent) {
      adapterEntered()
      await adapterReady
      ownership.push(typeof isCurrent === "function" ? isCurrent() : "missing")
      return createFakeHandle([], nextLayer)
    },
  })

  const starting = controller.start(recipe([layer("deferred", "station")]))
  await adapterWasEntered
  await controller.stop()
  releaseAdapter()
  await starting

  assert.deepEqual(ownership, [false])
})

test("a layer added while paused prepares silently and enters paused state", async () => {
  const log = []
  const controller = createAtmoShaperMixController({
    createAdapter(nextLayer) {
      log.push(["create", nextLayer.id])
      return createFakeHandle(log, nextLayer)
    },
  })
  await controller.start(recipe([layer("rain")]))
  await controller.pause()
  log.length = 0

  await controller.applyRecipe(recipe([layer("rain"), layer("birds", "ambient")]))

  assert.deepEqual(log, [
    ["update", "rain", 0.5],
    ["create", "birds"],
    ["pause", "birds"],
  ])
  assert.equal(controller.getSnapshot().status, "paused")
  assert.deepEqual(controller.getSnapshot().layers, {
    rain: { status: "paused" },
    birds: { status: "paused" },
  })
})

test("pause during deferred station preparation settles silent and resume keeps the handle", async () => {
  const log = []
  let releaseAdapter
  let adapterEntered
  const adapterReady = new Promise((resolve) => { releaseAdapter = resolve })
  const adapterWasEntered = new Promise((resolve) => { adapterEntered = resolve })
  const controller = createAtmoShaperMixController({
    async createAdapter(nextLayer) {
      adapterEntered()
      await adapterReady
      return createFakeHandle(log, nextLayer)
    },
  })

  const starting = controller.start(recipe([layer("station", "station")]))
  await adapterWasEntered
  const pausing = controller.pause()
  releaseAdapter()
  await Promise.all([starting, pausing])

  assert.deepEqual(log, [["pause", "station"]])
  assert.equal(controller.getSnapshot().status, "paused")
  assert.deepEqual(controller.getSnapshot().layers, { station: { status: "paused" } })

  await controller.resume()
  assert.deepEqual(log, [["pause", "station"], ["resume", "station"]])
  assert.equal(controller.getSnapshot().status, "playing")
})

test("a same-id kind change stages a replacement instead of updating the old adapter", async () => {
  const log = []
  let stationAttempts = 0
  const controller = createAtmoShaperMixController({
    createAdapter(nextLayer) {
      if (nextLayer.kind === "noise") {
        return {
          async fadeIn() { log.push(["fadeIn", "noise"]) },
          async update(updatedLayer) { log.push(["update", "noise", updatedLayer.kind]) },
          async pause() { log.push(["pause", "noise"]) },
          async resume() { log.push(["resume", "noise"]) },
          async fadeOutAndDispose() { log.push(["dispose", "noise"]) },
        }
      }

      stationAttempts += 1
      const attempt = stationAttempts
      return {
        async fadeIn() {
          log.push(["fadeIn", `station-${attempt}`])
          if (attempt === 1) throw new Error("station unavailable")
        },
        async update(updatedLayer) { log.push(["update", `station-${attempt}`, updatedLayer.kind]) },
        async pause() { log.push(["pause", `station-${attempt}`]) },
        async resume() { log.push(["resume", `station-${attempt}`]) },
        async fadeOutAndDispose() { log.push(["dispose", `station-${attempt}`]) },
      }
    },
  })
  await controller.start(recipe([layer("shared", "noise")]))
  log.length = 0

  await controller.applyRecipe(recipe([layer("shared", "station")]))

  assert.deepEqual(log, [["fadeIn", "station-1"], ["dispose", "station-1"]])
  assert.deepEqual(controller.getSnapshot().layers, {
    shared: { status: "playing", error: "station unavailable" },
  })
  log.length = 0

  await controller.applyRecipe(recipe([layer("shared", "station")]))

  assert.deepEqual(log, [["fadeIn", "station-2"], ["dispose", "noise"]])
  assert.deepEqual(controller.getSnapshot().layers, { shared: { status: "playing" } })
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
