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
})

function createResetDatabase() {
  const state = {
    passwordResetTokens: [
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
    credentials: [],
    authSessionVersions: new Map([["user-expired", 2], ["user-consumed", 4]]),
    sessions: [{ id: "session-expired", userId: "user-expired" }, { id: "session-consumed", userId: "user-consumed" }],
  }
  let transactionAttempts = 0

  return {
    state,
    get transactionAttempts() {
      return transactionAttempts
    },
    async $transaction(callback, options) {
      transactionAttempts += 1
      assert.equal(options?.isolationLevel, "Serializable")

      return callback({
        passwordResetToken: {
          async findUnique({ where, select }) {
            assert.deepEqual(select, { id: true, userId: true, expiresAt: true, consumedAt: true })
            const token = state.passwordResetTokens.find((candidate) => candidate.tokenHash === where.tokenHash)
            return token ? structuredClone(token) : null
          },
        },
      })
    },
  }
}
