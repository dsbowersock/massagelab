import assert from "node:assert/strict"
import { describe, it } from "node:test"
import {
  ADMIN_REASON_CODES,
  ADMIN_SAFE_PAYLOAD_MAX_KEY_LENGTH,
  validateAdminMetadata,
  validateAdminReason,
  validateAdminSafePayload,
} from "../lib/admin/operation-contract.ts"
import { recordAdminActionBundle as recordAdminActionBundleDirect } from "../lib/admin/operation-service.ts"
import { deliverAdminEmailIntent, retryAdminEmailIntent } from "../lib/admin/email-intents.ts"

/** All bundle writes use a caller-owned transaction, matching production use. */
async function recordAdminActionBundle(database, input) {
  return database.$transaction((tx) => recordAdminActionBundleDirect(tx, input))
}

describe("admin operation contract", () => {
  it("accepts every approved support reason", () => {
    for (const reasonCode of ADMIN_REASON_CODES) {
      validateAdminReason(reasonCode, reasonCode === "OTHER" ? "Documented exception." : undefined)
    }
  })

  it("rejects invalid support reasons and undocumented other reasons", () => {
    assert.throws(() => validateAdminReason("UNSUPPORTED", undefined), /Select a valid support reason\./)
    assert.throws(() => validateAdminReason("OTHER", "   "), /Other requires an internal note\./)
  })

  it("enforces the internal-note length boundary", () => {
    validateAdminReason("USER_REQUEST", "x".repeat(500))
    assert.throws(() => validateAdminReason("USER_REQUEST", "x".repeat(501)), /Internal notes are limited to 500 characters\./)
  })

  it("rejects restricted metadata keys at every nesting level", () => {
    assert.throws(() => validateAdminSafePayload({ passwordHint: "never store" }), /restricted data/)
    assert.throws(() => validateAdminMetadata({ context: [{ login: { backupCode: "never store" } }] }), /restricted data/)
  })

  it("keeps the approved forbidden-key regex semantics", () => {
    for (const key of ["payment_method", "fromRole", "promotion"]) {
      assert.throws(() => validateAdminSafePayload({ [key]: "never store" }), /restricted data/)
    }

    assert.deepEqual(validateAdminSafePayload({ paymentMethod: "reference-only" }), { paymentMethod: "reference-only" })
  })

  it("enforces payload depth, entry, and string boundaries", () => {
    const nestedPayload = (levels) => {
      let payload = "ok"
      for (let index = 0; index < levels; index += 1) payload = { next: payload }
      return payload
    }

    for (const { payload, valid } of [
      { payload: nestedPayload(5), valid: true },
      { payload: nestedPayload(6), valid: false },
      { payload: Object.fromEntries(Array.from({ length: 50 }, (_, index) => [`key${index}`, index])), valid: true },
      { payload: Object.fromEntries(Array.from({ length: 51 }, (_, index) => [`key${index}`, index])), valid: false },
      { payload: { note: "x".repeat(500) }, valid: true },
      { payload: { note: "x".repeat(501) }, valid: false },
    ]) {
      if (valid) {
        assert.doesNotThrow(() => validateAdminSafePayload(payload))
      } else {
        assert.throws(() => validateAdminSafePayload(payload), /supported size/)
      }
    }
  })

  it("bounds metadata keys at the exact root and nested boundary", () => {
    const boundaryKey = "k".repeat(ADMIN_SAFE_PAYLOAD_MAX_KEY_LENGTH)
    const overflowKey = "k".repeat(ADMIN_SAFE_PAYLOAD_MAX_KEY_LENGTH + 1)

    assert.deepEqual(validateAdminSafePayload({ [boundaryKey]: "ok" }), { [boundaryKey]: "ok" })
    assert.deepEqual(validateAdminSafePayload({ context: { [boundaryKey]: "ok" } }), { context: { [boundaryKey]: "ok" } })
    assert.throws(() => validateAdminSafePayload({ [overflowKey]: "no" }), /supported size/)
    assert.throws(() => validateAdminSafePayload({ context: { [overflowKey]: "no" } }), /supported size/)

    let accessorCalls = 0
    const accessorPayload = {}
    Object.defineProperty(accessorPayload, overflowKey, {
      enumerable: true,
      get: () => {
        accessorCalls += 1
        return "should not run"
      },
    })
    assert.throws(() => validateAdminSafePayload(accessorPayload), /JSON-compatible|supported size/)
    assert.equal(accessorCalls, 0)
  })

  it("rejects non-finite, unsupported, cyclic, and accessor-backed values without reading accessors", () => {
    for (const value of [Number.NaN, Number.POSITIVE_INFINITY, undefined, 1n, new Date(), () => {}]) {
      assert.throws(() => validateAdminSafePayload({ value }), /JSON-compatible/)
    }

    const cyclic = {}
    cyclic.self = cyclic
    assert.throws(() => validateAdminSafePayload(cyclic), /JSON-compatible/)

    for (const descriptor of [
      { get: () => "should not run" },
      { set: () => {} },
    ]) {
      let accessorCalls = 0
      const payload = {}
      Object.defineProperty(payload, "details", {
        ...descriptor,
        enumerable: true,
        get: descriptor.get ? () => {
          accessorCalls += 1
          return "should not run"
        } : undefined,
      })
      assert.throws(() => validateAdminSafePayload(payload), /JSON-compatible/)
      assert.equal(accessorCalls, 0)
    }
  })

  it("returns a detached snapshot of safe operation payload values", () => {
    const payload = {
      accountId: "user_123",
      grantedRole: "ANATOMY_EDITOR",
      change: { previous: "ANATOMY_REVIEWER", next: "ANATOMY_EDITOR" },
      tags: ["delegated-role", "support"],
    }
    const snapshot = validateAdminSafePayload(payload)

    assert.deepEqual(snapshot, payload)
    assert.notStrictEqual(snapshot, payload)
    assert.notStrictEqual(snapshot.change, payload.change)
    assert.notStrictEqual(snapshot.tags, payload.tags)

    payload.change.next = "ADMIN"
    payload.tags[0] = "changed"
    let laterGetterCalls = 0
    Object.defineProperty(payload.change, "later", {
      enumerable: true,
      get: () => {
        laterGetterCalls += 1
        return "should not affect the snapshot"
      },
    })

    assert.deepEqual(snapshot, {
      accountId: "user_123",
      grantedRole: "ANATOMY_EDITOR",
      change: { previous: "ANATOMY_REVIEWER", next: "ANATOMY_EDITOR" },
      tags: ["delegated-role", "support"],
    })
    assert.equal(laterGetterCalls, 0)
  })
})

describe("admin operation service", () => {
  it("creates the immutable security-recovery bundle atomically and replays only an exact duplicate", async () => {
    const database = createAdminDatabase()
    const input = bundleInput()

    const created = await recordAdminActionBundle(database, input)
    assert.deepEqual(created, { adminActionId: "action_1", emailIntentId: "intent_1", replayed: false })
    assert.equal(database.actions.length, 1)
    assert.equal(database.activities.length, 1)
    assert.equal(database.intents.length, 1)
    assert.deepEqual(database.activities[0], {
      id: "activity_1",
      userId: "user_target",
      adminActionId: "action_1",
      title: "Security settings updated",
      explanation: "Your active sessions were revoked after account recovery.",
      effectiveValue: "Immediately",
    })
    assert.deepEqual(database.intents[0], {
      id: "intent_1",
      userId: "user_target",
      adminActionId: "action_1",
      kind: "SECURITY_RECOVERY",
      recipientEmail: "member@example.com",
      subject: "Your MassageLab account security changed",
      message: "Your active sessions were revoked. Please sign in again.",
      status: "PENDING",
      attemptCount: 0,
      lastAttemptAt: null,
      deliveredAt: null,
      failureCode: null,
    })

    const replayed = await recordAdminActionBundle(database, {
      ...input,
      beforeState: { activeSessionCount: 3, deviceCount: 2 },
      afterState: { activeSessionCount: 0 },
    })
    assert.deepEqual(replayed, { ...created, replayed: true })
    assert.equal(database.actions.length, 1)
    assert.equal(database.activities.length, 1)
    assert.equal(database.intents.length, 1)

    database.activities.length = 0
    await assert.rejects(() => recordAdminActionBundle(database, input), /already in use/)
    database.activities.push({
      id: "activity_1",
      userId: "user_target",
      adminActionId: "action_1",
      title: "Security settings updated",
      explanation: "Your active sessions were revoked after account recovery.",
      effectiveValue: "Immediately",
    })

    await assert.rejects(
      () => recordAdminActionBundle(database, { ...input, afterState: { activeSessionCount: 1 } }),
      /already in use/,
    )
  })

  it("records recipient-unavailable intents without blocking the audit or activity", async () => {
    const database = createAdminDatabase()
    const created = await recordAdminActionBundle(database, {
      ...bundleInput(),
      idempotencyKey: "security-recovery-no-recipient",
      email: { ...bundleInput().email, recipientEmail: null },
    })

    assert.equal(created.replayed, false)
    assert.equal(database.actions.length, 1)
    assert.equal(database.activities.length, 1)
    assert.equal(database.intents[0].status, "FAILED")
    assert.equal(database.intents[0].failureCode, "RECIPIENT_UNAVAILABLE")
  })

  it("fails closed for every immutable bundle or ownership mismatch while accepting coherent delivered state", async () => {
    const mutations = [
      ({ action }) => { action.actorUserId = "other" },
      ({ action }) => { action.internalNote = null },
      ({ action }) => { action.outcome = "FAILED" },
      ({ activity }) => { activity.userId = "other" },
      ({ activity }) => { activity.title = "Different" },
      ({ intent }) => { intent.userId = "other" },
      ({ intent }) => { intent.subject = "Different" },
      ({ intent }) => { intent.status = "DELIVERED" },
    ]
    for (const mutate of mutations) {
      const database = createAdminDatabase()
      const input = bundleInput()
      await recordAdminActionBundle(database, input)
      mutate({ action: database.actions[0], activity: database.activities[0], intent: database.intents[0] })
      await assert.rejects(() => recordAdminActionBundle(database, input), /already in use/)
    }

    const database = createAdminDatabase()
    const created = await recordAdminActionBundle(database, bundleInput())
    await deliverAdminEmailIntent({ prismaClient: database, intentId: created.emailIntentId, sendEmail: async () => ({ delivered: true }) })
    assert.equal((await recordAdminActionBundle(database, bundleInput())).replayed, true)

    for (const mutate of [
      (intent) => { intent.recipientEmail = null },
      (intent) => { intent.recipientEmail = null; intent.status = "DELIVERED"; intent.attemptCount = 1; intent.lastAttemptAt = new Date(); intent.deliveredAt = new Date() },
      (intent) => { intent.status = "FAILED"; intent.failureCode = "RECIPIENT_UNAVAILABLE"; intent.attemptCount = 0 },
    ]) {
      const invalidDatabase = createAdminDatabase()
      await recordAdminActionBundle(invalidDatabase, bundleInput())
      mutate(invalidDatabase.intents[0])
      await assert.rejects(() => recordAdminActionBundle(invalidDatabase, bundleInput()), /already in use/)
    }

    const unavailableDatabase = createAdminDatabase()
    const unavailableInput = { ...bundleInput(), idempotencyKey: "unavailable-replay", email: { ...bundleInput().email, recipientEmail: null } }
    await recordAdminActionBundle(unavailableDatabase, unavailableInput)
    assert.equal((await recordAdminActionBundle(unavailableDatabase, unavailableInput)).replayed, true)
  })

  it("rolls back bundle writes when a child create fails", async () => {
    for (const failure of ["failNextActivityCreate", "failNextIntentCreate"]) {
      const database = createAdminDatabase()
      database[failure] = true
      await assert.rejects(() => recordAdminActionBundle(database, bundleInput()), /create failed/)
      assert.deepEqual([database.actions.length, database.activities.length, database.intents.length], [0, 0, 0])
    }
  })

  it("rolls back retry persistence after a post-send action collision", async () => {
    const database = createAdminDatabase()
    const { emailIntentId } = await recordAdminActionBundle(database, bundleInput())
    database.failNextActionCreate = true
    let sends = 0
    await assert.rejects(
      () => retryAdminEmailIntent({
        prismaClient: database,
        actorUserId: "user_actor",
        intentId: emailIntentId,
        idempotencyKey: "retry-action-collision",
        sendEmail: async () => {
          sends += 1
          return { delivered: true }
        },
      }),
      /already in use/,
    )
    assert.equal(sends, 1)
    assert.equal(database.actions.length, 1)
    assert.equal(database.intents[0].status, "PENDING")
    assert.equal(database.intents[0].attemptCount, 0)
  })

  it("serializes concurrent exact and conflicting bundle idempotency keys", async () => {
    const exactDatabase = createAdminDatabase()
    const exact = await Promise.all([recordAdminActionBundle(exactDatabase, bundleInput()), recordAdminActionBundle(exactDatabase, bundleInput())])
    assert.deepEqual(exact.map((result) => result.replayed), [false, true])
    assert.deepEqual([exactDatabase.actions.length, exactDatabase.activities.length, exactDatabase.intents.length], [1, 1, 1])

    const conflictDatabase = createAdminDatabase()
    const conflict = await Promise.allSettled([
      recordAdminActionBundle(conflictDatabase, bundleInput()),
      recordAdminActionBundle(conflictDatabase, { ...bundleInput(), afterState: { activeSessionCount: 1 } }),
    ])
    assert.equal(conflict.filter((result) => result.status === "fulfilled").length, 1)
    assert.match(conflict.find((result) => result.status === "rejected").reason.message, /already in use/)

    const crossPathDatabase = createAdminDatabase()
    const existingIntent = await recordAdminActionBundle(crossPathDatabase, bundleInput())
    let sends = 0
    await recordAdminActionBundle(crossPathDatabase, { ...bundleInput(), idempotencyKey: "bundle-retry-collision" })
    await assert.rejects(
      () => retryAdminEmailIntent({
        prismaClient: crossPathDatabase,
        actorUserId: "user_actor",
        intentId: existingIntent.emailIntentId,
        idempotencyKey: "bundle-retry-collision",
        sendEmail: async () => { sends += 1; return { delivered: true } },
      }),
      /already in use/,
    )
    assert.equal(sends, 0)
  })

  it("delivers only persisted email content and records the successful attempt", async () => {
    const database = createAdminDatabase()
    const { emailIntentId } = await recordAdminActionBundle(database, bundleInput())
    const sent = []
    const when = new Date("2026-08-08T14:00:00.000Z")

    const result = await deliverAdminEmailIntent({
      prismaClient: database,
      intentId: emailIntentId,
      now: when,
      sendEmail: async (...args) => {
        sent.push(args)
        return { delivered: true }
      },
    })

    assert.deepEqual(sent, [["member@example.com", "Your MassageLab account security changed", "Your active sessions were revoked. Please sign in again."]])
    assert.deepEqual(result, { status: "DELIVERED", attemptCount: 1, attempted: true })
    assert.equal(database.intents[0].status, "DELIVERED")
    assert.equal(database.intents[0].attemptCount, 1)
    assert.equal(database.intents[0].lastAttemptAt, when)
    assert.equal(database.intents[0].deliveredAt, when)
    assert.equal(database.intents[0].failureCode, null)
  })

  it("keeps provider failure details out of durable failures", async () => {
    for (const sendEmail of [
      async () => ({ delivered: false }),
      async () => { throw new Error("provider said recipient is suppressed") },
    ]) {
      const database = createAdminDatabase()
      const { emailIntentId } = await recordAdminActionBundle(database, bundleInput())
      const result = await deliverAdminEmailIntent({ prismaClient: database, intentId: emailIntentId, sendEmail })

      assert.deepEqual(result, { status: "FAILED", attemptCount: 1, attempted: true })
      assert.equal(database.intents[0].status, "FAILED")
      assert.equal(database.intents[0].failureCode, "DELIVERY_FAILED")
      assert.doesNotMatch(JSON.stringify(database.intents[0]), /suppressed|provider said/i)
    }
  })

  it("does not resend delivered or recipient-unavailable intents", async () => {
    const database = createAdminDatabase()
    const delivered = await recordAdminActionBundle(database, bundleInput())
    database.intents[0].status = "DELIVERED"
    database.intents[0].attemptCount = 4
    const unavailable = await recordAdminActionBundle(database, {
      ...bundleInput(),
      idempotencyKey: "recipient-unavailable",
      email: { ...bundleInput().email, recipientEmail: null },
    })
    let calls = 0
    const sendEmail = async () => {
      calls += 1
      return { delivered: true }
    }

    assert.deepEqual(await deliverAdminEmailIntent({ prismaClient: database, intentId: delivered.emailIntentId, sendEmail }), {
      status: "DELIVERED", attemptCount: 4, attempted: false,
    })
    assert.deepEqual(await deliverAdminEmailIntent({ prismaClient: database, intentId: unavailable.emailIntentId, sendEmail }), {
      status: "FAILED", attemptCount: 0, attempted: false,
    })
    assert.equal(calls, 0)
  })

  it("requires a fresh full Admin and writes an idempotent retry audit without another activity or intent", async () => {
    const database = createAdminDatabase()
    const { emailIntentId } = await recordAdminActionBundle(database, bundleInput())
    database.adminRoles = [{ role: "ANATOMY_EDITOR", status: "VERIFIED" }]
    await assert.rejects(
      () => retryAdminEmailIntent({ prismaClient: database, actorUserId: "user_actor", intentId: emailIntentId, idempotencyKey: "retry-1" }),
      /Full administration requires verified database authority/,
    )

    database.adminRoles = [{ role: "ADMIN", status: "VERIFIED" }]
    let calls = 0
    const first = await retryAdminEmailIntent({
      prismaClient: database,
      actorUserId: "user_actor",
      intentId: emailIntentId,
      idempotencyKey: "retry-1",
      sendEmail: async () => {
        calls += 1
        return { delivered: true }
      },
    })
    const replayed = await retryAdminEmailIntent({
      prismaClient: database,
      actorUserId: "user_actor",
      intentId: emailIntentId,
      idempotencyKey: "retry-1",
      sendEmail: async () => {
        calls += 1
        return { delivered: true }
      },
    })

    assert.deepEqual(first, { status: "DELIVERED", attemptCount: 1, replayed: false })
    assert.deepEqual(replayed, { status: "DELIVERED", attemptCount: 1, replayed: true })
    assert.equal(calls, 1)
    assert.equal(database.actions.length, 2)
    assert.equal(database.activities.length, 1)
    assert.equal(database.intents.length, 1)
    const retryAction = database.actions[1]
    assert.equal(retryAction.actionKind, "EMAIL_NOTIFICATION_RETRIED")
    assert.equal(retryAction.outcome, "SUCCEEDED")
    assert.deepEqual(retryAction.beforeState, { emailIntentId, status: "PENDING", attemptCount: 0 })
    assert.deepEqual(retryAction.afterState, { emailIntentId, status: "DELIVERED", attemptCount: 1 })
  })

  it("records a failed retry outcome without exposing provider errors", async () => {
    const database = createAdminDatabase()
    const { emailIntentId } = await recordAdminActionBundle(database, bundleInput())
    const result = await retryAdminEmailIntent({
      prismaClient: database,
      actorUserId: "user_actor",
      intentId: emailIntentId,
      idempotencyKey: "retry-failure",
      sendEmail: async () => { throw new Error("sensitive provider payload") },
    })

    assert.deepEqual(result, { status: "FAILED", attemptCount: 1, replayed: false })
    assert.equal(database.actions.at(-1).outcome, "FAILED")
    assert.equal(database.actions.at(-1).failureCode, "DELIVERY_FAILED")
    assert.doesNotMatch(JSON.stringify(database.actions.at(-1)), /sensitive provider payload/)
  })

  it("fails closed on malformed or recursive historical retry actions", async () => {
    for (const mutateRetryAction of [
      ({ action }) => { action.internalNote = "must not be present" },
      ({ database, action }) => database.activities.push({
        id: "recursive_activity",
        userId: "user_target",
        adminActionId: action.id,
        title: "Unexpected child",
        explanation: "Historical data is malformed.",
        effectiveValue: null,
      }),
      ({ database, action }) => database.intents.push({
        ...database.intents[0],
        id: "recursive_intent",
        adminActionId: action.id,
      }),
      ({ action }) => { action.afterState = { ...action.afterState, unexpected: true } },
    ]) {
      const database = createAdminDatabase()
      const { emailIntentId } = await recordAdminActionBundle(database, bundleInput())
      await retryAdminEmailIntent({
        prismaClient: database,
        actorUserId: "user_actor",
        intentId: emailIntentId,
        idempotencyKey: "historical-retry",
        sendEmail: async () => ({ delivered: true }),
      })
      mutateRetryAction({ database, action: database.actions.at(-1) })

      await assert.rejects(
        () => retryAdminEmailIntent({
          prismaClient: database,
          actorUserId: "user_actor",
          intentId: emailIntentId,
          idempotencyKey: "historical-retry",
        }),
        /(incomplete|already in use)/,
      )
    }
  })

  it("rejects password-reset intents without a delivery attempt or retry audit", async () => {
    const database = createAdminDatabase()
    const { emailIntentId } = await recordAdminActionBundle(database, {
      ...bundleInput(),
      email: { ...bundleInput().email, kind: "PASSWORD_RESET" },
    })
    let calls = 0
    const sendEmail = async () => {
      calls += 1
      return { delivered: true }
    }

    await assert.rejects(() => deliverAdminEmailIntent({ prismaClient: database, intentId: emailIntentId, sendEmail }), /Password-reset/)
    await assert.rejects(
      () => retryAdminEmailIntent({ prismaClient: database, actorUserId: "user_actor", intentId: emailIntentId, idempotencyKey: "password-retry", sendEmail }),
      /Password-reset/,
    )
    assert.equal(calls, 0)
    assert.equal(database.intents[0].attemptCount, 0)
    assert.equal(database.actions.length, 1)
  })

  it("binds retry idempotency to one intent and rejects non-attemptable new retries", async () => {
    const database = createAdminDatabase()
    const first = await recordAdminActionBundle(database, bundleInput())
    const second = await recordAdminActionBundle(database, {
      ...bundleInput(),
      idempotencyKey: "second-intent",
    })
    await retryAdminEmailIntent({
      prismaClient: database,
      actorUserId: "user_actor",
      intentId: first.emailIntentId,
      idempotencyKey: "shared-retry-key",
      sendEmail: async () => ({ delivered: true }),
    })
    await assert.rejects(
      () => retryAdminEmailIntent({ prismaClient: database, actorUserId: "user_actor", intentId: second.emailIntentId, idempotencyKey: "shared-retry-key" }),
      /incomplete/,
    )
    await assert.rejects(
      () => retryAdminEmailIntent({ prismaClient: database, actorUserId: "user_actor", intentId: first.emailIntentId, idempotencyKey: "delivered-new-key" }),
      /cannot be retried/,
    )
    assert.equal(database.actions.length, 3)
  })

  it("serializes concurrent direct delivery and concurrent same-key retries", async () => {
    const directDatabase = createAdminDatabase()
    const direct = await recordAdminActionBundle(directDatabase, bundleInput())
    let directCalls = 0
    const directResults = await Promise.all([
      deliverAdminEmailIntent({
        prismaClient: directDatabase,
        intentId: direct.emailIntentId,
        sendEmail: async () => {
          directCalls += 1
          await new Promise((resolve) => setTimeout(resolve, 5))
          return { delivered: true }
        },
      }),
      deliverAdminEmailIntent({
        prismaClient: directDatabase,
        intentId: direct.emailIntentId,
        sendEmail: async () => {
          directCalls += 1
          return { delivered: false }
        },
      }),
    ])
    assert.equal(directCalls, 1)
    assert.deepEqual(directResults.map((result) => result.status), ["DELIVERED", "DELIVERED"])
    assert.equal(directDatabase.intents[0].attemptCount, 1)

    const retryDatabase = createAdminDatabase()
    const retry = await recordAdminActionBundle(retryDatabase, bundleInput())
    let retryCalls = 0
    const retryResults = await Promise.all([
      retryAdminEmailIntent({
        prismaClient: retryDatabase,
        actorUserId: "user_actor",
        intentId: retry.emailIntentId,
        idempotencyKey: "concurrent-retry",
        sendEmail: async () => {
          retryCalls += 1
          await new Promise((resolve) => setTimeout(resolve, 5))
          return { delivered: true }
        },
      }),
      retryAdminEmailIntent({
        prismaClient: retryDatabase,
        actorUserId: "user_actor",
        intentId: retry.emailIntentId,
        idempotencyKey: "concurrent-retry",
        sendEmail: async () => {
          retryCalls += 1
          return { delivered: false }
        },
      }),
    ])
    assert.equal(retryCalls, 1)
    assert.deepEqual(retryResults.map((result) => result.replayed), [false, true])
    assert.equal(retryDatabase.actions.length, 2)

    const differentIntentDatabase = createAdminDatabase()
    const firstIntent = await recordAdminActionBundle(differentIntentDatabase, bundleInput())
    const secondIntent = await recordAdminActionBundle(differentIntentDatabase, {
      ...bundleInput(),
      idempotencyKey: "different-intent-operation",
    })
    let differentIntentCalls = 0
    const differentIntentResults = await Promise.allSettled([
      retryAdminEmailIntent({
        prismaClient: differentIntentDatabase,
        actorUserId: "user_actor",
        intentId: firstIntent.emailIntentId,
        idempotencyKey: "shared-concurrent-key",
        sendEmail: async () => {
          differentIntentCalls += 1
          await new Promise((resolve) => setTimeout(resolve, 5))
          return { delivered: true }
        },
      }),
      retryAdminEmailIntent({
        prismaClient: differentIntentDatabase,
        actorUserId: "user_actor",
        intentId: secondIntent.emailIntentId,
        idempotencyKey: "shared-concurrent-key",
        sendEmail: async () => {
          differentIntentCalls += 1
          return { delivered: true }
        },
      }),
    ])
    assert.equal(differentIntentCalls, 1)
    assert.equal(differentIntentResults.filter((result) => result.status === "fulfilled").length, 1)
    assert.match(differentIntentResults.find((result) => result.status === "rejected").reason.message, /incomplete/)

    const sharedIntentDatabase = createAdminDatabase()
    const sharedIntent = await recordAdminActionBundle(sharedIntentDatabase, bundleInput())
    let sharedSends = 0
    const sharedResults = await Promise.allSettled([
      deliverAdminEmailIntent({
        prismaClient: sharedIntentDatabase,
        intentId: sharedIntent.emailIntentId,
        sendEmail: async () => { sharedSends += 1; await new Promise((resolve) => setTimeout(resolve, 5)); return { delivered: true } },
      }),
      retryAdminEmailIntent({
        prismaClient: sharedIntentDatabase,
        actorUserId: "user_actor",
        intentId: sharedIntent.emailIntentId,
        idempotencyKey: "direct-retry-race",
        sendEmail: async () => { sharedSends += 1; return { delivered: true } },
      }),
    ])
    assert.equal(sharedSends, 1)
    assert.equal(sharedIntentDatabase.intents[0].status, "DELIVERED")
    assert.equal(sharedIntentDatabase.intents[0].attemptCount, 1)
    assert.ok(sharedResults.filter((result) => result.status === "fulfilled").length >= 1)
    assert.ok(sharedIntentDatabase.actions.length === 1 || sharedIntentDatabase.actions.length === 2)
  })
})

function bundleInput() {
  return {
    actorUserId: "user_actor",
    targetUserId: "user_target",
    actionKind: "SESSIONS_REVOKED",
    reasonCode: "SECURITY_RECOVERY",
    internalNote: "Verified ownership through the support recovery checklist.",
    idempotencyKey: "security-recovery-1",
    beforeState: { deviceCount: 2, activeSessionCount: 3 },
    afterState: { activeSessionCount: 0 },
    activity: {
      title: "Security settings updated",
      explanation: "Your active sessions were revoked after account recovery.",
      effectiveValue: "Immediately",
    },
    email: {
      kind: "SECURITY_RECOVERY",
      recipientEmail: " Member@Example.COM ",
      subject: "Your MassageLab account security changed",
      message: "Your active sessions were revoked. Please sign in again.",
    },
  }
}

/** Structural Prisma fake: each delegate preserves the production schema links. */
function createAdminDatabase() {
  const root = {
    _state: { actions: [], activities: [], intents: [], adminRoles: [{ role: "ADMIN", status: "VERIFIED" }] },
    heldAdvisoryLocks: new Set(),
    advisoryWaiters: new Map(),
    failNextActivityCreate: false,
    failNextIntentCreate: false,
    failNextActionCreate: false,
  }
  return makeFakeClient(root)
}

/** Each fake transaction receives an isolated snapshot and commits only on success. */
function makeFakeClient(root, transactionState = null) {
  const state = () => transactionState?.value ?? root._state
  const client = {}
  for (const field of ["actions", "activities", "intents", "adminRoles"]) {
    Object.defineProperty(client, field, { get: () => state()[field], set: (value) => { state()[field] = value } })
  }
  for (const field of ["failNextActivityCreate", "failNextIntentCreate", "failNextActionCreate"]) {
    Object.defineProperty(client, field, { get: () => root[field], set: (value) => { root[field] = value } })
  }
  const project = (record, select) => !select ? record : Object.fromEntries(Object.keys(select).filter((key) => select[key]).map((key) => [key, record[key]]))
  client.adminAction = {
    findUnique: async ({ where, include, select }) => {
      const action = state().actions.find((candidate) => candidate.idempotencyKey === where.idempotencyKey)
      if (!action) return null
      const record = include || select?.activity || select?.emailIntent
        ? { ...action, activity: state().activities.find((activity) => activity.adminActionId === action.id) ?? null, emailIntent: state().intents.find((intent) => intent.adminActionId === action.id) ?? null }
        : action
      return project(record, select)
    },
    create: async ({ data, select }) => {
      if (root.failNextActionCreate) { root.failNextActionCreate = false; throw Object.assign(new Error("unique key"), { code: "P2002" }) }
      if (state().actions.some((candidate) => candidate.idempotencyKey === data.idempotencyKey)) throw Object.assign(new Error("unique key"), { code: "P2002" })
      const action = { id: `action_${state().actions.length + 1}`, ...data }
      state().actions.push(action)
      client._hasMutations = true
      return project(action, select)
    },
  }
  client.userAccountActivity = { create: async ({ data }) => {
    if (root.failNextActivityCreate) { root.failNextActivityCreate = false; throw new Error("activity create failed") }
    const activity = { id: `activity_${state().activities.length + 1}`, ...data }
    state().activities.push(activity)
    client._hasMutations = true
    return activity
  } }
  client.adminEmailIntent = {
    findUnique: async ({ where, select }) => project(state().intents.find((intent) => intent.id === where.id) ?? null, select),
    create: async ({ data, select }) => {
      if (root.failNextIntentCreate) { root.failNextIntentCreate = false; throw new Error("intent create failed") }
      const intent = { id: `intent_${state().intents.length + 1}`, ...data, attemptCount: 0, lastAttemptAt: null, deliveredAt: null }
      state().intents.push(intent)
      client._hasMutations = true
      return project(intent, select)
    },
    update: async ({ where, data, select }) => {
      const intent = state().intents.find((candidate) => candidate.id === where.id)
      Object.assign(intent, data, { attemptCount: intent.attemptCount + (data.attemptCount?.increment ?? 0) })
      client._hasMutations = true
      return project(intent, select)
    },
  }
  client.user = { findUnique: async () => ({ id: "user_actor", name: "Administrator", email: "admin@example.com", emailVerified: new Date(), roles: state().adminRoles }) }
  client.$executeRaw = async (query) => {
    const key = query.values?.[0]
    if (typeof key !== "string") throw new Error("Expected advisory lock key")
    if (!transactionState) throw new Error("Advisory locks require a transaction")
    await acquireFakeAdvisoryLock(root, key, client._heldByTransaction)
    if (!client._hasMutations) {
      transactionState.value = structuredClone(root._state)
    }
    return 1
  }
  if (!transactionState) {
    client.$transaction = async (callback) => {
      const snapshot = { value: structuredClone(root._state) }
      const tx = makeFakeClient(root, snapshot)
      tx._heldByTransaction = []
      try {
        const result = await callback(tx)
        root._state = snapshot.value
        return result
      } finally {
        for (const key of tx._heldByTransaction.reverse()) releaseFakeAdvisoryLock(root, key)
      }
    }
  }
  return client
}

/** Minimal transaction-scoped advisory-lock model for concurrent service tests. */
async function acquireFakeAdvisoryLock(database, key, heldByTransaction) {
  while (database.heldAdvisoryLocks.has(key)) {
    await new Promise((resolve) => {
      const waiters = database.advisoryWaiters.get(key) ?? []
      waiters.push(resolve)
      database.advisoryWaiters.set(key, waiters)
    })
  }
  database.heldAdvisoryLocks.add(key)
  heldByTransaction.push(key)
}

function releaseFakeAdvisoryLock(database, key) {
  database.heldAdvisoryLocks.delete(key)
  database.advisoryWaiters.get(key)?.shift()?.()
}
