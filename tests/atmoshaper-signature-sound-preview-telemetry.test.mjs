import assert from "node:assert/strict"
import { describe, it } from "node:test"

const playerModule = await import(
  "../lib/atmoshaper/signature-sound-preview-player.js"
).catch(() => ({}))

const SOURCE_IDS = ["1".repeat(64), "2".repeat(64)]

function createFakeAudio(url, duration = 20) {
  const listeners = new Map()
  return {
    url,
    currentTime: 0,
    duration,
    volume: 1,
    paused: true,
    ended: false,
    onended: null,
    onloadedmetadata: null,
    ontimeupdate: null,
    addEventListener(type, listener) {
      if (!listeners.has(type)) listeners.set(type, new Set())
      listeners.get(type).add(listener)
    },
    removeEventListener(type, listener) {
      listeners.get(type)?.delete(listener)
    },
    dispatch(type) {
      if (type === "ended") {
        this.ended = true
        this.paused = true
      }
      for (const listener of listeners.get(type) ?? []) listener()
      if (type === "ended") this.onended?.()
      if (type === "loadedmetadata") this.onloadedmetadata?.()
      if (type === "timeupdate") this.ontimeupdate?.()
    },
    play() {
      this.paused = false
      this.dispatch("play")
      return Promise.resolve()
    },
    pause() {
      this.paused = true
      this.dispatch("pause")
    },
  }
}

describe("AtmoShaper preview active-voice telemetry", () => {
  it("reports immutable per-voice timelines and supports clamped seeking without using live status", async () => {
    assert.equal(typeof playerModule.createSignatureSoundPreviewPlayer, "function")
    const created = []
    const snapshots = []
    const player = playerModule.createSignatureSoundPreviewPlayer({
      createAudio(url) {
        const audio = createFakeAudio(url)
        created.push(audio)
        return audio
      },
      onVoiceTelemetry(snapshot) {
        snapshots.push(structuredClone(snapshot))
      },
      random: () => 0,
    })

    await player.start({
      groupId: "signature-extra:room-tone",
      strategyId: "adaptive-whole-source-sequence",
      previewSettings: { transitionMode: "crossfade", transitionSeconds: 10 },
      constructionPolicy: {
        minimumSelectionsBeforeRepeat: null,
        transitionDurationRange: null,
        cadenceBoundary: null,
        overlapNextEvent: false,
      },
      sources: [{ sourceId: SOURCE_IDS[0], relativePath: "room-tone.wav", gainDb: -6 }],
    })

    const voice = snapshots.at(-1).voices[0]
    assert.match(voice.voiceId, /^voice-[0-9]+$/)
    assert.equal(voice.relativePath, "room-tone.wav")
    assert.equal(voice.currentTime, 0)
    assert.equal(voice.duration, 20)
    assert.equal(voice.playing, true)
    assert.ok(Math.abs(created[0].volume - 10 ** (-6 / 20)) < 1e-9)

    created[0].currentTime = 4.25
    created[0].dispatch("timeupdate")
    assert.equal(snapshots.at(-1).voices[0].currentTime, 4.25)
    assert.equal(player.seekVoice(voice.voiceId, 99), true)
    assert.equal(created[0].currentTime, 20)
    assert.equal(player.seekVoice("voice-999", 2), false)

    player.stop()
    assert.deepEqual(snapshots.at(-1), { groupId: null, voices: [] })
  })

  it("preserves full-length overlapping voices and waits at the safety limit instead of cutting one off", async () => {
    assert.equal(typeof playerModule.createSignatureSoundPreviewPlayer, "function")
    const created = []
    const snapshots = []
    const player = playerModule.createSignatureSoundPreviewPlayer({
      createAudio(url) {
        const audio = createFakeAudio(url, 5.2)
        created.push(audio)
        return audio
      },
      onVoiceTelemetry(snapshot) {
        snapshots.push(structuredClone(snapshot))
      },
      random: () => 0,
    })
    const configuration = {
      groupId: "signature-extra:experimental-atmosphere",
      strategyId: "adaptive-whole-source-sequence",
      previewSettings: { transitionMode: "overlap", transitionSeconds: 2 },
      constructionPolicy: {
        minimumSelectionsBeforeRepeat: null,
        transitionDurationRange: { minimumSeconds: 2, maximumSeconds: 6 },
        cadenceBoundary: null,
        overlapNextEvent: false,
        preserveFullLengthOverlaps: true,
      },
      sources: SOURCE_IDS.map((sourceId, index) => ({ sourceId, relativePath: `${index}.wav` })),
    }

    await player.start(configuration)
    created[0].currentTime = 3.3
    created[0].dispatch("timeupdate")
    await Promise.resolve()
    await Promise.resolve()
    assert.equal(created.length, 2)
    assert.equal(created[0].paused, false)
    assert.equal(created[1].paused, false)
    assert.equal(created[0].volume, 1)
    assert.equal(created[1].volume, 1)
    assert.equal(snapshots.at(-1).voices.length, 2)

    while (created.length < 8) await player.advance()
    await player.advance()
    assert.equal(created.length, 8, "the safety limit must delay another trigger")
    assert.ok(created.every(({ paused }) => !paused), "no triggered voice may be cut off")

    const terminalVoiceId = snapshots.at(-1).voices[0].voiceId
    created[0].dispatch("ended")
    assert.ok(snapshots.some(({ voices }) => voices.some((voice) => (
      voice.voiceId === terminalVoiceId && voice.ended === true && voice.playing === false
    ))))
    await player.advance()
    assert.equal(created.length, 9, "a new trigger can proceed after capacity is freed")
    player.stop()
  })

  it("keeps an existing voice controllable when an automatic replacement fails", async () => {
    const created = []
    const statuses = []
    const snapshots = []
    const player = playerModule.createSignatureSoundPreviewPlayer({
      createAudio(url) {
        const audio = createFakeAudio(url)
        if (created.length === 1) {
          audio.play = function play() {
            this.paused = false
            return Promise.reject(new Error("replacement failed"))
          }
        }
        created.push(audio)
        return audio
      },
      onStatus(status) { statuses.push(status) },
      onVoiceTelemetry(snapshot) { snapshots.push(structuredClone(snapshot)) },
      random: () => 0,
    })

    await player.start({
      groupId: "signature-extra:room-tone",
      strategyId: "adaptive-whole-source-sequence",
      previewSettings: { transitionMode: "crossfade", transitionSeconds: 10 },
      constructionPolicy: {
        minimumSelectionsBeforeRepeat: null,
        transitionDurationRange: null,
        cadenceBoundary: null,
        overlapNextEvent: false,
      },
      sources: SOURCE_IDS.map((sourceId, index) => ({ sourceId, relativePath: `${index}.wav` })),
    })
    created[0].currentTime = 11
    created[0].dispatch("timeupdate")
    await Promise.resolve()
    await Promise.resolve()

    assert.equal(statuses.at(-1).state, "error")
    assert.equal(created[0].paused, false)
    assert.equal(snapshots.at(-1).voices.length, 1)
    player.stop()
  })

  it("starts natural-end crossfade recovery at the source target gain", async () => {
    const created = []
    const player = playerModule.createSignatureSoundPreviewPlayer({
      createAudio(url) {
        const audio = createFakeAudio(url, 1)
        created.push(audio)
        return audio
      },
      random: () => 0,
    })
    const targetVolume = 10 ** (-6 / 20)
    await player.start({
      groupId: "signature-extra:room-tone",
      strategyId: "adaptive-whole-source-sequence",
      previewSettings: { transitionMode: "crossfade", transitionSeconds: 0.5 },
      constructionPolicy: {
        minimumSelectionsBeforeRepeat: null,
        transitionDurationRange: null,
        cadenceBoundary: null,
        overlapNextEvent: false,
      },
      sources: [{ sourceId: SOURCE_IDS[0], relativePath: "room.wav", gainDb: -6 }],
    })
    created[0].dispatch("ended")
    await Promise.resolve()
    await Promise.resolve()

    assert.equal(created.length, 2)
    assert.ok(Math.abs(created[1].volume - targetVolume) < 1e-9)
    player.stop()
  })

  it("coalesces manual advances for the full lifetime of an automatic crossfade", async () => {
    const created = []
    const timers = []
    const player = playerModule.createSignatureSoundPreviewPlayer({
      createAudio(url) {
        const audio = createFakeAudio(url)
        created.push(audio)
        return audio
      },
      random: () => 0,
      setTimer(callback, delay) {
        const timer = { callback, delay, fired: false, cleared: false }
        timers.push(timer)
        return timer
      },
      clearTimer(timer) { timer.cleared = true },
    })
    await player.start({
      groupId: "signature-extra:room-tone",
      strategyId: "adaptive-whole-source-sequence",
      previewSettings: { transitionMode: "crossfade", transitionSeconds: 2 },
      constructionPolicy: {
        minimumSelectionsBeforeRepeat: null,
        transitionDurationRange: null,
        cadenceBoundary: null,
        overlapNextEvent: false,
      },
      sources: SOURCE_IDS.map((sourceId, index) => ({ sourceId, relativePath: `${index}.wav` })),
    })
    created[0].currentTime = 18.1
    created[0].dispatch("timeupdate")
    await Promise.resolve()
    await Promise.resolve()
    const firstManual = player.advance()
    const repeatedManual = player.advance()
    assert.equal(created.length, 2)

    for (let index = 0; index < 40; index += 1) {
      const timer = timers.find((candidate) => !candidate.fired && !candidate.cleared)
      assert.ok(timer, `crossfade timer ${index + 1} must exist`)
      timer.fired = true
      timer.callback()
    }
    await Promise.all([firstManual, repeatedManual])
    assert.equal(created.length, 2, "manual requests must share the active automatic fade")
    assert.equal(created[0].paused, true)
    player.stop()
  })

  it("requeues a cadence boundary that arrives during a longer crossfade", async () => {
    const created = []
    const timers = []
    const player = playerModule.createSignatureSoundPreviewPlayer({
      createAudio(url) {
        const audio = createFakeAudio(url, 3)
        created.push(audio)
        return audio
      },
      random: () => 0,
      setTimer(callback, delay) {
        const timer = { callback, delay, fired: false, cleared: false }
        timers.push(timer)
        return timer
      },
      clearTimer(timer) { timer.cleared = true },
    })
    await player.start({
      groupId: "moodist:walk-on-gravel",
      strategyId: "walking-cadence-sequence",
      previewSettings: { stepsPerMinute: 120, jitterPercent: 0 },
      constructionPolicy: {
        minimumSelectionsBeforeRepeat: null,
        transitionDurationRange: null,
        cadenceBoundary: { mode: "crossfade", crossfadeSeconds: 2 },
        overlapNextEvent: false,
      },
      sources: SOURCE_IDS.map((sourceId, index) => ({ sourceId, relativePath: `${index}.wav` })),
    })

    const firstCadence = timers.find(({ delay }) => delay === 500)
    firstCadence.fired = true
    firstCadence.callback()
    await Promise.resolve()
    await Promise.resolve()
    const secondCadence = timers.find((timer) => timer.delay === 500 && !timer.fired)
    secondCadence.fired = true
    secondCadence.callback()
    assert.equal(created.length, 2, "the cadence event must coalesce while its fade is active")

    for (let index = 0; index < 40; index += 1) {
      const timer = timers.find((candidate) => !candidate.fired && !candidate.cleared && candidate.delay < 500)
      assert.ok(timer, `cadence crossfade timer ${index + 1} must exist`)
      timer.fired = true
      timer.callback()
    }
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
    assert.equal(created.length, 3, "the consumed cadence boundary must run after the fade")
    assert.ok(timers.some((timer) => timer.delay === 500 && !timer.fired), "the cadence must keep scheduling")
    player.stop()
  })
})
