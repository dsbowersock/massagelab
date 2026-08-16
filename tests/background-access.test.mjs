import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { resolveBackgroundAccessForUser } from "../lib/commerce/background-access.ts"
import { TEMPORARY_ACCESS_FEATURE_KEYS } from "../lib/membership.js"
import { TOTAL_ACTIVE_LIMIT } from "../lib/admin/temporary-access-contract.ts"

const PREMIUM_BACKGROUND = "massage-lab-aurora"
const LATER_PREMIUM_BACKGROUND = "massage-lab-photon-beam"

function createAccessDatabase({
  admin = false,
  emailVerified = true,
  subscriptions = [],
  temporaryGrants = [],
  ownership = null,
  balance = 2,
  reservation = null,
} = {}) {
  const state = {
    emailVerified,
    admin,
    subscriptions,
    temporaryGrants,
    ownership,
    balance,
    reservation,
    transactionCalls: 0,
    reads: [],
    temporaryGrantQuery: null,
    reservationQuery: null,
  }

  function record(model) {
    state.reads.push({ model, transaction: state.transactionCalls })
  }

  const tx = {
    user: {
      async findUnique() {
        record("user")
        return {
          emailVerified: state.emailVerified ? new Date("2026-07-01T00:00:00.000Z") : null,
          roles: state.admin ? [{ id: "admin-role-1" }] : [],
        }
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
    temporaryFeatureGrant: {
      async findMany(query) {
        record("temporaryFeatureGrant")
        state.temporaryGrantQuery = query
        return state.temporaryGrants
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
      async findFirst(query) {
        record("commerceOrder")
        state.reservationQuery = query
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

/** Builds the canonical access state for each approved color-access matrix row. */
function buildAccessDatabase(fixture) {
  switch (fixture) {
    case "subscription":
      return createAccessDatabase({
        subscriptions: [{ status: "active", membershipLevel: "SUPPORTER", currentPeriodEnd: null }],
      }).database
    case "purchase":
      return createAccessDatabase({ ownership: { status: "ACTIVE", source: "PURCHASE" } }).database
    case "credit":
      return createAccessDatabase({ ownership: { status: "ACTIVE", source: "CREDIT_REDEMPTION" } }).database
    case "locked":
    case "free":
      return createAccessDatabase().database
    default:
      throw new Error(`Unknown access fixture: ${fixture}`)
  }
}

async function resolve(database, backgroundId = PREMIUM_BACKGROUND) {
  return resolveBackgroundAccessForUser({
    prismaClient: database,
    userId: "user-1",
    backgroundId,
  })
}

describe("canonical background access", () => {
  it("aligns color customization with canonical selected-background access", async () => {
    const colorAccessMatrix = [
      { name: "free background", fixture: "free", expected: true },
      { name: "subscribed premium background", fixture: "subscription", expected: true },
      { name: "purchased premium background", fixture: "purchase", expected: true },
      { name: "credit-owned premium background", fixture: "credit", expected: true },
      { name: "locked premium background", fixture: "locked", expected: false },
    ]

    for (const entry of colorAccessMatrix) {
      const decision = await resolveBackgroundAccessForUser({
        prismaClient: buildAccessDatabase(entry.fixture),
        userId: "user-1",
        backgroundId: entry.fixture === "free" ? "static-gradient" : "massage-lab-silk",
      })
      assert.equal(decision.canUse, entry.expected, entry.name)
      assert.equal(decision.canCustomizeColors, entry.expected, entry.name)
    }
  })

  it("always enables an enabled free background without inventing permanent ownership", async () => {
    const { database } = createAccessDatabase({
      balance: 2,
      temporaryGrants: [{
        id: "temporary-1",
        featureKey: "premium_backgrounds",
        startsAt: new Date("2026-01-01T00:00:00.000Z"),
        expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      }],
    })

    const decision = await resolve(database, "static-gradient")

    assert.equal(decision.canUse, true)
    assert.equal(decision.canCustomizeColors, true)
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

  it("uses active temporary premium-background access without calling it a subscription", async () => {
    const { database } = createAccessDatabase({
      temporaryGrants: [{
        id: "temporary-1",
        featureKey: "premium_backgrounds",
        startsAt: new Date("2026-01-01T00:00:00.000Z"),
        expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      }],
    })

    const decision = await resolve(database)

    assert.equal(decision.canUse, true)
    assert.equal(decision.canCustomizeColors, true)
    assert.equal(decision.accessSource, "temporary")
    assert.equal(decision.isPermanentlyOwned, false)
    assert.equal(decision.creditEligibility.eligible, true)
    assert.equal(decision.purchaseEligibility.eligible, true)
  })

  it("uses a freshly verified full-admin role without calling it a subscription", async () => {
    const { database } = createAccessDatabase({ admin: true })

    const decision = await resolve(database)

    assert.equal(decision.canUse, true)
    assert.equal(decision.canCustomizeColors, true)
    assert.equal(decision.accessSource, "admin")
    assert.equal(decision.isPermanentlyOwned, false)
  })

  it("keeps membership provenance ahead of simultaneous temporary access", async () => {
    const { database } = createAccessDatabase({
      subscriptions: [{ status: "active", membershipLevel: "SUPPORTER", currentPeriodEnd: null }],
      temporaryGrants: [{
        id: "temporary-1",
        featureKey: "premium_backgrounds",
        startsAt: new Date("2026-01-01T00:00:00.000Z"),
        expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      }],
    })

    assert.equal((await resolve(database)).accessSource, "subscription")
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

  it("keeps permanent ownership authoritative while membership and temporary access are also active", async () => {
    const { database } = createAccessDatabase({
      subscriptions: [{ status: "active", membershipLevel: "SUPPORTER", currentPeriodEnd: null }],
      temporaryGrants: [{
        id: "temporary-1",
        featureKey: "premium_backgrounds",
        startsAt: new Date("2026-01-01T00:00:00.000Z"),
        expiresAt: new Date("2030-01-01T00:00:00.000Z"),
      }],
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
    assert.deepEqual(state.temporaryGrantQuery, {
      where: {
        userId: "user-1",
        featureKey: { in: [...TEMPORARY_ACCESS_FEATURE_KEYS] },
        startsAt: { lte: state.reservationQuery.where.reservationExpiresAt.gt },
        expiresAt: { gt: state.reservationQuery.where.reservationExpiresAt.gt },
        revocation: null,
      },
      select: { id: true, featureKey: true, startsAt: true, expiresAt: true },
      orderBy: [{ expiresAt: "asc" }, { id: "asc" }],
      // The extra sentinel row detects overflow instead of silently truncating authorization input.
      take: TOTAL_ACTIVE_LIMIT + 1,
    })

    const readsBeforeFreshSnapshot = state.reads.length
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
    assert.ok(state.reads.slice(readsBeforeFreshSnapshot).every((read) => read.transaction === 2))
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
