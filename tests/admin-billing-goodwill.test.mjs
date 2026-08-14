import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import {
  BillingGoodwillMutationError,
  BillingGoodwillPreviewError,
  BILLING_GOODWILL_UNRESOLVED_STATUSES,
  applyInvoiceCredit,
  isBillingGoodwillUnresolvedStatus,
  previewInvoiceCredit,
  reconcileInvoiceCredit,
} from "../lib/admin/billing-goodwill.ts"
import * as adminAccess from "../lib/admin/access.ts"

const { AdminAuthorityDeniedError } = adminAccess

const CREATOR_PRE_CALL_FAILURE_CASES = [
  {
    label: "closed live gate",
    failureCode: "LIVE_STRIPE_DISABLED",
    applyOverrides: { env: { STRIPE_SECRET_KEY: "sk_live_example" } },
  },
  {
    label: "Customer retrieval",
    failureCode: "STRIPE_CUSTOMER_INVALID",
    fixtureOverrides: { customerRetrieveError: new Error("customer unavailable") },
  },
  {
    label: "subscription validation",
    failureCode: "STRIPE_SUBSCRIPTION_INVALID",
    fixtureOverrides: { subscriptionCurrency: "eur" },
  },
  {
    label: "stale starting credit",
    failureCode: "STARTING_CREDIT_CHANGED",
    fixtureOverrides: { customerBalance: -301 },
  },
]

const schemaSource = await readFile(new URL("../prisma/schema.prisma", import.meta.url), "utf8")
const moduleSource = await readFile(new URL("../lib/admin/billing-goodwill.ts", import.meta.url), "utf8")
const migrationSource = await readFile(
  new URL("../prisma/migrations/20260808110000_admin_billing_goodwill/migration.sql", import.meta.url),
  "utf8",
)

describe("Admin billing-goodwill ledger", () => {
  it("defines the durable operation states, evidence fields, relations, and indexes", () => {
    assert.match(schemaSource, /enum AdminBillingGoodwillStatus\s*{\s*PREPARED\s*APPLIED\s*VERIFIED\s*FAILED_BEFORE_MUTATION\s*RECONCILIATION_REQUIRED\s*}/s)
    assert.match(schemaSource, /model AdminBillingGoodwillOperation\s*{[\s\S]*idempotencyKey\s+String\s+@unique[\s\S]*stripeBalanceTransactionId\s+String\?\s+@unique[\s\S]*status\s+AdminBillingGoodwillStatus\s+@default\(PREPARED\)[\s\S]*actor\s+User\s+@relation\("BillingGoodwillActor"[\s\S]*target\s+User\s+@relation\("BillingGoodwillTarget"[\s\S]*@@index\(\[targetUserId, createdAt\]\)[\s\S]*@@index\(\[status, createdAt\]\)[\s\S]*}/s)
    assert.match(schemaSource, /billingGoodwillOperationsAsActor\s+AdminBillingGoodwillOperation\[\]\s+@relation\("BillingGoodwillActor"\)/)
    assert.match(schemaSource, /billingGoodwillOperationsAsTarget\s+AdminBillingGoodwillOperation\[\]\s+@relation\("BillingGoodwillTarget"\)/)

    assert.match(migrationSource, /CREATE TYPE "AdminBillingGoodwillStatus" AS ENUM \('PREPARED', 'APPLIED', 'VERIFIED', 'FAILED_BEFORE_MUTATION', 'RECONCILIATION_REQUIRED'\)/)
    assert.match(migrationSource, /CREATE TABLE "AdminBillingGoodwillOperation"/)
    assert.match(migrationSource, /"idempotencyKey" TEXT NOT NULL/)
    assert.match(migrationSource, /"stripeBalanceTransactionId" TEXT/)
    assert.match(migrationSource, /ON DELETE RESTRICT ON UPDATE CASCADE/g)
  })

  it("exports one canonical unresolved set for prepared, applied, and reconciliation-required operations", () => {
    assert.deepEqual(BILLING_GOODWILL_UNRESOLVED_STATUSES, ["PREPARED", "APPLIED", "RECONCILIATION_REQUIRED"])
    assert.equal(isBillingGoodwillUnresolvedStatus("APPLIED"), true)
    assert.equal(isBillingGoodwillUnresolvedStatus("VERIFIED"), false)
  })
})

describe("read-only Admin invoice-credit preview", () => {
  it("exports the plan-owned Stripe client type for preview and later mutation work", () => {
    assert.match(moduleSource, /import type Stripe from "stripe"/)
    assert.match(moduleSource, /export type StripeGoodwillClient = Pick<Stripe, "customers" \| "subscriptions" \| "invoices">/)
    assert.doesNotMatch(moduleSource, /BillingGoodwillStripeAdapter/)
  })

  it("reloads local and Stripe authority and returns a safe USD next-invoice preview", async () => {
    const fixture = createFixture()

    const preview = await previewInvoiceCredit({
      prismaClient: fixture.prismaClient,
      actorUserId: "admin-1",
      targetUserId: "user-1",
      stripeClient: fixture.stripeClient,
    })

    assert.deepEqual(preview, {
      customerId: "cus_test",
      subscriptionId: "sub_test",
      membershipLevel: "SUPPORTER",
      status: "active",
      currentCreditCents: 300,
      projectedNextInvoiceCents: 207,
      currency: "usd",
      livemode: false,
    })
    assert.deepEqual(fixture.calls, [
      "user.findUnique:admin-1",
      "user.findUnique:user-1",
      "stripeCustomer.findMany:user-1",
      "membershipSubscription.findMany:user-1",
      "customers.retrieve:cus_test",
      "subscriptions.retrieve:sub_test",
      "invoices.createPreview:cus_test:sub_test:next",
    ])
  })

  it("returns canonical positive zero when Stripe reports a zero customer balance", async () => {
    const fixture = createFixture({ stripeCustomer: stripeCustomer({ balance: 0 }) })

    const result = await preview(fixture)

    assert.deepEqual(result, {
      customerId: "cus_test",
      subscriptionId: "sub_test",
      membershipLevel: "SUPPORTER",
      status: "active",
      currentCreditCents: 0,
      projectedNextInvoiceCents: 207,
      currency: "usd",
      livemode: false,
    })
    assert.equal(Object.is(result.currentCreditCents, -0), false)
  })

  for (const testCase of [
    {
      name: "missing local Stripe customer",
      code: "CUSTOMER_COUNT_INVALID",
      overrides: { customers: [] },
    },
    {
      name: "multiple local Stripe customers",
      code: "CUSTOMER_COUNT_INVALID",
      overrides: { customers: [{ stripeCustomerId: "cus_test" }, { stripeCustomerId: "cus_other" }] },
    },
    {
      name: "zero eligible subscriptions",
      code: "SUBSCRIPTION_COUNT_INVALID",
      overrides: { subscriptions: [] },
    },
    {
      name: "multiple eligible subscriptions",
      code: "SUBSCRIPTION_COUNT_INVALID",
      overrides: { subscriptions: [localSubscription(), localSubscription({ stripeSubscriptionId: "sub_other" })] },
    },
    {
      name: "a canceled local subscription",
      code: "SUBSCRIPTION_COUNT_INVALID",
      overrides: { subscriptions: [localSubscription({ status: "canceled" })] },
    },
    {
      name: "an incomplete local subscription",
      code: "SUBSCRIPTION_COUNT_INVALID",
      overrides: { subscriptions: [localSubscription({ status: "incomplete" })] },
    },
    {
      name: "a non-Supporter local membership",
      code: "SUBSCRIPTION_COUNT_INVALID",
      overrides: { subscriptions: [localSubscription({ membershipLevel: "THERAPIST" })] },
    },
  ]) {
    it(`fails closed before Stripe for ${testCase.name}`, async () => {
      const fixture = createFixture(testCase.overrides)
      await assertPreviewRejection(fixture, testCase.code)
      assert.equal(fixture.calls.some((call) => call.startsWith("customers.retrieve")), false)
    })
  }

  it("denies an Admin whose fresh database authority is not verified", async () => {
    const fixture = createFixture({
      actor: { id: "admin-1", name: "Admin", email: "admin@example.test", emailVerified: null, roles: [{ role: "ADMIN", status: "VERIFIED" }] },
    })
    await assert.rejects(() => preview(fixture), {
      message: "Full administration requires verified database authority.",
    })
    assert.deepEqual(fixture.calls, ["user.findUnique:admin-1"])
  })

  it("fails closed when the target no longer exists", async () => {
    const fixture = createFixture({ target: null })
    await assertPreviewRejection(fixture, "TARGET_NOT_FOUND")
    assert.deepEqual(fixture.calls, ["user.findUnique:admin-1", "user.findUnique:user-1"])
  })

  for (const testCase of [
    {
      name: "a deleted Stripe customer",
      code: "STRIPE_CUSTOMER_INVALID",
      overrides: { stripeCustomer: { id: "cus_test", deleted: true } },
    },
    {
      name: "a retrieved customer identity mismatch",
      code: "STRIPE_CUSTOMER_INVALID",
      overrides: { stripeCustomer: stripeCustomer({ id: "cus_other" }) },
    },
    {
      name: "a local customer/subscription mismatch",
      code: "CUSTOMER_SUBSCRIPTION_MISMATCH",
      overrides: { subscriptions: [localSubscription({ stripeCustomerId: "cus_other" })] },
    },
    {
      name: "an authoritative customer/subscription mismatch",
      code: "CUSTOMER_SUBSCRIPTION_MISMATCH",
      overrides: { stripeSubscription: stripeSubscription({ customer: "cus_other" }) },
    },
    {
      name: "a retrieved subscription identity mismatch",
      code: "STRIPE_SUBSCRIPTION_INVALID",
      overrides: { stripeSubscription: stripeSubscription({ id: "sub_other" }) },
    },
    {
      name: "an expanded subscription customer reference",
      code: "CUSTOMER_SUBSCRIPTION_MISMATCH",
      overrides: { stripeSubscription: stripeSubscription({ customer: stripeCustomer() }) },
    },
    {
      name: "a subscription live/test mode mismatch",
      code: "STRIPE_SUBSCRIPTION_INVALID",
      overrides: { stripeSubscription: stripeSubscription({ livemode: true }) },
    },
    {
      name: "an authoritative canceled subscription",
      code: "STRIPE_SUBSCRIPTION_INVALID",
      overrides: { stripeSubscription: stripeSubscription({ status: "canceled" }) },
    },
    {
      name: "an authoritative incomplete subscription",
      code: "STRIPE_SUBSCRIPTION_INVALID",
      overrides: { stripeSubscription: stripeSubscription({ status: "incomplete" }) },
    },
    {
      name: "a non-USD invoice preview",
      code: "STRIPE_PREVIEW_INVALID",
      overrides: { stripePreview: stripePreview({ currency: "eur" }) },
    },
    {
      name: "a preview customer identity mismatch",
      code: "STRIPE_PREVIEW_INVALID",
      overrides: { stripePreview: stripePreview({ customer: "cus_other" }) },
    },
    {
      name: "an expanded preview customer reference",
      code: "STRIPE_PREVIEW_INVALID",
      overrides: { stripePreview: stripePreview({ customer: stripeCustomer() }) },
    },
    {
      name: "a live/test mode mismatch",
      code: "STRIPE_PREVIEW_INVALID",
      overrides: { stripePreview: stripePreview({ livemode: true }) },
    },
    {
      name: "a fractional projected amount",
      code: "STRIPE_PREVIEW_INVALID",
      overrides: { stripePreview: stripePreview({ amount_due: 20.7 }) },
    },
    {
      name: "an unsafe customer balance",
      code: "STRIPE_CUSTOMER_INVALID",
      overrides: { stripeCustomer: stripeCustomer({ balance: Number.MAX_SAFE_INTEGER + 1 }) },
    },
    {
      name: "a positive balance that is not customer credit",
      code: "STRIPE_CUSTOMER_INVALID",
      overrides: { stripeCustomer: stripeCustomer({ balance: 300 }) },
    },
  ]) {
    it(`fails closed for ${testCase.name}`, async () => {
      await assertPreviewRejection(createFixture(testCase.overrides), testCase.code)
    })
  }

  for (const testCase of [
    { name: "customer retrieval", code: "STRIPE_CUSTOMER_INVALID", overrides: { customerError: new Error("sk_live_raw_customer") } },
    { name: "subscription retrieval", code: "STRIPE_SUBSCRIPTION_INVALID", overrides: { subscriptionError: new Error("sk_live_raw_subscription") } },
    { name: "invoice preview", code: "STRIPE_PREVIEW_INVALID", overrides: { invoiceError: new Error("sk_live_raw_invoice") } },
  ]) {
    it(`reduces ${testCase.name} failures to a safe code`, async () => {
      const fixture = createFixture(testCase.overrides)
      await assert.rejects(
        () => preview(fixture),
        (error) => error instanceof BillingGoodwillPreviewError
          && error.code === testCase.code
          && !error.message.includes("sk_live"),
      )
    })
  }
})

describe("Admin invoice-credit mutation and reconciliation", () => {
  it("applies the inclusive one-cent and ten-thousand-cent boundaries with the exact Stripe request", async () => {
    for (const amountCents of [1, 10_000]) {
      const fixture = createMutationFixture({ amountCents })
      const result = await apply(fixture, { amountCents })

      assert.deepEqual(result, {
        operationId: "goodwill-1",
        status: "VERIFIED",
        amountCents,
        endingCreditCents: 300 + amountCents,
        currentCreditCents: 300 + amountCents,
        replayed: false,
        emailIntentId: "intent-1",
      })
      assert.deepEqual(fixture.stripeRequests, [{
        customerId: "cus_test",
        payload: {
          amount: -amountCents,
          currency: "usd",
          description: "MassageLab billing goodwill",
          metadata: { operationId: "goodwill-1", targetUserId: "user-1" },
        },
        options: { idempotencyKey: "billing-op-1" },
      }])
      assert.equal(fixture.state.operations.get("billing-op-1").status, "VERIFIED")
      assert.equal(fixture.state.actions.size, 1)
      assert.equal(fixture.state.activities.size, 1)
      assert.equal(fixture.state.intents.size, 1)
    }
  })

  it("rejects zero and ten-thousand-and-one cents before local or Stripe work", async () => {
    for (const amountCents of [0, 10_001]) {
      const fixture = createMutationFixture({ amountCents })
      await assert.rejects(() => apply(fixture, { amountCents }), /whole number of cents from 1 through 10000/i)
      assert.equal(fixture.state.transactionAttempts, 0)
      assert.equal(fixture.stripeRequests.length, 0)
    }
  })

  it("normalizes the confirmation email and rejects a mismatch before preparation", async () => {
    const accepted = createMutationFixture()
    assert.equal((await apply(accepted, { confirmationEmail: "  USER@EXAMPLE.TEST " })).status, "VERIFIED")

    const rejected = createMutationFixture()
    await assert.rejects(
      () => apply(rejected, { confirmationEmail: "other@example.test" }),
      /confirmation email does not match/i,
    )
    assert.equal(rejected.state.operations.size, 0)
    assert.equal(rejected.stripeRequests.length, 0)
  })

  it("fails a stale refreshed starting credit without calling Stripe", async () => {
    const fixture = createMutationFixture({ customerBalance: -301 })
    const result = await apply(fixture)

    assert.deepEqual(result, {
      operationId: "goodwill-1",
      status: "FAILED_BEFORE_MUTATION",
      amountCents: 500,
      endingCreditCents: null,
      currentCreditCents: null,
      replayed: false,
      emailIntentId: null,
    })
    assert.equal(fixture.state.operations.get("billing-op-1").failureCode, "STARTING_CREDIT_CHANGED")
    assert.equal(fixture.stripeRequests.length, 0)
    assert.equal(fixture.state.intents.size, 0)
  })

  it("returns an exact VERIFIED duplicate without a second evidence bundle", async () => {
    const fixture = createMutationFixture()
    const created = await apply(fixture)
    const replayed = await apply(fixture)

    assert.equal(created.currentCreditCents, 800)
    assert.deepEqual(replayed, { ...created, currentCreditCents: null, replayed: true })
    assert.equal(fixture.stripeRequests.length, 1)
    assert.equal(fixture.state.actions.size, 1)
    assert.equal(fixture.state.activities.size, 1)
    assert.equal(fixture.state.intents.size, 1)
  })

  it("serializes concurrent exact duplicates into one local operation and one evidence bundle", async () => {
    const fixture = createMutationFixture()
    const results = await Promise.all([apply(fixture), apply(fixture)])

    assert.deepEqual(results.map((result) => result.status), ["VERIFIED", "RECONCILIATION_REQUIRED"])
    assert.equal(fixture.state.operations.size, 1)
    assert.equal(fixture.state.actions.size, 1)
    assert.equal(fixture.state.activities.size, 1)
    assert.equal(fixture.state.intents.size, 1)
    assert.equal(fixture.state.operations.get("billing-op-1").endingBalanceCents, 800)
    assert.equal((await apply(fixture)).status, "VERIFIED")
    assert.equal(fixture.stripeRequests.length, 1)
    assert.equal(fixture.stripeRequests.every((request) => request.options.idempotencyKey === "billing-op-1"), true)
  })

  it("fails closed when an idempotency replay changes any immutable payload field", async () => {
    for (const mismatch of [
      { actorUserId: "admin-2" },
      { targetUserId: "user-2", confirmationEmail: "user-2@example.test" },
      { amountCents: 501 },
      { expectedStartingCreditCents: 301 },
      { reasonCode: "ADMIN_CORRECTION" },
      { internalNote: "Different immutable note." },
    ]) {
      const fixture = createMutationFixture()
      await apply(fixture)
      await assert.rejects(() => apply(fixture, mismatch), /operation key is already in use/i)
      assert.equal(fixture.stripeRequests.length, 1)
      assert.equal(fixture.state.actions.size, 1)
    }
  })

  it("rejects an unrelated shared AdminAction key before preparing or calling Stripe", async () => {
    const fixture = createMutationFixture({ unrelatedAdminAction: true })

    await assert.rejects(() => apply(fixture), /operation key is already in use/i)

    assert.equal(fixture.state.operations.size, 0)
    assert.equal(fixture.stripeRequests.length, 0)
    assert.equal(fixture.state.actions.size, 1)
    assert.equal(fixture.state.activities.size, 0)
    assert.equal(fixture.state.intents.size, 0)
  })

  it("permits VERIFIED replay only when the goodwill row owns a coherent shared bundle", async () => {
    const fixture = createMutationFixture()
    await apply(fixture)
    fixture.state.actions.get("billing-op-1").actionKind = "SECURITY_SESSIONS_REVOKED"

    await assert.rejects(
      () => apply(fixture),
      (error) => error instanceof BillingGoodwillMutationError
        && error.code === "OPERATION_KEY_IN_USE",
    )

    assert.equal(fixture.stripeRequests.length, 1)
    assert.equal(fixture.state.operations.size, 1)
    assert.equal(fixture.state.intents.size, 1)
  })

  it("marks a definite pre-call provider failure FAILED_BEFORE_MUTATION with a safe code", async () => {
    const fixture = createMutationFixture({ customerRetrieveError: new Error("sk_live_raw_customer") })
    const result = await apply(fixture)

    assert.equal(result.status, "FAILED_BEFORE_MUTATION")
    assert.equal(result.emailIntentId, null)
    assert.equal(fixture.state.operations.get("billing-op-1").failureCode, "STRIPE_CUSTOMER_INVALID")
    assert.equal(JSON.stringify(fixture.state.operations.get("billing-op-1")).includes("sk_live"), false)
    assert.equal(fixture.stripeRequests.length, 0)
  })

  for (const testCase of CREATOR_PRE_CALL_FAILURE_CASES) {
    it(`preserves a reconciler's no-ID claim across the ${testCase.label} route`, async () => {
      const fixture = createMutationFixture({
        ...testCase.fixtureOverrides,
        concurrentClaimBeforePreCallFailureSettlement: {
          failureCode: testCase.failureCode,
          status: "RECONCILIATION_REQUIRED",
          persistedFailureCode: "RECONCILER_PROVIDER_ATTEMPT",
        },
      })

      const result = await apply(fixture, testCase.applyOverrides)
      const operation = fixture.state.operations.get("billing-op-1")

      assert.equal(result.status, "RECONCILIATION_REQUIRED", testCase.label)
      assert.equal(operation.status, "RECONCILIATION_REQUIRED", testCase.label)
      assert.equal(operation.failureCode, "RECONCILER_PROVIDER_ATTEMPT", testCase.label)
      assert.equal(operation.stripeBalanceTransactionId, null, testCase.label)
      assert.equal(operation.actorUserId, "admin-1", testCase.label)
      assert.equal(operation.targetUserId, "user-1", testCase.label)
      assert.equal(operation.idempotencyKey, "billing-op-1", testCase.label)
      assert.deepEqual(fixture.state.preCallFailureWhereClauses, [{
        id: "goodwill-1",
        actorUserId: "admin-1",
        targetUserId: "user-1",
        idempotencyKey: "billing-op-1",
        status: "PREPARED",
        stripeBalanceTransactionId: null,
      }], testCase.label)
      assert.equal(fixture.stripeRequests.length, 0, testCase.label)
    })
  }

  for (const testCase of CREATOR_PRE_CALL_FAILURE_CASES) {
    it(`preserves a reconciler's applied transaction across the ${testCase.label} route`, async () => {
      const fixture = createMutationFixture({
        ...testCase.fixtureOverrides,
        concurrentClaimBeforePreCallFailureSettlement: {
          failureCode: testCase.failureCode,
          status: "APPLIED",
          stripeBalanceTransactionId: "cbtxn_reconciler",
        },
      })

      const result = await apply(fixture, testCase.applyOverrides)
      const operation = fixture.state.operations.get("billing-op-1")

      assert.deepEqual(result, {
        operationId: "goodwill-1",
        status: "RECONCILIATION_REQUIRED",
        amountCents: 500,
        endingCreditCents: null,
        currentCreditCents: null,
        replayed: false,
        emailIntentId: null,
      }, testCase.label)
      assert.equal(operation.status, "APPLIED", testCase.label)
      assert.equal(operation.failureCode, null, testCase.label)
      assert.equal(operation.stripeBalanceTransactionId, "cbtxn_reconciler", testCase.label)
      assert.equal(operation.actorUserId, "admin-1", testCase.label)
      assert.equal(operation.targetUserId, "user-1", testCase.label)
      assert.equal(operation.idempotencyKey, "billing-op-1", testCase.label)
      assert.deepEqual(fixture.state.preCallFailureWhereClauses, [{
        id: "goodwill-1",
        actorUserId: "admin-1",
        targetUserId: "user-1",
        idempotencyKey: "billing-op-1",
        status: "PREPARED",
        stripeBalanceTransactionId: null,
      }], testCase.label)
      assert.equal(fixture.stripeRequests.length, 0, testCase.label)
    })
  }

  it("marks an ambiguous create exception RECONCILIATION_REQUIRED without notifying", async () => {
    const fixture = createMutationFixture({ createErrorOnce: new Error("provider payload secret") })
    const result = await apply(fixture)

    assert.equal(result.status, "RECONCILIATION_REQUIRED")
    assert.equal(result.emailIntentId, null)
    assert.equal(fixture.state.operations.get("billing-op-1").failureCode, "STRIPE_CREATE_OUTCOME_UNKNOWN")
    assert.equal(JSON.stringify(fixture.state.operations.get("billing-op-1")).includes("secret"), false)
    assert.equal(fixture.state.intents.size, 0)
  })

  it("keeps exact apply replays non-mutating while an unresolved operation awaits explicit reconciliation", async () => {
    const fixture = createMutationFixture({ createErrorOnce: new Error("timeout") })
    assert.equal((await apply(fixture)).status, "RECONCILIATION_REQUIRED")

    const replay = await apply(fixture)

    assert.equal(replay.status, "RECONCILIATION_REQUIRED")
    assert.equal(replay.replayed, true)
    assert.equal(fixture.stripeRequests.length, 1)
    assert.equal(fixture.state.intents.size, 0)
  })

  it("lets only the PREPARED creator cross the post-commit provider boundary", async () => {
    const providerGate = deferred()
    const providerStarted = deferred()
    const fixture = createMutationFixture({
      customerBalance: -301,
      customerRetrieveGate: providerGate.promise,
      onCustomerRetrieve: () => providerStarted.resolve(),
    })
    const initialPromise = apply(fixture)
    await providerStarted.promise

    const duplicatePromise = apply(fixture)
    await new Promise((resolve) => setImmediate(resolve))
    providerGate.resolve()
    const [duplicate, initial] = await Promise.all([duplicatePromise, initialPromise])
    assert.equal(duplicate.status, "RECONCILIATION_REQUIRED")
    assert.equal(fixture.stripeCalls.filter((call) => call.startsWith("customers.retrieve:")).length, 1)
    assert.equal(initial.status, "FAILED_BEFORE_MUTATION")
    assert.equal(fixture.state.operations.get("billing-op-1").status, "FAILED_BEFORE_MUTATION")
    assert.equal(fixture.stripeRequests.length, 0)
  })

  it("reissues an ambiguous no-ID request only before the conservative retry margin", async () => {
    const cases = [
      { label: "just inside", now: "2026-08-08T23:54:59.999Z", expectedStatus: "VERIFIED", expectedRequests: 2, expectedCode: null },
      { label: "exact conservative boundary", now: "2026-08-08T23:55:00.000Z", expectedStatus: "RECONCILIATION_REQUIRED", expectedRequests: 1, expectedCode: "IDEMPOTENCY_RETRY_WINDOW_EXPIRED" },
      { label: "outside", now: "2026-08-08T23:55:00.001Z", expectedStatus: "RECONCILIATION_REQUIRED", expectedRequests: 1, expectedCode: "IDEMPOTENCY_RETRY_WINDOW_EXPIRED" },
    ]

    for (const testCase of cases) {
      const fixture = createMutationFixture({ createErrorOnce: new Error("timeout") })
      assert.equal((await apply(fixture)).status, "RECONCILIATION_REQUIRED")

      const result = await reconcile(fixture, { now: new Date(testCase.now) })

      assert.equal(result.status, testCase.expectedStatus, testCase.label)
      assert.equal(fixture.stripeRequests.length, testCase.expectedRequests, testCase.label)
      assert.equal(fixture.state.operations.get("billing-op-1").failureCode, testCase.expectedCode, testCase.label)
    }
  })

  it("re-reads the clock after provider reads and never creates when the conservative margin expires", async () => {
    const fixture = createMutationFixture()
    seedUnresolvedOperation(fixture, { status: "PREPARED", stripeBalanceTransactionId: null })
    const times = [
      new Date("2026-08-08T23:54:59.000Z"),
      new Date("2026-08-08T23:55:00.000Z"),
    ]

    const result = await reconcile(fixture, { now: undefined, clock: () => times.shift() ?? new Date("2026-08-08T23:55:00.000Z") })

    assert.equal(result.status, "RECONCILIATION_REQUIRED")
    assert.equal(fixture.state.operations.get("billing-op-1").failureCode, "IDEMPOTENCY_RETRY_WINDOW_EXPIRED")
    assert.equal(fixture.stripeCalls.includes("customers.retrieve:cus_test"), true)
    assert.equal(fixture.stripeCalls.includes("subscriptions.retrieve:sub_test"), true)
    assert.equal(fixture.stripeRequests.length, 0)
  })

  it("recovers realistic PREPARED and APPLIED crashes through the original operation", async () => {
    const prepared = createMutationFixture()
    seedUnresolvedOperation(prepared, { status: "PREPARED", stripeBalanceTransactionId: null })
    const preparedResult = await reconcile(prepared)
    assert.equal(preparedResult.status, "VERIFIED")
    assert.equal(prepared.stripeRequests.length, 1)

    const applied = createMutationFixture({ customerBalance: -800 })
    seedUnresolvedOperation(applied, { status: "APPLIED", stripeBalanceTransactionId: "cbtxn_test" })
    const appliedResult = await reconcile(applied)
    assert.equal(appliedResult.status, "VERIFIED")
    assert.equal(applied.stripeRequests.length, 0)
    assert.equal(applied.stripeCalls.includes("transactions.retrieve:cus_test:cbtxn_test"), true)
  })

  it("marks failed authoritative readback RECONCILIATION_REQUIRED without notifying", async () => {
    const fixture = createMutationFixture({ transactionRetrieveErrorOnce: new Error("raw transaction") })
    const result = await apply(fixture)

    assert.equal(result.status, "RECONCILIATION_REQUIRED")
    assert.equal(fixture.state.operations.get("billing-op-1").stripeBalanceTransactionId, "cbtxn_test")
    assert.equal(fixture.state.operations.get("billing-op-1").failureCode, "STRIPE_READBACK_FAILED")
    assert.equal(fixture.state.intents.size, 0)
  })

  it("reconciles a known transaction by persisted identity without another create or current subscription eligibility", async () => {
    for (const drift of ["canceled", "customer-changed"]) {
      const fixture = createMutationFixture({ transactionRetrieveErrorOnce: new Error("readback unavailable") })
      assert.equal((await apply(fixture)).status, "RECONCILIATION_REQUIRED")
      fixture.billingState.subscriptionStatus = drift === "canceled" ? "canceled" : "active"
      if (drift === "customer-changed") fixture.billingState.customerId = "cus_other"
      const subscriptionReadsBefore = fixture.stripeCalls.filter((call) => call.startsWith("subscriptions.retrieve:")).length

      const result = await reconcile(fixture)

      assert.equal(result.status, "VERIFIED", drift)
      assert.equal(result.endingCreditCents, 800, drift)
      assert.equal(fixture.stripeRequests.length, 1, drift)
      assert.equal(fixture.stripeCalls.filter((call) => call.startsWith("subscriptions.retrieve:")).length, subscriptionReadsBefore, drift)
      assert.equal(fixture.stripeCalls.includes("transactions.retrieve:cus_test:cbtxn_test"), true, drift)
    }
  })

  it("separates an exact historical transaction ending from the current Customer credit", async () => {
    const fixture = createMutationFixture({
      amountCents: 300,
      customerBalance: -125,
      transactionOverrides: { ending_balance: -650 },
    })
    seedUnresolvedOperation(fixture, { status: "APPLIED", stripeBalanceTransactionId: "cbtxn_test" })
    fixture.state.operations.get("billing-op-1").startingBalanceCents = 500

    const result = await reconcile(fixture, { expectedStartingCreditCents: 500 })

    assert.deepEqual(result, {
      operationId: "goodwill-1",
      status: "VERIFIED",
      amountCents: 300,
      endingCreditCents: 650,
      currentCreditCents: 125,
      replayed: true,
      emailIntentId: "intent-1",
    })
    assert.equal(fixture.state.operations.get("billing-op-1").endingBalanceCents, 650)
    assert.equal(fixture.stripeRequests.length, 0)
    assert.equal(fixture.stripeCalls.includes("transactions.retrieve:cus_test:cbtxn_test"), true)
    const action = fixture.state.actions.get("billing-op-1")
    assert.match(action.activity.explanation, /balance immediately after this credit was \$6\.50/)
    assert.match(action.emailIntent.message, /balance immediately after this credit was \$6\.50/)
    assert.doesNotMatch(`${action.activity.explanation} ${action.emailIntent.message}`, /invoice credit is now/i)

    const providerCallCount = fixture.stripeCalls.length
    const localReplay = await apply(fixture, { expectedStartingCreditCents: 500 })
    assert.deepEqual(localReplay, { ...result, currentCreditCents: null })
    assert.equal(fixture.stripeCalls.length, providerCallCount)
  })

  it("rejects typed denial when revoked before provider creation and records owned failure", async () => {
    assert.equal(typeof AdminAuthorityDeniedError, "function")
    const authorityLoadStarted = deferred()
    const authorityGate = deferred()
    const fixture = createMutationFixture({
      onFinalAuthorityLoad: () => authorityLoadStarted.resolve(),
      finalAuthorityGate: authorityGate.promise,
    })
    const resultPromise = apply(fixture)
    await authorityLoadStarted.promise

    fixture.revokeAdmin("admin-1")
    authorityGate.resolve()

    await assert.rejects(
      () => resultPromise,
      (error) => error instanceof AdminAuthorityDeniedError
        && error.message === "Full administration requires verified database authority.",
    )
    assert.equal(fixture.stripeCalls.includes("customers.retrieve:cus_test"), true)
    assert.equal(fixture.stripeCalls.includes("subscriptions.retrieve:sub_test"), true)
    assert.equal(fixture.stripeRequests.length, 0)
    assert.equal(fixture.state.operations.get("billing-op-1").status, "FAILED_BEFORE_MUTATION")
    assert.equal(fixture.state.operations.get("billing-op-1").failureCode, "ADMIN_AUTHORITY_REVOKED")
  })

  it("keeps authority infrastructure failures unresolved and retryable without provider creation", async () => {
    for (const { label, failure } of [
      { label: "database outage", failure: new Error("database target@example.test outage") },
      { label: "adapter error", failure: Object.assign(new Error("adapter secret"), { code: "P1001" }) },
      { label: "timeout", failure: Object.assign(new Error("timed out with raw details"), { name: "TimeoutError" }) },
      { label: "unknown exception", failure: { unexpected: "unrecognized raw exception" } },
    ]) {
      const fixture = createMutationFixture({ finalAuthorityError: failure })

      await assert.rejects(() => apply(fixture), (error) => error === failure, label)

      const operation = fixture.state.operations.get("billing-op-1")
      assert.equal(operation.status, "PREPARED", label)
      assert.equal(operation.failureCode, null, label)
      assert.equal(fixture.stripeRequests.length, 0, label)
      assert.equal(JSON.stringify(operation).includes("raw"), false, label)
      assert.equal(JSON.stringify(operation).includes("target@example.test"), false, label)
    }
  })

  it("scopes final authority failures to each actor's second authority load", async () => {
    const finalAuthorityError = new Error("final authority database outage")
    const fixture = createMutationFixture({ finalAuthorityError })

    const initial = await apply(fixture, { env: { STRIPE_SECRET_KEY: "sk_live_example" } })
    assert.equal(initial.status, "FAILED_BEFORE_MUTATION")

    await assert.rejects(
      () => reconcile(fixture, { actorUserId: "admin-2" }),
      (error) => error instanceof BillingGoodwillMutationError
        && error.code === "OPERATION_NOT_RECONCILABLE",
    )
  })

  it("does not rewrite a lost-owned or pre-existing operation as definitely unmutated", async () => {
    const lostOwnerStarted = deferred()
    const lostOwnerGate = deferred()
    const lostOwner = createMutationFixture({
      onFinalAuthorityLoad: () => lostOwnerStarted.resolve(),
      finalAuthorityGate: lostOwnerGate.promise,
    })
    const lostOwnerPromise = apply(lostOwner)
    await lostOwnerStarted.promise
    Object.assign(lostOwner.state.operations.get("billing-op-1"), {
      status: "RECONCILIATION_REQUIRED",
      failureCode: "CONCURRENT_OWNER_CHANGED",
    })
    lostOwner.revokeAdmin("admin-1")
    lostOwnerGate.resolve()
    await assert.rejects(() => lostOwnerPromise, (error) => error instanceof AdminAuthorityDeniedError)
    assert.equal(lostOwner.state.operations.get("billing-op-1").status, "RECONCILIATION_REQUIRED")
    assert.equal(lostOwner.state.operations.get("billing-op-1").failureCode, "CONCURRENT_OWNER_CHANGED")
    assert.equal(lostOwner.stripeRequests.length, 0)

    const replayStarted = deferred()
    const replayGate = deferred()
    const replay = createMutationFixture({
      onFinalAuthorityLoad: () => replayStarted.resolve(),
      finalAuthorityGate: replayGate.promise,
    })
    seedUnresolvedOperation(replay, { status: "PREPARED", stripeBalanceTransactionId: null })
    const replayPromise = reconcile(replay)
    await replayStarted.promise
    replay.revokeAdmin("admin-1")
    replayGate.resolve()
    await assert.rejects(() => replayPromise, (error) => error instanceof AdminAuthorityDeniedError)
    assert.equal(replay.state.operations.get("billing-op-1").status, "RECONCILIATION_REQUIRED")
    assert.equal(replay.state.operations.get("billing-op-1").failureCode, null)
    assert.equal(replay.stripeRequests.length, 0)
  })

  it("propagates typed authority denial without downgrading a concurrent applied transaction", async () => {
    const authorityStarted = deferred()
    const authorityGate = deferred()
    const fixture = createMutationFixture({
      onFinalAuthorityLoad: () => authorityStarted.resolve(),
      finalAuthorityGate: authorityGate.promise,
    })
    const resultPromise = apply(fixture)
    await authorityStarted.promise

    Object.assign(fixture.state.operations.get("billing-op-1"), {
      status: "APPLIED",
      stripeBalanceTransactionId: "cbtxn_reconciler",
      failureCode: null,
      appliedAt: new Date("2026-08-08T00:01:00.000Z"),
    })
    fixture.revokeAdmin("admin-1")
    authorityGate.resolve()

    await assert.rejects(
      () => resultPromise,
      (error) => error instanceof AdminAuthorityDeniedError,
    )
    const operation = fixture.state.operations.get("billing-op-1")
    assert.equal(operation.status, "APPLIED")
    assert.equal(operation.stripeBalanceTransactionId, "cbtxn_reconciler")
    assert.equal(operation.failureCode, null)
    assert.equal(fixture.stripeRequests.length, 0)
  })

  it("keeps a creator revocation unresolved once a different reconciler durably enters the provider attempt", async () => {
    const creatorAuthorityStarted = deferred()
    const creatorAuthorityGate = deferred()
    const reconcilerCreateStarted = deferred()
    const reconcilerCreateGate = deferred()
    const fixture = createMutationFixture({
      onFinalAuthorityLoad: (actorUserId) => {
        if (actorUserId === "admin-1") creatorAuthorityStarted.resolve()
      },
      finalAuthorityGates: { "admin-1": creatorAuthorityGate.promise },
      onCreateBalanceTransaction: () => reconcilerCreateStarted.resolve(),
      createBalanceTransactionGate: reconcilerCreateGate.promise,
      createErrorOnce: new Error("reconciler provider outcome unknown"),
    })

    const creatorPromise = apply(fixture)
    await creatorAuthorityStarted.promise

    const reconcilerPromise = reconcile(fixture, { actorUserId: "admin-2" })
    await reconcilerCreateStarted.promise
    fixture.revokeAdmin("admin-1")
    creatorAuthorityGate.resolve()

    await assert.rejects(
      () => creatorPromise,
      (error) => error instanceof AdminAuthorityDeniedError,
    )
    reconcilerCreateGate.resolve()
    const reconciled = await reconcilerPromise

    const operation = fixture.state.operations.get("billing-op-1")
    assert.equal(reconciled.status, "RECONCILIATION_REQUIRED")
    assert.equal(operation.status, "RECONCILIATION_REQUIRED")
    assert.notEqual(operation.failureCode, "ADMIN_AUTHORITY_REVOKED")
    assert.equal(operation.actorUserId, "admin-1")
    assert.equal(operation.idempotencyKey, "billing-op-1")
    assert.equal(fixture.stripeRequests.length, 1)
    assert.equal(fixture.stripeRequests[0].options.idempotencyKey, "billing-op-1")
  })

  it("keeps a post-check authority race ambiguous instead of claiming no mutation", async () => {
    const providerStarted = deferred()
    const providerGate = deferred()
    const fixture = createMutationFixture({
      onCreateBalanceTransaction: () => providerStarted.resolve(),
      createBalanceTransactionGate: providerGate.promise,
      createErrorOnce: new Error("provider outcome unknown"),
    })
    const resultPromise = apply(fixture)
    await providerStarted.promise

    fixture.revokeAdmin("admin-1")
    providerGate.resolve()
    const result = await resultPromise

    assert.equal(result.status, "RECONCILIATION_REQUIRED")
    assert.equal(fixture.state.operations.get("billing-op-1").status, "RECONCILIATION_REQUIRED")
    assert.equal(fixture.state.operations.get("billing-op-1").failureCode, "STRIPE_CREATE_OUTCOME_UNKNOWN")
    assert.equal(fixture.stripeRequests.length, 1)
  })

  it("verifies first settlement when provider activity separates transaction and current balances", async () => {
    const fixture = createMutationFixture({
      amountCents: 300,
      customerBalance: -500,
      transactionOverrides: { ending_balance: -650 },
      readbackCustomerOverrides: { balance: -125 },
    })

    const result = await apply(fixture, { expectedStartingCreditCents: 500 })

    assert.deepEqual(result, {
      operationId: "goodwill-1",
      status: "VERIFIED",
      amountCents: 300,
      endingCreditCents: 650,
      currentCreditCents: 125,
      replayed: false,
      emailIntentId: "intent-1",
    })
    assert.equal(fixture.state.operations.get("billing-op-1").endingBalanceCents, 650)
    assert.equal(fixture.stripeRequests.length, 1)
  })

  it("verifies exact historical evidence when the refreshed Customer is unavailable", async () => {
    const fixture = createMutationFixture({
      readbackCustomerRetrieveError: new Error("current Customer unavailable"),
    })

    const result = await apply(fixture)

    assert.deepEqual(result, {
      operationId: "goodwill-1",
      status: "VERIFIED",
      amountCents: 500,
      endingCreditCents: 800,
      currentCreditCents: null,
      replayed: false,
      emailIntentId: "intent-1",
    })
    assert.equal(fixture.state.operations.get("billing-op-1").endingBalanceCents, 800)
    assert.equal(fixture.state.actions.get("billing-op-1").afterState.endingCreditCents, 800)
    assert.equal(fixture.stripeRequests.length, 1)
  })

  it("verifies exact historical evidence when the refreshed Customer has a safe debit balance", async () => {
    const fixture = createMutationFixture({ readbackCustomerOverrides: { balance: 125 } })

    const result = await apply(fixture)

    assert.deepEqual(result, {
      operationId: "goodwill-1",
      status: "VERIFIED",
      amountCents: 500,
      endingCreditCents: 800,
      currentCreditCents: null,
      replayed: false,
      emailIntentId: "intent-1",
    })
    assert.equal(fixture.state.operations.get("billing-op-1").endingBalanceCents, 800)
    assert.equal(fixture.state.actions.get("billing-op-1").afterState.endingCreditCents, 800)
    assert.equal(fixture.stripeRequests.length, 1)
  })

  it("fails closed for malformed refreshed Customer observations", async () => {
    const cases = [
      { label: "wrong ID", overrides: { id: "cus_other" } },
      { label: "deleted", overrides: { deleted: true } },
      { label: "wrong mode", overrides: { livemode: true } },
      { label: "fractional balance", overrides: { balance: -0.5 } },
      { label: "unsafe balance", overrides: { balance: Number.MAX_SAFE_INTEGER + 1 } },
      { label: "non-number balance", overrides: { balance: "-800" } },
    ]

    for (const testCase of cases) {
      const fixture = createMutationFixture({ readbackCustomerOverrides: testCase.overrides })
      const result = await apply(fixture)

      assert.equal(result.status, "RECONCILIATION_REQUIRED", testCase.label)
      assert.equal(result.currentCreditCents, null, testCase.label)
      assert.equal(fixture.state.operations.get("billing-op-1").failureCode, "STRIPE_CUSTOMER_INVALID", testCase.label)
      assert.equal(fixture.stripeRequests.length, 1, testCase.label)
      assert.equal(fixture.state.actions.size, 0, testCase.label)
    }
  })

  it("lets another current full Admin reconcile while preserving the originating actor", async () => {
    const fixture = createMutationFixture({ transactionRetrieveErrorOnce: new Error("initial readback unavailable") })
    assert.equal((await apply(fixture)).status, "RECONCILIATION_REQUIRED")

    const result = await reconcile(fixture, { actorUserId: "admin-2" })

    assert.equal(result.status, "VERIFIED")
    assert.equal(fixture.stripeRequests.length, 1)
    assert.equal(fixture.state.actions.get("billing-op-1").actorUserId, "admin-1")
  })

  it("never creates again when a persisted transaction identifier is malformed", async () => {
    const fixture = createMutationFixture({ createErrorOnce: new Error("timeout") })
    assert.equal((await apply(fixture)).status, "RECONCILIATION_REQUIRED")
    fixture.state.operations.get("billing-op-1").stripeBalanceTransactionId = "malformed"

    const result = await reconcile(fixture)

    assert.equal(result.status, "RECONCILIATION_REQUIRED")
    assert.equal(fixture.state.operations.get("billing-op-1").failureCode, "PERSISTED_TRANSACTION_ID_INVALID")
    assert.equal(fixture.stripeRequests.length, 1)
    assert.equal(fixture.stripeCalls.filter((call) => call.startsWith("transactions.retrieve:")).length, 0)
  })

  it("keeps ambiguous no-ID identity drift in manual reconciliation without another mutation", async () => {
    const fixture = createMutationFixture({ createErrorOnce: new Error("timeout") })
    assert.equal((await apply(fixture)).status, "RECONCILIATION_REQUIRED")
    fixture.billingState.subscriptionStatus = "canceled"

    const result = await reconcile(fixture)

    assert.equal(result.status, "RECONCILIATION_REQUIRED")
    assert.equal(fixture.state.operations.get("billing-op-1").failureCode, "AMBIGUOUS_IDENTITY_CHANGED")
    assert.equal(fixture.stripeRequests.length, 1)
    assert.equal(fixture.state.intents.size, 0)
  })

  it("reconciles with the same request and idempotency key, then creates one evidence bundle", async () => {
    const fixture = createMutationFixture({ createErrorOnce: new Error("timeout") })
    assert.equal((await apply(fixture)).status, "RECONCILIATION_REQUIRED")

    const reconciled = await reconcile(fixture)
    assert.equal(reconciled.status, "VERIFIED")
    assert.equal(reconciled.replayed, true)
    assert.equal(reconciled.endingCreditCents, 800)
    assert.equal(fixture.stripeRequests.length, 2)
    assert.deepEqual(fixture.stripeRequests.map((request) => request.options.idempotencyKey), ["billing-op-1", "billing-op-1"])
    assert.deepEqual(fixture.stripeRequests.map((request) => request.payload), [fixture.stripeRequests[0].payload, fixture.stripeRequests[0].payload])
    assert.equal(fixture.state.actions.size, 1)
    assert.equal(fixture.state.intents.size, 1)
  })

  it("keeps every unsafe exact-transaction mismatch unresolved without a replacement", async () => {
    const cases = [
      { label: "wrong transaction ID", transactionOverrides: { id: "cbtxn_other" } },
      { label: "wrong Customer", transactionOverrides: { customer: "cus_other" } },
      { label: "positive ending balance", transactionOverrides: { ending_balance: 1 } },
      { label: "unsafe ending balance", transactionOverrides: { ending_balance: -(Number.MAX_SAFE_INTEGER + 1) } },
      { label: "wrong currency", transactionOverrides: { currency: "eur" } },
      { label: "wrong amount", transactionOverrides: { amount: -499 } },
      { label: "wrong mode", transactionOverrides: { livemode: true } },
    ]

    for (const testCase of cases) {
      const fixture = createMutationFixture({ transactionOverrides: testCase.transactionOverrides })
      const first = await apply(fixture)
      const replay = await reconcile(fixture)
      const operation = fixture.state.operations.get("billing-op-1")

      assert.equal(first.status, "RECONCILIATION_REQUIRED", testCase.label)
      assert.equal(replay.status, "RECONCILIATION_REQUIRED", testCase.label)
      assert.equal(operation.failureCode, "STRIPE_TRANSACTION_INVALID", testCase.label)
      assert.deepEqual(
        Object.keys(operation).filter((key) => key.toLowerCase().includes("failure")),
        ["failureCode"],
        testCase.label,
      )
      assert.equal(fixture.stripeRequests.length, 1, testCase.label)
      assert.equal(fixture.state.actions.size, 0, testCase.label)
      assert.equal(fixture.state.intents.size, 0, testCase.label)
    }
  })

  it("denies the revoked originating actor while a different current Admin reconciles known evidence", async () => {
    assert.equal(typeof AdminAuthorityDeniedError, "function")
    const fixture = createMutationFixture({ transactionRetrieveErrorOnce: new Error("initial readback unavailable") })
    assert.equal((await apply(fixture)).status, "RECONCILIATION_REQUIRED")
    fixture.revokeAdmin("admin-1")

    await assert.rejects(
      () => reconcile(fixture),
      (error) => error instanceof AdminAuthorityDeniedError,
    )
    assert.equal(fixture.stripeRequests.length, 1)

    const result = await reconcile(fixture, { actorUserId: "admin-2" })
    assert.equal(result.status, "VERIFIED")
    assert.equal(fixture.stripeRequests.length, 1)
    assert.equal(fixture.state.actions.get("billing-op-1").actorUserId, "admin-1")
  })

  it("gates live keys before Stripe unless both production and the explicit flag are present", async () => {
    for (const env of [
      { STRIPE_SECRET_KEY: "sk_live_example", NODE_ENV: "development", ADMIN_BILLING_GOODWILL_LIVE_ENABLED: "true" },
      { STRIPE_SECRET_KEY: "sk_live_example", NODE_ENV: "production" },
      { STRIPE_SECRET_KEY: "sk_live_example", NODE_ENV: "production", VERCEL_ENV: "preview", ADMIN_BILLING_GOODWILL_LIVE_ENABLED: "true" },
      { STRIPE_SECRET_KEY: "sk_live_example", NODE_ENV: "production", ADMIN_BILLING_GOODWILL_LIVE_ENABLED: "true" },
    ]) {
      const fixture = createMutationFixture()
      const result = await apply(fixture, { env })
      assert.equal(result.status, "FAILED_BEFORE_MUTATION")
      assert.equal(fixture.state.operations.get("billing-op-1").failureCode, "LIVE_STRIPE_DISABLED")
      assert.equal(fixture.stripeRequests.length, 0)
    }

    const allowed = createMutationFixture({ livemode: true })
    const result = await apply(allowed, {
      env: { STRIPE_SECRET_KEY: "sk_live_example", NODE_ENV: "production", VERCEL_ENV: "production", ADMIN_BILLING_GOODWILL_LIVE_ENABLED: "true" },
    })
    assert.equal(result.status, "VERIFIED")
  })

  it("fails a direct stale-form mutation when the authoritative subscription is not USD", async () => {
    const fixture = createMutationFixture({ subscriptionCurrency: "eur" })

    const result = await apply(fixture)

    assert.equal(result.status, "FAILED_BEFORE_MUTATION")
    assert.equal(fixture.state.operations.get("billing-op-1").failureCode, "STRIPE_SUBSCRIPTION_INVALID")
    assert.equal(fixture.stripeRequests.length, 0)
  })

  it("rolls back local preparation failures and retries serializable conflicts without enclosing Stripe", async () => {
    const failed = createMutationFixture({ failPrepareWrite: true })
    await assert.rejects(() => apply(failed), /prepare write failed/)
    assert.equal(failed.state.operations.size, 0)
    assert.equal(failed.stripeRequests.length, 0)

    const retried = createMutationFixture({ serializationConflictOnce: true })
    assert.equal((await apply(retried)).status, "VERIFIED")
    assert.equal(retried.state.transactionAttempts >= 2, true)
    assert.equal(retried.stripeRequests.length, 1)
  })

  it("rolls back a late evidence-bundle failure and leaves the external mutation reconcilable", async () => {
    const fixture = createMutationFixture({ failBundleWrite: true })
    const result = await apply(fixture)

    assert.equal(result.status, "RECONCILIATION_REQUIRED")
    assert.equal(result.emailIntentId, null)
    assert.equal(result.currentCreditCents, 800)
    assert.equal(fixture.state.operations.get("billing-op-1").failureCode, "LOCAL_VERIFICATION_WRITE_FAILED")
    assert.equal(fixture.stripeRequests.length, 1)
    assert.equal(fixture.state.actions.size, 0)
    assert.equal(fixture.state.activities.size, 0)
    assert.equal(fixture.state.intents.size, 0)
  })

  it("retains the fresh current credit when a concurrent verifier wins failure settlement", async () => {
    const fixture = createMutationFixture({
      failBundleWrite: true,
      concurrentVerifiedBeforeFailureSettlement: true,
    })

    const result = await apply(fixture)

    assert.deepEqual(result, {
      operationId: "goodwill-1",
      status: "VERIFIED",
      amountCents: 500,
      endingCreditCents: 800,
      currentCreditCents: 800,
      replayed: true,
      emailIntentId: "intent-1",
    })
    assert.equal(fixture.stripeRequests.length, 1)
    assert.equal(fixture.state.operations.get("billing-op-1").failureCode, null)
    assert.equal(fixture.state.actions.size, 1)
    assert.equal(fixture.state.intents.size, 1)
  })

  it("surfaces safe mutation errors without provider payloads", async () => {
    const fixture = createMutationFixture()
    await apply(fixture)
    await assert.rejects(
      () => reconcile(fixture, { amountCents: 999 }),
      (error) => error instanceof BillingGoodwillMutationError
        && error.code === "OPERATION_KEY_IN_USE"
        && !error.message.includes("Stripe"),
    )
  })

  it("refuses to reconcile an operation that already settled", async () => {
    const fixture = createMutationFixture({ transactionRetrieveErrorOnce: new Error("initial readback unavailable") })
    assert.equal((await apply(fixture)).status, "RECONCILIATION_REQUIRED")
    assert.equal((await reconcile(fixture)).status, "VERIFIED")
    const requestCount = fixture.stripeRequests.length
    const actionCount = fixture.state.actions.size

    await assert.rejects(
      () => reconcile(fixture),
      (error) => error instanceof BillingGoodwillMutationError
        && error.code === "OPERATION_NOT_RECONCILABLE",
    )
    assert.equal(fixture.stripeRequests.length, requestCount)
    assert.equal(fixture.state.actions.size, actionCount)
  })
})

function apply(fixture, overrides = {}) {
  return applyInvoiceCredit({
    prismaClient: fixture.prismaClient,
    actorUserId: "admin-1",
    targetUserId: "user-1",
    amountCents: fixture.amountCents,
    confirmationEmail: "user@example.test",
    expectedStartingCreditCents: 300,
    reasonCode: "BILLING_GOODWILL",
    internalNote: "Courtesy invoice credit after a support review.",
    idempotencyKey: "billing-op-1",
    stripeClient: fixture.stripeClient,
    env: { STRIPE_SECRET_KEY: "sk_test_example" },
    now: new Date("2026-08-08T00:00:00.000Z"),
    ...overrides,
  })
}

function reconcile(fixture, overrides = {}) {
  return reconcileInvoiceCredit({
    prismaClient: fixture.prismaClient,
    actorUserId: "admin-1",
    targetUserId: "user-1",
    amountCents: fixture.amountCents,
    confirmationEmail: "user@example.test",
    expectedStartingCreditCents: 300,
    reasonCode: "BILLING_GOODWILL",
    internalNote: "Courtesy invoice credit after a support review.",
    idempotencyKey: "billing-op-1",
    stripeClient: fixture.stripeClient,
    env: { STRIPE_SECRET_KEY: "sk_test_example" },
    now: new Date("2026-08-08T00:00:00.000Z"),
    ...overrides,
  })
}

function createMutationFixture(overrides = {}) {
  const amountCents = overrides.amountCents ?? 500
  const state = {
    operations: new Map(),
    actions: new Map(),
    activities: new Map(),
    intents: new Map(),
    transactionAttempts: 0,
    preCallFailureWhereClauses: [],
  }
  if (overrides.unrelatedAdminAction) {
    state.actions.set("billing-op-1", {
      id: "unrelated-action",
      actorUserId: "admin-1",
      targetUserId: "user-1",
      actionKind: "SECURITY_SESSIONS_REVOKED",
      reasonCode: "SECURITY_RECOVERY",
      internalNote: null,
      idempotencyKey: "billing-op-1",
      beforeState: {},
      afterState: {},
      outcome: "SUCCEEDED",
      failureCode: null,
      activity: null,
      emailIntent: null,
    })
  }
  const stripeRequests = []
  const stripeCalls = []
  const billingState = { customerId: "cus_test", subscriptionStatus: "active" }
  let createAttempts = 0
  let transactionRetrieveAttempts = 0
  let preparedConflictUsed = false
  let created = false
  let concurrentBundle = null
  let currentBalance = overrides.customerBalance ?? -300
  const livemode = overrides.livemode ?? false
  let transactionTail = Promise.resolve()

  const users = new Map([
    ["admin-1", adminUser("admin-1")],
    ["admin-2", adminUser("admin-2")],
    ["user-1", targetUser("user-1", "user@example.test")],
    ["user-2", targetUser("user-2", "user-2@example.test")],
  ])
  // Count authority loads per actor rather than globally: each actor's first
  // load is entry authorization, and the second models the final pre-provider recheck.
  const adminAuthorityLoads = new Map()

  const database = {
    state,
    async $transaction(callback) {
      const previous = transactionTail
      let releaseTransaction
      transactionTail = new Promise((resolve) => { releaseTransaction = resolve })
      await previous
      try {
        state.transactionAttempts += 1
        const snapshot = structuredClone({
          operations: state.operations,
          actions: state.actions,
          activities: state.activities,
          intents: state.intents,
        })
        if (overrides.serializationConflictOnce && !preparedConflictUsed) {
          preparedConflictUsed = true
          const error = new Error("serialization conflict")
          error.code = "P2034"
          throw error
        }
        try {
          return await callback(database)
        } catch (error) {
          state.operations = snapshot.operations
          state.actions = snapshot.actions
          state.activities = snapshot.activities
          state.intents = snapshot.intents
          throw error
        }
      } finally {
        releaseTransaction()
      }
    },
    async $executeRaw() {
      return 1
    },
    user: {
      async findUnique({ where }) {
        if (where.id === "admin-1" || where.id === "admin-2") {
          const authorityLoadCount = (adminAuthorityLoads.get(where.id) ?? 0) + 1
          adminAuthorityLoads.set(where.id, authorityLoadCount)
          if (authorityLoadCount === 2) {
            overrides.onFinalAuthorityLoad?.(where.id)
            const authorityGate = overrides.finalAuthorityGates?.[where.id]
              ?? overrides.finalAuthorityGate
            if (authorityGate) await authorityGate
            if (overrides.finalAuthorityError) throw overrides.finalAuthorityError
          }
        }
        return structuredClone(users.get(where.id) ?? null)
      },
    },
    stripeCustomer: {
      async findMany({ where, take }) {
        assert.equal(take, 2)
        if (!["user-1", "user-2"].includes(where.userId)) return []
        return [{ stripeCustomerId: where.userId === "user-1" ? billingState.customerId : "cus_other" }]
      },
    },
    membershipSubscription: {
      async findMany({ where, take }) {
        assert.equal(take, 2)
        if (!["user-1", "user-2"].includes(where.userId)) return []
        const subscription = {
          stripeSubscriptionId: where.userId === "user-1" ? "sub_test" : "sub_other",
          stripeCustomerId: where.userId === "user-1" ? billingState.customerId : "cus_other",
          membershipLevel: "SUPPORTER",
          status: where.userId === "user-1" ? billingState.subscriptionStatus : "active",
        }
        return ["active", "trialing"].includes(subscription.status) ? [subscription] : []
      },
    },
    adminBillingGoodwillOperation: {
      async findUnique({ where }) {
        const row = where.id
          ? [...state.operations.values()].find((operation) => operation.id === where.id)
          : state.operations.get(where.idempotencyKey)
        return structuredClone(row ?? null)
      },
      async create({ data }) {
        if (overrides.failPrepareWrite) throw new Error("prepare write failed")
        if (state.operations.has(data.idempotencyKey)) {
          const error = new Error("unique conflict")
          error.code = "P2002"
          error.meta = { modelName: "AdminBillingGoodwillOperation", target: ["idempotencyKey"] }
          throw error
        }
        const row = {
          id: "goodwill-1",
          stripeBalanceTransactionId: null,
          endingBalanceCents: null,
          projectedNextInvoiceCents: null,
          status: "PREPARED",
          failureCode: null,
          appliedAt: null,
          verifiedAt: null,
          createdAt: new Date("2026-08-08T00:00:00.000Z"),
          updatedAt: new Date("2026-08-08T00:00:00.000Z"),
          ...structuredClone(data),
        }
        state.operations.set(data.idempotencyKey, row)
        return structuredClone(row)
      },
      async update({ where, data }) {
        const row = [...state.operations.values()].find((operation) => operation.id === where.id)
        if (!row) throw new Error("operation missing")
        Object.assign(row, structuredClone(data))
        return structuredClone(row)
      },
      async updateMany({ where, data }) {
        const row = [...state.operations.values()].find((operation) => operation.id === where.id)
        const allowedStatuses = where.status?.in ?? (where.status ? [where.status] : null)
        const concurrentClaim = overrides.concurrentClaimBeforePreCallFailureSettlement
        // Simulate a competing reconciler changing canonical ownership just before
        // the creator's guarded pre-call failure settlement is evaluated below.
        if (row && concurrentClaim && concurrentClaim.failureCode === data.failureCode) {
          state.preCallFailureWhereClauses.push(structuredClone(where))
          Object.assign(row, {
            status: concurrentClaim.status,
            failureCode: concurrentClaim.persistedFailureCode ?? null,
            stripeBalanceTransactionId: concurrentClaim.stripeBalanceTransactionId ?? null,
          })
        }
        // Simulate a concurrent verifier committing its complete evidence bundle
        // before the losing invocation's guarded failure settlement is evaluated.
        if (row
          && data.failureCode === "LOCAL_VERIFICATION_WRITE_FAILED"
          && overrides.concurrentVerifiedBeforeFailureSettlement
          && concurrentBundle) {
          Object.assign(row, {
            status: "VERIFIED",
            endingBalanceCents: concurrentBundle.action.afterState.endingCreditCents,
            failureCode: null,
            verifiedAt: new Date("2026-08-08T00:02:00.000Z"),
          })
          state.actions.set("billing-op-1", concurrentBundle.action)
          state.activities.set(concurrentBundle.action.id, concurrentBundle.action.activity)
          state.intents.set(concurrentBundle.action.id, concurrentBundle.emailIntent)
        }
        if (!row
          || (where.actorUserId !== undefined && row.actorUserId !== where.actorUserId)
          || (where.targetUserId !== undefined && row.targetUserId !== where.targetUserId)
          || (where.idempotencyKey !== undefined && row.idempotencyKey !== where.idempotencyKey)
          || (where.stripeBalanceTransactionId !== undefined && row.stripeBalanceTransactionId !== where.stripeBalanceTransactionId)
          || (allowedStatuses && !allowedStatuses.includes(row.status))) return { count: 0 }
        Object.assign(row, structuredClone(data))
        return { count: 1 }
      },
    },
    adminAction: {
      async findUnique({ where }) {
        return structuredClone(state.actions.get(where.idempotencyKey) ?? null)
      },
      async create({ data }) {
        const row = { id: "action-1", occurredAt: new Date(), ...structuredClone(data), activity: null, emailIntent: null }
        state.actions.set(data.idempotencyKey, row)
        return { id: row.id }
      },
    },
    userAccountActivity: {
      async create({ data }) {
        const row = { id: "activity-1", ...structuredClone(data) }
        state.activities.set(data.adminActionId, row)
        const action = [...state.actions.values()].find((candidate) => candidate.id === data.adminActionId)
        if (action) action.activity = row
        return structuredClone(row)
      },
    },
    adminEmailIntent: {
      async create({ data }) {
        const row = {
          id: "intent-1",
          attemptCount: 0,
          lastAttemptAt: null,
          deliveredAt: null,
          ...structuredClone(data),
        }
        if (overrides.failBundleWrite) {
          if (overrides.concurrentVerifiedBeforeFailureSettlement) {
            const action = [...state.actions.values()].find((candidate) => candidate.id === data.adminActionId)
            concurrentBundle = {
              action: { ...structuredClone(action), emailIntent: structuredClone(row) },
              emailIntent: structuredClone(row),
            }
          }
          throw new Error("intent write failed")
        }
        state.intents.set(data.adminActionId, row)
        const action = [...state.actions.values()].find((candidate) => candidate.id === data.adminActionId)
        if (action) action.emailIntent = row
        return { id: row.id }
      },
    },
  }

  const stripeClient = {
    customers: {
      async retrieve(customerId) {
        stripeCalls.push(`customers.retrieve:${customerId}`)
        overrides.onCustomerRetrieve?.()
        if (overrides.customerRetrieveGate) await overrides.customerRetrieveGate
        if (overrides.customerRetrieveError) throw overrides.customerRetrieveError
        if (created && overrides.readbackCustomerRetrieveError) throw overrides.readbackCustomerRetrieveError
        return {
          id: customerId,
          deleted: false,
          balance: currentBalance,
          livemode,
          ...(created ? overrides.readbackCustomerOverrides : null),
        }
      },
      async createBalanceTransaction(customerId, payload, options) {
        stripeCalls.push(`transactions.create:${customerId}`)
        createAttempts += 1
        stripeRequests.push(structuredClone({ customerId, payload, options }))
        overrides.onCreateBalanceTransaction?.()
        if (overrides.createBalanceTransactionGate) await overrides.createBalanceTransactionGate
        const firstForKey = !created
        if (firstForKey) {
          created = true
          currentBalance -= amountCents
        }
        if (overrides.createErrorOnce && createAttempts === 1) throw overrides.createErrorOnce
        return { id: "cbtxn_test" }
      },
      async retrieveBalanceTransaction(customerId, transactionId) {
        stripeCalls.push(`transactions.retrieve:${customerId}:${transactionId}`)
        transactionRetrieveAttempts += 1
        if (overrides.transactionRetrieveErrorOnce && transactionRetrieveAttempts === 1) {
          throw overrides.transactionRetrieveErrorOnce
        }
        return {
          id: transactionId,
          customer: customerId,
          amount: -amountCents,
          currency: "usd",
          ending_balance: currentBalance,
          livemode,
          ...overrides.transactionOverrides,
        }
      },
    },
    subscriptions: {
      async retrieve(subscriptionId) {
        stripeCalls.push(`subscriptions.retrieve:${subscriptionId}`)
        return { id: subscriptionId, customer: "cus_test", status: "active", livemode, currency: overrides.subscriptionCurrency ?? "usd" }
      },
    },
    invoices: { async createPreview() { throw new Error("preview not used") } },
  }

  return {
    amountCents,
    billingState,
    prismaClient: database,
    state,
    stripeClient,
    stripeCalls,
    stripeRequests,
    revokeAdmin(id) {
      const user = users.get(id)
      if (user) user.roles = user.roles.map((assignment) => ({ ...assignment, status: "REVOKED" }))
    },
  }
}

function seedUnresolvedOperation(fixture, { status, stripeBalanceTransactionId }) {
  fixture.state.operations.set("billing-op-1", {
    id: "goodwill-1",
    actorUserId: "admin-1",
    targetUserId: "user-1",
    idempotencyKey: "billing-op-1",
    reasonCode: "BILLING_GOODWILL",
    internalNote: "Courtesy invoice credit after a support review.",
    amountCents: fixture.amountCents,
    currency: "usd",
    stripeCustomerId: "cus_test",
    stripeSubscriptionId: "sub_test",
    stripeBalanceTransactionId,
    startingBalanceCents: 300,
    endingBalanceCents: null,
    status,
    failureCode: null,
    appliedAt: status === "APPLIED" ? new Date("2026-08-08T00:01:00.000Z") : null,
    verifiedAt: null,
    createdAt: new Date("2026-08-08T00:00:00.000Z"),
    updatedAt: new Date("2026-08-08T00:01:00.000Z"),
  })
}

function adminUser(id) {
  return {
    id,
    name: "Admin",
    email: `${id}@example.test`,
    emailVerified: new Date("2026-08-08T00:00:00.000Z"),
    roles: [{ role: "ADMIN", status: "VERIFIED" }],
  }
}

function targetUser(id, email) {
  return { id, email, emailVerified: new Date("2026-08-08T00:00:00.000Z"), roles: [] }
}

function deferred() {
  let resolve
  const promise = new Promise((fulfill) => { resolve = fulfill })
  return { promise, resolve }
}

async function assertPreviewRejection(fixture, expectedCode) {
  await assert.rejects(
    () => preview(fixture),
    (error) => error instanceof BillingGoodwillPreviewError
      && error.code === expectedCode
      && !JSON.stringify(error).includes("raw"),
  )
}

function preview(fixture) {
  return previewInvoiceCredit({
    prismaClient: fixture.prismaClient,
    actorUserId: "admin-1",
    targetUserId: "user-1",
    stripeClient: fixture.stripeClient,
  })
}

function createFixture(overrides = {}) {
  const calls = []
  const actor = overrides.actor ?? {
    id: "admin-1",
    name: "Admin",
    email: "admin@example.test",
    emailVerified: new Date("2026-08-08T00:00:00.000Z"),
    roles: [{ role: "ADMIN", status: "VERIFIED" }],
  }
  const target = Object.hasOwn(overrides, "target") ? overrides.target : { id: "user-1" }
  const customers = overrides.customers ?? [{ stripeCustomerId: "cus_test" }]
  const subscriptions = overrides.subscriptions ?? [localSubscription()]
  const customer = overrides.stripeCustomer ?? stripeCustomer()
  const subscription = overrides.stripeSubscription ?? stripeSubscription()
  const invoicePreview = overrides.stripePreview ?? stripePreview()

  return {
    calls,
    prismaClient: {
      user: {
        findUnique: async ({ where }) => {
          calls.push(`user.findUnique:${where.id}`)
          return structuredClone(where.id === "admin-1" ? actor : target)
        },
      },
      stripeCustomer: {
        findMany: async ({ where, take }) => {
          calls.push(`stripeCustomer.findMany:${where.userId}`)
          assert.equal(take, 2)
          return structuredClone(customers)
        },
      },
      membershipSubscription: {
        findMany: async ({ where, take }) => {
          calls.push(`membershipSubscription.findMany:${where.userId}`)
          assert.deepEqual(where, {
            userId: "user-1",
            membershipLevel: "SUPPORTER",
            status: { in: ["active", "trialing"] },
          })
          assert.equal(take, 2)
          return structuredClone(subscriptions.filter((row) =>
            row.membershipLevel === "SUPPORTER" && ["active", "trialing"].includes(row.status),
          ))
        },
      },
    },
    stripeClient: {
      customers: {
        retrieve: async (customerId) => {
          calls.push(`customers.retrieve:${customerId}`)
          if (overrides.customerError) throw overrides.customerError
          return structuredClone(customer)
        },
      },
      subscriptions: {
        retrieve: async (subscriptionId) => {
          calls.push(`subscriptions.retrieve:${subscriptionId}`)
          if (overrides.subscriptionError) throw overrides.subscriptionError
          return structuredClone(subscription)
        },
      },
      invoices: {
        createPreview: async ({ customer: customerId, subscription: subscriptionId, preview_mode: mode }) => {
          calls.push(`invoices.createPreview:${customerId}:${subscriptionId}:${mode}`)
          if (overrides.invoiceError) throw overrides.invoiceError
          return structuredClone(invoicePreview)
        },
      },
    },
  }
}

function localSubscription(overrides = {}) {
  return {
    stripeSubscriptionId: "sub_test",
    stripeCustomerId: "cus_test",
    membershipLevel: "SUPPORTER",
    status: "active",
    ...overrides,
  }
}

function stripeCustomer(overrides = {}) {
  return { id: "cus_test", deleted: false, balance: -300, livemode: false, ...overrides }
}

function stripeSubscription(overrides = {}) {
  return { id: "sub_test", customer: "cus_test", status: "active", livemode: false, ...overrides }
}

function stripePreview(overrides = {}) {
  return {
    customer: "cus_test",
    currency: "usd",
    amount_due: 207,
    livemode: false,
    ...overrides,
  }
}
