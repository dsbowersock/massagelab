import assert from "node:assert/strict"
import { describe, it } from "node:test"

let polling = {}
try {
  polling = await import("../app/anatomime/anatomime-polling.ts")
} catch (error) {
  if (error?.code !== "ERR_MODULE_NOT_FOUND") throw error
}

const { fetchAnatomimeRoomSnapshot, nextAnatomimePollSchedule } = polling

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
    config: {},
    teams: [],
    players: [],
    viewer: {},
    turnReview: [],
    recap: [],
    ...overrides,
  }
}

describe("Anatomime room fetch classification", () => {
  it("returns a successful room snapshot and sends only credential headers", async () => {
    const fetchRoom = requirePollingFunction(fetchAnatomimeRoomSnapshot, "fetchAnatomimeRoomSnapshot")
    const calls = []
    const controller = new AbortController()
    const session = validSession()

    const result = await fetchRoom({
      code: "AB12",
      credentials: { playerId: "player-1", token: "opaque-token" },
      signal: controller.signal,
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
    assert.equal(calls[0].init.signal, controller.signal)
    assert.equal(calls[0].init.cache, "no-store")
  })

  it("classifies rate limits with an integer Retry-After", async () => {
    const fetchRoom = requirePollingFunction(fetchAnatomimeRoomSnapshot, "fetchAnatomimeRoomSnapshot")
    const result = await fetchRoom({
      code: "AB12",
      fetcher: async () => jsonResponse(429, { error: "Slow down." }, { "Retry-After": "7" }),
    })

    assert.deepEqual(result, { kind: "RATE_LIMITED", retryAfterSeconds: 7 })
  })

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
  const success = { kind: "SUCCESS", session: { code: "AB12" } }

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

    assert.deepEqual(delays, [2_100, 4_200, 8_400, 16_800, 30_000, 30_000])
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
        result: { kind: "SUCCESS", session: { code: "AB12", status, phase: "GAME_COMPLETE" } },
        roomStatus: status,
        roomPhase: "GAME_COMPLETE",
        documentHidden: false,
        consecutiveFailures: 0,
      }), { action: "STOP", reason: "ROOM_ENDED" })
    })
  }
})
