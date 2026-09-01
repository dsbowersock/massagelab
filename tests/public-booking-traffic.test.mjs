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
const [routeSource, cacheSource] = await Promise.all([
  readFile(new URL("../app/api/book/[practiceSlug]/sequence-options/route.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/public-booking-availability-cache.ts", import.meta.url), "utf8").catch((error) => {
    if (error?.code === "ENOENT") return ""
    throw error
  }),
])

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
