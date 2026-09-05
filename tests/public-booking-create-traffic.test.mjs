import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

import { PUBLIC_SEQUENCE_PICKER_MAX_OPTIONS } from "../lib/public-booking-sequences.js"
import { safeErrorCode } from "../lib/safe-error-code.js"
import { createCompiledModuleLoader } from "./helpers/compiled-module.mjs"

const loadCompiledModule = createCompiledModuleLoader(import.meta.url)
const [
  publicBookingActionsSource,
  actionStateSource,
  publicRequestIdSource,
  publicRequestOwnerSource,
  publicBookingIdempotencySource,
] = await Promise.all([
  readFile(new URL("../app/calendar/actions/public-booking.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/calendar/actions/public-booking-state.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/public-request-id.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/public-request-owner.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/public-booking-idempotency.ts", import.meta.url), "utf8"),
])

const publicRequestIdModule = loadCompiledModule(
  publicRequestIdSource,
  "lib/public-request-id.booking-create-traffic-test.ts",
)
const publicRequestOwnerModule = loadCompiledModule(
  publicRequestOwnerSource,
  "lib/public-request-owner.booking-create-traffic-test.ts",
  {
    "server-only": {},
    "./public-request-id.ts": publicRequestIdModule,
  },
)
const publicBookingIdempotencyModule = loadCompiledModule(
  publicBookingIdempotencySource,
  "lib/public-booking-idempotency.booking-create-traffic-test.ts",
  {
    "server-only": {},
    "./public-request-id.ts": publicRequestIdModule,
    "./public-request-owner.ts": publicRequestOwnerModule,
  },
)
const publicBookingStateModule = loadCompiledModule(
  actionStateSource,
  "app/calendar/actions/public-booking-state.booking-create-traffic-test.ts",
)

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
  allowGuestBooking = true,
  failFirstTransaction = false,
  failLimiterPersistence = false,
  limiterFailureCode = null,
  retryFirstSerializableAttempt = false,
  staleConflictCode = "P2034",
  failLimiterUniqueWithoutWinner = false,
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
  let limiterFailuresRemaining = typeof failLimiterPersistence === "number"
    ? failLimiterPersistence
    : failLimiterPersistence ? 1 : 0
  let shouldRetrySerializable = retryFirstSerializableAttempt
  let shouldFailLimiterUnique = failLimiterUniqueWithoutWinner
  let revision = 0
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
    quotaCharges: 0,
  }

  function findRow(query, event, rows = bookingRows) {
    events.push(event)
    const prefix = query.where.id.startsWith
    return rows.find((row) => row.id.startsWith(prefix)) ?? null
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
      const startRevision = revision
      const bookingSnapshot = bookingRows.map((row) => ({ ...row }))
      const clientSnapshot = new Map([...clients].map(([id, client]) => [id, { ...client }]))
      const staged = {
        bookingRows: [],
        clients: new Map(),
        calendarEvents: 0,
        appointments: 0,
        notifications: 0,
        contactWrites: 0,
        quotaCharges: 0,
      }
      let release = null
      const visibleClients = () => new Map([...clientSnapshot, ...staged.clients]).values()
      const tx = {
        __staged: staged,
        __startRevision: startRevision,
        async $queryRaw(_strings, ...values) {
          assert.match(values[0], /^public-booking-v1:/)
          release = await mutex.acquire()
          events.push("tx-lock")
          return []
        },
        practice: prisma.practice,
        practiceMembership: prisma.practiceMembership,
        bookingGroup: {
          async findFirst(query) {
            return findRow(query, "replay-transaction", [...bookingSnapshot, ...staged.bookingRows])
          },
          async create({ data }) {
            events.push("group-create")
            if (bookingRows.some((row) => row.id === data.id)) {
              const error = new Error("exact owner id unique conflict")
              error.code = "P2002"
              throw error
            }
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
            return [...visibleClients()].find((client) => (
              client.id === where.id
              || (client.userId === null && client.email === where.email)
            )) ?? null
          },
          async update({ where, data }) {
            events.push("contact-write")
            staged.contactWrites += 1
            const existing = staged.clients.get(where.id) ?? clientSnapshot.get(where.id)
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
            const existing = [...visibleClients()].find((client) => (
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
        if (shouldRetrySerializable) {
          shouldRetrySerializable = false
          const error = new Error("injected serialization conflict")
          error.code = "P2034"
          throw error
        }
        const dirty = staged.quotaCharges > 0
          || staged.bookingRows.length > 0
          || staged.clients.size > 0
          || staged.calendarEvents > 0
          || staged.appointments > 0
          || staged.notifications > 0
        if (dirty && startRevision !== revision) {
          const error = new Error("snapshot serialization conflict")
          error.code = "P2034"
          throw error
        }
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
        durable.quotaCharges += staged.quotaCharges
        if (dirty) revision += 1
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
      "@/lib/commerce/transactions": {
        async runCommerceTransaction(client, callback) {
          for (let attempt = 0; attempt < 3; attempt += 1) {
            events.push("transaction")
            assert.equal(client, prisma)
            try {
              return await client.$transaction(callback, { isolationLevel: "Serializable" })
            } catch (error) {
              if (error?.code !== "P2034" || attempt === 2) throw error
            }
          }
        },
      },
      "@/lib/operational-rate-limit": {
        async consumeOperationalRateLimitInTransaction(input) {
          events.push("limiter")
          assert.ok(input.transaction, "expected the caller-owned transaction")
          limiterCalls.push({
            operation: input.operation,
            networkIdentifier: input.networkIdentifier,
            practiceId: input.practiceId,
            owner: input.owner,
          })
          if (input.transaction.__startRevision !== revision && staleConflictCode) {
            const error = new Error("stale limiter snapshot")
            error.code = staleConflictCode
            throw error
          }
          if (shouldFailLimiterUnique) {
            shouldFailLimiterUnique = false
            const error = new Error("unrelated unique conflict")
            error.code = "P2002"
            throw error
          }
          if (limiterFailuresRemaining > 0) {
            limiterFailuresRemaining -= 1
            input.transaction.__staged.quotaCharges += 1
            const error = new Error("injected limiter persistence failure")
            if (limiterFailureCode) error.code = limiterFailureCode
            throw error
          }
          if (limiterDecision.allowed) input.transaction.__staged.quotaCharges += 1
          return limiterDecision
        },
      },
      "@/lib/prisma": { prisma },
      "@/lib/safe-error-code": { safeErrorCode },
      "@/lib/public-booking-idempotency": publicBookingIdempotencyModule,
      "@/lib/public-booking-sequences": {
        PUBLIC_SEQUENCE_PICKER_MAX_OPTIONS,
        async publicBookingSequenceOptions(input) {
          events.push("solver")
          assert.ok(input.db, "expected the solver to use the caller-owned transaction")
          solverCallCount += 1
          if (dropSecondSolverOptionAfterCommit && solverCallCount === 2) await firstCommit
          return {
            allowGuestBooking,
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
    assert.ok(action.events.indexOf("replay-preflight") < action.events.indexOf("transaction"))
    assert.ok(action.events.indexOf("transaction") < action.events.indexOf("tx-lock"))
    assert.ok(action.events.indexOf("replay-transaction") < action.events.indexOf("limiter"))
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
        quotaCharges: 0,
      })
      assert.doesNotMatch(action.events.join(","), /solver|staff-read|contact-|group-create|event-create|notification-write|google-push|revalidate/)
    }
  })

  it("locks and rechecks before contact or calendar writes, then runs downstream work only after commit", async () => {
    const action = loadBookingCreateAction()
    const result = await action.requestBookingSequence({ status: "IDLE" }, bookingForm())

    assert.equal(result.status, "SUCCESS")
    const ordered = action.events.filter((event) => [
      "tx-lock",
      "replay-transaction",
      "limiter",
      "solver",
      "staff-read",
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
      "limiter",
      "solver",
      "staff-read",
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
    assert.equal(same.durable.quotaCharges, 1)
    assert.equal(same.events.filter((event) => event === "transaction").length, 3)

    const changed = loadBookingCreateAction()
    const changedResults = await Promise.all([
      changed.requestBookingSequence({ status: "IDLE" }, bookingForm()),
      changed.requestBookingSequence({ status: "IDLE" }, bookingForm({ requestedPressureLevel: "4" })),
    ])
    assert.deepEqual(changedResults.map((result) => result.status).sort(), ["CONFLICT", "SUCCESS"])
    assert.equal(changed.bookingRows.length, 1)
    assert.equal(changed.durable.calendarEvents, 2)
    assert.equal(changed.durable.revalidations, 1)
    assert.equal(changed.durable.quotaCharges, 1)
    assert.equal(changed.events.filter((event) => event === "transaction").length, 3)
  })

  it("reconciles an expected stale-snapshot P2002 but fails closed on an unrelated unique conflict", async () => {
    const same = loadBookingCreateAction({ staleConflictCode: null })
    const sameResults = await Promise.all([
      same.requestBookingSequence({ status: "IDLE" }, bookingForm()),
      same.requestBookingSequence({ status: "IDLE" }, bookingForm()),
    ])
    assert.deepEqual(sameResults.map((result) => result.status), ["SUCCESS", "SUCCESS"])
    assert.equal(same.bookingRows.length, 1)
    assert.equal(same.durable.quotaCharges, 1)
    assert.equal(same.durable.revalidations, 1)
    assert.equal(same.durable.pushes, 2)
    assert.equal(same.events.filter((event) => event === "group-create").length, 2)
    assert.equal(same.events.filter((event) => event === "transaction").length, 2)

    const changed = loadBookingCreateAction()
    const changedResults = await Promise.all([
      changed.requestBookingSequence({ status: "IDLE" }, bookingForm()),
      changed.requestBookingSequence({ status: "IDLE" }, bookingForm({ requestedPressureLevel: "4" })),
    ])
    assert.deepEqual(changedResults.map((result) => result.status).sort(), ["CONFLICT", "SUCCESS"])
    assert.equal(changed.bookingRows.length, 1)
    assert.equal(changed.durable.quotaCharges, 1)

    const unrelated = loadBookingCreateAction({ failLimiterUniqueWithoutWinner: true })
    assert.deepEqual(
      await unrelated.requestBookingSequence({ status: "IDLE" }, bookingForm()),
      publicBookingStateModule.publicBookingUnavailable(),
    )
    assert.equal(unrelated.bookingRows.length, 0)
    assert.equal(unrelated.durable.quotaCharges, 0)
    assert.equal(unrelated.events.filter((event) => event === "group-create").length, 0)
  })

  it("recovers an exact concurrent replay when the committed booking removes the second solver option", async () => {
    const action = loadBookingCreateAction({ dropSecondSolverOptionAfterCommit: true })
    const results = await Promise.all([
      action.requestBookingSequence({ status: "IDLE" }, bookingForm()),
      action.requestBookingSequence({ status: "IDLE" }, bookingForm()),
    ])
    assert.deepEqual(results.map((result) => result.status), ["SUCCESS", "SUCCESS"])
    assert.equal(action.bookingRows.length, 1)
    assert.deepEqual(action.durable, { calendarEvents: 2, appointments: 2, notifications: 2, pushes: 2, revalidations: 1, contactWrites: 1, quotaCharges: 1 })
    assert.equal(action.events.filter((event) => event === "solver").length, 1)
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
    assert.equal(action.durable.quotaCharges, 0)

    const second = await action.requestBookingSequence({ status: "IDLE" }, bookingForm())
    assert.equal(second.status, "SUCCESS")
    assert.equal(action.bookingRows.length, 1)
    assert.equal(action.bookingRows[0].id, publicBookingIdempotencyModule.publicBookingRequestOwner(bookingSelection()).id)
    assert.equal(action.durable.calendarEvents, 2)
    assert.equal(action.durable.pushes, 2)
    assert.equal(action.durable.revalidations, 1)
    assert.equal(action.durable.quotaCharges, 1)
  })

  it("rolls limiter persistence failures back with all booking work", async () => {
    const action = loadBookingCreateAction({ failLimiterPersistence: 2, limiterFailureCode: "P1001" })
    const errors = []
    const originalError = console.error
    console.error = (...args) => errors.push(args)

    try {
      assert.deepEqual(
        await action.requestBookingSequence({ status: "IDLE" }, bookingForm()),
        publicBookingStateModule.publicBookingUnavailable(),
      )
      assert.deepEqual(
        await action.requestBookingSequence({ status: "IDLE" }, bookingForm()),
        publicBookingStateModule.publicBookingUnavailable(),
      )
    } finally {
      console.error = originalError
    }
    assert.equal(action.durable.quotaCharges, 0)
    assert.equal(action.bookingRows.length, 0)
    assert.doesNotMatch(action.events.join(","), /solver|contact-|group-create|event-create|google-push|revalidate/)
    assert.deepEqual(errors, [[
      "Public booking action unavailable.",
      { operation: "BOOKING_CREATE", failureClass: "PERSISTENCE", code: "P1001" },
    ]])
    assert.doesNotMatch(JSON.stringify(errors), /injected|request|owner|guest|example|network-1/i)
  })

  it("classifies a known public policy rejection without logging request or error data", async () => {
    const action = loadBookingCreateAction({ allowGuestBooking: false })
    const errors = []
    const originalError = console.error
    console.error = (...args) => errors.push(args)

    try {
      assert.deepEqual(
        await action.requestBookingSequence({ status: "IDLE" }, bookingForm()),
        publicBookingStateModule.publicBookingUnavailable(),
      )
    } finally {
      console.error = originalError
    }

    assert.deepEqual(errors, [[
      "Public booking action unavailable.",
      { operation: "BOOKING_CREATE", failureClass: "POLICY", code: "unexpected_error" },
    ]])
    assert.doesNotMatch(JSON.stringify(errors), /sign in|practice-1|request|owner|guest|example|network-1/i)
  })

  it("retries the complete Serializable unit without double-charging quota or post-commit work", async () => {
    const action = loadBookingCreateAction({ retryFirstSerializableAttempt: true })

    assert.equal((await action.requestBookingSequence({ status: "IDLE" }, bookingForm())).status, "SUCCESS")
    assert.equal(action.events.filter((event) => event === "transaction").length, 2)
    assert.equal(action.limiterCalls.length, 2)
    assert.equal(action.durable.quotaCharges, 1)
    assert.equal(action.bookingRows.length, 1)
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
