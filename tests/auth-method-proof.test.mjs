import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import { createCompiledModuleLoader } from "./helpers/compiled-module.mjs"

const loadCompiledModule = createCompiledModuleLoader(import.meta.url)
const source = await readFile(new URL("../lib/auth-method-proof.ts", import.meta.url), "utf8")
const proof = loadCompiledModule(source, "auth-method-proof.test.ts", {
  "@/lib/prisma": { prisma: {} },
  "@/lib/auth-env": { getAuthSecret: () => "secret" },
  "@/lib/auth-rate-limit": {},
  "@/lib/auth-security": {},
})

const NOW = new Date("2026-08-28T12:00:00.000Z")

describe("shared password method proof", () => {
  it("rejects before proof when the limiter is blocked", async () => {
    const { input, calls } = proofInput()
    input.dependencies.checkCredentialRateLimit = async () => { calls.push("check"); return { allowed: false, retryAfterSeconds: 12 } }
    assert.deepEqual(await proof.verifyPasswordMethodProof(input), { status: "RATE_LIMITED" })
    assert.deepEqual(calls, ["check"])
  })

  it("records invalid password but does not record an unverified email", async () => {
    const invalid = proofInput({ passwordValid: false })
    assert.deepEqual(await proof.verifyPasswordMethodProof(invalid.input), { status: "INVALID" })
    assert.deepEqual(invalid.calls, ["check", "check", "password", "failure:LOGIN"])

    const unverified = proofInput({ emailVerified: null })
    assert.deepEqual(await proof.verifyPasswordMethodProof(unverified.input), { status: "EMAIL_UNVERIFIED" })
    assert.deepEqual(unverified.calls, ["check", "check", "password"])
  })

  it("requires 2FA, records an invalid code, and verifies a TOTP without charging the network", async () => {
    const required = proofInput({ twoFactorEnabled: true })
    assert.deepEqual(await proof.verifyPasswordMethodProof(required.input), { status: "TWO_FACTOR_REQUIRED" })
    assert.equal(required.calls.includes("failure:TWO_FACTOR"), false)

    const invalid = proofInput({ twoFactorEnabled: true, twoFactorCode: "bad" })
    assert.deepEqual(await proof.verifyPasswordMethodProof(invalid.input), { status: "TWO_FACTOR_INVALID" })
    assert.equal(invalid.calls.includes("failure:TWO_FACTOR"), true)

    const valid = proofInput({ twoFactorEnabled: true, twoFactorCode: "123456", totpValid: true })
    assert.deepEqual(await proof.verifyPasswordMethodProof(valid.input), { status: "VERIFIED", backupCodeConsumed: false, authSessionVersion: 7 })
    assert.deepEqual(valid.calls.slice(-1), ["clear-account"])
  })

  it("consumes a backup code once and allows only one concurrent winner", async () => {
    const shared = proofInput({ twoFactorEnabled: true, twoFactorCode: "backup", backupValid: true })
    const [first, second] = await Promise.all([
      proof.verifyPasswordMethodProof(shared.input),
      proof.verifyPasswordMethodProof(shared.input),
    ])
    assert.deepEqual([first.status, second.status].sort(), ["TWO_FACTOR_INVALID", "VERIFIED"])
    assert.equal(shared.database.backupUpdateCalls.every((call) => call.where.usedAt === null), true)
  })
})

function proofInput({ passwordValid = true, emailVerified = NOW, twoFactorEnabled = false, twoFactorCode = "", totpValid = false, backupValid = false } = {}) {
  const calls = []
  let backupUnused = true
  const user = {
    id: "user-1", email: "person@example.com", emailVerified, authSessionVersion: 7,
    passwordCredential: { passwordHash: "hash" },
    twoFactorSecret: twoFactorEnabled ? { enabledAt: NOW, encryptedSecret: "encrypted" } : null,
    backupCodes: backupValid ? [{ id: "backup-1", codeHash: "backup-hash" }] : [],
  }
  const database = {
    backupUpdateCalls: [],
    user: { async findUnique() { return user } },
    backupCode: {
      async updateMany(args) {
        database.backupUpdateCalls.push(args)
        if (!backupUnused) return { count: 0 }
        backupUnused = false
        return { count: 1 }
      },
    },
  }
  return {
    calls,
    database,
    input: {
      prismaClient: database,
      email: "PERSON@example.com",
      password: "password",
      twoFactorCode,
      networkIdentifier: "192.0.2.1",
      secret: "secret",
      now: NOW,
      dependencies: {
        async checkCredentialRateLimit() { calls.push("check"); return { allowed: true } },
        async recordCredentialFailure({ purpose }) { calls.push(`failure:${purpose}`) },
        async clearCredentialAccountFailures() { calls.push("clear-account") },
        async verifyPassword() { calls.push("password"); return passwordValid },
        decryptSecret() { return "totp-secret" },
        verifyTotpCode() { return totpValid },
        async verifyBackupCode() { return backupValid },
        normalizeEmail(value) { return String(value).trim().toLowerCase() },
      },
    },
  }
}
