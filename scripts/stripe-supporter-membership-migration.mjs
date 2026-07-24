#!/usr/bin/env node

import process from "node:process"
import { pathToFileURL } from "node:url"
import Stripe from "stripe"
import { recurringPriceSemanticsMatch } from "../lib/stripe-price-contract.js"

const STRIPE_API_VERSION = "2026-02-25.clover"
const EXPECTED_TAX_CODE = "txcd_10000000"
const SUPPORTER_PRODUCT_NAME = "MassageLab Supporter Membership"
const SUPPORTER_CATALOG = "supporter_membership_v1"
const CREATE_NEW_PRODUCT = "CREATE_NEW"
const SUPPORTER_PRODUCT_IDEMPOTENCY_KEY = "massagelab-supporter-membership-v1-product"
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

async function listAll(listPage, params) {
  const rows = []
  const seenCursors = new Set()
  let startingAfter = null

  while (true) {
    const page = await listPage({
      ...params,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    })
    if (!Array.isArray(page?.data)) {
      throw new MigrationError(["stripe_pagination_incomplete"])
    }
    rows.push(...page.data)
    if (page.has_more === false) {
      return rows
    }
    if (page.has_more !== true) {
      throw new MigrationError(["stripe_pagination_incomplete"])
    }

    const nextCursor = page.data.at(-1)?.id
    if (!nextCursor || seenCursors.has(nextCursor)) {
      throw new MigrationError(["stripe_pagination_incomplete"])
    }
    seenCursors.add(nextCursor)
    startingAfter = nextCursor
  }
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
    && recurringPriceSemanticsMatch(candidate, {
      unitAmount: spec.unitAmount,
      interval: spec.interval,
      taxBehavior: "exclusive",
    })
    && priceProductId(candidate) === productId
}

function legacyPriceMatches(candidate, spec, productId) {
  return Boolean(candidate)
    && recurringPriceSemanticsMatch(candidate, {
      unitAmount: spec.unitAmount,
      interval: spec.interval,
    })
    && priceProductId(candidate) === productId
}

function targetSupporterProductMatches(candidate) {
  return Boolean(candidate)
    && candidate.name === SUPPORTER_PRODUCT_NAME
    && candidate.active === true
    && candidate.tax_code === EXPECTED_TAX_CODE
    && candidate.metadata?.app === "massagelab"
    && candidate.metadata?.massagelab_catalog === SUPPORTER_CATALOG
    && candidate.metadata?.massagelab_membership_level === "SUPPORTER"
}

/**
 * Identifies the normal Product made by the retired live setup command. Reuse
 * mode may classify this exact object, but does not accept an arbitrary
 * partially managed Product as a safe dependency.
 */
function legacySupporterProductMatches(candidate) {
  return Boolean(candidate)
    && candidate.name === "MassageLab Supporter"
    && candidate.tax_code == null
    && candidate.metadata?.app === "massagelab"
    && candidate.metadata?.massagelab_membership_level === "SUPPORTER"
    && candidate.metadata?.massagelab_catalog == null
}

/**
 * Validates retirement dependencies without requiring metadata that the
 * retired setup command only added opportunistically to pre-existing Products.
 * Any metadata that is present must still identify the expected MassageLab
 * application and legacy membership level.
 */
function legacyRetirementProductMatches(candidate, { name, membershipLevel }) {
  const app = candidate?.metadata?.app
  const recordedLevel = candidate?.metadata?.massagelab_membership_level

  return Boolean(candidate)
    && candidate.name === name
    && (!app || app === "massagelab")
    && (!recordedLevel || recordedLevel === membershipLevel)
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

function stripeObjectId(value) {
  return typeof value === "string" ? value : value?.id
}

function normalizePortalProducts(products) {
  if (!Array.isArray(products)) return []
  return products
    .map((entry) => ({
      product: stripeObjectId(entry.product) ?? "",
      prices: Array.isArray(entry.prices)
        ? entry.prices.map(stripeObjectId).filter(Boolean).sort()
        : [],
      adjustableQuantityEnabled: entry.adjustable_quantity?.enabled === true,
    }))
    .sort((left, right) => left.product.localeCompare(right.product))
}

function normalizePortalFeatures(features) {
  return {
    customerUpdate: {
      enabled: features?.customer_update?.enabled === true,
      allowedUpdates: [...(features?.customer_update?.allowed_updates ?? [])].sort(),
    },
    invoiceHistoryEnabled: features?.invoice_history?.enabled === true,
    paymentMethodUpdateEnabled: features?.payment_method_update?.enabled === true,
    subscriptionCancel: {
      enabled: features?.subscription_cancel?.enabled === true,
      mode: features?.subscription_cancel?.mode ?? null,
      prorationBehavior: features?.subscription_cancel?.proration_behavior ?? null,
      cancellationReason: {
        enabled: features?.subscription_cancel?.cancellation_reason?.enabled === true,
        options: [
          ...(features?.subscription_cancel?.cancellation_reason?.options ?? []),
        ].sort(),
      },
    },
    subscriptionUpdate: {
      enabled: features?.subscription_update?.enabled === true,
      defaultAllowedUpdates: [
        ...(features?.subscription_update?.default_allowed_updates ?? []),
      ].sort(),
      billingCycleAnchor: features?.subscription_update?.billing_cycle_anchor ?? null,
      prorationBehavior: features?.subscription_update?.proration_behavior ?? null,
      scheduleAtPeriodEndConditions: [
        ...(features?.subscription_update?.schedule_at_period_end?.conditions ?? []),
      ]
        .map((condition) => condition.type)
        .sort(),
      trialUpdateBehavior: features?.subscription_update?.trial_update_behavior ?? null,
      products: normalizePortalProducts(features?.subscription_update?.products),
    },
  }
}

function portalPreservationEnabled(features) {
  const normalized = normalizePortalFeatures(features)
  return normalized.customerUpdate.enabled
    && hasExactly(normalized.customerUpdate.allowedUpdates, ["address", "email", "name"])
    && normalized.invoiceHistoryEnabled
    && normalized.paymentMethodUpdateEnabled
    && normalized.subscriptionCancel.enabled
    && normalized.subscriptionUpdate.enabled
    && hasExactly(normalized.subscriptionUpdate.defaultAllowedUpdates, ["price"])
}

function expectedPortalProducts(entries) {
  return entries
    .map(({ product, prices }) => ({
      product,
      prices: [...prices].sort(),
      adjustableQuantityEnabled: false,
    }))
    .sort((left, right) => left.product.localeCompare(right.product))
}

function portalTopologyMatches(features, expectedProducts) {
  return jsonEqual(
    normalizePortalFeatures(features).subscriptionUpdate.products,
    expectedPortalProducts(expectedProducts),
  )
}

function managedPriceKey(candidate) {
  return candidate?.metadata?.massagelab_supporter_price_key || candidate?.lookup_key || ""
}

function lookupKeyFor(spec) {
  return `massagelab_${spec.key.replaceAll("-", "_")}`
}

function targetPriceIdempotencyKey(spec) {
  return `massagelab-supporter-membership-v1-price-${spec.key}`
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
async function collectInventory(stripe, config, { allowTransitional = false } = {}) {
  const failureCodes = []

  let balance
  let subscriptions
  let allProducts
  let allPrices
  let portal
  try {
    [balance, subscriptions, allProducts, allPrices, portal] = await Promise.all([
      stripe.balance.retrieve(),
      listAll(stripe.subscriptions.list.bind(stripe.subscriptions), {
        status: "all",
        limit: 100,
      }),
      listAll(stripe.products.list.bind(stripe.products), { limit: 100 }),
      listAll(stripe.prices.list.bind(stripe.prices), {
        limit: 100,
        expand: ["data.currency_options"],
      }),
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
  if (
    products.therapist
    && !legacyRetirementProductMatches(products.therapist, {
      name: "MassageLab Therapist",
      membershipLevel: "THERAPIST",
    })
  ) {
    failureCodes.push("product_dependency_mismatch")
  }
  if (
    products.practice
    && !legacyRetirementProductMatches(products.practice, {
      name: "MassageLab Practice",
      membershipLevel: "PRACTICE",
    })
  ) {
    failureCodes.push("product_dependency_mismatch")
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

  const targetProductCompleted = targetSupporterProductMatches(products.supporter)
  const reusableLegacyProduct = legacySupporterProductMatches(products.supporter)
    && products.supporter.active === true
  if (products.supporter && !targetProductCompleted && !reusableLegacyProduct) {
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
    || (
      legacySupporterProductId !== targetProductId
      && !legacySupporterProductMatches(legacySupporterProduct)
    )
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

  const managedProductIds = new Set([
    targetProductId,
    legacySupporterProductId,
    config.productIds.therapist,
    config.productIds.practice,
  ].filter(Boolean))
  const retirementPricesById = new Map(
    [...legacyPrices.values()].map((candidate) => [candidate.id, candidate]),
  )
  const targetPriceIds = new Set(
    [...targetPrices.values()].map((candidate) => candidate.id),
  )
  const expectedProductId = (spec) => (
    spec.productKey === "supporter"
      ? legacySupporterProductId
      : config.productIds[spec.productKey]
  )

  for (const candidate of allPrices) {
    const ownerId = priceProductId(candidate)
    if (!managedProductIds.has(ownerId)) continue
    if (!modeMatches(candidate, config.livemode)) {
      failureCodes.push("unexpected_managed_price")
      continue
    }
    if (retirementPricesById.has(candidate.id) || targetPriceIds.has(candidate.id)) {
      continue
    }

    const duplicateLegacy = config.legacyPrices.some((spec) => (
      legacyPriceMatches(candidate, spec, expectedProductId(spec))
    ))
    if (duplicateLegacy) {
      retirementPricesById.set(candidate.id, candidate)
      continue
    }

    const duplicateTargetSpec = targetProductId
      ? config.targetPrices.find((spec) => priceMatches(candidate, spec, targetProductId))
      : null
    const selectedTarget = duplicateTargetSpec
      ? targetPrices.get(duplicateTargetSpec.key)
      : null
    if (
      duplicateTargetSpec
      && selectedTarget
      && duplicateTargetSpec.configuredId
      && selectedTarget.id !== candidate.id
    ) {
      retirementPricesById.set(candidate.id, candidate)
      continue
    }

    failureCodes.push("unexpected_managed_price")
  }
  const retirementPrices = [...retirementPricesById.values()]

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

  const retirementProducts = [
    products.therapist,
    products.practice,
    ...(legacySupporterProduct?.id !== targetProductId ? [legacySupporterProduct] : []),
  ].filter(Boolean)
  const prePortalProducts = [
    {
      product: legacySupporterProductId,
      prices: config.legacyPrices
        .filter((spec) => spec.productKey === "supporter")
        .map((spec) => spec.id),
    },
    {
      product: config.productIds.therapist,
      prices: config.legacyPrices
        .filter((spec) => spec.productKey === "therapist")
        .map((spec) => spec.id),
    },
    {
      product: config.productIds.practice,
      prices: config.legacyPrices
        .filter((spec) => spec.productKey === "practice")
        .map((spec) => spec.id),
    },
  ]
  const completedPortalProducts = targetProductId && targetPrices.size === config.targetPrices.length
    ? [{
        product: targetProductId,
        prices: config.targetPrices.map((spec) => targetPrices.get(spec.key).id),
      }]
    : []
  const portalBaseValid = Boolean(portal)
    && modeMatches(portal, config.livemode)
    && portal.active === true
    && portalPreservationEnabled(portal.features)
  const portalIsPreMigration = portalBaseValid
    && portalTopologyMatches(portal.features, prePortalProducts)
  const portalIsCompleted = portalBaseValid
    && completedPortalProducts.length === 1
    && portalTopologyMatches(portal.features, completedPortalProducts)
  if (
    !portal
    || !portalBaseValid
    || (!portalIsPreMigration && !portalIsCompleted)
  ) {
    failureCodes.push("portal_dependency_mismatch")
  }

  const targetPricesAreActive = [...targetPrices.values()].every(
    (candidate) => candidate.active === true,
  )
  const couponsPresent = [...coupons.values()].every(Boolean)
  const couponsMissing = [...coupons.values()].every((candidate) => candidate === null)
  const retirementPricesActive = retirementPrices.every(
    (candidate) => candidate.active === true,
  )
  const retirementPricesInactive = retirementPrices.every(
    (candidate) => candidate.active === false,
  )
  const retirementProductsActive = retirementProducts.every(
    (candidate) => candidate.active === true,
  )
  const retirementProductsInactive = retirementProducts.every(
    (candidate) => candidate.active === false,
  )
  const supporterProductAllowsPreMigration = config.productIds.supporter === CREATE_NEW_PRODUCT
    ? !products.supporter || targetProductCompleted
    : reusableLegacyProduct || targetProductCompleted
  const isPreMigration = portalIsPreMigration
    && supporterProductAllowsPreMigration
    && retirementPricesActive
    && retirementProductsActive
    && couponsPresent
    && targetPricesAreActive
  const isCompleted = portalIsCompleted
    && targetProductCompleted
    && targetPrices.size === config.targetPrices.length
    && targetPricesAreActive
    && retirementPricesInactive
    && retirementProductsInactive
    && couponsMissing
  const state = isPreMigration
    ? "PRE_MIGRATION"
    : isCompleted ? "COMPLETED" : "TRANSITIONAL"
  const recoverableTransition = portalIsCompleted
    && targetProductCompleted
    && targetPrices.size === config.targetPrices.length
    && targetPricesAreActive
    && (
      !retirementPricesInactive
        ? retirementProductsActive && couponsPresent
        : !retirementProductsInactive
          ? couponsPresent
          : true
    )
  if (
    state === "TRANSITIONAL"
    && (!allowTransitional || !recoverableTransition)
  ) {
    failureCodes.push("migration_state_mixed")
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
    check(
      state === "PRE_MIGRATION"
        ? "migration_state_pre_migration"
        : state === "COMPLETED"
          ? "migration_state_completed"
          : "migration_state_transitional",
      state !== "TRANSITIONAL" || allowTransitional,
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
    retirementPrices,
    retirementProducts,
    coupons,
    portal,
    state,
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
    billing_scheme: "per_unit",
    recurring: {
      interval: spec.interval,
      interval_count: 1,
      usage_type: "licensed",
    },
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
  const cancellationReason = currentFeatures.subscription_cancel?.cancellation_reason
  const subscriptionCancel = {
    enabled: true,
    mode: currentFeatures.subscription_cancel?.mode ?? "at_period_end",
    ...(currentFeatures.subscription_cancel?.proration_behavior
      ? {
          proration_behavior: currentFeatures.subscription_cancel.proration_behavior,
        }
      : {}),
    ...(cancellationReason
      ? {
          cancellation_reason: {
            enabled: cancellationReason.enabled === true,
            ...(Array.isArray(cancellationReason.options)
              ? { options: [...cancellationReason.options] }
              : {}),
          },
        }
      : {}),
  }
  const currentSubscriptionUpdate = currentFeatures.subscription_update ?? {}
  return {
    customer_update: {
      enabled: true,
      allowed_updates: ["address", "email", "name"],
    },
    invoice_history: {
      enabled: true,
    },
    payment_method_update: {
      enabled: true,
    },
    subscription_cancel: subscriptionCancel,
    subscription_update: {
      enabled: true,
      default_allowed_updates: ["price"],
      ...(currentSubscriptionUpdate.billing_cycle_anchor
        ? { billing_cycle_anchor: currentSubscriptionUpdate.billing_cycle_anchor }
        : {}),
      ...(currentSubscriptionUpdate.proration_behavior
        ? { proration_behavior: currentSubscriptionUpdate.proration_behavior }
        : {}),
      ...(currentSubscriptionUpdate.schedule_at_period_end
        ? {
            schedule_at_period_end: {
              conditions: [
                ...(currentSubscriptionUpdate.schedule_at_period_end.conditions ?? []),
              ],
            },
          }
        : {}),
      ...(currentSubscriptionUpdate.trial_update_behavior
        ? { trial_update_behavior: currentSubscriptionUpdate.trial_update_behavior }
        : {}),
      products: [{
        product: productId,
        prices: priceIds,
        adjustable_quantity: { enabled: false },
      }],
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

function retrievePriceWithCurrencyOptions(stripe, id) {
  return stripe.prices.retrieve(id, { expand: ["currency_options"] })
}

/**
 * Applies a fully preflighted plan. Mutations are ordered target-first, portal
 * second, then legacy retirement; each write is immediately re-read.
 */
async function applyPlan(stripe, config, inventory) {
  let supporter = inventory.products.supporter
  const productPayload = targetProductPayload(supporter)

  if (!supporter) {
    const created = await stripe.products.create(productPayload, {
      idempotencyKey: SUPPORTER_PRODUCT_IDEMPOTENCY_KEY,
    })
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
      const created = await stripe.prices.create(
        targetPricePayload(supporter.id, spec),
        { idempotencyKey: targetPriceIdempotencyKey(spec) },
      )
      candidate = await retrieveAfterMutation(
        retrievePriceWithCurrencyOptions.bind(null, stripe),
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
        retrievePriceWithCurrencyOptions.bind(null, stripe),
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
  if (
    !jsonEqual(
      normalizePortalFeatures(inventory.portal.features),
      normalizePortalFeatures(desiredFeatures),
    )
  ) {
    await stripe.billingPortal.configurations.update(config.portalConfigurationId, {
      features: desiredFeatures,
    })
    await retrieveAfterMutation(
      stripe.billingPortal.configurations.retrieve.bind(
        stripe.billingPortal.configurations,
      ),
      config.portalConfigurationId,
      (candidate) => jsonEqual(
        normalizePortalFeatures(candidate.features),
        normalizePortalFeatures(desiredFeatures),
      ),
      "portal_mutation_unverified",
    )
  }

  for (const candidate of inventory.retirementPrices) {
    if (candidate.active === false) continue
    await stripe.prices.update(candidate.id, { active: false })
    await retrieveAfterMutation(
      retrievePriceWithCurrencyOptions.bind(null, stripe),
      candidate.id,
      (retrieved) => retrieved.active === false,
      "legacy_price_mutation_unverified",
    )
  }

  for (const candidate of inventory.retirementProducts) {
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
  let inventory = await collectInventory(stripe, config, {
    allowTransitional: mode === "apply",
  })
  if (mode === "apply") {
    let lastError = null
    for (let attempt = 0; attempt < 3 && inventory.state !== "COMPLETED"; attempt += 1) {
      try {
        await applyPlan(stripe, config, inventory)
        lastError = null
      } catch (error) {
        lastError = error
      }
      inventory = await collectInventory(stripe, config, { allowTransitional: true })
    }
    if (inventory.state !== "COMPLETED") {
      if (lastError instanceof MigrationError) throw lastError
      throw new MigrationError(["stripe_mutation_failed"])
    }
  }

  return {
    ok: true,
    mode,
    state: inventory.state,
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
