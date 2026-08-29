import assert from "node:assert/strict"
import { describe, it } from "node:test"

import {
  confirmPasswordReset,
  isPasswordResetTokenEligible,
} from "../lib/password-reset-confirmation.ts"

const NOW = new Date("2026-08-11T12:00:00.000Z")

describe("isPasswordResetTokenEligible", () => {
  it("rejects invalid inputs before reading reset-token state", async () => {
    const prismaClient = createEligibilityClient()

    await assert.rejects(
      () => isPasswordResetTokenEligible({ prismaClient, tokenHash: "", now: NOW }),
      /valid reset token hash/,
    )
    await assert.rejects(
      () => isPasswordResetTokenEligible({ prismaClient, tokenHash: "x".repeat(513), now: NOW }),
      /valid reset token hash/,
    )
    await assert.rejects(
      () => isPasswordResetTokenEligible({
        prismaClient,
        tokenHash: "active-token-hash-a",
        now: new Date("invalid"),
      }),
      /valid reset time/,
    )

    assert.equal(prismaClient.queryCount, 0)
  })

  it("returns only eligibility from a minimal hashed-token lookup", async () => {
    const eligibleClient = createEligibilityClient({ eligible: true })
    const ineligibleClient = createEligibilityClient({ eligible: false })

    assert.equal(await isPasswordResetTokenEligible({
      prismaClient: eligibleClient,
      tokenHash: "active-token-hash-a",
      now: NOW,
    }), true)
    assert.equal(await isPasswordResetTokenEligible({
      prismaClient: ineligibleClient,
      tokenHash: "missing-token-hash",
      now: NOW,
    }), false)
    assert.equal(eligibleClient.queryCount, 1)
    assert.equal(ineligibleClient.queryCount, 1)
    assert.deepEqual(eligibleClient.queriedTokenHashes, ["active-token-hash-a"])
    assert.deepEqual(ineligibleClient.queriedTokenHashes, ["missing-token-hash"])
  })
})

describe("confirmPasswordReset", () => {
  it("rejects invalid opaque hashes before opening a transaction", async () => {
    const database = createResetDatabase()

    await assert.rejects(
      () => confirmPasswordReset({ prismaClient: database, tokenHash: "", passwordHash: "hash", clock: () => NOW }),
      /valid reset token hash/,
    )
    await assert.rejects(
      () => confirmPasswordReset({ prismaClient: database, tokenHash: "token", passwordHash: "", clock: () => NOW }),
      /valid password hash/,
    )
    await assert.rejects(
      () => confirmPasswordReset({ prismaClient: database, tokenHash: "x".repeat(513), passwordHash: "hash", clock: () => NOW }),
      /valid reset token hash/,
    )
    await assert.rejects(
      () => confirmPasswordReset({ prismaClient: database, tokenHash: "token", passwordHash: "x".repeat(513), clock: () => NOW }),
      /valid password hash/,
    )

    assert.equal(database.transactionAttempts, 0)
  })

  it("rejects an invalid authoritative reset time before reading token state", async () => {
    const database = createResetDatabase()

    await assert.rejects(
      () => confirmPasswordReset({
        prismaClient: database,
        tokenHash: "token",
        passwordHash: "hash",
        clock: () => new Date("invalid"),
      }),
      /valid reset time/,
    )

    assert.equal(database.transactionAttempts, 1)
    assert.equal(database.tokenReadCount, 0)
  })

  it("rejects non-Date clock values before reading token state", async () => {
    const nonDateValues = [
      NOW.toISOString(),
      NOW.getTime(),
      null,
      { toString: () => NOW.toISOString() },
    ]

    for (const value of nonDateValues) {
      const database = createResetDatabase()

      await assert.rejects(
        () => confirmPasswordReset({
          prismaClient: database,
          tokenHash: "active-token-hash-a",
          passwordHash: "hash",
          clock: () => value,
        }),
        /valid reset time/,
      )

      assert.equal(database.transactionAttempts, 1)
      assert.equal(database.tokenReadCount, 0)
    }
  })

  for (const [name, tokenHash] of [
    ["missing", "missing-token-hash"],
    ["expired", "expired-token-hash"],
    ["already consumed", "consumed-token-hash"],
  ]) {
    it(`returns INVALID without mutations for a ${name} token`, async () => {
      const database = createResetDatabase()
      const before = structuredClone(database.state)

      assert.deepEqual(await confirmPasswordReset({
        prismaClient: database,
        tokenHash,
        passwordHash: "new-password-hash",
        clock: () => NOW,
      }), { status: "INVALID" })

      assert.deepEqual(database.state, before)
      assert.equal(database.transactionAttempts, 1)
    })
  }

  it("commits the complete successful password-reset bundle", async () => {
    const database = createResetDatabase()

    const result = await confirmPasswordReset({
      prismaClient: database,
      tokenHash: "active-token-hash-a",
      passwordHash: "new-password-hash",
      clock: () => NOW,
    })

    const state = database.state
    assert.deepEqual(result, { status: "UPDATED", emailIntentId: "intent-1" })
    assert.equal(Object.hasOwn(result, "sessionCount"), false)
    assert.equal(Object.hasOwn(result, "deletedSessionCount"), false)
    assert.equal(state.passwordCredential.passwordHash, "new-password-hash")
    assert.equal(state.passwordResetTokens.filter((token) => token.userId === state.user.id)
      .every((token) => token.consumedAt?.getTime() === NOW.getTime()), true)
    assert.equal(state.user.authSessionVersion, 5)
    assert.equal(state.sessions.length, 0)
    assert.equal(state.adminActions.length, 0)
    assert.equal(state.activities.length, 0)
    assert.equal(state.emailIntents.length, 1)
    assert.deepEqual(state.emailIntents[0], {
      id: "intent-1",
      userId: state.user.id,
      kind: "PASSWORD_RECOVERED",
      recipientEmail: "person@example.com",
      subject: "Password sign-in added or replaced for your MassageLab account",
      message: "Password sign-in was added or replaced for your MassageLab account. This can add email and password to an existing account, or replace an existing password. Existing sign-in methods remain connected. If you made this change, no action is needed. If you did not, contact support. You may receive this notice more than once if delivery had to be retried.",
      idempotencyKey: "password-recovered:reset-active-a",
    })
    assert.deepEqual(state.accounts, [{
      id: "google-account-1",
      userId: "user-1",
      provider: "google",
      providerAccountId: "google-subject-1",
    }])
  })

  it("adds password sign-in to a Google-first account without changing its Google Account row", async () => {
    const database = createResetDatabase({ googleFirst: true })
    const originalAccounts = structuredClone(database.state.accounts)

    assert.deepEqual(await confirmPasswordReset({
      prismaClient: database,
      tokenHash: "active-token-hash-a",
      passwordHash: "new-google-first-password-hash",
      clock: () => NOW,
    }), { status: "UPDATED", emailIntentId: "intent-1" })

    assert.deepEqual(database.state.passwordCredential, {
      id: "credential-created",
      userId: "user-1",
      passwordHash: "new-google-first-password-hash",
    })
    assert.deepEqual(database.state.accounts, originalAccounts)
  })

  it("rolls back every mutation when final Session deletion fails", async () => {
    const database = createResetDatabase({ failSessionDelete: true })
    const before = structuredClone(database.state)

    await assert.rejects(
      () => confirmPasswordReset({
        prismaClient: database,
        tokenHash: "active-token-hash-a",
        passwordHash: "new-password-hash",
        clock: () => NOW,
      }),
      /session deletion failed/,
    )

    assert.equal(database.state.passwordCredential.passwordHash, before.passwordCredential.passwordHash)
    assert.deepEqual(database.state.passwordResetTokens, before.passwordResetTokens)
    assert.equal(database.state.user.authSessionVersion, before.user.authSessionVersion)
    assert.deepEqual(database.state.sessions, before.sessions)
  })

  it("allows exactly one same-token concurrent reset to win", async () => {
    const database = createResetDatabase({ claimGate: createClaimGate(2) })
    const contenders = [
      { name: "B", tokenHash: "active-token-hash-a", passwordHash: "same-token-password-b" },
      { name: "A", tokenHash: "active-token-hash-a", passwordHash: "same-token-password-a" },
    ]
    const resultsByContender = await Promise.all(contenders.map(async (contender) => ({
      contender,
      result: await confirmPasswordReset({
        prismaClient: database,
        tokenHash: contender.tokenHash,
        passwordHash: contender.passwordHash,
        clock: () => NOW,
      }),
    })))
    const updatedResults = resultsByContender.filter(({ result }) => result.status === "UPDATED")

    assert.deepEqual(resultsByContender.map(({ result }) => result.status).sort(), ["INVALID", "UPDATED"])
    assert.equal(updatedResults.length, 1)
    assert.equal(database.state.passwordCredential.passwordHash, updatedResults[0].contender.passwordHash)
    assert.equal(database.state.user.authSessionVersion, 5)
    assert.equal(database.state.passwordResetTokens
      .filter((token) => token.userId === database.state.user.id)
      .every((token) => token.consumedAt), true)
  })

  it("allows exactly one different-token concurrent reset to win", async () => {
    const database = createResetDatabase({ claimGate: createClaimGate(2) })
    const contenders = [
      { name: "B", tokenHash: "active-token-hash-b", passwordHash: "different-token-password-b" },
      { name: "A", tokenHash: "active-token-hash-a", passwordHash: "different-token-password-a" },
    ]
    const resultsByContender = await Promise.all(contenders.map(async (contender) => ({
      contender,
      result: await confirmPasswordReset({
        prismaClient: database,
        tokenHash: contender.tokenHash,
        passwordHash: contender.passwordHash,
        clock: () => NOW,
      }),
    })))
    const updatedResults = resultsByContender.filter(({ result }) => result.status === "UPDATED")

    assert.deepEqual(resultsByContender.map(({ result }) => result.status).sort(), ["INVALID", "UPDATED"])
    assert.equal(updatedResults.length, 1)
    assert.equal(database.state.passwordCredential.passwordHash, updatedResults[0].contender.passwordHash)
    assert.deepEqual(database.contentionRetryCodes, ["40P01"])
    assert.equal(database.transactionAttempts, 3)
    assert.equal(database.state.user.authSessionVersion, 5)
    assert.equal(database.state.passwordResetTokens
      .filter((token) => token.userId === database.state.user.id)
      .every((token) => token.consumedAt), true)
  })

  it("retries one serialization conflict without duplicating committed effects", async () => {
    const database = createResetDatabase({ serializationConflicts: 1 })

    assert.deepEqual(await confirmPasswordReset({
      prismaClient: database,
      tokenHash: "active-token-hash-a",
      passwordHash: "retried-password-hash",
      clock: () => NOW,
    }), { status: "UPDATED", emailIntentId: "intent-1" })

    assert.equal(database.transactionAttempts, 2)
    assert.equal(database.state.passwordCredential.passwordHash, "retried-password-hash")
    assert.equal(database.state.user.authSessionVersion, 5)
    assert.equal(database.state.passwordResetTokens
      .filter((token) => token.userId === database.state.user.id)
      .every((token) => token.consumedAt), true)
  })

  it("captures a fresh authoritative time for every transaction retry", async () => {
    const database = createResetDatabase({ serializationConflicts: 1 })
    const authoritativeTimes = [
      NOW,
      new Date("2026-08-11T12:00:00.002Z"),
    ]

    assert.deepEqual(await confirmPasswordReset({
      prismaClient: database,
      tokenHash: "active-token-hash-a",
      passwordHash: "must-not-be-committed",
      clock: () => authoritativeTimes.shift(),
    }), { status: "INVALID" })

    assert.equal(database.transactionAttempts, 2)
    assert.equal(authoritativeTimes.length, 0)
    assert.equal(database.state.passwordCredential.passwordHash, "old-password-hash")
    assert.equal(database.state.passwordResetTokens
      .filter((token) => token.userId === database.state.user.id)
      .every((token) => token.consumedAt === null), true)
    assert.equal(database.state.user.authSessionVersion, 4)
    assert.equal(database.state.sessions.length, 2)
  })
})

function createEligibilityClient({ eligible = false } = {}) {
  let queryCount = 0
  const queriedTokenHashes = []

  return {
    get queryCount() {
      return queryCount
    },
    get queriedTokenHashes() {
      return [...queriedTokenHashes]
    },
    passwordResetToken: {
      async findFirst(query) {
        queryCount += 1
        queriedTokenHashes.push(query.where.tokenHash)
        assert.equal(query.where.consumedAt, null)
        assert.equal(query.where.expiresAt.gt.getTime(), NOW.getTime())
        assert.deepEqual(query.select, { id: true })
        return eligible ? { id: "eligible-reset-token" } : null
      },
    },
  }
}

function createResetDatabase({
  claimGate = null,
  failSessionDelete = false,
  serializationConflicts = 0,
  googleFirst = false,
} = {}) {
  let state = {
    user: { id: "user-1", email: "person@example.com", authSessionVersion: 4 },
    accounts: [{ id: "google-account-1", userId: "user-1", provider: "google", providerAccountId: "google-subject-1" }],
    passwordCredential: googleFirst ? null : { id: "credential-1", userId: "user-1", passwordHash: "old-password-hash" },
    passwordResetTokens: [
      {
        id: "reset-active-a",
        userId: "user-1",
        tokenHash: "active-token-hash-a",
        expiresAt: new Date("2026-08-11T12:00:00.001Z"),
        consumedAt: null,
      },
      {
        id: "reset-active-b",
        userId: "user-1",
        tokenHash: "active-token-hash-b",
        expiresAt: new Date("2026-08-11T12:00:00.001Z"),
        consumedAt: null,
      },
      {
        id: "reset-expired",
        userId: "user-expired",
        tokenHash: "expired-token-hash",
        expiresAt: new Date("2026-08-11T11:59:59.999Z"),
        consumedAt: null,
      },
      {
        id: "reset-consumed",
        userId: "user-consumed",
        tokenHash: "consumed-token-hash",
        expiresAt: new Date("2026-08-11T12:00:00.001Z"),
        consumedAt: new Date("2026-08-11T11:00:00.000Z"),
      },
    ],
    sessions: [
      { id: "session-1", userId: "user-1" },
      { id: "session-2", userId: "user-1" },
    ],
    adminActions: [],
    activities: [],
    emailIntents: [],
  }
  let revision = 0
  let transactionAttempts = 0
  let remainingSerializationConflicts = serializationConflicts
  let nextTransactionId = 1
  let tokenReadCount = 0
  const claimedTokenIds = new Map()
  const contentionRetryCodes = []

  return {
    get state() {
      return state
    },
    get transactionAttempts() {
      return transactionAttempts
    },
    get contentionRetryCodes() {
      return [...contentionRetryCodes]
    },
    get tokenReadCount() {
      return tokenReadCount
    },
    async $transaction(callback, options) {
      transactionAttempts += 1
      assert.equal(options?.isolationLevel, "Serializable")

      const transactionId = nextTransactionId
      nextTransactionId += 1
      const startRevision = revision
      const snapshot = structuredClone(state)
      let dirty = false
      const ownedClaims = new Set()

      const tx = {
        passwordResetToken: {
          async findUnique({ where, select }) {
            tokenReadCount += 1
            assert.deepEqual(select, { id: true, userId: true })
            const token = snapshot.passwordResetTokens.find((candidate) => candidate.tokenHash === where.tokenHash)
            return token ? { id: token.id, userId: token.userId } : null
          },
          async updateMany({ where, data }) {
            if (where.id) {
              assert.equal(where.consumedAt, null)
              assert.equal(where.expiresAt.gt instanceof Date, true)
              await claimGate?.wait()

              const committedToken = state.passwordResetTokens.find((candidate) => candidate.id === where.id)
              if (!committedToken
                || committedToken.userId !== where.userId
                || committedToken.consumedAt
                || committedToken.expiresAt.getTime() <= where.expiresAt.gt.getTime()
                || claimedTokenIds.has(where.id)) {
                return { count: 0 }
              }

              claimedTokenIds.set(where.id, transactionId)
              ownedClaims.add(where.id)
              const token = snapshot.passwordResetTokens.find((candidate) => candidate.id === where.id)
              if (!token || token.userId !== where.userId || token.consumedAt || token.expiresAt.getTime() <= where.expiresAt.gt.getTime()) {
                return { count: 0 }
              }
              token.consumedAt = structuredClone(data.consumedAt)
              dirty = true
              return { count: 1 }
            }

            assert.equal(where.consumedAt, null)
            let count = 0
            for (const token of snapshot.passwordResetTokens) {
              if (token.userId === where.userId && !token.consumedAt) {
                token.consumedAt = structuredClone(data.consumedAt)
                count += 1
              }
            }
            dirty ||= count > 0
            return { count }
          },
        },
        passwordCredential: {
          async upsert({ where, create, update }) {
            assert.equal(where.userId, snapshot.user.id)
            assert.deepEqual(create, { userId: snapshot.user.id, passwordHash: create.passwordHash })
            assert.deepEqual(update, { passwordHash: update.passwordHash })
            snapshot.passwordCredential = snapshot.passwordCredential?.userId === where.userId
              ? { ...snapshot.passwordCredential, passwordHash: update.passwordHash }
              : { id: "credential-created", ...create }
            dirty = true
            return structuredClone(snapshot.passwordCredential)
          },
        },
        user: {
          async update({ where, data }) {
            assert.equal(where.id, snapshot.user.id)
            assert.deepEqual(data, { authSessionVersion: { increment: 1 } })
            snapshot.user.authSessionVersion += 1
            dirty = true
            return structuredClone(snapshot.user)
          },
        },
        accountSecurityEmailIntent: {
          async upsert({ where, create, update, select }) {
            assert.deepEqual(where, { idempotencyKey: create.idempotencyKey })
            assert.deepEqual(update, {})
            assert.deepEqual(select, { id: true })
            const existing = snapshot.emailIntents.find((intent) => intent.idempotencyKey === create.idempotencyKey)
            if (existing) return { id: existing.id }
            const intent = { id: `intent-${snapshot.emailIntents.length + 1}`, ...create }
            snapshot.emailIntents.push(intent)
            dirty = true
            return { id: intent.id }
          },
        },
        session: {
          async deleteMany({ where }) {
            assert.equal(where.userId, snapshot.user.id)
            if (failSessionDelete) throw new Error("session deletion failed")
            const before = snapshot.sessions.length
            snapshot.sessions = snapshot.sessions.filter((session) => session.userId !== where.userId)
            dirty ||= snapshot.sessions.length !== before
            return { count: before - snapshot.sessions.length }
          },
        },
      }

      try {
        const result = await callback(tx)
        if (dirty) {
          if (remainingSerializationConflicts > 0) {
            remainingSerializationConflicts -= 1
            throw Object.assign(new Error("serialization conflict"), { code: "P2034" })
          }
          if (revision !== startRevision) {
            contentionRetryCodes.push("40P01")
            throw createAdapterTransactionError("40P01")
          }
          state = structuredClone(snapshot)
          revision += 1
        }
        return result
      } finally {
        for (const tokenId of ownedClaims) {
          if (claimedTokenIds.get(tokenId) === transactionId) claimedTokenIds.delete(tokenId)
        }
      }
    },
  }
}

function createAdapterTransactionError(originalCode) {
  return Object.assign(new Error("adapter transaction conflict"), {
    code: "P2039",
    meta: {
      driverAdapterError: {
        cause: { originalCode },
      },
    },
  })
}

function createClaimGate(expectedArrivals) {
  let arrivals = 0
  let release
  const ready = new Promise((resolve) => {
    release = resolve
  })

  return {
    async wait() {
      arrivals += 1
      if (arrivals === expectedArrivals) release()
      await ready
    },
  }
}
