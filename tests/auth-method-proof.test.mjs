import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import { runCommerceTransaction } from "../lib/commerce/transactions.ts"
import { createCompiledModuleLoader } from "./helpers/compiled-module.mjs"

const loadCompiledModule = createCompiledModuleLoader(import.meta.url)
const normalizeEmail = (value) => String(value ?? "").trim().toLowerCase()
const limiterSource = await readFile(new URL("../lib/auth-rate-limit.ts", import.meta.url), "utf8")
const limiter = loadCompiledModule(limiterSource, "auth-rate-limit.proof-test.ts", {
  "@/lib/prisma": { prisma: {} },
  "@/lib/auth-env": { getAuthSecret: () => "secret" },
  "@/lib/auth-security": { normalizeEmail },
  "@/lib/commerce/transactions": { runCommerceTransaction },
})
const proofSource = await readFile(new URL("../lib/auth-method-proof.ts", import.meta.url), "utf8")
const proof = loadCompiledModule(proofSource, "auth-method-proof.test.ts", {
  "@/lib/prisma": { prisma: {} },
  "@/lib/auth-env": { getAuthSecret: () => "secret" },
  "@/lib/auth-rate-limit": limiter,
  "@/lib/auth-security": {
    decryptSecret: () => "",
    normalizeEmail,
    verifyBackupCode: async () => false,
    verifyPassword: async () => false,
    verifyTotpCode: () => false,
  },
  "@/lib/normalized-user-email": {
    resolveNormalizedUserId: async ({ prismaClient, email }) => prismaClient.resolveNormalizedUserId(email),
  },
})

const NOW = new Date("2026-08-28T12:00:00.000Z")

describe("shared password method proof with the real limiter", () => {
  it("rejects a pre-blocked account before password proof", async () => {
    const scenario = proofInput()
    for (let index = 0; index < 8; index += 1) {
      await limiter.recordCredentialFailure(rateInput(scenario.database, "LOGIN"))
    }

    assert.deepEqual(await proof.verifyPasswordMethodProof(scenario.input), { status: "RATE_LIMITED" })
    assert.equal(scenario.calls.includes("password"), false)
  })

  it("rechecks account pressure after a userId lookup before password proof", async () => {
    const scenario = proofInput({ userId: "user-1" })
    for (let index = 0; index < 8; index += 1) {
      await limiter.recordCredentialFailure(rateInput(scenario.database, "LOGIN"))
    }

    assert.deepEqual(await proof.verifyPasswordMethodProof(scenario.input), { status: "RATE_LIMITED" })
    assert.equal(scenario.calls.includes("password"), false)
  })

  for (const accountShape of ["missing user", "missing password credential"]) {
    it(`performs one equal-cost password verification for a ${accountShape}`, async () => {
      const scenario = proofInput({
        userExists: accountShape !== "missing user",
        hasPasswordCredential: accountShape !== "missing password credential",
      })

      assert.deepEqual(await proof.verifyPasswordMethodProof(scenario.input), { status: "INVALID" })
      assert.deepEqual(scenario.calls, ["password"])
      assert.equal(scenario.passwordHashes.length, 1)
      assert.match(scenario.passwordHashes[0], /^\$argon2id\$v=19\$m=19456,t=2,p=1\$/)
    })
  }

  it("resolves a padded mixed-case stored account by normalized email, then loads it by ID", async () => {
    const scenario = proofInput({ passwordValid: false, storedEmail: " Person@Example.com " })
    assert.deepEqual(await proof.verifyPasswordMethodProof(scenario.input), { status: "INVALID" })
    assert.deepEqual(scenario.database.normalizedLookups, ["person@example.com"])
    assert.deepEqual(scenario.database.userLookups, [{ id: "user-1" }])
    assert.deepEqual(
      scenario.database.rows.map(({ purpose, scope, count }) => ({ purpose, scope, count })).sort((a, b) => a.scope.localeCompare(b.scope)),
      [
        { purpose: "LOGIN", scope: "ACCOUNT", count: 1 },
        { purpose: "LOGIN", scope: "NETWORK", count: 1 },
      ],
    )
    assert.equal(scenario.database.transactionOptions.at(-1)?.isolationLevel, "Serializable")
  })

  it("does not record a valid password for an unverified email", async () => {
    const scenario = proofInput({ emailVerified: null })
    assert.deepEqual(await proof.verifyPasswordMethodProof(scenario.input), { status: "EMAIL_UNVERIFIED" })
    assert.equal(scenario.database.rows.length, 0)
  })

  it("requires 2FA without charging, records invalid TOTP in both scopes, and accepts valid TOTP", async () => {
    const required = proofInput({ twoFactorEnabled: true })
    assert.deepEqual(await proof.verifyPasswordMethodProof(required.input), { status: "TWO_FACTOR_REQUIRED" })
    assert.equal(required.database.rows.length, 0)

    const invalid = proofInput({ twoFactorEnabled: true, twoFactorCode: "bad" })
    assert.deepEqual(await proof.verifyPasswordMethodProof(invalid.input), { status: "TWO_FACTOR_INVALID" })
    assert.deepEqual(invalid.database.rows.map(({ purpose, scope }) => ({ purpose, scope })).sort((a, b) => a.scope.localeCompare(b.scope)), [
      { purpose: "TWO_FACTOR", scope: "ACCOUNT" },
      { purpose: "TWO_FACTOR", scope: "NETWORK" },
    ])

    const valid = proofInput({ twoFactorEnabled: true, twoFactorCode: "123456", totpValid: true })
    assert.deepEqual(await proof.verifyPasswordMethodProof(valid.input), { status: "VERIFIED", userId: "user-1", backupCodeConsumed: false, authSessionVersion: 7 })
    assert.equal(valid.database.rows.length, 0)
  })

  it("uses userId for account-method proof and clears only account failures while preserving network pressure", async () => {
    const scenario = proofInput({ userId: "user-1" })
    await limiter.recordCredentialFailure(rateInput(scenario.database, "LOGIN"))
    assert.equal(scenario.database.rows.length, 2)

    assert.deepEqual(await proof.verifyPasswordMethodProof(scenario.input), { status: "VERIFIED", userId: "user-1", backupCodeConsumed: false, authSessionVersion: 7 })
    assert.deepEqual(scenario.database.userLookups, [{ id: "user-1" }])
    assert.deepEqual(scenario.database.rows.map(({ purpose, scope, count }) => ({ purpose, scope, count })), [
      { purpose: "LOGIN", scope: "NETWORK", count: 1 },
    ])
  })

  it("consumes one backup code once under concurrent proof and gives the loser real limiter pressure", async () => {
    const scenario = proofInput({ twoFactorEnabled: true, twoFactorCode: "backup", backupValid: true })
    const [first, second] = await Promise.all([
      proof.verifyPasswordMethodProof(scenario.input),
      proof.verifyPasswordMethodProof(scenario.input),
    ])
    assert.deepEqual([first.status, second.status].sort(), ["TWO_FACTOR_INVALID", "VERIFIED"])
    assert.equal(scenario.database.backupUpdateCalls.every((call) => call.where.usedAt === null), true)
    assert.equal(scenario.database.rows.some((row) => row.purpose === "TWO_FACTOR" && row.scope === "NETWORK" && row.count === 1), true)
  })
})

function proofInput({
  passwordValid = true,
  emailVerified = NOW,
  twoFactorEnabled = false,
  twoFactorCode = "",
  totpValid = false,
  backupValid = false,
  userId,
  storedEmail = "person@example.com",
  userExists = true,
  hasPasswordCredential = true,
} = {}) {
  const calls = []
  const passwordHashes = []
  const user = userExists ? {
    id: "user-1",
    email: storedEmail,
    emailVerified,
    authSessionVersion: 7,
    passwordCredential: hasPasswordCredential ? { passwordHash: "hash" } : null,
    twoFactorSecret: twoFactorEnabled ? { enabledAt: NOW, encryptedSecret: "encrypted" } : null,
    backupCodes: backupValid ? [{ id: "backup-1", codeHash: "backup-hash" }] : [],
  } : null
  const database = createProofDatabase(user)
  return {
    calls,
    passwordHashes,
    database,
    input: {
      prismaClient: database,
      ...(userId ? { userId } : { email: " PERSON@Example.com " }),
      password: "password",
      twoFactorCode,
      networkIdentifier: "192.0.2.1",
      secret: "secret",
      now: NOW,
      dependencies: {
        async verifyPassword(passwordHash) {
          calls.push("password")
          passwordHashes.push(passwordHash)
          return passwordValid
        },
        decryptSecret() { return "totp-secret" },
        verifyTotpCode() { return totpValid },
        async verifyBackupCode() { return backupValid },
        normalizeEmail,
        async resolveNormalizedUserId({ prismaClient, email }) {
          return prismaClient.resolveNormalizedUserId(email)
        },
      },
    },
  }
}

function rateInput(prismaClient, purpose) {
  return {
    prismaClient,
    purpose,
    email: "person@example.com",
    networkIdentifier: "192.0.2.1",
    secret: "secret",
    now: NOW,
    shouldPrune: () => false,
  }
}

function createProofDatabase(user) {
  let committedRows = []
  let version = 0
  let backupUnused = true
  const transactionOptions = []
  const rootStore = { get rows() { return committedRows }, replace(rows) { committedRows = rows } }
  const database = {
    get rows() { return committedRows },
    transactionOptions,
    userLookups: [],
    normalizedLookups: [],
    backupUpdateCalls: [],
    authRateLimitBucket: createBucketDelegate(rootStore),
    user: {
      async findUnique({ where }) {
        database.userLookups.push(structuredClone(where))
        return where.id === user?.id ? structuredClone(user) : null
      },
    },
    resolveNormalizedUserId(email) {
      database.normalizedLookups.push(email)
      return user && normalizeEmail(user.email) === email ? user.id : null
    },
    backupCode: {
      async updateMany(args) {
        database.backupUpdateCalls.push(structuredClone(args))
        if (!backupUnused) return { count: 0 }
        backupUnused = false
        return { count: 1 }
      },
    },
    async $transaction(callback, options) {
      transactionOptions.push(options)
      const baseVersion = version
      let workingRows = structuredClone(committedRows)
      const workingStore = { get rows() { return workingRows }, replace(rows) { workingRows = rows } }
      const result = await callback({ authRateLimitBucket: createBucketDelegate(workingStore) })
      await Promise.resolve()
      if (version !== baseVersion) throw Object.assign(new Error("serialization conflict"), { code: "P2034" })
      committedRows = workingRows
      version += 1
      return result
    },
  }
  return database
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
