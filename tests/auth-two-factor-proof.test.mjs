import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import { runCommerceTransaction } from "../lib/commerce/transactions.ts"
import { createCompiledModuleLoader } from "./helpers/compiled-module.mjs"

const loadCompiledModule = createCompiledModuleLoader(import.meta.url)
const normalizeEmail = (value) => String(value ?? "").trim().toLowerCase()
const limiterSource = await readFile(new URL("../lib/auth-rate-limit.ts", import.meta.url), "utf8")
const limiter = loadCompiledModule(limiterSource, "auth-rate-limit.two-factor-proof-test.ts", {
  "@/lib/prisma": { prisma: {} },
  "@/lib/auth-env": { getAuthSecret: () => "rate-secret" },
  "@/lib/auth-security": { normalizeEmail },
  "@/lib/commerce/transactions": { runCommerceTransaction },
})

let securityEvents = []
const proofSource = await readFile(new URL("../lib/auth-two-factor-proof.ts", import.meta.url), "utf8")
const proof = loadCompiledModule(proofSource, "auth-two-factor-proof.test.ts", {
  "@/lib/prisma": { prisma: {} },
  "@/lib/auth-env": { getAuthSecret: () => "rate-secret" },
  "@/lib/auth-rate-limit": limiter,
  "@/lib/auth-security": {
    decryptSecret(encryptedSecret) {
      securityEvents.push(`decrypt:${encryptedSecret}`)
      if (encryptedSecret === "expired-encrypted") throw new Error("expired secret")
      return "totp-secret"
    },
    normalizeEmail,
    async verifyBackupCode(codeHash, code) {
      securityEvents.push(`backup:${codeHash}`)
      return (codeHash === "hash-one" && code === "BACKUP-ONE")
        || (codeHash === "hash-two" && code === "BACKUP-TWO")
    },
    verifyTotpCode(secret, code) {
      securityEvents.push(`totp:${secret}`)
      return secret === "totp-secret" && code === "123456"
    },
  },
})

const NOW = new Date("2026-08-29T12:00:00.000Z")
const NETWORK = "203.0.113.10"
const RATE_SECRET = "rate-secret"

describe("canonical current two-factor proof", () => {
  it("prepares a backup proof without consuming or retaining submitted proof material", async () => {
    const database = createProofDatabase()
    securityEvents = []

    const result = await proof.prepareCurrentTwoFactorProof(proofInput(database, "BACKUP-ONE"))

    assert.equal(result.status, "VERIFIED")
    assert.deepEqual(result.proof, {
      userId: "user-1",
      authSessionVersion: 7,
      twoFactorSecretId: "two-factor-1",
      enabledAtMs: NOW.getTime(),
      updatedAtMs: NOW.getTime(),
      kind: "BACKUP_CODE",
      backupCodeId: "backup-1",
    })
    assert.equal(database.backup("backup-1").usedAt, null)
    assert.doesNotMatch(JSON.stringify(result.proof), /BACKUP-ONE|totp-secret|encrypted/i)

    const consumed = await database.transaction((tx) => proof.consumePreparedTwoFactorProof(tx, result.proof, NOW))
    assert.equal(consumed, true)
    assert.deepEqual(database.backup("backup-1").usedAt, NOW)
  })

  it("distinguishes required, malformed, expired, unreadable, and disabled factor state", async () => {
    const requiredDb = createProofDatabase()
    assert.deepEqual(await proof.prepareCurrentTwoFactorProof(proofInput(requiredDb, "")), { status: "TWO_FACTOR_REQUIRED" })

    const malformedDb = createProofDatabase()
    assert.deepEqual(await proof.prepareCurrentTwoFactorProof(proofInput(malformedDb, "not-a-code")), { status: "TWO_FACTOR_INVALID" })

    const expiredTotpDb = createProofDatabase({ backupCodes: [] })
    assert.deepEqual(await proof.prepareCurrentTwoFactorProof(proofInput(expiredTotpDb, "654321")), { status: "TWO_FACTOR_INVALID" })

    const unreadableDb = createProofDatabase({ encryptedSecret: "expired-encrypted", backupCodes: [] })
    assert.deepEqual(await proof.prepareCurrentTwoFactorProof(proofInput(unreadableDb, "123456")), { status: "TWO_FACTOR_INVALID" })

    const disabledDb = createProofDatabase({ enabledAt: null })
    assert.deepEqual(await proof.prepareCurrentTwoFactorProof(proofInput(disabledDb, "123456")), { status: "NOT_ENABLED" })
  })

  it("checks the TWO_FACTOR limiter before decrypting or hashing a submitted code", async () => {
    const database = createProofDatabase()
    for (let index = 0; index < 8; index += 1) {
      await limiter.recordCredentialFailure(rateInput(database, "person@example.com"))
    }
    securityEvents = []

    assert.deepEqual(await proof.prepareCurrentTwoFactorProof(proofInput(database, "BACKUP-ONE")), {
      status: "RATE_LIMITED",
      retryAfterSeconds: 900,
    })
    assert.deepEqual(securityEvents, [])
  })

  it("prepares valid TOTP against an exact enabled-secret snapshot", async () => {
    const database = createProofDatabase()
    const result = await proof.prepareCurrentTwoFactorProof(proofInput(database, "123456"))

    assert.equal(result.status, "VERIFIED")
    assert.equal(result.proof.kind, "TOTP")
    assert.equal(result.proof.backupCodeId, null)
    assert.doesNotMatch(JSON.stringify(result.proof), /123456|totp-secret|encrypted/i)

    database.secret().updatedAt = new Date(NOW.getTime() + 1)
    assert.equal(await database.transaction((tx) => proof.consumePreparedTwoFactorProof(tx, result.proof, NOW)), false)

    const changedSessionDatabase = createProofDatabase()
    const changedSessionResult = await proof.prepareCurrentTwoFactorProof(proofInput(changedSessionDatabase, "123456"))
    assert.equal(changedSessionResult.status, "VERIFIED")
    changedSessionDatabase.account().authSessionVersion += 1
    assert.equal(await changedSessionDatabase.transaction((tx) => (
      proof.consumePreparedTwoFactorProof(tx, changedSessionResult.proof, NOW)
    )), false)
  })

  it("allows exactly one transaction to consume a prepared backup proof", async () => {
    const database = createProofDatabase()
    const result = await proof.prepareCurrentTwoFactorProof(proofInput(database, "BACKUP-ONE"))
    assert.equal(result.status, "VERIFIED")

    const outcomes = await Promise.all([
      database.transaction((tx) => proof.consumePreparedTwoFactorProof(tx, result.proof, NOW)),
      database.transaction((tx) => proof.consumePreparedTwoFactorProof(tx, result.proof, NOW)),
    ])

    assert.deepEqual(outcomes.sort(), [false, true])
    assert.deepEqual(database.backup("backup-1").usedAt, NOW)
  })

  it("rolls back prepared backup consumption with its surrounding transaction", async () => {
    const database = createProofDatabase()
    const result = await proof.prepareCurrentTwoFactorProof(proofInput(database, "BACKUP-ONE"))
    assert.equal(result.status, "VERIFIED")

    await assert.rejects(database.transaction(async (tx) => {
      assert.equal(await proof.consumePreparedTwoFactorProof(tx, result.proof, NOW), true)
      throw new Error("later mutation failed")
    }), /later mutation failed/)

    assert.equal(database.backup("backup-1").usedAt, null)
  })

  it("clears only factor account pressure while preserving login and shared network pressure", async () => {
    const database = createProofDatabase()
    await limiter.recordCredentialFailure({ ...rateInput(database, "person@example.com"), purpose: "LOGIN" })
    await limiter.recordCredentialFailure(rateInput(database, "person@example.com"))

    const result = await proof.prepareCurrentTwoFactorProof(proofInput(database, "123456"))

    assert.equal(result.status, "VERIFIED")
    assert.deepEqual(
      database.rateRows.map(({ purpose, scope, count }) => ({ purpose, scope, count })).sort((left, right) => `${left.purpose}:${left.scope}`.localeCompare(`${right.purpose}:${right.scope}`)),
      [
        { purpose: "LOGIN", scope: "ACCOUNT", count: 1 },
        { purpose: "LOGIN", scope: "NETWORK", count: 1 },
        { purpose: "TWO_FACTOR", scope: "NETWORK", count: 1 },
      ],
    )
  })
})

function proofInput(prismaClient, twoFactorCode) {
  return {
    prismaClient,
    userId: "user-1",
    twoFactorCode,
    networkIdentifier: NETWORK,
    secret: RATE_SECRET,
    now: NOW,
  }
}

function rateInput(prismaClient, email) {
  return {
    prismaClient,
    purpose: "TWO_FACTOR",
    email,
    networkIdentifier: NETWORK,
    secret: RATE_SECRET,
    now: NOW,
    shouldPrune: () => false,
  }
}

function createProofDatabase({
  encryptedSecret = "encrypted-secret",
  enabledAt = NOW,
  backupCodes = [
    { id: "backup-1", userId: "user-1", codeHash: "hash-one", usedAt: null, createdAt: NOW },
    { id: "backup-2", userId: "user-1", codeHash: "hash-two", usedAt: null, createdAt: NOW },
  ],
} = {}) {
  const state = {
    users: [{ id: "user-1", email: "person@example.com", authSessionVersion: 7 }],
    secrets: [{
      id: "two-factor-1",
      userId: "user-1",
      encryptedSecret,
      enabledAt,
      updatedAt: NOW,
    }],
    backups: structuredClone(backupCodes),
    rateRows: [],
  }
  let transactionQueue = Promise.resolve()

  const database = buildClient(state)
  Object.defineProperties(database, {
    rateRows: { get: () => state.rateRows },
  })
  database.secret = () => state.secrets[0]
  database.account = () => state.users[0]
  database.backup = (id) => state.backups.find((candidate) => candidate.id === id)
  database.transaction = async (callback) => {
    let release
    const prior = transactionQueue
    transactionQueue = new Promise((resolve) => { release = resolve })
    await prior
    const snapshot = structuredClone(state)
    try {
      return await callback(buildClient(state))
    } catch (error) {
      replaceState(state, snapshot)
      throw error
    } finally {
      release()
    }
  }
  database.$transaction = async (callback, options) => {
    assert.equal(options?.isolationLevel, "Serializable")
    return database.transaction(callback)
  }
  return database
}

function buildClient(state) {
  const rateStore = {
    get rows() { return state.rateRows },
    replace(rows) { state.rateRows = rows },
  }
  return {
    user: {
      async findUnique({ where }) {
        const user = state.users.find((candidate) => candidate.id === where.id)
        if (!user) return null
        return {
          ...structuredClone(user),
          twoFactorSecret: structuredClone(state.secrets.find((candidate) => candidate.userId === user.id) ?? null),
          backupCodes: structuredClone(state.backups.filter((candidate) => candidate.userId === user.id && candidate.usedAt === null)),
        }
      },
      async findFirst({ where }) {
        return structuredClone(state.users.find((candidate) => (
          candidate.id === where.id && candidate.authSessionVersion === where.authSessionVersion
        )) ?? null)
      },
    },
    twoFactorSecret: {
      async findFirst({ where }) {
        return structuredClone(state.secrets.find((candidate) => matchesSecret(candidate, where)) ?? null)
      },
    },
    backupCode: {
      async updateMany({ where, data }) {
        const matches = state.backups.filter((candidate) => (
          candidate.id === where.id
          && candidate.userId === where.userId
          && candidate.usedAt === where.usedAt
        ))
        for (const candidate of matches) candidate.usedAt = new Date(data.usedAt)
        return { count: matches.length }
      },
    },
    authRateLimitBucket: createBucketDelegate(rateStore),
  }
}

function matchesSecret(candidate, where) {
  return candidate.id === where.id
    && candidate.userId === where.userId
    && candidate.enabledAt?.getTime() === where.enabledAt?.getTime()
    && candidate.updatedAt.getTime() === where.updatedAt.getTime()
}

function createBucketDelegate(store) {
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
    async findMany() { return [] },
    async deleteMany({ where }) {
      const before = store.rows.length
      store.replace(store.rows.filter((row) => {
        const matchesScope = where.scope ? row.scope === where.scope : true
        const matchesPurpose = where.purpose ? row.purpose === where.purpose : true
        const matchesHash = where.keyHash ? row.keyHash === where.keyHash : true
        return !(matchesScope && matchesPurpose && matchesHash)
      }))
      return { count: before - store.rows.length }
    },
  }
}

function replaceState(target, source) {
  for (const key of Object.keys(target)) target[key] = structuredClone(source[key])
}
