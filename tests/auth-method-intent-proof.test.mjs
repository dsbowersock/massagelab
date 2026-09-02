import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import { createCompiledModuleLoader } from "./helpers/compiled-module.mjs"

const proofModule = await import("../lib/auth-method-intent-proof.ts")
const loadCompiledModule = createCompiledModuleLoader(import.meta.url)
const authMethodIntentsSource = await readFile(
  new URL("../lib/auth-method-intents.ts", import.meta.url),
  "utf8",
)
const { SESSION_BOUND_PURPOSES } = loadCompiledModule(
  authMethodIntentsSource,
  "auth-method-intent-purposes.test.ts",
  {
    "@/lib/auth-env": {},
    "@/lib/auth-security": {},
    "@/lib/auth-users": {},
    "@/lib/commerce/credit-service": {},
    "@/lib/commerce/transactions": {},
    "@/lib/legal-acceptance-gate": {},
    "@/lib/normalized-user-email": {},
    "@/lib/prisma-identity-unique-constraint": {},
    "@/lib/prisma": {},
    "@/lib/public-launch-controls": {},
  },
)

const NOW = new Date("2026-08-29T12:00:00.000Z")

describe("fresh consumed Google security reauthentication", () => {
  it("accepts every security purpose at the exact five-minute boundary", () => {
    assert.equal(typeof proofModule.isFreshConsumedGoogleReauth, "function")

    for (const purpose of SESSION_BOUND_PURPOSES) {
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
    const expectedWhere = {
      id: "intent-1",
      targetUserId: "user-1",
      purpose: "LINK_GOOGLE",
      status: "CONSUMED",
      provider: "google",
      providerAccountId: "google-subject-1",
      providerProvenAt: NOW,
      expiresAt: { gt: NOW },
    }
    assert.deepEqual(db.updateWheres, [expectedWhere, expectedWhere])
  })

  it("does not consume a fresh proof for a different caller-expected purpose", async () => {
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

/**
 * Models transaction rollback for durable intent/update state while retaining
 * every attempted CAS `where` clause as an observation log for assertions.
 */
function createProofDatabase(seedIntent) {
  let intent = structuredClone(seedIntent)
  let updateCount = 0
  const updateWheres = []

  return {
    get intent() { return structuredClone(intent) },
    get updateCount() { return updateCount },
    get updateWheres() { return structuredClone(updateWheres) },
    async transaction(callback) {
      const before = structuredClone(intent)
      const beforeUpdateCount = updateCount
      const tx = {
        authMethodIntent: {
          async updateMany({ where, data }) {
            updateWheres.push(structuredClone(where))
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

/** Applies the proof consumer's exact identity, freshness, and expiry CAS predicate. */
function matchesIntent(intent, where) {
  const expiresAfter = where?.expiresAt?.gt
  const providerProvenAt = where?.providerProvenAt
  if (
    !(expiresAfter instanceof Date)
    || !(providerProvenAt instanceof Date)
    || !(intent.expiresAt instanceof Date)
    || !(intent.providerProvenAt instanceof Date)
  ) return false

  return intent.id === where.id
    && intent.targetUserId === where.targetUserId
    && intent.purpose === where.purpose
    && intent.status === where.status
    && intent.provider === where.provider
    && intent.providerAccountId === where.providerAccountId
    && intent.providerProvenAt.getTime() === providerProvenAt.getTime()
    && intent.expiresAt > expiresAfter
}
