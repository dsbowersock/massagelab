import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import { readFile } from "node:fs/promises"
import { describe, it } from "node:test"
import { fileURLToPath } from "node:url"
import {
  MAX_MANAGED_PRICE_INVENTORY,
  MigrationError,
  formatMigrationFailureChecklist,
  formatMigrationChecklist,
  legacySupporterProductOwnership,
  runSupporterMembershipMigration as runMigrationWithProductionRetry,
  targetSupporterProductReusable,
} from "../scripts/stripe-supporter-membership-migration.mjs"
import {
  SUPPORTER_MEMBERSHIP_CATALOG_VERSION,
} from "../lib/stripe-price-contract.js"

const LEGACY_PRICE_SPECS = Object.freeze([
  ["price_supporter_month", "prod_supporter", 900, "month"],
  ["price_supporter_year", "prod_supporter", 9000, "year"],
  ["price_therapist_month", "prod_therapist", 2900, "month"],
  ["price_therapist_year", "prod_therapist", 27900, "year"],
  ["price_practice_month", "prod_practice", 7900, "month"],
  ["price_practice_year", "prod_practice", 75900, "year"],
])

const SUPERSEDED_AMOUNT_PRICE_SPECS = Object.freeze([
  ["price_support_1_month", "prod_supporter", 100, "month"],
  ["price_support_1_year", "prod_supporter", 1000, "year"],
  ["price_support_2_month", "prod_therapist", 200, "month"],
  ["price_support_2_year", "prod_therapist", 2000, "year"],
  ["price_support_5_month", "prod_practice", 500, "month"],
  ["price_support_5_year", "prod_practice", 5000, "year"],
])

/** Builds the complete non-secret migration contract used by focused tests. */
function migrationEnv(overrides = {}) {
  return {
    STRIPE_SECRET_KEY: "sk_test_do_not_print",
    MASSAGELAB_STRIPE_MIGRATION_MODE: "test",
    MASSAGELAB_STRIPE_MIGRATION_ALLOWED_SUBSCRIPTION_ID: "sub_documented_test",
    MASSAGELAB_STRIPE_MIGRATION_SUPPORTER_PRODUCT_ID: "prod_supporter",
    MASSAGELAB_STRIPE_MIGRATION_SUPPORT_2_PRODUCT_ID: "CREATE_NEW",
    MASSAGELAB_STRIPE_MIGRATION_SUPPORT_5_PRODUCT_ID: "CREATE_NEW",
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

/** Creates a minimal Product that preserves the fields inspected by preflight. */
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

/** Mirrors the production lookup-key derivation for a managed target Price. */
function supporterLookupKeyFor(priceKey) {
  return `massagelab_${priceKey.replaceAll("-", "_")}`
}

/**
 * Creates a recurring Price with production-equivalent semantics and optional
 * populated expanded base-currency evidence.
 */
function price(
  id,
  productId,
  unitAmount,
  interval,
  active = true,
  metadata = {},
  withBaseCurrencyOption = false,
) {
  const managedPriceKey = metadata.massagelab_supporter_price_key
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
    currency_options: withBaseCurrencyOption
      ? {
          usd: {
            unit_amount: unitAmount,
            tax_behavior: "exclusive",
          },
        }
      : null,
    lookup_key: managedPriceKey ? supporterLookupKeyFor(managedPriceKey) : null,
    metadata,
  }
}

/** Creates the pre-migration Portal topology and preservation features. */
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
          options: [
            "too_expensive",
            "missing_features",
            "switched_service",
            "unused",
            "other",
          ],
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
        trial_update_behavior: "end_trial",
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

/** Returns the reviewed dormant Portal policy before support-amount switching is enabled. */
function disabledPortalSubscriptionUpdate() {
  return {
    enabled: false,
    default_allowed_updates: [],
    billing_cycle_anchor: "unchanged",
    proration_behavior: "none",
    schedule_at_period_end: {
      conditions: [{ type: "decreasing_item_amount" }],
    },
    trial_update_behavior: "end_trial",
  }
}

/** Enumerates customer-impacting switching-policy drift for fail-closed tests. */
function portalSwitchingPolicyDrifts() {
  return [
    ["billing cycle anchor", (features) => {
      features.subscription_update.billing_cycle_anchor = "now"
    }],
    ["proration behavior", (features) => {
      features.subscription_update.proration_behavior = "create_prorations"
    }],
    ["period-end schedule", (features) => {
      features.subscription_update.schedule_at_period_end.conditions = []
    }],
    ["trial behavior", (features) => {
      features.subscription_update.trial_update_behavior = "continue_trial"
    }],
  ]
}

/**
 * Reuses the pre-migration switching-policy matrix while reversing only the
 * period-end expectation for the completed immediate-switching state.
 */
function completedPortalSwitchingPolicyDrifts() {
  const drifts = portalSwitchingPolicyDrifts()
  assert.equal(
    drifts.some(([label]) => label === "period-end schedule"),
    true,
    "expected the base Portal drift matrix to include period-end scheduling",
  )
  return drifts.map(([label, corrupt]) => (
    label === "period-end schedule"
      ? [label, (features) => {
          features.subscription_update.schedule_at_period_end.conditions = [
            { type: "decreasing_item_amount" },
          ]
        }]
      : [label, corrupt]
  ))
}

/** Creates an SDK-shaped Stripe failure without exposing processor payloads. */
function stripeSdkError(type, statusCode) {
  return Object.assign(new Error(type), {
    type,
    ...(statusCode == null ? {} : { statusCode }),
  })
}

/**
 * Reserves `lookupKey` in the mutable fixture Price map.
 *
 * A conflicting owner is rejected unless transfer is exactly true; an allowed
 * transfer clears that owner's key. `currentPriceId` excludes the Price being
 * updated from conflict detection.
 */
function claimLookupKey(prices, lookupKey, transferLookupKey, currentPriceId = null) {
  if (!lookupKey) return
  const conflicting = [...prices.values()].find(
    (entry) => entry.id !== currentPriceId && entry.lookup_key === lookupKey,
  )
  if (conflicting && transferLookupKey !== true) {
    throw new Error("Lookup key is already assigned to another Price")
  }
  if (conflicting) {
    prices.set(conflicting.id, { ...conflicting, lookup_key: null })
  }
}

/**
 * Builds a Stripe double with an ordered call log, live resource maps, and a
 * live portal getter. Writes are recorded, creates replay by idempotency key,
 * missing reads use `resource_missing`, and API values are cloned so callers
 * cannot mutate the simulated Stripe state by alias.
 */
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
  let nextProduct = 1
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
        const idempotencyKey = options?.idempotencyKey
        const existingId = idempotencyKey
          ? productCreatesByIdempotencyKey.get(idempotencyKey)
          : null
        if (existingId) {
          record("products.create", existingId, payload, options)
          return structuredClone(products.get(existingId))
        }
        const id = `prod_created_supporter_${nextProduct++}`
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
        record("products.create", id, payload, options)
        return structuredClone(created)
      },
    },
    prices: {
      async list(payload) {
        record("prices.list", null, payload)
        const data = [...prices.values()]
          .filter((entry) => !payload.product || entry.product === payload.product)
          .filter((entry) => (
            typeof payload.active !== "boolean"
            || entry.active === payload.active
          ))
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
        const {
          transfer_lookup_key: transferLookupKey,
          ...storedPayload
        } = structuredClone(payload)
        claimLookupKey(prices, storedPayload.lookup_key, transferLookupKey, id)
        const updated = { ...current, ...storedPayload }
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
        const {
          transfer_lookup_key: transferLookupKey,
          ...storedPayload
        } = structuredClone(payload)
        claimLookupKey(prices, storedPayload.lookup_key, transferLookupKey)
        const id = `price_created_${nextPrice++}`
        const created = {
          id,
          object: "price",
          active: true,
          livemode: false,
          billing_scheme: "per_unit",
          tax_behavior: "exclusive",
          transform_quantity: null,
          ...storedPayload,
          ...(storedPayload.currency_options == null
            && storedPayload.unit_amount != null
            ? {
                currency_options: {
                  usd: {
                    unit_amount: storedPayload.unit_amount,
                    tax_behavior: storedPayload.tax_behavior ?? "exclusive",
                  },
                },
              }
            : {}),
          ...(storedPayload.recurring
            ? {
                recurring: {
                  interval_count: 1,
                  trial_period_days: null,
                  usage_type: "licensed",
                  ...structuredClone(storedPayload.recurring),
                },
              }
            : {}),
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

/**
 * Runs exported migration logic without real timers. Tests can still inject a
 * sleep spy to prove the production retry schedule deterministically.
 */
function runSupporterMembershipMigration(options) {
  return runMigrationWithProductionRetry({
    ...options,
    sleep: options.sleep ?? (async () => {}),
  })
}

/** Returns only writes from the fixture's complete ordered Stripe call trace. */
function mutationCalls(fixture) {
  return fixture.calls.filter(({ name }) => (
    name.endsWith(".create")
    || name.endsWith(".update")
    || name.endsWith(".del")
  ))
}

/** Proves a recorded write was followed by a fresh read of the same resource. */
function assertMutationWasReretrieved(calls, mutationIndex, retrieveName, id) {
  assert.equal(
    calls.slice(mutationIndex + 1).some(({ name, id: candidate }) => name === retrieveName && candidate === id),
    true,
  )
}

describe("Supporter membership Stripe migration", () => {
  it("derives one legacy Supporter owner while preserving split-owner evidence", () => {
    const config = {
      productIds: { supporter: "CREATE_NEW" },
      legacyPrices: [
        { id: "price_supporter_month", productKey: "supporter" },
        { id: "price_supporter_year", productKey: "supporter" },
      ],
    }
    const oneOwner = [
      { id: "price_supporter_month", product: "prod_supporter" },
      { id: "price_supporter_year", product: "prod_supporter" },
    ]
    const splitOwners = [
      oneOwner[0],
      { id: "price_supporter_year", product: "prod_other" },
    ]

    assert.deepEqual(
      legacySupporterProductOwnership(config, oneOwner),
      { productId: "prod_supporter", ambiguous: false },
    )
    assert.deepEqual(
      legacySupporterProductOwnership(config, splitOwners),
      { productId: "prod_supporter", ambiguous: true },
    )
    assert.deepEqual(
      legacySupporterProductOwnership({
        ...config,
        productIds: { supporter: "prod_configured" },
      }, splitOwners),
      { productId: "prod_configured", ambiguous: false },
    )
  })

  it("accepts only the three audited target Product reuse paths", () => {
    const support1Spec = { key: "support-1", configKey: "supporter" }
    const support2Spec = { key: "support-2", configKey: "support2" }
    const support5Spec = { key: "support-5", configKey: "support5" }
    const classifiedProduct = {
      id: "prod_classified",
      active: true,
      name: "MassageLab Supporter Membership",
      tax_code: "txcd_10000000",
      metadata: {
        app: "massagelab",
        massagelab_catalog: SUPPORTER_MEMBERSHIP_CATALOG_VERSION,
        massagelab_membership_level: "SUPPORTER",
        massagelab_supporter_amount_choice: "support-2",
      },
    }
    const unstampedMetadata = { ...classifiedProduct.metadata }
    delete unstampedMetadata.massagelab_supporter_amount_choice
    const unstampedSupporter = {
      ...classifiedProduct,
      metadata: unstampedMetadata,
    }
    const support5Product = {
      ...classifiedProduct,
      id: "prod_support_5",
      metadata: {
        ...classifiedProduct.metadata,
        massagelab_supporter_amount_choice: "support-5",
      },
    }

    assert.equal(
      targetSupporterProductReusable(
        product("prod_supporter", "MassageLab Supporter"),
        support1Spec,
      ),
      true,
    )
    assert.equal(
      targetSupporterProductReusable(classifiedProduct, support2Spec),
      true,
    )
    assert.equal(
      targetSupporterProductReusable(classifiedProduct, support1Spec),
      false,
    )
    assert.equal(
      targetSupporterProductReusable(support5Product, support5Spec),
      true,
    )
    assert.equal(
      targetSupporterProductReusable(support5Product, support2Spec),
      false,
    )
    assert.equal(
      targetSupporterProductReusable(classifiedProduct, support5Spec),
      false,
    )
    assert.equal(
      targetSupporterProductReusable(unstampedSupporter, support1Spec),
      true,
    )
    assert.equal(
      targetSupporterProductReusable(unstampedSupporter, support2Spec),
      false,
    )
    assert.equal(
      targetSupporterProductReusable(unstampedSupporter, support5Spec),
      false,
    )
    assert.equal(
      targetSupporterProductReusable(
        { ...classifiedProduct, active: false },
        support2Spec,
      ),
      false,
    )
  })

  it("uses the webhook/runtime source of truth for its pinned Stripe API version", async () => {
    const scriptSource = await readFile(
      new URL("../scripts/stripe-supporter-membership-migration.mjs", import.meta.url),
      "utf8",
    )

    assert.match(scriptSource, /import\s+\{\s*STRIPE_API_VERSION\s*\}\s+from\s+"..\/lib\/stripe-webhook-contract\.js"/)
    assert.match(scriptSource, /apiVersion:\s*STRIPE_API_VERSION/)
  })

  it("models Stripe Price listing as unfiltered unless active is explicit", async () => {
    const fixture = stripeFixture()
    fixture.prices.get("price_supporter_year").active = false

    const unfiltered = await fixture.stripe.prices.list({ limit: 100 })
    const active = await fixture.stripe.prices.list({ active: true, limit: 100 })
    const inactive = await fixture.stripe.prices.list({ active: false, limit: 100 })

    assert.equal(unfiltered.data.length, LEGACY_PRICE_SPECS.length)
    assert.equal(active.data.some(({ active: isActive }) => !isActive), false)
    assert.deepEqual(
      inactive.data.map(({ id }) => id),
      ["price_supporter_year"],
    )
  })

  it("exposes only the guarded Supporter migration package command", async () => {
    const packageSource = await readFile(
      new URL("../package.json", import.meta.url),
      "utf8",
    )
    const deploymentGuide = await readFile(
      new URL("../docs/wiki/deployment.md", import.meta.url),
      "utf8",
    )
    const packageJson = JSON.parse(packageSource)

    assert.doesNotMatch(packageSource, /stripe:live:setup|stripe-live-membership-setup/)
    assert.equal(
      packageJson.scripts["stripe:migrate-supporter-membership"],
      "node scripts/stripe-supporter-membership-migration.mjs",
    )
    assert.match(
      deploymentGuide,
      /npm run stripe:migrate-supporter-membership -- --mode=verify/,
    )
  })

  it("does not expose the Stripe secret in reports or recorded dependencies", async () => {
    const migrationSource = await readFile(
      new URL("../scripts/stripe-supporter-membership-migration.mjs", import.meta.url),
      "utf8",
    )
    assert.match(
      migrationSource,
      /new Stripe\(/,
    )
    assert.match(migrationSource, /apiVersion:\s*STRIPE_API_VERSION/)

    const privateSecret = "sk_test_private_not_retained"
    const fixture = stripeFixture()
    const result = await runSupporterMembershipMigration({
      stripe: fixture.stripe,
      mode: "verify",
      env: migrationEnv({ STRIPE_SECRET_KEY: privateSecret }),
    })
    assert.doesNotMatch(
      JSON.stringify({
        calls: fixture.calls,
        output: formatMigrationChecklist(result),
        result,
      }),
      new RegExp(privateSecret),
    )
  })

  it("reports safe local configuration codes before constructing a Stripe client", () => {
    const scriptPath = fileURLToPath(
      new URL("../scripts/stripe-supporter-membership-migration.mjs", import.meta.url),
    )
    const execution = spawnSync(process.execPath, [scriptPath, "--mode=verify"], {
      encoding: "utf8",
      env: {
        PATH: process.env.PATH,
        ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
        ...(process.env.COMSPEC ? { COMSPEC: process.env.COMSPEC } : {}),
        STRIPE_SECRET_KEY: "",
        MASSAGELAB_STRIPE_MIGRATION_MODE: "",
        MASSAGELAB_STRIPE_MIGRATION_ALLOWED_SUBSCRIPTION_ID: "",
        MASSAGELAB_STRIPE_MIGRATION_SUPPORTER_PRODUCT_ID: "",
        MASSAGELAB_STRIPE_MIGRATION_SUPPORT_2_PRODUCT_ID: "",
        MASSAGELAB_STRIPE_MIGRATION_SUPPORT_5_PRODUCT_ID: "",
        MASSAGELAB_STRIPE_MIGRATION_LEGACY_SUPPORTER_MONTHLY_PRICE_ID: "",
        MASSAGELAB_STRIPE_MIGRATION_LEGACY_SUPPORTER_YEARLY_PRICE_ID: "",
        MASSAGELAB_STRIPE_MIGRATION_THERAPIST_PRODUCT_ID: "",
        MASSAGELAB_STRIPE_MIGRATION_THERAPIST_MONTHLY_PRICE_ID: "",
        MASSAGELAB_STRIPE_MIGRATION_THERAPIST_YEARLY_PRICE_ID: "",
        MASSAGELAB_STRIPE_MIGRATION_PRACTICE_PRODUCT_ID: "",
        MASSAGELAB_STRIPE_MIGRATION_PRACTICE_MONTHLY_PRICE_ID: "",
        MASSAGELAB_STRIPE_MIGRATION_PRACTICE_YEARLY_PRICE_ID: "",
        MASSAGELAB_STRIPE_MIGRATION_STUDENT_COUPON_ID: "",
        MASSAGELAB_STRIPE_MIGRATION_EARLY_ACCESS_COUPON_ID: "",
        MASSAGELAB_STRIPE_MIGRATION_PORTAL_CONFIGURATION_ID: "",
        STRIPE_SUPPORTER_1_MONTHLY_PRICE_ID: "",
        STRIPE_SUPPORTER_1_YEARLY_PRICE_ID: "",
        STRIPE_SUPPORTER_2_MONTHLY_PRICE_ID: "",
        STRIPE_SUPPORTER_2_YEARLY_PRICE_ID: "",
        STRIPE_SUPPORTER_5_MONTHLY_PRICE_ID: "",
        STRIPE_SUPPORTER_5_YEARLY_PRICE_ID: "",
      },
    })

    assert.equal(execution.error, undefined, execution.error?.message)
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
          MASSAGELAB_STRIPE_MIGRATION_ALLOWED_SUBSCRIPTION_ID: "none",
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

  it("rejects malformed migration Product IDs before any Stripe API request", async () => {
    const cases = [
      ["MASSAGELAB_STRIPE_MIGRATION_SUPPORTER_PRODUCT_ID", "create_new"],
      ["MASSAGELAB_STRIPE_MIGRATION_SUPPORTER_PRODUCT_ID", "price_supporter"],
      ["MASSAGELAB_STRIPE_MIGRATION_SUPPORTER_PRODUCT_ID", "prod_"],
      ["MASSAGELAB_STRIPE_MIGRATION_SUPPORT_2_PRODUCT_ID", "create_new"],
      ["MASSAGELAB_STRIPE_MIGRATION_SUPPORT_5_PRODUCT_ID", "price_supporter"],
      ["MASSAGELAB_STRIPE_MIGRATION_THERAPIST_PRODUCT_ID", "CREATE_NEW"],
      ["MASSAGELAB_STRIPE_MIGRATION_THERAPIST_PRODUCT_ID", "Prod_therapist"],
      ["MASSAGELAB_STRIPE_MIGRATION_PRACTICE_PRODUCT_ID", "price_practice"],
      ["MASSAGELAB_STRIPE_MIGRATION_PRACTICE_PRODUCT_ID", "product_practice"],
    ]

    for (const [key, value] of cases) {
      const fixture = stripeFixture()
      await assert.rejects(
        runSupporterMembershipMigration({
          stripe: fixture.stripe,
          mode: "verify",
          env: migrationEnv({ [key]: value }),
        }),
        (error) => {
          assert.deepEqual(error.failureCodes, ["migration_product_ids_required"])
          return true
        },
        `${key}=${value}`,
      )
      assert.deepEqual(fixture.calls, [], `${key}=${value}`)
    }
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
    const priceListCalls = fixture.calls.filter(({ name }) => name === "prices.list")
    assert.equal(priceListCalls.length, 6)
    assert.equal(
      priceListCalls.every(({ payload }) => payload.product && [true, false].includes(payload.active)),
      true,
      "every Price scan must be constrained to a managed Product and explicit active state",
    )
    assert.equal(
      priceListCalls.every(({ payload }) => (
        JSON.stringify(payload.expand) === JSON.stringify(["data.currency_options"])
      )),
      true,
    )
    assert.deepEqual(
      new Set(priceListCalls.map(({ payload }) => payload.product)),
      new Set(["prod_supporter", "prod_therapist", "prod_practice"]),
    )
    assert.deepEqual(
      fixture.calls
        .filter(({ name }) => name === "prices.retrieve")
        .map(({ id }) => id)
        .sort(),
      LEGACY_PRICE_SPECS.map(([id]) => id).sort(),
      "explicit legacy Price dependencies must be retrieved even before product-filtered scans",
    )
    assert.doesNotMatch(
      output,
      /cus_private_test_account|sub_documented_test|sk_test_do_not_print|price_supporter|prod_supporter|coupon_student|bpc_membership/,
    )
  })

  it("formats failed checks and failure codes without printing retained causes", () => {
    const privateCause = new Error("cus_private price_private@example.com")
    const error = new MigrationError(
      ["portal_dependency_mismatch"],
      [
        { status: "PASS", code: "mode_and_account" },
        { status: "FAIL", code: "portal_dependencies" },
      ],
      { cause: privateCause },
    )

    const output = formatMigrationFailureChecklist(error)
    assert.equal(
      output,
      [
        "PASS mode_and_account",
        "FAIL portal_dependencies",
        "FAIL portal_dependency_mismatch",
      ].join("\n"),
    )
    assert.doesNotMatch(output, /cus_private|price_private|example\.com/)
    assert.equal(error.cause, privateCause)
  })

  it("ignores terminal subscriptions whose stale cancellation flag remains true", async () => {
    const fixture = stripeFixture()
    fixture.subscriptions.splice(
      0,
      fixture.subscriptions.length,
      {
        id: "sub_canceled",
        object: "subscription",
        livemode: false,
        status: "canceled",
        cancel_at_period_end: true,
      },
      {
        id: "sub_incomplete_expired",
        object: "subscription",
        livemode: false,
        status: "incomplete_expired",
        cancel_at_period_end: true,
      },
    )

    const result = await runSupporterMembershipMigration({
      stripe: fixture.stripe,
      mode: "verify",
      env: migrationEnv({
        MASSAGELAB_STRIPE_MIGRATION_ALLOWED_SUBSCRIPTION_ID: "NONE",
      }),
    })

    assert.equal(result.ok, true)
    assert.equal(result.state, "PRE_MIGRATION")
    assert.match(formatMigrationChecklist(result), /PASS subscriber_inventory/)
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
      (entry) => (
        entry.metadata?.massagelab_catalog === SUPPORTER_MEMBERSHIP_CATALOG_VERSION
      ),
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
      entry.active
      && entry.currency === "usd"
      && entry.tax_behavior === "exclusive"
      && Boolean(entry.metadata?.massagelab_supporter_price_key)
      && fixture.products.get(entry.product)?.metadata
        ?.massagelab_supporter_amount_choice === entry.metadata
          .massagelab_supporter_price_key.replace(/-(month|year)$/, "")
    )), true)
    const targetProductIds = new Map(
      ["support-1", "support-2", "support-5"].map((amountChoice) => {
        const productId = [...fixture.products.values()].find(
          (entry) => (
            entry.metadata?.massagelab_supporter_amount_choice === amountChoice
          ),
        )?.id
        assert.ok(productId, `expected a target Product for ${amountChoice}`)
        return [amountChoice, productId]
      }),
    )
    assert.deepEqual(
      fixture.calls
        .filter(({ name }) => name === "prices.create")
        .map(({ options }) => options.idempotencyKey),
      [
        ...["support-1", "support-2", "support-5"].flatMap((amountChoice) => (
          ["month", "year"].map((interval) => (
            `massagelab-supporter-membership-v1-price-${targetProductIds.get(amountChoice)}-${amountChoice}-${interval}`
          ))
        )),
      ],
    )
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
        options: [
          "too_expensive",
          "missing_features",
          "switched_service",
          "unused",
          "other",
        ],
      },
    })
    assert.deepEqual(features.subscription_update, {
      enabled: true,
      default_allowed_updates: ["price"],
      billing_cycle_anchor: "unchanged",
      proration_behavior: "none",
      schedule_at_period_end: {
        conditions: [],
      },
      trial_update_behavior: "end_trial",
      products: ["support-1", "support-2", "support-5"].map((amountChoice) => ({
        product: [...fixture.products.values()].find(
          (entry) => entry.metadata?.massagelab_supporter_amount_choice === amountChoice,
        ).id,
        prices: approved
          .filter((entry) => entry.metadata.massagelab_supporter_price_key.startsWith(amountChoice))
          .sort((left, right) => (
            left.metadata.massagelab_supporter_price_key.localeCompare(
              right.metadata.massagelab_supporter_price_key,
            )
          ))
          .map((entry) => entry.id),
        adjustable_quantity: {
          enabled: false,
          minimum: 1,
          maximum: 99,
        },
      })),
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
        assert.ok(call.id, "the Product create trace should retain its response ID")
        assertMutationWasReretrieved(
          fixture.calls,
          index,
          "products.retrieve",
          call.id,
        )
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

  it("reuses the exact legacy Supporter Product and retires older amount Prices split across legacy tiers", async () => {
    const fixture = stripeFixture()
    delete fixture.products.get("prod_supporter").metadata.app
    for (const [id, productId, unitAmount, interval] of SUPERSEDED_AMOUNT_PRICE_SPECS) {
      const candidate = price(id, productId, unitAmount, interval)
      candidate.tax_behavior = "unspecified"
      fixture.prices.set(id, candidate)
    }

    const result = await runSupporterMembershipMigration({
      stripe: fixture.stripe,
      mode: "apply",
      env: migrationEnv(),
    })

    assert.equal(result.state, "COMPLETED")
    assert.equal(
      SUPERSEDED_AMOUNT_PRICE_SPECS.every(([id]) => fixture.prices.get(id).active === false),
      true,
    )
    assert.equal(
      fixture.calls.filter(({ name }) => name === "products.create").length,
      2,
      "only the $2/$20 and $5/$50 Products should be created",
    )
    const supporter = fixture.products.get("prod_supporter")
    assert.equal(supporter.name, "MassageLab Supporter Membership")
    assert.equal(supporter.tax_code, "txcd_10000000")
    assert.equal(
      [...fixture.prices.values()].filter(
        (candidate) => candidate.product === supporter.id && candidate.active,
      ).length,
      2,
    )
  })

  it("rejects present but empty legacy Supporter app metadata", async () => {
    const fixture = stripeFixture()
    fixture.products.get("prod_supporter").metadata.app = ""

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
  })

  it("recovers the disabled partial apply into three amount Products with immediate switching", async () => {
    const fixture = stripeFixture()
    fixture.portal.features.subscription_update = disabledPortalSubscriptionUpdate()

    for (const [id, productId, unitAmount, interval, key] of [
      ["price_partial_support_1_month", "prod_supporter", 100, "month", "support-1-month"],
      ["price_partial_support_1_year", "prod_supporter", 1000, "year", "support-1-year"],
      ["price_partial_support_2_month", "prod_supporter", 200, "month", "support-2-month"],
      ["price_partial_support_2_year", "prod_supporter", 2000, "year", "support-2-year"],
      ["price_partial_support_5_month", "prod_supporter", 500, "month", "support-5-month"],
      ["price_partial_support_5_year", "prod_supporter", 5000, "year", "support-5-year"],
    ]) {
      fixture.prices.set(id, price(id, productId, unitAmount, interval, true, {
        app: "massagelab",
        massagelab_catalog: SUPPORTER_MEMBERSHIP_CATALOG_VERSION,
        massagelab_membership_level: "SUPPORTER",
        massagelab_supporter_price_key: key,
      }))
    }
    Object.assign(fixture.products.get("prod_supporter"), {
      name: "MassageLab Supporter Membership",
      tax_code: "txcd_10000000",
      metadata: {
        app: "massagelab",
        massagelab_catalog: SUPPORTER_MEMBERSHIP_CATALOG_VERSION,
        massagelab_membership_level: "SUPPORTER",
      },
    })

    const verification = await runSupporterMembershipMigration({
      stripe: fixture.stripe,
      mode: "verify",
      env: migrationEnv(),
    })
    assert.equal(verification.state, "PRE_MIGRATION")
    assert.deepEqual(mutationCalls(fixture), [])

    fixture.calls.length = 0
    const result = await runSupporterMembershipMigration({
      stripe: fixture.stripe,
      mode: "apply",
      env: migrationEnv(),
    })

    assert.equal(result.state, "COMPLETED")
    assert.equal(fixture.portal.features.subscription_update.enabled, true)
    assert.deepEqual(
      fixture.portal.features.subscription_update.default_allowed_updates,
      ["price"],
    )
    assert.equal(fixture.portal.features.subscription_update.products.length, 3)
    assert.deepEqual(
      fixture.portal.features.subscription_update.schedule_at_period_end.conditions,
      [],
    )
    assert.equal(
      fixture.portal.features.subscription_update.products.every((entry) => (
        entry.prices.length === 2
        && entry.prices.every((id) => {
          const configuredPrice = fixture.prices.get(id)
          return configuredPrice?.active && configuredPrice.product === entry.product
        })
      )),
      true,
    )
    assert.deepEqual(
      fixture.portal.features.subscription_update.products.map(({ product: id }) => (
        fixture.products.get(id)?.metadata?.massagelab_supporter_amount_choice
      )),
      ["support-1", "support-2", "support-5"],
    )
    assert.equal(fixture.prices.get("price_partial_support_2_month").active, false)
    assert.equal(fixture.prices.get("price_partial_support_2_year").active, false)
    assert.equal(fixture.prices.get("price_partial_support_5_month").active, false)
    assert.equal(fixture.prices.get("price_partial_support_5_year").active, false)
  })

  it("rejects a managed wrong-owner Price whose target semantics do not match", async () => {
    const fixture = stripeFixture()
    fixture.portal.features.subscription_update = disabledPortalSubscriptionUpdate()
    fixture.prices.set(
      "price_corrupt_partial_support_2_month",
      price(
        "price_corrupt_partial_support_2_month",
        "prod_supporter",
        201,
        "month",
        true,
        {
          app: "massagelab",
          massagelab_catalog: SUPPORTER_MEMBERSHIP_CATALOG_VERSION,
          massagelab_membership_level: "SUPPORTER",
          massagelab_supporter_price_key: "support-2-month",
        },
      ),
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
  })

  it("rejects a managed target Price on an undocumented historical Product", async () => {
    const fixture = stripeFixture()
    fixture.portal.features.subscription_update = disabledPortalSubscriptionUpdate()
    fixture.prices.set(
      "price_wrong_historical_owner",
      price(
        "price_wrong_historical_owner",
        "prod_therapist",
        500,
        "month",
        true,
        {
          app: "massagelab",
          massagelab_catalog: SUPPORTER_MEMBERSHIP_CATALOG_VERSION,
          massagelab_membership_level: "SUPPORTER",
          massagelab_supporter_price_key: "support-5-month",
        },
      ),
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
  })

  it("rejects a disabled pre-migration Portal whose dormant switching policy drifted", async () => {
    for (const [label, corruptPolicy] of portalSwitchingPolicyDrifts()) {
      const fixture = stripeFixture()
      fixture.portal.features.subscription_update = disabledPortalSubscriptionUpdate()
      corruptPolicy(fixture.portal.features)

      await assert.rejects(
        runSupporterMembershipMigration({
          stripe: fixture.stripe,
          mode: "apply",
          env: migrationEnv(),
        }),
        (error) => {
          assert.equal(
            error.failureCodes.includes("portal_dependency_mismatch"),
            true,
            label,
          )
          return true
        },
      )
      assert.deepEqual(mutationCalls(fixture), [], label)
    }
  })

  it("rejects completed Portal switching-policy drift instead of treating it as idempotent", async () => {
    for (const [label, corruptPolicy] of completedPortalSwitchingPolicyDrifts()) {
      const fixture = stripeFixture()
      await runSupporterMembershipMigration({
        stripe: fixture.stripe,
        mode: "apply",
        env: migrationEnv(),
      })
      fixture.calls.splice(0)
      corruptPolicy(fixture.portal.features)

      await assert.rejects(
        runSupporterMembershipMigration({
          stripe: fixture.stripe,
          mode: "verify",
          env: migrationEnv(),
        }),
        (error) => {
          assert.equal(
            error.failureCodes.includes("portal_dependency_mismatch"),
            true,
            label,
          )
          return true
        },
      )
      assert.deepEqual(mutationCalls(fixture), [], label)
    }
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

  it("repairs display-only drift on an identified amount Product", async () => {
    const fixture = stripeFixture()
    await runSupporterMembershipMigration({
      stripe: fixture.stripe,
      mode: "apply",
      env: migrationEnv(),
    })
    const support2 = [...fixture.products.values()].find(
      (candidate) => (
        candidate.metadata?.massagelab_supporter_amount_choice === "support-2"
      ),
    )
    const support2Id = support2.id
    support2.description = "Outdated support amount description"
    fixture.calls.length = 0

    const result = await runSupporterMembershipMigration({
      stripe: fixture.stripe,
      mode: "apply",
      env: migrationEnv(),
    })

    assert.equal(result.state, "COMPLETED")
    assert.match(
      fixture.products.get(support2Id).description,
      /^\$2 monthly or \$20 annually\./,
    )
    assert.equal(
      fixture.calls.filter(({ name }) => name === "products.update").length,
      1,
    )
    assert.equal(
      fixture.calls.find(({ name }) => name === "products.update")?.id,
      support2Id,
    )
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

  it("accepts a fully absent legacy coupon set and keeps deletion guarded", async () => {
    const fixture = stripeFixture()
    fixture.coupons.clear()

    const verification = await runSupporterMembershipMigration({
      stripe: fixture.stripe,
      mode: "verify",
      env: migrationEnv(),
    })
    assert.equal(verification.state, "PRE_MIGRATION")
    assert.deepEqual(mutationCalls(fixture), [])

    const applied = await runSupporterMembershipMigration({
      stripe: fixture.stripe,
      mode: "apply",
      env: migrationEnv(),
    })
    assert.equal(applied.state, "COMPLETED")
    assert.equal(
      fixture.calls.filter(({ name }) => name === "coupons.del").length,
      0,
    )
  })

  it("recovers an interrupted coupon retirement and remains idempotent", async () => {
    const fixture = stripeFixture()
    const survivingCoupon = structuredClone(fixture.coupons.get("coupon_early"))
    const initial = await runSupporterMembershipMigration({
      stripe: fixture.stripe,
      mode: "apply",
      env: migrationEnv(),
    })
    assert.equal(initial.state, "COMPLETED")

    // Reconstruct the observable state after one coupon deletion committed and
    // the command stopped before deleting the other verified dependency.
    fixture.coupons.set(survivingCoupon.id, survivingCoupon)
    fixture.calls.length = 0

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

    const recovered = await runSupporterMembershipMigration({
      stripe: fixture.stripe,
      mode: "apply",
      env: migrationEnv(),
    })
    assert.equal(recovered.state, "COMPLETED")
    assert.deepEqual(
      fixture.calls
        .filter(({ name }) => name === "coupons.del")
        .map(({ id }) => id),
      ["coupon_early"],
    )

    fixture.calls.length = 0
    const rerun = await runSupporterMembershipMigration({
      stripe: fixture.stripe,
      mode: "apply",
      env: migrationEnv(),
    })
    assert.equal(rerun.state, "COMPLETED")
    assert.deepEqual(mutationCalls(fixture), [])
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
          assert.equal(
            error.checks.find(({ code }) => (
              code === "migration_state_transitional"
            ))?.status,
            "FAIL",
          )
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
          assert.equal(
            error.checks.find(({ code }) => (
              code === "migration_state_transitional"
            ))?.status,
            "FAIL",
          )
          return true
        },
      )
      assert.deepEqual(mutationCalls(fixture), [])
    }
  })

  it("creates exactly three managed amount Products when CREATE_NEW is explicit, then reuses them", async () => {
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
        (entry) => (
          entry.metadata?.massagelab_catalog === SUPPORTER_MEMBERSHIP_CATALOG_VERSION
        ),
      ).length,
      3,
    )
    assert.equal(
      fixture.calls.filter(({ name }) => name === "products.create").length,
      3,
    )

    fixture.calls.length = 0
    await runSupporterMembershipMigration({
      stripe: fixture.stripe,
      mode: "apply",
      env,
    })
    assert.deepEqual(mutationCalls(fixture), [])
  })

  it("recovers a discovered legacy support-1 Product after other amount Products exist", async () => {
    const fixture = stripeFixture()
    const sharedMetadata = {
      app: "massagelab",
      massagelab_catalog: SUPPORTER_MEMBERSHIP_CATALOG_VERSION,
      massagelab_membership_level: "SUPPORTER",
    }
    Object.assign(fixture.products.get("prod_supporter"), {
      name: "MassageLab Supporter Membership",
      description: "$1 monthly or $10 annually. Same Supporter Membership benefits; only the support amount differs.",
      tax_code: "txcd_10000000",
      metadata: { ...sharedMetadata },
    })
    fixture.products.set("prod_support_2", {
      ...product("prod_support_2", "MassageLab Supporter Membership"),
      description: "$2 monthly or $20 annually. Same Supporter Membership benefits; only the support amount differs.",
      tax_code: "txcd_10000000",
      metadata: {
        ...sharedMetadata,
        massagelab_supporter_amount_choice: "support-2",
      },
    })
    fixture.products.set("prod_support_5", {
      ...product("prod_support_5", "MassageLab Supporter Membership"),
      description: "$5 monthly or $50 annually. Same Supporter Membership benefits; only the support amount differs.",
      tax_code: "txcd_10000000",
      metadata: {
        ...sharedMetadata,
        massagelab_supporter_amount_choice: "support-5",
      },
    })

    const result = await runSupporterMembershipMigration({
      stripe: fixture.stripe,
      mode: "apply",
      env: migrationEnv({
        MASSAGELAB_STRIPE_MIGRATION_SUPPORTER_PRODUCT_ID: "CREATE_NEW",
      }),
    })

    assert.equal(result.state, "COMPLETED")
    assert.equal(
      fixture.products.get("prod_supporter").metadata.massagelab_supporter_amount_choice,
      "support-1",
    )
    assert.equal(
      fixture.calls.filter(({ name }) => name === "products.create").length,
      0,
    )
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

  it("retains unknown future subscription statuses in fail-closed inventory", async () => {
    const fixture = stripeFixture()
    fixture.subscriptions.push({
      id: "sub_future_private",
      object: "subscription",
      livemode: false,
      status: "future_nonterminal_status",
      customer: "cus_future_private",
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
          /sub_future_private|cus_future_private/,
        )
        return true
      },
    )
    assert.deepEqual(mutationCalls(fixture), [])
  })

  it("excludes only explicit terminal Stripe statuses from subscriber inventory", async () => {
    const fixture = stripeFixture()
    fixture.subscriptions.push(
      {
        id: "sub_canceled",
        object: "subscription",
        livemode: false,
        status: "canceled",
      },
      {
        id: "sub_incomplete_expired",
        object: "subscription",
        livemode: false,
        status: "incomplete_expired",
      },
    )

    const result = await runSupporterMembershipMigration({
      stripe: fixture.stripe,
      mode: "verify",
      env: migrationEnv(),
    })

    assert.equal(result.state, "PRE_MIGRATION")
    assert.deepEqual(mutationCalls(fixture), [])
  })

  it("accepts the no-subscription sentinel case-insensitively", async () => {
    const fixture = stripeFixture()
    fixture.subscriptions.length = 0

    const result = await runSupporterMembershipMigration({
      stripe: fixture.stripe,
      mode: "verify",
      env: migrationEnv({
        MASSAGELAB_STRIPE_MIGRATION_ALLOWED_SUBSCRIPTION_ID: " NoNe ",
      }),
    })

    assert.equal(result.state, "PRE_MIGRATION")
    assert.deepEqual(mutationCalls(fixture), [])
  })

  it("rejects a concrete subscription allowlist in live mode before Stripe access", async () => {
    const fixture = stripeFixture()

    await assert.rejects(
      runSupporterMembershipMigration({
        stripe: fixture.stripe,
        mode: "verify",
        env: migrationEnv({
          STRIPE_SECRET_KEY: "sk_live_do_not_print",
          MASSAGELAB_STRIPE_MIGRATION_MODE: "live",
          MASSAGELAB_STRIPE_MIGRATION_ALLOWED_SUBSCRIPTION_ID:
            "sub_documented_live",
        }),
      }),
      (error) => {
        assert.deepEqual(error.failureCodes, ["live_subscription_inventory_forbidden"])
        return true
      },
    )
    assert.deepEqual(fixture.calls, [])
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

  it("fails closed when a Stripe list exceeds the finite page bound", async () => {
    const fixture = stripeFixture()
    let pages = 0
    fixture.stripe.subscriptions.list = async () => {
      pages += 1
      return {
        data: [{ id: `sub_canceled_page_${pages}`, status: "canceled" }],
        has_more: true,
      }
    }

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
    assert.equal(pages, 10_000)
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
        massagelab_catalog: SUPPORTER_MEMBERSHIP_CATALOG_VERSION,
        massagelab_supporter_price_key: "support-1-month",
      }),
      price("price_wrong_owner", "prod_therapist", 100, "month", true, {
        massagelab_catalog: SUPPORTER_MEMBERSHIP_CATALOG_VERSION,
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

  it("rejects ambiguous exact target Prices when no approved ID selects one", async () => {
    const fixture = stripeFixture()
    fixture.prices.set(
      "price_exact_target_a",
      price("price_exact_target_a", "prod_supporter", 100, "month"),
    )
    fixture.prices.set(
      "price_exact_target_b",
      price("price_exact_target_b", "prod_supporter", 100, "month"),
    )

    await assert.rejects(
      runSupporterMembershipMigration({
        stripe: fixture.stripe,
        mode: "apply",
        env: migrationEnv(),
      }),
      (error) => {
        assert.equal(error.failureCodes.includes("approved_price_dependency_mismatch"), true)
        return true
      },
    )
    assert.deepEqual(mutationCalls(fixture), [])
  })

  it("requires exact per-unit licensed untransformed USD Price semantics", async () => {
    const mutations = [
      (candidate) => { candidate.active = false },
      (candidate) => { candidate.currency = "cad" },
      (candidate) => { candidate.recurring.interval = "year" },
      (candidate) => { candidate.recurring.interval_count = 2 },
      (candidate) => { candidate.billing_scheme = "tiered" },
      (candidate) => { candidate.recurring.usage_type = "metered" },
      (candidate) => { candidate.transform_quantity = { divide_by: 10, round: "up" } },
      (candidate) => {
        candidate.currency_options = {
          eur: { unit_amount: 100 },
        }
      },
      (candidate) => {
        candidate.currency_options = {
          usd: {
            unit_amount: 101,
            tax_behavior: "exclusive",
          },
        }
      },
      (candidate) => {
        candidate.currency_options = {
          usd: {
            unit_amount: 100,
            tax_behavior: "inclusive",
          },
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
          massagelab_catalog: SUPPORTER_MEMBERSHIP_CATALOG_VERSION,
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
        massagelab_catalog: SUPPORTER_MEMBERSHIP_CATALOG_VERSION,
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
        massagelab_catalog: SUPPORTER_MEMBERSHIP_CATALOG_VERSION,
        massagelab_supporter_price_key: "support-1-month",
      },
      true,
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
    const activeSupporter = [...fixture.prices.values()].filter((candidate) => (
      candidate.active
      && fixture.products.get(candidate.product)?.metadata
        ?.massagelab_catalog === SUPPORTER_MEMBERSHIP_CATALOG_VERSION
    ))
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

  it("transfers a managed lookup key from a retiring duplicate Price", async () => {
    const fixture = stripeFixture()
    const updatePortal = fixture.stripe.billingPortal.configurations.update.bind(
      fixture.stripe.billingPortal.configurations,
    )
    const selected = price(
      "price_approved_selected",
      "prod_supporter",
      100,
      "month",
      true,
      {
        massagelab_catalog: SUPPORTER_MEMBERSHIP_CATALOG_VERSION,
        massagelab_supporter_price_key: "support-1-month",
      },
    )
    selected.lookup_key = null
    const retiring = price(
      "price_approved_duplicate",
      "prod_supporter",
      100,
      "month",
    )
    retiring.lookup_key = "massagelab_support_1_month"
    fixture.prices.set(selected.id, selected)
    fixture.prices.set(retiring.id, retiring)

    fixture.stripe.billingPortal.configurations.update = async () => {
      throw stripeSdkError("StripeInvalidRequestError", 400)
    }
    try {
      await assert.rejects(
        runSupporterMembershipMigration({
          stripe: fixture.stripe,
          mode: "apply",
          env: migrationEnv({
            STRIPE_SUPPORTER_1_MONTHLY_PRICE_ID: selected.id,
          }),
        }),
        (error) => {
          assert.deepEqual(error.failureCodes, ["stripe_mutation_failed"])
          return true
        },
      )
      assert.equal(
        fixture.prices.get(selected.id).lookup_key,
        "massagelab_support_1_month",
      )
      assert.equal(fixture.prices.get(retiring.id).lookup_key, null)
      assert.equal(
        fixture.prices.get(retiring.id).active,
        true,
        "the Portal gate must precede destructive Price cleanup",
      )
      assert.equal(
        fixture.calls.some(({ name, payload }) => (
          name === "prices.update" && payload?.active === false
        )),
        false,
      )
      const selectedUpdate = fixture.calls.find(
        ({ name, id }) => name === "prices.update" && id === selected.id,
      )
      assert.equal(selectedUpdate.payload.transfer_lookup_key, true)
    } finally {
      fixture.stripe.billingPortal.configurations.update = updatePortal
    }

    fixture.calls.length = 0
    const result = await runSupporterMembershipMigration({
      stripe: fixture.stripe,
      mode: "apply",
      env: migrationEnv({
        STRIPE_SUPPORTER_1_MONTHLY_PRICE_ID: selected.id,
      }),
    })

    assert.equal(result.state, "COMPLETED")
    assert.equal(
      fixture.prices.get(selected.id).lookup_key,
      "massagelab_support_1_month",
    )
    assert.equal(fixture.prices.get(retiring.id).lookup_key, null)
    assert.equal(fixture.prices.get(retiring.id).active, false)
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

  it("fails closed before mutation when managed Price retention exceeds its documented ceiling", async () => {
    const fixture = stripeFixture()
    const overflowPriceId = "price_managed_inventory_overflow"
    const additionalPrices = MAX_MANAGED_PRICE_INVENTORY - fixture.prices.size + 1
    for (let index = 0; index < additionalPrices; index += 1) {
      fixture.prices.set(
        `${overflowPriceId}_${index}`,
        price(`${overflowPriceId}_${index}`, "prod_supporter", 900, "month"),
      )
    }

    await assert.rejects(
      runSupporterMembershipMigration({
        stripe: fixture.stripe,
        mode: "apply",
        env: migrationEnv(),
      }),
      (error) => {
        assert.deepEqual(error.failureCodes, ["managed_price_inventory_overflow"])
        assert.equal(
          formatMigrationFailureChecklist(error),
          "FAIL managed_price_inventory_overflow",
        )
        assert.doesNotMatch(formatMigrationFailureChecklist(error), new RegExp(overflowPriceId))
        return true
      },
    )
    assert.deepEqual(mutationCalls(fixture), [])
  })

  it("fails closed when Portal billing-management dependencies drift or account livemode differs", async () => {
    const portalCorruptions = [
      (fixture) => {
        fixture.portal.features.invoice_history.enabled = false
      },
      (fixture) => {
        fixture.portal.features.subscription_cancel.mode = "immediately"
      },
      (fixture) => {
        fixture.portal.features.subscription_cancel.proration_behavior = "create_prorations"
      },
      (fixture) => {
        fixture.portal.features.subscription_cancel.cancellation_reason.enabled = false
      },
      (fixture) => {
        fixture.portal.features.subscription_cancel.cancellation_reason.options = ["other"]
      },
    ]

    for (const corruptPortal of portalCorruptions) {
      const fixture = stripeFixture()
      corruptPortal(fixture)

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
    const processorFailure = new Error("processor secret cus_private_test_account")
    fixture.stripe.products.update = async () => {
      throw processorFailure
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
        assert.equal(error.cause, processorFailure)
        assert.doesNotMatch(
          `${error.message} ${JSON.stringify(error.checks)}`,
          /processor secret|cus_private_test_account/,
        )
        return true
      },
    )
  })

  it("does not retry deterministic Stripe request, authentication, or permission failures", async () => {
    for (const type of [
      "StripeInvalidRequestError",
      "StripeAuthenticationError",
      "StripePermissionError",
      "StripeIdempotencyError",
    ]) {
      const fixture = stripeFixture()
      const statusCode = [
        "StripeInvalidRequestError",
        "StripeIdempotencyError",
      ].includes(type)
        ? 400
        : 401
      const failure = stripeSdkError(type, statusCode)
      const delays = []
      let attempts = 0
      fixture.stripe.products.update = async () => {
        attempts += 1
        throw failure
      }

      await assert.rejects(
        runSupporterMembershipMigration({
          stripe: fixture.stripe,
          mode: "apply",
          env: migrationEnv(),
          sleep: async (milliseconds) => {
            delays.push(milliseconds)
          },
        }),
        (error) => {
          assert.deepEqual(error.failureCodes, ["stripe_mutation_failed"])
          assert.equal(error.cause, failure)
          return true
        },
        type,
      )
      assert.equal(attempts, 1, type)
      assert.deepEqual(delays, [], type)
    }
  })

  it("does not retry a verification error whose retained cause is deterministic", async () => {
    const fixture = stripeFixture()
    const updateProduct = fixture.stripe.products.update.bind(fixture.stripe.products)
    const authenticationFailure = stripeSdkError("StripeAuthenticationError", 401)
    const delays = []
    let retrievals = 0
    fixture.stripe.products.update = async (id, payload) => updateProduct(id, payload)
    fixture.stripe.products.retrieve = async () => {
      retrievals += 1
      throw authenticationFailure
    }

    await assert.rejects(
      runSupporterMembershipMigration({
        stripe: fixture.stripe,
        mode: "apply",
        env: migrationEnv(),
        sleep: async (milliseconds) => {
          delays.push(milliseconds)
        },
      }),
      (error) => {
        assert.deepEqual(
          error.failureCodes,
          ["supporter_product_mutation_unverified"],
        )
        assert.equal(error.cause, authenticationFailure)
        return true
      },
    )
    assert.equal(retrievals, 1)
    assert.deepEqual(delays, [])
  })

  it("retries pinned Stripe rate-limit and server-error shapes", async () => {
    for (const failure of [
      stripeSdkError("StripeRateLimitError", 429),
      stripeSdkError("StripeAPIError", 503),
    ]) {
      const fixture = stripeFixture()
      const updateProduct = fixture.stripe.products.update.bind(fixture.stripe.products)
      const delays = []
      let failOnce = true
      fixture.stripe.products.update = async (id, payload) => {
        if (failOnce) {
          failOnce = false
          throw failure
        }
        return updateProduct(id, payload)
      }

      const result = await runSupporterMembershipMigration({
        stripe: fixture.stripe,
        mode: "apply",
        env: migrationEnv(),
        sleep: async (milliseconds) => {
          delays.push(milliseconds)
        },
      })

      assert.equal(result.state, "COMPLETED")
      assert.deepEqual(delays, [250])
    }
  })

  it("retries a transient post-apply inventory read before replaying mutations", async () => {
    const fixture = stripeFixture()
    const listSubscriptions = fixture.stripe.subscriptions.list.bind(
      fixture.stripe.subscriptions,
    )
    const delays = []
    let listCalls = 0
    fixture.stripe.subscriptions.list = async (payload) => {
      listCalls += 1
      if (listCalls === 2) {
        throw stripeSdkError("StripeConnectionError")
      }
      return listSubscriptions(payload)
    }

    const result = await runSupporterMembershipMigration({
      stripe: fixture.stripe,
      mode: "apply",
      env: migrationEnv(),
      sleep: async (milliseconds) => {
        delays.push(milliseconds)
      },
    })

    assert.equal(result.state, "COMPLETED")
    assert.equal(listCalls, 3)
    assert.deepEqual(delays, [250])
    assert.equal(
      fixture.calls.filter(({ name }) => name === "coupons.del").length,
      2,
      "the successful pre-retry refresh must avoid replaying completed deletes",
    )
  })

  it("does not retry a deterministic post-apply inventory read failure", async () => {
    const fixture = stripeFixture()
    const listSubscriptions = fixture.stripe.subscriptions.list.bind(
      fixture.stripe.subscriptions,
    )
    const failure = stripeSdkError("StripeAuthenticationError", 401)
    const delays = []
    let listCalls = 0
    fixture.stripe.subscriptions.list = async (payload) => {
      listCalls += 1
      if (listCalls === 2) throw failure
      return listSubscriptions(payload)
    }

    await assert.rejects(
      runSupporterMembershipMigration({
        stripe: fixture.stripe,
        mode: "apply",
        env: migrationEnv(),
        sleep: async (milliseconds) => {
          delays.push(milliseconds)
        },
      }),
      (error) => {
        assert.deepEqual(error.failureCodes, ["stripe_dependency_read_failed"])
        assert.equal(error.cause, failure)
        return true
      },
    )
    assert.equal(listCalls, 2)
    assert.deepEqual(delays, [])
  })

  it("preserves the last transient post-apply inventory failure after the retry budget", async () => {
    const fixture = stripeFixture()
    const listSubscriptions = fixture.stripe.subscriptions.list.bind(
      fixture.stripe.subscriptions,
    )
    const failures = [
      stripeSdkError("StripeConnectionError"),
      stripeSdkError("StripeConnectionError"),
      stripeSdkError("StripeConnectionError"),
    ]
    const delays = []
    let listCalls = 0
    fixture.stripe.subscriptions.list = async (payload) => {
      listCalls += 1
      if (listCalls > 1) throw failures[listCalls - 2]
      return listSubscriptions(payload)
    }

    await assert.rejects(
      runSupporterMembershipMigration({
        stripe: fixture.stripe,
        mode: "apply",
        env: migrationEnv(),
        sleep: async (milliseconds) => {
          delays.push(milliseconds)
        },
      }),
      (error) => {
        assert.deepEqual(error.failureCodes, ["stripe_dependency_read_failed"])
        assert.equal(error.cause, failures[2])
        return true
      },
    )
    assert.equal(listCalls, 4)
    assert.deepEqual(delays, [250, 500])
  })

  it("retains a non-missing dependency-read cause without surfacing its details", async () => {
    const fixture = stripeFixture()
    const readFailure = new Error("processor secret coupon_private_reference")
    fixture.stripe.coupons.retrieve = async () => {
      throw readFailure
    }

    await assert.rejects(
      runSupporterMembershipMigration({
        stripe: fixture.stripe,
        mode: "verify",
        env: migrationEnv(),
      }),
      (error) => {
        assert.equal(error instanceof MigrationError, true)
        assert.deepEqual(error.failureCodes, ["stripe_dependency_read_failed"])
        assert.equal(error.cause, readFailure)
        assert.doesNotMatch(
          `${error.message} ${JSON.stringify(error.checks)}`,
          /processor secret|coupon_private_reference/,
        )
        return true
      },
    )
  })

  it("retains a post-mutation retrieval cause without surfacing its details", async () => {
    const fixture = stripeFixture()
    const retrieveFailure = new Error("processor secret product_private_reference")
    fixture.stripe.products.update = async () => (
      structuredClone(fixture.products.get("prod_supporter"))
    )
    fixture.stripe.products.retrieve = async () => {
      throw retrieveFailure
    }

    await assert.rejects(
      runSupporterMembershipMigration({
        stripe: fixture.stripe,
        mode: "apply",
        env: migrationEnv(),
      }),
      (error) => {
        assert.equal(error instanceof MigrationError, true)
        assert.deepEqual(
          error.failureCodes,
          ["supporter_product_mutation_unverified"],
        )
        assert.equal(error.cause, retrieveFailure)
        assert.doesNotMatch(
          `${error.message} ${JSON.stringify(error.checks)}`,
          /processor secret|product_private_reference/,
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
        throw stripeSdkError("StripeConnectionError")
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

  it("discovers an ambiguous committed Product before replaying its create", async () => {
    const fixture = stripeFixture()
    const createProduct = fixture.stripe.products.create.bind(fixture.stripe.products)
    const listProducts = fixture.stripe.products.list.bind(fixture.stripe.products)
    let failAfterCommit = true
    let hiddenProductId = null
    let hideCommittedProductLists = 0
    fixture.stripe.products.create = async (payload, options) => {
      const result = await createProduct(payload, options)
      if (failAfterCommit) {
        failAfterCommit = false
        hiddenProductId = result.id
        hideCommittedProductLists = 1
        throw stripeSdkError("StripeConnectionError")
      }
      return result
    }
    fixture.stripe.products.list = async (params) => {
      const result = await listProducts(params)
      if (hideCommittedProductLists > 0) {
        hideCommittedProductLists -= 1
        return {
          ...result,
          data: result.data.filter((entry) => entry.id !== hiddenProductId),
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
    assert.equal(creates.length, 3)
    assert.deepEqual(
      creates.map(({ options }) => options?.idempotencyKey),
      [
        "massagelab-supporter-membership-v1-product-support-1",
        "massagelab-supporter-membership-v1-product-support-2",
        "massagelab-supporter-membership-v1-product-support-5",
      ],
    )
    assert.equal(
      [...fixture.products.values()].filter(
        (entry) => (
          entry.metadata?.massagelab_catalog === SUPPORTER_MEMBERSHIP_CATALOG_VERSION
        ),
      ).length,
      3,
    )
  })

  it("rejects an archived stamped Product discovered immediately before create", async () => {
    const fixture = stripeFixture()
    const listProducts = fixture.stripe.products.list.bind(fixture.stripe.products)
    let productListCalls = 0
    fixture.stripe.products.list = async (params) => {
      productListCalls += 1
      if (productListCalls === 2) {
        fixture.products.set("prod_archived_support_2", {
          id: "prod_archived_support_2",
          object: "product",
          active: false,
          livemode: false,
          name: "MassageLab Supporter Membership",
          tax_code: "txcd_10000000",
          metadata: {
            app: "massagelab",
            massagelab_catalog: SUPPORTER_MEMBERSHIP_CATALOG_VERSION,
            massagelab_membership_level: "SUPPORTER",
            massagelab_supporter_amount_choice: "support-2",
          },
        })
      }
      return listProducts(params)
    }

    await assert.rejects(
      runSupporterMembershipMigration({
        stripe: fixture.stripe,
        mode: "apply",
        env: migrationEnv(),
      }),
      (error) => {
        assert.deepEqual(error.failureCodes, ["supporter_product_duplicate"])
        return true
      },
    )
    const productLists = fixture.calls.filter(({ name }) => name === "products.list")
    assert.ok(productLists.length >= 2, "expected a second Product inventory pass")
    assert.equal(Object.hasOwn(productLists[1].payload, "active"), false)
    assert.deepEqual(
      mutationCalls(fixture).map(({ name, id }) => ({ name, id })),
      [{ name: "products.update", id: "prod_supporter" }],
    )
    assert.equal(
      fixture.calls.some(({ name }) => name === "products.create"),
      false,
    )
  })

  it("reuses a classified Product with stale display copy discovered before create", async () => {
    const fixture = stripeFixture()
    const listProducts = fixture.stripe.products.list.bind(fixture.stripe.products)
    let productListCalls = 0
    fixture.stripe.products.list = async (params) => {
      productListCalls += 1
      if (productListCalls === 2) {
        fixture.products.set("prod_stale_support_2", {
          id: "prod_stale_support_2",
          object: "product",
          active: true,
          livemode: false,
          name: "MassageLab Supporter Membership",
          description: "Stale support amount copy",
          tax_code: "txcd_10000000",
          metadata: {
            app: "massagelab",
            massagelab_catalog: SUPPORTER_MEMBERSHIP_CATALOG_VERSION,
            massagelab_membership_level: "SUPPORTER",
            massagelab_supporter_amount_choice: "support-2",
          },
        })
      }
      return listProducts(params)
    }

    const result = await runSupporterMembershipMigration({
      stripe: fixture.stripe,
      mode: "apply",
      env: migrationEnv(),
    })

    assert.equal(result.state, "COMPLETED")
    assert.equal(
      fixture.products.get("prod_stale_support_2").description,
      "$2 monthly or $20 annually. Same Supporter Membership benefits; only the support amount differs.",
    )
    assert.equal(
      fixture.calls.some(
        ({ name, payload }) => name === "products.create"
          && payload.metadata?.massagelab_supporter_amount_choice === "support-2",
      ),
      false,
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
        throw stripeSdkError("StripeConnectionError")
      }
      return result
    }
    fixture.stripe.prices.list = async (params) => {
      const result = await listPrices(params)
      if (hideCommittedPriceLists > 0 && params.active === true) {
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
        "massagelab-supporter-membership-v1-price-prod_supporter-support-1-month",
        "massagelab-supporter-membership-v1-price-prod_supporter-support-1-month",
      ],
    )
    assert.equal(
      [...fixture.prices.values()].filter(
        (entry) => (
          entry.metadata?.massagelab_catalog === SUPPORTER_MEMBERSHIP_CATALOG_VERSION
        ),
      ).length,
      6,
    )
  })

  it("uses escalating delays between the three bounded apply attempts", async () => {
    const fixture = stripeFixture()
    const updateProduct = fixture.stripe.products.update.bind(fixture.stripe.products)
    const delays = []
    let transientFailures = 2
    fixture.stripe.products.update = async (id, payload) => {
      if (transientFailures > 0) {
        transientFailures -= 1
        throw stripeSdkError("StripeConnectionError")
      }
      return updateProduct(id, payload)
    }

    const result = await runSupporterMembershipMigration({
      stripe: fixture.stripe,
      mode: "apply",
      env: migrationEnv(),
      sleep: async (milliseconds) => {
        delays.push(milliseconds)
      },
    })

    assert.equal(result.state, "COMPLETED")
    assert.deepEqual(delays, [250, 500])
    assert.equal(
      fixture.calls.filter(
        ({ name, id }) => name === "products.update" && id === "prod_supporter",
      ).length,
      1,
    )
  })
})
