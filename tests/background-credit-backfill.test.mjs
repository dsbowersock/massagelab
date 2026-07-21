import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { ensureVerifiedUserBackgroundCredits } from "../lib/commerce/credit-service.ts"
import {
  formatBackgroundCreditBackfillSummary,
  parseBackgroundCreditBackfillArgs,
  runBackgroundCreditBackfill,
} from "../scripts/background-credit-backfill.mjs"

function createBackfillDatabase(users) {
  const state = {
    users: new Map(users.map((user) => [user.id, { ...user }])),
    wallets: new Map(),
    entries: new Map(),
    events: [],
    nextWalletId: 1,
  }
  let transactionTail = Promise.resolve()

  function userMatches(user, where = {}) {
    if (where.emailVerified?.not === null && !user.emailVerified) return false
    if (where.id?.gt && user.id <= where.id.gt) return false
    const hasWallet = state.wallets.has(user.id)
    if (where.backgroundCreditWallet === null && hasWallet) return false
    if (where.backgroundCreditWallet?.isNot === null && !hasWallet) return false
    return true
  }

  function databaseClient() {
    return {
      user: {
        async count({ where }) {
          return [...state.users.values()].filter((user) => userMatches(user, where)).length
        },
        async findMany({ where, orderBy, take }) {
          assert.deepEqual(orderBy, { id: "asc" })
          return [...state.users.values()]
            .filter((user) => userMatches(user, where))
            .sort((left, right) => left.id.localeCompare(right.id))
            .slice(0, take)
            .map((user) => ({ id: user.id }))
        },
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

  const client = databaseClient()
  return Object.assign(client, {
    state,
    async $transaction(callback, options) {
      const previous = transactionTail
      let release
      transactionTail = new Promise((resolve) => {
        release = resolve
      })
      await previous
      try {
        assert.equal(options?.isolationLevel, "Serializable")
        return await callback(databaseClient())
      } finally {
        release()
      }
    },
  })
}

describe("verified-account credit backfill", () => {
  it("grants only missing verified accounts and reports counts without sensitive values", async () => {
    const database = createBackfillDatabase([
      { id: "verified-a", email: "hidden-a@example.com", emailVerified: new Date() },
      { id: "unverified-b", email: "hidden-b@example.com", emailVerified: null },
      { id: "verified-c", email: "hidden-c@example.com", emailVerified: new Date() },
      { id: "existing-d", email: "hidden-d@example.com", emailVerified: new Date() },
    ])
    await ensureVerifiedUserBackgroundCredits(database, "existing-d")

    const result = await runBackgroundCreditBackfill({ prismaClient: database, batchSize: 1 })

    assert.deepEqual(result, { eligible: 2, granted: 2, alreadyProvisioned: 1, dryRun: false })
    assert.equal(database.state.wallets.has("unverified-b"), false)
    const summary = formatBackgroundCreditBackfillSummary(result)
    assert.match(summary, /eligible=2 granted=2 alreadyProvisioned=1 dryRun=false/)
    assert.doesNotMatch(summary, /verified-a|example\.com|postgres|payload|:\/\//i)
  })

  it("resumes after a bounded partial batch and repeated completed runs grant zero", async () => {
    const database = createBackfillDatabase(
      ["account-a", "account-b", "account-c", "account-d", "account-e"].map((id) => ({
        id,
        emailVerified: new Date(),
      })),
    )

    const partial = await runBackgroundCreditBackfill({ prismaClient: database, batchSize: 2, limit: 2 })
    const resumed = await runBackgroundCreditBackfill({ prismaClient: database, batchSize: 2 })
    const repeated = await runBackgroundCreditBackfill({ prismaClient: database, batchSize: 2 })

    assert.deepEqual(partial, { eligible: 2, granted: 2, alreadyProvisioned: 0, dryRun: false })
    assert.deepEqual(resumed, { eligible: 3, granted: 3, alreadyProvisioned: 2, dryRun: false })
    assert.deepEqual(repeated, { eligible: 0, granted: 0, alreadyProvisioned: 5, dryRun: false })
    assert.deepEqual(database.state.events.map((event) => event.userId), [
      "account-a",
      "account-b",
      "account-c",
      "account-d",
      "account-e",
    ])
  })

  it("treats a concurrently provisioned selected account as already provisioned", async () => {
    const database = createBackfillDatabase([{ id: "concurrent", emailVerified: new Date() }])
    let provisionedBetweenSelectionAndCall = false

    const result = await runBackgroundCreditBackfill({
      prismaClient: database,
      ensureCredits: async (client, userId) => {
        if (!provisionedBetweenSelectionAndCall) {
          provisionedBetweenSelectionAndCall = true
          await ensureVerifiedUserBackgroundCredits(client, userId)
        }
        return ensureVerifiedUserBackgroundCredits(client, userId)
      },
    })

    assert.deepEqual(result, { eligible: 1, granted: 0, alreadyProvisioned: 1, dryRun: false })
    assert.equal(database.state.entries.size, 1)
    assert.equal(database.state.events.length, 1)
  })

  it("supports a bounded dry-run without writes", async () => {
    const database = createBackfillDatabase([
      { id: "dry-a", emailVerified: new Date() },
      { id: "dry-b", emailVerified: new Date() },
      { id: "dry-c", emailVerified: new Date() },
    ])

    const result = await runBackgroundCreditBackfill({
      prismaClient: database,
      dryRun: true,
      limit: 2,
      batchSize: 1,
    })

    assert.deepEqual(result, { eligible: 2, granted: 0, alreadyProvisioned: 0, dryRun: true })
    assert.equal(database.state.wallets.size, 0)
    assert.equal(database.state.entries.size, 0)
    assert.deepEqual(parseBackgroundCreditBackfillArgs(["--dry-run", "--limit", "2"]), {
      dryRun: true,
      limit: 2,
    })
    assert.throws(() => parseBackgroundCreditBackfillArgs(["--limit=0"]), /positive integer/i)
    assert.throws(() => parseBackgroundCreditBackfillArgs(["--limit=10001"]), /at most 10000/i)
  })
})
