import assert from "node:assert/strict"
import { describe, it } from "node:test"

const polling = await import("../app/anatomime/anatomime-polling.ts")

const {
  ANATOMIME_RATE_LIMITED_POLL_STATUS,
  fetchAnatomimeRoomSnapshot,
  nextAnatomimePollSchedule,
  nextAnatomimeVisibilitySchedule,
} = polling

function requirePollingFunction(value, name) {
  assert.equal(typeof value, "function", `${name} must be implemented`)
  return value
}

function jsonResponse(status, body, headers) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  })
}

function validSession(overrides = {}) {
  return {
    code: "AB12",
    status: "PLAYING",
    phase: "ACTIVE_TERM",
    config: {
      answerMode: "typed",
      clueLevel: "easy",
      roundSeconds: 30,
      termCount: 4,
      roundLimit: 3,
      hardcoreMode: false,
    },
    phaseEndsAt: "2026-08-31T12:00:00.000Z",
    reviewExpiresAt: null,
    teams: [{ id: "team-1", name: "Team 1", sortOrder: 0, score: 1 }],
    players: [{
      id: "player-1",
      teamId: "team-1",
      displayName: "Avery",
      signedIn: false,
      isHost: false,
      lastSeenAt: "2026-08-31T11:59:00.000Z",
    }],
    viewer: { isHost: false, playerId: "player-1", teamId: "team-1" },
    activeTeam: { id: "team-1", name: "Team 1", sortOrder: 0, score: 1 },
    activeItem: {
      index: 0,
      total: 4,
      prompt: {
        id: "card-1",
        name: "Trapezius",
        categoryLabel: "Muscle",
        regionLabels: ["Back"],
        bodySystemLabels: ["Muscular"],
        difficulty: "medium",
        definition: "A broad superficial back muscle.",
        aliases: ["traps"],
        media: [{ url: "/trapezius.webp", title: "Trapezius diagram" }],
      },
      choices: [{ id: "choice-1", label: "Trapezius" }],
      multipleChoiceUnlocksAt: null,
      pendingSteal: false,
    },
    turnReview: [{
      cardId: "card-1",
      id: "review-1",
      termKey: "term-1",
      name: "Trapezius",
      outcome: "got",
      scoredTeamId: "team-1",
    }],
    recap: [{ teamId: "team-1", got: 1, missed: 0, stolen: 0 }],
    hostElection: {
      id: "election-1",
      closesAt: "2026-08-31T12:01:00.000Z",
      candidatePlayerIds: ["player-1"],
      activeVoterPlayerIds: ["player-1"],
      submittedVoterPlayerIds: [],
    },
    hostCanBeChallenged: false,
    ...overrides,
  }
}

describe("Anatomime room fetch classification", () => {
  it("returns a successful room snapshot, composes its signal, and cleans up its deadline", { timeout: 250 }, async () => {
    const fetchRoom = requirePollingFunction(fetchAnatomimeRoomSnapshot, "fetchAnatomimeRoomSnapshot")
    const calls = []
    const controller = new AbortController()
    const session = validSession()

    const result = await fetchRoom({
      code: "AB12",
      credentials: { playerId: "player-1", token: "opaque-token" },
      signal: controller.signal,
      timeoutMs: 10,
      fetcher: async (url, init) => {
        calls.push({ url, init })
        return jsonResponse(200, { session })
      },
    })

    assert.deepEqual(result, { kind: "SUCCESS", session })
    assert.equal(calls.length, 1)
    assert.equal(calls[0].url, "/api/anatomime/sessions/AB12")
    assert.deepEqual(calls[0].init.headers, {
      "x-anatomime-player-id": "player-1",
      "x-anatomime-player-token": "opaque-token",
    })
    assert.notEqual(calls[0].init.signal, controller.signal)
    assert.equal(calls[0].init.signal.aborted, false)
    assert.equal(controller.signal.aborted, false)
    assert.equal(calls[0].init.cache, "no-store")

    await new Promise((resolve) => setTimeout(resolve, 25))
    assert.equal(calls[0].init.signal.aborted, false)
    controller.abort(new DOMException("Superseded", "AbortError"))
    await new Promise((resolve) => setImmediate(resolve))
    assert.equal(calls[0].init.signal.aborted, false)
  })

  it("fails a signal-aware stalled request at the internal deadline without aborting the caller", { timeout: 250 }, async () => {
    const fetchRoom = requirePollingFunction(fetchAnatomimeRoomSnapshot, "fetchAnatomimeRoomSnapshot")
    const controller = new AbortController()
    let capturedSignal
    let pendingCheck

    const pendingResult = fetchRoom({
      code: "AB12",
      signal: controller.signal,
      timeoutMs: 10,
      fetcher: async (_url, init = {}) => {
        capturedSignal = init.signal
        return new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(init.signal.reason), { once: true })
        })
      },
    })

    try {
      const result = await Promise.race([
        pendingResult,
        new Promise((resolve) => {
          pendingCheck = setTimeout(() => resolve({ kind: "STILL_PENDING" }), 40)
        }),
      ])
      assert.deepEqual(result, { kind: "FAILED" })
      assert.notEqual(capturedSignal, controller.signal)
      assert.equal(capturedSignal.aborted, true)
      assert.equal(capturedSignal.reason?.name, "TimeoutError")
      assert.equal(controller.signal.aborted, false)
    } finally {
      clearTimeout(pendingCheck)
      if (!controller.signal.aborted) {
        controller.abort(new DOMException("Test cleanup", "AbortError"))
      }
      await pendingResult
    }
  })

  it("keeps the snapshot deadline active while successful JSON stalls", { timeout: 250 }, async () => {
    const fetchRoom = requirePollingFunction(fetchAnatomimeRoomSnapshot, "fetchAnatomimeRoomSnapshot")
    const controller = new AbortController()
    let capturedSignal
    let pendingCheck

    const pendingResult = fetchRoom({
      code: "AB12",
      signal: controller.signal,
      timeoutMs: 10,
      fetcher: async (_url, init = {}) => {
        capturedSignal = init.signal
        return {
          ok: true,
          status: 200,
          headers: new Headers({ "content-type": "application/json" }),
          json: () => new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () => reject(init.signal.reason), { once: true })
          }),
        }
      },
    })

    try {
      const result = await Promise.race([
        pendingResult,
        new Promise((resolve) => {
          pendingCheck = setTimeout(() => resolve({ kind: "STILL_PENDING" }), 40)
        }),
      ])
      assert.deepEqual(result, { kind: "FAILED" })
      assert.equal(capturedSignal.aborted, true)
      assert.equal(capturedSignal.reason?.name, "TimeoutError")
      assert.equal(controller.signal.aborted, false)
    } finally {
      clearTimeout(pendingCheck)
      if (!controller.signal.aborted) {
        controller.abort(new DOMException("Test cleanup", "AbortError"))
      }
      await pendingResult
    }
  })

  it("keeps caller aborts retryable while preserving their abort reason", async () => {
    const fetchRoom = requirePollingFunction(fetchAnatomimeRoomSnapshot, "fetchAnatomimeRoomSnapshot")
    const controller = new AbortController()
    let capturedSignal

    const pendingResult = fetchRoom({
      code: "AB12",
      signal: controller.signal,
      timeoutMs: 1_000,
      fetcher: async (_url, init = {}) => {
        capturedSignal = init.signal
        return new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(init.signal.reason), { once: true })
        })
      },
    })
    controller.abort(new DOMException("Superseded", "AbortError"))

    assert.deepEqual(await pendingResult, { kind: "FAILED" })
    assert.notEqual(capturedSignal, controller.signal)
    assert.equal(capturedSignal.aborted, true)
    assert.equal(capturedSignal.reason?.name, "AbortError")
    assert.equal(controller.signal.reason?.name, "AbortError")
  })

  for (const retryCase of [
    { label: "an integer Retry-After", headerValue: "7", expectedSeconds: 7 },
    { label: "a negative Retry-After", headerValue: "-5", expectedSeconds: 0 },
    { label: "a malformed Retry-After", headerValue: "abc", expectedSeconds: 0 },
    { label: "a missing Retry-After", headerValue: undefined, expectedSeconds: 0 },
  ]) {
    it(`classifies rate limits with ${retryCase.label}`, async () => {
      const fetchRoom = requirePollingFunction(fetchAnatomimeRoomSnapshot, "fetchAnatomimeRoomSnapshot")
      const result = await fetchRoom({
        code: "AB12",
        fetcher: async () => jsonResponse(
          429,
          { error: "Slow down." },
          retryCase.headerValue === undefined ? undefined : { "Retry-After": retryCase.headerValue },
        ),
      })

      assert.deepEqual(result, {
        kind: "RATE_LIMITED",
        retryAfterSeconds: retryCase.expectedSeconds,
      })
      assert.equal(Number.isSafeInteger(result.retryAfterSeconds), true)
      assert.ok(result.retryAfterSeconds >= 0)
    })
  }

  it("classifies missing rooms as ended", async () => {
    const fetchRoom = requirePollingFunction(fetchAnatomimeRoomSnapshot, "fetchAnatomimeRoomSnapshot")
    const result = await fetchRoom({
      code: "AB12",
      fetcher: async () => jsonResponse(404, { error: "Game not found." }),
    })

    assert.deepEqual(result, { kind: "ROOM_ENDED" })
  })

  for (const status of [401, 403]) {
    it(`classifies credentialed ${status} as rejoin required`, async () => {
      const fetchRoom = requirePollingFunction(fetchAnatomimeRoomSnapshot, "fetchAnatomimeRoomSnapshot")
      const result = await fetchRoom({
        code: "AB12",
        credentials: { playerId: "player-1", token: "opaque-token" },
        fetcher: async () => jsonResponse(status, { error: "Join this room." }),
      })

      assert.deepEqual(result, { kind: "REJOIN_REQUIRED" })
    })
  }

  it("keeps uncredentialed authorization failures retryable", async () => {
    const fetchRoom = requirePollingFunction(fetchAnatomimeRoomSnapshot, "fetchAnatomimeRoomSnapshot")
    const result = await fetchRoom({
      code: "AB12",
      fetcher: async () => jsonResponse(403, { error: "Join this room." }),
    })

    assert.deepEqual(result, { kind: "FAILED" })
  })

  it("keeps structurally incomplete 2xx payloads retryable", async () => {
    const fetchRoom = requirePollingFunction(fetchAnatomimeRoomSnapshot, "fetchAnatomimeRoomSnapshot")
    const result = await fetchRoom({
      code: "AB12",
      fetcher: async () => jsonResponse(200, {
        session: { code: "AB12", status: "PLAYING", phase: "ACTIVE_TERM" },
      }),
    })

    assert.deepEqual(result, { kind: "FAILED" })
  })

  it("rejects a structurally valid snapshot for a different room code", async () => {
    const fetchRoom = requirePollingFunction(fetchAnatomimeRoomSnapshot, "fetchAnatomimeRoomSnapshot")
    const result = await fetchRoom({
      code: "AB12",
      fetcher: async () => jsonResponse(200, { session: validSession({ code: "ZZ99" }) }),
    })

    assert.deepEqual(result, { kind: "FAILED" })
  })

  const malformedSnapshots = [
    ["timestamp nullability", (session) => { session.phaseEndsAt = 42 }],
    ["config scalars", (session) => { session.config.roundSeconds = "30" }],
    ["team scalars", (session) => { session.teams[0].score = "1" }],
    ["player nullability", (session) => { session.players[0].lastSeenAt = null }],
    ["viewer nullability", (session) => { session.viewer.playerId = 7 }],
    ["active-team scalars", (session) => { session.activeTeam.sortOrder = "0" }],
    ["prompt media", (session) => { session.activeItem.prompt.media[0].title = null }],
    ["active-item choices", (session) => { session.activeItem.choices[0].label = null }],
    ["turn-review enums", (session) => { session.turnReview[0].outcome = "unknown" }],
    ["recap scalars", (session) => { session.recap[0].got = "1" }],
    ["host-election identifiers", (session) => { session.hostElection.candidatePlayerIds[0] = 9 }],
    ["optional host flags", (session) => { session.hostCanBeChallenged = "yes" }],
  ]

  for (const [label, mutate] of malformedSnapshots) {
    it(`rejects malformed ${label} in a 2xx snapshot`, async () => {
      const fetchRoom = requirePollingFunction(fetchAnatomimeRoomSnapshot, "fetchAnatomimeRoomSnapshot")
      const session = structuredClone(validSession())
      mutate(session)
      const result = await fetchRoom({
        code: "AB12",
        fetcher: async () => jsonResponse(200, { session }),
      })

      assert.deepEqual(result, { kind: "FAILED" })
    })
  }

  it("keeps 503, malformed JSON, and network failures retryable", async () => {
    const fetchRoom = requirePollingFunction(fetchAnatomimeRoomSnapshot, "fetchAnatomimeRoomSnapshot")
    const results = await Promise.all([
      fetchRoom({ code: "AB12", fetcher: async () => jsonResponse(503, { error: "Unavailable." }) }),
      fetchRoom({
        code: "AB12",
        fetcher: async () => new Response("{", { status: 200, headers: { "content-type": "application/json" } }),
      }),
      fetchRoom({ code: "AB12", fetcher: async () => { throw new Error("network") } }),
    ])

    assert.deepEqual(results, [{ kind: "FAILED" }, { kind: "FAILED" }, { kind: "FAILED" }])
  })
})

describe("Anatomime poll scheduling", () => {
  const success = { kind: "SUCCESS", session: validSession() }

  it("uses the exact visible active, visible idle, and hidden success cadences", () => {
    const schedule = requirePollingFunction(nextAnatomimePollSchedule, "nextAnatomimePollSchedule")

    assert.deepEqual(schedule({
      result: success,
      roomStatus: "PLAYING",
      roomPhase: "ACTIVE_TERM",
      documentHidden: false,
      consecutiveFailures: 3,
    }), { action: "SCHEDULE", delayMs: 2_000, consecutiveFailures: 0 })
    assert.deepEqual(schedule({
      result: success,
      roomStatus: "LOBBY",
      roomPhase: "LOBBY",
      documentHidden: false,
      consecutiveFailures: 3,
    }), { action: "SCHEDULE", delayMs: 5_000, consecutiveFailures: 0 })
    assert.deepEqual(schedule({
      result: success,
      roomStatus: "REVIEW",
      roomPhase: "GAME_COMPLETE",
      documentHidden: false,
      consecutiveFailures: 3,
    }), { action: "SCHEDULE", delayMs: 5_000, consecutiveFailures: 0 })
    assert.deepEqual(schedule({
      result: success,
      roomStatus: "PLAYING",
      roomPhase: "ACTIVE_TERM",
      documentHidden: true,
      consecutiveFailures: 3,
    }), { action: "SCHEDULE", delayMs: 15_000, consecutiveFailures: 0 })
  })

  it("uses deterministic positive jitter over the bounded failure sequence", () => {
    const schedule = requirePollingFunction(nextAnatomimePollSchedule, "nextAnatomimePollSchedule")
    const delays = []
    let failures = 0

    for (let index = 0; index < 6; index += 1) {
      const next = schedule({
        result: { kind: "FAILED" },
        documentHidden: false,
        consecutiveFailures: failures,
        random: () => 0.5,
      })
      assert.equal(next.action, "SCHEDULE")
      delays.push(next.delayMs)
      failures = next.consecutiveFailures
    }

    assert.deepEqual(delays, [2_100, 4_200, 8_400, 16_800, 28_500, 28_500])
    assert.equal(failures, 6)
    assert.equal(schedule({
      result: { kind: "FAILED" },
      documentHidden: false,
      consecutiveFailures: 0,
      random: () => 0,
    }).delayMs, 2_001)
  })

  it("honors Retry-After as a floor while preserving failure state", () => {
    const schedule = requirePollingFunction(nextAnatomimePollSchedule, "nextAnatomimePollSchedule")

    assert.equal(
      ANATOMIME_RATE_LIMITED_POLL_STATUS,
      "Updates are paused. Automatic refresh will resume when the server allows it.",
    )

    assert.deepEqual(schedule({
      result: { kind: "RATE_LIMITED", retryAfterSeconds: 0 },
      documentHidden: false,
      consecutiveFailures: 0,
      random: () => 0,
    }), { action: "SCHEDULE", delayMs: 2_001, consecutiveFailures: 1 })
    assert.deepEqual(schedule({
      result: { kind: "RATE_LIMITED", retryAfterSeconds: 12 },
      documentHidden: false,
      consecutiveFailures: 0,
      random: () => 0,
    }), { action: "SCHEDULE", delayMs: 12_000, consecutiveFailures: 1 })
    assert.equal(schedule({
      result: { kind: "RATE_LIMITED", retryAfterSeconds: 45 },
      documentHidden: false,
      consecutiveFailures: 8,
      random: () => 0.5,
    }).delayMs, 45_000)
    assert.equal(schedule({
      result: { kind: "RATE_LIMITED", retryAfterSeconds: 600 },
      documentHidden: false,
      consecutiveFailures: 4,
      random: () => 0,
    }).delayMs, 600_000)
    assert.equal(schedule({
      result: { kind: "RATE_LIMITED", retryAfterSeconds: Number.MAX_SAFE_INTEGER },
      documentHidden: false,
      consecutiveFailures: 4,
      random: () => 0,
    }).delayMs, 600_000)
  })

  it("retains bounded jitter at the terminal failure attempt", () => {
    const schedule = requirePollingFunction(nextAnatomimePollSchedule, "nextAnatomimePollSchedule")
    const terminalDelay = (random) => schedule({
      result: { kind: "FAILED" },
      documentHidden: false,
      consecutiveFailures: 4,
      random: () => random,
    }).delayMs

    assert.equal(terminalDelay(0), 27_001)
    assert.equal(terminalDelay(0.5), 28_500)
    assert.equal(terminalDelay(1), 30_000)
  })

  it("stops ended and credential-invalid rooms", () => {
    const schedule = requirePollingFunction(nextAnatomimePollSchedule, "nextAnatomimePollSchedule")

    assert.deepEqual(schedule({
      result: { kind: "ROOM_ENDED" },
      documentHidden: false,
      consecutiveFailures: 0,
    }), { action: "STOP", reason: "ROOM_ENDED" })
    assert.deepEqual(schedule({
      result: { kind: "REJOIN_REQUIRED" },
      documentHidden: false,
      consecutiveFailures: 0,
    }), { action: "STOP", reason: "REJOIN_REQUIRED" })
  })

  for (const status of ["EXPIRED", "ENDED"]) {
    it(`stops a successful ${status} snapshot as room-ended`, () => {
      const schedule = requirePollingFunction(nextAnatomimePollSchedule, "nextAnatomimePollSchedule")

      assert.deepEqual(schedule({
        result: { kind: "SUCCESS", session: validSession({ status, phase: "GAME_COMPLETE" }) },
        roomStatus: status,
        roomPhase: "GAME_COMPLETE",
        documentHidden: false,
        consecutiveFailures: 0,
      }), { action: "STOP", reason: "ROOM_ENDED" })
    })
  }
})

describe("Anatomime visibility rescheduling", () => {
  it("re-arms only successful snapshots for the new visibility cadence", () => {
    const schedule = requirePollingFunction(nextAnatomimeVisibilitySchedule, "nextAnatomimeVisibilitySchedule")
    const active = { kind: "SUCCESS", session: validSession() }
    const lobby = {
      kind: "SUCCESS",
      session: validSession({ status: "LOBBY", phase: "LOBBY", activeTeam: null, activeItem: null }),
    }

    assert.deepEqual(schedule({ result: active, documentHidden: true }), {
      action: "SCHEDULE",
      delayMs: 15_000,
      consecutiveFailures: 0,
    })
    assert.deepEqual(schedule({ result: active, documentHidden: false }), {
      action: "SCHEDULE",
      delayMs: 2_000,
      consecutiveFailures: 0,
    })
    assert.deepEqual(schedule({ result: lobby, documentHidden: false }), {
      action: "SCHEDULE",
      delayMs: 5_000,
      consecutiveFailures: 0,
    })
    assert.equal(schedule({ result: { kind: "FAILED" }, documentHidden: true }), null)
    assert.equal(schedule({
      result: { kind: "RATE_LIMITED", retryAfterSeconds: 30 },
      documentHidden: false,
    }), null)
  })
})
