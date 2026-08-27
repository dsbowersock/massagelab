import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

async function loadPreviewModule() {
  try {
    return await import("../lib/atmoshaper/signature-sound-preview.js")
  } catch (error) {
    assert.fail(`Signature sound preview owner must load: ${error?.message ?? error}`)
  }
}

async function loadPlayerModule() {
  try {
    return await import("../lib/atmoshaper/signature-sound-preview-player.js")
  } catch (error) {
    assert.fail(`Signature sound preview player must load: ${error?.message ?? error}`)
  }
}

const SOURCE_IDS = ["1", "2", "3"].map((digit) => digit.repeat(64))

function fixtureInputs() {
  return {
    curatedReview: {
      decisions: [
        { sourceId: SOURCE_IDS[0], decision: "keep", origin: "explicit", note: "" },
        { sourceId: SOURCE_IDS[1], decision: "maybe", origin: "contextual-unmarked", note: "" },
        { sourceId: SOURCE_IDS[2], decision: "reject", origin: "explicit", note: "Noisy." },
      ],
      groups: [
        {
          groupId: "moodist:waves",
          conceptKind: "moodist",
          conceptId: "waves",
          sourceCounts: { total: 3, keep: 1, maybe: 1, reject: 1 },
        },
        {
          groupId: "signature-extra:keys-jingling",
          conceptKind: "signature-extra",
          conceptId: "keys-jingling",
          sourceCounts: { total: 1, keep: 0, maybe: 1, reject: 0 },
        },
      ],
    },
    discoveryReview: {
      sources: [
        {
          sourceId: SOURCE_IDS[0],
          relativePath: "Waves/shore-a.wav",
          reviewState: "candidate",
          moodistConcepts: [{ id: "waves" }],
          signatureExtraConcepts: [],
        },
        {
          sourceId: SOURCE_IDS[1],
          relativePath: "Keys/key-a.wav",
          reviewState: "candidate",
          moodistConcepts: [{ id: "waves" }],
          signatureExtraConcepts: [{ id: "keys-jingling" }],
        },
        {
          sourceId: SOURCE_IDS[2],
          relativePath: "Waves/rejected.wav",
          reviewState: "candidate",
          moodistConcepts: [{ id: "waves" }],
          signatureExtraConcepts: [],
        },
      ],
    },
  }
}

describe("AtmoShaper Signature sound strategy preview", () => {
  it("validates closed strategy-specific settings and creates deterministic audition keys", async () => {
    const {
      createSignatureSoundExactPreviewAuditionKey,
      createSignatureSoundPreviewAuditionKey,
      defaultSignatureSoundPreviewSettings,
      validateSignatureSoundPreviewSettings,
    } = await loadPreviewModule()

    assert.deepEqual(defaultSignatureSoundPreviewSettings("adaptive-whole-source-sequence"), {
      transitionMode: "crossfade",
      transitionSeconds: 2,
    })
    assert.deepEqual(defaultSignatureSoundPreviewSettings("walking-cadence-sequence"), {
      stepsPerMinute: 105,
      jitterPercent: 8,
    })
    assert.deepEqual(defaultSignatureSoundPreviewSettings("spaced-event-sequence"), {
      minimumGapSeconds: 3,
      maximumGapSeconds: 9,
    })

    const settings = validateSignatureSoundPreviewSettings("adaptive-one-shot-sequence", {
      transitionMode: "overlap",
      transitionSeconds: 1.5,
    })
    assert.deepEqual(settings, { transitionMode: "overlap", transitionSeconds: 1.5 })
    assert.deepEqual(validateSignatureSoundPreviewSettings("adaptive-whole-source-sequence", {
      transitionMode: "crossfade",
      transitionSeconds: 15,
    }), { transitionMode: "crossfade", transitionSeconds: 15 })
    assert.equal(
      createSignatureSoundPreviewAuditionKey({
        strategyId: "adaptive-one-shot-sequence",
        sourcePool: "keep-and-maybe",
        previewSettings: settings,
      }),
      createSignatureSoundPreviewAuditionKey({
        previewSettings: { transitionSeconds: 1.5, transitionMode: "overlap" },
        sourcePool: "keep-and-maybe",
        strategyId: "adaptive-one-shot-sequence",
      }),
    )
    const exactKey = createSignatureSoundExactPreviewAuditionKey({
      strategyId: "adaptive-one-shot-sequence",
      previewSettings: settings,
      includedSourceIds: [SOURCE_IDS[1], SOURCE_IDS[0]],
    })
    assert.equal(
      exactKey,
      createSignatureSoundExactPreviewAuditionKey({
        strategyId: "adaptive-one-shot-sequence",
        previewSettings: { transitionSeconds: 1.5, transitionMode: "overlap" },
        includedSourceIds: [SOURCE_IDS[0], SOURCE_IDS[1]],
      }),
    )
    assert.notEqual(exactKey, createSignatureSoundExactPreviewAuditionKey({
      strategyId: "adaptive-one-shot-sequence",
      previewSettings: settings,
      includedSourceIds: [SOURCE_IDS[0]],
    }))
    assert.throws(() => createSignatureSoundExactPreviewAuditionKey({
      strategyId: "adaptive-one-shot-sequence",
      previewSettings: settings,
      includedSourceIds: [SOURCE_IDS[0], SOURCE_IDS[0]],
    }), /duplicate|source/i)

    const invalid = [
      ["unknown-strategy", {}, /strategy/i],
      ["adaptive-whole-source-sequence", { transitionMode: "fade", transitionSeconds: 2 }, /transition/i],
      ["adaptive-whole-source-sequence", { transitionMode: "end-to-end", transitionSeconds: 2 }, /zero|end-to-end/i],
      ["adaptive-whole-source-sequence", { transitionMode: "crossfade", transitionSeconds: 99 }, /seconds|range/i],
      ["walking-cadence-sequence", { stepsPerMinute: 10, jitterPercent: 8 }, /steps|range/i],
      ["walking-cadence-sequence", { stepsPerMinute: 105, jitterPercent: 8, extra: true }, /unknown field/i],
      ["spaced-event-sequence", { minimumGapSeconds: 5, maximumGapSeconds: 4 }, /maximum|minimum/i],
    ]
    for (const [strategyId, raw, expected] of invalid) {
      assert.throws(() => validateSignatureSoundPreviewSettings(strategyId, raw), expected)
    }
  })

  it("binds only authoritative Keep and Maybe ingredients and fails closed on curation drift", async () => {
    const { createSignatureSoundPreviewGroups } = await loadPreviewModule()
    const input = fixtureInputs()
    const groups = createSignatureSoundPreviewGroups(input)
    assert.deepEqual(groups, [
      {
        groupId: "moodist:waves",
        sources: [
          { sourceId: SOURCE_IDS[0], relativePath: "Waves/shore-a.wav", decision: "keep" },
          { sourceId: SOURCE_IDS[1], relativePath: "Keys/key-a.wav", decision: "maybe" },
        ],
      },
      {
        groupId: "signature-extra:keys-jingling",
        sources: [
          { sourceId: SOURCE_IDS[1], relativePath: "Keys/key-a.wav", decision: "maybe" },
        ],
      },
    ])
    groups[0].sources[0].relativePath = "mutated.wav"
    assert.equal(input.discoveryReview.sources[0].relativePath, "Waves/shore-a.wav")

    const badCounts = fixtureInputs()
    badCounts.curatedReview.groups[0].sourceCounts.keep = 2
    assert.throws(() => createSignatureSoundPreviewGroups(badCounts), /count|drift|keep/i)
    const missingDecision = fixtureInputs()
    missingDecision.curatedReview.decisions.pop()
    assert.throws(() => createSignatureSoundPreviewGroups(missingDecision), /decision|candidate|missing/i)
    const fabricatedDecision = fixtureInputs()
    fabricatedDecision.curatedReview.decisions[0].sourceId = "f".repeat(64)
    assert.throws(() => createSignatureSoundPreviewGroups(fabricatedDecision), /source|candidate|unknown/i)
  })

  it("reconciles every real curated group to its exact non-rejected preview pool", async () => {
    const { createSignatureSoundPreviewGroups } = await loadPreviewModule()
    const curatedReview = JSON.parse(await readFile(
      new URL("../data/atmoshaper/signature-sound-listening-review.json", import.meta.url),
      "utf8",
    ))
    const discoveryReview = JSON.parse(await readFile(
      new URL("../data/atmoshaper/signature-sound-review.json", import.meta.url),
      "utf8",
    ))
    const previewGroups = createSignatureSoundPreviewGroups({ curatedReview, discoveryReview })

    assert.equal(previewGroups.length, 93)
    const previewById = new Map(previewGroups.map((group) => [group.groupId, group]))
    for (const group of curatedReview.groups) {
      const preview = previewById.get(group.groupId)
      assert.ok(preview, `missing real preview group ${group.groupId}`)
      assert.equal(preview.sources.length, group.sourceCounts.keep + group.sourceCounts.maybe)
      assert.ok(preview.sources.every((source) => source.decision === "keep" || source.decision === "maybe"))
    }
    assert.equal(previewById.get("moodist:walk-in-snow").sources.length, 8)
    assert.equal(previewById.get("moodist:walk-on-gravel").sources.length, 60)
    assert.equal(previewById.get("signature-extra:walk-on-stone").sources.length, 60)
  })

  it("selects deterministically without immediate repeats and bounds cadence and event delays", async () => {
    const { chooseSignatureSoundPreviewSource, getSignatureSoundPreviewDelayMs } = await loadPreviewModule()
    assert.equal(chooseSignatureSoundPreviewSource(SOURCE_IDS, SOURCE_IDS[1], () => 0), SOURCE_IDS[0])
    assert.equal(chooseSignatureSoundPreviewSource(SOURCE_IDS, SOURCE_IDS[1], () => 0.999), SOURCE_IDS[2])
    assert.equal(chooseSignatureSoundPreviewSource([SOURCE_IDS[0]], SOURCE_IDS[0], () => 0), SOURCE_IDS[0])
    assert.throws(() => chooseSignatureSoundPreviewSource([], null, () => 0), /source/i)

    const cadence = { stepsPerMinute: 120, jitterPercent: 10 }
    assert.equal(getSignatureSoundPreviewDelayMs("walking-cadence-sequence", cadence, () => 0), 450)
    assert.ok(getSignatureSoundPreviewDelayMs("walking-cadence-sequence", cadence, () => 0.999) <= 550)
    assert.equal(getSignatureSoundPreviewDelayMs(
      "spaced-event-sequence",
      { minimumGapSeconds: 2, maximumGapSeconds: 5 },
      () => 0,
    ), 2000)
    assert.ok(getSignatureSoundPreviewDelayMs(
      "spaced-event-sequence",
      { minimumGapSeconds: 2, maximumGapSeconds: 5 },
      () => 0.999,
    ) < 5000)
  })

  it("enforces construction history windows without deadlocking a smaller source pool", async () => {
    const { chooseSignatureSoundPreviewSourceWithHistory } = await loadPreviewModule()
    assert.equal(
      typeof chooseSignatureSoundPreviewSourceWithHistory,
      "function",
      "construction history selection must be implemented by the preview owner",
    )

    assert.equal(chooseSignatureSoundPreviewSourceWithHistory(SOURCE_IDS, [], 4, () => 0), SOURCE_IDS[0])
    assert.equal(chooseSignatureSoundPreviewSourceWithHistory(SOURCE_IDS, [SOURCE_IDS[0]], 4, () => 0), SOURCE_IDS[1])
    assert.equal(chooseSignatureSoundPreviewSourceWithHistory(
      SOURCE_IDS,
      [SOURCE_IDS[0], SOURCE_IDS[1]],
      4,
      () => 0,
    ), SOURCE_IDS[2])
    assert.equal(chooseSignatureSoundPreviewSourceWithHistory(
      SOURCE_IDS,
      [SOURCE_IDS[0], SOURCE_IDS[1], SOURCE_IDS[2]],
      4,
      () => 0,
    ), SOURCE_IDS[0])
    assert.equal(chooseSignatureSoundPreviewSourceWithHistory(
      SOURCE_IDS.slice(0, 2),
      [SOURCE_IDS[0], SOURCE_IDS[1]],
      4,
      () => 0,
    ), SOURCE_IDS[0])
  })

  it("validates closed construction policies and samples every transition inside its range", async () => {
    const {
      getSignatureSoundConstructionTransitionSeconds,
      validateSignatureSoundConstructionPlaybackPolicy,
      validateSignatureSoundPreviewSettings,
    } = await loadPreviewModule()
    assert.equal(typeof validateSignatureSoundConstructionPlaybackPolicy, "function")
    assert.equal(typeof getSignatureSoundConstructionTransitionSeconds, "function")

    const continuousSettings = { transitionMode: "crossfade", transitionSeconds: 3.75 }
    const continuousPolicy = {
      minimumSelectionsBeforeRepeat: null,
      transitionDurationRange: { minimumSeconds: 3.75, maximumSeconds: 10 },
      cadenceBoundary: null,
      overlapNextEvent: false,
    }
    assert.deepEqual(
      validateSignatureSoundConstructionPlaybackPolicy(
        "adaptive-whole-source-sequence",
        continuousSettings,
        continuousPolicy,
      ),
      continuousPolicy,
    )
    assert.equal(getSignatureSoundConstructionTransitionSeconds(continuousPolicy, 2, () => 0), 3.75)
    assert.ok(getSignatureSoundConstructionTransitionSeconds(continuousPolicy, 2, () => 0.999) < 10)

    const fullLengthOverlapPolicy = {
      ...continuousPolicy,
      transitionDurationRange: { minimumSeconds: 2, maximumSeconds: 6 },
      preserveFullLengthOverlaps: true,
    }
    assert.deepEqual(validateSignatureSoundConstructionPlaybackPolicy(
      "adaptive-whole-source-sequence",
      { transitionMode: "overlap", transitionSeconds: 2 },
      fullLengthOverlapPolicy,
    ), fullLengthOverlapPolicy)
    assert.throws(() => validateSignatureSoundConstructionPlaybackPolicy(
      "adaptive-whole-source-sequence",
      continuousSettings,
      { ...continuousPolicy, preserveFullLengthOverlaps: true },
    ), /preserve|overlap/i)

    const cadencePolicy = {
      minimumSelectionsBeforeRepeat: 3,
      transitionDurationRange: null,
      cadenceBoundary: { mode: "crossfade", crossfadeSeconds: 0.12 },
      overlapNextEvent: false,
    }
    assert.deepEqual(validateSignatureSoundConstructionPlaybackPolicy(
      "walking-cadence-sequence",
      { stepsPerMinute: 92, jitterPercent: 3 },
      cadencePolicy,
    ), cadencePolicy)
    assert.deepEqual(validateSignatureSoundConstructionPlaybackPolicy(
      "walking-cadence-sequence",
      { stepsPerMinute: 44, jitterPercent: 1 },
      { ...cadencePolicy, cadenceBoundary: null, overlapNextEvent: true },
    ), { ...cadencePolicy, cadenceBoundary: null, overlapNextEvent: true })

    assert.throws(() => validateSignatureSoundConstructionPlaybackPolicy(
      "spaced-event-sequence",
      { minimumGapSeconds: 0, maximumGapSeconds: 16 },
      { ...continuousPolicy, transitionDurationRange: null, extra: true },
    ), /unknown field/i)
    assert.throws(() => validateSignatureSoundConstructionPlaybackPolicy(
      "walking-cadence-sequence",
      { stepsPerMinute: 92, jitterPercent: 3 },
      { ...cadencePolicy, cadenceBoundary: { mode: "fade", crossfadeSeconds: 0.12 } },
    ), /boundary|mode|supported/i)
    assert.throws(() => validateSignatureSoundConstructionPlaybackPolicy(
      "spaced-event-sequence",
      { minimumGapSeconds: 0, maximumGapSeconds: 16 },
      continuousPolicy,
    ), /transition|strategy/i)

    assert.deepEqual(validateSignatureSoundPreviewSettings(
      "walking-cadence-sequence",
      { stepsPerMinute: 105, jitterPercent: 8 },
    ), { stepsPerMinute: 105, jitterPercent: 8 })
  })

  it("owns one active preview, advances events, and stops every preview voice", async () => {
    const { createSignatureSoundPreviewPlayer } = await loadPlayerModule()
    const created = []
    const timers = []
    const createAudio = (url) => {
      const audio = {
        url,
        currentTime: 0,
        duration: 1,
        volume: 1,
        paused: true,
        onended: null,
        onloadedmetadata: null,
        ontimeupdate: null,
        play() { this.paused = false; return Promise.resolve() },
        pause() { this.paused = true },
      }
      created.push(audio)
      return audio
    }
    const player = createSignatureSoundPreviewPlayer({
      createAudio,
      random: () => 0,
      setTimer(callback, delay) {
        const timer = { callback, delay, cleared: false }
        timers.push(timer)
        return timer
      },
      clearTimer(timer) { timer.cleared = true },
    })
    const sources = [
      { sourceId: SOURCE_IDS[0], relativePath: "one.wav", decision: "keep" },
      { sourceId: SOURCE_IDS[1], relativePath: "two.wav", decision: "maybe" },
    ]

    await player.start({
      groupId: "moodist:walk-in-snow",
      strategyId: "walking-cadence-sequence",
      previewSettings: { stepsPerMinute: 120, jitterPercent: 0 },
      sources,
    })
    assert.equal(created.length, 1)
    assert.equal(created[0].paused, false)
    assert.equal(timers[0].delay, 500)
    await player.advance()
    assert.equal(created.length, 2)
    assert.notEqual(created[0].url, created[1].url)

    await player.start({
      groupId: "moodist:waves",
      strategyId: "adaptive-whole-source-sequence",
      previewSettings: { transitionMode: "end-to-end", transitionSeconds: 0 },
      sources,
    })
    assert.equal(created[0].paused, true)
    assert.equal(created[1].paused, true)
    assert.equal(created[2].paused, false)
    player.stop()
    assert.ok(created.every((audio) => audio.paused))
    assert.ok(timers.every((timer) => timer.cleared))
  })

  it("coalesces concurrent manual advances so a non-overlap cadence keeps one audible voice", async () => {
    const { createSignatureSoundPreviewPlayer } = await loadPlayerModule()
    const created = []
    let releaseAdvance
    const player = createSignatureSoundPreviewPlayer({
      createAudio(url) {
        const index = created.length
        const audio = {
          url,
          currentTime: 0,
          duration: 1,
          volume: 1,
          paused: true,
          onended: null,
          onloadedmetadata: null,
          ontimeupdate: null,
          play() {
            this.paused = false
            if (index === 1) return new Promise((resolve) => { releaseAdvance = resolve })
            return Promise.resolve()
          },
          pause() { this.paused = true },
        }
        created.push(audio)
        return audio
      },
      random: () => 0,
      setTimer(callback, delay) { return { callback, delay, cleared: false } },
      clearTimer(timer) { timer.cleared = true },
    })
    const sources = SOURCE_IDS.slice(0, 2).map((sourceId, index) => ({ sourceId, relativePath: `${index}.wav` }))

    await player.start({
      groupId: "moodist:walk-in-snow",
      strategyId: "walking-cadence-sequence",
      previewSettings: { stepsPerMinute: 120, jitterPercent: 0 },
      constructionPolicy: {
        minimumSelectionsBeforeRepeat: null,
        transitionDurationRange: null,
        cadenceBoundary: null,
        overlapNextEvent: false,
      },
      sources,
    })
    const firstAdvance = player.advance()
    const repeatedAdvance = player.advance()

    assert.equal(created.length, 2, "one pending manual advance must create only one next voice")
    releaseAdvance()
    await Promise.all([firstAdvance, repeatedAdvance])
    assert.equal(created.filter(({ paused }) => !paused).length, 1)
  })

  it("coalesces a pending scheduled cadence event with a manual advance", async () => {
    const { createSignatureSoundPreviewPlayer } = await loadPlayerModule()
    const created = []
    const timers = []
    let releaseScheduledEvent
    const player = createSignatureSoundPreviewPlayer({
      createAudio(url) {
        const index = created.length
        const audio = {
          url,
          currentTime: 0,
          duration: 1,
          volume: 1,
          paused: true,
          onended: null,
          onloadedmetadata: null,
          ontimeupdate: null,
          play() {
            this.paused = false
            if (index === 1) return new Promise((resolve) => { releaseScheduledEvent = resolve })
            return Promise.resolve()
          },
          pause() { this.paused = true },
        }
        created.push(audio)
        return audio
      },
      random: () => 0,
      setTimer(callback, delay) {
        const timer = { callback, delay, cleared: false }
        timers.push(timer)
        return timer
      },
      clearTimer(timer) { timer.cleared = true },
    })
    const sources = SOURCE_IDS.slice(0, 2).map((sourceId, index) => ({ sourceId, relativePath: `${index}.wav` }))

    await player.start({
      groupId: "moodist:walk-in-snow",
      strategyId: "walking-cadence-sequence",
      previewSettings: { stepsPerMinute: 120, jitterPercent: 0 },
      constructionPolicy: {
        minimumSelectionsBeforeRepeat: null,
        transitionDurationRange: null,
        cadenceBoundary: null,
        overlapNextEvent: false,
      },
      sources,
    })
    timers.find(({ delay }) => delay === 500).callback()
    const manualAdvance = player.advance()

    assert.equal(created.length, 2, "a pending scheduled event must own the shared transition")
    releaseScheduledEvent()
    await manualAdvance
    assert.equal(created.filter(({ paused }) => !paused).length, 1)
  })

  it("applies construction history and samples a fresh continuous transition at each boundary", async () => {
    const { createSignatureSoundPreviewPlayer } = await loadPlayerModule()
    const created = []
    const timers = []
    const samples = [0, 0, 0, 0.999, 0, 0]
    const createAudio = (url) => {
      const audio = {
        url,
        currentTime: 0,
        duration: 20,
        volume: 1,
        paused: true,
        onended: null,
        onloadedmetadata: null,
        ontimeupdate: null,
        play() { this.paused = false; return Promise.resolve() },
        pause() { this.paused = true },
      }
      created.push(audio)
      return audio
    }
    const player = createSignatureSoundPreviewPlayer({
      createAudio,
      random: () => samples.shift() ?? 0,
      setTimer(callback, delay) {
        const timer = { callback, delay, cleared: false }
        timers.push(timer)
        return timer
      },
      clearTimer(timer) { timer.cleared = true },
    })
    const sources = SOURCE_IDS.map((sourceId, index) => ({ sourceId, relativePath: `${index}.wav` }))
    const noTransitionPolicy = {
      minimumSelectionsBeforeRepeat: 4,
      transitionDurationRange: null,
      cadenceBoundary: null,
      overlapNextEvent: false,
    }

    await player.start({
      groupId: "signature-extra:air-traffic-control",
      strategyId: "spaced-event-sequence",
      previewSettings: { minimumGapSeconds: 1, maximumGapSeconds: 7 },
      constructionPolicy: noTransitionPolicy,
      sources,
    })
    await player.advance()
    await player.advance()
    await player.advance()
    assert.deepEqual(created.slice(0, 4).map(({ url }) => url.match(/[123]{64}/)?.[0]), [
      SOURCE_IDS[0], SOURCE_IDS[1], SOURCE_IDS[2], SOURCE_IDS[0],
    ])

    created.length = 0
    timers.length = 0
    samples.splice(0, samples.length, 0, 0, 0, 0.999, 0)
    await player.start({
      groupId: "moodist:dryer",
      strategyId: "adaptive-whole-source-sequence",
      previewSettings: { transitionMode: "crossfade", transitionSeconds: 3.75 },
      constructionPolicy: {
        ...noTransitionPolicy,
        minimumSelectionsBeforeRepeat: null,
        transitionDurationRange: { minimumSeconds: 3.75, maximumSeconds: 10 },
      },
      sources: sources.slice(0, 2),
    })
    created[0].currentTime = 16
    created[0].ontimeupdate()
    assert.equal(created.length, 1)
    created[0].currentTime = 16.3
    created[0].ontimeupdate()
    await Promise.resolve()
    await Promise.resolve()
    assert.equal(created.length, 2)
    assert.ok(timers.some(({ delay }) => delay > 0 && delay <= 50))
    player.stop()
  })

  it("auditions cadence crossfade and overlap without creating a second player", async () => {
    const { createSignatureSoundPreviewPlayer } = await loadPlayerModule()
    const created = []
    const timers = []
    const player = createSignatureSoundPreviewPlayer({
      createAudio(url) {
        const audio = {
          url,
          currentTime: 0,
          duration: 2,
          volume: 1,
          paused: true,
          onended: null,
          onloadedmetadata: null,
          ontimeupdate: null,
          play() { this.paused = false; return Promise.resolve() },
          pause() { this.paused = true },
        }
        created.push(audio)
        return audio
      },
      random: () => 0,
      setTimer(callback, delay) {
        const timer = { callback, delay, cleared: false }
        timers.push(timer)
        return timer
      },
      clearTimer(timer) { timer.cleared = true },
    })
    const sources = SOURCE_IDS.slice(0, 2).map((sourceId, index) => ({ sourceId, relativePath: `${index}.wav` }))
    const basePolicy = {
      minimumSelectionsBeforeRepeat: null,
      transitionDurationRange: null,
      cadenceBoundary: { mode: "crossfade", crossfadeSeconds: 0.12 },
      overlapNextEvent: false,
    }

    await player.start({
      groupId: "moodist:walk-on-gravel",
      strategyId: "walking-cadence-sequence",
      previewSettings: { stepsPerMinute: 120, jitterPercent: 0 },
      constructionPolicy: basePolicy,
      sources,
    })
    timers.find(({ delay }) => delay === 500).callback()
    await Promise.resolve()
    await Promise.resolve()
    assert.equal(created[1].volume, 0)
    assert.ok(timers.some(({ delay }) => delay === 10))
    assert.equal(created[0].paused, false)

    player.stop()
    created.length = 0
    timers.length = 0
    await player.start({
      groupId: "moodist:walk-on-gravel",
      strategyId: "walking-cadence-sequence",
      previewSettings: { stepsPerMinute: 120, jitterPercent: 0 },
      constructionPolicy: {
        ...basePolicy,
        cadenceBoundary: { mode: "overlap", crossfadeSeconds: 0 },
      },
      sources,
    })
    timers.find(({ delay }) => delay === 500).callback()
    await Promise.resolve()
    await Promise.resolve()
    assert.equal(created[0].paused, false)
    assert.equal(created[1].volume, 1)
    assert.equal(timers.filter(({ delay }) => delay < 500).length, 0)
    player.stop()

    created.length = 0
    timers.length = 0
    await player.start({
      groupId: "signature-extra:moon-footsteps",
      strategyId: "walking-cadence-sequence",
      previewSettings: { stepsPerMinute: 120, jitterPercent: 0 },
      constructionPolicy: {
        ...basePolicy,
        cadenceBoundary: null,
        overlapNextEvent: false,
      },
      sources,
    })
    timers.find(({ delay }) => delay === 500).callback()
    await Promise.resolve()
    await Promise.resolve()
    assert.equal(created[0].paused, true, "non-overlap cadence retires the preceding event")
    assert.equal(created[1].paused, false)
    player.stop()

    created.length = 0
    timers.length = 0
    await player.start({
      groupId: "signature-extra:moon-footsteps",
      strategyId: "walking-cadence-sequence",
      previewSettings: { stepsPerMinute: 120, jitterPercent: 0 },
      constructionPolicy: {
        ...basePolicy,
        cadenceBoundary: null,
        overlapNextEvent: true,
      },
      sources,
    })
    timers.find(({ delay }) => delay === 500).callback()
    await Promise.resolve()
    await Promise.resolve()
    assert.equal(created[0].paused, false, "explicit overlap keeps the preceding event audible")
    assert.equal(created[1].paused, false)
    player.stop()
  })

  it("starts an exact setup preview from a selected included recording", async () => {
    const { createSignatureSoundPreviewPlayer } = await loadPlayerModule()
    const created = []
    const player = createSignatureSoundPreviewPlayer({
      createAudio(url) {
        const audio = {
          url,
          currentTime: 0,
          duration: 1,
          volume: 1,
          onended: null,
          onloadedmetadata: null,
          ontimeupdate: null,
          play() { return Promise.resolve() },
          pause() {},
        }
        created.push(audio)
        return audio
      },
      random: () => 0,
    })
    const sources = [
      { sourceId: SOURCE_IDS[0], relativePath: "one.wav" },
      { sourceId: SOURCE_IDS[1], relativePath: "two.wav" },
    ]
    await player.start({
      groupId: "moodist:waves",
      strategyId: "adaptive-whole-source-sequence",
      previewSettings: { transitionMode: "end-to-end", transitionSeconds: 0 },
      sources,
      initialSourceId: SOURCE_IDS[1],
    })
    assert.match(created[0].url, new RegExp(SOURCE_IDS[1]))
    await assert.rejects(() => player.start({
      groupId: "moodist:waves",
      strategyId: "adaptive-whole-source-sequence",
      previewSettings: { transitionMode: "end-to-end", transitionSeconds: 0 },
      sources,
      initialSourceId: SOURCE_IDS[2],
    }), /initial|included|source/i)
    player.stop()
  })

  it("does not let a retired group's late playback failure replace the active group's status", async () => {
    const { createSignatureSoundPreviewPlayer } = await loadPlayerModule()
    const statuses = []
    let rejectRetiredPlay
    let audioCount = 0
    const player = createSignatureSoundPreviewPlayer({
      createAudio() {
        audioCount += 1
        return {
          currentTime: 0,
          duration: 1,
          volume: 1,
          onended: null,
          onloadedmetadata: null,
          ontimeupdate: null,
          play() {
            if (audioCount !== 1) return Promise.resolve()
            return new Promise((_resolve, reject) => { rejectRetiredPlay = reject })
          },
          pause() {},
        }
      },
      onStatus(status) { statuses.push(status) },
      random: () => 0,
    })
    const sources = [{ sourceId: SOURCE_IDS[0], relativePath: "one.wav", decision: "keep" }]
    const retiredStart = player.start({
      groupId: "moodist:walk-in-snow",
      strategyId: "walking-cadence-sequence",
      previewSettings: { stepsPerMinute: 120, jitterPercent: 0 },
      sources,
    }).catch(() => {})
    await Promise.resolve()
    await player.start({
      groupId: "moodist:waves",
      strategyId: "adaptive-whole-source-sequence",
      previewSettings: { transitionMode: "end-to-end", transitionSeconds: 0 },
      sources,
    })
    rejectRetiredPlay(new Error("late retired failure"))
    await retiredStart

    assert.deepEqual(statuses.at(-1), {
      state: "playing",
      groupId: "moodist:waves",
      sourceId: SOURCE_IDS[0],
      relativePath: "one.wav",
    })
    player.stop()
  })

  it("retires a stopped session's voice when its delayed playback later succeeds", async () => {
    const { createSignatureSoundPreviewPlayer } = await loadPlayerModule()
    const created = []
    let resolveRetiredPlay
    const player = createSignatureSoundPreviewPlayer({
      createAudio() {
        const audio = {
          currentTime: 0,
          duration: 1,
          volume: 1,
          paused: true,
          onended: null,
          onloadedmetadata: null,
          ontimeupdate: null,
          play() {
            if (created.length !== 1) {
              this.paused = false
              return Promise.resolve()
            }
            return new Promise((resolve) => {
              resolveRetiredPlay = () => {
                this.paused = false
                resolve()
              }
            })
          },
          pause() { this.paused = true },
        }
        created.push(audio)
        return audio
      },
      random: () => 0,
    })
    const sources = [{ sourceId: SOURCE_IDS[0], relativePath: "one.wav", decision: "keep" }]
    const retiredStart = player.start({
      groupId: "moodist:walk-in-snow",
      strategyId: "walking-cadence-sequence",
      previewSettings: { stepsPerMinute: 120, jitterPercent: 0 },
      sources,
    })
    await Promise.resolve()
    await player.start({
      groupId: "moodist:waves",
      strategyId: "adaptive-whole-source-sequence",
      previewSettings: { transitionMode: "end-to-end", transitionSeconds: 0 },
      sources,
    })
    assert.equal(created[0].paused, true)

    resolveRetiredPlay()
    await retiredStart

    assert.equal(created[0].paused, true, "late success cannot revive a retired voice")
    assert.equal(created[1].paused, false)
    player.stop()
  })
})
