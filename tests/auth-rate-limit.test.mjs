import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import { runCommerceTransaction } from "../lib/commerce/transactions.ts"
import { createCompiledModuleLoader } from "./helpers/compiled-module.mjs"

const loadCompiledModule = createCompiledModuleLoader(import.meta.url)
const source = await readFile(new URL("../lib/auth-rate-limit.ts", import.meta.url), "utf8")
const limiter = loadCompiledModule(source, "auth-rate-limit.test.ts", {
  "@/lib/prisma": { prisma: {} },
  "@/lib/auth-env": { getAuthSecret: () => "production-secret" },
  "@/lib/auth-security": { normalizeEmail },
  "@/lib/commerce/transactions": { runCommerceTransaction },
})

const NOW = new Date("2026-08-28T12:00:00.000Z")
const SECRET = "secret"

describe("privacy-safe auth rate limits", () => {
  it("uses the exact domain-separated HMAC and never retains a raw identifier", () => {
    const account = limiter.authRateLimitKeyHash({ purpose: "REGISTER", scope: "ACCOUNT", identifier: " Person@Example.com ", secret: SECRET })
    const expected = createHmac("sha256", SECRET).update("REGISTER\0ACCOUNT\0person@example.com").digest("hex")
    const network = limiter.authRateLimitKeyHash({ purpose: "REGISTER", scope: "NETWORK", identifier: "person@example.com", secret: SECRET })
    const login = limiter.authRateLimitKeyHash({ purpose: "LOGIN", scope: "ACCOUNT", identifier: "person@example.com", secret: SECRET })

    assert.equal(account, expected)
    assert.equal(account.length, 64)
    assert.notEqual(account, network)
    assert.notEqual(account, login)
    assert.doesNotMatch(account, /person|example/i)
  })

  it("covers REGISTER account 5/network 12 with exact partial-window retry and expiry", async () => {
    const accountDb = createRateLimitDatabase()
    const accountInput = emailInput(accountDb, "REGISTER", "Person@Example.com", "203.0.113.4")
    for (let index = 0; index < 5; index += 1) assert.deepEqual(await limiter.consumeEmailWorkRateLimit(accountInput), { allowed: true })
    assert.deepEqual(await limiter.consumeEmailWorkRateLimit({ ...accountInput, now: plusMinutes(4) }), { allowed: false, retryAfterSeconds: 660 })
    assert.deepEqual(await limiter.consumeEmailWorkRateLimit({ ...accountInput, now: plusMinutes(15) }), { allowed: true })

    const networkDb = createRateLimitDatabase()
    for (let index = 0; index < 12; index += 1) {
      assert.deepEqual(await limiter.consumeEmailWorkRateLimit(emailInput(networkDb, "REGISTER", `person${index}@example.com`, "198.51.100.8")), { allowed: true })
    }
    assert.deepEqual(await limiter.consumeEmailWorkRateLimit(emailInput(networkDb, "REGISTER", "person12@example.com", "198.51.100.8")), { allowed: false, retryAfterSeconds: 900 })
    assertHasOnlyHashes(networkDb)
  })

  it("covers PASSWORD_RESET account 5/network 20", async () => {
    const accountDb = createRateLimitDatabase()
    const sameAccount = emailInput(accountDb, "PASSWORD_RESET", "reset@example.com", "203.0.113.10")
    for (let index = 0; index < 5; index += 1) assert.deepEqual(await limiter.consumeEmailWorkRateLimit(sameAccount), { allowed: true })
    assert.deepEqual(await limiter.consumeEmailWorkRateLimit(sameAccount), { allowed: false, retryAfterSeconds: 900 })

    const networkDb = createRateLimitDatabase()
    for (let index = 0; index < 20; index += 1) {
      assert.deepEqual(await limiter.consumeEmailWorkRateLimit(emailInput(networkDb, "PASSWORD_RESET", `reset${index}@example.com`, "203.0.113.11")), { allowed: true })
    }
    assert.deepEqual(await limiter.consumeEmailWorkRateLimit(emailInput(networkDb, "PASSWORD_RESET", "reset20@example.com", "203.0.113.11")), { allowed: false, retryAfterSeconds: 900 })
  })

  for (const purpose of ["LOGIN", "TWO_FACTOR"]) {
    it(`covers ${purpose} account 8/network 30 and 15-minute credential expiry`, async () => {
      const accountDb = createRateLimitDatabase()
      const sameAccount = credentialInput(accountDb, purpose, "login@example.com", "192.0.2.10")
      for (let index = 0; index < 8; index += 1) assert.deepEqual(await limiter.recordCredentialFailure(sameAccount), { allowed: true })
      assert.deepEqual(await limiter.checkCredentialRateLimit({ ...sameAccount, now: plusMinutes(4) }), { allowed: false, retryAfterSeconds: 660 })
      assert.deepEqual(await limiter.checkCredentialRateLimit({ ...sameAccount, now: plusMinutes(15) }), { allowed: true })

      const networkDb = createRateLimitDatabase()
      for (let index = 0; index < 30; index += 1) {
        assert.deepEqual(await limiter.recordCredentialFailure(credentialInput(networkDb, purpose, `login${index}@example.com`, "192.0.2.11")), { allowed: true })
      }
      assert.deepEqual(await limiter.checkCredentialRateLimit(credentialInput(networkDb, purpose, "login30@example.com", "192.0.2.11")), { allowed: false, retryAfterSeconds: 900 })
    })
  }

  it("uses the real bounded Serializable retry and rolls back a P2034 loser without lost updates", async () => {
    const database = createRateLimitDatabase()
    const input = emailInput(database, "PASSWORD_RESET", "same@example.com", "192.0.2.2")
    await Promise.all([
      limiter.consumeEmailWorkRateLimit(input),
      limiter.consumeEmailWorkRateLimit(input),
    ])

    assert.equal(database.transactionAttempts, 3)
    assert.equal(database.serializationConflicts, 1)
    assert.equal(database.transactionOptions.every((option) => option?.isolationLevel === "Serializable"), true)
    assert.equal(database.rows.length, 2)
    assert.deepEqual(database.rows.map((row) => row.count).sort(), [2, 2])
    assert.equal(new Set(database.rows.map((row) => `${row.purpose}:${row.scope}:${row.keyHash}`)).size, 2)
  })

  it("rejects the 31st GOOGLE_INTENT before the injected intent-create callback", async () => {
    const database = createRateLimitDatabase()
    let intentCreates = 0
    const start = () => runGoogleIntentHarness(
      { prismaClient: database, networkIdentifier: "203.0.113.90", secret: SECRET, now: NOW, shouldPrune: () => false },
      async () => { intentCreates += 1 },
    )
    for (let index = 0; index < 30; index += 1) assert.deepEqual(await start(), { allowed: true })
    assert.deepEqual(await start(), { allowed: false, retryAfterSeconds: 900 })
    assert.equal(intentCreates, 30)
    assert.deepEqual(database.rows.map(({ purpose, scope, count }) => ({ purpose, scope, count })), [{ purpose: "GOOGLE_INTENT", scope: "NETWORK", count: 30 }])
    assertHasOnlyHashes(database)
  })

  it("does not charge three to five healthy household users and preserves a blocked network after account success", async () => {
    const healthyDb = createRateLimitDatabase()
    for (let round = 0; round < 10; round += 1) {
      for (let user = 0; user < 5; user += 1) {
        assert.deepEqual(await limiter.checkCredentialRateLimit(credentialInput(healthyDb, "LOGIN", `healthy${user}@example.com`, "198.51.100.40")), { allowed: true })
      }
    }
    assert.equal(healthyDb.rows.length, 0)

    const blockedDb = createRateLimitDatabase()
    for (let index = 0; index < 30; index += 1) await limiter.recordCredentialFailure(credentialInput(blockedDb, "LOGIN", `failed${index}@example.com`, "198.51.100.41"))
    await limiter.clearCredentialAccountFailures({ prismaClient: blockedDb, email: "failed0@example.com", secret: SECRET })
    assert.deepEqual(await limiter.checkCredentialRateLimit(credentialInput(blockedDb, "LOGIN", "healthy@example.com", "198.51.100.41")), { allowed: false, retryAfterSeconds: 900 })
    assert.equal(blockedDb.rows.some((row) => row.purpose === "LOGIN" && row.scope === "NETWORK" && row.count === 30), true)
  })

  it("keeps sampled pruning best-effort after an authoritative consumed transaction", async () => {
    const database = createRateLimitDatabase({ pruneFailure: new Error("cleanup unavailable") })
    const result = await limiter.consumeEmailWorkRateLimit({ ...emailInput(database, "REGISTER", "person@example.com", "203.0.113.80"), shouldPrune: () => true })
    assert.deepEqual(result, { allowed: true })
    assert.equal(database.rows.length, 2)
    assert.deepEqual(database.rows.map((row) => row.count), [1, 1])
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

function emailInput(prismaClient, purpose, email, networkIdentifier) {
  return { prismaClient, purpose, email, networkIdentifier, secret: SECRET, now: NOW, shouldPrune: () => false }
}

function credentialInput(prismaClient, purpose, email, networkIdentifier) {
  return { prismaClient, purpose, email, networkIdentifier, secret: SECRET, now: NOW, shouldPrune: () => false }
}

function plusMinutes(minutes) {
  return new Date(NOW.getTime() + minutes * 60 * 1000)
}

async function runGoogleIntentHarness(input, wouldCreateIntent) {
  const decision = await limiter.consumeGoogleIntentStartRateLimit(input)
  if (decision.allowed) await wouldCreateIntent()
  return decision
}

function normalizeEmail(value) {
  return String(value ?? "").trim().toLowerCase()
}

function assertHasOnlyHashes(database) {
  assert.equal(database.rows.every((row) => row.keyHash.length === 64), true)
  assert.equal(JSON.stringify(database.rows).includes("@example.com"), false)
  assert.equal(JSON.stringify(database.rows).includes("203.0.113"), false)
  assert.equal(JSON.stringify(database.rows).includes("198.51.100"), false)
}

/**
 * Simulates optimistic Serializable transactions: each callback mutates a private
 * snapshot and a stale snapshot receives Prisma's P2034 before any state commits.
 */
function createRateLimitDatabase({ pruneFailure = null } = {}) {
  let committedRows = []
  let version = 0
  const metrics = { transactionAttempts: 0, serializationConflicts: 0, transactionOptions: [] }

  const store = {
    get rows() { return committedRows },
    replace(rows) { committedRows = rows },
  }
  const rootDelegate = createBucketDelegate(store, { pruneFailure })
  const database = {
    get rows() { return committedRows },
    get transactionAttempts() { return metrics.transactionAttempts },
    get serializationConflicts() { return metrics.serializationConflicts },
    get transactionOptions() { return metrics.transactionOptions },
    authRateLimitBucket: rootDelegate,
    seed(row) { committedRows.push(structuredClone(row)) },
    async $transaction(callback, options) {
      metrics.transactionAttempts += 1
      metrics.transactionOptions.push(options)
      const baseVersion = version
      let workingRows = structuredClone(committedRows)
      const workingStore = {
        get rows() { return workingRows },
        replace(rows) { workingRows = rows },
      }
      const result = await callback({ authRateLimitBucket: createBucketDelegate(workingStore) })
      await Promise.resolve()
      if (version !== baseVersion) {
        metrics.serializationConflicts += 1
        throw Object.assign(new Error("Transaction failed due to a write conflict or a deadlock"), { code: "P2034" })
      }
      committedRows = workingRows
      version += 1
      return result
    },
  }
  return database
}

function createBucketDelegate(store, { pruneFailure = null } = {}) {
  return {
    async findUnique({ where }) {
      const key = where.purpose_scope_keyHash
      return structuredClone(store.rows.find((row) => row.purpose === key.purpose && row.scope === key.scope && row.keyHash === key.keyHash) ?? null)
    },
    async upsert({ where, create, update }) {
      const key = where.purpose_scope_keyHash
      const existing = store.rows.find((row) => row.purpose === key.purpose && row.scope === key.scope && row.keyHash === key.keyHash)
      if (existing) Object.assign(existing, structuredClone(update))
      else store.rows.push({ id: `bucket-${key.purpose}-${key.scope}-${key.keyHash}`, ...structuredClone(create) })
    },
    async findMany({ where, take }) {
      if (pruneFailure) throw pruneFailure
      return store.rows
        .filter((row) => row.updatedAt < where.updatedAt.lt && (row.blockedUntil === null || row.blockedUntil < where.OR[1].blockedUntil.lt))
        .slice(0, take)
        .map(({ id }) => ({ id }))
    },
    async deleteMany({ where }) {
      const before = store.rows.length
      const ids = where.id?.in
      store.replace(store.rows.filter((row) => {
        const matchesIds = ids ? ids.includes(row.id) : true
        const matchesScope = where.scope ? row.scope === where.scope : true
        const matchesPurpose = where.purpose?.in ? where.purpose.in.includes(row.purpose) : where.purpose ? row.purpose === where.purpose : true
        const matchesHash = where.keyHash ? row.keyHash === where.keyHash : true
        return !(matchesIds && matchesScope && matchesPurpose && matchesHash)
      }))
      return { count: before - store.rows.length }
    },
  }
}
