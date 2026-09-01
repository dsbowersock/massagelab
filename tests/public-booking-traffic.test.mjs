import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

import {
  normalizePublicBookingSequenceDescriptor,
  PUBLIC_SEQUENCE_PICKER_MAX_OPTIONS,
} from "../lib/public-booking-sequences.js"
import { normalizeBookingPolicy } from "../lib/booking-policy.js"
import { createCompiledModuleLoader } from "./helpers/compiled-module.mjs"

const loadCompiledModule = createCompiledModuleLoader(import.meta.url)
const [
  routeSource,
  cacheSource,
  actionStateSource,
  actionWrappersSource,
  publicBookingActionsSource,
  publicRequestIdSource,
  publicRequestOwnerSource,
  publicBookingIdempotencySource,
] = await Promise.all([
  readFile(new URL("../app/api/book/[practiceSlug]/sequence-options/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/public-booking-availability-cache.ts", import.meta.url), "utf8").catch((error) => {
    if (error?.code === "ENOENT") return ""
    throw error
  }),
  readFile(new URL("../app/calendar/actions/public-booking-state.ts", import.meta.url), "utf8").catch((error) => {
    if (error?.code === "ENOENT") return ""
    throw error
  }),
  readFile(new URL("../app/calendar/actions.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/calendar/actions/public-booking.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/public-request-id.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/public-request-owner.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/public-booking-idempotency.ts", import.meta.url), "utf8"),
])

const publicRequestIdModule = loadCompiledModule(
  publicRequestIdSource,
  "lib/public-request-id.booking-traffic-test.ts",
)
const publicRequestOwnerModule = loadCompiledModule(
  publicRequestOwnerSource,
  "lib/public-request-owner.booking-traffic-test.ts",
  {
    "server-only": {},
    "./public-request-id.ts": publicRequestIdModule,
  },
)
const publicBookingIdempotencyModule = loadCompiledModule(
  publicBookingIdempotencySource,
  "lib/public-booking-idempotency.booking-traffic-test.ts",
  {
    "server-only": {},
    "./public-request-id.ts": publicRequestIdModule,
    "./public-request-owner.ts": publicRequestOwnerModule,
  },
)
const publicBookingStateModule = loadCompiledModule(
  actionStateSource,
  "app/calendar/actions/public-booking-state.booking-traffic-test.ts",
)

const DESCRIPTOR_BODY = Object.freeze({
  primaryServiceVariantId: "primary-60",
  addOnServiceVariantIds: ["addon-15"],
  requestedPressureLevel: 3,
  preferredProviderId: "provider-1",
})
const COMPLETE_OPTIONS = Object.freeze([{
  startsAt: "2026-09-02T14:00:00.000Z",
  endsAt: "2026-09-02T15:15:00.000Z",
  status: "REQUESTED",
  totalMassageCapacityMinutes: 75,
  items: Object.freeze([{
    sortOrder: 0,
    providerUserId: "provider-1",
    providerLabel: "Provider One",
    serviceVariantId: "primary-60",
    serviceName: "Massage",
    serviceVariantName: "60 minutes",
    startsAt: "2026-09-02T14:00:00.000Z",
    endsAt: "2026-09-02T15:00:00.000Z",
    massageCapacityMinutes: 60,
  }]),
}])

function responseJson(payload, init = {}) {
  return Response.json(payload, {
    status: init.status ?? 200,
    headers: init.headers,
  })
}

function routeRequest(body = DESCRIPTOR_BODY) {
  return new Request("https://massagelab.test/api/book/practice-slug/sequence-options", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "198.51.100.8",
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
}

function loadAvailabilityRoute({
  session = null,
  practiceExists = true,
  bookingPolicy = {},
  providerBookingPolicies = [],
  limiterDecision = { allowed: true },
  cachedOptions = null,
  solverOptions = COMPLETE_OPTIONS,
} = {}) {
  const events = []
  const practiceReads = []
  const limiterCalls = []
  const solverCalls = []
  const cacheReads = []
  const cacheWrites = []
  const prisma = {
    practice: {
      async findUnique(query) {
        practiceReads.push(query)
        if (Object.hasOwn(query.where, "slug")) {
          events.push("practice-id")
          return practiceExists ? { id: "practice-1" } : null
        }
        events.push("practice-policy")
        return practiceExists
          ? { id: "practice-1", bookingPolicy, providerBookingPolicies }
          : null
      },
    },
  }

  const route = loadCompiledModule(routeSource, "public-booking-sequence-options.route-test.ts", {
    "next/server": { NextResponse: { json: responseJson } },
    "@/auth": {
      async getCurrentSession() {
        events.push("session")
        return session
      },
    },
    "@/lib/auth-request": {
      authRequestNetworkIdentifier(request) {
        events.push("network")
        assert.equal(request.headers.get("x-forwarded-for"), "198.51.100.8")
        return "network-1"
      },
    },
    "@/lib/operational-rate-limit": {
      async consumeOperationalRateLimit(input) {
        events.push("limiter")
        limiterCalls.push(input)
        return limiterDecision
      },
    },
    "@/lib/public-booking-availability-cache": {
      publicAvailabilityCacheKey(input) {
        return JSON.stringify(input)
      },
      readPublicAvailabilityCache(key, input) {
        events.push("cache-read")
        cacheReads.push({ key, input })
        return cachedOptions
      },
      writePublicAvailabilityCache(key, options, input) {
        events.push("cache-write")
        cacheWrites.push({ key, options, input })
      },
    },
    "@/lib/public-booking-sequences": {
      PUBLIC_SEQUENCE_PICKER_MAX_OPTIONS,
      normalizePublicBookingSequenceDescriptor(input) {
        events.push("descriptor")
        return normalizePublicBookingSequenceDescriptor(input)
      },
      async cachedPublicBookingSequenceOptions(input) {
        events.push("solver")
        solverCalls.push(input)
        return { options: solverOptions }
      },
    },
    "@/lib/booking-policy": {
      normalizeBookingPolicy(input) {
        events.push("policy")
        return normalizeBookingPolicy(input)
      },
    },
    "@/lib/prisma": { prisma },
  })

  return {
    ...route,
    events,
    practiceReads,
    limiterCalls,
    solverCalls,
    cacheReads,
    cacheWrites,
  }
}

async function postAvailability(route, body = DESCRIPTOR_BODY) {
  return route.POST(routeRequest(body), {
    params: Promise.resolve({ practiceSlug: "practice-slug" }),
  })
}

function loadAvailabilityCache() {
  if (!cacheSource) return {}
  return loadCompiledModule(cacheSource, "lib/public-booking-availability-cache.test.ts", {
    "server-only": {},
    "./public-booking-sequences.js": { normalizePublicBookingSequenceDescriptor },
  })
}

function mutableCompleteOptions(label = "Provider One") {
  return [{
    startsAt: "2026-09-02T14:00:00.000Z",
    endsAt: "2026-09-02T15:15:00.000Z",
    status: "REQUESTED",
    totalMassageCapacityMinutes: 75,
    items: [{
      sortOrder: 0,
      providerUserId: "provider-1",
      providerLabel: label,
      serviceVariantId: "primary-60",
      serviceName: "Massage",
      serviceVariantName: "60 minutes",
      startsAt: "2026-09-02T14:00:00.000Z",
      endsAt: "2026-09-02T15:00:00.000Z",
      massageCapacityMinutes: 60,
    }],
  }]
}

describe("public booking availability traffic", () => {
  it("availability rejects malformed JSON and invalid descriptors before practice, session, network, or quota", async () => {
    for (const body of ["{", { requestedPressureLevel: 3 }]) {
      const route = loadAvailabilityRoute()
      const response = await postAvailability(route, body)

      assert.equal(response.status, 400)
      assert.deepEqual(route.practiceReads, [])
      assert.deepEqual(route.limiterCalls, [])
      assert.doesNotMatch(route.events.join(","), /session|network|limiter|policy|solver/)
    }
  })

  it("availability resolves a missing practice with an id-only lookup and consumes no quota", async () => {
    const route = loadAvailabilityRoute({ practiceExists: false })
    const response = await postAvailability(route)

    assert.equal(response.status, 404)
    assert.deepEqual(await response.json(), { error: "Practice not found" })
    assert.equal(route.practiceReads.length, 1)
    assert.deepEqual(route.practiceReads[0].select, { id: true })
    assert.deepEqual(route.limiterCalls, [])
    assert.doesNotMatch(route.events.join(","), /session|network|limiter|policy|solver/)
  })

  it("availability consumes authenticated account and network policy before policy or solver reads", async () => {
    const route = loadAvailabilityRoute({
      session: { user: { id: "account-1" } },
    })
    const response = await postAvailability(route)

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { options: COMPLETE_OPTIONS })
    assert.deepEqual(route.events.filter((event) => [
      "descriptor",
      "practice-id",
      "network",
      "session",
      "limiter",
      "practice-policy",
      "policy",
      "solver",
      "cache-write",
    ].includes(event)), [
      "descriptor",
      "practice-id",
      "network",
      "session",
      "limiter",
      "practice-policy",
      "policy",
      "solver",
      "cache-write",
    ])
    assert.deepEqual(route.practiceReads[0], {
      where: { slug: "practice-slug" },
      select: { id: true },
    })
    assert.deepEqual(route.limiterCalls, [{
      operation: "BOOKING_AVAILABILITY",
      networkIdentifier: "network-1",
      practiceId: "practice-1",
      account: { kind: "ACCOUNT_ID", value: "account-1" },
    }])
    assert.equal(route.solverCalls.length, 1)
    assert.equal(route.solverCalls[0].viewerUserId, "account-1")
    assert.equal(route.cacheWrites.length, 1)
    assert.equal(route.cacheWrites[0].options, COMPLETE_OPTIONS)
  })

  it("availability consumes only anonymous network and practice policy for guests", async () => {
    const route = loadAvailabilityRoute()
    const response = await postAvailability(route)

    assert.equal(response.status, 200)
    assert.deepEqual(route.limiterCalls, [{
      operation: "BOOKING_AVAILABILITY",
      networkIdentifier: "network-1",
      practiceId: "practice-1",
    }])
    assert.equal(route.solverCalls[0].viewerUserId, "")
  })

  it("availability returns exact integer Retry-After on rate-limit denial without policy or solver reads", async () => {
    const route = loadAvailabilityRoute({
      limiterDecision: { allowed: false, reason: "RATE_LIMITED", retryAfterSeconds: 47 },
    })
    const response = await postAvailability(route)

    assert.equal(response.status, 429)
    assert.equal(response.headers.get("Retry-After"), "47")
    assert.deepEqual(await response.json(), { error: "Too many booking availability requests. Please try again later." })
    assert.equal(route.practiceReads.length, 1)
    assert.deepEqual(route.solverCalls, [])
    assert.deepEqual(route.cacheReads, [])
    assert.doesNotMatch(route.events.join(","), /practice-policy|policy|solver/)
  })

  it("availability serves only the account-mode stale final projection during limiter outage", async () => {
    const route = loadAvailabilityRoute({
      session: { user: { id: "account-1" } },
      limiterDecision: { allowed: false, reason: "UNAVAILABLE" },
      cachedOptions: COMPLETE_OPTIONS,
    })
    const response = await postAvailability(route)

    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), { options: COMPLETE_OPTIONS })
    assert.equal(route.practiceReads.length, 1)
    assert.deepEqual(route.solverCalls, [])
    assert.equal(route.cacheReads.length, 1)
    assert.deepEqual(route.cacheReads[0].input, { allowStale: true })
    assert.match(route.cacheReads[0].key, /"accountMode":"signed-in"/)
    assert.doesNotMatch(route.events.join(","), /practice-policy|policy|solver|cache-write/)
  })

  it("availability returns generic 503 on limiter outage without an eligible final projection", async () => {
    const route = loadAvailabilityRoute({
      limiterDecision: { allowed: false, reason: "UNAVAILABLE" },
      cachedOptions: null,
    })
    const response = await postAvailability(route)

    assert.equal(response.status, 503)
    assert.deepEqual(await response.json(), { error: "Booking availability is temporarily unavailable." })
    assert.deepEqual(route.solverCalls, [])
    assert.doesNotMatch(route.events.join(","), /practice-policy|policy|solver|cache-write/)
  })

  it("availability preserves practice and provider account requirements after allowance", async () => {
    for (const input of [
      { bookingPolicy: { requireClientAccount: true }, providerBookingPolicies: [] },
      {
        bookingPolicy: {},
        providerBookingPolicies: [{ providerUserId: "provider-1", requireClientAccount: true }],
      },
    ]) {
      const route = loadAvailabilityRoute(input)
      const response = await postAvailability(route)

      assert.equal(response.status, 401)
      assert.equal((await response.json()).code, "account-required")
      assert.equal(route.limiterCalls.length, 1)
      assert.deepEqual(route.solverCalls, [])
      assert.ok(route.events.indexOf("limiter") < route.events.indexOf("practice-policy"))
    }
  })

  it("availability cache keys normalize descriptors and exclude caller identity or contact extras", () => {
    const { publicAvailabilityCacheKey } = loadAvailabilityCache()
    assert.equal(typeof publicAvailabilityCacheKey, "function")
    const base = {
      practiceId: "practice-1",
      accountMode: "guest",
      descriptor: DESCRIPTOR_BODY,
      maxOptions: PUBLIC_SEQUENCE_PICKER_MAX_OPTIONS,
    }
    const normalizedKey = publicAvailabilityCacheKey(base)
    const extraKey = publicAvailabilityCacheKey({
      ...base,
      descriptor: {
        ...DESCRIPTOR_BODY,
        requestedPressureLevel: "3",
        preferredProviderId: " provider-1 ",
      },
      userId: "private-user",
      email: "private@example.test",
      cookie: "private-cookie",
    })

    assert.equal(extraKey, normalizedKey)
    assert.doesNotMatch(extraKey, /private-user|private@example|private-cookie/)
    assert.notEqual(publicAvailabilityCacheKey({ ...base, accountMode: "signed-in" }), normalizedKey)
  })

  it("availability cache honors 20-second freshness and 60-second outage-stale maximum", () => {
    const { readPublicAvailabilityCache, writePublicAvailabilityCache } = loadAvailabilityCache()
    assert.equal(typeof readPublicAvailabilityCache, "function")
    assert.equal(typeof writePublicAvailabilityCache, "function")
    const options = mutableCompleteOptions()
    writePublicAvailabilityCache("availability-key", options, { now: 1_000 })
    options[0].items[0].providerLabel = "Mutated caller copy"

    const fresh = readPublicAvailabilityCache("availability-key", { now: 20_999 })
    assert.equal(fresh[0].items[0].providerLabel, "Provider One")
    assert.equal(Object.isFrozen(fresh), true)
    assert.equal(Object.isFrozen(fresh[0]), true)
    assert.equal(Object.isFrozen(fresh[0].items), true)
    assert.equal(Object.isFrozen(fresh[0].items[0]), true)
    assert.equal(readPublicAvailabilityCache("availability-key", { now: 21_000 }), null)
    assert.notEqual(readPublicAvailabilityCache("availability-key", { now: 61_000, allowStale: true }), null)
    assert.equal(readPublicAvailabilityCache("availability-key", { now: 61_001, allowStale: true }), null)
  })

  it("availability cache accepts an empty complete projection and rejects incomplete values", () => {
    const { readPublicAvailabilityCache, writePublicAvailabilityCache } = loadAvailabilityCache()
    writePublicAvailabilityCache("empty", [], { now: 1_000 })
    assert.deepEqual(readPublicAvailabilityCache("empty", { now: 1_001 }), [])
    assert.throws(
      () => writePublicAvailabilityCache("incomplete", [{ startsAt: "2026-09-02T14:00:00.000Z" }], { now: 1_000 }),
      /complete public availability projection/i,
    )
    assert.equal(readPublicAvailabilityCache("incomplete", { now: 1_001, allowStale: true }), null)
  })

  it("availability cache caps storage at 250 entries by evicting the oldest key", () => {
    const { readPublicAvailabilityCache, writePublicAvailabilityCache } = loadAvailabilityCache()
    for (let index = 0; index <= 250; index += 1) {
      writePublicAvailabilityCache(`availability-${index}`, [], { now: index + 1 })
    }

    assert.equal(readPublicAvailabilityCache("availability-0", { now: 251 }), null)
    assert.deepEqual(readPublicAvailabilityCache("availability-1", { now: 251 }), [])
    assert.deepEqual(readPublicAvailabilityCache("availability-250", { now: 251 }), [])
  })
})

describe("public booking action state", () => {
  it("action state owns the exact serializable union, ambiguous recovery, and fixed privacy-safe copy", async () => {
    assert.ok(actionStateSource)
    const state = loadCompiledModule(actionStateSource, "public-booking-state.test.ts", {})

    assert.deepEqual(state.INITIAL_PUBLIC_BOOKING_ACTION_STATE, { status: "IDLE" })
    assert.deepEqual(state.publicBookingSuccess("/book/practice?booking=requested"), {
      status: "SUCCESS",
      redirectTo: "/book/practice?booking=requested",
    })
    assert.deepEqual(state.publicBookingValidationError(), {
      status: "VALIDATION_ERROR",
      message: "Review your booking details and try again.",
    })
    assert.deepEqual(state.publicBookingConflict(), {
      status: "CONFLICT",
      message: "This request could not be completed. Start a new request and try again.",
    })
    assert.deepEqual(state.publicBookingRateLimited(2.1), {
      status: "RATE_LIMITED",
      message: "Too many requests. Please wait before trying again.",
      retryAfterSeconds: 3,
    })
    assert.deepEqual(state.publicBookingUnavailable(), {
      status: "UNAVAILABLE",
      message: "Booking is temporarily unavailable. Please try again.",
    })
    const success = { status: "SUCCESS", redirectTo: "/book/practice?booking=requested" }
    assert.equal(await state.runPublicBookingActionWithRecovery(async () => success, { status: "IDLE" }, new FormData()), success)
    assert.deepEqual(
      await state.runPublicBookingActionWithRecovery(async () => { throw new Error("private transport detail") }, { status: "IDLE" }, new FormData()),
      state.publicBookingUnavailable(),
    )
    const conflict = state.publicBookingConflict()
    assert.equal(state.publicBookingActionStateForAttempt(conflict, "request-1", "request-1"), conflict)
    assert.deepEqual(
      state.publicBookingActionStateForAttempt(conflict, "request-1", "request-2"),
      { status: "IDLE" },
      "a deliberately rotated attempt must not render or act on the old result",
    )
    assert.doesNotMatch(actionStateSource, /account exists|practice client|database row|quota key/i)
  })

  it("action state wrappers and domain functions use React 19 state signatures without server UUIDs or redirects", () => {
    assert.match(actionWrappersSource, /requestBookingSequenceAction\(\s*previousState:\s*PublicBookingActionState,\s*formData:\s*FormData,?\s*\)/s)
    assert.match(actionWrappersSource, /joinBookingWaitlistAction\(\s*previousState:\s*PublicBookingActionState,\s*formData:\s*FormData,?\s*\)/s)
    assert.match(actionWrappersSource, /return requestBookingSequence\(previousState, formData\)/)
    assert.match(actionWrappersSource, /return joinBookingWaitlist\(previousState, formData\)/)

    const bookingStart = publicBookingActionsSource.indexOf("export async function requestBookingSequence(")
    const waitlistStart = publicBookingActionsSource.indexOf("export async function joinBookingWaitlist(")
    const convertStart = publicBookingActionsSource.indexOf("export async function convertWaitlistEntry(")
    const bookingBlock = publicBookingActionsSource.slice(bookingStart, waitlistStart)
    const waitlistBlock = publicBookingActionsSource.slice(waitlistStart, convertStart)
    for (const block of [bookingBlock, waitlistBlock]) {
      assert.match(block, /previousState:\s*PublicBookingActionState[\s\S]*formData:\s*FormData/)
      assert.match(block, /Promise<PublicBookingActionState>/)
      assert.doesNotMatch(block, /redirect\(/)
      assert.doesNotMatch(block, /randomUUID/)
    }
    assert.match(bookingBlock, /publicBookingSuccess\([^)]*\?booking=requested/)
    assert.match(waitlistBlock, /publicBookingSuccess\([^)]*\?waitlist=joined/)
    assert.doesNotMatch(actionWrappersSource, /randomUUID|Retry-After|status:\s*429|status:\s*503/)
  })
})

const BOOKING_REQUEST_ID = "123e4567-e89b-42d3-a456-426614174000"
const BOOKING_START = "2026-09-02T14:00:00.000Z"

function bookingForm(overrides = {}) {
  const values = {
    requestId: BOOKING_REQUEST_ID,
    practiceId: "practice-1",
    primaryServiceVariantId: "primary-60",
    addOnServiceVariantIds: ["addon-15"],
    requestedPressureLevel: "3",
    startsAt: BOOKING_START,
    preferredProviderId: "provider-1",
    guestName: "Guest Person",
    guestEmail: "Guest@Example.COM",
    guestPhone: "555-0100",
    ...overrides,
  }
  const formData = new FormData()
  for (const [key, value] of Object.entries(values)) {
    if (Array.isArray(value)) {
      for (const item of value) formData.append(key, item)
    } else {
      formData.set(key, value)
    }
  }
  return formData
}

function bookingSelection(overrides = {}) {
  return {
    requestId: BOOKING_REQUEST_ID,
    primaryServiceVariantId: "primary-60",
    addOnServiceVariantIds: ["addon-15"],
    requestedPressureLevel: 3,
    requestedStartsAt: BOOKING_START,
    preferredProviderId: "provider-1",
    ...overrides,
  }
}

function storedBookingRow({
  selection = bookingSelection(),
  practiceId = "practice-1",
  userId = null,
  guestEmail = "guest@example.com",
  requestedPressureLevel = selection.requestedPressureLevel,
} = {}) {
  const owner = publicBookingIdempotencyModule.publicBookingRequestOwner(selection)
  return {
    id: owner.id,
    practiceId,
    practiceClientId: userId ? "client-account" : "client-guest",
    createdById: userId,
    requestedPressureLevel,
    status: "REQUESTED",
    practiceClient: {
      userId,
      email: userId ? "account@example.com" : guestEmail,
    },
    appointments: [
      {
        bookingGroupOrder: 0,
        serviceVariantId: "primary-60",
        therapistId: "provider-1",
        startsAt: new Date(BOOKING_START),
      },
      {
        bookingGroupOrder: 1,
        serviceVariantId: "addon-15",
        therapistId: "provider-2",
        startsAt: new Date("2026-09-02T15:00:00.000Z"),
      },
    ],
  }
}

function createPrefixMutex() {
  let locked = false
  const waiters = []
  return {
    async acquire() {
      if (locked) {
        await new Promise((resolve) => waiters.push(resolve))
      } else {
        locked = true
      }
      return () => {
        const next = waiters.shift()
        if (next) next()
        else locked = false
      }
    },
  }
}

function loadBookingCreateAction({
  sessionUserId = null,
  limiterDecision = { allowed: true },
  existingRows = [],
  failFirstTransaction = false,
  failFirstRevalidation = false,
  dropSecondSolverOptionAfterCommit = false,
} = {}) {
  const events = []
  const limiterCalls = []
  const bookingRows = [...existingRows]
  const clients = new Map()
  for (const row of bookingRows) clients.set(row.practiceClientId, { id: row.practiceClientId, ...row.practiceClient })
  const mutex = createPrefixMutex()
  let nextId = 1
  let shouldFailTransaction = failFirstTransaction
  let shouldFailRevalidation = failFirstRevalidation
  let solverCallCount = 0
  let resolveFirstCommit
  const firstCommit = new Promise((resolve) => { resolveFirstCommit = resolve })
  const durable = {
    calendarEvents: 0,
    appointments: 0,
    notifications: 0,
    pushes: 0,
    revalidations: 0,
    contactWrites: 0,
  }

  function findRow(query, event) {
    events.push(event)
    const prefix = query.where.id.startsWith
    return bookingRows.find((row) => row.id.startsWith(prefix)) ?? null
  }

  const prisma = {
    bookingGroup: {
      async findFirst(query) {
        return findRow(query, "replay-preflight")
      },
    },
    practice: {
      async findUnique(query) {
        events.push("practice-path")
        assert.deepEqual(query, {
          where: { id: "practice-1" },
          select: {
            slug: true,
            publicBookingStateSlug: true,
            publicBookingSlug: true,
          },
        })
        return {
          slug: "practice-slug",
          publicBookingStateSlug: null,
          publicBookingSlug: null,
        }
      },
    },
    practiceMembership: {
      async findMany() {
        events.push("staff-read")
        return [{ userId: "staff-1" }]
      },
    },
    async $transaction(callback) {
      const staged = {
        bookingRows: [],
        clients: new Map(),
        calendarEvents: 0,
        appointments: 0,
        notifications: 0,
        contactWrites: 0,
      }
      let release = null
      const tx = {
        __staged: staged,
        async $queryRaw(_strings, ...values) {
          assert.match(values[0], /^public-booking-v1:/)
          release = await mutex.acquire()
          events.push("tx-lock")
          return []
        },
        bookingGroup: {
          async findFirst(query) {
            return findRow(query, "replay-transaction")
          },
          async create({ data }) {
            events.push("group-create")
            const row = {
              id: data.id ?? `generated-group-${nextId++}`,
              practiceId: data.practiceId,
              practiceClientId: data.practiceClientId,
              createdById: data.createdById,
              requestedPressureLevel: data.requestedPressureLevel,
              status: data.status,
              appointments: [],
            }
            staged.bookingRows.push(row)
            return row
          },
        },
        practiceClient: {
          async findFirst({ where }) {
            events.push("contact-read")
            return [...clients.values()].find((client) => (
              client.id === where.id
              || (client.userId === null && client.email === where.email)
            )) ?? null
          },
          async update({ where, data }) {
            events.push("contact-write")
            staged.contactWrites += 1
            const existing = clients.get(where.id)
            const client = { ...existing, ...data }
            staged.clients.set(client.id, client)
            return client
          },
          async create({ data }) {
            events.push("contact-write")
            staged.contactWrites += 1
            const client = { id: `client-${nextId++}`, ...data }
            staged.clients.set(client.id, client)
            return client
          },
          async upsert({ where, create, update }) {
            events.push("contact-write")
            staged.contactWrites += 1
            const existing = [...clients.values()].find((client) => (
              client.userId === where.practiceId_userId.userId
            ))
            const client = existing
              ? { ...existing, ...update }
              : { id: `client-${nextId++}`, ...create }
            staged.clients.set(client.id, client)
            return client
          },
        },
        user: {
          async findUnique() {
            events.push("account-read")
            return { name: "Account Person", email: "account@example.com" }
          },
        },
        bookingWaitlistEntry: {
          async updateMany() {
            throw new Error("waitlist conversion is outside this harness")
          },
        },
        appointment: {
          async findMany() {
            events.push("appointment-policy-read")
            return []
          },
          async create({ data }) {
            events.push("appointment-create")
            staged.appointments += 1
            const group = staged.bookingRows.find((row) => row.id === data.bookingGroupId)
            group?.appointments.push({
              bookingGroupOrder: data.bookingGroupOrder,
              serviceVariantId: data.serviceVariantId,
              therapistId: data.therapistId,
              startsAt: data.startsAt,
            })
            return { id: `appointment-${nextId++}`, ...data }
          },
        },
        providerBookingCapacityRule: {
          async findMany() {
            events.push("capacity-read")
            return []
          },
        },
        calendarEvent: {
          async create({ data }) {
            events.push("event-create")
            if (shouldFailTransaction) {
              shouldFailTransaction = false
              throw new Error("injected transaction failure")
            }
            staged.calendarEvents += 1
            return { id: `event-${nextId++}`, ...data }
          },
        },
        calendarResourceBooking: {
          async createMany() {
            events.push("resource-write")
            return { count: 0 }
          },
        },
      }

      try {
        const result = await callback(tx)
        for (const [id, client] of staged.clients) clients.set(id, client)
        for (const row of staged.bookingRows) {
          const practiceClient = clients.get(row.practiceClientId)
          bookingRows.push({ ...row, practiceClient })
        }
        if (staged.bookingRows.length > 0) resolveFirstCommit()
        durable.calendarEvents += staged.calendarEvents
        durable.appointments += staged.appointments
        durable.notifications += staged.notifications
        durable.contactWrites += staged.contactWrites
        return result
      } finally {
        release?.()
      }
    },
  }

  const state = publicBookingStateModule
  const action = loadCompiledModule(
    publicBookingActionsSource,
    "app/calendar/actions/public-booking.booking-create-test.ts",
    {
      "server-only": {},
      "next/headers": {
        async headers() {
          events.push("headers")
          return new Headers({ "x-forwarded-for": "198.51.100.8" })
        },
      },
      "next/navigation": { redirect() { throw new Error("unexpected redirect") } },
      "@prisma/client": { Prisma: {} },
      "@/auth": {
        async getCurrentSession() {
          events.push("session")
          return sessionUserId ? { user: { id: sessionUserId } } : null
        },
      },
      "@/lib/auth-request": {
        authRequestNetworkIdentifier(request) {
          events.push("network")
          assert.equal(request.headers.get("x-forwarded-for"), "198.51.100.8")
          return "network-1"
        },
      },
      "@/lib/auth-security": {
        normalizeEmail(value) {
          return typeof value === "string" ? value.trim().toLowerCase() : ""
        },
      },
      "@/lib/booking-policy": {
        capacityAllowsBooking: () => ({ allowed: true }),
        hasRestGapConflict: () => false,
        normalizePressureLevel(value) {
          const number = Number(value)
          return Number.isInteger(number) && number >= 1 && number <= 5 ? number : null
        },
        providerAppointmentLimitAllows: () => ({ allowed: true }),
      },
      "@/lib/calendar": {
        dateValue(value) {
          const date = value instanceof Date ? value : new Date(value)
          if (!Number.isFinite(date.getTime())) throw new Error("invalid date")
          return date
        },
        localDateTimeToUtc: () => null,
      },
      "@/lib/calendar-readiness": {
        async assertCalendarDatabaseReady() {
          events.push("readiness")
        },
      },
      "@/lib/calendar-sync-service": {
        async pushCalendarEventToGoogleBestEffort() {
          events.push("google-push")
          durable.pushes += 1
        },
      },
      "@/lib/calendar-flows": {
        buildCalendarCreationPlan(input) {
          return {
            event: {
              practiceId: input.practiceId,
              ownerUserId: input.targetUserId,
              startsAt: input.startsAt,
              endsAt: input.endsAt,
              title: input.title,
            },
            auditAction: "calendar.booking_sequence.requested",
          }
        },
      },
      "@/lib/operational-rate-limit": {
        async consumeOperationalRateLimit(input) {
          events.push("limiter")
          limiterCalls.push(input)
          return limiterDecision
        },
      },
      "@/lib/prisma": { prisma },
      "@/lib/public-booking-idempotency": publicBookingIdempotencyModule,
      "@/lib/public-booking-sequences": {
        PUBLIC_SEQUENCE_PICKER_MAX_OPTIONS,
        async publicBookingSequenceOptions() {
          events.push("solver")
          solverCallCount += 1
          if (dropSecondSolverOptionAfterCommit && solverCallCount === 2) await firstCommit
          return {
            allowGuestBooking: true,
            practice: {
              id: "practice-1",
              slug: "practice-slug",
              publicBookingStateSlug: null,
              publicBookingSlug: null,
              timezone: "America/New_York",
            },
            policy: {},
            providers: [{ userId: "provider-1" }],
            variants: [
              { id: "primary-60", serviceTypeId: "service-primary" },
              { id: "addon-15", serviceTypeId: "service-addon" },
            ],
            options: dropSecondSolverOptionAfterCommit && solverCallCount === 2 ? [] : [{
              startsAt: BOOKING_START,
              status: "REQUESTED",
              items: [
                {
                  sortOrder: 0,
                  providerUserId: "provider-1",
                  serviceVariantId: "primary-60",
                  startsAt: BOOKING_START,
                  endsAt: "2026-09-02T15:00:00.000Z",
                  massageCapacityMinutes: 60,
                },
                {
                  sortOrder: 1,
                  providerUserId: "provider-1",
                  serviceVariantId: "addon-15",
                  startsAt: "2026-09-02T15:00:00.000Z",
                  endsAt: "2026-09-02T15:15:00.000Z",
                  massageCapacityMinutes: 15,
                },
              ],
            }],
          }
        },
      },
      "@/lib/public-booking-url": {
        publicBookingPathForPractice(practice) {
          events.push("public-path")
          return practice.publicBookingStateSlug && practice.publicBookingSlug
            ? `/book/${practice.publicBookingStateSlug}/${practice.publicBookingSlug}`
            : `/book/${practice.slug}`
        },
      },
      "@/lib/public-request-id": publicRequestIdModule,
      "./access": {
        STAFF_ROLES: ["OWNER", "THERAPIST", "STAFF"],
        assertPracticeAccess: async () => ({ role: "OWNER" }),
        currentUserId: async () => "account-1",
        fieldString(formData, key) {
          const value = formData.get(key)
          return typeof value === "string" ? value.trim() : ""
        },
      },
      "./availability": {
        async assertNoCalendarEventConflict() { events.push("calendar-conflict-read") },
        async assertNoResourceConflict() { events.push("resource-conflict-read") },
        async assertProviderAvailability() { events.push("provider-availability-read") },
        async lockAppointmentSchedulingRows() { events.push("schedule-lock") },
      },
      "./audit": {
        async writeCalendarAuditAndNotifications(tx) {
          events.push("notification-write")
          tx.__staged.notifications += 1
        },
      },
      "./revalidation": {
        revalidateCalendarRoutes() {
          events.push("revalidate")
          durable.revalidations += 1
          if (shouldFailRevalidation) {
            shouldFailRevalidation = false
            throw new Error("injected post-commit revalidation failure")
          }
        },
      },
      "./service-catalog": {
        selectedAddOnVariantIds(formData) {
          return [...new Set(formData.getAll("addOnServiceVariantIds")
            .flatMap((value) => String(value).split(","))
            .map((value) => value.trim())
            .filter(Boolean))].slice(0, 4)
        },
        serviceResourceIds: () => [],
        serviceSnapshotForCreate(variant) {
          return {
            serviceName: variant.id === "primary-60" ? "Massage" : "Add-on",
            serviceVariantName: variant.id,
            durationMinutes: variant.id === "primary-60" ? 60 : 15,
            priceCents: null,
            currency: "usd",
          }
        },
      },
      "./public-booking-state": state,
    },
  )

  return {
    ...action,
    bookingRows,
    durable,
    events,
    limiterCalls,
  }
}

describe("public booking create traffic", () => {
  it("validates canonical bounded booking input before replay or quota", async () => {
    for (const formData of [
      bookingForm({ requestId: "not-a-canonical-uuid" }),
      bookingForm({ requestId: ` ${BOOKING_REQUEST_ID}` }),
      bookingForm({ requestId: `${BOOKING_REQUEST_ID} ` }),
      bookingForm({ guestName: "x".repeat(192) }),
      bookingForm({ primaryServiceVariantId: "x".repeat(192) }),
      bookingForm({ startsAt: "not-a-date" }),
    ]) {
      const action = loadBookingCreateAction()
      const result = await action.requestBookingSequence({ status: "IDLE" }, formData)

      assert.deepEqual(result, publicBookingStateModule.publicBookingValidationError())
      assert.deepEqual(action.limiterCalls, [])
      assert.doesNotMatch(action.events.join(","), /replay-|readiness|solver|staff-read|contact-|group-create|event-create|google-push|revalidate/)
    }
  })

  it("returns an authoritative exact guest replay before quota or downstream work", async () => {
    const existing = storedBookingRow()
    const action = loadBookingCreateAction({ existingRows: [existing] })
    const result = await action.requestBookingSequence({ status: "IDLE" }, bookingForm())

    assert.deepEqual(result, publicBookingStateModule.publicBookingSuccess("/book/practice-slug?booking=requested"))
    assert.deepEqual(action.limiterCalls, [])
    assert.deepEqual(action.events.filter((event) => event === "replay-preflight" || event === "practice-path"), [
      "replay-preflight",
      "practice-path",
    ])
    assert.doesNotMatch(action.events.join(","), /readiness|solver|staff-read|contact-|tx-lock|group-create|event-create|notification-write|google-push|revalidate/)
  })

  it("accepts signed-in replay only when createdBy and practice-client user mappings agree", async () => {
    const accepted = loadBookingCreateAction({
      sessionUserId: "account-1",
      existingRows: [storedBookingRow({ userId: "account-1" })],
    })
    assert.equal((await accepted.requestBookingSequence({ status: "IDLE" }, bookingForm())).status, "SUCCESS")

    for (const existing of [
      { ...storedBookingRow({ userId: "account-1" }), createdById: "other-account" },
      {
        ...storedBookingRow({ userId: "account-1" }),
        practiceClient: { userId: "other-account", email: "other@example.com" },
      },
    ]) {
      const rejected = loadBookingCreateAction({ sessionUserId: "account-1", existingRows: [existing] })
      assert.deepEqual(
        await rejected.requestBookingSequence({ status: "IDLE" }, bookingForm()),
        publicBookingStateModule.publicBookingConflict(),
      )
      assert.deepEqual(rejected.limiterCalls, [])
      assert.doesNotMatch(rejected.events.join(","), /practice-path|solver|contact-|group-create|google-push|revalidate/)
    }
  })

  it("maps changed selection, owner, practice, or persisted selection evidence to one generic conflict", async () => {
    const cases = [
      { existing: storedBookingRow(), form: bookingForm({ requestedPressureLevel: "4" }) },
      { existing: storedBookingRow({ guestEmail: "other@example.com" }), form: bookingForm() },
      { existing: storedBookingRow({ practiceId: "other-practice" }), form: bookingForm() },
      { existing: storedBookingRow({ requestedPressureLevel: 4 }), form: bookingForm() },
    ]
    for (const input of cases) {
      const action = loadBookingCreateAction({ existingRows: [input.existing] })
      assert.deepEqual(
        await action.requestBookingSequence({ status: "IDLE" }, input.form),
        publicBookingStateModule.publicBookingConflict(),
      )
      assert.deepEqual(action.limiterCalls, [])
      assert.doesNotMatch(action.events.join(","), /practice-path|readiness|solver|contact-|group-create|google-push|revalidate/)
    }
  })

  it("consumes guest owner, practice, and canonical network quota before heavy booking work", async () => {
    const action = loadBookingCreateAction()
    const result = await action.requestBookingSequence({ status: "IDLE" }, bookingForm())

    assert.equal(result.status, "SUCCESS")
    assert.deepEqual(action.limiterCalls, [{
      operation: "BOOKING_CREATE",
      networkIdentifier: "network-1",
      practiceId: "practice-1",
      owner: { kind: "GUEST_EMAIL", value: "guest@example.com" },
    }])
    assert.ok(action.events.indexOf("replay-preflight") < action.events.indexOf("limiter"))
    assert.ok(action.events.indexOf("limiter") < action.events.indexOf("readiness"))
    assert.ok(action.events.indexOf("limiter") < action.events.indexOf("solver"))
    assert.ok(action.events.indexOf("limiter") < action.events.indexOf("staff-read"))
    assert.match(action.bookingRows[0].id, /^public-booking-v1:/)
  })

  it("uses the authenticated account owner for quota without storing contact in selection identity", async () => {
    const action = loadBookingCreateAction({ sessionUserId: "account-1" })
    const result = await action.requestBookingSequence({ status: "IDLE" }, bookingForm({
      guestName: "Ignored Guest",
      guestEmail: "ignored@example.com",
      guestPhone: "555-9999",
    }))

    assert.equal(result.status, "SUCCESS")
    assert.deepEqual(action.limiterCalls[0].owner, { kind: "ACCOUNT_ID", value: "account-1" })
    assert.doesNotMatch(action.bookingRows[0].id, /account-1|ignored|example|555/)
  })

  it("maps booking quota denial and outage without creation or downstream work", async () => {
    const inputs = [
      {
        decision: { allowed: false, reason: "RATE_LIMITED", retryAfterSeconds: 47 },
        expected: publicBookingStateModule.publicBookingRateLimited(47),
      },
      {
        decision: { allowed: false, reason: "UNAVAILABLE" },
        expected: publicBookingStateModule.publicBookingUnavailable(),
      },
    ]
    for (const input of inputs) {
      const action = loadBookingCreateAction({ limiterDecision: input.decision })
      assert.deepEqual(
        await action.requestBookingSequence({ status: "IDLE" }, bookingForm()),
        input.expected,
      )
      assert.equal(action.bookingRows.length, 0)
      assert.deepEqual(action.durable, {
        calendarEvents: 0,
        appointments: 0,
        notifications: 0,
        pushes: 0,
        revalidations: 0,
        contactWrites: 0,
      })
      assert.doesNotMatch(action.events.join(","), /readiness|solver|staff-read|contact-|tx-lock|group-create|event-create|notification-write|google-push|revalidate/)
    }
  })

  it("locks and rechecks before contact or calendar writes, then runs downstream work only after commit", async () => {
    const action = loadBookingCreateAction()
    const result = await action.requestBookingSequence({ status: "IDLE" }, bookingForm())

    assert.equal(result.status, "SUCCESS")
    const ordered = action.events.filter((event) => [
      "tx-lock",
      "replay-transaction",
      "contact-read",
      "contact-write",
      "group-create",
      "event-create",
      "notification-write",
      "google-push",
      "revalidate",
    ].includes(event))
    assert.deepEqual(ordered, [
      "tx-lock",
      "replay-transaction",
      "contact-read",
      "contact-write",
      "group-create",
      "event-create",
      "notification-write",
      "event-create",
      "notification-write",
      "google-push",
      "google-push",
      "revalidate",
    ])
    assert.equal(action.bookingRows[0].id, publicBookingIdempotencyModule.publicBookingRequestOwner(bookingSelection()).id)
  })

  it("serializes concurrent same and changed selections under one prefix", async () => {
    const same = loadBookingCreateAction()
    const sameResults = await Promise.all([
      same.requestBookingSequence({ status: "IDLE" }, bookingForm()),
      same.requestBookingSequence({ status: "IDLE" }, bookingForm()),
    ])
    assert.deepEqual(sameResults.map((result) => result.status), ["SUCCESS", "SUCCESS"])
    assert.equal(same.bookingRows.length, 1)
    assert.equal(same.durable.calendarEvents, 2)
    assert.equal(same.durable.appointments, 2)
    assert.equal(same.durable.notifications, 2)
    assert.equal(same.durable.pushes, 2)
    assert.equal(same.durable.revalidations, 1)

    const changed = loadBookingCreateAction()
    const changedResults = await Promise.all([
      changed.requestBookingSequence({ status: "IDLE" }, bookingForm()),
      changed.requestBookingSequence({ status: "IDLE" }, bookingForm({ requestedPressureLevel: "4" })),
    ])
    assert.deepEqual(changedResults.map((result) => result.status).sort(), ["CONFLICT", "SUCCESS"])
    assert.equal(changed.bookingRows.length, 1)
    assert.equal(changed.durable.calendarEvents, 2)
    assert.equal(changed.durable.revalidations, 1)
  })

  it("recovers an exact concurrent replay when the committed booking removes the second solver option", async () => {
    const action = loadBookingCreateAction({ dropSecondSolverOptionAfterCommit: true })
    const results = await Promise.all([
      action.requestBookingSequence({ status: "IDLE" }, bookingForm()),
      action.requestBookingSequence({ status: "IDLE" }, bookingForm()),
    ])
    assert.deepEqual(results.map((result) => result.status), ["SUCCESS", "SUCCESS"])
    assert.equal(action.bookingRows.length, 1)
    assert.deepEqual(action.durable, { calendarEvents: 2, appointments: 2, notifications: 2, pushes: 2, revalidations: 1, contactWrites: 1 })
    assert.equal(action.events.filter((event) => event === "solver").length, 2)
  })

  it("rolls back a failed transaction so the same request can retry without replaying downstream work", async () => {
    const action = loadBookingCreateAction({ failFirstTransaction: true })
    const first = await action.requestBookingSequence({ status: "IDLE" }, bookingForm())

    assert.deepEqual(first, publicBookingStateModule.publicBookingUnavailable())
    assert.equal(action.bookingRows.length, 0)
    assert.equal(action.durable.contactWrites, 0)
    assert.equal(action.durable.calendarEvents, 0)
    assert.equal(action.durable.pushes, 0)
    assert.equal(action.durable.revalidations, 0)

    const second = await action.requestBookingSequence({ status: "IDLE" }, bookingForm())
    assert.equal(second.status, "SUCCESS")
    assert.equal(action.bookingRows.length, 1)
    assert.equal(action.bookingRows[0].id, publicBookingIdempotencyModule.publicBookingRequestOwner(bookingSelection()).id)
    assert.equal(action.durable.calendarEvents, 2)
    assert.equal(action.durable.pushes, 2)
    assert.equal(action.durable.revalidations, 1)
  })

  it("recovers a post-commit ambiguous result without replaying provider or revalidation work", async () => {
    const action = loadBookingCreateAction({ failFirstRevalidation: true })
    const first = await action.requestBookingSequence({ status: "IDLE" }, bookingForm())

    assert.deepEqual(first, publicBookingStateModule.publicBookingUnavailable())
    assert.equal(action.bookingRows.length, 1)
    assert.equal(action.durable.calendarEvents, 2)
    assert.equal(action.durable.pushes, 2)
    assert.equal(action.durable.revalidations, 1)

    const second = await action.requestBookingSequence({ status: "IDLE" }, bookingForm())
    assert.equal(second.status, "SUCCESS")
    assert.equal(action.bookingRows.length, 1)
    assert.equal(action.durable.calendarEvents, 2)
    assert.equal(action.durable.pushes, 2)
    assert.equal(action.durable.revalidations, 1)
    assert.equal(action.events.filter((event) => event === "solver").length, 1)
  })
})
