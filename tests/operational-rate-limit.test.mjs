import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  consumeOperationalRateLimit,
  maybePruneOperationalRateLimits,
  operationalRateLimitKeyHash,
  pruneOperationalRateLimits,
} from "../lib/operational-rate-limit.ts"

const SECRET = "test-operational-secret"
const BASE_TIME = new Date("2026-08-31T12:00:00.000Z")

/**
 * Models Prisma with private Serializable snapshots, revision-conflict detection,
 * and dirty-only commits. forceTransactionError injects transaction failures,
 * failPrune injects cleanup-read failures, and reactivateBeforeDelete models a
 * stale row becoming active between cleanup selection and guarded deletion.
 */
class InMemoryOperationalRateLimitClient {
  constructor({ clock = () => BASE_TIME } = {}) {
    this.rows = new Map()
    this.clock = clock
    this.revision = 0
    this.nextId = 1
    this.transactionAttempts = 0
    this.transactionIsolationLevels = []
    this.writeCount = 0
    this.findManyCalls = []
    this.readIdentities = []
    this.writeIdentities = []
    this.forceTransactionError = null
    this.failPrune = false
    this.reactivateBeforeDelete = false
    this.operationalRateLimitBucket = this.#delegate(() => this.rows, null)
  }

  /**
   * Models Serializable commits with a private row snapshot and start revision.
   * Exactly one microtask yield lets peer callbacks overlap before commit;
   * revision drift then raises Prisma-style P2034 instead of replacing new state.
   */
  async $transaction(callback, options) {
    this.transactionAttempts += 1
    this.transactionIsolationLevels.push(options?.isolationLevel)
    if (this.forceTransactionError) throw this.forceTransactionError

    const startRevision = this.revision
    const snapshot = new Map([...this.rows].map(([key, row]) => [key, cloneRow(row)]))
    const state = { dirty: false }
    const result = await callback({ operationalRateLimitBucket: this.#delegate(() => snapshot, state) })

    if (!state.dirty) return result
    await Promise.resolve()
    if (startRevision !== this.revision) {
      const conflict = new Error("serialization conflict")
      conflict.code = "P2034"
      throw conflict
    }
    this.rows = snapshot
    this.revision += 1
    return result
  }

  seed(row) {
    const key = bucketKey(row)
    this.rows.set(key, { id: `seed-${this.nextId++}`, updatedAt: row.windowStart, ...row })
  }

  rowFor(identity) {
    return this.rows.get(bucketKey(identity)) ?? null
  }

  #delegate(resolveRows, transactionState) {
    return {
      findUnique: async ({ where }) => {
        const rows = resolveRows()
        this.readIdentities.push({ ...where.policy_scope_keyHash })
        const row = rows.get(bucketKey(where.policy_scope_keyHash))
        return row ? cloneRow(row) : null
      },
      upsert: async ({ where, create, update }) => {
        if (!transactionState) {
          throw new Error("Operational rate-limit upsert requires an active transaction.")
        }
        const rows = resolveRows()
        this.writeIdentities.push({ ...where.policy_scope_keyHash })
        const key = bucketKey(where.policy_scope_keyHash)
        const current = rows.get(key)
        rows.set(key, current
          ? { ...current, ...update, updatedAt: update.updatedAt ?? this.clock() }
          : { id: `bucket-${this.nextId++}`, ...create, updatedAt: create.updatedAt ?? this.clock() })
        transactionState.dirty = true
        this.writeCount += 1
        return cloneRow(rows.get(key))
      },
      findMany: async ({ where, orderBy, take, select }) => {
        const rows = resolveRows()
        this.findManyCalls.push({ where, orderBy, take, select })
        if (this.failPrune) throw new Error("cleanup unavailable")
        return [...rows.values()]
          .filter((row) => matchesCleanupWhere(row, where))
          .sort((left, right) => left.updatedAt - right.updatedAt)
          .slice(0, take)
          .map(({ id }) => ({ id }))
      },
      deleteMany: async ({ where }) => {
        const rows = resolveRows()
        if (this.reactivateBeforeDelete) {
          const firstId = where.id.in[0]
          const row = [...rows.values()].find((candidate) => candidate.id === firstId)
          if (row) {
            row.blockedUntil = new Date(BASE_TIME.getTime() + 60_000)
          }
        }
        let count = 0
        for (const [key, row] of rows) {
          if (where.id.in.includes(row.id) && matchesCleanupWhere(row, where)) {
            rows.delete(key)
            count += 1
          }
        }
        if (count > 0 && transactionState) transactionState.dirty = true
        return { count }
      },
    }
  }
}

function cloneRow(row) {
  return {
    ...row,
    windowStart: new Date(row.windowStart),
    blockedUntil: row.blockedUntil ? new Date(row.blockedUntil) : null,
    updatedAt: new Date(row.updatedAt),
  }
}

function bucketKey({ policy, scope, keyHash }) {
  return `${policy}\0${scope}\0${keyHash}`
}

/** Provides the test oracle for the locale-independent database lock order. */
function compareCodeUnits(left, right) {
  return left < right ? -1 : left > right ? 1 : 0
}

/** Mirrors the cleanup query's stale-row AND inactive-block predicate as a test oracle. */
function matchesCleanupWhere(row, where) {
  const stale = row.updatedAt < where.updatedAt.lt
  const inactive = where.OR?.some((clause) => (
    (clause?.blockedUntil === null && row.blockedUntil === null)
    || (clause?.blockedUntil?.lt instanceof Date
      && row.blockedUntil instanceof Date
      && row.blockedUntil < clause.blockedUntil.lt)
  ))
  return stale && inactive === true
}

function identity(policy, scope, components) {
  return {
    policy,
    scope,
    keyHash: operationalRateLimitKeyHash({
      policy,
      scope,
      normalizedSubjectComponents: components,
      secret: SECRET,
    }),
  }
}

describe("operational rate-limit service", () => {
  it("rejects an upsert outside a transaction before mutating the test double", async () => {
    const client = new InMemoryOperationalRateLimitClient()
    const directIdentity = {
      policy: "direct-test.v1",
      scope: "GLOBAL",
      keyHash: "a".repeat(64),
    }
    let rejection

    await assert.rejects(
      () => client.operationalRateLimitBucket.upsert({
        where: { policy_scope_keyHash: directIdentity },
        create: directIdentity,
        update: { count: 1 },
      }),
      (error) => {
        rejection = error
        return true
      },
    )

    assert.equal(client.rows.size, 0)
    assert.deepEqual(client.writeIdentities, [])
    assert.equal(client.writeCount, 0)
    assert.equal(client.nextId, 1)
    assert.equal(rejection.message, "Operational rate-limit upsert requires an active transaction.")
  })

  it("uses a length-delimited domain-separated HMAC without exposing raw subjects", () => {
    const first = operationalRateLimitKeyHash({
      policy: "policy.v1",
      scope: "RESOURCE",
      normalizedSubjectComponents: [{ label: "ab", value: "c" }],
      secret: SECRET,
    })
    const second = operationalRateLimitKeyHash({
      policy: "policy.v1",
      scope: "RESOURCE",
      normalizedSubjectComponents: [{ label: "a", value: "bc" }],
      secret: SECRET,
    })
    const otherPolicy = operationalRateLimitKeyHash({
      policy: "other.v1",
      scope: "RESOURCE",
      normalizedSubjectComponents: [{ label: "ab", value: "c" }],
      secret: SECRET,
    })

    assert.match(first, /^[0-9a-f]{64}$/)
    assert.notEqual(first, second)
    assert.notEqual(first, otherPolicy)
  })

  it("reads and writes multi-rule identities in stable policy, scope, and hash order", { concurrency: false }, async () => {
    const refreshedAt = new Date(BASE_TIME.getTime() + 60_000)
    const client = new InMemoryOperationalRateLimitClient({ clock: () => refreshedAt })
    const capturedBucketDelegate = client.operationalRateLimitBucket
    const input = {
      operation: "BOOKING_CREATE",
      networkIdentifier: "net",
      practiceId: "practice",
      owner: { kind: "ACCOUNT_ID", value: "account" },
      prismaClient: client,
      secret: SECRET,
      now: BASE_TIME,
      shouldPrune: () => false,
    }
    const expectedPolicies = [
      "booking.create.network-practice.24h.v1",
      "booking.create.network-practice.30m.v1",
      "booking.create.owner-practice.24h.v1",
      "booking.create.owner-practice.30m.v1",
    ]

    const originalLocaleCompare = String.prototype.localeCompare
    String.prototype.localeCompare = function (other) {
      return compareCodeUnits(String(other), String(this))
    }
    try {
      assert.equal(compareCodeUnits("Z", "a"), -1)
      assert.equal(Math.sign("Z".localeCompare("a")), 1)
      assert.deepEqual(await consumeOperationalRateLimit(input), { allowed: true })
      assert.deepEqual(await consumeOperationalRateLimit(input), { allowed: true })
    } finally {
      String.prototype.localeCompare = originalLocaleCompare
    }
    assert.equal(String.prototype.localeCompare, originalLocaleCompare)
    assert.deepEqual(client.transactionIsolationLevels, ["Serializable", "Serializable"])
    assert.deepEqual(client.readIdentities.slice(0, 4).map(({ policy }) => policy), expectedPolicies)
    assert.deepEqual(client.readIdentities.slice(4, 8).map(({ policy }) => policy), expectedPolicies)
    assert.deepEqual(client.writeIdentities.slice(0, 4).map(({ policy }) => policy), expectedPolicies)
    assert.deepEqual(client.writeIdentities.slice(4, 8).map(({ policy }) => policy), expectedPolicies)
    for (const identities of [client.readIdentities.slice(0, 4), client.writeIdentities.slice(0, 4)]) {
      const tuples = identities.map(({ policy, scope, keyHash }) => `${policy}\0${scope}\0${keyHash}`)
      assert.deepEqual(tuples, [...tuples].sort(compareCodeUnits))
    }
    const retainedIdentity = client.writeIdentities[0]
    await client.$transaction((tx) => tx.operationalRateLimitBucket.upsert({
      where: { policy_scope_keyHash: retainedIdentity },
      create: { ...retainedIdentity, count: 1, windowStart: BASE_TIME, blockedUntil: null },
      update: { count: 3 },
    }), { isolationLevel: "Serializable" })
    const refreshed = client.rowFor(retainedIdentity)
    assert.deepEqual(
      { policy: refreshed.policy, scope: refreshed.scope, keyHash: refreshed.keyHash },
      retainedIdentity,
    )
    assert.deepEqual(refreshed.updatedAt, refreshedAt)
    assert.deepEqual(await capturedBucketDelegate.findUnique({
      where: { policy_scope_keyHash: retainedIdentity },
    }), refreshed)
  })

  it("accepts the final slot, denies the next request, and stores only hashes", async () => {
    const client = new InMemoryOperationalRateLimitClient()
    const input = {
      operation: "PROBLEM_REPORT",
      networkIdentifier: "private-network-value",
      prismaClient: client,
      secret: SECRET,
      now: BASE_TIME,
      shouldPrune: () => false,
    }

    for (let index = 0; index < 5; index += 1) {
      assert.deepEqual(await consumeOperationalRateLimit(input), { allowed: true })
    }
    assert.deepEqual(await consumeOperationalRateLimit(input), {
      allowed: false,
      reason: "RATE_LIMITED",
      retryAfterSeconds: 600,
    })

    const networkIdentity = identity("problem-report.network.10m.v1", "NETWORK", [
      { label: "network", value: "private-network-value" },
    ])
    assert.equal(client.rowFor(networkIdentity).count, 5)
    assert.equal(JSON.stringify([...client.rows.values()]).includes("private-network-value"), false)
  })

  it("returns the latest active block and performs zero writes on multi-rule denial", async () => {
    const client = new InMemoryOperationalRateLimitClient()
    const request = {
      operation: "BOOKING_CREATE",
      networkIdentifier: "net",
      practiceId: "practice",
      owner: { kind: "ACCOUNT_ID", value: "account" },
      prismaClient: client,
      secret: SECRET,
      now: BASE_TIME,
      shouldPrune: () => false,
    }
    const ownerIdentity = identity("booking.create.owner-practice.30m.v1", "RESOURCE", [
      { label: "account-id", value: "account" },
      { label: "practice", value: "practice" },
    ])
    const dailyIdentity = identity("booking.create.owner-practice.24h.v1", "RESOURCE", [
      { label: "account-id", value: "account" },
      { label: "practice", value: "practice" },
    ])
    client.seed({
      ...ownerIdentity,
      count: 3,
      windowStart: new Date(BASE_TIME.getTime() - 5 * 60_000),
      blockedUntil: new Date(BASE_TIME.getTime() + 25 * 60_000),
    })
    client.seed({
      ...dailyIdentity,
      count: 8,
      windowStart: new Date(BASE_TIME.getTime() - 60 * 60_000),
      blockedUntil: new Date(BASE_TIME.getTime() + 23 * 60 * 60_000),
    })
    const writesBefore = client.writeCount

    assert.deepEqual(await consumeOperationalRateLimit(request), {
      allowed: false,
      reason: "RATE_LIMITED",
      retryAfterSeconds: 23 * 60 * 60,
    })
    assert.equal(client.writeCount, writesBefore)
  })

  it("resets an expired fixed window", async () => {
    const client = new InMemoryOperationalRateLimitClient()
    const networkIdentity = identity("problem-report.network.10m.v1", "NETWORK", [
      { label: "network", value: "net" },
    ])
    client.seed({
      ...networkIdentity,
      count: 5,
      windowStart: new Date(BASE_TIME.getTime() - 10 * 60_000),
      blockedUntil: BASE_TIME,
    })
    const now = new Date(BASE_TIME.getTime() + 1)

    assert.deepEqual(await consumeOperationalRateLimit({
      operation: "PROBLEM_REPORT",
      networkIdentifier: "net",
      prismaClient: client,
      secret: SECRET,
      now,
      shouldPrune: () => false,
    }), { allowed: true })
    assert.equal(client.rowFor(networkIdentity).count, 1)
    assert.deepEqual(client.rowFor(networkIdentity).windowStart, now)
  })

  it("retries one concurrent serialization conflict without losing a slot", async () => {
    const client = new InMemoryOperationalRateLimitClient()
    const input = {
      operation: "PROBLEM_REPORT",
      networkIdentifier: "net",
      prismaClient: client,
      secret: SECRET,
      now: BASE_TIME,
      shouldPrune: () => false,
    }

    const decisions = await Promise.all([
      consumeOperationalRateLimit(input),
      consumeOperationalRateLimit(input),
    ])
    assert.deepEqual(decisions, [{ allowed: true }, { allowed: true }])
    assert.equal(client.transactionAttempts, 3)
    assert.equal(client.rowFor(identity("problem-report.network.10m.v1", "NETWORK", [
      { label: "network", value: "net" },
    ])).count, 2)
  })

  it("emits one bounded privacy-safe diagnostic per operation and failure class", { concurrency: false }, async () => {
    const originalWarn = console.warn
    const warnings = []
    const sensitiveNetwork = "private-network@example.test"
    const sensitiveUnknownOperation = "recipient@example.test"
    const unavailable = { allowed: false, reason: "UNAVAILABLE" }
    console.warn = (...args) => warnings.push(args)

    try {
      for (let attempt = 0; attempt < 2; attempt += 1) {
        assert.deepEqual(await consumeOperationalRateLimit({
          operation: "PROBLEM_REPORT",
          networkIdentifier: sensitiveNetwork,
          secret: "",
        }), unavailable)
        assert.deepEqual(await consumeOperationalRateLimit({
          operation: sensitiveUnknownOperation,
          networkIdentifier: sensitiveNetwork,
          secret: SECRET,
        }), unavailable)

        const persistenceClient = new InMemoryOperationalRateLimitClient()
        persistenceClient.forceTransactionError = new Error("private persistence detail")
        assert.deepEqual(await consumeOperationalRateLimit({
          operation: "PROBLEM_REPORT",
          networkIdentifier: sensitiveNetwork,
          prismaClient: persistenceClient,
          secret: SECRET,
          now: BASE_TIME,
          shouldPrune: () => false,
        }), unavailable)
      }
    } finally {
      console.warn = originalWarn
    }

    assert.equal(console.warn, originalWarn)
    assert.deepEqual(warnings, [
      ["Operational rate limiter unavailable.", { operation: "PROBLEM_REPORT", failureClass: "DEFINITION" }],
      ["Operational rate limiter unavailable.", { operation: "UNKNOWN", failureClass: "DEFINITION" }],
      ["Operational rate limiter unavailable.", { operation: "PROBLEM_REPORT", failureClass: "PERSISTENCE" }],
    ])
    const serializedWarnings = JSON.stringify(warnings)
    assert.equal(serializedWarnings.includes(sensitiveNetwork), false)
    assert.equal(serializedWarnings.includes(sensitiveUnknownOperation), false)
    assert.equal(serializedWarnings.includes("private persistence detail"), false)
  })

  it("maps invalid input, missing secret, non-retryable errors, and exhausted retries to unavailable", async () => {
    assert.deepEqual(await consumeOperationalRateLimit({
      operation: "PROBLEM_REPORT",
      networkIdentifier: "",
      secret: SECRET,
    }), { allowed: false, reason: "UNAVAILABLE" })
    assert.deepEqual(await consumeOperationalRateLimit({
      operation: "PROBLEM_REPORT",
      networkIdentifier: "net",
      secret: "",
    }), { allowed: false, reason: "UNAVAILABLE" })

    const client = new InMemoryOperationalRateLimitClient()
    const conflict = new Error("serialization conflict")
    conflict.code = "P2034"
    client.forceTransactionError = conflict
    assert.deepEqual(await consumeOperationalRateLimit({
      operation: "PROBLEM_REPORT",
      networkIdentifier: "net",
      prismaClient: client,
      secret: SECRET,
      now: BASE_TIME,
      shouldPrune: () => false,
    }), { allowed: false, reason: "UNAVAILABLE" })
    assert.equal(client.transactionAttempts, 3)

    const nonRetryableClient = new InMemoryOperationalRateLimitClient()
    nonRetryableClient.forceTransactionError = new Error("transaction unavailable")
    assert.deepEqual(await consumeOperationalRateLimit({
      operation: "PROBLEM_REPORT",
      networkIdentifier: "net",
      prismaClient: nonRetryableClient,
      secret: SECRET,
      now: BASE_TIME,
      shouldPrune: () => false,
    }), { allowed: false, reason: "UNAVAILABLE" })
    assert.equal(nonRetryableClient.transactionAttempts, 1)
  })

  it("bounds cleanup and repeats stale predicates to preserve reactivated rows", async () => {
    const client = new InMemoryOperationalRateLimitClient()
    const staleAt = new Date(BASE_TIME.getTime() - 48 * 60 * 60_000)
    const before = new Date(BASE_TIME.getTime() - 24 * 60 * 60_000)
    for (let index = 0; index < 150; index += 1) {
      client.seed({
        ...identity(`stale.${index}.v1`, "GLOBAL", [{ label: "deployment", value: "massagelab" }]),
        count: 1,
        windowStart: staleAt,
        blockedUntil: null,
        updatedAt: staleAt,
      })
    }
    assert.equal(await pruneOperationalRateLimits({
      prismaClient: client,
      before,
      maxRows: 500,
    }), 100)
    assert.equal(client.rows.size, 50)
    assert.ok(Array.isArray(client.findManyCalls), "expected cleanup query calls to be recorded")
    assert.equal(client.findManyCalls.length, 1)
    assert.deepEqual(client.findManyCalls[0].orderBy, { updatedAt: "asc" })
    assert.deepEqual(client.findManyCalls[0].select, { id: true })
    assert.equal(client.findManyCalls[0].take, 100)
    assert.deepEqual(client.findManyCalls[0].where.updatedAt, { lt: before })
    assert.ok(client.findManyCalls[0].where.OR.some((clause) => clause?.blockedUntil === null))
    assert.ok(client.findManyCalls[0].where.OR.some((clause) => clause?.blockedUntil?.lt instanceof Date))

    const callerBounded = new InMemoryOperationalRateLimitClient()
    for (let index = 0; index < 15; index += 1) {
      callerBounded.seed({
        ...identity(`caller-bounded.${index}.v1`, "GLOBAL", [{ label: "deployment", value: "massagelab" }]),
        count: 1,
        windowStart: staleAt,
        blockedUntil: null,
        updatedAt: staleAt,
      })
    }
    assert.equal(await pruneOperationalRateLimits({
      prismaClient: callerBounded,
      before,
      maxRows: 10,
    }), 10)
    assert.equal(callerBounded.findManyCalls.length, 1)
    assert.equal(callerBounded.findManyCalls[0].take, 10)
    assert.equal(callerBounded.rows.size, 5)

    const transactional = new InMemoryOperationalRateLimitClient()
    const transactionalIdentity = identity("transactional-delete.v1", "GLOBAL", [
      { label: "deployment", value: "massagelab" },
    ])
    transactional.seed({
      ...transactionalIdentity,
      count: 1,
      windowStart: staleAt,
      blockedUntil: null,
      updatedAt: staleAt,
    })
    assert.equal(await transactional.$transaction(
      (tx) => pruneOperationalRateLimits({ prismaClient: tx, before, maxRows: 100 }),
      { isolationLevel: "Serializable" },
    ), 1)
    assert.equal(transactional.rowFor(transactionalIdentity), null)
  })

  it("deletes a stale row whose block expired before the cleanup cutoff", async () => {
    const client = new InMemoryOperationalRateLimitClient()
    const staleAt = new Date(BASE_TIME.getTime() - 48 * 60 * 60_000)
    const before = new Date(BASE_TIME.getTime() - 24 * 60 * 60_000)
    const expiredBlockedIdentity = identity("expired-block.v1", "GLOBAL", [
      { label: "deployment", value: "massagelab" },
    ])
    client.seed({
      ...expiredBlockedIdentity,
      count: 1,
      windowStart: staleAt,
      blockedUntil: new Date(before.getTime() - 1),
      updatedAt: staleAt,
    })

    assert.equal(await pruneOperationalRateLimits({
      prismaClient: client,
      before,
      maxRows: 100,
    }), 1)
    assert.equal(client.rowFor(expiredBlockedIdentity), null)
  })

  it("preserves a stale row that becomes actively blocked between selection and deletion", async () => {
    const client = new InMemoryOperationalRateLimitClient()
    const staleAt = new Date(BASE_TIME.getTime() - 48 * 60 * 60_000)
    const before = new Date(BASE_TIME.getTime() - 24 * 60 * 60_000)
    const reactivatedIdentity = identity("reactivated.v1", "GLOBAL", [
      { label: "deployment", value: "massagelab" },
    ])
    client.seed({
      ...reactivatedIdentity,
      count: 1,
      windowStart: staleAt,
      blockedUntil: new Date(before.getTime() - 1),
      updatedAt: staleAt,
    })
    client.reactivateBeforeDelete = true

    assert.equal(await pruneOperationalRateLimits({
      prismaClient: client,
      before,
      maxRows: 100,
    }), 0)
    const preserved = client.rowFor(reactivatedIdentity)
    assert.ok(preserved, "expected the newly active row to survive guarded deletion")
    assert.deepEqual(preserved.updatedAt, staleAt)
    assert.ok(preserved.blockedUntil > before)
  })

  it("awaits sampled cleanup while unsampled requests avoid cleanup work", async () => {
    const sampled = new InMemoryOperationalRateLimitClient()
    let cleanupStarted
    let releaseCleanup
    const started = new Promise((resolve) => { cleanupStarted = resolve })
    const cleanupGate = new Promise((resolve) => { releaseCleanup = resolve })
    let sampledSettled = false
    sampled.operationalRateLimitBucket.findMany = async () => {
      cleanupStarted()
      await cleanupGate
      throw new Error("cleanup unavailable")
    }

    const sampledDecision = consumeOperationalRateLimit({
      operation: "PROBLEM_REPORT",
      networkIdentifier: "net",
      prismaClient: sampled,
      secret: SECRET,
      now: BASE_TIME,
      shouldPrune: () => true,
    }).then((decision) => {
      sampledSettled = true
      return decision
    })
    await started
    await Promise.resolve()
    const settledBeforeCleanup = sampledSettled
    releaseCleanup()

    assert.equal(settledBeforeCleanup, false)
    assert.deepEqual(await sampledDecision, { allowed: true })

    // This false branch models the 63 ordinary outcomes of the default one-in-64 sample.
    const unsampled = new InMemoryOperationalRateLimitClient()
    let unsampledCleanupCalls = 0
    unsampled.operationalRateLimitBucket.findMany = async () => {
      unsampledCleanupCalls += 1
      throw new Error("unsampled cleanup must not run")
    }
    assert.deepEqual(await consumeOperationalRateLimit({
      operation: "PROBLEM_REPORT",
      networkIdentifier: "net",
      prismaClient: unsampled,
      secret: SECRET,
      now: BASE_TIME,
      shouldPrune: () => false,
    }), { allowed: true })
    assert.equal(unsampledCleanupCalls, 0)
  })

  it("keeps sampled cleanup failures best-effort and deletes stale rows on success", async () => {
    const client = new InMemoryOperationalRateLimitClient()
    client.failPrune = true
    assert.deepEqual(await consumeOperationalRateLimit({
      operation: "PROBLEM_REPORT",
      networkIdentifier: "net",
      prismaClient: client,
      secret: SECRET,
      now: BASE_TIME,
      shouldPrune: () => true,
    }), { allowed: true })
    assert.ok(Array.isArray(client.findManyCalls), "expected sampled cleanup query calls to be recorded")
    assert.equal(client.findManyCalls.length, 1)
    assert.deepEqual(client.findManyCalls[0].orderBy, { updatedAt: "asc" })
    assert.deepEqual(client.findManyCalls[0].select, { id: true })
    assert.ok(client.findManyCalls[0].where.OR.some((clause) => clause?.blockedUntil === null))
    assert.ok(client.findManyCalls[0].where.OR.some((clause) => clause?.blockedUntil?.lt instanceof Date))
    assert.equal(await maybePruneOperationalRateLimits({
      prismaClient: client,
      before: BASE_TIME,
      shouldPrune: () => true,
    }), 0)
    assert.equal(client.findManyCalls.length, 2)
    assert.deepEqual(client.findManyCalls[1].where.updatedAt, { lt: BASE_TIME })

    client.failPrune = false
    const staleIdentity = identity("stale.sampled-cleanup.v1", "GLOBAL", [
      { label: "deployment", value: "massagelab" },
    ])
    const staleAt = new Date(BASE_TIME.getTime() - 1)
    client.seed({
      ...staleIdentity,
      count: 1,
      windowStart: staleAt,
      blockedUntil: null,
      updatedAt: staleAt,
    })
    assert.equal(await maybePruneOperationalRateLimits({
      prismaClient: client,
      before: BASE_TIME,
      shouldPrune: () => true,
    }), 1)
    assert.equal(client.findManyCalls.length, 3)
    assert.equal(client.rowFor(staleIdentity), null)
    assert.equal(await maybePruneOperationalRateLimits({
      prismaClient: client,
      before: BASE_TIME,
      shouldPrune: () => false,
    }), 0)
    assert.equal(client.findManyCalls.length, 3)
  })

  it("reserves the last 20 total email attempts from public-auth traffic", async () => {
    const client = new InMemoryOperationalRateLimitClient()
    const common = { prismaClient: client, secret: SECRET, now: BASE_TIME, shouldPrune: () => false }

    for (let index = 0; index < 70; index += 1) {
      assert.deepEqual(await consumeOperationalRateLimit({ operation: "EMAIL_PUBLIC_AUTH", ...common }), { allowed: true })
    }
    assert.deepEqual(await consumeOperationalRateLimit({ operation: "EMAIL_PUBLIC_AUTH", ...common }), {
      allowed: false,
      reason: "RATE_LIMITED",
      retryAfterSeconds: 24 * 60 * 60,
    })
    for (let index = 0; index < 20; index += 1) {
      assert.deepEqual(await consumeOperationalRateLimit({ operation: "EMAIL_SECURITY", ...common }), { allowed: true })
    }
    assert.deepEqual(await consumeOperationalRateLimit({ operation: "EMAIL_SECURITY", ...common }), {
      allowed: false,
      reason: "RATE_LIMITED",
      retryAfterSeconds: 24 * 60 * 60,
    })
  })
})
