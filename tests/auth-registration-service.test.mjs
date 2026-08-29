import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  PUBLIC_ACCOUNT_ENTRY_MESSAGE,
  registerPasswordAccount,
} from "../lib/auth-registration-service.ts"
import {
  isApprovedIdentityUniqueConstraint,
  isGoogleIdentityUniqueConstraint,
  isUserEmailUniqueConstraint,
} from "../lib/prisma-identity-unique-constraint.ts"

const NOW = new Date("2026-08-28T16:00:00.000Z")
const DOCUMENTS = [
  { key: "terms", version: "2026-08-01", shortLabel: "Terms" },
  { key: "privacy", version: "2026-08-01", shortLabel: "Privacy Policy" },
]

describe("registerPasswordAccount", () => {
  it("consumes both quotas before hashing or account work and creates the complete account atomically", async () => {
    const db = createRegistrationDatabase()

    const result = await registerPasswordAccount(registrationInput(db))
    await db.runScheduledDeliveries()

    assert.deepEqual(result, { status: "ACCEPTED" })
    assert.equal(PUBLIC_ACCOUNT_ENTRY_MESSAGE, "Check that email address for the appropriate sign-in, verification, or recovery next step.")
    assert.deepEqual(db.events.slice(0, 5), ["limit:ACCOUNT", "limit:NETWORK", "delivery.schedule", "normalized-email.query", "hashPassword"])
    assert.equal(db.users.length, 1)
    assert.equal(db.profiles.length, 1)
    assert.equal(db.passwordCredentials.length, 1)
    assert.equal(db.verificationTokens.length, 1)
    assert.equal(db.legalAcceptances.length, DOCUMENTS.length)
    assert.deepEqual(db.roles, [{ userId: db.users[0].id, email: "person@example.com", tx: true }])
    assert.equal(db.transactionCount, 1)
    assert.equal(db.sentVerificationMessages.length, 1)
    assert.equal(db.persistedRawIdentifiers.length, 0)
    assert.ok(db.events.indexOf("transaction.commit") < db.events.indexOf("sendVerification"))
  })

  it("reloads a normalized-email unique race and never creates a second user", async () => {
    const db = createRegistrationDatabase({ duplicateRace: true })

    assert.deepEqual(await registerPasswordAccount(registrationInput(db)), { status: "ACCEPTED" })
    await db.runScheduledDeliveries()

    assert.equal(db.users.length, 1)
    assert.equal(db.userCreateAttempts, 1)
    assert.equal(db.sentExistingMessages.length, 1)
    assert.equal(db.sentVerificationMessages.length, 0)
  })

  for (const [name, constraint] of [
    ["installed-adapter email fields", { fields: ["email"] }],
    ["normalized database index", { index: "User_normalized_email_key" }],
    ["exact-email database index", { index: "User_email_key" }],
  ]) {
    it(`reloads a production-shaped ${name} race`, async () => {
      const db = createRegistrationDatabase({
        duplicateRace: true,
        uniqueError: driverAdapterUniqueError(constraint),
      })

      assert.deepEqual(await registerPasswordAccount(registrationInput(db)), { status: "ACCEPTED" })
      await db.runScheduledDeliveries()
      assert.equal(db.users.length, 1)
      assert.equal(db.sentExistingMessages.length, 1)
    })
  }

  it("reloads the exact functional-email field shape parsed by the installed Neon adapter", async () => {
    const uniqueError = neonFunctionalEmailUniqueError()
    assert.deepEqual(
      uniqueError.meta.driverAdapterError.cause.constraint,
      { fields: ["lower(btrim(email"] },
    )
    const db = createRegistrationDatabase({ duplicateRace: true, uniqueError })

    assert.deepEqual(await registerPasswordAccount(registrationInput(db)), { status: "ACCEPTED" })
    await db.runScheduledDeliveries()

    assert.equal(db.users.length, 1)
    assert.equal(db.sentExistingMessages.length, 1)
  })

  it("allowlists only the exact Neon functional-email field for the User owner", () => {
    const exact = neonFunctionalEmailUniqueError()
    assert.equal(isUserEmailUniqueConstraint(exact), true)
    assert.equal(isGoogleIdentityUniqueConstraint(exact), true)
    assert.equal(isApprovedIdentityUniqueConstraint(exact, ["GOOGLE_ACCOUNT"]), false)

    for (const error of [
      driverAdapterUniqueError({ fields: ["lower(btrim(email))"] }),
      driverAdapterUniqueError({ fields: ["LOWER(btrim(email"] }),
      driverAdapterUniqueError({ fields: [" lower(btrim(email"] }),
      driverAdapterUniqueError({ fields: ["lower(btrim(email "] }),
      driverAdapterUniqueError({ fields: ["lower(email"] }),
      driverAdapterUniqueError({ fields: ["lower(btrim(email", "email"] }),
      driverAdapterUniqueError({ fields: ["lower(btrim(email"] }, { kind: "ForeignKeyConstraintViolation" }),
      driverAdapterUniqueError({ fields: ["lower(btrim(email"] }, { originalCode: "23503" }),
      driverAdapterUniqueError({ fields: ["lower(btrim(email"] }, { code: "P2024" }),
    ]) {
      assert.equal(isUserEmailUniqueConstraint(error), false)
      assert.equal(isGoogleIdentityUniqueConstraint(error), false)
    }
  })

  it("resolves a padded mixed-case stored email through the parameterized functional-index rule", async () => {
    const db = createRegistrationDatabase({
      user: existingUser({
        email: " Person@Example.com ",
        emailVerified: NOW,
        passwordCredential: { passwordHash: "stored-hash" },
      }),
    })

    assert.deepEqual(await registerPasswordAccount(registrationInput(db)), { status: "ACCEPTED" })
    await db.runScheduledDeliveries()

    assert.equal(db.users.length, 1)
    assert.equal(db.userCreateAttempts, 0)
    assert.equal(db.sentExistingMessages.length, 1)
    assert.equal(db.rawQueries.length, 1)
    assert.match(db.rawQueries[0].strings.join("?"), /lower\(btrim\("email"\)\)\s*=\s*\?/)
    assert.doesNotMatch(db.rawQueries[0].strings.join(""), /person@example\.com/i)
    assert.deepEqual(db.rawQueries[0].values, ["person@example.com"])
  })

  it("reloads a functional normalized-email index race", async () => {
    const db = createRegistrationDatabase({
      duplicateRace: true,
      raceWinnerEmail: " Person@Example.com ",
    })

    const result = await registerPasswordAccount(registrationInput(db))
    await db.runScheduledDeliveries()

    assert.deepEqual(result, { status: "ACCEPTED" })
    assert.equal(db.users.length, 1)
    assert.equal(db.users[0].email, " Person@Example.com ")
    assert.equal(db.userCreateAttempts, 1)
    assert.equal(db.sentExistingMessages.length, 1)
    assert.equal(db.rawQueries.length, 2)
  })

  for (const [name, target] of [
    ["named exact-email constraint", "User_email_key"],
    ["Prisma exact email field target", ["email"]],
  ]) {
    it(`reloads a ${name} race without creating a second user`, async () => {
      const db = createRegistrationDatabase({
        duplicateRace: true,
        uniqueError: Object.assign(new Error("exact email race"), {
          code: "P2002",
          meta: { modelName: "User", target },
        }),
      })

      assert.deepEqual(await registerPasswordAccount(registrationInput(db)), { status: "ACCEPTED" })
      await db.runScheduledDeliveries()
      assert.equal(db.users.length, 1)
      assert.equal(db.userCreateAttempts, 1)
      assert.equal(db.sentExistingMessages.length, 1)
    })
  }

  it("propagates undefined, unrelated, multi-field, other-model, and non-unique failures", async () => {
    for (const error of [
      Object.assign(new Error("unknown unique"), { code: "P2002", meta: { modelName: "User" } }),
      Object.assign(new Error("other constraint"), { code: "P2002", meta: { modelName: "User", target: "User_name_key" } }),
      Object.assign(new Error("multi-field"), { code: "P2002", meta: { modelName: "User", target: ["email", "name"] } }),
      Object.assign(new Error("wrong case"), { code: "P2002", meta: { modelName: "User", target: ["Email"] } }),
      Object.assign(new Error("other model"), { code: "P2002", meta: { modelName: "EmailVerificationToken", target: "User_email_key" } }),
      Object.assign(new Error("not unique"), { code: "P2024" }),
      driverAdapterUniqueError(undefined),
      driverAdapterUniqueError({ fields: ["name"] }),
      driverAdapterUniqueError({ fields: ["email", "name"] }),
      driverAdapterUniqueError({ index: "User_name_key" }),
      driverAdapterUniqueError({ index: "User_email_key" }, { originalCode: "23503" }),
      driverAdapterUniqueError({ index: "User_email_key" }, { code: "P2024" }),
      driverAdapterUniqueError({ index: "User_email_key" }, { modelName: "EmailVerificationToken" }),
    ]) {
      const db = createRegistrationDatabase({ uniqueError: error })
      assert.deepEqual(await registerPasswordAccount(registrationInput(db)), { status: "ACCEPTED" })
      await assert.rejects(
        () => db.runScheduledDeliveries(),
        (received) => received !== error && received?.message === "Scheduled registration account work failed.",
      )
      assert.equal(db.userCreateAttempts, 1)
    }
  })

  it("returns before unresolved verification transport and schedules only after commit", async () => {
    const db = createRegistrationDatabase({ deferDelivery: true })
    let releaseProvider
    const provider = new Promise((resolve) => { releaseProvider = resolve })
    const work = registerPasswordAccount(registrationInput(db, {
      sendVerification: async () => provider,
    }))

    const settled = await Promise.race([
      work,
      new Promise((resolve) => setImmediate(() => resolve("STILL_PENDING"))),
    ])
    assert.deepEqual(settled, { status: "ACCEPTED" })
    assert.equal(db.scheduledDeliveries.length, 1)
    assert.equal(db.verificationTokens.length, 0)
    assert.deepEqual(db.events, ["limit:ACCOUNT", "limit:NETWORK", "delivery.schedule"])

    const delivery = db.runScheduledDeliveries()
    await waitFor(() => db.events.includes("transaction.commit"))
    assert.equal(db.verificationTokens.length, 1)
    assert.ok(db.events.indexOf("delivery.schedule") < db.events.indexOf("transaction.commit"))
    releaseProvider({ delivered: false })
    await delivery
  })

  it("accepts new and existing registrations before any account-dependent work and schedules exactly one task", async () => {
    for (const [name, user] of [
      ["new", null],
      ["existing", existingUser({ emailVerified: NOW, passwordCredential: { passwordHash: "stored-hash" } })],
    ]) {
      const db = createRegistrationDatabase({ user, deferDelivery: true })

      assert.deepEqual(await registerPasswordAccount(registrationInput(db)), { status: "ACCEPTED" }, name)
      assert.deepEqual(db.events, ["limit:ACCOUNT", "limit:NETWORK", "delivery.schedule"], name)
      assert.equal(db.scheduledDeliveries.length, 1, name)
      assert.equal(db.transactionCount, 0, name)
      assert.equal(db.users.length, user ? 1 : 0, name)

      await db.runScheduledDeliveries()
      assert.ok(db.events.includes("normalized-email.query"), name)
    }
  })

  it("keeps every accepted account state publicly identical after quota consumption", async () => {
    const cases = [
      {
        name: "unverified matching password",
        user: existingUser({ emailVerified: null, passwordCredential: { passwordHash: "stored-hash" } }),
        expected: { verification: 1, existing: 0, reset: 0 },
      },
      {
        name: "verified password account",
        user: existingUser({ emailVerified: NOW, passwordCredential: { passwordHash: "stored-hash" } }),
        expected: { verification: 0, existing: 1, reset: 0 },
      },
      {
        name: "Google-first account",
        user: existingUser({ emailVerified: NOW, passwordCredential: null }),
        expected: { verification: 0, existing: 0, reset: 1 },
      },
      {
        name: "mismatched password",
        user: existingUser({ emailVerified: null, passwordCredential: { passwordHash: "different-hash" } }),
        expected: { verification: 0, existing: 0, reset: 0 },
      },
    ]

    for (const scenario of cases) {
      const db = createRegistrationDatabase({ user: scenario.user })
      const result = await registerPasswordAccount(registrationInput(db))
      await db.runScheduledDeliveries()

      assert.deepEqual(result, { status: "ACCEPTED" }, scenario.name)
      assert.deepEqual(db.events.slice(0, 5), ["limit:ACCOUNT", "limit:NETWORK", "delivery.schedule", "normalized-email.query", "user.findUnique"], scenario.name)
      assert.equal(db.sentVerificationMessages.length, scenario.expected.verification, scenario.name)
      assert.equal(db.sentExistingMessages.length, scenario.expected.existing, scenario.name)
      assert.equal(db.sentResetMessages.length, scenario.expected.reset, scenario.name)
      assert.equal(db.persistedRawIdentifiers.length, 0, scenario.name)
    }
  })

  it("preserves recoverable account and token state when delivery fails", async () => {
    const fresh = createRegistrationDatabase({ deliveryFailure: true })
    const resend = createRegistrationDatabase({
      user: existingUser({ emailVerified: null, passwordCredential: { passwordHash: "stored-hash" } }),
      deliveryFailure: true,
    })

    assert.deepEqual(await registerPasswordAccount(registrationInput(fresh)), { status: "ACCEPTED" })
    assert.deepEqual(await registerPasswordAccount(registrationInput(resend)), { status: "ACCEPTED" })
    await fresh.runScheduledDeliveries()
    await resend.runScheduledDeliveries()

    assert.equal(fresh.users.length, 1)
    assert.equal(fresh.verificationTokens.length, 1)
    assert.equal(resend.verificationTokens.length, 1)
    assert.equal(resend.verificationTokens[0].consumedAt, null)
  })

  it("returns the exact retry delay without doing password, account, token, transaction, or email work", async () => {
    const db = createRegistrationDatabase({ rateLimited: true })

    assert.deepEqual(await registerPasswordAccount(registrationInput(db)), {
      status: "RATE_LIMITED",
      retryAfterSeconds: 73,
    })
    assert.deepEqual(db.events, ["limit:ACCOUNT", "limit:NETWORK"])
    assert.equal(db.transactionCount, 0)
  })
})

function registrationInput(db, overrides = {}) {
  return {
    prismaClient: db,
    email: " Person@Example.com ",
    password: "a-long-password",
    name: "Person",
    callbackUrl: "/onboarding",
    networkIdentifier: "203.0.113.10",
    secret: "test-secret",
    requiredDocuments: DOCUMENTS,
    legalMetadata: { ipAddress: "203.0.113.10", userAgent: "test" },
    now: NOW,
    consumeRateLimit: async () => db.consumeRateLimit(),
    hashPassword: async () => {
      db.events.push("hashPassword")
      return "new-password-hash"
    },
    verifyPassword: async (hash) => {
      db.events.push("verifyPassword")
      return hash === "stored-hash"
    },
    generateToken: () => "raw-token",
    hashToken: (token) => `hash:${token}`,
    tokenExpiresAt: (minutes) => new Date(NOW.getTime() + minutes * 60_000),
    ensureUserRole: async (userId, email, tx) => {
      assert.equal(tx.__transaction, true)
      tx.__state.roles.push({ userId, email, tx: true })
    },
    recordLegalAcceptances: async ({ prismaClient, userId, documents }) => {
      assert.equal(prismaClient.__transaction, true)
      for (const document of documents) prismaClient.__state.legalAcceptances.push({ userId, ...document })
    },
    sendVerification: async (email, token, callbackUrl) => db.sendVerification(email, token, callbackUrl),
    sendPasswordReset: async (email, token) => db.sendReset(email, token),
    sendExistingAccountNotice: async (email) => db.sendExisting(email),
    scheduleAccountWork: (work) => db.scheduleDelivery(work),
    ...overrides,
  }
}

function existingUser(overrides) {
  return { id: "user-existing", email: "person@example.com", name: "Person", ...overrides }
}

function driverAdapterUniqueError(constraint, {
  code = "P2002",
  kind = "UniqueConstraintViolation",
  originalCode = "23505",
  modelName,
} = {}) {
  return Object.assign(new Error("production unique constraint"), {
    code,
    meta: {
      ...(modelName ? { modelName } : {}),
      driverAdapterError: {
        name: "DriverAdapterError",
        cause: {
          kind,
          originalCode,
          originalMessage: "duplicate key value violates unique constraint",
          constraint,
        },
      },
    },
  })
}

function neonFunctionalEmailUniqueError() {
  const detail = "Key (lower(btrim(email)))=(person@example.com) already exists."
  const fields = detail.match(/Key \(([^)]+)\)/)?.at(1)?.split(", ")
  return driverAdapterUniqueError(fields === undefined ? undefined : { fields })
}

function createRegistrationDatabase({
  user = null,
  duplicateRace = false,
  raceWinnerEmail = "person@example.com",
  uniqueError = null,
  deliveryFailure = false,
  rateLimited = false,
} = {}) {
  let state = {
    users: user ? [structuredClone(user)] : [],
    profiles: [],
    passwordCredentials: user?.passwordCredential ? [{ userId: user.id, ...structuredClone(user.passwordCredential) }] : [],
    verificationTokens: [],
    resetTokens: [],
    legalAcceptances: [],
    roles: [],
  }
  const events = []
  const sentVerificationMessages = []
  const sentExistingMessages = []
  const sentResetMessages = []
  const rawQueries = []
  const scheduledDeliveries = []
  let transactionCount = 0
  let userCreateAttempts = 0
  let firstNormalizedLookup = true

  function client(snapshot, transaction = false) {
    return {
      __transaction: transaction,
      __state: snapshot,
      user: {
        async findUnique({ where }) {
          events.push("user.findUnique")
          return structuredClone(snapshot.users.find((candidate) => candidate.id === where.id) ?? null)
        },
        async create({ data }) {
          events.push("user.create")
          userCreateAttempts += 1
          const normalizedCollision = snapshot.users.some((candidate) => (
            candidate.email?.trim().toLowerCase() === data.email.trim().toLowerCase()
          ))
          if (duplicateRace || uniqueError || normalizedCollision) {
            const normalizedRaceWinnerEmail = raceWinnerEmail.trim().toLowerCase()
            if (!snapshot.users.some((candidate) => candidate.email?.trim().toLowerCase() === normalizedRaceWinnerEmail)) {
              snapshot.users.push(existingUser({
                email: raceWinnerEmail,
                emailVerified: NOW,
                passwordCredential: { passwordHash: "stored-hash" },
              }))
            }
            throw uniqueError ?? Object.assign(new Error("unique email"), {
              code: "P2002",
              meta: { modelName: "User", target: "User_normalized_email_key" },
            })
          }
          const created = { id: "user-new", email: data.email, name: data.name, emailVerified: null }
          snapshot.users.push(created)
          snapshot.profiles.push({ userId: created.id, ...data.profile.create })
          snapshot.passwordCredentials.push({ userId: created.id, ...data.passwordCredential.create })
          snapshot.verificationTokens.push({ id: "verification-new", userId: created.id, consumedAt: null, ...data.emailVerificationTokens.create })
          return structuredClone(created)
        },
      },
      emailVerificationToken: {
        async create({ data }) {
          const row = { id: `verification-${snapshot.verificationTokens.length + 1}`, consumedAt: null, ...data }
          snapshot.verificationTokens.push(row)
          return structuredClone(row)
        },
        async deleteMany({ where }) {
          const before = snapshot.verificationTokens.length
          snapshot.verificationTokens = snapshot.verificationTokens.filter((token) => !(
            token.userId === where.userId && token.consumedAt === null && token.expiresAt < where.expiresAt.lt
          ))
          return { count: before - snapshot.verificationTokens.length }
        },
      },
      passwordResetToken: {
        async create({ data }) {
          const row = { id: `reset-${snapshot.resetTokens.length + 1}`, consumedAt: null, ...data }
          snapshot.resetTokens.push(row)
          return structuredClone(row)
        },
        async deleteMany() { return { count: 0 } },
      },
    }
  }

  const database = Object.assign(client(state), {
    events,
    sentVerificationMessages,
    sentExistingMessages,
    sentResetMessages,
    rawQueries,
    scheduledDeliveries,
    persistedRawIdentifiers: [],
    async consumeRateLimit() {
      events.push("limit:ACCOUNT", "limit:NETWORK")
      return rateLimited ? { allowed: false, retryAfterSeconds: 73 } : { allowed: true }
    },
    async $queryRaw(query) {
      events.push("normalized-email.query")
      rawQueries.push(query)
      if (duplicateRace && firstNormalizedLookup) {
        firstNormalizedLookup = false
        return []
      }
      const normalized = query.values[0]
      const match = state.users.find((candidate) => candidate.email?.trim().toLowerCase() === normalized)
      return match ? [{ id: match.id }] : []
    },
    async $transaction(callback, options) {
      transactionCount += 1
      assert.equal(options?.isolationLevel, "Serializable")
      const snapshot = structuredClone(state)
      try {
        const result = await callback(client(snapshot, true))
        Object.assign(state, snapshot)
        events.push("transaction.commit")
        return result
      } catch (error) {
        if (duplicateRace && error?.code === "P2002") Object.assign(state, snapshot)
        events.push("transaction.rollback")
        throw error
      }
    },
    async sendVerification(email, token, callbackUrl) {
      events.push("sendVerification")
      sentVerificationMessages.push({ email, token, callbackUrl })
      if (deliveryFailure) throw new Error("provider unavailable")
      return { delivered: true }
    },
    async sendExisting(email) {
      events.push("sendExisting")
      sentExistingMessages.push({ email })
      if (deliveryFailure) throw new Error("provider unavailable")
      return { delivered: true }
    },
    async sendReset(email, token) {
      events.push("sendReset")
      sentResetMessages.push({ email, token })
      if (deliveryFailure) throw new Error("provider unavailable")
      return { delivered: true }
    },
    scheduleDelivery(delivery) {
      events.push("delivery.schedule")
      scheduledDeliveries.push(delivery)
    },
    async runScheduledDeliveries() {
      await Promise.all(scheduledDeliveries.splice(0).map((delivery) => delivery()))
    },
  })
  Object.defineProperties(database, {
    users: { get: () => state.users },
    profiles: { get: () => state.profiles },
    passwordCredentials: { get: () => state.passwordCredentials },
    verificationTokens: { get: () => state.verificationTokens },
    legalAcceptances: { get: () => state.legalAcceptances },
    roles: { get: () => state.roles },
    transactionCount: { get: () => transactionCount },
    userCreateAttempts: { get: () => userCreateAttempts },
  })
  return database
}

async function waitFor(predicate) {
  for (let index = 0; index < 100; index += 1) {
    if (predicate()) return
    await new Promise((resolve) => setImmediate(resolve))
  }
  throw new Error("condition not reached")
}
