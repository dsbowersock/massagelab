import assert from "node:assert/strict"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import {
  BillingGoodwillPreviewError,
  previewInvoiceCredit,
} from "../lib/admin/billing-goodwill.ts"

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
