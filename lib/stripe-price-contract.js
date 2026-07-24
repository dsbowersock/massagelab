/**
 * Reports the exact reusable recurring Price semantics shared by ongoing
 * readiness and the one-time catalog migration. Product ownership, active
 * state, and Product tax classification remain caller-owned checks.
 */
export function recurringPriceSemanticMismatches(
  candidate,
  {
    unitAmount,
    interval,
    taxBehavior,
  } = {},
) {
  const mismatches = []

  if (candidate?.unit_amount !== unitAmount) mismatches.push("unit_amount")
  if (candidate?.currency !== "usd") mismatches.push("currency")
  if (candidate?.billing_scheme !== "per_unit") mismatches.push("billing_scheme")
  if (candidate?.recurring?.interval !== interval) mismatches.push("recurring.interval")
  if (candidate?.recurring?.interval_count !== 1) mismatches.push("recurring.interval_count")
  if (candidate?.recurring?.trial_period_days != null) mismatches.push("recurring.trial_period_days")
  if (candidate?.recurring?.usage_type !== "licensed") mismatches.push("recurring.usage_type")
  if (taxBehavior !== undefined && candidate?.tax_behavior !== taxBehavior) {
    mismatches.push("tax_behavior")
  }
  if (candidate?.transform_quantity != null) mismatches.push("transform_quantity")

  const currencyOptions = candidate?.currency_options
  const currencyOptionKeys = (
    currencyOptions != null
    && typeof currencyOptions === "object"
    && !Array.isArray(currencyOptions)
  )
    ? Object.keys(currencyOptions)
    : null
  // Stripe may omit currency_options or return it empty. When an option exists,
  // accept only one non-null object keyed by the Price's base currency; extra
  // currencies and null, scalar, or array option values change the contract.
  const hasValidBaseCurrencyOption = (
    currencyOptionKeys?.length === 1
    && currencyOptionKeys[0] === candidate?.currency
    && currencyOptions[candidate.currency] != null
    && typeof currencyOptions[candidate.currency] === "object"
    && !Array.isArray(currencyOptions[candidate.currency])
  )
  if (
    currencyOptions != null
    && (
      currencyOptionKeys == null
      || (currencyOptionKeys.length > 0 && !hasValidBaseCurrencyOption)
    )
  ) {
    mismatches.push("currency_options")
  }

  return mismatches
}

/** Returns true only when every shared recurring Price semantic is exact. */
export function recurringPriceSemanticsMatch(candidate, expected) {
  return recurringPriceSemanticMismatches(candidate, expected).length === 0
}
