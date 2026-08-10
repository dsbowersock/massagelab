import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { hashToken } from "../lib/auth-security.js"
import {
  resetUserTwoFactor,
  revokeUserSessions,
  sendAdminPasswordReset,
} from "../lib/admin/security-service.ts"

const ACTOR_ID = "admin-1"
const TARGET_ID = "user-1"
const NOW = new Date("2026-08-09T16:00:00.000Z")

function baseInput(database, overrides = {}) {
  return {
    prismaClient: database,
    actorUserId: ACTOR_ID,
    targetUserId: TARGET_ID,
    reasonCode: "SECURITY_RECOVERY",
    internalNote: "Member confirmed the security recovery request.",
    idempotencyKey: "security-operation-1",
    ...overrides,
  }
}

describe("Admin security remediation service", () => {
  it("revokes JWTs canonically, deletes compatibility sessions, and writes safe evidence atomically", async () => {
    const database = createSecurityDatabase({ targetAuthSessionVersion: 4 })
    database.sessions.push(
      { id: "session-1", userId: TARGET_ID, sessionToken: "never-persist-this-session-token", expires: new Date("2026-08-10T00:00:00.000Z") },
      { id: "session-2", userId: TARGET_ID, sessionToken: "nor-this-session-token", expires: new Date("2026-08-11T00:00:00.000Z") },
    )

    const result = await revokeUserSessions(baseInput(database, {
      expectedAuthSessionVersion: 4,
      expectedSessionCount: 2,
      now: NOW,
    }))

    assert.deepEqual(result, {
      revokedSessionCount: 2,
      beforeAuthSessionVersion: 4,
      afterAuthSessionVersion: 5,
      emailIntentId: "intent-1",
      replayed: false,
    })
    assert.equal(database.users.find((user) => user.id === TARGET_ID).authSessionVersion, 5)
    assert.equal(database.sessions.length, 0)
    assert.equal(database.actions.length, 1)
    assert.equal(database.activities.length, 1)
    assert.equal(database.intents.length, 1)
    assert.equal(database.actions[0].beforeState.authSessionVersion, 4)
    assert.equal(database.actions[0].beforeState.adapterSessionCount, 2)
    assert.equal(database.actions[0].afterState.authSessionVersion, 5)
    assert.equal(database.actions[0].afterState.adapterSessionRowsDeleted, 2)
    assert.match(database.activities[0].explanation, /sign-in tokens were invalidated/)
    assert.doesNotMatch(database.activities[0].explanation, /2 sessions|2 users/i)
    assert.deepEqual(database.transactionOptions, [{ isolationLevel: "Serializable" }])
    assertNoSecretDurablePayload(database, result)
  })

  it("requires a freshly verified full Admin for every security mutation", async () => {
    const deniedActors = [
      ["ordinary", user(ACTOR_ID, [verifiedRole("USER", "actor-user")])],
      ["reviewer", user(ACTOR_ID, [verifiedRole("ANATOMY_REVIEWER", "actor-reviewer")])],
      ["editor", user(ACTOR_ID, [verifiedRole("ANATOMY_EDITOR", "actor-editor")])],
      ["pending", user(ACTOR_ID, [{ ...verifiedRole("ADMIN", "actor-admin"), status: "PENDING" }])],
      ["revoked", user(ACTOR_ID, [{ ...verifiedRole("ADMIN", "actor-admin"), status: "REVOKED" }])],
      ["unverified", { ...user(ACTOR_ID, [verifiedRole("ADMIN", "actor-admin")]), emailVerified: null }],
    ]

    for (const [label, actor] of deniedActors) {
      const revokeDatabase = createSecurityDatabase({ actor })
      await assert.rejects(
        () => revokeUserSessions(baseInput(revokeDatabase, { expectedAuthSessionVersion: 0, expectedSessionCount: 0, now: NOW })),
        /requires verified database authority/,
        label,
      )

      const resetDatabase = createSecurityDatabase({ actor })
      await assert.rejects(
        () => sendAdminPasswordReset(baseInput(resetDatabase, { sendEmail: noMail })),
        /requires verified database authority/,
        label,
      )

      const twoFactorDatabase = createSecurityDatabase({ actor, twoFactorEnabled: true })
      await assert.rejects(
        () => resetUserTwoFactor(baseInput(twoFactorDatabase, { confirmationEmail: "member@example.test", expectedTwoFactorEnabled: true })),
        /requires verified database authority/,
        label,
      )
      assert.equal(revokeDatabase.actions.length + resetDatabase.actions.length + twoFactorDatabase.actions.length, 0)
    }
  })

  it("blocks self-targeting, missing targets, and stale canonical or compatibility session state", async () => {
    await assert.rejects(
      () => revokeUserSessions(baseInput(createSecurityDatabase(), {
        targetUserId: ACTOR_ID,
        expectedAuthSessionVersion: 0,
        expectedSessionCount: 0,
        now: NOW,
      })),
      /cannot perform security remediation on your own account/,
    )
    await assert.rejects(
      () => revokeUserSessions(baseInput(createSecurityDatabase({ includeTarget: false }), {
        expectedAuthSessionVersion: 0,
        expectedSessionCount: 0,
        now: NOW,
      })),
      /Target account was not found/,
    )
    await assert.rejects(
      () => revokeUserSessions(baseInput(createSecurityDatabase({ targetAuthSessionVersion: 3 }), {
        expectedAuthSessionVersion: 2,
        expectedSessionCount: 0,
        now: NOW,
      })),
      /security state changed.*Refresh/i,
    )

    const compatibilityStale = createSecurityDatabase()
    compatibilityStale.sessions.push({ id: "session-1", userId: TARGET_ID, sessionToken: "opaque", expires: new Date("2026-08-10T00:00:00.000Z") })
    await assert.rejects(
      () => revokeUserSessions(baseInput(compatibilityStale, {
        expectedAuthSessionVersion: 0,
        expectedSessionCount: 0,
        now: NOW,
      })),
      /security state changed.*Refresh/i,
    )
    assert.equal(compatibilityStale.users.find((user) => user.id === TARGET_ID).authSessionVersion, 0)
  })

  it("replays and serializes exact revocation duplicates without incrementing twice", async () => {
    const database = createSecurityDatabase({ targetAuthSessionVersion: 7 })
    database.sessions.push({ id: "session-1", userId: TARGET_ID, sessionToken: "opaque", expires: new Date("2026-08-10T00:00:00.000Z") })
    const input = baseInput(database, {
      expectedAuthSessionVersion: 7,
      expectedSessionCount: 1,
      now: NOW,
    })

    const results = await Promise.all([revokeUserSessions(input), revokeUserSessions(input)])

    assert.deepEqual(results.map((result) => result.replayed).sort(), [false, true])
    assert.deepEqual(results.map((result) => result.afterAuthSessionVersion), [8, 8])
    assert.equal(database.users.find((user) => user.id === TARGET_ID).authSessionVersion, 8)
    assert.equal(database.actions.length, 1)
    assert.equal(database.activities.length, 1)
    assert.equal(database.intents.length, 1)

    database.sessions.push({ id: "new-session", userId: TARGET_ID, sessionToken: "new-opaque", expires: new Date("2026-08-11T00:00:00.000Z") })
    const replay = await revokeUserSessions(input)
    assert.equal(replay.replayed, true)
    assert.equal(database.sessions.length, 1)
    assert.equal(database.users.find((user) => user.id === TARGET_ID).authSessionVersion, 8)
  })

  it("rejects replay when persisted revocation evidence claims fewer deletions than the expected active adapter rows", async () => {
    const database = createSecurityDatabase({ targetAuthSessionVersion: 2 })
    database.sessions.push({ id: "session-1", userId: TARGET_ID, sessionToken: "opaque", expires: new Date("2026-08-10T00:00:00.000Z") })
    const input = baseInput(database, {
      idempotencyKey: "revocation-tamper-1",
      expectedAuthSessionVersion: 2,
      expectedSessionCount: 1,
      now: NOW,
    })
    await revokeUserSessions(input)
    database.actions[0].afterState.adapterSessionRowsDeleted = 0

    await assert.rejects(() => revokeUserSessions(input), /operation key is already in use/)
    assert.equal(database.users.find((user) => user.id === TARGET_ID).authSessionVersion, 3)
    assert.equal(database.actions.length, 1)
  })

  it("fails closed when a security-operation key is reused with different immutable input", async () => {
    const database = createSecurityDatabase()
    const input = baseInput(database, { expectedAuthSessionVersion: 0, expectedSessionCount: 0, now: NOW })
    await revokeUserSessions(input)

    await assert.rejects(
      () => revokeUserSessions({ ...input, reasonCode: "LOGIN_SUPPORT" }),
      /operation key is already in use/,
    )
    await assert.rejects(
      () => revokeUserSessions({ ...input, expectedSessionCount: 1 }),
      /operation key is already in use/,
    )
    await assert.rejects(
      () => resetUserTwoFactor(baseInput(database, {
        confirmationEmail: "member@example.test",
        expectedTwoFactorEnabled: true,
      })),
      /operation key is already in use/,
    )
  })

  it("rolls back JWT invalidation, compatibility deletion, and partial evidence together", async () => {
    const database = createSecurityDatabase({ targetAuthSessionVersion: 2 })
    database.sessions.push({ id: "session-1", userId: TARGET_ID, sessionToken: "opaque", expires: new Date("2026-08-10T00:00:00.000Z") })
    database.failIntentCreate = true

    await assert.rejects(
      () => revokeUserSessions(baseInput(database, {
        expectedAuthSessionVersion: 2,
        expectedSessionCount: 1,
        now: NOW,
      })),
      /intent create failed/,
    )

    assert.equal(database.users.find((user) => user.id === TARGET_ID).authSessionVersion, 2)
    assert.equal(database.sessions.length, 1)
    assert.equal(database.actions.length, 0)
    assert.equal(database.activities.length, 0)
    assert.equal(database.intents.length, 0)
  })

  it("stores only a password-reset hash with an exact 60-minute expiry and delivers through the injected standard sender", async () => {
    const database = createSecurityDatabase()
    const sent = []
    const rawToken = "raw-admin-reset-token-never-persist"

    const result = await sendAdminPasswordReset(baseInput(database, {
      idempotencyKey: "password-reset-1",
      now: NOW,
      generateToken: () => rawToken,
      sendEmail: async (email, token) => {
        sent.push({ email, token })
        return { delivered: true, devLink: `https://example.test/reset-password?token=${token}` }
      },
    }))

    assert.deepEqual(result, {
      emailIntentId: "intent-1",
      replayed: false,
      deliveryStatus: "DELIVERED",
      deliveryAttempted: true,
    })
    assert.deepEqual(sent, [{ email: "member@example.test", token: rawToken }])
    assert.equal(database.resetTokens.length, 1)
    assert.equal(database.resetTokens[0].tokenHash, hashToken(rawToken))
    assert.notEqual(database.resetTokens[0].tokenHash, rawToken)
    assert.equal(database.resetTokens[0].expiresAt.toISOString(), "2026-08-09T17:00:00.000Z")
    assert.equal(database.intents[0].kind, "PASSWORD_RESET")
    assert.equal(database.intents[0].status, "DELIVERED")
    assert.equal(database.intents[0].attemptCount, 1)
    assert.equal(database.intents[0].deliveredAt.toISOString(), NOW.toISOString())
    assert.equal(database.transactionOptions[0].isolationLevel, "Serializable")
    assertNoSecretDurablePayload(database, result, [rawToken, `reset-password?token=${rawToken}`])
  })

  it("records generic password-reset delivery failure without leaking provider details", async () => {
    const database = createSecurityDatabase()
    const providerSecret = "provider-message-with-user-and-token"
    const logged = []
    const originalConsoleError = console.error
    console.error = (...values) => logged.push(values.join(" "))
    try {
      const result = await sendAdminPasswordReset(baseInput(database, {
        idempotencyKey: "password-reset-failure-1",
        now: NOW,
        generateToken: () => "failed-raw-token",
        sendEmail: async () => { throw new Error(providerSecret) },
      }))

      assert.deepEqual(result, {
        emailIntentId: "intent-1",
        replayed: false,
        deliveryStatus: "FAILED",
        deliveryAttempted: true,
      })
      assert.equal(database.intents[0].status, "FAILED")
      assert.equal(database.intents[0].failureCode, "DELIVERY_FAILED")
      assert.deepEqual(logged, ["Password-reset email delivery failed"])
      assert.doesNotMatch(JSON.stringify({ logged, result, intents: database.intents }), new RegExp(providerSecret))
    } finally {
      console.error = originalConsoleError
    }
  })

  it("returns durable pending truth when delivered mail cannot persist its status", async () => {
    const database = createSecurityDatabase()
    const rawToken = "delivered-token-must-stay-private"
    const persistenceSecret = "database-error-with-provider-and-token-details"
    const logged = []
    const originalConsoleError = console.error
    database.nextIntentUpdateError = new Error(persistenceSecret)
    console.error = (...values) => logged.push(values.join(" "))
    try {
      const result = await sendAdminPasswordReset(baseInput(database, {
        idempotencyKey: "password-reset-delivered-status-failure-1",
        now: NOW,
        generateToken: () => rawToken,
        sendEmail: async () => ({ delivered: true }),
      }))

      assert.deepEqual(result, {
        emailIntentId: "intent-1",
        replayed: false,
        deliveryStatus: "PENDING",
        deliveryAttempted: true,
      })
      assert.equal(database.resetTokens.length, 1)
      assert.equal(database.actions.length, 1)
      assert.equal(database.activities.length, 1)
      assert.equal(database.intents.length, 1)
      assert.equal(database.intents[0].status, "PENDING")
      assert.equal(database.intents[0].attemptCount, 0)
      assert.deepEqual(logged, ["Password-reset delivery status could not be recorded"])
      assertNoSecretDurablePayload(database, result, [rawToken, persistenceSecret])
      assert.doesNotMatch(JSON.stringify(logged), new RegExp(`${rawToken}|${persistenceSecret}`))
    } finally {
      console.error = originalConsoleError
    }
  })

  it("returns durable pending truth when failed mail cannot persist its status", async () => {
    const database = createSecurityDatabase()
    const providerSecret = "smtp-error-with-recipient-and-token-details"
    const persistenceSecret = "intent-update-error-with-database-details"
    const logged = []
    const originalConsoleError = console.error
    database.nextIntentUpdateError = new Error(persistenceSecret)
    console.error = (...values) => logged.push(values.join(" "))
    try {
      const result = await sendAdminPasswordReset(baseInput(database, {
        idempotencyKey: "password-reset-failed-status-failure-1",
        now: NOW,
        generateToken: () => "failed-status-token-must-stay-private",
        sendEmail: async () => { throw new Error(providerSecret) },
      }))

      assert.deepEqual(result, {
        emailIntentId: "intent-1",
        replayed: false,
        deliveryStatus: "PENDING",
        deliveryAttempted: true,
      })
      assert.equal(database.resetTokens.length, 1)
      assert.equal(database.actions.length, 1)
      assert.equal(database.activities.length, 1)
      assert.equal(database.intents.length, 1)
      assert.equal(database.intents[0].status, "PENDING")
      assert.equal(database.intents[0].attemptCount, 0)
      assert.deepEqual(logged, [
        "Password-reset email delivery failed",
        "Password-reset delivery status could not be recorded",
      ])
      assertNoSecretDurablePayload(database, result, [providerSecret, persistenceSecret])
      assert.doesNotMatch(JSON.stringify(logged), new RegExp(`${providerSecret}|${persistenceSecret}`))
    } finally {
      console.error = originalConsoleError
    }
  })

  it("uses a new action and fresh token for failed-password-reset resend while exact replay never sends", async () => {
    const database = createSecurityDatabase()
    const tokens = ["fresh-token-1", "fresh-token-2"]
    const sent = []
    const sender = async (_email, token) => {
      sent.push(token)
      return { delivered: sent.length > 1 }
    }

    const firstInput = baseInput(database, {
      idempotencyKey: "password-reset-attempt-1",
      now: NOW,
      generateToken: () => tokens[0],
      sendEmail: sender,
    })
    const first = await sendAdminPasswordReset(firstInput)
    const replay = await sendAdminPasswordReset(firstInput)
    const resend = await sendAdminPasswordReset(baseInput(database, {
      idempotencyKey: "password-reset-attempt-2",
      now: new Date(NOW.getTime() + 1_000),
      generateToken: () => tokens[1],
      sendEmail: sender,
    }))

    assert.equal(first.deliveryStatus, "FAILED")
    assert.deepEqual(replay, {
      emailIntentId: first.emailIntentId,
      replayed: true,
      deliveryStatus: "FAILED",
      deliveryAttempted: false,
    })
    assert.equal(resend.deliveryStatus, "DELIVERED")
    assert.deepEqual(sent, tokens)
    assert.equal(database.resetTokens.length, 2)
    assert.notEqual(database.resetTokens[0].tokenHash, database.resetTokens[1].tokenHash)
    assert.equal(database.actions.length, 2)
    assert.equal(database.intents.length, 2)
  })

  it("serializes concurrent same-key password resets into one token, bundle, and mail attempt", async () => {
    const database = createSecurityDatabase()
    let generatedTokenCount = 0
    let deliveryCount = 0
    const input = baseInput(database, {
      idempotencyKey: "password-reset-concurrent-1",
      now: NOW,
      generateToken: () => `concurrent-reset-token-${++generatedTokenCount}`,
      sendEmail: async () => {
        deliveryCount += 1
        return { delivered: true }
      },
    })

    const results = await Promise.all([sendAdminPasswordReset(input), sendAdminPasswordReset(input)])

    assert.deepEqual(results.map((result) => result.replayed).sort(), [false, true])
    assert.deepEqual(results.map((result) => result.deliveryAttempted).sort(), [false, true])
    assert.equal(deliveryCount, 1)
    assert.equal(database.resetTokens.length, 1)
    assert.equal(database.actions.length, 1)
    assert.equal(database.activities.length, 1)
    assert.equal(database.intents.length, 1)
  })

  it("does not retry a password-reset token-hash P2002", async () => {
    const database = createSecurityDatabase()
    database.nextPasswordResetTokenCreateError = uniqueConstraintError("PasswordResetToken", ["tokenHash"])

    await assert.rejects(
      () => sendAdminPasswordReset(baseInput(database, {
        idempotencyKey: "password-token-collision-1",
        now: NOW,
        generateToken: () => "password-token-collision-value",
        sendEmail: async () => ({ delivered: true }),
      })),
      (error) => error.code === "P2002" && error.meta?.modelName === "PasswordResetToken",
    )
    assert.equal(database.transactionOptions.length, 1)
    assert.equal(database.resetTokens.length, 0)
    assert.equal(database.actions.length, 0)
    assert.equal(database.intents.length, 0)
  })

  it("does not retry an AdminAction P2002 for an unrelated unique target", async () => {
    const database = createSecurityDatabase()
    database.nextAdminActionCreateError = uniqueConstraintError("AdminAction", ["id"])

    await assert.rejects(
      () => revokeUserSessions(baseInput(database, {
        idempotencyKey: "unrelated-admin-action-collision-1",
        expectedAuthSessionVersion: 0,
        expectedSessionCount: 0,
        now: NOW,
      })),
      (error) => error.code === "P2002" && error.meta?.target?.[0] === "id",
    )
    assert.equal(database.transactionOptions.length, 1)
    assert.equal(database.actions.length, 0)
    assert.equal(database.intents.length, 0)
    assert.equal(database.users.find((user) => user.id === TARGET_ID).authSessionVersion, 0)
  })

  it("rejects password-reset replay whose durable intent no longer has a coherent recipient", async () => {
    const database = createSecurityDatabase()
    const input = baseInput(database, {
      idempotencyKey: "password-reset-recipient-tamper-1",
      now: NOW,
      generateToken: () => "password-recipient-tamper-token",
      sendEmail: async () => ({ delivered: true }),
    })
    await sendAdminPasswordReset(input)
    Object.assign(database.intents[0], {
      recipientEmail: null,
      status: "FAILED",
      failureCode: "RECIPIENT_UNAVAILABLE",
      attemptCount: 0,
      lastAttemptAt: null,
      deliveredAt: null,
    })

    await assert.rejects(() => sendAdminPasswordReset(input), /operation key is already in use/)
    assert.equal(database.resetTokens.length, 1)
    assert.equal(database.actions.length, 1)
  })

  it("rolls back a password-reset hash when its evidence bundle fails", async () => {
    const database = createSecurityDatabase()
    database.failIntentCreate = true
    let deliveryCalls = 0

    await assert.rejects(
      () => sendAdminPasswordReset(baseInput(database, {
        idempotencyKey: "password-reset-rollback-1",
        now: NOW,
        generateToken: () => "rollback-token",
        sendEmail: async () => { deliveryCalls += 1; return { delivered: true } },
      })),
      /intent create failed/,
    )

    assert.equal(database.resetTokens.length, 0)
    assert.equal(database.actions.length, 0)
    assert.equal(database.activities.length, 0)
    assert.equal(database.intents.length, 0)
    assert.equal(deliveryCalls, 0)
  })

  it("resets confirmed enabled 2FA without exposing encrypted secrets or recovery-code content", async () => {
    const database = createSecurityDatabase({ targetAuthSessionVersion: 9, twoFactorEnabled: true })
    database.sessions.push({ id: "session-1", userId: TARGET_ID, sessionToken: "opaque", expires: new Date("2026-08-10T00:00:00.000Z") })
    database.backupCodes.push(
      { id: "backup-1", userId: TARGET_ID, codeHash: "private-code-hash-1" },
      { id: "backup-2", userId: TARGET_ID, codeHash: "private-code-hash-2" },
    )

    const result = await resetUserTwoFactor(baseInput(database, {
      idempotencyKey: "two-factor-reset-1",
      confirmationEmail: "  MEMBER@EXAMPLE.TEST ",
      expectedTwoFactorEnabled: true,
    }))

    assert.deepEqual(result, {
      deletedTwoFactorSecretCount: 1,
      deletedBackupCodeCount: 2,
      revokedSessionCount: 1,
      beforeAuthSessionVersion: 9,
      afterAuthSessionVersion: 10,
      emailIntentId: "intent-1",
      replayed: false,
    })
    assert.equal(database.twoFactorSecrets.length, 0)
    assert.equal(database.backupCodes.length, 0)
    assert.equal(database.sessions.length, 0)
    assert.equal(database.users.find((user) => user.id === TARGET_ID).authSessionVersion, 10)
    assert.equal(database.actions[0].beforeState.twoFactorEnabled, true)
    assert.equal(database.actions[0].beforeState.confirmedEmail, "member@example.test")
    assert.equal(database.actions[0].afterState.twoFactorEnabled, false)
    assert.equal(database.actions[0].afterState.authSessionVersion, 10)
    assertNoSecretDurablePayload(database, result, ["encrypted-totp-secret", "private-code-hash-1", "private-code-hash-2"])
  })

  it("rejects typed-email mismatch, disabled 2FA, false expected state, and missing targets before mutation", async () => {
    await assert.rejects(
      () => resetUserTwoFactor(baseInput(createSecurityDatabase({ twoFactorEnabled: true }), {
        confirmationEmail: "someone-else@example.test",
        expectedTwoFactorEnabled: true,
      })),
      /confirmation email does not match/i,
    )
    await assert.rejects(
      () => resetUserTwoFactor(baseInput(createSecurityDatabase(), {
        confirmationEmail: "member@example.test",
        expectedTwoFactorEnabled: true,
      })),
      /two-factor authentication is not enabled/i,
    )
    await assert.rejects(
      () => resetUserTwoFactor(baseInput(createSecurityDatabase({ twoFactorEnabled: true }), {
        confirmationEmail: "member@example.test",
        expectedTwoFactorEnabled: false,
      })),
      /expected two-factor state/i,
    )
    await assert.rejects(
      () => resetUserTwoFactor(baseInput(createSecurityDatabase({ includeTarget: false }), {
        confirmationEmail: "member@example.test",
        expectedTwoFactorEnabled: true,
      })),
      /Target account was not found/,
    )
  })

  it("replays 2FA reset without deleting newly-created credentials or incrementing JWT state again", async () => {
    const database = createSecurityDatabase({ twoFactorEnabled: true })
    database.backupCodes.push({ id: "backup-1", userId: TARGET_ID, codeHash: "old-hash" })
    const input = baseInput(database, {
      idempotencyKey: "two-factor-replay-1",
      confirmationEmail: "member@example.test",
      expectedTwoFactorEnabled: true,
    })

    const first = await resetUserTwoFactor(input)
    database.twoFactorSecrets.push({ id: "new-secret", userId: TARGET_ID, encryptedSecret: "new-private-secret", enabledAt: NOW })
    database.backupCodes.push({ id: "new-backup", userId: TARGET_ID, codeHash: "new-private-code" })
    const replay = await resetUserTwoFactor(input)

    assert.deepEqual(replay, { ...first, replayed: true })
    assert.equal(database.twoFactorSecrets.length, 1)
    assert.equal(database.backupCodes.length, 1)
    assert.equal(database.users.find((user) => user.id === TARGET_ID).authSessionVersion, 1)
  })

  it("binds normalized typed email evidence so an old key cannot replay after the target email changes", async () => {
    const database = createSecurityDatabase({ twoFactorEnabled: true })
    const input = baseInput(database, {
      idempotencyKey: "two-factor-email-binding-1",
      confirmationEmail: " MEMBER@EXAMPLE.TEST ",
      expectedTwoFactorEnabled: true,
    })
    await resetUserTwoFactor(input)

    database.users.find((user) => user.id === TARGET_ID).email = "changed@example.test"
    database.twoFactorSecrets.push({ id: "new-secret", userId: TARGET_ID, encryptedSecret: "new-private-secret", enabledAt: NOW })
    database.backupCodes.push({ id: "new-backup", userId: TARGET_ID, codeHash: "new-private-code" })

    await assert.rejects(
      () => resetUserTwoFactor({ ...input, confirmationEmail: " CHANGED@EXAMPLE.TEST " }),
      /operation key is already in use/,
    )
    assert.equal(database.twoFactorSecrets.length, 1)
    assert.equal(database.backupCodes.length, 1)
    assert.equal(database.users.find((user) => user.id === TARGET_ID).authSessionVersion, 1)
  })

  it("rejects 2FA replay whose durable evidence does not prove one credential row was deleted", async () => {
    const database = createSecurityDatabase({ twoFactorEnabled: true })
    const input = baseInput(database, {
      idempotencyKey: "two-factor-tamper-1",
      confirmationEmail: "member@example.test",
      expectedTwoFactorEnabled: true,
    })
    await resetUserTwoFactor(input)
    database.actions[0].afterState.credentialRowsDeleted = 0

    await assert.rejects(() => resetUserTwoFactor(input), /operation key is already in use/)
    assert.equal(database.users.find((user) => user.id === TARGET_ID).authSessionVersion, 1)
    assert.equal(database.actions.length, 1)
  })

  it("serializes concurrent same-key 2FA resets into one deletion, version increment, and bundle", async () => {
    const database = createSecurityDatabase({ targetAuthSessionVersion: 4, twoFactorEnabled: true })
    database.backupCodes.push({ id: "backup-1", userId: TARGET_ID, codeHash: "private-code" })
    const input = baseInput(database, {
      idempotencyKey: "two-factor-concurrent-1",
      confirmationEmail: "member@example.test",
      expectedTwoFactorEnabled: true,
    })

    const results = await Promise.all([resetUserTwoFactor(input), resetUserTwoFactor(input)])

    assert.deepEqual(results.map((result) => result.replayed).sort(), [false, true])
    assert.deepEqual(results.map((result) => result.afterAuthSessionVersion), [5, 5])
    assert.equal(database.twoFactorSecrets.length, 0)
    assert.equal(database.backupCodes.length, 0)
    assert.equal(database.users.find((user) => user.id === TARGET_ID).authSessionVersion, 5)
    assert.equal(database.actions.length, 1)
    assert.equal(database.activities.length, 1)
    assert.equal(database.intents.length, 1)
  })

  it("rolls back 2FA deletion, JWT invalidation, sessions, and evidence together", async () => {
    const database = createSecurityDatabase({ targetAuthSessionVersion: 5, twoFactorEnabled: true })
    database.backupCodes.push({ id: "backup-1", userId: TARGET_ID, codeHash: "private-code" })
    database.sessions.push({ id: "session-1", userId: TARGET_ID, sessionToken: "opaque", expires: new Date("2026-08-10T00:00:00.000Z") })
    database.failIntentCreate = true

    await assert.rejects(
      () => resetUserTwoFactor(baseInput(database, {
        confirmationEmail: "member@example.test",
        expectedTwoFactorEnabled: true,
      })),
      /intent create failed/,
    )

    assert.equal(database.twoFactorSecrets.length, 1)
    assert.equal(database.backupCodes.length, 1)
    assert.equal(database.sessions.length, 1)
    assert.equal(database.users.find((user) => user.id === TARGET_ID).authSessionVersion, 5)
    assert.equal(database.actions.length, 0)
  })
})

async function noMail() {
  return { delivered: false }
}

function uniqueConstraintError(modelName, target) {
  return Object.assign(new Error("Unique constraint failed"), {
    code: "P2002",
    meta: { modelName, target },
  })
}

function assertNoSecretDurablePayload(database, result, extraForbidden = []) {
  const serialized = JSON.stringify({
    result,
    actions: database.actions,
    activities: database.activities,
    intents: database.intents,
  })
  for (const value of [
    "never-persist-this-session-token",
    "nor-this-session-token",
    "passwordHash",
    "encrypted-totp-secret",
    "private-code-hash",
    ...extraForbidden,
  ]) {
    assert.doesNotMatch(serialized, new RegExp(escapeRegExp(value), "i"))
  }
  assert.doesNotMatch(serialized, /reset-password\?token=/i)
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
}

function verifiedRole(role, id) {
  return {
    id,
    role,
    status: "VERIFIED",
    source: "system",
    metadata: {},
    verifiedAt: new Date("2026-08-01T12:00:00.000Z"),
    expiresAt: null,
    revokedAt: null,
    grantedById: null,
  }
}

function user(id, roles, overrides = {}) {
  return {
    id,
    name: id === ACTOR_ID ? "Administrator" : "Member",
    email: id === ACTOR_ID ? "admin@example.test" : "member@example.test",
    emailVerified: new Date("2026-08-01T12:00:00.000Z"),
    authSessionVersion: 0,
    roles,
    ...overrides,
  }
}

function createSecurityDatabase({
  actor = user(ACTOR_ID, [verifiedRole("ADMIN", "actor-admin")]),
  includeTarget = true,
  targetAuthSessionVersion = 0,
  twoFactorEnabled = false,
} = {}) {
  const target = user(TARGET_ID, [verifiedRole("USER", "target-user")], { authSessionVersion: targetAuthSessionVersion })
  const root = {
    state: {
      users: [actor, ...(includeTarget ? [target] : [])],
      sessions: [],
      twoFactorSecrets: includeTarget && twoFactorEnabled
        ? [{ id: "two-factor-1", userId: TARGET_ID, encryptedSecret: "encrypted-totp-secret", enabledAt: NOW }]
        : [],
      backupCodes: [],
      resetTokens: [],
      actions: [],
      activities: [],
      intents: [],
    },
    failIntentCreate: false,
    nextAdminActionCreateError: null,
    nextPasswordResetTokenCreateError: null,
    nextIntentUpdateError: null,
    transactionOptions: [],
    lockOwners: new Map(),
    lockWaiters: new Map(),
  }
  return makeClient(root)
}

/** Prisma-shaped transactional fake that commits one isolated snapshot only on success. */
function makeClient(root, transaction = null) {
  const state = () => transaction?.state ?? root.state
  const client = {}
  for (const field of ["users", "sessions", "twoFactorSecrets", "backupCodes", "resetTokens", "actions", "activities", "intents"]) {
    Object.defineProperty(client, field, { get: () => state()[field], set: (value) => { state()[field] = value } })
  }
  Object.defineProperty(client, "failIntentCreate", { get: () => root.failIntentCreate, set: (value) => { root.failIntentCreate = value } })
  Object.defineProperty(client, "nextAdminActionCreateError", { get: () => root.nextAdminActionCreateError, set: (value) => { root.nextAdminActionCreateError = value } })
  Object.defineProperty(client, "nextPasswordResetTokenCreateError", { get: () => root.nextPasswordResetTokenCreateError, set: (value) => { root.nextPasswordResetTokenCreateError = value } })
  Object.defineProperty(client, "nextIntentUpdateError", { get: () => root.nextIntentUpdateError, set: (value) => { root.nextIntentUpdateError = value } })
  Object.defineProperty(client, "transactionOptions", { get: () => root.transactionOptions })

  const project = (record, select) => record == null || !select
    ? record
    : Object.fromEntries(Object.keys(select).filter((key) => select[key]).map((key) => [key, record[key]]))
  const rolesFor = (userId) => state().users.find((candidate) => candidate.id === userId)?.roles ?? []
  const twoFactorFor = (userId) => state().twoFactorSecrets.find((secret) => secret.userId === userId) ?? null

  client.user = {
    findUnique: async ({ where }) => {
      const record = state().users.find((candidate) => candidate.id === where.id)
      return record ? structuredClone({ ...record, roles: rolesFor(record.id), twoFactorSecret: twoFactorFor(record.id) }) : null
    },
    update: async ({ where, data, select }) => {
      const record = state().users.find((candidate) => candidate.id === where.id)
      if (!record) throw new Error("User was not found.")
      const increment = data.authSessionVersion?.increment
      if (!Number.isSafeInteger(increment)) throw new Error("Expected an auth session version increment.")
      record.authSessionVersion += increment
      return structuredClone(project(record, select))
    },
  }
  client.session = {
    count: async ({ where }) => state().sessions.filter((session) => (
      session.userId === where.userId && (!where.expires?.gt || session.expires > where.expires.gt)
    )).length,
    deleteMany: async ({ where }) => deleteMatching(state(), "sessions", (session) => session.userId === where.userId),
  }
  client.twoFactorSecret = {
    deleteMany: async ({ where }) => deleteMatching(state(), "twoFactorSecrets", (secret) => secret.userId === where.userId),
  }
  client.backupCode = {
    deleteMany: async ({ where }) => deleteMatching(state(), "backupCodes", (code) => code.userId === where.userId),
  }
  client.passwordResetToken = {
    create: async ({ data, select }) => {
      if (root.nextPasswordResetTokenCreateError) {
        const error = root.nextPasswordResetTokenCreateError
        root.nextPasswordResetTokenCreateError = null
        throw error
      }
      const record = { id: `reset-${state().resetTokens.length + 1}`, consumedAt: null, createdAt: NOW, ...data }
      state().resetTokens.push(record)
      return structuredClone(project(record, select))
    },
  }
  client.adminAction = {
    findUnique: async ({ where, include }) => {
      const action = state().actions.find((candidate) => candidate.idempotencyKey === where.idempotencyKey)
      if (!action) return null
      return structuredClone(include ? {
        ...action,
        activity: state().activities.find((activity) => activity.adminActionId === action.id) ?? null,
        emailIntent: state().intents.find((intent) => intent.adminActionId === action.id) ?? null,
      } : action)
    },
    create: async ({ data, select }) => {
      if (root.nextAdminActionCreateError) {
        const error = root.nextAdminActionCreateError
        root.nextAdminActionCreateError = null
        throw error
      }
      if (root.state.actions.some((candidate) => candidate.idempotencyKey === data.idempotencyKey)) {
        throw uniqueConstraintError("AdminAction", ["idempotencyKey"])
      }
      const action = { id: `action-${state().actions.length + 1}`, ...data }
      state().actions.push(action)
      return structuredClone(project(action, select))
    },
  }
  client.userAccountActivity = {
    create: async ({ data }) => {
      const activity = { id: `activity-${state().activities.length + 1}`, ...data }
      state().activities.push(activity)
      return structuredClone(activity)
    },
  }
  client.adminEmailIntent = {
    create: async ({ data, select }) => {
      if (root.failIntentCreate) throw new Error("intent create failed")
      const intent = {
        id: `intent-${state().intents.length + 1}`,
        ...data,
        attemptCount: 0,
        lastAttemptAt: null,
        deliveredAt: null,
      }
      state().intents.push(intent)
      return structuredClone(project(intent, select))
    },
    update: async ({ where, data, select }) => {
      if (root.nextIntentUpdateError) {
        const error = root.nextIntentUpdateError
        root.nextIntentUpdateError = null
        throw error
      }
      const intent = state().intents.find((candidate) => candidate.id === where.id)
      if (!intent) throw new Error("Intent was not found.")
      for (const [key, value] of Object.entries(data)) {
        intent[key] = value && typeof value === "object" && "increment" in value ? intent[key] + value.increment : value
      }
      return structuredClone(project(intent, select))
    },
  }
  client.$executeRaw = async (query) => {
    if (!transaction) throw new Error("Advisory locks require a transaction.")
    const key = query.values?.[0]
    if (typeof key !== "string") throw new Error("Expected an advisory lock key.")
    await acquireLock(root, transaction, key)
    return 1
  }

  if (!transaction) {
    client.$transaction = async (callback, options) => {
      root.transactionOptions.push(options)
      const snapshot = { state: structuredClone(root.state), heldLocks: new Set() }
      try {
        const result = await callback(makeClient(root, snapshot))
        root.state = snapshot.state
        return result
      } finally {
        for (const key of snapshot.heldLocks) releaseLock(root, snapshot, key)
      }
    }
  }

  return client
}

function deleteMatching(state, field, predicate) {
  const before = state[field].length
  state[field] = state[field].filter((record) => !predicate(record))
  return { count: before - state[field].length }
}

/** Minimal re-entrant transaction advisory lock for duplicate-submit coverage. */
async function acquireLock(root, transaction, key) {
  if (root.lockOwners.get(key) === transaction) return
  while (root.lockOwners.has(key)) {
    await new Promise((resolve) => {
      const waiters = root.lockWaiters.get(key) ?? []
      waiters.push(resolve)
      root.lockWaiters.set(key, waiters)
    })
  }
  root.lockOwners.set(key, transaction)
  transaction.heldLocks.add(key)
  // PostgreSQL Serializable snapshots stay fixed even when a transaction waits
  // for and later acquires an advisory lock. Committed uniqueness is enforced
  // separately by adminAction.create above.
}

function releaseLock(root, transaction, key) {
  if (root.lockOwners.get(key) !== transaction) return
  root.lockOwners.delete(key)
  root.lockWaiters.get(key)?.shift()?.()
}
