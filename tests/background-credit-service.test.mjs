import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import {
  INITIAL_BACKGROUND_CREDIT_COUNT,
  ensureVerifiedUserBackgroundCredits,
} from "../lib/commerce/credit-service.ts"

function createCreditDatabase(
  users,
  { walletCreateConflictOnce = false, entryCreateConflictOnce = false, eventCreateConflictOnce = false } = {},
) {
  const state = {
    users: new Map(users.map((user) => [user.id, { ...user }])),
    wallets: new Map(),
    entries: new Map(),
    events: [],
    nextWalletId: 1,
  }
  let transactionTail = Promise.resolve()
  let transactionAttempts = 0
  let shouldConflictOnWalletCreate = walletCreateConflictOnce
  let shouldConflictOnEntryCreate = entryCreateConflictOnce
  let shouldConflictOnEventCreate = eventCreateConflictOnce
  let concurrentWinnerPendingCommit = false

  function transactionClient() {
    return {
      user: {
        async findUnique({ where }) {
          const user = state.users.get(where.id)
          return user ? { emailVerified: user.emailVerified } : null
        },
      },
      backgroundCreditWallet: {
        async findUnique({ where }) {
          return state.wallets.get(where.userId) ?? null
        },
        async create({ data }) {
          if (shouldConflictOnWalletCreate) {
            shouldConflictOnWalletCreate = false
            concurrentWinnerPendingCommit = true
            throw Object.assign(new Error("concurrent wallet winner"), {
              code: "P2002",
              meta: { modelName: "BackgroundCreditWallet", target: ["userId"] },
            })
          }
          if (state.wallets.has(data.userId)) {
            throw Object.assign(new Error("unique wallet"), { code: "P2002" })
          }
          const wallet = {
            id: `wallet-${state.nextWalletId++}`,
            userId: data.userId,
            balance: data.balance,
            version: 0,
          }
          state.wallets.set(data.userId, wallet)
          return { ...wallet }
        },
      },
      backgroundCreditEntry: {
        async findUnique({ where }) {
          return state.entries.get(where.idempotencyKey) ?? null
        },
        async create({ data }) {
          if (shouldConflictOnEntryCreate) {
            shouldConflictOnEntryCreate = false
            concurrentWinnerPendingCommit = true
            throw Object.assign(new Error("concurrent initial entry winner"), {
              code: "P2002",
              meta: { modelName: "BackgroundCreditEntry", target: ["idempotencyKey"] },
            })
          }
          if (state.entries.has(data.idempotencyKey)) {
            throw Object.assign(new Error("unique entry"), { code: "P2002" })
          }
          const entry = { id: `entry-${state.entries.size + 1}`, ...data }
          state.entries.set(data.idempotencyKey, entry)
          return { ...entry }
        },
      },
      commerceEvent: {
        async create({ data }) {
          if (shouldConflictOnEventCreate) {
            shouldConflictOnEventCreate = false
            throw Object.assign(new Error("unrelated event collision"), {
              code: "P2002",
              meta: { modelName: "CommerceEvent", target: ["id"] },
            })
          }
          const event = { id: `event-${state.events.length + 1}`, ...data }
          state.events.push(event)
          return { ...event }
        },
      },
    }
  }

  return {
    state,
    get transactionAttempts() {
      return transactionAttempts
    },
    async $transaction(callback, options) {
      const previous = transactionTail
      let release
      transactionTail = new Promise((resolve) => {
        release = resolve
      })
      await previous
      transactionAttempts += 1
      const snapshot = structuredClone(state)
      try {
        assert.equal(options?.isolationLevel, "Serializable")
        return await callback(transactionClient())
      } catch (error) {
        state.users = snapshot.users
        state.wallets = snapshot.wallets
        state.entries = snapshot.entries
        state.events = snapshot.events
        state.nextWalletId = snapshot.nextWalletId
        if (concurrentWinnerPendingCommit) {
          concurrentWinnerPendingCommit = false
          const userId = "p2002-user"
          const wallet = { id: "winning-wallet", userId, balance: 2, version: 0 }
          state.wallets.set(userId, wallet)
          state.entries.set(`background-credit:initial-grant:${userId}`, {
            id: "winning-entry",
            walletId: wallet.id,
            userId,
            type: "INITIAL_GRANT",
            delta: 2,
            balanceAfter: 2,
            idempotencyKey: `background-credit:initial-grant:${userId}`,
          })
          state.events.push({
            id: "winning-event",
            userId,
            eventType: "BACKGROUND_CREDITS_INITIAL_GRANTED",
            payload: {},
          })
        }
        throw error
      } finally {
        release()
      }
    },
  }
}

describe("verified-account background credit provisioning", () => {
  it("grants exactly two credits with one immutable initial ledger entry and audit event", async () => {
    const database = createCreditDatabase([{ id: "verified-user", emailVerified: new Date() }])

    const result = await ensureVerifiedUserBackgroundCredits(database, "verified-user")

    assert.equal(INITIAL_BACKGROUND_CREDIT_COUNT, 2)
    assert.deepEqual(result, { balance: 2, granted: true })
    assert.equal(database.state.wallets.get("verified-user")?.balance, 2)
    assert.equal(database.state.entries.size, 1)
    const [entry] = database.state.entries.values()
    assert.equal(entry.type, "INITIAL_GRANT")
    assert.equal(entry.delta, 2)
    assert.equal(entry.balanceAfter, 2)
    assert.match(entry.idempotencyKey, /verified-user/)
    assert.equal(database.state.events.length, 1)
    assert.equal(database.state.events[0].eventType, "BACKGROUND_CREDITS_INITIAL_GRANTED")
    assert.deepEqual(database.state.events[0].payload, {})
  })

  it("returns an existing wallet without changing its balance or duplicating the grant", async () => {
    const database = createCreditDatabase([{ id: "repeat-user", emailVerified: new Date() }])
    await ensureVerifiedUserBackgroundCredits(database, "repeat-user")
    database.state.wallets.get("repeat-user").balance = 1

    const result = await ensureVerifiedUserBackgroundCredits(database, "repeat-user")

    assert.deepEqual(result, { balance: 1, granted: false })
    assert.equal(database.state.entries.size, 1)
    assert.equal(database.state.events.length, 1)
  })

  it("serializes concurrent calls into one wallet and one initial grant", async () => {
    const database = createCreditDatabase([{ id: "concurrent-user", emailVerified: new Date() }])

    const results = await Promise.all([
      ensureVerifiedUserBackgroundCredits(database, "concurrent-user"),
      ensureVerifiedUserBackgroundCredits(database, "concurrent-user"),
    ])

    assert.equal(results.filter((result) => result.granted).length, 1)
    assert.equal(database.state.wallets.size, 1)
    assert.equal(database.state.entries.size, 1)
    assert.equal(database.state.events.length, 1)
  })

  it("restarts after a wallet P2002 race and validates the committed winner", async () => {
    const database = createCreditDatabase(
      [{ id: "p2002-user", emailVerified: new Date() }],
      { walletCreateConflictOnce: true },
    )

    const result = await ensureVerifiedUserBackgroundCredits(database, "p2002-user")

    assert.deepEqual(result, { balance: 2, granted: false })
    assert.equal(database.transactionAttempts, 2)
    assert.equal(database.state.wallets.size, 1)
    assert.equal(database.state.entries.size, 1)
    assert.equal(database.state.events.length, 1)
  })

  it("restarts after an initial-entry P2002 race and validates the committed winner", async () => {
    const database = createCreditDatabase(
      [{ id: "p2002-user", emailVerified: new Date() }],
      { entryCreateConflictOnce: true },
    )

    const result = await ensureVerifiedUserBackgroundCredits(database, "p2002-user")

    assert.deepEqual(result, { balance: 2, granted: false })
    assert.equal(database.transactionAttempts, 2)
    assert.equal(database.state.wallets.size, 1)
    assert.equal(database.state.entries.size, 1)
    assert.equal(database.state.events.length, 1)
  })

  it("does not retry an unrelated P2002", async () => {
    const database = createCreditDatabase(
      [{ id: "event-conflict-user", emailVerified: new Date() }],
      { eventCreateConflictOnce: true },
    )

    await assert.rejects(
      () => ensureVerifiedUserBackgroundCredits(database, "event-conflict-user"),
      (error) => error.code === "P2002" && error.meta?.modelName === "CommerceEvent",
    )
    assert.equal(database.transactionAttempts, 1)
    assert.equal(database.state.wallets.size, 0)
    assert.equal(database.state.entries.size, 0)
    assert.equal(database.state.events.length, 0)
  })

  it("reloads verification from the database and does not provision an unverified user", async () => {
    const database = createCreditDatabase([{ id: "unverified-user", emailVerified: null }])

    const result = await ensureVerifiedUserBackgroundCredits(database, "unverified-user")

    assert.deepEqual(result, { balance: 0, granted: false })
    assert.equal(database.state.wallets.size, 0)
    assert.equal(database.state.entries.size, 0)
    assert.equal(database.state.events.length, 0)
  })

  it("fails closed when a wallet exists without its matching initial ledger entry", async () => {
    const database = createCreditDatabase([{ id: "mismatch-user", emailVerified: new Date() }])
    database.state.wallets.set("mismatch-user", {
      id: "orphan-wallet",
      userId: "mismatch-user",
      balance: 2,
      version: 0,
    })

    await assert.rejects(
      () => ensureVerifiedUserBackgroundCredits(database, "mismatch-user"),
      /reconciliation/i,
    )
    assert.equal(database.state.entries.size, 0)
    assert.equal(database.state.events.length, 0)
  })

  it("routes all verification transitions and verified-state loading through the shared service", async () => {
    const [authUsers, verifyPage, passwordRoute] = await Promise.all([
      readFile(new URL("../lib/auth-users.ts", import.meta.url), "utf8"),
      readFile(new URL("../app/verify-email/page.tsx", import.meta.url), "utf8"),
      readFile(new URL("../app/api/account/security/password/route.ts", import.meta.url), "utf8"),
    ])

    assert.match(authUsers, /ensureVerifiedUserBackgroundCredits\(tx, userId\)/)
    assert.match(authUsers, /if \(user\?\.emailVerified\)[\s\S]*ensureVerifiedUserBackgroundCredits\(prisma, userId\)/)
    const verifyTransaction = verifyPage.match(/await runCommerceTransaction\(prisma, async \(txValue\) => \{([\s\S]*?)\n      \}\)/)?.[1]
    const passwordTransaction = passwordRoute.match(/await runCommerceTransaction\(prisma, async \(txValue\) => \{([\s\S]*?)\n  \}\)/)?.[1]
    assert.ok(verifyTransaction)
    assert.ok(passwordTransaction)
    assert.doesNotMatch(verifyTransaction, /ensureVerifiedUserBackgroundCredits/)
    assert.doesNotMatch(passwordTransaction, /ensureVerifiedUserBackgroundCredits/)
    assert.match(verifyPage, /ensureVerifiedUserBackgroundCredits\(prisma, record\.userId\)\.catch/)
    assert.match(passwordRoute, /ensureVerifiedUserBackgroundCredits\(prisma, user\.id\)\.catch/)
  })
})
