import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { describe, it } from "node:test"
import { fileURLToPath } from "node:url"
import {
  MigrationError,
  formatMigrationChecklist,
  runSupporterMembershipMigration,
} from "../scripts/stripe-supporter-membership-migration.mjs"

const LEGACY_PRICE_SPECS = Object.freeze([
  ["price_supporter_month", "prod_supporter", 900, "month"],
  ["price_supporter_year", "prod_supporter", 9000, "year"],
  ["price_therapist_month", "prod_therapist", 2900, "month"],
  ["price_therapist_year", "prod_therapist", 27900, "year"],
  ["price_practice_month", "prod_practice", 7900, "month"],
  ["price_practice_year", "prod_practice", 75900, "year"],
])

function migrationEnv(overrides = {}) {
  return {
    STRIPE_SECRET_KEY: "sk_test_do_not_print",
    MASSAGELAB_STRIPE_MIGRATION_MODE: "test",
    MASSAGELAB_STRIPE_MIGRATION_ALLOWED_SUBSCRIPTION_ID: "sub_documented_test",
    MASSAGELAB_STRIPE_MIGRATION_SUPPORTER_PRODUCT_ID: "prod_supporter",
    MASSAGELAB_STRIPE_MIGRATION_LEGACY_SUPPORTER_MONTHLY_PRICE_ID: "price_supporter_month",
    MASSAGELAB_STRIPE_MIGRATION_LEGACY_SUPPORTER_YEARLY_PRICE_ID: "price_supporter_year",
    MASSAGELAB_STRIPE_MIGRATION_THERAPIST_PRODUCT_ID: "prod_therapist",
    MASSAGELAB_STRIPE_MIGRATION_THERAPIST_MONTHLY_PRICE_ID: "price_therapist_month",
    MASSAGELAB_STRIPE_MIGRATION_THERAPIST_YEARLY_PRICE_ID: "price_therapist_year",
    MASSAGELAB_STRIPE_MIGRATION_PRACTICE_PRODUCT_ID: "prod_practice",
    MASSAGELAB_STRIPE_MIGRATION_PRACTICE_MONTHLY_PRICE_ID: "price_practice_month",
    MASSAGELAB_STRIPE_MIGRATION_PRACTICE_YEARLY_PRICE_ID: "price_practice_year",
    MASSAGELAB_STRIPE_MIGRATION_STUDENT_COUPON_ID: "coupon_student",
    MASSAGELAB_STRIPE_MIGRATION_EARLY_ACCESS_COUPON_ID: "coupon_early",
    MASSAGELAB_STRIPE_MIGRATION_PORTAL_CONFIGURATION_ID: "bpc_membership",
    STRIPE_SUPPORTER_1_MONTHLY_PRICE_ID: "",
    STRIPE_SUPPORTER_1_YEARLY_PRICE_ID: "",
    STRIPE_SUPPORTER_2_MONTHLY_PRICE_ID: "",
    STRIPE_SUPPORTER_2_YEARLY_PRICE_ID: "",
    STRIPE_SUPPORTER_5_MONTHLY_PRICE_ID: "",
    STRIPE_SUPPORTER_5_YEARLY_PRICE_ID: "",
    ...overrides,
  }
}

function product(id, name, active = true) {
  return {
    id,
    object: "product",
    active,
    livemode: false,
    name,
    tax_code: id === "prod_supporter" ? "txcd_10000000" : null,
    metadata: id === "prod_supporter"
      ? { app: "massagelab", massagelab_catalog: "supporter_membership_v1" }
      : { app: "massagelab" },
  }
}

function price(id, productId, unitAmount, interval, active = true, metadata = {}) {
  return {
    id,
    object: "price",
    active,
    livemode: false,
    product: productId,
    unit_amount: unitAmount,
    currency: "usd",
    recurring: { interval, interval_count: 1 },
    tax_behavior: "exclusive",
    lookup_key: metadata.massagelab_supporter_price_key ?? null,
    metadata,
  }
}

function portalConfiguration() {
  return {
    id: "bpc_membership",
    object: "billing_portal.configuration",
    livemode: false,
    active: true,
    features: {
      customer_update: {
        enabled: true,
        allowed_updates: ["address", "email", "name"],
      },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: {
        enabled: true,
        mode: "at_period_end",
      },
      subscription_update: {
        enabled: true,
        default_allowed_updates: ["price"],
        products: [
          { product: "prod_supporter", prices: ["price_supporter_month", "price_supporter_year"] },
          { product: "prod_therapist", prices: ["price_therapist_month", "price_therapist_year"] },
          { product: "prod_practice", prices: ["price_practice_month", "price_practice_year"] },
        ],
      },
    },
  }
}

function stripeFixture() {
  const calls = []
  const products = new Map([
    ["prod_supporter", product("prod_supporter", "MassageLab Supporter")],
    ["prod_therapist", product("prod_therapist", "MassageLab Therapist")],
    ["prod_practice", product("prod_practice", "MassageLab Practice")],
  ])
  const prices = new Map(LEGACY_PRICE_SPECS.map(
    ([id, productId, unitAmount, interval]) => [id, price(id, productId, unitAmount, interval)],
  ))
  const coupons = new Map([
    ["coupon_student", {
      id: "coupon_student",
      object: "coupon",
      livemode: false,
      name: "Student to Therapist 20% Discount",
      percent_off: 20,
      duration: "forever",
      times_redeemed: 0,
      valid: true,
    }],
    ["coupon_early", {
      id: "coupon_early",
      object: "coupon",
      livemode: false,
      name: "Early Access 10% Discount",
      percent_off: 10,
      duration: "forever",
      times_redeemed: 0,
      valid: true,
    }],
  ])
  const subscriptions = [{
    id: "sub_documented_test",
    object: "subscription",
    livemode: false,
    status: "active",
    cancel_at_period_end: true,
    customer: "cus_private_test_account",
  }]
  let portal = portalConfiguration()
  let nextPrice = 1

  function record(name, id = null, payload = null) {
    calls.push({ name, id, payload })
  }

  function missing(resource) {
    const error = new Error(`No such ${resource}`)
    error.code = "resource_missing"
    return error
  }

  const stripe = {
    balance: {
      async retrieve() {
        record("balance.retrieve")
        return { object: "balance", livemode: false }
      },
    },
    subscriptions: {
      async list(payload) {
        record("subscriptions.list", null, payload)
        return { data: subscriptions.map((entry) => structuredClone(entry)), has_more: false }
      },
    },
    products: {
      async list(payload) {
        record("products.list", null, payload)
        return { data: [...products.values()].map((entry) => structuredClone(entry)), has_more: false }
      },
      async retrieve(id) {
        record("products.retrieve", id)
        const entry = products.get(id)
        if (!entry) throw missing("product")
        return structuredClone(entry)
      },
      async update(id, payload) {
        record("products.update", id, payload)
        const current = products.get(id)
        if (!current) throw missing("product")
        const updated = {
          ...current,
          ...structuredClone(payload),
          metadata: { ...current.metadata, ...structuredClone(payload.metadata ?? {}) },
        }
        products.set(id, updated)
        return structuredClone(updated)
      },
      async create(payload) {
        record("products.create", null, payload)
        const id = "prod_created_supporter"
        const created = {
          id,
          object: "product",
          active: true,
          livemode: false,
          ...structuredClone(payload),
        }
        products.set(id, created)
        return structuredClone(created)
      },
    },
    prices: {
      async list(payload) {
        record("prices.list", null, payload)
        const data = [...prices.values()]
          .filter((entry) => !payload.product || entry.product === payload.product)
          .map((entry) => structuredClone(entry))
        return { data, has_more: false }
      },
      async retrieve(id) {
        record("prices.retrieve", id)
        const entry = prices.get(id)
        if (!entry) throw missing("price")
        return structuredClone(entry)
      },
      async update(id, payload) {
        record("prices.update", id, payload)
        const current = prices.get(id)
        if (!current) throw missing("price")
        const updated = { ...current, ...structuredClone(payload) }
        prices.set(id, updated)
        return structuredClone(updated)
      },
      async create(payload) {
        record("prices.create", null, payload)
        const id = `price_created_${nextPrice++}`
        const created = {
          id,
          object: "price",
          active: true,
          livemode: false,
          tax_behavior: "exclusive",
          ...structuredClone(payload),
          recurring: {
            interval_count: 1,
            ...structuredClone(payload.recurring),
          },
        }
        prices.set(id, created)
        return structuredClone(created)
      },
    },
    coupons: {
      async retrieve(id) {
        record("coupons.retrieve", id)
        const entry = coupons.get(id)
        if (!entry) throw missing("coupon")
        return structuredClone(entry)
      },
      async del(id) {
        record("coupons.del", id)
        if (!coupons.has(id)) throw missing("coupon")
        coupons.delete(id)
        return { id, object: "coupon", deleted: true }
      },
    },
    billingPortal: {
      configurations: {
        async retrieve(id) {
          record("portal.retrieve", id)
          if (portal.id !== id) throw missing("portal configuration")
          return structuredClone(portal)
        },
        async update(id, payload) {
          record("portal.update", id, payload)
          if (portal.id !== id) throw missing("portal configuration")
          portal = {
            ...portal,
            ...structuredClone(payload),
            features: structuredClone(payload.features),
          }
          return structuredClone(portal)
        },
      },
    },
  }

  return {
    stripe,
    calls,
    products,
    prices,
    coupons,
    subscriptions,
    get portal() {
      return portal
    },
  }
}

function mutationCalls(fixture) {
  return fixture.calls.filter(({ name }) => (
    name.endsWith(".create")
    || name.endsWith(".update")
    || name.endsWith(".del")
  ))
}

function assertMutationWasReretrieved(calls, mutationIndex, retrieveName, id) {
  assert.equal(
    calls.slice(mutationIndex + 1).some(({ name, id: candidate }) => name === retrieveName && candidate === id),
    true,
  )
}

describe("Supporter membership Stripe migration", () => {
  it("reports safe local configuration codes before constructing a Stripe client", () => {
    const scriptPath = fileURLToPath(
      new URL("../scripts/stripe-supporter-membership-migration.mjs", import.meta.url),
    )
    const execution = spawnSync(process.execPath, [scriptPath, "--mode=verify"], {
      encoding: "utf8",
      env: {
        ...process.env,
        STRIPE_SECRET_KEY: "",
        MASSAGELAB_STRIPE_MIGRATION_MODE: "",
      },
    })

    assert.equal(execution.status, 1)
    assert.match(execution.stderr, /FAIL expected_stripe_mode_required/)
    assert.match(execution.stderr, /FAIL secret_key_mode_mismatch/)
    assert.doesNotMatch(
      execution.stderr,
      /unexpected_migration_failure|StripeConnectionError|api key/i,
    )
  })

  it("refuses a configured test/live mismatch before any Stripe API request", async () => {
    const fixture = stripeFixture()

    await assert.rejects(
      runSupporterMembershipMigration({
        stripe: fixture.stripe,
        mode: "apply",
        env: migrationEnv({
          STRIPE_SECRET_KEY: "sk_test_secret_customer_cus_leak",
          MASSAGELAB_STRIPE_MIGRATION_MODE: "live",
        }),
      }),
      (error) => {
        assert.equal(error instanceof MigrationError, true)
        assert.deepEqual(error.failureCodes, ["secret_key_mode_mismatch"])
        assert.doesNotMatch(
          `${error.message} ${JSON.stringify(error.checks)}`,
          /sk_test_secret_customer_cus_leak|cus_private_test_account|sub_documented_test/,
        )
        return true
      },
    )
    assert.deepEqual(fixture.calls, [])
  })

  it("uses GET-only verification and emits a safe PASS checklist for the exact migratable state", async () => {
    const fixture = stripeFixture()
    const result = await runSupporterMembershipMigration({
      stripe: fixture.stripe,
      mode: "verify",
      env: migrationEnv(),
    })
    const output = formatMigrationChecklist(result)

    assert.equal(result.ok, true)
    assert.equal(mutationCalls(fixture).length, 0)
    assert.match(output, /PASS mode_and_account/)
    assert.match(output, /PASS subscriber_inventory/)
    assert.match(output, /PASS catalog_dependencies/)
    assert.match(output, /PASS coupon_dependencies/)
    assert.match(output, /PASS portal_dependencies/)
    assert.doesNotMatch(
      output,
      /cus_private_test_account|sub_documented_test|sk_test_do_not_print|price_supporter|prod_supporter|coupon_student|bpc_membership/,
    )
  })

  it("applies in dependency order, re-retrieves every mutation, and reaches the exact target state", async () => {
    const fixture = stripeFixture()
    const result = await runSupporterMembershipMigration({
      stripe: fixture.stripe,
      mode: "apply",
      env: migrationEnv(),
    })

    assert.equal(result.ok, true)
    const supporter = fixture.products.get("prod_supporter")
    assert.equal(supporter.name, "MassageLab Supporter Membership")
    assert.equal(supporter.tax_code, "txcd_10000000")
    assert.equal(supporter.active, true)

    const approved = [...fixture.prices.values()].filter(
      (entry) => entry.metadata?.massagelab_catalog === "supporter_membership_v1",
    )
    assert.deepEqual(
      approved.map((entry) => [entry.unit_amount, entry.recurring.interval]),
      [
        [100, "month"],
        [1000, "year"],
        [200, "month"],
        [2000, "year"],
        [500, "month"],
        [5000, "year"],
      ],
    )
    assert.equal(approved.every((entry) => (
      entry.product === supporter.id
      && entry.active
      && entry.currency === "usd"
      && entry.tax_behavior === "exclusive"
    )), true)
    assert.equal(LEGACY_PRICE_SPECS.every(([id]) => fixture.prices.get(id).active === false), true)
    assert.equal(fixture.products.get("prod_therapist").active, false)
    assert.equal(fixture.products.get("prod_practice").active, false)
    assert.equal(fixture.coupons.size, 0)

    const features = fixture.portal.features
    assert.deepEqual(features.customer_update, {
      enabled: true,
      allowed_updates: ["address", "email", "name"],
    })
    assert.deepEqual(features.invoice_history, { enabled: true })
    assert.deepEqual(features.payment_method_update, { enabled: true })
    assert.deepEqual(features.subscription_cancel, {
      enabled: true,
      mode: "at_period_end",
    })
    assert.deepEqual(features.subscription_update, {
      enabled: true,
      default_allowed_updates: ["price"],
      products: [{
        product: supporter.id,
        prices: approved.map((entry) => entry.id),
      }],
    })

    const names = fixture.calls.map(({ name }) => name)
    assert.ok(names.indexOf("portal.update") > names.lastIndexOf("prices.create"))
    assert.ok(names.indexOf("prices.update") > names.indexOf("portal.update"))
    assert.ok(names.indexOf("products.update", names.indexOf("portal.update") + 1) > names.indexOf("prices.update"))
    assert.ok(names.indexOf("coupons.del") > names.indexOf("portal.update"))

    fixture.calls.forEach((call, index) => {
      if (call.name === "products.update") {
        assertMutationWasReretrieved(fixture.calls, index, "products.retrieve", call.id)
      }
      if (call.name === "products.create") {
        const created = [...fixture.products.values()].find(
          (entry) => entry.metadata?.massagelab_catalog === "supporter_membership_v1",
        )
        assertMutationWasReretrieved(fixture.calls, index, "products.retrieve", created.id)
      }
      if (call.name === "prices.update") {
        assertMutationWasReretrieved(fixture.calls, index, "prices.retrieve", call.id)
      }
      if (call.name === "prices.create") {
        const nextRetrieve = fixture.calls[index + 1]
        assert.equal(nextRetrieve.name, "prices.retrieve")
      }
      if (call.name === "portal.update") {
        assertMutationWasReretrieved(fixture.calls, index, "portal.retrieve", call.id)
      }
      if (call.name === "coupons.del") {
        assertMutationWasReretrieved(fixture.calls, index, "coupons.retrieve", call.id)
      }
    })
  })

  it("is idempotent and creates no duplicate Product or Price on a rerun", async () => {
    const fixture = stripeFixture()
    await runSupporterMembershipMigration({
      stripe: fixture.stripe,
      mode: "apply",
      env: migrationEnv(),
    })
    const productCount = fixture.products.size
    const priceCount = fixture.prices.size
    fixture.calls.length = 0

    const rerun = await runSupporterMembershipMigration({
      stripe: fixture.stripe,
      mode: "apply",
      env: migrationEnv(),
    })

    assert.equal(rerun.ok, true)
    assert.equal(fixture.products.size, productCount)
    assert.equal(fixture.prices.size, priceCount)
    assert.deepEqual(mutationCalls(fixture), [])
  })

  it("creates one managed Supporter Product only when CREATE_NEW is explicit, then reuses it", async () => {
    const fixture = stripeFixture()
    fixture.products.get("prod_supporter").metadata = { app: "massagelab" }
    const env = migrationEnv({
      MASSAGELAB_STRIPE_MIGRATION_SUPPORTER_PRODUCT_ID: "CREATE_NEW",
    })

    await runSupporterMembershipMigration({
      stripe: fixture.stripe,
      mode: "apply",
      env,
    })
    assert.equal(
      [...fixture.products.values()].filter(
        (entry) => entry.metadata?.massagelab_catalog === "supporter_membership_v1",
      ).length,
      1,
    )
    assert.equal(
      fixture.calls.filter(({ name }) => name === "products.create").length,
      1,
    )

    fixture.calls.length = 0
    await runSupporterMembershipMigration({
      stripe: fixture.stripe,
      mode: "apply",
      env,
    })
    assert.deepEqual(mutationCalls(fixture), [])
  })

  it("fails closed on an unexpected subscriber without leaking identifiers or mutating catalog state", async () => {
    const fixture = stripeFixture()
    fixture.subscriptions.push({
      id: "sub_unexpected_private",
      object: "subscription",
      livemode: false,
      status: "past_due",
      customer: "cus_unexpected_private",
    })

    await assert.rejects(
      runSupporterMembershipMigration({
        stripe: fixture.stripe,
        mode: "apply",
        env: migrationEnv(),
      }),
      (error) => {
        assert.deepEqual(error.failureCodes, ["unexpected_subscription_inventory"])
        assert.doesNotMatch(
          `${error.message} ${JSON.stringify(error.checks)}`,
          /sub_unexpected_private|cus_unexpected_private|sub_documented_test/,
        )
        return true
      },
    )
    assert.deepEqual(mutationCalls(fixture), [])
  })

  it("uses Stripe auto-pagination so a later-page subscriber cannot be hidden", async () => {
    const fixture = stripeFixture()
    const firstPage = fixture.subscriptions.map((entry) => structuredClone(entry))
    const unexpected = {
      id: "sub_later_page_private",
      object: "subscription",
      livemode: false,
      status: "active",
      customer: "cus_later_page_private",
    }
    fixture.stripe.subscriptions.list = () => {
      const listPromise = Promise.resolve({ data: firstPage, has_more: true })
      listPromise.autoPagingToArray = async () => [...firstPage, unexpected]
      return listPromise
    }

    await assert.rejects(
      runSupporterMembershipMigration({
        stripe: fixture.stripe,
        mode: "apply",
        env: migrationEnv(),
      }),
      (error) => {
        assert.equal(error.failureCodes.includes("unexpected_subscription_inventory"), true)
        return true
      },
    )
    assert.deepEqual(mutationCalls(fixture), [])
  })

  it("fails closed before mutation on coupon redemption or a mismatched coupon contract", async () => {
    for (const corrupt of [
      (fixture) => { fixture.coupons.get("coupon_student").times_redeemed = 1 },
      (fixture) => { fixture.coupons.get("coupon_early").percent_off = 15 },
    ]) {
      const fixture = stripeFixture()
      corrupt(fixture)

      await assert.rejects(
        runSupporterMembershipMigration({
          stripe: fixture.stripe,
          mode: "apply",
          env: migrationEnv(),
        }),
        (error) => {
          assert.equal(error.failureCodes.includes("coupon_dependency_mismatch"), true)
          return true
        },
      )
      assert.deepEqual(mutationCalls(fixture), [])
    }
  })

  it("never reuses an approved Price with a wrong amount or Therapist/Practice owner", async () => {
    for (const candidate of [
      price("price_wrong_amount", "prod_supporter", 150, "month", true, {
        massagelab_catalog: "supporter_membership_v1",
        massagelab_supporter_price_key: "support-1-month",
      }),
      price("price_wrong_owner", "prod_therapist", 100, "month", true, {
        massagelab_catalog: "supporter_membership_v1",
        massagelab_supporter_price_key: "support-1-month",
      }),
    ]) {
      const fixture = stripeFixture()
      fixture.prices.set(candidate.id, candidate)

      await assert.rejects(
        runSupporterMembershipMigration({
          stripe: fixture.stripe,
          mode: "apply",
          env: migrationEnv({
            STRIPE_SUPPORTER_1_MONTHLY_PRICE_ID: candidate.id,
          }),
        }),
        (error) => {
          assert.equal(error.failureCodes.includes("approved_price_dependency_mismatch"), true)
          return true
        },
      )
      assert.deepEqual(mutationCalls(fixture), [])
    }
  })

  it("fails closed when portal preservation dependencies are disabled or account livemode differs", async () => {
    {
      const fixture = stripeFixture()
      fixture.portal.features.invoice_history.enabled = false

      await assert.rejects(
        runSupporterMembershipMigration({
          stripe: fixture.stripe,
          mode: "apply",
          env: migrationEnv(),
        }),
        (error) => {
          assert.equal(error.failureCodes.includes("portal_dependency_mismatch"), true)
          return true
        },
      )
      assert.deepEqual(mutationCalls(fixture), [])
    }

    {
      const fixture = stripeFixture()
      fixture.stripe.balance.retrieve = async () => ({ object: "balance", livemode: true })

      await assert.rejects(
        runSupporterMembershipMigration({
          stripe: fixture.stripe,
          mode: "apply",
          env: migrationEnv(),
        }),
        (error) => {
          assert.equal(error.failureCodes.includes("stripe_account_mode_mismatch"), true)
          return true
        },
      )
      assert.deepEqual(mutationCalls(fixture), [])
    }
  })

  it("reduces Stripe mutation failures to safe codes", async () => {
    const fixture = stripeFixture()
    fixture.stripe.products.update = async () => {
      throw new Error("processor secret cus_private_test_account")
    }

    await assert.rejects(
      runSupporterMembershipMigration({
        stripe: fixture.stripe,
        mode: "apply",
        env: migrationEnv(),
      }),
      (error) => {
        assert.equal(error instanceof MigrationError, true)
        assert.deepEqual(error.failureCodes, ["stripe_mutation_failed"])
        assert.doesNotMatch(
          `${error.message} ${JSON.stringify(error.checks)}`,
          /processor secret|cus_private_test_account/,
        )
        return true
      },
    )
  })
})
