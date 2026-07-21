import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import {
  INITIAL_BACKGROUND_CREDIT_COUNT,
  ensureVerifiedUserBackgroundCredits,
} from "../lib/commerce/credit-service.ts"

function createCreditDatabase(users) {
  const state = {
    users: new Map(users.map((user) => [user.id, { ...user }])),
    wallets: new Map(),
    entries: new Map(),
    events: [],
    nextWalletId: 1,
  }
  let transactionTail = Promise.resolve()

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
          const event = { id: `event-${state.events.length + 1}`, ...data }
          state.events.push(event)
          return { ...event }
        },
      },
    }
  }

  return {
    state,
    async $transaction(callback, options) {
      const previous = transactionTail
      let release
      transactionTail = new Promise((resolve) => {
        release = resolve
      })
      await previous
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
    assert.match(verifyPage, /ensureVerifiedUserBackgroundCredits\(tx, record\.userId\)/)
    assert.match(passwordRoute, /ensureVerifiedUserBackgroundCredits\(tx, user\.id\)/)
  })
})
