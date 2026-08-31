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
const sharedSessionClientSource = await readFile(new URL("../app/anatomime/shared-session-client.tsx", import.meta.url), "utf8")
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

describe("Anatomime realtime token traffic boundary", () => {
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
