import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { redeemBackgroundCredit } from "../lib/commerce/background-access.ts"
import { COMMERCE_ERROR_CODES, CommerceError } from "../lib/commerce/errors.ts"

const BACKGROUND_A = "massage-lab-aurora"
const BACKGROUND_B = "massage-lab-photon-beam"

function uniqueConflict(modelName, target) {
  return Object.assign(new Error("unique constraint failed"), {
    code: "P2002",
    meta: { modelName, target },
  })
}

function createRedemptionDatabase({
  emailVerified = true,
  balance = 2,
  subscriptions = [],
  reservation = null,
  ownerships = [],
  entries = [],
  entryCreateConflict = null,
} = {}) {
  const state = {
    emailVerified,
    subscriptions,
    reservation,
    wallet: { id: "wallet-1", userId: "user-1", balance, version: 0 },
    ownerships: new Map(ownerships.map((ownership) => [
      `${ownership.userId}:${ownership.backgroundKey}`,
      { ...ownership },
    ])),
    entries: new Map(entries.map((entry) => [entry.idempotencyKey, { ...entry }])),
    events: [],
    transactionCalls: 0,
    updateAttempts: 0,
    nextEntryId: entries.length + 1,
    nextOwnershipId: ownerships.length + 1,
    entryCreateConflict,
  }

  function ownershipKey(userId, backgroundKey) {
    return `${userId}:${backgroundKey}`
  }

  const tx = {
    user: {
      async findUnique({ where }) {
        return where.id === "user-1"
          ? { emailVerified: state.emailVerified ? new Date("2026-07-01T00:00:00.000Z") : null }
          : null
      },
    },
    membershipSubscription: {
      async findMany() {
        return state.subscriptions
      },
    },
    backgroundOwnership: {
      async findUnique({ where }) {
        const key = where.userId_backgroundKey
        return state.ownerships.get(ownershipKey(key.userId, key.backgroundKey)) ?? null
      },
      async create({ data }) {
        const key = ownershipKey(data.userId, data.backgroundKey)
        if (state.ownerships.has(key)) {
          throw uniqueConflict("BackgroundOwnership", ["userId", "backgroundKey"])
        }
        const ownership = { id: `ownership-${state.nextOwnershipId++}`, ...data }
        state.ownerships.set(key, ownership)
        return ownership
      },
    },
    backgroundCreditWallet: {
      async findUnique({ where }) {
        if (where.userId && where.userId !== state.wallet.userId) return null
        if (where.id && where.id !== state.wallet.id) return null
        return { ...state.wallet }
      },
      async updateMany({ where, data }) {
        state.updateAttempts += 1
        const minimumBalance = where.balance?.gte ?? 0
        if (
          where.id !== state.wallet.id
          || where.userId !== state.wallet.userId
          || state.wallet.balance < minimumBalance
        ) {
          return { count: 0 }
        }
        state.wallet.balance -= data.balance.decrement
        state.wallet.version += data.version.increment
        return { count: 1 }
      },
    },
    backgroundCreditEntry: {
      async findUnique({ where }) {
        return state.entries.get(where.idempotencyKey) ?? null
      },
      async create({ data }) {
        if (state.entryCreateConflict) {
          const conflict = state.entryCreateConflict
          state.entryCreateConflict = null
          if (conflict.committedEntry) {
            state.entries.set(conflict.committedEntry.idempotencyKey, conflict.committedEntry)
            if (conflict.committedOwnership) {
              state.ownerships.set(
                ownershipKey(conflict.committedOwnership.userId, conflict.committedOwnership.backgroundKey),
                conflict.committedOwnership,
              )
            }
          }
          throw conflict.error
        }
        if (state.entries.has(data.idempotencyKey)) {
          throw uniqueConflict("BackgroundCreditEntry", ["idempotencyKey"])
        }
        const entry = { id: `entry-${state.nextEntryId++}`, ...data }
        state.entries.set(data.idempotencyKey, entry)
        return entry
      },
    },
    commerceOrder: {
      async findFirst() {
        return state.reservation
      },
    },
    commerceEvent: {
      async create({ data }) {
        state.events.push(data)
        return { id: `event-${state.events.length}`, ...data }
      },
    },
  }

  const database = {
    ...tx,
    async $transaction(callback, options) {
      state.transactionCalls += 1
      assert.equal(options?.isolationLevel, "Serializable")
      // Deliberately do not serialize callbacks: concurrent tests must be won by
      // the wallet balance predicate rather than an unrealistic mock mutex.
      await Promise.resolve()
      return callback(tx)
    },
  }

  return { database, state }
}

async function redeem(database, overrides = {}) {
  return redeemBackgroundCredit({
    prismaClient: database,
    userId: "user-1",
    backgroundId: BACKGROUND_A,
    confirmationAccepted: true,
    idempotencyKey: "redeem-request-1",
    ...overrides,
  })
}

async function rejectsWithCode(operation, code) {
  await assert.rejects(operation, (error) => {
    assert.ok(error instanceof CommerceError)
    assert.equal(error.code, code)
    return true
  })
}

describe("background credit redemption", () => {
  it("requires literal permanent and non-swappable confirmation", async () => {
    const { database, state } = createRedemptionDatabase()

    await rejectsWithCode(
      () => redeem(database, { confirmationAccepted: false }),
      COMMERCE_ERROR_CODES.LEGAL_CONSENT_REQUIRED,
    )

    assert.equal(state.wallet.balance, 2)
    assert.equal(state.ownerships.size, 0)
  })

  it("atomically spends one credit and creates one active ownership sourced from its ledger entry", async () => {
    const { database, state } = createRedemptionDatabase({ balance: 2 })

    const result = await redeem(database)

    assert.deepEqual(result, { backgroundId: BACKGROUND_A, remainingCredits: 1 })
    assert.equal(state.wallet.balance, 1)
    assert.equal(state.wallet.version, 1)
    assert.equal(state.entries.size, 1)
    const entry = state.entries.get("redeem-request-1")
    assert.equal(entry.type, "REDEMPTION")
    assert.equal(entry.delta, -1)
    assert.equal(entry.balanceAfter, 1)
    assert.equal(entry.redemptionBackgroundKey, BACKGROUND_A)
    const ownership = state.ownerships.get(`user-1:${BACKGROUND_A}`)
    assert.equal(ownership.status, "ACTIVE")
    assert.equal(ownership.source, "CREDIT_REDEMPTION")
    assert.equal(ownership.sourceCreditEntryId, entry.id)
    assert.equal(ownership.sourceOrderItemId, undefined)
    assert.equal(state.events.length, 1)
  })

  it("does not swap a prior redemption when the idempotency key is reused for another background", async () => {
    const { database, state } = createRedemptionDatabase({ balance: 2 })
    await redeem(database)

    await rejectsWithCode(
      () => redeem(database, { backgroundId: BACKGROUND_B }),
      COMMERCE_ERROR_CODES.STALE_CONCURRENCY,
    )

    assert.equal(state.wallet.balance, 1)
    assert.equal(state.ownerships.get(`user-1:${BACKGROUND_A}`).status, "ACTIVE")
    assert.equal(state.ownerships.has(`user-1:${BACKGROUND_B}`), false)
  })

  it("returns the committed result for an exact repeated request without spending again", async () => {
    const { database, state } = createRedemptionDatabase({ balance: 2 })

    const first = await redeem(database)
    const repeated = await redeem(database)

    assert.deepEqual(repeated, first)
    assert.equal(state.wallet.balance, 1)
    assert.equal(state.entries.size, 1)
    assert.equal(state.ownerships.size, 1)
    assert.equal(state.events.length, 1)
  })

  it("rejects a verified user with no remaining credit", async () => {
    const { database, state } = createRedemptionDatabase({ balance: 0 })

    await rejectsWithCode(
      () => redeem(database),
      COMMERCE_ERROR_CODES.NO_CREDITS_REMAINING,
    )

    assert.equal(state.ownerships.size, 0)
  })

  it("rejects any existing ownership instead of replacing its historical row", async () => {
    const { database, state } = createRedemptionDatabase({
      ownerships: [{
        id: "ownership-existing",
        userId: "user-1",
        backgroundKey: BACKGROUND_A,
        status: "ACTIVE",
        source: "PURCHASE",
      }],
    })

    await rejectsWithCode(
      () => redeem(database),
      COMMERCE_ERROR_CODES.ALREADY_OWNED,
    )

    assert.equal(state.wallet.balance, 2)
    assert.equal(state.ownerships.get(`user-1:${BACKGROUND_A}`).source, "PURCHASE")
  })

  it("rejects free, disabled, and unknown backgrounds before wallet mutation", async () => {
    for (const backgroundId of [
      "static-gradient",
      "massage-lab-noise-texture-draft",
      "unknown-background",
    ]) {
      const { database, state } = createRedemptionDatabase()
      await rejectsWithCode(
        () => redeem(database, { backgroundId }),
        COMMERCE_ERROR_CODES.CATALOG_UNAVAILABLE,
      )
      assert.equal(state.wallet.balance, 2)
    }
  })

  it("rejects a background already reserved for checkout", async () => {
    const { database, state } = createRedemptionDatabase({
      reservation: {
        id: "order-1",
        reservationExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    })

    await rejectsWithCode(
      () => redeem(database),
      COMMERCE_ERROR_CODES.RESERVED_CART,
    )

    assert.equal(state.wallet.balance, 2)
  })

  it("lets only one concurrent last-credit request pass the atomic balance predicate", async () => {
    const { database, state } = createRedemptionDatabase({ balance: 1 })

    const settled = await Promise.allSettled([
      redeem(database, { backgroundId: BACKGROUND_A, idempotencyKey: "concurrent-a" }),
      redeem(database, { backgroundId: BACKGROUND_B, idempotencyKey: "concurrent-b" }),
    ])

    assert.equal(settled.filter((result) => result.status === "fulfilled").length, 1)
    const rejected = settled.find((result) => result.status === "rejected")
    assert.ok(rejected.reason instanceof CommerceError)
    assert.equal(rejected.reason.code, COMMERCE_ERROR_CODES.NO_CREDITS_REMAINING)
    assert.equal(state.wallet.balance, 0)
    assert.equal(state.entries.size, 1)
    assert.equal(state.ownerships.size, 1)
    assert.equal(state.updateAttempts, 2)
  })

  it("converges concurrent retries of the same last-credit request on the committed result", async () => {
    const { database, state } = createRedemptionDatabase({ balance: 1 })

    const [first, repeated] = await Promise.all([
      redeem(database),
      redeem(database),
    ])

    assert.deepEqual(first, { backgroundId: BACKGROUND_A, remainingCredits: 0 })
    assert.deepEqual(repeated, first)
    assert.equal(state.wallet.balance, 0)
    assert.equal(state.entries.size, 1)
    assert.equal(state.ownerships.size, 1)
    assert.equal(state.events.length, 1)
  })

  it("allows subscribers to redeem permanent access while subscribed", async () => {
    const { database, state } = createRedemptionDatabase({
      subscriptions: [{ status: "active", membershipLevel: "SUPPORTER" }],
    })

    const result = await redeem(database)

    assert.equal(result.backgroundId, BACKGROUND_A)
    assert.equal(state.ownerships.get(`user-1:${BACKGROUND_A}`).status, "ACTIVE")
  })

  it("recovers only a matching committed idempotency race", async () => {
    const committedEntry = {
      id: "entry-race",
      walletId: "wallet-1",
      userId: "user-1",
      type: "REDEMPTION",
      delta: -1,
      balanceAfter: 1,
      idempotencyKey: "redeem-request-1",
      redemptionBackgroundKey: BACKGROUND_A,
    }
    const committedOwnership = {
      id: "ownership-race",
      userId: "user-1",
      backgroundKey: BACKGROUND_A,
      source: "CREDIT_REDEMPTION",
      status: "ACTIVE",
      sourceCreditEntryId: committedEntry.id,
    }
    const { database } = createRedemptionDatabase({
      balance: 2,
      entryCreateConflict: {
        error: uniqueConflict("BackgroundCreditEntry", ["idempotencyKey"]),
        committedEntry,
        committedOwnership,
      },
    })

    assert.deepEqual(await redeem(database), {
      backgroundId: BACKGROUND_A,
      remainingCredits: 1,
    })
  })

  it("fails unrelated uniqueness conflicts safely", async () => {
    const { database } = createRedemptionDatabase({
      entryCreateConflict: {
        error: uniqueConflict("CommerceEvent", ["aggregateId"]),
      },
    })

    await rejectsWithCode(
      () => redeem(database),
      COMMERCE_ERROR_CODES.UNKNOWN,
    )
  })
})
