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

  it("maps PR A allowance, denial, unavailability, and consumer failures without leaking limiter state", async () => {
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
    await assert.rejects(
      () => requireAnatomimeOperationalAllowance(request, async () => { throw new Error("database details") }),
      (error) => error instanceof AnatomimeTrafficLimitError && error.status === 503,
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

  it("checks ingress rules atomically, accepts every final slot, and returns integer retry delays", () => {
    const shedder = createAnatomimePollShedder({ secret: "shedder-secret" })
    const start = new Date("2026-08-31T12:00:00.000Z")

    for (let index = 0; index < 150; index += 1) {
      assert.deepEqual(shedder.consumeIngress({ networkIdentifier: "network-a", roomIdentifier: "ROOM1", now: start }), { allowed: true })
    }
    assert.deepEqual(shedder.consumeIngress({
      networkIdentifier: "network-a",
      roomIdentifier: "ROOM1",
      now: new Date("2026-08-31T12:00:00.500Z"),
    }), { allowed: false, retryAfterSeconds: 10 })

    for (let index = 0; index < 150; index += 1) {
      assert.deepEqual(shedder.consumeIngress({ networkIdentifier: "network-b", roomIdentifier: "ROOM1", now: start }), { allowed: true })
    }
    assert.equal(shedder.size, 3)
    assert.deepEqual(shedder.consumeIngress({
      networkIdentifier: "network-c",
      roomIdentifier: "ROOM1",
      now: new Date("2026-08-31T12:00:09.001Z"),
    }), { allowed: false, retryAfterSeconds: 1 })
    assert.equal(shedder.size, 3)

    for (let index = 0; index < 20; index += 1) {
      assert.deepEqual(shedder.consumeJoined({ playerId: "player-1", now: start }), { allowed: true })
    }
    assert.deepEqual(shedder.consumeJoined({
      playerId: "player-1",
      now: new Date("2026-08-31T12:00:00.500Z"),
    }), { allowed: false, retryAfterSeconds: 10 })
  })

  it("stores only tuple-safe HMAC keys", () => {
    const observedKeys = []
    const originalSet = Map.prototype.set
    Map.prototype.set = function recordingSet(key, value) {
      observedKeys.push(key)
      return originalSet.call(this, key, value)
    }
    try {
      const shedder = createAnatomimePollShedder({ secret: "shedder-secret" })
      shedder.consumeIngress({ networkIdentifier: "raw-network", roomIdentifier: "RAWROOM" })
    } finally {
      Map.prototype.set = originalSet
    }

    assert.equal(observedKeys.length, 2)
    assert.equal(new Set(observedKeys).size, 2)
    assert.equal(observedKeys.every((key) => typeof key === "string" && /^[0-9a-f]{64}$/.test(key)), true)
    assert.doesNotMatch(JSON.stringify(observedKeys), /raw-network|RAWROOM/)
  })

  it("prunes expired entries before insertion and fails closed at the 4,096 active-entry cap", () => {
    const start = new Date("2026-08-31T12:00:00.000Z")
    const small = createAnatomimePollShedder({ secret: "shedder-secret", maxEntries: 2 })
    assert.deepEqual(small.consumeIngress({ networkIdentifier: "network-a", roomIdentifier: "ROOM1", now: start }), { allowed: true })
    assert.equal(small.size, 2)
    assert.deepEqual(small.consumeIngress({ networkIdentifier: "network-b", roomIdentifier: "ROOM1", now: start }), {
      allowed: false,
      retryAfterSeconds: 10,
    })
    assert.equal(small.size, 2)
    assert.deepEqual(small.consumeIngress({
      networkIdentifier: "network-b",
      roomIdentifier: "ROOM2",
      now: new Date("2026-08-31T12:00:10.000Z"),
    }), { allowed: true })
    assert.equal(small.size, 2)

    const full = createAnatomimePollShedder({ secret: "shedder-secret" })
    for (let index = 0; index < 4_096; index += 1) {
      assert.deepEqual(full.consumeJoined({ playerId: `player-${index}`, now: start }), { allowed: true })
    }
    assert.equal(full.size, 4_096)
    assert.deepEqual(full.consumeJoined({ playerId: "player-over-cap", now: start }), {
      allowed: false,
      retryAfterSeconds: 10,
    })
    assert.equal(full.size, 4_096)
  })

  it("advertises enough capacity delay for every entry a rejected request needs", () => {
    const shedder = createAnatomimePollShedder({ secret: "shedder-secret", maxEntries: 2 })
    const first = new Date("2026-08-31T12:00:00.000Z")
    const second = new Date("2026-08-31T12:00:05.000Z")
    const rejectedAt = new Date("2026-08-31T12:00:06.000Z")
    assert.deepEqual(shedder.consumeJoined({ playerId: "player-a", now: first }), { allowed: true })
    assert.deepEqual(shedder.consumeJoined({ playerId: "player-b", now: second }), { allowed: true })

    const decision = shedder.consumeIngress({
      networkIdentifier: "unseen-network",
      roomIdentifier: "NEWROOM",
      now: rejectedAt,
    })
    assert.deepEqual(decision, { allowed: false, retryAfterSeconds: 9 })
    assert.deepEqual(shedder.consumeIngress({
      networkIdentifier: "unseen-network",
      roomIdentifier: "NEWROOM",
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
