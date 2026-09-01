import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import { authRequestNetworkIdentifier } from "../lib/auth-request.ts"
import { canJoinRoom } from "../lib/anatomime-room-rules.ts"
import {
  AnatomimeTrafficLimitError,
  normalizeAnatomimeRoomIdentifier,
} from "../lib/anatomime-traffic-server.ts"
import { createCompiledModuleLoader } from "./helpers/compiled-module.mjs"

const loadCompiledModule = createCompiledModuleLoader(import.meta.url)
const roomServerSource = await readFile(new URL("../lib/anatomime-room-server.ts", import.meta.url), "utf8")
const createRouteSource = await readFile(new URL("../app/api/anatomime/sessions/route.ts", import.meta.url), "utf8")
const joinRouteSource = await readFile(new URL("../app/api/anatomime/sessions/[code]/join/route.ts", import.meta.url), "utf8")
const realtimeTokenRouteSource = await readFile(new URL("../app/api/anatomime/sessions/[code]/realtime-token/route.ts", import.meta.url), "utf8")
const pollRouteSource = await readFile(new URL("../app/api/anatomime/sessions/[code]/route.ts", import.meta.url), "utf8")
const sharedSessionClientSource = await readFile(new URL("../app/anatomime/shared-session-client.tsx", import.meta.url), "utf8")
const hostRoomClientSource = await readFile(new URL("../app/anatomime/host-room-client.tsx", import.meta.url), "utf8")
const apiSource = await readFile(new URL("../lib/anatomime-api.ts", import.meta.url), "utf8")

class AnatomimeSessionError extends Error {
  constructor(status, code, message) {
    super(message)
    this.status = status
    this.code = code
  }
}

const apiBoundary = loadCompiledModule(apiSource, "lib/anatomime-api.route-test.ts", {
  "next/server": { NextResponse: responseAdapter() },
  "./anatomime-session-server.ts": { AnatomimeSessionError },
  "./anatomime-traffic-server.ts": { AnatomimeTrafficLimitError },
})

describe("Anatomime create and join traffic boundaries", () => {
  it("keeps invalid create setup ahead of quota, code lookup, and transaction work", async () => {
    const events = []
    const service = loadRoomServer({ events, deck: [] })

    await assert.rejects(
      () => service.createAnatomimeRoom({}, null, { beforePersist: async () => events.push("guard") }),
      (error) => error instanceof AnatomimeSessionError && error.code === "empty-deck",
    )
    assert.deepEqual(events, [])
  })

  it("runs create quota after setup validation and before code lookup or transaction", async () => {
    const deniedEvents = []
    const denied = loadRoomServer({ events: deniedEvents, transactionError: new Error("guard was skipped") })
    const denial = new AnatomimeTrafficLimitError(429, 7)
    await assert.rejects(
      () => denied.createAnatomimeRoom({}, "account-1", {
        beforePersist: async () => {
          deniedEvents.push("guard")
          throw denial
        },
      }),
      (error) => error === denial,
    )
    assert.deepEqual(deniedEvents, ["guard"])

    const allowedEvents = []
    const allowed = loadRoomServer({ events: allowedEvents, transactionError: new Error("transaction reached") })
    await assert.rejects(
      () => allowed.createAnatomimeRoom({}, "account-1", {
        beforePersist: async () => { allowedEvents.push("guard") },
      }),
      /transaction reached/,
    )
    assert.deepEqual(allowedEvents, ["guard", "code-lookup", "transaction"])
  })

  it("keeps invalid join status ahead of quota and transaction work", async () => {
    const events = []
    const service = loadRoomServer({ events, room: roomFixture({ status: "ENDED", endedAt: new Date() }) })

    await assert.rejects(
      () => service.joinAnatomimeRoom(" room-1 ", { displayName: "Guest" }, null, {
        beforePersist: async () => events.push("guard"),
      }),
      (error) => error instanceof AnatomimeSessionError && error.status === 409,
    )
    assert.deepEqual(events, ["room-lookup"])
  })

  it("rejects an already-expired lobby without quota or expiration persistence", async () => {
    const events = []
    const service = loadRoomServer({
      events,
      room: roomFixture({ expiresAt: new Date("2000-01-01T00:00:00.000Z") }),
    })

    await assert.rejects(
      () => service.joinAnatomimeRoom("room-1", { displayName: "Guest" }, null, {
        beforePersist: async () => events.push("guard"),
      }),
      (error) => error instanceof AnatomimeSessionError && error.code === "expired",
    )
    assert.deepEqual(events, ["room-lookup"])
  })

  it("does not treat an account-bound player's stale guest token as review re-entry", async () => {
    const events = []
    const service = loadRoomServer({
      events,
      room: roomFixture({
        status: "REVIEW",
        reviewExpiresAt: new Date("2100-01-01T00:00:00.000Z"),
        players: [playerFixture({ userId: "account-1", guestTokenHash: "hash:stale-token" })],
      }),
    })

    await assert.rejects(
      () => service.joinAnatomimeRoom("room-1", {
        displayName: "Attacker",
        playerId: "player-1",
        playerToken: "stale-token",
      }, null, {
        beforePersist: async () => {
          events.push("guard")
          throw new Error("quota should not be reached")
        },
      }),
      (error) => (
        error instanceof AnatomimeSessionError
        && error.status === 403
        && error.code === "join-required"
      ),
    )
    assert.deepEqual(events, ["room-lookup"])
  })

  for (const scenario of [
    {
      label: "an unknown player selector",
      players: [],
      input: { playerId: "missing-player", playerToken: "unknown-token" },
    },
    {
      label: "a known guest selector with the wrong token",
      players: [playerFixture({ guestTokenHash: "hash:guest-token" })],
      input: { playerId: "player-1", playerToken: "wrong-token" },
    },
    {
      label: "an account-bound selector with a retained token",
      players: [playerFixture({ userId: "account-1", guestTokenHash: "hash:stale-token" })],
      input: { playerId: "player-1", playerToken: "stale-token" },
    },
    {
      label: "a player token without a selector",
      players: [],
      input: { playerToken: "orphan-token" },
    },
    {
      label: "a guest selector without its token",
      players: [playerFixture({ guestTokenHash: "hash:guest-token" })],
      input: { playerId: "player-1" },
    },
  ]) {
    it(`returns the same pre-quota rejection for ${scenario.label} in an open lobby`, async () => {
      const events = []
      const service = loadRoomServer({
        events,
        room: roomFixture({ players: scenario.players }),
      })

      await assert.rejects(
        () => service.joinAnatomimeRoom("room-1", {
          displayName: "Attacker",
          ...scenario.input,
        }, null, {
          beforePersist: async () => {
            events.push("guard")
            throw new Error("quota should not be reached")
          },
        }),
        isGenericJoinCredentialError,
      )
      assert.deepEqual(events, ["room-lookup"])
    })
  }

  it("rejects a guest selector that becomes account-bound after open-lobby quota", async () => {
    const events = []
    const initialRoom = roomFixture({
      players: [playerFixture({ guestTokenHash: "hash:guest-token" })],
    })
    const transactionRoom = roomFixture({
      players: [playerFixture({ userId: "account-1", guestTokenHash: "hash:guest-token" })],
    })
    const service = loadRoomServer({
      events,
      room: initialRoom,
      transactionRoom,
      playerWriteError: new Error("player write should not be reached"),
    })

    await assert.rejects(
      () => service.joinAnatomimeRoom("room-1", {
        displayName: "Guest",
        playerId: "player-1",
        playerToken: "guest-token",
      }, null, {
        beforePersist: async () => events.push("guard"),
      }),
      (error) => (
        error instanceof AnatomimeSessionError
        && error.status === 403
        && error.code === "join-required"
      ),
    )
    assert.deepEqual(events, ["room-lookup", "guard", "transaction", "transaction-read"])
  })

  it("rejects a guest token that stops matching after open-lobby quota", async () => {
    const events = []
    const initialRoom = roomFixture({
      players: [playerFixture({ guestTokenHash: "hash:guest-token" })],
    })
    const transactionRoom = roomFixture({
      players: [playerFixture({ guestTokenHash: "hash:rotated-token" })],
    })
    const service = loadRoomServer({
      events,
      room: initialRoom,
      transactionRoom,
      playerWriteError: new Error("player write should not be reached"),
    })

    await assert.rejects(
      () => service.joinAnatomimeRoom("room-1", {
        displayName: "Guest",
        playerId: "player-1",
        playerToken: "guest-token",
      }, null, {
        beforePersist: async () => events.push("guard"),
      }),
      isGenericJoinCredentialError,
    )
    assert.deepEqual(events, ["room-lookup", "guard", "transaction", "transaction-read"])
  })

  for (const scenario of [
    {
      label: "a valid null-user guest credential pair",
      userId: null,
      players: [playerFixture({ guestTokenHash: "hash:guest-token" })],
      input: { playerId: "player-1", playerToken: "guest-token" },
      writeEvent: "player-update",
    },
    {
      label: "an ordinary new join without credential fields",
      userId: null,
      players: [],
      input: {},
      writeEvent: "player-create",
    },
    {
      label: "an authenticated mapping despite stale selector fields",
      userId: "account-current",
      players: [
        playerFixture({ id: "player-current", userId: "account-current" }),
        playerFixture({ id: "player-other", userId: "account-other", guestTokenHash: "hash:stale-token" }),
      ],
      input: { playerId: "player-other", playerToken: "stale-token" },
      writeEvent: "player-update",
    },
  ]) {
    it(`preserves ${scenario.label}`, async () => {
      const events = []
      const writeReached = new Error("expected protected write reached")
      const room = roomFixture({ players: scenario.players })
      const service = loadRoomServer({
        events,
        room,
        transactionRoom: room,
        playerWriteError: writeReached,
      })

      await assert.rejects(
        () => service.joinAnatomimeRoom("room-1", {
          displayName: "Guest",
          ...scenario.input,
        }, scenario.userId, {
          beforePersist: async () => events.push("guard"),
        }),
        (error) => error === writeReached,
      )
      assert.deepEqual(events, [
        "room-lookup",
        "guard",
        "transaction",
        "transaction-read",
        scenario.writeEvent,
      ])
    })
  }

  it("revalidates guest-only token ownership after quota before review re-entry", async () => {
    const events = []
    const initialRoom = roomFixture({
      status: "REVIEW",
      reviewExpiresAt: new Date("2100-01-01T00:00:00.000Z"),
      players: [playerFixture({ guestTokenHash: "hash:guest-token" })],
    })
    const transactionRoom = roomFixture({
      status: "REVIEW",
      reviewExpiresAt: new Date("2100-01-01T00:00:00.000Z"),
      players: [playerFixture({ userId: "account-1", guestTokenHash: "hash:guest-token" })],
    })
    const service = loadRoomServer({
      events,
      room: initialRoom,
      transactionRoom,
      playerWriteError: new Error("player write should not be reached"),
    })

    await assert.rejects(
      () => service.joinAnatomimeRoom("room-1", {
        displayName: "Guest",
        playerId: "player-1",
        playerToken: "guest-token",
      }, null, {
        beforePersist: async () => events.push("guard"),
      }),
      (error) => (
        error instanceof AnatomimeSessionError
        && error.status === 403
        && error.code === "join-required"
      ),
    )
    assert.deepEqual(events, ["room-lookup", "guard", "transaction", "transaction-read"])
  })

  it("uses a fresh transaction clock when expiry changes during quota work", async () => {
    const events = []
    const room = roomFixture({ expiresAt: new Date(Date.now() + 60_000) })
    const service = loadRoomServer({
      events,
      room,
      transactionRoom: room,
      playerWriteError: new Error("player write should not be reached"),
    })

    await assert.rejects(
      () => service.joinAnatomimeRoom("room-1", { displayName: "Guest" }, null, {
        beforePersist: async () => {
          events.push("guard")
          await new Promise((resolve) => setTimeout(resolve, 20))
          room.expiresAt = new Date(Date.now() - 1)
        },
      }),
      (error) => error instanceof AnatomimeSessionError && error.code === "expired",
    )
    assert.deepEqual(events, ["room-lookup", "guard", "transaction", "transaction-read"])
  })

  it("runs join quota after bounded room validation and before transaction revalidation", async () => {
    const deniedEvents = []
    const denied = loadRoomServer({ events: deniedEvents, transactionError: new Error("guard was skipped") })
    const denial = new AnatomimeTrafficLimitError(503)
    await assert.rejects(
      () => denied.joinAnatomimeRoom("room-1", { displayName: "Guest" }, null, {
        beforePersist: async () => {
          deniedEvents.push("guard")
          throw denial
        },
      }),
      (error) => error === denial,
    )
    assert.deepEqual(deniedEvents, ["room-lookup", "guard"])

    const allowedEvents = []
    const allowed = loadRoomServer({ events: allowedEvents, transactionError: new Error("transaction reached") })
    await assert.rejects(
      () => allowed.joinAnatomimeRoom("room-1", { displayName: "Guest" }, null, {
        beforePersist: async () => { allowedEvents.push("guard") },
      }),
      /transaction reached/,
    )
    assert.deepEqual(allowedEvents, ["room-lookup", "guard", "transaction"])
  })

  for (const [status, retryAfterSeconds] of [[429, 8], [503, undefined]]) {
    it(`maps create quota ${status} before protected room work`, async () => {
      const scenario = loadRoute("create", {
        session: { user: { id: "account-1" } },
        limitError: new AnatomimeTrafficLimitError(status, retryAfterSeconds),
      })
      const response = await withDatabaseUrl(() => scenario.POST(routeRequest("/api/anatomime/sessions", {})))

      assert.equal(response.status, status)
      assert.deepEqual(scenario.limitCalls, [{
        operation: "ANATOMIME_ROOM_CREATE",
        networkIdentifier: "198.51.100.27",
        account: { kind: "ACCOUNT_ID", value: "account-1" },
      }])
      assert.deepEqual(scenario.protectedCalls, [])
      if (status === 429) assert.equal(response.headers.get("Retry-After"), "8")
    })

    it(`maps join quota ${status} with only network and normalized room selector`, async () => {
      const scenario = loadRoute("join", {
        limitError: new AnatomimeTrafficLimitError(status, retryAfterSeconds),
      })
      const response = await scenario.POST(
        routeRequest("/api/anatomime/sessions/a-b12/join", { displayName: "Guest" }),
        { params: Promise.resolve({ code: " a-b12 " }) },
      )

      assert.equal(response.status, status)
      assert.deepEqual(scenario.limitCalls, [{
        operation: "ANATOMIME_ROOM_JOIN",
        networkIdentifier: "198.51.100.27",
        roomIdentifier: "AB12",
      }])
      assert.deepEqual(scenario.protectedCalls, [])
      if (status === 429) assert.equal(response.headers.get("Retry-After"), "8")
    })
  }
})

describe("Anatomime client poll ownership", () => {
  it("keeps terminal host outcomes from posting an automatic timeout", () => {
    assert.match(
      hostRoomClientSource,
      /if \(pollTerminal \|\| session\.status !== "PLAYING" \|\| session\.phase !== "ACTIVE_TERM"/,
    )
    assert.match(hostRoomClientSource, /\[performAction, pollTerminal, session, termSeconds\]/)
  })

  it("registers one visibility re-arm path in both polling owners", () => {
    for (const source of [sharedSessionClientSource, hostRoomClientSource]) {
      assert.equal(source.match(/addEventListener\("visibilitychange", onVisibilityChange\)/g)?.length, 1)
      assert.equal(source.match(/removeEventListener\("visibilitychange", onVisibilityChange\)/g)?.length, 1)
      assert.match(source, /nextAnatomimeVisibilitySchedule\(\{[\s\S]*?result: latestScheduledResult,[\s\S]*?documentHidden:/)
    }
  })
})

describe("Anatomime realtime token traffic boundary", () => {
  it("canonicalizes formatted room codes for client identity and every realtime sink", async () => {
    const client = loadSharedSessionClient()
    assert.equal(typeof client.normalizeAnatomimeClientRoomCode, "function")
    assert.equal(client.normalizeAnatomimeClientRoomCode("a-b12"), "AB12")
    assert.equal(client.normalizeAnatomimeClientRoomCode(" A-B12 "), "AB12")

    assert.match(
      sharedSessionClientSource,
      /return `massagelab-anatomime-player:\$\{normalizeAnatomimeClientRoomCode\(code\)\}`/,
    )
    assert.match(
      sharedSessionClientSource,
      /const normalizedInitialCode = normalizeAnatomimeClientRoomCode\(initialCode\)/,
    )
    assert.match(
      sharedSessionClientSource,
      /const nextLookupCode = lookupCode \|\| normalizeAnatomimeClientRoomCode\(code\)/,
    )
    assert.equal(
      sharedSessionClientSource.match(/setLookupCode\(normalizeAnatomimeClientRoomCode\(code\)\)/g)?.length,
      2,
    )
    assert.equal(sharedSessionClientSource.match(/setLookupCode\(nextLookupCode\)/g)?.length, 1)
    assert.equal(sharedSessionClientSource.match(/setLookupCode\(""\)/g)?.length, 1)
    assert.equal(sharedSessionClientSource.match(/setLookupCode\(/g)?.length, 4)
    assert.match(
      sharedSessionClientSource,
      /fetchAnatomimeRoomSnapshot\(\{[\s\S]*?code: lookupCode,[\s\S]*?credentials,/,
    )
    assert.match(
      sharedSessionClientSource,
      /fetch\(`\/api\/anatomime\/sessions\/\$\{encodeURIComponent\(lookupCode\)\}\/realtime-token`/,
    )
    assert.match(sharedSessionClientSource, /channels\.get\(`anatomime:\$\{lookupCode\}`\)/)

    const scenario = loadRealtimeTokenRoute()
    const response = await scenario.POST(
      routeRequest("/api/anatomime/sessions/a-b12/realtime-token", {}, {
        "x-anatomime-player-id": "database-player",
        "x-anatomime-player-token": "opaque-token",
      }),
      { params: Promise.resolve({ code: " A-B12 " }) },
    )

    assert.equal(response.status, 200)
    assert.equal(scenario.providerCalls[0].code, "AB12")
    assert.equal(`anatomime:${client.normalizeAnatomimeClientRoomCode(" A-B12 ")}`, "anatomime:AB12")
  })

  for (const [status, retryAfterSeconds] of [[429, 9], [503, undefined]]) {
    it(`stops realtime token ${status} start denial before auth, preflight, and provider work`, async () => {
      const scenario = loadRealtimeTokenRoute({
        startError: new AnatomimeTrafficLimitError(status, retryAfterSeconds),
      })
      const response = await scenario.POST(
        routeRequest("/api/anatomime/sessions/a-b12/realtime-token", { clientId: "attacker-chosen" }, {
          "x-anatomime-player-id": "exposed-player",
          "x-anatomime-player-token": "opaque-token",
        }),
        { params: Promise.resolve({ code: " a-b12 " }) },
      )

      assert.equal(response.status, status)
      assert.deepEqual(scenario.limitCalls, [{
        operation: "ANATOMIME_REALTIME_TOKEN_START",
        networkIdentifier: "198.51.100.27",
        roomIdentifier: "AB12",
      }])
      assert.deepEqual(scenario.events, ["limit:start"])
      if (status === 429) assert.equal(response.headers.get("Retry-After"), "9")
    })
  }

  for (const [kind, status] of [["ROOM_NOT_FOUND", 404], ["UNJOINED", 403], ["INVALID", 403]]) {
    it(`returns generic ${status} for realtime ${kind.toLowerCase()} proof without issue/provider work`, async () => {
      const scenario = loadRealtimeTokenRoute({
        preflightResult: kind === "ROOM_NOT_FOUND"
          ? { kind }
          : { kind, roomId: "room-db", roomIdentifier: "AB12" },
      })
      const response = await scenario.POST(
        routeRequest("/api/anatomime/sessions/a-b12/realtime-token", { clientId: "attacker-chosen" }, {
          "x-anatomime-player-id": "arbitrary-exposed-player",
          "x-anatomime-player-token": "stale-or-wrong-token",
        }),
        { params: Promise.resolve({ code: " a-b12 " }) },
      )

      assert.equal(response.status, status)
      assert.deepEqual(await response.json(), status === 404
        ? { error: "Game not found." }
        : { error: "Join this room before using realtime." })
      assert.deepEqual(scenario.limitCalls, [{
        operation: "ANATOMIME_REALTIME_TOKEN_START",
        networkIdentifier: "198.51.100.27",
        roomIdentifier: "AB12",
      }])
      assert.deepEqual(scenario.providerCalls, [])
      assert.deepEqual(scenario.preflightCalls, [{
        code: "AB12",
        viewer: {
          userId: undefined,
          playerId: "arbitrary-exposed-player",
          playerToken: "stale-or-wrong-token",
        },
      }])
    })
  }

  for (const scenarioInput of [
    {
      label: "an authenticated mapping",
      session: { user: { id: "account-1" } },
      headers: {
        "x-anatomime-player-id": "arbitrary-exposed-player",
        "x-anatomime-player-token": "stale-token",
      },
      joinedPlayerId: "database-account-player",
    },
    {
      label: "a matching null-user guest proof",
      session: null,
      headers: {
        "x-anatomime-player-id": "database-guest-player",
        "x-anatomime-player-token": "opaque-guest-token",
      },
      joinedPlayerId: "database-guest-player",
    },
  ]) {
    it(`issues realtime identity only from ${scenarioInput.label}`, async () => {
      const scenario = loadRealtimeTokenRoute({
        session: scenarioInput.session,
        preflightResult: {
          kind: "JOINED",
          roomId: "room-db",
          roomIdentifier: "AB12",
          playerId: scenarioInput.joinedPlayerId,
        },
      })
      const response = await scenario.POST(
        routeRequest("/api/anatomime/sessions/a-b12/realtime-token", { clientId: "attacker-chosen" }, scenarioInput.headers),
        { params: Promise.resolve({ code: " a-b12 " }) },
      )

      assert.equal(response.status, 200)
      assert.deepEqual(await response.json(), {
        clientId: scenarioInput.joinedPlayerId,
        capability: "stubbed",
      })
      assert.deepEqual(scenario.limitCalls, [
        {
          operation: "ANATOMIME_REALTIME_TOKEN_START",
          networkIdentifier: "198.51.100.27",
          roomIdentifier: "AB12",
        },
        {
          operation: "ANATOMIME_REALTIME_TOKEN_ISSUE",
          playerId: scenarioInput.joinedPlayerId,
          roomId: "room-db",
        },
      ])
      assert.deepEqual(scenario.providerCalls, [{
        code: "AB12",
        clientId: scenarioInput.joinedPlayerId,
      }])
      assert.notEqual(scenario.providerCalls[0].clientId, "attacker-chosen")
    })
  }

  for (const [status, retryAfterSeconds] of [[429, 11], [503, undefined]]) {
    it(`stops realtime token ${status} issue denial before provider work`, async () => {
      const scenario = loadRealtimeTokenRoute({
        preflightResult: {
          kind: "JOINED",
          roomId: "room-db",
          roomIdentifier: "AB12",
          playerId: "database-player",
        },
        issueError: new AnatomimeTrafficLimitError(status, retryAfterSeconds),
      })
      const response = await scenario.POST(
        routeRequest("/api/anatomime/sessions/ab12/realtime-token", {}, {
          "x-anatomime-player-id": "database-player",
          "x-anatomime-player-token": "opaque-token",
        }),
        { params: Promise.resolve({ code: "ab12" }) },
      )

      assert.equal(response.status, status)
      assert.deepEqual(scenario.events, ["limit:start", "auth", "preflight", "limit:issue"])
      assert.deepEqual(scenario.providerCalls, [])
      if (status === 429) assert.equal(response.headers.get("Retry-After"), "11")
    })
  }

  it("sends guest proof in headers and never supplies a body clientId", () => {
    assert.match(sharedSessionClientSource, /"x-anatomime-player-id"\s*:\s*realtimePlayer\.playerId/)
    assert.match(sharedSessionClientSource, /"x-anatomime-player-token"\s*:\s*realtimePlayer\.playerToken/)
    assert.doesNotMatch(sharedSessionClientSource, /body\s*:\s*JSON\.stringify\(\{\s*clientId/)
  })
})

describe("Anatomime room poll traffic boundary", () => {
  it("fails a non-canonicalizable room selector closed before auth or preflight", async () => {
    const scenario = loadPollRoute({ ingressDecision: { allowed: false, retryAfterSeconds: 10 } })
    const response = await scenario.GET(
      pollRequest("/api/anatomime/sessions/---"),
      { params: Promise.resolve({ code: " --- " }) },
    )

    assert.equal(response.status, 429)
    assert.equal(response.headers.get("Retry-After"), "10")
    assert.deepEqual(scenario.ingressCalls, [{
      networkIdentifier: "198.51.100.27",
      roomIdentifier: "",
    }])
    assert.deepEqual(scenario.events, ["shed:ingress"])
    assert.deepEqual(scenario.preflightCalls, [])
    assert.deepEqual(scenario.hydrateCalls, [])
  })

  it("stops a local ingress denial before auth, preflight, durable quota, or hydration", async () => {
    const scenario = loadPollRoute({ ingressDecision: { allowed: false, retryAfterSeconds: 6 } })
    const response = await scenario.GET(
      pollRequest("/api/anatomime/sessions/a-b12"),
      { params: Promise.resolve({ code: " a-b12 " }) },
    )

    assert.equal(response.status, 429)
    assert.equal(response.headers.get("Retry-After"), "6")
    assert.deepEqual(scenario.events, ["shed:ingress"])
    assert.deepEqual(scenario.ingressCalls, [{
      networkIdentifier: "198.51.100.27",
      roomIdentifier: "AB12",
    }])
    assert.deepEqual(scenario.preflightCalls, [])
    assert.deepEqual(scenario.durableCalls, [])
    assert.deepEqual(scenario.hydrateCalls, [])
  })

  it("stops joined-player shedding before full hydration and never uses durable quota", async () => {
    const scenario = loadPollRoute({ joinedDecision: { allowed: false, retryAfterSeconds: 4 } })
    const response = await scenario.GET(
      pollRequest("/api/anatomime/sessions/ab12", {
        "x-anatomime-player-id": "database-player",
        "x-anatomime-player-token": "opaque-token",
      }),
      { params: Promise.resolve({ code: "ab12" }) },
    )

    assert.equal(response.status, 429)
    assert.equal(response.headers.get("Retry-After"), "4")
    assert.deepEqual(scenario.events, ["shed:ingress", "auth", "preflight", "shed:joined"])
    assert.deepEqual(scenario.joinedCalls, [{ playerId: "database-player" }])
    assert.deepEqual(scenario.durableCalls, [])
    assert.deepEqual(scenario.hydrateCalls, [])
  })

  it("hydrates an accepted joined poll exactly once without durable quota", async () => {
    const scenario = loadPollRoute({ session: { user: { id: "account-1" } } })
    const response = await scenario.GET(
      pollRequest("/api/anatomime/sessions/a-b12", {
        "x-anatomime-player-id": "stale-selector",
        "x-anatomime-player-token": "stale-token",
      }),
      { params: Promise.resolve({ code: " a-b12 " }) },
    )

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { session: { code: "AB12", playerCount: 1 } })
    assert.deepEqual(scenario.events, ["shed:ingress", "auth", "preflight", "shed:joined", "hydrate", "summarize"])
    assert.deepEqual(scenario.preflightCalls, [{
      code: "AB12",
      viewer: { userId: "account-1", playerId: "stale-selector", playerToken: "stale-token" },
    }])
    assert.deepEqual(scenario.hydrateCalls, [{
      code: "AB12",
      viewer: { userId: "account-1", playerId: "stale-selector", playerToken: "stale-token" },
    }])
    assert.deepEqual(scenario.durableCalls, [])
  })

  it("does not disclose joined or host projection when a proven guest becomes account-bound before hydration", async () => {
    const roomScenario = loadPresenceRoomServerForRoute({
      userId: "newly-bound-account",
      presenceResult: new Date("2026-08-31T12:00:15.000Z"),
    })
    const scenario = loadPollRoute({ roomServer: roomScenario })
    const response = await scenario.GET(
      pollRequest("/api/anatomime/sessions/ab12", {
        "x-anatomime-player-id": "database-player",
        "x-anatomime-player-token": "opaque-token",
      }),
      { params: Promise.resolve({ code: "ab12" }) },
    )

    assert.equal(response.status, 200)
    const payload = await response.json()
    assert.deepEqual(payload.session.viewer, { isHost: false, playerId: null, teamId: null })
    assert.deepEqual(roomScenario.coalesceCalls, [])
  })

  it("returns a generic retryable response when expiry observes a different current run", async () => {
    const roomScenario = loadPresenceRoomServerForRoute({
      userId: null,
      presenceResult: null,
      conflictingRunIdentity: true,
    })
    const scenario = loadPollRoute({ roomServer: roomScenario })
    const response = await scenario.GET(
      pollRequest("/api/anatomime/sessions/ab12", {
        "x-anatomime-player-id": "database-player",
        "x-anatomime-player-token": "opaque-token",
      }),
      { params: Promise.resolve({ code: "ab12" }) },
    )

    assert.equal(response.status, 503)
    assert.deepEqual(await response.json(), {
      error: "Anatomime is temporarily unavailable. Please try again.",
    })
    assert.deepEqual(roomScenario.coalesceCalls, [])
  })

  it("returns a generic retryable response when the same run advances during expiry", async () => {
    const roomScenario = loadPresenceRoomServerForRoute({
      userId: null,
      presenceResult: new Date("2026-08-31T12:00:16.000Z"),
      sameRunAdvance: true,
    })
    const scenario = loadPollRoute({ roomServer: roomScenario })
    const response = await scenario.GET(
      pollRequest("/api/anatomime/sessions/ab12", {
        "x-anatomime-player-id": "database-player",
        "x-anatomime-player-token": "opaque-token",
      }),
      { params: Promise.resolve({ code: "ab12" }) },
    )

    assert.equal(response.status, 503)
    assert.deepEqual(await response.json(), {
      error: "Anatomime is temporarily unavailable. Please try again.",
    })
    assert.equal(roomScenario.hydrateCalls.length, 1)
    assert.deepEqual(roomScenario.coalesceCalls, [])
  })

  it("returns a missing room without full hydration or durable quota", async () => {
    const scenario = loadPollRoute({ preflightResult: { kind: "ROOM_NOT_FOUND" } })
    const response = await scenario.GET(
      pollRequest("/api/anatomime/sessions/missing"),
      { params: Promise.resolve({ code: "missing" }) },
    )

    assert.equal(response.status, 404)
    assert.deepEqual(await response.json(), { error: "Game not found." })
    assert.deepEqual(scenario.events, ["shed:ingress", "auth", "preflight"])
    assert.deepEqual(scenario.durableCalls, [])
    assert.deepEqual(scenario.hydrateCalls, [])
  })

  for (const kind of ["UNJOINED", "INVALID"]) {
    it(`stops ${kind.toLowerCase()} poll quota denial before full hydration`, async () => {
      const scenario = loadPollRoute({
        preflightResult: { kind, roomId: "room-db", roomIdentifier: "AB12" },
        durableError: new AnatomimeTrafficLimitError(429, 7),
      })
      const response = await scenario.GET(
        pollRequest("/api/anatomime/sessions/a-b12", kind === "INVALID" ? {
          "x-anatomime-player-id": "arbitrary-player",
          "x-anatomime-player-token": "wrong-token",
        } : {}),
        { params: Promise.resolve({ code: "a-b12" }) },
      )

      assert.equal(response.status, 429)
      assert.equal(response.headers.get("Retry-After"), "7")
      assert.deepEqual(scenario.events, ["shed:ingress", "auth", "preflight", "durable"])
      assert.deepEqual(scenario.durableCalls, [{
        operation: "ANATOMIME_UNJOINED_LOOKUP",
        networkIdentifier: "198.51.100.27",
        roomIdentifier: "AB12",
      }])
      assert.deepEqual(scenario.hydrateCalls, [])
    })
  }

  it("returns generic invalid-proof rejection after allowance without full hydration", async () => {
    const scenario = loadPollRoute({
      preflightResult: { kind: "INVALID", roomId: "room-db", roomIdentifier: "AB12" },
    })
    const response = await scenario.GET(
      pollRequest("/api/anatomime/sessions/ab12", {
        "x-anatomime-player-id": "arbitrary-player",
        "x-anatomime-player-token": "wrong-token",
      }),
      { params: Promise.resolve({ code: "ab12" }) },
    )

    assert.equal(response.status, 403)
    assert.deepEqual(await response.json(), { error: "Join this room before taking that action." })
    assert.deepEqual(scenario.events, ["shed:ingress", "auth", "preflight", "durable"])
    assert.deepEqual(scenario.hydrateCalls, [])
  })

  it("allows an uncredentialed public poll after durable allowance with one hydration", async () => {
    const scenario = loadPollRoute({
      preflightResult: { kind: "UNJOINED", roomId: "room-db", roomIdentifier: "AB12" },
    })
    const response = await scenario.GET(
      pollRequest("/api/anatomime/sessions/a-b12"),
      { params: Promise.resolve({ code: " a-b12 " }) },
    )

    assert.equal(response.status, 200)
    assert.deepEqual(scenario.events, ["shed:ingress", "auth", "preflight", "durable", "hydrate", "summarize"])
    assert.equal(scenario.hydrateCalls.length, 1)
    assert.deepEqual(scenario.hydrateCalls[0], {
      code: "AB12",
      viewer: { userId: undefined, playerId: undefined, playerToken: undefined },
    })
  })

  it("fails closed before auth when the process-local shedder secret is invalid", async () => {
    const scenario = loadPollRoute({ shedderError: new Error("missing secret") })
    const response = await scenario.GET(
      pollRequest("/api/anatomime/sessions/ab12"),
      { params: Promise.resolve({ code: "ab12" }) },
    )

    assert.equal(response.status, 503)
    assert.deepEqual(scenario.events, [])
    assert.deepEqual(scenario.shedderOptions, [{ secret: "test-auth-secret" }])
    assert.deepEqual(scenario.preflightCalls, [])
    assert.deepEqual(scenario.hydrateCalls, [])
  })
})

function loadRoomServer({
  events,
  deck = cardFixtures(),
  room = roomFixture(),
  transactionRoom = room,
  transactionError,
  playerWriteError,
}) {
  const prisma = {
    anatomimeRoom: {
      findUnique: async (args) => {
        events.push(args.where.code === "ROOM1" ? "room-lookup" : "code-lookup")
        return args.where.code === "ROOM1" ? room : null
      },
    },
    $transaction: async (callback) => {
      events.push("transaction")
      if (transactionError) throw transactionError
      return callback({
        anatomimeRoom: {
          findUnique: async () => {
            events.push("transaction-read")
            return transactionRoom
          },
          updateMany: async () => {
            events.push("expiration-write")
            transactionRoom.status = "EXPIRED"
            return { count: 1 }
          },
          update: async () => {
            events.push("room-write")
            return transactionRoom
          },
        },
        anatomimeRoomPlayer: {
          create: () => playerWrite("player-create"),
          update: () => playerWrite("player-update"),
          upsert: () => playerWrite("player-upsert"),
        },
      })
    },
  }

  async function playerWrite(event) {
    events.push(event)
    if (playerWriteError) throw playerWriteError
    return transactionRoom.players[0]
  }

  return loadCompiledModule(roomServerSource, "lib/anatomime-room-server.route-test.ts", {
    "./auth-security.js": {
      generateRandomToken: () => "ABC123",
      hashToken: (value) => `hash:${value}`,
    },
    "./anatomime-session-server.ts": { AnatomimeSessionError },
    "./anatomime-progress-server.ts": { updateAnatomimeNameRecallProgress: async () => {} },
    "./anatomime-realtime.ts": { publishAnatomimeRealtimeEvent: async () => {} },
    "./anatomime-shared.ts": {
      createAnatomimeSessionDeck: () => deck,
      getAnatomimeCandidateCards: () => cardFixtures(),
      normalizeAnatomimeSessionConfig: () => ({
        seed: "seed",
        selectedCardIds: [],
        teamNames: ["Team 1"],
        roundLimit: 1,
      }),
    },
    "./anatomime-room-rules.ts": {
      ANATOMIME_ELECTION_SECONDS: 60,
      ANATOMIME_HOST_IDLE_SECONDS: 60,
      ANATOMIME_REVIEW_WINDOW_MINUTES: 60,
      ANATOMIME_ROOM_IDLE_MINUTES: 60,
      ANATOMIME_TERM_SECONDS: 60,
      ANATOMIME_TERMS_PER_TURN: 4,
      canJoinRoom,
    },
    "./anatomime-traffic-server.ts": {
      AnatomimeTrafficLimitError,
      coalesceAnatomimePlayerPresence: async () => null,
    },
    "./prisma.ts": { prisma },
  })
}

function loadRoute(kind, { session = null, limitError } = {}) {
  const limitCalls = []
  const protectedCalls = []
  const roomServer = kind === "create"
    ? {
        createAnatomimeRoom: async (_input, _userId, options) => {
          await options?.beforePersist?.()
          protectedCalls.push("room-create")
          return {
            room: { hostPlayerId: "host-1", players: [{ id: "host-1" }] },
            hostToken: "host-token",
          }
        },
        summarizeAnatomimeRoom: () => ({ code: "ABC123" }),
      }
    : {
        joinAnatomimeRoom: async (_code, _input, _userId, options) => {
          await options?.beforePersist?.()
          protectedCalls.push("player-write")
          return {
            player: { id: "player-1", teamId: "team-1" },
            room: { code: "AB12" },
            token: "player-token",
          }
        },
        summarizeAnatomimeRoom: () => ({ code: "AB12" }),
      }
  const source = kind === "create" ? createRouteSource : joinRouteSource
  const route = loadCompiledModule(source, `${kind}-anatomime-traffic-route.test.ts`, {
    "next/server": { NextResponse: responseAdapter() },
    "@/auth": { getCurrentSession: async () => session },
    "@/lib/anatomime-room-server": roomServer,
    "@/lib/anatomime-api": apiBoundary,
    "@/lib/auth-request": { authRequestNetworkIdentifier },
    "@/lib/anatomime-traffic-server": {
      normalizeAnatomimeRoomIdentifier,
      requireAnatomimeOperationalAllowance: async (input) => {
        limitCalls.push(input)
        if (limitError) throw limitError
      },
    },
  })
  return { POST: route.POST, limitCalls, protectedCalls }
}

function loadRealtimeTokenRoute({
  session = null,
  preflightResult = {
    kind: "JOINED",
    roomId: "room-db",
    roomIdentifier: "AB12",
    playerId: "database-player",
  },
  startError,
  issueError,
} = {}) {
  const events = []
  const limitCalls = []
  const preflightCalls = []
  const providerCalls = []
  const route = loadCompiledModule(realtimeTokenRouteSource, "realtime-token-anatomime-traffic-route.test.ts", {
    "next/server": { NextResponse: responseAdapter() },
    "@/auth": {
      getCurrentSession: async () => {
        events.push("auth")
        return session
      },
    },
    "@/lib/anatomime-api": apiBoundary,
    "@/lib/auth-request": { authRequestNetworkIdentifier },
    "@/lib/anatomime-room-server": {
      loadAnatomimeRoom: async () => {
        events.push("legacy-room-load")
        return { id: "legacy-room" }
      },
    },
    "@/lib/anatomime-traffic-server": {
      normalizeAnatomimeRoomIdentifier,
      preflightAnatomimeViewer: async (code, viewer) => {
        events.push("preflight")
        preflightCalls.push({ code, viewer })
        return preflightResult
      },
      requireAnatomimeOperationalAllowance: async (input) => {
        limitCalls.push(input)
        if (input.operation === "ANATOMIME_REALTIME_TOKEN_START") {
          events.push("limit:start")
          if (startError) throw startError
        } else {
          events.push("limit:issue")
          if (issueError) throw issueError
        }
      },
    },
    "@/lib/anatomime-realtime": {
      createAnatomimeRealtimeTokenRequest: async (code, clientId) => {
        events.push("provider")
        providerCalls.push({ code, clientId })
        return { clientId, capability: "stubbed" }
      },
    },
  })

  return {
    POST: route.POST,
    events,
    limitCalls,
    preflightCalls,
    providerCalls,
  }
}

function loadSharedSessionClient() {
  const emptyComponent = () => null
  return loadCompiledModule(sharedSessionClientSource, "shared-session-anatomime-code.test.tsx", {
    react: {
      useCallback: (callback) => callback,
      useEffect: () => {},
      useMemo: (callback) => callback(),
      useRef: (initialValue) => ({ current: initialValue }),
      useState: (initialValue) => [initialValue, () => {}],
    },
    "react/jsx-runtime": {
      Fragment: Symbol("Fragment"),
      jsx: () => null,
      jsxs: () => null,
    },
    "lucide-react": {
      LogIn: emptyComponent,
      RotateCcw: emptyComponent,
      Send: emptyComponent,
      Users: emptyComponent,
    },
    "@/components/ui/input": { Input: emptyComponent },
    "@/components/ui/label": { Label: emptyComponent },
    "@/components/ui/page-heading": { PageHeading: emptyComponent },
    "@/components/moving-background": { MovingBackground: emptyComponent },
    "./anatomime-action-button": { AnatomimeActionButton: emptyComponent },
    "./anatomime-polling": {
      anatomimeRetryAfterSeconds: () => 0,
      fetchAnatomimeRoomSnapshot: async () => ({ kind: "FAILED" }),
      nextAnatomimePollSchedule: () => ({ action: "SCHEDULE", delayMs: 2_000, consecutiveFailures: 1 }),
    },
    "./styles.css": {},
  })
}

function loadPollRoute({
  session = null,
  preflightResult = {
    kind: "JOINED",
    roomId: "room-db",
    roomIdentifier: "AB12",
    playerId: "database-player",
  },
  ingressDecision = { allowed: true },
  joinedDecision = { allowed: true },
  durableError,
  shedderError,
  roomServer,
} = {}) {
  const events = []
  const ingressCalls = []
  const joinedCalls = []
  const preflightCalls = []
  const durableCalls = []
  const hydrateCalls = []
  const shedderOptions = []
  const previousSecret = process.env.AUTH_SECRET
  process.env.AUTH_SECRET = "test-auth-secret"
  try {
    const route = loadCompiledModule(pollRouteSource, "poll-anatomime-traffic-route.test.ts", {
      "next/server": { NextResponse: responseAdapter() },
      "@/auth": {
        getCurrentSession: async () => {
          events.push("auth")
          return session
        },
      },
      "@/lib/anatomime-api": apiBoundary,
      "@/lib/auth-request": { authRequestNetworkIdentifier },
      "@/lib/anatomime-room-server": roomServer ?? {
        loadAnatomimeRoom: async (code, viewer) => {
          events.push("hydrate")
          hydrateCalls.push({ code, viewer })
          return { id: "room-db", code: "AB12", players: [{ id: "database-player" }] }
        },
        summarizeAnatomimeRoom: (room) => {
          events.push("summarize")
          return { code: room.code, playerCount: room.players.length }
        },
      },
      "@/lib/anatomime-traffic-server": {
        AnatomimeTrafficLimitError,
        createAnatomimePollShedder: (options) => {
          events.push("shedder:create")
          shedderOptions.push(options)
          if (shedderError) throw shedderError
          return {
            consumeIngress: (input) => {
              events.push("shed:ingress")
              ingressCalls.push(input)
              return ingressDecision
            },
            consumeJoined: (input) => {
              events.push("shed:joined")
              joinedCalls.push(input)
              return joinedDecision
            },
          }
        },
        normalizeAnatomimeRoomIdentifier,
        preflightAnatomimeViewer: async (code, viewer) => {
          events.push("preflight")
          preflightCalls.push({ code, viewer })
          return preflightResult
        },
        requireAnatomimeOperationalAllowance: async (input) => {
          events.push("durable")
          durableCalls.push(input)
          if (durableError) throw durableError
        },
      },
    })

    events.length = 0
    return {
      GET: route.GET,
      durableCalls,
      events,
      hydrateCalls,
      ingressCalls,
      joinedCalls,
      preflightCalls,
      shedderOptions,
    }
  } finally {
    if (previousSecret === undefined) delete process.env.AUTH_SECRET
    else process.env.AUTH_SECRET = previousSecret
  }
}

function loadPresenceRoomServerForRoute({
  userId,
  presenceResult,
  conflictingRunIdentity = false,
  sameRunAdvance = false,
}) {
  const coalesceCalls = []
  const hydrateCalls = []
  const lastSeenAt = new Date("2026-08-31T12:00:00.000Z")
  const currentRun = sameRunAdvance
    ? {
        id: "run-1",
        status: "PLAYING",
        phase: "TURN_REVIEW",
        activeCardIndex: 2,
        deckCardIds: ["card-1", "card-2", "card-3", "card-4"],
        metadata: { activeCardId: "card-3" },
        guesses: [{ cardId: "card-3" }],
        scores: [{ teamId: "team-1", score: 3 }],
      }
    : conflictingRunIdentity
      ? { id: "old-run", status: "PLAYING", phase: "ACTIVE_TERM" }
    : null
  const hasExpiryConflict = conflictingRunIdentity || sameRunAdvance
  const room = minimalRoomFixture({
    code: "AB12",
    status: hasExpiryConflict ? "PLAYING" : "LOBBY",
    expiresAt: hasExpiryConflict
      ? new Date("2000-01-01T00:00:00.000Z")
      : new Date("2100-01-01T00:00:00.000Z"),
    hostPlayerId: "database-player",
    hostPlayer: { userId },
    currentRunId: currentRun?.id ?? null,
    currentRun,
    players: [{
      id: "database-player",
      roomId: "room-db",
      teamId: null,
      userId,
      displayName: "Bound player",
      guestTokenHash: "hash:opaque-token",
      lastSeenAt,
    }],
  })
  const concurrentRun = sameRunAdvance
    ? {
        ...currentRun,
        phase: "ACTIVE_TERM",
        activeCardIndex: 3,
        metadata: { activeCardId: "card-4" },
        guesses: [],
        scores: [{ teamId: "team-1", score: 4 }],
      }
    : {
        id: "new-run",
        status: "GAME_COMPLETE",
        phase: "GAME_COMPLETE",
        termEndsAt: null,
        completedAt: new Date("2026-08-31T12:00:00.000Z"),
      }
  const service = loadCompiledModule(roomServerSource, "lib/anatomime-room-server.binding-race-route-test.ts", {
    "./auth-security.js": {
      generateRandomToken: () => "ABC123",
      hashToken: (value) => `hash:${value}`,
    },
    "./anatomime-session-server.ts": { AnatomimeSessionError },
    "./anatomime-progress-server.ts": { updateAnatomimeNameRecallProgress: async () => {} },
    "./anatomime-realtime.ts": { publishAnatomimeRealtimeEvent: async () => {} },
    "./anatomime-shared.ts": roomServerSharedDependencies(),
    "./anatomime-room-rules.ts": roomServerRuleDependencies(),
    "./anatomime-traffic-server.ts": {
      AnatomimeTrafficLimitError,
      coalesceAnatomimePlayerPresence: async (input) => {
        coalesceCalls.push(input)
        return presenceResult
      },
    },
    "./prisma.ts": {
      prisma: hasExpiryConflict
        ? {
            anatomimeRoom: {
              findUnique: async (args) => {
                hydrateCalls.push(args)
                return room
              },
            },
            $transaction: async (callback) => callback({
              anatomimeRoom: {
                updateMany: async () => ({ count: 0 }),
                findUnique: async () => ({
                  status: "EXPIRED",
                  expiresAt: room.expiresAt,
                  currentRunId: concurrentRun.id,
                  currentRun: {
                    id: concurrentRun.id,
                    status: concurrentRun.status,
                    phase: concurrentRun.phase,
                    termEndsAt: concurrentRun.termEndsAt ?? null,
                    completedAt: concurrentRun.completedAt ?? null,
                  },
                }),
              },
              anatomimeGameRun: {
                updateMany: async () => ({ count: 1 }),
              },
            }),
          }
        : {
            anatomimeRoom: { findUnique: async () => room },
          },
    },
  })

  return {
    coalesceCalls,
    hydrateCalls,
    loadAnatomimeRoom: service.loadAnatomimeRoom,
    summarizeAnatomimeRoom: sameRunAdvance
      ? (loadedRoom) => ({
          status: loadedRoom.status,
          phase: loadedRoom.currentRun.phase,
          activeCardId: loadedRoom.currentRun.deckCardIds[loadedRoom.currentRun.activeCardIndex],
          metadataActiveCardId: loadedRoom.currentRun.metadata.activeCardId,
          guessedCardIds: loadedRoom.currentRun.guesses.map((guess) => guess.cardId),
          scores: loadedRoom.currentRun.scores,
        })
      : service.summarizeAnatomimeRoom,
  }
}

function minimalRoomFixture(overrides = {}) {
  return {
    id: "room-db",
    code: "AB12",
    status: "LOBBY",
    metadata: {},
    expiresAt: new Date("2100-01-01T00:00:00.000Z"),
    reviewExpiresAt: null,
    hostPlayerId: "host-player",
    hostPlayer: null,
    hostLastActivityAt: new Date(),
    currentRunId: null,
    currentRun: null,
    teams: [],
    players: [],
    elections: [],
    ...overrides,
  }
}

function roomServerSharedDependencies() {
  return {
    anatomimeTermFromCard: () => null,
    buildAnatomimeMultipleChoiceOptions: () => [],
    checkAnatomimeAnswer: () => ({ correct: false }),
    createAnatomimeSessionDeck: () => [],
    getAnatomimeCandidateCards: () => [],
    labelAnatomimeCategory: () => "",
    labelAnatomimeRegion: () => "",
    normalizeAnatomimeSessionConfig: () => ({
      answerMode: "typed",
      clueLevel: "standard",
      hardcoreMode: false,
      roundLimit: 1,
      roundSeconds: 60,
      seed: "seed",
      selectedCardIds: [],
      teamNames: ["Team 1"],
    }),
  }
}

function roomServerRuleDependencies() {
  return {
    ANATOMIME_ELECTION_SECONDS: 60,
    ANATOMIME_HOST_IDLE_SECONDS: 60,
    ANATOMIME_REVIEW_WINDOW_MINUTES: 60,
    ANATOMIME_ROOM_IDLE_MINUTES: 60,
    ANATOMIME_TERM_SECONDS: 60,
    ANATOMIME_TERMS_PER_TURN: 4,
    shouldExposeAnatomimeChoiceOptions: () => false,
  }
}

function roomFixture(overrides = {}) {
  return {
    id: "room-1",
    code: "ROOM1",
    status: "LOBBY",
    endedAt: null,
    reviewExpiresAt: null,
    expiresAt: new Date("2100-01-01T00:00:00.000Z"),
    hostPlayerId: "host-1",
    players: [],
    teams: [{ id: "team-1" }],
    ...overrides,
  }
}

function playerFixture(overrides = {}) {
  return {
    id: "player-1",
    roomId: "room-1",
    teamId: "team-1",
    userId: null,
    displayName: "Guest",
    guestTokenHash: "hash:guest-token",
    ...overrides,
  }
}

function isGenericJoinCredentialError(error) {
  return (
    error instanceof AnatomimeSessionError
    && error.status === 403
    && error.code === "join-required"
    && error.message === "Join this room before taking that action."
  )
}

function cardFixtures() {
  return Array.from({ length: 4 }, (_, index) => ({ id: `card-${index + 1}` }))
}

function responseAdapter() {
  return { json: (body, init = {}) => new Response(JSON.stringify(body), init) }
}

function routeRequest(path, body, headers = {}) {
  return new Request(`https://massagelab.test${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-vercel-forwarded-for": "198.51.100.27, 10.0.0.2",
      ...headers,
    },
    body: JSON.stringify(body),
  })
}

function pollRequest(path, headers = {}) {
  return new Request(`https://massagelab.test${path}`, {
    headers: {
      "x-vercel-forwarded-for": "198.51.100.27, 10.0.0.2",
      ...headers,
    },
  })
}

async function withDatabaseUrl(callback) {
  const previous = process.env.DATABASE_URL
  process.env.DATABASE_URL = "postgresql://test.invalid/massagelab"
  try {
    return await callback()
  } finally {
    if (previous === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = previous
  }
}
