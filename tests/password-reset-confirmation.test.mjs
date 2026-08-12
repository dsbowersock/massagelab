import assert from "node:assert/strict"
import { describe, it } from "node:test"

import { confirmPasswordReset } from "../lib/password-reset-confirmation.ts"

const NOW = new Date("2026-08-11T12:00:00.000Z")

describe("confirmPasswordReset", () => {
  it("rejects invalid opaque hashes before opening a transaction", async () => {
    const database = createResetDatabase()

    await assert.rejects(
      () => confirmPasswordReset({ prismaClient: database, tokenHash: "", passwordHash: "hash", now: NOW }),
      /valid reset token hash/,
    )
    await assert.rejects(
      () => confirmPasswordReset({ prismaClient: database, tokenHash: "token", passwordHash: "", now: NOW }),
      /valid password hash/,
    )
    await assert.rejects(
      () => confirmPasswordReset({ prismaClient: database, tokenHash: "x".repeat(513), passwordHash: "hash", now: NOW }),
      /valid reset token hash/,
    )
    await assert.rejects(
      () => confirmPasswordReset({ prismaClient: database, tokenHash: "token", passwordHash: "x".repeat(513), now: NOW }),
      /valid password hash/,
    )

    assert.equal(database.transactionAttempts, 0)
  })

  it("rejects an invalid reset time before opening a transaction", async () => {
    const database = createResetDatabase()

    await assert.rejects(
      () => confirmPasswordReset({ prismaClient: database, tokenHash: "token", passwordHash: "hash", now: new Date("invalid") }),
      /valid reset time/,
    )

    assert.equal(database.transactionAttempts, 0)
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
        now: NOW,
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
      now: NOW,
    })

    const state = database.state
    assert.deepEqual(result, { status: "UPDATED" })
    assert.equal(Object.hasOwn(result, "sessionCount"), false)
    assert.equal(Object.hasOwn(result, "deletedSessionCount"), false)
    assert.equal(state.passwordCredential.passwordHash, "new-password-hash")
    assert.equal(state.passwordResetTokens.filter((token) => token.userId === state.user.id)
      .every((token) => token.consumedAt?.getTime() === NOW.getTime()), true)
    assert.equal(state.user.authSessionVersion, 5)
    assert.equal(state.sessions.length, 0)
    assert.equal(state.adminActions.length, 0)
    assert.equal(state.activities.length, 0)
    assert.equal(state.emailIntents.length, 0)
  })

  it("rolls back every mutation when final Session deletion fails", async () => {
    const database = createResetDatabase({ failSessionDelete: true })
    const before = structuredClone(database.state)

    await assert.rejects(
      () => confirmPasswordReset({
        prismaClient: database,
        tokenHash: "active-token-hash-a",
        passwordHash: "new-password-hash",
        now: NOW,
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
    const results = await Promise.all([
      confirmPasswordReset({
        prismaClient: database,
        tokenHash: "active-token-hash-a",
        passwordHash: "same-token-password-a",
        now: NOW,
      }),
      confirmPasswordReset({
        prismaClient: database,
        tokenHash: "active-token-hash-a",
        passwordHash: "same-token-password-b",
        now: NOW,
      }),
    ])

    assert.deepEqual(results.map((result) => result.status).sort(), ["INVALID", "UPDATED"])
    assert.equal(database.state.passwordCredential.passwordHash, "same-token-password-a")
    assert.equal(database.state.user.authSessionVersion, 5)
    assert.equal(database.state.passwordResetTokens
      .filter((token) => token.userId === database.state.user.id)
      .every((token) => token.consumedAt), true)
  })

  it("allows exactly one different-token concurrent reset to win", async () => {
    const database = createResetDatabase({ claimGate: createClaimGate(2) })
    const results = await Promise.all([
      confirmPasswordReset({
        prismaClient: database,
        tokenHash: "active-token-hash-a",
        passwordHash: "different-token-password-a",
        now: NOW,
      }),
      confirmPasswordReset({
        prismaClient: database,
        tokenHash: "active-token-hash-b",
        passwordHash: "different-token-password-b",
        now: NOW,
      }),
    ])

    assert.deepEqual(results.map((result) => result.status).sort(), ["INVALID", "UPDATED"])
    assert.equal(database.state.passwordCredential.passwordHash, "different-token-password-a")
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
      now: NOW,
    }), { status: "UPDATED" })

    assert.equal(database.transactionAttempts, 2)
    assert.equal(database.state.passwordCredential.passwordHash, "retried-password-hash")
    assert.equal(database.state.user.authSessionVersion, 5)
    assert.equal(database.state.passwordResetTokens
      .filter((token) => token.userId === database.state.user.id)
      .every((token) => token.consumedAt), true)
  })
})

function createResetDatabase({
  claimGate = null,
  failSessionDelete = false,
  serializationConflicts = 0,
} = {}) {
  let state = {
    user: { id: "user-1", authSessionVersion: 4 },
    passwordCredential: { id: "credential-1", userId: "user-1", passwordHash: "old-password-hash" },
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
  const claimedTokenIds = new Map()

  return {
    get state() {
      return state
    },
    get transactionAttempts() {
      return transactionAttempts
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
            assert.deepEqual(select, { id: true, userId: true })
            const token = snapshot.passwordResetTokens.find((candidate) => candidate.tokenHash === where.tokenHash)
            return token ? { id: token.id, userId: token.userId } : null
          },
          async updateMany({ where, data }) {
            if (where.id) {
              assert.equal(where.consumedAt, null)
              assert.equal(where.expiresAt.gt.getTime(), NOW.getTime())
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
            throw Object.assign(new Error("serialization conflict"), { code: "P2034" })
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
