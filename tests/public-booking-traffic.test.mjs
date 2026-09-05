import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

import {
  MAX_PUBLIC_ADD_ONS,
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

function routeRequest(body = DESCRIPTOR_BODY, { headers = {}, stream = false } = {}) {
  const serializedBody = typeof body === "string" ? body : JSON.stringify(body)
  return new Request("https://massagelab.test/api/book/practice-slug/sequence-options", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "198.51.100.8",
      ...headers,
    },
    body: stream
      ? new ReadableStream({
          start(controller) {
            const bytes = new TextEncoder().encode(serializedBody)
            const midpoint = Math.floor(bytes.byteLength / 2)
            controller.enqueue(bytes.slice(0, midpoint))
            controller.enqueue(bytes.slice(midpoint))
            controller.close()
          },
        })
      : serializedBody,
    ...(stream ? { duplex: "half" } : {}),
  })
}

function routeRequestBytes(bytes, { headers = {} } = {}) {
  return new Request("https://massagelab.test/api/book/practice-slug/sequence-options", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "198.51.100.8",
      ...headers,
    },
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(bytes)
        controller.close()
      },
    }),
    duplex: "half",
  })
}

function openRouteRequest(body) {
  const bytes = new TextEncoder().encode(typeof body === "string" ? body : JSON.stringify(body))
  let cancellationCount = 0
  const request = new Request("https://massagelab.test/api/book/practice-slug/sequence-options", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-forwarded-for": "198.51.100.8",
    },
    body: new ReadableStream({
      start(controller) {
        controller.enqueue(bytes)
      },
      cancel() {
        cancellationCount += 1
      },
    }),
    duplex: "half",
  })

  return { request, cancellationCount: () => cancellationCount }
}

function exactSizeDescriptorBody(byteLength) {
  const encoder = new TextEncoder()
  const body = { ...DESCRIPTOR_BODY, padding: "" }
  const emptyPaddingBytes = encoder.encode(JSON.stringify(body)).byteLength
  assert.ok(emptyPaddingBytes <= byteLength)
  body.padding = "x".repeat(byteLength - emptyPaddingBytes)
  const serialized = JSON.stringify(body)
  assert.equal(encoder.encode(serialized).byteLength, byteLength)
  return serialized
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
      MAX_PUBLIC_ADD_ONS,
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

async function postAvailabilityRequest(route, request) {
  return route.POST(request, {
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
  it("availability accepts exactly 4096 UTF-8 JSON bytes with a charset media parameter", async () => {
    const body = exactSizeDescriptorBody(4096)
    const requests = [
      routeRequest(body, {
        headers: { "content-type": "application/json; charset=utf-8" },
        stream: true,
      }),
      routeRequest(body, {
        headers: {
          "content-type": "application/json; charset=utf-8",
          "content-length": "4096",
        },
      }),
    ]
    assert.equal(requests[0].headers.get("content-length"), null)
    assert.equal(requests[1].headers.get("content-length"), "4096")

    for (const request of requests) {
      const route = loadAvailabilityRoute()
      const response = await postAvailabilityRequest(route, request)

      assert.equal(response.status, 200)
      assert.equal(route.practiceReads.length, 2)
      assert.equal(route.limiterCalls.length, 1)
      assert.equal(route.solverCalls.length, 1)
    }
  })

  it("availability rejects exactly 4097 streamed UTF-8 JSON bytes without Content-Length", async () => {
    const route = loadAvailabilityRoute()
    const { request, cancellationCount } = openRouteRequest(exactSizeDescriptorBody(4097))
    assert.equal(request.headers.get("content-length"), null)

    const response = await postAvailabilityRequest(route, request)

    assert.equal(response.status, 400)
    assert.equal(cancellationCount(), 1)
    assert.deepEqual(route.practiceReads, [])
    assert.deepEqual(route.limiterCalls, [])
    assert.doesNotMatch(route.events.join(","), /descriptor|session|network|limiter|cache|policy|solver/)
  })

  it("availability rejects malformed UTF-8 before descriptor or downstream work", async () => {
    const encoder = new TextEncoder()
    const prefix = encoder.encode('{"primaryServiceVariantId":"')
    const suffix = encoder.encode('","addOnServiceVariantIds":[],"requestedPressureLevel":3,"preferredProviderId":""}')
    const bytes = new Uint8Array(prefix.byteLength + 2 + suffix.byteLength)
    bytes.set(prefix)
    bytes.set([0xc3, 0x28], prefix.byteLength)
    bytes.set(suffix, prefix.byteLength + 2)
    const route = loadAvailabilityRoute()
    const response = await postAvailabilityRequest(route, routeRequestBytes(bytes))

    assert.equal(response.status, 400)
    assert.deepEqual(route.practiceReads, [])
    assert.deepEqual(route.limiterCalls, [])
    assert.doesNotMatch(route.events.join(","), /descriptor|session|network|limiter|cache|policy|solver/)
  })

  it("availability accepts only a bounded UTF-8 JSON object before descriptor or downstream work", async () => {
    const requestWithoutContentType = routeRequest(DESCRIPTOR_BODY)
    requestWithoutContentType.headers.delete("content-type")
    assert.equal(requestWithoutContentType.headers.get("content-type"), null)
    const cases = [
      ["wrong media type", routeRequest(DESCRIPTOR_BODY, { headers: { "content-type": "text/plain" } })],
      ["missing media type", requestWithoutContentType],
      ["declared oversize", routeRequest(DESCRIPTOR_BODY, { headers: { "content-length": "4097" } })],
      ["decimal declared length", routeRequest(DESCRIPTOR_BODY, { headers: { "content-length": "12.5" } })],
      ["nonnumeric declared length", routeRequest(DESCRIPTOR_BODY, { headers: { "content-length": "not-a-number" } })],
      ["streamed oversize", routeRequest({ ...DESCRIPTOR_BODY, padding: "x".repeat(4096) }, { stream: true })],
      ["non-object JSON", routeRequest([])],
    ]

    const results = []
    for (const [label, request] of cases) {
      const route = loadAvailabilityRoute()
      const response = await postAvailabilityRequest(route, request)
      results.push({
        label,
        status: response.status,
        practiceReads: route.practiceReads.length,
        limiterCalls: route.limiterCalls.length,
        downstreamEvents: route.events.filter((event) => /descriptor|session|network|limiter|cache|policy|solver/.test(event)),
      })
    }

    assert.deepEqual(results, cases.map(([label]) => ({
      label,
      status: 400,
      practiceReads: 0,
      limiterCalls: 0,
      downstreamEvents: [],
    })))
  })

  it("availability enforces canonical 191-character identifiers before downstream work", async () => {
    const acceptedIdentifier = "a".repeat(191)
    const acceptedRoute = loadAvailabilityRoute()
    const acceptedResponse = await postAvailability(acceptedRoute, {
      primaryServiceVariantId: acceptedIdentifier,
      addOnServiceVariantIds: [acceptedIdentifier],
      requestedPressureLevel: 3,
      preferredProviderId: acceptedIdentifier,
    })

    assert.equal(acceptedResponse.status, 200)
    assert.equal(acceptedRoute.practiceReads.length, 2)
    assert.equal(acceptedRoute.limiterCalls.length, 1)
    assert.equal(acceptedRoute.solverCalls.length, 1)

    for (const body of [
      { ...DESCRIPTOR_BODY, primaryServiceVariantId: "a".repeat(192) },
      { ...DESCRIPTOR_BODY, addOnServiceVariantIds: ["a".repeat(192)] },
      { ...DESCRIPTOR_BODY, preferredProviderId: "a".repeat(192) },
    ]) {
      const route = loadAvailabilityRoute()
      const response = await postAvailability(route, body)

      assert.equal(response.status, 400)
      assert.deepEqual(route.practiceReads, [])
      assert.deepEqual(route.limiterCalls, [])
      assert.doesNotMatch(route.events.join(","), /descriptor|session|network|limiter|cache|policy|solver/)
    }
  })

  it("availability counts raw identifier characters before trimming for every descriptor ID", async () => {
    const rawOversizeIdentifier = `${"a".repeat(191)} `
    assert.equal(rawOversizeIdentifier.length, 192)

    for (const body of [
      { ...DESCRIPTOR_BODY, primaryServiceVariantId: rawOversizeIdentifier },
      { ...DESCRIPTOR_BODY, addOnServiceVariantIds: [rawOversizeIdentifier] },
      { ...DESCRIPTOR_BODY, preferredProviderId: rawOversizeIdentifier },
    ]) {
      const route = loadAvailabilityRoute()
      const response = await postAvailability(route, body)

      assert.equal(response.status, 400)
      assert.deepEqual(route.practiceReads, [])
      assert.deepEqual(route.limiterCalls, [])
      assert.doesNotMatch(route.events.join(","), /descriptor|session|network|limiter|cache|policy|solver/)
    }
  })

  it("availability rejects more than the public add-on maximum before normalizing or downstream work", async () => {
    const acceptedRoute = loadAvailabilityRoute()
    const acceptedResponse = await postAvailability(acceptedRoute, {
      ...DESCRIPTOR_BODY,
      addOnServiceVariantIds: ["add-1", "add-2", "add-3"],
    })

    assert.equal(acceptedResponse.status, 200)
    assert.equal(acceptedRoute.practiceReads.length, 2)
    assert.equal(acceptedRoute.limiterCalls.length, 1)
    assert.deepEqual(acceptedRoute.solverCalls[0].addOnServiceVariantIds, ["add-1", "add-2", "add-3"])

    const rejectedRoute = loadAvailabilityRoute()
    const rejectedResponse = await postAvailability(rejectedRoute, {
      ...DESCRIPTOR_BODY,
      addOnServiceVariantIds: ["add-1", "add-2", "add-3", "add-4"],
    })

    assert.equal(rejectedResponse.status, 400)
    assert.deepEqual(rejectedRoute.practiceReads, [])
    assert.deepEqual(rejectedRoute.limiterCalls, [])
    assert.doesNotMatch(rejectedRoute.events.join(","), /descriptor|session|network|limiter|cache|policy|solver/)
  })

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
