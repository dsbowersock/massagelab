import {
  SUPPORTER_MEMBERSHIP_PRODUCT_NAME,
  SUPPORTER_MEMBERSHIP_CATALOG_VERSION,
  recurringPriceSemanticMismatches,
  SUPPORTER_MEMBERSHIP_PRICE_CONTRACT,
  SUPPORTER_RECURRING_TAX_BEHAVIOR,
  SUPPORTER_RECURRING_TAX_CODE,
} from "./stripe-price-contract.js"
import { ONE_TIME_SUPPORT_TAX_CODE } from "./donations.js"

export {
  SUPPORTER_RECURRING_TAX_BEHAVIOR,
  SUPPORTER_RECURRING_TAX_CODE,
}

/**
 * The deployed Supporter catalog is a fixed set of six recurring USD Prices.
 * Keep this contract separate from historical webhook price normalization.
 */
export const REQUIRED_SUPPORTER_PRICE_CONTRACT = Object.freeze([
  ...SUPPORTER_MEMBERSHIP_PRICE_CONTRACT.map(({
    envKey,
    amountChoiceId,
    level,
    interval,
    unitAmount,
  }) => Object.freeze({
    key: envKey,
    amountChoiceId,
    level,
    interval,
    unitAmount,
  })),
])

/**
 * Accepts only the explicit boolean or case-insensitive string `true` used by
 * operator readiness attestations; truthy aliases remain fail-closed.
 */
export function isExplicitTrue(value) {
  return String(value ?? "").trim().toLowerCase() === "true"
}

/**
 * Resolves the operator attestations that must all be explicit before a new
 * Supporter Checkout Session can request Stripe Automatic Tax.
 */
export function getSupporterRecurringTaxReadiness(env = process.env) {
  const automaticTaxEnabled = isExplicitTrue(
    env.STRIPE_SUPPORTER_AUTOMATIC_TAX_ENABLED,
  )
  const taxProductCodeConfigured = String(
    env.STRIPE_SUPPORTER_TAX_PRODUCT_CODE ?? "",
  ).trim() === SUPPORTER_RECURRING_TAX_CODE
  const taxProviderReady = isExplicitTrue(
    env.STRIPE_SUPPORTER_TAX_PROVIDER_READY,
  )
  const taxRegistrationsReady = isExplicitTrue(
    env.STRIPE_SUPPORTER_TAX_REGISTRATIONS_READY,
  )
  const taxClassificationConfirmed = isExplicitTrue(
    env.STRIPE_SUPPORTER_TAX_CLASSIFICATION_CONFIRMED,
  )

  return {
    automaticTaxEnabled,
    taxProductCodeConfigured,
    taxProviderReady,
    taxRegistrationsReady,
    taxClassificationConfirmed,
    ready: automaticTaxEnabled
      && taxProductCodeConfigured
      && taxProviderReady
      && taxRegistrationsReady
      && taxClassificationConfirmed,
  }
}

/**
 * Resolves the independent operator attestations required before one-time
 * support can request Stripe Automatic Tax under its reviewed classification.
 *
 * @param {Record<string, string | undefined>} [env=process.env] Environment
 * containing `STRIPE_ONE_TIME_SUPPORT_AUTOMATIC_TAX_ENABLED`,
 * `STRIPE_ONE_TIME_SUPPORT_TAX_PRODUCT_CODE`,
 * `STRIPE_ONE_TIME_SUPPORT_TAX_PROVIDER_READY`,
 * `STRIPE_ONE_TIME_SUPPORT_TAX_REGISTRATIONS_READY`, and
 * `STRIPE_ONE_TIME_SUPPORT_TAX_CLASSIFICATION_CONFIRMED`.
 * @returns {{automaticTaxEnabled: boolean, taxProductCodeConfigured: boolean,
 * taxProviderReady: boolean, taxRegistrationsReady: boolean,
 * taxClassificationConfirmed: boolean, ready: boolean}} The five normalized
 * attestations and a fail-closed aggregate that is true only when all five are
 * valid.
 */
export function getOneTimeSupportTaxReadiness(env = process.env) {
  const automaticTaxEnabled = isExplicitTrue(
    env.STRIPE_ONE_TIME_SUPPORT_AUTOMATIC_TAX_ENABLED,
  )
  const taxProductCodeConfigured = String(
    env.STRIPE_ONE_TIME_SUPPORT_TAX_PRODUCT_CODE ?? "",
  ).trim() === ONE_TIME_SUPPORT_TAX_CODE
  const taxProviderReady = isExplicitTrue(
    env.STRIPE_ONE_TIME_SUPPORT_TAX_PROVIDER_READY,
  )
  const taxRegistrationsReady = isExplicitTrue(
    env.STRIPE_ONE_TIME_SUPPORT_TAX_REGISTRATIONS_READY,
  )
  const taxClassificationConfirmed = isExplicitTrue(
    env.STRIPE_ONE_TIME_SUPPORT_TAX_CLASSIFICATION_CONFIRMED,
  )

  return {
    automaticTaxEnabled,
    taxProductCodeConfigured,
    taxProviderReady,
    taxRegistrationsReady,
    taxClassificationConfirmed,
    ready: automaticTaxEnabled
      && taxProductCodeConfigured
      && taxProviderReady
      && taxRegistrationsReady
      && taxClassificationConfirmed,
  }
}

/**
 * Validates one retrieved recurring Supporter Price against its public catalog
 * slot.
 *
 * @param {object} price Stripe Price retrieved with both `product` and
 * `currency_options` expanded.
 * @param {{key: string, interval: string, unitAmount: number}} expected The
 * environment key and exact recurring amount/interval contract for this slot.
 * @returns {string[]} Non-secret operator-facing failures; an empty array means
 * the active USD Price, Product tax code, and expanded currency set are exact.
 *
 * The caller owns Stripe retrieval and reporting. A string Product reference
 * or omitted `currency_options` is insufficient evidence and fails closed.
 */
export function validateRetrievedMembershipPrice(price, expected) {
  const failures = []

  if (price?.active !== true) {
    failures.push(`${expected.key} points to an inactive Stripe Price.`)
  }

  const semanticFailures = recurringPriceSemanticMismatches(price, {
    interval: expected.interval,
    unitAmount: expected.unitAmount,
    taxBehavior: SUPPORTER_RECURRING_TAX_BEHAVIOR,
  })
  const semanticMessages = {
    unit_amount: `${expected.key} must have unit_amount ${expected.unitAmount}; received ${price?.unit_amount ?? "missing"}.`,
    currency: `${expected.key} must use usd currency; received ${price?.currency ?? "missing"}.`,
    billing_scheme: `${expected.key} billing_scheme must be per_unit.`,
    "recurring.interval": `${expected.key} must be a ${expected.interval} recurring Price.`,
    "recurring.interval_count": `${expected.key} recurring interval_count must be exactly 1.`,
    "recurring.trial_period_days": `${expected.key} must not define a recurring trial period.`,
    "recurring.usage_type": `${expected.key} recurring usage_type must be licensed.`,
    tax_behavior: `${expected.key} must use exclusive tax behavior.`,
    transform_quantity: `${expected.key} must not transform quantity.`,
    currency_options: Object.hasOwn(price ?? {}, "currency_options")
      ? `${expected.key} must not define additional currency options.`
      : `${expected.key} must be retrieved with currency_options expanded.`,
  }

  for (const semanticFailure of semanticFailures) {
    failures.push(
      semanticMessages[semanticFailure]
      ?? `${expected.key} failed an unmapped recurring Price check: ${semanticFailure}.`,
    )
  }

  const product = (
    price?.product
    && typeof price.product !== "string"
  )
    ? price.product
    : null
  if (!product) {
    failures.push(`${expected.key} Product must be expanded for validation.`)
  } else {
    if (product.active !== true) {
      failures.push(`${expected.key} belongs to an inactive Stripe Product.`)
    }
    if (product.name !== SUPPORTER_MEMBERSHIP_PRODUCT_NAME) {
      failures.push(`${expected.key} Product name must be ${SUPPORTER_MEMBERSHIP_PRODUCT_NAME}.`)
    }
    if (product.tax_code !== SUPPORTER_RECURRING_TAX_CODE) {
      failures.push(`${expected.key} Product must use tax code ${SUPPORTER_RECURRING_TAX_CODE}.`)
    }
    // These fields bind the expanded Product to MassageLab's catalog and exact
    // amount slot; they are authorization evidence, not descriptive metadata.
    if (product.metadata?.app !== "massagelab") {
      failures.push(`${expected.key} Product must identify the MassageLab app.`)
    }
    if (product.metadata?.massagelab_catalog !== SUPPORTER_MEMBERSHIP_CATALOG_VERSION) {
      failures.push(`${expected.key} Product must use the Supporter catalog contract.`)
    }
    if (product.metadata?.massagelab_membership_level !== "SUPPORTER") {
      failures.push(`${expected.key} Product must grant Supporter membership.`)
    }
    const expectedAmountChoiceId = (
      typeof expected?.amountChoiceId === "string"
      && expected.amountChoiceId.length > 0
    )
      ? expected.amountChoiceId
      : null
    if (!expectedAmountChoiceId) {
      failures.push(`${expected.key} Price contract must identify a string amount choice.`)
    } else if (
      product.metadata?.massagelab_supporter_amount_choice
      !== expectedAmountChoiceId
    ) {
      failures.push(`${expected.key} Product must identify amount choice ${expectedAmountChoiceId}.`)
    }
  }

  return failures
}

/**
 * Verifies the six expanded Prices form three Products: one monthly and one
 * annual Price for each amount choice, with no Product shared across choices.
 */
export function validateSupporterProductTopology(entries) {
  const failures = []
  const productIdsByChoice = new Map()

  for (const { expected, price } of entries) {
    const productId = typeof price?.product === "string"
      ? price.product
      : price?.product?.id
    // Per-Price validation reports malformed entries; topology counts only
    // resolved amount-choice-to-Product relationships.
    if (!productId || !expected?.amountChoiceId) continue
    const ids = productIdsByChoice.get(expected.amountChoiceId) ?? new Set()
    ids.add(productId)
    productIdsByChoice.set(expected.amountChoiceId, ids)
  }

  const expectedChoiceIds = [...new Set(
    REQUIRED_SUPPORTER_PRICE_CONTRACT.map(({ amountChoiceId }) => amountChoiceId),
  )]
  for (const choiceId of expectedChoiceIds) {
    const observedIds = [...(productIdsByChoice.get(choiceId) ?? [])].sort()
    if (observedIds.length !== 1) {
      const idDetails = observedIds.length > 0
        ? ` (${observedIds.join(", ")})`
        : ""
      failures.push(
        `Supporter amount choice ${choiceId} must use exactly one Stripe Product; found ${observedIds.length}${idDetails}.`,
      )
    }
  }

  const productIds = [...productIdsByChoice.values()]
    .flatMap((ids) => [...ids])
  const distinctProductIds = [...new Set(productIds)].sort()
  if (distinctProductIds.length !== expectedChoiceIds.length) {
    const idDetails = distinctProductIds.length > 0
      ? ` (${distinctProductIds.join(", ")})`
      : ""
    failures.push(
      `The Supporter catalog must use ${expectedChoiceIds.length} distinct amount-specific Stripe Products; found ${distinctProductIds.length}${idDetails}.`,
    )
  }

  return failures
}
