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

test("removing the last live layer stops cleanly and a later explicit start creates the new layer", async () => {
  const log = []
  const controller = createAtmoShaperMixController({
    createAdapter(nextLayer) {
      log.push(["create", nextLayer.id])
      return createFakeHandle(log, nextLayer)
    },
  })
  await controller.start(recipe([layer("pink")]))
  log.length = 0

  await controller.applyRecipe(recipe([]))

  assert.equal(controller.getSnapshot().status, "stopped")
  assert.deepEqual(controller.getSnapshot().layers, {})
  assert.deepEqual(controller.getSnapshot().activeLayers, {})
  assert.deepEqual(log, [["dispose", "pink"]])

  await controller.applyRecipe(recipe([layer("brown")]))
  assert.deepEqual(log, [["dispose", "pink"]], "stopped edits stay silent")
  assert.equal(controller.getSnapshot().status, "stopped")

  await controller.start(recipe([layer("brown")]))
  assert.deepEqual(log, [
    ["dispose", "pink"],
    ["create", "brown"],
    ["fadeIn", "brown"],
  ])
  assert.equal(controller.getSnapshot().status, "playing")
})

test("a preview can play alone without entering the committed recipe or status", async () => {
  const log = []
  const controller = createAtmoShaperMixController({
    createAdapter(nextLayer) {
      log.push(["create", nextLayer.id])
      return createFakeHandle(log, nextLayer)
    },
  })
  const previewLayer = layer("pink-preview", "noise", 0.35)

  await controller.startPreview(previewLayer)

  assert.deepEqual(log, [["create", "pink-preview"], ["fadeIn", "pink-preview"]])
  assert.equal(controller.getSnapshot().status, "stopped")
  assert.equal(controller.getSnapshot().recipe, null)
  assert.deepEqual(controller.getSnapshot().layers, {})
  assert.deepEqual(controller.getSnapshot().activeLayers, {})
  assert.deepEqual(controller.getSnapshot().preview, {
    layer: previewLayer,
    status: "playing",
  })
})

test("preview replacement disposes the prior source before the prepared replacement becomes audible", async () => {
  const log = []
  const controller = createAtmoShaperMixController({
    createAdapter(nextLayer) {
      log.push(["create", nextLayer.id])
      return createFakeHandle(log, nextLayer)
    },
  })
  await controller.startPreview(layer("first-preview"))
  log.length = 0

  await controller.startPreview(layer("second-preview", "ambient"))

  assert.deepEqual(log, [
    ["create", "second-preview"],
    ["dispose", "first-preview"],
    ["fadeIn", "second-preview"],
  ])
  assert.equal(controller.getSnapshot().preview?.layer.id, "second-preview")
})

test("preview volume updates only the preview layer and handle", async () => {
  const log = []
  const committedLayer = layer("committed")
  const previewLayer = layer("preview", "ambient", 0.25)
  const controller = createAtmoShaperMixController({
    createAdapter(nextLayer) { return createFakeHandle(log, nextLayer) },
  })
  await controller.start(recipe([committedLayer]))
  await controller.startPreview(previewLayer)
  log.length = 0

  await controller.setPreviewVolume(0.9)

  assert.deepEqual(log, [["update", "preview", 0.9]])
  assert.equal(controller.getSnapshot().preview?.layer.id, previewLayer.id)
  assert.equal(controller.getSnapshot().preview?.layer.volume, 0.9)
  assert.deepEqual(controller.getSnapshot().activeLayers, { committed: committedLayer })
})

test("stopPreview retires only the preview and leaves a committed mix playing", async () => {
  const log = []
  const committedLayer = layer("committed")
  const controller = createAtmoShaperMixController({
    createAdapter(nextLayer) { return createFakeHandle(log, nextLayer) },
  })
  await controller.start(recipe([committedLayer]))
  await controller.startPreview(layer("preview"))
  log.length = 0

  await controller.stopPreview()

  assert.deepEqual(log, [["dispose", "preview"]])
  assert.equal(controller.getSnapshot().status, "playing")
  assert.equal(controller.getSnapshot().preview, null)
  assert.deepEqual(controller.getSnapshot().activeLayers, { committed: committedLayer })
})

test("a preview failure is isolated from committed handles and status", async () => {
  const log = []
  const committedLayer = layer("healthy")
  const controller = createAtmoShaperMixController({
    createAdapter(nextLayer) {
      if (nextLayer.id === "broken-preview") throw new Error("preview unavailable")
      return createFakeHandle(log, nextLayer)
    },
  })
  await controller.start(recipe([committedLayer]))
  log.length = 0

  await controller.startPreview(layer("broken-preview", "ambient"))

  assert.deepEqual(log, [])
  assert.equal(controller.getSnapshot().status, "playing")
  assert.deepEqual(controller.getSnapshot().layers, { healthy: { status: "playing" } })
  assert.deepEqual(controller.getSnapshot().activeLayers, { healthy: committedLayer })
  assert.deepEqual(controller.getSnapshot().preview, {
    layer: layer("broken-preview", "ambient"),
    status: "failed",
    error: "preview unavailable",
  })
})

test("pause and resume include a preview-only handle without changing committed status", async () => {
  const log = []
  const controller = createAtmoShaperMixController({
    createAdapter(nextLayer) { return createFakeHandle(log, nextLayer) },
  })
  await controller.startPreview(layer("preview-only"))
  log.length = 0

  await controller.pause()
  assert.deepEqual(log, [["pause", "preview-only"]])
  assert.equal(controller.getSnapshot().status, "stopped")
  assert.equal(controller.getSnapshot().preview?.status, "paused")

  await controller.resume()
  assert.deepEqual(log, [["pause", "preview-only"], ["resume", "preview-only"]])
  assert.equal(controller.getSnapshot().status, "stopped")
  assert.equal(controller.getSnapshot().preview?.status, "playing")
})

test("stop and dispose retire preview handles alongside committed audio", async () => {
  const log = []
  const controller = createAtmoShaperMixController({
    createAdapter(nextLayer) { return createFakeHandle(log, nextLayer) },
  })
  await controller.start(recipe([layer("committed")]))
  await controller.startPreview(layer("preview"))
  log.length = 0

  await controller.stop()

  assert.deepEqual(log, [["dispose", "committed"], ["dispose", "preview"]])
  assert.equal(controller.getSnapshot().status, "stopped")
  assert.equal(controller.getSnapshot().preview, null)

  const disposedLog = []
  const disposedController = createAtmoShaperMixController({
    createAdapter(nextLayer) {
      disposedLog.push(["create", nextLayer.id])
      return createFakeHandle(disposedLog, nextLayer)
    },
  })
  await disposedController.startPreview(layer("dispose-preview"))
  await disposedController.dispose()
  await disposedController.startPreview(layer("must-not-start"))

  assert.deepEqual(disposedLog, [
    ["create", "dispose-preview"],
    ["fadeIn", "dispose-preview"],
    ["dispose", "dispose-preview"],
  ])
})

test("a stale preview adapter self-disposes without replacing the newer preview", async () => {
  const log = []
  const ownership = []
  let resolveStale
  let staleRequested
  const staleAdapter = new Promise((resolve) => { resolveStale = resolve })
  const staleWasRequested = new Promise((resolve) => { staleRequested = resolve })
  const controller = createAtmoShaperMixController({
    async createAdapter(nextLayer, isCurrent) {
      log.push(["create", nextLayer.id])
      if (nextLayer.id === "stale") {
        staleRequested()
        const handle = await staleAdapter
        ownership.push([nextLayer.id, isCurrent()])
        return handle
      }
      ownership.push([nextLayer.id, isCurrent()])
      return createFakeHandle(log, nextLayer)
    },
  })

  const staleStart = controller.startPreview(layer("stale"))
  await staleWasRequested
  await controller.startPreview(layer("current"))
  resolveStale(createFakeHandle(log, layer("stale")))
  await staleStart

  assert.deepEqual(ownership, [["current", true], ["stale", false]])
  assert.deepEqual(log, [
    ["create", "stale"],
    ["create", "current"],
    ["fadeIn", "current"],
    ["dispose", "stale"],
  ])
  assert.equal(controller.getSnapshot().preview?.layer.id, "current")
})

test("promotion adopts the exact preview handle and reconciles remaining recipe layers", async () => {
  const log = []
  const createCounts = new Map()
  const controller = createAtmoShaperMixController({
    createAdapter(nextLayer) {
      createCounts.set(nextLayer.id, (createCounts.get(nextLayer.id) ?? 0) + 1)
      log.push(["create", nextLayer.id])
      return createFakeHandle(log, nextLayer)
    },
  })
  const previewLayer = layer("promoted", "ambient", 0.3)
  await controller.startPreview(previewLayer)
  log.length = 0
  const committedPreviewLayer = { ...previewLayer, volume: 0.8 }
  const extraLayer = layer("extra", "noise", 0.4)

  await controller.promotePreview(recipe([committedPreviewLayer, extraLayer]))

  assert.equal(createCounts.get("promoted"), 1)
  assert.deepEqual(log, [
    ["resume", "promoted"],
    ["update", "promoted", 0.8],
    ["create", "extra"],
    ["fadeIn", "extra"],
  ])
  assert.equal(controller.getSnapshot().preview, null)
  assert.equal(controller.getSnapshot().status, "playing")
  assert.deepEqual(controller.getSnapshot().activeLayers, {
    promoted: committedPreviewLayer,
    extra: extraLayer,
  })
})

test("promotion converges its adopted handle while pause is blocked on a committed handle", async () => {
  const log = []
  let previewTransport = "stopped"
  let releaseCommittedPause
  let committedPauseEntered
  const committedPauseGate = new Promise((resolve) => { releaseCommittedPause = resolve })
  const committedPauseWasEntered = new Promise((resolve) => { committedPauseEntered = resolve })
  const committedLayer = layer("committed")
  const previewLayer = layer("preview", "ambient")
  const controller = createAtmoShaperMixController({
    createAdapter(nextLayer) {
      if (nextLayer.id === committedLayer.id) {
        return {
          ...createFakeHandle(log, nextLayer),
          async pause() {
            log.push(["pause", nextLayer.id])
            committedPauseEntered()
            await committedPauseGate
          },
        }
      }
      return {
        async fadeIn() { previewTransport = "playing"; log.push(["fadeIn", nextLayer.id]) },
        async update(updatedLayer) { log.push(["update", nextLayer.id, updatedLayer.volume]) },
        async pause() { previewTransport = "paused"; log.push(["pause", nextLayer.id]) },
        async resume() { previewTransport = "playing"; log.push(["resume", nextLayer.id]) },
        async fadeOutAndDispose() { previewTransport = "disposed"; log.push(["dispose", nextLayer.id]) },
      }
    },
  })
  await controller.start(recipe([committedLayer]))
  await controller.startPreview(previewLayer)
  log.length = 0

  const pausing = controller.pause()
  await committedPauseWasEntered
  await controller.promotePreview(recipe([committedLayer, previewLayer]))
  releaseCommittedPause()
  await pausing

  assert.equal(previewTransport, "paused")
  assert.equal(log.filter(([action, id]) => action === "pause" && id === previewLayer.id).length, 1)
  assert.equal(controller.getSnapshot().status, "paused")
  assert.equal(controller.getSnapshot().layers.preview.status, "paused")
})

test("promotion converges its adopted handle while resume is blocked on a committed handle", async () => {
  const log = []
  let previewTransport = "stopped"
  let blockCommittedResume = false
  let releaseCommittedResume
  let committedResumeEntered
  const committedResumeGate = new Promise((resolve) => { releaseCommittedResume = resolve })
  const committedResumeWasEntered = new Promise((resolve) => { committedResumeEntered = resolve })
  const committedLayer = layer("committed")
  const previewLayer = layer("preview", "ambient")
  const controller = createAtmoShaperMixController({
    createAdapter(nextLayer) {
      if (nextLayer.id === committedLayer.id) {
        return {
          ...createFakeHandle(log, nextLayer),
          async resume() {
            log.push(["resume", nextLayer.id])
            if (!blockCommittedResume) return
            committedResumeEntered()
            await committedResumeGate
          },
        }
      }
      return {
        async fadeIn() { previewTransport = "playing"; log.push(["fadeIn", nextLayer.id]) },
        async update(updatedLayer) { log.push(["update", nextLayer.id, updatedLayer.volume]) },
        async pause() { previewTransport = "paused"; log.push(["pause", nextLayer.id]) },
        async resume() { previewTransport = "playing"; log.push(["resume", nextLayer.id]) },
        async fadeOutAndDispose() { previewTransport = "disposed"; log.push(["dispose", nextLayer.id]) },
      }
    },
  })
  await controller.start(recipe([committedLayer]))
  await controller.startPreview(previewLayer)
  await controller.pause()
  blockCommittedResume = true
  log.length = 0

  const resuming = controller.resume()
  await committedResumeWasEntered
  await controller.promotePreview(recipe([committedLayer, previewLayer]))
  releaseCommittedResume()
  await resuming

  assert.equal(previewTransport, "playing")
  assert.equal(log.filter(([action, id]) => action === "resume" && id === previewLayer.id).length, 1)
  assert.equal(controller.getSnapshot().status, "playing")
  assert.equal(controller.getSnapshot().layers.preview.status, "playing")
})
