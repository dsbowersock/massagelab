import assert from "node:assert/strict"
import { describe, it } from "node:test"

const { createSignatureSoundPreviewPlayer } = await import(
  "../lib/atmoshaper/signature-sound-preview-player.js"
).catch(() => ({}))
const { createSignatureSoundPreviewFadeController } = await import(
  "../lib/atmoshaper/signature-sound-preview-fade.js"
).catch(() => ({}))

const SOURCE_IDS = Array.from({ length: 5 }, (_, index) => String(index + 1).repeat(64))

function createHarness({ duration = 240, random = () => 0, createGainStage, createVoiceOutput } = {}) {
  const created = []
  const timers = []
  const snapshots = []
  function createAudio(url) {
    const listeners = new Map()
    const audio = {
      url,
      currentTime: 0,
      duration,
      volume: 1,
      playVolume: null,
      paused: true,
      ended: false,
      onended: null,
      onloadedmetadata: null,
      ontimeupdate: null,
      addEventListener(type, listener) {
        if (!listeners.has(type)) listeners.set(type, new Set())
        listeners.get(type).add(listener)
      },
      removeEventListener(type, listener) { listeners.get(type)?.delete(listener) },
      dispatch(type) {
        if (type === "ended") { this.ended = true; this.paused = true }
        for (const listener of listeners.get(type) ?? []) listener()
        if (type === "ended") this.onended?.()
        if (type === "loadedmetadata") this.onloadedmetadata?.()
        if (type === "timeupdate") this.ontimeupdate?.()
      },
      play() {
        this.playVolume = this.volume
        this.paused = false
        this.dispatch("play")
        return Promise.resolve()
      },
      pause() { this.paused = true; this.dispatch("pause") },
    }
    created.push(audio)
    return audio
  }
  const player = createSignatureSoundPreviewPlayer({
    createAudio,
    createGainStage,
    createVoiceOutput,
    random,
    setTimer(callback, delay) {
      const timer = { callback, delay, cleared: false, fired: false }
      timers.push(timer)
      return timer
    },
    clearTimer(timer) { timer.cleared = true },
    onVoiceTelemetry(snapshot) { snapshots.push(structuredClone(snapshot)) },
  })
  function fireNext(predicate = () => true) {
    const timer = timers.find((candidate) => !candidate.cleared && !candidate.fired && predicate(candidate))
    assert.ok(timer, "expected a pending timer")
    timer.fired = true
    timer.callback()
    return timer
  }
  return { player, created, timers, snapshots, fireNext }
}

function configuration(runtimePolicy, count = 1) {
  return {
    groupId: "example:review-policy",
    strategyId: "adaptive-whole-source-sequence",
    previewSettings: { transitionMode: "crossfade", transitionSeconds: 2 },
    constructionPolicy: {
      minimumSelectionsBeforeRepeat: null,
      transitionDurationRange: null,
      cadenceBoundary: null,
      overlapNextEvent: false,
    },
    sources: SOURCE_IDS.slice(0, count).map((sourceId, index) => ({
      sourceId,
      relativePath: `${index + 1}.wav`,
    })),
    runtimePolicy,
  }
}

async function flush() {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

describe("AtmoShaper reviewer-policy audition player", () => {
  it("uses a separate transparent gain stage when median leveling needs a safe boost", async () => {
    const stages = []
    const harness = createHarness({
      createGainStage(audio, gainDb) {
        const stage = { audio, gainDb, resumed: false, disconnected: false }
        stages.push(stage)
        return {
          resume() { stage.resumed = true; return Promise.resolve() },
          disconnect() { stage.disconnected = true },
        }
      },
    })
    const review = configuration(null)
    review.sources[0].gainDb = 6.3
    await harness.player.start(review)
    assert.equal(harness.created[0].volume, 1, "the media element retains full envelope range")
    assert.deepEqual(stages.map(({ gainDb, resumed }) => ({ gainDb, resumed })), [{ gainDb: 6.3, resumed: true }])
    harness.player.stop()
    assert.equal(stages[0].disconnected, true)
  })

  it("routes every production voice through the supplied Web Audio output", async () => {
    const outputs = []
    const harness = createHarness({
      createVoiceOutput(audio, gainDb) {
        const output = { audio, gainDb, resumed: false, disconnected: false }
        outputs.push(output)
        return {
          resume() { output.resumed = true; return Promise.resolve() },
          disconnect() { output.disconnected = true },
        }
      },
    })
    const review = configuration(null)
    review.sources[0].gainDb = -7.5
    await harness.player.start(review)
    assert.equal(harness.created[0].volume, 1, "the production gain node owns source attenuation")
    assert.deepEqual(outputs.map(({ gainDb, resumed }) => ({ gainDb, resumed })), [{ gainDb: -7.5, resumed: true }])
    harness.player.stop()
    assert.equal(outputs[0].disconnected, true)
  })

  it("uses smooth timer resolution for the requested 15-second crowd crossfade", () => {
    const timers = []
    const controller = createSignatureSoundPreviewFadeController({
      isActive: () => true,
      registerTimer(callback, delay) { timers.push({ callback, delay }); return timers.at(-1) },
      retireVoice() {},
    })
    void controller.fadeVoices(
      {},
      { volume: 1, previewTargetVolume: 1 },
      { volume: 0, previewTargetVolume: 1 },
      15,
    )
    assert.ok(timers[0].delay <= 50, `expected a smooth fade step, received ${timers[0].delay}ms`)
    controller.settleAll()
  })

  it("uses smooth timer resolution for the exact 10-second review crossfades", () => {
    const timers = []
    const controller = createSignatureSoundPreviewFadeController({
      isActive: () => true,
      registerTimer(callback, delay) { timers.push({ callback, delay }); return timers.at(-1) },
      retireVoice() {},
    })
    void controller.fadeVoices(
      {},
      { volume: 1, previewTargetVolume: 1 },
      { volume: 0, previewTargetVolume: 1 },
      10,
    )
    assert.ok(timers[0].delay <= 50, `expected a smooth fade step, received ${timers[0].delay}ms`)
    controller.settleAll()
  })

  it("plays the B09 opening once, then crossfades into the exact repeating region", async () => {
    assert.equal(typeof createSignatureSoundPreviewPlayer, "function")
    const harness = createHarness({ duration: 114 })
    await harness.player.start(configuration({
      kind: "fixed-region-loop",
      firstPassStartSeconds: 0,
      loopStartSeconds: 15,
      loopEndSeconds: 55,
      crossfadeSeconds: 4,
    }))
    assert.equal(harness.created[0].currentTime, 0)

    harness.created[0].currentTime = 51
    harness.created[0].dispatch("timeupdate")
    await flush()
    assert.equal(harness.created.length, 2)
    assert.equal(harness.created[1].currentTime, 15)
    assert.equal(harness.snapshots.at(-1).voices.at(-1).regionStartSeconds, 15)
    assert.equal(harness.snapshots.at(-1).voices.at(-1).regionEndSeconds, 55)
  })

  it("selects a new bounded random regional window at every B41/B51 boundary", async () => {
    const harness = createHarness({ duration: 240, random: () => 0 })
    await harness.player.start(configuration({
      kind: "random-region-loop",
      regionStartSeconds: 15,
      regionEndSeconds: 73,
      minimumLoopSeconds: 15,
      crossfadeSeconds: 10,
    }))
    assert.equal(harness.created[0].currentTime, 15)
    assert.equal(
      harness.snapshots.at(-1).voices[0].regionEndSeconds,
      35,
      "the 10-second entrance and exit fades need a non-colliding 20-second review window",
    )

    harness.created[0].currentTime = 25
    harness.created[0].dispatch("timeupdate")
    await flush()
    assert.equal(harness.created.length, 2)
    assert.equal(harness.created[1].currentTime, 15)
    harness.created[1].currentTime = 25
    harness.created[1].dispatch("timeupdate")
    await flush()
    assert.equal(harness.created.length, 2, "an incoming region cannot fade out while its fade-in is active")
    harness.player.stop()
  })

  it("plays pause-separated sources without overlap and applies the requested boundary envelope", async () => {
    const harness = createHarness({ duration: 20, random: () => 0 })
    await harness.player.start(configuration({
      kind: "pause-separated-sequence",
      minimumGapSeconds: 0,
      maximumGapSeconds: 3,
      fadeInSeconds: 1,
      fadeOutSeconds: 5,
    }, 2))
    assert.equal(harness.created[0].playVolume, 0, "the fade-in must be applied before playback starts")
    harness.created[0].currentTime = 0
    assert.equal(harness.created[0].volume, 0)
    harness.created[0].currentTime = 0.5
    harness.fireNext(({ delay }) => delay === 50)
    assert.ok(Math.abs(harness.created[0].volume - 0.5) < 1e-9)
    harness.created[0].currentTime = 10
    harness.fireNext(({ delay }) => delay === 50)
    assert.ok(Math.abs(harness.created[0].volume - 1) < 1e-9)
    harness.created[0].currentTime = 17.5
    harness.fireNext(({ delay }) => delay === 50)
    assert.equal(harness.created[0].volume, 0.5)

    harness.created[0].dispatch("ended")
    await flush()
    assert.equal(harness.snapshots.at(-1).voices.length, 0)
    harness.fireNext(({ delay }) => delay === 0)
    await flush()
    assert.equal(harness.created.length, 2)
    assert.equal(harness.created[0].paused, true)
    assert.equal(harness.created[1].paused, false)
  })

  it("honors the B25 fade-out and random pause when the reviewer advances manually", async () => {
    const harness = createHarness({ duration: 20, random: () => 0 })
    await harness.player.start(configuration({
      kind: "pause-separated-sequence",
      minimumGapSeconds: 0,
      maximumGapSeconds: 3,
      fadeInSeconds: 1,
      fadeOutSeconds: 5,
    }, 2))

    const advance = harness.player.advance()
    await flush()
    assert.equal(harness.created.length, 1, "the next announcement must wait for fade-out and the pause")
    for (let step = 0; step < 100; step += 1) {
      harness.fireNext(({ delay }) => delay <= 50)
      await flush()
    }
    await advance
    assert.equal(harness.created[0].paused, true)
    assert.equal(harness.created.length, 1)
    harness.fireNext(({ delay }) => delay === 0)
    await flush()
    assert.equal(harness.created.length, 2)
  })

  it("plays the restored B49 source from its uncut beginning", async () => {
    const harness = createHarness({ duration: 20, random: () => 0 })
    const review = configuration(null, 2)
    review.strategyId = "spaced-event-sequence"
    review.previewSettings = { minimumGapSeconds: 3, maximumGapSeconds: 16 }
    await harness.player.start(review)
    assert.equal(harness.created[0].currentTime, 0)
    assert.equal(harness.created[0].playVolume, 1)
  })

  it("runs layered playback under the strict audible-voice cap without evicting a source", async () => {
    const harness = createHarness({ duration: 30, random: () => 0 })
    await harness.player.start(configuration({
      kind: "layered-sequence",
      maximumConcurrentVoices: 3,
      transitionMode: "crossfade",
      transitionSeconds: 3,
      initialStartWindowSeconds: 3,
    }, 5))
    harness.fireNext(({ delay }) => delay === 0)
    await flush()
    assert.equal(harness.snapshots.at(-1).voices.length, 2)

    harness.created[0].currentTime = 27
    harness.created[0].dispatch("timeupdate")
    await flush()
    assert.equal(harness.snapshots.at(-1).voices.length, 3)
    assert.ok(harness.created.slice(0, 2).every(({ paused }) => !paused))

    harness.created[1].currentTime = 27
    harness.created[1].dispatch("timeupdate")
    await flush()
    assert.equal(harness.created.length, 3, "the strict cap cannot admit a second simultaneous crossfade")
    assert.equal(harness.created[1].paused, true, "the colliding lane waits at its crossfade boundary")
    for (let step = 0; step < 60; step += 1) {
      harness.fireNext(({ delay }) => delay === 50)
      await flush()
    }
    await flush()
    assert.equal(harness.created.length, 4, "the queued lane crossfades once the reserved slot is free")
    assert.ok(harness.snapshots.every(({ voices }) => voices.length <= 3), "the audible cap remains strict")
    harness.player.stop()
  })

  it("runs generic crossfade and pause lanes independently", async () => {
    const harness = createHarness({ duration: 20, random: () => 0 })
    await harness.player.start(configuration({
      kind: "multi-lane-sequence",
      lanes: [
        { sourceIds: SOURCE_IDS.slice(0, 2), boundaryMode: "crossfade", transitionSeconds: 3 },
        { sourceIds: SOURCE_IDS.slice(2, 5), boundaryMode: "pause", minimumGapSeconds: 0, maximumGapSeconds: 7 },
      ],
    }, 5))
    assert.equal(harness.created.length, 2)
    assert.deepEqual(new Set(harness.snapshots.at(-1).voices.map(({ laneId }) => laneId)), new Set(["lane-1", "lane-2"]))

    harness.created[0].currentTime = 17
    harness.created[0].dispatch("timeupdate")
    harness.created[1].dispatch("ended")
    await flush()
    assert.equal(harness.created.length, 3, "the crossfade lane advances while the pause lane waits")
    harness.fireNext(({ delay }) => delay === 0)
    await flush()
    assert.equal(harness.created.length, 4, "the pause lane starts independently")
  })

  it("repeats one selected source three to six times and shortens only marked-source boundaries", async () => {
    const samples = [0, 0, 0, 0.999]
    const harness = createHarness({ duration: 20, random: () => samples.shift() ?? 0 })
    const review = configuration({
      kind: "repeat-source-sequence",
      minimumConsecutivePlays: 3,
      maximumConsecutivePlays: 6,
      beatsPerMinute: 77,
      crossfadeBeats: 16,
      shortSourceIds: [SOURCE_IDS[0]],
      shortCrossfadeBeats: 8,
    }, 3)
    review.previewSettings.transitionSeconds = 960 / 77

    async function advanceAndSettle() {
      const advance = harness.player.advance()
      await flush()
      while (harness.timers.some(({ cleared, fired }) => !cleared && !fired)) {
        harness.fireNext()
        await flush()
      }
      await advance
    }

    await harness.player.start(review)
    await advanceAndSettle()
    await advanceAndSettle()
    await advanceAndSettle()
    assert.deepEqual(
      harness.created.slice(0, 4).map(({ url }) => url.match(/[123]{64}/)?.[0]),
      [SOURCE_IDS[0], SOURCE_IDS[0], SOURCE_IDS[0], SOURCE_IDS[1]],
    )
    assert.equal(harness.created[0].transitionSeconds, 480 / 77)
    assert.equal(harness.created[1].transitionSeconds, 480 / 77)
    assert.equal(harness.created[2].transitionSeconds, 480 / 77)
    assert.equal(harness.created[3].transitionSeconds, 960 / 77)
    harness.player.stop()
  })

  it("keeps a generic pause lane non-overlapping when the reviewer advances manually", async () => {
    const harness = createHarness({ duration: 20, random: () => 0 })
    await harness.player.start(configuration({
      kind: "multi-lane-sequence",
      lanes: [
        { sourceIds: SOURCE_IDS.slice(0, 2), boundaryMode: "crossfade", transitionSeconds: 3 },
        { sourceIds: SOURCE_IDS.slice(2, 5), boundaryMode: "pause", minimumGapSeconds: 0, maximumGapSeconds: 7 },
      ],
    }, 5))
    const firstPauseLaneVoice = harness.created[1]

    const advance = harness.player.advance()
    await flush()

    assert.equal(firstPauseLaneVoice.paused, true)
    assert.equal(
      harness.snapshots.at(-1).voices.filter(({ laneId }) => laneId === "lane-2").length,
      0,
      "manual advance must enter the configured pause before replacing the pause-lane voice",
    )
    harness.fireNext(({ delay }) => delay === 0)
    await flush()
    assert.equal(harness.snapshots.at(-1).voices.filter(({ laneId }) => laneId === "lane-2").length, 1)
    harness.player.stop()
    await advance
  })
})
