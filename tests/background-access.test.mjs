import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { resolveBackgroundAccessForUser } from "../lib/commerce/background-access.ts"

const PREMIUM_BACKGROUND = "massage-lab-aurora"
const LATER_PREMIUM_BACKGROUND = "massage-lab-photon-beam"

function createAccessDatabase({
  emailVerified = true,
  subscriptions = [],
  ownership = null,
  balance = 2,
  reservation = null,
} = {}) {
  const state = {
    emailVerified,
    subscriptions,
    ownership,
    balance,
    reservation,
    transactionCalls: 0,
    reads: [],
  }

  function record(model) {
    state.reads.push({ model, transaction: state.transactionCalls })
  }

  const tx = {
    user: {
      async findUnique() {
        record("user")
        return { emailVerified: state.emailVerified ? new Date("2026-07-01T00:00:00.000Z") : null }
      },
    },
    membershipSubscription: {
      async findMany() {
        record("membershipSubscription")
        return state.subscriptions
      },
    },
    studentAccess: {
      async findUnique() {
        record("studentAccess")
        return null
      },
    },
    backgroundOwnership: {
      async findUnique() {
        record("backgroundOwnership")
        return state.ownership
      },
    },
    backgroundCreditWallet: {
      async findUnique() {
        record("backgroundCreditWallet")
        return { balance: state.balance }
      },
    },
    commerceOrder: {
      async findFirst() {
        record("commerceOrder")
        return state.reservation
      },
    },
  }

  const database = {
    async $transaction(callback, options) {
      state.transactionCalls += 1
      assert.equal(options?.isolationLevel, "Serializable")
      return callback(tx)
    },
  }

  return { database, state }
}

async function resolve(database, backgroundId = PREMIUM_BACKGROUND) {
  return resolveBackgroundAccessForUser({
    prismaClient: database,
    userId: "user-1",
    backgroundId,
  })
}

describe("canonical background access", () => {
  it("always enables an enabled free background without inventing permanent ownership", async () => {
    const { database } = createAccessDatabase({ balance: 2 })

    const decision = await resolve(database, "static-gradient")

    assert.equal(decision.canUse, true)
    assert.equal(decision.canCustomizeColors, false)
    assert.equal(decision.accessSource, "free")
    assert.equal(decision.isPermanentlyOwned, false)
    assert.equal(decision.ownershipStatus, null)
    assert.deepEqual(decision.creditEligibility, {
      eligible: false,
      disabledReason: "This background does not need a credit.",
    })
    assert.deepEqual(decision.purchaseEligibility, {
      eligible: false,
      disabledReason: "This background is already free.",
    })
    assert.deepEqual(decision.reservation, { active: false, orderId: null, expiresAt: null })
    assert.equal(decision.disabledReason, null)
  })

  it("uses fresh active membership data for subscription access and color customization", async () => {
    const { database } = createAccessDatabase({
      subscriptions: [{ status: "active", membershipLevel: "SUPPORTER", currentPeriodEnd: null }],
    })

    const decision = await resolve(database)

    assert.equal(decision.canUse, true)
    assert.equal(decision.canCustomizeColors, true)
    assert.equal(decision.accessSource, "subscription")
    assert.equal(decision.isPermanentlyOwned, false)
    assert.equal(decision.creditEligibility.eligible, true, "subscribers may keep a background permanently")
    assert.equal(decision.purchaseEligibility.eligible, true, "subscribers may purchase permanent access")
  })

  for (const source of ["CREDIT_REDEMPTION", "PURCHASE"]) {
    it(`treats active ${source.toLowerCase()} ownership as permanent use and customization`, async () => {
      const { database } = createAccessDatabase({
        ownership: { status: "ACTIVE", source },
      })

      const decision = await resolve(database)

      assert.equal(decision.canUse, true)
      assert.equal(decision.canCustomizeColors, true)
      assert.equal(decision.accessSource, "ownership")
      assert.equal(decision.isPermanentlyOwned, true)
      assert.equal(decision.ownershipStatus, "ACTIVE")
      assert.equal(decision.creditEligibility.eligible, false)
      assert.equal(decision.purchaseEligibility.eligible, false)
    })
  }

  it("keeps permanent ownership authoritative while subscription access is also active", async () => {
    const { database } = createAccessDatabase({
      subscriptions: [{ status: "active", membershipLevel: "SUPPORTER", currentPeriodEnd: null }],
      ownership: { status: "ACTIVE", source: "CREDIT_REDEMPTION" },
    })

    const decision = await resolve(database)

    assert.equal(decision.accessSource, "ownership")
    assert.equal(decision.isPermanentlyOwned, true)
  })

  it("removes subscription access after cancellation when the background is not owned", async () => {
    const { database } = createAccessDatabase({
      subscriptions: [{ status: "canceled", membershipLevel: "SUPPORTER", currentPeriodEnd: null }],
    })

    const decision = await resolve(database)

    assert.equal(decision.canUse, false)
    assert.equal(decision.canCustomizeColors, false)
    assert.equal(decision.accessSource, "locked")
    assert.equal(decision.disabledReason, "Unlock this background with a credit, purchase, or membership.")
  })

  for (const status of [
    "REFUND_PENDING",
    "DISPUTE_SUSPENDED",
    "REFUND_REVOKED",
    "DISPUTE_REVOKED",
    "RETIRED",
  ]) {
    it(`keeps ${status.toLowerCase()} ownership historical and unusable`, async () => {
      const { database } = createAccessDatabase({ ownership: { status, source: "PURCHASE" } })

      const decision = await resolve(database)

      assert.equal(decision.canUse, false)
      assert.equal(decision.canCustomizeColors, false)
      assert.equal(decision.accessSource, "locked")
      assert.equal(decision.isPermanentlyOwned, false)
      assert.equal(decision.ownershipStatus, status)
      assert.equal(decision.creditEligibility.eligible, false)
      assert.equal(decision.purchaseEligibility.eligible, false)
    })
  }

  it("resolves current and later registry premium IDs without a service allowlist", async () => {
    const { database } = createAccessDatabase({
      ownership: { status: "ACTIVE", source: "CREDIT_REDEMPTION" },
    })

    assert.equal((await resolve(database, PREMIUM_BACKGROUND)).canUse, true)
    assert.equal((await resolve(database, LATER_PREMIUM_BACKGROUND)).canUse, true)
  })

  it("returns safe unavailable decisions for disabled and unknown backgrounds", async () => {
    const { database } = createAccessDatabase()

    for (const backgroundId of ["massage-lab-noise-texture-draft", "future-unknown-background"]) {
      const decision = await resolve(database, backgroundId)
      assert.equal(decision.canUse, false)
      assert.equal(decision.creditEligibility.eligible, false)
      assert.equal(decision.purchaseEligibility.eligible, false)
      assert.equal(decision.disabledReason, "This background is unavailable.")
    }
  })

  it("derives eligibility and reservation from the same fresh transaction snapshot", async () => {
    const reservationExpiresAt = new Date(Date.now() + 10 * 60 * 1000)
    const { database, state } = createAccessDatabase({
      balance: 1,
      reservation: { id: "order-1", reservationExpiresAt },
    })

    const reserved = await resolve(database)

    assert.deepEqual(reserved.reservation, {
      active: true,
      orderId: "order-1",
      expiresAt: reservationExpiresAt.toISOString(),
    })
    assert.deepEqual(reserved.creditEligibility, {
      eligible: false,
      disabledReason: "This background is reserved for checkout.",
    })
    assert.deepEqual(reserved.purchaseEligibility, {
      eligible: false,
      disabledReason: "This background is reserved for checkout.",
    })
    assert.equal(state.transactionCalls, 1)
    assert.ok(state.reads.every((read) => read.transaction === 1))

    state.reservation = null
    state.balance = 0
    const fresh = await resolve(database)
    assert.equal(fresh.reservation.active, false)
    assert.deepEqual(fresh.creditEligibility, {
      eligible: false,
      disabledReason: "No purchase credits remain.",
    })
    assert.equal(fresh.purchaseEligibility.eligible, true)
    assert.equal(state.transactionCalls, 2)
    assert.ok(state.reads.slice(6).every((read) => read.transaction === 2))
  })

  it("requires a freshly verified account before enabling acquisition", async () => {
    const { database } = createAccessDatabase({ emailVerified: false, balance: 2 })

    const decision = await resolve(database)

    assert.equal(decision.canUse, false)
    assert.equal(decision.creditEligibility.eligible, false)
    assert.equal(decision.creditEligibility.disabledReason, "Verify your email to use a credit.")
    assert.equal(decision.purchaseEligibility.eligible, false)
    assert.equal(decision.purchaseEligibility.disabledReason, "Verify your email to purchase this background.")
  })
})
