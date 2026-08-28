import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import { createCompiledModuleLoader } from "./helpers/compiled-module.mjs"

const loadCompiledModule = createCompiledModuleLoader(import.meta.url)
const source = await readFile(new URL("../lib/auth-rate-limit.ts", import.meta.url), "utf8")
const limiter = loadCompiledModule(source, "auth-rate-limit.test.ts", {
  "@/lib/prisma": { prisma: {} },
  "@/lib/auth-env": { getAuthSecret: () => "production-secret" },
  "@/lib/auth-security": { normalizeEmail: (value) => String(value ?? "").trim().toLowerCase() },
  "@/lib/commerce/transactions": {
    runCommerceTransaction: (client, callback) => client.$transaction(callback, { isolationLevel: "Serializable" }),
  },
})

const NOW = new Date("2026-08-28T12:00:00.000Z")

describe("privacy-safe auth rate limits", () => {
  it("uses domain-separated HMAC hashes without retaining raw identifiers", () => {
    const account = limiter.authRateLimitKeyHash({ purpose: "REGISTER", scope: "ACCOUNT", identifier: " Person@Example.com ", secret: "secret" })
    const network = limiter.authRateLimitKeyHash({ purpose: "REGISTER", scope: "NETWORK", identifier: "person@example.com", secret: "secret" })
    const login = limiter.authRateLimitKeyHash({ purpose: "LOGIN", scope: "ACCOUNT", identifier: "person@example.com", secret: "secret" })

    assert.equal(account.length, 64)
    assert.equal(network.length, 64)
    assert.equal(login.length, 64)
    assert.notEqual(account, network)
    assert.notEqual(account, login)
    assert.doesNotMatch(account, /person|example/i)
  })

  it("accepts five account registrations, blocks the sixth, and expires exactly after 15 minutes", async () => {
    const database = createRateLimitDatabase()
    const input = { prismaClient: database, purpose: "REGISTER", email: "Person@Example.com", networkIdentifier: "203.0.113.4", secret: "secret", now: NOW, shouldPrune: () => false }

    for (let index = 0; index < 5; index += 1) {
      assert.deepEqual(await limiter.consumeEmailWorkRateLimit(input), { allowed: true })
    }
    assert.deepEqual(await limiter.consumeEmailWorkRateLimit(input), { allowed: false, retryAfterSeconds: 900 })
    assert.deepEqual(await limiter.consumeEmailWorkRateLimit({ ...input, now: new Date(NOW.getTime() + 15 * 60 * 1000) }), { allowed: true })
    assert.equal(database.rows.length, 2)
    assert.equal(database.rows.every((row) => row.keyHash.length === 64), true)
    assert.equal(JSON.stringify(database.rows).includes("Person@Example.com"), false)
    assert.equal(database.transactionOptions.every((option) => option?.isolationLevel === "Serializable"), true)
  })

  it("permits twelve household registrations and blocks the thirteenth network request", async () => {
    const database = createRateLimitDatabase()
    for (let index = 0; index < 12; index += 1) {
      assert.deepEqual(await limiter.consumeEmailWorkRateLimit({ prismaClient: database, purpose: "REGISTER", email: `person${index}@example.com`, networkIdentifier: "198.51.100.8", secret: "secret", now: NOW, shouldPrune: () => false }), { allowed: true })
    }
    assert.deepEqual(await limiter.consumeEmailWorkRateLimit({ prismaClient: database, purpose: "REGISTER", email: "person12@example.com", networkIdentifier: "198.51.100.8", secret: "secret", now: NOW, shouldPrune: () => false }), { allowed: false, retryAfterSeconds: 900 })
  })

  it("serializes concurrent increments without losing a count", async () => {
    const database = createRateLimitDatabase()
    await Promise.all([
      limiter.consumeEmailWorkRateLimit({ prismaClient: database, purpose: "PASSWORD_RESET", email: "same@example.com", networkIdentifier: "192.0.2.2", secret: "secret", now: NOW, shouldPrune: () => false }),
      limiter.consumeEmailWorkRateLimit({ prismaClient: database, purpose: "PASSWORD_RESET", email: "same@example.com", networkIdentifier: "192.0.2.2", secret: "secret", now: NOW, shouldPrune: () => false }),
    ])
    assert.deepEqual(database.rows.map((row) => row.count).sort(), [2, 2])
  })

  it("bounds Google intent starts with only a privacy-hashed network bucket", async () => {
    const database = createRateLimitDatabase()
    const input = { prismaClient: database, networkIdentifier: "203.0.113.90", secret: "secret", now: NOW, shouldPrune: () => false }
    for (let index = 0; index < 30; index += 1) {
      assert.deepEqual(await limiter.consumeGoogleIntentStartRateLimit(input), { allowed: true })
    }
    assert.deepEqual(await limiter.consumeGoogleIntentStartRateLimit(input), { allowed: false, retryAfterSeconds: 900 })
    assert.equal(database.rows.length, 1)
    assert.deepEqual({ purpose: database.rows[0].purpose, scope: database.rows[0].scope, count: database.rows[0].count }, { purpose: "GOOGLE_INTENT", scope: "NETWORK", count: 30 })
    assert.equal(JSON.stringify(database.rows).includes("203.0.113.90"), false)
  })

  it("counts credential failures but never charges successful checks and clears account buckets only", async () => {
    const database = createRateLimitDatabase()
    const input = { prismaClient: database, purpose: "LOGIN", email: "person@example.com", networkIdentifier: "192.0.2.9", secret: "secret", now: NOW, shouldPrune: () => false }
    assert.deepEqual(await limiter.checkCredentialRateLimit(input), { allowed: true })
    assert.equal(database.rows.length, 0)
    await limiter.recordCredentialFailure(input)
    assert.equal(database.rows.length, 2)
    await limiter.clearCredentialAccountFailures({ prismaClient: database, email: input.email, secret: "secret" })
    assert.equal(database.rows.length, 1)
    assert.equal(database.rows[0].scope, "NETWORK")
  })

  it("bounds stale pruning and provides a deterministic sampling hook", async () => {
    const database = createRateLimitDatabase()
    for (let index = 0; index < 110; index += 1) database.seed({ id: `stale-${index}`, purpose: "LOGIN", scope: "ACCOUNT", keyHash: String(index).padStart(64, "0"), count: 1, windowStart: new Date(0), blockedUntil: null, updatedAt: new Date(0) })
    assert.equal(await limiter.maybePruneAuthRateLimits({ prismaClient: database, before: NOW, maxRows: 100, shouldPrune: () => false }), 0)
    assert.equal(await limiter.maybePruneAuthRateLimits({ prismaClient: database, before: NOW, maxRows: 100, shouldPrune: () => true }), 100)
    assert.equal(database.rows.length, 10)
  })

  it("keeps serving sources off the legacy AuthAttempt API", async () => {
    const paths = ["lib/auth-rate-limit.ts", "auth.ts", "app/api/account/register/route.ts", "app/api/account/password-reset/request/route.ts"]
    const contents = await Promise.all(paths.map((path) => readFile(new URL(`../${path}`, import.meta.url), "utf8")))
    for (const content of contents) assert.doesNotMatch(content, /prisma\.authAttempt|assertRateLimit|recordFailedAttempt|clearAttempts|rateLimitKey/)
    const domainTypes = await readFile(new URL("../lib/domain-types.ts", import.meta.url), "utf8")
    assert.match(domainTypes, /AuthAttemptPurpose[^\n]*GOOGLE_INTENT/)
  })
})

function createRateLimitDatabase() {
  const rows = []
  const transactionOptions = []
  let transactionTail = Promise.resolve()
  const delegate = {
    async findUnique({ where }) {
      const key = where.purpose_scope_keyHash
      return rows.find((row) => row.purpose === key.purpose && row.scope === key.scope && row.keyHash === key.keyHash) ?? null
    },
    async upsert({ where, create, update }) {
      const key = where.purpose_scope_keyHash
      const existing = rows.find((row) => row.purpose === key.purpose && row.scope === key.scope && row.keyHash === key.keyHash)
      if (existing) Object.assign(existing, update, { updatedAt: update.updatedAt ?? new Date() })
      else rows.push({ id: `bucket-${rows.length + 1}`, ...create, updatedAt: create.updatedAt ?? new Date() })
    },
    async findMany({ where, take }) {
      return rows.filter((row) => row.updatedAt < where.updatedAt.lt && (row.blockedUntil === null || row.blockedUntil < where.OR[1].blockedUntil.lt)).slice(0, take).map(({ id }) => ({ id }))
    },
    async deleteMany({ where }) {
      const before = rows.length
      const ids = where.id?.in
      for (let index = rows.length - 1; index >= 0; index -= 1) {
        const row = rows[index]
        const matchesIds = ids ? ids.includes(row.id) : true
        const matchesScope = where.scope ? row.scope === where.scope : true
        const matchesPurpose = where.purpose?.in ? where.purpose.in.includes(row.purpose) : where.purpose ? row.purpose === where.purpose : true
        const matchesHash = where.keyHash ? row.keyHash === where.keyHash : true
        if (matchesIds && matchesScope && matchesPurpose && matchesHash) rows.splice(index, 1)
      }
      return { count: before - rows.length }
    },
  }
  return {
    rows,
    transactionOptions,
    seed(row) { rows.push({ ...row }) },
    authRateLimitBucket: delegate,
    async $transaction(callback, options) {
      transactionOptions.push(options)
      const run = transactionTail.then(() => callback({ authRateLimitBucket: delegate }))
      transactionTail = run.catch(() => {})
      return run
    },
  }
}
