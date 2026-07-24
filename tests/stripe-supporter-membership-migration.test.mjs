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
    tax_code: null,
    metadata: id === "prod_supporter"
      ? { app: "massagelab", massagelab_membership_level: "SUPPORTER" }
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
    billing_scheme: "per_unit",
    recurring: {
      interval,
      interval_count: 1,
      trial_period_days: null,
      usage_type: "licensed",
    },
    tax_behavior: "exclusive",
    transform_quantity: null,
    currency_options: null,
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
        proration_behavior: "none",
        cancellation_reason: {
          enabled: true,
          options: ["other"],
        },
      },
      subscription_update: {
        enabled: true,
        default_allowed_updates: ["price"],
        billing_cycle_anchor: "unchanged",
        proration_behavior: "none",
        schedule_at_period_end: {
          conditions: [{ type: "decreasing_item_amount" }],
        },
        trial_update_behavior: "continue_trial",
        products: [
          {
            product: "prod_supporter",
            prices: ["price_supporter_month", "price_supporter_year"],
            adjustable_quantity: { enabled: false, minimum: 1, maximum: 99 },
          },
          {
            product: "prod_therapist",
            prices: ["price_therapist_month", "price_therapist_year"],
            adjustable_quantity: { enabled: false, minimum: 1, maximum: 99 },
          },
          {
            product: "prod_practice",
            prices: ["price_practice_month", "price_practice_year"],
            adjustable_quantity: { enabled: false, minimum: 1, maximum: 99 },
          },
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
  const productCreatesByIdempotencyKey = new Map()
  const priceCreatesByIdempotencyKey = new Map()

  function record(name, id = null, payload = null, options = null) {
    calls.push({ name, id, payload, options })
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
      async create(payload, options) {
        record("products.create", null, payload, options)
        const idempotencyKey = options?.idempotencyKey
        const existingId = idempotencyKey
          ? productCreatesByIdempotencyKey.get(idempotencyKey)
          : null
        if (existingId) {
          return structuredClone(products.get(existingId))
        }
        const id = "prod_created_supporter"
        const created = {
          id,
          object: "product",
          active: true,
          livemode: false,
          ...structuredClone(payload),
        }
        products.set(id, created)
        if (idempotencyKey) {
          productCreatesByIdempotencyKey.set(idempotencyKey, id)
        }
        return structuredClone(created)
      },
    },
    prices: {
      async list(payload) {
        record("prices.list", null, payload)
        const active = payload.active ?? true
        const data = [...prices.values()]
          .filter((entry) => !payload.product || entry.product === payload.product)
          .filter((entry) => entry.active === active)
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
      async create(payload, options) {
        record("prices.create", null, payload, options)
        const idempotencyKey = options?.idempotencyKey
        const existingId = idempotencyKey
          ? priceCreatesByIdempotencyKey.get(idempotencyKey)
          : null
        if (existingId) {
          return structuredClone(prices.get(existingId))
        }
        const id = `price_created_${nextPrice++}`
        const created = {
          id,
          object: "price",
          active: true,
          livemode: false,
          billing_scheme: "per_unit",
          tax_behavior: "exclusive",
          transform_quantity: null,
          currency_options: null,
          ...structuredClone(payload),
          recurring: {
            interval_count: 1,
            trial_period_days: null,
            usage_type: "licensed",
            ...structuredClone(payload.recurring),
          },
        }
        prices.set(id, created)
        if (idempotencyKey) {
          priceCreatesByIdempotencyKey.set(idempotencyKey, id)
        }
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
          const features = structuredClone(payload.features)
          features.subscription_update.products = features.subscription_update.products.map(
            (entry) => ({
              ...entry,
              adjustable_quantity: {
                enabled: entry.adjustable_quantity?.enabled ?? false,
                minimum: 1,
                maximum: 99,
              },
            }),
          )
          portal = {
            ...portal,
            ...structuredClone(payload),
            features,
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
    assert.equal(result.state, "PRE_MIGRATION")
    assert.equal(fixture.products.get("prod_supporter").tax_code, null)
    assert.equal(
      Object.hasOwn(
        fixture.products.get("prod_supporter").metadata,
        "massagelab_catalog",
      ),
      false,
    )
    assert.equal(mutationCalls(fixture).length, 0)
    assert.match(output, /PASS mode_and_account/)
    assert.match(output, /PASS subscriber_inventory/)
    assert.match(output, /PASS catalog_dependencies/)
    assert.match(output, /PASS coupon_dependencies/)
    assert.match(output, /PASS portal_dependencies/)
    assert.match(output, /PASS migration_state_pre_migration/)
    const priceList = fixture.calls.find(({ name }) => name === "prices.list")
    assert.deepEqual(priceList.payload.expand, ["data.currency_options"])
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
    assert.equal(result.state, "COMPLETED")
    assert.deepEqual(
      [...new Set(
        fixture.calls
          .filter(({ name }) => name === "prices.list")
          .map(({ payload }) => payload.active),
      )].sort(),
      [false, true],
    )
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
      proration_behavior: "none",
      cancellation_reason: {
        enabled: true,
        options: ["other"],
      },
    })
    assert.deepEqual(features.subscription_update, {
      enabled: true,
      default_allowed_updates: ["price"],
      billing_cycle_anchor: "unchanged",
      proration_behavior: "none",
      schedule_at_period_end: {
        conditions: [{ type: "decreasing_item_amount" }],
      },
      trial_update_behavior: "continue_trial",
      products: [{
        product: supporter.id,
        prices: approved.map((entry) => entry.id),
        adjustable_quantity: {
          enabled: false,
          minimum: 1,
          maximum: 99,
        },
      }],
    })
    const portalUpdate = fixture.calls.find(({ name }) => name === "portal.update")
    assert.deepEqual(
      portalUpdate.payload.features.subscription_update.products[0].adjustable_quantity,
      { enabled: false },
    )

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
    assert.equal(rerun.state, "COMPLETED")
    assert.equal(fixture.products.size, productCount)
    assert.equal(fixture.prices.size, priceCount)
    assert.deepEqual(mutationCalls(fixture), [])
  })

  it("keeps completed-state Product classification and metadata strict", async () => {
    for (const corrupt of [
      (candidate) => { candidate.tax_code = null },
      (candidate) => { delete candidate.metadata.massagelab_catalog },
    ]) {
      const fixture = stripeFixture()
      await runSupporterMembershipMigration({
        stripe: fixture.stripe,
        mode: "apply",
        env: migrationEnv(),
      })
      fixture.calls.length = 0
      corrupt(fixture.products.get("prod_supporter"))

      await assert.rejects(
        runSupporterMembershipMigration({
          stripe: fixture.stripe,
          mode: "verify",
          env: migrationEnv(),
        }),
        (error) => {
          assert.equal(
            error.failureCodes.includes("supporter_product_dependency_mismatch"),
            true,
          )
          return true
        },
      )
      assert.deepEqual(mutationCalls(fixture), [])
    }
  })

  it("rejects misidentified Therapist and Practice Products before any mutation", async () => {
    const cases = [
      {
        label: "Therapist name",
        productId: "prod_therapist",
        corrupt: (candidate) => {
          candidate.name = "Unrelated Scheduling Product"
        },
      },
      {
        label: "Therapist membership metadata",
        productId: "prod_therapist",
        corrupt: (candidate) => {
          candidate.metadata.massagelab_membership_level = "PRACTICE"
        },
      },
      {
        label: "Practice app metadata",
        productId: "prod_practice",
        corrupt: (candidate) => {
          candidate.metadata.app = "another_app"
        },
      },
    ]

    for (const testCase of cases) {
      const fixture = stripeFixture()
      testCase.corrupt(fixture.products.get(testCase.productId))

      await assert.rejects(
        runSupporterMembershipMigration({
          stripe: fixture.stripe,
          mode: "apply",
          env: migrationEnv(),
        }),
        (error) => {
          assert.equal(
            error.failureCodes.includes("product_dependency_mismatch"),
            true,
            testCase.label,
          )
          return true
        },
        testCase.label,
      )
      assert.deepEqual(mutationCalls(fixture), [], testCase.label)
    }
  })

  it("rejects mixed migration states instead of treating known subsets as safe", async () => {
    const corruptions = [
      (fixture) => {
        fixture.prices.get("price_supporter_month").active = false
      },
      (fixture) => {
        fixture.products.get("prod_therapist").active = false
      },
      (fixture) => {
        fixture.coupons.delete("coupon_student")
      },
      (fixture) => {
        fixture.portal.features.subscription_update.products = []
      },
    ]

    for (const corrupt of corruptions) {
      const fixture = stripeFixture()
      corrupt(fixture)

      await assert.rejects(
        runSupporterMembershipMigration({
          stripe: fixture.stripe,
          mode: "verify",
          env: migrationEnv(),
        }),
        (error) => {
          assert.equal(error.failureCodes.includes("migration_state_mixed"), true)
          return true
        },
      )
      assert.deepEqual(mutationCalls(fixture), [])

      await assert.rejects(
        runSupporterMembershipMigration({
          stripe: fixture.stripe,
          mode: "apply",
          env: migrationEnv(),
        }),
        (error) => {
          assert.equal(error.failureCodes.includes("migration_state_mixed"), true)
          return true
        },
      )
      assert.deepEqual(mutationCalls(fixture), [])
    }
  })

  it("creates one managed Supporter Product only when CREATE_NEW is explicit, then reuses it", async () => {
    const fixture = stripeFixture()
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

  it("manually proves pagination completeness beyond 10,000 rows", async () => {
    const fixture = stripeFixture()
    const rows = [
      ...fixture.subscriptions.map((entry) => structuredClone(entry)),
      ...Array.from({ length: 9_999 }, (_, index) => ({
        id: `sub_canceled_${index}`,
        object: "subscription",
        livemode: false,
        status: "canceled",
        customer: `cus_canceled_${index}`,
      })),
    ]
    const unexpected = {
      id: "sub_later_page_private",
      object: "subscription",
      livemode: false,
      status: "active",
      customer: "cus_later_page_private",
    }
    rows.push(unexpected)
    fixture.stripe.subscriptions.list = async ({ starting_after: cursor } = {}) => {
      const start = cursor
        ? rows.findIndex((entry) => entry.id === cursor) + 1
        : 0
      const data = rows.slice(start, start + 5_000)
      return {
        data,
        has_more: start + data.length < rows.length,
      }
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

  it("fails closed when a Stripe list claims more data but provides no cursor", async () => {
    const fixture = stripeFixture()
    fixture.stripe.prices.list = async () => ({ data: [], has_more: true })

    await assert.rejects(
      runSupporterMembershipMigration({
        stripe: fixture.stripe,
        mode: "verify",
        env: migrationEnv(),
      }),
      (error) => {
        assert.deepEqual(error.failureCodes, ["stripe_pagination_incomplete"])
        return true
      },
    )
    assert.deepEqual(mutationCalls(fixture), [])
  })

  it("rejects non-boolean Stripe pagination completion flags", async () => {
    for (const hasMore of [undefined, null, 0, "false"]) {
      const fixture = stripeFixture()
      const listProducts = fixture.stripe.products.list.bind(fixture.stripe.products)
      fixture.stripe.products.list = async (params) => ({
        ...await listProducts(params),
        has_more: hasMore,
      })

      await assert.rejects(
        runSupporterMembershipMigration({
          stripe: fixture.stripe,
          mode: "verify",
          env: migrationEnv(),
        }),
        (error) => {
          assert.deepEqual(error.failureCodes, ["stripe_pagination_incomplete"])
          return true
        },
      )
      assert.deepEqual(mutationCalls(fixture), [])
    }
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

  it("requires exact per-unit licensed untransformed USD Price semantics", async () => {
    const mutations = [
      (candidate) => { candidate.billing_scheme = "tiered" },
      (candidate) => { candidate.recurring.usage_type = "metered" },
      (candidate) => { candidate.transform_quantity = { divide_by: 10, round: "up" } },
      (candidate) => {
        candidate.currency_options = {
          eur: { unit_amount: 100 },
        }
      },
    ]

    for (const mutate of mutations) {
      const fixture = stripeFixture()
      const candidate = price(
        "price_semantics",
        "prod_supporter",
        100,
        "month",
        true,
        {
          massagelab_catalog: "supporter_membership_v1",
          massagelab_supporter_price_key: "support-1-month",
        },
      )
      mutate(candidate)
      fixture.prices.set(candidate.id, candidate)

      await assert.rejects(
        runSupporterMembershipMigration({
          stripe: fixture.stripe,
          mode: "verify",
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

  it("rejects reuse of a recurring Price with a default free-trial period", async () => {
    const fixture = stripeFixture()
    const candidate = price(
      "price_with_trial",
      "prod_supporter",
      100,
      "month",
      true,
      {
        massagelab_catalog: "supporter_membership_v1",
        massagelab_supporter_price_key: "support-1-month",
      },
    )
    candidate.recurring.trial_period_days = 14
    fixture.prices.set(candidate.id, candidate)

    await assert.rejects(
      runSupporterMembershipMigration({
        stripe: fixture.stripe,
        mode: "verify",
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
  })

  it("retires verified legacy and approved duplicates and leaves exactly six active Supporter Prices", async () => {
    const fixture = stripeFixture()
    fixture.prices.set(
      "price_therapist_month_duplicate",
      price("price_therapist_month_duplicate", "prod_therapist", 2900, "month"),
    )
    const selected = price(
      "price_approved_selected",
      "prod_supporter",
      100,
      "month",
      true,
      {
        massagelab_catalog: "supporter_membership_v1",
        massagelab_supporter_price_key: "support-1-month",
      },
    )
    selected.lookup_key = "massagelab_support_1_month"
    fixture.prices.set(selected.id, selected)
    fixture.prices.set(
      "price_approved_duplicate",
      price("price_approved_duplicate", "prod_supporter", 100, "month"),
    )

    const result = await runSupporterMembershipMigration({
      stripe: fixture.stripe,
      mode: "apply",
      env: migrationEnv({
        STRIPE_SUPPORTER_1_MONTHLY_PRICE_ID: selected.id,
      }),
    })

    assert.equal(result.state, "COMPLETED")
    assert.equal(fixture.prices.get("price_therapist_month_duplicate").active, false)
    assert.equal(fixture.prices.get("price_approved_duplicate").active, false)
    const activeSupporter = [...fixture.prices.values()].filter(
      (candidate) => candidate.product === "prod_supporter" && candidate.active,
    )
    assert.equal(activeSupporter.length, 6)
    assert.deepEqual(
      activeSupporter.map((candidate) => [candidate.unit_amount, candidate.recurring.interval]),
      [
        [100, "month"],
        [1000, "year"],
        [200, "month"],
        [2000, "year"],
        [500, "month"],
        [5000, "year"],
      ],
    )
    assert.equal(
      [...fixture.prices.values()].some(
        (candidate) => (
          ["prod_therapist", "prod_practice"].includes(candidate.product)
          && candidate.active
        ),
      ),
      false,
    )
  })

  it("rejects every unrecognized Price owned by a managed Product, even when inactive", async () => {
    for (const active of [true, false]) {
      const fixture = stripeFixture()
      fixture.prices.set(
        "price_unrecognized",
        price("price_unrecognized", "prod_practice", 12345, "month", active),
      )

      await assert.rejects(
        runSupporterMembershipMigration({
          stripe: fixture.stripe,
          mode: "apply",
          env: migrationEnv(),
        }),
        (error) => {
          assert.equal(error.failureCodes.includes("unexpected_managed_price"), true)
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

  it("reports unresolved legacy Portal products as dependency mismatches instead of throwing", async () => {
    const fixture = stripeFixture()
    fixture.prices.delete("price_supporter_month")
    fixture.prices.delete("price_supporter_year")

    await assert.rejects(
      runSupporterMembershipMigration({
        stripe: fixture.stripe,
        mode: "verify",
        env: migrationEnv({
          MASSAGELAB_STRIPE_MIGRATION_SUPPORTER_PRODUCT_ID: "CREATE_NEW",
        }),
      }),
      (error) => {
        assert.equal(
          error instanceof MigrationError,
          true,
          `${error?.constructor?.name}: ${error?.message}`,
        )
        assert.equal(error.failureCodes.includes("legacy_price_dependency_mismatch"), true)
        assert.equal(
          error.failureCodes.includes("product_dependency_mismatch"),
          true,
          JSON.stringify(error.failureCodes),
        )
        return true
      },
    )
    assert.deepEqual(mutationCalls(fixture), [])
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

  it("recovers forward from a verified partial portal mutation and still becomes idempotent", async () => {
    const fixture = stripeFixture()
    const updatePortal = fixture.stripe.billingPortal.configurations.update.bind(
      fixture.stripe.billingPortal.configurations,
    )
    let failAfterFirstMutation = true
    fixture.stripe.billingPortal.configurations.update = async (id, payload) => {
      const result = await updatePortal(id, payload)
      if (failAfterFirstMutation) {
        failAfterFirstMutation = false
        throw new Error("connection ended after Stripe accepted the update")
      }
      return result
    }

    const result = await runSupporterMembershipMigration({
      stripe: fixture.stripe,
      mode: "apply",
      env: migrationEnv(),
    })
    assert.equal(result.state, "COMPLETED")

    fixture.calls.length = 0
    const rerun = await runSupporterMembershipMigration({
      stripe: fixture.stripe,
      mode: "apply",
      env: migrationEnv(),
    })
    assert.equal(rerun.state, "COMPLETED")
    assert.deepEqual(mutationCalls(fixture), [])
  })

  it("retries an ambiguous committed Product create with one stable idempotency key", async () => {
    const fixture = stripeFixture()
    const createProduct = fixture.stripe.products.create.bind(fixture.stripe.products)
    const listProducts = fixture.stripe.products.list.bind(fixture.stripe.products)
    let failAfterCommit = true
    let hideCommittedProductLists = 0
    fixture.stripe.products.create = async (payload, options) => {
      const result = await createProduct(payload, options)
      if (failAfterCommit) {
        failAfterCommit = false
        hideCommittedProductLists = 1
        throw new Error("connection ended after Product commit")
      }
      return result
    }
    fixture.stripe.products.list = async (params) => {
      const result = await listProducts(params)
      if (hideCommittedProductLists > 0) {
        hideCommittedProductLists -= 1
        return {
          ...result,
          data: result.data.filter((entry) => entry.id !== "prod_created_supporter"),
        }
      }
      return result
    }

    const result = await runSupporterMembershipMigration({
      stripe: fixture.stripe,
      mode: "apply",
      env: migrationEnv({
        MASSAGELAB_STRIPE_MIGRATION_SUPPORTER_PRODUCT_ID: "CREATE_NEW",
      }),
    })
    assert.equal(result.state, "COMPLETED")
    const creates = fixture.calls.filter(({ name }) => name === "products.create")
    assert.equal(creates.length, 2)
    assert.deepEqual(
      creates.map(({ options }) => options?.idempotencyKey),
      [
        "massagelab-supporter-membership-v1-product",
        "massagelab-supporter-membership-v1-product",
      ],
    )
    assert.equal(
      [...fixture.products.values()].filter(
        (entry) => entry.metadata?.massagelab_catalog === "supporter_membership_v1",
      ).length,
      1,
    )
  })

  it("retries an ambiguous committed Price create with one stable idempotency key", async () => {
    const fixture = stripeFixture()
    const createPrice = fixture.stripe.prices.create.bind(fixture.stripe.prices)
    const listPrices = fixture.stripe.prices.list.bind(fixture.stripe.prices)
    let failAfterCommit = true
    let hiddenPriceId = null
    let hideCommittedPriceLists = 0
    fixture.stripe.prices.create = async (payload, options) => {
      const result = await createPrice(payload, options)
      if (failAfterCommit && payload.unit_amount === 100) {
        failAfterCommit = false
        hiddenPriceId = result.id
        hideCommittedPriceLists = 1
        throw new Error("connection ended after Price commit")
      }
      return result
    }
    fixture.stripe.prices.list = async (params) => {
      const result = await listPrices(params)
      if (hideCommittedPriceLists > 0) {
        hideCommittedPriceLists -= 1
        return {
          ...result,
          data: result.data.filter((entry) => entry.id !== hiddenPriceId),
        }
      }
      return result
    }

    const result = await runSupporterMembershipMigration({
      stripe: fixture.stripe,
      mode: "apply",
      env: migrationEnv(),
    })
    assert.equal(result.state, "COMPLETED")
    const creates = fixture.calls.filter(({ name, payload }) => (
      name === "prices.create" && payload.unit_amount === 100
    ))
    assert.equal(creates.length, 2)
    assert.deepEqual(
      creates.map(({ options }) => options?.idempotencyKey),
      [
        "massagelab-supporter-membership-v1-price-support-1-month",
        "massagelab-supporter-membership-v1-price-support-1-month",
      ],
    )
    assert.equal(
      [...fixture.prices.values()].filter(
        (entry) => entry.metadata?.massagelab_catalog === "supporter_membership_v1",
      ).length,
      6,
    )
  })
})
