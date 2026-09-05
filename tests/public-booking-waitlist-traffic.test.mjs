import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

import { safeErrorCode } from "../lib/safe-error-code.js"
import { createCompiledModuleLoader } from "./helpers/compiled-module.mjs"

const actionSource = await readFile(
  new URL("../app/calendar/actions/public-booking.ts", import.meta.url),
  "utf8",
)
const [
  actionStateSource,
  publicRequestIdSource,
  publicRequestOwnerSource,
  publicBookingIdempotencySource,
] = await Promise.all([
  readFile(new URL("../app/calendar/actions/public-booking-state.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/public-request-id.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/public-request-owner.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/public-booking-idempotency.ts", import.meta.url), "utf8"),
])
const loadCompiledModule = createCompiledModuleLoader(import.meta.url)
const publicRequestIdModule = loadCompiledModule(
  publicRequestIdSource,
  "lib/public-request-id.waitlist-traffic-test.ts",
)
const publicRequestOwnerModule = loadCompiledModule(
  publicRequestOwnerSource,
  "lib/public-request-owner.waitlist-traffic-test.ts",
  {
    "server-only": {},
    "./public-request-id.ts": publicRequestIdModule,
  },
)
const publicBookingIdempotencyModule = loadCompiledModule(
  publicBookingIdempotencySource,
  "lib/public-booking-idempotency.waitlist-traffic-test.ts",
  {
    "server-only": {},
    "./public-request-id.ts": publicRequestIdModule,
    "./public-request-owner.ts": publicRequestOwnerModule,
  },
)
const publicBookingStateModule = loadCompiledModule(
  actionStateSource,
  "app/calendar/actions/public-booking-state.waitlist-traffic-test.ts",
)

const WAITLIST_REQUEST_ID = "223e4567-e89b-42d3-a456-426614174000"
const PREFERRED_START = "2026-09-03T14:00:00.000Z"

function waitlistForm(overrides = {}) {
  const values = {
    requestId: WAITLIST_REQUEST_ID,
    practiceId: "practice-1",
    primaryServiceVariantId: "primary-60",
    addOnServiceVariantIds: ["addon-20", "addon-15"],
    requestedPressureLevel: "3",
    preferredProviderId: "provider-1",
    preferredStartsAt: PREFERRED_START,
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

function waitlistSelection(overrides = {}) {
  return {
    requestId: WAITLIST_REQUEST_ID,
    primaryServiceVariantId: "primary-60",
    addOnServiceVariantIds: ["addon-15", "addon-20"],
    requestedPressureLevel: 3,
    preferredStartsAt: PREFERRED_START,
    preferredProviderId: "provider-1",
    ...overrides,
  }
}

function storedWaitlistRow({
  selection = waitlistSelection(),
  practiceId = "practice-1",
  userId = null,
  guestEmail = "guest@example.com",
  status = "OPEN",
  convertedBookingGroupId = null,
  requestedPressureLevel = selection.requestedPressureLevel,
  primaryServiceVariantId = selection.primaryServiceVariantId,
  addOnServiceVariantIds = selection.addOnServiceVariantIds,
  preferredProviderId = selection.preferredProviderId || null,
  preferredStartsAt = selection.preferredStartsAt ? new Date(selection.preferredStartsAt) : null,
} = {}) {
  const owner = publicBookingIdempotencyModule.publicWaitlistRequestOwner(selection)
  return {
    id: owner.id,
    practiceId,
    practiceClientId: userId ? "client-account" : "client-guest",
    createdById: userId,
    status,
    requestedPressureLevel,
    primaryServiceVariantId,
    addOnServiceVariantIds,
    preferredProviderId,
    preferredStartsAt,
    convertedBookingGroupId,
    practiceClient: {
      userId,
      email: userId ? "account@example.com" : guestEmail,
    },
  }
}

function createPrefixMutex() {
  let locked = false
  const waiters = []
  return {
    async acquire() {
      if (locked) await new Promise((resolve) => waiters.push(resolve))
      else locked = true
      return () => {
        const next = waiters.shift()
        if (next) next()
        else locked = false
      }
    },
  }
}

function loadWaitlistAction({
  sessionUserId = null,
  limiterDecision = { allowed: true },
  existingRows = [],
  hasBookableOption = false,
  failFirstTransaction = false,
  failFirstRevalidation = false,
  failLimiterPersistence = false,
  retryFirstSerializableAttempt = false,
  staleConflictCode = "P2034",
  failLimiterUniqueWithoutWinner = false,
} = {}) {
  const events = []
  const limiterCalls = []
  const waitlistRows = [...existingRows]
  const clients = new Map()
  for (const row of waitlistRows) {
    clients.set(row.practiceClientId, { id: row.practiceClientId, ...row.practiceClient })
  }
  const mutex = createPrefixMutex()
  let nextId = 1
  let shouldFailTransaction = failFirstTransaction
  let shouldFailRevalidation = failFirstRevalidation
  let limiterFailuresRemaining = typeof failLimiterPersistence === "number"
    ? failLimiterPersistence
    : failLimiterPersistence ? 1 : 0
  let shouldRetrySerializable = retryFirstSerializableAttempt
  let shouldFailLimiterUnique = failLimiterUniqueWithoutWinner
  let revision = 0
  const durable = {
    entries: waitlistRows.length,
    contactWrites: 0,
    revalidations: 0,
    quotaCharges: 0,
  }

  function findRow(query, event, rows = waitlistRows) {
    events.push(event)
    const prefix = query.where.id.startsWith
    return rows.find((row) => row.id.startsWith(prefix)) ?? null
  }

  const prisma = {
    bookingWaitlistEntry: {
      async findFirst(query) {
        return findRow(query, "replay-preflight")
      },
    },
    bookingGroup: {
      async findFirst() {
        throw new Error("booking replay is outside the waitlist harness")
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
        throw new Error("booking staff reads are outside the waitlist harness")
      },
    },
    async $transaction(callback) {
      const startRevision = revision
      const waitlistSnapshot = waitlistRows.map((row) => ({ ...row }))
      const clientSnapshot = new Map([...clients].map(([id, client]) => [id, { ...client }]))
      const staged = {
        waitlistRows: [],
        clients: new Map(),
        contactWrites: 0,
        quotaCharges: 0,
      }
      let release = null
      const visibleClients = () => new Map([...clientSnapshot, ...staged.clients]).values()
      const tx = {
        __staged: staged,
        __startRevision: startRevision,
        async $queryRaw(_strings, ...values) {
          assert.match(values[0], /^public-waitlist-v1:/)
          release = await mutex.acquire()
          events.push("tx-lock")
          return []
        },
        practice: prisma.practice,
        bookingWaitlistEntry: {
          async findFirst(query) {
            return findRow(query, "replay-transaction", [...waitlistSnapshot, ...staged.waitlistRows])
          },
          async create({ data }) {
            events.push("entry-create")
            if (shouldFailTransaction) {
              shouldFailTransaction = false
              throw new Error("injected transaction failure")
            }
            if (waitlistRows.some((row) => row.id === data.id)) {
              const error = new Error("exact owner id unique conflict")
              error.code = "P2002"
              throw error
            }
            const row = {
              ...data,
              id: data.id ?? "generated-waitlist-" + nextId++,
              status: "OPEN",
              convertedBookingGroupId: null,
            }
            staged.waitlistRows.push(row)
            return row
          },
          async updateMany() {
            throw new Error("staff conversion is outside the waitlist harness")
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
            const client = { ...(staged.clients.get(where.id) ?? clientSnapshot.get(where.id)), ...data }
            staged.clients.set(client.id, client)
            return client
          },
          async create({ data }) {
            events.push("contact-write")
            staged.contactWrites += 1
            const client = { id: "client-" + nextId++, ...data }
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
              : { id: "client-" + nextId++, ...create }
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
          || staged.waitlistRows.length > 0
          || staged.clients.size > 0
        if (dirty && startRevision !== revision) {
          const error = new Error("snapshot serialization conflict")
          error.code = "P2034"
          throw error
        }
        for (const [id, client] of staged.clients) clients.set(id, client)
        for (const row of staged.waitlistRows) {
          const practiceClient = clients.get(row.practiceClientId)
          waitlistRows.push({ ...row, practiceClient })
        }
        durable.entries += staged.waitlistRows.length
        durable.contactWrites += staged.contactWrites
        durable.quotaCharges += staged.quotaCharges
        if (dirty) revision += 1
        return result
      } finally {
        release?.()
      }
    },
  }

  const action = loadCompiledModule(
    actionSource,
    "app/calendar/actions/public-booking.waitlist-traffic-test.ts",
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
          throw new Error("Google push is outside the waitlist harness")
        },
      },
      "@/lib/calendar-flows": {
        buildCalendarCreationPlan() {
          throw new Error("calendar creation is outside the waitlist harness")
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
            throw new Error("injected limiter persistence failure")
          }
          if (limiterDecision.allowed) input.transaction.__staged.quotaCharges += 1
          return limiterDecision
        },
      },
      "@/lib/prisma": { prisma },
      "@/lib/safe-error-code": { safeErrorCode },
      "@/lib/public-booking-idempotency": publicBookingIdempotencyModule,
      "@/lib/public-booking-sequences": {
        PUBLIC_SEQUENCE_PICKER_MAX_OPTIONS: 8,
        async publicBookingSequenceOptions(input) {
          events.push("solver")
          assert.equal(input.maxOptions, 1)
          assert.ok(input.db, "expected the solver to use the caller-owned transaction")
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
            providers: [],
            variants: [],
            options: hasBookableOption ? [{ startsAt: PREFERRED_START }] : [],
          }
        },
      },
      "@/lib/public-booking-url": {
        publicBookingPathForPractice(practice) {
          events.push("public-path")
          return practice.publicBookingStateSlug && practice.publicBookingSlug
            ? "/book/" + practice.publicBookingStateSlug + "/" + practice.publicBookingSlug
            : "/book/" + practice.slug
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
        assertNoCalendarEventConflict: async () => {},
        assertNoResourceConflict: async () => {},
        assertProviderAvailability: async () => {},
        lockAppointmentSchedulingRows: async () => {},
      },
      "./audit": { writeCalendarAuditAndNotifications: async () => {} },
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
        serviceSnapshotForCreate: () => ({}),
      },
      "./public-booking-state": publicBookingStateModule,
    },
  )

  return {
    ...action,
    durable,
    events,
    limiterCalls,
    waitlistRows,
  }
}

describe("public booking waitlist traffic", () => {
  it("validates canonical bounded waitlist input before replay, quota, or protected reads", async () => {
    for (const formData of [
      waitlistForm({ requestId: "not-a-canonical-uuid" }),
      waitlistForm({ requestId: " " + WAITLIST_REQUEST_ID }),
      waitlistForm({ practiceId: "x".repeat(192) }),
      waitlistForm({ primaryServiceVariantId: "x".repeat(192) }),
      waitlistForm({ addOnServiceVariantIds: ["x".repeat(192)] }),
      waitlistForm({ preferredProviderId: "x".repeat(192) }),
      waitlistForm({ preferredStartsAt: "not-a-date" }),
      waitlistForm({ preferredStartsAt: "2026-09-03T14:00:00Z" }),
      waitlistForm({ preferredStartsAt: ` ${PREFERRED_START}` }),
      waitlistForm({ guestName: "x".repeat(192) }),
      waitlistForm({ guestEmail: "x".repeat(255) }),
      waitlistForm({ guestPhone: "x".repeat(192) }),
    ]) {
      const action = loadWaitlistAction()
      const result = await action.joinBookingWaitlist({ status: "IDLE" }, formData)

      assert.deepEqual(result, publicBookingStateModule.publicBookingValidationError())
      assert.deepEqual(action.limiterCalls, [])
      assert.doesNotMatch(
        action.events.join(","),
        /network|replay-|readiness|solver|contact-|tx-lock|entry-create|revalidate/,
      )
    }
  })

  it("replays exact guest requests including converted entries and an empty preferred start", async () => {
    for (const input of [
      {
        row: storedWaitlistRow({ status: "BOOKED", convertedBookingGroupId: "group-1" }),
        form: waitlistForm(),
      },
      {
        row: storedWaitlistRow({
          selection: waitlistSelection({ preferredStartsAt: "", preferredProviderId: "" }),
          preferredStartsAt: null,
          preferredProviderId: null,
        }),
        form: waitlistForm({ preferredStartsAt: "", preferredProviderId: "" }),
      },
    ]) {
      const action = loadWaitlistAction({ existingRows: [input.row] })
      const result = await action.joinBookingWaitlist({ status: "IDLE" }, input.form)

      assert.deepEqual(
        result,
        publicBookingStateModule.publicBookingSuccess("/book/practice-slug?waitlist=joined"),
      )
      assert.deepEqual(action.limiterCalls, [])
      assert.deepEqual(
        action.events.filter((event) => event === "replay-preflight" || event === "practice-path"),
        ["replay-preflight", "practice-path"],
      )
      assert.doesNotMatch(
        action.events.join(","),
        /solver|contact-|entry-create|revalidate/,
      )
    }
  })

  it("requires both authoritative signed-in owner mappings for replay", async () => {
    const accepted = loadWaitlistAction({
      sessionUserId: "account-1",
      existingRows: [storedWaitlistRow({ userId: "account-1" })],
    })
    assert.equal(
      (await accepted.joinBookingWaitlist({ status: "IDLE" }, waitlistForm())).status,
      "SUCCESS",
    )

    for (const row of [
      { ...storedWaitlistRow({ userId: "account-1" }), createdById: "other-account" },
      {
        ...storedWaitlistRow({ userId: "account-1" }),
        practiceClient: { userId: "other-account", email: "other@example.com" },
      },
    ]) {
      const action = loadWaitlistAction({ sessionUserId: "account-1", existingRows: [row] })
      assert.deepEqual(
        await action.joinBookingWaitlist({ status: "IDLE" }, waitlistForm()),
        publicBookingStateModule.publicBookingConflict(),
      )
      assert.deepEqual(action.limiterCalls, [])
    }
  })

  it("maps changed selection, owner, practice, or persisted evidence to generic conflict", async () => {
    const inputs = [
      { row: storedWaitlistRow(), form: waitlistForm({ requestedPressureLevel: "4" }) },
      { row: storedWaitlistRow({ guestEmail: "other@example.com" }), form: waitlistForm() },
      { row: storedWaitlistRow({ practiceId: "other-practice" }), form: waitlistForm() },
      { row: storedWaitlistRow({ primaryServiceVariantId: "other-primary" }), form: waitlistForm() },
      { row: storedWaitlistRow({ addOnServiceVariantIds: ["other-addon"] }), form: waitlistForm() },
      { row: storedWaitlistRow({ preferredProviderId: "other-provider" }), form: waitlistForm() },
      {
        row: storedWaitlistRow({
          preferredStartsAt: new Date("2026-09-04T14:00:00.000Z"),
        }),
        form: waitlistForm(),
      },
    ]
    for (const input of inputs) {
      const action = loadWaitlistAction({ existingRows: [input.row] })
      assert.deepEqual(
        await action.joinBookingWaitlist({ status: "IDLE" }, input.form),
        publicBookingStateModule.publicBookingConflict(),
      )
      assert.deepEqual(action.limiterCalls, [])
      assert.doesNotMatch(
        action.events.join(","),
        /practice-path|readiness|solver|contact-|tx-lock|entry-create|revalidate/,
      )
    }
  })

  it("locks and rechecks before consuming quota and performing availability or contact work", async () => {
    const guest = loadWaitlistAction()
    assert.equal(
      (await guest.joinBookingWaitlist({ status: "IDLE" }, waitlistForm())).status,
      "SUCCESS",
    )
    assert.deepEqual(guest.limiterCalls, [{
      operation: "WAITLIST_JOIN",
      networkIdentifier: "network-1",
      practiceId: "practice-1",
      owner: { kind: "GUEST_EMAIL", value: "guest@example.com" },
    }])
    assert.ok(guest.events.indexOf("replay-preflight") < guest.events.indexOf("transaction"))
    assert.ok(guest.events.indexOf("transaction") < guest.events.indexOf("tx-lock"))
    assert.ok(guest.events.indexOf("replay-transaction") < guest.events.indexOf("limiter"))
    assert.ok(guest.events.indexOf("limiter") < guest.events.indexOf("solver"))
    assert.ok(guest.events.indexOf("limiter") < guest.events.indexOf("contact-read"))

    const account = loadWaitlistAction({ sessionUserId: "account-1" })
    assert.equal(
      (await account.joinBookingWaitlist({ status: "IDLE" }, waitlistForm())).status,
      "SUCCESS",
    )
    assert.deepEqual(account.limiterCalls[0].owner, {
      kind: "ACCOUNT_ID",
      value: "account-1",
    })
    assert.doesNotMatch(account.waitlistRows[0].id, /account-1|guest|example|555/)
  })

  it("maps quota denial and outage without availability, contact, entry, or revalidation work", async () => {
    for (const input of [
      {
        decision: { allowed: false, reason: "RATE_LIMITED", retryAfterSeconds: 47 },
        expected: publicBookingStateModule.publicBookingRateLimited(47),
      },
      {
        decision: { allowed: false, reason: "UNAVAILABLE" },
        expected: publicBookingStateModule.publicBookingUnavailable(),
      },
    ]) {
      const action = loadWaitlistAction({ limiterDecision: input.decision })
      assert.deepEqual(
        await action.joinBookingWaitlist({ status: "IDLE" }, waitlistForm()),
        input.expected,
      )
      assert.deepEqual(action.durable, {
        entries: 0,
        contactWrites: 0,
        revalidations: 0,
        quotaCharges: 0,
      })
      assert.doesNotMatch(
        action.events.join(","),
        /solver|contact-|entry-create|revalidate/,
      )
    }
  })

  it("returns generic conflict after allowance when a current booking option exists", async () => {
    const action = loadWaitlistAction({ hasBookableOption: true })
    const result = await action.joinBookingWaitlist({ status: "IDLE" }, waitlistForm())

    assert.deepEqual(result, publicBookingStateModule.publicBookingConflict())
    assert.equal(action.limiterCalls.length, 1)
    assert.deepEqual(action.durable, {
      entries: 0,
      contactWrites: 0,
      revalidations: 0,
      quotaCharges: 0,
    })
    assert.doesNotMatch(action.events.join(","), /contact-|entry-create|revalidate/)
  })

  it("locks and rechecks before contact and explicit waitlist owner creation", async () => {
    const action = loadWaitlistAction()
    const result = await action.joinBookingWaitlist({ status: "IDLE" }, waitlistForm())

    assert.equal(result.status, "SUCCESS")
    assert.deepEqual(action.events.filter((event) => [
      "tx-lock",
      "replay-transaction",
      "limiter",
      "solver",
      "contact-read",
      "contact-write",
      "entry-create",
      "revalidate",
    ].includes(event)), [
      "tx-lock",
      "replay-transaction",
      "limiter",
      "solver",
      "contact-read",
      "contact-write",
      "entry-create",
      "revalidate",
    ])
    assert.equal(
      action.waitlistRows[0].id,
      publicBookingIdempotencyModule.publicWaitlistRequestOwner(waitlistSelection()).id,
    )
  })

  it("serializes concurrent same and changed waitlist selections under one prefix", async () => {
    const same = loadWaitlistAction()
    const sameResults = await Promise.all([
      same.joinBookingWaitlist({ status: "IDLE" }, waitlistForm()),
      same.joinBookingWaitlist({ status: "IDLE" }, waitlistForm()),
    ])
    assert.deepEqual(sameResults.map((result) => result.status), ["SUCCESS", "SUCCESS"])
    assert.deepEqual(same.durable, {
      entries: 1,
      contactWrites: 1,
      revalidations: 1,
      quotaCharges: 1,
    })

    assert.equal(same.events.filter((event) => event === "transaction").length, 3)
    const changed = loadWaitlistAction()
    const changedResults = await Promise.all([
      changed.joinBookingWaitlist({ status: "IDLE" }, waitlistForm()),
      changed.joinBookingWaitlist(
        { status: "IDLE" },
        waitlistForm({ requestedPressureLevel: "4" }),
      ),
    ])
    assert.deepEqual(
      changedResults.map((result) => result.status).sort(),
      ["CONFLICT", "SUCCESS"],
    )
    assert.deepEqual(changed.durable, {
      entries: 1,
      contactWrites: 1,
      revalidations: 1,
      quotaCharges: 1,
    })
    assert.equal(changed.events.filter((event) => event === "transaction").length, 3)
  })

  it("rolls back a failed waitlist transaction so the same request can retry", async () => {
    const action = loadWaitlistAction({ failFirstTransaction: true })
    assert.deepEqual(
      await action.joinBookingWaitlist({ status: "IDLE" }, waitlistForm()),
      publicBookingStateModule.publicBookingUnavailable(),
    )
    assert.deepEqual(action.durable, {
      entries: 0,
      contactWrites: 0,
      revalidations: 0,
      quotaCharges: 0,
    })
    assert.equal(action.waitlistRows.length, 0)

    assert.equal(
      (await action.joinBookingWaitlist({ status: "IDLE" }, waitlistForm())).status,
      "SUCCESS",
    )
    assert.deepEqual(action.durable, {
      entries: 1,
      contactWrites: 1,
      revalidations: 1,
      quotaCharges: 1,
    })
  })

  it("recovers a post-commit ambiguity without repeating protected work", async () => {
    const action = loadWaitlistAction({ failFirstRevalidation: true })
    assert.deepEqual(
      await action.joinBookingWaitlist({ status: "IDLE" }, waitlistForm()),
      publicBookingStateModule.publicBookingUnavailable(),
    )
    assert.deepEqual(action.durable, {
      entries: 1,
      contactWrites: 1,
      revalidations: 1,
      quotaCharges: 1,
    })

    assert.equal(
      (await action.joinBookingWaitlist({ status: "IDLE" }, waitlistForm())).status,
      "SUCCESS",
    )
    assert.deepEqual(action.durable, {
      entries: 1,
      contactWrites: 1,
      revalidations: 1,
      quotaCharges: 1,
    })
    assert.equal(action.events.filter((event) => event === "solver").length, 1)
  })

  it("rolls limiter persistence failures back before availability or waitlist writes", async () => {
    const action = loadWaitlistAction({ failLimiterPersistence: 2 })
    const errors = []
    const originalError = console.error
    console.error = (...args) => errors.push(args)

    try {
      assert.deepEqual(
        await action.joinBookingWaitlist({ status: "IDLE" }, waitlistForm()),
        publicBookingStateModule.publicBookingUnavailable(),
      )
      assert.deepEqual(
        await action.joinBookingWaitlist({ status: "IDLE" }, waitlistForm()),
        publicBookingStateModule.publicBookingUnavailable(),
      )
    } finally {
      console.error = originalError
    }
    assert.equal(action.durable.quotaCharges, 0)
    assert.equal(action.waitlistRows.length, 0)
    assert.doesNotMatch(action.events.join(","), /solver|contact-|entry-create|revalidate/)
    assert.deepEqual(errors, [[
      "Public booking action unavailable.",
      { operation: "WAITLIST_JOIN", failureClass: "UNEXPECTED", code: "unexpected_error" },
    ]])
    assert.doesNotMatch(JSON.stringify(errors), /injected|request|owner|guest|example|network-1/i)
  })

  it("retries the complete Serializable unit without double-charging waitlist quota", async () => {
    const action = loadWaitlistAction({ retryFirstSerializableAttempt: true })

    assert.equal((await action.joinBookingWaitlist({ status: "IDLE" }, waitlistForm())).status, "SUCCESS")
    assert.equal(action.events.filter((event) => event === "transaction").length, 2)
    assert.equal(action.limiterCalls.length, 2)
    assert.deepEqual(action.durable, {
      entries: 1,
      contactWrites: 1,
      revalidations: 1,
      quotaCharges: 1,
    })
  })

  it("reconciles an expected stale-snapshot P2002 but fails closed on an unrelated unique conflict", async () => {
    const same = loadWaitlistAction({ staleConflictCode: null })
    const sameResults = await Promise.all([
      same.joinBookingWaitlist({ status: "IDLE" }, waitlistForm()),
      same.joinBookingWaitlist({ status: "IDLE" }, waitlistForm()),
    ])
    assert.deepEqual(sameResults.map((result) => result.status), ["SUCCESS", "SUCCESS"])
    assert.deepEqual(same.durable, {
      entries: 1,
      contactWrites: 1,
      revalidations: 1,
      quotaCharges: 1,
    })
    assert.equal(same.events.filter((event) => event === "entry-create").length, 2)
    assert.equal(same.events.filter((event) => event === "transaction").length, 2)

    const changed = loadWaitlistAction()
    const changedResults = await Promise.all([
      changed.joinBookingWaitlist({ status: "IDLE" }, waitlistForm()),
      changed.joinBookingWaitlist(
        { status: "IDLE" },
        waitlistForm({ requestedPressureLevel: "4" }),
      ),
    ])
    assert.deepEqual(changedResults.map((result) => result.status).sort(), ["CONFLICT", "SUCCESS"])
    assert.equal(changed.durable.entries, 1)
    assert.equal(changed.durable.quotaCharges, 1)

    const unrelated = loadWaitlistAction({ failLimiterUniqueWithoutWinner: true })
    assert.deepEqual(
      await unrelated.joinBookingWaitlist({ status: "IDLE" }, waitlistForm()),
      publicBookingStateModule.publicBookingUnavailable(),
    )
    assert.equal(unrelated.waitlistRows.length, 0)
    assert.equal(unrelated.durable.quotaCharges, 0)
    assert.equal(unrelated.events.filter((event) => event === "entry-create").length, 0)
  })
})
