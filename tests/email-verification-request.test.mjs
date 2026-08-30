import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { requestEmailVerification } from "../lib/email-verification-request.ts"

const NOW = new Date("2026-08-29T12:00:00.000Z")

describe("requestEmailVerification", () => {
  it("keeps unknown, verified, and unverified accounts identical until one post-response task runs", async () => {
    for (const scenario of ["unknown", "verified", "unverified"]) {
      const db = createVerificationDatabase({ scenario })

      const result = await requestEmailVerification(verificationInput(db)).catch(() => "NOT_IMPLEMENTED")
      assert.deepEqual(result, { status: "ACCEPTED" }, scenario)
      assert.deepEqual(db.events, ["limit:REGISTER:ACCOUNT", "limit:REGISTER:NETWORK", "work.schedule"], scenario)
      assert.equal(db.scheduled.length, 1, scenario)
      assert.equal(db.tokens.length, 0, scenario)
      assert.equal(db.sent.length, 0, scenario)

      await db.runScheduled()
      assert.ok(db.events.indexOf("work.schedule") < db.events.indexOf("normalized-email.query"), scenario)
      assert.equal(db.tokens.length, scenario === "unverified" ? 1 : 0, scenario)
      assert.equal(db.sent.length, scenario === "unverified" ? 1 : 0, scenario)
    }
  })

  it("returns exact limiter metadata before scheduling, lookup, token, or email work", async () => {
    const db = createVerificationDatabase({ rateLimited: true })

    const result = await requestEmailVerification(verificationInput(db)).catch(() => "NOT_IMPLEMENTED")
    assert.deepEqual(result, {
      status: "RATE_LIMITED",
      retryAfterSeconds: 83,
    })
    assert.deepEqual(db.events, ["limit:REGISTER:ACCOUNT", "limit:REGISTER:NETWORK"])
    assert.equal(db.scheduled.length, 0)
    assert.equal(db.tokens.length, 0)
    assert.equal(db.sent.length, 0)
  })

  it("uses a parameterized normalized-email lookup and stores only a hashed token", async () => {
    const db = createVerificationDatabase({ scenario: "unverified", storedEmail: " Person@Example.com " })

    const result = await requestEmailVerification(verificationInput(db)).catch(() => "NOT_IMPLEMENTED")
    assert.deepEqual(result, { status: "ACCEPTED" })
    await db.runScheduled()

    assert.match(db.rawQueries[0].strings.join("?"), /lower\(btrim\("email"\)\)\s*=\s*\?/)
    assert.doesNotMatch(db.rawQueries[0].strings.join(""), /person@example\.com/i)
    assert.deepEqual(db.rawQueries[0].values, ["person@example.com"])
    assert.deepEqual(db.tokens.map(({ tokenHash, email }) => ({ tokenHash, email })), [{
      tokenHash: "hashed-verification-token",
      email: "person@example.com",
    }])
    assert.equal(JSON.stringify(db.tokens).includes("raw-verification-token"), false)
  })

  it("keeps a usable committed token when mail fails without logging account or provider details", async () => {
    const db = createVerificationDatabase({ scenario: "unverified", deliveryFailure: true })
    const logs = []
    const originalError = console.error
    console.error = (...fields) => logs.push(fields.join(" "))
    try {
      const result = await requestEmailVerification(verificationInput(db)).catch(() => "NOT_IMPLEMENTED")
      assert.deepEqual(result, { status: "ACCEPTED" })
      await db.runScheduled()
    } finally {
      console.error = originalError
    }

    assert.equal(db.tokens.filter((token) => !token.consumedAt && token.expiresAt > NOW).length, 1)
    assert.equal(logs.length, 0)
    assert.equal(logs.join(" ").includes("person@example.com"), false)
    assert.equal(logs.join(" ").includes("provider-private-detail"), false)
  })
})

function verificationInput(db, overrides = {}) {
  return {
    prismaClient: db,
    email: " Person@Example.com ",
    callbackUrl: "/clock?source=verify",
    networkIdentifier: "203.0.113.29",
    secret: "test-secret",
    now: NOW,
    shouldPrune: () => false,
    consumeRateLimit: async (input) => db.consumeRateLimit(input),
    generateToken: () => "raw-verification-token",
    hashToken: (token) => token === "raw-verification-token" ? "hashed-verification-token" : "unexpected-token",
    tokenExpiresAt: (minutes) => new Date(NOW.getTime() + minutes * 60_000),
    sendVerification: async (email, token, callbackUrl) => db.sendVerification(email, token, callbackUrl),
    scheduleAccountWork: (work) => db.schedule(work),
    ...overrides,
  }
}

function createVerificationDatabase({
  scenario = "unknown",
  storedEmail = "person@example.com",
  rateLimited = false,
  deliveryFailure = false,
} = {}) {
  const user = scenario === "unknown"
    ? null
    : { id: "user-1", email: storedEmail, emailVerified: scenario === "verified" ? NOW : null }
  let tokens = []
  const events = []
  const sent = []
  const rawQueries = []
  const scheduled = []

  function client(snapshot) {
    return {
      user: {
        async findUnique({ where, select }) {
          events.push("user.findUnique")
          assert.deepEqual(select, { id: true, email: true, emailVerified: true })
          return where.id === user?.id ? structuredClone(user) : null
        },
      },
      emailVerificationToken: {
        async create({ data }) {
          events.push("token.create")
          const token = { id: `token-${snapshot.length + 1}`, consumedAt: null, ...structuredClone(data) }
          snapshot.push(token)
          return structuredClone(token)
        },
        async deleteMany({ where }) {
          events.push("token.delete-expired")
          const before = snapshot.length
          const retained = snapshot.filter((token) => !(
            token.userId === where.userId
            && token.consumedAt === where.consumedAt
            && token.expiresAt < where.expiresAt.lt
          ))
          snapshot.splice(0, snapshot.length, ...retained)
          return { count: before - snapshot.length }
        },
      },
    }
  }

  const database = Object.assign(client(tokens), {
    events,
    sent,
    rawQueries,
    scheduled,
    async consumeRateLimit(input) {
      events.push(`limit:${input.purpose}:ACCOUNT`, `limit:${input.purpose}:NETWORK`)
      return rateLimited ? { allowed: false, retryAfterSeconds: 83 } : { allowed: true }
    },
    async $queryRaw(query) {
      events.push("normalized-email.query")
      rawQueries.push(query)
      return user && user.email.trim().toLowerCase() === query.values[0] ? [{ id: user.id }] : []
    },
    async $transaction(callback, options) {
      assert.equal(options?.isolationLevel, "Serializable")
      const snapshot = structuredClone(tokens)
      const result = await callback(client(snapshot))
      tokens = snapshot
      events.push("transaction.commit")
      return result
    },
    async sendVerification(email, token, callbackUrl) {
      events.push("sendVerification")
      sent.push({ email, token, callbackUrl })
      if (deliveryFailure) throw new Error("provider-private-detail person@example.com")
      return { delivered: true }
    },
    schedule(work) {
      events.push("work.schedule")
      scheduled.push(work)
    },
    async runScheduled() {
      await Promise.all(scheduled.splice(0).map((work) => work()))
    },
  })
  Object.defineProperty(database, "tokens", { get: () => tokens })
  return database
}
