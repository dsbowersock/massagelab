import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  deliverAccountSecurityEmailIntent,
  queueAccountSecurityEmail,
} from "../lib/account-security-email-intents.ts"

const NOW = new Date("2026-08-28T12:00:00.000Z")

describe("durable account-security email intents", () => {
  it("queues fixed copy once for a unique idempotency key", async () => {
    const db = createEmailIntentDatabase()
    const first = await queueAccountSecurityEmail(db, {
      userId: "user-1",
      kind: "PASSWORD_CHANGED",
      recipientEmail: "user@example.com",
      idempotencyKey: "password-changed:user-1:intent-1",
    })
    const replay = await queueAccountSecurityEmail(db, {
      userId: "user-1",
      kind: "PASSWORD_CHANGED",
      recipientEmail: "attacker@example.com",
      idempotencyKey: "password-changed:user-1:intent-1",
    })

    assert.equal(first.id, replay.id)
    assert.equal(db.state.intents.length, 1)
    assert.equal(db.state.intents[0].recipientEmail, "user@example.com")
    assert.match(db.state.intents[0].subject, /password/i)
    assert.match(db.state.intents[0].message, /If you made this change/i)
  })

  it("claims PENDING delivery with a hashed five-minute lease and delivers by exact CAS", async () => {
    const db = createEmailIntentDatabase()
    const queued = await queue(db)
    const sent = []

    const result = await deliverAccountSecurityEmailIntent({
      prismaClient: db,
      intentId: queued.id,
      now: NOW,
      randomBytesFn: () => Buffer.alloc(32, 7),
      send: async (...fields) => {
        sent.push(fields)
        const processing = db.intent(queued.id)
        assert.equal(processing.status, "PROCESSING")
        assert.match(processing.claimTokenHash, /^[a-f0-9]{64}$/)
        assert.equal(processing.claimTokenHash.includes(Buffer.alloc(32, 7).toString("base64url")), false)
        assert.equal(processing.claimExpiresAt.toISOString(), "2026-08-28T12:05:00.000Z")
        return { delivered: true }
      },
    })

    assert.deepEqual(result, { status: "DELIVERED", attempted: true, attemptCount: 1 })
    assert.equal(sent.length, 1)
    assert.equal(db.intent(queued.id).claimTokenHash, null)
    assert.equal(db.intent(queued.id).claimExpiresAt, null)
    assert.equal(db.intent(queued.id).deliveredAt.toISOString(), NOW.toISOString())
  })

  it("rejects a second worker while the claim lease is live", async () => {
    const db = createEmailIntentDatabase()
    const queued = await queue(db)
    let release
    const firstSend = new Promise((resolve) => { release = resolve })
    let sends = 0

    const first = deliverAccountSecurityEmailIntent({
      prismaClient: db,
      intentId: queued.id,
      now: NOW,
      randomBytesFn: () => Buffer.alloc(32, 1),
      send: async () => { sends += 1; await firstSend; return { delivered: true } },
    })
    await waitFor(() => db.intent(queued.id).status === "PROCESSING")
    const second = await deliverAccountSecurityEmailIntent({
      prismaClient: db,
      intentId: queued.id,
      now: new Date(NOW.getTime() + 60_000),
      randomBytesFn: () => Buffer.alloc(32, 2),
      send: async () => { sends += 1; return { delivered: true } },
    })
    release()

    assert.deepEqual(second, { status: "BUSY", attempted: false, attemptCount: 1 })
    assert.equal((await first).status, "DELIVERED")
    assert.equal(sends, 1)
  })

  it("recovers an expired PROCESSING lease after a crashed worker", async () => {
    const db = createEmailIntentDatabase()
    const queued = await queue(db)
    Object.assign(db.intent(queued.id), {
      status: "PROCESSING",
      attemptCount: 1,
      claimTokenHash: "a".repeat(64),
      claimExpiresAt: new Date(NOW.getTime() - 1),
    })

    const result = await deliverAccountSecurityEmailIntent({
      prismaClient: db,
      intentId: queued.id,
      now: NOW,
      randomBytesFn: () => Buffer.alloc(32, 3),
      send: async () => ({ delivered: true }),
    })

    assert.deepEqual(result, { status: "DELIVERED", attempted: true, attemptCount: 2 })
  })

  it("reports an attempted send as ambiguous when an expired-lease worker wins completion", async () => {
    const db = createEmailIntentDatabase()
    const queued = await queue(db)
    let releaseFirst
    let markFirstEntered
    const firstEntered = new Promise((resolve) => { markFirstEntered = resolve })
    const firstBlocked = new Promise((resolve) => { releaseFirst = resolve })
    let providerCalls = 0

    const first = deliverAccountSecurityEmailIntent({
      prismaClient: db,
      intentId: queued.id,
      now: NOW,
      randomBytesFn: () => Buffer.alloc(32, 4),
      send: async () => {
        providerCalls += 1
        markFirstEntered()
        await firstBlocked
        return { delivered: true }
      },
    })
    await firstEntered
    const recovered = await deliverAccountSecurityEmailIntent({
      prismaClient: db,
      intentId: queued.id,
      now: new Date(NOW.getTime() + 5 * 60_000 + 1),
      randomBytesFn: () => Buffer.alloc(32, 5),
      send: async () => { providerCalls += 1; return { delivered: true } },
    })
    releaseFirst()

    assert.deepEqual(recovered, { status: "DELIVERED", attempted: true, attemptCount: 2 })
    assert.deepEqual(await first, { status: "AMBIGUOUS", attempted: true, attemptCount: 1 })
    assert.equal(providerCalls, 2)
    assert.equal(db.intent(queued.id).status, "DELIVERED")
  })

  it("records only an allowlisted failure code and retries FAILED without logging content", async () => {
    const db = createEmailIntentDatabase()
    const queued = await queue(db)
    const secret = "provider-secret user@example.com security message"
    const logs = []
    const originalError = console.error
    console.error = (...fields) => logs.push(fields.join(" "))
    try {
      const failed = await deliverAccountSecurityEmailIntent({
        prismaClient: db,
        intentId: queued.id,
        now: NOW,
        send: async () => { throw new Error(secret) },
      })
      assert.deepEqual(failed, { status: "FAILED", attempted: true, attemptCount: 1, code: "DELIVERY_FAILED" })
      assert.equal(db.intent(queued.id).failureCode, "DELIVERY_FAILED")
      assert.equal(JSON.stringify(db.intent(queued.id)).includes(secret), false)
      assert.equal(logs.join(" ").includes(secret), false)
      assert.equal(logs.join(" ").includes("user@example.com"), false)

      const retried = await deliverAccountSecurityEmailIntent({
        prismaClient: db,
        intentId: queued.id,
        now: new Date(NOW.getTime() + 1),
        send: async () => ({ delivered: true }),
      })
      assert.deepEqual(retried, { status: "DELIVERED", attempted: true, attemptCount: 2 })
    } finally {
      console.error = originalError
    }
  })

  it("documents at-least-once delivery when provider acceptance is ambiguous", async () => {
    const db = createEmailIntentDatabase()
    const queued = await queue(db)
    let providerAcceptances = 0
    const originalError = console.error
    console.error = () => {}
    try {
      await deliverAccountSecurityEmailIntent({
        prismaClient: db,
        intentId: queued.id,
        now: NOW,
        send: async () => { providerAcceptances += 1; throw new Error("connection lost after acceptance") },
      })
      await deliverAccountSecurityEmailIntent({
        prismaClient: db,
        intentId: queued.id,
        now: new Date(NOW.getTime() + 1),
        send: async () => { providerAcceptances += 1; return { delivered: true } },
      })
    } finally {
      console.error = originalError
    }

    assert.equal(providerAcceptances, 2)
    assert.equal(db.intent(queued.id).status, "DELIVERED")
  })
})

async function queue(db) {
  return queueAccountSecurityEmail(db, {
    userId: "user-1",
    kind: "GOOGLE_LINKED",
    recipientEmail: "user@example.com",
    idempotencyKey: `google-linked:user-1:${db.state.intents.length + 1}`,
  })
}

function createEmailIntentDatabase() {
  const state = { intents: [], nextId: 1 }
  const model = {
    async upsert({ where, create }) {
      const existing = state.intents.find((intent) => intent.idempotencyKey === where.idempotencyKey)
      if (existing) return { id: existing.id }
      const intent = {
        id: `email-${state.nextId++}`,
        ...structuredClone(create),
        status: "PENDING",
        attemptCount: 0,
        claimTokenHash: null,
        claimExpiresAt: null,
        lastAttemptedAt: null,
        deliveredAt: null,
        failureCode: null,
      }
      state.intents.push(intent)
      return { id: intent.id }
    },
    async findUnique({ where }) {
      return structuredClone(state.intents.find((intent) => intent.id === where.id) ?? null)
    },
    async updateMany({ where, data }) {
      const matches = state.intents.filter((intent) => matchesWhere(intent, where))
      for (const intent of matches) applyData(intent, data)
      return { count: matches.length }
    },
  }
  return {
    state,
    accountSecurityEmailIntent: model,
    intent(id) { return state.intents.find((intent) => intent.id === id) },
  }
}

function matchesWhere(record, where) {
  if (where.id !== undefined && record.id !== where.id) return false
  if (where.status !== undefined && !matchesScalar(record.status, where.status)) return false
  if (where.claimTokenHash !== undefined && record.claimTokenHash !== where.claimTokenHash) return false
  if (where.OR && !where.OR.some((candidate) => matchesWhere(record, candidate))) return false
  if (where.claimExpiresAt?.lt && !(record.claimExpiresAt < where.claimExpiresAt.lt)) return false
  return true
}

function matchesScalar(value, expected) {
  if (expected && typeof expected === "object" && Array.isArray(expected.in)) return expected.in.includes(value)
  return value === expected
}

function applyData(record, data) {
  for (const [key, value] of Object.entries(data)) {
    record[key] = value && typeof value === "object" && Object.hasOwn(value, "increment")
      ? record[key] + value.increment
      : structuredClone(value)
  }
}

async function waitFor(predicate) {
  for (let index = 0; index < 100; index += 1) {
    if (predicate()) return
    await new Promise((resolve) => setImmediate(resolve))
  }
  throw new Error("condition not reached")
}
