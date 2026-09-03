import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import { hashToken } from "../lib/auth-security.js"
import { createCompiledModuleLoader } from "./helpers/compiled-module.mjs"
import {
  AnatomimeTrafficLimitError,
  coalesceAnatomimePlayerPresence,
  createAnatomimePollShedder,
  normalizeAnatomimeRoomIdentifier,
  preflightAnatomimeViewer,
  requireAnatomimeOperationalAllowance,
} from "../lib/anatomime-traffic-server.ts"

const loadCompiledModule = createCompiledModuleLoader(import.meta.url)
const apiSource = await readFile(new URL("../lib/anatomime-api.ts", import.meta.url), "utf8")
const roomServerSource = await readFile(new URL("../lib/anatomime-room-server.ts", import.meta.url), "utf8")
const trafficServerSource = await readFile(new URL("../lib/anatomime-traffic-server.ts", import.meta.url), "utf8")
const { anatomimeErrorResponse } = loadCompiledModule(apiSource, "lib/anatomime-api.ts", {
  "next/server": {
    NextResponse: {
      json: (body, init = {}) => new Response(JSON.stringify(body), {
        ...init,
        headers: { "content-type": "application/json", ...init.headers },
      }),
    },
  },
  "./anatomime-session-server.ts": { AnatomimeSessionError: class AnatomimeSessionError extends Error {} },
  "./anatomime-traffic-server.ts": { AnatomimeTrafficLimitError },
})

describe("Anatomime traffic server primitives", () => {
  it("normalizes room selectors to the canonical six-character namespace", () => {
    assert.equal(normalizeAnatomimeRoomIdentifier(" a-b c12 3 "), "ABC123")
    assert.equal(normalizeAnatomimeRoomIdentifier("ABC123-first-tail"), "ABC123")
    assert.equal(normalizeAnatomimeRoomIdentifier("abc123-second-tail"), "ABC123")
    assert.equal(normalizeAnatomimeRoomIdentifier("---"), "")
  })

  it("normalizes the room selector and gives an authenticated mapping precedence in one narrow query", async () => {
    const calls = []
    const prismaClient = roomPreflightClient(calls, {
      id: "room-1",
      code: "AB12",
      players: [
        { id: "guest-player", roomId: "room-1", userId: null, guestTokenHash: hashToken("guest-token") },
        { id: "account-player", roomId: "room-1", userId: "account-1", guestTokenHash: null },
      ],
    })

    assert.equal(normalizeAnatomimeRoomIdentifier(" a-b 12 "), "AB12")
    const result = await preflightAnatomimeViewer(" a-b 12 ", {
      userId: "account-1",
      playerId: "guest-player",
      playerToken: "wrong-guest-token",
    }, { prismaClient })

    assert.deepEqual(result, {
      kind: "JOINED",
      roomId: "room-1",
      roomIdentifier: "AB12",
      playerId: "account-player",
    })
    assert.deepEqual(calls, [{
      where: { code: "AB12" },
      select: {
        id: true,
        code: true,
        players: {
          where: { OR: [{ userId: "account-1" }, { id: "guest-player" }] },
          take: 2,
          select: { id: true, roomId: true, userId: true, guestTokenHash: true },
        },
      },
    }])
    assert.doesNotMatch(JSON.stringify(calls), /teams|runs|guesses|scores|elections|metadata/i)
  })

  it("requires a matching guest selector and opaque token while distinguishing absent, invalid, and missing rooms", async () => {
    const guest = { id: "guest-player", roomId: "room-1", userId: null, guestTokenHash: hashToken("guest-token") }
    const room = { id: "room-1", code: "ROOM1", players: [guest] }

    assert.deepEqual(await preflightAnatomimeViewer("room1", {
      playerId: "guest-player",
      playerToken: "guest-token",
    }, { prismaClient: roomPreflightClient([], room) }), {
      kind: "JOINED",
      roomId: "room-1",
      roomIdentifier: "ROOM1",
      playerId: "guest-player",
    })
    assert.deepEqual(await preflightAnatomimeViewer("room1", {
      playerId: "guest-player",
      playerToken: "wrong-token",
    }, { prismaClient: roomPreflightClient([], room) }), {
      kind: "INVALID",
      roomId: "room-1",
      roomIdentifier: "ROOM1",
    })
    assert.deepEqual(await preflightAnatomimeViewer("room1", {
      playerId: "guest-player",
    }, { prismaClient: roomPreflightClient([], room) }), {
      kind: "INVALID",
      roomId: "room-1",
      roomIdentifier: "ROOM1",
    })
    assert.deepEqual(await preflightAnatomimeViewer("room1", {}, {
      prismaClient: roomPreflightClient([], { ...room, players: [] }),
    }), {
      kind: "UNJOINED",
      roomId: "room-1",
      roomIdentifier: "ROOM1",
    })
    assert.deepEqual(await preflightAnatomimeViewer("room1", {}, {
      prismaClient: roomPreflightClient([], null),
    }), { kind: "ROOM_NOT_FOUND" })
  })

  it("rejects a stale guest token for an account-bound player without that account proof", async () => {
    const accountPlayer = {
      id: "account-player",
      roomId: "room-1",
      userId: "victim",
      guestTokenHash: hashToken("old-token"),
    }

    assert.deepEqual(await preflightAnatomimeViewer("room1", {
      playerId: "account-player",
      playerToken: "old-token",
    }, {
      prismaClient: roomPreflightClient([], { id: "room-1", code: "ROOM1", players: [accountPlayer] }),
    }), {
      kind: "INVALID",
      roomId: "room-1",
      roomIdentifier: "ROOM1",
    })
  })

  it("maps PR A allowance, denial, unavailability, and consumer failures without leaking limiter state", { concurrency: false }, async () => {
    const request = { operation: "ANATOMIME_UNJOINED_LOOKUP", networkIdentifier: "network", roomIdentifier: "ROOM1" }
    await assert.doesNotReject(() => requireAnatomimeOperationalAllowance(request, async () => ({ allowed: true })))

    await assert.rejects(
      () => requireAnatomimeOperationalAllowance(request, async () => ({
        allowed: false,
        reason: "RATE_LIMITED",
        retryAfterSeconds: 1.2,
      })),
      (error) => error instanceof AnatomimeTrafficLimitError
        && error.status === 429
        && error.retryAfterSeconds === 2
        && error.message === "Anatomime is busy. Please try again shortly.",
    )
    await assert.rejects(
      () => requireAnatomimeOperationalAllowance(request, async () => ({ allowed: false, reason: "UNAVAILABLE" })),
      (error) => error instanceof AnatomimeTrafficLimitError
        && error.status === 503
        && error.retryAfterSeconds === undefined
        && error.message === "Anatomime is temporarily unavailable. Please try again.",
    )
    const captured = []
    const originalConsole = {}
    try {
      for (const method of ["debug", "error", "info", "log", "warn"]) {
        originalConsole[method] = console[method]
        console[method] = (...args) => captured.push([method, ...args])
      }
      await assert.rejects(
        () => requireAnatomimeOperationalAllowance(request, async () => { throw new Error("database details network ROOM1") }),
        (error) => error instanceof AnatomimeTrafficLimitError && error.status === 503,
      )
    } finally {
      for (const [method, implementation] of Object.entries(originalConsole)) console[method] = implementation
    }
    assert.deepEqual(captured, [])
    assert.match(
      trafficServerSource,
      /shared limiter[\s\S]*bounded[\s\S]*Do not log[\s\S]*(?:identifiers|request)[\s\S]*amplif/i,
    )
  })

  it("maps traffic errors to generic 429 and 503 responses with an integer Retry-After", async () => {
    let limited
    let unavailable
    const request = { operation: "ANATOMIME_UNJOINED_LOOKUP", networkIdentifier: "network", roomIdentifier: "ROOM1" }
    try {
      await requireAnatomimeOperationalAllowance(request, async () => ({ allowed: false, reason: "RATE_LIMITED", retryAfterSeconds: 2.1 }))
    } catch (error) {
      limited = error
    }
    try {
      await requireAnatomimeOperationalAllowance(request, async () => ({ allowed: false, reason: "UNAVAILABLE" }))
    } catch (error) {
      unavailable = error
    }

    const limitedResponse = anatomimeErrorResponse(limited, "should not log")
    assert.equal(limitedResponse.status, 429)
    assert.equal(limitedResponse.headers.get("Retry-After"), "3")
    assert.deepEqual(await limitedResponse.json(), { error: "Anatomime is busy. Please try again shortly." })

    const unavailableResponse = anatomimeErrorResponse(unavailable, "should not log")
    assert.equal(unavailableResponse.status, 503)
    assert.equal(unavailableResponse.headers.get("Retry-After"), null)
    assert.deepEqual(await unavailableResponse.json(), { error: "Anatomime is temporarily unavailable. Please try again." })
  })

  it("keeps ingress peeks non-consuming and atomically consumes every joined rule", () => {
    const shedder = createAnatomimePollShedder({ secret: "shedder-secret" })
    const start = new Date("2026-08-31T12:00:00.000Z")

    for (let index = 0; index < 200; index += 1) {
      assert.deepEqual(shedder.peekIngress({
        networkIdentifier: "network-a",
        roomIdentifier: "ROOM1",
        now: start,
      }), { allowed: true })
    }
    assert.equal(shedder.size, 0)

    for (let index = 0; index < 20; index += 1) {
      assert.deepEqual(shedder.consumeJoined({
        networkIdentifier: "network-a",
        roomIdentifier: "ROOM1",
        playerId: "player-1",
        now: start,
      }), { allowed: true })
    }
    assert.equal(shedder.size, 3)
    assert.deepEqual(shedder.consumeJoined({
      networkIdentifier: "network-a",
      roomIdentifier: "ROOM1",
      playerId: "player-1",
      now: new Date("2026-08-31T12:00:00.500Z"),
    }), { allowed: false, retryAfterSeconds: 10 })

    for (let index = 0; index < 130; index += 1) {
      assert.deepEqual(shedder.consumeJoined({
        networkIdentifier: "network-a",
        roomIdentifier: "ROOM1",
        playerId: `other-player-${index}`,
        now: start,
      }), { allowed: true })
    }
    assert.deepEqual(shedder.peekIngress({
      networkIdentifier: "network-a",
      roomIdentifier: "ROOM1",
      now: new Date("2026-08-31T12:00:09.001Z"),
    }), { allowed: false, retryAfterSeconds: 1 })
  })

  it("mutates no local bucket when any joined rule denies", () => {
    const start = new Date("2026-08-31T12:00:00.000Z")
    const playerFull = createAnatomimePollShedder({ secret: "shedder-secret" })
    for (let index = 0; index < 20; index += 1) {
      assert.deepEqual(playerFull.consumeJoined({
        networkIdentifier: "network-a",
        roomIdentifier: "ROOM1",
        playerId: "player-full",
        now: start,
      }), { allowed: true })
    }

    const networkRoomFull = createAnatomimePollShedder({ secret: "shedder-secret" })
    for (let index = 0; index < 150; index += 1) {
      assert.deepEqual(networkRoomFull.consumeJoined({
        networkIdentifier: "network-full",
        roomIdentifier: "ROOM1",
        playerId: `network-player-${index}`,
        now: start,
      }), { allowed: true })
    }

    const roomFull = createAnatomimePollShedder({ secret: "shedder-secret" })
    for (const networkIdentifier of ["network-a", "network-b"]) {
      for (let index = 0; index < 150; index += 1) {
        assert.deepEqual(roomFull.consumeJoined({
          networkIdentifier,
          roomIdentifier: "ROOM1",
          playerId: `${networkIdentifier}-player-${index}`,
          now: start,
        }), { allowed: true })
      }
    }

    const playerFullSize = playerFull.size
    assert.equal(playerFull.consumeJoined({
      networkIdentifier: "network-a",
      roomIdentifier: "ROOM1",
      playerId: "player-full",
      now: start,
    }).allowed, false)
    assert.equal(playerFull.size, playerFullSize)
    for (let index = 0; index < 129; index += 1) {
      assert.equal(playerFull.consumeJoined({
        networkIdentifier: "network-a",
        roomIdentifier: "ROOM1",
        playerId: `follow-up-player-${index}`,
        now: start,
      }).allowed, true)
    }
    assert.equal(playerFull.consumeJoined({
      networkIdentifier: "network-a",
      roomIdentifier: "ROOM1",
      playerId: "network-boundary-player",
      now: start,
    }).allowed, true)

    const networkRoomFullSize = networkRoomFull.size
    assert.equal(networkRoomFull.consumeJoined({
      networkIdentifier: "network-full",
      roomIdentifier: "ROOM1",
      playerId: "network-denied-player",
      now: start,
    }).allowed, false)
    assert.equal(networkRoomFull.size, networkRoomFullSize)

    const roomFullSize = roomFull.size
    assert.equal(roomFull.consumeJoined({
      networkIdentifier: "network-c",
      roomIdentifier: "ROOM1",
      playerId: "room-denied-player",
      now: start,
    }).allowed, false)
    assert.equal(roomFull.size, roomFullSize)
  })

  it("keeps tuple-safe HMAC bucket identities without patching global Map behavior", () => {
    const shedder = createAnatomimePollShedder({ secret: "shedder-secret", maxEntries: 4 })
    assert.deepEqual(shedder.consumeJoined({
      networkIdentifier: "left|middle",
      roomIdentifier: "right",
      playerId: "shared-player",
    }), { allowed: true })
    assert.equal(shedder.size, 3)

    assert.deepEqual(shedder.consumeJoined({
      networkIdentifier: "left",
      roomIdentifier: "middle|right",
      playerId: "shared-player",
    }), { allowed: false, retryAfterSeconds: 10 })
    assert.equal(shedder.size, 3)
    assert.match(trafficServerSource, /createHmac\("sha256", secret\)/)
    assert.match(
      trafficServerSource,
      /appendLengthPrefixed\(hmac, POLL_HMAC_DOMAIN\)[\s\S]*appendLengthPrefixed\(hmac, rule\)[\s\S]*for \(const component of components\) appendLengthPrefixed\(hmac, component\)/,
    )
  })

  it("prunes expired entries before insertion and fails closed at the 4,096 active-entry cap", () => {
    const start = new Date("2026-08-31T12:00:00.000Z")
    const small = createAnatomimePollShedder({ secret: "shedder-secret", maxEntries: 3 })
    assert.deepEqual(small.consumeJoined({
      networkIdentifier: "network-a",
      roomIdentifier: "ROOM1",
      playerId: "player-a",
      now: start,
    }), { allowed: true })
    assert.equal(small.size, 3)
    assert.deepEqual(small.consumeJoined({
      networkIdentifier: "network-a",
      roomIdentifier: "ROOM1",
      playerId: "player-b",
      now: start,
    }), {
      allowed: false,
      retryAfterSeconds: 10,
    })
    assert.equal(small.size, 3)
    assert.deepEqual(small.consumeJoined({
      networkIdentifier: "network-b",
      roomIdentifier: "ROOM2",
      playerId: "player-b",
      now: new Date("2026-08-31T12:00:10.000Z"),
    }), { allowed: true })
    assert.equal(small.size, 3)

    const full = createAnatomimePollShedder({ secret: "shedder-secret" })
    for (let index = 0; index < 1_365; index += 1) {
      assert.deepEqual(full.consumeJoined({
        networkIdentifier: `network-${index}`,
        roomIdentifier: `R${index.toString(36).padStart(5, "0")}`,
        playerId: `player-${index}`,
        now: start,
      }), { allowed: true })
    }
    assert.equal(full.size, 4_095)
    assert.deepEqual(full.consumeJoined({
      networkIdentifier: "network-0",
      roomIdentifier: "R00000",
      playerId: "player-last-slot",
      now: start,
    }), { allowed: true })
    assert.equal(full.size, 4_096)
    assert.deepEqual(full.consumeJoined({
      networkIdentifier: "network-0",
      roomIdentifier: "R00000",
      playerId: "player-over-cap",
      now: start,
    }), {
      allowed: false,
      retryAfterSeconds: 10,
    })
    assert.equal(full.size, 4_096)
  })

  it("advertises enough capacity delay for every entry a rejected request needs", () => {
    const shedder = createAnatomimePollShedder({ secret: "shedder-secret", maxEntries: 4 })
    const first = new Date("2026-08-31T12:00:00.000Z")
    const second = new Date("2026-08-31T12:00:05.000Z")
    const rejectedAt = new Date("2026-08-31T12:00:06.000Z")
    assert.deepEqual(shedder.consumeJoined({
      networkIdentifier: "network-a",
      roomIdentifier: "ROOM1",
      playerId: "player-a",
      now: first,
    }), { allowed: true })
    assert.deepEqual(shedder.consumeJoined({
      networkIdentifier: "network-a",
      roomIdentifier: "ROOM1",
      playerId: "player-b",
      now: second,
    }), { allowed: true })

    const decision = shedder.consumeJoined({
      networkIdentifier: "unseen-network",
      roomIdentifier: "NEWROOM",
      playerId: "player-c",
      now: rejectedAt,
    })
    assert.deepEqual(decision, { allowed: false, retryAfterSeconds: 4 })
    assert.deepEqual(shedder.consumeJoined({
      networkIdentifier: "unseen-network",
      roomIdentifier: "NEWROOM",
      playerId: "player-c",
      now: new Date(rejectedAt.getTime() + decision.retryAfterSeconds * 1_000),
    }), { allowed: true })
  })

  it("coalesces presence with no write inside 15 seconds and one conditional update at the boundary", async () => {
    const calls = []
    const prismaClient = {
      anatomimeRoomPlayer: {
        updateMany: async (args) => {
          calls.push(args)
          return { count: 1 }
        },
      },
    }
    const lastSeenAt = new Date("2026-08-31T12:00:00.000Z")
    assert.equal(await coalesceAnatomimePlayerPresence({
      prismaClient,
      roomId: "room-1",
      playerId: "player-1",
      lastSeenAt,
      now: new Date("2026-08-31T12:00:14.999Z"),
    }), null)
    assert.deepEqual(calls, [])

    const boundary = new Date("2026-08-31T12:00:15.000Z")
    assert.deepEqual(await coalesceAnatomimePlayerPresence({
      prismaClient,
      roomId: "room-1",
      playerId: "player-1",
      lastSeenAt,
      now: boundary,
    }), boundary)
    assert.deepEqual(calls, [{
      where: {
        id: "player-1",
        roomId: "room-1",
        lastSeenAt: { lte: lastSeenAt },
      },
      data: { lastSeenAt: boundary },
    }])

    const noWinner = await coalesceAnatomimePlayerPresence({
      prismaClient: { anatomimeRoomPlayer: { updateMany: async () => ({ count: 0 }) } },
      roomId: "room-1",
      playerId: "player-1",
      lastSeenAt,
      now: boundary,
    })
    assert.equal(noWinner, null)
  })

  it("coalesces loaded-room presence in memory without a second hydration", async () => {
    const lastSeenAt = new Date("2026-08-31T12:00:00.000Z")
    const now = new Date("2026-08-31T12:00:15.000Z")
    const scenario = loadPresenceRoomServer({ lastSeenAt, presenceResult: now })
    let preflightSnapshot = null

    const room = await scenario.loadAnatomimeRoom("room1", {
      playerId: "player-1",
      playerToken: "guest-token",
    }, {
      now,
      beforeResolve: (snapshot) => {
        preflightSnapshot = snapshot
        assert.equal(scenario.hydrateCalls.length, 1)
        assert.deepEqual(scenario.coalesceCalls, [])
      },
    })

    assert.equal(scenario.hydrateCalls.length, 1)
    assert.equal(preflightSnapshot?.code, "ROOM1")
    assert.deepEqual(scenario.legacyPresenceCalls, [])
    assert.deepEqual(scenario.coalesceCalls, [{
      roomId: "room-1",
      playerId: "player-1",
      lastSeenAt,
      now,
    }])
    assert.deepEqual(room.players.map((player) => ({ id: player.id, lastSeenAt: player.lastSeenAt })), [{
      id: "player-1",
      lastSeenAt: now,
    }])
  })

  it("rejects retained guest proof after the hydrated player becomes account-bound", async () => {
    const now = new Date("2026-08-31T12:00:15.000Z")
    const scenario = loadPresenceRoomServer({
      lastSeenAt: new Date("2026-08-31T12:00:00.000Z"),
      presenceResult: now,
      userId: "newly-bound-account",
    })
    const viewer = { playerId: "player-1", playerToken: "guest-token" }

    const room = await scenario.loadAnatomimeRoom("room1", viewer, { now })
    const projection = scenario.summarizeAnatomimeRoom(room, viewer)

    assert.deepEqual(scenario.coalesceCalls, [])
    assert.deepEqual(projection.viewer, { isHost: false, playerId: null, teamId: null })
  })

  it("captures runtime time after delayed hydration and expires without refreshing presence", async () => {
    const room = minimalPresenceRoom({
      status: "PLAYING",
      currentRun: playingRunFixture(),
    })
    const scenario = loadPresenceRoomServer({
      room,
      presenceResult: new Date("2100-01-01T00:00:00.000Z"),
      onHydrate: async (hydratedRoom) => {
        hydratedRoom.expiresAt = new Date(Date.now() + 25)
        await new Promise((resolve) => setTimeout(resolve, 50))
      },
    })

    const loaded = await scenario.loadAnatomimeRoom("room1", {
      playerId: "player-1",
      playerToken: "guest-token",
    })

    assert.equal(loaded.status, "EXPIRED")
    assert.equal(loaded.currentRun.status, "GAME_COMPLETE")
    assert.equal(loaded.currentRun.phase, "GAME_COMPLETE")
    assert.equal(loaded.currentRun.termEndsAt, null)
    assert.deepEqual(scenario.coalesceCalls, [])
  })

  it("locks a playing run before its room while expiring one hydrated graph", async () => {
    const now = new Date("2026-08-31T12:00:16.000Z")
    const room = minimalPresenceRoom({
      status: "PLAYING",
      expiresAt: new Date("2026-08-31T12:00:15.000Z"),
      currentRun: playingRunFixture(),
    })
    const scenario = loadPresenceRoomServer({ room })

    const loaded = await scenario.loadAnatomimeRoom("room1", {}, { now })

    assert.equal(scenario.hydrateCalls.length, 1)
    assert.deepEqual(scenario.narrowReadCalls, [])
    assert.equal(scenario.expireRoomCalls.length, 1)
    assert.equal(scenario.expireRunCalls.length, 1)
    assert.deepEqual(scenario.transactionEvents, ["run:update", "room:update"])
    assert.deepEqual(scenario.committedTransactionEvents, ["run:update", "room:update"])
    assert.equal(loaded.status, "EXPIRED")
    assert.equal(loaded.currentRun.status, "GAME_COMPLETE")
    assert.equal(loaded.currentRun.phase, "GAME_COMPLETE")
    assert.equal(loaded.currentRun.termEndsAt, null)
    assert.deepEqual(loaded.currentRun.completedAt, now)
  })

  it("returns the concurrent expired snapshot when run completion loses the expiry race", async () => {
    const now = new Date("2026-08-31T12:00:16.000Z")
    const room = minimalPresenceRoom({
      status: "PLAYING",
      expiresAt: new Date("2026-08-31T12:00:15.000Z"),
      currentRun: playingRunFixture(),
    })
    const scenario = loadPresenceRoomServer({
      room,
      presenceResult: now,
      expireRunCount: 0,
      conflictRoom: {
        status: "EXPIRED",
        expiresAt: room.expiresAt,
        currentRunId: "run-1",
        currentRun: {
          ...playingRunFixture(),
          status: "GAME_COMPLETE",
          phase: "GAME_COMPLETE",
          termEndsAt: null,
          completedAt: now,
        },
      },
    })

    const loaded = await scenario.loadAnatomimeRoom("room1", {
      playerId: "player-1",
      playerToken: "guest-token",
    }, { now })

    assert.equal(loaded.status, "EXPIRED")
    assert.equal(loaded.currentRun.status, "GAME_COMPLETE")
    assert.equal(scenario.hydrateCalls.length, 2)
    assert.deepEqual(scenario.expireRoomCalls, [])
    assert.equal(scenario.expireRunCalls.length, 1)
    assert.deepEqual(scenario.transactionEvents, ["run:update"])
    assert.deepEqual(scenario.committedTransactionEvents, [])
    assert.deepEqual(scenario.narrowReadCalls, [])
    assert.deepEqual(scenario.coalesceCalls, [])
  })

  it("rolls back local run completion and returns the concurrent expiry winner", async () => {
    const now = new Date("2026-08-31T12:00:16.000Z")
    const room = minimalPresenceRoom({
      status: "PLAYING",
      expiresAt: new Date("2026-08-31T12:00:15.000Z"),
      currentRun: playingRunFixture(),
    })
    const conflictRoom = {
      status: "EXPIRED",
      expiresAt: room.expiresAt,
      currentRunId: "run-1",
      currentRun: {
        ...playingRunFixture(),
        status: "GAME_COMPLETE",
        phase: "GAME_COMPLETE",
        termEndsAt: null,
        completedAt: new Date("2026-08-31T12:00:15.500Z"),
      },
    }
    const scenario = loadPresenceRoomServer({ room, expireRoomCount: 0, conflictRoom })

    const loaded = await scenario.loadAnatomimeRoom("room1", {
      playerId: "player-1",
      playerToken: "guest-token",
    }, { now })

    assert.equal(loaded, conflictRoom)
    assert.equal(scenario.hydrateCalls.length, 2)
    assert.equal(scenario.expireRunCalls.length, 1)
    assert.equal(scenario.expireRoomCalls.length, 1)
    assert.deepEqual(scenario.transactionEvents, ["run:update", "room:update"])
    assert.deepEqual(scenario.committedTransactionEvents, [])
    assert.deepEqual(scenario.narrowReadCalls, [])
    assert.deepEqual(scenario.coalesceCalls, [])
  })

  for (const scenarioInput of [
    {
      label: "a hydrated room without a run gains a new run",
      room: minimalPresenceRoom({
        status: "PLAYING",
        expiresAt: new Date("2026-08-31T12:00:15.000Z"),
        currentRunId: null,
        currentRun: null,
      }),
      conflictRunId: "new-run",
    },
    {
      label: "the hydrated current run changes identity",
      room: minimalPresenceRoom({
        status: "PLAYING",
        expiresAt: new Date("2026-08-31T12:00:15.000Z"),
        currentRunId: "old-run",
        currentRun: { ...playingRunFixture(), id: "old-run" },
      }),
      conflictRunId: "new-run",
    },
  ]) {
    it(`fails retryably when ${scenarioInput.label}`, async () => {
      const conflictRoom = {
        status: "PLAYING",
        expiresAt: scenarioInput.room.expiresAt,
        currentRunId: scenarioInput.conflictRunId,
        currentRun: {
          ...playingRunFixture(),
          id: scenarioInput.conflictRunId,
          status: "GAME_COMPLETE",
          phase: "GAME_COMPLETE",
          termEndsAt: null,
          completedAt: new Date("2026-08-31T12:00:15.500Z"),
        },
      }
      const scenario = loadPresenceRoomServer({
        room: scenarioInput.room,
        expireRoomCount: 0,
        conflictRoom,
      })

      await assert.rejects(
        () => scenario.loadAnatomimeRoom("room1", {}, { now: new Date("2026-08-31T12:00:16.000Z") }),
        (error) => error instanceof AnatomimeTrafficLimitError
          && error.status === 503
          && error.message === "Anatomime is temporarily unavailable. Please try again.",
      )
      assert.equal(scenario.hydrateCalls.length, 2)
      assert.deepEqual(scenario.narrowReadCalls, [])
      assert.deepEqual(scenario.coalesceCalls, [])
    })
  }

  it("returns the concurrent expired snapshot for a stable no-run expiry race", async () => {
    const room = minimalPresenceRoom({
      status: "LOBBY",
      expiresAt: new Date("2026-08-31T12:00:15.000Z"),
      currentRunId: null,
      currentRun: null,
    })
    const conflictRoom = {
      ...room,
      status: "EXPIRED",
    }
    const scenario = loadPresenceRoomServer({
      room,
      expireRoomCount: 0,
      conflictRoom,
    })

    const loaded = await scenario.loadAnatomimeRoom("room1", {}, {
      now: new Date("2026-08-31T12:00:16.000Z"),
    })

    assert.equal(loaded, conflictRoom)
    assert.equal(scenario.hydrateCalls.length, 2)
    assert.deepEqual(scenario.transactionEvents, ["room:update"])
    assert.deepEqual(scenario.committedTransactionEvents, [])
    assert.deepEqual(scenario.narrowReadCalls, [])
    assert.deepEqual(scenario.coalesceCalls, [])
  })

  it("keeps uncontended no-run expiry room-only", async () => {
    const now = new Date("2026-08-31T12:00:16.000Z")
    const room = minimalPresenceRoom({
      status: "LOBBY",
      expiresAt: new Date("2026-08-31T12:00:15.000Z"),
      currentRunId: null,
      currentRun: null,
    })
    const scenario = loadPresenceRoomServer({ room })

    const loaded = await scenario.loadAnatomimeRoom("room1", {}, { now })

    assert.equal(loaded.status, "EXPIRED")
    assert.equal(loaded.currentRun, null)
    assert.deepEqual(scenario.transactionEvents, ["room:update"])
    assert.deepEqual(scenario.committedTransactionEvents, ["room:update"])
    assert.deepEqual(scenario.expireRunCalls, [])
  })

  it("returns an initially expired room without attempting expiry writes", async () => {
    const now = new Date("2026-08-31T12:00:16.000Z")
    const room = minimalPresenceRoom({
      status: "EXPIRED",
      expiresAt: new Date("2026-08-31T12:00:15.000Z"),
      currentRun: {
        ...playingRunFixture(),
        status: "GAME_COMPLETE",
        phase: "GAME_COMPLETE",
        termEndsAt: null,
        completedAt: new Date("2026-08-31T12:00:15.000Z"),
      },
    })
    const scenario = loadPresenceRoomServer({ room })

    const loaded = await scenario.loadAnatomimeRoom("room1", {}, { now })

    assert.equal(loaded, room)
    assert.equal(scenario.hydrateCalls.length, 1)
    assert.deepEqual(scenario.expireRoomCalls, [])
    assert.deepEqual(scenario.expireRunCalls, [])
    assert.deepEqual(scenario.transactionEvents, [])
    assert.deepEqual(scenario.committedTransactionEvents, [])
    assert.deepEqual(scenario.narrowReadCalls, [])
  })
})

function roomPreflightClient(calls, result) {
  return {
    anatomimeRoom: {
      findUnique: async (args) => {
        calls.push(args)
        return result
      },
    },
  }
}

function loadPresenceRoomServer({
  lastSeenAt = new Date("2026-08-31T12:00:00.000Z"),
  presenceResult = null,
  userId = null,
  room = minimalPresenceRoom({ lastSeenAt, userId }),
  onHydrate,
  expireRoomCount = 1,
  expireRunCount = 1,
  conflictRoom = null,
} = {}) {
  const hydrateCalls = []
  const legacyPresenceCalls = []
  const coalesceCalls = []
  const narrowReadCalls = []
  const expireRoomCalls = []
  const expireRunCalls = []
  const transactionEvents = []
  const committedTransactionEvents = []
  const fullRoomRead = async (args) => {
    hydrateCalls.push(args)
    if (hydrateCalls.length === 1) {
      await onHydrate?.(room)
      return room
    }
    return conflictRoom
  }
  const prisma = {
    anatomimeRoom: {
      findUnique: fullRoomRead,
    },
    anatomimeRoomPlayer: {
      update: async (args) => {
        legacyPresenceCalls.push(args)
        return room.players[0]
      },
    },
    $transaction: async (callback) => {
      const stagedEvents = []
      const result = await callback({
        anatomimeRoom: {
          updateMany: async (args) => {
            expireRoomCalls.push(args)
            transactionEvents.push("room:update")
            stagedEvents.push("room:update")
            return { count: expireRoomCount }
          },
          findUnique: async (args) => {
            if (args.include) return fullRoomRead(args)
            narrowReadCalls.push(args)
            return conflictRoom
          },
        },
        anatomimeGameRun: {
          updateMany: async (args) => {
            expireRunCalls.push(args)
            transactionEvents.push("run:update")
            stagedEvents.push("run:update")
            return { count: expireRunCount }
          },
        },
      })
      committedTransactionEvents.push(...stagedEvents)
      return result
    },
  }
  const service = loadCompiledModule(roomServerSource, "lib/anatomime-room-server.presence-test.ts", {
    "./auth-security.js": {
      generateRandomToken: () => "ABC123",
      hashToken,
    },
    "./anatomime-session-server.ts": {
      AnatomimeSessionError: class AnatomimeSessionError extends Error {},
    },
    "./anatomime-progress-server.ts": { updateAnatomimeNameRecallProgress: async () => {} },
    "./anatomime-realtime.ts": { publishAnatomimeRealtimeEvent: async () => {} },
    "./anatomime-shared.ts": {
      createAnatomimeSessionDeck: () => [],
      getAnatomimeCandidateCards: () => [],
      normalizeAnatomimeSessionConfig: () => ({
        seed: "seed",
        selectedCardIds: [],
        teamNames: ["Team 1"],
        roundLimit: 1,
      }),
    },
    "./anatomime-room-rules.ts": {},
    "./anatomime-traffic-server.ts": {
      AnatomimeTrafficLimitError,
      coalesceAnatomimePlayerPresence: async (input) => {
        coalesceCalls.push({
          roomId: input.roomId,
          playerId: input.playerId,
          lastSeenAt: input.lastSeenAt,
          now: input.now,
        })
        return presenceResult
      },
      normalizeAnatomimeRoomIdentifier,
    },
    "./prisma.ts": { prisma },
  })

  return {
    ...service,
    coalesceCalls,
    committedTransactionEvents,
    expireRoomCalls,
    expireRunCalls,
    hydrateCalls,
    legacyPresenceCalls,
    narrowReadCalls,
    transactionEvents,
  }
}

function minimalPresenceRoom({ lastSeenAt = new Date("2026-08-31T12:00:00.000Z"), userId = null, ...overrides } = {}) {
  const player = {
    id: "player-1",
    roomId: "room-1",
    teamId: null,
    userId,
    displayName: "Player",
    guestTokenHash: hashToken("guest-token"),
    lastSeenAt,
  }
  return {
    id: "room-1",
    code: "ROOM1",
    status: "LOBBY",
    metadata: {},
    expiresAt: new Date("2100-01-01T00:00:00.000Z"),
    reviewExpiresAt: null,
    hostPlayerId: "player-1",
    hostPlayer: player,
    hostLastActivityAt: new Date("2026-08-31T12:00:00.000Z"),
    currentRunId: overrides.currentRun?.id ?? null,
    currentRun: null,
    teams: [],
    players: [player],
    elections: [],
    ...overrides,
  }
}

function playingRunFixture() {
  return {
    id: "run-1",
    status: "PLAYING",
    phase: "ACTIVE_TERM",
    termEndsAt: new Date("2026-08-31T12:01:00.000Z"),
    completedAt: null,
  }
}
