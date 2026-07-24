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

  return failures
}
