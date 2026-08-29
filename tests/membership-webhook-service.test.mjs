import assert from "node:assert/strict"
import { describe, it } from "node:test"
import { buildEntitlements, FEATURE_KEYS } from "../lib/membership.js"
import {
  MembershipWebhookRetryableError,
  processStripeMembershipEvent,
} from "../lib/membership-webhook-service.ts"

const ENV = Object.freeze({
  STRIPE_SUPPORTER_1_MONTHLY_PRICE_ID: "price_supporter_1",
  STRIPE_SUPPORTER_2_MONTHLY_PRICE_ID: "price_supporter_2",
})
const BASE_TIME = new Date("2026-08-28T12:00:00.000Z")

function stripeSubscription({
  id = "sub_123",
  customer = "cus_123",
  status = "active",
  priceId = "price_supporter_1",
  userId = "user_123",
} = {}) {
  return {
    id,
    customer,
    status,
    current_period_start: 1787918400,
    current_period_end: 1790596800,
    cancel_at_period_end: status === "canceled",
    canceled_at: status === "canceled" ? 1787918400 : null,
    metadata: userId ? { userId } : {},
    items: { data: [{ price: { id: priceId, product: "prod_supporter" } }] },
  }
}

function subscriptionEvent({
  eventId,
  created,
  type = "customer.subscription.updated",
  ...subscription
}) {
  return {
    id: eventId,
    type,
    created,
    data: { object: stripeSubscription(subscription) },
  }
}

function checkoutEvent({ eventId, created, customer = "cus_123", subscriptionId = "sub_123", userId = "user_123" }) {
  return {
    id: eventId,
    type: "checkout.session.completed",
    created,
    data: {
      object: {
        id: "cs_123",
        mode: "subscription",
        customer,
        subscription: subscriptionId,
        client_reference_id: userId,
        metadata: { purpose: "membership", userId },
      },
    },
  }
}

function persistedSubscription(overrides = {}) {
  return {
    id: "membership_123",
    userId: "user_123",
    stripeSubscriptionId: "sub_123",
    stripeCustomerId: "cus_123",
    status: "active",
    membershipLevel: "SUPPORTER",
    stripePriceId: "price_supporter_1",
    stripeProductId: "prod_supporter",
    currentPeriodStart: new Date("2026-08-28T12:00:00.000Z"),
    currentPeriodEnd: new Date("2026-09-28T12:00:00.000Z"),
    cancelAtPeriodEnd: false,
    canceledAt: null,
    couponId: null,
    metadata: { userId: "user_123" },
    lastStripeEventId: "evt_seed",
    lastStripeEventCreatedAt: new Date("2026-08-28T11:59:00.000Z"),
    lastStripeAuthoritativeAt: null,
    updatedAt: new Date("2026-08-28T10:00:00.000Z"),
    ...overrides,
  }
}

function receipt(overrides = {}) {
  return {
    id: "receipt_123",
    userId: "user_123",
    provider: "stripe",
    providerEventId: "evt_123",
    eventType: "customer.subscription.updated",
    providerEventCreatedAt: new Date("2026-08-28T12:00:00.000Z"),
    providerObjectId: "sub_123",
    stripeSubscriptionId: "sub_123",
    status: "RECEIVED",
    attemptCount: 0,
    failureCode: null,
    receivedAt: new Date("2026-08-28T12:00:00.000Z"),
    lastAttemptedAt: null,
    processedAt: null,
    ...overrides,
  }
}

function clone(value) {
  return structuredClone(value)
}

function applyData(target, data) {
  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === "object" && !Array.isArray(value) && "increment" in value) {
      target[key] = Number(target[key] ?? 0) + Number(value.increment)
    } else {
      target[key] = clone(value)
    }
  }
  return target
}

function receiptKey(provider, providerEventId) {
  return `${provider}:${providerEventId}`
}

function legacyReceiptUniqueError({
  code = "P2002",
  modelName = "MembershipWebhookReceipt",
  target = ["provider", "providerEventId"],
} = {}) {
  return Object.assign(new Error("legacy receipt unique constraint"), {
    code,
    meta: { modelName, target },
  })
}

function adapterReceiptUniqueError(constraint = { fields: ["provider", "providerEventId"] }, {
  code = "P2002",
  kind = "UniqueConstraintViolation",
  originalCode = "23505",
  modelName,
} = {}) {
  return Object.assign(new Error("adapter receipt unique constraint"), {
    code,
    meta: {
      ...(modelName ? { modelName } : {}),
      driverAdapterError: {
        name: "DriverAdapterError",
        cause: {
          kind,
          originalCode,
          originalMessage: "duplicate key value violates unique constraint",
          constraint,
        },
      },
    },
  })
}

function semanticSubscriptionState(subscription) {
  const semanticState = clone(subscription)
  delete semanticState.lastStripeEventId
  delete semanticState.lastStripeEventCreatedAt
  delete semanticState.lastStripeAuthoritativeAt
  delete semanticState.updatedAt
  return semanticState
}

/**
 * Provides optimistic Serializable snapshots so concurrent service calls prove
 * whole-transaction retry and conditional receipt ownership without a real DB.
 */
function createPrismaFixture({
  customers = [{ id: "customer_123", userId: "user_123", stripeCustomerId: "cus_123" }],
  subscriptions = [],
  receipts = [],
  conflicts = 0,
  receiptCreateRaces = [],
} = {}) {
  let state = {
    customers: new Map(customers.map((row) => [row.stripeCustomerId, clone(row)])),
    subscriptions: new Map(subscriptions.map((row) => [row.stripeSubscriptionId, clone(row)])),
    receipts: new Map(receipts.map((row) => [receiptKey(row.provider, row.providerEventId), clone(row)])),
    subscriptionMutations: 0,
    nextUpdatedAtMs: BASE_TIME.getTime(),
  }
  let version = 0
  let conflictsRemaining = conflicts
  const pendingReceiptCreateRaces = [...receiptCreateRaces]
  let activeTransactionCallbacks = 0
  const transactionOptions = []

  function transactionClient(working) {
    function findReceipt(where) {
      if (where.id) {
        return [...working.receipts.values()].find((row) => row.id === where.id) ?? null
      }
      const compound = where.provider_providerEventId
      return compound ? working.receipts.get(receiptKey(compound.provider, compound.providerEventId)) ?? null : null
    }

    return {
      stripeCustomer: {
        findUnique: async ({ where }) => {
          if (where.stripeCustomerId) return clone(working.customers.get(where.stripeCustomerId) ?? null)
          return clone([...working.customers.values()].find((row) => row.userId === where.userId) ?? null)
        },
      },
      membershipSubscription: {
        findUnique: async ({ where }) => clone(working.subscriptions.get(where.stripeSubscriptionId) ?? null),
        upsert: async ({ where, create, update }) => {
          const existing = working.subscriptions.get(where.stripeSubscriptionId)
          let next
          if (existing) {
            const explicitlyPreservesRevision = Object.hasOwn(update, "updatedAt")
            const previousUpdatedAt = new Date(existing.updatedAt)
            next = applyData(existing, update)
            if (!explicitlyPreservesRevision) {
              const nextRevisionMs = Math.max(working.nextUpdatedAtMs, previousUpdatedAt.getTime() + 1)
              next.updatedAt = new Date(nextRevisionMs)
              working.nextUpdatedAtMs = nextRevisionMs + 1
            }
          } else {
            next = {
              id: `membership_${working.subscriptions.size + 1}`,
              updatedAt: new Date(working.nextUpdatedAtMs),
              ...clone(create),
            }
            working.nextUpdatedAtMs += 1
          }
          working.subscriptions.set(where.stripeSubscriptionId, next)
          working.subscriptionMutations += 1
          return clone(next)
        },
      },
      membershipWebhookReceipt: {
        findUnique: async ({ where }) => clone(findReceipt(where)),
        upsert: async ({ where, create, update }) => {
          const key = receiptKey(where.provider_providerEventId.provider, where.provider_providerEventId.providerEventId)
          const existing = working.receipts.get(key)
          if (existing) {
            applyData(existing, update)
            return clone(existing)
          }
          const createRace = pendingReceiptCreateRaces.shift()
          if (createRace) {
            const winner = {
              id: `receipt_winner_${state.receipts.size + 1}`,
              status: "RECEIVED",
              attemptCount: 0,
              failureCode: null,
              receivedAt: new Date(BASE_TIME),
              lastAttemptedAt: null,
              processedAt: null,
              ...clone(create),
              ...clone(createRace.winner),
            }
            state.receipts.set(key, winner)
            version += 1
            throw createRace.error
          }
          const created = {
            id: `receipt_${working.receipts.size + 1}`,
            status: "RECEIVED",
            attemptCount: 0,
            failureCode: null,
            receivedAt: new Date(BASE_TIME),
            lastAttemptedAt: null,
            processedAt: null,
            ...clone(create),
          }
          working.receipts.set(key, created)
          return clone(created)
        },
        update: async ({ where, data }) => {
          const row = findReceipt(where)
          if (!row) throw Object.assign(new Error("receipt not found"), { code: "P2025" })
          return clone(applyData(row, data))
        },
        updateMany: async ({ where, data }) => {
          const matches = [...working.receipts.values()].filter((row) => (
            Object.entries(where).every(([key, value]) => row[key] === value)
          ))
          for (const row of matches) applyData(row, data)
          return { count: matches.length }
        },
      },
    }
  }

  const prismaClient = {
    async $transaction(callback, options) {
      transactionOptions.push(clone(options))
      if (conflictsRemaining > 0) {
        conflictsRemaining -= 1
        throw Object.assign(new Error("serializable conflict"), { code: "P2034" })
      }
      const baseVersion = version
      const working = clone(state)
      activeTransactionCallbacks += 1
      let result
      try {
        result = await callback(transactionClient(working))
      } finally {
        activeTransactionCallbacks -= 1
      }
      await Promise.resolve()
      if (version !== baseVersion) {
        throw Object.assign(new Error("serializable conflict"), { code: "P2034" })
      }
      state = working
      version += 1
      return result
    },
  }

  return {
    prismaClient,
    get activeTransactionCallbacks() { return activeTransactionCallbacks },
    get transactionOptions() { return clone(transactionOptions) },
    get subscriptions() { return clone([...state.subscriptions.values()]) },
    get receipts() { return clone([...state.receipts.values()]) },
    get subscriptionMutations() { return state.subscriptionMutations },
  }
}

async function process(fixture, event, options = {}) {
  return processStripeMembershipEvent({
    prismaClient: fixture.prismaClient,
    event,
    env: ENV,
    retrieveSubscription: options.retrieveSubscription ?? (async () => stripeSubscription()),
    now: options.now ?? (() => new Date(BASE_TIME)),
  })
}

function deferred() {
  let resolve
  const promise = new Promise((accept) => { resolve = accept })
  return { promise, resolve }
}

describe("membership webhook service", () => {
  it("returns completed receipts as duplicates without rewriting the snapshot", async () => {
    const fixture = createPrismaFixture({
      subscriptions: [persistedSubscription({ lastStripeEventId: "evt_123", lastStripeEventCreatedAt: new Date(BASE_TIME) })],
      receipts: [receipt({ status: "APPLIED", processedAt: new Date(BASE_TIME) })],
    })

    const result = await process(fixture, subscriptionEvent({ eventId: "evt_123", created: 1787918400 }))

    assert.deepEqual(result, { outcome: "duplicate", changed: false, userId: "user_123" })
    assert.equal(fixture.subscriptionMutations, 0)
    assert.equal(fixture.receipts[0].attemptCount, 0)
  })

  it("retries an unfinished receipt and completes a matching stored watermark without an access rewrite", async () => {
    const fixture = createPrismaFixture({
      subscriptions: [persistedSubscription({ lastStripeEventId: "evt_123", lastStripeEventCreatedAt: new Date(BASE_TIME) })],
      receipts: [receipt({ failureCode: "provider_unavailable", attemptCount: 1 })],
    })

    const result = await process(fixture, subscriptionEvent({ eventId: "evt_123", created: 1787918400 }))

    assert.deepEqual(result, { outcome: "applied", changed: false, userId: "user_123" })
    assert.equal(fixture.receipts[0].status, "APPLIED")
    assert.equal(fixture.receipts[0].attemptCount, 2)
    assert.equal(fixture.receipts[0].failureCode, null)
    assert.equal(fixture.subscriptionMutations, 0)
  })

  it("applies older-then-newer delivery and ignores newer-then-older delivery", async () => {
    const olderThenNewer = createPrismaFixture()
    assert.deepEqual(await process(olderThenNewer, subscriptionEvent({ eventId: "evt_active", created: 100, status: "active" })), { outcome: "applied", changed: true, userId: "user_123" })
    assert.deepEqual(await process(olderThenNewer, subscriptionEvent({ eventId: "evt_canceled", created: 200, status: "canceled", type: "customer.subscription.deleted" })), { outcome: "applied", changed: true, userId: "user_123" })
    assert.equal(olderThenNewer.subscriptions[0].status, "canceled")

    const delayed = await process(olderThenNewer, subscriptionEvent({ eventId: "evt_delayed_active", created: 150, status: "active" }))
    assert.deepEqual(delayed, { outcome: "ignored", changed: false, userId: "user_123" })
    assert.equal(olderThenNewer.subscriptions[0].status, "canceled")
  })

  it("allows a genuinely newer resumed event to restore access", async () => {
    const fixture = createPrismaFixture({
      subscriptions: [persistedSubscription({ status: "canceled", lastStripeEventId: "evt_canceled", lastStripeEventCreatedAt: new Date(200_000) })],
    })

    const result = await process(fixture, subscriptionEvent({ eventId: "evt_resumed", created: 300, status: "active", type: "customer.subscription.resumed" }))

    assert.deepEqual(result, { outcome: "applied", changed: true, userId: "user_123" })
    const entitlements = buildEntitlements({ subscriptions: fixture.subscriptions, now: new Date("2026-08-28T12:01:00.000Z") })
    assert.equal(entitlements.hasFeature(FEATURE_KEYS.premiumBackgrounds), true)
  })

  it("reconciles equal-time, legacy, Checkout, and post-authoritative events through injected provider reads", async () => {
    for (const scenario of [
      { name: "equal-time", stored: persistedSubscription({ lastStripeEventCreatedAt: new Date(500_000), lastStripeEventId: "evt_left" }), event: subscriptionEvent({ eventId: "evt_right", created: 500 }) },
      { name: "legacy", stored: persistedSubscription({ lastStripeEventCreatedAt: null, lastStripeEventId: null, lastStripeAuthoritativeAt: null }), event: subscriptionEvent({ eventId: "evt_legacy", created: 500 }) },
      { name: "authoritative", stored: persistedSubscription({ lastStripeAuthoritativeAt: new Date("2035-01-01T00:00:00.000Z") }), event: subscriptionEvent({ eventId: "evt_after_read", created: 1787918500 }) },
      { name: "checkout", stored: persistedSubscription(), event: checkoutEvent({ eventId: "evt_checkout", created: 600 }) },
    ]) {
      const fixture = createPrismaFixture({ subscriptions: [scenario.stored] })
      let retrievals = 0
      const result = await process(fixture, scenario.event, {
        retrieveSubscription: async () => {
          retrievals += 1
          return stripeSubscription({ status: "canceled" })
        },
      })
      assert.equal(retrievals, 1, scenario.name)
      assert.deepEqual(result, { outcome: "applied", changed: true, userId: "user_123" }, scenario.name)
      assert.equal(fixture.subscriptions[0].status, "canceled", scenario.name)
      assert.equal(fixture.subscriptions[0].updatedAt > scenario.stored.updatedAt, true, scenario.name)
      assert.equal(fixture.subscriptions[0].lastStripeEventId, scenario.event.id, scenario.name)
      assert.deepEqual(fixture.subscriptions[0].lastStripeAuthoritativeAt, BASE_TIME, scenario.name)
    }
  })

  it("never ignores solely because the local authoritative clock is ahead or behind Stripe", async () => {
    for (const lastStripeAuthoritativeAt of [
      new Date("2020-01-01T00:00:00.000Z"),
      new Date("2035-01-01T00:00:00.000Z"),
    ]) {
      const fixture = createPrismaFixture({
        subscriptions: [persistedSubscription({ lastStripeEventId: null, lastStripeEventCreatedAt: null, lastStripeAuthoritativeAt })],
      })
      let retrievals = 0
      const result = await process(fixture, subscriptionEvent({ eventId: `evt_skew_${retrievals}`, created: 1787918400 }), {
        retrieveSubscription: async () => {
          retrievals += 1
          return stripeSubscription()
        },
      })
      assert.equal(retrievals, 1)
      assert.notEqual(result.outcome, "ignored")
    }
  })

  it("keeps provider I/O outside transactions and leaves provider failures retryable", async () => {
    const fixture = createPrismaFixture({
      subscriptions: [persistedSubscription({ lastStripeEventId: null, lastStripeEventCreatedAt: null })],
    })
    await assert.rejects(
      process(fixture, subscriptionEvent({ eventId: "evt_provider_down", created: 700 }), {
        retrieveSubscription: async () => {
          assert.equal(fixture.activeTransactionCallbacks, 0)
          throw new Error("sensitive provider detail")
        },
      }),
      (error) => error instanceof MembershipWebhookRetryableError
        && error.code === "provider_unavailable"
        && !error.message.includes("sensitive provider detail"),
    )
    assert.equal(fixture.receipts[0].status, "RECEIVED")
    assert.equal(fixture.receipts[0].failureCode, "provider_unavailable")
    assert.equal(fixture.receipts[0].attemptCount, 1)
    assert.equal(fixture.subscriptionMutations, 0)
  })

  it("does not let a provider read overwrite a newer event committed while it was in flight", async () => {
    const fixture = createPrismaFixture({
      subscriptions: [persistedSubscription({ lastStripeEventId: "evt_left", lastStripeEventCreatedAt: new Date(800_000) })],
    })
    const gate = deferred()
    const started = deferred()
    const reconciling = process(fixture, subscriptionEvent({ eventId: "evt_equal", created: 800 }), {
      retrieveSubscription: async () => {
        started.resolve()
        await gate.promise
        return stripeSubscription({ status: "active" })
      },
    })
    await started.promise
    const newer = await process(fixture, subscriptionEvent({ eventId: "evt_newer", created: 900, status: "canceled" }))
    assert.equal(newer.outcome, "applied")
    gate.resolve()
    const reconciled = await reconciling

    assert.deepEqual(reconciled, { outcome: "ignored", changed: false, userId: "user_123" })
    assert.equal(fixture.subscriptions[0].status, "canceled")
    assert.equal(fixture.subscriptions[0].lastStripeEventId, "evt_newer")
  })

  it("returns the winning terminal receipt when two workers reconcile the same event", async () => {
    const fixture = createPrismaFixture({
      subscriptions: [persistedSubscription({ lastStripeEventId: null, lastStripeEventCreatedAt: null })],
    })
    const gate = deferred()
    const firstStarted = deferred()
    let retrievals = 0
    const event = subscriptionEvent({ eventId: "evt_shared", created: 1000 })
    const first = process(fixture, event, {
      retrieveSubscription: async () => {
        retrievals += 1
        firstStarted.resolve()
        await gate.promise
        return stripeSubscription({ status: "canceled" })
      },
    })
    await firstStarted.promise
    const second = await process(fixture, event, {
      retrieveSubscription: async () => {
        retrievals += 1
        return stripeSubscription({ status: "canceled" })
      },
    })
    gate.resolve()
    const resumedFirst = await first

    assert.deepEqual(second, { outcome: "applied", changed: true, userId: "user_123" })
    assert.deepEqual(resumedFirst, { outcome: "duplicate", changed: false, userId: "user_123" })
    assert.equal(retrievals, 2)
    assert.equal(fixture.receipts[0].status, "APPLIED")
    assert.equal(fixture.subscriptionMutations, 1)
  })

  it("preserves existing entitlement semantics across Stripe statuses", async () => {
    for (const status of ["past_due", "unpaid", "paused", "canceled"]) {
      const fixture = createPrismaFixture()
      const result = await process(fixture, subscriptionEvent({ eventId: `evt_${status}`, created: 1100, status }))
      assert.equal(result.changed, true, status)
      const entitlements = buildEntitlements({ subscriptions: fixture.subscriptions, now: new Date("2026-08-28T12:01:00.000Z") })
      assert.equal(entitlements.hasFeature(FEATURE_KEYS.premiumBackgrounds), false, status)
    }
    for (const status of ["active", "trialing"]) {
      const fixture = createPrismaFixture()
      await process(fixture, subscriptionEvent({ eventId: `evt_${status}`, created: 1200, status }))
      const entitlements = buildEntitlements({ subscriptions: fixture.subscriptions, now: new Date("2026-08-28T12:01:00.000Z") })
      assert.equal(entitlements.hasFeature(FEATURE_KEYS.premiumBackgrounds), true, status)
    }
  })

  it("updates a mapped Price without changing feature-key rules", async () => {
    const fixture = createPrismaFixture({ subscriptions: [persistedSubscription()] })
    const previousUpdatedAt = fixture.subscriptions[0].updatedAt
    const result = await process(fixture, subscriptionEvent({ eventId: "evt_price", created: 1787918500, priceId: "price_supporter_2" }))

    assert.deepEqual(result, { outcome: "applied", changed: true, userId: "user_123" })
    assert.equal(fixture.subscriptions[0].stripePriceId, "price_supporter_2")
    assert.equal(fixture.subscriptions[0].updatedAt > previousUpdatedAt, true)
    assert.equal(buildEntitlements({ subscriptions: fixture.subscriptions }).hasFeature(FEATURE_KEYS.premiumBackgrounds), true)
  })

  it("preserves the membership revision for a direct watermark-only write", async () => {
    const fixture = createPrismaFixture({ subscriptions: [persistedSubscription()] })
    const previous = fixture.subscriptions[0]

    const result = await process(fixture, subscriptionEvent({ eventId: "evt_same_state", created: 1787918460 }))

    assert.deepEqual(result, { outcome: "applied", changed: false, userId: "user_123" })
    assert.deepEqual(fixture.subscriptions[0].updatedAt, previous.updatedAt)
    assert.deepEqual(semanticSubscriptionState(fixture.subscriptions[0]), semanticSubscriptionState(previous))
    assert.equal(fixture.subscriptions[0].lastStripeEventId, "evt_same_state")
    assert.equal(fixture.receipts[0].status, "APPLIED")
  })

  it("preserves a legacy membership revision during watermark-only provider reconciliation", async () => {
    const fixture = createPrismaFixture({
      subscriptions: [persistedSubscription({
        lastStripeEventId: null,
        lastStripeEventCreatedAt: null,
        lastStripeAuthoritativeAt: null,
      })],
    })
    const previous = fixture.subscriptions[0]

    const result = await process(fixture, subscriptionEvent({ eventId: "evt_legacy_revision", created: 1787918460 }))

    assert.deepEqual(result, { outcome: "applied", changed: false, userId: "user_123" })
    assert.deepEqual(fixture.subscriptions[0].updatedAt, previous.updatedAt)
    assert.deepEqual(semanticSubscriptionState(fixture.subscriptions[0]), semanticSubscriptionState(previous))
    assert.equal(fixture.subscriptions[0].lastStripeEventId, "evt_legacy_revision")
    assert.deepEqual(fixture.subscriptions[0].lastStripeAuthoritativeAt, BASE_TIME)
  })

  it("persists only allowlisted normalized metadata instead of provider payload fields", async () => {
    const fixture = createPrismaFixture()
    const event = subscriptionEvent({ eventId: "evt_private_fields", created: 1350 })
    event.data.object.metadata = {
      userId: "user_123",
      membershipLevel: "SUPPORTER",
      purpose: "membership",
      secret: "must-not-persist",
    }
    event.data.object.address = { line1: "must-not-persist" }

    await process(fixture, event)

    assert.deepEqual(fixture.subscriptions[0].metadata, {
      userId: "user_123",
      membershipLevel: "SUPPORTER",
      purpose: "membership",
    })
    assert.doesNotMatch(JSON.stringify(fixture.subscriptions), /must-not-persist/)
    assert.doesNotMatch(JSON.stringify(fixture.receipts), /must-not-persist|address/i)
  })

  it("fails closed for unmapped Prices and ownership or subscription mismatches", async () => {
    const cases = [
      {
        name: "unmapped Price",
        fixture: createPrismaFixture(),
        event: subscriptionEvent({ eventId: "evt_unmapped", created: 1400, priceId: "price_unknown" }),
        code: "price_unmapped",
      },
      {
        name: "metadata user mismatch",
        fixture: createPrismaFixture(),
        event: subscriptionEvent({ eventId: "evt_user_mismatch", created: 1401, userId: "user_other" }),
        code: "ownership_mismatch",
      },
      {
        name: "persisted subscription owner mismatch",
        fixture: createPrismaFixture({
          customers: [{ id: "customer_other", userId: "user_other", stripeCustomerId: "cus_other" }],
          subscriptions: [persistedSubscription()],
        }),
        event: subscriptionEvent({ eventId: "evt_owner_mismatch", created: 1402, customer: "cus_other", userId: "user_other" }),
        code: "ownership_mismatch",
      },
      {
        name: "unfinished receipt owner mismatch",
        fixture: createPrismaFixture({
          customers: [{ id: "customer_other", userId: "user_other", stripeCustomerId: "cus_other" }],
          receipts: [receipt({
            providerEventId: "evt_receipt_owner_mismatch",
            userId: "user_123",
          })],
        }),
        event: subscriptionEvent({
          eventId: "evt_receipt_owner_mismatch",
          created: 1787918400,
          customer: "cus_other",
          userId: "user_other",
        }),
        code: "ownership_mismatch",
      },
      {
        name: "provider subscription mismatch",
        fixture: createPrismaFixture({ subscriptions: [persistedSubscription({ lastStripeEventId: null, lastStripeEventCreatedAt: null })] }),
        event: checkoutEvent({ eventId: "evt_sub_mismatch", created: 1403 }),
        retrieveSubscription: async () => stripeSubscription({ id: "sub_other" }),
        code: "ownership_mismatch",
      },
    ]

    for (const testCase of cases) {
      await assert.rejects(
        process(testCase.fixture, testCase.event, { retrieveSubscription: testCase.retrieveSubscription }),
        (error) => error instanceof MembershipWebhookRetryableError && error.code === testCase.code,
        testCase.name,
      )
      assert.equal(testCase.fixture.subscriptionMutations, 0, testCase.name)
      assert.equal(testCase.fixture.receipts[0].status, "RECEIVED", testCase.name)
      assert.equal(testCase.fixture.receipts[0].failureCode, testCase.code, testCase.name)
    }
  })

  it("rejects malformed or unknown event envelopes without granting access", async () => {
    for (const event of [
      { id: "", type: "customer.subscription.updated", created: 1500, data: { object: stripeSubscription() } },
      { id: "evt_bad_clock", type: "customer.subscription.updated", created: Number.NaN, data: { object: stripeSubscription() } },
      { id: "evt_bad_object", type: "customer.subscription.updated", created: 1500, data: { object: {} } },
      { id: "evt_unknown", type: "invoice.paid", created: 1500, data: { object: stripeSubscription() } },
    ]) {
      const fixture = createPrismaFixture()
      await assert.rejects(
        process(fixture, event),
        (error) => error instanceof MembershipWebhookRetryableError && error.code === "malformed_event",
      )
      assert.equal(fixture.subscriptionMutations, 0)
      assert.equal(fixture.receipts.length, 0)
    }
  })

  it("bounds Serializable conflict retries", async () => {
    const fixture = createPrismaFixture({ conflicts: 3 })

    await assert.rejects(
      process(fixture, subscriptionEvent({ eventId: "evt_conflict", created: 1600 })),
      (error) => error?.code === "P2034",
    )
    assert.equal(fixture.transactionOptions.length, 3)
    assert.equal(fixture.transactionOptions.every(({ isolationLevel }) => isolationLevel === "Serializable"), true)
    assert.equal(fixture.receipts.length, 0)
  })

  it("recovers the exact legacy receipt-creation unique race from a fresh transaction snapshot", async () => {
    const event = subscriptionEvent({ eventId: "evt_legacy_receipt_race", created: 1800 })
    const fixture = createPrismaFixture({
      subscriptions: [persistedSubscription({
        lastStripeEventId: event.id,
        lastStripeEventCreatedAt: new Date(event.created * 1000),
      })],
      receiptCreateRaces: [{
        error: legacyReceiptUniqueError(),
        winner: {
          userId: "user_123",
          status: "APPLIED",
          processedAt: new Date(BASE_TIME),
        },
      }],
    })

    const result = await process(fixture, event)

    assert.deepEqual(result, { outcome: "duplicate", changed: false, userId: "user_123" })
    assert.equal(fixture.transactionOptions.length, 2)
    assert.equal(fixture.subscriptionMutations, 0)
    assert.equal(fixture.receipts.length, 1)
  })

  it("recovers the installed Neon adapter receipt-creation unique race exactly once", async () => {
    const event = subscriptionEvent({ eventId: "evt_adapter_receipt_race", created: 1900 })
    const fixture = createPrismaFixture({
      receiptCreateRaces: [{
        error: adapterReceiptUniqueError(),
        winner: {},
      }],
    })

    const result = await process(fixture, event)

    assert.deepEqual(result, { outcome: "applied", changed: true, userId: "user_123" })
    assert.equal(fixture.transactionOptions.length, 2)
    assert.equal(fixture.subscriptionMutations, 1)
    assert.equal(fixture.receipts.length, 1)
    assert.equal(fixture.receipts[0].status, "APPLIED")
  })

  it("does not retry unrelated or ambiguous receipt-creation errors", async () => {
    const nearMisses = [
      legacyReceiptUniqueError({ code: "P2003" }),
      legacyReceiptUniqueError({ modelName: "CommerceWebhookReceipt" }),
      legacyReceiptUniqueError({ target: ["provider", "id"] }),
      legacyReceiptUniqueError({ target: ["providerEventId", "provider"] }),
      legacyReceiptUniqueError({ target: "provider_providerEventId" }),
      Object.assign(new Error("missing metadata"), { code: "P2002" }),
      adapterReceiptUniqueError({ fields: ["provider", "providerEventId"] }, { code: "P2024" }),
      adapterReceiptUniqueError({ fields: ["provider", "providerEventId"] }, { kind: "ForeignKeyConstraintViolation" }),
      adapterReceiptUniqueError({ fields: ["provider", "providerEventId"] }, { originalCode: "23503" }),
      adapterReceiptUniqueError({ fields: ["provider"] }),
      adapterReceiptUniqueError({ fields: ["providerEventId", "provider"] }),
      adapterReceiptUniqueError({ fields: "MembershipWebhookReceipt_provider_providerEventId_key" }),
      adapterReceiptUniqueError({ index: ["provider", "providerEventId"] }),
      adapterReceiptUniqueError({
        fields: ["provider", "providerEventId"],
        index: "MembershipWebhookReceipt_provider_providerEventId_key",
      }),
      adapterReceiptUniqueError({ index: "CommerceWebhookReceipt_provider_providerEventId_key" }),
      adapterReceiptUniqueError({ index: "MembershipWebhookReceipt_provider_providerEventId_key" }, { modelName: "CommerceWebhookReceipt" }),
    ]

    for (const [index, error] of nearMisses.entries()) {
      const fixture = createPrismaFixture({
        receiptCreateRaces: [{ error, winner: {} }],
      })
      await assert.rejects(
        process(fixture, subscriptionEvent({ eventId: `evt_near_miss_${index}`, created: 2000 + index })),
        (received) => received === error,
      )
      assert.equal(fixture.transactionOptions.length, 1, index)
      assert.equal(fixture.subscriptionMutations, 0, index)
    }
  })

  it("changes one snapshot once under concurrent duplicate delivery", async () => {
    const fixture = createPrismaFixture()
    const event = subscriptionEvent({ eventId: "evt_concurrent", created: 1700 })

    const results = await Promise.all([process(fixture, event), process(fixture, event)])

    assert.deepEqual(results.map(({ outcome, changed }) => ({ outcome, changed })).sort((left, right) => Number(right.changed) - Number(left.changed)), [
      { outcome: "applied", changed: true },
      { outcome: "duplicate", changed: false },
    ])
    assert.equal(fixture.subscriptionMutations, 1)
    assert.equal(fixture.receipts.length, 1)
    assert.equal(fixture.receipts[0].status, "APPLIED")
  })
})
