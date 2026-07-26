#!/usr/bin/env node

import process from "node:process"
import { pathToFileURL } from "node:url"
import Stripe from "stripe"
import {
  recurringPriceSemanticsMatch,
  SUPPORTER_MEMBERSHIP_CATALOG_VERSION as SUPPORTER_CATALOG,
  SUPPORTER_RECURRING_TAX_BEHAVIOR,
  SUPPORTER_RECURRING_TAX_CODE as EXPECTED_TAX_CODE,
} from "../lib/stripe-price-contract.js"
import { TARGET_PRICE_SPECS } from "../lib/stripe-supporter-membership-migration-contract.js"
import { STRIPE_API_VERSION } from "../lib/stripe-webhook-contract.js"

export { TARGET_PRICE_SPECS }

// Keep catalog mutation on the same explicitly pinned version as runtime
// billing and the verified webhook endpoint rather than the SDK's moving default.
const SUPPORTER_PRODUCT_NAME = "MassageLab Supporter Membership"
const CREATE_NEW_PRODUCT = "CREATE_NEW"
const NO_ALLOWED_SUBSCRIPTION = "none"
// Descriptions are the operator-visible Stripe display contract for the three
// same-benefit amounts. priceKeys must partition TARGET_PRICE_SPECS exactly so
// targetProductSpecForPrice can resolve every approved Price without fallback.
const TARGET_PRODUCT_SPECS = Object.freeze([
  Object.freeze({
    key: "support-1",
    configKey: "supporter",
    envKey: "MASSAGELAB_STRIPE_MIGRATION_SUPPORTER_PRODUCT_ID",
    description: "$1 monthly or $10 annually. Same Supporter Membership benefits; only the support amount differs.",
    priceKeys: Object.freeze(["support-1-month", "support-1-year"]),
  }),
  Object.freeze({
    key: "support-2",
    configKey: "support2",
    envKey: "MASSAGELAB_STRIPE_MIGRATION_SUPPORT_2_PRODUCT_ID",
    description: "$2 monthly or $20 annually. Same Supporter Membership benefits; only the support amount differs.",
    priceKeys: Object.freeze(["support-2-month", "support-2-year"]),
  }),
  Object.freeze({
    key: "support-5",
    configKey: "support5",
    envKey: "MASSAGELAB_STRIPE_MIGRATION_SUPPORT_5_PRODUCT_ID",
    description: "$5 monthly or $50 annually. Same Supporter Membership benefits; only the support amount differs.",
    priceKeys: Object.freeze(["support-5-month", "support-5-year"]),
  }),
])
const mappedTargetPriceKeys = TARGET_PRODUCT_SPECS.flatMap(({ priceKeys }) => priceKeys)
const missingTargetPriceKeys = TARGET_PRICE_SPECS
  .map(({ key }) => key)
  .filter((key) => !mappedTargetPriceKeys.includes(key))
const unexpectedTargetPriceKeys = mappedTargetPriceKeys.filter(
  (key) => !TARGET_PRICE_SPECS.some((spec) => spec.key === key),
)
const duplicateTargetPriceKeys = mappedTargetPriceKeys.filter(
  (key, index) => mappedTargetPriceKeys.indexOf(key) !== index,
)
if (
  TARGET_PRODUCT_SPECS[0]?.key !== "support-1"
  ||
  missingTargetPriceKeys.length > 0
  || unexpectedTargetPriceKeys.length > 0
  || duplicateTargetPriceKeys.length > 0
) {
  throw new Error(
    "Supporter migration Product/Price contract is incomplete or ambiguous.",
  )
}
const TERMINAL_SUBSCRIPTION_STATUSES = new Set(["canceled", "incomplete_expired"])
// All inventory callers request 100 objects per page, so this last-resort cap
// bounds any one complete scan to approximately 1,000,000 visited objects.
const MAX_STRIPE_LIST_PAGES = 10_000
// A managed catalog normally has six approved and six legacy Prices. Retain
// up to 1,000 total configured/managed Prices so unusually duplicated
// catalogs remain recoverable while a polluted Stripe account fails closed
// before exhausting the migration process heap.
export const MAX_MANAGED_PRICE_INVENTORY = 1_000
const APPLY_RETRY_DELAYS_MS = Object.freeze([250, 500])
const RECOVERABLE_APPLY_VERIFICATION_FAILURES = new Set([
  "supporter_product_mutation_unverified",
  "supporter_price_mutation_unverified",
  "portal_mutation_unverified",
  "legacy_price_mutation_unverified",
  "legacy_product_mutation_unverified",
  "coupon_mutation_unverified",
])
// These exact `error.type` values come from the pinned Stripe SDK's Error
// classes and keep retry policy independent from message text.
const TRANSIENT_STRIPE_ERROR_TYPES = new Set([
  "StripeConnectionError",
  "StripeRateLimitError",
])
const DETERMINISTIC_STRIPE_ERROR_TYPES = new Set([
  "StripeInvalidRequestError",
  "StripeAuthenticationError",
  "StripePermissionError",
  "StripeIdempotencyError",
])
const CATALOG_DEPENDENCY_FAILURE_CODES = new Set([
  "product_dependency_mismatch",
  "supporter_product_duplicate",
  "supporter_product_dependency_mismatch",
  "legacy_price_dependency_mismatch",
  "approved_price_dependency_mismatch",
  "unexpected_managed_price",
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

/**
 * Older approved support amounts were created under the three legacy tier
 * Products. Stripe Prices cannot move between Products, so the migration must
 * retire these exact semantic slots before creating the same amounts under the
 * matching amount-specific Supporter Products.
 */
const SUPERSEDED_AMOUNT_PRICE_CONFIG = Object.freeze([
  Object.freeze({
    key: "support_1_month",
    productKey: "supporter",
    unitAmount: 100,
    interval: "month",
  }),
  Object.freeze({
    key: "support_1_year",
    productKey: "supporter",
    unitAmount: 1000,
    interval: "year",
  }),
  Object.freeze({
    key: "support_2_month",
    productKey: "therapist",
    unitAmount: 200,
    interval: "month",
  }),
  Object.freeze({
    key: "support_2_year",
    productKey: "therapist",
    unitAmount: 2000,
    interval: "year",
  }),
  Object.freeze({
    key: "support_5_month",
    productKey: "practice",
    unitAmount: 500,
    interval: "month",
  }),
  Object.freeze({
    key: "support_5_year",
    productKey: "practice",
    unitAmount: 5000,
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

/**
 * Carries safe operator-facing failure codes while retaining an optional
 * internal cause for diagnostics that the CLI checklist never prints.
 */
export class MigrationError extends Error {
  constructor(failureCodes, checks = [], options = {}) {
    super(
      `Stripe Supporter membership migration failed (${failureCodes.length} checks).`,
      options,
    )
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

/** Recognizes the documented no-subscription sentinel without case coupling. */
function expectsNoAllowedSubscription(value) {
  return String(value ?? "").toLowerCase() === NO_ALLOWED_SUBSCRIPTION
}

/**
 * Parses and validates explicit operator-supplied migration dependencies.
 *
 * @param {NodeJS.ProcessEnv|Record<string, string|undefined>} env Non-secret
 * configuration plus the Stripe secret used only to prove test/live mode.
 * @param {"verify"|"apply"} requestedMode Whether to inspect or mutate.
 * @returns {object} Normalized migration dependencies and target Price slots.
 *
 * Each support-amount Product accepts either a concrete `prod_...` identifier
 * or the exact `CREATE_NEW` sentinel. Allowed subscription inventory accepts
 * one concrete `sub_...` identifier or case-insensitive `none`. Therapist,
 * Practice, legacy Price, coupon, and Portal dependencies remain explicit.
 * @throws {MigrationError} With non-secret configuration failure codes.
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
    ...Object.fromEntries(TARGET_PRODUCT_SPECS.map((spec) => [
      spec.configKey,
      envValue(env, spec.envKey),
    ])),
    therapist: envValue(env, "MASSAGELAB_STRIPE_MIGRATION_THERAPIST_PRODUCT_ID"),
    practice: envValue(env, "MASSAGELAB_STRIPE_MIGRATION_PRACTICE_PRODUCT_ID"),
  }
  const isStripeProductId = (value) => (
    value.startsWith("prod_")
    && value.length > "prod_".length
  )
  if (
    !TARGET_PRODUCT_SPECS.every(({ configKey }) => (
      productIds[configKey] === CREATE_NEW_PRODUCT
      || isStripeProductId(productIds[configKey])
    ))
    || !isStripeProductId(productIds.therapist)
    || !isStripeProductId(productIds.practice)
  ) {
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
  const expectsNoSubscriptions = expectsNoAllowedSubscription(allowedSubscriptionId)
  if (
    !allowedSubscriptionId
    || (!expectsNoSubscriptions && !allowedSubscriptionId.startsWith("sub_"))
  ) {
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
    allowedSubscriptionId,
    productIds,
    legacyPrices,
    coupons,
    portalConfigurationId,
    targetPrices,
  }
}

/**
 * Visits a complete Stripe list without materializing the account-wide result.
 *
 * @param {(params: Record<string, unknown>) => Promise<{ data: unknown[], has_more: boolean }>} listPage
 * @param {Record<string, unknown>} params Stripe list parameters, normally including `limit: 100`.
 * @param {(row: unknown) => void} visit Called once per object in page order.
 * @returns {Promise<void>} Resolves only after every page has been visited.
 *
 * Malformed data or `has_more`, missing or repeated cursors, and exhaustion of
 * the 10,000-page safety cap fail closed with
 * `MigrationError(["stripe_pagination_incomplete"])`.
 */
async function scanAll(listPage, params, visit) {
  const seenCursors = new Set()
  let startingAfter = null

  for (let pageNumber = 0; pageNumber < MAX_STRIPE_LIST_PAGES; pageNumber += 1) {
    const page = await listPage({
      ...params,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    })
    if (!Array.isArray(page?.data)) {
      throw new MigrationError(["stripe_pagination_incomplete"])
    }
    for (const row of page.data) {
      visit(row)
    }
    if (page.has_more === false) {
      return
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

  throw new MigrationError(["stripe_pagination_incomplete"])
}

async function retrieveOrMissing(retrieve, id) {
  try {
    return { object: await retrieve(id), missing: false }
  } catch (error) {
    if (error?.code === "resource_missing") {
      return { object: null, missing: true }
    }
    throw new MigrationError(["stripe_dependency_read_failed"], [], { cause: error })
  }
}

function modeMatches(object, livemode) {
  return object?.livemode === livemode
}

function priceProductId(candidate) {
  return typeof candidate?.product === "string" ? candidate.product : candidate?.product?.id
}

/** Verifies every immutable recurring semantic required of a target Price. */
function targetPriceSemanticsMatch(candidate, spec) {
  return Boolean(candidate)
    && recurringPriceSemanticsMatch(candidate, {
      unitAmount: spec.unitAmount,
      interval: spec.interval,
      taxBehavior: SUPPORTER_RECURRING_TAX_BEHAVIOR,
    })
}

/** Adds the immutable Product-owner requirement to the target Price contract. */
function priceMatches(candidate, spec, productId) {
  return targetPriceSemanticsMatch(candidate, spec)
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

/** Verifies fields and metadata shared by all three amount Products. */
function targetSupporterProductCoreMatches(candidate) {
  return Boolean(candidate)
    && candidate.name === SUPPORTER_PRODUCT_NAME
    && candidate.active === true
    && candidate.tax_code === EXPECTED_TAX_CODE
    && candidate.metadata?.app === "massagelab"
    && candidate.metadata?.massagelab_catalog === SUPPORTER_CATALOG
    && candidate.metadata?.massagelab_membership_level === "SUPPORTER"
}

/** Verifies the complete contract for one amount-specific Supporter Product. */
function targetSupporterProductMatches(candidate, spec) {
  return targetSupporterProductCoreMatches(candidate)
    && candidate.description === spec.description
    && candidate.metadata?.massagelab_supporter_amount_choice === spec.key
}

/** Resolves the single amount Product contract that owns a target Price slot. */
function targetProductSpecForPrice(spec) {
  return TARGET_PRODUCT_SPECS.find((candidate) => candidate.priceKeys.includes(spec.key))
}

/** Keeps Product creation replay-safe and unique to one amount choice. */
function targetProductIdempotencyKey(spec) {
  return `massagelab-supporter-membership-v1-product-${spec.key}`
}

/**
 * Identifies the normal Product made by the retired live setup command. Reuse
 * mode may classify this exact object, but does not accept an arbitrary
 * partially managed Product as a safe dependency.
 */
function legacySupporterProductMatches(candidate) {
  const app = candidate?.metadata?.app
  return Boolean(candidate)
    && candidate.name === "MassageLab Supporter"
    && candidate.tax_code == null
    && (app === undefined || app === "massagelab")
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

/** Verifies the self-service features that must survive either Portal state. */
function portalBillingManagementEnabled(features) {
  const normalized = normalizePortalFeatures(features)
  return normalized.customerUpdate.enabled
    && hasExactly(normalized.customerUpdate.allowedUpdates, ["address", "email", "name"])
    && normalized.invoiceHistoryEnabled
    && normalized.paymentMethodUpdateEnabled
    && normalized.subscriptionCancel.enabled
    && normalized.subscriptionCancel.mode === "at_period_end"
    && normalized.subscriptionCancel.prorationBehavior === "none"
    && normalized.subscriptionCancel.cancellationReason.enabled
    && hasExactly(
      normalized.subscriptionCancel.cancellationReason.options,
      ["missing_features", "other", "switched_service", "too_expensive", "unused"],
    )
}

/** Verifies the Price-only switching contract required after migration. */
function portalSubscriptionSwitchingEnabled(
  features,
  { scheduleAtPeriodEndConditions = [] } = {},
) {
  const normalized = normalizePortalFeatures(features)
  return normalized.subscriptionUpdate.enabled
    && hasExactly(normalized.subscriptionUpdate.defaultAllowedUpdates, ["price"])
    && portalSubscriptionSwitchingPolicyMatches(
      normalized.subscriptionUpdate,
      scheduleAtPeriodEndConditions,
    )
}

/**
 * Pins the customer-impacting behavior used when a member changes support
 * amount. Disabled Portal settings are validated too because apply enables
 * switching and must never carry an unsafe dormant policy forward.
 */
function portalSubscriptionSwitchingPolicyMatches(
  subscriptionUpdate,
  scheduleAtPeriodEndConditions,
) {
  return subscriptionUpdate.billingCycleAnchor === "unchanged"
    && subscriptionUpdate.prorationBehavior === "none"
    && hasExactly(
      subscriptionUpdate.scheduleAtPeriodEndConditions,
      scheduleAtPeriodEndConditions,
    )
    && subscriptionUpdate.trialUpdateBehavior === "end_trial"
}

/**
 * Accepts the reviewed pre-migration state where plan switching is disabled
 * and no Product allowlist exists.
 */
function portalSubscriptionSwitchingDisabled(features) {
  const normalized = normalizePortalFeatures(features)
  return !normalized.subscriptionUpdate.enabled
    && normalized.subscriptionUpdate.defaultAllowedUpdates.length === 0
    && normalized.subscriptionUpdate.products.length === 0
    && portalSubscriptionSwitchingPolicyMatches(
      normalized.subscriptionUpdate,
      ["decreasing_item_amount"],
    )
}

function expectedPortalProducts(entries) {
  return normalizePortalProducts(
    entries.map(({ product, prices }) => ({
      product: product ?? "",
      prices,
      adjustable_quantity: { enabled: false },
    })),
  )
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

function targetPriceIdempotencyKey(spec, supporterProductId) {
  return `massagelab-supporter-membership-v1-price-${supporterProductId}-${spec.key}`
}

function findTargetCandidate({ allPrices, configuredId, spec, productId }) {
  if (configuredId) {
    return allPrices.find((candidate) => candidate.id === configuredId) ?? null
  }

  const managed = allPrices.filter((candidate) => (
    priceProductId(candidate) === productId
    && candidate.metadata?.massagelab_catalog === SUPPORTER_CATALOG
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
  const subscriptions = []
  let relevantSubscriptionOverflow = false
  const productsById = new Map()
  let targetProductCandidateOverflow = false
  let allProducts
  let allPrices
  let portal
  try {
    const configuredProductIds = new Set(
      Object.values(config.productIds).filter(
        (id) => id && id !== CREATE_NEW_PRODUCT,
      ),
    )
    const retainProduct = (candidate) => {
      const candidateId = candidate?.id
      const isTargetCandidate = candidate?.name === SUPPORTER_PRODUCT_NAME
        || candidate?.metadata?.massagelab_catalog === SUPPORTER_CATALOG
      if (configuredProductIds.has(candidateId)) {
        productsById.set(candidateId, candidate)
      }
      // The completed catalog has three managed Products. One additional
      // candidate is sufficient to prove an ambiguous or polluted topology.
      if (isTargetCandidate && !productsById.has(candidateId)) {
        if (targetProductCandidateOverflow) return
        const retainedTargetCount = [...productsById.values()].filter((product) => (
          product?.name === SUPPORTER_PRODUCT_NAME
          || product?.metadata?.massagelab_catalog === SUPPORTER_CATALOG
        )).length
        if (retainedTargetCount >= TARGET_PRODUCT_SPECS.length) {
          targetProductCandidateOverflow = true
        } else {
          productsById.set(candidateId, candidate)
        }
      }
    }

    const [retrievedBalance, retrievedPortal] = await Promise.all([
      stripe.balance.retrieve(),
      stripe.billingPortal.configurations.retrieve(config.portalConfigurationId),
      scanAll(
        stripe.subscriptions.list.bind(stripe.subscriptions),
        { status: "all", limit: 100 },
        (subscription) => {
          const status = String(subscription?.status ?? "").toLowerCase()
          if (!TERMINAL_SUBSCRIPTION_STATUSES.has(status)) {
            if (subscriptions.length < 2) subscriptions.push(subscription)
            else relevantSubscriptionOverflow = true
          }
        },
      ),
      scanAll(
        stripe.products.list.bind(stripe.products),
        { limit: 100 },
        (product) => {
          retainProduct(product)
        },
      ),
    ])
    balance = retrievedBalance
    portal = retrievedPortal

    // Retrieve explicitly named dependencies first. This catches configured
    // Prices attached to the wrong Product without retaining unrelated Prices.
    const configuredPriceIds = new Set([
      ...config.legacyPrices.map((spec) => spec.id),
      ...config.targetPrices.map((spec) => spec.configuredId).filter(Boolean),
    ])
    const configuredPrices = []
    await Promise.all([...configuredPriceIds].map(async (priceId) => {
      const result = await retrieveOrMissing(
        stripe.prices.retrieve.bind(stripe.prices),
        priceId,
      )
      if (!result.missing) configuredPrices.push(result.object)
    }))

    const discoveredLegacySupporterProductId =
      config.productIds.supporter === CREATE_NEW_PRODUCT
        ? priceProductId(configuredPrices.find((candidate) => (
            config.legacyPrices.some((spec) => (
              spec.productKey === "supporter" && spec.id === candidate?.id
            ))
          )))
        : config.productIds.supporter
    if (
      discoveredLegacySupporterProductId
      && !productsById.has(discoveredLegacySupporterProductId)
    ) {
      const result = await retrieveOrMissing(
        stripe.products.retrieve.bind(stripe.products),
        discoveredLegacySupporterProductId,
      )
      if (!result.missing) productsById.set(result.object.id, result.object)
    }

    allProducts = [...productsById.values()]

    const managedProductIds = new Set([
      ...configuredProductIds,
      discoveredLegacySupporterProductId,
      ...allProducts
        .filter((candidate) => (
          candidate?.name === SUPPORTER_PRODUCT_NAME
          || candidate?.metadata?.massagelab_catalog === SUPPORTER_CATALOG
        ))
        .map(({ id }) => id),
    ].filter(Boolean))
    const pricesById = new Map(
      configuredPrices.map((candidate) => [candidate.id, candidate]),
    )
    /** Retains a managed Price only while the bounded migration plan is safe. */
    const retainManagedPrice = (candidate, productId) => {
      if (priceProductId(candidate) !== productId) return
      if (!pricesById.has(candidate.id) && pricesById.size >= MAX_MANAGED_PRICE_INVENTORY) {
        throw new MigrationError(["managed_price_inventory_overflow"])
      }
      pricesById.set(candidate.id, candidate)
    }
    // Stripe omits inactive Prices by default. Scan both states per managed
    // Product so duplicates and unexpected archived Prices still fail closed
    // without materializing unrelated account inventory.
    await Promise.all([...managedProductIds].flatMap((productId) => (
      [true, false].map((active) => scanAll(
        stripe.prices.list.bind(stripe.prices),
        {
          product: productId,
          active,
          limit: 100,
          expand: ["data.currency_options"],
        },
        (price) => {
          retainManagedPrice(price, productId)
        },
      ))
    )))
    allPrices = [...pricesById.values()]
  } catch (error) {
    if (error instanceof MigrationError) throw error
    throw new MigrationError(["stripe_dependency_read_failed"], [], { cause: error })
  }

  if (!modeMatches(balance, config.livemode)) {
    failureCodes.push("stripe_account_mode_mismatch")
  }

  // Fail closed for unknown or future Stripe statuses. Only statuses Stripe
  // explicitly defines as terminal are safe to omit from migration inventory.
  const relevantSubscriptions = subscriptions.filter((subscription) => {
    const status = String(subscription.status ?? "").toLowerCase()
    return !TERMINAL_SUBSCRIPTION_STATUSES.has(status)
  })
  const subscriptionsMatch = !relevantSubscriptionOverflow
    && (expectsNoAllowedSubscription(config.allowedSubscriptionId)
    ? relevantSubscriptions.length === 0
    : relevantSubscriptions.length === 1
      && relevantSubscriptions[0].id === config.allowedSubscriptionId)
  if (
    !subscriptionsMatch
    || relevantSubscriptions.some((subscription) => !modeMatches(subscription, config.livemode))
  ) {
    failureCodes.push("unexpected_subscription_inventory")
  }

  const products = {}
  for (const [key, id] of Object.entries(config.productIds)) {
    if (
      TARGET_PRODUCT_SPECS.some(({ configKey }) => configKey === key)
      && id === CREATE_NEW_PRODUCT
    ) continue
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
  for (const spec of TARGET_PRODUCT_SPECS) {
    if (config.productIds[spec.configKey] !== CREATE_NEW_PRODUCT) continue
    const matches = targetProductCandidates.filter((candidate) => (
      candidate.metadata?.massagelab_supporter_amount_choice === spec.key
    ))
    if (matches.length > 1) {
      failureCodes.push("supporter_product_duplicate")
    } else if (matches.length === 1) {
      products[spec.configKey] = matches[0]
    }
  }
  // Reuse the exact legacy Supporter Product only before an amount-specific
  // Product exists. applyPlan stamps support-1 before it creates support-2 and
  // support-5, preserving this single-candidate safety condition on retries.
  if (
    config.productIds.supporter === CREATE_NEW_PRODUCT
    && !products.supporter
    && targetProductCandidates.length === 1
    && targetProductCandidates[0].metadata?.massagelab_supporter_amount_choice == null
  ) {
    products.supporter = targetProductCandidates[0]
  }

  const assignedTargetProductIdList = TARGET_PRODUCT_SPECS
    .map(({ configKey }) => products[configKey]?.id)
    .filter(Boolean)
  const assignedTargetProductIds = new Set(assignedTargetProductIdList)
  if (
    targetProductCandidateOverflow
    || assignedTargetProductIds.size !== assignedTargetProductIdList.length
    || targetProductCandidates.some(({ id }) => !assignedTargetProductIds.has(id))
  ) {
    failureCodes.push("supporter_product_duplicate")
  }

  const targetProductCompleted = new Map()
  const targetProductReusable = new Map()
  for (const spec of TARGET_PRODUCT_SPECS) {
    const candidate = products[spec.configKey]
    const completed = targetSupporterProductMatches(candidate, spec)
    const reusable = candidate?.active === true
      && (
        (spec.configKey === "supporter" && legacySupporterProductMatches(candidate))
        || (
          targetSupporterProductCoreMatches(candidate)
          && (
            candidate.metadata?.massagelab_supporter_amount_choice === spec.key
            || (
              spec.configKey === "supporter"
              && candidate.metadata?.massagelab_supporter_amount_choice == null
            )
          )
        )
      )
    targetProductCompleted.set(spec.key, completed)
    targetProductReusable.set(spec.key, reusable)
    if (candidate && !completed && !reusable) {
      failureCodes.push("supporter_product_dependency_mismatch")
    }
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
    const legacyExpectedProductId = spec.productKey === "supporter"
      ? legacySupporterProductId
      : config.productIds[spec.productKey]
    if (
      !candidate
      || !modeMatches(candidate, config.livemode)
      || !legacyPriceMatches(candidate, spec, legacyExpectedProductId)
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
  for (const spec of config.targetPrices) {
    const productSpec = targetProductSpecForPrice(spec)
    const expectedTargetProductId = products[productSpec.configKey]?.id
    if (expectedTargetProductId) {
      const candidate = findTargetCandidate({
        allPrices,
        configuredId: spec.configuredId,
        spec,
        productId: expectedTargetProductId,
      })
      if (
        candidate?.duplicate
        || (
          candidate
          && (
            candidate.active !== true
            || !priceMatches(candidate, spec, expectedTargetProductId)
          )
        )
      ) {
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
    } else if (spec.configuredId) {
      failureCodes.push("approved_price_dependency_mismatch")
    }
  }

  const managedProductIds = new Set([
    ...TARGET_PRODUCT_SPECS.map(({ configKey }) => products[configKey]?.id),
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

    const supersededAmount = SUPERSEDED_AMOUNT_PRICE_CONFIG.some((spec) => (
      legacyPriceMatches(candidate, spec, expectedProductId(spec))
    ))
    if (supersededAmount) {
      retirementPricesById.set(candidate.id, candidate)
      continue
    }

    const managedTargetSpec = config.targetPrices.find((spec) => (
      managedPriceKey(candidate) === spec.key
      || candidate.lookup_key === lookupKeyFor(spec)
    ))
    if (managedTargetSpec) {
      const productSpec = targetProductSpecForPrice(managedTargetSpec)
      const expectedTargetProductId = products[productSpec.configKey]?.id
      const selectedTarget = targetPrices.get(managedTargetSpec.key)
      const hasWrongOwner = ownerId !== expectedTargetProductId
      const conflictsWithSelectedTarget = selectedTarget && selectedTarget.id !== candidate.id
      if (
        hasWrongOwner
        || conflictsWithSelectedTarget
      ) {
        const historicalOwnerIds = new Set([
          legacySupporterProductId,
          ...SUPERSEDED_AMOUNT_PRICE_CONFIG
            .filter((spec) => (
              spec.unitAmount === managedTargetSpec.unitAmount
              && spec.interval === managedTargetSpec.interval
            ))
            .map((spec) => expectedProductId(spec)),
        ])
        const ownerIsRecoverable = hasWrongOwner
          ? historicalOwnerIds.has(ownerId)
          : ownerId === expectedTargetProductId
        // A valid managed or lookup key does not make an arbitrary Price safe
        // to delete. Only an exact target-semantic Price on the expected or a
        // documented historical Product may be retired during partial recovery.
        if (ownerIsRecoverable && targetPriceSemanticsMatch(candidate, managedTargetSpec)) {
          retirementPricesById.set(candidate.id, candidate)
        } else {
          failureCodes.push("unexpected_managed_price")
        }
        continue
      }
    }

    const duplicateTargetSpec = config.targetPrices.find((spec) => {
      const productSpec = targetProductSpecForPrice(spec)
      return priceMatches(candidate, spec, products[productSpec.configKey]?.id)
    })
    if (duplicateTargetSpec) {
      const selectedTarget = targetPrices.get(duplicateTargetSpec.key)
      if (
        selectedTarget
        && duplicateTargetSpec.configuredId
        && selectedTarget.id !== candidate.id
      ) {
        retirementPricesById.set(candidate.id, candidate)
        continue
      }
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
  const allTargetProductsCompleted = TARGET_PRODUCT_SPECS.every(
    (spec) => targetProductCompleted.get(spec.key),
  )
  const allTargetProductsRepairable = TARGET_PRODUCT_SPECS.every((spec) => (
    targetProductCompleted.get(spec.key) || targetProductReusable.get(spec.key)
  ))
  const completedPortalProducts = (
    allTargetProductsRepairable
    && targetPrices.size === config.targetPrices.length
  )
    ? TARGET_PRODUCT_SPECS.map((productSpec) => ({
        product: products[productSpec.configKey].id,
        prices: productSpec.priceKeys.map((key) => targetPrices.get(key).id),
      }))
    : []
  const portalBaseValid = Boolean(portal)
    && modeMatches(portal, config.livemode)
    && portal.active === true
    && portalBillingManagementEnabled(portal.features)
  const portalIsPreMigration = portalBaseValid
    && (
      portalSubscriptionSwitchingDisabled(portal.features)
      // The retired setup command may already expose only the exact three
      // reviewed legacy Products. Preserve that complete state long enough for
      // apply to replace it atomically with the three-Product Supporter allowlist.
      || (
        portalSubscriptionSwitchingEnabled(portal.features, {
          scheduleAtPeriodEndConditions: ["decreasing_item_amount"],
        })
        && portalTopologyMatches(portal.features, prePortalProducts)
      )
    )
  const portalIsCompleted = portalBaseValid
    && portalSubscriptionSwitchingEnabled(portal.features)
    && completedPortalProducts.length === TARGET_PRODUCT_SPECS.length
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
  const couponsConsistent = couponsPresent || couponsMissing
  const couponsRetirementRecoverable = coupons.size === config.coupons.length
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
  const supporterProductsAllowPreMigration = TARGET_PRODUCT_SPECS.every((spec) => (
    !products[spec.configKey]
    || targetProductCompleted.get(spec.key)
    || targetProductReusable.get(spec.key)
  ))
  const isPreMigration = portalIsPreMigration
    && supporterProductsAllowPreMigration
    && retirementPricesActive
    && retirementProductsActive
    && couponsConsistent
    && targetPricesAreActive
  const isCompleted = portalIsCompleted
    && allTargetProductsCompleted
    && targetPrices.size === config.targetPrices.length
    && targetPricesAreActive
    && retirementPricesInactive
    && retirementProductsInactive
    && couponsMissing
  let state = "TRANSITIONAL"
  if (isPreMigration) {
    state = "PRE_MIGRATION"
  } else if (isCompleted) {
    state = "COMPLETED"
  }
  // Once the Portal points only at the new catalog, recovery may move forward
  // through Prices, Products, then coupons. A partially deleted coupon set is
  // recoverable only here because every survivor already matched its exact,
  // unused dependency contract. Products cannot precede Price retirement.
  const retirementOrderRecoverable = retirementPricesInactive
    || retirementProductsActive
  const recoverableTransition = portalIsCompleted
    && allTargetProductsRepairable
    && targetPrices.size === config.targetPrices.length
    && targetPricesAreActive
    && couponsRetirementRecoverable
    && retirementOrderRecoverable
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
      !failureCodes.some((code) => CATALOG_DEPENDENCY_FAILURE_CODES.has(code)),
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
      !failureCodes.includes("migration_state_mixed"),
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

/**
 * Builds the complete create/update payload for one amount Product while
 * preserving Stripe metadata unrelated to MassageLab's managed contract.
 */
function targetProductPayload(current, spec) {
  return {
    name: SUPPORTER_PRODUCT_NAME,
    description: spec.description,
    active: true,
    tax_code: EXPECTED_TAX_CODE,
    metadata: {
      ...(current?.metadata ?? {}),
      app: "massagelab",
      massagelab_catalog: SUPPORTER_CATALOG,
      massagelab_membership_level: "SUPPORTER",
      massagelab_supporter_amount_choice: spec.key,
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
    tax_behavior: SUPPORTER_RECURRING_TAX_BEHAVIOR,
    lookup_key: lookupKeyFor(spec),
    transfer_lookup_key: true,
    metadata: targetPriceMetadata(spec),
  }
}

function sameMetadata(actual, expected) {
  return Object.entries(expected).every(([key, value]) => actual?.[key] === value)
}

function needsProductUpdate(current, payload) {
  return current.name !== payload.name
    || current.description !== payload.description
    || current.active !== payload.active
    || current.tax_code !== payload.tax_code
    || !sameMetadata(current.metadata, payload.metadata)
}

function needsPriceUpdate(current, spec) {
  return current.active !== true
    || current.lookup_key !== lookupKeyFor(spec)
    || !sameMetadata(current.metadata, targetPriceMetadata(spec, current))
}

/**
 * Builds the exact Customer Portal feature payload.
 *
 * `products` is the order-significant array of `{ product, prices }` entries
 * later compared by portalTopologyMatches after normalization. Empty
 * schedule-at-period-end conditions intentionally make same-benefit amount
 * changes immediate while retaining the billing-cycle anchor and no-proration
 * policy.
 */
function desiredPortalFeatures(currentFeatures, products) {
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
      billing_cycle_anchor: "unchanged",
      proration_behavior: "none",
      schedule_at_period_end: {
        conditions: [],
      },
      trial_update_behavior: "end_trial",
      products: products.map(({ product, prices }) => ({
        product,
        prices,
        adjustable_quantity: { enabled: false },
      })),
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
  } catch (error) {
    throw new MigrationError([failureCode], [], { cause: error })
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
  const targetProducts = new Map()
  for (const spec of TARGET_PRODUCT_SPECS) {
    let candidate = inventory.products[spec.configKey]
    const productPayload = targetProductPayload(candidate, spec)
    if (!candidate) {
      const created = await stripe.products.create(productPayload, {
        idempotencyKey: targetProductIdempotencyKey(spec),
      })
      candidate = await retrieveAfterMutation(
        stripe.products.retrieve.bind(stripe.products),
        created.id,
        (retrieved) => targetSupporterProductMatches(retrieved, spec),
        "supporter_product_mutation_unverified",
      )
    } else if (needsProductUpdate(candidate, productPayload)) {
      await stripe.products.update(candidate.id, productPayload)
      candidate = await retrieveAfterMutation(
        stripe.products.retrieve.bind(stripe.products),
        candidate.id,
        (retrieved) => targetSupporterProductMatches(retrieved, spec),
        "supporter_product_mutation_unverified",
      )
    }
    targetProducts.set(spec.key, candidate)
  }

  const targetPrices = new Map()
  for (const spec of config.targetPrices) {
    const productSpec = targetProductSpecForPrice(spec)
    const targetProduct = targetProducts.get(productSpec.key)
    let candidate = inventory.targetPrices.get(spec.key)
    if (!candidate) {
      const created = await stripe.prices.create(
        targetPricePayload(targetProduct.id, spec),
        { idempotencyKey: targetPriceIdempotencyKey(spec, targetProduct.id) },
      )
      candidate = await retrieveAfterMutation(
        retrievePriceWithCurrencyOptions.bind(null, stripe),
        created.id,
        (retrieved) => priceMatches(retrieved, spec, targetProduct.id)
          && retrieved.active === true
          && sameMetadata(retrieved.metadata, targetPriceMetadata(spec)),
        "supporter_price_mutation_unverified",
      )
    } else if (needsPriceUpdate(candidate, spec)) {
      await stripe.prices.update(candidate.id, {
        active: true,
        lookup_key: lookupKeyFor(spec),
        metadata: targetPriceMetadata(spec, candidate),
        transfer_lookup_key: true,
      })
      candidate = await retrieveAfterMutation(
        retrievePriceWithCurrencyOptions.bind(null, stripe),
        candidate.id,
        (retrieved) => priceMatches(retrieved, spec, targetProduct.id)
          && retrieved.active === true
          && retrieved.lookup_key === lookupKeyFor(spec)
          && sameMetadata(retrieved.metadata, targetPriceMetadata(spec)),
        "supporter_price_mutation_unverified",
      )
    }
    targetPrices.set(spec.key, candidate)
  }

  const desiredFeatures = desiredPortalFeatures(
    inventory.portal.features,
    TARGET_PRODUCT_SPECS.map((productSpec) => ({
      product: targetProducts.get(productSpec.key).id,
      prices: productSpec.priceKeys.map((key) => targetPrices.get(key).id),
    })),
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

  // Stripe Products with active Prices cannot be archived. Retire every
  // verified legacy Price first, then archive only their now-price-free owners.
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
 * Returns true only for Stripe transport/rate-limit failures, server-side 5xx
 * responses, or a step-specific post-mutation verification failure.
 */
function isRecoverableApplyFailure(error) {
  const stripeError = error instanceof MigrationError ? error.cause : error
  if (DETERMINISTIC_STRIPE_ERROR_TYPES.has(stripeError?.type)) {
    return false
  }

  if (TRANSIENT_STRIPE_ERROR_TYPES.has(stripeError?.type)) {
    return true
  }

  const statusCode = Number(stripeError?.statusCode)
  if (Number.isInteger(statusCode) && statusCode >= 500 && statusCode <= 599) {
    return true
  }

  if (
    error instanceof MigrationError
    && error.failureCodes.length > 0
    && error.failureCodes.every((code) => (
      RECOVERABLE_APPLY_VERIFICATION_FAILURES.has(code)
    ))
  ) {
    return true
  }
  return false
}

/** Retains safe step-specific errors and otherwise wraps the original cause. */
function normalizeApplyFailure(error) {
  return error instanceof MigrationError
    ? error
    : new MigrationError(["stripe_mutation_failed"], [], { cause: error })
}

/** Waits between apply retries so Stripe's eventually consistent lists settle. */
function waitForApplyRetry(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds)
  })
}

/**
 * Verifies or applies the Supporter catalog migration without exposing object
 * identifiers in its reader-facing checklist. Callers may inject `sleep` for
 * deterministic tests; production uses short escalating retry delays.
 */
export async function runSupporterMembershipMigration({
  stripe,
  mode,
  env = process.env,
  sleep = waitForApplyRetry,
} = {}) {
  const config = buildConfig(env, mode)
  let inventory = await collectInventory(stripe, config, {
    allowTransitional: mode === "apply",
  })
  if (mode === "apply") {
    let lastError = null
    // Never replay a mutation plan built from stale pre-apply inventory. A
    // failed post-apply read must first prove the current Stripe state.
    let refreshBeforeApply = false
    for (let attempt = 0; attempt < 3 && inventory.state !== "COMPLETED"; attempt += 1) {
      if (refreshBeforeApply) {
        try {
          inventory = await collectInventory(stripe, config, { allowTransitional: true })
          refreshBeforeApply = false
        } catch (error) {
          const normalizedError = normalizeApplyFailure(error)
          if (!isRecoverableApplyFailure(error)) {
            throw normalizedError
          }
          lastError = normalizedError
          if (attempt < APPLY_RETRY_DELAYS_MS.length) {
            await sleep(APPLY_RETRY_DELAYS_MS[attempt])
          }
          continue
        }
        if (inventory.state === "COMPLETED") break
      }

      try {
        await applyPlan(stripe, config, inventory)
      } catch (error) {
        const normalizedError = normalizeApplyFailure(error)
        if (!isRecoverableApplyFailure(error)) {
          throw normalizedError
        }
        lastError = normalizedError
      }

      try {
        inventory = await collectInventory(stripe, config, { allowTransitional: true })
      } catch (error) {
        const normalizedError = normalizeApplyFailure(error)
        if (!isRecoverableApplyFailure(error)) {
          throw normalizedError
        }
        lastError = normalizedError
        refreshBeforeApply = true
      }
      if (inventory.state !== "COMPLETED" && attempt < APPLY_RETRY_DELAYS_MS.length) {
        await sleep(APPLY_RETRY_DELAYS_MS[attempt])
      }
    }
    if (inventory.state !== "COMPLETED") {
      if (lastError) throw lastError
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

/**
 * Formats only fixed check/failure codes from a failed migration. The retained
 * cause remains available to trusted diagnostics but is never printed by CLI.
 */
export function formatMigrationFailureChecklist(error) {
  return [
    ...error.checks.map(({ status, code }) => `${status} ${code}`),
    ...error.failureCodes.map((code) => `FAIL ${code}`),
  ].join("\n")
}

function argumentValue(name) {
  const prefix = `${name}=`
  return process.argv.slice(2).find((argument) => argument.startsWith(prefix))?.slice(prefix.length) ?? ""
}

async function main() {
  const mode = argumentValue("--mode")
  const secretKey = envValue(process.env, "STRIPE_SECRET_KEY")
  try {
    // Validate the CLI boundary before constructing Stripe. The exported
    // runner deliberately rebuilds the same pure config so programmatic
    // callers cannot bypass validation by supplying a prevalidated object.
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
      : new MigrationError(["unexpected_migration_failure"], [], { cause: error })
    const checklist = formatMigrationFailureChecklist(migrationError)
    if (checklist) {
      console.error(checklist)
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
