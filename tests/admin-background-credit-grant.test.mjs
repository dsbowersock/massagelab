import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { grantAdminBackgroundCredits } from "../lib/commerce/credit-service.ts"

const OPERATION_KEY = "admin-background-credit-grant-1"

function user(id, {
  email = `${id}@example.com`,
  emailVerified = true,
  roles = [{ role: "USER", status: "VERIFIED" }],
} = {}) {
  return {
    id,
    name: id,
    email,
    emailVerified: emailVerified ? new Date("2026-08-10T12:00:00.000Z") : null,
    roles,
  }
}

function initialEntry(userId, walletId) {
  return {
    id: `initial-${userId}`,
    walletId,
    userId,
    type: "INITIAL_GRANT",
    delta: 2,
    balanceAfter: 2,
    idempotencyKey: `background-credit:initial-grant:${userId}`,
    reasonCode: "VERIFIED_ACCOUNT_INITIAL_GRANT",
  }
}

function createGrantDatabase({ withoutTargetWallet = false, conflictOnce = false, failWrite = null } = {}) {
  const users = [
    user("actor-admin", { roles: [{ role: "ADMIN", status: "VERIFIED" }] }),
    user("actor-admin-two", { roles: [{ role: "ADMIN", status: "VERIFIED" }] }),
    user("actor-ordinary"),
    user("actor-session-only", { roles: [] }),
    user("actor-reviewer", { roles: [{ role: "ANATOMY_REVIEWER", status: "VERIFIED" }] }),
    user("actor-editor", { roles: [{ role: "ANATOMY_EDITOR", status: "VERIFIED" }] }),
    user("target-user"),
    user("target-two"),
    user("target-unverified", { emailVerified: false }),
    user("target-no-email", { email: null }),
    user("target-blank-email", { email: "   " }),
  ]
  const state = {
    users: new Map(users.map((record) => [record.id, record])),
    wallets: new Map(),
    entries: new Map(),
    events: [],
    actions: new Map(),
    activities: new Map(),
    intents: new Map(),
    nextWalletId: 1,
    transactionAttempts: 0,
  }
  let shouldConflict = conflictOnce

  for (const userId of ["target-user", "target-two", "target-unverified"]) {
    if (withoutTargetWallet && userId === "target-user") continue
    const wallet = { id: `wallet-${userId}`, userId, balance: 2, version: 0 }
    state.wallets.set(userId, wallet)
    state.entries.set(`background-credit:initial-grant:${userId}`, initialEntry(userId, wallet.id))
  }

  function relationAction(action) {
    if (!action) return null
    return {
      ...structuredClone(action),
      activity: structuredClone(state.activities.get(action.id) ?? null),
      emailIntent: structuredClone(state.intents.get(action.id) ?? null),
    }
  }

  function transactionClient() {
    return {
      async $executeRaw() {
        return 1
      },
      user: {
        async findUnique({ where }) {
          const record = state.users.get(where.id)
          return record ? structuredClone(record) : null
        },
      },
      backgroundCreditWallet: {
        async findUnique({ where }) {
          const wallet = where.userId
            ? state.wallets.get(where.userId)
            : [...state.wallets.values()].find((candidate) => candidate.id === where.id)
          return wallet ? { ...wallet } : null
        },
        async create({ data }) {
          if (failWrite === "wallet") throw new Error("wallet write failed")
          const wallet = { id: `wallet-${state.nextWalletId++}`, userId: data.userId, balance: data.balance, version: 0 }
          state.wallets.set(data.userId, wallet)
          return { ...wallet }
        },
        async updateMany({ where, data }) {
          if (failWrite === "wallet") throw new Error("wallet write failed")
          if (shouldConflict) {
            shouldConflict = false
            return { count: 0 }
          }
          const wallet = [...state.wallets.values()].find((candidate) => candidate.id === where.id)
          if (
            !wallet
            || wallet.userId !== where.userId
            || wallet.balance !== where.balance
            || wallet.version !== where.version
          ) {
            return { count: 0 }
          }
          wallet.balance += data.balance.increment
          wallet.version += data.version.increment
          return { count: 1 }
        },
      },
      backgroundCreditEntry: {
        async findUnique({ where }) {
          return structuredClone(state.entries.get(where.idempotencyKey) ?? null)
        },
        async create({ data }) {
          if (failWrite === "entry") throw new Error("entry write failed")
          if (state.entries.has(data.idempotencyKey)) throw new Error("duplicate ledger entry")
          const entry = { id: `entry-${state.entries.size + 1}`, ...structuredClone(data) }
          state.entries.set(data.idempotencyKey, entry)
          return structuredClone(entry)
        },
      },
      commerceEvent: {
        async create({ data }) {
          if (failWrite === "event") throw new Error("event write failed")
          const event = { id: `event-${state.events.length + 1}`, ...structuredClone(data) }
          state.events.push(event)
          return structuredClone(event)
        },
      },
      adminAction: {
        async findUnique({ where }) {
          return relationAction(state.actions.get(where.idempotencyKey))
        },
        async create({ data }) {
          if (failWrite === "action") throw new Error("action write failed")
          const action = {
            id: `action-${state.actions.size + 1}`,
            ...structuredClone(data),
            occurredAt: new Date("2026-08-10T12:00:00.000Z"),
            createdAt: new Date("2026-08-10T12:00:00.000Z"),
          }
          state.actions.set(data.idempotencyKey, action)
          return { id: action.id }
        },
      },
      userAccountActivity: {
        async create({ data }) {
          if (failWrite === "activity") throw new Error("activity write failed")
          const activity = { id: `activity-${state.activities.size + 1}`, ...structuredClone(data) }
          state.activities.set(data.adminActionId, activity)
          return structuredClone(activity)
        },
      },
      adminEmailIntent: {
        async create({ data }) {
          if (failWrite === "intent") throw new Error("intent write failed")
          const intent = {
            id: `intent-${state.intents.size + 1}`,
            ...structuredClone(data),
            attemptCount: 0,
            lastAttemptAt: null,
            deliveredAt: null,
          }
          state.intents.set(data.adminActionId, intent)
          return { id: intent.id }
        },
      },
    }
  }

  const database = {
    state,
    async $transaction(callback, options) {
      state.transactionAttempts += 1
      assert.equal(options?.isolationLevel, "Serializable")
      const snapshot = structuredClone(state)
      try {
        return await callback(transactionClient())
      } catch (error) {
        for (const key of ["users", "wallets", "entries", "events", "actions", "activities", "intents", "nextWalletId"]) {
          state[key] = snapshot[key]
        }
        throw error
      }
    },
  }

  return database
}

function grant(database, overrides = {}) {
  return grantAdminBackgroundCredits({
    prismaClient: database,
    actorUserId: "actor-admin",
    targetUserId: "target-user",
    amount: 5,
    expectedBalance: 2,
    reasonCode: "BACKGROUND_CREDIT_GOODWILL",
    internalNote: "Courtesy credit after a support review.",
    idempotencyKey: OPERATION_KEY,
    ...overrides,
  })
}

function mutableCounts(state) {
  return {
    wallet: structuredClone(state.wallets.get("target-user")),
    entries: state.entries.size,
    events: state.events.length,
    actions: state.actions.size,
    activities: state.activities.size,
    intents: state.intents.size,
  }
}

describe("Admin background-credit grant", () => {
  it("adds five credits to a prepared balance of two with one immutable ledger/event/evidence bundle", async () => {
    const database = createGrantDatabase()

    const result = await grant(database)

    assert.deepEqual(result, {
      previousBalance: 2,
      amount: 5,
      balanceAfter: 7,
      replayed: false,
      emailIntentId: "intent-1",
    })
    assert.deepEqual(database.state.wallets.get("target-user"), {
      id: "wallet-target-user", userId: "target-user", balance: 7, version: 1,
    })
    const entry = database.state.entries.get(OPERATION_KEY)
    assert.deepEqual({
      walletId: entry.walletId,
      userId: entry.userId,
      type: entry.type,
      delta: entry.delta,
      balanceAfter: entry.balanceAfter,
      idempotencyKey: entry.idempotencyKey,
      reasonCode: entry.reasonCode,
    }, {
      walletId: "wallet-target-user",
      userId: "target-user",
      type: "ADMIN_CORRECTION",
      delta: 5,
      balanceAfter: 7,
      idempotencyKey: OPERATION_KEY,
      reasonCode: "BACKGROUND_CREDIT_GOODWILL",
    })
    assert.equal(database.state.events.length, 1)
    assert.deepEqual(database.state.events[0], {
      id: "event-1",
      userId: "target-user",
      eventType: "BACKGROUND_CREDITS_ADMIN_GRANTED",
      source: "admin",
      actorType: "ADMIN",
      actorId: "actor-admin",
      reasonCode: "BACKGROUND_CREDIT_GOODWILL",
      aggregateType: "BackgroundCreditWallet",
      aggregateId: "wallet-target-user",
      fromState: "2",
      toState: "7",
      payload: { amount: 5 },
    })
    const action = database.state.actions.get(OPERATION_KEY)
    assert.equal(action.actionKind, "BACKGROUND_CREDITS_ADMIN_GRANTED")
    assert.deepEqual(action.beforeState, { preparedBalance: 2, balance: 2, amount: 5 })
    assert.deepEqual(action.afterState, { preparedBalance: 2, balance: 7, amount: 5 })
    assert.equal(database.state.activities.get(action.id).effectiveValue, "+5 credits")
    const intent = database.state.intents.get(action.id)
    assert.equal(intent.userId, "target-user")
    assert.equal(intent.status, "PENDING")
    assert.equal(intent.recipientEmail, "target-user@example.com")
  })

  it("provisions the canonical verified-account wallet before applying the Admin grant", async () => {
    const database = createGrantDatabase({ withoutTargetWallet: true })

    const created = await grant(database, { expectedBalance: 0 })
    assert.deepEqual(created, {
      previousBalance: 2, amount: 5, balanceAfter: 7, replayed: false, emailIntentId: "intent-1",
    })
    assert.equal(database.state.wallets.get("target-user").balance, 7)
    assert.deepEqual({
      type: database.state.entries.get("background-credit:initial-grant:target-user").type,
      delta: database.state.entries.get("background-credit:initial-grant:target-user").delta,
      balanceAfter: database.state.entries.get("background-credit:initial-grant:target-user").balanceAfter,
    }, { type: "INITIAL_GRANT", delta: 2, balanceAfter: 2 })
    assert.deepEqual({
      type: database.state.entries.get(OPERATION_KEY).type,
      delta: database.state.entries.get(OPERATION_KEY).delta,
      balanceAfter: database.state.entries.get(OPERATION_KEY).balanceAfter,
    }, { type: "ADMIN_CORRECTION", delta: 5, balanceAfter: 7 })
    assert.deepEqual(database.state.events.map((event) => event.eventType), [
      "BACKGROUND_CREDITS_INITIAL_GRANTED",
      "BACKGROUND_CREDITS_ADMIN_GRANTED",
    ])
    assert.equal(database.state.actions.size, 1)
    assert.equal(database.state.activities.size, 1)
    assert.equal(database.state.intents.size, 1)
    assert.deepEqual(database.state.actions.get(OPERATION_KEY).beforeState, {
      preparedBalance: 0, balance: 2, amount: 5,
    })
    assert.deepEqual(await grant(database, { expectedBalance: 0 }), { ...created, replayed: true })
    assert.equal(database.state.entries.size, 4)
    assert.equal(database.state.events.length, 2)
    assert.equal(database.state.actions.size, 1)
  })

  it("rolls back canonical provisioning and the Admin grant together after a late bundle failure", async () => {
    const database = createGrantDatabase({ withoutTargetWallet: true, failWrite: "intent" })
    const before = mutableCounts(database.state)

    await assert.rejects(
      () => grant(database, { expectedBalance: 0 }),
      /intent write failed/,
    )
    assert.deepEqual(mutableCounts(database.state), before)
    assert.equal(database.state.wallets.has("target-user"), false)
    assert.equal(database.state.entries.has("background-credit:initial-grant:target-user"), false)
  })

  it("reloads verified full-Admin authority and denies session-only, ordinary, and Anatomy roles", async () => {
    for (const actorUserId of ["actor-session-only", "actor-ordinary", "actor-reviewer", "actor-editor"]) {
      const database = createGrantDatabase()
      await assert.rejects(() => grant(database, { actorUserId }), /Full administration requires verified database authority/)
      assert.deepEqual(mutableCounts(database.state), {
        wallet: { id: "wallet-target-user", userId: "target-user", balance: 2, version: 0 },
        entries: 3, events: 0, actions: 0, activities: 0, intents: 0,
      })
    }
  })

  it("requires a freshly verified target account", async () => {
    const database = createGrantDatabase()

    await assert.rejects(
      () => grant(database, { targetUserId: "target-unverified" }),
      /verified target account/i,
    )
    assert.equal(database.state.wallets.get("target-unverified").balance, 2)
    assert.equal(database.state.actions.size, 0)
  })

  it("rejects a verified timestamp with a missing or blank email before provisioning", async () => {
    for (const targetUserId of ["target-no-email", "target-blank-email"]) {
      const database = createGrantDatabase()
      const before = mutableCounts(database.state)

      await assert.rejects(
        () => grant(database, { targetUserId }),
        /verified target account with an email/i,
      )
      assert.deepEqual(mutableCounts(database.state), before)
      assert.equal(database.state.wallets.has(targetUserId), false)
      assert.equal(database.state.entries.has(`background-credit:initial-grant:${targetUserId}`), false)
    }
  })

  it("validates a positive integer amount from one through twenty-five before opening a transaction", async () => {
    for (const amount of [0, -1, 0.5, 26]) {
      const database = createGrantDatabase()
      await assert.rejects(() => grant(database, { amount }), /whole number from 1 through 25/i)
      assert.equal(database.state.transactionAttempts, 0)
    }
  })

  it("validates a nonnegative safe-integer prepared balance and the shared reason/note contract", async () => {
    for (const expectedBalance of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1]) {
      const database = createGrantDatabase()
      await assert.rejects(() => grant(database, { expectedBalance }), /valid prepared balance/i)
      assert.equal(database.state.transactionAttempts, 0)
    }

    for (const overrides of [
      { reasonCode: "UNSUPPORTED" },
      { reasonCode: "OTHER", internalNote: "   " },
      { internalNote: "x".repeat(501) },
    ]) {
      const database = createGrantDatabase()
      await assert.rejects(() => grant(database, overrides), /support reason|internal note|Other requires/i)
      assert.equal(database.state.transactionAttempts, 0)
    }
  })

  it("rejects a stale prepared balance without mutating the wallet or evidence", async () => {
    const database = createGrantDatabase()

    await assert.rejects(() => grant(database, { expectedBalance: 1 }), /balance changed since this grant was prepared/i)
    assert.deepEqual(mutableCounts(database.state), {
      wallet: { id: "wallet-target-user", userId: "target-user", balance: 2, version: 0 },
      entries: 3, events: 0, actions: 0, activities: 0, intents: 0,
    })
  })

  it("restarts the whole serializable transaction after an optimistic version conflict", async () => {
    const database = createGrantDatabase({ conflictOnce: true })

    assert.equal((await grant(database)).balanceAfter, 7)
    assert.equal(database.state.transactionAttempts, 2)
    assert.equal(database.state.wallets.get("target-user").version, 1)
    assert.equal(database.state.entries.has(OPERATION_KEY), true)
    assert.equal(database.state.events.length, 1)
    assert.equal(database.state.actions.size, 1)
  })

  it("returns the original result for an exact duplicate without a second mutation or evidence record", async () => {
    const database = createGrantDatabase()

    const created = await grant(database)
    const replayed = await grant(database)

    assert.deepEqual(replayed, { ...created, replayed: true })
    assert.deepEqual(mutableCounts(database.state), {
      wallet: { id: "wallet-target-user", userId: "target-user", balance: 7, version: 1 },
      entries: 4, events: 1, actions: 1, activities: 1, intents: 1,
    })
  })

  it("fails closed when the same operation key changes any immutable grant input", async () => {
    for (const mismatch of [
      { actorUserId: "actor-admin-two" },
      { targetUserId: "target-two" },
      { amount: 6 },
      { expectedBalance: 1 },
      { reasonCode: "ADMIN_CORRECTION" },
      { internalNote: "Different immutable note." },
    ]) {
      const database = createGrantDatabase()
      await grant(database)
      await assert.rejects(() => grant(database, mismatch), /administrative operation key is already in use/i)
      assert.equal(database.state.wallets.get("target-user").balance, 7)
      assert.equal(database.state.wallets.get("target-two").balance, 2)
      assert.equal(database.state.entries.size, 4)
      assert.equal(database.state.events.length, 1)
      assert.equal(database.state.actions.size, 1)
    }
  })

  it("rolls back every grant write when the wallet, entry, event, action, activity, or intent write fails", async () => {
    for (const failWrite of ["wallet", "entry", "event", "action", "activity", "intent"]) {
      const database = createGrantDatabase({ failWrite })
      const before = mutableCounts(database.state)

      await assert.rejects(() => grant(database), new RegExp(`${failWrite} write failed`))
      assert.deepEqual(mutableCounts(database.state), before, `${failWrite} failure must roll back`)
    }
  })
})
