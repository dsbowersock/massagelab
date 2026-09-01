import assert from "node:assert/strict"
import { describe, it } from "node:test"

const proofModule = await import("../lib/auth-method-intent-proof.ts")

const NOW = new Date("2026-08-29T12:00:00.000Z")
const PURPOSES = [
  "LINK_GOOGLE",
  "ADD_PASSWORD",
  "REMOVE_PASSWORD",
  "ENROLL_TWO_FACTOR",
  "DISABLE_TWO_FACTOR",
  "REGENERATE_TWO_FACTOR_BACKUP_CODES",
]

describe("fresh consumed Google security reauthentication", () => {
  it("accepts every security purpose at the exact five-minute boundary", () => {
    assert.equal(typeof proofModule.isFreshConsumedGoogleReauth, "function")

    for (const purpose of PURPOSES) {
      assert.equal(
        proofModule.isFreshConsumedGoogleReauth(
          freshIntent({ purpose, providerProvenAt: new Date(NOW.getTime() - 5 * 60_000) }),
          purpose,
          "user-1",
          NOW,
        ),
        true,
        purpose,
      )
    }
  })

  it("rejects any mismatched identity, purpose, provider, status, proof time, or expiry", () => {
    assert.equal(typeof proofModule.isFreshConsumedGoogleReauth, "function")

    const invalidRows = [
      { label: "missing row", intent: null },
      { label: "wrong user", intent: freshIntent({ targetUserId: "user-2" }) },
      { label: "wrong purpose", intent: freshIntent({ purpose: "ADD_PASSWORD" }) },
      { label: "wrong provider", intent: freshIntent({ provider: "github" }) },
      { label: "missing provider account", intent: freshIntent({ providerAccountId: "" }) },
      { label: "wrong status", intent: freshIntent({ status: "PROVIDER_PROVEN" }) },
      { label: "missing proof time", intent: freshIntent({ providerProvenAt: null }) },
      { label: "stale proof time", intent: freshIntent({ providerProvenAt: new Date(NOW.getTime() - 5 * 60_000 - 1) }) },
      { label: "future proof time", intent: freshIntent({ providerProvenAt: new Date(NOW.getTime() + 1) }) },
      { label: "expired", intent: freshIntent({ expiresAt: NOW }) },
      { label: "invalid expiry", intent: freshIntent({ expiresAt: "later" }) },
      { label: "decorated array", intent: Object.assign([], freshIntent()) },
    ]

    for (const { label, intent } of invalidRows) {
      assert.equal(
        proofModule.isFreshConsumedGoogleReauth(intent, "LINK_GOOGLE", "user-1", NOW),
        false,
        label,
      )
    }
  })

  it("consumes the exact proof with one compare-and-set winner", async () => {
    assert.equal(typeof proofModule.consumeFreshGoogleReauth, "function")
    const db = createProofDatabase(freshIntent())

    const first = await db.transaction((tx) => proofModule.consumeFreshGoogleReauth(
      tx,
      db.intent,
      "LINK_GOOGLE",
      "user-1",
      NOW,
    ))
    const second = await db.transaction((tx) => proofModule.consumeFreshGoogleReauth(
      tx,
      freshIntent(),
      "LINK_GOOGLE",
      "user-1",
      NOW,
    ))

    assert.equal(first, true)
    assert.equal(second, false)
    assert.equal(db.intent.providerProvenAt, null)
    assert.equal(db.updateCount, 1)
  })

  it("does not consume a fresh proof for a different caller-expected purpose", async () => {
    assert.equal(proofModule.consumeFreshGoogleReauth.length, 5)
    const db = createProofDatabase(freshIntent({ purpose: "LINK_GOOGLE" }))

    const consumed = await db.transaction((tx) => proofModule.consumeFreshGoogleReauth(
      tx,
      db.intent,
      "ADD_PASSWORD",
      "user-1",
      NOW,
    ))

    assert.equal(consumed, false)
    assert.equal(db.updateCount, 0)
    assert.equal(db.intent.providerProvenAt.getTime(), NOW.getTime())
  })

  it("does not consume a fresh proof for a different caller-expected user", async () => {
    assert.equal(proofModule.consumeFreshGoogleReauth.length, 5)
    const db = createProofDatabase(freshIntent({ targetUserId: "user-1" }))

    const consumed = await db.transaction((tx) => proofModule.consumeFreshGoogleReauth(
      tx,
      db.intent,
      "LINK_GOOGLE",
      "user-2",
      NOW,
    ))

    assert.equal(consumed, false)
    assert.equal(db.updateCount, 0)
    assert.equal(db.intent.providerProvenAt.getTime(), NOW.getTime())
  })

  it("restores provider proof when its surrounding transaction rolls back", async () => {
    assert.equal(typeof proofModule.consumeFreshGoogleReauth, "function")
    const db = createProofDatabase(freshIntent())

    await assert.rejects(
      db.transaction(async (tx) => {
        assert.equal(await proofModule.consumeFreshGoogleReauth(
          tx,
          db.intent,
          "LINK_GOOGLE",
          "user-1",
          NOW,
        ), true)
        throw new Error("inject rollback after proof consumption")
      }),
      /inject rollback/,
    )
    assert.equal(db.intent.providerProvenAt.getTime(), NOW.getTime())

    assert.equal(
      await db.transaction((tx) => proofModule.consumeFreshGoogleReauth(
        tx,
        db.intent,
        "LINK_GOOGLE",
        "user-1",
        NOW,
      )),
      true,
    )
    assert.equal(db.intent.providerProvenAt, null)
  })
})

function freshIntent(overrides = {}) {
  return {
    id: "intent-1",
    targetUserId: "user-1",
    purpose: "LINK_GOOGLE",
    status: "CONSUMED",
    provider: "google",
    providerAccountId: "google-subject-1",
    providerProvenAt: NOW,
    expiresAt: new Date(NOW.getTime() + 60_000),
    ...overrides,
  }
}

function createProofDatabase(seedIntent) {
  let intent = structuredClone(seedIntent)
  let updateCount = 0

  return {
    get intent() { return structuredClone(intent) },
    get updateCount() { return updateCount },
    async transaction(callback) {
      const before = structuredClone(intent)
      const beforeUpdateCount = updateCount
      const tx = {
        authMethodIntent: {
          async updateMany({ where, data }) {
            if (!matchesIntent(intent, where)) return { count: 0 }
            Object.assign(intent, structuredClone(data))
            updateCount += 1
            return { count: 1 }
          },
        },
      }
      try {
        return await callback(tx)
      } catch (error) {
        intent = before
        updateCount = beforeUpdateCount
        throw error
      }
    },
  }
}

function matchesIntent(intent, where) {
  return intent.id === where.id
    && intent.targetUserId === where.targetUserId
    && intent.purpose === where.purpose
    && intent.status === where.status
    && intent.provider === where.provider
    && intent.providerAccountId === where.providerAccountId
    && intent.providerProvenAt?.getTime() === where.providerProvenAt?.getTime()
    && intent.expiresAt > where.expiresAt.gt
}
