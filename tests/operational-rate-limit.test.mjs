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

class InMemoryOperationalRateLimitClient {
  constructor() {
    this.rows = new Map()
    this.revision = 0
    this.nextId = 1
    this.transactionAttempts = 0
    this.writeCount = 0
    this.findManyCallCount = 0
    this.readIdentities = []
    this.writeIdentities = []
    this.forceTransactionError = null
    this.failPrune = false
    this.reactivateBeforeDelete = false
    this.operationalRateLimitBucket = this.#delegate(this.rows, null)
  }

  /**
   * Models Serializable commits with a private row snapshot and start revision.
   * Exactly one microtask yield lets peer callbacks overlap before commit;
   * revision drift then raises Prisma-style P2034 instead of replacing new state.
   */
  async $transaction(callback, options) {
    this.transactionAttempts += 1
    assert.equal(options?.isolationLevel, "Serializable")
    if (this.forceTransactionError) throw this.forceTransactionError

    const startRevision = this.revision
    const snapshot = new Map([...this.rows].map(([key, row]) => [key, cloneRow(row)]))
    const state = { dirty: false }
    const result = await callback({ operationalRateLimitBucket: this.#delegate(snapshot, state) })

    if (!state.dirty) return result
    await Promise.resolve()
    if (startRevision !== this.revision) {
      const conflict = new Error("serialization conflict")
      conflict.code = "P2034"
      throw conflict
    }
    this.rows = snapshot
    this.operationalRateLimitBucket = this.#delegate(this.rows, null)
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

  #delegate(rows, transactionState) {
    return {
      findUnique: async ({ where }) => {
        this.readIdentities.push({ ...where.policy_scope_keyHash })
        const row = rows.get(bucketKey(where.policy_scope_keyHash))
        return row ? cloneRow(row) : null
      },
      upsert: async ({ where, create, update }) => {
        if (!transactionState) {
          throw new Error("Operational rate-limit upsert requires an active transaction.")
        }
        this.writeIdentities.push({ ...where.policy_scope_keyHash })
        const key = bucketKey(where.policy_scope_keyHash)
        const current = rows.get(key)
        rows.set(key, {
          id: current?.id ?? `bucket-${this.nextId++}`,
          ...(current ? update : create),
        })
        transactionState.dirty = true
        this.writeCount += 1
        return cloneRow(rows.get(key))
      },
      findMany: async ({ where, orderBy, take, select }) => {
        this.findManyCallCount += 1
        if (this.failPrune) throw new Error("cleanup unavailable")
        assert.deepEqual(orderBy, { updatedAt: "asc" })
        assert.deepEqual(select, { id: true })
        return [...rows.values()]
          .filter((row) => matchesCleanupWhere(row, where))
          .sort((left, right) => left.updatedAt - right.updatedAt)
          .slice(0, take)
          .map(({ id }) => ({ id }))
      },
      deleteMany: async ({ where }) => {
        if (this.reactivateBeforeDelete) {
          const firstId = where.id.in[0]
          const row = [...rows.values()].find((candidate) => candidate.id === firstId)
          if (row) {
            row.updatedAt = BASE_TIME
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

function matchesCleanupWhere(row, where) {
  const stale = row.updatedAt < where.updatedAt.lt
  const blockedUntilNullClause = where.OR?.find((clause) => clause?.blockedUntil === null)
  assert.ok(blockedUntilNullClause, "expected explicit blockedUntil null cleanup OR clause")
  const blockedUntilClause = where.OR?.find((clause) => clause?.blockedUntil?.lt instanceof Date)
  assert.ok(blockedUntilClause, "expected blockedUntil.lt cleanup OR clause")
  const inactive = row.blockedUntil === null || row.blockedUntil < blockedUntilClause.blockedUntil.lt
  return stale && inactive
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

  it("reads and writes multi-rule identities in stable policy, scope, and hash order", async () => {
    const client = new InMemoryOperationalRateLimitClient()
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

    assert.deepEqual(await consumeOperationalRateLimit(input), { allowed: true })
    assert.deepEqual(await consumeOperationalRateLimit(input), { allowed: true })
    assert.deepEqual(client.readIdentities.slice(0, 4).map(({ policy }) => policy), expectedPolicies)
    assert.deepEqual(client.readIdentities.slice(4, 8).map(({ policy }) => policy), expectedPolicies)
    assert.deepEqual(client.writeIdentities.slice(0, 4).map(({ policy }) => policy), expectedPolicies)
    assert.deepEqual(client.writeIdentities.slice(4, 8).map(({ policy }) => policy), expectedPolicies)
    for (const identities of [client.readIdentities.slice(0, 4), client.writeIdentities.slice(0, 4)]) {
      const tuples = identities.map(({ policy, scope, keyHash }) => `${policy}\0${scope}\0${keyHash}`)
      assert.deepEqual(tuples, [...tuples].sort((left, right) => left.localeCompare(right)))
    }
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

  it("maps invalid input, missing secret, and exhausted transaction retries to unavailable", async () => {
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
  })

  it("bounds cleanup and repeats stale predicates to preserve reactivated rows", async () => {
    const client = new InMemoryOperationalRateLimitClient()
    const staleAt = new Date(BASE_TIME.getTime() - 48 * 60 * 60_000)
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
      before: new Date(BASE_TIME.getTime() - 24 * 60 * 60_000),
      maxRows: 500,
    }), 100)
    assert.equal(client.rows.size, 50)

    const reactivated = new InMemoryOperationalRateLimitClient()
    reactivated.seed({
      ...identity("reactivated.v1", "GLOBAL", [{ label: "deployment", value: "massagelab" }]),
      count: 1,
      windowStart: staleAt,
      blockedUntil: null,
      updatedAt: staleAt,
    })
    reactivated.reactivateBeforeDelete = true
    assert.equal(await pruneOperationalRateLimits({
      prismaClient: reactivated,
      before: new Date(BASE_TIME.getTime() - 24 * 60 * 60_000),
      maxRows: 100,
    }), 0)
    assert.equal(reactivated.rows.size, 1)
  })

  it("samples cleanup after the decision without changing an allowed result on cleanup failure", async () => {
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
    assert.equal(client.findManyCallCount, 1)
    assert.equal(await maybePruneOperationalRateLimits({
      prismaClient: client,
      before: BASE_TIME,
      shouldPrune: () => true,
    }), 0)
    assert.equal(client.findManyCallCount, 2)
    assert.equal(await maybePruneOperationalRateLimits({
      prismaClient: client,
      before: BASE_TIME,
      shouldPrune: () => false,
    }), 0)
    assert.equal(client.findManyCallCount, 2)
  })

  it("reserves the last 20 total email attempts from public-auth traffic", async () => {
    const client = new InMemoryOperationalRateLimitClient()
    const common = { prismaClient: client, secret: SECRET, now: BASE_TIME, shouldPrune: () => false }

    for (let index = 0; index < 70; index += 1) {
      assert.deepEqual(await consumeOperationalRateLimit({ operation: "EMAIL_PUBLIC_AUTH", ...common }), { allowed: true })
    }
    assert.equal((await consumeOperationalRateLimit({ operation: "EMAIL_PUBLIC_AUTH", ...common })).allowed, false)
    for (let index = 0; index < 20; index += 1) {
      assert.deepEqual(await consumeOperationalRateLimit({ operation: "EMAIL_SECURITY", ...common }), { allowed: true })
    }
    assert.equal((await consumeOperationalRateLimit({ operation: "EMAIL_SECURITY", ...common })).allowed, false)
  })
})
