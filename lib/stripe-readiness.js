import {
  recurringPriceSemanticMismatches,
  SUPPORTER_MEMBERSHIP_PRICE_CONTRACT,
  SUPPORTER_RECURRING_TAX_BEHAVIOR,
  SUPPORTER_RECURRING_TAX_CODE,
} from "./stripe-price-contract.js"

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
    level,
    interval,
    unitAmount,
  }) => Object.freeze({
    key: envKey,
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

  if (
    !price?.product
    || typeof price.product === "string"
    || price.product.tax_code !== SUPPORTER_RECURRING_TAX_CODE
  ) {
    failures.push(`${expected.key} Product must use tax code ${SUPPORTER_RECURRING_TAX_CODE}.`)
  }

  return failures
}
