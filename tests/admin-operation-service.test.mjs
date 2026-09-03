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
import {
  ADMIN_EMAIL_TRANSACTION_OPTIONS,
  deliverAdminEmailIntent,
  retryAdminEmailIntent,
} from "../lib/admin/email-intents.ts"
import { ACCOUNT_CHANGE_EMAIL_DELIVERY_BUDGET_MS } from "../lib/auth-mail.ts"

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
  it("rejects unknown object operators in the fake intent predicate", () => {
    assert.equal(matchesIntentWhere(
      { status: "PENDING" },
      { status: { equals: "PENDING" } },
    ), false)
  })

  it("rejects non-text internal notes before validating reason-specific content", async () => {
    const database = createAdminDatabase()
    await assert.rejects(
      () => recordAdminActionBundle(database, { ...bundleInput(), reasonCode: "OTHER", internalNote: 42 }),
      { message: "Internal notes must be text." },
    )
  })

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
      deliveryClaimTokenHash: null,
      deliveryClaimExpiresAt: null,
      deliveryClaimOperationKeyHash: null,
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

  it("fails closed when canonical replay serialization fails on both sides", async () => {
    const database = createAdminDatabase()
    const input = bundleInput()
    await recordAdminActionBundle(database, input)
    const originalStringify = JSON.stringify
    JSON.stringify = () => { throw new Error("serialization unavailable") }
    try {
      await assert.rejects(() => recordAdminActionBundle(database, input), /already in use/)
    } finally {
      JSON.stringify = originalStringify
    }
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
      ({ intent }) => {
        intent.attemptCount = 1
        intent.lastAttemptAt = new Date()
        intent.deliveryClaimTokenHash = "a".repeat(64)
        intent.deliveryClaimExpiresAt = new Date()
        intent.deliveryClaimOperationKeyHash = "b".repeat(64)
      },
      ({ intent }) => { intent.deliveryClaimTokenHash = "a".repeat(64) },
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

    const failedClaimDatabase = createAdminDatabase()
    const failedClaim = await recordAdminActionBundle(failedClaimDatabase, bundleInput())
    await deliverAdminEmailIntent({ prismaClient: failedClaimDatabase, intentId: failedClaim.emailIntentId, sendEmail: async () => ({ delivered: false }) })
    failedClaimDatabase.intents[0].deliveryClaimTokenHash = "c".repeat(64)
    failedClaimDatabase.intents[0].deliveryClaimExpiresAt = new Date()
    await assert.rejects(() => recordAdminActionBundle(failedClaimDatabase, bundleInput()), /already in use/)

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

  it("keeps ambiguous retry keys bound while a fresh key recovers the expired claim", async () => {
    const database = createAdminDatabase()
    const { emailIntentId } = await recordAdminActionBundle(database, bundleInput())
    const ambiguousAt = new Date("2026-08-08T14:00:00.000Z")
    await deliverAdminEmailIntent({
      prismaClient: database,
      intentId: emailIntentId,
      now: ambiguousAt,
      sendEmail: async () => ({ delivered: false }),
    })
    database.failNextActionCreate = true
    let sends = 0
    const result = await retryAdminEmailIntent({
      prismaClient: database,
      actorUserId: "user_actor",
      expectedTargetUserId: "user_target",
      intentId: emailIntentId,
      idempotencyKey: "retry-action-collision",
      now: ambiguousAt,
      sendEmail: async () => {
        sends += 1
        return { delivered: true }
      },
    })

    assert.deepEqual(result, {
      status: "AMBIGUOUS",
      attemptCount: 2,
      attempted: true,
      replayed: false,
    })
    assert.equal(sends, 1)
    assert.equal(database.actions.length, 1)
    assert.equal(database.intents[0].status, "FAILED")
    assert.equal(database.intents[0].attemptCount, 2)
    assert.match(database.intents[0].deliveryClaimTokenHash, /^[0-9a-f]{64}$/)
    assert.ok(database.intents[0].deliveryClaimExpiresAt instanceof Date)
    assert.match(database.intents[0].deliveryClaimOperationKeyHash, /^[0-9a-f]{64}$/)
    assert.equal(database.retryOperationKeys.length, 1)
    assert.equal(database.retryOperationKeys[0].emailIntentId, emailIntentId)
    assert.equal(database.retryOperationKeys[0].operationKeyHash, database.intents[0].deliveryClaimOperationKeyHash)
    assert.notEqual(database.retryOperationKeys[0].operationKeyHash, "retry-action-collision")

    const beforeExpiry = await retryAdminEmailIntent({
      prismaClient: database,
      actorUserId: "user_actor",
      expectedTargetUserId: "user_target",
      intentId: emailIntentId,
      idempotencyKey: "different-recovery-key",
      now: new Date("2026-08-08T14:04:59.999Z"),
      sendEmail: async () => {
        sends += 1
        return { delivered: true }
      },
    })
    assert.deepEqual(beforeExpiry, {
      status: "BUSY",
      attemptCount: 2,
      replayed: false,
      attempted: false,
    })
    assert.equal(sends, 1)
    assert.equal(database.retryOperationKeys.length, 1)

    const afterExpiry = new Date("2026-08-08T14:06:00.000Z")
    const recovered = await retryAdminEmailIntent({
      prismaClient: database,
      actorUserId: "user_actor",
      expectedTargetUserId: "user_target",
      intentId: emailIntentId,
      idempotencyKey: "different-recovery-key",
      now: afterExpiry,
      sendEmail: async () => {
        sends += 1
        return { delivered: true }
      },
    })
    assert.deepEqual(recovered, { status: "DELIVERED", attemptCount: 3, replayed: false })
    assert.equal(sends, 2)
    assert.equal(database.intents[0].deliveryClaimOperationKeyHash, null)
    assert.equal(database.retryOperationKeys.length, 2)
    assert.equal(new Set(database.retryOperationKeys.map((row) => row.operationKeyHash)).size, 2)
    assert.equal(database.retryOperationKeys.every((row) => row.emailIntentId === emailIntentId), true)
    assert.equal(database.actions.some((action) => action.idempotencyKey === "different-recovery-key"), true)

    const second = await recordAdminActionBundle(database, {
      ...bundleInput(),
      idempotencyKey: "second-email-intent",
    })
    await deliverAdminEmailIntent({
      prismaClient: database,
      intentId: second.emailIntentId,
      now: afterExpiry,
      sendEmail: async () => ({ delivered: false }),
    })
    let crossIntentSends = 0
    for (const [idempotencyKey, expectedMessage] of [
      ["retry-action-collision", "This administrative operation key is already in use."],
      ["different-recovery-key", "The existing retry record is incomplete."],
    ]) {
      await assert.rejects(
        () => retryAdminEmailIntent({
          prismaClient: database,
          actorUserId: "user_actor",
          expectedTargetUserId: "user_target",
          intentId: second.emailIntentId,
          idempotencyKey,
          now: afterExpiry,
          sendEmail: async () => {
            crossIntentSends += 1
            return { delivered: true }
          },
        }),
        (error) => {
          assert.equal(error.message, expectedMessage)
          return true
        },
      )
    }
    assert.equal(crossIntentSends, 0)
    assert.equal(database.intents[1].deliveryClaimOperationKeyHash, null)
    assert.equal(database.retryOperationKeys.length, 2)
  })

  it("lets the same retry key recover its own expired ambiguous claim", async () => {
    const database = createAdminDatabase()
    const { emailIntentId } = await recordAdminActionBundle(database, bundleInput())
    await deliverAdminEmailIntent({
      prismaClient: database,
      intentId: emailIntentId,
      now: new Date("2026-08-08T14:00:00.000Z"),
      sendEmail: async () => ({ delivered: false }),
    })
    database.failNextActionCreate = true
    const ambiguous = await retryAdminEmailIntent({
      prismaClient: database,
      actorUserId: "user_actor",
      expectedTargetUserId: "user_target",
      intentId: emailIntentId,
      idempotencyKey: "same-key-recovery",
      now: new Date("2026-08-08T14:00:00.000Z"),
      sendEmail: async () => ({ delivered: true }),
    })
    assert.equal(ambiguous.status, "AMBIGUOUS")

    const recovered = await retryAdminEmailIntent({
      prismaClient: database,
      actorUserId: "user_actor",
      expectedTargetUserId: "user_target",
      intentId: emailIntentId,
      idempotencyKey: "same-key-recovery",
      now: new Date("2026-08-08T14:06:00.000Z"),
      sendEmail: async () => ({ delivered: true }),
    })
    assert.deepEqual(recovered, { status: "DELIVERED", attemptCount: 3, replayed: false })
    assert.equal(database.retryOperationKeys.length, 1)
    assert.equal(database.actions.filter((action) => action.idempotencyKey === "same-key-recovery").length, 1)
  })

  it("keeps a stale retry finalizer from altering a fresh-key recovery", async () => {
    const database = createAdminDatabase()
    const { emailIntentId } = await recordAdminActionBundle(database, bundleInput())
    await deliverAdminEmailIntent({
      prismaClient: database,
      intentId: emailIntentId,
      now: new Date("2026-08-08T14:00:00.000Z"),
      sendEmail: async () => ({ delivered: false }),
    })
    let releaseFirstSend
    let markFirstSendStarted
    const firstSendGate = new Promise((resolve) => { releaseFirstSend = resolve })
    const firstSendStarted = new Promise((resolve) => { markFirstSendStarted = resolve })
    const stale = retryAdminEmailIntent({
      prismaClient: database,
      actorUserId: "user_actor",
      expectedTargetUserId: "user_target",
      intentId: emailIntentId,
      idempotencyKey: "stale-retry-key",
      now: new Date("2026-08-08T14:00:00.000Z"),
      sendEmail: async () => {
        markFirstSendStarted()
        await firstSendGate
        return { delivered: false }
      },
    })
    await firstSendStarted

    const recovered = await retryAdminEmailIntent({
      prismaClient: database,
      actorUserId: "user_actor",
      expectedTargetUserId: "user_target",
      intentId: emailIntentId,
      idempotencyKey: "fresh-retry-key",
      now: new Date("2026-08-08T14:06:00.000Z"),
      sendEmail: async () => ({ delivered: true }),
    })
    releaseFirstSend()
    const staleResult = await stale

    assert.deepEqual(recovered, { status: "DELIVERED", attemptCount: 3, replayed: false })
    assert.deepEqual(staleResult, {
      status: "AMBIGUOUS",
      attemptCount: 2,
      replayed: false,
      attempted: true,
    })
    assert.equal(database.intents[0].status, "DELIVERED")
    assert.equal(database.intents[0].attemptCount, 3)
    assert.equal(database.intents[0].deliveryClaimTokenHash, null)
    assert.equal(database.retryOperationKeys.length, 2)
    assert.equal(database.actions.some((action) => action.idempotencyKey === "fresh-retry-key"), true)
    assert.equal(database.actions.some((action) => action.idempotencyKey === "stale-retry-key"), false)
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
        expectedTargetUserId: "user_target",
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
        assert.equal(database.openTransactions, 0)
        // The production default sender opens the operational-limiter
        // transaction here; prove this seam is no longer nested.
        await database.$transaction(async () => undefined)
        sent.push(args)
        return { delivered: true }
      },
      randomBytesFn: () => Buffer.alloc(32, 7),
    })

    assert.deepEqual(sent, [["member@example.com", "Your MassageLab account security changed", "Your active sessions were revoked. Please sign in again."]])
    assert.deepEqual(result, { status: "DELIVERED", attemptCount: 1, attempted: true })
    assert.equal(database.intents[0].status, "DELIVERED")
    assert.equal(database.intents[0].attemptCount, 1)
    assert.equal(database.intents[0].lastAttemptAt.getTime(), when.getTime())
    assert.equal(database.intents[0].deliveredAt.getTime(), when.getTime())
    assert.equal(database.intents[0].failureCode, null)
    assert.equal(database.intents[0].deliveryClaimTokenHash, null)
    assert.equal(database.intents[0].deliveryClaimExpiresAt, null)
    assert.equal(database.intents[0].deliveryClaimOperationKeyHash, null)
    assert.ok(database.transactionOptions.some((options) => (
      JSON.stringify(options) === JSON.stringify(ADMIN_EMAIL_TRANSACTION_OPTIONS)
    )))
    assert.ok(ADMIN_EMAIL_TRANSACTION_OPTIONS.timeout < ACCOUNT_CHANGE_EMAIL_DELIVERY_BUDGET_MS)
  })

  it("returns BUSY without sending while an initial delivery claim is live", async () => {
    const database = createAdminDatabase()
    const { emailIntentId } = await recordAdminActionBundle(database, bundleInput())
    database.intents[0].attemptCount = 3
    database.intents[0].lastAttemptAt = new Date("2026-08-08T13:59:00.000Z")
    database.intents[0].deliveryClaimTokenHash = "a".repeat(64)
    database.intents[0].deliveryClaimExpiresAt = new Date("2026-08-08T14:04:00.000Z")
    let sends = 0

    const result = await deliverAdminEmailIntent({
      prismaClient: database,
      intentId: emailIntentId,
      now: new Date("2026-08-08T14:00:00.000Z"),
      sendEmail: async () => { sends += 1; return { delivered: true } },
    })

    assert.deepEqual(result, { status: "BUSY", attemptCount: 3, attempted: false })
    assert.equal(sends, 0)
    assert.equal(database.intents[0].deliveryClaimTokenHash, "a".repeat(64))
  })

  it("keeps a nonempty claim with missing or invalid expiry BUSY without sending", async () => {
    for (const [label, expiry] of [
      ["missing expiry", null],
      ["invalid expiry", new Date(Number.NaN)],
    ]) {
      const database = createAdminDatabase()
      const { emailIntentId } = await recordAdminActionBundle(database, bundleInput())
      database.intents[0].attemptCount = 3
      database.intents[0].lastAttemptAt = new Date("2026-08-08T13:59:00.000Z")
      database.intents[0].deliveryClaimTokenHash = "a".repeat(64)
      database.intents[0].deliveryClaimExpiresAt = expiry
      let sends = 0

      const result = await deliverAdminEmailIntent({
        prismaClient: database,
        intentId: emailIntentId,
        now: new Date("2026-08-08T14:00:00.000Z"),
        sendEmail: async () => { sends += 1; return { delivered: true } },
      })

      assert.deepEqual(result, { status: "BUSY", attemptCount: 3, attempted: false }, label)
      assert.equal(sends, 0, label)
      assert.equal(database.intents[0].deliveryClaimTokenHash, "a".repeat(64), label)
      assert.equal(database.intents[0].attemptCount, 3, label)
    }
  })

  it("keeps malformed expired initial-delivery claim tokens BUSY without sending", async () => {
    for (const [label, tokenHash] of [
      ["short token", "a".repeat(63)],
      ["uppercase token", "A".repeat(64)],
      ["nonhex token", "g".repeat(64)],
    ]) {
      const database = createAdminDatabase()
      const { emailIntentId } = await recordAdminActionBundle(database, bundleInput())
      database.intents[0].attemptCount = 3
      database.intents[0].lastAttemptAt = new Date("2026-08-08T13:49:00.000Z")
      database.intents[0].deliveryClaimTokenHash = tokenHash
      database.intents[0].deliveryClaimExpiresAt = new Date("2026-08-08T13:55:00.000Z")
      let sends = 0

      const result = await deliverAdminEmailIntent({
        prismaClient: database,
        intentId: emailIntentId,
        now: new Date("2026-08-08T14:00:00.000Z"),
        sendEmail: async () => { sends += 1; return { delivered: true } },
      })

      assert.deepEqual(result, { status: "BUSY", attemptCount: 3, attempted: false }, label)
      assert.equal(sends, 0, label)
      assert.equal(database.intents[0].deliveryClaimTokenHash, tokenHash, label)
      assert.equal(database.intents[0].attemptCount, 3, label)
    }
  })

  it("keeps malformed expired retry claim tokens BUSY without sending", async () => {
    for (const [label, tokenHash] of [
      ["short token", "a".repeat(63)],
      ["uppercase token", "A".repeat(64)],
      ["nonhex token", "g".repeat(64)],
    ]) {
      const database = createAdminDatabase()
      const { emailIntentId } = await recordAdminActionBundle(database, bundleInput())
      await deliverAdminEmailIntent({
        prismaClient: database,
        intentId: emailIntentId,
        sendEmail: async () => ({ delivered: false }),
      })
      database.intents[0].deliveryClaimTokenHash = tokenHash
      database.intents[0].deliveryClaimExpiresAt = new Date("2026-08-08T13:55:00.000Z")
      let sends = 0

      const result = await retryAdminEmailIntent({
        prismaClient: database,
        actorUserId: "user_actor",
        expectedTargetUserId: "user_target",
        intentId: emailIntentId,
        idempotencyKey: `malformed-expired-${label}`,
        now: new Date("2026-08-08T14:00:00.000Z"),
        sendEmail: async () => { sends += 1; return { delivered: true } },
      })

      assert.deepEqual(result, {
        status: "BUSY",
        attemptCount: 1,
        replayed: false,
        attempted: false,
      }, label)
      assert.equal(sends, 0, label)
      assert.equal(database.intents[0].deliveryClaimTokenHash, tokenHash, label)
      assert.equal(database.intents[0].attemptCount, 1, label)
      assert.equal(database.retryOperationKeys.length, 0, label)
    }
  })

  it("recovers an expired initial claim and clears the replacement lease on completion", async () => {
    const database = createAdminDatabase()
    const { emailIntentId } = await recordAdminActionBundle(database, bundleInput())
    database.intents[0].attemptCount = 1
    database.intents[0].lastAttemptAt = new Date("2026-08-08T13:50:00.000Z")
    database.intents[0].deliveryClaimTokenHash = "b".repeat(64)
    database.intents[0].deliveryClaimExpiresAt = new Date("2026-08-08T13:55:00.000Z")

    const result = await deliverAdminEmailIntent({
      prismaClient: database,
      intentId: emailIntentId,
      now: new Date("2026-08-08T14:00:00.000Z"),
      randomBytesFn: () => Buffer.alloc(32, 9),
      sendEmail: async () => ({ delivered: true }),
    })

    assert.deepEqual(result, { status: "DELIVERED", attemptCount: 2, attempted: true })
    assert.equal(database.intents[0].deliveryClaimTokenHash, null)
    assert.equal(database.intents[0].deliveryClaimExpiresAt, null)
  })

  it("reports AMBIGUOUS when a stale finalizer loses its exact claim", async () => {
    const database = createAdminDatabase()
    const { emailIntentId } = await recordAdminActionBundle(database, bundleInput())
    const replacementClaimHash = "c".repeat(64)

    const result = await deliverAdminEmailIntent({
      prismaClient: database,
      intentId: emailIntentId,
      now: new Date("2026-08-08T14:00:00.000Z"),
      randomBytesFn: () => Buffer.alloc(32, 11),
      sendEmail: async () => {
        database.intents[0].deliveryClaimTokenHash = replacementClaimHash
        database.intents[0].deliveryClaimExpiresAt = new Date("2026-08-08T14:10:00.000Z")
        return { delivered: true }
      },
    })

    assert.deepEqual(result, { status: "AMBIGUOUS", attemptCount: 1, attempted: true })
    assert.equal(database.intents[0].status, "PENDING")
    assert.equal(database.intents[0].deliveryClaimTokenHash, replacementClaimHash)
  })

  it("lets a live initial claim make a concurrent retry BUSY with only one send", async () => {
    const database = createAdminDatabase()
    const { emailIntentId } = await recordAdminActionBundle(database, bundleInput())
    let releaseSend
    let markStarted
    const sendGate = new Promise((resolve) => { releaseSend = resolve })
    const sendStarted = new Promise((resolve) => { markStarted = resolve })
    let sends = 0
    const initial = deliverAdminEmailIntent({
      prismaClient: database,
      intentId: emailIntentId,
      sendEmail: async () => {
        sends += 1
        markStarted()
        await sendGate
        return { delivered: true }
      },
    })
    await sendStarted

    const retry = retryAdminEmailIntent({
      prismaClient: database,
      actorUserId: "user_actor",
      expectedTargetUserId: "user_target",
      intentId: emailIntentId,
      idempotencyKey: "concurrent-initial-retry",
      sendEmail: async () => { sends += 1; return { delivered: true } },
    })
    let timeoutId
    let retryResult
    let initialResult
    try {
      retryResult = await Promise.race([
        retry,
        new Promise((_resolve, reject) => {
          timeoutId = setTimeout(() => reject(new Error("Concurrent retry did not settle within 50ms.")), 50)
        }),
      ])
    } finally {
      clearTimeout(timeoutId)
      releaseSend()
      initialResult = await initial
    }

    assert.deepEqual(retryResult, {
      status: "BUSY",
      attemptCount: 1,
      attempted: false,
      replayed: false,
    })
    assert.deepEqual(initialResult, { status: "DELIVERED", attemptCount: 1, attempted: true })
    assert.equal(sends, 1)
  })

  it("reports a missing notification intent without a fake projection failure", async () => {
    const database = createAdminDatabase()
    await assert.rejects(
      () => deliverAdminEmailIntent({ prismaClient: database, intentId: "missing-intent" }),
      { message: "Email notification intent was not found." },
    )
  })

  it("keeps provider failure details out of durable failures", async () => {
    for (const [sendEmail, expectedLogs] of [
      [async () => ({ delivered: false }), []],
      [async () => { throw new Error("provider said recipient is suppressed") }, ["Account-change email delivery failed"]],
    ]) {
      const database = createAdminDatabase()
      const { emailIntentId } = await recordAdminActionBundle(database, bundleInput())
      const logs = []
      const originalError = console.error
      console.error = (message) => logs.push(message)
      let result
      try {
        result = await deliverAdminEmailIntent({ prismaClient: database, intentId: emailIntentId, sendEmail })
      } finally {
        console.error = originalError
      }

      assert.deepEqual(result, { status: "FAILED", attemptCount: 1, attempted: true })
      assert.equal(database.intents[0].status, "FAILED")
      assert.equal(database.intents[0].failureCode, "DELIVERY_FAILED")
      assert.doesNotMatch(JSON.stringify(database.intents[0]), /suppressed|provider said/i)
      assert.deepEqual(logs, expectedLogs)
      assert.doesNotMatch(logs.join(" "), /suppressed|provider said/i)
    }
  })

  it("initial delivery attempts only pending intents and never resends failed or delivered outcomes", async () => {
    const database = createAdminDatabase()
    const delivered = await recordAdminActionBundle(database, bundleInput())
    database.intents[0].status = "DELIVERED"
    database.intents[0].attemptCount = 4
    const failed = await recordAdminActionBundle(database, {
      ...bundleInput(),
      idempotencyKey: "failed-initial-delivery",
    })
    database.intents[1].status = "FAILED"
    database.intents[1].attemptCount = 1
    database.intents[1].lastAttemptAt = new Date("2026-08-08T14:00:00.000Z")
    database.intents[1].failureCode = "DELIVERY_FAILED"
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
    assert.deepEqual(await deliverAdminEmailIntent({ prismaClient: database, intentId: failed.emailIntentId, sendEmail }), {
      status: "FAILED", attemptCount: 1, attempted: false,
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
      () => retryAdminEmailIntent({ prismaClient: database, actorUserId: "user_actor", expectedTargetUserId: "user_target", intentId: emailIntentId, idempotencyKey: "retry-1" }),
      /Full administration requires verified database authority/,
    )

    database.adminRoles = [{ role: "ADMIN", status: "VERIFIED" }]
    await deliverAdminEmailIntent({
      prismaClient: database,
      intentId: emailIntentId,
      sendEmail: async () => ({ delivered: false }),
    })
    let calls = 0
    const first = await retryAdminEmailIntent({
      prismaClient: database,
      actorUserId: "user_actor",
      expectedTargetUserId: "user_target",
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
      expectedTargetUserId: "user_target",
      intentId: emailIntentId,
      idempotencyKey: "retry-1",
      sendEmail: async () => {
        calls += 1
        return { delivered: true }
      },
    })

    assert.deepEqual(first, { status: "DELIVERED", attemptCount: 2, replayed: false })
    assert.deepEqual(replayed, { status: "DELIVERED", attemptCount: 2, replayed: true })
    assert.deepEqual(database.transactionOptions.at(-1), ADMIN_EMAIL_TRANSACTION_OPTIONS)
    assert.equal(calls, 1)
    assert.equal(database.actions.length, 2)
    assert.equal(database.activities.length, 1)
    assert.equal(database.intents.length, 1)
    const retryAction = database.actions[1]
    assert.equal(retryAction.actionKind, "EMAIL_NOTIFICATION_RETRIED")
    assert.equal(retryAction.outcome, "SUCCEEDED")
    assert.deepEqual(retryAction.beforeState, { emailIntentId, status: "FAILED", attemptCount: 1 })
    assert.deepEqual(retryAction.afterState, { emailIntentId, status: "DELIVERED", attemptCount: 2 })
  })

  it("rejects a retry whose locked intent belongs to a different route target before transport", async () => {
    const database = createAdminDatabase()
    const { emailIntentId } = await recordAdminActionBundle(database, bundleInput())
    let sends = 0

    await assert.rejects(
      () => retryAdminEmailIntent({
        prismaClient: database,
        actorUserId: "user_actor",
        expectedTargetUserId: "different_route_target",
        intentId: emailIntentId,
        idempotencyKey: "wrong-route-target",
        sendEmail: async () => {
          sends += 1
          return { delivered: true }
        },
      }),
      /target account/i,
    )

    assert.equal(sends, 0)
    assert.equal(database.intents[0].attemptCount, 0)
    assert.equal(database.actions.length, 1)
  })

  it("records a failed retry outcome without exposing provider errors", async () => {
    const database = createAdminDatabase()
    const { emailIntentId } = await recordAdminActionBundle(database, bundleInput())
    await deliverAdminEmailIntent({
      prismaClient: database,
      intentId: emailIntentId,
      sendEmail: async () => ({ delivered: false }),
    })
    const result = await retryAdminEmailIntent({
      prismaClient: database,
      actorUserId: "user_actor",
      expectedTargetUserId: "user_target",
      intentId: emailIntentId,
      idempotencyKey: "retry-failure",
      sendEmail: async () => { throw new Error("sensitive provider payload") },
    })

    assert.deepEqual(result, { status: "FAILED", attemptCount: 2, replayed: false })
    assert.equal(database.actions.at(-1).outcome, "FAILED")
    assert.equal(database.actions.at(-1).failureCode, "DELIVERY_FAILED")
    assert.doesNotMatch(JSON.stringify(database.actions.at(-1)), /sensitive provider payload/)
  })

  it("retries a coherent failed delivery and audits the second successful attempt", async () => {
    const database = createAdminDatabase()
    const { emailIntentId } = await recordAdminActionBundle(database, bundleInput())
    await deliverAdminEmailIntent({
      prismaClient: database,
      intentId: emailIntentId,
      sendEmail: async () => ({ delivered: false, providerDiagnostic: "do-not-store" }),
    })

    const result = await retryAdminEmailIntent({
      prismaClient: database,
      actorUserId: "user_actor",
      expectedTargetUserId: "user_target",
      intentId: emailIntentId,
      idempotencyKey: "retry-after-delivery-failure",
      sendEmail: async () => ({ delivered: true, providerDiagnostic: "still-do-not-store" }),
    })

    assert.deepEqual(result, { status: "DELIVERED", attemptCount: 2, replayed: false })
    assert.equal(database.intents[0].status, "DELIVERED")
    assert.equal(database.intents[0].attemptCount, 2)
    assert.equal(database.intents[0].failureCode, null)
    const retryAction = database.actions.at(-1)
    assert.equal(retryAction.outcome, "SUCCEEDED")
    assert.equal(retryAction.failureCode, null)
    assert.deepEqual(retryAction.beforeState, { emailIntentId, status: "FAILED", attemptCount: 1 })
    assert.deepEqual(retryAction.afterState, { emailIntentId, status: "DELIVERED", attemptCount: 2 })
    assert.doesNotMatch(JSON.stringify({ intent: database.intents[0], action: retryAction }), /do-not-store/)
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
      await deliverAdminEmailIntent({
        prismaClient: database,
        intentId: emailIntentId,
        sendEmail: async () => ({ delivered: false }),
      })
      await retryAdminEmailIntent({
        prismaClient: database,
        actorUserId: "user_actor",
        expectedTargetUserId: "user_target",
        intentId: emailIntentId,
        idempotencyKey: "historical-retry",
        sendEmail: async () => ({ delivered: true }),
      })
      mutateRetryAction({ database, action: database.actions.at(-1) })

      await assert.rejects(
        () => retryAdminEmailIntent({
          prismaClient: database,
          actorUserId: "user_actor",
          expectedTargetUserId: "user_target",
          intentId: emailIntentId,
          idempotencyKey: "historical-retry",
        }),
        /(incomplete|already in use)/,
      )
    }
  })

  it("rejects a historical retry replay whose before state was PENDING without sending", async () => {
    const database = createAdminDatabase()
    const { emailIntentId } = await recordAdminActionBundle(database, bundleInput())
    await deliverAdminEmailIntent({
      prismaClient: database,
      intentId: emailIntentId,
      sendEmail: async () => ({ delivered: false }),
    })
    await retryAdminEmailIntent({
      prismaClient: database,
      actorUserId: "user_actor",
      expectedTargetUserId: "user_target",
      intentId: emailIntentId,
      idempotencyKey: "pending-before-state-replay",
      sendEmail: async () => ({ delivered: true }),
    })
    const retryAction = database.actions.at(-1)
    retryAction.beforeState = { ...retryAction.beforeState, status: "PENDING" }
    let sends = 0

    await assert.rejects(
      () => retryAdminEmailIntent({
        prismaClient: database,
        actorUserId: "user_actor",
        expectedTargetUserId: "user_target",
        intentId: emailIntentId,
        idempotencyKey: "pending-before-state-replay",
        sendEmail: async () => { sends += 1; return { delivered: true } },
      }),
      { message: "The existing retry record is incomplete." },
    )
    assert.equal(sends, 0)
    assert.equal(database.intents[0].status, "DELIVERED")
    assert.equal(database.actions.length, 2)
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
      () => retryAdminEmailIntent({ prismaClient: database, actorUserId: "user_actor", expectedTargetUserId: "user_target", intentId: emailIntentId, idempotencyKey: "password-retry", sendEmail }),
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
    await deliverAdminEmailIntent({
      prismaClient: database,
      intentId: first.emailIntentId,
      sendEmail: async () => ({ delivered: false }),
    })
    await retryAdminEmailIntent({
      prismaClient: database,
      actorUserId: "user_actor",
      expectedTargetUserId: "user_target",
      intentId: first.emailIntentId,
      idempotencyKey: "shared-retry-key",
      sendEmail: async () => ({ delivered: true }),
    })
    await assert.rejects(
      () => retryAdminEmailIntent({ prismaClient: database, actorUserId: "user_actor", expectedTargetUserId: "user_target", intentId: second.emailIntentId, idempotencyKey: "shared-retry-key" }),
      /incomplete/,
    )
    await assert.rejects(
      () => retryAdminEmailIntent({ prismaClient: database, actorUserId: "user_actor", expectedTargetUserId: "user_target", intentId: first.emailIntentId, idempotencyKey: "delivered-new-key" }),
      /cannot be retried/,
    )
    assert.equal(database.actions.length, 3)
  })

  it("serializes concurrent direct delivery and concurrent submissions from the same rendered retry form key", async () => {
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
    assert.deepEqual(directResults.map((result) => result.status), ["DELIVERED", "BUSY"])
    assert.equal(directDatabase.intents[0].attemptCount, 1)

    const retryDatabase = createAdminDatabase()
    const retry = await recordAdminActionBundle(retryDatabase, bundleInput())
    await deliverAdminEmailIntent({
      prismaClient: retryDatabase,
      intentId: retry.emailIntentId,
      sendEmail: async () => ({ delivered: false }),
    })
    let retryCalls = 0
    const retryResults = await Promise.all([
      retryAdminEmailIntent({
        prismaClient: retryDatabase,
        actorUserId: "user_actor",
        expectedTargetUserId: "user_target",
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
        expectedTargetUserId: "user_target",
        intentId: retry.emailIntentId,
        idempotencyKey: "concurrent-retry",
        sendEmail: async () => {
          retryCalls += 1
          return { delivered: false }
        },
      }),
    ])
    assert.equal(retryCalls, 1)
    assert.deepEqual(retryResults.map((result) => result.replayed), [false, false])
    assert.equal(retryDatabase.actions.length, 2)

    const differentIntentDatabase = createAdminDatabase()
    const firstIntent = await recordAdminActionBundle(differentIntentDatabase, bundleInput())
    const secondIntent = await recordAdminActionBundle(differentIntentDatabase, {
      ...bundleInput(),
      idempotencyKey: "different-intent-operation",
    })
    await deliverAdminEmailIntent({
      prismaClient: differentIntentDatabase,
      intentId: firstIntent.emailIntentId,
      sendEmail: async () => ({ delivered: false }),
    })
    await deliverAdminEmailIntent({
      prismaClient: differentIntentDatabase,
      intentId: secondIntent.emailIntentId,
      sendEmail: async () => ({ delivered: false }),
    })
    let differentIntentCalls = 0
    const differentIntentResults = await Promise.allSettled([
      retryAdminEmailIntent({
        prismaClient: differentIntentDatabase,
        actorUserId: "user_actor",
        expectedTargetUserId: "user_target",
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
        expectedTargetUserId: "user_target",
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
    assert.match(differentIntentResults.find((result) => result.status === "rejected").reason.message, /already in use/)

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
        expectedTargetUserId: "user_target",
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
    _state: {
      actions: [],
      activities: [],
      intents: [],
      retryOperationKeys: [],
      adminRoles: [{ role: "ADMIN", status: "VERIFIED" }],
    },
    heldAdvisoryLocks: new Set(),
    advisoryWaiters: new Map(),
    failNextActivityCreate: false,
    failNextIntentCreate: false,
    failNextActionCreate: false,
    transactionOptions: [],
    openTransactions: 0,
  }
  return makeFakeClient(root)
}

/** Each fake transaction receives an isolated snapshot and commits only on success. */
function makeFakeClient(root, transactionState = null) {
  const state = () => transactionState?.value ?? root._state
  const client = {}
  for (const field of ["actions", "activities", "intents", "retryOperationKeys", "adminRoles"]) {
    Object.defineProperty(client, field, { get: () => state()[field], set: (value) => { state()[field] = value } })
  }
  for (const field of ["failNextActivityCreate", "failNextIntentCreate", "failNextActionCreate"]) {
    Object.defineProperty(client, field, { get: () => root[field], set: (value) => { root[field] = value } })
  }
  Object.defineProperty(client, "transactionOptions", { get: () => root.transactionOptions })
  Object.defineProperty(client, "openTransactions", { get: () => root.openTransactions })
  const project = (record, select) => record == null || !select
    ? record
    : Object.fromEntries(Object.keys(select).filter((key) => select[key]).map((key) => [key, record[key]]))
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
    findFirst: async ({ where, select }) => project(
      state().intents.find((intent) => matchesIntentWhere(intent, where)) ?? null,
      select,
    ),
    create: async ({ data, select }) => {
      if (root.failNextIntentCreate) { root.failNextIntentCreate = false; throw new Error("intent create failed") }
      const intent = {
        id: `intent_${state().intents.length + 1}`,
        ...data,
        attemptCount: 0,
        lastAttemptAt: null,
        deliveredAt: null,
        deliveryClaimTokenHash: null,
        deliveryClaimExpiresAt: null,
        deliveryClaimOperationKeyHash: null,
      }
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
    updateMany: async ({ where, data }) => {
      const matches = state().intents.filter((intent) => matchesIntentWhere(intent, where))
      for (const intent of matches) {
        if (typeof data.deliveryClaimOperationKeyHash === "string"
          && state().intents.some((candidate) => (
            candidate.id !== intent.id
            && candidate.deliveryClaimOperationKeyHash === data.deliveryClaimOperationKeyHash
          ))) {
          throw Object.assign(new Error("unique retry operation claim"), { code: "P2002" })
        }
        const increment = data.attemptCount?.increment ?? 0
        Object.assign(intent, data, { attemptCount: intent.attemptCount + increment })
      }
      if (matches.length > 0) client._hasMutations = true
      return { count: matches.length }
    },
  }
  client.adminEmailRetryOperationKey = {
    findUnique: async ({ where, select }) => project(
      state().retryOperationKeys.find((row) => row.operationKeyHash === where.operationKeyHash) ?? null,
      select,
    ),
    create: async ({ data, select }) => {
      if (state().retryOperationKeys.some((row) => row.operationKeyHash === data.operationKeyHash)) {
        throw Object.assign(new Error("unique retry operation key owner"), { code: "P2002" })
      }
      const row = {
        id: `retry_operation_key_${state().retryOperationKeys.length + 1}`,
        createdAt: new Date(),
        ...structuredClone(data),
      }
      state().retryOperationKeys.push(row)
      client._hasMutations = true
      return project(row, select)
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
    client.$transaction = async (callback, options) => {
      root.transactionOptions.push(options)
      const snapshot = { value: structuredClone(root._state) }
      const tx = makeFakeClient(root, snapshot)
      tx._heldByTransaction = []
      root.openTransactions += 1
      try {
        const result = await callback(tx)
        // The fake commits last-writer-wins; advisory locks serialize covered paths.
        root._state = snapshot.value
        return result
      } finally {
        root.openTransactions -= 1
        for (const key of tx._heldByTransaction.reverse()) releaseFakeAdvisoryLock(root, key)
      }
    }
  }
  return client
}

/** Matches the exact scalar, set-membership, lease, and boolean predicates used by claim CAS. */
function matchesIntentWhere(intent, where) {
  if (!where || typeof where !== "object") return true
  if (Array.isArray(where.AND) && !where.AND.every((entry) => matchesIntentWhere(intent, entry))) return false
  if (Array.isArray(where.OR) && !where.OR.some((entry) => matchesIntentWhere(intent, entry))) return false

  for (const [field, expected] of Object.entries(where)) {
    if (field === "AND" || field === "OR") continue
    const actual = intent[field]
    if (expected && typeof expected === "object" && !Array.isArray(expected) && !(expected instanceof Date)) {
      if (Object.keys(expected).some((operator) => !["in", "not", "lt"].includes(operator))) return false
      if (Object.hasOwn(expected, "in") && !expected.in.includes(actual)) return false
      if (Object.hasOwn(expected, "not") && actual === expected.not) return false
      if (Object.hasOwn(expected, "lt") && !(actual instanceof Date && actual < expected.lt)) return false
      continue
    }
    if (actual !== expected) return false
  }
  return true
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
