import assert from "node:assert/strict"
import { createHmac } from "node:crypto"
import { describe, it } from "node:test"

import { deliverAccountSecurityEmailIntent } from "../lib/account-security-email-intents.ts"
import {
  confirmGoogleLink,
  removeGoogleMethod,
  removePasswordMethod,
  setPasswordMethod,
} from "../lib/account-security-methods.ts"

const NOW = new Date("2026-08-28T12:00:00.000Z")
const SECRET = "test-auth-secret"

describe("transaction-safe account method mutations", () => {
  it("requires explicit confirmation and a finite fresh matching Credentials session claim", async () => {
    for (const overrides of [
      { confirmed: false },
      { lastPasswordAuthenticatedAt: undefined },
      { lastPasswordAuthenticatedAt: Number.NaN },
      { lastPasswordAuthenticatedAt: Number.POSITIVE_INFINITY },
      { lastPasswordAuthenticatedAt: NOW.getTime() + 1 },
      { lastPasswordAuthenticatedAt: NOW.getTime() - 5 * 60_000 - 1 },
      { sessionUserId: "user-2" },
    ]) {
      const db = createMethodDatabase()
      const intent = db.addLinkIntent()
      const result = await confirmGoogleLink(linkInput(db, intent.id, overrides))
      assert.deepEqual(result, { status: "REJECTED", code: "INVALID_PROOF" })
      assert.equal(db.googleAccountsFor("user-1").length, 0)
    }
  })

  it("consumes the exact link intent once and queues exactly one notice", async () => {
    const db = createMethodDatabase()
    const intent = db.addLinkIntent()
    const first = await confirmGoogleLink(linkInput(db, intent.id))
    const replay = await confirmGoogleLink(linkInput(db, intent.id))

    assert.equal(first.status, "UPDATED")
    assert.deepEqual(replay, { status: "REJECTED", code: "INTENT_EXPIRED" })
    assert.equal(db.googleAccountsFor("user-1").length, 1)
    assert.equal(db.securityEmailsByKind("GOOGLE_LINKED").length, 1)
  })

  it("rejects provider collision and a target email changed after Google proof", async () => {
    const collisionDb = createMethodDatabase({ accounts: [{ id: "google-2", userId: "user-2", provider: "google", providerAccountId: "google-subject-1", type: "oauth" }] })
    const collisionIntent = collisionDb.addLinkIntent()
    assert.deepEqual(await confirmGoogleLink(linkInput(collisionDb, collisionIntent.id)), { status: "REJECTED", code: "CONFLICT" })

    const changedDb = createMethodDatabase()
    const changedIntent = changedDb.addLinkIntent()
    changedDb.user("user-1").email = "changed@example.com"
    assert.deepEqual(await confirmGoogleLink(linkInput(changedDb, changedIntent.id)), { status: "REJECTED", code: "INVALID_PROOF" })
    assert.equal(changedDb.state.accounts.length, 0)
  })

  it("adds a password only after fresh matching Google reauthentication", async () => {
    for (const mutate of [
      () => {},
      (db, intent) => { intent.targetUserId = "user-2" },
      (_db, intent) => { intent.expiresAt = new Date(NOW.getTime() - 1) },
      (_db, intent) => { intent.providerProvenAt = null },
    ]) {
      const db = createMethodDatabase({ accounts: [googleAccount()] })
      const intent = db.addGoogleReauthIntent("ADD_PASSWORD")
      mutate(db, intent)
      const result = await setPasswordMethod(passwordAddInput(db, intent.id))
      if (mutate.toString() === "() => {}") {
        assert.equal(result.status, "UPDATED")
        assert.equal(db.passwordFor("user-1").passwordHash, "new-hash")
        assert.equal(db.securityEmailsByKind("PASSWORD_ENABLED").length, 1)
      } else {
        assert.deepEqual(result, { status: "REJECTED", code: "INTENT_EXPIRED" })
        assert.equal(db.passwordFor("user-1"), null)
      }
    }
  })

  it("rechecks ownership of the exact proven Google account before adding or removing a password", async () => {
    const addDb = createMethodDatabase({ accounts: [googleAccount()] })
    const addIntent = addDb.addGoogleReauthIntent("ADD_PASSWORD", { providerAccountId: "other-google-subject" })
    assert.deepEqual(await setPasswordMethod(passwordAddInput(addDb, addIntent.id)), { status: "REJECTED", code: "CONFLICT" })
    assert.equal(addDb.passwordFor("user-1"), null)
    assert.equal(addDb.state.intents[0].providerProvenAt.getTime(), NOW.getTime())

    const removeDb = createMethodDatabase({ accounts: [googleAccount()], passwordCredentials: [{ id: "password-1", userId: "user-1", passwordHash: "old-hash" }] })
    const removeIntent = removeDb.addGoogleReauthIntent("REMOVE_PASSWORD", { providerAccountId: "other-google-subject" })
    assert.deepEqual(await removePasswordMethod(passwordDisableInput(removeDb, removeIntent.id)), { status: "REJECTED", code: "CONFLICT" })
    assert.equal(removeDb.passwordFor("user-1").passwordHash, "old-hash")
    assert.equal(removeDb.state.intents[0].providerProvenAt.getTime(), NOW.getTime())
  })

  it("proves the current password outside the transaction and rejects a changed session version", async () => {
    const db = createMethodDatabase({ accounts: [googleAccount()], passwordCredentials: [{ id: "password-1", userId: "user-1", passwordHash: "old-hash" }] })
    const proofCalls = []
    const result = await setPasswordMethod({
      prismaClient: db,
      userId: "user-1",
      mode: "CHANGE",
      currentPassword: "old-password",
      newPassword: "raw-new-password",
      networkIdentifier: "network",
      confirmed: true,
      now: NOW,
      verifyPasswordMethodProofFn: async (input) => {
        proofCalls.push({ input, insideTransaction: db.insideTransaction })
        db.user("user-1").authSessionVersion += 1
        return { status: "VERIFIED", backupCodeConsumed: false, authSessionVersion: 0 }
      },
      hashPasswordFn: async () => "new-hash",
    })

    assert.equal(proofCalls.length, 1)
    assert.equal(proofCalls[0].input.prismaClient, db)
    assert.equal(proofCalls[0].insideTransaction, false)
    assert.deepEqual(result, { status: "REJECTED", code: "CONFLICT" })
    assert.equal(db.passwordFor("user-1").passwordHash, "old-hash")
  })

  it("does not hash a replacement password until CHANGE proof succeeds", async () => {
    for (const proofStatus of ["INVALID", "RATE_LIMITED", "TWO_FACTOR_REQUIRED", "TWO_FACTOR_INVALID"]) {
      const db = createMethodDatabase({ passwordCredentials: [{ id: "password-1", userId: "user-1", passwordHash: "old-hash" }] })
      const events = []
      const result = await setPasswordMethod({
        prismaClient: db,
        userId: "user-1",
        mode: "CHANGE",
        currentPassword: "old-password",
        newPassword: "raw-new-password",
        networkIdentifier: "network",
        confirmed: true,
        now: NOW,
        verifyPasswordMethodProofFn: async () => { events.push("proof"); return { status: proofStatus } },
        hashPasswordFn: async () => { events.push("hash"); return "new-hash" },
      })

      assert.equal(result.status, "REJECTED", proofStatus)
      assert.deepEqual(events, ["proof"], proofStatus)
      assert.equal(db.transactionCount, 0, proofStatus)
    }
  })

  it("hashes a CHANGE password exactly once after proof and before the transaction", async () => {
    const db = createMethodDatabase({ passwordCredentials: [{ id: "password-1", userId: "user-1", passwordHash: "old-hash" }] })
    const events = []
    const result = await setPasswordMethod({
      prismaClient: db,
      userId: "user-1",
      mode: "CHANGE",
      currentPassword: "old-password",
      newPassword: "raw-new-password",
      networkIdentifier: "network",
      confirmed: true,
      now: NOW,
      verifyPasswordMethodProofFn: async () => { events.push(`proof:${db.insideTransaction}`); return { status: "VERIFIED", authSessionVersion: 0 } },
      hashPasswordFn: async (password) => { events.push(`hash:${password}:${db.insideTransaction}`); return "new-hash" },
    })
    events.push(`done:${db.transactionCount}`)

    assert.equal(result.status, "UPDATED")
    assert.deepEqual(events, ["proof:false", "hash:raw-new-password:false", "done:1"])
    assert.equal(db.passwordFor("user-1").passwordHash, "new-hash")
  })

  it("requires cookie-bound ADD preflight before hashing and revalidates it in the transaction", async () => {
    const db = createMethodDatabase({ accounts: [googleAccount()] })
    const intent = db.addGoogleReauthIntent("ADD_PASSWORD")
    let hashes = 0
    const base = {
      prismaClient: db,
      userId: "user-1",
      mode: "ADD",
      intentId: intent.id,
      newPassword: "raw-new-password",
      confirmed: true,
      now: NOW,
      hashPasswordFn: async () => { hashes += 1; return "new-hash" },
    }

    assert.deepEqual(await setPasswordMethod(base), { status: "REJECTED", code: "INVALID_PROOF" })
    assert.equal(hashes, 0)
    assert.equal(db.transactionCount, 0)

    const result = await setPasswordMethod({
      ...base,
      googleReauthPreflight: { intentId: intent.id, targetUserId: "user-1" },
    })
    assert.equal(result.status, "UPDATED")
    assert.equal(hashes, 1)
    assert.equal(db.passwordFor("user-1").passwordHash, "new-hash")
  })

  it("maps invalid direct proof results to safe rejection codes without starting mutation transactions", async () => {
    for (const [proofStatus, code] of [
      ["INVALID", "INVALID_PROOF"],
      ["RATE_LIMITED", "INVALID_PROOF"],
      ["TWO_FACTOR_REQUIRED", "TWO_FACTOR_REQUIRED"],
      ["TWO_FACTOR_INVALID", "TWO_FACTOR_INVALID"],
    ]) {
      const db = createMethodDatabase({ accounts: [googleAccount()], passwordCredentials: [{ id: "password-1", userId: "user-1", passwordHash: "old-hash" }] })
      const result = await removeGoogleMethod({
        prismaClient: db,
        userId: "user-1",
        password: "proof",
        networkIdentifier: "network",
        confirmed: true,
        now: NOW,
        verifyPasswordMethodProofFn: async () => ({ status: proofStatus }),
      })
      assert.deepEqual(result, { status: "REJECTED", code })
      assert.equal(db.transactionCount, 0)
    }
  })

  it("changes a password, unlinks Google, and increments the destructive session version", async () => {
    const changeDb = createMethodDatabase({ accounts: [googleAccount()], passwordCredentials: [{ id: "password-1", userId: "user-1", passwordHash: "old-hash" }] })
    const changed = await setPasswordMethod(passwordChangeInput(changeDb))
    assert.equal(changed.status, "UPDATED")
    assert.equal(changeDb.passwordFor("user-1").passwordHash, "new-hash")
    assert.equal(changeDb.user("user-1").authSessionVersion, 1)
    assert.equal(changeDb.securityEmailsByKind("PASSWORD_CHANGED").length, 1)

    const unlinkDb = createMethodDatabase({ accounts: [googleAccount()], passwordCredentials: [{ id: "password-1", userId: "user-1", passwordHash: "old-hash" }] })
    const unlinked = await removeGoogleMethod(passwordRemovalProofInput(unlinkDb))
    assert.equal(unlinked.status, "UPDATED")
    assert.equal(unlinkDb.googleAccountsFor("user-1").length, 0)
    assert.equal(unlinkDb.user("user-1").authSessionVersion, 1)
    assert.equal(unlinkDb.securityEmailsByKind("GOOGLE_UNLINKED").length, 1)
  })

  it("rejects removing the last method and allows only one concurrent password removal", async () => {
    const lastGoogle = createMethodDatabase({ accounts: [googleAccount()] })
    assert.deepEqual(await removeGoogleMethod(passwordRemovalProofInput(lastGoogle)), { status: "REJECTED", code: "LAST_METHOD" })

    const lastPassword = createMethodDatabase({ passwordCredentials: [{ id: "password-1", userId: "user-1", passwordHash: "old-hash" }] })
    const lastIntent = lastPassword.addGoogleReauthIntent("REMOVE_PASSWORD", { providerAccountId: "missing-google" })
    assert.deepEqual(await removePasswordMethod(passwordDisableInput(lastPassword, lastIntent.id)), { status: "REJECTED", code: "LAST_METHOD" })

    const db = createMethodDatabase({ accounts: [googleAccount()], passwordCredentials: [{ id: "password-1", userId: "user-1", passwordHash: "old-hash" }] })
    const intent = db.addGoogleReauthIntent("REMOVE_PASSWORD")
    const results = await Promise.all([
      removePasswordMethod(passwordDisableInput(db, intent.id)),
      removePasswordMethod(passwordDisableInput(db, intent.id)),
    ])
    assert.equal(results.filter((result) => result.status === "UPDATED").length, 1)
    assert.equal(results.filter((result) => result.status === "REJECTED" && result.code === "INTENT_EXPIRED").length, 1)
    assert.equal(db.passwordFor("user-1"), null)
    assert.equal(db.user("user-1").authSessionVersion, 1)
    assert.equal(db.securityEmailsByKind("PASSWORD_DISABLED").length, 1)
  })

  it("keeps the committed credential mutation when later email delivery fails", async () => {
    const db = createMethodDatabase({ accounts: [googleAccount()], passwordCredentials: [{ id: "password-1", userId: "user-1", passwordHash: "old-hash" }] })
    const result = await removeGoogleMethod(passwordRemovalProofInput(db))
    assert.equal(result.status, "UPDATED")
    const originalError = console.error
    console.error = () => {}
    try {
      const delivery = await deliverAccountSecurityEmailIntent({
        prismaClient: securityEmailDeliveryClient(db),
        intentId: result.emailIntentId,
        now: NOW,
        send: async () => { throw new Error("provider failed after mutation commit") },
      })
      assert.equal(delivery.status, "FAILED")
    } finally {
      console.error = originalError
    }
    assert.equal(db.googleAccountsFor("user-1").length, 0)
    assert.equal(db.securityEmailsByKind("GOOGLE_UNLINKED").length, 1)
  })
})

function linkInput(db, intentId, overrides = {}) {
  return {
    prismaClient: db,
    intentId,
    sessionUserId: "user-1",
    lastPasswordAuthenticatedAt: NOW.getTime(),
    confirmed: true,
    secret: SECRET,
    now: NOW,
    ...overrides,
  }
}

function passwordAddInput(db, intentId) {
  return {
    prismaClient: db,
    userId: "user-1",
    mode: "ADD",
    googleReauthPreflight: { intentId, targetUserId: "user-1" },
    newPassword: "raw-new-password",
    hashPasswordFn: async () => "new-hash",
    confirmed: true,
    now: NOW,
  }
}

function passwordChangeInput(db) {
  return {
    prismaClient: db, userId: "user-1", mode: "CHANGE", currentPassword: "old-password", newPassword: "raw-new-password",
    networkIdentifier: "network", confirmed: true, now: NOW, verifyPasswordMethodProofFn: verifiedProof, hashPasswordFn: async () => "new-hash",
  }
}

function passwordRemovalProofInput(db) {
  return {
    prismaClient: db, userId: "user-1", password: "old-password", networkIdentifier: "network",
    confirmed: true, now: NOW, verifyPasswordMethodProofFn: verifiedProof,
  }
}

function passwordDisableInput(db, intentId) {
  return { prismaClient: db, userId: "user-1", intentId, confirmed: true, now: NOW }
}

async function verifiedProof() {
  return { status: "VERIFIED", backupCodeConsumed: false, authSessionVersion: 0 }
}

function googleAccount() {
  return { id: "google-1", userId: "user-1", provider: "google", providerAccountId: "google-subject-1", type: "oauth" }
}

function createMethodDatabase(seed = {}) {
  const state = {
    users: structuredClone(seed.users ?? [
      { id: "user-1", email: "user@example.com", emailVerified: NOW, authSessionVersion: 0 },
      { id: "user-2", email: "other@example.com", emailVerified: NOW, authSessionVersion: 0 },
    ]),
    accounts: structuredClone(seed.accounts ?? []),
    passwordCredentials: structuredClone(seed.passwordCredentials ?? []),
    twoFactorSecrets: structuredClone(seed.twoFactorSecrets ?? []),
    intents: [],
    securityEmails: [],
    nextAccount: 1,
    nextIntent: 1,
    nextEmail: 1,
  }
  let transactionQueue = Promise.resolve()
  const db = {
    state,
    insideTransaction: false,
    transactionCount: 0,
    user(id) { return state.users.find((user) => user.id === id) },
    passwordFor(id) { return state.passwordCredentials.find((credential) => credential.userId === id) ?? null },
    googleAccountsFor(id) { return state.accounts.filter((account) => account.userId === id && account.provider === "google") },
    securityEmailsByKind(kind) { return state.securityEmails.filter((intent) => intent.kind === kind) },
    addLinkIntent() {
      const intent = baseIntent(state, "SIGN_IN_OR_LINK")
      intent.status = "PROVIDER_PROVEN"
      intent.providerEmailHash = verifiedEmailHash("user@example.com")
      state.intents.push(intent)
      return intent
    },
    addGoogleReauthIntent(purpose, overrides = {}) {
      const intent = { ...baseIntent(state, purpose), status: "CONSUMED", consumedAt: NOW, providerProvenAt: NOW, ...overrides }
      state.intents.push(intent)
      return intent
    },
    async $transaction(callback, options) {
      assert.equal(options?.isolationLevel, "Serializable")
      db.transactionCount += 1
      let release
      const prior = transactionQueue
      transactionQueue = new Promise((resolve) => { release = resolve })
      await prior
      db.insideTransaction = true
      const snapshot = structuredClone(state)
      try {
        return await callback(buildTransaction(state))
      } catch (error) {
        Object.assign(state, snapshot)
        throw error
      } finally {
        db.insideTransaction = false
        release()
      }
    },
  }
  return db
}

function baseIntent(state, purpose) {
  return {
    id: `intent-${state.nextIntent++}`,
    targetUserId: "user-1",
    purpose,
    status: "PENDING",
    provider: "google",
    providerAccountId: "google-subject-1",
    providerEmailHash: null,
    providerProvenAt: null,
    expiresAt: new Date(NOW.getTime() + 10 * 60_000),
    consumedAt: null,
  }
}

function buildTransaction(state) {
  return {
    user: {
      async findUnique({ where }) {
        const user = state.users.find((candidate) => candidate.id === where.id) ?? null
        if (!user) return null
        return {
          ...structuredClone(user),
          accounts: structuredClone(state.accounts.filter((account) => account.userId === user.id)),
          passwordCredential: structuredClone(state.passwordCredentials.find((credential) => credential.userId === user.id) ?? null),
          twoFactorSecret: structuredClone(state.twoFactorSecrets.find((secret) => secret.userId === user.id) ?? null),
        }
      },
      async update({ where, data }) {
        const user = state.users.find((candidate) => candidate.id === where.id)
        if (!user) throw new Error("missing user")
        user.authSessionVersion += data.authSessionVersion?.increment ?? 0
        return structuredClone(user)
      },
    },
    authMethodIntent: {
      async findUnique({ where }) { return structuredClone(state.intents.find((intent) => intent.id === where.id) ?? null) },
      async updateMany({ where, data }) {
        const matches = state.intents.filter((intent) => matchesIntent(intent, where))
        for (const intent of matches) Object.assign(intent, structuredClone(data))
        return { count: matches.length }
      },
    },
    account: {
      async findUnique({ where }) {
        const key = where.provider_providerAccountId
        return structuredClone(state.accounts.find((account) => account.provider === key.provider && account.providerAccountId === key.providerAccountId) ?? null)
      },
      async create({ data }) {
        if (state.accounts.some((account) => account.provider === data.provider && account.providerAccountId === data.providerAccountId)) {
          throw Object.assign(new Error("unique"), { code: "P2002" })
        }
        const account = { id: `account-${state.nextAccount++}`, ...structuredClone(data) }
        state.accounts.push(account)
        return structuredClone(account)
      },
      async deleteMany({ where }) {
        const before = state.accounts.length
        state.accounts = state.accounts.filter((account) => !matchesAccount(account, where))
        return { count: before - state.accounts.length }
      },
    },
    passwordCredential: {
      async create({ data }) {
        if (state.passwordCredentials.some((credential) => credential.userId === data.userId)) throw Object.assign(new Error("unique"), { code: "P2002" })
        const credential = { id: `password-${data.userId}`, ...structuredClone(data) }
        state.passwordCredentials.push(credential)
        return structuredClone(credential)
      },
      async update({ where, data }) {
        const credential = state.passwordCredentials.find((candidate) => candidate.userId === where.userId)
        if (!credential) throw new Error("missing password")
        Object.assign(credential, structuredClone(data))
        return structuredClone(credential)
      },
      async deleteMany({ where }) {
        const before = state.passwordCredentials.length
        state.passwordCredentials = state.passwordCredentials.filter((credential) => credential.userId !== where.userId)
        return { count: before - state.passwordCredentials.length }
      },
    },
    twoFactorSecret: {
      async findUnique({ where }) { return structuredClone(state.twoFactorSecrets.find((secret) => secret.userId === where.userId) ?? null) },
    },
    accountSecurityEmailIntent: {
      async upsert({ where, create }) {
        const existing = state.securityEmails.find((intent) => intent.idempotencyKey === where.idempotencyKey)
        if (existing) return { id: existing.id }
        const intent = { id: `security-email-${state.nextEmail++}`, ...structuredClone(create), status: "PENDING", attemptCount: 0 }
        state.securityEmails.push(intent)
        return { id: intent.id }
      },
    },
  }
}

function matchesIntent(intent, where) {
  if (where.id !== undefined && intent.id !== where.id) return false
  if (where.targetUserId !== undefined && intent.targetUserId !== where.targetUserId) return false
  if (where.purpose !== undefined && intent.purpose !== where.purpose) return false
  if (where.status !== undefined && intent.status !== where.status) return false
  if (where.provider !== undefined && intent.provider !== where.provider) return false
  if (where.providerAccountId !== undefined && intent.providerAccountId !== where.providerAccountId) return false
  if (where.providerProvenAt !== undefined && intent.providerProvenAt?.getTime() !== where.providerProvenAt?.getTime()) return false
  if (where.consumedAt !== undefined && intent.consumedAt !== where.consumedAt) return false
  if (where.expiresAt?.gt && !(intent.expiresAt > where.expiresAt.gt)) return false
  return true
}

function matchesAccount(account, where) {
  return (where.id === undefined || account.id === where.id)
    && (where.userId === undefined || account.userId === where.userId)
    && (where.provider === undefined || account.provider === where.provider)
}

function verifiedEmailHash(email) {
  return createHmac("sha256", SECRET).update(`verified-google-email\0${email}`).digest("hex")
}

function securityEmailDeliveryClient(db) {
  return {
    accountSecurityEmailIntent: {
      async findUnique({ where }) {
        return structuredClone(db.state.securityEmails.find((intent) => intent.id === where.id) ?? null)
      },
      async updateMany({ where, data }) {
        const matching = db.state.securityEmails.filter((intent) => {
          if (where.id !== undefined && intent.id !== where.id) return false
          if (where.status !== undefined && typeof where.status === "string" && intent.status !== where.status) return false
          if (where.claimTokenHash !== undefined && intent.claimTokenHash !== where.claimTokenHash) return false
          if (where.OR && !where.OR.some((candidate) => {
            if (candidate.status?.in) return candidate.status.in.includes(intent.status)
            return candidate.status === intent.status && intent.claimExpiresAt < candidate.claimExpiresAt.lt
          })) return false
          return true
        })
        for (const intent of matching) {
          for (const [key, value] of Object.entries(data)) {
            intent[key] = value && typeof value === "object" && Object.hasOwn(value, "increment")
              ? (intent[key] ?? 0) + value.increment
              : structuredClone(value)
          }
        }
        return { count: matching.length }
      },
    },
  }
}
