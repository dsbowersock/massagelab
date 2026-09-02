import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"

import * as enrollmentBinding from "../lib/two-factor-enrollment-binding.ts"
import {
  consumeFreshGoogleReauth,
  isFreshConsumedGoogleReauth,
} from "../lib/auth-method-intent-proof.ts"
import { safeErrorCode } from "../lib/safe-error-code.js"
import { createCompiledModuleLoader } from "./helpers/compiled-module.mjs"

const NOW = new Date("2026-08-29T12:00:00.000Z")
const AUTH_SECRET = "task-four-auth-secret"
const NETWORK = "203.0.113.44"
const MANUAL_CODE = "JBSWY3DPEHPK3PXP"
const ENCRYPTED_SECRET = "encrypted-task-four-secret"
const OTPAUTH_URL = "otpauth://totp/MassageLab:member@example.test?secret=redacted"
const QR_CODE = "data:image/png;base64,task-four-qr"

const googleManagementScenarios = [
  {
    label: "linked Google disable",
    operation: "DISABLE",
    purpose: "DISABLE_TWO_FACTOR",
    passwordEnabled: true,
    twoFactorCode: "123456",
  },
  {
    label: "Google-only legacy regenerate",
    operation: "REGENERATE",
    purpose: "REGENERATE_TWO_FACTOR_BACKUP_CODES",
    passwordEnabled: false,
    twoFactorCode: "BACKUP-CURRENT",
  },
  {
    label: "linked Google regenerate",
    operation: "REGENERATE",
    purpose: "REGENERATE_TWO_FACTOR_BACKUP_CODES",
    passwordEnabled: true,
    twoFactorCode: "123456",
  },
  {
    label: "Google-only legacy disable",
    operation: "DISABLE",
    purpose: "DISABLE_TWO_FACTOR",
    passwordEnabled: false,
    twoFactorCode: "BACKUP-CURRENT",
  },
]

const source = await readFile(
  new URL("../lib/account-two-factor-management.ts", import.meta.url),
  "utf8",
)
const loadCompiledModule = createCompiledModuleLoader(import.meta.url)
const service = loadCompiledModule(source, "account-two-factor-management.test.ts", {
  "@/lib/auth-env": { getAuthSecret: () => AUTH_SECRET },
  "@/lib/auth-method-intent-proof": {
    isFreshConsumedGoogleReauth,
    consumeFreshGoogleReauth: consumeGoogleProofWithFailureHooks,
  },
  "@/lib/auth-method-proof": {
    verifyPasswordMethodProof: async () => ({ status: "INVALID" }),
    preparePasswordMethodProofForTwoFactorManagement: async () => ({ status: "INVALID" }),
  },
  "@/lib/auth-rate-limit": {
    checkCredentialRateLimit: async () => ({ allowed: true }),
    clearCredentialAccountFailure: async () => {},
    recordCredentialFailure: async () => ({ allowed: true }),
  },
  "@/lib/auth-security": { normalizeEmail: (value) => String(value ?? "").trim().toLowerCase() },
  "@/lib/auth-two-factor-proof": {
    prepareCurrentTwoFactorProof: async () => ({ status: "TWO_FACTOR_INVALID" }),
    consumePreparedTwoFactorProof: async () => false,
  },
  "@/lib/commerce/transactions": {
    runCommerceTransaction: (client, callback) => client.$transaction(callback, { isolationLevel: "Serializable" }),
  },
  "@/lib/prisma": { prisma: {} },
  "@/lib/safe-error-code": { safeErrorCode },
  "@/lib/two-factor-enrollment-binding": enrollmentBinding,
  "qrcode": { toDataURL: async () => QR_CODE },
})

describe("proved and browser-bound two-factor enrollment", () => {
  it("exports every planned two-factor state-machine entry point", () => {
    assert.equal(typeof service.startTwoFactorEnrollment, "function")
    assert.equal(typeof service.enableTwoFactor, "function")
    assert.equal(typeof service.disableTwoFactor, "function")
    assert.equal(typeof service.regenerateBackupCodes, "function")
  })

  it("requires exact confirmation and a correct password for password-only setup", async () => {
    const unconfirmed = createDatabase()
    assert.deepEqual(
      await start(unconfirmed, { confirmed: false }),
      { status: "REJECTED", code: "INVALID_REQUEST" },
    )
    assert.equal(unconfirmed.reads, 0)

    const wrong = createDatabase()
    const wrongDeps = dependencies({ passwordResult: { status: "INVALID" } })
    assert.deepEqual(await start(wrong, { dependencies: wrongDeps }), {
      status: "REJECTED",
      code: "PRIMARY_PROOF_INVALID",
    })
    assert.equal(wrong.secret, null)

    const database = createDatabase()
    const result = await start(database)
    assertSetupReady(result)
    assert.equal(database.secret.enabledAt, null)
    assert.equal(database.secret.encryptedSecret, ENCRYPTED_SECRET)
    assert.equal(database.user.authSessionVersion, 7)
    assert.equal(database.sessions.length, 2)
    assert.equal(database.backups.length, 1, "setup must not replace orphan codes")
    assert.deepEqual(database.transactionOptions, [{ isolationLevel: "Serializable" }])
    assert.equal(database.events.indexOf("generate-secret") < database.events.indexOf("transaction"), true)
    assert.equal(database.events.indexOf("encrypt-secret") < database.events.indexOf("transaction"), true)
    assert.equal(database.events.indexOf("render-qr") < database.events.indexOf("transaction"), true)
  })

  it("preserves the exact password-proof retry duration through setup", async () => {
    const database = createDatabase()
    const result = await start(database, {
      dependencies: dependencies({
        passwordResult: { status: "RATE_LIMITED", retryAfterSeconds: 137 },
      }),
    })

    assert.deepEqual(result, {
      status: "REJECTED",
      code: "RATE_LIMITED",
      retryAfterSeconds: 137,
    })
    assert.equal(database.secret, null)
  })

  it("accepts either password or one-use fresh Google proof for a linked account", async () => {
    const passwordDatabase = createDatabase({ googleLinked: true })
    assertSetupReady(await start(passwordDatabase))

    const googleDatabase = createDatabase({ googleLinked: true, googleIntent: freshGoogleIntent() })
    const result = await start(googleDatabase, {
      primaryProof: { kind: "GOOGLE", intentId: "intent-1" },
    })
    assertSetupReady(result)
    assert.equal(googleDatabase.intent.providerProvenAt, null)
    assert.equal(googleDatabase.events.includes("consume-google"), true)
    assert.equal(googleDatabase.events.indexOf("transaction") < googleDatabase.events.indexOf("consume-google"), true)
  })

  it("rolls Google proof back when its pending-row write loses the exact CAS", async () => {
    const database = createDatabase({
      googleLinked: true,
      googleIntent: freshGoogleIntent(),
      pending: true,
    })
    database.failPoint = "after-secret-cas"
    const before = database.snapshot()

    assert.deepEqual(await start(database, {
      primaryProof: { kind: "GOOGLE", intentId: "intent-1" },
    }), { status: "REJECTED", code: "CONFLICT" })
    assert.deepEqual(database.snapshot(), before)
    assert.notEqual(database.intent.providerProvenAt, null)
  })

  it("rejects Google-only setup before proof, generation, or writes", async () => {
    for (const primaryProof of [
      { kind: "PASSWORD", password: "correct-password" },
      { kind: "GOOGLE", intentId: "intent-1" },
    ]) {
      const database = createDatabase({ passwordEnabled: false, googleLinked: true, googleIntent: freshGoogleIntent() })
      const deps = dependencies()
      const result = await start(database, { primaryProof, dependencies: deps })
      assert.deepEqual(result, { status: "REJECTED", code: "PASSWORD_REQUIRED" })
      assert.deepEqual(database.events, [])
      assert.equal(database.secret, null)
      assert.notEqual(database.intent.providerProvenAt, null)
    }
  })

  it("keeps an enabled row immutable before password, Google, generation, encryption, or QR work", async () => {
    for (const primaryProof of [
      { kind: "PASSWORD", password: "correct-password" },
      { kind: "GOOGLE", intentId: "intent-1" },
    ]) {
      const database = createDatabase({ enabled: true, googleLinked: true, googleIntent: freshGoogleIntent() })
      const before = database.snapshot()
      assert.deepEqual(await start(database, { primaryProof }), {
        status: "REJECTED",
        code: "ALREADY_ENABLED",
      })
      assert.deepEqual(database.snapshot(), before)
      assert.deepEqual(database.events, [])
    }
  })

  it("replaces a legacy pending row only after fresh proof and makes its old row unusable", async () => {
    const database = createDatabase({ pending: true })
    const legacyRow = structuredClone(database.secret)
    const oldBinding = enrollmentBinding.signTwoFactorEnrollmentBinding({
      authSecret: AUTH_SECRET,
      userId: database.user.id,
      authSessionVersion: database.user.authSessionVersion,
      twoFactorSecretId: legacyRow.id,
      encryptedSecret: legacyRow.encryptedSecret,
      updatedAt: legacyRow.updatedAt,
      now: NOW,
    })

    assert.deepEqual(await service.enableTwoFactor(enableInput(database, "")), {
      status: "REJECTED",
      code: "ENROLLMENT_EXPIRED",
    })

    const replacement = await start(database)
    assertSetupReady(replacement)
    assert.equal(database.secret.id, legacyRow.id)
    assert.notEqual(database.secret.encryptedSecret, legacyRow.encryptedSecret)
    assert.deepEqual(await service.enableTwoFactor(enableInput(database, oldBinding)), {
      status: "REJECTED",
      code: "ENROLLMENT_EXPIRED",
    })
    assert.equal((await service.enableTwoFactor(enableInput(database, replacement.enrollmentBinding))).status, "ENABLED")
  })

  for (const failingStep of ["generate-secret", "encrypt-secret", "render-qr"]) {
    it(`leaves no pending row when ${failingStep} fails before the transaction`, async () => {
      const database = createDatabase()
      const result = await start(database, { dependencies: dependencies({ throwAt: failingStep }) })
      assert.deepEqual(result, { status: "REJECTED", code: "CONFLICT" })
      assert.equal(database.secret, null)
      assert.equal(database.transactions, 0)
    })
  }

  it("allows exactly one concurrent setup to own the committed pending fingerprint", { timeout: 5_000 }, async () => {
    const database = createDatabase()
    const gate = deferred()
    let proofCalls = 0
    const deps = dependencies({
      async verifyPasswordMethodProof() {
        proofCalls += 1
        if (proofCalls === 2) gate.resolve()
        await gate.promise
        return { status: "VERIFIED", userId: "user-1", authSessionVersion: 7, backupCodeConsumed: false }
      },
      generateTotpSecret() {
        const suffix = String(proofCalls)
        return { secret: `${MANUAL_CODE}${suffix}`, otpauthUrl: `${OTPAUTH_URL}&attempt=${suffix}` }
      },
      encryptSecret(secret) { return `encrypted-${secret}` },
    })

    const setupRequests = [
      start(database, { dependencies: deps }),
      start(database, { dependencies: deps }),
    ]
    let results
    let primaryFailure
    try {
      await boundedLatch(gate.promise, "concurrent setup proof gate")
      results = await boundedLatch(Promise.all(setupRequests), "concurrent setup completion")
    } catch (error) {
      primaryFailure = error
    } finally {
      gate.resolve()
    }
    let cleanupFailure
    try {
      await boundedLatch(Promise.allSettled(setupRequests), "concurrent setup cleanup")
    } catch (error) {
      cleanupFailure = error
    }
    if (primaryFailure && cleanupFailure) {
      throw new AggregateError(
        [primaryFailure, cleanupFailure],
        "concurrent setup and bounded cleanup both failed",
      )
    }
    if (primaryFailure) throw primaryFailure
    if (cleanupFailure) throw cleanupFailure
    assert.deepEqual(results.map((result) => result.status).sort(), ["REJECTED", "SETUP_READY"])
    const loser = results.find((result) => result.status === "REJECTED")
    assert.equal(loser.code, "CONFLICT")
    assert.equal(Object.hasOwn(loser, "enrollmentBinding"), false)
    const winner = results.find((result) => result.status === "SETUP_READY")
    assert.equal((await service.enableTwoFactor(enableInput(database, winner.enrollmentBinding, { dependencies: deps }))).status, "ENABLED")
  })

  it("rejects missing, tampered, expired, wrong-user, wrong-version, and wrong-row bindings", async () => {
    const setupCases = [
      ["missing", () => ""],
      ["tampered", (value) => `${value.slice(0, -1)}${value.endsWith("A") ? "B" : "A"}`],
      ["expired", (value) => value, { now: new Date(NOW.getTime() + 5 * 60_000) }],
      ["wrong-user", (value) => value, { mutate: (db) => { db.user.id = "user-2" } }],
      ["wrong-version", (value) => value, { mutate: (db) => { db.user.authSessionVersion += 1 } }],
      ["wrong-row", (value) => value, { mutate: (db) => { db.secret.id = "different-row" } }],
      ["wrong-fingerprint", (value) => value, { mutate: (db) => { db.secret.encryptedSecret += "-changed" } }],
    ]
    for (const [label, change, options = {}] of setupCases) {
      const database = createDatabase()
      const setup = await start(database)
      options.mutate?.(database)
      const before = database.snapshot()
      const result = await service.enableTwoFactor(enableInput(database, change(setup.enrollmentBinding), { now: options.now }))
      assert.deepEqual(result, { status: "REJECTED", code: "ENROLLMENT_EXPIRED" }, label)
      assert.deepEqual(database.snapshot(), before, label)
    }
  })

  it("rate-limits before decrypt and records invalid new-code pressure with exact retry", async () => {
    const blocked = createDatabase()
    const blockedSetup = await start(blocked)
    let decryptCalls = 0
    assert.deepEqual(await service.enableTwoFactor(enableInput(blocked, blockedSetup.enrollmentBinding, {
      dependencies: dependencies({
        checkRateLimit: { allowed: false, retryAfterSeconds: 73 },
        decryptSecret() { decryptCalls += 1; return MANUAL_CODE },
      }),
    })), { status: "REJECTED", code: "RATE_LIMITED", retryAfterSeconds: 73 })
    assert.equal(decryptCalls, 0)

    const invalid = createDatabase()
    const invalidSetup = await start(invalid)
    const result = await service.enableTwoFactor(enableInput(invalid, invalidSetup.enrollmentBinding, {
      code: "000000",
      dependencies: dependencies({ validTotpCode: "123456", failureRetryAfterSeconds: 61 }),
    }))
    assert.deepEqual(result, { status: "REJECTED", code: "TWO_FACTOR_INVALID", retryAfterSeconds: 61 })
    assert.equal(invalid.events.includes("record-factor-failure"), true)
    assert.equal(invalid.secret.enabledAt, null)
  })

  it("requires exact enable confirmation before binding, limiter, or database work", async () => {
    const database = createDatabase()
    const setup = await start(database)
    const readsBefore = database.reads
    const eventsBefore = [...database.events]

    assert.deepEqual(await service.enableTwoFactor(enableInput(database, setup.enrollmentBinding, {
      confirmed: false,
    })), { status: "REJECTED", code: "INVALID_REQUEST" })
    assert.equal(database.reads, readsBefore)
    assert.deepEqual(database.events, eventsBefore)
    assert.equal(database.secret.enabledAt, null)
  })

  it("prehashes exactly eight codes before enabling and atomically revokes sessions", async () => {
    const database = createDatabase()
    const setup = await start(database)
    const deps = dependencies({ database })
    const result = await service.enableTwoFactor(enableInput(database, setup.enrollmentBinding, { dependencies: deps }))

    assert.deepEqual(result, { status: "ENABLED", backupCodes: backupCodes() })
    assert.equal(database.secret.enabledAt.getTime(), NOW.getTime())
    assert.equal(database.backups.length, 8)
    assert.deepEqual(database.backups.map(({ codeHash }) => codeHash), backupCodes().map((code) => `hash:${code}`))
    assert.equal(database.backups.some((row) => backupCodes().includes(row.codeHash)), false)
    assert.equal(database.user.authSessionVersion, 8)
    assert.equal(database.sessions.length, 0)
    assert.equal(database.events.filter((event) => event.startsWith("hash:")).length, 8)
    assert.equal(database.events.lastIndexOf("hash:BACKUP-00008") < database.events.lastIndexOf("transaction"), true)
  })

  it("reports the committed enable when best-effort limiter cleanup is unavailable", async () => {
    const database = createDatabase()
    const setup = await start(database)
    const result = await service.enableTwoFactor(enableInput(database, setup.enrollmentBinding, {
      dependencies: dependencies({
        database,
        async clearCredentialAccountFailure() { throw new Error("limiter cleanup unavailable") },
      }),
    }))

    assert.equal(result.status, "ENABLED")
    assert.equal(database.secret.enabledAt.getTime(), NOW.getTime())
    assert.equal(database.user.authSessionVersion, 8)
    assert.equal(database.sessions.length, 0)
  })

  for (const failurePoint of [
    "after-secret-cas",
    "after-backup-delete",
    "after-backup-create",
    "after-session-version",
    "after-adapter-session-delete",
  ]) {
    it(`rolls back every enable write at ${failurePoint}`, async () => {
      const database = createDatabase()
      const setup = await start(database)
      const before = database.snapshot()
      database.failPoint = failurePoint

      assert.deepEqual(
        await service.enableTwoFactor(enableInput(database, setup.enrollmentBinding)),
        { status: "REJECTED", code: "CONFLICT" },
      )
      assert.deepEqual(database.snapshot(), before)
    })
  }

  it("permits one concurrent enable winner, one version increment, and one final code set", async () => {
    const database = createDatabase()
    const setup = await start(database)
    const input = enableInput(database, setup.enrollmentBinding)

    const results = await Promise.all([
      service.enableTwoFactor(input),
      service.enableTwoFactor(input),
    ])

    assert.equal(results.filter((result) => result.status === "ENABLED").length, 1)
    assert.equal(results.filter((result) => result.status === "REJECTED" && ["CONFLICT", "ALREADY_ENABLED"].includes(result.code)).length, 1)
    assert.equal(database.user.authSessionVersion, 8)
    assert.equal(database.backups.length, 8)
    assert.equal(database.sessions.length, 0)
    assert.equal(database.committedSessionDeletes, 1)
  })

  it("keeps expected setup and enable transaction conflicts silent", async () => {
    const setupDatabase = createDatabase({ pending: true })
    const setupResult = await captureConsoleErrors(async (calls) => {
      const result = await start(setupDatabase, {
        dependencies: dependencies({
          database: setupDatabase,
          generateTotpSecret() {
            setupDatabase.user.authSessionVersion += 1
            return { secret: MANUAL_CODE, otpauthUrl: OTPAUTH_URL }
          },
        }),
      })
      assert.deepEqual(calls, [])
      return result
    })
    assert.deepEqual(setupResult, { status: "REJECTED", code: "CONFLICT" })

    const enableDatabase = createDatabase()
    const pending = await start(enableDatabase)
    const enableResult = await captureConsoleErrors(async (calls) => {
      const result = await service.enableTwoFactor(enableInput(enableDatabase, pending.enrollmentBinding, {
        dependencies: dependencies({
          database: enableDatabase,
          generateBackupCodes() {
            enableDatabase.secret.updatedAt = new Date(enableDatabase.secret.updatedAt.getTime() + 1)
            return backupCodes()
          },
        }),
      }))
      assert.deepEqual(calls, [])
      return result
    })
    assert.deepEqual(enableResult, { status: "REJECTED", code: "CONFLICT" })
  })

  it("logs only an allowlisted operation and code for unexpected setup and enable transaction failures", async () => {
    const setupDatabase = createDatabase({ pending: true })
    setupDatabase.failPoint = "after-secret-cas"
    setupDatabase.failError = Object.assign(new Error("private setup failure"), {
      code: "P2024",
      meta: { privateUserId: "user-1" },
    })
    const setupResult = await captureConsoleErrors(async (calls) => {
      const result = await start(setupDatabase)
      assert.deepEqual(calls, [[
        "Two-factor management transaction failed",
        { operation: "START", code: "P2024" },
      ]])
      return result
    })
    assert.deepEqual(setupResult, { status: "REJECTED", code: "CONFLICT" })

    const enableDatabase = createDatabase()
    const pending = await start(enableDatabase)
    enableDatabase.failPoint = "after-secret-cas"
    enableDatabase.failError = Object.assign(new Error("private enable failure"), {
      code: "P2024",
      meta: { privateUserId: "user-1" },
    })
    const enableResult = await captureConsoleErrors(async (calls) => {
      const result = await service.enableTwoFactor(enableInput(enableDatabase, pending.enrollmentBinding))
      assert.deepEqual(calls, [[
        "Two-factor management transaction failed",
        { operation: "ENABLE", code: "P2024" },
      ]])
      return result
    })
    assert.deepEqual(enableResult, { status: "REJECTED", code: "CONFLICT" })
  })
})

describe("dual-proof destructive two-factor management", () => {
  it("requires exact confirmation and independent password plus current-factor proof", async () => {
    const unconfirmed = createDatabase({ enabled: true })
    assert.deepEqual(await service.disableTwoFactor(manageInput(unconfirmed, { confirmed: false })), {
      status: "REJECTED",
      code: "INVALID_REQUEST",
    })
    assert.equal(unconfirmed.reads, 0)

    const passwordOnly = createDatabase({ enabled: true })
    assert.deepEqual(await service.disableTwoFactor(manageInput(passwordOnly, { twoFactorCode: "" })), {
      status: "REJECTED",
      code: "TWO_FACTOR_REQUIRED",
    })
    assert.equal(passwordOnly.transactions, 0)

    const factorOnly = createDatabase({ enabled: true })
    assert.deepEqual(await service.disableTwoFactor(manageInput(factorOnly, {
      primaryProof: { kind: "PASSWORD", password: "wrong-password" },
    })), { status: "REJECTED", code: "PRIMARY_PROOF_INVALID" })
    assert.equal(factorOnly.transactions, 0)

    const googleOnly = createDatabase({
      enabled: true,
      googleLinked: true,
      googleIntent: freshGoogleIntent(),
    })
    assert.deepEqual(await service.disableTwoFactor(manageInput(googleOnly, {
      primaryProof: { kind: "GOOGLE", intentId: "intent-1" },
      twoFactorCode: "",
    })), { status: "REJECTED", code: "TWO_FACTOR_REQUIRED" })
    assert.notEqual(googleOnly.intent.providerProvenAt, null)
    assert.equal(googleOnly.transactions, 0)
  })

  it("rejects absent enabled state without deleting orphan codes and preserves admin recovery", async () => {
    for (const operation of [service.disableTwoFactor, service.regenerateBackupCodes]) {
      const disabled = createDatabase()
      const before = disabled.snapshot()
      assert.deepEqual(await operation(manageInput(disabled)), {
        status: "REJECTED",
        code: "NOT_ENABLED",
      })
      assert.deepEqual(disabled.snapshot(), before)

      const inconsistent = createDatabase({ enabled: true, passwordEnabled: false })
      const inconsistentBefore = inconsistent.snapshot()
      assert.deepEqual(await operation(manageInput(inconsistent)), {
        status: "REJECTED",
        code: "PRIMARY_PROOF_INVALID",
      })
      assert.deepEqual(inconsistent.snapshot(), inconsistentBefore)
    }
  })

  it("preserves exact password-management and Google-factor retry durations", async () => {
    for (const operation of [service.disableTwoFactor, service.regenerateBackupCodes]) {
      const passwordDatabase = createDatabase({ enabled: true })
      assert.deepEqual(await operation(manageInput(passwordDatabase, {
        dependencies: dependencies({
          database: passwordDatabase,
          passwordManagementResult: { status: "RATE_LIMITED", retryAfterSeconds: 149 },
        }),
      })), {
        status: "REJECTED",
        code: "RATE_LIMITED",
        retryAfterSeconds: 149,
      })

      const googleDatabase = createDatabase({
        enabled: true,
        googleLinked: true,
        googleIntent: freshGoogleIntent({
          purpose: operation === service.disableTwoFactor
            ? "DISABLE_TWO_FACTOR"
            : "REGENERATE_TWO_FACTOR_BACKUP_CODES",
        }),
      })
      assert.deepEqual(await operation(manageInput(googleDatabase, {
        primaryProof: { kind: "GOOGLE", intentId: "intent-1" },
        dependencies: dependencies({
          database: googleDatabase,
          currentFactorResult: { status: "RATE_LIMITED", retryAfterSeconds: 163 },
        }),
      })), {
        status: "REJECTED",
        code: "RATE_LIMITED",
        retryAfterSeconds: 163,
      })
    }
  })

  it("disables password-only and linked accounts with password plus TOTP or unused backup", async () => {
    for (const [label, googleLinked, twoFactorCode] of [
      ["password-only TOTP", false, "123456"],
      ["linked password backup", true, "BACKUP-CURRENT"],
    ]) {
      const database = createDatabase({ enabled: true, googleLinked })
      const result = await service.disableTwoFactor(manageInput(database, { twoFactorCode }))
      assert.deepEqual(result, { status: "DISABLED" }, label)
      assert.equal(database.secret, null, label)
      assert.equal(database.backups.length, 0, label)
      assert.equal(database.user.authSessionVersion, 8, label)
      assert.equal(database.sessions.length, 0, label)
      assert.equal(database.committedSessionDeletes, 1, label)
      if (twoFactorCode === "BACKUP-CURRENT") {
        assert.equal(database.events.includes("consume-factor:BACKUP_CODE"), true, label)
      }
    }
  })

  it("covers both destructive changes for linked-Google and Google-only legacy accounts", () => {
    assert.deepEqual(
      googleManagementScenarios.map(({ label }) => label).sort(),
      [
        "Google-only legacy disable",
        "Google-only legacy regenerate",
        "linked Google disable",
        "linked Google regenerate",
      ],
    )
  })

  it("allows linked and legacy Google-only accounts to manage with Google plus current factor", async () => {
    for (const scenario of googleManagementScenarios) {
      const database = createDatabase({
        enabled: true,
        passwordEnabled: scenario.passwordEnabled,
        googleLinked: true,
        googleIntent: freshGoogleIntent({ purpose: scenario.purpose }),
      })
      const secretBefore = structuredClone(database.secret)
      const operation = scenario.operation === "DISABLE"
        ? service.disableTwoFactor
        : service.regenerateBackupCodes
      const expectedStatus = scenario.operation === "DISABLE"
        ? "DISABLED"
        : "BACKUP_CODES_REGENERATED"
      const result = await operation(manageInput(database, {
        primaryProof: { kind: "GOOGLE", intentId: "intent-1" },
        twoFactorCode: scenario.twoFactorCode,
      }))
      if (scenario.operation === "DISABLE") {
        assert.deepEqual(result, { status: expectedStatus }, scenario.label)
        assert.equal(database.secret, null, scenario.label)
        assert.equal(database.backups.length, 0, scenario.label)
      } else {
        assert.deepEqual(result, {
          status: expectedStatus,
          backupCodes: backupCodes(),
        }, scenario.label)
        assert.deepEqual(database.secret, secretBefore, scenario.label)
        assert.deepEqual(
          database.backups.map(({ codeHash }) => codeHash),
          backupCodes().map((code) => `hash:${code}`),
          scenario.label,
        )
      }
      assert.equal(database.intent.providerProvenAt, null, scenario.label)
      assert.equal(database.events.filter((event) => event === "consume-google").length, 1, scenario.label)
      assert.equal(database.user.authSessionVersion, 8, scenario.label)
      assert.equal(database.sessions.length, 0, scenario.label)
      assert.equal(database.committedSessionDeletes, 1, scenario.label)
    }
  })

  it("consumes the transaction-reloaded Google proof when the same intent is refreshed after preflight", async () => {
    for (const [operation, purpose, successStatus] of [
      [service.disableTwoFactor, "DISABLE_TWO_FACTOR", "DISABLED"],
      [service.regenerateBackupCodes, "REGENERATE_TWO_FACTOR_BACKUP_CODES", "BACKUP_CODES_REGENERATED"],
    ]) {
      const preflightProviderProvenAt = new Date(NOW.getTime() - 2_000)
      const reloadedProviderProvenAt = new Date(NOW.getTime() - 1_000)
      const consumedSnapshots = []
      const database = createDatabase({
        enabled: true,
        googleLinked: true,
        googleIntent: freshGoogleIntent({ purpose, providerProvenAt: preflightProviderProvenAt }),
      })

      const result = await operation(manageInput(database, {
        primaryProof: { kind: "GOOGLE", intentId: "intent-1" },
        dependencies: dependencies({
          database,
          async prepareCurrentTwoFactorProof() {
            database.intent.providerProvenAt = reloadedProviderProvenAt
            return { status: "VERIFIED", proof: preparedFactor(database) }
          },
          async consumeFreshGoogleReauth(tx, intent, expectedPurpose, userId, now) {
            consumedSnapshots.push(structuredClone(intent))
            return consumeGoogleProofWithFailureHooks(tx, intent, expectedPurpose, userId, now)
          },
        }),
      }))

      assert.equal(result.status, successStatus, purpose)
      assert.equal(consumedSnapshots.length, 1, purpose)
      assert.equal(consumedSnapshots[0].providerProvenAt.getTime(), reloadedProviderProvenAt.getTime(), purpose)
      assert.equal(database.intent.providerProvenAt, null, purpose)
    }
  })

  it("accepts each two-factor Google proof only for its exact action", async () => {
    const operations = [
      {
        purpose: "ENROLL_TWO_FACTOR",
        createDatabase: (proofPurpose) => createDatabase({
          googleLinked: true,
          googleIntent: freshGoogleIntent({ purpose: proofPurpose }),
        }),
        run: (database) => start(database, {
          primaryProof: { kind: "GOOGLE", intentId: "intent-1" },
        }),
        successStatus: "SETUP_READY",
      },
      {
        purpose: "DISABLE_TWO_FACTOR",
        createDatabase: (proofPurpose) => createDatabase({
          enabled: true,
          googleLinked: true,
          googleIntent: freshGoogleIntent({ purpose: proofPurpose }),
        }),
        run: (database) => service.disableTwoFactor(manageInput(database, {
          primaryProof: { kind: "GOOGLE", intentId: "intent-1" },
        })),
        successStatus: "DISABLED",
      },
      {
        purpose: "REGENERATE_TWO_FACTOR_BACKUP_CODES",
        createDatabase: (proofPurpose) => createDatabase({
          enabled: true,
          googleLinked: true,
          googleIntent: freshGoogleIntent({ purpose: proofPurpose }),
        }),
        run: (database) => service.regenerateBackupCodes(manageInput(database, {
          primaryProof: { kind: "GOOGLE", intentId: "intent-1" },
        })),
        successStatus: "BACKUP_CODES_REGENERATED",
      },
    ]

    for (const operation of operations) {
      for (const proofPurpose of operations.map(({ purpose }) => purpose)) {
        const database = operation.createDatabase(proofPurpose)
        const before = database.snapshot()
        const result = await operation.run(database)
        if (proofPurpose === operation.purpose) {
          assert.equal(result.status, operation.successStatus, `${proofPurpose} -> ${operation.purpose}`)
          assert.equal(database.intent.providerProvenAt, null, operation.purpose)
        } else {
          assert.deepEqual(
            result,
            { status: "REJECTED", code: "GOOGLE_PROOF_EXPIRED" },
            `${proofPurpose} must not authorize ${operation.purpose}`,
          )
          assert.deepEqual(database.snapshot(), before, `${proofPurpose} -> ${operation.purpose}`)
        }
      }
    }
  })

  it("regenerates eight prehashed codes while leaving the enabled secret exact", async () => {
    const database = createDatabase({ enabled: true, googleLinked: true })
    const secretBefore = structuredClone(database.secret)
    const result = await service.regenerateBackupCodes(manageInput(database, {
      twoFactorCode: "BACKUP-CURRENT",
    }))

    assert.deepEqual(result, {
      status: "BACKUP_CODES_REGENERATED",
      backupCodes: backupCodes(),
    })
    assert.deepEqual(database.secret, secretBefore)
    assert.equal(database.backups.length, 8)
    assert.deepEqual(database.backups.map(({ codeHash }) => codeHash), backupCodes().map((code) => `hash:${code}`))
    assert.equal(database.backups.some((row) => backupCodes().includes(row.codeHash)), false)
    assert.equal(database.events.filter((event) => event.startsWith("hash:")).length, 8)
    assert.equal(database.events.lastIndexOf("hash:BACKUP-00008") < database.events.lastIndexOf("transaction"), true)
    assert.equal(database.user.authSessionVersion, 8)
    assert.equal(database.sessions.length, 0)
  })

  it("rejects stale version, replaced secret, used backup, consumed Google, and method change", async () => {
    const cases = [
      ["stale version", (database) => ({
        async preparePasswordMethodProofForTwoFactorManagement() {
          database.user.authSessionVersion += 1
          return verifiedPasswordManagementProof(database, { authSessionVersion: 7 })
        },
      })],
      ["replaced secret", (database) => ({
        async preparePasswordMethodProofForTwoFactorManagement() {
          const proof = verifiedPasswordManagementProof(database)
          database.secret.updatedAt = new Date(database.secret.updatedAt.getTime() + 1)
          database.secret.encryptedSecret = "replacement-secret"
          return proof
        },
      })],
      ["used backup", (database) => ({
        async preparePasswordMethodProofForTwoFactorManagement() {
          const proof = verifiedPasswordManagementProof(database, { kind: "BACKUP_CODE" })
          database.backups.find((row) => row.id === "backup-current").usedAt = NOW
          return proof
        },
      })],
      ["method change", (database) => ({
        async preparePasswordMethodProofForTwoFactorManagement() {
          const proof = verifiedPasswordManagementProof(database)
          database.user.passwordCredential = null
          return proof
        },
      })],
      ["password method replacement", (database) => ({
        async preparePasswordMethodProofForTwoFactorManagement() {
          const proof = verifiedPasswordManagementProof(database)
          database.user.passwordCredential.id = "password-replacement"
          return proof
        },
      })],
    ]
    for (const [label, dependencyFactory] of cases) {
      const database = createDatabase({ enabled: true })
      const secretBefore = structuredClone(database.secret)
      const backupsBefore = structuredClone(database.backups)
      const sessionsBefore = structuredClone(database.sessions)
      const result = await service.regenerateBackupCodes(manageInput(database, {
        twoFactorCode: label === "used backup" ? "BACKUP-CURRENT" : "123456",
        dependencies: dependencies({ database, ...dependencyFactory(database) }),
      }))
      assert.deepEqual(result, { status: "REJECTED", code: "CONFLICT" }, label)
      assert.deepEqual(
        database.secret,
        label === "replaced secret"
          ? {
              ...secretBefore,
              encryptedSecret: "replacement-secret",
              updatedAt: new Date(secretBefore.updatedAt.getTime() + 1),
            }
          : secretBefore,
        label,
      )
      if (label !== "used backup") assert.deepEqual(database.backups, backupsBefore, label)
      assert.deepEqual(database.sessions, sessionsBefore, label)
    }

    const google = createDatabase({
      enabled: true,
      googleLinked: true,
      googleIntent: freshGoogleIntent({ purpose: "DISABLE_TWO_FACTOR" }),
    })
    const googleBefore = google.snapshot()
    const result = await service.disableTwoFactor(manageInput(google, {
      primaryProof: { kind: "GOOGLE", intentId: "intent-1" },
      dependencies: dependencies({
        database: google,
        async prepareCurrentTwoFactorProof() {
          google.intent.providerProvenAt = null
          return { status: "VERIFIED", proof: preparedFactor(google) }
        },
      }),
    }))
    assert.deepEqual(result, { status: "REJECTED", code: "CONFLICT" })
    assert.deepEqual(google.secret, googleBefore.secret)
    assert.deepEqual(google.backups, googleBefore.backups)
    assert.deepEqual(google.sessions, googleBefore.sessions)
  })

  for (const [operationName, operation, proofKind, failurePoints] of [
    ["disable", (...args) => service.disableTwoFactor(...args), "TOTP", [
      "after-factor-consume",
      "after-google-consume",
      "after-secret-delete",
      "after-backup-delete",
      "after-session-version",
      "after-adapter-session-delete",
    ]],
    ["regenerate", (...args) => service.regenerateBackupCodes(...args), "BACKUP_CODE", [
      "after-factor-consume",
      "after-google-consume",
      "after-backup-delete",
      "after-backup-create",
      "after-session-version",
      "after-adapter-session-delete",
    ]],
  ]) {
    for (const failurePoint of failurePoints) {
      it(`rolls back ${operationName} at ${failurePoint}`, async () => {
        const database = createDatabase({
          enabled: true,
          googleLinked: true,
          googleIntent: freshGoogleIntent({
            purpose: operationName === "disable"
              ? "DISABLE_TWO_FACTOR"
              : "REGENERATE_TWO_FACTOR_BACKUP_CODES",
          }),
        })
        const before = database.snapshot()
        database.failPoint = failurePoint
        const result = await operation(manageInput(database, {
          primaryProof: { kind: "GOOGLE", intentId: "intent-1" },
          twoFactorCode: proofKind === "BACKUP_CODE" ? "BACKUP-CURRENT" : "123456",
        }))
        assert.deepEqual(result, { status: "REJECTED", code: "CONFLICT" })
        assert.deepEqual(database.snapshot(), before)
      })
    }
  }

  for (const [operationName, operation, successStatus] of [
    ["disable", (...args) => service.disableTwoFactor(...args), "DISABLED"],
    ["regenerate", (...args) => service.regenerateBackupCodes(...args), "BACKUP_CODES_REGENERATED"],
  ]) {
    it(`permits exactly one concurrent ${operationName} winner`, async () => {
      const database = createDatabase({ enabled: true })
      const input = manageInput(database)
      const results = await Promise.all([operation(input), operation(input)])
      assert.equal(results.filter((result) => result.status === successStatus).length, 1)
      assert.deepEqual(results.filter((result) => result.status === "REJECTED"), [
        { status: "REJECTED", code: "CONFLICT" },
      ])
      assert.equal(database.user.authSessionVersion, 8)
      assert.equal(database.sessions.length, 0)
      assert.equal(database.committedSessionDeletes, 1)
      if (operationName === "disable") {
        assert.equal(database.secret, null)
        assert.equal(database.backups.length, 0)
      } else {
        assert.equal(database.secret.enabledAt instanceof Date, true)
        assert.equal(database.backups.length, 8)
      }
    })
  }

  it("keeps expected management CAS conflicts silent", async () => {
    const database = createDatabase({ enabled: true })
    const result = await captureConsoleErrors(async (calls) => {
      const response = await service.disableTwoFactor(manageInput(database, {
        dependencies: dependencies({
          database,
          async preparePasswordMethodProofForTwoFactorManagement() {
            const proof = verifiedPasswordManagementProof(database)
            database.user.authSessionVersion += 1
            return proof
          },
        }),
      }))
      assert.deepEqual(calls, [])
      return response
    })

    assert.deepEqual(result, { status: "REJECTED", code: "CONFLICT" })
  })

  it("logs only an allowlisted operation and code for unexpected management transaction failures", async () => {
    for (const [operation, invoke] of [
      ["DISABLE", (input) => service.disableTwoFactor(input)],
      ["REGENERATE", (input) => service.regenerateBackupCodes(input)],
    ]) {
      const database = createDatabase({ enabled: true })
      database.failPoint = "after-factor-consume"
      database.failError = Object.assign(new Error("private database failure"), {
        code: "P2024",
        meta: { privateUserId: "user-1" },
      })

      const result = await captureConsoleErrors(async (calls) => {
        const response = await invoke(manageInput(database))
        assert.deepEqual(calls, [[
          "Two-factor management transaction failed",
          { operation, code: "P2024" },
        ]])
        return response
      })

      assert.deepEqual(result, { status: "REJECTED", code: "CONFLICT" })
    }
  })
})

describe("two-factor management database double", () => {
  it("fails loudly for unsupported nested filters instead of treating them as a mismatch", () => {
    assert.throws(
      () => matches({ createdAt: NOW }, { createdAt: { lt: NOW } }),
      /Unsupported nested database filter for createdAt/,
    )
  })
})

function start(database, overrides = {}) {
  return service.startTwoFactorEnrollment({
    prismaClient: database,
    userId: "user-1",
    primaryProof: { kind: "PASSWORD", password: "correct-password" },
    networkIdentifier: NETWORK,
    confirmed: true,
    authSecret: AUTH_SECRET,
    now: NOW,
    dependencies: dependencies({ database }),
    ...overrides,
  })
}

function enableInput(database, binding, overrides = {}) {
  return {
    prismaClient: database,
    userId: "user-1",
    enrollmentBinding: binding,
    code: "123456",
    confirmed: true,
    networkIdentifier: NETWORK,
    authSecret: AUTH_SECRET,
    now: NOW,
    dependencies: dependencies({ database }),
    ...overrides,
  }
}

function manageInput(database, overrides = {}) {
  return {
    prismaClient: database,
    userId: "user-1",
    primaryProof: { kind: "PASSWORD", password: "correct-password" },
    twoFactorCode: "123456",
    confirmed: true,
    networkIdentifier: NETWORK,
    now: NOW,
    dependencies: dependencies({ database }),
    ...overrides,
  }
}

function dependencies(overrides = {}) {
  const {
    database,
    passwordResult,
    throwAt,
    validTotpCode,
    checkRateLimit,
    failureRetryAfterSeconds,
    passwordManagementResult,
    currentFactorResult,
    ...dependencyOverrides
  } = overrides
  return {
    async verifyPasswordMethodProof() {
      return passwordResult ?? {
        status: "VERIFIED",
        userId: "user-1",
        authSessionVersion: 7,
        backupCodeConsumed: false,
      }
    },
    isFreshConsumedGoogleReauth,
    consumeFreshGoogleReauth: consumeGoogleProofWithFailureHooks,
    generateTotpSecret: overrides.generateTotpSecret ?? (() => {
      database?.events.push("generate-secret")
      if (throwAt === "generate-secret") throw new Error("generation failed")
      return { secret: MANUAL_CODE, otpauthUrl: OTPAUTH_URL }
    }),
    encryptSecret: overrides.encryptSecret ?? (() => {
      database?.events.push("encrypt-secret")
      if (throwAt === "encrypt-secret") throw new Error("encryption failed")
      return ENCRYPTED_SECRET
    }),
    renderQrCode: async () => {
      database?.events.push("render-qr")
      if (throwAt === "render-qr") throw new Error("QR failed")
      return QR_CODE
    },
    decryptSecret: overrides.decryptSecret ?? (() => MANUAL_CODE),
    verifyTotpCode: (_secret, code) => code === (validTotpCode ?? "123456"),
    generateBackupCodes: () => backupCodes(),
    async hashBackupCode(code) {
      database?.events.push(`hash:${code}`)
      return `hash:${code}`
    },
    async checkCredentialRateLimit(input) {
      input.prismaClient.events.push("check-factor-limit")
      return checkRateLimit ?? { allowed: true }
    },
    async recordCredentialFailure(input) {
      input.prismaClient.events.push("record-factor-failure")
      return failureRetryAfterSeconds
        ? { allowed: false, retryAfterSeconds: failureRetryAfterSeconds }
        : { allowed: true }
    },
    async clearCredentialAccountFailure(input) {
      input.prismaClient.events.push("clear-factor-account-limit")
    },
    async preparePasswordMethodProofForTwoFactorManagement(input) {
      if (passwordManagementResult) return passwordManagementResult
      if (input.password !== "correct-password") return { status: "INVALID" }
      if (!input.twoFactorCode) return { status: "TWO_FACTOR_REQUIRED" }
      return verifiedPasswordManagementProof(input.prismaClient, {
        kind: input.twoFactorCode === "BACKUP-CURRENT" ? "BACKUP_CODE" : "TOTP",
      })
    },
    async prepareCurrentTwoFactorProof(input) {
      if (currentFactorResult) return currentFactorResult
      if (!input.twoFactorCode) return { status: "TWO_FACTOR_REQUIRED" }
      return {
        status: "VERIFIED",
        proof: preparedFactor(input.prismaClient, {
          kind: input.twoFactorCode === "BACKUP-CURRENT" ? "BACKUP_CODE" : "TOTP",
        }),
      }
    },
    consumePreparedTwoFactorProof: defaultConsumeFactorProof,
    ...dependencyOverrides,
  }
}

function verifiedPasswordManagementProof(database, overrides = {}) {
  const proof = preparedFactor(database, overrides)
  return {
    status: "VERIFIED",
    userId: database.user.id,
    authSessionVersion: overrides.authSessionVersion ?? database.user.authSessionVersion,
    preparedTwoFactorProof: proof,
  }
}

function preparedFactor(database, { kind = "TOTP", authSessionVersion = database.user.authSessionVersion } = {}) {
  assert.ok(
    database.secret?.enabledAt instanceof Date,
    "preparedFactor requires an enabled two-factor secret",
  )
  const secret = database.secret
  return {
    userId: database.user.id,
    authSessionVersion,
    twoFactorSecretId: secret.id,
    enabledAtMs: secret.enabledAt.getTime(),
    updatedAtMs: secret.updatedAt.getTime(),
    kind,
    backupCodeId: kind === "BACKUP_CODE" ? "backup-current" : null,
  }
}

async function defaultConsumeFactorProof(tx, proof, now) {
  const user = await tx.user.findFirst({
    where: { id: proof.userId, authSessionVersion: proof.authSessionVersion },
  })
  const secret = await tx.twoFactorSecret.findFirst({
    where: {
      id: proof.twoFactorSecretId,
      userId: proof.userId,
      enabledAt: new Date(proof.enabledAtMs),
      updatedAt: new Date(proof.updatedAtMs),
    },
  })
  if (!user || !secret) return false
  if (proof.kind === "BACKUP_CODE") {
    const consumed = await tx.backupCode.updateMany({
      where: { id: proof.backupCodeId, userId: proof.userId, usedAt: null },
      data: { usedAt: now },
    })
    if (consumed.count !== 1) return false
  }
  tx.__database.events.push(`consume-factor:${proof.kind}`)
  maybeFail(tx.__database, "after-factor-consume")
  return true
}

function backupCodes() {
  return Array.from({ length: 8 }, (_, index) => `BACKUP-${String(index + 1).padStart(5, "0")}`)
}

function assertSetupReady(result) {
  assert.equal(result.status, "SETUP_READY")
  assert.equal(result.qrCode, QR_CODE)
  assert.equal(result.manualCode, MANUAL_CODE)
  assert.equal(typeof result.enrollmentBinding, "string")
  assert.equal(result.enrollmentBinding.includes(MANUAL_CODE), false)
  assert.equal(result.enrollmentBinding.includes(ENCRYPTED_SECRET), false)
}

function freshGoogleIntent(overrides = {}) {
  return {
    id: "intent-1",
    targetUserId: "user-1",
    purpose: "ENROLL_TWO_FACTOR",
    status: "CONSUMED",
    provider: "google",
    providerAccountId: "google-subject-1",
    providerProvenAt: NOW,
    expiresAt: new Date(NOW.getTime() + 60_000),
    ...overrides,
  }
}

async function consumeGoogleProofWithFailureHooks(tx, intent, purpose, userId, now) {
  const consumed = await consumeFreshGoogleReauth(tx, intent, purpose, userId, now)
  if (consumed) {
    tx.__database.events.push("consume-google")
    maybeFail(tx.__database, "after-google-consume")
  }
  return consumed
}

function createDatabase({
  passwordEnabled = true,
  googleLinked = false,
  googleIntent = null,
  enabled = false,
  pending = false,
} = {}) {
  const database = {
    user: {
      id: "user-1",
      email: "member@example.test",
      emailVerified: NOW,
      authSessionVersion: 7,
      passwordCredential: passwordEnabled ? { id: "password-1", userId: "user-1" } : null,
      accounts: googleLinked
        ? [{ id: "account-1", userId: "user-1", provider: "google", providerAccountId: "google-subject-1" }]
        : [],
    },
    secret: enabled || pending
      ? {
          id: "two-factor-legacy",
          userId: "user-1",
          encryptedSecret: "legacy-encrypted-secret",
          enabledAt: enabled ? new Date(NOW.getTime() - 86_400_000) : null,
          createdAt: new Date(NOW.getTime() - 86_400_000),
          updatedAt: new Date(NOW.getTime() - 86_400_000),
        }
      : null,
    backups: enabled
      ? [
          { id: "backup-current", userId: "user-1", codeHash: "hash:BACKUP-CURRENT", usedAt: null, createdAt: NOW },
          { id: "backup-other", userId: "user-1", codeHash: "hash:BACKUP-OTHER", usedAt: null, createdAt: NOW },
        ]
      : [{ id: "orphan-backup", userId: "user-1", codeHash: "orphan-hash", usedAt: null, createdAt: NOW }],
    sessions: [
      { id: "session-1", userId: "user-1" },
      { id: "session-2", userId: "user-1" },
    ],
    intent: googleIntent ? structuredClone(googleIntent) : null,
    events: [],
    failPoint: null,
    failError: null,
    reads: 0,
    transactions: 0,
    transactionOptions: [],
    committedSessionDeletes: 0,
    sequence: 1,
    queue: Promise.resolve(),
    snapshot() {
      return structuredClone({
        user: userData(this.user),
        secret: this.secret,
        backups: this.backups,
        sessions: this.sessions,
        intent: this.intent,
      })
    },
    async $transaction(callback, options) {
      const operation = async () => {
        this.transactions += 1
        this.transactionOptions.push(options)
        this.events.push("transaction")
        const before = this.snapshot()
        const beforeDeletes = this.committedSessionDeletes
        const tx = transactionClient(this)
        try {
          const result = await callback(tx)
          return result
        } catch (error) {
          this.user = before.user
          this.secret = before.secret
          this.backups = before.backups
          this.sessions = before.sessions
          this.intent = before.intent
          this.committedSessionDeletes = beforeDeletes
          const restored = transactionClient(this)
          Object.assign(this.user, restored.user)
          this.twoFactorSecret = restored.twoFactorSecret
          this.backupCode = restored.backupCode
          this.session = restored.session
          this.authMethodIntent = restored.authMethodIntent
          this.authRateLimitBucket = restored.authRateLimitBucket
          throw error
        }
      }
      const result = this.queue.then(operation, operation)
      this.queue = result.catch(() => {})
      return result
    },
  }
  const rootClient = transactionClient(database)
  database.userDelegate = rootClient.user
  // The test double deliberately exposes both the mutable user row and its
  // Prisma-like delegate through database.user, matching existing call sites.
  database.user = Object.assign(database.user, rootClient.user)
  database.twoFactorSecret = rootClient.twoFactorSecret
  database.backupCode = rootClient.backupCode
  database.session = rootClient.session
  database.authMethodIntent = rootClient.authMethodIntent
  database.authRateLimitBucket = rootClient.authRateLimitBucket
  return database
}

function transactionClient(database) {
  const userRecord = () => {
    return {
      ...structuredClone(userData(database.user)),
      passwordCredential: structuredClone(database.user.passwordCredential),
      accounts: structuredClone(database.user.accounts),
      twoFactorSecret: structuredClone(database.secret),
    }
  }
  return {
    __database: database,
    user: {
      async findUnique({ where }) {
        database.reads += 1
        return database.user.id === where.id ? userRecord() : null
      },
      async findFirst({ where }) {
        database.reads += 1
        return matches(database.user, where) ? userRecord() : null
      },
      async updateMany({ where, data }) {
        if (!matches(database.user, where)) return { count: 0 }
        if (data.authSessionVersion?.increment) database.user.authSessionVersion += data.authSessionVersion.increment
        maybeFail(database, "after-session-version")
        return { count: 1 }
      },
    },
    twoFactorSecret: {
      async findUnique({ where }) {
        database.reads += 1
        if (!database.secret) return null
        return matches(database.secret, where) ? structuredClone(database.secret) : null
      },
      async findFirst({ where }) {
        database.reads += 1
        if (!database.secret) return null
        return matches(database.secret, where) ? structuredClone(database.secret) : null
      },
      async create({ data }) {
        if (database.secret) throw Object.assign(new Error("unique pending owner"), { code: "P2002" })
        database.secret = {
          id: data.id ?? `two-factor-${database.sequence++}`,
          userId: data.userId,
          encryptedSecret: data.encryptedSecret,
          enabledAt: data.enabledAt ?? null,
          createdAt: data.createdAt ?? NOW,
          updatedAt: data.updatedAt ?? NOW,
        }
        return structuredClone(database.secret)
      },
      async updateMany({ where, data }) {
        if (!database.secret || !matches(database.secret, where)) return { count: 0 }
        Object.assign(database.secret, structuredClone(data))
        maybeFail(database, "after-secret-cas")
        return { count: 1 }
      },
      async deleteMany({ where }) {
        if (!database.secret || !matches(database.secret, where)) return { count: 0 }
        database.secret = null
        maybeFail(database, "after-secret-delete")
        return { count: 1 }
      },
    },
    backupCode: {
      async updateMany({ where, data }) {
        const row = database.backups.find((candidate) => matches(candidate, where))
        if (!row) return { count: 0 }
        Object.assign(row, structuredClone(data))
        return { count: 1 }
      },
      async deleteMany({ where }) {
        const before = database.backups.length
        database.backups = database.backups.filter((row) => !matches(row, where))
        maybeFail(database, "after-backup-delete")
        return { count: before - database.backups.length }
      },
      async createMany({ data }) {
        for (const row of data) {
          database.backups.push({
            id: row.id ?? `backup-${database.sequence++}`,
            usedAt: null,
            createdAt: NOW,
            ...structuredClone(row),
          })
        }
        maybeFail(database, "after-backup-create")
        return { count: data.length }
      },
    },
    session: {
      async deleteMany({ where }) {
        const before = database.sessions.length
        database.sessions = database.sessions.filter((row) => !matches(row, where))
        maybeFail(database, "after-adapter-session-delete")
        database.committedSessionDeletes += 1
        return { count: before - database.sessions.length }
      },
    },
    authMethodIntent: {
      async findUnique({ where }) {
        database.reads += 1
        return database.intent && matches(database.intent, where) ? structuredClone(database.intent) : null
      },
      async updateMany({ where, data }) {
        if (!database.intent || !matches(database.intent, where)) return { count: 0 }
        Object.assign(database.intent, structuredClone(data))
        return { count: 1 }
      },
    },
    authRateLimitBucket: {
      async findUnique() { return null },
      async deleteMany() { return { count: 0 } },
      async upsert() { return {} },
    },
  }
}

function userData(user) {
  return {
    id: user.id,
    email: user.email,
    emailVerified: user.emailVerified,
    authSessionVersion: user.authSessionVersion,
    passwordCredential: user.passwordCredential,
    accounts: user.accounts,
  }
}

function matches(row, where = {}) {
  return Object.entries(where).every(([key, expected]) => {
    const actual = row[key]
    if (expected && typeof expected === "object" && !(expected instanceof Date)) {
      if (Object.hasOwn(expected, "gt")) return actual > expected.gt
      if (Object.hasOwn(expected, "in")) return expected.in.includes(actual)
      throw new Error(`Unsupported nested database filter for ${key}`)
    }
    if (actual instanceof Date || expected instanceof Date) {
      return actual instanceof Date && expected instanceof Date && actual.getTime() === expected.getTime()
    }
    return actual === expected
  })
}

function maybeFail(database, point) {
  if (database.failPoint === point) throw database.failError ?? new Error(`injected ${point}`)
}

async function captureConsoleErrors(callback) {
  const original = console.error
  const calls = []
  console.error = (...args) => calls.push(args)
  try {
    return await callback(calls)
  } finally {
    console.error = original
  }
}

function deferred() {
  let resolve
  const promise = new Promise((resolver) => { resolve = resolver })
  return { promise, resolve }
}

async function boundedLatch(promise, label, timeoutMs = 1_000) {
  let timeout
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`${label} timed out`)), timeoutMs)
      }),
    ])
  } finally {
    clearTimeout(timeout)
  }
}
