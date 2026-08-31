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

function loadRoomServer({
  events,
  deck = cardFixtures(),
  room = roomFixture(),
  transactionError,
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
        anatomimeRoom: { findUnique: async () => room },
      })
    },
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

function cardFixtures() {
  return Array.from({ length: 4 }, (_, index) => ({ id: `card-${index + 1}` }))
}

function responseAdapter() {
  return { json: (body, init = {}) => new Response(JSON.stringify(body), init) }
}

function routeRequest(path, body) {
  return new Request(`https://massagelab.test${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-vercel-forwarded-for": "198.51.100.27, 10.0.0.2",
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
