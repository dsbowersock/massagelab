/**
 * The deployed Supporter catalog is a fixed set of six recurring USD Prices.
 * Keep this contract separate from historical webhook price normalization.
 */
export const REQUIRED_SUPPORTER_PRICE_CONTRACT = Object.freeze([
  Object.freeze({ key: "STRIPE_SUPPORTER_1_MONTHLY_PRICE_ID", level: "SUPPORTER", interval: "month", unitAmount: 100 }),
  Object.freeze({ key: "STRIPE_SUPPORTER_1_YEARLY_PRICE_ID", level: "SUPPORTER", interval: "year", unitAmount: 1000 }),
  Object.freeze({ key: "STRIPE_SUPPORTER_2_MONTHLY_PRICE_ID", level: "SUPPORTER", interval: "month", unitAmount: 200 }),
  Object.freeze({ key: "STRIPE_SUPPORTER_2_YEARLY_PRICE_ID", level: "SUPPORTER", interval: "year", unitAmount: 2000 }),
  Object.freeze({ key: "STRIPE_SUPPORTER_5_MONTHLY_PRICE_ID", level: "SUPPORTER", interval: "month", unitAmount: 500 }),
  Object.freeze({ key: "STRIPE_SUPPORTER_5_YEARLY_PRICE_ID", level: "SUPPORTER", interval: "year", unitAmount: 5000 }),
])

export const SUPPORTER_RECURRING_TAX_CODE = "txcd_10000000"
export const SUPPORTER_RECURRING_TAX_BEHAVIOR = "exclusive"

function isExplicitTrue(value) {
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
 * Returns non-secret failures for a retrieved Stripe Price against its fixed
 * public-catalog contract. The CLI owns reporting and Stripe retrieval.
 */
export function validateRetrievedMembershipPrice(price, expected) {
  const failures = []

  if (!price.active) {
    failures.push(`${expected.key} points to an inactive Stripe Price.`)
  }

  if (price.recurring?.interval !== expected.interval) {
    failures.push(`${expected.key} must be a ${expected.interval} recurring Price.`)
  }

  if (price.currency !== "usd") {
    failures.push(`${expected.key} must use usd currency; received ${price.currency ?? "missing"}.`)
  }

  if (price.unit_amount !== expected.unitAmount) {
    failures.push(`${expected.key} must have unit_amount ${expected.unitAmount}; received ${price.unit_amount ?? "missing"}.`)
  }

  if (price.tax_behavior !== SUPPORTER_RECURRING_TAX_BEHAVIOR) {
    failures.push(`${expected.key} must use exclusive tax behavior.`)
  }

  if (
    !price.product
    || typeof price.product === "string"
    || price.product.tax_code !== SUPPORTER_RECURRING_TAX_CODE
  ) {
    failures.push(`${expected.key} Product must use tax code ${SUPPORTER_RECURRING_TAX_CODE}.`)
  }

  return failures
}
