#!/usr/bin/env node

import process from "node:process"
import { pathToFileURL } from "node:url"
import Stripe from "stripe"

const STRIPE_API_VERSION = "2026-02-25.clover"
const EXPECTED_TAX_CODE = "txcd_10000000"
const SUPPORTER_PRODUCT_NAME = "MassageLab Supporter Membership"
const SUPPORTER_CATALOG = "supporter_membership_v1"
const CREATE_NEW_PRODUCT = "CREATE_NEW"
const RELEVANT_SUBSCRIPTION_STATUSES = new Set([
  "active",
  "trialing",
  "past_due",
  "unpaid",
  "paused",
])

const TARGET_PRICE_SPECS = Object.freeze([
  Object.freeze({
    key: "support-1-month",
    envKey: "STRIPE_SUPPORTER_1_MONTHLY_PRICE_ID",
    unitAmount: 100,
    interval: "month",
  }),
  Object.freeze({
    key: "support-1-year",
    envKey: "STRIPE_SUPPORTER_1_YEARLY_PRICE_ID",
    unitAmount: 1000,
    interval: "year",
  }),
  Object.freeze({
    key: "support-2-month",
    envKey: "STRIPE_SUPPORTER_2_MONTHLY_PRICE_ID",
    unitAmount: 200,
    interval: "month",
  }),
  Object.freeze({
    key: "support-2-year",
    envKey: "STRIPE_SUPPORTER_2_YEARLY_PRICE_ID",
    unitAmount: 2000,
    interval: "year",
  }),
  Object.freeze({
    key: "support-5-month",
    envKey: "STRIPE_SUPPORTER_5_MONTHLY_PRICE_ID",
    unitAmount: 500,
    interval: "month",
  }),
  Object.freeze({
    key: "support-5-year",
    envKey: "STRIPE_SUPPORTER_5_YEARLY_PRICE_ID",
    unitAmount: 5000,
    interval: "year",
  }),
])

const LEGACY_PRICE_CONFIG = Object.freeze([
  Object.freeze({
    key: "supporter_month",
    envKey: "MASSAGELAB_STRIPE_MIGRATION_LEGACY_SUPPORTER_MONTHLY_PRICE_ID",
    productKey: "supporter",
    unitAmount: 900,
    interval: "month",
  }),
  Object.freeze({
    key: "supporter_year",
    envKey: "MASSAGELAB_STRIPE_MIGRATION_LEGACY_SUPPORTER_YEARLY_PRICE_ID",
    productKey: "supporter",
    unitAmount: 9000,
    interval: "year",
  }),
  Object.freeze({
    key: "therapist_month",
    envKey: "MASSAGELAB_STRIPE_MIGRATION_THERAPIST_MONTHLY_PRICE_ID",
    productKey: "therapist",
    unitAmount: 2900,
    interval: "month",
  }),
  Object.freeze({
    key: "therapist_year",
    envKey: "MASSAGELAB_STRIPE_MIGRATION_THERAPIST_YEARLY_PRICE_ID",
    productKey: "therapist",
    unitAmount: 27900,
    interval: "year",
  }),
  Object.freeze({
    key: "practice_month",
    envKey: "MASSAGELAB_STRIPE_MIGRATION_PRACTICE_MONTHLY_PRICE_ID",
    productKey: "practice",
    unitAmount: 7900,
    interval: "month",
  }),
  Object.freeze({
    key: "practice_year",
    envKey: "MASSAGELAB_STRIPE_MIGRATION_PRACTICE_YEARLY_PRICE_ID",
    productKey: "practice",
    unitAmount: 75900,
    interval: "year",
  }),
])

const COUPON_SPECS = Object.freeze([
  Object.freeze({
    key: "student",
    envKey: "MASSAGELAB_STRIPE_MIGRATION_STUDENT_COUPON_ID",
    name: "Student to Therapist 20% Discount",
    percentOff: 20,
    duration: "forever",
  }),
  Object.freeze({
    key: "early_access",
    envKey: "MASSAGELAB_STRIPE_MIGRATION_EARLY_ACCESS_COUPON_ID",
    name: "Early Access 10% Discount",
    percentOff: 10,
    duration: "forever",
  }),
])

export class MigrationError extends Error {
  constructor(failureCodes, checks = []) {
    super(`Stripe Supporter membership migration failed (${failureCodes.length} checks).`)
    this.name = "MigrationError"
    this.failureCodes = [...new Set(failureCodes)]
    this.checks = checks
  }
}

function envValue(env, key) {
  return String(env[key] ?? "").trim()
}

function expectedLivemode(mode) {
  return mode === "live"
}

function keyMode(secretKey) {
  if (secretKey.startsWith("sk_live_")) return "live"
  if (secretKey.startsWith("sk_test_")) return "test"
  return null
}

/**
 * Parses only explicit migration inputs. Existing Stripe object identifiers
 * stay operator-supplied so the command never guesses a production dependency.
 */
function buildConfig(env, requestedMode) {
  const failureCodes = []
  if (!["verify", "apply"].includes(requestedMode)) {
    failureCodes.push("migration_mode_required")
  }

  const stripeMode = envValue(env, "MASSAGELAB_STRIPE_MIGRATION_MODE")
  if (!["test", "live"].includes(stripeMode)) {
    failureCodes.push("expected_stripe_mode_required")
  }

  const secretKey = envValue(env, "STRIPE_SECRET_KEY")
  if (keyMode(secretKey) !== stripeMode) {
    failureCodes.push("secret_key_mode_mismatch")
  }

  const productIds = {
    supporter: envValue(env, "MASSAGELAB_STRIPE_MIGRATION_SUPPORTER_PRODUCT_ID"),
    therapist: envValue(env, "MASSAGELAB_STRIPE_MIGRATION_THERAPIST_PRODUCT_ID"),
    practice: envValue(env, "MASSAGELAB_STRIPE_MIGRATION_PRACTICE_PRODUCT_ID"),
  }
  if (!productIds.supporter || !productIds.therapist || !productIds.practice) {
    failureCodes.push("migration_product_ids_required")
  }

  const legacyPrices = LEGACY_PRICE_CONFIG.map((spec) => ({
    ...spec,
    id: envValue(env, spec.envKey),
  }))
  if (legacyPrices.some((spec) => !spec.id)) {
    failureCodes.push("migration_legacy_price_ids_required")
  }

  const coupons = COUPON_SPECS.map((spec) => ({
    ...spec,
    id: envValue(env, spec.envKey),
  }))
  if (coupons.some((spec) => !spec.id)) {
    failureCodes.push("migration_coupon_ids_required")
  }

  const portalConfigurationId = envValue(
    env,
    "MASSAGELAB_STRIPE_MIGRATION_PORTAL_CONFIGURATION_ID",
  )
  if (!portalConfigurationId) {
    failureCodes.push("migration_portal_configuration_id_required")
  }

  const allowedSubscriptionId = envValue(
    env,
    "MASSAGELAB_STRIPE_MIGRATION_ALLOWED_SUBSCRIPTION_ID",
  )
  if (!allowedSubscriptionId) {
    failureCodes.push("migration_subscription_inventory_required")
  }

  const targetPrices = TARGET_PRICE_SPECS.map((spec) => ({
    ...spec,
    configuredId: envValue(env, spec.envKey),
  }))

  if (failureCodes.length > 0) {
    throw new MigrationError(failureCodes)
  }

  return {
    requestedMode,
    stripeMode,
    livemode: expectedLivemode(stripeMode),
    secretKey,
    allowedSubscriptionId,
    productIds,
    legacyPrices,
    coupons,
    portalConfigurationId,
    targetPrices,
  }
}

async function listAll(listResultPromise) {
  if (typeof listResultPromise?.autoPagingToArray === "function") {
    return listResultPromise.autoPagingToArray({ limit: 10_000 })
  }
  const result = await listResultPromise
  if (typeof result?.autoPagingToArray === "function") {
    return result.autoPagingToArray({ limit: 10_000 })
  }
  return Array.isArray(result?.data) ? result.data : []
}

async function retrieveOrMissing(retrieve, id) {
  try {
    return { object: await retrieve(id), missing: false }
  } catch (error) {
    if (error?.code === "resource_missing") {
      return { object: null, missing: true }
    }
    throw new MigrationError(["stripe_dependency_read_failed"])
  }
}

function modeMatches(object, livemode) {
  return object?.livemode === livemode
}

function priceProductId(candidate) {
  return typeof candidate?.product === "string" ? candidate.product : candidate?.product?.id
}

function priceMatches(candidate, spec, productId) {
  return Boolean(candidate)
    && candidate.unit_amount === spec.unitAmount
    && candidate.currency === "usd"
    && candidate.recurring?.interval === spec.interval
    && (candidate.recurring?.interval_count ?? 1) === 1
    && candidate.tax_behavior === "exclusive"
    && priceProductId(candidate) === productId
}

function legacyPriceMatches(candidate, spec, productId) {
  return Boolean(candidate)
    && candidate.unit_amount === spec.unitAmount
    && candidate.currency === "usd"
    && candidate.recurring?.interval === spec.interval
    && (candidate.recurring?.interval_count ?? 1) === 1
    && priceProductId(candidate) === productId
}

function couponMatches(candidate, spec, livemode) {
  return Boolean(candidate)
    && modeMatches(candidate, livemode)
    && candidate.name === spec.name
    && candidate.percent_off === spec.percentOff
    && candidate.duration === spec.duration
    && candidate.times_redeemed === 0
}

function hasExactly(values, expected) {
  return Array.isArray(values)
    && values.length === expected.length
    && expected.every((value) => values.includes(value))
}

function portalPreservationEnabled(features) {
  return features?.customer_update?.enabled === true
    && hasExactly(features.customer_update.allowed_updates, ["address", "email", "name"])
    && features?.invoice_history?.enabled === true
    && features?.payment_method_update?.enabled === true
    && features?.subscription_cancel?.enabled === true
    && features?.subscription_update?.enabled === true
    && hasExactly(features.subscription_update.default_allowed_updates, ["price"])
}

function portalProductsAreKnown(features, allowedProductIds, allowedPriceIds) {
  const products = features?.subscription_update?.products
  return Array.isArray(products)
    && products.every((entry) => (
      allowedProductIds.has(entry.product)
      && Array.isArray(entry.prices)
      && entry.prices.every((id) => allowedPriceIds.has(id))
    ))
}

function managedPriceKey(candidate) {
  return candidate?.metadata?.massagelab_supporter_price_key || candidate?.lookup_key || ""
}

function lookupKeyFor(spec) {
  return `massagelab_${spec.key.replaceAll("-", "_")}`
}

function findTargetCandidate({ allPrices, configuredId, spec, productId }) {
  if (configuredId) {
    return allPrices.find((candidate) => candidate.id === configuredId) ?? null
  }

  const managed = allPrices.filter((candidate) => (
    candidate.metadata?.massagelab_catalog === SUPPORTER_CATALOG
    && (
      managedPriceKey(candidate) === spec.key
      || candidate.lookup_key === lookupKeyFor(spec)
    )
  ))
  if (managed.length === 1) return managed[0]
  if (managed.length > 1) return { duplicate: true }

  const exact = allPrices.filter((candidate) => priceMatches(candidate, spec, productId))
  if (exact.length === 1) return exact[0]
  if (exact.length > 1) return { duplicate: true }
  return null
}

function check(code, ok) {
  return Object.freeze({ code, status: ok ? "PASS" : "FAIL" })
}

/**
 * Reads and validates every dependency before apply is allowed to mutate one
 * Stripe object. The returned plan contains IDs for execution but checklist
 * formatting deliberately exposes codes only.
 */
async function collectInventory(stripe, config) {
  const failureCodes = []

  let balance
  let subscriptions
  let allProducts
  let allPrices
  let portal
  try {
    [balance, subscriptions, allProducts, allPrices, portal] = await Promise.all([
      stripe.balance.retrieve(),
      listAll(stripe.subscriptions.list({ status: "all", limit: 100 })),
      listAll(stripe.products.list({ limit: 100 })),
      listAll(stripe.prices.list({ limit: 100 })),
      stripe.billingPortal.configurations.retrieve(config.portalConfigurationId),
    ])
  } catch (error) {
    if (error instanceof MigrationError) throw error
    throw new MigrationError(["stripe_dependency_read_failed"])
  }

  if (!modeMatches(balance, config.livemode)) {
    failureCodes.push("stripe_account_mode_mismatch")
  }

  const relevantSubscriptions = subscriptions.filter((subscription) => (
    RELEVANT_SUBSCRIPTION_STATUSES.has(String(subscription.status ?? "").toLowerCase())
    || subscription.cancel_at_period_end === true
  ))
  const expectedNoSubscriptions = config.allowedSubscriptionId.toLowerCase() === "none"
  const subscriptionsMatch = expectedNoSubscriptions
    ? relevantSubscriptions.length === 0
    : relevantSubscriptions.length === 1
      && relevantSubscriptions[0].id === config.allowedSubscriptionId
  if (
    !subscriptionsMatch
    || relevantSubscriptions.some((subscription) => !modeMatches(subscription, config.livemode))
  ) {
    failureCodes.push("unexpected_subscription_inventory")
  }

  const products = {}
  for (const [key, id] of Object.entries(config.productIds)) {
    if (key === "supporter" && id === CREATE_NEW_PRODUCT) continue
    const candidate = allProducts.find((entry) => entry.id === id)
    if (!candidate || !modeMatches(candidate, config.livemode)) {
      failureCodes.push("product_dependency_mismatch")
    } else {
      products[key] = candidate
    }
  }

  const targetProductCandidates = allProducts.filter((candidate) => (
    candidate.name === SUPPORTER_PRODUCT_NAME
    || candidate.metadata?.massagelab_catalog === SUPPORTER_CATALOG
  ))
  if (targetProductCandidates.length > 1) {
    failureCodes.push("supporter_product_duplicate")
  } else if (config.productIds.supporter === CREATE_NEW_PRODUCT) {
    products.supporter = targetProductCandidates[0] ?? null
  } else if (
    targetProductCandidates.length === 1
    && targetProductCandidates[0].id !== products.supporter?.id
  ) {
    failureCodes.push("supporter_product_duplicate")
  }

  if (
    products.supporter
    && (
      products.supporter.tax_code !== EXPECTED_TAX_CODE
      || products.supporter.active !== true
      || !["MassageLab Supporter", SUPPORTER_PRODUCT_NAME].includes(products.supporter.name)
    )
  ) {
    failureCodes.push("supporter_product_dependency_mismatch")
  }

  const targetProductId = products.supporter?.id ?? null
  const legacyPrices = new Map()
  let legacySupporterProductId = config.productIds.supporter === CREATE_NEW_PRODUCT
    ? null
    : config.productIds.supporter
  for (const spec of config.legacyPrices) {
    const candidate = allPrices.find((entry) => entry.id === spec.id)
    if (
      spec.productKey === "supporter"
      && config.productIds.supporter === CREATE_NEW_PRODUCT
      && candidate
      && !legacySupporterProductId
    ) {
      legacySupporterProductId = priceProductId(candidate)
    }
    const expectedProductId = spec.productKey === "supporter"
      ? legacySupporterProductId
      : config.productIds[spec.productKey]
    if (
      !candidate
      || !modeMatches(candidate, config.livemode)
      || !legacyPriceMatches(candidate, spec, expectedProductId)
    ) {
      failureCodes.push("legacy_price_dependency_mismatch")
    } else {
      legacyPrices.set(spec.key, candidate)
    }
  }
  const legacySupporterProduct = allProducts.find(
    (candidate) => candidate.id === legacySupporterProductId,
  )
  if (
    !legacySupporterProduct
    || !modeMatches(legacySupporterProduct, config.livemode)
    || legacySupporterProductId === config.productIds.therapist
    || legacySupporterProductId === config.productIds.practice
  ) {
    failureCodes.push("product_dependency_mismatch")
  }

  const targetPrices = new Map()
  if (targetProductId) {
    for (const spec of config.targetPrices) {
      const candidate = findTargetCandidate({
        allPrices,
        configuredId: spec.configuredId,
        spec,
        productId: targetProductId,
      })
      if (candidate?.duplicate || (candidate && !priceMatches(candidate, spec, targetProductId))) {
        failureCodes.push("approved_price_dependency_mismatch")
      } else if (candidate) {
        if (!modeMatches(candidate, config.livemode)) {
          failureCodes.push("approved_price_dependency_mismatch")
        } else {
          targetPrices.set(spec.key, candidate)
        }
      } else if (spec.configuredId) {
        failureCodes.push("approved_price_dependency_mismatch")
      }
    }
  } else if (config.targetPrices.some((spec) => spec.configuredId)) {
    failureCodes.push("approved_price_dependency_mismatch")
  }

  const coupons = new Map()
  for (const spec of config.coupons) {
    const result = await retrieveOrMissing(stripe.coupons.retrieve.bind(stripe.coupons), spec.id)
    if (result.missing) {
      coupons.set(spec.key, null)
    } else if (!couponMatches(result.object, spec, config.livemode)) {
      failureCodes.push("coupon_dependency_mismatch")
    } else {
      coupons.set(spec.key, result.object)
    }
  }

  const knownProductIds = new Set([
    ...Object.values(config.productIds).filter((id) => id !== CREATE_NEW_PRODUCT),
    legacySupporterProductId,
    targetProductId,
  ].filter(Boolean))
  const knownPriceIds = new Set([
    ...config.legacyPrices.map((spec) => spec.id),
    ...[...targetPrices.values()].map((candidate) => candidate.id),
  ])
  if (
    !portal
    || !modeMatches(portal, config.livemode)
    || portal.active !== true
    || !portalPreservationEnabled(portal.features)
    || !portalProductsAreKnown(portal.features, knownProductIds, knownPriceIds)
  ) {
    failureCodes.push("portal_dependency_mismatch")
  }

  const checks = [
    check(
      "mode_and_account",
      !failureCodes.includes("stripe_account_mode_mismatch"),
    ),
    check(
      "subscriber_inventory",
      !failureCodes.includes("unexpected_subscription_inventory"),
    ),
    check(
      "catalog_dependencies",
      !failureCodes.some((code) => (
        code.includes("product")
        || code.includes("price")
      )),
    ),
    check(
      "coupon_dependencies",
      !failureCodes.includes("coupon_dependency_mismatch"),
    ),
    check(
      "portal_dependencies",
      !failureCodes.includes("portal_dependency_mismatch"),
    ),
  ]

  if (failureCodes.length > 0) {
    throw new MigrationError(failureCodes, checks)
  }

  return {
    checks,
    products,
    legacyPrices,
    targetPrices,
    coupons,
    portal,
  }
}

function targetProductPayload(current) {
  return {
    name: SUPPORTER_PRODUCT_NAME,
    active: true,
    tax_code: EXPECTED_TAX_CODE,
    metadata: {
      ...(current?.metadata ?? {}),
      app: "massagelab",
      massagelab_catalog: SUPPORTER_CATALOG,
      massagelab_membership_level: "SUPPORTER",
    },
  }
}

function targetPriceMetadata(spec, current = {}) {
  return {
    ...(current.metadata ?? {}),
    app: "massagelab",
    massagelab_catalog: SUPPORTER_CATALOG,
    massagelab_membership_level: "SUPPORTER",
    massagelab_supporter_price_key: spec.key,
  }
}

function targetPricePayload(productId, spec) {
  return {
    product: productId,
    unit_amount: spec.unitAmount,
    currency: "usd",
    recurring: { interval: spec.interval, interval_count: 1 },
    tax_behavior: "exclusive",
    lookup_key: lookupKeyFor(spec),
    metadata: targetPriceMetadata(spec),
  }
}

function sameMetadata(actual, expected) {
  return Object.entries(expected).every(([key, value]) => actual?.[key] === value)
}

function needsProductUpdate(current, payload) {
  return current.name !== payload.name
    || current.active !== payload.active
    || current.tax_code !== payload.tax_code
    || !sameMetadata(current.metadata, payload.metadata)
}

function needsPriceUpdate(current, spec) {
  return current.active !== true
    || current.lookup_key !== lookupKeyFor(spec)
    || !sameMetadata(current.metadata, targetPriceMetadata(spec, current))
}

function desiredPortalFeatures(currentFeatures, productId, priceIds) {
  return {
    customer_update: {
      ...currentFeatures.customer_update,
      enabled: true,
      allowed_updates: ["address", "email", "name"],
    },
    invoice_history: {
      ...currentFeatures.invoice_history,
      enabled: true,
    },
    payment_method_update: {
      ...currentFeatures.payment_method_update,
      enabled: true,
    },
    subscription_cancel: {
      ...currentFeatures.subscription_cancel,
      enabled: true,
    },
    subscription_update: {
      ...currentFeatures.subscription_update,
      enabled: true,
      default_allowed_updates: ["price"],
      products: [{ product: productId, prices: priceIds }],
    },
  }
}

function jsonEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right)
}

async function retrieveAfterMutation(retrieve, id, validate, failureCode) {
  let retrieved
  try {
    retrieved = await retrieve(id)
  } catch {
    throw new MigrationError([failureCode])
  }
  if (!validate(retrieved)) {
    throw new MigrationError([failureCode])
  }
  return retrieved
}

/**
 * Applies a fully preflighted plan. Mutations are ordered target-first, portal
 * second, then legacy retirement; each write is immediately re-read.
 */
async function applyPlan(stripe, config, inventory) {
  let supporter = inventory.products.supporter
  const productPayload = targetProductPayload(supporter)

  if (!supporter) {
    const created = await stripe.products.create(productPayload)
    supporter = await retrieveAfterMutation(
      stripe.products.retrieve.bind(stripe.products),
      created.id,
      (candidate) => candidate.name === SUPPORTER_PRODUCT_NAME
        && candidate.active === true
        && candidate.tax_code === EXPECTED_TAX_CODE
        && sameMetadata(candidate.metadata, productPayload.metadata),
      "supporter_product_mutation_unverified",
    )
  } else if (needsProductUpdate(supporter, productPayload)) {
    await stripe.products.update(supporter.id, productPayload)
    supporter = await retrieveAfterMutation(
      stripe.products.retrieve.bind(stripe.products),
      supporter.id,
      (candidate) => candidate.name === SUPPORTER_PRODUCT_NAME
        && candidate.active === true
        && candidate.tax_code === EXPECTED_TAX_CODE
        && sameMetadata(candidate.metadata, productPayload.metadata),
      "supporter_product_mutation_unverified",
    )
  }

  const targetPrices = []
  for (const spec of config.targetPrices) {
    let candidate = inventory.targetPrices.get(spec.key)
    if (!candidate) {
      const created = await stripe.prices.create(targetPricePayload(supporter.id, spec))
      candidate = await retrieveAfterMutation(
        stripe.prices.retrieve.bind(stripe.prices),
        created.id,
        (retrieved) => priceMatches(retrieved, spec, supporter.id)
          && retrieved.active === true
          && sameMetadata(retrieved.metadata, targetPriceMetadata(spec)),
        "supporter_price_mutation_unverified",
      )
    } else if (needsPriceUpdate(candidate, spec)) {
      await stripe.prices.update(candidate.id, {
        active: true,
        lookup_key: lookupKeyFor(spec),
        metadata: targetPriceMetadata(spec, candidate),
      })
      candidate = await retrieveAfterMutation(
        stripe.prices.retrieve.bind(stripe.prices),
        candidate.id,
        (retrieved) => priceMatches(retrieved, spec, supporter.id)
          && retrieved.active === true
          && retrieved.lookup_key === lookupKeyFor(spec)
          && sameMetadata(retrieved.metadata, targetPriceMetadata(spec)),
        "supporter_price_mutation_unverified",
      )
    }
    targetPrices.push(candidate)
  }

  const desiredFeatures = desiredPortalFeatures(
    inventory.portal.features,
    supporter.id,
    targetPrices.map((candidate) => candidate.id),
  )
  if (!jsonEqual(inventory.portal.features, desiredFeatures)) {
    await stripe.billingPortal.configurations.update(config.portalConfigurationId, {
      features: desiredFeatures,
    })
    await retrieveAfterMutation(
      stripe.billingPortal.configurations.retrieve.bind(
        stripe.billingPortal.configurations,
      ),
      config.portalConfigurationId,
      (candidate) => jsonEqual(candidate.features, desiredFeatures),
      "portal_mutation_unverified",
    )
  }

  for (const spec of config.legacyPrices) {
    const candidate = inventory.legacyPrices.get(spec.key)
    if (candidate.active === false) continue
    await stripe.prices.update(candidate.id, { active: false })
    await retrieveAfterMutation(
      stripe.prices.retrieve.bind(stripe.prices),
      candidate.id,
      (retrieved) => retrieved.active === false,
      "legacy_price_mutation_unverified",
    )
  }

  for (const key of ["therapist", "practice"]) {
    const candidate = inventory.products[key]
    if (candidate.active === false) continue
    await stripe.products.update(candidate.id, { active: false })
    await retrieveAfterMutation(
      stripe.products.retrieve.bind(stripe.products),
      candidate.id,
      (retrieved) => retrieved.active === false,
      "legacy_product_mutation_unverified",
    )
  }

  for (const spec of config.coupons) {
    if (!inventory.coupons.get(spec.key)) continue
    const deleted = await stripe.coupons.del(spec.id)
    if (deleted?.deleted !== true) {
      throw new MigrationError(["coupon_mutation_unverified"])
    }
    const reread = await retrieveOrMissing(
      stripe.coupons.retrieve.bind(stripe.coupons),
      spec.id,
    )
    if (!reread.missing) {
      throw new MigrationError(["coupon_mutation_unverified"])
    }
  }
}

/**
 * Verifies or applies the Supporter catalog migration without exposing object
 * identifiers in its reader-facing checklist.
 */
export async function runSupporterMembershipMigration({
  stripe,
  mode,
  env = process.env,
} = {}) {
  const config = buildConfig(env, mode)
  const inventory = await collectInventory(stripe, config)
  if (mode === "apply") {
    try {
      await applyPlan(stripe, config, inventory)
    } catch (error) {
      if (error instanceof MigrationError) throw error
      throw new MigrationError(["stripe_mutation_failed"])
    }
    await collectInventory(stripe, config)
  }

  return {
    ok: true,
    mode,
    checks: [
      ...inventory.checks,
      check(mode === "apply" ? "apply_retrievals" : "verify_get_only", true),
    ],
  }
}

export function formatMigrationChecklist(result) {
  return result.checks
    .map(({ status, code }) => `${status} ${code}`)
    .join("\n")
}

function argumentValue(name) {
  const prefix = `${name}=`
  return process.argv.slice(2).find((argument) => argument.startsWith(prefix))?.slice(prefix.length) ?? ""
}

async function main() {
  const mode = argumentValue("--mode")
  const secretKey = envValue(process.env, "STRIPE_SECRET_KEY")
  try {
    buildConfig(process.env, mode)
    const stripe = new Stripe(secretKey, { apiVersion: STRIPE_API_VERSION })
    const result = await runSupporterMembershipMigration({
      stripe,
      mode,
      env: process.env,
    })
    console.log(formatMigrationChecklist(result))
  } catch (error) {
    const migrationError = error instanceof MigrationError
      ? error
      : new MigrationError(["unexpected_migration_failure"])
    for (const code of migrationError.failureCodes) {
      console.error(`FAIL ${code}`)
    }
    process.exitCode = 1
  }
}

if (
  process.argv[1]
  && import.meta.url === pathToFileURL(process.argv[1]).href
) {
  await main()
}
