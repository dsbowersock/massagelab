import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { requestPasswordReset } from "../lib/password-reset-request.ts"

const NOW = new Date("2026-08-28T16:00:00.000Z")

describe("requestPasswordReset", () => {
  it("keeps known and unknown requests identical while consuming both privacy-safe quotas", async () => {
    const db = createResetRequestDatabase()

    for (const email of ["known@example.com", "unknown@example.com"]) {
      assert.deepEqual(await requestPasswordReset(resetInput(db, email)), { status: "ACCEPTED" })
      await db.runScheduledDeliveries()
    }
    assert.equal(db.rateBucket("PASSWORD_RESET", "ACCOUNT", "known@example.com").count, 1)
    assert.equal(db.rateBucket("PASSWORD_RESET", "ACCOUNT", "unknown@example.com").count, 1)
    assert.equal(db.rateBucket("PASSWORD_RESET", "NETWORK", "203.0.113.20").count, 2)
    assert.equal(db.sentResetMessages.length, 1)
    assert.equal(db.persistedRawIdentifiers.length, 0)
    assert.deepEqual(db.events.slice(0, 5), ["limit:ACCOUNT", "limit:NETWORK", "delivery.schedule", "normalized-email.query", "user.findUnique"])
  })

  it("returns the exact retry delay before lookup, token, cleanup, transaction, or email work", async () => {
    const db = createResetRequestDatabase({ rateLimited: true })

    assert.deepEqual(await requestPasswordReset(resetInput(db, "known@example.com")), {
      status: "RATE_LIMITED",
      retryAfterSeconds: 91,
    })
    assert.deepEqual(db.events, ["limit:ACCOUNT", "limit:NETWORK"])
    assert.equal(db.transactionCount, 0)
    assert.equal(db.sentResetMessages.length, 0)
  })

  it("preserves a usable token and accepted response when delivery fails", async () => {
    const db = createResetRequestDatabase({ deliveryFailure: true })

    assert.deepEqual(await requestPasswordReset(resetInput(db, "known@example.com")), { status: "ACCEPTED" })
    await db.runScheduledDeliveries()

    assert.equal(db.resetTokens.filter((token) => !token.consumedAt && token.expiresAt > NOW).length, 1)
    assert.equal(db.sentResetMessages.length, 1)
  })

  it("resolves padded mixed-case stored users with a bound functional-index query", async () => {
    const db = createResetRequestDatabase({ mixedCaseKnownUser: true })

    assert.deepEqual(await requestPasswordReset(resetInput(db, "person@example.com")), { status: "ACCEPTED" })
    await db.runScheduledDeliveries()

    assert.equal(db.resetTokens.length, 1)
    assert.equal(db.sentResetMessages.length, 1)
    assert.match(db.rawQueries[0].strings.join("?"), /lower\(btrim\("email"\)\)\s*=\s*\?/)
    assert.doesNotMatch(db.rawQueries[0].strings.join(""), /person@example\.com/i)
    assert.deepEqual(db.rawQueries[0].values, ["person@example.com"])
  })

  it("returns before unresolved reset transport and schedules only after token commit", async () => {
    const db = createResetRequestDatabase()
    let releaseProvider
    const provider = new Promise((resolve) => { releaseProvider = resolve })
    const work = requestPasswordReset(resetInput(db, "known@example.com", {
      sendPasswordReset: async () => provider,
    }))

    const settled = await Promise.race([
      work,
      new Promise((resolve) => setImmediate(() => resolve("STILL_PENDING"))),
    ])
    assert.deepEqual(settled, { status: "ACCEPTED" })
    assert.equal(db.scheduledDeliveries.length, 1)
    assert.equal(db.resetTokens.length, 0)
    assert.deepEqual(db.events, ["limit:ACCOUNT", "limit:NETWORK", "delivery.schedule"])

    const delivery = db.runScheduledDeliveries()
    await waitFor(() => db.events.includes("transaction.commit"))
    assert.equal(db.resetTokens.length, 1)
    assert.ok(db.events.indexOf("delivery.schedule") < db.events.indexOf("transaction.commit"))
    releaseProvider({ delivered: false })
    await delivery
  })

  it("accepts known and unknown accounts before lookup, token work, or mail and schedules one task each", async () => {
    for (const email of ["known@example.com", "unknown@example.com"]) {
      const db = createResetRequestDatabase()

      assert.deepEqual(await requestPasswordReset(resetInput(db, email)), { status: "ACCEPTED" })
      assert.deepEqual(db.events, ["limit:ACCOUNT", "limit:NETWORK", "delivery.schedule"], email)
      assert.equal(db.scheduledDeliveries.length, 1, email)
      assert.equal(db.transactionCount, 0, email)
      assert.equal(db.resetTokens.length, 0, email)

      await db.runScheduledDeliveries()
      assert.ok(db.events.includes("normalized-email.query"), email)
    }
  })

  it("cleans expired tokens only after quota consumption and retains usable links", async () => {
    const db = createResetRequestDatabase({ includeExpiredToken: true, includeUsableToken: true })

    assert.deepEqual(await requestPasswordReset(resetInput(db, "known@example.com")), { status: "ACCEPTED" })
    await db.runScheduledDeliveries()

    assert.equal(db.resetTokens.some((token) => token.id === "expired"), false)
    assert.equal(db.resetTokens.some((token) => token.id === "usable"), true)
    assert.equal(db.resetTokens.filter((token) => !token.consumedAt).length, 2)
    assert.ok(db.events.indexOf("limit:NETWORK") < db.events.indexOf("token.deleteExpired"))
  })

  it("does not issue reset state or report an internal failure for unknown and unverified accounts", async () => {
    for (const email of ["unknown@example.com", "unverified@example.com"]) {
      const db = createResetRequestDatabase()
      assert.deepEqual(await requestPasswordReset(resetInput(db, email)), { status: "ACCEPTED" })
      await db.runScheduledDeliveries()
      assert.equal(db.resetTokens.length, 0)
      assert.equal(db.sentResetMessages.length, 0)
    }
  })
})

function resetInput(db, email, overrides = {}) {
  return {
    prismaClient: db,
    email,
    networkIdentifier: "203.0.113.20",
    secret: "test-secret",
    now: NOW,
    consumeRateLimit: async (input) => db.consumeRateLimit(input),
    generateToken: () => "raw-reset-token",
    hashToken: (token) => `hash:${token}`,
    tokenExpiresAt: (minutes) => new Date(NOW.getTime() + minutes * 60_000),
    sendPasswordReset: async (recipient, token) => db.sendReset(recipient, token),
    scheduleAccountWork: (work) => db.scheduleDelivery(work),
    ...overrides,
  }
}

function createResetRequestDatabase({
  rateLimited = false,
  deliveryFailure = false,
  includeExpiredToken = false,
  includeUsableToken = false,
  mixedCaseKnownUser = false,
} = {}) {
  const users = [
    { id: "known-user", email: "known@example.com", emailVerified: NOW },
    { id: "unverified-user", email: "unverified@example.com", emailVerified: null },
    ...(mixedCaseKnownUser ? [{ id: "mixed-user", email: " Person@Example.com ", emailVerified: NOW }] : []),
  ]
  let resetTokens = [
    ...(includeExpiredToken ? [{ id: "expired", userId: "known-user", tokenHash: "expired", expiresAt: new Date(NOW.getTime() - 1), consumedAt: null }] : []),
    ...(includeUsableToken ? [{ id: "usable", userId: "known-user", tokenHash: "usable", expiresAt: new Date(NOW.getTime() + 1), consumedAt: null }] : []),
  ]
  const buckets = new Map()
  const events = []
  const sentResetMessages = []
  const rawQueries = []
  const scheduledDeliveries = []
  let transactionCount = 0

  function client(snapshot, transaction = false) {
    return {
      __transaction: transaction,
      user: {
        async findUnique({ where, select }) {
          events.push("user.findUnique")
          assert.deepEqual(select, { id: true, email: true, emailVerified: true })
          return structuredClone(users.find((user) => user.id === where.id) ?? null)
        },
      },
      passwordResetToken: {
        async create({ data }) {
          events.push("token.create")
          const row = { id: `created-${snapshot.length + 1}`, consumedAt: null, ...data }
          snapshot.push(row)
          return structuredClone(row)
        },
        async deleteMany({ where }) {
          events.push("token.deleteExpired")
          const before = snapshot.length
          const retained = snapshot.filter((token) => !(
            token.userId === where.userId && token.expiresAt < where.expiresAt.lt
          ))
          snapshot.splice(0, snapshot.length, ...retained)
          return { count: before - snapshot.length }
        },
      },
    }
  }

  const database = Object.assign(client(resetTokens), {
    events,
    sentResetMessages,
    rawQueries,
    scheduledDeliveries,
    persistedRawIdentifiers: [],
    rateBucket(purpose, scope, identifier) {
      return { count: buckets.get(`${purpose}:${scope}:${identifier}`) ?? 0 }
    },
    async consumeRateLimit(input) {
      events.push("limit:ACCOUNT", "limit:NETWORK")
      for (const [scope, identifier] of [["ACCOUNT", input.email], ["NETWORK", input.networkIdentifier]]) {
        const key = `${input.purpose}:${scope}:${identifier}`
        buckets.set(key, (buckets.get(key) ?? 0) + 1)
      }
      return rateLimited ? { allowed: false, retryAfterSeconds: 91 } : { allowed: true }
    },
    async $queryRaw(query) {
      events.push("normalized-email.query")
      rawQueries.push(query)
      const normalized = query.values[0]
      const match = users.find((user) => user.email.trim().toLowerCase() === normalized)
      return match ? [{ id: match.id }] : []
    },
    async $transaction(callback, options) {
      transactionCount += 1
      assert.equal(options?.isolationLevel, "Serializable")
      const snapshot = structuredClone(resetTokens)
      const result = await callback(client(snapshot, true))
      resetTokens.splice(0, resetTokens.length, ...snapshot)
      events.push("transaction.commit")
      return result
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
    resetTokens: { get: () => resetTokens },
    transactionCount: { get: () => transactionCount },
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
